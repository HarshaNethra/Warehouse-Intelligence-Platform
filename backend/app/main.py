import sys
from pathlib import Path

# Ensure backend directory is in sys.path so 'app' package is always resolvable
backend_dir = Path(__file__).resolve().parent.parent
if str(backend_dir) not in sys.path:
    sys.path.insert(0, str(backend_dir))

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from app.config import settings
from app.db.database import engine, Base, SessionLocal
from app.db.seed import init_db
from app.api import health, videos, events, analytics, assistant, routes, auth, ml_metrics, facilities, safety_rules
from app.services.websocket_manager import ws_router

from fastapi.staticfiles import StaticFiles

# Create database tables
Base.metadata.create_all(bind=engine)

# Auto-seed default facility and demo user accounts on startup
try:
    with SessionLocal() as db:
        init_db(db)
except Exception as e:
    print(f"[Main] Auto-seed error/warning: {e}")

app = FastAPI(title=settings.TITLE, version=settings.VERSION)

# Mount static videos folder if available
godrej_videos_dir = backend_dir.parent.parent / "Godrej" / "videos"
if godrej_videos_dir.exists():
    app.mount("/static/videos", StaticFiles(directory=str(godrej_videos_dir)), name="videos")

# Configure CORS for the frontend
app.add_middleware(
    CORSMiddleware,
    allow_origins=settings.CORS_ORIGINS,
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

from fastapi import Request
from fastapi.responses import HTMLResponse, Response, JSONResponse
from pydantic import BaseModel
from typing import Optional
from app.integrations.gemini_client import gemini_client
from app.services.roboflow_service import roboflow_service

class KeyUpdateRequest(BaseModel):
    gemini_api_key: Optional[str] = None
    roboflow_api_key: Optional[str] = None
    model_engine: Optional[str] = None
    gemini_model: Optional[str] = None

def update_env_file(updates: dict):
    env_path = backend_dir / ".env"
    lines = []
    if env_path.exists():
        lines = env_path.read_text(encoding="utf-8").splitlines()
    
    existing_keys = set()
    new_lines = []
    for line in lines:
        stripped = line.strip()
        if stripped and not stripped.startswith("#") and "=" in stripped:
            k = stripped.split("=", 1)[0].strip()
            if k in updates and updates[k] is not None:
                new_lines.append(f"{k}={updates[k]}")
                existing_keys.add(k)
                continue
        new_lines.append(line)
        
    for k, v in updates.items():
        if k not in existing_keys and v is not None:
            new_lines.append(f"{k}={v}")
            
    env_path.write_text("\n".join(new_lines) + "\n", encoding="utf-8")

@app.post("/api/config/keys", tags=["config"])
async def save_api_keys(payload: KeyUpdateRequest):
    env_updates = {}
    
    # Update Gemini Key
    if payload.gemini_api_key is not None:
        key_val = payload.gemini_api_key.strip()
        settings.GEMINI_API_KEY = key_val
        gemini_client._api_key = key_val
        env_updates["GEMINI_API_KEY"] = key_val
        
    if payload.gemini_model is not None and payload.gemini_model.strip():
        m_val = payload.gemini_model.strip()
        settings.GEMINI_MODEL = m_val
        gemini_client.model = m_val
        env_updates["GEMINI_MODEL"] = m_val
        
    # Update Roboflow Key & Engine
    if payload.roboflow_api_key is not None:
        rf_val = payload.roboflow_api_key.strip()
        settings.ROBOFLOW_API_KEY = rf_val
        roboflow_service.api_key = rf_val
        env_updates["ROBOFLOW_API_KEY"] = rf_val
        
    if payload.model_engine in ["LOCAL_YOLO11", "ROBOFLOW_HOSTED"]:
        settings.MODEL_ENGINE = payload.model_engine
        roboflow_service.engine = payload.model_engine
        env_updates["MODEL_ENGINE"] = payload.model_engine

    # Save to .env file
    try:
        update_env_file(env_updates)
    except Exception as e:
        print(f"[Main] Error writing to .env: {e}")
        
    # Verify connections
    gemini_ok = gemini_client.is_configured()
    roboflow_status = roboflow_service.get_status()
    
    return {
        "status": "success",
        "message": "API keys successfully updated and persisted to .env!",
        "gemini_configured": gemini_ok,
        "gemini_model": settings.GEMINI_MODEL,
        "roboflow_status": roboflow_status["connection_status"],
        "model_engine": settings.MODEL_ENGINE
    }

# Root status page for localhost:8000
@app.get("/", response_class=HTMLResponse, tags=["status"])
async def root_status():
    gemini_configured = gemini_client.is_configured()
    roboflow_configured = bool(roboflow_service.api_key and roboflow_service.api_key.strip())
    rf_status = roboflow_service.get_status()
    masked_gemini = f"••••••••{settings.GEMINI_API_KEY[-4:]}" if len(settings.GEMINI_API_KEY) > 8 else ("(Configured)" if gemini_configured else "Not Configured")
    masked_roboflow = rf_status.get("api_key_masked") or ("Not Configured" if not roboflow_configured else "(Configured)")

    return f"""
    <!DOCTYPE html>
    <html lang="en">
    <head>
        <meta charset="UTF-8">
        <meta name="viewport" content="width=device-width, initial-scale=1.0">
        <title>{settings.TITLE} - Server Status & Keys Control</title>
        <link rel="preconnect" href="https://fonts.googleapis.com">
        <link href="https://fonts.googleapis.com/css2?family=Plus+Jakarta+Sans:wght@400;500;600;700;800&family=JetBrains+Mono:wght@500;600;700&display=swap" rel="stylesheet">
        <style>
            * {{ margin: 0; padding: 0; box-sizing: border-box; }}
            body {{
                font-family: 'Plus Jakarta Sans', -apple-system, BlinkMacSystemFont, sans-serif;
                background: linear-gradient(135deg, #0b0f19 0%, #111827 50%, #0f172a 100%);
                color: #f8fafc;
                min-height: 100vh;
                display: flex;
                align-items: center;
                justify-content: center;
                padding: 32px 16px;
            }}
            .container {{
                max-width: 680px;
                width: 100%;
                display: flex;
                flex-direction: column;
                gap: 20px;
            }}
            .card {{
                background: rgba(30, 41, 59, 0.75);
                backdrop-filter: blur(20px);
                border: 1px solid rgba(255, 255, 255, 0.1);
                border-radius: 20px;
                padding: 32px;
                box-shadow: 0 25px 50px -12px rgba(0, 0, 0, 0.5), 0 0 40px rgba(59, 130, 246, 0.08);
            }}
            .header {{
                display: flex;
                align-items: center;
                justify-content: space-between;
                margin-bottom: 20px;
                flex-wrap: wrap;
                gap: 12px;
            }}
            .badge {{
                display: inline-flex;
                align-items: center;
                gap: 8px;
                background: rgba(16, 185, 129, 0.15);
                border: 1px solid rgba(16, 185, 129, 0.3);
                color: #34d399;
                padding: 6px 14px;
                border-radius: 9999px;
                font-size: 12px;
                font-weight: 700;
                letter-spacing: 0.5px;
            }}
            .dot {{
                width: 8px;
                height: 8px;
                background: #10b981;
                border-radius: 50%;
                box-shadow: 0 0 10px #10b981;
                animation: pulse 2s infinite;
            }}
            @keyframes pulse {{
                0%, 100% {{ opacity: 1; transform: scale(1); }}
                50% {{ opacity: 0.4; transform: scale(0.85); }}
            }}
            h1 {{
                font-size: 22px;
                font-weight: 800;
                color: #ffffff;
                letter-spacing: -0.5px;
                margin-bottom: 4px;
            }}
            p.sub {{
                color: #94a3b8;
                font-size: 13px;
            }}
            .grid {{
                display: grid;
                grid-template-columns: 1fr 1fr;
                gap: 10px;
                margin: 20px 0;
            }}
            .metric {{
                background: rgba(15, 23, 42, 0.6);
                border: 1px solid rgba(255, 255, 255, 0.06);
                padding: 12px 14px;
                border-radius: 12px;
            }}
            .metric-title {{
                font-size: 11px;
                text-transform: uppercase;
                letter-spacing: 0.5px;
                color: #64748b;
                font-weight: 700;
                margin-bottom: 4px;
            }}
            .metric-val {{
                font-size: 13px;
                font-family: 'JetBrains Mono', monospace;
                color: #e2e8f0;
                font-weight: 600;
                display: flex;
                align-items: center;
                gap: 6px;
            }}
            .status-pill {{
                font-size: 10px;
                padding: 2px 8px;
                border-radius: 4px;
                font-weight: 700;
            }}
            .pill-green {{ background: rgba(16, 185, 129, 0.2); color: #34d399; border: 1px solid rgba(16, 185, 129, 0.4); }}
            .pill-amber {{ background: rgba(245, 158, 11, 0.2); color: #fbbf24; border: 1px solid rgba(245, 158, 11, 0.4); }}
            
            /* Form Styles */
            .form-section {{
                margin-top: 24px;
                padding-top: 20px;
                border-top: 1px solid rgba(255, 255, 255, 0.08);
            }}
            .section-title {{
                font-size: 14px;
                font-weight: 700;
                color: #f1f5f9;
                margin-bottom: 14px;
                display: flex;
                align-items: center;
                gap: 8px;
            }}
            .field {{
                margin-bottom: 14px;
            }}
            label {{
                display: block;
                font-size: 12px;
                font-weight: 600;
                color: #cbd5e1;
                margin-bottom: 6px;
            }}
            input[type="text"], input[type="password"], select {{
                width: 100%;
                background: rgba(15, 23, 42, 0.8);
                border: 1px solid rgba(255, 255, 255, 0.12);
                border-radius: 8px;
                padding: 10px 14px;
                font-size: 13px;
                color: #f8fafc;
                font-family: 'JetBrains Mono', monospace;
                outline: none;
                transition: border-color 0.2s;
            }}
            input:focus, select:focus {{
                border-color: #3b82f6;
                box-shadow: 0 0 0 2px rgba(59, 130, 246, 0.2);
            }}
            .submit-btn {{
                width: 100%;
                background: linear-gradient(135deg, #3b82f6 0%, #2563eb 100%);
                color: #ffffff;
                border: none;
                padding: 12px;
                border-radius: 8px;
                font-size: 13px;
                font-weight: 700;
                cursor: pointer;
                transition: all 0.2s;
                margin-top: 6px;
            }}
            .submit-btn:hover {{
                box-shadow: 0 4px 16px rgba(37, 99, 235, 0.4);
                transform: translateY(-1px);
            }}
            #toast {{
                display: none;
                padding: 12px;
                border-radius: 8px;
                font-size: 12px;
                font-weight: 600;
                margin-bottom: 14px;
            }}
            .toast-success {{ background: rgba(16, 185, 129, 0.2); border: 1px solid #10b981; color: #6ee7b7; }}
            .toast-error {{ background: rgba(239, 68, 68, 0.2); border: 1px solid #ef4444; color: #fca5a5; }}

            .actions {{
                display: flex;
                gap: 10px;
                margin-top: 16px;
            }}
            .btn {{
                flex: 1;
                display: flex;
                align-items: center;
                justify-content: center;
                gap: 6px;
                padding: 10px 14px;
                border-radius: 8px;
                font-size: 12px;
                font-weight: 600;
                text-decoration: none;
                transition: all 0.2s ease;
            }}
            .btn-secondary {{
                background: rgba(51, 65, 85, 0.6);
                border: 1px solid rgba(255, 255, 255, 0.08);
                color: #cbd5e1;
            }}
            .btn-secondary:hover {{
                background: rgba(51, 65, 85, 0.9);
                color: #ffffff;
            }}
        </style>
    </head>
    <body>
        <div class="container">
            <div class="card">
                <div class="header">
                    <div>
                        <h1>{settings.TITLE}</h1>
                        <p class="sub">Godrej Warehouse Field Intelligence Server</p>
                    </div>
                    <span class="badge"><span class="dot"></span> BACKEND LIVE</span>
                </div>

                <div class="grid">
                    <div class="metric">
                        <div class="metric-title">Gemini AI Status</div>
                        <div class="metric-val">
                            <span class="status-pill {'pill-green' if gemini_configured else 'pill-amber'}">
                                {'CONFIGURED' if gemini_configured else 'MISSING'}
                            </span>
                            <span style="font-size: 11px; color: #94a3b8;">{masked_gemini}</span>
                        </div>
                    </div>
                    <div class="metric">
                        <div class="metric-title">Roboflow Cloud Vision</div>
                        <div class="metric-val">
                            <span class="status-pill {'pill-green' if rf_status['connection_status'] == 'ONLINE' else 'pill-amber'}">
                                {rf_status['connection_status']}
                            </span>
                            <span style="font-size: 11px; color: #94a3b8;">{masked_roboflow}</span>
                        </div>
                    </div>
                    <div class="metric">
                        <div class="metric-title">Inference Engine Mode</div>
                        <div class="metric-val" style="color: #a78bfa;">{settings.MODEL_ENGINE}</div>
                    </div>
                    <div class="metric">
                        <div class="metric-title">Gemini Model</div>
                        <div class="metric-val" style="color: #60a5fa;">{settings.GEMINI_MODEL}</div>
                    </div>
                </div>

                <!-- Interactive API Key Manager Form -->
                <div class="form-section">
                    <div class="section-title">🔑 Configure API Keys & Cloud AI Credentials</div>
                    
                    <div id="toast"></div>

                    <form id="keyForm">
                        <div class="field">
                            <label>Google Gemini API Key</label>
                            <input type="password" id="geminiKey" placeholder="Paste key (e.g. AIzaSy...)" value="{settings.GEMINI_API_KEY}" />
                        </div>
                        <div class="field">
                            <label>Roboflow Private API Key</label>
                            <input type="password" id="roboflowKey" placeholder="Paste Roboflow key (e.g. rf_...)" value="{settings.ROBOFLOW_API_KEY}" />
                        </div>
                        <div class="field">
                            <label>Vision Detection Engine Target</label>
                            <select id="engineSelect">
                                <option value="ROBOFLOW_HOSTED" {'selected' if settings.MODEL_ENGINE == 'ROBOFLOW_HOSTED' else ''}>ROBOFLOW_HOSTED (Cloud Web REST API)</option>
                                <option value="LOCAL_YOLO11" {'selected' if settings.MODEL_ENGINE == 'LOCAL_YOLO11' else ''}>LOCAL_YOLO11 (Edge Local Inference)</option>
                            </select>
                        </div>
                        <button type="submit" class="submit-btn" id="saveBtn">Save & Apply API Keys</button>
                    </form>
                </div>

                <div class="actions">
                    <a href="http://localhost:5173" target="_blank" class="btn btn-secondary">
                        <span>Frontend React Dashboard ↗</span>
                    </a>
                    <a href="/docs" target="_blank" class="btn btn-secondary">
                        <span>Swagger Docs (/docs) ↗</span>
                    </a>
                    <a href="/api/health" target="_blank" class="btn btn-secondary">
                        <span>Health JSON ↗</span>
                    </a>
                </div>
            </div>
        </div>

        <script>
            document.getElementById('keyForm').addEventListener('submit', async (e) => {{
                e.preventDefault();
                const btn = document.getElementById('saveBtn');
                const toast = document.getElementById('toast');
                btn.disabled = true;
                btn.innerText = 'Saving and Testing Keys...';
                
                try {{
                    const payload = {{
                        gemini_api_key: document.getElementById('geminiKey').value,
                        roboflow_api_key: document.getElementById('roboflowKey').value,
                        model_engine: document.getElementById('engineSelect').value,
                        gemini_model: 'gemini-2.5-flash'
                    }};
                    
                    const res = await fetch('/api/config/keys', {{
                        method: 'POST',
                        headers: {{ 'Content-Type': 'application/json' }},
                        body: JSON.stringify(payload)
                    }});
                    
                    const data = await res.json();
                    toast.className = 'toast-success';
                    toast.innerText = '✅ ' + data.message + ' (Gemini: ' + (data.gemini_configured ? 'Online' : 'Pending') + ', Roboflow: ' + data.roboflow_status + ')';
                    toast.style.display = 'block';
                    
                    setTimeout(() => {{ window.location.reload(); }}, 1500);
                }} catch (err) {{
                    toast.className = 'toast-error';
                    toast.innerText = '❌ Failed to save keys: ' + err.message;
                    toast.style.display = 'block';
                }} finally {{
                    btn.disabled = false;
                    btn.innerText = 'Save & Apply API Keys';
                }}
            }});
        </script>
    </body>
    </html>
    """

@app.get("/favicon.ico", include_in_schema=False)
async def favicon():
    return Response(status_code=204)

app.include_router(health.router, prefix=settings.API_PREFIX, tags=["health"])
app.include_router(auth.router, prefix=settings.API_PREFIX, tags=["auth"])
app.include_router(facilities.router, prefix=settings.API_PREFIX, tags=["facilities"])
app.include_router(safety_rules.router, prefix=settings.API_PREFIX, tags=["safety_rules"])
app.include_router(videos.router, prefix=settings.API_PREFIX, tags=["videos"])
app.include_router(events.router, prefix=settings.API_PREFIX, tags=["events"])
app.include_router(analytics.router, prefix=settings.API_PREFIX, tags=["analytics"])
app.include_router(assistant.router, prefix=settings.API_PREFIX, tags=["assistant"])
app.include_router(ml_metrics.router, prefix=f"{settings.API_PREFIX}/ml", tags=["ml"])
app.include_router(ml_metrics.router, prefix=settings.API_PREFIX, tags=["ml"])
app.include_router(routes.router, prefix=settings.API_PREFIX, tags=["routes"])
app.include_router(ws_router, tags=["websocket"])

if __name__ == "__main__":
    import uvicorn
    uvicorn.run("app.main:app", host=settings.HOST, port=settings.PORT, reload=True)


