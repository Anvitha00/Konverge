import type { NextApiRequest, NextApiResponse } from 'next';
import { Pool } from 'pg';

const pool = new Pool({
  connectionString:'postgres://postgres:postgres123@localhost:5433/konverge',
});

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method !== 'GET') {
    return res.status(405).json({ error: 'Method not allowed' });
  }
  const { userId } = req.query;
  if (!userId) {
    return res.status(400).json({ error: 'Missing userId' });
  }
  try {
    const result = await pool.query(
      `SELECT user_id, name, email, bio, skills, github, linkedin, rating, engagement_score
       FROM users
       WHERE user_id = $1`,
      [userId]
    );
    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'User not found' });
    }
    res.status(200).json({ user: result.rows[0] });
  } catch (err) {
    console.error('Profile API error:', err);
    res.status(500).json({ error: 'Database error', details: String(err) });
  }
}