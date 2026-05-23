(function attachBackgroundRemoteAccountInject(root, factory) {
  root.MultiPageBackgroundRemoteAccountInject = factory();
})(typeof self !== 'undefined' ? self : globalThis, function createBackgroundRemoteAccountInjectModule() {
  const PLUS_CHECKOUT_SOURCE = 'plus-checkout';
  const PLUS_CHECKOUT_INJECT_FILES = ['content/utils.js', 'content/operation-delay.js', 'flows/openai/content/plus-checkout.js'];

  function createRemoteAccountInjectExecutor(deps = {}) {
    const {
      addLog: rawAddLog = async () => {},
      chrome,
      completeNodeFromBackground,
      ensureContentScriptReadyOnTabUntilStopped,
      getTabId,
      isTabAlive,
      registerTab,
      sendTabMessageUntilStopped,
      sleepWithStop = async () => {},
      throwIfStopped = () => {},
      waitForTabCompleteUntilStopped = async () => {},
    } = deps;

    let remoteAccountInjectApi = null;

    function normalizeString(value = '') {
      return String(value ?? '').trim();
    }

    function addStepLog(step, message, level = 'info') {
      return rawAddLog(message, level, {
        step,
        stepKey: 'remote-account-inject',
      });
    }

    function getRemoteAccountInjectApi() {
      if (remoteAccountInjectApi) {
        return remoteAccountInjectApi;
      }
      const factory = deps.createRemoteAccountInjectApi
        || self.MultiPageBackgroundRemoteAccountInjectApi?.createRemoteAccountInjectApi;
      if (typeof factory !== 'function') {
        throw new Error('远程账号注入接口模块未加载。');
      }
      remoteAccountInjectApi = factory({
        fetchImpl: deps.fetchImpl,
      });
      return remoteAccountInjectApi;
    }

    function resolveVisibleStep(state = {}) {
      const visibleStep = Math.floor(Number(state?.visibleStep) || 0);
      return visibleStep > 0 ? visibleStep : 7;
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
      } catch (error) {
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
      } catch (error) {
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

      throw new Error('未找到可读取 ChatGPT 会话的标签页，请先打开一个已登录的 ChatGPT / OpenAI 页面。');
    }

    async function getResolvedSessionTab(tabId, visibleStep) {
      const tab = await chrome?.tabs?.get?.(tabId).catch(() => null);
      if (!tab?.id) {
        throw new Error(`步骤 ${visibleStep}：ChatGPT 会话标签页不存在或已关闭，无法远程注入 accessToken。`);
      }
      if (!isSupportedChatGptSessionUrl(tab.url)) {
        throw new Error(`步骤 ${visibleStep}：当前标签页不在 ChatGPT / OpenAI 页面，无法读取当前登录会话。`);
      }
      return tab;
    }

    async function readCurrentChatGptAccessToken(tabId, visibleStep) {
      await waitForTabCompleteUntilStopped(tabId);
      await sleepWithStop(1000);
      await ensureContentScriptReadyOnTabUntilStopped(PLUS_CHECKOUT_SOURCE, tabId, {
        inject: PLUS_CHECKOUT_INJECT_FILES,
        injectSource: PLUS_CHECKOUT_SOURCE,
        logMessage: `步骤 ${visibleStep}：正在等待 ChatGPT 会话页完成加载，再继续读取 accessToken...`,
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
      const accessToken = normalizeString(sessionResult?.accessToken || session?.accessToken);
      if (!accessToken) {
        throw new Error(`步骤 ${visibleStep}：未读取到 ChatGPT accessToken，请确认当前标签页仍处于已登录状态。`);
      }
      return accessToken;
    }

    async function executeRemoteAccountInject(state = {}) {
      throwIfStopped();
      const visibleStep = resolveVisibleStep(state);
      const nodeId = normalizeString(state?.nodeId) || 'remote-account-inject';
      const url = normalizeString(state?.remoteAccountInjectUrl);
      const adminKey = normalizeString(state?.remoteAccountInjectAdminKey);
      if (!url || !adminKey) {
        await addStepLog(visibleStep, '远程账号注入未配置 URL 或管理员密钥，已跳过。', 'info');
        await completeNodeFromBackground(nodeId, {
          remoteAccountInjectSkipped: true,
          remoteAccountInjectReason: !url ? 'missing_url' : 'missing_admin_key',
        });
        return;
      }

      await addStepLog(visibleStep, '正在读取 ChatGPT accessToken 并注入远程账号池...', 'info');
      const tabId = await resolveSessionTabId(state);
      const tab = await getResolvedSessionTab(tabId, visibleStep);
      if (chrome?.tabs?.update) {
        await chrome.tabs.update(tab.id, { active: true }).catch(() => {});
      }
      const accessToken = await readCurrentChatGptAccessToken(tab.id, visibleStep);
      throwIfStopped();

      const api = getRemoteAccountInjectApi();
      const result = await api.injectRemoteAccounts({
        url,
        adminKey,
        timeoutMs: 30000,
        body: {
          tokens: [accessToken],
          strategy: 'merge',
          source_id: 'flowpilot-codex-at',
          source_name: 'FlowPilot Codex AT',
          provider: 'gpt',
        },
      });

      if (result?.skipped) {
        await addStepLog(visibleStep, '远程账号注入配置不完整，已跳过。', 'info');
        await completeNodeFromBackground(nodeId, {
          remoteAccountInjectSkipped: true,
          remoteAccountInjectReason: result.reason || 'skipped',
        });
        return;
      }

      await addStepLog(visibleStep, '远程账号注入完成：已提交 1 个 accessToken。', 'ok');
      await completeNodeFromBackground(nodeId, {
        remoteAccountInjectSkipped: false,
        remoteAccountInjectSubmitted: 1,
      });
    }

    return {
      executeRemoteAccountInject,
      isSupportedChatGptSessionUrl,
    };
  }

  return {
    createRemoteAccountInjectExecutor,
  };
});
