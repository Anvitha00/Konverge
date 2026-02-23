# Konverge — Project Documentation

## Abstract

Konverge is a collaboration platform that connects project owners with potential collaborators using skill-based matching and decision feedback. Users can pitch projects, receive recommendations, accept/reject matches, form collaborations, communicate in real time, and view analytics. The implemented system uses a **Next.js (App Router)** frontend with **NextAuth (Credentials)** for authentication, a **FastAPI** backend for matching/chat/analytics APIs, and a shared **PostgreSQL** database.

---

## 1. Introduction

Konverge targets a common problem: strong project ideas often stall because it’s hard to find reliable collaborators with the right skills, and there’s no unified workflow for pitching, matching, communicating, and tracking progress.

### 1.1 Problem Statement

- Collaborator discovery is manual and noisy (skills/availability are hard to verify).
- Teams form without clear signals (engagement, ratings, decision history).
- Communication happens on scattered tools; project state is hard to track.
- Platforms rarely learn from accept/reject decisions to improve recommendations.

### 1.2 Objectives

- **Project pitching:** allow users to publish projects with required skills.
- **Automated matching:** recommend users based on skill overlap and signals.
- **Dual-decision workflow:** both owner and recommended user accept/reject.
- **Collaboration management:** enforce commitment limits and allow finishing a collaboration.
- **Communication:** provide chat and messaging via REST + WebSockets.
- **Analytics:** provide user-level analytics and admin-level platform stats.

### 1.3 Existing models

Relevant approaches that informed the implementation:

- **Content-based matching:** overlap between required skills and user skills.
- **Hybrid scoring:** combine skill match with engagement, ratings, and feedback signals.
- **Feedback learning:** accept/reject behavior can be aggregated per user/skill to improve future ranking.

### 1.4 Dataset

The system uses a PostgreSQL schema and synthetic seed data:

Key tables (high level):

- `users` — profile, skills, rating, engagement score, account status, password hash
- `projects` — pitched projects with `required_skills`, owner, status
- `project_matches` — recommendations + decisions (`owner_decision`, `user_decision`)
- `project_collaborators` — active/completed collaborations
- `engagement` — engagement events/points
- `user_ratings` — peer ratings
- `user_feedback_stats` — learning stats per user/skill bucket
- Chat tables created at runtime if missing: `chat_threads`, `thread_participants`, `messages`, `message_reads`

### 1.5 Proposed Model (Brief)

Konverge implements a closed loop:

1. **Pitch:** Owner creates a project with required skills.
2. **Recommend:** Backend generates `project_matches` rows (recommended users).
3. **Decide:** Owner and recommended user accept/reject.
4. **Collaborate:** When both accept, a collaboration is created (`project_collaborators`).
5. **Learn:** Decision outcomes update `user_feedback_stats` and improve future scoring.
6. **Finish:** A collaboration can be marked completed, freeing a slot for new recommendations.

---

## 2. Literature Survey

Konverge is inspired by:

- **Recommender systems:** content-based and hybrid recommenders
- **Reinforcement-style feedback loops:** learning from user actions (accept/reject)
- **Trust/reputation systems:** ratings and engagement signals as proxies for reliability
- **Collaboration platforms:** integrating discovery + messaging + progress tracking

---

## 3. Theoretical Background

### Skill matching

Each project lists required skills; each user lists their skills. A basic content score can be derived from normalized overlaps.

### Hybrid scoring

Hybrid recommenders combine multiple signals (e.g. skills + engagement + ratings + feedback acceptance rate) into a composite score, often by weighted sum:

\[
\text{score} = w_s \cdot \text{skill} + w_e \cdot \text{engagement} + w_r \cdot \text{rating} + w_f \cdot \text{feedback}
\]

### Commitment limits

To reduce over-commitment, the system enforces a maximum number of concurrent commitments. In Konverge, the limit is **2 total**:

- Open pitched projects (owner)
- + active collaborations (collaborator)

---

## 4. Requirement Specifications

### 4.1 User Requirements

- Register and log in with email/password
- Pitch projects with required skills
- View recommendations and decide (accept/reject)
- See pending matches requiring action
- View collaborations, finish a collaboration when done
- Chat with other users
- View analytics and engagement/rating information

### 4.2 Software Requirements

- Node.js 18+ (Next.js)
- Python 3.10+ (FastAPI)
- PostgreSQL 13+
- Package managers: npm, pip

### 4.3 Hardware Requirements

- Development machine capable of running Node + Python + Postgres (8GB RAM recommended)
- Network access for API calls and WebSockets

---

## 5. Design and Implementation

### 5.1 Methodology

#### 5.1.1 Environment and configuration

Local configuration is stored in `.env.local` (ignored by git). Key variables:

- `DATABASE_URL` — shared by Next.js API routes and FastAPI (must match)
- `NEXTAUTH_SECRET` — NextAuth secret
- `NEXTAUTH_URL` — site URL (`http://localhost:3000` locally)
- `NEXT_PUBLIC_API_BASE` — FastAPI base URL (defaults to `http://localhost:8000/api`)
- `ADMIN_EMAILS` — comma-separated emails allowed to access admin dashboard

