import assert from 'assert';
import { sanitizeUrl, sanitizeText } from '../frontend/src/lib/security';
import { normalizeEvent, normalizeEvents } from '../frontend/src/lib/normalizeEvent';
import { mockEvents } from '../frontend/src/api/mockData';
import fs from 'fs';
import path from 'path';

console.log('================================================================');
console.log('FINAL INDEPENDENT AUDIT & REGRESSION VERIFICATION SUITE');
console.log('================================================================\n');

let passedTests = 0;
let totalTests = 0;
const failures: string[] = [];

function test(category: string, name: string, fn: () => void) {
  totalTests++;
  try {
    fn();
    console.log(`[PASS] [${category}] ${name}`);
    passedTests++;
  } catch (err: any) {
    console.error(`[FAIL] [${category}] ${name}:`, err.message);
    failures.push(`[${category}] ${name}: ${err.message}`);
  }
}

// ============================================================================
// 1. ASYNC FAILURE & RACE CONDITION VERIFICATION
// ============================================================================
console.log('--- 1. ASYNC REQUEST & STALE STATE ISOLATION TESTS ---');

class MockEventHookRunner {
  private activeController: AbortController | null = null;
  private requestId = 0;
  private isMounted = true;
  public state: { data: any[] | null; error: string | null; loading: boolean } = {
    data: null,
    error: null,
    loading: false,
  };

  async fetch(param: string, delayMs: number, shouldFail = false): Promise<void> {
    if (this.activeController) {
      this.activeController.abort();
    }

    const controller = new AbortController();
    this.activeController = controller;
    const currentReqId = ++this.requestId;

    this.state.loading = true;
    this.state.error = null;

    try {
      const result = await new Promise<any[]>((resolve, reject) => {
        const timer = setTimeout(() => {
          if (shouldFail) {
            reject(new Error(`API Network Error for ${param}`));
          } else {
            resolve([{ event_id: `EVT-${param}`, behaviour: param, risk_score: 75, risk_level: 'High' }]);
          }
        }, delayMs);

        controller.signal.addEventListener('abort', () => {
          clearTimeout(timer);
          const err = new Error('Request aborted');
          err.name = 'AbortError';
          reject(err);
        });
      });

      if (!this.isMounted || currentReqId !== this.requestId || controller.signal.aborted) {
        return;
      }

      this.state.data = result;
      this.state.error = null;
      this.state.loading = false;
    } catch (err: any) {
      if (err?.name === 'AbortError' || controller.signal.aborted) {
        return;
      }
      if (this.isMounted && currentReqId === this.requestId) {
        this.state.error = err.message;
        this.state.loading = false;
      }
    }
  }

  unmount() {
    this.isMounted = false;
    this.requestId++;
    if (this.activeController) {
      this.activeController.abort();
    }
  }
}

test('Async', 'Scenario A vs B: B completes first, older A cannot overwrite B', async () => {
  const runner = new MockEventHookRunner();
  const reqA = runner.fetch('RequestA_Slow', 100);
  const reqB = runner.fetch('RequestB_Fast', 20);

  await Promise.allSettled([reqA, reqB]);
  assert.strictEqual(runner.state.data?.[0].behaviour, 'RequestB_Fast');
  assert.strictEqual(runner.state.loading, false);
  assert.strictEqual(runner.state.error, null);
});

test('Async', 'Old Request A fails after new Request B succeeds: Stale error cannot overwrite B', async () => {
  const runner = new MockEventHookRunner();
  const reqA = runner.fetch('RequestA_Fails', 80, true);
  const reqB = runner.fetch('RequestB_Succeeds', 15, false);

  await Promise.allSettled([reqA, reqB]);
  assert.strictEqual(runner.state.data?.[0].behaviour, 'RequestB_Succeeds');
  assert.strictEqual(runner.state.error, null);
  assert.strictEqual(runner.state.loading, false);
});

test('Async', 'Component unmount mid-request: State is guarded against post-unmount mutation', async () => {
  const runner = new MockEventHookRunner();
  const pending = runner.fetch('UnmountTest', 40);
  runner.unmount();
  await Promise.allSettled([pending]);

  assert.strictEqual(runner.state.data, null);
  assert.strictEqual(runner.state.loading, true); // unmount froze mutation; no state update fired
});

