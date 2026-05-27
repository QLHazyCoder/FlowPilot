// background/ip-proxy-core.js — IP proxy core (parse/apply/switch/probe)
let ipProxyAuthListenerInstalled = false;
let ipProxyErrorListenerInstalled = false;
let currentIpProxyAuthEntry = null;
let ipProxyExitDetectionToken = 0;
let ipProxyProbeInFlightPromise = null;
let lastAppliedIpProxyEntrySignature = '';
let ipProxyAuthHostVariantToggle = false;
const ipProxyHostResolveCache = new Map();
const IP_PROXY_HOST_RESOLVE_CACHE_TTL_MS = 60 * 1000;
const ipProxyHostResolveCursor = new Map();
let lastAppliedIpProxyAuthSnapshot = {
  host: '',
  port: 0,
  username: '',
  password: '',
};
let ipProxyAuthDiagnostics = {
  challengeCount: 0,
  providedCount: 0,
  lastIsProxy: null,
  lastStatusCode: 0,
  lastHost: '',
  lastPort: 0,
  lastAt: 0,
};
let ipProxyLastRuntimeError = {
  error: '',
  details: '',
  fatal: false,
  at: 0,
};

function normalizeAutomationWindowId(value) {
  if (value === null || value === undefined || value === '') {
    return null;
  }
  const numeric = Number(value);
  return Number.isInteger(numeric) && numeric >= 0 ? numeric : null;
}

function buildAutomationWindowUnavailableError(error) {
  const suffix = error?.message ? ` Reason: ${error.message}` : '';
  return new Error(`Automation window is no longer available. Please reopen the side panel in the target Chrome window and restart the task.${suffix}`);
}

async function createAutomationScopedTab(createProperties = {}, options = {}) {
  const windowId = normalizeAutomationWindowId(
    options?.automationWindowId
      ?? options?.windowId
      ?? options?.state?.automationWindowId
      ?? null
  );
  if (windowId === null) {
    return chrome.tabs.create(createProperties || {});
  }

  try {
    return await chrome.tabs.create({
      ...(createProperties || {}),
      windowId,
    });
  } catch (error) {
    throw buildAutomationWindowUnavailableError(error);
  }
}

async function queryAutomationScopedTabs(queryInfo = {}, options = {}) {
  const windowId = normalizeAutomationWindowId(
    options?.automationWindowId
      ?? options?.windowId
      ?? options?.state?.automationWindowId
      ?? null
  );
  if (windowId === null) {
    return chrome.tabs.query(queryInfo || {});
  }

  const scopedQuery = {
    ...(queryInfo || {}),
    windowId,
  };
  delete scopedQuery.currentWindow;
  try {
    return await chrome.tabs.query(scopedQuery);
  } catch (error) {
    throw buildAutomationWindowUnavailableError(error);
  }
}


const IP_PROXY_EXIT_PROBE_ENDPOINTS = [
  'http://ip-api.com/json?lang=en',
  'http://ipinfo.io/json',
  'https://ipinfo.io/json',
  'http://myip.ipip.net',
  'https://chatgpt.com/cdn-cgi/trace',
  'https://ipwho.is/',
  'https://ipapi.co/json/',
  'https://api.ipify.org?format=json',
  'https://api64.ipify.org?format=json',
  'https://httpbin.org/ip',
  'https://checkip.amazonaws.com',
  'https://ident.me',
];
const IP_PROXY_EXIT_PROBE_ENDPOINTS_711_STICKY = [
  // Align with curl semantics — keep a single endpoint to avoid extra variance/latency from multi-site probing.
  'https://ipinfo.io/json',
];
const IP_PROXY_TARGET_REACHABILITY_ENDPOINTS = [
  // Step 1 real target site — a usable exit IP doesn't guarantee its CONNECT/TLS link works.
  'https://chatgpt.com/',
];
const IP_PROXY_TARGET_REACHABILITY_TIMEOUT_MS = 8000;
const IP_PROXY_BACKGROUND_PROBE_MAX_ENDPOINTS = 4;
const IP_PROXY_BACKGROUND_PROBE_PER_ENDPOINT_TIMEOUT_MS = 3500;
const IP_PROXY_PAGE_CONTEXT_PROBE_URL = 'https://example.com/';
const IP_PROXY_PAGE_CONTEXT_BASELINE_URL = 'https://ifconfig.co/json';
const IP_PROXY_PAGE_CONTEXT_READY_TIMEOUT_MS = 8000;
const IP_PROXY_PAGE_CONTEXT_BASELINE_TIMEOUT_MS = 6000;
const IP_PROXY_DIAGNOSTICS_SUMMARY_MAX_ITEMS = 8;
const IP_PROXY_GUARD_BLOCK_RULE_ID = 10991;
const IP_PROXY_GUARD_REGEX = '^https?:\\/\\/([^\\/]+\\.)?(chatgpt\\.com|openai\\.com)(\\/|$)';

function normalizeIpProxyProviderValue(value = '') {
  const normalized = String(value || '').trim().toLowerCase();
  const enabledValues = Array.isArray(globalThis.IP_PROXY_ENABLED_SERVICE_VALUES)
    ? globalThis.IP_PROXY_ENABLED_SERVICE_VALUES
    : [];
  if (enabledValues.includes(normalized)) {
    return normalized;
  }
  if (IP_PROXY_SERVICE_VALUES.includes(normalized)) {
    return DEFAULT_IP_PROXY_SERVICE;
  }
  return DEFAULT_IP_PROXY_SERVICE;
}

function normalizeProxyHostForCompare(value = '') {
  return String(value || '').trim().toLowerCase().replace(/\.$/, '');
}

function stripProxyHostTrailingDot(value = '') {
  return String(value || '').trim().replace(/\.$/, '');
}

function isIpv4LikeHost(value = '') {
  const text = String(value || '').trim();
  if (!text) {
    return false;
  }
  return /^\d{1,3}(?:\.\d{1,3}){3}$/.test(text);
}

function isIpv6LikeHost(value = '') {
  const text = String(value || '').trim();
  if (!text) {
    return false;
  }
  const compact = text.replace(/^\[/, '').replace(/\]$/, '');
  return compact.includes(':');
}

function canUseProxyHostVariant(value = '') {
  const host = stripProxyHostTrailingDot(value);
  if (!host) {
    return false;
  }
  if (isIpv4LikeHost(host) || isIpv6LikeHost(host)) {
    return false;
  }
  return /[A-Za-z]/.test(host) && host.includes('.');
}

function isValidIpv4Address(value = '') {
  const text = String(value || '').trim();
  if (!/^\d{1,3}(?:\.\d{1,3}){3}$/.test(text)) {
    return false;
  }
  const parts = text.split('.');
  return parts.length === 4 && parts.every((part) => {
    const numeric = Number.parseInt(part, 10);
    return Number.isInteger(numeric) && numeric >= 0 && numeric <= 255;
  });
}

function readCachedResolvedProxyHosts(host = '') {
  const key = stripProxyHostTrailingDot(host).toLowerCase();
  if (!key) {
    return [];
  }
  const cached = ipProxyHostResolveCache.get(key);
  if (!cached || !Array.isArray(cached?.ips) || !cached?.expiresAt) {
    return [];
  }
  if (cached.expiresAt <= Date.now()) {
    ipProxyHostResolveCache.delete(key);
    return [];
  }
  return cached.ips;
}

function writeCachedResolvedProxyHosts(host = '', ips = []) {
  const key = stripProxyHostTrailingDot(host).toLowerCase();
  if (!key) {
    return;
  }
  const normalized = Array.from(new Set((Array.isArray(ips) ? ips : [])
    .map((item) => String(item || '').trim())
    .filter((item) => isValidIpv4Address(item))));
  if (!normalized.length) {
    return;
  }
  ipProxyHostResolveCache.set(key, {
    ips: normalized,
    expiresAt: Date.now() + IP_PROXY_HOST_RESOLVE_CACHE_TTL_MS,
  });
  if (!ipProxyHostResolveCursor.has(key)) {
    ipProxyHostResolveCursor.set(key, 0);
  }
}

function pickNextResolvedProxyHost(host = '', candidates = []) {
  const key = stripProxyHostTrailingDot(host).toLowerCase();
  const list = Array.isArray(candidates)
    ? candidates.map((item) => String(item || '').trim()).filter((item) => isValidIpv4Address(item))
    : [];
  if (!key || !list.length) {
    return '';
  }
  const cursor = Number(ipProxyHostResolveCursor.get(key) || 0);
  const index = Math.abs(cursor) % list.length;
  ipProxyHostResolveCursor.set(key, cursor + 1);
  return String(list[index] || '').trim();
}

async function resolveProxyHostIpv4Candidates(host = '', timeoutMs = 3500) {
  const normalizedHost = stripProxyHostTrailingDot(host);
  if (!canUseProxyHostVariant(normalizedHost)) {
    return [];
  }
  const cached = readCachedResolvedProxyHosts(normalizedHost);
  if (cached.length) {
    return cached;
  }
  const endpoint = `https://dns.google/resolve?name=${encodeURIComponent(normalizedHost)}&type=A`;
  const response = await fetchWithTimeout(endpoint, {
    method: 'GET',
    cache: 'no-store',
    headers: {
      Accept: 'application/dns-json, application/json, text/plain, */*',
    },
  }, timeoutMs);
  if (!response.ok) {
    return [];
  }
  const payload = await response.json().catch(() => null);
  if (!payload || typeof payload !== 'object') {
    return [];
  }
  const answers = Array.isArray(payload?.Answer) ? payload.Answer : [];
  const ips = answers
    .filter((item) => Number(item?.type) === 1)
    .map((item) => String(item?.data || '').trim())
    .filter((ip) => isValidIpv4Address(ip));
  const uniqueIps = Array.from(new Set(ips));
  if (!uniqueIps.length) {
    return [];
  }
  writeCachedResolvedProxyHosts(normalizedHost, uniqueIps);
  return uniqueIps;
}

async function maybeResolveProxyHostVariantForAuthSwitch(entry = {}, options = {}) {
  const force = Boolean(options?.force);
  if (!force) {
    return entry;
  }
  const provider = normalizeIpProxyProviderValue(entry?.provider || DEFAULT_IP_PROXY_SERVICE);
  const allow711ResolvedIp = Boolean(options?.allow711ResolvedIp);
  // 711 keeps domain routing by default; only allow IP variant resolution in "multi-account list switch"
  // scenarios to force breaking same host:port connection reuse and improve odds of triggering 407 challenge.
  if (provider === '711proxy' && !allow711ResolvedIp) {
    return entry;
  }
  const protocol = normalizeIpProxyProtocol(entry?.protocol || DEFAULT_IP_PROXY_PROTOCOL);
  if (protocol !== 'http') {
    return entry;
  }
  if (!String(entry?.username || '').trim()) {
    return entry;
  }
  const host = stripProxyHostTrailingDot(entry?.host || '');
  if (!canUseProxyHostVariant(host)) {
    return entry;
  }
  const candidates = await resolveProxyHostIpv4Candidates(host, Number(options?.timeoutMs) || 3500).catch(() => []);
  if (!candidates.length) {
    return entry;
  }
  const selectedHost = pickNextResolvedProxyHost(host, candidates);
  if (!selectedHost || !isValidIpv4Address(selectedHost)) {
    return entry;
  }
  return {
    ...entry,
    host: selectedHost,
  };
}

function buildHostVariantForProxy(value = '', useTrailingDot = false) {
  const host = stripProxyHostTrailingDot(value);
  if (!canUseProxyHostVariant(host)) {
    return host;
  }
  return useTrailingDot ? `${host}.` : host;
}

function shouldForceProxyConnectionDrainForEntry(entry = {}) {
  const nextHost = normalizeProxyHostForCompare(entry?.host || '');
  const nextPort = normalizeIpProxyPort(entry?.port);
  const nextUser = String(entry?.username || '').trim();
  const nextPass = String(entry?.password || '');
  if (!nextHost || !nextPort || !nextUser) {
    return false;
  }
  const previousHost = normalizeProxyHostForCompare(lastAppliedIpProxyAuthSnapshot?.host || '');
  const previousPort = normalizeIpProxyPort(lastAppliedIpProxyAuthSnapshot?.port);
  if (!previousHost || !previousPort) {
    return false;
  }
  const sameEndpoint = nextHost === previousHost && nextPort === previousPort;
  if (!sameEndpoint) {
    return false;
  }
  const previousUser = String(lastAppliedIpProxyAuthSnapshot?.username || '').trim();
  const previousPass = String(lastAppliedIpProxyAuthSnapshot?.password || '');
  return nextUser !== previousUser || nextPass !== previousPass;
}

function buildEffectiveProxyEntryForApply(entry = {}, options = {}) {
  const forceRotateVariant = Boolean(options?.forceRotateVariant);
  const next = { ...(entry || {}) };
  const provider = normalizeIpProxyProviderValue(next?.provider || DEFAULT_IP_PROXY_SERVICE);
  const originalHost = String(next?.host || '').trim();
  if (provider === '711proxy') {
    const allow711HostVariant = Boolean(options?.allow711HostVariant) && forceRotateVariant;
    if (allow711HostVariant && canUseProxyHostVariant(originalHost)) {
      ipProxyAuthHostVariantToggle = !ipProxyAuthHostVariantToggle;
      next.host = buildHostVariantForProxy(originalHost, ipProxyAuthHostVariantToggle);
      return next;
    }
    // Keep host stable in single-account scenarios to avoid unnecessary link disturbance.
    next.host = stripProxyHostTrailingDot(originalHost);
    return next;
  }
  const canVariant = canUseProxyHostVariant(originalHost);
  if (!canVariant) {
    next.host = stripProxyHostTrailingDot(originalHost);
    return next;
  }
  if (forceRotateVariant) {
    ipProxyAuthHostVariantToggle = !ipProxyAuthHostVariantToggle;
  }
  next.host = buildHostVariantForProxy(originalHost, ipProxyAuthHostVariantToggle);
  return next;
}

function resetIpProxyAuthDiagnostics() {
  ipProxyAuthDiagnostics = {
    challengeCount: 0,
    providedCount: 0,
    lastIsProxy: null,
    lastStatusCode: 0,
    lastHost: '',
    lastPort: 0,
    lastAt: 0,
  };
}

function recordIpProxyAuthChallenge(details = {}, provided = false) {
  const host = String(details?.challenger?.host || '').trim();
  const port = Number.parseInt(String(details?.challenger?.port || ''), 10) || 0;
  const statusCode = Number.parseInt(String(details?.statusCode || ''), 10) || 0;
  const isProxy = details?.isProxy === true;
  ipProxyAuthDiagnostics.challengeCount += 1;
  if (provided) {
    ipProxyAuthDiagnostics.providedCount += 1;
  }
  ipProxyAuthDiagnostics.lastIsProxy = isProxy;
  ipProxyAuthDiagnostics.lastStatusCode = statusCode;
  ipProxyAuthDiagnostics.lastHost = host;
  ipProxyAuthDiagnostics.lastPort = port;
  ipProxyAuthDiagnostics.lastAt = Date.now();
}

function getIpProxyAuthDiagnosticsSummary() {
  const lastHost = String(ipProxyAuthDiagnostics?.lastHost || '').trim();
  const lastPort = Number(ipProxyAuthDiagnostics?.lastPort || 0);
  const hostPort = lastHost
    ? `${lastHost}${lastPort > 0 ? `:${lastPort}` : ''}`
    : 'unknown';
  const isProxyText = ipProxyAuthDiagnostics?.lastIsProxy === null
    ? 'n/a'
    : (ipProxyAuthDiagnostics.lastIsProxy ? 'true' : 'false');
  return `auth(challenge=${Number(ipProxyAuthDiagnostics?.challengeCount || 0)},provided=${Number(ipProxyAuthDiagnostics?.providedCount || 0)},isProxy=${isProxyText},status=${Number(ipProxyAuthDiagnostics?.lastStatusCode || 0)},host=${hostPort})`;
}

function appendIpProxyAuthDiagnosticsToErrors(errors = []) {
  if (!Array.isArray(errors)) {
    return;
  }
  errors.push(`probe:${getIpProxyAuthDiagnosticsSummary()}`);
}

function parseIpProxyAuthDiagnosticsSummary(summary = '') {
  const text = String(summary || '').trim();
  if (!text) {
    return null;
  }
  const challenge = Number.parseInt(String(text.match(/challenge=(\d+)/i)?.[1] || ''), 10) || 0;
  const provided = Number.parseInt(String(text.match(/provided=(\d+)/i)?.[1] || ''), 10) || 0;
  return { challenge, provided };
}

function resetIpProxyRuntimeErrorDiagnostics() {
  ipProxyLastRuntimeError = {
    error: '',
    details: '',
    fatal: false,
    at: 0,
  };
}

function getIpProxyRuntimeErrorSummary() {
  const error = String(ipProxyLastRuntimeError?.error || '').trim();
  const details = String(ipProxyLastRuntimeError?.details || '').trim();
  const fatal = Boolean(ipProxyLastRuntimeError?.fatal);
  if (!error && !details) {
    return '';
  }
  return `proxy_error(error=${error || 'unknown'},fatal=${fatal ? 1 : 0},details=${details || 'n/a'})`;
}

function appendIpProxyRuntimeErrorDiagnosticsToErrors(errors = [], maxAgeMs = 30000) {
  if (!Array.isArray(errors)) {
    return;
  }
  const summary = getIpProxyRuntimeErrorSummary();
  if (!summary) {
    return;
  }
  const ageMs = Date.now() - Number(ipProxyLastRuntimeError?.at || 0);
  if (!Number.isFinite(ageMs) || ageMs < 0 || ageMs > Math.max(1000, Number(maxAgeMs) || 30000)) {
    return;
  }
  errors.push(`probe:${summary}`);
}

