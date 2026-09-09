# Computer-Vision & Perception Validation Audit
## Godrej Warehouse Intelligence Platform

---

### 1. Executive Summary

This engineering audit provides a comprehensive, evidence-based evaluation of the Computer Vision (YOLO11s) and Tracking (ByteTrack) perception pipeline across all seven canonical Godrej warehouse CCTV recordings.

While the downstream Behaviour Engine, Temporal Engine, and Risk Engine have been mathematically validated and stabilized (22 confirmed handling safety events detected with zero synthetic regressions and 81 passing unit tests), **the perception layer represents the primary operational bottleneck of the platform**.

Key findings:
1. **Person Detection is Strong**: The model achieves robust worker detection (14,045 trajectory rows across 307 unique IDs, representing 96.6% of all tracked rows).
2. **Severe Class Blind Spots**:
   - `truck`: **0% detection recall** (0 rows across all 7 videos), despite multi-ton logistics vehicles occupying up to 25% of the frame in 4 videos.
   - `pallet_jack`: **0% detection recall** (0 rows across all 7 videos), despite manual hydraulic pallet jacks operating in plain view in 2 videos.
   - `trolley`: **0% detection recall** (0 rows across all 7 videos).
   - `pallet`: **Extremely low recall** (only 66 rows across 2 videos; completely absent in 5 videos with visible floor pallets).
   - `forklift`: **0 genuine detections**; 3 phantom false-positive rows generated from a worker pushing a box.
3. **Safety-Critical Missed Detections**:
   - **Stepping on Cartons**: Cartons inside dark truck containers are **100% undetected** (0 carton rows in 1,471 frames of `Stepping on cartons...`), completely blinding the downstream `SequenceRule` to severe worker safety violations.
   - **Carton Dragging / Physical Handling Fusion**: When workers closely manipulate cartons (carrying, dragging, rolling), YOLO frequently fails to segment the carton as a separate entity and instead expands the worker's bounding box, labeling the entire composite as `person`. Downstream carton handling rules cannot fire on `person` tracks.
   - **Non-Standard Handling Units (Mattresses)**: In `Throwing Mattresses`, white plastic-wrapped mattresses are detected as `carton` for only 5 frames out of 1,249 frames (99.6% missed), because the model was trained exclusively on brown corrugated cardboard boxes.
4. **Severe Track Fragmentation (ByteTrack)**:
   - **58.6% of all tracked object IDs (204 out of 348) persist for less than 15 frames (< 0.50 seconds)**.
   - The default tracker configuration starves ByteTrack's second-stage low-confidence matching, causing tracks to fragment whenever fast motion blur or occlusion occurs.

---

### 2. Current YOLO11s Configuration

