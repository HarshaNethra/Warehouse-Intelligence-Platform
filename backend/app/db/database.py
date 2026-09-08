import sqlite3
from contextlib import contextmanager
from typing import Generator
from app.config import DB_PATH

def init_db() -> None:
    """Initialize SQLite database tables if they do not exist."""
    DB_PATH.parent.mkdir(parents=True, exist_ok=True)
    with get_db() as conn:
        cursor = conn.cursor()
        
        # Videos table
        cursor.execute("""
            CREATE TABLE IF NOT EXISTS videos (
                video_id TEXT PRIMARY KEY,
                filename TEXT,
                fps REAL DEFAULT 30.0,
                frame_count INTEGER DEFAULT 0,
                width INTEGER DEFAULT 1920,
                height INTEGER DEFAULT 1080,
                duration REAL DEFAULT 0.0,
                status TEXT DEFAULT 'processed',
                created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
            );
        """)

        # Events table matching PRD schema
        cursor.execute("""
            CREATE TABLE IF NOT EXISTS events (
                event_id TEXT PRIMARY KEY,
                video_id TEXT NOT NULL,
                timestamp REAL NOT NULL,
                camera_id TEXT,
                bay_id TEXT,
                object_id INTEGER,
                behaviour TEXT NOT NULL,
                risk_score REAL NOT NULL,
                risk_level TEXT NOT NULL,
                description TEXT,
                reason TEXT,
                tags TEXT, -- JSON array string, e.g. '["safety", "drop"]'
                evidence_frame TEXT,
                video_reference TEXT,
                recommended_action TEXT,
                created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
                FOREIGN KEY (video_id) REFERENCES videos(video_id)
            );
        """)

        # Chat history table for Assistant RAG queries
        cursor.execute("""
            CREATE TABLE IF NOT EXISTS chat_history (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                session_id TEXT,
                role TEXT NOT NULL,
                content TEXT NOT NULL,
                source_events TEXT, -- JSON array of referenced event_ids
                created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
            );
        """)
        conn.commit()

@contextmanager
def get_db() -> Generator[sqlite3.Connection, None, None]:
    """Provide a transactional scope around a series of operations."""
    conn = sqlite3.connect(str(DB_PATH), check_same_thread=False)
    conn.row_factory = sqlite3.Row
    try:
        yield conn
    finally:
        conn.close()
