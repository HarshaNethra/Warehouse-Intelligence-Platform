import os
import logging
from sqlalchemy import create_engine, text
from sqlalchemy.orm import declarative_base, sessionmaker
from app.config import settings

logger = logging.getLogger(__name__)

def create_resilient_engine():
    raw_url = str(settings.DATABASE_URL or 'sqlite:///./warehouse.db').strip()
    if raw_url.startswith('postgres://'):
        raw_url = raw_url.replace('postgres://', 'postgresql://', 1)

    connect_args = {'check_same_thread': False} if 'sqlite' in raw_url else {}
    
    try:
        eng = create_engine(raw_url, connect_args=connect_args, pool_pre_ping=True)
        with eng.connect() as conn:
            conn.execute(text('SELECT 1'))
        db_target = raw_url.split('@')[-1] if '@' in raw_url else 'SQLite'
        print(f'[Database] Connected to database: {db_target}')
        return eng
    except Exception as e:
        print(f'[Database] Primary connection notice ({e}). Running with SQLite storage.')
        fallback_url = 'sqlite:///./warehouse.db'
        eng = create_engine(fallback_url, connect_args={'check_same_thread': False}, pool_pre_ping=True)
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
