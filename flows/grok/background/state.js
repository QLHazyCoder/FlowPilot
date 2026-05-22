(function attachBackgroundGrokState(root, factory) {
  root.MultiPageBackgroundGrokState = factory();
})(typeof self !== 'undefined' ? self : globalThis, function createBackgroundGrokStateModule() {
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

  function deepMerge(baseValue, patchValue) {
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
      next[key] = deepMerge(baseObject[key], value);
    });
    return next;
  }

  function cleanString(value = '') {
    return String(value ?? '').trim();
  }

  function normalizeInteger(value, fallback = 0) {
    const numeric = Math.floor(Number(value));
    return Number.isInteger(numeric) ? numeric : fallback;
  }

  function normalizeNullableInteger(value, fallback = null) {
    if (value === null || value === undefined || value === '') {
      return fallback;
    }
    const numeric = Math.floor(Number(value));
    return Number.isInteger(numeric) ? numeric : fallback;
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

  function buildDefaultRuntimeState() {
    return {
      session: {
        registerTabId: null,
        startedAt: 0,
        pageState: '',
        pageUrl: '',
        lastError: '',
      },
      register: {
        email: '',
        firstName: '',
        lastName: '',
        password: '',
        verificationRequestedAt: 0,
        verificationCode: '',
        status: '',
        completedAt: 0,
      },
      sso: {
        currentCookie: '',
        cookies: [],
        extractedAt: 0,
      },
    };
  }

  function normalizeRuntimeState(runtimeState = {}) {
    const merged = deepMerge(buildDefaultRuntimeState(), runtimeState);
    return {
      session: {
        registerTabId: normalizeNullableInteger(merged.session?.registerTabId),
        startedAt: Math.max(0, normalizeInteger(merged.session?.startedAt)),
        pageState: cleanString(merged.session?.pageState),
        pageUrl: cleanString(merged.session?.pageUrl),
        lastError: cleanString(merged.session?.lastError),
      },
      register: {
        email: cleanString(merged.register?.email).toLowerCase(),
        firstName: cleanString(merged.register?.firstName),
        lastName: cleanString(merged.register?.lastName),
        password: cleanString(merged.register?.password),
        verificationRequestedAt: Math.max(0, normalizeInteger(merged.register?.verificationRequestedAt)),
        verificationCode: cleanString(merged.register?.verificationCode),
        status: cleanString(merged.register?.status),
        completedAt: Math.max(0, normalizeInteger(merged.register?.completedAt)),
      },
      sso: {
        currentCookie: cleanString(merged.sso?.currentCookie || merged.ssoCookie),
        cookies: normalizeSsoCookies(merged.sso?.cookies || merged.ssoCookies),
        extractedAt: Math.max(0, normalizeInteger(merged.sso?.extractedAt)),
      },
    };
  }

  function buildCanonicalRuntimeStatePatch(state = {}, runtimeState = {}) {
    const normalizedRuntimeState = normalizeRuntimeState(runtimeState);
    const baseRuntimeState = isPlainObject(state?.runtimeState)
      ? cloneValue(state.runtimeState)
      : {};
    const baseFlowState = isPlainObject(baseRuntimeState.flowState)
      ? cloneValue(baseRuntimeState.flowState)
      : {};
    return {
      ...baseRuntimeState,
      flowState: {
        ...baseFlowState,
        grok: normalizedRuntimeState,
      },
    };
  }

  function projectRuntimeFields(runtimeState = {}) {
    const normalizedRuntimeState = normalizeRuntimeState(runtimeState);
    return {
      grokRegisterTabId: normalizedRuntimeState.session.registerTabId,
      grokPageState: normalizedRuntimeState.session.pageState,
      grokPageUrl: normalizedRuntimeState.session.pageUrl,
      grokEmail: normalizedRuntimeState.register.email,
      grokFirstName: normalizedRuntimeState.register.firstName,
      grokLastName: normalizedRuntimeState.register.lastName,
      grokPassword: normalizedRuntimeState.register.password,
      grokVerificationRequestedAt: normalizedRuntimeState.register.verificationRequestedAt,
      grokVerificationCode: normalizedRuntimeState.register.verificationCode,
      grokRegisterStatus: normalizedRuntimeState.register.status,
      grokCompletedAt: normalizedRuntimeState.register.completedAt,
      grokSsoCookie: normalizedRuntimeState.sso.currentCookie,
      grokSsoCookies: normalizedRuntimeState.sso.cookies,
      grokSsoExtractedAt: normalizedRuntimeState.sso.extractedAt,
    };
  }

  function ensureRuntimeState(state = {}) {
    const runtimeFlowState = isPlainObject(state?.runtimeState?.flowState)
      ? state.runtimeState.flowState
      : {};
    const legacyFlowState = isPlainObject(state?.flowState?.grok)
      ? state.flowState.grok
      : {};
    const flatRuntime = {
      session: {
        registerTabId: state.grokRegisterTabId,
        pageState: state.grokPageState,
        pageUrl: state.grokPageUrl || state.grokPostVerificationUrl,
      },
      register: {
        email: state.grokEmail || state.email,
        firstName: state.grokFirstName,
        lastName: state.grokLastName,
        password: state.grokPassword,
        verificationRequestedAt: state.grokVerificationRequestedAt,
        verificationCode: state.grokVerificationCode,
        status: state.grokRegisterStatus,
        completedAt: state.grokCompletedAt,
      },
      sso: {
        currentCookie: state.grokSsoCookie,
        cookies: state.grokSsoCookies,
        extractedAt: state.grokSsoExtractedAt || state.grokCompletedAt,
      },
    };
    return normalizeRuntimeState(deepMerge(deepMerge(runtimeFlowState.grok || {}, legacyFlowState), flatRuntime));
  }

  function buildStateView(state = {}) {
    const runtimeState = ensureRuntimeState(state);
    const canonicalRuntimeState = buildCanonicalRuntimeStatePatch(state, runtimeState);
    return {
      ...state,
      ...projectRuntimeFields(runtimeState),
      runtimeState: canonicalRuntimeState,
      flowState: {
        ...(isPlainObject(state?.flowState) ? state.flowState : {}),
        grok: runtimeState,
      },
      flows: {
        ...(isPlainObject(state?.flows) ? state.flows : {}),
        grok: runtimeState,
      },
    };
  }

  function buildRuntimeStatePatch(currentState = {}, patch = {}) {
    if (!isPlainObject(patch)) {
      return {};
    }
    const nextRuntimeState = normalizeRuntimeState(
      deepMerge(ensureRuntimeState(currentState), patch)
    );
    return {
      ...projectRuntimeFields(nextRuntimeState),
      runtimeState: buildCanonicalRuntimeStatePatch(currentState, nextRuntimeState),
    };
  }

  function buildSessionStatePatch(currentState = {}, updates = {}) {
    const runtimePatch = isPlainObject(updates?.runtimeState?.flowState?.grok)
      ? updates.runtimeState.flowState.grok
      : (isPlainObject(updates?.flowState?.grok) ? updates.flowState.grok : null);
    if (!runtimePatch) {
      return {};
    }
    return buildRuntimeStatePatch(currentState, runtimePatch);
  }

  function buildRuntimeResetPatch(currentState = {}, patch = {}) {
    return buildRuntimeStatePatch(currentState, patch);
  }

  function buildStartRegisterResetPatch(currentState = {}) {
    return buildRuntimeStatePatch(currentState, buildDefaultRuntimeState());
  }

  function buildRegisterOnlyResetPatch(currentState = {}, registerPatch = {}) {
    const currentRuntimeState = ensureRuntimeState(currentState);
    return buildRuntimeStatePatch(currentState, {
      ...currentRuntimeState,
      session: {
        ...currentRuntimeState.session,
        pageState: '',
        pageUrl: '',
        lastError: '',
      },
      register: {
        ...buildDefaultRuntimeState().register,
        email: currentRuntimeState.register?.email || '',
        ...registerPatch,
      },
    });
  }

  function buildSsoResetPatch(currentState = {}) {
    const currentRuntimeState = ensureRuntimeState(currentState);
    return buildRuntimeStatePatch(currentState, {
      ...currentRuntimeState,
      sso: buildDefaultRuntimeState().sso,
    });
  }

  function buildDownstreamResetPatch(stepKey = '', currentState = {}) {
    switch (cleanString(stepKey)) {
      case 'grok-open-signup-page':
        return {
          flowStartTime: null,
          ...buildStartRegisterResetPatch(currentState),
        };
      case 'grok-submit-email':
        return buildRegisterOnlyResetPatch(currentState, {
          email: '',
        });
      case 'grok-submit-verification-code':
        return buildRegisterOnlyResetPatch(currentState, {});
      case 'grok-submit-profile':
      case 'grok-extract-sso-cookie':
        return buildSsoResetPatch(currentState);
      default:
        return {};
    }
  }

  function applyNodeCompletionPayload(currentState = {}, payload = {}) {
    const runtimePatch = isPlainObject(payload?.runtimeState?.flowState?.grok)
      ? payload.runtimeState.flowState.grok
      : (isPlainObject(payload?.flowState?.grok) ? payload.flowState.grok : null);
    if (runtimePatch) {
      return buildRuntimeStatePatch(currentState, runtimePatch);
    }

    const patch = {};
    if (Object.prototype.hasOwnProperty.call(payload, 'grokRegisterTabId')) {
      patch.session = { ...(patch.session || {}), registerTabId: payload.grokRegisterTabId };
    }
    if (Object.prototype.hasOwnProperty.call(payload, 'grokPageState')) {
      patch.session = { ...(patch.session || {}), pageState: payload.grokPageState };
    }
    if (Object.prototype.hasOwnProperty.call(payload, 'grokPageUrl') || Object.prototype.hasOwnProperty.call(payload, 'grokSignupUrl') || Object.prototype.hasOwnProperty.call(payload, 'grokPostVerificationUrl')) {
      patch.session = {
        ...(patch.session || {}),
        pageUrl: payload.grokPageUrl || payload.grokPostVerificationUrl || payload.grokSignupUrl || '',
      };
    }
    if (Object.prototype.hasOwnProperty.call(payload, 'grokEmail') || Object.prototype.hasOwnProperty.call(payload, 'email')) {
      patch.register = {
        ...(patch.register || {}),
        email: payload.grokEmail || payload.email || '',
      };
    }
    if (Object.prototype.hasOwnProperty.call(payload, 'grokFirstName')) {
      patch.register = { ...(patch.register || {}), firstName: payload.grokFirstName };
    }
    if (Object.prototype.hasOwnProperty.call(payload, 'grokLastName')) {
      patch.register = { ...(patch.register || {}), lastName: payload.grokLastName };
    }
    if (Object.prototype.hasOwnProperty.call(payload, 'grokPassword')) {
      patch.register = { ...(patch.register || {}), password: payload.grokPassword };
    }
    if (Object.prototype.hasOwnProperty.call(payload, 'grokVerificationRequestedAt')) {
      patch.register = {
        ...(patch.register || {}),
        verificationRequestedAt: payload.grokVerificationRequestedAt,
      };
    }
    if (Object.prototype.hasOwnProperty.call(payload, 'grokVerificationCode')) {
      patch.register = { ...(patch.register || {}), verificationCode: payload.grokVerificationCode };
    }
    if (Object.prototype.hasOwnProperty.call(payload, 'grokRegisterStatus')) {
      patch.register = { ...(patch.register || {}), status: payload.grokRegisterStatus };
    }
    if (Object.prototype.hasOwnProperty.call(payload, 'grokCompletedAt')) {
      patch.register = { ...(patch.register || {}), completedAt: payload.grokCompletedAt };
    }
    if (Object.prototype.hasOwnProperty.call(payload, 'grokSsoCookie')) {
      patch.sso = { ...(patch.sso || {}), currentCookie: payload.grokSsoCookie };
    }
    if (Object.prototype.hasOwnProperty.call(payload, 'grokSsoCookies')) {
      patch.sso = { ...(patch.sso || {}), cookies: payload.grokSsoCookies };
    }
    if (Object.prototype.hasOwnProperty.call(payload, 'grokSsoExtractedAt') || Object.prototype.hasOwnProperty.call(payload, 'grokCompletedAt')) {
      patch.sso = {
        ...(patch.sso || {}),
        extractedAt: payload.grokSsoExtractedAt || payload.grokCompletedAt || 0,
      };
    }
    if (!Object.keys(patch).length) {
      return {};
    }
    return buildRuntimeStatePatch(currentState, patch);
  }

  function buildFreshKeepState(currentState = {}) {
    const currentRuntimeState = ensureRuntimeState(currentState);
    const nextRuntimeState = buildDefaultRuntimeState();
    nextRuntimeState.sso = currentRuntimeState.sso || buildDefaultRuntimeState().sso;
    return buildRuntimeStatePatch(currentState, nextRuntimeState);
  }

  return {
    applyNodeCompletionPayload,
    buildDefaultRuntimeState,
    buildDownstreamResetPatch,
    buildFreshKeepState,
    buildRuntimeStatePatch,
    buildSessionStatePatch,
    buildStateView,
    ensureRuntimeState,
    normalizeSsoCookies,
    projectRuntimeFields,
  };
});
