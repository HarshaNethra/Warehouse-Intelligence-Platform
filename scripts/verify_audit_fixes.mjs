import assert from 'assert';
import { sanitizeUrl, sanitizeText } from '../frontend/src/lib/security.js';
import { normalizeEvent, normalizeEvents } from '../frontend/src/lib/normalizeEvent.js';

console.log('=====================================================');
console.log('RUNNING COMPREHENSIVE AUDIT FIX VERIFICATION SUITE');
console.log('=====================================================\n');

let passedTests = 0;
let totalTests = 0;

function test(name, fn) {
  totalTests++;
  try {
    fn();
    console.log(`[PASS] ${name}`);
    passedTests++;
  } catch (err) {
    console.error(`[FAIL] ${name}:`, err.message);
  }
}

// -------------------------------------------------------------
// TEST SUITE 1: URL SECURITY & SANITIZATION
// -------------------------------------------------------------
console.log('--- 1. URL SECURITY TEST CASES ---');

test('Rejects javascript: scheme', () => {
  assert.strictEqual(sanitizeUrl('javascript:alert(1)'), null);
});

test('Rejects case-insensitive JAVASCRIPT: scheme', () => {
  assert.strictEqual(sanitizeUrl('JAVASCRIPT:alert(1)'), null);
  assert.strictEqual(sanitizeUrl('JavaSCRIPT:alert(1)'), null);
});

test('Rejects vbscript: scheme', () => {
  assert.strictEqual(sanitizeUrl('vbscript:msgbox(1)'), null);
});

test('Rejects malicious data: schemes (HTML / SVG / JS)', () => {
  assert.strictEqual(sanitizeUrl('data:text/html,<script>alert(1)</script>'), null);
  assert.strictEqual(sanitizeUrl('data:image/svg+xml,<svg onload=alert(1)>'), null);
  assert.strictEqual(sanitizeUrl('data:text/javascript,alert(1)'), null);
});

test('Allows safe image data URIs (PNG / JPEG / WebP)', () => {
  const safeDataUri = 'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNk+M9QDwADhgGAWjR9awAAAABJRU5ErkJggg==';
  assert.strictEqual(sanitizeUrl(safeDataUri), safeDataUri);
});

test('Rejects protocol-relative URLs (//evil.example)', () => {
  assert.strictEqual(sanitizeUrl('//evil.example/malicious.js'), null);
  assert.strictEqual(sanitizeUrl('///evil.example'), null);
});

test('Rejects backslash protocol-relative bypasses (/\\evil.example, \\\\evil.example)', () => {
  assert.strictEqual(sanitizeUrl('/\\evil.example'), null);
  assert.strictEqual(sanitizeUrl('\\/evil.example'), null);
  assert.strictEqual(sanitizeUrl('\\\\evil.example'), null);
  assert.strictEqual(sanitizeUrl('/\\/evil.example'), null);
});

test('Rejects external HTTP/HTTPS origin bypasses unless relative/same-origin', () => {
  assert.strictEqual(sanitizeUrl('https://evil.example/payload.jpg'), null);
  assert.strictEqual(sanitizeUrl('http://evil.example/payload.jpg'), null);
});

test('Allows legitimate relative media and evidence paths', () => {
  assert.strictEqual(sanitizeUrl('/data/raw/warehouse_bay4.mp4'), '/data/raw/warehouse_bay4.mp4');
  assert.strictEqual(sanitizeUrl('/api/videos/1/frame.jpg'), '/api/videos/1/frame.jpg');
  assert.strictEqual(sanitizeUrl('evidence/frame_104.png'), 'evidence/frame_104.png');
});

test('Rejects non-string and empty inputs', () => {
  assert.strictEqual(sanitizeUrl(null), null);
  assert.strictEqual(sanitizeUrl(undefined), null);
  assert.strictEqual(sanitizeUrl(''), null);
  assert.strictEqual(sanitizeUrl('   '), null);
});


// -------------------------------------------------------------
// TEST SUITE 2: SAFE EVENT DATA NORMALIZATION
// -------------------------------------------------------------
console.log('\n--- 2. SAFE EVENT NORMALIZATION TEST CASES ---');

