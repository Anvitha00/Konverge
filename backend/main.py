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
from pathlib import Path

# Load .env from project root so DATABASE_URL matches Next.js (e.g. .env.local)
_env_path = Path(__file__).resolve().parent.parent / ".env.local"
if _env_path.exists():
    try:
        from dotenv import load_dotenv
        load_dotenv(_env_path)
    except ImportError:
        pass
else:
    _env_path = Path(__file__).resolve().parent.parent / ".env"
    if _env_path.exists():
        try:
            from dotenv import load_dotenv
            load_dotenv(_env_path)
        except ImportError:
            pass


def get_db_connection():
    """
    Centralized database connection helper.

    Prefer DATABASE_URL so the FastAPI backend shares the same database
    configuration as the Next.js app. Falls back to local defaults if the
    environment variable is not set.
    """
    database_url = os.getenv("DATABASE_URL")
    if database_url:
        return psycopg2.connect(database_url)

    return psycopg2.connect(
        host="localhost",
        port=5432,
        database="konverge",
        user="postgres",
        password="postgres123",
    )


# Simple in-memory cache for analytics
analytics_cache = {}
CACHE_DURATION = 300  # 5 minutes

def get_cached_analytics(user_id: int):
    """Get cached analytics if available and not expired"""
    cache_key = f"analytics_{user_id}"
    if cache_key in analytics_cache:
        cached_data, timestamp = analytics_cache[cache_key]
        if time.time() - timestamp < CACHE_DURATION:
            return cached_data
    return None

def cache_analytics(user_id: int, data):
    """Cache analytics data"""
    cache_key = f"analytics_{user_id}"
    analytics_cache[cache_key] = (data, time.time())


# Simple authentication for development
security = HTTPBearer()

def get_current_user(credentials: HTTPAuthorizationCredentials = Depends(security)):
    """Simple mock authentication for development"""
    # For now, return a mock user. In production, validate the token
    return {"user_id": 1, "email": "test@example.com", "name": "Test User"}


def init_chat_tables():
    conn = get_db_connection()
    cursor = conn.cursor()

    cursor.execute(
        """
        CREATE TABLE IF NOT EXISTS chat_threads (
            thread_id SERIAL PRIMARY KEY,
            title VARCHAR(255),
            created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
            updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
        )
    """
    )

    cursor.execute(
        """
        CREATE TABLE IF NOT EXISTS thread_participants (
            thread_id INTEGER REFERENCES chat_threads(thread_id),
            user_id INTEGER REFERENCES users(user_id),
            joined_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
            PRIMARY KEY (thread_id, user_id)
        )
    """
    )

    cursor.execute(
        """
        CREATE TABLE IF NOT EXISTS messages (
            message_id SERIAL PRIMARY KEY,
            thread_id INTEGER REFERENCES chat_threads(thread_id),
            sender_id INTEGER REFERENCES users(user_id),
            content TEXT NOT NULL,
            message_type VARCHAR(50) DEFAULT 'text',
            created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
            is_read BOOLEAN DEFAULT FALSE
        )
    """
    )

    cursor.execute(
        """
        CREATE TABLE IF NOT EXISTS message_reads (
            message_id INTEGER REFERENCES messages(message_id),
            user_id INTEGER REFERENCES users(user_id),
            read_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
            PRIMARY KEY (message_id, user_id)
        )
    """
    )

    conn.commit()
    cursor.close()
    conn.close()
    print("Chat tables initialized")


def init_rating_tables():
    conn = get_db_connection()
    cursor = conn.cursor()

    cursor.execute(
        """
        CREATE TABLE IF NOT EXISTS user_ratings (
            rating_id SERIAL PRIMARY KEY,
            project_id INT REFERENCES projects(project_id) ON DELETE CASCADE,
            rater_id INT REFERENCES users(user_id) ON DELETE CASCADE,
            ratee_id INT REFERENCES users(user_id) ON DELETE CASCADE,
            score NUMERIC(2,1),
            feedback TEXT,
            status VARCHAR(10) DEFAULT 'pending' CHECK (status IN ('pending','completed')),
            created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
            completed_at TIMESTAMP,
            UNIQUE (project_id, rater_id, ratee_id)
        )
    """
    )

    conn.commit()
    cursor.close()
    conn.close()
    print("Rating tables initialized")


def init_feedback_learning_tables():
    conn = get_db_connection()
    cursor = conn.cursor()

    cursor.execute(
        """
        CREATE TABLE IF NOT EXISTS user_feedback_stats (
            user_id INT REFERENCES users(user_id) ON DELETE CASCADE,
            skill VARCHAR(255) NOT NULL,
            total_recommendations INT NOT NULL DEFAULT 0,
            accepted_count INT NOT NULL DEFAULT 0,
            rejected_count INT NOT NULL DEFAULT 0,
            accept_rate NUMERIC(5,4) NOT NULL DEFAULT 0,
            last_feedback_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
            PRIMARY KEY (user_id, skill)
        )
    """
    )
    cursor.execute(
        """
        CREATE INDEX IF NOT EXISTS idx_user_feedback_stats_user
        ON user_feedback_stats (user_id)
    """
    )

    # Add source_type column to project_matches if it doesn't exist
    cursor.execute(
        """
        ALTER TABLE project_matches 
        ADD COLUMN IF NOT EXISTS source_type VARCHAR(10) DEFAULT 'automated' 
        CHECK (source_type IN ('automated','manual'))
        """
    )

    conn.commit()
    cursor.close()
    conn.close()
    print("Feedback learning tables initialized")


ENGAGEMENT_POINTS = {
    "pitch_project": 10,
    "apply_collaboration": 5,
    "owner_acceptance": 2,
}

DEFAULT_SKILL_BUCKET = "general"
RECOMMENDATION_WEIGHTS = {
    "skill": 0.5,
    "engagement": 0.15,
    "rating": 0.15,
    "feedback": 0.2,
}


def clamp(value: float, min_value: float, max_value: float) -> float:
    return max(min_value, min(max_value, value))


def get_feedback_skill_bucket(required_skill: Optional[str]) -> str:
    if required_skill and required_skill.strip():
        return required_skill.strip().lower()
    return DEFAULT_SKILL_BUCKET


def upsert_feedback_stat(cursor, user_id: int, skill_bucket: str, accepted: bool):
    if not user_id:
        return
    accepted_increment = 1 if accepted else 0
    rejected_increment = 0 if accepted else 1
    cursor.execute(
        """
        INSERT INTO user_feedback_stats (
            user_id,
            skill,
            total_recommendations,
            accepted_count,
            rejected_count,
            accept_rate,
            last_feedback_at
        )
        VALUES (%s, %s, 1, %s, %s, %s, CURRENT_TIMESTAMP)
        ON CONFLICT (user_id, skill) DO UPDATE SET
            total_recommendations = user_feedback_stats.total_recommendations + 1,
            accepted_count = user_feedback_stats.accepted_count + EXCLUDED.accepted_count,
            rejected_count = user_feedback_stats.rejected_count + EXCLUDED.rejected_count,
            accept_rate = (
                user_feedback_stats.accepted_count + EXCLUDED.accepted_count
            )::numeric(5,4) / (user_feedback_stats.total_recommendations + 1),
            last_feedback_at = CURRENT_TIMESTAMP
    """,
        (
            user_id,
            skill_bucket,
            accepted_increment,
            rejected_increment,
            accepted_increment,
        ),
    )


def record_feedback_signal(cursor, user_id: Optional[int], required_skill: Optional[str], accepted: bool):
    if not user_id:
        return
    skill_bucket = get_feedback_skill_bucket(required_skill)
    upsert_feedback_stat(cursor, user_id, skill_bucket, accepted)


