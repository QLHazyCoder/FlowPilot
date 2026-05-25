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

function getStep5OutcomeBundle() {
  return [
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
    extractFunction('installStep5NavigationCompletionReporter'),
    extractFunction('waitForStep5SubmitOutcome'),
  ].join('\n');
}

function getStep5Bundle() {
  return [
    extractFunction('isSignupProfilePageUrl'),
    getStep5OutcomeBundle(),
    extractFunction('getStep5DirectCompletionPayload'),
    extractFunction('isStep5AllConsentText'),
    extractFunction('findStep5AllConsentCheckbox'),
    extractFunction('isStep5CheckboxChecked'),
    extractFunction('step5_fillNameBirthday'),
  ].join('\n');
}

test('step 5 clicks submit and completes after confirmed birthday page result', async () => {
  const step5Source = extractFunction('step5_fillNameBirthday');
  assert.ok(
    step5Source.includes('waitForStep5SubmitOutcome('),
    'Step 5 提交后应等待页面结果，避免资料提交假完成'
  );

  const api = new Function(`
const logs = [];
const completions = [];
const clicks = [];
const selectedBirthday = {};

const nameInput = { value: '', hidden: false };
const hiddenBirthday = {
  value: '',
  hidden: false,
  dispatchEvent() {},
};
const completeButton = {
  tagName: 'BUTTON',
  textContent: '完成帐户创建',
  hidden: false,
  getAttribute() { return ''; },
};

const birthdaySelects = {
  '年': { label: '年', button: { hidden: false }, nativeSelect: {} },
  '月': { label: '月', button: { hidden: false }, nativeSelect: {} },
  '天': { label: '天', button: { hidden: false }, nativeSelect: {} },
};

const document = {
  querySelector(selector) {
    switch (selector) {
      case '[role="spinbutton"][data-type="year"]':
      case '[role="spinbutton"][data-type="month"]':
      case '[role="spinbutton"][data-type="day"]':
      case 'input[name="age"]':
        return null;
      case 'input[name="birthday"]':
        return hiddenBirthday;
      case 'button[type="submit"], input[type="submit"]':
      case 'button[type="submit"]':
        return completeButton;
      default:
        return null;
    }
  },
  querySelectorAll(selector) {
    if (selector === 'input[name="allCheckboxes"][type="checkbox"]') {
      return [];
    }
    if (selector === 'input[type="checkbox"]') {
      return [];
    }
    if (selector === 'button, [role="button"], input[type="button"], input[type="submit"]') {
      return [completeButton];
    }
    return [];
  },
  execCommand() {},
};

const location = {
  href: 'https://auth.openai.com/u/signup/profile',
};

function Event(type, init = {}) {
  this.type = type;
  this.bubbles = Boolean(init.bubbles);
}

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

function findBirthdayReactAriaSelect(label) {
  return birthdaySelects[label] || null;
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

async function setReactAriaBirthdaySelect(select, value) {
  selectedBirthday[select.label] = String(value).padStart(select.label === '年' ? 4 : 2, '0');
  if (selectedBirthday['年'] && selectedBirthday['月'] && selectedBirthday['天']) {
    hiddenBirthday.value = \`\${selectedBirthday['年']}-\${selectedBirthday['月']}-\${selectedBirthday['天']}\`;
  }
}

async function waitForElementByText() {
  throw new Error('waitForElementByText should not run in this test');
}

function simulateClick(el) {
  clicks.push(el.textContent || el.tagName || 'element');
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
      birthdayValue: hiddenBirthday.value,
    };
  },
};
`)();

  const result = await api.run({
    firstName: 'Test',
    lastName: 'User',
    year: 2003,
    month: 6,
    day: 19,
  });

  const snapshot = api.snapshot();
  assert.deepStrictEqual(
    result,
    {
      profileSubmitted: true,
      postSubmitChecked: true,
      outcome: 'logged_in_home',
      url: 'https://chatgpt.com/',
    },
    '生日模式点击提交后应等待并确认页面结果'
  );
  assert.deepStrictEqual(snapshot.completions, [
    {
      step: 5,
      payload: {
        profileSubmitted: true,
        postSubmitChecked: true,
        outcome: 'logged_in_home',
        url: 'https://chatgpt.com/',
      },
    },
  ]);
  assert.deepStrictEqual(snapshot.clicks, ['完成帐户创建']);
  assert.equal(snapshot.nameValue, 'Test User');
  assert.equal(snapshot.birthdayValue, '2003-06-19');
  assert.ok(
    snapshot.logs.some(({ message }) => /资料提交结果已确认/.test(message)),
    '日志应明确说明 Step 5 已完成提交后检测'
  );
});

