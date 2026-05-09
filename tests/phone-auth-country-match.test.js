const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');

const source = fs.readFileSync('content/phone-auth.js', 'utf8');
const globalScope = { navigator: { language: 'zh-CN' } };
const api = new Function('self', `${source}; return self.MultiPagePhoneAuth;`)(globalScope);

function createFakeAddPhoneDom(config = {}) {
  const selectEvents = [];
  const hiddenInputEvents = [];
  let submitClicked = false;

  const options = (
    Array.isArray(config.options) && config.options.length
      ? config.options
      : [
        { value: 'US', textContent: '美国', buttonText: '美国 (+1)' },
        { value: 'TH', textContent: '泰国', buttonText: '泰国 (+66)' },
      ]
  ).map((entry) => ({
    value: String(entry?.value || '').trim(),
    textContent: String(entry?.textContent || '').trim(),
    buttonText: String(entry?.buttonText || entry?.textContent || '').trim(),
  }));

  const select = {
    options,
    selectedIndex: Math.max(0, Math.min(options.length - 1, Number(config.selectedIndex) || 0)),
    dispatchEvent(event) {
      selectEvents.push(event?.type || '');
      return true;
    },
  };

  Object.defineProperty(select, 'value', {
    get() {
      return options[select.selectedIndex]?.value || '';
    },
    set(nextValue) {
      const nextIndex = options.findIndex((option) => option.value === String(nextValue || ''));
      if (nextIndex >= 0) {
        select.selectedIndex = nextIndex;
      }
    },
  });

  const phoneInput = {
    value: '',
    type: 'tel',
    dispatchEvent() {
      return true;
    },
    closest() {
      return null;
    },
  };

  const hiddenPhoneInput = {
    value: '',
    dispatchEvent(event) {
      hiddenInputEvents.push(event?.type || '');
      return true;
    },
  };

  const selectValueNode = {
    get textContent() {
      return options[select.selectedIndex]?.buttonText || '';
    },
  };

  const countryButton = {
    querySelector(selector) {
      return selector === '.react-aria-SelectValue' ? selectValueNode : null;
    },
    get textContent() {
      return selectValueNode.textContent;
    },
  };

  const submitButton = {
    type: 'submit',
    click() {
      submitClicked = true;
    },
  };

  const form = {
    querySelector(selector) {
      switch (selector) {
        case 'select':
          return select;
        case 'input[type="tel"], input[name="__reservedForPhoneNumberInput_tel"], input[autocomplete="tel"]':
          return phoneInput;
        case 'input[name="phoneNumber"]':
          return hiddenPhoneInput;
        case 'button[aria-haspopup="listbox"]':
          return countryButton;
        default:
          return null;
      }
    },
    querySelectorAll(selector) {
      if (selector === 'button[type="submit"], input[type="submit"]') {
        return [submitButton];
      }
      return [];
    },
  };

  const document = {
    documentElement: {
      lang: 'zh-CN',
      getAttribute(name) {
        return name === 'lang' ? 'zh-CN' : '';
      },
    },
    querySelector(selector) {
      if (selector === 'form[action*="/add-phone" i]') {
        return form;
      }
      return null;
    },
  };

  return {
    document,
    hiddenInputEvents,
    hiddenPhoneInput,
    phoneInput,
    select,
    selectEvents,
    submitButton,
    wasSubmitClicked: () => submitClicked,
  };
}

