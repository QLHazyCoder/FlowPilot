const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');

function loadGrokRunnerApi() {
  const source = fs.readFileSync('flows/grok/background/register-runner.js', 'utf8');
  const globalScope = {};
  return new Function('self', `${source}; return self.MultiPageBackgroundGrokRegisterRunner;`)(globalScope);
}

function getGrokRuntime(state = {}) {
  return state?.runtimeState?.flowState?.grok || {};
}

test('grok runner delegates verification polling to the shared flow mail service', () => {
  const source = fs.readFileSync('flows/grok/background/register-runner.js', 'utf8');
  assert.match(source, /pollFlowVerificationCode/);
  assert.doesNotMatch(source, /buildGrokVerificationPollPayload/);
  assert.doesNotMatch(source, /pollHotmailVerificationCode/);
  assert.doesNotMatch(source, /pollLuckmailVerificationCode/);
  assert.doesNotMatch(source, /pollCloudflareTempEmailVerificationCode/);
  assert.doesNotMatch(source, /pollCloudMailVerificationCode/);
  assert.doesNotMatch(source, /pollYydsMailVerificationCode/);
  assert.doesNotMatch(source, /sendToMailContentScriptResilient/);
});

test('grok content script does not patch global MouseEvent prototypes', () => {
  const source = fs.readFileSync('flows/grok/content/register-page.js', 'utf8');
  assert.doesNotMatch(source, /MouseEvent\.prototype/);
  assert.doesNotMatch(source, /Object\.defineProperty\(MouseEvent/);
  assert.match(source, /screenX:/);
  assert.match(source, /screenY:/);
});

test('grok verification runner polls by flow node and submits normalized code', async () => {
  const api = loadGrokRunnerApi();
  const calls = [];
  let completedPayload = null;
  let currentState = {
    activeFlowId: 'grok',
    mailProvider: '2925',
    grokRegisterTabId: 101,
    grokEmail: 'grok-user@example.com',
    grokVerificationRequestedAt: 1000000,
    runtimeState: {
      flowState: {
        grok: {
          session: {
            registerTabId: 101,
          },
          register: {
            email: 'grok-user@example.com',
            verificationRequestedAt: 1000000,
          },
        },
      },
    },
  };
  const runner = api.createGrokRegisterRunner({
    addLog: async () => {},
    chrome: {
      tabs: {
        get: async (tabId) => ({ id: tabId }),
        update: async () => {},
      },
    },
    completeNodeFromBackground: async (_nodeId, payload) => {
      completedPayload = payload;
    },
    ensureContentScriptReadyOnTab: async () => {},
    getState: async () => currentState,
    getTabId: async () => 101,
    isTabAlive: async () => true,
    pollFlowVerificationCode: async (options) => {
      calls.push({ type: 'poll', options });
      return { code: 'ABC-123', messageId: 'mail-001' };
    },
    registerTab: async () => {},
    sendToContentScriptResilient: async (sourceId, message) => {
      calls.push({ type: 'send', sourceId, message });
      if (message.nodeId === 'GET_PAGE_STATE') {
        return { submitted: true, state: 'verification_code_entry', url: 'https://accounts.x.ai/verify' };
      }
      return { submitted: true, state: 'profile_entry', url: 'https://accounts.x.ai/profile' };
    },
    setState: async (patch) => {
      currentState = { ...currentState, ...patch };
    },
    waitForTabStableComplete: async () => {},
  });

  await runner.executeGrokSubmitVerificationCode({ nodeId: 'grok-submit-verification-code', ...currentState });

  const pollCall = calls.find((entry) => entry.type === 'poll');
  assert.equal(pollCall.options.flowId, 'grok');
  assert.equal(pollCall.options.nodeId, 'grok-submit-verification-code');
  assert.equal(pollCall.options.step, 3);
  assert.equal(pollCall.options.logStep, 3);
  assert.equal(pollCall.options.filterAfterTimestamp, 400000);
  assert.equal(pollCall.options.state.activeFlowId, 'grok');
  assert.equal(pollCall.options.state.visibleStep, 3);

  const sendCall = calls.find((entry) => (
    entry.type === 'send' && entry.message.nodeId === 'grok-submit-verification-code'
  ));
  assert.equal(sendCall.sourceId, 'grok-register-page');
  assert.equal(sendCall.message.type, 'EXECUTE_NODE');
  assert.equal(sendCall.message.nodeId, 'grok-submit-verification-code');
  assert.deepEqual(sendCall.message.payload, { code: 'ABC123' });

  assert.equal(completedPayload.grokVerificationCode, 'ABC123');
  assert.equal(completedPayload.grokVerificationRawCode, 'ABC-123');
  assert.equal(completedPayload.grokVerificationMessageId, 'mail-001');
  assert.equal(getGrokRuntime(completedPayload).register.verificationCode, 'ABC123');
  assert.equal(getGrokRuntime(completedPayload).register.status, 'verified');
});

test('grok verification runner waits for verification page before polling mail', async () => {
  const api = loadGrokRunnerApi();
  let pollCalled = false;
  let currentState = {
    activeFlowId: 'grok',
    grokRegisterTabId: 102,
    grokEmail: 'grok-user@example.com',
    grokVerificationRequestedAt: 1000000,
    runtimeState: {
      flowState: {
        grok: {
          session: {
            registerTabId: 102,
          },
          register: {
            email: 'grok-user@example.com',
            verificationRequestedAt: 1000000,
          },
        },
      },
    },
  };
  const originalDateNow = Date.now;
  let fakeNow = 1000000;
  const runner = api.createGrokRegisterRunner({
    addLog: async () => {},
    chrome: {
      tabs: {
        get: async (tabId) => ({ id: tabId }),
        update: async () => {},
      },
    },
    completeNodeFromBackground: async () => {},
    ensureContentScriptReadyOnTab: async () => {},
    getState: async () => currentState,
    getTabId: async () => 102,
    isTabAlive: async () => true,
    pollFlowVerificationCode: async () => {
      pollCalled = true;
      return { code: 'ABC-123', messageId: 'mail-001' };
    },
    registerTab: async () => {},
    sendToContentScriptResilient: async (_sourceId, message) => {
      if (message.nodeId === 'GET_PAGE_STATE') {
        return { submitted: true, state: 'email_entry', url: 'https://accounts.x.ai/sign-up' };
      }
      return { submitted: true, state: 'profile_entry', url: 'https://accounts.x.ai/profile' };
    },
    setState: async (patch) => {
      currentState = { ...currentState, ...patch };
    },
    sleepWithStop: async (ms = 0) => {
      fakeNow += Number(ms) || 1000;
    },
    waitForTabStableComplete: async () => {},
  });

  Date.now = () => fakeNow;
  try {
    await assert.rejects(
      () => runner.executeGrokSubmitVerificationCode({ nodeId: 'grok-submit-verification-code', ...currentState }),
      /尚未进入验证码页面/
    );
  } finally {
    Date.now = originalDateNow;
  }
  assert.equal(pollCalled, false);
});

test('grok SSO extraction stores only the current cookie without logging the secret value', async () => {
  const api = loadGrokRunnerApi();
  const logs = [];
  let completedPayload = null;
  let markUsedPayload = null;
  let currentState = {
    activeFlowId: 'grok',
    grokRegisterTabId: 202,
    grokSsoCookies: ['old-cookie'],
    runtimeState: {
      flowState: {
        grok: {
          session: {
            registerTabId: 202,
          },
          sso: {
            cookies: ['old-cookie'],
          },
          upload: {
            status: 'uploaded',
            uploadedAt: 1000,
            message: 'old upload',
            targetUrl: 'https://old.example.com/api/remote-account/inject',
          },
        },
      },
    },
  };
  const runner = api.createGrokRegisterRunner({
    addLog: async (message, level) => {
      logs.push({ message, level });
    },
    chrome: {
      cookies: {
        get: async () => ({ value: 'new-cookie' }),
      },
      tabs: {
        get: async (tabId) => ({ id: tabId }),
        update: async () => {},
      },
    },
    completeNodeFromBackground: async (_nodeId, payload) => {
      completedPayload = payload;
    },
    ensureContentScriptReadyOnTab: async () => {},
    getState: async () => currentState,
    getTabId: async () => 202,
    isTabAlive: async () => true,
    markCurrentRegistrationAccountUsed: async (state) => {
      markUsedPayload = state;
    },
    registerTab: async () => {},
    sendToContentScriptResilient: async () => {
      throw new Error('content fallback should not be used when chrome.cookies finds sso');
    },
    setState: async (patch) => {
      currentState = { ...currentState, ...patch };
    },
    sleepWithStop: async () => {},
    waitForTabStableComplete: async () => {},
  });

  await runner.executeGrokExtractSsoCookie({ nodeId: 'grok-extract-sso-cookie', ...currentState });

  assert.equal(completedPayload.grokSsoCookie, 'new-cookie');
  assert.deepEqual(completedPayload.grokSsoCookies, ['new-cookie']);
  assert.equal(completedPayload.grokWebchat2ApiUploadStatus, '');
  assert.equal(getGrokRuntime(completedPayload).sso.currentCookie, 'new-cookie');
  assert.deepEqual(getGrokRuntime(completedPayload).sso.cookies, ['new-cookie']);
  assert.equal(getGrokRuntime(completedPayload).upload.status, '');
  assert.equal(getGrokRuntime(completedPayload).upload.targetUrl, '');
  assert.equal(markUsedPayload.grokSsoCookie, 'new-cookie');
  assert.equal(logs.some(({ message }) => message.includes('new-cookie')), false);
});

test('grok register runner requires background node completion dependency', () => {
  const api = loadGrokRunnerApi();
  assert.throws(
    () => api.createGrokRegisterRunner({}),
    /requires completeNodeFromBackground/
  );
});
