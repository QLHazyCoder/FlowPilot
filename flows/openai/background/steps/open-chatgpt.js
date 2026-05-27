(function attachBackgroundStep1(root, factory) {
  root.MultiPageBackgroundStep1 = factory();
})(typeof self !== 'undefined' ? self : globalThis, function createBackgroundStep1Module() {
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
    return error?.message || String(error || 'Unknown error');
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
    } = deps;

    async function clearOpenAiCookiesBeforeStep1() {
      if (!chromeApi?.cookies?.getAll || !chromeApi.cookies?.remove) {
        await addLog('Step 1: The current browser does not support the cookies API. Skipping cookie cleanup before opening the website.', 'warn');
        return;
      }

      const startedAt = Date.now();
      await addLog('Step 1: Clearing ChatGPT / OpenAI cookies before opening the ChatGPT website...', 'info');
      const cookies = await collectStep1Cookies(chromeApi);
      let removedCount = 0;
      for (const cookie of cookies) {
        if (await removeStep1Cookie(chromeApi, cookie)) {
          removedCount += 1;
        }
      }

      const elapsedMs = Date.now() - startedAt;
      await addLog(`Step 1: Cleared ${removedCount} ChatGPT / OpenAI cookies (took ${elapsedMs}ms).`, 'ok');
    }

    async function executeStep1() {
      await clearOpenAiCookiesBeforeStep1();
      await addLog('Step 1: Opening the ChatGPT website...');
      await openSignupEntryTab(1);
      await completeNodeFromBackground('open-chatgpt', {});
    }

    return { executeStep1 };
  }

  return { createStep1Executor };
});