def load_feedback_stats(cursor, user_ids: List[int]) -> Dict[Tuple[int, str], float]:
    if not user_ids:
        return {}
    unique_ids = list({uid for uid in user_ids if uid})
    if not unique_ids:
        return {}
    cursor.execute(
        """
        SELECT user_id, skill, accept_rate
        FROM user_feedback_stats
        WHERE user_id = ANY(%s)
    """,
        (unique_ids,),
    )
    stats_map: Dict[Tuple[int, str], float] = {}
    for row in cursor.fetchall():
        key = (row["user_id"], row["skill"])
        stats_map[key] = float(row["accept_rate"] or 0.0)
    return stats_map


def resolve_feedback_score(stats_map: Dict[Tuple[int, str], float], user_id: int, skill_bucket: str) -> float:
    if not stats_map or not user_id:
        return 0.0
    key_specific = (user_id, skill_bucket)
    if key_specific in stats_map:
        return stats_map[key_specific]
    key_general = (user_id, DEFAULT_SKILL_BUCKET)
    return stats_map.get(key_general, 0.0)


def add_engagement_points(cursor, user_id: Optional[int], points: int, reason: str):
    if not user_id or not points:
        return
    cursor.execute(
        """
        INSERT INTO engagement (user_id, points, reason)
        VALUES (%s, %s, %s)
    """,
        (user_id, points, reason),
    )
    cursor.execute(
        """
        UPDATE users
        SET engagement_score = COALESCE(engagement_score, 0) + %s
        WHERE user_id = %s
    """,
        (points, user_id),
    )


def ensure_rating_prompt(cursor, project_id: int, rater_id: int, ratee_id: int):
    if not project_id or not rater_id or not ratee_id or rater_id == ratee_id:
        return
    cursor.execute(
        """
        INSERT INTO user_ratings (project_id, rater_id, ratee_id, status)
        VALUES (%s, %s, %s, 'pending')
        ON CONFLICT (project_id, rater_id, ratee_id) DO NOTHING
    """,
        (project_id, rater_id, ratee_id),
    )


def recalculate_user_rating(cursor, user_id: int):
    cursor.execute(
        """
        SELECT AVG(score)::numeric(3,2)
        FROM user_ratings
        WHERE ratee_id = %s AND status = 'completed' AND score IS NOT NULL
    """,
        (user_id,),
    )
    avg_row = cursor.fetchone()
    avg_score = avg_row[0] if avg_row else None
    cursor.execute(
        """
        UPDATE users
        SET rating = COALESCE(%s, 0)
        WHERE user_id = %s
    """,
        (avg_score, user_id),
    )


def _normalize_skills(skills: Optional[List[str]]) -> List[str]:
    if not skills:
        return []
    return [skill.strip().lower() for skill in skills if isinstance(skill, str) and skill.strip()]


def calculate_skill_match_score(required_skills: List[str], candidate_skills: List[str]) -> float:
    if not required_skills or not candidate_skills:
        return 0.0
    required_set = set(_normalize_skills(required_skills))
    candidate_set = set(_normalize_skills(candidate_skills))
    if not required_set or not candidate_set:
        return 0.0
    overlap = len(required_set & candidate_set)
    return round((overlap / len(required_set)) * 100, 2)


def fetch_candidate_users(cursor, owner_id: int):
    cursor.execute(
        """
        SELECT 
            u.user_id,
            u.name,
            u.email,
            u.skills,
            u.rating,
            u.engagement_score,
            COALESCE(pc.active_count, 0) AS active_collaborations,
            COALESCE(pp.open_projects, 0) AS pitched_projects
        FROM users u
        LEFT JOIN (
            SELECT user_id, COUNT(*) AS active_count
            FROM project_collaborators
            WHERE status = 'active'
            GROUP BY user_id
        ) pc ON u.user_id = pc.user_id
        LEFT JOIN (
            SELECT owner_id, COUNT(*) AS open_projects
            FROM projects
            WHERE status = 'Open'
            GROUP BY owner_id
        ) pp ON u.user_id = pp.owner_id
        WHERE u.user_id <> %s
          AND u.account_status = 'active'
          AND (COALESCE(pc.active_count, 0) + COALESCE(pp.open_projects, 0)) < 2
        """,
        (owner_id,),
    )
    return cursor.fetchall()


def sync_collaboration_if_ready(cursor, match_row):
    if (
        match_row.get("owner_decision") == "accepted"
        and match_row.get("user_decision") == "accepted"
    ):
        # Check if collaboration already exists
        cursor.execute(
            """
            SELECT collaboration_id, status FROM project_collaborators
            WHERE project_id = %s AND user_id = %s
        """,
            (
                match_row["project_id"],
                match_row["recommended_user_id"],
            ),
        )
        existing = cursor.fetchone()
        
        if existing:
            # If exists but is completed, reactivate it; if already active, skip
            if existing.get("status") == "completed":
                cursor.execute(
                    """
                    UPDATE project_collaborators
                    SET status = 'active', joined_at = CURRENT_TIMESTAMP
                    WHERE collaboration_id = %s
                    RETURNING collaboration_id
                """,
                    (existing["collaboration_id"],),
                )
                updated = cursor.fetchone()
                if not updated:
                    return
                # Award engagement points and create rating prompts for reactivated collaboration
                cursor.execute(
                    "SELECT owner_id FROM projects WHERE project_id = %s",
                    (match_row["project_id"],),
                )
                owner_row = cursor.fetchone()
                owner_id = owner_row[0] if owner_row else None
                collaborator_id = match_row["recommended_user_id"]
                if owner_id:
                    add_engagement_points(cursor, owner_id, 8, "collaboration_started_owner")
                add_engagement_points(cursor, collaborator_id, 8, "collaboration_started_collaborator")
                if owner_id:
                    ensure_rating_prompt(cursor, match_row["project_id"], owner_id, collaborator_id)
                    ensure_rating_prompt(cursor, match_row["project_id"], collaborator_id, owner_id)
                return
            else:
                # Already active, skip
                return
        else:
            # Create new collaboration
            cursor.execute(
                """
                INSERT INTO project_collaborators (project_id, user_id, required_skill, status)
                VALUES (%s, %s, %s, 'active')
                RETURNING collaboration_id
            """,
                (
                    match_row["project_id"],
                    match_row["recommended_user_id"],
                    match_row.get("required_skill"),
                ),
            )
            inserted = cursor.fetchone()
            if not inserted:
                return

        # Award engagement points and create rating prompts for new collaboration
        cursor.execute(
            "SELECT owner_id FROM projects WHERE project_id = %s",
            (match_row["project_id"],),
        )
        owner_row = cursor.fetchone()
        owner_id = owner_row[0] if owner_row else None
        collaborator_id = match_row["recommended_user_id"]
        if owner_id:
            add_engagement_points(cursor, owner_id, 8, "collaboration_started_owner")
        add_engagement_points(cursor, collaborator_id, 8, "collaboration_started_collaborator")
        if owner_id:
            ensure_rating_prompt(cursor, match_row["project_id"], owner_id, collaborator_id)
            ensure_rating_prompt(cursor, match_row["project_id"], collaborator_id, owner_id)


