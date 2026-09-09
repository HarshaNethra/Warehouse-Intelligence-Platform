# Behaviour Detection Rules Specification

**Godrej Warehouse Intelligence Platform**  
*Component Owner: Member 2 (Behaviour + Risk Engineer)*

This document details the spatiotemporal heuristic rules that convert object trajectories (`frame, object_id, class, x, y, width, height`) into classified handling behavior candidates.

---

## 1. Architectural Principles

1. **Temporal over Static**: Mishandling is a process over time, not a static image state. All rules evaluate sliding windows of consecutive frames.
2. **Explainability**: Detections are based on measurable kinematic values (displacement, velocity, deceleration, bounding box overlap) rather than opaque neural network activations.
3. **Conservative Sensitivity**: In industrial operations, high false-alarm rates degrade supervisor trust. Rules require persistence and corroborating evidence before triggering.
4. **Normalized Class Handling**: Rules accommodate real-world detector output (e.g. `person`, `box`, `carton`, `pallet`, `forklift`) and evaluate worker-object spatial interaction.

---

## 2. Rule Specifications

### 2.1 Product Dropped (`drop_rule.py`)
- **Behaviour Type**: `product_dropped`
- **Purpose**: Detects cartons or products that slip or are dropped from elevation to the warehouse floor.
- **Inputs**: Bounding box center coordinates $(x, y)$, height $h$, timestamps/frame count.
- **Detection Conditions**:
  1. $\Delta y \ge 65.0\text{ px}$ (downward displacement).
  2. $v_y \ge 200.0\text{ px/s}$ (downward vertical velocity).
  3. $\frac{|\Delta x|}{\Delta y} \le 1.2$ (predominantly vertical motion).
  4. Sudden deceleration spike ($\ge 450\text{ px/s}^2$) or settling into stationary resting state on the floor.
- **Evidence Fields**: `drop_height_px`, `vertical_velocity_px_s`, `duration_seconds`, `max_deceleration_px_s2`, `landing_near_floor`.
- **Expected False Positives**: Controlled rapid lowering of light items by a worker. Mitigated by checking if a worker track remains continuously adjacent during lowering.
- **Limitations**: If CCTV frame rate drops significantly or camera has motion blur, the exact moment of impact may occur between sampled frames.

---

### 2.2 Product Dragged (`drag_rule.py`)
- **Behaviour Type**: `product_dragged`
- **Purpose**: Detects cartons or furniture items being pulled or slid across the warehouse floor without lifting or mechanical equipment.
- **Inputs**: Coordinate sequence $(x, y, w, h)$, proximity to warehouse floor ($y > 0.6 \times \text{frame\_height}$).
- **Detection Conditions**:
  1. Object remains in lower floor region for $> 70\%$ of window.
  2. $|\Delta x| \ge 75.0\text{ px}$ (sustained horizontal displacement).
  3. Vertical deviation $\le 55.0\text{ px}$ (motion remains flat along the floor).
  4. Sustained duration $\ge 0.8\text{ s}$ at speed $\ge 35\text{ px/s}$.
- **Evidence Fields**: `horizontal_displacement_px`, `duration_seconds`, `average_speed_px_s`, `vertical_spread_px`, `floor_compliance_ratio`.
- **Expected False Positives**: Normal forklift or trolley transport carrying low-slung pallets. Prevented by checking if mechanical transport classes are absent or worker is walking alongside dragging.

---

### 2.3 Product Thrown (`throw_rule.py`)
- **Behaviour Type**: `product_thrown`
- **Purpose**: Detects cartons or mattresses launched through the air into vehicles or onto stacks.
- **Inputs**: Kinematic velocities $(v_x, v_y)$, track acceleration, worker separation.
- **Detection Conditions**:
  1. Peak projectile speed $\ge 300.0\text{ px/s}$.
  2. Net trajectory displacement $\ge 90.0\text{ px}$.
  3. Ballistic arc characteristics (parabolic vertical trajectory with upward apex, or high-momentum horizontal launch).
  4. Target object originates adjacent to worker and detaches rapidly.
- **Evidence Fields**: `flight_distance_px`, `max_speed_px_s`, `average_speed_px_s`, `duration_seconds`, `has_ballistic_arc`.
- **Expected False Positives**: Worker swinging their arms while walking fast. Avoided by requiring minimum displacement and separation thresholds.

