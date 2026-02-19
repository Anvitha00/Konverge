import type { NextApiRequest, NextApiResponse } from 'next';
import bcrypt from 'bcrypt';
import pool from '@/lib/db';

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  const { name, email, password } = req.body as {
    name?: string;
    email?: string;
    password?: string;
  };

  // Validation
  if (!name || typeof name !== 'string' || !name.trim()) {
    return res.status(400).json({ error: 'Name is required' });
  }

  if (!email || typeof email !== 'string' || !email.trim()) {
    return res.status(400).json({ error: 'Email is required' });
  }

  if (!password || typeof password !== 'string' || !password.trim()) {
    return res.status(400).json({ error: 'Password is required' });
  }

  // Field format validation
  const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
  if (!emailRegex.test(email)) {
    return res.status(400).json({ error: 'Invalid email format' });
  }

  if (password.length < 8) {
    return res.status(400).json({ error: 'Password must be at least 8 characters long' });
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

    const passwordHash = await bcrypt.hash(password.trim(), 10);

    // Insert new user; profile fields filled during onboarding
    const result = await pool.query(
      `INSERT INTO users (name, email, password_hash, rating, engagement_score)
       VALUES ($1, $2, $3, 0.0, 0)
       RETURNING user_id, name, email`,
      [name.trim(), email.trim(), passwordHash]
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