test('step 5 routes profile fill and submit operations through operation delay', async () => {
  const api = new Function(`
const logs = [];
const completions = [];
const profileEvents = [];

const nameInput = { value: '', hidden: false };
const ageInput = { value: '', hidden: false };
const completeButton = {
  tagName: 'BUTTON',
  textContent: '完成帐户创建',
  hidden: false,
  getAttribute() { return ''; },
};

const window = {
  CodexOperationDelay: {
    async performOperationWithDelay(metadata, operation) {
      profileEvents.push(\`operation:\${metadata.label}:start\`);
      const result = await operation();
      profileEvents.push(\`operation:\${metadata.label}:end\`);
      profileEvents.push(\`delay:\${metadata.label}:2000\`);
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
      return [];
    }
    if (selector === 'input[type="checkbox"]') {
      return [];
    }
    if (selector === 'button, [role="button"], input[type="button"], input[type="submit"]') {
      return [completeButton];
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
  profileEvents.push(input === nameInput ? 'fill:name' : 'fill:birthday');
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

async function setReactAriaBirthdaySelect() {}

async function waitForElementByText() {
  throw new Error('waitForElementByText should not run in this test');
}

function simulateClick() {
  profileEvents.push('click:complete');
  location.href = 'https://chatgpt.com/';
}

function reportComplete(step, payload) {
  completions.push({ step, payload });
}

function normalizeInlineText(text) {
  return String(text || '').replace(/\s+/g, ' ').trim();
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
      completions,
      profileEvents,
      nameValue: nameInput.value,
      ageValue: ageInput.value,
    };
  },
};
`)();

  await api.run({
    firstName: 'Test',
    lastName: 'User',
    age: 23,
  });

  const snapshot = api.snapshot();
  assert.deepStrictEqual(snapshot.profileEvents, [
    'operation:fill-name:start',
    'fill:name',
    'operation:fill-name:end',
    'delay:fill-name:2000',
    'operation:fill-birthday:start',
    'fill:birthday',
    'operation:fill-birthday:end',
    'delay:fill-birthday:2000',
    'operation:submit-profile:start',
    'click:complete',
    'operation:submit-profile:end',
    'delay:submit-profile:2000',
  ]);
  assert.ok(snapshot.profileEvents.indexOf('operation:fill-name:start') < snapshot.profileEvents.indexOf('delay:fill-name:2000'));
  assert.equal(snapshot.nameValue, 'Test User');
  assert.equal(snapshot.ageValue, '23');
});

