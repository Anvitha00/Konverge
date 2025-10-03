import type { NextApiRequest, NextApiResponse } from 'next';
import { Pool } from 'pg';

const pool = new Pool({
  connectionString: process.env.DATABASE_URL || 'postgres://postgres:postgres@localhost:5433/konverge',
});

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }
  const { email, bio, skills, github, linkedin } = req.body;
  if (!email || !bio || !skills || !github || !linkedin) {
    return res.status(400).json({ error: 'Missing required fields' });
  }
  try {
    // Convert skills to array
    const skillsArr = skills.split(',').map((s: string) => s.trim()).filter(Boolean);
    // Update user profile
    await pool.query(
      'UPDATE users SET bio = $1, skills = $2, github = $3, linkedin = $4 WHERE email = $5',
      [bio, skillsArr, github, linkedin, email]
    );
    return res.status(200).json({ success: true });
  } catch (err) {
    return res.status(500).json({ error: 'Database error' });
  }
}
