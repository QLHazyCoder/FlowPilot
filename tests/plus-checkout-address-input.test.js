const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const vm = require('node:vm');

const source = fs.readFileSync('content/plus-checkout.js', 'utf8');

test('plus checkout content script can be injected repeatedly on the same page', () => {
  const attrs = new Map();
  const context = {
    console: { log() {}, warn() {}, error() {}, info() {} },
    location: { href: 'https://chatgpt.com/' },
    window: {},
    document: {
      documentElement: {
        getAttribute(name) {
          return attrs.get(name) || null;
        },
        setAttribute(name, value) {
          attrs.set(name, String(value));
        },
      },
    },
    chrome: {
      runtime: {
        onMessage: {
          addListener() {},
        },
      },
    },
  };
  context.window = context;
  vm.createContext(context);

  vm.runInContext(source, context);
  vm.runInContext(source, context);

  assert.equal(context.__MULTIPAGE_PLUS_CHECKOUT_READY__, true);
});

function createPlusCheckoutMessageHarness({ checkoutSessionId = 'cs_test_123', checkoutResponse = null } = {}) {
  const attrs = new Map();
  let listener = null;
  const fetchCalls = [];
  const context = {
    console: { log() {}, warn() {}, error() {}, info() {} },
    location: { href: 'https://chatgpt.com/' },
    window: {},
    document: {
      readyState: 'complete',
      documentElement: {
        getAttribute(name) {
          return attrs.get(name) || null;
        },
        setAttribute(name, value) {
          attrs.set(name, String(value));
        },
      },
    },
    chrome: {
      runtime: {
        onMessage: {
          addListener(fn) {
            listener = fn;
          },
        },
      },
    },
    resetStopState() {},
    isStopError() { return false; },
    throwIfStopped() {},
    sleep() { return Promise.resolve(); },
    log() {},
    fetch: async (url, options = {}) => {
      fetchCalls.push({ url, options });
      if (url === '/api/auth/session') {
        return {
          ok: true,
          status: 200,
          json: async () => ({ accessToken: 'test-access-token' }),
        };
      }
      if (url === 'https://chatgpt.com/backend-api/payments/checkout') {
        return {
          ok: true,
          status: 200,
          json: async () => checkoutResponse || ({ checkout_session_id: checkoutSessionId }),
        };
      }
      throw new Error(`unexpected fetch url: ${url}`);
    },
  };
  context.window = context;
  vm.createContext(context);
  vm.runInContext(source, context);
  assert.equal(typeof listener, 'function');

  async function send(message) {
    return await new Promise((resolve) => {
      listener(message, {}, resolve);
    });
  }

  return { send, fetchCalls };
}

test('CREATE_PLUS_CHECKOUT keeps PayPal on DE/EUR and openai_ie merchant path by default', async () => {
  const harness = createPlusCheckoutMessageHarness({ checkoutSessionId: 'cs_paypal' });

  const result = await harness.send({
    type: 'CREATE_PLUS_CHECKOUT',
    source: 'test',
    payload: {},
  });

  assert.equal(result.ok, true);
  assert.equal(result.checkoutUrl, 'https://chatgpt.com/checkout/openai_ie/cs_paypal');
  assert.equal(result.country, 'DE');
  assert.equal(result.currency, 'EUR');

  const checkoutCall = harness.fetchCalls.find((call) => call.url === 'https://chatgpt.com/backend-api/payments/checkout');
  assert.ok(checkoutCall);
  assert.equal(checkoutCall.options.method, 'POST');
  assert.equal(checkoutCall.options.headers.Authorization, 'Bearer test-access-token');
  const payload = JSON.parse(checkoutCall.options.body);
  assert.equal(payload.plan_name, 'chatgptplusplan');
  assert.equal(payload.checkout_ui_mode, 'custom');
  assert.deepEqual(payload.billing_details, { country: 'DE', currency: 'EUR' });
});

