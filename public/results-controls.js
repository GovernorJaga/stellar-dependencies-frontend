(function (global) {
  'use strict';

  var SORT_OPTIONS = [
    { value: 'name', label: 'Name' },
    { value: 'license', label: 'License' },
    { value: 'version', label: 'Version' }
  ];

  var MAPPING_OPTIONS = [
    { value: 'any', label: 'Any' },
    { value: 'present', label: 'Mapping present' },
    { value: 'absent', label: 'Mapping absent' }
  ];

  var SELECTED_OPTIONS = [
    { value: 'any', label: 'Any' },
    { value: 'selected', label: 'Selected' },
    { value: 'unselected', label: 'Unselected' }
  ];

  function normalizeString(value) {
    if (value === null || value === undefined) {
      return '';
    }
    return String(value);
  }

  function compareStrings(a, b) {
    return normalizeString(a).localeCompare(normalizeString(b), undefined, {
      sensitivity: 'base',
      numeric: true
    });
  }

  function compareVersions(a, b) {
    var left = normalizeString(a).split(/[.\-+]/);
    var right = normalizeString(b).split(/[.\-+]/);
    var length = Math.max(left.length, right.length);
    for (var i = 0; i < length; i += 1) {
      var l = left[i];
      var r = right[i];
      if (l === undefined) {
        return -1;
      }
      if (r === undefined) {
        return 1;
      }
      var lNum = /^\d+$/.test(l) ? parseInt(l, 10) : null;
      var rNum = /^\d+$/.test(r) ? parseInt(r, 10) : null;
      if (lNum !== null && rNum !== null) {
        if (lNum !== rNum) {
          return lNum < rNum ? -1 : 1;
        }
      } else {
        var cmp = compareStrings(l, r);
        if (cmp !== 0) {
          return cmp;
        }
      }
    }
    return 0;
  }

  function getLicense(item) {
    if (!item) {
      return '';
    }
    if (item.license !== undefined && item.license !== null) {
      return item.license;
    }
    if (item.licenses && item.licenses.length) {
      var first = item.licenses[0];
      if (typeof first === 'string') {
        return first;
      }
      if (first && first.license) {
        return first.license;
      }
    }
    return '';
  }

  function hasRepositoryMapping(item) {
    if (!item) {
      return false;
    }
    if (typeof item.repositoryMapping === 'boolean') {
      return item.repositoryMapping;
    }
    if (item.repositoryMapping !== undefined && item.repositoryMapping !== null) {
      return true;
    }
    if (item.repository !== undefined && item.repository !== null && item.repository !== '') {
      return true;
    }
    if (item.mapping !== undefined && item.mapping !== null) {
      return true;
    }
    return false;
  }

  function isSelected(item) {
    if (!item) {
      return false;
    }
    return Boolean(item.selected);
  }

  function getComparators() {
    return {
      name: function (a, b) {
        return compareStrings(a && a.name, b && b.name);
      },
      license: function (a, b) {
        return compareStrings(getLicense(a), getLicense(b));
      },
      version: function (a, b) {
        return compareVersions(a && a.version, b && b.version);
      }
    };
  }

  function sortItems(items, sortBy, sortDirection) {
    if (!Array.isArray(items) || items.length === 0) {
      return [];
    }
    var comparators = getComparators();
    var comparator = comparators[sortBy] || comparators.name;
    var direction = sortDirection === 'desc' ? -1 : 1;
    var copy = items.slice();
    copy.sort(function (a, b) {
      var result = comparator(a, b);
      if (result === 0) {
        result = compareStrings(a && a.name, b && b.name);
      }
      return result * direction;
    });
    return copy;
  }

  function filterItems(items, filters) {
    if (!Array.isArray(items) || items.length === 0) {
      return [];
    }
    var active = filters || {};
    var licenseFilter = active.license;
    var mappingFilter = active.mapping || 'any';
    var selectedFilter = active.selected || 'any';

    var hasLicenseFilter = licenseFilter !== undefined && licenseFilter !== null && licenseFilter !== '' && licenseFilter !== 'any';

    return items.filter(function (item) {
      if (hasLicenseFilter) {
        if (compareStrings(getLicense(item), licenseFilter) !== 0) {
          return false;
        }
      }
      if (mappingFilter === 'present' && !hasRepositoryMapping(item)) {
        return false;
      }
      if (mappingFilter === 'absent' && hasRepositoryMapping(item)) {
        return false;
      }
      if (selectedFilter === 'selected' && !isSelected(item)) {
        return false;
      }
      if (selectedFilter === 'unselected' && isSelected(item)) {
        return false;
      }
      return true;
    });
  }

  function collectLicenses(items) {
    if (!Array.isArray(items)) {
      return [];
    }
    var seen = Object.create(null);
    var result = [];
    for (var i = 0; i < items.length; i += 1) {
      var license = getLicense(items[i]);
      if (license && !seen[license]) {
        seen[license] = true;
        result.push(license);
      }
    }
    result.sort(compareStrings);
    return result;
  }

  function createMemoizedDerivation() {
    var lastItems = null;
    var lastSortBy = null;
    var lastSortDirection = null;
    var lastFilters = null;
    var lastResult = null;

    return function derive(items, sortBy, sortDirection, filters) {
      var filtersKey = filters
        ? [filters.license || '', filters.mapping || 'any', filters.selected || 'any'].join('|')
        : '';
      if (
        lastResult !== null &&
        lastItems === items &&
        lastSortBy === sortBy &&
        lastSortDirection === sortDirection &&
        lastFilters === filtersKey
      ) {
        return lastResult;
      }
      var filtered = filterItems(items, filters);
      var sorted = sortItems(filtered, sortBy, sortDirection);
      lastItems = items;
      lastSortBy = sortBy;
      lastSortDirection = sortDirection;
      lastFilters = filtersKey;
      lastResult = sorted;
      return sorted;
    };
  }

  function getApiBaseUrl() {
    if (global && global.AppConfig && typeof global.AppConfig.getApiBaseUrl === 'function') {
      return global.AppConfig.getApiBaseUrl();
    }
    if (global && global.AppConfig && typeof global.AppConfig.apiBaseUrl === 'string') {
      return global.AppConfig.apiBaseUrl;
    }
    return '';
  }

  function buildApiUrl(path) {
    var base = getApiBaseUrl();
    var normalizedPath = normalizeString(path);
    if (!base) {
      return normalizedPath;
    }
    if (/^https?:\/\//i.test(normalizedPath)) {
      return normalizedPath;
    }
    var trimmedBase = base.replace(/\/+$/, '');
    var trimmedPath = normalizedPath.replace(/^\/+/, '');
    return trimmedBase + '/' + trimmedPath;
  }

  function createElement(tag, attributes, children) {
    var el = document.createElement(tag);
    if (attributes) {
      Object.keys(attributes).forEach(function (key) {
        if (key === 'text') {
          el.textContent = attributes[key];
        } else if (key === 'className') {
          el.className = attributes[key];
        } else if (key.indexOf('on') === 0 && typeof attributes[key] === 'function') {
          el.addEventListener(key.slice(2).toLowerCase(), attributes[key]);
        } else {
          el.setAttribute(key, attributes[key]);
        }
      });
    }
    if (children) {
      children.forEach(function (child) {
        if (child) {
          el.appendChild(child);
        }
      });
    }
    return el;
  }

  function createSelect(id, labelText, options, value, onChange) {
    var select = createElement('select', {
      id: id,
      className: 'results-controls__select'
    });
    options.forEach(function (option) {
      var opt = createElement('option', { value: option.value, text: option.label });
      if (option.value === value) {
        opt.selected = true;
      }
      select.appendChild(opt);
    });
    select.addEventListener('change', function () {
      onChange(select.value);
    });
    var label = createElement('label', {
      className: 'results-controls__label',
      for: id,
      text: labelText
    });
    return createElement('div', { className: 'results-controls__field' }, [label, select]);
  }

  function ResultsControls(options) {
    if (!(this instanceof ResultsControls)) {
      return new ResultsControls(options);
    }
    var opts = options || {};
    this.container = opts.container || null;
    this.getItems = typeof opts.getItems === 'function' ? opts.getItems : function () { return []; };
    this.onChange = typeof opts.onChange === 'function' ? opts.onChange : function () {};
    this.sortBy = opts.sortBy || 'name';
    this.sortDirection = opts.sortDirection || 'asc';
    this.filters = {
      license: opts.license || 'any',
      mapping: opts.mapping || 'any',
      selected: opts.selected || 'any'
    };
    this._derive = createMemoizedDerivation();
    this._licenseOptions = [];
    this._elements = null;
    this._render();
  }

  ResultsControls.prototype._render = function () {
    if (!this.container) {
      return;
    }
    var self = this;
    this.container.innerHTML = '';
    this.container.classList.add('results-controls');

    var sortField = createSelect(
      'results-sort-by',
      'Sort by',
      SORT_OPTIONS,
      this.sortBy,
      function (value) {
        self.sortBy = value;
        self._emit();
      }
    );

    var directionSelect = createSelect(
      'results-sort-direction',
      'Direction',
      [
        { value: 'asc', label: 'Ascending' },
        { value: 'desc', label: 'Descending' }
      ],
      this.sortDirection,
      function (value) {
        self.sortDirection = value;
        self._emit();
      }
    );

    var licenseSelect = createSelect(
      'results-filter-license',
      'License',
      [{ value: 'any', label: 'Any' }].concat(
        this._licenseOptions.map(function (license) {
          return { value: license, label: license };
        })
      ),
      this.filters.license,
      function (value) {
        self.filters.license = value;
        self._emit();
      }
    );

    var mappingSelect = createSelect(
      'results-filter-mapping',
      'Repository mapping',
      MAPPING_OPTIONS,
      this.filters.mapping,
      function (value) {
        self.filters.mapping = value;
        self._emit();
      }
    );

    var selectedSelect = createSelect(
      'results-filter-selected',
      'Selected state',
      SELECTED_OPTIONS,
      this.filters.selected,
      function (value) {
        self.filters.selected = value;
        self._emit();
      }
    );

    var resetButton = createElement('button', {
      type: 'button',
      className: 'results-controls__reset',
      text: 'Reset',
      onClick: function () {
        self.reset();
      }
    });

    var wrapper = createElement('div', { className: 'results-controls__fields' }, [
      sortField,
      directionSelect,
      licenseSelect,
      mappingSelect,
      selectedSelect,
      resetButton
    ]);

    this.container.appendChild(wrapper);
    this._elements = {
      sortBy: sortField.querySelector('select'),
      sortDirection: directionSelect.querySelector('select'),
      license: licenseSelect.querySelector('select'),
      mapping: mappingSelect.querySelector('select'),
      selected: selectedSelect.querySelector('select')
    };
  };

  ResultsControls.prototype.refreshLicenseOptions = function () {
    var items = this.getItems();
    var licenses = collectLicenses(items);
    var changed = licenses.length !== this._licenseOptions.length ||
      licenses.some(function (license, index) {
        return license !== this._licenseOptions[index];
      });
    if (changed) {
      this._licenseOptions = licenses;
      if (this.filters.license !== 'any' && licenses.indexOf(this.filters.license) === -1) {
        this.filters.license = 'any';
      }
      this._render();
    }
  };

  ResultsControls.prototype._emit = function () {
    var items = this.getItems();
    var result = this._derive(items, this.sortBy, this.sortDirection, this.filters);
    this.onChange(result, {
      sortBy: this.sortBy,
      sortDirection: this.sortDirection,
      filters: {
        license: this.filters.license,
        mapping: this.filters.mapping,
        selected: this.filters.selected
      }
    });
    return result;
  };

  ResultsControls.prototype.apply = function () {
    this.refreshLicenseOptions();
    return this._emit();
  };

  ResultsControls.prototype.reset = function () {
    this.sortBy = 'name';
    this.sortDirection = 'asc';
    this.filters = { license: 'any', mapping: 'any', selected: 'any' };
    this._render();
    return this._emit();
  };

  ResultsControls.prototype.setSort = function (sortBy, sortDirection) {
    if (sortBy) {
      this.sortBy = sortBy;
    }
    if (sortDirection) {
      this.sortDirection = sortDirection;
    }
    if (this._elements) {
      if (this._elements.sortBy) {
        this._elements.sortBy.value = this.sortBy;
      }
      if (this._elements.sortDirection) {
        this._elements.sortDirection.value = this.sortDirection;
      }
    }
    return this._emit();
  };

  ResultsControls.prototype.setFilters = function (filters) {
    if (filters) {
      if (filters.license !== undefined) {
        this.filters.license = filters.license;
      }
      if (filters.mapping !== undefined) {
        this.filters.mapping = filters.mapping;
      }
      if (filters.selected !== undefined) {
        this.filters.selected = filters.selected;
      }
    }
    if (this._elements) {
      if (this._elements.license) {
        this._elements.license.value = this.filters.license;
      }
      if (this._elements.mapping) {
        this._elements.mapping.value = this.filters.mapping;
      }
      if (this._elements.selected) {
        this._elements.selected.value = this.filters.selected;
      }
    }
    return this._emit();
  };

  var api = {
    ResultsControls: ResultsControls,
    sortItems: sortItems,
    filterItems: filterItems,
    collectLicenses: collectLicenses,
    createMemoizedDerivation: createMemoizedDerivation,
    compareVersions: compareVersions,
    getApiBaseUrl: getApiBaseUrl,
    buildApiUrl: buildApiUrl,
    SORT_OPTIONS: SORT_OPTIONS,
    MAPPING_OPTIONS: MAPPING_OPTIONS,
    SELECTED_OPTIONS: SELECTED_OPTIONS
  };

  if (typeof module !== 'undefined' && module.exports) {
    module.exports = api;
  }
  global.ResultsControls = api;
})(typeof window !== 'undefined' ? window : this);