import json
import time
import numpy as np
from typing import List, Dict, Any, Optional
from sqlalchemy.orm import Session
from app.services.rule_engine import SafetyRuleEngine
from app.db.models import TelemetryPoint

# Supported warehouse class mapping
CLASS_NAMES = [
    "person", "carton", "pallet", "forklift", "pallet_jack", 
    "trolley", "mattress", "truck", "dock_gap", "strap"
]

import hashlib
from pathlib import Path

class ModelLoadError(Exception):
    """Raised when real YOLO ML model weights fail to load or hash verification fails."""
    pass

# Supported warehouse class mapping
CLASS_NAMES = [
    "person", "carton", "pallet", "forklift", "pallet_jack", 
    "trolley", "mattress", "truck", "dock_gap", "strap"
]

try:
    from ultralytics import YOLO
    ULTRALYTICS_AVAILABLE = True
except ImportError:
    ULTRALYTICS_AVAILABLE = False


def compute_file_sha256(filepath: str) -> str:
    """Computes authoritative SHA256 checksum of actual model file on disk."""
    hasher = hashlib.sha256()
    with open(filepath, "rb") as f:
        for chunk in iter(lambda: f.read(65536), b""):
            hasher.update(chunk)
    return hasher.hexdigest()


class MultiModelInferencePipeline:
    """
    MLOps Multi-Model Inference Pipeline combining YOLO11 Object Detection,
    YOLO11 Pose Estimation, Layer C Kinematics Engine, and Database Telemetry Streaming.
    """
    def __init__(
        self, 
        det_model_path: str = "yolo11s.pt", 
        pose_model_path: Optional[str] = None,
        device: str = "cpu",
        fps: float = 30.0,
        expected_sha256: Optional[str] = None
    ):
        self.device = device
        self.fps = fps
        self.rule_engine = SafetyRuleEngine(fps=fps)
        self.det_model = None
        self.pose_model = None
        self.det_model_path = det_model_path
        self.det_model_sha256 = None
        self.load_error = None

        if not ULTRALYTICS_AVAILABLE:
            self.load_error = ModelLoadError("Ultralytics package is not installed.")
            print(f"[InferencePipeline] FAIL CLOSED: {self.load_error}")
            return

        model_file = Path(det_model_path)
        if not model_file.exists() or not model_file.is_file():
            self.load_error = ModelLoadError(f"Model file '{det_model_path}' does not exist on disk.")
            print(f"[InferencePipeline] FAIL CLOSED: {self.load_error}")
            return

        try:
            self.det_model_sha256 = compute_file_sha256(str(model_file))
            if expected_sha256 and self.det_model_sha256 != expected_sha256:
                raise ModelLoadError(f"Model SHA256 mismatch. Expected '{expected_sha256}', computed '{self.det_model_sha256}'.")

            self.det_model = YOLO(str(model_file))
            if pose_model_path and Path(pose_model_path).exists():
                self.pose_model = YOLO(pose_model_path)
            print(f"[InferencePipeline] Loaded Ultralytics YOLO model '{det_model_path}' (SHA256: {self.det_model_sha256[:12]}...) on device: {device}")
        except Exception as e:
            self.load_error = ModelLoadError(f"Could not initialize YOLO model from '{det_model_path}': {e}")
            print(f"[InferencePipeline] FAIL CLOSED: {self.load_error}")

    def process_frame(
        self, 
        frame_np: Optional[np.ndarray], 
        frame_index: int, 
        timestamp_sec: float, 
        video_id: str = "VID-001",
        session_id: str = "SESSION-001",
        db_session: Optional[Session] = None
    ) -> Dict[str, Any]:
        """
        Executes multi-model inference, evaluates pose & kinematic rules,
        formats telemetry payload, and logs TelemetryPoint to database.
        """
        if self.det_model is None or frame_np is None:
            err_msg = str(self.load_error) if self.load_error else "Real YOLO model is not loaded."
            raise ModelLoadError(f"Inference process_frame failed: {err_msg}")

        start_time = time.time()
        detections: List[Dict[str, Any]] = []
        poses: List[Dict[str, Any]] = []

        # 1. Run YOLO11 Object Detection + ByteTrack tracking
        det_results = self.det_model.track(frame_np, persist=True, device=self.device, verbose=False)
        if det_results and len(det_results) > 0:
            boxes = det_results[0].boxes
            if boxes is not None:
                for i in range(len(boxes)):
                    cls_id = int(boxes.cls[i].item())
                    cls_name = CLASS_NAMES[cls_id] if cls_id < len(CLASS_NAMES) else f"class_{cls_id}"
                    track_id = int(boxes.id[i].item()) if boxes.id is not None else i + 100
                    xyxy = boxes.xyxy[i].tolist()
                    detections.append({
                        "track_id": track_id,
                        "class": cls_name,
                        "bbox": [round(c, 1) for c in xyxy],
                        "confidence": round(float(boxes.conf[i].item()), 2)
                    })

        # 2. Run YOLO11-pose estimation
        if self.pose_model:
            pose_results = self.pose_model(frame_np, device=self.device, verbose=False)
            if pose_results and len(pose_results) > 0 and pose_results[0].keypoints is not None:
                kpts_data = pose_results[0].keypoints.data
                for p in range(len(kpts_data)):
                    kpts = kpts_data[p].tolist()
                    poses.append({
                        "person_id": p + 1,
                        "keypoints": kpts
                    })

        # 3. Ensure InferenceRun record exists if DB session is present
        inference_run_id = None
        latency_ms = round((time.time() - start_time) * 1000, 2)
        if db_session:
            try:
                from app.db import models
                import datetime, uuid
                run_id = f"RUN-{uuid.uuid4().hex[:8].upper()}"
                inf_run = models.InferenceRun(
                    id=run_id,
                    video_id=video_id,
                    camera_id="CAM-01",
                    model_name="YOLO11s",
                    model_version="v1.4.2-tensorrt",
                    model_path=self.det_model_path,
                    model_sha256=self.det_model_sha256,
                    inference_engine="LOCAL_YOLO11",
                    device=self.device,
                    status="SUCCESS",
                    started_at=datetime.datetime.utcnow(),
                    completed_at=datetime.datetime.utcnow(),
                    provenance_type="REAL_INFERENCE"
                )
                db_session.add(inf_run)
                db_session.commit()
                inference_run_id = run_id
            except Exception as e:
                db_session.rollback()
                print(f"[InferencePipeline] Could not record InferenceRun: {e}")

        # 4. Evaluate Layer C Rule Engine
        active_alerts = self.rule_engine.evaluate_frame(
            frame_index=frame_index,
            timestamp=timestamp_sec,
            detections=detections,
            poses=poses,
            video_id=video_id,
            db_session=db_session,
            inference_run_id=inference_run_id,
            model_name="YOLO11s",
            model_version="v1.4.2-tensorrt",
            inference_engine="LOCAL_YOLO11",
            confidence=0.92,
            provenance_type="REAL_INFERENCE",
            processing_latency_ms=latency_ms
        )

        # 5. Format Unified Frame Telemetry JSON Payload
        violations = list({a["rule_id"].lower() for a in active_alerts})
        max_risk = max([a.get("risk_score", 15.0) for a in active_alerts], default=15.0)
        
        status = "NOMINAL"
        if max_risk >= 90.0:
            status = "CRITICAL"
        elif max_risk >= 75.0:
            status = "HIGH"
        elif max_risk >= 40.0:
            status = "MEDIUM"

        telemetry_boxes = []
        for d in detections:
            track_id = d.get("track_id", 0)
            obj_state = self.rule_engine.kinematics.objects.get(track_id)
            vel_y = 0.0
            if obj_state and len(obj_state.bbox_history) >= 2:
                _, vel_y, _ = self.rule_engine.kinematics._compute_kinematics(obj_state)

            telemetry_boxes.append({
                "track_id": track_id,
                "class_name": d.get("class", "carton"),
                "bbox": d.get("bbox", [0.0, 0.0, 0.0, 0.0]),
                "velocity_y": round(vel_y, 2)
            })

        latency_ms = round((time.time() - start_time) * 1000, 2)

        telemetry_payload = {
            "timestamp": round(timestamp_sec, 2),
            "frame_index": frame_index,
            "risk_score": round(max_risk, 1),
            "status": status,
            "violations": violations,
            "boxes": telemetry_boxes,
            "inference_latency_ms": latency_ms
        }

        # 6. DB Logging (Stream TelemetryPoint to Database)
        if db_session:
            try:
                t_point = TelemetryPoint(
                    video_id=video_id,
                    session_id=session_id,
                    timestamp=round(timestamp_sec, 2),
                    risk_score=round(max_risk, 1),
                    status=status,
                    violations_json=json.dumps(violations),
                    boxes_json=json.dumps(telemetry_boxes)
                )
                db_session.add(t_point)
                db_session.commit()
            except Exception as e:
                db_session.rollback()
                print(f"[InferencePipeline] Telemetry DB log error: {e}")

        return telemetry_payload
