// flows/openai/content/paypal-flow.js — PayPal login and approval helper.

console.log('[MultiPage:paypal-flow] Content script loaded on', location.href);

const PAYPAL_FLOW_LISTENER_SENTINEL = 'data-multipage-paypal-flow-listener';
const PAYPAL_HOSTED_DEFAULT_PHONE = '1234567890';
const PAYPAL_HOSTED_STAGE_OUTSIDE = 'outside_paypal';
const PAYPAL_HOSTED_STAGE_LOGIN = 'pay_login';
const PAYPAL_HOSTED_STAGE_GUEST_CHECKOUT = 'guest_checkout';
const PAYPAL_HOSTED_STAGE_CREATE_ACCOUNT = 'create_account';
const PAYPAL_HOSTED_STAGE_SECURITY_CODE = 'security_code';
const PAYPAL_HOSTED_STAGE_REVIEW = 'review_consent';
const PAYPAL_HOSTED_STAGE_APPROVAL = 'approval';
const PAYPAL_HOSTED_STAGE_UNKNOWN = 'unknown';
const PAYPAL_HOSTED_STEP_KEYS = {
  [PAYPAL_HOSTED_STAGE_LOGIN]: 'paypal-hosted-email',
  [PAYPAL_HOSTED_STAGE_GUEST_CHECKOUT]: 'paypal-hosted-card',
  [PAYPAL_HOSTED_STAGE_CREATE_ACCOUNT]: 'paypal-hosted-create-account',
  [PAYPAL_HOSTED_STAGE_SECURITY_CODE]: 'paypal-hosted-create-account',
  [PAYPAL_HOSTED_STAGE_REVIEW]: 'paypal-hosted-review',
};

