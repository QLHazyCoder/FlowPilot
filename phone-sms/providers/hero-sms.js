// phone-sms/providers/hero-sms.js — HeroSMS SMS verification provider adapter
(function attachHeroSmsProvider(root, factory) {
  root.PhoneSmsHeroSmsProvider = factory();
})(typeof self !== 'undefined' ? self : globalThis, function createHeroSmsProviderModule() {
  const PROVIDER_ID = 'hero-sms';
  const DEFAULT_BASE_URL = 'https://hero-sms.com/stubs/handler_api.php';
  const DEFAULT_SERVICE_CODE = 'dr';
  const DEFAULT_SERVICE_LABEL = 'OpenAI';
  const DEFAULT_COUNTRY_ID = 52;
  const DEFAULT_COUNTRY_LABEL = 'Thailand';
  const DEFAULT_REQUEST_TIMEOUT_MS = 20000;

  function normalizeHeroSmsCountryId(value, fallback = DEFAULT_COUNTRY_ID) {
    const parsed = Math.floor(Number(value));
    if (Number.isFinite(parsed) && parsed > 0) return parsed;
    const fallbackParsed = Math.floor(Number(fallback));
    return Number.isFinite(fallbackParsed) && fallbackParsed > 0 ? fallbackParsed : DEFAULT_COUNTRY_ID;
  }

  function normalizeHeroSmsCountryLabel(value = '', fallback = DEFAULT_COUNTRY_LABEL) {
    return String(value || '').trim() || fallback;
  }

  function normalizeHeroSmsMaxPrice(value = '') {
    const rawValue = String(value ?? '').trim();
    if (!rawValue) return '';
    const numeric = Number(rawValue);
    if (!Number.isFinite(numeric) || numeric <= 0) return '';
    return String(Math.round(numeric * 10000) / 10000);
  }

  function normalizeHeroSmsCountryFallback(value = []) {
    const source = Array.isArray(value)
      ? value
      : String(value || '')
        .split(/[\r\n,，;；]+/)
        .map((entry) => String(entry || '').trim())
        .filter(Boolean);
    const seen = new Set();
    const normalized = [];
    for (const entry of source) {
      let id = 0;
      let label = '';
      if (entry && typeof entry === 'object' && !Array.isArray(entry)) {
        id = normalizeHeroSmsCountryId(entry.id ?? entry.countryId, 0);
        label = String((entry.label ?? entry.countryLabel) || '').trim();
      } else {
        const text = String(entry || '').trim();
        const structured = text.match(/^(\d+)\s*(?:[:|/-]\s*(.+))?$/);
        id = normalizeHeroSmsCountryId(structured?.[1] || text, 0);
        label = String(structured?.[2] || '').trim();
      }
      if (!id || seen.has(id)) continue;
      seen.add(id);
      normalized.push({ id, label: label || `Country #${id}` });
      if (normalized.length >= 20) break;
    }
    return normalized;
  }

  function normalizeBaseUrl(value = '') {
    const trimmed = String(value || '').trim() || DEFAULT_BASE_URL;
    try {
      return new URL(trimmed).toString();
    } catch {
      return DEFAULT_BASE_URL;
    }
  }

  function buildUrl(config = {}, query = {}) {
    const url = new URL(normalizeBaseUrl(config.baseUrl));
    Object.entries(query || {}).forEach(([key, value]) => {
      if (value === undefined || value === null || value === '') return;
      url.searchParams.set(key, String(value));
    });
    return url.toString();
  }

  function parsePayload(text) {
    const trimmed = String(text || '').trim();
    if (!trimmed) return '';
    if ((trimmed.startsWith('{') && trimmed.endsWith('}')) || (trimmed.startsWith('[') && trimmed.endsWith(']'))) {
      try { return JSON.parse(trimmed); } catch { return trimmed; }
    }
    return trimmed;
  }

  function describePayload(raw) {
    if (typeof raw === 'string') return raw.trim();
    if (raw && typeof raw === 'object') {
      const direct = String(raw.message || raw.msg || raw.error || raw.title || raw.status || '').trim();
      if (direct) return direct;
      try { return JSON.stringify(raw); } catch { return String(raw); }
    }
    return String(raw || '').trim();
  }

  function resolveConfig(state = {}, deps = {}) {
    return {
      apiKey: String(state.heroSmsApiKey || '').trim(),
      baseUrl: state.heroSmsBaseUrl || DEFAULT_BASE_URL,
      fetchImpl: deps.fetchImpl || (typeof fetch === 'function' ? fetch.bind(globalThis) : null),
      requestTimeoutMs: deps.requestTimeoutMs || DEFAULT_REQUEST_TIMEOUT_MS,
    };
  }

  async function fetchPayload(config, query, actionLabel = 'HeroSMS request') {
    if (query.api_key === undefined && config.apiKey) {
      query = { api_key: config.apiKey, ...query };
    }
    if (!config.fetchImpl) {
      throw new Error('HeroSMS network fetch implementation is unavailable.');
    }
    const controller = typeof AbortController === 'function' ? new AbortController() : null;
    const timeoutId = controller
      ? setTimeout(() => controller.abort(), Number(config.requestTimeoutMs) || DEFAULT_REQUEST_TIMEOUT_MS)
      : null;
    try {
      const response = await config.fetchImpl(buildUrl(config, query), {
        method: 'GET',
        signal: controller?.signal,
      });
      const text = await response.text();
      const payload = parsePayload(text);
      if (!response.ok) {
        const error = new Error(`${actionLabel} failed: ${describePayload(payload) || response.status}`);
        error.payload = payload;
        error.status = response.status;
        throw error;
      }
      return payload;
    } catch (error) {
      if (error?.name === 'AbortError') {
        throw new Error(`${actionLabel} timed out.`);
      }
      throw error;
    } finally {
      if (timeoutId) clearTimeout(timeoutId);
    }
  }

  function resolveCountryConfig(state = {}) {
    return {
      id: normalizeHeroSmsCountryId(state.heroSmsCountryId),
      label: normalizeHeroSmsCountryLabel(state.heroSmsCountryLabel),
    };
  }

  function resolveCountryCandidates(state = {}) {
    const primary = resolveCountryConfig(state);
    const seen = new Set([primary.id]);
    const candidates = [primary];
    normalizeHeroSmsCountryFallback(state.heroSmsCountryFallback).forEach((entry) => {
      const id = normalizeHeroSmsCountryId(entry.id, 0);
      if (!id || seen.has(id)) return;
      seen.add(id);
      candidates.push({ id, label: normalizeHeroSmsCountryLabel(entry.label, `Country #${id}`) });
    });
    return candidates;
  }

  async function fetchBalance(state = {}, deps = {}) {
    const config = resolveConfig(state, deps);
    if (!config.apiKey) {
      throw new Error('HeroSMS API key is missing. Please save the SMS verification API key in the side panel first.');
    }
    const payload = await fetchPayload(config, { action: 'getBalance' }, 'HeroSMS getBalance');
    const balance = Number(String(describePayload(payload)).replace(/^ACCESS_BALANCE:/i, '').trim());
    return { balance, raw: payload };
  }

  async function fetchPrices(state = {}, countryConfig = resolveCountryConfig(state), deps = {}) {
    const config = resolveConfig(state, deps);
    return fetchPayload(config, {
      action: 'getPrices',
      service: DEFAULT_SERVICE_CODE,
      country: normalizeHeroSmsCountryId(countryConfig?.id),
    }, 'HeroSMS getPrices');
  }

  function createProvider(deps = {}) {
    return {
      id: PROVIDER_ID,
      label: 'HeroSMS',
      defaultCountryId: DEFAULT_COUNTRY_ID,
      defaultCountryLabel: DEFAULT_COUNTRY_LABEL,
      defaultProduct: DEFAULT_SERVICE_LABEL,
      normalizeCountryId: normalizeHeroSmsCountryId,
      normalizeCountryLabel: normalizeHeroSmsCountryLabel,
      normalizeCountryFallback: normalizeHeroSmsCountryFallback,
      normalizeMaxPrice: normalizeHeroSmsMaxPrice,
      resolveCountryCandidates,
      fetchBalance: (state) => fetchBalance(state, deps),
      fetchPrices: (state, countryConfig) => fetchPrices(state, countryConfig, deps),
      describePayload,
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
    normalizeHeroSmsCountryFallback,
    normalizeHeroSmsCountryId,
    normalizeHeroSmsCountryLabel,
    normalizeHeroSmsMaxPrice,
  };
});
