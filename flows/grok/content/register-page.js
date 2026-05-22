(function patchGrokTurnstileMouseEvent() {
  if (window.__MULTIPAGE_GROK_TURNSTILE_MOUSE_PATCHED__) return;
  window.__MULTIPAGE_GROK_TURNSTILE_MOUSE_PATCHED__ = true;
  function getRandomInt(min, max) {
    return Math.floor(Math.random() * (max - min + 1)) + min;
  }
  const screenX = getRandomInt(800, 1200);
  const screenY = getRandomInt(400, 600);
  try {
    Object.defineProperty(MouseEvent.prototype, 'screenX', { value: screenX, configurable: true });
    Object.defineProperty(MouseEvent.prototype, 'screenY', { value: screenY, configurable: true });
  } catch (error) {
    console.warn('[MultiPage:grok-register-page] Unable to apply Turnstile MouseEvent patch', error);
  }
})();

console.log('[MultiPage:grok-register-page] Content script loaded on', location.href);

const GROK_REGISTER_PAGE_LISTENER_SENTINEL = 'data-multipage-grok-register-page-listener';
const GROK_SIGNUP_URL = 'https://accounts.x.ai/sign-up?redirect=grok-com';
const GROK_EMAIL_SIGNUP_TEXT_PATTERN = /使用邮箱注册|sign\s*up\s*with\s*email|continue\s*with\s*email|email/i;
const GROK_CONTINUE_TEXT_PATTERN = /continue|next|sign\s*up|submit|verify|继续|下一步|注册|提交|验证/i;
const GROK_PROFILE_TEXT_PATTERN = /given\s*name|family\s*name|first\s*name|last\s*name|password|名字|姓氏|密码/i;

const GROK_PROFILE_SUBMIT_PRE_CLICK_DELAY_MS = 2000;

