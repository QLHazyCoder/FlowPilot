(function yahooUtilsModule(root, factory) {
  if (typeof module !== 'undefined' && module.exports) {
    module.exports = factory();
    return;
  }

  root.YahooUtils = factory();
})(typeof self !== 'undefined' ? self : globalThis, function createYahooUtils() {
  const YAHOO_PROVIDER = 'yahoo';
  const YAHOO_GENERATOR = 'yahoo';

  function normalizeText(value) {
    return String(value || '').replace(/\s+/g, ' ').trim().toLowerCase();
  }

  function normalizeTimestamp(value) {
    if (!value) return 0;
    if (typeof value === 'number' && Number.isFinite(value)) {
      return value > 0 ? value : 0;
    }
    const timestamp = Date.parse(String(value || ''));
    return Number.isFinite(timestamp) ? timestamp : 0;
  }

  function extractYahooVerificationCode(text) {
    const source = String(text || '');
    const matchCn = source.match(/(?:代码为|验证码[^0-9]*?)[\s：:]*(\d{6})/i);
    if (matchCn) return matchCn[1];

    const matchOpenAi = source.match(/(?:your\s+chatgpt\s+code\s+is|verification\s+code|code(?:\s+is)?)[^0-9]{0,16}(\d{6})/i);
    if (matchOpenAi) return matchOpenAi[1];

    const matchStandalone = source.match(/\b(\d{6})\b/);
    return matchStandalone ? matchStandalone[1] : null;
  }

  function normalizeYahooAlias(item = {}) {
    const safeItem = item && typeof item === 'object' ? item : {};
    const email = String(safeItem.email || safeItem.alias || safeItem.address || '').trim().toLowerCase();
    if (!email || !email.includes('@')) {
      return null;
    }
    return {
      id: String(safeItem.id || safeItem.aliasId || email).trim(),
      email,
      label: String(safeItem.label || '').trim(),
      note: String(safeItem.note || '').trim(),
      active: safeItem.active !== false,
      used: Boolean(safeItem.used),
      preserved: Boolean(safeItem.preserved),
      createdAt: safeItem.createdAt || safeItem.created_at || null,
    };
  }

  function normalizeYahooAliasList(list = []) {
    return (Array.isArray(list) ? list : [])
      .map((item) => normalizeYahooAlias(item))
      .filter(Boolean);
  }

  function pickReusableYahooAlias(list = []) {
    return normalizeYahooAliasList(list).find((item) => item.active && !item.used) || null;
  }

  function messageMatchesYahooFilters(message = {}, filters = {}) {
    const afterTimestamp = normalizeTimestamp(filters.afterTimestamp);
    const senderFilters = (filters.senderFilters || []).map(normalizeText).filter(Boolean);
    const subjectFilters = (filters.subjectFilters || []).map(normalizeText).filter(Boolean);
    const excludedCodes = new Set((filters.excludeCodes || []).map((item) => String(item || '').trim()).filter(Boolean));

    const sender = normalizeText(message.sender || message.from || '');
    const subject = normalizeText(message.subject || '');
    const body = normalizeText(message.bodyText || message.preview || message.body || '');
    const receivedAt = normalizeTimestamp(message.receivedAt || message.receivedDateTime || message.timestamp);

    if (afterTimestamp && receivedAt && receivedAt < afterTimestamp) {
      return null;
    }

    const senderMatch = senderFilters.length === 0
      ? true
      : senderFilters.some((item) => sender.includes(item) || body.includes(item));
    const subjectMatch = subjectFilters.length === 0
      ? true
      : subjectFilters.some((item) => subject.includes(item) || body.includes(item));

    if (!senderMatch && !subjectMatch) {
      return null;
    }

    const code = extractYahooVerificationCode([subject, body, sender].join(' '));
    if (!code || excludedCodes.has(code)) {
      return null;
    }

    return {
      code,
      message,
      receivedAt,
    };
  }

  function pickYahooVerificationMessage(messages = [], filters = {}) {
    return (Array.isArray(messages) ? messages : [])
      .map((message) => messageMatchesYahooFilters(message, filters))
      .filter(Boolean)
      .sort((left, right) => right.receivedAt - left.receivedAt)[0] || null;
  }

  return {
    YAHOO_PROVIDER,
    YAHOO_GENERATOR,
    extractYahooVerificationCode,
    normalizeText,
    normalizeTimestamp,
    normalizeYahooAlias,
    normalizeYahooAliasList,
    pickReusableYahooAlias,
    pickYahooVerificationMessage,
  };
});