test('step 5 routes React Aria birthday dropdown selections through per-field operation delays', async () => {
  const api = new Function(`
const operationEvents = [];
const selectedBirthday = {};
let activeOperationLabel = '';

const nameInput = { value: '', hidden: false };
const hiddenBirthday = { value: '', hidden: false, dispatchEvent() {} };
const birthdaySelects = {
  '\\u5e74': { field: 'year', label: '\\u5e74', button: { hidden: false }, nativeSelect: {} },
  '\\u6708': { field: 'month', label: '\\u6708', button: { hidden: false }, nativeSelect: {} },
  '\\u5929': { field: 'day', label: '\\u5929', button: { hidden: false }, nativeSelect: {} },
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
      case 'input[name="age"]':
      case 'button[type="submit"]':
        return null;
      case 'input[name="birthday"]':
        return hiddenBirthday;
      default:
        return null;
    }
  },
  querySelectorAll() { return []; },
  execCommand() {},
};

const location = { href: 'https://auth.openai.com/u/signup/profile' };
function Event(type, init = {}) { this.type = type; this.bubbles = Boolean(init.bubbles); }
function log() {}
async function waitForElement() { return nameInput; }
async function humanPause() {}
async function sleep() {}
function fillInput(input, value) { input.value = value; }
function findBirthdayReactAriaSelect(label) { return birthdaySelects[label] || null; }
function isVisibleElement(el) { return Boolean(el) && !el.hidden; }
async function setReactAriaBirthdaySelect(select, value) {
  operationEvents.push(\`select:\${select.field}:\${activeOperationLabel || 'outside'}\`);
  selectedBirthday[select.field] = String(value).padStart(select.field === 'year' ? 4 : 2, '0');
  if (selectedBirthday.year && selectedBirthday.month && selectedBirthday.day) {
    hiddenBirthday.value = \`\${selectedBirthday.year}-\${selectedBirthday.month}-\${selectedBirthday.day}\`;
  }
}
async function waitForElementByText() { throw new Error('waitForElementByText should not run in prefill test'); }
function simulateClick() { throw new Error('simulateClick should not run in prefill test'); }
function reportComplete() {}
function normalizeInlineText(text) { return String(text || '').replace(/\\s+/g, ' ').trim(); }

${getStep5Bundle()}

return {
  async run(payload) { return step5_fillNameBirthday(payload); },
  snapshot() { return { operationEvents, birthdayValue: hiddenBirthday.value }; },
};
`)();

  const result = await api.run({
    firstName: 'Test',
    lastName: 'User',
    year: 2003,
    month: 6,
    day: 19,
    prefillOnly: true,
  });

  const snapshot = api.snapshot();
  assert.deepStrictEqual(result, { prefilled: true });
  assert.equal(snapshot.birthdayValue, '2003-06-19');
  assert.deepStrictEqual(snapshot.operationEvents, [
    'operation:fill-name:start',
    'operation:fill-name:end',
    'delay:fill-name:2000',
    'operation:select-birthday-year:start',
    'select:year:select-birthday-year',
    'operation:select-birthday-year:end',
    'delay:select-birthday-year:2000',
    'operation:select-birthday-month:start',
    'select:month:select-birthday-month',
    'operation:select-birthday-month:end',
    'delay:select-birthday-month:2000',
    'operation:select-birthday-day:start',
    'select:day:select-birthday-day',
    'operation:select-birthday-day:end',
    'delay:select-birthday-day:2000',
    'operation:profile-dom-sync:start',
    'operation:profile-dom-sync:end',
    'delay:profile-dom-sync:2000',
  ]);
});