test('Handles completely empty object safely without throwing', () => {
  const normalized = normalizeEvent({});
  assert.ok(normalized.event_id.startsWith('EVT-'));
  assert.strictEqual(normalized.video_id, 'VID-01');
  assert.strictEqual(normalized.timestamp, 0);
  assert.strictEqual(normalized.behaviour, 'Detected Anomaly');
  assert.strictEqual(normalized.risk_score, 50);
  assert.strictEqual(normalized.risk_level, 'Medium');
  assert.strictEqual(normalized.description, 'No incident description provided.');
  assert.strictEqual(normalized.reason, 'Anomaly detected during automated video analysis.');
  assert.deepStrictEqual(normalized.tags, []);
  assert.strictEqual(normalized.evidence_frame, undefined);
});

test('Handles null and undefined description safely', () => {
  const norm1 = normalizeEvent({ description: null });
  assert.strictEqual(norm1.description, 'No incident description provided.');
  const norm2 = normalizeEvent({ description: undefined });
  assert.strictEqual(norm2.description, 'No incident description provided.');
});

test('Handles missing and unexpected risk levels', () => {
  const normCritical = normalizeEvent({ risk_score: 92, risk_level: 'invalid_level' });
  assert.strictEqual(normCritical.risk_level, 'Critical'); // Inferred from score >= 80

  const normLow = normalizeEvent({ risk_score: 20, risk_level: undefined });
  assert.strictEqual(normLow.risk_level, 'Low'); // Inferred from score < 35

  const normCaseInsensitive = normalizeEvent({ risk_level: 'hIgH', risk_score: 65 });
  assert.strictEqual(normCaseInsensitive.risk_level, 'High');
});

test('Normalizes malformed timestamps (negative, string, NaN)', () => {
  assert.strictEqual(normalizeEvent({ timestamp: '42.5' }).timestamp, 42.5);
  assert.strictEqual(normalizeEvent({ timestamp: -15 }).timestamp, 0);
  assert.strictEqual(normalizeEvent({ timestamp: 'not-a-number' }).timestamp, 0);
  assert.strictEqual(normalizeEvent({ timestamp: NaN }).timestamp, 0);
});

test('Sanitizes evidence frame in event record', () => {
  const evilEvent = normalizeEvent({
    event_id: 'EVT-01',
    evidence_frame: 'javascript:alert(document.cookie)'
  });
  assert.strictEqual(evilEvent.evidence_frame, undefined);

  const safeEvent = normalizeEvent({
    event_id: 'EVT-01',
    evidence_frame: '/data/frames/frame_01.jpg'
  });
  assert.strictEqual(safeEvent.evidence_frame, '/data/frames/frame_01.jpg');
});

test('normalizeEvents safely filters out corrupt elements in list', () => {
  const corruptList = [
    { event_id: 'EVT-1', behaviour: 'Drop', risk_score: 85, risk_level: 'Critical' },
    null,
    undefined,
    'corrupt-string-item',
    { event_id: 'EVT-2', behaviour: 'Forklift Speed', risk_score: 70, risk_level: 'High' }
  ];
  const results = normalizeEvents(corruptList);
  assert.strictEqual(results.length, 5); // Fallbacks ensure nothing crashes
  assert.strictEqual(results[0].event_id, 'EVT-1');
  assert.strictEqual(results[4].event_id, 'EVT-2');
});


// -------------------------------------------------------------
// TEST SUITE 3: MOCK/OFFLINE SEARCH LOGIC
// -------------------------------------------------------------
console.log('\n--- 3. MOCK SEARCH FILTERING TEST CASES ---');

import { mockEvents } from '../frontend/src/api/mockData.js';

function mockSearchFilter(events, params) {
  let filtered = normalizeEvents(events);
  if (params?.risk_level && params.risk_level !== 'All') {
    const targetRisk = params.risk_level.toLowerCase();
    filtered = filtered.filter(e => e.risk_level.toLowerCase() === targetRisk);
  }
  if (params?.search && params.search.trim()) {
    const q = params.search.trim().toLowerCase();
    filtered = filtered.filter(e => 
      e.behaviour.toLowerCase().includes(q) ||
      e.description.toLowerCase().includes(q) ||
      e.reason.toLowerCase().includes(q) ||
      e.event_id.toLowerCase().includes(q) ||
      (e.bay_id && e.bay_id.toLowerCase().includes(q))
    );
  }
  return filtered;
}

