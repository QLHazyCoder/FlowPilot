const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');

function loadGrokRunnerApi(globalScope = {}) {
  const source = fs.readFileSync('flows/grok/background/register-runner.js', 'utf8');
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

  const sendCall = calls.find((entry) => entry.type === 'send');
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

test('grok SSO extraction accumulates unique cookies without logging the secret value', async () => {
  const api = loadGrokRunnerApi();
  const logs = [];
  let completedPayload = null;
  let markUsedPayload = null;
  let currentState = {
    activeFlowId: 'grok',
    grokRegisterTabId: 202,
    grokSsoCookies: ['existing-cookie', 'new-cookie'],
    runtimeState: {
      flowState: {
        grok: {
          session: {
            registerTabId: 202,
          },
          sso: {
            cookies: ['existing-cookie', 'new-cookie'],
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
  assert.deepEqual(completedPayload.grokSsoCookies, ['existing-cookie', 'new-cookie']);
  assert.equal(getGrokRuntime(completedPayload).sso.currentCookie, 'new-cookie');
  assert.deepEqual(getGrokRuntime(completedPayload).sso.cookies, ['existing-cookie', 'new-cookie']);
  assert.equal(markUsedPayload.grokSsoCookie, 'new-cookie');
  assert.equal(logs.some(({ message }) => message.includes('new-cookie')), false);
});

test('grok sso extraction failure marks retry as restart-current-attempt and resets node progress', async () => {
  const grokStateSource = fs.readFileSync('flows/grok/background/state.js', 'utf8');
  const globalScope = {};
  globalScope.MultiPageBackgroundGrokState = new Function('self', `${grokStateSource}; return self.MultiPageBackgroundGrokState;`)(globalScope);
  const api = loadGrokRunnerApi(globalScope);
  const logs = [];
  let completedPayload = null;
  let currentState = {
    activeFlowId: 'grok',
    flowId: 'grok',
    currentNodeId: 'grok-extract-sso-cookie',
    nodeStatuses: Object.fromEntries(globalScope.MultiPageBackgroundGrokState.GROK_REGISTER_NODE_IDS.map((nodeId) => [nodeId, 'completed'])),
    grokRegisterTabId: 303,
    grokEmail: 'grok-user@example.com',
    grokSsoCookies: ['old-cookie'],
    runtimeState: {
      flowState: {
        grok: {
          session: {
            registerTabId: 303,
            pageState: 'profile_submitted',
          },
          register: {
            email: 'grok-user@example.com',
            status: 'profile_submitted',
          },
          sso: {
            cookies: ['old-cookie'],
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
        get: async () => null,
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
    getTabId: async () => 303,
    isTabAlive: async () => true,
    registerTab: async () => {},
    sendToContentScriptResilient: async () => ({ state: 'profile_submitted', ssoCookie: '' }),
    setState: async (patch) => {
      currentState = {
        ...currentState,
        ...patch,
        nodeStatuses: patch.nodeStatuses ? { ...patch.nodeStatuses } : currentState.nodeStatuses,
        runtimeState: patch.runtimeState ? JSON.parse(JSON.stringify(patch.runtimeState)) : currentState.runtimeState,
      };
    },
    sleepWithStop: async () => {},
    waitForTabStableComplete: async () => {},
  });

  await assert.rejects(
    () => runner.executeGrokExtractSsoCookie({ nodeId: 'grok-extract-sso-cookie', ...currentState }),
    /GROK_RESTART_CURRENT_ATTEMPT::Grok 注册未产出 sso Cookie/
  );

  assert.equal(completedPayload, null);
  assert.equal(currentState.currentNodeId, '');
  assert.deepEqual(
    currentState.nodeStatuses,
    Object.fromEntries(globalScope.MultiPageBackgroundGrokState.GROK_REGISTER_NODE_IDS.map((nodeId) => [nodeId, 'pending']))
  );
  assert.equal(currentState.grokRegisterTabId, null);
  assert.equal(currentState.grokEmail, '');
  assert.equal(currentState.grokRegisterStatus, '');
  assert.equal(currentState.grokSsoCookie, '');
  assert.deepEqual(currentState.grokSsoCookies, ['old-cookie']);
  assert.ok(logs.some(({ message, level }) => level === 'warn' && /GROK_RESTART_CURRENT_ATTEMPT::/.test(message)));
});

test('grok remote SSO inject skips cleanly when config is missing', async () => {
  const api = loadGrokRunnerApi();
  const completed = [];
  const logs = [];
  let injectCalled = false;

  const runner = api.createGrokRegisterRunner({
    addLog: async (message, level = 'info', options = {}) => {
      logs.push({ message, level, nodeId: options.nodeId });
    },
    completeNodeFromBackground: async (nodeId, payload) => {
      completed.push({ nodeId, payload });
    },
    createRemoteAccountInjectApi: () => ({
      injectRemoteAccounts: async () => {
        injectCalled = true;
        return { skipped: false };
      },
    }),
    getState: async () => ({}),
    setState: async () => {},
  });

  await runner.executeGrokRemoteSsoInject({
    nodeId: 'grok-remote-sso-inject',
    grokSsoCookie: 'sso-cookie',
    grokRemoteAccountInjectUrl: '',
    grokRemoteAccountInjectAdminKey: 'admin-secret',
  });

  assert.equal(injectCalled, false);
  assert.deepEqual(completed, [{
    nodeId: 'grok-remote-sso-inject',
    payload: {
      grokRemoteSsoInjectSkipped: true,
      grokRemoteSsoInjectReason: 'missing_url',
    },
  }]);
  assert.equal(logs.some((entry) => /已跳过/.test(entry.message)), true);
});

test('grok remote SSO inject posts Grok account payload', async () => {
  const api = loadGrokRunnerApi();
  const completed = [];
  const injected = [];

  const runner = api.createGrokRegisterRunner({
    addLog: async () => {},
    completeNodeFromBackground: async (nodeId, payload) => {
      completed.push({ nodeId, payload });
    },
    createRemoteAccountInjectApi: () => ({
      injectRemoteAccounts: async (options) => {
        injected.push(options);
        return { skipped: false };
      },
    }),
    getState: async () => ({}),
    setState: async () => {},
  });

  await runner.executeGrokRemoteSsoInject({
    nodeId: 'grok-remote-sso-inject',
    grokSsoCookie: 'sso-cookie',
    grokRemoteAccountInjectUrl: 'https://remote.example.com/admin',
    grokRemoteAccountInjectAdminKey: 'admin-secret',
  });

  assert.equal(injected.length, 1);
  assert.equal(injected[0].url, 'https://remote.example.com/admin');
  assert.equal(injected[0].adminKey, 'admin-secret');
  assert.deepEqual(injected[0].body, {
    accounts: [{
      token: 'sso-cookie',
      provider: 'grok',
      type: 'basic',
    }],
    strategy: 'merge',
    source_id: 'flowpilot-grok-sso',
    source_name: 'FlowPilot Grok SSO',
    provider: 'grok',
  });
  assert.deepEqual(completed, [{
    nodeId: 'grok-remote-sso-inject',
    payload: {
      grokRemoteSsoInjectSkipped: false,
      grokRemoteSsoInjectSubmitted: 1,
    },
  }]);
});

test('grok register runner requires background node completion dependency', () => {
  const api = loadGrokRunnerApi();
  assert.throws(
    () => api.createGrokRegisterRunner({}),
    /requires completeNodeFromBackground/
  );
});