test('step 5 routes birthday spinbutton fields through per-field operation delays', async () => {
  const api = new Function(`
const operationEvents = [];
let activeOperationLabel = '';

function createSpinner(name) {
  return {
    name,
    hidden: false,
    value: '',
    focus() {},
    blur() {},
    dispatchEvent(event) {
      if (event?.type === 'input' && event.data) {
        operationEvents.push(\`spin:\${name}:\${event.data}:\${activeOperationLabel || 'outside'}\`);
        this.value += event.data;
      }
    },
  };
}

const nameInput = { value: '', hidden: false };
const yearSpinner = createSpinner('year');
const monthSpinner = createSpinner('month');
const daySpinner = createSpinner('day');

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
        return yearSpinner;
      case '[role="spinbutton"][data-type="month"]':
        return monthSpinner;
      case '[role="spinbutton"][data-type="day"]':
        return daySpinner;
      case 'input[name="birthday"]':
      case 'input[name="age"]':
      case 'button[type="submit"]':
        return null;
      default:
        return null;
    }
  },
  querySelectorAll() { return []; },
  execCommand(command) {
    if (command === 'selectAll' && activeOperationLabel) {
      const target = {
        'fill-birthday-year': yearSpinner,
        'fill-birthday-month': monthSpinner,
        'fill-birthday-day': daySpinner,
      }[activeOperationLabel];
      if (target) target.value = '';
    }
  },
};

const location = { href: 'https://auth.openai.com/u/signup/profile' };
function KeyboardEvent(type, init = {}) { this.type = type; Object.assign(this, init); }
function InputEvent(type, init = {}) { this.type = type; Object.assign(this, init); }
function log() {}
async function waitForElement() { return nameInput; }
async function humanPause() {}
async function sleep() {}
function fillInput(input, value) { input.value = value; }
function findBirthdayReactAriaSelect() { return null; }
function isVisibleElement(el) { return Boolean(el) && !el.hidden; }
async function setReactAriaBirthdaySelect() { throw new Error('setReactAriaBirthdaySelect should not run in spinbutton test'); }
async function waitForElementByText() { throw new Error('waitForElementByText should not run in prefill test'); }
function simulateClick() { throw new Error('simulateClick should not run in prefill test'); }
function reportComplete() {}
function normalizeInlineText(text) { return String(text || '').replace(/\\s+/g, ' ').trim(); }

${getStep5Bundle()}

return {
  async run(payload) { return step5_fillNameBirthday(payload); },
  snapshot() {
    return {
      operationEvents,
      yearValue: yearSpinner.value,
      monthValue: monthSpinner.value,
      dayValue: daySpinner.value,
    };
  },
};
`)();

  const result = await api.run({
    firstName: 'Test',
    lastName: 'User',
    year: 2003,
    month: 6,
    day: 19,
    prefillOnly: true,
  });

  const snapshot = api.snapshot();
  assert.deepStrictEqual(result, { prefilled: true });
  assert.equal(snapshot.yearValue, '2003');
  assert.equal(snapshot.monthValue, '06');
  assert.equal(snapshot.dayValue, '19');
  assert.deepStrictEqual(snapshot.operationEvents, [
    'operation:fill-name:start',
    'operation:fill-name:end',
    'delay:fill-name:2000',
    'operation:fill-birthday-year:start',
    'spin:year:2:fill-birthday-year',
    'spin:year:0:fill-birthday-year',
    'spin:year:0:fill-birthday-year',
    'spin:year:3:fill-birthday-year',
    'operation:fill-birthday-year:end',
    'delay:fill-birthday-year:2000',
    'operation:fill-birthday-month:start',
    'spin:month:0:fill-birthday-month',
    'spin:month:6:fill-birthday-month',
    'operation:fill-birthday-month:end',
    'delay:fill-birthday-month:2000',
    'operation:fill-birthday-day:start',
    'spin:day:1:fill-birthday-day',
    'spin:day:9:fill-birthday-day',
    'operation:fill-birthday-day:end',
    'delay:fill-birthday-day:2000',
  ]);
});

test('step 5 retries submit while profile page remains visible', async () => {
  const api = new Function(`
const realDateNow = Date.now;
let now = 0;
const logs = [];
const completions = [];
const clicks = [];
const nameInput = { value: '', hidden: false };
const ageInput = { value: '', hidden: false };
const completeButton = {
  tagName: 'BUTTON',
  textContent: '完成帐户创建',
  hidden: false,
  getAttribute() { return ''; },
};
const location = {
  href: 'https://auth.openai.com/u/signup/profile',
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
        return /^https:\\/\\/auth\\.openai\\.com\\//.test(location.href) ? ageInput : null;
      case 'button[type="submit"], input[type="submit"]':
      case 'button[type="submit"]':
        return completeButton;
      default:
        return null;
    }
  },
  querySelectorAll(selector) {
    if (selector === 'input[name="allCheckboxes"][type="checkbox"]') return [];
    if (selector === 'input[type="checkbox"]') return [];
    if (selector === 'button, [role="button"], input[type="button"], input[type="submit"]') return [completeButton];
    return [];
  },
  execCommand() {},
};

Date.now = () => now;
function log(message, level = 'info') { logs.push({ message, level }); }
function throwIfStopped() {}
async function waitForElement() { return nameInput; }
async function humanPause() {}
async function sleep(ms = 0) { now += ms || 250; }
function fillInput(input, value) { input.value = value; }
function findBirthdayReactAriaSelect() { return null; }
function isVisibleElement(el) { return Boolean(el) && !el.hidden; }
function isActionEnabled(el) { return Boolean(el) && !el.disabled && el.getAttribute?.('aria-disabled') !== 'true'; }
function getActionText(el) { return el.textContent || ''; }
async function setReactAriaBirthdaySelect() { throw new Error('setReactAriaBirthdaySelect should not run'); }
async function waitForElementByText() { return completeButton; }
function simulateClick(el) {
  clicks.push(el.textContent || el.tagName || 'element');
  if (el === completeButton && clicks.filter((text) => text === '完成帐户创建').length >= 3) {
    location.href = 'https://chatgpt.com/';
  }
}
function reportComplete(step, payload) { completions.push({ step, payload }); }
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
  run() {
    return step5_fillNameBirthday({
      firstName: 'Mia',
      lastName: 'Harris',
      age: 19,
    });
  },
  snapshot() {
    return { logs, completions, clicks, nameValue: nameInput.value, ageValue: ageInput.value };
  },
  restore() {
    Date.now = realDateNow;
  },
};
`)();

  let result;
  try {
    result = await api.run();
  } finally {
    api.restore();
  }
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
  assert.equal(snapshot.clicks.filter((text) => text === '完成帐户创建').length, 3);
  assert.equal(snapshot.logs.some(({ message }) => /仍停留在资料页，正在重新点击/.test(message)), true);
});

