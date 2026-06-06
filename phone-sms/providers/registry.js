// phone-sms/providers/registry.js - phone SMS provider registry
(function attachPhoneSmsProviderRegistry(root, factory) {
  root.PhoneSmsProviderRegistry = factory(root);
})(typeof self !== 'undefined' ? self : globalThis, function createPhoneSmsProviderRegistry(root) {
  const PROVIDER_HERO_SMS = 'hero-sms';
  const PROVIDER_FIVE_SIM = '5sim';
  const PROVIDER_NEXSMS = 'nexsms';
  const PROVIDER_MADAO = 'madao';
  const PROVIDER_CUSTOM_URL = 'custom-url';
  const DEFAULT_PROVIDER = PROVIDER_HERO_SMS;
  const DEFAULT_PROVIDER_ORDER = Object.freeze([
    PROVIDER_HERO_SMS,
    PROVIDER_FIVE_SIM,
    PROVIDER_NEXSMS,
    PROVIDER_MADAO,
    PROVIDER_CUSTOM_URL,
  ]);
  const PROVIDER_DEFINITIONS = Object.freeze({
    [PROVIDER_HERO_SMS]: Object.freeze({
      id: PROVIDER_HERO_SMS,
      label: 'HeroSMS',
      moduleKey: 'PhoneSmsHeroSmsProvider',
    }),
    [PROVIDER_FIVE_SIM]: Object.freeze({
      id: PROVIDER_FIVE_SIM,
      label: '5sim',
      moduleKey: 'PhoneSmsFiveSimProvider',
    }),
    [PROVIDER_NEXSMS]: Object.freeze({
      id: PROVIDER_NEXSMS,
      label: 'NexSMS',
      moduleKey: 'PhoneSmsNexSmsProvider',
    }),
    [PROVIDER_MADAO]: Object.freeze({
      id: PROVIDER_MADAO,
      label: 'MaDao',
      moduleKey: 'PhoneSmsMaDaoProvider',
    }),
    [PROVIDER_CUSTOM_URL]: Object.freeze({
      id: PROVIDER_CUSTOM_URL,
      label: '自定义 URL 接码',
      moduleKey: 'PhoneSmsCustomUrlProvider',
    }),
  });

  function resolveProviderKey(value = '') {
    if (value && typeof value === 'object' && !Array.isArray(value)) {
      return String(value.provider || value.id || value.value || '').trim().toLowerCase();
    }
    return String(value || '').trim().toLowerCase();
  }

  function isKnownProviderId(providerId = '') {
    return Boolean(PROVIDER_DEFINITIONS[providerId]);
  }

  function normalizeProviderId(value = '', fallback = DEFAULT_PROVIDER) {
    const normalized = resolveProviderKey(value);
    if (isKnownProviderId(normalized)) {
      return normalized;
    }
    const fallbackNormalized = resolveProviderKey(fallback);
    if (isKnownProviderId(fallbackNormalized)) {
      return fallbackNormalized;
    }
    return DEFAULT_PROVIDER;
  }

  function normalizeProviderOrder(value = [], fallbackOrder = DEFAULT_PROVIDER_ORDER) {
    const source = Array.isArray(value)
      ? value
      : String(value || '')
        .split(/[\r\n,，;；]+/)
        .map((entry) => String(entry || '').trim())
        .filter(Boolean);
    const normalized = [];
    const seen = new Set();

    const pushProvider = (entry) => {
      const provider = normalizeProviderId(entry, DEFAULT_PROVIDER);
      if (!provider || seen.has(provider)) {
        return;
      }
      seen.add(provider);
      normalized.push(provider);
    };

    source.forEach((entry) => {
      pushProvider(entry && typeof entry === 'object' && !Array.isArray(entry)
        ? (entry.provider || entry.id || entry.value || '')
        : entry);
    });

    if (normalized.length) {
      return normalized.slice(0, DEFAULT_PROVIDER_ORDER.length);
    }

    const fallback = Array.isArray(fallbackOrder) ? fallbackOrder : [];
    fallback.forEach((entry) => {
      pushProvider(entry && typeof entry === 'object' && !Array.isArray(entry)
        ? (entry.provider || entry.id || entry.value || '')
        : entry);
    });

    return normalized.slice(0, DEFAULT_PROVIDER_ORDER.length);
  }

  function getProviderIds() {
    return DEFAULT_PROVIDER_ORDER.slice();
  }

  function getProviderDefinition(providerId = DEFAULT_PROVIDER) {
    return PROVIDER_DEFINITIONS[normalizeProviderId(providerId)] || PROVIDER_DEFINITIONS[DEFAULT_PROVIDER];
  }

  function getProviderModule(providerId = DEFAULT_PROVIDER) {
    const definition = getProviderDefinition(providerId);
    const moduleKey = definition?.moduleKey;
    if (!moduleKey) {
      return null;
    }
    return root?.[moduleKey] || null;
  }

  function createProvider(providerId = DEFAULT_PROVIDER, deps = {}) {
    const definition = getProviderDefinition(providerId);
    const module = getProviderModule(providerId);
    if (!module || typeof module.createProvider !== 'function') {
      throw new Error(`接码平台模块未加载：${definition.id}`);
    }
    return module.createProvider(deps);
  }

  function getProviderLabel(providerId = DEFAULT_PROVIDER) {
    return getProviderDefinition(providerId)?.label || 'HeroSMS';
  }

  return {
    PROVIDER_HERO_SMS,
    PROVIDER_FIVE_SIM,
    PROVIDER_NEXSMS,
    PROVIDER_MADAO,
    PROVIDER_CUSTOM_URL,
    DEFAULT_PROVIDER,
    DEFAULT_PROVIDER_ORDER,
    PROVIDER_DEFINITIONS,
    normalizeProviderId,
    normalizeProviderOrder,
    getProviderIds,
    getProviderDefinition,
    getProviderModule,
    createProvider,
    getProviderLabel,
  };
});
