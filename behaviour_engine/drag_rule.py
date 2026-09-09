"""
Product Drag Rule: Detects sustained horizontal movement of an object along floor level.
"""

import math
from typing import Dict, List
from behaviour_engine.base_rule import BaseRule, BehaviourCandidate, TrajectoryContext
from behaviour_engine.geometry import is_near_floor
from behaviour_engine.motion import (
    TrackPoint,
    frame_displacement,
    sanitize_track,
    track_velocity,
)


class DragRule(BaseRule):
    """
    Detects continuous horizontal sliding/dragging of items along the floor.
    Conditions:
      1. Target object must be a valid product class (carton).
      2. Object bottom remains within floor region (floor_compliance >= 0.70).
      3. Net horizontal displacement exceeds threshold (dx >= drag_min_horizontal_displacement_px).
      4. Vertical variation is small compared to horizontal travel (vertical_spread <= 55px).
      5. Sustained duration exceeds drag_min_duration_seconds (>= 0.8s).
      6. Nearby person / physical contact verified via edge-aware bounding box proximity.
    """

    VALID_PRODUCT_CLASSES = {"carton"}

    @property
    def rule_name(self) -> str:
        return "drag_rule"

    @property
    def behaviour_type(self) -> str:
        return "product_dragged"

    def _get_majority_class(self, points: List[TrackPoint]) -> str:
        classes = [p.class_name for p in points if p.class_name]
        if not classes:
            return "unknown"
        return max(set(classes), key=classes.count)

    def _check_worker_proximity(
        self,
        window: List[TrackPoint],
        person_points_by_frame: Dict[int, List[TrackPoint]],
        max_edge_dist: float = 120.0,
    ) -> bool:
        """
        Computes edge-aware bounding box distance between carton and person tracks
        across the drag window. Handles large products (e.g. cupboards) where
        centroid distance can exceed 250px despite physical contact or overlap.
        """
        for p_tgt in window:
            persons = person_points_by_frame.get(p_tgt.frame, [])
            for opt in persons:
                dx = max(0.0, abs(p_tgt.x - opt.x) - (p_tgt.width + opt.width) / 2.0)
                dy = max(0.0, abs(p_tgt.y - opt.y) - (p_tgt.height + opt.height) / 2.0)
                if math.hypot(dx, dy) <= max_edge_dist:
                    return True
        return False

    def evaluate(self, context: TrajectoryContext) -> List[BehaviourCandidate]:
        points = sanitize_track(context.target_points)
        if len(points) < self.config.min_track_frames:
            return []

        # 1. Product class filter: cartons only (rejects human worker tracks)
        majority_class = self._get_majority_class(points)
        if majority_class not in self.VALID_PRODUCT_CLASSES:
            return []

        candidates: List[BehaviourCandidate] = []
        n = len(points)
        min_frames = max(4, int(round(self.config.drag_min_duration_seconds * context.fps)))

        # Index person points by frame for fast proximity checks
        person_points_by_frame: Dict[int, List[TrackPoint]] = {}
        for other_id, other_pts in context.all_tracks.items():
            if other_id == context.target_object_id:
                continue
            for opt in other_pts:
                if opt.class_name == "person":
                    person_points_by_frame.setdefault(opt.frame, []).append(opt)

        i = 0
        while i < n - min_frames:
            p_start = points[i]
            found_drag = False

            # Check if start is near floor
            if not is_near_floor(p_start.y, p_start.height, context.frame_height, self.config.floor_y_ratio):
                i += 1
                continue

            for j in range(i + min_frames, min(n, i + min_frames * 3)):
                p_end = points[j]
                dx, dy, dist = frame_displacement(p_start, p_end)

                # Must be primarily horizontal
                if abs(dx) >= self.config.drag_min_horizontal_displacement_px:
                    # Check that vertical deviation remains bounded (dragging on floor)
                    window = points[i : j + 1]
                    y_coords = [p.y for p in window]
                    vertical_spread = max(y_coords) - min(y_coords)

                    # All points in window should be reasonably near floor
                    floor_compliance = sum(
                        1 for p in window
                        if is_near_floor(p.y, p.height, context.frame_height, self.config.floor_y_ratio - 0.1)
                    ) / len(window)

                    if vertical_spread <= self.config.drag_max_vertical_deviation_px and floor_compliance >= 0.70:
                        # Require worker interaction / proximity during dragging
                        worker_nearby = self._check_worker_proximity(
                            window,
                            person_points_by_frame,
                            max_edge_dist=120.0,
                        )
                        if not worker_nearby:
                            continue

                        duration_s = (p_end.frame - p_start.frame) / context.fps
                        vx, vy, speed = track_velocity(p_start, p_end, context.fps)

                        confidence = min(
                            0.95,
                            0.70
                            + (0.15 if worker_nearby else 0.0)
                            + (0.10 if floor_compliance > 0.90 else 0.05),
                        )

                        evidence = {
                            "horizontal_displacement_px": round(abs(dx), 1),
                            "duration_seconds": round(duration_s, 2),
                            "average_speed_px_s": round(speed, 1),
                            "vertical_spread_px": round(vertical_spread, 1),
                            "floor_compliance_ratio": round(floor_compliance, 2),
                            "worker_nearby": worker_nearby,
                        }

                        desc = (
                            f"Product dragged across floor: {abs(dx):.0f}px horizontal distance "
                            f"over {duration_s:.2f}s at {speed:.0f}px/s."
                        )

                        candidate = BehaviourCandidate(
                            rule_name=self.rule_name,
                            behaviour_type=self.behaviour_type,
                            object_id=context.target_object_id,
                            start_frame=p_start.frame,
                            end_frame=p_end.frame,
                            confidence=round(confidence, 2),
                            primary_measurement=round(abs(dx), 1),
                            evidence=evidence,
                            description=desc,
                        )
                        candidates.append(candidate)
                        i = j  # Skip to end of this drag event
                        found_drag = True
                        break

            if not found_drag:
                i += 1

        return candidates