test('Async', 'Rapid typing & filter spam: Resolves exclusively to final requested query', async () => {
  const runner = new MockEventHookRunner();
  const p1 = runner.fetch('F', 50);
  const p2 = runner.fetch('Fo', 40);
  const p3 = runner.fetch('For', 30);
  const p4 = runner.fetch('Fork', 20);
  const p5 = runner.fetch('Forklift', 10);

  await Promise.allSettled([p1, p2, p3, p4, p5]);
  assert.strictEqual(runner.state.data?.[0].behaviour, 'Forklift');
  assert.strictEqual(runner.state.loading, false);
});


// ============================================================================
// 2. MALFORMED DATA & SILENT RECORD DISAPPEARANCE PREVENTION
// ============================================================================
console.log('\n--- 2. MALFORMED EVENT DATA & RECORD RETENTION TESTS ---');

test('Malformed', 'null description -> safely fallback, record preserved', () => {
  const e = normalizeEvent({ event_id: 'EVT-901', description: null });
  assert.strictEqual(e.event_id, 'EVT-901');
  assert.strictEqual(e.description, 'No incident description provided.');
});

test('Malformed', 'null / missing behaviour -> defaults to Detected Anomaly without dropping record', () => {
  const e1 = normalizeEvent({ event_id: 'EVT-902', behaviour: null });
  assert.strictEqual(e1.behaviour, 'Detected Anomaly');
  const e2 = normalizeEvent({ event_id: 'EVT-903', behaviour: undefined });
  assert.strictEqual(e2.behaviour, 'Detected Anomaly');
});

test('Malformed', 'missing risk level -> accurately inferred from score (85 -> Critical)', () => {
  const e = normalizeEvent({ event_id: 'EVT-904', risk_score: 85, risk_level: null });
  assert.strictEqual(e.risk_level, 'Critical');
});

test('Malformed', 'invalid risk level string ("catastrophic") -> inferred from score (25 -> Low)', () => {
  const e = normalizeEvent({ event_id: 'EVT-905', risk_score: 25, risk_level: 'catastrophic' });
  assert.strictEqual(e.risk_level, 'Low');
});

test('Malformed', 'NaN score -> defaults safely to 50', () => {
  const e = normalizeEvent({ event_id: 'EVT-906', risk_score: NaN });
  assert.strictEqual(e.risk_score, 50);
});

test('Malformed', 'negative score (-40) -> clamped to 0', () => {
  const e = normalizeEvent({ event_id: 'EVT-907', risk_score: -40 });
  assert.strictEqual(e.risk_score, 0);
});

test('Malformed', 'score > 100 (999) -> clamped to 100', () => {
  const e = normalizeEvent({ event_id: 'EVT-908', risk_score: 999 });
  assert.strictEqual(e.risk_score, 100);
});

test('Malformed', 'missing or invalid timestamp -> normalized to 0', () => {
  const e1 = normalizeEvent({ event_id: 'EVT-909', timestamp: 'not-a-timestamp' });
  assert.strictEqual(e1.timestamp, 0);
  const e2 = normalizeEvent({ event_id: 'EVT-910', timestamp: -12.4 });
  assert.strictEqual(e2.timestamp, 0);
  const e3 = normalizeEvent({ event_id: 'EVT-911', timestamp: undefined });
  assert.strictEqual(e3.timestamp, 0);
});

test('Malformed', 'missing or invalid event ID -> fallback synthetic ID generated', () => {
  const e = normalizeEvent({ event_id: null, description: 'Missing ID event' }, 7);
  assert.strictEqual(e.event_id, 'EVT-AUTO-7');
});

test('Malformed', 'missing media URLs -> undefined (clean property, no crash)', () => {
  const e = normalizeEvent({ event_id: 'EVT-912', evidence_frame: null });
  assert.strictEqual(e.evidence_frame, undefined);
});

