"""
Stacking Rule: Detects spatial stacking relationships between products.
"""

from typing import Dict, List
from behaviour_engine.base_rule import BaseRule, BehaviourCandidate, TrajectoryContext
from behaviour_engine.geometry import (
    horizontal_overlap_ratio,
    object_above_object,
)
from behaviour_engine.motion import TrackPoint, sanitize_track, track_velocity


class StackingRule(BaseRule):
    """
    Evaluates vertical stacking arrangement of products.
    Flags improper stacking where a significantly larger/heavier carton is placed directly on top of
    a smaller supporting carton.
    Conditions:
      1. Both target object and supporting base object must be valid product classes (carton).
      2. Pairings involving a person or non-carton class are strictly rejected.
      3. Supporting/base carton must be stationary or near-stationary (< 25 px/s).
      4. Target carton rests vertically above base carton (gap <= stack_max_vertical_gap_px).
      5. Upper box area exceeds lower box area by area_ratio >= 1.35.
      6. Stacking relationship must persist for at least 15 consecutive frames (0.50 s).
    """

    VALID_PRODUCT_CLASSES = {"carton"}

    @property
    def rule_name(self) -> str:
        return "stacking_rule"

    @property
    def behaviour_type(self) -> str:
        return "improper_stacking"

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

        candidates: List[BehaviourCandidate] = []
        target_by_frame = {p.frame: p for p in points}
        min_persist_frames = max(15, int(round(0.50 * context.fps)))

        for other_id, other_track in context.all_tracks.items():
            if other_id == context.target_object_id:
                continue

            other_pts = sanitize_track(other_track)
            if len(other_pts) < min_persist_frames:
                continue

            # 2. Base object must be carton
            if self._get_majority_class(other_pts) not in self.VALID_PRODUCT_CLASSES:
                continue

            other_by_frame = {p.frame: p for p in other_pts}
            common_frames = sorted(set(target_by_frame.keys()) & set(other_by_frame.keys()))
            if len(common_frames) < min_persist_frames:
                continue

            consecutive_run = []
            for f in common_frames:
                p_target = target_by_frame[f]
                p_other = other_by_frame[f]

                target_box = (p_target.x, p_target.y, p_target.width, p_target.height)
                other_box = (p_other.x, p_other.y, p_other.width, p_other.height)

                if object_above_object(
                    target_box,
                    other_box,
                    max_gap_px=self.config.stack_max_vertical_gap_px,
                    min_horiz_overlap=self.config.stack_min_horizontal_overlap,
                ):
                    target_area = p_target.width * p_target.height
                    other_area = p_other.width * p_other.height
                    area_ratio = target_area / max(1.0, other_area)

                    if area_ratio >= 1.35:
                        h_overlap = horizontal_overlap_ratio(target_box, other_box)
                        consecutive_run.append((f, target_area, other_area, area_ratio, h_overlap))
                        continue

                if len(consecutive_run) >= min_persist_frames:
                    self._create_candidate(consecutive_run, other_pts, context, other_id, candidates)
                consecutive_run = []

            if len(consecutive_run) >= min_persist_frames:
                self._create_candidate(consecutive_run, other_pts, context, other_id, candidates)

        return candidates

    def _create_candidate(
        self,
        run: List,
        other_pts: List[TrackPoint],
        context: TrajectoryContext,
        other_id: int,
        candidates: List[BehaviourCandidate],
    ):
        start_f = run[0][0]
        end_f = run[-1][0]
        duration_s = (end_f - start_f + 1) / context.fps

        # Check base stationary velocity across the run
        base_run_pts = [p for p in other_pts if start_f <= p.frame <= end_f]
        if base_run_pts:
            p_b_start, p_b_end = base_run_pts[0], base_run_pts[-1]
            _, _, base_speed = track_velocity(p_b_start, p_b_end, context.fps)
            if base_speed >= self.config.stationary_max_speed_px_s:
                return

        target_areas = [r[1] for r in run]
        other_areas = [r[2] for r in run]
        area_ratios = [r[3] for r in run]
        h_overlaps = [r[4] for r in run]

        avg_target_area = sum(target_areas) / len(target_areas)
        avg_other_area = sum(other_areas) / len(other_areas)
        avg_ratio = sum(area_ratios) / len(area_ratios)
        avg_h_overlap = sum(h_overlaps) / len(h_overlaps)

        confidence = min(0.90, 0.65 + (0.20 if avg_ratio > 1.8 else 0.10))
        evidence = {
            "supporting_object_id": other_id,
            "upper_box_area": round(avg_target_area, 0),
            "lower_box_area": round(avg_other_area, 0),
            "area_ratio": round(avg_ratio, 2),
            "horizontal_overlap": round(avg_h_overlap, 2),
            "duration_seconds": round(duration_s, 2),
        }

        desc = (
            f"Improper stacking: larger product (ID {context.target_object_id}) "
            f"placed on smaller supporting base (ID {other_id}) with area ratio {avg_ratio:.2f} "
            f"persisting over {len(run)} frames ({duration_s:.2f}s)."
        )

        candidate = BehaviourCandidate(
            rule_name=self.rule_name,
            behaviour_type=self.behaviour_type,
            object_id=context.target_object_id,
            start_frame=start_f,
            end_frame=end_f,
            confidence=round(confidence, 2),
            primary_measurement=round(avg_ratio, 2),
            evidence=evidence,
            description=desc,
        )
        candidates.append(candidate)

