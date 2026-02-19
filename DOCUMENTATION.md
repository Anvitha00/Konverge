# Konverge – Project Documentation

This document describes the Konverge platform as implemented in the codebase: a web-based collaboration system that connects project owners with potential collaborators through skill-based matching, feedback learning, real-time chat, and engagement tracking.

---

## 1. Introduction

Konverge is a smart collaboration platform where developers can pitch project ideas, receive automated collaborator recommendations, and work together using in-app chat. The system uses a multi-factor scoring model (skills, engagement, peer rating, and historical accept/reject feedback) to suggest suitable collaborators and enforces collaboration limits and inactive-user handling.

### 1.1 Problem Statement

In the current ecosystem, developers struggle to find suitable collaborators for their projects, and skilled individuals lack a single place to discover projects that match their expertise. The platform addresses:

- **Discovery gap** – No systematic way to match project requirements with user skills.
- **Trust deficit** – Few reliable signals for collaborator credibility or past performance.
- **Poor engagement** – Limited incentives and visibility for active participation.
- **Fragmented communication** – Coordination often happens across multiple external tools.
- **Quality assessment** – No standard way to evaluate contributions or collaboration quality.

The implementation addresses these by: automated recommendations with weighted scoring, peer ratings and engagement points, integrated WebSocket chat, and feedback-based learning from accept/reject decisions.

### 1.2 Objectives

The implemented system aims to:

1. **Enable project pitching** – Users create projects with title, description, and required skills; the backend stores them and triggers recommendations.
2. **Recommend collaborators automatically** – For each project, the backend computes a composite score (skill match, engagement, rating, feedback) and stores top candidates per required skill in `project_matches`.
3. **Track decisions and learn** – Accept/reject decisions are recorded in `match_feedback` and in `user_feedback_stats` (per-user, per-skill accept rate) to refine future recommendations.
4. **Enforce collaboration limits** – A user may have at most two active commitments (pitched projects + active collaborations); the database trigger and candidate query enforce this.
5. **Support real-time chat** – Thread-based messaging over WebSockets so owners and collaborators can communicate without leaving the platform.
6. **Rank and analyse users** – Engagement points for pitching, applying, and starting collaborations; leaderboard and analytics dashboard; peer ratings after collaboration completion.

### 1.3 Existing Models

The design draws from existing platforms and recommendation approaches:

- **GitHub / LinkedIn** – Collaboration and networking without automated skill-based matching.
- **Upwork** – Paid freelancer matching; not aimed at volunteer or student-led collaboration.
- **Kaggle** – Domain-specific team formation, not general project collaboration.
- **Collaborative filtering** – Uses behaviour (e.g. accept/reject history) via `user_feedback_stats` accept rate.
- **Content-based matching** – Uses profile attributes (skills) via overlap between required and user skills.
- **Hybrid** – The implementation combines both: skill overlap and behavioural feedback (engagement, rating, accept rate) in one composite score.

### 1.4 Dataset

The system uses a **synthetic dataset** defined in SQL and optional Python scripts:

- **Entities:**
  - **users** – `user_id`, `name`, `email`, `password_hash`, `skills` (array), `bio`, `github`, `linkedin`, `rating`, `engagement_score`, `account_status`.
  - **projects** – `project_id`, `title`, `description`, `required_skills` (array), `owner_id`, `status`, `roles_available`, `created_at`.
  - **project_matches** – Recommendation snapshots: `match_id`, `project_id`, `recommended_user_id`, `required_skill`, `skill_match_score`, `engagement_score_snapshot`, `rating_snapshot`, `owner_decision`, `user_decision`, `source_type` (automated/manual), timestamps.
  - **project_collaborators** – Active or completed collaborations: `project_id`, `user_id`, `required_skill`, `status` (active/completed/removed), `joined_at`.
  - **engagement** – Activity log: `user_id`, `points`, `reason`, `timestamp`.
  - **user_ratings** – Peer ratings: `project_id`, `rater_id`, `ratee_id`, `score`, `feedback`, `status` (pending/completed).
  - **user_feedback_stats** – Learning: `user_id`, `skill`, `total_recommendations`, `accepted_count`, `rejected_count`, `accept_rate`.
  - **match_feedback** – Decision log: `match_id`, `actor_type`, `decision`, `reason_json`.
  - **Chat** – `chat_threads`, `thread_participants`, `messages`, `message_reads` (created at runtime if not present).

