(function attachBackgroundKiroDesktopClient(root, factory) {
  root.MultiPageBackgroundKiroDesktopClient = factory();
})(typeof self !== 'undefined' ? self : globalThis, function createBackgroundKiroDesktopClientModule() {
  const DEFAULT_REGION = 'us-east-1';
  const DEFAULT_START_URL = 'https://view.awsapps.com/start';
  const DEFAULT_SCOPES = Object.freeze([
    'codewhisperer:completions',
    'codewhisperer:analysis',
    'codewhisperer:conversations',
    'codewhisperer:transformations',
    'codewhisperer:taskassist',
  ]);

  function cleanString(value = '') {
    return String(value ?? '').trim();
  }

  function normalizeRegion(value = '', fallback = DEFAULT_REGION) {
    return cleanString(value) || fallback;
  }

  function buildOidcBaseUrl(region = DEFAULT_REGION) {
    return `https://oidc.${normalizeRegion(region)}.amazonaws.com`;
  }

  async function readResponse(response) {
    const text = await response.text();
    let json = null;
    try {
      json = text ? JSON.parse(text) : null;
    } catch (_error) {
      json = null;
    }
    return { text, json };
  }

  async function sha256Bytes(input) {
    const encoder = new TextEncoder();
    return new Uint8Array(await crypto.subtle.digest('SHA-256', encoder.encode(String(input || ''))));
  }

  function base64UrlEncode(bytes) {
    let binary = '';
    for (const byte of bytes) {
      binary += String.fromCharCode(byte);
    }
    return btoa(binary).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/g, '');
  }

  async function sha256Hex(input) {
    const bytes = await sha256Bytes(input);
    return Array.from(bytes).map((byte) => byte.toString(16).padStart(2, '0')).join('');
  }

  function randomUrlSafeString(length = 64) {
    const alphabet = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789-._~';
    const size = Math.max(32, Math.floor(Number(length) || 64));
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
    return {
      codeVerifier,
      codeChallenge,
    };
  }

  function chooseRedirectPort() {
    return 49152 + Math.floor(Math.random() * 16384);
  }

  function buildRedirectUri(port) {
    const normalizedPort = Math.max(1, Math.floor(Number(port) || 0));
    if (!normalizedPort) {
      throw new Error('Missing desktop authorization callback port.');
    }
    return `http://127.0.0.1:${normalizedPort}/oauth/callback`;
  }

  async function registerDesktopClient(params = {}, fetchImpl) {
    if (typeof fetchImpl !== 'function') {
      throw new Error('registerDesktopClient requires fetch support.');
    }
    const region = normalizeRegion(params.region);
    const oidcBaseUrl = buildOidcBaseUrl(region);
    const response = await fetchImpl(`${oidcBaseUrl}/client/register`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        clientName: cleanString(params.clientName) || 'Kiro IDE',
        clientType: 'public',
        scopes: Array.isArray(params.scopes) && params.scopes.length ? params.scopes : DEFAULT_SCOPES,
        grantTypes: ['authorization_code', 'refresh_token'],
        redirectUris: ['http://127.0.0.1/oauth/callback'],
        issuerUrl: cleanString(params.issuerUrl) || DEFAULT_START_URL,
      }),
    });
    const body = await readResponse(response);
    if (!response.ok) {
      throw new Error(`Kiro desktop client registration failed: ${cleanString(body.text || response.statusText) || response.status}`);
    }

    const clientId = cleanString(body.json?.clientId);
    const clientSecret = String(body.json?.clientSecret || '');
    if (!clientId || !clientSecret) {
      throw new Error('Kiro desktop client registration response missing clientId or clientSecret.');
    }

    return {
      region,
      clientId,
      clientSecret,
      clientSecretExpiresAt: Number(body.json?.clientSecretExpiresAt || 0) || 0,
      clientIdHash: await sha256Hex(JSON.stringify({
        startUrl: cleanString(params.issuerUrl) || DEFAULT_START_URL,
        clientId,
      })),
    };
  }

  function buildAuthorizeUrl(params = {}) {
    const region = normalizeRegion(params.region);
    const search = new URLSearchParams();
    search.set('response_type', 'code');
    search.set('client_id', cleanString(params.clientId));
    search.set('redirect_uri', cleanString(params.redirectUri));
    search.set('scopes', Array.isArray(params.scopes) && params.scopes.length
      ? params.scopes.join(',')
      : DEFAULT_SCOPES.join(','));
    search.set('state', cleanString(params.state));
    search.set('code_challenge', cleanString(params.codeChallenge));
    search.set('code_challenge_method', 'S256');
    return `${buildOidcBaseUrl(region)}/authorize?${search.toString()}`;
  }

  async function exchangeDesktopAuthorizationCode(params = {}, fetchImpl) {
    if (typeof fetchImpl !== 'function') {
      throw new Error('exchangeDesktopAuthorizationCode requires fetch support.');
    }
    const region = normalizeRegion(params.region);
    const response = await fetchImpl(`${buildOidcBaseUrl(region)}/token`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        clientId: cleanString(params.clientId),
        clientSecret: String(params.clientSecret || ''),
        grantType: 'authorization_code',
        code: cleanString(params.code),
        redirectUri: cleanString(params.redirectUri),
        codeVerifier: cleanString(params.codeVerifier),
      }),
    });
    const body = await readResponse(response);
    if (!response.ok) {
      throw new Error(`Kiro desktop authorization token exchange failed: ${cleanString(body.text || response.statusText) || response.status}`);
    }

    const accessToken = String(body.json?.accessToken || '');
    const refreshToken = String(body.json?.refreshToken || '');
    if (!accessToken || !refreshToken) {
      throw new Error('Kiro desktop authorization token exchange response missing accessToken or refreshToken.');
    }

    return {
      accessToken,
      refreshToken,
      expiresIn: Number(body.json?.expiresIn || 0) || 0,
      tokenType: cleanString(body.json?.tokenType),
      region,
    };
  }

  return {
    DEFAULT_REGION,
    DEFAULT_SCOPES,
    DEFAULT_START_URL,
    buildAuthorizeUrl,
    buildRedirectUri,
    chooseRedirectPort,
    exchangeDesktopAuthorizationCode,
    generatePkcePair,
    registerDesktopClient,
  };
});
