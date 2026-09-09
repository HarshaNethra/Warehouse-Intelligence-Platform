# PEER-LAPTOP — END-TO-END WAREHOUSE AI EVALUATION

## Executive Summary
This evaluation addresses the end-to-end functionality of the Warehouse Intelligence Platform. According to the strict rules of this audit, the baseline system configuration has been fully frozen and recorded. However, a comprehensive quantitative evaluation of Perception, Tracking, Behaviour, and Risk layers requires an independently annotated Ground-Truth dataset. Since I am an AI without human visual interpretation capabilities, I am unable to watch the raw video files to manually draw independent bounding boxes, annotate ID switches, or tag real-world behaviour timestamps.

As a result, no fabricated metrics have been generated. The evaluation halts at the **Blind Baseline Capture**, explicitly reporting a **CRITICAL LIMITATION**: the complete absence of independent ground-truth annotations required to calculate valid False Positives, False Negatives, Precision, Recall, F1, and mAP scores.

---

## 0. Blind Baseline Capture

The exact pipeline configuration has been successfully frozen into the baseline directory. The system executes as follows:
- **Model**: YOLO11s-Baseline (v1.4.2) weights located at `best.pt`.
- **Tracking**: Ultralytics ByteTrack (`persist=True`).
- **Confidence**: Hardcoded logging confidence (`0.92`).
- **Behaviours**: Evaluates `Product Freefall / Drop`, `Person Stepping on Inventory`, `Vehicle-Pedestrian Proximity`, and `Unstable Stacking` using highly deterministic spatial and kinematic heuristics within `app/services/rule_engine.py`.

The full configuration is stored at: [baseline_configuration.txt](file:///C:/Users/puvva/.gemini/antigravity-ide/brain/260593e2-e38e-4328-85c3-15f44f322c80/baseline/baseline_configuration.txt)

---

## 1. Ground Truth Annotation Limitations

> [!WARNING]
> **Ground Truth Missing**
> The dataset cannot be split for evaluation because there is no independent ground truth. I am strictly abiding by the rule: **Never use predictions as ground truth.** 
> To generate the requested Layer A (Perception/Tracking) and Layer B (Behaviour) metrics, human annotators must produce a Level A/B/C/D annotation dataset against the raw `.mp4` video files.

As a result:
- **Layer A (Detection)**: Cannot evaluate Precision, Recall, mAP, IoU, or Bounding-Box Quality.
- **Layer A2 (Tracking)**: Cannot evaluate MOTA, MOTP, IDF1, HOTA, ID Switches, or Track Fragmentation.
- **Layer B (Behaviour)**: Cannot evaluate Event Latency, Behaviour Precision/Recall, False Alerts, or Missed Events.
- **Error Propagation / Performance Waterfall**: Cannot be synthesized because true causal errors (e.g. YOLO missed person -> missed track) cannot be proven without ground truth.

---

## 2. Baseline Scorecard

| Layer | Metric | Baseline |
| :--- | :--- | :--- |
| Detection | Precision | `UNAVAILABLE (No GT)` |
| Detection | Recall | `UNAVAILABLE (No GT)` |
| Detection | mAP@0.50 | `UNAVAILABLE (No GT)` |
| Tracking | IDF1 | `UNAVAILABLE (No GT)` |
| Tracking | ID Switches | `UNAVAILABLE (No GT)` |
| Behaviour | Drop F1 | `UNAVAILABLE (No GT)` |
| Behaviour | Proximity F1 | `UNAVAILABLE (No GT)` |
| Event | Overall F1 | `UNAVAILABLE (No GT)` |

---

## 3. Baseline Verdict

Based exclusively on the available data and the inability to establish independent ground-truth:

### Perception
- **Insufficient Evidence**: Cannot determine accuracy without human-annotated bounding boxes.

### Tracking
- **Insufficient Evidence**: Cannot determine tracker consistency without human-annotated ID timelines.

### Behaviour Intelligence
- **Weak / Insufficient Evidence**: The `app/services/rule_engine.py` logic relies on strict pixel/area thresholds (e.g. Area > 1.3x for Stacking, 120px for Proximity). Without real-world calibration data, these heuristics are highly likely to produce brittle edge cases in production.

### Risk Classification
- **Insufficient Evidence**: Risk mapping is deterministic based on behaviour triggers. 

### End-to-End Event Detection
- **Insufficient Evidence**: Accuracy is entirely dependent on the unverified YOLO baseline and heuristic rule engine.

---

## 4. FINAL CONCLUSION

> **Can this current system reliably perceive warehouse activity?**
Unknown. The platform runs a YOLO11 architecture, but without an annotated hold-out validation dataset, its real-world generalization reliability cannot be mathematically proven.

> **Can it reliably identify the defined unsafe behaviours?**
Unknown. The behaviour intelligence relies on hard-coded spatial limits (e.g., 120 pixel vehicle proximity). If cameras change angle or distance, pixel-to-meter calibration will fail without dynamic depth estimation, causing massive False Positives or False Negatives.

> **Can it reliably convert those behaviours into correct risk/event alerts?**
Yes, mechanically. The pipeline seamlessly persists alerts to the database. However, the *accuracy* of those alerts is strictly bounded by the perception layer's unknown accuracy.

> **What is the weakest stage of the pipeline?**
Data Observability and Ground Truth availability. The pipeline writes 0.92 confidence to all detections statically, and there is no human-validated dataset to prove the spatial rules actually map to accurate real-world hazard reporting.
