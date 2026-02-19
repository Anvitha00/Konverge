import type { NextApiRequest, NextApiResponse } from 'next';
import { Pool } from 'pg';

const pool = new Pool({
  connectionString: process.env.DATABASE_URL || 'postgres://postgres:postgres123@localhost:5432/konverge',
});

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  const { email, bio, skills, github, linkedin } = req.body;

  // Validation
  if (!email || typeof email !== 'string') {
    return res.status(400).json({ error: 'Email is required' });
  }

  if (!bio || typeof bio !== 'string' || !bio.trim()) {
    return res.status(400).json({ error: 'Bio is required' });
  }

  if (!Array.isArray(skills) || skills.length === 0) {
    return res.status(400).json({ error: 'At least one skill is required' });
  }

  if (!github || typeof github !== 'string' || !github.trim()) {
    return res.status(400).json({ error: 'GitHub URL is required' });
  }

  if (!linkedin || typeof linkedin !== 'string' || !linkedin.trim()) {
    return res.status(400).json({ error: 'LinkedIn URL is required' });
  }

  // URL validation
  const urlRegex = /^https?:\/\/.+/;
  if (!urlRegex.test(github)) {
    return res.status(400).json({ error: 'Invalid GitHub URL format' });
  }

  if (!urlRegex.test(linkedin)) {
    return res.status(400).json({ error: 'Invalid LinkedIn URL format' });
  }

  try {
    // Update user with onboarding information
    const result = await pool.query(
      `UPDATE users 
       SET bio = $1, skills = $2, github = $3, linkedin = $4
       WHERE email = $5
       RETURNING user_id, name, email, bio, skills, github, linkedin, rating, engagement_score`,
      [bio.trim(), skills, github.trim(), linkedin.trim(), email.trim()]
    );

    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'User not found. Please register first.' });
    }

    const dbUser = result.rows[0];

    // Map to frontend User type
    const user = {
      id: String(dbUser.user_id),
      user_id: dbUser.user_id,
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
      availability: 'available' as const,
      badges: [],
      points: dbUser.engagement_score || 0,
      joinedAt: new Date(),
    };

    return res.status(200).json({
      message: 'Onboarding completed successfully',
      user,
    });
  } catch (err) {
    console.error('Onboarding error:', err);
    return res.status(500).json({ error: 'Database error. Please try again later.' });
  }
}