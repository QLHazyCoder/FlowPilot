(function attachMultiPageFlowRegistry(root, factory) {
  root.MultiPageFlowRegistry = factory();
})(typeof self !== 'undefined' ? self : globalThis, function createFlowRegistryModule() {
  const rootScope = typeof self !== 'undefined' ? self : globalThis;
  const flowsIndexApi = rootScope.MultiPageFlowsIndex || {};

  const DEFAULT_FLOW_ID = 'openai';
  const SHARED_SERVICE_IDS = Object.freeze(['account', 'email', 'proxy']);

  const DEFAULT_FLOW_CAPABILITIES = Object.freeze({
    supportsEmailSignup: true,
    supportsPhoneSignup: false,
    supportsPhoneVerificationSettings: false,
    supportsPlusMode: false,
    supportsContributionMode: false,
    supportsAccountContribution: false,
    supportsOpenAiOAuthContribution: false,
    contributionAdapterIds: [],
    supportedTargetIds: [],
    supportsLuckmail: false,
    canSwitchFlow: true,
    stepDefinitionMode: 'default',
    targetSelectorLabel: '\u6765\u6e90',
  });

  function freezeDeep(value) {
    if (!value || typeof value !== 'object' || Object.isFrozen(value)) {
      return value;
    }
    Object.getOwnPropertyNames(value).forEach((key) => {
      freezeDeep(value[key]);
    });
    return Object.freeze(value);
  }

  const SHARED_SETTINGS_GROUP_DEFINITIONS = freezeDeep({
    'service-account': {
      id: 'service-account',
      label: '\u8d26\u6237',
      rowIds: ['row-custom-password'],
    },
    'service-email': {
      id: 'service-email',
      label: '\u90ae\u7bb1\u670d\u52a1',
    },
    'service-proxy': {
      id: 'service-proxy',
      label: 'IP \u4ee3\u7406',
      sectionIds: ['ip-proxy-section'],
    },
    'shared-auto-run': {
      id: 'shared-auto-run',
      label: '\u81ea\u52a8\u8fd0\u884c',
      rowIds: [
        'row-shared-auto-run',
        'row-auto-run-thread-interval',
        'row-step-execution-range',
      ],
    },
    'shared-settings-actions': {
      id: 'shared-settings-actions',
      label: '\u8bbe\u7f6e\u64cd\u4f5c',
      rowIds: ['row-settings-actions'],
    },
  });

  function buildFlowDefinitions() {
    if (typeof flowsIndexApi.getFlowDefinitions !== 'function') {
      return {};
    }
    return flowsIndexApi.getFlowDefinitions() || {};
  }

  const FLOW_DEFINITIONS = freezeDeep(buildFlowDefinitions());
  const REGISTERED_FLOW_IDS = Object.freeze(Object.keys(FLOW_DEFINITIONS));

  function buildSettingsGroupDefinitions() {
    const next = {
      ...SHARED_SETTINGS_GROUP_DEFINITIONS,
    };
    Object.values(FLOW_DEFINITIONS).forEach((flowDefinition) => {
      Object.assign(next, flowDefinition?.settingsGroups || {});
    });
    return next;
  }

  const SETTINGS_GROUP_DEFINITIONS = freezeDeep(buildSettingsGroupDefinitions());

  function normalizeFlowId(value = '', fallback = DEFAULT_FLOW_ID) {
    const normalized = String(value || '').trim().toLowerCase();
    if (normalized && Object.prototype.hasOwnProperty.call(FLOW_DEFINITIONS, normalized)) {
      return normalized;
    }
    const fallbackValue = String(fallback || '').trim().toLowerCase();
    if (fallbackValue && Object.prototype.hasOwnProperty.call(FLOW_DEFINITIONS, fallbackValue)) {
      return fallbackValue;
    }
    if (Object.prototype.hasOwnProperty.call(FLOW_DEFINITIONS, DEFAULT_FLOW_ID)) {
      return DEFAULT_FLOW_ID;
    }
    return REGISTERED_FLOW_IDS[0] || DEFAULT_FLOW_ID;
  }

  function getRegisteredFlowIds() {
    return REGISTERED_FLOW_IDS.slice();
  }

  function getFlowDefinition(flowId) {
    const normalizedFlowId = normalizeFlowId(flowId);
    return FLOW_DEFINITIONS[normalizedFlowId] || null;
  }

  function getFlowLabel(flowId) {
    return getFlowDefinition(flowId)?.label || normalizeFlowId(flowId);
  }

  function getDefaultTargetId(flowId) {
    const flowDefinition = getFlowDefinition(flowId);
    return String(flowDefinition?.defaultTargetId || '').trim().toLowerCase();
  }

  function normalizeTargetId(flowId, targetId = '', fallback = undefined) {
    const normalizedFlowId = normalizeFlowId(flowId);
    const targetDefinitions = getFlowDefinition(normalizedFlowId)?.targets || {};
    const targetKeys = Object.keys(targetDefinitions);
    if (!targetKeys.length) {
      return String(targetId || fallback || '').trim().toLowerCase();
    }

    const normalizedTargetId = String(targetId || '').trim().toLowerCase();
    if (normalizedTargetId && Object.prototype.hasOwnProperty.call(targetDefinitions, normalizedTargetId)) {
      return normalizedTargetId;
    }

    const fallbackValue = String(fallback || '').trim().toLowerCase();
    if (fallbackValue && Object.prototype.hasOwnProperty.call(targetDefinitions, fallbackValue)) {
      return fallbackValue;
    }

    const defaultTargetId = getDefaultTargetId(normalizedFlowId);
    if (defaultTargetId && Object.prototype.hasOwnProperty.call(targetDefinitions, defaultTargetId)) {
      return defaultTargetId;
    }

    return targetKeys[0];
  }

  function normalizeOpenAiTargetId(value = '', fallback = undefined) {
    return normalizeTargetId('openai', value, fallback);
  }

  function normalizeKiroTargetId(value = '', fallback = undefined) {
    return normalizeTargetId('kiro', value, fallback);
  }

  function getTargetDefinitions(flowId) {
    return getFlowDefinition(flowId)?.targets || {};
  }

  function getTargetDefinition(flowId, targetId) {
    const normalizedFlowId = normalizeFlowId(flowId);
    const normalizedTargetId = normalizeTargetId(
      normalizedFlowId,
      targetId,
      getDefaultTargetId(normalizedFlowId)
    );
    return getTargetDefinitions(normalizedFlowId)[normalizedTargetId] || null;
  }

  function getTargetOptions(flowId) {
    return Object.values(getTargetDefinitions(flowId));
  }

  function getTargetLabel(flowId, targetId) {
    return getTargetDefinition(flowId, targetId)?.label
      || normalizeTargetId(flowId, targetId);
  }

  function getPublicationTargetDefinitions(flowId) {
    return getFlowDefinition(flowId)?.publicationTargets || {};
  }

  function getPublicationTargetDefinition(flowId, publicationTargetId) {
    const normalizedFlowId = normalizeFlowId(flowId);
    const flowDefinition = getFlowDefinition(normalizedFlowId);
    const normalizedPublicationTargetId = String(
      publicationTargetId || flowDefinition?.defaultPublicationTargetId || ''
    ).trim().toLowerCase();
    return getPublicationTargetDefinitions(normalizedFlowId)[normalizedPublicationTargetId] || null;
  }

  function getFlowCapabilities(flowId) {
    return {
      ...DEFAULT_FLOW_CAPABILITIES,
      ...(getFlowDefinition(flowId)?.capabilities || {}),
    };
  }

  function getTargetCapabilityDefinitions(flowId) {
    return getFlowDefinition(flowId)?.targetCapabilities || {};
  }

  function getTargetCapabilities(flowId, targetId) {
    const normalizedFlowId = normalizeFlowId(flowId);
    const normalizedTargetId = normalizeTargetId(
      normalizedFlowId,
      targetId,
      getDefaultTargetId(normalizedFlowId)
    );
    return getTargetCapabilityDefinitions(normalizedFlowId)[normalizedTargetId] || null;
  }

  function getVisibleGroupIds(flowId, targetId, options = {}) {
    const normalizedFlowId = normalizeFlowId(flowId);
    const flowDefinition = getFlowDefinition(normalizedFlowId);
    const normalizedTargetId = normalizeTargetId(
      normalizedFlowId,
      targetId,
      getDefaultTargetId(normalizedFlowId)
    );
    const targetDefinition = getTargetDefinition(normalizedFlowId, normalizedTargetId);
    const includeSharedServices = options?.includeSharedServices !== false;
    const serviceGroups = includeSharedServices
      ? (Array.isArray(flowDefinition?.services)
        ? flowDefinition.services.map((serviceId) => `service-${serviceId}`)
        : [])
      : [];
    return Array.from(new Set([
      ...(Array.isArray(flowDefinition?.baseGroups) ? flowDefinition.baseGroups : []),
      ...(Array.isArray(targetDefinition?.groups) ? targetDefinition.groups : []),
      ...serviceGroups,
    ]));
  }

  function getSettingsGroupDefinition(groupId) {
    const normalizedGroupId = String(groupId || '').trim();
    return SETTINGS_GROUP_DEFINITIONS[normalizedGroupId] || null;
  }

  function getSettingsGroupDefinitions() {
    return SETTINGS_GROUP_DEFINITIONS;
  }

  function getRuntimeSourceDefinitions() {
    const next = {};
    Object.values(FLOW_DEFINITIONS).forEach((flowDefinition) => {
      Object.assign(next, flowDefinition?.runtimeSources || {});
    });
    return next;
  }

  function getDriverDefinitions() {
    const next = {};
    Object.values(FLOW_DEFINITIONS).forEach((flowDefinition) => {
      Object.assign(next, flowDefinition?.driverDefinitions || {});
    });
    return next;
  }

  function getSourceAliases() {
    const next = {};
    Object.values(FLOW_DEFINITIONS).forEach((flowDefinition) => {
      Object.assign(next, flowDefinition?.sourceAliases || {});
    });
    return next;
  }

  const OPENAI_TARGET_IDS = Object.freeze(Object.keys(getTargetDefinitions('openai')));
  const DEFAULT_OPENAI_TARGET_ID = String(getDefaultTargetId('openai') || OPENAI_TARGET_IDS[0] || 'cpa');
  const DEFAULT_KIRO_TARGET_ID = String(getDefaultTargetId('kiro') || 'kiro-rs');
  const DEFAULT_KIRO_PUBLICATION_TARGET_ID = String(
    getFlowDefinition('kiro')?.defaultPublicationTargetId || DEFAULT_KIRO_TARGET_ID
  );
  const DEFAULT_KIRO_RS_URL = String(
    getFlowDefinition('kiro')?.defaultTargetState?.baseUrl || ''
  ).trim();

  return {
    DEFAULT_FLOW_CAPABILITIES,
    DEFAULT_FLOW_ID,
    DEFAULT_KIRO_PUBLICATION_TARGET_ID,
    DEFAULT_KIRO_RS_URL,
    DEFAULT_KIRO_TARGET_ID,
    DEFAULT_OPENAI_TARGET_ID,
    FLOW_DEFINITIONS,
    OPENAI_TARGET_IDS,
    SETTINGS_GROUP_DEFINITIONS,
    SHARED_SERVICE_IDS,
    getDriverDefinitions,
    getDefaultTargetId,
    getFlowCapabilities,
    getFlowDefinition,
    getFlowLabel,
    getPublicationTargetDefinition,
    getPublicationTargetDefinitions,
    getRegisteredFlowIds,
    getRuntimeSourceDefinitions,
    getSettingsGroupDefinition,
    getSettingsGroupDefinitions,
    getSourceAliases,
    getTargetCapabilities,
    getTargetCapabilityDefinitions,
    getTargetDefinition,
    getTargetDefinitions,
    getTargetLabel,
    getTargetOptions,
    getVisibleGroupIds,
    normalizeFlowId,
    normalizeKiroTargetId,
    normalizeOpenAiTargetId,
    normalizeTargetId,
  };
});
