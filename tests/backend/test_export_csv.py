import io
import csv
import sys
import os

backend_path = os.path.abspath(os.path.join(os.path.dirname(__file__), "..", "..", "backend"))
if backend_path not in sys.path:
    sys.path.insert(0, backend_path)

from fastapi.testclient import TestClient
from app.main import app

def test_export_csv_endpoint_status():
    client = TestClient(app)
    response = client.get("/api/events/export/csv")
    assert response.status_code == 200
    assert "text/csv" in response.headers.get("content-type", "")
    assert "attachment; filename=" in response.headers.get("content-disposition", "")

def test_export_csv_headers():
    client = TestClient(app)
    response = client.get("/api/events/export/csv")
    assert response.status_code == 200

    content = response.text
    # Check UTF-8 BOM
    assert content.startswith("\ufeff")

    reader = csv.reader(io.StringIO(content.lstrip("\ufeff")))
    header = next(reader)
    expected_headers = [
        "Event ID",
        "Video ID",
        "Timestamp (s)",
        "Bay ID",
        "Camera ID",
        "Behaviour",
        "Risk Level",
        "Risk Score",
        "Description",
        "Reason",
        "Recommended Action",
        "Created At"
    ]
    assert header == expected_headers

def test_export_csv_filtering():
    client = TestClient(app)
    response = client.get("/api/events/export/csv?risk_level=Critical")
    assert response.status_code == 200

    reader = csv.reader(io.StringIO(response.text.lstrip("\ufeff")))
    header = next(reader)
    risk_level_idx = header.index("Risk Level")

    rows = list(reader)
    assert len(rows) > 0
    for row in rows:
        assert row[risk_level_idx] == "Critical"

if __name__ == "__main__":
    test_export_csv_endpoint_status()
    test_export_csv_headers()
    test_export_csv_filtering()
    print("All export CSV endpoint tests passed successfully!")
