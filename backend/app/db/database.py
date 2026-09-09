import os
import urllib.parse
import logging
from sqlalchemy import create_engine, text, event
from sqlalchemy.orm import declarative_base, sessionmaker
from app.config import settings

logger = logging.getLogger(__name__)


def sanitize_database_url(url: str) -> str:
    """
    Normalizes database URLs, automatically URL-encoding special characters (like @) in passwords.
    """
    url = str(url).strip().strip("'\"")
    if url.startswith("postgres://"):
        url = url.replace("postgres://", "postgresql://", 1)

    if "://" in url and not url.lower().startswith("sqlite"):
        try:
            prefix, rest = url.split("://", 1)
            if "@" in rest:
                auth_part, host_part = rest.rsplit("@", 1)
                if ":" in auth_part:
                    user, pwd = auth_part.split(":", 1)
                    # Decode first to avoid double encoding, then encode properly
                    unquoted_pwd = urllib.parse.unquote(pwd)
                    encoded_pwd = urllib.parse.quote_plus(unquoted_pwd)
                    url = f"{prefix}://{user}:{encoded_pwd}@{host_part}"
        except Exception as err:
            logger.warning(f"Could not sanitize DATABASE_URL: {err}")

    return url


def create_resilient_engine():
    """
    Creates a SQLAlchemy engine with resilient connection handling.
    Supports Supabase PostgreSQL (with PgBouncer) and falls back to SQLite.
    """
    raw_url = sanitize_database_url(settings.DATABASE_URL or "sqlite:///./warehouse.db")

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
