// flows/openai/content/plus-checkout.js — ChatGPT Plus checkout helper.

(function attachPlusCheckoutContentScript() {
console.log('[MultiPage:plus-checkout] Content script loaded on', location.href);
window.__MULTIPAGE_PLUS_CHECKOUT_READY__ = true;

const PLUS_CHECKOUT_LISTENER_SENTINEL = 'data-multipage-plus-checkout-listener';
const PLUS_CHECKOUT_PAYLOAD_BASE = {
  entry_point: 'all_plans_pricing_modal',
  plan_name: 'chatgptplusplan',
  checkout_ui_mode: 'custom',
  promo_campaign: {
    promo_campaign_id: 'plus-1-month-free',
    is_coupon_from_query_param: false,
  },
};
const PLUS_CHECKOUT_CONFIGS = {
  paypal: {
    billing_details: {
      country: 'DE',
      currency: 'EUR',
    },
    checkoutUrlPrefix: 'https://chatgpt.com/checkout/openai_ie/',
    paymentLabel: 'PayPal',
  },
  gopay: {
    billing_details: {
      country: 'ID',
      currency: 'IDR',
    },
    checkoutUrlPrefix: 'https://chatgpt.com/checkout/openai_llc/',
    paymentLabel: 'GoPay',
  },
};
const PAYPAL_DIAGNOSTIC_LOG_INTERVAL_MS = 5000;
const PLUS_PAYMENT_METHOD_PAYPAL = 'paypal';
const PLUS_PAYMENT_METHOD_PAYPAL_HOSTED = 'paypal-hosted';
const PLUS_PAYMENT_METHOD_GOPAY = 'gopay';
const PAYMENT_METHOD_CONFIGS = {
  [PLUS_PAYMENT_METHOD_PAYPAL]: {
    id: PLUS_PAYMENT_METHOD_PAYPAL,
    label: 'PayPal',
    diagnosticLabel: 'PayPal',
    checkoutMerchantPath: 'openai_ie',
    billingDetails: {
      country: 'DE',
      currency: 'EUR',
    },
    patterns: [/paypal/i],
  },
  [PLUS_PAYMENT_METHOD_PAYPAL_HOSTED]: {
    id: PLUS_PAYMENT_METHOD_PAYPAL_HOSTED,
    label: 'PayPal no-card direct bind',
    diagnosticLabel: 'PayPal hosted',
    checkoutMerchantPath: 'openai_llc',
    billingDetails: {
      country: 'US',
      currency: 'USD',
    },
    patterns: [/paypal/i],
  },
  [PLUS_PAYMENT_METHOD_GOPAY]: {
    id: PLUS_PAYMENT_METHOD_GOPAY,
    label: 'GoPay',
    diagnosticLabel: 'GoPay',
    checkoutMerchantPath: 'openai_llc',
    billingDetails: {
      country: 'ID',
      currency: 'IDR',
    },
    patterns: [/gopay|go\s*pay/i],
  },
};

async function performOperationWithDelay(metadata, operation) {
  const rootScope = typeof window !== 'undefined' ? window : globalThis;
  const gate = rootScope?.CodexOperationDelay?.performOperationWithDelay;
  return typeof gate === 'function' ? gate(metadata, operation) : operation();
}

if (document.documentElement.getAttribute(PLUS_CHECKOUT_LISTENER_SENTINEL) !== '1') {
  document.documentElement.setAttribute(PLUS_CHECKOUT_LISTENER_SENTINEL, '1');

  chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
    if (
      message.type === 'CREATE_PLUS_CHECKOUT'
      || message.type === 'FILL_PLUS_BILLING_AND_SUBMIT'
      || message.type === 'PLUS_CHECKOUT_SELECT_PAYPAL'
      || message.type === 'PLUS_CHECKOUT_SELECT_GOPAY'
      || message.type === 'PLUS_CHECKOUT_FILL_BILLING_ADDRESS'
      || message.type === 'PLUS_CHECKOUT_FILL_ADDRESS_QUERY'
      || message.type === 'PLUS_CHECKOUT_SELECT_ADDRESS_SUGGESTION'
      || message.type === 'PLUS_CHECKOUT_ENSURE_BILLING_ADDRESS'
      || message.type === 'PLUS_CHECKOUT_CLICK_SUBSCRIBE'
      || message.type === 'RUN_PAYPAL_HOSTED_OPENAI_CHECKOUT_STEP'
      || message.type === 'PLUS_CHECKOUT_GET_STATE'
    ) {
      resetStopState();
      handlePlusCheckoutCommand(message).then((result) => {
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
  console.log('[MultiPage:plus-checkout] message listener already exists, skipping duplicate registration');
}

async function handlePlusCheckoutCommand(message) {
  switch (message.type) {
    case 'CREATE_PLUS_CHECKOUT':
      return createPlusCheckoutSession(message.payload || {});
    case 'FILL_PLUS_BILLING_AND_SUBMIT':
      return fillPlusBillingAndSubmit(message.payload || {});
    case 'PLUS_CHECKOUT_SELECT_PAYPAL':
      return selectPlusPayPalPaymentMethod(message.payload || {});
    case 'PLUS_CHECKOUT_SELECT_GOPAY':
      return selectPlusGoPayPaymentMethod(message.payload || {});
    case 'PLUS_CHECKOUT_FILL_BILLING_ADDRESS':
      return fillPlusBillingAddress(message.payload || {});
    case 'PLUS_CHECKOUT_FILL_ADDRESS_QUERY':
      return fillPlusAddressQuery(message.payload || {});
    case 'PLUS_CHECKOUT_SELECT_ADDRESS_SUGGESTION':
      return selectPlusAddressSuggestion(message.payload || {});
    case 'PLUS_CHECKOUT_ENSURE_BILLING_ADDRESS':
      return ensurePlusStructuredBillingAddress(message.payload || {});
    case 'PLUS_CHECKOUT_CLICK_SUBSCRIBE':
      return clickPlusSubscribe(message.payload || {});
    case 'RUN_PAYPAL_HOSTED_OPENAI_CHECKOUT_STEP':
      return runPayPalHostedOpenAiCheckoutStep(message.payload || {});
    case 'PLUS_CHECKOUT_GET_STATE':
      return inspectPlusCheckoutState(message.payload || {});
    default:
      throw new Error(`plus-checkout.js does not handle message: ${message.type}`);
  }
}

async function waitUntil(predicate, options = {}) {
  const intervalMs = Math.max(50, Math.floor(Number(options.intervalMs) || 250));
  const label = String(options.label || 'Condition').trim() || 'Condition';
  const timeoutMs = Math.max(0, Math.floor(Number(options.timeoutMs) || 0));
  const startedAt = Date.now();
  while (true) {
    throwIfStopped();
    const value = await predicate();
    if (value) {
      return value;
    }
    if (timeoutMs > 0 && Date.now() - startedAt >= timeoutMs) {
      throw new Error(`${label} timed out`);
    }
    await sleep(intervalMs);
  }
}

async function waitForDocumentComplete() {
  await waitUntil(() => document.readyState === 'complete', {
    label: 'Page load complete',
    intervalMs: 200,
  });
  await sleep(1000);
}

function isPayPalHostedOpenAiCheckoutPage() {
  const host = String(location?.host || '').toLowerCase();
  return host.includes('pay.openai.com') || host.includes('checkout.stripe.com');
}

function hideHostedAddressAutocomplete() {
  [
    '.AddressAutocomplete-results',
    '[class*="AddressAutocomplete"]',
    '#billing-address-autocomplete-results',
  ].forEach((selector) => {
    document.querySelectorAll(selector).forEach((node) => {
      try {
        node.style.setProperty('display', 'none', 'important');
        node.style.setProperty('visibility', 'hidden', 'important');
        node.style.setProperty('pointer-events', 'none', 'important');
      } catch {
        // Best effort only; checkout still works without this cleanup.
      }
    });
  });
}

function hasHostedOpenAiVerificationDialog() {
  return Boolean(document.getElementById('ci-ciBasic-0'));
}

function fillHostedInput(selector, value) {
  const input = document.querySelector(selector);
  if (!input) {
    return false;
  }
  fillInput(input, String(value || ''));
  return true;
}

function selectHostedOptionByText(selector, value) {
  const select = document.querySelector(selector);
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

function findHostedPayPalButton() {
  return document.querySelector('[data-testid="paypal-accordion-item-button"]')
    || document.querySelector('.paypal-accordion-item button')
    || findClickableByText([/paypal/i]);
}

function findHostedSubmitButton() {
  return document.querySelector('button[data-testid="submit-button"]')
    || document.querySelector('button[data-testid="hosted-payment-submit-button"]')
    || document.querySelector('button[data-atomic-wait-intent="Submit_Email"]')
    || document.querySelector('button.SubmitButton--complete')
    || findClickableByText([
      /next|continue|pay|subscribe|agree/i,
      /下一页|继续|支付|Subscribe|同意/i,
    ]);
}

async function clickHostedSubmitButton() {
  const button = await waitUntil(() => {
    hideHostedAddressAutocomplete();
    const candidate = findHostedSubmitButton();
    return candidate && isEnabledControl(candidate) && isVisibleElement(candidate) ? candidate : null;
  }, {
    label: 'Hosted checkout submit button',
    intervalMs: 500,
    timeoutMs: 15000,
  });
  document.activeElement?.blur?.();
  await sleep(300);
  const buttonTextBeforeClick = getActionText(button) || 'Subscribe';
  log(`Plus Checkout: Preparing to click "${buttonTextBeforeClick}" to submit OpenAI Checkout.`);
  simulateClick(button);
  await sleep(300);
  const buttonTextAfterClick = getActionText(button);
  if (buttonTextAfterClick && SUBSCRIBE_PROCESSING_TEXT_PATTERN.test(buttonTextAfterClick)) {
    log(`Plus Checkout: Clicked "${buttonTextBeforeClick}", button entered "${buttonTextAfterClick}", waiting for PayPal redirect.`);
  } else {
    log(`Plus Checkout: Clicked "${buttonTextBeforeClick}", waiting for PayPal redirect.`);
  }
  await sleep(900);
  return {
    clicked: true,
    buttonText: getActionText(button),
    buttonTextBeforeClick,
    buttonTextAfterClick,
    hostedVerificationVisible: hasHostedOpenAiVerificationDialog(),
  };
}

function fillHostedOpenAiVerificationCode(verificationCode = '') {
  const code = String(verificationCode || '').replace(/\D+/g, '').slice(0, 6);
  if (code.length !== 6) {
    throw new Error('Hosted checkout OpenAI verification code is invalid.');
  }
  for (let index = 0; index < 6; index += 1) {
    const input = document.getElementById(`ci-ciBasic-${index}`);
    if (!input) {
      throw new Error('Hosted checkout OpenAI page did not find a complete verification code input.');
    }
    fillInput(input, code[index]);
  }
  return {
    verificationCodeFilled: true,
    hostedVerificationVisible: true,
  };
}

async function runPayPalHostedOpenAiCheckoutStep(payload = {}) {
  await waitForDocumentComplete();
  if (!isPayPalHostedOpenAiCheckoutPage()) {
    throw new Error('The current page is not the OpenAI hosted checkout page for PayPal no-card direct bind.');
  }
  if (payload.verificationCode) {
    return fillHostedOpenAiVerificationCode(payload.verificationCode);
  }

  hideHostedAddressAutocomplete();
  const payPalButton = findHostedPayPalButton();
  if (payPalButton) {
    simulateClick(payPalButton);
    await sleep(500);
  }

  const address = payload.address && typeof payload.address === 'object' ? payload.address : {};
  fillHostedInput('#billingAddressLine1', address.street || address.address1 || '');
  fillHostedInput('#billingLocality', address.city || '');
  fillHostedInput('#billingPostalCode', address.zip || address.postalCode || '');
  selectHostedOptionByText('#billingAdministrativeArea', address.state || address.region || '');

  const consent = document.getElementById('termsOfServiceConsentCheckbox');
  if (consent && !consent.checked) {
    simulateClick(consent);
  }

  for (let count = 0; count < 5; count += 1) {
    hideHostedAddressAutocomplete();
    await sleep(250);
  }

  return clickHostedSubmitButton();
}

function isVisibleElement(el) {
  if (!el) return false;
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

function parseLocalizedAmount(rawValue = '') {
  const raw = normalizeText(rawValue);
  const match = raw.match(/(?:[$€£¥]\s*)?([+-]?\d{1,3}(?:[.,]\d{3})*(?:[.,]\d{1,2})|[+-]?\d+(?:[.,]\d{1,2})?)(?:\s*[$€£¥])?/);
  if (!match) return null;
  let numericText = String(match[1] || '').trim();
  const lastComma = numericText.lastIndexOf(',');
  const lastDot = numericText.lastIndexOf('.');
  if (lastComma > -1 && lastDot > -1) {
    const decimalSeparator = lastComma > lastDot ? ',' : '.';
    const thousandsSeparator = decimalSeparator === ',' ? '.' : ',';
    numericText = numericText
      .replace(new RegExp(`\\${thousandsSeparator}`, 'g'), '')
      .replace(decimalSeparator, '.');
  } else if (lastComma > -1) {
    numericText = numericText.replace(',', '.');
  }
  const amount = Number(numericText.replace(/[^\d.+-]/g, ''));
  return Number.isFinite(amount)
    ? {
        amount,
        raw: match[0],
      }
    : null;
}

function getTextAfterTodayDueLabel(text = '') {
  const normalized = normalizeText(text);
  const match = normalized.match(/(?:今日应付金额|今日应付|今天应付|amount\s*due\s*today|due\s*today|today'?s\s*total|total\s*due\s*today)/i);
  if (!match) return '';
  return normalized.slice((match.index || 0) + match[0].length).trim();
}

function getCheckoutAmountSummary() {
  const elements = getVisibleControls('div, span, p, strong, b');
  const labelPattern = /今日应付金额|今日应付|今天应付|amount\s*due\s*today|due\s*today|today'?s\s*total|total\s*due\s*today/i;
  const amountPattern = /[$€£¥]\s*[+-]?\d|[+-]?\d+(?:[.,]\d{1,2})?\s*[$€£¥]/;

  for (const element of elements) {
    const text = normalizeText(element.innerText || element.textContent || '');
    if (!labelPattern.test(text)) continue;

    const candidates = [];
    const afterLabelText = getTextAfterTodayDueLabel(text);
    if (afterLabelText) candidates.push(afterLabelText);

    const parent = element.parentElement;
    if (parent) {
      for (const child of Array.from(parent.children || [])) {
        if (child === element) continue;
        const childText = normalizeText(child.innerText || child.textContent || '');
        if (amountPattern.test(childText)) {
          candidates.push(childText);
        }
      }
      const parentAfterLabelText = getTextAfterTodayDueLabel(parent.innerText || parent.textContent || '');
      if (parentAfterLabelText) candidates.push(parentAfterLabelText);
    }

    const grandparent = parent?.parentElement;
    if (grandparent) {
      const grandparentAfterLabelText = getTextAfterTodayDueLabel(grandparent.innerText || grandparent.textContent || '');
      if (grandparentAfterLabelText) candidates.push(grandparentAfterLabelText);
    }

    for (const candidate of candidates) {
      const parsed = parseLocalizedAmount(candidate);
      if (!parsed) continue;
      return {
        hasTodayDue: true,
        amount: parsed.amount,
        isZero: Math.abs(parsed.amount) < 0.005,
        rawAmount: parsed.raw,
        labelText: text.slice(0, 160),
      };
    }

    return {
      hasTodayDue: true,
      amount: null,
      isZero: false,
      rawAmount: '',
      labelText: text.slice(0, 160),
    };
  }

  return {
    hasTodayDue: false,
    amount: null,
    isZero: false,
    rawAmount: '',
    labelText: '',
  };
}

function getActionText(el) {
  return normalizeText([
    el?.textContent,
    el?.value,
    el?.getAttribute?.('aria-label'),
    el?.getAttribute?.('aria-labelledby'),
    el?.getAttribute?.('title'),
    el?.getAttribute?.('placeholder'),
    el?.getAttribute?.('name'),
    el?.getAttribute?.('autocomplete'),
    el?.getAttribute?.('data-elements-stable-field-name'),
    el?.getAttribute?.('data-field'),
    el?.getAttribute?.('data-field-name'),
    el?.id,
  ].filter(Boolean).join(' '));
}

function getSearchText(el) {
  const datasetValues = el?.dataset ? Object.values(el.dataset) : [];
  return normalizeText([
    getActionText(el),
    el?.getAttribute?.('alt'),
    el?.getAttribute?.('role'),
    el?.getAttribute?.('data-testid'),
    el?.getAttribute?.('src'),
    el?.getAttribute?.('href'),
    el?.getAttribute?.('xlink:href'),
    typeof el?.className === 'string' ? el.className : el?.getAttribute?.('class'),
    ...datasetValues,
  ].filter(Boolean).join(' '));
}

function getFieldText(el) {
  const id = el?.id || '';
  const labels = [];
  if (id) {
    labels.push(...Array.from(document.querySelectorAll(`label[for="${CSS.escape(id)}"]`)).map((label) => label.textContent));
  }
  const wrappingLabel = el?.closest?.('label');
  if (wrappingLabel) {
    labels.push(wrappingLabel.textContent);
  }
  const container = el?.closest?.('[data-testid], [class], div, section, fieldset');
  if (container) {
    labels.push(container.textContent);
  }
  return normalizeText([
    getActionText(el),
    ...labels,
  ].filter(Boolean).join(' '));
}

function getCombinedSearchText(el) {
  return normalizeText([
    getSearchText(el),
    getFieldText(el),
  ].filter(Boolean).join(' '));
}

function getVisibleControls(selector) {
  return Array.from(document.querySelectorAll(selector)).filter(isVisibleElement);
}

function findClickableByText(patterns) {
  const normalizedPatterns = (Array.isArray(patterns) ? patterns : [patterns])
    .filter(Boolean);
  const candidates = getVisibleControls('button, a, [role="button"], [role="tab"], input[type="button"], input[type="submit"], [tabindex]');
  return candidates.find((el) => {
    const text = getCombinedSearchText(el);
    return normalizedPatterns.some((pattern) => pattern.test(text));
  }) || null;
}

function isEnabledControl(el) {
  return Boolean(el)
    && !el.disabled
    && el.getAttribute?.('aria-disabled') !== 'true';
}

function getVisibleTextInputs() {
  return getVisibleControls('input, textarea')
    .filter((el) => {
      const type = String(el.getAttribute('type') || el.type || '').trim().toLowerCase();
      return !['hidden', 'checkbox', 'radio', 'submit', 'button', 'file'].includes(type);
    });
}

function findInputByFieldText(patterns, options = {}) {
  const inputs = getVisibleTextInputs();
  const excluded = options.exclude || (() => false);
  return inputs.find((input) => {
    if (excluded(input)) return false;
    const text = getFieldText(input);
    return patterns.some((pattern) => pattern.test(text));
  }) || null;
}

function getDirectFieldHintText(el) {
  const id = el?.id || '';
  const labels = [];
  if (id) {
    labels.push(...Array.from(document.querySelectorAll(`label[for="${CSS.escape(id)}"]`)).map((label) => label.textContent));
  }
  const wrappingLabel = el?.closest?.('label');
  if (wrappingLabel) {
    labels.push(wrappingLabel.textContent);
  }
  return normalizeText([
    getActionText(el),
    ...labels,
  ].filter(Boolean).join(' '));
}

function isNonAddressSearchInput(input) {
  const directText = getDirectFieldHintText(input);
  const type = String(input?.getAttribute?.('type') || input?.type || '').trim().toLowerCase();
  return /name|email|e-mail|phone|tel|password|coupon|promo|country|region|postal|zip|city|state|province|card|card\s*number|expiry|expiration|security|cvc|cvv|cc-/i.test(directText)
    || ['email', 'tel', 'password'].includes(type);
}

function isDocumentLevelContainer(el) {
  return !el
    || el === document.documentElement
    || el === document.body
    || ['HTML', 'BODY', 'MAIN'].includes(el.tagName);
}

function isPaymentCardSized(el) {
  if (!isVisibleElement(el) || isDocumentLevelContainer(el)) return false;
  const rect = el.getBoundingClientRect();
  const maxWidth = Math.max(320, Math.min(window.innerWidth * 0.95, 900));
  const maxHeight = Math.max(140, Math.min(window.innerHeight * 0.45, 320));
  return rect.width >= 64
    && rect.height >= 28
    && rect.width <= maxWidth
    && rect.height <= maxHeight;
}

function findInteractiveAncestor(el) {
  let current = el;
  for (let depth = 0; current && depth < 8; depth += 1, current = current.parentElement) {
    if (!isVisibleElement(current) || isDocumentLevelContainer(current)) continue;
    if (current.matches?.('button, a, label, [role="button"], [role="radio"], [role="tab"], input[type="radio"], [tabindex]')) {
      return current;
    }
  }
  return null;
}

function findPaymentCardAncestor(el, pattern) {
  let current = el;
  for (let depth = 0; current && depth < 8; depth += 1, current = current.parentElement) {
    if (!isVisibleElement(current)) continue;
    if (isDocumentLevelContainer(current)) break;
    const text = getSearchText(current);
    if (pattern.test(text) && isPaymentCardSized(current)) {
      return current;
    }
  }
  return null;
}

function normalizePlusPaymentMethod(value = '') {
  const normalized = String(value || '').trim().toLowerCase();
  const paypalHostedValue = typeof PLUS_PAYMENT_METHOD_PAYPAL_HOSTED !== 'undefined'
    ? PLUS_PAYMENT_METHOD_PAYPAL_HOSTED
    : 'paypal-hosted';
  if (normalized === paypalHostedValue || normalized === 'paypal_direct' || normalized === 'paypal-direct') {
    return paypalHostedValue;
  }
  return normalized === PLUS_PAYMENT_METHOD_GOPAY
    ? PLUS_PAYMENT_METHOD_GOPAY
    : PLUS_PAYMENT_METHOD_PAYPAL;
}

function getPaymentMethodConfig(method = PLUS_PAYMENT_METHOD_PAYPAL) {
  return PAYMENT_METHOD_CONFIGS[normalizePlusPaymentMethod(method)] || PAYMENT_METHOD_CONFIGS[PLUS_PAYMENT_METHOD_PAYPAL];
}

function getAncestorChainSummary(el, limit = 6) {
  const chain = [];
  let current = el;
  for (let depth = 0; current && depth < limit; depth += 1, current = current.parentElement) {
    if (isDocumentLevelContainer(current)) break;
    const rect = current.getBoundingClientRect();
    chain.push({
      tag: String(current.tagName || '').toLowerCase(),
      role: current.getAttribute?.('role') || '',
      id: current.id || '',
      className: typeof current.className === 'string' ? current.className.slice(0, 120) : '',
      testId: current.getAttribute?.('data-testid') || '',
      ariaLabel: current.getAttribute?.('aria-label') || '',
      ariaChecked: current.getAttribute?.('aria-checked') || '',
      ariaSelected: current.getAttribute?.('aria-selected') || '',
      rect: `${Math.round(rect.width)}x${Math.round(rect.height)}`,
      text: getCombinedSearchText(current).slice(0, 180),
    });
  }
  return chain;
}

function getPaymentMethodSearchCandidates(method = PLUS_PAYMENT_METHOD_PAYPAL) {
  const config = getPaymentMethodConfig(method);
  const selector = [
    'button',
    'a',
    'label',
    '[role="button"]',
    '[role="radio"]',
    '[role="tab"]',
    'input[type="radio"]',
    '[tabindex]',
    '[data-testid]',
    '[aria-label]',
    '[title]',
    'img',
    'svg',
    'span',
    'div',
  ].join(', ');

  return getVisibleControls(selector)
    .filter((el) => {
      const text = getCombinedSearchText(el);
      return config.patterns.some((pattern) => pattern.test(text));
    })
    .sort((left, right) => {
      const leftRect = left.getBoundingClientRect();
      const rightRect = right.getBoundingClientRect();
      return (leftRect.width * leftRect.height) - (rightRect.width * rightRect.height);
    });
}

function getPayPalSearchCandidates() {
  return getPaymentMethodSearchCandidates(PLUS_PAYMENT_METHOD_PAYPAL);
}

function getGoPaySearchCandidates() {
  return getPaymentMethodSearchCandidates(PLUS_PAYMENT_METHOD_GOPAY);
}

function findPaymentMethodTarget(method = PLUS_PAYMENT_METHOD_PAYPAL) {
  const config = getPaymentMethodConfig(method);
  const directClickable = findClickableByText(config.patterns);
  if (directClickable) {
    return directClickable;
  }

  const radios = getVisibleControls('input[type="radio"], [role="radio"]');
  const matchedRadio = radios.find((el) => config.patterns.some((pattern) => pattern.test(getCombinedSearchText(el))));
  if (matchedRadio) {
    return matchedRadio;
  }

  const candidates = getPaymentMethodSearchCandidates(method);
  for (const candidate of candidates) {
    const interactive = findInteractiveAncestor(candidate);
    if (interactive && config.patterns.some((pattern) => pattern.test(getCombinedSearchText(interactive)))) {
      return interactive;
    }
    const card = config.patterns
      .map((pattern) => findPaymentCardAncestor(candidate, pattern))
      .find(Boolean);
    if (card) {
      return card;
    }
  }

  return null;
}

function findPayPalPaymentMethodTarget() {
  return findPaymentMethodTarget(PLUS_PAYMENT_METHOD_PAYPAL);
}

function findGoPayPaymentMethodTarget() {
  return findPaymentMethodTarget(PLUS_PAYMENT_METHOD_GOPAY);
}

function summarizeElementForDebug(el) {
  if (!el) return null;
  const rect = el.getBoundingClientRect();
  return {
    tag: String(el.tagName || '').toLowerCase(),
    role: el.getAttribute?.('role') || '',
    text: getSearchText(el).slice(0, 160),
    rect: `${Math.round(rect.width)}x${Math.round(rect.height)}`,
    chain: getAncestorChainSummary(el, 3),
  };
}

function getPaymentMethodCandidateSummaries(method = PLUS_PAYMENT_METHOD_PAYPAL, limit = 6) {
  return getPaymentMethodSearchCandidates(method)
    .map(summarizeElementForDebug)
    .filter(Boolean)
    .slice(0, limit);
}

function getPayPalCandidateSummaries(limit = 6) {
  return getPaymentMethodCandidateSummaries(PLUS_PAYMENT_METHOD_PAYPAL, limit);
}

function getGoPayCandidateSummaries(limit = 6) {
  return getPaymentMethodCandidateSummaries(PLUS_PAYMENT_METHOD_GOPAY, limit);
}

function getPaymentTextPreview(limit = 10) {
  const seen = new Set();
  const pattern = /gopay|go\s*pay|paypal|card|payment|billing|subscribe|pay|银行卡|付款|支付|账单|Subscribe/i;
  return getVisibleControls('button, a, label, [role="button"], [role="radio"], input[type="radio"], input[type="button"], input[type="submit"], [data-testid]')
    .map((el) => getCombinedSearchText(el))
    .filter((text) => text && pattern.test(text))
    .map((text) => text.slice(0, 180))
    .filter((text) => {
      if (seen.has(text)) return false;
      seen.add(text);
      return true;
    })
    .slice(0, limit);
}

function getPayPalDiagnostics(reason = '') {
  return getPaymentMethodDiagnostics(PLUS_PAYMENT_METHOD_PAYPAL, reason);
}

function getGoPayDiagnostics(reason = '') {
  return getPaymentMethodDiagnostics(PLUS_PAYMENT_METHOD_GOPAY, reason);
}

function getPaymentMethodDiagnostics(method = PLUS_PAYMENT_METHOD_PAYPAL, reason = '') {
  const config = getPaymentMethodConfig(method);
  return {
    reason,
    url: location.href,
    readyState: document.readyState,
    paymentMethod: config.id,
    paymentMethodLabel: config.label,
    paymentCandidates: getPaymentMethodCandidateSummaries(config.id),
    paypalCandidates: getPayPalCandidateSummaries(),
    gopayCandidates: getGoPayCandidateSummaries(),
    paymentTextPreview: getPaymentTextPreview(),
    cardFieldsVisible: hasCreditCardFields(),
    billingFieldsVisible: hasBillingAddressFields(),
  };
}

function writePaymentMethodDiagnostics(method = PLUS_PAYMENT_METHOD_PAYPAL, reason = '', level = 'info') {
  const config = getPaymentMethodConfig(method);
  const diagnostics = getPaymentMethodDiagnostics(config.id, reason);
  const writer = typeof console[level] === 'function' ? console[level] : console.info;
  writer.call(console, `[MultiPage:plus-checkout] ${config.diagnosticLabel} diagnostics`, diagnostics);
  log(`Plus Checkout: ${reason}. ${config.label} candidates: ${diagnostics.paymentCandidates.length}. Card fields ${diagnostics.cardFieldsVisible ? 'still visible' : 'not visible'}.`, level === 'error' ? 'error' : 'warn');
  return diagnostics;
}

function writePayPalDiagnostics(reason, level = 'info') {
  return writePaymentMethodDiagnostics(PLUS_PAYMENT_METHOD_PAYPAL, reason, level);
}

function writeGoPayDiagnostics(reason, level = 'info') {
  return writePaymentMethodDiagnostics(PLUS_PAYMENT_METHOD_GOPAY, reason, level);
}

function buildPlusCheckoutPayload(paymentMethod = PLUS_PAYMENT_METHOD_PAYPAL) {
  const config = getPaymentMethodConfig(paymentMethod);
  return {
    ...JSON.parse(JSON.stringify(PLUS_CHECKOUT_PAYLOAD_BASE)),
    checkout_ui_mode: config.id === PLUS_PAYMENT_METHOD_PAYPAL_HOSTED ? 'hosted' : 'custom',
    billing_details: {
      ...config.billingDetails,
    },
  };
}

function buildPlusCheckoutUrl(checkoutSessionId, paymentMethod = PLUS_PAYMENT_METHOD_PAYPAL) {
  const sessionId = String(checkoutSessionId || '').trim();
  if (!sessionId) {
    throw new Error('Failed to create Plus Checkout: checkout_session_id was not returned.');
  }
  const config = getPaymentMethodConfig(paymentMethod);
  return `https://chatgpt.com/checkout/${config.checkoutMerchantPath}/${sessionId}`;
}

function findHostedCheckoutUrl(payload = {}) {
  const queue = [payload];
  while (queue.length) {
    const current = queue.shift();
    if (!current || typeof current !== 'object') {
      continue;
    }
    if (Array.isArray(current)) {
      queue.push(...current);
      continue;
    }
    for (const value of Object.values(current)) {
      if (typeof value === 'string' && /^https:\/\/(?:pay\.openai\.com|checkout\.stripe\.com)\/c\/pay\//i.test(value.trim())) {
        return value.trim();
      }
      if (value && typeof value === 'object') {
        queue.push(value);
      }
    }
  }
  return '';
}

async function createPlusCheckoutSession(options = {}) {
  await waitForDocumentComplete();
  log('Plus: Reading ChatGPT login session...');

  const sessionResponse = await fetch('/api/auth/session', {
    credentials: 'include',
  });
  const session = await sessionResponse.json().catch(() => ({}));
  const accessToken = session?.accessToken;
  if (!accessToken) {
    throw new Error('Please log in to ChatGPT first. The current page did not return a usable accessToken.');
  }

  log('Plus: Creating checkout session...');
  const paymentMethod = normalizePlusPaymentMethod(options.paymentMethod);
  const checkoutPayload = buildPlusCheckoutPayload(paymentMethod);
  const response = await fetch('https://chatgpt.com/backend-api/payments/checkout', {
    method: 'POST',
    credentials: 'include',
    headers: {
      Authorization: `Bearer ${accessToken}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify(checkoutPayload),
  });

  const data = await response.json().catch(() => ({}));
  if (!response.ok || !data?.checkout_session_id) {
    const detail = data?.detail || data?.message || `HTTP ${response.status}`;
    throw new Error(`Failed to create Plus Checkout: ${detail}`);
  }

  const checkoutUrl = buildPlusCheckoutUrl(data.checkout_session_id, paymentMethod);
  const hostedCheckoutUrl = findHostedCheckoutUrl(data);
  const preferredCheckoutUrl = paymentMethod === PLUS_PAYMENT_METHOD_PAYPAL_HOSTED
    ? (hostedCheckoutUrl || checkoutUrl)
    : checkoutUrl;

  return {
    checkoutUrl,
    hostedCheckoutUrl,
    preferredCheckoutUrl,
    country: checkoutPayload.billing_details.country,
    currency: checkoutPayload.billing_details.currency,
  };
}

async function selectPaymentMethod(method = PLUS_PAYMENT_METHOD_PAYPAL) {
  const config = getPaymentMethodConfig(method);
  let lastDiagnosticsAt = 0;
  const target = await waitUntil(() => {
    const currentTarget = findPaymentMethodTarget(config.id);
    if (currentTarget) {
      return currentTarget;
    }

    const now = Date.now();
    if (!lastDiagnosticsAt || now - lastDiagnosticsAt >= PAYPAL_DIAGNOSTIC_LOG_INTERVAL_MS) {
      lastDiagnosticsAt = now;
      writePaymentMethodDiagnostics(config.id, `Waiting for a clickable ${config.label} payment method`, 'warn');
    }
    return null;
  }, {
    label: `${config.label} payment method`,
    intervalMs: 250,
  });
  console.info(`[MultiPage:plus-checkout] ${config.label} target selected`, summarizeElementForDebug(target));
  await performOperationWithDelay({ stepKey: 'plus-checkout-billing', kind: 'select', label: 'select-payment-method' }, async () => {
    simulateClick(target);
  });
  log(`Plus Checkout: Clicked ${config.label} payment method. Confirming selected state.`);

  if (!await waitForPaymentMethodActive(config.id)) {
    const diagnostics = writePaymentMethodDiagnostics(config.id, `After clicking ${config.label}, the page still did not enter the ${config.label} billing form`, 'error');
    throw new Error(`Plus Checkout: Tried clicking ${config.label}, but the page did not switch to the ${config.label} form. Please provide the console ${config.label} diagnostics structure. Candidate count: ${diagnostics.paymentCandidates.length}, card fields still visible: ${diagnostics.cardFieldsVisible ? 'Yes' : 'No'}.`);
  }

  log(`Plus Checkout: Confirmed ${config.label} payment method is active.`);
  return true;
}

async function selectPayPalPaymentMethod() {
  return selectPaymentMethod(PLUS_PAYMENT_METHOD_PAYPAL);
}

async function selectGoPayPaymentMethod() {
  return selectPaymentMethod(PLUS_PAYMENT_METHOD_GOPAY);
}

async function selectPlusPayPalPaymentMethod() {
  await waitForDocumentComplete();
  await selectPaymentMethod(PLUS_PAYMENT_METHOD_PAYPAL);
  return {
    paymentSelected: true,
    paymentMethod: PLUS_PAYMENT_METHOD_PAYPAL,
  };
}

async function selectPlusGoPayPaymentMethod() {
  await waitForDocumentComplete();
  await selectPaymentMethod(PLUS_PAYMENT_METHOD_GOPAY);
  return {
    paymentSelected: true,
    paymentMethod: PLUS_PAYMENT_METHOD_GOPAY,
  };
}

async function fillFullName(fullName) {
  const value = normalizeText(fullName);
  if (!value) return false;
  const input = findInputByFieldText([
    /full\s*name|name\s*on|cardholder|billing\s*name/i,
    /姓名|全名|持卡人/i,
  ]);
  if (!input) {
    return false;
  }
  fillInput(input, value);
  await sleep(300);
  return true;
}

function readCountryText() {
  const countryInput = findInputByFieldText([
    /country|region/i,
    /国家|地区/i,
  ]);
  if (countryInput?.value) {
    return countryInput.value;
  }
  const countrySelect = getVisibleControls('select').find((select) => /country|region|国家|地区/i.test(getFieldText(select)));
  if (countrySelect) {
    const option = countrySelect.selectedOptions?.[0];
    return option?.textContent || countrySelect.value || '';
  }
  const countryDropdown = findCountryDropdown();
  if (countryDropdown) {
    return getCountryDropdownValue(countryDropdown);
  }
  return '';
}

function isLikelyAddressSearchInput(input) {
  const text = getFieldText(input);
  if (isNonAddressSearchInput(input)) {
    return false;
  }
  if (/name|email|e-mail|phone|tel|password|coupon|promo|country|region|postal|zip|city|state|province|card|card\s*number|expiry|expiration|security|cvc|cvv|cc-|全名|姓名|邮箱|电话|密码|国家|地区|Postal code|City|省|州|银行卡|卡号|有效期|安全码/i.test(text)) {
    return false;
  }
  if (/address|street|billing|search|line\s*1|地址|街道|账单/i.test(text)) {
    return true;
  }
  return false;
}

function hasCreditCardFields() {
  return getVisibleTextInputs().some((input) => {
    const text = getFieldText(input);
    return /card\s*number|card|expiry|expiration|security\s*code|cvc|cvv|银行卡|卡号|有效期|安全码/i.test(text);
  });
}

function hasBillingAddressFields() {
  return getVisibleTextInputs().some((input) => {
    const text = getFieldText(input);
    return /address|street|billing|line\s*1|地址|街道|账单/i.test(text)
      && !/card\s*number|card|expiry|expiration|security|cvc|cvv|银行卡|卡号|有效期|安全码/i.test(text);
  });
}

function hasPaymentMethodSelectionMarker(el) {
  if (!el) return false;
  const className = typeof el.className === 'string' ? el.className : el.getAttribute?.('class') || '';
  return el.checked === true
    || el.getAttribute?.('aria-checked') === 'true'
    || el.getAttribute?.('aria-selected') === 'true'
    || el.getAttribute?.('data-state') === 'checked'
    || el.getAttribute?.('data-selected') === 'true'
    || /\b(selected|checked|active)\b/i.test(className);
}

function hasSelectedPaymentMethodControl(method = PLUS_PAYMENT_METHOD_PAYPAL) {
  const config = getPaymentMethodConfig(method);
  const candidates = getPaymentMethodSearchCandidates(config.id);
  return candidates.some((candidate) => {
    let current = candidate;
    for (let depth = 0; current && depth < 6; depth += 1, current = current.parentElement) {
      if (isDocumentLevelContainer(current)) break;
      const currentMatchesPayment = config.patterns.some((pattern) => pattern.test(getCombinedSearchText(current)));
      if (currentMatchesPayment && hasPaymentMethodSelectionMarker(current)) {
        return true;
      }

      const radio = current.querySelector?.('input[type="radio"], [role="radio"]');
      if (
        radio
        && config.patterns.some((pattern) => pattern.test(getCombinedSearchText(current) || getCombinedSearchText(radio)))
        && hasPaymentMethodSelectionMarker(radio)
      ) {
        return true;
      }
    }
    return false;
  });
}

function hasSelectedPayPalControl() {
  return hasSelectedPaymentMethodControl(PLUS_PAYMENT_METHOD_PAYPAL);
}

function hasSelectedGoPayControl() {
  return hasSelectedPaymentMethodControl(PLUS_PAYMENT_METHOD_GOPAY);
}

function isPaymentMethodActive(method = PLUS_PAYMENT_METHOD_PAYPAL) {
  return hasSelectedPaymentMethodControl(method);
}

function isPayPalPaymentMethodActive() {
  return isPaymentMethodActive(PLUS_PAYMENT_METHOD_PAYPAL);
}

function isGoPayPaymentMethodActive() {
  return isPaymentMethodActive(PLUS_PAYMENT_METHOD_GOPAY);
}

async function waitForPaymentMethodActive(method = PLUS_PAYMENT_METHOD_PAYPAL, timeoutMs = 5000) {
  const startedAt = Date.now();
  while (Date.now() - startedAt < timeoutMs) {
    throwIfStopped();
    if (isPaymentMethodActive(method)) {
      return true;
    }
    await sleep(250);
  }
  return false;
}

async function waitForPayPalPaymentMethodActive(timeoutMs = 5000) {
  return waitForPaymentMethodActive(PLUS_PAYMENT_METHOD_PAYPAL, timeoutMs);
}

async function findAddressSearchInput() {
  return waitUntil(() => {
    const direct = findInputByFieldText([
      /address|street|billing|search|line\s*1/i,
      /地址|街道|账单/i,
    ], {
      exclude: (input) => /city|state|province|postal|zip|country|City|省|州|Postal code|国家|地区/i.test(getFieldText(input)),
    });
    if (direct && !isNonAddressSearchInput(direct)) return direct;
    const candidates = getVisibleTextInputs().filter(isLikelyAddressSearchInput);
    return candidates[0] || null;
  }, {
    label: 'Address search input',
    intervalMs: 250,
  });
}

function getAddressSuggestions() {
  const selectors = [
    '[role="listbox"] [role="option"]',
    '[role="option"]',
    '.pac-container .pac-item',
    '[data-testid*="address" i] [role="option"]',
    'li',
  ];
  const seen = new Set();
  const results = [];
  for (const selector of selectors) {
    for (const el of Array.from(document.querySelectorAll(selector))) {
      if (!isVisibleElement(el)) continue;
      const text = normalizeText(el.textContent || el.getAttribute?.('aria-label') || '');
      if (!text || text.length < 3) continue;
      const key = `${selector}:${text}`;
      if (seen.has(key)) continue;
      seen.add(key);
      results.push(el);
    }
  }
  return results;
}

async function selectAddressSuggestion(seed) {
  await fillAddressQuery(seed);
  return clickAddressSuggestion(seed);
}

async function clickAddressSuggestion(seed = {}) {
  const suggestions = await waitUntil(() => {
    const options = getAddressSuggestions();
    return options.length ? options : null;
  }, {
    label: 'Address suggestion list',
    intervalMs: 250,
    timeoutMs: 6000,
  });

  const suggestionIndex = Math.max(0, Math.min(
    suggestions.length - 1,
    Math.floor(Number(seed.suggestionIndex) || 0)
  ));
  const target = suggestions[suggestionIndex] || suggestions[0];
  simulateClick(target);
  await sleep(1200);
  return {
    selectedText: normalizeText(target.textContent || ''),
    suggestionIndex,
  };
}

async function fillAddressQuery(seed = {}) {
  const addressInput = await findAddressSearchInput();
  fillInput(addressInput, seed.query || 'Berlin Mitte');
  await sleep(800);
  return {
    filled: true,
  };
}

function getRegionCandidates(value) {
  const raw = normalizeText(value);
  if (!raw) return [];
  const aliases = {
    act: 'Australian Capital Territory',
    nsw: 'New South Wales',
    nt: 'Northern Territory',
    qld: 'Queensland',
    sa: 'South Australia',
    tas: 'Tasmania',
    vic: 'Victoria',
    wa: 'Western Australia',
    tokyo: '東京都',
    osaka: '大阪府',
  };
  const compact = raw.toLowerCase().replace(/[^a-z0-9\u4e00-\u9fff]/g, '');
  const candidates = [raw];
  if (aliases[compact]) {
    candidates.push(aliases[compact]);
  }
  for (const [abbr, name] of Object.entries(aliases)) {
    const compactName = name.toLowerCase().replace(/[^a-z0-9\u4e00-\u9fff]/g, '');
    if (compact === compactName) {
      candidates.push(abbr.toUpperCase());
    }
  }
  return Array.from(new Set(candidates.filter(Boolean)));
}

function getCountryCandidates(value = '') {
  const raw = normalizeText(value);
  const compact = raw.toLowerCase().replace(/[^a-z0-9\u4e00-\u9fff]/g, '');
  const aliases = {
    AR: ['Argentina', '阿根廷'],
    AU: ['Australia', '澳大利亚'],
    CA: ['Canada', '加拿大'],
    CN: ['China', '中国'],
    DE: ['Germany', 'Deutschland', '德国'],
    ES: ['Spain', '西班牙'],
    FR: ['France', '法国'],
    GB: ['United Kingdom', 'UK', 'Britain', 'England', '英国'],
    HK: ['Hong Kong', '香港'],
    ID: ['Indonesia', '印度尼西亚', '印尼'],
    IT: ['Italy', '意大利'],
    JP: ['Japan', '日本', '日本国'],
    KR: ['Korea', 'South Korea', '韩国'],
    MY: ['Malaysia', '马来西亚'],
    NL: ['Netherlands', 'Holland', '荷兰'],
    PH: ['Philippines', '菲律宾'],
    RU: ['Russia', '俄罗斯'],
    SG: ['Singapore', '新加坡'],
    TH: ['Thailand', '泰国'],
    TR: ['Turkey', 'Turkiye', '土耳其'],
    TW: ['Taiwan', '台湾'],
    US: ['United States', 'United States of America', 'USA', '美国'],
    VN: ['Vietnam', '越南'],
  };
  const indonesiaCandidates = aliases.ID || [];
  if (compact === 'id' || compact === 'indonesia' || compact === '印度尼西亚' || compact === '印尼') {
    return Array.from(new Set([raw, 'ID', ...indonesiaCandidates].filter(Boolean)));
  }
  const direct = aliases[String(raw || '').trim().toUpperCase()] || [];
  const matched = Object.entries(aliases).find(([code, names]) => {
    if (String(code).toLowerCase() === compact) return true;
    return names.some((name) => {
      const normalizedName = normalizeText(name).toLowerCase();
      const compactName = normalizedName.replace(/[^a-z0-9\u4e00-\u9fff]/g, '');
      return compact === compactName || normalizedName === raw.toLowerCase();
    });
  });
  return Array.from(new Set([raw, ...direct, ...(matched ? matched[1] : [])].filter(Boolean)));
}

function matchesCountryOption(text, desiredValue) {
  const normalizedText = normalizeText(text).toLowerCase();
  const compactText = normalizedText.replace(/[^a-z0-9\u4e00-\u9fff]/g, '');
  if (!compactText) return false;
  return getCountryCandidates(desiredValue).some((candidate) => {
    const normalizedCandidate = normalizeText(candidate).toLowerCase();
    const compactCandidate = normalizedCandidate.replace(/[^a-z0-9\u4e00-\u9fff]/g, '');
    if (!compactCandidate) return false;
    return normalizedText === normalizedCandidate
      || compactText === compactCandidate
      || (compactCandidate.length > 3 && compactText.includes(compactCandidate));
  });
}

function findCountryDropdown() {
  const controls = getVisibleControls('select, button, [role="button"], [role="combobox"], [aria-haspopup="listbox"]');
  return controls.find((control) => {
    if (!isEnabledControl(control) || isDocumentLevelContainer(control)) return false;
    const text = getFieldText(control);
    return /country/i.test(text) || /\u56fd\u5bb6|\u56fd\u5bb6\u6216\u5730\u533a/.test(text);
  }) || null;
}

function getCountryDropdownValue(control) {
  if (!control) return '';
  if (String(control.tagName || '').toUpperCase() === 'SELECT') {
    const selected = control.selectedOptions?.[0];
    return normalizeText(selected?.textContent || control.value || '');
  }
  return normalizeText(
    control.getAttribute?.('aria-valuetext')
    || control.getAttribute?.('aria-label')
    || control.getAttribute?.('data-value')
    || control.textContent
    || ''
  );
}

function matchesRegionOption(text, desiredValue) {
  const normalizedText = normalizeText(text).toLowerCase();
  const compactText = normalizedText.replace(/[^a-z0-9\u4e00-\u9fff]/g, '');
  if (!compactText) return false;
  return getRegionCandidates(desiredValue).some((candidate) => {
    const normalizedCandidate = normalizeText(candidate).toLowerCase();
    const compactCandidate = normalizedCandidate.replace(/[^a-z0-9\u4e00-\u9fff]/g, '');
    if (!compactCandidate) return false;
    return normalizedText === normalizedCandidate
      || compactText === compactCandidate
      || (compactCandidate.length > 3 && compactText.includes(compactCandidate));
  });
}

function findRegionDropdown() {
  const controls = getVisibleControls('select, button, [role="button"], [role="combobox"], [aria-haspopup="listbox"]');
  return controls.find((control) => {
    if (!isEnabledControl(control) || isDocumentLevelContainer(control)) return false;
    const text = getFieldText(control);
    if (/country/i.test(text) || /\u56fd\u5bb6|\u5730\u533a/.test(text)) return false;
    return /state|province|county|prefecture|administrative|administrative[_-]?area/i.test(text)
      || /(?:^|\s)region(?:\s|$)/i.test(text)
      || /\u5dde|\u7701|\u8f96\u533a|\u90fd\u9053\u5e9c\u53bf/.test(text);
  }) || null;
}

function getRegionDropdownValue(control) {
  if (!control) return '';
  if (String(control.tagName || '').toUpperCase() === 'SELECT') {
    const selected = control.selectedOptions?.[0];
    return normalizeText(selected?.textContent || control.value || '');
  }
  return normalizeText(
    control.getAttribute?.('aria-valuetext')
    || control.getAttribute?.('aria-label')
    || control.getAttribute?.('data-value')
    || control.textContent
    || ''
  );
}

function getVisibleRegionOptions() {
  const selectors = [
    '[role="listbox"] [role="option"]',
    '[role="option"]',
    'li',
  ];
  const seen = new Set();
  const options = [];
  for (const selector of selectors) {
    for (const option of Array.from(document.querySelectorAll(selector))) {
      if (!isVisibleElement(option)) continue;
      const text = normalizeText(getActionText(option) || option.textContent || '');
      if (!text || seen.has(text)) continue;
      seen.add(text);
      options.push(option);
    }
  }
  return options;
}

async function selectRegionDropdown(regionDropdown, value) {
  if (!regionDropdown || !value) return false;
  if (matchesRegionOption(getRegionDropdownValue(regionDropdown), value)) {
    return false;
  }

  if (String(regionDropdown.tagName || '').toUpperCase() === 'SELECT') {
    const option = Array.from(regionDropdown.options || []).find((item) => (
      matchesRegionOption(item.textContent || '', value)
      || matchesRegionOption(item.value || '', value)
    ));
    if (!option) {
      throw new Error(`Plus Checkout: state dropdown option "${value}" was not found.`);
    }
    regionDropdown.value = option.value;
    option.selected = true;
    regionDropdown.dispatchEvent(new Event('input', { bubbles: true }));
    regionDropdown.dispatchEvent(new Event('change', { bubbles: true }));
    return true;
  }

  simulateClick(regionDropdown);
  await sleep(250);
  const startedAt = Date.now();
  let option = null;
  while (Date.now() - startedAt < 2500) {
    throwIfStopped();
    option = getVisibleRegionOptions().find((item) => (
      matchesRegionOption(getActionText(item) || item.textContent || '', value)
    ));
    if (option) break;
    await sleep(100);
  }
  if (!option) {
    const visibleOptions = getVisibleRegionOptions()
      .map((item) => normalizeText(getActionText(item) || item.textContent || ''))
      .filter(Boolean)
      .slice(0, 12)
      .join(' | ');
    throw new Error(`Plus Checkout: state dropdown option "${value}" was not found. Visible options: ${visibleOptions || 'none'}.`);
  }
  simulateClick(option);
  await sleep(500);
  return true;
}

async function selectCountryDropdown(countryDropdown, value) {
  if (!countryDropdown || !value) return false;
  if (matchesCountryOption(getCountryDropdownValue(countryDropdown), value)) {
    return false;
  }

  if (String(countryDropdown.tagName || '').toUpperCase() === 'SELECT') {
    const option = Array.from(countryDropdown.options || []).find((item) => (
      matchesCountryOption(item.textContent || '', value)
      || matchesCountryOption(item.value || '', value)
    ));
    if (!option) {
      throw new Error(`Plus Checkout: country dropdown option "${value}" was not found.`);
    }
    countryDropdown.value = option.value;
    option.selected = true;
    countryDropdown.dispatchEvent(new Event('input', { bubbles: true }));
    countryDropdown.dispatchEvent(new Event('change', { bubbles: true }));
    await sleep(500);
    return true;
  }

  simulateClick(countryDropdown);
  await sleep(250);
  const startedAt = Date.now();
  let option = null;
  while (Date.now() - startedAt < 2500) {
    throwIfStopped();
    option = getVisibleRegionOptions().find((item) => (
      matchesCountryOption(getActionText(item) || item.textContent || '', value)
    ));
    if (option) break;
    await sleep(100);
  }
  if (!option) {
    const visibleOptions = getVisibleRegionOptions()
      .map((item) => normalizeText(getActionText(item) || item.textContent || ''))
      .filter(Boolean)
      .slice(0, 12)
      .join(' | ');
    throw new Error(`Plus Checkout: country dropdown option "${value}" was not found. Visible options: ${visibleOptions || 'none'}.`);
  }
  simulateClick(option);
  await sleep(700);
  return true;
}

function getStructuredAddressFields() {
  const address1 = findInputByFieldText([
    /address\s*(?:line)?\s*1|address[_-]?line[_-]?1|address\[(?:address_)?line1\]|line\s*1|street|street[_-]?address/i,
    /地址\s*1|街道|详细地址|住所/i,
  ]);
  const address2 = findInputByFieldText([
    /address\s*(?:line)?\s*2|address[_-]?line[_-]?2|address\[(?:address_)?line2\]|line\s*2|apt|suite|unit/i,
    /地址\s*2|公寓|单元|门牌/i,
  ]);
  const city = findInputByFieldText([
    /city|town|suburb|locality|address[_-]?level[_-]?2|address\[city\]/i,
    /City|市区|区市町村|市区町村|市町村/i,
  ]);
  const region = findInputByFieldText([
    /state|province|region|county|prefecture|administrative|administrative[_-]?area|address[_-]?level[_-]?1|address\[state\]/i,
    /省|州|地区|辖区|都道府县|都道府県/i,
  ]);
  const postalCode = findInputByFieldText([
    /postal|zip|postcode|postal[_-]?code|zip[_-]?code|address\[postal_code\]/i,
    /Postal code|邮政|郵便番号/i,
  ]);
  return { address1, address2, city, region, postalCode };
}

function fillIfEmpty(input, value, options = {}) {
  if (!input || !value) return false;
  if (!options.overwrite && String(input.value || '').trim()) return false;
  if (options.overwrite && String(input.value || '').trim() === String(value || '').trim()) return false;
  fillInput(input, value);
  return true;
}

function isDropdownStructuredAddressForm(fields = getStructuredAddressFields()) {
  return Boolean(
    findCountryDropdown()
    && findRegionDropdown()
    && fields.address1
    && fields.city
    && fields.postalCode
  );
}

async function ensureStructuredAddress(seed, options = {}) {
  const fallback = seed?.fallback || {};
  const overwrite = Boolean(options.overwrite);
  const countryDropdown = findCountryDropdown();
  if (countryDropdown && seed?.countryCode) {
    await selectCountryDropdown(countryDropdown, seed.countryCode);
  }
  const fields = await waitUntil(() => {
    const currentFields = getStructuredAddressFields();
    if (currentFields.address1 || currentFields.city || currentFields.postalCode) {
      return currentFields;
    }
    return null;
  }, {
    label: 'Structured billing address fields',
    intervalMs: 250,
    timeoutMs: 6000,
  });

  fillIfEmpty(fields.address1, fallback.address1, { overwrite });
  fillIfEmpty(fields.city, fallback.city, { overwrite });
  await selectRegionDropdown(findRegionDropdown(), fallback.region);
  fillIfEmpty(fields.postalCode, fallback.postalCode, { overwrite });
  await sleep(500);

  const latest = getStructuredAddressFields();
  const missing = [];
  if (!String(latest.address1?.value || '').trim()) missing.push('Address line 1');
  if (!String(latest.city?.value || '').trim()) missing.push('City');
  if (!String(latest.postalCode?.value || '').trim()) missing.push('Postal code');
  if (missing.length) {
    throw new Error(`Plus Checkout: Billing address fields are incomplete: ${missing.join('、')}.`);
  }

  return {
    address1: latest.address1?.value || '',
    city: latest.city?.value || '',
    region: getRegionDropdownValue(findRegionDropdown()) || latest.region?.value || '',
    postalCode: latest.postalCode?.value || '',
  };
}

function findSubscribeButton() {
  const submitButtons = getVisibleControls('button[type="submit"], input[type="submit"]');
  const exactSubmit = submitButtons.find((button) => (
    isEnabledControl(button)
    && /Subscribe|subscribe|购买\s*ChatGPT\s*Plus|start\s*subscription|place\s*order/i.test(getCombinedSearchText(button))
  ));
  if (exactSubmit) {
    return exactSubmit;
  }

  return findClickableByText([
    /Subscribe|继续|确认|支付/i,
    /subscribe|continue|confirm|pay|start\s*subscription|place\s*order/i,
  ]);
}

function isBusySubscribeButton(button) {
  if (!button) return true;
  const text = getActionText(button);
  return button.disabled
    || button.getAttribute?.('aria-disabled') === 'true'
    || button.getAttribute?.('aria-busy') === 'true'
    || button.closest?.('[aria-busy="true"], [data-loading="true"], [data-state="loading"]')
    || /loading|processing|submitting|请稍候|处理中|加载中/i.test(text);
}

const SUBSCRIBE_READY_TEXT_PATTERN = /\u8ba2\u9605|\u7ee7\u7eed|\u786e\u8ba4|\u652f\u4ed8|subscribe|continue|confirm|pay|\u8d2d\u4e70\s*ChatGPT\s*Plus|start\s*subscription|place\s*order/i;
const SUBSCRIBE_PROCESSING_TEXT_PATTERN = /\u6b63\u5728\u5904\u7406|\u5904\u7406\u4e2d|\u8bf7\u7a0d\u5019|\u52a0\u8f7d\u4e2d|loading|processing|submitting/i;

function getSubscribeButtonState(button) {
  if (!button) {
    return {
      found: false,
      enabled: false,
      busy: false,
      ready: false,
      status: 'missing',
      text: '',
    };
  }
  const text = normalizeText([
    button.innerText,
    button.textContent,
    button.value,
    button.getAttribute?.('aria-label'),
  ].filter(Boolean).join(' ')) || getActionText(button);
  const searchText = getCombinedSearchText(button);
  const combinedText = normalizeText(`${text} ${searchText}`);
  const enabled = isEnabledControl(button);
  const busy = Boolean(isBusySubscribeButton(button) || SUBSCRIBE_PROCESSING_TEXT_PATTERN.test(combinedText));
  const readyText = SUBSCRIBE_READY_TEXT_PATTERN.test(combinedText);
  const ready = Boolean(enabled && readyText && !busy);
  return {
    found: true,
    enabled,
    busy,
    ready,
    status: busy ? 'processing' : (!enabled ? 'disabled' : (readyText ? 'ready' : 'unknown')),
    text: text || searchText,
  };
}

function getAssociatedForm(button) {
  if (!button) return null;
  if (button.form) return button.form;
  const formId = String(button.getAttribute?.('form') || '').trim();
  if (formId) {
    return document.getElementById(formId) || null;
  }
  return button.closest?.('form') || null;
}

async function humanLikeClick(el) {
  throwIfStopped();
  if (!el) {
    throw new Error('Cannot click an empty element.');
  }

  el.scrollIntoView?.({ block: 'center', inline: 'center', behavior: 'instant' });
  await sleep(300);
  if (typeof el.focus === 'function') {
    el.focus({ preventScroll: true });
    await sleep(150);
  }

  const rect = el.getBoundingClientRect();
  const clientX = Math.floor(rect.left + rect.width / 2);
  const clientY = Math.floor(rect.top + rect.height / 2);
  const eventInit = {
    bubbles: true,
    cancelable: true,
    composed: true,
    view: window,
    clientX,
    clientY,
    button: 0,
    buttons: 1,
  };
  const pointerCtor = typeof PointerEvent === 'function' ? PointerEvent : MouseEvent;
  const events = [
    ['pointerover', pointerCtor],
    ['pointerenter', pointerCtor],
    ['mouseover', MouseEvent],
    ['mouseenter', MouseEvent],
    ['pointermove', pointerCtor],
    ['mousemove', MouseEvent],
    ['pointerdown', pointerCtor],
    ['mousedown', MouseEvent],
    ['pointerup', pointerCtor],
    ['mouseup', MouseEvent],
    ['click', MouseEvent],
  ];

  for (const [type, EventCtor] of events) {
    throwIfStopped();
    el.dispatchEvent(new EventCtor(type, eventInit));
    await sleep(type === 'mousedown' || type === 'pointerdown' ? 120 : 30);
  }

  if (typeof el.click === 'function') {
    await sleep(120);
    el.click();
  }

  const type = String(el.getAttribute?.('type') || el.type || '').trim().toLowerCase();
  const form = getAssociatedForm(el);
  if (
    form
    && typeof form.requestSubmit === 'function'
    && (
      (String(el.tagName || '').toUpperCase() === 'BUTTON' && (!type || type === 'submit'))
      || (String(el.tagName || '').toUpperCase() === 'INPUT' && type === 'submit')
    )
  ) {
    await sleep(250);
    form.requestSubmit(el);
  }

  console.log('[MultiPage:plus-checkout] Executed simulated human click', summarizeElementForDebug(el));
  log(`Simulated human click executed [${el.tagName}] "${el.textContent?.trim().slice(0, 30) || ''}"`);
}

async function fillPlusBillingAndSubmit(payload = {}) {
  await waitForDocumentComplete();
  const paymentMethod = normalizePlusPaymentMethod(payload.paymentMethod);
  await selectPaymentMethod(paymentMethod);
  const billingResult = await fillPlusBillingAddress(payload);

  if (payload.skipSubmit) {
    return {
      ...billingResult,
      submitted: false,
    };
  }

  await clickPlusSubscribe();
  return {
    ...billingResult,
    submitted: true,
  };
}

async function fillPlusBillingAddress(payload = {}) {
  await waitForDocumentComplete();
  const countryText = readCountryText();
  const seed = payload.addressSeed || {
    query: 'Berlin Mitte',
    suggestionIndex: 1,
    fallback: {
      address1: 'Unter den Linden',
      city: 'Berlin',
      region: 'Berlin',
      postalCode: '10117',
    },
  };
  let selected = { selectedText: '' };
  const fields = getStructuredAddressFields();
  const useDirectStructuredBranch = Boolean(seed.skipAutocomplete || isDropdownStructuredAddressForm(fields));
  if (!useDirectStructuredBranch) {
    await performOperationWithDelay({ stepKey: 'plus-checkout-billing', kind: 'fill', label: 'fill-address-query' }, async () => {
      await fillFullName(payload.fullName || '');
      await fillAddressQuery(seed);
    });
    selected = await performOperationWithDelay({ stepKey: 'plus-checkout-billing', kind: 'select', label: 'select-address-suggestion' }, async () => (
      clickAddressSuggestion(seed)
    ));
  }
  const structuredAddress = await performOperationWithDelay({ stepKey: 'plus-checkout-billing', kind: 'fill', label: 'fill-billing-address' }, async () => {
    if (useDirectStructuredBranch) {
      await fillFullName(payload.fullName || '');
    }
    return ensureStructuredAddress(seed, {
      overwrite: useDirectStructuredBranch,
    });
  });

  return {
    countryText,
    selectedAddressText: selected.selectedText,
    structuredAddress,
  };
}

async function fillPlusAddressQuery(payload = {}) {
  await waitForDocumentComplete();
  const seed = payload.addressSeed || {};
  await performOperationWithDelay({ stepKey: 'plus-checkout-billing', kind: 'fill', label: 'fill-address-query' }, async () => {
    await fillFullName(payload.fullName || '');
    await fillAddressQuery(seed);
  });
  return {
    countryText: readCountryText(),
    queryFilled: true,
  };
}

async function selectPlusAddressSuggestion(payload = {}) {
  await waitForDocumentComplete();
  const selected = await performOperationWithDelay({ stepKey: 'plus-checkout-billing', kind: 'select', label: 'select-address-suggestion' }, async () => (
    clickAddressSuggestion(payload.addressSeed || {})
  ));
  return {
    selectedAddressText: selected.selectedText,
    suggestionIndex: selected.suggestionIndex,
  };
}

async function ensurePlusStructuredBillingAddress(payload = {}) {
  await waitForDocumentComplete();
  const structuredAddress = await performOperationWithDelay({ stepKey: 'plus-checkout-billing', kind: 'fill', label: 'fill-billing-address' }, async () => (
    ensureStructuredAddress(payload.addressSeed || {}, {
      overwrite: Boolean(payload.overwriteStructuredAddress),
    })
  ));
  return {
    countryText: readCountryText(),
    structuredAddress,
  };
}

async function clickPlusSubscribe(payload = {}) {
  const paymentMethod = normalizePlusPaymentMethod(payload.paymentMethod);
  if ((payload.ensurePayPalActive || payload.ensurePaymentActive) && !isPaymentMethodActive(paymentMethod)) {
    await selectPaymentMethod(paymentMethod);
  }

  const subscribeButton = await waitUntil(() => {
    const button = findSubscribeButton();
    return button || null;
  }, {
    label: 'Subscribe button',
    intervalMs: 250,
    timeoutMs: 10000,
  });
  const buttonState = getSubscribeButtonState(subscribeButton);
  if (!buttonState.ready) {
    log(`Current subscribe button state [${buttonState.status}] "${buttonState.text.slice(0, 40)}", not clicking in this round`);
    return {
      clicked: false,
      subscribeButtonBusy: buttonState.busy,
      subscribeButtonEnabled: buttonState.enabled,
      subscribeButtonStatus: buttonState.status,
      subscribeButtonText: buttonState.text,
    };
  }

  await sleep(Math.max(0, Math.floor(Number(payload.beforeClickDelayMs) || 0)));
  await performOperationWithDelay({ stepKey: 'plus-checkout-billing', kind: 'submit', label: 'click-subscribe' }, async () => {
    await humanLikeClick(subscribeButton);
  });
  return {
    clicked: true,
    subscribeButtonStatus: 'clicked',
    subscribeButtonText: buttonState.text,
  };
}

async function readChatGptSessionAccessToken() {
  const sessionResponse = await fetch('/api/auth/session', {
    credentials: 'include',
  });
  const session = await sessionResponse.json().catch(() => ({}));
  return {
    session,
    accessToken: String(session?.accessToken || '').trim(),
  };
}

async function inspectPlusCheckoutState(options = {}) {
  const structuredAddress = getStructuredAddressFields();
  const subscribeButtonState = getSubscribeButtonState(findSubscribeButton());
  const state = {
    url: location.href,
    readyState: document.readyState,
    countryText: readCountryText(),
    hasPayPal: Boolean(findPayPalPaymentMethodTarget()),
    hasGoPay: Boolean(findGoPayPaymentMethodTarget()),
    paypalCandidates: getPayPalCandidateSummaries(),
    gopayCandidates: getGoPayCandidateSummaries(),
    paymentTextPreview: getPaymentTextPreview(),
    cardFieldsVisible: hasCreditCardFields(),
    billingFieldsVisible: hasBillingAddressFields(),
    hasSubscribeButton: subscribeButtonState.found,
    subscribeButtonBusy: subscribeButtonState.busy,
    subscribeButtonEnabled: subscribeButtonState.enabled,
    subscribeButtonStatus: subscribeButtonState.status,
    subscribeButtonText: subscribeButtonState.text,
    hostedOpenAiPage: isPayPalHostedOpenAiCheckoutPage(),
    hostedVerificationVisible: hasHostedOpenAiVerificationDialog(),
    hostedPayPalButtonFound: Boolean(findHostedPayPalButton()),
    checkoutAmountSummary: getCheckoutAmountSummary(),
    addressFieldValues: {
      address1: structuredAddress.address1?.value || '',
      city: structuredAddress.city?.value || '',
      region: getRegionDropdownValue(findRegionDropdown()) || structuredAddress.region?.value || '',
      postalCode: structuredAddress.postalCode?.value || '',
    },
  };
  if (options.includeSession || options.includeAccessToken) {
    const sessionState = await readChatGptSessionAccessToken();
    state.session = sessionState.session;
    state.accessToken = sessionState.accessToken;
  }
  return state;
}
})();