test('step 5 waits instead of retrying while profile submit is pending', async () => {
  const api = new Function(`
const realDateNow = Date.now;
let now = 0;
const clicks = [];
const completeButton = {
  tagName: 'BUTTON',
  type: 'submit',
  textContent: 'Complete account creation',
  hidden: false,
  disabled: false,
  getAttribute(name) {
    if (name === 'aria-disabled') return 'false';
    return '';
  },
  closest() {
    return null;
  },
};
const location = { href: 'https://auth.openai.com/u/signup/profile' };
const document = {
  querySelector(selector) {
    if (selector === 'button[type="submit"], input[type="submit"]') return completeButton;
    return null;
  },
  querySelectorAll(selector) {
    if (selector === 'button, [role="button"], input[type="button"], input[type="submit"]') return [completeButton];
    return [];
  },
};
const window = {
  getComputedStyle() {
    return { opacity: '0.5', pointerEvents: 'auto' };
  },
};

Date.now = () => now;
function throwIfStopped() {}
function log() {}
async function sleep(ms = 0) { now += ms || 250; }
async function humanPause() {}
function simulateClick(el) { clicks.push(el?.textContent || 'clicked'); }
function isVisibleElement(el) { return Boolean(el) && !el.hidden; }
function isActionEnabled(el) { return Boolean(el) && !el.disabled && el.getAttribute?.('aria-disabled') !== 'true'; }
function getActionText(el) { return el?.textContent || ''; }
function getSignupAuthRetryPathPatterns() { return []; }
function getAuthTimeoutErrorPageState() { return null; }
async function recoverCurrentAuthRetryPage() { throw new Error('should not recover retry page'); }
function createSignupUserAlreadyExistsError() { return new Error('user already exists'); }
function createAuthMaxCheckAttemptsError() { return new Error('max_check_attempts'); }
function getStep5ErrorText() { return ''; }
function isStep5Ready() { return true; }
function isLikelyLoggedInChatgptHomeUrl() { return false; }
function isOAuthConsentPage() { return false; }
function isAddPhonePageReady() { return false; }

${extractFunction('isSignupProfilePageUrl')}
${getStep5OutcomeBundle()}

return {
  run() {
    return waitForStep5SubmitOutcome({ timeoutMs: 4000, retryClickIntervalMs: 3500 });
  },
  snapshot() {
    return { clicks, now };
  },
  restore() {
    Date.now = realDateNow;
  },
};
`)();

  try {
    await assert.rejects(
      () => api.run(),
      /已点击提交 1\/3 次/
    );
    const snapshot = api.snapshot();
    assert.deepStrictEqual(snapshot.clicks, []);
    assert.ok(snapshot.now >= 4000);
  } finally {
    api.restore();
  }
});