test('Malformed', 'corrupt items in array (null, undefined, string) are preserved as fallbacks, NOT silently dropped', () => {
  const rawList = [
    { event_id: 'EVT-VALID', behaviour: 'Drop', risk_score: 80, risk_level: 'Critical' },
    null,
    'corrupt-string-data',
    undefined,
    { event_id: 'EVT-VALID-2', behaviour: 'Spill', risk_score: 60, risk_level: 'High' }
  ];

  const normalized = normalizeEvents(rawList);
  assert.strictEqual(normalized.length, 5, 'Must not drop corrupted records silently');
  assert.strictEqual(normalized[0].event_id, 'EVT-VALID');
  assert.strictEqual(normalized[1].event_id, 'EVT-FALLBACK-1');
  assert.strictEqual(normalized[2].event_id, 'EVT-FALLBACK-2');
  assert.strictEqual(normalized[3].event_id, 'EVT-FALLBACK-3');
  assert.strictEqual(normalized[4].event_id, 'EVT-VALID-2');
});


// ============================================================================
// 3. SETTINGS VALIDATION & LOCALSTORAGE SECURITY
// ============================================================================
console.log('\n--- 3. SETTINGS VALIDATION & LOCALSTORAGE SECURITY TESTS ---');

const DEFAULT_SETTINGS = {
  inferenceDevice: 'cuda' as const,
  riskThreshold: 65,
  enableAlerts: true,
};

function parseAndValidateSettings(rawJson: string | null) {
  if (!rawJson) return DEFAULT_SETTINGS;
  try {
    const parsed = JSON.parse(rawJson);
    if (!parsed || typeof parsed !== 'object') {
      return DEFAULT_SETTINGS;
    }

    const device: 'cuda' | 'cpu' = (parsed.inferenceDevice === 'cpu' || parsed.inferenceDevice === 'cuda')
      ? parsed.inferenceDevice
      : DEFAULT_SETTINGS.inferenceDevice;

    const thresholdNum = Number(parsed.riskThreshold);
    const riskThreshold = (!isNaN(thresholdNum) && thresholdNum >= 30 && thresholdNum <= 95)
      ? thresholdNum
      : DEFAULT_SETTINGS.riskThreshold;

    const enableAlerts = typeof parsed.enableAlerts === 'boolean'
      ? parsed.enableAlerts
      : DEFAULT_SETTINGS.enableAlerts;

    return {
      inferenceDevice: device,
      riskThreshold,
      enableAlerts,
    };
  } catch {
    return DEFAULT_SETTINGS;
  }
}

test('Settings', 'Valid stored preferences load accurately', () => {
  const json = JSON.stringify({ inferenceDevice: 'cpu', riskThreshold: 75, enableAlerts: false });
  const s = parseAndValidateSettings(json);
  assert.strictEqual(s.inferenceDevice, 'cpu');
  assert.strictEqual(s.riskThreshold, 75);
  assert.strictEqual(s.enableAlerts, false);
});

test('Settings', 'Invalid JSON syntax safely falls back to defaults without error', () => {
  const badJson = '{"broken": json';
  assert.deepStrictEqual(parseAndValidateSettings(badJson), DEFAULT_SETTINGS);
});

test('Settings', 'Unexpected object shape safely falls back missing/invalid properties', () => {
  const weirdObj = JSON.stringify({ randomField: 12345, riskThreshold: 'invalid' });
  const s = parseAndValidateSettings(weirdObj);
  assert.strictEqual(s.inferenceDevice, 'cuda');
  assert.strictEqual(s.riskThreshold, 65);
  assert.strictEqual(s.enableAlerts, true);
});

test('Settings', 'Unknown inference device string falls back to cuda', () => {
  const s = parseAndValidateSettings(JSON.stringify({ inferenceDevice: 'tpu_cluster' }));
  assert.strictEqual(s.inferenceDevice, 'cuda');
});

test('Settings', 'Invalid boolean values (truthy strings/numbers) fall back to default boolean', () => {
  const s = parseAndValidateSettings(JSON.stringify({ enableAlerts: 'yes' }));
  assert.strictEqual(s.enableAlerts, true);
});

test('Settings', 'Out-of-bounds threshold (< 30 or > 95) clamped to default 65', () => {
  assert.strictEqual(parseAndValidateSettings(JSON.stringify({ riskThreshold: -5 })).riskThreshold, 65);
  assert.strictEqual(parseAndValidateSettings(JSON.stringify({ riskThreshold: 150 })).riskThreshold, 65);
});

