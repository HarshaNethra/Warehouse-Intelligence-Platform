import json
from typing import List, Optional, Dict, Any
from app.db.database import get_db

def row_to_event_dict(row) -> Dict[str, Any]:
    """Convert a database row to an Event dictionary matching the frontend schema."""
    if not row:
        return {}
    d = dict(row)
    if "tags" in d and d["tags"]:
        try:
            d["tags"] = json.loads(d["tags"])
        except Exception:
            d["tags"] = []
    else:
        d["tags"] = []
    return d

def get_all_videos() -> List[Dict[str, Any]]:
    with get_db() as conn:
        cursor = conn.cursor()
        cursor.execute("SELECT * FROM videos ORDER BY created_at DESC")
        return [dict(row) for row in cursor.fetchall()]

def get_video_by_id(video_id: str) -> Optional[Dict[str, Any]]:
    with get_db() as conn:
        cursor = conn.cursor()
        cursor.execute("SELECT * FROM videos WHERE video_id = ?", (video_id,))
        row = cursor.fetchone()
        return dict(row) if row else None

def get_events(
    risk_level: Optional[str] = None,
    behaviour: Optional[str] = None,
    bay_id: Optional[str] = None,
    camera_id: Optional[str] = None,
    search: Optional[str] = None,
    limit: int = 100,
    skip: int = 0
) -> List[Dict[str, Any]]:
    query = "SELECT * FROM events WHERE 1=1"
    params: List[Any] = []

    if risk_level:
        query += " AND LOWER(risk_level) = LOWER(?)"
        params.append(risk_level)
    if behaviour:
        # Escape SQL LIKE wildcard characters to prevent wildcard/pattern matching abuse
        escaped_behaviour = behaviour.replace('\\', '\\\\').replace('%', '\\%').replace('_', '\\_')
        query += " AND LOWER(behaviour) LIKE LOWER(?) ESCAPE '\\'"
        params.append(f"%{escaped_behaviour}%")
    if bay_id:
        query += " AND LOWER(bay_id) = LOWER(?)"
        params.append(bay_id)
    if camera_id:
        query += " AND LOWER(camera_id) = LOWER(?)"
        params.append(camera_id)
    if search:
        # Escape SQL LIKE wildcard characters to prevent pattern manipulation
        escaped_search = search.replace('\\', '\\\\').replace('%', '\\%').replace('_', '\\_')
        pattern = f"%{escaped_search}%"
        query += " AND (description LIKE ? ESCAPE '\\' OR behaviour LIKE ? ESCAPE '\\' OR reason LIKE ? ESCAPE '\\')"
        params.extend([pattern, pattern, pattern])

    query += " ORDER BY timestamp ASC LIMIT ? OFFSET ?"
    params.extend([limit, skip])

    with get_db() as conn:
        cursor = conn.cursor()
        cursor.execute(query, params)
        rows = cursor.fetchall()
        return [row_to_event_dict(row) for row in rows]

def get_event_by_id(event_id: str) -> Optional[Dict[str, Any]]:
    with get_db() as conn:
        cursor = conn.cursor()
        cursor.execute("SELECT * FROM events WHERE event_id = ?", (event_id,))
        row = cursor.fetchone()
        return row_to_event_dict(row) if row else None

def get_analytics_summary() -> Dict[str, int]:
    with get_db() as conn:
        cursor = conn.cursor()
        cursor.execute("SELECT COUNT(*) FROM events")
        total = cursor.fetchone()[0]

        cursor.execute("SELECT COUNT(*) FROM events WHERE LOWER(risk_level) = 'critical'")
        critical = cursor.fetchone()[0]

        cursor.execute("SELECT COUNT(*) FROM events WHERE LOWER(risk_level) = 'high'")
        high = cursor.fetchone()[0]

        cursor.execute("SELECT COUNT(*) FROM events WHERE LOWER(risk_level) = 'medium'")
        medium = cursor.fetchone()[0]

        cursor.execute("SELECT COUNT(*) FROM events WHERE LOWER(risk_level) = 'low'")
        low = cursor.fetchone()[0]

        return {
            "totalEvents": total,
            "criticalEvents": critical,
            "highRiskEvents": high,
            "mediumRiskEvents": medium,
            "lowRiskEvents": low,
        }

def get_behaviour_analytics() -> List[Dict[str, Any]]:
    with get_db() as conn:
        cursor = conn.cursor()
        cursor.execute("""
            SELECT behaviour as name, COUNT(*) as value, ROUND(AVG(risk_score), 1) as avg_score
            FROM events
            GROUP BY behaviour
            ORDER BY value DESC
        """)
        return [dict(row) for row in cursor.fetchall()]

def get_risk_analytics() -> List[Dict[str, Any]]:
    with get_db() as conn:
        cursor = conn.cursor()
        cursor.execute("""
            SELECT risk_level, COUNT(*) as count, ROUND(AVG(risk_score), 1) as avg_score
            FROM events
            GROUP BY risk_level
            ORDER BY CASE risk_level
                WHEN 'Critical' THEN 1
                WHEN 'High' THEN 2
                WHEN 'Medium' THEN 3
                WHEN 'Low' THEN 4
                ELSE 5
            END
        """)
        return [dict(row) for row in cursor.fetchall()]

def get_timeline_analytics() -> List[Dict[str, Any]]:
    with get_db() as conn:
        cursor = conn.cursor()
        cursor.execute("""
            SELECT timestamp, event_id, behaviour, risk_score, risk_level, bay_id
            FROM events
            ORDER BY timestamp ASC
        """)
        return [dict(row) for row in cursor.fetchall()]

def search_events_for_assistant(query: str, limit: int = 5) -> List[Dict[str, Any]]:
    """Search relevant events based on keywords in user question."""
    keywords = [w.lower() for w in query.split() if len(w) > 2]
    all_events = get_events(limit=50)
    
    scored_events = []
    for ev in all_events:
        score = 0
        text_corpus = f"{ev.get('behaviour', '')} {ev.get('description', '')} {ev.get('reason', '')} {ev.get('bay_id', '')} {ev.get('risk_level', '')}".lower()
        for kw in keywords:
            if kw in text_corpus:
                score += 1
        if score > 0 or not keywords:
            scored_events.append((score, ev))

    scored_events.sort(key=lambda x: (x[0], x[1].get("risk_score", 0)), reverse=True)
    return [ev for _, ev in scored_events[:limit]] if scored_events else all_events[:limit]

def save_chat_message(role: str, content: str, source_events: Optional[List[str]] = None, session_id: str = "default") -> None:
    safe_session = (session_id or "default")[:64]
    safe_content = content[:10000]
    with get_db() as conn:
        cursor = conn.cursor()
        cursor.execute("""
            INSERT INTO chat_history (session_id, role, content, source_events)
            VALUES (?, ?, ?, ?)
        """, (
            safe_session,
            role,
            safe_content,
            json.dumps(source_events) if source_events else None
        ))
        conn.commit()
