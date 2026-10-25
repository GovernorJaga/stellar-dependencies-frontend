/**
 * CSV export utilities for shortlists.
 *
 * Serializes shortlist entries to RFC 4180-style CSV, with protection
 * against spreadsheet formula injection.
 */

const FORMULA_TRIGGER_CHARS = ['=', '+', '-', '@'];

/**
 * Neutralize spreadsheet formula injection by prefixing cells whose first
 * character is one of `=`, `+`, `-`, or `@` with a single quote.
 *
 * @param {string} value
 * @returns {string}
 */
function neutralizeFormula(value) {
  if (value.length > 0 && FORMULA_TRIGGER_CHARS.includes(value[0])) {
    return `'${value}`;
  }
  return value;
}

/**
 * Quote a single CSV field per RFC 4180: wrap fields containing commas,
 * double quotes, or newlines in double quotes and double any internal quotes.
 *
 * @param {*} value
 * @returns {string}
 */
function quoteField(value) {
  let str = value === null || value === undefined ? '' : String(value);
  str = neutralizeFormula(str);

  if (/[",\r\n]/.test(str)) {
    return `"${str.replace(/"/g, '""')}"`;
  }
  return str;
}

/**
 * Serialize a row of values to a CSV line.
 *
 * @param {Array<*>} row
 * @returns {string}
 */
function serializeRow(row) {
  return row.map(quoteField).join(',');
}

/**
 * Serialize shortlist entries to CSV.
 *
 * @param {Array<Object|Array<*>>} entries - Shortlist entries. Objects are
 *   serialized using `columns` (or their own keys if `columns` is omitted).
 * @param {Object} [options]
 * @param {string[]} [options.columns] - Column keys/order for object entries.
 * @param {string[]} [options.headers] - Header row labels. Defaults to `columns`.
 * @param {boolean} [options.includeHeader=true] - Whether to emit a header row.
 * @returns {string} CSV content with CRLF line endings.
 */
function toCsv(entries, options = {}) {
  const list = Array.isArray(entries) ? entries : [];
  const { includeHeader = true } = options;

  let columns = options.columns;
  if (!columns) {
    const firstObject = list.find(
      (entry) => entry && typeof entry === 'object' && !Array.isArray(entry)
    );
    columns = firstObject ? Object.keys(firstObject) : [];
  }

  const headers = options.headers || columns;
  const rows = [];

  if (includeHeader && headers.length > 0) {
    rows.push(serializeRow(headers));
  }

  for (const entry of list) {
    if (Array.isArray(entry)) {
      rows.push(serializeRow(entry));
    } else if (entry && typeof entry === 'object') {
      rows.push(serializeRow(columns.map((key) => entry[key])));
    } else {
      rows.push(serializeRow([entry]));
    }
  }

  return rows.join('\r\n');
}

module.exports = {
  toCsv,
  quoteField,
  serializeRow,
  neutralizeFormula,
};
```

File: public/csv.test.js

```js
const test = require('node:test');
const assert = require('node:assert');

const { toCsv, quoteField, neutralizeFormula } = require('./csv');

test('plain fields are not quoted', () => {
  assert.strictEqual(quoteField('hello'), 'hello');
  assert.strictEqual(quoteField('world 123'), 'world 123');
});

test('fields with commas are quoted', () => {
  assert.strictEqual(quoteField('a,b'), '"a,b"');
});

test('fields with double quotes are quoted and quotes doubled', () => {
  assert.strictEqual(quoteField('say "hi"'), '"say ""hi"""');
});

test('fields with newlines are quoted', () => {
  assert.strictEqual(quoteField('line1\nline2'), '"line1\nline2"');
  assert.strictEqual(quoteField('line1\r\nline2'), '"line1\r\nline2"');
});

test('neutralizes formula injection for =', () => {
  assert.strictEqual(neutralizeFormula('=SUM(A1:A2)'), "'=SUM(A1:A2)");
  assert.strictEqual(quoteField('=1+1'), "'=1+1");
});

test('neutralizes formula injection for +', () => {
  assert.strictEqual(neutralizeFormula('+1'), "'+1");
  assert.strictEqual(quoteField('+cmd'), "'+cmd");
});

test('neutralizes formula injection for -', () => {
  assert.strictEqual(neutralizeFormula('-1'), "'-1");
  assert.strictEqual(quoteField('-2+3'), "'-2+3");
});

test('neutralizes formula injection for @', () => {
  assert.strictEqual(neutralizeFormula('@SUM'), "'@SUM");
  assert.strictEqual(quoteField('@import'), "'@import");
});

test('neutralized injection fields are still quoted when needed', () => {
  assert.strictEqual(quoteField('=a,b'), '"\'=a,b"');
  assert.strictEqual(quoteField('=say "hi"'), '"\'=say ""hi"""');
});

test('toCsv emits header row and CRLF line endings', () => {
  const csv = toCsv(
    [
      { name: 'Alice', score: 10 },
      { name: 'Bob', score: 20 },
    ],
    { columns: ['name', 'score'] }
  );
  assert.strictEqual(csv, 'name,score\r\nAlice,10\r\nBob,20');
});

test('toCsv can omit header row', () => {
  const csv = toCsv([{ name: 'Alice' }], {
    columns: ['name'],
    includeHeader: false,
  });
  assert.strictEqual(csv, 'Alice');
});

test('toCsv handles array entries', () => {
  const csv = toCsv(
    [
      ['a', 'b,c'],
      ['d', 'e'],
    ],
    { includeHeader: false }
  );
  assert.strictEqual(csv, 'a,"b,c"\r\nd,e');
});

test('toCsv protects against formula injection', () => {
  const csv = toCsv(
    [
      { value: '=1+1' },
      { value: '+1' },
      { value: '-1' },
      { value: '@x' },
    ],
    { columns: ['value'], includeHeader: false }
  );
  assert.strictEqual(csv, "'=1+1\r\n'+1\r\n'-1\r\n'@x");
});

test('toCsv handles empty input', () => {
  assert.strictEqual(toCsv([]), '');
});