test('phone auth matches english HeroSMS country labels against localized add-phone options', async () => {
  const originalDocument = global.document;
  const originalEvent = global.Event;
  const originalLocation = global.location;
  const OriginalDisplayNames = Intl.DisplayNames;

  const dom = createFakeAddPhoneDom();
  let phoneVerificationReady = false;

  global.document = dom.document;
  global.Event = class Event {
    constructor(type) {
      this.type = type;
    }
  };
  global.location = { href: 'https://auth.openai.com/add-phone' };
  Intl.DisplayNames = class DisplayNames {
    of(regionCode) {
      if (regionCode === 'TH') return 'Thailand';
      if (regionCode === 'US') return 'United States';
      return regionCode;
    }
  };

  try {
    const helpers = api.createPhoneAuthHelpers({
      fillInput: (element, value) => {
        element.value = value;
      },
      getActionText: () => '',
      getPageTextSnapshot: () => '',
      getVerificationErrorText: () => '',
      humanPause: async () => {},
      isActionEnabled: () => true,
      isAddPhonePageReady: () => true,
      isConsentReady: () => false,
      isPhoneVerificationPageReady: () => phoneVerificationReady,
      isVisibleElement: () => true,
      simulateClick: (element) => {
        element.click?.();
        phoneVerificationReady = true;
        global.location.href = 'https://auth.openai.com/phone-verification';
      },
      sleep: async () => {},
      throwIfStopped: () => {},
      waitForElement: async () => null,
    });

    const result = await helpers.submitPhoneNumber({
      countryLabel: 'Thailand',
      phoneNumber: '66959916439',
    });

    assert.equal(dom.select.value, 'TH');
    assert.deepStrictEqual(dom.selectEvents, ['input', 'change']);
    assert.equal(dom.phoneInput.value, '959916439');
    assert.equal(dom.hiddenPhoneInput.value, '+66959916439');
    assert.deepStrictEqual(dom.hiddenInputEvents, ['input', 'change']);
    assert.equal(dom.wasSubmitClicked(), true);
    assert.deepStrictEqual(result, {
      phoneVerificationPage: true,
      displayedPhone: '',
      url: 'https://auth.openai.com/phone-verification',
    });
  } finally {
    global.document = originalDocument;
    global.Event = originalEvent;
    global.location = originalLocation;
    Intl.DisplayNames = OriginalDisplayNames;
  }
});

test('phone auth keeps explicit international number and auto-selects country by dial code when label lookup fails', async () => {
  const originalDocument = global.document;
  const originalEvent = global.Event;
  const originalLocation = global.location;
  const OriginalDisplayNames = Intl.DisplayNames;

  const dom = createFakeAddPhoneDom({
    options: [
      { value: 'CO', textContent: 'Colombia (+57)', buttonText: 'Colombia (+57)' },
      { value: 'GB', textContent: 'United Kingdom (+44)', buttonText: 'United Kingdom (+44)' },
    ],
    selectedIndex: 0,
  });
  let phoneVerificationReady = false;

  global.document = dom.document;
  global.Event = class Event {
    constructor(type) {
      this.type = type;
    }
  };
  global.location = { href: 'https://auth.openai.com/add-phone' };
  Intl.DisplayNames = class DisplayNames {
    of(regionCode) {
      return regionCode;
    }
  };

  try {
    const helpers = api.createPhoneAuthHelpers({
      fillInput: (element, value) => {
        element.value = value;
      },
      getActionText: () => '',
      getPageTextSnapshot: () => '',
      getVerificationErrorText: () => '',
      humanPause: async () => {},
      isActionEnabled: () => true,
      isAddPhonePageReady: () => true,
      isConsentReady: () => false,
      isPhoneVerificationPageReady: () => phoneVerificationReady,
      isVisibleElement: () => true,
      simulateClick: (element) => {
        element.click?.();
        phoneVerificationReady = true;
        global.location.href = 'https://auth.openai.com/phone-verification';
      },
      sleep: async () => {},
      throwIfStopped: () => {},
      waitForElement: async () => null,
    });

    const result = await helpers.submitPhoneNumber({
      countryLabel: 'Country #16',
      phoneNumber: '+447999221823',
    });

    assert.equal(dom.select.value, 'GB');
    assert.equal(dom.phoneInput.value, '7999221823');
    assert.equal(dom.hiddenPhoneInput.value, '+447999221823');
    assert.equal(dom.wasSubmitClicked(), true);
    assert.deepStrictEqual(result, {
      phoneVerificationPage: true,
      displayedPhone: '',
      url: 'https://auth.openai.com/phone-verification',
    });
  } finally {
    global.document = originalDocument;
    global.Event = originalEvent;
    global.location = originalLocation;
    Intl.DisplayNames = OriginalDisplayNames;
  }
});