test('CREATE_PLUS_CHECKOUT ignores hosted PayPal URLs outside hosted mode', async () => {
  const harness = createPlusCheckoutMessageHarness({
    checkoutResponse: {
      checkout_session_id: 'cs_paypal_custom',
      nested: {
        hosted: 'https://pay.openai.com/c/pay/hosted_cs_paypal_custom',
      },
    },
  });

  const result = await harness.send({
    type: 'CREATE_PLUS_CHECKOUT',
    source: 'test',
    payload: {},
  });

  assert.equal(result.ok, true);
  assert.equal(result.checkoutUrl, 'https://chatgpt.com/checkout/openai_ie/cs_paypal_custom');
  assert.equal(result.hostedCheckoutUrl, 'https://pay.openai.com/c/pay/hosted_cs_paypal_custom');
  assert.equal(result.fallbackCheckoutUrl, 'https://chatgpt.com/checkout/openai_ie/cs_paypal_custom');
});

test('CREATE_PLUS_CHECKOUT prefers the hosted PayPal checkout URL only in hosted mode', async () => {
  const harness = createPlusCheckoutMessageHarness({
    checkoutResponse: {
      checkout_session_id: 'cs_paypal_hosted',
      nested: {
        hosted: 'https://pay.openai.com/c/pay/hosted_cs_paypal',
      },
    },
  });

  const result = await harness.send({
    type: 'CREATE_PLUS_CHECKOUT',
    source: 'test',
    payload: { hostedCheckoutMode: true },
  });

  assert.equal(result.ok, true);
  assert.equal(result.checkoutUrl, 'https://pay.openai.com/c/pay/hosted_cs_paypal');
  assert.equal(result.hostedCheckoutUrl, 'https://pay.openai.com/c/pay/hosted_cs_paypal');
  assert.equal(result.fallbackCheckoutUrl, 'https://chatgpt.com/checkout/openai_ie/cs_paypal_hosted');

  const checkoutCall = harness.fetchCalls.find((call) => call.url === 'https://chatgpt.com/backend-api/payments/checkout');
  const payload = JSON.parse(checkoutCall.options.body);
  assert.equal(payload.checkout_ui_mode, 'hosted');
});

test('CREATE_PLUS_CHECKOUT uses ID/IDR and openai_llc merchant path for GoPay', async () => {
  const harness = createPlusCheckoutMessageHarness({ checkoutSessionId: 'cs_gopay' });

  const result = await harness.send({
    type: 'CREATE_PLUS_CHECKOUT',
    source: 'test',
    payload: { paymentMethod: 'gopay' },
  });

  assert.equal(result.ok, true);
  assert.equal(result.checkoutUrl, 'https://chatgpt.com/checkout/openai_llc/cs_gopay');
  assert.equal(result.country, 'ID');
  assert.equal(result.currency, 'IDR');

  const checkoutCall = harness.fetchCalls.find((call) => call.url === 'https://chatgpt.com/backend-api/payments/checkout');
  assert.ok(checkoutCall);
  const payload = JSON.parse(checkoutCall.options.body);
  assert.equal(payload.entry_point, 'all_plans_pricing_modal');
  assert.equal(payload.checkout_ui_mode, 'custom');
  assert.deepEqual(payload.billing_details, { country: 'ID', currency: 'IDR' });
  assert.deepEqual(payload.promo_campaign, {
    promo_campaign_id: 'plus-1-month-free',
    is_coupon_from_query_param: false,
  });
});

function extractFunction(name) {
  const plainStart = source.indexOf(`function ${name}(`);
  const asyncStart = source.indexOf(`async function ${name}(`);
  const start = asyncStart >= 0
    ? asyncStart
    : plainStart;
  if (start < 0) {
    throw new Error(`missing function ${name}`);
  }

  let parenDepth = 0;
  let signatureEnded = false;
  let braceStart = -1;
  for (let index = start; index < source.length; index += 1) {
    const ch = source[index];
    if (ch === '(') {
      parenDepth += 1;
    } else if (ch === ')') {
      parenDepth -= 1;
      if (parenDepth === 0) {
        signatureEnded = true;
      }
    } else if (ch === '{' && signatureEnded) {
      braceStart = index;
      break;
    }
  }

  if (braceStart < 0) {
    throw new Error(`missing body for function ${name}`);
  }

  let depth = 0;
  let end = braceStart;
  for (; end < source.length; end += 1) {
    const ch = source[end];
    if (ch === '{') depth += 1;
    if (ch === '}') {
      depth -= 1;
      if (depth === 0) {
        end += 1;
        break;
      }
    }
  }

  return source.slice(start, end);
}

