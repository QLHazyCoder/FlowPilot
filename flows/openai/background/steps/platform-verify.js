(function attachBackgroundStep10(root, factory) {
  root.MultiPageBackgroundStep10 = factory();
})(typeof self !== 'undefined' ? self : globalThis, function createBackgroundStep10Module() {
  function createStep10Executor(deps = {}) {
    const {
      addLog,
      chrome,
      closeConflictingTabsForSource,
      completeNodeFromBackground,
      ensureContentScriptReadyOnTab,
      getPanelMode,
      getTabId,
      getStepIdByKeyForState,
      isLocalhostOAuthCallbackUrl,
      isTabAlive,
      normalizeCodex2ApiUrl,
      normalizeSub2ApiUrl,
      rememberSourceLastUrl,
      reuseOrCreateTab,
      sendToContentScript,
      sendToContentScriptResilient,
      shouldBypassStep9ForLocalCpa,
      DEFAULT_SUB2API_GROUP_NAME = 'codex',
      SUB2API_STEP9_RESPONSE_TIMEOUT_MS,
    } = deps;

    let sub2ApiApi = null;

    function getSub2ApiApi() {
      if (sub2ApiApi) {
        return sub2ApiApi;
      }
      const factory = deps.createSub2ApiApi
        || self.MultiPageBackgroundSub2ApiApi?.createSub2ApiApi;
      if (typeof factory !== 'function') {
        throw new Error('SUB2API direct-connect module is not loaded. Cannot submit the callback.');
      }
      sub2ApiApi = factory({
        addLog,
        normalizeSub2ApiUrl,
        DEFAULT_SUB2API_GROUP_NAME,
      });
      return sub2ApiApi;
    }

    function normalizeString(value = '') {
      return String(value || '').trim();
    }

    function resolvePlatformVerifyStep(state = {}) {
      const visibleStep = Math.floor(Number(state?.visibleStep) || 0);
      return visibleStep >= 10 ? visibleStep : 10;
    }

    function resolveStepIdByKey(state = {}, stepKey = '') {
      if (typeof getStepIdByKeyForState !== 'function') {
        return null;
      }
      const step = Number(getStepIdByKeyForState(stepKey, state));
      return Number.isInteger(step) && step > 0 ? step : null;
    }

    function resolveConfirmOauthStep(platformVerifyStep = 10, state = {}) {
      const dynamicStep = resolveStepIdByKey(state, 'confirm-oauth');
      if (dynamicStep && dynamicStep < Number(platformVerifyStep)) {
        return dynamicStep;
      }
      return Math.max(1, Number(platformVerifyStep) - 1);
    }

    function resolveAuthLoginStep(platformVerifyStep = 10, state = {}) {
      const reloginStep = resolveStepIdByKey(state, 'relogin-bound-email');
      if (reloginStep && reloginStep < Number(platformVerifyStep)) {
        return reloginStep;
      }
      const oauthLoginStep = resolveStepIdByKey(state, 'oauth-login');
      if (oauthLoginStep && oauthLoginStep < Number(platformVerifyStep)) {
        return oauthLoginStep;
      }
      return Number(platformVerifyStep) >= 13 ? 10 : 7;
    }

    function addStepLog(step, message, level = 'info') {
      return addLog(message, level, { step, stepKey: 'platform-verify' });
    }

    function parseLocalhostCallback(rawUrl, platformVerifyStep = 10, state = {}) {
      const confirmOauthStep = resolveConfirmOauthStep(platformVerifyStep, state);
      let parsed;
      try {
        parsed = new URL(rawUrl);
      } catch {
        throw new Error(`Step ${platformVerifyStep}: The captured localhost OAuth callback URL format is invalid. Rerun Step ${confirmOauthStep}.`);
      }

      const code = normalizeString(parsed.searchParams.get('code'));
      const oauthState = normalizeString(parsed.searchParams.get('state'));
      if (!code || !oauthState) {
        throw new Error(`Step ${platformVerifyStep}: The captured localhost OAuth callback URL is missing code or state. Rerun Step ${confirmOauthStep}.`);
      }

      return {
        url: parsed.toString(),
        code,
        state: oauthState,
      };
    }

    function getCodex2ApiErrorMessage(payload, responseStatus = 500) {
      const details = [
        payload?.error,
        payload?.message,
        payload?.detail,
        payload?.reason,
      ]
        .map((value) => normalizeString(value))
        .find(Boolean);
      return details || `Codex2API request failed (HTTP ${responseStatus}).`;
    }

    function deriveCpaManagementOrigin(vpsUrl) {
      const normalizedUrl = normalizeString(vpsUrl);
      if (!normalizedUrl) {
        throw new Error('CPA URL is not filled in yet. Enter it in the side panel first.');
      }
      let parsed;
      try {
        parsed = new URL(normalizedUrl);
      } catch {
        throw new Error('CPA URL format is invalid. Check it in the side panel first.');
      }
      return parsed.origin;
    }

    function getCpaApiErrorMessage(payload, responseStatus = 500) {
      const details = [
        payload?.error,
        payload?.message,
        payload?.detail,
        payload?.reason,
      ]
        .map((value) => normalizeString(value))
        .find(Boolean);
      return details || `CPA admin API request failed (HTTP ${responseStatus}).`;
    }

    async function fetchCpaManagementJson(origin, path, options = {}) {
      const controller = new AbortController();
      const timeoutMs = Math.max(1000, Math.floor(Number(options.timeoutMs) || 20000));
      const timer = setTimeout(() => controller.abort(), timeoutMs);

      try {
        const managementKey = normalizeString(options.managementKey);
        const headers = {
          Accept: 'application/json',
          'Content-Type': 'application/json',
        };
        if (managementKey) {
          headers.Authorization = `Bearer ${managementKey}`;
          headers['X-Management-Key'] = managementKey;
        }

        const response = await fetch(`${origin}${path}`, {
          method: options.method || 'POST',
          headers,
          body: options.body === undefined ? undefined : JSON.stringify(options.body),
          signal: controller.signal,
        });

        let payload = {};
        try {
          payload = await response.json();
        } catch {
          payload = {};
        }

        if (!response.ok) {
          throw new Error(getCpaApiErrorMessage(payload, response.status));
        }

        return payload;
      } catch (error) {
        if (error?.name === 'AbortError') {
          throw new Error('CPA admin API request timed out. Please try again later.');
        }
        throw error;
      } finally {
        clearTimeout(timer);
      }
    }

    function isSub2ApiTransientExchangeError(error) {
      const message = normalizeString(error?.message || error);
      if (!message) {
        return false;
      }
      const tokenExchangeFailure = /auth\.openai\.com\/oauth\/token/i.test(message);
      const transientNetworkSignal = /unexpected\s+eof|eof|connection\s+refused|i\/o\s+timeout|context\s+deadline\s+exceeded|connection\s+reset|broken\s+pipe|failed\s+to\s+fetch|temporarily\s+unavailable|timeout/i.test(message);
      const transientExchangeUserSignal = /token_exchange_user_error|invalid\s+request\.\s+please\s+try\s+again\s+later/i.test(message);
      if (transientExchangeUserSignal) {
        return true;
      }
      return tokenExchangeFailure && transientNetworkSignal;
    }

    async function sleep(ms = 0) {
      const timeout = Math.max(0, Number(ms) || 0);
      if (!timeout) return;
      await new Promise((resolve) => setTimeout(resolve, timeout));
    }

    async function fetchCodex2ApiJson(origin, path, options = {}) {
      const controller = new AbortController();
      const timeoutMs = Math.max(1000, Math.floor(Number(options.timeoutMs) || 30000));
      const timer = setTimeout(() => controller.abort(), timeoutMs);

      try {
        const response = await fetch(`${origin}${path}`, {
          method: options.method || 'POST',
          headers: {
            Accept: 'application/json',
            'Content-Type': 'application/json',
            'X-Admin-Key': normalizeString(options.adminKey),
          },
          body: options.body === undefined ? undefined : JSON.stringify(options.body),
          signal: controller.signal,
        });

        let payload = {};
        try {
          payload = await response.json();
        } catch {
          payload = {};
        }

        if (!response.ok) {
          throw new Error(getCodex2ApiErrorMessage(payload, response.status));
        }

        return payload;
      } catch (error) {
        if (error?.name === 'AbortError') {
          throw new Error('Codex2API request timed out. Please try again later.');
        }
        throw error;
      } finally {
        clearTimeout(timer);
      }
    }

    async function executeStep10(state) {
      if (getPanelMode(state) === 'codex2api') {
        return executeCodex2ApiStep10(state);
      }
      if (getPanelMode(state) === 'sub2api') {
        return executeSub2ApiStep10(state);
      }
      return executeCpaStep10(state);
    }

    async function executeCpaStep10(state) {
      const platformVerifyStep = resolvePlatformVerifyStep(state);
      const confirmOauthStep = resolveConfirmOauthStep(platformVerifyStep, state);
      const authLoginStep = resolveAuthLoginStep(platformVerifyStep, state);
      if (state.localhostUrl && !isLocalhostOAuthCallbackUrl(state.localhostUrl)) {
        throw new Error(`Step ${confirmOauthStep}: The captured localhost OAuth callback URL is invalid. Rerun Step ${confirmOauthStep}.`);
      }
      if (!state.localhostUrl) {
        throw new Error(`Missing localhost callback URL. Complete Step ${confirmOauthStep} first.`);
      }
      if (!state.vpsUrl) {
        throw new Error('CPA URL is not filled in yet. Enter it in the side panel first.');
      }

      if (shouldBypassStep9ForLocalCpa(state)) {
        await addStepLog(platformVerifyStep, 'Detected local CPA, and the current strategy is "skip platform callback verification". This round will not resubmit the callback URL.', 'info');
        await completeNodeFromBackground(state?.nodeId || 'platform-verify', {
          localhostUrl: state.localhostUrl,
          verifiedStatus: 'local-auto',
        });
        return;
      }

      const callback = parseLocalhostCallback(state.localhostUrl, platformVerifyStep, state);
      const expectedState = normalizeString(state.cpaOAuthState);
      if (expectedState && expectedState !== callback.state) {
        throw new Error(`CPA callback state does not match the current authorization session. Rerun Step ${authLoginStep}.`);
      }
      const managementKey = normalizeString(state.vpsPassword);
      if (!managementKey) {
        throw new Error('CPA admin key is not configured yet. Fill it in the side panel first.');
      }

      await addStepLog(platformVerifyStep, 'Submitting the callback URL through the CPA admin API...');
      try {
        const origin = normalizeString(state.cpaManagementOrigin) || deriveCpaManagementOrigin(state.vpsUrl);
        const result = await fetchCpaManagementJson(origin, '/v0/management/oauth-callback', {
          method: 'POST',
          managementKey,
          body: {
            provider: 'codex',
            redirect_url: callback.url,
          },
        });

        const verifiedStatus = normalizeString(result?.message)
          || normalizeString(result?.status_message)
          || 'CPA callback submitted through the API';
        await addStepLog(platformVerifyStep, verifiedStatus, 'ok');
        await completeNodeFromBackground(state?.nodeId || 'platform-verify', {
          localhostUrl: callback.url,
          verifiedStatus,
        });
      } catch (error) {
        const reason = normalizeString(error?.message) || 'unknown error';
        await addStepLog(platformVerifyStep, `CPA API submission failed: ${reason}`, 'error');
        throw error;
      }
    }

    async function executeCodex2ApiStep10(state) {
      const platformVerifyStep = resolvePlatformVerifyStep(state);
      const confirmOauthStep = resolveConfirmOauthStep(platformVerifyStep, state);
      const authLoginStep = resolveAuthLoginStep(platformVerifyStep, state);
      if (state.localhostUrl && !isLocalhostOAuthCallbackUrl(state.localhostUrl)) {
        throw new Error(`Step ${confirmOauthStep}: The captured localhost OAuth callback URL is invalid. Rerun Step ${confirmOauthStep}.`);
      }
      if (!state.localhostUrl) {
        throw new Error(`Missing localhost callback URL. Complete Step ${confirmOauthStep} first.`);
      }
      if (!state.codex2apiSessionId) {
        throw new Error(`Missing Codex2API session information. Rerun Step ${authLoginStep}.`);
      }
      if (!normalizeString(state.codex2apiAdminKey)) {
        throw new Error('Codex2API admin key is not configured yet. Fill it in the side panel first.');
      }

      const callback = parseLocalhostCallback(state.localhostUrl, platformVerifyStep, state);
      const expectedState = normalizeString(state.codex2apiOAuthState);
      if (expectedState && expectedState !== callback.state) {
        throw new Error(`Codex2API callback state does not match the current authorization session. Rerun Step ${authLoginStep}.`);
      }

      const codex2apiUrl = normalizeCodex2ApiUrl(state.codex2apiUrl);
      const origin = new URL(codex2apiUrl).origin;

      await addStepLog(platformVerifyStep, 'Submitting the callback to Codex2API and creating the account...');
      const result = await fetchCodex2ApiJson(origin, '/api/admin/oauth/exchange-code', {
        adminKey: state.codex2apiAdminKey,
        method: 'POST',
        body: {
          session_id: state.codex2apiSessionId,
          code: callback.code,
          state: callback.state,
        },
      });

      const verifiedStatus = normalizeString(result?.message) || 'Codex2API OAuth account added successfully';
      await addStepLog(platformVerifyStep, verifiedStatus, 'ok');
      await completeNodeFromBackground(state?.nodeId || 'platform-verify', {
        localhostUrl: callback.url,
        verifiedStatus,
      });
    }

    async function executeSub2ApiStep10(state) {
      const platformVerifyStep = resolvePlatformVerifyStep(state);
      const visibleStep = platformVerifyStep;
      const confirmOauthStep = resolveConfirmOauthStep(visibleStep, state);
      if (state.localhostUrl && !isLocalhostOAuthCallbackUrl(state.localhostUrl)) {
        throw new Error(`Step ${confirmOauthStep}: The captured localhost OAuth callback URL is invalid. Rerun Step ${confirmOauthStep}.`);
      }
      if (!state.localhostUrl) {
        throw new Error(`Missing localhost callback URL. Complete Step ${confirmOauthStep} first.`);
      }
      if (!state.sub2apiSessionId) {
        throw new Error('Missing SUB2API session information. Rerun Step 1.');
      }
      if (!state.sub2apiEmail) {
        throw new Error('SUB2API login email is not configured yet. Fill it in the side panel first.');
      }
      if (!state.sub2apiPassword) {
        throw new Error('SUB2API login password is not configured yet. Fill it in the side panel first.');
      }

      const sub2apiUrl = normalizeSub2ApiUrl(state.sub2apiUrl);
      if (!sub2apiUrl) {
        throw new Error('SUB2API URL is not configured. Please fill it in the side panel first.');
      }
      const api = getSub2ApiApi();
      const maxExchangeAttempts = 3;
      let lastError = null;
      for (let attempt = 1; attempt <= maxExchangeAttempts; attempt += 1) {
        try {
          const result = await api.submitOpenAiCallback({
            ...state,
            visibleStep,
            sub2apiUrl,
          }, {
            visibleStep,
            logLabel: `Step ${visibleStep}`,
            logOptions: { step: visibleStep, stepKey: 'platform-verify' },
            timeoutMs: SUB2API_STEP9_RESPONSE_TIMEOUT_MS,
          });
          await completeNodeFromBackground(state?.nodeId || 'platform-verify', result);
          return;
        } catch (error) {
          lastError = error;
          if (!isSub2ApiTransientExchangeError(error) || attempt >= maxExchangeAttempts) {
            throw error;
          }
          await addLog(
            `SUB2API callback exchange hit a temporary network issue (${error.message}). Retrying ${attempt + 1}/${maxExchangeAttempts}...`,
            'warn',
            { step: visibleStep, stepKey: 'platform-verify' }
          );
          await sleep(1200 * attempt);
        }
      }
      if (lastError) {
        throw lastError;
      }
    }

    return {
      executeCpaStep10,
      executeCodex2ApiStep10,
      executeStep10,
      executeSub2ApiStep10,
    };
  }

  return { createStep10Executor };
});
