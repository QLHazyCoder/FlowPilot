(function attachBackgroundSub2ApiApi(root, factory) {
  root.MultiPageBackgroundSub2ApiApi = factory();
})(typeof self !== 'undefined' ? self : globalThis, function createBackgroundSub2ApiApiModule() {
  function createSub2ApiApi(deps = {}) {
    const {
      addLog = async () => {},
      normalizeSub2ApiUrl = (value) => value,
      DEFAULT_SUB2API_GROUP_NAME = 'codex',
      fetchImpl = (...args) => fetch(...args),
    } = deps;

    const DEFAULT_REDIRECT_URI = 'http://localhost:1455/auth/callback';
    const DEFAULT_PROXY_NAME = '';
    const DEFAULT_CONCURRENCY = 10;
    const DEFAULT_PRIORITY = 1;
    const DEFAULT_RATE_MULTIPLIER = 1;

    function normalizeString(value = '') {
      return String(value || '').trim();
    }

    function extractStateFromAuthUrl(authUrl = '') {
      try {
        return new URL(authUrl).searchParams.get('state') || '';
      } catch {
        return '';
      }
    }

    function normalizeRedirectUri(input = DEFAULT_REDIRECT_URI) {
      const withProtocol = /^https?:\/\//i.test(input) ? input : `http://${input}`;
      const parsed = new URL(withProtocol);
      if (!parsed.pathname || parsed.pathname === '/') {
        parsed.pathname = '/auth/callback';
      }
      if (parsed.pathname !== '/auth/callback') {
        throw new Error('SUB2API callback path must be /auth/callback, e.g. http://localhost:1455/auth/callback');
      }
      return parsed.toString();
    }

    function getSub2ApiOrigin(rawUrl = '') {
      const sub2apiUrl = normalizeSub2ApiUrl(rawUrl);
      if (!sub2apiUrl) {
        throw new Error('SUB2API URL is not configured. Please fill it in the side panel first.');
      }
      try {
        return new URL(sub2apiUrl).origin;
      } catch {
        throw new Error('SUB2API URL format is invalid. Please check it in the side panel first.');
      }
    }

    function getSub2ApiErrorMessage(payload, responseStatus = 500, path = '') {
      const candidates = [
        payload?.message,
        payload?.detail,
        payload?.error,
        payload?.reason,
      ];
      const message = candidates.map(normalizeString).find(Boolean);
      return message || `SUB2API request failed (HTTP ${responseStatus}): ${path}`;
    }

    async function requestJson(origin, path, options = {}) {
      const controller = new AbortController();
      const timeoutMs = Math.max(1000, Math.floor(Number(options.timeoutMs) || 30000));
      const timer = setTimeout(() => controller.abort(), timeoutMs);

      try {
        const token = normalizeString(options.token);
        const response = await fetchImpl(`${origin}${path}`, {
          method: options.method || 'GET',
          headers: {
            Accept: 'application/json',
            'Content-Type': 'application/json',
            ...(token ? { Authorization: `Bearer ${token}` } : {}),
          },
          body: options.body === undefined ? undefined : JSON.stringify(options.body),
          signal: controller.signal,
        });

        const text = await response.text();
        let payload = null;
        try {
          payload = text ? JSON.parse(text) : null;
        } catch {
          payload = null;
        }

        if (payload && typeof payload === 'object' && Object.prototype.hasOwnProperty.call(payload, 'code')) {
          if (Number(payload.code) === 0) {
            return payload.data;
          }
          throw new Error(getSub2ApiErrorMessage(payload, response.status, path));
        }

        if (!response.ok) {
          throw new Error(getSub2ApiErrorMessage(payload, response.status, path));
        }

        return payload;
      } catch (error) {
        if (error?.name === 'AbortError') {
          throw new Error(`SUB2API request timed out: ${path}`);
        }
        throw error;
      } finally {
        clearTimeout(timer);
      }
    }

    async function loginSub2Api(state = {}, options = {}) {
      const email = normalizeString(state.sub2apiEmail);
      const password = String(state.sub2apiPassword || '');
      const origin = getSub2ApiOrigin(state.sub2apiUrl);

      if (!email) {
        throw new Error('SUB2API login email is not configured. Please fill it in the side panel first.');
      }
      if (!password) {
        throw new Error('SUB2API login password is not configured. Please fill it in the side panel first.');
      }

      const loginData = await requestJson(origin, '/api/v1/auth/login', {
        method: 'POST',
        timeoutMs: options.timeoutMs,
        body: { email, password },
      });

      const token = normalizeString(loginData?.access_token || loginData?.accessToken);
      if (!token) {
        throw new Error('SUB2API login response is missing access_token.');
      }

      return {
        origin,
        token,
        user: loginData?.user || null,
      };
    }

    function normalizeSub2ApiGroupNames(value) {
      const source = Array.isArray(value)
        ? value
        : String(value || '').split(/[\r\n,，;；]+/);
      const seen = new Set();
      const names = [];
      for (const item of source) {
        const name = normalizeString(item);
        const key = name.toLowerCase();
        if (!name || seen.has(key)) continue;
        seen.add(key);
        names.push(name);
      }
      return names.length ? names : [DEFAULT_SUB2API_GROUP_NAME];
    }

    async function getGroupsByNames(origin, token, groupNames, options = {}) {
      const targetNames = normalizeSub2ApiGroupNames(groupNames);
      const groups = await requestJson(origin, '/api/v1/admin/groups/all', {
        method: 'GET',
        token,
        timeoutMs: options.timeoutMs,
      });
      const matched = [];
      const missing = [];

      for (const targetName of targetNames) {
        const normalized = targetName.toLowerCase();
        const group = (Array.isArray(groups) ? groups : []).find((item) => {
          const itemName = normalizeString(item?.name).toLowerCase();
          if (!itemName || itemName !== normalized) return false;
          return !item.platform || item.platform === 'openai';
        });
        if (group) {
          matched.push(group);
        } else {
          missing.push(targetName);
        }
      }

      if (missing.length) {
        throw new Error(`The following openai groups were not found in SUB2API: ${missing.join(', ')}.`);
      }

      return matched;
    }

    function normalizeSub2ApiProxyPreference(value) {
      return normalizeString(value);
    }

    function resolveSub2ApiProxyPreference(state = {}) {
      if (state.sub2apiDefaultProxyName !== undefined) {
        return normalizeSub2ApiProxyPreference(state.sub2apiDefaultProxyName);
      }
      return DEFAULT_PROXY_NAME;
    }

    function resolveSub2ApiAccountPriority(state = {}) {
      const rawValue = normalizeString(state.sub2apiAccountPriority);
      if (!rawValue) {
        return DEFAULT_PRIORITY;
      }
      const numeric = Number(rawValue);
      if (!Number.isSafeInteger(numeric) || numeric < 1) {
        throw new Error('SUB2API account priority must be an integer greater than or equal to 1.');
      }
      return numeric;
    }

    function normalizeProxyId(value) {
      if (value === undefined || value === null || value === '') {
        return null;
      }
      const normalized = Number(value);
      if (!Number.isSafeInteger(normalized) || normalized <= 0) {
        return null;
      }
      return normalized;
    }

    function buildProxyDisplayName(proxy = {}) {
      const id = normalizeProxyId(proxy.id);
      const name = normalizeString(proxy.name);
      const protocol = normalizeString(proxy.protocol);
      const host = normalizeString(proxy.host);
      const port = proxy.port === undefined || proxy.port === null ? '' : normalizeString(proxy.port);
      const address = protocol && host && port ? `${protocol}://${host}:${port}` : '';
      return [
        name || '(unnamed proxy)',
        id ? `#${id}` : '',
        address,
      ].filter(Boolean).join(' ');
    }

    function buildProxySearchText(proxy = {}) {
      return [
        proxy.id,
        proxy.name,
        proxy.protocol,
        proxy.host,
        proxy.port,
        buildProxyDisplayName(proxy),
      ]
        .filter((value) => value !== undefined && value !== null && value !== '')
        .map((value) => normalizeString(value).toLowerCase())
        .filter(Boolean)
        .join(' ');
    }

    function isActiveProxy(proxy = {}) {
      const status = normalizeString(proxy.status).toLowerCase();
      return !status || status === 'active';
    }

    function findSub2ApiProxy(proxies = [], preference = '') {
      const activeProxies = (Array.isArray(proxies) ? proxies : [])
        .filter(isActiveProxy)
        .filter((proxy) => normalizeProxyId(proxy.id));
      const normalizedPreference = normalizeSub2ApiProxyPreference(preference).toLowerCase();
      const preferredId = normalizeProxyId(normalizedPreference);

      if (preferredId) {
        const matchedById = activeProxies.find((proxy) => normalizeProxyId(proxy.id) === preferredId);
        return {
          proxy: matchedById || null,
          reason: matchedById ? 'id' : 'missing-id',
          candidates: activeProxies,
        };
      }

      if (normalizedPreference) {
        const exactMatches = activeProxies.filter((proxy) => normalizeString(proxy.name).toLowerCase() === normalizedPreference);
        if (exactMatches.length === 1) {
          return { proxy: exactMatches[0], reason: 'name', candidates: activeProxies };
        }
        if (exactMatches.length > 1) {
          return { proxy: null, reason: 'ambiguous-name', candidates: exactMatches };
        }

        const fuzzyMatches = activeProxies.filter((proxy) => buildProxySearchText(proxy).includes(normalizedPreference));
        if (fuzzyMatches.length === 1) {
          return { proxy: fuzzyMatches[0], reason: 'fuzzy', candidates: activeProxies };
        }
        if (fuzzyMatches.length > 1) {
          return { proxy: null, reason: 'ambiguous-fuzzy', candidates: fuzzyMatches };
        }

        return { proxy: null, reason: 'missing-name', candidates: activeProxies };
      }

      if (activeProxies.length === 1) {
        return { proxy: activeProxies[0], reason: 'single-active', candidates: activeProxies };
      }
      return {
        proxy: null,
        reason: activeProxies.length ? 'no-preference' : 'none-active',
        candidates: activeProxies,
      };
    }

    async function resolveSub2ApiProxy(origin, token, preference = '', options = {}) {
      const proxies = await requestJson(origin, '/api/v1/admin/proxies/all?with_count=true', {
        method: 'GET',
        token,
        timeoutMs: options.timeoutMs,
      });
      if (!Array.isArray(proxies)) {
        throw new Error('SUB2API proxy list returned an unexpected format; cannot automatically select a proxy.');
      }

      const { proxy, reason, candidates } = findSub2ApiProxy(proxies, preference);
      if (proxy) {
        return proxy;
      }

      const configured = normalizeSub2ApiProxyPreference(preference) || '(not configured)';
      const available = (candidates || [])
        .slice(0, 8)
        .map(buildProxyDisplayName)
        .join('; ') || 'no available proxies';
      if (reason === 'ambiguous-name' || reason === 'ambiguous-fuzzy') {
        throw new Error(`SUB2API default proxy "${configured}" matched multiple proxies; please specify the proxy ID instead. Candidates: ${available}`);
      }
      if (reason === 'missing-id') {
        throw new Error(`SUB2API default proxy ID "${configured}" does not exist or is not enabled. Available proxies: ${available}`);
      }
      if (reason === 'missing-name') {
        throw new Error(`SUB2API default proxy "${configured}" does not exist or is not enabled. Available proxies: ${available}`);
      }
      if (reason === 'no-preference') {
        throw new Error(`SUB2API has multiple available proxies; please fill in the default proxy name or ID in the side panel, or leave it blank to skip the proxy. Available proxies: ${available}`);
      }
      throw new Error('SUB2API has no available proxies. Please check the default proxy config, or leave it blank to disable the proxy.');
    }

    function buildDraftAccountName(groupName) {
      const prefix = normalizeString(groupName || DEFAULT_SUB2API_GROUP_NAME)
        .replace(/[^\w\u4e00-\u9fa5-]+/g, '-')
        .replace(/^-+|-+$/g, '') || DEFAULT_SUB2API_GROUP_NAME;
      const stamp = new Date().toISOString().replace(/\D/g, '').slice(2, 14);
      const random = Math.floor(Math.random() * 9000 + 1000);
      return `${prefix}-${stamp}-${random}`;
    }

    function normalizeCodexSessionObject(value) {
      return value && typeof value === 'object' && !Array.isArray(value) ? value : null;
    }

    function normalizeEmailValue(value = '') {
      const email = normalizeString(value);
      return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email) ? email : '';
    }

    function decodeCodexBase64UrlSegment(segment = '') {
      const normalized = normalizeString(segment)
        .replace(/-/g, '+')
        .replace(/_/g, '/');
      if (!normalized) {
        return '';
      }
      const padded = normalized + '='.repeat((4 - (normalized.length % 4)) % 4);
      try {
        if (typeof Buffer !== 'undefined') {
          return Buffer.from(padded, 'base64').toString('utf8');
        }
        if (typeof atob === 'function') {
          const binary = atob(padded);
          const bytes = Uint8Array.from(binary, (char) => char.charCodeAt(0));
          if (typeof TextDecoder !== 'undefined') {
            return new TextDecoder().decode(bytes);
          }
          return binary;
        }
      } catch {
        return '';
      }
      return '';
    }

    function parseCodexAccessTokenClaims(accessToken = '') {
      const token = normalizeString(accessToken);
      if (!token) {
        return null;
      }
      const parts = token.split('.');
      if (parts.length !== 3) {
        return null;
      }
      try {
        return JSON.parse(decodeCodexBase64UrlSegment(parts[1]));
      } catch {
        return null;
      }
    }

    function resolveCodexSessionImportAccountName(state = {}, session = null, accessToken = '') {
      const sessionObject = normalizeCodexSessionObject(session);
      const claims = parseCodexAccessTokenClaims(accessToken || sessionObject?.accessToken);
      const accountIdentifierType = normalizeString(state?.accountIdentifierType).toLowerCase();
      const accountIdentifierEmail = accountIdentifierType === 'email'
        ? normalizeEmailValue(state?.accountIdentifier)
        : '';

      return normalizeEmailValue(sessionObject?.user?.email)
        || normalizeEmailValue(sessionObject?.email)
        || normalizeEmailValue(claims?.email)
        || normalizeEmailValue(state?.email)
        || accountIdentifierEmail;
    }

    function buildCodexSessionImportContent(session, accessToken = '') {
      const normalizedAccessToken = normalizeString(accessToken);
      const sessionObject = normalizeCodexSessionObject(session);

      if (sessionObject) {
        const contentObject = normalizedAccessToken
          ? {
            ...sessionObject,
            accessToken: normalizedAccessToken,
          }
          : sessionObject;
        return JSON.stringify(contentObject);
      }

      if (normalizedAccessToken) {
        return normalizedAccessToken;
      }

      throw new Error('No importable ChatGPT session or accessToken was found.');
    }

    function resolveCodexSessionImportExpiresAt(session) {
      const sessionObject = normalizeCodexSessionObject(session);
      const expiresValue = normalizeString(sessionObject?.expires);
      if (!expiresValue) {
        return null;
      }
      const expiresAtMs = Date.parse(expiresValue);
      if (!Number.isFinite(expiresAtMs) || expiresAtMs <= 0) {
        return null;
      }
      return Math.floor(expiresAtMs / 1000);
    }

    function normalizeCodexSessionImportMessages(messages) {
      return (Array.isArray(messages) ? messages : [])
        .map((item, index) => ({
          index: Number(item?.index) || index + 1,
          name: normalizeString(item?.name),
          message: normalizeString(item?.message),
        }))
        .filter((item) => item.message);
    }

    function normalizeCodexSessionImportResult(result) {
      return {
        total: Math.max(0, Number(result?.total) || 0),
        created: Math.max(0, Number(result?.created) || 0),
        updated: Math.max(0, Number(result?.updated) || 0),
        skipped: Math.max(0, Number(result?.skipped) || 0),
        failed: Math.max(0, Number(result?.failed) || 0),
        items: Array.isArray(result?.items) ? result.items : [],
        warnings: normalizeCodexSessionImportMessages(result?.warnings),
        errors: normalizeCodexSessionImportMessages(result?.errors),
      };
    }

    function buildCodexSessionImportSummary(result) {
      const normalized = normalizeCodexSessionImportResult(result);
      return `SUB2API session import complete: created ${normalized.created}, updated ${normalized.updated}, skipped ${normalized.skipped}, failed ${normalized.failed}`;
    }

    function getCodexSessionImportFailureMessage(result) {
      const normalized = normalizeCodexSessionImportResult(result);
      const detail = normalized.errors.map((item) => item.message).find(Boolean)
        || normalized.warnings.map((item) => item.message).find(Boolean)
        || normalized.items
          .map((item) => normalizeString(item?.message))
          .find(Boolean)
        || buildCodexSessionImportSummary(normalized);
      return detail || 'SUB2API session import failed.';
    }

    function parseLocalhostCallback(rawUrl, visibleStep = 10) {
      let parsed;
      try {
        parsed = new URL(rawUrl);
      } catch {
        throw new Error(`Step ${visibleStep}: The captured localhost OAuth callback URL has an invalid format.`);
      }

      if (!['http:', 'https:'].includes(parsed.protocol)) {
        throw new Error('Callback URL protocol is incorrect.');
      }
      if (!['localhost', '127.0.0.1'].includes(parsed.hostname)) {
        throw new Error(`Step ${visibleStep} only accepts localhost / 127.0.0.1 callback URLs.`);
      }
      if (parsed.pathname !== '/auth/callback') {
        throw new Error('Callback URL path must be /auth/callback.');
      }

      const code = normalizeString(parsed.searchParams.get('code'));
      const oauthState = normalizeString(parsed.searchParams.get('state'));
      if (!code || !oauthState) {
        throw new Error('Callback URL is missing code or state.');
      }

      return {
        url: parsed.toString(),
        code,
        state: oauthState,
      };
    }

    function buildOpenAiCredentials(exchangeData) {
      const credentials = {};
      const allowedKeys = [
        'access_token',
        'refresh_token',
        'id_token',
        'expires_at',
        'email',
        'chatgpt_account_id',
        'chatgpt_user_id',
        'organization_id',
        'plan_type',
        'client_id',
      ];

      for (const key of allowedKeys) {
        if (exchangeData?.[key] !== undefined && exchangeData?.[key] !== null && exchangeData?.[key] !== '') {
          credentials[key] = exchangeData[key];
        }
      }

      if (!credentials.access_token) {
        throw new Error('SUB2API did not return access_token after exchanging the authorization code.');
      }

      return credentials;
    }

    function buildOpenAiExtra(exchangeData) {
      const extra = {};
      const allowedKeys = ['email', 'name', 'privacy_mode'];

      for (const key of allowedKeys) {
        if (exchangeData?.[key] !== undefined && exchangeData?.[key] !== null && exchangeData?.[key] !== '') {
          extra[key] = exchangeData[key];
        }
      }

      return Object.keys(extra).length ? extra : undefined;
    }

    async function logWithOptions(message, level = 'info', options = {}) {
      await addLog(message, level, options.logOptions || {});
    }

    async function generateOpenAiAuthUrl(state = {}, options = {}) {
      const logLabel = normalizeString(options.logLabel) || 'OAuth refresh';
      const redirectUri = normalizeRedirectUri(options.redirectUri || DEFAULT_REDIRECT_URI);
      const groupNames = normalizeSub2ApiGroupNames(state.sub2apiGroupName || DEFAULT_SUB2API_GROUP_NAME);
      const groupName = groupNames[0] || DEFAULT_SUB2API_GROUP_NAME;

      await logWithOptions(`${logLabel}: Logging in via the SUB2API admin interface and generating the OpenAI Auth URL...`, 'info', options);
      const { origin, token } = await loginSub2Api(state, options);
      const groups = await getGroupsByNames(origin, token, groupNames, options);
      const group = groups[0];
      const proxyPreference = resolveSub2ApiProxyPreference(state);
      const proxy = proxyPreference ? await resolveSub2ApiProxy(origin, token, proxyPreference, options) : null;
      const proxyId = normalizeProxyId(proxy?.id);
      const draftName = buildDraftAccountName(group.name || groupName);
      const groupLabel = groups.map((item) => `${item.name} (#${item.id})`).join(', ');

      await logWithOptions(`${logLabel}: Logged in to SUB2API, using group ${groupLabel}.`, 'info', options);
      if (proxy) {
        await logWithOptions(`${logLabel}: Selected SUB2API default proxy ${buildProxyDisplayName(proxy)}.`, 'info', options);
      } else {
        await logWithOptions(`${logLabel}: No SUB2API default proxy configured; this run will not use a proxy.`, 'info', options);
      }

      const authRequestBody = { redirect_uri: redirectUri };
      if (proxyId) {
        authRequestBody.proxy_id = proxyId;
      }

      const authData = await requestJson(origin, '/api/v1/admin/openai/generate-auth-url', {
        method: 'POST',
        token,
        timeoutMs: options.timeoutMs,
        body: authRequestBody,
      });

      const oauthUrl = normalizeString(authData?.auth_url || authData?.authUrl);
      const sessionId = normalizeString(authData?.session_id || authData?.sessionId);
      const oauthState = normalizeString(authData?.state || extractStateFromAuthUrl(oauthUrl));

      if (!oauthUrl || !sessionId) {
        throw new Error('SUB2API did not return a complete auth_url / session_id.');
      }

      await logWithOptions(`${logLabel}: Got SUB2API OAuth URL: ${oauthUrl.slice(0, 96)}...`, 'ok', options);
      return {
        oauthUrl,
        sub2apiSessionId: sessionId,
        sub2apiOAuthState: oauthState,
        sub2apiGroupId: group.id,
        sub2apiGroupIds: groups.map((item) => item.id),
        sub2apiDraftName: draftName,
        sub2apiProxyId: proxyId,
      };
    }

    async function submitOpenAiCallback(state = {}, options = {}) {
      const visibleStep = Number(options.visibleStep || state.visibleStep) || 10;
      const callback = parseLocalhostCallback(state.localhostUrl || '', visibleStep);
      const flowEmail = normalizeString(state.email);
      const sessionId = normalizeString(state.sub2apiSessionId);
      const expectedState = normalizeString(state.sub2apiOAuthState);
      const logLabel = normalizeString(options.logLabel) || `Step ${visibleStep}`;

      if (!sessionId) {
        throw new Error('Missing SUB2API session_id. Please rerun step 1.');
      }
      if (expectedState && expectedState !== callback.state) {
        throw new Error('The state in this localhost callback does not match the state generated in step 1. Please rerun step 1.');
      }

      const { origin, token } = await loginSub2Api(state, options);
      const proxyPreference = resolveSub2ApiProxyPreference(state);
      const preferredProxyId = normalizeProxyId(state.sub2apiProxyId);
      const proxySelector = preferredProxyId || proxyPreference;
      const proxy = proxySelector ? await resolveSub2ApiProxy(origin, token, proxySelector, options) : null;
      const proxyId = normalizeProxyId(proxy?.id);
      const accountPriority = resolveSub2ApiAccountPriority(state);
      const storedGroupIds = Array.isArray(state.sub2apiGroupIds) ? state.sub2apiGroupIds : [];
      const groupIdsFromState = storedGroupIds
        .map((id) => Number(id))
        .filter((id) => Number.isFinite(id) && id > 0);
      const groups = groupIdsFromState.length
        ? groupIdsFromState.map((id) => ({ id }))
        : (state.sub2apiGroupId
          ? [{ id: state.sub2apiGroupId, name: state.sub2apiGroupName || DEFAULT_SUB2API_GROUP_NAME }]
          : await getGroupsByNames(origin, token, state.sub2apiGroupName || DEFAULT_SUB2API_GROUP_NAME, options));

      await logWithOptions(`${logLabel}: Exchanging the OpenAI authorization code via the SUB2API admin interface...`, 'info', options);
      if (proxy) {
        await logWithOptions(`${logLabel}: Using SUB2API default proxy ${buildProxyDisplayName(proxy)}.`, 'info', options);
      } else {
        await logWithOptions(`${logLabel}: No SUB2API default proxy configured; this run will not use a proxy.`, 'info', options);
      }

      const exchangeRequestBody = {
        session_id: sessionId,
        code: callback.code,
        state: callback.state,
      };
      if (proxyId) {
        exchangeRequestBody.proxy_id = proxyId;
      }

      const exchangeData = await requestJson(origin, '/api/v1/admin/openai/exchange-code', {
        method: 'POST',
        token,
        timeoutMs: options.timeoutMs,
        body: exchangeRequestBody,
      });

      const credentials = buildOpenAiCredentials(exchangeData);
      const extra = buildOpenAiExtra(exchangeData);
      const resolvedEmail = normalizeString(exchangeData?.email || credentials?.email);
      const groupIds = groups
        .map((group) => Number(group.id))
        .filter((id) => Number.isFinite(id) && id > 0);
      if (!groupIds.length) {
        throw new Error('SUB2API returned an invalid target group ID.');
      }

      const accountName = resolvedEmail
        || flowEmail
        || normalizeString(state.sub2apiDraftName)
        || buildDraftAccountName(state.sub2apiGroupName || DEFAULT_SUB2API_GROUP_NAME);
      const createPayload = {
        name: accountName,
        notes: '',
        platform: 'openai',
        type: 'oauth',
        credentials,
        concurrency: DEFAULT_CONCURRENCY,
        priority: accountPriority,
        rate_multiplier: DEFAULT_RATE_MULTIPLIER,
        group_ids: groupIds,
        auto_pause_on_expired: true,
      };
      if (proxyId) {
        createPayload.proxy_id = proxyId;
      }
      if (extra) {
        createPayload.extra = extra;
      }

      await logWithOptions(`${logLabel}: Authorization code exchange succeeded, creating SUB2API account (name: ${accountName})...`, 'info', options);
      const createdAccount = await requestJson(origin, '/api/v1/admin/accounts', {
        method: 'POST',
        token,
        timeoutMs: options.createTimeoutMs,
        body: createPayload,
      });

      const verifiedStatus = `SUB2API account created #${createdAccount?.id || 'unknown'}`;
      await logWithOptions(verifiedStatus, 'ok', options);
      return {
        localhostUrl: callback.url,
        verifiedStatus,
      };
    }

    async function importCurrentChatGptSession(state = {}, options = {}) {
      const logLabel = normalizeString(options.logLabel) || 'SUB2API session import';
      const session = normalizeCodexSessionObject(state?.session);
      const accessToken = normalizeString(
        state?.accessToken
        || session?.accessToken
      );
      const importContent = buildCodexSessionImportContent(session, accessToken);
      const importExpiresAt = resolveCodexSessionImportExpiresAt(session);
      const preferredAccountName = resolveCodexSessionImportAccountName(state, session, accessToken);

      await logWithOptions(`${logLabel}: Logging in via the SUB2API admin interface and preparing to import the current ChatGPT session...`, 'info', options);
      const { origin, token } = await loginSub2Api(state, options);
      const groupNames = state.sub2apiGroupName || DEFAULT_SUB2API_GROUP_NAME;
      const groups = await getGroupsByNames(origin, token, groupNames, options);
      const groupLabel = groups.map((item) => `${item.name} (${item.id})`).join(', ');
      const proxyPreference = resolveSub2ApiProxyPreference(state);
      const proxy = proxyPreference ? await resolveSub2ApiProxy(origin, token, proxyPreference, options) : null;
      const proxyId = normalizeProxyId(proxy?.id);
      const accountPriority = resolveSub2ApiAccountPriority(state);

      await logWithOptions(`${logLabel}: Logged in to SUB2API, using group ${groupLabel}.`, 'info', options);
      if (proxy) {
        await logWithOptions(`${logLabel}: Selected SUB2API default proxy ${buildProxyDisplayName(proxy)}.`, 'info', options);
      } else {
        await logWithOptions(`${logLabel}: No SUB2API default proxy configured; this run will not use a proxy.`, 'info', options);
      }

      const importPayload = {
        content: importContent,
        group_ids: groups
          .map((group) => Number(group?.id))
          .filter((id) => Number.isFinite(id) && id > 0),
        ...(preferredAccountName ? { name: preferredAccountName } : {}),
        priority: accountPriority,
        auto_pause_on_expired: true,
        update_existing: true,
      };
      if (!importPayload.group_ids.length) {
        throw new Error('SUB2API returned an invalid target group ID.');
      }
      if (proxyId) {
        importPayload.proxy_id = proxyId;
      }
      if (importExpiresAt) {
        importPayload.expires_at = importExpiresAt;
      }

      await logWithOptions(`${logLabel}: Importing the current ChatGPT session into SUB2API...`, 'info', options);
      const importResult = normalizeCodexSessionImportResult(await requestJson(origin, '/api/v1/admin/accounts/import/codex-session', {
        method: 'POST',
        token,
        timeoutMs: options.importTimeoutMs || options.timeoutMs,
        body: importPayload,
      }));

      for (const warning of importResult.warnings) {
        await logWithOptions(`${logLabel}: ${warning.message}`, 'warn', options);
      }

      if (importResult.failed > 0) {
        throw new Error(getCodexSessionImportFailureMessage(importResult));
      }
      if (importResult.created <= 0 && importResult.updated <= 0) {
        throw new Error(getCodexSessionImportFailureMessage(importResult));
      }

      const verifiedStatus = buildCodexSessionImportSummary(importResult);
      await logWithOptions(verifiedStatus, 'ok', options);
      return {
        verifiedStatus,
        sub2apiImportTotal: importResult.total,
        sub2apiImportCreated: importResult.created,
        sub2apiImportUpdated: importResult.updated,
        sub2apiImportSkipped: importResult.skipped,
        sub2apiImportFailed: importResult.failed,
      };
    }

    return {
      buildDraftAccountName,
      buildCodexSessionImportContent,
      buildOpenAiCredentials,
      buildOpenAiExtra,
      buildProxyDisplayName,
      extractStateFromAuthUrl,
      generateOpenAiAuthUrl,
      getGroupsByNames,
      importCurrentChatGptSession,
      loginSub2Api,
      normalizeProxyId,
      normalizeRedirectUri,
      normalizeSub2ApiGroupNames,
      parseLocalhostCallback,
      requestJson,
      resolveSub2ApiAccountPriority,
      resolveSub2ApiProxy,
      submitOpenAiCallback,
    };
  }

  return {
    createSub2ApiApi,
  };
});
