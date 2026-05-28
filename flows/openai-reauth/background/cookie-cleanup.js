(function attachOpenAiReauthCookieCleanup(root, factory) {
  root.MultiPageOpenAiReauthCookieCleanup = factory();
})(typeof self !== 'undefined' ? self : globalThis, function createOpenAiReauthCookieCleanupModule() {
  const REAUTH_COOKIE_CLEAR_DOMAINS = Object.freeze([
    'chatgpt.com',
    'chat.openai.com',
    'openai.com',
    'auth.openai.com',
    'auth0.openai.com',
    'accounts.openai.com',
  ]);

  function normalizeCookieDomain(domain) {
    return String(domain || '').trim().replace(/^\.+/, '').toLowerCase();
  }

  function shouldClearCookie(cookie) {
    const domain = normalizeCookieDomain(cookie?.domain);
    if (!domain) return false;
    return REAUTH_COOKIE_CLEAR_DOMAINS.some((target) => (
      domain === target || domain.endsWith(`.${target}`)
    ));
  }

  function buildCookieKey(cookie, fallbackStoreId = '') {
    return [
      cookie?.storeId || fallbackStoreId || '',
      cookie?.domain || '',
      cookie?.path || '',
      cookie?.name || '',
      cookie?.partitionKey ? JSON.stringify(cookie.partitionKey) : '',
    ].join('|');
  }

  function buildCookieRemovalUrl(cookie) {
    const host = normalizeCookieDomain(cookie?.domain);
    const rawPath = String(cookie?.path || '/');
    const path = rawPath.startsWith('/') ? rawPath : `/${rawPath}`;
    return `https://${host}${path}`;
  }

  function getErrorMessage(error) {
    return error?.message || String(error || '未知错误');
  }

  async function collectCookies(chromeApi) {
    if (!chromeApi?.cookies?.getAll) {
      return [];
    }
    const stores = chromeApi.cookies.getAllCookieStores
      ? await chromeApi.cookies.getAllCookieStores()
      : [{ id: undefined }];
    const cookies = [];
    const seen = new Set();
    const queryDomains = Array.from(
      new Set(REAUTH_COOKIE_CLEAR_DOMAINS.map(normalizeCookieDomain).filter(Boolean))
    );

    for (const store of stores) {
      const storeId = store?.id;
      for (const domain of queryDomains) {
        let batch = [];
        try {
          batch = await chromeApi.cookies.getAll(
            storeId ? { storeId, domain } : { domain }
          );
        } catch (error) {
          console.warn('[MultiPage:reauth-cookie-cleanup] query cookies failed', {
            storeId: storeId || '',
            domain,
            message: getErrorMessage(error),
          });
          continue;
        }
        for (const cookie of batch || []) {
          if (!shouldClearCookie(cookie)) continue;
          const key = buildCookieKey(cookie, storeId);
          if (seen.has(key)) continue;
          seen.add(key);
          cookies.push(cookie);
        }
      }
    }
    return cookies;
  }

  async function removeCookie(chromeApi, cookie) {
    const details = {
      url: buildCookieRemovalUrl(cookie),
      name: cookie.name,
    };
    if (cookie.storeId) details.storeId = cookie.storeId;
    if (cookie.partitionKey) details.partitionKey = cookie.partitionKey;

    try {
      const result = await chromeApi.cookies.remove(details);
      return Boolean(result);
    } catch (error) {
      console.warn('[MultiPage:reauth-cookie-cleanup] remove cookie failed', {
        domain: cookie?.domain,
        name: cookie?.name,
        message: getErrorMessage(error),
      });
      return false;
    }
  }

  async function clearOpenAiAuthCookies({ chromeApi } = {}) {
    if (!chromeApi?.cookies) {
      return { collected: 0, removed: 0 };
    }
    const cookies = await collectCookies(chromeApi);
    let removed = 0;
    for (const cookie of cookies) {
      if (await removeCookie(chromeApi, cookie)) removed += 1;
    }
    return { collected: cookies.length, removed };
  }

  return {
    REAUTH_COOKIE_CLEAR_DOMAINS,
    clearOpenAiAuthCookies,
  };
});
