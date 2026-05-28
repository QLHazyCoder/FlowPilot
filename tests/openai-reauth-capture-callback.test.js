'use strict';

const assert = require('node:assert');
const test = require('node:test');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');

const STEP_PATH = path.join(__dirname, '..', 'flows', 'openai-reauth', 'background', 'steps', 'capture-reauth-callback.js');

function loadStepModule() {
  const source = fs.readFileSync(STEP_PATH, 'utf-8');
  const sandbox = { self: {}, globalThis: {}, console, setTimeout, clearTimeout };
  vm.createContext(sandbox);
  vm.runInContext(source, sandbox);
  return sandbox.self.MultiPageOpenAiReauthCaptureCallbackStep;
}

function buildMockChromeApi() {
  const navListeners = [];
  const committedListeners = [];
  const tabUpdatedListeners = [];
  const removedTabs = [];
  return {
    navListeners,
    committedListeners,
    tabUpdatedListeners,
    removedTabs,
    api: {
      webNavigation: {
        onBeforeNavigate: {
          addListener: (fn) => navListeners.push(fn),
          removeListener: (fn) => {
            const idx = navListeners.indexOf(fn);
            if (idx >= 0) navListeners.splice(idx, 1);
          },
        },
        onCommitted: {
          addListener: (fn) => committedListeners.push(fn),
          removeListener: (fn) => {
            const idx = committedListeners.indexOf(fn);
            if (idx >= 0) committedListeners.splice(idx, 1);
          },
        },
      },
      tabs: {
        onUpdated: {
          addListener: (fn) => tabUpdatedListeners.push(fn),
          removeListener: (fn) => {
            const idx = tabUpdatedListeners.indexOf(fn);
            if (idx >= 0) tabUpdatedListeners.splice(idx, 1);
          },
        },
        remove: async (tabId) => { removedTabs.push(tabId); },
      },
    },
  };
}

function buildBaseDeps(overrides = {}) {
  const completeCalls = [];
  const setStateCalls = [];
  const logCalls = [];
  return {
    completeCalls,
    setStateCalls,
    logCalls,
    deps: {
      addLog: async (message, level, options) => { logCalls.push({ message, level, options }); },
      completeNodeFromBackground: async (nodeId, payload) => { completeCalls.push({ nodeId, payload }); },
      exchangeAuthorizationCode: async ({ code, codeVerifier }) => ({
        accessToken: `access_for_${code}_${codeVerifier}`,
        refreshToken: 'refresh_x',
        idToken: 'id_x',
        expiresIn: 3600,
      }),
      parseCallbackUrl: (url, expected) => {
        if (!url.includes('localhost:1455/auth/callback')) return null;
        const parsed = new URL(url);
        const code = parsed.searchParams.get('code');
        const stateParam = parsed.searchParams.get('state');
        if (expected && stateParam !== expected) return { error: 'state mismatch' };
        return code ? { code, state: stateParam } : null;
      },
      buildUpdatedAccount: (original, tokens) => ({
        ...original,
        credentials: {
          ...(original.credentials || {}),
          access_token: tokens.accessToken,
          refresh_token: tokens.refreshToken,
        },
      }),
      setState: async (patch) => { setStateCalls.push(patch); },
      ...overrides,
    },
  };
}

test('收到合法 localhost 回调时换 token、更新 account 并 complete', async () => {
  const mod = loadStepModule();
  const chromeMock = buildMockChromeApi();
  const harness = buildBaseDeps();
  const { executeCaptureReauthCallback } = mod.createCaptureReauthCallbackExecutor({
    ...harness.deps,
    chrome: chromeMock.api,
  });

  const promise = executeCaptureReauthCallback({
    nodeId: 'capture-reauth-callback',
    reauthState: 'STATE_TOKEN',
    reauthCodeVerifier: 'VERIFIER_TOKEN',
    reauthInputAccount: { name: 'a@b.com', credentials: { email: 'a@b.com' } },
  });

  assert.equal(chromeMock.navListeners.length, 1);
  assert.equal(chromeMock.committedListeners.length, 1);
  assert.equal(chromeMock.tabUpdatedListeners.length, 1);

  chromeMock.navListeners[0]({
    url: 'http://localhost:1455/auth/callback?code=ABC&state=STATE_TOKEN',
    tabId: 99,
  });

  await promise;

  assert.equal(chromeMock.navListeners.length, 0, '应已清理监听器');
  assert.equal(chromeMock.removedTabs[0], 99, '应关闭回调 tab');
  assert.equal(harness.completeCalls.length, 1);
  assert.equal(harness.completeCalls[0].payload.reauthResultAccount.credentials.access_token,
    'access_for_ABC_VERIFIER_TOKEN');
  const lastSetState = harness.setStateCalls[harness.setStateCalls.length - 1];
  assert.ok(lastSetState.reauthResultAccount);
  assert.equal(lastSetState.reauthCodeVerifier, '');
  assert.equal(lastSetState.reauthState, '');
});

