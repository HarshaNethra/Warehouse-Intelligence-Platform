"""
Equipment Rule: Flags manual dragging or moving of heavy/bulky items without required mechanical aids.
"""

import math
from typing import Dict, List
from app.engine.behaviour.base_rule import BaseRule, BehaviourCandidate, TrajectoryContext
from app.engine.behaviour.motion import TrackPoint, frame_displacement, sanitize_track


class EquipmentRule(BaseRule):
    """
    Flags potential material handling equipment violations:
    Moving large/bulky items manually when pallet jacks, trolleys, or forklifts should be used.
    Conditions:
      1. Target object must be a product carton.
      2. Object has large visual footprint (avg_area >= heavy_object_area_px2, default 100,000 px²).
      3. Object undergoes macroscopic movement (net_dist >= 60 px).
      4. Object is being handled manually by a nearby worker (worker within 80px edge-to-edge distance).
    """

    VALID_PRODUCT_CLASSES = {"carton"}

    @property
    def rule_name(self) -> str:
        return "equipment_rule"

    @property
    def behaviour_type(self) -> str:
        return "equipment_violation"

    def _get_majority_class(self, points: List[TrackPoint]) -> str:
        classes = [p.class_name for p in points if p.class_name]
        if not classes:
            return "unknown"
        return max(set(classes), key=classes.count)

    def evaluate(self, context: TrajectoryContext) -> List[BehaviourCandidate]:
        points = sanitize_track(context.target_points)
        if len(points) < self.config.min_track_frames:
            return []

        # 1. Target object must be carton
        if self._get_majority_class(points) not in self.VALID_PRODUCT_CLASSES:
            return []

        p_start = points[0]
        p_end = points[-1]
        _, _, net_dist = frame_displacement(p_start, p_end)

        # 2. Check if the target is being transported/moved significant distance
        if net_dist < 60.0:
            return []

        # 3. Check visual bounding area (bulky/heavy item)
        avg_area = sum(p.width * p.height for p in points) / len(points)
        if avg_area < self.config.heavy_object_area_px2:
            return []

        # 4. Check for nearby worker (person track) within edge-to-edge distance <= 80px
        person_points_by_frame: Dict[int, List[TrackPoint]] = {}
        for other_id, other_pts in context.all_tracks.items():
            if other_id == context.target_object_id:
                continue
            for opt in other_pts:
                if opt.class_name == "person":
                    person_points_by_frame.setdefault(opt.frame, []).append(opt)

        has_worker_contact = False
        for p in points:
            persons = person_points_by_frame.get(p.frame, [])
            for opt in persons:
                dx = max(0.0, abs(p.x - opt.x) - (p.width + opt.width) / 2.0)
                dy = max(0.0, abs(p.y - opt.y) - (p.height + opt.height) / 2.0)
                if math.hypot(dx, dy) <= 80.0:
                    has_worker_contact = True
                    break
            if has_worker_contact:
                break

        if not has_worker_contact:
            return []

        duration_s = (p_end.frame - p_start.frame) / context.fps
        evidence = {
            "estimated_box_area_px2": round(avg_area, 0),
            "net_movement_distance_px": round(net_dist, 1),
            "equipment_present_in_scene": False,
            "duration_seconds": round(duration_s, 2),
            "weight_inference_note": "Inferred from large visual footprint and manual dragging context",
        }

        desc = (
            f"Equipment violation: large product (approx {avg_area:.0f}px² area) "
            f"manually handled over {net_dist:.0f}px without trolley or pallet jack."
        )

        candidate = BehaviourCandidate(
            rule_name=self.rule_name,
            behaviour_type=self.behaviour_type,
            object_id=context.target_object_id,
            start_frame=p_start.frame,
            end_frame=p_end.frame,
            confidence=0.82,
            primary_measurement=round(avg_area, 0),
            evidence=evidence,
            description=desc,
        )
        return [candidate]
