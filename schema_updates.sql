-- Add account_status column to users table
ALTER TABLE users 
ADD COLUMN IF NOT EXISTS account_status VARCHAR(20) DEFAULT 'active' 
CHECK (account_status IN ('active','frozen'));

-- Add function to check collaboration limit
CREATE OR REPLACE FUNCTION check_collaboration_limit()
RETURNS TRIGGER AS $$
DECLARE
    v_active_collaborations INT;
    v_open_projects INT;
BEGIN
    -- Count active collaborations for this user
    SELECT COUNT(*) INTO v_active_collaborations
    FROM project_collaborators
    WHERE user_id = NEW.user_id AND status = 'active';

    -- Count open (pitched) projects owned by this user
    SELECT COUNT(*) INTO v_open_projects
    FROM projects
    WHERE owner_id = NEW.user_id AND status = 'Open';

    -- Enforce a maximum of 2 total active commitments (pitched projects + collaborations)
    IF (COALESCE(v_active_collaborations, 0) + COALESCE(v_open_projects, 0)) >= 2 THEN
        RAISE EXCEPTION 'User can only have a maximum of 2 active collaborations / pitched projects at a time';
    END IF;
    
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Add trigger to enforce collaboration limit
DROP TRIGGER IF EXISTS enforce_collaboration_limit ON project_collaborators;
CREATE TRIGGER enforce_collaboration_limit
    BEFORE INSERT ON project_collaborators
    FOR EACH ROW
    EXECUTE PROCEDURE check_collaboration_limit();

-- Function to mark collaboration as completed
CREATE OR REPLACE FUNCTION finish_collaboration(p_user_id INT, p_project_id INT)
RETURNS BOOLEAN AS $$
BEGIN
    UPDATE project_collaborators
    SET status = 'completed',
        updated_at = CURRENT_TIMESTAMP
    WHERE user_id = p_user_id 
      AND project_id = p_project_id 
      AND status = 'active';
    
    RETURN FOUND;
END;
$$ LANGUAGE plpgsql;

-- Function to freeze inactive users (4 weeks no response)
CREATE OR REPLACE FUNCTION freeze_inactive_users()
RETURNS INT AS $$
DECLARE
    frozen_count INT := 0;
BEGIN
    -- Freeze users who haven't responded to any project matches in 4 weeks
    UPDATE users
    SET account_status = 'frozen'
    WHERE user_id IN (
        SELECT DISTINCT pm.recommended_user_id
        FROM project_matches pm
        WHERE pm.user_decision = 'pending'
          AND pm.created_at < CURRENT_TIMESTAMP - INTERVAL '4 weeks'  -- Changed from 5 to 4 weeks
          AND pm.recommended_user_id NOT IN (
              -- Exclude users who have recent activity
              SELECT DISTINCT recommended_user_id
              FROM project_matches
              WHERE user_decision IN ('accepted', 'rejected')
                AND user_decided_at > CURRENT_TIMESTAMP - INTERVAL '4 weeks'
          )
    )
    AND account_status = 'active';
    
    GET DIAGNOSTICS frozen_count = ROW_COUNT;
    RETURN frozen_count;
END;
$$ LANGUAGE plpgsql;

-- Function to unfreeze a user
CREATE OR REPLACE FUNCTION unfreeze_user(p_user_id INT)
RETURNS BOOLEAN AS $$
BEGIN
    UPDATE users
    SET account_status = 'active'
    WHERE user_id = p_user_id AND account_status = 'frozen';
    
    RETURN FOUND;
END;
$$ LANGUAGE plpgsql;

-- View for active collaborations count per user
CREATE OR REPLACE VIEW user_collaboration_summary AS
SELECT 
    u.user_id,
    u.name,
    u.email,
    u.account_status,
    COUNT(CASE WHEN pc.status = 'active' THEN 1 END) as active_collaborations,
    COUNT(CASE WHEN pc.status = 'completed' THEN 1 END) as completed_collaborations,
    MAX(pc.joined_at) as last_collaboration_date
FROM users u
LEFT JOIN project_collaborators pc ON u.user_id = pc.user_id
GROUP BY u.user_id, u.name, u.email, u.account_status;

-- View for users pending decisions (older than 5 weeks)
CREATE OR REPLACE VIEW users_pending_decisions AS
SELECT 
    u.user_id,
    u.name,
    u.email,
    COUNT(pm.match_id) as pending_decisions,
    MAX(pm.created_at) as oldest_pending_date
FROM users u
JOIN project_matches pm ON u.user_id = pm.recommended_user_id
WHERE pm.user_decision = 'pending'
  AND pm.created_at < CURRENT_TIMESTAMP - INTERVAL '5 weeks'
  AND u.account_status = 'active'
GROUP BY u.user_id, u.name, u.email
HAVING COUNT(pm.match_id) > 0;

-- Add created_at to users for "new users in past month" admin stat
ALTER TABLE users ADD COLUMN IF NOT EXISTS created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP;
UPDATE users SET created_at = CURRENT_TIMESTAMP WHERE created_at IS NULL;

-- Ensure projects has created_at for admin growth charts (in case of older schema)
ALTER TABLE projects ADD COLUMN IF NOT EXISTS created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP;
UPDATE projects SET created_at = CURRENT_TIMESTAMP WHERE created_at IS NULL;
