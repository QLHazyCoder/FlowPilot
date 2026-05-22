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

function extractConst(name) {
  const pattern = new RegExp(`const\\s+${name}\\s*=\\s*[\\s\\S]*?;`);
  const match = source.match(pattern);
  if (!match) {
    throw new Error(`missing const ${name}`);
  }
  return match[0];
}

test('waitForSignupEntryState switches from phone mode to email mode before step 2 fills the address', async () => {
  const api = new Function(`
const logs = [];
const clicks = [];
let phase = 'phone';
let now = 0;

const phoneInput = {
  kind: 'phone',
  getAttribute(name) {
    if (name === 'type') return 'tel';
    return '';
  },
};

const switchButton = {
  textContent: 'Continue using email address',
  value: '',
  disabled: false,
  getAttribute(name) {
    if (name === 'type') return 'button';
    return '';
  },
  getBoundingClientRect() {
    return { width: 200, height: 48 };
  },
};

const emailInput = {
  kind: 'email',
  getAttribute(name) {
    if (name === 'type') return 'email';
    return '';
  },
};

const document = {
  querySelector(selector) {
    if (selector === SIGNUP_EMAIL_INPUT_SELECTOR) {
      return phase === 'email' ? emailInput : null;
    }
    if (selector === SIGNUP_PHONE_INPUT_SELECTOR) {
      return phase === 'phone' ? phoneInput : null;
    }
    return null;
  },
  querySelectorAll(selector) {
    if (selector === 'button, a, [role="button"], [role="link"]') {
      return phase === 'phone' ? [switchButton] : [];
    }
    if (selector === 'a, button, [role="button"], [role="link"]') {
      return [];
    }
    if (selector === 'input') {
      return phase === 'phone' ? [phoneInput] : [emailInput];
    }
    return [];
  },
};

const location = {
  href: 'https://chatgpt.com/',
};

const Date = {
  now() {
    return now;
  },
};

${extractConst('SIGNUP_ENTRY_TRIGGER_PATTERN')}
${extractConst('SIGNUP_EMAIL_INPUT_SELECTOR')}
${extractConst('SIGNUP_PHONE_INPUT_SELECTOR')}
${extractConst('SIGNUP_SWITCH_TO_EMAIL_PATTERN')}
${extractConst('SIGNUP_SWITCH_ACTION_PATTERN')}
${extractConst('SIGNUP_EMAIL_ACTION_PATTERN')}
${extractConst('SIGNUP_PHONE_ACTION_PATTERN')}
${extractConst('SIGNUP_SWITCH_TO_PHONE_PATTERN')}
${extractConst('SIGNUP_MORE_OPTIONS_PATTERN')}
${extractConst('SIGNUP_WORK_EMAIL_PATTERN')}

function isVisibleElement(el) {
  return Boolean(el);
}

function isActionEnabled(el) {
  return Boolean(el) && !el.disabled && el.getAttribute('aria-disabled') !== 'true';
}

function getActionText(el) {
  return [el?.textContent, el?.value, el?.getAttribute?.('aria-label'), el?.getAttribute?.('title')]
    .filter(Boolean)
    .join(' ')
    .replace(/\\s+/g, ' ')
    .trim();
}

function getSignupPasswordInput() {
  return null;
}

function isSignupPasswordPage() {
  return false;
}

function getSignupPasswordSubmitButton() {
  return null;
}

function findSignupEntryTrigger() {
  return null;
}

function getSignupPasswordDisplayedEmail() {
  return '';
}

function throwIfStopped() {}

function log(message, level = 'info') {
  logs.push({ message, level });
}

async function humanPause() {}

function simulateClick(target) {
  clicks.push(getActionText(target));
  if (target === switchButton) {
    phase = 'email';
  }
}

async function sleep(ms) {
  now += ms;
}

${extractFunction('getSignupEmailInput')}
${extractFunction('getSignupPhoneInput')}
${extractFunction('findSignupUseEmailTrigger')}
${extractFunction('findSignupUsePhoneTrigger')}
${extractFunction('findSignupMoreOptionsTrigger')}
${extractFunction('getSignupEmailContinueButton')}
${extractFunction('inspectSignupEntryState')}
${extractFunction('waitForSignupEntryState')}

return {
  async run() {
    return waitForSignupEntryState({ timeout: 5000, autoOpenEntry: true });
  },
  getClicks() {
    return clicks.slice();
  },
  getLogs() {
    return logs.slice();
  },
};
`)();

  const snapshot = await api.run();

  assert.equal(snapshot.state, 'email_entry');
  assert.deepEqual(api.getClicks(), ['Continue using email address']);
  assert.equal(api.getLogs().length > 0, true);
});

test('waitForSignupEntryState also recognizes the Chinese switch-to-email button text', async () => {
  const api = new Function(`
const logs = [];
const clicks = [];
let phase = 'phone';
let now = 0;

const phoneInput = {
  kind: 'phone',
  getAttribute(name) {
    if (name === 'type') return 'tel';
    return '';
  },
};

const switchButton = {
  textContent: '\\u7ee7\\u7eed\\u4f7f\\u7528\\u7535\\u5b50\\u90ae\\u4ef6\\u5730\\u5740\\u767b\\u5f55',
  value: '',
  disabled: false,
  getAttribute(name) {
    if (name === 'type') return 'button';
    return '';
  },
  getBoundingClientRect() {
    return { width: 200, height: 48 };
  },
};

const workEmailButton = {
  textContent: '\\u7ee7\\u7eed\\u4f7f\\u7528\\u5de5\\u4f5c\\u7535\\u5b50\\u90ae\\u4ef6\\u5730\\u5740\\u767b\\u5f55',
  value: '',
  disabled: false,
  getAttribute(name) {
    if (name === 'type') return 'button';
    return '';
  },
  getBoundingClientRect() {
    return { width: 200, height: 48 };
  },
};

const emailInput = {
  kind: 'email',
  getAttribute(name) {
    if (name === 'type') return 'email';
    return '';
  },
};

const document = {
  querySelector(selector) {
    if (selector === SIGNUP_EMAIL_INPUT_SELECTOR) {
      return phase === 'email' ? emailInput : null;
    }
    if (selector === SIGNUP_PHONE_INPUT_SELECTOR) {
      return phase === 'phone' ? phoneInput : null;
    }
    return null;
  },
  querySelectorAll(selector) {
    if (selector === 'button, a, [role="button"], [role="link"]') {
      return phase === 'phone' ? [switchButton, workEmailButton] : [];
    }
    if (selector === 'a, button, [role="button"], [role="link"]') {
      return [];
    }
    if (selector === 'input') {
      return phase === 'phone' ? [phoneInput] : [emailInput];
    }
    return [];
  },
};

const location = {
  href: 'https://chatgpt.com/',
};

const Date = {
  now() {
    return now;
  },
};

${extractConst('SIGNUP_ENTRY_TRIGGER_PATTERN')}
${extractConst('SIGNUP_EMAIL_INPUT_SELECTOR')}
${extractConst('SIGNUP_PHONE_INPUT_SELECTOR')}
${extractConst('SIGNUP_SWITCH_TO_EMAIL_PATTERN')}
${extractConst('SIGNUP_SWITCH_ACTION_PATTERN')}
${extractConst('SIGNUP_EMAIL_ACTION_PATTERN')}
${extractConst('SIGNUP_PHONE_ACTION_PATTERN')}
${extractConst('SIGNUP_SWITCH_TO_PHONE_PATTERN')}
${extractConst('SIGNUP_MORE_OPTIONS_PATTERN')}
${extractConst('SIGNUP_WORK_EMAIL_PATTERN')}

function isVisibleElement(el) {
  return Boolean(el);
}

function isActionEnabled(el) {
  return Boolean(el) && !el.disabled && el.getAttribute('aria-disabled') !== 'true';
}

function getActionText(el) {
  return [el?.textContent, el?.value, el?.getAttribute?.('aria-label'), el?.getAttribute?.('title')]
    .filter(Boolean)
    .join(' ')
    .replace(/\\s+/g, ' ')
    .trim();
}

function getSignupPasswordInput() {
  return null;
}

function isSignupPasswordPage() {
  return false;
}

function getSignupPasswordSubmitButton() {
  return null;
}

function findSignupEntryTrigger() {
  return null;
}

function getSignupPasswordDisplayedEmail() {
  return '';
}

function throwIfStopped() {}

function log(message, level = 'info') {
  logs.push({ message, level });
}

async function humanPause() {}

function simulateClick(target) {
  clicks.push(getActionText(target));
  if (target === switchButton) {
    phase = 'email';
  }
}

async function sleep(ms) {
  now += ms;
}

${extractFunction('getSignupEmailInput')}
${extractFunction('getSignupPhoneInput')}
${extractFunction('findSignupUseEmailTrigger')}
${extractFunction('findSignupUsePhoneTrigger')}
${extractFunction('findSignupMoreOptionsTrigger')}
${extractFunction('getSignupEmailContinueButton')}
${extractFunction('inspectSignupEntryState')}
${extractFunction('waitForSignupEntryState')}

return {
  async run() {
    return waitForSignupEntryState({ timeout: 5000, autoOpenEntry: true });
  },
  getClicks() {
    return clicks.slice();
  },
};
`)();

  const snapshot = await api.run();

  assert.equal(snapshot.state, 'email_entry');
  assert.deepEqual(api.getClicks(), ['继续使用电子邮件地址登录']);
});

