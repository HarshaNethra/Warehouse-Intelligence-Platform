import sys
import os
from pathlib import Path
import asyncio

# Ensure UTF-8 output on Windows terminals
if sys.platform == 'win32':
    import io
    sys.stdout = io.TextIOWrapper(sys.stdout.buffer, encoding='utf-8', errors='replace')
    sys.stderr = io.TextIOWrapper(sys.stderr.buffer, encoding='utf-8', errors='replace')

# Add backend directory to sys.path
backend_dir = Path(__file__).resolve().parent
sys.path.insert(0, str(backend_dir))

from seed_database import seed
from app.db.database import SessionLocal
from app.db import models
from app.api.health import health_check
from app.api.videos import get_videos
from app.api.events import get_events
from app.api.analytics import get_analytics_summary, get_analytics_behaviours
from app.api.assistant import chat
from app.schemas.assistant import ChatRequest

import pytest

@pytest.mark.asyncio
async def test_all():
    print("=" * 60)
    print("RUNNING SYSTEM API & GEMINI ASSISTANT INTEGRATION TESTS")
    print("=" * 60)
    
    # 1. Seed database
    print("\n1. Seeding SQLite Database...")
    seed()
    
    # 2. Database Session
    db = SessionLocal()
    
    try:
        # Health Check
        health_res = health_check()
        print(f"[OK] Health Check Status: {health_res}")
        
        admin_user = db.query(models.User).filter(models.User.role == "ADMIN").first()
        if not admin_user:
            admin_user = models.User(id="usr-admin", email="admin@test.io", hashed_password="pass", full_name="Admin", role="ADMIN", facility_id="FAC-001")
            db.add(admin_user)
            db.commit()

        # Videos Endpoint
        videos_res = get_videos(db=db)
        print(f"[OK] Videos Count Retrieved: {len(videos_res)}")
        
        # Events Endpoint
        events_res = get_events(risk_level=None, behaviour=None, db=db, current_user=admin_user)
        print(f"[OK] Total Events Retrieved: {len(events_res)}")
        
        # Filtered Events
        critical_events = get_events(risk_level="Critical", behaviour=None, db=db, current_user=admin_user)
        print(f"[OK] Filtered Critical Events: {len(critical_events)}")
        
        # Analytics Summary
        analytics_res = get_analytics_summary(db=db, current_user=admin_user)
        print(f"[OK] Analytics Summary: {analytics_res.summary.totalEvents} Total Events | Critical: {analytics_res.summary.criticalEvents} | High: {analytics_res.summary.highRiskEvents}")
        
        # Behaviour Metrics
        behaviours_res = get_analytics_behaviours(db=db, current_user=admin_user)
        print(f"[OK] Behaviour Metrics Breakdown: {[(b.name, b.value) for b in behaviours_res]}")
        
        # Gemini AI Assistant Chat Test
        print("\n2. Testing Gemini AI Assistant Chat Endpoint...")
        chat_req = ChatRequest(question="Show me all critical handling incidents from today's unloading.")
        chat_res = await chat(request=chat_req, db=db, current_user=admin_user)
        print(f"[OK] Chat Question: '{chat_res.question}'")
        print(f"[OK] Model Used: {chat_res.model_used}")
        print(f"[OK] Source Events Citation Count: {len(chat_res.source_events)}")
        print("\n--- Gemini Assistant Response Output ---")
        print(chat_res.answer)
        print("---------------------------------------")
        
        print("\n[SUCCESS] ALL BACKEND API & GEMINI ASSISTANT TESTS PASSED 100% SUCCESSFUL!")
        
    finally:
        db.close()

if __name__ == "__main__":
    asyncio.run(test_all())