test('phone auth can auto-select country by dial code even when number has no plus prefix', async () => {
  const originalDocument = global.document;
  const originalEvent = global.Event;
  const originalLocation = global.location;
  const OriginalDisplayNames = Intl.DisplayNames;

  const dom = createFakeAddPhoneDom({
    options: [
      { value: 'CO', textContent: 'Colombia (+57)', buttonText: 'Colombia (+57)' },
      { value: 'GB', textContent: 'United Kingdom (+44)', buttonText: 'United Kingdom (+44)' },
    ],
    selectedIndex: 0,
  });
  let phoneVerificationReady = false;

  global.document = dom.document;
  global.Event = class Event {
    constructor(type) {
      this.type = type;
    }
  };
  global.location = { href: 'https://auth.openai.com/add-phone' };
  Intl.DisplayNames = class DisplayNames {
    of(regionCode) {
      return regionCode;
    }
  };

  try {
    const helpers = api.createPhoneAuthHelpers({
      fillInput: (element, value) => {
        element.value = value;
      },
      getActionText: () => '',
      getPageTextSnapshot: () => '',
      getVerificationErrorText: () => '',
      humanPause: async () => {},
      isActionEnabled: () => true,
      isAddPhonePageReady: () => true,
      isConsentReady: () => false,
      isPhoneVerificationPageReady: () => phoneVerificationReady,
      isVisibleElement: () => true,
      simulateClick: (element) => {
        element.click?.();
        phoneVerificationReady = true;
        global.location.href = 'https://auth.openai.com/phone-verification';
      },
      sleep: async () => {},
      throwIfStopped: () => {},
      waitForElement: async () => null,
    });

    const result = await helpers.submitPhoneNumber({
      countryLabel: 'Country #16',
      phoneNumber: '447999221823',
    });

    assert.equal(dom.select.value, 'GB');
    assert.equal(dom.phoneInput.value, '7999221823');
    assert.equal(dom.hiddenPhoneInput.value, '+447999221823');
    assert.equal(dom.wasSubmitClicked(), true);
    assert.deepStrictEqual(result, {
      phoneVerificationPage: true,
      displayedPhone: '',
      url: 'https://auth.openai.com/phone-verification',
    });
  } finally {
    global.document = originalDocument;
    global.Event = originalEvent;
    global.location = originalLocation;
    Intl.DisplayNames = OriginalDisplayNames;
  }
});

test('phone auth resend stops with PHONE_ROUTE_405_RECOVERY_FAILED instead of endless Try-again loop', async () => {
  const originalDocument = global.document;
  const originalLocation = global.location;
  const originalWindow = global.window;

  let retryClicks = 0;
  const fakeRetryButton = {
    getAttribute(name) {
      if (name === 'data-dd-action-name') return 'Try again';
      return '';
    },
    click() {
      retryClicks += 1;
    },
    textContent: 'Try again',
  };
  const fakeResendButton = {
    getAttribute(name) {
      if (name === 'value') return 'resend';
      return '';
    },
    textContent: 'Resend text message',
  };
  const fakePhoneForm = {
    querySelectorAll(selector) {
      if (selector === 'button, input[type="submit"], input[type="button"]') {
        return [fakeResendButton, fakeRetryButton];
      }
      return [];
    },
  };

  global.document = {
    title: 'Route Error',
    querySelector(selector) {
      if (selector === 'button[data-dd-action-name="Try again"]') {
        return fakeRetryButton;
      }
      if (selector === 'form[action*="/phone-verification" i]') {
        return fakePhoneForm;
      }
      return null;
    },
    querySelectorAll(selector) {
      if (selector === 'button, [role="button"], input[type="submit"], input[type="button"]') {
        return [fakeRetryButton, fakeResendButton];
      }
      return [];
    },
  };
  global.location = {
    href: 'https://auth.openai.com/phone-verification',
    pathname: '/phone-verification',
  };
  global.window = global;

  const helpers = api.createPhoneAuthHelpers({
    fillInput: () => {},
    getActionText: (element) => String(element?.textContent || ''),
    getPageTextSnapshot: () => (
      'Route Error (405 Method Not Allowed): You made a POST request to "/phone-verification" but did not provide an action.'
    ),
    getVerificationErrorText: () => '',
    humanPause: async () => {},
    isActionEnabled: () => true,
    isAddPhonePageReady: () => false,
    isConsentReady: () => false,
    isPhoneVerificationPageReady: () => true,
    isVisibleElement: () => true,
    simulateClick: (element) => {
      element?.click?.();
    },
    sleep: async () => {},
    throwIfStopped: () => {},
    waitForElement: async () => null,
  });

  try {
    await assert.rejects(
      () => helpers.resendPhoneVerificationCode(4000),
      /PHONE_ROUTE_405_RECOVERY_FAILED::/i
    );
    assert.ok(
      retryClicks > 0 && retryClicks <= 6,
      `expected bounded retry clicks (1..6), got ${retryClicks}`
    );
  } finally {
    global.document = originalDocument;
    global.location = originalLocation;
    global.window = originalWindow;
  }
});

