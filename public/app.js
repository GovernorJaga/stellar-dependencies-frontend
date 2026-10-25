'use strict';

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
// API configuration
//
// The backend is a separate service. Its base URL is provided by the
// `config.js` file (loaded before this script) via `window.API_BASE_URL`.
// Pointing the UI at a different backend therefore requires no code change —
// only editing `config.js` (or the corresponding meta tag).
// ---------------------------------------------------------------------------

/**
 * Resolve the configured API base URL.
 *
 * Resolution order:
 *   1. `window.API_BASE_URL` (set by config.js)
 *   2. `<meta name="api-base-url" content="...">`
 *   3. Same-origin (empty string) as a safe fallback
 *
 * Trailing slashes are stripped so callers can safely append `/path`.
 *
 * @returns {string} the base URL without a trailing slash (may be empty)
 */
export function getApiBaseUrl() {
  let base = '';

  if (typeof window !== 'undefined' && typeof window.API_BASE_URL === 'string') {
    base = window.API_BASE_URL;
  } else if (typeof document !== 'undefined') {
    const meta = document.querySelector('meta[name="api-base-url"]');
    if (meta) {
      base = meta.getAttribute('content') || '';
    }
  }

  return String(base).trim().replace(/\/+$/, '');
}

/**
 * Build a fully-qualified API URL for the given path.
 *
 * @param {string} path e.g. `/api/packages/foo`
 * @returns {string}
 */