- **Source:** `init_db.sql` for schema and seed data; `schema_updates.sql` for triggers, views, and freeze/unfreeze functions; optional `populate_demo_data.py` for richer demo data.

Example schema (core tables from `init_db.sql`):

```sql
CREATE TABLE users (
    user_id SERIAL PRIMARY KEY,
    name VARCHAR(100) NOT NULL,
    email VARCHAR(150) UNIQUE NOT NULL,
    password_hash VARCHAR(255) NOT NULL,
    skills TEXT[],
    bio TEXT,
    github VARCHAR(150),
    linkedin VARCHAR(150),
    rating NUMERIC(2,1) DEFAULT 0.0,
    engagement_score INT DEFAULT 0,
    account_status VARCHAR(20) DEFAULT 'active' CHECK (account_status IN ('active','frozen'))
);

CREATE TABLE project_matches (
    match_id SERIAL PRIMARY KEY,
    project_id INT NOT NULL REFERENCES projects(project_id) ON DELETE CASCADE,
    recommended_user_id INT NOT NULL REFERENCES users(user_id) ON DELETE CASCADE,
    required_skill TEXT,
    skill_match_score NUMERIC(5,2) DEFAULT 0.0,
    engagement_score_snapshot INT DEFAULT 0,
    rating_snapshot NUMERIC(2,1) DEFAULT 0.0,
    owner_decision VARCHAR(10) DEFAULT 'pending' CHECK (owner_decision IN ('pending','accepted','rejected')),
    user_decision VARCHAR(10) DEFAULT 'pending' CHECK (user_decision IN ('pending','accepted','rejected')),
    source_type VARCHAR(10) DEFAULT 'automated' CHECK (source_type IN ('automated','manual')),
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT uq_project_user_skill UNIQUE (project_id, recommended_user_id, required_skill)
);
```

### 1.5 Proposed Model (Brief)

The implemented flow is:

1. **Authentication** – NextAuth.js credentials provider; login with email/password; user stored in PostgreSQL and mapped into JWT/session; frontend keeps user in Zustand (`auth-store`) with persistence.
2. **Project creation** – Owner submits project via API; backend inserts into `projects`, awards engagement points, and calls `generate_recommendations_for_project(project_id)`.
3. **Recommendation engine** – Fetches candidates (active, under commitment limit), computes skill match (overlap vs required skills), loads engagement, rating, and per-skill accept rate from `user_feedback_stats`; builds composite score with fixed weights; selects up to three candidates per required skill and writes rows into `project_matches`.
4. **Dual decisions** – Owner and recommended user each accept or reject via PATCH endpoints; decisions stored in `project_matches` and `match_feedback`; `user_feedback_stats` updated for automated matches.
5. **Collaboration formation** – When both accept, a row is inserted into `project_collaborators`, engagement points are awarded, and rating prompts are created for later peer feedback.
6. **Chat** – Clients connect to FastAPI WebSocket `/ws/{user_id}`; join threads, send messages (persisted in `messages`), broadcast to thread participants, and support typing and read indicators.
7. **Collaboration limits** – At most two active commitments (pitched + collaborations); enforced by DB trigger on `project_collaborators` and by excluding over-committed users from candidate set. Users can mark a collaboration as completed via “Finish collaboration” (API calls `finish_collaboration`), freeing a slot.
8. **Inactive users** – Optional freeze of users with long-pending decisions (e.g. 5 weeks) via `freeze_inactive_users()`; frozen users are excluded from recommendations by `account_status = 'active'` in the candidate query.

---

## 2. Literature Survey

Existing work on collaboration and recommendation informs the design:

