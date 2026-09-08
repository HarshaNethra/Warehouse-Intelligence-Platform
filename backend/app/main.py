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
