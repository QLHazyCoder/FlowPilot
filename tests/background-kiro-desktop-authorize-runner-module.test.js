const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');

function loadDesktopAuthorizeRunnerApi() {
  const stateSource = fs.readFileSync('flows/kiro/background/state.js', 'utf8');
  const clientSource = fs.readFileSync('flows/kiro/background/desktop-client.js', 'utf8');
  const runnerSource = fs.readFileSync('flows/kiro/background/desktop-authorize-runner.js', 'utf8');
  const globalScope = {};
  new Function('self', `${stateSource}; ${clientSource}; ${runnerSource}; return self;`)(globalScope);
  return globalScope.MultiPageBackgroundKiroDesktopAuthorizeRunner;
}

function getKiroRuntime(state = {}) {
  return state?.runtimeState?.flowState?.kiro || {};
}

function createDesktopAuthorizeState(overrides = {}) {
  return {
    runtimeState: {
      flowState: {
        kiro: {
          session: {
            desktopTabId: 91,
          },
          register: {
            email: 'kiro-user@example.com',
          },
          desktopAuth: {
            region: 'us-east-1',
            clientId: 'desktop-client-id',
            clientSecret: 'desktop-client-secret',
            state: 'desktop-state-001',
            codeVerifier: 'desktop-code-verifier',
            redirectUri: 'http://127.0.0.1:43121/oauth/callback',
            redirectPort: 43121,
            authorizeUrl: 'https://example.com/authorize',
          },
          upload: {},
        },
      },
    },
    ...overrides,
  };
}

test('kiro desktop authorize runner exposes a factory and callback parser', () => {
  const api = loadDesktopAuthorizeRunnerApi();
  assert.equal(typeof api?.createKiroDesktopAuthorizeRunner, 'function');
  assert.equal(typeof api?.parseDesktopCallbackUrl, 'function');
});

test('parseDesktopCallbackUrl validates state and redirect port', () => {
  const api = loadDesktopAuthorizeRunnerApi();

  const success = api.parseDesktopCallbackUrl(
    'http://127.0.0.1:43121/oauth/callback?code=auth-code-001&state=state-001',
    'state-001',
    43121
  );
  assert.deepEqual(success, {
    url: 'http://127.0.0.1:43121/oauth/callback?code=auth-code-001&state=state-001',
    code: 'auth-code-001',
    state: 'state-001',
  });

  const badState = api.parseDesktopCallbackUrl(
    'http://127.0.0.1:43121/oauth/callback?code=auth-code-001&state=wrong-state',
    'state-001',
    43121
  );
  assert.equal(Object.prototype.hasOwnProperty.call(badState, 'code'), false);
  assert.match(badState.error, /state/i);

  const badPort = api.parseDesktopCallbackUrl(
    'http://127.0.0.1:43122/oauth/callback?code=auth-code-001&state=state-001',
    'state-001',
    43121
  );
  assert.equal(badPort, null);
});

