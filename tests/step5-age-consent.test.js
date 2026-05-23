const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');

const source = fs.readFileSync('flows/openai/content/openai-auth.js', 'utf8');

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

function getStep5Bundle() {
  return [
    extractFunction('getStep5DirectCompletionPayload'),
    extractFunction('isSignupProfilePageUrl'),
    extractFunction('isStep5AllConsentText'),
    extractFunction('findStep5AllConsentCheckbox'),
    extractFunction('isStep5CheckboxChecked'),
    extractFunction('getStep5ProfilePathPatterns'),
    extractFunction('getStep5AuthRetryPathPatterns'),
    extractFunction('isStep5ProfilePageUrl'),
    extractFunction('getStep5AuthRetryPageState'),
    extractFunction('getStep5SubmitButton'),
    extractFunction('waitForStep5SubmitButton'),
    extractFunction('isStep5SubmitButtonClickable'),
    extractFunction('isStep5ProfileStillVisible'),
    extractFunction('isStep5CompletionChatgptUrl'),
    extractFunction('getStep5PostSubmitSuccessState'),
    extractFunction('findStep5PostSubmitOnboardingAction'),
    extractFunction('isStep5PostSubmitOnboardingPage'),
    extractFunction('advanceStep5PostSubmitOnboardingPage'),
    extractFunction('installStep5NavigationCompletionReporter'),
    extractFunction('waitForStep5SubmitOutcome'),
    extractFunction('step5_fillNameBirthday'),
  ].join('\n');
}