test('phone auth probes WhatsApp resend channel without clicking', async () => {
  const originalDocument = global.document;
  const originalLocation = global.location;
  const originalWindow = global.window;
  let clickCount = 0;
  const fakeWhatsAppButton = {
    disabled: false,
    textContent: '重新发送 WhatsApp 消息',
    getAttribute() {
      return '';
    },
    click() {
      clickCount += 1;
    },
  };
  const fakePhoneForm = {
    querySelectorAll(selector) {
      if (selector === 'button, input[type="submit"], input[type="button"]') {
        return [fakeWhatsAppButton];
      }
      return [];
    },
  };

  global.document = {
    querySelector(selector) {
      if (selector === 'form[action*="/phone-verification" i]') {
        return fakePhoneForm;
      }
      return null;
    },
    querySelectorAll() {
      return [];
    },
  };
  global.location = {
    href: 'https://auth.openai.com/phone-verification',
    pathname: '/phone-verification',
  };
  global.window = global;

  const helpers = api.createPhoneAuthHelpers({
    fillInput: () => {},
    getActionText: (element) => String(element?.textContent || ''),
    getPageTextSnapshot: () => '重新发送 WhatsApp 消息',
    getVerificationErrorText: () => '',
    humanPause: async () => {},
    isActionEnabled: () => true,
    isAddPhonePageReady: () => false,
    isConsentReady: () => false,
    isPhoneVerificationPageReady: () => true,
    isVisibleElement: () => true,
    simulateClick: (element) => {
      element?.click?.();
    },
    sleep: async () => {},
    throwIfStopped: () => {},
    waitForElement: async () => null,
  });

  try {
    const result = await helpers.resendPhoneVerificationCode(1000, { probeOnly: true });

    assert.equal(result.resent, false);
    assert.equal(result.channel, 'whatsapp');
    assert.match(result.channelText, /WhatsApp/i);
    assert.equal(clickCount, 0);
  } finally {
    global.document = originalDocument;
    global.location = originalLocation;
    global.window = originalWindow;
  }
});

test('phone auth exposes resend page error checks for banned numbers', () => {
  const originalLocation = global.location;
  const originalDocument = global.document;
  try {
    global.location = {
      href: 'https://auth.openai.com/phone-verification',
      pathname: '/phone-verification',
    };
    global.document = {
      querySelector() {
        return {
          querySelector() {
            return null;
          },
          querySelectorAll() {
            return [];
          },
        };
      },
    };

    const helpers = api.createPhoneAuthHelpers({
      fillInput: () => {},
      getActionText: () => '',
      getPageTextSnapshot: () => 'We cannot send a text message to this phone number. Please try another.',
      getVerificationErrorText: () => '',
      humanPause: async () => {},
      isActionEnabled: () => true,
      isAddPhonePageReady: () => false,
      isConsentReady: () => false,
      isPhoneVerificationPageReady: () => true,
      isVisibleElement: () => true,
      simulateClick: () => {},
      sleep: async () => {},
      throwIfStopped: () => {},
      waitForElement: async () => null,
    });

    const result = helpers.checkPhoneResendError();
    assert.equal(result.hasError, true);
    assert.equal(result.reason, 'resend_phone_banned');
    assert.equal(result.prefix, 'PHONE_RESEND_BANNED_NUMBER::');
    assert.match(result.message, /cannot send/i);
  } finally {
    global.location = originalLocation;
    global.document = originalDocument;
  }
});
