# Warehouse Intelligence Platform

The **Warehouse Intelligence Platform** is an enterprise-grade video analytics and safety monitoring solution designed for automated warehouse operations. By combining real-time computer vision (YOLO11 object detection and pose estimation), Layer C kinematic analysis, multi-tenant role-based access control (RBAC), and grounded AI operations assistance, the platform enables facility managers to proactively identify operational risks, enforce safety compliance, and streamline incident response workflows.

Repository URL: [https://github.com/HarshaNethra/Warehouse-Intelligence-Platform](https://github.com/HarshaNethra/Warehouse-Intelligence-Platform)

---

## Key Capabilities

* **Real-Time Video Intelligence**: Automated frame decoding, object detection, and multi-object tracking across operational loading bays and CCTV camera streams.
* **Kinematic Risk Engine**: Physics-based acceleration and velocity tracking over rolling frame windows to identify freefall drops, unstable package stacking, and vehicle-pedestrian proximity risks.
* **Granular Role-Based Access Control**: Multi-facility tenant isolation enforcing strict data boundaries across Operator, Supervisor, and Administrator roles.
* **Incident Lifecycle Management**: Streamlined operational workflows for acknowledging incidents, dispatching floor intervention teams, and verifying audit logs.
* **Grounded AI Operations Assistant**: Context-aware RAG querying backed strictly by authenticated facility data and verifiable event citations.
* **Real-Time Telemetry & WebSockets**: Low-latency WebSocket streaming for instant live operational alerts and telemetry metrics.

---

## Repository Structure

```text
├── backend/
│   ├── app/
│   │   ├── api/             # FastAPI REST endpoints & RBAC dependencies
│   │   ├── core/            # Security, JWT, and application configuration
│   │   ├── db/              # SQLAlchemy database models, seeders, and fixtures
│   │   ├── ml/              # Model loaders and inference pipelines
│   │   ├── schemas/         # Pydantic data schemas and validation models
│   │   └── services/        # Vision pipeline, kinematics, rule engine, & WebSockets
│   ├── tests/               # Pytest unit tests, failure injection, and Playwright E2E
│   └── requirements.txt     # Python backend dependencies
├── frontend/
│   ├── src/                 # React frontend, TypeScript components, & Tailwind CSS
│   ├── public/              # Static assets and video streams
│   └── package.json         # Node.js frontend dependencies
└── evidence/                # Independent acceptance audit reports & JSON artifacts
```

---

## Security & Data Protection Best Practices

Security and data integrity are central to the platform design. To maintain security hygiene and ensure sensitive files or credentials are never exposed:

### 1. Environment & Credentials Isolation
* **Never Commit Secrets**: Secrets, secret keys (`SECRET_KEY`), database passwords, and third-party API credentials must never be committed to source control. Use environment variables managed via a `.env` file.
* **Local `.env` Configuration**: Copy `.env.example` to `.env` for local testing. The `.env` file is explicitly ignored in `.gitignore`.
* **Token Expiration**: Access tokens are generated with strict time-to-live limits and signature verification to prevent unauthorized replay attacks.

### 2. File & Artifact Sanitization
Before pushing commits or opening pull requests, ensure the following items are excluded:
* Local SQLite database files (`*.db`, `*.sqlite`, `*.sqlite3`)
* PyTorch model weights and heavy checkpoint files (`*.pt`, `*.onnx`, `*.engine`)
* Local logs, temporary artifacts, and Python virtual environment directories (`venv/`, `.venv/`, `node_modules/`, `__pycache__/`)

### 3. Tenant Isolation & Data Governance
* Database queries strictly filter by the authenticated user's `facility_id` for non-administrative roles.
* Environment-aware database routing separates `DEVELOPMENT`, `TEST`, `DEMO`, `STAGING`, and `PRODUCTION` instances to prevent synthetic data contamination.

---

## Technical Stack

* **Backend**: Python 3.10+, FastAPI, SQLAlchemy, Pydantic v2, PyTorch, Ultralytics YOLO11, OpenCV
* **Frontend**: React 18, TypeScript, Vite, Tailwind CSS, Lucide React
* **Database & Memory**: SQLite (Development/Test) / PostgreSQL (Production), ChromaDB / Vector Store
* **Testing & Automation**: Pytest, pytest-playwright, Playwright Sync API

---

## Getting Started

### Prerequisites

* Python 3.10 or higher
* Node.js 18.0 or higher
* Git

### Backend Setup

1. **Navigate to the backend directory:**
   ```bash
   cd backend
   ```

2. **Create and activate a Python virtual environment:**
   ```bash
   python3 -m venv venv
   source venv/bin/python/activate  # On Linux/macOS
   # venv\Scripts\activate          # On Windows
   ```

3. **Install dependencies:**
   ```bash
   pip install -r requirements.txt
   ```

4. **Initialize database schema and seed default data:**
   ```bash
   python app/db/seed.py
   ```

5. **Start the backend application server:**
   ```bash
   python app/main.py
   ```
   The FastAPI server will run at `http://127.0.0.1:8000`. API documentation is available at `http://127.0.0.1:8000/docs`.

### Frontend Setup

1. **Navigate to the frontend directory:**
   ```bash
   cd frontend
   ```

2. **Install Node modules:**
   ```bash
   npm install
   ```

3. **Start the frontend development server:**
   ```bash
   npm run dev
   ```
   The Vite React application will run at `http://localhost:5173`.

---

## Testing & Quality Assurance

The codebase includes automated unit tests, failure-injection suites, and Playwright end-to-end operational tests.

### Running Backend Unit & Integration Tests

```bash
cd backend
venv/bin/pytest tests/test_kinematics_engine.py tests/test_rule_engine_mutation.py -v
```

### Running End-to-End Playwright Tests

Ensure both the backend server and frontend development server are running before launching E2E tests:

```bash
cd backend
venv/bin/pytest tests/e2e/test_supervisor_e2e_workflow.py tests/e2e/test_resilience_and_failures.py -v -s
```

---

## Contribution Protocols

We welcome contributions focused on improving system performance, enhancing safety algorithms, and strengthening security controls.

### Workflow Guidelines

1. **Fork & Branch**: Create a feature or bugfix branch off `main` using descriptive naming (`feature/kinematics-optimization` or `fix/rbac-facility-check`).
2. **Pre-Commit Security Audit**:
   * Verify that no `.env`, database file, or model weight checkpoint is included in `git status`.
   * Run local linter and unit tests to ensure all tests pass.
3. **Commit Standards**: Use clear, standard commit messages describing the rationale for changes.
4. **Pull Request Review**: Open a Pull Request detailing the changes made, verification results, and any relevant API or database schema impacts.

---

## License & Support

This project is maintained for warehouse operational safety and computer vision intelligence research. For questions, security inquiries, or contribution assistance, please visit the [GitHub repository](https://github.com/HarshaNethra/Warehouse-Intelligence-Platform).
