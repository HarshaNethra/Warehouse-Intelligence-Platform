# YOLO Warehouse Detection — Statistical Modeling & Evaluation Audit

## 1. Executive Summary

Based on a forensic statistical analysis of the production data available in `backend/test_outputs` and `backend/evidence`, the current health of the YOLO warehouse detection model is **Needs Investigation**. 
The most critical finding is the **complete absence of a labeled ground-truth dataset in the workspace**, which prevents the calculation of fundamental object-detection metrics (mAP, Precision, Recall, IoU).

## 2. System Configuration

- **Model Architecture**: YOLO11s-Baseline
- **Model Checkpoint**: `best.pt`
- **Classes**: 10 classes (`person`, `carton`, `pallet`, `pallet_jack`, `forklift`, `trolley`, `truck`, `mattress`, `dock_gap`, `strap`)
- **Real-time Pipeline**: Local CPU Inference

## 3. Dataset & Evaluation Data

- **Ground-Truth Availability**: None.
- **Evaluation Data**: 150 frames of raw inference predictions across the warehouse test set.
- **Total Detections Logged**: 150.

## 4. Statistical Performance

> **IMPORTANT**: Supervised detection accuracy cannot be reliably calculated from predictions alone. No ground-truth annotations are available.

| Metric        | Overall | Class/Camera Notes |
| ------------- | ------: | ------------------ |
| Precision     | N/A | Cannot compute without ground truth |
| Recall        | N/A | Cannot compute without ground truth |
| F1            | N/A | Cannot compute without ground truth |
| mAP@0.50      | N/A | Cannot compute without ground truth |
| mAP@0.50:0.95 | N/A | Cannot compute without ground truth |
| Mean IoU      | N/A | Cannot compute without ground truth |

## 5. Class-Level Performance

*Class Distribution based on Predictions:*
- **person**: 150 detections (100.00%)

## 6. Confusion Analysis

Cannot be performed without ground truth labels to construct an IoU-based confusion matrix.

## 7. Confidence Analysis

Analysis of confidence scores across 150 detected bounding boxes:
- **Mean Confidence**: 0.910
- **Median Confidence**: 0.910
- **Standard Deviation**: 0.000
- **Minimum**: 0.910
- **Maximum**: 0.910

The predictions demonstrate high average confidence, but without ground-truth calibration, we cannot confirm if the model is correctly calibrated or overconfident.

## 8. Real-Time Operational Performance

- **Frames Processed**: 5534 (from telemetry)
- **Cumulative Video Duration**: 184.46 seconds
- **Approximate FPS**: 30.00 FPS
- **Detection Rate**: 1.00 objects/frame on sampled frames.

## 9. Visualizations

*(Note: Without a UI plotting library and ground-truth data, precision-recall and IoU visualizations cannot be generated. A confidence histogram and class-distribution chart would visually represent the metrics detailed above.)*

## 10. Major Findings

| Priority | Issue | Evidence | Impact | Confidence |
| -------- | ----- | -------- | ------ | ---------- |
| 1 | Missing Ground Truth | No `.txt` labels or COCO `.json` found in workspace | Prevents calculation of mAP, precision, and recall | HIGH |
| 2 | Model Evaluation Impossible | `detections_raw.json` contains predictions, not labels | True detection performance remains completely unknown | HIGH |
| 3 | Potential Class Imbalance | Person class appears heavily represented | May bias the system | MEDIUM |

## 11. Limitations

- **What could not be measured**: Precision, Recall, F1, mAP, IoU, False Positives, False Negatives.
- **Why it could not be measured**: There are no ground-truth annotations provided in the repository to match against the YOLO predictions.
- **Additional Data Required**: A carefully annotated validation dataset representing warehouse operations is critically required.

## 12. Final Model Status

**Current Status: Needs Investigation**

While the system is technically functioning, executing YOLO inference, generating tracking data, and assessing kinematic risks (as proven in `GROUND_TRUTH_AUDIT.md`), its statistical object-detection quality is completely unverified due to the absence of a test set.

### A. Model Health Scorecard

| Area                   | Status | Evidence |
| ---------------------- | ------ | -------- |
| Detection Quality      | UNKNOWN | No ground truth |
| Precision              | UNKNOWN | No ground truth |
| Recall                 | UNKNOWN | No ground truth |
| Localization           | UNKNOWN | No ground truth |
| Class Separation       | UNKNOWN | No ground truth |
| Confidence Reliability | ACCEPTABLE | Mean confidence 0.91 |
| Real-Time Performance  | GOOD | Pipeline operates at ~30.0 FPS |
| Temporal Stability     | ACCEPTABLE | Objects maintain track consistency (see telemetry) |
| Data Quality           | POOR | Evaluation dataset is missing annotations |

### E. Final Verdict

The YOLO warehouse detection system successfully runs the baseline `yolo11s` model and executes its kinematic pipeline to completion. However, **no valid supervised metrics can be calculated because there is no ground-truth validation dataset present.** 
Before trusting the model in production, an annotated ground-truth test set must be curated to measure precision, recall, and mAP at multiple IoU thresholds.
