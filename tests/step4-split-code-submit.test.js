const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');

const source = fs.readFileSync('content/signup-page.js', 'utf8');

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

test('fillVerificationCode submits after split inputs are stably filled', async () => {
  const api = new Function(`
const logs = [];
const clicks = [];
const filledValues = [];
const splitCodeEvents = [];
let activeOperationLabel = '';
let submitClicked = false;
const VERIFICATION_CODE_INPUT_SELECTOR = 'input[data-verification-code]';
const location = { href: 'https://auth.openai.com/email-verification' };
const window = {
  CodexOperationDelay: {
    async performOperationWithDelay(metadata, operation) {
      splitCodeEvents.push(\`operation:\${metadata.label}:start\`);
      activeOperationLabel = metadata.label;
      const result = await operation();
      activeOperationLabel = '';
      splitCodeEvents.push(\`operation:\${metadata.label}:end\`);
      splitCodeEvents.push(\`delay:\${metadata.label}:2000\`);
      return result;
    },
  },
};
function KeyboardEvent(type, init = {}) {
  this.type = type;
  Object.assign(this, init);
}

const submitBtn = {
  tagName: 'BUTTON',
  textContent: 'Continue',
  disabled: false,
  getAttribute(name) {
    if (name === 'type') return 'submit';
    if (name === 'aria-disabled') return 'false';
    return '';
  },
  click() {
    submitClicked = true;
  },
};

const inputs = Array.from({ length: 6 }, () => ({
  value: '',
  maxLength: 1,
  getAttribute(name) {
    if (name === 'maxlength') return '1';
    if (name === 'aria-disabled') return 'false';
    return '';
  },
  focus() {},
  dispatchEvent() {},
  closest() { return null; },
}));

const document = {
  querySelector(selector) {
    if (selector === VERIFICATION_CODE_INPUT_SELECTOR) return inputs[0];
    return null;
  },
  querySelectorAll(selector) {
    if (selector === 'input[maxlength="1"]') return inputs;
    if (selector === 'button[type="submit"], input[type="submit"]') return [submitBtn];
    if (selector === 'button, [role="button"], input[type="button"], input[type="submit"]') return [submitBtn];
    return [];
  },
};

function throwIfStopped() {}
function log(message, level = 'info') { logs.push({ message, level }); }
async function waitForLoginVerificationPageReady() {}
function is405MethodNotAllowedPage() { return false; }
async function handle405ResendError() {}
function fillInput(el, value) {
  el.value = value;
  filledValues.push(value);
  const splitIndex = inputs.indexOf(el);
  if (splitIndex >= 0) {
    splitCodeEvents.push(\`fill-code:\${splitIndex}\`);
  }
}
async function sleep(ms) {
  if (activeOperationLabel) {
    splitCodeEvents.push(\`sleep:\${activeOperationLabel}:\${ms}\`);
  }
}
async function waitForDocumentLoadComplete() {}
function isStep5Ready() { return false; }
function isStep8Ready() { return false; }
function isAddPhonePageReady() { return false; }
function isVerificationPageStillVisible() { return false; }
function isEmailVerificationPage() { return true; }
function isVisibleElement() { return true; }
function isActionEnabled(el) { return Boolean(el) && !el.disabled; }
function getActionText(el) { return el.textContent || ''; }
async function humanPause() {}
function simulateClick(el) { el.click(); clicks.push(el.textContent); splitCodeEvents.push('click:submit-code'); }
async function waitForVerificationSubmitOutcome() { return { success: true }; }

${extractFunction('getVisibleSplitVerificationInputs')}
${extractFunction('getVerificationCodeTarget')}
${extractFunction('getVerificationSubmitButtonForTarget')}
${extractFunction('waitForVerificationSubmitButton')}
${extractFunction('waitForVerificationCodeTarget')}
${extractFunction('waitForSplitVerificationInputsFilled')}
${extractFunction('isCombinedSignupVerificationProfilePage')}
${extractFunction('waitForCombinedSignupVerificationProfilePage')}
${extractFunction('isSignupProfilePageUrl')}
${extractFunction('isLikelyLoggedInChatgptHomeUrl')}
${extractFunction('getStep4PostVerificationState')}
${extractFunction('fillVerificationCode')}

return {
  run() {
    return fillVerificationCode(4, { code: '123456' });
  },
  snapshot() {
    return {
      logs,
      clicks,
      filledValues,
      splitCodeEvents,
      submitClicked,
      currentValue: inputs.map((input) => input.value).join(''),
    };
  },
};
`)();

  const result = await api.run();
  const snapshot = api.snapshot();

  assert.deepStrictEqual(result, { success: true });
  assert.equal(snapshot.currentValue, '123456');
  assert.equal(snapshot.submitClicked, true);
  assert.deepStrictEqual(snapshot.clicks, ['Continue']);
  assert.deepStrictEqual(snapshot.splitCodeEvents, [
    'operation:split-code:start',
    'fill-code:0',
    'fill-code:1',
    'fill-code:2',
    'fill-code:3',
    'fill-code:4',
    'fill-code:5',
    'operation:split-code:end',
    'delay:split-code:2000',
    'operation:submit-code:start',
    'click:submit-code',
    'operation:submit-code:end',
    'delay:submit-code:2000',
  ]);
  assert.equal(snapshot.splitCodeEvents.filter((event) => event.startsWith('delay:split-code')).length, 1);
});

