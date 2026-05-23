const assert = require('node:assert/strict');
const fs = require('node:fs');
const test = require('node:test');

function loadRemoteAccountInjectStepModule() {
  const source = fs.readFileSync('flows/openai/background/steps/remote-account-inject.js', 'utf8');
  return new Function('self', `${source}; return self.MultiPageBackgroundRemoteAccountInject;`)({});
}

test('OpenAI remote account inject step skips cleanly when config is missing', async () => {
  const moduleApi = loadRemoteAccountInjectStepModule();
  const logs = [];
  const completed = [];
  let sentMessage = false;

  const executor = moduleApi.createRemoteAccountInjectExecutor({
    addLog: async (message, level = 'info', options = {}) => {
      logs.push({ message, level, step: options.step, stepKey: options.stepKey });
    },
    chrome: { tabs: { get: async () => null } },
    completeNodeFromBackground: async (nodeId, payload) => {
      completed.push({ nodeId, payload });
    },
    ensureContentScriptReadyOnTabUntilStopped: async () => {},
    getTabId: async () => null,
    isTabAlive: async () => false,
    registerTab: async () => {},
    sendTabMessageUntilStopped: async () => {
      sentMessage = true;
      return {};
    },
    sleepWithStop: async () => {},
    throwIfStopped: () => {},
    waitForTabCompleteUntilStopped: async () => {},
  });

  await executor.executeRemoteAccountInject({
    nodeId: 'remote-account-inject',
    visibleStep: 7,
    remoteAccountInjectUrl: '',
    remoteAccountInjectAdminKey: 'admin-secret',
  });

  assert.equal(sentMessage, false);
  assert.deepEqual(completed, [{
    nodeId: 'remote-account-inject',
    payload: {
      remoteAccountInjectSkipped: true,
      remoteAccountInjectReason: 'missing_url',
    },
  }]);
  assert.equal(logs.some((entry) => entry.stepKey === 'remote-account-inject' && /已跳过/.test(entry.message)), true);
});

test('OpenAI remote account inject step reads access token and posts GPT payload', async () => {
  const moduleApi = loadRemoteAccountInjectStepModule();
  const ensureCalls = [];
  const sentMessages = [];
  const injected = [];
  const completed = [];

  const executor = moduleApi.createRemoteAccountInjectExecutor({
    addLog: async () => {},
    chrome: {
      tabs: {
        get: async (tabId) => ({ id: tabId, url: 'https://chatgpt.com/?model=gpt-4o' }),
        update: async () => {},
      },
    },
    completeNodeFromBackground: async (nodeId, payload) => {
      completed.push({ nodeId, payload });
    },
    createRemoteAccountInjectApi: () => ({
      injectRemoteAccounts: async (options) => {
        injected.push(options);
        return { skipped: false };
      },
    }),
    ensureContentScriptReadyOnTabUntilStopped: async (source, tabId, options = {}) => {
      ensureCalls.push({ source, tabId, options });
    },
    getTabId: async () => null,
    isTabAlive: async () => false,
    registerTab: async () => {},
    sendTabMessageUntilStopped: async (tabId, source, message) => {
      sentMessages.push({ tabId, source, message });
      return { accessToken: 'openai-access-token' };
    },
    sleepWithStop: async () => {},
    throwIfStopped: () => {},
    waitForTabCompleteUntilStopped: async () => {},
  });

  await executor.executeRemoteAccountInject({
    nodeId: 'remote-account-inject',
    visibleStep: 7,
    plusCheckoutTabId: 91,
    remoteAccountInjectUrl: 'https://remote.example.com/panel',
    remoteAccountInjectAdminKey: 'admin-secret',
  });

  assert.equal(ensureCalls.length, 1);
  assert.deepEqual(sentMessages[0].message, {
    type: 'PLUS_CHECKOUT_GET_STATE',
    source: 'background',
    payload: {
      includeSession: true,
      includeAccessToken: true,
    },
  });
  assert.equal(injected.length, 1);
  assert.equal(injected[0].url, 'https://remote.example.com/panel');
  assert.equal(injected[0].adminKey, 'admin-secret');
  assert.deepEqual(injected[0].body, {
    tokens: ['openai-access-token'],
    strategy: 'merge',
    source_id: 'flowpilot-codex-at',
    source_name: 'FlowPilot Codex AT',
    provider: 'gpt',
  });
  assert.deepEqual(completed, [{
    nodeId: 'remote-account-inject',
    payload: {
      remoteAccountInjectSkipped: false,
      remoteAccountInjectSubmitted: 1,
    },
  }]);
});
