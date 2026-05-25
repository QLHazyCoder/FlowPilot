const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');

const backgroundSource = fs.readFileSync('background.js', 'utf8');

function extractFunction(source, name) {
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

function createMockResponse(ok, status, payload) {
  return {
    ok,
    status,
    async json() {
      return payload;
    },
  };
}

test('background imports contribution oauth module and keeps contribution runtime out of persisted settings', () => {
  const persistedStart = backgroundSource.indexOf('const PERSISTED_SETTING_DEFAULTS = {');
  const persistedEnd = backgroundSource.indexOf('const PERSISTED_SETTING_KEYS = Object.keys(PERSISTED_SETTING_DEFAULTS);');
  const defaultStateStart = backgroundSource.indexOf('const DEFAULT_STATE = {');
  const defaultStateEnd = backgroundSource.indexOf('async function getState()');

  const persistedBlock = backgroundSource.slice(persistedStart, persistedEnd);
  const defaultStateBlock = backgroundSource.slice(defaultStateStart, defaultStateEnd);

  assert.match(backgroundSource, /background\/contribution-oauth\.js/);
  assert.doesNotMatch(persistedBlock, /contributionSessionId|contributionAuthUrl|contributionCallbackUrl|contributionStatus/);
  assert.match(defaultStateBlock, /accountContributionEnabled:\s*false|CONTRIBUTION_RUNTIME_DEFAULTS/);
});

test('contribution oauth module exposes a factory', () => {
  const source = fs.readFileSync('background/contribution-oauth.js', 'utf8');
  const globalScope = {};
  const api = new Function('self', 'fetch', `${source}; return self.MultiPageBackgroundContributionOAuth;`)(
    globalScope,
    async () => createMockResponse(true, 200, { ok: true })
  );

  assert.equal(typeof api?.createContributionOAuthManager, 'function');
  assert.equal(Array.isArray(api?.RUNTIME_KEYS), true);
});

test('buildAccountContributionState preserves active contribution runtime while keeping contribution on sub2api', () => {
  const bundle = extractFunction(backgroundSource, 'buildAccountContributionState');
  const helperBundle = [
    'normalizeAccountContributionFlowId',
    'normalizeAccountContributionAdapterId',
    'assertAccountContributionAdapterAvailable',
    'buildFlowContributionRuntimePatch',
    'normalizeOpenAiContributionSource',
    'resolveOpenAiContributionRoutingState',
  ].map((name) => extractFunction(backgroundSource, name)).join('\n');

const api = new Function(`
const DEFAULT_ACTIVE_FLOW_ID = 'openai';
const CONTRIBUTION_SOURCE_CPA = 'cpa';
const CONTRIBUTION_SOURCE_SUB2API = 'sub2api';
const CONTRIBUTION_SUB2API_DEFAULT_GROUP_NAME = 'codex号池';
const CONTRIBUTION_SUB2API_PLUS_GROUP_NAME = 'openai-plus';
const self = {
  MultiPageFlowRegistry: {
    normalizeFlowId(value = '', fallback = 'openai') {
      const normalized = String(value || '').trim().toLowerCase();
      return normalized || fallback || 'openai';
    },
  },
  MultiPageContributionRegistry: {
    normalizeAdapterId(value = '') {
      return String(value || '').trim().toLowerCase();
    },
    hasContributionAdapter(flowId, adapterId) {
      return flowId === 'openai' && adapterId === 'openai-oauth';
    },
    getDefaultContributionAdapterId(flowId) {
      return flowId === 'openai' ? 'openai-oauth' : '';
    },
  },
};
const DEFAULT_STATE = { targetId: 'cpa' };
const CONTRIBUTION_RUNTIME_DEFAULTS = {
  accountContributionEnabled: false,
  accountContributionExpected: false,
  contributionAdapterId: '',
  flowContributionRuntime: {},
  contributionSource: 'sub2api',
  contributionTargetGroupName: 'codex号池',
  contributionNickname: '',
  contributionQq: '',
  contributionSessionId: '',
  contributionAuthUrl: '',
  contributionAuthState: '',
  contributionCallbackUrl: '',
  contributionStatus: '',
  contributionStatusMessage: '',
  contributionLastPollAt: 0,
  contributionCallbackStatus: 'idle',
  contributionCallbackMessage: '',
  contributionAuthOpenedAt: 0,
  contributionAuthTabId: 0,
};
const CONTRIBUTION_RUNTIME_KEYS = Object.keys(CONTRIBUTION_RUNTIME_DEFAULTS);
function isPlusModeState(state = {}) { return Boolean(state?.plusModeEnabled); }
${helperBundle}
${bundle}
return { buildAccountContributionState };
`)();

  const enabledState = api.buildAccountContributionState(true, {
    targetId: 'sub2api',
    customPassword: 'Secret123!',
    accountRunHistoryTextEnabled: true,
  }, {
    contributionSessionId: 'session-001',
    contributionAuthUrl: 'https://auth.example.com',
    contributionStatus: 'waiting',
    contributionCallbackStatus: 'waiting',
  });
  assert.equal(enabledState.accountContributionEnabled, true);
  assert.equal(enabledState.accountContributionExpected, true);
  assert.equal(enabledState.contributionAdapterId, 'openai-oauth');
  assert.deepStrictEqual(enabledState.flowContributionRuntime, {
    openai: { enabled: true, adapterId: 'openai-oauth' },
  });
  assert.equal(enabledState.contributionSessionId, 'session-001');
  assert.equal(enabledState.targetId, 'sub2api');
  assert.equal(enabledState.customPassword, '');
  assert.equal(enabledState.accountRunHistoryTextEnabled, false);

  const disabledState = api.buildAccountContributionState(false, {
    targetId: 'sub2api',
    customPassword: 'Secret123!',
    accountRunHistoryTextEnabled: true,
  }, {
    contributionSessionId: 'session-001',
    contributionAuthUrl: 'https://auth.example.com',
    contributionStatus: 'waiting',
  });
  assert.equal(disabledState.accountContributionEnabled, false);
  assert.equal(disabledState.accountContributionExpected, false);
  assert.equal(disabledState.contributionAdapterId, '');
  assert.deepStrictEqual(disabledState.flowContributionRuntime, {});
  assert.equal(disabledState.contributionSessionId, '');
  assert.equal(disabledState.targetId, 'sub2api');
  assert.equal(disabledState.customPassword, 'Secret123!');

  const plusContributionState = api.buildAccountContributionState(true, {
    targetId: 'cpa',
    plusModeEnabled: true,
    customPassword: 'Secret123!',
    accountRunHistoryTextEnabled: true,
  }, {});
  assert.equal(plusContributionState.contributionTargetGroupName, 'openai-plus');
  assert.equal(plusContributionState.targetId, 'sub2api');
});

test('resetState preserves contribution runtime across reset', () => {
  assert.match(backgroundSource, /CONTRIBUTION_RUNTIME_KEYS/);
  assert.match(backgroundSource, /const accountContributionState = buildAccountContributionState/);
  assert.match(backgroundSource, /\.\.\.accountContributionState/);
});

test('storage migration upgrades legacy contribution mode into unified account contribution state', async () => {
  const helperBundle = [
    'normalizeAccountContributionFlowId',
    'normalizeAccountContributionAdapterId',
    'buildFlowContributionRuntimePatch',
  ].map((name) => extractFunction(backgroundSource, name)).join('\n');
  const migrationBundle = extractFunction(backgroundSource, 'migrateLegacyAccountContributionState');
  const api = new Function(`
const DEFAULT_ACTIVE_FLOW_ID = 'openai';
const self = {
  MultiPageFlowRegistry: {
    normalizeFlowId(value = '', fallback = 'openai') {
      const normalized = String(value || '').trim().toLowerCase();
      return normalized || fallback || 'openai';
    },
  },
  MultiPageContributionRegistry: {
    normalizeAdapterId(value = '') {
      return String(value || '').trim().toLowerCase();
    },
    hasContributionAdapter(flowId, adapterId) {
      return (flowId === 'openai' && adapterId === 'openai-oauth')
        || (flowId === 'kiro' && adapterId === 'kiro-builder-id');
    },
    getDefaultContributionAdapterId(flowId) {
      return flowId === 'kiro' ? 'kiro-builder-id' : 'openai-oauth';
    },
  },
};
const sessionStore = {
  contributionMode: true,
  contributionModeExpected: true,
  activeFlowId: 'kiro',
};
const removed = [];
const chrome = {
  storage: {
    session: {
      async get() { return { ...sessionStore }; },
      async set(updates) { Object.assign(sessionStore, updates); },
      async remove(keys) { removed.push(['session', ...keys]); keys.forEach((key) => { delete sessionStore[key]; }); },
    },
    local: {
      async remove(keys) { removed.push(['local', ...keys]); },
    },
  },
};
${helperBundle}
${migrationBundle}
return { migrateLegacyAccountContributionState, sessionStore, removed };
`)();

  await api.migrateLegacyAccountContributionState();

  assert.equal(api.sessionStore.accountContributionEnabled, true);
  assert.equal(api.sessionStore.accountContributionExpected, true);
  assert.equal(api.sessionStore.contributionAdapterId, 'kiro-builder-id');
  assert.deepStrictEqual(api.sessionStore.flowContributionRuntime, {
    kiro: { enabled: true, adapterId: 'kiro-builder-id' },
  });
  assert.equal(Object.prototype.hasOwnProperty.call(api.sessionStore, 'contributionMode'), false);
  assert.deepStrictEqual(api.removed, [
    ['session', 'contributionMode', 'contributionModeExpected'],
    ['local', 'contributionMode', 'contributionModeExpected'],
  ]);
});

test('message router handles contribution mode, start flow, and status polling messages', async () => {
  const source = fs.readFileSync('background/message-router.js', 'utf8');
  const globalScope = {};
  const api = new Function('self', `${source}; return self.MultiPageBackgroundMessageRouter;`)(globalScope);

  const calls = [];
  const router = api.createMessageRouter({
    ensureManualInteractionAllowed: async () => ({
      stepStatuses: { 1: 'pending', 2: 'completed' },
      accountContributionEnabled: true,
    }),
    pollContributionStatus: async (options) => {
      calls.push({ type: 'poll', options });
      return { contributionStatus: 'waiting' };
    },
    setAccountContributionMode: async (enabled) => {
      calls.push({ type: 'toggle', enabled });
      return {
        accountContributionEnabled: Boolean(enabled),
        targetId: 'cpa',
      };
    },
    startFlowContribution: async (options) => {
      calls.push({ type: 'start', options });
      return {
        accountContributionEnabled: true,
        contributionSessionId: 'session-001',
        contributionStatus: 'started',
      };
    },
  });

  const enableResponse = await router.handleMessage({
    type: 'SET_ACCOUNT_CONTRIBUTION_MODE',
    payload: { enabled: true },
  });
  const startResponse = await router.handleMessage({
    type: 'START_FLOW_CONTRIBUTION',
    payload: { nickname: '阿青', qq: '123456' },
  });
  const pollResponse = await router.handleMessage({
    type: 'POLL_FLOW_CONTRIBUTION_STATUS',
    payload: { reason: 'test_poll' },
  });

  assert.equal(enableResponse.ok, true);
  assert.equal(startResponse.ok, true);
  assert.equal(pollResponse.ok, true);
  assert.deepStrictEqual(calls, [
    { type: 'toggle', enabled: true },
    { type: 'start', options: { nickname: '阿青', qq: '123456' } },
    { type: 'poll', options: { reason: 'test_poll' } },
  ]);
});

test('message router re-syncs contribution mode before AUTO_RUN when sidepanel payload marks accountContributionEnabled=true', async () => {
  const source = fs.readFileSync('background/message-router.js', 'utf8');
  const globalScope = {};
  const api = new Function('self', `${source}; return self.MultiPageBackgroundMessageRouter;`)(globalScope);

  const calls = [];
  const router = api.createMessageRouter({
    clearStopRequest: () => {},
    getPendingAutoRunTimerPlan: () => null,
    getState: async () => ({
      accountContributionEnabled: false,
      stepStatuses: {},
    }),
    normalizeRunCount: (value) => Number(value) || 1,
    setAccountContributionMode: async (enabled) => {
      calls.push({ type: 'toggle', enabled });
      return { accountContributionEnabled: true };
    },
    setState: async (updates) => {
      calls.push({ type: 'setState', updates });
    },
    startAutoRunLoop: (totalRuns, options) => {
      calls.push({ type: 'startAutoRunLoop', totalRuns, options });
    },
  });

  const response = await router.handleMessage({
    type: 'AUTO_RUN',
      payload: {
        totalRuns: 2,
        autoRunSkipFailures: true,
        mode: 'restart',
        accountContributionEnabled: true,
        contributionNickname: '阿青',
        contributionQq: '123456',
      },
    });

  assert.equal(response.ok, true);
  assert.deepStrictEqual(calls, [
    { type: 'toggle', enabled: true },
    { type: 'setState', updates: { contributionNickname: '阿青', contributionQq: '123456' } },
    { type: 'setState', updates: { autoRunSkipFailures: true } },
    { type: 'startAutoRunLoop', totalRuns: 2, options: { autoRunSkipFailures: true, mode: 'restart' } },
  ]);
});

test('message router blocks AUTO_RUN when shared auto-run validation fails', async () => {
  const source = fs.readFileSync('background/message-router.js', 'utf8');
  const globalScope = {};
  const api = new Function('self', `${source}; return self.MultiPageBackgroundMessageRouter;`)(globalScope);

  const calls = [];
  const router = api.createMessageRouter({
    clearStopRequest: () => {},
    getPendingAutoRunTimerPlan: () => null,
    getState: async () => ({
      activeFlowId: 'site-a',
      targetId: 'cpa',
      signupMethod: 'phone',
      stepStatuses: {},
    }),
    normalizeRunCount: (value) => Number(value) || 1,
    setState: async (updates) => {
      calls.push({ type: 'setState', updates });
    },
    startAutoRunLoop: () => {
      calls.push({ type: 'startAutoRunLoop' });
    },
    validateAutoRunStart: () => ({
      ok: false,
      errors: [{ message: '当前 flow 不支持手机号注册。' }],
    }),
  });

  await assert.rejects(
    () => router.handleMessage({
      type: 'AUTO_RUN',
      payload: {
        totalRuns: 2,
        autoRunSkipFailures: true,
        mode: 'restart',
      },
    }),
    /当前 flow 不支持手机号注册。/
  );
  assert.deepStrictEqual(calls, []);
});

test('account run history snapshot sync is disabled in contribution mode', () => {
  const source = fs.readFileSync('background/account-run-history.js', 'utf8');
  const globalScope = {};
  const api = new Function('self', `${source}; return self.MultiPageBackgroundAccountRunHistory;`)(globalScope);

  const helpers = api.createAccountRunHistoryHelpers({
    addLog: async () => {},
    buildLocalHelperEndpoint: (baseUrl, path) => `${baseUrl}${path}`,
    chrome: {
      storage: {
        local: {
          get: async () => ({}),
          set: async () => {},
        },
      },
    },
    getErrorMessage: (error) => error?.message || String(error || ''),
    getState: async () => ({}),
    normalizeAccountRunHistoryHelperBaseUrl: (value) => String(value || '').trim(),
  });

  assert.equal(
    helpers.shouldSyncAccountRunHistorySnapshot({
      accountContributionEnabled: true,
      accountRunHistoryTextEnabled: true,
      accountRunHistoryHelperBaseUrl: 'http://127.0.0.1:17373',
    }),
    false
  );

  assert.equal(
    helpers.shouldSyncAccountRunHistorySnapshot({
      accountContributionEnabled: false,
      accountRunHistoryTextEnabled: true,
      accountRunHistoryHelperBaseUrl: 'http://127.0.0.1:17373',
    }),
    true
  );
});

test('contribution oauth manager starts session, opens auth url, submits callback, and continues polling final status', async () => {
  const source = fs.readFileSync('background/contribution-oauth.js', 'utf8');
  const globalScope = {};
  const fetchCalls = [];
  const tabCalls = [];
  const closeCallbackCalls = [];
  let statusPollCount = 0;
  let currentState = {
    accountContributionEnabled: true,
    contributionSource: 'sub2api',
    contributionTargetGroupName: 'codex号池',
    email: 'user@example.com',
    contributionSessionId: '',
    contributionStatus: '',
    contributionCallbackStatus: 'idle',
  };
  const broadcasts = [];

  const api = new Function('self', 'fetch', `${source}; return self.MultiPageBackgroundContributionOAuth;`)(
    globalScope,
    async (url, options = {}) => {
      fetchCalls.push({ url, options });
      if (String(url).endsWith('/start')) {
        return createMockResponse(true, 200, {
          ok: true,
          session_id: 'session-001',
          state: 'oauth-state-001',
          auth_url: 'https://auth.example.com/oauth?state=oauth-state-001',
          message: '登录地址已生成',
        });
      }
      if (String(url).includes('/status?')) {
        statusPollCount += 1;
        if (statusPollCount === 1) {
          return createMockResponse(true, 200, {
            ok: true,
            session_id: 'session-001',
            status: 'waiting',
            message: '等待提交回调。',
          });
        }
        return createMockResponse(true, 200, {
          ok: true,
          session_id: 'session-001',
          status: 'processing',
          message: '回调地址已提交给 CPA，正在等待结果确认。',
        });
      }
      if (String(url).endsWith('/submit-callback')) {
        return createMockResponse(true, 200, {
          ok: true,
          session_id: 'session-001',
          status: 'processing',
          message: '回调地址已提交给 CPA，正在等待结果确认。',
        });
      }
      return createMockResponse(true, 200, { ok: true });
    }
  );

  const manager = api.createContributionOAuthManager({
    addLog: async () => {},
    broadcastDataUpdate(updates) {
      broadcasts.push(updates);
      currentState = { ...currentState, ...updates };
    },
    chrome: {
      tabs: {
        async create(payload) {
          tabCalls.push(payload);
          return { id: 88, url: payload.url };
        },
        async update() {
          return null;
        },
        onUpdated: { addListener() {} },
      },
      webNavigation: {
        onCommitted: { addListener() {} },
        onHistoryStateUpdated: { addListener() {} },
      },
    },
    closeLocalhostCallbackTabs: async (callbackUrl) => {
      closeCallbackCalls.push(callbackUrl);
    },
    getState: async () => currentState,
    setState: async (updates) => {
      currentState = { ...currentState, ...updates };
    },
  });

  const startedState = await manager.startFlowContribution();
  assert.equal(startedState.contributionSessionId, 'session-001');
  assert.equal(startedState.contributionAuthState, 'oauth-state-001');
  assert.equal(startedState.contributionStatus, 'waiting');
  assert.equal(startedState.contributionAuthTabId, 88);
  assert.equal(tabCalls.length, 1);
  assert.match(fetchCalls[0].url, /\/start$/);
  assert.match(String(fetchCalls[0].options.body || ''), /"nickname":""/);
  assert.match(String(fetchCalls[0].options.body || ''), /"qq":""/);
  assert.match(String(fetchCalls[0].options.body || ''), /"email":"user@example\.com"/);
  assert.match(String(fetchCalls[0].options.body || ''), /"source":"sub2api"/);
  assert.match(String(fetchCalls[0].options.body || ''), /"target_group_name":"codex号池"/);
  assert.match(fetchCalls[1].url, /\/status\?/);

  const callbackState = await manager.handleCapturedCallback(
    'http://localhost:1455/auth/callback?code=abc123&state=oauth-state-001',
    { source: 'test' }
  );

  assert.equal(callbackState.contributionCallbackUrl, 'http://localhost:1455/auth/callback?code=abc123&state=oauth-state-001');
  assert.equal(callbackState.contributionCallbackStatus, 'submitted');
  assert.equal(callbackState.contributionStatus, 'processing');
  assert.equal(closeCallbackCalls[0], 'http://localhost:1455/auth/callback?code=abc123&state=oauth-state-001');
  assert.ok(fetchCalls.some((call) => String(call.url).endsWith('/submit-callback')));
  assert.ok(broadcasts.some((item) => item.contributionCallbackStatus === 'captured'));
  assert.ok(broadcasts.some((item) => item.contributionCallbackStatus === 'submitted'));
});

test('contribution oauth manager deduplicates concurrent callback captures for the same localhost url', async () => {
  const source = fs.readFileSync('background/contribution-oauth.js', 'utf8');
  const globalScope = {};
  const fetchCalls = [];
  const broadcasts = [];
  let submitCallCount = 0;
  let resolveSubmitRequest = null;
  let currentState = {
    accountContributionEnabled: true,
    contributionSource: 'sub2api',
    contributionTargetGroupName: 'codex号池',
    contributionSessionId: 'session-001',
    contributionAuthState: 'oauth-state-001',
    contributionStatus: 'waiting',
    contributionCallbackStatus: 'idle',
  };

  const api = new Function('self', 'fetch', `${source}; return self.MultiPageBackgroundContributionOAuth;`)(
    globalScope,
    async (url, options = {}) => {
      fetchCalls.push({ url, options });
      if (String(url).endsWith('/submit-callback')) {
        submitCallCount += 1;
        await new Promise((resolve) => {
          resolveSubmitRequest = resolve;
        });
        return createMockResponse(true, 200, {
          ok: true,
          session_id: 'session-001',
          status: 'processing',
          message: '回调地址已提交给 CPA，正在等待结果确认。',
        });
      }
      if (String(url).includes('/status?')) {
        return createMockResponse(true, 200, {
          ok: true,
          session_id: 'session-001',
          status: 'processing',
          message: '回调地址已提交给 CPA，正在等待结果确认。',
        });
      }
      return createMockResponse(true, 200, { ok: true });
    }
  );

  const manager = api.createContributionOAuthManager({
    addLog: async () => {},
    broadcastDataUpdate(updates) {
      broadcasts.push(updates);
      currentState = { ...currentState, ...updates };
    },
    chrome: {
      tabs: {
        onUpdated: { addListener() {} },
      },
      webNavigation: {
        onCommitted: { addListener() {} },
        onHistoryStateUpdated: { addListener() {} },
      },
    },
    getState: async () => currentState,
    setState: async (updates) => {
      currentState = { ...currentState, ...updates };
    },
  });

  const callbackUrl = 'http://localhost:1455/auth/callback?code=abc123&state=oauth-state-001';
  const firstTask = manager.handleCapturedCallback(callbackUrl, { source: 'tabs.onUpdated' });
  const secondTask = manager.handleCapturedCallback(callbackUrl, { source: 'webNavigation.onCommitted' });

  for (let round = 0; round < 10 && submitCallCount === 0; round += 1) {
    await new Promise((resolve) => setTimeout(resolve, 0));
  }

  assert.equal(submitCallCount, 1);
  assert.equal(
    broadcasts.filter((entry) => entry.contributionCallbackStatus === 'captured').length,
    1
  );

  assert.equal(typeof resolveSubmitRequest, 'function');
  resolveSubmitRequest();
  const [firstState, secondState] = await Promise.all([firstTask, secondTask]);

  assert.equal(firstState.contributionCallbackStatus, 'submitted');
  assert.equal(secondState.contributionCallbackStatus, 'submitted');
  assert.equal(fetchCalls.filter((call) => String(call.url).endsWith('/submit-callback')).length, 1);
});

test('contribution oauth manager ignores tabs.onUpdated events without a real url change', async () => {
  const source = fs.readFileSync('background/contribution-oauth.js', 'utf8');
  const globalScope = {};
  const fetchCalls = [];
  const addedListeners = {};
  let currentState = {
    accountContributionEnabled: true,
    contributionSource: 'sub2api',
    contributionTargetGroupName: 'codex号池',
    contributionSessionId: 'session-001',
    contributionAuthState: 'oauth-state-001',
    contributionStatus: 'waiting',
    contributionCallbackStatus: 'idle',
  };

  const api = new Function('self', 'fetch', `${source}; return self.MultiPageBackgroundContributionOAuth;`)(
    globalScope,
    async (url, options = {}) => {
      fetchCalls.push({ url, options });
      return createMockResponse(true, 200, { ok: true, status: 'processing' });
    }
  );

  const manager = api.createContributionOAuthManager({
    addLog: async () => {},
    broadcastDataUpdate(updates) {
      currentState = { ...currentState, ...updates };
    },
    chrome: {
      tabs: {
        onUpdated: {
          addListener(listener) {
            addedListeners.onTabUpdated = listener;
          },
        },
      },
      webNavigation: {
        onCommitted: { addListener() {} },
        onHistoryStateUpdated: { addListener() {} },
      },
    },
    getState: async () => currentState,
    setState: async (updates) => {
      currentState = { ...currentState, ...updates };
    },
  });

  manager.ensureCallbackListeners();
  assert.equal(typeof addedListeners.onTabUpdated, 'function');

  addedListeners.onTabUpdated(
    88,
    { status: 'complete' },
    { url: 'http://localhost:1455/auth/callback?code=abc123&state=oauth-state-001' }
  );

  await Promise.resolve();
  await Promise.resolve();

  assert.equal(fetchCalls.length, 0);
});

test('contribution oauth manager accepts localhost callback urls that contain error and state', async () => {
  const source = fs.readFileSync('background/contribution-oauth.js', 'utf8');
  const globalScope = {};
  const api = new Function('self', 'fetch', `${source}; return self.MultiPageBackgroundContributionOAuth;`)(
    globalScope,
    async () => createMockResponse(true, 200, { ok: true })
  );

  const manager = api.createContributionOAuthManager({
    chrome: {
      tabs: {
        onUpdated: { addListener() {} },
      },
      webNavigation: {
        onCommitted: { addListener() {} },
        onHistoryStateUpdated: { addListener() {} },
      },
    },
    getState: async () => ({}),
    setState: async () => ({}),
  });

  assert.equal(
    manager.isContributionCallbackUrl(
      'http://localhost:1455/auth/callback?error=access_denied&state=oauth-state-001',
      { contributionAuthState: 'oauth-state-001' }
    ),
    true
  );
});

test('contribution oauth manager switches Plus contribution traffic to sub2api openai-plus', async () => {
  const source = fs.readFileSync('background/contribution-oauth.js', 'utf8');
  const globalScope = {};
  const fetchCalls = [];
  let currentState = {
    accountContributionEnabled: true,
    plusModeEnabled: true,
    contributionSource: 'sub2api',
    contributionTargetGroupName: 'openai-plus',
    contributionSessionId: '',
    contributionStatus: '',
    contributionCallbackStatus: 'idle',
  };

  const api = new Function('self', 'fetch', `${source}; return self.MultiPageBackgroundContributionOAuth;`)(
    globalScope,
    async (url, options = {}) => {
      fetchCalls.push({ url, options });
      if (String(url).endsWith('/start')) {
        return createMockResponse(true, 200, {
          ok: true,
          session_id: 'session-plus-001',
          state: 'oauth-state-plus-001',
          source: 'sub2api',
          target_group_name: 'openai-plus',
          auth_url: 'https://auth.example.com/oauth?state=oauth-state-plus-001',
        });
      }
      if (String(url).includes('/status?')) {
        return createMockResponse(true, 200, {
          ok: true,
          session_id: 'session-plus-001',
          status: 'waiting',
          source: 'sub2api',
          target_group_name: 'openai-plus',
        });
      }
      return createMockResponse(true, 200, { ok: true });
    }
  );

  const manager = api.createContributionOAuthManager({
    chrome: {
      tabs: {
        async create(payload) {
          return { id: 91, url: payload.url };
        },
        async update() {
          return null;
        },
        onUpdated: { addListener() {} },
      },
      webNavigation: {
        onCommitted: { addListener() {} },
        onHistoryStateUpdated: { addListener() {} },
      },
    },
    getState: async () => currentState,
    setState: async (updates) => {
      currentState = { ...currentState, ...updates };
    },
    broadcastDataUpdate: (updates) => {
      currentState = { ...currentState, ...updates };
    },
  });

  await manager.startFlowContribution();

  assert.match(String(fetchCalls[0].options.body || ''), /"source":"sub2api"/);
  assert.match(String(fetchCalls[0].options.body || ''), /"target_group_name":"openai-plus"/);
});

test('refreshOAuthUrlBeforeStep6 uses contribution oauth session instead of panel bridge in contribution mode', async () => {
  const bundle = extractFunction(backgroundSource, 'refreshOAuthUrlBeforeStep6');
  const calls = [];

  const api = new Function(`
${bundle}
return { refreshOAuthUrlBeforeStep6 };
`)();

  globalThis.addLog = async (message, level, options) => {
    calls.push({ type: 'log', message, level, options });
  };
  globalThis.contributionOAuthManager = {
    async startFlowContribution(options) {
      calls.push({ type: 'contribution', options });
      return {
        contributionAuthUrl: 'https://auth.example.com/oauth?state=oauth-state-001',
      };
    },
  };
  globalThis.handleStepData = async (step, payload) => {
    calls.push({ type: 'step', step, payload });
  };
  globalThis.getPanelModeLabel = () => 'CPA';
  globalThis.requestOAuthUrlFromPanel = async () => {
    calls.push({ type: 'panel' });
    return { oauthUrl: 'https://panel.example.com/oauth' };
  };
  globalThis.LOG_PREFIX = '[test]';

  const oauthUrl = await api.refreshOAuthUrlBeforeStep6({
    accountContributionEnabled: true,
    email: 'user@example.com',
  });

  assert.equal(oauthUrl, 'https://auth.example.com/oauth?state=oauth-state-001');
  assert.deepStrictEqual(calls, [
    {
      type: 'log',
      message: '账号贡献已开启，走公开贡献接口，正在申请 OAuth 登录地址...',
      level: 'info',
      options: { step: 7, stepKey: 'oauth-login' },
    },
    {
      type: 'contribution',
      options: {
        nickname: '',
        openAuthTab: false,
        stateOverride: {
          accountContributionEnabled: true,
          email: 'user@example.com',
        },
      },
    },
    {
      type: 'step',
      step: 1,
      payload: {
        oauthUrl: 'https://auth.example.com/oauth?state=oauth-state-001',
      },
    },
  ]);

  delete globalThis.addLog;
  delete globalThis.contributionOAuthManager;
  delete globalThis.handleStepData;
  delete globalThis.getPanelModeLabel;
  delete globalThis.requestOAuthUrlFromPanel;
  delete globalThis.LOG_PREFIX;
});

test('refreshOAuthUrlBeforeStep6 logs the normal CPA/SUB2API/Codex2API path explicitly when accountContributionEnabled=false', async () => {
  const bundle = extractFunction(backgroundSource, 'refreshOAuthUrlBeforeStep6');
  const calls = [];

  const api = new Function(`
${bundle}
return { refreshOAuthUrlBeforeStep6 };
`)();

  globalThis.addLog = async (message, level, options) => {
    calls.push({ type: 'log', message, level, options });
  };
  globalThis.contributionOAuthManager = {
    async startFlowContribution() {
      calls.push({ type: 'contribution' });
      return {
        contributionAuthUrl: 'https://auth.example.com/oauth?state=unexpected',
      };
    },
  };
  globalThis.handleStepData = async (step, payload) => {
    calls.push({ type: 'step', step, payload });
  };
  globalThis.getPanelModeLabel = () => 'SUB2API';
  globalThis.requestOAuthUrlFromPanel = async () => {
    calls.push({ type: 'panel' });
    return { oauthUrl: 'https://panel.example.com/oauth' };
  };
  globalThis.LOG_PREFIX = '[test]';

  const oauthUrl = await api.refreshOAuthUrlBeforeStep6({
    accountContributionEnabled: false,
    targetId: 'sub2api',
    email: 'user@example.com',
  });

  assert.equal(oauthUrl, 'https://panel.example.com/oauth');
  assert.deepStrictEqual(calls, [
    {
      type: 'log',
      message: '账号贡献未开启，走普通 CPA / SUB2API / Codex2API 链路（当前面板：SUB2API），正在刷新 OAuth 登录地址...',
      level: 'info',
      options: { step: 7, stepKey: 'oauth-login' },
    },
    { type: 'panel' },
    {
      type: 'step',
      step: 1,
      payload: {
        oauthUrl: 'https://panel.example.com/oauth',
      },
    },
  ]);

  delete globalThis.addLog;
  delete globalThis.contributionOAuthManager;
  delete globalThis.handleStepData;
  delete globalThis.getPanelModeLabel;
  delete globalThis.requestOAuthUrlFromPanel;
  delete globalThis.LOG_PREFIX;
});

test('executeStep10 blocks silent fallback when accountContributionExpected=true but accountContributionEnabled=false', async () => {
  const bundle = extractFunction(backgroundSource, 'executeStep10');

  const api = new Function(`
${bundle}
return { executeStep10 };
`)();

  globalThis.executeContributionStep10 = async () => ({ ok: true });
  globalThis.step10Executor = {
    async executeStep10() {
      return { ok: true };
    },
  };

  await assert.rejects(
    () => api.executeStep10({
      accountContributionExpected: true,
      accountContributionEnabled: false,
    }),
    /步骤 10：当前自动流程预期使用账号贡献/
  );

  delete globalThis.executeContributionStep10;
  delete globalThis.step10Executor;
});