test('fillVerificationCode treats phone signup SMS landing on email verification as handoff success', async () => {
  const api = new Function(`
let now = 0;
const logs = [];
const clicks = [];
const VERIFICATION_CODE_INPUT_SELECTOR = 'input[name="code"]';
const VERIFICATION_PAGE_PATTERN = /verification code/i;
const location = {
  href: 'https://auth.openai.com/phone-verification',
  pathname: '/phone-verification',
};
function KeyboardEvent(type, init = {}) {
  this.type = type;
  Object.assign(this, init);
}

const codeInput = {
  value: '',
  disabled: false,
  form: null,
  getAttribute(name) {
    if (name === 'maxlength') return '6';
    if (name === 'aria-disabled') return 'false';
    if (name === 'name') return 'code';
    return '';
  },
  closest() { return null; },
  focus() {},
  dispatchEvent() {},
};
const submitBtn = {
  tagName: 'BUTTON',
  textContent: 'Continue',
  disabled: false,
  getAttribute(name) {
    if (name === 'type') return 'submit';
    if (name === 'aria-disabled') return 'false';
    return '';
  },
  click() {
    location.href = 'https://auth.openai.com/email-verification';
    location.pathname = '/email-verification';
  },
};

const document = {
  readyState: 'complete',
  body: {
    textContent: 'Enter the verification code we just sent to your email',
    innerText: 'Enter the verification code we just sent to your email',
  },
  querySelector(selector) {
    if (selector === VERIFICATION_CODE_INPUT_SELECTOR && location.pathname === '/phone-verification') return codeInput;
    if (selector === 'button[type="submit"]' && location.pathname === '/phone-verification') return submitBtn;
    if (selector === 'form[action*="email-verification" i]' && location.pathname === '/email-verification') return {};
    return null;
  },
  querySelectorAll(selector) {
    if (selector === 'input[maxlength="1"]') return [];
    if (location.pathname === '/phone-verification' && selector === 'button[type="submit"], input[type="submit"]') return [submitBtn];
    if (location.pathname === '/phone-verification' && selector === 'button, [role="button"], input[type="button"], input[type="submit"]') return [submitBtn];
    if (location.pathname === '/email-verification' && selector === 'button, a, [role="button"], [role="link"], input[type="button"], input[type="submit"]') {
      return [{ textContent: 'Resend code', disabled: false, getAttribute() { return ''; } }];
    }
    return [];
  },
};

const Date = { now: () => now };
function throwIfStopped() {}
function log(message, level = 'info') { logs.push({ message, level }); }
async function waitForLoginVerificationPageReady() {}
function is405MethodNotAllowedPage() { return false; }
async function handle405ResendError() {}
function fillInput(el, value) { el.value = value; }
async function sleep(ms = 0) { now += ms || 15000; }
async function waitForDocumentLoadComplete() {}
function isStep5Ready() { return false; }
function isStep8Ready() { return false; }
function isAddPhonePageReady() { return false; }
function isVisibleElement() { return true; }
function isActionEnabled(el) { return Boolean(el) && !el.disabled; }
function getActionText(el) { return el?.textContent || ''; }
async function humanPause() {}
function simulateClick(el) { el.click(); clicks.push(el.textContent); }
function getVerificationErrorText() { return ''; }
function getCurrentAuthRetryPageState() { return null; }
async function recoverCurrentAuthRetryPage() { throw new Error('should not recover retry page'); }
function createSignupUserAlreadyExistsError() { return new Error('user already exists'); }
function isPhoneVerificationPageReady() { return location.pathname === '/phone-verification'; }
function getPageTextSnapshot() { return document.body.textContent; }
function findResendVerificationCodeTrigger() {
  return location.pathname === '/email-verification'
    ? { textContent: 'Resend code', disabled: false, getAttribute() { return ''; } }
    : null;
}

${extractFunction('getVisibleSplitVerificationInputs')}
${extractFunction('getVerificationCodeTarget')}
${extractFunction('isEmailVerificationPage')}
${extractFunction('isVerificationPageStillVisible')}
${extractFunction('isSignupProfilePageUrl')}
${extractFunction('isLikelyLoggedInChatgptHomeUrl')}
${extractFunction('getStep4PostVerificationState')}
${extractFunction('getVerificationSubmitButtonForTarget')}
${extractFunction('waitForVerificationSubmitButton')}
${extractFunction('waitForVerificationCodeTarget')}
${extractFunction('waitForSplitVerificationInputsFilled')}
${extractFunction('isCombinedSignupVerificationProfilePage')}
${extractFunction('waitForCombinedSignupVerificationProfilePage')}
${extractFunction('waitForVerificationSubmitOutcome')}
${extractFunction('fillVerificationCode')}

return {
  run() {
    return fillVerificationCode(4, { code: '123456', purpose: 'signup' });
  },
  snapshot() {
    return { clicks, logs, href: location.href };
  },
};
`)();

  const result = await api.run();
  const snapshot = api.snapshot();

  assert.equal(snapshot.href, 'https://auth.openai.com/email-verification');
  assert.deepStrictEqual(snapshot.clicks, ['Continue']);
  assert.equal(result.success, true);
  assert.equal(result.emailVerificationRequired, true);
  assert.equal(result.emailVerificationPage, true);
  assert.equal(result.url, 'https://auth.openai.com/email-verification');
  assert.equal(Object.prototype.hasOwnProperty.call(result, 'invalidCode'), false);
});