test('kiro desktop authorize runner uses a shared 3-minute page-load timeout budget', () => {
  const source = fs.readFileSync('flows/kiro/background/desktop-authorize-runner.js', 'utf8');
  assert.match(source, /DEFAULT_KIRO_PAGE_LOAD_TIMEOUT_MS/);
  assert.match(source, /createTimeoutBudget/);
  assert.match(source, /resolveTimeoutBudget/);
  assert.match(source, /timeoutBudget\.getRemainingMs\(1000\)/);
  assert.match(source, /onRetryableError: buildDesktopRetryRecovery\(tabId, \{\s*\.\.\.options,\s*timeoutBudget,/);
  assert.match(source, /awaitingCallbackAfterConsent/);
  assert.match(source, /finalizeDesktopAuthorizeCallback/);
});

test('kiro desktop authorize runner delegates OTP mail polling to the shared flow mail service', () => {
  const source = fs.readFileSync('flows/kiro/background/desktop-authorize-runner.js', 'utf8');
  assert.match(source, /pollFlowVerificationCode/);
  assert.doesNotMatch(source, /buildDesktopOtpPollPayload/);
  assert.doesNotMatch(source, /pollHotmailVerificationCode/);
  assert.doesNotMatch(source, /pollLuckmailVerificationCode/);
  assert.doesNotMatch(source, /pollCloudflareTempEmailVerificationCode/);
  assert.doesNotMatch(source, /pollCloudMailVerificationCode/);
  assert.doesNotMatch(source, /pollYydsMailVerificationCode/);
  assert.doesNotMatch(source, /sendToMailContentScriptResilient/);
});

test('background wires the Kiro register injector into desktop authorization runner', () => {
  const source = fs.readFileSync('background.js', 'utf8');
  const start = source.indexOf('const kiroDesktopAuthorizeRunner = self.MultiPageBackgroundKiroDesktopAuthorizeRunner?.createKiroDesktopAuthorizeRunner({');
  const end = source.indexOf('const kiroPublisher = self.MultiPageBackgroundKiroPublisherKiroRs?.createKiroRsPublisher({');
  assert.notEqual(start, -1);
  assert.notEqual(end, -1);
  const block = source.slice(start, end);
  assert.match(block, /KIRO_REGISTER_INJECT_FILES/);
  assert.match(block, /KIRO_DESKTOP_AUTHORIZE_INJECT_FILES/);
});

test('kiro desktop authorization opens account page when no web session tab is tracked', () => {
  const source = fs.readFileSync('flows/kiro/background/desktop-authorize-runner.js', 'utf8');
  assert.match(source, /KIRO_WEB_ACCOUNT_URL = 'https:\/\/app\.kiro\.dev\/settings\/account'/);
  assert.match(source, /chrome\.tabs\.create\(\{\s*url: KIRO_WEB_ACCOUNT_URL,\s*active: true,/);
  assert.match(source, /未能从已打开页面确认 Kiro Web 登录态，正在打开 Kiro 账号页重新确认/);
});

test('kiro desktop authorization is gated by completed Kiro Web sign-in', () => {
  const source = fs.readFileSync('flows/kiro/background/desktop-authorize-runner.js', 'utf8');
  assert.match(source, /restoreKiroWebSessionFromOpenTabs/);
  assert.match(source, /GET_KIRO_REGISTER_PAGE_STATE/);
  assert.match(source, /Kiro Web 登录态尚未建立/);
  assert.match(source, /已检测到 Kiro Web 登录态/);
});

test('executeKiroStartDesktopAuthorize restores existing Kiro Web session before desktop auth', async () => {
  const api = loadDesktopAuthorizeRunnerApi();
  let currentState = {
    runtimeState: {
      flowState: {
        kiro: {
          session: {},
          register: {},
          webAuth: {},
          desktopAuth: {},
          upload: {},
        },
      },
    },
  };
  const setStateCalls = [];
  const logs = [];
  let completedPayload = null;
  let openedAuthorizeUrl = '';
  let registerReadySource = '';
  let desktopRegisteredTabId = null;

  const runner = api.createKiroDesktopAuthorizeRunner({
    addLog: async (message, level) => {
      logs.push({ message, level });
    },
    chrome: {
      tabs: {
        get: async (tabId) => ({
          id: tabId,
          status: 'complete',
          url: tabId === 77
            ? 'https://app.kiro.dev/settings/account'
            : 'https://oidc.us-east-1.amazonaws.com/authorize',
        }),
        query: async (queryInfo) => {
          if (Array.isArray(queryInfo.url)) {
            return [{
              id: 77,
              status: 'complete',
              url: 'https://app.kiro.dev/settings/account',
            }];
          }
          return [];
        },
        update: async () => ({}),
      },
      webNavigation: {
        onBeforeNavigate: { addListener: () => {} },
        onCommitted: { addListener: () => {} },
      },
      webRequest: {
        onBeforeRequest: { addListener: () => {} },
      },
    },
    completeNodeFromBackground: async (_nodeId, payload) => {
      completedPayload = payload;
    },
    ensureContentScriptReadyOnTab: async (source, tabId, options = {}) => {
      assert.equal(tabId, 77);
      registerReadySource = source;
      assert.equal(options.injectSource, 'kiro-register-page');
    },
    fetchImpl: async () => ({
      ok: true,
      text: async () => JSON.stringify({
        clientId: 'restored-client-id',
        clientSecret: 'restored-client-secret',
      }),
    }),
    getState: async () => currentState,
    getTabId: async () => null,
    isTabAlive: async () => false,
    KIRO_REGISTER_INJECT_FILES: ['flows/kiro/content/register-page.js'],
    registerTab: async (source, tabId) => {
      if (source === 'kiro-desktop-authorize') {
        desktopRegisteredTabId = tabId;
      }
    },
    reuseOrCreateTab: async (_source, url) => {
      openedAuthorizeUrl = url;
      return 88;
    },
    sendToContentScriptResilient: async (source, message) => {
      assert.equal(source, 'kiro-register-page');
      assert.equal(message.type, 'GET_KIRO_REGISTER_PAGE_STATE');
      return {
        ok: true,
        state: 'kiro_web_signed_in',
        url: 'https://app.kiro.dev/settings/account',
        accountEmail: 'restored@duck.com',
      };
    },
    setState: async (patch) => {
      setStateCalls.push(patch);
      currentState = { ...currentState, ...patch };
    },
    sleepWithStop: async () => {},
    throwIfStopped: () => {},
    waitForTabStableComplete: async () => ({ status: 'complete' }),
  });

  await runner.executeKiroStartDesktopAuthorize(currentState);

  assert.equal(registerReadySource, 'kiro-register-page');
  assert.equal(desktopRegisteredTabId, 88);
  assert.match(openedAuthorizeUrl, /client_id=restored-client-id/);
  assert.equal(currentState.email, 'restored@duck.com');
  assert.equal(getKiroRuntime(currentState).register.email, 'restored@duck.com');
  assert.equal(getKiroRuntime(currentState).register.status, 'completed');
  assert.equal(getKiroRuntime(currentState).webAuth.status, 'signed_in');
  assert.equal(getKiroRuntime(completedPayload).desktopAuth?.clientId, 'restored-client-id');
  assert.equal(
    logs.some(({ message }) => message.includes('检测到已有 Kiro Web 登录态，已恢复账号 restored@duck.com')),
    true
  );
  assert.equal(setStateCalls.length >= 2, true);
});

test('executeKiroStartDesktopAuthorize opens Kiro account page to restore login state', async () => {
  const api = loadDesktopAuthorizeRunnerApi();
  let currentState = {
    runtimeState: {
      flowState: {
        kiro: {
          session: {},
          register: {},
          webAuth: {},
          desktopAuth: {},
          upload: {},
        },
      },
    },
  };
  const logs = [];
  const registeredTabs = [];
  let createdTabUrl = '';
  let completedPayload = null;

  const runner = api.createKiroDesktopAuthorizeRunner({
    addLog: async (message, level) => {
      logs.push({ message, level });
    },
    chrome: {
      tabs: {
        create: async (payload) => {
          createdTabUrl = payload.url;
          return {
            id: 91,
            status: 'loading',
            url: payload.url,
          };
        },
        get: async (tabId) => ({
          id: tabId,
          status: 'complete',
          url: tabId === 91
            ? 'https://app.kiro.dev/settings/account'
            : 'https://oidc.us-east-1.amazonaws.com/authorize',
        }),
        query: async () => [],
        update: async () => ({}),
      },
      webNavigation: {
        onBeforeNavigate: { addListener: () => {} },
        onCommitted: { addListener: () => {} },
      },
      webRequest: {
        onBeforeRequest: { addListener: () => {} },
      },
    },
    completeNodeFromBackground: async (_nodeId, payload) => {
      completedPayload = payload;
    },
    ensureContentScriptReadyOnTab: async (source, tabId, options = {}) => {
      assert.equal(source, 'kiro-register-page');
      assert.equal(tabId, 91);
      assert.deepEqual(options.inject, ['flows/kiro/content/register-page.js']);
      assert.equal(options.injectSource, 'kiro-register-page');
    },
    fetchImpl: async () => ({
      ok: true,
      text: async () => JSON.stringify({
        clientId: 'opened-client-id',
        clientSecret: 'opened-client-secret',
      }),
    }),
    getState: async () => currentState,
    getTabId: async () => null,
    isTabAlive: async () => false,
    KIRO_REGISTER_INJECT_FILES: ['flows/kiro/content/register-page.js'],
    registerTab: async (source, tabId) => {
      registeredTabs.push({ source, tabId });
    },
    reuseOrCreateTab: async (_source, url) => {
      assert.match(url, /oidc\.us-east-1\.amazonaws\.com\/authorize/);
      return 92;
    },
    sendToContentScriptResilient: async (source, message) => {
      assert.equal(source, 'kiro-register-page');
      assert.equal(message.type, 'GET_KIRO_REGISTER_PAGE_STATE');
      return {
        ok: true,
        state: 'kiro_web_signed_in',
        url: 'https://app.kiro.dev/settings/account',
        accountEmail: 'opened@duck.com',
      };
    },
    setState: async (patch) => {
      currentState = { ...currentState, ...patch };
    },
    sleepWithStop: async () => {},
    throwIfStopped: () => {},
    waitForTabStableComplete: async () => ({ status: 'complete' }),
  });

  await runner.executeKiroStartDesktopAuthorize(currentState);

  assert.equal(createdTabUrl, 'https://app.kiro.dev/settings/account');
  assert.equal(getKiroRuntime(currentState).register.email, 'opened@duck.com');
  assert.equal(getKiroRuntime(completedPayload).desktopAuth?.clientId, 'opened-client-id');
  assert.deepEqual(registeredTabs, [
    { source: 'kiro-register-page', tabId: 91 },
    { source: 'kiro-desktop-authorize', tabId: 92 },
  ]);
  assert.equal(
    logs.some(({ message }) => message.includes('正在打开 Kiro 账号页重新确认')),
    true
  );
});

test('executeKiroCompleteDesktopAuthorize finishes from callback page without waiting for tracker replay', async () => {
  const api = loadDesktopAuthorizeRunnerApi();
  let currentState = createDesktopAuthorizeState();
  let completedPayload = null;

  const runner = api.createKiroDesktopAuthorizeRunner({
    addLog: async () => {},
    chrome: {
      tabs: {
        get: async (tabId) => ({
          id: tabId,
          status: 'complete',
          url: 'http://127.0.0.1:43121/oauth/callback?code=auth-code-001&state=desktop-state-001',
        }),
        remove: async () => {},
        update: async () => ({}),
      },
      webNavigation: {
        onBeforeNavigate: { addListener: () => {} },
        onCommitted: { addListener: () => {} },
      },
      webRequest: {
        onBeforeRequest: { addListener: () => {} },
      },
    },
    completeNodeFromBackground: async (_nodeId, payload) => {
      completedPayload = payload;
    },
    ensureContentScriptReadyOnTab: async () => {},
    fetchImpl: async () => ({
      ok: true,
      text: async () => JSON.stringify({
        accessToken: 'access-token-001',
        refreshToken: 'refresh-token-001',
      }),
    }),
    getState: async () => currentState,
    getTabId: async () => 91,
    isTabAlive: async () => true,
    registerTab: async () => {},
    sendToContentScriptResilient: async (_source, message) => {
      if (message.type === 'GET_KIRO_DESKTOP_AUTHORIZE_STATE') {
        return {
          state: 'callback_page',
          url: 'http://127.0.0.1:43121/oauth/callback?code=auth-code-001&state=desktop-state-001',
        };
      }
      throw new Error(`Unexpected message: ${message.type}`);
    },
    setState: async (patch) => {
      currentState = { ...currentState, ...patch };
    },
    sleepWithStop: async () => {},
    throwIfStopped: () => {},
    waitForTabStableComplete: async () => ({ status: 'complete' }),
  });

  await runner.executeKiroCompleteDesktopAuthorize(currentState);

  assert.equal(getKiroRuntime(completedPayload).desktopAuth?.authorizationCode, 'auth-code-001');
  assert.equal(getKiroRuntime(completedPayload).desktopAuth?.refreshToken, 'refresh-token-001');
});

test('executeKiroCompleteDesktopAuthorize waits for callback after consent even if original tab disappears', async () => {
  const api = loadDesktopAuthorizeRunnerApi();
  let currentState = createDesktopAuthorizeState({
    runtimeState: {
      flowState: {
        kiro: {
          session: {
            desktopTabId: 91,
          },
          register: {
            email: 'kiro-user@example.com',
          },
          desktopAuth: {
            region: 'us-east-1',
            clientId: 'desktop-client-id',
            clientSecret: 'desktop-client-secret',
            state: 'desktop-state-002',
            codeVerifier: 'desktop-code-verifier',
            redirectUri: 'http://127.0.0.1:43121/oauth/callback',
            redirectPort: 43121,
            authorizeUrl: 'https://example.com/authorize',
          },
          upload: {},
        },
      },
    },
  });
  let completedPayload = null;
  let tabAlive = true;
  let navigationListener = null;

  const runner = api.createKiroDesktopAuthorizeRunner({
    addLog: async () => {},
    chrome: {
      tabs: {
        get: async (tabId) => {
          if (!tabAlive) {
            throw new Error(`No tab with id: ${tabId}`);
          }
          return {
            id: tabId,
            status: 'complete',
            url: 'https://example.com/consent',
          };
        },
        remove: async () => {},
        update: async (tabId) => {
          if (!tabAlive) {
            throw new Error(`No tab with id: ${tabId}`);
          }
          return { id: tabId };
        },
      },
      webNavigation: {
        onBeforeNavigate: { addListener: () => {} },
        onCommitted: {
          addListener: (listener) => {
            navigationListener = listener;
          },
        },
      },
      webRequest: {
        onBeforeRequest: { addListener: () => {} },
      },
    },
    completeNodeFromBackground: async (_nodeId, payload) => {
      completedPayload = payload;
    },
    ensureContentScriptReadyOnTab: async () => {},
    fetchImpl: async () => ({
      ok: true,
      text: async () => JSON.stringify({
        accessToken: 'access-token-002',
        refreshToken: 'refresh-token-002',
      }),
    }),
    getState: async () => currentState,
    getTabId: async () => 91,
    isTabAlive: async () => true,
    registerTab: async () => {},
    sendToContentScriptResilient: async (_source, message) => {
      if (message.type === 'GET_KIRO_DESKTOP_AUTHORIZE_STATE') {
        return {
          state: 'consent_page',
          url: 'https://example.com/consent',
        };
      }
      if (message.type === 'EXECUTE_KIRO_DESKTOP_AUTHORIZE_ACTION') {
        assert.equal(message.payload?.action, 'confirm-consent');
        tabAlive = false;
        setTimeout(() => {
          navigationListener?.({
            url: 'http://127.0.0.1:43121/oauth/callback?code=auth-code-002&state=desktop-state-002',
            tabId: 91,
          });
        }, 50);
        return {
          submitted: true,
          state: 'consent_submitted',
          url: 'https://example.com/consent',
        };
      }
      throw new Error(`Unexpected message: ${message.type}`);
    },
    setState: async (patch) => {
      currentState = { ...currentState, ...patch };
    },
    sleepWithStop: async () => {},
    throwIfStopped: () => {},
    waitForTabStableComplete: async () => ({ status: 'complete' }),
  });

  await runner.executeKiroCompleteDesktopAuthorize(currentState);

  assert.equal(getKiroRuntime(completedPayload).desktopAuth?.authorizationCode, 'auth-code-002');
  assert.equal(getKiroRuntime(completedPayload).desktopAuth?.refreshToken, 'refresh-token-002');
});