test('getSignupEmailInput recognizes localized email placeholders in text inputs', () => {
  const api = new Function(`
const localizedEmailInput = {
  kind: 'localized-email',
  getAttribute(name) {
    if (name === 'placeholder') return '电子邮件地址';
    if (name === 'type') return 'text';
    return '';
  },
};

const document = {
  querySelector() {
    return null;
  },
  querySelectorAll(selector) {
    if (selector === 'input') {
      return [localizedEmailInput];
    }
    return [];
  },
};

${extractConst('SIGNUP_EMAIL_INPUT_SELECTOR')}

function isVisibleElement(el) {
  return Boolean(el);
}

${extractFunction('getSignupEmailInput')}

return {
  run() {
    return getSignupEmailInput();
  },
};
`)();

  assert.equal(api.run()?.kind, 'localized-email');
});

test('findSignupEntryTrigger recognizes Japanese free signup button text', () => {
  const api = new Function(`
const signupButton = {
  textContent: '無料でサインアップ',
  value: '',
  disabled: false,
  getAttribute(name) {
    if (name === 'type') return 'button';
    return '';
  },
  getBoundingClientRect() {
    return { width: 180, height: 48 };
  },
};

const loginButton = {
  textContent: 'ログイン',
  value: '',
  disabled: false,
  getAttribute(name) {
    if (name === 'type') return 'button';
    return '';
  },
  getBoundingClientRect() {
    return { width: 120, height: 48 };
  },
};

const document = {
  querySelectorAll(selector) {
    if (selector === 'a, button, [role="button"], [role="link"]') {
      return [loginButton, signupButton];
    }
    return [];
  },
};

${extractConst('SIGNUP_ENTRY_TRIGGER_PATTERN')}

function isVisibleElement(el) {
  return Boolean(el);
}

function isActionEnabled(el) {
  return Boolean(el) && !el.disabled && el.getAttribute('aria-disabled') !== 'true';
}

function getActionText(el) {
  return [el?.textContent, el?.value, el?.getAttribute?.('aria-label'), el?.getAttribute?.('title')]
    .filter(Boolean)
    .join(' ')
    .replace(/\\s+/g, ' ')
    .trim();
}

${extractFunction('findSignupEntryTrigger')}

return {
  run() {
    return getActionText(findSignupEntryTrigger());
  },
};
`)();

  assert.equal(api.run(), '無料でサインアップ');
});

test('getSignupEmailContinueButton recognizes Japanese continue text', () => {
  const api = new Function(`
const continueButton = {
  textContent: '続ける',
  value: '',
  disabled: false,
  getAttribute(name) {
    if (name === 'type') return 'button';
    return '';
  },
  getBoundingClientRect() {
    return { width: 180, height: 48 };
  },
};

const document = {
  querySelector() {
    return null;
  },
  querySelectorAll(selector) {
    if (selector === 'button, a, [role="button"], [role="link"], input[type="button"], input[type="submit"]') {
      return [continueButton];
    }
    return [];
  },
};

function isVisibleElement(el) {
  return Boolean(el);
}

function isActionEnabled(el) {
  return Boolean(el) && !el.disabled && el.getAttribute('aria-disabled') !== 'true';
}

function getActionText(el) {
  return [el?.textContent, el?.value, el?.getAttribute?.('aria-label'), el?.getAttribute?.('title')]
    .filter(Boolean)
    .join(' ')
    .replace(/\\s+/g, ' ')
    .trim();
}

${extractFunction('getSignupEmailContinueButton')}

return {
  run() {
    return getActionText(getSignupEmailContinueButton());
  },
};
`)();

  assert.equal(api.run(), '続ける');
});

