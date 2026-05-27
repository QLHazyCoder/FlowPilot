(function attachBackgroundCpaApi(root, factory) {
  root.MultiPageBackgroundCpaApi = factory();
})(typeof self !== 'undefined' ? self : globalThis, function createBackgroundCpaApiModule() {
  function createCpaApi(deps = {}) {
    const {
      addLog = async () => {},
      fetchImpl = (...args) => fetch(...args),
    } = deps;

    function normalizeString(value = '') {
      return String(value || '').trim();
    }

    function isPlainObject(value) {
      return Boolean(value) && typeof value === 'object' && !Array.isArray(value);
    }

    function firstNonEmpty(...values) {
      for (const value of values) {
        const normalized = normalizeString(value);
        if (normalized) {
          return normalized;
        }
      }
      return '';
    }

    function normalizeEmailValue(value = '') {
      const email = normalizeString(value);
      return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email) ? email : '';
    }

    function extractStateFromAuthUrl(authUrl = '') {
      try {
        return new URL(authUrl).searchParams.get('state') || '';
      } catch {
        return '';
      }
    }

    function deriveCpaManagementOrigin(vpsUrl) {
      const normalizedUrl = normalizeString(vpsUrl);
      if (!normalizedUrl) {
        throw new Error('CPA URL is not configured. Please fill it in the side panel.');
      }
      let parsed;
      try {
        parsed = new URL(normalizedUrl);
      } catch {
        throw new Error('CPA URL format is invalid. Please check in the side panel.');
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
      const message = candidates.map(normalizeString).find(Boolean);
      return message || `CPA management API request failed (HTTP ${responseStatus}).`;
    }

    async function fetchCpaManagementJson(origin, path, options = {}) {
      const timeoutMs = Math.max(1000, Math.floor(Number(options.timeoutMs) || 20000));
      const controller = new AbortController();
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

        const response = await fetchImpl(`${origin}${path}`, {
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

    function decodeBase64UrlSegment(segment = '') {
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

    function encodeBase64UrlJson(value) {
      const json = JSON.stringify(value);
      if (typeof Buffer !== 'undefined') {
        return Buffer.from(json, 'utf8')
          .toString('base64')
          .replace(/\+/g, '-')
          .replace(/\//g, '_')
          .replace(/=+$/g, '');
      }
      const bytes = new TextEncoder().encode(json);
      let binary = '';
      bytes.forEach((byte) => {
        binary += String.fromCharCode(byte);
      });
      return btoa(binary)
        .replace(/\+/g, '-')
        .replace(/\//g, '_')
        .replace(/=+$/g, '');
    }

    function parseJwtPayload(token = '') {
      const normalized = normalizeString(token);
      if (!normalized) {
        return null;
      }
      const parts = normalized.split('.');
      if (parts.length < 2) {
        return null;
      }
      try {
        return JSON.parse(decodeBase64UrlSegment(parts[1]));
      } catch {
        return null;
      }
    }

    function getOpenAiAuthSection(payload) {
      if (!isPlainObject(payload)) {
        return {};
      }
      const auth = payload['https://api.openai.com/auth'];
      return isPlainObject(auth) ? auth : {};
    }

    function getOpenAiProfileSection(payload) {
      if (!isPlainObject(payload)) {
        return {};
      }
      const profile = payload['https://api.openai.com/profile'];
      return isPlainObject(profile) ? profile : {};
    }

    function normalizeTimestamp(value) {
      if (value instanceof Date && !Number.isNaN(value.getTime())) {
        return value.toISOString();
      }
      if (typeof value === 'number' && Number.isFinite(value)) {
        const milliseconds = value > 1e11 ? value : value * 1000;
        const date = new Date(milliseconds);
        return Number.isNaN(date.getTime()) ? '' : date.toISOString();
      }
      if (typeof value !== 'string' || !value.trim()) {
        return '';
      }
      const date = new Date(value);
      return Number.isNaN(date.getTime()) ? '' : date.toISOString();
    }

    function timestampFromUnixSeconds(value) {
      const numeric = Number(value);
      if (!Number.isFinite(numeric)) {
        return '';
      }
      const date = new Date(numeric * 1000);
      return Number.isNaN(date.getTime()) ? '' : date.toISOString();
    }

    function epochSecondsFromValue(value) {
      if (value === undefined || value === null || value === '') {
        return 0;
      }
      const numeric = Number(value);
      if (Number.isFinite(numeric)) {
        return Math.trunc(numeric > 1e11 ? numeric / 1000 : numeric);
      }
      const parsed = Date.parse(String(value));
      return Number.isFinite(parsed) ? Math.trunc(parsed / 1000) : 0;
    }

    function buildSyntheticCodexIdToken(email, accountId, planType, userId, expiresAt) {
      const normalizedAccountId = normalizeString(accountId);
      if (!normalizedAccountId) {
        return '';
      }
      const now = Math.trunc(Date.now() / 1000);
      const expires = epochSecondsFromValue(expiresAt) || now + 90 * 24 * 60 * 60;
      const authInfo = { chatgpt_account_id: normalizedAccountId };

      if (planType) {
        authInfo.chatgpt_plan_type = normalizeString(planType);
      }
      if (userId) {
        authInfo.chatgpt_user_id = normalizeString(userId);
        authInfo.user_id = normalizeString(userId);
      }

      const payload = {
        iat: now,
        exp: expires,
        'https://api.openai.com/auth': authInfo,
      };
      if (email) {
        payload.email = normalizeString(email);
      }

      return `${encodeBase64UrlJson({ alg: 'none', typ: 'JWT', cpa_synthetic: true })}.${encodeBase64UrlJson(payload)}.synthetic`;
    }

    function normalizePlanTypeForFileName(planType = '') {
      return normalizeString(planType)
        .split(/[^a-zA-Z0-9]+/)
        .map((part) => part.trim().toLowerCase())
        .filter(Boolean)
        .join('-');
    }

    function sanitizeFileSegment(value = '', fallback = 'chatgpt-session') {
      const normalized = normalizeString(value)
        .replace(/[\\/:*?"<>|]+/g, '-')
        .replace(/\s+/g, '-')
        .replace(/-+/g, '-')
        .replace(/^-+|-+$/g, '');
      return normalized || fallback;
    }

    function buildCpaAuthFileName(metadata = {}) {
      const email = sanitizeFileSegment(metadata.email || '');
      const planType = normalizePlanTypeForFileName(metadata.planType || '');
      const accountId = sanitizeFileSegment(metadata.accountId || '');
      if (email && planType) {
        return `codex-${email}-${planType}.json`;
      }
      if (email) {
        return `codex-${email}.json`;
      }
      if (accountId && planType) {
        return `codex-${accountId}-${planType}.json`;
      }
      if (accountId) {
        return `codex-${accountId}.json`;
      }
      return `codex-${Date.now()}.json`;
    }

    function buildCpaSessionAuthJson(state = {}, options = {}) {
      const session = isPlainObject(state?.session) ? state.session : {};
      const accessToken = normalizeString(state?.accessToken || session?.accessToken);
      if (!accessToken) {
        throw new Error('No importable ChatGPT accessToken read.');
      }

      const inputIdToken = firstNonEmpty(
        state?.idToken,
        state?.id_token,
        session?.idToken,
        session?.id_token
      );
      const refreshToken = firstNonEmpty(
        state?.refreshToken,
        state?.refresh_token,
        session?.refreshToken,
        session?.refresh_token
      );
      const sessionToken = firstNonEmpty(
        state?.sessionToken,
        state?.session_token,
        session?.sessionToken,
        session?.session_token
      );
      const accessPayload = parseJwtPayload(accessToken);
      const idPayload = parseJwtPayload(inputIdToken);
      const accessAuth = getOpenAiAuthSection(accessPayload);
      const idAuth = getOpenAiAuthSection(idPayload);
      const profile = getOpenAiProfileSection(accessPayload);
      const expiresAt = firstNonEmpty(
        timestampFromUnixSeconds(accessPayload?.exp),
        normalizeTimestamp(session?.expires),
        normalizeTimestamp(session?.expiresAt),
        normalizeTimestamp(session?.expired),
        normalizeTimestamp(session?.expires_at)
      );
      const accountIdentifierEmail = normalizeString(state?.accountIdentifierType).toLowerCase() === 'email'
        ? normalizeEmailValue(state?.accountIdentifier)
        : '';
      const email = firstNonEmpty(
        normalizeEmailValue(session?.user?.email),
        normalizeEmailValue(session?.email),
        normalizeEmailValue(state?.email),
        accountIdentifierEmail,
        normalizeEmailValue(profile?.email),
        normalizeEmailValue(idPayload?.email),
        normalizeEmailValue(accessPayload?.email)
      );
      const accountId = firstNonEmpty(
        session?.account?.id,
        session?.account_id,
        accessAuth?.chatgpt_account_id,
        idAuth?.chatgpt_account_id
      );
      const userId = firstNonEmpty(
        session?.user?.id,
        session?.user_id,
        accessAuth?.chatgpt_user_id,
        accessAuth?.user_id,
        idAuth?.chatgpt_user_id,
        idAuth?.user_id
      );
      const planType = firstNonEmpty(
        session?.account?.planType,
        session?.account?.plan_type,
        session?.planType,
        session?.plan_type,
        accessAuth?.chatgpt_plan_type,
        idAuth?.chatgpt_plan_type
      );
      const exportedAt = normalizeTimestamp(options.now || new Date()) || new Date().toISOString();
      const syntheticIdToken = inputIdToken
        ? ''
        : buildSyntheticCodexIdToken(email, accountId, planType, userId, expiresAt);
      const idToken = inputIdToken || syntheticIdToken;
      const authJson = Object.fromEntries(
        Object.entries({
          type: 'codex',
          account_id: accountId,
          chatgpt_account_id: accountId,
          email,
          name: firstNonEmpty(email, state?.email, 'ChatGPT Account'),
          plan_type: planType,
          chatgpt_plan_type: planType,
          id_token: idToken,
          id_token_synthetic: syntheticIdToken ? true : undefined,
          access_token: accessToken,
          refresh_token: refreshToken || '',
          session_token: sessionToken,
          last_refresh: exportedAt,
          expired: expiresAt,
          disabled: session?.disabled === true ? true : undefined,
        }).filter(([, value]) => value !== undefined && value !== null && value !== '')
      );

      return {
        authJson,
        accountId,
        email,
        expiresAt,
        fileName: buildCpaAuthFileName({ email, planType, accountId }),
        hasRefreshToken: Boolean(refreshToken),
      };
    }

    async function logWithOptions(message, level = 'info', options = {}) {
      await addLog(message, level, options.logOptions || {});
    }

    async function requestOAuthUrl(state, options = {}) {
      const managementKey = normalizeString(state?.vpsPassword);
      if (!managementKey) {
        throw new Error('CPA management key is not configured. Please fill it in the side panel.');
      }
      const origin = deriveCpaManagementOrigin(state?.vpsUrl);
      const result = await fetchCpaManagementJson(origin, '/v0/management/codex-auth-url', {
        method: 'GET',
        managementKey,
        timeoutMs: options.timeoutMs,
      });
      const oauthUrl = firstNonEmpty(
        result?.url,
        result?.auth_url,
        result?.authUrl,
        result?.data?.url,
        result?.data?.auth_url,
        result?.data?.authUrl
      );
      const oauthState = firstNonEmpty(
        result?.state,
        result?.auth_state,
        result?.authState,
        result?.data?.state,
        result?.data?.auth_state,
        result?.data?.authState,
        extractStateFromAuthUrl(oauthUrl)
      );

      if (!oauthUrl || !oauthUrl.startsWith('http')) {
        throw new Error('CPA management API did not return a valid auth_url.');
      }

      return {
        oauthUrl,
        cpaOAuthState: oauthState || null,
        cpaManagementOrigin: origin,
      };
    }

    async function submitOAuthCallback(state, callbackUrl, options = {}) {
      const managementKey = normalizeString(state?.vpsPassword);
      if (!managementKey) {
        throw new Error('CPA management key is not configured. Please fill it in the side panel.');
      }
      const origin = normalizeString(state?.cpaManagementOrigin) || deriveCpaManagementOrigin(state?.vpsUrl);
      const result = await fetchCpaManagementJson(origin, '/v0/management/oauth-callback', {
        method: 'POST',
        managementKey,
        timeoutMs: options.timeoutMs,
        body: {
          provider: 'codex',
          redirect_url: normalizeString(callbackUrl),
        },
      });
      return {
        localhostUrl: normalizeString(callbackUrl),
        verifiedStatus: firstNonEmpty(result?.message, result?.status_message, 'CPA submitted callback via API'),
      };
    }

    async function importCurrentChatGptSession(state = {}, options = {}) {
      const logLabel = normalizeString(options.logLabel) || 'CPA session import';
      const managementKey = normalizeString(state?.vpsPassword);
      if (!managementKey) {
        throw new Error('CPA management key is not configured. Please fill it in the side panel.');
      }
      const origin = deriveCpaManagementOrigin(state?.vpsUrl);
      const sessionAuth = buildCpaSessionAuthJson(state, options);

      await logWithOptions(`${logLabel}: Importing current ChatGPT session via CPA management API...`, 'info', options);
      if (!sessionAuth.hasRefreshToken) {
        await logWithOptions(`${logLabel}: Missing refresh_token, cannot auto-renew after access_token expires.`, 'warn', options);
      }

      await fetchCpaManagementJson(origin, `/v0/management/auth-files?name=${encodeURIComponent(sessionAuth.fileName)}`, {
        method: 'POST',
        managementKey,
        timeoutMs: options.importTimeoutMs || options.timeoutMs,
        body: sessionAuth.authJson,
      });

      const verifiedStatus = sessionAuth.email
        ? `CPA session import complete: ${sessionAuth.email}`
        : `CPA session import complete: ${sessionAuth.fileName}`;
      await logWithOptions(verifiedStatus, 'ok', options);
      return {
        verifiedStatus,
        cpaImportedFileName: sessionAuth.fileName,
        cpaImportedEmail: sessionAuth.email || null,
      };
    }

    return {
      buildCpaSessionAuthJson,
      deriveCpaManagementOrigin,
      fetchCpaManagementJson,
      importCurrentChatGptSession,
      requestOAuthUrl,
      submitOAuthCallback,
    };
  }

  return {
    createCpaApi,
  };
});
