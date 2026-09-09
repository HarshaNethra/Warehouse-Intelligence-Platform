"""
Canonical Event Adapter Service for Godrej Warehouse Intelligence Platform.

Adapts Member 2 canonical events into Project 2's normalized 3-layer database architecture:
  1. BehaviourObservation (Pure CV observation layer)
  2. RiskAssessment (Deterministic risk assessment & explainability container)
  3. Event (Primary supervisor incident record)

Provides deterministic video identity resolution across all 7 warehouse videos,
controlled tenancy mapping, explicit field transformations, RAG indexing,
and real-time WebSocket broadcast notifications.
"""

import os
import json
import uuid
import datetime
from pathlib import Path
from typing import Dict, Any, List, Optional, Tuple
from sqlalchemy.orm import Session

from app.db import models
from app.services.websocket_manager import ws_manager

try:
    from app.services.rag_store import rag_vector_store
    RAG_AVAILABLE = True
except Exception:
    rag_vector_store = None
    RAG_AVAILABLE = False


# Canonical warehouse video stem mapping to default camera/bay assignments
WAREHOUSE_VIDEO_METADATA = {
    "Dock level, dragging cupboard": {"bay": "Loading Bay 1", "camera_id": "CAM-01"},
    "KD packets dragged, heavy box kept on other packets": {"bay": "Loading Bay 2", "camera_id": "CAM-02"},
    "Rolling and dragging on wet floor": {"bay": "Loading Bay 3", "camera_id": "CAM-03"},
    "Rolling and dropping carton": {"bay": "Loading Bay 1", "camera_id": "CAM-01"},
    "Stepping on cartons, vertical product kept horizontally, heavy product kept on top": {"bay": "Loading Bay 4", "camera_id": "CAM-04"},
    "Throwing Mattresses": {"bay": "Loading Bay 2", "camera_id": "CAM-02"},
    "Throwing seating cartons, using strap to hold": {"bay": "Loading Bay 1", "camera_id": "CAM-01"},
}


class VideoResolutionError(Exception):
    """Raised when video identity cannot be determined or resolved."""
    pass


