"""
Operational Utility Script: Run Platform Test Suite
===================================================
Executes all unit, integration, dynamic scaling, and frontend tests.
"""

import sys
import subprocess
from pathlib import Path

PROJECT_ROOT = Path(__file__).resolve().parent.parent

def run():
    print("=" * 70)
    print("RUNNING ROOT & BACKEND PYTEST SUITE")
    print("=" * 70)
    res_py = subprocess.run([sys.executable, "-m", "pytest", "-v"], cwd=str(PROJECT_ROOT))
    if res_py.returncode != 0:
        print("[FAIL] Pytest tests failed.")
        sys.exit(res_py.returncode)

    print("\n" + "=" * 70)
    print("RUNNING FRONTEND VITEST SUITE")
    print("=" * 70)
    res_fe = subprocess.run(["npm", "test", "--", "--run"], cwd=str(PROJECT_ROOT / "frontend"), shell=True)
    if res_fe.returncode != 0:
        print("[FAIL] Frontend vitest tests failed.")
        sys.exit(res_fe.returncode)

    print("\n[SUCCESS] All platform test suites passed!")

if __name__ == "__main__":
    run()