- **Collaborative filtering** recommends based on past behaviour (e.g. similar users’ choices). Konverge uses accept/reject history per skill in `user_feedback_stats` as a behavioural signal in the composite score.
- **Content-based recommendation** matches on attributes (e.g. skills). The implementation compares required skills with user skills and uses overlap relative to required set size as the skill component.
- **Hybrid recommenders** combine both; Konverge’s scoring is hybrid: skill overlap (content) plus engagement, rating, and accept rate (behaviour).
- **Platforms** such as GitHub, LinkedIn, Upwork, and Kaggle offer collaboration or matching but lack this combination of skill-based matching, engagement, peer rating, and feedback learning in one product. Konverge implements a unified flow: pitch → auto-recommend → dual accept/reject → feedback learning → collaboration and chat.

---

## 3. Theoretical Background

- **Content-based component** – Project requirements (required_skills) are matched to user profiles (skills). The implemented metric is overlap-based: (|required ∩ user| / |required|) × 100, normalized and clamped for use in the composite score.
- **Behavioural component** – Engagement score (activity points), average peer rating, and per-skill accept rate from past recommendations are used so that active, highly rated, and historically accepted users rank higher.
- **Multi-criteria scoring** – The composite score is a weighted sum of (skill, engagement, rating, feedback), with weights 0.5, 0.15, 0.15, 0.2. Engagement and rating are normalized to [0, 100] or similar before applying weights.
- **Feedback-based learning** – Accept/reject outcomes update `user_feedback_stats`. The accept rate per (user, skill) is used as the feedback component in future recommendations, implementing a simple form of reinforcement from user decisions.

---

## 4. Requirement Specifications

### 4.1 User Requirements

Target users are students, independent developers, and professionals who want to collaborate on projects. The system assumes:

- Basic computer literacy and use of a modern web browser.
- Ability to register (name, email, password), complete onboarding (bio, skills, GitHub, LinkedIn), and sign in.
- Ability to create projects (title, description, required skills), view recommended collaborators, and accept or reject matches.
- Ability to view “Assigned to me” and “My pitched projects” (matched page), respond to recommendations, and optionally mark collaborations as completed.
- Ability to use the in-app chat (thread list, open thread, send messages, see typing/read state).
- Ability to view profile, dashboard analytics, and leaderboard, and to submit peer ratings when prompted.

### 4.2 Software Requirements

**Frontend**

- **React 18** and **Next.js 13** (App Router) for UI and routing.
- **TypeScript** for type safety.
- **Tailwind CSS** for styling.
- **Radix UI** (via shadcn-style components) for accessible primitives.
- **Zustand** (with persist) for client state (e.g. auth).
- **TanStack Query** for server state and API caching.
- **NextAuth.js** for authentication (credentials provider, JWT session).
- **Recharts** for dashboard charts.
- **Sonner** for toasts.
- **WebSocket API** (browser) for chat, wrapped in a custom hook (e.g. `useWebSocket`).

**Backend**

- **Python 3** with **FastAPI** for REST and WebSocket APIs.
- **Uvicorn** as ASGI server.
- **PostgreSQL** for persistence (connection via `psycopg2`; `DATABASE_URL` or default connection).
- **Pydantic** for request/response validation.

**APIs**

- Next.js API routes under `pages/api/`: auth (NextAuth), profile, projects, login, register, onboarding, finish-collaboration, user-collaboration-status, user-collaborations, user-status, etc. These use the same PostgreSQL database (e.g. `lib/db` or pool with `DATABASE_URL`).
- FastAPI at `http://localhost:8000` (or `NEXT_PUBLIC_API_BASE`): projects, matches (pitched, assigned, owner/user decision), threads, messages, users, analytics, ratings, WebSocket at `/ws/{user_id}`.

### 4.3 Hardware Requirements

- **Server:** Typical development or production host (e.g. 8 GB RAM, multi-core CPU).
- **Client:** Laptop or desktop with a modern browser (Chrome, Firefox, Edge) and stable internet.
- **Database:** PostgreSQL 10+ (or compatible) with sufficient disk for application data.

---

## 5. Design and Implementation

### 5.1 Methodology

**Authentication and session**

- User signs in with email and password. NextAuth credentials provider queries `users` by email and verifies password with bcrypt; the returned user (including `user_id`) is stored in the JWT and session.
- Frontend stores the user in Zustand (`useAuthStore`) with persistence so the client can pass `user_id` to APIs and the WebSocket.

