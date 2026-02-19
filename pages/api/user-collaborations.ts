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
    // Get user's active collaborations with project details and owner info
    const result = await pool.query(
      `SELECT 
         pc.collaboration_id,
         pc.project_id,
         pc.required_skill,
         pc.joined_at,
         p.title as project_title,
         p.description as project_description,
         p.required_skills as project_required_skills,
         p.owner_id as project_owner_id,
         u.name as project_owner_name,
         u.email as project_owner_email
       FROM project_collaborators pc
       JOIN projects p ON pc.project_id = p.project_id
       LEFT JOIN users u ON p.owner_id = u.user_id
       WHERE pc.user_id = $1 AND pc.status = 'active'
       ORDER BY pc.joined_at DESC`,
      [userIdNum]
    );

    return res.status(200).json({
      collaborations: result.rows,
      count: result.rows.length
    });

  } catch (err) {
    console.error('User collaborations API error:', err);
    return res.status(500).json({
      error: 'Database error',
      details: process.env.NODE_ENV === 'development' ? String(err) : undefined
    });
  }
}
