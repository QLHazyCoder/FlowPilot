// sidepanel/ip-proxy-panel.js — IP代理面板（轻量解耦）
function normalizeIpProxyService(value = '') {
  const normalized = String(value || '').trim().toLowerCase();
  const enabledServices = Array.isArray(globalThis.IP_PROXY_ENABLED_SERVICES)
    ? globalThis.IP_PROXY_ENABLED_SERVICES
    : [DEFAULT_IP_PROXY_SERVICE];
  if (enabledServices.includes(normalized)) {
    return normalized;
  }
  return DEFAULT_IP_PROXY_SERVICE;
}

const ipProxyActionState = {
  busy: false,
  action: '',
  startedAt: 0,
};
const IP_PROXY_ACTION_LOCK_TIMEOUT_MS = 25000;
let ipProxyDeferredProbeTimer = 0;
const IP_PROXY_SECTION_EXPANDED_STORAGE_KEY = 'multipage-ip-proxy-section-expanded';
let ipProxySectionExpanded = false;

function readIpProxySectionExpanded() {
  try {
    return globalThis.localStorage?.getItem(IP_PROXY_SECTION_EXPANDED_STORAGE_KEY) === '1';
  } catch (err) {
    return false;
  }
}

function persistIpProxySectionExpanded(expanded) {
  try {
    if (expanded) {
      globalThis.localStorage?.setItem(IP_PROXY_SECTION_EXPANDED_STORAGE_KEY, '1');
    } else {
      globalThis.localStorage?.removeItem(IP_PROXY_SECTION_EXPANDED_STORAGE_KEY);
    }
  } catch (err) {
    // Ignore storage errors; the in-memory collapsed state is still enough for this session.
  }
}

function setIpProxySectionExpanded(expanded) {
  ipProxySectionExpanded = Boolean(expanded);
  persistIpProxySectionExpanded(ipProxySectionExpanded);
  if (typeof updateIpProxyUI === 'function') {
    updateIpProxyUI(latestState);
  }
}

function toggleIpProxySectionExpanded() {
  setIpProxySectionExpanded(!ipProxySectionExpanded);
}

function initIpProxySectionExpandedState() {
  ipProxySectionExpanded = readIpProxySectionExpanded();
  if (typeof updateIpProxyUI === 'function') {
    updateIpProxyUI(latestState);
  }
}

function normalizeIpProxyActionType(value = '') {
  const normalized = String(value || '').trim().toLowerCase();
  return normalized || 'action';
}

function getIpProxyActionLabel(action = '') {
  const normalized = normalizeIpProxyActionType(action);
  if (normalized === 'refresh') return '同步代理';
  if (normalized === 'next') return '切换代理';
  if (normalized === 'change') return '会话换出口';
  if (normalized === 'probe') return '检测出口';
  return '代理操作';
}

function isIpProxyActionBusy() {
  return Boolean(ipProxyActionState.busy);
}

function getIpProxyActionState() {
  return {
    busy: Boolean(ipProxyActionState.busy),
    action: normalizeIpProxyActionType(ipProxyActionState.action),
    startedAt: Number(ipProxyActionState.startedAt) || 0,
  };
}

function setIpProxyActionBusy(action = '', busy = false) {
  ipProxyActionState.busy = Boolean(busy);
  ipProxyActionState.action = ipProxyActionState.busy ? normalizeIpProxyActionType(action) : '';
  ipProxyActionState.startedAt = ipProxyActionState.busy ? Date.now() : 0;
}

async function runIpProxyActionWithLock(action = '', runner) {
  if (typeof runner !== 'function') {
    throw new Error('代理操作执行器无效。');
  }
  const nextAction = normalizeIpProxyActionType(action);
  const currentState = getIpProxyActionState();
  if (currentState.busy) {
    if (typeof showToast === 'function') {
      showToast(`${getIpProxyActionLabel(currentState.action)}进行中，请稍候。`, 'info', 1600);
    }
    return { skipped: true };
  }

  setIpProxyActionBusy(nextAction, true);
  if (typeof updateIpProxyUI === 'function') {
    updateIpProxyUI(latestState);
  }

  const actionLabel = getIpProxyActionLabel(nextAction);
  const timeoutMs = Math.max(5000, Number(IP_PROXY_ACTION_LOCK_TIMEOUT_MS) || 25000);
  let timeoutId = 0;
  try {
    const value = await Promise.race([
      Promise.resolve().then(() => runner()),
      new Promise((_, reject) => {
        timeoutId = globalThis.setTimeout(() => {
          reject(new Error(`${actionLabel}超时（${Math.round(timeoutMs / 1000)} 秒），已自动解锁，请重试。`));
        }, timeoutMs);
      }),
    ]);
    return { skipped: false, value };
  } finally {
    if (timeoutId) {
      globalThis.clearTimeout(timeoutId);
    }
    setIpProxyActionBusy(nextAction, false);
    if (typeof updateIpProxyUI === 'function') {
      updateIpProxyUI(latestState);
    }
  }
}

function scheduleIpProxyExitProbe(options = {}) {
  const {
    silent = true,
    delayMs = 80,
  } = options;
  const delay = Math.max(0, Number(delayMs) || 0);
  if (ipProxyDeferredProbeTimer) {
    globalThis.clearTimeout(ipProxyDeferredProbeTimer);
    ipProxyDeferredProbeTimer = 0;
  }
  ipProxyDeferredProbeTimer = globalThis.setTimeout(() => {
    ipProxyDeferredProbeTimer = 0;
    Promise.resolve()
      .then(() => probeIpProxyExit({ silent }))
      .catch(() => {});
  }, delay);
}

function normalizeIpProxyMode(value = '') {
  const normalized = String(value || '').trim().toLowerCase();
  return SUPPORTED_IP_PROXY_MODES.includes(normalized) ? normalized : DEFAULT_IP_PROXY_MODE;
}

function isIpProxyApiModeAvailable() {
  return Boolean(typeof IP_PROXY_API_MODE_ENABLED === 'undefined'
    ? false
    : IP_PROXY_API_MODE_ENABLED);
}

function isIpProxyAccountListAvailable() {
  return Boolean(typeof IP_PROXY_ACCOUNT_LIST_ENABLED === 'undefined'
    ? true
    : IP_PROXY_ACCOUNT_LIST_ENABLED);
}

function normalizeIpProxyModeForCurrentRelease(value = '') {
  const normalized = normalizeIpProxyMode(value);
  if (!isIpProxyApiModeAvailable() && normalized === 'api') {
    return 'account';
  }
  return normalized;
}

function normalizeIpProxyProtocol(value = '') {
  const normalized = String(value || '').trim().toLowerCase();
  return SUPPORTED_IP_PROXY_PROTOCOLS.includes(normalized) ? normalized : DEFAULT_IP_PROXY_PROTOCOL;
}

