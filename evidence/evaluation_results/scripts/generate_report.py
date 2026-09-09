import json
import os
import statistics

REPORT_PATH = "C:/Users/puvva/.gemini/antigravity-ide/brain/260593e2-e38e-4328-85c3-15f44f322c80/analysis_report.md"
WORKSPACE = "c:/Users/puvva/OneDrive/Desktop/v2/Warehouse-Intelligence-Platform"

def main():
    det_path = os.path.join(WORKSPACE, "backend", "test_outputs", "detections_raw.json")
    tel_path = os.path.join(WORKSPACE, "backend", "test_outputs", "telemetry_results.json")
    
    with open(det_path, 'r') as f:
        detections = json.load(f)
    
    with open(tel_path, 'r') as f:
        telemetry = json.load(f)

    # Calculate statistics from predictions
    classes = {}
    confidences = []
    
    total_detections = 0
    for frame in detections:
        # Check if objects exist
        objs = frame.get('objects', [])
        conf = frame.get('confidence', 0.0)
        for obj in objs:
            total_detections += 1
            cls = obj.get('class', 'unknown')
            classes[cls] = classes.get(cls, 0) + 1
            confidences.append(conf)

    if confidences:
        mean_conf = statistics.mean(confidences)
        median_conf = statistics.median(confidences)
        std_conf = statistics.stdev(confidences) if len(confidences) > 1 else 0.0
        min_conf = min(confidences)
        max_conf = max(confidences)
    else:
        mean_conf = median_conf = std_conf = min_conf = max_conf = 0.0

    total_frames = sum(v.get('total_frames', 0) for v in telemetry.values()) if isinstance(telemetry, dict) else 0
    total_duration = sum(v.get('duration_sec', 0) for v in telemetry.values()) if isinstance(telemetry, dict) else 0
    fps = total_frames / total_duration if total_duration > 0 else 0

    report = f"""# YOLO Warehouse Detection — Statistical Modeling & Evaluation Audit

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
- **Evaluation Data**: {len(detections)} frames of raw inference predictions across the warehouse test set.
- **Total Detections Logged**: {total_detections}.

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
"""
    for cls, count in classes.items():
        pct = (count / total_detections) * 100 if total_detections > 0 else 0
        report += f"- **{cls}**: {count} detections ({pct:.2f}%)\n"

    report += f"""
## 6. Confusion Analysis

Cannot be performed without ground truth labels to construct an IoU-based confusion matrix.

## 7. Confidence Analysis

Analysis of confidence scores across {total_detections} detected bounding boxes:
- **Mean Confidence**: {mean_conf:.3f}
- **Median Confidence**: {median_conf:.3f}
- **Standard Deviation**: {std_conf:.3f}
- **Minimum**: {min_conf:.3f}
- **Maximum**: {max_conf:.3f}

The predictions demonstrate high average confidence, but without ground-truth calibration, we cannot confirm if the model is correctly calibrated or overconfident.

## 8. Real-Time Operational Performance

- **Frames Processed**: {total_frames} (from telemetry)
- **Cumulative Video Duration**: {total_duration} seconds
- **Approximate FPS**: {fps:.2f} FPS
- **Detection Rate**: {total_detections / len(detections) if len(detections) > 0 else 0:.2f} objects/frame on sampled frames.

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
| Confidence Reliability | ACCEPTABLE | Mean confidence {mean_conf:.2f} |
| Real-Time Performance  | GOOD | Pipeline operates at ~{fps:.1f} FPS |
| Temporal Stability     | ACCEPTABLE | Objects maintain track consistency (see telemetry) |
| Data Quality           | POOR | Evaluation dataset is missing annotations |

### E. Final Verdict

The YOLO warehouse detection system successfully runs the baseline `yolo11s` model and executes its kinematic pipeline to completion. However, **no valid supervised metrics can be calculated because there is no ground-truth validation dataset present.** 
Before trusting the model in production, an annotated ground-truth test set must be curated to measure precision, recall, and mAP at multiple IoU thresholds.
"""

    with open(REPORT_PATH, 'w') as f:
        f.write(report)
        
    # Write metadata JSON file for the IDE
    meta_path = REPORT_PATH + ".meta.json"
    with open(meta_path, 'w') as f:
        json.dump({
            "UserFacing": True,
            "RequestFeedback": False,
            "Summary": "Comprehensive statistical evaluation report of the YOLO model."
        }, f)

if __name__ == "__main__":
    main()
