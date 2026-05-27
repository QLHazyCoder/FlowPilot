// background/ip-proxy-provider-711proxy.js — 711Proxy parameters and account rules
(function register711ProxyProvider(root) {
  function normalizeCountryCode(value = '') {
    const raw = String(value || '').trim().toUpperCase().replace(/[^A-Z]/g, '');
    return /^[A-Z]{2}$/.test(raw) ? raw : '';
  }

  function normalize711SessionId(value = '') {
    return String(value || '').trim().replace(/[^A-Za-z0-9_-]/g, '').slice(0, 64);
  }

  function normalize711SessionMinutes(value = '') {
    const raw = String(value ?? '').trim();
    if (!raw) return '';
    const numeric = Number.parseInt(raw, 10);
    if (!Number.isInteger(numeric)) return '';
    return String(Math.max(1, Math.min(180, numeric)));
  }

  function apply711SessionToUsername(username = '', options = {}) {
    const text = String(username || '').trim();
    if (!text) {
      return text;
    }

    const sessionId = normalize711SessionId(options?.sessionId || '');
    const sessTime = normalize711SessionMinutes(options?.sessTime || '');
    let next = text;

    if (sessionId) {
      if (/(?:^|[-_])session[-_:][A-Za-z0-9_-]+?(?=(?:[-_](?:sessTime|sessAuto|region|life|zone|ptype|country|area)\b)|$)/i.test(next)) {
        next = next.replace(
          /((?:^|[-_])session[-_:])([A-Za-z0-9_-]+?)(?=(?:[-_](?:sessTime|sessAuto|region|life|zone|ptype|country|area)\b)|$)/i,
          `$1${sessionId}`
        );
      } else {
        next = `${next}-session-${sessionId}`;
      }
    }

    if (sessTime) {
      if (/(?:^|[-_])sessTime[-_:]?\d+\b/i.test(next)) {
        next = next.replace(/((?:^|[-_])sessTime[-_:]?)(\d+)\b/i, `$1${sessTime}`);
      } else {
        next = `${next}-sessTime-${sessTime}`;
      }
    }

    return next;
  }

  function apply711RegionToUsername(username = '', regionCode = '') {
    const text = String(username || '').trim();
    const normalizedRegion = normalizeCountryCode(regionCode);
    if (!text || !normalizedRegion) {
      return text;
    }
    if (/(?:^|[-_])region[-_:]?[A-Za-z]{2}\b/i.test(text)) {
      return text.replace(/((?:^|[-_])region[-_:]?)([A-Za-z]{2})\b/i, `$1${normalizedRegion}`);
    }
    return `${text}-region-${normalizedRegion}`;
  }

  function transform711ProxyAccountEntry(entry = {}, context = {}) {
    const state = context?.state || {};
    const hasAccountList = Boolean(context?.hasAccountList);
    const nextEntry = { ...entry };
    const username = String(nextEntry.username || '').trim();
    if (!username) {
      return nextEntry;
    }

    const configuredRegion = normalizeCountryCode(state?.ipProxyRegion || '');
    if (!hasAccountList && configuredRegion) {
      nextEntry.username = apply711RegionToUsername(username, configuredRegion);
      if (!String(nextEntry.region || '').trim()) {
        nextEntry.region = configuredRegion;
      }
    }

    // Account list mode honors each line as-is — do not overlay fixed account region's session/sessTime.
    if (hasAccountList) {
      return nextEntry;
    }

    const sessionId = normalize711SessionId(state?.ipProxyAccountSessionPrefix || '');
    const sessTime = normalize711SessionMinutes(state?.ipProxyAccountLifeMinutes || '');
    if (!sessionId && !sessTime) {
      return nextEntry;
    }

    nextEntry.username = apply711SessionToUsername(nextEntry.username, {
      sessionId,
      sessTime,
    });
    return nextEntry;
  }

  root.transformIpProxyAccountEntryByProvider = function transformIpProxyAccountEntryByProvider(
    provider = '',
    entry = {},
    context = {}
  ) {
    const normalizedProvider = String(provider || '').trim().toLowerCase();
    if (normalizedProvider === '711proxy') {
      return transform711ProxyAccountEntry(entry, context);
    }
    return entry;
  };
})(typeof self !== 'undefined' ? self : globalThis);
