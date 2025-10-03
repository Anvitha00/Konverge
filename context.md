# Konverge - Copilot Context

Konverge is a community-driven collaboration platform where users can pitch projects, showcase technical knowledge, and find collaborators through skill-based matching.

## Current Focus

- Create a PostgreSQL database schema with tables:
  - `users`, `projects`, `interactions`, `chats`, `engagement`
- Seed synthetic data for testing.
- Build a **login page** (Next.js + Tailwind) using a dummy password (`dummy123`).
- Make the dashboard dynamic: fetch data from DB instead of static placeholders.

## Data to Render per User

- Pitched projects
- Technical knowledge (skills)
- Recommended profiles for collaboration
- Matched projects to the user
- Engagement score
- Chats
- Leaderboard

## Backend

- If direct DB queries from frontend aren’t enough, use **FastAPI (Python)** as a backend.
- `app.py` should expose endpoints:
  - `/users`
  - `/projects`
  - `/recommendations`
  - `/chats`
  - `/leaderboard`

## Authentication

- For now: dummy password check.
- Later: integrate **NextAuth.js / OAuth**.

## Copilot Guidance

- When writing queries, assume PostgreSQL.
- When writing frontend, use Next.js App Router + Tailwind.
- When backend is needed, suggest FastAPI routes in `app.py`.

## Next Steps

1. Write `init_db.sql` (schema + synthetic seed data).
2. Build login page (Next.js).
3. Connect frontend to database/backend APIs.
4. Replace all static dashboard data with live queries.