class EventAdapter:
    """
    Translates Member 2 canonical behaviour/risk events into Project 2 ORM entities.
    """

    def __init__(self, default_org_id: str = "ORG-001", default_facility_id: str = "FAC-001"):
        self.default_org_id = default_org_id
        self.default_facility_id = default_facility_id

    def resolve_video(
        self,
        db: Session,
        video_name_or_id: str,
        fps: float = 30.0,
        width: int = 1920,
        height: int = 1080,
        duration: float = 60.0,
        camera_id: Optional[str] = None
    ) -> models.Video:
        """
        Deterministically resolves a video identifier or filename to a persistent Video record.
        Reuses existing DB row if present, or creates a canonical record.
        """
        clean_name = str(video_name_or_id).strip().strip('"').strip("'")
        clean_stem = clean_name[:-4] if clean_name.lower().endswith(".mp4") else clean_name
        filename = f"{clean_stem}.mp4"

        # 1. Check existing record by ID or filename
        existing = db.query(models.Video).filter(
            (models.Video.video_id == clean_name) |
            (models.Video.filename == filename) |
            (models.Video.filename == clean_name)
        ).first()

        if existing:
            return existing

        # 2. Check if video file exists on disk to extract real media properties
        videos_dir = None
        for candidate_parent in [Path.cwd(), *Path(__file__).resolve().parents]:
            if (candidate_parent / "videos").exists():
                videos_dir = candidate_parent / "videos"
                break

        actual_fps = fps
        actual_width = width
        actual_height = height
        actual_duration = duration

        if videos_dir:
            v_path = videos_dir / filename
            if not v_path.exists():
                v_path = videos_dir / clean_name
            if v_path.exists():
                try:
                    import cv2
                    cap = cv2.VideoCapture(str(v_path))
                    if cap.isOpened():
                        f_fps = cap.get(cv2.CAP_PROP_FPS)
                        f_w = int(cap.get(cv2.CAP_PROP_FRAME_WIDTH))
                        f_h = int(cap.get(cv2.CAP_PROP_FRAME_HEIGHT))
                        f_cnt = int(cap.get(cv2.CAP_PROP_FRAME_COUNT))
                        if f_fps and f_fps > 0:
                            actual_fps = round(float(f_fps), 2)
                        if f_w > 0 and f_h > 0:
                            actual_width = f_w
                            actual_height = f_h
                        if f_cnt > 0 and actual_fps > 0:
                            actual_duration = round(float(f_cnt / actual_fps), 2)
                        cap.release()
                except Exception:
                    pass

        # 3. Create deterministic Video record
        det_id = f"VID-{uuid.uuid5(uuid.NAMESPACE_DNS, clean_stem).hex[:8].upper()}"
        assigned_camera = camera_id or WAREHOUSE_VIDEO_METADATA.get(clean_stem, {}).get("camera_id", "CAM-01")

        # Verify camera exists or fallback to existing CAM-01
        cam_rec = db.query(models.Camera).filter(models.Camera.id == assigned_camera).first()
        if not cam_rec:
            first_cam = db.query(models.Camera).first()
            assigned_camera = first_cam.id if first_cam else "CAM-01"

        new_video = models.Video(
            video_id=det_id,
            camera_id=assigned_camera,
            filename=filename,
            fps=actual_fps,
            width=actual_width,
            height=actual_height,
            duration=actual_duration,
            frame_count=int(actual_duration * actual_fps),
            status="processed",
            processed_at=datetime.datetime.utcnow()
        )
        db.add(new_video)
        db.flush()
        return new_video

    def ensure_tenancy_prerequisites(self, db: Session) -> Tuple[str, str]:
        """
        Ensures default Organization and Facility exist in DB to satisfy foreign keys.
        """
        org = db.query(models.Organization).filter(models.Organization.id == self.default_org_id).first()
        if not org:
            org = models.Organization(id=self.default_org_id, name="Acme Logistics Global")
            db.add(org)
            db.flush()

        fac = db.query(models.Facility).filter(models.Facility.id == self.default_facility_id).first()
        if not fac:
            fac = models.Facility(
                id=self.default_facility_id,
                organization_id=self.default_org_id,
                name="Bengaluru Distribution Center",
                location="Bengaluru, India"
            )
            db.add(fac)
            db.flush()

        return self.default_org_id, self.default_facility_id

    def adapt_and_persist_event(
        self,
        db: Session,
        root_event: Dict[str, Any],
        video_record: models.Video,
        inference_run: Optional[models.InferenceRun] = None,
        provenance_type: str = "REAL_INFERENCE",
        environment: str = "PRODUCTION"
    ) -> models.Event:
        """
        Explicitly maps a canonical Member 2 event dictionary to Project 2's
        BehaviourObservation, RiskAssessment, and Event models.
        """
        self.ensure_tenancy_prerequisites(db)

        raw_event_id = root_event.get("event_id")
        event_id = str(raw_event_id) if raw_event_id else f"EVT-{uuid.uuid4().hex[:8].upper()}"

        # Prevent duplicate insertion of identical event
        existing_event = db.query(models.Event).filter(models.Event.event_id == event_id).first()
        if existing_event:
            return existing_event

        fps = float(video_record.fps or 30.0)
        start_ts = float(root_event.get("start_timestamp", root_event.get("timestamp", 0.0)))
        end_ts = float(root_event.get("end_timestamp", start_ts + root_event.get("duration", 1.0)))
        duration = float(root_event.get("duration", max(0.1, end_ts - start_ts)))
        object_id = root_event.get("object_id")
        behaviour = str(root_event.get("behaviour", "unknown_violation"))
        confidence = float(root_event.get("confidence", 0.92))
        risk_score = float(root_event.get("risk_score", 50.0))

        # Normalize risk level to uppercase canonical string (CRITICAL, HIGH, MEDIUM, LOW)
        raw_risk_level = str(root_event.get("risk_level", "medium")).strip().upper()
        if raw_risk_level not in {"CRITICAL", "HIGH", "MEDIUM", "LOW"}:
            if risk_score >= 90.0:
                raw_risk_level = "CRITICAL"
            elif risk_score >= 70.0:
                raw_risk_level = "HIGH"
            elif risk_score >= 40.0:
                raw_risk_level = "MEDIUM"
            else:
                raw_risk_level = "LOW"
        risk_level = raw_risk_level

        description = str(root_event.get("description", f"{behaviour} detected"))
        reason = str(root_event.get("reason", f"Triggered by {behaviour} rule"))
        recommended_action = str(root_event.get("recommended_action", "Review video footage and inspect package."))

        evidence_dict = root_event.get("evidence", {})
        evidence_frame_number = root_event.get("evidence_frame")
        if evidence_frame_number is None:
            evidence_frame_number = int(start_ts * fps)
        else:
            evidence_frame_number = int(evidence_frame_number)

        evidence_frame_url = f"/api/videos/{video_record.video_id}/frames/{evidence_frame_number}"
        video_ref_url = f"/stream/video/{video_record.filename}#t={start_ts:.2f}"

        # Assign bay and tenancy metadata dynamically
        clean_stem = video_record.filename[:-4] if video_record.filename.endswith(".mp4") else video_record.filename
        bay_name = (
            root_event.get("bay_id") or 
            root_event.get("bay") or 
            WAREHOUSE_VIDEO_METADATA.get(clean_stem, {}).get("bay", "Loading Bay 1")
        )
        facility_id = root_event.get("facility_id") or self.default_facility_id
        org_id = root_event.get("organization_id") or self.default_org_id
        camera_id = root_event.get("camera_id") or video_record.camera_id or "CAM-01"

        # 1. Layer 1: BehaviourObservation Record
        if not inference_run:
            inference_run = db.query(models.InferenceRun).filter(
                models.InferenceRun.video_id == video_record.video_id,
                models.InferenceRun.provenance_type == provenance_type
            ).first()
            if not inference_run:
                inf_id = f"RUN-{uuid.uuid4().hex[:8].upper()}"
                inference_run = models.InferenceRun(
                    id=inf_id,
                    video_id=video_record.video_id,
                    camera_id=video_record.camera_id or "CAM-01",
                    model_name="best.pt",
                    model_version="YOLO11s-Godrej",
                    inference_engine="LOCAL_YOLO11",
                    device="cpu",
                    status="SUCCESS",
                    started_at=datetime.datetime.utcnow(),
                    completed_at=datetime.datetime.utcnow(),
                    provenance_type=provenance_type
                )
                db.add(inference_run)
                db.flush()

        obs_id = f"OBS-{uuid.uuid4().hex[:8].upper()}"
        inf_run_id = inference_run.id

        obs = models.BehaviourObservation(
            id=obs_id,
            inference_run_id=inf_run_id,
            video_id=video_record.video_id,
            track_id=int(object_id) if object_id is not None else None,
            frame_number=evidence_frame_number,
            timestamp=start_ts,
            behaviour_type=behaviour,
            confidence=confidence,
            details_json=json.dumps(evidence_dict, default=str),
            created_at=datetime.datetime.utcnow()
        )
        db.add(obs)
        db.flush()

        # 2. Layer 2: RiskAssessment Record
        ra_id = f"RA-{uuid.uuid4().hex[:8].upper()}"
        potential_consequence = evidence_dict.get("potential_consequence") or "Potential inventory or operational safety risk."

        risk_factors_data = evidence_dict.get("risk_factors") or evidence_dict
        risk_factors_str = json.dumps(risk_factors_data, default=str)

        ra = models.RiskAssessment(
            id=ra_id,
            event_id=event_id,
            behaviour_observation_id=obs_id,
            risk_level=risk_level,
            risk_score=risk_score,
            confidence=confidence,
            reason=reason,
            risk_factors_json=risk_factors_str,
            potential_consequence=potential_consequence,
            model_version="warehouse-risk-v1.4",
            created_at=datetime.datetime.utcnow()
        )
        db.add(ra)
        db.flush()

        # 3. Layer 3: Master Event Record
        db_event = models.Event(
            event_id=event_id,
            organization_id=org_id,
            facility_id=facility_id,
            video_id=video_record.video_id,
            timestamp=start_ts,
            timestamp_seconds=start_ts,
            timestamp_utc=datetime.datetime.utcnow(),
            camera_id=camera_id,
            bay_id=bay_name,
            object_id=int(object_id) if object_id is not None else None,
            behaviour=behaviour,
            risk_score=risk_score,
            risk_level=risk_level,
            description=description,
            reason=reason,
            potential_consequence=potential_consequence,
            risk_factors_json=risk_factors_str,
            evidence_frame=evidence_frame_url,
            video_reference=video_ref_url,
            recommended_action=recommended_action,
            status="UNRESOLVED",
            model_name="best.pt",
            model_version="YOLO11s-Godrej",
            inference_engine="LOCAL_YOLO11",
            confidence=confidence,
            provenance_type=provenance_type,
            environment=environment,
            is_test_data=False,
            is_demo_data=False,
            inference_run_id=inf_run_id,
            risk_assessment_id=ra_id,
            behaviour_observation_id=obs_id,
            frame_number=evidence_frame_number,
            video_fps=fps,
            evidence_clip_start=start_ts,
            evidence_clip_end=end_ts,
            created_at=datetime.datetime.utcnow()
        )
        db.add(db_event)
        db.commit()
        db.refresh(db_event)

        # Index event into RAG Vector Store for Assistant grounding
        if RAG_AVAILABLE and rag_vector_store:
            try:
                rag_vector_store.add_incident({
                    "event_id": event_id,
                    "behaviour": behaviour,
                    "risk_score": risk_score,
                    "risk_level": risk_level,
                    "description": description,
                    "reason": reason,
                    "recommended_action": recommended_action,
                    "facility_id": self.default_facility_id,
                    "bay_id": bay_name,
                    "timestamp": start_ts,
                    "video_id": video_record.video_id,
                })
            except Exception as e:
                print(f"[EventAdapter] Warning: RAG indexing failed: {e}")

        # Broadcast event to connected WebSockets
        try:
            import asyncio
            payload = {
                "event_id": db_event.event_id,
                "behaviour": db_event.behaviour,
                "risk_score": db_event.risk_score,
                "risk_level": db_event.risk_level,
                "description": db_event.description,
                "bay_id": db_event.bay_id,
                "timestamp": db_event.timestamp,
                "evidence_frame": db_event.evidence_frame,
            }
            try:
                loop = asyncio.get_running_loop()
                loop.create_task(ws_manager.broadcast({
                    "type": "NEW_INCIDENT",
                    "data": payload
                }))
            except RuntimeError:
                pass  # No running event loop (e.g. CLI or synchronous worker)
        except Exception:
            pass

        return db_event

    def adapt_and_persist_events(
        self,
        db: Session,
        root_events: List[Dict[str, Any]],
        video_name_or_id: str,
        fps: float = 30.0,
        inference_run: Optional[models.InferenceRun] = None,
        provenance_type: str = "REAL_INFERENCE",
        environment: str = "PRODUCTION"
    ) -> List[models.Event]:
        """
        Batch adapts a list of canonical Member 2 events for a specific video.
        """
        video_record = self.resolve_video(db, video_name_or_id=video_name_or_id, fps=fps)
        persisted = []
        for evt in root_events:
            db_event = self.adapt_and_persist_event(
                db=db,
                root_event=evt,
                video_record=video_record,
                inference_run=inference_run,
                provenance_type=provenance_type,
                environment=environment
            )
            persisted.append(db_event)
        return persisted


# Global Singleton
event_adapter = EventAdapter()