def fetch_match_with_relations(cursor, match_id: int):
    cursor.execute(
        """
        SELECT 
            pm.match_id,
            pm.project_id,
            pm.recommended_user_id,
            pm.required_skill,
            pm.skill_match_score,
            pm.engagement_score_snapshot,
            pm.rating_snapshot,
            pm.owner_decision,
            pm.owner_decided_at,
            pm.user_decision,
            pm.user_decided_at,
            pm.created_at,
            pm.updated_at,
            u.name AS recommended_user_name,
            u.email AS recommended_user_email,
            u.skills AS recommended_user_skills,
            p.title AS project_title,
            p.description AS project_description,
            p.owner_id
        FROM project_matches pm
        JOIN users u ON pm.recommended_user_id = u.user_id
        JOIN projects p ON pm.project_id = p.project_id
        WHERE pm.match_id = %s
    """,
        (match_id,),
    )
    row = cursor.fetchone()
    return dict(row) if row else None


def fetch_project_matches_with_users(project_id: int):
    conn = get_db_connection()
    cursor = conn.cursor(cursor_factory=RealDictCursor)
    cursor.execute(
        """
        SELECT 
            pm.match_id,
            pm.project_id,
            pm.recommended_user_id,
            pm.required_skill,
            pm.skill_match_score,
            pm.engagement_score_snapshot,
            pm.rating_snapshot,
            pm.owner_decision,
            pm.user_decision,
            pm.created_at,
            pm.updated_at,
            u.name AS recommended_user_name,
            u.email AS recommended_user_email,
            u.skills AS recommended_user_skills
        FROM project_matches pm
        JOIN users u ON pm.recommended_user_id = u.user_id
        WHERE pm.project_id = %s
        ORDER BY pm.required_skill NULLS LAST, pm.match_id
    """,
        (project_id,),
    )
    rows = [dict(row) for row in cursor.fetchall()]
    cursor.close()
    conn.close()
    return rows


def generate_recommendations_for_project(project_id: int):
    conn = get_db_connection()
    cursor = conn.cursor(cursor_factory=RealDictCursor)

    cursor.execute(
        """
        SELECT project_id, owner_id, required_skills
        FROM projects
        WHERE project_id = %s
    """,
        (project_id,),
    )
    project = cursor.fetchone()
    if not project:
        cursor.close()
        conn.close()
        raise HTTPException(status_code=404, detail="Project not found")

    required_skills = _normalize_skills(project["required_skills"])
    owner_id = project["owner_id"]

    cursor.execute("DELETE FROM project_matches WHERE project_id = %s", (project_id,))

    candidates = fetch_candidate_users(cursor, owner_id)
    feedback_stats = load_feedback_stats(cursor, [candidate["user_id"] for candidate in candidates])
    user_best_recommendations = {}
    normalized_required = required_skills if required_skills else ["general"]

    for skill in normalized_required:
        skill_candidates = []
        for candidate in candidates:
            candidate_skills = _normalize_skills(candidate.get("skills"))
            if skill != "general" and skill not in candidate_skills:
                continue
            skill_match_score = float(
                calculate_skill_match_score(required_skills or candidate_skills, candidate_skills)
            )
            engagement_raw = candidate.get("engagement_score") or 0
            rating_raw = candidate.get("rating") or 0
            try:
                engagement = float(engagement_raw)
            except (TypeError, ValueError):
                engagement = 0.0
            try:
                rating = float(rating_raw)
            except (TypeError, ValueError):
                rating = 0.0

            normalized_skill = skill
            skill_bucket = get_feedback_skill_bucket(
                None if normalized_skill == DEFAULT_SKILL_BUCKET else normalized_skill
            )
            feedback_score = resolve_feedback_score(feedback_stats, candidate["user_id"], skill_bucket)

            skill_component = skill_match_score * RECOMMENDATION_WEIGHTS["skill"]
            engagement_component = (
                clamp(engagement / 100.0, 0.0, 1.0) * 100.0 * RECOMMENDATION_WEIGHTS["engagement"]
            )
            rating_component = (
                clamp(rating / 5.0, 0.0, 1.0) * 100.0 * RECOMMENDATION_WEIGHTS["rating"]
            )
            feedback_component = (
                clamp(feedback_score, 0.0, 1.0) * 100.0 * RECOMMENDATION_WEIGHTS["feedback"]
            )
            composite_score = skill_component + engagement_component + rating_component + feedback_component
            skill_candidates.append(
                {
                    "candidate": candidate,
                    "skill_match_score": skill_match_score,
                    "composite_score": composite_score,
                    "engagement": engagement,
                    "rating": rating,
                }
            )

        skill_candidates.sort(key=lambda x: x["composite_score"], reverse=True)
        count = 0
        seen_users_for_skill = set()
        for entry in skill_candidates:
            candidate = entry["candidate"]
            user_id = candidate["user_id"]
            if (user_id, skill) in seen_users_for_skill:
                continue
            recommendation_payload = {
                "project_id": project_id,
                "recommended_user_id": user_id,
                "required_skill": None if skill == "general" else skill,
                "skill_match_score": entry["skill_match_score"],
                "engagement_score_snapshot": entry["engagement"],
                "rating_snapshot": entry["rating"],
                "composite_score": entry["composite_score"],
            }

            existing = user_best_recommendations.get(user_id)
            if not existing or recommendation_payload["composite_score"] > existing["composite_score"]:
                user_best_recommendations[user_id] = recommendation_payload

            seen_users_for_skill.add((user_id, skill))
            count += 1
            if count >= 3:
                break

    recommendations = sorted(
        user_best_recommendations.values(), key=lambda rec: rec["composite_score"], reverse=True
    )

    for rec in recommendations:
        rec_to_insert = rec.copy()
        rec_to_insert.pop("composite_score", None)
        cursor.execute(
            """
            INSERT INTO project_matches (
                project_id,
                recommended_user_id,
                required_skill,
                skill_match_score,
                engagement_score_snapshot,
                rating_snapshot,
                owner_decision,
                user_decision,
                owner_decided_at,
                user_decided_at,
                source_type
            ) VALUES (%s, %s, %s, %s, %s, %s, 'pending', 'pending', NULL, NULL, 'automated')
            ON CONFLICT (project_id, recommended_user_id, required_skill)
            DO UPDATE SET
                skill_match_score = EXCLUDED.skill_match_score,
                engagement_score_snapshot = EXCLUDED.engagement_score_snapshot,
                rating_snapshot = EXCLUDED.rating_snapshot,
                owner_decision = 'pending',
                user_decision = 'pending',
                owner_decided_at = NULL,
                user_decided_at = NULL,
                updated_at = CURRENT_TIMESTAMP
        """,
            (
                rec_to_insert["project_id"],
                rec_to_insert["recommended_user_id"],
                rec_to_insert["required_skill"],
                rec_to_insert["skill_match_score"],
                rec_to_insert["engagement_score_snapshot"],
                rec_to_insert["rating_snapshot"],
            ),
        )

    conn.commit()
    cursor.close()
    conn.close()
    return fetch_project_matches_with_users(project_id)


class ProjectCreateRequest(BaseModel):
    title: str
    description: Optional[str] = None
    required_skills: List[str]
    owner_id: int
    roles_available: int = 0
    status: Optional[str] = "Open"


class MatchDecisionRequest(BaseModel):
    decision: str
    reason: Optional[dict] = None


class SubmitRatingRequest(BaseModel):
    score: float
    feedback: Optional[str] = None
    rater_id: int

    @validator("score")
    def validate_score(cls, value):
        if value < 0 or value > 5:
            raise ValueError("Score must be between 0 and 5")
        return round(float(value), 1)

    @validator("rater_id")
    def validate_rater(cls, value):
        if value <= 0:
            raise ValueError("Invalid rater_id")
        return value


