(function attachBackgroundKiroRegisterRunner(root, factory) {
  root.MultiPageBackgroundKiroRegisterRunner = factory(root);
})(typeof self !== 'undefined' ? self : globalThis, function createBackgroundKiroRegisterRunnerModule(root) {
  const kiroStateApi = root.MultiPageBackgroundKiroState || null;
  const kiroTimeoutApi = root.MultiPageKiroTimeouts || null;
  const DEFAULT_REGION = kiroStateApi?.DEFAULT_REGION || 'us-east-1';
  const DEFAULT_TARGET_ID = kiroStateApi?.DEFAULT_TARGET_ID || 'kiro-rs';
  const DEFAULT_KIRO_PAGE_LOAD_TIMEOUT_MS = kiroTimeoutApi?.DEFAULT_KIRO_PAGE_LOAD_TIMEOUT_MS || (3 * 60 * 1000);
  const KIRO_SIGNIN_URL = 'https://app.kiro.dev/signin';
  const KIRO_REGISTER_PAGE_SOURCE_ID = 'kiro-register-page';
  const KIRO_STEP1_COOKIE_CLEAR_DOMAINS = Object.freeze([
    'kiro.dev',
    'app.kiro.dev',
    'awsapps.com',
    'view.awsapps.com',
    'login.awsapps.com',
    'amazonaws.com',
    'signin.aws',
    'signin.aws.amazon.com',
    'profile.aws',
    'profile.aws.amazon.com',
  ]);
  const KIRO_STEP1_COOKIE_CLEAR_ORIGINS = Object.freeze([
    'https://app.kiro.dev',
    'https://kiro.dev',
    'https://view.awsapps.com',
    'https://login.awsapps.com',
    'https://oidc.us-east-1.amazonaws.com',
    'https://signin.aws',
    'https://signin.aws.amazon.com',
    'https://profile.aws',
    'https://profile.aws.amazon.com',
  ]);
  const MAIL_2925_FILTER_LOOKBACK_MS = 10 * 60 * 1000;
  const KIRO_REGISTER_PAGE_STATES = Object.freeze([
    'kiro_signin_page',
    'email_entry',
    'name_entry',
    'register_otp_page',
    'create_password_page',
    'authorization_page',
    'success_page',
    'kiro_web_signed_in',
    'login_password_page',
    'login_otp_page',
  ]);
  const KIRO_REGISTER_EXISTING_ACCOUNT_STATES = Object.freeze([
    'login_password_page',
    'login_otp_page',
  ]);
  const KIRO_REGISTER_AFTER_EMAIL_STATES = Object.freeze([
    'name_entry',
    'register_otp_page',
    'create_password_page',
    'authorization_page',
    'success_page',
    'kiro_web_signed_in',
  ]);
  const KIRO_REGISTER_AFTER_NAME_STATES = Object.freeze([
    'register_otp_page',
    'create_password_page',
    'authorization_page',
    'success_page',
    'kiro_web_signed_in',
  ]);
  const KIRO_REGISTER_AFTER_OTP_STATES = Object.freeze([
    'create_password_page',
    'authorization_page',
    'success_page',
    'kiro_web_signed_in',
  ]);
  const KIRO_REGISTER_AFTER_PASSWORD_STATES = Object.freeze([
    'authorization_page',
    'success_page',
    'kiro_web_signed_in',
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

  function getErrorMessage(error) {
    return error instanceof Error ? error.message : String(error ?? '未知错误');
  }

  function normalizeKiroCookieDomain(domain = '') {
    return String(domain || '').trim().replace(/^\.+/, '').toLowerCase();
  }

  function matchesKiroNamedHostFamily(domain = '', family = '') {
    const normalizedDomain = normalizeKiroCookieDomain(domain);
    const normalizedFamily = normalizeKiroCookieDomain(family);
    if (!normalizedDomain || !normalizedFamily) {
      return false;
    }
    return normalizedDomain === normalizedFamily
      || normalizedDomain.endsWith(`.${normalizedFamily}`)
      || normalizedDomain.startsWith(`${normalizedFamily}.`)
      || normalizedDomain.includes(`.${normalizedFamily}.`);
  }

  function shouldClearKiroStep1Cookie(cookie) {
    const domain = normalizeKiroCookieDomain(cookie?.domain);
    if (!domain) {
      return false;
    }
    return KIRO_STEP1_COOKIE_CLEAR_DOMAINS.some((target) => (
      domain === target
      || domain.endsWith(`.${target}`)
      || matchesKiroNamedHostFamily(domain, target)
    ));
  }

  function buildKiroStep1CookieRemovalUrl(cookie) {
    const host = normalizeKiroCookieDomain(cookie?.domain);
    const rawPath = String(cookie?.path || '/');
    const path = rawPath.startsWith('/') ? rawPath : `/${rawPath}`;
    return `https://${host}${path}`;
  }

  async function collectKiroStep1Cookies(chromeApi) {
    if (!chromeApi?.cookies?.getAll) {
      return [];
    }

    const stores = chromeApi.cookies.getAllCookieStores
      ? await chromeApi.cookies.getAllCookieStores()
      : [{ id: undefined }];
    const cookies = [];
    const seen = new Set();

    for (const store of stores) {
      const storeId = store?.id;
      const batch = await chromeApi.cookies.getAll(storeId ? { storeId } : {});
      for (const cookie of batch || []) {
        if (!shouldClearKiroStep1Cookie(cookie)) {
          continue;
        }
        const key = [
          cookie.storeId || storeId || '',
          cookie.domain || '',
          cookie.path || '',
          cookie.name || '',
          cookie.partitionKey ? JSON.stringify(cookie.partitionKey) : '',
        ].join('|');
        if (seen.has(key)) {
          continue;
        }
        seen.add(key);
        cookies.push(cookie);
      }
    }

    return cookies;
  }

  function shouldReadKiroWebCookie(cookie) {
    const domain = normalizeKiroCookieDomain(cookie?.domain);
    return domain === 'kiro.dev'
      || domain === 'app.kiro.dev'
      || domain.endsWith('.app.kiro.dev');
  }

  async function collectKiroWebCookies(chromeApi) {
    if (!chromeApi?.cookies?.getAll) {
      return [];
    }

    const stores = chromeApi.cookies.getAllCookieStores
      ? await chromeApi.cookies.getAllCookieStores()
      : [{ id: undefined }];
    const cookies = [];
    const seen = new Set();

    for (const store of stores) {
      const storeId = store?.id;
      const batch = await chromeApi.cookies.getAll(storeId ? { storeId } : {});
      for (const cookie of batch || []) {
        if (!shouldReadKiroWebCookie(cookie)) {
          continue;
        }
        const key = [
          cookie.storeId || storeId || '',
          cookie.domain || '',
          cookie.path || '',
          cookie.name || '',
          cookie.partitionKey ? JSON.stringify(cookie.partitionKey) : '',
        ].join('|');
        if (seen.has(key)) {
          continue;
        }
        seen.add(key);
        cookies.push(cookie);
      }
    }

    return cookies;
  }

  async function captureKiroWebAuthSummary() {
    const cookies = await collectKiroWebCookies(chrome);
    const names = new Set(cookies.map((cookie) => cleanString(cookie?.name).toLowerCase()).filter(Boolean));
    return {
      hasAccessToken: names.has('accesstoken') || names.has('access_token'),
      hasSessionToken: names.has('sessiontoken') || names.has('session_token'),
    };
  }

  async function removeKiroStep1Cookie(chromeApi, cookie) {
    const details = {
      url: buildKiroStep1CookieRemovalUrl(cookie),
      name: cookie.name,
    };
    if (cookie.storeId) {
      details.storeId = cookie.storeId;
    }
    if (cookie.partitionKey) {
      details.partitionKey = cookie.partitionKey;
    }

    try {
      const result = await chromeApi.cookies.remove(details);
      return Boolean(result);
    } catch (error) {
      console.warn('[MultiPage:kiro-register] remove cookie failed', {
        domain: cookie?.domain,
        name: cookie?.name,
        message: getErrorMessage(error),
      });
      return false;
    }
  }

  function createKiroRegisterRunner(deps = {}) {
    const {
      addLog = async () => {},
      chrome = (typeof globalThis !== 'undefined' ? globalThis.chrome : null),
      completeNodeFromBackground,
      ensureContentScriptReadyOnTab = null,
      generatePassword = null,
      generateRandomName = null,
      getState = async () => ({}),
      getTabId = async () => null,
      isTabAlive = async () => false,
      KIRO_REGISTER_INJECT_FILES = null,
      pollFlowVerificationCode = null,
      registerTab = async () => {},
      resolveSignupEmailForFlow = null,
      reuseOrCreateTab = async () => null,
      sendToContentScriptResilient = null,
      setPasswordState = async () => {},
      setState = async () => {},
      sleepWithStop = async (ms) => {
        await new Promise((resolve) => setTimeout(resolve, ms));
      },
      throwIfStopped = () => {},
      waitForTabStableComplete = null,
    } = deps;

    if (typeof completeNodeFromBackground !== 'function') {
      throw new Error('Kiro register runner requires completeNodeFromBackground.');
    }

    async function log(message, level = 'info', nodeId = '') {
      await addLog(message, level, nodeId ? { nodeId } : {});
    }

    async function activateTab(tabId) {
      if (!Number.isInteger(tabId) || !chrome?.tabs?.update) {
        return;
      }
      await chrome.tabs.update(tabId, { active: true });
    }

    async function isSpecificTabAlive(tabId) {
      if (!Number.isInteger(tabId) || !chrome?.tabs?.get) {
        return false;
      }
      return Boolean(await chrome.tabs.get(tabId).catch(() => null));
    }

    function isKiroRegisterCandidateUrl(rawUrl = '') {
      let parsed = null;
      try {
        parsed = new URL(String(rawUrl || '').trim());
      } catch (_error) {
        return false;
      }
      if (!['http:', 'https:'].includes(parsed.protocol)) {
        return false;
      }
      const hostname = parsed.hostname.toLowerCase();
      return hostname === 'app.kiro.dev'
        || hostname === 'kiro.dev'
        || hostname === 'view.awsapps.com'
        || hostname === 'login.awsapps.com'
        || hostname === 'profile.aws.amazon.com'
        || hostname === 'profile.aws'
        || hostname.endsWith('.profile.aws.amazon.com')
        || hostname.endsWith('.profile.aws')
        || hostname === 'signin.aws.amazon.com'
        || hostname === 'signin.aws'
        || hostname.endsWith('.signin.aws.amazon.com')
        || hostname.endsWith('.signin.aws');
    }

    async function getActiveKiroRegisterTabId() {
      if (!chrome?.tabs?.query) {
        return null;
      }
      const queryAttempts = [
        { active: true, lastFocusedWindow: true },
        { active: true, currentWindow: true },
        { active: true },
      ];
      for (const queryInfo of queryAttempts) {
        const tabs = await chrome.tabs.query(queryInfo).catch(() => []);
        const matchedTab = (Array.isArray(tabs) ? tabs : []).find((tab) => (
          Number.isInteger(tab?.id) && isKiroRegisterCandidateUrl(tab?.url)
        ));
        if (Number.isInteger(matchedTab?.id)) {
          return matchedTab.id;
        }
      }
      return null;
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

    async function persistFailure(currentState = {}, message = '', extraPatch = {}) {
      const runtimeState = readKiroRuntime(currentState);
      const stage = runtimeState.session?.currentStage || 'register';
      const status = runtimeState.register?.status || '';
      const patch = mergeRuntimePatch(currentState, {
        session: {
          currentStage: stage,
          lastError: message,
        },
        register: {
          status: status || 'error',
        },
      });
      await setState({
        ...patch,
        ...extraPatch,
      });
    }

    async function clearKiroCookiesBeforeStep1() {
      if (!chrome?.cookies?.getAll || !chrome.cookies?.remove) {
        await log('步骤 1：当前浏览器不支持 cookies API，跳过打开 Kiro 注册页前的 cookie 清理。', 'warn');
        return;
      }

      await log('步骤 1：打开 Kiro 注册页前清理 AWS Builder ID 相关 cookies...', 'info');
      const cookies = await collectKiroStep1Cookies(chrome);
      let removedCount = 0;
      for (const cookie of cookies) {
        if (await removeKiroStep1Cookie(chrome, cookie)) {
          removedCount += 1;
        }
      }

      if (chrome.browsingData?.removeCookies) {
        try {
          await chrome.browsingData.removeCookies({
            since: 0,
            origins: KIRO_STEP1_COOKIE_CLEAR_ORIGINS,
          });
        } catch (error) {
          await log(`步骤 1：browsingData 补扫 cookies 失败：${getErrorMessage(error)}`, 'warn');
        }
      }

      await log(`步骤 1：已清理 ${removedCount} 个 AWS Builder ID 相关 cookies。`, 'ok');
    }

    async function ensureKiroRegisterTab(state = {}, options = {}) {
      const runtimeState = readKiroRuntime(state);
      let tabId = Number.isInteger(runtimeState.session?.registerTabId)
        ? runtimeState.session.registerTabId
        : await getTabId(KIRO_REGISTER_PAGE_SOURCE_ID);
      const loginUrl = cleanString(runtimeState.register?.loginUrl);

      if (Number.isInteger(tabId) && await isSpecificTabAlive(tabId)) {
        await registerTab(KIRO_REGISTER_PAGE_SOURCE_ID, tabId);
        return tabId;
      }

      const activeKiroTabId = await getActiveKiroRegisterTabId();
      if (Number.isInteger(activeKiroTabId)) {
        await registerTab(KIRO_REGISTER_PAGE_SOURCE_ID, activeKiroTabId);
        await setState(mergeRuntimePatch(state, {
          session: {
            registerTabId: activeKiroTabId,
          },
        }));
        return activeKiroTabId;
      }

      if (!loginUrl) {
        throw new Error(options.missingUrlMessage || '缺少 Kiro 注册页地址，请先执行步骤 1。');
      }

      tabId = await reuseOrCreateTab(KIRO_REGISTER_PAGE_SOURCE_ID, loginUrl);
      if (!Number.isInteger(tabId)) {
        throw new Error(options.openFailedMessage || '无法打开 Kiro 注册页，请重试步骤 1。');
      }
      await registerTab(KIRO_REGISTER_PAGE_SOURCE_ID, tabId);
      await setState(mergeRuntimePatch(state, {
        session: {
          registerTabId: tabId,
        },
      }));
      return tabId;
    }

    async function activateKiroRegisterTab(state = {}, options = {}) {
      const tabId = await ensureKiroRegisterTab(state, options);
      await activateTab(tabId);
      return tabId;
    }

    async function injectKiroRegisterContentScripts(tabId) {
      if (
        !Number.isInteger(tabId)
        || !chrome?.scripting?.executeScript
        || !Array.isArray(KIRO_REGISTER_INJECT_FILES)
        || !KIRO_REGISTER_INJECT_FILES.length
      ) {
        return false;
      }

      await chrome.scripting.executeScript({
        target: { tabId },
        func: (injectedSource) => {
          window.__MULTIPAGE_SOURCE = injectedSource;
        },
        args: [KIRO_REGISTER_PAGE_SOURCE_ID],
      });
      await chrome.scripting.executeScript({
        target: { tabId },
        files: KIRO_REGISTER_INJECT_FILES,
      });
      await sleepWithStop(250);
      return true;
    }

    function hasKiroRegisterPageState(result = {}) {
      return Boolean(result && typeof result === 'object' && cleanString(result.state));
    }

    async function sendKiroStateDriverMessage(tabId, message, options = {}) {
      const {
        timeoutBudget,
        timeoutMs = 30000,
      } = options;
      let result = await sendToContentScriptResilient(KIRO_REGISTER_PAGE_SOURCE_ID, message, {
        timeoutMs,
        retryDelayMs: 700,
        onRetryableError: buildKiroRetryRecovery(tabId, {
          ...options,
          timeoutBudget,
        }),
        logMessage: options.readyLogMessage || '正在等待 Kiro 页面进入下一状态...',
      });

      if (!hasKiroRegisterPageState(result) && !result?.error) {
        await log('Kiro 注册页通用脚本已响应，但专用页面识别脚本未返回状态，正在重新注入 Kiro 注册页识别脚本...', 'warn');
        await injectKiroRegisterContentScripts(tabId);
        result = await sendToContentScriptResilient(KIRO_REGISTER_PAGE_SOURCE_ID, message, {
          timeoutMs: timeoutBudget?.getRemainingMs?.(1000) || timeoutMs,
          retryDelayMs: 700,
          onRetryableError: buildKiroRetryRecovery(tabId, {
            ...options,
            timeoutBudget,
          }),
          logMessage: options.readyLogMessage || '正在等待 Kiro 页面进入下一状态...',
        });
      }

      if (result?.error) {
        throw new Error(result.error);
      }
      if (!hasKiroRegisterPageState(result)) {
        throw new Error('Kiro 注册页专用页面识别脚本未返回页面状态，请刷新当前 AWS 页面或重新执行当前步骤。');
      }
      return result;
    }

    async function reattachKiroRegisterPage(tabId, options = {}) {
      if (!Number.isInteger(tabId)) {
        throw new Error('缺少 Kiro 注册页标签页，无法重新连接内容脚本。');
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
        await ensureContentScriptReadyOnTab(KIRO_REGISTER_PAGE_SOURCE_ID, tabId, {
          inject: Array.isArray(KIRO_REGISTER_INJECT_FILES) ? KIRO_REGISTER_INJECT_FILES : null,
          injectSource: KIRO_REGISTER_PAGE_SOURCE_ID,
          timeoutMs: timeoutBudget.getRemainingMs(1000),
          retryDelayMs: 800,
          logMessage: options.injectLogMessage || 'Kiro 注册页已跳转，正在重新连接内容脚本...',
        });
      }
    }

    function buildKiroRetryRecovery(tabId, options = {}) {
      return async (_error, context = {}) => {
        const remainingTimeoutMs = normalizeKiroPageLoadTimeoutMs(
          options?.timeoutBudget?.getRemainingMs?.(1000)
            ?? context?.remainingTimeoutMs,
          DEFAULT_KIRO_PAGE_LOAD_TIMEOUT_MS
        );
        await reattachKiroRegisterPage(tabId, {
          timeoutMs: remainingTimeoutMs,
          timeoutBudget: createTimeoutBudget(remainingTimeoutMs),
          stableMs: Number(options.recoveryStableMs) || Number(options.stableMs) || 1200,
          initialDelayMs: Number(options.recoveryInitialDelayMs) || 120,
          injectLogMessage: options.recoveryInjectLogMessage || options.injectLogMessage || 'Kiro 注册页已跳转，正在重新连接内容脚本...',
        });
      };
    }

    async function ensureKiroPageState(tabId, options = {}) {
      if (!Number.isInteger(tabId)) {
        throw new Error('缺少 Kiro 注册页标签页，无法继续执行。');
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
          logMessage: options.injectLogMessage || 'Kiro 注册页内容脚本未就绪，正在等待页面恢复...',
        });
      }
      if (typeof sendToContentScriptResilient !== 'function') {
        return {
          state: Array.isArray(options.targetStates) ? options.targetStates[0] || '' : '',
          url: '',
        };
      }
      const stateWaitTimeoutMs = timeoutBudget.getRemainingMs(1000);
      const message = {
        type: 'ENSURE_KIRO_PAGE_STATE',
        step: options.step || 0,
        source: 'background',
        payload: {
          targetStates: Array.isArray(options.targetStates) ? options.targetStates : [],
          timeoutMs: stateWaitTimeoutMs,
          retryDelayMs: Number(options.pageRetryDelayMs) || 250,
          timeoutMessage: options.timeoutMessage || '',
        },
      };

      return sendKiroStateDriverMessage(tabId, message, {
        ...options,
        timeoutBudget,
        timeoutMs: stateWaitTimeoutMs,
      });
    }

    async function waitForKiroPageChange(tabId, options = {}) {
      if (!Number.isInteger(tabId)) {
        throw new Error('缺少 Kiro 注册页标签页，无法继续执行。');
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
        await ensureContentScriptReadyOnTab(KIRO_REGISTER_PAGE_SOURCE_ID, tabId, {
          inject: Array.isArray(KIRO_REGISTER_INJECT_FILES) ? KIRO_REGISTER_INJECT_FILES : null,
          injectSource: KIRO_REGISTER_PAGE_SOURCE_ID,
          timeoutMs: timeoutBudget.getRemainingMs(1000),
          retryDelayMs: 800,
          logMessage: options.injectLogMessage || 'Kiro 注册页切换中，正在等待页面恢复...',
        });
      }
      if (typeof sendToContentScriptResilient !== 'function') {
        return { state: '', url: '' };
      }
      const stateWaitTimeoutMs = timeoutBudget.getRemainingMs(1000);
      const message = {
        type: 'ENSURE_KIRO_STATE_CHANGE',
        step: options.step || 0,
        source: 'background',
        payload: {
          fromStates: Array.isArray(options.fromStates) ? options.fromStates : [],
          timeoutMs: stateWaitTimeoutMs,
          retryDelayMs: Number(options.pageRetryDelayMs) || 250,
          returnOnCodeInvalid: Boolean(options.returnOnCodeInvalid),
          timeoutMessage: options.timeoutMessage || '',
        },
      };
      return sendKiroStateDriverMessage(tabId, message, {
        ...options,
        timeoutBudget,
        timeoutMs: stateWaitTimeoutMs,
        readyLogMessage: options.readyLogMessage || '正在等待 Kiro 页面完成跳转...',
      });
    }

    async function readKiroRegisterPageState(tabId, options = {}) {
      return ensureKiroPageState(tabId, {
        ...options,
        targetStates: KIRO_REGISTER_PAGE_STATES,
      });
    }

    function isKiroExistingAccountState(pageState = '') {
      return KIRO_REGISTER_EXISTING_ACCOUNT_STATES.includes(cleanString(pageState));
    }

    function resolveKiroRegisterEmail(currentState = {}, _pageState = {}, fallbackEmail = '') {
      return cleanString(
        fallbackEmail
        || currentState?.email
        || currentState?.registrationEmailState?.current
        || currentState?.registrationEmailState?.previous
      ).toLowerCase();
    }

    function createKiroExistingAccountError(pageState = {}, currentState = {}, step = 0, fallbackEmail = '') {
      const email = resolveKiroRegisterEmail(currentState, pageState, fallbackEmail);
      const emailText = email ? ` ${email}` : '';
      return new Error(
        `步骤 ${step}：邮箱${emailText} 已进入 AWS Builder ID 登录页，说明该邮箱已存在或被 AWS 判定为已有账号；Kiro 注册流程只处理新账号注册，已停止，请换新邮箱重试。`
      );
    }

    function assertKiroRegistrationOnlyState(pageState = {}, currentState = {}, step = 0, fallbackEmail = '') {
      if (isKiroExistingAccountState(pageState?.state)) {
        throw createKiroExistingAccountError(pageState, currentState, step, fallbackEmail);
      }
    }

    function getKiroRegisterStatusForPageState(pageState = '') {
      switch (cleanString(pageState)) {
        case 'email_entry':
          return 'waiting_email';
        case 'name_entry':
          return 'waiting_name';
        case 'register_otp_page':
          return 'waiting_otp';
        case 'create_password_page':
          return 'waiting_password';
        case 'authorization_page':
          return 'waiting_consent';
        case 'success_page':
        case 'kiro_web_signed_in':
          return 'completed';
        default:
          return '';
      }
    }

    function buildKiroRegisterStatePatch(currentState = {}, pageState = {}, options = {}) {
      const resolvedEmail = resolveKiroRegisterEmail(currentState, pageState, options.email);
      const nextStatus = cleanString(options.status) || getKiroRegisterStatusForPageState(pageState?.state);
      const registerPatch = {};
      if (resolvedEmail) {
        registerPatch.email = resolvedEmail;
      }
      if (options.fullName !== undefined) {
        registerPatch.fullName = cleanString(options.fullName);
      }
      if (options.verificationRequestedAt !== undefined) {
        registerPatch.verificationRequestedAt = Math.max(0, Number(options.verificationRequestedAt) || 0);
      }
      if (nextStatus) {
        registerPatch.status = nextStatus;
        registerPatch.completedAt = nextStatus === 'completed' ? Date.now() : 0;
      }

      return {
        session: {
          currentStage: nextStatus === 'completed' ? 'desktop-authorize' : 'register',
          pageState: pageState?.state || '',
          pageUrl: pageState?.url || '',
          lastError: '',
        },
        register: registerPatch,
        upload: {
          status: nextStatus === 'completed' ? 'waiting_desktop_authorize' : 'waiting_register',
          error: '',
        },
      };
    }

    async function adoptKiroRegisterPageState(currentState = {}, pageState = {}, nodeId = '', options = {}) {
      const payload = await applyRuntimeState(
        currentState,
        buildKiroRegisterStatePatch(currentState, pageState, options)
      );
      await completeNodeFromBackground(nodeId, {
        ...payload,
        email: resolveKiroRegisterEmail(currentState, pageState, options.email),
        accountIdentifierType: 'email',
        accountIdentifier: resolveKiroRegisterEmail(currentState, pageState, options.email),
      });
      return payload;
    }

    function resolveKiroFullName(state = {}) {
      const runtimeState = readKiroRuntime(state);
      const cachedName = cleanString(runtimeState.register?.fullName);
      if (cachedName) {
        return cachedName;
      }
      if (typeof generateRandomName !== 'function') {
        throw new Error('Kiro 姓名步骤缺少随机姓名能力，无法继续执行。');
      }
      const generated = generateRandomName();
      if (typeof generated === 'string') {
        const normalized = cleanString(generated);
        if (normalized) {
          return normalized;
        }
      }
      const firstName = cleanString(generated?.firstName);
      const lastName = cleanString(generated?.lastName);
      const fullName = cleanString(`${firstName} ${lastName}`);
      if (!fullName) {
        throw new Error('Kiro 姓名步骤未生成有效姓名。');
      }
      return fullName;
    }

    function resolveKiroPassword(state = {}) {
      const existingPassword = String(state?.customPassword || state?.password || '');
      if (existingPassword) {
        return {
          password: existingPassword,
          mode: state?.customPassword ? 'custom' : 'reused',
        };
      }
      if (typeof generatePassword !== 'function') {
        throw new Error('Kiro 密码步骤缺少公共密码生成能力，无法继续执行。');
      }
      return {
        password: String(generatePassword() || ''),
        mode: 'generated',
      };
    }

    async function pollKiroVerificationCode(step, state = {}, nodeId = '') {
      if (typeof pollFlowVerificationCode !== 'function') {
        throw new Error('Kiro 验证码步骤缺少共享邮件轮询能力，无法继续执行。');
      }

      const runtimeState = readKiroRuntime(state);
      const recordedRequestedAt = Math.max(0, Number(runtimeState.register?.verificationRequestedAt) || 0);
      const requestedAt = recordedRequestedAt || Math.max(0, Date.now() - MAIL_2925_FILTER_LOOKBACK_MS);
      const mailProvider = cleanString(state?.mailProvider).toLowerCase();
      const filterAfterTimestamp = mailProvider === '2925'
        ? Math.max(0, requestedAt - MAIL_2925_FILTER_LOOKBACK_MS)
        : requestedAt;

      return pollFlowVerificationCode({
        actionLabel: 'Kiro 验证码',
        filterAfterTimestamp,
        flowId: 'kiro',
        logStep: step,
        logStepKey: 'kiro-submit-verification-code',
        missingCapabilityMessage: 'Kiro 验证码步骤缺少共享邮件轮询能力，无法继续执行。',
        nodeId: 'kiro-submit-verification-code',
        notFoundMessage: `步骤 ${step}：邮箱轮询结束，但未获取到 Kiro 验证码。`,
        state: {
          ...state,
          activeFlowId: 'kiro',
          flowId: 'kiro',
          visibleStep: step,
        },
        step,
      });
    }

    async function executeKiroOpenRegisterPage(state = {}) {
      const nodeId = String(state?.nodeId || 'kiro-open-register-page').trim();
      const currentState = await getExecutionState(state);
      try {
        await clearKiroCookiesBeforeStep1();
        const loginUrl = KIRO_SIGNIN_URL;
        const tabId = await reuseOrCreateTab(KIRO_REGISTER_PAGE_SOURCE_ID, loginUrl);
        if (!Number.isInteger(tabId)) {
          throw new Error('无法打开 Kiro 注册页，请重试步骤 1。');
        }
        await registerTab(KIRO_REGISTER_PAGE_SOURCE_ID, tabId);
        await activateTab(tabId);

        let landingResult = await ensureKiroPageState(tabId, {
          step: 1,
          targetStates: ['kiro_signin_page', 'email_entry'],
          stableMs: 2500,
          initialDelayMs: 300,
          injectLogMessage: '步骤 1：Kiro 注册页内容脚本未就绪，正在等待页面恢复...',
          readyLogMessage: '步骤 1：正在等待 Kiro 官方登录页加载完成...',
        });

        if (landingResult?.state === 'kiro_signin_page') {
          await log('步骤 1：正在选择 AWS Builder ID 登录方式...', 'info', nodeId);
          const selectResult = await sendToContentScriptResilient(KIRO_REGISTER_PAGE_SOURCE_ID, {
            type: 'EXECUTE_NODE',
            nodeId: 'kiro-open-register-page',
            step: 1,
            source: 'background',
            payload: {},
          }, {
            timeoutMs: 30000,
            retryDelayMs: 700,
            onRetryableError: buildKiroRetryRecovery(tabId, {}),
            logMessage: '步骤 1：正在点击 Kiro 官方登录页的 Builder ID...',
          });
          if (selectResult?.error) {
            throw new Error(selectResult.error);
          }
          landingResult = await ensureKiroPageState(tabId, {
            step: 1,
            targetStates: ['email_entry'],
            stableMs: 2500,
            initialDelayMs: 300,
            injectLogMessage: '步骤 1：选择 Builder ID 后页面跳转中，正在等待 Kiro 注册页恢复...',
            readyLogMessage: '步骤 1：正在等待 Builder ID 邮箱输入框加载完成...',
            timeoutMessage: '选择 Builder ID 后未进入邮箱页，请检查当前 Kiro 登录页或代理状态。',
          });
        }

        const nextPatch = {
          session: {
            currentStage: 'register',
            registerTabId: tabId,
            startedAt: Date.now(),
            pageState: landingResult?.state || '',
            pageUrl: landingResult?.url || loginUrl,
            lastError: '',
            lastWarning: '',
          },
          register: {
            email: '',
            fullName: '',
            verificationRequestedAt: 0,
            loginUrl,
            status: 'waiting_email',
            completedAt: 0,
          },
          webAuth: {
            status: 'signin_started',
            completedAt: 0,
            hasAccessToken: false,
            hasSessionToken: false,
          },
          desktopAuth: {
            region: DEFAULT_REGION,
            clientId: '',
            clientSecret: '',
            clientIdHash: '',
            state: '',
            codeVerifier: '',
            codeChallenge: '',
            redirectUri: '',
            redirectPort: 0,
            authorizeUrl: '',
            authorizationCode: '',
            accessToken: '',
            refreshToken: '',
            status: '',
            authorizedAt: 0,
            otpRequestedAt: 0,
            tokenSource: 'desktop_authorization_code_pkce',
          },
          upload: {
            targetId: cleanString(currentState?.targetId || readKiroRuntime(currentState).upload?.targetId) || DEFAULT_TARGET_ID,
            status: 'waiting_register',
            error: '',
            credentialId: null,
            lastMessage: '',
            lastUploadedAt: 0,
          },
        };

        const payload = await applyRuntimeState(currentState, nextPatch);
        await log('Kiro 注册页已就绪，已进入 Builder ID 邮箱页，请在下一步中获取邮箱并继续。', 'ok', nodeId);
        await completeNodeFromBackground(nodeId, payload);
      } catch (error) {
        const message = getErrorMessage(error);
        await persistFailure(currentState, message);
        throw error;
      }
    }

    async function executeKiroSubmitEmail(state = {}) {
      const nodeId = String(state?.nodeId || 'kiro-submit-email').trim();
      const currentState = await getExecutionState(state);
      try {
        const tabId = await activateKiroRegisterTab(currentState, {
          missingUrlMessage: '缺少 Kiro 注册页地址，请先执行步骤 1。',
          openFailedMessage: '无法恢复 Kiro 注册页，请重新执行步骤 1。',
        });
        const currentPageState = await readKiroRegisterPageState(tabId, {
          step: 2,
          stableMs: 2500,
          initialDelayMs: 300,
          injectLogMessage: '步骤 2：Kiro 注册页内容脚本未就绪，正在等待页面恢复...',
          readyLogMessage: '步骤 2：正在读取 Kiro 注册页当前状态...',
        });
        assertKiroRegistrationOnlyState(currentPageState, currentState, 2);

        if (KIRO_REGISTER_AFTER_EMAIL_STATES.includes(currentPageState?.state)) {
          const runtimeState = readKiroRuntime(currentState);
          const adoptedEmail = resolveKiroRegisterEmail(currentState, currentPageState);
          if (!adoptedEmail) {
            throw new Error('步骤 2：当前已不在邮箱页，但无法识别注册邮箱，请回到邮箱页重新提交或在配置中填入注册邮箱。');
          }
          const status = getKiroRegisterStatusForPageState(currentPageState.state);
          await adoptKiroRegisterPageState(currentState, currentPageState, nodeId, {
            email: adoptedEmail,
            status,
            verificationRequestedAt: currentPageState.state === 'register_otp_page'
              ? runtimeState.register?.verificationRequestedAt || 0
              : undefined,
          });
          await log(`步骤 2：检测到当前已进入 ${currentPageState.state}，已收养注册进度并继续。`, 'ok', nodeId);
          return;
        }

        if (currentPageState?.state !== 'email_entry') {
          throw new Error(`步骤 2：当前页面状态为 ${currentPageState?.state || 'unknown'}，不是 Kiro 注册邮箱页，请先执行步骤 1 或回到邮箱输入页。`);
        }

        if (typeof resolveSignupEmailForFlow !== 'function') {
          throw new Error('Kiro 邮箱步骤缺少公共邮箱解析能力，无法继续执行。');
        }

        const resolvedEmail = await resolveSignupEmailForFlow(currentState, {
          preserveAccountIdentity: true,
        });
        await log(`步骤 2：已获取邮箱 ${resolvedEmail}，正在提交到 Kiro 注册页...`, 'info', nodeId);

        await activateTab(tabId);
        const submitResult = await sendToContentScriptResilient(KIRO_REGISTER_PAGE_SOURCE_ID, {
          type: 'EXECUTE_NODE',
          nodeId: 'kiro-submit-email',
          step: 2,
          source: 'background',
          payload: {
            email: resolvedEmail,
          },
        }, {
          timeoutMs: 30000,
          retryDelayMs: 700,
          onRetryableError: buildKiroRetryRecovery(tabId, {}),
          logMessage: '步骤 2：正在向 Kiro 注册页提交邮箱...',
        });
        if (submitResult?.error) {
          throw new Error(submitResult.error);
        }

        const landingResult = await waitForKiroPageChange(tabId, {
          step: 2,
          fromStates: ['email_entry'],
          stableMs: 1500,
          initialDelayMs: 150,
          injectLogMessage: '步骤 2：邮箱提交后页面切换中，正在等待 Kiro 注册页恢复...',
          readyLogMessage: '步骤 2：邮箱已提交，正在等待 Kiro 注册链路进入下一页...',
          timeoutMessage: '邮箱提交后页面没有离开邮箱页，请检查邮箱是否被拒绝、页面是否异常或代理是否卡住。',
        });
        assertKiroRegistrationOnlyState(landingResult, currentState, 2, resolvedEmail);
        if (!KIRO_REGISTER_AFTER_EMAIL_STATES.includes(landingResult?.state)) {
          throw new Error(`步骤 2：邮箱提交后进入了无法继续注册的页面状态：${landingResult?.state || 'unknown'}。`);
        }

        const landedStatus = getKiroRegisterStatusForPageState(landingResult.state);
        const requestedAt = landingResult.state === 'register_otp_page' ? Date.now() : 0;
        const isCompleted = landedStatus === 'completed';

        const payload = await applyRuntimeState(currentState, {
          session: {
            currentStage: isCompleted ? 'desktop-authorize' : 'register',
            pageState: landingResult?.state || '',
            pageUrl: landingResult?.url || '',
            lastError: '',
          },
          register: {
            email: resolvedEmail,
            fullName: '',
            verificationRequestedAt: requestedAt,
            status: landedStatus,
            completedAt: isCompleted ? Date.now() : 0,
          },
          upload: {
            status: isCompleted ? 'waiting_desktop_authorize' : 'waiting_register',
            error: '',
          },
        });
        await log(`步骤 2：邮箱 ${resolvedEmail} 已提交，当前页面状态：${landingResult?.state || 'unknown'}。`, 'ok', nodeId);
        await completeNodeFromBackground(nodeId, {
          ...payload,
          email: resolvedEmail,
          accountIdentifierType: 'email',
          accountIdentifier: resolvedEmail,
        });
      } catch (error) {
        const message = getErrorMessage(error);
        await persistFailure(currentState, message);
        throw error;
      }
    }

    async function executeKiroSubmitName(state = {}) {
      const nodeId = String(state?.nodeId || 'kiro-submit-name').trim();
      const currentState = await getExecutionState(state);
      try {
        const runtimeState = readKiroRuntime(currentState);

        const tabId = await activateKiroRegisterTab(currentState, {
          missingUrlMessage: '缺少 Kiro 注册页地址，请先执行步骤 1。',
          openFailedMessage: '无法恢复 Kiro 注册页，请重新执行步骤 1。',
        });
        const currentPageState = await readKiroRegisterPageState(tabId, {
          step: 3,
          stableMs: 1500,
          initialDelayMs: 150,
          injectLogMessage: '步骤 3：Kiro 姓名页内容脚本未就绪，正在等待页面恢复...',
          readyLogMessage: '步骤 3：正在读取 Kiro 注册页当前状态...',
        });
        assertKiroRegistrationOnlyState(currentPageState, currentState, 3);

        const currentEmail = resolveKiroRegisterEmail(currentState, currentPageState);
        if (!currentEmail) {
          throw new Error('步骤 3：缺少 Kiro 注册邮箱，请先完成步骤 2。');
        }

        if (KIRO_REGISTER_AFTER_NAME_STATES.includes(currentPageState?.state)) {
          const status = getKiroRegisterStatusForPageState(currentPageState.state);
          await adoptKiroRegisterPageState(currentState, currentPageState, nodeId, {
            email: currentEmail,
            status,
            verificationRequestedAt: currentPageState.state === 'register_otp_page'
              ? (runtimeState.register?.verificationRequestedAt || 0)
              : undefined,
          });
          await log(`步骤 3：检测到当前已进入 ${currentPageState.state}，已收养注册进度并继续。`, 'ok', nodeId);
          return;
        }

        if (currentPageState?.state !== 'name_entry') {
          throw new Error(`步骤 3：当前页面状态为 ${currentPageState?.state || 'unknown'}，不是 Kiro 注册姓名页，请先完成步骤 2。`);
        }

        const fullName = resolveKiroFullName(currentState);
        const verificationRequestedAt = Date.now();
        await log(`步骤 3：正在填写姓名 ${fullName} 并继续...`, 'info', nodeId);

        const submitResult = await sendToContentScriptResilient(KIRO_REGISTER_PAGE_SOURCE_ID, {
          type: 'EXECUTE_NODE',
          nodeId: 'kiro-submit-name',
          step: 3,
          source: 'background',
          payload: {
            fullName,
          },
        }, {
          timeoutMs: 30000,
          retryDelayMs: 700,
          onRetryableError: buildKiroRetryRecovery(tabId, {}),
          logMessage: '步骤 3：正在向 Kiro 姓名页提交姓名...',
        });
        if (submitResult?.error) {
          throw new Error(submitResult.error);
        }

        const landingResult = await waitForKiroPageChange(tabId, {
          step: 3,
          fromStates: ['name_entry'],
          stableMs: 1500,
          initialDelayMs: 150,
          injectLogMessage: '步骤 3：姓名提交后页面切换中，正在等待 Kiro 注册页恢复...',
          readyLogMessage: '步骤 3：姓名已提交，正在等待 Kiro 注册链路进入下一页...',
          timeoutMessage: '姓名提交后未进入验证码页，请检查当前页面状态。',
        });
        assertKiroRegistrationOnlyState(landingResult, currentState, 3, currentEmail);
        if (!KIRO_REGISTER_AFTER_NAME_STATES.includes(landingResult?.state)) {
          throw new Error(`步骤 3：姓名提交后进入了无法继续注册的页面状态：${landingResult?.state || 'unknown'}。`);
        }

        const landedStatus = getKiroRegisterStatusForPageState(landingResult.state);
        const isCompleted = landedStatus === 'completed';
        const payload = await applyRuntimeState(currentState, {
          session: {
            currentStage: isCompleted ? 'desktop-authorize' : 'register',
            pageState: landingResult?.state || '',
            pageUrl: landingResult?.url || '',
            lastError: '',
          },
          register: {
            email: currentEmail,
            fullName,
            verificationRequestedAt: landingResult.state === 'register_otp_page'
              ? verificationRequestedAt
              : runtimeState.register?.verificationRequestedAt || 0,
            status: landedStatus,
            completedAt: isCompleted ? Date.now() : 0,
          },
          upload: {
            status: isCompleted ? 'waiting_desktop_authorize' : 'waiting_register',
            error: '',
          },
        });
        await log(`步骤 3：姓名已提交，当前页面状态：${landingResult?.state || 'unknown'}。`, 'ok', nodeId);
        await completeNodeFromBackground(nodeId, payload);
      } catch (error) {
        const message = getErrorMessage(error);
        await persistFailure(currentState, message);
        throw error;
      }
    }

    async function executeKiroSubmitVerificationCode(state = {}) {
      const nodeId = String(state?.nodeId || 'kiro-submit-verification-code').trim();
      const currentState = await getExecutionState(state);
      try {
        const tabId = await activateKiroRegisterTab(currentState, {
          missingUrlMessage: '缺少 Kiro 注册页地址，请先执行步骤 1。',
          openFailedMessage: '无法恢复 Kiro 注册页，请重新执行步骤 1。',
        });
        const currentPageState = await readKiroRegisterPageState(tabId, {
          step: 4,
          stableMs: 1500,
          initialDelayMs: 150,
          injectLogMessage: '步骤 4：Kiro 验证码页内容脚本未就绪，正在等待页面恢复...',
          readyLogMessage: '步骤 4：正在读取 Kiro 注册页当前状态...',
        });
        assertKiroRegistrationOnlyState(currentPageState, currentState, 4);

        const currentEmail = resolveKiroRegisterEmail(currentState, currentPageState);
        if (!currentEmail) {
          throw new Error('步骤 4：缺少 Kiro 注册邮箱，请先完成步骤 2，或在当前验证码页显示注册邮箱后重试。');
        }

        if (KIRO_REGISTER_AFTER_OTP_STATES.includes(currentPageState?.state)) {
          const status = getKiroRegisterStatusForPageState(currentPageState.state);
          await adoptKiroRegisterPageState(currentState, currentPageState, nodeId, {
            email: currentEmail,
            status,
          });
          await log(`步骤 4：检测到当前已进入 ${currentPageState.state}，已收养注册进度并继续。`, 'ok', nodeId);
          return;
        }

        if (currentPageState?.state !== 'register_otp_page') {
          throw new Error(`步骤 4：当前页面状态为 ${currentPageState?.state || 'unknown'}，不是 Kiro 注册验证码页，请先完成前置注册步骤。`);
        }

        const pollingState = {
          ...currentState,
          email: currentEmail,
          ...mergeRuntimePatch(currentState, {
            register: {
              email: currentEmail,
            },
          }),
        };
        const codeResult = await pollKiroVerificationCode(4, pollingState, nodeId);
        const code = cleanString(codeResult?.code);
        if (!code) {
          throw new Error('未能获取到 Kiro 邮箱验证码。');
        }
        await log(`步骤 4：已获取验证码 ${code}，正在返回 Kiro 注册页提交...`, 'info', nodeId);

        await activateTab(tabId);
        const submitResult = await sendToContentScriptResilient(KIRO_REGISTER_PAGE_SOURCE_ID, {
          type: 'EXECUTE_NODE',
          nodeId: 'kiro-submit-verification-code',
          step: 4,
          source: 'background',
          payload: {
            code,
          },
        }, {
          timeoutMs: 30000,
          retryDelayMs: 700,
          onRetryableError: buildKiroRetryRecovery(tabId, {}),
          logMessage: '步骤 4：正在向 Kiro 验证码页提交验证码...',
        });
        if (submitResult?.error) {
          throw new Error(submitResult.error);
        }

        const landingResult = await waitForKiroPageChange(tabId, {
          step: 4,
          fromStates: ['register_otp_page'],
          stableMs: 1500,
          initialDelayMs: 150,
          injectLogMessage: '步骤 4：验证码提交后页面切换中，正在等待 Kiro 注册页恢复...',
          readyLogMessage: '步骤 4：验证码已提交，正在等待 Kiro 密码页加载完成...',
          returnOnCodeInvalid: true,
          timeoutMessage: '验证码提交后未进入密码页，请检查验证码是否失效或页面是否异常。',
        });
        assertKiroRegistrationOnlyState(landingResult, currentState, 4, currentEmail);
        if (landingResult?.state === 'register_otp_page' && landingResult?.codeInvalid) {
          throw new Error('步骤 4：Kiro 提示验证码无效或已过期，已停止当前注册；请重新获取验证码或换邮箱重试。');
        }
        if (!KIRO_REGISTER_AFTER_OTP_STATES.includes(landingResult?.state)) {
          throw new Error(`步骤 4：验证码提交后进入了无法继续注册的页面状态：${landingResult?.state || 'unknown'}。`);
        }

        const landedStatus = getKiroRegisterStatusForPageState(landingResult.state);
        const isCompleted = landedStatus === 'completed';
        const payload = await applyRuntimeState(currentState, {
          session: {
            currentStage: isCompleted ? 'desktop-authorize' : 'register',
            pageState: landingResult?.state || '',
            pageUrl: landingResult?.url || '',
            lastError: '',
          },
          register: {
            email: currentEmail,
            status: landedStatus,
            completedAt: isCompleted ? Date.now() : 0,
          },
          upload: {
            status: isCompleted ? 'waiting_desktop_authorize' : 'waiting_register',
            error: '',
          },
        });
        await log(`步骤 4：验证码已提交，当前页面状态：${landingResult?.state || 'unknown'}。`, 'ok', nodeId);
        await completeNodeFromBackground(nodeId, {
          ...payload,
          code,
          emailTimestamp: Number(codeResult?.emailTimestamp || 0) || 0,
          mailId: String(codeResult?.mailId || ''),
        });
      } catch (error) {
        const message = getErrorMessage(error);
        await persistFailure(currentState, message);
        throw error;
      }
    }

    async function executeKiroSubmitPassword(state = {}) {
      const nodeId = String(state?.nodeId || 'kiro-submit-password').trim();
      const currentState = await getExecutionState(state);
      try {
        const tabId = await activateKiroRegisterTab(currentState, {
          missingUrlMessage: '缺少 Kiro 注册页地址，请先执行步骤 1。',
          openFailedMessage: '无法恢复 Kiro 注册页，请重新执行步骤 1。',
        });
        const currentPageState = await readKiroRegisterPageState(tabId, {
          step: 5,
          stableMs: 1500,
          initialDelayMs: 150,
          injectLogMessage: '步骤 5：Kiro 密码页内容脚本未就绪，正在等待页面恢复...',
          readyLogMessage: '步骤 5：正在读取 Kiro 注册页当前状态...',
        });
        assertKiroRegistrationOnlyState(currentPageState, currentState, 5);

        const currentEmail = resolveKiroRegisterEmail(currentState, currentPageState);
        if (KIRO_REGISTER_AFTER_PASSWORD_STATES.includes(currentPageState?.state)) {
          const status = getKiroRegisterStatusForPageState(currentPageState.state);
          await adoptKiroRegisterPageState(currentState, currentPageState, nodeId, {
            email: currentEmail,
            status,
          });
          await log(`步骤 5：检测到当前已进入 ${currentPageState.state}，已收养注册进度并继续。`, 'ok', nodeId);
          return;
        }

        if (currentPageState?.state !== 'create_password_page') {
          throw new Error(`步骤 5：当前页面状态为 ${currentPageState?.state || 'unknown'}，不是 Kiro 注册密码页，请先完成前置注册步骤。`);
        }

        const passwordResolution = resolveKiroPassword(currentState);
        const password = passwordResolution.password;
        if (!password) {
          throw new Error('未生成有效的 Kiro 账户密码。');
        }
        if (typeof setPasswordState === 'function') {
          await setPasswordState(password);
        } else {
          await setState({ password });
        }

        const passwordModeLabel = passwordResolution.mode === 'custom'
          ? '自定义密码'
          : (passwordResolution.mode === 'reused' ? '复用现有密码' : '自动生成密码');
        await log(`步骤 5：正在填写 Kiro 账户密码（${passwordModeLabel}，${password.length} 位）...`, 'info', nodeId);

        const submitResult = await sendToContentScriptResilient(KIRO_REGISTER_PAGE_SOURCE_ID, {
          type: 'EXECUTE_NODE',
          nodeId: 'kiro-submit-password',
          step: 5,
          source: 'background',
          payload: {
            password,
          },
        }, {
          timeoutMs: 30000,
          retryDelayMs: 700,
          onRetryableError: buildKiroRetryRecovery(tabId, {}),
          logMessage: '步骤 5：正在向 Kiro 密码页提交密码...',
        });
        if (submitResult?.error) {
          throw new Error(submitResult.error);
        }

        const landingResult = await waitForKiroPageChange(tabId, {
          step: 5,
          fromStates: ['create_password_page'],
          stableMs: 1200,
          initialDelayMs: 120,
          injectLogMessage: '步骤 5：密码提交后页面切换中，正在等待 Kiro 注册页恢复...',
          readyLogMessage: '步骤 5：密码已提交，正在等待 Kiro 注册页完成跳转...',
          timeoutMessage: '密码提交后页面未离开密码页，请检查密码规则或当前页面提示。',
        });
        assertKiroRegistrationOnlyState(landingResult, currentState, 5, currentEmail);
        if (!KIRO_REGISTER_AFTER_PASSWORD_STATES.includes(landingResult?.state)) {
          throw new Error(`步骤 5：密码提交后进入了无法继续注册的页面状态：${landingResult?.state || 'unknown'}。`);
        }

        const nextRegisterStatus = getKiroRegisterStatusForPageState(landingResult?.state);
        const payload = await applyRuntimeState(currentState, {
          session: {
            currentStage: nextRegisterStatus === 'completed' ? 'desktop-authorize' : 'register',
            pageState: landingResult?.state || '',
            pageUrl: landingResult?.url || '',
            lastError: '',
          },
          register: {
            email: currentEmail || undefined,
            status: nextRegisterStatus,
            completedAt: nextRegisterStatus === 'completed' ? Date.now() : 0,
          },
          upload: {
            status: nextRegisterStatus === 'completed' ? 'waiting_desktop_authorize' : 'waiting_register',
            error: '',
          },
        });
        await log(`步骤 5：密码已提交，当前页面状态：${landingResult?.state || 'unknown'}。`, 'ok', nodeId);
        await completeNodeFromBackground(nodeId, payload);
      } catch (error) {
        const message = getErrorMessage(error);
        await persistFailure(currentState, message);
        throw error;
      }
    }

    async function executeKiroCompleteRegisterConsent(state = {}) {
      const nodeId = String(state?.nodeId || 'kiro-complete-register-consent').trim();
      const currentState = await getExecutionState(state);
      try {
        const tabId = await activateKiroRegisterTab(currentState, {
          missingUrlMessage: '缺少 Kiro 注册页地址，请先执行步骤 1。',
          openFailedMessage: '无法恢复 Kiro 注册页，请重新执行步骤 1。',
        });
        let landingResult = await readKiroRegisterPageState(tabId, {
          step: 6,
          stableMs: 1500,
          initialDelayMs: 150,
          injectLogMessage: '步骤 6：Kiro 授权确认页内容脚本未就绪，正在等待页面恢复...',
          readyLogMessage: '步骤 6：正在读取 Kiro 注册页当前状态...',
          timeoutMessage: '未进入 Kiro 授权确认页，请检查当前页面状态。',
        });
        assertKiroRegistrationOnlyState(landingResult, currentState, 6);

        if (!['authorization_page', 'success_page', 'kiro_web_signed_in'].includes(landingResult?.state)) {
          throw new Error(`步骤 6：当前页面状态为 ${landingResult?.state || 'unknown'}，不是 Kiro 注册授权确认页，请先完成前置注册步骤。`);
        }

        if (landingResult?.state === 'authorization_page') {
          await log('步骤 6：正在确认访问并完成 Kiro 注册授权...', 'info', nodeId);
          const submitResult = await sendToContentScriptResilient(KIRO_REGISTER_PAGE_SOURCE_ID, {
            type: 'EXECUTE_NODE',
            nodeId: 'kiro-complete-register-consent',
            step: 6,
            source: 'background',
            payload: {
              maxActions: 3,
            },
          }, {
            timeoutMs: 60000,
            retryDelayMs: 700,
            onRetryableError: buildKiroRetryRecovery(tabId, {}),
            logMessage: '步骤 6：正在处理 Kiro 注册授权确认页...',
          });
          if (submitResult?.error) {
            throw new Error(submitResult.error);
          }
          landingResult = await ensureKiroPageState(tabId, {
            step: 6,
            targetStates: ['success_page', 'kiro_web_signed_in'],
            stableMs: 2000,
            initialDelayMs: 300,
            injectLogMessage: '步骤 6：授权确认后页面跳转中，正在等待 Kiro Web 登录态恢复...',
            readyLogMessage: '步骤 6：授权确认已提交，正在等待回到 Kiro Web...',
            timeoutMessage: '授权确认后未回到 Kiro Web 登录完成页，请检查当前页面或代理状态。',
          });
          assertKiroRegistrationOnlyState(landingResult, currentState, 6);
        }

        const webAuthSummary = await captureKiroWebAuthSummary();
        const payload = await applyRuntimeState(currentState, {
          session: {
            currentStage: 'desktop-authorize',
            pageState: landingResult?.state || '',
            pageUrl: landingResult?.url || '',
            lastError: '',
          },
          register: {
            status: 'completed',
            completedAt: Date.now(),
          },
          webAuth: {
            status: 'signed_in',
            completedAt: Date.now(),
            hasAccessToken: Boolean(webAuthSummary.hasAccessToken),
            hasSessionToken: Boolean(webAuthSummary.hasSessionToken),
          },
          upload: {
            status: 'waiting_desktop_authorize',
            error: '',
          },
        });
        await log('步骤 6：注册页授权已完成，Kiro Web 登录态已建立。', 'ok', nodeId);
        await completeNodeFromBackground(nodeId, payload);
      } catch (error) {
        const message = getErrorMessage(error);
        await persistFailure(currentState, message);
        throw error;
      }
    }

    return {
      executeKiroCompleteRegisterConsent,
      executeKiroOpenRegisterPage,
      executeKiroSubmitEmail,
      executeKiroSubmitName,
      executeKiroSubmitPassword,
      executeKiroSubmitVerificationCode,
    };
  }

  return {
    createKiroRegisterRunner,
    KIRO_SIGNIN_URL,
  };
});
