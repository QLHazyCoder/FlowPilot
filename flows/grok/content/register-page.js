console.log('[MultiPage:grok-register-page] Content script loaded on', location.href);

const GROK_REGISTER_PAGE_LISTENER_SENTINEL = 'data-multipage-grok-register-page-listener';
const GROK_SIGNUP_URL = 'https://accounts.x.ai/sign-up?redirect=grok-com';
const GROK_EMAIL_SIGNUP_TEXT_PATTERN = /使用邮箱注册|sign\s*up\s*with\s*email|continue\s*with\s*email|email/i;
const GROK_CONTINUE_TEXT_PATTERN = /continue|next|sign\s*up|submit|verify|继续|下一步|注册|提交|验证/i;
const GROK_PROFILE_TEXT_PATTERN = /given\s*name|family\s*name|first\s*name|last\s*name|password|名字|姓氏|密码/i;
const GROK_EMAIL_VERIFICATION_READY_TIMEOUT_MS = 90 * 1000;
const GROK_PROFILE_SUBMIT_PRE_CLICK_DELAY_MS = 2000;

function isVisibleGrokElement(element) {
  if (!element || !(element instanceof Element)) return false;
  const style = window.getComputedStyle(element);
  if (style.display === 'none' || style.visibility === 'hidden' || Number(style.opacity) === 0) return false;
  const rect = element.getBoundingClientRect();
  return rect.width > 0 && rect.height > 0;
}

function getGrokElementText(element) {
  if (!element) return '';
  return String(
    element.innerText
    || element.textContent
    || element.getAttribute?.('aria-label')
    || element.getAttribute?.('title')
    || ''
  )
    .replace(/\s+/g, ' ')
    .trim();
}

function queryVisibleGrokElement(selector) {
  return Array.from(document.querySelectorAll(selector)).find(isVisibleGrokElement) || null;
}

function findGrokClickableByText(pattern) {
  const selectors = 'button, a, [role="button"], input[type="button"], input[type="submit"]';
  return Array.from(document.querySelectorAll(selectors)).find((element) => {
    if (!isVisibleGrokElement(element)) return false;
    const text = element instanceof HTMLInputElement ? element.value : getGrokElementText(element);
    return pattern.test(text);
  }) || null;
}

function simulateGrokClick(element) {
  throwIfStopped();
  if (!element) {
    throw new Error('无法点击空元素。');
  }
  const rect = element.getBoundingClientRect();
  const clientX = Math.max(0, Math.floor(rect.left + Math.min(rect.width - 1, Math.max(1, rect.width / 2))));
  const clientY = Math.max(0, Math.floor(rect.top + Math.min(rect.height - 1, Math.max(1, rect.height / 2))));
  const eventOptions = {
    bubbles: true,
    cancelable: true,
    view: window,
    clientX,
    clientY,
    screenX: window.screenX + clientX,
    screenY: window.screenY + clientY,
  };
  element.dispatchEvent(new MouseEvent('mouseover', eventOptions));
  element.dispatchEvent(new MouseEvent('mousedown', eventOptions));
  element.dispatchEvent(new MouseEvent('mouseup', eventOptions));
  if (typeof element.click === 'function') {
    element.click();
    return;
  }
  element.dispatchEvent(new MouseEvent('click', eventOptions));
}

async function waitForGrok(predicate, options = {}) {
  const timeoutMs = Math.max(1000, Number(options.timeoutMs) || 30000);
  const intervalMs = Math.max(100, Number(options.intervalMs) || 250);
  const deadline = Date.now() + timeoutMs;
  let lastValue = null;
  while (Date.now() <= deadline) {
    throwIfStopped();
    lastValue = predicate();
    if (lastValue) return lastValue;
    await sleep(intervalMs);
  }
  return lastValue;
}

function findGrokEmailInput() {
  return queryVisibleGrokElement([
    'input[type="email"]',
    'input[name="email" i]',
    'input[autocomplete="email"]',
    'input[placeholder*="email" i]',
    'input[inputmode="email"]',
  ].join(', '));
}