def _safe_init_db():
    """Initialize chat/rating/feedback tables. Skip if base schema (users) does not exist."""
    try:
        init_chat_tables()
        init_rating_tables()
        init_feedback_learning_tables()
        print("✅ Database tables initialized")
    except Exception as e:
        err_msg = str(e).lower()
        if "does not exist" in err_msg or "undefined_table" in err_msg:
            print(
                "⚠️  Database schema not initialized. Run init_db.sql and schema_updates.sql "
                "against your DATABASE_URL. See repo docs for setup."
            )
        else:
            raise


@asynccontextmanager
async def lifespan(app: FastAPI):
    _safe_init_db()
    print("✅ Application started successfully")

    yield
    print("👋 Application shutting down")


app = FastAPI(lifespan=lifespan, title="Konverge API")


@app.get("/")
async def root():
    """Root endpoint - API info and links"""
    return {
        "message": "Konverge API",
        "docs": "/docs",
        "health": "/health",
        "test": "/api/test",
    }


app.add_middleware(
    CORSMiddleware,
    allow_origins=[
        "http://localhost:3000",
        "https://konverge-jmdm.vercel.app",
    ],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)


class ConnectionManager:
    def __init__(self):
        self.active_connections: Dict[str, WebSocket] = {}
        self.thread_participants: Dict[str, Set[str]] = {}

    async def connect(self, websocket: WebSocket, user_id: str):
        await websocket.accept()
        self.active_connections[user_id] = websocket
        print(
            f"User {user_id} connected. Total connections: {len(self.active_connections)}"
        )

    def disconnect(self, user_id: str):
        if user_id in self.active_connections:
            del self.active_connections[user_id]
            print(
                f"User {user_id} disconnected. Total connections: {len(self.active_connections)}"
            )

    def join_thread(self, thread_id: str, user_id: str):
        if thread_id not in self.thread_participants:
            self.thread_participants[thread_id] = set()
        self.thread_participants[thread_id].add(user_id)

    def leave_thread(self, thread_id: str, user_id: str):
        if thread_id in self.thread_participants:
            self.thread_participants[thread_id].discard(user_id)
            if not self.thread_participants[thread_id]:
                del self.thread_participants[thread_id]

    async def send_personal_message(self, message: dict, user_id: str):
        if user_id in self.active_connections:
            try:
                await self.active_connections[user_id].send_json(message)
            except Exception as e:
                print(f"Error sending message to {user_id}: {e}")

    async def broadcast_to_thread(
        self, thread_id: str, message: dict, exclude_user: str = None
    ):
        if thread_id in self.thread_participants:
            for user_id in self.thread_participants[thread_id]:
                if user_id != exclude_user:
                    await self.send_personal_message(message, user_id)


manager = ConnectionManager()


@app.websocket("/ws/{user_id}")
async def websocket_endpoint(websocket: WebSocket, user_id: str):
    await manager.connect(websocket, user_id)
    try:
        while True:
            data = await websocket.receive_json()
            message_type = data.get("type")

            if message_type == "join_thread":
                thread_id = data.get("thread_id")
                manager.join_thread(thread_id, user_id)
                await manager.send_personal_message(
                    {"type": "thread_joined", "thread_id": thread_id}, user_id
                )

            elif message_type == "leave_thread":
                thread_id = data.get("thread_id")
                manager.leave_thread(thread_id, user_id)

            elif message_type == "send_message":
                thread_id = data.get("thread_id")
                content = data.get("content")

                conn = get_db_connection()
                cursor = conn.cursor(cursor_factory=RealDictCursor)

                cursor.execute(
                    """
                    INSERT INTO messages (thread_id, sender_id, content, message_type)
                    VALUES (%s, %s, %s, 'text')
                    RETURNING message_id, thread_id, sender_id, content, message_type, created_at
                """,
                    (thread_id, user_id, content),
                )

                message = dict(cursor.fetchone())

                cursor.execute(
                    """
                    SELECT user_id, name, email
                    FROM users
                    WHERE user_id = %s
                """,
                    (user_id,),
                )

                sender = dict(cursor.fetchone())

                cursor.execute(
                    """
                    UPDATE chat_threads
                    SET updated_at = CURRENT_TIMESTAMP
                    WHERE thread_id = %s
                """,
                    (thread_id,),
                )

                conn.commit()
                cursor.close()
                conn.close()

                broadcast_message = {
                    "type": "new_message",
                    "message": {
                        "id": str(message["message_id"]),
                        "threadId": str(thread_id),
                        "senderId": str(user_id),
                        "content": content,
                        "createdAt": message["created_at"].isoformat(),
                        "sender": {
                            "id": str(sender["user_id"]),
                            "name": sender["name"],
                            "email": sender["email"],
                        },
                    },
                }

                await manager.send_personal_message(broadcast_message, user_id)
                await manager.broadcast_to_thread(
                    thread_id, broadcast_message, exclude_user=user_id
                )

            elif message_type == "typing":
                thread_id = data.get("thread_id")
                is_typing = data.get("is_typing", False)

                await manager.broadcast_to_thread(
                    thread_id,
                    {
                        "type": "user_typing",
                        "thread_id": thread_id,
                        "user_id": user_id,
                        "is_typing": is_typing,
                    },
                    exclude_user=user_id,
                )

            elif message_type == "mark_read":
                message_id = data.get("message_id")

                conn = get_db_connection()
                cursor = conn.cursor()

                cursor.execute(
                    """
                    INSERT INTO message_reads (message_id, user_id)
                    VALUES (%s, %s)
                    ON CONFLICT (message_id, user_id) DO NOTHING
                """,
                    (message_id, user_id),
                )

                conn.commit()
                cursor.close()
                conn.close()

    except WebSocketDisconnect:
        manager.disconnect(user_id)
    except Exception as e:
        print(f"WebSocket error for user {user_id}: {e}")
        manager.disconnect(user_id)


def format_match_row(row):
    return {
        "matchId": row["match_id"],
        "projectId": row["project_id"],
        "requiredSkill": row.get("required_skill"),
        "skillMatchScore": row.get("skill_match_score"),
        "engagementScoreSnapshot": row.get("engagement_score_snapshot"),
        "ratingSnapshot": row.get("rating_snapshot"),
        "ownerDecision": row.get("owner_decision"),
        "userDecision": row.get("user_decision"),
        "createdAt": row.get("created_at"),
        "updatedAt": row.get("updated_at"),
        "recommendedUser": {
            "id": row.get("recommended_user_id"),
            "name": row.get("recommended_user_name"),
            "email": row.get("recommended_user_email"),
            "skills": row.get("recommended_user_skills"),
        },
    }


@app.get("/api/threads/{user_id}")
async def get_user_threads(user_id: str):
    conn = get_db_connection()
    cursor = conn.cursor(cursor_factory=RealDictCursor)

    cursor.execute(
        """
        SELECT 
            t.thread_id,
            t.title,
            t.created_at,
            t.updated_at,
            (
                SELECT json_agg(json_build_object(
                    'id', CAST(u.user_id AS TEXT),
                    'name', u.name,
                    'email', u.email
                ))
                FROM thread_participants tp
                JOIN users u ON tp.user_id = u.user_id
                WHERE tp.thread_id = t.thread_id
            ) as participants,
            (
                SELECT json_build_object(
                    'id', CAST(m.message_id AS TEXT),
                    'content', m.content,
                    'senderId', CAST(m.sender_id AS TEXT),
                    'createdAt', m.created_at
                )
                FROM messages m
                WHERE m.thread_id = t.thread_id
                ORDER BY m.created_at DESC
                LIMIT 1
            ) as last_message,
            (
                SELECT COUNT(*)
                FROM messages m
                WHERE m.thread_id = t.thread_id
                AND m.sender_id != %s
                AND NOT EXISTS (
                    SELECT 1 FROM message_reads mr
                    WHERE mr.message_id = m.message_id
                    AND mr.user_id = %s
                )
            ) as unread_count
        FROM chat_threads t
        JOIN thread_participants tp ON t.thread_id = tp.thread_id
        WHERE tp.user_id = %s
        ORDER BY t.updated_at DESC
    """,
        (user_id, user_id, user_id),
    )

    threads = cursor.fetchall()
    cursor.close()
    conn.close()

    return {"threads": [dict(t) for t in threads]}