export function buildApiUrl(path) {
  const base = getApiBaseUrl();
  const suffix = path.startsWith('/') ? path : `/${path}`;
  return `${base}${suffix}`;
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

// ---------------------------------------------------------------------------
// Package scanner (upstream)
// ---------------------------------------------------------------------------

(function () {
  'use strict';

  // ---------------------------------------------------------------------------
  // DOM helpers
  // ---------------------------------------------------------------------------

  function $(id) {
    return document.getElementById(id);
  }

  /**
   * Create an element with safe text content and optional attributes.
   * Never uses innerHTML; all text goes through textContent.
   */
  function el(tag, options) {
    var node = document.createElement(tag);
    var opts = options || {};
    if (opts.className) {
      node.className = opts.className;
    }
    if (opts.text !== undefined && opts.text !== null) {
      node.textContent = String(opts.text);
    }
    if (opts.attrs) {
      Object.keys(opts.attrs).forEach(function (name) {
        var value = opts.attrs[name];
        if (value !== undefined && value !== null) {
          node.setAttribute(name, String(value));
        }
      });
    }
    if (opts.children) {
      opts.children.forEach(function (child) {
        if (child) {
          node.appendChild(child);
        }
      });
    }
    return node;
  }

  /**
   * Returns a safe https: URL string, or null if the URL is missing,
   * malformed, or uses any other scheme (javascript:, data:, http:, etc.).
   */
  function safeHttpsUrl(raw) {
    if (typeof raw !== 'string') {
      return null;
    }
    var trimmed = raw.trim();
    if (!trimmed) {
      return null;
    }
    var parsed;
    try {
      parsed = new URL(trimmed);
    } catch (err) {
      return null;
    }
    if (parsed.protocol !== 'https:') {
      return null;
    }
    if (!parsed.hostname) {
      return null;
    }
    return parsed.href;
  }

  /**
   * Build a link element only when the URL is a valid https: URL.
   * Otherwise returns a plain text node so hostile metadata cannot
   * inject markup or javascript: links.
   */
  function safeLink(rawUrl, label, className) {
    var href = safeHttpsUrl(rawUrl);
    var text = label === undefined || label === null ? '' : String(label);
    if (!href) {
      return el('span', { className: className, text: text });
    }
    return el('a', {
      className: className,
      text: text,
      attrs: {
        href: href,
        rel: 'noopener noreferrer',
        target: '_blank'
      }
    });
  }

  function createEl(tag, className, text) {
    var el = document.createElement(tag);
    if (className) {
      el.className = className;
    }
    if (text !== undefined && text !== null) {
      el.textContent = text;
    }
    return el;
  }

  // ---------------------------------------------------------------------------
  // API base URL resolution
  //
  // The backend is a separate service. Its base URL comes from `config.js`
  // (window.API_BASE_URL) or a `<meta name="api-base-url">` tag. No host is
  // hardcoded here; changing the backend requires only editing config.js.
  // ---------------------------------------------------------------------------

  function resolveApiBaseUrl() {
    var base = '';

    if (typeof window !== 'undefined' && typeof window.API_BASE_URL === 'string') {
      base = window.API_BASE_URL;
    } else if (typeof document !== 'undefined') {
      var meta = document.querySelector('meta[name="api-base-url"]');
      if (meta) {
        base = meta.getAttribute('content') || '';
      }
    }

    return String(base).trim().replace(/\/+$/, '');
  }

  function apiUrl(path) {
    var base = resolveApiBaseUrl();
    var suffix = path.charAt(0) === '/' ? path : '/' + path;
    return base + suffix;
  }

  // ---------------------------------------------------------------------------
  // Report view state
  // ---------------------------------------------------------------------------

  var reportState = {
    report: null,
    showOnlyFailures: false
  };

  function normalizeReport(raw) {
    var report = raw || {};
    var packages = Array.isArray(report.packages) ? report.packages : [];
    var lookups = Array.isArray(report.lookups) ? report.lookups : [];

    var normalizedLookups = lookups.map(function (lookup) {
      var failed = lookup.failed === true || lookup.status === 'failed' || lookup.status === 'error' || !!lookup.error || !!lookup.reason;
      return {
        name: lookup.name || lookup.package || lookup.packageName || '(unknown)',
        failed: failed,
        reason: lookup.reason || lookup.error || lookup.message || (failed ? 'Unknown failure' : null),
        raw: lookup
      };
    });

    var normalizedPackages = packages.map(function (pkg) {
      var failed = pkg.failed === true || pkg.status === 'failed' || pkg.status === 'error' || !!pkg.error || !!pkg.reason;
      return {
        name: pkg.name || pkg.package || pkg.packageName || '(unknown)',
        version: pkg.version || null,
        failed: failed,
        reason: pkg.reason || pkg.error || pkg.message || (failed ? 'Unknown failure' : null),
        raw: pkg
      };
    });

    return {
      packages: normalizedPackages,
      lookups: normalizedLookups
    };
  }

  function getFailures(report) {
    var failures = [];
    var seen = {};

    function addFailure(name, reason) {
      var key = name + '\u0000' + (reason || '');
      if (seen[key]) {
        return;
      }
      seen[key] = true;
      failures.push({ name: name, reason: reason || 'Unknown failure' });
    }

    report.lookups.forEach(function (lookup) {
      if (lookup.failed) {
        addFailure(lookup.name, lookup.reason);
      }
    });

    report.packages.forEach(function (pkg) {
      if (pkg.failed) {
        addFailure(pkg.name, pkg.reason);
      }
    });

    return failures;
  }

  function renderFailures(container, failures) {
    var section = createEl('section', 'failures-section');
    var heading = createEl('h2', 'failures-heading', 'Lookup Failures');
    section.appendChild(heading);

    if (failures.length === 0) {
      section.appendChild(createEl('p', 'failures-empty', 'No lookup failures.'));
      container.appendChild(section);
      return;
    }

    var count = createEl('p', 'failures-count', failures.length + ' failed lookup' + (failures.length === 1 ? '' : 's'));
    section.appendChild(count);

    var list = createEl('ul', 'failures-list');
    failures.forEach(function (failure) {
      var item = createEl('li', 'failure-item');
      item.setAttribute('data-package', failure.name);
      item.appendChild(createEl('span', 'failure-name', failure.name));
      item.appendChild(createEl('span', 'failure-reason', failure.reason));
      list.appendChild(item);
    });
    section.appendChild(list);

    container.appendChild(section);
  }

  function renderPackages(container, packages, showOnlyFailures) {
    var section = createEl('section', 'packages-section');
    section.appendChild(createEl('h2', 'packages-heading', 'Packages'));

    var visible = showOnlyFailures
      ? packages.filter(function (pkg) { return pkg.failed; })
      : packages;

    if (visible.length === 0) {
      section.appendChild(createEl('p', 'packages-empty', showOnlyFailures ? 'No failed packages.' : 'No packages.'));
      container.appendChild(section);
      return;
    }

    var list = createEl('ul', 'packages-list');
    visible.forEach(function (pkg) {
      var item = createEl('li', 'package-item' + (pkg.failed ? ' package-item--failed' : ''));
      item.setAttribute('data-package', pkg.name);
      item.appendChild(createEl('span', 'package-name', pkg.name));
      if (pkg.version) {
        item.appendChild(createEl('span', 'package-version', pkg.version));
      }
      if (pkg.failed) {
        item.appendChild(createEl('span', 'package-reason', pkg.reason));
      }
      list.appendChild(item);
    });
    section.appendChild(list);

    container.appendChild(section);
  }

  function renderToggle(container) {
    var wrapper = createEl('div', 'filter-toggle');
    var label = createEl('label', 'filter-toggle-label');
    var checkbox = document.createElement('input');
    checkbox.type = 'checkbox';
    checkbox.id = 'show-only-failures';
    checkbox.checked = reportState.showOnlyFailures;
    checkbox.addEventListener('change', function () {
      reportState.showOnlyFailures = checkbox.checked;
      render();
    });
    label.appendChild(checkbox);
    label.appendChild(document.createTextNode(' Show only failures'));
    wrapper.appendChild(label);
    container.appendChild(wrapper);
  }

  function render() {
    var root = document.getElementById('report');
    if (!root) {
      return;
    }

    root.innerHTML = '';

    if (!reportState.report) {
      root.appendChild(createEl('p', 'report-empty', 'No report loaded.'));
      return;
    }

    renderToggle(root);

    var failures = getFailures(reportState.report);
    renderFailures(root, failures);
    renderPackages(root, reportState.report.packages, reportState.showOnlyFailures);
  }

  function setReport(raw) {
    reportState.report = normalizeReport(raw);
    render();
  }

  function loadReport(url) {
    var target = url;
    // Relative URLs are resolved against the configured API base URL.
    if (typeof url === 'string' && !/^[a-z][a-z0-9+.-]*:/i.test(url) && url.charAt(0) !== '/') {
      target = apiUrl(url);
    } else if (typeof url === 'string' && url.charAt(0) === '/') {
      target = apiUrl(url);
    }

    return fetch(target)
      .then(function (response) {
        if (!response.ok) {
          throw new Error('Failed to load report: ' + response.status);
        }
        return response.json();
      })
      .then(function (data) {
        setReport(data);
        return reportState.report;
      });
  }

  // ---------------------------------------------------------------------------
  // Package scanning
  // ---------------------------------------------------------------------------

  function renderPackage(pkg) {
    var item = el('li', { className: 'package' });

    var name = pkg && pkg.name !== undefined && pkg.name !== null ? String(pkg.name) : '(unknown)';
    item.appendChild(el('h3', { className: 'package-name', text: name }));

    if (pkg && pkg.description) {
      item.appendChild(el('p', { className: 'package-description', text: String(pkg.description) }));
    }

    if (pkg && pkg.maintainer) {
      var maintainer = el('p', { className: 'package-maintainer' });
      maintainer.appendChild(el('span', { text: 'Maintainer: ' }));
      maintainer.appendChild(el('span', { text: String(pkg.maintainer) }));
      item.appendChild(maintainer);
    }

    if (pkg && pkg.repository) {
      var repo = el('p', { className: 'package-repository' });
      repo.appendChild(el('span', { text: 'Repository: ' }));
      repo.appendChild(safeLink(pkg.repository, String(pkg.repository), 'package-repository-link'));
      item.appendChild(repo);
    }

    if (pkg && pkg.homepage) {
      var home = el('p', { className: 'package-homepage' });
      home.appendChild(el('span', { text: 'Homepage: ' }));
      home.appendChild(safeLink(pkg.homepage, String(pkg.homepage), 'package-homepage-link'));
      item.appendChild(home);
    }

    return item;
  }

  function clearChildren(node) {
    while (node && node.firstChild) {
      node.removeChild(node.firstChild);
    }
  }

  var state = {
    status: 'idle', // idle | running | cancelled | done | error
    controller: null,
    total: 0,
    completed: 0
  };

  var ui = {};

  function announce(message) {
    if (ui.status) {
      ui.status.textContent = message;
    }
  }

  function setProgress(completed, total) {
    state.completed = completed;
    state.total = total;
    if (ui.progress) {
      if (total > 0) {
        ui.progress.max = String(total);
        ui.progress.value = String(completed);
        ui.progress.setAttribute('aria-valuemax', String(total));
        ui.progress.setAttribute('aria-valuenow', String(completed));
      } else {
        ui.progress.removeAttribute('value');
        ui.progress.removeAttribute('aria-valuenow');
      }
    }
    if (total > 0) {
      announce('Scanning package ' + completed + ' of ' + total + '…');
    } else {
      announce('Scanning…');
    }
  }

  function setControlsDisabled(disabled) {
    if (ui.scanButton) {
      ui.scanButton.disabled = disabled;
    }
    if (ui.input) {
      ui.input.disabled = disabled;
    }
    if (ui.cancelButton) {
      ui.cancelButton.disabled = !disabled;
    }
  }

  function setStatus(status, message) {
    state.status = status;
    if (ui.container) {
      ui.container.setAttribute('data-scan-status', status);
    }
    if (message) {
      announce(message);
    }
  }

  function resetResults() {
    if (ui.results) {
      clearChildren(ui.results);
    }
  }

  function renderResults(packages) {
    if (!ui.results) {
      return;
    }
    resetResults();
    if (!packages || packages.length === 0) {
      ui.results.appendChild(el('li', { className: 'empty', text: 'No packages found.' }));
      return;
    }
    packages.forEach(function (pkg) {
      ui.results.appendChild(renderPackage(pkg));
    });
  }

  function renderError(message) {
    if (!ui.results) {
      return;
    }
    resetResults();
    ui.results.appendChild(el('li', { className: 'error', text: message }));
  }

  function cancelScan() {
    if (state.status !== 'running' || !state.controller) {
      return;
    }
    state.controller.abort();
  }

  function parsePackageNames(raw) {
    if (!raw) {
      return [];
    }
    return String(raw)
      .split(/[\s,]+/)
      .map(function (s) { return s.trim(); })
      .filter(function (s) { return s.length > 0; });
  }

  function fetchPackage(name, signal) {
    var url = apiUrl('/api/packages/' + encodeURIComponent(name));
    return fetch(url, {
      method: 'GET',
      headers: { Accept: 'application/json' },
      signal: signal
    }).then(function (response) {
      if (!response.ok) {
        throw new Error('Lookup failed for ' + name + ' (' + response.status + ')');
      }
      return response.json();
    });
  }

  function startScan() {
    if (state.status === 'running') {
      return;
    }

    var names = parsePackageNames(ui.input ? ui.input.value : '');
    if (names.length === 0) {
      setStatus('idle', 'Enter at least one package name to scan.');
      return;
    }

    var controller = new AbortController();
    state.controller = controller;
    state.total = names.length;
    state.completed = 0;

    setControlsDisabled(true);
    resetResults();
    setStatus('running');
    setProgress(0, names.length);

    var results = [];
    var failures = [];

    var chain = Promise.resolve();

    names.forEach(function (name, index) {
      chain = chain.then(function () {
        if (controller.signal.aborted) {
          return null;
        }
        return fetchPackage(name, controller.signal).then(function (pkg) {
          results.push(pkg);
        }).catch(function (err) {
          if (err && err.name === 'AbortError') {
            throw err;
          }
          failures.push({ name: name, message: err && err.message ? err.message : String(err) });
        }).then(function () {
          if (!controller.signal.aborted) {
            setProgress(index + 1, names.length);
          }
        });
      });
    });

    chain.then(function () {
      if (controller.signal.aborted) {
        return;
      }
      renderResults(results);
      if (failures.length > 0) {
        var summary = failures.length + ' package(s) could not be loaded.';
        announce('Scan complete. ' + results.length + ' of ' + names.length + ' packages loaded. ' + summary);
      } else {
        announce('Scan complete. ' + results.length + ' of ' + names.length + ' packages loaded.');
      }
      setStatus('done');
    }).catch(function (err) {
      if (err && err.name === 'AbortError') {
        setStatus('cancelled', 'Scan cancelled.');
        renderError('Scan cancelled.');
        return;
      }
      setStatus('error', 'Scan failed: ' + (err && err.message ? err.message : String(err)));
      renderError('Scan failed. Please try again.');
    }).then(function () {
      state.controller = null;
      setControlsDisabled(false);
      if (ui.cancelButton) {
        ui.cancelButton.disabled = true;
      }
    });
  }

  // ---------------------------------------------------------------------------
  // Initialisation
  // ---------------------------------------------------------------------------

  function init() {
    ui.container = $('scan');
    ui.input = $('package-input');
    ui.scanButton = $('scan-button');
    ui.cancelButton = $('cancel-button');
    ui.progress = $('scan-progress');
    ui.status = $('scan-status');
    ui.results = $('results');

    if (ui.status) {
      ui.status.setAttribute('aria-live', 'polite');
      ui.status.setAttribute('role', 'status');
    }
    if (ui.results) {
      ui.results.setAttribute('aria-live', 'polite');
      ui.results.setAttribute('aria-busy', 'false');
    }
    if (ui.progress) {
      ui.progress.setAttribute('role', 'progressbar');
      ui.progress.setAttribute('aria-label', 'Scan progress');
    }
    if (ui.cancelButton) {
      ui.cancelButton.disabled = true;
    }
    if (ui.container) {
      ui.container.setAttribute('data-scan-status', 'idle');
    }

    if (ui.scanButton) {
      ui.scanButton.addEventListener('click', function (event) {
        event.preventDefault();
        startScan();
      });
    }
    if (ui.cancelButton) {
      ui.cancelButton.addEventListener('click', function (event) {
        event.preventDefault();
        cancelScan();
      });
    }
    if (ui.input) {
      ui.input.addEventListener('keydown', function (event) {
        if (event.key === 'Enter') {
          event.preventDefault();
          startScan();
        }
      });
    }

    render();
  }

  window.ReportView = {
    setReport: setReport,
    loadReport: loadReport,
    render: render,
    getFailures: function () {
      return reportState.report ? getFailures(reportState.report) : [];
    }
  };

  if (typeof document !== 'undefined') {
    if (document.readyState === 'loading') {
      document.addEventListener('DOMContentLoaded', init);
    } else {
      init();
    }
  }

  // Expose a minimal API for tests.
  window.PackageScanner = {
    safeHttpsUrl: safeHttpsUrl,
    safeLink: safeLink,
    renderPackage: renderPackage,
    startScan: startScan,
    cancelScan: cancelScan,
    getApiBaseUrl: resolveApiBaseUrl,
    buildApiUrl: apiUrl,
    getState: function () { return state.status; }
  };
})();