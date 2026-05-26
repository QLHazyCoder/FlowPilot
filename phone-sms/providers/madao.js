// phone-sms/providers/madao.js — MaDao 统一接码后端适配层
(function attachMaDaoProvider(root, factory) {
  root.PhoneSmsMaDaoProvider = factory();
})(typeof self !== 'undefined' ? self : globalThis, function createMaDaoProviderModule() {
  const PROVIDER_ID = 'madao';
  const DEFAULT_BASE_URL = 'http://127.0.0.1:7822';
  const DEFAULT_SERVICE = 'openai';
  const DEFAULT_REQUEST_TIMEOUT_MS = 20000;

  function normalizeBaseUrl(value = '', fallback = DEFAULT_BASE_URL) {
    const trimmed = String(value || '').trim() || fallback;
    try {
      return new URL(trimmed).toString().replace(/\/+$/, '');
    } catch {
      return fallback;
    }
  }

  function normalizeText(value = '', fallback = '') {
    return String(value || '').trim() || fallback;
  }

  function normalizeProviderId(value = '') {
    return String(value || '').trim().toLowerCase().replace(/[^a-z0-9_-]+/g, '');
  }

  function normalizeCountry(value = '') {
    const trimmed = String(value || '').trim();
    if (!trimmed) {
      return '';
    }
    const lowered = trimmed.toLowerCase();
    if (lowered === 'any' || lowered === 'local') {
      return lowered;
    }
    if (/^[a-z]{2}$/i.test(trimmed)) {
      return trimmed.toUpperCase();
    }
    return lowered;
  }

  function normalizeBoolean(value, fallback = false) {
    if (value === undefined || value === null) {
      return Boolean(fallback);
    }
    return Boolean(value);
  }

  function normalizePrice(value) {
    const numeric = Number(value);
    if (!Number.isFinite(numeric) || numeric <= 0) {
      return null;
    }
    return Math.round(numeric * 10000) / 10000;
  }

  function buildHeaders(config = {}, extraHeaders = {}) {
    const headers = {
      Accept: 'application/json',
      ...extraHeaders,
    };
    const secret = normalizeText(config.httpSecret);
    if (secret) {
      headers.Authorization = `Bearer ${secret}`;
    }
    return headers;
  }

  async function requestJson(config, path, options = {}) {
    const fetchImpl = config.fetchImpl || (typeof fetch === 'function' ? fetch.bind(globalThis) : null);
    if (!fetchImpl) {
      throw new Error('MaDao 网络请求实现不可用。');
    }
    const controller = typeof AbortController === 'function' ? new AbortController() : null;
    const timeoutId = controller
      ? setTimeout(() => controller.abort(), Number(config.requestTimeoutMs) || DEFAULT_REQUEST_TIMEOUT_MS)
      : null;

    try {
      const url = new URL(path.replace(/^\/+/, ''), `${config.baseUrl.replace(/\/+$/, '')}/`);
      const method = String(options.method || 'GET').trim().toUpperCase() || 'GET';
      const init = {
        method,
        headers: buildHeaders(config, options.headers || {}),
        signal: controller?.signal,
      };
      if (options.body !== undefined) {
        init.body = JSON.stringify(options.body);
        init.headers['Content-Type'] = 'application/json';
      }
      const response = await fetchImpl(url.toString(), init);
      const rawText = await response.text();
      let payload = null;
      try {
        payload = rawText ? JSON.parse(rawText) : null;
      } catch {
        payload = rawText;
      }
      if (!response.ok) {
        const detail = (
          payload && typeof payload === 'object'
            ? String(payload.message || payload.error || response.statusText || response.status).trim()
            : String(payload || response.statusText || response.status).trim()
        ) || `HTTP ${response.status}`;
        const error = new Error(`MaDao 请求失败：${detail}`);
        error.status = response.status;
        error.payload = payload;
        throw error;
      }
      return payload;
    } catch (error) {
      if (error?.name === 'AbortError') {
        throw new Error('MaDao 请求超时。');
      }
      throw error;
    } finally {
      if (timeoutId) {
        clearTimeout(timeoutId);
      }
    }
  }

  function resolveConfig(state = {}, deps = {}) {
    return {
      baseUrl: normalizeBaseUrl(state?.madaoBaseUrl || DEFAULT_BASE_URL),
      httpSecret: normalizeText(state?.madaoHttpSecret),
      fetchImpl: deps.fetchImpl || (typeof fetch === 'function' ? fetch.bind(globalThis) : null),
      requestTimeoutMs: deps.requestTimeoutMs || DEFAULT_REQUEST_TIMEOUT_MS,
    };
  }

  function mapAcquirePath(value = '') {
    const normalized = String(value || '').trim().toLowerCase();
    if (normalized === 'same_activation_retry') {
      return 'same_activation_retry';
    }
    if (normalized === 'exact_reuse') {
      return 'exact_reuse';
    }
    if (normalized === 'intent_reuse') {
      return 'intent_reuse';
    }
    return 'fresh_acquire';
  }

  function mapTicketStatus(value = '') {
    const normalized = String(value || '').trim().toLowerCase();
    if (normalized === 'waiting_code') {
      return 'waiting_code';
    }
    if (normalized === 'code_received') {
      return 'code_received';
    }
    if (normalized === 'finished') {
      return 'finished';
    }
    if (normalized === 'cancelled') {
      return 'cancelled';
    }
    if (normalized === 'failed') {
      return 'failed';
    }
    return 'pending';
  }

  function buildAcquireRequest(state = {}, options = {}) {
    const routingPlanId = normalizeText(options?.routingPlanId || state?.madaoRoutingPlanId);
    const directProvider = normalizeProviderId(options?.providerId || state?.madaoProviderId);
    const request = {
      provider: routingPlanId ? 'auto' : (directProvider || 'auto'),
      service: normalizeText(options?.service || state?.madaoServiceName, DEFAULT_SERVICE),
    };
    const country = normalizeCountry(options?.country || state?.madaoCountry);
    const minPrice = normalizePrice(options?.minPrice ?? state?.madaoMinPrice);
    const maxPrice = normalizePrice(options?.maxPrice ?? state?.madaoMaxPrice);

    if (routingPlanId) {
      request.routing_plan_id = routingPlanId;
    } else {
      request.auto_pick_country = normalizeBoolean(options?.autoPickCountry ?? state?.madaoAutoPickCountry, true);
      request.reuse_phone = normalizeBoolean(options?.reusePhone ?? state?.madaoReusePhone, true);
      if (country) {
        request.country = country;
      }
      if (minPrice !== null) {
        request.min_price = minPrice;
      }
      if (maxPrice !== null) {
        request.max_price = maxPrice;
      }
    }

    return request;
  }

  function normalizeActivationFromAcquire(payload = {}, fallback = {}) {
    const ticketId = normalizeText(payload?.ticket_id || payload?.id);
    const phoneNumber = normalizeText(payload?.phone_number || payload?.phone);
    if (!ticketId || !phoneNumber) {
      return null;
    }
    return {
      activationId: ticketId,
      phoneNumber,
      provider: PROVIDER_ID,
      serviceCode: normalizeText(payload?.service || fallback.service, DEFAULT_SERVICE),
      countryId: normalizeCountry(payload?.country || fallback.country),
      countryLabel: '',
      maxUses: 1,
      successfulUses: 0,
      madaoProviderId: normalizeProviderId(payload?.provider || fallback.provider),
      madaoRoutingPlanId: normalizeText(payload?.routing_plan_id || fallback.routing_plan_id),
      madaoRoutingPlanName: normalizeText(payload?.routing_plan_name || fallback.routing_plan_name),
      madaoRoutingItemId: normalizeText(payload?.routing_item_id || fallback.routing_item_id),
      madaoAcquirePath: mapAcquirePath(payload?.acquire_path),
      madaoStatus: mapTicketStatus(payload?.status),
      ...(payload?.price !== undefined && payload?.price !== null
        ? { madaoPrice: normalizePrice(payload.price) }
        : {}),
    };
  }

  async function acquireActivation(state = {}, options = {}, deps = {}) {
    const config = resolveConfig(state, deps);
    const requestBody = buildAcquireRequest(state, options);
    const payload = await requestJson(config, '/api/acquire', {
      method: 'POST',
      body: requestBody,
    });
    const activation = normalizeActivationFromAcquire(payload, requestBody);
    if (!activation) {
      throw new Error('MaDao 返回的激活记录无效。');
    }
    return activation;
  }

  async function pollActivation(state = {}, activation, deps = {}) {
    const config = resolveConfig(state, deps);
    const ticketId = normalizeText(activation?.activationId || activation?.ticketId);
    if (!ticketId) {
      throw new Error('MaDao 激活记录缺少 ticket_id。');
    }
    return requestJson(config, '/api/poll', {
      method: 'POST',
      body: {
        ticket_id: ticketId,
      },
    });
  }

  async function releaseActivation(state = {}, activation, action = 'cancel', deps = {}) {
    const config = resolveConfig(state, deps);
    const ticketId = normalizeText(activation?.activationId || activation?.ticketId);
    if (!ticketId) {
      throw new Error('MaDao 激活记录缺少 ticket_id。');
    }
    return requestJson(config, '/api/release', {
      method: 'POST',
      body: {
        ticket_id: ticketId,
        action: normalizeText(action, 'cancel'),
      },
    });
  }

  async function replaceRoutingActivation(state = {}, activation, options = {}, deps = {}) {
    const config = resolveConfig(state, deps);
    const ticketId = normalizeText(activation?.activationId || activation?.ticketId);
    if (!ticketId) {
      throw new Error('MaDao 激活记录缺少 ticket_id。');
    }
    const releaseAction = normalizeText(options?.releaseAction, 'cancel').toLowerCase() === 'ban'
      ? 'ban'
      : 'cancel';
    const payload = await requestJson(config, '/api/routing/replace', {
      method: 'POST',
      body: {
        ticket_id: ticketId,
        release_action: releaseAction,
        failed_item_id: normalizeText(options?.failedItemId || activation?.madaoRoutingItemId),
        reason: normalizeText(options?.reason),
      },
    });
    const nextTicket = normalizeActivationFromAcquire(payload?.next_ticket, {
      routing_plan_id: activation?.madaoRoutingPlanId,
      routing_plan_name: activation?.madaoRoutingPlanName,
      service: activation?.serviceCode,
      country: activation?.countryId,
    });
    if (!nextTicket) {
      throw new Error('MaDao 返回的下一条路由激活记录无效。');
    }
    return {
      currentTicketId: normalizeText(payload?.current_ticket_id, ticketId),
      currentTicketRelease: payload?.current_ticket_release || null,
      nextActivation: nextTicket,
    };
  }

  async function rotateActivation(state = {}, activation, options = {}, deps = {}) {
    const mode = normalizeText(state?.madaoMode, 'routing_plan').toLowerCase() === 'direct'
      ? 'direct'
      : 'routing_plan';
    const normalizedActivation = activation && typeof activation === 'object' ? activation : null;
    const releaseAction = normalizeText(options?.releaseAction, 'cancel').toLowerCase() === 'ban'
      ? 'ban'
      : 'cancel';
    if (mode === 'routing_plan' && normalizeText(normalizedActivation?.madaoRoutingPlanId)) {
      return replaceRoutingActivation(state, normalizedActivation, {
        releaseAction,
        failedItemId: options?.failedItemId || normalizedActivation?.madaoRoutingItemId,
        reason: options?.reason,
      }, deps);
    }
    const currentTicketRelease = await releaseActivation(state, normalizedActivation, releaseAction, deps);
    return {
      currentTicketId: normalizeText(normalizedActivation?.activationId || normalizedActivation?.ticketId),
      currentTicketRelease,
      nextActivation: null,
    };
  }

  function createProvider(deps = {}) {
    return {
      id: PROVIDER_ID,
      label: 'MaDao',
      defaultProduct: DEFAULT_SERVICE,
      acquireActivation: (state, options = {}, runtimeDeps = {}) => acquireActivation(state, options, {
        ...deps,
        ...runtimeDeps,
      }),
      pollActivation: (state, activation, runtimeDeps = {}) => pollActivation(state, activation, {
        ...deps,
        ...runtimeDeps,
      }),
      releaseActivation: (state, activation, action = 'cancel', runtimeDeps = {}) => releaseActivation(state, activation, action, {
        ...deps,
        ...runtimeDeps,
      }),
      rotateActivation: (state, activation, options = {}, runtimeDeps = {}) => rotateActivation(state, activation, options, {
        ...deps,
        ...runtimeDeps,
      }),
      replaceRoutingActivation: (state, activation, options = {}, runtimeDeps = {}) => replaceRoutingActivation(state, activation, options, {
        ...deps,
        ...runtimeDeps,
      }),
      mapAcquirePath,
      mapTicketStatus,
      normalizeActivationFromAcquire,
      resolveConfig: (state = {}, runtimeDeps = {}) => resolveConfig(state, {
        ...deps,
        ...runtimeDeps,
      }),
    };
  }

  return {
    PROVIDER_ID,
    DEFAULT_BASE_URL,
    DEFAULT_SERVICE,
    acquireActivation,
    createProvider,
    mapAcquirePath,
    mapTicketStatus,
    normalizeActivationFromAcquire,
    pollActivation,
    rotateActivation,
    replaceRoutingActivation,
    releaseActivation,
    resolveConfig,
  };
});