@app.get("/api/messages/{thread_id}")
async def get_thread_messages(thread_id: str):
    conn = get_db_connection()
    cursor = conn.cursor(cursor_factory=RealDictCursor)

    cursor.execute(
        """
        SELECT 
            CAST(m.message_id AS TEXT) as id,
            CAST(m.thread_id AS TEXT) as threadId,
            CAST(m.sender_id AS TEXT) as senderId,
            m.content,
            m.message_type,
            m.created_at as "createdAt",
            json_build_object(
                'id', CAST(u.user_id AS TEXT),
                'name', u.name,
                'email', u.email
            ) as sender
        FROM messages m
        JOIN users u ON m.sender_id = u.user_id
        WHERE m.thread_id = %s
        ORDER BY m.created_at ASC
    """,
        (thread_id,),
    )

    messages = cursor.fetchall()
    cursor.close()
    conn.close()

    return {"messages": [dict(m) for m in messages]}


@app.post("/api/threads")
async def create_thread(data: dict):
    title = data.get("title")
    participant_ids = data.get("participant_ids", [])

    if len(participant_ids) < 2:
        raise HTTPException(400, "Thread must have at least 2 participants")

    conn = get_db_connection()
    cursor = conn.cursor(cursor_factory=RealDictCursor)

    cursor.execute(
        """
        INSERT INTO chat_threads (title)
        VALUES (%s)
        RETURNING thread_id, title, created_at, updated_at
    """,
        (title,),
    )

    thread = dict(cursor.fetchone())
    thread_id = thread["thread_id"]

    for user_id in participant_ids:
        cursor.execute(
            """
            INSERT INTO thread_participants (thread_id, user_id)
            VALUES (%s, %s)
        """,
            (thread_id, user_id),
        )

    conn.commit()
    cursor.close()
    conn.close()

    return {"thread": thread}


@app.post("/api/threads/direct")
async def create_or_get_direct_thread(data: dict):
    user1_id = data.get("user1_id")
    user2_id = data.get("user2_id")

    if not user1_id or not user2_id:
        raise HTTPException(400, "Both user IDs required")

    conn = get_db_connection()
    cursor = conn.cursor(cursor_factory=RealDictCursor)

    # Check if thread already exists between these two users (in any order)
    cursor.execute(
        """
        WITH user_threads AS (
            SELECT thread_id, ARRAY_AGG(user_id ORDER BY user_id) as user_ids
            FROM thread_participants
            GROUP BY thread_id
            HAVING COUNT(*) = 2
        )
        SELECT t.thread_id, t.title, t.created_at, t.updated_at
        FROM chat_threads t
        JOIN user_threads ut ON t.thread_id = ut.thread_id
        WHERE ut.user_ids = ARRAY[%s, %s]::int[]
        ORDER BY t.created_at ASC
        LIMIT 1
    """,
        (min(int(user1_id), int(user2_id)), max(int(user1_id), int(user2_id))),
    )

    existing_thread = cursor.fetchone()

    if existing_thread:
        cursor.close()
        conn.close()
        return {"thread": dict(existing_thread), "created": False}

    cursor.execute(
        """
        INSERT INTO chat_threads (title)
        VALUES (NULL)
        RETURNING thread_id, title, created_at, updated_at
    """
    )

    thread = dict(cursor.fetchone())
    thread_id = thread["thread_id"]

    cursor.execute(
        """
        INSERT INTO thread_participants (thread_id, user_id)
        VALUES (%s, %s), (%s, %s)
    """,
        (thread_id, user1_id, thread_id, user2_id),
    )

    conn.commit()
    cursor.close()
    conn.close()

    return {"thread": thread, "created": True}


@app.get("/api/users")
async def get_all_users():
    conn = get_db_connection()
    cursor = conn.cursor(cursor_factory=RealDictCursor)

    cursor.execute(
        """
        SELECT 
            user_id,
            name,
            email,
            bio,
            skills,
            github,
            linkedin,
            rating,
            engagement_score
        FROM users
        ORDER BY engagement_score DESC NULLS LAST
    """
    )

    users = cursor.fetchall()
    cursor.close()
    conn.close()

    return {"users": [dict(u) for u in users]}


@app.post("/api/projects")
async def create_project(request: ProjectCreateRequest):
    conn = get_db_connection()
    cursor = conn.cursor(cursor_factory=RealDictCursor)

    cursor.execute(
        """
        INSERT INTO projects (title, description, required_skills, owner_id, status, roles_available)
        VALUES (%s, %s, %s, %s, %s, %s)
        RETURNING project_id, title, description, required_skills, owner_id, status, roles_available
    """,
        (
            request.title,
            request.description,
            request.required_skills,
            request.owner_id,
            request.status,
            request.roles_available,
        ),
    )

    project = dict(cursor.fetchone())
    add_engagement_points(
        cursor,
        request.owner_id,
        ENGAGEMENT_POINTS.get("pitch_project", 10),
        "pitch_project",
    )
    conn.commit()
    cursor.close()
    conn.close()

    matches = generate_recommendations_for_project(project["project_id"])
    return {"project": project, "matches": matches}


@app.post("/api/projects/{project_id}/apply")
async def apply_to_join_project(project_id: int, current_user: dict = Depends(get_current_user)):
    """Create a manual application match for a project"""
    user_id = current_user["user_id"]
    
    conn = get_db_connection()
    cursor = conn.cursor(cursor_factory=RealDictCursor)
    
    # Check if project exists and user is not the owner
    cursor.execute(
        "SELECT owner_id, title FROM projects WHERE project_id = %s",
        (project_id,)
    )
    project = cursor.fetchone()
    if not project:
        cursor.close()
        conn.close()
        raise HTTPException(status_code=404, detail="Project not found")
    
    if project["owner_id"] == user_id:
        cursor.close()
        conn.close()
        raise HTTPException(status_code=400, detail="Cannot apply to your own project")
    
    # Check if already applied
    cursor.execute(
        """
        SELECT match_id FROM project_matches 
        WHERE project_id = %s AND recommended_user_id = %s AND source_type = 'manual'
        """,
        (project_id, user_id)
    )
    existing = cursor.fetchone()
    if existing:
        cursor.close()
        conn.close()
        raise HTTPException(status_code=400, detail="Already applied to this project")
    
    # Get user's current stats for the match record
    cursor.execute(
        """
        SELECT rating, engagement_score FROM users WHERE user_id = %s
        """,
        (user_id,)
    )
    user_stats = cursor.fetchone()
    
    # Create manual application match
    cursor.execute(
        """
        INSERT INTO project_matches (
            project_id,
            recommended_user_id,
            skill_match_score,
            engagement_score_snapshot,
            rating_snapshot,
            source_type
        ) VALUES (%s, %s, %s, %s, %s, 'manual')
        RETURNING match_id
        """,
        (
            project_id,
            user_id,
            0.0,  # No skill match score for manual applications
            user_stats["engagement_score"] if user_stats else 0,
            user_stats["rating"] if user_stats else 0.0,
        )
    )
    
    match_id = cursor.fetchone()["match_id"]
    
    # Add engagement points for applying
    add_engagement_points(cursor, user_id, 5, "apply_collaboration")
    
    conn.commit()
    cursor.close()
    conn.close()
    
    return {
        "message": "Application submitted successfully",
        "match_id": match_id,
        "project_title": project["title"]
    }


