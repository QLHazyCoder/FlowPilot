// content/gopay-flow.js — GoPay authorization helper.

console.log('[MultiPage:gopay-flow] Content script loaded on', location.href);

const GOPAY_FLOW_LISTENER_SENTINEL = 'data-multipage-gopay-flow-listener';

if (document.documentElement.getAttribute(GOPAY_FLOW_LISTENER_SENTINEL) !== '1') {
  document.documentElement.setAttribute(GOPAY_FLOW_LISTENER_SENTINEL, '1');

  chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
    if (
      message.type === 'GOPAY_GET_STATE'
      || message.type === 'GOPAY_SUBMIT_PHONE'
      || message.type === 'GOPAY_SUBMIT_OTP'
      || message.type === 'GOPAY_SUBMIT_PIN'
      || message.type === 'GOPAY_CLICK_CONTINUE'
      || message.type === 'GOPAY_GET_CONTINUE_TARGET'
      || message.type === 'GOPAY_CLICK_PAY_NOW'
      || message.type === 'GOPAY_GET_PAY_NOW_TARGET'
    ) {
      resetStopState();
      handleGoPayCommand(message).then((result) => {
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
  console.log('[MultiPage:gopay-flow] 消息监听已存在，跳过重复注册');
}

async function performGoPayOperationWithDelay(metadata, operation) {
  const rootScope = typeof window !== 'undefined' ? window : globalThis;
  const gate = rootScope?.CodexOperationDelay?.performOperationWithDelay;
  return typeof gate === 'function' ? gate(metadata, operation) : operation();
}

async function handleGoPayCommand(message) {
  switch (message.type) {
    case 'GOPAY_GET_STATE':
      return inspectGoPayState();
    case 'GOPAY_SUBMIT_PHONE':
      return submitGoPayPhone(message.payload || {});
    case 'GOPAY_SUBMIT_OTP':
      return submitGoPayOtp(message.payload || {});
    case 'GOPAY_SUBMIT_PIN':
      return submitGoPayPin(message.payload || {});
    case 'GOPAY_CLICK_CONTINUE':
      return clickGoPayContinue();
    case 'GOPAY_GET_CONTINUE_TARGET':
      return getGoPayContinueTarget();
    case 'GOPAY_CLICK_PAY_NOW':
      return clickGoPayPayNow();
    case 'GOPAY_GET_PAY_NOW_TARGET':
      return getGoPayPayNowTarget();
    default:
      throw new Error(`gopay-flow.js 不处理消息：${message.type}`);
  }
}

async function waitUntil(predicate, options = {}) {
  const intervalMs = Math.max(50, Math.floor(Number(options.intervalMs) || 250));
  const timeoutMs = Math.max(0, Math.floor(Number(options.timeoutMs) || 0));
  const startedAt = Date.now();
  while (true) {
    throwIfStopped();
    const value = await predicate();
    if (value) {
      return value;
    }
    if (timeoutMs > 0 && Date.now() - startedAt >= timeoutMs) {
      throw new Error(options.timeoutMessage || `${options.label || 'GoPay 页面状态'}等待超时`);
    }
    await sleep(intervalMs);
  }
}

async function waitForDocumentComplete(options = {}) {
  const timeoutMs = Math.max(1000, Math.floor(Number(options.timeoutMs) || 8000));
  const settleMs = Math.max(0, Math.floor(Number(options.settleMs) || 500));
  try {
    await waitUntil(() => {
      const readyState = String(document.readyState || '').toLowerCase();
      return readyState === 'complete'
        || readyState === 'interactive'
        || Boolean(document.querySelector?.('button, input, textarea, a, [role="button"]'))
        || Boolean(normalizeText(document.body?.innerText || document.body?.textContent || ''));
    }, {
      intervalMs: 200,
      timeoutMs,
      label: 'GoPay DOM',
    });
  } catch (_) {
    // GoPay linking 页面有时长时间保持 loading；后续定位控件本身还有等待/重试。
  }
  await sleep(settleMs);
}

function isVisibleElement(el) {
  if (!el) return false;
  let node = el;
  while (node && node.nodeType === 1) {
    if (node.hidden || node.getAttribute?.('aria-hidden') === 'true' || node.getAttribute?.('inert') !== null) {
      return false;
    }
    const nodeStyle = window.getComputedStyle(node);
    if (
      nodeStyle.display === 'none'
      || nodeStyle.visibility === 'hidden'
      || nodeStyle.visibility === 'collapse'
      || Number(nodeStyle.opacity) === 0
    ) {
      return false;
    }
    node = node.parentElement;
  }
  const style = window.getComputedStyle(el);
  const rect = el.getBoundingClientRect();
  return style.display !== 'none'
    && style.visibility !== 'hidden'
    && Number(rect.width) > 0
    && Number(rect.height) > 0;
}

function normalizeText(text = '') {
  return String(text || '').replace(/\s+/g, ' ').trim();
}

function getActionText(el) {
  return normalizeText([
    el?.textContent,
    el?.value,
    el?.getAttribute?.('data-testid'),
    el?.getAttribute?.('aria-label'),
    el?.getAttribute?.('title'),
    el?.getAttribute?.('placeholder'),
    el?.getAttribute?.('name'),
    el?.id,
  ].filter(Boolean).join(' '));
}

function getVisibleControls(selector) {
  return Array.from(document.querySelectorAll(selector)).filter(isVisibleElement);
}

function isEnabledControl(el) {
  return Boolean(el)
    && !el.disabled
    && el.getAttribute?.('aria-disabled') !== 'true';
}

function getVisibleTextInputs() {
  return getVisibleControls('input, textarea')
    .filter((input) => {
      const type = String(input.getAttribute('type') || input.type || '').trim().toLowerCase();
      return isEnabledControl(input) && !['hidden', 'checkbox', 'radio', 'submit', 'button', 'file'].includes(type);
    });
}

function findInputByPatterns(patterns) {
  return getVisibleTextInputs().find((input) => {
    const text = getActionText(input);
    return patterns.some((pattern) => pattern.test(text));
  }) || null;
}

function findPhoneInput() {
  const input = findInputByPatterns([
    /gopay|go\s*pay|phone|mobile|whatsapp|wa|nomor|ponsel|telepon|hp/i,
    /手机|手机号|电话号码|电话/i,
  ]);
  if (input && !isCountrySearchInput(input)) {
    return input;
  }
  return getVisibleControls('input[type="tel"]').find((candidate) => isEnabledControl(candidate) && !isCountrySearchInput(candidate)) || null;
}

function isCountrySearchInput(input) {
  const text = getActionText(input);
  return /country|country\s*name|country\s*code|国家|地区|区号/i.test(text);
}

function getPageBodyText() {
  return normalizeText(document.body?.innerText || document.body?.textContent || '');
}

function isGoPayOtpPageText() {
  if (isGoPayPinPageText()) {
    return false;
  }
  if (getVisibleTextInputs().some((input) => isGoPayPinInput(input))) {
    return false;
  }
  const text = getPageBodyText();
  return /otp|one[-\s]*time|kode|verification|whatsapp|验证码|短信/i.test(text);
}

function isGoPayPinPageText() {
  const text = getPageBodyText();
  return /pin|password|passcode|security|sandi|6\s*digit|masukkin\s+pin|masukkan\s+pin|ketik\s+6\s+digit|enter\s+pin|支付密码/i.test(text)
    || /pin-web-client\.gopayapi\.com|\/auth\/pin|\/payment\/validate-pin|linking-validate-pin/i.test(location.href || '');
}

function isGoPayPinInput(input) {
  if (!input || isCountrySearchInput(input)) {
    return false;
  }
  const text = getCombinedElementText(input);
  const testId = String(input.getAttribute?.('data-testid') || '').trim();
  const type = String(input.getAttribute?.('type') || input.type || '').trim().toLowerCase();
  const maxLength = Number(input.getAttribute?.('maxlength') || input.maxLength || 0);
  const pinPage = isGoPayPinPageText();
  const strongPinHint = /password|passcode|security|sandi|支付密码|密码/i.test(text);
  const ambiguousPinWidget = /^pin-input/i.test(testId)
    || /pin-input(?:-field)?|(?:^|[\s_-])pin(?:$|[\s_-])/i.test(text);
  return strongPinHint
    || (pinPage && (ambiguousPinWidget || type === 'password' || maxLength === 1));
}

function detectGoPayTerminalError(text = getPageBodyText()) {
  const normalizedText = normalizeText(text);
  if (!normalizedText) return null;

  if (/waktunya\s+habis|ulang(?:i)?\s+prosesnya\s+dari\s+awal|time(?:'s|\s+is)?\s+(?:out|expired)|session\s+expired|expired|kedaluwarsa/i.test(normalizedText)) {
    return {
      code: 'expired',
      message: 'GoPay 支付会话已超时，需要重新创建 Plus Checkout。',
      rawText: normalizedText.slice(0, 240),
    };
  }

  if (/technical\s+error|don[’']t\s+worry|try\s+again|terjadi\s+kesalahan|error\s+teknis/i.test(normalizedText)) {
    return {
      code: 'technical-error',
      message: 'GoPay 页面显示技术错误，需要重新发起支付授权。',
      rawText: normalizedText.slice(0, 240),
    };
  }

  if (/payment\s+failed|pembayaran\s+gagal|transaksi\s+gagal|ditolak|declined|failed/i.test(normalizedText)) {
    return {
      code: 'failed',
      message: 'GoPay 页面显示支付失败，需要重新发起支付授权。',
      rawText: normalizedText.slice(0, 240),
    };
  }

  return null;
}

function findOtpInput() {
  if (isGoPayPinPageText()) {
    return null;
  }
  const input = findInputByPatterns([
    /otp|one[-\s]*time|verification|verify|code|kode|whatsapp|wa/i,
    /验证码|短信|代码/i,
  ]);
  if (input && !isCountrySearchInput(input) && !isGoPayPinInput(input)) {
    return input;
  }
  if (isGoPayOtpPageText()) {
    return getVisibleTextInputs().find((candidate) => !isCountrySearchInput(candidate) && !isGoPayPinInput(candidate)) || null;
  }
  return null;
}

function getGoPayPinInputs() {
  return getVisibleTextInputs().filter((candidate) => {
    return isGoPayPinInput(candidate);
  });
}

function findPinInput() {
  const pinInputs = getGoPayPinInputs();
  if (pinInputs[0]) {
    return pinInputs[0];
  }
  if (isGoPayOtpPageText()) {
    return null;
  }
  const input = findInputByPatterns([
    /pin|password|passcode|security|sandi|pin-input/i,
    /密码|支付密码/i,
  ]);
  if (input && !isCountrySearchInput(input)) {
    return input;
  }
  return getVisibleControls('input[type="password"]').find((candidate) => isEnabledControl(candidate) && !isCountrySearchInput(candidate))
    || null;
}

function findClickableByText(patterns) {
  const normalizedPatterns = (Array.isArray(patterns) ? patterns : [patterns]).filter(Boolean);
  const candidates = getVisibleControls('button, a, [role="button"], input[type="button"], input[type="submit"]');
  return candidates.find((el) => {
    if (!isEnabledControl(el)) return false;
    const text = getActionText(el);
    return normalizedPatterns.some((pattern) => pattern.test(text));
  }) || null;
}

function findPayNowButton() {
  return findClickableByText([
    /^\s*pay\s+now\s*$/i,
    /^\s*bayar(?:\s+sekarang)?(?:\s*rp[\s\S]*)?\s*$/i,
    /^\s*支付\s*$/i,
    /^\s*立即支付\s*$/i,
  ]);
}

function findContinueButton() {
  return findClickableByText([
    /continue|next|submit|verify|confirm|pay|authorize|allow|lanjut|lanjutkan|berikut|kirim|bayar|konfirmasi|hubungkan|sambungkan|tautkan|setuju|izinkan|link/i,
    /继续|下一步|提交|验证|确认|支付|授权|绑定|关联/i,
  ]);
}

function describeElement(el) {
  if (!el) return '';
  const rect = el.getBoundingClientRect?.();
  const parts = [String(el.tagName || '').toUpperCase()];
  if (el.id) parts.push(`#${el.id}`);
  const className = typeof el.className === 'string' ? el.className : el.getAttribute?.('class');
  if (className) parts.push(`.${String(className).trim().replace(/\s+/g, '.')}`);
  const text = getActionText(el) || normalizeText(el.innerText || el.textContent || '');
  if (text) parts.push(`"${text.slice(0, 60)}"`);
  if (rect) parts.push(`@${Math.round(rect.left)},${Math.round(rect.top)} ${Math.round(rect.width)}x${Math.round(rect.height)}`);
  return parts.filter(Boolean).join(' ');
}

function dispatchPointerMouseSequence(target) {
  const rect = target.getBoundingClientRect?.();
  const clientX = rect ? Math.round(rect.left + rect.width / 2) : 0;
  const clientY = rect ? Math.round(rect.top + rect.height / 2) : 0;
  const eventInit = {
    bubbles: true,
    cancelable: true,
    composed: true,
    view: window,
    detail: 1,
    button: 0,
    buttons: 1,
    clientX,
    clientY,
    screenX: window.screenX + clientX,
    screenY: window.screenY + clientY,
  };
  if (typeof PointerEvent === 'function') {
    target.dispatchEvent(new PointerEvent('pointerover', { ...eventInit, pointerId: 1, pointerType: 'mouse', isPrimary: true }));
    target.dispatchEvent(new PointerEvent('pointerenter', { ...eventInit, pointerId: 1, pointerType: 'mouse', isPrimary: true, bubbles: false }));
    target.dispatchEvent(new PointerEvent('pointermove', { ...eventInit, pointerId: 1, pointerType: 'mouse', isPrimary: true }));
    target.dispatchEvent(new PointerEvent('pointerdown', { ...eventInit, pointerId: 1, pointerType: 'mouse', isPrimary: true }));
  }
  target.dispatchEvent(new MouseEvent('mouseover', eventInit));
  target.dispatchEvent(new MouseEvent('mouseenter', { ...eventInit, bubbles: false }));
  target.dispatchEvent(new MouseEvent('mousemove', eventInit));
  target.dispatchEvent(new MouseEvent('mousedown', eventInit));
  if (typeof PointerEvent === 'function') {
    target.dispatchEvent(new PointerEvent('pointerup', { ...eventInit, pointerId: 1, pointerType: 'mouse', isPrimary: true, buttons: 0 }));
  }
  target.dispatchEvent(new MouseEvent('mouseup', { ...eventInit, buttons: 0 }));
  target.dispatchEvent(new MouseEvent('click', { ...eventInit, buttons: 0 }));
}

async function humanClickElement(el, options = {}) {
  if (!el) {
    throw new Error('GoPay 页面未找到可点击元素。');
  }
  el.scrollIntoView?.({ block: 'center', inline: 'center' });
  await sleep(Math.max(0, Number(options.beforeMs) || 120));
  try {
    el.focus?.({ preventScroll: true });
  } catch (_) {
    try { el.focus?.(); } catch (__) {}
  }
  dispatchPointerMouseSequence(el);
  await sleep(Math.max(0, Number(options.afterDispatchMs) || 120));
  if (typeof el.click === 'function') {
    el.click();
  }
  await sleep(Math.max(0, Number(options.afterMs) || 1000));
}

async function clickContinueIfPresent(options = {}) {
  const button = findContinueButton();
  if (!button) {
    return { clicked: false, target: '' };
  }
  await humanClickElement(button, options);
  return { clicked: true, target: describeElement(button) };
}

function normalizePhoneNumber(value = '') {
  return String(value || '').trim().replace(/[^\d+]/g, '');
}

function normalizeGoPayCountryCode(value = '') {
  const normalized = String(value || '').trim().replace(/[^\d+]/g, '');
  const digits = normalized.replace(/\D/g, '');
  return digits ? `+${digits}` : '+86';
}

function getCountryCodeDigits(value = '') {
  return normalizeGoPayCountryCode(value).replace(/\D/g, '');
}

function normalizeGoPayNationalPhone(value = '', countryCode = '+86') {
  const countryDigits = getCountryCodeDigits(countryCode);
  let digits = normalizePhoneNumber(value).replace(/\D/g, '');
  if (countryDigits && digits.startsWith(countryDigits)) {
    digits = digits.slice(countryDigits.length);
  }
  return digits;
}

function getCombinedElementText(el) {
  return normalizeText([
    getActionText(el),
    el?.innerText,
    el?.textContent,
    typeof el?.className === 'string' ? el.className : el?.getAttribute?.('class'),
  ].filter(Boolean).join(' '));
}

function robustClick(el) {
  if (!el) return;
  el.scrollIntoView?.({ block: 'center', inline: 'center' });
  try {
    el.focus?.();
  } catch (_) {}
  const eventInit = { bubbles: true, cancelable: true, view: window };
  if (typeof PointerEvent === 'function') {
    el.dispatchEvent(new PointerEvent('pointerdown', { ...eventInit, pointerId: 1, pointerType: 'mouse', isPrimary: true }));
  }
  el.dispatchEvent(new MouseEvent('mousedown', eventInit));
  if (typeof PointerEvent === 'function') {
    el.dispatchEvent(new PointerEvent('pointerup', { ...eventInit, pointerId: 1, pointerType: 'mouse', isPrimary: true }));
  }
  el.dispatchEvent(new MouseEvent('mouseup', eventInit));
  el.dispatchEvent(new MouseEvent('click', eventInit));
  if (typeof el.click === 'function') {
    el.click();
  }
}

function readSelectedCountryCodeText() {
  const candidates = getVisibleControls('.phone-code, .phone-code-wrapper, [class*="phone-code"], button, [role="button"], [tabindex]');
  for (const candidate of candidates) {
    const match = getCombinedElementText(candidate).match(/\+\d{1,4}/);
    if (match) return normalizeGoPayCountryCode(match[0]);
  }
  const bodyMatch = normalizeText(document.body?.innerText || document.body?.textContent || '').match(/Phone number:\s*(\+\d{1,4})/i);
  return bodyMatch ? normalizeGoPayCountryCode(bodyMatch[1]) : '';
}

function findCountryCodeToggle() {
  const preferred = getVisibleControls('.phone-code-wrapper, [class*="phone-code-wrapper"], .phone-code, [class*="phone-code"]')
    .find((el) => /\+\d{1,4}/.test(getCombinedElementText(el)));
  if (preferred) return preferred;
  return getVisibleControls('button, [role="button"], [tabindex], div, span')
    .find((el) => /\+\d{1,4}/.test(getCombinedElementText(el)) && /phone|code|country|\+\d{1,4}/i.test(getCombinedElementText(el))) || null;
}

function findCountryCodeOption(countryCode = '+86') {
  const normalized = normalizeGoPayCountryCode(countryCode);
  const digits = getCountryCodeDigits(normalized);
  const countryAliases = {
    '1': [/United States|USA|Canada|美国|加拿大/i],
    '60': [/Malaysia|马来西亚/i],
    '62': [/Indonesia|印尼|印度尼西亚/i],
    '63': [/Philippines|菲律宾/i],
    '65': [/Singapore|新加坡/i],
    '66': [/Thailand|泰国/i],
    '84': [/Vietnam|越南/i],
    '86': [/China|中国|Mainland/i],
    '91': [/India|印度/i],
    '852': [/Hong Kong|香港/i],
    '853': [/Macau|Macao|澳门/i],
    '886': [/Taiwan|台湾/i],
  }[digits] || [];
  const controls = getVisibleControls('li.country-item, .country-item, [class*="country-item"], [role="option"], li, button, [role="button"], a, [tabindex], div, span')
    .map((el) => el.closest?.('.country-item') || el)
    .filter((el, index, list) => el && list.indexOf(el) === index)
    .filter((el) => {
      const rect = el.getBoundingClientRect();
      const text = getCombinedElementText(el);
      const className = typeof el.className === 'string' ? el.className : el.getAttribute?.('class') || '';
      return text.includes(normalized)
        && rect.width > 20
        && rect.height > 8
        && rect.width < Math.max(480, window.innerWidth * 0.8)
        && rect.height < Math.max(120, window.innerHeight * 0.35)
        && !/phone-number-input-wrapper|gopay-tokenization-content|asphalt-theme|search-country|country-list/i.test(className);
    });
  const matchesAlias = (el) => {
    const text = getCombinedElementText(el);
    return countryAliases.some((pattern) => pattern.test(text));
  };
  return controls.find((el) => /country-item/i.test(typeof el.className === 'string' ? el.className : el.getAttribute?.('class') || '') && matchesAlias(el))
    || controls.find((el) => String(el.tagName || '').toUpperCase() === 'LI' && matchesAlias(el))
    || controls.find((el) => el.getAttribute?.('role') === 'option' && matchesAlias(el))
    || controls.find(matchesAlias)
    || null;
}

async function ensureGoPayCountryCode(countryCode = '+86') {
  const normalized = normalizeGoPayCountryCode(countryCode);
  const selected = readSelectedCountryCodeText();
  if (selected === normalized) {
    return { changed: false, countryCode: normalized, selected };
  }

  const toggle = findCountryCodeToggle();
  if (!toggle) {
    throw new Error(`GoPay 页面未找到国家区号切换控件，当前识别区号：${selected || '未知'}，目标区号：${normalized}`);
  }
  robustClick(toggle);
  await sleep(500);

  const countryDropdown = document.querySelector('.search-country');
  if (countryDropdown && window.getComputedStyle(countryDropdown).display === 'none') {
    countryDropdown.style.display = 'block';
    await sleep(100);
  }

  const countrySearchInput = getVisibleTextInputs().find(isCountrySearchInput);
  if (countrySearchInput) {
    fillInput(countrySearchInput, normalized);
    await sleep(300);
  }

  const option = await waitUntil(() => findCountryCodeOption(normalized), {
    label: `GoPay 国家区号 ${normalized}`,
    intervalMs: 250,
    timeoutMs: 8000,
  });
  robustClick(option);
  await sleep(500);

  const nextSelected = readSelectedCountryCodeText();
  if (nextSelected === normalized && countryDropdown) {
    countryDropdown.style.display = 'none';
  }
  if (nextSelected !== normalized) {
    throw new Error(`GoPay 国家区号切换失败：目标 ${normalized}，当前 ${nextSelected || '未知'}`);
  }
  return {
    changed: true,
    countryCode: normalized,
    selected: nextSelected,
  };
}

function normalizeOtp(value = '') {
  return String(value || '').trim().replace(/[^\d]/g, '');
}


function fillDigitInputs(inputs = [], code = '') {
  const normalizedCode = normalizeOtp(code);
  if (!normalizedCode || !inputs.length) return false;
  normalizedCode.split('').forEach((digit, index) => {
    const input = inputs[index];
    if (!input) return;
    try {
      input.focus?.();
    } catch (_) {}
    input.dispatchEvent(new KeyboardEvent('keydown', { key: digit, code: `Digit${digit}`, bubbles: true, cancelable: true }));
    fillInput(input, digit);
    input.dispatchEvent(new KeyboardEvent('keyup', { key: digit, code: `Digit${digit}`, bubbles: true, cancelable: true }));
  });
  return true;
}

function fillVisiblePinInputs(pin = '') {
  const normalizedPin = normalizeOtp(pin);
  if (!normalizedPin) return false;
  const pinInputs = getGoPayPinInputs();
  const digitInputs = pinInputs.filter((input) => {
    const maxLength = Number(input.getAttribute?.('maxlength') || input.maxLength || 0);
    return maxLength > 0 && maxLength <= 1;
  });
  if (digitInputs.length >= Math.min(4, normalizedPin.length)) {
    return fillDigitInputs(digitInputs, normalizedPin);
  }
  const input = findPinInput() || pinInputs[0];
  if (!input) return false;
  fillInput(input, normalizedPin);
  return true;
}

function fillVisibleOtpInputs(code = '') {
  const normalizedCode = normalizeOtp(code);
  if (!normalizedCode) return false;
  if (isGoPayPinPageText() || getVisibleTextInputs().some((input) => isGoPayPinInput(input))) {
    return false;
  }

  const otpInputs = getVisibleTextInputs()
    .filter((input) => {
      if (isGoPayPinInput(input)) return false;
      const text = getActionText(input);
      const maxLength = Number(input.getAttribute?.('maxlength') || input.maxLength || 0);
      return /otp|code|kode|verification|验证码|短信/i.test(text)
        || (maxLength > 0 && maxLength <= 1)
        || (maxLength > 1 && maxLength <= 8);
    });

  const digitInputs = otpInputs.filter((input) => {
    const maxLength = Number(input.getAttribute?.('maxlength') || input.maxLength || 0);
    return maxLength > 0 && maxLength <= 1;
  });
  if (digitInputs.length >= Math.min(4, normalizedCode.length)) {
    return fillDigitInputs(digitInputs, normalizedCode);
  }

  const input = findOtpInput() || otpInputs[0];
  if (!input) return false;
  fillInput(input, normalizedCode);
  return true;
}

async function submitGoPayPhone(payload = {}) {
  const delayOperation = typeof performGoPayOperationWithDelay === 'function'
    ? performGoPayOperationWithDelay
    : async (metadata, operation) => {
        const rootScope = typeof window !== 'undefined' ? window : globalThis;
        const gate = rootScope?.CodexOperationDelay?.performOperationWithDelay;
        return typeof gate === 'function' ? gate(metadata, operation) : operation();
      };
  await waitForDocumentComplete();
  const countryCode = normalizeGoPayCountryCode(payload.countryCode || payload.gopayCountryCode || '+86');
  const phone = normalizeGoPayNationalPhone(payload.phone || payload.gopayPhone || '', countryCode);
  if (!phone) {
    throw new Error('GoPay 手机号为空，请先在侧边栏配置。');
  }
  const input = await waitUntil(() => findPhoneInput(), {
    label: 'GoPay 手机号输入框',
    intervalMs: 250,
    timeoutMs: 15000,
  });
  const { countryResult, clickResult } = await delayOperation({ stepKey: 'gopay-approve', kind: 'submit', label: 'submit-phone' }, async () => {
    const nextCountryResult = await ensureGoPayCountryCode(countryCode);
    fillInput(input, phone);
    const nextClickResult = await clickContinueIfPresent();
    return {
      countryResult: nextCountryResult,
      clickResult: nextClickResult,
    };
  });
  return {
    phoneSubmitted: true,
    countryCode,
    countryChanged: Boolean(countryResult.changed),
    clicked: Boolean(clickResult.clicked),
    clickTarget: clickResult.target || '',
    phase: 'phone_submitted',
  };
}

async function submitGoPayOtp(payload = {}) {
  const delayOperation = typeof performGoPayOperationWithDelay === 'function'
    ? performGoPayOperationWithDelay
    : async (metadata, operation) => {
        const rootScope = typeof window !== 'undefined' ? window : globalThis;
        const gate = rootScope?.CodexOperationDelay?.performOperationWithDelay;
        return typeof gate === 'function' ? gate(metadata, operation) : operation();
      };
  await waitForDocumentComplete();
  const code = normalizeOtp(payload.code || payload.otp || '');
  if (!code) {
    throw new Error('GoPay WhatsApp 验证码为空。');
  }
  const { filled, clickResult } = await delayOperation({ stepKey: 'gopay-approve', kind: 'submit', label: 'submit-otp' }, async () => {
    const filledOtp = await waitUntil(() => fillVisibleOtpInputs(code), {
      label: 'GoPay 验证码输入框',
      intervalMs: 250,
      timeoutMs: 15000,
    });
    const continueResult = await clickContinueIfPresent();
    return { filled: filledOtp, clickResult: continueResult };
  });
  return {
    otpSubmitted: Boolean(filled),
    clicked: Boolean(clickResult.clicked),
    clickTarget: clickResult.target || '',
    phase: 'otp_submitted',
  };
}

async function submitGoPayPin(payload = {}) {
  const delayOperation = typeof performGoPayOperationWithDelay === 'function'
    ? performGoPayOperationWithDelay
    : async (metadata, operation) => {
        const rootScope = typeof window !== 'undefined' ? window : globalThis;
        const gate = rootScope?.CodexOperationDelay?.performOperationWithDelay;
        return typeof gate === 'function' ? gate(metadata, operation) : operation();
      };
  await waitForDocumentComplete();
  const pin = normalizeOtp(payload.pin || payload.gopayPin || '');
  if (!pin) {
    throw new Error('GoPay PIN 为空，请先在侧边栏配置。');
  }
  const { filled, clickResult } = await delayOperation({ stepKey: 'gopay-approve', kind: 'submit', label: 'submit-pin' }, async () => {
    const filledPin = await waitUntil(() => fillVisiblePinInputs(pin), {
      label: 'GoPay PIN 输入框',
      intervalMs: 250,
      timeoutMs: 15000,
    });
    const continueResult = await clickContinueIfPresent();
    return { filled: filledPin, clickResult: continueResult };
  });
  return {
    pinSubmitted: Boolean(filled),
    clicked: Boolean(clickResult.clicked),
    clickTarget: clickResult.target || '',
    phase: 'pin_submitted',
  };
}


function getElementClickRect(el) {
  if (!el) return null;
  const rect = el.getBoundingClientRect?.();
  if (!rect || !Number.isFinite(rect.left) || !Number.isFinite(rect.top)) {
    return null;
  }
  return {
    left: rect.left,
    top: rect.top,
    width: rect.width,
    height: rect.height,
    centerX: rect.left + rect.width / 2,
    centerY: rect.top + rect.height / 2,
  };
}

function getGoPayContinueTarget() {
  const button = findContinueButton();
  return {
    found: Boolean(button),
    target: describeElement(button),
    rect: getElementClickRect(button),
  };
}

function getGoPayPayNowTarget() {
  const button = findPayNowButton();
  return {
    found: Boolean(button),
    target: describeElement(button),
    rect: getElementClickRect(button),
  };
}

async function clickGoPayContinue() {
  const delayOperation = typeof performGoPayOperationWithDelay === 'function'
    ? performGoPayOperationWithDelay
    : async (metadata, operation) => {
        const rootScope = typeof window !== 'undefined' ? window : globalThis;
        const gate = rootScope?.CodexOperationDelay?.performOperationWithDelay;
        return typeof gate === 'function' ? gate(metadata, operation) : operation();
      };
  await waitForDocumentComplete();
  const button = findContinueButton();
  if (!button) {
    return { clicked: false, clickTarget: '' };
  }
  const clickResult = await delayOperation({ stepKey: 'gopay-approve', kind: 'click', label: 'click-continue' }, async () => {
    await humanClickElement(button, { afterMs: 1200 });
    return { clicked: true, target: describeElement(button) };
  });
  return { clicked: Boolean(clickResult.clicked), clickTarget: clickResult.target || '' };
}

async function clickGoPayPayNow() {
  const delayOperation = typeof performGoPayOperationWithDelay === 'function'
    ? performGoPayOperationWithDelay
    : async (metadata, operation) => {
        const rootScope = typeof window !== 'undefined' ? window : globalThis;
        const gate = rootScope?.CodexOperationDelay?.performOperationWithDelay;
        return typeof gate === 'function' ? gate(metadata, operation) : operation();
      };
  await waitForDocumentComplete();
  const button = findPayNowButton();
  if (!button) {
    return { clicked: false, clickTarget: '' };
  }
  await delayOperation({ stepKey: 'gopay-approve', kind: 'click', label: 'click-pay-now' }, async () => {
    await humanClickElement(button, { afterMs: 1500 });
  });
  return { clicked: true, clickTarget: describeElement(button) };
}

function inspectGoPayState() {
  const bodyText = normalizeText(document.body?.innerText || document.body?.textContent || '');
  const phoneInput = findPhoneInput();
  const otpInput = findOtpInput();
  const pinInput = findPinInput();
  const payNowButton = findPayNowButton();
  const continueButton = findContinueButton();
  const terminalError = detectGoPayTerminalError(bodyText);
  const successTextMatched = /success|successful|completed|selesai|berhasil|approved|authorized|支付成功|绑定成功|已授权/i.test(bodyText);
  const completed = !phoneInput && !otpInput && !pinInput && successTextMatched;
  const selectedCountryCode = readSelectedCountryCodeText();
  return {
    url: location.href,
    readyState: document.readyState,
    selectedCountryCode,
    hasPhoneInput: Boolean(phoneInput),
    hasOtpInput: Boolean(otpInput),
    hasPinInput: Boolean(pinInput),
    hasPayNowButton: Boolean(payNowButton),
    hasContinueButton: Boolean(continueButton),
    hasTerminalError: Boolean(terminalError),
    terminalError,
    completed,
    textPreview: bodyText.slice(0, 500),
    inputHints: getVisibleTextInputs().map((input) => getActionText(input).slice(0, 120)).filter(Boolean).slice(0, 12),
  };
}
