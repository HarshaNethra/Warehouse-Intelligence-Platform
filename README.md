# Warehouse Intelligence Platform

[![Frontend](https://img.shields.io/badge/Frontend-React%2019%20%2B%20TypeScript%20%2B%20Vite-blue)](frontend)
[![Backend](https://img.shields.io/badge/Backend-FastAPI%20%2B%20Python%203.13-009688)](backend)
[![Vision](https://img.shields.io/badge/Vision-Ultralytics%20YOLO11s%20%2B%20ByteTrack-orange)](cv_pipeline)
[![Rules](https://img.shields.io/badge/Engine-Behaviour%20%26%20Risk%20Engines-red)](behaviour_engine)
[![AI Assistant](https://img.shields.io/badge/GenAI-Google%20Gemini%202.5%20Flash-4285F4)](https://ai.google.dev/)
[![Database](https://img.shields.io/badge/Database-SQLite%20%2F%20PostgreSQL-336791)](backend/app/db)

An enterprise AI-powered video analytics platform that converts warehouse loading, unloading, and staging CCTV footage into real-time operational safety intelligence and proactive damage prevention.

Repository: [https://github.com/HarshaNethra/Warehouse-Intelligence-Platform](https://github.com/HarshaNethra/Warehouse-Intelligence-Platform)

---

## 🎯 Architecture Overview

The platform operates across four unified layers:

```
[ CCTV Video / Ingestion ]
            │
            ▼
[ CV Perception & Tracking (YOLO11s + ByteTrack) ] ──► data/Trajectories/
            │
            ▼
[ Behaviour Engine (10 Safety Rules) & Risk Scoring ] ──► data/Events/
            │
            ▼
[ FastAPI Backend + SQLite/Postgres DB ] ◄──► [ Google Gemini 2.5 Flash RAG ]
            │
            ▼
[ React 19 + Vite Interactive Supervisor Dashboard ]
```

### Key Modules
1. **`cv_pipeline/`**: Optical decoding, YOLO11 object detection (`person`, `carton`, `pallet`, `forklift`), and ByteTrack multi-object trajectory extraction.
2. **`behaviour_engine/`**: 10 deterministic kinematic and spatial handling rules evaluating product drops, floor dragging, heavy-on-light stacking, and rough handling.
3. **`risk_engine/`**: Physics-informed multi-factor risk scoring ($0-100$), severity classification (`Minor`, `Moderate`, `High`, `Critical`), and corrective guidance.
4. **`backend/`**: High-performance FastAPI server providing REST APIs, WebSocket live streams, database ORM, and Google Gemini RAG assistant.
5. **`frontend/`**: Enterprise-grade React + TypeScript supervisor interface with live monitoring, kinematic telemetry charts, and incident triage.
6. **`warehouse_training/`**: Dataset preparation, frame extraction, and YOLO baseline fine-tuning scripts.
7. **`main.py`**: Unified root CLI orchestrator for pipeline execution, frame inspection, and training.

---

## 📦 10 Predefined Warehouse Handling Behaviors

| # | Scenario | Category | Risk Level | Primary Kinematic / Spatial Trigger |
| :-: | :--- | :--- | :-: | :--- |
| **1** | **Product Dropping** | Freefall & Impact | Critical | Vertical drop acceleration $a_y > 9.8\text{ m/s}^2$ |
| **2** | **Dragging Cartons on Floor** | Surface Friction | High | Sustained horizontal velocity $v_x > 1.2\text{ m/s}$ on floor zone |
| **3** | **Heavy-on-Light Stacking** | Load Hierarchy | Critical | Higher-density carton stacked above crushable package |
| **4** | **Unstable Stacking** | Balance | High | Center-of-mass stack deviation angle $\theta > 15^\circ$ |
| **5** | **Throwing / Tossed Products** | Kinetic Impulse | Critical | High parabolic trajectory velocity |
| **6** | **Stepping / Standing on Packages** | Crush Hazard | Critical | Worker bounding box overlapping top surface of carton |
| **7** | **Off-Orientation Stacking** | Orientation | Medium | Aspect ratio inversion contrary to label arrows |
| **8** | **Strap Pulling / Misuse** | Improper Tool | High | Tensile pulling on non-load-bearing strapping bands |
| **9** | **Pallet Overhang** | Geometry Spacing | High | Package bounding box extends $> 10\%$ beyond pallet boundary |
| **10** | **Rough Conveyor Handling** | Process | High | High-frequency acceleration shocks during transfers |

---

## 🚀 Quick Start & Local Setup

### 1. Prerequisites
* **Python**: 3.10 to 3.13
* **Node.js**: v18.0 or higher
* **Git**

### 2. Environment Configuration
Create a `.env` file in `backend/` from the provided template:
```bash
cp backend/.env.example backend/.env
```
Configure your keys in `backend/.env`:
* `GEMINI_API_KEY`: Your Google AI Studio API key (for supervisor RAG assistant)
* `ROBOFLOW_API_KEY`: (Optional) Roboflow cloud detection key
* `ENVIRONMENT`: `development`

---

### 3. External Artifacts (Models & Videos)

To keep the git repository lightweight and fast to clone, large binary files and datasets are managed out-of-band:

* **Model Weights (`models/`)**:
  * Default trained weights: Place `best.pt` in the [`models/`](models/) directory.
  * Baseline YOLO11s: Ultralytics will automatically download `yolo11s.pt` on first inference if not locally present.
* **CCTV Videos (`videos/`)**:
  * Place canonical warehouse MP4 video clips into the [`videos/`](videos/) directory.
* **Datasets (`Logistics-2/`, `Warehouse-1/`, `MASTER_PUBLIC_V1/`)**:
  * Download public benchmark datasets using `python warehouse_training/download_datasets.py`.

---

### 4. Running the Platform

#### A. Backend API & Database
```bash
cd backend
python -m venv venv
# On Windows:
venv\Scripts\activate
# On Linux/macOS:
source venv/bin/activate

pip install -r requirements.txt
python seed_database.py
python app/main.py
```
* Backend API: `http://localhost:8000`
* Swagger Documentation: `http://localhost:8000/docs`
* Root Configuration Dashboard: `http://localhost:8000/`

#### B. Frontend Dashboard
```bash
cd frontend
npm install
npm run dev
```
* Frontend Web App: `http://localhost:5173`

#### C. Root Unified CLI (`main.py`)
From the project root:
```bash
# Run rules & risk analysis over canonical trajectories
python main.py analyze-events

# Inspect bounding boxes on a specific video frame
python main.py inspect-frame --video "Dock level, dragging cupboard.mp4" --frame 50

# Export trajectory CSVs using YOLO and ByteTrack
python main.py export-trajectories --video "Dock level, dragging cupboard.mp4"
```

---

## 🧪 Testing & Verification

```bash
# Run root test suite (86 tests)
pytest tests/ -v

# Run backend test suite (26 tests)
pytest backend/tests/ -v

# Run frontend build & type checks
cd frontend
npm run build
```

---

## 📁 Repository Structure

```text
Warehouse-Intelligence-Platform/
├── analytics/               # Frame inspection and visual verification tools
├── backend/                 # FastAPI server, SQLAlchemy DB, API endpoints, RAG
│   ├── alembic/             # Database migration scripts
│   ├── app/                 # Backend application package
│   ├── evidence/            # Audit reports and verification records
│   ├── tests/               # Backend unit and end-to-end test suite
│   ├── .env.example         # Environment variable template
│   ├── requirements.txt     # Backend Python dependencies
│   └── seed_database.py     # Database seeder
├── behaviour_engine/        # 10 canonical handling rule implementations
├── cv_pipeline/             # Trajectory extraction (YOLO11s + ByteTrack)
├── data/                    # Processed deliverables
│   ├── Events/              # Canonical event JSON and summary CSVs
│   ├── Metadata/            # Video metadata JSONs
│   └── Trajectories/        # Canonical trajectory CSVs and derived metrics
├── docs/                    # Architecture, specifications, and audit reports
├── frontend/                # React 19 + TypeScript + Vite supervisor dashboard
│   ├── src/                 # Application components, pages, hooks, contexts
│   ├── package.json         # Node dependencies and scripts
│   └── vite.config.ts       # Vite bundler configuration
├── models/                  # Placeholder for trained weights (best.pt)
├── risk_engine/             # Multi-factor risk scoring and explanation
├── scripts/                 # Test runners and DB utilities
├── tests/                   # Core engine behavioral and risk unit tests
├── videos/                  # Placeholder for canonical CCTV video files
├── warehouse_training/      # Training scripts, frame extraction, Kaggle notebooks
├── main.py                  # Master CLI entrypoint
├── PRD.md                   # Comprehensive Product Requirements Document
├── pytest.ini               # Pytest configuration
├── requirements.txt         # Root Python dependencies
└── .gitignore               # Multi-tier exclusion rules
```

---

## 📄 License & Attribution

Developed for **Warehouse Handling Operational Safety & AI Video Intelligence**.