function createInput({ id = '', name = '', placeholder = '', containerText = '' }) {
  const attrs = {
    id,
    name,
    placeholder,
    type: 'text',
  };
  const container = {
    textContent: containerText,
  };
  return {
    id,
    name,
    type: 'text',
    value: '',
    textContent: '',
    getAttribute: (key) => attrs[key] || '',
    closest: (selector) => {
      if (selector === 'label') return null;
      if (String(selector || '').includes('[data-testid]')) return container;
      return null;
    },
    getBoundingClientRect: () => ({ width: 240, height: 40 }),
  };
}

function createElement({ tagName = 'BUTTON', text = '', attrs = {}, className = '' }) {
  return {
    tagName,
    textContent: text,
    value: '',
    className,
    dataset: {},
    id: attrs.id || '',
    checked: false,
    getAttribute: (key) => attrs[key] || '',
    closest: () => null,
    getBoundingClientRect: () => ({ width: 180, height: 64 }),
  };
}

test('findAddressSearchInput skips the name field when its container says billing address', async () => {
  const bundle = [
    'function throwIfStopped() {}',
    'function sleep() { return Promise.resolve(); }',
    extractFunction('waitUntil'),
    extractFunction('isVisibleElement'),
    extractFunction('normalizeText'),
    extractFunction('getActionText'),
    extractFunction('getFieldText'),
    extractFunction('getVisibleControls'),
    extractFunction('getVisibleTextInputs'),
    extractFunction('findInputByFieldText'),
    extractFunction('getDirectFieldHintText'),
    extractFunction('isNonAddressSearchInput'),
    extractFunction('isLikelyAddressSearchInput'),
    extractFunction('findAddressSearchInput'),
  ].join('\n');

  const nameInput = createInput({
    name: 'name',
    placeholder: 'Name',
    containerText: 'Billing address',
  });
  const addressInput = createInput({
    name: 'addressLine1',
    placeholder: 'Address',
    containerText: 'Billing address',
  });
  const inputs = [nameInput, addressInput];
  const documentMock = {
    readyState: 'complete',
    querySelectorAll: (selector) => {
      if (selector === 'input, textarea') return inputs;
      return [];
    },
  };
  const windowMock = {
    getComputedStyle: () => ({ display: 'block', visibility: 'visible' }),
  };
  const cssMock = {
    escape: (value) => String(value),
  };

  const api = new Function('window', 'document', 'CSS', `
${bundle}
return { findAddressSearchInput, isNonAddressSearchInput };
`)(windowMock, documentMock, cssMock);

  assert.equal(api.isNonAddressSearchInput(nameInput), true);
  assert.equal(await api.findAddressSearchInput(), addressInput);
});

test('getCheckoutAmountSummary reads non-zero today due amount', () => {
  const label = createElement({ tagName: 'DIV', text: '今日应付金额' });
  const amount = createElement({ tagName: 'DIV', text: '€19.33' });
  const row = createElement({ tagName: 'DIV', text: '今日应付金额 €19.33' });
  label.parentElement = row;
  amount.parentElement = row;
  row.children = [label, amount];
  row.parentElement = null;

  const bundle = [
    extractFunction('isVisibleElement'),
    extractFunction('normalizeText'),
    extractFunction('parseLocalizedAmount'),
    extractFunction('getTextAfterTodayDueLabel'),
    extractFunction('getVisibleControls'),
    extractFunction('getCheckoutAmountSummary'),
    'return { getCheckoutAmountSummary };',
  ].join('\n');

  const api = new Function('window', 'document', bundle)(
    {
      getComputedStyle: () => ({ display: 'block', visibility: 'visible' }),
    },
    {
      querySelectorAll: () => [label, amount, row],
    }
  );

  const summary = api.getCheckoutAmountSummary();
  assert.equal(summary.hasTodayDue, true);
  assert.equal(summary.isZero, false);
  assert.equal(summary.amount, 19.33);
  assert.equal(summary.rawAmount, '€19.33');
});

