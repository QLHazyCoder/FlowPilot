(function attachOpenAiReauthOAuthClient(root, factory) {
  root.MultiPageOpenAiReauthOAuthClient = factory();
})(typeof self !== 'undefined' ? self : globalThis, function createOpenAiReauthOAuthClientModule() {
  const CLIENT_ID = 'app_EMoamEEZ73f0CkXaXp7hrann';
  const ISSUER = 'https://auth.openai.com';
  const AUTHORIZE_ENDPOINT = `${ISSUER}/oauth/authorize`;
  const TOKEN_ENDPOINT = `${ISSUER}/oauth/token`;
  const REDIRECT_PORT = 1455;
  const REDIRECT_PATH = '/auth/callback';
  const REDIRECT_URI = `http://localhost:${REDIRECT_PORT}${REDIRECT_PATH}`;
  const SCOPE = 'openid profile email offline_access';

  function cleanString(value = '') {
    return String(value ?? '').trim();
  }

  function base64UrlEncode(bytes) {
    let binary = '';
    for (const byte of bytes) {
      binary += String.fromCharCode(byte);
    }
    return btoa(binary).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/g, '');
  }

  async function sha256Bytes(input) {
    const encoder = new TextEncoder();
    return new Uint8Array(await crypto.subtle.digest('SHA-256', encoder.encode(String(input || ''))));
  }

  function randomUrlSafeString(length = 64) {
    const alphabet = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789-._~';
    const size = Math.max(43, Math.min(128, Math.floor(Number(length) || 64)));
    const bytes = new Uint8Array(size);
    crypto.getRandomValues(bytes);
    let output = '';
    for (let index = 0; index < size; index += 1) {
      output += alphabet[bytes[index] % alphabet.length];
    }
    return output;
  }

  async function generatePkcePair() {
    const codeVerifier = randomUrlSafeString(64);
    const codeChallenge = base64UrlEncode(await sha256Bytes(codeVerifier));
    return { codeVerifier, codeChallenge };
  }

  function generateState() {
    const bytes = new Uint8Array(32);
    crypto.getRandomValues(bytes);
    return Array.from(bytes, (b) => b.toString(16).padStart(2, '0')).join('');
  }

  function buildAuthorizeUrl(params = {}) {
    const codeChallenge = cleanString(params.codeChallenge);
    const stateToken = cleanString(params.state);
    const clientId = cleanString(params.clientId) || CLIENT_ID;
    if (!codeChallenge) {
      throw new Error('buildAuthorizeUrl 缺少 codeChallenge。');
    }
    if (!stateToken) {
      throw new Error('buildAuthorizeUrl 缺少 state。');
    }
    const search = new URLSearchParams();
    search.set('client_id', clientId);
    search.set('code_challenge', codeChallenge);
    search.set('code_challenge_method', 'S256');
    search.set('codex_cli_simplified_flow', 'true');
    search.set('id_token_add_organizations', 'true');
    search.set('redirect_uri', REDIRECT_URI);
    search.set('response_type', 'code');
    search.set('scope', SCOPE);
    search.set('state', stateToken);
    return `${AUTHORIZE_ENDPOINT}?${search.toString()}`;
  }

  function parseCallbackUrl(rawUrl, expectedState = '') {
    const normalizedUrl = cleanString(rawUrl);
    if (!normalizedUrl) {
      return null;
    }
    let parsed;
    try {
      parsed = new URL(normalizedUrl);
    } catch (_error) {
      return null;
    }
    if (!/^https?:$/.test(parsed.protocol)) {
      return null;
    }
    if (!['127.0.0.1', 'localhost'].includes(parsed.hostname)) {
      return null;
    }
    if (Number(parsed.port || 0) !== REDIRECT_PORT) {
      return null;
    }
    if (parsed.pathname !== REDIRECT_PATH) {
      return null;
    }
    const stateValue = cleanString(parsed.searchParams.get('state'));
    const errorText = cleanString(
      parsed.searchParams.get('error_description') || parsed.searchParams.get('error')
    );
    const code = cleanString(parsed.searchParams.get('code'));
    if (expectedState && stateValue && stateValue !== cleanString(expectedState)) {
      return {
        url: normalizedUrl,
        state: stateValue,
        error: `回调 state 不匹配：expected=${cleanString(expectedState)} actual=${stateValue}`,
      };
    }
    if (errorText) {
      return { url: normalizedUrl, state: stateValue, error: errorText };
    }
    if (!code) {
      return null;
    }
    return { url: normalizedUrl, state: stateValue, code };
  }

  function decodeJwtPayload(jwt) {
    const parts = String(jwt || '').split('.');
    if (parts.length < 2) {
      return null;
    }
    try {
      const segment = parts[1].replace(/-/g, '+').replace(/_/g, '/');
      const padded = segment + '='.repeat((4 - segment.length % 4) % 4);
      if (typeof atob !== 'function') {
        return null;
      }
      const decoded = atob(padded);
      const bytes = new Uint8Array(decoded.length);
      for (let index = 0; index < decoded.length; index += 1) {
        bytes[index] = decoded.charCodeAt(index);
      }
      const text = new TextDecoder().decode(bytes);
      return JSON.parse(text);
    } catch (_error) {
      return null;
    }
  }

  async function exchangeAuthorizationCode(params = {}) {
    const fetchImpl = typeof params.fetchImpl === 'function'
      ? params.fetchImpl
      : (typeof fetch === 'function' ? fetch.bind(globalThis) : null);
    if (typeof fetchImpl !== 'function') {
      throw new Error('exchangeAuthorizationCode 需要 fetch 支持。');
    }
    const code = cleanString(params.code);
    const codeVerifier = cleanString(params.codeVerifier);
    const clientId = cleanString(params.clientId) || CLIENT_ID;
    if (!code) throw new Error('exchangeAuthorizationCode 缺少 code。');
    if (!codeVerifier) throw new Error('exchangeAuthorizationCode 缺少 codeVerifier。');

    const body = new URLSearchParams({
      grant_type: 'authorization_code',
      client_id: clientId,
      code,
      redirect_uri: REDIRECT_URI,
      code_verifier: codeVerifier,
    });
    const response = await fetchImpl(TOKEN_ENDPOINT, {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body: body.toString(),
    });
    const text = await response.text();
    let json = null;
    try {
      json = text ? JSON.parse(text) : null;
    } catch (_error) {
      json = null;
    }
    if (!response.ok) {
      const reason = json?.error_description || json?.error || text || `${response.status}`;
      throw new Error(`换取 Token 失败：${cleanString(reason).slice(0, 400) || response.status}`);
    }
    const accessToken = cleanString(json?.access_token);
    const refreshToken = cleanString(json?.refresh_token);
    const idToken = cleanString(json?.id_token);
    const expiresIn = Number(json?.expires_in) || 0;
    if (!accessToken || !refreshToken) {
      throw new Error('Token 响应缺少 access_token 或 refresh_token。');
    }
    return {
      accessToken,
      refreshToken,
      idToken,
      expiresIn,
      tokenType: cleanString(json?.token_type),
    };
  }

  function buildUpdatedAccount(originalAccount = {}, tokens = {}) {
    const idPayload = decodeJwtPayload(tokens.idToken) || {};
    const accessPayload = decodeJwtPayload(tokens.accessToken) || {};
    const authClaims = idPayload['https://api.openai.com/auth'] || {};
    const profileClaims = idPayload['https://api.openai.com/profile'] || {};
    const clientId = cleanString(tokens.clientId) || CLIENT_ID;
    const expiresAt = tokens.expiresIn
      ? Math.floor(Date.now() / 1000) + Number(tokens.expiresIn)
      : Number(accessPayload.exp || 0) || 0;
    const defaultOrgId = (Array.isArray(authClaims.organizations)
      ? authClaims.organizations.find((org) => org?.is_default)?.id
      : '') || '';

    const baseCredentials = (originalAccount && typeof originalAccount.credentials === 'object')
      ? originalAccount.credentials
      : {};
    const nextCredentials = {
      ...baseCredentials,
      access_token: tokens.accessToken,
      refresh_token: tokens.refreshToken,
      id_token: tokens.idToken || baseCredentials.id_token || '',
      client_id: clientId,
      expires_at: expiresAt,
      email: cleanString(profileClaims.email || idPayload.email || baseCredentials.email),
      chatgpt_account_id: cleanString(authClaims.chatgpt_account_id || baseCredentials.chatgpt_account_id),
      chatgpt_user_id: cleanString(authClaims.chatgpt_user_id || baseCredentials.chatgpt_user_id),
      organization_id: cleanString(defaultOrgId || baseCredentials.organization_id),
      plan_type: cleanString(authClaims.chatgpt_plan_type || baseCredentials.plan_type) || 'free',
    };
    return {
      ...originalAccount,
      credentials: nextCredentials,
    };
  }

  return {
    CLIENT_ID,
    ISSUER,
    AUTHORIZE_ENDPOINT,
    TOKEN_ENDPOINT,
    REDIRECT_PORT,
    REDIRECT_PATH,
    REDIRECT_URI,
    SCOPE,
    base64UrlEncode,
    buildAuthorizeUrl,
    buildUpdatedAccount,
    decodeJwtPayload,
    exchangeAuthorizationCode,
    generatePkcePair,
    generateState,
    parseCallbackUrl,
    randomUrlSafeString,
    sha256Bytes,
  };
});
