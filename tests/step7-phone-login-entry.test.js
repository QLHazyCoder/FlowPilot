const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');

const source = fs.readFileSync('content/signup-page.js', 'utf8');
const phoneAuthSource = fs.readFileSync('content/phone-auth.js', 'utf8');

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
  for (let i = start; i < source.length; i += 1) {
    const ch = source[i];
    if (ch === '(') {
      parenDepth += 1;
    } else if (ch === ')') {
      parenDepth -= 1;
      if (parenDepth === 0) {
        signatureEnded = true;
      }
    } else if (ch === '{' && signatureEnded) {
      braceStart = i;
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

function extractConst(name) {
  const pattern = new RegExp(`const\\s+${name}\\s*=\\s*[\\s\\S]*?;`);
  const match = source.match(pattern);
  if (!match) {
    throw new Error(`missing const ${name}`);
  }
  return match[0];
}

function createPhoneLoginEntryApi(options = {}) {
  const {
    href = 'https://auth.openai.com/log-in',
    pathname = '/log-in',
    inputAttributes = {},
    inputRootText = '',
    pageText = '',
    addPhoneForm = false,
    phoneUsernameKind = false,
  } = options;

  return new Function(`
${extractConst('ADD_PHONE_PAGE_PATTERN')}
${extractConst('LOGIN_PHONE_ENTRY_PAGE_PATTERN')}

const location = {
  href: ${JSON.stringify(phoneUsernameKind ? `${href}${href.includes('?') ? '&' : '?'}usernameKind=phone_number` : href)},
  pathname: ${JSON.stringify(pathname)},
};

const phoneInput = {
  type: ${JSON.stringify(inputAttributes.type || 'text')},
  maxLength: ${JSON.stringify(inputAttributes.maxLength ?? -1)},
  getAttribute(name) {
    return Object.prototype.hasOwnProperty.call(this.attributes, name) ? this.attributes[name] : '';
  },
  closest(selector) {
    if (!${JSON.stringify(Boolean(inputRootText))}) return null;
    if (String(selector || '').includes('fieldset') || String(selector || '').includes('div')) {
      return { textContent: ${JSON.stringify(inputRootText)} };
    }
    return null;
  },
  attributes: ${JSON.stringify(inputAttributes)},
};

const form = ${addPhoneForm ? '{ textContent: "Add phone number" }' : 'null'};

const document = {
  body: {
    innerText: ${JSON.stringify(pageText || inputRootText)},
    textContent: ${JSON.stringify(pageText || inputRootText)},
  },
  querySelector(selector) {
    const text = String(selector || '');
    if (text === 'form[action*="/add-phone" i]') return form;
    return null;
  },
  querySelectorAll(selector) {
    if (String(selector || '').includes('input')) return [phoneInput];
    return [];
  },
  getElementById() {
    return null;
  },
};

const CSS = {
  escape(value) {
    return String(value || '');
  },
};

function isVisibleElement(element) {
  return Boolean(element);
}

function isPhoneVerificationPageReady() {
  return false;
}

${extractFunction('getPageTextSnapshot')}
${extractFunction('isLoginPhoneUsernameKind')}
${extractFunction('isLoginPhoneEntryPageText')}
${extractFunction('isInsideHiddenPhoneControl')}
${extractFunction('getLoginInputAttributeText')}
${extractFunction('isLoginEmailLikeInput')}
${extractFunction('summarizePhoneInputCandidate')}
${extractFunction('isUsablePhoneInputElement')}
${extractFunction('collectPhoneInputCandidates')}
${extractFunction('findUsablePhoneInput')}
${extractFunction('getLoginEmailInput')}
${extractFunction('getLoginPhoneInput')}
${extractFunction('isAddPhonePageReady')}

return {
  getLoginEmailInput,
  getLoginPhoneInput,
  isAddPhonePageReady,
};
  `)();
}

test('step 7 treats localized phone login entry as phone input instead of add-phone', () => {
  const api = createPhoneLoginEntryApi({
    inputRootText: '\u6b22\u8fce\u56de\u6765 \u7535\u8bdd\u53f7\u7801 +61 \u7ee7\u7eed \u8fd8\u6ca1\u6709\u5e10\u6237\uff1f\u8bf7\u6ce8\u518c',
  });

  assert.ok(api.getLoginPhoneInput(), 'localized phone login input should be detected');
  assert.equal(api.isAddPhonePageReady(), false);
});

test('step 7 does not mistake email entry with a phone switch action for phone input', () => {
  const api = createPhoneLoginEntryApi({
    inputRootText: '\u7ee7\u7eed \u7ee7\u7eed\u4f7f\u7528\u624b\u673a\u767b\u5f55',
    inputAttributes: { type: 'text', placeholder: '\u7535\u5b50\u90ae\u4ef6\u5730\u5740' },
  });

  assert.equal(api.getLoginPhoneInput(), null);
  assert.equal(api.isAddPhonePageReady(), false);
});

test('step 7 treats unified OpenAI login page as email input despite phone option text', () => {
  const api = createPhoneLoginEntryApi({
    href: 'https://auth.openai.com/log-in-or-create-account',
    pathname: '/log-in-or-create-account',
    pageText: '\u767b\u5f55\u6216\u6ce8\u518c \u7535\u5b50\u90ae\u4ef6\u5730\u5740 \u7ee7\u7eed \u4f7f\u7528\u7535\u8bdd\u53f7\u7801\u7ee7\u7eed',
    inputAttributes: { type: 'text', placeholder: '\u7535\u5b50\u90ae\u4ef6\u5730\u5740' },
  });

  assert.ok(api.getLoginEmailInput(), 'unified login email input should be detected');
  assert.equal(api.getLoginPhoneInput(), null, 'phone option button must not turn email input into phone input');
});

test('step 7 clicks the generic other-account entry before phone entry', async () => {
  const api = new Function(`
const clicks = [];
const genericEntry = { id: 'generic', textContent: '\\u767b\\u5f55\\u81f3\\u53e6\\u4e00\\u4e2a\\u5e10\\u6237' };
const phoneEntry = { id: 'phone', textContent: '\\u4f7f\\u7528\\u7535\\u8bdd\\u53f7\\u7801\\u7ee7\\u7eed' };

function normalizeStep6Snapshot(snapshot) { return snapshot; }
function inspectLoginAuthState() {
  return { state: 'entry_page', loginEntryTrigger: genericEntry, phoneEntryTrigger: phoneEntry };
}
function findLoginEntryTrigger() { return genericEntry; }
function findLoginPhoneEntryTrigger() { return phoneEntry; }
function isActionEnabled() { return true; }
function getActionText(el) { return el.textContent || ''; }
function log() {}
async function humanPause() {}
function simulateClick(el) { clicks.push(el.id); }
async function waitForLoginEntryOpenTransition() { return { state: 'phone_entry_page' }; }
async function switchFromEmailPageToPhoneLogin() { return { routed: 'switch-phone' }; }
async function step6LoginFromEmailPage() { return { routed: 'email' }; }
async function step6LoginFromPasswordPage() { return { routed: 'password' }; }
async function step6LoginFromPhonePage() { return { routed: 'phone' }; }
async function finalizeStep6VerificationReady() { return { routed: 'verification' }; }
function createStep6OAuthConsentSuccessResult() { return { routed: 'oauth' }; }
function createStep6AddEmailSuccessResult() { return { routed: 'add-email' }; }
async function createStep6LoginTimeoutRecoveryTransition() { return { action: 'recoverable', result: { routed: 'recoverable' } }; }
function createStep6RecoverableResult(reason, snapshot, options = {}) {
  return { step6Outcome: 'recoverable', reason, state: snapshot?.state, message: options.message || '' };
}

${extractFunction('step6OpenLoginEntry')}

return { clicks, step6OpenLoginEntry };
  `)();

  const result = await api.step6OpenLoginEntry(
    { loginIdentifierType: 'phone', phoneNumber: '+441111111111' },
    { state: 'entry_page', loginEntryTrigger: { id: 'generic', textContent: '\u767b\u5f55\u81f3\u53e6\u4e00\u4e2a\u5e10\u6237' }, phoneEntryTrigger: { id: 'phone', textContent: '\u4f7f\u7528\u7535\u8bdd\u53f7\u7801\u7ee7\u7eed' } }
  );

  assert.deepStrictEqual(api.clicks, ['generic']);
  assert.equal(result.routed, 'phone');
});

test('step 7 detects username text input when usernameKind is phone_number', () => {
  const api = createPhoneLoginEntryApi({
    phoneUsernameKind: true,
    pageText: '\u6b22\u8fce\u56de\u6765',
    inputAttributes: { type: 'text', name: 'username', autocomplete: 'username' },
  });

  assert.ok(api.getLoginPhoneInput(), 'username text input should be treated as phone on phone login url');
});

test('step 7 ignores hidden phone inputs while resolving login phone entry', () => {
  const api = createPhoneLoginEntryApi({
    phoneUsernameKind: true,
    pageText: '\u7535\u8bdd\u53f7\u7801',
    inputAttributes: { type: 'hidden', name: 'phone' },
  });

  assert.equal(api.getLoginPhoneInput(), null);
});

test('add-phone detection stays true for real add-phone urls and forms', () => {
  assert.equal(
    createPhoneLoginEntryApi({
      href: 'https://auth.openai.com/add-phone',
      pathname: '/add-phone',
      inputRootText: '\u7535\u8bdd\u53f7\u7801',
    }).isAddPhonePageReady(),
    true
  );

  assert.equal(
    createPhoneLoginEntryApi({
      addPhoneForm: true,
      inputRootText: 'Add phone number',
    }).isAddPhonePageReady(),
    true
  );
});

test('phone login switch waits longer for slow OpenAI entry transitions', () => {
  assert.match(
    extractFunction('switchFromEmailPageToPhoneLogin'),
    /waitForPhoneLoginEntrySwitchTransition\(20000\)/
  );
});

test('step 7 switches visible phone login country by provider dial code before filling number', async () => {
  const api = new Function(`
const clicks = [];
let visibleCountryText = '\\u6fb3\\u5927\\u5229\\u4e9a (+61)';
let listboxOpen = false;

const phoneInput = {
  closest() {
    return null;
  },
};

const countryButton = {
  textContent: '',
  querySelector(selector) {
    if (selector === '.react-aria-SelectValue') {
      return {
        get textContent() {
          return visibleCountryText;
        },
      };
    }
    return null;
  },
};

const indonesiaOption = { textContent: '\\u5370\\u5ea6\\u5c3c\\u897f\\u4e9a +(62)' };
const unitedKingdomOption = { textContent: '\\u82f1\\u56fd +(44)' };

const document = {
  querySelectorAll(selector) {
    const text = String(selector || '');
    if (text === '[role="listbox"] [role="option"], [role="option"]') {
      return listboxOpen ? [indonesiaOption, unitedKingdomOption] : [];
    }
    if (text.includes('aria-haspopup="listbox"') || text.includes('aria-expanded')) {
      return [countryButton];
    }
    if (text === 'select') {
      return [];
    }
    return [];
  },
  querySelector(selector) {
    const matches = this.querySelectorAll(selector);
    return matches[0] || null;
  },
};

function isVisibleElement(element) {
  return Boolean(element);
}

function getActionText(element) {
  if (element === countryButton) return visibleCountryText;
  return String(element?.textContent || '').replace(/\\s+/g, ' ').trim();
}

function getPageTextSnapshot() {
  return visibleCountryText;
}

function simulateClick(target) {
  clicks.push(getActionText(target));
  if (target === countryButton) {
    listboxOpen = true;
  }
  if (target === unitedKingdomOption) {
    visibleCountryText = '\\u82f1\\u56fd +(44)';
    listboxOpen = false;
  }
}

async function sleep() {}
function throwIfStopped() {}

${extractFunction('normalizePhoneDigits')}
${extractFunction('extractDialCodeFromText')}
${extractFunction('dispatchSignupPhoneFieldEvents')}
${extractFunction('normalizeSignupCountryLabel')}
${extractFunction('getSignupCountryLabelAliases')}
${extractFunction('getSignupPhoneOptionLabel')}
${extractFunction('normalizeSignupCountryOptionValue')}
${extractFunction('getSignupRegionDisplayName')}
${extractFunction('getSignupPhoneCountryMatchLabels')}
${extractFunction('isSameSignupCountryOption')}
${extractFunction('getSignupPhoneInput')}
${extractFunction('getSignupPhoneControlRoots')}
${extractFunction('querySignupPhoneCountryElements')}
${extractFunction('isSignupPhoneCountrySelect')}
${extractFunction('getSignupPhoneCountrySelect')}
${extractFunction('getSignupPhoneSelectedCountryOption')}
${extractFunction('getSignupPhoneCountryButtonText')}
${extractFunction('getSignupPhoneCountryButton')}
${extractFunction('getSignupPhoneDisplayedDialCode')}
${extractFunction('resolveSignupPhoneDialCodeFromNumber')}
${extractFunction('resolveSignupPhoneTargetDialCode')}
${extractFunction('getSignupPhoneCountryTargetLabels')}
${extractFunction('doesSignupPhoneCountryTextMatchTarget')}
${extractFunction('isSignupPhoneCountrySelectionSynced')}
${extractFunction('findSignupPhoneCountryOptionByLabel')}
${extractFunction('findSignupPhoneCountryOptionByPhoneNumber')}
${extractFunction('trySelectSignupPhoneCountryOption')}
${extractFunction('getVisibleSignupPhoneCountryListboxOptions')}
${extractFunction('findSignupPhoneCountryListboxOption')}
${extractFunction('trySelectSignupPhoneCountryListboxOption')}
${extractFunction('ensureSignupPhoneCountrySelected')}
function getLoginPhoneCountrySelect() { return null; }
function getLoginPhoneCountryOptionLabel() { return ''; }
${extractFunction('selectCountryForPhoneInput')}

return {
  async run() {
    return selectCountryForPhoneInput(phoneInput, '447423278610', '', { visibleStep: 7 });
  },
  getClicks() {
    return clicks.slice();
  },
  getVisibleCountryText() {
    return visibleCountryText;
  },
};
  `)();

  const dialCode = await api.run();

  assert.equal(dialCode, '44');
  assert.equal(api.getVisibleCountryText(), '\u82f1\u56fd +(44)');
  assert.deepEqual(api.getClicks(), ['\u6fb3\u5927\u5229\u4e9a (+61)', '\u82f1\u56fd +(44)']);
});

test('step 7 scrolls the phone login country listbox until the dial code option is rendered', async () => {
  const api = new Function(`
const clicks = [];
const scrollEvents = [];
let visibleCountryText = '\\u6fb3\\u5927\\u5229\\u4e9a (+61)';
let listboxOpen = false;
let ukRendered = false;

const phoneInput = {
  closest() {
    return null;
  },
};

const countryButton = {
  textContent: '',
  querySelector(selector) {
    if (selector === '.react-aria-SelectValue') {
      return {
        get textContent() {
          return visibleCountryText;
        },
      };
    }
    return null;
  },
};

const listbox = {
  scrollTop: 0,
  scrollHeight: 3200,
  clientHeight: 420,
  dispatchEvent(event) {
    scrollEvents.push({ type: event?.type || '', scrollTop: this.scrollTop });
    if (this.scrollTop >= 900) {
      ukRendered = true;
    }
    return true;
  },
};

const albaniaOption = { textContent: '\\u963f\\u5c14\\u5df4\\u5c3c\\u4e9a +(355)', parentElement: listbox };
const unitedKingdomOption = { textContent: '\\u82f1\\u56fd +(44)', parentElement: listbox };

const document = {
  body: {},
  documentElement: {},
  querySelectorAll(selector) {
    const text = String(selector || '');
    if (text === '[role="listbox"]') {
      return listboxOpen ? [listbox] : [];
    }
    if (text === '[role="listbox"] [role="option"], [role="option"]') {
      if (!listboxOpen) return [];
      return ukRendered ? [albaniaOption, unitedKingdomOption] : [albaniaOption];
    }
    if (text.includes('aria-haspopup="listbox"') || text.includes('aria-expanded')) {
      return [countryButton];
    }
    if (text === 'select') {
      return [];
    }
    return [];
  },
  querySelector(selector) {
    const items = this.querySelectorAll(selector);
    return items[0] || null;
  },
};

function isVisibleElement(element) {
  return Boolean(element);
}

function getActionText(element) {
  if (element === countryButton) return visibleCountryText;
  return String(element?.textContent || '').replace(/\\s+/g, ' ').trim();
}

function getPageTextSnapshot() {
  return visibleCountryText;
}

function simulateClick(target) {
  clicks.push(getActionText(target));
  if (target === countryButton) {
    listboxOpen = true;
  }
  if (target === unitedKingdomOption) {
    visibleCountryText = '\\u82f1\\u56fd +(44)';
    listboxOpen = false;
  }
}

async function sleep() {}
function throwIfStopped() {}

${extractFunction('normalizePhoneDigits')}
${extractFunction('extractDialCodeFromText')}
${extractFunction('dispatchSignupPhoneFieldEvents')}
${extractFunction('normalizeSignupCountryLabel')}
${extractFunction('getSignupCountryLabelAliases')}
${extractFunction('getSignupPhoneOptionLabel')}
${extractFunction('normalizeSignupCountryOptionValue')}
${extractFunction('getSignupRegionDisplayName')}
${extractFunction('getSignupPhoneCountryMatchLabels')}
${extractFunction('isSameSignupCountryOption')}
${extractFunction('getSignupPhoneInput')}
${extractFunction('getSignupPhoneControlRoots')}
${extractFunction('querySignupPhoneCountryElements')}
${extractFunction('isSignupPhoneCountrySelect')}
${extractFunction('getSignupPhoneCountrySelect')}
${extractFunction('getSignupPhoneSelectedCountryOption')}
${extractFunction('getSignupPhoneCountryButtonText')}
${extractFunction('getSignupPhoneCountryButton')}
${extractFunction('getSignupPhoneDisplayedDialCode')}
${extractFunction('resolveSignupPhoneDialCodeFromNumber')}
${extractFunction('resolveSignupPhoneTargetDialCode')}
${extractFunction('getSignupPhoneCountryTargetLabels')}
${extractFunction('doesSignupPhoneCountryTextMatchTarget')}
${extractFunction('isSignupPhoneCountrySelectionSynced')}
${extractFunction('findSignupPhoneCountryOptionByLabel')}
${extractFunction('findSignupPhoneCountryOptionByPhoneNumber')}
${extractFunction('trySelectSignupPhoneCountryOption')}
${extractFunction('getVisibleSignupPhoneCountryListboxOptions')}
${extractFunction('findSignupPhoneCountryListboxOption')}
${extractFunction('trySelectSignupPhoneCountryListboxOption')}
${extractFunction('ensureSignupPhoneCountrySelected')}
function getLoginPhoneCountrySelect() { return null; }
function getLoginPhoneCountryOptionLabel() { return ''; }
${extractFunction('selectCountryForPhoneInput')}

return {
  async run() {
    return selectCountryForPhoneInput(phoneInput, '447799342687', '', { visibleStep: 7 });
  },
  getClicks() {
    return clicks.slice();
  },
  getScrollEvents() {
    return scrollEvents.slice();
  },
  getVisibleCountryText() {
    return visibleCountryText;
  },
};
  `)();

  const dialCode = await api.run();

  assert.equal(dialCode, '44');
  assert.equal(api.getVisibleCountryText(), '\u82f1\u56fd +(44)');
  assert.equal(api.getScrollEvents().length > 0, true);
  assert.deepEqual(api.getClicks(), ['\u6fb3\u5927\u5229\u4e9a (+61)', '\u82f1\u56fd +(44)']);
});

function createPhoneFillApi(fillBehavior, options = {}) {
  const {
    initialValue = '+44',
  } = options;

  return new Function('fillBehavior', `
const fills = [];
const phoneInput = {
  value: ${JSON.stringify(initialValue)},
  form: null,
  getAttribute(name) {
    return name === 'value' ? this.value : '';
  },
  focus() {},
  closest() {
    return this.form;
  },
};

const hiddenPhoneInput = {
  type: 'hidden',
  value: '',
  events: [],
  getAttribute(name) {
    if (name === 'type') return 'hidden';
    if (name === 'name') return 'phone';
    return '';
  },
  dispatchEvent(event) {
    this.events.push(event.type);
  },
};

const root = {
  querySelectorAll(selector) {
    if (String(selector).includes('input[name="phone"]')) {
      return [hiddenPhoneInput];
    }
    return [];
  },
};
phoneInput.form = root;

function fillInput(input, value) {
  fills.push(value);
  fillBehavior(input, value);
}

async function sleep() {}
function throwIfStopped() {}
function isVisibleElement() { return false; }
function log() {}

${extractFunction('normalizePhoneDigits')}
${extractFunction('toNationalPhoneNumber')}
${extractFunction('toE164PhoneNumber')}
${extractFunction('getPhoneInputRenderedValue')}
${extractFunction('isPhoneInputValueVerified')}
${extractFunction('waitForPhoneInputValue')}
${extractFunction('formatPhoneHiddenFormValue')}
${extractFunction('getPhoneHiddenValueInput')}
${extractFunction('setPhoneHiddenValue')}
${extractFunction('syncPhoneHiddenFormValue')}
${extractFunction('isPhoneInputValueComplete')}
${extractFunction('getLoginPhoneFillCandidates')}
${extractFunction('getLoginPhoneInputDiagnostics')}
${extractFunction('getLoginPhoneHiddenValueDiagnostics')}
${extractFunction('fillLoginPhoneInputAndConfirm')}

return {
  run() {
    return fillLoginPhoneInputAndConfirm(phoneInput, {
      phoneNumber: '447780579093',
      dialCode: '44',
      visibleStep: 7,
      maxAttempts: 2,
    });
  },
  getFills() {
    return fills.slice();
  },
  getValue() {
    return phoneInput.value;
  },
  getHiddenValue() {
    return hiddenPhoneInput.value;
  },
  getHiddenEvents() {
    return hiddenPhoneInput.events.slice();
  },
};
  `)(fillBehavior);
}

test('step 7 keeps visible dial prefix when filling phone login and syncs the hidden value', async () => {
  const api = createPhoneFillApi((input, value) => {
    input.value = value;
  });

  const result = await api.run();

  assert.equal(result.inputValue, '7780579093');
  assert.equal(result.attemptedValue, '+447780579093');
  assert.equal(api.getValue(), '+447780579093');
  assert.equal(api.getHiddenValue(), '+447780579093');
  assert.deepEqual(api.getHiddenEvents(), ['input', 'change']);
  assert.deepEqual(api.getFills(), ['+447780579093']);
});

test('step 7 keeps national phone fill when visible login input has no dial prefix', async () => {
  const api = createPhoneFillApi((input, value) => {
    input.value = value;
  }, { initialValue: '' });

  const result = await api.run();

  assert.equal(result.inputValue, '7780579093');
  assert.equal(result.attemptedValue, '7780579093');
  assert.equal(api.getValue(), '7780579093');
  assert.equal(api.getHiddenValue(), '+447780579093');
  assert.deepEqual(api.getHiddenEvents(), ['input', 'change']);
  assert.deepEqual(api.getFills(), ['7780579093']);
});

test('step 7 stops before submit when phone fill never includes the local number', async () => {
  const api = createPhoneFillApi((input) => {
    input.value = '+44';
  });

  await assert.rejects(api.run, /7780579093/);
  assert.equal(api.getValue(), '+44');
  assert.deepEqual(api.getFills(), ['+447780579093', '7780579093', '+447780579093', '7780579093']);
});

function createPhoneAuthSubmitHarness(runModeEvents, runMode) {
  const selectedOption = { value: 'GB', textContent: 'United Kingdom (+44)' };
  const select = {
    value: 'GB',
    selectedIndex: 0,
    options: [selectedOption],
    dispatchEvent() {},
  };
  const phoneInput = {
    value: '',
    closest() {
      return addPhoneForm;
    },
  };
  const hiddenPhoneNumberInput = {
    value: '',
    events: [],
    dispatchEvent(event) {
      this.events.push(event.type);
    },
  };
  const submitButton = {
    disabled: false,
    textContent: 'Continue',
    getAttribute(name) {
      if (name === 'aria-disabled') return 'false';
      return '';
    },
  };
  const dialCodeSpan = { textContent: '44' };
  let phoneVerificationReady = false;

  const addPhoneForm = {
    querySelector(selector) {
      if (selector === 'input[type="tel"], input[name="__reservedForPhoneNumberInput_tel"], input[autocomplete="tel"]') {
        return phoneInput;
      }
      if (selector === 'input[name="phoneNumber"]') {
        return hiddenPhoneNumberInput;
      }
      if (selector === 'select') {
        return select;
      }
      return null;
    },
    querySelectorAll(selector) {
      if (selector === 'button[type="submit"], input[type="submit"]') {
        return [submitButton];
      }
      if (selector === 'span') {
        return [dialCodeSpan];
      }
      return [];
    },
  };
  const phoneVerificationForm = {
    querySelector() {
      return null;
    },
    querySelectorAll() {
      return [];
    },
  };
  const root = {
    document: {
      querySelector(selector) {
        if (selector === 'form[action*="/add-phone" i]') {
          return addPhoneForm;
        }
        if (selector === 'form[action*="/phone-verification" i]') {
          return phoneVerificationReady ? phoneVerificationForm : null;
        }
        return null;
      },
      querySelectorAll() {
        return [];
      },
      title: '',
    },
    location: {
      href: 'https://auth.openai.com/add-phone',
      pathname: '/add-phone',
    },
    Event: function Event(type, init = {}) {
      this.type = type;
      this.bubbles = Boolean(init.bubbles);
    },
  };
  const performOperationWithDelay = async (metadata, operation) => {
    const result = await operation();
    runModeEvents[runMode].push({
      delayMs: 2000,
      kind: metadata.kind,
      label: metadata.label,
    });
    return result;
  };
  root.CodexOperationDelay = { performOperationWithDelay };

  const phoneAuthModule = new Function('self', 'globalThis', `
const document = self.document;
const location = self.location;
const Event = self.Event;
${phoneAuthSource}
return self.MultiPagePhoneAuth;
  `)(root, root);

  const helpers = phoneAuthModule.createPhoneAuthHelpers({
    fillInput(input, value) {
      input.value = value;
    },
    getActionText(element) {
      return element?.textContent || '';
    },
    getPageTextSnapshot() {
      return '';
    },
    getVerificationErrorText() {
      return '';
    },
    humanPause: async () => {},
    isActionEnabled(element) {
      return Boolean(element) && !element.disabled && element.getAttribute?.('aria-disabled') !== 'true';
    },
    isAddPhonePageReady() {
      return true;
    },
    isConsentReady() {
      return false;
    },
    isPhoneVerificationPageReady() {
      return phoneVerificationReady;
    },
    isVisibleElement(element) {
      return Boolean(element);
    },
    performOperationWithDelay,
    simulateClick(element) {
      if (element === submitButton) {
        phoneVerificationReady = true;
      }
    },
    sleep: async () => {},
    throwIfStopped() {},
    waitForElement: async () => phoneInput,
  });

  return { helpers };
}

test('phone auth operation delay metadata is identical for auto and manual submit runs', async () => {
  const runModeEvents = { auto: [], manual: [] };

  for (const runMode of ['auto', 'manual']) {
    const { helpers } = createPhoneAuthSubmitHarness(runModeEvents, runMode);
    const result = await helpers.submitPhoneNumber({
      countryLabel: 'United Kingdom',
      phoneNumber: '447780579093',
      runMode,
    });
    assert.equal(result.phoneVerificationPage, true);
  }

  assert.ok(runModeEvents.auto.length > 0);
  assert.deepStrictEqual(runModeEvents.auto.map((event) => event.delayMs), runModeEvents.manual.map((event) => event.delayMs));
  assert.deepStrictEqual(runModeEvents.auto.map((event) => event.kind), runModeEvents.manual.map((event) => event.kind));
});
