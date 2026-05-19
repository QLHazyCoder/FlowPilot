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
    const normalizePlusAccountAccessStrategy = (value = '') => {
      const normalized = String(value || '').trim().toLowerCase();
      if (normalized === 'sub2api_codex_session') {
        return 'sub2api_codex_session';
      }
      if (normalized === 'cpa_codex_session') {
        return 'cpa_codex_session';
      }
      return 'oauth';
    };

    function buildDefaultSettingsState() {
      return {
        schemaVersion: 4,
        activeFlowId: defaultFlowId,
        services: {
          account: {
            customPassword: '',
          },
          email: {
            provider: '163',
          },
          proxy: {
            enabled: false,
            provider: '711proxy',
            mode: 'account',
          },
        },
        flows: {
          openai: {
            integrationTargetId: defaultOpenAiTargetId,
            integrationTargets: {
              cpa: {
                vpsUrl: '',
                vpsPassword: '',
                localCpaStep9Mode: 'submit',
              },
              sub2api: {
                sub2apiUrl: '',
                sub2apiEmail: '',
                sub2apiPassword: '',
                sub2apiGroupName: 'codex',
                sub2apiGroupNames: ['codex', 'openai-plus'],
                sub2apiAccountPriority: 1,
                sub2apiDefaultProxyName: '',
              },
              codex2api: {
                codex2apiUrl: '',
                codex2apiAdminKey: '',
              },
            },
            signup: {
              signupMethod: 'email',
              phoneVerificationEnabled: false,
              phoneSignupReloginAfterBindEmailEnabled: false,
            },
            plus: {
              plusModeEnabled: false,
              plusPaymentMethod: 'paypal',
              plusAccountAccessStrategy: 'sub2api_codex_session',
            },
            autoRun: {
              stepExecutionRange: {
                enabled: false,
                fromStep: 1,
                toStep: 11,
              },
            },
          },
          kiro: {
            targetId: defaultKiroTargetId,
            targets: {
              'kiro-rs': {
                baseUrl: defaultKiroRsUrl,
                apiKey: '',
              },
            },
            autoRun: {
              stepExecutionRange: {
                enabled: false,
                fromStep: 1,
                toStep: 9,
              },
            },
          },
        },
      };
    }

    function getIntegrationTargetValue(settingsState, pathGetter, fallback = {}) {
      return cloneValue(pathGetter(isPlainObject(settingsState) ? settingsState : {}) || fallback);
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
      const openaiIntegrationTargetId = normalizeTargetId(
        'openai',
        nested?.flows?.openai?.integrationTargetId
          ?? input?.openaiIntegrationTargetId
          ?? input?.panelMode
          ?? defaults.flows.openai.integrationTargetId,
        defaults.flows.openai.integrationTargetId
      );
      const kiroTargetId = normalizeTargetId(
        'kiro',
        nested?.flows?.kiro?.targetId
          ?? input?.kiroTargetId
          ?? defaults.flows.kiro.targetId,
        defaults.flows.kiro.targetId
      );
      const stepExecutionRangeByFlow = isPlainObject(input?.stepExecutionRangeByFlow)
        ? input.stepExecutionRangeByFlow
        : {};

      return {
        schemaVersion: Number(input?.settingsSchemaVersion || nested?.schemaVersion || defaults.schemaVersion) || defaults.schemaVersion,
        activeFlowId,
        services: {
          email: {
            provider: String(
              nested?.services?.email?.provider
              ?? input?.mailProvider
              ?? defaults.services.email.provider
            ).trim() || defaults.services.email.provider,
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
        flows: {
          openai: {
            integrationTargetId: openaiIntegrationTargetId,
            integrationTargets: {
              cpa: {
                ...defaults.flows.openai.integrationTargets.cpa,
                ...getIntegrationTargetValue(nested, (state) => state.flows?.openai?.integrationTargets?.cpa),
                vpsUrl: String(
                  input?.vpsUrl
                  ?? nested?.flows?.openai?.integrationTargets?.cpa?.vpsUrl
                  ?? ''
                ).trim(),
                vpsPassword: String(
                  input?.vpsPassword
                  ?? nested?.flows?.openai?.integrationTargets?.cpa?.vpsPassword
                  ?? ''
                ),
                localCpaStep9Mode: String(
                  input?.localCpaStep9Mode
                  ?? nested?.flows?.openai?.integrationTargets?.cpa?.localCpaStep9Mode
                  ?? defaults.flows.openai.integrationTargets.cpa.localCpaStep9Mode
                ).trim() || defaults.flows.openai.integrationTargets.cpa.localCpaStep9Mode,
              },
              sub2api: {
                ...defaults.flows.openai.integrationTargets.sub2api,
                ...getIntegrationTargetValue(nested, (state) => state.flows?.openai?.integrationTargets?.sub2api),
                sub2apiUrl: String(
                  input?.sub2apiUrl
                  ?? nested?.flows?.openai?.integrationTargets?.sub2api?.sub2apiUrl
                  ?? ''
                ).trim(),
                sub2apiEmail: String(
                  input?.sub2apiEmail
                  ?? nested?.flows?.openai?.integrationTargets?.sub2api?.sub2apiEmail
                  ?? ''
                ).trim(),
                sub2apiPassword: String(
                  input?.sub2apiPassword
                  ?? nested?.flows?.openai?.integrationTargets?.sub2api?.sub2apiPassword
                  ?? ''
                ),
                sub2apiGroupName: String(
                  input?.sub2apiGroupName
                  ?? nested?.flows?.openai?.integrationTargets?.sub2api?.sub2apiGroupName
                  ?? defaults.flows.openai.integrationTargets.sub2api.sub2apiGroupName
                ).trim() || defaults.flows.openai.integrationTargets.sub2api.sub2apiGroupName,
                sub2apiGroupNames: Array.isArray(input?.sub2apiGroupNames)
                  ? input.sub2apiGroupNames.map((entry) => String(entry || '').trim()).filter(Boolean)
                  : (Array.isArray(nested?.flows?.openai?.integrationTargets?.sub2api?.sub2apiGroupNames)
                    ? nested.flows.openai.integrationTargets.sub2api.sub2apiGroupNames.map((entry) => String(entry || '').trim()).filter(Boolean)
                    : [...defaults.flows.openai.integrationTargets.sub2api.sub2apiGroupNames]),
                sub2apiAccountPriority: Math.max(1, Number(
                  input?.sub2apiAccountPriority
                  ?? nested?.flows?.openai?.integrationTargets?.sub2api?.sub2apiAccountPriority
                  ?? defaults.flows.openai.integrationTargets.sub2api.sub2apiAccountPriority
                ) || defaults.flows.openai.integrationTargets.sub2api.sub2apiAccountPriority),
                sub2apiDefaultProxyName: String(
                  input?.sub2apiDefaultProxyName
                  ?? nested?.flows?.openai?.integrationTargets?.sub2api?.sub2apiDefaultProxyName
                  ?? ''
                ).trim(),
              },
              codex2api: {
                ...defaults.flows.openai.integrationTargets.codex2api,
                ...getIntegrationTargetValue(nested, (state) => state.flows?.openai?.integrationTargets?.codex2api),
                codex2apiUrl: String(
                  input?.codex2apiUrl
                  ?? nested?.flows?.openai?.integrationTargets?.codex2api?.codex2apiUrl
                  ?? ''
                ).trim(),
                codex2apiAdminKey: String(
                  input?.codex2apiAdminKey
                  ?? nested?.flows?.openai?.integrationTargets?.codex2api?.codex2apiAdminKey
                  ?? ''
                ).trim(),
              },
            },
            signup: {
              signupMethod: String(
                input?.signupMethod
                ?? nested?.flows?.openai?.signup?.signupMethod
                ?? defaults.flows.openai.signup.signupMethod
              ).trim().toLowerCase() === 'phone' ? 'phone' : 'email',
              phoneVerificationEnabled: Boolean(
                input?.phoneVerificationEnabled
                ?? nested?.flows?.openai?.signup?.phoneVerificationEnabled
                ?? defaults.flows.openai.signup.phoneVerificationEnabled
              ),
              phoneSignupReloginAfterBindEmailEnabled: Boolean(
                input?.phoneSignupReloginAfterBindEmailEnabled
                ?? nested?.flows?.openai?.signup?.phoneSignupReloginAfterBindEmailEnabled
                ?? defaults.flows.openai.signup.phoneSignupReloginAfterBindEmailEnabled
              ),
            },
            plus: {
              plusModeEnabled: Boolean(
                input?.plusModeEnabled
                ?? nested?.flows?.openai?.plus?.plusModeEnabled
                ?? defaults.flows.openai.plus.plusModeEnabled
              ),
              plusPaymentMethod: String(
                input?.plusPaymentMethod
                ?? nested?.flows?.openai?.plus?.plusPaymentMethod
                ?? defaults.flows.openai.plus.plusPaymentMethod
              ).trim() || defaults.flows.openai.plus.plusPaymentMethod,
              plusAccountAccessStrategy: normalizePlusAccountAccessStrategy(
                input?.plusAccountAccessStrategy
                ?? nested?.flows?.openai?.plus?.plusAccountAccessStrategy
                ?? defaults.flows.openai.plus.plusAccountAccessStrategy
              ),
            },
            autoRun: {
              stepExecutionRange: normalizeStepExecutionRangeEntry(
                nested?.flows?.openai?.autoRun?.stepExecutionRange
                  ?? stepExecutionRangeByFlow.openai
                  ?? {},
                defaults.flows.openai.autoRun.stepExecutionRange
              ),
            },
          },
          kiro: {
            targetId: kiroTargetId,
            targets: {
              'kiro-rs': {
                ...defaults.flows.kiro.targets['kiro-rs'],
                ...getIntegrationTargetValue(nested, (state) => state.flows?.kiro?.targets?.['kiro-rs']),
                baseUrl: String(
                  input?.kiroRsUrl
                  ?? input?.kiroRsBaseUrl
                  ?? nested?.flows?.kiro?.targets?.['kiro-rs']?.baseUrl
                  ?? defaults.flows.kiro.targets['kiro-rs'].baseUrl
                ).trim() || defaults.flows.kiro.targets['kiro-rs'].baseUrl,
                apiKey: String(
                  input?.kiroRsKey
                  ?? input?.kiroRsApiKey
                  ?? nested?.flows?.kiro?.targets?.['kiro-rs']?.apiKey
                  ?? defaults.flows.kiro.targets['kiro-rs'].apiKey
                ),
              },
            },
            autoRun: {
              stepExecutionRange: normalizeStepExecutionRangeEntry(
                nested?.flows?.kiro?.autoRun?.stepExecutionRange
                  ?? stepExecutionRangeByFlow.kiro
                  ?? {},
                defaults.flows.kiro.autoRun.stepExecutionRange
              ),
            },
          },
        },
      };
    }

    function mergeSettingsState(baseValue = {}, patchValue = {}) {
      const baseSettingsState = normalizeSettingsState(baseValue);
      const patchSettingsState = normalizeSettingsState({
        settingsState: patchValue,
        activeFlowId: patchValue?.activeFlowId ?? baseSettingsState.activeFlowId,
      });

      function mergeRecursive(baseNode, patchNode) {
        if (Array.isArray(patchNode)) {
          return patchNode.map((entry) => cloneValue(entry));
        }
        if (!isPlainObject(patchNode)) {
          return patchNode === undefined ? cloneValue(baseNode) : patchNode;
        }
        const next = {
          ...cloneValue(isPlainObject(baseNode) ? baseNode : {}),
        };
        Object.entries(patchNode).forEach(([key, value]) => {
          next[key] = mergeRecursive(baseNode?.[key], value);
        });
        return next;
      }

      return normalizeSettingsState({
        settingsState: mergeRecursive(baseSettingsState, patchSettingsState),
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
      if (normalizedFlowId === 'kiro') {
        return normalizeTargetId(
          normalizedFlowId,
          flowSettings?.targetId,
          defaultKiroTargetId
        );
      }
      return normalizeTargetId(
        normalizedFlowId,
        flowSettings?.integrationTargetId,
        defaultOpenAiTargetId
      );
    }

    function buildStepExecutionRangeByFlow(settingsState = {}) {
      const normalizedState = normalizeSettingsState(settingsState);
      return {
        openai: normalizeStepExecutionRangeEntry(
          normalizedState?.flows?.openai?.autoRun?.stepExecutionRange,
          buildDefaultSettingsState().flows.openai.autoRun.stepExecutionRange
        ),
        kiro: normalizeStepExecutionRangeEntry(
          normalizedState?.flows?.kiro?.autoRun?.stepExecutionRange,
          buildDefaultSettingsState().flows.kiro.autoRun.stepExecutionRange
        ),
      };
    }

    function buildSettingsView(settingsState = {}, baseInput = {}) {
      const normalizedState = normalizeSettingsState(settingsState);
      const next = {
        ...(isPlainObject(baseInput) ? cloneValue(baseInput) : {}),
      };
      const openaiState = normalizedState.flows.openai;
      const kiroState = normalizedState.flows.kiro;
      next.activeFlowId = normalizedState.activeFlowId;
      next.openaiIntegrationTargetId = getSelectedTargetId(normalizedState, 'openai');
      next.kiroTargetId = getSelectedTargetId(normalizedState, 'kiro');
      next.panelMode = next.openaiIntegrationTargetId;
      next.vpsUrl = openaiState.integrationTargets.cpa.vpsUrl;
      next.vpsPassword = openaiState.integrationTargets.cpa.vpsPassword;
      next.localCpaStep9Mode = openaiState.integrationTargets.cpa.localCpaStep9Mode;
      next.sub2apiUrl = openaiState.integrationTargets.sub2api.sub2apiUrl;
      next.sub2apiEmail = openaiState.integrationTargets.sub2api.sub2apiEmail;
      next.sub2apiPassword = openaiState.integrationTargets.sub2api.sub2apiPassword;
      next.sub2apiGroupName = openaiState.integrationTargets.sub2api.sub2apiGroupName;
      next.sub2apiGroupNames = cloneValue(openaiState.integrationTargets.sub2api.sub2apiGroupNames);
      next.sub2apiAccountPriority = openaiState.integrationTargets.sub2api.sub2apiAccountPriority;
      next.sub2apiDefaultProxyName = openaiState.integrationTargets.sub2api.sub2apiDefaultProxyName;
      next.codex2apiUrl = openaiState.integrationTargets.codex2api.codex2apiUrl;
      next.codex2apiAdminKey = openaiState.integrationTargets.codex2api.codex2apiAdminKey;
      next.customPassword = normalizedState.services.account.customPassword;
      next.signupMethod = openaiState.signup.signupMethod;
      next.phoneVerificationEnabled = openaiState.signup.phoneVerificationEnabled;
      next.phoneSignupReloginAfterBindEmailEnabled = openaiState.signup.phoneSignupReloginAfterBindEmailEnabled;
      next.plusModeEnabled = openaiState.plus.plusModeEnabled;
      next.plusPaymentMethod = openaiState.plus.plusPaymentMethod;
      next.plusAccountAccessStrategy = openaiState.plus.plusAccountAccessStrategy;
      next.mailProvider = normalizedState.services.email.provider;
      next.ipProxyEnabled = normalizedState.services.proxy.enabled;
      next.ipProxyService = normalizedState.services.proxy.provider;
      next.ipProxyMode = normalizedState.services.proxy.mode;
      next.kiroRsUrl = kiroState.targets['kiro-rs'].baseUrl;
      next.kiroRsKey = kiroState.targets['kiro-rs'].apiKey;
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
        return {
          activeFlowId: normalizedFlowId,
          targetId,
          kiroRsUrl: normalizedState.flows.kiro.targets['kiro-rs'].baseUrl,
          kiroRsKey: normalizedState.flows.kiro.targets['kiro-rs'].apiKey,
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
      getSelectedTargetId,
      mergeSettingsState,
      normalizeSettingsState,
    };
  }

  return {
    createSettingsSchema,
  };
});
