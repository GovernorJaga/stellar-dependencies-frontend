'use strict';

const test = require('node:test');
const assert = require('node:assert');

const {
  deduplicateShortlist,
  exportShortlist,
  loadSampleData,
  DEMO_LABEL_TEXT,
  resolveApiBaseUrl,
  buildApiUrl,
} = require('./shortlist');

// ---------------------------------------------------------------------------
// Fixtures
// ---------------------------------------------------------------------------

const FIXTURE_DUPLICATES = [
  { id: '1', name: 'Alice', role: 'Engineer' },
  { id: '2', name: 'Bob', role: 'Designer' },
  { id: '1', name: 'Alice', role: 'Engineer' },
  { id: '3', name: 'Carol', role: 'Manager' },
  { id: '2', name: 'Bob', role: 'Designer' },
];

const FIXTURE_CASE_WHITESPACE = [
  { id: '1', name: '  Alice  ', role: 'Engineer' },
  { id: '2', name: 'BOB', role: 'Designer' },
  { id: '3', name: 'alice', role: 'engineer' },
  { id: '4', name: ' bob ', role: ' DESIGNER ' },
];

const FIXTURE_ORDER = [
  { id: 'c', name: 'Charlie' },
  { id: 'a', name: 'Alice' },
  { id: 'b', name: 'Bob' },
  { id: 'a', name: 'Alice' },
  { id: 'c', name: 'Charlie' },
];

// ---------------------------------------------------------------------------
// deduplicateShortlist
// ---------------------------------------------------------------------------

test('deduplicateShortlist removes exact duplicates', () => {
  const result = deduplicateShortlist(FIXTURE_DUPLICATES);
  assert.strictEqual(result.length, 3);
  assert.deepStrictEqual(
    result.map((entry) => entry.id),
    ['1', '2', '3']
  );
});

test('deduplicateShortlist normalizes case and whitespace', () => {
  const result = deduplicateShortlist(FIXTURE_CASE_WHITESPACE);
  assert.strictEqual(result.length, 2);
  assert.deepStrictEqual(
    result.map((entry) => entry.id),
    ['1', '2']
  );
});

test('deduplicateShortlist preserves first-seen order', () => {
  const result = deduplicateShortlist(FIXTURE_ORDER);
  assert.deepStrictEqual(
    result.map((entry) => entry.id),
    ['c', 'a', 'b']
  );
});

test('deduplicateShortlist handles empty and non-array input', () => {
  assert.deepStrictEqual(deduplicateShortlist([]), []);
  assert.deepStrictEqual(deduplicateShortlist(null), []);
  assert.deepStrictEqual(deduplicateShortlist(undefined), []);
});

test('deduplicateShortlist does not mutate the input', () => {
  const input = FIXTURE_DUPLICATES.map((entry) => ({ ...entry }));
  const snapshot = JSON.parse(JSON.stringify(input));
  deduplicateShortlist(input);
  assert.deepStrictEqual(input, snapshot);
});

// ---------------------------------------------------------------------------
// exportShortlist
// ---------------------------------------------------------------------------

test('exportShortlist produces the expected output format', () => {
  const entries = [
    { id: '1', name: 'Alice', role: 'Engineer' },
    { id: '2', name: 'Bob', role: 'Designer' },
  ];
  const output = exportShortlist(entries);
  assert.strictEqual(typeof output, 'string');
  const lines = output.split('\n');
  assert.strictEqual(lines.length, 2);
  assert.match(lines[0], /Alice/);
  assert.match(lines[0], /Engineer/);
  assert.match(lines[1], /Bob/);
  assert.match(lines[1], /Designer/);
});

test('exportShortlist includes all entries and their content', () => {
  const entries = [
    { id: '1', name: 'Alice', role: 'Engineer' },
    { id: '2', name: 'Bob', role: 'Designer' },
    { id: '3', name: 'Carol', role: 'Manager' },
  ];
  const output = exportShortlist(entries);
  for (const entry of entries) {
    assert.ok(output.includes(entry.name), `missing ${entry.name}`);
    assert.ok(output.includes(entry.role), `missing ${entry.role}`);
  }
});

test('exportShortlist handles empty input', () => {
  const output = exportShortlist([]);
  assert.strictEqual(typeof output, 'string');
  assert.strictEqual(output.trim(), '');
});

test('exportShortlist exports deduplicated content end-to-end', () => {
  const deduped = deduplicateShortlist(FIXTURE_DUPLICATES);
  const output = exportShortlist(deduped);
  const lines = output.split('\n').filter((line) => line.trim() !== '');
  assert.strictEqual(lines.length, 3);
});

// ---------------------------------------------------------------------------
// Offline demo / sample data
// ---------------------------------------------------------------------------

test('sample-data flow makes zero fetch calls and shows the demo label', () => {
  const originalFetch = globalThis.fetch;
  let fetchCalls = 0;
  globalThis.fetch = function spyFetch() {
    fetchCalls += 1;
    throw new Error('fetch must not be called during the offline demo');
  };

  try {
    const result = loadSampleData();

    assert.strictEqual(fetchCalls, 0, 'sample flow must not call fetch');
    assert.ok(result, 'sample flow should return a result');
    assert.ok(Array.isArray(result.entries), 'sample entries should be an array');
    assert.ok(result.entries.length > 0, 'sample data should not be empty');

    assert.ok(result.demoLabel, 'demo label element must be present');
    assert.strictEqual(
      result.demoLabel.text,
      DEMO_LABEL_TEXT,
      'demo label must use the canonical sample-data text'
    );
    assert.strictEqual(
      result.demoLabel.visible,
      true,
      'demo label must be visible whenever sample data is shown'
    );
  } finally {
    globalThis.fetch = originalFetch;
  }
});

test('demo label is visible for every sample-data entry set', () => {
  const result = loadSampleData();
  assert.ok(result.demoLabel.visible);
  assert.strictEqual(result.demoLabel.text, DEMO_LABEL_TEXT);
  assert.match(DEMO_LABEL_TEXT, /sample|demo|fictional/i);
});

// ---------------------------------------------------------------------------
// Configurable API base URL
// ---------------------------------------------------------------------------

test('resolveApiBaseUrl returns the configured base URL', () => {
  const baseUrl = resolveApiBaseUrl();
  assert.strictEqual(typeof baseUrl, 'string');
  assert.ok(baseUrl.length > 0, 'API base URL must not be empty');
});

test('resolveApiBaseUrl does not hardcode a host', () => {
  const baseUrl = resolveApiBaseUrl();
  assert.doesNotMatch(
    baseUrl,
    /localhost|127\.0\.0\.1/,
    'API base URL must come from configuration, not a hardcoded host'
  );
});

test('buildApiUrl joins the configured base URL with a path', () => {
  const url = buildApiUrl('/shortlist');
  assert.ok(url.startsWith(resolveApiBaseUrl()));
  assert.match(url, /\/shortlist$/);
});

test('buildApiUrl tolerates trailing slashes in the base URL', () => {
  const url = buildApiUrl('shortlist');
  assert.doesNotMatch(url, /\/\/shortlist/, 'must not produce double slashes');
  assert.match(url, /\/shortlist$/);
});