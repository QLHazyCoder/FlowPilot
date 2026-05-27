(function attachLegacyAccountRecordsImporter(root, factory) {
  root.MultiPageLegacyAccountRecordsImporter = factory(root);
})(typeof self !== 'undefined' ? self : globalThis, function createLegacyAccountRecordsImporterModule(root) {
  function createAccountRecordsImporter(deps = {}) {
    const createAccountRunHistoryHelpers = deps.createAccountRunHistoryHelpers
      || root.MultiPageBackgroundAccountRunHistory?.createAccountRunHistoryHelpers;

    function importAccountRecords(records = []) {
      if (!Array.isArray(records)) {
        throw new Error('Account-records import payload must be an array.');
      }
      if (typeof createAccountRunHistoryHelpers !== 'function') {
        return records
          .filter((record) => Boolean(record) && typeof record === 'object' && !Array.isArray(record))
          .map((record) => ({ ...record }));
      }

      const helpers = createAccountRunHistoryHelpers({
        chrome: deps.chrome || {
          storage: {
            local: {
              get: async () => ({}),
              set: async () => {},
            },
          },
        },
        getState: deps.getState || (async () => ({})),
        addLog: deps.addLog || (async () => {}),
        getNodeIdByStepForState: deps.getNodeIdByStepForState || (() => ''),
        normalizeAccountRunHistoryHelperBaseUrl: deps.normalizeAccountRunHistoryHelperBaseUrl
          || ((value) => String(value || '').trim()),
      });
      if (typeof helpers?.normalizeAccountRunHistory !== 'function') {
        return [];
      }
      return helpers.normalizeAccountRunHistory(records);
    }

    return {
      importAccountRecords,
    };
  }

  return {
    createAccountRecordsImporter,
  };
});
