(function attachSidepanelAccountPoolUi(globalScope) {
  function createAccountPoolFormController(options = {}) {
    const {
      formShell = null,
      toggleButton = null,
      hiddenLabel = 'Add Account',
      visibleLabel = 'Cancel Add',
      onClear = null,
      onFocus = null,
    } = options;

    let visible = false;

    function sync() {
      if (formShell) {
        formShell.hidden = !visible;
      }
      if (toggleButton) {
        toggleButton.textContent = visible ? visibleLabel : hiddenLabel;
        toggleButton.setAttribute('aria-expanded', String(visible));
      }
    }

    function setVisible(nextVisible, controlOptions = {}) {
      const {
        clearForm = false,
        focusField = false,
      } = controlOptions;

      visible = Boolean(nextVisible);
      if (clearForm && typeof onClear === 'function') {
        onClear();
      }

      sync();

      if (visible && focusField && typeof onFocus === 'function') {
        onFocus();
      }
    }

    function isVisible() {
      return visible;
    }

    sync();

    return {
      isVisible,
      setVisible,
      sync,
    };
  }

  globalScope.SidepanelAccountPoolUi = {
    createAccountPoolFormController,
  };
})(window);