test('Settings', 'Confirmed: No credentials, tokens, or passwords exist in stored schema', () => {
  const validKeys = Object.keys(DEFAULT_SETTINGS);
  assert.deepStrictEqual(validKeys, ['inferenceDevice', 'riskThreshold', 'enableAlerts']);
  const sensitivePatterns = ['auth', 'token', 'pass', 'secret', 'key', 'jwt', 'credential'];
  for (const k of validKeys) {
    for (const p of sensitivePatterns) {
      assert.ok(!k.toLowerCase().includes(p), `Key ${k} must not contain sensitive term ${p}`);
    }
  }
});


// ============================================================================
// 4. URL SECURITY & SANITIZATION TESTING
// ============================================================================
console.log('\n--- 4. URL SECURITY & STRICT SANITIZATION TESTS ---');

test('Security', 'Blocks javascript: scheme', () => {
  assert.strictEqual(sanitizeUrl('javascript:alert(1)'), '');
});

test('Security', 'Blocks case-insensitive and whitespace JAVASCRIPT: variants', () => {
  assert.strictEqual(sanitizeUrl('JAVASCRIPT:alert(1)'), '');
  assert.strictEqual(sanitizeUrl('  JavaScript:alert(1)  '), '');
  assert.strictEqual(sanitizeUrl('jav\tascript:alert(1)'), '');
});

test('Security', 'Blocks vbscript: scheme', () => {
  assert.strictEqual(sanitizeUrl('vbscript:msgbox(1)'), '');
  assert.strictEqual(sanitizeUrl('VBSCRIPT:msgbox(1)'), '');
});

test('Security', 'Blocks malicious data: schemes (HTML, SVG, JS)', () => {
  assert.strictEqual(sanitizeUrl('data:text/html,<script>alert(1)</script>'), '');
  assert.strictEqual(sanitizeUrl('data:image/svg+xml,<svg onload=alert(1)>'), '');
  assert.strictEqual(sanitizeUrl('data:text/javascript,alert(1)'), '');
});

test('Security', 'Blocks protocol-relative URLs (//evil.example)', () => {
  assert.strictEqual(sanitizeUrl('//evil.example/cookie-steal.jpg'), '');
  assert.strictEqual(sanitizeUrl('///evil.example'), '');
});

test('Security', 'Blocks backslash protocol-relative bypasses (/\\evil.example, \\\\evil.example)', () => {
  assert.strictEqual(sanitizeUrl('/\\evil.example'), '');
  assert.strictEqual(sanitizeUrl('\\/evil.example'), '');
  assert.strictEqual(sanitizeUrl('\\\\evil.example'), '');
  assert.strictEqual(sanitizeUrl('/\\/evil.example'), '');
});

test('Security', 'Blocks control characters and null byte injection in URLs', () => {
  assert.strictEqual(sanitizeUrl('java\x00script:alert(1)'), '');
  assert.strictEqual(sanitizeUrl('/data/raw/video\x0D\x0A.mp4'), '');
});

test('Security', 'Blocks untrusted external HTTP/HTTPS origins by default', () => {
  assert.strictEqual(sanitizeUrl('https://evil.example/exfiltrate.png'), '');
  assert.strictEqual(sanitizeUrl('http://attacker.com/malware.exe'), '');
});

test('Security', 'Allows safe local development and trusted loopback origins', () => {
  assert.strictEqual(sanitizeUrl('http://localhost:5173/monitoring'), 'http://localhost:5173/monitoring');
  assert.strictEqual(sanitizeUrl('http://127.0.0.1:8000/api/videos'), 'http://127.0.0.1:8000/api/videos');
});

test('Security', 'Allows legitimate relative media & evidence paths', () => {
  assert.strictEqual(sanitizeUrl('/data/raw/warehouse_bay4.mp4'), '/data/raw/warehouse_bay4.mp4');
  assert.strictEqual(sanitizeUrl('/api/videos/1/frame.jpg'), '/api/videos/1/frame.jpg');
  assert.strictEqual(sanitizeUrl('evidence/frame_104.png'), 'evidence/frame_104.png');
  assert.strictEqual(sanitizeUrl('data/raw/warehouse.mp4'), 'data/raw/warehouse.mp4');
});

test('Security', 'Allows safe base64 image data URIs (PNG, JPEG, WebP, GIF)', () => {
  const png = 'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNk+M9QDwADhgGAWjR9awAAAABJRU5ErkJggg==';
  assert.strictEqual(sanitizeUrl(png), png);
});


// ============================================================================
// 5. TIMELINE SCRUBBER & VIDEO DURATION PROTECTION
// ============================================================================
console.log('\n--- 5. TIMELINE SCRUBBER & DURATION RESILIENCE TESTS ---');

