# Render Deployment Setup

## 1. Create a PostgreSQL Database on Render

1. In your Render dashboard, create a **PostgreSQL** database.
2. Note the **Internal Database URL** (or External URL if your backend runs elsewhere).

## 2. Connect Backend to Database

Add the database URL to your Web Service's **Environment Variables**:

- `DATABASE_URL` = your PostgreSQL connection string (from Render dashboard)

## 3. Initialize the Database Schema

Your Render database starts empty. You must run the schema before the app can work:

### Option A: Using Render Shell

1. In Render Dashboard → your **PostgreSQL** database → **Connect** → **External Connection**
2. Copy the connection string.
3. From your local machine (with `psql` installed), run from the repo root:
   ```bash
   cd /path/to/Konverge
   psql "YOUR_RENDER_DATABASE_URL" -f init_db.sql
   psql "YOUR_RENDER_DATABASE_URL" -f schema_updates.sql
   ```

### Option B: Using a migration service or one-off job

Create a one-off job or use a migration tool that runs:
- `init_db.sql` (creates users, projects, etc.)
- `schema_updates.sql` (adds account_status, created_at, triggers, etc.)

### Option C: pgAdmin or another GUI

Connect to your Render PostgreSQL database and execute the contents of:
1. `init_db.sql`
2. `schema_updates.sql`

## 4. Redeploy

After the schema is applied, redeploy your Web Service (or it will pick up the schema on next deploy). The app will then start successfully.
