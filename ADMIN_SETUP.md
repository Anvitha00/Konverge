# Admin Dashboard Setup Guide

## 1. Running the Migration

The migration adds the `created_at` column to the `users` table for the "New users (30 days)" stat.

### Option A: Using PowerShell Script (Windows)

```powershell
.\run_migration.ps1
```

### Option B: Manual psql Command

```bash
# Using DATABASE_URL from .env.local
psql postgres://postgres:postgres123@localhost:5433/konverge -f schema_updates.sql

# Or with explicit parameters
psql -h localhost -p 5433 -U postgres -d konverge -f schema_updates.sql
# Password: postgres123
```

### Option C: Using Python (if you have psycopg2)

```python
import psycopg2
import os

conn = psycopg2.connect(os.getenv('DATABASE_URL', 'postgres://postgres:postgres123@localhost:5433/konverge'))
cursor = conn.cursor()

with open('schema_updates.sql', 'r') as f:
    cursor.execute(f.read())

conn.commit()
cursor.close()
conn.close()
```

## 2. Admin Email Setup

Your `.env.local` currently has:
```
ADMIN_EMAILS=konverge@email.com
```

**Problem:** None of the seed users have this email address.

### Solution A: Use an Existing User Email

Update `.env.local` to use one of the existing seed users:
```
ADMIN_EMAILS=ananya@example.com
```

Or add multiple admins:
```
ADMIN_EMAILS=ananya@example.com,meera@example.com
```

### Solution B: Create a New Admin User

1. Register a new user with email `konverge@email.com` through the registration page
2. Or manually insert into database:
```sql
INSERT INTO users (name, email, password_hash, skills, rating, engagement_score)
VALUES (
  'Admin User',
  'konverge@email.com',
  '$2b$10$8OZu2Mut8W/8NzvCEtzZmuG9nbZ0UvKCRFUN5HdRXvYzauB4ERk26',
  ARRAY['Admin'],
  5.0,
  100
);
```

## 3. Login Credentials

All seed users use the same password: **`dummy123`**

Available test users:
- `ananya@example.com` / `dummy123`
- `rahul@example.com` / `dummy123`
- `meera@example.com` / `dummy123`
- `kiran@example.com` / `dummy123`
- `divya@example.com` / `dummy123`
- `amit@example.com` / `dummy123`
- `sonia@example.com` / `dummy123`
- `vikram@example.com` / `dummy123`
- `ravi@example.com` / `dummy123`
- `priya@example.com` / `dummy123`

**To use admin dashboard:**
1. Set `ADMIN_EMAILS` in `.env.local` to one of these emails (e.g., `ADMIN_EMAILS=ananya@example.com`)
2. Restart your Next.js dev server
3. Log in with that email and password `dummy123`
4. You should see the "Admin" link in the sidebar

## 4. Troubleshooting

### Admin link not showing?
- Make sure you restarted the Next.js server after updating `ADMIN_EMAILS`
- Check that your email matches exactly (case-insensitive, but check for typos)
- Verify the session has `isAdmin` by checking browser dev tools → Application → Cookies → `next-auth.session-token`

### Migration errors?
- Make sure PostgreSQL is running
- Verify DATABASE_URL matches your actual database connection
- Check that `schema_updates.sql` exists in the project root
- The migration uses `IF NOT EXISTS`, so it's safe to run multiple times

### API errors (no projects, profile stuck loading, dashboard errors)?
- **Make sure FastAPI backend is running** on `http://localhost:8000`
  
  Start the backend:
  ```bash
  # Activate virtual environment (if using one)
  .\venv\Scripts\activate  # Windows
  # or
  source venv/bin/activate  # Linux/Mac
  
  # Navigate to backend directory
  cd backend
  
  # Run FastAPI server
  python main.py
  # or
  uvicorn main:app --reload --host 0.0.0.0 --port 8000
  ```
  
  The backend should start on `http://localhost:8000`. You can verify by visiting:
  - `http://localhost:8000/docs` (Swagger UI)
  - `http://localhost:8000/api/matches/pitched?owner_id=1` (test endpoint)

- Check backend logs for errors
- Verify DATABASE_URL is the same in both Next.js and FastAPI
- Make sure PostgreSQL is running and accessible
- Test backend endpoints directly: `http://localhost:8000/api/matches/pitched?owner_id=1`