FastAPI loads `.env.local` automatically on startup (project root), ensuring it uses the same `DATABASE_URL`.

#### 5.1.2 Authentication (NextAuth Credentials)

- Login UI uses `signIn("credentials")` (`app/auth/page.tsx`).
- NextAuth verifies credentials by loading the user from Postgres and comparing bcrypt hash (`lib/auth.ts`).
- Admin status is derived from `ADMIN_EMAILS` and stored on the JWT/session as `isAdmin`.

Snippet (NextAuth route handler):

```ts
// app/api/auth/[...nextauth]/route.ts
import NextAuth from "next-auth";
import { authOptions } from "@/lib/auth";

const handler = NextAuth(authOptions);
export { handler as GET, handler as POST };
```

Snippet (admin flag in JWT callback):

```ts
// lib/auth.ts (excerpt)
const adminEmails = (process.env.ADMIN_EMAILS ?? "")
  .split(",")
  .map((e) => e.trim().toLowerCase())
  .filter(Boolean);

(token.user as AuthUser & { isAdmin?: boolean }).isAdmin =
  Boolean(email && adminEmails.includes(email));
```

#### 5.1.3 Frontend data fetching (FastAPI + Next.js API)

Frontend calls FastAPI through `API_BASE`:

```ts
// lib/api/base.ts
export const API_BASE =
  process.env.NEXT_PUBLIC_API_BASE || "http://localhost:8000/api";
```

Next.js API routes (under `pages/api/*`) are used for:

- collaboration status (`/api/user-collaboration-status`)
- active collaborations list (`/api/user-collaborations`)
- finish collaboration (`/api/finish-collaboration`)
- admin stats (`/api/admin/stats`)

#### 5.1.4 Matching workflow UI rules

To keep the UX clear:

- **Matched page → “Assigned to me”** shows only matches where a decision is still pending:
  - owner pending **or** user pending
- Once both accept and a collaboration is active, it appears in:
  - **Profile → Matched** (active collaborations only) with a Finish button

Snippet (pending-only filtering):

```ts
// app/matched/page.tsx (excerpt)
const matches = useMemo(
  () => allMatches.filter((m) => m.ownerDecision === "pending" || m.userDecision === "pending"),
  [allMatches]
);
```

#### 5.1.5 Collaborations and finishing

Active collaborations come from `project_collaborators.status = 'active'` via:

- `GET /api/user-collaborations?userId=...`

Finishing uses:

- `POST /api/finish-collaboration` → calls SQL function `finish_collaboration(user_id, project_id)` and marks row `completed`.

#### 5.1.6 Admin dashboard (platform-wide stats)

Admin access is environment-driven:

- `ADMIN_EMAILS` controls who can view admin pages and stats.

API:

- `GET /api/admin/stats` (admin-only)

Computes:

- project counts (open/total)
- collaboration counts (active/completed)
- user counts (active/frozen/total)
- new users (30 days, requires `users.created_at`)
- acceptance/rejection rates for owner/user decisions

Snippet (admin check):

```ts
// pages/api/admin/stats.ts (excerpt)
const session = await getServerSession(req, res, authOptions);
if (!session?.user?.email || !isAdminEmail(session.user.email)) {
  return res.status(403).json({ error: "Admin access required" });
}
```

Admin dashboard UI:

- Route: `app/admin/dashboard/page.tsx` (reads `/api/admin/stats`)
- Admin link in sidebar is shown only when `user.isAdmin` is true (derived from `ADMIN_EMAILS`)

#### 5.1.7 Recommendation algorithm and feedback learning

The backend (`backend/main.py`) implements the full recommendation and feedback loop.

**Weights:**

```python
# backend/main.py
RECOMMENDATION_WEIGHTS = {
    "skill": 0.5,
    "engagement": 0.15,
    "rating": 0.15,
    "feedback": 0.2,
}
```

**Skill match score** — overlap of required skills vs candidate skills (normalized 0–100):

```python
def calculate_skill_match_score(required_skills: List[str], candidate_skills: List[str]) -> float:
    if not required_skills or not candidate_skills:
        return 0.0
    required_set = set(_normalize_skills(required_skills))
    candidate_set = set(_normalize_skills(candidate_skills))
    overlap = len(required_set & candidate_set)
    return round((overlap / len(required_set)) * 100, 2)
```

**Candidate fetching** — active users under commitment limit (open pitched projects + active collaborations &lt; 2):

