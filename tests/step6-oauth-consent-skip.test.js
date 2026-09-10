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
  for (let index = start; index < source.length; index += 1) {
    const char = source[index];
    if (char === '(') {
      parenDepth += 1;
    } else if (char === ')') {
      parenDepth -= 1;
      if (parenDepth === 0) {
        signatureEnded = true;
      }
    } else if (char === '{' && signatureEnded) {
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
    const char = source[end];
    if (char === '{') depth += 1;
    if (char === '}') {
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

test('password submit treats direct OAuth consent as a login-code skip', async () => {
  const api = new Function(`
const location = { href: 'https://auth.openai.com/authorize' };

function inspectLoginAuthState() {
  return {
    state: 'oauth_consent_page',
    url: location.href,
  };
}

function throwIfStopped() {}
async function sleep() {
  throw new Error('should not wait once oauth consent is detected');
}

${extractFunction('createStep6SuccessResult')}
${extractFunction('createStep6OAuthConsentSuccessResult')}
${extractFunction('createStep6RecoverableResult')}
${extractFunction('normalizeStep6Snapshot')}
${extractFunction('resolveStep6PostSubmitSnapshot')}
${extractFunction('waitForStep6PostSubmitTransition')}
${extractFunction('waitForStep6PasswordSubmitTransition')}

return {
  run() {
    return waitForStep6PasswordSubmitTransition(123, 1000);
  },
};
`)();

  const transition = await api.run();

  assert.equal(transition.action, 'done');
  assert.equal(transition.result.state, 'oauth_consent_page');
  assert.equal(transition.result.skipLoginVerificationStep, true);
  assert.equal(transition.result.directOAuthConsentPage, true);
  assert.equal(transition.result.loginVerificationRequestedAt, null);
});

test('step 7 entry succeeds when the auth page is already on OAuth consent', async () => {
  const logs = [];
  const api = new Function(`
const location = { href: 'https://auth.openai.com/authorize' };
const logs = arguments[0];

function inspectLoginAuthState() {
  return {
    state: 'oauth_consent_page',
    url: location.href,
  };
}

function throwIfStopped() {}
async function sleep() {}
function log(message, level = 'info') {
  logs.push({ message, level });
}

${extractFunction('createStep6SuccessResult')}
${extractFunction('createStep6OAuthConsentSuccessResult')}
${extractFunction('normalizeStep6Snapshot')}
${extractFunction('waitForKnownLoginAuthState')}
${extractFunction('step6_login')}

return {
  run() {
    return step6_login({ email: 'user@example.com' });
  },
};
`)(logs);

  const result = await api.run();

  assert.equal(result.step6Outcome, 'success');
  assert.equal(result.state, 'oauth_consent_page');
  assert.equal(result.skipLoginVerificationStep, true);
  assert.equal(result.directOAuthConsentPage, true);
  assert.equal(logs.some(({ level }) => level === 'ok'), true);
});

test('step 7 clicks matching choose-account card and skips login code after OAuth consent', async () => {
  const api = new Function(`
let pageState = 'choose_account_page';
const clicked = [];
const location = {
  href: 'https://auth.openai.com/choose-an-account',
  pathname: '/choose-an-account',
};
const targetCard = {
  id: 'target-card',
  textContent: 'Tall Slept Fancy tall-slept-fancy@duck.com',
  value: '',
  parentElement: null,
  disabled: false,
  getAttribute(name) {
    if (name === 'role') return 'button';
    if (name === 'aria-disabled') return 'false';
    return '';
  },
  closest() {
    return null;
  },
};
const removeButton = {
  id: 'remove-button',
  textContent: '',
  value: '',
  parentElement: targetCard,
  disabled: false,
  getAttribute(name) {
    if (name === 'aria-label') return 'Remove tall-slept-fancy@duck.com';
    if (name === 'aria-disabled') return 'false';
    return '';
  },
  closest() {
    return null;
  },
};
const otherCard = {
  id: 'other-card',
  textContent: 'Other User other@example.com',
  value: '',
  parentElement: null,
  disabled: false,
  getAttribute(name) {
    if (name === 'role') return 'button';
    if (name === 'aria-disabled') return 'false';
    return '';
  },
  closest() {
    return null;
  },
};

const document = {
  body: {
    innerText: 'Welcome back Choose an account tall-slept-fancy@duck.com other@example.com',
    textContent: 'Welcome back Choose an account tall-slept-fancy@duck.com other@example.com',
  },
  querySelectorAll(selector) {
    if (String(selector).includes('body *')) return [removeButton, targetCard, otherCard];
    return [removeButton, targetCard, otherCard];
  },
};

function getOperationDelayRunner() {
  return async (_metadata, operation) => operation();
}
function isVisibleElement(element) {
  return Boolean(element);
}
function isActionEnabled(element) {
  return Boolean(element) && !element.disabled && element.getAttribute('aria-disabled') !== 'true';
}
function simulateClick(element) {
  clicked.push(element.id);
  if (element === targetCard) {
    pageState = 'oauth_consent_page';
    location.href = 'https://auth.openai.com/sign-in-with-chatgpt/codex/consent';
    location.pathname = '/sign-in-with-chatgpt/codex/consent';
  }
}
function inspectLoginAuthState() {
  return { state: pageState, url: location.href, chooseAccountPage: pageState === 'choose_account_page' };
}
function throwIfStopped() {}
async function sleep() {}
async function humanPause() {}
function log() {}
async function finalizeStep6VerificationReady() { return { routed: 'verification' }; }
async function step6LoginFromPasswordPage() { return { routed: 'password' }; }
async function step6LoginFromEmailPage() { return { routed: 'email' }; }
async function step6LoginFromPhonePage() { return { routed: 'phone' }; }
async function createStep6LoginTimeoutRecoveryTransition() { return { action: 'recoverable', result: { routed: 'timeout' } }; }

${extractConst('CHOOSE_ACCOUNT_PAGE_PATTERN')}
${extractConst('CHOOSE_ACCOUNT_REMOVE_ACTION_PATTERN')}
${extractConst('CHOOSE_ACCOUNT_OTHER_ACCOUNT_PATTERN')}
${extractConst('CHOOSE_ACCOUNT_ACTION_SELECTOR')}
${extractConst('CHOOSE_ACCOUNT_CARD_SELECTOR')}
${extractFunction('getPageTextSnapshot')}
${extractFunction('normalizeAuthAccountIdentifier')}
${extractFunction('getChooseAccountCandidateText')}
${extractFunction('isChooseAccountPage')}
${extractFunction('isChooseAccountRemovalAction')}
${extractFunction('resolveChooseAccountClickTarget')}
${extractFunction('resolveChooseAccountCardTarget')}
${extractFunction('findChooseAccountButtonForEmail')}
${extractFunction('findChooseAccountOtherAccountButton')}
${extractFunction('getChooseAccountListedEmails')}
${extractFunction('resolveChooseAccountAction')}
${extractFunction('createStep6SuccessResult')}
${extractFunction('createStep6OAuthConsentSuccessResult')}
${extractFunction('createStep6AddEmailSuccessResult')}
${extractFunction('createStep6AddPhoneSuccessResult')}
${extractFunction('createStep6RecoverableResult')}
${extractFunction('normalizeStep6Snapshot')}
${extractFunction('isOpenAiOAuthAuthorizationRoute')}
${extractFunction('isPostChooseAccountOAuthRoute')}
${extractFunction('waitForChooseAccountTransition')}
${extractFunction('resolveChooseAccountTransitionResult')}
${extractFunction('step6ChooseExistingAccount')}

return {
  clicked,
  run() {
    return step6ChooseExistingAccount(
      { email: 'TALL-SLEPT-FANCY@DUCK.COM', loginIdentifierType: 'email', visibleStep: 7 },
      { state: 'choose_account_page', url: location.href }
    );
  },
};
`)();

  const result = await api.run();

  assert.deepEqual(api.clicked, ['target-card']);
  assert.equal(result.step6Outcome, 'success');
  assert.equal(result.state, 'oauth_consent_page');
  assert.equal(result.skipLoginVerificationStep, true);
  assert.equal(result.directOAuthConsentPage, true);
  assert.equal(result.via, 'choose_account_oauth_consent_page');
});

test('step 7 hands off to post-login phone verification when choose-account lands on add-phone', async () => {
  const api = new Function(`
let pageState = 'choose_account_page';
const clicked = [];
const location = {
  href: 'https://auth.openai.com/choose-an-account',
  pathname: '/choose-an-account',
};
const targetCard = {
  id: 'target-card',
  textContent: 'Tug Geology Gazing tug-geology-gazing@duck.com',
  value: '',
  parentElement: null,
  disabled: false,
  getAttribute(name) {
    if (name === 'role') return 'button';
    if (name === 'aria-disabled') return 'false';
    return '';
  },
  closest() {
    return null;
  },
};

const document = {
  body: {
    innerText: 'Welcome back Choose an account tug-geology-gazing@duck.com',
    textContent: 'Welcome back Choose an account tug-geology-gazing@duck.com',
  },
  querySelectorAll(selector) {
    if (String(selector).includes('body *')) return [targetCard];
    return [targetCard];
  },
};

function getOperationDelayRunner() {
  return async (_metadata, operation) => operation();
}
function isVisibleElement(element) {
  return Boolean(element);
}
function isActionEnabled(element) {
  return Boolean(element) && !element.disabled && element.getAttribute('aria-disabled') !== 'true';
}
function simulateClick(element) {
  clicked.push(element.id);
  if (element === targetCard) {
    pageState = 'add_phone_page';
    location.href = 'https://auth.openai.com/add-phone';
    location.pathname = '/add-phone';
  }
}
function inspectLoginAuthState() {
  return { state: pageState, url: location.href, chooseAccountPage: pageState === 'choose_account_page' };
}
function throwIfStopped() {}
async function sleep() {}
async function humanPause() {}
function log() {}
async function finalizeStep6VerificationReady() { return { routed: 'verification' }; }
async function step6LoginFromPasswordPage() { return { routed: 'password' }; }
async function step6LoginFromEmailPage() { return { routed: 'email' }; }
async function step6LoginFromPhonePage() { return { routed: 'phone' }; }
async function step6OpenLoginEntry() { return { routed: 'entry' }; }
async function createStep6LoginTimeoutRecoveryTransition() { return { action: 'recoverable', result: { routed: 'timeout' } }; }

${extractConst('CHOOSE_ACCOUNT_PAGE_PATTERN')}
${extractConst('CHOOSE_ACCOUNT_REMOVE_ACTION_PATTERN')}
${extractConst('CHOOSE_ACCOUNT_OTHER_ACCOUNT_PATTERN')}
${extractConst('CHOOSE_ACCOUNT_ACTION_SELECTOR')}
${extractConst('CHOOSE_ACCOUNT_CARD_SELECTOR')}
${extractFunction('getPageTextSnapshot')}
${extractFunction('normalizeAuthAccountIdentifier')}
${extractFunction('getChooseAccountCandidateText')}
${extractFunction('isChooseAccountPage')}
${extractFunction('isChooseAccountRemovalAction')}
${extractFunction('resolveChooseAccountClickTarget')}
${extractFunction('resolveChooseAccountCardTarget')}
${extractFunction('findChooseAccountButtonForEmail')}
${extractFunction('findChooseAccountOtherAccountButton')}
${extractFunction('getChooseAccountListedEmails')}
${extractFunction('resolveChooseAccountAction')}
${extractFunction('createStep6SuccessResult')}
${extractFunction('createStep6OAuthConsentSuccessResult')}
${extractFunction('createStep6AddEmailSuccessResult')}
${extractFunction('createStep6AddPhoneSuccessResult')}
${extractFunction('createStep6RecoverableResult')}
${extractFunction('normalizeStep6Snapshot')}
${extractFunction('isOpenAiOAuthAuthorizationRoute')}
${extractFunction('isPostChooseAccountOAuthRoute')}
${extractFunction('waitForChooseAccountTransition')}
${extractFunction('resolveChooseAccountTransitionResult')}
${extractFunction('step6ChooseExistingAccount')}

return {
  clicked,
  run() {
    return step6ChooseExistingAccount(
      { email: 'tug-geology-gazing@duck.com', loginIdentifierType: 'email', visibleStep: 9 },
      { state: 'choose_account_page', url: location.href }
    );
  },
};
`)();

  const result = await api.run();

  assert.deepEqual(api.clicked, ['target-card']);
  assert.equal(result.step6Outcome, 'success');
  assert.equal(result.state, 'add_phone_page');
  assert.equal(result.skipLoginVerificationStep, true);
  assert.equal(result.addPhonePage, true);
  assert.equal(result.via, 'choose_account_add_phone_page');
});

test('step 7 skips login code when choose-account leaves for OAuth authorize route before consent DOM is ready', async () => {
  const api = new Function(`
let pageState = 'choose_account_page';
const clicked = [];
const location = {
  href: 'https://auth.openai.com/choose-an-account',
  pathname: '/choose-an-account',
};
const targetCard = {
  id: 'target-card',
  textContent: 'Tall Slept Fancy tall-slept-fancy@duck.com',
  value: '',
  parentElement: null,
  disabled: false,
  getAttribute(name) {
    if (name === 'role') return 'button';
    if (name === 'aria-disabled') return 'false';
    return '';
  },
  closest() {
    return null;
  },
};

const document = {
  body: {
    innerText: 'Welcome back Choose an account tall-slept-fancy@duck.com',
    textContent: 'Welcome back Choose an account tall-slept-fancy@duck.com',
  },
  querySelectorAll(selector) {
    if (String(selector).includes('body *')) return [targetCard];
    return [targetCard];
  },
};

function getOperationDelayRunner() {
  return async (_metadata, operation) => operation();
}
function isVisibleElement(element) {
  return Boolean(element);
}
function isActionEnabled(element) {
  return Boolean(element) && !element.disabled && element.getAttribute('aria-disabled') !== 'true';
}
function simulateClick(element) {
  clicked.push(element.id);
  if (element === targetCard) {
    pageState = 'unknown';
    location.href = 'https://auth.openai.com/authorize?client_id=codex-test&state=oauth-state';
    location.pathname = '/authorize';
  }
}
function inspectLoginAuthState() {
  return { state: pageState, url: location.href, chooseAccountPage: pageState === 'choose_account_page' };
}
function throwIfStopped() {}
async function sleep() {}
async function humanPause() {}
function log() {}
async function finalizeStep6VerificationReady() { return { routed: 'verification' }; }
async function step6LoginFromPasswordPage() { return { routed: 'password' }; }
async function step6LoginFromEmailPage() { return { routed: 'email' }; }
async function step6LoginFromPhonePage() { return { routed: 'phone' }; }
async function createStep6LoginTimeoutRecoveryTransition() { return { action: 'recoverable', result: { routed: 'timeout' } }; }

${extractConst('CHOOSE_ACCOUNT_PAGE_PATTERN')}
${extractConst('CHOOSE_ACCOUNT_REMOVE_ACTION_PATTERN')}
${extractConst('CHOOSE_ACCOUNT_OTHER_ACCOUNT_PATTERN')}
${extractConst('CHOOSE_ACCOUNT_ACTION_SELECTOR')}
${extractConst('CHOOSE_ACCOUNT_CARD_SELECTOR')}
${extractFunction('getPageTextSnapshot')}
${extractFunction('normalizeAuthAccountIdentifier')}
${extractFunction('getChooseAccountCandidateText')}
${extractFunction('isChooseAccountPage')}
${extractFunction('isChooseAccountRemovalAction')}
${extractFunction('resolveChooseAccountClickTarget')}
${extractFunction('resolveChooseAccountCardTarget')}
${extractFunction('findChooseAccountButtonForEmail')}
${extractFunction('findChooseAccountOtherAccountButton')}
${extractFunction('getChooseAccountListedEmails')}
${extractFunction('resolveChooseAccountAction')}
${extractFunction('createStep6SuccessResult')}
${extractFunction('createStep6OAuthConsentSuccessResult')}
${extractFunction('createStep6AddEmailSuccessResult')}
${extractFunction('createStep6AddPhoneSuccessResult')}
${extractFunction('createStep6RecoverableResult')}
${extractFunction('normalizeStep6Snapshot')}
${extractFunction('isOpenAiOAuthAuthorizationRoute')}
${extractFunction('isPostChooseAccountOAuthRoute')}
${extractFunction('waitForChooseAccountTransition')}
${extractFunction('resolveChooseAccountTransitionResult')}
${extractFunction('step6ChooseExistingAccount')}

return {
  clicked,
  run() {
    return step6ChooseExistingAccount(
      { email: 'tall-slept-fancy@duck.com', loginIdentifierType: 'email', visibleStep: 7 },
      { state: 'choose_account_page', url: location.href }
    );
  },
};
`)();

  const result = await api.run();

  assert.deepEqual(api.clicked, ['target-card']);
  assert.equal(result.step6Outcome, 'success');
  assert.equal(result.state, 'unknown');
  assert.equal(result.skipLoginVerificationStep, true);
  assert.equal(result.directOAuthConsentPage, true);
  assert.equal(result.via, 'choose_account_oauth_authorization_route');
});

test('step 7 clicks matching choose-account card when email is inside a non-action div card', async () => {
  const api = new Function(`
let pageState = 'choose_account_page';
const clicked = [];
const location = {
  href: 'https://auth.openai.com/choose-an-account',
  pathname: '/choose-an-account',
};

function createElement(id, textContent = '', attrs = {}) {
  return {
    id,
    textContent,
    value: '',
    parentElement: null,
    disabled: false,
    tagName: attrs.tagName || 'DIV',
    tabIndex: attrs.tabIndex ?? -1,
    className: attrs.className || '',
    getAttribute(name) {
      if (name === 'class') return this.className;
      if (name === 'aria-disabled') return 'false';
      if (name === 'role') return attrs.role || '';
      return attrs[name] || '';
    },
    closest(selector) {
      let current = this;
      while (current) {
        if (
          String(selector).includes('[class*="account" i]')
          && String(current.className || '').toLowerCase().includes('account')
        ) {
          return current;
        }
        current = current.parentElement;
      }
      return null;
    },
  };
}

const targetCard = createElement('target-card', 'Kenneth Wilson sedate-iodize-lisp@duck.com', {
  className: 'account-card rounded-xl',
});
const targetEmail = createElement('target-email', 'sedate-iodize-lisp@duck.com');
targetEmail.parentElement = targetCard;
const removeButton = createElement('remove-button', '', {
  tagName: 'BUTTON',
  'aria-label': 'Remove sedate-iodize-lisp@duck.com',
});
removeButton.parentElement = targetCard;
const otherCard = createElement('other-card', 'Other User other@example.com', {
  className: 'account-card rounded-xl',
});

const document = {
  body: {
    innerText: '欢迎回来 选择一个帐户 sedate-iodize-lisp@duck.com other@example.com',
    textContent: '欢迎回来 选择一个帐户 sedate-iodize-lisp@duck.com other@example.com',
  },
  querySelectorAll(selector) {
    if (String(selector).includes('body *')) return [removeButton, targetEmail, targetCard, otherCard];
    return [removeButton];
  },
};

function getOperationDelayRunner() {
  return async (_metadata, operation) => operation();
}
function isVisibleElement(element) {
  return Boolean(element);
}
function isActionEnabled(element) {
  return Boolean(element) && !element.disabled && element.getAttribute('aria-disabled') !== 'true';
}
function simulateClick(element) {
  clicked.push(element.id);
  if (element === targetCard) {
    pageState = 'oauth_consent_page';
    location.href = 'https://auth.openai.com/sign-in-with-chatgpt/codex/consent';
    location.pathname = '/sign-in-with-chatgpt/codex/consent';
  }
}
function inspectLoginAuthState() {
  return { state: pageState, url: location.href, chooseAccountPage: pageState === 'choose_account_page' };
}
function throwIfStopped() {}
async function sleep() {}
async function humanPause() {}
function log() {}
async function finalizeStep6VerificationReady() { return { routed: 'verification' }; }
async function step6LoginFromPasswordPage() { return { routed: 'password' }; }
async function step6LoginFromEmailPage() { return { routed: 'email' }; }
async function step6LoginFromPhonePage() { return { routed: 'phone' }; }
async function createStep6LoginTimeoutRecoveryTransition() { return { action: 'recoverable', result: { routed: 'timeout' } }; }

${extractConst('CHOOSE_ACCOUNT_PAGE_PATTERN')}
${extractConst('CHOOSE_ACCOUNT_REMOVE_ACTION_PATTERN')}
${extractConst('CHOOSE_ACCOUNT_OTHER_ACCOUNT_PATTERN')}
${extractConst('CHOOSE_ACCOUNT_ACTION_SELECTOR')}
${extractConst('CHOOSE_ACCOUNT_CARD_SELECTOR')}
${extractFunction('getPageTextSnapshot')}
${extractFunction('normalizeAuthAccountIdentifier')}
${extractFunction('getChooseAccountCandidateText')}
${extractFunction('isChooseAccountPage')}
${extractFunction('isChooseAccountRemovalAction')}
${extractFunction('resolveChooseAccountClickTarget')}
${extractFunction('resolveChooseAccountCardTarget')}
${extractFunction('findChooseAccountButtonForEmail')}
${extractFunction('findChooseAccountOtherAccountButton')}
${extractFunction('getChooseAccountListedEmails')}
${extractFunction('resolveChooseAccountAction')}
${extractFunction('createStep6SuccessResult')}
${extractFunction('createStep6OAuthConsentSuccessResult')}
${extractFunction('createStep6AddEmailSuccessResult')}
${extractFunction('createStep6AddPhoneSuccessResult')}
${extractFunction('createStep6RecoverableResult')}
${extractFunction('normalizeStep6Snapshot')}
${extractFunction('isOpenAiOAuthAuthorizationRoute')}
${extractFunction('isPostChooseAccountOAuthRoute')}
${extractFunction('waitForChooseAccountTransition')}
${extractFunction('resolveChooseAccountTransitionResult')}
${extractFunction('step6ChooseExistingAccount')}

return {
  clicked,
  run() {
    return step6ChooseExistingAccount(
      { email: 'sedate-iodize-lisp@duck.com', loginIdentifierType: 'email', visibleStep: 9 },
      { state: 'choose_account_page', url: location.href }
    );
  },
};
`)();

  const result = await api.run();

  assert.deepEqual(api.clicked, ['target-card']);
  assert.equal(result.step6Outcome, 'success');
  assert.equal(result.state, 'oauth_consent_page');
  assert.equal(result.skipLoginVerificationStep, true);
  assert.equal(result.directOAuthConsentPage, true);
});

test('step 7 does not click choose-account page when target email is missing', async () => {
  const api = new Function(`
const clicked = [];
const location = {
  href: 'https://auth.openai.com/choose-an-account',
  pathname: '/choose-an-account',
};
const otherCard = {
  id: 'other-card',
  textContent: 'Other User other@example.com',
  value: '',
  parentElement: null,
  disabled: false,
  getAttribute(name) {
    if (name === 'role') return 'button';
    if (name === 'aria-disabled') return 'false';
    return '';
  },
  closest() {
    return null;
  },
};
const document = {
  body: {
    innerText: 'Welcome back Choose an account other@example.com',
    textContent: 'Welcome back Choose an account other@example.com',
  },
  querySelectorAll() {
    return [otherCard];
  },
};

function getOperationDelayRunner() {
  return async (_metadata, operation) => operation();
}
function isVisibleElement(element) {
  return Boolean(element);
}
function isActionEnabled(element) {
  return Boolean(element) && !element.disabled && element.getAttribute('aria-disabled') !== 'true';
}
function simulateClick(element) {
  clicked.push(element.id);
}
function inspectLoginAuthState() {
  return { state: 'choose_account_page', url: location.href, chooseAccountPage: true };
}
function throwIfStopped() {}
async function sleep() {}
async function humanPause() {}
function log() {}
async function finalizeStep6VerificationReady() { return { routed: 'verification' }; }
async function step6LoginFromPasswordPage() { return { routed: 'password' }; }
async function step6LoginFromEmailPage() { return { routed: 'email' }; }
async function step6LoginFromPhonePage() { return { routed: 'phone' }; }
async function createStep6LoginTimeoutRecoveryTransition() { return { action: 'recoverable', result: { routed: 'timeout' } }; }

${extractConst('CHOOSE_ACCOUNT_PAGE_PATTERN')}
${extractConst('CHOOSE_ACCOUNT_REMOVE_ACTION_PATTERN')}
${extractConst('CHOOSE_ACCOUNT_OTHER_ACCOUNT_PATTERN')}
${extractConst('CHOOSE_ACCOUNT_ACTION_SELECTOR')}
${extractConst('CHOOSE_ACCOUNT_CARD_SELECTOR')}
${extractFunction('getPageTextSnapshot')}
${extractFunction('normalizeAuthAccountIdentifier')}
${extractFunction('getChooseAccountCandidateText')}
${extractFunction('isChooseAccountPage')}
${extractFunction('isChooseAccountRemovalAction')}
${extractFunction('resolveChooseAccountClickTarget')}
${extractFunction('resolveChooseAccountCardTarget')}
${extractFunction('findChooseAccountButtonForEmail')}
${extractFunction('findChooseAccountOtherAccountButton')}
${extractFunction('getChooseAccountListedEmails')}
${extractFunction('resolveChooseAccountAction')}
${extractFunction('createStep6SuccessResult')}
${extractFunction('createStep6OAuthConsentSuccessResult')}
${extractFunction('createStep6AddEmailSuccessResult')}
${extractFunction('createStep6AddPhoneSuccessResult')}
${extractFunction('createStep6RecoverableResult')}
${extractFunction('normalizeStep6Snapshot')}
${extractFunction('isOpenAiOAuthAuthorizationRoute')}
${extractFunction('isPostChooseAccountOAuthRoute')}
${extractFunction('waitForChooseAccountTransition')}
${extractFunction('resolveChooseAccountTransitionResult')}
${extractFunction('step6ChooseExistingAccount')}

return {
  clicked,
  run() {
    return step6ChooseExistingAccount(
      { email: 'target@example.com', loginIdentifierType: 'email', visibleStep: 7 },
      { state: 'choose_account_page', url: location.href }
    );
  },
};
`)();

  const result = await api.run();

  assert.deepEqual(api.clicked, []);
  assert.equal(result.step6Outcome, 'recoverable');
  assert.equal(result.reason, 'choose_account_target_not_found');
});

test('step 7 uses another-account login when choose-account lists a different email', async () => {
  const api = new Function(`
let pageState = 'choose_account_page';
const clicked = [];
const location = {
  href: 'https://auth.openai.com/choose-an-account',
  pathname: '/choose-an-account',
};
const existingCard = {
  id: 'existing-card',
  tagName: 'BUTTON',
  textContent: 'p 选择帐户 pang-pushing-dealt@duck.com pang-pushing-dealt@duck.com',
  value: '',
  parentElement: null,
  disabled: false,
  className: '_root_2sicu_62 _leftAlign_2sicu_99 _outline_2sicu_119',
  getAttribute(name) {
    if (name === 'aria-disabled') return 'false';
    if (name === 'class') return this.className;
    return '';
  },
  closest() {
    return null;
  },
};
const removeButton = {
  id: 'remove-button',
  tagName: 'BUTTON',
  textContent: '移除帐户：pang-pushing-dealt@duck.com',
  value: '',
  parentElement: null,
  disabled: false,
  getAttribute(name) {
    if (name === 'aria-label') return '移除帐户：pang-pushing-dealt@duck.com';
    if (name === 'aria-disabled') return 'false';
    return '';
  },
  closest() {
    return null;
  },
};
const otherAccount = {
  id: 'other-account',
  tagName: 'A',
  textContent: '登录至另一个帐户',
  value: '',
  parentElement: null,
  disabled: false,
  getAttribute(name) {
    if (name === 'aria-disabled') return 'false';
    return '';
  },
  closest() {
    return null;
  },
};
const createAccount = {
  id: 'create-account',
  tagName: 'A',
  textContent: '创建帐户',
  value: '',
  parentElement: null,
  disabled: false,
  getAttribute(name) {
    if (name === 'aria-disabled') return 'false';
    return '';
  },
  closest() {
    return null;
  },
};
const document = {
  body: {
    innerText: '欢迎回来 选择一个帐户 pang-pushing-dealt@duck.com 登录至另一个帐户 创建帐户',
    textContent: '欢迎回来 选择一个帐户 pang-pushing-dealt@duck.com 登录至另一个帐户 创建帐户',
  },
  querySelectorAll(selector) {
    if (String(selector).includes('body *')) return [existingCard, removeButton, otherAccount, createAccount];
    return [existingCard, removeButton, otherAccount, createAccount];
  },
};

function getOperationDelayRunner() {
  return async (_metadata, operation) => operation();
}
function isVisibleElement(element) {
  return Boolean(element);
}
function isActionEnabled(element) {
  return Boolean(element) && !element.disabled && element.getAttribute('aria-disabled') !== 'true';
}
function simulateClick(element) {
  clicked.push(element.id);
  if (element === otherAccount) {
    pageState = 'email_page';
    location.href = 'https://auth.openai.com/log-in';
    location.pathname = '/log-in';
  }
}
function inspectLoginAuthState() {
  return { state: pageState, url: location.href, chooseAccountPage: pageState === 'choose_account_page' };
}
function throwIfStopped() {}
async function sleep() {}
async function humanPause() {}
function log() {}
async function finalizeStep6VerificationReady() { return { routed: 'verification' }; }
async function step6LoginFromPasswordPage() { return { routed: 'password' }; }
async function step6LoginFromEmailPage(payload, snapshot) {
  return {
    routed: 'email',
    email: payload.email,
    state: snapshot.state,
  };
}
async function step6LoginFromPhonePage() { return { routed: 'phone' }; }
async function step6OpenLoginEntry() { return { routed: 'entry' }; }
async function createStep6LoginTimeoutRecoveryTransition() { return { action: 'recoverable', result: { routed: 'timeout' } }; }

${extractConst('CHOOSE_ACCOUNT_PAGE_PATTERN')}
${extractConst('CHOOSE_ACCOUNT_REMOVE_ACTION_PATTERN')}
${extractConst('CHOOSE_ACCOUNT_OTHER_ACCOUNT_PATTERN')}
${extractConst('CHOOSE_ACCOUNT_ACTION_SELECTOR')}
${extractConst('CHOOSE_ACCOUNT_CARD_SELECTOR')}
${extractFunction('getPageTextSnapshot')}
${extractFunction('normalizeAuthAccountIdentifier')}
${extractFunction('getChooseAccountCandidateText')}
${extractFunction('isChooseAccountPage')}
${extractFunction('isChooseAccountRemovalAction')}
${extractFunction('resolveChooseAccountClickTarget')}
${extractFunction('resolveChooseAccountCardTarget')}
${extractFunction('findChooseAccountButtonForEmail')}
${extractFunction('findChooseAccountOtherAccountButton')}
${extractFunction('getChooseAccountListedEmails')}
${extractFunction('resolveChooseAccountAction')}
${extractFunction('createStep6SuccessResult')}
${extractFunction('createStep6OAuthConsentSuccessResult')}
${extractFunction('createStep6AddEmailSuccessResult')}
${extractFunction('createStep6AddPhoneSuccessResult')}
${extractFunction('createStep6RecoverableResult')}
${extractFunction('normalizeStep6Snapshot')}
${extractFunction('isOpenAiOAuthAuthorizationRoute')}
${extractFunction('isPostChooseAccountOAuthRoute')}
${extractFunction('waitForChooseAccountTransition')}
${extractFunction('resolveChooseAccountTransitionResult')}
${extractFunction('step6ChooseExistingAccount')}

return {
  clicked,
  run() {
    return step6ChooseExistingAccount(
      { email: 'sedate-iodize-lisp@duck.com', loginIdentifierType: 'email', visibleStep: 9 },
      { state: 'choose_account_page', url: location.href }
    );
  },
};
`)();

  const result = await api.run();

  assert.deepEqual(api.clicked, ['other-account']);
  assert.equal(result.routed, 'email');
  assert.equal(result.email, 'sedate-iodize-lisp@duck.com');
  assert.equal(result.state, 'email_page');
});