test('step 5 recovers auth retry page after profile submit', async () => {
  const api = new Function(`
let retryVisible = true;
let recoverCalls = 0;
const location = { href: 'https://auth.openai.com/create-account/profile' };
const document = {
  querySelector() { return null; },
  querySelectorAll() { return []; },
};

function throwIfStopped() {}
function log() {}
async function sleep() {}
async function humanPause() {}
function simulateClick() {}
function isVisibleElement() { return true; }
function isActionEnabled() { return true; }
function getActionText(el) { return el?.textContent || ''; }
function getSignupAuthRetryPathPatterns() { return []; }
function getAuthTimeoutErrorPageState() {
  if (!retryVisible) return null;
  return {
    retryEnabled: true,
    userAlreadyExistsBlocked: false,
    maxCheckAttemptsBlocked: false,
  };
}
async function recoverCurrentAuthRetryPage() {
  recoverCalls += 1;
  retryVisible = false;
  location.href = 'https://chatgpt.com/';
}
function createSignupUserAlreadyExistsError() { return new Error('user already exists'); }
function createAuthMaxCheckAttemptsError() { return new Error('max_check_attempts'); }
function getStep5ErrorText() { return ''; }
function isStep5Ready() { return /^https:\\/\\/auth\\.openai\\.com\\//.test(location.href); }
function isLikelyLoggedInChatgptHomeUrl() { return /^https:\\/\\/chatgpt\\.com\\//.test(location.href); }
function isOAuthConsentPage() { return false; }
function isAddPhonePageReady() { return false; }

${extractFunction('isSignupProfilePageUrl')}
${getStep5OutcomeBundle()}

return {
  run() {
    return waitForStep5SubmitOutcome({ timeoutMs: 1000 });
  },
  snapshot() {
    return { recoverCalls };
  },
};
`)();

  const result = await api.run();

  assert.deepStrictEqual(result, {
    state: 'logged_in_home',
    url: 'https://chatgpt.com/',
  });
  assert.equal(api.snapshot().recoverCalls, 1);
});

test('step 5 profile url helper treats about-you as profile page', () => {
  const api = new Function(`
${extractFunction('isSignupProfilePageUrl')}

return {
  run(url) {
    return isSignupProfilePageUrl(url);
  },
};
`)();

  assert.equal(api.run('https://auth.openai.com/about-you'), true);
  assert.equal(api.run('https://auth.openai.com/create-account/profile'), true);
  assert.equal(api.run('https://chatgpt.com/about-you'), false);
});

test('step 5 recovers about-you auth retry page after profile submit', async () => {
  const api = new Function(`
let retryVisible = true;
let recoverCalls = 0;
const location = {
  href: 'https://auth.openai.com/about-you',
  pathname: '/about-you',
};
const document = {
  querySelector() { return null; },
  querySelectorAll() { return []; },
};

function throwIfStopped() {}
function log() {}
async function sleep() {}
async function humanPause() {}
function simulateClick() {}
function isVisibleElement() { return true; }
function isActionEnabled() { return true; }
function getActionText(el) { return el?.textContent || ''; }
function getSignupAuthRetryPathPatterns() { return []; }
function getAuthTimeoutErrorPageState(options) {
  const matchesAboutYou = Array.isArray(options?.pathPatterns)
    && options.pathPatterns.some((pattern) => pattern.test(location.pathname));
  if (!retryVisible || !matchesAboutYou) return null;
  return {
    retryEnabled: true,
    userAlreadyExistsBlocked: false,
    maxCheckAttemptsBlocked: false,
  };
}
async function recoverCurrentAuthRetryPage() {
  recoverCalls += 1;
  retryVisible = false;
  location.href = 'https://chatgpt.com/';
  location.pathname = '/';
}
function createSignupUserAlreadyExistsError() { return new Error('user already exists'); }
function createAuthMaxCheckAttemptsError() { return new Error('max_check_attempts'); }
function getStep5ErrorText() { return ''; }
function isStep5Ready() { return /^https:\\/\\/auth\\.openai\\.com\\//.test(location.href); }
function isLikelyLoggedInChatgptHomeUrl() { return /^https:\\/\\/chatgpt\\.com\\//.test(location.href); }
function isOAuthConsentPage() { return false; }
function isAddPhonePageReady() { return false; }

${extractFunction('isSignupProfilePageUrl')}
${getStep5OutcomeBundle()}

return {
  run() {
    return waitForStep5SubmitOutcome({ timeoutMs: 1000 });
  },
  snapshot() {
    return { recoverCalls };
  },
};
`)();

  const result = await api.run();

  assert.deepStrictEqual(result, {
    state: 'logged_in_home',
    url: 'https://chatgpt.com/',
  });
  assert.equal(api.snapshot().recoverCalls, 1);
});

