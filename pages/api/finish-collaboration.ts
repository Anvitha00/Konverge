import type { NextApiRequest, NextApiResponse } from 'next';
import { Pool } from 'pg';

const pool = new Pool({
  connectionString: process.env.DATABASE_URL || 'postgres://postgres:postgres123@localhost:5432/konverge',
});

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  const { userId, projectId } = req.body;

  // Validation
  if (!userId || !projectId) {
    return res.status(400).json({ 
      error: 'Missing required fields',
      required: ['userId', 'projectId']
    });
  }

  const userIdNum = parseInt(userId);
  const projectIdNum = parseInt(projectId);

  if (isNaN(userIdNum) || isNaN(projectIdNum)) {
    return res.status(400).json({ 
      error: 'userId and projectId must be valid numbers' 
    });
  }

  try {
    // Call the finish_collaboration function
    const result = await pool.query(
      'SELECT finish_collaboration($1, $2) as success',
      [userIdNum, projectIdNum]
    );

    const success = result.rows[0].success;

    if (!success) {
      return res.status(404).json({ 
        error: 'No active collaboration found for this user and project' 
      });
    }

    // Get updated collaboration count
    const countResult = await pool.query(
      `SELECT COUNT(*) as active_count 
       FROM project_collaborators 
       WHERE user_id = $1 AND status = 'active'`,
      [userIdNum]
    );

    return res.status(200).json({
      message: 'Collaboration marked as completed successfully',
      activeCollaborations: parseInt(countResult.rows[0].active_count),
      canJoinNewProjects: parseInt(countResult.rows[0].active_count) < 2
    });

  } catch (err) {
    console.error('Finish collaboration API error:', err);
    return res.status(500).json({ 
      error: 'Database error', 
      details: process.env.NODE_ENV === 'development' ? String(err) : undefined
    });
  }
}
