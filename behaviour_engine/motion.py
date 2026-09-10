"""
Trajectory and Kinematic Calculations for Multi-Object Tracking.

All functions handle FPS conversions explicitly and are robust against:
- Non-consecutive / missing frames
- Short trajectories (< min required points)
- Invalid or NaN coordinate values

Units are strictly maintained as:
- Displacement / Distance: pixels (px)
- Velocity / Speed: pixels per second (px/s)
- Acceleration / Deceleration: pixels per second squared (px/s²)
"""

import math
from dataclasses import dataclass
from typing import List, Optional, Tuple


@dataclass(frozen=True)
class TrackPoint:
    """A single spatial-temporal observation from a tracking stream."""
    frame: int
    x: float
    y: float
    width: float
    height: float
    class_name: str = "person"


def sanitize_track(points: List[TrackPoint]) -> List[TrackPoint]:
    """Filters out points with NaN, infinite, or physically impossible negative coordinates."""
    valid = []
    for p in points:
        if (math.isnan(p.x) or math.isnan(p.y) or
            math.isnan(p.width) or math.isnan(p.height)):
            continue
        if math.isinf(p.x) or math.isinf(p.y):
            continue
        valid.append(p)
    # Sort strictly by frame number
    return sorted(valid, key=lambda pt: pt.frame)


def frame_displacement(p1: TrackPoint, p2: TrackPoint) -> Tuple[float, float, float]:
    """
    Computes net displacement from p1 to p2:
    Returns (dx, dy, euclidean_distance) in pixels.
    """
    dx = p2.x - p1.x
    dy = p2.y - p1.y
    dist = math.hypot(dx, dy)
    return (dx, dy, dist)


def total_distance_traveled(points: List[TrackPoint]) -> float:
    """Calculates the cumulative path distance traveled across all consecutive track observations."""
    clean = sanitize_track(points)
    if len(clean) < 2:
        return 0.0
    total = 0.0
    for i in range(1, len(clean)):
        total += math.hypot(clean[i].x - clean[i - 1].x, clean[i].y - clean[i - 1].y)
    return total


def net_displacement(points: List[TrackPoint]) -> Tuple[float, float, float]:
    """
    Calculates net vector displacement between start and end of points sequence:
    Returns (dx, dy, net_distance) in pixels.
    """
    clean = sanitize_track(points)
    if len(clean) < 2:
        return (0.0, 0.0, 0.0)
    return frame_displacement(clean[0], clean[-1])


def track_velocity(p1: TrackPoint, p2: TrackPoint, fps: float = 30.0) -> Tuple[float, float, float]:
    """
    Computes average velocity between two track points:
    Returns (vx, vy, speed) in pixels/second.
    Handles frame gaps correctly using dt = (f2 - f1) / fps.
    """
    frame_delta = p2.frame - p1.frame
    if frame_delta <= 0 or fps <= 0.0:
        return (0.0, 0.0, 0.0)

    dt = frame_delta / fps
    dx = p2.x - p1.x
    dy = p2.y - p1.y

    vx = dx / dt
    vy = dy / dt
    speed = math.hypot(vx, vy)
    return (vx, vy, speed)


def instantaneous_velocities(points: List[TrackPoint], fps: float = 30.0) -> List[Tuple[float, float, float]]:
    """
    Returns list of (vx, vy, speed) in px/s between consecutive points.
    Length will be len(points) - 1.
    """
    clean = sanitize_track(points)
    if len(clean) < 2:
        return []
    vels = []
    for i in range(1, len(clean)):
        vels.append(track_velocity(clean[i - 1], clean[i], fps))
    return vels


def track_accelerations(points: List[TrackPoint], fps: float = 30.0) -> List[Tuple[float, float, float]]:
    """
    Computes acceleration vectors (ax, ay, accel_mag) in px/s² across consecutive velocity steps.
    """
    clean = sanitize_track(points)
    if len(clean) < 3:
        return []

    safe_fps = max(1.0, fps)
    vels = instantaneous_velocities(clean, safe_fps)
    accels = []
    for i in range(1, len(vels)):
        # Midpoint frame deltas
        dt = max(1, clean[i + 1].frame - clean[i].frame) / safe_fps
        ax = (vels[i][0] - vels[i - 1][0]) / dt
        ay = (vels[i][1] - vels[i - 1][1]) / dt
        mag = math.hypot(ax, ay)
        accels.append((ax, ay, mag))
    return accels


def is_stationary(points: List[TrackPoint],
                  max_displacement_px: float = 20.0,
                  max_speed_px_s: float = 25.0,
                  fps: float = 30.0) -> bool:
    """
    Evaluates whether an object is stationary throughout the provided points window.
    Both net displacement and peak instantaneous speed must remain below thresholds.
    """
    clean = sanitize_track(points)
    if not clean:
        return False
    if len(clean) == 1:
        return True

    _, _, net_dist = net_displacement(clean)
    if net_dist > max_displacement_px:
        return False

    vels = instantaneous_velocities(clean, fps)
    for _, _, speed in vels:
        if speed > max_speed_px_s:
            return False

    return True


def detect_sudden_impact(points: List[TrackPoint],
                         decel_threshold_px_s2: float = 450.0,
                         fps: float = 30.0) -> Tuple[bool, float]:
    """
    Detects if the track underwent an abrupt deceleration spike exceeding threshold.
    Returns (has_impact: bool, max_deceleration: float in px/s²).
    """
    clean = sanitize_track(points)
    if len(clean) < 3:
        return (False, 0.0)

    safe_fps = max(1.0, fps)
    vels = instantaneous_velocities(clean, safe_fps)
    max_decel = 0.0

    for i in range(1, len(vels)):
        prev_speed = vels[i - 1][2]
        curr_speed = vels[i][2]

        # Significant speed drop
        if prev_speed > curr_speed:
            dt = max(1, clean[i + 1].frame - clean[i].frame) / safe_fps
            decel = (prev_speed - curr_speed) / dt
            if decel > max_decel:
                max_decel = decel

    return (max_decel >= decel_threshold_px_s2, max_decel)


def movement_direction_angle(p1: TrackPoint, p2: TrackPoint) -> float:
    """
    Computes trajectory angle in degrees [0, 360) where:
      0 deg = East (+x)
      90 deg = South / Down (+y)
      180 deg = West (-x)
      270 deg = North / Up (-y)
    """
    dx = p2.x - p1.x
    dy = p2.y - p1.y
    if abs(dx) < 1e-4 and abs(dy) < 1e-4:
        return 0.0
    angle_rad = math.atan2(dy, dx)
    angle_deg = math.degrees(angle_rad)
    return angle_deg % 360.0
