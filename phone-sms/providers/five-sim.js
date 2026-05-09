// phone-sms/providers/five-sim.js — 5sim 接码平台适配层
(function attachFiveSimSmsProvider(root, factory) {
  root.PhoneSmsFiveSimProvider = factory();
})(typeof self !== 'undefined' ? self : globalThis, function createFiveSimSmsProviderModule() {
  const PROVIDER_ID = '5sim';
  const DEFAULT_BASE_URL = 'https://5sim.net';
  const DEFAULT_PRODUCT = 'openai';
  const DEFAULT_OPERATOR = 'any';
  const DEFAULT_COUNTRY_ID = 'vietnam';
  const DEFAULT_COUNTRY_LABEL = '越南 (Vietnam)';
  const DEFAULT_REQUEST_TIMEOUT_MS = 20000;
  const DEFAULT_MAX_USES = 3;
  const FIVE_SIM_RATE_LIMIT_ERROR_PREFIX = 'FIVE_SIM_RATE_LIMIT::';
  const MAX_PRICE_CANDIDATES = 8;
  const SUPPORTED_COUNTRY_ITEMS = Object.freeze([
    { id: 'indonesia', label: '印度尼西亚 (Indonesia)' },
    { id: 'thailand', label: '泰国 (Thailand)' },
    { id: 'england', label: '英国 (England)' },
    { id: 'usa', label: '美国 (United States)' },
    { id: 'japan', label: '日本 (Japan)' },
    { id: 'germany', label: '德国 (Germany)' },
    { id: 'vietnam', label: '越南 (Vietnam)' },
  ]);
  const SUPPORTED_COUNTRY_ID_SET = new Set(SUPPORTED_COUNTRY_ITEMS.map((item) => item.id));
  const COUNTRY_CN_BY_ID = Object.freeze({
    afghanistan: '阿富汗',
    albania: '阿尔巴尼亚',
    algeria: '阿尔及利亚',
    angola: '安哥拉',
    argentina: '阿根廷',
    armenia: '亚美尼亚',
    australia: '澳大利亚',
    austria: '奥地利',
    azerbaijan: '阿塞拜疆',
    bahamas: '巴哈马',
    bahrain: '巴林',
    bangladesh: '孟加拉国',
    belarus: '白俄罗斯',
    belgium: '比利时',
    bolivia: '玻利维亚',
    bosnia: '波黑',
    brazil: '巴西',
    bulgaria: '保加利亚',
    cambodia: '柬埔寨',
    cameroon: '喀麦隆',
    canada: '加拿大',
    chile: '智利',
    china: '中国',
    colombia: '哥伦比亚',
    croatia: '克罗地亚',
    cyprus: '塞浦路斯',
    czech: '捷克',
    denmark: '丹麦',
    egypt: '埃及',
    england: '英国',
    estonia: '爱沙尼亚',
    ethiopia: '埃塞俄比亚',
    finland: '芬兰',
    france: '法国',
    georgia: '格鲁吉亚',
    germany: '德国',
    ghana: '加纳',
    greece: '希腊',
    hongkong: '中国香港',
    hungary: '匈牙利',
    india: '印度',
    indonesia: '印度尼西亚',
    ireland: '爱尔兰',
    israel: '以色列',
    italy: '意大利',
    japan: '日本',
    jordan: '约旦',
    kazakhstan: '哈萨克斯坦',
    kenya: '肯尼亚',
    kyrgyzstan: '吉尔吉斯斯坦',
    laos: '老挝',
    latvia: '拉脱维亚',
    lithuania: '立陶宛',
    malaysia: '马来西亚',
    mexico: '墨西哥',
    moldova: '摩尔多瓦',
    morocco: '摩洛哥',
    myanmar: '缅甸',
    nepal: '尼泊尔',
    netherlands: '荷兰',
    newzealand: '新西兰',
    nigeria: '尼日利亚',
    norway: '挪威',
    pakistan: '巴基斯坦',
    paraguay: '巴拉圭',
    peru: '秘鲁',
    philippines: '菲律宾',
    poland: '波兰',
    portugal: '葡萄牙',
    romania: '罗马尼亚',
    russia: '俄罗斯',
    saudiarabia: '沙特阿拉伯',
    serbia: '塞尔维亚',
    singapore: '新加坡',
    slovakia: '斯洛伐克',
    slovenia: '斯洛文尼亚',
    southafrica: '南非',
    spain: '西班牙',
    srilanka: '斯里兰卡',
    sweden: '瑞典',
    switzerland: '瑞士',
    taiwan: '中国台湾',
    tajikistan: '塔吉克斯坦',
    tanzania: '坦桑尼亚',
    thailand: '泰国',
    turkey: '土耳其',
    ukraine: '乌克兰',
    uruguay: '乌拉圭',
    usa: '美国',
    uzbekistan: '乌兹别克斯坦',
    venezuela: '委内瑞拉',
    vietnam: '越南',
  });

  function normalizeFiveSimCountryId(value, fallback = DEFAULT_COUNTRY_ID) {
    const normalized = String(value || '').trim().toLowerCase().replace(/[^a-z0-9_-]+/g, '');
    if (normalized) {
      return normalized;
    }
    const fallbackSource = fallback === undefined || fallback === null ? DEFAULT_COUNTRY_ID : fallback;
    const normalizedFallback = String(fallbackSource).trim().toLowerCase().replace(/[^a-z0-9_-]+/g, '');
    if (!normalizedFallback) {
      return '';
    }
    return normalizedFallback || DEFAULT_COUNTRY_ID;
  }

  function getCountryIdFromPayload(record = {}, fallback = DEFAULT_COUNTRY_ID) {
    if (record?.country && typeof record.country === 'object' && !Array.isArray(record.country)) {
      return normalizeFiveSimCountryId(record.country.name || record.country.id || record.country.slug, fallback);
    }
    return normalizeFiveSimCountryId(record.countryId ?? record.country, fallback);
  }

  function getCountryLabelFromPayload(record = {}, fallbackLabel = DEFAULT_COUNTRY_LABEL, fallbackId = DEFAULT_COUNTRY_ID) {
    if (record?.country && typeof record.country === 'object' && !Array.isArray(record.country)) {
      const countryId = normalizeFiveSimCountryId(record.country.name || record.country.id || record.country.slug || fallbackId, fallbackId);
      return formatFiveSimCountryLabel(countryId, record.country.text_en || record.country.label || countryId, fallbackLabel || fallbackId);
    }
    const countryId = normalizeFiveSimCountryId(record.countryId ?? record.country ?? fallbackId, fallbackId);
    return normalizeFiveSimCountryLabel(record.countryLabel, formatFiveSimCountryLabel(countryId, countryId, fallbackLabel || fallbackId));
  }

  function normalizeFiveSimCountryLabel(value = '', fallback = DEFAULT_COUNTRY_LABEL) {
    return String(value || '').trim() || fallback;
  }

  function formatFiveSimCountryLabel(id = '', englishValue = '', fallback = DEFAULT_COUNTRY_LABEL) {
    const countryId = normalizeFiveSimCountryId(id, '');
    const english = normalizeFiveSimCountryLabel(englishValue || countryId || fallback, fallback);
    const chinese = COUNTRY_CN_BY_ID[countryId] || '';
    if (chinese && english) {
      if (String(english).includes(chinese)) {
        return english;
      }
      if (chinese.toLowerCase() !== english.toLowerCase()) {
        return `${chinese} (${english})`;
      }
    }
    return chinese || english;
  }

  function normalizeFiveSimOperator(value = '') {
    return String(value || '').trim().toLowerCase().replace(/[^a-z0-9_-]+/g, '') || DEFAULT_OPERATOR;
  }

  function normalizeFiveSimMaxPrice(value = '') {
    const rawValue = String(value ?? '').trim();
    if (!rawValue) {
      return '';
    }
    const numeric = Number(rawValue);
    if (!Number.isFinite(numeric) || numeric <= 0) {
      return '';
    }
    return String(Math.round(numeric * 10000) / 10000);
  }

  function normalizeFiveSimCountryFallback(value = []) {
    const source = Array.isArray(value)
      ? value
      : String(value || '')
        .split(/[\r\n,，;；]+/)
        .map((entry) => String(entry || '').trim())
        .filter(Boolean);
    const seen = new Set();
    const normalized = [];

    for (const entry of source) {
      let id = '';
      let label = '';

      if (entry && typeof entry === 'object' && !Array.isArray(entry)) {
        id = normalizeFiveSimCountryId(entry.id ?? entry.countryId ?? entry.slug, '');
        label = String((entry.label ?? entry.countryLabel ?? entry.text_en ?? entry.name) || '').trim();
      } else {
        const text = String(entry || '').trim();
        const structured = text.match(/^([a-z0-9_-]+)\s*(?:[:|/-]\s*(.+))?$/i);
        id = normalizeFiveSimCountryId(structured?.[1] || text, '');
        label = String(structured?.[2] || '').trim();
      }

      if (!id || seen.has(id)) {
        continue;
      }
      seen.add(id);
      normalized.push({
        id,
        label: label || formatFiveSimCountryLabel(id, id, id),
      });
      if (normalized.length >= 20) {
        break;
      }
    }

    return normalized;
  }

  function normalizePrice(value) {
    const price = Number(value);
    if (!Number.isFinite(price) || price < 0) {
      return null;
    }
    return price;
  }

  function buildSortedUniquePriceCandidates(values = []) {
    return Array.from(
      new Set(
        values
          .map((value) => normalizePrice(value))
          .filter((value) => value !== null)
          .map((value) => Math.round(value * 10000) / 10000)
      )
    )
      .sort((left, right) => left - right)
      .slice(0, MAX_PRICE_CANDIDATES);
  }

  function describePayload(raw) {
    if (typeof raw === 'string') {
      return raw.trim();
    }
    if (raw && typeof raw === 'object') {
      const direct = String(raw.message || raw.msg || raw.error || raw.title || raw.status || '').trim();
      if (direct) {
        return direct;
      }
      try {
        return JSON.stringify(raw);
      } catch {
        return String(raw);
      }
    }
    return String(raw || '').trim();
  }

  function parsePayload(text) {
    const trimmed = String(text || '').trim();
    if (!trimmed) {
      return '';
    }
    if ((trimmed.startsWith('{') && trimmed.endsWith('}')) || (trimmed.startsWith('[') && trimmed.endsWith(']'))) {
      try {
        return JSON.parse(trimmed);
      } catch {
        return trimmed;
      }
    }
    return trimmed;
  }

  function normalizeBaseUrl(value = '') {
    const trimmed = String(value || '').trim() || DEFAULT_BASE_URL;
    try {
      const url = new URL(trimmed);
      return `${url.origin}${url.pathname.replace(/\/+$/, '')}`;
    } catch {
      return DEFAULT_BASE_URL;
    }
  }

  function buildUrl(config = {}, path = '', query = {}) {
    const url = new URL(path, `${normalizeBaseUrl(config.baseUrl)}/`);
    Object.entries(query || {}).forEach(([key, value]) => {
      if (value === undefined || value === null || value === '') {
        return;
      }
      url.searchParams.set(key, String(value));
    });
    return url.toString();
  }

  async function fetchJson(config = {}, path = '', options = {}) {
    const { query = {}, actionLabel = '5sim 请求', requireAuth = true } = options;
    const token = String(config.apiKey || '').trim();
    if (requireAuth && !token) {
      throw new Error('缺少 5sim API Key，请先在侧边栏接码设置中填写并保存。');
    }
    const controller = typeof AbortController === 'function' ? new AbortController() : null;
    const timeoutId = controller
      ? setTimeout(() => controller.abort(), Number(config.requestTimeoutMs) || DEFAULT_REQUEST_TIMEOUT_MS)
      : null;

    try {
      const response = await config.fetchImpl(buildUrl(config, path, query), {
        method: 'GET',
        signal: controller?.signal,
        headers: {
          Accept: 'application/json',
          ...(requireAuth ? { Authorization: `Bearer ${token}` } : {}),
        },
      });
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

  function resolveConfig(state = {}, deps = {}) {
    return {
      apiKey: String(state.fiveSimApiKey || '').trim(),
      baseUrl: DEFAULT_BASE_URL,
      fetchImpl: deps.fetchImpl,
      requestTimeoutMs: deps.requestTimeoutMs || DEFAULT_REQUEST_TIMEOUT_MS,
    };
  }

  function resolveCountryConfig(state = {}) {
    const rawCountryId = normalizeFiveSimCountryId(state.fiveSimCountryId, '');
    const id = rawCountryId || DEFAULT_COUNTRY_ID;
    return {
      id,
      label: formatFiveSimCountryLabel(id, state.fiveSimCountryLabel || id, DEFAULT_COUNTRY_LABEL),
    };
  }

  function resolveCountryCandidates(state = {}) {
    const primary = resolveCountryConfig(state);
    const fallbackList = normalizeFiveSimCountryFallback(state.fiveSimCountryFallback);
    const seen = new Set([primary.id]);
    const candidates = [primary];

    fallbackList.forEach((entry) => {
      const nextId = normalizeFiveSimCountryId(entry.id, '');
      if (!nextId || seen.has(nextId)) {
        return;
      }
      seen.add(nextId);
      candidates.push({
        id: nextId,
        label: formatFiveSimCountryLabel(nextId, entry.label || nextId, nextId),
      });
    });

    return candidates;
  }

  async function fetchBalance(state = {}, deps = {}) {
    const config = resolveConfig(state, deps);
    const payload = await fetchJson(config, '/v1/user/profile', {
      actionLabel: '5sim 查询余额',
    });
    return {
      balance: Number(payload?.balance),
      frozenBalance: Number(payload?.frozen_balance),
      rating: Number(payload?.rating),
      raw: payload,
    };
  }

  async function fetchCountries(_state = {}, deps = {}) {
    const config = {
      baseUrl: DEFAULT_BASE_URL,
      fetchImpl: deps.fetchImpl,
      requestTimeoutMs: deps.requestTimeoutMs || DEFAULT_REQUEST_TIMEOUT_MS,
    };
    const payload = await fetchJson(config, '/v1/guest/countries', {
      actionLabel: '5sim 查询国家列表',
      requireAuth: false,
    });
    return Object.entries(payload || {})
      .map(([slug, entry]) => {
        const id = normalizeFiveSimCountryId(slug, '');
        if (!id) {
          return null;
        }
        return {
          id,
          label: formatFiveSimCountryLabel(id, entry?.text_en || slug, slug),
          searchText: [
            slug,
            formatFiveSimCountryLabel(id, entry?.text_en || slug, slug),
            entry?.text_en,
            entry?.text_ru,
            Object.keys(entry?.iso || {}).join(' '),
            Object.keys(entry?.prefix || {}).join(' '),
          ].filter(Boolean).join(' '),
        };
      })
      .filter(Boolean)
      .sort((left, right) => String(left.label || '').localeCompare(String(right.label || '')));
  }

  function collectPriceEntries(payload, entries = []) {
    if (Array.isArray(payload)) {
      payload.forEach((entry) => collectPriceEntries(entry, entries));
      return entries;
    }
    if (!payload || typeof payload !== 'object') {
      return entries;
    }

    const cost = normalizePrice(payload.cost ?? payload.Price ?? payload.price);
    if (cost !== null) {
      const count = Number(payload.count ?? payload.Qty ?? payload.qty);
      entries.push({
        cost,
        count: Number.isFinite(count) ? count : 0,
        inStock: !Number.isFinite(count) || count > 0,
      });
    }

    Object.values(payload).forEach((entry) => collectPriceEntries(entry, entries));
    return entries;
  }

  async function fetchPrices(state = {}, countryConfig = resolveCountryConfig(state), deps = {}) {
    const config = {
      baseUrl: DEFAULT_BASE_URL,
      fetchImpl: deps.fetchImpl,
      requestTimeoutMs: deps.requestTimeoutMs || DEFAULT_REQUEST_TIMEOUT_MS,
    };
    return fetchJson(config, '/v1/guest/prices', {
      query: {
        country: normalizeFiveSimCountryId(countryConfig?.id),
        product: DEFAULT_PRODUCT,
      },
      actionLabel: '5sim 查询价格',
      requireAuth: false,
    });
  }

  async function fetchProducts(state = {}, countryConfig = resolveCountryConfig(state), deps = {}) {
    const config = {
      baseUrl: DEFAULT_BASE_URL,
      fetchImpl: deps.fetchImpl,
      requestTimeoutMs: deps.requestTimeoutMs || DEFAULT_REQUEST_TIMEOUT_MS,
    };
    const operator = normalizeFiveSimOperator(state.fiveSimOperator);
    return fetchJson(
      config,
      `/v1/guest/products/${encodeURIComponent(normalizeFiveSimCountryId(countryConfig?.id))}/${encodeURIComponent(operator)}`,
      {
        actionLabel: '5sim 查询产品价格',
        requireAuth: false,
      }
    );
  }

  async function resolvePricePlan(state = {}, countryConfig = resolveCountryConfig(state), deps = {}) {
    const userLimitText = normalizeFiveSimMaxPrice(state.fiveSimMaxPrice);
    const userLimit = userLimitText ? Number(userLimitText) : null;
    let priceCandidates = [];

    try {
      const productsPayload = await fetchProducts(state, countryConfig, deps);
      const openaiProduct = productsPayload?.[DEFAULT_PRODUCT];
      const productPrice = normalizePrice(openaiProduct?.Price ?? openaiProduct?.price ?? openaiProduct?.cost);
      const productQty = Number(openaiProduct?.Qty ?? openaiProduct?.qty ?? openaiProduct?.count);
      if (productPrice !== null && (!Number.isFinite(productQty) || productQty > 0)) {
        priceCandidates.push(productPrice);
      }
    } catch (_) {
      // Products endpoint is only used to find the buy-compatible operator price.
    }

    try {
      const payload = await fetchPrices(state, countryConfig, deps);
      priceCandidates = [
        ...priceCandidates,
        ...buildSortedUniquePriceCandidates(
          collectPriceEntries(payload, [])
            .filter((entry) => entry.inStock)
            .map((entry) => entry.cost)
        ),
      ];
    } catch (_) {
      // Best-effort lookup. Purchase can still be attempted without a catalog price.
    }
    priceCandidates = buildSortedUniquePriceCandidates(priceCandidates);

    const minCatalogPrice = priceCandidates.length > 0 ? priceCandidates[0] : null;
    if (userLimit !== null) {
      const bounded = priceCandidates.filter((price) => price <= userLimit);
      return {
        prices: bounded.length > 0 ? [userLimit, ...bounded.filter((price) => price !== userLimit)] : [userLimit],
        userLimit,
        minCatalogPrice,
      };
    }

    if (priceCandidates.length > 0) {
      return { prices: priceCandidates, userLimit: null, minCatalogPrice };
    }
    return { prices: [null], userLimit: null, minCatalogPrice: null };
  }

  function normalizeActivation(record, fallback = {}) {
    if (!record || typeof record !== 'object' || Array.isArray(record)) {
      return null;
    }
    const activationId = String(record.activationId ?? record.id ?? '').trim();
    const phoneNumber = String(record.phoneNumber ?? record.phone ?? '').trim();
    if (!activationId || !phoneNumber) {
      return null;
    }
    const countryId = getCountryIdFromPayload(record, fallback.countryId || DEFAULT_COUNTRY_ID);
    const countryLabel = getCountryLabelFromPayload(record, fallback.countryLabel || countryId, countryId);
    return {
      activationId,
      phoneNumber,
      provider: PROVIDER_ID,
      serviceCode: DEFAULT_PRODUCT,
      countryId,
      countryLabel,
      successfulUses: Math.max(0, Math.floor(Number(record.successfulUses) || 0)),
      maxUses: Math.max(1, Math.floor(Number(record.maxUses) || DEFAULT_MAX_USES)),
      operator: normalizeFiveSimOperator(record.operator || fallback.operator),
      ...(record.price !== undefined ? { price: Number(record.price) } : {}),
      ...(record.status ? { status: String(record.status) } : {}),
    };
  }

  function isNoNumbersPayload(payloadOrMessage) {
    const text = describePayload(payloadOrMessage);
    return /no\s+free\s+phones|no\s+numbers|not\s+found/i.test(text);
  }

  function isRateLimitPayload(payloadOrMessage) {
    const text = describePayload(payloadOrMessage);
    return /rate\s*limit|too\s*many\s*requests|request\s*limit|429/i.test(text);
  }

  function buildFiveSimRateLimitError(details = []) {
    const suffix = Array.isArray(details) && details.length
      ? `：${details.join(' | ')}。`
      : '。';
    return new Error(`${FIVE_SIM_RATE_LIMIT_ERROR_PREFIX}5sim 购买接口触发限流，请稍后再试${suffix}`);
  }

  function isTerminalError(payloadOrMessage) {
    const text = describePayload(payloadOrMessage);
    return /not\s+enough\s+(?:user\s+)?balance|not\s+enough\s+rating|unauthorized|invalid\s+token|banned|bad\s+(?:country|operator)|no\s+product|server\s+offline/i.test(text);
  }

  function assertMaxPriceCompatibleWithOperator(state = {}) {
    const maxPrice = normalizeFiveSimMaxPrice(state.fiveSimMaxPrice);
    const operator = normalizeFiveSimOperator(state.fiveSimOperator);
    if (maxPrice && operator !== DEFAULT_OPERATOR) {
      throw new Error('5sim maxPrice only works when operator is "any"; clear the price limit or switch operator to any before buying a number.');
    }
  }

  async function buyActivationWithPrice(state = {}, countryConfig, maxPrice, deps = {}) {
    const config = resolveConfig(state, deps);
    const operator = normalizeFiveSimOperator(state.fiveSimOperator);
    const query = {};
    if (maxPrice !== null && maxPrice !== undefined) {
      query.maxPrice = maxPrice;
    }
    if (state.fiveSimReuseEnabled !== false) {
      query.reuse = 1;
    }
    const payload = await fetchJson(
      config,
      `/v1/user/buy/activation/${encodeURIComponent(normalizeFiveSimCountryId(countryConfig.id))}/${encodeURIComponent(operator)}/${DEFAULT_PRODUCT}`,
      {
        query,
        actionLabel: '5sim 购买手机号',
      }
    );
    const activation = normalizeActivation(payload, {
      countryId: countryConfig.id,
      countryLabel: countryConfig.label,
      operator,
    });
    if (!activation) {
      const error = new Error(`5sim 购买手机号返回不可用响应：${describePayload(payload) || '空响应'}`);
      error.payload = payload;
      throw error;
    }
    return activation;
  }

  async function requestActivation(state = {}, options = {}, deps = {}) {
    assertMaxPriceCompatibleWithOperator(state);

    const allCountryCandidates = resolveCountryCandidates(state);
    const blockedCountryIds = new Set(
      (Array.isArray(options?.blockedCountryIds) ? options.blockedCountryIds : [])
        .map((value) => normalizeFiveSimCountryId(value, ''))
        .filter(Boolean)
    );
    let countryCandidates = allCountryCandidates.filter((entry) => !blockedCountryIds.has(normalizeFiveSimCountryId(entry.id, '')));
    if (!countryCandidates.length) {
      countryCandidates = allCountryCandidates;
      if (blockedCountryIds.size && typeof deps.addLog === 'function') {
        await deps.addLog(
          '步骤 9：已选 5sim 国家均达到临时收码失败跳过阈值，本轮解除跳过并重新尝试。',
          'warn'
        );
      }
    }

    const acquirePriority = String(state?.heroSmsAcquirePriority || 'country').trim().toLowerCase() === 'price' ? 'price' : 'country';
    const countryAttempts = countryCandidates.map((countryConfig, index) => ({
      index,
      countryConfig,
      pricePlan: null,
      orderingPrice: Number.POSITIVE_INFINITY,
    }));

    if (acquirePriority === 'price') {
      for (const attempt of countryAttempts) {
        const pricePlan = await resolvePricePlan(state, attempt.countryConfig, deps);
        const numericPrices = Array.isArray(pricePlan?.prices)
          ? pricePlan.prices.map(Number).filter((value) => Number.isFinite(value) && value >= 0)
          : [];
        const minCandidatePrice = numericPrices.length ? Math.min(...numericPrices) : null;
        const cappedByUserLimit = (
          pricePlan?.userLimit !== null
          && pricePlan?.userLimit !== undefined
          && pricePlan?.minCatalogPrice !== null
          && pricePlan?.minCatalogPrice !== undefined
          && Number(pricePlan.minCatalogPrice) > Number(pricePlan.userLimit)
        );
        attempt.pricePlan = pricePlan;
        attempt.orderingPrice = cappedByUserLimit
          ? Number.POSITIVE_INFINITY
          : (minCandidatePrice !== null ? minCandidatePrice : Number.POSITIVE_INFINITY);
      }
      countryAttempts.sort((left, right) => (
        left.orderingPrice !== right.orderingPrice
          ? left.orderingPrice - right.orderingPrice
          : left.index - right.index
      ));
    }

    const noNumbersByCountry = [];
    const rateLimitByCountry = [];
    let lastError = null;
    let lastFailureText = '';
    let sawOnlyRetryableFailures = true;
    for (const attempt of countryAttempts) {
      const countryConfig = attempt.countryConfig;
      const countryFailures = [];
      const pricePlan = attempt.pricePlan || await resolvePricePlan(state, countryConfig, deps);
      for (const maxPrice of pricePlan.prices) {
        try {
          const activation = await buyActivationWithPrice(state, countryConfig, maxPrice, deps);
          if (activation) {
            return activation;
          }
          lastFailureText = '空响应';
        } catch (error) {
          const payloadOrMessage = error?.payload || error?.message;
          if (isTerminalError(payloadOrMessage)) {
            throw new Error(`5sim 购买手机号失败：${describePayload(payloadOrMessage) || '空响应'}`);
          }
          const failureText = describePayload(payloadOrMessage) || lastFailureText;
          if (isRateLimitPayload(payloadOrMessage)) {
            lastFailureText = failureText;
            countryFailures.push(failureText || 'rate limit');
            continue;
          }
          if (isNoNumbersPayload(payloadOrMessage)) {
            lastFailureText = failureText;
            countryFailures.push(failureText || '无可用号码');
            continue;
          }
          sawOnlyRetryableFailures = false;
          lastError = error;
          lastFailureText = failureText;
        }
      }
      const countryFailureText = countryFailures.length
        ? Array.from(new Set(countryFailures)).join(', ')
        : (lastFailureText || '无可用号码');
      if (countryFailures.some((text) => isRateLimitPayload(text))) {
        rateLimitByCountry.push(`${countryConfig.label}: ${countryFailureText}`);
      } else {
        noNumbersByCountry.push(`${countryConfig.label}: ${countryFailureText}`);
      }
    }

    if (rateLimitByCountry.length) {
      throw buildFiveSimRateLimitError(rateLimitByCountry);
    }

    if (noNumbersByCountry.length && sawOnlyRetryableFailures) {
      throw new Error(`5sim 已尝试 ${countryCandidates.length} 个候选国家，均无可用号码：${noNumbersByCountry.join(' | ')}。`);
    }
    if (lastError) {
      throw lastError;
    }
    throw new Error(`5sim 获取手机号失败，最后状态：${lastFailureText || '未知'}。`);
  }

  async function reuseActivation(state = {}, activation, deps = {}) {
    const normalizedActivation = normalizeActivation(activation);
    if (!normalizedActivation) {
      throw new Error('缺少可复用的 5sim 手机号订单。');
    }
    const phoneDigits = String(normalizedActivation.phoneNumber || '').replace(/\D+/g, '');
    if (!phoneDigits) {
      throw new Error('可复用的 5sim 手机号无效。');
    }
    const config = resolveConfig(state, deps);
    const numberWithoutPlus = String(normalizedActivation.phoneNumber || '')
      .replace(/^\+/, '')
      .replace(/[^0-9]+/g, '');
    const payload = await fetchJson(config, `/v1/user/reuse/${DEFAULT_PRODUCT}/${numberWithoutPlus || phoneDigits}`, {
      actionLabel: '5sim 复用手机号',
    });
    return normalizeActivation(payload, normalizedActivation);
  }

  async function finishActivation(state = {}, activation, deps = {}) {
    const normalizedActivation = normalizeActivation(activation);
    if (!normalizedActivation) return '';
    const config = resolveConfig(state, deps);
    const payload = await fetchJson(config, `/v1/user/finish/${encodeURIComponent(normalizedActivation.activationId)}`, {
      actionLabel: '5sim 完成订单',
    });
    return describePayload(payload);
  }

  async function cancelActivation(state = {}, activation, deps = {}) {
    const normalizedActivation = normalizeActivation(activation);
    if (!normalizedActivation) return '';
    const config = resolveConfig(state, deps);
    const payload = await fetchJson(config, `/v1/user/cancel/${encodeURIComponent(normalizedActivation.activationId)}`, {
      actionLabel: '5sim 取消订单',
    });
    return describePayload(payload);
  }

  async function banActivation(state = {}, activation, deps = {}) {
    const normalizedActivation = normalizeActivation(activation);
    if (!normalizedActivation) return '';
    const config = resolveConfig(state, deps);
    const payload = await fetchJson(config, `/v1/user/ban/${encodeURIComponent(normalizedActivation.activationId)}`, {
      actionLabel: '5sim 拉黑号码',
    });
    return describePayload(payload);
  }

  function extractVerificationCode(rawCodeOrText) {
    const trimmed = String(rawCodeOrText || '').trim();
    if (!trimmed) {
      return '';
    }
    const digitMatch = trimmed.match(/\b(\d{4,8})\b/);
    return digitMatch?.[1] || trimmed;
  }

  function extractCodeFromOrder(payload) {
    const smsList = Array.isArray(payload?.sms) ? payload.sms : [];
    for (let index = smsList.length - 1; index >= 0; index -= 1) {
      const message = smsList[index] || {};
      const code = extractVerificationCode(message.code) || extractVerificationCode(message.text);
      if (code) {
        return code;
      }
    }
    return '';
  }

  async function pollActivationCode(state = {}, activation, options = {}, deps = {}) {
    const normalizedActivation = normalizeActivation(activation);
    if (!normalizedActivation) {
      throw new Error('缺少手机号接码订单。');
    }
    const config = resolveConfig(state, deps);
    const timeoutMs = Math.max(1000, Number(options.timeoutMs) || 180000);
    const intervalMs = Math.max(1000, Number(options.intervalMs) || 5000);
    const maxRoundsRaw = Math.floor(Number(options.maxRounds));
    const maxRounds = Number.isFinite(maxRoundsRaw) && maxRoundsRaw > 0 ? maxRoundsRaw : 0;
    const start = Date.now();
    let pollCount = 0;
    let lastResponse = '';

    while (Date.now() - start < timeoutMs) {
      if (maxRounds > 0 && pollCount >= maxRounds) {
        break;
      }
      deps.throwIfStopped?.();
      const payload = await fetchJson(config, `/v1/user/check/${encodeURIComponent(normalizedActivation.activationId)}`, {
        actionLabel: '5sim 查询验证码',
      });
      pollCount += 1;
      lastResponse = describePayload(payload);
      if (typeof options.onStatus === 'function') {
        await options.onStatus({
          activation: normalizedActivation,
          elapsedMs: Date.now() - start,
          pollCount,
          statusText: String(payload?.status || lastResponse || '未知'),
          timeoutMs,
        });
      }
      const code = extractCodeFromOrder(payload);
      if (code) {
        return code;
      }
      const status = String(payload?.status || '').trim().toUpperCase();
      if (['CANCELED', 'BANNED', 'FINISHED', 'TIMEOUT'].includes(status)) {
        throw new Error(`5sim 查询验证码失败：订单状态 ${status}`);
      }
      if (typeof options.onWaitingForCode === 'function') {
        await options.onWaitingForCode({
          activation: normalizedActivation,
          elapsedMs: Date.now() - start,
          pollCount,
          statusText: String(payload?.status || lastResponse || '未知'),
          timeoutMs,
        });
      }
      await deps.sleepWithStop(intervalMs);
    }

    const suffix = lastResponse ? ` 5sim 最后状态：${lastResponse}` : '';
    throw new Error(`PHONE_CODE_TIMEOUT::等待手机验证码超时。${suffix}`);
  }

  function createProvider(deps = {}) {
    const providerDeps = {
      fetchImpl: deps.fetchImpl,
      sleepWithStop: deps.sleepWithStop,
      throwIfStopped: deps.throwIfStopped,
      addLog: deps.addLog,
      requestTimeoutMs: deps.requestTimeoutMs || DEFAULT_REQUEST_TIMEOUT_MS,
    };
    return {
      id: PROVIDER_ID,
      label: '5sim',
      defaultCountryId: DEFAULT_COUNTRY_ID,
      defaultCountryLabel: DEFAULT_COUNTRY_LABEL,
      supportedCountries: SUPPORTED_COUNTRY_ITEMS,
      defaultProduct: DEFAULT_PRODUCT,
      defaultOperator: DEFAULT_OPERATOR,
      normalizeCountryId: normalizeFiveSimCountryId,
      normalizeCountryLabel: normalizeFiveSimCountryLabel,
      formatCountryLabel: formatFiveSimCountryLabel,
      normalizeCountryFallback: normalizeFiveSimCountryFallback,
      normalizeMaxPrice: normalizeFiveSimMaxPrice,
      normalizeOperator: normalizeFiveSimOperator,
      resolveCountryCandidates,
      requestActivation: (state, options) => requestActivation(state, options, providerDeps),
      reuseActivation: (state, activation) => reuseActivation(state, activation, providerDeps),
      finishActivation: (state, activation) => finishActivation(state, activation, providerDeps),
      cancelActivation: (state, activation) => cancelActivation(state, activation, providerDeps),
      banActivation: (state, activation) => banActivation(state, activation, providerDeps),
      pollActivationCode: (state, activation, options) => pollActivationCode(state, activation, options, providerDeps),
      fetchBalance: (state) => fetchBalance(state, providerDeps),
      fetchCountries: (state) => fetchCountries(state, providerDeps),
      fetchPrices: (state, countryConfig) => fetchPrices(state, countryConfig, providerDeps),
      collectPriceEntries,
      describePayload,
    };
  }

  return {
    PROVIDER_ID,
    FIVE_SIM_RATE_LIMIT_ERROR_PREFIX,
    DEFAULT_COUNTRY_ID,
    DEFAULT_COUNTRY_LABEL,
    DEFAULT_OPERATOR,
    DEFAULT_PRODUCT,
    SUPPORTED_COUNTRY_ITEMS,
    createProvider,
    normalizeFiveSimCountryFallback,
    normalizeFiveSimCountryId,
    normalizeFiveSimCountryLabel,
    formatFiveSimCountryLabel,
    normalizeFiveSimMaxPrice,
    normalizeFiveSimOperator,
  };
});
