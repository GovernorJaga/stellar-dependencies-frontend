// public/app.js

// ---------------------------------------------------------------------------
// Shortlist pure helpers (deduplication + export)
// Extracted so they can be unit-tested with the Node test runner.
// ---------------------------------------------------------------------------

/**
 * Deduplicate a shortlist of candidates.
 *
 * Candidates are considered duplicates when they share the same `id`.
 * When duplicates are found, the first occurrence is kept and later
 * occurrences are merged into it (non-empty fields from the duplicate
 * fill in missing fields on the kept entry).
 *
 * @param {Array<Object>} shortlist
 * @returns {Array<Object>} a new deduplicated array
 */
export function deduplicateShortlist(shortlist) {
  if (!Array.isArray(shortlist)) {
    return [];
  }

  const byId = new Map();
  const order = [];

  for (const entry of shortlist) {
    if (!entry || typeof entry !== 'object') {
      continue;
    }

    const key =
      entry.id !== undefined && entry.id !== null
        ? String(entry.id)
        : `__anon__${order.length}`;

    if (!byId.has(key)) {
      byId.set(key, { ...entry });
      order.push(key);
      continue;
    }

    const kept = byId.get(key);
    for (const [field, value] of Object.entries(entry)) {
      const isEmpty =
        kept[field] === undefined ||
        kept[field] === null ||
        kept[field] === '';
      if (isEmpty && value !== undefined && value !== null && value !== '') {
        kept[field] = value;
      }
    }
  }

  return order.map((key) => byId.get(key));
}

/**
 * Export a shortlist to a serialisable format.
 *
 * @param {Array<Object>} shortlist
 * @param {Object} [options]
 * @param {'json'|'csv'} [options.format='json']
 * @returns {string}
 */
export function exportShortlist(shortlist, options = {}) {
  const { format = 'json' } = options;
  const rows = deduplicateShortlist(shortlist);

  if (format === 'csv') {
    return toCsv(rows);
  }

  return JSON.stringify(rows, null, 2);
}

function toCsv(rows) {
  if (rows.length === 0) {
    return '';
  }

  const headers = [];
  const seen = new Set();
  for (const row of rows) {
    for (const key of Object.keys(row)) {
      if (!seen.has(key)) {
        seen.add(key);
        headers.push(key);
      }
    }
  }

  const escapeCell = (value) => {
    if (value === undefined || value === null) {
      return '';
    }
    const str = typeof value === 'object' ? JSON.stringify(value) : String(value);
    if (/[",\n\r]/.test(str)) {
      return `"${str.replace(/"/g, '""')}"`;
    }
    return str;
  };

  const lines = [headers.map(escapeCell).join(',')];
  for (const row of rows) {
    lines.push(headers.map((h) => escapeCell(row[h])).join(','));
  }
  return lines.join('\n');
}

// ---------------------------------------------------------------------------
// Local sample data (fictional). No network access is ever required.
// ---------------------------------------------------------------------------

export const SAMPLE_DATA_LABEL = 'DEMO — fictional sample data';

export const SAMPLE_SHORTLIST = [
  {
    id: 'sample-1',
    name: 'Ada Lovelace (sample)',
    role: 'Engineer',
    note: 'Fictional candidate for demo purposes',
  },
  {
    id: 'sample-2',
    name: 'Grace Hopper (sample)',
    role: 'Engineer',
    note: 'Fictional candidate for demo purposes',
  },
  {
    id: 'sample-1',
    name: 'Ada Lovelace (sample)',
    role: '',
    note: 'Duplicate entry merged during dedup',
  },
];

// ---------------------------------------------------------------------------
// App state
// ---------------------------------------------------------------------------

const state = {
  shortlist: [],
  isSampleData: false,
};

// ---------------------------------------------------------------------------
// DOM helpers
// ---------------------------------------------------------------------------

function getElement(id) {
  if (typeof document === 'undefined') {
    return null;
  }
  return document.getElementById(id);
}

function renderDemoLabel() {
  const label = getElement('demo-label');
  if (!label) {
    return;
  }
  if (state.isSampleData) {
    label.textContent = SAMPLE_DATA_LABEL;
    label.hidden = false;
    label.setAttribute('data-demo', 'true');
  } else {
    label.textContent = '';
    label.hidden = true;
    label.removeAttribute('data-demo');
  }
}

function renderShortlist() {
  const container = getElement('shortlist');
  if (!container) {
    return;
  }

  const rows = deduplicateShortlist(state.shortlist);
  container.innerHTML = '';

  if (rows.length === 0) {
    const empty = document.createElement('p');
    empty.textContent = 'No candidates shortlisted yet.';
    container.appendChild(empty);
    return;
  }

  const list = document.createElement('ul');
  for (const row of rows) {
    const item = document.createElement('li');
    item.textContent = `${row.name || row.id || 'Unknown'} — ${row.role || 'No role'}`;
    list.appendChild(item);
  }
  container.appendChild(list);
}

function render() {
  renderDemoLabel();
  renderShortlist();
}

// ---------------------------------------------------------------------------
// Actions
// ---------------------------------------------------------------------------

/**
 * Load the fictional sample data. Uses only local fixtures — never fetch.
 */
export function loadSampleData() {
  state.shortlist = SAMPLE_SHORTLIST.map((entry) => ({ ...entry }));
  state.isSampleData = true;
  render();
  return state.shortlist;
}

/**
 * Clear the shortlist and remove the demo label.
 */
export function clearShortlist() {
  state.shortlist = [];
  state.isSampleData = false;
  render();
}

/**
 * Add a candidate to the shortlist.
 */
export function addToShortlist(entry) {
  if (!entry || typeof entry !== 'object') {
    return;
  }
  state.shortlist.push({ ...entry });
  render();
}

/**
 * Export the current shortlist.
 */
export function exportCurrentShortlist(format = 'json') {
  return exportShortlist(state.shortlist, { format });
}

export function getState() {
  return {
    shortlist: deduplicateShortlist(state.shortlist),
    isSampleData: state.isSampleData,
  };
}

// ---------------------------------------------------------------------------
// Bootstrap
// ---------------------------------------------------------------------------

function init() {
  const sampleButton = getElement('try-sample-data');
  if (sampleButton) {
    sampleButton.addEventListener('click', () => {
      loadSampleData();
    });
  }

  const clearButton = getElement('clear-shortlist');
  if (clearButton) {
    clearButton.addEventListener('click', () => {
      clearShortlist();
    });
  }

  const exportButton = getElement('export-shortlist');
  if (exportButton) {
    exportButton.addEventListener('click', () => {
      const output = exportCurrentShortlist('json');
      const target = getElement('export-output');
      if (target) {
        target.textContent = output;
      }
    });
  }

  render();
}

if (typeof document !== 'undefined') {
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
  } else {
    init();
  }
}