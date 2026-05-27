(function attachBackgroundContributionOAuth(root, factory) {
  root.MultiPageBackgroundContributionOAuth = factory();
})(typeof self !== 'undefined' ? self : globalThis, function createBackgroundContributionOAuthModule() {
  const API_BASE_URL = 'https://flowpilot.qlhazycoder.top/oauth/api';
  const ACTIVE_STATUSES = new Set(['started', 'waiting', 'processing']);
  const FINAL_STATUSES = new Set(['auto_approved', 'auto_rejected', 'manual_review_required', 'expired', 'error']);
  const CALLBACK_FINAL_STATUSES = new Set(['submitted']);
  const CALLBACK_WAITING_STATUSES = new Set(['idle', 'waiting', 'captured', 'failed', 'submitting']);

  const RUNTIME_DEFAULTS = {
    accountContributionEnabled: false,
    accountContributionExpected: false,
    contributionAdapterId: '',
    flowContributionRuntime: {},
    contributionSource: 'sub2api',
    contributionTargetGroupName: 'codex pool',
    contributionNickname: '',
    contributionQq: '',
    contributionSessionId: '',
    contributionAuthUrl: '',
    contributionAuthState: '',
    contributionCallbackUrl: '',
    contributionStatus: '',
    contributionStatusMessage: '',
    contributionLastPollAt: 0,
    contributionCallbackStatus: 'idle',
    contributionCallbackMessage: '',
    contributionAuthOpenedAt: 0,
    contributionAuthTabId: 0,
  };

  const RUNTIME_KEYS = Object.keys(RUNTIME_DEFAULTS);

  function createContributionOAuthManager(deps = {}) {
    const {
      addLog,
      broadcastDataUpdate,
      chrome,
      closeLocalhostCallbackTabs,
      createAutomationTab = null,
      getState,
      setState,
    } = deps;

    let listenersBound = false;
    const pendingCallbackSubmissions = new Map();
    const pendingCapturedCallbacks = new Map();

    function normalizeString(value = '') {
      return String(value || '').trim();
    }

    function normalizePositiveInteger(value, fallback = 0) {
      const numeric = Math.floor(Number(value) || 0);
      return numeric > 0 ? numeric : fallback;
    }

    function normalizeContributionStatus(value = '') {
      const normalized = normalizeString(value).toLowerCase();
      switch (normalized) {
        case 'started':
          return 'started';
        case 'waiting':
        case 'wait':
          return 'waiting';
        case 'processing':
          return 'processing';
        case 'auto_approved':
        case 'approved':
          return 'auto_approved';
        case 'auto_rejected':
        case 'rejected':
          return 'auto_rejected';
        case 'manual_review_required':
        case 'manual_review':
          return 'manual_review_required';
        case 'expired':
        case 'timeout':
          return 'expired';
        case 'error':
        case 'failed':
          return 'error';
        default:
          return '';
      }
    }

    function normalizeContributionCallbackStatus(value = '') {
      const normalized = normalizeString(value).toLowerCase();
      switch (normalized) {
        case 'idle':
          return 'idle';
        case 'waiting':
        case 'pending':
          return 'waiting';
        case 'captured':
          return 'captured';
        case 'submitting':
        case 'processing':
          return 'submitting';
        case 'submitted':
        case 'success':
        case 'done':
          return 'submitted';
        case 'failed':
        case 'error':
          return 'failed';
        default:
          return '';
      }
    }

    function isContributionFinalStatus(status = '') {
      return FINAL_STATUSES.has(normalizeContributionStatus(status));
    }

    function getStatusLabel(status = '') {
      switch (normalizeContributionStatus(status)) {
        case 'started':
          return 'Login URL generated';
        case 'waiting':
          return 'Waiting for callback submission';
        case 'processing':
          return 'Callback submitted, waiting for CPA confirmation';
        case 'auto_approved':
          return 'Contribution succeeded, CPA confirmed';
        case 'auto_rejected':
          return 'Contribution failed confirmation';
        case 'manual_review_required':
          return 'Submitted, waiting for manual review';
        case 'expired':
          return 'Contribution session expired';
        case 'error':
          return 'Contribution flow failed';
        default:
          return 'Waiting to start contribution';
      }
    }

    function getCallbackLabel(status = '') {
      switch (normalizeContributionCallbackStatus(status)) {
        case 'waiting':
        case 'idle':
          return 'Waiting for callback';
        case 'captured':
          return 'Callback URL captured';
        case 'submitting':
          return 'Submitting callback';
        case 'submitted':
          return 'Callback submitted';
        case 'failed':
          return 'Callback submission failed';
        default:
          return 'Waiting for callback';
      }
    }

    function unwrapPayload(payload) {
      if (!payload || typeof payload !== 'object' || Array.isArray(payload)) {
        return {};
      }

      if (payload.data && typeof payload.data === 'object' && !Array.isArray(payload.data)) {
        return { ...payload.data, ...payload };
      }

      return payload;
    }

    function getErrorMessage(payload, responseStatus = 500) {
      const details = [
        payload?.message,
        payload?.detail,
        payload?.error,
        payload?.reason,
      ]
        .map((item) => normalizeString(item))
        .find(Boolean);

      if (details) {
        return details;
      }

      return `Contribution service request failed (HTTP ${responseStatus}).`;
    }

    async function fetchContributionJson(endpoint, options = {}) {
      const controller = new AbortController();
      const timeoutMs = Math.max(1000, Math.floor(Number(options.timeoutMs) || 15000));
      const timer = setTimeout(() => controller.abort(), timeoutMs);

      try {
        const response = await fetch(`${API_BASE_URL}${endpoint}`, {
          method: options.method || 'GET',
          headers: {
            Accept: 'application/json',
            ...(options.body ? { 'Content-Type': 'application/json' } : {}),
          },
          body: options.body ? JSON.stringify(options.body) : undefined,
          signal: controller.signal,
        });

        let rawPayload = {};
        try {
          rawPayload = await response.json();
        } catch {
          rawPayload = {};
        }

        const payload = unwrapPayload(rawPayload);
        if (!response.ok || payload.ok === false) {
          const error = new Error(getErrorMessage(payload, response.status));
          error.payload = payload;
          error.responseStatus = response.status;
          throw error;
        }

        return payload;
      } catch (error) {
        if (error?.name === 'AbortError') {
          throw new Error('Contribution service request timed out. Please retry later.');
        }
        throw error;
      } finally {
        clearTimeout(timer);
      }
    }

    function pickContributionState(state = {}) {
      const picked = {};
      for (const key of RUNTIME_KEYS) {
        picked[key] = state[key] !== undefined ? state[key] : RUNTIME_DEFAULTS[key];
      }
      return picked;
    }

    async function applyRuntimeUpdates(updates = {}) {
      if (!updates || typeof updates !== 'object' || Array.isArray(updates) || Object.keys(updates).length === 0) {
        return getState();
      }

      await setState(updates);
      broadcastDataUpdate(updates);
      return getState();
    }

    function extractAuthStateFromUrl(authUrl = '') {
      try {
        return new URL(authUrl).searchParams.get('state') || '';
      } catch {
        return '';
      }
    }

    function buildNickname(state = {}, preferredNickname = '') {
      const nickname = normalizeString(preferredNickname)
        || normalizeString(state.contributionNickname);
      return nickname || '';
    }

    function buildContributionQq(state = {}, preferredQq = '') {
      const qq = normalizeString(preferredQq) || normalizeString(state.contributionQq);
      return qq;
    }

    function isPlusModeState(state = {}) {
      return Boolean(state?.plusModeEnabled);
    }

    function normalizeOpenAiContributionSource(value = '') {
      const normalized = normalizeString(value).toLowerCase();
      return normalized === 'sub2api' ? 'sub2api' : 'cpa';
    }

    function resolveOpenAiContributionRoutingState(state = {}) {
      const currentStatus = normalizeString(state?.contributionStatus).toLowerCase();
      const currentSource = normalizeOpenAiContributionSource(state?.contributionSource);
      const hasActiveSession = Boolean(
        normalizeString(state?.contributionSessionId)
        && currentStatus
        && !FINAL_STATUSES.has(currentStatus)
      );

      if (hasActiveSession) {
        return {
          source: currentSource,
          targetGroupName: currentSource === 'sub2api'
            ? (normalizeString(state?.contributionTargetGroupName) || 'codex pool')
            : '',
        };
      }

      return {
        source: 'sub2api',
        targetGroupName: isPlusModeState(state)
          ? 'openai-plus'
          : (normalizeString(state?.contributionTargetGroupName) || 'codex pool'),
      };
    }

    function buildStatusMessage(status, payload = {}) {
      const label = getStatusLabel(status);
      const details = [
        payload.status_message,
        payload.statusMessage,
        payload.message,
        payload.detail,
        payload.reason,
      ]
        .map((item) => normalizeString(item))
        .find(Boolean);

      if (!details || details === label) {
        return label;
      }

      return `${label}: ${details}`;
    }

    function buildCallbackMessage(status, payload = {}) {
      const label = getCallbackLabel(status);
      const details = [
        payload.callback_message,
        payload.callbackMessage,
        payload.message,
        payload.detail,
        payload.reason,
      ]
        .map((item) => normalizeString(item))
        .find(Boolean);

      if (!details || details === label) {
        return label;
      }

      return `${label}: ${details}`;
    }

    function deriveCallbackState(payload = {}, state = {}) {
      const existingStatus = normalizeContributionCallbackStatus(state.contributionCallbackStatus);
      const callbackUrl = normalizeString(
        payload.callback_url
        || payload.callbackUrl
        || state.contributionCallbackUrl
      );
      const explicitStatus = normalizeContributionCallbackStatus(
        payload.callback_status
        || payload.callbackStatus
      );

      if (explicitStatus) {
        return {
          status: explicitStatus,
          message: buildCallbackMessage(explicitStatus, payload),
          callbackUrl,
        };
      }

      if (payload.callback_submitted === true || payload.callbackSubmitted === true) {
        return {
          status: 'submitted',
          message: buildCallbackMessage('submitted', payload),
          callbackUrl,
        };
      }

      if (callbackUrl) {
        return {
          status: CALLBACK_FINAL_STATUSES.has(existingStatus) ? existingStatus : 'captured',
          message: buildCallbackMessage(CALLBACK_FINAL_STATUSES.has(existingStatus) ? existingStatus : 'captured', payload),
          callbackUrl,
        };
      }

      if (CALLBACK_FINAL_STATUSES.has(existingStatus) || existingStatus === 'failed') {
        return {
          status: existingStatus,
          message: normalizeString(state.contributionCallbackMessage) || buildCallbackMessage(existingStatus),
          callbackUrl: normalizeString(state.contributionCallbackUrl),
        };
      }

      return {
        status: 'waiting',
        message: buildCallbackMessage('waiting', payload),
        callbackUrl: '',
      };
    }

    function isContributionCallbackUrl(rawUrl, state = {}) {
      const urlText = normalizeString(rawUrl);
      if (!urlText) {
        return false;
      }

      let parsed;
      try {
        parsed = new URL(urlText);
      } catch {
        return false;
      }

      if (!['http:', 'https:'].includes(parsed.protocol)) {
        return false;
      }

      const code = normalizeString(parsed.searchParams.get('code'));
      const errorText = normalizeString(parsed.searchParams.get('error'))
        || normalizeString(parsed.searchParams.get('error_description'));
      const authState = normalizeString(parsed.searchParams.get('state'));
      if ((!code && !errorText) || !authState) {
        return false;
      }

      const hostLooksLocal = ['localhost', '127.0.0.1'].includes(parsed.hostname);
      const pathLooksLikeCallback = /callback/i.test(parsed.pathname || '');
      if (!hostLooksLocal && !pathLooksLikeCallback) {
        return false;
      }

      const expectedState = normalizeString(state.contributionAuthState);
      return !expectedState || expectedState === authState;
    }

    async function openContributionAuthUrl(authUrl, options = {}) {
      const normalizedUrl = normalizeString(authUrl);
      if (!normalizedUrl) {
        throw new Error('Contribution service did not return a valid login URL.');
      }

      const currentState = options.stateOverride || await getState();
      const preferredTabId = normalizePositiveInteger(options.tabId || currentState.contributionAuthTabId, 0);
      let tab = null;

      if (preferredTabId) {
        tab = await chrome.tabs.update(preferredTabId, {
          url: normalizedUrl,
          active: true,
        }).catch(() => null);
      }

      if (!tab) {
        tab = typeof createAutomationTab === 'function'
          ? await createAutomationTab({ url: normalizedUrl, active: true })
          : await chrome.tabs.create({ url: normalizedUrl, active: true });
      }

      await applyRuntimeUpdates({
        contributionAuthUrl: normalizedUrl,
        contributionAuthOpenedAt: Date.now(),
        contributionAuthTabId: normalizePositiveInteger(tab?.id, 0),
      });

      return tab;
    }

    async function fetchContributionResult(sessionId) {
      try {
        return await fetchContributionJson(`/result?session_id=${encodeURIComponent(sessionId)}`);
      } catch (error) {
        if (typeof addLog === 'function') {
          await addLog(`Contribution mode: Failed to fetch final result: ${error.message}`, 'warn');
        }
        return null;
      }
    }

    async function submitContributionCallback(callbackUrl, options = {}) {
      const currentState = options.stateOverride || await getState();
      const sessionId = normalizeString(currentState.contributionSessionId);
      const normalizedUrl = normalizeString(callbackUrl);

      if (!sessionId || !normalizedUrl) {
        return currentState;
      }

      const currentCallbackStatus = normalizeContributionCallbackStatus(currentState.contributionCallbackStatus);
      if (CALLBACK_FINAL_STATUSES.has(currentCallbackStatus) || currentCallbackStatus === 'submitting') {
        return currentState;
      }

      const dedupeKey = `${sessionId}::${normalizedUrl}`;
      if (pendingCallbackSubmissions.has(dedupeKey)) {
        return pendingCallbackSubmissions.get(dedupeKey);
      }

      const task = (async () => {
        await applyRuntimeUpdates({
          contributionCallbackUrl: normalizedUrl,
          contributionCallbackStatus: 'submitting',
          contributionCallbackMessage: buildCallbackMessage('submitting'),
        });

        try {
          const payload = await fetchContributionJson('/submit-callback', {
            method: 'POST',
            body: {
              session_id: sessionId,
              callback_url: normalizedUrl,
            },
          });

          const nextStatus = 'submitted';
          await applyRuntimeUpdates({
            contributionCallbackUrl: normalizedUrl,
            contributionCallbackStatus: nextStatus,
            contributionCallbackMessage: buildCallbackMessage(nextStatus, payload),
          });

          if (typeof closeLocalhostCallbackTabs === 'function') {
            await closeLocalhostCallbackTabs(normalizedUrl).catch(() => {});
          }

          return await pollContributionStatus({ reason: options.reason || 'submit_callback' });
        } catch (error) {
          await applyRuntimeUpdates({
            contributionCallbackUrl: normalizedUrl,
            contributionCallbackStatus: 'failed',
            contributionCallbackMessage: `Callback submission failed: ${error.message}`,
          });

          if (typeof addLog === 'function') {
            await addLog(`Contribution mode: Callback submission failed: ${error.message}`, 'warn');
          }

          throw error;
        } finally {
          pendingCallbackSubmissions.delete(dedupeKey);
        }
      })();

      pendingCallbackSubmissions.set(dedupeKey, task);
      return task;
    }

    async function handleCapturedCallback(rawUrl, metadata = {}) {
      const currentState = await getState();
      if (!normalizeString(currentState.contributionSessionId) || !currentState.accountContributionEnabled) {
        return currentState;
      }
      if (!isContributionCallbackUrl(rawUrl, currentState)) {
        return currentState;
      }

      const normalizedUrl = normalizeString(rawUrl);
      const callbackDedupeKey = `${normalizeString(currentState.contributionSessionId)}::${normalizedUrl}`;
      if (pendingCapturedCallbacks.has(callbackDedupeKey)) {
        return pendingCapturedCallbacks.get(callbackDedupeKey);
      }
      if (pendingCallbackSubmissions.has(callbackDedupeKey)) {
        return pendingCallbackSubmissions.get(callbackDedupeKey);
      }
      const currentCallbackStatus = normalizeContributionCallbackStatus(currentState.contributionCallbackStatus);
      if (
        normalizedUrl
        && normalizeString(currentState.contributionCallbackUrl) === normalizedUrl
        && (CALLBACK_FINAL_STATUSES.has(currentCallbackStatus) || currentCallbackStatus === 'submitting')
      ) {
        return currentState;
      }

      const task = (async () => {
        await applyRuntimeUpdates({
          contributionCallbackUrl: normalizedUrl,
          contributionCallbackStatus: 'captured',
          contributionCallbackMessage: buildCallbackMessage('captured'),
        });

        if (typeof addLog === 'function') {
          await addLog(`Contribution mode: Captured callback URL (${metadata.source || 'unknown'}).`, 'info');
        }

        try {
          return await submitContributionCallback(normalizedUrl, {
            reason: metadata.source || 'navigation',
            stateOverride: await getState(),
          });
        } catch {
          return getState();
        } finally {
          pendingCapturedCallbacks.delete(callbackDedupeKey);
        }
      })();

      pendingCapturedCallbacks.set(callbackDedupeKey, task);
      return task;
    }

    async function pollContributionStatus(options = {}) {
      const currentState = options.stateOverride || await getState();
      const sessionId = normalizeString(currentState.contributionSessionId);
      if (!sessionId) {
        return currentState;
      }

      const payload = await fetchContributionJson(`/status?session_id=${encodeURIComponent(sessionId)}`);
      const nextStatus = normalizeContributionStatus(payload.status || payload.state || payload.phase) || currentState.contributionStatus || 'waiting';
      let finalPayload = null;

      if (isContributionFinalStatus(nextStatus)) {
        finalPayload = await fetchContributionResult(sessionId);
      }

      const mergedPayload = finalPayload ? { ...payload, ...finalPayload } : payload;
      const normalizedStatus = normalizeContributionStatus(mergedPayload.status || mergedPayload.state || mergedPayload.phase) || nextStatus;
      const callbackState = deriveCallbackState(mergedPayload, currentState);
      const updates = {
        contributionLastPollAt: Date.now(),
        contributionStatus: normalizedStatus,
        contributionStatusMessage: buildStatusMessage(normalizedStatus, mergedPayload),
        contributionCallbackUrl: callbackState.callbackUrl,
        contributionCallbackStatus: callbackState.status,
        contributionCallbackMessage: callbackState.message,
      };

      const authUrl = normalizeString(mergedPayload.auth_url || mergedPayload.authUrl);
      if (authUrl) {
        updates.contributionAuthUrl = authUrl;
      }

      const authState = normalizeString(mergedPayload.state || mergedPayload.auth_state || mergedPayload.authState)
        || (authUrl ? extractAuthStateFromUrl(authUrl) : '');
      if (authState) {
        updates.contributionAuthState = authState;
      }

      await applyRuntimeUpdates(updates);
      const nextState = await getState();

      if (
        normalizeString(nextState.contributionCallbackUrl)
        && CALLBACK_WAITING_STATUSES.has(normalizeContributionCallbackStatus(nextState.contributionCallbackStatus))
      ) {
        try {
          return await submitContributionCallback(nextState.contributionCallbackUrl, {
            reason: options.reason || 'status_poll',
            stateOverride: nextState,
          });
        } catch {
          return getState();
        }
      }

      return nextState;
    }

    async function startFlowContribution(options = {}) {
      const currentState = options.stateOverride || await getState();
      const shouldOpenAuthTab = options.openAuthTab !== false;
      if (!currentState.accountContributionEnabled) {
        throw new Error('Please enable contribution mode first.');
      }

      const currentSessionId = normalizeString(currentState.contributionSessionId);
      const currentStatus = normalizeContributionStatus(currentState.contributionStatus);
      if (currentSessionId && ACTIVE_STATUSES.has(currentStatus)) {
        if (normalizeString(currentState.contributionAuthUrl)) {
          if (shouldOpenAuthTab) {
            await openContributionAuthUrl(currentState.contributionAuthUrl, {
              stateOverride: currentState,
            }).catch(() => null);
          }
        }
        return pollContributionStatus({ reason: 'resume_existing' });
      }

      const routingState = resolveOpenAiContributionRoutingState(currentState);
      const payload = await fetchContributionJson('/start', {
        method: 'POST',
        body: {
          nickname: buildNickname(currentState, options.nickname),
          qq: buildContributionQq(currentState, options.qq),
          email: normalizeString(currentState.email),
          source: routingState.source,
          target_group_name: routingState.targetGroupName,
          channel: 'codex-extension',
        },
      });

      const sessionId = normalizeString(payload.session_id || payload.sessionId);
      const authUrl = normalizeString(payload.auth_url || payload.authUrl);
      const authState = normalizeString(payload.state || payload.auth_state || payload.authState) || extractAuthStateFromUrl(authUrl);
      if (!sessionId || !authUrl) {
        throw new Error('Contribution service did not return a valid session_id or auth_url.');
      }

      await applyRuntimeUpdates({
        contributionSessionId: sessionId,
        contributionAuthUrl: authUrl,
        contributionAuthState: authState,
        contributionCallbackUrl: '',
        contributionStatus: normalizeContributionStatus(payload.status) || 'started',
        contributionStatusMessage: buildStatusMessage(normalizeContributionStatus(payload.status) || 'started', payload),
        contributionLastPollAt: 0,
        contributionCallbackStatus: 'waiting',
        contributionCallbackMessage: buildCallbackMessage('waiting'),
        contributionAuthOpenedAt: 0,
        contributionAuthTabId: 0,
      });

      if (shouldOpenAuthTab) {
        await openContributionAuthUrl(authUrl);
      }
      return pollContributionStatus({ reason: 'after_start' });
    }

    function onNavigationEvent(details = {}, source) {
      if (details?.frameId !== undefined && Number(details.frameId) !== 0) {
        return;
      }
      handleCapturedCallback(details?.url || '', {
        source,
        tabId: normalizePositiveInteger(details?.tabId, 0),
      }).catch(() => {});
    }

    function onTabUpdated(tabId, changeInfo, tab) {
      const candidateUrl = normalizeString(changeInfo?.url || tab?.url);
      if (!candidateUrl) {
        return;
      }
      handleCapturedCallback(candidateUrl, {
        source: 'tabs.onUpdated',
        tabId: normalizePositiveInteger(tabId, 0),
      }).catch(() => {});
    }

    function ensureCallbackListeners() {
      if (listenersBound) {
        return;
      }

      chrome.webNavigation.onCommitted.addListener((details) => {
        onNavigationEvent(details, 'webNavigation.onCommitted');
      });
      chrome.webNavigation.onHistoryStateUpdated.addListener((details) => {
        onNavigationEvent(details, 'webNavigation.onHistoryStateUpdated');
      });
      chrome.tabs.onUpdated.addListener(onTabUpdated);
      listenersBound = true;
    }

    return {
      ensureCallbackListeners,
      handleCapturedCallback,
      isContributionCallbackUrl,
      isContributionFinalStatus,
      pollContributionStatus,
      startFlowContribution,
      submitContributionCallback,
    };
  }

  return {
    ACTIVE_STATUSES,
    FINAL_STATUSES,
    RUNTIME_DEFAULTS,
    RUNTIME_KEYS,
    createContributionOAuthManager,
  };
});
