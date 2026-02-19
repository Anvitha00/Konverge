import type { NextApiRequest, NextApiResponse } from 'next';
import { Pool } from 'pg';

const pool = new Pool({
  connectionString: process.env.DATABASE_URL || 'postgres://postgres:postgres123@localhost:5432/konverge',
});

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  const { email } = req.body;

  if (!email || typeof email !== 'string') {
    return res.status(400).json({ error: 'Invalid email' });
  }

  try {
    const result = await pool.query(
      'SELECT user_id, name, email, skills, bio, github, linkedin, rating, engagement_score FROM users WHERE email = $1',
      [email]
    );

    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'User does not exist. Please register.' });
    }

    const dbUser = result.rows[0];

    // Map database fields to frontend User type
    const user = {
      id: String(dbUser.user_id),           // Convert number to string for frontend
      user_id: dbUser.user_id,              // Keep for database operations
      name: dbUser.name,
      email: dbUser.email,
      skills: dbUser.skills || [],
      bio: dbUser.bio,
      links: {
        github: dbUser.github,
        linkedin: dbUser.linkedin,
      },
      rating: dbUser.rating,
      engagement_score: dbUser.engagement_score,
      availability: 'available' as const,   // Default value
      badges: [],                            // Default empty
      points: dbUser.engagement_score || 0,
      joinedAt: new Date(),                 // You can add created_at to schema if needed
    };

    return res.status(200).json({ user });
  } catch (err) {
    console.error('Login API error:', err);
    return res.status(500).json({ error: 'Database error', details: String(err) });
  }
}