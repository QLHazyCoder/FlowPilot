const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const vm = require('node:vm');

const source = fs.readFileSync('content/gopay-flow.js', 'utf8');

function extractFunction(name) {
  const markers = [`async function ${name}(`, `function ${name}(`];
  const start = markers
    .map((marker) => source.indexOf(marker))
    .find((index) => index >= 0);
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
      if (parenDepth === 0) signatureEnded = true;
    } else if (ch === '{' && signatureEnded) {
      braceStart = index;
      break;
    }
  }
  if (braceStart < 0) {
    throw new Error(`missing body for ${name}`);
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

function createGoPayContentHarness() {
  const gopayEvents = [];
  const attrs = new Map();
  let listener = null;
  let elements = [];
  let activeOperationLabel = null;
  const body = { innerText: 'Phone number: +86', textContent: 'Phone number: +86' };

  function createElement({ tagName = 'DIV', text = '', type = '', id = '', name = '', placeholder = '', attrs: initialAttrs = {}, onClick = null } = {}) {
    const attrMap = new Map(Object.entries(initialAttrs));
    if (type) attrMap.set('type', type);
    if (id) attrMap.set('id', id);
    if (name) attrMap.set('name', name);
    if (placeholder) attrMap.set('placeholder', placeholder);
    return {
      nodeType: 1,
      tagName,
      type,
      id,
      name,
      placeholder,
      textContent: text,
      innerText: text,
      value: '',
      className: initialAttrs.class || '',
      disabled: false,
      hidden: false,
      parentElement: null,
      style: { display: 'block', visibility: 'visible', opacity: '1' },
      getAttribute(key) {
        if (key === 'class') return this.className;
        if (key === 'type') return this.type || attrMap.get(key) || '';
        if (key === 'id') return this.id || attrMap.get(key) || '';
        if (key === 'name') return this.name || attrMap.get(key) || '';
        if (key === 'placeholder') return this.placeholder || attrMap.get(key) || '';
        return attrMap.has(key) ? attrMap.get(key) : null;
      },
      scrollIntoView() {},
      focus() {},
      dispatchEvent() { return true; },
      click() {
        if (typeof onClick === 'function') onClick(this);
        const field = this.getAttribute('data-test-field');
        if (field) {
          gopayEvents.push({ type: 'click', field, label: activeOperationLabel });
        }
      },
      getBoundingClientRect() { return { left: 20, top: 30, width: 180, height: 44 }; },
    };
  }

  const context = {
    console: { log() {}, warn() {}, error() {}, info() {} },
    location: { href: 'https://gopay.co.id/linking' },
    window: {},
    document: {
      readyState: 'complete',
      body,
      documentElement: {
        getAttribute(name) { return attrs.get(name) || null; },
        setAttribute(name, value) { attrs.set(name, String(value)); },
      },
      querySelector(selector) {
        if (selector === '.search-country') return null;
        return null;
      },
      querySelectorAll(selector) {
        const text = String(selector || '');
        if (text.includes('country-item') || text.includes('[role="option"]') || text.includes('li')) {
          return elements.filter((element) => element.tagName === 'LI' || /country-item/i.test(element.className) || element.getAttribute('role') === 'option');
        }
        if (text.includes('button') || text.includes('[role="button"]') || text.includes('a')) return elements.filter((element) => element.tagName === 'BUTTON' || element.tagName === 'A');
        if (text.includes('input') || text.includes('textarea')) return elements.filter((element) => element.tagName === 'INPUT' || element.tagName === 'TEXTAREA');
        if (text.includes('li') || text.includes('[role="option"]') || text.includes('div') || text.includes('span')) return [];
        return [];
      },
    },
    chrome: {
      runtime: {
        onMessage: { addListener(fn) { listener = fn; } },
      },
    },
    CodexOperationDelay: {
      async performOperationWithDelay(metadata, operation) {
        gopayEvents.push({ type: 'operation', label: metadata.label, kind: metadata.kind });
        const previousOperationLabel = activeOperationLabel;
        activeOperationLabel = metadata.label;
        let result;
        try {
          result = await operation();
        } finally {
          activeOperationLabel = previousOperationLabel;
        }
        gopayEvents.push({ type: 'delay', label: metadata.label, ms: 2000 });
        return result;
      },
    },
    resetStopState() {},
    isStopError() { return false; },
    throwIfStopped() {},
    sleep() { return Promise.resolve(); },
    fillInput(element, value) {
      element.value = value;
      const field = element.getAttribute?.('data-test-field');
      if (field) {
        gopayEvents.push({ type: 'fill', field, label: activeOperationLabel, value });
      }
    },
    MouseEvent: class TestMouseEvent { constructor(type) { this.type = type; } },
    PointerEvent: class TestPointerEvent { constructor(type) { this.type = type; } },
    KeyboardEvent: class TestKeyboardEvent { constructor(type) { this.type = type; } },
  };
  context.window = context;
  context.window.getComputedStyle = (element) => element?.style || { display: 'block', visibility: 'visible', opacity: '1' };
  context.window.screenX = 0;
  context.window.screenY = 0;
  context.window.innerWidth = 390;
  context.window.innerHeight = 844;

  vm.createContext(context);
  vm.runInContext(source, context);
  assert.equal(typeof listener, 'function');

  async function send(message) {
    return await new Promise((resolve) => {
      listener(message, {}, resolve);
    });
  }

  return {
    gopayEvents,
    send,
    showPhonePage() {
      body.innerText = 'Phone number: +86';
      body.textContent = body.innerText;
      elements = [
        createElement({ tagName: 'INPUT', type: 'tel', id: 'phone', name: 'gopay_phone', placeholder: 'GoPay phone' }),
        createElement({ tagName: 'BUTTON', text: 'Continue', id: 'continue-phone' }),
      ];
    },
    showPhonePageWithCountryMismatch() {
      body.innerText = 'Phone number: +86';
      body.textContent = body.innerText;
      const countryToggle = createElement({ tagName: 'BUTTON', text: '+86', id: 'country-toggle', attrs: { class: 'phone-code-wrapper', 'data-test-field': 'country-toggle' } });
      const countrySearch = createElement({ tagName: 'INPUT', type: 'text', id: 'country-search', name: 'country_search', placeholder: 'Country code', attrs: { 'data-test-field': 'country-search' } });
      const countryOption = createElement({
        tagName: 'LI',
        text: 'Indonesia +62',
        id: 'country-option-id',
        attrs: { class: 'country-item', role: 'option', 'data-test-field': 'country-option' },
        onClick: () => {
          countryToggle.textContent = '+62';
          countryToggle.innerText = '+62';
          body.innerText = 'Phone number: +62';
          body.textContent = body.innerText;
        },
      });
      elements = [
        countryToggle,
        countrySearch,
        countryOption,
        createElement({ tagName: 'INPUT', type: 'tel', id: 'phone', name: 'gopay_phone', placeholder: 'GoPay phone' }),
        createElement({ tagName: 'BUTTON', text: 'Continue', id: 'continue-phone' }),
      ];
    },
    showOtpPage() {
      body.innerText = 'Enter OTP code from WhatsApp';
      body.textContent = body.innerText;
      elements = [
        createElement({ tagName: 'INPUT', type: 'text', id: 'otp', name: 'otp', placeholder: 'OTP code' }),
        createElement({ tagName: 'BUTTON', text: 'Continue', id: 'continue-otp' }),
      ];
    },
    showPinPage() {
      body.innerText = 'Enter PIN to continue';
      body.textContent = body.innerText;
      elements = [
        createElement({ tagName: 'INPUT', type: 'password', id: 'pin', name: 'pin', placeholder: 'PIN' }),
        createElement({ tagName: 'BUTTON', text: 'Continue', id: 'continue-pin' }),
      ];
    },
    showContinuePage() {
      body.innerText = 'Link your GoPay account';
      body.textContent = body.innerText;
      elements = [createElement({ tagName: 'BUTTON', text: 'Hubungkan', id: 'continue' })];
    },
    showPayNowPage() {
      body.innerText = 'Confirm payment';
      body.textContent = body.innerText;
      elements = [createElement({ tagName: 'BUTTON', text: 'Pay now' })];
    },
  };
}

test('GoPay human click helper dispatches pointer and mouse sequence before native click', async () => {
  const bundle = [
    extractFunction('dispatchPointerMouseSequence'),
    extractFunction('humanClickElement'),
  ].join('\n');
  const events = [];
  const button = {
    tagName: 'BUTTON',
    scrollIntoView() { events.push('scroll'); },
    focus() { events.push('focus'); },
    click() { events.push('native-click'); },
    getBoundingClientRect() { return { left: 10, top: 20, width: 100, height: 40 }; },
    dispatchEvent(event) {
      events.push(event.type);
      return true;
    },
  };

  const api = new Function('button', 'events', `
const window = { screenX: 0, screenY: 0 };
class MouseEvent { constructor(type, init = {}) { this.type = type; this.init = init; } }
class PointerEvent extends MouseEvent {}
async function sleep() { events.push('sleep'); }
${bundle}
return { humanClickElement };
`)(button, events);

  await api.humanClickElement(button, { beforeMs: 1, afterDispatchMs: 1, afterMs: 1 });

  assert.deepEqual(events.slice(0, 3), ['scroll', 'sleep', 'focus']);
  assert.ok(events.includes('pointerdown'));
  assert.ok(events.includes('mousedown'));
  assert.ok(events.includes('mouseup'));
  assert.ok(events.includes('click'));
  assert.equal(events.at(-2), 'native-click');
});

test('GoPay content routes form submits and terminal clicks through the operation delay gate', async () => {
  const harness = createGoPayContentHarness();

  harness.showPhonePage();
  assert.equal((await harness.send({ type: 'GOPAY_SUBMIT_PHONE', payload: { phone: '+8613800138000', countryCode: '+86' } })).ok, true);

  harness.showOtpPage();
  assert.equal((await harness.send({ type: 'GOPAY_SUBMIT_OTP', payload: { otp: '123456' } })).ok, true);

  harness.showPinPage();
  assert.equal((await harness.send({ type: 'GOPAY_SUBMIT_PIN', payload: { pin: '654321' } })).ok, true);

  harness.showContinuePage();
  assert.equal((await harness.send({ type: 'GOPAY_CLICK_CONTINUE', payload: {} })).ok, true);

  harness.showPayNowPage();
  assert.equal((await harness.send({ type: 'GOPAY_CLICK_PAY_NOW', payload: {} })).ok, true);

  assert.deepStrictEqual(harness.gopayEvents.filter((event) => event.type === 'delay').map((event) => event.label), [
    'submit-phone',
    'submit-otp',
    'submit-pin',
    'click-continue',
    'click-pay-now',
  ]);
  assert.equal(harness.gopayEvents.some((event) => event.type === 'delay' && event.ms !== 2000), false);
});

test('GoPay country-code changes occur inside the submit-phone operation delay gate', async () => {
  const harness = createGoPayContentHarness();

  harness.showPhonePageWithCountryMismatch();
  const result = await harness.send({ type: 'GOPAY_SUBMIT_PHONE', payload: { phone: '+6281234567890', countryCode: '+62' } });

  assert.equal(result.ok, true);
  assert.equal(result.countryChanged, true);
  const countryEvents = harness.gopayEvents.filter((event) => ['country-toggle', 'country-search', 'country-option'].includes(event.field));
  assert.deepStrictEqual(countryEvents.map((event) => event.type), ['click', 'fill', 'click']);
  assert.deepStrictEqual(countryEvents.map((event) => event.label), ['submit-phone', 'submit-phone', 'submit-phone']);
  assert.deepStrictEqual(harness.gopayEvents.filter((event) => event.type === 'delay').map((event) => event.label), ['submit-phone']);
});


test('GoPay continue target exposes a debugger-clickable rect', () => {
  const bundle = [
    extractFunction('normalizeText'),
    extractFunction('getActionText'),
    extractFunction('isVisibleElement'),
    extractFunction('getVisibleControls'),
    extractFunction('isEnabledControl'),
    extractFunction('findClickableByText'),
    extractFunction('findContinueButton'),
    extractFunction('describeElement'),
    extractFunction('getElementClickRect'),
    extractFunction('getGoPayContinueTarget'),
  ].join('\n');
  const button = {
    tagName: 'BUTTON',
    id: 'link-and-pay',
    className: 'btn primary',
    textContent: 'Link and pay',
    innerText: 'Link and pay',
    value: '',
    disabled: false,
    hidden: false,
    parentElement: null,
    getAttribute(name) {
      if (name === 'class') return this.className;
      return '';
    },
    getBoundingClientRect() { return { left: 20, top: 30, width: 160, height: 44 }; },
  };
  const api = new Function('button', `
const window = {
  getComputedStyle() { return { display: 'block', visibility: 'visible', opacity: '1' }; },
  innerWidth: 390,
  innerHeight: 844,
};
const document = {
  querySelectorAll(selector) {
    return selector.includes('button') || selector.includes('[role="button"]') ? [button] : [];
  },
};
${bundle}
return { getGoPayContinueTarget };
`)(button);

  const target = api.getGoPayContinueTarget();
  assert.equal(target.found, true);
  assert.equal(target.rect.centerX, 100);
  assert.equal(target.rect.centerY, 52);
  assert.match(target.target, /Link and pay/);
});

test('GoPay continue target recognizes Indonesian Hubungkan linking button', () => {
  const bundle = [
    extractFunction('normalizeText'),
    extractFunction('getActionText'),
    extractFunction('isVisibleElement'),
    extractFunction('getVisibleControls'),
    extractFunction('isEnabledControl'),
    extractFunction('findClickableByText'),
    extractFunction('findContinueButton'),
    extractFunction('describeElement'),
    extractFunction('getElementClickRect'),
    extractFunction('getGoPayContinueTarget'),
  ].join('\n');
  const button = {
    tagName: 'BUTTON',
    id: '',
    className: 'btn primary',
    textContent: 'Hubungkan',
    innerText: 'Hubungkan',
    value: '',
    disabled: false,
    hidden: false,
    parentElement: null,
    getAttribute(name) {
      if (name === 'class') return this.className;
      return '';
    },
    getBoundingClientRect() { return { left: 40, top: 720, width: 280, height: 48 }; },
  };
  const termsLink = {
    ...button,
    tagName: 'A',
    className: 'terms-link',
    textContent: 'Syarat & Ketentuan',
    innerText: 'Syarat & Ketentuan',
    getBoundingClientRect() { return { left: 120, top: 650, width: 120, height: 16 }; },
  };
  const api = new Function('button', 'termsLink', `
const window = {
  getComputedStyle() { return { display: 'block', visibility: 'visible', opacity: '1' }; },
  innerWidth: 390,
  innerHeight: 844,
};
const document = {
  querySelectorAll(selector) {
    return selector.includes('button') || selector.includes('a') || selector.includes('[role="button"]') ? [termsLink, button] : [];
  },
};
${bundle}
return { findContinueButton, getGoPayContinueTarget };
`)(button, termsLink);

  assert.equal(api.findContinueButton(), button);
  const target = api.getGoPayContinueTarget();
  assert.equal(target.found, true);
  assert.match(target.target, /Hubungkan/);
  assert.equal(target.rect.centerX, 180);
  assert.equal(target.rect.centerY, 744);
});


test('GoPay PIN page detection wins over generic pin-input OTP attributes', () => {
  const bundle = [
    extractFunction('normalizeText'),
    extractFunction('getActionText'),
    extractFunction('getPageBodyText'),
    extractFunction('isGoPayOtpPageText'),
    extractFunction('isGoPayPinPageText'),
    extractFunction('isGoPayPinInput'),
    extractFunction('isVisibleElement'),
    extractFunction('getVisibleControls'),
    extractFunction('isEnabledControl'),
    extractFunction('getVisibleTextInputs'),
    extractFunction('isCountrySearchInput'),
    extractFunction('getCombinedElementText'),
    extractFunction('findInputByPatterns'),
    extractFunction('findOtpInput'),
    extractFunction('getGoPayPinInputs'),
    extractFunction('findPinInput'),
    extractFunction('normalizeOtp'),
    extractFunction('fillVisibleOtpInputs'),
  ].join('\n');
  const pinInputs = Array.from({ length: 6 }, (_, index) => ({
    tagName: 'INPUT',
    type: 'text',
    id: '',
    className: 'pin-input password',
    textContent: '',
    value: '',
    placeholder: '○',
    maxLength: 1,
    disabled: false,
    hidden: false,
    parentElement: null,
    getAttribute(name) {
      if (name === 'maxlength') return '1';
      if (name === 'data-testid') return `pin-input-${index}`;
      if (name === 'class') return this.className;
      if (name === 'placeholder') return this.placeholder;
      return '';
    },
    getBoundingClientRect() { return { width: 40, height: 40 }; },
  }));
  const api = new Function('pinInputs', `
const location = { href: 'https://pin-web-client.gopayapi.com/auth/pin/verify' };
const window = { getComputedStyle() { return { display: 'block', visibility: 'visible', opacity: '1' }; } };
const document = {
  body: { innerText: 'Silakan ketik 6 digit PIN kamu buat lanjut. Lupa PIN', textContent: 'Silakan ketik 6 digit PIN kamu buat lanjut. Lupa PIN' },
  querySelectorAll(selector) { return selector.includes('input') ? pinInputs : []; },
};
${bundle}
return { isGoPayOtpPageText, isGoPayPinPageText, findOtpInput, findPinInput, getGoPayPinInputs, fillVisibleOtpInputs };
`)(pinInputs);

  assert.equal(api.isGoPayPinPageText(), true);
  assert.equal(api.isGoPayOtpPageText(), false);
  assert.equal(api.findOtpInput(), null);
  assert.equal(api.fillVisibleOtpInputs('123456'), false);
  assert.equal(api.findPinInput(), pinInputs[0]);
  assert.equal(api.getGoPayPinInputs().length, 6);
});


test('GoPay Pay now button is detected separately from generic continue actions', () => {
  const bundle = [
    extractFunction('normalizeText'),
    extractFunction('getActionText'),
    extractFunction('isVisibleElement'),
    extractFunction('getVisibleControls'),
    extractFunction('isEnabledControl'),
    extractFunction('findClickableByText'),
    extractFunction('findPayNowButton'),
    extractFunction('describeElement'),
    extractFunction('getElementClickRect'),
    extractFunction('getGoPayPayNowTarget'),
  ].join('\n');
  const payButton = {
    tagName: 'BUTTON',
    id: '',
    className: 'btn full primary btn-theme',
    textContent: 'Pay now',
    innerText: 'Pay now',
    value: '',
    disabled: false,
    hidden: false,
    parentElement: null,
    getAttribute(name) { return name === 'class' ? this.className : ''; },
    getBoundingClientRect() { return { left: 411, top: 689, width: 388, height: 38 }; },
  };
  const refreshButton = {
    ...payButton,
    className: 'refresh-button',
    textContent: 'Refresh',
    innerText: 'Refresh',
    getBoundingClientRect() { return { left: 705, top: 346, width: 90, height: 30 }; },
  };
  const api = new Function('payButton', 'refreshButton', `
const window = {
  getComputedStyle() { return { display: 'block', visibility: 'visible', opacity: '1' }; },
  innerWidth: 1280,
  innerHeight: 800,
};
const document = {
  querySelectorAll(selector) {
    return selector.includes('button') || selector.includes('[role="button"]') ? [refreshButton, payButton] : [];
  },
};
${bundle}
return { findPayNowButton, getGoPayPayNowTarget };
`)(payButton, refreshButton);

  assert.equal(api.findPayNowButton(), payButton);
  assert.equal(api.getGoPayPayNowTarget().found, true);
  assert.match(api.getGoPayPayNowTarget().target, /Pay now/);
});


test('GoPay final Bayar amount button is detected without matching terms link', () => {
  const bundle = [
    extractFunction('normalizeText'),
    extractFunction('getActionText'),
    extractFunction('isVisibleElement'),
    extractFunction('getVisibleControls'),
    extractFunction('isEnabledControl'),
    extractFunction('findClickableByText'),
    extractFunction('findPayNowButton'),
  ].join('\n');
  const bayarButton = {
    tagName: 'BUTTON',
    className: 'bg-brand text-white',
    textContent: 'Bayar\nRp 1',
    innerText: 'Bayar\nRp 1',
    value: '',
    disabled: false,
    hidden: false,
    parentElement: null,
    getAttribute(name) { return name === 'class' ? this.className : ''; },
    getBoundingClientRect() { return { left: 16, top: 556, width: 388, height: 44 }; },
  };
  const termsLink = {
    ...bayarButton,
    tagName: 'A',
    className: 'font-semibold text-brand cursor-pointer',
    textContent: 'Syarat & Ketentuan',
    innerText: 'Syarat & Ketentuan',
    getBoundingClientRect() { return { left: 224, top: 608, width: 104, height: 16 }; },
  };
  const api = new Function('bayarButton', 'termsLink', `
const window = {
  getComputedStyle() { return { display: 'block', visibility: 'visible', opacity: '1' }; },
};
const document = {
  querySelectorAll(selector) {
    return selector.includes('button') || selector.includes('a') || selector.includes('[role="button"]') ? [termsLink, bayarButton] : [];
  },
};
${bundle}
return { findPayNowButton };
`)(bayarButton, termsLink);

  assert.equal(api.findPayNowButton(), bayarButton);
});


test('GoPay terminal timeout page is reported as retry-required state', () => {
  const bundle = [
    extractFunction('normalizeText'),
    extractFunction('getActionText'),
    extractFunction('getPageBodyText'),
    extractFunction('isGoPayPinPageText'),
    extractFunction('isGoPayPinInput'),
    extractFunction('detectGoPayTerminalError'),
    extractFunction('isGoPayOtpPageText'),
    extractFunction('isVisibleElement'),
    extractFunction('getVisibleControls'),
    extractFunction('isEnabledControl'),
    extractFunction('getVisibleTextInputs'),
    extractFunction('findInputByPatterns'),
    extractFunction('findPhoneInput'),
    extractFunction('isCountrySearchInput'),
    extractFunction('findOtpInput'),
    extractFunction('getCombinedElementText'),
    extractFunction('getGoPayPinInputs'),
    extractFunction('findPinInput'),
    extractFunction('findClickableByText'),
    extractFunction('findPayNowButton'),
    extractFunction('findContinueButton'),
    extractFunction('readSelectedCountryCodeText'),
    extractFunction('inspectGoPayState'),
  ].join('\n');
  const api = new Function(`
const location = { href: 'https://merchants-gws-app.gopayapi.com/app/challenge?reference=test' };
const window = { getComputedStyle() { return { display: 'none', visibility: 'hidden', opacity: '0' }; } };
const document = {
  body: { innerText: 'Yah, waktunya habis\\nKalau kamu mau coba lagi, tutup halaman ini dan ulangi prosesnya dari awal, ya.', textContent: '' },
  readyState: 'complete',
  querySelectorAll() { return []; },
};
${bundle}
return { inspectGoPayState, detectGoPayTerminalError };
`)();

  const state = api.inspectGoPayState();
  assert.equal(state.hasTerminalError, true);
  assert.equal(state.terminalError.code, 'expired');
  assert.match(state.terminalError.message, /重新创建 Plus Checkout|超时/);
});