---

### 2.4 Rough Handling (`rough_handling_rule.py`)
- **Behaviour Type**: `rough_handling`
- **Purpose**: Detects violent jarring, kicking, tumbling, or flipping of cartons.
- **Inputs**: Bounding box aspect ratio $(w/h)$, acceleration vectors $(a_x, a_y)$, trajectory direction deltas.
- **Detection Conditions**:
  1. Aspect ratio oscillation $\ge 35\%$ over short window (indicating rotating/flipping box).
  2. Severe deceleration / acceleration spikes $\ge 400.0\text{ px/s}^2$.
  3. Abrupt direction reversals ($\Delta \theta \ge 110^\circ$) with high momentum.
- **Evidence Fields**: `max_acceleration_px_s2`, `aspect_ratio_swing`, `direction_reversals`, `duration_seconds`.

---

### 2.5 Improper Stacking (`stacking_rule.py`)
- **Behaviour Type**: `improper_stacking`
- **Purpose**: Detects heavy or large packages placed directly on top of smaller, fragile packages.
- **Inputs**: Bounding box pairs $(A, B)$ visible at identical timestamps.
- **Detection Conditions**:
  1. Object $A$ is positioned vertically above Object $B$ ($A_{\text{bottom}}$ within $40\text{px}$ of $B_{\text{top}}$).
  2. Horizontal overlap $\ge 35\%$.
  3. Area ratio $\frac{\text{Area}(A)}{\text{Area}(B)} \ge 1.35$ (top box visibly larger/heavier than base).
- **Evidence Fields**: `supporting_object_id`, `upper_box_area`, `lower_box_area`, `area_ratio`, `horizontal_overlap`.

---

### 2.6 Unstable Stacking (`unstable_stack_rule.py`)
- **Behaviour Type**: `unstable_stack`
- **Purpose**: Detects stack columns with severe overhang or precarious center of mass alignment.
- **Inputs**: Vertical alignment and horizontal boundaries of stacked boxes.
- **Detection Conditions**:
  1. Object $A$ rests on Object $B$.
  2. Overhang distance extends $> 30\%$ beyond the width of the supporting base $B$.
- **Evidence Fields**: `supporting_object_id`, `overhang_px`, `overhang_ratio`, `lower_width_px`.

---

### 2.7 Designated Hazard Area Violation (`designated_area_rule.py`)
- **Behaviour Type**: `designated_area_violation`
- **Purpose**: Detects package handling in dangerous zones (unprotected dock ledge edges or wet floor slip zones).
- **Inputs**: Camera-specific hazard ROIs (dock edge $x < 260\text{px}$; wet floor ROI $[300, 450, 1100, 720]$).
- **Detection Conditions**:
  1. Item or operator operates within configured hazard zone for $\ge 0.4\text{ s}$ ($\ge 12\text{ frames}$).
- **Evidence Fields**: `hazard_type`, `hazard_frames`, `duration_seconds`, `location_x`, `location_y`.

---

### 2.8 Material Handling Equipment Violation (`equipment_rule.py`)
- **Behaviour Type**: `equipment_violation`
- **Purpose**: Flags manual dragging of heavy/bulky items (cupboards, large KD packs) without required mechanical aids.
- **Inputs**: Object visual footprint ($w \times h \ge 35,000\text{ px}^2$), absence of mechanical equipment (`pallet_jack`, `trolley`, `forklift`).
- **Detection Conditions**:
  1. Object footprint indicates bulky item moved manually over $> 60\text{ px}$.
  2. No trolley or pallet jack present in the workspace.
- **Evidence Fields**: `estimated_box_area_px2`, `net_movement_distance_px`, `equipment_present_in_scene`.

---

### 2.9 Unsafe Sequence & Stepping Violation (`sequence_rule.py`)
- **Behaviour Type**: `stepping_on_cartons`
- **Purpose**: Flags workers standing or stepping on lower tier cartons to access higher storage shelves or stacks.
- **Inputs**: Worker bounding box positioned directly above package bounding box, worker vertical elevation above normal floor plane.
- **Detection Conditions**:
  1. Worker bottom rests on top of carton with vertical overlap $\ge 25\%$, persisting for $\ge 0.5\text{ s}$.
- **Evidence Fields**: `duration_seconds`, `elevation_y`, `sustained_frames`.
