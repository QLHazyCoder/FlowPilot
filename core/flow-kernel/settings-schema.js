/*
 * @Author: QLHazycoder
 * @Date: 2026-07-22 00:00:00
 * @LastEditors: QLHazycoder
 * @LastEditTime: 2026-09-10 18:50:11
 * @Description: Normalize persisted FlowPilot settings and legacy view state.
 */
(function attachMultiPageSettingsSchema(root, factory) {
  root.MultiPageSettingsSchema = factory();
})(typeof self !== 'undefined' ? self : globalThis, function createSettingsSchemaModule() {
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

  function mergePlainObjects(baseValue = {}, patchValue = {}) {
    if (Array.isArray(patchValue)) {
      return patchValue.map((entry) => cloneValue(entry));
    }
    if (!isPlainObject(patchValue)) {
      return patchValue === undefined ? cloneValue(baseValue) : patchValue;
    }
    const baseObject = isPlainObject(baseValue) ? baseValue : {};
    const next = {
      ...cloneValue(baseObject),
    };
    Object.entries(patchValue).forEach(([key, value]) => {
      next[key] = mergePlainObjects(baseObject[key], value);
    });
    return next;
  }

  function normalizeStepExecutionRangeEntry(value = {}, fallback = {}) {
    const source = isPlainObject(value) ? value : {};
    const fallbackSource = isPlainObject(fallback) ? fallback : {};
    const fromStep = Math.max(1, Number(source.fromStep ?? fallbackSource.fromStep ?? 1) || 1);
    const toStep = Math.max(fromStep, Number(source.toStep ?? fallbackSource.toStep ?? fromStep) || fromStep);
    return {
      enabled: Boolean(source.enabled ?? fallbackSource.enabled),
      fromStep,
      toStep,
    };
  }

  function createSettingsSchema(deps = {}) {
    const rootScope = typeof self !== 'undefined' ? self : globalThis;
    const flowRegistry = deps.flowRegistry || rootScope.MultiPageFlowRegistry || {};
    const accountDeliveryApi = deps.accountDelivery || rootScope.MultiPageOpenAiAccountDelivery || {};
    const defaultFlowId = String(
      deps.defaultFlowId || flowRegistry.DEFAULT_FLOW_ID || 'openai'
    ).trim().toLowerCase() || 'openai';
    const defaultOpenAiTargetId = flowRegistry.DEFAULT_OPENAI_TARGET_ID || 'cpa';
    const defaultKiroTargetId = flowRegistry.DEFAULT_KIRO_TARGET_ID || 'kiro-rs';
    const defaultKiroRsUrl = String(flowRegistry.DEFAULT_KIRO_RS_URL || '').trim();
    const normalizeFlowId = typeof flowRegistry.normalizeFlowId === 'function'
      ? flowRegistry.normalizeFlowId
      : ((value = '', fallback = defaultFlowId) => {
        const normalized = String(value || '').trim().toLowerCase();
        return normalized || String(fallback || '').trim().toLowerCase() || defaultFlowId;
      });
    const normalizeTargetId = typeof flowRegistry.normalizeTargetId === 'function'
      ? flowRegistry.normalizeTargetId
      : ((_flowId, value = '', fallback = '') => String(value || fallback || '').trim().toLowerCase());
    const getRegisteredFlowIds = typeof flowRegistry.getRegisteredFlowIds === 'function'
      ? flowRegistry.getRegisteredFlowIds
      : (() => ['openai', 'kiro']);
    const getFlowDefinition = typeof flowRegistry.getFlowDefinition === 'function'
      ? flowRegistry.getFlowDefinition
      : (() => null);
    const getDefaultTargetId = typeof flowRegistry.getDefaultTargetId === 'function'
      ? flowRegistry.getDefaultTargetId
      : ((flowId) => (flowId === 'kiro' ? defaultKiroTargetId : defaultOpenAiTargetId));
    const getTargetDefinitions = typeof flowRegistry.getTargetDefinitions === 'function'
      ? flowRegistry.getTargetDefinitions
      : (() => ({}));
    const getTargetCapabilities = typeof flowRegistry.getTargetCapabilities === 'function'
      ? flowRegistry.getTargetCapabilities
      : ((_flowId, targetId) => getTargetDefinitions('openai')?.[targetId]?.capabilities || {});
    const legacyMigrationStorageKeys = Object.freeze([
      'plusAccountAccessStrategy',
      'sub2apiImportMode',
    ]);

    function removeLegacyAccountDeliveryFields(value = {}) {
      const next = isPlainObject(value) ? cloneValue(value) : {};
      legacyMigrationStorageKeys.forEach((key) => {
        delete next[key];
      });
      return next;
    }

    const normalizePlusPaymentMethod = (value = '') => {
      const normalized = String(value || '').trim().toLowerCase();
      if (normalized === 'paypal-hosted') {
        return 'paypal-hosted';
      }
      if (normalized === 'none') {
        return 'none';
      }
      return 'paypal';
    };

    function getSupportedAccountDeliveryModes(targetId = '') {
      const capabilities = getTargetCapabilities('openai', targetId) || {};
      const values = Array.isArray(capabilities.supportedAccountDeliveryModes)
        ? capabilities.supportedAccountDeliveryModes
        : ['oauth'];
      const seen = new Set();
      const modes = values
        .map((value) => String(value || '').trim().toLowerCase())
        .filter((value) => {
          if (!value || seen.has(value)) {
            return false;
          }
          if (
            typeof accountDeliveryApi.isAccountDeliveryMode === 'function'
            && !accountDeliveryApi.isAccountDeliveryMode(value)
          ) {
            return false;
          }
          seen.add(value);
          return true;
        });
      return modes.length ? modes : ['oauth'];
    }

    function getDefaultAccountDeliveryMode(targetId = '') {
      const supportedModes = getSupportedAccountDeliveryModes(targetId);
      const configuredDefault = String(
        getTargetCapabilities('openai', targetId)?.defaultAccountDeliveryMode || ''
      ).trim().toLowerCase();
      return supportedModes.includes(configuredDefault)
        ? configuredDefault
        : supportedModes[0];
    }

    function normalizeAccountDeliveryModeForTarget(targetId = '', value = '') {
      const supportedModes = getSupportedAccountDeliveryModes(targetId);
      const normalized = String(value || '').trim().toLowerCase();
      return supportedModes.includes(normalized)
        ? normalized
        : getDefaultAccountDeliveryMode(targetId);
    }

    function getOwnValue(source = {}, key = '') {
      return isPlainObject(source) && Object.prototype.hasOwnProperty.call(source, key)
        ? source[key]
        : undefined;
    }

    function resolveLegacyAccountDeliveryMode(targetId = '', input = {}, nested = {}, currentFlow = {}) {
      const nestedOpenAi = isPlainObject(nested?.flows?.openai) ? nested.flows.openai : {};
      const nestedTarget = isPlainObject(nestedOpenAi?.targets?.[targetId])
        ? nestedOpenAi.targets[targetId]
        : {};
      const selectedTargetId = normalizeTargetId(
        'openai',
        currentFlow?.selectedTargetId,
        defaultOpenAiTargetId
      );
      const canonicalValue = getOwnValue(nestedTarget, 'accountDeliveryMode')
        ?? (selectedTargetId === targetId ? getOwnValue(input, 'accountDeliveryMode') : undefined);
      if (canonicalValue !== undefined) {
        return normalizeAccountDeliveryModeForTarget(targetId, canonicalValue);
      }

      const legacyImportMode = getOwnValue(input, 'sub2apiImportMode')
        ?? getOwnValue(nestedOpenAi, 'sub2apiImportMode')
        ?? getOwnValue(nestedOpenAi.plus, 'sub2apiImportMode');
      if (legacyImportMode !== undefined) {
        return targetId === 'sub2api'
          && String(legacyImportMode || '').trim().toLowerCase() === 'agent_identity'
          ? normalizeAccountDeliveryModeForTarget(targetId, 'agent_identity')
          : getDefaultAccountDeliveryMode(targetId);
      }

      const legacyStrategy = getOwnValue(input, 'plusAccountAccessStrategy')
        ?? getOwnValue(nestedOpenAi, 'plusAccountAccessStrategy')
        ?? getOwnValue(nestedOpenAi.plus, 'plusAccountAccessStrategy');
      if (legacyStrategy !== undefined) {
        const normalizedStrategy = String(legacyStrategy || '').trim().toLowerCase();
        if (targetId === 'sub2api' && normalizedStrategy === 'sub2api_codex_session') {
          return normalizeAccountDeliveryModeForTarget(targetId, 'session');
        }
        if (targetId === 'cpa' && normalizedStrategy === 'cpa_codex_session') {
          return normalizeAccountDeliveryModeForTarget(targetId, 'session');
        }
        return getDefaultAccountDeliveryMode(targetId);
      }

      return getDefaultAccountDeliveryMode(targetId);
    }

    function getLegacyMigrationStorageKeys() {
      return [...legacyMigrationStorageKeys];
    }

    const normalizeCustomMailHelperBaseUrl = (value = '') => {
      const fallback = 'http://127.0.0.1:17374';
      const trimmed = String(value || '').trim();
      const candidate = trimmed || fallback;
      try {
        const parsed = new URL(candidate);
        if (!['http:', 'https:'].includes(parsed.protocol)) {
          return fallback;
        }
        parsed.hash = '';
        parsed.search = '';
        parsed.pathname = parsed.pathname.replace(/\/+$/, '');
        const path = parsed.pathname === '/' ? '' : parsed.pathname;
        return `${parsed.origin}${path}` || fallback;
      } catch {
        return fallback;
      }
    };

    function getCanonicalFlowIds() {
      const ids = Array.isArray(getRegisteredFlowIds())
        ? getRegisteredFlowIds()
        : [];
      const seen = new Set();
      return ids
        .map((flowId) => normalizeFlowId(flowId, defaultFlowId))
        .filter((flowId) => {
          if (!flowId || seen.has(flowId)) {
            return false;
          }
          seen.add(flowId);
          return true;
        });
    }

    function getFlowSettingsDefaults(flowId) {
      const definition = getFlowDefinition(flowId) || {};
      return isPlainObject(definition.settingsDefaults) ? definition.settingsDefaults : {};
    }

    function getDefaultStepExecutionRange(flowId) {
      const flowDefaults = getFlowSettingsDefaults(flowId);
      const range = flowDefaults?.autoRun?.stepExecutionRange;
      if (isPlainObject(range)) {
        return normalizeStepExecutionRangeEntry(range, { enabled: false, fromStep: 1, toStep: 1 });
      }
      const lastStep = Math.max(1, Number(getFlowDefinition(flowId)?.workflowStepCount) || 1);
      return { enabled: false, fromStep: 1, toStep: lastStep };
    }

    function buildDefaultTargetState(flowId, targetId) {
      const definition = getFlowDefinition(flowId) || {};
      const flowDefaults = getFlowSettingsDefaults(flowId);
      const targetDefaults = isPlainObject(flowDefaults?.targets?.[targetId])
        ? flowDefaults.targets[targetId]
        : {};
      const sharedTargetDefaults = isPlainObject(definition.defaultTargetState)
        ? definition.defaultTargetState
        : {};
      const targetDefinition = isPlainObject(getTargetDefinitions(flowId)?.[targetId])
        ? getTargetDefinitions(flowId)[targetId]
        : {};
      const targetDefinitionDefaults = isPlainObject(targetDefinition.defaultState)
        ? targetDefinition.defaultState
        : {};
      return mergePlainObjects(
        mergePlainObjects(sharedTargetDefaults, targetDefinitionDefaults),
        targetDefaults
      );
    }

    function buildDefaultTargets(flowId) {
      const targetDefinitions = getTargetDefinitions(flowId) || {};
      const targetIds = Object.keys(targetDefinitions);
      const defaults = {};
      targetIds.forEach((targetId) => {
        defaults[targetId] = buildDefaultTargetState(flowId, targetId);
      });
      return defaults;
    }

    function buildDefaultFlowSettings(flowId) {
      const defaultTargetId = normalizeTargetId(
        flowId,
        getDefaultTargetId(flowId),
        flowId === 'kiro' ? defaultKiroTargetId : defaultOpenAiTargetId
      );
      const base = {
        selectedTargetId: defaultTargetId,
        targets: buildDefaultTargets(flowId),
        autoRun: {
          stepExecutionRange: getDefaultStepExecutionRange(flowId),
        },
      };
      return mergePlainObjects(base, getFlowSettingsDefaults(flowId));
    }

    function buildDefaultFlows() {
      const flows = {};
      getCanonicalFlowIds().forEach((flowId) => {
        flows[flowId] = buildDefaultFlowSettings(flowId);
      });
      return flows;
    }

    function buildDefaultSettingsState() {
      return {
        schemaVersion: 6,
        activeFlowId: defaultFlowId,
        ui: {
          language: 'auto',
        },
        services: {
          account: {
            customPassword: '',
          },
          email: {
            provider: '163',
            customReceiveMode: 'manual',
            customHelperBaseUrl: 'http://127.0.0.1:17374',
          },
          proxy: {
            enabled: false,
            provider: '711proxy',
            mode: 'account',
          },
        },
        flows: buildDefaultFlows(),
      };
    }

    function getTargetValue(settingsState, pathGetter, legacyPathGetter = null, fallback = {}) {
      const sourceState = isPlainObject(settingsState) ? settingsState : {};
      const resolvedValue = pathGetter(sourceState)
        || (typeof legacyPathGetter === 'function' ? legacyPathGetter(sourceState) : null)
        || fallback;
      return cloneValue(resolvedValue);
    }

    function cleanSharedWebchatField(value = '') {
      return String(value ?? '').trim();
    }

    function getOwnCleanField(source = {}, key = '') {
      return isPlainObject(source) && Object.prototype.hasOwnProperty.call(source, key)
        ? cleanSharedWebchatField(source[key])
        : undefined;
    }

    function getNonEmptyCleanField(source = {}, key = '') {
      const value = cleanSharedWebchatField(isPlainObject(source) ? source[key] : '');
      return value ? value : undefined;
    }

    function resolveSharedWebchatConfig(input = {}, nested = {}, openAiFlow = {}, grokFlow = {}) {
      const activeFlowId = normalizeFlowId(
        input?.activeFlowId ?? nested?.activeFlowId ?? defaultFlowId,
        defaultFlowId
      );
      const preferGrokInput = activeFlowId === 'grok';
      const openAiTarget = isPlainObject(openAiFlow?.targets?.webchat)
        ? openAiFlow.targets.webchat
        : {};
      const grokTarget = isPlainObject(grokFlow?.targets?.webchat2api)
        ? grokFlow.targets.webchat2api
        : {};
      const openAiLegacyTarget = getTargetValue(
        nested,
        (state) => state.flows?.openai?.integrationTargets?.webchat,
        null,
        {}
      );
      const grokLegacyTarget = getTargetValue(
        nested,
        (state) => state.flows?.grok?.integrationTargets?.webchat2api,
        null,
        {}
      );
      const pick = (openAiInputKey, grokInputKey, targetKey) => {
        const explicitValues = preferGrokInput
          ? [
            getOwnCleanField(input, grokInputKey),
            getOwnCleanField(input, openAiInputKey),
          ]
          : [
            getOwnCleanField(input, openAiInputKey),
            getOwnCleanField(input, grokInputKey),
          ];
        return [
          ...explicitValues,
          getNonEmptyCleanField(openAiTarget, targetKey),
          getNonEmptyCleanField(grokTarget, targetKey),
          getNonEmptyCleanField(openAiLegacyTarget, targetKey),
          getNonEmptyCleanField(grokLegacyTarget, targetKey),
        ].find((value) => value !== undefined) || '';
      };
      return {
        baseUrl: pick('openaiWebchatUrl', 'grokWebchat2ApiUrl', 'baseUrl'),
        apiKey: pick('openaiWebchatAdminKey', 'grokWebchat2ApiAdminKey', 'apiKey'),
      };
    }

    function resolveSharedSub2ApiCredentials(input = {}, nested = {}, openAiFlow = {}, grokFlow = {}) {
      const openAiTarget = isPlainObject(openAiFlow?.targets?.sub2api)
        ? openAiFlow.targets.sub2api
        : {};
      const grokTarget = isPlainObject(grokFlow?.targets?.sub2api)
        ? grokFlow.targets.sub2api
        : {};
      const openAiLegacyTarget = getTargetValue(
        nested,
        (state) => state.flows?.openai?.integrationTargets?.sub2api,
        null,
        {}
      );
      const normalizeValue = (value, trim = true) => trim
        ? String(value ?? '').trim()
        : String(value ?? '');
      const pick = (key, trim = true) => {
        if (Object.prototype.hasOwnProperty.call(input || {}, key)) {
          return normalizeValue(input[key], trim);
        }
        return [openAiTarget, grokTarget, openAiLegacyTarget]
          .map((source) => normalizeValue(source?.[key], trim))
          .find(Boolean) || '';
      };
      return {
        sub2apiUrl: pick('sub2apiUrl'),
        sub2apiEmail: pick('sub2apiEmail'),
        sub2apiPassword: pick('sub2apiPassword', false),
      };
    }

    function normalizeFlowTargetState(flowId, targetId, nested = {}, defaults = {}) {
      const mergedTargetState = mergePlainObjects(defaults, nested);
      const targetState = flowId === 'openai'
        ? removeLegacyAccountDeliveryFields(mergedTargetState)
        : mergedTargetState;
      if (flowId === 'openai' && targetId === 'cpa') {
        return {
          ...targetState,
          vpsUrl: String(targetState.vpsUrl ?? '').trim(),
          vpsPassword: String(targetState.vpsPassword ?? ''),
          localCpaStep9Mode: String(targetState.localCpaStep9Mode ?? 'submit').trim() || 'submit',
        };
      }
      if (flowId === 'openai' && targetId === 'sub2api') {
        return {
          ...targetState,
          sub2apiUrl: String(targetState.sub2apiUrl ?? '').trim(),
          sub2apiEmail: String(targetState.sub2apiEmail ?? '').trim(),
          sub2apiPassword: String(targetState.sub2apiPassword ?? ''),
          sub2apiGroupName: String(targetState.sub2apiGroupName ?? 'codex').trim() || 'codex',
          sub2apiGroupNames: Array.isArray(targetState.sub2apiGroupNames)
            ? targetState.sub2apiGroupNames.map((entry) => String(entry || '').trim()).filter(Boolean)
            : ['codex', 'openai-plus'],
          sub2apiAccountPriority: Math.max(1, Number(targetState.sub2apiAccountPriority) || 1),
          sub2apiDefaultProxyName: String(targetState.sub2apiDefaultProxyName ?? '').trim(),
        };
      }
      if (flowId === 'openai' && targetId === 'codex2api') {
        return {
          ...targetState,
          codex2apiUrl: String(targetState.codex2apiUrl ?? '').trim(),
          codex2apiAdminKey: String(targetState.codex2apiAdminKey ?? '').trim(),
        };
      }
      if (flowId === 'openai' && (targetId === 'webchat' || targetId === 'chatgpt2api')) {
        return {
          ...targetState,
          baseUrl: String(targetState.baseUrl ?? '').trim(),
          apiKey: String(targetState.apiKey ?? '').trim(),
        };
      }
      if (flowId === 'kiro' && targetId === 'kiro-rs') {
        return {
          ...targetState,
          baseUrl: String(targetState.baseUrl ?? defaultKiroRsUrl).trim() || defaultKiroRsUrl,
          apiKey: String(targetState.apiKey ?? ''),
        };
      }
      if (flowId === 'grok' && (targetId === 'webchat2api' || targetId === 'grok2api')) {
        return {
          ...targetState,
          baseUrl: String(targetState.baseUrl ?? '').trim(),
          apiKey: String(targetState.apiKey ?? '').trim(),
        };
      }
      if (flowId === 'grok' && targetId === 'sub2api') {
        const {
          webchat2apiUploadEnabled: legacyWebchat2ApiUploadEnabled,
          ...currentTargetState
        } = targetState;
        return {
          ...currentTargetState,
          sub2apiUrl: String(targetState.sub2apiUrl ?? '').trim(),
          sub2apiEmail: String(targetState.sub2apiEmail ?? '').trim(),
          sub2apiPassword: String(targetState.sub2apiPassword ?? ''),
          sub2apiGroupName: String(targetState.sub2apiGroupName ?? '').trim(),
          sub2apiGroupNames: Array.isArray(targetState.sub2apiGroupNames)
            ? targetState.sub2apiGroupNames.map((entry) => String(entry || '').trim()).filter(Boolean)
            : [],
          sub2apiAccountPriority: Math.max(1, Number(targetState.sub2apiAccountPriority) || 1),
          sub2apiDefaultProxyName: String(targetState.sub2apiDefaultProxyName ?? '').trim(),
          grok2apiUploadEnabled: Boolean(
            targetState.grok2apiUploadEnabled
            ?? legacyWebchat2ApiUploadEnabled
          ),
        };
      }
      return targetState;
    }

    function buildNormalizedTargets(flowId, nestedFlow = {}, defaultFlow = {}) {
      const targetIds = Array.from(new Set([
        ...Object.keys(defaultFlow.targets || {}),
        ...Object.keys(isPlainObject(nestedFlow.targets) ? nestedFlow.targets : {}),
        ...Object.keys(getTargetDefinitions(flowId) || {}),
      ]));
      const targets = {};
      targetIds.forEach((targetId) => {
        targets[targetId] = normalizeFlowTargetState(
          flowId,
          targetId,
          isPlainObject(nestedFlow.targets?.[targetId]) ? nestedFlow.targets[targetId] : {},
          defaultFlow.targets?.[targetId] || buildDefaultTargetState(flowId, targetId)
        );
      });
      return targets;
    }

    function normalizeFlowSettings(flowId, input = {}, nested = {}, defaults = {}) {
      const nestedFlow = isPlainObject(nested?.flows?.[flowId]) ? nested.flows[flowId] : {};
      const activeFlowId = normalizeFlowId(
        input?.activeFlowId
        ?? nested?.activeFlowId
        ?? defaults.activeFlowId,
        defaults.activeFlowId
      );
      const mergedFlowState = mergePlainObjects(
        defaults.flows?.[flowId] || buildDefaultFlowSettings(flowId),
        nestedFlow
      );
      const mergedFlow = flowId === 'openai'
        ? removeLegacyAccountDeliveryFields(mergedFlowState)
        : mergedFlowState;
      const defaultTargetId = defaults.flows?.[flowId]?.selectedTargetId || getDefaultTargetId(flowId);
      const selectedTargetId = normalizeTargetId(
        flowId,
        nestedFlow?.selectedTargetId
          ?? nestedFlow?.targetId
          ?? (flowId === 'openai' ? nestedFlow?.integrationTargetId : undefined)
          ?? (activeFlowId === flowId ? (input?.selectedTargetId ?? input?.targetId) : undefined)
          ?? defaultTargetId,
        defaultTargetId
      );
      const stepExecutionRangeByFlow = isPlainObject(input?.stepExecutionRangeByFlow)
        ? input.stepExecutionRangeByFlow
        : {};
      const autoRun = {
        ...(isPlainObject(mergedFlow.autoRun) ? mergedFlow.autoRun : {}),
        stepExecutionRange: normalizeStepExecutionRangeEntry(
          stepExecutionRangeByFlow[flowId]
            ?? nestedFlow?.autoRun?.stepExecutionRange
            ?? {},
          defaults.flows?.[flowId]?.autoRun?.stepExecutionRange || getDefaultStepExecutionRange(flowId)
        ),
      };

      return {
        ...mergedFlow,
        selectedTargetId,
        targets: buildNormalizedTargets(flowId, nestedFlow, defaults.flows?.[flowId] || {}),
        autoRun,
      };
    }

    function normalizeOpenAiSettings(input = {}, nested = {}, defaults = {}, currentFlow = {}, grokFlow = {}) {
      const defaultOpenAiFlow = isPlainObject(defaults?.flows?.openai)
        ? defaults.flows.openai
        : {};
      const defaultOpenAiTargets = isPlainObject(defaultOpenAiFlow.targets)
        ? defaultOpenAiFlow.targets
        : {};
      const defaultOpenAiSignup = isPlainObject(defaultOpenAiFlow.signup)
        ? defaultOpenAiFlow.signup
        : {};
      const defaultOpenAiPlus = isPlainObject(defaultOpenAiFlow.plus)
        ? defaultOpenAiFlow.plus
        : {};
      const sharedSub2ApiCredentials = resolveSharedSub2ApiCredentials(input, nested, currentFlow, grokFlow);
      const cpaSource = {
        ...currentFlow.targets.cpa,
        ...getTargetValue(
          nested,
          (state) => state.flows?.openai?.integrationTargets?.cpa,
          null,
          {}
        ),
        vpsUrl: input?.vpsUrl ?? currentFlow.targets.cpa.vpsUrl,
        vpsPassword: input?.vpsPassword ?? currentFlow.targets.cpa.vpsPassword,
        localCpaStep9Mode: input?.localCpaStep9Mode ?? currentFlow.targets.cpa.localCpaStep9Mode,
      };
      const sub2apiSource = {
        ...currentFlow.targets.sub2api,
        ...getTargetValue(
          nested,
          (state) => state.flows?.openai?.integrationTargets?.sub2api,
          null,
          {}
        ),
        ...sharedSub2ApiCredentials,
        sub2apiGroupName: input?.sub2apiGroupName ?? currentFlow.targets.sub2api.sub2apiGroupName,
        sub2apiGroupNames: input?.sub2apiGroupNames ?? currentFlow.targets.sub2api.sub2apiGroupNames,
        sub2apiAccountPriority: input?.sub2apiAccountPriority ?? currentFlow.targets.sub2api.sub2apiAccountPriority,
        sub2apiDefaultProxyName: input?.sub2apiDefaultProxyName ?? currentFlow.targets.sub2api.sub2apiDefaultProxyName,
      };
      const codex2apiSource = {
        ...currentFlow.targets.codex2api,
        ...getTargetValue(
          nested,
          (state) => state.flows?.openai?.integrationTargets?.codex2api,
          null,
          {}
        ),
        codex2apiUrl: input?.codex2apiUrl ?? currentFlow.targets.codex2api.codex2apiUrl,
        codex2apiAdminKey: input?.codex2apiAdminKey ?? currentFlow.targets.codex2api.codex2apiAdminKey,
      };
      const sharedWebchatConfig = resolveSharedWebchatConfig(input, nested, currentFlow, grokFlow);
      const webchatSource = {
        ...currentFlow.targets.webchat,
        ...getTargetValue(
          nested,
          (state) => state.flows?.openai?.integrationTargets?.webchat,
          null,
          {}
        ),
        baseUrl: sharedWebchatConfig.baseUrl,
        apiKey: sharedWebchatConfig.apiKey,
      };
      const chatgpt2ApiCurrent = isPlainObject(currentFlow.targets.chatgpt2api)
        ? currentFlow.targets.chatgpt2api
        : {};
      const chatgpt2ApiSource = {
        ...chatgpt2ApiCurrent,
        ...getTargetValue(
          nested,
          (state) => state.flows?.openai?.integrationTargets?.chatgpt2api,
          null,
          {}
        ),
        baseUrl: input?.openaiChatgpt2ApiUrl ?? chatgpt2ApiCurrent.baseUrl,
        apiKey: input?.openaiChatgpt2ApiAdminKey ?? chatgpt2ApiCurrent.apiKey,
      };
      const targetSources = {
        cpa: cpaSource,
        sub2api: sub2apiSource,
        codex2api: codex2apiSource,
        webchat: webchatSource,
        chatgpt2api: chatgpt2ApiSource,
      };
      const targets = {
        ...currentFlow.targets,
      };
      Object.entries(targetSources).forEach(([targetId, source]) => {
        targets[targetId] = {
          ...normalizeFlowTargetState(
            'openai',
            targetId,
            source,
            defaultOpenAiTargets[targetId] || {}
          ),
          accountDeliveryMode: resolveLegacyAccountDeliveryMode(
            targetId,
            input,
            nested,
            currentFlow
          ),
        };
      });
      return {
        ...currentFlow,
        targets,
        signup: {
          signupMethod: String(
            input?.signupMethod
            ?? currentFlow.signup?.signupMethod
            ?? defaultOpenAiSignup.signupMethod
            ?? 'email'
          ).trim().toLowerCase() === 'phone' ? 'phone' : 'email',
          phoneSignupReloginAfterBindEmailEnabled: Boolean(
            input?.phoneSignupReloginAfterBindEmailEnabled
            ?? currentFlow.signup?.phoneSignupReloginAfterBindEmailEnabled
            ?? defaultOpenAiSignup.phoneSignupReloginAfterBindEmailEnabled
            ?? false
          ),
        },
        plus: {
          plusModeEnabled: false,
          plusPaymentMethod: normalizePlusPaymentMethod(
            input?.plusPaymentMethod
            ?? currentFlow.plus?.plusPaymentMethod
            ?? defaultOpenAiPlus.plusPaymentMethod
            ?? 'paypal'
          ),
          hostedCheckoutVerificationUrl: String(
            input?.hostedCheckoutVerificationUrl
            ?? currentFlow.plus?.hostedCheckoutVerificationUrl
            ?? defaultOpenAiPlus.hostedCheckoutVerificationUrl
            ?? ''
          ).trim(),
          hostedCheckoutPhoneNumber: String(
            input?.hostedCheckoutPhoneNumber
            ?? currentFlow.plus?.hostedCheckoutPhoneNumber
            ?? defaultOpenAiPlus.hostedCheckoutPhoneNumber
            ?? ''
          ).trim(),
          plusHostedCheckoutOauthDelaySeconds: (() => {
            const numeric = Number(
              input?.plusHostedCheckoutOauthDelaySeconds
              ?? currentFlow.plus?.plusHostedCheckoutOauthDelaySeconds
              ?? defaultOpenAiPlus.plusHostedCheckoutOauthDelaySeconds
              ?? 3
            );
            const fallback = Number(defaultOpenAiPlus.plusHostedCheckoutOauthDelaySeconds ?? 3) || 3;
            return Math.min(120, Math.max(0, Math.floor(Number.isFinite(numeric) ? numeric : fallback)));
          })(),
        },
        webchatUpload: {
          enabled: false,
        },
      };
    }

    function normalizeKiroSettings(input = {}, defaults = {}, currentFlow = {}) {
      const defaultKiroFlow = isPlainObject(defaults?.flows?.kiro)
        ? defaults.flows.kiro
        : {};
      const defaultKiroTargets = isPlainObject(defaultKiroFlow.targets)
        ? defaultKiroFlow.targets
        : {};
      const targetSource = {
        ...currentFlow.targets['kiro-rs'],
        baseUrl: input?.kiroRsUrl ?? input?.kiroRsBaseUrl ?? currentFlow.targets['kiro-rs'].baseUrl,
        apiKey: input?.kiroRsKey ?? input?.kiroRsApiKey ?? currentFlow.targets['kiro-rs'].apiKey,
      };
      return {
        ...currentFlow,
        targets: {
          ...currentFlow.targets,
          'kiro-rs': normalizeFlowTargetState('kiro', 'kiro-rs', targetSource, defaultKiroTargets['kiro-rs'] || {}),
        },
      };
    }

    function normalizeGrokSettings(input = {}, nested = {}, defaults = {}, currentFlow = {}, openAiFlow = {}) {
      const defaultGrokFlow = isPlainObject(defaults?.flows?.grok)
        ? defaults.flows.grok
        : {};
      const defaultGrokTargets = isPlainObject(defaultGrokFlow.targets)
        ? defaultGrokFlow.targets
        : {};
      const sharedWebchatConfig = resolveSharedWebchatConfig(input, nested, openAiFlow, currentFlow);
      const targetSource = {
        ...currentFlow.targets.webchat2api,
        ...getTargetValue(
          nested,
          (state) => state.flows?.grok?.integrationTargets?.webchat2api,
          null,
          {}
        ),
        baseUrl: sharedWebchatConfig.baseUrl,
        apiKey: sharedWebchatConfig.apiKey,
      };
      const grok2apiCurrent = isPlainObject(currentFlow.targets.grok2api)
        ? currentFlow.targets.grok2api
        : {};
      const grok2apiSource = {
        ...grok2apiCurrent,
        baseUrl: input?.grok2ApiUrl ?? grok2apiCurrent.baseUrl,
        apiKey: input?.grok2ApiAdminKey ?? grok2apiCurrent.apiKey,
      };
      const sharedSub2ApiCredentials = resolveSharedSub2ApiCredentials(input, nested, openAiFlow, currentFlow);
      const sub2apiCurrent = isPlainObject(currentFlow.targets.sub2api)
        ? currentFlow.targets.sub2api
        : {};
      const sub2apiSource = {
        ...sub2apiCurrent,
        ...sharedSub2ApiCredentials,
        sub2apiGroupName: input?.grokSub2apiGroupName ?? sub2apiCurrent.sub2apiGroupName,
        sub2apiGroupNames: input?.grokSub2apiGroupNames ?? sub2apiCurrent.sub2apiGroupNames,
        sub2apiAccountPriority: input?.grokSub2apiAccountPriority ?? sub2apiCurrent.sub2apiAccountPriority,
        sub2apiDefaultProxyName: input?.grokSub2apiDefaultProxyName ?? sub2apiCurrent.sub2apiDefaultProxyName,
        grok2apiUploadEnabled: input?.grokSub2apiGrok2ApiUploadEnabled
          ?? input?.grokSub2apiWebchat2ApiUploadEnabled
          ?? sub2apiCurrent.grok2apiUploadEnabled
          ?? sub2apiCurrent.webchat2apiUploadEnabled,
      };
      return {
        ...currentFlow,
        targets: {
          ...currentFlow.targets,
          webchat2api: normalizeFlowTargetState('grok', 'webchat2api', targetSource, defaultGrokTargets.webchat2api || {}),
          grok2api: normalizeFlowTargetState('grok', 'grok2api', grok2apiSource, defaultGrokTargets.grok2api || {}),
          sub2api: normalizeFlowTargetState('grok', 'sub2api', sub2apiSource, defaultGrokTargets.sub2api || {}),
        },
      };
    }

    function normalizeSettingsState(input = {}, options = {}) {
      const defaults = buildDefaultSettingsState();
      const nested = isPlainObject(input?.settingsState)
        ? input.settingsState
        : (isPlainObject(input) && isPlainObject(input.flows) && isPlainObject(input.services) ? input : {});
      const activeFlowId = normalizeFlowId(
        input?.activeFlowId
        ?? nested?.activeFlowId
        ?? options?.activeFlowId
        ?? defaults.activeFlowId,
        defaults.activeFlowId
      );
      const normalized = {
        schemaVersion: defaults.schemaVersion,
        activeFlowId,
        ui: {
          language: rootScope.FlowPilotI18n?.normalizeLanguageSetting
            ? rootScope.FlowPilotI18n.normalizeLanguageSetting(input?.uiLanguage ?? nested?.ui?.language ?? defaults.ui.language)
            : (['auto', 'zh-CN', 'en-US'].includes(String(input?.uiLanguage ?? nested?.ui?.language ?? '').trim())
              ? String(input?.uiLanguage ?? nested?.ui?.language).trim()
              : defaults.ui.language),
        },
        services: {
          email: {
            provider: String(
              nested?.services?.email?.provider
              ?? input?.mailProvider
              ?? defaults.services.email.provider
            ).trim() || defaults.services.email.provider,
            customReceiveMode: String(
              nested?.services?.email?.customReceiveMode
              ?? input?.customMailReceiveMode
              ?? defaults.services.email.customReceiveMode
            ).trim().toLowerCase() === 'helper' ? 'helper' : defaults.services.email.customReceiveMode,
            customHelperBaseUrl: normalizeCustomMailHelperBaseUrl(
              nested?.services?.email?.customHelperBaseUrl
              ?? input?.customMailHelperBaseUrl
              ?? defaults.services.email.customHelperBaseUrl
            ),
          },
          proxy: {
            enabled: Boolean(
              nested?.services?.proxy?.enabled
              ?? input?.ipProxyEnabled
              ?? defaults.services.proxy.enabled
            ),
            provider: String(
              nested?.services?.proxy?.provider
              ?? input?.ipProxyService
              ?? defaults.services.proxy.provider
            ).trim() || defaults.services.proxy.provider,
            mode: String(
              nested?.services?.proxy?.mode
              ?? input?.ipProxyMode
              ?? defaults.services.proxy.mode
            ).trim() || defaults.services.proxy.mode,
          },
          account: {
            customPassword: String(
              input?.customPassword
              ?? nested?.services?.account?.customPassword
              ?? defaults.services.account.customPassword
            ).trim(),
          },
        },
        flows: {},
      };

      getCanonicalFlowIds().forEach((flowId) => {
        normalized.flows[flowId] = normalizeFlowSettings(flowId, {
          ...input,
          activeFlowId,
        }, nested, defaults);
      });
      if (normalized.flows.openai) {
        normalized.flows.openai = normalizeOpenAiSettings(input, nested, defaults, normalized.flows.openai, normalized.flows.grok);
      }
      if (normalized.flows.kiro) {
        normalized.flows.kiro = normalizeKiroSettings(input, defaults, normalized.flows.kiro);
      }
      if (normalized.flows.grok) {
        normalized.flows.grok = normalizeGrokSettings(input, nested, defaults, normalized.flows.grok, normalized.flows.openai);
      }
      return normalized;
    }

    function mergeSettingsState(baseValue = {}, patchValue = {}) {
      const baseSettingsState = normalizeSettingsState(baseValue);
      const patchSettingsState = isPlainObject(patchValue)
        ? patchValue
        : {};

      return normalizeSettingsState({
        settingsState: mergePlainObjects(baseSettingsState, patchSettingsState),
      });
    }

    function getFlowSettings(settingsState = {}, flowId) {
      const normalizedState = normalizeSettingsState(settingsState);
      const normalizedFlowId = normalizeFlowId(flowId, normalizedState.activeFlowId);
      return cloneValue(normalizedState?.flows?.[normalizedFlowId] || {});
    }

    function getSelectedTargetId(settingsState = {}, flowId) {
      const normalizedState = normalizeSettingsState(settingsState);
      const normalizedFlowId = normalizeFlowId(flowId, normalizedState.activeFlowId);
      const flowSettings = normalizedState?.flows?.[normalizedFlowId] || {};
      return normalizeTargetId(
        normalizedFlowId,
        flowSettings?.selectedTargetId,
        getDefaultTargetId(normalizedFlowId)
      );
    }

    function getTargetSettings(settingsState = {}, flowId, targetId = '') {
      const normalizedState = normalizeSettingsState(settingsState);
      const normalizedFlowId = normalizeFlowId(flowId, normalizedState.activeFlowId);
      const resolvedTargetId = normalizeTargetId(
        normalizedFlowId,
        targetId || getSelectedTargetId(normalizedState, normalizedFlowId),
        getSelectedTargetId(normalizedState, normalizedFlowId)
      );
      return cloneValue(normalizedState?.flows?.[normalizedFlowId]?.targets?.[resolvedTargetId] || {});
    }

    function buildStepExecutionRangeByFlow(settingsState = {}) {
      const normalizedState = normalizeSettingsState(settingsState);
      const defaults = buildDefaultSettingsState();
      return Object.fromEntries(
        Object.entries(normalizedState.flows || {}).map(([flowId, flowSettings]) => [
          flowId,
          normalizeStepExecutionRangeEntry(
            flowSettings?.autoRun?.stepExecutionRange,
            defaults.flows?.[flowId]?.autoRun?.stepExecutionRange || getDefaultStepExecutionRange(flowId)
          ),
        ])
      );
    }

    function buildSettingsView(settingsState = {}, baseInput = {}) {
      const normalizedState = normalizeSettingsState(settingsState);
      const next = {
        ...(isPlainObject(baseInput) ? cloneValue(baseInput) : {}),
      };
      legacyMigrationStorageKeys.forEach((key) => {
        delete next[key];
      });
      const openaiState = normalizedState.flows.openai || buildDefaultFlowSettings('openai');
      const kiroState = normalizedState.flows.kiro || buildDefaultFlowSettings('kiro');
      const grokState = normalizedState.flows.grok || buildDefaultFlowSettings('grok');
      next.activeFlowId = normalizedState.activeFlowId;
      next.uiLanguage = normalizedState.ui?.language || 'auto';
      next.targetId = getSelectedTargetId(normalizedState, normalizedState.activeFlowId);
      next.vpsUrl = openaiState.targets.cpa?.vpsUrl || '';
      next.vpsPassword = openaiState.targets.cpa?.vpsPassword || '';
      next.localCpaStep9Mode = openaiState.targets.cpa?.localCpaStep9Mode || 'submit';
      next.sub2apiUrl = openaiState.targets.sub2api?.sub2apiUrl || '';
      next.sub2apiEmail = openaiState.targets.sub2api?.sub2apiEmail || '';
      next.sub2apiPassword = openaiState.targets.sub2api?.sub2apiPassword || '';
      next.sub2apiGroupName = openaiState.targets.sub2api?.sub2apiGroupName || 'codex';
      next.sub2apiGroupNames = cloneValue(openaiState.targets.sub2api?.sub2apiGroupNames || ['codex', 'openai-plus']);
      next.sub2apiAccountPriority = openaiState.targets.sub2api?.sub2apiAccountPriority || 1;
      next.sub2apiDefaultProxyName = openaiState.targets.sub2api?.sub2apiDefaultProxyName || '';
      next.codex2apiUrl = openaiState.targets.codex2api?.codex2apiUrl || '';
      next.codex2apiAdminKey = openaiState.targets.codex2api?.codex2apiAdminKey || '';
      next.openaiWebchatUrl = openaiState.targets.webchat?.baseUrl || '';
      next.openaiWebchatAdminKey = openaiState.targets.webchat?.apiKey || '';
      next.openaiWebchatUploadEnabled = Boolean(openaiState.webchatUpload?.enabled);
      next.openaiChatgpt2ApiUrl = openaiState.targets.chatgpt2api?.baseUrl || '';
      next.openaiChatgpt2ApiAdminKey = openaiState.targets.chatgpt2api?.apiKey || '';
      next.customPassword = normalizedState.services.account.customPassword;
      next.signupMethod = openaiState.signup?.signupMethod || 'email';
      next.phoneSignupReloginAfterBindEmailEnabled = Boolean(openaiState.signup?.phoneSignupReloginAfterBindEmailEnabled);
      next.plusModeEnabled = false;
      next.plusPaymentMethod = normalizePlusPaymentMethod(openaiState.plus?.plusPaymentMethod || 'paypal');
      const selectedOpenAiTargetId = getSelectedTargetId(normalizedState, 'openai');
      next.accountDeliveryMode = normalizeAccountDeliveryModeForTarget(
        selectedOpenAiTargetId,
        openaiState.targets?.[selectedOpenAiTargetId]?.accountDeliveryMode
      );
      next.hostedCheckoutVerificationUrl = openaiState.plus?.hostedCheckoutVerificationUrl || '';
      next.hostedCheckoutPhoneNumber = openaiState.plus?.hostedCheckoutPhoneNumber || '';
      next.plusHostedCheckoutOauthDelaySeconds = openaiState.plus?.plusHostedCheckoutOauthDelaySeconds ?? 3;
      next.mailProvider = normalizedState.services.email.provider;
      next.customMailReceiveMode = normalizedState.services.email.customReceiveMode;
      next.customMailHelperBaseUrl = normalizedState.services.email.customHelperBaseUrl;
      next.ipProxyEnabled = normalizedState.services.proxy.enabled;
      next.ipProxyService = normalizedState.services.proxy.provider;
      next.ipProxyMode = normalizedState.services.proxy.mode;
      next.kiroRsUrl = kiroState.targets['kiro-rs']?.baseUrl || '';
      next.kiroRsKey = kiroState.targets['kiro-rs']?.apiKey || '';
      next.grokWebchat2ApiUrl = grokState.targets.webchat2api?.baseUrl || '';
      next.grokWebchat2ApiAdminKey = grokState.targets.webchat2api?.apiKey || '';
      next.grok2ApiUrl = grokState.targets.grok2api?.baseUrl || '';
      next.grok2ApiAdminKey = grokState.targets.grok2api?.apiKey || '';
      next.grokSub2apiGroupName = grokState.targets.sub2api?.sub2apiGroupName || '';
      next.grokSub2apiGroupNames = cloneValue(grokState.targets.sub2api?.sub2apiGroupNames || []);
      next.grokSub2apiAccountPriority = grokState.targets.sub2api?.sub2apiAccountPriority || 1;
      next.grokSub2apiDefaultProxyName = grokState.targets.sub2api?.sub2apiDefaultProxyName || '';
      next.grokSub2apiGrok2ApiUploadEnabled = Boolean(
        grokState.targets.sub2api?.grok2apiUploadEnabled
      );
      next.stepExecutionRangeByFlow = buildStepExecutionRangeByFlow(normalizedState);
      next.settingsSchemaVersion = normalizedState.schemaVersion;
      next.settingsState = cloneValue(normalizedState);
      return next;
    }

    function getFlowInputState(settingsState = {}, flowId) {
      const normalizedState = normalizeSettingsState(settingsState);
      const normalizedFlowId = normalizeFlowId(flowId, normalizedState.activeFlowId);
      const targetId = getSelectedTargetId(normalizedState, normalizedFlowId);
      if (normalizedFlowId === 'kiro') {
        const targetSettings = getTargetSettings(normalizedState, normalizedFlowId, targetId);
        return {
          activeFlowId: normalizedFlowId,
          targetId,
          kiroRsUrl: targetSettings.baseUrl || '',
          kiroRsKey: targetSettings.apiKey || '',
        };
      }
      if (normalizedFlowId === 'openai') {
        const targetSettings = getTargetSettings(normalizedState, normalizedFlowId, targetId);
        return {
          activeFlowId: normalizedFlowId,
          targetId,
          accountDeliveryMode: normalizeAccountDeliveryModeForTarget(
            targetId,
            targetSettings.accountDeliveryMode
          ),
        };
      }
      return {
        activeFlowId: normalizedFlowId,
        targetId,
      };
    }

    return {
      buildDefaultSettingsState,
      buildSettingsView,
      buildStepExecutionRangeByFlow,
      getFlowInputState,
      getFlowSettings,
      getLegacyMigrationStorageKeys,
      getSelectedTargetId,
      getTargetSettings,
      mergeSettingsState,
      normalizeSettingsState,
    };
  }

  return {
    createSettingsSchema,
  };
});
