(function attachBackgroundPanelBridge(root, factory) {
  root.MultiPageBackgroundPanelBridge = factory();
})(typeof self !== 'undefined' ? self : globalThis, function createBackgroundPanelBridgeModule() {
  function createPanelBridge(deps = {}) {
    const {
      chrome,
      addLog,
      closeConflictingTabsForSource,
      createAutomationTab = null,
      ensureContentScriptReadyOnTab,
      getPanelMode,
      normalizeCodex2ApiUrl,
      normalizeSub2ApiUrl,
      rememberSourceLastUrl,
      sendToContentScript,
      sendToContentScriptResilient,
      waitForTabUrlFamily,
      DEFAULT_SUB2API_GROUP_NAME,
      SUB2API_STEP1_RESPONSE_TIMEOUT_MS,
    } = deps;

    let sub2ApiApi = null;

    function getSub2ApiApi() {
      if (sub2ApiApi) {
        return sub2ApiApi;
      }
      const factory = deps.createSub2ApiApi
        || self.MultiPageBackgroundSub2ApiApi?.createSub2ApiApi;
      if (typeof factory !== 'function') {
        throw new Error('SUB2API direct API module is not loaded — cannot generate OAuth link.');
      }
      sub2ApiApi = factory({
        addLog,
        normalizeSub2ApiUrl,
        DEFAULT_SUB2API_GROUP_NAME,
      });
      return sub2ApiApi;
    }

    function normalizeAdminKey(value = '') {
      return String(value || '').trim();
    }

    function extractStateFromAuthUrl(authUrl = '') {
      try {
        return new URL(authUrl).searchParams.get('state') || '';
      } catch {
        return '';
      }
    }

    function getCodex2ApiErrorMessage(payload, responseStatus = 500) {
      const candidates = [
        payload?.error,
        payload?.message,
        payload?.detail,
        payload?.reason,
      ];
      const message = candidates
        .map((value) => String(value || '').trim())
        .find(Boolean);
      return message || `Codex2API request failed (HTTP ${responseStatus}).`;
    }

    function deriveCpaManagementOrigin(vpsUrl) {
      const normalizedUrl = String(vpsUrl || '').trim();
      if (!normalizedUrl) {
        throw new Error('CPA URL is not configured. Please fill it in the side panel first.');
      }
      let parsed;
      try {
        parsed = new URL(normalizedUrl);
      } catch {
        throw new Error('CPA URL format is invalid. Please check the side panel.');
      }
      return parsed.origin;
    }

    function getCpaApiErrorMessage(payload, responseStatus = 500) {
      const candidates = [
        payload?.error,
        payload?.message,
        payload?.detail,
        payload?.reason,
      ];
      const message = candidates
        .map((value) => String(value || '').trim())
        .find(Boolean);
      return message || `CPA management API request failed (HTTP ${responseStatus}).`;
    }

    async function fetchCpaManagementJson(origin, path, options = {}) {
      const timeoutMs = Math.max(1000, Math.floor(Number(options.timeoutMs) || 20000));
      const controller = new AbortController();
      const timer = setTimeout(() => controller.abort(), timeoutMs);

      try {
        const managementKey = String(options.managementKey || '').trim();
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
          throw new Error('CPA management API request timed out. Please retry later.');
        }
        throw error;
      } finally {
        clearTimeout(timer);
      }
    }

    async function fetchCodex2ApiJson(origin, path, options = {}) {
      const timeoutMs = Math.max(1000, Math.floor(Number(options.timeoutMs) || 30000));
      const controller = new AbortController();
      const timer = setTimeout(() => controller.abort(), timeoutMs);

      try {
        const response = await fetch(`${origin}${path}`, {
          method: options.method || 'POST',
          headers: {
            Accept: 'application/json',
            'Content-Type': 'application/json',
            'X-Admin-Key': normalizeAdminKey(options.adminKey),
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
          throw new Error('Codex2API request timed out. Please retry later.');
        }
        throw error;
      } finally {
        clearTimeout(timer);
      }
    }

    async function requestOAuthUrlFromPanel(state, options = {}) {
      if (getPanelMode(state) === 'codex2api') {
        return requestCodex2ApiOAuthUrl(state, options);
      }
      if (getPanelMode(state) === 'sub2api') {
        return requestSub2ApiOAuthUrl(state, options);
      }
      return requestCpaOAuthUrl(state, options);
    }

    async function requestCpaOAuthUrl(state, options = {}) {
      const { logLabel = 'OAuth refresh' } = options;
      if (!state.vpsUrl) {
        throw new Error('CPA URL is not configured. Please fill it in the side panel first.');
      }
      const managementKey = String(state.vpsPassword || '').trim();
      if (!managementKey) {
        throw new Error('CPA management key is not configured. Please fill it in the side panel first.');
      }

      const origin = deriveCpaManagementOrigin(state.vpsUrl);

      await addLog(`${logLabel}: Fetching OAuth authorization link via CPA management API...`);
      const result = await fetchCpaManagementJson(origin, '/v0/management/codex-auth-url', {
        method: 'GET',
        managementKey,
      });

      const oauthUrl = String(
        result?.url
        || result?.auth_url
        || result?.authUrl
        || result?.data?.url
        || result?.data?.auth_url
        || result?.data?.authUrl
        || ''
      ).trim();
      const oauthState = String(
        result?.state
        || result?.auth_state
        || result?.authState
        || result?.data?.state
        || result?.data?.auth_state
        || result?.data?.authState
        || ''
      ).trim()
        || extractStateFromAuthUrl(oauthUrl);

      if (!oauthUrl || !oauthUrl.startsWith('http')) {
        throw new Error('CPA management API did not return a valid auth_url.');
      }

      return {
        oauthUrl,
        cpaOAuthState: oauthState || null,
        cpaManagementOrigin: origin,
      };
    }

    async function requestCodex2ApiOAuthUrl(state, options = {}) {
      const { logLabel = 'OAuth refresh' } = options;
      const codex2apiUrl = normalizeCodex2ApiUrl(state.codex2apiUrl);
      const adminKey = normalizeAdminKey(state.codex2apiAdminKey);

      if (!adminKey) {
        throw new Error('Codex2API admin key is not configured. Please fill it in the side panel first.');
      }

      const origin = new URL(codex2apiUrl).origin;
      await addLog(`${logLabel}: Generating OAuth authorization link via Codex2API protocol...`);

      const result = await fetchCodex2ApiJson(origin, '/api/admin/oauth/generate-auth-url', {
        adminKey,
        method: 'POST',
        body: {},
      });

      const oauthUrl = String(result?.auth_url || result?.authUrl || '').trim();
      const sessionId = String(result?.session_id || result?.sessionId || '').trim();
      const oauthState = extractStateFromAuthUrl(oauthUrl);

      if (!oauthUrl || !sessionId) {
        throw new Error('Codex2API did not return a valid auth_url or session_id.');
      }

      return {
        oauthUrl,
        codex2apiSessionId: sessionId,
        codex2apiOAuthState: oauthState || null,
      };
    }

    async function requestSub2ApiOAuthUrl(state, options = {}) {
      const { logLabel = 'OAuth refresh' } = options;
      const sub2apiUrl = normalizeSub2ApiUrl(state.sub2apiUrl);

      if (!sub2apiUrl) {
        throw new Error('SUB2API URL is not configured. Please fill it in the side panel first.');
      }
      if (!state.sub2apiEmail) {
        throw new Error('SUB2API login email is not configured. Please fill it in the side panel first.');
      }
      if (!state.sub2apiPassword) {
        throw new Error('SUB2API login password is not configured. Please fill it in the side panel first.');
      }

      const api = getSub2ApiApi();
      return api.generateOpenAiAuthUrl({
        ...state,
          sub2apiUrl,
      }, {
        logLabel,
        timeoutMs: SUB2API_STEP1_RESPONSE_TIMEOUT_MS,
      });
    }

    return {
      requestOAuthUrlFromPanel,
      requestCodex2ApiOAuthUrl,
      requestCpaOAuthUrl,
      requestSub2ApiOAuthUrl,
    };
  }

  return {
    createPanelBridge,
  };
});
