// phone-sms/providers/nexsms.js — NexSMS 接码平台适配层
(function attachNexSmsProvider(root, factory) {
  root.PhoneSmsNexSmsProvider = factory();
})(typeof self !== 'undefined' ? self : globalThis, function createNexSmsProviderModule() {
  const PROVIDER_ID = 'nexsms';
  const DEFAULT_BASE_URL = 'https://api.nexsms.net';
  const DEFAULT_SERVICE_CODE = 'ot';
  const DEFAULT_SERVICE_LABEL = 'OpenAI';
  const DEFAULT_COUNTRY_ID = 1;
  const DEFAULT_COUNTRY_LABEL = 'Country #1';
  const DEFAULT_REQUEST_TIMEOUT_MS = 20000;

  function normalizeBaseUrl(value = '') {
    const trimmed = String(value || '').trim() || DEFAULT_BASE_URL;
    try {
      return new URL(trimmed).toString().replace(/\/+$/, '');
    } catch {
      return DEFAULT_BASE_URL;
    }
  }

  function normalizeText(value = '', fallback = '') {
    return String(value || '').trim() || fallback;
  }

  function normalizeNexSmsCountryId(value, fallback = DEFAULT_COUNTRY_ID) {
    const parsed = Math.floor(Number(value));
    if (Number.isFinite(parsed) && parsed >= 0) {
      return parsed;
    }
    const fallbackParsed = Math.floor(Number(fallback));
    if (Number.isFinite(fallbackParsed) && fallbackParsed >= 0) {
      return fallbackParsed;
    }
    return DEFAULT_COUNTRY_ID;
  }

  function normalizeNexSmsCountryLabel(value = '', fallback = DEFAULT_COUNTRY_LABEL) {
    return normalizeText(value, fallback);
  }

  function normalizeNexSmsServiceCode(value = '', fallback = DEFAULT_SERVICE_CODE) {
    const normalized = String(value || '').trim().toLowerCase().replace(/[^a-z0-9_-]+/g, '');
    if (normalized) {
      return normalized;
    }
    const fallbackNormalized = String(fallback || '').trim().toLowerCase().replace(/[^a-z0-9_-]+/g, '');
    return fallbackNormalized || DEFAULT_SERVICE_CODE;
  }

  function normalizeNexSmsCountryOrder(value = []) {
    const source = Array.isArray(value)
      ? value
      : String(value || '')
        .split(/[\r\n,，;；]+/)
        .map((entry) => String(entry || '').trim())
        .filter(Boolean);
    const normalized = [];
    const seen = new Set();

    source.forEach((entry) => {
      let id = -1;
      let label = '';
      if (entry && typeof entry === 'object' && !Array.isArray(entry)) {
        id = normalizeNexSmsCountryId(entry.id ?? entry.countryId, -1);
        label = normalizeText(entry.label ?? entry.countryLabel, '');
      } else {
        const text = String(entry || '').trim();
        const structured = text.match(/^(\d+)\s*(?:[:|/-]\s*(.+))?$/);
        id = normalizeNexSmsCountryId(structured?.[1] || text, -1);
        label = normalizeText(structured?.[2], '');
      }
      if (id < 0 || seen.has(id)) {
        return;
      }
      seen.add(id);
      normalized.push({
        id,
        label: label || `Country #${id}`,
      });
      if (normalized.length >= 20) {
        return;
      }
    });

    return normalized;
  }

  function resolveCountryCandidates(state = {}) {
    const candidates = normalizeNexSmsCountryOrder(state?.nexSmsCountryOrder);
    if (candidates.length) {
      return candidates;
    }
    return [{
      id: normalizeNexSmsCountryId(state?.nexSmsCountryId, DEFAULT_COUNTRY_ID),
      label: normalizeNexSmsCountryLabel(state?.nexSmsCountryLabel, DEFAULT_COUNTRY_LABEL),
    }];
  }

  function parsePayload(text) {
    const trimmed = String(text || '').trim();
    if (!trimmed) {
      return '';
    }
    try {
      return JSON.parse(trimmed);
    } catch {
      return trimmed;
    }
  }

  function describePayload(raw) {
    if (typeof raw === 'string') {
      return raw.trim();
    }
    if (raw && typeof raw === 'object') {
      const message = normalizeText(raw.message || raw.error || raw.msg || raw.statusText, '');
      if (message) {
        return message;
      }
      try {
        return JSON.stringify(raw);
      } catch {
        return String(raw);
      }
    }
    return String(raw || '').trim();
  }

  function isSuccessPayload(payload) {
    if (!payload || typeof payload !== 'object' || Array.isArray(payload)) {
      return false;
    }
    return Number(payload.code) === 0;
  }

  function resolveConfig(state = {}, deps = {}) {
    return {
      apiKey: normalizeText(state?.nexSmsApiKey),
      baseUrl: normalizeBaseUrl(state?.nexSmsBaseUrl || DEFAULT_BASE_URL),
      serviceCode: normalizeNexSmsServiceCode(state?.nexSmsServiceCode, DEFAULT_SERVICE_CODE),
      fetchImpl: deps.fetchImpl || (typeof fetch === 'function' ? fetch.bind(globalThis) : null),
      requestTimeoutMs: deps.requestTimeoutMs || DEFAULT_REQUEST_TIMEOUT_MS,
    };
  }

  async function fetchPayload(config, path, actionLabel, options = {}) {
    if (!config.fetchImpl) {
      throw new Error('NexSMS 网络请求实现不可用。');
    }
    if (!config.apiKey) {
      throw new Error('NexSMS API Key 缺失，请先在侧边栏保存接码 API Key。');
    }
    const controller = typeof AbortController === 'function' ? new AbortController() : null;
    const timeoutId = controller
      ? setTimeout(() => controller.abort(), Number(config.requestTimeoutMs) || DEFAULT_REQUEST_TIMEOUT_MS)
      : null;

    try {
      const method = String(options.method || 'GET').trim().toUpperCase() || 'GET';
      const requestUrl = new URL(path.replace(/^\/+/, ''), `${config.baseUrl.replace(/\/+$/, '')}/`);
      requestUrl.searchParams.set('apiKey', config.apiKey);
      Object.entries(options.query || {}).forEach(([key, value]) => {
        if (value === undefined || value === null || value === '') {
          return;
        }
        requestUrl.searchParams.set(key, String(value));
      });
      const headers = {
        Accept: 'application/json',
        ...(options.headers && typeof options.headers === 'object' ? options.headers : {}),
      };
      const requestInit = {
        method,
        headers,
        signal: controller?.signal,
      };
      if (method !== 'GET' && method !== 'HEAD' && options.body !== undefined) {
        requestInit.body = typeof options.body === 'string'
          ? options.body
          : JSON.stringify(options.body);
        if (!requestInit.headers['Content-Type']) {
          requestInit.headers['Content-Type'] = 'application/json';
        }
      }
      const response = await config.fetchImpl(requestUrl.toString(), requestInit);
      const text = await response.text();
      const payload = parsePayload(text);
      if (!response.ok) {
        const error = new Error(`${actionLabel}失败：${describePayload(payload) || response.status}`);
        error.payload = payload;
        error.status = response.status;
        throw error;
      }
      return payload;
    } catch (error) {
      if (error?.name === 'AbortError') {
        throw new Error(`${actionLabel}超时。`);
      }
      throw error;
    } finally {
      if (timeoutId) {
        clearTimeout(timeoutId);
      }
    }
  }

  async function fetchBalance(state = {}, deps = {}) {
    const config = resolveConfig(state, deps);
    const payload = await fetchPayload(config, '/api/user/getBalance', 'NexSMS get balance');
    if (!isSuccessPayload(payload)) {
      throw new Error(`NexSMS get balance 失败：${describePayload(payload) || 'empty response'}`);
    }
    const balance = Number(payload?.data?.balance);
    return {
      balance: Number.isFinite(balance) ? balance : null,
      raw: payload,
    };
  }

  async function fetchPrices(state = {}, countryConfig = {}, deps = {}) {
    const config = resolveConfig(state, deps);
    const countryId = normalizeNexSmsCountryId(countryConfig?.id, DEFAULT_COUNTRY_ID);
    return fetchPayload(config, '/api/getCountryByService', 'NexSMS getCountryByService', {
      query: {
        serviceCode: config.serviceCode,
        countryId,
      },
    });
  }

  function createProvider(deps = {}) {
    const providerDeps = {
      fetchImpl: deps.fetchImpl,
      requestTimeoutMs: deps.requestTimeoutMs || DEFAULT_REQUEST_TIMEOUT_MS,
    };
    return {
      id: PROVIDER_ID,
      label: 'NexSMS',
      defaultCountryId: DEFAULT_COUNTRY_ID,
      defaultCountryLabel: DEFAULT_COUNTRY_LABEL,
      defaultProduct: DEFAULT_SERVICE_LABEL,
      defaultServiceCode: DEFAULT_SERVICE_CODE,
      normalizeCountryId: normalizeNexSmsCountryId,
      normalizeCountryLabel: normalizeNexSmsCountryLabel,
      normalizeCountryOrder: normalizeNexSmsCountryOrder,
      normalizeServiceCode: normalizeNexSmsServiceCode,
      resolveCountryCandidates,
      fetchBalance: (state) => fetchBalance(state, providerDeps),
      fetchPrices: (state, countryConfig) => fetchPrices(state, countryConfig, providerDeps),
      describePayload,
      isSuccessPayload,
    };
  }

  return {
    PROVIDER_ID,
    DEFAULT_BASE_URL,
    DEFAULT_COUNTRY_ID,
    DEFAULT_COUNTRY_LABEL,
    DEFAULT_SERVICE_CODE,
    DEFAULT_SERVICE_LABEL,
    createProvider,
    describePayload,
    isSuccessPayload,
    normalizeNexSmsCountryId,
    normalizeNexSmsCountryLabel,
    normalizeNexSmsCountryOrder,
    normalizeNexSmsServiceCode,
  };
});