if (document.documentElement.getAttribute(PAYPAL_FLOW_LISTENER_SENTINEL) !== '1') {
  document.documentElement.setAttribute(PAYPAL_FLOW_LISTENER_SENTINEL, '1');

  chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
    if (
      message.type === 'PAYPAL_GET_STATE'
      || message.type === 'PAYPAL_SUBMIT_LOGIN'
      || message.type === 'PAYPAL_DISMISS_PROMPTS'
      || message.type === 'PAYPAL_CLICK_APPROVE'
      || message.type === 'PAYPAL_HOSTED_GET_STATE'
      || message.type === 'PAYPAL_RUN_HOSTED_CHECKOUT_STEP'
    ) {
      resetStopState();
      handlePayPalCommand(message).then((result) => {
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
  console.log('[MultiPage:paypal-flow] 消息监听已存在，跳过重复注册');
}

async function performPayPalOperationWithDelay(metadata, operation) {
  const rootScope = typeof window !== 'undefined' ? window : globalThis;
  const gate = rootScope?.CodexOperationDelay?.performOperationWithDelay;
  return typeof gate === 'function' ? gate(metadata, operation) : operation();
}

async function handlePayPalCommand(message) {
  switch (message.type) {
    case 'PAYPAL_GET_STATE':
      return inspectPayPalState();
    case 'PAYPAL_SUBMIT_LOGIN':
      return submitPayPalLogin(message.payload || {});
    case 'PAYPAL_DISMISS_PROMPTS':
      return dismissPayPalPrompts();
    case 'PAYPAL_CLICK_APPROVE':
      return clickPayPalApprove();
    case 'PAYPAL_HOSTED_GET_STATE':
      return inspectPayPalHostedState();
    case 'PAYPAL_RUN_HOSTED_CHECKOUT_STEP':
      return runPayPalHostedCheckoutStep(message.payload || {});
    default:
      throw new Error(`paypal-flow.js 不处理消息：${message.type}`);
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
      throw new Error(options.timeoutMessage || 'PayPal page timed out waiting for target state.');
    }
    await sleep(intervalMs);
  }
}

async function waitForDocumentComplete() {
  await waitUntil(() => document.readyState === 'complete', { intervalMs: 200 });
  await sleep(1000);
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

function findClickableByText(patterns) {
  const normalizedPatterns = (Array.isArray(patterns) ? patterns : [patterns]).filter(Boolean);
  const candidates = getVisibleControls('button, a, [role="button"], input[type="button"], input[type="submit"]');
  return candidates.find((el) => {
    const text = getActionText(el);
    return normalizedPatterns.some((pattern) => pattern.test(text));
  }) || null;
}

function findInputByPatterns(patterns) {
  const inputs = getVisibleControls('input')
    .filter((input) => {
      const type = String(input.getAttribute('type') || input.type || '').trim().toLowerCase();
      return isEnabledControl(input) && !['hidden', 'checkbox', 'radio', 'submit', 'button', 'file'].includes(type);
    });
  return inputs.find((input) => {
    const text = getActionText(input);
    return patterns.some((pattern) => pattern.test(text));
  }) || null;
}

function findEmailInput() {
  const isPasswordCandidate = (input) => {
    const type = String(input?.getAttribute?.('type') || input?.type || '').trim().toLowerCase();
    const metadataText = normalizeText([
      input?.textContent,
      input?.getAttribute?.('aria-label'),
      input?.getAttribute?.('title'),
      input?.getAttribute?.('placeholder'),
      input?.getAttribute?.('name'),
      input?.id,
    ].filter(Boolean).join(' '));
    return type === 'password' || /password|pass|密码/i.test(metadataText);
  };
  const inputs = getVisibleControls('input')
    .filter((input) => {
      const type = String(input.getAttribute('type') || input.type || '').trim().toLowerCase();
      return isEnabledControl(input)
        && !['hidden', 'checkbox', 'radio', 'submit', 'button', 'file'].includes(type)
        && !isPasswordCandidate(input);
    });
  return inputs.find((input) => [
    /email|login|user|账号|邮箱/i,
  ].some((pattern) => pattern.test(getActionText(input))))
    || getVisibleControls('input[type="email"]').find((input) => isVisibleElement(input) && !isPasswordCandidate(input))
    || null;
}

function findPasswordInput() {
  const inputs = getVisibleControls('input')
    .filter((input) => {
      const type = String(input.getAttribute('type') || input.type || '').trim().toLowerCase();
      return isEnabledControl(input) && !['hidden', 'checkbox', 'radio', 'submit', 'button', 'file'].includes(type);
    });
  return inputs.find((input) => {
    const type = String(input.getAttribute('type') || input.type || '').trim().toLowerCase();
    const metadataText = normalizeText([
      input?.textContent,
      input?.getAttribute?.('aria-label'),
      input?.getAttribute?.('title'),
      input?.getAttribute?.('placeholder'),
      input?.getAttribute?.('name'),
      input?.id,
    ].filter(Boolean).join(' '));
    return type === 'password' || /password|pass|密码/i.test(metadataText);
  }) || getVisibleControls('input[type="password"]').find(isVisibleElement) || null;
}

function findLoginNextButton() {
  return findClickableByText([
    /next|continue|login|log\s*in|sign\s*in/i,
    /下一步|继续|登录|登入/i,
  ]);
}

function findEmailNextButton() {
  return findClickableByText([
    /next|btn\s*next|btnnext/i,
    /下一页|下一步/i,
  ]);
}

function findPasswordLoginButton() {
  const button = findClickableByText([
    /login|log\s*in|sign\s*in/i,
    /登录|登入/i,
  ]);
  return button && button !== findEmailNextButton() ? button : null;
}

function findApproveButton() {
  return findClickableByText([
    /同意并继续|同意|继续|授权|确认并继续/i,
    /agree\s*(?:and)?\s*continue|continue|accept|authorize|agree|pay\s*now/i,
  ]);
}

function getPayPalPathname() {
  return String(location?.pathname || '').trim();
}

function isHostedLoginPage() {
  return getPayPalPathname() === '/pay' || Boolean(document.getElementById('email'));
}

function isHostedGuestCheckoutPage() {
  if (document.getElementById('cardNumber') || document.getElementById('billingLine1')) {
    return true;
  }
  const pageText = normalizeText(document.body?.innerText || document.body?.textContent || '');
  if (/create\s*(?:paypal\s*)?account|agree\s*(?:&|and)?\s*create|创建.*(?:账户|账号)/i.test(pageText)
    && findHostedCreateAccountButton()) {
    return false;
  }
  return /\/checkoutweb\//i.test(getPayPalPathname())
    && Boolean(document.getElementById('phone') || document.getElementById('email'));
}

function isHostedReviewPage() {
  return /\/webapps\/hermes/i.test(getPayPalPathname());
}

function findHostedCreateAccountButton() {
  return document.getElementById('createAccount')
    || document.getElementById('createAccountButton')
    || document.querySelector('button[data-testid="createAccountButton"]')
    || document.querySelector('button[data-testid="create-account-button"]')
    || findClickableByText([
      /agree\s*(?:&|and)?\s*create\s*(?:paypal\s*)?account/i,
      /create\s*(?:paypal\s*)?account/i,
      /同意.*创建|创建.*账户|创建.*账号/i,
    ]);
}

function isHostedCreateAccountPage() {
  if (isHostedLoginPage()) {
    return false;
  }
  if (document.getElementById('cardNumber') || document.getElementById('billingLine1')) {
    return false;
  }
  const button = findHostedCreateAccountButton();
  if (!button || !isVisibleElement(button) || !isEnabledControl(button)) {
    return false;
  }
  const pageText = normalizeText(document.body?.innerText || document.body?.textContent || '');
  return /create\s*(?:paypal\s*)?account|agree\s*(?:&|and)?\s*create|创建.*(?:账户|账号)/i.test(pageText)
    || /create/i.test(getActionText(button));
}

function findHostedReviewConsentButton() {
  const direct = document.getElementById('consentButton')
    || document.querySelector('button[data-testid="consentButton"]');
  if (direct && isVisibleElement(direct) && isEnabledControl(direct)) {
    return direct;
  }
  return findClickableByText([
    /agree\s*(?:and)?\s*continue|accept|continue/i,
    /同意并继续|同意|继续/i,
  ]);
}

function getHostedSecurityCodeInputs() {
  const pageText = normalizeText(document.body?.innerText || document.body?.textContent || '');
  const pageLooksLikeSecurityCode = /enter\s+(?:your\s+)?code|6[-\s]*digit\s+code|security\s+code|verification\s+code|we\s+sent\s+a\s+6[-\s]*digit\s+code/i.test(pageText);
  const visibleInputs = getVisibleControls('input')
    .filter((input) => {
      const type = String(input.getAttribute?.('type') || input.type || '').trim().toLowerCase();
      return isEnabledControl(input)
        && !['hidden', 'checkbox', 'radio', 'submit', 'button', 'file'].includes(type);
    });
  const candidates = visibleInputs
    .filter((input) => {
      const maxLength = Number(input.getAttribute?.('maxlength') || input.maxLength || 0);
      const metadata = getActionText(input);
      return maxLength === 1 || /otp|code|verification|security|one[-\s]*time/i.test(metadata);
    });
  if (candidates.length < 6 && pageLooksLikeSecurityCode && visibleInputs.length >= 6) {
    return visibleInputs.slice(0, 6);
  }
  const singleDigitInputs = candidates.filter((input) => {
    const maxLength = Number(input.getAttribute?.('maxlength') || input.maxLength || 0);
    const valueLength = String(input.value || '').length;
    return maxLength === 1 || valueLength <= 1;
  });
  return singleDigitInputs.length >= 6 ? singleDigitInputs.slice(0, 6) : candidates;
}

function getHostedSecurityCodeSingleInput() {
  return getVisibleControls('input').find((input) => {
    const type = String(input.getAttribute?.('type') || input.type || '').trim().toLowerCase();
    const maxLength = Number(input.getAttribute?.('maxlength') || input.maxLength || 0);
    const metadata = getActionText(input);
    return isEnabledControl(input)
      && !['hidden', 'checkbox', 'radio', 'submit', 'button', 'file'].includes(type)
      && maxLength >= 6
      && /otp|code|verification|security|one[-\s]*time/i.test(metadata);
  }) || null;
}

function findHostedSecurityCodeSubmitButton() {
  return findClickableByText([
    /submit|continue|next|verify|confirm|done/i,
  ]);
}

function isHostedSecurityCodePage() {
  const pageText = normalizeText(document.body?.innerText || document.body?.textContent || '');
  const hasSecurityText = /enter\s+(?:your\s+)?code|6[-\s]*digit\s+code|security\s+code|verification\s+code|we\s+sent\s+a\s+6[-\s]*digit\s+code/i.test(pageText);
  return hasSecurityText && (getHostedSecurityCodeInputs().length >= 6 || Boolean(getHostedSecurityCodeSingleInput()));
}

function detectPayPalHostedStage() {
  if (!/paypal\./i.test(String(location?.host || ''))) {
    return PAYPAL_HOSTED_STAGE_OUTSIDE;
  }
  if (isHostedSecurityCodePage()) {
    return PAYPAL_HOSTED_STAGE_SECURITY_CODE;
  }
  if (isHostedGuestCheckoutPage()) {
    return PAYPAL_HOSTED_STAGE_GUEST_CHECKOUT;
  }
  if (isHostedReviewPage() && findHostedReviewConsentButton()) {
    return PAYPAL_HOSTED_STAGE_REVIEW;
  }
  if (isHostedCreateAccountPage()) {
    return PAYPAL_HOSTED_STAGE_CREATE_ACCOUNT;
  }
  if (isHostedLoginPage()) {
    return PAYPAL_HOSTED_STAGE_LOGIN;
  }
  return findApproveButton() ? PAYPAL_HOSTED_STAGE_APPROVAL : PAYPAL_HOSTED_STAGE_UNKNOWN;
}

function fillHostedInputById(id, value) {
  const input = document.getElementById(String(id || '').trim());
  if (!input || !isVisibleElement(input) || !isEnabledControl(input)) {
    return false;
  }
  fillInput(input, String(value || ''));
  return true;
}

function selectHostedOptionByIdText(id, value) {
  const select = document.getElementById(String(id || '').trim());
  const expected = normalizeText(value).toLowerCase();
  if (!select || !expected) {
    return false;
  }
  const option = Array.from(select.options || []).find((item) => {
    const optionText = normalizeText(item.textContent || item.label || '').toLowerCase();
    const optionValue = normalizeText(item.value || '').toLowerCase();
    return optionText.includes(expected) || optionValue.includes(expected);
  });
  if (!option) {
    return false;
  }
  select.value = option.value;
  select.dispatchEvent(new Event('input', { bubbles: true }));
  select.dispatchEvent(new Event('change', { bubbles: true }));
  return true;
}

function findHostedSubmitButton() {
  return document.querySelector('button[data-testid="submit-button"]')
    || document.querySelector('button[data-testid="hosted-payment-submit-button"]')
    || document.querySelector('button[data-atomic-wait-intent="Submit_Email"]')
    || document.querySelector('button.SubmitButton--complete')
    || findEmailNextButton()
    || findLoginNextButton()
    || findClickableByText([
      /pay|continue|next|agree|subscribe/i,
      /支付|继续|下一步|同意|订阅/i,
    ]);
}

function getHostedStepKey(stage = '', fallback = 'plus-checkout-create') {
  return PAYPAL_HOSTED_STEP_KEYS[stage] || fallback;
}

async function clickHostedSubmitButton(options = {}) {
  const stepKey = String(options.stepKey || getHostedStepKey(options.stage)).trim();
  const label = String(options.label || 'hosted-paypal-submit').trim();
  const maxAttempts = Math.max(1, Math.floor(Number(options.maxAttempts) || 3));
  let lastButtonText = '';
  let lastDisabled = false;
  for (let attempt = 1; attempt <= maxAttempts; attempt += 1) {
    const button = await waitUntil(() => {
      const candidate = findHostedSubmitButton();
      return candidate && isVisibleElement(candidate) ? candidate : null;
    }, {
      intervalMs: 500,
      timeoutMs: 15000,
      timeoutMessage: 'PayPal hosted checkout 未找到可点击的继续/提交按钮。',
    });
    lastButtonText = getActionText(button);
    lastDisabled = !isEnabledControl(button);
    if (lastDisabled) {
      if (attempt >= maxAttempts) {
        throw new Error('PayPal hosted checkout 继续/提交按钮长时间不可用。');
      }
      await sleep(1000);
      continue;
    }

    await performPayPalOperationWithDelay({ stepKey, kind: 'click', label }, async () => {
      simulateClick(button);
    });
    await sleep(1000);
    return {
      clicked: true,
      buttonText: lastButtonText,
      attempt,
    };
  }
  return {
    clicked: false,
    buttonText: lastButtonText,
    disabled: lastDisabled,
  };
}

async function clickHostedEmailNextButton() {
  const button = await waitUntil(() => {
    const candidate = findEmailNextButton();
    return candidate && isVisibleElement(candidate) && isEnabledControl(candidate) ? candidate : null;
  }, {
    intervalMs: 500,
    timeoutMs: 15000,
    timeoutMessage: 'PayPal hosted checkout 未找到邮箱页“下一页”按钮。',
  });
  const buttonText = getActionText(button);
  await performPayPalOperationWithDelay({
    stepKey: getHostedStepKey(PAYPAL_HOSTED_STAGE_LOGIN),
    kind: 'click',
    label: 'hosted-paypal-email-next',
  }, async () => {
    simulateClick(button);
  });
  return {
    clicked: true,
    buttonText,
  };
}

function normalizeHostedPhoneDigits(value = '') {
  return String(value || '').replace(/\D/g, '');
}

function verifyHostedPhoneBeforeSubmit(expectedPhone = '') {
  const phoneInput = document.getElementById('phone');
  if (!phoneInput || !isVisibleElement(phoneInput)) {
    throw new Error('PayPal hosted checkout 未找到电话输入框。');
  }
  const expectedDigits = normalizeHostedPhoneDigits(expectedPhone || PAYPAL_HOSTED_DEFAULT_PHONE);
  const renderedDigits = normalizeHostedPhoneDigits(phoneInput.value || '');
  if (!expectedDigits) {
    throw new Error('PayPal hosted checkout 电话配置为空。');
  }
  const comparableRenderedDigits = renderedDigits.length > expectedDigits.length
    ? renderedDigits.slice(-expectedDigits.length)
    : renderedDigits;
  if (comparableRenderedDigits !== expectedDigits) {
    throw new Error(`PayPal hosted checkout 电话不一致：配置 ${expectedDigits}，页面 ${renderedDigits || '(空)'}。`);
  }
  return {
    payloadPhoneDigits: expectedDigits,
    renderedPhoneDigits: renderedDigits,
    phoneMatched: true,
  };
}

function normalizeHostedSecurityCode(value = '') {
  const code = String(value || '').replace(/\D/g, '').slice(0, 6);
  return /^\d{6}$/.test(code) ? code : '';
}

async function submitHostedSecurityCode(payload = {}) {
  await waitForDocumentComplete();
  const code = normalizeHostedSecurityCode(payload.securityCode || payload.verificationCode || payload.code || '');
  if (!code) {
    throw new Error('PayPal hosted checkout 验证码为空或不是 6 位数字。');
  }
  const digitInputs = getHostedSecurityCodeInputs();
  const singleInput = getHostedSecurityCodeSingleInput();
  if (digitInputs.length >= 6) {
    digitInputs.slice(0, 6).forEach((input, index) => {
      fillInput(input, code[index]);
    });
  } else if (singleInput) {
    fillInput(singleInput, code);
  } else {
    throw new Error('PayPal hosted checkout 未找到验证码输入框。');
  }

  const submitButton = findHostedSecurityCodeSubmitButton();
  if (submitButton && isVisibleElement(submitButton) && isEnabledControl(submitButton)) {
    await performPayPalOperationWithDelay({
      stepKey: getHostedStepKey(PAYPAL_HOSTED_STAGE_SECURITY_CODE),
      kind: 'click',
      label: 'hosted-paypal-security-code-submit',
    }, async () => {
      simulateClick(submitButton);
    });
  }
  await sleep(1000);
  return {
    stage: PAYPAL_HOSTED_STAGE_SECURITY_CODE,
    securityCodeSubmitted: true,
    submitted: Boolean(submitButton),
    inputCount: digitInputs.length >= 6 ? 6 : 1,
  };
}

async function clickHostedCreateAccount(payload = {}) {
  await waitForDocumentComplete();
  const button = await waitUntil(() => {
    const candidate = findHostedCreateAccountButton();
    return candidate && isVisibleElement(candidate) && isEnabledControl(candidate) ? candidate : null;
  }, {
    intervalMs: 500,
    timeoutMs: 30000,
    timeoutMessage: 'PayPal hosted checkout 未找到创建账号确认按钮。',
  });
  await performPayPalOperationWithDelay({
    stepKey: getHostedStepKey(PAYPAL_HOSTED_STAGE_CREATE_ACCOUNT),
    kind: 'click',
    label: 'hosted-paypal-create-account',
  }, async () => {
    simulateClick(button);
  });
  return {
    stage: PAYPAL_HOSTED_STAGE_CREATE_ACCOUNT,
    clicked: true,
    submitted: true,
    buttonText: getActionText(button),
  };
}

function buildHostedRandomEmail() {
  const alphabet = 'abcdefghijklmnopqrstuvwxyz0123456789';
  let value = '';
  for (let index = 0; index < 16; index += 1) {
    value += alphabet[Math.floor(Math.random() * alphabet.length)];
  }
  return `${value}@gmail.com`;
}

function buildHostedRandomPassword() {
  const alphabet = 'abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789!@#$%^';
  let value = 'Aa1!';
  while (value.length < 14) {
    value += alphabet[Math.floor(Math.random() * alphabet.length)];
  }
  return value;
}

function buildHostedVisaCard() {
  const digits = [4, 1, 4, 7];
  while (digits.length < 15) {
    digits.push(Math.floor(Math.random() * 10));
  }
  const reversed = digits.slice().reverse();
  let sum = 0;
  for (let index = 0; index < reversed.length; index += 1) {
    let digit = reversed[index];
    if (index % 2 === 0) {
      digit *= 2;
      if (digit > 9) digit -= 9;
    }
    sum += digit;
  }
  digits.push((10 - (sum % 10)) % 10);
  const month = String(Math.floor(Math.random() * 12) + 1).padStart(2, '0');
  const year = (new Date().getFullYear() % 100) + 3;
  return {
    number: digits.join(''),
    expiry: `${month} / ${year}`,
    cvv: String(Math.floor(100 + Math.random() * 900)),
  };
}

async function submitHostedLogin(payload = {}) {
  await waitForDocumentComplete();
  const email = normalizeText(payload.email || buildHostedRandomEmail());
  const emailInput = document.getElementById('email') || findEmailInput();
  if (!emailInput) {
    throw new Error('PayPal hosted checkout 未找到邮箱输入框。');
  }
  refillPayPalEmailInput(emailInput, email);
  const clickResult = await clickHostedEmailNextButton();
  return {
    stage: PAYPAL_HOSTED_STAGE_LOGIN,
    submitted: true,
    generatedEmail: email,
    clicked: Boolean(clickResult.clicked),
  };
}

async function fillHostedGuestCheckout(payload = {}) {
  await waitForDocumentComplete();
  const countrySelect = document.getElementById('country');
  if (countrySelect && String(countrySelect.value || '').trim().toUpperCase() !== 'US') {
    countrySelect.value = 'US';
    countrySelect.dispatchEvent(new Event('change', { bubbles: true }));
    await sleep(1000);
  }
  const generatedCard = buildHostedVisaCard();
  const address = payload.address && typeof payload.address === 'object' ? payload.address : {};
  const values = {
    email: normalizeText(payload.email || buildHostedRandomEmail()),
    phone: normalizeText(payload.phone || PAYPAL_HOSTED_DEFAULT_PHONE),
    cardNumber: String(payload.cardNumber || generatedCard.number).replace(/\s+/g, ''),
    cardExpiry: normalizeText(payload.cardExpiry || generatedCard.expiry),
    cardCvv: normalizeText(payload.cardCvv || generatedCard.cvv),
    password: String(payload.password || buildHostedRandomPassword()),
    firstName: normalizeText(payload.firstName || 'James'),
    lastName: normalizeText(payload.lastName || 'Smith'),
  };
  fillHostedInputById('email', values.email);
  fillHostedInputById('phone', values.phone);
  fillHostedInputById('cardNumber', values.cardNumber);
  fillHostedInputById('cardExpiry', values.cardExpiry);
  fillHostedInputById('cardCvv', values.cardCvv);
  fillHostedInputById('password', values.password);
  fillHostedInputById('firstName', values.firstName);
  fillHostedInputById('lastName', values.lastName);
  fillHostedInputById('billingLine1', address.street || address.address1 || '');
  fillHostedInputById('billingCity', address.city || '');
  fillHostedInputById('billingPostalCode', address.zip || address.postalCode || '');
  selectHostedOptionByIdText('billingState', address.state || address.region || '');
  const phoneCheck = verifyHostedPhoneBeforeSubmit(values.phone);
  const clickResult = await clickHostedSubmitButton({
    stage: PAYPAL_HOSTED_STAGE_GUEST_CHECKOUT,
    label: 'hosted-paypal-card-submit',
    maxAttempts: 4,
  });
  return {
    stage: PAYPAL_HOSTED_STAGE_GUEST_CHECKOUT,
    submitted: true,
    payloadPhone: values.phone,
    ...phoneCheck,
  };
}

async function clickHostedReviewConsent() {
  await waitForDocumentComplete();
  const button = await waitUntil(() => {
    const candidate = findHostedReviewConsentButton();
    return candidate && isVisibleElement(candidate) && isEnabledControl(candidate) ? candidate : null;
  }, {
    intervalMs: 500,
    timeoutMs: 30000,
    timeoutMessage: 'PayPal hosted checkout 未找到账单确认按钮。',
  });
  await performPayPalOperationWithDelay({
    stepKey: getHostedStepKey(PAYPAL_HOSTED_STAGE_REVIEW),
    kind: 'click',
    label: 'hosted-paypal-review-consent',
  }, async () => {
    simulateClick(button);
  });
  return {
    stage: PAYPAL_HOSTED_STAGE_REVIEW,
    submitted: true,
  };
}

async function runPayPalHostedCheckoutStep(payload = {}) {
  const stage = detectPayPalHostedStage();
  const expectedStage = String(payload.expectedStage || '').trim();
  if (expectedStage && stage !== expectedStage) {
    return {
      stage,
      expectedStage,
      submitted: false,
      skipped: true,
      approveReady: Boolean(findApproveButton()),
    };
  }
  if (stage === PAYPAL_HOSTED_STAGE_LOGIN) {
    return submitHostedLogin(payload);
  }
  if (stage === PAYPAL_HOSTED_STAGE_GUEST_CHECKOUT) {
    return fillHostedGuestCheckout(payload);
  }
  if (stage === PAYPAL_HOSTED_STAGE_CREATE_ACCOUNT) {
    return clickHostedCreateAccount(payload);
  }
  if (stage === PAYPAL_HOSTED_STAGE_SECURITY_CODE) {
    return submitHostedSecurityCode(payload);
  }
  if (stage === PAYPAL_HOSTED_STAGE_REVIEW) {
    return clickHostedReviewConsent();
  }
  return {
    stage,
    submitted: false,
    approveReady: Boolean(findApproveButton()),
  };
}

function inspectPayPalHostedState() {
  const stage = detectPayPalHostedStage();
  const createAccountButton = findHostedCreateAccountButton();
  return {
    url: location.href,
    readyState: document.readyState,
    hostedStage: stage,
    hasGuestCardFields: Boolean(document.getElementById('cardNumber')),
    hasHostedEmailInput: Boolean(document.getElementById('email') || findEmailInput()),
    securityCodeVisible: stage === PAYPAL_HOSTED_STAGE_SECURITY_CODE,
    createAccountReady: Boolean(createAccountButton && isVisibleElement(createAccountButton) && isEnabledControl(createAccountButton)),
    reviewConsentReady: Boolean(findHostedReviewConsentButton()),
    approveReady: Boolean(findApproveButton()),
    bodyTextPreview: normalizeText(document.body?.innerText || '').slice(0, 240),
  };
}

function findPasskeyPromptButtons() {
  const promptPatterns = [
    /passkey|通行密钥|安全密钥|下次登录|faster|save/i,
  ];
  const bodyText = normalizeText(document.body?.innerText || '');
  const likelyPrompt = promptPatterns.some((pattern) => pattern.test(bodyText));
  if (!likelyPrompt) {
    return [];
  }

  const cancelOrClose = getVisibleControls('button, a, [role="button"]')
    .filter((el) => {
      const text = getActionText(el);
      return /取消|稍后|不保存|不用|关闭|cancel|not now|maybe later|skip|close|x/i.test(text)
        || el.getAttribute?.('aria-label')?.match(/close|关闭/i);
    });

  const iconCloseButtons = getVisibleControls('button, [role="button"]')
    .filter((el) => {
      const text = getActionText(el);
      const rect = el.getBoundingClientRect();
      return (/^×$|^x$/i.test(text) || /close|关闭/i.test(text))
        && rect.width <= 64
        && rect.height <= 64;
    });

  return [...cancelOrClose, ...iconCloseButtons];
}

function hasPasskeyPrompt() {
  return findPasskeyPromptButtons().length > 0;
}

function getPayPalLoginPhase(emailInput, passwordInput) {
  const emailNextButton = findEmailNextButton();
  const passwordLoginButton = findPasswordLoginButton();
  if (emailInput && emailNextButton && isEnabledControl(emailNextButton) && (!passwordInput || !passwordLoginButton)) {
    return 'email';
  }
  if (emailInput && passwordInput) return 'login_combined';
  if (passwordInput) return 'password';
  if (emailInput) return 'email';
  return '';
}

function refillPayPalEmailInput(emailInput, email) {
  if (!emailInput) return;
  if (typeof emailInput.focus === 'function') {
    emailInput.focus();
  }
  fillInput(emailInput, '');
  fillInput(emailInput, email);
  if (typeof emailInput.blur === 'function') {
    emailInput.blur();
  }
}

async function submitPayPalLogin(payload = {}) {
  const delayOperation = typeof performPayPalOperationWithDelay === 'function'
    ? performPayPalOperationWithDelay
    : async (metadata, operation) => {
        const rootScope = typeof window !== 'undefined' ? window : globalThis;
        const gate = rootScope?.CodexOperationDelay?.performOperationWithDelay;
        return typeof gate === 'function' ? gate(metadata, operation) : operation();
      };
  await waitForDocumentComplete();

  const email = normalizeText(payload.email || '');
  const password = String(payload.password || '');
  if (!password) {
    throw new Error('PayPal 密码为空，请先在侧边栏配置。');
  }

  let passwordInput = findPasswordInput();
  const emailInput = findEmailInput();
  const emailNextButton = findEmailNextButton();

  if (emailInput && emailNextButton && isEnabledControl(emailNextButton) && (!passwordInput || !findPasswordLoginButton())) {
    await delayOperation({ stepKey: 'paypal-approve', kind: 'submit', label: 'paypal-email' }, async () => {
      refillPayPalEmailInput(emailInput, email);
      simulateClick(emailNextButton);
    });
    return {
      submitted: false,
      phase: 'email_submitted',
      awaiting: 'password_page',
    };
  }

  if (!passwordInput && emailInput && email) {
    await delayOperation({ stepKey: 'paypal-approve', kind: 'submit', label: 'paypal-email' }, async () => {
      refillPayPalEmailInput(emailInput, email);
      const nextButton = await waitUntil(() => {
        const button = findEmailNextButton() || findLoginNextButton();
        return button && isEnabledControl(button) ? button : null;
      }, {
        intervalMs: 250,
        timeoutMs: 8000,
        timeoutMessage: 'PayPal email page did not expose a clickable next/continue button.',
      });
      simulateClick(nextButton);
    });
    return {
      submitted: false,
      phase: 'email_submitted',
      awaiting: 'password_page',
    };
  } else if (!passwordInput && emailInput && !email) {
    throw new Error('PayPal 账号为空，请先在侧边栏配置。');
  } else if (emailInput && email) {
    await delayOperation({ stepKey: 'paypal-approve', kind: 'fill', label: 'paypal-email' }, async () => {
      refillPayPalEmailInput(emailInput, email);
    });
  }

  passwordInput = passwordInput || await waitUntil(() => findPasswordInput(), {
    intervalMs: 250,
    timeoutMs: 8000,
    timeoutMessage: 'PayPal password page did not expose a password input.',
  });
  await delayOperation({ stepKey: 'paypal-approve', kind: 'submit', label: 'paypal-password' }, async () => {
    fillInput(passwordInput, password);
    await sleep(1000);

    const loginButton = await waitUntil(() => {
      const button = findClickableByText([
        /login|log\s*in|sign\s*in|continue/i,
        /登录|登入|继续/i,
      ]);
      return button && isEnabledControl(button) ? button : null;
    }, {
      intervalMs: 250,
      timeoutMs: 8000,
      timeoutMessage: 'PayPal password page did not expose a clickable login/continue button.',
    });

    simulateClick(loginButton);
  });
  return {
    submitted: true,
    phase: 'password_submitted',
    awaiting: 'redirect_or_approval',
  };
}

async function dismissPayPalPrompts() {
  const delayOperation = typeof performPayPalOperationWithDelay === 'function'
    ? performPayPalOperationWithDelay
    : async (metadata, operation) => {
        const rootScope = typeof window !== 'undefined' ? window : globalThis;
        const gate = rootScope?.CodexOperationDelay?.performOperationWithDelay;
        return typeof gate === 'function' ? gate(metadata, operation) : operation();
      };
  await waitForDocumentComplete();
  const buttons = findPasskeyPromptButtons();
  let clicked = 0;
  for (const button of buttons) {
    if (!isVisibleElement(button) || !isEnabledControl(button)) {
      continue;
    }
    await delayOperation({ stepKey: 'paypal-approve', kind: 'click', label: 'paypal-dismiss-prompt' }, async () => {
      simulateClick(button);
    });
    clicked += 1;
    await sleep(500);
  }
  return {
    clicked,
    hasPromptAfterClick: hasPasskeyPrompt(),
  };
}

async function clickPayPalApprove() {
  const delayOperation = typeof performPayPalOperationWithDelay === 'function'
    ? performPayPalOperationWithDelay
    : async (metadata, operation) => {
        const rootScope = typeof window !== 'undefined' ? window : globalThis;
        const gate = rootScope?.CodexOperationDelay?.performOperationWithDelay;
        return typeof gate === 'function' ? gate(metadata, operation) : operation();
      };
  await waitForDocumentComplete();
  await dismissPayPalPrompts().catch(() => ({ clicked: 0 }));

  const button = findApproveButton();
  if (!button || !isEnabledControl(button)) {
    return {
      clicked: false,
      state: inspectPayPalState(),
    };
  }

  await delayOperation({ stepKey: 'paypal-approve', kind: 'click', label: 'paypal-approve' }, async () => {
    simulateClick(button);
  });
  return {
    clicked: true,
    buttonText: getActionText(button),
  };
}

function inspectPayPalState() {
  const emailInput = findEmailInput();
  const passwordInput = findPasswordInput();
  const approveButton = findApproveButton();
  const loginPhase = getPayPalLoginPhase(emailInput, passwordInput);
  return {
    url: location.href,
    readyState: document.readyState,
    needsLogin: Boolean(loginPhase),
    loginPhase,
    hasEmailInput: Boolean(emailInput),
    hasPasswordInput: Boolean(passwordInput),
    approveReady: Boolean(approveButton && isEnabledControl(approveButton)),
    approveButtonText: approveButton ? getActionText(approveButton) : '',
    hasPasskeyPrompt: hasPasskeyPrompt(),
    bodyTextPreview: normalizeText(document.body?.innerText || '').slice(0, 240),
  };
}
