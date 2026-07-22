(function attachBackgroundSub2ApiSessionImport(root, factory) {
  root.MultiPageBackgroundSub2ApiSessionImport = factory();
})(typeof self !== 'undefined' ? self : globalThis, function createBackgroundSub2ApiSessionImportModule() {
  const PLUS_CHECKOUT_SOURCE = 'plus-checkout';
  const PLUS_CHECKOUT_INJECT_FILES = ['content/utils.js', 'content/operation-delay.js', 'flows/openai/content/plus-checkout.js'];
  const SESSION_READ_INITIAL_DELAY_MS = 1000;
  const SESSION_READ_RETRY_DELAY_MS = 2000;
  const SESSION_READ_MAX_ATTEMPTS = 11;

  function createSub2ApiSessionImportExecutor(deps = {}) {
    const {
      addLog: rawAddLog = async () => {},
      chrome,
      completeNodeFromBackground,
      ensureContentScriptReadyOnTabUntilStopped,
      getTabId,
      isTabAlive,
      normalizeSub2ApiUrl = (value) => value,
      registerTab,
      sendTabMessageUntilStopped,
      sessionReadInitialDelayMs = SESSION_READ_INITIAL_DELAY_MS,
      sessionReadRetryDelayMs = SESSION_READ_RETRY_DELAY_MS,
      sessionReadMaxAttempts = SESSION_READ_MAX_ATTEMPTS,
      sleepWithStop = async () => {},
      throwIfStopped = () => {},
      waitForTabCompleteUntilStopped = async () => {},
      DEFAULT_SUB2API_GROUP_NAME = 'codex',
    } = deps;

    let sub2ApiApi = null;

    function addStepLog(step, message, level = 'info') {
      return rawAddLog(message, level, {
        step,
        stepKey: 'sub2api-session-import',
      });
    }

    function getSub2ApiApi() {
      if (sub2ApiApi) {
        return sub2ApiApi;
      }
      const factory = deps.createSub2ApiApi
        || self.MultiPageBackgroundSub2ApiApi?.createSub2ApiApi;
      if (typeof factory !== 'function') {
        throw new Error('SUB2API 接口模块未加载，无法导入当前 ChatGPT 会话。');
      }
      sub2ApiApi = factory({
        addLog: rawAddLog,
        normalizeSub2ApiUrl,
        DEFAULT_SUB2API_GROUP_NAME,
      });
      return sub2ApiApi;
    }

    function normalizeString(value = '') {
      return String(value || '').trim();
    }

    function resolveVisibleStep(state = {}) {
      const visibleStep = Math.floor(Number(state?.visibleStep) || 0);
      return visibleStep > 0 ? visibleStep : 10;
    }

    function isSupportedChatGptSessionUrl(url = '') {
      try {
        const parsed = new URL(String(url || ''));
        if (!/^https?:$/i.test(parsed.protocol)) {
          return false;
        }
        const hostname = String(parsed.hostname || '').trim().toLowerCase();
        return /(^|\.)chatgpt\.com$/.test(hostname)
          || hostname === 'chat.openai.com'
          || /(^|\.)openai\.com$/.test(hostname);
      } catch {
        return false;
      }
    }

    function getSessionTabHostPriority(url = '') {
      try {
        const hostname = String(new URL(String(url || '')).hostname || '').trim().toLowerCase();
        if (/(^|\.)chatgpt\.com$/.test(hostname)) {
          return 0;
        }
        if (hostname === 'chat.openai.com') {
          return 1;
        }
        if (/(^|\.)openai\.com$/.test(hostname)) {
          return 2;
        }
      } catch {
        return Number.POSITIVE_INFINITY;
      }
      return Number.POSITIVE_INFINITY;
    }

    function getSessionTabActivityPriority(tab = {}) {
      if (tab?.active && tab?.currentWindow) {
        return 0;
      }
      if (tab?.active) {
        return 1;
      }
      return 2;
    }

    function pickPreferredSessionTab(tabs = []) {
      const candidates = (Array.isArray(tabs) ? tabs : [])
        .filter((tab) => Number.isInteger(tab?.id) && isSupportedChatGptSessionUrl(tab.url));
      if (!candidates.length) {
        return null;
      }

      return candidates.reduce((best, candidate) => {
        if (!best) {
          return candidate;
        }

        const candidateHostPriority = getSessionTabHostPriority(candidate.url);
        const bestHostPriority = getSessionTabHostPriority(best.url);
        if (candidateHostPriority !== bestHostPriority) {
          return candidateHostPriority < bestHostPriority ? candidate : best;
        }

        const candidateActivityPriority = getSessionTabActivityPriority(candidate);
        const bestActivityPriority = getSessionTabActivityPriority(best);
        if (candidateActivityPriority !== bestActivityPriority) {
          return candidateActivityPriority < bestActivityPriority ? candidate : best;
        }

        const candidateLastAccessed = Number(candidate?.lastAccessed) || 0;
        const bestLastAccessed = Number(best?.lastAccessed) || 0;
        if (candidateLastAccessed !== bestLastAccessed) {
          return candidateLastAccessed > bestLastAccessed ? candidate : best;
        }

        return Number(candidate.id) < Number(best.id) ? candidate : best;
      }, null);
    }

    async function readSupportedSessionTab(tabId) {
      const numericTabId = Number(tabId) || 0;
      if (!numericTabId || !chrome?.tabs?.get) {
        return null;
      }

      const tab = await chrome.tabs.get(numericTabId).catch(() => null);
      return tab?.id && isSupportedChatGptSessionUrl(tab.url)
        ? tab
        : null;
    }

    async function findFallbackSessionTab() {
      if (!chrome?.tabs?.query) {
        return null;
      }

      const activeTabs = await chrome.tabs.query({ active: true, currentWindow: true }).catch(() => []);
      const activeMatch = pickPreferredSessionTab(activeTabs);
      const allTabs = await chrome.tabs.query({}).catch(() => []);
      const globalMatch = pickPreferredSessionTab(allTabs);
      return pickPreferredSessionTab([activeMatch, globalMatch]);
    }

    async function resolveSessionTabId(state = {}) {
      const registeredTabId = typeof getTabId === 'function'
        ? await getTabId(PLUS_CHECKOUT_SOURCE)
        : null;
      if (registeredTabId && typeof isTabAlive === 'function' && await isTabAlive(PLUS_CHECKOUT_SOURCE)) {
        const registeredTab = await readSupportedSessionTab(registeredTabId);
        if (registeredTab?.id) {
          return registeredTab.id;
        }
      }

      const storedTabId = Number(state?.plusCheckoutTabId) || 0;
      const storedTab = await readSupportedSessionTab(storedTabId);
      if (storedTab?.id) {
        if (typeof registerTab === 'function') {
          await registerTab(PLUS_CHECKOUT_SOURCE, storedTab.id);
        }
        return storedTab.id;
      }

      const fallbackTab = await findFallbackSessionTab();
      if (fallbackTab?.id) {
        if (typeof registerTab === 'function') {
          await registerTab(PLUS_CHECKOUT_SOURCE, fallbackTab.id);
        }
        return fallbackTab.id;
      }

      throw new Error('未找到可读取 ChatGPT 会话的标签页，请先打开一个已登录的 ChatGPT / OpenAI 页面，或完成当前 Plus 支付链路。');
    }

    async function getResolvedSessionTab(tabId, visibleStep) {
      const tab = await chrome?.tabs?.get?.(tabId).catch(() => null);
      if (!tab?.id) {
        throw new Error(`步骤 ${visibleStep}：ChatGPT 会话标签页不存在或已关闭，无法继续导入 SUB2API。`);
      }
      if (!isSupportedChatGptSessionUrl(tab.url)) {
        throw new Error(`步骤 ${visibleStep}：当前标签页不在 ChatGPT / OpenAI 页面，无法读取当前登录会话。`);
      }
      return tab;
    }

    async function requestCurrentChatGptSession(tabId, visibleStep, options = {}) {
      await ensureContentScriptReadyOnTabUntilStopped(PLUS_CHECKOUT_SOURCE, tabId, {
        inject: PLUS_CHECKOUT_INJECT_FILES,
        injectSource: PLUS_CHECKOUT_SOURCE,
        logMessage: `步骤 ${visibleStep}：正在等待 ChatGPT 会话页完成加载，再继续读取当前登录会话...`,
      });

      const sessionResult = await sendTabMessageUntilStopped(tabId, PLUS_CHECKOUT_SOURCE, {
        type: 'PLUS_CHECKOUT_GET_STATE',
        source: 'background',
        payload: {
          includeSession: true,
          includeAccessToken: true,
        },
      });
      if (sessionResult?.error) {
        throw new Error(sessionResult.error);
      }

      const session = sessionResult?.session && typeof sessionResult.session === 'object' && !Array.isArray(sessionResult.session)
        ? sessionResult.session
        : null;
      const accessToken = normalizeString(
        sessionResult?.accessToken
        || session?.accessToken
      );
      if (options.requireAccessToken && !accessToken) {
        throw new Error(`步骤 ${visibleStep}：未读取到 ChatGPT accessToken，请确认当前标签页仍处于已登录状态。`);
      }
      if (!session && !accessToken) {
        throw new Error(`步骤 ${visibleStep}：未读取到有效的 ChatGPT 会话或 accessToken，请确认当前标签页仍处于已登录状态。`);
      }

      return {
        session,
        accessToken,
      };
    }

    async function readCurrentChatGptSession(tabId, visibleStep, options = {}) {
      await waitForTabCompleteUntilStopped(tabId);

      const firstDelayMs = Math.max(0, Math.floor(Number(sessionReadInitialDelayMs) || 0));
      const retryDelayMs = Math.max(0, Math.floor(Number(sessionReadRetryDelayMs) || 0));
      const maxAttempts = Math.max(1, Math.floor(Number(sessionReadMaxAttempts) || SESSION_READ_MAX_ATTEMPTS));
      let lastError = null;

      for (let attempt = 1; attempt <= maxAttempts; attempt += 1) {
        throwIfStopped();
        const delayMs = attempt === 1 ? firstDelayMs : retryDelayMs;
        if (delayMs > 0) {
          await sleepWithStop(delayMs);
        }

        try {
          return await requestCurrentChatGptSession(tabId, visibleStep, options);
        } catch (error) {
          lastError = error;
          if (attempt >= maxAttempts) {
            break;
          }
          await addStepLog(
            visibleStep,
            `未读取到 ChatGPT session/accessToken，${Math.round(retryDelayMs / 1000)} 秒后重试...`,
            'warn'
          );
        }
      }

      throw lastError || new Error(`步骤 ${visibleStep}：未读取到有效的 ChatGPT 会话或 accessToken，请确认当前标签页仍处于已登录状态。`);
    }

    async function executeSub2ApiSessionImport(state = {}) {
      throwIfStopped();
      const visibleStep = resolveVisibleStep(state);
      const api = getSub2ApiApi();

      await addStepLog(visibleStep, '正在定位当前 ChatGPT 会话页并准备导入 SUB2API...', 'info');
      const tabId = await resolveSessionTabId(state);
      const tab = await getResolvedSessionTab(tabId, visibleStep);
      if (chrome?.tabs?.update) {
        await chrome.tabs.update(tab.id, { active: true }).catch(() => {});
      }

      await addStepLog(visibleStep, '正在读取当前 ChatGPT 登录会话...', 'info');
      const sessionState = await readCurrentChatGptSession(tab.id, visibleStep);
      throwIfStopped();

      const result = await api.importCurrentChatGptSession({
        ...state,
        session: sessionState.session,
        accessToken: sessionState.accessToken,
      }, {
        visibleStep,
        logLabel: `步骤 ${visibleStep}`,
        logOptions: { step: visibleStep, stepKey: 'sub2api-session-import' },
        timeoutMs: 120000,
        importTimeoutMs: 120000,
      });

      await completeNodeFromBackground(state?.nodeId || 'sub2api-session-import', result);
    }

    async function executeSub2ApiAgentIdentityImport(state = {}) {
      throwIfStopped();
      const visibleStep = resolveVisibleStep(state);
      const api = getSub2ApiApi();
      const importAgentIdentity = api.importCurrentChatGptSessionAsAgentIdentity
        || api.importCurrentChatGptSession;

      await addStepLog(visibleStep, '正在定位当前 ChatGPT 会话页并读取 accessToken...', 'info');
      const tabId = await resolveSessionTabId(state);
      const tab = await getResolvedSessionTab(tabId, visibleStep);
      if (chrome?.tabs?.update) {
        await chrome.tabs.update(tab.id, { active: true }).catch(() => {});
      }
      const sessionState = await readCurrentChatGptSession(tab.id, visibleStep, {
        requireAccessToken: true,
      });
      throwIfStopped();

      const result = await importAgentIdentity({
        ...state,
        session: sessionState.session,
        accessToken: sessionState.accessToken,
      }, {
        visibleStep,
        logLabel: `步骤 ${visibleStep}`,
        logOptions: { step: visibleStep, stepKey: 'sub2api-agent-identity-import' },
        timeoutMs: 120000,
        agentTimeoutMs: 60000,
        importTimeoutMs: 120000,
      });
      await completeNodeFromBackground(state?.nodeId || 'sub2api-agent-identity-import', result);
    }

    return {
      executeSub2ApiSessionImport,
      executeSub2ApiAgentIdentityImport,
      isSupportedChatGptSessionUrl,
    };
  }

  return {
    createSub2ApiSessionImportExecutor,
  };
});
