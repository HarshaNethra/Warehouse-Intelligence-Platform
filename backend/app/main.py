from contextlib import asynccontextmanager
from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from app.config import CORS_ORIGINS
from app.db.database import init_db
from app.db.seed_data import seed_database_if_empty
from app.api.health import router as health_router
from app.api.videos import router as videos_router
from app.api.events import router as events_router
from app.api.analytics import router as analytics_router
from app.api.assistant import router as assistant_router

@asynccontextmanager
async def lifespan(app: FastAPI):
    # Initialize SQLite database and tables
    init_db()
    # Seed default data if database is empty
    seed_database_if_empty()
    yield

app = FastAPI(
    title="Warehouse Intelligence Platform API",
    description="Backend API powering video intelligence, behaviour detection, risk scoring, and grounded AI assistant.",
    version="1.0.0",
    lifespan=lifespan
)

# CORS Configuration
app.add_middleware(
    CORSMiddleware,
    allow_origins=CORS_ORIGINS,
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# Register routers under /api
app.include_router(health_router, prefix="/api")
app.include_router(videos_router, prefix="/api")
app.include_router(events_router, prefix="/api")
app.include_router(analytics_router, prefix="/api")
app.include_router(assistant_router, prefix="/api")

@app.get("/")
def root():
    return {
        "message": "Warehouse Intelligence Platform API is running.",
        "docs": "/docs",
        "health": "/api/health"
    }

if __name__ == "__main__":
    import uvicorn
    uvicorn.run("app.main:app", host="0.0.0.0", port=8000, reload=True)
