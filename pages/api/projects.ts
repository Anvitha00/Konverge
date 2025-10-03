import type { NextApiRequest, NextApiResponse } from 'next';
import { Pool } from 'pg';

const pool = new Pool({
  connectionString:'postgres://postgres:postgres123@localhost:5433/konverge',
});

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method !== 'GET') {
    return res.status(405).json({ error: 'Method not allowed' });
  }
  const { view, userId } = req.query;
  try {
    if (view === 'pitching') {
      // All projects, newest first
      const result = await pool.query(
        `SELECT p.*, u.name AS owner_name, u.email AS owner_email
         FROM projects p
         JOIN users u ON p.owner_id = u.user_id
         ORDER BY p.project_id DESC`
      );
      return res.status(200).json({ projects: result.rows });
    } else if (view === 'matching' && userId) {
      // Projects matched to user
      const result = await pool.query(
        `SELECT p.*, u.name AS owner_name, u.email AS owner_email
         FROM matched m
         JOIN projects p ON m.project_id = p.project_id
         JOIN users u ON p.owner_id = u.user_id
         WHERE m.user_id = $1
         ORDER BY m.matched_on DESC`,
        [userId]
      );
      return res.status(200).json({ projects: result.rows });
    } else {
      return res.status(400).json({ error: 'Invalid view or missing userId' });
    }
  } catch (err) {
    console.error('Projects API error:', err);
    return res.status(500).json({ error: 'Database error', details: String(err) });
  }
}
