import os
import logging
from sqlalchemy import create_engine, text, event
from sqlalchemy.orm import declarative_base, sessionmaker
from app.config import settings

logger = logging.getLogger(__name__)


def create_resilient_engine():
    """
    Creates a SQLAlchemy engine with resilient connection handling.
    Supports Supabase PostgreSQL (with PgBouncer) and falls back to SQLite.
    """
    raw_url = str(settings.DATABASE_URL or "sqlite:///./warehouse.db").strip()

    # Normalize Supabase/Heroku-style postgres:// to postgresql://
    if raw_url.startswith("postgres://"):
        raw_url = raw_url.replace("postgres://", "postgresql://", 1)

    is_sqlite = "sqlite" in raw_url.lower()

    if is_sqlite:
        connect_args = {"check_same_thread": False}
        engine_kwargs = {
            "connect_args": connect_args,
            "pool_pre_ping": True,
        }
    else:
        # PostgreSQL connection pool settings optimized for Supabase PgBouncer
        engine_kwargs = {
            "pool_pre_ping": True,
            "pool_size": 5,
            "max_overflow": 10,
            "pool_recycle": 300,
            "pool_timeout": 30,
        }

    try:
        eng = create_engine(raw_url, **engine_kwargs)

        # Test the connection
        with eng.connect() as conn:
            conn.execute(text("SELECT 1"))

        db_target = raw_url.split("@")[-1].split("?")[0] if "@" in raw_url else "SQLite"
        print(f"[Database] Connected to database: {db_target}")
        return eng

    except Exception as e:
        print(f"[Database] Primary connection failed ({e}). Falling back to SQLite.")
        fallback_url = "sqlite:///./warehouse.db"
        eng = create_engine(
            fallback_url,
            connect_args={"check_same_thread": False},
            pool_pre_ping=True,
        )
        return eng


engine = create_resilient_engine()
SessionLocal = sessionmaker(autocommit=False, autoflush=False, bind=engine)

Base = declarative_base()


def get_db():
    db = SessionLocal()
    try:
        yield db
    finally:
        db.close()
