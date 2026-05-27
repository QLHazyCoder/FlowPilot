(function attachLegacySettingsImporter(root, factory) {
  root.MultiPageLegacySettingsImporter = factory(root);
})(typeof self !== 'undefined' ? self : globalThis, function createLegacySettingsImporterModule(root) {
  const LEGACY_TOP_LEVEL_KEYS = Object.freeze([
    'panelMode',
    'openaiIntegrationTargetId',
    'kiroTargetId',
    'stepExecutionRangeByFlow',
    'kiroRuntime',
  ]);

  function isPlainObject(value) {
    return Boolean(value) && typeof value === 'object' && !Array.isArray(value);
  }

  function cloneValue(value) {
    if (Array.isArray(value)) {
      return value.map((entry) => cloneValue(entry));
    }
    if (isPlainObject(value)) {
      return Object.fromEntries(
        Object.entries(value).map(([key, entryValue]) => [key, cloneValue(entryValue)])
      );
    }
    return value;
  }

  function collectLegacyFieldHits(input = {}) {
    if (!isPlainObject(input)) {
      return [];
    }

    const hits = [];
    LEGACY_TOP_LEVEL_KEYS.forEach((key) => {
      if (Object.prototype.hasOwnProperty.call(input, key)) {
        hits.push(key);
      }
    });

    const settingsState = isPlainObject(input.settingsState) ? input.settingsState : {};
    const openaiSettings = isPlainObject(settingsState?.flows?.openai) ? settingsState.flows.openai : {};
    const kiroSettings = isPlainObject(settingsState?.flows?.kiro) ? settingsState.flows.kiro : {};
    if (Object.prototype.hasOwnProperty.call(openaiSettings, 'integrationTargetId')) {
      hits.push('settingsState.flows.openai.integrationTargetId');
    }
    if (Object.prototype.hasOwnProperty.call(openaiSettings, 'integrationTargets')) {
      hits.push('settingsState.flows.openai.integrationTargets');
    }
    if (Object.prototype.hasOwnProperty.call(kiroSettings, 'targetId')) {
      hits.push('settingsState.flows.kiro.targetId');
    }

    return Array.from(new Set(hits));
  }

  function resolveSettingsSchemaApi(deps = {}) {
    if (deps.settingsSchemaApi?.normalizeSettingsState && deps.settingsSchemaApi?.buildSettingsView) {
      return deps.settingsSchemaApi;
    }
    const settingsSchemaModule = deps.settingsSchemaModule || root.MultiPageSettingsSchema || null;
    if (typeof settingsSchemaModule?.createSettingsSchema !== 'function') {
      return null;
    }
    return settingsSchemaModule.createSettingsSchema({
      flowRegistry: deps.flowRegistry || root.MultiPageFlowRegistry || null,
      defaultFlowId: deps.defaultFlowId,
    });
  }

  function buildImportInput(input = {}) {
    const next = isPlainObject(input) ? cloneValue(input) : {};
    const settingsState = isPlainObject(next.settingsState) ? next.settingsState : {};
    const flows = isPlainObject(settingsState.flows) ? settingsState.flows : {};
    const openaiState = isPlainObject(flows.openai) ? flows.openai : {};
    const kiroState = isPlainObject(flows.kiro) ? flows.kiro : {};
    const legacyOpenAiTargetId = String(
      input?.openaiIntegrationTargetId
      ?? input?.panelMode
      ?? ''
    ).trim();
    const legacyKiroTargetId = String(input?.kiroTargetId ?? '').trim();
    const openaiHasCanonicalTarget = Object.prototype.hasOwnProperty.call(openaiState, 'selectedTargetId')
      || Object.prototype.hasOwnProperty.call(openaiState, 'integrationTargetId');
    const kiroHasCanonicalTarget = Object.prototype.hasOwnProperty.call(kiroState, 'selectedTargetId')
      || Object.prototype.hasOwnProperty.call(kiroState, 'targetId');

    if (!openaiHasCanonicalTarget && legacyOpenAiTargetId) {
      next.settingsState = settingsState;
      next.settingsState.flows = flows;
      next.settingsState.flows.openai = {
        ...openaiState,
        selectedTargetId: legacyOpenAiTargetId,
      };
    }

    if (!kiroHasCanonicalTarget && legacyKiroTargetId) {
      next.settingsState = next.settingsState || settingsState;
      next.settingsState.flows = next.settingsState.flows || flows;
      next.settingsState.flows.kiro = {
        ...kiroState,
        selectedTargetId: legacyKiroTargetId,
      };
    }

    return next;
  }

  function createSettingsImporter(deps = {}) {
    const settingsSchemaApi = resolveSettingsSchemaApi(deps);

    function importSettings(input = {}) {
      if (!isPlainObject(input)) {
        throw new Error('Settings payload in the config file is invalid.');
      }
      if (!settingsSchemaApi?.normalizeSettingsState) {
        throw new Error('Settings importer is not initialized.');
      }

      const importInput = buildImportInput(input);
      const normalizedState = settingsSchemaApi.normalizeSettingsState(importInput, {
        activeFlowId: importInput.activeFlowId || importInput.flowId || deps.defaultFlowId,
      });

      return {
        settingsSchemaVersion: Number(normalizedState.schemaVersion) || 0,
        settingsState: cloneValue(normalizedState),
        legacyFieldHits: collectLegacyFieldHits(input),
      };
    }

    return {
      collectLegacyFieldHits,
      importSettings,
    };
  }

  return {
    LEGACY_TOP_LEVEL_KEYS,
    collectLegacyFieldHits,
    createSettingsImporter,
  };
});
