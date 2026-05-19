(function attachSidepanelFormDialog(globalScope) {
  const FORM_EYE_OPEN_ICON = '<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M1 12s4-7 11-7 11 7 11 7-4 7-11 7S1 12 1 12z"/><circle cx="12" cy="12" r="3"/></svg>';
  const FORM_EYE_CLOSED_ICON = '<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M17.94 17.94A10.94 10.94 0 0 1 12 19C5 19 1 12 1 12a21.77 21.77 0 0 1 5.06-6.94"/><path d="M9.9 4.24A10.94 10.94 0 0 1 12 5c7 0 11 7 11 7a21.86 21.86 0 0 1-2.16 3.19"/><path d="M1 1l22 22"/><path d="M14.12 14.12a3 3 0 1 1-4.24-4.24"/></svg>';

  function syncPasswordToggleButton(button, input, labels) {
    if (!button || !input) return;
    const isHidden = input.type === 'password';
    button.innerHTML = isHidden ? FORM_EYE_OPEN_ICON : FORM_EYE_CLOSED_ICON;
    button.setAttribute('aria-label', isHidden ? labels.show : labels.hide);
    button.title = isHidden ? labels.show : labels.hide;
  }

  function createFormDialog(context = {}) {
    const {
      overlay = null,
      titleNode = null,
      closeButton = null,
      messageNode = null,
      alertNode = null,
      fieldsContainer = null,
      cancelButton = null,
      confirmButton = null,
      documentRef = globalScope.document,
    } = context;

    let resolver = null;
    let currentConfig = null;
    let currentInputs = [];

    function setHidden(node, hidden) {
      if (!node) return;
      node.hidden = Boolean(hidden);
    }

    function resetAlert() {
      if (!alertNode) return;
      alertNode.textContent = '';
      alertNode.className = 'modal-alert modal-form-alert';
      alertNode.hidden = true;
    }

    function setAlert(message = '', tone = 'danger') {
      if (!alertNode) return;
      const text = String(message || '').trim();
      if (!text) {
        resetAlert();
        return;
      }
      alertNode.textContent = text;
      alertNode.className = `modal-alert modal-form-alert${tone === 'danger' ? ' is-danger' : ''}`;
      alertNode.hidden = false;
    }

    function close(result = null) {
      if (resolver) {
        resolver(result);
        resolver = null;
      }
      currentConfig = null;
      currentInputs = [];
      resetAlert();
      if (fieldsContainer) {
        fieldsContainer.innerHTML = '';
      }
      if (overlay) {
        overlay.hidden = true;
      }
    }

    function buildFieldNode(field, values) {
      const wrapper = documentRef.createElement('div');
      wrapper.className = 'modal-form-row';

      const label = documentRef.createElement('label');
      label.className = 'modal-form-label';
      const labelText = String(field.label || field.key || '').trim();
      label.textContent = labelText;
      wrapper.appendChild(label);

      let input = null;
      if (field.type === 'textarea') {
        input = documentRef.createElement('textarea');
        input.className = 'data-textarea';
      } else if (field.type === 'select') {
        input = documentRef.createElement('select');
        input.className = 'data-select';
        const options = Array.isArray(field.options) ? field.options : [];
        options.forEach((option) => {
          const optionNode = documentRef.createElement('option');
          optionNode.value = String(option?.value || '');
          optionNode.textContent = String(option?.label || option?.value || '');
          input.appendChild(optionNode);
        });
      } else {
        const shouldMaskInput = field.type === 'password' || field.masked === true;
        input = documentRef.createElement('input');
        input.type = shouldMaskInput ? 'password' : 'text';
        input.className = shouldMaskInput
          ? 'data-input data-input-with-icon'
          : 'data-input';
      }

      const normalizedValue = Object.prototype.hasOwnProperty.call(values, field.key)
        ? values[field.key]
        : field.value;
      if (normalizedValue !== undefined && normalizedValue !== null) {
        input.value = String(normalizedValue);
      }
      if (field.placeholder) {
        input.placeholder = String(field.placeholder);
      }
      if (field.autocomplete) {
        input.autocomplete = String(field.autocomplete);
      }
      if (field.inputMode) {
        input.inputMode = String(field.inputMode);
      }
      if (field.rows && field.type === 'textarea') {
        input.rows = Number(field.rows) || 3;
      }
      input.dataset.fieldKey = String(field.key || '');
      label.htmlFor = field.key;
      input.id = field.key;
      if (field.type === 'password' || field.masked === true) {
        const inputShell = documentRef.createElement('div');
        inputShell.className = 'input-with-icon';
        inputShell.appendChild(input);

        const toggleButton = documentRef.createElement('button');
        toggleButton.className = 'input-icon-btn';
        toggleButton.type = 'button';
        const labels = {
          show: String(field.showPasswordLabel || `\u663e\u793a${labelText || '\u5bc6\u7801'}`),
          hide: String(field.hidePasswordLabel || `\u9690\u85cf${labelText || '\u5bc6\u7801'}`),
        };
        syncPasswordToggleButton(toggleButton, input, labels);
        toggleButton.addEventListener('click', () => {
          input.type = input.type === 'password' ? 'text' : 'password';
          syncPasswordToggleButton(toggleButton, input, labels);
        });

        inputShell.appendChild(toggleButton);
        wrapper.appendChild(inputShell);
      } else {
        wrapper.appendChild(input);
      }

      if (field.type !== 'textarea') {
        input.addEventListener('keydown', (event) => {
          if (event.key !== 'Enter') {
            return;
          }
          event.preventDefault();
          void handleConfirm();
        });
      }

      currentInputs.push({ field, input });
      return wrapper;
    }

    function collectValues() {
      return currentInputs.reduce((result, item) => {
        result[item.field.key] = item.input.value;
        return result;
      }, {});
    }

    async function handleConfirm() {
      if (!currentConfig) {
        close(null);
        return;
      }

      const values = collectValues();
      resetAlert();

      for (const item of currentInputs) {
        const { field, input } = item;
        const rawValue = values[field.key];
        const textValue = String(rawValue || '').trim();
        if (field.required && !textValue) {
          setAlert(field.requiredMessage || `${field.label || field.key}不能为空。`);
          input.focus?.();
          return;
        }
        if (typeof field.validate === 'function') {
          const validationMessage = await field.validate(rawValue, values);
          if (validationMessage) {
            setAlert(validationMessage);
            input.focus?.();
            return;
          }
        }
      }

      close(values);
    }

    function bindEvents() {
      overlay?.addEventListener('click', (event) => {
        if (event.target === overlay) {
          close(null);
        }
      });
      closeButton?.addEventListener('click', () => close(null));
      cancelButton?.addEventListener('click', () => close(null));
      confirmButton?.addEventListener('click', () => {
        void handleConfirm();
      });
    }

    async function open(config = {}) {
      if (!overlay || !titleNode || !fieldsContainer || !confirmButton) {
        return null;
      }
      if (resolver) {
        close(null);
      }

      currentConfig = config || {};
      currentInputs = [];
      titleNode.textContent = String(currentConfig.title || '填写表单');
      if (messageNode) {
        const message = String(currentConfig.message || '').trim();
        messageNode.textContent = message;
        setHidden(messageNode, !message);
      }
      resetAlert();
      if (currentConfig.alert?.text) {
        setAlert(currentConfig.alert.text, currentConfig.alert.tone || 'danger');
      }

      confirmButton.textContent = String(currentConfig.confirmLabel || '确认');
      confirmButton.className = `btn ${currentConfig.confirmVariant || 'btn-primary'} btn-sm`;
      fieldsContainer.innerHTML = '';

      const initialValues = currentConfig.initialValues && typeof currentConfig.initialValues === 'object'
        ? currentConfig.initialValues
        : {};
      const fields = Array.isArray(currentConfig.fields) ? currentConfig.fields : [];
      fields.forEach((field) => {
        fieldsContainer.appendChild(buildFieldNode(field, initialValues));
      });

      overlay.hidden = false;
      const firstInput = currentInputs[0]?.input || null;
      if (firstInput && typeof globalScope.requestAnimationFrame === 'function') {
        globalScope.requestAnimationFrame(() => firstInput.focus?.());
      } else {
        firstInput?.focus?.();
      }

      return new Promise((resolve) => {
        resolver = resolve;
      });
    }

    bindEvents();

    return {
      close,
      open,
    };
  }

  globalScope.SidepanelFormDialog = {
    createFormDialog,
  };
})(window);
