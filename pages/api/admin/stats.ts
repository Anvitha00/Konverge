import type { NextApiRequest, NextApiResponse } from "next";
import { getServerSession } from "next-auth";
import { Pool } from "pg";

import { authOptions } from "@/lib/auth";

const pool = new Pool({
  connectionString:
    process.env.DATABASE_URL ||
    "postgres://postgres:postgres123@localhost:5432/konverge",
});

function isAdminEmail(email: string | null | undefined): boolean {
  if (!email || typeof email !== "string") return false;
  const list = (process.env.ADMIN_EMAILS ?? "")
    .split(",")
    .map((e) => e.trim().toLowerCase())
    .filter(Boolean);
  return list.includes(email.trim().toLowerCase());
}

export default async function handler(
  req: NextApiRequest,
  res: NextApiResponse
) {
  if (req.method !== "GET") {
    return res.status(405).json({ error: "Method not allowed" });
  }

  const session = await getServerSession(req, res, authOptions);
  if (!session?.user?.email || !isAdminEmail(session.user.email)) {
    return res.status(403).json({ error: "Admin access required" });
  }

  try {
    const client = await pool.connect();

    try {
      const [projectsRow, collabRow, usersRow, ownerDecisionsRow, userDecisionsRow] =
        await Promise.all([
          client.query(`
            SELECT
              COUNT(*) FILTER (WHERE status = 'Open') AS open_projects,
              COUNT(*) AS total_projects
            FROM projects
          `),
          client.query(`
            SELECT
              COUNT(*) FILTER (WHERE status = 'active') AS active_collaborations,
              COUNT(*) FILTER (WHERE status = 'completed') AS completed_collaborations
            FROM project_collaborators
          `),
          client.query(`
            SELECT
              COUNT(*) FILTER (WHERE account_status = 'frozen') AS frozen_users,
              COUNT(*) FILTER (WHERE account_status = 'active') AS active_users,
              COUNT(*) AS total_users
            FROM users
          `),
          client.query(`
            SELECT
              COUNT(*) FILTER (WHERE owner_decision = 'accepted') AS accepted,
              COUNT(*) FILTER (WHERE owner_decision = 'rejected') AS rejected
            FROM project_matches
            WHERE owner_decision IN ('accepted', 'rejected')
          `),
          client.query(`
            SELECT
              COUNT(*) FILTER (WHERE user_decision = 'accepted') AS accepted,
              COUNT(*) FILTER (WHERE user_decision = 'rejected') AS rejected
            FROM project_matches
            WHERE user_decision IN ('accepted', 'rejected')
          `),
        ]);

      let newUsers = 0;
      try {
        const newUsersResult = await client.query(`
          SELECT COUNT(*) AS new_users
          FROM users
          WHERE created_at >= CURRENT_DATE - INTERVAL '30 days'
        `);
        newUsers = Number(newUsersResult.rows[0]?.new_users ?? 0);
      } catch {
        // created_at may not exist until migration is applied
      }

      const projects = projectsRow.rows[0];
      const collab = collabRow.rows[0];
      const users = usersRow.rows[0];
      const ownerDec = ownerDecisionsRow.rows[0];
      const userDec = userDecisionsRow.rows[0];

      const ownerTotal = Number(ownerDec?.accepted ?? 0) + Number(ownerDec?.rejected ?? 0);
      const userTotal = Number(userDec?.accepted ?? 0) + Number(userDec?.rejected ?? 0);

      const acceptanceRateOwner =
        ownerTotal > 0
          ? Math.round((Number(ownerDec?.accepted ?? 0) / ownerTotal) * 1000) / 10
          : 0;
      const rejectionRateOwner =
        ownerTotal > 0
          ? Math.round((Number(ownerDec?.rejected ?? 0) / ownerTotal) * 1000) / 10
          : 0;
      const acceptanceRateUser =
        userTotal > 0
          ? Math.round((Number(userDec?.accepted ?? 0) / userTotal) * 1000) / 10
          : 0;
      const rejectionRateUser =
        userTotal > 0
          ? Math.round((Number(userDec?.rejected ?? 0) / userTotal) * 1000) / 10
          : 0;

      return res.status(200).json({
        openProjects: Number(projects?.open_projects ?? 0),
        totalProjects: Number(projects?.total_projects ?? 0),
        activeCollaborations: Number(collab?.active_collaborations ?? 0),
        completedCollaborations: Number(collab?.completed_collaborations ?? 0),
        frozenUsers: Number(users?.frozen_users ?? 0),
        activeUsers: Number(users?.active_users ?? 0),
        totalUsers: Number(users?.total_users ?? 0),
        newUsersLastMonth: newUsers,
        acceptanceRateOwner,
        rejectionRateOwner,
        acceptanceRateUser,
        rejectionRateUser,
      });
    } finally {
      client.release();
    }
  } catch (err) {
    console.error("Admin stats API error:", err);
    return res.status(500).json({
      error: "Database error",
      details: process.env.NODE_ENV === "development" ? String(err) : undefined,
    });
  }
}