test('getCheckoutAmountSummary accepts zero today due amount', () => {
  const label = createElement({ tagName: 'DIV', text: '今日应付金额' });
  const amount = createElement({ tagName: 'DIV', text: '€0.00' });
  const row = createElement({ tagName: 'DIV', text: '今日应付金额 €0.00' });
  label.parentElement = row;
  amount.parentElement = row;
  row.children = [label, amount];
  row.parentElement = null;

  const bundle = [
    extractFunction('isVisibleElement'),
    extractFunction('normalizeText'),
    extractFunction('parseLocalizedAmount'),
    extractFunction('getTextAfterTodayDueLabel'),
    extractFunction('getVisibleControls'),
    extractFunction('getCheckoutAmountSummary'),
    'return { getCheckoutAmountSummary };',
  ].join('\n');

  const api = new Function('window', 'document', bundle)(
    {
      getComputedStyle: () => ({ display: 'block', visibility: 'visible' }),
    },
    {
      querySelectorAll: () => [label, amount, row],
    }
  );

  const summary = api.getCheckoutAmountSummary();
  assert.equal(summary.hasTodayDue, true);
  assert.equal(summary.isZero, true);
  assert.equal(summary.amount, 0);
});

test('isPayPalPaymentMethodActive requires a selected PayPal control', () => {
  const bundle = [
    "const PLUS_PAYMENT_METHOD_PAYPAL = 'paypal';",
    "const PLUS_PAYMENT_METHOD_GOPAY = 'gopay';",
    "const PAYMENT_METHOD_CONFIGS = { paypal: { id: 'paypal', label: 'PayPal', patterns: [/paypal/i] }, gopay: { id: 'gopay', label: 'GoPay', patterns: [/gopay|go\\\\s*pay/i] } };",
    extractFunction('isVisibleElement'),
    extractFunction('normalizeText'),
    extractFunction('getActionText'),
    extractFunction('getSearchText'),
    extractFunction('getFieldText'),
    extractFunction('getCombinedSearchText'),
    extractFunction('getVisibleControls'),
    extractFunction('getVisibleTextInputs'),
    extractFunction('isDocumentLevelContainer'),
    extractFunction('normalizePlusPaymentMethod'),
    extractFunction('getPaymentMethodConfig'),
    extractFunction('getPaymentMethodSearchCandidates'),
    extractFunction('getPayPalSearchCandidates'),
    extractFunction('hasCreditCardFields'),
    extractFunction('hasPaymentMethodSelectionMarker'),
    extractFunction('hasSelectedPaymentMethodControl'),
    extractFunction('hasSelectedPayPalControl'),
    extractFunction('isPaymentMethodActive'),
    extractFunction('isPayPalPaymentMethodActive'),
  ].join('\n');

  const paypalButton = createElement({
    text: 'PayPal',
    attrs: {
      id: 'paypal-tab',
      role: 'tab',
      'aria-selected': '',
    },
  });
  const elements = [paypalButton];
  const documentMock = {
    documentElement: {},
    body: {},
    querySelectorAll: (selector) => {
      if (selector === 'input, textarea') return [];
      if (String(selector || '').includes('label[for=')) return [];
      return elements;
    },
  };
  const windowMock = {
    innerWidth: 1200,
    innerHeight: 900,
    getComputedStyle: () => ({ display: 'block', visibility: 'visible' }),
  };
  const cssMock = {
    escape: (value) => String(value),
  };

  const api = new Function('window', 'document', 'CSS', `
${bundle}
return { isPayPalPaymentMethodActive };
`)(windowMock, documentMock, cssMock);

  assert.equal(api.isPayPalPaymentMethodActive(), false);
  paypalButton.getAttribute = (key) => (key === 'aria-selected' ? 'true' : (paypalButton.id && key === 'id' ? paypalButton.id : ''));
  assert.equal(api.isPayPalPaymentMethodActive(), true);
});