function sleep(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

function isVisible(element) {
  if (!element || !(element instanceof Element)) return false;
  const style = window.getComputedStyle(element);
  if (style.display === 'none' || style.visibility === 'hidden' || Number(style.opacity) === 0) return false;
  const rect = element.getBoundingClientRect();
  return rect.width > 0 && rect.height > 0;
}

function getElementText(element) {
  if (!element) return '';
  return String(element.innerText || element.textContent || element.getAttribute('aria-label') || element.getAttribute('title') || '').trim();
}

function queryVisible(selector) {
  return Array.from(document.querySelectorAll(selector)).find(isVisible) || null;
}

function findClickableByText(pattern) {
  const selectors = 'button, a, [role="button"], input[type="button"], input[type="submit"]';
  return Array.from(document.querySelectorAll(selectors)).find((element) => {
    if (!isVisible(element)) return false;
    const text = element instanceof HTMLInputElement ? element.value : getElementText(element);
    return pattern.test(text);
  }) || null;
}

function simulateClick(element) {
  if (!element) return;
  element.dispatchEvent(new MouseEvent('mouseover', { bubbles: true, cancelable: true, view: window }));
  element.dispatchEvent(new MouseEvent('mousedown', { bubbles: true, cancelable: true, view: window }));
  element.dispatchEvent(new MouseEvent('mouseup', { bubbles: true, cancelable: true, view: window }));
  element.click();
}

function fillInput(input, value) {
  input.focus();
  const nativeSetter = Object.getOwnPropertyDescriptor(Object.getPrototypeOf(input), 'value')?.set;
  if (nativeSetter) {
    nativeSetter.call(input, value);
  } else {
    input.value = value;
  }
  input.dispatchEvent(new Event('input', { bubbles: true }));
  input.dispatchEvent(new Event('change', { bubbles: true }));
}

async function waitFor(predicate, options = {}) {
  const timeoutMs = options.timeoutMs || 30000;
  const intervalMs = options.intervalMs || 250;
  const deadline = Date.now() + timeoutMs;
  let lastValue = null;
  while (Date.now() <= deadline) {
    lastValue = predicate();
    if (lastValue) return lastValue;
    await sleep(intervalMs);
  }
  return lastValue;
}

function findEmailInput() {
  return queryVisible([
    'input[type="email"]',
    'input[name="email" i]',
    'input[autocomplete="email"]',
    'input[placeholder*="email" i]',
    'input[inputmode="email"]',
  ].join(', '));
}

function findOtpInputs() {
  const inputs = Array.from(document.querySelectorAll([
    'input[autocomplete="one-time-code"]',
    'input[inputmode="numeric"]',
    'input[name*="otp" i]',
    'input[name*="code" i]',
    'input[aria-label*="code" i]',
    'input[placeholder*="code" i]',
  ].join(', '))).filter(isVisible);
  if (inputs.length) return inputs;
  const oneCharInputs = Array.from(document.querySelectorAll('input:not([type="hidden"]):not([type="checkbox"]):not([type="radio"]):not([type="submit"])'))
    .filter((input) => isVisible(input) && Number(input.maxLength || 0) === 1);
  return oneCharInputs.length >= 4 ? oneCharInputs : [];
}

function findProfileInput(names) {
  const selectors = names.flatMap((name) => [
    `input[name="${name}" i]`,
    `input[id="${name}" i]`,
    `input[autocomplete="${name}" i]`,
    `input[placeholder*="${name}" i]`,
    `input[aria-label*="${name}" i]`,
  ]).join(', ');
  return queryVisible(selectors);
}

function findPasswordInputs() {
  return Array.from(document.querySelectorAll([
    'input[type="password"]',
    'input[name*="password" i]',
    'input[autocomplete="new-password"]',
    'input[placeholder*="password" i]',
    'input[aria-label*="password" i]',
  ].join(', '))).filter(isVisible);
}

function findSubmitButton(contextPattern = GROK_CONTINUE_TEXT_PATTERN) {
  return findClickableByText(contextPattern)
    || Array.from(document.querySelectorAll('button:not([disabled]), [role="button"]')).filter(isVisible).at(-1)
    || null;
}

function getPageState() {
  const pageText = document.body?.innerText || '';
  if (/grok|xai|x\.ai/i.test(location.hostname) && /sso=/.test(document.cookie || '')) return 'signed_in';
  if (findProfileInput(['givenName', 'firstName']) || findPasswordInputs().length || GROK_PROFILE_TEXT_PATTERN.test(pageText)) return 'profile_entry';
  if (findOtpInputs().length) return 'verification_code_entry';
  if (findEmailInput()) return 'email_entry';
  return 'unknown';
}

async function openGrokSignupPage() {
  if (!/accounts\.x\.ai$/i.test(location.hostname) || !/\/sign-up/i.test(location.pathname)) {
    location.href = GROK_SIGNUP_URL;
    return { submitted: true, state: 'navigating', url: location.href };
  }
  const emailButton = await waitFor(() => findClickableByText(GROK_EMAIL_SIGNUP_TEXT_PATTERN) || findEmailInput(), { timeoutMs: 30000 });
  if (!emailButton) throw new Error('未找到 x.ai 邮箱注册入口。');
  if (!(emailButton instanceof HTMLInputElement)) {
    simulateClick(emailButton);
    await sleep(500);
  }
  return { submitted: true, state: getPageState(), url: location.href };
}

function getPageErrorText() {
  const text = String(document.body?.innerText || '').trim();
  const patterns = [
    /Your email domain[^\n]+has been rejected[^\n]*/i,
    /Please use a different email address[^\n]*/i,
    /邮箱域名[^\n]*(?:被拒绝|不可用|不支持)[^\n]*/i,
    /请使用其他邮箱[^\n]*/i,
  ];
  for (const pattern of patterns) {
    const match = text.match(pattern);
    if (match?.[0]) return match[0].trim();
  }
  return '';
}

async function submitGrokEmail(payload = {}) {
  const email = String(payload.email || '').trim();
  if (!email) throw new Error('缺少 Grok 注册邮箱。');
  const input = await waitFor(findEmailInput, { timeoutMs: 45000 });
  if (!input) throw new Error('未找到 x.ai 邮箱输入框。');
  fillInput(input, email);
  await sleep(200);
  const button = findSubmitButton();
  if (!button) throw new Error('未找到 x.ai 邮箱提交按钮。');
  simulateClick(button);
  await sleep(1200);
  const errorText = getPageErrorText();
  if (errorText) {
    throw new Error(errorText);
  }
  return { submitted: true, state: getPageState(), url: location.href };
}

function getGrokVerificationErrorText() {
  const text = String(document.body?.innerText || '').trim();
  const patterns = [
    /(?:verification|confirmation)?\s*code\s*(?:is\s*)?(?:invalid|incorrect|expired)[^\n]*/i,
    /invalid\s*(?:verification|confirmation)?\s*code[^\n]*/i,
    /验证码[^\n]*(?:错误|无效|过期)[^\n]*/i,
    /代码[^\n]*(?:错误|无效|过期)[^\n]*/i,
  ];
  for (const pattern of patterns) {
    const match = text.match(pattern);
    if (match?.[0]) return match[0].trim();
  }
  return '';
}

async function submitGrokVerificationCode(payload = {}) {
  const normalizedCode = String(payload.code || '').replace(/[^A-Za-z0-9]/g, '').trim();
  if (!normalizedCode) throw new Error('缺少 xAI 验证码。');
  const inputs = await waitFor(() => findOtpInputs(), { timeoutMs: 45000 });
  if (!inputs?.length) throw new Error('未找到 xAI 验证码输入框。');
  if (inputs.length === 1) {
    fillInput(inputs[0], normalizedCode);
  } else {
    normalizedCode.split('').forEach((char, index) => {
      if (inputs[index]) fillInput(inputs[index], char);
    });
  }
  await sleep(200);
  const button = findSubmitButton();
  if (button) simulateClick(button);
  const settledState = await waitFor(() => {
    const errorText = getGrokVerificationErrorText();
    if (errorText) return { state: 'verification_error', error: errorText };
    const state = getPageState();
    return state && state !== 'verification_code_entry' ? { state } : null;
  }, { timeoutMs: 20000, intervalMs: 500 });
  const finalState = settledState?.state || getPageState();
  if (settledState?.error) {
    throw new Error(settledState.error);
  }
  if (finalState === 'email_entry') {
    throw new Error('x.ai 验证码提交后回到邮箱注册页，可能是验证码无效、会话过期或注册风控重置。');
  }
  if (!['profile_entry', 'signed_in'].includes(finalState)) {
    throw new Error(`x.ai 验证码提交后进入未知页面状态：${finalState || 'unknown'}。`);
  }
  return { submitted: true, state: finalState, url: location.href };
}

async function submitGrokProfile(payload = {}) {
  const firstName = String(payload.firstName || '').trim();
  const lastName = String(payload.lastName || '').trim();
  const password = String(payload.password || '');
  if (!firstName || !lastName || !password) throw new Error('缺少 Grok 注册资料。');
  const ready = await waitFor(() => {
    const firstInput = findProfileInput(['givenName', 'firstName', 'given-name']);
    const lastInput = findProfileInput(['familyName', 'lastName', 'family-name']);
    const passwordInputs = findPasswordInputs();
    return firstInput && lastInput && passwordInputs.length ? { firstInput, lastInput, passwordInputs } : null;
  }, { timeoutMs: 45000 });
  if (!ready) throw new Error('未找到 x.ai 资料或密码表单。');
  fillInput(ready.firstInput, firstName);
  fillInput(ready.lastInput, lastName);
  ready.passwordInputs.forEach((input) => fillInput(input, password));
  await sleep(GROK_PROFILE_SUBMIT_PRE_CLICK_DELAY_MS);
  const button = findSubmitButton();
  if (!button) throw new Error('未找到 x.ai 资料提交按钮。');
  simulateClick(button);
  return { submitted: true, state: 'profile_submitted', url: location.href };
}

async function extractGrokSsoCookie() {
  const match = String(document.cookie || '').match(/(?:^|;\s*)sso=([^;]+)/);
  return {
    submitted: true,
    state: match ? 'sso_cookie_found' : getPageState(),
    ssoCookie: match ? decodeURIComponent(match[1]) : '',
    url: location.href,
  };
}

async function executeGrokCommand(command, payload = {}) {
  switch (command) {
    case 'grok-open-signup-page':
      return openGrokSignupPage(payload);
    case 'grok-submit-email':
      return submitGrokEmail(payload);
    case 'grok-submit-verification-code':
      return submitGrokVerificationCode(payload);
    case 'grok-submit-profile':
      return submitGrokProfile(payload);
    case 'grok-extract-sso-cookie':
      return extractGrokSsoCookie(payload);
    case 'GET_PAGE_STATE':
      return { state: getPageState(), url: location.href };
    default:
      throw new Error(`未知 Grok 注册命令：${command}`);
  }
}

if (!document.documentElement.hasAttribute(GROK_REGISTER_PAGE_LISTENER_SENTINEL)) {
  document.documentElement.setAttribute(GROK_REGISTER_PAGE_LISTENER_SENTINEL, '1');
  chrome.runtime.onMessage.addListener((message, _sender, sendResponse) => {
    if (message?.type !== 'EXECUTE_NODE' && message?.type !== 'GET_PAGE_STATE') return false;
    const command = message.command || message.nodeId || message.type;
    executeGrokCommand(command, message.payload || {})
      .then((result) => sendResponse({ ok: true, ...result }))
      .catch((error) => sendResponse({ ok: false, error: error?.message || String(error) }));
    return true;
  });
}

window.__MULTIPAGE_GROK_REGISTER_PAGE__ = {
  getPageState,
  executeGrokCommand,
};
