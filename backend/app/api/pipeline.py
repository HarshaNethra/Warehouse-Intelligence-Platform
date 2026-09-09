"""
Pipeline Ingestion API for Godrej Warehouse Intelligence Platform.

Provides high-performance endpoints for ingesting multi-object trajectory streams,
evaluating Member 2's canonical Behaviour & Risk engines, and persisting canonical
events to Project 2's database via the EventAdapter.
"""

import os
from pathlib import Path
from typing import Dict, Any, List, Optional
from fastapi import APIRouter, Depends, HTTPException, Query, BackgroundTasks
from pydantic import BaseModel, Field
from sqlalchemy.orm import Session

from app.db.database import get_db
from app.db import models
from app.api.deps import get_current_user
from app.engine.behaviour.rule_engine import RuleEngine
from app.engine.behaviour.motion import TrackPoint
from app.engine.risk.pipeline import score_and_build_events
from app.services.event_adapter import event_adapter

router = APIRouter(prefix="/pipeline", tags=["pipeline"])


class TrajectoryPointInput(BaseModel):
    frame: int
    object_id: int
    class_name: str = Field(..., alias="class")
    x: float
    y: float
    width: float
    height: float


class TrajectoryIngestRequest(BaseModel):
    video_id: str = Field(..., description="Video stem, filename, or unique identifier")
    csv_path: Optional[str] = Field(None, description="Optional path to trajectory CSV")
    fps: Optional[float] = Field(30.0, description="Video FPS (default: 30.0)")
    trajectories: Optional[List[TrajectoryPointInput]] = Field(None, description="In-memory trajectory stream")
    provenance_type: Optional[str] = Field("REAL_INFERENCE", description="Provenance marker")


def resolve_trajectories_dir() -> Path:
    """Locates the canonical data/Trajectories folder."""
    for parent in [Path.cwd(), *Path(__file__).resolve().parents]:
        cand = parent / "data" / "Trajectories"
        if cand.exists() and cand.is_dir():
            return cand
    return Path("data/Trajectories")


@router.post("/ingest-trajectories")
def ingest_trajectories(
    payload: TrajectoryIngestRequest,
    db: Session = Depends(get_db),
    current_user: models.User = Depends(get_current_user)
):
    """
    Ingests trajectory points or trajectory CSV for a warehouse video, executes Member 2
    canonical behaviour & risk engines, and persists events to the database.
    """
    clean_stem = payload.video_id.strip().strip('"').strip("'")
    if clean_stem.lower().endswith(".mp4"):
        clean_stem = clean_stem[:-4]

    engine = RuleEngine()
    tracks: Dict[int, List[TrackPoint]] = {}

    # 1. Parse from provided points if passed directly
    if payload.trajectories and len(payload.trajectories) > 0:
        for pt_in in payload.trajectories:
            pt = TrackPoint(
                frame=pt_in.frame,
                x=pt_in.x,
                y=pt_in.y,
                width=pt_in.width,
                height=pt_in.height,
                class_name=pt_in.class_name
            )
            tracks.setdefault(pt_in.object_id, []).append(pt)
        for oid in tracks:
            tracks[oid].sort(key=lambda p: p.frame)

    # 2. Otherwise locate trajectory CSV on disk
    else:
        csv_file = None
        if payload.csv_path and Path(payload.csv_path).exists():
            csv_file = Path(payload.csv_path)
        else:
            traj_dir = resolve_trajectories_dir()
            possible = [
                traj_dir / f"{clean_stem}_trajectories.csv",
                traj_dir / f"{clean_stem}.csv",
                traj_dir / payload.video_id,
            ]
            for c in possible:
                if c.exists() and c.is_file():
                    csv_file = c
                    break

        if not csv_file or not csv_file.exists():
            raise HTTPException(
                status_code=404,
                detail=f"Trajectory data not found for video '{payload.video_id}'. Provide trajectories list or valid csv_path."
            )

        tracks = engine.parse_trajectory_csv(csv_file)

    fps = float(payload.fps or 30.0)

    # 3. Run canonical Member 2 Behaviour Engine
    candidates = engine.process_tracks(tracks, fps=fps, video_name=clean_stem)

    # 4. Run canonical Member 2 Multi-Factor Risk Engine
    canonical_events = score_and_build_events(candidates, video_id=clean_stem, fps=fps)

    # 5. Adapt and persist to Project 2 Database
    persisted_events = event_adapter.adapt_and_persist_events(
        db=db,
        root_events=canonical_events,
        video_name_or_id=clean_stem,
        fps=fps,
        provenance_type=payload.provenance_type or "REAL_INFERENCE"
    )

    return {
        "status": "SUCCESS",
        "video_id": clean_stem,
        "fps": fps,
        "tracks_analyzed": len(tracks),
        "candidates_detected": len(candidates),
        "events_generated_count": len(persisted_events),
        "events": [
            {
                "event_id": ev.event_id,
                "behaviour": ev.behaviour,
                "risk_score": ev.risk_score,
                "risk_level": ev.risk_level,
                "timestamp": ev.timestamp,
                "description": ev.description,
                "reason": ev.reason,
                "recommended_action": ev.recommended_action,
                "evidence_frame": ev.evidence_frame,
            }
            for ev in persisted_events
        ]
    }


@router.post("/ingest-all-warehouse-trajectories")
def ingest_all_warehouse_trajectories(
    db: Session = Depends(get_db),
    current_user: models.User = Depends(get_current_user)
):
    """
    Batch ingests all 7 warehouse trajectory CSVs from data/Trajectories,
    executes Member 2 Intelligence, and populates the database with canonical incidents.
    """
    traj_dir = resolve_trajectories_dir()
    csv_files = sorted(list(traj_dir.glob("*.csv")))
    # Exclude derived or baseline_backup subfolders
    csv_files = [f for f in csv_files if f.is_file()]

    if not csv_files:
        raise HTTPException(status_code=404, detail=f"No trajectory CSVs found in {traj_dir}")

    engine = RuleEngine()
    total_events_created = 0
    results_per_video = []

    for c_path in csv_files:
        clean_stem = c_path.stem.replace("_trajectories", "")
        tracks = engine.parse_trajectory_csv(c_path)
        candidates = engine.process_tracks(tracks, fps=30.0, video_name=clean_stem)
        canonical_events = score_and_build_events(candidates, video_id=clean_stem, fps=30.0)

        persisted = event_adapter.adapt_and_persist_events(
            db=db,
            root_events=canonical_events,
            video_name_or_id=clean_stem,
            fps=30.0,
            provenance_type="REAL_INFERENCE"
        )
        total_events_created += len(persisted)
        results_per_video.append({
            "video": clean_stem,
            "tracks": len(tracks),
            "events_count": len(persisted),
            "behaviours": [ev.behaviour for ev in persisted]
        })

    return {
        "status": "SUCCESS",
        "total_videos_processed": len(csv_files),
        "total_events_persisted": total_events_created,
        "details": results_per_video
    }
