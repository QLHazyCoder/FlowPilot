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
    return error instanceof Error ? error.message : String(error ?? 'Unknown error');
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
        await log('Step 1: cookies API not supported by this browser, skipping cookie cleanup before opening Kiro registration page.', 'warn');
        return;
      }

      await log('Step 1: clearing AWS Builder ID related cookies before opening Kiro registration page...', 'info');
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
          await log(`Step 1: browsingData cookie sweep failed: ${getErrorMessage(error)}`, 'warn');
        }
      }

      await log(`Step 1: cleared ${removedCount} AWS Builder ID related cookies.`, 'ok');
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
        throw new Error(options.missingUrlMessage || 'Missing Kiro registration page URL, please run step 1 first.');
      }

      tabId = await reuseOrCreateTab(KIRO_REGISTER_PAGE_SOURCE_ID, loginUrl);
      if (!Number.isInteger(tabId)) {
        throw new Error(options.openFailedMessage || 'Unable to open Kiro registration page, please retry step 1.');
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
        logMessage: options.readyLogMessage || 'Waiting for Kiro page to advance to the next state...',
      });

      if (!hasKiroRegisterPageState(result) && !result?.error) {
        await log('Kiro registration page common script responded, but the page-specific detection script did not return a state. Re-injecting Kiro registration page detection script...', 'warn');
        await injectKiroRegisterContentScripts(tabId);
        result = await sendToContentScriptResilient(KIRO_REGISTER_PAGE_SOURCE_ID, message, {
          timeoutMs: timeoutBudget?.getRemainingMs?.(1000) || timeoutMs,
          retryDelayMs: 700,
          onRetryableError: buildKiroRetryRecovery(tabId, {
            ...options,
            timeoutBudget,
          }),
          logMessage: options.readyLogMessage || 'Waiting for Kiro page to advance to the next state...',
        });
      }

      if (result?.error) {
        throw new Error(result.error);
      }
      if (!hasKiroRegisterPageState(result)) {
        throw new Error('Kiro registration page detection script did not return a page state. Please refresh the current AWS page or re-run the current step.');
      }
      return result;
    }

    async function reattachKiroRegisterPage(tabId, options = {}) {
      if (!Number.isInteger(tabId)) {
        throw new Error('Missing Kiro registration page tab, cannot reconnect content script.');
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
          logMessage: options.injectLogMessage || 'Kiro registration page navigated, reconnecting content script...',
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
          injectLogMessage: options.recoveryInjectLogMessage || options.injectLogMessage || 'Kiro registration page navigated, reconnecting content script...',
        });
      };
    }

    async function ensureKiroPageState(tabId, options = {}) {
      if (!Number.isInteger(tabId)) {
        throw new Error('Missing Kiro registration page tab, cannot continue.');
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
          logMessage: options.injectLogMessage || 'Kiro registration page content script not ready, waiting for page recovery...',
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
        throw new Error('Missing Kiro registration page tab, cannot continue.');
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
          logMessage: options.injectLogMessage || 'Kiro registration page is switching, waiting for page recovery...',
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
        readyLogMessage: options.readyLogMessage || 'Waiting for Kiro page navigation to complete...',
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
        `Step ${step}: email${emailText} reached the AWS Builder ID sign-in page, meaning this email already exists or is treated as an existing account by AWS. The Kiro registration flow only handles new account sign-ups and has stopped. Please retry with a new email.`
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
        throw new Error('Kiro name step missing random-name capability, cannot continue.');
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
        throw new Error('Kiro name step did not produce a valid name.');
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
        throw new Error('Kiro password step missing shared password generator, cannot continue.');
      }
      return {
        password: String(generatePassword() || ''),
        mode: 'generated',
      };
    }

    async function pollKiroVerificationCode(step, state = {}, nodeId = '') {
      if (typeof pollFlowVerificationCode !== 'function') {
        throw new Error('Kiro verification-code step missing shared mail polling, cannot continue.');
      }

      const runtimeState = readKiroRuntime(state);
      const recordedRequestedAt = Math.max(0, Number(runtimeState.register?.verificationRequestedAt) || 0);
      const requestedAt = recordedRequestedAt || Math.max(0, Date.now() - MAIL_2925_FILTER_LOOKBACK_MS);
      const mailProvider = cleanString(state?.mailProvider).toLowerCase();
      const filterAfterTimestamp = mailProvider === '2925'
        ? Math.max(0, requestedAt - MAIL_2925_FILTER_LOOKBACK_MS)
        : requestedAt;

      return pollFlowVerificationCode({
        actionLabel: 'Kiro verification code',
        filterAfterTimestamp,
        flowId: 'kiro',
        logStep: step,
        logStepKey: 'kiro-submit-verification-code',
        missingCapabilityMessage: 'Kiro verification-code step missing shared mail polling, cannot continue.',
        nodeId: 'kiro-submit-verification-code',
        notFoundMessage: `Step ${step}: mailbox polling ended without obtaining Kiro verification code.`,
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
          throw new Error('Unable to open Kiro registration page, please retry step 1.');
        }
        await registerTab(KIRO_REGISTER_PAGE_SOURCE_ID, tabId);
        await activateTab(tabId);

        let landingResult = await ensureKiroPageState(tabId, {
          step: 1,
          targetStates: ['kiro_signin_page', 'email_entry'],
          stableMs: 2500,
          initialDelayMs: 300,
          injectLogMessage: 'Step 1: Kiro registration page content script not ready, waiting for page recovery...',
          readyLogMessage: 'Step 1: waiting for the Kiro official sign-in page to finish loading...',
        });

        if (landingResult?.state === 'kiro_signin_page') {
          await log('Step 1: selecting AWS Builder ID sign-in option...', 'info', nodeId);
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
            logMessage: 'Step 1: clicking Builder ID on the Kiro official sign-in page...',
          });
          if (selectResult?.error) {
            throw new Error(selectResult.error);
          }
          landingResult = await ensureKiroPageState(tabId, {
            step: 1,
            targetStates: ['email_entry'],
            stableMs: 2500,
            initialDelayMs: 300,
            injectLogMessage: 'Step 1: page navigating after Builder ID selection, waiting for Kiro registration page recovery...',
            readyLogMessage: 'Step 1: waiting for the Builder ID email input to finish loading...',
            timeoutMessage: 'After selecting Builder ID, the email page did not load. Please check the current Kiro sign-in page or proxy state.',
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
        await log('Kiro registration page is ready and on the Builder ID email page. Get the email and continue in the next step.', 'ok', nodeId);
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
          missingUrlMessage: 'Missing Kiro registration page URL, please run step 1 first.',
          openFailedMessage: 'Unable to restore Kiro registration page, please re-run step 1.',
        });
        const currentPageState = await readKiroRegisterPageState(tabId, {
          step: 2,
          stableMs: 2500,
          initialDelayMs: 300,
          injectLogMessage: 'Step 2: Kiro registration page content script not ready, waiting for page recovery...',
          readyLogMessage: 'Step 2: reading current state of Kiro registration page...',
        });
        assertKiroRegistrationOnlyState(currentPageState, currentState, 2);

        if (KIRO_REGISTER_AFTER_EMAIL_STATES.includes(currentPageState?.state)) {
          const runtimeState = readKiroRuntime(currentState);
          const adoptedEmail = resolveKiroRegisterEmail(currentState, currentPageState);
          if (!adoptedEmail) {
            throw new Error('Step 2: no longer on the email page but could not identify the registration email. Please return to the email page and resubmit, or set the registration email in config.');
          }
          const status = getKiroRegisterStatusForPageState(currentPageState.state);
          await adoptKiroRegisterPageState(currentState, currentPageState, nodeId, {
            email: adoptedEmail,
            status,
            verificationRequestedAt: currentPageState.state === 'register_otp_page'
              ? runtimeState.register?.verificationRequestedAt || 0
              : undefined,
          });
          await log(`Step 2: already at ${currentPageState.state}, adopted registration progress and continuing.`, 'ok', nodeId);
          return;
        }

        if (currentPageState?.state !== 'email_entry') {
          throw new Error(`Step 2: current page state is ${currentPageState?.state || 'unknown'}, not the Kiro registration email page. Please run step 1 first or return to the email input page.`);
        }

        if (typeof resolveSignupEmailForFlow !== 'function') {
          throw new Error('Kiro email step missing shared email resolver, cannot continue.');
        }

        const resolvedEmail = await resolveSignupEmailForFlow(currentState, {
          preserveAccountIdentity: true,
        });
        await log(`Step 2: obtained email ${resolvedEmail}, submitting to Kiro registration page...`, 'info', nodeId);

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
          logMessage: 'Step 2: submitting email to Kiro registration page...',
        });
        if (submitResult?.error) {
          throw new Error(submitResult.error);
        }

        const landingResult = await waitForKiroPageChange(tabId, {
          step: 2,
          fromStates: ['email_entry'],
          stableMs: 1500,
          initialDelayMs: 150,
          injectLogMessage: 'Step 2: page switching after email submission, waiting for Kiro registration page recovery...',
          readyLogMessage: 'Step 2: email submitted, waiting for the Kiro registration flow to reach the next page...',
          timeoutMessage: 'After email submission, the page did not leave the email page. Check whether the email was rejected, the page is broken, or the proxy is stuck.',
        });
        assertKiroRegistrationOnlyState(landingResult, currentState, 2, resolvedEmail);
        if (!KIRO_REGISTER_AFTER_EMAIL_STATES.includes(landingResult?.state)) {
          throw new Error(`Step 2: after email submission the page entered a state that cannot continue registration: ${landingResult?.state || 'unknown'}.`);
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
        await log(`Step 2: email ${resolvedEmail} submitted, current page state: ${landingResult?.state || 'unknown'}.`, 'ok', nodeId);
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
          missingUrlMessage: 'Missing Kiro registration page URL, please run step 1 first.',
          openFailedMessage: 'Unable to restore Kiro registration page, please re-run step 1.',
        });
        const currentPageState = await readKiroRegisterPageState(tabId, {
          step: 3,
          stableMs: 1500,
          initialDelayMs: 150,
          injectLogMessage: 'Step 3: Kiro name page content script not ready, waiting for page recovery...',
          readyLogMessage: 'Step 3: reading current state of Kiro registration page...',
        });
        assertKiroRegistrationOnlyState(currentPageState, currentState, 3);

        const currentEmail = resolveKiroRegisterEmail(currentState, currentPageState);
        if (!currentEmail) {
          throw new Error('Step 3: missing Kiro registration email, please complete step 2 first.');
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
          await log(`Step 3: already at ${currentPageState.state}, adopted registration progress and continuing.`, 'ok', nodeId);
          return;
        }

        if (currentPageState?.state !== 'name_entry') {
          throw new Error(`Step 3: current page state is ${currentPageState?.state || 'unknown'}, not the Kiro registration name page. Please complete step 2 first.`);
        }

        const fullName = resolveKiroFullName(currentState);
        const verificationRequestedAt = Date.now();
        await log(`Step 3: filling in name ${fullName} and continuing...`, 'info', nodeId);

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
          logMessage: 'Step 3: submitting name to Kiro name page...',
        });
        if (submitResult?.error) {
          throw new Error(submitResult.error);
        }

        const landingResult = await waitForKiroPageChange(tabId, {
          step: 3,
          fromStates: ['name_entry'],
          stableMs: 1500,
          initialDelayMs: 150,
          injectLogMessage: 'Step 3: page switching after name submission, waiting for Kiro registration page recovery...',
          readyLogMessage: 'Step 3: name submitted, waiting for the Kiro registration flow to reach the next page...',
          timeoutMessage: 'After name submission, the verification-code page did not load. Please check the current page state.',
        });
        assertKiroRegistrationOnlyState(landingResult, currentState, 3, currentEmail);
        if (!KIRO_REGISTER_AFTER_NAME_STATES.includes(landingResult?.state)) {
          throw new Error(`Step 3: after name submission the page entered a state that cannot continue registration: ${landingResult?.state || 'unknown'}.`);
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
        await log(`Step 3: name submitted, current page state: ${landingResult?.state || 'unknown'}.`, 'ok', nodeId);
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
          missingUrlMessage: 'Missing Kiro registration page URL, please run step 1 first.',
          openFailedMessage: 'Unable to restore Kiro registration page, please re-run step 1.',
        });
        const currentPageState = await readKiroRegisterPageState(tabId, {
          step: 4,
          stableMs: 1500,
          initialDelayMs: 150,
          injectLogMessage: 'Step 4: Kiro verification-code page content script not ready, waiting for page recovery...',
          readyLogMessage: 'Step 4: reading current state of Kiro registration page...',
        });
        assertKiroRegistrationOnlyState(currentPageState, currentState, 4);

        const currentEmail = resolveKiroRegisterEmail(currentState, currentPageState);
        if (!currentEmail) {
          throw new Error('Step 4: missing Kiro registration email. Please complete step 2 first, or retry after the registration email appears on the current verification-code page.');
        }

        if (KIRO_REGISTER_AFTER_OTP_STATES.includes(currentPageState?.state)) {
          const status = getKiroRegisterStatusForPageState(currentPageState.state);
          await adoptKiroRegisterPageState(currentState, currentPageState, nodeId, {
            email: currentEmail,
            status,
          });
          await log(`Step 4: already at ${currentPageState.state}, adopted registration progress and continuing.`, 'ok', nodeId);
          return;
        }

        if (currentPageState?.state !== 'register_otp_page') {
          throw new Error(`Step 4: current page state is ${currentPageState?.state || 'unknown'}, not the Kiro registration verification-code page. Please complete the earlier registration steps first.`);
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
          throw new Error('Failed to obtain Kiro email verification code.');
        }
        await log(`Step 4: obtained verification code ${code}, returning to Kiro registration page to submit...`, 'info', nodeId);

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
          logMessage: 'Step 4: submitting verification code to Kiro verification-code page...',
        });
        if (submitResult?.error) {
          throw new Error(submitResult.error);
        }

        const landingResult = await waitForKiroPageChange(tabId, {
          step: 4,
          fromStates: ['register_otp_page'],
          stableMs: 1500,
          initialDelayMs: 150,
          injectLogMessage: 'Step 4: page switching after verification-code submission, waiting for Kiro registration page recovery...',
          readyLogMessage: 'Step 4: verification code submitted, waiting for the Kiro password page to finish loading...',
          returnOnCodeInvalid: true,
          timeoutMessage: 'After verification-code submission, the password page did not load. Please check whether the code expired or the page is broken.',
        });
        assertKiroRegistrationOnlyState(landingResult, currentState, 4, currentEmail);
        if (landingResult?.state === 'register_otp_page' && landingResult?.codeInvalid) {
          throw new Error('Step 4: Kiro reported the verification code is invalid or expired and stopped the current registration. Please obtain a new verification code or retry with a different email.');
        }
        if (!KIRO_REGISTER_AFTER_OTP_STATES.includes(landingResult?.state)) {
          throw new Error(`Step 4: after verification-code submission the page entered a state that cannot continue registration: ${landingResult?.state || 'unknown'}.`);
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
        await log(`Step 4: verification code submitted, current page state: ${landingResult?.state || 'unknown'}.`, 'ok', nodeId);
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
          missingUrlMessage: 'Missing Kiro registration page URL, please run step 1 first.',
          openFailedMessage: 'Unable to restore Kiro registration page, please re-run step 1.',
        });
        const currentPageState = await readKiroRegisterPageState(tabId, {
          step: 5,
          stableMs: 1500,
          initialDelayMs: 150,
          injectLogMessage: 'Step 5: Kiro password page content script not ready, waiting for page recovery...',
          readyLogMessage: 'Step 5: reading current state of Kiro registration page...',
        });
        assertKiroRegistrationOnlyState(currentPageState, currentState, 5);

        const currentEmail = resolveKiroRegisterEmail(currentState, currentPageState);
        if (KIRO_REGISTER_AFTER_PASSWORD_STATES.includes(currentPageState?.state)) {
          const status = getKiroRegisterStatusForPageState(currentPageState.state);
          await adoptKiroRegisterPageState(currentState, currentPageState, nodeId, {
            email: currentEmail,
            status,
          });
          await log(`Step 5: already at ${currentPageState.state}, adopted registration progress and continuing.`, 'ok', nodeId);
          return;
        }

        if (currentPageState?.state !== 'create_password_page') {
          throw new Error(`Step 5: current page state is ${currentPageState?.state || 'unknown'}, not the Kiro registration password page. Please complete the earlier registration steps first.`);
        }

        const passwordResolution = resolveKiroPassword(currentState);
        const password = passwordResolution.password;
        if (!password) {
          throw new Error('Failed to generate a valid Kiro account password.');
        }
        if (typeof setPasswordState === 'function') {
          await setPasswordState(password);
        } else {
          await setState({ password });
        }

        const passwordModeLabel = passwordResolution.mode === 'custom'
          ? 'custom password'
          : (passwordResolution.mode === 'reused' ? 'reusing existing password' : 'auto-generated password');
        await log(`Step 5: filling in Kiro account password (${passwordModeLabel}, ${password.length} chars)...`, 'info', nodeId);

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
          logMessage: 'Step 5: submitting password to Kiro password page...',
        });
        if (submitResult?.error) {
          throw new Error(submitResult.error);
        }

        const landingResult = await waitForKiroPageChange(tabId, {
          step: 5,
          fromStates: ['create_password_page'],
          stableMs: 1200,
          initialDelayMs: 120,
          injectLogMessage: 'Step 5: page switching after password submission, waiting for Kiro registration page recovery...',
          readyLogMessage: 'Step 5: password submitted, waiting for the Kiro registration page navigation to complete...',
          timeoutMessage: 'After password submission, the page did not leave the password page. Please check the password rules or the current page hint.',
        });
        assertKiroRegistrationOnlyState(landingResult, currentState, 5, currentEmail);
        if (!KIRO_REGISTER_AFTER_PASSWORD_STATES.includes(landingResult?.state)) {
          throw new Error(`Step 5: after password submission the page entered a state that cannot continue registration: ${landingResult?.state || 'unknown'}.`);
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
        await log(`Step 5: password submitted, current page state: ${landingResult?.state || 'unknown'}.`, 'ok', nodeId);
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
          missingUrlMessage: 'Missing Kiro registration page URL, please run step 1 first.',
          openFailedMessage: 'Unable to restore Kiro registration page, please re-run step 1.',
        });
        let landingResult = await readKiroRegisterPageState(tabId, {
          step: 6,
          stableMs: 1500,
          initialDelayMs: 150,
          injectLogMessage: 'Step 6: Kiro authorization consent page content script not ready, waiting for page recovery...',
          readyLogMessage: 'Step 6: reading current state of Kiro registration page...',
          timeoutMessage: 'Did not reach the Kiro authorization consent page. Please check the current page state.',
        });
        assertKiroRegistrationOnlyState(landingResult, currentState, 6);

        if (!['authorization_page', 'success_page', 'kiro_web_signed_in'].includes(landingResult?.state)) {
          throw new Error(`Step 6: current page state is ${landingResult?.state || 'unknown'}, not the Kiro registration authorization consent page. Please complete the earlier registration steps first.`);
        }

        if (landingResult?.state === 'authorization_page') {
          await log('Step 6: confirming access and finishing Kiro registration authorization...', 'info', nodeId);
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
            logMessage: 'Step 6: processing Kiro registration authorization consent page...',
          });
          if (submitResult?.error) {
            throw new Error(submitResult.error);
          }
          landingResult = await ensureKiroPageState(tabId, {
            step: 6,
            targetStates: ['success_page', 'kiro_web_signed_in'],
            stableMs: 2000,
            initialDelayMs: 300,
            injectLogMessage: 'Step 6: page navigating after authorization consent, waiting for Kiro Web sign-in to be restored...',
            readyLogMessage: 'Step 6: authorization consent submitted, waiting for return to Kiro Web...',
            timeoutMessage: 'After authorization consent, did not return to the Kiro Web sign-in completion page. Please check the current page or proxy state.',
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
        await log('Step 6: registration page authorization complete, Kiro Web sign-in established.', 'ok', nodeId);
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
