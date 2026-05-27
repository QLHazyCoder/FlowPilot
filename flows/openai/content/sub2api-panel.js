// flows/openai/content/sub2api-panel.js — In-page script: SUB2API admin (OAuth generation and callback submission)

console.log('[MultiPage:sub2api-panel] Content script loaded on', location.href);

const SUB2API_PANEL_LISTENER_SENTINEL = 'data-multipage-sub2api-panel-listener';
const SUB2API_DEFAULT_GROUP_NAME = 'codex';
const SUB2API_DEFAULT_PROXY_NAME = '';
const SUB2API_DEFAULT_REDIRECT_URI = 'http://localhost:1455/auth/callback';
const SUB2API_DEFAULT_CONCURRENCY = 10;
const SUB2API_DEFAULT_PRIORITY = 1;
const SUB2API_DEFAULT_RATE_MULTIPLIER = 1;

if (document.documentElement.getAttribute(SUB2API_PANEL_LISTENER_SENTINEL) !== '1') {
  document.documentElement.setAttribute(SUB2API_PANEL_LISTENER_SENTINEL, '1');

  chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
    if (message.type === 'EXECUTE_NODE' || message.type === 'REQUEST_OAUTH_URL') {
      resetStopState();
      const handler = message.type === 'REQUEST_OAUTH_URL'
        ? requestOAuthUrl(message.payload)
        : handleNode(message.nodeId || message.payload?.nodeId, message.payload);
      handler.then((result) => {
        sendResponse({ ok: true, ...(result || {}) });
      }).catch((err) => {
        if (isStopError(err)) {
          if (message.payload?.visibleStep || message.step) {
            log('Stopped by user.', 'warn', { step: message.payload?.visibleStep || message.step });
          }
          sendResponse({ stopped: true, error: err.message });
          return;
        }
        if (message.nodeId || message.payload?.nodeId) {
          reportError(message.nodeId || message.payload?.nodeId, err.message);
        }
        sendResponse({ error: err.message });
      });
      return true;
    }
  });
} else {
  console.log('[MultiPage:sub2api-panel] message listener already exists, skipping duplicate registration');
}

function getSub2ApiOrigin(payload = {}) {
  const rawUrl = payload.sub2apiUrl || location.href;
  try {
    return new URL(rawUrl).origin;
  } catch {
    return location.origin;
  }
}

function normalizeRedirectUri() {
  const input = SUB2API_DEFAULT_REDIRECT_URI;
  const withProtocol = /^https?:\/\//i.test(input) ? input : `http://${input}`;
  const parsed = new URL(withProtocol);
  if (!parsed.pathname || parsed.pathname === '/') {
    parsed.pathname = '/auth/callback';
  }
  if (parsed.pathname !== '/auth/callback') {
    throw new Error('SUB2API callback URL must be /auth/callback, for example http://localhost:1455/auth/callback');
  }
  return parsed.toString();
}

async function handleStep(step, payload = {}) {
  switch (step) {
    case 1:
      return step1_generateOpenAiAuthUrl(payload);
    case 10:
    case 12:
    case 13:
      return step9_submitOpenAiCallback({ ...(payload || {}), visibleStep: step });
    default:
      throw new Error(`sub2api-panel.js does not handle step ${step}`);
  }
}

async function handleNode(nodeId, payload = {}) {
  const normalizedNodeId = String(nodeId || '').trim();
  switch (normalizedNodeId) {
    case 'platform-verify':
      return step9_submitOpenAiCallback(payload);
    default:
      throw new Error(`sub2api-panel.js does not handle node ${normalizedNodeId}`);
  }
}

async function requestOAuthUrl(payload = {}) {
  return step1_generateOpenAiAuthUrl(payload, { report: false });
}

async function requestJson(origin, path, options = {}) {
  throwIfStopped();
  const {
    method = 'GET',
    token = '',
    body = undefined,
  } = options;

  const response = await fetch(`${origin}${path}`, {
    method,
    credentials: 'same-origin',
    headers: {
      'Content-Type': 'application/json',
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
    },
    body: body === undefined ? undefined : JSON.stringify(body),
  });

  const text = await response.text();
  let json = null;
  try {
    json = text ? JSON.parse(text) : null;
  } catch {
    json = null;
  }

  if (json && typeof json === 'object' && 'code' in json) {
    if (json.code === 0) {
      return json.data;
    }
    throw new Error(json.message || json.detail || `request failed (${path})`);
  }

  if (!response.ok) {
    throw new Error((json && (json.message || json.detail)) || `request failed (HTTP ${response.status}): ${path}`);
  }

  return json;
}