test('waitForSignupEntryState retries the signup entry click five times before giving up', async () => {
  const api = new Function(`
const logs = [];
const clicks = [];
let now = 0;

const signupButton = {
  textContent: '免费注册',
  value: '',
  disabled: false,
  getAttribute(name) {
    if (name === 'type') return 'button';
    return '';
  },
  getBoundingClientRect() {
    return { width: 120, height: 36 };
  },
};

const document = {
  querySelector() {
    return null;
  },
  querySelectorAll(selector) {
    if (selector === 'a, button, [role="button"], [role="link"]') {
      return [signupButton];
    }
    return [];
  },
};

const location = {
  href: 'https://chatgpt.com/',
};

const Date = {
  now() {
    return now;
  },
};

${extractConst('SIGNUP_ENTRY_TRIGGER_PATTERN')}
${extractConst('SIGNUP_EMAIL_INPUT_SELECTOR')}
${extractConst('SIGNUP_PHONE_INPUT_SELECTOR')}

function isVisibleElement(el) {
  return Boolean(el);
}

function isActionEnabled(el) {
  return Boolean(el) && !el.disabled && el.getAttribute('aria-disabled') !== 'true';
}

function getActionText(el) {
  return [el?.textContent, el?.value, el?.getAttribute?.('aria-label'), el?.getAttribute?.('title')]
    .filter(Boolean)
    .join(' ')
    .replace(/\\s+/g, ' ')
    .trim();
}

function getSignupPasswordInput() {
  return null;
}

function isSignupPasswordPage() {
  return false;
}

function getSignupPasswordSubmitButton() {
  return null;
}

function getSignupPasswordDisplayedEmail() {
  return '';
}

function throwIfStopped() {}

function log(message, level = 'info') {
  logs.push({ message, level });
}

async function humanPause() {}

function simulateClick(target) {
  clicks.push(getActionText(target));
}

async function sleep(ms) {
  now += ms;
}

${extractFunction('getSignupEmailInput')}
${extractFunction('getSignupPhoneInput')}
${extractFunction('getSignupEmailContinueButton')}
${extractFunction('findSignupEntryTrigger')}
${extractFunction('inspectSignupEntryState')}
${extractFunction('waitForSignupEntryState')}

return {
  async run() {
    return waitForSignupEntryState({ timeout: 30000, autoOpenEntry: true, step: 2 });
  },
  getClicks() {
    return clicks.slice();
  },
  getLogs() {
    return logs.slice();
  },
};
`)();

  const snapshot = await api.run();

  assert.equal(snapshot.state, 'entry_home');
  assert.equal(api.getClicks().length, 6);
  assert.equal(api.getLogs().some(({ message }) => message.includes('重试 5/5')), true);
  assert.equal(api.getLogs().some(({ message, level }) => level === 'warn' && /已完成 5 次重试/.test(message)), true);
});

test('waitForSignupEntryState treats hidden signup action on collapsed logged-out home as retryable entry', async () => {
  const api = new Function(`
const logs = [];
const clicks = [];
let now = 0;

const signupButton = {
  textContent: '免费注册',
  value: '',
  disabled: false,
  getAttribute(name) {
    if (name === 'type') return 'button';
    return '';
  },
  getBoundingClientRect() {
    return { width: 0, height: 0 };
  },
};

const document = {
  querySelector() {
    return null;
  },
  querySelectorAll(selector) {
    if (selector === 'a, button, [role="button"], [role="link"]') {
      return [signupButton];
    }
    return [];
  },
};

const window = {
  innerWidth: 0,
  innerHeight: 0,
  outerWidth: 159,
  outerHeight: 27,
};

const location = {
  href: 'https://chatgpt.com/',
};

const Date = {
  now() {
    return now;
  },
};

${extractConst('SIGNUP_ENTRY_TRIGGER_PATTERN')}
${extractConst('SIGNUP_EMAIL_INPUT_SELECTOR')}
${extractConst('SIGNUP_PHONE_INPUT_SELECTOR')}

function isVisibleElement(el) {
  const rect = el?.getBoundingClientRect?.() || { width: 0, height: 0 };
  return rect.width > 0 && rect.height > 0;
}

function isActionEnabled(el) {
  return Boolean(el) && !el.disabled && el.getAttribute('aria-disabled') !== 'true';
}

function getActionText(el) {
  return [el?.textContent, el?.value, el?.getAttribute?.('aria-label'), el?.getAttribute?.('title')]
    .filter(Boolean)
    .join(' ')
    .replace(/\\s+/g, ' ')
    .trim();
}

function getPageTextSnapshot() {
  return '跳至内容 ChatGPT 登录 我们先从哪里开始呢？';
}

function getSignupPasswordInput() {
  return null;
}

function isSignupPasswordPage() {
  return false;
}

function getSignupPasswordSubmitButton() {
  return null;
}

function getSignupPasswordDisplayedEmail() {
  return '';
}

function throwIfStopped() {}

function log(message, level = 'info') {
  logs.push({ message, level });
}

async function humanPause() {}

function simulateClick(target) {
  clicks.push(getActionText(target));
}

async function sleep(ms) {
  now += ms;
}

${extractFunction('getSignupEmailInput')}
${extractFunction('getSignupPhoneInput')}
${extractFunction('getSignupEmailContinueButton')}
${extractFunction('findSignupEntryTrigger')}
${extractFunction('inspectSignupEntryState')}
${extractFunction('waitForSignupEntryState')}

return {
  async run() {
    return waitForSignupEntryState({ timeout: 30000, autoOpenEntry: true, step: 2 });
  },
  getClicks() {
    return clicks.slice();
  },
  getLogs() {
    return logs.slice();
  },
};
`)();

  const snapshot = await api.run();

  assert.equal(snapshot.state, 'entry_home');
  assert.equal(api.getClicks().length, 6);
  assert.equal(api.getLogs().some(({ message }) => message.includes('注册入口仍处于不可见状态')), true);
  assert.equal(api.getLogs().some(({ message, level }) => level === 'warn' && /已完成 5 次重试/.test(message)), true);
});

