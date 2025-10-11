import type { NextApiRequest, NextApiResponse } from 'next';
import { Pool } from 'pg';

const pool = new Pool({
  connectionString: process.env.DATABASE_URL || 'postgres://postgres:postgres123@localhost:5433/konverge',
});

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  const { name, email } = req.body;

  // Validation
  if (!name || typeof name !== 'string' || !name.trim()) {
    return res.status(400).json({ error: 'Name is required' });
  }

  if (!email || typeof email !== 'string' || !email.trim()) {
    return res.status(400).json({ error: 'Email is required' });
  }

  // Email format validation
  const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
  if (!emailRegex.test(email)) {
    return res.status(400).json({ error: 'Invalid email format' });
  }

  try {
    // Check if email already exists
    const existingUser = await pool.query(
      'SELECT user_id FROM users WHERE email = $1',
      [email.trim()]
    );

    if (existingUser.rows.length > 0) {
      return res.status(409).json({ error: 'Email already registered. Please sign in instead.' });
    }

    // Insert new user with only name and email
    // Skills, bio, github, linkedin will be added during onboarding
    const result = await pool.query(
      `INSERT INTO users (name, email, rating, engagement_score)
       VALUES ($1, $2, 0.0, 0)
       RETURNING user_id, name, email`,
      [name.trim(), email.trim()]
    );

    return res.status(201).json({
      message: 'User created successfully',
      user: result.rows[0],
    });
  } catch (err) {
    console.error('Registration error:', err);
    return res.status(500).json({ error: 'Database error. Please try again later.' });
  }
}