```python
def fetch_candidate_users(cursor, owner_id: int):
    cursor.execute("""
        SELECT u.user_id, u.name, u.email, u.skills, u.rating, u.engagement_score,
               COALESCE(pc.active_count, 0) AS active_collaborations,
               COALESCE(pp.open_projects, 0) AS pitched_projects
        FROM users u
        LEFT JOIN (...) pc ON u.user_id = pc.user_id
        LEFT JOIN (...) pp ON u.user_id = pp.owner_id
        WHERE u.user_id <> %s AND u.account_status = 'active'
          AND (COALESCE(pc.active_count, 0) + COALESCE(pp.open_projects, 0)) < 2
    """, (owner_id,))
    return cursor.fetchall()
```

**Composite score** — weighted sum used to rank recommendations:

```python
# For each candidate and each required skill:
skill_component = skill_match_score * RECOMMENDATION_WEIGHTS["skill"]
engagement_component = clamp(engagement / 100.0, 0.0, 1.0) * 100.0 * RECOMMENDATION_WEIGHTS["engagement"]
rating_component = clamp(rating / 5.0, 0.0, 1.0) * 100.0 * RECOMMENDATION_WEIGHTS["rating"]
feedback_component = clamp(feedback_score, 0.0, 1.0) * 100.0 * RECOMMENDATION_WEIGHTS["feedback"]
composite_score = skill_component + engagement_component + rating_component + feedback_component
```

`feedback_score` comes from `user_feedback_stats.accept_rate` for that user and skill bucket.

**Feedback learning** — when owner or user accepts/rejects an automated recommendation:

```python
def record_feedback_signal(cursor, user_id, required_skill, accepted: bool):
    skill_bucket = get_feedback_skill_bucket(required_skill)  # e.g. "python" or "general"
    upsert_feedback_stat(cursor, user_id, skill_bucket, accepted)

def upsert_feedback_stat(cursor, user_id, skill_bucket, accepted):
    # Upserts user_feedback_stats: increments total_recommendations,
    # accepted_count or rejected_count, and recomputes accept_rate
    # ON CONFLICT (user_id, skill) DO UPDATE SET ...
```

`record_feedback_signal` is called from both owner-decision and user-decision endpoints when `source_type == 'automated'`. This updates `user_feedback_stats`, which is then loaded by `load_feedback_stats` for future recommendation runs.

**Collaboration sync** — when both owner and user accept, create/activate collaboration:

```python
def sync_collaboration_if_ready(cursor, match_row):
    if match_row["owner_decision"] == "accepted" and match_row["user_decision"] == "accepted":
        # If collaboration exists and completed → reactivate
        # Else if no row → INSERT new project_collaborators row with status='active'
        # Award engagement points, ensure_rating_prompt for both parties
```

Called after both `PATCH /api/matches/{match_id}/owner` and `PATCH /api/matches/{match_id}/user`.

**Recommendation generation** (`generate_recommendations_for_project`):

1. Fetch project and required skills.
2. Delete existing `project_matches` for that project.
3. Fetch candidates via `fetch_candidate_users`.
4. Load feedback stats via `load_feedback_stats`.
5. For each required skill (or `["general"]` if none), filter candidates, compute composite score, keep top 3 per skill, and merge into `user_best_recommendations` (best score per user).
6. Sort by composite score, insert rows into `project_matches` with `source_type='automated'`.

### 5.2 Import Required Libraries and Modules

#### Frontend (Node/TypeScript)

Common libraries:

- `next`, `react`, `typescript`
- `next-auth` for authentication
- `pg` for Next.js API routes talking to Postgres
- `@tanstack/react-query` for client data fetching/caching
- `zustand` for client-side auth/user state
- `tailwindcss` and shadcn/Radix UI components

#### Backend (Python)

FastAPI backend (`backend/main.py`) imports:

- `fastapi`, `uvicorn`
- `psycopg2` + `RealDictCursor`
- `websockets` (WebSocket usage via FastAPI)
- `python-dotenv` to load `.env.local`
- `pydantic` for request/response models

---

## 6. Partial or Tentative Results

The current implementation supports:

- **Auth:** NextAuth credentials login against Postgres `users.password_hash`
- **Project pitching & discovery:** projects stored in `projects` with required skills
- **Matching decisions:** dual decisions stored in `project_matches`
- **Pending match UX:** Matched page shows only items still requiring action
- **Collaboration lifecycle:** active collaborations in `project_collaborators`; finish collaboration marks completed and frees capacity
- **Collaboration limits:** enforced with SQL view/trigger logic in `schema_updates.sql`
- **Analytics:** user analytics endpoint in FastAPI and UI dashboard (data availability depends on DB contents)
- **Admin dashboard:** platform-wide stats gated by `ADMIN_EMAILS`

### Operational notes

- If login redirects to `/api/auth/error` with a 404, the NextAuth route handler file is missing:
  - `app/api/auth/[...nextauth]/route.ts`
- Admin dashboard lives at `/admin/dashboard` (`app/admin/dashboard/page.tsx`). Ensure `ADMIN_EMAILS` includes your email in `.env.local` to see the Admin link.
- If FastAPI data appears empty while Next.js APIs show data, ensure both use the same `DATABASE_URL`. FastAPI loads `.env.local` from the project root at startup.