test('getStructuredAddressFields recognizes Stripe localized address field names', () => {
  const bundle = [
    extractFunction('isVisibleElement'),
    extractFunction('normalizeText'),
    extractFunction('getActionText'),
    extractFunction('getFieldText'),
    extractFunction('getVisibleControls'),
    extractFunction('getVisibleTextInputs'),
    extractFunction('findInputByFieldText'),
    extractFunction('getStructuredAddressFields'),
  ].join('\n');

  const address1 = createInput({ name: 'addressLine1', placeholder: '住所' });
  const city = createInput({ name: 'locality', placeholder: '市区町村' });
  const region = createInput({ name: 'administrativeArea', placeholder: '辖区' });
  const postalCode = createInput({ name: 'postalCode', placeholder: '郵便番号' });
  const inputs = [address1, city, region, postalCode];
  const documentMock = {
    querySelectorAll: (selector) => {
      if (selector === 'input, textarea') return inputs;
      if (String(selector || '').includes('label[for=')) return [];
      return [];
    },
  };
  const windowMock = {
    getComputedStyle: () => ({ display: 'block', visibility: 'visible' }),
  };
  const cssMock = {
    escape: (value) => String(value),
  };

  const api = new Function('window', 'document', 'CSS', `
${bundle}
return { getStructuredAddressFields };
`)(windowMock, documentMock, cssMock);

  assert.deepEqual(api.getStructuredAddressFields(), {
    address1,
    address2: null,
    city,
    region,
    postalCode,
  });
});

test('findSubscribeButton prefers the submit subscription button', () => {
  const bundle = [
    extractFunction('isVisibleElement'),
    extractFunction('normalizeText'),
    extractFunction('getActionText'),
    extractFunction('getSearchText'),
    extractFunction('getFieldText'),
    extractFunction('getCombinedSearchText'),
    extractFunction('getVisibleControls'),
    extractFunction('findClickableByText'),
    extractFunction('isEnabledControl'),
    extractFunction('findSubscribeButton'),
  ].join('\n');

  const submitButton = createElement({
    tagName: 'BUTTON',
    text: '订阅',
    attrs: {
      'aria-label': '订阅',
      type: 'submit',
    },
  });
  submitButton.type = 'submit';

  const genericButton = createElement({
    tagName: 'BUTTON',
    text: '继续',
    attrs: {
      type: 'button',
    },
  });
  genericButton.type = 'button';

  const documentMock = {
    body: {},
    documentElement: {},
    querySelectorAll: (selector) => {
      if (selector === 'button[type="submit"], input[type="submit"]') return [submitButton];
      if (selector === 'button, a, [role="button"], input[type="button"], input[type="submit"], [tabindex]') {
        return [genericButton, submitButton];
      }
      if (String(selector || '').includes('label[for=')) return [];
      return [];
    },
  };
  const windowMock = {
    getComputedStyle: () => ({ display: 'block', visibility: 'visible' }),
  };
  const cssMock = {
    escape: (value) => String(value),
  };

  const api = new Function('window', 'document', 'CSS', `
${bundle}
return { findSubscribeButton };
`)(windowMock, documentMock, cssMock);

  assert.equal(api.findSubscribeButton(), submitButton);
});