test('fillVerificationCode does not short-circuit on mixed email-verification profile page before verification exits', async () => {
  const api = new Function(`
const logs = [];
const location = { href: 'https://auth.openai.com/email-verification/register' };

function throwIfStopped() {}
function log(message, level = 'info') { logs.push({ message, level }); }
async function waitForLoginVerificationPageReady() {}
function is405MethodNotAllowedPage() { return false; }
async function handle405ResendError() {}
function fillInput() {}
async function sleep() {}
async function waitForDocumentLoadComplete() {}
function isStep5Ready() { return true; }
function isStep8Ready() { return false; }
function isAddPhonePageReady() { return false; }
function isVisibleElement() { return true; }
function isActionEnabled() { return true; }
function getActionText(el) { return el?.textContent || ''; }
async function humanPause() {}
function simulateClick() {}
function getCurrentAuthRetryPageState() { return null; }
function isPhoneVerificationPageReady() { return false; }
function getVerificationCodeTarget() { return { type: 'single', element: { value: '', form: null, closest() { return null; } } }; }
function findResendVerificationCodeTrigger() { return { textContent: 'Resend' }; }
function isEmailVerificationPage() { return true; }
function getPageTextSnapshot() { return 'Enter the verification code we just sent'; }

const document = {
  querySelector(selector) {
    if (selector === 'form[action*="email-verification" i]') return {};
    return null;
  },
  querySelectorAll() {
    return [];
  },
};

${extractFunction('isVerificationPageStillVisible')}
${extractFunction('isCombinedSignupVerificationProfilePage')}
${extractFunction('waitForCombinedSignupVerificationProfilePage')}
${extractFunction('isSignupProfilePageUrl')}
${extractFunction('isLikelyLoggedInChatgptHomeUrl')}
${extractFunction('getStep4PostVerificationState')}
${extractFunction('fillVerificationCode')}

return {
  async run() {
    try {
      await fillVerificationCode(4, { code: '123456' });
      return { ok: true };
    } catch (error) {
      return { ok: false, message: String(error?.message || error) };
    }
  },
};
`)();

  const result = await api.run();
  assert.deepStrictEqual(result, {
    ok: false,
    message: '未找到验证码输入框。URL: https://auth.openai.com/email-verification/register',
  });
});

test('fillVerificationCode prefills profile on combined verification/register page and skips step 5 after success', async () => {
  const api = new Function(`
const logs = [];
const clicks = [];
const filledValues = [];
let submitClicked = false;
const VERIFICATION_CODE_INPUT_SELECTOR = 'input[name="code"]';
const location = {
  href: 'https://auth.openai.com/email-verification/register',
  pathname: '/email-verification/register',
};
function KeyboardEvent(type, init = {}) {
  this.type = type;
  Object.assign(this, init);
}

const nameInput = {
  value: '',
  disabled: false,
  getAttribute(name) {
    if (name === 'name') return 'name';
    if (name === 'autocomplete') return 'name';
    return '';
  },
};
const ageInput = {
  value: '',
  disabled: false,
  getAttribute(name) {
    if (name === 'name') return 'age';
    return '';
  },
};
const codeInput = {
  value: '',
  disabled: false,
  form: null,
  getAttribute(name) {
    if (name === 'maxlength') return '6';
    if (name === 'aria-disabled') return 'false';
    if (name === 'name') return 'code';
    return '';
  },
  closest() { return null; },
  focus() {},
  dispatchEvent() {},
};
const submitBtn = {
  tagName: 'BUTTON',
  textContent: 'Continue',
  disabled: false,
  getAttribute(name) {
    if (name === 'type') return 'submit';
    if (name === 'aria-disabled') return 'false';
    return '';
  },
  click() {
    submitClicked = true;
  },
};

const document = {
  querySelector(selector) {
    switch (selector) {
      case 'input[name="name"], input[autocomplete="name"], input[name="birthday"], input[name="age"], [role="spinbutton"][data-type="year"]':
        return nameInput;
      case 'input[name="name"], input[placeholder*="全名"], input[autocomplete="name"]':
        return nameInput;
      case 'input[name="age"]':
        return ageInput;
      case '[role="spinbutton"][data-type="year"]':
      case '[role="spinbutton"][data-type="month"]':
      case '[role="spinbutton"][data-type="day"]':
      case 'input[name="birthday"]':
        return null;
      case 'form[action*="email-verification/register" i]':
      case 'form[action*="email-verification" i]':
        return { action: '/email-verification/register' };
      case VERIFICATION_CODE_INPUT_SELECTOR:
        return codeInput;
      case 'button[type="submit"]':
        return submitBtn;
      default:
        return null;
    }
  },
  querySelectorAll(selector) {
    if (selector === 'input[maxlength="1"]') return [];
    if (selector === 'button[type="submit"], input[type="submit"]') return [submitBtn];
    if (selector === 'button, [role="button"], input[type="button"], input[type="submit"]') return [submitBtn];
    if (selector === 'input[name="allCheckboxes"][type="checkbox"]') return [];
    if (selector === 'input[type="checkbox"]') return [];
    return [];
  },
  execCommand() {},
};

function throwIfStopped() {}
function log(message, level = 'info') { logs.push({ message, level }); }
async function waitForLoginVerificationPageReady() {}
function is405MethodNotAllowedPage() { return false; }
async function handle405ResendError() {}
function fillInput(el, value) {
  el.value = value;
  filledValues.push({ target: el === nameInput ? 'name' : (el === ageInput ? 'age' : 'code'), value });
}
async function sleep() {}
async function waitForDocumentLoadComplete() {}
function isStep5Ready() { return true; }
function isStep8Ready() { return false; }
function isAddPhonePageReady() { return false; }
function isVisibleElement(el) { return Boolean(el) && !el.disabled; }
function isActionEnabled(el) { return Boolean(el) && !el.disabled; }
function getActionText(el) { return el.textContent || ''; }
async function humanPause() {}
function simulateClick(el) { el.click(); clicks.push(el.textContent); }
function getCurrentAuthRetryPageState() { return null; }
function isPhoneVerificationPageReady() { return false; }
function findResendVerificationCodeTrigger() { return null; }
function isEmailVerificationPage() { return true; }
function isCombinedSignupVerificationProfilePage() { return true; }
function getPageTextSnapshot() { return 'Create your account Enter the verification code we just sent Tell us about you'; }
function findBirthdayReactAriaSelect() { return null; }
async function setReactAriaBirthdaySelect() {}
async function waitForElement(selector) {
  if (/input\\[name=\"name\"\\]/.test(selector)) {
    return nameInput;
  }
  throw new Error('unexpected selector ' + selector);
}
async function waitForElementByText() { return submitBtn; }
function isStep5AllConsentText() { return false; }
function findStep5AllConsentCheckbox() { return null; }
function isStep5CheckboxChecked() { return false; }
async function waitForVerificationSubmitOutcome() {
  return { success: true, skipProfileStep: true };
}

${extractFunction('getStep5DirectCompletionPayload')}
${extractFunction('isVerificationPageStillVisible')}
${extractFunction('isSignupProfilePageUrl')}
${extractFunction('isLikelyLoggedInChatgptHomeUrl')}
${extractFunction('getStep4PostVerificationState')}
${extractFunction('getVisibleSplitVerificationInputs')}
${extractFunction('getVerificationCodeTarget')}
${extractFunction('getVerificationSubmitButtonForTarget')}
${extractFunction('waitForVerificationSubmitButton')}
${extractFunction('waitForVerificationCodeTarget')}
${extractFunction('waitForSplitVerificationInputsFilled')}
${extractFunction('waitForCombinedSignupVerificationProfilePage')}
${extractFunction('step5_fillNameBirthday')}
${extractFunction('fillVerificationCode')}

return {
  run() {
    return fillVerificationCode(4, {
      code: '123456',
      signupProfile: {
        firstName: 'Ada',
        lastName: 'Lovelace',
        age: 22,
      },
    });
  },
  snapshot() {
    return {
      logs,
      clicks,
      filledValues,
      submitClicked,
      nameValue: nameInput.value,
      ageValue: ageInput.value,
      codeValue: codeInput.value,
    };
  },
};
`)();

  const result = await api.run();
  const snapshot = api.snapshot();

  assert.deepStrictEqual(result, {
    success: true,
    skipProfileStep: true,
    skipProfileStepReason: 'combined_verification_profile',
  });
  assert.equal(snapshot.nameValue, 'Ada Lovelace');
  assert.equal(snapshot.ageValue, '22');
  assert.equal(snapshot.codeValue, '123456');
  assert.equal(snapshot.submitClicked, true);
  assert.deepStrictEqual(snapshot.clicks, ['Continue']);
});

