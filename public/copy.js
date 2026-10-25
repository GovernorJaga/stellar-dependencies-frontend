// public/copy.js
// Shared UI copy constants.
// IMPORTANT: Repository mappings describe *publisher-reported* metadata.
// A repository URL is a lead to review, not proof of ownership.
// Do not use terms like "verified" or "owned" in mapping copy.

(function (global) {
  'use strict';

  var repositoryMapping = {
    // Short label for inline display next to a mapping.
    label: 'Repository (publisher-reported)',

    // Longer heading for sections that list mappings.
    heading: 'Repository mappings (publisher-reported)',

    // Tooltip / help text explaining the nature of the data.
    tooltip:
      'A repository URL is a lead to review, not proof of ownership. ' +
      'This mapping reflects what the publisher reported and has not been verified.',

    // Short tooltip for tight spaces (e.g., icon-only help).
    shortTooltip: 'Publisher-reported lead to review; not proof of ownership.',

    // Empty-state copy when no mappings exist.
    empty: 'No publisher-reported repository mappings.',

    // Column header for tables listing mappings.
    columnHeader: 'Repository (publisher-reported)',

    // Badge text used to mark the data source.
    badge: 'Publisher-reported',

    // Description shown in detail views.
    description:
      'Repository mappings are publisher-reported metadata. ' +
      'Treat each repository URL as a lead to review rather than proof of ownership.'
  };

  // Resolve the API base URL from the shared config (see public/config.js).
  // No hardcoded hosts: the backend location is configurable without code changes.
  function getApiBaseUrl() {
    var cfg = global.AppConfig;
    if (cfg && typeof cfg.apiBaseUrl === 'string' && cfg.apiBaseUrl) {
      return cfg.apiBaseUrl;
    }
    if (typeof console !== 'undefined' && console.warn) {
      console.warn(
        'AppConfig.apiBaseUrl is not set; falling back to same-origin API calls.'
      );
    }
    return '';
  }

  function apiUrl(path) {
    var base = getApiBaseUrl();
    var suffix = String(path || '');
    if (suffix && suffix.charAt(0) !== '/') {
      suffix = '/' + suffix;
    }
    return base + suffix;
  }

  var copy = {
    repositoryMapping: repositoryMapping,
    getApiBaseUrl: getApiBaseUrl,
    apiUrl: apiUrl
  };

  // ---------------------------------------------------------------------------
  // Lint-style guard: prevent regressions that imply verified ownership.
  // ---------------------------------------------------------------------------

  // Terms that must never appear in repository-mapping copy.
  var FORBIDDEN_TERMS = ['verified', 'owned', 'ownership proof', 'confirmed owner'];

  // Phrases that are allowed even though they contain a forbidden substring
  // (e.g., "not proof of ownership" is a correct disclaimer).
  var ALLOWED_PHRASES = [
    'not proof of ownership',
    'not verified',
    'has not been verified',
    'rather than proof of ownership'
  ];

  function stripAllowedPhrases(text) {
    var result = String(text).toLowerCase();
    for (var i = 0; i < ALLOWED_PHRASES.length; i++) {
      var phrase = ALLOWED_PHRASES[i];
      while (result.indexOf(phrase) !== -1) {
        result = result.replace(phrase, ' ');
      }
    }
    return result;
  }

  function findForbiddenTerm(text) {
    var scrubbed = stripAllowedPhrases(text);
    for (var i = 0; i < FORBIDDEN_TERMS.length; i++) {
      var term = FORBIDDEN_TERMS[i];
      if (scrubbed.indexOf(term) !== -1) {
        return term;
      }
    }
    return null;
  }

  function assertRepositoryMappingCopySafe() {
    var problems = [];
    var keys = Object.keys(repositoryMapping);

    for (var i = 0; i < keys.length; i++) {
      var key = keys[i];
      var value = repositoryMapping[key];
      if (typeof value !== 'string') {
        continue;
      }
      var term = findForbiddenTerm(value);
      if (term) {
        problems.push(
          'repositoryMapping.' + key +
          ' contains forbidden term "' + term + '": ' + JSON.stringify(value)
        );
      }
    }

    // Every mapping label/heading should make the publisher-reported nature clear.
    var descriptiveKeys = ['label', 'heading', 'columnHeader', 'badge'];
    for (var j = 0; j < descriptiveKeys.length; j++) {
      var dk = descriptiveKeys[j];
      var dv = repositoryMapping[dk];
      if (typeof dv === 'string' && dv.toLowerCase().indexOf('publisher-reported') === -1) {
        problems.push(
          'repositoryMapping.' + dk +
          ' must describe the mapping as "publisher-reported": ' + JSON.stringify(dv)
        );
      }
    }

    if (problems.length > 0) {
      var message =
        'Repository mapping copy check failed:\n  - ' + problems.join('\n  - ');
      if (typeof console !== 'undefined' && console.error) {
        console.error(message);
      }
      throw new Error(message);
    }

    return true;
  }

  // Expose the guard so it can be invoked from tests or a lint step.
  copy.assertRepositoryMappingCopySafe = assertRepositoryMappingCopySafe;
  copy.findForbiddenTerm = findForbiddenTerm;

  // Run the guard at load time to catch regressions early.
  assertRepositoryMappingCopySafe();

  if (typeof module !== 'undefined' && module.exports) {
    module.exports = copy;
  } else {
    global.AppCopy = copy;
  }
})(typeof globalThis !== 'undefined' ? globalThis : this);