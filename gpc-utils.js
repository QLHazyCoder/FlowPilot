(function attachGpcUtils(root, factory) {
  root.GpcUtils = factory();
})(typeof self !== 'undefined' ? self : globalThis, function createGpcUtils() {
  const PLUS_PAYMENT_METHOD_PAYPAL = 'paypal';
  const PLUS_PAYMENT_METHOD_PAYPAL_HOSTED = 'paypal-hosted';
  const PLUS_PAYMENT_METHOD_NONE = 'none';
  const PLUS_PAYMENT_METHOD_GPC_HELPER = 'gpc-helper';
  const PLUS_PAYMENT_METHOD_AUTO = 'plus-auto';
  const DEFAULT_GPC_BASE_URL = 'https://gpc.qlhazycoder.top';
  const ALLOWED_GPC_REMOTE_HOST = 'gpc.qlhazycoder.top';
  const DEFAULT_AUTO_BASE_URL = 'https://auto.1iiu.com';

  function normalizePlusPaymentMethod(value = '') {
    const normalized = String(value || '').trim().toLowerCase();
    if (normalized === PLUS_PAYMENT_METHOD_NONE || normalized === 'no-payment' || normalized === 'skip-payment') {
      return PLUS_PAYMENT_METHOD_NONE;
    }
    if (normalized === PLUS_PAYMENT_METHOD_PAYPAL_HOSTED || normalized === 'paypal_direct' || normalized === 'paypal-direct') {
      return PLUS_PAYMENT_METHOD_PAYPAL_HOSTED;
    }
    if (normalized === PLUS_PAYMENT_METHOD_GPC_HELPER) {
      return PLUS_PAYMENT_METHOD_GPC_HELPER;
    }
    if (normalized === PLUS_PAYMENT_METHOD_AUTO || normalized === 'pix' || normalized === 'pix_plus' || normalized === 'pixplus') {
      return PLUS_PAYMENT_METHOD_AUTO;
    }
    return PLUS_PAYMENT_METHOD_PAYPAL;
  }

  // Plus 自动充值渠道仅依赖固定端点 /api/v1/redeem 与 /api/v1/orders/{id}，
  // 鉴权通过卡密(cdk)完成，因此只需归一化 baseUrl 与 cdk。
  function normalizeAutoBaseUrl(value = '') {
    const trimmed = String(value || '').trim().replace(/\/+$/g, '');
    if (!trimmed) {
      return DEFAULT_AUTO_BASE_URL;
    }
    try {
      const parsed = new URL(trimmed);
      if (parsed.protocol !== 'http:' && parsed.protocol !== 'https:') {
        return DEFAULT_AUTO_BASE_URL;
      }
      return `${parsed.origin}${parsed.pathname.replace(/\/+$/g, '')}`;
    } catch {
      return DEFAULT_AUTO_BASE_URL;
    }
  }

  function normalizeAutoCdk(value = '') {
    // Plus 自动充值卡密格式为 QZ-XXXX-XXXX-XXXX，作为鉴权凭证按原样传输：
    // 只去首尾空白，保留原始字符（不转大小写），避免破坏可能的大小写敏感字符。
    return String(value || '').trim();
  }

  function buildAutoApiUrl(baseUrl = '', path = '') {
    const normalizedBase = normalizeAutoBaseUrl(baseUrl);
    const normalizedPath = String(path || '').startsWith('/') ? String(path || '') : `/${String(path || '')}`;
    return `${normalizedBase}${normalizedPath}`;
  }

  function normalizeGpcRemainingUses(value) {
    if (value === undefined || value === null || String(value).trim() === '') {
      return null;
    }
    const numeric = Number(value);
    return Number.isFinite(numeric) ? Math.max(0, Math.floor(numeric)) : null;
  }

  function normalizeGpcCardKey(value = '') {
    return String(value || '').trim().toUpperCase();
  }

  function isGpcCardKeyFormat(value = '') {
    return /^GPC-[A-F0-9]{8}-[A-F0-9]{8}-[A-F0-9]{8}$/.test(normalizeGpcCardKey(value));
  }

  function unwrapGpcResponse(payload = {}) {
    if (!payload || typeof payload !== 'object' || Array.isArray(payload)) {
      return payload;
    }
    const hasUnifiedShape = Object.prototype.hasOwnProperty.call(payload, 'data')
      && (
        Object.prototype.hasOwnProperty.call(payload, 'code')
        || Object.prototype.hasOwnProperty.call(payload, 'message')
      );
    return hasUnifiedShape ? (payload.data ?? {}) : payload;
  }

  function unwrapGpcBalancePayload(payload = {}) {
    const data = unwrapGpcResponse(payload);
    if (!data || typeof data !== 'object' || Array.isArray(data)) {
      return data;
    }
    const hasBalanceFields = [
      'remaining_uses',
      'remainingUses',
      'balance',
      'remaining',
      'uses',
      'available_uses',
      'availableUses',
      'status',
      'card_status',
      'cardStatus',
      'card_type',
      'cardType',
      'expires_at',
      'expiresAt',
    ].some((key) => Object.prototype.hasOwnProperty.call(data, key));
    if (!hasBalanceFields && data.data && typeof data.data === 'object' && !Array.isArray(data.data)) {
      return data.data;
    }
    return data;
  }

  function getGpcBalanceRemainingUses(payload = {}) {
    const data = unwrapGpcBalancePayload(payload);
    if (!data || typeof data !== 'object') {
      return null;
    }
    return normalizeGpcRemainingUses(
      data.remaining_uses
      ?? data.remainingUses
      ?? data.balance
      ?? data.remaining
      ?? data.uses
      ?? data.available_uses
      ?? data.availableUses
    );
  }

  function getGpcCardStatus(payload = {}) {
    const data = unwrapGpcBalancePayload(payload);
    if (!data || typeof data !== 'object') {
      return '';
    }
    return String(data.status || data.card_status || data.cardStatus || '').trim();
  }

  function normalizeGpcBaseUrl(apiUrl = '') {
    let normalized = String(apiUrl || DEFAULT_GPC_BASE_URL).trim();
    if (!normalized) {
      return DEFAULT_GPC_BASE_URL;
    }
    normalized = normalized.replace(/\/+$/g, '');
    normalized = normalized.replace(/\/api\/checkout\/start$/i, '');
    normalized = normalized.replace(/\/api\/web\/card\/balance(?:\?.*)?$/i, '');
    normalized = normalized.replace(/\/api\/card\/balance(?:\?.*)?$/i, '');

    try {
      const parsed = new URL(normalized);
      const hostname = parsed.hostname.toLowerCase();
      if (hostname === ALLOWED_GPC_REMOTE_HOST || hostname === 'localhost' || hostname === '127.0.0.1') {
        return normalized || DEFAULT_GPC_BASE_URL;
      }
      return DEFAULT_GPC_BASE_URL;
    } catch {
      return DEFAULT_GPC_BASE_URL;
    }
  }

  function buildGpcApiUrl(apiUrl = '', path = '') {
    const baseUrl = normalizeGpcBaseUrl(apiUrl);
    if (!baseUrl) {
      return '';
    }
    const normalizedPath = String(path || '').startsWith('/') ? String(path || '') : `/${String(path || '')}`;
    return `${baseUrl}${normalizedPath}`;
  }

  function buildGpcCardBalanceUrl(apiUrl = '', cardKey = '') {
    const baseUrl = buildGpcApiUrl(apiUrl, '/api/web/card/balance');
    const normalizedCardKey = normalizeGpcCardKey(cardKey);
    if (!baseUrl || !normalizedCardKey) {
      return baseUrl;
    }
    return `${baseUrl}?card_key=${encodeURIComponent(normalizedCardKey)}`;
  }

  function isGpcUnifiedResponseOk(payload = {}) {
    if (!payload || typeof payload !== 'object' || Array.isArray(payload)) {
      return true;
    }
    if (!Object.prototype.hasOwnProperty.call(payload, 'code')) {
      return payload.ok !== false;
    }
    const code = Number(payload.code);
    if (Number.isFinite(code)) {
      return code >= 200 && code < 300;
    }
    return String(payload.code || '').trim() === '200';
  }

  function formatGpcErrorField(field) {
    if (field === undefined || field === null) {
      return '';
    }
    if (typeof field === 'string') {
      return field.trim();
    }
    if (typeof field !== 'object') {
      return String(field).trim();
    }
    const key = Array.isArray(field.loc)
      ? field.loc.join('.')
      : String(field.field || field.path || field.name || field.param || '').trim();
    const message = String(field.msg || field.message || field.error || field.detail || field.reason || '').trim();
    return [key, message].filter(Boolean).join(': ') || JSON.stringify(field);
  }

  function normalizeLinkedAccountError(text = '') {
    return /account\s+already\s+linked/i.test(String(text || ''))
      ? '账号已经绑定订阅，需要手动解绑'
      : String(text || '').trim();
  }

  function extractGpcResponseErrorDetail(payload = {}, status = 0) {
    if (!payload || typeof payload !== 'object') {
      return status ? `HTTP ${status}` : '未知错误';
    }

    const payloadText = JSON.stringify(payload).toLowerCase();
    if (/account\s+already\s+linked/i.test(payloadText)) {
      return '账号已经绑定订阅，需要手动解绑';
    }

    const data = payload.data;
    if (data && typeof data === 'object' && !Array.isArray(data)) {
      const nestedDetail = data.detail ?? data.error ?? data.reason;
      if (nestedDetail !== undefined && nestedDetail !== null && String(nestedDetail).trim()) {
        return normalizeLinkedAccountError(nestedDetail);
      }
      const fields = data.fields ?? data.errors;
      if (Array.isArray(fields) && fields.length > 0) {
        const formatted = fields
          .map(formatGpcErrorField)
          .filter(Boolean)
          .join('; ');
        if (formatted) {
          return formatted;
        }
      }
    }

    const direct = payload.detail
      ?? payload.message
      ?? payload.error
      ?? payload.error_description
      ?? payload.reason;
    if (direct !== undefined && direct !== null && String(direct).trim()) {
      return normalizeLinkedAccountError(direct);
    }

    const errorMessages = payload.error_messages ?? payload.errorMessages;
    if (Array.isArray(errorMessages) && errorMessages.length > 0) {
      const firstMessage = normalizeLinkedAccountError(errorMessages[0]);
      if (firstMessage) {
        return firstMessage;
      }
    }

    const errors = payload.errors;
    if (Array.isArray(errors) && errors.length > 0) {
      const first = errors[0];
      if (typeof first === 'string') {
        return first.trim() || (status ? `HTTP ${status}` : '未知错误');
      }
      if (first && typeof first === 'object') {
        const field = Array.isArray(first.loc) ? first.loc.join('.') : String(first.field || first.path || '').trim();
        const message = String(first.msg || first.message || first.error || '').trim();
        return [field, message].filter(Boolean).join(': ') || JSON.stringify(first);
      }
    }

    return status ? `HTTP ${status}` : '未知错误';
  }

  function formatGpcBalancePayload(payload = {}) {
    const data = unwrapGpcBalancePayload(payload);
    if (!data || typeof data !== 'object') {
      return '';
    }
    const candidates = [
      data.remaining_uses,
      data.remainingUses,
      data.balance,
      data.remaining,
      data.uses,
      data.available_uses,
      data.availableUses,
    ];
    const firstValue = candidates.find((value) => value !== undefined && value !== null && String(value).trim() !== '');
    const totalUses = data.total_uses ?? data.totalUses;
    const usedUses = data.used_uses ?? data.usedUses;
    const status = String(data.status || data.card_status || data.cardStatus || '').trim();
    const flowId = String(data.flow_id || data.flowId || '').trim();
    const parts = [];
    if (firstValue !== undefined) {
      parts.push(totalUses !== undefined && totalUses !== null && String(totalUses).trim() !== ''
        ? `余额 ${firstValue}/${totalUses}`
        : `余额 ${firstValue}`);
    }
    if (usedUses !== undefined && usedUses !== null && String(usedUses).trim() !== '') {
      parts.push(`已用 ${usedUses}`);
    }
    if (status) {
      parts.push(`状态 ${status}`);
    }
    if (flowId) {
      parts.push(`flow_id ${flowId}`);
    }
    return parts.join('，');
  }

  return {
    DEFAULT_GPC_BASE_URL,
    DEFAULT_AUTO_BASE_URL,
    PLUS_PAYMENT_METHOD_GPC_HELPER,
    PLUS_PAYMENT_METHOD_AUTO,
    PLUS_PAYMENT_METHOD_NONE,
    PLUS_PAYMENT_METHOD_PAYPAL,
    PLUS_PAYMENT_METHOD_PAYPAL_HOSTED,
    buildGpcApiUrl,
    buildAutoApiUrl,
    buildGpcCardBalanceUrl,
    extractGpcResponseErrorDetail,
    formatGpcBalancePayload,
    getGpcBalanceRemainingUses,
    getGpcCardStatus,
    isGpcCardKeyFormat,
    isGpcUnifiedResponseOk,
    normalizeGpcBaseUrl,
    normalizeGpcCardKey,
    normalizeGpcRemainingUses,
    normalizeAutoBaseUrl,
    normalizeAutoCdk,
    normalizePlusPaymentMethod,
    unwrapGpcBalancePayload,
    unwrapGpcResponse,
  };
});