function normalizeIpProxyPort(value = '') {
  const numeric = Number.parseInt(String(value || '').trim(), 10);
  if (!Number.isInteger(numeric) || numeric <= 0 || numeric > 65535) {
    return 0;
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

function normalizeIpProxyAccountLifeMinutes(value = '', fallback = '') {
  const rawValue = String(value ?? '').trim();
  if (!rawValue) {
    return String(fallback || '').trim();
  }
  const numeric = Number.parseInt(rawValue, 10);
  if (!Number.isInteger(numeric)) {
    return String(fallback || '').trim();
  }
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
      // 与后台保持一致：支持 # / // / ; 注释行，注释行不参与生效。
      if (/^(?:#|\/\/|;)/.test(line)) {
        return false;
      }
      return true;
    })
    .join('\n');
}

function normalizeIpProxyServiceProfile(rawValue = {}) {
  const raw = (rawValue && typeof rawValue === 'object' && !Array.isArray(rawValue))
    ? rawValue
    : {};
  return {
    mode: normalizeIpProxyModeForCurrentRelease(raw.mode),
    apiUrl: String(raw.apiUrl || '').trim(),
    accountList: normalizeIpProxyAccountList(raw.accountList || ''),
    accountSessionPrefix: normalizeIpProxyAccountSessionPrefix(raw.accountSessionPrefix || ''),
    accountLifeMinutes: normalizeIpProxyAccountLifeMinutes(raw.accountLifeMinutes || ''),
    poolTargetCount: normalizeIpProxyPoolTargetCount(raw.poolTargetCount || '', 20),
    autoSyncEnabled: Boolean(raw.autoSyncEnabled),
    autoSyncIntervalMinutes: String(Math.max(1, Math.min(1440, Number.parseInt(String(raw.autoSyncIntervalMinutes ?? '').trim(), 10) || 15))),
    host: String(raw.host || '').trim(),
    port: String(normalizeIpProxyPort(raw.port || '') || ''),
    protocol: normalizeIpProxyProtocol(raw.protocol),
    username: String(raw.username || '').trim(),
    password: String(raw.password || ''),
    region: String(raw.region || '').trim(),
  };
}

function buildIpProxyServiceProfileFromFlatState(state = {}) {
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
  const fallbackProfile = buildIpProxyServiceProfileFromFlatState(fallbackState);
  const result = {};
  SUPPORTED_IP_PROXY_SERVICES.forEach((service) => {
    const serviceRaw = raw[service];
    if (serviceRaw && typeof serviceRaw === 'object' && !Array.isArray(serviceRaw)) {
      result[service] = normalizeIpProxyServiceProfile(serviceRaw);
      return;
    }
    result[service] = normalizeIpProxyServiceProfile(fallbackProfile);
  });
  return result;
}

function getIpProxyServiceProfilesFromState(state = latestState) {
  return normalizeIpProxyServiceProfiles(state?.ipProxyServiceProfiles || {}, state || {});
}

function getIpProxyServiceProfile(service = '', state = latestState) {
  const selectedService = normalizeIpProxyService(service || state?.ipProxyService || DEFAULT_IP_PROXY_SERVICE);
  const profiles = getIpProxyServiceProfilesFromState(state);
  const profile = normalizeIpProxyServiceProfile(profiles[selectedService] || {});
  const resolvedRegion = resolveIpProxyRegionFromInputs({
    service: selectedService,
    mode: profile.mode,
    host: profile.host,
    username: profile.username,
    region: profile.region,
  });
  if (resolvedRegion) {
    profile.region = resolvedRegion;
  }
  return profile;
}

function inferRegionFromProxyUsernameForPanel(username = '') {
  const text = String(username || '').trim();
  if (!text) return '';
  const match = text.match(/(?:^|[-_])(?:region|area|country)[-_:]?([A-Za-z]{2})\b/i);
  if (!match) return '';
  return String(match[1] || '').trim().toUpperCase();
}

function inferRegionFromProxyHostForPanel(host = '') {
  const text = String(host || '').trim().toLowerCase().replace(/\.$/, '');
  if (!text || !text.includes('.')) return '';
  const firstLabel = String(text.split('.')[0] || '').trim();
  if (!/^[a-z]{2}$/.test(firstLabel)) return '';
  return firstLabel.toUpperCase();
}

function normalizeExplicitRegionForPanel(region = '') {
  const text = String(region || '').trim().toUpperCase().replace(/[^A-Z]/g, '');
  return /^[A-Z]{2}$/.test(text) ? text : '';
}

function resolveIpProxyRegionFromInputs(options = {}) {
  const selectedService = normalizeIpProxyService(options?.service || DEFAULT_IP_PROXY_SERVICE);
  const selectedMode = normalizeIpProxyModeForCurrentRelease(options?.mode || DEFAULT_IP_PROXY_MODE);
  if (selectedMode !== 'account') {
    return '';
  }

  const host = String(options?.host || '').trim();
  const username = String(options?.username || '').trim();
  const region = String(options?.region || '').trim();
  if (selectedService === '711proxy') {
    const resolvedCode = typeof resolve711ProxyRegionFromInputs === 'function'
      ? resolve711ProxyRegionFromInputs({ host, username, region })
      : '';
    if (resolvedCode) {
      return String(resolvedCode || '').trim().toUpperCase();
    }
  }

  const fromUsername = inferRegionFromProxyUsernameForPanel(username);
  if (fromUsername) {
    return fromUsername;
  }
  const fromHost = inferRegionFromProxyHostForPanel(host);
  if (fromHost) {
    return fromHost;
  }
  return normalizeExplicitRegionForPanel(region);
}

function hasCurrentInputAccountListEntries() {
  if (!isIpProxyAccountListAvailable()) {
    return false;
  }
  return normalizeIpProxyAccountList(inputIpProxyAccountList?.value || '')
    .split('\n')
    .map((line) => line.trim())
    .filter(Boolean)
    .length > 0;
}

function syncIpProxyRegionInputFromCredentials(options = {}) {
  if (!inputIpProxyRegion) {
    return '';
  }
  const selectedService = normalizeIpProxyService(
    selectIpProxyService?.value || latestState?.ipProxyService || DEFAULT_IP_PROXY_SERVICE
  );
  const selectedMode = normalizeIpProxyModeForCurrentRelease(getSelectedIpProxyMode());
  if (selectedMode !== 'account' || hasCurrentInputAccountListEntries()) {
    return '';
  }
  const force = Boolean(options?.force);
  const currentRegion = String(inputIpProxyRegion.value || '').trim();
  const resolvedRegion = resolveIpProxyRegionFromInputs({
    service: selectedService,
    mode: selectedMode,
    host: inputIpProxyHost?.value || '',
    username: inputIpProxyUsername?.value || '',
    region: currentRegion,
  });
  if (!resolvedRegion) {
    return '';
  }
  const normalizedCurrent = normalizeExplicitRegionForPanel(currentRegion);
  if (force || !normalizedCurrent) {
    inputIpProxyRegion.value = resolvedRegion;
  }
  return resolvedRegion;
}

function buildCurrentIpProxyServiceProfileFromInputs() {
  const selectedService = normalizeIpProxyService(
    selectIpProxyService?.value || latestState?.ipProxyService || DEFAULT_IP_PROXY_SERVICE
  );
  const selectedMode = normalizeIpProxyMode(getSelectedIpProxyMode());
  const effectiveMode = normalizeIpProxyModeForCurrentRelease(selectedMode);
  const rawRegion = String(inputIpProxyRegion?.value || '').trim();
  const finalRegion = resolveIpProxyRegionFromInputs({
    service: selectedService,
    mode: effectiveMode,
    host: inputIpProxyHost?.value || '',
    username: inputIpProxyUsername?.value || '',
    region: rawRegion,
  }) || rawRegion;
  return normalizeIpProxyServiceProfile({
    mode: effectiveMode,
    apiUrl: inputIpProxyApiUrl?.value || '',
    accountList: isIpProxyAccountListAvailable() ? (inputIpProxyAccountList?.value || '') : '',
    accountSessionPrefix: inputIpProxyAccountSessionPrefix?.value || '',
    accountLifeMinutes: inputIpProxyAccountLifeMinutes?.value || '',
    poolTargetCount: inputIpProxyPoolTargetCount?.value || '',
    autoSyncEnabled: Boolean(inputIpProxyAutoSyncEnabled?.checked),
    autoSyncIntervalMinutes: inputIpProxyAutoSyncIntervalMinutes?.value || '',
    host: inputIpProxyHost?.value || '',
    port: inputIpProxyPort?.value || '',
    protocol: selectIpProxyProtocol?.value || '',
    username: inputIpProxyUsername?.value || '',
    password: inputIpProxyPassword?.value || '',
    region: finalRegion,
  });
}

function buildIpProxyServiceProfilesPatch(selectedService = '', state = latestState) {
  const nextService = normalizeIpProxyService(
    selectedService
    || selectIpProxyService?.value
    || state?.ipProxyService
    || DEFAULT_IP_PROXY_SERVICE
  );
  const profiles = getIpProxyServiceProfilesFromState(state || {});
  profiles[nextService] = buildCurrentIpProxyServiceProfileFromInputs();
  return normalizeIpProxyServiceProfiles(profiles, state || {});
}

function buildIpProxyStatePatchFromServiceProfile(service = '', profile = {}) {
  const normalizedService = normalizeIpProxyService(service || DEFAULT_IP_PROXY_SERVICE);
  const normalizedProfile = normalizeIpProxyServiceProfile(profile);
  return {
    ipProxyService: normalizedService,
    ipProxyMode: normalizedProfile.mode,
    ipProxyApiUrl: normalizedProfile.apiUrl,
    ipProxyAccountList: normalizedProfile.accountList,
    ipProxyAccountSessionPrefix: normalizedProfile.accountSessionPrefix,
    ipProxyAccountLifeMinutes: normalizedProfile.accountLifeMinutes,
    ipProxyPoolTargetCount: normalizedProfile.poolTargetCount,
    ipProxyAutoSyncEnabled: normalizedProfile.autoSyncEnabled,
    ipProxyAutoSyncIntervalMinutes: Number.parseInt(String(normalizedProfile.autoSyncIntervalMinutes || '15').trim(), 10) || 15,
    ipProxyHost: normalizedProfile.host,
    ipProxyPort: normalizedProfile.port,
    ipProxyProtocol: normalizedProfile.protocol,
    ipProxyUsername: normalizedProfile.username,
    ipProxyPassword: normalizedProfile.password,
    ipProxyRegion: normalizedProfile.region,
  };
}

function applyIpProxyServiceProfileToInputs(profile = {}, options = {}) {
  const { keepMode = false } = options;
  const normalizedProfile = normalizeIpProxyServiceProfile(profile);
  if (!keepMode) {
    setIpProxyMode(normalizedProfile.mode);
  }
  if (inputIpProxyApiUrl) {
    inputIpProxyApiUrl.value = normalizedProfile.apiUrl;
  }
  if (inputIpProxyAccountList) {
    inputIpProxyAccountList.value = normalizedProfile.accountList;
  }
  if (inputIpProxyAccountSessionPrefix) {
    inputIpProxyAccountSessionPrefix.value = normalizedProfile.accountSessionPrefix;
  }
  if (inputIpProxyAccountLifeMinutes) {
    inputIpProxyAccountLifeMinutes.value = normalizedProfile.accountLifeMinutes;
  }
  if (inputIpProxyPoolTargetCount) {
    inputIpProxyPoolTargetCount.value = normalizedProfile.poolTargetCount;
  }
  if (inputIpProxyAutoSyncEnabled) {
    inputIpProxyAutoSyncEnabled.checked = Boolean(normalizedProfile.autoSyncEnabled);
  }
  if (inputIpProxyAutoSyncIntervalMinutes) {
    inputIpProxyAutoSyncIntervalMinutes.value = String(normalizedProfile.autoSyncIntervalMinutes || '15');
  }
  if (inputIpProxyHost) {
    inputIpProxyHost.value = normalizedProfile.host;
  }
  if (inputIpProxyPort) {
    inputIpProxyPort.value = normalizedProfile.port;
  }
  if (selectIpProxyProtocol) {
    selectIpProxyProtocol.value = normalizedProfile.protocol;
  }
  if (inputIpProxyUsername) {
    inputIpProxyUsername.value = normalizedProfile.username;
  }
  if (inputIpProxyPassword) {
    inputIpProxyPassword.value = normalizedProfile.password;
  }
  if (inputIpProxyRegion) {
    inputIpProxyRegion.value = normalizedProfile.region;
  }
}

function getSelectedIpProxyEnabled() {
  if (inputIpProxyEnabled) {
    return Boolean(inputIpProxyEnabled.checked);
  }
  const activeButton = ipProxyEnabledButtons.find((button) => button.classList.contains('is-active'));
  return String(activeButton?.dataset?.ipProxyEnabled) === 'true';
}

function setIpProxyEnabled(enabled) {
  const nextEnabled = Boolean(enabled);
  if (inputIpProxyEnabled) {
    inputIpProxyEnabled.checked = nextEnabled;
  }
  ipProxyEnabledButtons.forEach((button) => {
    const buttonValue = String(button?.dataset?.ipProxyEnabled) === 'true';
    button.classList.toggle('is-active', buttonValue === nextEnabled);
    button.setAttribute('aria-pressed', String(buttonValue === nextEnabled));
  });
}

function getSelectedIpProxyMode() {
  const activeButton = ipProxyModeButtons.find((button) => button.classList.contains('is-active'));
  return normalizeIpProxyModeForCurrentRelease(activeButton?.dataset?.ipProxyMode || DEFAULT_IP_PROXY_MODE);
}

function setIpProxyMode(mode) {
  const nextMode = normalizeIpProxyModeForCurrentRelease(mode);
  ipProxyModeButtons.forEach((button) => {
    const buttonMode = normalizeIpProxyMode(button?.dataset?.ipProxyMode || DEFAULT_IP_PROXY_MODE);
    button.classList.toggle('is-active', buttonMode === nextMode);
    button.setAttribute('aria-pressed', String(buttonMode === nextMode));
  });
}

function getIpProxyRuntimeFieldNames(mode = DEFAULT_IP_PROXY_MODE) {
  const normalizedMode = normalizeIpProxyModeForCurrentRelease(mode);
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

function getIpProxyRuntimeSnapshot(state = latestState, mode = normalizeIpProxyModeForCurrentRelease(state?.ipProxyMode)) {
  const normalizedMode = normalizeIpProxyModeForCurrentRelease(mode);
  const fields = getIpProxyRuntimeFieldNames(normalizedMode);
  const hasAccountListConfigured = normalizedMode === 'account'
    && normalizeIpProxyAccountList(state?.ipProxyAccountList || '').split('\n').filter(Boolean).length > 0;
  const hasModePool = Array.isArray(state?.[fields.poolKey]);
  const hasModeCurrent = state?.[fields.currentKey] !== undefined && state?.[fields.currentKey] !== null;
  const hasModeIndex = state?.[fields.indexKey] !== undefined && state?.[fields.indexKey] !== null;
  const modePool = Array.isArray(state?.[fields.poolKey]) ? state[fields.poolKey] : [];
  // 账号模式在“固定账号”场景下不应读取历史 runtime 缓存，否则会出现
  // “状态显示 A 节点、当前节点显示 B 节点”的错位。
  const allowAccountRuntimeCache = normalizedMode !== 'account' || hasAccountListConfigured;
  const pool = hasModePool && allowAccountRuntimeCache ? modePool : [];
  const current = hasModeCurrent && allowAccountRuntimeCache ? state?.[fields.currentKey] : null;
  const rawIndex = hasModeIndex && allowAccountRuntimeCache ? state?.[fields.indexKey] : 0;
  const index = Number.isFinite(Number(rawIndex)) ? Math.max(0, Math.floor(Number(rawIndex))) : 0;
  return {
    mode: normalizedMode,
    ...fields,
    hasModePool: hasModePool && allowAccountRuntimeCache,
    hasModeCurrent: hasModeCurrent && allowAccountRuntimeCache,
    hasModeIndex: hasModeIndex && allowAccountRuntimeCache,
    hasAccountListConfigured,
    pool,
    current,
    index,
  };
}

function buildIpProxyRuntimeStatePatchForMode(mode = DEFAULT_IP_PROXY_MODE, response = {}) {
  const normalizedMode = normalizeIpProxyModeForCurrentRelease(mode);
  const fields = getIpProxyRuntimeFieldNames(normalizedMode);
  const patch = {};
  if (response?.pool !== undefined) {
    patch[fields.poolKey] = Array.isArray(response.pool) ? response.pool : [];
    // 兼容旧字段：始终反映当前激活模式的运行态。
    patch.ipProxyPool = patch[fields.poolKey];
  }
  if (response?.index !== undefined) {
    const index = Number.isFinite(Number(response.index)) ? Math.max(0, Math.floor(Number(response.index))) : 0;
    patch[fields.indexKey] = index;
    patch.ipProxyCurrentIndex = index;
  }
  if (response?.current !== undefined) {
    patch[fields.currentKey] = response.current || null;
    patch.ipProxyCurrent = response.current || null;
  }
  return patch;
}

function getIpProxyCurrentEntry(state = latestState) {
  const mode = normalizeIpProxyModeForCurrentRelease(state?.ipProxyMode);
  if (mode === 'account') {
    const runtime = getIpProxyRuntimeSnapshot(state, mode);
    const poolEntry = runtime.hasModePool && runtime.pool.length
      ? runtime.pool[runtime.index % runtime.pool.length]
      : null;
    const modeCurrent = runtime.hasModeCurrent ? runtime.current : null;
    const hasRuntimeEntry = Boolean(poolEntry || modeCurrent);
    const current = poolEntry || modeCurrent || {};
    const host = String(current?.host || state?.ipProxyHost || '').trim();
    const port = Number(current?.port || normalizeIpProxyPort(state?.ipProxyPort));
    if (!host || !Number.isInteger(port) || port <= 0 || port > 65535) {
      return null;
    }
    return {
      host,
      port,
      username: hasRuntimeEntry
        ? String(current?.username || '').trim()
        : String(current?.username || state?.ipProxyUsername || '').trim(),
      password: hasRuntimeEntry
        ? String(current?.password || '')
        : String(current?.password || state?.ipProxyPassword || ''),
      protocol: normalizeIpProxyProtocol(current?.protocol || state?.ipProxyProtocol),
      region: hasRuntimeEntry
        ? String(current?.region || '').trim()
        : String(current?.region || state?.ipProxyRegion || '').trim(),
      provider: normalizeIpProxyService(state?.ipProxyService),
    };
  }

  const runtime = getIpProxyRuntimeSnapshot(state, mode);
  if (runtime.pool.length) {
    const index = runtime.index % runtime.pool.length;
    const current = runtime.pool[index];
    if (current?.host && current?.port) {
      return current;
    }
  }
  const current = runtime.current;
  return current && current.host && current.port ? current : null;
}

function has711SessionTokenForPanel(username = '') {
  const text = String(username || '').trim();
  if (!text) {
    return false;
  }
  return /(?:^|[-_])session[-_:][A-Za-z0-9_-]+?(?=(?:[-_](?:sessTime|sessAuto|region|life|zone|ptype|country|area)\b)|$)/i.test(text);
}

function normalize711SessionIdForPanel(value = '') {
  return String(value || '').trim().replace(/[^A-Za-z0-9_-]/g, '').slice(0, 64);
}

function normalize711SessTimeForPanel(value = '') {
  const raw = String(value ?? '').trim();
  if (!raw) {
    return '';
  }
  const numeric = Number.parseInt(raw, 10);
  if (!Number.isInteger(numeric)) {
    return '';
  }
  return String(Math.max(1, Math.min(180, numeric)));
}

function normalize711RegionCodeForPanel(value = '') {
  const text = String(value || '').trim().toUpperCase().replace(/[^A-Z]/g, '');
  return /^[A-Z]{2}$/.test(text) ? text : '';
}

function shouldAutoSync711SessionFieldsForPanel(state = latestState) {
  const service = normalizeIpProxyService(
    selectIpProxyService?.value || state?.ipProxyService || DEFAULT_IP_PROXY_SERVICE
  );
  const mode = normalizeIpProxyModeForCurrentRelease(getSelectedIpProxyMode());
  if (service !== '711proxy' || mode !== 'account') {
    return false;
  }
  return !hasCurrentInputAccountListEntries();
}

function parse711RegionFromUsernameForPanel(username = '') {
  const text = String(username || '').trim();
  if (!text) {
    return '';
  }
  const match = text.match(/(?:^|[-_])region[-_:]?([A-Za-z]{2})\b/i);
  return normalize711RegionCodeForPanel(match ? match[1] : '');
}

function apply711RegionToUsernameForPanel(username = '', regionCode = '', options = {}) {
  const text = String(username || '').trim();
  if (!text) {
    return '';
  }

  const normalizedRegion = normalize711RegionCodeForPanel(regionCode);
  const removeWhenEmpty = Boolean(options?.removeWhenEmpty);

  if (normalizedRegion) {
    if (/(?:^|[-_])region[-_:]?[A-Za-z]{2}\b/i.test(text)) {
      return text.replace(/((?:^|[-_])region[-_:]?)([A-Za-z]{2})\b/i, `$1${normalizedRegion}`);
    }
    return `${text}-region-${normalizedRegion}`;
  }

  if (!removeWhenEmpty) {
    return text;
  }

  return String(text.replace(/(^|[-_])region[-_:]?[A-Za-z]{2}\b/ig, '$1') || '')
    .replace(/[-_]{2,}/g, '-')
    .replace(/^[-_]+|[-_]+$/g, '')
    .trim();
}

function parse711SessionConfigFromUsernameForPanel(username = '') {
  const text = String(username || '').trim();
  if (!text) {
    return { sessionId: '', sessTime: '' };
  }
  const sessionMatch = text.match(/(?:^|[-_])session[-_:]([A-Za-z0-9_-]+?)(?=(?:[-_](?:sessTime|sessAuto|region|life|zone|ptype|country|area)\b)|$)/i);
  const sessTimeMatch = text.match(/(?:^|[-_])sessTime[-_:]?(\d+)\b/i);
  const lifeMatch = text.match(/(?:^|[-_])life[-_:]?(\d+)\b/i);
  return {
    sessionId: normalize711SessionIdForPanel(sessionMatch ? sessionMatch[1] : ''),
    sessTime: normalize711SessTimeForPanel(
      sessTimeMatch ? sessTimeMatch[1] : (lifeMatch ? lifeMatch[1] : '')
    ),
  };
}

function apply711SessionConfigToUsernameForPanel(username = '', options = {}) {
  const text = String(username || '').trim();
  if (!text) {
    return '';
  }

  const sessionId = normalize711SessionIdForPanel(options?.sessionId || '');
  const sessTime = normalize711SessTimeForPanel(options?.sessTime || '');
  const removeWhenEmpty = Boolean(options?.removeWhenEmpty);
  let next = text;

  if (sessionId) {
    if (/(?:^|[-_])session[-_:][A-Za-z0-9_-]+?(?=(?:[-_](?:sessTime|sessAuto|region|life|zone|ptype|country|area)\b)|$)/i.test(next)) {
      next = next.replace(
        /((?:^|[-_])session[-_:])([A-Za-z0-9_-]+?)(?=(?:[-_](?:sessTime|sessAuto|region|life|zone|ptype|country|area)\b)|$)/i,
        `$1${sessionId}`
      );
    } else {
      next = `${next}-session-${sessionId}`;
    }
  } else if (removeWhenEmpty) {
    next = next.replace(
      /(^|[-_])session[-_:][A-Za-z0-9_-]+?(?=(?:[-_](?:sessTime|sessAuto|region|life|zone|ptype|country|area)\b)|$)/ig,
      '$1'
    );
  }

  if (sessTime) {
    if (/(?:^|[-_])sessTime[-_:]?\d+\b/i.test(next)) {
      next = next.replace(/((?:^|[-_])sessTime[-_:]?)(\d+)\b/i, `$1${sessTime}`);
    } else if (/(?:^|[-_])life[-_:]?\d+\b/i.test(next)) {
      next = next.replace(/((?:^|[-_])life[-_:]?)(\d+)\b/i, `$1${sessTime}`);
    } else {
      next = `${next}-sessTime-${sessTime}`;
    }
  } else if (removeWhenEmpty) {
    next = next.replace(/(^|[-_])sessTime[-_:]?\d+\b/ig, '$1');
    next = next.replace(/(^|[-_])life[-_:]?\d+\b/ig, '$1');
  }

  return String(next || '')
    .replace(/[-_]{2,}/g, '-')
    .replace(/^[-_]+|[-_]+$/g, '')
    .trim();
}

function sync711SessionFieldsFromUsernameForPanel(options = {}) {
  if (!shouldAutoSync711SessionFieldsForPanel(options?.state || latestState)) {
    return { updated: false, sessionId: '', sessTime: '' };
  }
  const username = String(
    options?.username !== undefined
      ? options.username
      : (inputIpProxyUsername?.value || '')
  ).trim();
  if (!username) {
    return { updated: false, sessionId: '', sessTime: '' };
  }

  const parsed = parse711SessionConfigFromUsernameForPanel(username);
  let updated = false;

  if (parsed.sessionId && inputIpProxyAccountSessionPrefix) {
    const currentSession = normalizeIpProxyAccountSessionPrefix(
      inputIpProxyAccountSessionPrefix.value || ''
    );
    if (currentSession !== parsed.sessionId) {
      inputIpProxyAccountSessionPrefix.value = parsed.sessionId;
      updated = true;
    }
  }

  if (parsed.sessTime && inputIpProxyAccountLifeMinutes) {
    const currentLife = normalizeIpProxyAccountLifeMinutes(
      inputIpProxyAccountLifeMinutes.value || ''
    );
    if (currentLife !== parsed.sessTime) {
      inputIpProxyAccountLifeMinutes.value = parsed.sessTime;
      updated = true;
    }
  }

  return {
    updated,
    sessionId: parsed.sessionId,
    sessTime: parsed.sessTime,
  };
}

function sync711RegionFieldFromUsernameForPanel(options = {}) {
  if (!shouldAutoSync711SessionFieldsForPanel(options?.state || latestState)) {
    return { updated: false, region: '' };
  }
  if (!inputIpProxyRegion) {
    return { updated: false, region: '' };
  }

  const username = String(
    options?.username !== undefined
      ? options.username
      : (inputIpProxyUsername?.value || '')
  ).trim();
  const parsedRegion = parse711RegionFromUsernameForPanel(username);
  if (!parsedRegion) {
    return { updated: false, region: '' };
  }

  const currentRegion = normalize711RegionCodeForPanel(inputIpProxyRegion.value || '');
  if (currentRegion === parsedRegion) {
    return { updated: false, region: parsedRegion };
  }
  inputIpProxyRegion.value = parsedRegion;
  return { updated: true, region: parsedRegion };
}

function sync711UsernameFromSessionFieldsForPanel(options = {}) {
  if (!shouldAutoSync711SessionFieldsForPanel(options?.state || latestState)) {
    return { updated: false, username: '' };
  }
  if (!inputIpProxyUsername) {
    return { updated: false, username: '' };
  }

  const currentUsername = String(inputIpProxyUsername.value || '').trim();
  if (!currentUsername) {
    return { updated: false, username: '' };
  }

  const sessionId = normalize711SessionIdForPanel(
    options?.sessionId !== undefined
      ? options.sessionId
      : (inputIpProxyAccountSessionPrefix?.value || '')
  );
  const lifeMinutes = normalizeIpProxyAccountLifeMinutes(
    options?.sessTime !== undefined
      ? options.sessTime
      : (inputIpProxyAccountLifeMinutes?.value || '')
  );
  const sessTime = normalize711SessTimeForPanel(lifeMinutes);
  const nextUsername = apply711SessionConfigToUsernameForPanel(currentUsername, {
    sessionId,
    sessTime,
    removeWhenEmpty: Boolean(options?.removeWhenEmpty),
  });

  if (!nextUsername || nextUsername === currentUsername) {
    return { updated: false, username: currentUsername };
  }

  inputIpProxyUsername.value = nextUsername;
  return { updated: true, username: nextUsername };
}

function sync711UsernameFromRegionForPanel(options = {}) {
  if (!shouldAutoSync711SessionFieldsForPanel(options?.state || latestState)) {
    return { updated: false, username: '' };
  }
  if (!inputIpProxyUsername) {
    return { updated: false, username: '' };
  }

  const currentUsername = String(inputIpProxyUsername.value || '').trim();
  if (!currentUsername) {
    return { updated: false, username: '' };
  }

  const rawRegion = String(
    options?.region !== undefined
      ? options.region
      : (inputIpProxyRegion?.value || '')
  ).trim();
  const normalizedRegion = normalize711RegionCodeForPanel(rawRegion);
  const nextUsername = apply711RegionToUsernameForPanel(
    currentUsername,
    normalizedRegion,
    { removeWhenEmpty: Boolean(options?.removeWhenEmpty) }
  );

  if (!nextUsername || nextUsername === currentUsername) {
    return { updated: false, username: currentUsername };
  }

  inputIpProxyUsername.value = nextUsername;
  return { updated: true, username: nextUsername };
}

function canChangeIpProxyExitWithCurrentSession(state = latestState) {
  const mode = getSelectedIpProxyMode();
  const service = normalizeIpProxyService(
    selectIpProxyService?.value || state?.ipProxyService || DEFAULT_IP_PROXY_SERVICE
  );
  if (mode !== 'account' || service !== '711proxy') {
    return false;
  }
  const currentEntry = getIpProxyCurrentEntry(state);
  const username = String(currentEntry?.username || inputIpProxyUsername?.value || '').trim();
  return has711SessionTokenForPanel(username);
}

function buildIpProxyActionHintText(options = {}) {
  const mode = normalizeIpProxyModeForCurrentRelease(options?.mode || DEFAULT_IP_PROXY_MODE);
  const poolCount = Math.max(0, Number(options?.poolCount) || 0);
  const changeAvailable = Boolean(options?.changeAvailable);
  const dynamicPoolCount = poolCount > 0 ? poolCount : 1;

  if (mode === 'api') {
    const nextPart = poolCount > 1
      ? `下一条：当前共 ${dynamicPoolCount} 条节点，切到已拉取代理池的下一条节点。`
      : `下一条：当前仅 ${dynamicPoolCount} 条节点，执行重绑复测（不保证更换出口）。`;
    return `${nextPart} Change：仅账号模式可用。`;
  }

  const nextPart = poolCount > 1
    ? `下一条：当前共 ${dynamicPoolCount} 条节点，切到代理池的下一条节点。`
    : `下一条：当前仅 ${dynamicPoolCount} 条节点，执行重绑复测（不保证更换出口）。`;
  const changePart = changeAvailable
    ? 'Change：保持当前 session 重绑链路并复测出口。'
    : 'Change：需 711 账号模式且用户名包含 session。';
  return `${nextPart} ${changePart}`;
}

function setIpProxyCurrentDisplay(text = '', hasValue = false) {
  if (!ipProxyCurrent) return;
  ipProxyCurrent.textContent = text || '暂无可用代理';
  ipProxyCurrent.title = text || '暂无可用代理';
  ipProxyCurrent.classList.toggle('has-value', Boolean(hasValue));
}

function formatIpProxyCurrentDisplay(state = latestState) {
  const mode = normalizeIpProxyModeForCurrentRelease(state?.ipProxyMode);
  if (mode === 'account') {
    const current = getIpProxyCurrentEntry(state);
    if (!current) {
      return {
        text: '账号模式：请填写代理列表，或填写 Host / Port',
        hasValue: false,
      };
    }
    return {
      text: `${current.host}:${current.port}${current.region ? ` [${current.region}]` : ''}`,
      hasValue: true,
    };
  }

  const runtime = getIpProxyRuntimeSnapshot(state, mode);
  const current = getIpProxyCurrentEntry(state);
  const count = runtime.pool.length;
  const index = runtime.index;
  if (!current) {
    return {
      text: count ? `已拉取 ${count} 条，点击“下一条”切换` : '暂无可用代理',
      hasValue: false,
    };
  }
  const region = String(current.region || '').trim();
  const label = region ? `${current.host}:${current.port} [${region}]` : `${current.host}:${current.port}`;
  return {
    text: label,
    hasValue: true,
  };
}

function extractIpProxyEndpointToken(text = '') {
  const raw = String(text || '').trim();
  if (!raw) return '';
  const match = raw.match(/^([^\s\[]+:\d+)/);
  return match ? String(match[1]).toLowerCase() : '';
}

function extractIpProxyIndexToken(text = '') {
  const raw = String(text || '').trim();
  if (!raw) return '';
  const match = raw.match(/\((\d+\s*\/\s*\d+)\)\s*$/);
  if (!match) return '';
  return String(match[1]).replace(/\s+/g, '');
}

function buildIpProxyCurrentDisplayText(display = {}, runtimeStatus = {}) {
  const rawText = String(display?.text || '').trim();
  const hasValue = Boolean(display?.hasValue);
  if (!hasValue || !rawText) {
    return rawText;
  }
  return rawText;
}

function formatIpProxyRuntimeStatus(state = latestState) {
  const enabled = Boolean(state?.ipProxyEnabled);
  const mode = normalizeIpProxyModeForCurrentRelease(state?.ipProxyMode);
  const hasAccountListConfigured = mode === 'account'
    && normalizeIpProxyAccountList(state?.ipProxyAccountList || '').split('\n').filter(Boolean).length > 0;
  const accountSourceTag = mode === 'account'
    ? (hasAccountListConfigured ? '（账号列表）' : '（固定账号）')
    : '';
  const accountSourceDetail = mode === 'account'
    ? (
      hasAccountListConfigured
        ? '当前生效来源：账号列表（固定账号字段已忽略）。'
        : '当前生效来源：固定账号字段。'
    )
    : '';
  const activeEntry = getIpProxyCurrentEntry(state);
  const applied = Boolean(state?.ipProxyApplied);
  const reason = String(state?.ipProxyAppliedReason || '').trim().toLowerCase();
  const host = String(
    state?.ipProxyAppliedHost
    || activeEntry?.host
    || (mode === 'account' ? state?.ipProxyHost : '')
    || ''
  ).trim();
  const portValue = Number(
    state?.ipProxyAppliedPort
    || activeEntry?.port
    || (mode === 'account' ? normalizeIpProxyPort(state?.ipProxyPort) : 0)
  );
  const port = Number.isInteger(portValue) && portValue > 0 && portValue <= 65535 ? portValue : 0;
  const region = String(
    state?.ipProxyAppliedRegion
    || activeEntry?.region
    || (mode === 'account' ? state?.ipProxyRegion : '')
    || ''
  ).trim();
  const endpoint = host && port > 0 ? `${host}:${port}` : '';
  const endpointWithRegion = endpoint ? `${endpoint}${region ? ` [${region}]` : ''}` : '';
  const hasAuth = Boolean(state?.ipProxyAppliedHasAuth);
  const authSuffix = hasAuth ? '（需要鉴权）' : '';
  const errorText = String(state?.ipProxyAppliedError || '').trim();
  const warningText = String(state?.ipProxyAppliedWarning || '').trim();
  const exitIp = String(state?.ipProxyAppliedExitIp || '').trim();
  const exitRegion = String(state?.ipProxyAppliedExitRegion || '').trim();
  const exitDetecting = Boolean(state?.ipProxyAppliedExitDetecting);
  const exitError = String(state?.ipProxyAppliedExitError || '').trim();
  const exitSource = String(state?.ipProxyAppliedExitSource || '').trim().toLowerCase();
  const exitSourceSuffix = exitSource === 'page_context'
    ? '（页面探测）'
    : (exitSource === 'background_fallback'
      ? '（后台兜底，可能受全局代理影响）'
      : '');
  const endpointSummary = endpointWithRegion
    ? `${endpointWithRegion}${authSuffix}`
    : (endpoint ? `${endpoint}${authSuffix}` : '');
  const exitSummary = exitIp
    ? `${exitIp}${exitRegion ? ` [${exitRegion}]` : ''}${exitSourceSuffix}`
    : (exitDetecting ? '检测中...' : '未检测到');
  const details = [accountSourceDetail, errorText, warningText, exitError]
    .map((item) => String(item || '').trim())
    .filter(Boolean)
    .join('\n');

  if (!enabled) {
    return {
      stateClass: 'state-idle',
      text: '未启用，沿用浏览器默认/全局代理。',
      details: '',
      hideCurrentDisplay: false,
    };
  }

  if (applied) {
    const statusPrefix = endpointSummary
      ? `当前代理：${endpointSummary}${accountSourceTag}`
      : '当前代理：已启用';
    const statusText = `${statusPrefix}；当前出口：${exitSummary}`;
    const briefWarning = warningText
      ? '；地区校验未通过（详情可展开查看）'
      : '';
    return {
      stateClass: warningText ? 'state-warning' : 'state-applied',
      text: `${statusText}${briefWarning}`,
      details,
      hideCurrentDisplay: true,
    };
  }

  if (reason === 'missing_proxy_entry') {
    if (errorText) {
      return {
        stateClass: 'state-warning',
        text: '已启用，但当前没有可用代理（已阻断直连）。',
        details: errorText,
        hideCurrentDisplay: false,
      };
    }
    return {
      stateClass: 'state-warning',
      text: mode === 'account'
        ? '已启用，但账号模式没有可用代理。请先填写代理列表，或填写 Host/Port。已阻断所有网站直连。'
        : '已启用，但当前没有可用代理。请先点击“拉取”获取 IP 列表。已阻断所有网站直连。',
      details: '',
      hideCurrentDisplay: false,
    };
  }
  if (reason === 'proxy_api_unavailable') {
    return {
      stateClass: 'state-error',
      text: '已启用，但当前浏览器不支持扩展代理 API，无法应用。',
      details,
      hideCurrentDisplay: false,
    };
  }
  if (reason === 'apply_failed') {
    return {
      stateClass: 'state-error',
      text: '已启用，但代理应用失败（已回退默认代理）。',
      details: errorText || details,
      hideCurrentDisplay: false,
    };
  }
  if (reason === 'connectivity_failed') {
    const prefix = endpointSummary ? `当前代理：${endpointSummary}${accountSourceTag}` : '当前代理：未知';
    const targetUnreachable = /真实目标|chatgpt\.com 不可达|target:page_context/i.test(errorText || details);
    const exitPart = exitIp ? `；当前出口：${exitSummary}` : '';
    return {
      stateClass: 'state-error',
      text: targetUnreachable && exitIp
        ? `${prefix}${exitPart}；ChatGPT 目标不可达，请切换支持 ChatGPT 的节点。`
        : `${prefix}${exitPart}；连通性失败，请切换节点或重试。`,
      details: errorText || details,
      hideCurrentDisplay: true,
    };
  }

  return {
    stateClass: 'state-warning',
    text: endpointWithRegion
      ? `已启用，等待生效：${endpointWithRegion}${authSuffix}`
      : '已启用，等待拉取并应用代理。',
    details,
    hideCurrentDisplay: false,
  };
}

function setIpProxyRuntimeStatusDisplay(status = {}) {
  if (!ipProxyRuntimeStatus || !ipProxyRuntimeText) {
    return;
  }
  const text = String(status?.text || '未启用，沿用浏览器默认/全局代理。').trim();
  const stateClass = String(status?.stateClass || 'state-idle').trim() || 'state-idle';
  ipProxyRuntimeStatus.classList.remove('state-idle', 'state-applied', 'state-warning', 'state-error');
  ipProxyRuntimeStatus.classList.add(stateClass);
  ipProxyRuntimeText.textContent = text;
  ipProxyRuntimeText.title = text;
  if (ipProxyRuntimeDot) {
    ipProxyRuntimeDot.title = text;
  }
  const runtimeMeta = ipProxyCurrent?.closest?.('.ip-proxy-runtime-meta') || null;
  if (runtimeMeta) {
    runtimeMeta.style.display = status?.hideCurrentDisplay ? 'none' : '';
  }
  const detailsText = String(status?.details || '').trim();
  if (ipProxyRuntimeDetails && ipProxyRuntimeDetailsText) {
    if (detailsText) {
      ipProxyRuntimeDetails.hidden = false;
      ipProxyRuntimeDetailsText.textContent = detailsText;
    } else {
      ipProxyRuntimeDetails.hidden = true;
      ipProxyRuntimeDetails.open = false;
      ipProxyRuntimeDetailsText.textContent = '';
    }
  }
}

function normalizeIpProxyEnabledInlineRegion(value = '') {
  const normalized = String(value || '').trim();
  return normalized ? normalized.toUpperCase() : '';
}

function setIpProxyEnabledInlineStatus(state = {}, enabled = getSelectedIpProxyEnabled()) {
  if (!ipProxyEnabledStatus || !ipProxyEnabledStatusText) {
    return;
  }
  ipProxyEnabledStatus.classList.remove('is-off', 'is-on');

  if (!enabled) {
    const text = '未开启';
    ipProxyEnabledStatus.classList.add('is-off');
    ipProxyEnabledStatusText.textContent = text;
    ipProxyEnabledStatusText.title = text;
    ipProxyEnabledStatus.title = text;
    if (ipProxyEnabledStatusDot) {
      ipProxyEnabledStatusDot.title = text;
    }
    return;
  }

  const region = normalizeIpProxyEnabledInlineRegion(state?.ipProxyAppliedExitRegion)
    || normalizeIpProxyEnabledInlineRegion(state?.ipProxyAppliedRegion)
    || normalizeIpProxyEnabledInlineRegion(state?.ipProxyRegion);
  const text = region ? `已开启 · ${region}` : '已开启';
  ipProxyEnabledStatus.classList.add('is-on');
  ipProxyEnabledStatusText.textContent = text;
  ipProxyEnabledStatusText.title = text;
  ipProxyEnabledStatus.title = text;
  if (ipProxyEnabledStatusDot) {
    ipProxyEnabledStatusDot.title = text;
  }
}

function updateIpProxyUI(state = latestState) {
  const enabled = getSelectedIpProxyEnabled();
  const showSettings = enabled && ipProxySectionExpanded;
  const mode = getSelectedIpProxyMode();
  const service = normalizeIpProxyService(selectIpProxyService?.value || state?.ipProxyService || DEFAULT_IP_PROXY_SERVICE);
  const apiModeAvailable = isIpProxyApiModeAvailable();
  const accountListAvailable = isIpProxyAccountListAvailable();
  const isApiMode = mode === 'api' && apiModeAvailable;
  const isAccountMode = mode === 'account';
  const showSessionOptions = isAccountMode && service === '711proxy';
  const hasAccountListConfigured = accountListAvailable && isAccountMode && hasCurrentInputAccountListEntries();
  const canOperate = !isAutoRunLockedPhase();
  const actionState = getIpProxyActionState();
  const actionBusy = Boolean(actionState.busy);
  const busyAction = normalizeIpProxyActionType(actionState.action);
  const runtimeState = state || latestState || {};

  if (rowIpProxyEnabled) {
    rowIpProxyEnabled.style.display = '';
  }
  if (btnToggleIpProxySection) {
    btnToggleIpProxySection.disabled = !enabled;
    btnToggleIpProxySection.textContent = showSettings ? '收起设置' : '展开设置';
    btnToggleIpProxySection.title = enabled
      ? (showSettings ? '收起 IP 代理设置' : '展开 IP 代理设置')
      : '开启 IP 代理后可展开设置';
    btnToggleIpProxySection.setAttribute('aria-expanded', String(showSettings));
  }
  if (rowIpProxyFold) {
    rowIpProxyFold.style.display = showSettings ? '' : 'none';
  }
  if (rowIpProxyService) {
    rowIpProxyService.style.display = showSettings ? '' : 'none';
  }
  if (rowIpProxyMode) {
    rowIpProxyMode.style.display = showSettings ? '' : 'none';
  }
  if (rowIpProxyLayout) {
    rowIpProxyLayout.style.display = showSettings ? '' : 'none';
  }
  if (rowIpProxyApiUrl) {
    rowIpProxyApiUrl.style.display = showSettings && apiModeAvailable && isApiMode ? '' : 'none';
  }
  if (rowIpProxyAccountList) {
    rowIpProxyAccountList.style.display = showSettings && isAccountMode && accountListAvailable ? '' : 'none';
  }
  if (rowIpProxyAccountSessionPrefix) {
    rowIpProxyAccountSessionPrefix.style.display = showSettings && showSessionOptions ? '' : 'none';
  }
  if (rowIpProxyAccountLifeMinutes) {
    rowIpProxyAccountLifeMinutes.style.display = showSettings && showSessionOptions ? '' : 'none';
  }
  if (rowIpProxyPoolTargetCount) {
    rowIpProxyPoolTargetCount.style.display = showSettings ? '' : 'none';
  }
  const autoSyncEnabledRow = typeof rowIpProxyAutoSyncEnabled !== 'undefined' ? rowIpProxyAutoSyncEnabled : null;
  const autoSyncIntervalRow = typeof rowIpProxyAutoSyncInterval !== 'undefined' ? rowIpProxyAutoSyncInterval : null;
  if (autoSyncEnabledRow) {
    autoSyncEnabledRow.style.display = showSettings ? '' : 'none';
  }
  if (autoSyncIntervalRow) {
    autoSyncIntervalRow.style.display = showSettings ? '' : 'none';
  }
  if (rowIpProxyHost) {
    rowIpProxyHost.style.display = showSettings && isAccountMode ? '' : 'none';
  }
  if (rowIpProxyPort) {
    rowIpProxyPort.style.display = showSettings && isAccountMode ? '' : 'none';
  }
  if (rowIpProxyProtocol) {
    rowIpProxyProtocol.style.display = showSettings ? '' : 'none';
  }
  if (rowIpProxyUsername) {
    rowIpProxyUsername.style.display = showSettings && isAccountMode ? '' : 'none';
  }
  if (rowIpProxyPassword) {
    rowIpProxyPassword.style.display = showSettings && isAccountMode ? '' : 'none';
  }
  if (rowIpProxyRegion) {
    rowIpProxyRegion.style.display = showSettings && isAccountMode ? '' : 'none';
  }
  if (rowIpProxyActions) {
    rowIpProxyActions.style.display = showSettings ? '' : 'none';
  }
  if (ipProxyActionButtons) {
    ipProxyActionButtons.style.display = showSettings ? '' : 'none';
  }
  if (rowIpProxyRuntimeStatus) {
    rowIpProxyRuntimeStatus.style.display = showSettings ? '' : 'none';
  }
  if (ipProxyLayout) {
    ipProxyLayout.classList.toggle('is-account-only', !apiModeAvailable);
  }
  if (selectIpProxyService) {
    selectIpProxyService.value = service;
    selectIpProxyService.disabled = true;
  }
  if (typeof updateIpProxyServiceLoginButtonState === 'function') {
    updateIpProxyServiceLoginButtonState({
      service,
      enabled,
    });
  }
  ipProxyModeButtons.forEach((button) => {
    const buttonMode = normalizeIpProxyMode(button?.dataset?.ipProxyMode || DEFAULT_IP_PROXY_MODE);
    const apiButton = buttonMode === 'api';
    button.disabled = apiButton && !apiModeAvailable;
    if (apiButton) {
      button.hidden = false;
    }
  });
  if (ipProxyApiPanel) {
    ipProxyApiPanel.classList.toggle('is-disabled', !apiModeAvailable);
    ipProxyApiPanel.setAttribute('aria-disabled', String(!apiModeAvailable));
    ipProxyApiPanel.hidden = !apiModeAvailable;
    ipProxyApiPanel.style.display = showSettings && apiModeAvailable ? '' : 'none';
  }
  if (inputIpProxyApiUrl) {
    inputIpProxyApiUrl.disabled = !enabled || !apiModeAvailable;
  }
  if (btnToggleIpProxyApiUrl) {
    btnToggleIpProxyApiUrl.disabled = !enabled || !apiModeAvailable;
  }
  if (inputIpProxyHost) {
    inputIpProxyHost.disabled = !enabled || !isAccountMode || hasAccountListConfigured;
  }
  if (inputIpProxyPort) {
    inputIpProxyPort.disabled = !enabled || !isAccountMode || hasAccountListConfigured;
  }
  if (selectIpProxyProtocol) {
    selectIpProxyProtocol.disabled = !enabled || (isAccountMode && hasAccountListConfigured);
  }
  if (inputIpProxyUsername) {
    inputIpProxyUsername.disabled = !enabled || !isAccountMode || hasAccountListConfigured;
  }
  if (inputIpProxyPassword) {
    inputIpProxyPassword.disabled = !enabled || !isAccountMode || hasAccountListConfigured;
  }
  if (btnToggleIpProxyUsername) {
    btnToggleIpProxyUsername.disabled = !enabled || !isAccountMode || hasAccountListConfigured;
  }
  if (btnToggleIpProxyPassword) {
    btnToggleIpProxyPassword.disabled = !enabled || !isAccountMode || hasAccountListConfigured;
  }
  if (inputIpProxyRegion) {
    inputIpProxyRegion.disabled = !enabled || !isAccountMode || hasAccountListConfigured;
  }
  if (inputIpProxyAccountSessionPrefix) {
    inputIpProxyAccountSessionPrefix.disabled = !enabled || !isAccountMode || hasAccountListConfigured;
  }
  if (inputIpProxyAccountLifeMinutes) {
    inputIpProxyAccountLifeMinutes.disabled = !enabled || !isAccountMode || hasAccountListConfigured;
  }
  if (inputIpProxyAccountList) {
    inputIpProxyAccountList.disabled = !enabled || !isAccountMode || !accountListAvailable;
  }
  const autoSyncEnabledInput = typeof inputIpProxyAutoSyncEnabled !== 'undefined' ? inputIpProxyAutoSyncEnabled : null;
  const autoSyncIntervalInput = typeof inputIpProxyAutoSyncIntervalMinutes !== 'undefined' ? inputIpProxyAutoSyncIntervalMinutes : null;
  if (autoSyncEnabledInput) {
    autoSyncEnabledInput.disabled = !enabled;
  }
  if (autoSyncIntervalInput) {
    const autoSyncEnabled = Boolean(autoSyncEnabledInput?.checked);
    if (!Number.isFinite(Number.parseInt(String(autoSyncIntervalInput.value || '').trim(), 10))) {
      autoSyncIntervalInput.value = '15';
    }
    autoSyncIntervalInput.disabled = !enabled || !autoSyncEnabled;
  }

  const runtimeStatus = formatIpProxyRuntimeStatus(runtimeState);
  setIpProxyRuntimeStatusDisplay(runtimeStatus);
  const currentDisplay = formatIpProxyCurrentDisplay(runtimeState);
  const currentDisplayText = buildIpProxyCurrentDisplayText(currentDisplay, runtimeStatus);
  setIpProxyCurrentDisplay(currentDisplayText, currentDisplay.hasValue);
  const runtimeSnapshot = getIpProxyRuntimeSnapshot(runtimeState, mode, service);
  const runtimePoolCount = Array.isArray(runtimeSnapshot?.pool) ? runtimeSnapshot.pool.length : 0;
  const runtimePoolCountForDisplay = runtimePoolCount > 0 ? runtimePoolCount : 1;
  const hasCurrentEntry = Boolean(getIpProxyCurrentEntry(runtimeState));
  const changeAvailable = canChangeIpProxyExitWithCurrentSession(runtimeState);
  const nextActionTitle = runtimePoolCount > 1
    ? `切换到代理池下一条节点并应用（当前共 ${runtimePoolCountForDisplay} 条）`
    : `当前仅 ${runtimePoolCountForDisplay} 条节点：重绑当前节点并复测连通性（不保证更换出口）`;

  if (btnIpProxyRefresh) {
    btnIpProxyRefresh.disabled = actionBusy || !enabled || !canOperate;
    btnIpProxyRefresh.textContent = busyAction === 'refresh'
      ? (isApiMode ? '拉取中...' : '同步中...')
      : (isApiMode ? '拉取' : '同步');
    btnIpProxyRefresh.title = isApiMode ? '拉取代理池并应用当前代理' : '同步账号代理列表并应用当前代理';
  }
  if (btnIpProxyNext) {
    btnIpProxyNext.disabled = actionBusy || !enabled || !canOperate || !hasCurrentEntry;
    btnIpProxyNext.textContent = busyAction === 'next' ? '切换中...' : '下一条';
    btnIpProxyNext.title = nextActionTitle;
  }
  if (btnIpProxyChange) {
    btnIpProxyChange.disabled = actionBusy || !enabled || !canOperate || !changeAvailable;
    btnIpProxyChange.textContent = busyAction === 'change' ? 'Change中...' : 'Change';
    btnIpProxyChange.title = changeAvailable
      ? '保持当前会话并刷新出口（仅 711 + session）'
      : '当前模式不支持 Change（需 711 账号模式且用户名包含 session）';
  }
  if (btnIpProxyProbe) {
    btnIpProxyProbe.disabled = actionBusy || !enabled || !canOperate;
    btnIpProxyProbe.textContent = busyAction === 'probe' ? '检测中...' : '检测出口';
  }
  if (btnIpProxyCheckIp) {
    btnIpProxyCheckIp.disabled = false;
    btnIpProxyCheckIp.title = '打开公网 IP 检测页';
  }
  if (ipProxyActionHint) {
    const actionHint = buildIpProxyActionHintText({
      mode,
      poolCount: runtimePoolCount,
      changeAvailable,
    });
    ipProxyActionHint.textContent = actionHint;
    ipProxyActionHint.title = actionHint;
  }
}

async function refreshIpProxyPoolByApi(options = {}) {
  const { silent = false } = options;
  const mode = normalizeIpProxyModeForCurrentRelease(getSelectedIpProxyMode());
  const response = await chrome.runtime.sendMessage({
    type: 'REFRESH_IP_PROXY_POOL',
    source: 'sidepanel',
    payload: {
      mode,
      skipExitProbe: true,
    },
  });
  if (response?.error) {
    throw new Error(response.error);
  }

  const responseMode = normalizeIpProxyModeForCurrentRelease(response?.mode || mode);
  const patch = {};
  Object.assign(patch, buildIpProxyRuntimeStatePatchForMode(responseMode, response));
  if (response?.proxyRouting && typeof response.proxyRouting === 'object') {
    patch.ipProxyApplied = Boolean(response.proxyRouting.applied);
    patch.ipProxyAppliedReason = String(response.proxyRouting.reason || '').trim().toLowerCase();
    patch.ipProxyAppliedHost = String(response.proxyRouting.host || '').trim();
    patch.ipProxyAppliedPort = Number(response.proxyRouting.port) || 0;
    patch.ipProxyAppliedRegion = String(response.proxyRouting.region || '').trim();
    patch.ipProxyAppliedHasAuth = Boolean(response.proxyRouting.hasAuth);
    patch.ipProxyAppliedProvider = normalizeIpProxyService(response.proxyRouting.provider || '');
    patch.ipProxyAppliedError = String(response.proxyRouting.error || '').trim();
    patch.ipProxyAppliedWarning = String(response.proxyRouting.warning || '').trim();
    patch.ipProxyAppliedExitIp = String(response.proxyRouting.exitIp || '').trim();
    patch.ipProxyAppliedExitRegion = String(response.proxyRouting.exitRegion || '').trim();
    patch.ipProxyAppliedExitDetecting = Boolean(response.proxyRouting.exitDetecting);
    patch.ipProxyAppliedExitError = String(response.proxyRouting.exitError || '').trim();
    patch.ipProxyAppliedExitSource = String(response.proxyRouting.exitSource || '').trim().toLowerCase();
    patch.ipProxyAppliedAt = Date.now();
  }
  if (Object.keys(patch).length) {
    syncLatestState(patch);
  }
  updateIpProxyUI(latestState);
  scheduleIpProxyExitProbe({ silent: true });

  if (!silent) {
    if (mode === 'account') {
      showToast(`已同步账号代理：${response?.display || formatIpProxyCurrentDisplay(latestState).text}`, 'success', 1800);
    } else {
      showToast(`已拉取代理池：${Number(response?.count) || 0} 条`, 'success', 1800);
    }
  }
  return response;
}

async function switchIpProxyToNext(options = {}) {
  const { silent = false } = options;
  const mode = normalizeIpProxyModeForCurrentRelease(getSelectedIpProxyMode());
  const response = await chrome.runtime.sendMessage({
    type: 'SWITCH_IP_PROXY',
    source: 'sidepanel',
    payload: {
      direction: 'next',
      mode,
      forceRefresh: false,
      skipExitProbe: true,
    },
  });
  if (response?.error) {
    throw new Error(response.error);
  }
  const responseMode = normalizeIpProxyModeForCurrentRelease(response?.mode || mode);
  const patch = {};
  Object.assign(patch, buildIpProxyRuntimeStatePatchForMode(responseMode, response));
  if (response?.proxyRouting && typeof response.proxyRouting === 'object') {
    patch.ipProxyApplied = Boolean(response.proxyRouting.applied);
    patch.ipProxyAppliedReason = String(response.proxyRouting.reason || '').trim().toLowerCase();
    patch.ipProxyAppliedHost = String(response.proxyRouting.host || '').trim();
    patch.ipProxyAppliedPort = Number(response.proxyRouting.port) || 0;
    patch.ipProxyAppliedRegion = String(response.proxyRouting.region || '').trim();
    patch.ipProxyAppliedHasAuth = Boolean(response.proxyRouting.hasAuth);
    patch.ipProxyAppliedProvider = normalizeIpProxyService(response.proxyRouting.provider || '');
    patch.ipProxyAppliedError = String(response.proxyRouting.error || '').trim();
    patch.ipProxyAppliedWarning = String(response.proxyRouting.warning || '').trim();
    patch.ipProxyAppliedExitIp = String(response.proxyRouting.exitIp || '').trim();
    patch.ipProxyAppliedExitRegion = String(response.proxyRouting.exitRegion || '').trim();
    patch.ipProxyAppliedExitDetecting = Boolean(response.proxyRouting.exitDetecting);
    patch.ipProxyAppliedExitError = String(response.proxyRouting.exitError || '').trim();
    patch.ipProxyAppliedExitSource = String(response.proxyRouting.exitSource || '').trim().toLowerCase();
    patch.ipProxyAppliedAt = Date.now();
  }
  if (Object.keys(patch).length) {
    syncLatestState(patch);
  }
  updateIpProxyUI(latestState);
  scheduleIpProxyExitProbe({ silent: true });
  if (!silent) {
    showToast(`已切换代理：${response?.display || formatIpProxyCurrentDisplay(latestState).text}`, 'success', 1800);
  }
  return response;
}

async function changeIpProxyExitBySession(options = {}) {
  const { silent = false } = options;
  const mode = normalizeIpProxyModeForCurrentRelease(getSelectedIpProxyMode());
  const response = await chrome.runtime.sendMessage({
    type: 'CHANGE_IP_PROXY_EXIT',
    source: 'sidepanel',
    payload: {
      mode,
      skipExitProbe: true,
    },
  });
  if (response?.error) {
    throw new Error(response.error);
  }
  const responseMode = normalizeIpProxyModeForCurrentRelease(response?.mode || mode);
  const patch = {};
  Object.assign(patch, buildIpProxyRuntimeStatePatchForMode(responseMode, response));
  if (response?.proxyRouting && typeof response.proxyRouting === 'object') {
    patch.ipProxyApplied = Boolean(response.proxyRouting.applied);
    patch.ipProxyAppliedReason = String(response.proxyRouting.reason || '').trim().toLowerCase();
    patch.ipProxyAppliedHost = String(response.proxyRouting.host || '').trim();
    patch.ipProxyAppliedPort = Number(response.proxyRouting.port) || 0;
    patch.ipProxyAppliedRegion = String(response.proxyRouting.region || '').trim();
    patch.ipProxyAppliedHasAuth = Boolean(response.proxyRouting.hasAuth);
    patch.ipProxyAppliedProvider = normalizeIpProxyService(response.proxyRouting.provider || '');
    patch.ipProxyAppliedError = String(response.proxyRouting.error || '').trim();
    patch.ipProxyAppliedWarning = String(response.proxyRouting.warning || '').trim();
    patch.ipProxyAppliedExitIp = String(response.proxyRouting.exitIp || '').trim();
    patch.ipProxyAppliedExitRegion = String(response.proxyRouting.exitRegion || '').trim();
    patch.ipProxyAppliedExitDetecting = Boolean(response.proxyRouting.exitDetecting);
    patch.ipProxyAppliedExitError = String(response.proxyRouting.exitError || '').trim();
    patch.ipProxyAppliedExitSource = String(response.proxyRouting.exitSource || '').trim().toLowerCase();
    patch.ipProxyAppliedAt = Date.now();
  }
  if (Object.keys(patch).length) {
    syncLatestState(patch);
  }
  updateIpProxyUI(latestState);
  scheduleIpProxyExitProbe({ silent: true });
  if (!silent) {
    showToast(`已执行 Change：${response?.display || formatIpProxyCurrentDisplay(latestState).text}`, 'success', 1800);
  }
  return response;
}

async function probeIpProxyExit(options = {}) {
  const { silent = false } = options;
  const sendMessage = typeof sendSidepanelMessage === 'function'
    ? sendSidepanelMessage
    : (message) => chrome.runtime.sendMessage(message);
  const response = await sendMessage({
    type: 'PROBE_IP_PROXY_EXIT',
    source: 'sidepanel',
    payload: {},
  });
  if (response?.error) {
    throw new Error(response.error);
  }
  const routing = response?.proxyRouting || {};
  syncLatestState({
    ipProxyApplied: Boolean(routing.applied),
    ipProxyAppliedReason: String(routing.reason || '').trim().toLowerCase(),
    ipProxyAppliedHost: String(routing.host || '').trim(),
    ipProxyAppliedPort: Number(routing.port) || 0,
    ipProxyAppliedRegion: String(routing.region || '').trim(),
    ipProxyAppliedHasAuth: Boolean(routing.hasAuth),
    ipProxyAppliedProvider: normalizeIpProxyService(routing.provider || ''),
    ipProxyAppliedError: String(routing.error || '').trim(),
    ipProxyAppliedWarning: String(routing.warning || '').trim(),
    ipProxyAppliedExitIp: String(routing.exitIp || '').trim(),
    ipProxyAppliedExitRegion: String(routing.exitRegion || '').trim(),
    ipProxyAppliedExitDetecting: Boolean(routing.exitDetecting),
    ipProxyAppliedExitError: String(routing.exitError || '').trim(),
    ipProxyAppliedExitSource: String(routing.exitSource || '').trim().toLowerCase(),
    ipProxyAppliedAt: Date.now(),
  });
  updateIpProxyUI(latestState);

  if (!silent) {
    const exitIp = String(routing?.exitIp || '').trim();
    const exitRegion = String(routing?.exitRegion || '').trim();
    const exitSource = String(routing?.exitSource || '').trim().toLowerCase();
    const sourceHint = exitSource === 'background_fallback'
      ? '（后台兜底，可能受全局代理影响）'
      : '';
    if (exitIp) {
      showToast(`出口检测成功：${exitIp}${exitRegion ? ` [${exitRegion}]` : ''}${sourceHint}`, 'success', 2600);
    } else {
      showToast('出口检测完成，但未获取到出口 IP', 'warn', 2200);
    }
  }
  return response;
}
