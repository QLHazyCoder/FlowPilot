// phone-sms/providers/custom-url.js — 自定义 URL 接码适配层
// 用户自带号码池：每行 "手机号----取码URL"。不购买号码，仅顺序轮流取号、
// 轮询用户提供的 URL，用正则从返回内容提取 6 位验证码。
(function attachCustomUrlSmsProvider(root, factory) {
  root.PhoneSmsCustomUrlProvider = factory();
})(typeof self !== 'undefined' ? self : globalThis, function createCustomUrlSmsProviderModule() {
  const PROVIDER_ID = 'custom-url';
  const POOL_SEPARATOR = '----';
  const DEFAULT_REQUEST_TIMEOUT_MS = 20000;
  const DEFAULT_POLL_TIMEOUT_MS = 180000;
  const DEFAULT_POLL_INTERVAL_MS = 5000;
  const DEFAULT_MAX_USES = 3;
  const PHONE_CODE_TIMEOUT_ERROR_PREFIX = 'PHONE_CODE_TIMEOUT::';
  const POOL_CURSOR_STATE_KEY = 'customUrlSmsPoolCursor';
  // 返回内容里 "|" 右侧通常是到期时间等噪声（含日期数字），只在左侧正文段取码。
  const SMS_BODY_DELIMITER = '|';
  const NO_SMS_PATTERN = /暂无短信|no\s*sms|未收到|等待中|waiting/i;
  const VERIFICATION_CODE_PATTERN = /\b(\d{6})\b/;

  function normalizeText(value = '', fallback = '') {
    return String(value || '').trim() || fallback;
  }

  function normalizePhoneDigits(value = '') {
    return String(value || '').replace(/[^\d+]/g, '').trim();
  }

  // 解析号码池文本：每行 "手机号----URL"，去重、保序。
  function parseSmsPool(value = '') {
    const source = Array.isArray(value)
      ? value
      : String(value || '').split(/[\r\n]+/);
    const seen = new Set();
    const pool = [];
    source.forEach((rawLine) => {
      const line = String(rawLine || '').trim();
      if (!line) {
        return;
      }
      const separatorIndex = line.indexOf(POOL_SEPARATOR);
      if (separatorIndex < 0) {
        return;
      }
      const phoneNumber = normalizePhoneDigits(line.slice(0, separatorIndex));
      const codeUrl = normalizeText(line.slice(separatorIndex + POOL_SEPARATOR.length));
      if (!phoneNumber || !/^https?:\/\//i.test(codeUrl)) {
        return;
      }
      const dedupeKey = `${phoneNumber}::${codeUrl}`;
      if (seen.has(dedupeKey)) {
        return;
      }
      seen.add(dedupeKey);
      pool.push({ phoneNumber, codeUrl });
    });
    return pool;
  }

  function resolvePool(state = {}) {
    return parseSmsPool(state?.customUrlSmsPool);
  }

  function normalizeCursor(value, poolLength) {
    const parsed = Math.floor(Number(value));
    if (!Number.isFinite(parsed) || parsed < 0 || poolLength <= 0) {
      return 0;
    }
    return parsed % poolLength;
  }

  function normalizeActivation(record, fallback = {}) {
    if (!record || typeof record !== 'object' || Array.isArray(record)) {
      return null;
    }
    const phoneNumber = normalizePhoneDigits(record.phoneNumber ?? record.phone ?? fallback.phoneNumber);
    const codeUrl = normalizeText(record.codeUrl ?? record.activationId ?? fallback.codeUrl);
    if (!phoneNumber || !/^https?:\/\//i.test(codeUrl)) {
      return null;
    }
    return {
      // activationId 用取码 URL 唯一标识本次订单。
      activationId: codeUrl,
      phoneNumber,
      codeUrl,
      provider: PROVIDER_ID,
      serviceCode: 'custom',
      countryId: '',
      countryLabel: '',
      successfulUses: Math.max(0, Math.floor(Number(record.successfulUses) || 0)),
      maxUses: Math.max(1, Math.floor(Number(record.maxUses) || DEFAULT_MAX_USES)),
      ...(record.poolIndex !== undefined ? { poolIndex: Math.max(0, Math.floor(Number(record.poolIndex) || 0)) } : {}),
    };
  }

  function describePayload(raw) {
    if (typeof raw === 'string') {
      return raw.trim();
    }
    if (raw && typeof raw === 'object') {
      const direct = normalizeText(raw.message || raw.msg || raw.error || raw.text || raw.sms);
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

  // 从返回文本中提取 6 位验证码：优先取分隔符左侧正文段，避开右侧到期时间噪声。
  function extractVerificationCode(rawText = '') {
    const text = String(rawText || '');
    if (!text.trim()) {
      return '';
    }
    const delimiterIndex = text.indexOf(SMS_BODY_DELIMITER);
    const bodySegment = delimiterIndex >= 0 ? text.slice(0, delimiterIndex) : text;
    const bodyMatch = bodySegment.match(VERIFICATION_CODE_PATTERN);
    if (bodyMatch) {
      return bodyMatch[1];
    }
    // 兜底：若正文段没命中（例如无分隔符的 JSON），再在全文里找。
    const fullMatch = text.match(VERIFICATION_CODE_PATTERN);
    return fullMatch ? fullMatch[1] : '';
  }

  function isNoSmsResponse(rawText = '') {
    const text = String(rawText || '');
    const delimiterIndex = text.indexOf(SMS_BODY_DELIMITER);
    const bodySegment = delimiterIndex >= 0 ? text.slice(0, delimiterIndex) : text;
    return NO_SMS_PATTERN.test(bodySegment);
  }

  async function requestActivation(state = {}, options = {}, deps = {}) {
    const pool = resolvePool(state);
    if (!pool.length) {
      throw new Error('步骤 9：自定义 URL 接码号码池为空，请先在接码设置中按「手机号----取码URL」格式粘贴号码。');
    }
    // 顺序轮流：从持久化游标取下一个号；用完一圈后从头复用。
    const startCursor = normalizeCursor(state?.[POOL_CURSOR_STATE_KEY], pool.length);
    const blockedUrls = new Set(
      (Array.isArray(options?.blockedActivationIds) ? options.blockedActivationIds : [])
        .map((value) => normalizeText(value))
        .filter(Boolean)
    );

    let selectedIndex = -1;
    for (let offset = 0; offset < pool.length; offset += 1) {
      const index = (startCursor + offset) % pool.length;
      if (!blockedUrls.has(pool[index].codeUrl)) {
        selectedIndex = index;
        break;
      }
    }
    if (selectedIndex < 0) {
      selectedIndex = startCursor;
    }

    const entry = pool[selectedIndex];
    const nextCursor = (selectedIndex + 1) % pool.length;
    if (typeof deps.setState === 'function') {
      await deps.setState({ [POOL_CURSOR_STATE_KEY]: nextCursor });
    }
    if (typeof deps.addLog === 'function') {
      await deps.addLog(
        `步骤 9：自定义 URL 接码已选用号码池第 ${selectedIndex + 1}/${pool.length} 个号码（${entry.phoneNumber}）。`,
        'info'
      );
    }

    return normalizeActivation({
      phoneNumber: entry.phoneNumber,
      codeUrl: entry.codeUrl,
      poolIndex: selectedIndex,
      maxUses: DEFAULT_MAX_USES,
    });
  }

  async function fetchCodeUrl(codeUrl, deps = {}) {
    const fetchImpl = deps.fetchImpl || (typeof fetch === 'function' ? fetch.bind(globalThis) : null);
    if (typeof fetchImpl !== 'function') {
      throw new Error('自定义 URL 接码网络请求实现不可用。');
    }
    const controller = typeof AbortController === 'function' ? new AbortController() : null;
    const timeoutId = controller
      ? setTimeout(() => controller.abort(), Number(deps.requestTimeoutMs) || DEFAULT_REQUEST_TIMEOUT_MS)
      : null;
    try {
      const separator = codeUrl.includes('?') ? '&' : '?';
      const response = await fetchImpl(`${codeUrl}${separator}t=${Date.now()}`, {
        method: 'GET',
        cache: 'no-store',
        headers: { Accept: 'application/json,text/plain,*/*' },
        signal: controller?.signal,
      });
      const text = await response.text();
      if (!response.ok) {
        const error = new Error(`自定义 URL 接码查询失败：${describePayload(text) || response.status}`);
        error.status = response.status;
        throw error;
      }
      return text;
    } catch (error) {
      if (error?.name === 'AbortError') {
        throw new Error('自定义 URL 接码查询超时。');
      }
      throw error;
    } finally {
      if (timeoutId) {
        clearTimeout(timeoutId);
      }
    }
  }

  async function pollActivationCode(state = {}, activation, options = {}, deps = {}) {
    const normalizedActivation = normalizeActivation(activation);
    if (!normalizedActivation) {
      throw new Error('缺少自定义 URL 接码订单。');
    }
    const codeUrl = normalizedActivation.codeUrl;
    const timeoutMs = Math.max(1000, Number(options.timeoutMs) || DEFAULT_POLL_TIMEOUT_MS);
    const intervalMs = Math.max(1000, Number(options.intervalMs) || DEFAULT_POLL_INTERVAL_MS);
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
      const text = await fetchCodeUrl(codeUrl, deps);
      pollCount += 1;
      lastResponse = describePayload(text);
      if (typeof options.onStatus === 'function') {
        await options.onStatus({
          activation: normalizedActivation,
          elapsedMs: Date.now() - start,
          pollCount,
          statusText: lastResponse || '等待中',
          timeoutMs,
        });
      }
      if (!isNoSmsResponse(text)) {
        const code = extractVerificationCode(text);
        if (code) {
          return code;
        }
      }
      if (typeof options.onWaitingForCode === 'function') {
        await options.onWaitingForCode({
          activation: normalizedActivation,
          elapsedMs: Date.now() - start,
          pollCount,
          statusText: lastResponse || '等待中',
          timeoutMs,
        });
      }
      await deps.sleepWithStop?.(intervalMs);
    }

    const suffix = lastResponse ? ` 最后状态：${lastResponse}` : '';
    throw new Error(`${PHONE_CODE_TIMEOUT_ERROR_PREFIX}等待手机验证码超时。${suffix}`);
  }

  // 用户自带号码，无需向平台取消/拉黑/完成订单，均为 no-op。
  async function noopActivation() {
    return '';
  }

  async function reuseActivation(_state = {}, activation) {
    return activation && typeof activation === 'object' ? { ...activation } : activation;
  }

  async function rotateActivation(_state = {}, activation) {
    return {
      currentTicketId: normalizeText(activation?.activationId || activation?.codeUrl || ''),
      nextActivation: null,
    };
  }

  function resolveCountryCandidates() {
    return [];
  }

  function createProvider(deps = {}) {
    const providerDeps = {
      fetchImpl: deps.fetchImpl,
      sleepWithStop: deps.sleepWithStop,
      throwIfStopped: deps.throwIfStopped,
      addLog: deps.addLog,
      setState: deps.setState,
      requestTimeoutMs: deps.requestTimeoutMs || DEFAULT_REQUEST_TIMEOUT_MS,
    };
    const capabilities = Object.freeze({
      supportsReusableActivation: false,
      supportsAutomaticFreeReuse: false,
      supportsFreeReusePreservation: false,
      supportsPageResend: true,
      supportsPageResendProbe: true,
      requiresCountrySelection: false,
    });
    return {
      id: PROVIDER_ID,
      label: '自定义 URL 接码',
      capabilities,
      defaultProduct: 'custom',
      normalizeActivation,
      resolveCountryCandidates,
      resolveCountryLabel: () => '',
      resolveActivationCountry: () => ({ id: '', label: '' }),
      getActivationCountryKey: () => '',
      getActivationPrice: () => null,
      requestActivation: (state, options) => requestActivation(state, options, providerDeps),
      reuseActivation: (state, activation) => reuseActivation(state, activation, providerDeps),
      finishActivation: () => noopActivation(),
      cancelActivation: () => noopActivation(),
      banActivation: () => noopActivation(),
      requestAdditionalSms: () => noopActivation(),
      rotateActivation: (state, activation, options) => rotateActivation(state, activation, options, providerDeps),
      pollActivationCode: (state, activation, options) => pollActivationCode(state, activation, options, providerDeps),
      prepareActivationForReuse: async () => ({
        ok: false,
        reason: 'prepare_unsupported',
        message: '自定义 URL 接码不支持自动复用准备。',
      }),
      canPersistReusableActivation: () => false,
      canPreserveActivationForFreeReuse: () => false,
      shouldUsePageResend: () => true,
      shouldProbePageResend: () => true,
      parseSmsPool,
      extractVerificationCode,
      isNoSmsResponse,
      describePayload,
    };
  }

  return {
    PROVIDER_ID,
    POOL_SEPARATOR,
    createProvider,
    parseSmsPool,
    normalizeActivation,
    extractVerificationCode,
    isNoSmsResponse,
    describePayload,
  };
});