test('fillVerificationCode waits for delayed combined profile fields before prefilling', async () => {
  const api = new Function(`
const logs = [];
const clicks = [];
let submitClicked = false;
let nameQueryCount = 0;
const VERIFICATION_CODE_INPUT_SELECTOR = 'input[name="code"]';
const location = {
  href: 'https://auth.openai.com/email-verification/register',
  pathname: '/email-verification/register',
};
function KeyboardEvent(type, init = {}) {
  this.type = type;
  Object.assign(this, init);
}

const nameInput = {
  value: '',
  disabled: false,
  getAttribute(name) {
    if (name === 'name') return 'name';
    if (name === 'autocomplete') return 'name';
    return '';
  },
};
const ageInput = {
  value: '',
  disabled: false,
  getAttribute(name) {
    if (name === 'name') return 'age';
    return '';
  },
};
const codeInput = {
  value: '',
  disabled: false,
  form: null,
  getAttribute(name) {
    if (name === 'maxlength') return '6';
    if (name === 'aria-disabled') return 'false';
    if (name === 'name') return 'code';
    return '';
  },
  closest() { return null; },
  focus() {},
  dispatchEvent() {},
};
const submitBtn = {
  tagName: 'BUTTON',
  textContent: 'Continue',
  disabled: false,
  getAttribute(name) {
    if (name === 'type') return 'submit';
    if (name === 'aria-disabled') return 'false';
    return '';
  },
  click() {
    submitClicked = true;
  },
};

const document = {
  querySelector(selector) {
    switch (selector) {
      case 'input[name="name"], input[autocomplete="name"]':
        nameQueryCount += 1;
        return nameQueryCount >= 3 ? nameInput : null;
      case 'input[name="name"], input[autocomplete="name"], input[name="birthday"], input[name="age"], [role="spinbutton"][data-type="year"]':
        nameQueryCount += 1;
        return nameQueryCount >= 3 ? nameInput : null;
      case 'input[name="name"], input[placeholder*="全名"], input[autocomplete="name"]':
        return nameInput;
      case 'input[name="age"]':
        return nameQueryCount >= 3 ? ageInput : null;
      case '[role="spinbutton"][data-type="year"]':
      case '[role="spinbutton"][data-type="month"]':
      case '[role="spinbutton"][data-type="day"]':
      case 'input[name="birthday"]':
        return null;
      case 'form[action*="email-verification/register" i]':
      case 'form[action*="email-verification" i]':
        return { action: '/email-verification/register' };
      case VERIFICATION_CODE_INPUT_SELECTOR:
        return codeInput;
      case 'button[type="submit"]':
        return submitBtn;
      default:
        return null;
    }
  },
  querySelectorAll(selector) {
    if (selector === 'input[maxlength="1"]') return [];
    if (selector === 'button[type="submit"], input[type="submit"]') return [submitBtn];
    if (selector === 'button, [role="button"], input[type="button"], input[type="submit"]') return [submitBtn];
    if (selector === 'input[name="allCheckboxes"][type="checkbox"]') return [];
    if (selector === 'input[type="checkbox"]') return [];
    return [];
  },
  execCommand() {},
};

function throwIfStopped() {}
function log(message, level = 'info') { logs.push({ message, level }); }
async function waitForLoginVerificationPageReady() {}
function is405MethodNotAllowedPage() { return false; }
async function handle405ResendError() {}
function fillInput(el, value) {
  el.value = value;
}
async function sleep() {}
async function waitForDocumentLoadComplete() {}
function isStep5Ready() { return false; }
function isStep8Ready() { return false; }
function isAddPhonePageReady() { return false; }
function isVisibleElement(el) { return Boolean(el) && !el.disabled; }
function isActionEnabled(el) { return Boolean(el) && !el.disabled; }
function getActionText(el) { return el.textContent || ''; }
async function humanPause() {}
function simulateClick(el) { el.click(); clicks.push(el.textContent); }
function getCurrentAuthRetryPageState() { return null; }
function isPhoneVerificationPageReady() { return false; }
function findResendVerificationCodeTrigger() { return null; }
function isEmailVerificationPage() { return true; }
function getPageTextSnapshot() { return 'Create your account Enter the verification code we just sent Tell us about you'; }
function findBirthdayReactAriaSelect() { return null; }
async function setReactAriaBirthdaySelect() {}
async function waitForElement(selector) {
  if (/input\\[name=\"name\"\\]/.test(selector)) {
    return nameInput;
  }
  throw new Error('unexpected selector ' + selector);
}
async function waitForElementByText() { return submitBtn; }
function isStep5AllConsentText() { return false; }
function findStep5AllConsentCheckbox() { return null; }
function isStep5CheckboxChecked() { return false; }
async function waitForVerificationSubmitOutcome() {
  return { success: true, skipProfileStep: true };
}

${extractFunction('getStep5DirectCompletionPayload')}
${extractFunction('isVerificationPageStillVisible')}
${extractFunction('isCombinedSignupVerificationProfilePage')}
${extractFunction('waitForCombinedSignupVerificationProfilePage')}
${extractFunction('isSignupProfilePageUrl')}
${extractFunction('isLikelyLoggedInChatgptHomeUrl')}
${extractFunction('getStep4PostVerificationState')}
${extractFunction('getVisibleSplitVerificationInputs')}
${extractFunction('getVerificationCodeTarget')}
${extractFunction('getVerificationSubmitButtonForTarget')}
${extractFunction('waitForVerificationSubmitButton')}
${extractFunction('waitForVerificationCodeTarget')}
${extractFunction('waitForSplitVerificationInputsFilled')}
${extractFunction('step5_fillNameBirthday')}
${extractFunction('fillVerificationCode')}

return {
  run() {
    return fillVerificationCode(4, {
      code: '123456',
      signupProfile: {
        firstName: 'Ada',
        lastName: 'Lovelace',
        age: 22,
      },
    });
  },
  snapshot() {
    return {
      nameValue: nameInput.value,
      ageValue: ageInput.value,
      codeValue: codeInput.value,
      submitClicked,
      clicks,
      nameQueryCount,
    };
  },
};
`)();

  const result = await api.run();
  const snapshot = api.snapshot();

  assert.deepStrictEqual(result, {
    success: true,
    skipProfileStep: true,
    skipProfileStepReason: 'combined_verification_profile',
  });
  assert.equal(snapshot.nameValue, 'Ada Lovelace');
  assert.equal(snapshot.ageValue, '22');
  assert.equal(snapshot.codeValue, '123456');
  assert.equal(snapshot.submitClicked, true);
  assert.equal(snapshot.nameQueryCount >= 3, true);
});