function findGrokOtpInputs() {
  const inputs = Array.from(document.querySelectorAll([
    'input[autocomplete="one-time-code"]',
    'input[inputmode="numeric"]',
    'input[name*="otp" i]',
    'input[name*="code" i]',
    'input[aria-label*="code" i]',
    'input[placeholder*="code" i]',
  ].join(', '))).filter(isVisibleGrokElement);
  if (inputs.length) return inputs;
  const oneCharInputs = Array.from(document.querySelectorAll('input:not([type="hidden"]):not([type="checkbox"]):not([type="radio"]):not([type="submit"])'))
    .filter((input) => isVisibleGrokElement(input) && Number(input.maxLength || 0) === 1);
  return oneCharInputs.length >= 4 ? oneCharInputs : [];
}

function findGrokProfileInput(names) {
  const selectors = names.flatMap((name) => [
    `input[name="${name}" i]`,
    `input[id="${name}" i]`,
    `input[autocomplete="${name}" i]`,
    `input[placeholder*="${name}" i]`,
    `input[aria-label*="${name}" i]`,
  ]).join(', ');
  return queryVisibleGrokElement(selectors);
}

function findGrokPasswordInputs() {
  return Array.from(document.querySelectorAll([
    'input[type="password"]',
    'input[name*="password" i]',
    'input[autocomplete="new-password"]',
    'input[placeholder*="password" i]',
    'input[aria-label*="password" i]',
  ].join(', '))).filter(isVisibleGrokElement);
}

function findGrokSubmitButton(contextPattern = GROK_CONTINUE_TEXT_PATTERN) {
  return findGrokClickableByText(contextPattern)
    || Array.from(document.querySelectorAll('button:not([disabled]), [role="button"]')).filter(isVisibleGrokElement).at(-1)
    || null;
}

function getGrokPageState() {
  const pageText = document.body?.innerText || '';
  if (/grok|xai|x\.ai/i.test(location.hostname) && /(?:^|;\s*)sso=/.test(document.cookie || '')) return 'signed_in';
  if (findGrokProfileInput(['givenName', 'firstName']) || findGrokPasswordInputs().length || GROK_PROFILE_TEXT_PATTERN.test(pageText)) return 'profile_entry';
  if (findGrokOtpInputs().length) return 'verification_code_entry';
  if (findGrokEmailInput()) return 'email_entry';
  return 'unknown';
}

async function openGrokSignupPage() {
  if (!/accounts\.x\.ai$/i.test(location.hostname) || !/\/sign-up/i.test(location.pathname)) {
    location.href = GROK_SIGNUP_URL;
    return { submitted: true, state: 'navigating', url: location.href };
  }
  const emailButton = await waitForGrok(() => (
    findGrokClickableByText(GROK_EMAIL_SIGNUP_TEXT_PATTERN) || findGrokEmailInput()
  ), { timeoutMs: 30000 });
  if (!emailButton) throw new Error('未找到 x.ai 邮箱注册入口。');
  if (!(emailButton instanceof HTMLInputElement)) {
    simulateGrokClick(emailButton);
    await sleep(500);
  }
  return { submitted: true, state: getGrokPageState(), url: location.href };
}