function buildProbeDiagnosticsSummary(errors = [], maxItems = 4) {
  if (!Array.isArray(errors) || !errors.length) {
    return '';
  }
  const normalized = errors
    .map((item) => String(item || '').trim())
    .filter(Boolean);
  if (!normalized.length) {
    return '';
  }
  const authItem = normalized.find((item) => /probe:auth\(/i.test(item)) || '';
  const proxyErrorItem = normalized.find((item) => /probe:proxy_error\(/i.test(item)) || '';
  const navigationItem = normalized.find((item) => /probe:page_context:navigation_error:/i.test(item)) || '';
  const pageContextItem = normalized.find((item) => /probe:page_context:/i.test(item)) || '';
  const slowRetryItem = normalized.find((item) => /probe:bg:slow_retry:/i.test(item)) || '';
  const retryItem = normalized.find((item) => /probe:bg:retry:/i.test(item)) || '';
  const abortFallbackItem = normalized.find((item) => /probe:bg:abort_storm_page_fallback/i.test(item)) || '';
  const headLimit = Math.max(1, Number(maxItems) || 4);
  const headItems = normalized.slice(0, headLimit);
  const mustKeepItems = [
    authItem,
    proxyErrorItem,
    navigationItem,
    pageContextItem,
    slowRetryItem,
    retryItem,
    abortFallbackItem,
  ].filter(Boolean);
  for (const mustKeepItem of mustKeepItems) {
    if (headItems.includes(mustKeepItem)) {
      continue;
    }
    if (headItems.length >= headLimit) {
      headItems[headItems.length - 1] = mustKeepItem;
    } else {
      headItems.push(mustKeepItem);
    }
  }
  return headItems.join(' | ');
}

function normalizeIpProxyMode(value = '') {
  const normalized = String(value || '').trim().toLowerCase();
  return IP_PROXY_MODE_VALUES.includes(normalized) ? normalized : DEFAULT_IP_PROXY_MODE;
}

function normalizeIpProxyProtocol(value = '') {
  const normalized = String(value || '').trim().toLowerCase();
  return IP_PROXY_PROTOCOL_VALUES.includes(normalized) ? normalized : DEFAULT_IP_PROXY_PROTOCOL;
}

function normalizeIpProxyPort(value = '') {
  const numeric = Number.parseInt(String(value || '').trim(), 10);
  if (!Number.isInteger(numeric) || numeric <= 0 || numeric > 65535) {
    return 0;
  }
  return numeric;
}

function normalizeIpProxyCurrentIndex(value, fallback = 0) {
  const numeric = Number.parseInt(String(value ?? ''), 10);
  if (!Number.isInteger(numeric) || numeric < 0) {
    return Math.max(0, Number(fallback) || 0);
  }
  return numeric;
}

function normalizeIpProxyPoolTargetCount(value = '', fallback = 20) {
  const rawValue = String(value ?? '').trim();
  if (!rawValue) {
    return String(Math.max(1, Math.min(500, Number(fallback) || 20)));
  }
  const numeric = Number.parseInt(rawValue, 10);
  if (!Number.isInteger(numeric)) {
    return String(Math.max(1, Math.min(500, Number(fallback) || 20)));
  }
  return String(Math.max(1, Math.min(500, numeric)));
}

function normalizeIpProxyAccountLifeMinutes(value = '') {
  const raw = String(value ?? '').trim();
  if (!raw) return '';
  const numeric = Number.parseInt(raw, 10);
  if (!Number.isInteger(numeric)) return '';
  return String(Math.max(1, Math.min(1440, numeric)));
}

function normalizeIpProxyAccountSessionPrefix(value = '') {
  return String(value || '').trim().replace(/[^A-Za-z0-9_-]/g, '').slice(0, 32);
}

function normalizeIpProxyAccountList(value = '') {
  return String(value || '')
    .replace(/\r/g, '')
    .split('\n')
    .map((line) => line.trim())
    .filter((line) => {
      if (!line) {
        return false;
      }
      // Allow comments to quickly disable account list rows, avoiding "looks like comment, actually still active".
      if (/^(?:#|\/\/|;)/.test(line)) {
        return false;
      }
      return true;
    })
    .join('\n');
}

function inferRegionFromProxyUsername(username = '') {
  const text = String(username || '').trim();
  if (!text) {
    return '';
  }
  const match = text.match(/(?:^|[-_])(?:region|area|country)[-_:]?([A-Za-z]{2})\b/i);
  if (!match) {
    return '';
  }
  return String(match[1] || '').trim().toUpperCase();
}

function inferRegionFromProxyHost(host = '') {
  const text = String(host || '').trim().toLowerCase().replace(/\.$/, '');
  if (!text || !text.includes('.')) {
    return '';
  }
  const firstLabel = String(text.split('.')[0] || '').trim();
  if (!/^[a-z]{2}$/.test(firstLabel)) {
    return '';
  }
  return firstLabel.toUpperCase();
}

function shouldApplyConfiguredRegionFallbackToEntry(entry = {}, context = {}) {
  const provider = normalizeIpProxyProviderValue(
    context?.provider || entry?.provider || DEFAULT_IP_PROXY_SERVICE
  );
  const configuredRegion = String(context?.configuredRegion || '').trim();
  if (!configuredRegion) {
    return false;
  }
  if (Boolean(context?.hasAccountList)) {
    return false;
  }
  const entryRegion = String(entry?.region || '').trim();
  if (entryRegion) {
    return false;
  }
  if (provider !== '711proxy') {
    return true;
  }
  const usernameRegion = inferRegionFromProxyUsername(entry?.username || '');
  if (usernameRegion) {
    return true;
  }
  const hostRegion = inferRegionFromProxyHost(entry?.host || '');
  if (hostRegion) {
    return true;
  }
  // 711 fixed account in zone-custom mixed-broadcast scenarios: do not use legacy configured region fallback to avoid false "stuck at AF" reports.
  return false;
}

function resolveIpProxyAccountEntrySource(state = {}, mode = normalizeIpProxyMode(state?.ipProxyMode)) {
  const normalizedMode = normalizeIpProxyMode(mode);
  if (normalizedMode !== 'account') {
    return 'non_account';
  }
  return hasConfiguredAccountListEntries(state) ? 'account_list' : 'fixed_account';
}

function isIpProxyAccountListEnabled() {
  return Boolean(typeof IP_PROXY_ACCOUNT_LIST_ENABLED === 'undefined'
    ? true
    : IP_PROXY_ACCOUNT_LIST_ENABLED);
}

function normalizeIpProxyServiceProfile(rawValue = {}) {
  const raw = (rawValue && typeof rawValue === 'object' && !Array.isArray(rawValue))
    ? rawValue
    : {};
  const normalizeAutoSyncInterval = (value = '', fallback = 15) => {
    const rawValue = String(value ?? '').trim();
    if (!rawValue) {
      return Math.max(1, Math.min(1440, Number(fallback) || 15));
    }
    const numeric = Number.parseInt(rawValue, 10);
    if (!Number.isFinite(numeric)) {
      return Math.max(1, Math.min(1440, Number(fallback) || 15));
    }
    return Math.max(1, Math.min(1440, numeric));
  };
  return {
    mode: normalizeIpProxyMode(raw.mode),
    apiUrl: String(raw.apiUrl || '').trim(),
    accountList: normalizeIpProxyAccountList(raw.accountList || ''),
    accountSessionPrefix: normalizeIpProxyAccountSessionPrefix(raw.accountSessionPrefix || ''),
    accountLifeMinutes: normalizeIpProxyAccountLifeMinutes(raw.accountLifeMinutes || ''),
    poolTargetCount: normalizeIpProxyPoolTargetCount(raw.poolTargetCount || '', 20),
    autoSyncEnabled: Boolean(raw.autoSyncEnabled),
    autoSyncIntervalMinutes: normalizeAutoSyncInterval(raw.autoSyncIntervalMinutes, 15),
    host: String(raw.host || '').trim(),
    port: String(normalizeIpProxyPort(raw.port || '') || ''),
    protocol: normalizeIpProxyProtocol(raw.protocol),
    username: String(raw.username || '').trim(),
    password: String(raw.password || ''),
    region: String(raw.region || '').trim(),
  };
}

function buildIpProxyServiceProfileFromState(state = {}) {
  return normalizeIpProxyServiceProfile({
    mode: state?.ipProxyMode,
    apiUrl: state?.ipProxyApiUrl,
    accountList: state?.ipProxyAccountList,
    accountSessionPrefix: state?.ipProxyAccountSessionPrefix,
    accountLifeMinutes: state?.ipProxyAccountLifeMinutes,
    poolTargetCount: state?.ipProxyPoolTargetCount,
    autoSyncEnabled: state?.ipProxyAutoSyncEnabled,
    autoSyncIntervalMinutes: state?.ipProxyAutoSyncIntervalMinutes,
    host: state?.ipProxyHost,
    port: state?.ipProxyPort,
    protocol: state?.ipProxyProtocol,
    username: state?.ipProxyUsername,
    password: state?.ipProxyPassword,
    region: state?.ipProxyRegion,
  });
}

function normalizeIpProxyServiceProfiles(rawValue = {}, fallbackState = {}) {
  const raw = (rawValue && typeof rawValue === 'object' && !Array.isArray(rawValue))
    ? rawValue
    : {};
  const fallbackProfile = buildIpProxyServiceProfileFromState(fallbackState);
  const result = {};
  IP_PROXY_SERVICE_VALUES.forEach((service) => {
    const serviceRaw = raw[service];
    if (serviceRaw && typeof serviceRaw === 'object' && !Array.isArray(serviceRaw)) {
      result[service] = normalizeIpProxyServiceProfile(serviceRaw);
      return;
    }
    result[service] = normalizeIpProxyServiceProfile(fallbackProfile);
  });
  return result;
}

function normalizeIpProxyEntriesFromObjectCandidate(candidate, provider = DEFAULT_IP_PROXY_SERVICE) {
  if (!candidate || typeof candidate !== 'object') {
    return null;
  }

  const directProxyText = String(
    candidate.proxy
    || candidate.proxy_url
    || candidate.proxyUrl
    || candidate.proxyAddress
    || ''
  ).trim();
  if (directProxyText) {
    const parsed = parseIpProxyLine(directProxyText, provider);
    if (parsed) {
      return {
        ...parsed,
        region: String(candidate.region || candidate.country || candidate.city || parsed.region || '').trim(),
      };
    }
  }

  const host = String(
    candidate.host
    || candidate.ip
    || candidate.server
    || candidate.address
    || candidate.proxy_host
    || candidate.proxyHost
    || ''
  ).trim();
  const port = normalizeIpProxyPort(
    candidate.port
    || candidate.proxy_port
    || candidate.proxyPort
    || ''
  );
  if (!host || !port) {
    return null;
  }

  const username = String(
    candidate.username
    || candidate.user
    || candidate.account
    || candidate.proxy_user
    || candidate.proxyUser
    || ''
  ).trim();
  const password = String(
    candidate.password
    || candidate.pass
    || candidate.pwd
    || candidate.proxy_pass
    || candidate.proxyPass
    || ''
  );
  const protocol = normalizeIpProxyProtocol(
    candidate.protocol
    || candidate.schema
    || candidate.scheme
    || candidate.type
    || ''
  );
  const region = String(candidate.region || candidate.country || candidate.city || '').trim();
  return {
    host,
    port,
    username,
    password,
    protocol,
    region,
    provider: normalizeIpProxyProviderValue(candidate.provider || provider),
  };
}

function parseIpProxyLine(line, provider = DEFAULT_IP_PROXY_SERVICE) {
  const text = String(line || '').trim();
  if (!text) {
    return null;
  }

  const schemaMatch = text.match(/^(https?|socks4|socks5):\/\/(.+)$/i);
  const protocol = normalizeIpProxyProtocol(schemaMatch ? schemaMatch[1] : '');
  const rawBody = schemaMatch ? schemaMatch[2] : text;
  const firstSegment = rawBody.split(/[/?#]/)[0];
  const parts = firstSegment.split(':');
  if (parts.length < 2) {
    return null;
  }
  const host = String(parts[0] || '').trim();
  const port = normalizeIpProxyPort(parts[1]);
  if (!host || !port) {
    return null;
  }

  const username = String(parts[2] || '').trim();
  const password = parts.length >= 4 ? String(parts.slice(3).join(':') || '') : '';
  return {
    host,
    port,
    username,
    password,
    protocol,
    region: '',
    provider: normalizeIpProxyProviderValue(provider),
  };
}

function enumerateContiguousIpv4WithColonCandidates(text = '', startIndex = 0) {
  const source = String(text || '');
  const candidates = [];
  const sourceLength = source.length;
  const isDigitCode = (code) => code >= 48 && code <= 57;

  const readOctet = (offset, maxLen = 3) => {
    let end = offset;
    while (end < sourceLength && end < offset + maxLen) {
      const code = source.charCodeAt(end);
      if (!isDigitCode(code)) {
        break;
      }
      end += 1;
    }
    if (end <= offset) {
      return null;
    }
    const value = Number.parseInt(source.slice(offset, end), 10);
    if (!Number.isInteger(value) || value < 0 || value > 255) {
      return null;
    }
    return { value, end };
  };

  for (let l1 = 1; l1 <= 3; l1 += 1) {
    const o1 = readOctet(startIndex, l1);
    if (!o1 || source[o1.end] !== '.') continue;
    for (let l2 = 1; l2 <= 3; l2 += 1) {
      const o2 = readOctet(o1.end + 1, l2);
      if (!o2 || source[o2.end] !== '.') continue;
      for (let l3 = 1; l3 <= 3; l3 += 1) {
        const o3 = readOctet(o2.end + 1, l3);
        if (!o3 || source[o3.end] !== '.') continue;
        for (let l4 = 1; l4 <= 3; l4 += 1) {
          const o4 = readOctet(o3.end + 1, l4);
          if (!o4 || source[o4.end] !== ':') continue;
          const host = `${o1.value}.${o2.value}.${o3.value}.${o4.value}`;
          candidates.push({
            host,
            hostEnd: o4.end,
            portStart: o4.end + 1,
          });
        }
      }
    }
  }

  return candidates;
}

function parseContiguousProxyStream(rawText = '', provider = DEFAULT_IP_PROXY_SERVICE) {
  const source = String(rawText || '').trim();
  if (!source) {
    return [];
  }
  if (!/^\d/.test(source) || !source.includes(':')) {
    return [];
  }

  const memo = new Map();

  const solve = (offset = 0, previousHost = '') => {
    const key = `${offset}|${previousHost}`;
    if (memo.has(key)) {
      return memo.get(key);
    }
    if (offset >= source.length) {
      const terminal = { score: 0, tokens: [] };
      memo.set(key, terminal);
      return terminal;
    }

    let best = null;
    const hostCandidates = enumerateContiguousIpv4WithColonCandidates(source, offset);
    for (const candidate of hostCandidates) {
      const { host, portStart } = candidate;
      for (let portLen = 2; portLen <= 5; portLen += 1) {
        const portEnd = portStart + portLen;
        if (portEnd > source.length) {
          break;
        }
        const portText = source.slice(portStart, portEnd);
        if (!/^\d+$/.test(portText)) {
          break;
        }
        const port = Number.parseInt(portText, 10);
        if (!Number.isInteger(port) || port <= 0 || port > 65535) {
          continue;
        }
        const next = solve(portEnd, host);
        if (!next) {
          continue;
        }
        const hostContinuityBonus = previousHost
          ? (previousHost === host ? 8 : -4)
          : 0;
        const portLengthBonus = portLen * 2;
        const tinyPortPenalty = port < 1000 ? -40 : 0;
        const score = next.score + 100 + hostContinuityBonus + portLengthBonus + tinyPortPenalty;
        if (!best || score > best.score) {
          best = {
            score,
            tokens: [{
              host,
              port,
              provider: normalizeIpProxyProviderValue(provider),
            }, ...next.tokens],
          };
        }
      }
    }

    memo.set(key, best);
    return best;
  };

  const solved = solve(0, '');
  if (!solved || !Array.isArray(solved.tokens) || solved.tokens.length <= 0) {
    return [];
  }
  return solved.tokens.map((item) => ({
    host: String(item.host || '').trim(),
    port: normalizeIpProxyPort(item.port),
    username: '',
    password: '',
    protocol: DEFAULT_IP_PROXY_PROTOCOL,
    region: '',
    provider: normalizeIpProxyProviderValue(item.provider || provider),
  })).filter((item) => item.host && item.port);
}

function normalizeProxyPoolEntries(value = [], provider = DEFAULT_IP_PROXY_SERVICE) {
  const result = [];
  const seen = new Set();
  const append = (entry) => {
    if (!entry || !entry.host || !entry.port) {
      return;
    }
    const normalizedEntry = {
      host: String(entry.host || '').trim(),
      port: normalizeIpProxyPort(entry.port),
      username: String(entry.username || '').trim(),
      password: String(entry.password || ''),
      protocol: normalizeIpProxyProtocol(entry.protocol || ''),
      region: String(entry.region || '').trim(),
      provider: normalizeIpProxyProviderValue(entry.provider || provider),
    };
    if (!normalizedEntry.host || !normalizedEntry.port) {
      return;
    }
    const dedupKey = `${normalizedEntry.host}:${normalizedEntry.port}:${normalizedEntry.username}:${normalizedEntry.password}:${normalizedEntry.protocol}`;
    if (seen.has(dedupKey)) {
      return;
    }
    seen.add(dedupKey);
    result.push(normalizedEntry);
  };

  if (typeof value === 'string') {
    const rawText = String(value || '');
    normalizeIpProxyAccountList(rawText).split('\n').forEach((line) => {
      append(parseIpProxyLine(line, provider));
    });
    if (!result.length) {
      const contiguousEntries = parseContiguousProxyStream(rawText, provider);
      contiguousEntries.forEach((entry) => append(entry));
    }
    if (!result.length) {
      // Lumi API may return host:port stream without separators when lb param is invalid — fallback split here.
      const contiguousMatches = rawText.match(/\d{1,3}(?:\.\d{1,3}){3}:\d{2,5}/g) || [];
      contiguousMatches.forEach((token) => {
        append(parseIpProxyLine(token, provider));
      });
    }
    return result;
  }

  if (Array.isArray(value)) {
    value.forEach((item) => {
      if (typeof item === 'string') {
        append(parseIpProxyLine(item, provider));
        return;
      }
      append(normalizeIpProxyEntriesFromObjectCandidate(item, provider));
    });
    return result;
  }

  if (value && typeof value === 'object') {
    append(normalizeIpProxyEntriesFromObjectCandidate(value, provider));
  }
  return result;
}

function normalizeIpProxyListFromPayload(payload, provider = DEFAULT_IP_PROXY_SERVICE) {
  if (Array.isArray(payload)) {
    return normalizeProxyPoolEntries(payload, provider);
  }

  if (!payload || typeof payload !== 'object') {
    if (typeof payload === 'string') {
      return normalizeProxyPoolEntries(payload, provider);
    }
    return [];
  }

  const candidateArrays = [
    payload.data,
    payload.list,
    payload.items,
    payload.proxies,
    payload.result,
    payload.rows,
  ];
  for (const candidate of candidateArrays) {
    if (Array.isArray(candidate) && candidate.length > 0) {
      return normalizeProxyPoolEntries(candidate, provider);
    }
  }

  const singleCandidate = normalizeIpProxyEntriesFromObjectCandidate(payload, provider);
  return singleCandidate ? [singleCandidate] : [];
}

function getAccountModeProxyPoolFromState(state = {}, provider = DEFAULT_IP_PROXY_SERVICE) {
  const normalizedProvider = normalizeIpProxyProviderValue(provider || state?.ipProxyService || DEFAULT_IP_PROXY_SERVICE);
  const accountListEnabled = isIpProxyAccountListEnabled();
  const rawLines = normalizeIpProxyAccountList(state?.ipProxyAccountList || '').split('\n').filter(Boolean);
  const lines = accountListEnabled ? rawLines : [];
  const hasAccountList = lines.length > 0;
  const transformState = hasAccountList
    ? {
      ...state,
      ipProxyHost: '',
      ipProxyPort: '',
      ipProxyUsername: '',
      ipProxyPassword: '',
      ipProxyRegion: '',
      ipProxyAccountSessionPrefix: '',
      ipProxyAccountLifeMinutes: '',
    }
    : state;
  let pool = lines.map((line) => parseIpProxyLine(line, normalizedProvider)).filter(Boolean);

  if (!pool.length && !hasAccountList) {
    const host = String(state?.ipProxyHost || '').trim();
    const port = normalizeIpProxyPort(state?.ipProxyPort);
    if (host && port) {
      pool = [{
        host,
        port,
        username: String(state?.ipProxyUsername || '').trim(),
        password: String(state?.ipProxyPassword || ''),
        protocol: normalizeIpProxyProtocol(state?.ipProxyProtocol),
        region: '',
        provider: normalizedProvider,
      }];
    } else if (!accountListEnabled && rawLines.length) {
      const legacyEntry = parseIpProxyLine(rawLines[0], normalizedProvider);
      if (legacyEntry) {
        pool = [legacyEntry];
      }
    }
  }

  const configuredRegion = String(state?.ipProxyRegion || '').trim();
  if (!pool.length) {
    return [];
  }

  return pool.map((entry, index) => {
    let nextEntry = { ...entry };
    if (typeof transformIpProxyAccountEntryByProvider === 'function') {
      const transformed = transformIpProxyAccountEntryByProvider(normalizedProvider, nextEntry, {
        state: transformState,
        index,
        hasAccountList,
      });
      if (transformed && typeof transformed === 'object') {
        nextEntry = transformed;
      }
    }
    const inferredRegion = inferRegionFromProxyUsername(nextEntry.username);
    if (inferredRegion) {
      nextEntry.region = inferredRegion;
    } else if (!String(nextEntry.region || '').trim()) {
      const inferredHostRegion = inferRegionFromProxyHost(nextEntry.host);
      if (inferredHostRegion) {
        nextEntry.region = inferredHostRegion;
      }
    }
    if (shouldApplyConfiguredRegionFallbackToEntry(nextEntry, {
      provider: normalizedProvider,
      configuredRegion,
      hasAccountList,
    })) {
      nextEntry.region = configuredRegion;
    }
    return nextEntry;
  });
}

function hasConfiguredAccountListEntries(state = {}) {
  if (!isIpProxyAccountListEnabled()) {
    return false;
  }
  const lines = normalizeIpProxyAccountList(state?.ipProxyAccountList || '').split('\n').filter(Boolean);
  return lines.length > 0;
}

function getAccountListParseFailureHint(state = {}, provider = DEFAULT_IP_PROXY_SERVICE) {
  if (!isIpProxyAccountListEnabled()) {
    return '';
  }
  const normalizedProvider = normalizeIpProxyProviderValue(provider || state?.ipProxyService || DEFAULT_IP_PROXY_SERVICE);
  const lines = normalizeIpProxyAccountList(state?.ipProxyAccountList || '').split('\n').filter(Boolean);
  if (!lines.length) {
    return '';
  }
  const parsedCount = lines
    .map((line) => parseIpProxyLine(line, normalizedProvider))
    .filter(Boolean)
    .length;
  if (parsedCount > 0) {
    return '';
  }
  if (normalizedProvider === '711proxy') {
    return 'Account list filled but no valid entries parsed. Please fill in host:port:username:password per line.';
  }
  return 'Account list filled but no valid entries parsed. Please check list format.';
}

function resolveIpProxyPoolTargetCountForMode(state = {}, mode = normalizeIpProxyMode(state?.ipProxyMode)) {
  const normalizedMode = normalizeIpProxyMode(mode);
  // `ipProxyPoolTargetCount` semantics is "task success round threshold";
  // proxy pool fetch/switch count no longer reuses this field to avoid semantic confusion.
  if (normalizedMode === 'account') {
    return 500;
  }
  return 100;
}

function resolveIpProxyAutoSwitchThreshold(state = {}) {
  return Math.max(
    1,
    Math.min(500, Number(normalizeIpProxyPoolTargetCount(state?.ipProxyPoolTargetCount, 20)) || 20)
  );
}

function buildProxyPoolSummary(pool = [], preferredIndex = 0) {
  const normalizedPool = Array.isArray(pool) ? pool : [];
  if (!normalizedPool.length) {
    return {
      count: 0,
      index: 0,
      current: null,
      display: 'No available proxy',
    };
  }
  const index = normalizeIpProxyCurrentIndex(preferredIndex, 0) % normalizedPool.length;
  const current = normalizedPool[index];
  const region = String(current?.region || '').trim();
  return {
    count: normalizedPool.length,
    index,
    current,
    display: `${current.host}:${current.port}${region ? ` [${region}]` : ''} (${index + 1}/${normalizedPool.length})`,
  };
}

function getIpProxyRuntimeFieldNames(mode = DEFAULT_IP_PROXY_MODE) {
  const normalizedMode = normalizeIpProxyMode(mode);
  if (normalizedMode === 'account') {
    return {
      poolKey: 'ipProxyAccountPool',
      indexKey: 'ipProxyAccountCurrentIndex',
      currentKey: 'ipProxyAccountCurrent',
    };
  }
  return {
    poolKey: 'ipProxyApiPool',
    indexKey: 'ipProxyApiCurrentIndex',
    currentKey: 'ipProxyApiCurrent',
  };
}

function getIpProxyRuntimeSnapshot(
  state = {},
  mode = normalizeIpProxyMode(state?.ipProxyMode),
  provider = normalizeIpProxyProviderValue(state?.ipProxyService)
) {
  const normalizedMode = normalizeIpProxyMode(mode);
  const normalizedProvider = normalizeIpProxyProviderValue(provider);
  const fields = getIpProxyRuntimeFieldNames(normalizedMode);
  const hasModePool = Array.isArray(state?.[fields.poolKey]);
  const hasModeCurrent = state?.[fields.currentKey] !== undefined && state?.[fields.currentKey] !== null;
  const hasModeIndex = state?.[fields.indexKey] !== undefined && state?.[fields.indexKey] !== null;
  const modePool = normalizeProxyPoolEntries(state?.[fields.poolKey], normalizedProvider);
  const modeCurrent = normalizeProxyPoolEntries(
    state?.[fields.currentKey] ? [state[fields.currentKey]] : [],
    normalizedProvider
  )[0] || null;
  const pool = hasModePool ? modePool : [];
  const current = hasModeCurrent ? modeCurrent : null;
  const indexSource = hasModeIndex ? state?.[fields.indexKey] : 0;
  return {
    mode: normalizedMode,
    provider: normalizedProvider,
    ...fields,
    hasModePool,
    hasModeCurrent,
    hasModeIndex,
    pool,
    current,
    index: normalizeIpProxyCurrentIndex(indexSource, 0),
  };
}

function isApiModeProxyConfigAvailable(state = {}) {
  return Boolean(String(state?.ipProxyApiUrl || '').trim());
}

function buildIpProxyRuntimeStatePatch(mode = DEFAULT_IP_PROXY_MODE, runtime = {}, provider = DEFAULT_IP_PROXY_SERVICE) {
  const normalizedMode = normalizeIpProxyMode(mode);
  const normalizedProvider = normalizeIpProxyProviderValue(provider);
  const fields = getIpProxyRuntimeFieldNames(normalizedMode);
  const pool = normalizeProxyPoolEntries(runtime?.pool, normalizedProvider);
  const summary = buildProxyPoolSummary(pool, runtime?.index);
  const explicitCurrent = normalizeProxyPoolEntries(
    runtime?.current ? [runtime.current] : [],
    normalizedProvider
  )[0] || null;
  const current = explicitCurrent || summary.current || null;
  return {
    [fields.poolKey]: pool,
    [fields.indexKey]: summary.index,
    [fields.currentKey]: current,
    // Compatibility with legacy state fields — keep the current active mode's summary visible.
    ipProxyPool: pool,
    ipProxyCurrentIndex: summary.index,
    ipProxyCurrent: current,
  };
}

function getIpProxyCurrentEntryFromState(state = {}) {
  const mode = normalizeIpProxyMode(state?.ipProxyMode);
  const provider = normalizeIpProxyProviderValue(state?.ipProxyService);
  if (mode === 'api' && !isApiModeProxyConfigAvailable(state)) {
    return null;
  }
  const runtime = getIpProxyRuntimeSnapshot(state, mode, provider);
  if (mode === 'account') {
    const hasAccountList = hasConfiguredAccountListEntries(state);
    const accountPool = getAccountModeProxyPoolFromState(state, provider);
    if (hasAccountList) {
      if (!accountPool.length) {
        return null;
      }
      const index = normalizeIpProxyCurrentIndex(runtime.index, 0) % accountPool.length;
      return accountPool[index];
    }
    if (accountPool.length) {
      const index = normalizeIpProxyCurrentIndex(runtime.index, 0) % accountPool.length;
      return accountPool[index];
    }
    const host = String(state?.ipProxyHost || '').trim();
    const port = normalizeIpProxyPort(state?.ipProxyPort);
    if (!host || !port) return null;
    const entry = {
      host,
      port,
      username: String(state?.ipProxyUsername || '').trim(),
      password: String(state?.ipProxyPassword || ''),
      protocol: normalizeIpProxyProtocol(state?.ipProxyProtocol),
      region: '',
      provider,
    };
    const inferredRegionFromUsername = inferRegionFromProxyUsername(entry.username);
    if (inferredRegionFromUsername) {
      entry.region = inferredRegionFromUsername;
    } else {
      const inferredRegionFromHost = inferRegionFromProxyHost(entry.host);
      if (inferredRegionFromHost) {
        entry.region = inferredRegionFromHost;
      }
    }
    const configuredRegion = String(state?.ipProxyRegion || '').trim();
    if (shouldApplyConfiguredRegionFallbackToEntry(entry, {
      provider,
      configuredRegion,
      hasAccountList: false,
    })) {
      entry.region = configuredRegion;
    }
    return entry;
  }

  const pool = runtime.pool;
  if (pool.length) {
    const index = normalizeIpProxyCurrentIndex(runtime.index, 0) % pool.length;
    return pool[index];
  }
  const fallback = normalizeProxyPoolEntries(runtime.current ? [runtime.current] : [], provider)[0];
  return fallback || null;
}

function buildIpProxyRoutingStatePatch(status = {}) {
  const provider = normalizeIpProxyProviderValue(status?.provider || DEFAULT_IP_PROXY_SERVICE);
  const host = String(status?.host || '').trim();
  const port = normalizeIpProxyPort(status?.port);
  const region = String(status?.region || '').trim();
  const hasAuth = Boolean(status?.hasAuth);
  const applied = Boolean(status?.applied);
  const reason = String(status?.reason || (applied ? 'applied' : 'disabled')).trim().toLowerCase();
  const error = String(status?.error || '').trim();
  const warning = String(status?.warning || '').trim();
  const exitIp = String(status?.exitIp || '').trim();
  const exitRegion = String(status?.exitRegion || '').trim();
  const exitDetecting = Boolean(status?.exitDetecting);
  const exitError = String(status?.exitError || '').trim();
  const exitSource = String(status?.exitSource || '').trim().toLowerCase();
  const exitEndpoint = String(status?.exitEndpoint || status?.endpoint || '').trim();
  return {
    ipProxyApplied: applied,
    ipProxyAppliedReason: reason,
    ipProxyAppliedAt: Date.now(),
    ipProxyAppliedHost: host,
    ipProxyAppliedPort: port,
    ipProxyAppliedRegion: region,
    ipProxyAppliedHasAuth: hasAuth,
    ipProxyAppliedProvider: provider,
    ipProxyAppliedError: error,
    ipProxyAppliedWarning: warning,
    ipProxyAppliedExitIp: exitIp,
    ipProxyAppliedExitRegion: exitRegion,
    ipProxyAppliedExitDetecting: exitDetecting,
    ipProxyAppliedExitError: exitError,
    ipProxyAppliedExitSource: exitSource,
    ipProxyAppliedExitEndpoint: exitEndpoint,
  };
}

async function setIpProxyLeakGuardEnabled(enabled) {
  if (!chrome.declarativeNetRequest?.updateDynamicRules) {
    return;
  }
  const removeRuleIds = [IP_PROXY_GUARD_BLOCK_RULE_ID];
  const addRules = enabled ? [{
    id: IP_PROXY_GUARD_BLOCK_RULE_ID,
    priority: 100,
    action: {
      type: 'block',
    },
    condition: {
      regexFilter: IP_PROXY_GUARD_REGEX,
      resourceTypes: [
        'main_frame',
        'sub_frame',
        'xmlhttprequest',
        'websocket',
        'other',
      ],
    },
  }] : [];
  await chrome.declarativeNetRequest.updateDynamicRules({
    removeRuleIds,
    addRules,
  }).catch(() => { });
}

function shouldEnableIpProxyLeakGuardForStatus(status = {}) {
  if (!status?.enabled) {
    return false;
  }
  if (status?.applied) {
    return false;
  }
  const reason = String(status?.reason || '').trim().toLowerCase();
  // connectivity_failed means PAC/proxy takeover was already applied, just the probe or target site failed.
  // Continuing to enable DNR here would turn chatgpt.com into ERR_BLOCKED_BY_CLIENT, hiding the real proxy link result.
  return reason !== 'connectivity_failed';
}

async function syncIpProxyLeakGuardForStatus(status = {}) {
  await setIpProxyLeakGuardEnabled(shouldEnableIpProxyLeakGuardForStatus(status));
}

async function fetchWithTimeout(url, options = {}, timeoutMs = IP_PROXY_FETCH_TIMEOUT_MS) {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), Math.max(1000, Number(timeoutMs) || IP_PROXY_FETCH_TIMEOUT_MS));
  try {
    return await fetch(url, {
      ...options,
      signal: controller.signal,
    });
  } finally {
    clearTimeout(timer);
  }
}

function extractIpv4FromText(value = '') {
  const text = String(value || '').trim();
  if (!text) {
    return '';
  }
  const ipv4Match = text.match(/\b(\d{1,3}(?:\.\d{1,3}){3})\b/);
  if (ipv4Match) {
    return ipv4Match[1];
  }
  const ipv6Match = text.match(/\b([0-9a-f]{0,4}(?::[0-9a-f]{0,4}){2,7})\b/i);
  return ipv6Match ? String(ipv6Match[1] || '').trim() : '';
}

function normalizeProbeRegionCode(value = '') {
  const code = String(value || '')
    .trim()
    .toUpperCase()
    .replace(/[^A-Z]/g, '');
  return /^[A-Z]{2}$/.test(code) ? code : '';
}

function pickProbeRegion(parsed = {}) {
  const countryCodeCandidates = [
    parsed?.countryCode,
    parsed?.country_code,
    parsed?.countrycode,
    parsed?.countryAlpha2,
    parsed?.country_alpha2,
    parsed?.countryISO,
    parsed?.countryIso,
    parsed?.iso_country,
    parsed?.geo?.countryCode,
    parsed?.geo?.country_code,
    parsed?.location?.countryCode,
    parsed?.location?.country_code,
  ];
  for (const candidate of countryCodeCandidates) {
    const code = normalizeProbeRegionCode(candidate);
    if (code) {
      return code;
    }
  }

  const fallbackCandidates = [
    parsed?.regionCode,
    parsed?.region_code,
    parsed?.country,
    parsed?.country_name,
    parsed?.countryName,
    parsed?.regionName,
    parsed?.region,
    parsed?.city,
  ];
  for (const candidate of fallbackCandidates) {
    const text = String(candidate || '').trim();
    if (text) {
      return text;
    }
  }
  return '';
}

function parseProxyExitProbePayload(rawText = '', contentType = '') {
  const text = String(rawText || '').trim();
  if (!text) {
    return { ip: '', region: '' };
  }
  if (/^[-_a-zA-Z0-9]+=/m.test(text)) {
    const kv = {};
    text.split(/\r?\n+/).forEach((line) => {
      const index = line.indexOf('=');
      if (index <= 0) return;
      const key = String(line.slice(0, index) || '').trim().toLowerCase();
      if (!key) return;
      kv[key] = String(line.slice(index + 1) || '').trim();
    });
    const kvIp = extractIpv4FromText(
      kv.ip
      || kv.query
      || kv.clientip
      || kv.client_ip
      || ''
    );
    const kvRegion = normalizeProbeRegionCode(kv.loc || kv.country_code || kv.countrycode || '');
    if (kvIp) {
      return {
        ip: kvIp,
        region: kvRegion,
      };
    }
  }
  const normalizedContentType = String(contentType || '').toLowerCase();
  if (normalizedContentType.includes('application/json') || text.startsWith('{') || text.startsWith('[')) {
    try {
      const parsed = JSON.parse(text);
      const ip = extractIpv4FromText(
        parsed?.ip
        || parsed?.query
        || parsed?.origin
        || parsed?.address
        || parsed?.ipAddress
        || parsed?.ip_address
        || ''
      );
      const region = pickProbeRegion(parsed);
      if (ip) {
        return { ip, region };
      }
    } catch {
      // fall through to regex parse
    }
  }

  const ip = extractIpv4FromText(text);
  if (!ip) {
    return { ip: '', region: '' };
  }
  return {
    ip,
    region: '',
  };
}

function normalizeRegionToken(value = '') {
  return String(value || '')
    .trim()
    .toUpperCase()
    .replace(/[^A-Z0-9]/g, '');
}

function hasProxyExitRegionMismatch(expectedRegion = '', detectedRegion = '') {
  const expected = normalizeRegionToken(expectedRegion);
  const detected = normalizeRegionToken(detectedRegion);
  if (!expected || !detected) {
    return false;
  }
  if (expected === detected) {
    return false;
  }
  if (expected.length >= 2 && detected.includes(expected)) {
    return false;
  }
  if (detected.length >= 2 && expected.includes(detected)) {
    return false;
  }
  return true;
}

function has711SessionToken(username = '') {
  const text = String(username || '').trim();
  if (!text) {
    return false;
  }
  return /(?:^|[-_])session[-_:][A-Za-z0-9_-]+\b/i.test(text);
}

function resolveExitProbeEndpoints(options = {}) {
  const provider = normalizeIpProxyProviderValue(options?.provider || '');
  const username = String(options?.username || '').trim();
  if (provider === '711proxy' && has711SessionToken(username)) {
    return IP_PROXY_EXIT_PROBE_ENDPOINTS_711_STICKY.slice();
  }
  return IP_PROXY_EXIT_PROBE_ENDPOINTS.slice();
}

function resolveTargetReachabilityEndpoints(options = {}) {
  const configured = Array.isArray(options?.targetReachabilityEndpoints)
    ? options.targetReachabilityEndpoints.map((item) => String(item || '').trim()).filter(Boolean)
    : [];
  return configured.length
    ? configured
    : IP_PROXY_TARGET_REACHABILITY_ENDPOINTS.slice();
}

function applyExitRegionExpectation(status = {}, expectedRegion = '') {
  const exitIp = String(status?.exitIp || '').trim();
  const exitError = String(status?.exitError || '').trim();
  if (!exitIp) {
    const hasBackgroundAbortStorm = /probe:bg:/.test(exitError)
      && /signal is aborted without reason/i.test(exitError);
    const hasBackgroundAbortFallback = /probe:bg:abort_storm_page_fallback/i.test(exitError);
    const hasProxyRuntimeError = /probe:proxy_error\(/i.test(exitError);
    const hasAuth = Boolean(status?.hasAuth);
    const challengeMatch = exitError.match(/challenge=(\d+)/i);
    const providedMatch = exitError.match(/provided=(\d+)/i);
    const challengeCount = Number.parseInt(String(challengeMatch?.[1] || ''), 10) || 0;
    const providedCount = Number.parseInt(String(providedMatch?.[1] || ''), 10) || 0;
    const missingProxyChallenge = hasAuth && challengeCount <= 0 && providedCount <= 0;
    const hasErrorPageFailure = /Frame with ID 0 is showing error page|Cannot access contents of the page/i.test(exitError);
    const netErrorCode = exitError.match(/net::ERR_[A-Z_]+/i)?.[0] || '';
    const navigationHint = netErrorCode
      ? `Navigation error: ${netErrorCode}.`
      : '';
    const tunnelFailedWithoutChallenge = missingProxyChallenge
      && /ERR_TUNNEL_CONNECTION_FAILED/i.test(netErrorCode || exitError);
    const humanizedError = hasErrorPageFailure
      ? (
          hasAuth
            ? 'Probe page entered browser error page (common with proxy auth failures, unavailable proxy nodes, or blocked networks). Please check proxy username/password and node availability, then retry.'
            : 'Probe page entered browser error page (common with unavailable proxy nodes, mismatched protocols, or blocked networks). Please check proxy node, port, and protocol settings, then retry.'
        )
      : '';
    const authDiagnostics = exitError.match(/probe:auth\([^)]+\)/i)?.[0] || '';
    const challengeHint = missingProxyChallenge
      ? 'Current link did not receive 407 proxy auth challenge (proxy may have returned non-standard rejection like 630 no Proxy-Authorization), browser cannot trigger extension auth fill-back. Suggestion: switch to API mode or use an account node that returns standard 407.'
      : '';
    const compatibilityHint = tunnelFailedWithoutChallenge
      ? 'Current account-mode node may use non-standard proxy auth link (no 407 challenge issued) — Chrome extension proxy API cannot auto-fill credentials on this link.'
      : '';
    const mergedErrorParts = [
      hasBackgroundAbortStorm
        ? (
            hasBackgroundAbortFallback
              ? 'Background probe requests aborted consecutively (proxy tunnel not established in time), and page probe fallback also failed to get a usable exit.'
              : 'Background probe requests aborted consecutively (proxy tunnel not established in time). Usually means proxy node link is unavailable or dropped upstream, not a probe page issue.'
          )
        : '',
      hasProxyRuntimeError
        ? 'Captured browser proxy stack error event (chrome.proxy.onProxyError). Please troubleshoot node/protocol compatibility using proxy_error field in diagnostics.'
        : '',
      humanizedError,
      navigationHint,
      compatibilityHint,
      challengeHint,
    ].filter(Boolean);
    const mergedError = mergedErrorParts.length
      ? `${mergedErrorParts.join(' ')}${authDiagnostics ? ` Diagnostics: ${authDiagnostics}` : ''}`
      : '';
    const mergedWithDiagnostics = mergedError
      ? (
          exitError
          && !mergedError.includes(exitError)
            ? `${mergedError} Diagnostics: ${exitError}`
            : mergedError
        )
      : '';
    return {
      ...status,
      applied: false,
      reason: 'connectivity_failed',
      error: mergedWithDiagnostics || exitError || 'No proxy exit IP detected. Cannot confirm proxy is in effect.',
    };
  }

  const expected = String(expectedRegion || '').trim();
  const entrySource = String(status?.entrySource || '').trim();
  const normalizedProvider = normalizeIpProxyProviderValue(status?.provider || DEFAULT_IP_PROXY_SERVICE);
  const authSummary = String(status?.authDiagnostics || '').trim();
  const parsedAuthSummary = parseIpProxyAuthDiagnosticsSummary(authSummary);
  const missingAuthChallenge = Boolean(status?.hasAuth)
    && parsedAuthSummary
    && parsedAuthSummary.challenge <= 0
    && parsedAuthSummary.provided <= 0;
  if (!expected) {
    return status;
  }

  const detected = String(status?.exitRegion || '').trim();
  if (!detected) {
    return {
      ...status,
      applied: false,
      reason: 'connectivity_failed',
      error: `Detected exit IP ${exitIp}, but region probe did not return a country/region code. Cannot verify expected region ${expected}.`,
    };
  }

  if (!hasProxyExitRegionMismatch(expected, detected)) {
    return status;
  }
  const sourceHint = entrySource === 'account_list'
    ? ' (source: account list)'
    : (entrySource === 'fixed_account' ? ' (source: fixed account)' : '');
  const usernameRegion = inferRegionFromProxyUsername(status?.username || '');
  const usernameHint = usernameRegion
    ? (
      hasProxyExitRegionMismatch(expected, usernameRegion)
        ? ` Current account username region marker is ${usernameRegion}, inconsistent with expected.`
        : ` Current account username region marker is ${usernameRegion}.`
    )
    : '';
  const missingAuthChallengeHint = Boolean(status?.hasAuth)
    && parsedAuthSummary
    && parsedAuthSummary.challenge <= 0
    && parsedAuthSummary.provided <= 0
    ? ' Current link did not trigger proxy auth challenge (407). May be reusing historical proxy connection/auth cache, or proxy did not return standard 407 causing account params not filled back by browser (may use anonymous link). Try toggling proxy off and on, or switch to next node and retry.'
    : '';
  const authHint = authSummary ? ` Diagnostics: probe:${authSummary}` : '';
  const mismatchMessage = `Proxy exit region inconsistent with expectation: expected ${expected}, actual ${detected || 'unknown'}${sourceHint}.${usernameHint}${missingAuthChallengeHint}${authHint}`.trim();
  if (normalizedProvider === '711proxy') {
    const warningPrefix = missingAuthChallenge
      ? 'Region check failed and no proxy auth challenge triggered, suspected anonymous link; keeping proxy takeover with strong warning: '
      : 'Region check failed, but proxy takeover preserved: ';
    return {
      ...status,
      applied: true,
      reason: 'applied_with_warning',
      warning: `${warningPrefix}${mismatchMessage}`,
      error: '',
    };
  }
  return {
    ...status,
    applied: false,
    reason: 'connectivity_failed',
    error: mismatchMessage,
  };
}

function applyExitBaselineExpectation(status = {}) {
  const exitIp = String(status?.exitIp || '').trim();
  const baselineIp = String(status?.exitBaselineIp || '').trim();
  const exitSource = String(status?.exitSource || '').trim().toLowerCase();
  if (exitIp && exitSource.includes('background') && !baselineIp) {
    return {
      ...status,
      applied: false,
      reason: 'connectivity_failed',
      error: `Detected exit IP ${exitIp}, but system baseline network probe failed. Cannot confirm whether traffic went through plugin proxy link.`,
    };
  }
  if (!exitIp || !baselineIp) {
    return status;
  }
  if (exitIp !== baselineIp) {
    return status;
  }
  return {
    ...status,
    applied: false,
    reason: 'connectivity_failed',
    error: `Detected exit IP ${exitIp} matches system baseline network — suspect not going through plugin proxy link.`,
  };
}

function shouldVerifyIpProxyTargetReachability(status = {}) {
  if (!String(status?.exitIp || '').trim()) {
    return false;
  }
  if (status?.applied === false && String(status?.reason || '').trim().toLowerCase() === 'connectivity_failed') {
    return false;
  }
  return true;
}

function buildTargetReachabilityFailureMessage(status = {}, reachability = {}) {
  const exitIp = String(status?.exitIp || '').trim();
  const exitRegion = String(status?.exitRegion || '').trim();
  const endpoint = String(reachability?.endpoint || reachability?.url || IP_PROXY_TARGET_REACHABILITY_ENDPOINTS[0] || '').trim();
  const targetHost = extractProbeHostFromTabUrl(endpoint) || endpoint || 'chatgpt.com';
  const diagnostic = String(reachability?.error || reachability?.diagnostics || '').trim();
  const diagnosticSuffix = diagnostic ? ` Diagnostics: ${diagnostic}` : '';
  const exitRegionSuffix = exitRegion ? ` [${exitRegion}]` : '';
  return `Detected exit IP ${exitIp}${exitRegionSuffix}, but real target ${targetHost} unreachable.`
    + ` This means proxy only passed IP probe — cannot open Step 1 ChatGPT page. Please switch to a node supporting chatgpt.com CONNECT/TLS.`
    + diagnosticSuffix;
}

function applyTargetReachabilityExpectation(status = {}, reachability = {}) {
  if (!shouldVerifyIpProxyTargetReachability(status)) {
    return status;
  }
  if (reachability?.reachable === true) {
    return status;
  }
  if (reachability?.skipped === true) {
    return status;
  }
  return {
    ...status,
    applied: false,
    reason: 'connectivity_failed',
    warning: '',
    error: buildTargetReachabilityFailureMessage(status, reachability),
  };
}

async function detectProxyExitInfoByBackgroundFetch(options = {}) {
  const timeoutMs = Number(options?.timeoutMs) > 0 ? Number(options.timeoutMs) : 10000;
  const errors = Array.isArray(options?.errors) ? options.errors : [];
  const configuredEndpoints = Array.isArray(options?.probeEndpoints)
    ? options.probeEndpoints.map((item) => String(item || '').trim()).filter(Boolean)
    : [];
  const availableEndpoints = configuredEndpoints.length
    ? configuredEndpoints
    : IP_PROXY_EXIT_PROBE_ENDPOINTS;
  const requestedPerEndpointTimeoutMs = Number(options?.backgroundPerEndpointTimeoutMs);
  const perRequestTimeoutMs = Math.max(
    1200,
    Math.min(
      Number.isFinite(requestedPerEndpointTimeoutMs) && requestedPerEndpointTimeoutMs > 0
        ? requestedPerEndpointTimeoutMs
        : IP_PROXY_BACKGROUND_PROBE_PER_ENDPOINT_TIMEOUT_MS,
      timeoutMs
    )
  );
  const maxEndpoints = Math.max(
    1,
    Math.min(
      availableEndpoints.length,
      Number.isFinite(Number(options?.backgroundMaxEndpoints))
        ? Number(options.backgroundMaxEndpoints)
        : IP_PROXY_BACKGROUND_PROBE_MAX_ENDPOINTS
    )
  );
  const probeEndpoints = availableEndpoints.slice(0, maxEndpoints);
  let baselineIp = '';
  try {
    const baselineUrl = `${IP_PROXY_PAGE_CONTEXT_BASELINE_URL}?_multipage_proxy_baseline=${Date.now()}`;
    const baselineResponse = await fetchWithTimeout(baselineUrl, {
      method: 'GET',
      cache: 'no-store',
      headers: { Accept: 'application/json, text/plain, */*' },
    }, perRequestTimeoutMs);
    if (!baselineResponse.ok) {
      errors.push(`probe:bg:baseline:status:${baselineResponse.status}`);
    } else {
      const baselineText = await baselineResponse.text();
      const parsedBaseline = parseProxyExitProbePayload(
        baselineText,
        baselineResponse.headers.get('content-type')
      );
      baselineIp = String(parsedBaseline?.ip || '').trim();
      if (!baselineIp) {
        errors.push('probe:bg:baseline:empty_parse');
      }
    }
  } catch (baselineError) {
    errors.push(`probe:bg:baseline:${baselineError?.message || baselineError}`);
  }
  const runProbePass = async (endpoints, requestTimeoutMs, diagnosticPrefix = 'probe:bg') => {
    let bestEffortResult = null;
    let abortLikeCount = 0;
    for (const endpoint of endpoints) {
      try {
        const url = endpoint.includes('?') ? `${endpoint}&_t=${Date.now()}` : `${endpoint}?_t=${Date.now()}`;
        const response = await fetchWithTimeout(url, {
          method: 'GET',
          cache: 'no-store',
          headers: { Accept: 'application/json, text/plain, */*' },
        }, requestTimeoutMs);
        if (!response.ok) {
          errors.push(`${diagnosticPrefix}:${endpoint}:status:${response.status}`);
          continue;
        }
        const text = await response.text();
        const parsed = parseProxyExitProbePayload(text, response.headers.get('content-type'));
        if (parsed.ip) {
          const result = {
            ip: parsed.ip,
            region: parsed.region,
            source: 'background_fallback',
            endpoint,
            baselineIp,
          };
          if (parsed.region) {
            return {
              result,
              bestEffortResult: result,
              abortLikeCount,
            };
          }
          if (!bestEffortResult) {
            bestEffortResult = result;
          }
          errors.push(`${diagnosticPrefix}:${endpoint}:missing_region`);
          continue;
        }
        errors.push(`${diagnosticPrefix}:${endpoint}:empty_parse`);
      } catch (error) {
        const message = String(error?.message || error || '').trim();
        if (/signal is aborted without reason|abort/i.test(message)) {
          abortLikeCount += 1;
        }
        errors.push(`${diagnosticPrefix}:${endpoint}:${message}`);
      }
    }
    return {
      result: bestEffortResult,
      bestEffortResult,
      abortLikeCount,
    };
  };

  const firstPass = await runProbePass(probeEndpoints, perRequestTimeoutMs, 'probe:bg');
  if (firstPass?.result?.ip && firstPass?.result?.region) {
    return firstPass.result;
  }

  if (!firstPass?.result?.ip
    && firstPass?.abortLikeCount >= Math.min(2, probeEndpoints.length)
    && options?.backgroundSlowRetry !== false) {
    const retryTimeoutMs = Math.max(perRequestTimeoutMs + 2500, 7000);
    const retryEndpoints = probeEndpoints.slice(0, Math.min(2, probeEndpoints.length));
    errors.push(`probe:bg:slow_retry:${retryTimeoutMs}ms`);
    const retryPass = await runProbePass(retryEndpoints, retryTimeoutMs, 'probe:bg:retry');
    if (retryPass?.result?.ip) {
      return retryPass.result;
    }
  }

  if (!firstPass?.bestEffortResult?.ip) {
    appendIpProxyRuntimeErrorDiagnosticsToErrors(errors, 45000);
  }

  return firstPass?.bestEffortResult || { ip: '', region: '', source: 'background_fallback', baselineIp };
}

function isPageContextProbeHost(hostname = '') {
  const normalized = String(hostname || '').trim().toLowerCase();
  return normalized === 'chatgpt.com'
    || normalized.endsWith('.chatgpt.com')
    || normalized === 'openai.com'
    || normalized.endsWith('.openai.com')
    || normalized === 'example.com'
    || normalized.endsWith('.example.com')
    || normalized === 'ip-api.com'
    || normalized.endsWith('.ip-api.com')
    || normalized === 'httpbin.org'
    || normalized === 'ipwho.is'
    || normalized.endsWith('.ipwho.is')
    || normalized === 'ipinfo.io'
    || normalized.endsWith('.ipinfo.io')
    || normalized === 'ipapi.co'
    || normalized.endsWith('.ipapi.co');
}

function isProbeErrorPageExecutionError(error) {
  const message = String(error?.message || error || '');
  return /Frame with ID 0 is showing error page|Cannot access contents of the page/i.test(message);
}

function hasProbeErrorPageDiagnostics(errors = []) {
  if (!Array.isArray(errors) || !errors.length) {
    return false;
  }
  return errors.some((item) => isProbeErrorPageExecutionError(String(item || '')));
}

function createProbeNavigationErrorTracker(initialTabId = null) {
  if (!chrome.webNavigation?.onErrorOccurred?.addListener) {
    return {
      setTabId: () => {},
      appendDiagnostics: () => {},
      dispose: () => {},
    };
  }

  let activeTabId = Number.isInteger(initialTabId) ? Number(initialTabId) : null;
  const entries = [];
  const listener = (details = {}) => {
    if (!Number.isInteger(activeTabId) || Number(details?.tabId) !== activeTabId) {
      return;
    }
    if (Number(details?.frameId) !== 0) {
      return;
    }
    const errorCode = String(details?.error || '').trim();
    if (!errorCode) {
      return;
    }
    const url = String(details?.url || '').trim();
    entries.push({
      error: errorCode,
      host: extractProbeHostFromTabUrl(url),
      url,
    });
  };

  try {
    chrome.webNavigation.onErrorOccurred.addListener(listener);
  } catch {
    return {
      setTabId: () => {},
      appendDiagnostics: () => {},
      dispose: () => {},
    };
  }

  return {
    setTabId(nextTabId) {
      activeTabId = Number.isInteger(nextTabId) ? Number(nextTabId) : null;
    },
    appendDiagnostics(errors, maxItems = 2) {
      if (!Array.isArray(errors) || !entries.length) {
        return;
      }
      const limit = Math.max(1, Number(maxItems) || 2);
      const recent = entries.slice(-limit);
      for (const item of recent) {
        const errorCode = String(item?.error || '').trim();
        if (!errorCode) {
          continue;
        }
        const host = String(item?.host || '').trim() || 'unknown';
        errors.push(`probe:page_context:navigation_error:${errorCode}@${host}`);
      }
    },
    dispose() {
      try {
        chrome.webNavigation.onErrorOccurred.removeListener(listener);
      } catch {
        // ignore remove listener failures
      }
    },
  };
}

function extractProbeHostFromTabUrl(rawUrl = '') {
  try {
    const parsed = new URL(rawUrl);
    if (!['http:', 'https:'].includes(parsed.protocol)) {
      return '';
    }
    return parsed.hostname || '';
  } catch {
    return '';
  }
}

async function pickExistingPageContextProbeTabId(options = {}) {
  const tabs = await queryAutomationScopedTabs({}, options);
  const candidates = tabs
    .filter((tab) => Number.isInteger(tab?.id))
    .filter((tab) => isPageContextProbeHost(extractProbeHostFromTabUrl(tab?.url || '')));
  if (!candidates.length) {
    return null;
  }
  const preferred = candidates.find((tab) => String(tab?.status || '').toLowerCase() === 'complete');
  return Number((preferred || candidates[0]).id) || null;
}

async function waitForPageContextProbeTabReady(tabId, timeoutMs = 15000) {
  const timeout = Math.max(1500, Number(timeoutMs) || 15000);

  if (typeof waitForTabComplete === 'function') {
    const result = await waitForTabComplete(tabId, {
      timeoutMs: timeout,
      retryDelayMs: 300,
    });
    return Boolean(result?.id);
  }

  const start = Date.now();
  while (Date.now() - start < timeout) {
    try {
      const tab = await chrome.tabs.get(tabId);
      if (String(tab?.status || '').toLowerCase() === 'complete') {
        return true;
      }
    } catch {
      return false;
    }
    await new Promise((resolve) => setTimeout(resolve, 250));
  }

  return false;
}

async function readExitProbeFromTabDocument(tabId) {
  const executionResults = await chrome.scripting.executeScript({
    target: { tabId },
    world: 'ISOLATED',
    func: () => {
      const preText = String(document.querySelector('pre')?.textContent || '').trim();
      const bodyText = String(document.body?.innerText || document.documentElement?.innerText || '').trim();
      return {
        url: String(location.href || ''),
        text: preText || bodyText,
      };
    },
  });
  return executionResults?.[0]?.result || null;
}

function appendProbeCacheBuster(rawUrl = '', key = '_multipage_proxy_probe') {
  const text = String(rawUrl || '').trim();
  if (!text) {
    return '';
  }
  try {
    const parsed = new URL(text);
    parsed.searchParams.set(key, String(Date.now()));
    return parsed.toString();
  } catch {
    const separator = text.includes('?') ? '&' : '?';
    return `${text}${separator}${key}=${Date.now()}`;
  }
}

async function readTargetReachabilityFromTabDocument(tabId) {
  const executionResults = await chrome.scripting.executeScript({
    target: { tabId },
    world: 'ISOLATED',
    func: () => ({
      href: String(location.href || ''),
      title: String(document.title || ''),
      readyState: String(document.readyState || ''),
      bodyLength: Number(document.body?.innerText?.length || document.documentElement?.innerText?.length || 0),
    }),
  });
  return executionResults?.[0]?.result || null;
}

async function probeExitInfoByTabNavigation(tabId, timeoutMs = 10000, errors = []) {
  return probeExitInfoByTabNavigationWithEndpoints(tabId, timeoutMs, errors, []);
}

async function probeExitInfoByTabNavigationWithEndpoints(tabId, timeoutMs = 10000, errors = [], endpointsOverride = []) {
  if (!Number.isInteger(tabId)) {
    return null;
  }
  const configuredEndpoints = Array.isArray(endpointsOverride)
    ? endpointsOverride.map((item) => String(item || '').trim()).filter(Boolean)
    : [];
  const availableEndpoints = configuredEndpoints.length
    ? configuredEndpoints
    : IP_PROXY_EXIT_PROBE_ENDPOINTS;
  const endpoints = availableEndpoints.slice(0, 6);
  const perEndpointTimeoutMs = Math.max(
    2000,
    Math.min(IP_PROXY_PAGE_CONTEXT_READY_TIMEOUT_MS, Number(timeoutMs) || 10000)
  );
  let bestEffortResult = null;

  for (const endpoint of endpoints) {
    const endpointText = String(endpoint || '').trim();
    if (!endpointText) {
      continue;
    }
    const probeTargetUrl = endpointText.includes('?')
      ? `${endpointText}&_multipage_proxy_probe=${Date.now()}`
      : `${endpointText}?_multipage_proxy_probe=${Date.now()}`;
    try {
      await chrome.tabs.update(tabId, {
        url: probeTargetUrl,
        active: false,
      });
      const ready = await waitForPageContextProbeTabReady(tabId, perEndpointTimeoutMs);
      if (!ready) {
        if (Array.isArray(errors)) {
          errors.push(`probe:page_context:navigation:${endpointText}:not_ready`);
        }
        continue;
      }
      const documentResult = await readExitProbeFromTabDocument(tabId);
      const parsed = parseProxyExitProbePayload(String(documentResult?.text || ''), 'application/json');
      if (parsed?.ip) {
        const result = {
          ip: String(parsed.ip || '').trim(),
          region: String(parsed.region || '').trim(),
          endpoint: String(documentResult?.url || probeTargetUrl || endpointText).trim(),
          source: 'page_context_navigation',
        };
        if (result.region) {
          return result;
        }
        if (!bestEffortResult) {
          bestEffortResult = result;
        }
        if (Array.isArray(errors)) {
          errors.push(`probe:page_context:navigation:${endpointText}:missing_region`);
        }
        continue;
      }
      if (Array.isArray(errors)) {
        errors.push(`probe:page_context:navigation:${endpointText}:empty_parse`);
      }
    } catch (error) {
      if (Array.isArray(errors)) {
        errors.push(`probe:page_context:navigation:${endpointText}:${error?.message || error}`);
      }
    }
  }

  return bestEffortResult;
}

async function probeExitInfoViaExecuteScript(tabId, timeoutMs = 10000, endpointsOverride = []) {
  const perRequestTimeoutMs = Math.max(
    1200,
    Math.min(IP_PROXY_BACKGROUND_PROBE_PER_ENDPOINT_TIMEOUT_MS, Number(timeoutMs) || 10000)
  );
  const configuredEndpoints = Array.isArray(endpointsOverride)
    ? endpointsOverride.map((item) => String(item || '').trim()).filter(Boolean)
    : [];
  const availableEndpoints = configuredEndpoints.length
    ? configuredEndpoints
    : IP_PROXY_EXIT_PROBE_ENDPOINTS;
  const endpoints = availableEndpoints.slice(0, IP_PROXY_BACKGROUND_PROBE_MAX_ENDPOINTS);
  const executionResults = await chrome.scripting.executeScript({
    target: { tabId },
    world: 'ISOLATED',
    func: async (payload) => {
      const extractIpv4 = (value) => {
        const text = String(value || '').trim();
        if (!text) return '';
        const match = text.match(/\b(\d{1,3}(?:\.\d{1,3}){3})\b/);
        return match ? match[1] : '';
      };
      const normalizeRegionCode = (value) => {
        const code = String(value || '')
          .trim()
          .toUpperCase()
          .replace(/[^A-Z]/g, '');
        return /^[A-Z]{2}$/.test(code) ? code : '';
      };
      const pickRegion = (parsed) => {
        const codeCandidates = [
          parsed?.countryCode,
          parsed?.country_code,
          parsed?.countrycode,
          parsed?.countryAlpha2,
          parsed?.country_alpha2,
          parsed?.countryISO,
          parsed?.countryIso,
          parsed?.iso_country,
          parsed?.geo?.countryCode,
          parsed?.geo?.country_code,
          parsed?.location?.countryCode,
          parsed?.location?.country_code,
        ];
        for (const candidate of codeCandidates) {
          const code = normalizeRegionCode(candidate);
          if (code) return code;
        }
        const fallbackCandidates = [
          parsed?.regionCode,
          parsed?.region_code,
          parsed?.country,
          parsed?.country_name,
          parsed?.countryName,
          parsed?.regionName,
          parsed?.region,
          parsed?.city,
        ];
        for (const candidate of fallbackCandidates) {
          const text = String(candidate || '').trim();
          if (text) return text;
        }
        return '';
      };
      const parsePayload = (rawText, contentType) => {
        const text = String(rawText || '').trim();
        if (!text) {
          return { ip: '', region: '' };
        }

        const normalizedContentType = String(contentType || '').toLowerCase();
        if (normalizedContentType.includes('application/json') || text.startsWith('{') || text.startsWith('[')) {
          try {
            const parsed = JSON.parse(text);
            const ip = extractIpv4(
              parsed?.ip
              || parsed?.query
              || parsed?.origin
              || parsed?.address
              || parsed?.ipAddress
              || parsed?.ip_address
              || ''
            );
            const region = pickRegion(parsed);
            if (ip) {
              return { ip, region };
            }
          } catch {
            // fall through to regex parse
          }
        }

        const ipMatch = extractIpv4(text);
        return {
          ip: ipMatch || '',
          region: '',
        };
      };

      const fetchWithTimeout = async (url, timeoutValue) => {
        const controller = new AbortController();
        const timer = setTimeout(() => controller.abort(), Math.max(1000, Number(timeoutValue) || 10000));
        try {
          return await fetch(url, {
            method: 'GET',
            cache: 'no-store',
            credentials: 'omit',
            headers: {
              Accept: 'application/json, text/plain, */*',
            },
            signal: controller.signal,
          });
        } finally {
          clearTimeout(timer);
        }
      };

      const endpoints = Array.isArray(payload?.endpoints) ? payload.endpoints : [];
      const normalizedEndpoints = [];
      const endpointSet = new Set();
      for (const endpoint of endpoints) {
        const text = String(endpoint || '').trim();
        if (!text || !/^https?:\/\//i.test(text) || endpointSet.has(text)) {
          continue;
        }
        endpointSet.add(text);
        normalizedEndpoints.push(text);
      }
      const timeoutValue = Math.max(1000, Number(payload?.timeoutMs) || 10000);
      const diagnostics = [];
      let bestEffortResult = null;

      for (const endpoint of normalizedEndpoints.slice(0, 8)) {
        try {
          const url = endpoint.includes('?') ? `${endpoint}&_t=${Date.now()}` : `${endpoint}?_t=${Date.now()}`;
          const response = await fetchWithTimeout(url, timeoutValue);
          if (!response.ok) {
            diagnostics.push(`${endpoint}:status:${response.status}`);
            continue;
          }
          const text = await response.text();
          const parsed = parsePayload(text, response.headers.get('content-type'));
          if (parsed.ip) {
            const result = {
              ip: parsed.ip,
              region: parsed.region,
              endpoint,
              diagnostics,
            };
            if (parsed.region) {
              return result;
            }
            if (!bestEffortResult) {
              bestEffortResult = result;
            }
            diagnostics.push(`${endpoint}:missing_region`);
            continue;
          }
          diagnostics.push(`${endpoint}:empty_parse`);
        } catch (error) {
          diagnostics.push(`${endpoint}:${error?.message || error}`);
        }
      }

      return bestEffortResult || {
        ip: '',
        region: '',
        endpoint: '',
        diagnostics,
      };
    },
    args: [{
      endpoints,
      timeoutMs: perRequestTimeoutMs,
    }],
  });

  return executionResults?.[0]?.result || null;
}

async function detectIpProxyTargetReachabilityByPageContext(options = {}) {
  const timeoutMs = Number(options?.timeoutMs) > 0
    ? Number(options.timeoutMs)
    : IP_PROXY_TARGET_REACHABILITY_TIMEOUT_MS;
  const errors = Array.isArray(options?.errors) ? options.errors : [];
  const endpoints = resolveTargetReachabilityEndpoints(options);
  if (!endpoints.length) {
    return { reachable: true, skipped: true, source: 'target_page_context', endpoint: '' };
  }
  if (!chrome.tabs?.create || !chrome.tabs?.update || !chrome.scripting?.executeScript) {
    errors.push('target:page_context:unavailable');
    return {
      reachable: false,
      endpoint: endpoints[0],
      source: 'target_page_context_unavailable',
      error: 'target:page_context:unavailable',
    };
  }

  let tabId = null;
  let createdTabId = null;
  const navigationErrorTracker = createProbeNavigationErrorTracker(null);
  const perEndpointTimeoutMs = Math.max(2500, Math.min(IP_PROXY_TARGET_REACHABILITY_TIMEOUT_MS, timeoutMs));

  try {
    for (let index = 0; index < endpoints.length; index += 1) {
      const endpoint = String(endpoints[index] || '').trim();
      if (!endpoint) {
        continue;
      }
      const targetUrl = appendProbeCacheBuster(endpoint, '_multipage_proxy_target');
      try {
        if (!Number.isInteger(tabId)) {
          const tab = await createAutomationScopedTab({
            url: targetUrl,
            active: false,
          }, options);
          tabId = Number(tab?.id) || null;
          createdTabId = tabId;
          navigationErrorTracker.setTabId(tabId);
        } else {
          await chrome.tabs.update(tabId, {
            url: targetUrl,
            active: false,
          });
        }

        if (!Number.isInteger(tabId)) {
          errors.push(`target:page_context:${endpoint}:no_tab`);
          continue;
        }

        const ready = await waitForPageContextProbeTabReady(tabId, perEndpointTimeoutMs);
        if (!ready) {
          errors.push(`target:page_context:${endpoint}:not_ready`);
          continue;
        }

        const documentResult = await readTargetReachabilityFromTabDocument(tabId);
        const href = String(documentResult?.href || '').trim();
        const host = extractProbeHostFromTabUrl(href);
        const expectedHost = extractProbeHostFromTabUrl(endpoint);
        if (host && expectedHost && (host === expectedHost || host.endsWith(`.${expectedHost}`))) {
          return {
            reachable: true,
            endpoint,
            url: href,
            source: 'target_page_context',
          };
        }
        errors.push(`target:page_context:${endpoint}:unexpected_url:${href || 'unknown'}`);
      } catch (error) {
        errors.push(`target:page_context:${endpoint}:${error?.message || error}`);
      }
    }
  } finally {
    navigationErrorTracker.appendDiagnostics(errors, 3);
    navigationErrorTracker.dispose();
    if (Number.isInteger(createdTabId)) {
      try {
        await chrome.tabs.remove(createdTabId);
      } catch {
        // ignore tab close failures
      }
    }
  }

  return {
    reachable: false,
    endpoint: endpoints[0],
    source: 'target_page_context',
    error: buildProbeDiagnosticsSummary(errors, IP_PROXY_DIAGNOSTICS_SUMMARY_MAX_ITEMS),
  };
}

async function detectProxyExitInfoByPageContext(options = {}) {
  const timeoutMs = Number(options?.timeoutMs) > 0 ? Number(options.timeoutMs) : 10000;
  const errors = Array.isArray(options?.errors) ? options.errors : [];
  const probeEndpoints = Array.isArray(options?.probeEndpoints)
    ? options.probeEndpoints.map((item) => String(item || '').trim()).filter(Boolean)
    : [];
  let sawProbeErrorPage = false;

  if (!chrome.scripting?.executeScript) {
    errors.push('probe:page_context:scripting_unavailable');
    return { ip: '', region: '', source: 'page_context_unavailable' };
  }

  let probeTabId = null;
  let createdProbeTabId = null;
  const probeUrl = `${IP_PROXY_PAGE_CONTEXT_PROBE_URL}?_multipage_proxy_probe=${Date.now()}`;
  try {
    const tab = await createAutomationScopedTab({
      url: probeUrl,
      active: false,
    }, options);
    probeTabId = Number(tab?.id) || null;
    createdProbeTabId = probeTabId;
  } catch (error) {
    errors.push(`probe:page_context:create_probe_tab_failed:${error?.message || error}`);
    probeTabId = await pickExistingPageContextProbeTabId(options);
  }

  if (!Number.isInteger(probeTabId)) {
    errors.push('probe:page_context:no_probe_tab');
    return { ip: '', region: '', source: 'page_context_unavailable' };
  }

  const navigationErrorTracker = createProbeNavigationErrorTracker(probeTabId);
  let hasSuccessfulIp = false;

  try {
    const ready = await waitForPageContextProbeTabReady(
      probeTabId,
      Math.max(2500, Math.min(IP_PROXY_PAGE_CONTEXT_READY_TIMEOUT_MS, timeoutMs + 2500))
    );
    if (!ready) {
      errors.push('probe:page_context:probe_tab_not_ready');
      return { ip: '', region: '', source: 'page_context_unavailable' };
    }

    let ip = '';
    let region = '';
    let endpoint = '';
    let canUseDocumentProbe = false;
    try {
      const probeTab = await chrome.tabs.get(probeTabId);
      const probeHost = extractProbeHostFromTabUrl(probeTab?.url || '');
      const expectedHost = extractProbeHostFromTabUrl(probeUrl);
      canUseDocumentProbe = Boolean(probeHost && expectedHost && probeHost === expectedHost);
    } catch {
      canUseDocumentProbe = false;
    }

    if (canUseDocumentProbe) {
      try {
        const documentResult = await readExitProbeFromTabDocument(probeTabId);
        const parsedDocument = parseProxyExitProbePayload(String(documentResult?.text || ''), 'application/json');
        ip = String(parsedDocument?.ip || '').trim();
        region = String(parsedDocument?.region || '').trim();
        endpoint = String(documentResult?.url || '').trim();
        if (ip) {
          let baselineIp = '';
          try {
            const baselineUrl = `${IP_PROXY_PAGE_CONTEXT_BASELINE_URL}?_multipage_proxy_baseline=${Date.now()}`;
            await chrome.tabs.update(probeTabId, {
              url: baselineUrl,
              active: false,
            });
            const baselineReady = await waitForPageContextProbeTabReady(
              probeTabId,
              Math.max(2000, Math.min(IP_PROXY_PAGE_CONTEXT_BASELINE_TIMEOUT_MS, timeoutMs + 1500))
            );
            if (baselineReady) {
              const baselineResult = await readExitProbeFromTabDocument(probeTabId);
              const parsedBaseline = parseProxyExitProbePayload(String(baselineResult?.text || ''), 'application/json');
              baselineIp = String(parsedBaseline?.ip || '').trim();
              if (!baselineIp) {
                errors.push('probe:page_context:baseline_empty_parse');
              }
            } else {
              errors.push('probe:page_context:baseline_not_ready');
            }
          } catch (baselineError) {
            errors.push(`probe:page_context:baseline_failed:${baselineError?.message || baselineError}`);
          }
          hasSuccessfulIp = true;
          return {
            ip,
            region,
            source: 'page_context',
            endpoint: endpoint || probeUrl,
            baselineIp,
          };
        }
        errors.push('probe:page_context:document_empty_parse');
      } catch (documentError) {
        if (isProbeErrorPageExecutionError(documentError)) {
          sawProbeErrorPage = true;
        }
        errors.push(`probe:page_context:document_failed:${documentError?.message || documentError}`);
      }
    } else {
      errors.push('probe:page_context:document_probe_skipped');
    }

    const navigationProbeResult = await probeExitInfoByTabNavigationWithEndpoints(
      probeTabId,
      timeoutMs,
      errors,
      probeEndpoints
    );
    if (navigationProbeResult?.ip) {
      hasSuccessfulIp = true;
      return {
        ip: String(navigationProbeResult.ip || '').trim(),
        region: String(navigationProbeResult.region || '').trim(),
        source: 'page_context',
        endpoint: String(navigationProbeResult.endpoint || '').trim(),
      };
    }

    let scriptResult = null;
    try {
      scriptResult = await probeExitInfoViaExecuteScript(probeTabId, timeoutMs, probeEndpoints);
    } catch (scriptError) {
      if (isProbeErrorPageExecutionError(scriptError)) {
        sawProbeErrorPage = true;
      }
      errors.push(`probe:page_context:script_failed:${scriptError?.message || scriptError}`);
      if (!createdProbeTabId && isProbeErrorPageExecutionError(scriptError)) {
        const retryUrl = `${IP_PROXY_PAGE_CONTEXT_PROBE_URL}?_multipage_proxy_probe=${Date.now()}&retry=1`;
        const retryTab = await createAutomationScopedTab({
          url: retryUrl,
          active: false,
        }, options);
        const retryTabId = Number(retryTab?.id) || 0;
        if (retryTabId > 0) {
          createdProbeTabId = retryTabId;
          navigationErrorTracker.setTabId(retryTabId);
          const retryReady = await waitForPageContextProbeTabReady(
            retryTabId,
            Math.max(2500, Math.min(IP_PROXY_PAGE_CONTEXT_READY_TIMEOUT_MS, timeoutMs + 2500))
          );
          if (retryReady) {
            scriptResult = await probeExitInfoViaExecuteScript(retryTabId, timeoutMs, probeEndpoints);
          }
        }
      } else {
        throw scriptError;
      }
    }

    if (!scriptResult) {
      return {
        ip: '',
        region: '',
        source: sawProbeErrorPage ? 'page_context_error_page' : 'page_context_unavailable',
      };
    }
    ip = String(scriptResult?.ip || '').trim();
    region = String(scriptResult?.region || '').trim();
    if (ip) {
      hasSuccessfulIp = true;
      return {
        ip,
        region,
        source: 'page_context',
        endpoint: String(scriptResult?.endpoint || '').trim(),
      };
    }
    if (Array.isArray(scriptResult?.diagnostics) && scriptResult.diagnostics.length) {
      for (const item of scriptResult.diagnostics.slice(0, 4)) {
        errors.push(`probe:page_context:script:${String(item)}`);
      }
    } else {
      errors.push('probe:page_context:script_empty');
    }
  } catch (error) {
    const message = String(error?.message || error || '');
    if (isProbeErrorPageExecutionError(error)) {
      sawProbeErrorPage = true;
    }
    if (!/probe:page_context:script_failed/i.test(message)) {
      errors.push(`probe:page_context:script_failed:${message}`);
    }
  } finally {
    if (!hasSuccessfulIp) {
      navigationErrorTracker.appendDiagnostics(errors, 2);
    }
    navigationErrorTracker.dispose();
    if (Number.isInteger(createdProbeTabId)) {
      try {
        await chrome.tabs.remove(createdProbeTabId);
      } catch {
        // ignore tab close failures
      }
    }
  }

  return {
    ip: '',
    region: '',
    source: sawProbeErrorPage ? 'page_context_error_page' : 'page_context_unavailable',
  };
}

async function detectProxyExitInfo(options = {}) {
  const timeoutMs = Number(options?.timeoutMs) > 0 ? Number(options.timeoutMs) : 10000;
  const errors = Array.isArray(options?.errors) ? options.errors : [];
  const preferPageContext = options?.preferPageContext !== false;
  const allowBackgroundFallback = options?.allowBackgroundFallback === true;
  const allowPageContextFallbackOnBackgroundAbort = options?.allowPageContextFallbackOnBackgroundAbort !== false;
  const probeEndpoints = resolveExitProbeEndpoints({
    provider: options?.provider || '',
    username: options?.username || '',
  });

  if (preferPageContext) {
    const pageResult = await detectProxyExitInfoByPageContext({
      timeoutMs,
      errors,
      probeEndpoints,
      automationWindowId: options?.automationWindowId,
      windowId: options?.windowId,
      state: options?.state,
    });
    if (pageResult?.ip) {
      return pageResult;
    }
    const shouldFallbackToBackground = allowBackgroundFallback
      || String(pageResult?.source || '').trim().toLowerCase() === 'page_context_error_page'
      || hasProbeErrorPageDiagnostics(errors);
    if (!shouldFallbackToBackground) {
      return {
        ip: '',
        region: '',
        source: String(pageResult?.source || 'page_context_unavailable'),
      };
    }
    if (!allowBackgroundFallback) {
      errors.push('probe:page_context:error_page_auto_fallback');
    }
  }

  const backgroundResult = await detectProxyExitInfoByBackgroundFetch({
    timeoutMs,
    errors,
    probeEndpoints,
  });
  if (!preferPageContext
    && allowPageContextFallbackOnBackgroundAbort
    && !backgroundResult?.ip
    && Array.isArray(errors)
    && errors.some((item) => /probe:bg:.*signal is aborted without reason/i.test(String(item || '')))) {
    errors.push('probe:bg:abort_storm_page_fallback');
    const pageResult = await detectProxyExitInfoByPageContext({
      timeoutMs: Math.max(5000, Math.min(9000, timeoutMs)),
      errors,
      probeEndpoints,
      automationWindowId: options?.automationWindowId,
      windowId: options?.windowId,
      state: options?.state,
    });
    errors.push(`probe:bg:abort_storm_page_fallback_result:${String(pageResult?.source || 'unknown')}`);
    if (pageResult?.ip) {
      return pageResult;
    }
  }
  return backgroundResult;
}

async function pullIpProxyPoolFromApi(state = {}, options = {}) {
  const apiUrl = String(state?.ipProxyApiUrl || '').trim();
  if (!apiUrl) {
    throw new Error('Proxy API cannot be empty.');
  }
  let parsedUrl;
  try {
    parsedUrl = new URL(apiUrl);
  } catch {
    throw new Error('Proxy API is not a valid URL.');
  }
  if (!['http:', 'https:'].includes(parsedUrl.protocol)) {
    throw new Error('Proxy API only supports http/https.');
  }

  const provider = normalizeIpProxyProviderValue(state?.ipProxyService);
  const timeoutMs = Number(options?.timeoutMs) > 0 ? Number(options.timeoutMs) : IP_PROXY_FETCH_TIMEOUT_MS;
  const response = await fetchWithTimeout(apiUrl, {
    method: 'GET',
    cache: 'no-store',
    headers: { Accept: 'application/json, text/plain, */*' },
  }, timeoutMs);
  if (!response.ok) {
    throw new Error(`Proxy API request failed (HTTP ${response.status}).`);
  }

  const rawText = await response.text();
  let payload = rawText;
  try {
    payload = JSON.parse(rawText);
  } catch {
    payload = rawText;
  }
  const pool = normalizeIpProxyListFromPayload(payload, provider);
  if (!pool.length && typeof payload === 'string') {
    return normalizeProxyPoolEntries(payload, provider).slice(0, Number(options.maxItems) || 100);
  }
  const maxItems = Math.max(1, Math.min(500, Number(options.maxItems) || 100));
  return pool.slice(0, maxItems);
}

function installIpProxyAuthListener() {
  if (ipProxyAuthListenerInstalled) {
    return;
  }
  if (!chrome.webRequest?.onAuthRequired?.addListener) {
    return;
  }

  chrome.webRequest.onAuthRequired.addListener(
    (details, callback) => {
      try {
        const auth = currentIpProxyAuthEntry;
        if (!auth?.username) {
          recordIpProxyAuthChallenge(details, false);
          callback();
          return;
        }
        const isProxyChallenge = details?.isProxy === true;
        const challengerHost = String(details?.challenger?.host || '').trim().toLowerCase();
        const challengerPort = Number.parseInt(String(details?.challenger?.port || ''), 10) || 0;
        const authHost = String(auth?.host || '').trim().toLowerCase();
        const authPort = Number.parseInt(String(auth?.port || ''), 10) || 0;
        const challengerMatched = Boolean(
          challengerHost
          && authHost
          && challengerHost === authHost
          && (!authPort || !challengerPort || authPort === challengerPort)
        );
        const proxyAuthStatus = Number.parseInt(String(details?.statusCode || ''), 10) === 407;
        const shouldProvide = isProxyChallenge || challengerMatched || proxyAuthStatus;
        recordIpProxyAuthChallenge(details, shouldProvide);
        if (!shouldProvide) {
          callback();
          return;
        }
        callback({
          authCredentials: {
            username: auth.username,
            password: String(auth.password || ''),
          },
        });
      } catch {
        recordIpProxyAuthChallenge(details, false);
        callback();
      }
    },
    { urls: ['<all_urls>'] },
    ['asyncBlocking']
  );
  ipProxyAuthListenerInstalled = true;
}

function installIpProxyErrorListener() {
  if (ipProxyErrorListenerInstalled) {
    return;
  }
  if (!chrome.proxy?.onProxyError?.addListener) {
    return;
  }

  chrome.proxy.onProxyError.addListener((details = {}) => {
    ipProxyLastRuntimeError = {
      error: String(details?.error || '').trim(),
      details: String(details?.details || '').trim(),
      fatal: Boolean(details?.fatal),
      at: Date.now(),
    };
  });

  ipProxyErrorListenerInstalled = true;
}

function callChromeProxySettings(method, details) {
  const proxySettings = chrome.proxy?.settings;
  if (!proxySettings || typeof proxySettings[method] !== 'function') {
    return Promise.reject(new Error('Current browser does not support extension proxy API'));
  }
  return new Promise((resolve, reject) => {
    proxySettings[method](details, () => {
      const lastError = chrome.runtime?.lastError;
      if (lastError) {
        reject(new Error(lastError.message || String(lastError)));
        return;
      }
      resolve(true);
    });
  });
}

function getChromeProxySettings(details = { incognito: false }) {
  const proxySettings = chrome.proxy?.settings;
  if (!proxySettings || typeof proxySettings.get !== 'function') {
    return Promise.reject(new Error('Current browser does not support extension proxy API'));
  }
  return new Promise((resolve, reject) => {
    proxySettings.get(details, (value) => {
      const lastError = chrome.runtime?.lastError;
      if (lastError) {
        reject(new Error(lastError.message || String(lastError)));
        return;
      }
      resolve(value || {});
    });
  });
}

function validateProxyControlAfterApply(details, entry) {
  const level = String(details?.levelOfControl || '').trim();
  if (level && level !== 'controlled_by_this_extension') {
    return {
      ok: false,
      message: `Proxy control not held by current extension (levelOfControl=${level || 'unknown'})`,
    };
  }

  const mode = String(details?.value?.mode || '').trim().toLowerCase();
  if (mode !== 'pac_script') {
    return {
      ok: false,
      message: `Proxy mode is not pac_script (current: ${mode || 'unknown'})`,
    };
  }

  const pacData = String(details?.value?.pacScript?.data || '');
  const endpoint = `${entry.host}:${entry.port}`;
  if (pacData && !pacData.includes(endpoint)) {
    return {
      ok: false,
      message: `PAC does not contain current proxy node ${endpoint}, suspected override by other proxy configuration`,
    };
  }

  return {
    ok: true,
    message: '',
  };
}

function buildIpProxyPacScript(entry) {
  const normalizedProtocol = normalizeIpProxyProtocol(entry?.protocol || DEFAULT_IP_PROXY_PROTOCOL);
  const host = String(entry?.host || '').trim();
  const port = normalizeIpProxyPort(entry?.port);
  if (!host || !port) {
    return '';
  }
  let pacScheme = 'PROXY';
  if (normalizedProtocol === 'https') {
    pacScheme = 'HTTPS';
  } else if (normalizedProtocol === 'socks4') {
    pacScheme = 'SOCKS4';
  } else if (normalizedProtocol === 'socks5') {
    pacScheme = 'SOCKS5';
  }
  const targetPatterns = IP_PROXY_TARGET_HOST_PATTERNS.map((pattern) => `'${String(pattern).replace(/'/g, "\\'")}'`).join(', ');
  const bypassList = IP_PROXY_BYPASS_LIST.map((pattern) => `'${String(pattern).replace(/'/g, "\\'")}'`).join(', ');
  const forceDirectPatterns = (typeof IP_PROXY_FORCE_DIRECT_HOST_PATTERNS !== 'undefined' && Array.isArray(IP_PROXY_FORCE_DIRECT_HOST_PATTERNS)
    ? IP_PROXY_FORCE_DIRECT_HOST_PATTERNS
    : [])
    .map((pattern) => `'${String(pattern).replace(/'/g, "\\'")}'`)
    .join(', ');
  const forceDirectFallback = String(
    typeof IP_PROXY_FORCE_DIRECT_FALLBACK !== 'undefined' && IP_PROXY_FORCE_DIRECT_FALLBACK
      ? IP_PROXY_FORCE_DIRECT_FALLBACK
      : 'DIRECT'
  ).replace(/"/g, '\\"');
  const proxyEndpoint = `${pacScheme} ${host}:${port}`;
  const routeAllLiteral = (typeof IP_PROXY_ROUTE_ALL_TRAFFIC !== 'undefined' && Boolean(IP_PROXY_ROUTE_ALL_TRAFFIC))
    ? 'true'
    : 'false';
  return `
function FindProxyForURL(url, host) {
  if (!host) return "DIRECT";
  var bypassList = [${bypassList}];
  for (var i = 0; i < bypassList.length; i++) {
    var bypass = bypassList[i];
    if (shExpMatch(host, bypass) || host === bypass) {
      return "DIRECT";
    }
  }

  var forceDirectPatterns = [${forceDirectPatterns}];
  for (var fd = 0; fd < forceDirectPatterns.length; fd++) {
    var directPattern = forceDirectPatterns[fd];
    if (directPattern.indexOf('*.') === 0) {
      var directSuffix = directPattern.substring(1);
      var directHost = directPattern.substring(2);
      if (dnsDomainIs(host, directSuffix) || host === directHost) {
        return "${forceDirectFallback}";
      }
      continue;
    }
    if (host === directPattern || dnsDomainIs(host, '.' + directPattern)) {
      return "${forceDirectFallback}";
    }
  }

  var routeAllTraffic = ${routeAllLiteral};
  if (routeAllTraffic) {
    return "${proxyEndpoint}";
  }

  var targets = [${targetPatterns}];
  var matched = false;
  for (var j = 0; j < targets.length; j++) {
    var pattern = targets[j];
    if (pattern.indexOf('*.') === 0) {
      var suffix = pattern.substring(1);
      var direct = pattern.substring(2);
      if (dnsDomainIs(host, suffix) || host === direct) {
        matched = true;
        break;
      }
      continue;
    }
    if (host === pattern || dnsDomainIs(host, '.' + pattern)) {
      matched = true;
      break;
    }
  }
  if (!matched) {
    return "DIRECT";
  }
  return "${proxyEndpoint}";
}`.trim();
}

function buildIpProxyEntrySignature(entry = {}) {
  return [
    normalizeIpProxyProtocol(entry?.protocol || DEFAULT_IP_PROXY_PROTOCOL),
    String(entry?.host || '').trim().toLowerCase(),
    String(normalizeIpProxyPort(entry?.port) || ''),
    String(entry?.username || '').trim(),
    String(entry?.password || ''),
  ].join('|');
}

async function clearIpProxySettings(options = {}) {
  currentIpProxyAuthEntry = null;
  if (options?.resetAppliedSignature !== false) {
    lastAppliedIpProxyEntrySignature = '';
  }
  if (options?.resetHostVariant !== false) {
    ipProxyAuthHostVariantToggle = false;
  }
  if (options?.resetLastAppliedAuthSnapshot === true) {
    lastAppliedIpProxyAuthSnapshot = {
      host: '',
      port: 0,
      username: '',
      password: '',
    };
  }
  await callChromeProxySettings('clear', { scope: IP_PROXY_SETTINGS_SCOPE });
}

async function clearIpProxyNetworkState() {
  try {
    if (chrome.webRequest?.handlerBehaviorChanged) {
      await new Promise((resolve) => {
        try {
          chrome.webRequest.handlerBehaviorChanged(() => resolve());
        } catch {
          resolve();
        }
      });
    }
    if (chrome.browsingData?.remove) {
      await chrome.browsingData.remove(
        { since: 0 },
        {
          cache: true,
          cacheStorage: true,
          serviceWorkers: true,
        }
      );
    }
  } catch {
    // ignore cache clear failures; proxy apply can still continue
  }
}

async function forceProxyConnectionDrainBeforeAuthSwitch() {
  try {
    await callChromeProxySettings('set', {
      value: { mode: 'direct' },
      scope: IP_PROXY_SETTINGS_SCOPE,
    });
  } catch {
    // ignore direct mode switch failures
  }
  await new Promise((resolve) => setTimeout(resolve, 1200));
  await clearIpProxyNetworkState().catch(() => {});
  await new Promise((resolve) => setTimeout(resolve, 800));
}

async function updateIpProxyRuntimeStatus(status = {}) {
  const patch = buildIpProxyRoutingStatePatch(status);
  await setState(patch);
  broadcastDataUpdate(patch);
  return patch;
}

async function applyIpProxySettingsFromState(state = {}, options = {}) {
  const resolvedState = state || await getState();
  const enabled = Boolean(resolvedState?.ipProxyEnabled);
  if (!enabled) {
    try {
      await clearIpProxySettings({ resetLastAppliedAuthSnapshot: true });
    } catch {
      // ignore clear failures when already clear
    }
    await setIpProxyLeakGuardEnabled(false);
    const status = {
      enabled: false,
      applied: false,
      reason: 'disabled',
      provider: normalizeIpProxyProviderValue(resolvedState?.ipProxyService),
      exitDetecting: false,
      exitIp: '',
      exitRegion: '',
      exitError: '',
      error: '',
    };
    await updateIpProxyRuntimeStatus(status);
    return status;
  }

  if (!chrome.proxy?.settings?.set) {
    await setIpProxyLeakGuardEnabled(true);
    const status = {
      enabled: true,
      applied: false,
      reason: 'proxy_api_unavailable',
      provider: normalizeIpProxyProviderValue(resolvedState?.ipProxyService),
      error: 'Current browser does not support extension proxy API.',
      exitDetecting: false,
      exitIp: '',
      exitRegion: '',
      exitError: '',
    };
    await updateIpProxyRuntimeStatus(status);
    return status;
  }

  const mode = normalizeIpProxyMode(resolvedState?.ipProxyMode);
  const provider = normalizeIpProxyProviderValue(resolvedState?.ipProxyService);
  if (mode === 'api' && !isApiModeProxyConfigAvailable(resolvedState)) {
    const clearRuntimePatch = buildIpProxyRuntimeStatePatch(mode, {
      pool: [],
      index: 0,
      current: null,
    }, provider);
    await setState(clearRuntimePatch);
    broadcastDataUpdate(clearRuntimePatch);
    try {
      await clearIpProxySettings({ resetLastAppliedAuthSnapshot: true });
    } catch {
      // ignore clear failures
    }
    await setIpProxyLeakGuardEnabled(true);
    const status = {
      enabled: true,
      applied: false,
      reason: 'missing_proxy_entry',
      provider,
      error: 'API mode is enabled but proxy API is empty.',
      exitDetecting: false,
      exitIp: '',
      exitRegion: '',
      exitError: '',
      exitSource: '',
    };
    await updateIpProxyRuntimeStatus(status);
    return status;
  }

  const entry = getIpProxyCurrentEntryFromState(resolvedState);
  if (!entry) {
    try {
      await clearIpProxySettings({ resetLastAppliedAuthSnapshot: true });
    } catch {
      // ignore clear failures
    }
    await setIpProxyLeakGuardEnabled(true);
    const status = {
      enabled: true,
      applied: false,
      reason: 'missing_proxy_entry',
      provider: normalizeIpProxyProviderValue(resolvedState?.ipProxyService),
      error: mode === 'account'
        ? getAccountListParseFailureHint(resolvedState, provider)
        : '',
      exitDetecting: false,
      exitIp: '',
      exitRegion: '',
      exitError: '',
    };
    await updateIpProxyRuntimeStatus(status);
    return status;
  }

  const explicitForceAuthRebind = Boolean(options?.forceAuthRebind);
  const suppressAuthRebind = Boolean(options?.suppressAuthRebind);
  const hasAccountListConfigured = mode === 'account' && hasConfiguredAccountListEntries(resolvedState);
  const hasMultipleAccountEntries = mode === 'account'
    && hasAccountListConfigured
    && getAccountModeProxyPoolFromState(resolvedState, provider).length > 1;
  const shouldForceDrain = !suppressAuthRebind && (
    explicitForceAuthRebind
    || shouldForceProxyConnectionDrainForEntry(entry)
    || (
      provider === '711proxy'
      && hasAccountListConfigured
      && Boolean(String(entry?.username || '').trim())
    )
  );
  let effectiveEntry = buildEffectiveProxyEntryForApply(entry, {
    forceRotateVariant: shouldForceDrain,
    allow711HostVariant: hasMultipleAccountEntries,
  });
  if (shouldForceDrain) {
    effectiveEntry = await maybeResolveProxyHostVariantForAuthSwitch(effectiveEntry, {
      force: true,
      timeoutMs: 3500,
      // Only allow IP variant resolution in multi-node account list scenarios;
      // single-account explicit rebind uses host literal variants only to avoid link instability after IP resolution.
      allow711ResolvedIp: hasMultipleAccountEntries,
    }).catch(() => effectiveEntry);
  }

  const pacScript = buildIpProxyPacScript(effectiveEntry);
  if (!pacScript) {
    await setIpProxyLeakGuardEnabled(true);
    const status = {
      enabled: true,
      applied: false,
      reason: 'missing_proxy_entry',
      host: entry.host,
      port: entry.port,
      region: entry.region,
      hasAuth: Boolean(entry.username || entry.password),
      provider: normalizeIpProxyProviderValue(entry.provider || resolvedState?.ipProxyService),
      error: 'Proxy configuration is incomplete — cannot generate PAC rules.',
      exitDetecting: false,
      exitIp: '',
      exitRegion: '',
      exitError: '',
    };
    await updateIpProxyRuntimeStatus(status);
    return status;
  }

  const entrySignature = buildIpProxyEntrySignature(effectiveEntry);
  const shouldResetNetworkState = Boolean(
    entrySignature
    && entrySignature !== lastAppliedIpProxyEntrySignature
    && !options.skipExitProbe
    && options.resetNetworkState !== false
  );

  try {
    installIpProxyAuthListener();
    installIpProxyErrorListener();
    resetIpProxyRuntimeErrorDiagnostics();
    if (shouldForceDrain) {
      if (typeof addLog === 'function') {
        await addLog(
          explicitForceAuthRebind
            ? 'Performing proxy auth rebind: resetting proxy connection and switching host variant to avoid reusing old auth cache.'
            : 'Detected same-node proxy account switch — resetting proxy connection and switching host variant to avoid reusing old auth cache.',
          'info'
        ).catch(() => {});
        if (String(effectiveEntry?.host || '').trim() !== String(entry?.host || '').trim()) {
          await addLog(`Proxy account switch: enabled host cache isolation (${entry.host} -> ${effectiveEntry.host}).`, 'info').catch(() => {});
        }
      }
      await setIpProxyLeakGuardEnabled(true);
      await forceProxyConnectionDrainBeforeAuthSwitch();
    }
    currentIpProxyAuthEntry = effectiveEntry?.username
      ? {
          host: effectiveEntry.host,
          port: effectiveEntry.port,
          username: effectiveEntry.username,
          password: String(effectiveEntry.password || ''),
        }
      : null;
    await clearIpProxySettings({
      resetAppliedSignature: false,
      resetHostVariant: false,
    }).catch(() => {});
    currentIpProxyAuthEntry = effectiveEntry?.username
      ? {
          host: effectiveEntry.host,
          port: effectiveEntry.port,
          username: effectiveEntry.username,
          password: String(effectiveEntry.password || ''),
        }
      : null;
    if (shouldResetNetworkState) {
      await clearIpProxyNetworkState();
    }
    await callChromeProxySettings('set', {
      value: {
        mode: 'pac_script',
        pacScript: {
          data: pacScript,
          // Chrome docs recommend enabling mandatory to avoid silent fallback to DIRECT when PAC fails.
          mandatory: true,
        },
      },
      scope: IP_PROXY_SETTINGS_SCOPE,
    });
    const proxySettings = await getChromeProxySettings({ incognito: false }).catch(() => null);
    const takeoverCheck = validateProxyControlAfterApply(proxySettings || {}, effectiveEntry);
    if (!takeoverCheck.ok) {
      throw new Error(takeoverCheck.message || 'Proxy takeover validation failed.');
    }
    await setIpProxyLeakGuardEnabled(false);
    lastAppliedIpProxyEntrySignature = entrySignature;
    lastAppliedIpProxyAuthSnapshot = {
      host: String(entry?.host || '').trim(),
      port: normalizeIpProxyPort(entry?.port),
      username: String(entry?.username || '').trim(),
      password: String(entry?.password || ''),
    };
  } catch (error) {
    lastAppliedIpProxyEntrySignature = '';
    await setIpProxyLeakGuardEnabled(true);
    const status = {
      enabled: true,
      applied: false,
      reason: 'apply_failed',
      host: entry.host,
      port: entry.port,
      region: entry.region,
      hasAuth: Boolean(entry.username || entry.password),
      provider: normalizeIpProxyProviderValue(entry.provider || resolvedState?.ipProxyService),
      error: error?.message || String(error || 'Proxy settings failed'),
      exitDetecting: false,
      exitIp: '',
      exitRegion: '',
      exitError: '',
    };
    await updateIpProxyRuntimeStatus(status);
    return status;
  }

  const status = {
    enabled: true,
    applied: true,
    reason: 'applied',
    host: entry.host,
    port: entry.port,
    region: entry.region,
    username: String(entry.username || '').trim(),
    entrySource: resolveIpProxyAccountEntrySource(resolvedState, mode),
    hasAuth: Boolean(entry.username || entry.password),
    provider: normalizeIpProxyProviderValue(entry.provider || resolvedState?.ipProxyService),
    error: '',
    exitDetecting: !options.skipExitProbe,
    exitIp: '',
    exitRegion: '',
    exitError: '',
    exitSource: '',
  };
  await updateIpProxyRuntimeStatus(status);

  if (shouldForceDrain) {
    // After switching accounts on the same node, give the network stack a moment to establish a new tunnel,
    // avoiding immediate probes that may hit the old connection.
    await new Promise((resolve) => setTimeout(resolve, 900));
  }

  if (options.skipExitProbe) {
    return status;
  }

  const token = ++ipProxyExitDetectionToken;
  const diagnostics = [];
  resetIpProxyAuthDiagnostics();
  const exit = await detectProxyExitInfo({
    timeoutMs: 10000,
    errors: diagnostics,
    provider: status?.provider || provider,
    username: status?.username || entry?.username || '',
    // Prefer page-context probe to ensure probe link is consistent with real browser pages;
    // background probe is only a supplementary fallback to avoid single-path misjudgment.
    preferPageContext: true,
    allowBackgroundFallback: true,
    state,
  }).catch(() => ({ ip: '', region: '' }));
  if (!exit?.ip && Boolean(status?.hasAuth)) {
    appendIpProxyAuthDiagnosticsToErrors(diagnostics);
  }

  if (token !== ipProxyExitDetectionToken) {
    return status;
  }
  const latest = await getState();
  if (!latest?.ipProxyEnabled) {
    return status;
  }

  const exitStatus = {
    ...status,
    exitDetecting: false,
    exitIp: String(exit?.ip || '').trim(),
    exitRegion: String(exit?.region || '').trim(),
    exitBaselineIp: String(exit?.baselineIp || '').trim(),
    exitError: exit?.ip ? '' : buildProbeDiagnosticsSummary(diagnostics, IP_PROXY_DIAGNOSTICS_SUMMARY_MAX_ITEMS),
    exitSource: String(exit?.source || '').trim().toLowerCase(),
    authDiagnostics: status?.hasAuth ? getIpProxyAuthDiagnosticsSummary() : '',
  };
  const expectedRegion = String(entry?.region || '').trim();
  let normalizedExitStatus = applyExitRegionExpectation(exitStatus, expectedRegion);
  normalizedExitStatus = applyExitBaselineExpectation(normalizedExitStatus);
  if (shouldVerifyIpProxyTargetReachability(normalizedExitStatus)) {
    const targetDiagnostics = [];
    const reachability = await detectIpProxyTargetReachabilityByPageContext({
      timeoutMs: IP_PROXY_TARGET_REACHABILITY_TIMEOUT_MS,
      errors: targetDiagnostics,
      state,
    }).catch((error) => ({
      reachable: false,
      endpoint: IP_PROXY_TARGET_REACHABILITY_ENDPOINTS[0],
      source: 'target_page_context',
      error: error?.message || String(error || 'target reachability failed'),
    }));
    normalizedExitStatus = applyTargetReachabilityExpectation(normalizedExitStatus, {
      ...reachability,
      error: reachability?.reachable
        ? ''
        : (reachability?.error || buildProbeDiagnosticsSummary(targetDiagnostics, IP_PROXY_DIAGNOSTICS_SUMMARY_MAX_ITEMS)),
    });
  }
  await syncIpProxyLeakGuardForStatus(normalizedExitStatus);
  await updateIpProxyRuntimeStatus(normalizedExitStatus);
  return normalizedExitStatus;
}

function getNextIpProxyPoolIndex(currentIndex = 0, poolLength = 0, direction = 'next') {
  const length = Math.max(0, Number(poolLength) || 0);
  if (length <= 0) return 0;
  const normalized = normalizeIpProxyCurrentIndex(currentIndex, 0) % length;
  if (String(direction || '').toLowerCase() === 'prev') {
    return (normalized - 1 + length) % length;
  }
  return (normalized + 1) % length;
}

async function refreshIpProxyPool(options = {}) {
  const state = options.state || await getState();
  const mode = normalizeIpProxyMode(options.mode || state?.ipProxyMode);
  const maxItems = Math.max(
    1,
    Math.min(500, Number(options.maxItems) || resolveIpProxyPoolTargetCountForMode(state, mode))
  );
  const provider = normalizeIpProxyProviderValue(state?.ipProxyService);
  let pool = [];

  if (mode === 'account') {
    pool = getAccountModeProxyPoolFromState(state, provider).slice(0, maxItems);
    if (!pool.length) {
      const parseFailureHint = getAccountListParseFailureHint(state, provider);
      if (parseFailureHint) {
        throw new Error(parseFailureHint);
      }
      throw new Error('Username/password mode has no usable proxies. Please fill in the proxy list or Host/Port.');
    }
  } else {
    pool = await pullIpProxyPoolFromApi(state, {
      maxItems,
      timeoutMs: options.timeoutMs,
    });
    if (!pool.length) {
      throw new Error('Proxy list is empty. Please check the API response.');
    }
  }

  const runtime = getIpProxyRuntimeSnapshot(state, mode, provider);
  const summary = buildProxyPoolSummary(pool, runtime.index);
  const updates = {
    ipProxyService: provider,
    ...buildIpProxyRuntimeStatePatch(mode, {
      pool,
      index: summary.index,
      current: summary.current,
    }, provider),
  };
  await setState(updates);
  broadcastDataUpdate(updates);

  let proxyRouting = null;
  if (state?.ipProxyEnabled) {
    const applyState = {
      ...state,
      ...updates,
    };
    const shouldRebindSingleAccountEntry = mode === 'account' && pool.length <= 1;
    proxyRouting = await applyIpProxySettingsFromState(
      applyState,
      shouldRebindSingleAccountEntry
        ? {
          forceAuthRebind: true,
          suppressAuthRebind: false,
          resetNetworkState: true,
          skipExitProbe: Boolean(options?.skipExitProbe),
        }
        : {
          skipExitProbe: Boolean(options?.skipExitProbe),
        }
    );
  }

  return {
    mode,
    provider,
    count: summary.count,
    index: summary.index,
    current: summary.current,
    display: summary.display,
    pool,
    proxyRouting,
  };
}

async function switchIpProxy(direction = 'next', options = {}) {
  const state = options.state || await getState();
  const mode = normalizeIpProxyMode(options.mode || state?.ipProxyMode);
  if (mode === 'api' && !isApiModeProxyConfigAvailable(state)) {
    throw new Error('API mode proxy URL is empty. Please fill in the proxy API address first.');
  }
  const maxItems = Math.max(
    1,
    Math.min(500, Number(options.maxItems) || resolveIpProxyPoolTargetCountForMode(state, mode))
  );
  const provider = normalizeIpProxyProviderValue(state?.ipProxyService);
  const runtime = getIpProxyRuntimeSnapshot(state, mode, provider);
  let pool = [];
  if (mode === 'account') {
    pool = getAccountModeProxyPoolFromState(state, provider).slice(0, maxItems);
  } else {
    pool = runtime.pool.slice(0, maxItems);
  }

  if (!pool.length) {
    if (mode === 'api' && options.forceRefresh !== false) {
      return refreshIpProxyPool({
        ...options,
        mode,
        state,
      });
    }
    throw new Error(mode === 'account'
      ? 'Username/password mode has no proxies to switch. Please fill in the proxy list or Host/Port.'
      : 'No switchable proxy available. Please click "Pull" to fetch the IP list.');
  }

  const nextIndex = getNextIpProxyPoolIndex(runtime.index, pool.length, direction);
  const current = pool[nextIndex];
  const updates = {
    ipProxyService: provider,
    ...buildIpProxyRuntimeStatePatch(mode, {
      pool,
      index: nextIndex,
      current,
    }, provider),
  };
  await setState(updates);
  broadcastDataUpdate(updates);

  let proxyRouting = null;
  if (state?.ipProxyEnabled) {
    const applyState = {
      ...state,
      ...updates,
    };
    const shouldRebindSingleAccountEntry = mode === 'account' && pool.length <= 1;
    proxyRouting = await applyIpProxySettingsFromState(
      applyState,
      shouldRebindSingleAccountEntry
        ? {
          forceAuthRebind: true,
          suppressAuthRebind: false,
          resetNetworkState: true,
          skipExitProbe: Boolean(options?.skipExitProbe),
        }
        : {
          skipExitProbe: Boolean(options?.skipExitProbe),
        }
    );
  }
  const summary = buildProxyPoolSummary(pool, nextIndex);
  return {
    mode,
    provider,
    count: summary.count,
    index: summary.index,
    current: summary.current,
    display: summary.display,
    pool,
    proxyRouting,
  };
}

async function changeIpProxyExit(options = {}) {
  const state = options.state || await getState();
  if (!state?.ipProxyEnabled) {
    throw new Error('Please enable IP proxy first.');
  }

  const mode = normalizeIpProxyMode(options.mode || state?.ipProxyMode);
  const provider = normalizeIpProxyProviderValue(state?.ipProxyService);
  if (mode !== 'account') {
    throw new Error('Change only supports username/password mode.');
  }
  if (provider !== '711proxy') {
    throw new Error('Change currently only supports 711Proxy.');
  }

  const entry = getIpProxyCurrentEntryFromState(state);
  if (!entry || !entry.host || !entry.port) {
    throw new Error('No available proxy entry — cannot execute Change.');
  }
  const username = String(entry?.username || '').trim();
  if (!has711SessionToken(username)) {
    throw new Error('Current account has no session configured — cannot execute Change. Please add session parameter to the account first.');
  }

  if (typeof addLog === 'function') {
    await addLog('Executing Change: keeping current session, rebinding proxy link and refreshing exit.', 'info').catch(() => {});
  }

  const proxyRouting = await applyIpProxySettingsFromState(state, {
    forceAuthRebind: true,
    suppressAuthRebind: false,
    resetNetworkState: true,
    skipExitProbe: Boolean(options?.skipExitProbe),
  });

  const runtime = getIpProxyRuntimeSnapshot(state, mode, provider);
  const pool = runtime.pool.length
    ? runtime.pool
    : getAccountModeProxyPoolFromState(state, provider);
  const summary = buildProxyPoolSummary(pool, runtime.index);

  return {
    mode,
    provider,
    count: summary.count,
    index: summary.index,
    current: summary.current,
    display: summary.display,
    pool,
    proxyRouting,
    action: 'change',
  };
}

async function tryRecoverApiProxyByRotation(options = {}) {
  const maxAttempts = Math.max(1, Math.min(12, Number(options?.maxAttempts) || 4));
  let latestStatus = options?.fallbackStatus || null;
  let attempts = 0;
  let refreshedPool = false;
  const runSingleRotationPass = async () => {
    for (let attempt = 0; attempt < maxAttempts; attempt += 1) {
      const state = await getState();
      if (!state?.ipProxyEnabled) {
        break;
      }
      const mode = normalizeIpProxyMode(state?.ipProxyMode);
      if (mode !== 'api') {
        break;
      }
      const provider = normalizeIpProxyProviderValue(state?.ipProxyService);
      const runtime = getIpProxyRuntimeSnapshot(state, mode, provider);
      if (!Array.isArray(runtime?.pool) || runtime.pool.length <= 1) {
        break;
      }
      const switched = await switchIpProxy('next', {
        mode,
        forceRefresh: false,
        state,
      }).catch(() => null);
      attempts += 1;
      const status = switched?.proxyRouting || null;
      if (status) {
        latestStatus = status;
      }
      if (status?.applied && status?.reason !== 'connectivity_failed') {
        if (typeof addLog === 'function') {
          const nodeText = Number.isInteger(switched?.index)
            && Number.isInteger(switched?.count)
            && switched.count > 0
            ? `(node ${switched.index + 1}/${switched.count})`
            : '';
          const refreshText = refreshedPool ? ' (auto-refreshed IP pool)' : '';
          await addLog(`IP proxy auto-recovery succeeded: API mode switched to available node ${nodeText}${refreshText}.`, 'ok').catch(() => {});
        }
        return true;
      }
    }
    return false;
  };

  const firstPassRecovered = await runSingleRotationPass();
  if (firstPassRecovered) {
    return { recovered: true, attempts, status: latestStatus };
  }

  if (options?.allowRefresh !== false) {
    const latestState = await getState();
    if (latestState?.ipProxyEnabled && normalizeIpProxyMode(latestState?.ipProxyMode) === 'api') {
      await refreshIpProxyPool({
        mode: 'api',
        state: latestState,
        forceRefresh: true,
      }).catch(() => null);
      refreshedPool = true;
      const secondPassRecovered = await runSingleRotationPass();
      if (secondPassRecovered) {
        return { recovered: true, attempts, status: latestStatus };
      }
    }
  }

  if (latestStatus && attempts > 0) {
    const suffix = refreshedPool
      ? `Auto-rotated ${attempts} API nodes and refreshed IP pool, still unavailable.`
      : `Auto-rotated ${attempts} API nodes but still unavailable.`;
    const currentError = String(latestStatus.error || '').trim();
    latestStatus = {
      ...latestStatus,
      error: currentError
        ? `${currentError} ${suffix}`
        : suffix,
    };
  }

  return { recovered: false, attempts, status: latestStatus };
}

async function probeIpProxyExit(options = {}) {
  if (ipProxyProbeInFlightPromise) {
    return ipProxyProbeInFlightPromise;
  }
  const probePromise = (async () => {
  const state = options.state || await getState();
  if (!state?.ipProxyEnabled) {
    if (options?.detectWhenDisabled) {
      const diagnostics = [];
      const exit = await detectProxyExitInfo({
        timeoutMs: Number(options?.timeoutMs) || 10000,
        errors: diagnostics,
        provider: normalizeIpProxyProviderValue(state?.ipProxyService),
        username: String(state?.ipProxyUsername || '').trim(),
        preferPageContext: true,
        allowBackgroundFallback: true,
        state,
      }).catch(() => ({ ip: '', region: '', endpoint: '', source: '' }));
      const status = {
        enabled: false,
        applied: false,
        reason: 'disabled_probe_only',
        provider: normalizeIpProxyProviderValue(state?.ipProxyService),
        exitDetecting: false,
        exitIp: String(exit?.ip || '').trim(),
        exitRegion: String(exit?.region || '').trim(),
        exitBaselineIp: String(exit?.baselineIp || '').trim(),
        exitEndpoint: String(exit?.endpoint || '').trim(),
        exitSource: String(exit?.source || '').trim().toLowerCase(),
        exitError: exit?.ip ? '' : buildProbeDiagnosticsSummary(diagnostics, IP_PROXY_DIAGNOSTICS_SUMMARY_MAX_ITEMS),
        error: '',
      };
      return { proxyRouting: status };
    }
    const status = {
      enabled: false,
      applied: false,
      reason: 'disabled',
      provider: normalizeIpProxyProviderValue(state?.ipProxyService),
      exitDetecting: false,
      exitIp: '',
      exitRegion: '',
      exitError: '',
      error: '',
    };
    await updateIpProxyRuntimeStatus(status);
    return { proxyRouting: status };
  }

  const mode = normalizeIpProxyMode(state?.ipProxyMode);
  const provider = normalizeIpProxyProviderValue(state?.ipProxyService);
  const entry = getIpProxyCurrentEntryFromState(state);
  if (!entry) {
    const status = {
      enabled: true,
      applied: false,
      reason: 'missing_proxy_entry',
      provider,
      error: mode === 'account'
        ? getAccountListParseFailureHint(state, provider)
        : '',
      exitDetecting: false,
      exitIp: '',
      exitRegion: '',
      exitError: '',
    };
    await updateIpProxyRuntimeStatus(status);
    return { proxyRouting: status };
  }

  installIpProxyAuthListener();
  installIpProxyErrorListener();
  resetIpProxyRuntimeErrorDiagnostics();
  currentIpProxyAuthEntry = entry?.username
    ? {
        host: entry.host,
        port: entry.port,
        username: entry.username,
        password: String(entry.password || ''),
      }
    : null;

  const probingStatus = {
    enabled: true,
    applied: true,
    reason: String(state?.ipProxyAppliedReason || 'applied'),
    host: entry.host,
    port: entry.port,
    region: entry.region,
    username: String(entry.username || '').trim(),
    entrySource: resolveIpProxyAccountEntrySource(state, mode),
    hasAuth: Boolean(entry.username || entry.password),
    provider: normalizeIpProxyProviderValue(entry.provider || state?.ipProxyService),
    error: String(state?.ipProxyAppliedError || ''),
    exitDetecting: true,
    exitIp: '',
    exitRegion: '',
    exitEndpoint: '',
    exitError: '',
    exitSource: '',
  };
  // The previous round's connectivity failure may have enabled the fail-close rule; clear it before manual probe to avoid self-blocking.
  await setIpProxyLeakGuardEnabled(false);
  await updateIpProxyRuntimeStatus(probingStatus);

  const runProbeRound = async (statusSeed = probingStatus, timeoutMs = Number(options?.timeoutMs) || 10000) => {
    const diagnostics = [];
    resetIpProxyAuthDiagnostics();
    const exit = await detectProxyExitInfo({
      timeoutMs,
      errors: diagnostics,
      provider: statusSeed?.provider || probingStatus?.provider || provider,
      username: statusSeed?.username || probingStatus?.username || '',
      // Manual probe stays consistent with auto-apply: page context first, then background as backup.
      preferPageContext: true,
      allowBackgroundFallback: true,
      state,
    }).catch(() => ({ ip: '', region: '' }));
    if (!exit?.ip && Boolean(statusSeed?.hasAuth)) {
      appendIpProxyAuthDiagnosticsToErrors(diagnostics);
      if (typeof addLog === 'function') {
        await addLog(`Proxy exit probe failed: ${buildProbeDiagnosticsSummary(diagnostics, IP_PROXY_DIAGNOSTICS_SUMMARY_MAX_ITEMS)}`, 'warn').catch(() => {});
      }
    }
    const finalStatus = {
      ...statusSeed,
      exitDetecting: false,
      exitIp: String(exit?.ip || '').trim(),
      exitRegion: String(exit?.region || '').trim(),
      exitBaselineIp: String(exit?.baselineIp || '').trim(),
      exitEndpoint: String(exit?.endpoint || '').trim(),
      exitError: exit?.ip ? '' : buildProbeDiagnosticsSummary(diagnostics, IP_PROXY_DIAGNOSTICS_SUMMARY_MAX_ITEMS),
      exitSource: String(exit?.source || '').trim().toLowerCase(),
      authDiagnostics: statusSeed?.hasAuth ? getIpProxyAuthDiagnosticsSummary() : '',
    };
    const expectedRegion = String(statusSeed?.region || '').trim();
    let normalized = applyExitRegionExpectation(finalStatus, expectedRegion);
    normalized = applyExitBaselineExpectation(normalized);
    if (shouldVerifyIpProxyTargetReachability(normalized)) {
      const targetDiagnostics = [];
      const reachability = await detectIpProxyTargetReachabilityByPageContext({
        timeoutMs: IP_PROXY_TARGET_REACHABILITY_TIMEOUT_MS,
        errors: targetDiagnostics,
        state,
      }).catch((error) => ({
        reachable: false,
        endpoint: IP_PROXY_TARGET_REACHABILITY_ENDPOINTS[0],
        source: 'target_page_context',
        error: error?.message || String(error || 'target reachability failed'),
      }));
      normalized = applyTargetReachabilityExpectation(normalized, {
        ...reachability,
        error: reachability?.reachable
          ? ''
          : (reachability?.error || buildProbeDiagnosticsSummary(targetDiagnostics, IP_PROXY_DIAGNOSTICS_SUMMARY_MAX_ITEMS)),
      });
    }
    return normalized;
  };

  let normalizedFinalStatus = await runProbeRound(probingStatus, Number(options?.timeoutMs) || 10000);
  const parsedAuthSummary = parseIpProxyAuthDiagnosticsSummary(String(normalizedFinalStatus?.authDiagnostics || ''));
  const missingAuthChallenge = Boolean(normalizedFinalStatus?.hasAuth)
    && parsedAuthSummary
    && parsedAuthSummary.challenge <= 0
    && parsedAuthSummary.provided <= 0;
  const shouldRetryAuthRebind = mode === 'account'
    && provider === '711proxy'
    && Boolean(String(entry?.username || '').trim())
    && missingAuthChallenge
    && options?.authRebindRetry !== false;

  if (shouldRetryAuthRebind) {
    const maxRebindAttempts = Math.max(1, Math.min(3, Number(options?.authRebindMaxAttempts) || 2));
    for (let attempt = 0; attempt < maxRebindAttempts; attempt += 1) {
      if (typeof addLog === 'function') {
        const hint = attempt === 0 ? 'initial rebind retest' : `rebind retest #${attempt + 1}`;
        await addLog(`Detected proxy link did not trigger 407 challenge — performing ${hint}.`, 'info').catch(() => {});
      }
      const latestBeforeRebind = await getState();
      const reboundStatus = await applyIpProxySettingsFromState(latestBeforeRebind, {
        skipExitProbe: true,
        resetNetworkState: true,
        forceAuthRebind: true,
      }).catch(() => null);
      const latestAfterRebind = await getState();
      const reboundEntry = getIpProxyCurrentEntryFromState(latestAfterRebind);
      if (!reboundStatus?.applied || !reboundEntry?.host || !reboundEntry?.port) {
        break;
      }
      currentIpProxyAuthEntry = reboundEntry?.username
        ? {
            host: reboundEntry.host,
            port: reboundEntry.port,
            username: reboundEntry.username,
            password: String(reboundEntry.password || ''),
          }
        : null;
      const retryProbingStatus = {
        ...probingStatus,
        reason: String(reboundStatus?.reason || probingStatus.reason || 'applied'),
        host: reboundEntry.host,
        port: reboundEntry.port,
        region: String(reboundEntry.region || '').trim(),
        username: String(reboundEntry.username || '').trim(),
        entrySource: resolveIpProxyAccountEntrySource(
          latestAfterRebind,
          normalizeIpProxyMode(latestAfterRebind?.ipProxyMode)
        ),
        hasAuth: Boolean(reboundEntry.username || reboundEntry.password),
        provider: normalizeIpProxyProviderValue(reboundEntry.provider || latestAfterRebind?.ipProxyService),
        error: String(reboundStatus?.error || ''),
        exitDetecting: true,
        exitIp: '',
        exitRegion: '',
        exitEndpoint: '',
        exitError: '',
        exitSource: '',
      };
      await updateIpProxyRuntimeStatus(retryProbingStatus);
      normalizedFinalStatus = await runProbeRound(
        retryProbingStatus,
        Math.max(9000, Number(options?.timeoutMs) || 10000)
      );
      const retryAuthSummary = parseIpProxyAuthDiagnosticsSummary(String(normalizedFinalStatus?.authDiagnostics || ''));
      const stillMissingChallenge = Boolean(normalizedFinalStatus?.hasAuth)
        && retryAuthSummary
        && retryAuthSummary.challenge <= 0
        && retryAuthSummary.provided <= 0;
      if (!stillMissingChallenge) {
        break;
      }
    }
  }
  if (normalizedFinalStatus.reason === 'connectivity_failed'
    && normalizeIpProxyMode(state?.ipProxyMode) === 'api') {
    const recovered = await tryRecoverApiProxyByRotation({
      maxAttempts: options?.autoRotateMaxAttempts,
      fallbackStatus: normalizedFinalStatus,
    });
    if (recovered?.status) {
      normalizedFinalStatus = recovered.status;
    }
  }
  await syncIpProxyLeakGuardForStatus(normalizedFinalStatus);
  await updateIpProxyRuntimeStatus(normalizedFinalStatus);
  return { proxyRouting: normalizedFinalStatus };
  })();
  ipProxyProbeInFlightPromise = probePromise;
  try {
    return await probePromise;
  } finally {
    if (ipProxyProbeInFlightPromise === probePromise) {
      ipProxyProbeInFlightPromise = null;
    }
  }
}

async function ensureIpProxySettingsAppliedFromCurrentState(options = {}) {
  const state = options.state || await getState();
  return applyIpProxySettingsFromState(state, options);
}