function storeAuthSession(loginData) {
  if (!loginData?.access_token) {
    throw new Error('SUB2API login response is missing access_token.');
  }

  localStorage.setItem('auth_token', loginData.access_token);
  if (loginData.refresh_token) {
    localStorage.setItem('refresh_token', loginData.refresh_token);
  } else {
    localStorage.removeItem('refresh_token');
  }
  if (loginData.expires_in) {
    localStorage.setItem('token_expires_at', String(Date.now() + Number(loginData.expires_in) * 1000));
  }
  if (loginData.user) {
    localStorage.setItem('auth_user', JSON.stringify(loginData.user));
  }
  sessionStorage.removeItem('auth_expired');
}

async function loginSub2Api(payload = {}) {
  const email = (payload.sub2apiEmail || '').trim();
  const password = payload.sub2apiPassword || '';
  const origin = getSub2ApiOrigin(payload);

  if (!email) {
    throw new Error('SUB2API login email is missing. Fill it in the side panel first.');
  }
  if (!password) {
    throw new Error('SUB2API login password is missing. Fill it in the side panel first.');
  }

  log('Step: Logging in to the SUB2API admin...');
  const loginData = await requestJson(origin, '/api/v1/auth/login', {
    method: 'POST',
    body: {
      email,
      password,
    },
  });
  storeAuthSession(loginData);

  return {
    origin,
    token: loginData.access_token,
    user: loginData.user || null,
  };
}

async function getGroupByName(origin, token, groupName) {
  const targetName = (groupName || SUB2API_DEFAULT_GROUP_NAME).trim() || SUB2API_DEFAULT_GROUP_NAME;
  const groups = await requestJson(origin, '/api/v1/admin/groups/all', {
    method: 'GET',
    token,
  });

  const normalized = targetName.toLowerCase();
  const group = (groups || []).find((item) => {
    const itemName = String(item?.name || '').trim().toLowerCase();
    if (!itemName) return false;
    if (itemName !== normalized) return false;
    return !item.platform || item.platform === 'openai';
  });

  if (!group) {
    throw new Error(`No openai group named "${targetName}" was found in SUB2API.`);
  }

  return group;
}

function normalizeSub2ApiGroupNames(value) {
  const source = Array.isArray(value)
    ? value
    : String(value || '').split(/[\r\n,，;；]+/);
  const seen = new Set();
  const names = [];
  for (const item of source) {
    const name = String(item || '').trim();
    const key = name.toLowerCase();
    if (!name || seen.has(key)) continue;
    seen.add(key);
    names.push(name);
  }
  return names.length ? names : [SUB2API_DEFAULT_GROUP_NAME];
}

async function getGroupsByNames(origin, token, groupNames) {
  const targetNames = normalizeSub2ApiGroupNames(groupNames);
  const groups = await requestJson(origin, '/api/v1/admin/groups/all', {
    method: 'GET',
    token,
  });
  const matched = [];
  const missing = [];

  for (const targetName of targetNames) {
    const normalized = targetName.toLowerCase();
    const group = (groups || []).find((item) => {
      const itemName = String(item?.name || '').trim().toLowerCase();
      if (!itemName) return false;
      if (itemName !== normalized) return false;
      return !item.platform || item.platform === 'openai';
    });
    if (group) {
      matched.push(group);
    } else {
      missing.push(targetName);
    }
  }

  if (missing.length) {
    throw new Error(`The following openai groups were not found in SUB2API: ${missing.join(', ')}。`);
  }

  return matched;
}

function normalizeSub2ApiProxyPreference(value) {
  return String(value || '').trim();
}

function resolveSub2ApiProxyPreference(payload = {}, backgroundState = {}) {
  if (payload.sub2apiDefaultProxyName !== undefined) {
    return normalizeSub2ApiProxyPreference(payload.sub2apiDefaultProxyName);
  }
  if (backgroundState.sub2apiDefaultProxyName !== undefined) {
    return normalizeSub2ApiProxyPreference(backgroundState.sub2apiDefaultProxyName);
  }
  return SUB2API_DEFAULT_PROXY_NAME;
}

