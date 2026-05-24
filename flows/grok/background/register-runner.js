(function attachBackgroundGrokRegisterRunner(root, factory) {
  root.MultiPageBackgroundGrokRegisterRunner = factory(root);
})(typeof self !== 'undefined' ? self : globalThis, function createBackgroundGrokRegisterRunnerModule() {
  const GROK_SIGNUP_URL = 'https://accounts.x.ai/sign-up?redirect=grok-com';
  const GROK_REGISTER_PAGE_SOURCE_ID = 'grok-register-page';
  const DEFAULT_GROK_PAGE_TIMEOUT_MS = 90 * 1000;
  const GROK_VERIFICATION_PAGE_STATE = 'verification_code_entry';
  const GROK_VERIFICATION_READY_TIMEOUT_MS = 90 * 1000;
  const GROK_POST_PROFILE_CF_WAIT_MS = 20 * 1000;
  const GROK_PRE_SSO_EXTRACT_WAIT_MS = 10 * 1000;
  const MAIL_2925_FILTER_LOOKBACK_MS = 10 * 60 * 1000;
  const GROK_COOKIE_CLEAR_DOMAINS = Object.freeze([
    'x.ai',
    'accounts.x.ai',
    'grok.com',
  ]);

  function cleanString(value = '') {
    return String(value ?? '').trim();
  }

  function getErrorMessage(error) {
    return error instanceof Error ? error.message : cleanString(error) || '未知错误';
  }

  function createGeneratedPassword() {
    const alphabet = 'abcdefghijkmnopqrstuvwxyzABCDEFGHJKLMNPQRSTUVWXYZ23456789!@#$%^&*';
    let output = '';
    for (let index = 0; index < 18; index += 1) {
      output += alphabet[Math.floor(Math.random() * alphabet.length)];
    }
    return `${output}aA1!`;
  }

  function createGrokRegisterRunner(deps = {}) {
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
      GROK_REGISTER_INJECT_FILES = null,
      markCurrentRegistrationAccountUsed = null,
    } = deps;

    if (typeof completeNodeFromBackground !== 'function') {
      throw new Error('Grok register runner requires completeNodeFromBackground.');
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

    async function getExecutionState(state = {}) {
      if (state && typeof state === 'object' && !Array.isArray(state) && Object.keys(state).length) {
        return state;
      }
      return getState();
    }

    async function persistState(patch = {}) {
      await setState(patch);
      return patch;
    }

    function buildGrokRuntimePatch(patch = {}) {
      return {
        runtimeState: {
          flowState: {
            grok: patch,
          },
        },
      };
    }

    async function completeNode(nodeId, patch = {}) {
      await persistState(patch);
      await completeNodeFromBackground(nodeId, patch);
      return patch;
    }

    async function isUsableTabId(tabId) {
      if (!Number.isInteger(tabId)) {
        return false;
      }
      if (typeof isTabAlive === 'function' && await isTabAlive(GROK_REGISTER_PAGE_SOURCE_ID)) {
        return true;
      }
      if (chrome?.tabs?.get) {
        const tab = await chrome.tabs.get(tabId).catch(() => null);
        return Boolean(tab?.id === tabId);
      }
      return true;
    }

    async function ensureGrokRegisterTab(state = {}, options = {}) {
      const existingTabId = Number(
        state?.grokRegisterTabId
        || state?.runtimeState?.flowState?.grok?.session?.registerTabId
        || state?.tabRegistry?.[GROK_REGISTER_PAGE_SOURCE_ID]?.tabId
        || 0
      );
      if (Number.isInteger(existingTabId) && existingTabId > 0 && await isUsableTabId(existingTabId)) {
        await registerTab(GROK_REGISTER_PAGE_SOURCE_ID, existingTabId);
        return existingTabId;
      }

      const tabId = await getTabId(GROK_REGISTER_PAGE_SOURCE_ID);
      if (Number.isInteger(tabId) && await isUsableTabId(tabId)) {
        await registerTab(GROK_REGISTER_PAGE_SOURCE_ID, tabId);
        return tabId;
      }

      if (!options.openIfMissing) {
        throw new Error(options.missingMessage || '缺少 Grok 注册页，请先执行步骤 1。');
      }

      const openedTabId = await reuseOrCreateTab(GROK_REGISTER_PAGE_SOURCE_ID, GROK_SIGNUP_URL, {
        inject: Array.isArray(GROK_REGISTER_INJECT_FILES) ? GROK_REGISTER_INJECT_FILES : null,
        injectSource: GROK_REGISTER_PAGE_SOURCE_ID,
      });
      if (!Number.isInteger(openedTabId)) {
        throw new Error('无法打开 Grok 注册页。');
      }
      await registerTab(GROK_REGISTER_PAGE_SOURCE_ID, openedTabId);
      return openedTabId;
    }

    async function ensureContentReady(tabId, options = {}) {
      if (!Number.isInteger(tabId)) {
        throw new Error('缺少 Grok 注册页标签页，无法连接内容脚本。');
      }
      if (typeof waitForTabStableComplete === 'function') {
        await waitForTabStableComplete(tabId, {
          timeoutMs: options.timeoutMs || DEFAULT_GROK_PAGE_TIMEOUT_MS,
          retryDelayMs: 300,
          stableMs: Number(options.stableMs) || 1200,
          initialDelayMs: Number(options.initialDelayMs) || 120,
        });
      }
      if (typeof ensureContentScriptReadyOnTab === 'function') {
        await ensureContentScriptReadyOnTab(GROK_REGISTER_PAGE_SOURCE_ID, tabId, {
          inject: Array.isArray(GROK_REGISTER_INJECT_FILES) ? GROK_REGISTER_INJECT_FILES : null,
          injectSource: GROK_REGISTER_PAGE_SOURCE_ID,
          timeoutMs: options.timeoutMs || DEFAULT_GROK_PAGE_TIMEOUT_MS,
          retryDelayMs: 700,
          logMessage: options.logMessage || 'Grok 注册页内容脚本未就绪，正在等待页面恢复...',
        });
      }
    }

    async function sendGrokCommand(nodeId, payload = {}, options = {}) {
      if (typeof sendToContentScriptResilient !== 'function') {
        throw new Error('Grok 注册页通信能力不可用。');
      }
      const result = await sendToContentScriptResilient(GROK_REGISTER_PAGE_SOURCE_ID, {
        type: 'EXECUTE_NODE',
        nodeId,
        step: options.step || 0,
        source: 'background',
        payload,
      }, {
        timeoutMs: options.timeoutMs || 45000,
        retryDelayMs: 700,
        logMessage: options.logMessage || '',
      });
      if (result?.error) {
        throw new Error(result.error);
      }
      return result || {};
    }

    async function getGrokRegisterPageState(options = {}) {
      return sendGrokCommand('GET_PAGE_STATE', {}, {
        step: options.step || 0,
        timeoutMs: options.timeoutMs || 15000,
        logMessage: options.logMessage || '',
      });
    }

    async function waitForGrokVerificationPageReady(tabId, options = {}) {
      const timeoutMs = Math.max(1000, Number(options.timeoutMs) || GROK_VERIFICATION_READY_TIMEOUT_MS);
      const intervalMs = Math.max(250, Number(options.intervalMs) || 1000);
      const deadline = Date.now() + timeoutMs;
      let lastState = null;
      let lastError = '';

      while (Date.now() <= deadline) {
        throwIfStopped();
        try {
          await ensureContentReady(tabId, {
            timeoutMs: Math.min(DEFAULT_GROK_PAGE_TIMEOUT_MS, Math.max(5000, intervalMs + 3000)),
            stableMs: 500,
            initialDelayMs: 0,
            logMessage: options.logMessage || '',
          });
          lastState = await getGrokRegisterPageState({
            step: options.step || 0,
            timeoutMs: Math.max(5000, intervalMs + 3000),
          });
          lastError = '';
          if (lastState?.state === GROK_VERIFICATION_PAGE_STATE) {
            return lastState;
          }
        } catch (error) {
          lastError = getErrorMessage(error);
        }
        await sleepWithStop(Math.min(intervalMs, Math.max(0, deadline - Date.now())));
      }

      const stateLabel = cleanString(lastState?.state) || 'unknown';
      const urlLabel = cleanString(lastState?.url);
      const errorLabel = lastError ? `，最后通信错误：${lastError}` : '';
      throw new Error(`Grok 邮箱提交后尚未进入验证码页面，当前状态：${stateLabel}${urlLabel ? `，URL：${urlLabel}` : ''}${errorLabel}。`);
    }

    function shouldClearGrokCookie(cookie = {}) {
      const domain = cleanString(cookie.domain).replace(/^\.+/, '').toLowerCase();
      return GROK_COOKIE_CLEAR_DOMAINS.some((target) => (
        domain === target || domain.endsWith(`.${target}`)
      ));
    }

    function buildCookieRemovalUrl(cookie = {}) {
      const host = cleanString(cookie.domain).replace(/^\.+/, '').toLowerCase();
      const path = cleanString(cookie.path) || '/';
      return `https://${host}${path.startsWith('/') ? path : `/${path}`}`;
    }

    async function clearGrokCookiesBeforeStep1() {
      if (!chrome?.cookies?.getAll || !chrome.cookies?.remove) {
        await log('步骤 1：当前浏览器不支持 cookies API，跳过 Grok Cookie 清理。', 'warn', 'grok-open-signup-page');
        return;
      }

      const stores = chrome.cookies.getAllCookieStores
        ? await chrome.cookies.getAllCookieStores()
        : [{ id: undefined }];
      let removedCount = 0;
      const seen = new Set();

      for (const store of stores) {
        const storeId = store?.id;
        const cookies = await chrome.cookies.getAll(storeId ? { storeId } : {}).catch(() => []);
        for (const cookie of cookies || []) {
          if (!shouldClearGrokCookie(cookie)) {
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
          try {
            const details = {
              url: buildCookieRemovalUrl(cookie),
              name: cookie.name,
            };
            if (cookie.storeId) {
              details.storeId = cookie.storeId;
            }
            if (cookie.partitionKey) {
              details.partitionKey = cookie.partitionKey;
            }
            const removed = await chrome.cookies.remove(details);
            if (removed) {
              removedCount += 1;
            }
          } catch (error) {
            console.warn('[MultiPage:grok-register] remove cookie failed', {
              domain: cookie?.domain,
              name: cookie?.name,
              message: getErrorMessage(error),
            });
          }
        }
      }
      await log(`步骤 1：已清理 Grok/xAI Cookie ${removedCount} 个。`, removedCount ? 'ok' : 'info', 'grok-open-signup-page');
    }

    function resolveProfile(currentState = {}) {
      const firstFromState = cleanString(currentState.grokFirstName);
      const lastFromState = cleanString(currentState.grokLastName);
      if (firstFromState && lastFromState) {
        return {
          firstName: firstFromState,
          lastName: lastFromState,
        };
      }
      const generated = typeof generateRandomName === 'function' ? generateRandomName() : null;
      const fullName = cleanString(generated?.fullName || generated?.name || 'Alex Morgan');
      const parts = fullName.split(/\s+/).filter(Boolean);
      return {
        firstName: firstFromState || cleanString(generated?.firstName || parts[0] || 'Alex'),
        lastName: lastFromState || cleanString(generated?.lastName || parts.slice(1).join(' ') || 'Morgan'),
      };
    }

    function resolvePassword(currentState = {}) {
      return cleanString(currentState.grokPassword || currentState.customPassword || currentState.password)
        || (typeof generatePassword === 'function' ? generatePassword() : createGeneratedPassword());
    }

    function normalizeGrokVerificationCode(value = '') {
      return cleanString(value).replace(/[^A-Za-z0-9]/g, '');
    }

    async function readSsoCookieFromChrome() {
      if (!chrome?.cookies?.get) {
        return '';
      }
      const candidates = [
        { url: 'https://x.ai/', name: 'sso' },
        { url: 'https://grok.com/', name: 'sso' },
        { url: 'https://accounts.x.ai/', name: 'sso' },
      ];
      for (const details of candidates) {
        const cookie = await chrome.cookies.get(details).catch(() => null);
        const value = cleanString(cookie?.value);
        if (value) {
          return value;
        }
      }
      return '';
    }

    async function executeGrokOpenSignupPage(state = {}) {
      const nodeId = cleanString(state?.nodeId) || 'grok-open-signup-page';
      const currentState = await getExecutionState(state);
      try {
        await clearGrokCookiesBeforeStep1();
        const tabId = await ensureGrokRegisterTab(currentState, { openIfMissing: true });
        await activateTab(tabId);
        await persistState({
          grokRegisterTabId: tabId,
          grokSignupUrl: GROK_SIGNUP_URL,
          ...buildGrokRuntimePatch({
            session: {
              registerTabId: tabId,
              startedAt: Date.now(),
              pageUrl: GROK_SIGNUP_URL,
              lastError: '',
            },
          }),
        });
        await ensureContentReady(tabId);
        const result = await sendGrokCommand(nodeId, {}, {
          step: 1,
          timeoutMs: DEFAULT_GROK_PAGE_TIMEOUT_MS,
          logMessage: '步骤 1：正在打开 Grok 邮箱注册入口...',
        });
        await log('步骤 1：已打开 Grok 邮箱注册页。', 'ok', nodeId);
        await completeNode(nodeId, {
          grokRegisterTabId: tabId,
          grokPageState: result.state || 'email_signup_ready',
          grokPageUrl: result.url || GROK_SIGNUP_URL,
          ...buildGrokRuntimePatch({
            session: {
              registerTabId: tabId,
              startedAt: Date.now(),
              pageState: result.state || 'email_signup_ready',
              pageUrl: result.url || GROK_SIGNUP_URL,
              lastError: '',
            },
            register: {
              status: 'signup_page_opened',
            },
          }),
        });
      } catch (error) {
        const message = getErrorMessage(error);
        await persistState(buildGrokRuntimePatch({
          session: {
            lastError: message,
          },
        }));
        await log(`步骤 1：${message}`, 'error', nodeId);
        throw error;
      }
    }

    async function executeGrokSubmitEmail(state = {}) {
      const nodeId = cleanString(state?.nodeId) || 'grok-submit-email';
      const currentState = await getExecutionState(state);
      try {
        if (typeof resolveSignupEmailForFlow !== 'function') {
          throw new Error('Grok 邮箱步骤缺少公共邮箱解析能力，无法继续执行。');
        }
        const tabId = await ensureGrokRegisterTab(currentState, { openIfMissing: false });
        await activateTab(tabId);
        await ensureContentReady(tabId);
        const resolvedEmail = await resolveSignupEmailForFlow(currentState, {
          preserveAccountIdentity: true,
        });
        const email = cleanString(resolvedEmail).toLowerCase();
        if (!email) {
          throw new Error('Grok 注册邮箱为空，无法继续执行。');
        }
        const requestedAt = Date.now();
        await persistState({
          grokEmail: email,
          email,
          accountIdentifierType: 'email',
          accountIdentifier: email,
          ...buildGrokRuntimePatch({
            register: {
              email,
              verificationRequestedAt: requestedAt,
              status: 'email_submitting',
            },
          }),
        });
        const result = await sendGrokCommand(nodeId, { email }, {
          step: 2,
          timeoutMs: GROK_VERIFICATION_READY_TIMEOUT_MS + 15000,
          logMessage: '步骤 2：正在提交 Grok 注册邮箱...',
        });
        if (result.state !== GROK_VERIFICATION_PAGE_STATE) {
          throw new Error(`Grok 邮箱提交后尚未进入验证码页面，当前状态：${cleanString(result.state) || 'unknown'}${cleanString(result.url) ? `，URL：${cleanString(result.url)}` : ''}。`);
        }
        await log(`步骤 2：已提交 Grok 注册邮箱 ${email}。`, 'ok', nodeId);
        await completeNode(nodeId, {
          grokEmail: email,
          grokVerificationRequestedAt: requestedAt,
          grokPageState: result.state || '',
          grokPageUrl: result.url || '',
          email,
          accountIdentifierType: 'email',
          accountIdentifier: email,
          ...buildGrokRuntimePatch({
            session: {
              pageState: result.state || '',
              pageUrl: result.url || '',
              lastError: '',
            },
            register: {
              email,
              verificationRequestedAt: requestedAt,
              status: 'verification_requested',
            },
          }),
        });
      } catch (error) {
        const message = getErrorMessage(error);
        await persistState(buildGrokRuntimePatch({
          session: {
            lastError: message,
          },
          register: {
            status: 'error',
          },
        }));
        await log(`步骤 2：${message}`, 'error', nodeId);
        throw error;
      }
    }

    async function executeGrokSubmitVerificationCode(state = {}) {
      const nodeId = cleanString(state?.nodeId) || 'grok-submit-verification-code';
      const currentState = await getExecutionState(state);
      try {
        if (typeof pollFlowVerificationCode !== 'function') {
          throw new Error('Grok 验证码步骤缺少共享邮件轮询能力，无法继续执行。');
        }
        const requestedAt = Math.max(
          0,
          Number(
            currentState.grokVerificationRequestedAt
            || currentState.runtimeState?.flowState?.grok?.register?.verificationRequestedAt
          ) || Date.now()
        );
        const filterAfterTimestamp = cleanString(currentState?.mailProvider).toLowerCase() === '2925'
          ? Math.max(0, requestedAt - MAIL_2925_FILTER_LOOKBACK_MS)
          : requestedAt;
        const email = cleanString(
          currentState.grokEmail
          || currentState.runtimeState?.flowState?.grok?.register?.email
          || currentState.email
        ).toLowerCase();
        const tabId = await ensureGrokRegisterTab(currentState, { openIfMissing: false });
        await activateTab(tabId);
        const readyState = await waitForGrokVerificationPageReady(tabId, {
          step: 3,
          logMessage: '步骤 3：正在等待 Grok 验证码页面就绪...',
        });
        await persistState({
          grokPageState: readyState.state || '',
          grokPageUrl: readyState.url || '',
          ...buildGrokRuntimePatch({
            session: {
              pageState: readyState.state || '',
              pageUrl: readyState.url || '',
              lastError: '',
            },
          }),
        });
        const pollResult = await pollFlowVerificationCode({
          actionLabel: 'Grok 验证码',
          filterAfterTimestamp,
          flowId: 'grok',
          logStep: 3,
          logStepKey: nodeId,
          nodeId,
          notFoundMessage: '步骤 3：邮箱轮询结束，但未获取到 xAI 验证码。',
          state: {
            ...currentState,
            activeFlowId: 'grok',
            flowId: 'grok',
            visibleStep: 3,
            grokEmail: email,
            email,
          },
          step: 3,
        });
        const code = normalizeGrokVerificationCode(pollResult?.code);
        if (!code) {
          throw new Error('未能获取到 xAI 邮箱验证码。');
        }
        await activateTab(tabId);
        await ensureContentReady(tabId);
        const result = await sendGrokCommand(nodeId, { code }, {
          step: 3,
          logMessage: '步骤 3：正在填写 xAI 邮箱验证码...',
        });
        await log(`步骤 3：已提交 xAI 邮箱验证码，当前页面状态：${result.state || 'unknown'}。`, 'ok', nodeId);
        await completeNode(nodeId, {
          grokVerificationCode: code,
          grokVerificationRawCode: cleanString(pollResult?.code),
          grokVerificationMessageId: cleanString(pollResult?.messageId || pollResult?.mailId),
          grokPageState: result.state || '',
          grokPageUrl: result.url || '',
          ...buildGrokRuntimePatch({
            session: {
              pageState: result.state || '',
              pageUrl: result.url || '',
              lastError: '',
            },
            register: {
              verificationCode: code,
              status: 'verified',
            },
          }),
        });
      } catch (error) {
        const message = getErrorMessage(error);
        await persistState(buildGrokRuntimePatch({
          session: {
            lastError: message,
          },
          register: {
            status: 'error',
          },
        }));
        await log(`步骤 3：${message}`, 'error', nodeId);
        throw error;
      }
    }

    async function executeGrokSubmitProfile(state = {}) {
      const nodeId = cleanString(state?.nodeId) || 'grok-submit-profile';
      const currentState = await getExecutionState(state);
      try {
        const tabId = await ensureGrokRegisterTab(currentState, { openIfMissing: false });
        const profile = resolveProfile(currentState);
        const password = resolvePassword(currentState);
        await persistState({
          grokFirstName: profile.firstName,
          grokLastName: profile.lastName,
          grokPassword: password,
          ...buildGrokRuntimePatch({
            register: {
              firstName: profile.firstName,
              lastName: profile.lastName,
              password,
              status: 'profile_submitting',
            },
          }),
        });
        if (typeof setPasswordState === 'function') {
          await setPasswordState(password);
        }
        await activateTab(tabId);
        await ensureContentReady(tabId);
        const result = await sendGrokCommand(nodeId, {
          firstName: profile.firstName,
          lastName: profile.lastName,
          password,
        }, {
          step: 4,
          logMessage: '步骤 4：正在填写 xAI 注册资料...',
        });
        await log(`步骤 4：已提交 Grok 注册资料，等待 ${Math.floor(GROK_POST_PROFILE_CF_WAIT_MS / 1000)} 秒完成注册验证...`, 'info', nodeId);
        await sleepWithStop(GROK_POST_PROFILE_CF_WAIT_MS);
        await ensureContentReady(tabId, { timeoutMs: DEFAULT_GROK_PAGE_TIMEOUT_MS });
        await log('步骤 4：已提交 Grok 注册资料并完成等待。', 'ok', nodeId);
        await completeNode(nodeId, {
          grokFirstName: profile.firstName,
          grokLastName: profile.lastName,
          grokPassword: password,
          grokPageState: result.state || 'profile_submitted',
          grokPageUrl: result.url || '',
          ...buildGrokRuntimePatch({
            session: {
              pageState: result.state || 'profile_submitted',
              pageUrl: result.url || '',
              lastError: '',
            },
            register: {
              firstName: profile.firstName,
              lastName: profile.lastName,
              password,
              status: 'profile_submitted',
            },
          }),
        });
      } catch (error) {
        const message = getErrorMessage(error);
        await persistState(buildGrokRuntimePatch({
          session: {
            lastError: message,
          },
          register: {
            status: 'error',
          },
        }));
        await log(`步骤 4：${message}`, 'error', nodeId);
        throw error;
      }
    }

    async function executeGrokExtractSsoCookie(state = {}) {
      const nodeId = cleanString(state?.nodeId) || 'grok-extract-sso-cookie';
      const currentState = await getExecutionState(state);
      try {
        const tabId = await ensureGrokRegisterTab(currentState, { openIfMissing: false });
        await activateTab(tabId);
        await log(`步骤 5：等待 ${Math.floor(GROK_PRE_SSO_EXTRACT_WAIT_MS / 1000)} 秒后提取 Grok SSO...`, 'info', nodeId);
        await sleepWithStop(GROK_PRE_SSO_EXTRACT_WAIT_MS);

        let ssoCookie = await readSsoCookieFromChrome();
        if (!ssoCookie) {
          await ensureContentReady(tabId);
          const result = await sendGrokCommand(nodeId, {}, {
            step: 5,
            logMessage: '步骤 5：正在从 Grok 注册页读取 sso Cookie...',
          });
          ssoCookie = cleanString(result?.ssoCookie);
        }
        if (!ssoCookie) {
          throw new Error('未找到 x.ai/grok sso Cookie。');
        }

        const completedAt = Date.now();
        const completionPatch = {
          grokSsoCookie: ssoCookie,
          grokSsoCookies: [ssoCookie],
          grokSsoExtractedAt: completedAt,
          grokCompletedAt: completedAt,
          grokRegisterStatus: 'completed',
          grokWebchat2ApiUploadStatus: '',
          grokWebchat2ApiUploadedAt: 0,
          grokWebchat2ApiUploadMessage: '',
          grokWebchat2ApiTargetUrl: '',
          ...buildGrokRuntimePatch({
            register: {
              status: 'completed',
              completedAt,
            },
            sso: {
              currentCookie: ssoCookie,
              cookies: [ssoCookie],
              extractedAt: completedAt,
            },
            upload: {
              status: '',
              uploadedAt: 0,
              message: '',
              targetUrl: '',
            },
            session: {
              lastError: '',
            },
          }),
        };
        if (typeof markCurrentRegistrationAccountUsed === 'function') {
          await markCurrentRegistrationAccountUsed({
            ...currentState,
            ...completionPatch,
          }, {
            logPrefix: 'Grok 注册成功',
            level: 'ok',
          });
        }
        await log('步骤 5：已提取 Grok SSO Cookie。', 'ok', nodeId);
        await completeNode(nodeId, completionPatch);
      } catch (error) {
        const message = getErrorMessage(error);
        await persistState(buildGrokRuntimePatch({
          session: {
            lastError: message,
          },
          register: {
            status: 'error',
          },
        }));
        await log(`步骤 5：${message}`, 'error', nodeId);
        throw error;
      }
    }

    return {
      executeGrokExtractSsoCookie,
      executeGrokOpenSignupPage,
      executeGrokSubmitEmail,
      executeGrokSubmitProfile,
      executeGrokSubmitVerificationCode,
    };
  }

  return {
    DEFAULT_GROK_PAGE_TIMEOUT_MS,
    GROK_COOKIE_CLEAR_DOMAINS,
    GROK_POST_PROFILE_CF_WAIT_MS,
    GROK_PRE_SSO_EXTRACT_WAIT_MS,
    GROK_REGISTER_PAGE_SOURCE_ID,
    GROK_SIGNUP_URL,
    createGrokRegisterRunner,
  };
});