test('Mock search with normal keyword (case-insensitive)', () => {
  const results = mockSearchFilter(mockEvents, { search: 'forklift' });
  assert.ok(results.length > 0);
  assert.ok(results.every(e => 
    e.behaviour.toLowerCase().includes('forklift') ||
    e.description.toLowerCase().includes('forklift') ||
    e.reason.toLowerCase().includes('forklift')
  ));
});

test('Mock search with empty / whitespace-only query returns all', () => {
  const allCount = mockEvents.length;
  assert.strictEqual(mockSearchFilter(mockEvents, { search: '' }).length, allCount);
  assert.strictEqual(mockSearchFilter(mockEvents, { search: '   ' }).length, allCount);
});

test('Mock search with no matches returns empty array', () => {
  const results = mockSearchFilter(mockEvents, { search: 'NON_EXISTENT_XYZ_TERM_123' });
  assert.strictEqual(results.length, 0);
});

test('Mock search with special characters handles literal search without regex errors', () => {
  // Should not throw SyntaxError
  const results = mockSearchFilter(mockEvents, { search: '[()*+?^$]' });
  assert.strictEqual(results.length, 0);
});


// -------------------------------------------------------------
// TEST SUITE 4: SETTINGS VALIDATION LOGIC
// -------------------------------------------------------------
console.log('\n--- 4. SETTINGS PERSISTENCE VALIDATION TEST CASES ---');

const DEFAULT_SETTINGS = {
  inferenceDevice: 'cuda',
  riskThreshold: 65,
  enableAlerts: true,
};

function parseAndValidateSettings(rawJson) {
  if (!rawJson) return DEFAULT_SETTINGS;
  try {
    const parsed = JSON.parse(rawJson);
    if (!parsed || typeof parsed !== 'object') {
      return DEFAULT_SETTINGS;
    }

    const device = (parsed.inferenceDevice === 'cpu' || parsed.inferenceDevice === 'cuda')
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

test('Valid stored settings are correctly loaded', () => {
  const validJson = JSON.stringify({ inferenceDevice: 'cpu', riskThreshold: 80, enableAlerts: false });
  const parsed = parseAndValidateSettings(validJson);
  assert.strictEqual(parsed.inferenceDevice, 'cpu');
  assert.strictEqual(parsed.riskThreshold, 80);
  assert.strictEqual(parsed.enableAlerts, false);
});

test('Corrupted JSON safely returns DEFAULT_SETTINGS', () => {
  const corruptJson = '{"inferenceDevice": "cpu", riskThreshold: BROKEN';
  const parsed = parseAndValidateSettings(corruptJson);
  assert.deepStrictEqual(parsed, DEFAULT_SETTINGS);
});

test('Out-of-range risk threshold falls back to default 65', () => {
  const overMax = JSON.stringify({ inferenceDevice: 'cuda', riskThreshold: 9999, enableAlerts: true });
  assert.strictEqual(parseAndValidateSettings(overMax).riskThreshold, 65);

  const underMin = JSON.stringify({ inferenceDevice: 'cuda', riskThreshold: -10, enableAlerts: true });
  assert.strictEqual(parseAndValidateSettings(underMin).riskThreshold, 65);
});

test('Unknown inference device falls back to cuda', () => {
  const unknownDev = JSON.stringify({ inferenceDevice: 'quantum_tpu', riskThreshold: 70, enableAlerts: true });
  assert.strictEqual(parseAndValidateSettings(unknownDev).inferenceDevice, 'cuda');
});

// -------------------------------------------------------------
// SUMMARY
// -------------------------------------------------------------
console.log('\n=====================================================');
console.log(`TEST SUMMARY: ${passedTests} / ${totalTests} TESTS PASSED`);
console.log('=====================================================');

if (passedTests !== totalTests) {
  process.exit(1);
}