test('ensureSignupPhoneEntryReady opens free signup before switching to the phone entry', async () => {
  const api = new Function(`
const logs = [];
const clicks = [];
let phase = 'entry';
let now = 0;

const signupButton = {
  textContent: '免费注册',
  value: '',
  disabled: false,
  getAttribute(name) {
    if (name === 'type') return 'button';
    return '';
  },
  getBoundingClientRect() {
    return { width: 120, height: 36 };
  },
};

const switchButton = {
  textContent: 'Continue with phone number',
  value: '',
  disabled: false,
  getAttribute(name) {
    if (name === 'type') return 'button';
    return '';
  },
  getBoundingClientRect() {
    return { width: 200, height: 48 };
  },
};

const emailInput = {
  kind: 'email',
  getAttribute(name) {
    if (name === 'type') return 'email';
    return '';
  },
};

const phoneInput = {
  kind: 'phone',
  getAttribute(name) {
    if (name === 'type') return 'tel';
    return '';
  },
};

const document = {
  querySelector(selector) {
    if (selector === SIGNUP_EMAIL_INPUT_SELECTOR) {
      return phase === 'email' ? emailInput : null;
    }
    if (selector === SIGNUP_PHONE_INPUT_SELECTOR) {
      return phase === 'phone' ? phoneInput : null;
    }
    return null;
  },
  querySelectorAll(selector) {
    if (selector === 'button, a, [role="button"], [role="link"]') {
      return phase === 'email' ? [switchButton] : [];
    }
    if (selector === 'a, button, [role="button"], [role="link"]') {
      return phase === 'entry' ? [signupButton] : [];
    }
    if (selector === 'input') {
      if (phase === 'email') return [emailInput];
      if (phase === 'phone') return [phoneInput];
      return [];
    }
    return [];
  },
};

const location = {
  href: 'https://chatgpt.com/',
};

const Date = {
  now() {
    return now;
  },
};

${extractConst('SIGNUP_ENTRY_TRIGGER_PATTERN')}
${extractConst('SIGNUP_EMAIL_INPUT_SELECTOR')}
${extractConst('SIGNUP_PHONE_INPUT_SELECTOR')}
${extractConst('SIGNUP_SWITCH_TO_EMAIL_PATTERN')}
${extractConst('SIGNUP_SWITCH_ACTION_PATTERN')}
${extractConst('SIGNUP_EMAIL_ACTION_PATTERN')}
${extractConst('SIGNUP_WORK_EMAIL_PATTERN')}
${extractConst('SIGNUP_PHONE_ACTION_PATTERN')}
${extractConst('SIGNUP_SWITCH_TO_PHONE_PATTERN')}
${extractConst('SIGNUP_MORE_OPTIONS_PATTERN')}

function isVisibleElement(el) {
  return Boolean(el);
}

function isActionEnabled(el) {
  return Boolean(el) && !el.disabled && el.getAttribute('aria-disabled') !== 'true';
}

function getActionText(el) {
  return [el?.textContent, el?.value, el?.getAttribute?.('aria-label'), el?.getAttribute?.('title')]
    .filter(Boolean)
    .join(' ')
    .replace(/\\s+/g, ' ')
    .trim();
}

function getSignupPasswordInput() {
  return null;
}

function isSignupPasswordPage() {
  return false;
}

function getSignupPasswordSubmitButton() {
  return null;
}

function getSignupPasswordDisplayedEmail() {
  return '';
}

function getPageTextSnapshot() {
  return phase === 'entry' ? '登录 免费注册' : '';
}

function throwIfStopped() {}

function log(message, level = 'info') {
  logs.push({ message, level });
}

async function humanPause() {}

function simulateClick(target) {
  clicks.push(getActionText(target));
  if (target === signupButton) {
    phase = 'email';
  } else if (target === switchButton) {
    phase = 'phone';
  }
}

async function sleep(ms) {
  now += ms;
}

${extractFunction('getSignupEmailInput')}
${extractFunction('getSignupPhoneInput')}
${extractFunction('findSignupUseEmailTrigger')}
${extractFunction('findSignupUsePhoneTrigger')}
${extractFunction('findSignupMoreOptionsTrigger')}
${extractFunction('getSignupEmailContinueButton')}
${extractFunction('findSignupEntryTrigger')}
${extractFunction('inspectSignupEntryState')}
${extractFunction('waitForSignupPhoneEntryState')}
function getSignupEntryDiagnostics() { return {}; }
${extractFunction('ensureSignupPhoneEntryReady')}

return {
  async run() {
    return ensureSignupPhoneEntryReady();
  },
  getClicks() {
    return clicks.slice();
  },
};
`)();

  const result = await api.run();

  assert.deepEqual(result, {
    ready: true,
    state: 'phone_entry',
    url: 'https://chatgpt.com/',
  });
  assert.deepEqual(api.getClicks(), ['免费注册', 'Continue with phone number']);
});

test('waitForSignupPhoneEntryState retries the signup entry click five times before giving up', async () => {
  const api = new Function(`
const logs = [];
const clicks = [];
let now = 0;

const signupButton = {
  textContent: '免费注册',
  value: '',
  disabled: false,
  getAttribute(name) {
    if (name === 'type') return 'button';
    return '';
  },
  getBoundingClientRect() {
    return { width: 120, height: 36 };
  },
};

const document = {
  querySelector() {
    return null;
  },
  querySelectorAll(selector) {
    if (selector === 'a, button, [role="button"], [role="link"]') {
      return [signupButton];
    }
    return [];
  },
};

const location = {
  href: 'https://chatgpt.com/',
};

const Date = {
  now() {
    return now;
  },
};

${extractConst('SIGNUP_ENTRY_TRIGGER_PATTERN')}
${extractConst('SIGNUP_EMAIL_INPUT_SELECTOR')}
${extractConst('SIGNUP_PHONE_INPUT_SELECTOR')}
${extractConst('SIGNUP_SWITCH_TO_EMAIL_PATTERN')}
${extractConst('SIGNUP_SWITCH_ACTION_PATTERN')}
${extractConst('SIGNUP_EMAIL_ACTION_PATTERN')}
${extractConst('SIGNUP_WORK_EMAIL_PATTERN')}
${extractConst('SIGNUP_PHONE_ACTION_PATTERN')}
${extractConst('SIGNUP_SWITCH_TO_PHONE_PATTERN')}
${extractConst('SIGNUP_MORE_OPTIONS_PATTERN')}

function isVisibleElement(el) {
  return Boolean(el);
}

function isActionEnabled(el) {
  return Boolean(el) && !el.disabled && el.getAttribute('aria-disabled') !== 'true';
}

function getActionText(el) {
  return [el?.textContent, el?.value, el?.getAttribute?.('aria-label'), el?.getAttribute?.('title')]
    .filter(Boolean)
    .join(' ')
    .replace(/\\s+/g, ' ')
    .trim();
}

function getSignupPasswordInput() {
  return null;
}

function isSignupPasswordPage() {
  return false;
}

function getSignupPasswordSubmitButton() {
  return null;
}

function getSignupPasswordDisplayedEmail() {
  return '';
}

function throwIfStopped() {}

function log(message, level = 'info') {
  logs.push({ message, level });
}

function simulateClick(target) {
  clicks.push(getActionText(target));
}

async function humanPause() {}

async function sleep(ms) {
  now += ms;
}

${extractFunction('getSignupEmailInput')}
${extractFunction('getSignupPhoneInput')}
${extractFunction('findSignupUseEmailTrigger')}
${extractFunction('findSignupUsePhoneTrigger')}
${extractFunction('findSignupMoreOptionsTrigger')}
${extractFunction('getSignupEmailContinueButton')}
${extractFunction('findSignupEntryTrigger')}
${extractFunction('inspectSignupEntryState')}
${extractFunction('waitForSignupPhoneEntryState')}

return {
  async run() {
    return waitForSignupPhoneEntryState({ timeout: 30000, step: 2 });
  },
  getClicks() {
    return clicks.slice();
  },
  getLogs() {
    return logs.slice();
  },
};
`)();

  const snapshot = await api.run();

  assert.equal(snapshot.state, 'entry_home');
  assert.equal(api.getClicks().length, 6);
  assert.equal(api.getLogs().some(({ message }) => message.includes('重试 5/5')), true);
  assert.equal(api.getLogs().some(({ message, level }) => level === 'warn' && /已完成 5 次重试/.test(message)), true);
});

