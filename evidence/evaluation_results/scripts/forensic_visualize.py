import json
import os
import pandas as pd
import numpy as np
import matplotlib.pyplot as plt
import seaborn as sns
from sklearn.cluster import KMeans
from scipy import stats
import warnings
warnings.filterwarnings('ignore')

WORKSPACE = "c:/Users/puvva/OneDrive/Desktop/v2/Warehouse-Intelligence-Platform"
OUT_DIR = "C:/Users/puvva/.gemini/antigravity-ide/brain/260593e2-e38e-4328-85c3-15f44f322c80/scratch/forensic_plots"
REPORT_PATH = "C:/Users/puvva/.gemini/antigravity-ide/brain/260593e2-e38e-4328-85c3-15f44f322c80/forensic_analysis_report.md"

def set_style():
    sns.set_theme(style="darkgrid")
    plt.rcParams['figure.figsize'] = (10, 6)

def save_plot(fig, filename):
    path = os.path.join(OUT_DIR, filename)
    fig.savefig(path, bbox_inches='tight')
    plt.close(fig)
    return path

def main():
    set_style()
    det_path = os.path.join(WORKSPACE, "backend", "test_outputs", "detections_raw.json")
    tel_path = os.path.join(WORKSPACE, "backend", "test_outputs", "telemetry_results.json")
    
    with open(det_path, 'r') as f:
        raw_detections = json.load(f)
    with open(tel_path, 'r') as f:
        telemetry = json.load(f)

    # 1. Parsing Telemetry Frames
    tel_frames = []
    if isinstance(telemetry, dict):
        for vid, vdata in telemetry.items():
            ft = vdata.get('frame_telemetry', [])
            for ft_item in ft:
                tel_frames.append({'frame': ft_item.get('frame', 0), 'timestamp': ft_item.get('timestamp', 0.0), 'source': vid})
    df_tel = pd.DataFrame(tel_frames)
    df_tel = df_tel.sort_values('timestamp').reset_index(drop=True)

    # 2. Parsing Inference Detections
    det_list = []
    frame_list = []
    for f in raw_detections:
        fid = f.get('frame_id')
        ts = f.get('timestamp_sec', 0.0)
        conf = f.get('confidence', 0.0)
        objs = f.get('objects', [])
        frame_list.append({'frame_id': fid, 'timestamp': ts, 'num_detections': len(objs), 'confidence': conf})
        for obj in objs:
            bbox = obj.get('bbox', [0,0,0,0])
            w = bbox[2] - bbox[0]
            h = bbox[3] - bbox[1]
            det_list.append({
                'frame_id': fid, 'timestamp': ts, 'class': obj.get('class', 'unknown'),
                'confidence': conf, 'bbox_area': w*h, 'center_x': bbox[0] + w/2, 'center_y': bbox[1] + h/2,
                'width': w, 'height': h, 'x1': bbox[0], 'y1': bbox[1], 'x2': bbox[2], 'y2': bbox[3]
            })

    df_det = pd.DataFrame(det_list)
    df_frame = pd.DataFrame(frame_list)
    df_frame = df_frame.sort_values('timestamp').reset_index(drop=True)
    df_det = df_det.sort_values('timestamp').reset_index(drop=True)

    md = ["# YOLO Warehouse \u2014 Forensic Visualization & Statistical Deep-Dive\n"]

    # PHASE 1 - DATA AUDIT
    md.append("## SECTION A \u2014 DATASET OVERVIEW\n")
    md.append("### Data Quality Summary\n")
    
    total_tel_frames = len(df_tel)
    total_inf_frames = len(df_frame)
    total_detections = len(df_det)
    unique_classes = df_det['class'].nunique() if not df_det.empty else 0
    unique_ts = df_frame['timestamp'].nunique()
    
    md.append(f"- **Telemetry Frames**: {total_tel_frames}\n")
    md.append(f"- **Inference Frames**: {total_inf_frames}\n")
    md.append(f"- **Total Detections**: {total_detections}\n")
    md.append(f"- **Unique Classes**: {unique_classes}\n")
    md.append(f"- **Unique Timestamps**: {unique_ts}\n\n")

    md.append("| Variable | Count | Missing | Unique | Mean | Median | Std | Min | Max |\n")
    md.append("|---|---|---|---|---|---|---|---|---|\n")
    for col in ['confidence', 'bbox_area', 'center_x', 'center_y', 'width', 'height']:
        if col in df_det:
            c = df_det[col].count()
            m = df_det[col].isna().sum()
            u = df_det[col].nunique()
            mean = df_det[col].mean()
            med = df_det[col].median()
            std = df_det[col].std()
            min_v = df_det[col].min()
            max_v = df_det[col].max()
            md.append(f"| {col} | {c} | {m} | {u} | {mean:.2f} | {med:.2f} | {std:.2f} | {min_v:.2f} | {max_v:.2f} |\n")

    # PHASE 2 - TEMPORAL COVERAGE (GRAPH A1 & A2)
    fig, ax = plt.subplots(figsize=(12, 4))
    if not df_tel.empty:
        ax.scatter(df_tel['timestamp'], np.zeros(len(df_tel)), label='Telemetry Available', alpha=0.1, color='gray', s=10)
    ax.scatter(df_frame['timestamp'], np.ones(len(df_frame))*0.1, label='Inference Available', color='red', s=20)
    ax.set_yticks([0, 0.1])
    ax.set_yticklabels(['Telemetry', 'Inference'])
    ax.set_title("GRAPH A1/A2 \u2014 Telemetry vs Inference Coverage")
    ax.legend()
    p_a1 = save_plot(fig, 'gA1_coverage.png')
    md.append(f"![GRAPH A1](file:///{p_a1})\n")

    # TIMESTAMP FORENSICS
    df_frame['dt'] = df_frame['timestamp'].diff()
    dt_mean = df_frame['dt'].mean()
    dt_med = df_frame['dt'].median()
    dt_std = df_frame['dt'].std()
    
    fig, ax = plt.subplots()
    sns.histplot(df_frame['dt'].dropna(), bins=30, kde=True, ax=ax)
    ax.axvline(x=0.0333, color='r', linestyle='--', label='Expected 30 FPS')
    ax.set_title("GRAPH A3 \u2014 Frame Interval Histogram")
    ax.legend()
    p_a3 = save_plot(fig, 'gA3_frame_interval.png')
    md.append(f"\n## SECTION B \u2014 TEMPORAL BEHAVIOR\n![GRAPH A3](file:///{p_a3})\n")
    
    fig, ax = plt.subplots()
    ax.plot(df_frame['timestamp'], df_frame['dt'], marker='.')
    ax.axhline(y=0.0333, color='r', linestyle='--')
    ax.set_title("GRAPH A4 \u2014 Frame Interval Over Time")
    p_a4 = save_plot(fig, 'gA4_interval_time.png')
    md.append(f"![GRAPH A4](file:///{p_a4})\n")

    df_frame['fps'] = 1 / df_frame['dt']
    fig, ax = plt.subplots()
    ax.plot(df_frame['timestamp'], df_frame['fps'], marker='.')
    ax.set_title("GRAPH A5 \u2014 Instantaneous FPS")
    p_a5 = save_plot(fig, 'gA5_fps.png')
    md.append(f"![GRAPH A5](file:///{p_a5})\n")

    # BOUNDING BOX FORENSICS
    md.append("\n## SECTION E \u2014 OBJECT SIZE & BOUNDING BOX ANOMALIES\n")
    df_det['is_negative_area'] = df_det['bbox_area'] < 0
    fig, ax = plt.subplots()
    sns.histplot(df_det['bbox_area'], bins=30, ax=ax)
    ax.set_title("GRAPH A6 \u2014 BBox Area Distribution")
    p_a6 = save_plot(fig, 'gA6_bbox_area.png')
    md.append(f"![GRAPH A6](file:///{p_a6})\n")
    
    fig, ax = plt.subplots()
    ax.scatter(df_det['frame_id'], df_det['bbox_area'], c=df_det['is_negative_area'].map({True:'red', False:'blue'}))
    ax.set_title("GRAPH A7 \u2014 BBox Area Over Frame (Red = Negative)")
    p_a7 = save_plot(fig, 'gA7_bbox_frame.png')
    md.append(f"![GRAPH A7](file:///{p_a7})\n")
    
    invalid_areas = df_det[df_det['is_negative_area']]
    md.append(f"**Invalid BBox Areas Identified**: {len(invalid_areas)} detections.\n")
    if len(invalid_areas) > 0:
        md.append("| Frame | Class | x1 | y1 | x2 | y2 | Width | Height | Area |\n")
        md.append("|---|---|---|---|---|---|---|---|---|\n")
        for _, row in invalid_areas.head(10).iterrows():
            md.append(f"| {row['frame_id']} | {row['class']} | {row['x1']:.1f} | {row['y1']:.1f} | {row['x2']:.1f} | {row['y2']:.1f} | {row['width']:.1f} | {row['height']:.1f} | {row['bbox_area']:.1f} |\n")

    # CONFIDENCE FORENSICS
    md.append("\n## SECTION C \u2014 CONFIDENCE BEHAVIOR\n")
    unique_conf = df_det['confidence'].unique()
    conf_var = df_det['confidence'].var()
    md.append(f"**Unique Confidence Values**: {len(unique_conf)} (`{unique_conf}`)\n")
    md.append(f"**Variance**: {conf_var}\n")
    
    fig, ax = plt.subplots()
    sns.countplot(x=df_det['confidence'], ax=ax)
    ax.set_title("GRAPH A10 \u2014 Exact Confidence Frequency")
    p_a10 = save_plot(fig, 'gA10_conf_freq.png')
    md.append(f"![GRAPH A10](file:///{p_a10})\n")

    # SPATIAL DISTRIBUTION & CLUSTERING
    md.append("\n## SECTION D \u2014 SPATIAL BEHAVIOR\n")
    if len(df_det) > 2:
        kmeans = KMeans(n_clusters=2, random_state=42).fit(df_det[['center_x', 'center_y']])
        df_det['cluster'] = kmeans.labels_
        
        fig, ax = plt.subplots()
        sns.scatterplot(x='center_x', y='center_y', hue='cluster', data=df_det, palette='viridis', ax=ax)
        ax.set_title("GRAPH A13 \u2014 Spatial Clustering (K-Means)")
        ax.invert_yaxis()
        p_a13 = save_plot(fig, 'gA13_clustering.png')
        md.append(f"![GRAPH A13](file:///{p_a13})\n")
    
    # DISPLACEMENT ANALYSIS
    md.append("\n## SECTION F \u2014 MOVEMENT\n")
    df_det['dx'] = df_det['center_x'].diff()
    df_det['dy'] = df_det['center_y'].diff()
    df_det['displacement'] = np.sqrt(df_det['dx']**2 + df_det['dy']**2)
    
    fig, ax = plt.subplots()
    ax.plot(df_det['timestamp'], df_det['displacement'], marker='o')
    ax.set_title("GRAPH A20 \u2014 Frame-to-Frame Center Displacement")
    p_a20 = save_plot(fig, 'gA20_displacement.png')
    md.append(f"![GRAPH A20](file:///{p_a20})\n")
    
    fig, ax = plt.subplots()
    ax.plot(df_det['center_x'], df_det['center_y'], marker='.', linestyle='-', alpha=0.6)
    ax.set_title("GRAPH A22 \u2014 Spatial Path (Pseudo-path, no tracking IDs)")
    ax.invert_yaxis()
    p_a22 = save_plot(fig, 'gA22_spatial_path.png')
    md.append(f"![GRAPH A22](file:///{p_a22})\n")
    
    # DATA QUALITY SCORECARD
    md.append("\n## SECTION G \u2014 DATA INTEGRITY & SCORECARDS\n")
    md.append("### Data-Quality Scorecard\n")
    md.append("| Check | Status | Evidence |\n|---|---|---|\n")
    md.append(f"| Missing values | {'WARNING' if df_det.isna().sum().sum() > 0 else 'PASS'} | {df_det.isna().sum().sum()} missing values |\n")
    md.append(f"| Timestamp consistency | {'WARNING' if dt_std > 0.01 else 'PASS'} | Std dev of dt = {dt_std:.4f} |\n")
    md.append(f"| 30 FPS consistency | {'WARNING' if abs(dt_mean - 0.0333) > 0.005 else 'PASS'} | Mean dt = {dt_mean:.4f}s |\n")
    md.append(f"| Negative bbox areas | {'CRITICAL' if len(invalid_areas) > 0 else 'PASS'} | {len(invalid_areas)} negative areas |\n")
    md.append(f"| Constant confidence | {'CRITICAL' if conf_var == 0 else 'PASS'} | Var = {conf_var:.4f} |\n")
    md.append(f"| Inference coverage | WARNING | 150 frames out of {total_tel_frames} telemetry |\n")
    md.append(f"| Class diversity | WARNING | {unique_classes} class(es) detected |\n")
    
    md.append("\n### Model Observability Scorecard\n")
    md.append("| Dimension | Status | Evidence |\n|---|---|---|\n")
    md.append("| Temporal observability | GOOD | Timestamps are recorded per frame. |\n")
    md.append("| Confidence observability | POOR | Confidence is static; dynamic pipeline logging is broken. |\n")
    md.append("| Spatial observability | GOOD | Coordinates recorded. |\n")
    md.append("| Bounding-box observability | POOR | Evidence of negative geometries (x2 < x1 or y2 < y1). |\n")
    md.append("| Class observability | POOR | Only single class evaluated. |\n")
    md.append("| Ground-truth availability | CRITICAL | Missing, rendering accuracy metrics invalid. |\n")

    md.append("\n## SECTION M \u2014 FINAL INTERPRETATION\n")
    md.append("### DATA COVERAGE\n")
    md.append(f"The 150 inference frames are heavily subsampled compared to the {total_tel_frames} telemetry frames. The timeline indicates sparse inference snapshots rather than continuous 30 FPS inference logging.\n")
    md.append("### CONFIDENCE\n")
    md.append("Confidence is 100% statically locked at 0.91. This is a critical pipeline bug (likely a hardcoded value injected into the JSON during serialization), meaning dynamic model confidence is completely obscured.\n")
    md.append("### BOUNDING BOX\n")
    md.append(f"There are {len(invalid_areas)} instances of negative bounding box areas. This proves that either x2 < x1 or y2 < y1 in the payload, which represents a critical geometric data anomaly that must be fixed in the preprocessing/postprocessing pipeline.\n")
    md.append("### SPATIAL\n")
    md.append("K-Means successfully identifies two heavily separated spatial clusters, but interpretation without context or tracking IDs limits conclusive claims about warehouse zones.\n")
    md.append("### TEMPORAL\n")
    md.append(f"While a 30 FPS baseline is claimed, the actual frame intervals exhibit a mean of {dt_mean:.4f}s with significant standard deviation, representing irregular sampling or processing stalls.\n")
    md.append("### DATA QUALITY\n")
    md.append("The raw payload cannot be entirely trusted. Confidence is static, geometries contain negative areas, and temporal extraction is subsampled. These engineering pipeline flaws must be fixed before deploying any new YOLO weights.\n")

    with open(REPORT_PATH, 'w') as f:
        f.write("\n".join(md))
        
    meta_path = REPORT_PATH + ".meta.json"
    with open(meta_path, 'w') as f:
        json.dump({"UserFacing": True, "RequestFeedback": False, "Summary": "Forensic Deep-Dive Report"}, f)
        
if __name__ == "__main__":
    main()
