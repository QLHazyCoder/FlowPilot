(function attachBackgroundGrokState(root, factory) {
  root.MultiPageBackgroundGrokState = factory();
})(typeof self !== 'undefined' ? self : globalThis, function createBackgroundGrokStateModule() {
  function cleanString(value = '') {
    return String(value || '').trim();
  }

  function normalizeSsoCookies(values = []) {
    if (!Array.isArray(values)) {
      return [];
    }
    return Array.from(new Set(
      values
        .map((entry) => cleanString(entry))
        .filter(Boolean)
    ));
  }

  function buildFreshKeepState(sourceState = {}) {
    const keepState = {};
    const ssoCookie = cleanString(sourceState?.grokSsoCookie);
    const ssoCookies = normalizeSsoCookies(sourceState?.grokSsoCookies);

    if (ssoCookie) {
      keepState.grokSsoCookie = ssoCookie;
    } else if (Object.prototype.hasOwnProperty.call(sourceState || {}, 'grokSsoCookie')) {
      keepState.grokSsoCookie = '';
    }

    if (ssoCookies.length || Array.isArray(sourceState?.grokSsoCookies)) {
      keepState.grokSsoCookies = ssoCookies;
    }

    return keepState;
  }

  return {
    buildFreshKeepState,
    normalizeSsoCookies,
  };
});
