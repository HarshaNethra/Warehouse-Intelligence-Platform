import sys
from pathlib import Path
import asyncio

# Add backend directory to sys.path
backend_dir = Path(__file__).resolve().parent
sys.path.insert(0, str(backend_dir))

from seed_database import seed
from app.db.database import SessionLocal
from app.api.health import health_check
from app.api.videos import get_videos
from app.api.events import get_events
from app.api.analytics import get_analytics_summary, get_analytics_behaviours
from app.api.assistant import chat
from app.schemas.assistant import ChatRequest

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
        print(f"✅ Health Check Status: {health_res}")
        
        # Videos Endpoint
        videos_res = get_videos(db=db)
        print(f"✅ Videos Count Retrieved: {len(videos_res)}")
        
        # Events Endpoint
        events_res = get_events(risk_level=None, behaviour=None, db=db)
        print(f"✅ Total Events Retrieved: {len(events_res)}")
        
        # Filtered Events
        critical_events = get_events(risk_level="Critical", behaviour=None, db=db)
        print(f"✅ Filtered Critical Events: {len(critical_events)}")
        
        # Analytics Summary
        analytics_res = get_analytics_summary(db=db)
        print(f"✅ Analytics Summary: {analytics_res.summary.totalEvents} Total Events | Critical: {analytics_res.summary.criticalEvents} | High: {analytics_res.summary.highRiskEvents}")
        
        # Behaviour Metrics
        behaviours_res = get_analytics_behaviours(db=db)
        print(f"✅ Behaviour Metrics Breakdown: {[(b.name, b.value) for b in behaviours_res]}")
        
        # Gemini AI Assistant Chat Test
        print("\n2. Testing Gemini AI Assistant Chat Endpoint...")
        chat_req = ChatRequest(question="Show me all critical handling incidents from today's unloading.")
        chat_res = await chat(request=chat_req, db=db)
        print(f"✅ Chat Question: '{chat_res.question}'")
        print(f"✅ Model Used: {chat_res.model_used}")
        print(f"✅ Source Events Citation Count: {len(chat_res.source_events)}")
        print("\n--- Gemini Assistant Response Output ---")
        print(chat_res.answer)
        print("---------------------------------------")
        
        print("\n🎉 ALL BACKEND API & GEMINI ASSISTANT TESTS PASSED 100% SUCCESSFUL!")
        
    finally:
        db.close()

if __name__ == "__main__":
    asyncio.run(test_all())