test('state 不匹配时拒绝并清理监听器', async () => {
  const mod = loadStepModule();
  const chromeMock = buildMockChromeApi();
  const harness = buildBaseDeps();
  const { executeCaptureReauthCallback } = mod.createCaptureReauthCallbackExecutor({
    ...harness.deps,
    chrome: chromeMock.api,
  });

  const promise = executeCaptureReauthCallback({
    reauthState: 'STATE_GOOD',
    reauthCodeVerifier: 'VERIFIER',
    reauthInputAccount: { name: 'x@y.com' },
  });

  chromeMock.navListeners[0]({
    url: 'http://localhost:1455/auth/callback?code=Z&state=BAD',
    tabId: 1,
  });

  await assert.rejects(promise, /state mismatch/);
  assert.equal(chromeMock.navListeners.length, 0);
});

test('缺少 reauthState 时立刻拒绝', async () => {
  const mod = loadStepModule();
  const chromeMock = buildMockChromeApi();
  const harness = buildBaseDeps();
  const { executeCaptureReauthCallback } = mod.createCaptureReauthCallbackExecutor({
    ...harness.deps,
    chrome: chromeMock.api,
  });

  await assert.rejects(
    executeCaptureReauthCallback({
      reauthCodeVerifier: 'V',
      reauthInputAccount: { name: 'a' },
    }),
    /OAuth state/
  );
});

test('缺少 codeVerifier 时立刻拒绝', async () => {
  const mod = loadStepModule();
  const chromeMock = buildMockChromeApi();
  const harness = buildBaseDeps();
  const { executeCaptureReauthCallback } = mod.createCaptureReauthCallbackExecutor({
    ...harness.deps,
    chrome: chromeMock.api,
  });

  await assert.rejects(
    executeCaptureReauthCallback({
      reauthState: 'S',
      reauthInputAccount: { name: 'a' },
    }),
    /code_verifier/
  );
});

test('缺少 reauthInputAccount 时立刻拒绝', async () => {
  const mod = loadStepModule();
  const chromeMock = buildMockChromeApi();
  const harness = buildBaseDeps();
  const { executeCaptureReauthCallback } = mod.createCaptureReauthCallbackExecutor({
    ...harness.deps,
    chrome: chromeMock.api,
  });

  await assert.rejects(
    executeCaptureReauthCallback({
      reauthState: 'S',
      reauthCodeVerifier: 'V',
    }),
    /账号 JSON/
  );
});

test('Token 交换失败时拒绝并写入 reauthLastError', async () => {
  const mod = loadStepModule();
  const chromeMock = buildMockChromeApi();
  const harness = buildBaseDeps({
    exchangeAuthorizationCode: async () => { throw new Error('upstream rejected'); },
  });
  const { executeCaptureReauthCallback } = mod.createCaptureReauthCallbackExecutor({
    ...harness.deps,
    chrome: chromeMock.api,
  });

  const promise = executeCaptureReauthCallback({
    reauthState: 'STATE',
    reauthCodeVerifier: 'V',
    reauthInputAccount: { name: 'a' },
  });

  chromeMock.navListeners[0]({
    url: 'http://localhost:1455/auth/callback?code=C&state=STATE',
    tabId: 7,
  });

  await assert.rejects(promise, /upstream rejected/);
  const errorPatch = harness.setStateCalls.find((p) => p.reauthLastError);
  assert.ok(errorPatch, '失败时应写入 reauthLastError');
  assert.match(errorPatch.reauthLastError, /upstream rejected/);
});

test('tabUpdated 路径同样能捕获回调', async () => {
  const mod = loadStepModule();
  const chromeMock = buildMockChromeApi();
  const harness = buildBaseDeps();
  const { executeCaptureReauthCallback } = mod.createCaptureReauthCallbackExecutor({
    ...harness.deps,
    chrome: chromeMock.api,
  });

  const promise = executeCaptureReauthCallback({
    reauthState: 'S',
    reauthCodeVerifier: 'V',
    reauthInputAccount: { name: 'x' },
  });

  chromeMock.tabUpdatedListeners[0](
    42,
    {},
    { url: 'http://localhost:1455/auth/callback?code=K&state=S' }
  );

  await promise;
  assert.equal(harness.completeCalls.length, 1);
  assert.equal(chromeMock.removedTabs[0], 42);
});

test('createExecutor 在 deps 缺失时直接抛错（不允许半成品）', () => {
  const mod = loadStepModule();
  const chromeMock = buildMockChromeApi();
  assert.throws(
    () => mod.createCaptureReauthCallbackExecutor({ chrome: chromeMock.api }),
    /completeNodeFromBackground/
  );
});
