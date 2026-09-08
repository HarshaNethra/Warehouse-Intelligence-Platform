import os
import re
import sys

# Allowed configuration / UI constants
ALLOWED_PATTERNS = [
    r'process\.env',
    r'http://',
    r'https://',
    r'localhost',
    r'127\.0\.0\.1',
    r'px',
    r'rem',
    r'#',
    r'bg-',
    r'text-',
    r'border-',
    r'flex',
    r'grid',
    r'gap-',
    r'font-',
    r'rounded',
    r'shadow',
    r'200',  # HTTP OK
    r'201',  # HTTP Created
    r'400',  # HTTP Bad Request
    r'401',  # HTTP Unauthorized
    r'403',  # HTTP Forbidden
    r'404',  # HTTP Not Found
    r'500',  # HTTP Server Error
    r'100',  # Max score percentage
    r'1000',
    r'10000',
    r'60',   # Seconds per minute
]

# Suspicious business hardcode patterns
SUSPICIOUS_PATTERNS = [
    (r'\b(supervisor|operator|admin)@[\w\.-]+\b', 'USER_EMAIL', 'User identity must come from authenticated session API'),
    (r'\b(EVT|INC|BAY|CAM|FAC|ORG)-\d{3,}\b', 'HARDCODED_ID', 'Entity IDs should be derived dynamically from database or URL params'),
    (r'const\s+\w*mock\w*\s*=', 'MOCK_OBJECT', 'Mock object definitions should not be present in production code'),
    (r'fallbackToMock|useMockData', 'MOCK_FALLBACK', 'Silent fallback to mock data masks backend errors'),
]

def scan_file(filepath):
    findings = []
    with open(filepath, 'r', encoding='utf-8', errors='ignore') as f:
        lines = f.readlines()

    for line_idx, line in enumerate(lines, start=1):
        # Skip comments and imports in tests
        if line.strip().startswith('//') or line.strip().startswith('#') or line.strip().startswith('*'):
            continue

        for pattern, category, rec in SUSPICIOUS_PATTERNS:
            if re.search(pattern, line, re.IGNORECASE):
                # Skip test files or seed scripts if explicitly allowed
                if '__tests__' in filepath or 'test' in os.path.basename(filepath):
                    continue
                findings.append({
                    'file': filepath,
                    'line': line_idx,
                    'value': line.strip()[:60],
                    'category': category,
                    'recommendation': rec
                })
    return findings

def main():
    root_dir = os.path.abspath(os.path.join(os.path.dirname(__file__), ".."))
    search_dirs = [
        os.path.join(root_dir, 'frontend', 'src'),
        os.path.join(root_dir, 'backend', 'app')
    ]

    all_findings = []
    for d in search_dirs:
        if not os.path.exists(d):
            continue
        for dirpath, _, filenames in os.walk(d):
            for fn in filenames:
                if fn.endswith(('.ts', '.tsx', '.py')) and not fn.endswith('.test.ts'):
                    fp = os.path.join(dirpath, fn)
                    findings = scan_file(fp)
                    all_findings.extend(findings)

    print("=== AUTOMATED HARDCODE DETECTOR AUDIT REPORT ===")
    print(f"Scanned Directories: {', '.join(search_dirs)}")
    print(f"Total Hardcode Findings: {len(all_findings)}\n")

    if all_findings:
        print(f"{'FILE':<60} | {'LINE':<6} | {'CATEGORY':<15} | {'VALUE':<40} | {'RECOMMENDATION'}")
        print("-" * 150)
        for f in all_findings:
            rel_file = os.path.relpath(f['file'], root_dir)
            print(f"{rel_file:<60} | {f['line']:<6} | {f['category']:<15} | {f['value']:<40} | {f['recommendation']}")
        print("\nAudit completed with findings.")
    else:
        print("✅ SUCCESS: 0 inappropriate hardcoded business patterns discovered in production codebase!")

if __name__ == '__main__':
    main()