test('humanLikeClick submits a detached submit button through its form attribute', async () => {
  const bundle = [
    'function throwIfStopped() {}',
    'function sleep() { return Promise.resolve(); }',
    'function summarizeElementForDebug() { return {}; }',
    'function log() {}',
    extractFunction('normalizeText'),
    extractFunction('getActionText'),
    extractFunction('getAssociatedForm'),
    extractFunction('humanLikeClick'),
  ].join('\n');

  let submittedWith = null;
  const form = {
    requestSubmit(button) {
      submittedWith = button;
    },
  };
  const button = createElement({
    tagName: 'BUTTON',
    text: '订阅',
    attrs: {
      form: '_r_l_',
      type: 'submit',
      'aria-label': '订阅',
    },
  });
  button.type = 'submit';
  button.scrollIntoView = () => {};
  button.focus = () => {};
  button.dispatchEvent = () => true;
  button.click = () => {};

  const documentMock = {
    getElementById: (id) => (id === '_r_l_' ? form : null),
  };
  const windowMock = {};
  class FakeMouseEvent {
    constructor(type, init = {}) {
      this.type = type;
      Object.assign(this, init);
    }
  }

  const api = new Function('window', 'document', 'MouseEvent', 'PointerEvent', 'console', `
${bundle}
return { humanLikeClick };
`)(windowMock, documentMock, FakeMouseEvent, undefined, { log() {} });

  await api.humanLikeClick(button);
  assert.equal(submittedWith, button);
});

test('selectRegionDropdown opens the state dropdown and clicks the matching option', async () => {
  const bundle = [
    'function throwIfStopped() {}',
    'function sleep() { return Promise.resolve(); }',
    extractFunction('isVisibleElement'),
    extractFunction('normalizeText'),
    extractFunction('getActionText'),
    extractFunction('getRegionCandidates'),
    extractFunction('matchesRegionOption'),
    extractFunction('getRegionDropdownValue'),
    extractFunction('getVisibleRegionOptions'),
    extractFunction('selectRegionDropdown'),
  ].join('\n');

  const state = { opened: false };
  const clicks = [];
  const stateDropdown = createElement({
    tagName: 'DIV',
    text: 'State New South Wales',
    attrs: {
      role: 'combobox',
      'aria-haspopup': 'listbox',
    },
  });
  const options = [
    createElement({ tagName: 'DIV', text: 'New South Wales', attrs: { role: 'option' } }),
    createElement({ tagName: 'DIV', text: 'Western Australia', attrs: { role: 'option' } }),
  ];
  const documentMock = {
    querySelectorAll: (selector) => {
      if (!state.opened) return [];
      if (selector === '[role="listbox"] [role="option"]' || selector === '[role="option"]') return options;
      if (selector === 'li') return [];
      return [];
    },
  };
  const windowMock = {
    getComputedStyle: () => ({ display: 'block', visibility: 'visible' }),
  };

  const api = new Function('window', 'document', 'Event', 'clicks', 'stateDropdown', 'state', `
function simulateClick(el) {
  clicks.push(el);
  if (el === stateDropdown) state.opened = true;
}
${bundle}
return { selectRegionDropdown };
`)(windowMock, documentMock, Event, clicks, stateDropdown, state);

  await api.selectRegionDropdown(stateDropdown, 'Western Australia');

  assert.deepEqual(clicks, [stateDropdown, options[1]]);
});

