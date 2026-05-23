(function attachBackgroundRemoteAccountInjectApi(root, factory) {
  root.MultiPageBackgroundRemoteAccountInjectApi = factory();
})(typeof self !== 'undefined' ? self : globalThis, function createBackgroundRemoteAccountInjectApiModule() {
  function normalizeString(value = '') {
    return String(value ?? '').trim();
  }

  function normalizeRemoteAccountInjectUrl(rawUrl = '') {
    const value = normalizeString(rawUrl);
    if (!value) {
      return '';
    }
    const withProtocol = /^https?:\/\//i.test(value) ? value : `http://${value}`;
    let parsed;
    try {
      parsed = new URL(withProtocol);
    } catch (error) {
      throw new Error('远程账号注入地址格式无效，请检查配置。');
    }
    if (!/^https?:$/i.test(parsed.protocol)) {
      throw new Error('远程账号注入地址仅支持 HTTP/HTTPS。');
    }
    return `${parsed.origin}/api/remote-account/inject`;
  }

  function getRemoteAccountInjectErrorMessage(payload, responseStatus = 500) {
    const candidates = [
      payload?.message,
      payload?.detail,
      payload?.error,
      payload?.reason,
    ];
    const message = candidates.map(normalizeString).find(Boolean);
    return message || `远程账号注入请求失败（HTTP ${responseStatus}）。`;
  }

  function createRemoteAccountInjectApi(deps = {}) {
    const {
      fetchImpl = (...args) => fetch(...args),
    } = deps;

    async function injectRemoteAccounts(options = {}) {
      const endpoint = normalizeRemoteAccountInjectUrl(options.url);
      const adminKey = normalizeString(options.adminKey);
      if (!endpoint) {
        return { skipped: true, reason: 'missing_url' };
      }
      if (!adminKey) {
        return { skipped: true, reason: 'missing_admin_key' };
      }

      const timeoutMs = Math.max(1000, Math.floor(Number(options.timeoutMs) || 30000));
      const controller = new AbortController();
      const timer = setTimeout(() => controller.abort(), timeoutMs);

      try {
        const response = await fetchImpl(endpoint, {
          method: 'POST',
          headers: {
            Accept: 'application/json',
            'Content-Type': 'application/json',
            Authorization: `Bearer ${adminKey}`,
          },
          body: JSON.stringify(options.body || {}),
          signal: controller.signal,
        });

        const text = await response.text();
        let payload = null;
        try {
          payload = text ? JSON.parse(text) : null;
        } catch (error) {
          payload = null;
        }

        if (payload && typeof payload === 'object' && Object.prototype.hasOwnProperty.call(payload, 'code')) {
          if (Number(payload.code) === 0) {
            return {
              skipped: false,
              endpoint,
              payload: payload.data,
            };
          }
          throw new Error(getRemoteAccountInjectErrorMessage(payload, response.status));
        }

        if (!response.ok) {
          throw new Error(getRemoteAccountInjectErrorMessage(payload, response.status));
        }

        return {
          skipped: false,
          endpoint,
          payload,
        };
      } catch (error) {
        if (error?.name === 'AbortError') {
          throw new Error('远程账号注入请求超时，请稍后重试。');
        }
        throw error;
      } finally {
        clearTimeout(timer);
      }
    }

    return {
      injectRemoteAccounts,
      normalizeRemoteAccountInjectUrl,
    };
  }

  return {
    createRemoteAccountInjectApi,
    normalizeRemoteAccountInjectUrl,
  };
});