function getGrokEmailErrorText() {
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

async function waitForGrokVerificationPageAfterEmailSubmit() {
  const settledState = await waitForGrok(() => {
    const errorText = getGrokEmailErrorText();
    if (errorText) return { state: 'email_error', error: errorText, url: location.href };
    const state = getGrokPageState();
    return state === 'verification_code_entry' ? { state, url: location.href } : null;
  }, { timeoutMs: GROK_EMAIL_VERIFICATION_READY_TIMEOUT_MS, intervalMs: 500 });

  if (settledState?.error) {
    throw new Error(settledState.error);
  }
  if (settledState?.state === 'verification_code_entry') {
    return settledState;
  }

  const errorText = getGrokEmailErrorText();
  if (errorText) {
    throw new Error(errorText);
  }
  const finalState = getGrokPageState();
  throw new Error(`提交 Grok 注册邮箱后未进入验证码页面，当前页面状态：${finalState || 'unknown'}。请确认页面已跳转到“验证您的邮箱”后再继续。`);
}

async function submitGrokEmail(payload = {}) {
  const email = String(payload.email || '').trim();
  if (!email) throw new Error('缺少 Grok 注册邮箱。');
  const input = await waitForGrok(findGrokEmailInput, { timeoutMs: 45000 });
  if (!input) throw new Error('未找到 x.ai 邮箱输入框。');
  fillInput(input, email);
  await sleep(200);
  const button = findGrokSubmitButton();
  if (!button) throw new Error('未找到 x.ai 邮箱提交按钮。');
  simulateGrokClick(button);
  await sleep(1200);
  const errorText = getGrokEmailErrorText();
  if (errorText) {
    throw new Error(errorText);
  }
  const readyState = await waitForGrokVerificationPageAfterEmailSubmit();
  return { submitted: true, state: readyState.state, url: readyState.url || location.href };
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
  const inputs = await waitForGrok(() => findGrokOtpInputs(), { timeoutMs: 45000 });
  if (!inputs?.length) throw new Error('未找到 xAI 验证码输入框。');
  if (inputs.length === 1) {
    fillInput(inputs[0], normalizedCode);
  } else {
    normalizedCode.split('').forEach((char, index) => {
      if (inputs[index]) fillInput(inputs[index], char);
    });
  }
  await sleep(200);
  const button = findGrokSubmitButton();
  if (button) simulateGrokClick(button);
  const settledState = await waitForGrok(() => {
    const errorText = getGrokVerificationErrorText();
    if (errorText) return { state: 'verification_error', error: errorText };
    const state = getGrokPageState();
    return state && state !== 'verification_code_entry' ? { state } : null;
  }, { timeoutMs: 20000, intervalMs: 500 });
  const finalState = settledState?.state || getGrokPageState();
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
  const ready = await waitForGrok(() => {
    const firstInput = findGrokProfileInput(['givenName', 'firstName', 'given-name']);
    const lastInput = findGrokProfileInput(['familyName', 'lastName', 'family-name']);
    const passwordInputs = findGrokPasswordInputs();
    return firstInput && lastInput && passwordInputs.length ? { firstInput, lastInput, passwordInputs } : null;
  }, { timeoutMs: 45000 });
  if (!ready) throw new Error('未找到 x.ai 资料或密码表单。');
  fillInput(ready.firstInput, firstName);
  fillInput(ready.lastInput, lastName);
  ready.passwordInputs.forEach((input) => fillInput(input, password));
  await sleep(GROK_PROFILE_SUBMIT_PRE_CLICK_DELAY_MS);
  const button = findGrokSubmitButton();
  if (!button) throw new Error('未找到 x.ai 资料提交按钮。');
  simulateGrokClick(button);
  return { submitted: true, state: 'profile_submitted', url: location.href };
}

async function extractGrokSsoCookie() {
  const match = String(document.cookie || '').match(/(?:^|;\s*)sso=([^;]+)/);
  return {
    submitted: true,
    state: match ? 'sso_cookie_found' : getGrokPageState(),
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
      return { state: getGrokPageState(), url: location.href };
    default:
      throw new Error(`未知 Grok 注册命令：${command}`);
  }
}

if (!document.documentElement.hasAttribute(GROK_REGISTER_PAGE_LISTENER_SENTINEL)) {
  document.documentElement.setAttribute(GROK_REGISTER_PAGE_LISTENER_SENTINEL, '1');
  chrome.runtime.onMessage.addListener((message, _sender, sendResponse) => {
    if (message?.type !== 'EXECUTE_NODE' && message?.type !== 'GET_PAGE_STATE') return false;
    resetStopState();
    const command = message.command || message.nodeId || message.type;
    executeGrokCommand(command, message.payload || {})
      .then((result) => sendResponse({ ok: true, ...result }))
      .catch((error) => {
        if (isStopError(error)) {
          sendResponse({ stopped: true, error: error.message });
          return;
        }
        sendResponse({ ok: false, error: error?.message || String(error) });
      });
    return true;
  });
}

window.__MULTIPAGE_GROK_REGISTER_PAGE__ = {
  executeGrokCommand,
  getGrokPageState,
};
