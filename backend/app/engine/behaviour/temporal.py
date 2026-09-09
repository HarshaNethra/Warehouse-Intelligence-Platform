"""
Temporal utilities, sliding window buffers, persistence verification,
debounce managers, and candidate deduplication for behaviour detection.
"""

from typing import Any, Callable, Dict, Generator, List, Optional, Set, Tuple
from app.engine.behaviour.motion import TrackPoint, sanitize_track, is_stationary


def sliding_windows(points: List[TrackPoint],
                    window_size: int = 15,
                    step: int = 1) -> Generator[List[TrackPoint], None, None]:
    """
    Yields sliding window slices over a sequence of TrackPoints.
    Each window has length <= window_size.
    """
    clean = sanitize_track(points)
    if not clean or window_size <= 0:
        return

    n = len(clean)
    for i in range(0, n - window_size + 1, step):
        yield clean[i : i + window_size]


def check_persistence(points: List[TrackPoint],
                      predicate: Callable[[TrackPoint, TrackPoint], bool],
                      min_consecutive_frames: int = 3) -> bool:
    """
    Checks if a condition between consecutive points persists for at least
    min_consecutive_frames.
    """
    clean = sanitize_track(points)
    if len(clean) < min_consecutive_frames:
        return False

    current_streak = 1
    for i in range(1, len(clean)):
        if predicate(clean[i - 1], clean[i]):
            current_streak += 1
            if current_streak >= min_consecutive_frames:
                return True
        else:
            current_streak = 1

    return False


def post_event_stationary(subsequent_points: List[TrackPoint],
                          required_duration_seconds: float = 0.35,
                          max_displacement_px: float = 25.0,
                          fps: float = 30.0) -> bool:
    """
    Verifies that an object settles and remains stationary following an impact/placement.
    """
    clean = sanitize_track(subsequent_points)
    if not clean:
        return False

    required_frames = int(round(required_duration_seconds * fps))
    if len(clean) < max(2, required_frames):
        # If track ended prematurely right after impact, evaluate whatever tail exists
        pass

    window = clean[: max(2, required_frames)]
    return is_stationary(window, max_displacement_px=max_displacement_px, fps=fps)


class DebounceManager:
    """
    Prevents repeated triggering of the same behaviour rule on the same object.
    Maintains a cooldown counter in frames for each (rule_name, object_id) key.
    """

    def __init__(self, default_cooldown_frames: int = 40):
        self.default_cooldown_frames = default_cooldown_frames
        self._last_trigger_frame: Dict[Tuple[str, int], int] = {}

    def can_trigger(self, rule_name: str, object_id: int, current_frame: int,
                    custom_cooldown: Optional[int] = None) -> bool:
        """Returns True if cooldown period has elapsed since last trigger."""
        cooldown = custom_cooldown if custom_cooldown is not None else self.default_cooldown_frames
        key = (rule_name, object_id)
        if key not in self._last_trigger_frame:
            return True

        elapsed = current_frame - self._last_trigger_frame[key]
        return elapsed >= cooldown

    def register_trigger(self, rule_name: str, object_id: int, current_frame: int) -> None:
        """Records a successful trigger at current_frame."""
        self._last_trigger_frame[(rule_name, object_id)] = current_frame

    def reset(self) -> None:
        """Resets all cooldown states."""
        self._last_trigger_frame.clear()


def merge_overlapping_candidates(candidates: List[Any],
                                 overlap_frame_threshold: int = 30) -> List[Any]:
    """
    Merges candidate detections of the same behaviour on the same object that overlap in time.
    Keeps the candidate with higher confidence or merges start/end spans.
    """
    if not candidates:
        return []

    # Group by (behaviour_type, object_id)
    grouped: Dict[Tuple[str, int], List[Any]] = {}
    for c in candidates:
        key = (c.behaviour_type, c.object_id)
        grouped.setdefault(key, []).append(c)

    merged_results: List[Any] = []

    for _, group in grouped.items():
        # Sort by start frame
        sorted_c = sorted(group, key=lambda x: x.start_frame)
        current = sorted_c[0]

        for nxt in sorted_c[1:]:
            # If next candidate starts before current ends + threshold: merge
            if nxt.start_frame <= (current.end_frame + overlap_frame_threshold):
                # Extend current end frame and keep max confidence
                new_end = max(current.end_frame, nxt.end_frame)
                new_conf = max(current.confidence, nxt.confidence)
                # Keep richer evidence
                merged_evidence = {**current.evidence, **nxt.evidence}
                
                # Reconstruct merged candidate (dataclass replace)
                current = current.__class__(
                    rule_name=current.rule_name,
                    behaviour_type=current.behaviour_type,
                    object_id=current.object_id,
                    start_frame=current.start_frame,
                    end_frame=new_end,
                    confidence=round(new_conf, 2),
                    primary_measurement=max(current.primary_measurement, nxt.primary_measurement),
                    evidence=merged_evidence,
                    description=current.description,
                )
            else:
                merged_results.append(current)
                current = nxt

        merged_results.append(current)

    # Sort final merged output by start frame
    return sorted(merged_results, key=lambda x: x.start_frame)


