import type { NextApiRequest, NextApiResponse } from 'next';
import { Pool } from 'pg';

const pool = new Pool({
  connectionString: process.env.DATABASE_URL || 'postgres://postgres:postgres123@localhost:5432/konverge',
});

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method !== 'GET') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  const { userId } = req.query;

  if (!userId || typeof userId !== 'string') {
    return res.status(400).json({
      error: 'Missing or invalid userId parameter'
    });
  }

  const userIdNum = parseInt(userId);
  if (isNaN(userIdNum)) {
    return res.status(400).json({
      error: 'userId must be a valid number'
    });
  }

  try {
    // Primary path: use the user_collaboration_summary view if it exists
    try {
      const result = await pool.query(
        `SELECT 
           s.active_collaborations,
           s.completed_collaborations,
           s.account_status,
           COALESCE(p.open_projects, 0) AS pitched_projects,
           (COALESCE(s.active_collaborations, 0) + COALESCE(p.open_projects, 0)) AS total_commitments,
           CASE 
             WHEN (COALESCE(s.active_collaborations, 0) + COALESCE(p.open_projects, 0)) >= 2 
               THEN false 
             ELSE true 
           END AS can_join_new_projects
         FROM user_collaboration_summary s
         LEFT JOIN (
           SELECT owner_id, COUNT(*) AS open_projects
           FROM projects
           WHERE status = 'Open'
           GROUP BY owner_id
         ) p ON p.owner_id = s.user_id
         WHERE s.user_id = $1`,
        [userIdNum]
      );

      if (result.rows.length === 0) {
        return res.status(404).json({
          error: 'User not found'
        });
      }

      const userSummary = result.rows[0];

      return res.status(200).json({
        userId: userIdNum,
        activeCollaborations: userSummary.active_collaborations,
        completedCollaborations: userSummary.completed_collaborations,
        pitchedProjects: userSummary.pitched_projects,
        totalCommitments: userSummary.total_commitments,
        accountStatus: userSummary.account_status,
        canJoinNewProjects: userSummary.can_join_new_projects,
      });
    } catch (innerErr: any) {
      // Fallback path: if the view doesn't exist yet, compute from base tables
      if (innerErr?.code !== '42P01') {
        throw innerErr;
      }

      // Ensure user exists and get account_status
      const userResult = await pool.query(
        `SELECT account_status FROM users WHERE user_id = $1`,
        [userIdNum]
      );
      if (userResult.rows.length === 0) {
        return res.status(404).json({ error: 'User not found' });
      }
      const accountStatus = userResult.rows[0].account_status ?? 'active';

      // Count active and completed collaborations
      const collabResult = await pool.query(
        `SELECT
           COUNT(CASE WHEN status = 'active' THEN 1 END) AS active_collaborations,
           COUNT(CASE WHEN status = 'completed' THEN 1 END) AS completed_collaborations
         FROM project_collaborators
         WHERE user_id = $1`,
        [userIdNum]
      );
      const collabRow = collabResult.rows[0] || {};
      const activeCollaborations = Number(collabRow.active_collaborations || 0);
      const completedCollaborations = Number(collabRow.completed_collaborations || 0);

      // Count pitched (open) projects owned by the user
      const pitchedResult = await pool.query(
        `SELECT COUNT(*) AS pitched_projects
         FROM projects
         WHERE owner_id = $1 AND status = 'Open'`,
        [userIdNum]
      );
      const pitchedProjects = Number(pitchedResult.rows[0]?.pitched_projects || 0);

      const totalCommitments = activeCollaborations + pitchedProjects;
      const canJoinNewProjects = totalCommitments < 2;

      return res.status(200).json({
        userId: userIdNum,
        activeCollaborations,
        completedCollaborations,
        pitchedProjects,
        totalCommitments,
        accountStatus,
        canJoinNewProjects,
      });
    }

  } catch (err) {
    console.error('User collaboration status API error:', err);
    return res.status(500).json({
      error: 'Database error',
      details: process.env.NODE_ENV === 'development' ? String(err) : undefined
    });
  }
}