```typescript
// store/auth-store.ts (simplified)
export const useAuthStore = create<AuthState>()(
  persist(
    (set) => ({
      user: null,
      isAuthenticated: false,
      setUser: (user) => set({ user, isAuthenticated: Boolean(user) }),
      logout: () => set({ user: null, isAuthenticated: false }),
    }),
    { name: 'auth-storage' }
  )
);
```

**Project creation and recommendation trigger**

- When a project is created (e.g. POST to FastAPI `/api/projects` or Next.js API), the backend inserts into `projects`, adds engagement points for pitching, and calls `generate_recommendations_for_project(project_id)`.

**Candidate filtering**

- Candidates are fetched with a single SQL query: exclude owner, require `account_status = 'active'`, and require (active collaborations + open pitched projects) < 2.

```python
# backend/main.py (concept)
WHERE u.user_id <> %s
  AND u.account_status = 'active'
  AND (COALESCE(pc.active_count, 0) + COALESCE(pp.open_projects, 0)) < 2
```

**Skill match score**

- Required and user skills are normalized (lowercase, stripped). The score is overlap over required set size, scaled to 0–100.

```python
# backend/main.py
def calculate_skill_match_score(required_skills: List[str], candidate_skills: List[str]) -> float:
    if not required_skills or not candidate_skills:
        return 0.0
    required_set = set(_normalize_skills(required_skills))
    candidate_set = set(_normalize_skills(candidate_skills))
    if not required_set or not candidate_set:
        return 0.0
    overlap = len(required_set & candidate_set)
    return round((overlap / len(required_set)) * 100, 2)
```

**Composite score and weights**

- For each candidate and each required skill, the engine loads engagement, rating, and feedback accept rate (from `user_feedback_stats`), clamps them to [0,1] or equivalent, and computes:

```python
# backend/main.py
RECOMMENDATION_WEIGHTS = {
    "skill": 0.5,
    "engagement": 0.15,
    "rating": 0.15,
    "feedback": 0.2,
}

skill_component = skill_match_score * RECOMMENDATION_WEIGHTS["skill"]
engagement_component = clamp(engagement / 100.0, 0.0, 1.0) * 100.0 * RECOMMENDATION_WEIGHTS["engagement"]
rating_component = clamp(rating / 5.0, 0.0, 1.0) * 100.0 * RECOMMENDATION_WEIGHTS["rating"]
feedback_component = clamp(feedback_score, 0.0, 1.0) * 100.0 * RECOMMENDATION_WEIGHTS["feedback"]
composite_score = skill_component + engagement_component + rating_component + feedback_component
```

- Candidates are sorted by composite score; up to three per required skill are kept (per user, best composite retained), then all recommendations are written to `project_matches` with `owner_decision` and `user_decision` set to `'pending'`.

**Owner and user decisions**

- Owner and recommended user submit decisions via PATCH to `/api/matches/{match_id}/owner` and `/api/matches/{match_id}/user`. The backend updates `project_matches` and inserts into `match_feedback`; for automated matches it updates `user_feedback_stats`. When both decisions are `'accepted'`, `sync_collaboration_if_ready` inserts into `project_collaborators`, awards engagement points, and creates rating prompts.

**Real-time chat**

- Backend holds a `ConnectionManager`: map of `user_id` → WebSocket. Client connects to `ws://localhost:8000/ws/{user_id}`. Messages: `join_thread`, `leave_thread`, `send_message` (persist in `messages`, broadcast to thread), `typing`, `mark_read`. Thread list and message history are served by GET `/api/threads/{user_id}` and GET `/api/messages/{thread_id}`.

```python
# backend/main.py (WebSocket message handling)
elif message_type == "send_message":
    thread_id = data.get("thread_id")
    content = data.get("content")
    # INSERT into messages, then broadcast to thread participants
    await manager.send_personal_message(broadcast_message, user_id)
    await manager.broadcast_to_thread(thread_id, broadcast_message, exclude_user=user_id)
```

**Collaboration limit and finish**

- Schema trigger `check_collaboration_limit` prevents inserting into `project_collaborators` when the user already has two active commitments (active collaborations + open projects as owner). Users see active collaborations on the profile (CollaborationManager) and can call “Finish collaboration”; the API invokes `finish_collaboration(user_id, project_id)`, which sets that row’s status to `'completed'`.