function resolveSub2ApiAccountPriority(payload = {}, backgroundState = {}) {
  const candidate = payload.sub2apiAccountPriority !== undefined
    ? payload.sub2apiAccountPriority
    : backgroundState.sub2apiAccountPriority;
  const rawValue = String(candidate ?? '').trim();
  if (!rawValue) {
    return SUB2API_DEFAULT_PRIORITY;
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
  const name = String(proxy.name || '').trim();
  const protocol = String(proxy.protocol || '').trim();
  const host = String(proxy.host || '').trim();
  const port = proxy.port === undefined || proxy.port === null ? '' : String(proxy.port).trim();
  const address = protocol && host && port ? `${protocol}://${host}:${port}` : '';
  const parts = [
    name || '(Unnamed proxy)',
    id ? `#${id}` : '',
    address,
  ].filter(Boolean);
  return parts.join(' ');
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
    .map((value) => String(value).trim().toLowerCase())
    .filter(Boolean)
    .join(' ');
}

function isActiveProxy(proxy = {}) {
  const status = String(proxy.status || '').trim().toLowerCase();
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
    const exactMatches = activeProxies.filter((proxy) => {
      const name = String(proxy.name || '').trim().toLowerCase();
      return name === normalizedPreference;
    });
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

async function resolveSub2ApiProxy(origin, token, preference = '') {
  const proxies = await requestJson(origin, '/api/v1/admin/proxies/all?with_count=true', {
    method: 'GET',
    token,
  });
  if (!Array.isArray(proxies)) {
    throw new Error('SUB2API proxy list returned an unexpected format. Cannot auto-select a proxy.');
  }

  const { proxy, reason, candidates } = findSub2ApiProxy(proxies, preference);
  if (proxy) {
    return proxy;
  }

  const configured = normalizeSub2ApiProxyPreference(preference) || '(Not configured)';
  const available = (candidates || [])
    .slice(0, 8)
    .map(buildProxyDisplayName)
    .join('，') || 'No available proxy';
  if (reason === 'ambiguous-name' || reason === 'ambiguous-fuzzy') {
    throw new Error(`SUB2API default proxy "${configured}" matched multiple proxies. Please enter a proxy ID instead. Candidates: ${available}`);
  }
  if (reason === 'missing-id') {
    throw new Error(`SUB2API default proxy ID "${configured}" does not exist or is not enabled. Available proxies: ${available}`);
  }
  if (reason === 'missing-name') {
    throw new Error(`SUB2API default proxy "${configured}" does not exist or is not enabled. Available proxies: ${available}`);
  }
  if (reason === 'no-preference') {
    throw new Error(`SUB2API has multiple available proxies. Fill in the default proxy name or ID in the side panel; leave it blank to disable proxy use. Available proxies: ${available}`);
  }
  throw new Error('SUB2API has no available proxies. Check the default proxy configuration, or leave it blank to disable proxy use.');
}

function buildDraftAccountName(groupName) {
  const prefix = (groupName || SUB2API_DEFAULT_GROUP_NAME)
    .trim()
    .replace(/[^\w\u4e00-\u9fa5-]+/g, '-')
    .replace(/^-+|-+$/g, '') || SUB2API_DEFAULT_GROUP_NAME;
  const stamp = new Date().toISOString().replace(/\D/g, '').slice(2, 14);
  const random = Math.floor(Math.random() * 9000 + 1000);
  return `${prefix}-${stamp}-${random}`;
}

function extractStateFromAuthUrl(authUrl) {
  try {
    return new URL(authUrl).searchParams.get('state') || '';
  } catch {
    return '';
  }
}

function parseLocalhostCallback(rawUrl, visibleStep = 10) {
  let parsed;
  try {
    parsed = new URL(rawUrl);
  } catch {
    throw new Error('The provided callback URL is not a valid link.');
  }

  if (!['http:', 'https:'].includes(parsed.protocol)) {
    throw new Error('Callback URL protocol is invalid.');
  }
  if (!['localhost', '127.0.0.1'].includes(parsed.hostname)) {
    throw new Error(`Step ${visibleStep} only accepts localhost / 127.0.0.1 callback URLs.`);
  }
  if (parsed.pathname !== '/auth/callback') {
    throw new Error('Callback URL path must be /auth/callback.');
  }

  const code = (parsed.searchParams.get('code') || '').trim();
  const state = (parsed.searchParams.get('state') || '').trim();
  if (!code || !state) {
    throw new Error('Callback URL is missing code or state.');
  }

  return {
    url: parsed.toString(),
    code,
    state,
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

async function getBackgroundState() {
  try {
    return await chrome.runtime.sendMessage({ type: 'GET_STATE', source: 'sub2api-panel' });
  } catch {
    return {};
  }
}

function openAccountsPageSoon(origin) {
  const accountsUrl = `${origin}/admin/accounts`;
  if (location.href === accountsUrl || location.pathname.startsWith('/admin/accounts')) {
    return;
  }
  setTimeout(() => {
    try {
      location.replace(accountsUrl);
    } catch { }
  }, 500);
}

async function step1_generateOpenAiAuthUrl(payload = {}, options = {}) {
  const { report = true } = options;
  const logStep = Number.isInteger(payload?.logStep) ? payload.logStep : 1;
  const redirectUri = normalizeRedirectUri();
  const groupNames = normalizeSub2ApiGroupNames(payload.sub2apiGroupName || SUB2API_DEFAULT_GROUP_NAME);
  const groupName = groupNames[0] || SUB2API_DEFAULT_GROUP_NAME;

  const { origin, token } = await loginSub2Api(payload);
  const groups = await getGroupsByNames(origin, token, groupNames);
  const group = groups[0];
  const proxyPreference = resolveSub2ApiProxyPreference(payload);
  const proxy = proxyPreference ? await resolveSub2ApiProxy(origin, token, proxyPreference) : null;
  const proxyId = normalizeProxyId(proxy?.id);
  const draftName = buildDraftAccountName(group.name || groupName);
  const groupLabel = groups.map((item) => `${item.name}（#${item.id})`).join(', ');

  log(`Step ${logStep}：Logged in to SUB2API, using group ${groupLabel}。`);
  if (proxy) {
    log(`Step ${logStep}：Selected SUB2API default proxy ${buildProxyDisplayName(proxy)}。`);
  } else {
    log(`Step ${logStep}：SUB2API default proxy is not configured. This run will not use a proxy.`);
  }
  log(`Step ${logStep}：Generating OpenAI Auth URL in SUB2API. Callback URL: ${redirectUri}。`);

  const authRequestBody = {
    redirect_uri: redirectUri,
  };
  if (proxyId) {
    authRequestBody.proxy_id = proxyId;
  }

  const authData = await requestJson(origin, '/api/v1/admin/openai/generate-auth-url', {
    method: 'POST',
    token,
    body: authRequestBody,
  });

  const oauthUrl = String(authData?.auth_url || '').trim();
  const sessionId = String(authData?.session_id || '').trim();
  const oauthState = String(authData?.state || extractStateFromAuthUrl(oauthUrl)).trim();

  if (!oauthUrl || !sessionId) {
    throw new Error('SUB2API did not return a complete auth_url / session_id.');
  }

  log(`Step ${logStep}：Obtained SUB2API OAuth URL: ${oauthUrl.slice(0, 96)}...`, 'ok');
  const result = {
    oauthUrl,
    sub2apiSessionId: sessionId,
    sub2apiOAuthState: oauthState,
    sub2apiGroupId: group.id,
    sub2apiGroupIds: groups.map((item) => item.id),
    sub2apiDraftName: draftName,
    sub2apiProxyId: proxyId,
  };
  if (report) {
    reportComplete(1, result);
  }
  openAccountsPageSoon(origin);
  return result;
}

async function step9_submitOpenAiCallback(payload = {}) {
  const visibleStep = Number(payload?.visibleStep) || 10;
  const callback = parseLocalhostCallback(payload.localhostUrl || '', visibleStep);
  const backgroundState = await getBackgroundState();
  const flowEmail = String(backgroundState.email || '').trim();

  const sessionId = String(payload.sub2apiSessionId || backgroundState.sub2apiSessionId || '').trim();
  const expectedState = String(payload.sub2apiOAuthState || backgroundState.sub2apiOAuthState || '').trim();

  const { origin, token } = await loginSub2Api(payload);
  const proxyPreference = resolveSub2ApiProxyPreference(payload, backgroundState);
  const preferredProxyId = normalizeProxyId(payload.sub2apiProxyId || backgroundState.sub2apiProxyId);
  const proxySelector = preferredProxyId || proxyPreference;
  const proxy = proxySelector ? await resolveSub2ApiProxy(origin, token, proxySelector) : null;
  const proxyId = normalizeProxyId(proxy?.id);
  const accountPriority = resolveSub2ApiAccountPriority(payload, backgroundState);
  const storedGroupIds = Array.isArray(payload.sub2apiGroupIds)
    ? payload.sub2apiGroupIds
    : (Array.isArray(backgroundState.sub2apiGroupIds) ? backgroundState.sub2apiGroupIds : []);
  const groupIdsFromState = storedGroupIds
    .map((id) => Number(id))
    .filter((id) => Number.isFinite(id) && id > 0);
  const groups = groupIdsFromState.length
    ? groupIdsFromState.map((id) => ({ id }))
    : (payload.sub2apiGroupId
      ? [{ id: payload.sub2apiGroupId, name: payload.sub2apiGroupName || backgroundState.sub2apiGroupName || SUB2API_DEFAULT_GROUP_NAME }]
      : await getGroupsByNames(origin, token, payload.sub2apiGroupName || backgroundState.sub2apiGroupName || SUB2API_DEFAULT_GROUP_NAME));

  if (!sessionId) {
    throw new Error('Missing SUB2API session_id. Rerun Step 1.');
  }
  if (expectedState && expectedState !== callback.state) {
    throw new Error('The state in this localhost callback does not match the state generated in Step 1. Rerun Step 1.');
  }

  log('Exchanging the OpenAI authorization code with SUB2API...', 'info', { step: visibleStep, stepKey: 'platform-verify' });
  if (proxy) {
    log(`Using SUB2API default proxy ${buildProxyDisplayName(proxy)}。`, 'info', { step: visibleStep, stepKey: 'platform-verify' });
  } else {
    log('SUB2API default proxy is not configured. This run will not use a proxy.', 'info', { step: visibleStep, stepKey: 'platform-verify' });
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
    body: exchangeRequestBody,
  });

  const credentials = buildOpenAiCredentials(exchangeData);
  const extra = buildOpenAiExtra(exchangeData);
  const resolvedEmail = String(exchangeData?.email || credentials?.email || '').trim();
  const groupIds = groups
    .map((group) => Number(group.id))
    .filter((id) => Number.isFinite(id) && id > 0);
  if (!groupIds.length) {
    throw new Error('SUB2API returned an invalid target group ID.');
  }
  const accountName = resolvedEmail
    || flowEmail
    || String(payload.sub2apiDraftName || backgroundState.sub2apiDraftName || '').trim()
    || buildDraftAccountName(payload.sub2apiGroupName || backgroundState.sub2apiGroupName || SUB2API_DEFAULT_GROUP_NAME);
  const createPayload = {
    name: accountName,
    notes: '',
    platform: 'openai',
    type: 'oauth',
    credentials,
    concurrency: SUB2API_DEFAULT_CONCURRENCY,
    priority: accountPriority,
    rate_multiplier: SUB2API_DEFAULT_RATE_MULTIPLIER,
    group_ids: groupIds,
    auto_pause_on_expired: true,
  };
  if (proxyId) {
    createPayload.proxy_id = proxyId;
  }

  if (extra) {
    createPayload.extra = extra;
  }

  log(`Authorization code exchange succeeded. Creating SUB2API account (name: ${accountName})...`, 'info', { step: visibleStep, stepKey: 'platform-verify' });
  const createdAccount = await requestJson(origin, '/api/v1/admin/accounts', {
    method: 'POST',
    token,
    body: createPayload,
  });

  const verifiedStatus = `SUB2API account created #${createdAccount?.id || 'unknown'}`;
  log(verifiedStatus, 'ok', { step: visibleStep, stepKey: 'platform-verify' });
  reportComplete('platform-verify', {
    localhostUrl: callback.url,
    verifiedStatus,
    visibleStep,
  });
  openAccountsPageSoon(origin);
}

reportReady();
