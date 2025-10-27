from fastapi import FastAPI, WebSocket, WebSocketDisconnect, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from typing import Dict, Set
import json
from datetime import datetime
import psycopg2
from psycopg2.extras import RealDictCursor
from contextlib import asynccontextmanager


def get_db_connection():
    return psycopg2.connect(
        host="localhost",
        port=5433,
        database="konverge",
        user="postgres",
        password="postgres123",
    )


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


@asynccontextmanager
async def lifespan(app: FastAPI):
    init_chat_tables()
    print("✅ Application started successfully")
    yield
    print("👋 Application shutting down")


app = FastAPI(lifespan=lifespan)

app.add_middleware(
    CORSMiddleware,
    allow_origins=["http://localhost:3000"],
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


@app.get("/health")
async def health_check():
    return {"status": "healthy"}


if __name__ == "__main__":
    import uvicorn

    uvicorn.run(app, host="0.0.0.0", port=8000)
