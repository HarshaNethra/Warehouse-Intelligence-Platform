import os
from pathlib import Path
from typing import List

# Base directory: Warehouse-Intelligence-Platform root or backend root
BACKEND_DIR = Path(__file__).resolve().parent.parent
BASE_DIR = BACKEND_DIR.parent

# Database configuration
DATA_DIR = BACKEND_DIR / "data"
DATA_DIR.mkdir(parents=True, exist_ok=True)
DB_PATH = DATA_DIR / "warehouse.db"
DATABASE_URL = os.getenv("DATABASE_URL", f"sqlite:///{DB_PATH}")

# Claude / Anthropic API configuration
CLAUDE_API_KEY = os.getenv("CLAUDE_API_KEY") or os.getenv("ANTHROPIC_API_KEY", "")
CLAUDE_MODEL = os.getenv("CLAUDE_MODEL", "claude-3-5-sonnet-20241022")

# Video storage path
VIDEO_STORAGE_PATH = os.getenv("VIDEO_STORAGE_PATH", str(BASE_DIR / "data" / "raw"))

# CORS origins - restricted to trusted development and deployment origins
_env_cors = os.getenv("CORS_ORIGINS")
CORS_ORIGINS: List[str] = [origin.strip() for origin in _env_cors.split(",")] if _env_cors else [
    "http://localhost:5173",
    "http://127.0.0.1:5173",
    "http://localhost:3000",
    "http://127.0.0.1:3000",
]
