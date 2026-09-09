# Warehouse Intelligence Platform

[![React](https://img.shields.io/badge/Frontend-React%2019%20%2B%20TypeScript%20%2B%20Vite-blue)](https://vitejs.dev/)
[![FastAPI](https://img.shields.io/badge/Backend-FastAPI%20%2B%20Python%203.13-009688)](https://fastapi.tiangolo.com/)
[![Computer Vision](https://img.shields.io/badge/Vision-Ultralytics%20YOLO11s%20%2B%20Roboflow-orange)](https://roboflow.com/)
[![AI Assistant](https://img.shields.io/badge/GenAI-Google%20Gemini%202.5%20Flash-4285F4)](https://ai.google.dev/)
[![Database](https://img.shields.io/badge/Database-SQLite%20%2F%20Supabase%20PostgreSQL-336791)](https://supabase.com/)
[![Deploy](https://img.shields.io/badge/Deploy-Vercel%20%2B%20Render%20%2B%20Supabase-black)](https://vercel.com/)

An enterprise-grade, platform-agnostic video intelligence platform that converts warehouse loading and unloading video footage into real-time operational safety intelligence and proactive damage prevention.

Repository: [https://github.com/HarshaNethra/Warehouse-Intelligence-Platform](https://github.com/HarshaNethra/Warehouse-Intelligence-Platform)

---

## 🎯 Platform Overview

The **Warehouse Intelligence Platform** shifts warehouse safety from reactive damage claims to proactive, real-time prevention:
$$\text{Warehouse Activity} \longrightarrow \text{Video Stream} \longrightarrow \text{AI Perception} \longrightarrow \text{Kinematic Risk Detection} \longrightarrow \text{Live Alert} \longrightarrow \text{Supervisor Intervention} \longrightarrow \text{Damage Prevention}$$

### Key Capabilities
* **Optical Video Ingestion**: Frame-by-frame decoding, drag-and-drop file ingestion (.mp4, .avi, .mov), and multi-bay CCTV camera simulation.
* **YOLO11s Object Detection & Multi-Object Tracking**: Detects workers (`person`), cartons (`carton`), furniture (`furniture`), and handling equipment (`pallet`, `forklift`) with ByteTrack ID association.
* **Kinematic Risk Classification**: Physics-based acceleration ($>9.8 \text{ m/s}^2$) and horizontal dragging velocity tracking over rolling temporal windows.
* **10 Predefined Handling Behaviors**: Comprehensive taxonomy covering drops, dragging, rough tossing, improper heavy-on-light stacking, off-orientation placement, and crush hazards.
* **Grounded AI Supervisor Assistant**: Conversational Q&A powered by **Google Gemini 2.5 Flash** with direct citations to SQL warehouse incidents.
* **Damage Prevention Index**: Real-time business KPI measuring proactive risk mitigations, repeat behavior reduction, and supervisor response latency.
* **Live API Key & Configuration Manager**: In-browser portal at `http://localhost:8000/` to test and persist Gemini API Keys, Roboflow API Keys, and model parameters.

---

## 🏗️ Architecture & Technology Stack

| Component | Technology | Purpose |
| :--- | :--- | :--- |
| **Frontend** | React 19, TypeScript, Vite, Tailwind CSS, Recharts, Framer Motion, Lucide Icons | Responsive supervisor dashboard, live video scrubbers, telemetry charts, and analytics |
| **Backend API** | Python 3.13, FastAPI, Uvicorn, SQLAlchemy ORM, Pydantic v2 | High-throughput REST API, WebSocket streams, and business logic |
| **Computer Vision** | Ultralytics YOLO11s, ByteTrack, Roboflow Universe REST API, OpenCV | Multi-class object perception, bounding box localization, and trajectory tracking |
| **Kinematics Engine** | Temporal sliding window analysis, impulse calculation ($F = m \cdot \Delta v / \Delta t$) | Rule-based kinematic anomaly and risk score calculation |
| **Generative AI** | Google Gemini 2.5 Flash (`google-genai` / REST) | Retrieval-Augmented Generation (RAG) incident explanation and supervisor chat |
| **Database** | SQLite (Local Dev) / Supabase PostgreSQL (Production) | Relational event storage, facility hierarchies, and audit logging |
| **Hosting & Cloud** | Vercel (Frontend), Render (FastAPI Backend), Supabase (PostgreSQL) | Scalable, multi-tenant cloud deployment |

---

## 📦 10 Predefined Warehouse Behaviors Evaluated

| # | Behavior Scenario | Category | Risk Level | Primary Kinematic Trigger |
| :-: | :--- | :--- | :-: | :--- |
| **1** | **Product Dropping** | Freefall & Impact | Critical | Vertical drop acceleration $a_y > 9.8\text{ m/s}^2$ |
| **2** | **Dragging Cartons on Floor** | Surface Friction | High | Sustained horizontal velocity $v_x > 1.2\text{ m/s}$ on floor |
| **3** | **Heavy-on-Light Stacking** | Hierarchy | Critical | Higher-density item placed above low-density packaging |
| **4** | **Unstable Stacking** | Load Balance | High | Stack verticality deviation angle $\theta > 15^\circ$ |
| **5** | **Throwing / Tossed Products** | Kinetic Impulse | Critical | High parabolic trajectory velocity |
| **6** | **Stepping / Standing on Packages** | Crush Hazard | Critical | Direct worker contact bounding box atop carton surface |
| **7** | **Off-Orientation Stacking** | Orientation | Medium | Aspect ratio inversion contrary to label arrows |
| **8** | **Strap Pulling / Misuse** | Improper Tool | High | Tensile pulling on non-load-bearing strapping bands |
| **9** | **Pallet Overhang** | Geometry Spacing | High | Product bbox extends $> 10\%$ beyond pallet boundary |
| **10** | **Rough Conveyor Handling** | Process | High | High-frequency acceleration shocks during transfers |

---

## 🚀 Quick Start & Local Setup

### 1. Prerequisites
* **Node.js** v18.0 or higher
* **Python** 3.10 to 3.13
* **Git**

### 2. Backend Setup
```bash
# Navigate to backend directory
cd backend

# Create and activate Python virtual environment
python -m venv venv
# On Windows:
venv\Scripts\activate
# On Linux/macOS:
source venv/bin/activate

# Install dependencies
pip install -r requirements.txt

# Create .env file from template
cp .env.example .env

# (Optional) Add your Google Gemini API key to .env:
# GEMINI_API_KEY=your_gemini_api_key_here
# GEMINI_MODEL=gemini-2.5-flash

# Seed database with sample loading bays & incident fixtures
python seed_database.py

# Start FastAPI server
python app/main.py
```
> **Backend Server running at**: `http://localhost:8000`  
> **API Docs & Swagger**: `http://localhost:8000/docs`  
> **Root Config Dashboard**: `http://localhost:8000/`

---

### 3. Frontend Setup
```bash
# Open a new terminal and navigate to frontend directory
cd frontend

# Install Node modules
npm install

# Start Vite development server
npm run dev
```
> **Frontend Web App running at**: `http://localhost:5173`

---

## 🌐 Production Deployment Guide

### A. Database Deployment (Supabase PostgreSQL)
1. Create a free project on [Supabase](https://supabase.com).
2. Copy the **PostgreSQL Connection String** (`postgresql://postgres:[PASSWORD]@[HOST]:5432/postgres`).
3. Set `DATABASE_URL` in your backend environment variables. The SQLAlchemy ORM automatically configures PostgreSQL pooling.

### B. Backend Deployment (Render)
1. Link your GitHub repository to [Render](https://render.com).
2. Create a new **Web Service**:
   * **Root Directory**: `backend`
   * **Build Command**: `pip install -r requirements.txt`
   * **Start Command**: `uvicorn app.main:app --host 0.0.0.0 --port $PORT`
3. Add Environment Variables:
   * `DATABASE_URL`: Your Supabase connection URI
   * `GEMINI_API_KEY`: Your Google AI Studio API key
   * `GEMINI_MODEL`: `gemini-2.5-flash`
   * `ROBOFLOW_API_KEY`: Your Roboflow API key (optional)
   * `SECRET_KEY`: A secure random secret string

### C. Frontend Deployment (Vercel)
1. Link your GitHub repository to [Vercel](https://vercel.com).
2. Configure project settings:
   * **Root Directory**: `frontend`
   * **Framework Preset**: Vite
   * **Build Command**: `npm run build`
   * **Output Directory**: `dist`
3. Add Environment Variables:
   * `VITE_API_URL`: Your live Render backend URL (e.g. `https://warehouse-backend.onrender.com`)

---

## 🧪 Testing & Validation

```bash
# Run backend test suite
cd backend
pytest tests/ -v

# Run frontend build & TypeScript checks
cd frontend
npm run build
```

---

## 📁 Repository Structure

```text
Warehouse-Intelligence-Platform/
├── backend/
│   ├── app/
│   │   ├── api/             # FastAPI REST endpoints (bays, events, assistant, config)
│   │   ├── core/            # JWT authentication & security
│   │   ├── db/              # SQLAlchemy models, database setup & seeds
│   │   ├── integrations/    # Google Gemini 2.5 client & Roboflow client
│   │   ├── schemas/         # Pydantic validation models
│   │   ├── services/        # Kinematics engine, video processor & WebSockets
│   │   ├── config.py        # Settings with python-dotenv auto-load
│   │   └── main.py          # FastAPI application & Root Dashboard
│   ├── requirements.txt     # Python dependencies
│   ├── seed_database.py     # Database seeder script
│   └── test_api.py          # API verification test
├── frontend/
│   ├── src/
│   │   ├── api/             # API client with VITE_API_URL routing
│   │   ├── components/      # UI components (VideoPlayer, RiskTimeline, Ingestion)
│   │   ├── pages/           # Dashboard, LiveMonitoring, Incident, BehaviourLibrary
│   │   └── types/           # Dynamic telemetry and data models
│   ├── package.json         # Frontend package configuration
│   └── vite.config.ts       # Vite build & development proxy setup
├── PRD.md                   # Complete Product Requirements Document
├── README.md                # Project documentation & setup guide
└── evidence/                # Acceptance testing reports & metrics
```

---

## 📄 License & Attribution

Developed for **Warehouse Handling Operational Safety & AI Video Intelligence**. Powered by Google Gemini 2.5 Flash, Ultralytics YOLO11, and FastAPI.
