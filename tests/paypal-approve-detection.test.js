const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const vm = require('node:vm');

const source = fs.readFileSync('background/steps/paypal-approve.js', 'utf8');
const paypalContentSource = fs.readFileSync('content/paypal-flow.js', 'utf8');

function loadModule() {
  const self = {};
  return new Function('self', `${source}; return self.MultiPageBackgroundPayPalApprove;`)(self);
}

function createExecutor({
  pageStates,
  submitResults,
  tabUrls = [],
  getTabId = async (source) => (source === 'paypal-flow' ? 1 : null),
  isTabAlive = async () => true,
  queryTabs = [],
}) {
  const api = loadModule();
  const events = {
    completed: [],
    logs: [],
    messages: [],
    submittedPayloads: [],
    updatedTabs: [],
  };
  const stateQueue = [...pageStates];
  const submitQueue = [...submitResults];
  const urlQueue = [...tabUrls];
  let lastUrl = urlQueue.shift() || 'https://www.paypal.com/signin';

  const executor = api.createPayPalApproveExecutor({
    addLog: async (message, level = 'info') => {
      events.logs.push({ message, level });
    },
    chrome: {
      tabs: {
        get: async (tabId = 1) => {
          if (urlQueue.length) {
            lastUrl = urlQueue.shift();
          }
          return {
            id: tabId,
            status: 'complete',
            url: lastUrl,
          };
        },
        query: async () => queryTabs,
        update: async (tabId, updateInfo) => {
          events.updatedTabs.push({ tabId, updateInfo });
          return {};
        },
      },
    },
    completeStepFromBackground: async (step, payload) => {
      events.completed.push({ step, payload });
    },
    ensureContentScriptReadyOnTabUntilStopped: async () => {},
    getTabId,
    isTabAlive,
    sendTabMessageUntilStopped: async (_tabId, _source, message) => {
      events.messages.push(message.type);
      if (message.type === 'PAYPAL_GET_STATE') {
        return stateQueue.shift() || pageStates[pageStates.length - 1] || {};
      }
      if (message.type === 'PAYPAL_SUBMIT_LOGIN') {
        events.submittedPayloads.push(message.payload);
        return submitQueue.shift() || { submitted: true, phase: 'password_submitted' };
      }
      if (message.type === 'PAYPAL_DISMISS_PROMPTS') {
        return { clicked: 0 };
      }
      if (message.type === 'PAYPAL_CLICK_APPROVE') {
        return { clicked: true };
      }
      return {};
    },
    setState: async () => {},
    sleepWithStop: async () => {},
    waitForTabCompleteUntilStopped: async () => {},
    waitForTabUrlMatchUntilStopped: async () => {},
  });

  return { executor, events };
}

