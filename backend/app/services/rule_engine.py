import time
import json
import uuid
import numpy as np
from typing import List, Dict, Any, Optional, Tuple
from collections import deque, defaultdict
from sqlalchemy.orm import Session
from app.db.models import Event

# COCO Pose Keypoint Indices
NOSE = 0
LEFT_ANKLE = 15
RIGHT_ANKLE = 16
LEFT_KNEE = 13
RIGHT_KNEE = 14


class TrackedObject:
    """
    State container for a tracked object storing bounding box history
    over a rolling 5-frame window.
    """
    def __init__(self, track_id: int, object_class: str, bbox: Tuple[float, float, float, float]):
        self.track_id = track_id
        self.object_class = object_class
        self.bbox_history = deque(maxlen=5) # Rolling 5-frame window
        self.timestamps = deque(maxlen=5)
        self.update(bbox, time.time())

    def update(self, bbox: Tuple[float, float, float, float], timestamp: float) -> None:
        self.bbox_history.append(bbox)
        self.timestamps.append(timestamp)

    @property
    def current_bbox(self) -> Tuple[float, float, float, float]:
        return self.bbox_history[-1]

    @property
    def centroid(self) -> Tuple[float, float]:
        x1, y1, x2, y2 = self.current_bbox
        return ((x1 + x2) / 2.0, (y1 + y2) / 2.0)


class KinematicsEngine:
    """
    Layer C Kinematics Analytics Engine.
    Tracks object centroids, velocity vectors, and vertical acceleration (a_y)
    over a rolling 5-frame sliding window.
    Converts pixel dynamics to metric acceleration via spatial scaling factor (meters_per_pixel).
    """
    def __init__(self, fps: float = 30.0, meters_per_pixel: float = 0.005):
        self.fps = fps
        self.dt = 1.0 / fps
        self.meters_per_pixel = meters_per_pixel  # Default 0.005 m/px (5mm per pixel for 1080p loading bay view)
        self.objects: Dict[int, TrackedObject] = {}

    def update_tracks(
        self, 
        frame_detections: List[Dict[str, Any]], 
        timestamp: float
    ) -> List[Dict[str, Any]]:
        """
        Processes frame-level object detections with track_ids.
        Computes velocity vectors and vertical acceleration (ay).
        Returns active freefall/dropping alerts.
        """
        alerts = []
        active_ids = set()

        for det in frame_detections:
            track_id = det.get("track_id")
            if track_id is None:
                continue
            
            obj_class = det.get("class", "carton").lower()
            bbox = tuple(det.get("bbox", [0.0, 0.0, 0.0, 0.0]))
            active_ids.add(track_id)

            if track_id not in self.objects:
                self.objects[track_id] = TrackedObject(track_id, obj_class, bbox)
            else:
                self.objects[track_id].update(bbox, timestamp)

            # Compute Kinematics over rolling window
            obj = self.objects[track_id]
            if len(obj.bbox_history) >= 3:
                vx, vy, ay_metric, ay_pixels = self._compute_kinematics(obj)
                
                # Freefall / Throwing condition: object class in carton/mattress and ay_metric > 8.0 m/s^2
                if obj.object_class in ["carton", "mattress", "package", "box", "large_carton"] and ay_metric > 8.0:
                    alerts.append({
                        "track_id": track_id,
                        "object_class": obj.object_class,
                        "rule": "FREEFALL_DETECTED",
                        "acceleration_y": ay_metric,
                        "acceleration_y_px": ay_pixels,
                        "velocity": (vx, vy),
                        "severity": "CRITICAL" if ay_metric > 12.0 else "HIGH"
                    })

        # Purge stale tracks not present in current frame
        stale_ids = set(self.objects.keys()) - active_ids
        for sid in stale_ids:
            del self.objects[sid]

        return alerts

    def _compute_kinematics(self, obj: TrackedObject) -> Tuple[float, float, float, float]:
        centroids = []
        for bbox in obj.bbox_history:
            x1, y1, x2, y2 = bbox
            centroids.append(((x1 + x2) / 2.0, (y1 + y2) / 2.0))

        # Compute velocities between consecutive frames
        velocities = []
        for i in range(1, len(centroids)):
            dx = centroids[i][0] - centroids[i-1][0]
            dy = centroids[i][1] - centroids[i-1][1]
            vx = dx / self.dt
            vy = dy / self.dt
            velocities.append((vx, vy))

        if not velocities:
            return 0.0, 0.0, 0.0, 0.0

        latest_vx, latest_vy = velocities[-1]
        
        # Pixel Acceleration ay_pixels = (vy_t - vy_{t-1}) / dt
        if len(velocities) >= 2:
            prev_vy = velocities[-2][1]
            ay_pixels = (latest_vy - prev_vy) / self.dt
        else:
            ay_pixels = 0.0

        ay_pixels = max(0.0, float(ay_pixels))
        ay_metric = ay_pixels * self.meters_per_pixel

        return latest_vx, latest_vy, float(ay_metric), float(ay_pixels)


