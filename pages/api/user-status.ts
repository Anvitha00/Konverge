import type { NextApiRequest, NextApiResponse } from 'next';
import { Pool } from 'pg';

const pool = new Pool({
  connectionString: process.env.DATABASE_URL || 'postgres://postgres:postgres123@localhost:5432/konverge',
});

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method === 'POST') {
    // Freeze inactive users
    try {
      const result = await pool.query('SELECT freeze_inactive_users() as frozen_count');
      const frozenCount = result.rows[0].frozen_count;

      return res.status(200).json({
        message: 'Inactive user freeze process completed',
        usersFrozen: frozenCount
      });
    } catch (err) {
      console.error('Freeze inactive users API error:', err);
      return res.status(500).json({
        error: 'Database error',
        details: process.env.NODE_ENV === 'development' ? String(err) : undefined
      });
    }
  }

  if (req.method === 'PATCH') {
    // Unfreeze a specific user
    const { userId } = req.body;

    if (!userId) {
      return res.status(400).json({
        error: 'Missing required field: userId'
      });
    }

    const userIdNum = parseInt(userId);
    if (isNaN(userIdNum)) {
      return res.status(400).json({
        error: 'userId must be a valid number'
      });
    }

    try {
      const result = await pool.query('SELECT unfreeze_user($1) as success', [userIdNum]);
      const success = result.rows[0].success;

      if (!success) {
        return res.status(404).json({
          error: 'User not found or not frozen'
        });
      }

      return res.status(200).json({
        message: 'User unfrozen successfully',
        userId: userIdNum
      });

    } catch (err) {
      console.error('Unfreeze user API error:', err);
      return res.status(500).json({
        error: 'Database error',
        details: process.env.NODE_ENV === 'development' ? String(err) : undefined
      });
    }
  }

  if (req.method === 'GET') {
    // Get users with pending decisions (older than 5 weeks)
    try {
      const result = await pool.query('SELECT * FROM users_pending_decisions ORDER BY oldest_pending_date');

      return res.status(200).json({
        usersWithPendingDecisions: result.rows,
        count: result.rows.length
      });

    } catch (err) {
      console.error('Get pending decisions API error:', err);
      return res.status(500).json({
        error: 'Database error',
        details: process.env.NODE_ENV === 'development' ? String(err) : undefined
      });
    }
  }

  return res.status(405).json({ error: 'Method not allowed' });
}