def resolve_incident_overlaps(candidates: List[Any], fps: float = 30.0) -> List[Any]:
    """
    Resolves cross-behaviour overlaps and deduplicates multiple detections
    representing the same physical incident on the same object.

    Rules:
    1. Subsume generic rough_handling when it substantially overlaps (>= 50%
       of its duration) a more specific physical behaviour (product_thrown,
       product_dropped, product_dragged) on the same object. Peak acceleration
       telemetry is merged into the specific behaviour's evidence. Standalone
       rough_handling is fully preserved.
    2. Continuous Throw + Drop Unification:
       When a product_dropped detection represents the landing/impact phase of a
       product_thrown trajectory on the same object (starts during flight or
       within 0.30s of throw conclusion without intermediate stationary rest or
       intervening action), unify the drop into product_thrown, enriching it with
       landing impact telemetry.
       Distinct sequential drops (separated by > 0.40s or an intervening action)
       are preserved.
    3. Genuinely distinct sequential actions (e.g. product_thrown followed by
       product_dragged along the floor, or sequential throws) are fully preserved.
    """
    if not candidates:
        return []

    SPECIFIC_MOTION_TYPES = {"product_thrown", "product_dropped", "product_dragged"}
    max_throw_landing_gap_frames = int(round(0.30 * fps))

    # Group candidates by object_id
    by_object: Dict[int, List[Any]] = {}
    for c in candidates:
        by_object.setdefault(c.object_id, []).append(c)

    resolved: List[Any] = []

    for obj_id, obj_cands in by_object.items():
        if len(obj_cands) <= 1:
            resolved.extend(obj_cands)
            continue

        # Sort candidates chronologically
        sorted_cands = sorted(obj_cands, key=lambda x: (x.start_frame, x.end_frame))
        suppressed_ids: Set[int] = set()

        # Step 1: Subsume generic rough_handling overlapping specific actions
        rough_cands = [c for c in sorted_cands if c.behaviour_type == "rough_handling"]
        specific_cands = [c for c in sorted_cands if c.behaviour_type in SPECIFIC_MOTION_TYPES]

        for rh in rough_cands:
            rh_dur = max(1, rh.end_frame - rh.start_frame)
            best_match: Optional[Any] = None
            max_overlap = 0

            for sp in specific_cands:
                overlap_start = max(rh.start_frame, sp.start_frame)
                overlap_end = min(rh.end_frame, sp.end_frame)
                overlap = max(0, overlap_end - overlap_start)
                if overlap > max_overlap:
                    max_overlap = overlap
                    best_match = sp

            if best_match and (max_overlap / rh_dur) >= 0.50:
                # Subsume rough handling into specific candidate
                suppressed_ids.add(id(rh))
                # Merge telemetry into specific candidate
                rh_acc = rh.evidence.get("max_acceleration_px_s2", rh.primary_measurement)
                existing_acc = best_match.evidence.get("max_acceleration_px_s2", 0.0)
                best_match.evidence["max_acceleration_px_s2"] = max(existing_acc, rh_acc)
                best_match.evidence["subsumed_rough_handling"] = True

        # Step 2: Unify continuous Throw -> Drop arcs
        thrown_cands = [c for c in sorted_cands if c.behaviour_type == "product_thrown" and id(c) not in suppressed_ids]
        dropped_cands = [c for c in sorted_cands if c.behaviour_type == "product_dropped" and id(c) not in suppressed_ids]
        dragged_cands = [c for c in sorted_cands if c.behaviour_type == "product_dragged" and id(c) not in suppressed_ids]

        for drop in dropped_cands:
            for throw in thrown_cands:
                # Check if drop represents the landing phase of this throw
                starts_after_throw_launch = drop.start_frame >= (throw.start_frame - int(round(0.15 * fps)))
                starts_before_landing_cutoff = drop.start_frame <= (throw.end_frame + max_throw_landing_gap_frames)
                ends_after_throw_start = drop.end_frame >= throw.start_frame

                if starts_after_throw_launch and starts_before_landing_cutoff and ends_after_throw_start:
                    # Check if there is an intervening drag between throw and drop
                    has_intervening_drag = any(
                        throw.end_frame <= drag.start_frame and drag.end_frame <= drop.start_frame
                        for drag in dragged_cands
                    )
                    if not has_intervening_drag:
                        # Unified continuous throw + landing drop!
                        suppressed_ids.add(id(drop))
                        throw.end_frame = max(throw.end_frame, drop.end_frame)
                        throw.confidence = round(max(throw.confidence, drop.confidence), 2)
                        throw.evidence["landing_drop"] = {
                            "drop_start_frame": drop.start_frame,
                            "drop_end_frame": drop.end_frame,
                            "impact_drop_height_px": drop.evidence.get("drop_height_px", drop.primary_measurement),
                            "max_downward_speed_px_s": drop.evidence.get("max_downward_speed_px_s", 0.0),
                        }
                        break

        # Collect non-suppressed candidates
        for c in sorted_cands:
            if id(c) not in suppressed_ids:
                resolved.append(c)

    # Sort final candidates by start_frame, then end_frame
    return sorted(resolved, key=lambda x: (x.start_frame, x.end_frame))
