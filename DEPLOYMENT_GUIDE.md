# 🚀 Production Deployment Guide: Supabase + Render + Vercel

This guide walks you through deploying the **Warehouse Intelligence Platform** across the complete production cloud stack:
1. **Database**: [Supabase](https://supabase.com) (Managed PostgreSQL)
2. **Backend**: [Render](https://render.com) (FastAPI Python Service + WebSocket Engine)
3. **Frontend**: [Vercel](https://vercel.com) (React + Vite SPA)

---

## 🏗️ Architecture & Cloud Topology

```
┌─────────────────────────┐          ┌──────────────────────────┐          ┌─────────────────────────┐
│     Vercel Frontend     │  HTTPS   │      Render Backend      │  SSL     │   Supabase PostgreSQL   │
│  (React 19 + Vite SPA)  │ ───────> │  (FastAPI / Uvicorn API) │ ───────> │  (43 Canonical Incidents │
│  wms-intel.vercel.app   │  WSS     │  api.onrender.com/api    │          │   Bays, Users, Models)  │
└─────────────────────────┘          └──────────────────────────┘          └─────────────────────────┘
```

---

## Step 1: Supabase Database Setup

### Option A: 1-Click SQL Editor (Recommended — Fastest)
1. Log in to your [Supabase Dashboard](https://supabase.com/dashboard).
2. Create a new project (or select an existing one).
3. In the left sidebar, click on the **SQL Editor** icon (`>_`).
4. Click **New Query**.
5. Copy the entire contents of the project's [`supabase_schema.sql`](file:///c:/Users/shris/Desktop/Warehouse-Intelligence-Platform/supabase_schema.sql) file.
6. Paste into the Supabase SQL Editor and click **Run** (Ctrl + Enter).
7. Verification: Click **Table Editor** in the left menu. You will see 12 populated tables:
   - `events` (43 incidents covering all 10 taxonomy behaviours)
   - `loading_bays` (6 bays with normalized IDs)
   - `facilities` (Bengaluru, Mumbai, Delhi, Chennai hubs)
   - `users` (`supervisor@wms-intel.io`, `admin@wms-intel.io`, `operator@wms-intel.io`)
   - `cameras`, `safety_rules`, `videos`

### Option B: Automated CLI Migration from Local SQLite
If you prefer migrating via script:
1. In Supabase, go to **Project Settings** -> **Database** -> **Connection String**.
2. Select **URI** and copy the connection string (format: `postgresql://postgres.[REF]:[PASSWORD]@...:6543/postgres`).
3. In your terminal, run:
   ```bash
   python backend/migrate_to_supabase.py --url "postgresql://postgres:[YOUR-PASSWORD]@db.[REF].supabase.co:5432/postgres"
   ```
4. The script creates all tables and copies all local records automatically.

---

## Step 2: Render Backend Deployment

### Option A: Deploy via `render.yaml` Blueprint (Automated)
1. Push your repository to GitHub.
2. Open the [Render Dashboard](https://dashboard.render.com).
3. Click **New +** -> **Blueprint**.
4. Select your GitHub repository.
5. Render automatically detects [`render.yaml`](file:///c:/Users/shris/Desktop/Warehouse-Intelligence-Platform/render.yaml) at the project root and configures all settings.
6. Under Environment Variables, input:
   - `DATABASE_URL`: Your Supabase connection string
   - `GEMINI_API_KEY`: Your Google Gemini API key
7. Click **Apply**.

### Option B: Manual Web Service Setup on Render
1. Open [Render Dashboard](https://dashboard.render.com) -> Click **New +** -> **Web Service**.
2. Connect your GitHub repository.
3. Configure the service settings:
   | Setting | Value |
   | :--- | :--- |
   | **Name** | `warehouse-intelligence-api` |
   | **Region** | Singapore or Oregon |
   | **Root Directory** | `backend` |
   | **Runtime** | `Python 3` |
   | **Build Command** | `pip install -r requirements.txt` |
   | **Start Command** | `uvicorn app.main:app --host 0.0.0.0 --port $PORT` |
   | **Instance Type** | Free |
4. Scroll to **Environment Variables** and add:
   ```env
   PYTHON_VERSION=3.11.9
   ENVIRONMENT=PRODUCTION
   API_PREFIX=/api
   CORS_ORIGIN=*
   DATABASE_URL=postgresql://postgres:[PASSWORD]@db.[REF].supabase.co:5432/postgres
   GEMINI_API_KEY=AIzaSy...
   GEMINI_MODEL=gemini-2.5-flash
   MODEL_ENGINE=ROBOFLOW_HOSTED
   ```
5. Click **Create Web Service**.
6. Once deployed, Render provides your live URL (e.g. `https://warehouse-intelligence-api.onrender.com`).
7. **Verify API is Live**:
   - Open `https://your-api.onrender.com/api/health` -> should return `{"status":"ok"}`.
   - Open `https://your-api.onrender.com/api/bays` -> should return the 4 active loading bays.

---

## Step 3: Vercel Frontend Deployment

1. Open the [Vercel Dashboard](https://vercel.com/new).
2. Click **Add New...** -> **Project** -> Import your GitHub repository.
3. Configure Project Settings:
   - **Framework Preset**: `Vite`
   - **Root Directory**: Click `Edit` and select `frontend`
   - **Build Command**: `npm run build`
   - **Output Directory**: `dist`
4. Expand the **Environment Variables** section and add:
   | Name | Value |
   | :--- | :--- |
   | `VITE_API_URL` | `https://your-backend-api.onrender.com` |
5. Click **Deploy**.
6. Vercel builds the bundle and deploys the site with SPA rewrites configured by [`frontend/vercel.json`](file:///c:/Users/shris/Desktop/Warehouse-Intelligence-Platform/frontend/vercel.json).

---

## Step 4: Verification & Login

Once Vercel and Render are deployed:
1. Open your Vercel URL (e.g. `https://warehouse-intelligence-platform.vercel.app`).
2. Log in using either:
   - **Supervisor**: `supervisor@wms-intel.io` / `password123`
   - **Administrator**: `admin@wms-intel.io` / `password123`
   - **Operator**: `operator@wms-intel.io` / `password123`
   - **Or click the 1-Click "Launch Supervisor Console" button**.
3. Verify:
   - **Dashboard**: Loading Bay Operational Health shows active bays with risk levels.
   - **Top Header**: Click the site selector dropdown and switch between Bengaluru, Mumbai, Delhi, and Chennai.
   - **Incident Queue** (`/incidents`): Cards display detailed observations and allow 1-click evidence playback.
   - **Behaviour Library** (`/behaviour-library`): All 10 standard behaviours show real occurrences with working video play buttons.
   - **Loading Bays** (`/loading-bays`): Dropzones allow uploading clips or assigning warehouse presets.

---

## 🛠️ Common Troubleshooting

| Issue | Cause | Fix |
| :--- | :--- | :--- |
| **Supabase: Connection refused / timeout** | Project is paused or port blocked | Ensure your project is active in Supabase. Try using the Transaction Pooler connection string (port `6543`) with `sslmode=require`. |
| **Vercel: 404 on page refresh** | SPA route rewrite missing | Handled automatically by [`frontend/vercel.json`](file:///c:/Users/shris/Desktop/Warehouse-Intelligence-Platform/frontend/vercel.json). If deploying from root, [`vercel.json`](file:///c:/Users/shris/Desktop/Warehouse-Intelligence-Platform/vercel.json) handles root rewrites. |
| **CORS blocked by browser** | Render `CORS_ORIGIN` mismatch | Set `CORS_ORIGIN=*` in your Render environment variables, or specify your exact Vercel domain (e.g. `https://your-app.vercel.app`). |
| **Render: Backend cold start delay** | Free tier spinning down | Free Render instances sleep after 15 minutes of inactivity. Initial request takes ~30-40 seconds to spin up. |