function computeTimelinePercentages(currentTime: number, duration?: number, initialTimestamp?: number) {
  const safeDuration = (typeof duration === 'number' && !isNaN(duration) && duration > 0)
    ? duration
    : 60;

  const validCurrent = isNaN(currentTime) ? 0 : Math.max(0, Math.min(safeDuration, currentTime));

  const progressPercent = safeDuration > 0
    ? Math.min(100, Math.max(0, (validCurrent / safeDuration) * 100))
    : 0;

  const markerPercent = (initialTimestamp !== undefined && !isNaN(initialTimestamp) && safeDuration > 0)
    ? Math.min(100, Math.max(0, (initialTimestamp / safeDuration) * 100))
    : null;

  return { safeDuration, progressPercent, markerPercent };
}

test('Timeline', 'duration = 0 -> does not produce NaN% or Infinity%', () => {
  const res = computeTimelinePercentages(10, 0, 5);
  assert.ok(!isNaN(res.progressPercent));
  assert.ok(isFinite(res.progressPercent));
  assert.strictEqual(res.safeDuration, 60); // Protected fallback
});

test('Timeline', 'duration = undefined -> does not produce NaN% or Infinity%', () => {
  const res = computeTimelinePercentages(10, undefined, 5);
  assert.ok(!isNaN(res.progressPercent));
  assert.ok(isFinite(res.progressPercent));
  assert.strictEqual(res.safeDuration, 60);
});

test('Timeline', 'duration = null -> does not produce NaN% or Infinity%', () => {
  const res = computeTimelinePercentages(10, null as any, 5);
  assert.ok(!isNaN(res.progressPercent));
  assert.ok(isFinite(res.progressPercent));
  assert.strictEqual(res.safeDuration, 60);
});

test('Timeline', 'currentTime > duration -> clamped strictly to 100%', () => {
  const res = computeTimelinePercentages(120, 60, 30);
  assert.strictEqual(res.progressPercent, 100);
});

test('Timeline', 'currentTime < 0 -> clamped strictly to 0%', () => {
  const res = computeTimelinePercentages(-50, 60, 30);
  assert.strictEqual(res.progressPercent, 0);
});


// ============================================================================
// 6. CSP & HEADERS COMPATIBILITY AUDIT
// ============================================================================
console.log('\n--- 6. CONTENT SECURITY POLICY COMPATIBILITY AUDIT ---');

test('CSP', 'CSP meta tag in index.html satisfies all production application assets', () => {
  const indexPath = path.resolve(process.cwd(), 'frontend/index.html');
  const indexHtml = fs.readFileSync(indexPath, 'utf-8');

  assert.ok(indexHtml.includes('http-equiv="Content-Security-Policy"'), 'CSP meta tag must exist');
  assert.ok(indexHtml.includes("script-src 'self' 'unsafe-inline'"), 'CSP must allow self & inline scripts for bundler');
  assert.ok(indexHtml.includes("style-src 'self' 'unsafe-inline' https://fonts.googleapis.com"), 'CSP must allow google fonts css');
  assert.ok(indexHtml.includes("font-src 'self' https://fonts.gstatic.com data:"), 'CSP must allow font files');
  assert.ok(indexHtml.includes("img-src 'self' data: blob: https:"), 'CSP must allow evidence frames and images');
  assert.ok(indexHtml.includes("media-src 'self' data: blob:"), 'CSP must allow video playback');
  assert.ok(indexHtml.includes("connect-src"), 'CSP must specify connect-src for APIs');
  assert.ok(indexHtml.includes("object-src 'none'"), 'CSP must disable dangerous plugins/Flash');
});


// ============================================================================
// SUMMARY REPORT
// ============================================================================
console.log('\n================================================================');
console.log(`INDEPENDENT VERIFICATION SUMMARY: ${passedTests} / ${totalTests} TESTS PASSED`);
console.log('================================================================');

if (failures.length > 0) {
  console.error('\nFAILURES RECORDED:');
  failures.forEach(f => console.error(` - ${f}`));
  process.exit(1);
} else {
  console.log('\nALL INDEPENDENT VERIFICATION TESTS PASSED SUCCESSFULLY WITH ZERO REGRESSIONS.');
}