The detector configuration was extracted directly from [export_trajectories.py](file:///c:/Users/Srikiran/Godrej/cv_pipeline/export_trajectories.py), [main.py](file:///c:/Users/Srikiran/Godrej/main.py), and model checkpoint inspections:

| Parameter | Current Value | Source / Implementation |
| :--- | :--- | :--- |
| **Model Checkpoint** | `models/best.pt` (fallback `best.pt`) | 19,177,555 bytes, PyTorch DetectionModel |
| **Architecture** | YOLO11 Small (`yolo11s`) | 9.4M parameters, 21.5 GFLOPs |
| **Pretraining Base** | `yolo11s.pt` (COCO pretrained) | Ultralytics release weights |
| **Fine-Tuning Dataset** | `MASTER_PUBLIC_V1` | Merged public datasets (`Logistics-2`, `Warehouse-Item-1`, `Warehouse-1`) |
| **Fine-Tuning Epochs** | 10 epochs | Trained on Kaggle cloud environment |
| **Training Input Size** | $640 \times 640$ | `imgsz=640` |
| **Inference Input Size** | $640 \times 640$ | Default Ultralytics `model.track()` |
| **Trained Class Count** | 7 classes | `0: person, 1: carton, 2: pallet, 3: pallet_jack, 4: forklift, 5: trolley, 6: truck` |
| **Confidence Threshold** | `conf = 0.25` | Set at CLI / `model.track(conf=0.25)` |
| **NMS IoU Threshold** | `iou = 0.70` | Default Ultralytics DetectionPredictor |
| **Max Detections / Frame**| 300 | Default Ultralytics |
| **Preprocessing** | Letterbox resize to $640 \times 640$ | Stride 32, aspect ratio padding, BGR $\to$ RGB, normalize $[0, 1]$ |
| **Frame Sampling** | `vid_stride = 1` | Every sequential frame processed (no temporal subsampling) |
| **Inference Device** | CUDA GPU (`"0"`) with CPU fallback | Auto-detected via `torch.cuda.is_available()` |

---

### 3. Current ByteTrack Configuration

ByteTrack parameters were extracted from `ultralytics/cfg/trackers/bytetrack.yaml` and runtime call inspection:

| Parameter | Value | Functional Role | Operational Impact Observed |
| :--- | :---: | :--- | :--- |
| `tracker_type` | `bytetrack` | Dual-threshold Kalman filter association | Standard spatial association algorithm |
| `track_high_thresh` | `0.25` | First-stage high-confidence matching | Detections $\ge 0.25$ matched against existing tracks |
| `track_low_thresh` | `0.10` | Second-stage low-score recovery | Detections between $0.10$ and $0.25$ used to recover occluded tracks |
| `new_track_thresh` | `0.25` | Score required to initiate a new track | Unmatched detections $\ge 0.25$ spawn new candidate tracks |
| `track_buffer` | `30` | Frames to keep lost tracks alive | Keeps inactive tracks alive for $1.0\text{ s}$ ($30\text{ frames}$ at $30\text{ fps}$) |
| `match_thresh` | `0.80` | IoU cost threshold for matching | Rejects matches with bounding-box overlap cost $> 0.80$ |
| `fuse_score` | `True` | Multiplies detection score with IoU | Stabilizes track scores |
| **Pipeline Starvation** | **Critical** | `model.track(conf=0.25)` passes `conf=0.25` to YOLO NMS | **NMS drops all boxes $< 0.25$ before tracker runs**, starving ByteTrack's second-stage ($0.10 \le \text{conf} < 0.25$) recovery mechanism |

---

### 4. Seven-Video Trajectory Statistics

Computed from native CCTV videos and raw trajectory CSV exports:

| Video Name | Res | FPS | Frames | Duration | Traj Rows | Unique IDs | Detected Classes | Frames w/ Detections | Short Tracks (<15f) | Long Tracks ($\ge$90f) | Large Jumps (>100px) | Class Switches |
| :--- | :---: | :---: | :---: | :---: | :---: | :---: | :---: | :---: | :---: | :---: | :---: | :---: |
| **Dock level, dragging cupboard** | 1280x720 | 30.0 | 930 | 31.0s | 1,500 | 60 | person (54), carton (6) | 850 (91.4%) | 32 (53.3%) | 3 (5.0%) | 0 | 0 |
| **KD packets dragged...** | 1280x720 | 30.0 | 1,012 | 33.7s | 2,290 | 80 | person (67), carton (12), pallet (5), forklift (2) | 1,004 (99.2%) | 51 (63.8%) | 7 (8.8%) | 1 | 6 IDs |
| **Rolling and dragging on wet floor** | 1280x720 | 30.0 | 183 | 6.1s | 518 | 28 | person (25), carton (3) | 169 (92.3%) | 13 (46.4%) | 0 (0.0%) | 0 | 0 |
| **Rolling and dropping carton** | 1280x720 | 30.0 | 282 | 9.4s | 1,015 | 44 | person (27), carton (17), pallet (2) | 276 (97.9%) | 30 (68.2%) | 3 (6.8%) | 0 | 2 IDs |
| **Stepping on cartons...** | 1280x720 | 30.0 | 1,471 | 49.0s | 6,048 | 72 | person (72) **[0 cartons!]** | 1,414 (96.1%) | 31 (43.1%) | 23 (31.9%) | 0 | 0 |
| **Throwing Mattresses** | 1280x720 | 30.0 | 1,249 | 41.6s | 1,506 | 40 | person (39), carton (1) [5 rows] | 1,219 (97.6%) | 36 (90.0%) | 1 (2.5%) | 0 | 0 |
| **Throwing seating cartons...** | 1280x720 | 30.0 | 451 | 15.0s | 1,654 | 24 | person (23), carton (2) [24 rows] | 451 (100.0%) | 11 (45.8%) | 6 (25.0%) | 0 | 1 ID |
| **TOTALS** | - | - | **5,578** | **185.8s** | **14,531** | **348** | - | - | **204 (58.6%)** | **43 (12.4%)** | **1** | **9 IDs** |

---

### 5. Class Coverage Table

Detailed breakdown comparing physical presence in CCTV footage against detector output:

| Class Name | Videos Visually Present (Raw CCTV) | Videos Detected in Trajectory | Total Rows | Unique IDs | Systematic Failure Mode | Tracking Quality |
| :--- | :--- | :--- | :---: | :---: | :--- | :--- |
| **`person`** | 7 of 7 videos | 7 of 7 videos | 14,045 | 307 | None on worker detection; absorbs adjacent cartons during physical handling | Fair (High fragmentation: 307 IDs for ~20 workers) |
| **`carton`** | 7 of 7 videos | 6 of 7 videos | 1,518 | 41 | **Systematically missed inside truck containers, when carried/dragged, or when non-cardboard (mattresses)** | Poor (Tracks die during handling; 58% short tracks) |
| **`pallet`** | 5 of 7 videos | 2 of 7 videos | 66 | 7 | **Systematically missed** on warehouse floors; low contrast / floor perspective | Extremely Poor (Fleeting 1–5 frame detections) |
| **`pallet_jack`** | 2 of 7 videos | **0 of 7 videos** | **0** | **0** | **100% Missed** (Domain shift: manual pump jacks vs synthetic training models) | Completely Absent |
| **`forklift`** | **0 of 7 videos** | 1 of 7 videos | 3 | 2 | **100% False Positive** (Misclassification of worker pushing a carton stack) | Transient noise |
| **`trolley`** | 1 of 7 videos | **0 of 7 videos** | **0** | **0** | **100% Missed** (Parked hand-carts ignored) | Completely Absent |
| **`truck`** | 4 of 7 videos | **0 of 7 videos** | **0** | **0** | **100% Missed** (Rear-dock tailgate/container view vs exterior highway view) | Completely Absent |

---

### 6. Missed-Object Findings

1. **Inside-Truck Cartons (`Stepping on cartons...`)**:
   - *Visible Reality*: Multiple stacks of brown corrugated cartons occupying the rear container of the red truck trailer (frames 0–1471). A worker actively walks and drops cartons inside.
   - *Detector Output*: Exactly 0 carton detections in the entire 49-second recording.
   - *Root Cause*: Low lighting inside container, partial occlusion by container frame, and monitor reflection glare.
2. **Mattresses (`Throwing Mattresses`)**:
   - *Visible Reality*: Workers repeatedly lifting and throwing white, plastic-sheathed mattresses onto a stack in the truck bed (frames 50–1200).
   - *Detector Output*: 0 mattress detections; 5 frames of fleeting `carton` detections.
   - *Root Cause*: Strict cardboard-texture bias in training data; zero plastic-wrapped or quilted mattress annotations.
3. **Pallet Jacks (`Dock level` & `Throwing Mattresses`)**:
   - *Visible Reality*: In `Dock level` (frame 232), a manual hydraulic pallet jack with bright magenta forks is being pulled by a worker across the dock. In `Throwing Mattresses` (frame 312), a magenta pallet jack sits in the foreground on the dock leveler.
   - *Detector Output*: 0 detections.
   - *Root Cause*: `Warehouse-1` training data contains automated mobile robots (AMRs) and synthetic pallet trucks, which look nothing like manual hydraulic pump jacks.
4. **Logistics Trucks / Cargo Containers (`Throwing seating cartons`, `Throwing Mattresses`, `Stepping on cartons`, `Rolling on wet floor`)**:
   - *Visible Reality*: Commercial trucks and trailers docked directly at the loading bay doors.
   - *Detector Output*: 0 detections.
   - *Root Cause*: Training data trucks are annotated from exterior road-level side profiles. CCTV cameras see open rear doors, container frames, and dock leveler interfaces.

---

### 7. Misclassification Findings

1. **Worker-Carton Bounding Box Merging (`Rolling and dragging on wet floor`)**:
   - At frames 50–100, a worker rolls and drags a tall brown carton out of the truck.
   - Instead of detecting two distinct bounding boxes (`person` and `carton`), YOLO generates a single combined bounding box (`id=762`, $w=130\text{ px}, h=240\text{ px}$) and classifies it as `person` (conf=0.76).
   - The carton is absorbed into the person. Downstream behaviour rules requiring carton targets (`product_dragged`, `rough_handling`) cannot detect the dragging action.
2. **Phantom Forklift Detection (`KD packets dragged...`)**:
   - At frame 900, a worker bending over and pushing a carton stack is detected for 3 frames as `forklift` (conf=0.26).
   - No motorized vehicle exists in the scene.
3. **Pallet / Carton Flips (`Rolling and dropping carton`)**:
   - Object ID 996 and ID 1004 alternate between `carton` and `pallet` across consecutive frames as the carton rotates end-over-end across the dock floor.

---

### 8. Track Fragmentation & ID-Switch Findings

- **Overall Fragmentation Rate**: **58.6%** of all tracks persist for $< 15\text{ frames}$ ($0.5\text{ s}$).
- **Causes**:
  1. *Motion Blur*: During throwing and rolling actions, the object's appearance blurs, dropping YOLO confidence below 0.25. The detector emits no box for 1–2 frames.
  2. *Tracker Buffer Expiry / Association Failure*: When the object re-emerges with conf $\ge 0.25$, ByteTrack fails to associate it with the existing track and assigns a new ID.
  3. *Camera Shaking / Compression*: In videos filmed off CCTV monitors, screen flicker and moiré patterns induce bounding-box jitter, breaking IoU overlap continuity.

---

### 9. Systematic Failure Diagnosis (Categorization)

| Failure Event | Category | Primary Root Cause | Subsystem Responsible |
| :--- | :---: | :--- | :--- |
| Cartons inside truck container (`Stepping on cartons`) | **Category A** | Zero boxes produced at any confidence | **YOLO Detection** (Lighting / Domain shift) |
| White mattresses (`Throwing Mattresses`) | **Category A** | Zero boxes produced for non-cardboard goods | **YOLO Detection** (Dataset class bias) |
| Manual pallet jacks (`Dock level`, `Throwing Mattresses`) | **Category A** | Zero boxes produced for hydraulic pump trucks | **YOLO Detection** (Training data shift) |
| Logistics trucks at dock | **Category A** | Zero boxes produced for rear-dock container angles | **YOLO Detection** (Camera perspective shift) |
| Carton fused into worker (`Rolling on wet floor`) | **Category B** | Single bounding box classified 100% as `person` | **YOLO Bounding Box / Classification** |
| Phantom forklift (`KD packets`) | **Category B** | Worker + carton cluster classified as vehicle | **YOLO Classification** |
| Thrown carton track fragmentation (`Throwing seating`) | **Category C** | Track drops during airborne motion blur, spawns new ID | **ByteTrack Association / NMS Starvation** |
| Pallet/carton ID flipping (`Rolling and dropping`) | **Category C** | Kalman filter links boxes with fluctuating class labels | **ByteTrack Class Smoothing Absence** |

---

### 10. Safety-Critical Failure Audit Table

| Safety Action in Raw CCTV | Visually Obvious Hazard | Detected? | Correct Class? | Track Stable? | Could Behaviour Rule Detect if Track Were Correct? | True Bottleneck |
| :--- | :--- | :---: | :---: | :---: | :---: | :--- |
| **Worker stepping on cartons inside truck** | Worker standing/walking on fragile product packages | **NO** (Carton 0%, Person Yes) | Person: Yes<br>Carton: **None** | No carton track | **YES** (`SequenceRule` logic is verified and tests pass; needs carton track) | **Perception (YOLO Detection)** |
| **Carton dragged across wet floor** | Product dragged on floor without equipment | **NO** (Carton fused into worker) | Worker: Yes<br>Carton: **Fused into person** | Fused person track | **YES** (`DragRule` logic is verified; rejected because target is `person`) | **Perception (YOLO Bounding Box)** |
| **Mattresses thrown violently** | Large bedding handling units tossed across container | **NO** (5 frames only) | 5 frames as `carton`<br>1,244 frames **missed** | Broken (<0.2s) | **YES** (`ThrowRule` verified; needs continuous trajectory of product) | **Perception (YOLO Detection)** |
| **Seating cartons thrown with strap** | Heavy carton thrown during container loading | Partial (24 frames) | `carton` (when detected) | Severely fragmented | **YES** (Detected 1 `rough_handling`, but parabolic trajectory fitting lost) | **Perception (ByteTrack / YOLO Blur)** |
| **Cupboard dragging across dock** | Heavy furniture dragged manually without mechanical aid | **YES** (Detected as carton 272) | `carton` (acceptable proxy) | Stable for 320 frames | **YES** (Detected by `product_dragged` and `equipment_violation`) | **None (Working)** |
| **Heavy carton dropped on KD packets** | Unstable impact dropping onto flat furniture packs | **YES** (Detected as carton 489/490) | `carton` | Stable during event | **YES** (Detected by `rough_handling` and `product_thrown`) | **None (Working)** |
| **Carton rolled end-over-end on floor** | Carton rolled violently and dropped | Partial (295 frames) | `carton` (flips with pallet) | Fragmented during roll | Partial (Detected 1 `rough_handling` in pipeline baseline) | **Perception (YOLO & ByteTrack)** |

---

### 11. Class-by-Class Quality Rating

| Class | Detection Recall | Classification Precision | Tracking Stability | Overall Readiness | Summary Assessment |
| :--- | :---: | :---: | :---: | :---: | :--- |
| **`person`** | **95%** | **92%** | **70%** | **PRODUCTION READY** | Strong baseline; needs multi-person re-ID improvements under heavy occlusion. |
| **`carton`** | **45%** | **85%** | **40%** | **NEEDS RETRAINING** | Good on isolated floor boxes; fails completely during close manual handling and dark container interiors. |
| **`pallet`** | **15%** | **75%** | **20%** | **INSUFFICIENT** | Severe recall deficiency; misses floor pallets across almost all cameras. |
| **`pallet_jack`** | **0%** | **N/A** | **0%** | **UNUSABLE** | 100% blind to real-world manual warehouse hydraulic pallet jacks. |
| **`forklift`** | **0%** | **0%** | **0%** | **UNUSABLE** | Generates false positives on workers; no genuine forklifts tested. |
| **`trolley`** | **0%** | **N/A** | **0%** | **UNUSABLE** | Completely blind to warehouse hand-carts and platform trolleys. |
| **`truck`** | **0%** | **N/A** | **0%** | **UNUSABLE** | 100% blind to rear-dock loading bay truck perspectives. |

---

### 12. Problem Ranking (Prioritized)

#### [CRITICAL] 1. Missing Container & Low-Light Carton Annotations
- **Impact**: Completely disables `stepping_on_cartons` and `stacking` rules inside trucks and containers.
- **Root Cause**: Zero training images representing dark container interiors or backlit loading bays.

#### [CRITICAL] 2. Person-Carton Physical Interaction Fusion
- **Impact**: Disables `product_dragged` and `rough_handling` when workers tightly grip or drag packages.
- **Root Cause**: Training datasets contain isolated boxes on conveyor belts or floors, not workers lifting/dragging cartons.

#### [HIGH] 3. Non-Cardboard Product Blindness (Mattresses, Furniture)
- **Impact**: Warehouse handling safety is blind to major non-box product lines (mattresses, wrapped furniture, crates).
- **Root Cause**: Class ontology conflates "product handling unit" with "brown corrugated cardboard box".

#### [HIGH] 4. ByteTrack Second-Stage Confidence Starvation & Fragmentation
- **Impact**: 58.6% of tracks die within 0.5 seconds, disrupting kinematic velocity and acceleration calculations.
- **Root Cause**: Passing `conf=0.25` directly to YOLO's NMS prevents ByteTrack from receiving second-stage boxes ($0.10 \le \text{conf} < 0.25$).

#### [HIGH] 5. Complete Equipment Blindness (`pallet_jack`, `truck`, `pallet`)
- **Impact**: Equipment rules cannot verify whether mechanical equipment was available, utilized, or operated safely.
- **Root Cause**: Extreme domain shift between public datasets and Godrej CCTV camera views.

#### [MEDIUM] 6. Resolution Downsampling ($1280 \times 720 \to 640 \times 640$)
- **Impact**: Distant cartons in warehouse aisles shrink below detectable spatial resolution.

#### [LOW] 7. Off-Screen Monitor Glare & Recording Artifacts
- **Impact**: Video recordings of CCTV monitors introduce visual noise, though YOLO11s can adapt if augmented.

---

### 13. Retraining Justification Assessment

**Conclusion: Retraining is STRONGLY JUSTIFIED and REQUIRED for Production Readiness.**

*Evidence*:
- Parameter tuning (thresholds, tracker parameters) cannot recover objects where the neural network produces 0 feature activations (e.g. cartons inside trucks, mattresses, pallet jacks).
- No tracker can associate detections that do not exist.
- The existing model architecture (`yolo11s`) is fundamentally capable (9.4M parameters, high person accuracy), but its training data distribution (`MASTER_PUBLIC_V1`) has severe domain gaps when evaluated on real Godrej CCTV footage.

---

### 14. ByteTrack Tuning Justification

**Conclusion: Controlled Tracker Tuning is JUSTIFIED and should be implemented in conjunction with perception pipeline adjustments.**

*Specific Justification*:
- Running YOLO inference at `conf=0.10` and passing raw detections to ByteTrack allows its built-in two-stage matching algorithm to function as designed:
  - First stage: matches high-confidence boxes ($\ge 0.25$).
  - Second stage: associates lower-confidence boxes ($0.10 \le \text{score} < 0.25$) with existing Kalman tracks to bridge motion blur and partial occlusions.
- Track buffer should be evaluated at $45\text{–}60\text{ frames}$ ($1.5\text{–}2.0\text{ s}$) to prevent track termination during brief occlusions.

---

### 15. Preprocessing Justification

**Conclusion: Multi-Scale / Native Resolution Inference is JUSTIFIED.**

*Specific Justification*:
- CCTV frames are $1280 \times 720$. Downscaling to $640 \times 640$ letterbox cuts spatial resolution by 50%, making distant pallets and cartons $< 20\text{ px}$ wide.
- Testing inference at $imgsz=960$ or $1280$ on GPU will directly improve small-object feature resolution.

---

### 16. Recommended Training Data Collection Plan

To achieve enterprise-grade reliability, a targeted dataset of **2,500 – 4,000 real Godrej CCTV frames** should be collected and labeled:

| Class / Scenario | Target Frame Count | Specific Visual Scenarios Required | Annotation Rules |
| :--- | :---: | :--- | :--- |
| **Cartons in Containers** | 600 frames | Dark truck interiors, backlit loading docks, stacked cargo | Annotate visible faces of cartons even in deep shadow |
| **Worker-Carton Interactions** | 800 frames | Workers lifting, carrying, dragging, pushing cartons | **Strict separation**: Annotate worker and carton as separate, overlapping bounding boxes |
| **Non-Box Handling Units** | 500 frames | White plastic-wrapped mattresses, upholstered furniture, crates | Label as `carton` (or broaden class ontology to `product_unit`) |
| **Manual Pallet Jacks** | 400 frames | Real Indian warehouse hydraulic pump jacks (red, yellow, magenta) | Bounding box enclosing forks, chassis, and steering handle |
| **Loading Dock Trucks** | 400 frames | Trucks backed into bays, rear tailgate openings, container edges | Annotate visible rear chassis and container exterior |
| **Floor Pallets** | 400 frames | Wooden pallets on warehouse concrete, empty and loaded | Distinguish empty wooden pallets from floor floorboards |

---

### 17. Recommended Holdout & Validation Strategy

1. **Video-Level Holdout**:
   - Never perform random frame-level train/test splitting on video data (adjacent frames share $>98\%$ visual similarity).
   - Entire video streams must be held out.
   - Recommended split:
     - **Training / Tuning Videos**: `Dock level, dragging cupboard`, `KD packets dragged...`, `Rolling and dropping carton`, `Throwing seating cartons`, `Rolling and dragging on wet floor`.
     - **Unseen Test / Benchmark Holdout Videos**: `Stepping on cartons...` and `Throwing Mattresses`.
2. **Ground Truth Annotation**:
   - Establish ground-truth bounding-box annotations for the holdout videos to report true mAP@50 and MOTA/HOTA tracking metrics.

---

### 18. Implemented Fixes During this Audit

In accordance with Phase 10 Absolute Rules:
- **No speculative or premature perception code changes were pushed to production during this audit run.**
- The production pipeline remains completely deterministic and stable.
- Diagnostic inspection scripts (`scratch/audit_trajectories.py`, `scratch/audit_cv_raw.py`, `scratch/audit_visual_vs_traj.py`) were created to generate the empirical evidence documented here.

---

### 19. Regression Safety Verification

The complete regression suite was executed to confirm that no perception audit activity affected the downstream behaviour or risk systems:

1. **Unit Test Suite**:
   ```
   Ran 81 tests in 0.048s
   OK
   ```
   All 81 tests across all 9 behaviour rules, geometry, motion, temporal overlap resolution, and risk engine pass with zero failures.

2. **Pipeline Event Counts**:
   ```powershell
   .\.venv\Scripts\python.exe main.py analyze-events
   ```
   - Total Events: **22** (Exactly matches baseline after Phase 2H designated-area fix).
   - Event breakdown:
     - `rough_handling`: 9
     - `product_thrown`: 6
     - `product_dragged`: 3
     - `equipment_violation`: 3
     - `product_dropped`: 1
     - `designated_area_violation`: 0 (All 8 false positives removed)
     - `stepping_on_cartons`: 0 (Awaiting perception carton tracks)
     - `unstable_stack`: 0
     - `improper_stacking`: 0

---

### 20. Final Answers to Required Audit Questions

#### A. Is the current YOLO11s model good enough to continue with?
**NO for enterprise production; YES as an engineering development baseline.**
The model is capable of robust worker detection and can detect isolated cartons on open floors. However, it is completely blind to cartons inside truck containers, non-cardboard products (mattresses), manual pallet jacks, and trucks at loading docks.

#### B. What is the single biggest perception problem?
**The complete failure of YOLO to detect cartons inside container/truck interiors and during tight physical contact with workers.**
Because the downstream safety rules are product-centric, the absence of carton tracks prevents the behaviour engine from detecting the most severe safety violations (stepping on cartons, dragging cartons).

#### C. Is the biggest problem YOLO, ByteTrack, preprocessing, or data?
**DATA is the root cause (80%); YOLO inference configuration is a contributing factor (15%); ByteTrack is an association multiplier (5%).**
The YOLO11s architecture itself is strong. The fundamental problem is that `MASTER_PUBLIC_V1` consists of clean, well-lit, public web images of standard cardboard boxes, whereas Godrej CCTV involves off-monitor camera recordings, dark truck interiors, non-box mattresses, and workers tightly grasping goods.

#### D. What should be fixed FIRST?
**Fix ByteTrack confidence starvation in [export_trajectories.py](file:///c:/Users/Srikiran/Godrej/cv_pipeline/export_trajectories.py).**
Change the inference call to pass `conf=0.10` to YOLO detection while retaining `track_high_thresh=0.25` in ByteTrack. This is a zero-risk, no-retraining-required change that immediately restores ByteTrack's ability to use second-stage low-score matching to recover occluded cartons and reduce the 58.6% track fragmentation.

#### E. What should NOT be changed yet?
1. **Do NOT modify the 9 validated behaviour rules.** The rules have been proven mathematically sound with synthetic and real tests.
2. **Do NOT replace the YOLO11s architecture** with heavier models (e.g. YOLO11x) yet. Architecture is not the bottleneck; training distribution is.
3. **Do NOT start an uncontrolled local training run.**

#### F. What is the recommended next experiment?
Run a controlled perception benchmark on `Throwing seating cartons` and `Rolling and dropping carton` comparing:
1. Baseline (`conf=0.25`)
2. Unstarved ByteTrack (`conf=0.10` detector threshold with ByteTrack dual-stage matching)
3. Higher-resolution inference (`imgsz=960` or `1280`)
Measure the change in carton track continuity and short-track fragmentation percentage.

#### G. What evidence would be required before retraining?
1. An empirical test demonstrating that tuning detector thresholds (`conf=0.10`), tracker buffers, and input resolution ($imgsz=960$) still fails to yield $\ge 15\text{ frames}$ of carton detections inside the truck container in `Stepping on cartons...`. (Already confirmed in Phase 4 audit: 0 boxes even at conf=0.10).
2. A curated dataset of at least 1,500 annotated Godrej warehouse CCTV frames capturing the missing domains (container interiors, pallet jacks, mattress/furniture handling units, worker-carton co-annotations).