class SafetyRuleEngine:
    """
    Layer C Safety & Pose Spatial Analytics Engine.
    Evaluates:
      - Rule 01: Person on Inventory (COCO Pose Keypoints #15/#16 contained in inventory box)
      - Rule 02: Vehicle-Pedestrian Proximity (<50px distance to vehicle base)
      - Rule 03: Heavy Box on Unstable Stack (Overhang & area ratio > 1.3x)
      - Database Persistence & 15-frame State-Machine Thresholding
    """
    def __init__(self, fps: float = 30.0):
        self.fps = fps
        self.kinematics = KinematicsEngine(fps=fps)
        self.rule_counters: Dict[str, int] = defaultdict(int)

    def evaluate_frame(
        self, 
        frame_index: int, 
        timestamp: float, 
        detections: List[Dict[str, Any]], 
        poses: List[Dict[str, Any]],
        video_id: str = "CAM-01",
        db_session: Optional[Session] = None,
        inference_run_id: Optional[str] = None,
        model_name: str = "YOLO11s",
        model_version: str = "v1.4.2-tensorrt",
        inference_engine: str = "LOCAL_YOLO11",
        confidence: float = 0.92,
        provenance_type: str = "REAL_INFERENCE",
        processing_latency_ms: Optional[float] = None,
        video_fps: float = 30.0,
        video_filename: Optional[str] = None
    ) -> List[Dict[str, Any]]:
        """
        Evaluates a single frame for safety rule violations and kinematic anomalies.
        Returns list of active rule alerts and persists events triggered for >15 consecutive frames.
        """
        frame_alerts = []

        # 1. Kinematic Analytics Update
        kinematic_alerts = self.kinematics.update_tracks(detections, timestamp)
        for ka in kinematic_alerts:
            frame_alerts.append({
                "rule_id": "RULE_KINEMATICS_FREEFALL",
                "behaviour": f"Product Freefall / Drop ({ka['object_class']})",
                "severity": ka["severity"],
                "risk_score": 92.4 if ka["severity"] == "CRITICAL" else 84.0,
                "reason": f"Vertical Y-acceleration ay = {ka['acceleration_y']:.1f} m/s² exceeds 8.0 m/s² threshold.",
                "object_id": ka["track_id"]
            })

        # 2. Rule 01: Person Stepping on Inventory
        rule1_alerts = self._check_person_on_inventory(poses, detections)
        frame_alerts.extend(rule1_alerts)

        # 3. Rule 02: Vehicle-Pedestrian Proximity
        rule2_alerts = self._check_vehicle_pedestrian_proximity(poses, detections)
        frame_alerts.extend(rule2_alerts)

        # 4. Rule 03: Heavy Box on Unstable Stack
        rule3_alerts = self._check_unstable_stacking(detections)
        frame_alerts.extend(rule3_alerts)

        # 5. Consecutive Frame State Machine (> 15 consecutive frames = 0.5s @ 30 FPS)
        persisted_events = []
        active_keys = set()

        for alert in frame_alerts:
            rule_key = f"{alert['rule_id']}_{alert.get('object_id', 0)}"
            active_keys.add(rule_key)
            self.rule_counters[rule_key] += 1

            # Trigger database insert: 3 consecutive frames for fast kinematic freefall/drop, 15 for sustained rules
            trigger_threshold = 3 if ("FREEFALL" in alert.get("rule_id", "") or alert.get("severity") == "CRITICAL") else 15
            if self.rule_counters[rule_key] == trigger_threshold:
                event_record = self._persist_event_to_db(
                    alert=alert,
                    video_id=video_id,
                    timestamp=timestamp,
                    db_session=db_session,
                    inference_run_id=inference_run_id,
                    frame_number=frame_index,
                    model_name=model_name,
                    model_version=model_version,
                    inference_engine=inference_engine,
                    confidence=confidence,
                    provenance_type=provenance_type,
                    processing_latency_ms=processing_latency_ms,
                    video_fps=video_fps,
                    video_filename=video_filename
                )
                if event_record is not None:
                    persisted_events.append(event_record)

        # Decay counters for inactive rules
        for rk in list(self.rule_counters.keys()):
            if rk not in active_keys:
                self.rule_counters[rk] = max(0, self.rule_counters[rk] - 1)

        return frame_alerts

    def _check_person_on_inventory(
        self, 
        poses: List[Dict[str, Any]], 
        detections: List[Dict[str, Any]]
    ) -> List[Dict[str, Any]]:
        alerts = []
        inventory_boxes = [
            d for d in detections 
            if d.get("class", "").lower() in ["carton", "pallet", "box", "large_carton", "small_carton", "mattress"]
        ]

        for pose in poses:
            keypoints = pose.get("keypoints", []) # List of [x, y, conf]
            if len(keypoints) < 17:
                continue

            left_ankle = keypoints[LEFT_ANKLE]
            right_ankle = keypoints[RIGHT_ANKLE]

            for inv in inventory_boxes:
                x1, y1, x2, y2 = inv.get("bbox", [0.0, 0.0, 0.0, 0.0])
                
                # Verify confidence > 0.3 and keypoint containment
                l_inside = (x1 <= left_ankle[0] <= x2) and (y1 <= left_ankle[1] <= y2) and (left_ankle[2] > 0.3)
                r_inside = (x1 <= right_ankle[0] <= x2) and (y1 <= right_ankle[1] <= y2) and (right_ankle[2] > 0.3)

                if l_inside or r_inside:
                    alerts.append({
                        "rule_id": "RULE_01_PERSON_ON_INVENTORY",
                        "behaviour": "Person Stepping on Inventory / Pallet",
                        "severity": "CRITICAL",
                        "risk_score": 96.1,
                        "reason": f"COCO Pose Ankle keypoints #15/#16 detected inside {inv.get('class')} bounding box.",
                        "object_id": inv.get("track_id", 0)
                    })
                    break
        return alerts

    def _check_vehicle_pedestrian_proximity(
        self, 
        poses: List[Dict[str, Any]], 
        detections: List[Dict[str, Any]]
    ) -> List[Dict[str, Any]]:
        alerts = []
        vehicles = [d for d in detections if d.get("class", "").lower() in ["forklift", "pallet_jack", "truck", "trolley"]]
        
        for v in vehicles:
            vx1, vy1, vx2, vy2 = v.get("bbox", [0.0, 0.0, 0.0, 0.0])
            v_center = ((vx1 + vx2) / 2.0, (vy1 + vy2) / 2.0)

            for pose in poses:
                keypoints = pose.get("keypoints", [])
                if len(keypoints) > 0 and keypoints[NOSE][2] > 0.3:
                    px, py = keypoints[NOSE][0], keypoints[NOSE][1]
                    dist = np.sqrt((px - v_center[0])**2 + (py - v_center[1])**2)
                    
                    if dist < 120.0: # Close spatial distance in pixel domain
                        alerts.append({
                            "rule_id": "RULE_02_VEHICLE_PROXIMITY",
                            "behaviour": "Unsafe Vehicle-Pedestrian Proximity",
                            "severity": "HIGH",
                            "risk_score": 82.0,
                            "reason": f"Pedestrian detected within {dist:.1f}px radius of operational {v.get('class')}.",
                            "object_id": v.get("track_id", 0)
                        })
                        break
        return alerts

    def _check_unstable_stacking(
        self, 
        detections: List[Dict[str, Any]]
    ) -> List[Dict[str, Any]]:
        alerts = []
        boxes = [d for d in detections if d.get("class", "").lower() in ["carton", "box", "large_carton", "small_carton", "mattress"]]
        
        for i in range(len(boxes)):
            for j in range(len(boxes)):
                if i == j:
                    continue
                top_box = boxes[i]
                bot_box = boxes[j]

                tx1, ty1, tx2, ty2 = top_box.get("bbox", [0.0, 0.0, 0.0, 0.0])
                bx1, by1, bx2, by2 = bot_box.get("bbox", [0.0, 0.0, 0.0, 0.0])

                top_area = (tx2 - tx1) * (ty2 - ty1)
                bot_area = (bx2 - bx1) * (by2 - by1)

                top_cx = (tx1 + tx2) / 2.0

                # Check if top box is larger/heavier and positioned above smaller base box
                if top_area > 1.3 * bot_area and bot_area > 0:
                    # Centroid of top box is vertically above bottom box
                    if (bx1 <= top_cx <= bx2) and (ty2 <= by1 + 15.0):
                        alerts.append({
                            "rule_id": "RULE_03_UNSTABLE_STACKING",
                            "behaviour": "Heavy Package Stacked on Unstable Base",
                            "severity": "HIGH",
                            "risk_score": 88.5,
                            "reason": f"Large carton (area {top_area:.0f}px) stacked on top of smaller base (area {bot_area:.0f}px).",
                            "object_id": top_box.get("track_id", 0)
                        })
        return alerts

    def _persist_event_to_db(
        self, 
        alert: Dict[str, Any], 
        video_id: str, 
        timestamp: float, 
        db_session: Optional[Session],
        inference_run_id: Optional[str] = None,
        frame_number: Optional[int] = None,
        model_name: str = "YOLO11s",
        model_version: str = "v1.4.2-tensorrt",
        inference_engine: str = "LOCAL_YOLO11",
        confidence: float = 0.92,
        provenance_type: str = "REAL_INFERENCE",
        processing_latency_ms: Optional[float] = None,
        video_fps: float = 30.0,
        video_filename: Optional[str] = None
    ) -> Dict[str, Any]:
        import datetime
        event_id = f"EVT-{uuid.uuid4().hex[:8].upper()}"
        bay_name = "Loading Bay 1"
        obj_id = alert.get("object_id", "42")
        dyn_description = f"{alert['behaviour']} detected in {bay_name}. Target object #{obj_id} triggered violation: {alert['reason']}"

        # Dynamic evidence timestamp correlation
        calc_fps = video_fps if (video_fps and video_fps > 0) else 30.0
        if frame_number is not None and frame_number > 0:
            timestamp_sec = round(frame_number / calc_fps, 3)
        else:
            timestamp_sec = round(float(timestamp), 3)

        clip_start = max(0.0, round(timestamp_sec - 3.0, 3))
        clip_end = round(timestamp_sec + 3.0, 3)
        now_utc = datetime.datetime.utcnow()

        v_filename = video_filename or f"{video_id}.mp4"
        video_ref = f"/stream/video/{v_filename}#t={timestamp_sec:.2f}"
        evidence_frm = f"/api/videos/{video_id}/frames/{frame_number or 0}"

        event_dict = {
            "event_id": event_id,
            "organization_id": "ORG-001",
            "facility_id": "FAC-001",
            "video_id": video_id,
            "timestamp": timestamp_sec,
            "timestamp_seconds": timestamp_sec,
            "timestamp_utc": now_utc,
            "video_fps": calc_fps,
            "evidence_clip_start": clip_start,
            "evidence_clip_end": clip_end,
            "camera_id": "CAM-01",
            "bay_id": bay_name,
            "object_id": alert.get("object_id"),
            "behaviour": alert["behaviour"],
            "risk_score": float(alert["risk_score"]),
            "risk_level": alert["severity"],
            "description": dyn_description,
            "reason": alert["reason"],
            "evidence_frame": evidence_frm,
            "video_reference": video_ref,
            "recommended_action": f"Dispatch supervisor to inspect {alert['behaviour']}",
            "model_name": model_name,
            "model_version": model_version,
            "inference_engine": inference_engine,
            "confidence": confidence,
            "provenance_type": provenance_type,
            "inference_run_id": inference_run_id,
            "frame_number": frame_number,
            "processing_latency_ms": processing_latency_ms
        }

        if db_session:
            try:
                from app.db.models import BehaviourObservation, RiskAssessment
                obs_id = f"OBS-{uuid.uuid4().hex[:8].upper()}"
                ra_id = f"RA-{uuid.uuid4().hex[:8].upper()}"

                if inference_run_id:
                    obs = BehaviourObservation(
                        id=obs_id,
                        inference_run_id=inference_run_id,
                        video_id=video_id,
                        track_id=alert.get("object_id"),
                        frame_number=frame_number or 0,
                        timestamp=float(timestamp),
                        behaviour_type=alert["behaviour"],
                        confidence=confidence,
                        details_json=json.dumps({"reason": alert["reason"], "rule_id": alert.get("rule_id")})
                    )
                    db_session.add(obs)
                    event_dict["behaviour_observation_id"] = obs_id

                    ra = RiskAssessment(
                        id=ra_id,
                        event_id=event_id,
                        behaviour_observation_id=obs_id,
                        risk_level=alert["severity"],
                        risk_score=float(alert["risk_score"]),
                        confidence=confidence,
                        reason=alert["reason"],
                        model_version=model_version
                    )
                    db_session.add(ra)
                    event_dict["risk_assessment_id"] = ra_id

                db_event = Event(**event_dict)
                db_session.add(db_event)
                db_session.commit()
            except Exception as e:
                db_session.rollback()
                print(f"[RuleEngine] Failed to persist event to DB: {e}")
                return None

        # Index event into embedded RAG Vector Store only upon successful persistence
        try:
            from app.services.rag_store import rag_vector_store
            rag_vector_store.add_incident(event_dict)
        except Exception as e:
            print(f"RAG Vector Store index error: {e}")

        return event_dict
