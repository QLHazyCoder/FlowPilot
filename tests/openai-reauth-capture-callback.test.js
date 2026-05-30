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
  const sentMessages = [];
  return {
    navListeners,
    committedListeners,
    tabUpdatedListeners,
    removedTabs,
    sentMessages,
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
        sendMessage: async (tabId, message) => {
          sentMessages.push({ tabId, message });
          return null;
        },
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

test('进入手机验证页时抛出账号级 fatal，批量可跳过当前账号', async () => {
  const mod = loadStepModule();
  const chromeMock = buildMockChromeApi();
  const harness = buildBaseDeps({
    getTabId: async () => 99,
    isTabAlive: async () => true,
    ensureStep8SignupPageReady: async () => {},
    waitForStep8Ready: async () => {
      throw new Error('步骤 4：自动确认 OAuth 只处理 OAuth 授权页，当前仍在手机验证码页。 URL: https://auth.openai.com/phone-verification');
    },
    prepareStep8DebuggerClick: async () => {},
    clickWithDebugger: async () => {},
    triggerStep8ContentStrategy: async () => {},
    waitForStep8ClickEffect: async () => ({}),
    getStep8EffectLabel: () => '无跳转',
    reloadStep8ConsentPage: async () => {},
    sleepWithStop: async () => {},
    STEP8_STRATEGIES: [{ id: 'primary', label: '主按钮' }],
  });
  const { executeCaptureReauthCallback } = mod.createCaptureReauthCallbackExecutor({
    ...harness.deps,
    chrome: chromeMock.api,
  });

  const promise = executeCaptureReauthCallback({
    reauthState: 'S',
    reauthCodeVerifier: 'V',
    reauthInputAccount: { name: 'phone-check@example.com' },
  });

  await assert.rejects(
    promise,
    /ACCOUNT_FATAL::phone_verification_required::.*手机验证/
  );
  assert.equal(harness.completeCalls.length, 0);
  assert.equal(chromeMock.navListeners.length, 0, 'fatal 后应清理 onBeforeNavigate');
  assert.equal(chromeMock.committedListeners.length, 0, 'fatal 后应清理 onCommitted');
  assert.equal(chromeMock.tabUpdatedListeners.length, 0, 'fatal 后应清理 tabs.onUpdated');
});

test('步骤4启动后立即预检手机验证页，不等待 OAuth ready 超时', async () => {
  const mod = loadStepModule();
  const chromeMock = buildMockChromeApi();
  chromeMock.api.tabs.get = async () => ({
    id: 88,
    url: 'https://auth.openai.com/phone-verification',
    title: '验证您的手机号码',
  });
  let waitForReadyCalled = false;
  const harness = buildBaseDeps({
    getTabId: async () => 88,
    isTabAlive: async () => true,
    ensureStep8SignupPageReady: async () => {},
    waitForStep8Ready: async () => {
      waitForReadyCalled = true;
      return { consentReady: true };
    },
    prepareStep8DebuggerClick: async () => {},
    clickWithDebugger: async () => {},
    triggerStep8ContentStrategy: async () => {},
    waitForStep8ClickEffect: async () => ({}),
    getStep8EffectLabel: () => '无跳转',
    reloadStep8ConsentPage: async () => {},
    sleepWithStop: async () => {},
    STEP8_STRATEGIES: [{ id: 'primary', label: '主按钮' }],
  });
  const { executeCaptureReauthCallback } = mod.createCaptureReauthCallbackExecutor({
    ...harness.deps,
    chrome: chromeMock.api,
  });

  const promise = executeCaptureReauthCallback({
    reauthState: 'S',
    reauthCodeVerifier: 'V',
    reauthInputAccount: { name: 'phone-preflight@example.com' },
  });

  await assert.rejects(
    promise,
    /ACCOUNT_FATAL::phone_verification_required::.*手机验证/
  );
  assert.equal(waitForReadyCalled, false, '应在等待 OAuth ready 前直接跳过');
  assert.equal(harness.completeCalls.length, 0);
  assert.equal(chromeMock.navListeners.length, 0);
  assert.equal(chromeMock.committedListeners.length, 0);
  assert.equal(chromeMock.tabUpdatedListeners.length, 0);
});

test('createExecutor 在 deps 缺失时直接抛错（不允许半成品）', () => {
  const mod = loadStepModule();
  const chromeMock = buildMockChromeApi();
  const baseDeps = {
    ...buildBaseDeps().deps,
    chrome: chromeMock.api,
  };
  const cases = [
    {
      name: 'completeNodeFromBackground',
      expected: /completeNodeFromBackground/,
      mutate: (deps) => { delete deps.completeNodeFromBackground; },
    },
    {
      name: 'exchangeAuthorizationCode',
      expected: /exchangeAuthorizationCode/,
      mutate: (deps) => { delete deps.exchangeAuthorizationCode; },
    },
    {
      name: 'parseCallbackUrl',
      expected: /parseCallbackUrl/,
      mutate: (deps) => { delete deps.parseCallbackUrl; },
    },
    {
      name: 'buildUpdatedAccount',
      expected: /buildUpdatedAccount/,
      mutate: (deps) => { delete deps.buildUpdatedAccount; },
    },
    {
      name: 'setState',
      expected: /setState/,
      mutate: (deps) => { delete deps.setState; },
    },
    {
      name: 'chrome.webNavigation',
      expected: /webNavigation \/ chrome\.tabs/,
      mutate: (deps) => { deps.chrome = { tabs: chromeMock.api.tabs }; },
    },
    {
      name: 'chrome.tabs',
      expected: /webNavigation \/ chrome\.tabs/,
      mutate: (deps) => { deps.chrome = { webNavigation: chromeMock.api.webNavigation }; },
    },
  ];

  for (const entry of cases) {
    const deps = { ...baseDeps };
    entry.mutate(deps);
    assert.throws(
      () => mod.createCaptureReauthCallbackExecutor(deps),
      entry.expected,
      `missing ${entry.name} should throw`
    );
  }
});
