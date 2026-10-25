'use strict';

/**
 * Pure shortlist helpers.
 *
 * These functions intentionally contain no DOM or network access so they can
 * be imported directly by Node's test runner as well as used in the browser.
 *
 * The API base URL is configured in `config.js` (see `window.APP_CONFIG` /
 * `apiBaseUrl`); this module never hardcodes a host. Any network access is
 * performed by callers using that configurable base URL.
 */

/**
 * Build a stable deduplication key for a shortlist item.
 *
 * Items are expected to have `name` and `version` properties. Missing values
 * are normalised to empty strings so the key is always a string.
 *
 * @param {{ name?: string, version?: string }} item
 * @returns {string}
 */
function shortlistKey(item) {
  const name = item && item.name != null ? String(item.name) : '';
  const version = item && item.version != null ? String(item.version) : '';
  return `${name}@${version}`;
}

/**
 * Remove duplicate packages from a shortlist while preserving order.
 *
 * The first occurrence of each (name, version) pair is kept; later duplicates
 * are dropped. The input array is not mutated.
 *
 * @param {Array<{ name?: string, version?: string }>} items
 * @returns {Array<{ name?: string, version?: string }>}
 */
function deduplicateShortlist(items) {
  if (!Array.isArray(items)) {
    return [];
  }

  const seen = new Set();
  const result = [];

  for (const item of items) {
    const key = shortlistKey(item);
    if (seen.has(key)) {
      continue;
    }
    seen.add(key);
    result.push(item);
  }

  return result;
}

/**
 * Produce the export output for a shortlist.
 *
 * The items are deduplicated, then sorted by name and version (ascending) so
 * the output is deterministic. The result is a JSON string containing an
 * array of `{ name, version }` objects.
 *
 * @param {Array<{ name?: string, version?: string }>} items
 * @returns {string}
 */
function exportShortlist(items) {
  const deduped = deduplicateShortlist(items);

  const sorted = deduped
    .map((item) => ({
      name: item && item.name != null ? String(item.name) : '',
      version: item && item.version != null ? String(item.version) : '',
    }))
    .sort((a, b) => {
      if (a.name < b.name) return -1;
      if (a.name > b.name) return 1;
      if (a.version < b.version) return -1;
      if (a.version > b.version) return 1;
      return 0;
    });

  return JSON.stringify(sorted, null, 2);
}

module.exports = {
  shortlistKey,
  deduplicateShortlist,
  exportShortlist,
};