```sql
-- schema_updates.sql
CREATE OR REPLACE FUNCTION finish_collaboration(p_user_id INT, p_project_id INT)
RETURNS BOOLEAN AS $$
BEGIN
    UPDATE project_collaborators
    SET status = 'completed', updated_at = CURRENT_TIMESTAMP
    WHERE user_id = p_user_id AND project_id = p_project_id AND status = 'active';
    RETURN FOUND;
END;
$$ LANGUAGE plpgsql;
```

**Frontend API usage**

- The frontend uses a single API base URL (e.g. `http://localhost:8000/api`) for FastAPI. Matches are fetched and updated via this base.

```typescript
// lib/api/base.ts
export const API_BASE = process.env.NEXT_PUBLIC_API_BASE || "http://localhost:8000/api";

// lib/api/matches.ts
export async function getPitchedMatches(ownerId: number | string): Promise<PitchedProjectMatches[]> {
  const res = await fetch(`${API_BASE}/matches/pitched?owner_id=${ownerId}`);
  const data = await handleResponse<{ projects: { project: any; matches: any[] }[] }>(res);
  // ...
}
```

### 5.2 Import Required Libraries and Modules

**Backend (Python) – `backend/main.py`**

| Import | Purpose |
|--------|--------|
| `fastapi` | FastAPI, WebSocket, HTTPException, Depends |
| `fastapi.middleware.cors` | CORSMiddleware |
| `fastapi.security` | HTTPBearer, HTTPAuthorizationCredentials |
| `typing` | Dict, Set, List, Optional, Tuple |
| `json` | JSON serialization |
| `datetime` | datetime, timedelta |
| `collections` | defaultdict |
| `psycopg2` | PostgreSQL connection |
| `psycopg2.extras` | RealDictCursor |
| `contextlib` | asynccontextmanager |
| `pydantic` | BaseModel, validator |
| `time` | Cache timestamps |
| `os` | getenv (e.g. DATABASE_URL) |

Example from the top of `main.py`:

```python
from fastapi import FastAPI, WebSocket, WebSocketDisconnect, HTTPException, Depends
from fastapi.middleware.cors import CORSMiddleware
from fastapi.security import HTTPBearer, HTTPAuthorizationCredentials
from typing import Dict, Set, List, Optional, Tuple
import json
from datetime import datetime, timedelta
from collections import defaultdict
import psycopg2
from psycopg2.extras import RealDictCursor
from contextlib import asynccontextmanager
from pydantic import BaseModel, validator
import time
import os
```

**Frontend (TypeScript/React) – representative modules**

| Module | Purpose |
|--------|--------|
| `next` | App Router, routing, API routes |
| `react`, `react-dom` | UI components |
| `@tanstack/react-query` | useQuery, useMutation, useQueryClient |
| `zustand` | useAuthStore, useUIStore |
| `next-auth` | Auth (used via API route; session not always used in every page) |
| `@/lib/api/base` | API_BASE, handleResponse |
| `@/lib/api/matches` | getPitchedMatches, getAssignedMatches, updateMatchDecision |
| `@/store/auth-store` | useAuthStore (user, logout, isAuthenticated) |
| `recharts` | LineChart, AreaChart, BarChart, PieChart, etc. |
| `lucide-react` | Icons (Users, Briefcase, Star, etc.) |
| `sonner` | toast |
| `@/hooks/useWebSocket` | useWebSocket (url, userId, onMessage, onConnect) |

Example (dashboard page):

```typescript
import { useQuery } from "@tanstack/react-query";
import { useAuthStore } from "@/store/auth-store";
import { API_BASE, handleResponse } from "@/lib/api/base";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { LineChart, AreaChart, BarChart, PieChart, ... } from "recharts";
import { Users, Briefcase, Star, TrendingUp, ... } from "lucide-react";
```

**Next.js API routes and auth**

- `lib/auth.ts`: NextAuth options, CredentialsProvider, bcrypt, pool from `lib/db`.
- `lib/db.ts`: `pg` Pool with `DATABASE_URL` or default.
- `pages/api/*.ts`: `Pool` from `pg` or `lib/db`, `NextApiRequest`, `NextApiResponse`.