test('step 5 clicks the top all-consent checkbox on age page before submit', async () => {
  const api = new Function(`
const logs = [];
const completions = [];
const clicks = [];

const nameInput = { value: '', hidden: false };
const ageInput = { value: '', hidden: false };
const completeButton = {
  tagName: 'BUTTON',
  textContent: '\\u5b8c\\u6210\\u8d26\\u6237\\u521b\\u5efa',
  hidden: false,
  getAttribute() {
    return '';
  },
};
const allConsentLabel = {
  hidden: false,
  textContent: '\\u6211\\u540c\\u610f\\u4ee5\\u4e0b\\u6240\\u6709\\u5404\\u9879',
  closest() {
    return null;
  },
};
const allConsentCheckbox = {
  checked: false,
  hidden: true,
  name: 'allCheckboxes',
  type: 'checkbox',
  click() {
    this.checked = true;
  },
  getAttribute(name) {
    if (name === 'name') return this.name;
    if (name === 'type') return this.type;
    return '';
  },
  closest(selector) {
    if (selector === 'label') return allConsentLabel;
    return null;
  },
};

const document = {
  querySelector(selector) {
    switch (selector) {
      case '[role="spinbutton"][data-type="year"]':
      case '[role="spinbutton"][data-type="month"]':
      case '[role="spinbutton"][data-type="day"]':
      case 'input[name="birthday"]':
        return null;
      case 'input[name="age"]':
        return ageInput;
      case 'button[type="submit"], input[type="submit"]':
      case 'button[type="submit"]':
        return completeButton;
      default:
        return null;
    }
  },
  querySelectorAll(selector) {
    if (selector === 'input[name="allCheckboxes"][type="checkbox"]') {
      return [allConsentCheckbox];
    }
    if (selector === 'input[type="checkbox"]') {
      return [allConsentCheckbox];
    }
    return [];
  },
  execCommand() {},
};

const location = {
  href: 'https://auth.openai.com/u/signup/profile',
};

function log(message, level = 'info') {
  logs.push({ message, level });
}

function throwIfStopped() {}

async function waitForElement() {
  return nameInput;
}

async function humanPause() {}
async function sleep() {}

function fillInput(input, value) {
  input.value = value;
}

function findBirthdayReactAriaSelect() {
  return null;
}

function isVisibleElement(el) {
  return Boolean(el) && !el.hidden;
}

function isActionEnabled(el) {
  return Boolean(el) && !el.disabled && el.getAttribute?.('aria-disabled') !== 'true';
}

function getActionText(el) {
  return el.textContent || '';
}

async function setReactAriaBirthdaySelect() {
  throw new Error('setReactAriaBirthdaySelect should not run in age-mode test');
}

async function waitForElementByText() {
  throw new Error('waitForElementByText should not run in this test');
}

function simulateClick(el) {
  clicks.push(el.textContent || el.tagName || 'element');
  if (el === allConsentLabel || el === allConsentCheckbox) {
    allConsentCheckbox.checked = true;
  }
  if (el === completeButton) {
    location.href = 'https://chatgpt.com/';
  }
}

function reportComplete(step, payload) {
  completions.push({ step, payload });
}

function normalizeInlineText(text) {
  return String(text || '').replace(/\\s+/g, ' ').trim();
}

function getSignupAuthRetryPathPatterns() { return []; }
function getAuthTimeoutErrorPageState() { return null; }
async function recoverCurrentAuthRetryPage() { throw new Error('should not recover retry page'); }
function createSignupUserAlreadyExistsError() { return new Error('user already exists'); }
function createAuthMaxCheckAttemptsError() { return new Error('max_check_attempts'); }
function getStep5ErrorText() { return ''; }
function isStep5Ready() { return /^https:\\/\\/auth\\.openai\\.com\\//.test(location.href); }
function isLikelyLoggedInChatgptHomeUrl() { return /^https:\\/\\/chatgpt\\.com\\//.test(location.href); }
function isOAuthConsentPage() { return false; }
function isAddPhonePageReady() { return false; }

${getStep5Bundle()}

return {
  async run(payload) {
    return step5_fillNameBirthday(payload);
  },
  snapshot() {
    return {
      logs,
      completions,
      clicks,
      nameValue: nameInput.value,
      ageValue: ageInput.value,
      consentChecked: allConsentCheckbox.checked,
    };
  },
};
`)();

  const result = await api.run({
    firstName: 'Mia',
    lastName: 'Harris',
    age: 19,
  });

  const snapshot = api.snapshot();
  assert.deepStrictEqual(result, {
    profileSubmitted: true,
    postSubmitChecked: true,
    ageMode: true,
    outcome: 'logged_in_home',
    url: 'https://chatgpt.com/',
  });
  assert.equal(snapshot.nameValue, 'Mia Harris');
  assert.equal(snapshot.ageValue, '19');
  assert.equal(snapshot.consentChecked, true);
  assert.deepStrictEqual(snapshot.clicks, [
    '\u6211\u540c\u610f\u4ee5\u4e0b\u6240\u6709\u5404\u9879',
    '\u5b8c\u6210\u8d26\u6237\u521b\u5efa',
  ]);
  assert.deepStrictEqual(snapshot.completions, [
    {
      step: 5,
      payload: {
        profileSubmitted: true,
        postSubmitChecked: true,
        ageMode: true,
        outcome: 'logged_in_home',
        url: 'https://chatgpt.com/',
      },
    },
  ]);
});

