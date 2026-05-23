// phone-sms/providers/fr-sms.js — FR 短信发送渠道（完全独立，不复用其他接码平台代码）
(function attachFrSmsProvider(root, factory) {
  root.PhoneSmsFrSmsProvider = factory();
})(typeof self !== 'undefined' ? self : globalThis, function createFrSmsProviderModule() {
  const PROVIDER_ID = 'fr';
  const DEFAULT_POLL_INTERVAL_MS = 3000;
  const DEFAULT_POLL_TIMEOUT_MS = 180000;
  const DEFAULT_REQUEST_TIMEOUT_MS = 15000;
  const DEFAULT_OPERATION_DELAY_MS = 1500;

  /**
   * 解析用户粘贴的 phone|url 文本，每行一个
   * 格式: 15879103243|http://fr88.site/api/msgForeign?code=14794481d9cdf52b
   */
  function parseFrLines(text = '') {
    const lines = String(text || '').split(/[\r\n]+/);
    const entries = [];
    const seenPhones = new Set();
    for (const line of lines) {
      const trimmed = line.trim();
      if (!trimmed) continue;
      const pipeIndex = trimmed.indexOf('|');
      if (pipeIndex < 0) continue;
      const phone = trimmed.substring(0, pipeIndex).trim().replace(/[^\d+]/g, '');
      const url = trimmed.substring(pipeIndex + 1).trim();
      if (!phone || !url) continue;
      if (seenPhones.has(phone)) continue;
      seenPhones.add(phone);
      entries.push({ phone, url, used: false });
    }
    return entries;
  }

  /**
   * 从响应文本中提取验证码
   * 响应格式: "您的验证代码是：833831|2026-06-25" 或 "没有获取到验证码|2026-06-25"
   */
  function extractCode(text = '') {
    const trimmed = String(text || '').trim();
    if (!trimmed) return '';
    // 去掉 | 后面的日期部分，只取消息部分
    const pipeIndex = trimmed.lastIndexOf('|');
    const messagePart = pipeIndex >= 0 ? trimmed.substring(0, pipeIndex) : trimmed;
    // 提取 4-8 位数字验证码
    const digitMatch = messagePart.match(/\b(\d{4,8})\b/);
    return digitMatch ? digitMatch[1] : '';
  }

  function isNoCodeResponse(text = '') {
    const trimmed = String(text || '').trim();
    if (!trimmed) return true;
    return /没有获取到验证码|未收到验证码|暂无验证码|no.*verif.*code|not.*found|未收到|暂无短信/i.test(trimmed);
  }

  function buildFrLogPrefix(entry = {}, roundCount = 0) {
    const phone = String(entry?.phone || '未知号码');
    const masked = phone.length > 4
      ? `${phone.slice(0, 3)}****${phone.slice(-4)}`
      : phone;
    const roundInfo = roundCount > 0 ? `[第${roundCount}轮]` : '';
    return `FR 渠道 ${masked} ${roundInfo}`.trim();
  }

  async function fetchCodeFromUrl(url = '', fetchImpl, requestTimeoutMs = DEFAULT_REQUEST_TIMEOUT_MS) {
    if (!fetchImpl) {
      throw new Error('FR 渠道网络请求不可用');
    }
    const controller = typeof AbortController === 'function' ? new AbortController() : null;
    const timeoutId = controller
      ? setTimeout(() => controller.abort(), requestTimeoutMs)
      : null;
    try {
      const response = await fetchImpl(url, {
        method: 'GET',
        signal: controller?.signal,
      });
      const text = await response.text();
      return { text, ok: response.ok };
    } finally {
      if (timeoutId) clearTimeout(timeoutId);
    }
  }

  async function pollForCode(entry = {}, options = {}, deps = {}) {
    const url = String(entry?.url || options?.url || '').trim();
    if (!url) {
      throw new Error('FR 渠道缺少验证码获取地址');
    }
    const fetchImpl = deps.fetchImpl || (typeof fetch === 'function' ? fetch.bind(globalThis) : null);
    const pollIntervalMs = Math.max(1000, Number(options.pollIntervalMs || deps.pollIntervalMs) || DEFAULT_POLL_INTERVAL_MS);
    const pollTimeoutMs = Math.max(5000, Number(options.pollTimeoutMs || deps.pollTimeoutMs) || DEFAULT_POLL_TIMEOUT_MS);
    const requestTimeoutMs = Math.max(2000, Number(options.requestTimeoutMs || deps.requestTimeoutMs) || DEFAULT_REQUEST_TIMEOUT_MS);
    const maxRounds = Math.max(0, Number(options.maxRounds || deps.maxRounds) || 0);
    const addLog = deps.addLog || options.addLog;

    const start = Date.now();
    let lastText = '';
    let roundCount = 0;

    while (Date.now() - start < pollTimeoutMs) {
      if (maxRounds > 0 && roundCount >= maxRounds) break;

      deps.throwIfStopped?.();
      roundCount += 1;

      try {
        const { text, ok } = await fetchCodeFromUrl(url, fetchImpl, requestTimeoutMs);
        lastText = text;
        const code = extractCode(text);
        if (code) {
          if (typeof addLog === 'function') {
            await addLog(`${buildFrLogPrefix(entry, roundCount)} 获取到验证码：${code}`, 'ok');
          }
          return { code, raw: text, roundCount, elapsedMs: Date.now() - start };
        }
        if (isNoCodeResponse(text)) {
          if (typeof addLog === 'function') {
            await addLog(`${buildFrLogPrefix(entry, roundCount)} 暂无验证码，${pollIntervalMs / 1000}秒后重试...`, 'info');
          }
        } else {
          if (typeof addLog === 'function') {
            const preview = text.length > 80 ? `${text.substring(0, 80)}...` : text;
            await addLog(`${buildFrLogPrefix(entry, roundCount)} 响应中未提取到验证码：${preview}`, 'warn');
          }
        }
      } catch (error) {
        lastText = error?.message || String(error);
        if (typeof addLog === 'function') {
          await addLog(`${buildFrLogPrefix(entry, roundCount)} 请求出错：${lastText}`, 'warn');
        }
      }

      await deps.sleepWithStop?.(pollIntervalMs);
    }

    const timeoutSeconds = Math.ceil(pollTimeoutMs / 1000);
    const preview = lastText ? `，最后响应：${lastText.substring(0, 120)}` : '';
    throw new Error(`FR 渠道获取验证码超时（${timeoutSeconds}秒/${roundCount}轮）${preview}`);
  }

  /** 调试用：直接请求指定 URL 并打印返回的验证码 */
  async function debugFetchCode(url = '', options = {}, deps = {}) {
    const fetchImpl = deps.fetchImpl || (typeof fetch === 'function' ? fetch.bind(globalThis) : null);
    if (!fetchImpl) {
      return { url, code: '', error: '网络请求不可用' };
    }
    try {
      const { text, ok } = await fetchCodeFromUrl(url, fetchImpl,
        Number(options.requestTimeoutMs) || DEFAULT_REQUEST_TIMEOUT_MS);
      const code = extractCode(text);
      return { url, code, raw: text, ok };
    } catch (error) {
      return { url, code: '', error: error?.message || String(error) };
    }
  }

  function normalizeFrPollIntervalSeconds(state = {}) {
    const seconds = Math.max(1, Math.min(60, Number(state?.frPollIntervalSeconds) || 3));
    return seconds;
  }

  function normalizeFrPollTimeoutSeconds(state = {}) {
    const seconds = Math.max(10, Math.min(600, Number(state?.frPollTimeoutSeconds) || 180));
    return seconds;
  }

  function normalizeFrOperationDelayMs(state = {}) {
    const ms = Math.max(500, Math.min(10000, Number(state?.frOperationDelayMs) || DEFAULT_OPERATION_DELAY_MS));
    return ms;
  }

  function createProvider(deps = {}) {
    const providerDeps = {
      fetchImpl: deps.fetchImpl || (typeof fetch === 'function' ? fetch.bind(globalThis) : null),
      sleepWithStop: deps.sleepWithStop,
      throwIfStopped: deps.throwIfStopped,
      addLog: deps.addLog,
      requestTimeoutMs: deps.requestTimeoutMs || DEFAULT_REQUEST_TIMEOUT_MS,
      pollIntervalMs: deps.pollIntervalMs || DEFAULT_POLL_INTERVAL_MS,
      pollTimeoutMs: deps.pollTimeoutMs || DEFAULT_POLL_TIMEOUT_MS,
    };
    return {
      id: PROVIDER_ID,
      label: 'FR',
      parseLines: parseFrLines,
      extractCode,
      isNoCodeResponse,
      fetchCodeFromUrl: (url) => fetchCodeFromUrl(url, providerDeps.fetchImpl),
      pollForCode: (entry, options) => pollForCode(entry, options, providerDeps),
      debugFetchCode: (url, options) => debugFetchCode(url, options, providerDeps),
    };
  }

  return {
    PROVIDER_ID,
    DEFAULT_POLL_INTERVAL_MS,
    DEFAULT_POLL_TIMEOUT_MS,
    DEFAULT_REQUEST_TIMEOUT_MS,
    DEFAULT_OPERATION_DELAY_MS,
    createProvider,
    parseFrLines,
    extractCode,
    isNoCodeResponse,
    fetchCodeFromUrl,
    pollForCode,
    debugFetchCode,
    normalizeFrPollIntervalSeconds,
    normalizeFrPollTimeoutSeconds,
    normalizeFrOperationDelayMs,
  };
});