@app.post("/api/projects/{project_id}/recommendations")
async def refresh_project_recommendations(project_id: int):
    matches = generate_recommendations_for_project(project_id)
    return {"projectId": project_id, "matches": matches}


@app.delete("/api/projects/{project_id}")
async def delete_project(project_id: int):
    conn = get_db_connection()
    cursor = conn.cursor(cursor_factory=RealDictCursor)
    cursor.execute(
        "DELETE FROM projects WHERE project_id = %s RETURNING project_id",
        (project_id,),
    )
    deleted = cursor.fetchone()
    conn.commit()
    cursor.close()
    conn.close()

    if not deleted:
        raise HTTPException(status_code=404, detail="Project not found")

    return {"status": "deleted", "projectId": project_id}


@app.get("/api/matches/pitched")
async def get_pitched_matches(owner_id: int):
    conn = get_db_connection()
    cursor = conn.cursor(cursor_factory=RealDictCursor)
    cursor.execute(
        """
        SELECT p.project_id, p.title, p.description, p.required_skills
        FROM projects p
        WHERE p.owner_id = %s
        ORDER BY p.created_at DESC
    """,
        (owner_id,),
    )
    projects = cursor.fetchall()
    cursor.close()
    conn.close()

    result = []
    for project in projects:
        matches = fetch_project_matches_with_users(project["project_id"])
        result.append({"project": dict(project), "matches": matches})
    return {"projects": result}


@app.get("/api/matches/assigned")
async def get_assigned_matches(user_id: int):
    conn = get_db_connection()
    cursor = conn.cursor(cursor_factory=RealDictCursor)
    cursor.execute(
        """
        SELECT 
            pm.*, p.title AS project_title, p.description AS project_description,
            p.required_skills AS project_required_skills
        FROM project_matches pm
        JOIN projects p ON pm.project_id = p.project_id
        WHERE pm.recommended_user_id = %s
        ORDER BY pm.created_at DESC
    """,
        (user_id,),
    )

    rows = cursor.fetchall()
    cursor.close()
    conn.close()
    return {"matches": [dict(row) for row in rows]}


@app.patch("/api/matches/{match_id}/owner")
async def update_owner_decision(match_id: int, request: MatchDecisionRequest):
    decision = request.decision.lower()
    if decision not in {"accepted", "rejected"}:
        raise HTTPException(400, "decision must be accepted or rejected")

    conn = get_db_connection()
    cursor = conn.cursor(cursor_factory=RealDictCursor)
    cursor.execute(
        """
        SELECT *
        FROM project_matches
        WHERE match_id = %s
    """,
        (match_id,),
    )
    existing_row = cursor.fetchone()
    if not existing_row:
        cursor.close()
        conn.close()
        raise HTTPException(404, "Match not found")
    previous_owner_decision = existing_row.get("owner_decision")
    if previous_owner_decision == decision:
        cursor.close()
        conn.close()
        return {"match": format_match_row(existing_row)}

    cursor.execute(
        """
        UPDATE project_matches
        SET owner_decision = %s,
            owner_decided_at = CURRENT_TIMESTAMP,
            updated_at = CURRENT_TIMESTAMP
        WHERE match_id = %s
        RETURNING *
    """,
        (decision, match_id),
    )
    match_row = cursor.fetchone()
    if not match_row:
        cursor.close()
        conn.close()
        raise HTTPException(404, "Match not found")

    cursor.execute(
        """
        INSERT INTO match_feedback (match_id, actor_type, decision, reason_json)
        VALUES (%s, 'owner', %s, %s)
    """,
        (match_id, decision, json.dumps(request.reason) if request.reason else None),
    )

    # Only record feedback signal for automated recommendations
    if match_row.get("source_type") == "automated":
        record_feedback_signal(
            cursor,
            match_row.get("recommended_user_id"),
            match_row.get("required_skill"),
            decision == "accepted",
        )
    
    sync_collaboration_if_ready(cursor, match_row)
    conn.commit()
    cursor.close()
    conn.close()

    return {"match": format_match_row(match_row)}


@app.patch("/api/matches/{match_id}/user")
async def update_user_decision(match_id: int, request: MatchDecisionRequest):
    decision = request.decision.lower()
    if decision not in {"accepted", "rejected"}:
        raise HTTPException(400, "decision must be accepted or rejected")

    conn = get_db_connection()
    cursor = conn.cursor(cursor_factory=RealDictCursor)
    cursor.execute(
        """
        SELECT *
        FROM project_matches
        WHERE match_id = %s
    """,
        (match_id,),
    )
    existing_row = cursor.fetchone()
    if not existing_row:
        cursor.close()
        conn.close()
        raise HTTPException(404, "Match not found")
    previous_user_decision = existing_row.get("user_decision")
    if previous_user_decision == decision:
        cursor.close()
        conn.close()
        return {"match": format_match_row(existing_row)}

    cursor.execute(
        """
        UPDATE project_matches
        SET user_decision = %s,
            user_decided_at = CURRENT_TIMESTAMP,
            updated_at = CURRENT_TIMESTAMP
        WHERE match_id = %s
        RETURNING *
    """,
        (decision, match_id),
    )
    match_row = cursor.fetchone()
    if not match_row:
        cursor.close()
        conn.close()
        raise HTTPException(404, "Match not found")
    cursor.execute(
        """
        INSERT INTO match_feedback (match_id, actor_type, decision, reason_json)
        VALUES (%s, 'user', %s, %s)
    """,
        (match_id, decision, json.dumps(request.reason) if request.reason else None),
    )
    if decision == "accepted" and previous_user_decision != "accepted":
        add_engagement_points(
            cursor,
            match_row.get("recommended_user_id"),
            ENGAGEMENT_POINTS.get("apply_collaboration", 5),
            "apply_collaboration",
        )
    
    # Only record feedback signal for automated recommendations
    if match_row.get("source_type") == "automated":
        record_feedback_signal(
            cursor,
            match_row.get("recommended_user_id"),
            match_row.get("required_skill"),
            decision == "accepted",
        )
    
    sync_collaboration_if_ready(cursor, match_row)
    conn.commit()
    cursor.close()
    conn.close()

    return {"match": format_match_row(match_row)}


@app.get("/api/test")
async def test_endpoint():
    """Simple test endpoint to verify backend is working"""
    return {"message": "Backend is working!", "timestamp": datetime.now().isoformat()}