test('country and region helpers recognize the dropdown-style localized address form', () => {
  const bundle = [
    extractFunction('isVisibleElement'),
    extractFunction('normalizeText'),
    extractFunction('getActionText'),
    extractFunction('getFieldText'),
    extractFunction('getVisibleControls'),
    extractFunction('isEnabledControl'),
    extractFunction('isDocumentLevelContainer'),
    extractFunction('getCountryCandidates'),
    extractFunction('matchesCountryOption'),
    extractFunction('findCountryDropdown'),
    extractFunction('getRegionCandidates'),
    extractFunction('matchesRegionOption'),
    extractFunction('findRegionDropdown'),
  ].join('\n');

  const countryDropdown = createElement({
    tagName: 'DIV',
    text: '国家或地区 日本',
    attrs: {
      role: 'combobox',
      'aria-haspopup': 'listbox',
    },
  });
  const regionDropdown = createElement({
    tagName: 'DIV',
    text: '辖区 选择',
    attrs: {
      role: 'combobox',
      'aria-haspopup': 'listbox',
    },
  });
  const elements = [countryDropdown, regionDropdown];
  const documentMock = {
    documentElement: {},
    body: {},
    querySelectorAll: (selector) => {
      if (String(selector || '').includes('label[for=')) return [];
      if (String(selector || '').includes('combobox') || String(selector || '').includes('button') || String(selector || '').includes('select')) {
        return elements;
      }
      return [];
    },
  };
  const windowMock = {
    getComputedStyle: () => ({ display: 'block', visibility: 'visible' }),
  };
  const cssMock = {
    escape: (value) => String(value),
  };

  const api = new Function('window', 'document', 'CSS', `
${bundle}
return { findCountryDropdown, findRegionDropdown, matchesCountryOption, matchesRegionOption };
`)(windowMock, documentMock, cssMock);

  assert.equal(api.findCountryDropdown(), countryDropdown);
  assert.equal(api.findRegionDropdown(), regionDropdown);
  assert.equal(api.matchesCountryOption('日本', 'JP'), true);
  assert.equal(api.matchesCountryOption('德国', 'DE'), true);
  assert.equal(api.matchesRegionOption('東京都', 'Tokyo'), true);
});

test('payment method helpers can find and confirm selected GoPay controls', () => {
  const bundle = [
    "const PLUS_PAYMENT_METHOD_PAYPAL = 'paypal';",
    "const PLUS_PAYMENT_METHOD_GOPAY = 'gopay';",
    "const PAYMENT_METHOD_CONFIGS = { paypal: { id: 'paypal', label: 'PayPal', patterns: [/paypal/i] }, gopay: { id: 'gopay', label: 'GoPay', patterns: [/gopay|go\\\\s*pay/i] } };",
    extractFunction('isVisibleElement'),
    extractFunction('normalizeText'),
    extractFunction('getActionText'),
    extractFunction('getSearchText'),
    extractFunction('getFieldText'),
    extractFunction('getCombinedSearchText'),
    extractFunction('getVisibleControls'),
    extractFunction('isEnabledControl'),
    extractFunction('isDocumentLevelContainer'),
    extractFunction('isPaymentCardSized'),
    extractFunction('findInteractiveAncestor'),
    extractFunction('findPaymentCardAncestor'),
    extractFunction('normalizePlusPaymentMethod'),
    extractFunction('getPaymentMethodConfig'),
    extractFunction('getPaymentMethodSearchCandidates'),
    extractFunction('getGoPaySearchCandidates'),
    extractFunction('findPaymentMethodTarget'),
    extractFunction('findGoPayPaymentMethodTarget'),
    extractFunction('hasPaymentMethodSelectionMarker'),
    extractFunction('hasSelectedPaymentMethodControl'),
    extractFunction('hasSelectedGoPayControl'),
    extractFunction('isPaymentMethodActive'),
    extractFunction('isGoPayPaymentMethodActive'),
  ].join('\n');

  const gopayButton = createElement({
    text: 'GoPay',
    attrs: {
      id: 'gopay-tab',
      role: 'tab',
      'data-testid': 'gopay',
      'aria-selected': 'true',
      value: 'gopay',
    },
  });
  const elements = [gopayButton];
  const documentMock = {
    documentElement: {},
    body: {},
    querySelectorAll: (selector) => {
      if (String(selector || '').includes('label[for=')) return [];
      return elements;
    },
  };
  const windowMock = {
    innerWidth: 1200,
    innerHeight: 900,
    getComputedStyle: () => ({ display: 'block', visibility: 'visible' }),
  };
  const cssMock = {
    escape: (value) => String(value),
  };

  const api = new Function('window', 'document', 'CSS', `
function findClickableByText(patterns) {
  return elements.find((el) => patterns.some((pattern) => pattern.test(getCombinedSearchText(el)))) || null;
}
const elements = document.querySelectorAll('*');
${bundle}
return { findGoPayPaymentMethodTarget, getGoPaySearchCandidates, hasSelectedGoPayControl, isGoPayPaymentMethodActive };
`)(windowMock, documentMock, cssMock);

  assert.equal(api.findGoPayPaymentMethodTarget(), gopayButton);
  assert.equal(api.getGoPaySearchCandidates()[0], gopayButton);
  assert.equal(api.hasSelectedGoPayControl(), true);
  assert.equal(api.isGoPayPaymentMethodActive(), true);
});

