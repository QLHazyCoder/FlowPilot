(function attachMultiPageContributionRegistry(root, factory) {
  root.MultiPageContributionRegistry = factory(root);
})(typeof self !== 'undefined' ? self : globalThis, function createContributionRegistryModule(root) {
  const flowRegistryApi = root?.MultiPageFlowRegistry || {};
  const DEFAULT_FLOW_ID = flowRegistryApi.DEFAULT_FLOW_ID || 'openai';
  const DEFAULT_KIRO_TARGET_ID = flowRegistryApi.DEFAULT_KIRO_TARGET_ID || 'kiro-rs';
  const DEFAULT_OPENAI_TARGET_ID = flowRegistryApi.DEFAULT_OPENAI_TARGET_ID || 'cpa';

  const ADAPTER_DEFINITIONS = Object.freeze({
    'openai-oauth': Object.freeze({
      id: 'openai-oauth',
      flowId: 'openai',
      artifactKind: 'openai-oauth',
      trigger: 'interactive-oauth',
      label: 'OpenAI OAuth 贡献',
      defaultTargetId: DEFAULT_OPENAI_TARGET_ID,
      sensitiveFieldPaths: Object.freeze([
        'credentials.access_token',
        'credentials.refresh_token',
        'credentials.id_token',
      ]),
    }),
    'openai-codex-file': Object.freeze({
      id: 'openai-codex-file',
      flowId: 'openai',
      artifactKind: 'codex',
      trigger: 'manual-upload',
      label: 'OpenAI Codex 文件贡献',
      defaultTargetId: 'codex2api',
      sensitiveFieldPaths: Object.freeze([
        'credentials.access_token',
        'credentials.refresh_token',
        'credentials.id_token',
      ]),
    }),
    'openai-sub2api-file': Object.freeze({
      id: 'openai-sub2api-file',
      flowId: 'openai',
      artifactKind: 'sub2api',
      trigger: 'manual-upload',
      label: 'OpenAI Sub2API 文件贡献',
      defaultTargetId: 'sub2api',
      sensitiveFieldPaths: Object.freeze([
        'credentials.accounts[].credentials.access_token',
        'credentials.accounts[].credentials.refresh_token',
        'credentials.accounts[].credentials.id_token',
      ]),
    }),
    'kiro-builder-id': Object.freeze({
      id: 'kiro-builder-id',
      flowId: 'kiro',
      artifactKind: 'kiro-builder-id',
      trigger: 'after-desktop-authorize',
      label: 'Kiro Builder ID 贡献',
      defaultTargetId: DEFAULT_KIRO_TARGET_ID,
      sensitiveFieldPaths: Object.freeze([
        'credentials.refreshToken',
        'credentials.clientSecret',
        'metadata.proxyPassword',
      ]),
    }),
  });

  const FLOW_ADAPTER_IDS = Object.freeze({
    openai: Object.freeze(['openai-oauth', 'openai-codex-file', 'openai-sub2api-file']),
    kiro: Object.freeze(['kiro-builder-id']),
  });

  const CONTRIBUTION_TUTORIAL_ENTRIES = Object.freeze({
    openai: Object.freeze({
      id: 'openai-contribution-tutorial',
      flowId: 'openai',
      label: '贡献/使用教程',
      portalPath: '/tutorial',
      defaultTargetId: DEFAULT_OPENAI_TARGET_ID,
      contributionAdapterId: 'openai-oauth',
      action: 'open-portal-and-enable-contribution',
    }),
    kiro: Object.freeze({
      id: 'kiro-contribution-tutorial',
      flowId: 'kiro',
      label: '贡献/使用教程',
      portalPath: '/tutorial',
      defaultTargetId: DEFAULT_KIRO_TARGET_ID,
      contributionAdapterId: 'kiro-builder-id',
      action: 'open-portal-and-enable-contribution',
    }),
  });

  function normalizeString(value = '') {
    return String(value || '').trim();
  }

  function normalizeFlowId(value = '', fallback = DEFAULT_FLOW_ID) {
    const normalized = normalizeString(value).toLowerCase();
    if (normalized && Object.prototype.hasOwnProperty.call(FLOW_ADAPTER_IDS, normalized)) {
      return normalized;
    }
    if (!normalized && typeof flowRegistryApi.normalizeFlowId === 'function') {
      return flowRegistryApi.normalizeFlowId(value, fallback);
    }
    return normalized || normalizeString(fallback).toLowerCase() || DEFAULT_FLOW_ID;
  }

  function normalizeAdapterId(value = '') {
    return normalizeString(value).toLowerCase();
  }

  function normalizeTargetId(flowId = DEFAULT_FLOW_ID, targetId = '') {
    if (typeof flowRegistryApi.normalizeTargetId === 'function') {
      return flowRegistryApi.normalizeTargetId(flowId, targetId);
    }
    const normalizedFlowId = normalizeFlowId(flowId, DEFAULT_FLOW_ID);
    const normalizedTargetId = normalizeString(targetId).toLowerCase();
    if (normalizedTargetId) {
      return normalizedTargetId;
    }
    return normalizedFlowId === 'kiro' ? DEFAULT_KIRO_TARGET_ID : DEFAULT_OPENAI_TARGET_ID;
  }

  function cloneAdapter(adapter) {
    if (!adapter) {
      return null;
    }
    return {
      ...adapter,
      sensitiveFieldPaths: Array.isArray(adapter.sensitiveFieldPaths)
        ? adapter.sensitiveFieldPaths.slice()
        : [],
    };
  }

  function getAdapterDefinition(adapterId = '') {
    return cloneAdapter(ADAPTER_DEFINITIONS[normalizeAdapterId(adapterId)] || null);
  }

  function getContributionAdapterIds(flowId = DEFAULT_FLOW_ID) {
    const normalizedFlowId = normalizeFlowId(flowId, DEFAULT_FLOW_ID);
    return (FLOW_ADAPTER_IDS[normalizedFlowId] || []).slice();
  }

  function getContributionAdapters(flowId = DEFAULT_FLOW_ID) {
    return getContributionAdapterIds(flowId)
      .map((adapterId) => getAdapterDefinition(adapterId))
      .filter(Boolean);
  }

  function getDefaultContributionAdapterId(flowId = DEFAULT_FLOW_ID) {
    return getContributionAdapterIds(flowId)[0] || '';
  }

  function buildPortalPageUrl(portalBaseUrl = '', portalPath = '/tutorial', params = {}) {
    const baseUrl = normalizeString(portalBaseUrl).replace(/\/+$/, '') || 'https://flowpilot.qlhazycoder.top';
    const path = normalizeString(portalPath) || '/tutorial';
    const normalizedPath = path.startsWith('/') ? path : `/${path}`;
    const query = Object.entries(params)
      .map(([key, value]) => [normalizeString(key), normalizeString(value)])
      .filter(([key, value]) => key && value)
      .map(([key, value]) => `${encodeURIComponent(key)}=${encodeURIComponent(value)}`)
      .join('&');
    return `${baseUrl}${normalizedPath}${query ? `?${query}` : ''}`;
  }

  function getContributionTutorialEntry(flowId = DEFAULT_FLOW_ID, options = {}) {
    const normalizedFlowId = normalizeFlowId(flowId, DEFAULT_FLOW_ID);
    const definition = CONTRIBUTION_TUTORIAL_ENTRIES[normalizedFlowId] || null;
    if (!definition) {
      return null;
    }
    const requestedAdapterId = normalizeAdapterId(options.adapterId);
    const adapterId = requestedAdapterId && hasContributionAdapter(normalizedFlowId, requestedAdapterId)
      ? requestedAdapterId
      : definition.contributionAdapterId;
    const targetId = normalizeTargetId(
      normalizedFlowId,
      options.targetId || definition.defaultTargetId
    );
    return {
      ...definition,
      targetId,
      contributionAdapterId: adapterId,
      portalUrl: buildPortalPageUrl(options.portalBaseUrl, definition.portalPath, {
        flow: normalizedFlowId,
        target: targetId,
      }),
    };
  }

  function hasContributionAdapter(flowId = DEFAULT_FLOW_ID, adapterId = '') {
    const normalizedAdapterId = normalizeAdapterId(adapterId);
    return Boolean(normalizedAdapterId) && getContributionAdapterIds(flowId).includes(normalizedAdapterId);
  }

  function hasPublicationTargets(flowId = DEFAULT_FLOW_ID) {
    if (typeof flowRegistryApi.getPublicationTargetDefinitions !== 'function') {
      return false;
    }
    const definitions = flowRegistryApi.getPublicationTargetDefinitions(flowId) || {};
    return Object.keys(definitions).length > 0;
  }

  function expectsContributionAdapter(flowId = DEFAULT_FLOW_ID) {
    const normalizedFlowId = normalizeFlowId(flowId, DEFAULT_FLOW_ID);
    const capabilities = typeof flowRegistryApi.getFlowCapabilities === 'function'
      ? (flowRegistryApi.getFlowCapabilities(normalizedFlowId) || {})
      : {};
    return Boolean(
      hasPublicationTargets(normalizedFlowId)
        || capabilities.supportsAccountContribution
        || capabilities.supportsContributionMode
        || getContributionAdapterIds(normalizedFlowId).length
    );
  }

  function getPublishedContributionFlowIds(flowIds = undefined) {
    const ids = Array.isArray(flowIds)
      ? flowIds
      : (typeof flowRegistryApi.getRegisteredFlowIds === 'function'
        ? flowRegistryApi.getRegisteredFlowIds()
        : Object.keys(FLOW_ADAPTER_IDS));
    return ids
      .map((flowId) => normalizeString(flowId).toLowerCase())
      .filter(Boolean)
      .filter((flowId) => expectsContributionAdapter(flowId));
  }

  function assertPublishedFlowsHaveContributionAdapters(flowIds = undefined) {
    const ids = Array.isArray(flowIds)
      ? flowIds.map((flowId) => normalizeString(flowId).toLowerCase()).filter(Boolean)
      : getPublishedContributionFlowIds();
    const missing = ids
      .filter((flowId) => getContributionAdapterIds(flowId).length === 0);
    if (missing.length) {
      throw new Error(`缺少账号贡献适配器：${missing.join(', ')}`);
    }
    return true;
  }

  return {
    ADAPTER_DEFINITIONS,
    CONTRIBUTION_TUTORIAL_ENTRIES,
    FLOW_ADAPTER_IDS,
    assertPublishedFlowsHaveContributionAdapters,
    getContributionTutorialEntry,
    getAdapterDefinition,
    getContributionAdapterIds,
    getContributionAdapters,
    getDefaultContributionAdapterId,
    getPublishedContributionFlowIds,
    hasContributionAdapter,
    normalizeAdapterId,
    normalizeFlowId,
  };
});