@app.get("/api/analytics/user/{user_id}")
async def get_user_analytics(user_id: int):
    """Get comprehensive analytics for a user"""
    # Check cache first
    cached_data = get_cached_analytics(user_id)
    if cached_data:
        return cached_data
    
    conn = None
    cursor = None
    try:
        conn = get_db_connection()
        cursor = conn.cursor(cursor_factory=RealDictCursor)
        
        # Get user basic info
        cursor.execute(
            """
            SELECT name, email, rating, engagement_score, skills 
            FROM users WHERE user_id = %s
            """,
            (user_id,)
        )
        user = cursor.fetchone()
        if not user:
            cursor.close()
            conn.close()
            raise HTTPException(status_code=404, detail="User not found")
        
        # Overview metrics
        cursor.execute(
            """
            SELECT 
                COUNT(DISTINCT pc.project_id) as total_collaborations,
                COUNT(DISTINCT CASE WHEN pc.status = 'active' THEN pc.project_id END) as active_projects
            FROM project_collaborators pc
            WHERE pc.user_id = %s
            """,
            (user_id,)
        )
        collab_stats = cursor.fetchone()
        
        # Application stats
        cursor.execute(
            """
            SELECT 
                COUNT(*) as total,
                COUNT(CASE WHEN owner_decision = 'accepted' THEN 1 END) as accepted,
                COUNT(CASE WHEN owner_decision = 'rejected' THEN 1 END) as rejected,
                COUNT(CASE WHEN owner_decision = 'pending' THEN 1 END) as pending
            FROM project_matches 
            WHERE recommended_user_id = %s AND source_type = 'manual'
            """,
            (user_id,)
        )
        app_stats = cursor.fetchone()
        
        # Response rate (for automated recommendations)
        cursor.execute(
            """
            SELECT 
                COUNT(CASE WHEN owner_decision IN ('accepted', 'rejected') THEN 1 END) as responded,
                COUNT(*) as total_auto
            FROM project_matches 
            WHERE recommended_user_id = %s AND source_type = 'automated'
            """,
            (user_id,)
        )
        response_stats = cursor.fetchone()
        response_rate = 0
        if response_stats['total_auto'] > 0:
            response_rate = round((response_stats['responded'] / response_stats['total_auto']) * 100, 1)
        
        # Engagement trend (last 30 days)
        cursor.execute(
            """
            SELECT 
                DATE(timestamp) as date,
                SUM(points) as score
            FROM engagement 
            WHERE user_id = %s AND timestamp >= CURRENT_DATE - INTERVAL '30 days'
            GROUP BY DATE(timestamp)
            ORDER BY date
            """,
            (user_id,)
        )
        engagement_rows = cursor.fetchall()
        engagement_trend = []
        for row in engagement_rows:
            if row and row.get("date") and row.get("score") is not None:
                try:
                    engagement_trend.append({
                        "date": row["date"].strftime("%m/%d"), 
                        "score": int(row["score"]) if row["score"] else 0
                    })
                except (ValueError, TypeError):
                    continue
        
        # If no engagement data, provide sample trend
        if not engagement_trend:
            # Generate sample data for demo
            import random
            base_score = user["engagement_score"] or 50
            for i in range(30, 0, -5):
                engagement_trend.append({
                    "date": (datetime.now() - timedelta(days=i)).strftime("%m/%d"),
                    "score": max(0, base_score + random.randint(-10, 10))
                })
        
        # Rating progress (last 6 months)
        cursor.execute(
            """
            SELECT 
                DATE_TRUNC('month', completed_at) as month,
                AVG(score) as rating
            FROM user_ratings 
            WHERE ratee_id = %s AND status = 'completed' AND completed_at IS NOT NULL
            GROUP BY DATE_TRUNC('month', completed_at)
            ORDER BY month
            LIMIT 6
            """,
            (user_id,)
        )
        rating_rows = cursor.fetchall()
        rating_progress = []
        for row in rating_rows:
            if row and row.get("month") and row.get("rating") is not None:
                try:
                    rating_progress.append({
                        "date": row["month"].strftime("%m/%d"), 
                        "rating": float(row["rating"]) if row["rating"] else 0.0
                    })
                except (ValueError, TypeError):
                    continue
        
        # If no rating data, provide sample progress
        if not rating_progress:
            # Generate sample rating progression
            base_rating = float(user["rating"]) or 3.5
            for i in range(5, -1, -1):
                rating_progress.append({
                    "date": (datetime.now() - timedelta(days=30*i)).strftime("%m/%d"),
                    "rating": round(min(5.0, max(1.0, base_rating + (5-i) * 0.1)), 1)
                })
        
        # Collaboration frequency (last 6 months)
        cursor.execute(
            """
            SELECT 
                DATE_TRUNC('month', joined_at) as month,
                COUNT(*) as projects
            FROM project_collaborators 
            WHERE user_id = %s AND joined_at >= CURRENT_DATE - INTERVAL '6 months'
            GROUP BY DATE_TRUNC('month', joined_at)
            ORDER BY month
            """,
            (user_id,)
        )
        collab_rows = cursor.fetchall()
        collaboration_freq = []
        for row in collab_rows:
            if row and row.get("month") and row.get("projects") is not None:
                try:
                    collaboration_freq.append({
                        "month": row["month"].strftime("%b"), 
                        "projects": int(row["projects"]) if row["projects"] else 0
                    })
                except (ValueError, TypeError):
                    continue
        
        # If no collaboration data, provide sample frequency
        if not collaboration_freq:
            # Generate sample collaboration frequency
            import random
            for i in range(5, -1, -1):
                collaboration_freq.append({
                    "month": (datetime.now() - timedelta(days=30*i)).strftime("%b"),
                    "projects": random.randint(1, 3)
                })
        
        # Skills distribution - OPTIMIZED: Single query instead of N+1
        skills = user["skills"] or []
        skills_distribution = []
        if skills:
            # Use a single query to get all skill counts
            skill_list = skills[:5]  # Top 5 skills
            placeholders = ','.join(['%s'] * len(skill_list))
            cursor.execute(
                f"""
                SELECT 
                    skill,
                    COUNT(*) as count,
                    ROUND(COUNT(*) * 100.0 / %s, 1) as percentage
                FROM (
                    SELECT unnest(p.required_skills) as skill
                    FROM project_collaborators pc
                    JOIN projects p ON pc.project_id = p.project_id
                    WHERE pc.user_id = %s AND p.required_skills && %s
                ) skill_counts
                WHERE skill IN ({placeholders})
                GROUP BY skill
                """,
                [max(collab_stats["total_collaborations"], 1), user_id, skills] + skill_list
            )
            skill_rows = cursor.fetchall()
            
            for row in skill_rows:
                if row and row.get("skill"):
                    skills_distribution.append({
                        "skill": row["skill"],
                        "count": row["count"] or 1,
                        "percentage": row["percentage"] or 20.0
                    })
            
            # Add any missing skills with default values
            existing_skills = {s["skill"] for s in skills_distribution}
            for skill in skill_list:
                if skill not in existing_skills:
                    skills_distribution.append({
                        "skill": skill,
                        "count": 1,
                        "percentage": 20.0
                    })
        else:
            # Add sample skills if user has none
            sample_skills = ["JavaScript", "Python", "React", "Node.js", "SQL"]
            for skill in sample_skills[:3]:
                skills_distribution.append({
                    "skill": skill,
                    "count": 1,
                    "percentage": 33.3
                })
        
        # Project types (based on project titles/categories)
        try:
            cursor.execute(
                """
                SELECT 
                    CASE 
                        WHEN p.title ILIKE '%app%' OR p.title ILIKE '%mobile%' THEN 'Mobile Apps'
                        WHEN p.title ILIKE '%web%' OR p.title ILIKE '%website%' THEN 'Web Development'
                        WHEN p.title ILIKE '%ml%' OR p.title ILIKE '%ai%' OR p.title ILIKE '%data%' THEN 'AI/ML'
                        WHEN p.title ILIKE '%blockchain%' OR p.title ILIKE '%crypto%' THEN 'Blockchain'
                        ELSE 'Other'
                    END as type,
                    COUNT(*) as count
                FROM project_collaborators pc
                JOIN projects p ON pc.project_id = p.project_id
                WHERE pc.user_id = %s
                GROUP BY type
                ORDER BY count DESC
                """,
                (user_id,)
            )
            project_type_rows = cursor.fetchall()
            project_types = []
            for row in project_type_rows:
                if row and row.get("type") and row.get("count") is not None:
                    project_types.append({
                        "type": row["type"], 
                        "count": int(row["count"]) if row["count"] else 0
                    })
        except Exception as e:
            print(f"Project types query failed: {e}")
            project_types = []
        
        # If no project types, provide sample data
        if not project_types:
            project_types = [
                {"type": "Web Development", "count": 2},
                {"type": "Mobile Apps", "count": 1},
                {"type": "AI/ML", "count": 1}
            ]
        
        cursor.close()
        conn.close()
        
        result = {
            "overview": {
                "totalCollaborations": collab_stats["total_collaborations"],
                "activeProjects": collab_stats["active_projects"],
                "overallRating": float(user["rating"]) or 0.0,
                "engagementScore": user["engagement_score"] or 0,
                "skillsContributed": skills,
                "responseRate": response_rate
            },
            "engagementTrend": engagement_trend,
            "ratingProgress": rating_progress,
            "collaborationFrequency": collaboration_freq,
            "skillsDistribution": skills_distribution,
            "projectTypes": project_types,
            "applicationStats": {
                "total": app_stats["total"],
                "accepted": app_stats["accepted"],
                "rejected": app_stats["rejected"],
                "pending": app_stats["pending"]
            }
        }
        
        # Cache the result
        cache_analytics(user_id, result)
        
        return result
        
    except HTTPException:
        # Re-raise HTTP exceptions (like 404) as-is
        raise
    except Exception as e:
        print(f"Error in analytics for user {user_id}: {e}")
        import traceback
        traceback.print_exc()
        raise HTTPException(status_code=500, detail=f"Analytics error: {str(e)}")
    finally:
        # Ensure connections are closed
        if cursor:
            try:
                cursor.close()
            except:
                pass
        if conn:
            try:
                conn.close()
            except:
                pass