test('GoPay active detection accepts nested selected radio inside payment card', () => {
  const bundle = [
    "const PLUS_PAYMENT_METHOD_PAYPAL = 'paypal';",
    "const PLUS_PAYMENT_METHOD_GOPAY = 'gopay';",
    "const PAYMENT_METHOD_CONFIGS = { paypal: { id: 'paypal', label: 'PayPal', patterns: [/paypal/i] }, gopay: { id: 'gopay', label: 'GoPay', patterns: [/gopay|go\\s*pay/i] } };",
    extractFunction('isVisibleElement'),
    extractFunction('normalizeText'),
    extractFunction('getActionText'),
    extractFunction('getSearchText'),
    extractFunction('getFieldText'),
    extractFunction('getCombinedSearchText'),
    extractFunction('getVisibleControls'),
    extractFunction('isDocumentLevelContainer'),
    extractFunction('normalizePlusPaymentMethod'),
    extractFunction('getPaymentMethodConfig'),
    extractFunction('getPaymentMethodSearchCandidates'),
    extractFunction('hasPaymentMethodSelectionMarker'),
    extractFunction('hasSelectedPaymentMethodControl'),
    extractFunction('hasSelectedGoPayControl'),
    extractFunction('isPaymentMethodActive'),
    extractFunction('isGoPayPaymentMethodActive'),
  ].join('\n');

  const radio = createElement({
    tagName: 'INPUT',
    attrs: {
      type: 'radio',
      role: 'radio',
      'aria-checked': 'true',
      value: 'gopay',
    },
  });
  radio.checked = true;
  const textNode = createElement({ tagName: 'SPAN', text: 'GoPay' });
  const card = createElement({ tagName: 'DIV', text: 'GoPay' });
  radio.parentElement = card;
  textNode.parentElement = card;
  card.children = [radio, textNode];
  card.querySelector = (selector) => String(selector || '').includes('radio') ? radio : null;
  const elements = [card, radio, textNode];
  const documentMock = {
    documentElement: {},
    body: {},
    querySelectorAll: (selector) => {
      if (String(selector || '').includes('label[for=')) return [];
      return elements.filter((element) => {
        if (String(selector || '').includes('input[type="radio"]')) return element === radio || element === card || element === textNode;
        return true;
      });
    },
  };
  const windowMock = {
    innerWidth: 1200,
    innerHeight: 900,
    getComputedStyle: () => ({ display: 'block', visibility: 'visible' }),
  };
  const cssMock = {
    escape: (value) => String(value),
  };

  const api = new Function('window', 'document', 'CSS', `
${bundle}
return { isGoPayPaymentMethodActive };
`)(windowMock, documentMock, cssMock);

  assert.equal(api.isGoPayPaymentMethodActive(), true);
});

test('fillIfEmpty can overwrite invalid structured address values in the dropdown branch', () => {
  const bundle = [
    extractFunction('fillIfEmpty'),
  ].join('\n');
  const input = { value: '77022' };
  const writes = [];
  const api = new Function('input', 'writes', `
function fillInput(el, value) {
  writes.push(value);
  el.value = value;
}
${bundle}
return { fillIfEmpty };
`)(input, writes);

  assert.equal(api.fillIfEmpty(input, '100-0005'), false);
  assert.equal(input.value, '77022');
  assert.equal(api.fillIfEmpty(input, '100-0005', { overwrite: true }), true);
  assert.equal(input.value, '100-0005');
  assert.deepEqual(writes, ['100-0005']);
});