test('step 5 routes fallback native consent checkbox click through operation delay', async () => {
  const api = new Function(`
const operationEvents = [];
let activeOperationLabel = '';

const nameInput = { value: '', hidden: false };
const ageInput = { value: '', hidden: false };
const completeButton = {
  tagName: 'BUTTON',
  textContent: '\\u5b8c\\u6210\\u8d26\\u6237\\u521b\\u5efa',
  hidden: false,
};
const allConsentLabel = {
  hidden: false,
  textContent: '\\u6211\\u540c\\u610f\\u4ee5\\u4e0b\\u6240\\u6709\\u5404\\u9879',
  closest() {
    return null;
  },
};
const allConsentCheckbox = {
  checked: false,
  hidden: true,
  name: 'allCheckboxes',
  type: 'checkbox',
  click() {
    operationEvents.push(\`native-click:\${activeOperationLabel || 'outside'}\`);
    this.checked = true;
  },
  getAttribute(name) {
    if (name === 'name') return this.name;
    if (name === 'type') return this.type;
    return '';
  },
  closest(selector) {
    if (selector === 'label') return allConsentLabel;
    return null;
  },
};

const window = {
  CodexOperationDelay: {
    async performOperationWithDelay(metadata, operation) {
      operationEvents.push(\`operation:\${metadata.label}:start\`);
      activeOperationLabel = metadata.label;
      const result = await operation();
      activeOperationLabel = '';
      operationEvents.push(\`operation:\${metadata.label}:end\`);
      operationEvents.push(\`delay:\${metadata.label}:2000\`);
      return result;
    },
  },
};

const document = {
  querySelector(selector) {
    switch (selector) {
      case '[role="spinbutton"][data-type="year"]':
      case '[role="spinbutton"][data-type="month"]':
      case '[role="spinbutton"][data-type="day"]':
      case 'input[name="birthday"]':
        return null;
      case 'input[name="age"]':
        return ageInput;
      case 'button[type="submit"], input[type="submit"]':
      case 'button[type="submit"]':
        return completeButton;
      default:
        return null;
    }
  },
  querySelectorAll(selector) {
    if (selector === 'input[name="allCheckboxes"][type="checkbox"]') {
      return [allConsentCheckbox];
    }
    if (selector === 'input[type="checkbox"]') {
      return [allConsentCheckbox];
    }
    return [];
  },
  execCommand() {},
};

const location = { href: 'https://auth.openai.com/u/signup/profile' };
function log() {}
function throwIfStopped() {}
async function waitForElement() { return nameInput; }
async function humanPause() {}
async function sleep() {}
function fillInput(input, value) { input.value = value; }
function findBirthdayReactAriaSelect() { return null; }
function isVisibleElement(el) { return Boolean(el) && !el.hidden; }
async function setReactAriaBirthdaySelect() { throw new Error('setReactAriaBirthdaySelect should not run in age-mode test'); }
async function waitForElementByText() { throw new Error('waitForElementByText should not run in this test'); }
function simulateClick(el) {
  operationEvents.push(\`simulate-click:\${activeOperationLabel || 'outside'}:\${el.textContent || el.tagName || 'element'}\`);
  if (el === completeButton) {
    location.href = 'https://chatgpt.com/';
  }
}
function reportComplete() {}
function normalizeInlineText(text) { return String(text || '').replace(/\\s+/g, ' ').trim(); }
function getSignupAuthRetryPathPatterns() { return []; }
function getAuthTimeoutErrorPageState() { return null; }
async function recoverCurrentAuthRetryPage() { throw new Error('should not recover retry page'); }
function createSignupUserAlreadyExistsError() { return new Error('user already exists'); }
function createAuthMaxCheckAttemptsError() { return new Error('max_check_attempts'); }
function getStep5ErrorText() { return ''; }
function isStep5Ready() { return /^https:\\/\\/auth\\.openai\\.com\\//.test(location.href); }
function isLikelyLoggedInChatgptHomeUrl() { return /^https:\\/\\/chatgpt\\.com\\//.test(location.href); }
function isOAuthConsentPage() { return false; }
function isAddPhonePageReady() { return false; }

${getStep5Bundle()}

return {
  async run(payload) {
    return step5_fillNameBirthday(payload);
  },
  snapshot() {
    return { operationEvents, consentChecked: allConsentCheckbox.checked };
  },
};
`)();

  await api.run({
    firstName: 'Mia',
    lastName: 'Harris',
    age: 19,
  });

  const { operationEvents, consentChecked } = api.snapshot();
  assert.equal(consentChecked, true);
  assert.equal(operationEvents.includes('native-click:outside'), false);
  assert.ok(
    operationEvents.indexOf('delay:accept-profile-consent:2000')
      < operationEvents.indexOf('operation:accept-profile-consent-fallback:start'),
    'fallback click must be a separate delayed operation after the first consent attempt'
  );
  assert.deepStrictEqual(
    operationEvents.slice(
      operationEvents.indexOf('operation:accept-profile-consent-fallback:start'),
      operationEvents.indexOf('delay:accept-profile-consent-fallback:2000') + 1
    ),
    [
      'operation:accept-profile-consent-fallback:start',
      'native-click:accept-profile-consent-fallback',
      'operation:accept-profile-consent-fallback:end',
      'delay:accept-profile-consent-fallback:2000',
    ]
  );
});