test('prepareSignupVerificationFlow waits for complete verification page before reporting ready', async () => {
  const api = new Function(`
const logs = [];
let now = 0;
let sleepCalls = 0;
let targetChecks = 0;
const location = {
  href: 'https://auth.openai.com/email-verification',
  pathname: '/email-verification',
};
const document = {
  readyState: 'loading',
  title: '',
  body: {
    textContent: 'Enter the verification code we just sent',
    innerText: 'Enter the verification code we just sent',
  },
  querySelector(selector) {
    if (selector === 'form[action*="email-verification" i]') {
      return {};
    }
    return null;
  },
  querySelectorAll(selector) {
    if (selector === 'button, a, [role="button"], [role="link"], input[type="button"], input[type="submit"]') {
      return [];
    }
    return [];
  },
};

Date.now = () => now;
function throwIfStopped() {}
function log(message, level = 'info') { logs.push({ message, level }); }
async function sleep(ms = 0) {
  sleepCalls += 1;
  now += ms || 200;
  if (sleepCalls >= 3) {
    document.readyState = 'complete';
  }
}
function isVisibleElement() { return true; }
function isActionEnabled() { return true; }
function getActionText(el) { return el?.textContent || ''; }
function getCurrentAuthRetryPageState() { return null; }
function isPhoneVerificationPageReady() { return false; }
function findResendVerificationCodeTrigger() { return null; }
function isEmailVerificationPage() { return true; }
function getPageTextSnapshot() { return document.body.textContent; }
function getVerificationCodeTarget() {
  targetChecks += 1;
  return document.readyState === 'complete'
    ? { type: 'single', element: { value: '' } }
    : null;
}
function is405MethodNotAllowedPage() { return false; }
async function recoverCurrentAuthRetryPage() {}
function createSignupUserAlreadyExistsError() { return new Error('user already exists'); }
function getSignupPasswordInput() { return null; }
function getSignupPasswordSubmitButton() { return null; }
function isSignupEmailAlreadyExistsPage() { return false; }
function isSignupPasswordErrorPage() { return false; }
function getSignupPasswordTimeoutErrorPageState() { return null; }
function isStep5Ready() { return false; }

const VERIFICATION_PAGE_PATTERN = /verification code/i;

${extractFunction('getDocumentReadyStateSnapshot')}
${extractFunction('isDocumentLoadComplete')}
${extractFunction('waitForDocumentLoadComplete')}
${extractFunction('isSignupVerificationPageInteractiveReady')}
${extractFunction('isVerificationPageStillVisible')}
${extractFunction('isSignupProfilePageUrl')}
${extractFunction('isLikelyLoggedInChatgptHomeUrl')}
${extractFunction('getStep4PostVerificationState')}
${extractFunction('inspectSignupVerificationState')}
${extractFunction('waitForVerificationCodeTarget')}
${extractFunction('waitForSignupVerificationTransition')}
${extractFunction('prepareSignupVerificationFlow')}

return {
  run() {
    return prepareSignupVerificationFlow({ prepareLogLabel: '步骤 4 执行' }, 10000);
  },
  snapshot() {
    return { logs, sleepCalls, targetChecks, readyState: document.readyState };
  },
};
`)();

  const result = await api.run();
  const snapshot = api.snapshot();

  assert.equal(result.ready, true);
  assert.equal(snapshot.readyState, 'complete');
  assert.equal(snapshot.sleepCalls >= 3, true);
  assert.equal(snapshot.targetChecks >= 1, true);
});

