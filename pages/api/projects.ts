import type { NextApiRequest, NextApiResponse } from 'next';
import { Pool } from 'pg';

const pool = new Pool({
  connectionString:'postgres://postgres:postgres123@localhost:5433/konverge',
});

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method === 'POST') {
    const { title, description, required_skills, owner_id, status, roles_available } = req.body;

    // Validation
    if (!title || !description || !required_skills || !owner_id) {
      return res.status(400).json({ 
        error: 'Missing required fields',
        required: ['title', 'description', 'required_skills', 'owner_id']
      });
    }

    // Validate required_skills is an array
    if (!Array.isArray(required_skills)) {
      return res.status(400).json({ 
        error: 'required_skills must be an array' 
      });
    }

    // Validate roles_available is a number
    const rolesNum = roles_available !== undefined ? parseInt(roles_available) : 0;
    if (isNaN(rolesNum) || rolesNum < 0) {
      return res.status(400).json({ 
        error: 'roles_available must be a valid number' 
      });
    }

    try {
      // Insert project into database - matching your schema exactly
      const result = await pool.query(
        `INSERT INTO projects (title, description, required_skills, owner_id, status, roles_available, created_at)
         VALUES ($1, $2, $3, $4, $5, $6, NOW())
         RETURNING project_id, title, description, required_skills, owner_id, status, roles_available, created_at`,
        [title, description, required_skills, owner_id, status || 'Open', rolesNum]
      );

      return res.status(201).json({ 
        message: 'Project created successfully',
        project: result.rows[0]
      });
    } catch (err) {
      console.error('Create Project API error:', err);
      return res.status(500).json({ 
        error: 'Database error', 
        details: process.env.NODE_ENV === 'development' ? String(err) : undefined
      });
    }
  }
  
  if (req.method === 'GET') {
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

  return res.status(405).json({ error: 'Method not allowed' });
}