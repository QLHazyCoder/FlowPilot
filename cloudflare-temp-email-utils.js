(function cloudflareTempEmailUtilsModule(root, factory) {
  if (typeof module !== 'undefined' && module.exports) {
    module.exports = factory();
    return;
  }

  root.CloudflareTempEmailUtils = factory();
})(typeof self !== 'undefined' ? self : globalThis, function createCloudflareTempEmailUtils() {
  const DEFAULT_MAIL_PAGE_SIZE = 20;

  function firstNonEmptyString(values) {
    for (const value of values) {
      if (value === undefined || value === null) continue;
      if (typeof value === 'object') continue;
      const normalized = String(value).trim();
      if (normalized) return normalized;
    }
    return '';
  }

  function normalizeCloudflareTempEmailBaseUrl(rawValue = '') {
    const value = String(rawValue || '').trim();
    if (!value) return '';

    const candidate = /^[a-zA-Z][a-zA-Z\d+\-.]*:\/\//.test(value) ? value : `https://${value}`;
    try {
      const parsed = new URL(candidate);
      parsed.hash = '';
      parsed.search = '';
      const pathname = parsed.pathname === '/' ? '' : parsed.pathname.replace(/\/+$/, '');
      return `${parsed.origin}${pathname}`;
    } catch {
      return '';
    }
  }

  function normalizeCloudflareTempEmailDomain(rawValue = '') {
    let value = String(rawValue || '').trim().toLowerCase();
    if (!value) return '';
    value = value.replace(/^@+/, '');
    value = value.replace(/^https?:\/\//, '');
    value = value.replace(/\/.*$/, '');
    if (!/^[a-z0-9.-]+\.[a-z]{2,}$/i.test(value)) {
      return '';
    }
    return value;
  }

  function normalizeCloudflareTempEmailDomains(values) {
    const domains = [];
    const seen = new Set();
    for (const value of Array.isArray(values) ? values : []) {
      const normalized = normalizeCloudflareTempEmailDomain(value);
      if (!normalized || seen.has(normalized)) continue;
      seen.add(normalized);
      domains.push(normalized);
    }
    return domains;
  }

  function buildCloudflareTempEmailHeaders(config = {}, options = {}) {
    const headers = {};
    const adminAuth = firstNonEmptyString([config.adminAuth, config.cloudflareTempEmailAdminAuth]);
    const customAuth = firstNonEmptyString([config.customAuth, config.cloudflareTempEmailCustomAuth]);
    if (adminAuth) {
      headers['x-admin-auth'] = adminAuth;
    }
    if (customAuth) {
      headers['x-custom-auth'] = customAuth;
    }
    if (options.json) {
      headers['Content-Type'] = 'application/json';
    }
    if (options.acceptJson !== false) {
      headers.Accept = 'application/json';
    }
    return headers;
  }

  function joinCloudflareTempEmailUrl(baseUrl, path) {
    const normalizedBase = normalizeCloudflareTempEmailBaseUrl(baseUrl);
    const normalizedPath = String(path || '').trim();
    if (!normalizedBase || !normalizedPath) return normalizedBase || '';
    return `${normalizedBase}${normalizedPath.startsWith('/') ? '' : '/'}${normalizedPath}`;
  }

  function getCloudflareTempEmailMailRows(payload) {
    if (Array.isArray(payload)) return payload;
    if (!payload || typeof payload !== 'object') return [];

    const rowKeys = [
      'data',
      'items',
      'messages',
      'mails',
      'results',
      'result',
      'rows',
      'list',
      'hydra:member',
    ];
    const queue = [payload];
    const seen = new Set();

    while (queue.length) {
      const current = queue.shift();
      if (!current || typeof current !== 'object' || seen.has(current)) {
        continue;
      }
      seen.add(current);

      for (const key of rowKeys) {
        const candidate = current[key];
        if (Array.isArray(candidate)) {
          return candidate;
        }
        if (candidate && typeof candidate === 'object') {
          queue.push(candidate);
        }
      }
    }

    return [];
  }

  function normalizeCloudflareTempEmailAddress(value) {
    const source = String(value || '').trim();
    if (!source) return '';
    const bracketMatch = source.match(/<\s*([^<>\s]+@[^<>\s]+)\s*>/);
    const directMatch = source.match(/[a-z0-9._%+-]+@[a-z0-9.-]+\.[a-z]{2,}/i);
    return String(bracketMatch?.[1] || directMatch?.[0] || source).trim().toLowerCase();
  }

  function collectTextCandidates(value, keys = []) {
    const results = [];
    const visit = (entry) => {
      if (entry === undefined || entry === null) return;
      if (typeof entry === 'string' || typeof entry === 'number') {
        const normalized = String(entry).trim();
        if (normalized) results.push(normalized);
        return;
      }
      if (Array.isArray(entry)) {
        entry.forEach(visit);
        return;
      }
      if (typeof entry === 'object') {
        const objectKeys = keys.length ? keys : Object.keys(entry);
        for (const key of objectKeys) {
          if (Object.prototype.hasOwnProperty.call(entry, key)) {
            visit(entry[key]);
          }
        }
      }
    };
    visit(value);
    return results;
  }

  function firstTextCandidate(values, keys = []) {
    for (const value of values) {
      const candidates = collectTextCandidates(value, keys);
      for (const candidate of candidates) {
        if (candidate) return candidate;
      }
    }
    return '';
  }

  function splitRawMessage(raw = '') {
    const source = String(raw || '');
    if (!source) {
      return { headerText: '', bodyText: '' };
    }

    const normalized = source.replace(/\r\n/g, '\n');
    const separatorIndex = normalized.indexOf('\n\n');
    if (separatorIndex === -1) {
      return { headerText: normalized, bodyText: '' };
    }

    return {
      headerText: normalized.slice(0, separatorIndex),
      bodyText: normalized.slice(separatorIndex + 2),
    };
  }

  function parseRawHeaders(headerText = '') {
    const headers = {};
    const lines = String(headerText || '').split('\n');
    let currentName = '';

    for (const line of lines) {
      if (!line) continue;
      if ((line.startsWith(' ') || line.startsWith('\t')) && currentName) {
        headers[currentName] += ` ${line.trim()}`;
        continue;
      }

      const separatorIndex = line.indexOf(':');
      if (separatorIndex <= 0) continue;
      currentName = line.slice(0, separatorIndex).trim().toLowerCase();
      headers[currentName] = line.slice(separatorIndex + 1).trim();
    }

    return headers;
  }

  function decodeMimeEncodedWords(value = '') {
    const source = String(value || '');
    return source.replace(/=\?([^?]+)\?([bBqQ])\?([^?]+)\?=/g, (_match, charset, encoding, encodedText) => {
      try {
        if (String(encoding).toUpperCase() === 'B') {
          return decodeBytesToString(base64ToBytes(encodedText), charset);
        }
        return decodeBytesToString(
          quotedPrintableToBytes(String(encodedText).replace(/_/g, ' '), { headerMode: true }),
          charset
        );
      } catch {
        return encodedText;
      }
    });
  }

  function base64ToBytes(value = '') {
    const normalized = String(value || '').replace(/\s+/g, '');
    if (!normalized) return new Uint8Array();

    if (typeof atob === 'function') {
      const decoded = atob(normalized);
      const bytes = new Uint8Array(decoded.length);
      for (let i = 0; i < decoded.length; i += 1) {
        bytes[i] = decoded.charCodeAt(i);
      }
      return bytes;
    }

    if (typeof Buffer !== 'undefined') {
      return Uint8Array.from(Buffer.from(normalized, 'base64'));
    }

    throw new Error('No base64 decoder available');
  }

  function quotedPrintableToBytes(value = '', options = {}) {
    const { headerMode = false } = options;
    const source = String(value || '')
      .replace(/=\r?\n/g, '')
      .replace(headerMode ? /_/g : /$^/, ' ');

    const bytes = [];
    for (let index = 0; index < source.length; index += 1) {
      const char = source[index];
      if (char === '=' && /^[0-9A-Fa-f]{2}$/.test(source.slice(index + 1, index + 3))) {
        bytes.push(parseInt(source.slice(index + 1, index + 3), 16));
        index += 2;
        continue;
      }
      bytes.push(char.charCodeAt(0));
    }
    return Uint8Array.from(bytes);
  }

  function decodeBytesToString(bytes, charset = 'utf-8') {
    const normalizedCharset = String(charset || 'utf-8').trim().toLowerCase();
    const candidates = [normalizedCharset];
    if (normalizedCharset === 'utf8') {
      candidates.unshift('utf-8');
    }
    if (normalizedCharset === 'gb2312' || normalizedCharset === 'gbk') {
      candidates.unshift('gb18030');
    }

    for (const candidate of candidates) {
      try {
        if (typeof TextDecoder !== 'undefined') {
          return new TextDecoder(candidate, { fatal: false }).decode(bytes);
        }
      } catch {
        // ignore and try fallback
      }
    }

    if (typeof Buffer !== 'undefined') {
      return Buffer.from(bytes).toString('utf8');
    }

    let result = '';
    for (const byte of bytes) {
      result += String.fromCharCode(byte);
    }
    return result;
  }

  function getCharsetFromContentType(contentType = '') {
    const match = String(contentType || '').match(/charset="?([^";]+)"?/i);
    return match ? match[1].trim() : 'utf-8';
  }

  function getBoundaryFromContentType(contentType = '') {
    const match = String(contentType || '').match(/boundary="?([^";]+)"?/i);
    return match ? match[1] : '';
  }

  function decodeHtmlEntityCode(value, radix = 10) {
    const codePoint = parseInt(value, radix);
    if (!Number.isFinite(codePoint) || codePoint < 0 || codePoint > 0x10FFFF) {
      return ' ';
    }
    return String.fromCodePoint(codePoint);
  }

  function stripHtmlTags(value = '') {
    return String(value || '')
      .replace(/<style[\s\S]*?<\/style>/gi, ' ')
      .replace(/<script[\s\S]*?<\/script>/gi, ' ')
      .replace(/<[^>]+>/g, ' ')
      .replace(/&#x([0-9a-f]+);/gi, (_match, code) => decodeHtmlEntityCode(code, 16))
      .replace(/&#(\d+);/g, (_match, code) => decodeHtmlEntityCode(code, 10))
      .replace(/&nbsp;/gi, ' ')
      .replace(/&amp;/gi, '&')
      .replace(/&lt;/gi, '<')
      .replace(/&gt;/gi, '>')
      .replace(/&quot;/gi, '"')
      .replace(/&#39;/g, "'")
      .replace(/\s+/g, ' ')
      .trim();
  }

  function normalizeBodyText(value = '', options = {}) {
    const { html = false } = options;
    const source = String(value || '').trim();
    if (!source) return '';
    const text = html || /<\/?[a-z][\s\S]*>/i.test(source)
      ? stripHtmlTags(source)
      : source;
    return text.replace(/\s+/g, ' ').trim();
  }

  function firstBodyTextCandidate(values, options = {}) {
    const { keys = [], html = false } = options;
    for (const value of values) {
      const candidates = collectTextCandidates(value, keys);
      for (const candidate of candidates) {
        const normalized = normalizeBodyText(candidate, { html });
        if (normalized) return normalized;
      }
    }
    return '';
  }

  function decodeMimeBody(bodyText = '', headers = {}) {
    const contentType = String(headers['content-type'] || '');
    const transferEncoding = String(headers['content-transfer-encoding'] || '').trim().toLowerCase();
    const charset = getCharsetFromContentType(contentType);
    let decoded = String(bodyText || '');

    if (transferEncoding === 'base64') {
      decoded = decodeBytesToString(base64ToBytes(decoded), charset);
    } else if (transferEncoding === 'quoted-printable') {
      decoded = decodeBytesToString(quotedPrintableToBytes(decoded), charset);
    }

    if (/text\/html/i.test(contentType)) {
      return stripHtmlTags(decoded);
    }
    return decoded.replace(/\s+/g, ' ').trim();
  }

  function extractTextFromMime(rawMessage = '', depth = 0) {
    const { headerText, bodyText } = splitRawMessage(rawMessage);
    const headers = parseRawHeaders(headerText);
    const contentType = String(headers['content-type'] || '');
    const boundary = getBoundaryFromContentType(contentType);

    if (/multipart\//i.test(contentType) && boundary && depth < 6) {
      const marker = `--${boundary}`;
      const sections = String(bodyText || '')
        .split(marker)
        .map((part) => part.trim())
        .filter((part) => part && part !== '--');

      const extractedParts = sections
        .map((part) => part.replace(/--\s*$/, '').trim())
        .map((part) => extractTextFromMime(part, depth + 1)?.text || '')
        .filter(Boolean);

      const plainText = extractedParts.join(' ').replace(/\s+/g, ' ').trim();
      return {
        headers,
        text: plainText,
      };
    }

    return {
      headers,
      text: decodeMimeBody(bodyText, headers),
    };
  }

  function normalizeReceivedDateTime(value) {
    if (!value && value !== 0) return '';
    if (typeof value === 'number' && Number.isFinite(value)) {
      return new Date(value).toISOString();
    }
    const source = String(value || '').trim();
    if (!source) return '';
    const parsed = Date.parse(source);
    return Number.isFinite(parsed) ? new Date(parsed).toISOString() : source;
  }

  function normalizeCloudflareTempEmailMessage(row = {}) {
    if (!row || typeof row !== 'object') return null;

    const raw = firstTextCandidate([row.raw, row.source, row.mime, row.message], [
      'raw',
      'source',
      'mime',
      'message',
      'content',
      'value',
    ]);
    const parsedMime = raw ? extractTextFromMime(raw) : { headers: {}, text: '' };
    const address = normalizeCloudflareTempEmailAddress(firstTextCandidate([
      row.address,
      row.mail_address,
      row.mailAddress,
      row.email,
      row.recipient,
      row.to,
      row.mailTo,
      row.receiver,
      row.receivers,
      row.envelope_to,
      row.envelopeTo,
      parsedMime.headers.to,
    ], [
      'emailAddress',
      'address',
      'email',
      'value',
      'recipient',
      'mailbox',
      'to',
    ]));
    const originalRecipient = normalizeCloudflareTempEmailAddress(firstTextCandidate([
      row.original_recipient,
      row.originalRecipient,
      row.original_recipient_email,
      row.originalRecipientEmail,
      row.envelope_to,
      row.envelopeTo,
    ], [
      'emailAddress',
      'address',
      'email',
      'value',
      'recipient',
      'mailbox',
      'to',
    ]));
    const subject = decodeMimeEncodedWords(firstTextCandidate([
      row.subject,
      row.title,
      parsedMime.headers.subject,
    ]));
    const fromAddress = decodeMimeEncodedWords(firstTextCandidate([
      row.from,
      row.sender,
      row.mail_from,
      row.mailFrom,
      row.from_email,
      row.fromEmail,
      row.sender_email,
      row.senderEmail,
      parsedMime.headers.from,
    ], [
      'emailAddress',
      'address',
      'email',
      'value',
      'name',
      'from',
      'sender',
    ]));
    const bodyText = firstBodyTextCandidate([
      row.bodyPreview,
      row.snippet,
      row.text,
      row.text_content,
      row.textContent,
      row.preview,
      row.body,
      row.content,
    ], {
      keys: ['content', 'text', 'plain', 'value', 'body', 'bodyPreview'],
    });
    const htmlText = firstBodyTextCandidate([
      row.html_content,
      row.htmlContent,
      row.html_body,
      row.htmlBody,
      row.body_html,
      row.bodyHtml,
      row.content_html,
      row.contentHtml,
      row.raw_html,
      row.rawHtml,
      row.html,
    ], {
      html: true,
      keys: ['content', 'html', 'value', 'body'],
    });
    const bodyPreview = firstNonEmptyString([
      bodyText,
      htmlText,
      parsedMime.text,
      raw,
    ]).replace(/\s+/g, ' ').trim();

    return {
      id: firstNonEmptyString([row.id, row._id, row.mail_id, row.mailId, row.message_id, row.messageId, row.msgid]),
      address,
      originalRecipient,
      addressId: firstNonEmptyString([row.address_id, row.addressId]),
      subject,
      from: {
        emailAddress: {
          address: fromAddress,
        },
      },
      bodyPreview,
      raw,
      receivedDateTime: normalizeReceivedDateTime(firstNonEmptyString([
        row.receivedDateTime,
        row.received_at,
        row.receivedAt,
        row.created_at,
        row.createdAt,
        row.updated_at,
        row.updatedAt,
        row.date,
        row.timestamp,
      ])),
    };
  }

  function normalizeCloudflareTempEmailMailApiMessages(payload) {
    return getCloudflareTempEmailMailRows(payload)
      .map((row) => normalizeCloudflareTempEmailMessage(row))
      .filter(Boolean);
  }

  function getCloudflareTempEmailAddressFromResponse(payload = {}) {
    return firstNonEmptyString([
      payload.address,
      payload.email,
      payload?.data?.address,
      payload?.data?.email,
    ]);
  }

  return {
    DEFAULT_MAIL_PAGE_SIZE,
    buildCloudflareTempEmailHeaders,
    getCloudflareTempEmailAddressFromResponse,
    joinCloudflareTempEmailUrl,
    normalizeCloudflareTempEmailAddress,
    normalizeCloudflareTempEmailBaseUrl,
    normalizeCloudflareTempEmailDomain,
    normalizeCloudflareTempEmailDomains,
    normalizeCloudflareTempEmailMailApiMessages,
    normalizeCloudflareTempEmailMessage,
  };
});