test('prepareSignupVerificationFlow stops immediately when password page shows phone/password mismatch', async () => {
  const api = new Function(`
const logs = [];
const clicks = [];
let now = 0;

Date.now = () => now;

function throwIfStopped() {}
function log(message, level = 'info') { logs.push({ message, level }); }
async function sleep(ms = 0) { now += ms || 200; }
function isVisibleElement() { return true; }
function isActionEnabled() { return true; }
function getActionText(el) { return el?.textContent || ''; }
function getCurrentAuthRetryPageState() { return null; }
function isPhoneVerificationPageReady() { return false; }
function findResendVerificationCodeTrigger() { return null; }
function isEmailVerificationPage() { return false; }
function getPageTextSnapshot() { return 'Incorrect phone number or password'; }
function getVerificationCodeTarget() { return null; }
function is405MethodNotAllowedPage() { return false; }
async function recoverCurrentAuthRetryPage() {}
function createSignupUserAlreadyExistsError() { return new Error('user already exists'); }
function getSignupPasswordInput() { return { value: 'Secret123!' }; }
function getSignupPasswordSubmitButton() { return { textContent: 'Continue' }; }
function isSignupEmailAlreadyExistsPage() { return false; }
function isSignupPasswordErrorPage() { return false; }
function getSignupPasswordTimeoutErrorPageState() { return null; }
function isStep5Ready() { return false; }
function getSignupPasswordFieldErrorText() { return 'Incorrect phone number or password'; }
function simulateClick(target) { clicks.push(target?.textContent || 'clicked'); }
async function humanPause() {}
function fillInput() {}
function logSignupPasswordDiagnostics() {}
function createSignupPhonePasswordMismatchError(detailText = '') {
  return new Error('SIGNUP_PHONE_PASSWORD_MISMATCH::' + detailText);
}

const location = {
  href: 'https://auth.openai.com/log-in/password',
  pathname: '/log-in/password',
};
const document = {
  readyState: 'complete',
  title: '',
  body: {
    textContent: 'Incorrect phone number or password',
    innerText: 'Incorrect phone number or password',
  },
  querySelector() {
    return null;
  },
  querySelectorAll() {
    return [];
  },
};

${extractFunction('isSignupVerificationPageInteractiveReady')}
${extractFunction('isVerificationPageStillVisible')}
${extractFunction('isSignupProfilePageUrl')}
${extractFunction('isLikelyLoggedInChatgptHomeUrl')}
${extractFunction('getStep4PostVerificationState')}
${extractFunction('inspectSignupVerificationState')}
${extractFunction('waitForSignupVerificationTransition')}
${extractFunction('prepareSignupVerificationFlow')}

return {
  async run() {
    try {
      await prepareSignupVerificationFlow({
        password: 'Secret123!',
        prepareLogLabel: '步骤 3 收尾',
      }, 10000);
      return { threw: false, logs, clicks };
    } catch (error) {
      return { threw: true, error: error.message, logs, clicks };
    }
  },
};
`)();

  const result = await api.run();

  assert.equal(result.threw, true);
  assert.match(result.error, /SIGNUP_PHONE_PASSWORD_MISMATCH::Incorrect phone number or password/);
  assert.equal(result.clicks.length, 0);
  assert.equal(result.logs.some(({ message }) => /检测到密码页报错/.test(message)), true);
});

test('prepareSignupVerificationFlow stops immediately when password page shows phone already exists error', async () => {
  const api = new Function(`
const logs = [];
const clicks = [];
let now = 0;

Date.now = () => now;

function throwIfStopped() {}
function log(message, level = 'info') { logs.push({ message, level }); }
async function sleep(ms = 0) { now += ms || 200; }
function isVisibleElement() { return true; }
function isActionEnabled() { return true; }
function getActionText(el) { return el?.textContent || ''; }
function getCurrentAuthRetryPageState() { return null; }
function isPhoneVerificationPageReady() { return false; }
function findResendVerificationCodeTrigger() { return null; }
function isEmailVerificationPage() { return false; }
function getPageTextSnapshot() { return '与此电话号码相关联的帐户已存在'; }
function getVerificationCodeTarget() { return null; }
function is405MethodNotAllowedPage() { return false; }
async function recoverCurrentAuthRetryPage() {}
function createSignupUserAlreadyExistsError() { return new Error('user already exists'); }
function getSignupPasswordInput() { return { value: 'Secret123!' }; }
function getSignupPasswordSubmitButton() { return { textContent: 'Continue' }; }
function isSignupEmailAlreadyExistsPage() { return false; }
function isSignupPasswordErrorPage() { return false; }
function getSignupPasswordTimeoutErrorPageState() { return null; }
function isStep5Ready() { return false; }
function getSignupPasswordFieldErrorText() { return '与此电话号码相关联的帐户已存在'; }
function simulateClick(target) { clicks.push(target?.textContent || 'clicked'); }
async function humanPause() {}
function fillInput() {}
function logSignupPasswordDiagnostics() {}
function createSignupPhonePasswordMismatchError(detailText = '') {
  return new Error('SIGNUP_PHONE_PASSWORD_MISMATCH::' + detailText);
}

const location = {
  href: 'https://auth.openai.com/log-in/password',
  pathname: '/log-in/password',
};
const document = {
  readyState: 'complete',
  title: '',
  body: {
    textContent: '与此电话号码相关联的帐户已存在',
    innerText: '与此电话号码相关联的帐户已存在',
  },
  querySelector() {
    return null;
  },
  querySelectorAll() {
    return [];
  },
};

${extractFunction('isSignupVerificationPageInteractiveReady')}
${extractFunction('isVerificationPageStillVisible')}
${extractFunction('isSignupProfilePageUrl')}
${extractFunction('isLikelyLoggedInChatgptHomeUrl')}
${extractFunction('getStep4PostVerificationState')}
${extractFunction('inspectSignupVerificationState')}
${extractFunction('waitForSignupVerificationTransition')}
${extractFunction('prepareSignupVerificationFlow')}

return {
  async run() {
    try {
      await prepareSignupVerificationFlow({
        password: 'Secret123!',
        prepareLogLabel: '步骤 3 收尾',
      }, 10000);
      return { threw: false, logs, clicks };
    } catch (error) {
      return { threw: true, error: error.message, logs, clicks };
    }
  },
};
`)();

  const result = await api.run();

  assert.equal(result.threw, true);
  assert.match(result.error, /SIGNUP_PHONE_PASSWORD_MISMATCH::与此电话号码相关联的帐户已存在/);
  assert.equal(result.clicks.length, 0);
  assert.equal(result.logs.some(({ message }) => /检测到密码页报错/.test(message)), true);
});

