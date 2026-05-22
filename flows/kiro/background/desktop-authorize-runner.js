(function attachBackgroundKiroDesktopAuthorizeRunner(root, factory) {
  root.MultiPageBackgroundKiroDesktopAuthorizeRunner = factory(root);
})(typeof self !== 'undefined' ? self : globalThis, function createBackgroundKiroDesktopAuthorizeRunnerModule(root) {
  const kiroStateApi = root.MultiPageBackgroundKiroState || null;
  const desktopClientApi = root.MultiPageBackgroundKiroDesktopClient || null;
  const kiroTimeoutApi = root.MultiPageKiroTimeouts || null;
  const DEFAULT_REGION = kiroStateApi?.DEFAULT_REGION || desktopClientApi?.DEFAULT_REGION || 'us-east-1';
  const DEFAULT_KIRO_PAGE_LOAD_TIMEOUT_MS = kiroTimeoutApi?.DEFAULT_KIRO_PAGE_LOAD_TIMEOUT_MS || (3 * 60 * 1000);
  const MAIL_2925_FILTER_LOOKBACK_MS = 10 * 60 * 1000;
  const KIRO_REGISTER_PAGE_SOURCE_ID = 'kiro-register-page';
  const KIRO_DESKTOP_SOURCE_ID = 'kiro-desktop-authorize';
  const KIRO_WEB_ACCOUNT_URL = 'https://app.kiro.dev/settings/account';
  const KIRO_WEB_TAB_URL_PATTERNS = Object.freeze([
    'https://app.kiro.dev/*',
    'https://kiro.dev/*',
  ]);
  function isPlainObject(value) {
    return Boolean(value) && typeof value === 'object' && !Array.isArray(value);
  }

  function cloneValue(value) {
    if (Array.isArray(value)) {
      return value.map((entry) => cloneValue(entry));
    }
    if (isPlainObject(value)) {
      return Object.fromEntries(
        Object.entries(value).map(([key, entryValue]) => [key, cloneValue(entryValue)])
      );
    }
    return value;
  }

  function deepMerge(baseValue, patchValue) {
    if (Array.isArray(patchValue)) {
      return patchValue.map((entry) => cloneValue(entry));
    }
    if (!isPlainObject(patchValue)) {
      return patchValue === undefined ? cloneValue(baseValue) : patchValue;
    }

    const baseObject = isPlainObject(baseValue) ? baseValue : {};
    const next = {
      ...cloneValue(baseObject),
    };
    Object.entries(patchValue).forEach(([key, value]) => {
      next[key] = deepMerge(baseObject[key], value);
    });
    return next;
  }

  function cleanString(value = '') {
    return String(value ?? '').trim();
  }

  function readKiroRuntime(state = {}) {
    if (typeof kiroStateApi?.ensureRuntimeState === 'function') {
      return kiroStateApi.ensureRuntimeState(state);
    }
    return deepMerge(
      typeof kiroStateApi?.buildDefaultRuntimeState === 'function'
        ? kiroStateApi.buildDefaultRuntimeState()
        : {},
      isPlainObject(state?.runtimeState?.flowState?.kiro)
        ? state.runtimeState.flowState.kiro
        : (isPlainObject(state?.flowState?.kiro) ? state.flowState.kiro : {})
    );
  }

  function buildCanonicalRuntimePatch(currentState = {}, nextRuntimeState = {}) {
    if (typeof kiroStateApi?.buildRuntimeStatePatch === 'function') {
      return kiroStateApi.buildRuntimeStatePatch(currentState, nextRuntimeState);
    }
    const baseRuntimeState = isPlainObject(currentState?.runtimeState)
      ? cloneValue(currentState.runtimeState)
      : {};
    const baseFlowState = isPlainObject(baseRuntimeState.flowState)
      ? cloneValue(baseRuntimeState.flowState)
      : {};
    return {
      runtimeState: {
        ...baseRuntimeState,
        flowState: {
          ...baseFlowState,
          kiro: deepMerge(readKiroRuntime(currentState), nextRuntimeState),
        },
      },
    };
  }

  function mergeRuntimePatch(currentState = {}, patch = {}) {
    return buildCanonicalRuntimePatch(
      currentState,
      deepMerge(readKiroRuntime(currentState), patch)
    );
  }

  function normalizePositiveInteger(value, fallback) {
    const numeric = Math.floor(Number(value));
    if (Number.isInteger(numeric) && numeric > 0) {
      return numeric;
    }
    return fallback;
  }

  function normalizeKiroPageLoadTimeoutMs(value, fallback = DEFAULT_KIRO_PAGE_LOAD_TIMEOUT_MS) {
    if (typeof kiroTimeoutApi?.normalizeKiroPageLoadTimeoutMs === 'function') {
      return kiroTimeoutApi.normalizeKiroPageLoadTimeoutMs(value, fallback);
    }
    return normalizePositiveInteger(value, normalizePositiveInteger(fallback, DEFAULT_KIRO_PAGE_LOAD_TIMEOUT_MS));
  }

  function createTimeoutBudget(timeoutMs = DEFAULT_KIRO_PAGE_LOAD_TIMEOUT_MS) {
    const totalTimeoutMs = normalizeKiroPageLoadTimeoutMs(timeoutMs, DEFAULT_KIRO_PAGE_LOAD_TIMEOUT_MS);
    const startedAt = Date.now();
    return {
      totalTimeoutMs,
      getRemainingMs(minimumMs = 1) {
        const normalizedMinimumMs = normalizePositiveInteger(minimumMs, 1);
        return Math.max(normalizedMinimumMs, totalTimeoutMs - (Date.now() - startedAt));
      },
    };
  }

  function resolveTimeoutBudget(options = {}, fallbackTimeoutMs = DEFAULT_KIRO_PAGE_LOAD_TIMEOUT_MS) {
    if (options?.timeoutBudget && typeof options.timeoutBudget.getRemainingMs === 'function') {
      return options.timeoutBudget;
    }
    return createTimeoutBudget(
      options?.pageTimeoutMs
      ?? options?.timeoutMs
      ?? fallbackTimeoutMs
    );
  }

  function getErrorMessage(error) {
    return error instanceof Error ? error.message : String(error ?? '未知错误');
  }

  function isKiroWebUrl(rawUrl = '') {
    const normalizedUrl = cleanString(rawUrl);
    if (!normalizedUrl) {
      return false;
    }
    try {
      const parsed = new URL(normalizedUrl);
      const hostname = parsed.hostname.toLowerCase();
      return hostname === 'app.kiro.dev' || hostname === 'kiro.dev';
    } catch (_error) {
      return false;
    }
  }

  function parseDesktopCallbackUrl(rawUrl, expectedState = '', expectedPort = 0) {
    const normalizedUrl = cleanString(rawUrl);
    if (!normalizedUrl) {
      return null;
    }
    let parsed = null;
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
    if (expectedPort && Number(parsed.port || 0) !== Number(expectedPort)) {
      return null;
    }
    if (parsed.pathname !== '/oauth/callback') {
      return null;
    }
    const stateValue = cleanString(parsed.searchParams.get('state'));
    if (expectedState && stateValue && stateValue !== cleanString(expectedState)) {
      return {
        url: normalizedUrl,
        state: stateValue,
        error: `回调 state 不匹配：expected=${cleanString(expectedState)} actual=${stateValue}`,
      };
    }
    const error = cleanString(parsed.searchParams.get('error_description') || parsed.searchParams.get('error'));
    const code = cleanString(parsed.searchParams.get('code'));
    if (error) {
      return {
        url: normalizedUrl,
        state: stateValue,
        error,
      };
    }
    if (!code) {
      return null;
    }
    return {
      url: normalizedUrl,
      state: stateValue,
      code,
    };
  }

  function createDesktopCallbackTracker(chromeApi) {
    const pendingSessions = new Map();
    const resolvedSessions = new Map();
    let listenersInstalled = false;

    function installListeners() {
      if (listenersInstalled || !chromeApi) {
        return;
      }
      listenersInstalled = true;

      const handleNavigation = (details = {}) => {
        const url = cleanString(details.url);
        if (!url) {
          return;
        }
        for (const [stateKey, session] of pendingSessions.entries()) {
          const parsed = parseDesktopCallbackUrl(url, session.expectedState, session.redirectPort);
          if (!parsed) {
            continue;
          }
          const result = {
            ...parsed,
            tabId: Number.isInteger(details.tabId) ? details.tabId : (Number.isInteger(session.tabId) ? session.tabId : null),
          };
          resolvedSessions.set(stateKey, result);
          const waiters = Array.isArray(session.waiters) ? session.waiters.splice(0, session.waiters.length) : [];
          pendingSessions.set(stateKey, {
            ...session,
            resolved: result,
            waiters: [],
          });
          waiters.forEach(({ resolve }) => resolve(result));
          const targetTabId = Number.isInteger(result.tabId) ? result.tabId : (Number.isInteger(session.tabId) ? session.tabId : null);
          if (Number.isInteger(targetTabId) && chromeApi.tabs?.remove) {
            chromeApi.tabs.remove(targetTabId).catch(() => {});
          }
          break;
        }
      };

      chromeApi.webNavigation?.onBeforeNavigate?.addListener?.(handleNavigation);
      chromeApi.webNavigation?.onCommitted?.addListener?.(handleNavigation);
      chromeApi.webRequest?.onBeforeRequest?.addListener?.(
        handleNavigation,
        { urls: ['http://127.0.0.1/*', 'http://localhost/*'] }
      );
    }

    function registerPending(params = {}) {
      installListeners();
      const expectedState = cleanString(params.expectedState);
      if (!expectedState) {
        throw new Error('缺少桌面授权 state，无法注册回调监听。');
      }
      const existingResolved = resolvedSessions.get(expectedState);
      const existingPending = pendingSessions.get(expectedState);
      pendingSessions.set(expectedState, {
        expectedState,
        redirectPort: Number(params.redirectPort || 0) || 0,
        tabId: Number.isInteger(params.tabId) ? params.tabId : (existingPending?.tabId ?? null),
        waiters: existingPending?.waiters || [],
        resolved: existingResolved || existingPending?.resolved || null,
      });
      return existingResolved || null;
    }

    function consumeResolved(expectedState = '') {
      const stateKey = cleanString(expectedState);
      if (!stateKey || !resolvedSessions.has(stateKey)) {
        return null;
      }
      const result = resolvedSessions.get(stateKey) || null;
      resolvedSessions.delete(stateKey);
      pendingSessions.delete(stateKey);
      return result;
    }

    function waitForResolved(expectedState = '', timeoutMs = DEFAULT_KIRO_PAGE_LOAD_TIMEOUT_MS) {
      const stateKey = cleanString(expectedState);
      const immediate = consumeResolved(stateKey);
      if (immediate) {
        return Promise.resolve(immediate);
      }
      const session = pendingSessions.get(stateKey);
      if (!session) {
        return Promise.reject(new Error(`未注册桌面授权回调监听：${stateKey}`));
      }
      return new Promise((resolve, reject) => {
        const timer = setTimeout(() => {
          const nextSession = pendingSessions.get(stateKey);
          if (nextSession) {
            nextSession.waiters = (nextSession.waiters || []).filter((entry) => entry.reject !== reject);
            pendingSessions.set(stateKey, nextSession);
          }
          reject(new Error('等待桌面授权回调超时。'));
        }, Math.max(1000, Math.floor(Number(timeoutMs) || DEFAULT_KIRO_PAGE_LOAD_TIMEOUT_MS)));
        session.waiters.push({
          resolve: (result) => {
            clearTimeout(timer);
            resolve(result);
          },
          reject: (error) => {
            clearTimeout(timer);
            reject(error);
          },
        });
        pendingSessions.set(stateKey, session);
      });
    }

    function clear(expectedState = '') {
      const stateKey = cleanString(expectedState);
      if (!stateKey) {
        return;
      }
      const session = pendingSessions.get(stateKey);
      if (session && Array.isArray(session.waiters)) {
        session.waiters.forEach(({ reject }) => reject(new Error('桌面授权回调监听已清理。')));
      }
      pendingSessions.delete(stateKey);
      resolvedSessions.delete(stateKey);
    }

    return {
      clear,
      consumeResolved,
      registerPending,
      waitForResolved,
    };
  }

  function createKiroDesktopAuthorizeRunner(deps = {}) {
    const {
      addLog = async () => {},
      chrome = (typeof globalThis !== 'undefined' ? globalThis.chrome : null),
      completeNodeFromBackground,
      ensureContentScriptReadyOnTab = null,
      fetchImpl = typeof fetch === 'function' ? fetch.bind(globalThis) : null,
      getState = async () => ({}),
      getTabId = async () => null,
      isTabAlive = async () => false,
      maybeSubmitFlowContribution = async () => null,
      KIRO_REGISTER_INJECT_FILES = null,
      KIRO_DESKTOP_AUTHORIZE_INJECT_FILES = null,
      pollFlowVerificationCode = null,
      registerTab = async () => {},
      reuseOrCreateTab = async () => null,
      sendToContentScriptResilient = null,
      setState = async () => {},
      sleepWithStop = async (ms) => {
        await new Promise((resolve) => setTimeout(resolve, ms));
      },
      throwIfStopped = () => {},
      waitForTabStableComplete = null,
    } = deps;

    if (typeof completeNodeFromBackground !== 'function') {
      throw new Error('Kiro desktop authorize runner requires completeNodeFromBackground.');
    }
    if (!desktopClientApi) {
      throw new Error('Kiro desktop authorize runner requires desktop client module.');
    }
    if (typeof fetchImpl !== 'function') {
      throw new Error('Kiro desktop authorize runner requires fetch support.');
    }

    const callbackTracker = createDesktopCallbackTracker(chrome);

    async function log(message, level = 'info', nodeId = '') {
      await addLog(message, level, nodeId ? { nodeId } : {});
    }

    async function activateTab(tabId) {
      if (!Number.isInteger(tabId) || !chrome?.tabs?.update) {
        return;
      }
      await chrome.tabs.update(tabId, { active: true });
    }

    async function getExecutionState(state = {}) {
      if (state && typeof state === 'object' && !Array.isArray(state) && Object.keys(state).length) {
        return state;
      }
      return getState();
    }

    async function applyRuntimeState(currentState = {}, patch = {}, extraState = {}) {
      const runtimePatch = mergeRuntimePatch(currentState, patch);
      const nextPatch = {
        ...runtimePatch,
        ...extraState,
      };
      await setState(nextPatch);
      return nextPatch;
    }

    async function persistFailure(currentState = {}, message = '') {
      await setState(mergeRuntimePatch(currentState, {
        session: {
          lastError: message,
        },
        desktopAuth: {
          status: 'error',
        },
      }));
    }

    function isMissingTabError(error) {
      return /No tab with id/i.test(getErrorMessage(error));
    }

    async function finalizeDesktopAuthorizeCallback(currentState = {}, runtimeState = {}, resolvedCallback = {}, nodeId = '') {
      if (resolvedCallback?.error) {
        throw new Error(`桌面授权回调失败：${resolvedCallback.error}`);
      }

      const authorizationCode = cleanString(resolvedCallback?.code);
      if (!authorizationCode) {
        throw new Error('桌面授权回调缺少 authorization code。');
      }

      const tokenResult = await desktopClientApi.exchangeDesktopAuthorizationCode({
        region: runtimeState.desktopAuth?.region || DEFAULT_REGION,
        clientId: runtimeState.desktopAuth?.clientId,
        clientSecret: runtimeState.desktopAuth?.clientSecret,
        redirectUri: runtimeState.desktopAuth?.redirectUri,
        code: authorizationCode,
        codeVerifier: runtimeState.desktopAuth?.codeVerifier,
      }, fetchImpl);
      const payload = await applyRuntimeState(currentState, {
        session: {
          currentStage: 'upload',
          pageState: 'callback_captured',
          pageUrl: resolvedCallback.url,
          lastError: '',
        },
        desktopAuth: {
          authorizationCode,
          accessToken: tokenResult.accessToken,
          refreshToken: tokenResult.refreshToken,
          status: 'authorized',
          authorizedAt: Date.now(),
        },
        upload: {
          status: 'ready_to_upload',
          error: '',
        },
      });
      await log('步骤 8：桌面授权回调已捕获，Token 换取成功。', 'ok', nodeId);
      await completeNodeFromBackground(nodeId, payload);
      return payload;
    }

    async function ensureDesktopAuthorizeTab(state = {}, options = {}) {
      const runtimeState = readKiroRuntime(state);
      let tabId = Number.isInteger(runtimeState.session?.desktopTabId)
        ? runtimeState.session.desktopTabId
        : await getTabId(KIRO_DESKTOP_SOURCE_ID);
      const authorizeUrl = cleanString(runtimeState.desktopAuth?.authorizeUrl);

      if (Number.isInteger(tabId) && await isTabAlive(KIRO_DESKTOP_SOURCE_ID)) {
        return tabId;
      }
      if (!authorizeUrl) {
        throw new Error(options.missingUrlMessage || '缺少桌面授权地址，请先执行步骤 7。');
      }
      tabId = await reuseOrCreateTab(KIRO_DESKTOP_SOURCE_ID, authorizeUrl);
      if (!Number.isInteger(tabId)) {
        throw new Error(options.openFailedMessage || '无法打开桌面授权页，请重试步骤 7。');
      }
      await registerTab(KIRO_DESKTOP_SOURCE_ID, tabId);
      await setState(mergeRuntimePatch(state, {
        session: {
          desktopTabId: tabId,
        },
      }));
      return tabId;
    }

    async function activateDesktopAuthorizeTab(state = {}, options = {}) {
      const tabId = await ensureDesktopAuthorizeTab(state, options);
      await activateTab(tabId);
      return tabId;
    }

    async function reattachDesktopAuthorizePage(tabId, options = {}) {
      if (!Number.isInteger(tabId)) {
        throw new Error('缺少 Kiro 桌面授权页标签页，无法重新连接内容脚本。');
      }
      const timeoutBudget = resolveTimeoutBudget(options);
      if (typeof waitForTabStableComplete === 'function') {
        await waitForTabStableComplete(tabId, {
          timeoutMs: timeoutBudget.getRemainingMs(1000),
          retryDelayMs: 300,
          stableMs: Number(options.stableMs) || 1200,
          initialDelayMs: Number(options.initialDelayMs) || 120,
        });
      }
      if (typeof ensureContentScriptReadyOnTab === 'function') {
        await ensureContentScriptReadyOnTab(KIRO_DESKTOP_SOURCE_ID, tabId, {
          inject: Array.isArray(KIRO_DESKTOP_AUTHORIZE_INJECT_FILES) ? KIRO_DESKTOP_AUTHORIZE_INJECT_FILES : null,
          injectSource: KIRO_DESKTOP_SOURCE_ID,
          timeoutMs: timeoutBudget.getRemainingMs(1000),
          retryDelayMs: 800,
          logMessage: options.injectLogMessage || 'Kiro 桌面授权页已跳转，正在重新连接内容脚本...',
        });
      }
    }

    function buildDesktopRetryRecovery(tabId, options = {}) {
      return async (_error, context = {}) => {
        const remainingTimeoutMs = normalizeKiroPageLoadTimeoutMs(
          options?.timeoutBudget?.getRemainingMs?.(1000)
            ?? context?.remainingTimeoutMs,
          DEFAULT_KIRO_PAGE_LOAD_TIMEOUT_MS
        );
        await reattachDesktopAuthorizePage(tabId, {
          timeoutMs: remainingTimeoutMs,
          timeoutBudget: createTimeoutBudget(remainingTimeoutMs),
          stableMs: Number(options.recoveryStableMs) || Number(options.stableMs) || 1200,
          initialDelayMs: Number(options.recoveryInitialDelayMs) || 120,
          injectLogMessage: options.recoveryInjectLogMessage || options.injectLogMessage || 'Kiro 桌面授权页已跳转，正在重新连接内容脚本...',
        });
      };
    }

    async function getDesktopAuthorizePageState(tabId, options = {}) {
      if (!Number.isInteger(tabId)) {
        throw new Error('缺少 Kiro 桌面授权页标签页，无法继续执行。');
      }
      const pageLoadTimeoutMs = normalizeKiroPageLoadTimeoutMs(
        options.pageTimeoutMs,
        DEFAULT_KIRO_PAGE_LOAD_TIMEOUT_MS
      );
      const timeoutBudget = resolveTimeoutBudget(options, pageLoadTimeoutMs);
      if (typeof waitForTabStableComplete === 'function') {
        await waitForTabStableComplete(tabId, {
          timeoutMs: timeoutBudget.getRemainingMs(1000),
          retryDelayMs: 300,
          stableMs: Number(options.stableMs) || 1200,
          initialDelayMs: Number(options.initialDelayMs) || 120,
        });
      }
      if (typeof ensureContentScriptReadyOnTab === 'function') {
        await ensureContentScriptReadyOnTab(KIRO_DESKTOP_SOURCE_ID, tabId, {
          inject: Array.isArray(KIRO_DESKTOP_AUTHORIZE_INJECT_FILES) ? KIRO_DESKTOP_AUTHORIZE_INJECT_FILES : null,
          injectSource: KIRO_DESKTOP_SOURCE_ID,
          timeoutMs: timeoutBudget.getRemainingMs(1000),
          retryDelayMs: 800,
          logMessage: options.injectLogMessage || 'Kiro 桌面授权页内容脚本未就绪，正在等待页面恢复...',
        });
      }
      const stateWaitTimeoutMs = timeoutBudget.getRemainingMs(1000);
      const result = await sendToContentScriptResilient(KIRO_DESKTOP_SOURCE_ID, {
        type: 'GET_KIRO_DESKTOP_AUTHORIZE_STATE',
        step: options.step || 0,
        source: 'background',
      }, {
        timeoutMs: stateWaitTimeoutMs,
        retryDelayMs: 700,
        onRetryableError: buildDesktopRetryRecovery(tabId, {
          ...options,
          timeoutBudget,
        }),
        logMessage: options.readyLogMessage || '正在读取 Kiro 桌面授权页状态...',
      });
      if (result?.error) {
        throw new Error(result.error);
      }
      return result || { state: '', url: '' };
    }

    async function executeDesktopAction(tabId, action, payload = {}, options = {}) {
      const timeoutBudget = resolveTimeoutBudget(options);
      const result = await sendToContentScriptResilient(KIRO_DESKTOP_SOURCE_ID, {
        type: 'EXECUTE_KIRO_DESKTOP_AUTHORIZE_ACTION',
        step: options.step || 0,
        source: 'background',
        payload: {
          action,
          ...payload,
        },
      }, {
        timeoutMs: timeoutBudget.getRemainingMs(1000),
        retryDelayMs: 700,
        onRetryableError: buildDesktopRetryRecovery(tabId, {
          ...options,
          timeoutBudget,
        }),
        logMessage: options.logMessage || '正在执行 Kiro 桌面授权动作...',
      });
      if (result?.error) {
        throw new Error(result.error);
      }
      return result || { state: '', url: '' };
    }

    function resolveDesktopLoginPassword(state = {}) {
      const password = String(state?.customPassword || state?.password || '');
      if (!password) {
        throw new Error('缺少已注册账号密码，无法完成桌面授权重登。');
      }
      return password;
    }

    async function collectKiroWebSessionTabs(currentState = {}) {
      const runtimeState = readKiroRuntime(currentState);
      const candidates = [];
      const seen = new Set();
      const addTab = (tab) => {
        const tabId = Number(tab?.id);
        if (!Number.isInteger(tabId) || seen.has(tabId) || !isKiroWebUrl(tab?.url)) {
          return;
        }
        seen.add(tabId);
        candidates.push(tab);
      };

      const registeredTabId = runtimeState.session?.registerTabId;
      if (Number.isInteger(registeredTabId) && chrome?.tabs?.get) {
        const tab = await chrome.tabs.get(registeredTabId).catch(() => null);
        addTab(tab);
      }

      if (chrome?.tabs?.query) {
        const queryKiroTabs = async (queryInfo) => {
          const tabs = await chrome.tabs.query(queryInfo).catch(() => []);
          for (const tab of tabs || []) {
            addTab(tab);
          }
        };

        await queryKiroTabs({ url: KIRO_WEB_TAB_URL_PATTERNS });
        await queryKiroTabs({ active: true, currentWindow: true });
      }

      return candidates;
    }

    async function openKiroWebAccountSessionTab() {
      let tabId = null;
      let tabUrl = KIRO_WEB_ACCOUNT_URL;
      if (chrome?.tabs?.create) {
        const tab = await chrome.tabs.create({
          url: KIRO_WEB_ACCOUNT_URL,
          active: true,
        });
        tabId = Number(tab?.id);
        tabUrl = cleanString(tab?.url || KIRO_WEB_ACCOUNT_URL);
      } else {
        tabId = await reuseOrCreateTab(KIRO_REGISTER_PAGE_SOURCE_ID, KIRO_WEB_ACCOUNT_URL, {
          inject: Array.isArray(KIRO_REGISTER_INJECT_FILES) ? KIRO_REGISTER_INJECT_FILES : null,
          injectSource: KIRO_REGISTER_PAGE_SOURCE_ID,
        });
      }
      if (!Number.isInteger(tabId)) {
        throw new Error('无法打开 Kiro 账号页，请手动打开 app.kiro.dev/settings/account 后重试步骤 7。');
      }
      await registerTab(KIRO_REGISTER_PAGE_SOURCE_ID, tabId);
      return {
        id: tabId,
        url: tabUrl || KIRO_WEB_ACCOUNT_URL,
      };
    }

    async function readKiroWebSessionStateFromTab(tabId, options = {}) {
      const timeoutBudget = resolveTimeoutBudget(options);
      if (typeof waitForTabStableComplete === 'function') {
        await waitForTabStableComplete(tabId, {
          timeoutMs: timeoutBudget.getRemainingMs(1000),
          retryDelayMs: 300,
          stableMs: Number(options.stableMs) || 1500,
          initialDelayMs: Number(options.initialDelayMs) || 150,
        });
      }
      if (typeof ensureContentScriptReadyOnTab === 'function') {
        await ensureContentScriptReadyOnTab(KIRO_REGISTER_PAGE_SOURCE_ID, tabId, {
          inject: Array.isArray(KIRO_REGISTER_INJECT_FILES) ? KIRO_REGISTER_INJECT_FILES : null,
          injectSource: KIRO_REGISTER_PAGE_SOURCE_ID,
          timeoutMs: timeoutBudget.getRemainingMs(1000),
          retryDelayMs: 800,
          logMessage: options.injectLogMessage || '步骤 7：正在连接已登录的 Kiro Web 页面...',
        });
      }
      if (typeof sendToContentScriptResilient !== 'function') {
        return null;
      }
      const stateWaitTimeoutMs = timeoutBudget.getRemainingMs(1000);
      const result = await sendToContentScriptResilient(KIRO_REGISTER_PAGE_SOURCE_ID, {
        type: 'GET_KIRO_REGISTER_PAGE_STATE',
        step: 7,
        source: 'background',
      }, {
        timeoutMs: stateWaitTimeoutMs,
        retryDelayMs: 700,
        responseTimeoutMs: Math.min(stateWaitTimeoutMs, 10000),
        logMessage: '步骤 7：正在读取 Kiro Web 登录态...',
      });
      if (result?.error) {
        throw new Error(result.error);
      }
      return result || null;
    }

    async function restoreKiroWebSessionFromOpenTabs(currentState = {}, nodeId = '') {
      const runtimeState = readKiroRuntime(currentState);
      const existingEmail = cleanString(runtimeState.register?.email || currentState?.email);
      const registerCompleted = cleanString(runtimeState.register?.status) === 'completed';
      const webSignedIn = cleanString(runtimeState.webAuth?.status) === 'signed_in';
      if (existingEmail && registerCompleted && webSignedIn) {
        return {
          currentState,
          runtimeState,
          restored: false,
        };
      }

      const attemptedTabIds = new Set();
      let detectedSignedInWithoutEmail = false;
      let lastRecoveryError = '';
      const tryRestoreFromTab = async (tab) => {
        const tabId = Number(tab?.id);
        if (!Number.isInteger(tabId) || attemptedTabIds.has(tabId)) {
          return null;
        }
        attemptedTabIds.add(tabId);
        try {
          const pageState = await readKiroWebSessionStateFromTab(tabId, {
            timeoutMs: DEFAULT_KIRO_PAGE_LOAD_TIMEOUT_MS,
            injectLogMessage: '步骤 7：Kiro Web 页面内容脚本未就绪，正在等待页面恢复...',
          });
          if (pageState?.state !== 'kiro_web_signed_in') {
            return null;
          }
          const detectedEmail = cleanString(pageState.accountEmail || pageState.email || existingEmail);
          if (!detectedEmail) {
            detectedSignedInWithoutEmail = true;
            return null;
          }

          const restoredAt = Date.now();
          const payload = await applyRuntimeState(currentState, {
            session: {
              currentStage: 'desktop-authorize',
              registerTabId: tab.id,
              pageState: pageState.state || '',
              pageUrl: pageState.url || tab.url || '',
              lastError: '',
            },
            register: {
              email: detectedEmail,
              status: 'completed',
              completedAt: restoredAt,
            },
            webAuth: {
              status: 'signed_in',
              completedAt: restoredAt,
            },
            upload: {
              status: 'waiting_desktop_authorize',
              error: '',
            },
          }, {
            email: detectedEmail,
            accountIdentifierType: 'email',
            accountIdentifier: detectedEmail,
          });
          const nextState = {
            ...currentState,
            ...payload,
          };
          await log(`步骤 7：检测到已有 Kiro Web 登录态，已恢复账号 ${detectedEmail}，继续启动桌面授权。`, 'ok', nodeId);
          return {
            currentState: nextState,
            runtimeState: readKiroRuntime(nextState),
            restored: true,
          };
        } catch (error) {
          lastRecoveryError = getErrorMessage(error);
          console.warn('[MultiPage:kiro-desktop-authorize] restore web session failed', {
            tabId,
            url: tab?.url,
            message: lastRecoveryError,
          });
        }
        return null;
      };

      const tabs = await collectKiroWebSessionTabs(currentState);
      for (const tab of tabs) {
        const restoredSession = await tryRestoreFromTab(tab);
        if (restoredSession) {
          return restoredSession;
        }
      }

      await log('步骤 7：未能从已打开页面确认 Kiro Web 登录态，正在打开 Kiro 账号页重新确认...', 'info', nodeId);
      const accountTab = await openKiroWebAccountSessionTab();
      const restoredSession = await tryRestoreFromTab(accountTab);
      if (restoredSession) {
        return restoredSession;
      }

      if (detectedSignedInWithoutEmail) {
        throw new Error('已检测到 Kiro Web 登录态，但未能识别账号邮箱。请打开 Kiro 账号设置页后重试步骤 7。');
      }
      const detail = lastRecoveryError ? `最后一次检测错误：${lastRecoveryError}` : '';
      throw new Error(`Kiro Web 登录态尚未建立。请在自动打开的 Kiro 账号页登录后，从步骤 7 继续。${detail}`);
    }

    async function pollDesktopOtpCode(step, state = {}, nodeId = '') {
      if (typeof pollFlowVerificationCode !== 'function') {
        throw new Error('Kiro 桌面授权验证码步骤缺少共享邮件轮询能力，无法继续执行。');
      }

      const runtimeState = readKiroRuntime(state);
      const requestedAt = Math.max(0, Number(runtimeState.desktopAuth?.otpRequestedAt) || Date.now());
      const mailProvider = cleanString(state?.mailProvider).toLowerCase();
      const filterAfterTimestamp = mailProvider === '2925'
        ? Math.max(0, requestedAt - MAIL_2925_FILTER_LOOKBACK_MS)
        : requestedAt;

      return pollFlowVerificationCode({
        actionLabel: '桌面授权验证码',
        filterAfterTimestamp,
        flowId: 'kiro',
        logStep: step,
        logStepKey: 'kiro-complete-desktop-authorize',
        missingCapabilityMessage: 'Kiro 桌面授权验证码步骤缺少共享邮件轮询能力，无法继续执行。',
        nodeId: 'kiro-complete-desktop-authorize',
        notFoundMessage: `步骤 ${step}：邮箱轮询结束，但未获取到桌面授权验证码。`,
        state: {
          ...state,
          activeFlowId: 'kiro',
          flowId: 'kiro',
          visibleStep: step,
        },
        step,
      });
    }

    async function executeKiroStartDesktopAuthorize(state = {}) {
      const nodeId = String(state?.nodeId || 'kiro-start-desktop-authorize').trim();
      let currentState = await getExecutionState(state);
      try {
        const sessionState = await restoreKiroWebSessionFromOpenTabs(currentState, nodeId);
        currentState = sessionState.currentState;
        const runtimeState = sessionState.runtimeState;

        const client = await desktopClientApi.registerDesktopClient({
          region: DEFAULT_REGION,
          clientName: 'Kiro IDE',
        }, fetchImpl);
        const pkce = await desktopClientApi.generatePkcePair();
        const stateToken = cleanString(globalThis.crypto?.randomUUID?.() || `${Date.now()}-${Math.random().toString(16).slice(2)}`);
        const redirectPort = desktopClientApi.chooseRedirectPort();
        const redirectUri = desktopClientApi.buildRedirectUri(redirectPort);
        const authorizeUrl = desktopClientApi.buildAuthorizeUrl({
          region: client.region,
          clientId: client.clientId,
          redirectUri,
          state: stateToken,
          codeChallenge: pkce.codeChallenge,
        });

        callbackTracker.registerPending({
          expectedState: stateToken,
          redirectPort,
        });

        const tabId = await reuseOrCreateTab(KIRO_DESKTOP_SOURCE_ID, authorizeUrl);
        if (!Number.isInteger(tabId)) {
          throw new Error('无法打开 Kiro 桌面授权页，请重试步骤 7。');
        }
        await registerTab(KIRO_DESKTOP_SOURCE_ID, tabId);
        callbackTracker.registerPending({
          expectedState: stateToken,
          redirectPort,
          tabId,
        });

        const payload = await applyRuntimeState(currentState, {
          session: {
            currentStage: 'desktop-authorize',
            desktopTabId: tabId,
            pageState: '',
            pageUrl: authorizeUrl,
            lastError: '',
            lastWarning: '',
          },
          desktopAuth: {
            region: client.region,
            clientId: client.clientId,
            clientSecret: client.clientSecret,
            clientIdHash: client.clientIdHash,
            state: stateToken,
            codeVerifier: pkce.codeVerifier,
            codeChallenge: pkce.codeChallenge,
            redirectUri,
            redirectPort,
            authorizeUrl,
            authorizationCode: '',
            accessToken: '',
            refreshToken: '',
            status: 'waiting_callback',
            authorizedAt: 0,
            otpRequestedAt: 0,
            tokenSource: 'desktop_authorization_code_pkce',
          },
          upload: {
            status: 'waiting_desktop_authorize',
            error: '',
            credentialId: null,
            lastMessage: '',
            lastUploadedAt: 0,
          },
        });
        await activateTab(tabId);
        await log('步骤 7：Kiro 桌面授权页已打开，下一步将继续完成授权并抓取回调。', 'ok', nodeId);
        await completeNodeFromBackground(nodeId, payload);
      } catch (error) {
        const message = getErrorMessage(error);
        await persistFailure(currentState, message);
        throw error;
      }
    }

    async function executeKiroCompleteDesktopAuthorize(state = {}) {
      const nodeId = String(state?.nodeId || 'kiro-complete-desktop-authorize').trim();
      let currentState = await getExecutionState(state);
      let runtimeState = readKiroRuntime(currentState);
      const desktopState = cleanString(runtimeState.desktopAuth?.state);
      try {
        if (!desktopState) {
          throw new Error('缺少桌面授权 state，请先执行步骤 7。');
        }
        if (!cleanString(runtimeState.desktopAuth?.clientId) || !cleanString(runtimeState.desktopAuth?.clientSecret)) {
          throw new Error('缺少桌面授权客户端凭据，请先执行步骤 7。');
        }
        if (!cleanString(runtimeState.desktopAuth?.redirectUri) || !runtimeState.desktopAuth?.redirectPort) {
          throw new Error('缺少桌面授权回调地址，请先执行步骤 7。');
        }
        if (!cleanString(runtimeState.desktopAuth?.codeVerifier)) {
          throw new Error('缺少桌面授权 PKCE verifier，请先执行步骤 7。');
        }

        callbackTracker.registerPending({
          expectedState: desktopState,
          redirectPort: runtimeState.desktopAuth.redirectPort,
          tabId: runtimeState.session?.desktopTabId,
        });

        const timeoutBudget = createTimeoutBudget(DEFAULT_KIRO_PAGE_LOAD_TIMEOUT_MS);
        const deadline = Date.now() + timeoutBudget.totalTimeoutMs;
        let awaitingCallbackAfterConsent = false;
        const updateLoopState = async (patch = {}) => {
          const runtimePatch = mergeRuntimePatch(currentState, patch);
          await setState(runtimePatch);
          currentState = {
            ...currentState,
            ...runtimePatch,
          };
          runtimeState = readKiroRuntime(currentState);
          return runtimePatch;
        };

        while (Date.now() < deadline) {
          throwIfStopped();

          const resolvedCallback = callbackTracker.consumeResolved(desktopState);
          if (resolvedCallback) {
            await finalizeDesktopAuthorizeCallback(currentState, runtimeState, resolvedCallback, nodeId);
            return;
          }

          if (awaitingCallbackAfterConsent) {
            const waitedCallback = await callbackTracker.waitForResolved(
              desktopState,
              Math.min(timeoutBudget.getRemainingMs(1000), 1500)
            ).catch(() => null);
            if (waitedCallback) {
              await finalizeDesktopAuthorizeCallback(currentState, runtimeState, waitedCallback, nodeId);
              return;
            }
          }

          let tabId = null;
          if (awaitingCallbackAfterConsent) {
            tabId = await getTabId(KIRO_DESKTOP_SOURCE_ID).catch(() => null);
            if (!Number.isInteger(tabId)) {
              await sleepWithStop(1000);
              continue;
            }

            const trackedTab = await chrome?.tabs?.get?.(tabId).catch(() => null);
            if (!trackedTab) {
              await sleepWithStop(1000);
              continue;
            }

            const trackedCallback = parseDesktopCallbackUrl(
              trackedTab.url,
              desktopState,
              runtimeState.desktopAuth?.redirectPort
            );
            if (trackedCallback) {
              await finalizeDesktopAuthorizeCallback(currentState, runtimeState, trackedCallback, nodeId);
              return;
            }

            if (String(trackedTab.status || '') !== 'complete') {
              await sleepWithStop(1000);
              continue;
            }
          } else {
            tabId = await activateDesktopAuthorizeTab(currentState, {
              missingUrlMessage: '缺少桌面授权地址，请先执行步骤 7。',
              openFailedMessage: '无法恢复桌面授权页，请重新执行步骤 7。',
            });
          }

          let pageState = null;
          try {
            pageState = await getDesktopAuthorizePageState(tabId, {
              step: 8,
              timeoutBudget,
              injectLogMessage: '步骤 8：Kiro 桌面授权页内容脚本未就绪，正在等待页面恢复...',
              readyLogMessage: '步骤 8：正在读取 Kiro 桌面授权页当前状态...',
            });
          } catch (error) {
            if (awaitingCallbackAfterConsent && isMissingTabError(error)) {
              await sleepWithStop(1000);
              continue;
            }
            throw error;
          }

          await updateLoopState({
            session: {
              pageState: pageState?.state || '',
              pageUrl: pageState?.url || '',
              lastError: '',
            },
          });

          if (pageState.state === 'relogin_email') {
            const email = cleanString(runtimeState.register?.email || currentState?.email);
            await log(`步骤 8：桌面授权页要求重新输入邮箱，正在填写 ${email}...`, 'info', nodeId);
            await executeDesktopAction(tabId, 'submit-email', { email }, {
              step: 8,
              timeoutBudget,
              logMessage: '步骤 8：正在向桌面授权页提交邮箱...',
            });
            await sleepWithStop(1200);
            continue;
          }

          if (pageState.state === 'relogin_password') {
            const password = resolveDesktopLoginPassword(currentState);
            await log('步骤 8：桌面授权页要求重新输入密码，正在填写密码...', 'info', nodeId);
            await executeDesktopAction(tabId, 'submit-password', { password }, {
              step: 8,
              timeoutBudget,
              logMessage: '步骤 8：正在向桌面授权页提交密码...',
            });
            await sleepWithStop(1200);
            continue;
          }

          if (pageState.state === 'otp_page') {
            if (!runtimeState.desktopAuth?.otpRequestedAt) {
              await updateLoopState({
                desktopAuth: {
                  otpRequestedAt: Date.now(),
                  status: 'waiting_otp',
                },
              });
            }
            const codeResult = await pollDesktopOtpCode(8, currentState, nodeId);
            const code = cleanString(codeResult?.code);
            if (!code) {
              throw new Error('未获取到桌面授权验证码。');
            }
            await log(`步骤 8：已获取桌面授权验证码 ${code}，正在提交...`, 'info', nodeId);
            await executeDesktopAction(tabId, 'submit-otp', { code }, {
              step: 8,
              timeoutBudget,
              logMessage: '步骤 8：正在向桌面授权页提交验证码...',
            });
            await sleepWithStop(1200);
            continue;
          }

          if (pageState.state === 'consent_page') {
            await log('步骤 8：正在确认 Kiro 桌面授权访问...', 'info', nodeId);
            await executeDesktopAction(tabId, 'confirm-consent', {}, {
              step: 8,
              timeoutBudget,
              logMessage: '步骤 8：正在确认桌面授权访问...',
            });
            awaitingCallbackAfterConsent = true;
            await sleepWithStop(1200);
            continue;
          }

          if (pageState.state === 'callback_page') {
            const parsedCallback = parseDesktopCallbackUrl(pageState.url, desktopState, runtimeState.desktopAuth?.redirectPort);
            if (parsedCallback) {
              await finalizeDesktopAuthorizeCallback(currentState, runtimeState, parsedCallback, nodeId);
              return;
            }
          }

          await sleepWithStop(1000);
        }

        const lastResult = await callbackTracker.waitForResolved(
          desktopState,
          Math.min(timeoutBudget.getRemainingMs(1000), 2000)
        ).catch(() => null);
        if (lastResult) {
          await finalizeDesktopAuthorizeCallback(currentState, runtimeState, lastResult, nodeId);
          return;
        }

        throw new Error('等待桌面授权回调超时。');
      } catch (error) {
        callbackTracker.clear(desktopState);
        const message = getErrorMessage(error);
        await persistFailure(currentState, message);
        throw error;
      }
    }

    return {
      executeKiroCompleteDesktopAuthorize,
      executeKiroStartDesktopAuthorize,
      parseDesktopCallbackUrl,
    };
  }

  return {
    createDesktopCallbackTracker,
    createKiroDesktopAuthorizeRunner,
    parseDesktopCallbackUrl,
  };
});
