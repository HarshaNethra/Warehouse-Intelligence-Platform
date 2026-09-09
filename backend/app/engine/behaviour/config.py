"""
Centralized Configuration & Numerical Thresholds for the Behaviour Engine.

All spatial, kinematic, and temporal thresholds used across behaviour rules are defined here.
No rule file should hardcode arbitrary constants.
"""

from dataclasses import dataclass, field
from typing import Dict, Optional, Tuple


@dataclass(frozen=True)
class BehaviourConfig:
    """
    Central parameters for Behaviour Detection.

    Units:
        - Distances/Displacements: pixels (px)
        - Speeds/Velocities: pixels per second (px/s)
        - Accelerations: pixels per second squared (px/s²)
        - Durations: seconds (s)
        - Rates/Ratios: dimensionless fractions [0.0, 1.0]
    """

    # -------------------------------------------------------------------------
    # Video & Environment Defaults
    # -------------------------------------------------------------------------
    default_fps: float = 30.0
    """Default frames per second if not inferrable from video metadata."""

    frame_width: int = 1280
    """Standard CCTV frame width in pixels."""

    frame_height: int = 720
    """Standard CCTV frame height in pixels."""

    floor_y_ratio: float = 0.60
    """
    Fraction of frame height below which an object is considered near floor level.
    e.g. 720 * 0.60 = 432 px. Y coordinates > 432 are in the lower warehouse floor zone.
    Needs tuning if camera angle/elevation shifts significantly.
    """

    # -------------------------------------------------------------------------
    # Kinematic & Motion Thresholds
    # -------------------------------------------------------------------------
    min_track_frames: int = 4
    """Minimum consecutive observations required before evaluating kinematics on a track."""

    stationary_max_speed_px_s: float = 25.0
    """Maximum velocity (px/s) under which an object is considered stationary / at rest."""

    sudden_impact_decel_threshold_px_s2: float = 450.0
    """Deceleration magnitude indicating sudden jarring stop or physical impact with floor/carton."""

    # -------------------------------------------------------------------------
    # 1. Product Drop Rule
    # -------------------------------------------------------------------------
    drop_min_vertical_displacement_px: float = 65.0
    """
    Minimum downward vertical travel (dy > 0) to qualify as a drop event.
    Prevents tiny jitters or minor hand adjustments from triggering drops.
    """

    drop_min_vertical_velocity_px_s: float = 200.0
    """Minimum downward velocity (px/s) during descent."""

    drop_max_horizontal_ratio: float = 1.2
    """Maximum ratio of |dx| / dy allowed during descent (drops are primarily vertical)."""

    drop_post_stationary_seconds: float = 0.35
    """Minimum seconds an object must remain stationary after landing to confirm a drop."""

    # -------------------------------------------------------------------------
    # 2. Product Drag Rule
    # -------------------------------------------------------------------------
    drag_min_horizontal_displacement_px: float = 75.0
    """Minimum net horizontal movement along floor level."""

    drag_min_duration_seconds: float = 0.8
    """Minimum sustained dragging duration."""

    drag_max_vertical_deviation_px: float = 55.0
    """Maximum vertical oscillation permitted during dragging (dragging remains near floor)."""

    drag_min_speed_px_s: float = 35.0
    """Minimum horizontal speed to differentiate dragging from idling."""

    # -------------------------------------------------------------------------
    # 3. Product Throw Rule
    # -------------------------------------------------------------------------
    throw_min_speed_px_s: float = 300.0
    """Peak projectile speed required for a throw candidate."""

    throw_min_displacement_px: float = 90.0
    """Minimum displacement across the ballistic arc."""

    throw_min_frames: int = 5
    """Minimum observation duration for projectile flight."""

    # -------------------------------------------------------------------------
    # 4. Rough Handling / Rolling / Impact Rule
    # -------------------------------------------------------------------------
    rough_aspect_ratio_change_threshold: float = 0.35
    """
    Fractional change in bounding box aspect ratio (w/h) between consecutive windows,
    indicating rolling, tumbling, or flipping of boxes.
    """

    rough_min_acceleration_px_s2: float = 400.0
    """Acceleration spike threshold indicating violent push, kick, or impact."""

    rough_min_speed_px_s: float = 120.0
    """Minimum speed during the rough handling episode."""

    # -------------------------------------------------------------------------
    # 5. Stacking & Placement Rules
    # -------------------------------------------------------------------------
    stack_min_horizontal_overlap: float = 0.35
    """Minimum horizontal overlap fraction between two vertically adjacent boxes."""

    stack_max_vertical_gap_px: float = 40.0
    """Maximum vertical pixel gap between top of lower box and bottom of upper box."""

    # -------------------------------------------------------------------------
    # 6. Unstable Stacking Rule
    # -------------------------------------------------------------------------
    unstable_overhang_threshold: float = 0.30
    """
    Overhang fraction (horizontal misalignment / lower box width).
    If upper box extends > 30% beyond the support base, it is flagged as potentially unstable.
    """

    # -------------------------------------------------------------------------
    # 7. Designated Hazard Area Rule
    # -------------------------------------------------------------------------
    dock_edge_x_threshold: Optional[float] = None
    """
    Deprecated / unverified 2D threshold. Must not be used as a generic hazard ledge.
    """

    wet_floor_roi: Optional[Tuple[float, float, float, float]] = None
    """
    Deprecated / unverified 2D ROI. Must not be used as a generic wet-floor zone.
    """

    verified_hazard_zones: Tuple[Tuple[float, float, float, float], ...] = ()
    """
    Explicitly calibrated (x1, y1, x2, y2) hazard zones for cameras where danger
    boundaries (e.g. drop-offs, chemical zones, slip hazards) are known and verified.
    If empty (default), no designated_area_violation events are generated.
    """

    # -------------------------------------------------------------------------
    # 8. Equipment Rule
    # -------------------------------------------------------------------------
    heavy_object_area_px2: float = 100000.0
    """
    Bounding box area (w * h) threshold suggesting a bulky/heavy item
    (e.g., full cupboard, large furniture) requiring mechanical handling equipment.
    """

    # -------------------------------------------------------------------------
    # 9. Sequence Rule (e.g. Stepping on Cartons)
    # -------------------------------------------------------------------------
    stepping_vertical_overlap_ratio: float = 0.25
    """Vertical intersection ratio between person bottom and carton top indicating stepping."""

    stepping_min_duration_seconds: float = 0.5
    """Minimum duration a person remains elevated on cartons."""

    # -------------------------------------------------------------------------
    # Temporal & Debounce Parameters
    # -------------------------------------------------------------------------
    cooldown_frames: int = 40
    """
    Frames to suppress repeated firing of the same rule on the same object.
    At 30 fps, 40 frames = 1.33 seconds cooldown.
    """

    sliding_window_size: int = 15
    """Sliding window size (frames) for instantaneous kinematic calculations (~0.5s at 30 fps)."""


# Global default configuration instance
DEFAULT_CONFIG = BehaviourConfig()