test('step 5 does not treat unknown auth page as left_profile success', () => {
  const api = new Function(`
const location = {
  href: 'https://auth.openai.com/unexpected-state',
};

function getStep5AuthRetryPageState() { return null; }
function isLikelyLoggedInChatgptHomeUrl() { return false; }
function isOAuthConsentPage() { return false; }
function isAddPhonePageReady() { return false; }
function isStep5ProfileStillVisible() { return false; }

${extractFunction('isStep5CompletionChatgptUrl')}
${extractFunction('getStep5PostSubmitSuccessState')}

return {
  run() {
    return getStep5PostSubmitSuccessState();
  },
};
`)();

  assert.equal(api.run(), null);
});

test('step 5 completion requires https chatgpt.com and rejects auth-success-like pages', () => {
  const api = new Function(`
const location = {
  href: 'https://auth.openai.com/sign-in-with-chatgpt/codex/consent',
};

function getStep5AuthRetryPageState() { return null; }
function isStep5ProfileStillVisible() { return false; }

${extractFunction('isStep5CompletionChatgptUrl')}
${extractFunction('getStep5PostSubmitSuccessState')}

return {
  run(url) {
    location.href = url;
    return getStep5PostSubmitSuccessState();
  },
  isCompletion(url) {
    return isStep5CompletionChatgptUrl(url);
  },
};
`)();

  assert.deepStrictEqual(api.run('https://chatgpt.com/'), {
    state: 'logged_in_home',
    url: 'https://chatgpt.com/',
  });
  assert.deepStrictEqual(api.run('https://www.chatgpt.com/c/abc'), {
    state: 'logged_in_home',
    url: 'https://www.chatgpt.com/c/abc',
  });
  assert.equal(api.run('https://auth.openai.com/sign-in-with-chatgpt/codex/consent'), null);
  assert.equal(api.run('https://auth.openai.com/add-phone'), null);
  assert.equal(api.run('https://chat.openai.com/'), null);
  assert.equal(api.run('http://chatgpt.com/'), null);
  assert.equal(api.isCompletion('https://chatgpt.com/add-phone'), false);
});

test('step 5 navigation reporter hands off to background on beforeunload', () => {
  const api = new Function(`
const events = [];
const listeners = new Map();
const location = {
  href: 'https://auth.openai.com/about-you',
};
const window = {
  addEventListener(type, handler) {
    listeners.set(type, handler);
  },
  removeEventListener(type) {
    listeners.delete(type);
  },
};

function log(message, level = 'info') {
  events.push({ type: 'log', message, level });
}
function getStep5SubmitState() {
  return {
    url: location.href,
    retryPage: true,
    retryEnabled: true,
    successState: '',
    profileVisible: true,
    unknownAuthPage: false,
    maxCheckAttemptsBlocked: false,
    userAlreadyExistsBlocked: false,
    errorText: '',
  };
}

${extractFunction('logStep5SubmitDebug')}
${extractFunction('installStep5NavigationCompletionReporter')}

return {
  run() {
    const cleanup = installStep5NavigationCompletionReporter((payload) => {
      events.push({ type: 'complete', payload });
    });
    const beforeUnload = listeners.get('beforeunload');
    if (beforeUnload) {
      beforeUnload({ type: 'beforeunload' });
    }
    cleanup();
    return { events };
  },
};
`)();

  const result = api.run();
  assert.deepStrictEqual(
    result.events.filter((entry) => entry.type === 'complete'),
    [
      {
        type: 'complete',
        payload: {
          navigationStarted: true,
          navigationEventType: 'beforeunload',
        },
      },
    ]
  );
  assert.equal(result.events.some((entry) => entry.type === 'log' && /检测到页面开始导航/.test(entry.message)), true);
});