function createPayPalContentHarness() {
  const paypalEvents = [];
  const attrs = new Map();
  let listener = null;
  let elements = [];
  const body = { innerText: '', textContent: '' };

  function createElement({ tagName = 'DIV', text = '', type = '', id = '', name = '', placeholder = '' } = {}) {
    return {
      nodeType: 1,
      tagName,
      type,
      id,
      name,
      placeholder,
      textContent: text,
      value: '',
      disabled: false,
      hidden: false,
      parentElement: null,
      style: { display: 'block', visibility: 'visible', opacity: '1' },
      getAttribute(key) {
        if (key === 'type') return this.type;
        if (key === 'id') return this.id;
        if (key === 'name') return this.name;
        if (key === 'placeholder') return this.placeholder;
        return null;
      },
      getBoundingClientRect() {
        return { left: 10, top: 10, width: 180, height: 44 };
      },
    };
  }

  const emailInput = createElement({ tagName: 'INPUT', type: 'email', id: 'email', name: 'login_email', placeholder: 'Email' });
  const nextButton = createElement({ tagName: 'BUTTON', text: 'Next', id: 'btnNext' });
  const passwordInput = createElement({ tagName: 'INPUT', type: 'password', id: 'password', name: 'login_password', placeholder: 'Password' });
  const loginButton = createElement({ tagName: 'BUTTON', text: 'Log In', id: 'btnLogin' });
  const promptButton = createElement({ tagName: 'BUTTON', text: 'Not now', id: 'notNow' });
  const approveButton = createElement({ tagName: 'BUTTON', text: 'Agree and Continue', id: 'approve' });
  elements = [emailInput, nextButton];

  const context = {
    console: { log() {}, warn() {}, error() {}, info() {} },
    location: { href: 'https://www.paypal.com/signin' },
    window: {},
    document: {
      readyState: 'complete',
      body,
      documentElement: {
        getAttribute(name) {
          return attrs.get(name) || null;
        },
        setAttribute(name, value) {
          attrs.set(name, String(value));
        },
      },
      querySelectorAll(selector) {
        if (selector === 'input') return elements.filter((element) => element.tagName === 'INPUT');
        if (selector === 'input[type="email"]') return elements.filter((element) => element.type === 'email');
        if (selector === 'input[type="password"]') return elements.filter((element) => element.type === 'password');
        if (String(selector || '').includes('button') || String(selector || '').includes('[role="button"]')) {
          return elements.filter((element) => element.tagName === 'BUTTON');
        }
        return [];
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
    CodexOperationDelay: {
      async performOperationWithDelay(metadata, operation) {
        paypalEvents.push(`operation:${metadata.label}:start`);
        const result = await operation();
        paypalEvents.push(`operation:${metadata.label}:end`);
        paypalEvents.push(`delay:${metadata.label}:2000`);
        return result;
      },
    },
    resetStopState() {},
    isStopError() { return false; },
    throwIfStopped() {},
    sleep() { return Promise.resolve(); },
    fillInput(element, value) {
      element.value = value;
      if (element === emailInput && value) {
        paypalEvents.push('fill:paypal-email');
      } else if (element === passwordInput && value) {
        paypalEvents.push('fill:paypal-password');
      }
    },
    simulateClick(element) {
      if (element === approveButton) {
        paypalEvents.push('click:paypal-approve');
      } else if (element === loginButton) {
        paypalEvents.push('click:paypal-password');
      } else if (element === promptButton) {
        paypalEvents.push('click:paypal-dismiss-prompt');
      }
    },
  };
  context.window = context;
  context.window.getComputedStyle = (element) => element?.style || { display: 'block', visibility: 'visible', opacity: '1' };

  vm.createContext(context);
  vm.runInContext(paypalContentSource, context);
  assert.equal(typeof listener, 'function');

  async function send(message) {
    return await new Promise((resolve) => {
      listener(message, {}, resolve);
    });
  }

  function showApprovalPage() {
    context.location.href = 'https://www.paypal.com/checkoutnow/approve';
    body.innerText = '';
    body.textContent = '';
    elements = [approveButton];
  }

  function showPasswordPage() {
    context.location.href = 'https://www.paypal.com/signin';
    body.innerText = '';
    body.textContent = '';
    elements = [passwordInput, loginButton];
  }

  function showCombinedLoginPageWithPrefilledEmail(email) {
    context.location.href = 'https://www.paypal.com/signin';
    body.innerText = '';
    body.textContent = '';
    emailInput.value = email;
    elements = [emailInput, passwordInput, loginButton];
  }

  function showPasskeyPrompt() {
    context.location.href = 'https://www.paypal.com/signin';
    body.innerText = 'Save a passkey for faster login';
    body.textContent = body.innerText;
    elements = [promptButton];
  }

  return { paypalEvents, send, showApprovalPage, showCombinedLoginPageWithPrefilledEmail, showPasswordPage, showPasskeyPrompt };
}

test('PayPal approve keeps original combined email and password login path', async () => {
  const { executor, events } = createExecutor({
    pageStates: [
      { needsLogin: true, hasEmailInput: true, hasPasswordInput: true, loginPhase: 'login_combined' },
      { needsLogin: false, approveReady: true },
      { needsLogin: false, approveReady: true },
    ],
    submitResults: [
      { submitted: true, phase: 'password_submitted', awaiting: 'redirect_or_approval' },
    ],
  });

  await executor.executePayPalApprove({
    paypalEmail: 'user@example.com',
    paypalPassword: 'secret',
  });

  assert.equal(events.submittedPayloads.length, 1);
  assert.deepEqual(events.completed.map((item) => item.step), [8]);
  assert.equal(events.messages.includes('PAYPAL_CLICK_APPROVE'), true);
});

test('PayPal content routes email and approve page operations through the operation delay gate', async () => {
  const { paypalEvents, send, showApprovalPage } = createPayPalContentHarness();

  const loginResult = await send({
    type: 'PAYPAL_SUBMIT_LOGIN',
    source: 'test',
    payload: { email: 'user@example.com', password: 'secret' },
  });
  assert.equal(loginResult.ok, true);
  assert.equal(loginResult.phase, 'email_submitted');

  showApprovalPage();
  const approveResult = await send({ type: 'PAYPAL_CLICK_APPROVE', source: 'test', payload: {} });
  assert.equal(approveResult.ok, true);
  assert.equal(approveResult.clicked, true);

  assert.deepStrictEqual(paypalEvents, [
    'operation:paypal-email:start',
    'fill:paypal-email',
    'operation:paypal-email:end',
    'delay:paypal-email:2000',
    'operation:paypal-approve:start',
    'click:paypal-approve',
    'operation:paypal-approve:end',
    'delay:paypal-approve:2000',
  ]);
});

test('PayPal content routes password submit and prompt dismissal through the operation delay gate', async () => {
  const { paypalEvents, send, showPasswordPage, showPasskeyPrompt } = createPayPalContentHarness();

  showPasswordPage();
  const passwordResult = await send({
    type: 'PAYPAL_SUBMIT_LOGIN',
    source: 'test',
    payload: { email: 'user@example.com', password: 'secret' },
  });
  assert.equal(passwordResult.ok, true);
  assert.equal(passwordResult.phase, 'password_submitted');

  assert.deepStrictEqual(paypalEvents, [
    'operation:paypal-password:start',
    'fill:paypal-password',
    'click:paypal-password',
    'operation:paypal-password:end',
    'delay:paypal-password:2000',
  ]);

  paypalEvents.length = 0;
  showPasskeyPrompt();
  const promptResult = await send({ type: 'PAYPAL_DISMISS_PROMPTS', source: 'test', payload: {} });
  assert.equal(promptResult.ok, true);
  assert.equal(promptResult.clicked, 1);

  assert.deepStrictEqual(paypalEvents, [
    'operation:paypal-dismiss-prompt:start',
    'click:paypal-dismiss-prompt',
    'operation:paypal-dismiss-prompt:end',
    'delay:paypal-dismiss-prompt:2000',
  ]);
});

test('PayPal content keeps prefilled email values containing pass on the paypal-email path', async () => {
  const { paypalEvents, send, showCombinedLoginPageWithPrefilledEmail } = createPayPalContentHarness();

  showCombinedLoginPageWithPrefilledEmail('compass@example.com');
  const loginResult = await send({
    type: 'PAYPAL_SUBMIT_LOGIN',
    source: 'test',
    payload: { email: 'compass@example.com', password: 'secret' },
  });

  assert.equal(loginResult.ok, true);
  assert.equal(loginResult.phase, 'password_submitted');
  assert.deepStrictEqual(paypalEvents, [
    'operation:paypal-email:start',
    'fill:paypal-email',
    'operation:paypal-email:end',
    'delay:paypal-email:2000',
    'operation:paypal-password:start',
    'fill:paypal-password',
    'click:paypal-password',
    'operation:paypal-password:end',
    'delay:paypal-password:2000',
  ]);
});

test('PayPal approve prefers the selected paypal pool account over legacy fields', async () => {
  const { executor, events } = createExecutor({
    pageStates: [
      { needsLogin: true, hasEmailInput: true, hasPasswordInput: true, loginPhase: 'login_combined' },
      { needsLogin: false, approveReady: true },
      { needsLogin: false, approveReady: true },
    ],
    submitResults: [
      { submitted: true, phase: 'password_submitted', awaiting: 'redirect_or_approval' },
    ],
  });

  await executor.executePayPalApprove({
    paypalEmail: '',
    paypalPassword: '',
    currentPayPalAccountId: 'pp-1',
    paypalAccounts: [
      { id: 'pp-1', email: 'pool@example.com', password: 'pool-secret' },
    ],
  });

  assert.deepStrictEqual(events.submittedPayloads, [
    { email: 'pool@example.com', password: 'pool-secret' },
  ]);
});

test('PayPal approve discovers an already open unregistered PayPal tab', async () => {
  const { executor, events } = createExecutor({
    pageStates: [
      { needsLogin: false, approveReady: true },
    ],
    submitResults: [],
    getTabId: async () => null,
    isTabAlive: async () => false,
    queryTabs: [
      {
        id: 7,
        active: true,
        currentWindow: true,
        url: 'https://www.paypal.com/pay/?token=BA-demo',
      },
    ],
    tabUrls: [
      'https://www.paypal.com/pay/?token=BA-demo',
    ],
  });

  await executor.executePayPalApprove({
    paypalEmail: 'user@example.com',
    paypalPassword: 'secret',
  });

  assert.deepEqual(events.updatedTabs, [{ tabId: 7, updateInfo: { active: true } }]);
  assert.equal(events.logs.some(({ message }) => /发现 PayPal 页面/.test(message)), true);
  assert.deepEqual(events.completed.map((item) => item.step), [8]);
  assert.equal(events.messages.includes('PAYPAL_CLICK_APPROVE'), true);
});

test('PayPal approve auto-detects split email then password pages', async () => {
  const { executor, events } = createExecutor({
    pageStates: [
      { needsLogin: true, hasEmailInput: true, hasPasswordInput: false, loginPhase: 'email' },
      { needsLogin: true, hasEmailInput: false, hasPasswordInput: true, loginPhase: 'password' },
      { needsLogin: true, hasEmailInput: false, hasPasswordInput: true, loginPhase: 'password' },
      { needsLogin: false, approveReady: true },
      { needsLogin: false, approveReady: true },
    ],
    submitResults: [
      { submitted: false, phase: 'email_submitted', awaiting: 'password_page' },
      { submitted: true, phase: 'password_submitted', awaiting: 'redirect_or_approval' },
    ],
  });

  await executor.executePayPalApprove({
    paypalEmail: 'user@example.com',
    paypalPassword: 'secret',
  });

  assert.equal(events.submittedPayloads.length, 2);
  assert.deepEqual(events.completed.map((item) => item.step), [8]);
  assert.equal(events.logs.some(({ message }) => /识别到密码页/.test(message)), true);
  assert.equal(events.messages.includes('PAYPAL_CLICK_APPROVE'), true);
});

test('PayPal approve finishes when login redirects away from PayPal', async () => {
  const { executor, events } = createExecutor({
    pageStates: [
      { needsLogin: true, hasEmailInput: false, hasPasswordInput: true, loginPhase: 'password' },
    ],
    submitResults: [
      { submitted: true, phase: 'password_submitted', awaiting: 'redirect_or_approval' },
    ],
    tabUrls: [
      'https://www.paypal.com/signin',
      'https://www.paypal.com/signin',
      'https://checkout.openai.com/return',
    ],
  });

  await executor.executePayPalApprove({
    paypalEmail: 'user@example.com',
    paypalPassword: 'secret',
  });

  assert.equal(events.submittedPayloads.length, 1);
  assert.deepEqual(events.completed.map((item) => item.step), [8]);
  assert.equal(events.messages.includes('PAYPAL_CLICK_APPROVE'), false);
});
