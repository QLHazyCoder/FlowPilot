(function attachBackgroundRuntimeState(root, factory) {
  root.MultiPageBackgroundRuntimeState = factory();
})(typeof self !== 'undefined' ? self : globalThis, function createBackgroundRuntimeStateModule() {
  function createRuntimeStateHelpers(deps = {}) {
    const {
      DEFAULT_ACTIVE_FLOW_ID = 'openai',
      defaultNodeStatuses = {},
    } = deps;

    const RUNTIME_SHARED_FIELDS = Object.freeze([
      'automationWindowId',
      'tabRegistry',
      'sourceLastUrls',
      'flowStartTime',
    ]);
    const RUNTIME_PROXY_FIELDS = Object.freeze([
      'ipProxyApiPool',
      'ipProxyApiCurrentIndex',
      'ipProxyApiCurrent',
      'ipProxyAccountPool',
      'ipProxyAccountCurrentIndex',
      'ipProxyAccountCurrent',
      'ipProxyPool',
      'ipProxyCurrentIndex',
      'ipProxyCurrent',
    ]);
    const OPENAI_FLOW_FIELD_GROUPS = Object.freeze({
      auth: Object.freeze([
        'oauthUrl',
        'localhostUrl',
      ]),
      platformBinding: Object.freeze([
        'cpaOAuthState',
        'cpaManagementOrigin',
        'sub2apiSessionId',
        'sub2apiOAuthState',
        'sub2apiGroupId',
        'sub2apiDraftName',
        'sub2apiProxyId',
        'sub2apiGroupIds',
        'codex2apiSessionId',
        'codex2apiOAuthState',
      ]),
      plus: Object.freeze([
        'plusCheckoutTabId',
        'plusCheckoutUrl',
        'plusCheckoutCountry',
        'plusCheckoutCurrency',
        'plusCheckoutSource',
        'plusBillingCountryText',
        'plusBillingAddress',
        'plusPaypalApprovedAt',
        'plusReturnUrl',
        'gpcPageStatus',
        'gpcPageStatusText',
      ]),
      phoneVerification: Object.freeze([
        'currentPhoneActivation',
        'phoneNumber',
        'currentPhoneVerificationCode',
        'currentPhoneVerificationCountdownEndsAt',
        'currentPhoneVerificationCountdownWindowIndex',
        'currentPhoneVerificationCountdownWindowTotal',
        'reusablePhoneActivation',
        'freeReusablePhoneActivation',
        'phoneReusableActivationPool',
        'signupPhoneNumber',
        'signupPhoneActivation',
        'signupPhoneCompletedActivation',
        'signupPhoneVerificationRequestedAt',
        'signupPhoneVerificationPurpose',
      ]),
      luckmail: Object.freeze([
        'currentLuckmailPurchase',
        'currentLuckmailMailCursor',
        'currentYydsMailInbox',
      ]),
      identity: Object.freeze([
        'resolvedSignupMethod',
        'accountIdentifierType',
        'accountIdentifier',
        'registrationEmailState',
        'email',
        'password',
        'step5ProfilePayload',
        'step5ProfileRecoveryCount',
        'lastEmailTimestamp',
        'lastSignupCode',
        'lastLoginCode',
        'step8VerificationTargetEmail',
      ]),
    });
    const FLOW_FIELD_GROUPS = Object.freeze({
      openai: OPENAI_FLOW_FIELD_GROUPS,
    });

    function isPlainObject(value) {
      return Boolean(value) && typeof value === 'object' && !Array.isArray(value);
    }

    function cloneValue(value) {
      if (Array.isArray(value)) {
        return value.map((item) => cloneValue(item));
      }
      if (isPlainObject(value)) {
        return Object.fromEntries(
          Object.entries(value).map(([key, entryValue]) => [key, cloneValue(entryValue)])
        );
      }
      return value;
    }

    function deepMerge(baseValue, patchValue) {
      if (Array.isArray(patchValue)) {
        return patchValue.map((item) => cloneValue(item));
      }
      if (!isPlainObject(patchValue)) {
        return patchValue === undefined ? cloneValue(baseValue) : patchValue;
      }

      const baseObject = isPlainObject(baseValue) ? baseValue : {};
      const next = {
        ...cloneValue(baseObject),
      };
      Object.entries(patchValue).forEach(([key, value]) => {
        next[key] = deepMerge(baseObject[key], value);
      });
      return next;
    }

    function normalizePlainObject(value) {
      return isPlainObject(value) ? value : {};
    }

    function normalizeFlowId(value = '') {
      const normalized = String(value || '').trim().toLowerCase();
      return normalized || DEFAULT_ACTIVE_FLOW_ID;
    }

    function normalizeRunId(value = '') {
      return String(value || '').trim();
    }

    function normalizeNodeStatus(value = '') {
      const normalized = String(value || '').trim().toLowerCase();
      if (!normalized) {
        return 'pending';
      }
      return normalized;
    }

    function buildDefaultNodeStatuses() {
      return Object.fromEntries(
        Object.entries(normalizePlainObject(defaultNodeStatuses)).map(([key, value]) => [
          String(key),
          normalizeNodeStatus(value),
        ])
      );
    }

    function normalizeNodeStatuses(value) {
      const base = buildDefaultNodeStatuses();
      if (!isPlainObject(value)) {
        return base;
      }

      const next = { ...base };
      for (const [key, status] of Object.entries(value)) {
        const nodeId = String(key || '').trim();
        if (!nodeId) continue;
        next[nodeId] = normalizeNodeStatus(status);
      }
      return next;
    }

    function pickDefinedFields(state = {}, fields = []) {
      const next = {};
      for (const field of fields) {
        if (Object.prototype.hasOwnProperty.call(state, field)) {
          next[field] = cloneValue(state[field]);
        }
      }
      return next;
    }

    function buildSharedState(baseValue = {}, state = {}) {
      return {
        ...cloneValue(normalizePlainObject(baseValue)),
        ...pickDefinedFields(state, RUNTIME_SHARED_FIELDS),
      };
    }

    function buildServiceState(baseValue = {}, state = {}) {
      const base = cloneValue(normalizePlainObject(baseValue));
      return {
        ...base,
        proxy: {
          ...cloneValue(normalizePlainObject(base.proxy)),
          ...pickDefinedFields(state, RUNTIME_PROXY_FIELDS),
        },
      };
    }

    function buildScopedFlowState(baseFlowState = {}, state = {}, flowId = 'openai') {
      const fieldGroups = FLOW_FIELD_GROUPS[flowId] || {};
      const baseScopedState = cloneValue(normalizePlainObject(baseFlowState[flowId]));
      const scopedState = {
        ...baseScopedState,
      };

      for (const [groupKey, fields] of Object.entries(fieldGroups)) {
        scopedState[groupKey] = {
          ...cloneValue(normalizePlainObject(baseScopedState[groupKey])),
          ...pickDefinedFields(state, fields),
        };
      }

      return scopedState;
    }

    function buildFlowState(baseValue = {}, state = {}) {
      const baseFlowState = cloneValue(normalizePlainObject(baseValue));
      return {
        ...baseFlowState,
        openai: buildScopedFlowState(baseFlowState, state, 'openai'),
      };
    }

    function listFlowFieldNames() {
      const fields = [];
      for (const flowGroups of Object.values(FLOW_FIELD_GROUPS)) {
        for (const groupFields of Object.values(normalizePlainObject(flowGroups))) {
          for (const field of Array.isArray(groupFields) ? groupFields : []) {
            const normalizedField = String(field || '').trim();
            if (normalizedField) {
              fields.push(normalizedField);
            }
          }
        }
      }
      return Array.from(new Set(fields));
    }

    const FLOW_RUNTIME_FIELDS = Object.freeze(listFlowFieldNames());
    const RUNTIME_TOP_LEVEL_FIELDS = Object.freeze([
      ...RUNTIME_SHARED_FIELDS,
      ...RUNTIME_PROXY_FIELDS,
      ...FLOW_RUNTIME_FIELDS,
    ]);
    const RUNTIME_TOP_LEVEL_FIELD_SET = new Set(RUNTIME_TOP_LEVEL_FIELDS);
    const RUNTIME_PATCH_IGNORED_KEYS = new Set([
      'runtimeState',
      'flowState',
      'sharedState',
      'serviceState',
      'flows',
      'shared',
      'services',
      'currentStep',
      'stepStatuses',
      'legacyStepCompat',
      'flowId',
      'runId',
      'activeFlowId',
      'activeRunId',
      'currentNodeId',
      'nodeStatuses',
      'kiroRuntime',
      ...RUNTIME_TOP_LEVEL_FIELDS,
    ]);

    function projectScopedFlowFields(flowState = {}) {
      const next = {};
      for (const [flowId, fieldGroups] of Object.entries(FLOW_FIELD_GROUPS)) {
        const scopedState = normalizePlainObject(normalizePlainObject(flowState)[flowId]);
        for (const [groupKey, fields] of Object.entries(fieldGroups)) {
          const group = normalizePlainObject(scopedState[groupKey]);
          Object.assign(next, pickDefinedFields(group, fields));
        }
      }
      return next;
    }

    function projectRuntimeViewFields(runtimeState = {}) {
      const normalizedRuntimeState = normalizePlainObject(runtimeState);
      return {
        ...pickDefinedFields(
          normalizePlainObject(normalizedRuntimeState.sharedState),
          RUNTIME_SHARED_FIELDS
        ),
        ...pickDefinedFields(
          normalizePlainObject(normalizePlainObject(normalizedRuntimeState.serviceState).proxy),
          RUNTIME_PROXY_FIELDS
        ),
        ...projectScopedFlowFields(normalizedRuntimeState.flowState),
      };
    }

    function buildRuntimeInputFromPatch(updates = {}) {
      const normalizedUpdates = normalizePlainObject(updates);
      const runtimeStatePatch = normalizePlainObject(normalizedUpdates.runtimeState);
      const next = {
        ...pickDefinedFields(normalizedUpdates, [
          'flowId',
          'runId',
          'activeFlowId',
          'activeRunId',
          'currentNodeId',
          'nodeStatuses',
        ]),
        ...pickDefinedFields(runtimeStatePatch, [
          'flowId',
          'runId',
          'activeFlowId',
          'activeRunId',
          'currentNodeId',
          'nodeStatuses',
        ]),
        ...projectRuntimeViewFields(runtimeStatePatch),
        ...pickDefinedFields(normalizedUpdates, RUNTIME_TOP_LEVEL_FIELDS),
      };

      if (Object.prototype.hasOwnProperty.call(normalizedUpdates, 'sharedState')) {
        Object.assign(
          next,
          pickDefinedFields(normalizePlainObject(normalizedUpdates.sharedState), RUNTIME_SHARED_FIELDS)
        );
      }
      if (Object.prototype.hasOwnProperty.call(normalizedUpdates, 'serviceState')) {
        Object.assign(
          next,
          pickDefinedFields(
            normalizePlainObject(normalizePlainObject(normalizedUpdates.serviceState).proxy),
            RUNTIME_PROXY_FIELDS
          )
        );
      }
      if (Object.prototype.hasOwnProperty.call(normalizedUpdates, 'flowState')) {
        Object.assign(next, projectScopedFlowFields(normalizedUpdates.flowState));
      }
      if (!Object.prototype.hasOwnProperty.call(next, 'flowId') && Object.prototype.hasOwnProperty.call(next, 'activeFlowId')) {
        next.flowId = next.activeFlowId;
      }
      if (!Object.prototype.hasOwnProperty.call(next, 'runId') && Object.prototype.hasOwnProperty.call(next, 'activeRunId')) {
        next.runId = next.activeRunId;
      }
      return next;
    }

    function buildRuntimeStateSeed(currentRuntimeState = {}, updates = {}) {
      const normalizedUpdates = normalizePlainObject(updates);
      let nextRuntimeState = deepMerge(currentRuntimeState, normalizePlainObject(normalizedUpdates.runtimeState));

      if (Object.prototype.hasOwnProperty.call(normalizedUpdates, 'sharedState')) {
        nextRuntimeState = deepMerge(nextRuntimeState, {
          sharedState: normalizePlainObject(normalizedUpdates.sharedState),
        });
      }
      if (Object.prototype.hasOwnProperty.call(normalizedUpdates, 'shared')) {
        nextRuntimeState = deepMerge(nextRuntimeState, {
          sharedState: normalizePlainObject(normalizedUpdates.shared),
        });
      }
      if (Object.prototype.hasOwnProperty.call(normalizedUpdates, 'serviceState')) {
        nextRuntimeState = deepMerge(nextRuntimeState, {
          serviceState: normalizePlainObject(normalizedUpdates.serviceState),
        });
      }
      if (Object.prototype.hasOwnProperty.call(normalizedUpdates, 'services')) {
        nextRuntimeState = deepMerge(nextRuntimeState, {
          serviceState: normalizePlainObject(normalizedUpdates.services),
        });
      }
      if (Object.prototype.hasOwnProperty.call(normalizedUpdates, 'flowState')) {
        nextRuntimeState = deepMerge(nextRuntimeState, {
          flowState: normalizePlainObject(normalizedUpdates.flowState),
        });
      }
      if (Object.prototype.hasOwnProperty.call(normalizedUpdates, 'flows')) {
        nextRuntimeState = deepMerge(nextRuntimeState, {
          flowState: normalizePlainObject(normalizedUpdates.flows),
        });
      }
      return nextRuntimeState;
    }

    function buildRuntimeStateDefault() {
      return {
        flowId: DEFAULT_ACTIVE_FLOW_ID,
        runId: '',
        activeFlowId: DEFAULT_ACTIVE_FLOW_ID,
        activeRunId: '',
        currentNodeId: '',
        nodeStatuses: {},
        sharedState: {},
        serviceState: {
          proxy: {},
        },
        flowState: {
          openai: {
            auth: {},
            platformBinding: {},
            plus: {},
            phoneVerification: {},
            luckmail: {},
            identity: {},
          },
        },
      };
    }

    function ensureRuntimeState(state = {}) {
      const baseRuntimeState = {
        ...buildRuntimeStateDefault(),
        ...cloneValue(normalizePlainObject(state.runtimeState)),
      };
      const projectedKiroRuntime = isPlainObject(normalizePlainObject(state.flowState).kiro)
        ? normalizePlainObject(state.flowState.kiro)
        : {};
      const canonicalKiroRuntime = deepMerge(
        normalizePlainObject(normalizePlainObject(baseRuntimeState.flowState).kiro),
        projectedKiroRuntime
      );
      if (Object.keys(canonicalKiroRuntime).length > 0) {
        baseRuntimeState.flowState = {
          ...cloneValue(normalizePlainObject(baseRuntimeState.flowState)),
          kiro: canonicalKiroRuntime,
        };
      }
      const activeFlowId = normalizeFlowId(
        Object.prototype.hasOwnProperty.call(state, 'activeFlowId')
          ? state.activeFlowId
          : Object.prototype.hasOwnProperty.call(state, 'flowId')
          ? state.flowId
          : Object.prototype.hasOwnProperty.call(baseRuntimeState, 'activeFlowId')
            ? baseRuntimeState.activeFlowId
          : baseRuntimeState.flowId
      );
      const currentNodeId = String(
        Object.prototype.hasOwnProperty.call(state, 'currentNodeId')
          ? state.currentNodeId
          : baseRuntimeState.currentNodeId
      ).trim();
      const nodeStatuses = normalizeNodeStatuses(
        Object.prototype.hasOwnProperty.call(state, 'nodeStatuses')
          ? state.nodeStatuses
          : baseRuntimeState.nodeStatuses
      );

      return {
        ...baseRuntimeState,
        flowId: activeFlowId,
        activeFlowId,
        runId: normalizeRunId(
          Object.prototype.hasOwnProperty.call(state, 'runId')
            ? state.runId
            : Object.prototype.hasOwnProperty.call(state, 'activeRunId')
              ? state.activeRunId
              : Object.prototype.hasOwnProperty.call(baseRuntimeState, 'runId')
                ? baseRuntimeState.runId
                : baseRuntimeState.activeRunId
        ),
        activeRunId: normalizeRunId(
          Object.prototype.hasOwnProperty.call(state, 'runId')
            ? state.runId
            : Object.prototype.hasOwnProperty.call(state, 'activeRunId')
              ? state.activeRunId
              : Object.prototype.hasOwnProperty.call(baseRuntimeState, 'runId')
                ? baseRuntimeState.runId
                : baseRuntimeState.activeRunId
        ),
        currentNodeId,
        nodeStatuses,
        sharedState: buildSharedState(baseRuntimeState.sharedState, state),
        serviceState: buildServiceState(baseRuntimeState.serviceState, state),
        flowState: buildFlowState(baseRuntimeState.flowState, state),
      };
    }

    function buildPersistentPatchPayload(updates = {}) {
      const next = {};
      for (const [key, value] of Object.entries(normalizePlainObject(updates))) {
        if (RUNTIME_PATCH_IGNORED_KEYS.has(key)) {
          continue;
        }
        next[key] = cloneValue(value);
      }
      return next;
    }

    function buildStateView(state = {}) {
      const runtimeState = ensureRuntimeState(state);
      return {
        ...state,
        ...projectRuntimeViewFields(runtimeState),
        flowId: runtimeState.flowId,
        runId: runtimeState.runId,
        activeFlowId: runtimeState.activeFlowId,
        activeRunId: runtimeState.activeRunId,
        currentNodeId: runtimeState.currentNodeId,
        nodeStatuses: cloneValue(runtimeState.nodeStatuses),
        flowState: cloneValue(runtimeState.flowState),
        sharedState: cloneValue(runtimeState.sharedState),
        serviceState: cloneValue(runtimeState.serviceState),
        flows: cloneValue(runtimeState.flowState),
        shared: cloneValue(runtimeState.sharedState),
        services: cloneValue(runtimeState.serviceState),
        runtimeState,
      };
    }

    function buildSessionStatePatch(currentState = {}, updates = {}) {
      const currentRuntimeState = ensureRuntimeState(currentState);
      const runtimeStateSeed = buildRuntimeStateSeed(currentRuntimeState, updates);
      const runtimeState = ensureRuntimeState({
        runtimeState: runtimeStateSeed,
        ...projectRuntimeViewFields(runtimeStateSeed),
        ...buildRuntimeInputFromPatch(updates),
      });

      return {
        ...buildPersistentPatchPayload(updates),
        flowId: runtimeState.flowId,
        runId: runtimeState.runId,
        activeFlowId: runtimeState.activeFlowId,
        activeRunId: runtimeState.activeRunId,
        currentNodeId: runtimeState.currentNodeId,
        nodeStatuses: cloneValue(runtimeState.nodeStatuses),
        runtimeState,
      };
    }

    return {
      DEFAULT_ACTIVE_FLOW_ID,
      FLOW_FIELD_GROUPS,
      OPENAI_FLOW_FIELD_GROUPS,
      RUNTIME_PROXY_FIELDS,
      RUNTIME_SHARED_FIELDS,
      buildDefaultRuntimeState: buildRuntimeStateDefault,
      buildSessionStatePatch,
      buildStateView,
      ensureRuntimeState,
    };
  }

  return {
    createRuntimeStateHelpers,
  };
});
