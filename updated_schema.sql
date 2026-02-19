-- Delete ALL duplicate Sonia threads, keep only the oldest one
WITH ranked_threads AS (
    SELECT 
        t.thread_id,
        t.created_at,
        ARRAY_AGG(tp.user_id ORDER BY tp.user_id) as participants,
        ROW_NUMBER() OVER (
            PARTITION BY ARRAY_AGG(tp.user_id ORDER BY tp.user_id)
            ORDER BY t.created_at ASC
        ) as rn
    FROM chat_threads t
    JOIN thread_participants tp ON t.thread_id = tp.thread_id
    GROUP BY t.thread_id, t.created_at
)
DELETE FROM message_reads
WHERE message_id IN (
    SELECT m.message_id 
    FROM messages m
    WHERE m.thread_id IN (
        SELECT thread_id FROM ranked_threads WHERE rn > 1
    )
);

WITH ranked_threads AS (
    SELECT 
        t.thread_id,
        t.created_at,
        ARRAY_AGG(tp.user_id ORDER BY tp.user_id) as participants,
        ROW_NUMBER() OVER (
            PARTITION BY ARRAY_AGG(tp.user_id ORDER BY tp.user_id)
            ORDER BY t.created_at ASC
        ) as rn
    FROM chat_threads t
    JOIN thread_participants tp ON t.thread_id = tp.thread_id
    GROUP BY t.thread_id, t.created_at
)
DELETE FROM messages
WHERE thread_id IN (
    SELECT thread_id FROM ranked_threads WHERE rn > 1
);

WITH ranked_threads AS (
    SELECT 
        t.thread_id,
        t.created_at,
        ARRAY_AGG(tp.user_id ORDER BY tp.user_id) as participants,
        ROW_NUMBER() OVER (
            PARTITION BY ARRAY_AGG(tp.user_id ORDER BY tp.user_id)
            ORDER BY t.created_at ASC
        ) as rn
    FROM chat_threads t
    JOIN thread_participants tp ON t.thread_id = tp.thread_id
    GROUP BY t.thread_id, t.created_at
)
DELETE FROM thread_participants
WHERE thread_id IN (
    SELECT thread_id FROM ranked_threads WHERE rn > 1
);

WITH ranked_threads AS (
    SELECT 
        t.thread_id,
        t.created_at,
        ARRAY_AGG(tp.user_id ORDER BY tp.user_id) as participants,
        ROW_NUMBER() OVER (
            PARTITION BY ARRAY_AGG(tp.user_id ORDER BY tp.user_id)
            ORDER BY t.created_at ASC
        ) as rn
    FROM chat_threads t
    JOIN thread_participants tp ON t.thread_id = tp.thread_id
    GROUP BY t.thread_id, t.created_at
)
DELETE FROM chat_threads
WHERE thread_id IN (
    SELECT thread_id FROM ranked_threads WHERE rn > 1
);

-- Verify - should see only unique threads now
SELECT 
    t.thread_id,
    ARRAY_AGG(u.name ORDER BY u.name) as participants
FROM chat_threads t
JOIN thread_participants tp ON t.thread_id = tp.thread_id
JOIN users u ON tp.user_id = u.user_id
GROUP BY t.thread_id
ORDER BY t.thread_id;