test('fillSignupEmailAndContinue waits for submit operation delay before returning', async () => {
  const api = new Function(`
const events = [];
let releaseSubmitDelay;
const submitDelay = new Promise((resolve) => { releaseSubmitDelay = resolve; });
const emailInput = { value: '' };
const continueButton = { textContent: 'Continue' };
const location = { href: 'https://auth.openai.com/u/signup' };
const window = {
  setTimeout(callback, ms) {
    events.push(\`timer:\${ms}\`);
    return 1;
  },
  CodexOperationDelay: {
    async performOperationWithDelay(metadata, operation) {
      events.push(\`operation:\${metadata.label}:start\`);
      const result = await operation();
      events.push(\`operation:\${metadata.label}:end\`);
      if (metadata.kind === 'submit') {
        events.push(\`delay:\${metadata.label}:pending\`);
        await submitDelay;
      }
      events.push(\`delay:\${metadata.label}:2000\`);
      return result;
    },
  },
};

function getOperationDelayRunner() { return window.CodexOperationDelay.performOperationWithDelay; }
function throwIfStopped() {}
function isStopError() { return false; }
function log() {}
async function humanPause() {}
async function sleep(ms) { events.push(\`sleep:\${ms}\`); }
function fillInput(input, value) { input.value = value; events.push(\`fill:\${value}\`); }
function simulateClick(el) { events.push(\`click:\${el.textContent}\`); }
async function waitForSignupEntryState() {
  return { state: 'email_entry', emailInput, continueButton, url: location.href };
}
function getSignupEmailContinueButton() { return continueButton; }
function isActionEnabled() { return true; }

${extractFunction('fillSignupEmailAndContinue')}

return {
  events,
  releaseSubmitDelay() { releaseSubmitDelay(); },
  run() { return fillSignupEmailAndContinue('ada@example.com', 2); },
};
`)();

  let settled = false;
  const tracked = api.run().then((result) => {
    settled = true;
    api.events.push('run:resolved');
    return result;
  });

  await new Promise((resolve) => setImmediate(resolve));
  assert.equal(settled, false, 'email submit must not return before submit delay resolves');
  assert.equal(api.events.includes('delay:submit-signup-email:pending'), true);
  assert.equal(api.events.includes('run:resolved'), false);

  api.releaseSubmitDelay();
  const result = await tracked;
  assert.equal(result.submitted, true);
  assert.deepStrictEqual(api.events, [
    'operation:signup-email:start',
    'fill:ada@example.com',
    'operation:signup-email:end',
    'delay:signup-email:2000',
    'sleep:120',
    'operation:submit-signup-email:start',
    'click:Continue',
    'operation:submit-signup-email:end',
    'delay:submit-signup-email:pending',
    'delay:submit-signup-email:2000',
    'run:resolved',
  ]);
});

test('submitSignupPhoneNumberAndContinue waits for submit operation delay before returning', async () => {
  const api = new Function(`
const events = [];
let releaseSubmitDelay;
const submitDelay = new Promise((resolve) => { releaseSubmitDelay = resolve; });
const phoneInput = { value: '' };
const continueButton = { textContent: 'Continue' };
const location = { href: 'https://auth.openai.com/u/signup/phone' };
const window = {
  setTimeout(callback, ms) {
    events.push(\`timer:\${ms}\`);
    return 1;
  },
  CodexOperationDelay: {
    async performOperationWithDelay(metadata, operation) {
      events.push(\`operation:\${metadata.label}:start\`);
      const result = await operation();
      events.push(\`operation:\${metadata.label}:end\`);
      if (metadata.kind === 'submit') {
        events.push(\`delay:\${metadata.label}:pending\`);
        await submitDelay;
      }
      events.push(\`delay:\${metadata.label}:2000\`);
      return result;
    },
  },
};

function getOperationDelayRunner() { return window.CodexOperationDelay.performOperationWithDelay; }
function throwIfStopped() {}
function isStopError() { return false; }
function log() {}
async function humanPause() {}
async function sleep(ms) { events.push(\`sleep:\${ms}\`); }
function fillInput(input, value) { input.value = value; events.push(\`fill:\${value}\`); }
function simulateClick(el) { events.push(\`click:\${el.textContent}\`); }
async function waitForSignupPhoneEntryState() {
  return { state: 'phone_entry', phoneInput, url: location.href };
}
async function ensureSignupPhoneCountrySelected() {
  return { hasCountryControl: false, matched: true, selectedOption: null };
}
function resolveSignupPhoneDialCode() { return '1'; }
function toNationalPhoneNumber() { return '5551234567'; }
function getSignupPhoneHiddenNumberInput() { return null; }
function toE164PhoneNumber() { return '+15551234567'; }
function getSignupEmailContinueButton() { return continueButton; }
function isActionEnabled() { return true; }

${extractFunction('submitSignupPhoneNumberAndContinue')}

return {
  events,
  releaseSubmitDelay() { releaseSubmitDelay(); },
  run() { return submitSignupPhoneNumberAndContinue({ phoneNumber: '+15551234567' }); },
};
`)();

  let settled = false;
  const tracked = api.run().then((result) => {
    settled = true;
    api.events.push('run:resolved');
    return result;
  });

  await new Promise((resolve) => setImmediate(resolve));
  assert.equal(settled, false, 'phone submit must not return before submit delay resolves');
  assert.equal(api.events.includes('delay:submit-signup-phone:pending'), true);
  assert.equal(api.events.includes('run:resolved'), false);

  api.releaseSubmitDelay();
  const result = await tracked;
  assert.equal(result.submitted, true);
  assert.deepStrictEqual(api.events, [
    'operation:signup-phone-number:start',
    'fill:5551234567',
    'operation:signup-phone-number:end',
    'delay:signup-phone-number:2000',
    'sleep:120',
    'operation:submit-signup-phone:start',
    'click:Continue',
    'operation:submit-signup-phone:end',
    'delay:submit-signup-phone:pending',
    'delay:submit-signup-phone:2000',
    'run:resolved',
  ]);
});