test('submitSignupPhoneNumberAndContinue auto-switches signup country before filling the local phone number', async () => {
  const api = new Function(`
const logs = [];
const clicks = [];
const filled = [];
const selectEvents = [];
let now = 0;

const continueButton = {
  textContent: 'Continue',
  value: '',
  disabled: false,
  getAttribute(name) {
    if (name === 'type') return 'submit';
    if (name === 'aria-disabled') return 'false';
    return '';
  },
  getBoundingClientRect() {
    return { width: 200, height: 48 };
  },
};

const countryOptions = [
  { value: 'AU', textContent: 'Australia (+61)', buttonText: '澳大利亚 (+61)' },
  { value: 'GB', textContent: 'United Kingdom (+44)', buttonText: '英国 (+44)' },
];

const countrySelect = {
  options: countryOptions,
  selectedIndex: 0,
  dispatchEvent(event) {
    selectEvents.push(event?.type || '');
    return true;
  },
};

Object.defineProperty(countrySelect, 'value', {
  get() {
    return countryOptions[countrySelect.selectedIndex]?.value || '';
  },
  set(nextValue) {
    const nextIndex = countryOptions.findIndex((option) => option.value === String(nextValue || ''));
    if (nextIndex >= 0) {
      countrySelect.selectedIndex = nextIndex;
    }
  },
});

const hiddenPhoneInput = {
  kind: 'hidden-phone',
  value: '',
  getAttribute() {
    return '';
  },
};

const phoneInput = {
  kind: 'phone',
  value: '',
  getAttribute(name) {
    if (name === 'type') return 'tel';
    return '';
  },
  closest(selector) {
    if (selector === 'form') {
      return form;
    }
    return form;
  },
};

const selectValueNode = {
  get textContent() {
    return countryOptions[countrySelect.selectedIndex]?.buttonText || '';
  },
};

const countryButton = {
  querySelector(selector) {
    return selector === '.react-aria-SelectValue' ? selectValueNode : null;
  },
  get textContent() {
    return selectValueNode.textContent;
  },
  getBoundingClientRect() {
    return { width: 240, height: 48 };
  },
};

const form = {
  textContent: '英国 (+44)',
  querySelector(selector) {
    if (selector === 'select') return countrySelect;
    if (selector === 'input[name="phoneNumber"]') return hiddenPhoneInput;
    if (selector === 'button[aria-haspopup="listbox"]') return countryButton;
    return null;
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
    if (selector === SIGNUP_PHONE_INPUT_SELECTOR) {
      return phoneInput;
    }
    if (selector === 'button[type="submit"], input[type="submit"]') {
      return continueButton;
    }
    return null;
  },
  querySelectorAll(selector) {
    if (selector === 'button, a, [role="button"], [role="link"]') {
      return [];
    }
    if (selector === 'a, button, [role="button"], [role="link"]') {
      return [];
    }
    if (selector === 'button, a, [role="button"], [role="link"], input[type="button"], input[type="submit"]') {
      return [continueButton];
    }
    if (selector === 'input') {
      return [phoneInput];
    }
    return [];
  },
};

const location = {
  href: 'https://chatgpt.com/',
};

const window = {
  setTimeout(fn) {
    fn();
  },
};

const Date = {
  now() {
    return now;
  },
};

class Event {
  constructor(type) {
    this.type = type;
  }
}

function isVisibleElement(el) {
  return Boolean(el);
}

function isActionEnabled(el) {
  return Boolean(el) && !el.disabled && el.getAttribute('aria-disabled') !== 'true';
}

function getActionText(el) {
  return [el?.textContent, el?.value, el?.getAttribute?.('aria-label'), el?.getAttribute?.('title')]
    .filter(Boolean)
    .join(' ')
    .replace(/\\s+/g, ' ')
    .trim();
}

function getSignupPasswordInput() {
  return null;
}

function isSignupPasswordPage() {
  return false;
}

function getSignupPasswordSubmitButton() {
  return null;
}

function findSignupEntryTrigger() {
  return null;
}

function getSignupPasswordDisplayedEmail() {
  return '';
}

function getPageTextSnapshot() {
  return countryButton.textContent;
}

function throwIfStopped() {}
function isStopError() { return false; }

function log(message, level = 'info') {
  logs.push({ message, level });
}

async function humanPause() {}

function simulateClick(target) {
  clicks.push(getActionText(target));
}

function fillInput(target, value) {
  target.value = value;
  filled.push({ target: target.kind, value });
}

async function sleep(ms) {
  now += ms;
}

${extractConst('SIGNUP_ENTRY_TRIGGER_PATTERN')}
${extractConst('SIGNUP_EMAIL_INPUT_SELECTOR')}
${extractConst('SIGNUP_PHONE_INPUT_SELECTOR')}
${extractConst('SIGNUP_SWITCH_TO_EMAIL_PATTERN')}
${extractConst('SIGNUP_SWITCH_ACTION_PATTERN')}
${extractConst('SIGNUP_EMAIL_ACTION_PATTERN')}
${extractConst('SIGNUP_WORK_EMAIL_PATTERN')}
${extractConst('SIGNUP_PHONE_ACTION_PATTERN')}
${extractConst('SIGNUP_SWITCH_TO_PHONE_PATTERN')}
${extractConst('SIGNUP_MORE_OPTIONS_PATTERN')}

${extractFunction('getSignupEmailInput')}
${extractFunction('getSignupPhoneInput')}
${extractFunction('findSignupUseEmailTrigger')}
${extractFunction('findSignupUsePhoneTrigger')}
${extractFunction('findSignupMoreOptionsTrigger')}
${extractFunction('getSignupEmailContinueButton')}
${extractFunction('inspectSignupEntryState')}
${extractFunction('getSignupEntryStateSummary')}
function getSignupEntryDiagnostics() { return {}; }
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
${extractFunction('getSignupPhoneForm')}
${extractFunction('getSignupPhoneControlRoots')}
${extractFunction('querySignupPhoneCountryElements')}
${extractFunction('isSignupPhoneCountrySelect')}
${extractFunction('getSignupPhoneCountrySelect')}
${extractFunction('getSignupPhoneSelectedCountryOption')}
${extractFunction('getSignupPhoneCountryButtonText')}
${extractFunction('getSignupPhoneCountryButton')}
${extractFunction('getSignupPhoneDisplayedDialCode')}
${extractFunction('getSignupPhoneHiddenNumberInput')}
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
${extractFunction('toNationalPhoneNumber')}
${extractFunction('toE164PhoneNumber')}
${extractFunction('resolveSignupPhoneDialCode')}
${extractFunction('waitForSignupPhoneEntryState')}
${extractFunction('submitSignupPhoneNumberAndContinue')}

return {
  async run() {
    return submitSignupPhoneNumberAndContinue({
      phoneNumber: '+447859232013',
      countryLabel: 'United Kingdom',
    });
  },
  getClicks() {
    return clicks.slice();
  },
  getFilled() {
    return filled.slice();
  },
  getSelectValue() {
    return countrySelect.value;
  },
  getSelectEvents() {
    return selectEvents.slice();
  },
};
`)();

  const result = await api.run();

  assert.equal(result.submitted, true);
  assert.equal(result.phoneInputValue, '7859232013');
  assert.equal(api.getSelectValue(), 'GB');
  assert.deepEqual(api.getSelectEvents(), ['input', 'change']);
  assert.deepEqual(api.getClicks(), ['Continue']);
  assert.deepEqual(api.getFilled(), [
    { target: 'phone', value: '7859232013' },
    { target: 'hidden-phone', value: '+447859232013' },
  ]);
});

