(function () {
  'use strict';

  var state = {
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
    checkbox.checked = state.showOnlyFailures;
    checkbox.addEventListener('change', function () {
      state.showOnlyFailures = checkbox.checked;
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

    if (!state.report) {
      root.appendChild(createEl('p', 'report-empty', 'No report loaded.'));
      return;
    }

    renderToggle(root);

    var failures = getFailures(state.report);
    renderFailures(root, failures);
    renderPackages(root, state.report.packages, state.showOnlyFailures);
  }

  function setReport(raw) {
    state.report = normalizeReport(raw);
    render();
  }

  function loadReport(url) {
    return fetch(url)
      .then(function (response) {
        if (!response.ok) {
          throw new Error('Failed to load report: ' + response.status);
        }
        return response.json();
      })
      .then(function (data) {
        setReport(data);
        return state.report;
      });
  }

  window.ReportView = {
    setReport: setReport,
    loadReport: loadReport,
    render: render,
    getFailures: function () {
      return state.report ? getFailures(state.report) : [];
    }
  };

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', render);
  } else {
    render();
  }
})();