test('step3_fillEmailPassword reports complete before deferred submit while submit still waits for operation delay', async () => {
  const api = new Function(`
const events = [];
const reports = [];
const scheduled = [];
let releaseSubmitDelay;
const submitDelay = new Promise((resolve) => { releaseSubmitDelay = resolve; });
const Date = { now: () => 12345 };
const passwordInput = { value: '' };
const submitButton = { textContent: 'Continue' };
const location = { href: 'https://auth.openai.com/u/signup/password' };
const window = {
  setTimeout(callback, ms) {
    events.push(\`timer:\${ms}\`);
    scheduled.push(callback);
    return scheduled.length;
  },
  CodexOperationDelay: {
    async performOperationWithDelay(metadata, operation) {
      events.push(\`operation:\${metadata.label}:start\`);
      const result = await operation();
      events.push(\`operation:\${metadata.label}:end\`);
      if (metadata.kind === 'submit') {
        events.push(\`delay:\${metadata.label}:pending\`);
        await submitDelay;
      }
      events.push(\`delay:\${metadata.label}:2000\`);
      return result;
    },
  },
};

function getOperationDelayRunner() { return window.CodexOperationDelay.performOperationWithDelay; }
function throwIfStopped() {}
function isStopError() { return false; }
function log(message) { events.push(\`log:\${message}\`); }
async function humanPause() {}
async function sleep(ms) { events.push(\`sleep:\${ms}\`); }
function fillInput(input, value) { input.value = value; events.push(\`fill-password:\${value}\`); }
function simulateClick(el) { events.push(\`click:\${el.textContent}\`); }
function inspectSignupEntryState() {
  return { state: 'password_page', passwordInput, submitButton, displayedEmail: 'ada@example.com' };
}
function getSignupPasswordSubmitButton() { return submitButton; }
async function waitForElementByText() { return null; }
function logSignupPasswordDiagnostics() {}
function reportComplete(step, payload) {
  reports.push({ step, payload });
  events.push(\`report:\${payload.deferredSubmit}\`);
}

${extractFunction('step3_fillEmailPassword')}

return {
  events,
  reports,
  scheduledCount() { return scheduled.length; },
  async flushDeferredSubmit() {
    if (!scheduled.length) throw new Error('missing deferred submit');
    await scheduled[0]();
  },
  releaseSubmitDelay() { releaseSubmitDelay(); },
  run() { return step3_fillEmailPassword({ email: 'ada@example.com', password: 'Secret123!' }); },
};
`)();

  let settled = false;
  const tracked = api.run().then((result) => {
    settled = true;
    api.events.push('run:resolved');
    return result;
  });

  await new Promise((resolve) => setImmediate(resolve));
  assert.equal(settled, true, 'step 3 must report and return before deferred submit can navigate');
  const result = await tracked;
  assert.equal(result.deferredSubmit, true);
  assert.equal(api.reports.length, 1);
  assert.equal(api.scheduledCount(), 1);
  assert.equal(api.events.includes('operation:submit-signup-password:start'), false);
  assert.deepStrictEqual(api.events, [
    'operation:signup-password:start',
    'fill-password:Secret123!',
    'operation:signup-password:end',
    'delay:signup-password:2000',
    'log:步骤 3：密码已填写',
    'report:true',
    'timer:120',
    'run:resolved',
  ]);

  let flushed = false;
  const flush = api.flushDeferredSubmit().then(() => {
    flushed = true;
    api.events.push('flush:resolved');
  });
  await new Promise((resolve) => setImmediate(resolve));
  assert.equal(api.events.includes('operation:submit-signup-password:start'), true);
  assert.equal(api.events.includes('delay:submit-signup-password:pending'), true);
  assert.equal(flushed, false, 'deferred submit callback must wait for submit delay before resolving');

  api.releaseSubmitDelay();
  await flush;
  assert.deepStrictEqual(api.events, [
    'operation:signup-password:start',
    'fill-password:Secret123!',
    'operation:signup-password:end',
    'delay:signup-password:2000',
    'log:步骤 3：密码已填写',
    'report:true',
    'timer:120',
    'run:resolved',
    'sleep:500',
    'operation:submit-signup-password:start',
    'click:Continue',
    'operation:submit-signup-password:end',
    'delay:submit-signup-password:pending',
    'delay:submit-signup-password:2000',
    'log:步骤 3：表单已提交',
    'flush:resolved',
  ]);
});