### 5.3 Admin dashboard

The admin dashboard provides platform-wide statistics for operators. Access is restricted to users whose email is listed in the `ADMIN_EMAILS` environment variable (comma-separated, case-insensitive; e.g. `ADMIN_EMAILS=admin@konverge.com,super@konverge.com`). No trailing spaces; only these emails can open the admin dashboard or call the admin stats API.

- **Purpose:** View aggregate metrics: open/total projects, active/completed collaborations, frozen/active/total users, new users in the past 30 days, and owner/user acceptance and rejection rates from `project_matches`.
- **How to enable:** Set `ADMIN_EMAILS` in your environment (e.g. in `.env.local` or server env) with the allowed admin emails.
- **Where to find it:** Route `/admin/dashboard`; the sidebar shows an “Admin” link (with a shield icon) only when the logged-in user is an admin (`user.isAdmin` from session).
- **Access control:** The session callback in `lib/auth.ts` sets `session.user.isAdmin` by checking the user’s email against `ADMIN_EMAILS`. The API `GET /api/admin/stats` uses `getServerSession` and returns `403 Forbidden` if the user is not in `ADMIN_EMAILS`; the dashboard page shows “Access denied” when it receives 403.

---

## 6. Partial or Tentative Results

The following reflects the current implementation and behaviour.

- **Authentication** – Users can register and log in; session and auth store persist the user; protected routes and sidebar use `isAuthenticated` and `user`.
- **Projects** – Projects can be created with required skills; they appear under “My pitched projects” and in the discover list; the backend generates recommendations and stores them in `project_matches`.
- **Matching** – Owners see recommended collaborators per project with skill match score, engagement, and rating; they can accept or reject. Recommended users see matches under “Assigned to me” and can accept or reject; the “Accept” button is disabled when the user has reached the collaboration limit (two commitments), with a tooltip and optional toast explaining the limit.
- **Collaboration formation** – When both parties accept, a row is created in `project_collaborators`, engagement points are awarded, and rating prompts are created. The collaboration limit (e.g. trigger and candidate filter) prevents users from exceeding two active commitments.
- **Collaboration completion** – Users can mark a collaboration as completed from the profile (CollaborationManager) via “Finish collaboration,” which calls the finish-collaboration API and updates `project_collaborators.status` to `'completed'`, freeing a slot.
- **Chat** – Users can open the Messages page, see thread list (GET `/api/threads/{user_id}`), select a thread, and send messages over WebSocket; messages are persisted and broadcast to thread participants; typing and read indicators are supported.
- **Analytics dashboard** – The dashboard fetches `/api/analytics/user/{id}` and displays overview metrics (total collaborations, active projects, rating, engagement score, response rate), engagement trend, rating progress, collaboration frequency, skills distribution, project types, and application stats (accepted/rejected/pending). Data may be cached for a short period on the backend.
- **Leaderboard** – Implemented to show users ranked by engagement or similar metrics (implementation detail in the leaderboard page and API).
- **Peer ratings** – Pending ratings are shown (e.g. on profile); users can submit a score and optional feedback; the backend updates `user_ratings` and recalculates the user’s average rating.
- **Inactive users** – The `freeze_inactive_users()` function and related API (e.g. POST `/api/user-status`) can set `account_status` to `'frozen'` for users with long-pending decisions; frozen users are excluded from the candidate set. Unfreeze is supported via a PATCH endpoint.
- **Admin dashboard** – Users whose email is in `ADMIN_EMAILS` see an “Admin” link in the sidebar and can open `/admin/dashboard` to view platform-wide stats (projects, collaborations, users, new users in 30 days, acceptance/rejection rates). The API `GET /api/admin/stats` returns 403 for non-admin users.

The system runs end-to-end with a single PostgreSQL database (shared by Next.js API routes and FastAPI when `DATABASE_URL` is set consistently), a Next.js frontend, and a FastAPI backend with WebSocket support. Synthetic data from `init_db.sql` (and optionally `populate_demo_data.py`) is used for development and testing.
