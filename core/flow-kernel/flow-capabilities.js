/*
 * @Author: QLHazycoder
 * @Date: 2026-07-22 00:00:00
 * @LastEditors: QLHazycoder
 * @LastEditTime: 2026-09-10 18:50:11
 * @Description: Resolve flow, target, and runtime capability constraints.
 */
(function attachMultiPageFlowCapabilities(root, factory) {
  root.MultiPageFlowCapabilities = factory();
})(typeof self !== 'undefined' ? self : globalThis, function createFlowCapabilitiesModule() {
  const rootScope = typeof self !== 'undefined' ? self : globalThis;
  const accountDeliveryApi = rootScope.MultiPageOpenAiAccountDelivery || {};
  const flowRegistryApi = rootScope.MultiPageFlowRegistry || {};
  const contributionRegistryApi = rootScope.MultiPageContributionRegistry || {};
  const settingsSchemaApi = rootScope.MultiPageSettingsSchema || {};
  const DEFAULT_FLOW_ID = flowRegistryApi.DEFAULT_FLOW_ID || 'openai';
  const DEFAULT_OPENAI_TARGET_ID = flowRegistryApi.DEFAULT_OPENAI_TARGET_ID || 'cpa';
  const SIGNUP_METHOD_EMAIL = 'email';
  const SIGNUP_METHOD_PHONE = 'phone';
  const ACCOUNT_DELIVERY_MODE_OAUTH = accountDeliveryApi.ACCOUNT_DELIVERY_MODE_OAUTH || 'oauth';
  const ACCOUNT_DELIVERY_MODE_SESSION = accountDeliveryApi.ACCOUNT_DELIVERY_MODE_SESSION || 'session';
  const ACCOUNT_DELIVERY_MODE_AGENT_IDENTITY = accountDeliveryApi.ACCOUNT_DELIVERY_MODE_AGENT_IDENTITY || 'agent_identity';
  const ACCOUNT_DELIVERY_MODE_IDS = Object.freeze([
    ACCOUNT_DELIVERY_MODE_OAUTH,
    ACCOUNT_DELIVERY_MODE_SESSION,
    ACCOUNT_DELIVERY_MODE_AGENT_IDENTITY,
  ]);
  const ACCOUNT_DELIVERY_MODE_ID_SET = new Set(ACCOUNT_DELIVERY_MODE_IDS);
  const VALID_OPENAI_TARGET_IDS = typeof flowRegistryApi.getTargetDefinitions === 'function'
    ? Object.keys(flowRegistryApi.getTargetDefinitions('openai') || {})
    : (Array.isArray(flowRegistryApi.OPENAI_TARGET_IDS)
      ? flowRegistryApi.OPENAI_TARGET_IDS.slice()
      : ['cpa', 'sub2api', 'codex2api', 'webchat', 'chatgpt2api']);
  const REGISTERED_FLOW_IDS = Array.isArray(flowRegistryApi.getRegisteredFlowIds?.())
    ? flowRegistryApi.getRegisteredFlowIds().map((flowId) => String(flowId || '').trim().toLowerCase()).filter(Boolean)
    : [DEFAULT_FLOW_ID];
  const REGISTERED_FLOW_ID_SET = new Set(REGISTERED_FLOW_IDS);

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
    targetSelectorLabel: '来源',
  });

  const FLOW_CAPABILITIES = Object.freeze(
    Object.fromEntries(
      (typeof flowRegistryApi.getRegisteredFlowIds === 'function'
        ? flowRegistryApi.getRegisteredFlowIds()
        : [DEFAULT_FLOW_ID]
      ).map((flowId) => [
        flowId,
        Object.freeze({
          ...DEFAULT_FLOW_CAPABILITIES,
          ...(typeof flowRegistryApi.getFlowCapabilities === 'function'
            ? flowRegistryApi.getFlowCapabilities(flowId)
            : {}),
        }),
      ])
    )
  );

  const DEFAULT_TARGET_CAPABILITIES = Object.freeze({
    supportsPhoneSignup: true,
    supportsPhoneVerificationSettings: true,
    requiresPhoneSignupWarning: false,
    usesOauthTimeoutBudget: false,
    supportedAccountDeliveryModes: Object.freeze([ACCOUNT_DELIVERY_MODE_OAUTH]),
    defaultAccountDeliveryMode: ACCOUNT_DELIVERY_MODE_OAUTH,
    accountDeliveryRouteByMode: Object.freeze({
      [ACCOUNT_DELIVERY_MODE_OAUTH]: 'oauth',
    }),
  });

  const MODE_SWITCH_RELEVANT_KEYS = Object.freeze([
    'activeFlowId',
    'accountContributionEnabled',
    'plusModeEnabled',
    'signupMethod',
    'accountDeliveryMode',
    'targetId',
  ]);
  const OPENAI_WEBCHAT_RELEVANT_KEYS = Object.freeze([
    'activeFlowId',
    'targetId',
    'openaiWebchatUrl',
    'openaiWebchatAdminKey',
    'openaiWebchatUploadEnabled',
    'openaiChatgpt2ApiUrl',
    'openaiChatgpt2ApiAdminKey',
  ]);

  const OPENAI_TARGET_CAPABILITIES = Object.freeze(
    typeof flowRegistryApi.getTargetCapabilityDefinitions === 'function'
      ? (flowRegistryApi.getTargetCapabilityDefinitions('openai') || {})
      : {}
  );

  function normalizeFlowId(value = '', fallback = DEFAULT_FLOW_ID) {
    if (typeof flowRegistryApi.normalizeFlowId === 'function') {
      return flowRegistryApi.normalizeFlowId(value, fallback);
    }
    const normalized = String(value || '').trim().toLowerCase();
    return normalized || String(fallback || '').trim().toLowerCase() || DEFAULT_FLOW_ID;
  }

  function normalizeCapabilityFlowId(value = '', fallback = DEFAULT_FLOW_ID) {
    const normalized = String(value || '').trim().toLowerCase();
    if (normalized) {
      return normalized;
    }
    return normalizeFlowId(fallback, DEFAULT_FLOW_ID);
  }

  function isRegisteredFlowId(flowId = '') {
    const normalized = String(flowId || '').trim().toLowerCase();
    return Boolean(normalized) && REGISTERED_FLOW_ID_SET.has(normalized);
  }

  function normalizeOpenAiTargetId(value = '', fallback = DEFAULT_OPENAI_TARGET_ID) {
    const normalized = String(value || '').trim().toLowerCase();
    if (VALID_OPENAI_TARGET_IDS.includes(normalized)) {
      return normalized;
    }
    const fallbackValue = String(fallback || '').trim().toLowerCase();
    return VALID_OPENAI_TARGET_IDS.includes(fallbackValue)
      ? fallbackValue
      : DEFAULT_OPENAI_TARGET_ID;
  }

  function normalizeSignupMethod(value = '') {
    return String(value || '').trim().toLowerCase() === SIGNUP_METHOD_PHONE
      ? SIGNUP_METHOD_PHONE
      : SIGNUP_METHOD_EMAIL;
  }

  function normalizeAccountDeliveryMode(value = '', fallback = ACCOUNT_DELIVERY_MODE_OAUTH) {
    if (typeof accountDeliveryApi.normalizeAccountDeliveryMode === 'function') {
      return accountDeliveryApi.normalizeAccountDeliveryMode(value, fallback);
    }
    const normalized = String(value || '').trim().toLowerCase();
    if (ACCOUNT_DELIVERY_MODE_ID_SET.has(normalized)) {
      return normalized;
    }
    const normalizedFallback = String(fallback || '').trim().toLowerCase();
    return ACCOUNT_DELIVERY_MODE_ID_SET.has(normalizedFallback)
      ? normalizedFallback
      : ACCOUNT_DELIVERY_MODE_OAUTH;
  }

  function normalizeAccountDeliveryModeList(values = [], fallback = [ACCOUNT_DELIVERY_MODE_OAUTH]) {
    const source = Array.isArray(values) ? values : [];
    const seen = new Set();
    const normalized = [];
    source.forEach((value) => {
      const modeId = String(value || '').trim().toLowerCase();
      if (!ACCOUNT_DELIVERY_MODE_ID_SET.has(modeId) || seen.has(modeId)) {
        return;
      }
      seen.add(modeId);
      normalized.push(modeId);
    });
    if (normalized.length) {
      return normalized;
    }
    const fallbackValues = Array.isArray(fallback) ? fallback : [];
    fallbackValues.forEach((value) => {
      const modeId = String(value || '').trim().toLowerCase();
      if (!ACCOUNT_DELIVERY_MODE_ID_SET.has(modeId) || seen.has(modeId)) {
        return;
      }
      seen.add(modeId);
      normalized.push(modeId);
    });
    return normalized.length ? normalized : [ACCOUNT_DELIVERY_MODE_OAUTH];
  }

  function normalizeOpenAiTargetList(values = []) {
    if (!Array.isArray(values)) {
      return [];
    }
    const seen = new Set();
    const normalized = [];
    values.forEach((value) => {
      const targetId = normalizeOpenAiTargetId(value, '');
      if (!targetId || seen.has(targetId)) {
        return;
      }
      seen.add(targetId);
      normalized.push(targetId);
    });
    return normalized;
  }

  function getTargetLabel(flowId = DEFAULT_FLOW_ID, targetId = '') {
    if (
      isRegisteredFlowId(flowId)
      && typeof flowRegistryApi.getTargetLabel === 'function'
    ) {
      return flowRegistryApi.getTargetLabel(flowId, targetId);
    }
    const normalized = String(targetId || '').trim().toLowerCase();
    if (normalized === 'sub2api') {
      return 'SUB2API';
    }
    if (normalized === 'codex2api') {
      return 'Codex2API';
    }
    if (normalized === 'cpa') {
      return 'CPA';
    }
    if (normalized === 'chatgpt2api') {
      return 'ChatGPT2API';
    }
    return normalized || String(targetId || '').trim();
  }

  function isPlainObject(value) {
    return Boolean(value) && typeof value === 'object' && !Array.isArray(value);
  }

  function cleanString(value = '') {
    return String(value || '').trim();
  }

  function hasOwn(value, key) {
    return Boolean(value) && Object.prototype.hasOwnProperty.call(value, key);
  }

  function createFlowCapabilityRegistry(deps = {}) {
    const {
      defaultFlowCapabilities = DEFAULT_FLOW_CAPABILITIES,
      defaultFlowId = DEFAULT_FLOW_ID,
      defaultTargetCapabilities = DEFAULT_TARGET_CAPABILITIES,
      flowCapabilities = FLOW_CAPABILITIES,
      targetCapabilities = OPENAI_TARGET_CAPABILITIES,
    } = deps;
    const settingsSchema = settingsSchemaApi.createSettingsSchema
      ? settingsSchemaApi.createSettingsSchema({
        defaultFlowId,
      })
      : null;

    function getNormalizedSettingsState(state = {}) {
      if (!settingsSchema?.normalizeSettingsState) {
        return null;
      }
      try {
        return settingsSchema.normalizeSettingsState({
          ...(isPlainObject(state) ? state : {}),
          ...(isPlainObject(state?.settingsState) ? { settingsState: state.settingsState } : {}),
          activeFlowId: state?.activeFlowId ?? state?.settingsState?.activeFlowId ?? defaultFlowId,
        });
      } catch {
        return null;
      }
    }

    function getOpenAiFlowSettingsFromState(state = {}) {
      const normalizedState = getNormalizedSettingsState(state);
      if (isPlainObject(normalizedState?.flows?.openai)) {
        return normalizedState.flows.openai;
      }
      if (isPlainObject(state?.settingsState?.flows?.openai)) {
        return state.settingsState.flows.openai;
      }
      if (isPlainObject(state?.flows?.openai)) {
        return state.flows.openai;
      }
      return {};
    }

    function resolveOpenAiWebchatState(state = {}, targetId = '') {
      const openAiFlow = getOpenAiFlowSettingsFromState(state);
      const normalizedState = getNormalizedSettingsState(state);
      const grokFlow = isPlainObject(normalizedState?.flows?.grok)
        ? normalizedState.flows.grok
        : (isPlainObject(state?.settingsState?.flows?.grok) ? state.settingsState.flows.grok : {});
      const targetConfig = isPlainObject(openAiFlow?.targets?.webchat)
        ? openAiFlow.targets.webchat
        : {};
      const grokTargetConfig = isPlainObject(grokFlow?.targets?.webchat2api)
        ? grokFlow.targets.webchat2api
        : {};
      const baseUrl = cleanString(hasOwn(state, 'openaiWebchatUrl')
        ? state.openaiWebchatUrl
        : (hasOwn(state, 'grokWebchat2ApiUrl') ? state.grokWebchat2ApiUrl : (targetConfig.baseUrl || grokTargetConfig.baseUrl)));
      const apiKey = cleanString(hasOwn(state, 'openaiWebchatAdminKey')
        ? state.openaiWebchatAdminKey
        : (hasOwn(state, 'grokWebchat2ApiAdminKey') ? state.grokWebchat2ApiAdminKey : (targetConfig.apiKey || grokTargetConfig.apiKey)));
      const uploadEnabled = false;
      const normalizedTargetId = String(targetId || '').trim().toLowerCase();
      const targetIsWebchat = normalizedTargetId === 'webchat';
      const missingFields = [];
      if (!baseUrl) missingFields.push('baseUrl');
      if (!apiKey) missingFields.push('apiKey');
      const configComplete = missingFields.length === 0;
      const additionalUploadEnabled = false;
      return {
        additionalUploadEnabled,
        configComplete,
        missingFields,
        targetIsWebchat,
        uploadEnabled,
        uploadRequired: targetIsWebchat || additionalUploadEnabled,
      };
    }

    function resolveOpenAiChatgpt2ApiState(state = {}, targetId = '') {
      const openAiFlow = getOpenAiFlowSettingsFromState(state);
      const targetConfig = isPlainObject(openAiFlow?.targets?.chatgpt2api)
        ? openAiFlow.targets.chatgpt2api
        : {};
      const baseUrl = cleanString(hasOwn(state, 'openaiChatgpt2ApiUrl')
        ? state.openaiChatgpt2ApiUrl
        : targetConfig.baseUrl);
      const apiKey = cleanString(hasOwn(state, 'openaiChatgpt2ApiAdminKey')
        ? state.openaiChatgpt2ApiAdminKey
        : targetConfig.apiKey);
      const normalizedTargetId = String(targetId || '').trim().toLowerCase();
      const targetIsChatgpt2Api = normalizedTargetId === 'chatgpt2api';
      const missingFields = [];
      if (!baseUrl) missingFields.push('baseUrl');
      if (!apiKey) missingFields.push('apiKey');
      return {
        configComplete: missingFields.length === 0,
        missingFields,
        targetIsChatgpt2Api,
        uploadRequired: targetIsChatgpt2Api,
      };
    }

    function resolveGrok2ApiState(state = {}, targetId = '') {
      const normalizedState = getNormalizedSettingsState(state);
      const grokFlow = isPlainObject(normalizedState?.flows?.grok)
        ? normalizedState.flows.grok
        : (isPlainObject(state?.settingsState?.flows?.grok) ? state.settingsState.flows.grok : {});
      const grok2ApiConfig = isPlainObject(grokFlow?.targets?.grok2api)
        ? grokFlow.targets.grok2api
        : {};
      const sub2apiConfig = isPlainObject(grokFlow?.targets?.sub2api)
        ? grokFlow.targets.sub2api
        : {};
      const normalizedTargetId = String(targetId || '').trim().toLowerCase();
      const dualUploadEnabled = normalizedTargetId === 'sub2api' && Boolean(
        hasOwn(state, 'grokSub2apiGrok2ApiUploadEnabled')
          ? state.grokSub2apiGrok2ApiUploadEnabled
          : sub2apiConfig.grok2apiUploadEnabled
      );
      const targetIsGrok2Api = normalizedTargetId === 'grok2api';
      const baseUrl = cleanString(hasOwn(state, 'grok2ApiUrl')
        ? state.grok2ApiUrl
        : grok2ApiConfig.baseUrl);
      const apiKey = cleanString(hasOwn(state, 'grok2ApiAdminKey')
        ? state.grok2ApiAdminKey
        : grok2ApiConfig.apiKey);
      const missingFields = [];
      if (!baseUrl) missingFields.push('baseUrl');
      if (!apiKey) missingFields.push('apiKey');
      return {
        configComplete: missingFields.length === 0,
        dualUploadEnabled,
        missingFields,
        targetIsGrok2Api,
        uploadRequired: targetIsGrok2Api || dualUploadEnabled,
      };
    }

    function buildOpenAiWebchatValidationError(capabilityState = {}) {
      const webchatState = capabilityState.openaiWebchat || {};
      if (webchatState.targetIsWebchat) {
        return {
          code: 'openai_webchat_config_required',
          message: 'webchat 来源需要先完成地址和 Admin Key 配置。',
        };
      }
      return {
        code: 'openai_webchat_upload_config_required',
        message: '请选择 webchat 来源并完成配置后再开启同步。',
      };
    }

    function buildOpenAiChatgpt2ApiValidationError() {
      return {
        code: 'openai_chatgpt2api_config_required',
        message: 'ChatGPT2API source requires URL and Admin Key configuration.',
      };
    }

    function buildGrok2ApiValidationError() {
      return {
        code: 'grok2api_config_required',
        message: 'grok2api 上传需要先完成地址和 Admin Key 配置。',
      };
    }

    function getFlowCapabilities(flowId) {
      const normalizedFlowId = normalizeCapabilityFlowId(flowId, defaultFlowId);
      const entry = flowCapabilities[normalizedFlowId] || null;
      const registryAdapterIds = typeof contributionRegistryApi.getContributionAdapterIds === 'function'
        ? contributionRegistryApi.getContributionAdapterIds(normalizedFlowId)
        : [];
      const contributionAdapterIds = registryAdapterIds.length
        ? registryAdapterIds
        : (Array.isArray(entry?.contributionAdapterIds)
          ? entry.contributionAdapterIds.map((value) => String(value || '').trim()).filter(Boolean)
          : []);
      const supportedTargetIds = normalizedFlowId === 'openai'
        ? normalizeOpenAiTargetList(
          entry?.supportedTargetIds || defaultFlowCapabilities.supportedTargetIds
        )
        : (Array.isArray(entry?.supportedTargetIds)
          ? entry.supportedTargetIds.map((value) => String(value || '').trim().toLowerCase()).filter(Boolean)
          : []);
      return {
        ...defaultFlowCapabilities,
        ...(entry || {}),
        supportedTargetIds,
        contributionAdapterIds,
        supportsAccountContribution: Boolean(entry?.supportsAccountContribution || contributionAdapterIds.length > 0),
      };
    }

    function getOpenAiTargetCapabilities(targetId) {
      const normalizedTargetId = normalizeOpenAiTargetId(targetId);
      return {
        ...defaultTargetCapabilities,
        ...(targetCapabilities[normalizedTargetId] || {}),
      };
    }

    function normalizeRequestedTargetId(activeFlowId, state = {}, options = {}) {
      const schemaTargetId = settingsSchema?.getSelectedTargetId
        ? settingsSchema.getSelectedTargetId({
          ...state,
          activeFlowId,
        }, activeFlowId)
        : '';
      const rawTargetId = options?.targetId
        ?? options?.selectedTargetId
        ?? state?.targetId
        ?? schemaTargetId
        ?? flowRegistryApi.getDefaultTargetId?.(activeFlowId)
        ?? '';

      if (
        isRegisteredFlowId(activeFlowId)
        && typeof flowRegistryApi.normalizeTargetId === 'function'
      ) {
        return flowRegistryApi.normalizeTargetId(
          activeFlowId,
          rawTargetId,
          flowRegistryApi.getDefaultTargetId?.(activeFlowId)
        );
      }

      return String(rawTargetId || '').trim().toLowerCase();
    }

    function normalizeChangedKeys(values = []) {
      const list = Array.isArray(values) ? values : [];
      const seen = new Set();
      const normalized = [];
      list.forEach((value) => {
        const key = String(value || '').trim();
        if (!key || seen.has(key)) {
          return;
        }
        seen.add(key);
        normalized.push(key);
      });
      return normalized;
    }

    function resolveEffectiveTargetId(activeFlowId, state = {}, requestedTargetId = DEFAULT_OPENAI_TARGET_ID) {
      return normalizeRequestedTargetId(activeFlowId, state, {
        targetId: requestedTargetId,
      });
    }

    function resolveSidepanelCapabilities(options = {}) {
      const state = options?.state || {};
      const activeFlowId = normalizeCapabilityFlowId(
        options?.activeFlowId ?? state?.activeFlowId,
        defaultFlowId
      );
      const flowState = getFlowCapabilities(activeFlowId);
      const requestedTargetId = normalizeRequestedTargetId(
        activeFlowId,
        state,
        options
      );
      const supportedTargetIds = activeFlowId === 'openai'
        ? normalizeOpenAiTargetList(flowState.supportedTargetIds)
        : (Array.isArray(flowState.supportedTargetIds)
          ? flowState.supportedTargetIds.slice()
          : []);
      const targetSupported = supportedTargetIds.length === 0
        ? true
        : supportedTargetIds.includes(requestedTargetId);
      const effectiveTargetId = targetSupported
        ? requestedTargetId
        : (supportedTargetIds[0] || requestedTargetId);
      const targetState = activeFlowId === 'openai'
        ? getOpenAiTargetCapabilities(effectiveTargetId)
        : defaultTargetCapabilities;
      const canShowPhoneSettings = activeFlowId === 'openai'
        && Boolean(flowState.supportsPhoneVerificationSettings)
        && targetState.supportsPhoneVerificationSettings !== false;
      const runtimeLocks = {
        autoRunLocked: Boolean(options?.autoRunLocked ?? state?.autoRunLocked),
        accountContribution: Boolean(flowState.supportsAccountContribution) && Boolean(state?.accountContributionEnabled),
        plusModeEnabled: activeFlowId === 'openai' && flowState.supportsPlusMode && Boolean(state?.plusModeEnabled),
        settingsMenuLocked: Boolean(options?.settingsMenuLocked ?? state?.settingsMenuLocked),
      };
      const effectiveSignupMethods = [];
      if (flowState.supportsEmailSignup !== false) {
        effectiveSignupMethods.push(SIGNUP_METHOD_EMAIL);
      }
      const canSelectPhoneSignup = activeFlowId === 'openai'
        && Boolean(flowState.supportsPhoneSignup)
        && Boolean(targetState.supportsPhoneSignup)
        && canShowPhoneSettings
        && !runtimeLocks.plusModeEnabled
        && !runtimeLocks.accountContribution;
      if (canSelectPhoneSignup) {
        effectiveSignupMethods.push(SIGNUP_METHOD_PHONE);
      }
      if (!effectiveSignupMethods.length) {
        effectiveSignupMethods.push(SIGNUP_METHOD_EMAIL);
      }
      const requestedSignupMethod = normalizeSignupMethod(
        options?.signupMethod ?? state?.signupMethod
      );
      const effectiveSignupMethod = requestedSignupMethod === SIGNUP_METHOD_PHONE && canSelectPhoneSignup
        ? SIGNUP_METHOD_PHONE
        : (effectiveSignupMethods.includes(SIGNUP_METHOD_EMAIL)
          ? SIGNUP_METHOD_EMAIL
          : effectiveSignupMethods[0]);
      const openAiFlowSettings = activeFlowId === 'openai'
        ? getOpenAiFlowSettingsFromState(state)
        : {};
      const targetAccountDeliveryModes = normalizeAccountDeliveryModeList(
        targetState.supportedAccountDeliveryModes,
        [ACCOUNT_DELIVERY_MODE_OAUTH]
      );
      const defaultAccountDeliveryMode = targetAccountDeliveryModes.includes(
        normalizeAccountDeliveryMode(targetState.defaultAccountDeliveryMode, targetAccountDeliveryModes[0])
      )
        ? normalizeAccountDeliveryMode(targetState.defaultAccountDeliveryMode, targetAccountDeliveryModes[0])
        : targetAccountDeliveryModes[0];
      const requestedAccountDeliveryMode = normalizeAccountDeliveryMode(
        options?.accountDeliveryMode
        ?? state?.settingsState?.flows?.openai?.targets?.[effectiveTargetId]?.accountDeliveryMode
        ?? state?.flows?.openai?.targets?.[effectiveTargetId]?.accountDeliveryMode
        ?? state?.accountDeliveryMode
        ?? openAiFlowSettings?.targets?.[effectiveTargetId]?.accountDeliveryMode,
        defaultAccountDeliveryMode
      );
      const availableAccountDeliveryModes = activeFlowId === 'openai'
        ? (runtimeLocks.accountContribution
          ? [ACCOUNT_DELIVERY_MODE_OAUTH]
          : targetAccountDeliveryModes)
        : [ACCOUNT_DELIVERY_MODE_OAUTH];
      const effectiveAccountDeliveryMode = availableAccountDeliveryModes.includes(requestedAccountDeliveryMode)
        ? requestedAccountDeliveryMode
        : (availableAccountDeliveryModes.includes(defaultAccountDeliveryMode)
          ? defaultAccountDeliveryMode
          : availableAccountDeliveryModes[0]);
      const accountDeliveryRouteByMode = isPlainObject(targetState.accountDeliveryRouteByMode)
        ? targetState.accountDeliveryRouteByMode
        : DEFAULT_TARGET_CAPABILITIES.accountDeliveryRouteByMode;
      const effectiveAccountDeliveryRouteId = cleanString(
        accountDeliveryRouteByMode[effectiveAccountDeliveryMode]
        || (effectiveAccountDeliveryMode === ACCOUNT_DELIVERY_MODE_OAUTH ? 'oauth' : '')
      );
      const canShowAccountDeliveryControl = activeFlowId === 'openai'
        && !runtimeLocks.accountContribution
        && availableAccountDeliveryModes.length > 1;
      const canEditAccountDeliveryMode = canShowAccountDeliveryControl
        && !runtimeLocks.autoRunLocked
        && !runtimeLocks.settingsMenuLocked;
      const visibleGroupIds = typeof flowRegistryApi.getVisibleGroupIds === 'function'
        && isRegisteredFlowId(activeFlowId)
        ? flowRegistryApi.getVisibleGroupIds(activeFlowId, effectiveTargetId)
        : [];
      const openaiWebchat = activeFlowId === 'openai'
        ? resolveOpenAiWebchatState(state, effectiveTargetId)
        : {
          additionalUploadEnabled: false,
          configComplete: true,
          missingFields: [],
          targetIsWebchat: false,
          uploadEnabled: false,
          uploadRequired: false,
        };
      const openaiChatgpt2Api = activeFlowId === 'openai'
        ? resolveOpenAiChatgpt2ApiState(state, effectiveTargetId)
        : {
          configComplete: true,
          missingFields: [],
          targetIsChatgpt2Api: false,
          uploadRequired: false,
        };
      const grok2Api = activeFlowId === 'grok'
        ? resolveGrok2ApiState(state, effectiveTargetId)
        : {
          configComplete: true,
          dualUploadEnabled: false,
          missingFields: [],
          targetIsGrok2Api: false,
          uploadRequired: false,
        };

      return {
        activeFlowId,
        canShowContributionMode: Boolean(flowState.supportsAccountContribution),
        canShowLuckmail: activeFlowId === 'openai' && Boolean(flowState.supportsLuckmail),
        canShowPhoneSettings,
        canShowPlusSettings: activeFlowId === 'openai' && Boolean(flowState.supportsPlusMode),
        canSwitchFlow: Boolean(flowState.canSwitchFlow),
        canEditAccountDeliveryMode,
        canShowAccountDeliveryControl,
        canSelectPhoneSignup: canSelectPhoneSignup,
        canUsePhoneSignup: canSelectPhoneSignup,
        canUseSelectedTarget: targetSupported,
        effectiveAccountDeliveryMode,
        effectiveAccountDeliveryRouteId,
        effectiveSignupMethod,
        effectiveSignupMethods,
        effectiveTargetId,
        flowCapabilities: flowState,
        openaiChatgpt2Api,
        openaiWebchat,
        grok2Api,
        panelCapabilities: targetState,
        requestedAccountDeliveryMode,
        requestedSignupMethod,
        requestedTargetId,
        runtimeLocks,
        availableAccountDeliveryModes,
        shouldWarnCpaPhoneSignup: effectiveSignupMethod === SIGNUP_METHOD_PHONE
          && Boolean(targetState.requiresPhoneSignupWarning),
        stepDefinitionOptions: {
          activeFlowId,
          accountDeliveryMode: effectiveAccountDeliveryMode,
          accountDeliveryRouteId: effectiveAccountDeliveryRouteId,
          targetId: effectiveTargetId,
          plusModeEnabled: runtimeLocks.plusModeEnabled,
          openaiChatgpt2ApiUploadEnabled: openaiChatgpt2Api.uploadRequired,
          openaiWebchatUploadEnabled: openaiWebchat.uploadRequired,
          grokSub2apiGrok2ApiUploadEnabled: grok2Api.dualUploadEnabled,
          signupMethod: effectiveSignupMethod,
        },
        supportedPanelModes: supportedTargetIds,
        supportedTargetIds,
        targetCapabilities: targetState,
        targetId: effectiveTargetId,
        visibleGroupIds,
      };
    }

    function buildPhoneSignupValidationError(capabilityState = {}) {
      const flowState = capabilityState.flowCapabilities || {};
      const targetState = capabilityState.targetCapabilities || {};
      const runtimeLocks = capabilityState.runtimeLocks || {};

      if (!flowState.supportsPhoneSignup) {
        return {
          code: 'phone_signup_flow_unsupported',
          message: '当前 flow 不支持手机号注册。',
        };
      }
      if (!targetState.supportsPhoneSignup) {
        return {
          code: 'phone_signup_panel_unsupported',
          message: `当前来源 ${getTargetLabel(capabilityState.activeFlowId, capabilityState.requestedTargetId)} 不支持手机号注册。`,
        };
      }
      if (runtimeLocks.plusModeEnabled) {
        return {
          code: 'phone_signup_plus_mode_locked',
          message: 'Plus 模式开启时不能使用手机号注册。',
        };
      }
      if (runtimeLocks.accountContribution) {
        return {
          code: 'phone_signup_contribution_mode_locked',
          message: '贡献模式开启时不能使用手机号注册。',
        };
      }
      return {
        code: 'phone_signup_unavailable',
        message: '当前设置暂不支持手机号注册。',
      };
    }

    function validateAutoRunStart(options = {}) {
      const state = options?.state || {};
      const capabilityState = resolveSidepanelCapabilities(options);
      const errors = [];

      if (
        Array.isArray(capabilityState.supportedTargetIds)
        && capabilityState.supportedTargetIds.length > 0
        && capabilityState.canUseSelectedTarget === false
      ) {
        errors.push({
          code: 'panel_mode_unsupported',
          message: `当前 flow 不支持 ${getTargetLabel(capabilityState.activeFlowId, capabilityState.requestedTargetId)} 来源。`,
        });
      }

      if (Boolean(state?.plusModeEnabled) && !capabilityState.flowCapabilities?.supportsPlusMode) {
        errors.push({
          code: 'plus_mode_unsupported',
          message: '当前 flow 不支持 Plus 模式。',
        });
      }

      if (Boolean(state?.accountContributionEnabled) && !capabilityState.flowCapabilities?.supportsAccountContribution) {
        errors.push({
          code: 'contribution_mode_unsupported',
          message: '当前 flow 不支持贡献模式。',
        });
      }

      if (
        capabilityState.requestedSignupMethod === SIGNUP_METHOD_PHONE
        && capabilityState.effectiveSignupMethod !== SIGNUP_METHOD_PHONE
      ) {
        errors.push(buildPhoneSignupValidationError(capabilityState));
      }

      if (
        capabilityState.activeFlowId === 'openai'
        && capabilityState.openaiWebchat?.uploadRequired
        && !capabilityState.openaiWebchat?.configComplete
      ) {
        errors.push(buildOpenAiWebchatValidationError(capabilityState));
      }
      if (
        capabilityState.activeFlowId === 'openai'
        && capabilityState.openaiChatgpt2Api?.uploadRequired
        && !capabilityState.openaiChatgpt2Api?.configComplete
      ) {
        errors.push(buildOpenAiChatgpt2ApiValidationError(capabilityState));
      }
      if (
        capabilityState.activeFlowId === 'grok'
        && capabilityState.grok2Api?.uploadRequired
        && !capabilityState.grok2Api?.configComplete
      ) {
        errors.push(buildGrok2ApiValidationError());
      }

      return {
        ok: errors.length === 0,
        errors,
        capabilityState,
      };
    }

    function validateModeSwitch(options = {}) {
      const state = options?.state || {};
      const changedKeys = normalizeChangedKeys(
        options?.changedKeys !== undefined
          ? options.changedKeys
          : Object.keys(state || {})
      );
      const changedKeySet = new Set(changedKeys);
      const capabilityState = resolveSidepanelCapabilities(options);
      const errors = [];
      const normalizedUpdates = {};
      const flowState = capabilityState.flowCapabilities || {};
      const requestedPhoneSignup = capabilityState.requestedSignupMethod === SIGNUP_METHOD_PHONE;
      const shouldReconcileSignupMethod = MODE_SWITCH_RELEVANT_KEYS.some((key) => changedKeySet.has(key));
      const shouldReconcileOpenAiWebchatUpload = capabilityState.activeFlowId === 'openai'
        && OPENAI_WEBCHAT_RELEVANT_KEYS.some((key) => changedKeySet.has(key));

      if (
        changedKeySet.has('targetId')
        && Array.isArray(capabilityState.supportedTargetIds)
        && capabilityState.supportedTargetIds.length > 0
        && capabilityState.canUseSelectedTarget === false
      ) {
        normalizedUpdates.targetId = capabilityState.effectiveTargetId;
        errors.push({
          code: 'panel_mode_unsupported',
          message: `当前 flow 不支持 ${getTargetLabel(capabilityState.activeFlowId, capabilityState.requestedTargetId)} 来源。`,
        });
      }

      if (
        capabilityState.activeFlowId === 'openai'
        && changedKeySet.has('accountDeliveryMode')
        && capabilityState.requestedAccountDeliveryMode !== capabilityState.effectiveAccountDeliveryMode
      ) {
        normalizedUpdates.accountDeliveryMode = capabilityState.effectiveAccountDeliveryMode;
        errors.push({
          code: 'account_delivery_mode_unsupported',
          message: `当前来源 ${getTargetLabel(capabilityState.activeFlowId, capabilityState.effectiveTargetId)} 不支持所选账号交付方式。`,
        });
      }

      if (changedKeySet.has('plusModeEnabled') && Boolean(state?.plusModeEnabled) && !flowState.supportsPlusMode) {
        normalizedUpdates.plusModeEnabled = false;
        errors.push({
          code: 'plus_mode_unsupported',
          message: '当前 flow 不支持 Plus 模式。',
        });
      }

      if (
        changedKeySet.has('accountContributionEnabled')
        && Boolean(state?.accountContributionEnabled)
        && !flowState.supportsAccountContribution
      ) {
        normalizedUpdates.accountContributionEnabled = false;
        errors.push({
          code: 'contribution_mode_unsupported',
          message: '当前 flow 不支持贡献模式。',
        });
      }

      if (
        shouldReconcileSignupMethod
        && requestedPhoneSignup
        && capabilityState.effectiveSignupMethod !== SIGNUP_METHOD_PHONE
      ) {
        normalizedUpdates.signupMethod = capabilityState.effectiveSignupMethod;
        errors.push(buildPhoneSignupValidationError(capabilityState));
      }

      if (
        shouldReconcileOpenAiWebchatUpload
        && capabilityState.openaiWebchat?.additionalUploadEnabled
        && !capabilityState.openaiWebchat?.configComplete
      ) {
        normalizedUpdates.openaiWebchatUploadEnabled = false;
        errors.push(buildOpenAiWebchatValidationError(capabilityState));
      }

      return {
        ok: errors.length === 0,
        changedKeys,
        capabilityState,
        errors,
        normalizedUpdates,
      };
    }

    function canUsePhoneSignup(state = {}) {
      return resolveSidepanelCapabilities({ state }).canUsePhoneSignup;
    }

    function resolveSignupMethod(state = {}, signupMethod = undefined) {
      return resolveSidepanelCapabilities({
        signupMethod,
        state,
      }).effectiveSignupMethod;
    }

    return {
      canUsePhoneSignup,
      getFlowCapabilities,
      getOpenAiTargetCapabilities,
      normalizeFlowId,
      normalizeOpenAiTargetId,
      normalizeSignupMethod,
      resolveSidepanelCapabilities,
      resolveSignupMethod,
      validateAutoRunStart,
      validateModeSwitch,
    };
  }

  return {
    createFlowCapabilityRegistry,
    DEFAULT_FLOW_CAPABILITIES,
    DEFAULT_FLOW_ID,
    DEFAULT_TARGET_CAPABILITIES,
    DEFAULT_OPENAI_TARGET_ID,
    FLOW_CAPABILITIES,
    OPENAI_TARGET_CAPABILITIES,
    ACCOUNT_DELIVERY_MODE_AGENT_IDENTITY,
    ACCOUNT_DELIVERY_MODE_IDS,
    ACCOUNT_DELIVERY_MODE_OAUTH,
    ACCOUNT_DELIVERY_MODE_SESSION,
    SIGNUP_METHOD_EMAIL,
    SIGNUP_METHOD_PHONE,
    VALID_OPENAI_TARGET_IDS,
    normalizeFlowId,
    normalizeAccountDeliveryMode,
    normalizeOpenAiTargetId,
    normalizeSignupMethod,
  };
});