@app.get("/api/ratings/pending")
async def get_pending_ratings(user_id: int):
    conn = get_db_connection()
    cursor = conn.cursor(cursor_factory=RealDictCursor)
    cursor.execute(
        """
        SELECT 
            ur.rating_id,
            ur.project_id,
            ur.created_at,
            ur.rater_id,
            ur.ratee_id,
            u.name AS ratee_name,
            u.email AS ratee_email,
            p.title AS project_title
        FROM user_ratings ur
        JOIN users u ON ur.ratee_id = u.user_id
        LEFT JOIN projects p ON ur.project_id = p.project_id
        WHERE ur.rater_id = %s
          AND ur.status = 'pending'
        ORDER BY ur.created_at DESC
    """,
        (user_id,),
    )
    rows = cursor.fetchall()
    cursor.close()
    conn.close()
    return {"ratings": [dict(row) for row in rows]}


@app.post("/api/ratings/{rating_id}/submit")
async def submit_rating_endpoint(rating_id: int, request: SubmitRatingRequest):
    conn = get_db_connection()
    cursor = conn.cursor(cursor_factory=RealDictCursor)
    cursor.execute(
        """
        SELECT rating_id, rater_id, ratee_id, status
        FROM user_ratings
        WHERE rating_id = %s
    """,
        (rating_id,),
    )
    rating_row = cursor.fetchone()
    if not rating_row:
        cursor.close()
        conn.close()
        raise HTTPException(status_code=404, detail="Rating request not found")
    if rating_row["rater_id"] != request.rater_id:
        cursor.close()
        conn.close()
        raise HTTPException(status_code=403, detail="You are not allowed to rate this user")
    if rating_row["status"] == "completed":
        cursor.close()
        conn.close()
        raise HTTPException(status_code=400, detail="Rating already submitted")

    cursor.execute(
        """
        UPDATE user_ratings
        SET score = %s,
            feedback = %s,
            status = 'completed',
            completed_at = CURRENT_TIMESTAMP
        WHERE rating_id = %s
        RETURNING *
    """,
        (request.score, request.feedback, rating_id),
    )
    updated_row = cursor.fetchone()
    recalculate_user_rating(cursor, updated_row["ratee_id"])
    conn.commit()
    cursor.close()
    conn.close()
    return {"rating": dict(updated_row)}


@app.get("/health")
async def health_check():
    return {"status": "healthy"}


@app.get("/api/leaderboard")
async def get_leaderboard():
    """
    Get leaderboard data ordered by engagement scores of actual users
    Excludes admin accounts and accounts frozen for inactivity
    """
    conn = get_db_connection()
    cursor = conn.cursor(cursor_factory=RealDictCursor)
    
    cursor.execute(
        """
        SELECT 
            u.user_id,
            u.name,
            u.email,
            u.skills,
            u.rating,
            u.engagement_score,
            u.bio,
            u.github,
            u.linkedin,
            -- Calculate rank based on engagement_score
            RANK() OVER (ORDER BY u.engagement_score DESC) as rank,
            -- Get projects completed count
            (SELECT COUNT(*) 
             FROM project_collaborators pc 
             WHERE pc.user_id = u.user_id AND pc.status = 'completed') as projects_completed,
            -- Get badges (simplified - would need actual badges table)
            ARRAY[]::text[] as badges
        FROM users u
        WHERE u.account_status = 'active'
          AND u.email != 'konverge@example.com'  -- Exclude main admin account
          AND (
            -- Exclude accounts frozen for more than 4 weeks without response
            u.user_id NOT IN (
                SELECT DISTINCT pm.recommended_user_id
                FROM project_matches pm
                WHERE pm.user_decision = 'pending'
                  AND pm.created_at < CURRENT_TIMESTAMP - INTERVAL '4 weeks'  -- Changed from 5 to 4 weeks
                  AND pm.recommended_user_id NOT IN (
                      -- Exclude users who have recent activity
                      SELECT DISTINCT recommended_user_id
                      FROM project_matches
                      WHERE user_decision IN ('accepted', 'rejected')
                        AND user_decided_at > CURRENT_TIMESTAMP - INTERVAL '4 weeks'
                  )
            )
          )
        ORDER BY u.engagement_score DESC
        LIMIT 50
    """
    )
    
    leaderboard_data = []
    for row in cursor.fetchall():
        # Generate badges based on achievements (simplified version)
        badges = []
        if row['projects_completed'] >= 1:
            badges.append({"id": "first_collab", "name": "First Collaboration", "icon": "🤝", "rarity": "common"})
        if row['projects_completed'] >= 5:
            badges.append({"id": "collaborator", "name": "Team Player", "icon": "🤝", "rarity": "rare"})
        if row['rating'] and row['rating'] >= 4.5:
            badges.append({"id": "top_rated", "name": "Top Rated", "icon": "⭐", "rarity": "epic"})
        if row['engagement_score'] and row['engagement_score'] >= 100:
            badges.append({"id": "engaged", "name": "Super Engaged", "icon": "🔥", "rarity": "legendary"})
        
        leaderboard_data.append({
            "user": {
                "id": str(row["user_id"]),
                "name": row["name"],
                "email": row["email"],
                "avatar": None,  # Would need avatar column or generate from initials
                "skills": row["skills"] or [],
                "badges": badges
            },
            "rank": row["rank"],
            "points": row["engagement_score"] or 0,
            "projectsCompleted": row["projects_completed"],
            "collaborationScore": row["rating"] or 0.0
        })
    
    cursor.close()
    conn.close()
    
    return {"leaderboard": leaderboard_data}


if __name__ == "__main__":
    import uvicorn

    uvicorn.run(app, host="0.0.0.0", port=8000)