test('submitSignupPhoneNumberAndContinue clicks the visible country listbox when the hidden select does not update the button', async () => {
  const api = new Function(`
const logs = [];
const clicks = [];
const filled = [];
const selectEvents = [];
let now = 0;
let listboxOpen = false;
let visibleCountryValue = 'AU';

const continueButton = {
  textContent: 'Continue',
  value: '',
  disabled: false,
  getAttribute(name) {
    if (name === 'type') return 'submit';
    if (name === 'aria-disabled') return 'false';
    return '';
  },
  getBoundingClientRect() {
    return { width: 200, height: 48 };
  },
};

const countryOptions = [
  { value: 'AU', textContent: 'Australia (+61)', buttonText: '澳大利亚 (+61)' },
  { value: 'GB', textContent: 'United Kingdom (+44)', buttonText: '英国 (+44)' },
];

const countrySelect = {
  options: countryOptions,
  selectedIndex: 0,
  dispatchEvent(event) {
    selectEvents.push(event?.type || '');
    return true;
  },
};

Object.defineProperty(countrySelect, 'value', {
  get() {
    return countryOptions[countrySelect.selectedIndex]?.value || '';
  },
  set(nextValue) {
    const nextIndex = countryOptions.findIndex((option) => option.value === String(nextValue || ''));
    if (nextIndex >= 0) {
      countrySelect.selectedIndex = nextIndex;
    }
  },
});

const hiddenPhoneInput = {
  kind: 'hidden-phone',
  value: '',
  getAttribute() {
    return '';
  },
};

const phoneInput = {
  kind: 'phone',
  value: '',
  getAttribute(name) {
    if (name === 'type') return 'tel';
    return '';
  },
  closest(selector) {
    if (selector === 'form') {
      return form;
    }
    return form;
  },
};

const selectValueNode = {
  get textContent() {
    return countryOptions.find((option) => option.value === visibleCountryValue)?.buttonText || '';
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

const gbOption = {
  textContent: '英国 (+44)',
  value: '',
  getAttribute() {
    return '';
  },
};

const form = {
  querySelector(selector) {
    if (selector === 'select') return countrySelect;
    if (selector === 'input[name="phoneNumber"]') return hiddenPhoneInput;
    if (selector === 'button[aria-haspopup="listbox"]') return countryButton;
    return null;
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
    if (selector === SIGNUP_PHONE_INPUT_SELECTOR) {
      return phoneInput;
    }
    if (selector === 'button[type="submit"], input[type="submit"]') {
      return continueButton;
    }
    return null;
  },
  querySelectorAll(selector) {
    if (selector === 'button, a, [role="button"], [role="link"]') {
      return [];
    }
    if (selector === 'a, button, [role="button"], [role="link"]') {
      return [];
    }
    if (selector === 'button, a, [role="button"], [role="link"], input[type="button"], input[type="submit"]') {
      return [continueButton];
    }
    if (selector === 'input') {
      return [phoneInput];
    }
    if (selector.includes('[role="option"]')) {
      return listboxOpen ? [gbOption] : [];
    }
    return [];
  },
};

const location = {
  href: 'https://chatgpt.com/',
};

const window = {
  setTimeout(fn) {
    fn();
  },
};

const Date = {
  now() {
    return now;
  },
};

class Event {
  constructor(type) {
    this.type = type;
  }
}

function isVisibleElement(el) {
  return Boolean(el);
}

function isActionEnabled(el) {
  return Boolean(el) && !el.disabled && el.getAttribute('aria-disabled') !== 'true';
}

function getActionText(el) {
  return [el?.textContent, el?.value, el?.getAttribute?.('aria-label'), el?.getAttribute?.('title')]
    .filter(Boolean)
    .join(' ')
    .replace(/\\s+/g, ' ')
    .trim();
}

function getSignupPasswordInput() {
  return null;
}

function isSignupPasswordPage() {
  return false;
}

function getSignupPasswordSubmitButton() {
  return null;
}

function findSignupEntryTrigger() {
  return null;
}

function getSignupPasswordDisplayedEmail() {
  return '';
}

function getPageTextSnapshot() {
  return countryButton.textContent;
}

function throwIfStopped() {}
function isStopError() { return false; }

function log(message, level = 'info') {
  logs.push({ message, level });
}

async function humanPause() {}

function simulateClick(target) {
  clicks.push(getActionText(target));
  if (target === countryButton) {
    listboxOpen = true;
  }
  if (target === gbOption) {
    visibleCountryValue = 'GB';
    countrySelect.value = 'GB';
    listboxOpen = false;
  }
}

function fillInput(target, value) {
  target.value = value;
  filled.push({ target: target.kind, value });
}

async function sleep(ms) {
  now += ms;
}

${extractConst('SIGNUP_ENTRY_TRIGGER_PATTERN')}
${extractConst('SIGNUP_EMAIL_INPUT_SELECTOR')}
${extractConst('SIGNUP_PHONE_INPUT_SELECTOR')}
${extractConst('SIGNUP_SWITCH_TO_EMAIL_PATTERN')}
${extractConst('SIGNUP_SWITCH_ACTION_PATTERN')}
${extractConst('SIGNUP_EMAIL_ACTION_PATTERN')}
${extractConst('SIGNUP_WORK_EMAIL_PATTERN')}
${extractConst('SIGNUP_PHONE_ACTION_PATTERN')}
${extractConst('SIGNUP_SWITCH_TO_PHONE_PATTERN')}
${extractConst('SIGNUP_MORE_OPTIONS_PATTERN')}

${extractFunction('getSignupEmailInput')}
${extractFunction('getSignupPhoneInput')}
${extractFunction('findSignupUseEmailTrigger')}
${extractFunction('findSignupUsePhoneTrigger')}
${extractFunction('findSignupMoreOptionsTrigger')}
${extractFunction('getSignupEmailContinueButton')}
${extractFunction('inspectSignupEntryState')}
${extractFunction('getSignupEntryStateSummary')}
function getSignupEntryDiagnostics() { return {}; }
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
${extractFunction('getSignupPhoneForm')}
${extractFunction('getSignupPhoneControlRoots')}
${extractFunction('querySignupPhoneCountryElements')}
${extractFunction('isSignupPhoneCountrySelect')}
${extractFunction('getSignupPhoneCountrySelect')}
${extractFunction('getSignupPhoneSelectedCountryOption')}
${extractFunction('getSignupPhoneCountryButtonText')}
${extractFunction('getSignupPhoneCountryButton')}
${extractFunction('getSignupPhoneDisplayedDialCode')}
${extractFunction('getSignupPhoneHiddenNumberInput')}
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
${extractFunction('toNationalPhoneNumber')}
${extractFunction('toE164PhoneNumber')}
${extractFunction('resolveSignupPhoneDialCode')}
${extractFunction('waitForSignupPhoneEntryState')}
${extractFunction('submitSignupPhoneNumberAndContinue')}

return {
  async run() {
    return submitSignupPhoneNumberAndContinue({
      phoneNumber: '+447859232013',
      countryLabel: 'United Kingdom',
    });
  },
  getClicks() {
    return clicks.slice();
  },
  getFilled() {
    return filled.slice();
  },
  getSelectValue() {
    return countrySelect.value;
  },
  getVisibleCountryText() {
    return countryButton.textContent;
  },
  getSelectEvents() {
    return selectEvents.slice();
  },
};
`)();

  const result = await api.run();

  assert.equal(result.submitted, true);
  assert.equal(result.phoneInputValue, '7859232013');
  assert.equal(api.getSelectValue(), 'GB');
  assert.equal(api.getVisibleCountryText(), '英国 (+44)');
  assert.deepEqual(api.getSelectEvents(), ['input', 'change']);
  assert.deepEqual(api.getClicks(), ['澳大利亚 (+61)', '英国 (+44)', 'Continue']);
  assert.deepEqual(api.getFilled(), [
    { target: 'phone', value: '7859232013' },
    { target: 'hidden-phone', value: '+447859232013' },
  ]);
});

