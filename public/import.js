(function () {
  'use strict';

  var MAX_FILE_SIZE = 5 * 1024 * 1024; // 5 MB

  function getApiBaseUrl() {
    if (typeof window !== 'undefined' && window.APP_CONFIG && window.APP_CONFIG.apiBaseUrl) {
      return String(window.APP_CONFIG.apiBaseUrl).replace(/\/+$/, '');
    }
    return '';
  }

  function buildApiUrl(path) {
    var base = getApiBaseUrl();
    var normalizedPath = path.charAt(0) === '/' ? path : '/' + path;
    return base + normalizedPath;
  }

  function isPlainObject(value) {
    return value !== null && typeof value === 'object' && !Array.isArray(value);
  }

  function isNonEmptyString(value) {
    return typeof value === 'string' && value.length > 0;
  }

  function validateReport(data) {
    var errors = [];

    if (!isPlainObject(data)) {
      return ['The file does not contain a valid report object.'];
    }

    if (!isNonEmptyString(data.title)) {
      errors.push('Missing or invalid "title" field.');
    }

    if (data.generatedAt !== undefined && typeof data.generatedAt !== 'string') {
      errors.push('Invalid "generatedAt" field.');
    }

    if (data.summary !== undefined && !isPlainObject(data.summary)) {
      errors.push('Invalid "summary" field.');
    }

    if (data.sections !== undefined) {
      if (!Array.isArray(data.sections)) {
        errors.push('Invalid "sections" field: expected an array.');
      } else {
        for (var i = 0; i < data.sections.length; i++) {
          var section = data.sections[i];
          if (!isPlainObject(section)) {
            errors.push('Section at index ' + i + ' is not an object.');
            continue;
          }
          if (!isNonEmptyString(section.title)) {
            errors.push('Section at index ' + i + ' is missing a valid "title".');
          }
          if (section.content !== undefined && typeof section.content !== 'string') {
            errors.push('Section at index ' + i + ' has an invalid "content" field.');
          }
        }
      }
    }

    if (data.items !== undefined && !Array.isArray(data.items)) {
      errors.push('Invalid "items" field: expected an array.');
    }

    return errors;
  }

  function showError(container, message) {
    if (!container) {
      return;
    }
    container.textContent = message;
    container.hidden = false;
    container.setAttribute('role', 'alert');
  }

  function clearError(container) {
    if (!container) {
      return;
    }
    container.textContent = '';
    container.hidden = true;
  }

  function handleFile(file, options) {
    var errorContainer = options.errorContainer;
    var onLoad = options.onLoad;

    clearError(errorContainer);

    if (!file) {
      return;
    }

    if (file.size > MAX_FILE_SIZE) {
      showError(
        errorContainer,
        'File is too large (' +
          Math.round(file.size / 1024) +
          ' KB). Maximum allowed size is ' +
          Math.round(MAX_FILE_SIZE / 1024) +
          ' KB.'
      );
      return;
    }

    var reader = new FileReader();

    reader.onerror = function () {
      showError(errorContainer, 'Could not read the selected file. Please try again.');
    };

    reader.onload = function () {
      var text = reader.result;
      var data;

      if (typeof text !== 'string') {
        showError(errorContainer, 'The selected file could not be read as text.');
        return;
      }

      try {
        data = JSON.parse(text);
      } catch (err) {
        showError(errorContainer, 'The selected file is not valid JSON.');
        return;
      }

      var errors = validateReport(data);
      if (errors.length > 0) {
        showError(
          errorContainer,
          'The selected file is not a valid report export:\n' + errors.join('\n')
        );
        return;
      }

      try {
        onLoad(data);
      } catch (err) {
        showError(errorContainer, 'The report could not be loaded: ' + err.message);
      }
    };

    reader.readAsText(file);
  }

  function createImportControl(options) {
    options = options || {};
    var errorContainer = options.errorContainer || null;
    var onLoad = options.onLoad;

    if (typeof onLoad !== 'function') {
      throw new Error('createImportControl requires an onLoad callback.');
    }

    var button = document.createElement('button');
    button.type = 'button';
    button.className = 'import-button';
    button.textContent = options.buttonLabel || 'Import Report';

    var input = document.createElement('input');
    input.type = 'file';
    input.accept = '.json,application/json';
    input.hidden = true;
    input.setAttribute('aria-hidden', 'true');

    button.addEventListener('click', function () {
      input.value = '';
      input.click();
    });

    input.addEventListener('change', function () {
      var file = input.files && input.files[0];
      handleFile(file, {
        errorContainer: errorContainer,
        onLoad: onLoad
      });
    });

    var wrapper = document.createElement('span');
    wrapper.className = 'import-control';
    wrapper.appendChild(button);
    wrapper.appendChild(input);

    return {
      element: wrapper,
      button: button,
      input: input
    };
  }

  var api = {
    MAX_FILE_SIZE: MAX_FILE_SIZE,
    getApiBaseUrl: getApiBaseUrl,
    buildApiUrl: buildApiUrl,
    validateReport: validateReport,
    handleFile: handleFile,
    createImportControl: createImportControl
  };

  if (typeof module !== 'undefined' && module.exports) {
    module.exports = api;
  } else {
    window.ReportImport = api;
  }
})();