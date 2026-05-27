(function attachSidepanelEditableListPicker(globalScope) {
  const editableListPickers = [];

  function splitEditableListValues(value = '') {
    return String(value || '')
      .split(/[\r\n,，、]+/)
      .map((name) => name.trim())
      .filter(Boolean);
  }

  function normalizeEditableListValues(...sources) {
    const values = [];
    const seen = new Set();

    const append = (value) => {
      if (Array.isArray(value)) {
        value.forEach(append);
        return;
      }
      for (const item of splitEditableListValues(value)) {
        const key = item.toLowerCase();
        if (!key || seen.has(key)) {
          continue;
        }
        seen.add(key);
        values.push(item);
      }
    };

    sources.forEach(append);
    return values;
  }

  function createEditableListPicker(config = {}) {
    const {
      root,
      input,
      trigger,
      current,
      menu,
      emptyLabel = 'Please add first',
      fallbackItems = [],
      minItems = 0,
      deleteLabel = 'Delete',
      itemLabel = 'Item',
      normalizeItems = normalizeEditableListValues,
      normalizeValue = (value) => String(value || '').trim(),
      getItemValue = (item) => String(item || '').trim(),
      getItemLabel = (item) => getItemValue(item),
      getItemDeleteLabel = (item) => getItemLabel(item),
      onDelete = null,
      onDeleteError = null,
    } = config;

    const picker = {
      root,
      input,
      trigger,
      current,
      menu,
      items: [],
      open: false,
    };

    const getFallbackItems = () => normalizeItems(fallbackItems);
    const getNormalizedItemValue = (item) => normalizeValue(getItemValue(item));
    const findItemByValue = (value) => {
      const normalized = normalizeValue(value);
      return picker.items.find((item) => getNormalizedItemValue(item) === normalized) || null;
    };
    const reportDeleteError = (error) => {
      const fallbackMessage = `Failed to ${deleteLabel.toLowerCase()} ${itemLabel.toLowerCase()}.`;
      if (typeof onDeleteError === 'function') {
        onDeleteError(error, fallbackMessage);
        return;
      }
      if (typeof globalScope.showToast === 'function') {
        globalScope.showToast(error?.message || fallbackMessage, 'error');
      }
    };

    picker.setOpen = (open) => {
      picker.open = Boolean(open) && !trigger?.disabled;
      if (menu) {
        menu.hidden = !picker.open;
      }
      if (trigger) {
        trigger.setAttribute('aria-expanded', picker.open ? 'true' : 'false');
        trigger.classList?.toggle('is-open', picker.open);
      }
    };

    picker.close = () => {
      picker.setOpen(false);
    };

    picker.setVisible = (visible) => {
      if (root) {
        root.style.display = visible ? '' : 'none';
      }
      if (!visible) {
        picker.close();
      }
    };

    picker.setSelection = (value, options = {}) => {
      const fallback = getNormalizedItemValue(picker.items[0]) || getNormalizedItemValue(getFallbackItems()[0]) || '';
      const selected = normalizeValue(value) || fallback;
      const selectedItem = findItemByValue(selected);
      if (input) {
        input.value = selected;
        if (options.emit && typeof input.dispatchEvent === 'function') {
          input.dispatchEvent(new Event('change', { bubbles: true }));
        }
      }
      if (current) {
        current.textContent = selectedItem ? getItemLabel(selectedItem) : (selected || emptyLabel);
      }
    };

    picker.render = (items = [], selectedValue = '') => {
      const normalizedItems = normalizeItems(items);
      picker.items = normalizedItems.length ? normalizedItems : getFallbackItems();
      const inputValue = normalizeValue(input?.value);
      const selected = normalizeValue(selectedValue)
        || (findItemByValue(inputValue) ? inputValue : '')
        || getNormalizedItemValue(picker.items[0])
        || '';

      if (trigger) {
        trigger.disabled = picker.items.length === 0;
      }
      if (picker.items.length === 0) {
        if (menu) {
          menu.innerHTML = '';
        }
        picker.setSelection('', { emit: false });
        picker.close();
        return;
      }

      if (
        !menu
        || typeof menu.appendChild !== 'function'
        || typeof globalScope.document === 'undefined'
        || typeof globalScope.document.createElement !== 'function'
      ) {
        picker.setSelection(selected, { emit: false });
        return;
      }

      menu.innerHTML = '';
      picker.items.forEach((item) => {
        const itemValue = getNormalizedItemValue(item);
        const row = globalScope.document.createElement('div');
        row.className = 'editable-list-option-row';

        const option = globalScope.document.createElement('button');
        option.type = 'button';
        option.className = 'editable-list-option';
        option.setAttribute('role', 'option');
        option.setAttribute('aria-selected', itemValue === selected ? 'true' : 'false');
        option.textContent = getItemLabel(item);
        option.addEventListener('click', () => {
          picker.setSelection(itemValue, { emit: true });
          picker.close();
        });

        const deleteButton = globalScope.document.createElement('button');
        deleteButton.type = 'button';
        deleteButton.className = 'editable-list-delete';
        deleteButton.textContent = deleteLabel;
        deleteButton.title = `${deleteLabel} ${itemLabel} ${getItemDeleteLabel(item)}`;
        deleteButton.setAttribute('aria-label', `${deleteLabel} ${itemLabel} ${getItemDeleteLabel(item)}`);
        deleteButton.disabled = picker.items.length <= minItems;
        deleteButton.addEventListener('click', (event) => {
          event.preventDefault();
          event.stopPropagation();
          if (typeof onDelete === 'function') {
            Promise.resolve(onDelete(itemValue, item)).catch(reportDeleteError);
          }
        });

        row.appendChild(option);
        row.appendChild(deleteButton);
        menu.appendChild(row);
      });
      picker.setSelection(selected, { emit: false });
    };

    trigger?.addEventListener('click', (event) => {
      event.stopPropagation();
      editableListPickers.forEach((item) => {
        if (item !== picker) {
          item.close();
        }
      });
      picker.setOpen(!picker.open);
    });
    trigger?.addEventListener('keydown', (event) => {
      if (event.key === 'Escape') {
        picker.close();
      }
    });
    menu?.addEventListener('click', (event) => {
      event.stopPropagation();
    });

    editableListPickers.push(picker);
    return picker;
  }

  function closeEditableListPickers() {
    editableListPickers.forEach((picker) => picker.close());
  }

  function isClickInsideEditableListPicker(target) {
    return editableListPickers.some((picker) => Boolean(picker.root?.contains(target)));
  }

  globalScope.SidepanelEditableListPicker = {
    closeEditableListPickers,
    createEditableListPicker,
    isClickInsideEditableListPicker,
    normalizeEditableListValues,
    splitEditableListValues,
  };
})(window);