test('submitSignupPhoneNumberAndContinue can select country by phone dial code without country label or hidden select', async () => {
  const api = new Function(`
const clicks = [];
const filled = [];
let now = 0;
let listboxOpen = false;
let visibleCountryText = '印度尼西亚 +(62)';

const continueButton = {
  textContent: 'Continue',
  value: '',
  disabled: false,
  getAttribute(name) {
    if (name === 'type') return 'submit';
    if (name === 'aria-disabled') return 'false';
    return '';
  },
  getBoundingClientRect() {
    return { width: 200, height: 48 };
  },
};

const phoneInput = {
  kind: 'phone',
  value: '',
  parentElement: null,
  getAttribute(name) {
    if (name === 'type') return 'tel';
    return '';
  },
  closest() {
    return null;
  },
};

const countryButton = {
  textContent: '',
  querySelector(selector) {
    return selector === '.react-aria-SelectValue' ? { textContent: visibleCountryText } : null;
  },
  getAttribute(name) {
    if (name === 'aria-haspopup') return 'listbox';
    return '';
  },
  getBoundingClientRect() {
    return { width: 240, height: 48 };
  },
};

const gbOption = {
  textContent: '英国 +(44)',
  getAttribute() {
    return '';
  },
  getBoundingClientRect() {
    return { width: 200, height: 36 };
  },
};

const idOption = {
  textContent: '印度尼西亚 +(62)',
  getAttribute() {
    return '';
  },
  getBoundingClientRect() {
    return { width: 200, height: 36 };
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
    if (selector === SIGNUP_PHONE_INPUT_SELECTOR) return phoneInput;
    if (selector === 'button[type="submit"], input[type="submit"]') return continueButton;
    return null;
  },
  querySelectorAll(selector) {
    if (selector === 'button, a, [role="button"], [role="link"]') return [];
    if (selector === 'a, button, [role="button"], [role="link"]') return [];
    if (selector === 'button, a, [role="button"], [role="link"], input[type="button"], input[type="submit"]') return [continueButton];
    if (selector === 'input') return [phoneInput];
    if (selector === 'select') return [];
    if (selector.includes('aria-haspopup="listbox"') || selector.includes('aria-expanded')) return [countryButton];
    if (selector.includes('[role="option"]')) return listboxOpen ? [idOption, gbOption] : [];
    return [];
  },
};

const location = {
  href: 'https://chatgpt.com/',
};

const window = {
  setTimeout(fn) {
    fn();
  },
};

const Date = {
  now() {
    return now;
  },
};

class Event {
  constructor(type) {
    this.type = type;
  }
}

function isVisibleElement(el) {
  return Boolean(el) && (!el.getBoundingClientRect || el.getBoundingClientRect().width > 0);
}

function isActionEnabled(el) {
  return Boolean(el) && !el.disabled && el.getAttribute('aria-disabled') !== 'true';
}

function getActionText(el) {
  return [el?.textContent, el?.value, el?.getAttribute?.('aria-label'), el?.getAttribute?.('title')]
    .filter(Boolean)
    .join(' ')
    .replace(/\\s+/g, ' ')
    .trim();
}

function getSignupPasswordInput() { return null; }
function isSignupPasswordPage() { return false; }
function getSignupPasswordSubmitButton() { return null; }
function findSignupEntryTrigger() { return null; }
function getSignupPasswordDisplayedEmail() { return ''; }
function getPageTextSnapshot() { return visibleCountryText; }
function throwIfStopped() {}
function isStopError() { return false; }
function log() {}
async function humanPause() {}

function simulateClick(target) {
  clicks.push(getActionText(target) || visibleCountryText);
  if (target === countryButton) {
    listboxOpen = true;
  }
  if (target === gbOption) {
    visibleCountryText = '英国 +(44)';
    listboxOpen = false;
  }
}

function fillInput(target, value) {
  target.value = value;
  filled.push({ target: target.kind, value });
}

async function sleep(ms) {
  now += ms;
}

${extractConst('SIGNUP_ENTRY_TRIGGER_PATTERN')}
${extractConst('SIGNUP_EMAIL_INPUT_SELECTOR')}
${extractConst('SIGNUP_PHONE_INPUT_SELECTOR')}
${extractConst('SIGNUP_SWITCH_TO_EMAIL_PATTERN')}
${extractConst('SIGNUP_SWITCH_ACTION_PATTERN')}
${extractConst('SIGNUP_EMAIL_ACTION_PATTERN')}
${extractConst('SIGNUP_WORK_EMAIL_PATTERN')}
${extractConst('SIGNUP_PHONE_ACTION_PATTERN')}
${extractConst('SIGNUP_SWITCH_TO_PHONE_PATTERN')}
${extractConst('SIGNUP_MORE_OPTIONS_PATTERN')}

${extractFunction('getSignupEmailInput')}
${extractFunction('getSignupPhoneInput')}
${extractFunction('findSignupUseEmailTrigger')}
${extractFunction('findSignupUsePhoneTrigger')}
${extractFunction('findSignupMoreOptionsTrigger')}
${extractFunction('getSignupEmailContinueButton')}
${extractFunction('inspectSignupEntryState')}
${extractFunction('getSignupEntryStateSummary')}
function getSignupEntryDiagnostics() { return {}; }
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
${extractFunction('getSignupPhoneForm')}
${extractFunction('getSignupPhoneControlRoots')}
${extractFunction('querySignupPhoneCountryElements')}
${extractFunction('isSignupPhoneCountrySelect')}
${extractFunction('getSignupPhoneCountrySelect')}
${extractFunction('getSignupPhoneSelectedCountryOption')}
${extractFunction('getSignupPhoneCountryButtonText')}
${extractFunction('getSignupPhoneCountryButton')}
${extractFunction('getSignupPhoneDisplayedDialCode')}
${extractFunction('getSignupPhoneHiddenNumberInput')}
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
${extractFunction('toNationalPhoneNumber')}
${extractFunction('toE164PhoneNumber')}
${extractFunction('resolveSignupPhoneDialCode')}
${extractFunction('waitForSignupPhoneEntryState')}
${extractFunction('submitSignupPhoneNumberAndContinue')}

return {
  async run() {
    return submitSignupPhoneNumberAndContinue({
      phoneNumber: '447423278610',
      countryLabel: '',
    });
  },
  getClicks() {
    return clicks.slice();
  },
  getFilled() {
    return filled.slice();
  },
  getVisibleCountryText() {
    return visibleCountryText;
  },
};
`)();

  const result = await api.run();

  assert.equal(result.submitted, true);
  assert.equal(result.phoneInputValue, '7423278610');
  assert.equal(api.getVisibleCountryText(), '英国 +(44)');
  assert.deepEqual(api.getClicks(), ['印度尼西亚 +(62)', '英国 +(44)', 'Continue']);
  assert.deepEqual(api.getFilled(), [{ target: 'phone', value: '7423278610' }]);
});

