'use strict';

(function () {
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

  // ---------------------------------------------------------------------------
  // Rendering
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

  // ---------------------------------------------------------------------------
  // Scan state management
  // ---------------------------------------------------------------------------

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
    var url = '/api/packages/' + encodeURIComponent(name);
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
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
  } else {
    init();
  }

  // Expose a minimal API for tests.
  window.PackageScanner = {
    safeHttpsUrl: safeHttpsUrl,
    safeLink: safeLink,
    renderPackage: renderPackage,
    startScan: startScan,
    cancelScan: cancelScan,
    getState: function () { return state.status; }
  };
})();