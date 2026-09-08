(function attachBackgroundStep1(root, factory) {
  root.MultiPageBackgroundStep1 = factory();
})(typeof self !== 'undefined' ? self : globalThis, function createBackgroundStep1Module() {
  const STEP1_EXPECTED_ENTRY_URL = 'https://chatgpt.com/';
  const STEP1_OPEN_MAX_ATTEMPTS = 3;
  const STEP1_COOKIE_CLEAR_DOMAINS = [
    'chatgpt.com',
    'chat.openai.com',
    'openai.com',
    'auth.openai.com',
    'auth0.openai.com',
    'accounts.openai.com',
  ];

  function normalizeCookieDomainForStep1(domain) {
    return String(domain || '').trim().replace(/^\.+/, '').toLowerCase();
  }

  function shouldClearStep1Cookie(cookie) {
    const domain = normalizeCookieDomainForStep1(cookie?.domain);
    if (!domain) return false;
    return STEP1_COOKIE_CLEAR_DOMAINS.some((target) => (
      domain === target || domain.endsWith(`.${target}`)
    ));
  }

  function buildStep1CookieKey(cookie, fallbackStoreId = '') {
    return [
      cookie?.storeId || fallbackStoreId || '',
      cookie?.domain || '',
      cookie?.path || '',
      cookie?.name || '',
      cookie?.partitionKey ? JSON.stringify(cookie.partitionKey) : '',
    ].join('|');
  }

  function buildStep1CookieRemovalUrl(cookie) {
    const host = normalizeCookieDomainForStep1(cookie?.domain);
    const rawPath = String(cookie?.path || '/');
    const path = rawPath.startsWith('/') ? rawPath : `/${rawPath}`;
    return `https://${host}${path}`;
  }

  function getStep1ErrorMessage(error) {
    return error?.message || String(error || '未知错误');
  }

  function parseStep1Url(rawUrl = '') {
    if (!rawUrl) {
      return null;
    }
    try {
      return new URL(String(rawUrl || '').trim());
    } catch {
      return null;
    }
  }

  function isExpectedStep1LandingUrl(rawUrl = '') {
    const parsed = parseStep1Url(rawUrl);
    return Boolean(parsed && parsed.hostname === 'chatgpt.com' && parsed.pathname === '/');
  }

  async function collectStep1Cookies(chromeApi) {
    if (!chromeApi.cookies?.getAll) {
      return [];
    }

    const stores = chromeApi.cookies.getAllCookieStores
      ? await chromeApi.cookies.getAllCookieStores()
      : [{ id: undefined }];
    const cookies = [];
    const seen = new Set();
    const queryDomains = Array.from(
      new Set(
        STEP1_COOKIE_CLEAR_DOMAINS
          .map((domain) => normalizeCookieDomainForStep1(domain))
          .filter(Boolean)
      )
    );

    for (const store of stores) {
      const storeId = store?.id;
      for (const domain of queryDomains) {
        let batch = [];
        try {
          batch = await chromeApi.cookies.getAll(
            storeId
              ? { storeId, domain }
              : { domain }
          );
        } catch (error) {
          console.warn('[MultiPage:step1] query cookies failed', {
            storeId: storeId || '',
            domain,
            message: getStep1ErrorMessage(error),
          });
          continue;
        }
        for (const cookie of batch || []) {
          if (!shouldClearStep1Cookie(cookie)) continue;
          const key = buildStep1CookieKey(cookie, storeId);
          if (seen.has(key)) continue;
          seen.add(key);
          cookies.push(cookie);
        }
      }
    }

    return cookies;
  }

  async function removeStep1Cookie(chromeApi, cookie) {
    const details = {
      url: buildStep1CookieRemovalUrl(cookie),
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
      console.warn('[MultiPage:step1] remove cookie failed', {
        domain: cookie?.domain,
        name: cookie?.name,
        message: getStep1ErrorMessage(error),
      });
      return false;
    }
  }

  function createStep1Executor(deps = {}) {
    const {
      addLog,
      chrome: chromeApi = globalThis.chrome,
      completeNodeFromBackground,
      openSignupEntryTab,
      waitForTabStableComplete = null,
    } = deps;

    async function clearOpenAiCookiesBeforeStep1() {
      if (!chromeApi?.cookies?.getAll || !chromeApi.cookies?.remove) {
        await addLog('步骤 1：当前浏览器不支持 cookies API，跳过打开官网前 cookie 清理。', 'warn');
        return;
      }

      const startedAt = Date.now();
      await addLog('步骤 1：打开 ChatGPT 官网前清理 ChatGPT / OpenAI cookies...', 'info');
      const cookies = await collectStep1Cookies(chromeApi);
      let removedCount = 0;
      for (const cookie of cookies) {
        if (await removeStep1Cookie(chromeApi, cookie)) {
          removedCount += 1;
        }
      }

      const elapsedMs = Date.now() - startedAt;
      await addLog(`步骤 1：已清理 ${removedCount} 个 ChatGPT / OpenAI cookies（耗时 ${elapsedMs}ms）。`, 'ok');
    }

    async function resolveStep1LandingUrl(tabId) {
      if (Number.isInteger(tabId) && typeof waitForTabStableComplete === 'function') {
        const stableTab = await waitForTabStableComplete(tabId, {
          timeoutMs: 45000,
          retryDelayMs: 300,
          stableMs: 1500,
          initialDelayMs: 300,
        }).catch(() => null);
        if (stableTab?.url) {
          return String(stableTab.url || '').trim();
        }
      }

      if (Number.isInteger(tabId) && chromeApi?.tabs?.get) {
        const currentTab = await chromeApi.tabs.get(tabId).catch(() => null);
        return String(currentTab?.url || '').trim();
      }

      return '';
    }

    async function executeStep1() {
      for (let attempt = 1; attempt <= STEP1_OPEN_MAX_ATTEMPTS; attempt += 1) {
        await clearOpenAiCookiesBeforeStep1();
        await addLog('步骤 1：正在打开 ChatGPT 官网...');
        const openedTab = await openSignupEntryTab(1);
        const tabId = Number.isInteger(openedTab)
          ? openedTab
          : (Number.isInteger(openedTab?.tabId) ? openedTab.tabId : null);
        const landingUrl = await resolveStep1LandingUrl(tabId);

        if (landingUrl && isExpectedStep1LandingUrl(landingUrl)) {
          await completeNodeFromBackground('open-chatgpt', {});
          return;
        }

        if (attempt < STEP1_OPEN_MAX_ATTEMPTS) {
          await addLog(
            `步骤 1：官网打开后最终 URL 异常：${landingUrl || 'unknown'}，预期为 ${STEP1_EXPECTED_ENTRY_URL}，将重新清理 cookies 后重试（第 ${attempt + 1}/${STEP1_OPEN_MAX_ATTEMPTS} 次）。`,
            'warn'
          );
          continue;
        }

        throw new Error(
          `步骤 1：打开 ChatGPT 官网后最终 URL 异常：${landingUrl || 'unknown'}，预期为 ${STEP1_EXPECTED_ENTRY_URL}。已连续清理 cookies 并重试 ${STEP1_OPEN_MAX_ATTEMPTS} 次，仍未进入官网首页。`
        );
      }
    }

    return { executeStep1 };
  }

  return { createStep1Executor };
});
