"""
Unstable Stacking Rule: Detects precarious alignment, excessive overhang, or tipping hazard.
"""

from typing import Dict, List
from behaviour_engine.base_rule import BaseRule, BehaviourCandidate, TrajectoryContext
from behaviour_engine.geometry import (
    horizontal_overlap_ratio,
    object_above_object,
    to_corners,
)
from behaviour_engine.motion import TrackPoint, sanitize_track, track_velocity


class UnstableStackRule(BaseRule):
    """
    Detects stacks of product cartons with dangerous horizontal overhang or precarious alignment.
    Conditions:
      1. Both target object and supporting/base object must be valid product classes (carton).
      2. Pairings involving a person or non-carton class are strictly rejected.
      3. Supporting/base carton must be stationary or near-stationary (< 25 px/s).
      4. Target carton rests vertically above base carton (gap <= stack_max_vertical_gap_px).
      5. Horizontal overhang beyond lower base exceeds unstable_overhang_threshold (>= 30%).
      6. Unstable stack condition must persist for at least 15 consecutive frames (0.50 s).
    """

    VALID_PRODUCT_CLASSES = {"carton"}

    @property
    def rule_name(self) -> str:
        return "unstable_stack_rule"

    @property
    def behaviour_type(self) -> str:
        return "unstable_stack"

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

        # Evaluate against each potential supporting object
        for other_id, other_track in context.all_tracks.items():
            if other_id == context.target_object_id:
                continue

            other_pts = sanitize_track(other_track)
            if len(other_pts) < min_persist_frames:
                continue

            # 2. Base object must be carton
            if self._get_majority_class(other_pts) not in self.VALID_PRODUCT_CLASSES:
                continue

            # 3. Match frames where both objects exist
            other_by_frame = {p.frame: p for p in other_pts}
            common_frames = sorted(set(target_by_frame.keys()) & set(other_by_frame.keys()))
            if len(common_frames) < min_persist_frames:
                continue

            # Find consecutive frame runs where unstable stack condition holds
            consecutive_run = []
            for f in common_frames:
                p_target = target_by_frame[f]
                p_other = other_by_frame[f]

                target_box = (p_target.x, p_target.y, p_target.width, p_target.height)
                other_box = (p_other.x, p_other.y, p_other.width, p_other.height)

                # Check if target is above other
                if object_above_object(
                    target_box,
                    other_box,
                    max_gap_px=self.config.stack_max_vertical_gap_px,
                    min_horiz_overlap=0.20,
                ):
                    t_x1, _, t_x2, _ = to_corners(*target_box)
                    o_x1, _, o_x2, _ = to_corners(*other_box)

                    left_overhang = max(0.0, o_x1 - t_x1)
                    right_overhang = max(0.0, t_x2 - o_x2)
                    max_overhang = max(left_overhang, right_overhang)
                    overhang_ratio = max_overhang / max(1.0, p_other.width)

                    if overhang_ratio >= self.config.unstable_overhang_threshold:
                        consecutive_run.append((f, max_overhang, overhang_ratio, p_other.width))
                        continue

                # Run broken or condition not met
                if len(consecutive_run) >= min_persist_frames:
                    self._create_candidate(consecutive_run, other_pts, context, other_id, candidates)
                consecutive_run = []

            # Check trailing run
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

        overhangs = [r[1] for r in run]
        ratios = [r[2] for r in run]
        base_widths = [r[3] for r in run]

        avg_overhang = sum(overhangs) / len(overhangs)
        avg_ratio = sum(ratios) / len(ratios)
        avg_base_w = sum(base_widths) / len(base_widths)

        confidence = min(0.92, 0.60 + (avg_ratio * 0.40))
        evidence = {
            "supporting_object_id": other_id,
            "overhang_px": round(avg_overhang, 1),
            "overhang_ratio": round(avg_ratio, 2),
            "lower_width_px": round(avg_base_w, 1),
            "duration_seconds": round(duration_s, 2),
        }

        desc = (
            f"Potentially unstable stack: product ID {context.target_object_id} "
            f"overhangs base ID {other_id} by {avg_ratio*100:.0f}% ({avg_overhang:.0f}px) "
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