test('submitSignupPhoneNumberAndContinue switches from email mode to phone mode and submits local number', async () => {
  const api = new Function(`
const logs = [];
const clicks = [];
const filled = [];
let phase = 'email';
let now = 0;

const emailInput = {
  kind: 'email',
  value: '',
  getAttribute(name) {
    if (name === 'type') return 'email';
    return '';
  },
};

const phoneInput = {
  kind: 'phone',
  value: '',
  textContent: 'Thailand (+66)',
  getAttribute(name) {
    if (name === 'type') return 'tel';
    return '';
  },
  closest() {
    return { textContent: 'Thailand (+66)' };
  },
};

const switchButton = {
  textContent: 'Continue with phone number',
  value: '',
  disabled: false,
  getAttribute(name) {
    if (name === 'type') return 'button';
    return '';
  },
  getBoundingClientRect() {
    return { width: 200, height: 48 };
  },
};

const continueButton = {
  textContent: 'Continue',
  value: '',
  disabled: false,
  getAttribute(name) {
    if (name === 'type') return 'submit';
    if (name === 'aria-disabled') return 'false';
    return '';
  },
  getBoundingClientRect() {
    return { width: 200, height: 48 };
  },
};

const document = {
  querySelector(selector) {
    if (selector === SIGNUP_EMAIL_INPUT_SELECTOR) {
      return phase === 'email' ? emailInput : null;
    }
    if (selector === SIGNUP_PHONE_INPUT_SELECTOR) {
      return phase === 'phone' ? phoneInput : null;
    }
    if (selector === 'button[type="submit"], input[type="submit"]') {
      return phase === 'phone' ? continueButton : null;
    }
    return null;
  },
  querySelectorAll(selector) {
    if (selector === 'button, a, [role="button"], [role="link"]') {
      return phase === 'email' ? [switchButton] : [];
    }
    if (selector === 'a, button, [role="button"], [role="link"]') {
      return [];
    }
    if (selector === 'button, a, [role="button"], [role="link"], input[type="button"], input[type="submit"]') {
      return phase === 'phone' ? [continueButton] : [];
    }
    if (selector === 'input') {
      return phase === 'phone' ? [phoneInput] : [emailInput];
    }
    return [];
  },
};

const location = {
  href: 'https://chatgpt.com/',
};

const window = {
  setTimeout(fn) {
    fn();
  },
};

const Date = {
  now() {
    return now;
  },
};

${extractConst('SIGNUP_ENTRY_TRIGGER_PATTERN')}
${extractConst('SIGNUP_EMAIL_INPUT_SELECTOR')}
${extractConst('SIGNUP_PHONE_INPUT_SELECTOR')}
${extractConst('SIGNUP_SWITCH_TO_EMAIL_PATTERN')}
${extractConst('SIGNUP_SWITCH_ACTION_PATTERN')}
${extractConst('SIGNUP_EMAIL_ACTION_PATTERN')}
${extractConst('SIGNUP_WORK_EMAIL_PATTERN')}
${extractConst('SIGNUP_PHONE_ACTION_PATTERN')}
${extractConst('SIGNUP_SWITCH_TO_PHONE_PATTERN')}
${extractConst('SIGNUP_MORE_OPTIONS_PATTERN')}

function isVisibleElement(el) {
  return Boolean(el);
}

function isActionEnabled(el) {
  return Boolean(el) && !el.disabled && el.getAttribute('aria-disabled') !== 'true';
}

function getActionText(el) {
  return [el?.textContent, el?.value, el?.getAttribute?.('aria-label'), el?.getAttribute?.('title')]
    .filter(Boolean)
    .join(' ')
    .replace(/\\s+/g, ' ')
    .trim();
}

function getSignupPasswordInput() {
  return null;
}

function isSignupPasswordPage() {
  return false;
}

function getSignupPasswordSubmitButton() {
  return null;
}

function findSignupEntryTrigger() {
  return null;
}

function getSignupPasswordDisplayedEmail() {
  return '';
}

function getPageTextSnapshot() {
  return phase === 'phone' ? 'Thailand (+66)' : '';
}

function throwIfStopped() {}
function isStopError() { return false; }

function log(message, level = 'info') {
  logs.push({ message, level });
}

async function humanPause() {}

function simulateClick(target) {
  clicks.push(getActionText(target));
  if (target === switchButton) {
    phase = 'phone';
  }
}

function fillInput(target, value) {
  target.value = value;
  filled.push({ target: target.kind, value });
}

async function sleep(ms) {
  now += ms;
}

${extractFunction('getSignupEmailInput')}
${extractFunction('getSignupPhoneInput')}
${extractFunction('findSignupUseEmailTrigger')}
${extractFunction('findSignupUsePhoneTrigger')}
${extractFunction('findSignupMoreOptionsTrigger')}
${extractFunction('getSignupEmailContinueButton')}
${extractFunction('inspectSignupEntryState')}
${extractFunction('getSignupEntryStateSummary')}
function getSignupEntryDiagnostics() { return {}; }
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
${extractFunction('getSignupPhoneForm')}
${extractFunction('getSignupPhoneControlRoots')}
${extractFunction('querySignupPhoneCountryElements')}
${extractFunction('isSignupPhoneCountrySelect')}
${extractFunction('getSignupPhoneCountrySelect')}
${extractFunction('getSignupPhoneSelectedCountryOption')}
${extractFunction('getSignupPhoneCountryButtonText')}
${extractFunction('getSignupPhoneCountryButton')}
${extractFunction('getSignupPhoneDisplayedDialCode')}
${extractFunction('getSignupPhoneHiddenNumberInput')}
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
${extractFunction('toNationalPhoneNumber')}
${extractFunction('toE164PhoneNumber')}
${extractFunction('resolveSignupPhoneDialCode')}
${extractFunction('waitForSignupPhoneEntryState')}
${extractFunction('submitSignupPhoneNumberAndContinue')}

return {
  async run() {
    return submitSignupPhoneNumberAndContinue({
      phoneNumber: '66959916439',
      countryLabel: 'Thailand',
    });
  },
  getClicks() {
    return clicks.slice();
  },
  getFilled() {
    return filled.slice();
  },
};
`)();

  const result = await api.run();

  assert.equal(result.submitted, true);
  assert.equal(result.phoneInputValue, '959916439');
  assert.deepEqual(api.getClicks(), ['Continue with phone number', 'Continue']);
  assert.deepEqual(api.getFilled(), [{ target: 'phone', value: '959916439' }]);
});
