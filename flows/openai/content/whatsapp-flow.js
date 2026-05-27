// flows/openai/content/whatsapp-flow.js — WhatsApp Web code reader for GoPay.

console.log('[MultiPage:whatsapp-flow] Content script loaded on', location.href);

const WHATSAPP_FLOW_LISTENER_SENTINEL = 'data-multipage-whatsapp-flow-listener';

if (document.documentElement.getAttribute(WHATSAPP_FLOW_LISTENER_SENTINEL) !== '1') {
  document.documentElement.setAttribute(WHATSAPP_FLOW_LISTENER_SENTINEL, '1');

  chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
    if (
      message.type === 'WHATSAPP_GET_STATE'
      || message.type === 'WHATSAPP_FIND_CODE'
    ) {
      resetStopState();
      handleWhatsAppCommand(message).then((result) => {
        sendResponse({ ok: true, ...(result || {}) });
      }).catch((err) => {
        if (isStopError(err)) {
          sendResponse({ stopped: true, error: err.message });
          return;
        }
        sendResponse({ error: err.message });
      });
      return true;
    }
  });
} else {
  console.log('[MultiPage:whatsapp-flow] message listener already exists, skipping duplicate registration');
}

async function handleWhatsAppCommand(message) {
  switch (message.type) {
    case 'WHATSAPP_GET_STATE':
      return inspectWhatsAppState();
    case 'WHATSAPP_FIND_CODE':
      return findWhatsAppCode(message.payload || {});
    default:
      throw new Error(`whatsapp-flow.js does not handle message: ${message.type}`);
  }
}

function normalizeText(text = '') {
  return String(text || '').replace(/\s+/g, ' ').trim();
}

function getBodyText() {
  return normalizeText(document.body?.innerText || document.body?.textContent || '');
}

function extractVerificationCode(text = '') {
  const normalized = normalizeText(text);
  const preferredPatterns = [
    /(?:gopay|gojek|openai|chatgpt|kode|code|otp|verification|verifikasi|whatsapp|验证码|驗證碼|代码|代碼)[^\d]{0,40}(\d{4,8})/i,
    /(\d{4,8})[^\d]{0,40}(?:gopay|gojek|openai|chatgpt|kode|code|otp|verification|verifikasi|验证码|驗證碼|代码|代碼)/i,
  ];
  for (const pattern of preferredPatterns) {
    const match = normalized.match(pattern);
    if (match?.[1]) {
      return match[1];
    }
  }
  const genericMatch = normalized.match(/(?<!\d)(\d{4,8})(?!\d)/);
  return genericMatch?.[1] || '';
}

function getMessageCandidates() {
  const selectors = [
    '[data-testid*="msg" i]',
    '[data-pre-plain-text]',
    '.message-in',
    '[role="row"]',
    'div',
    'span',
  ];
  const seen = new Set();
  const messages = [];
  for (const selector of selectors) {
    for (const el of Array.from(document.querySelectorAll(selector))) {
      const text = normalizeText(el.innerText || el.textContent || '');
      if (!text || text.length < 4 || seen.has(text)) continue;
      seen.add(text);
      messages.push(text);
    }
  }
  return messages.slice(-80);
}

async function waitUntil(predicate, options = {}) {
  const intervalMs = Math.max(50, Math.floor(Number(options.intervalMs) || 1000));
  const timeoutMs = Math.max(0, Math.floor(Number(options.timeoutMs) || 0));
  const startedAt = Date.now();
  while (true) {
    throwIfStopped();
    const value = await predicate();
    if (value) {
      return value;
    }
    if (timeoutMs > 0 && Date.now() - startedAt >= timeoutMs) {
      return null;
    }
    await sleep(intervalMs);
  }
}

async function findWhatsAppCode(payload = {}) {
  const timeoutMs = Math.max(0, Math.floor(Number(payload.timeoutMs) || 0));
  const result = await waitUntil(() => {
    const messages = getMessageCandidates();
    for (let index = messages.length - 1; index >= 0; index -= 1) {
      const text = messages[index];
      const code = extractVerificationCode(text);
      if (code) {
        return {
          code,
          messageText: text.slice(0, 500),
        };
      }
    }
    const code = extractVerificationCode(getBodyText());
    return code ? { code, messageText: getBodyText().slice(0, 500) } : null;
  }, {
    intervalMs: 1000,
    timeoutMs,
  });

  return result || {
    code: '',
    messageText: '',
  };
}

function inspectWhatsAppState() {
  const bodyText = getBodyText();
  const code = extractVerificationCode(bodyText);
  return {
    url: location.href,
    readyState: document.readyState,
    loggedIn: !/use whatsapp on your computer|link a device|scan|qr|使用 WhatsApp|扫码|掃碼/i.test(bodyText),
    code,
    textPreview: bodyText.slice(0, 500),
    messagePreview: getMessageCandidates().slice(-8),
  };
}
