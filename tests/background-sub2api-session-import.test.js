const assert = require('node:assert/strict');
const fs = require('node:fs');
const test = require('node:test');

function createJsonResponse(payload, status = 200) {
  return {
    ok: status >= 200 && status < 300,
    status,
    text: async () => JSON.stringify(payload),
  };
}

function loadSub2ApiApiModule() {
  const source = fs.readFileSync('background/sub2api-api.js', 'utf8');
  return new Function('self', `${source}; return self.MultiPageBackgroundSub2ApiApi;`)({});
}

function loadSub2ApiSessionImportModule() {
  const source = fs.readFileSync('flows/openai/background/steps/sub2api-session-import.js', 'utf8');
  return new Function('self', `${source}; return self.MultiPageBackgroundSub2ApiSessionImport;`)({});
}

function encodeBase64UrlJson(value) {
  return Buffer.from(JSON.stringify(value)).toString('base64')
    .replace(/\+/g, '-')
    .replace(/\//g, '_')
    .replace(/=+$/g, '');
}

function createJwtToken(payload = {}) {
  return [
    encodeBase64UrlJson({ alg: 'HS256', typ: 'JWT' }),
    encodeBase64UrlJson(payload),
    'signature',
  ].join('.');
}

test('sub2api api imports current ChatGPT session through codex-session endpoint', async () => {
  const apiModule = loadSub2ApiApiModule();
  const fetchCalls = [];
  const logs = [];
  const importExpiresAt = Math.floor(Date.parse('2026-05-20T12:34:56.000Z') / 1000);

  const api = apiModule.createSub2ApiApi({
    addLog: async (message, level = 'info', options = {}) => {
      logs.push({ message, level, step: options.step, stepKey: options.stepKey });
    },
    normalizeSub2ApiUrl: (value) => value,
    DEFAULT_SUB2API_GROUP_NAME: 'codex',
    fetchImpl: async (url, options = {}) => {
      const parsed = new URL(url);
      const body = options.body ? JSON.parse(options.body) : null;
      fetchCalls.push({ path: parsed.pathname, search: parsed.search, method: options.method || 'GET', body });

      if (parsed.pathname === '/api/v1/auth/login') {
        return createJsonResponse({
          code: 0,
          data: {
            access_token: 'admin-token',
          },
        });
      }
      if (parsed.pathname === '/api/v1/admin/groups/all') {
        return createJsonResponse({
          code: 0,
          data: [
            { id: 5, name: 'codex', platform: 'openai' },
          ],
        });
      }
      if (parsed.pathname === '/api/v1/admin/proxies/all') {
        return createJsonResponse({
          code: 0,
          data: [{
            id: 7,
            name: 'shadowrocket',
            protocol: 'socks5',
            host: '127.0.0.1',
            port: 1080,
            status: 'active',
          }],
        });
      }
      if (parsed.pathname === '/api/v1/admin/accounts/import/codex-session') {
        const parsedContent = JSON.parse(body.content);
        assert.equal(parsedContent.accessToken, 'access-token-from-state');
        assert.equal(parsedContent.user?.email, 'flow@example.com');
        assert.equal(body.name, 'flow@example.com');
        assert.equal(body.priority, 3);
        assert.equal(body.proxy_id, 7);
        assert.deepStrictEqual(body.group_ids, [5]);
        assert.equal(body.auto_pause_on_expired, true);
        assert.equal(body.update_existing, true);
        assert.equal(body.expires_at, importExpiresAt);
        return createJsonResponse({
          code: 0,
          data: {
            total: 1,
            created: 0,
            updated: 1,
            skipped: 0,
            failed: 0,
            warnings: [{
              index: 1,
              message: '未包含 refresh_token，accessToken 过期后无法自动续期',
            }],
          },
        });
      }

      return createJsonResponse({ code: 1, message: `unexpected path ${parsed.pathname}` }, 404);
    },
  });

  const result = await api.importCurrentChatGptSession({
    sub2apiUrl: 'https://sub.example/admin/accounts',
    sub2apiEmail: 'admin@example.com',
    sub2apiPassword: 'secret',
    sub2apiGroupName: 'codex',
    sub2apiDefaultProxyName: 'shadowrocket',
    sub2apiAccountPriority: 3,
    session: {
      accessToken: 'access-token-from-session',
      expires: '2026-05-20T12:34:56.000Z',
      user: {
        email: 'flow@example.com',
        name: 'dyson willion',
      },
    },
    accessToken: 'access-token-from-state',
    email: 'registration@example.com',
  }, {
    logLabel: '步骤 10',
    logOptions: { step: 10, stepKey: 'sub2api-session-import' },
    timeoutMs: 120000,
  });

  const importCall = fetchCalls.find((call) => call.path === '/api/v1/admin/accounts/import/codex-session');
  assert.ok(importCall, 'expected codex-session import call');
  assert.equal(result.verifiedStatus, 'SUB2API 会话导入完成：新建 0，更新 1，跳过 0，失败 0');
  assert.equal(result.sub2apiImportUpdated, 1);
  assert.equal(
    logs.some((entry) => entry.level === 'warn' && /refresh_token/.test(entry.message)),
    true
  );
});

test('sub2api session import falls back to JWT email before registration email', async () => {
  const apiModule = loadSub2ApiApiModule();
  const jwtToken = createJwtToken({ email: 'jwt@example.com' });
  let importBody = null;

  const api = apiModule.createSub2ApiApi({
    addLog: async () => {},
    normalizeSub2ApiUrl: (value) => value,
    DEFAULT_SUB2API_GROUP_NAME: 'codex',
    fetchImpl: async (url, options = {}) => {
      const parsed = new URL(url);
      const body = options.body ? JSON.parse(options.body) : null;

      if (parsed.pathname === '/api/v1/auth/login') {
        return createJsonResponse({ code: 0, data: { access_token: 'admin-token' } });
      }
      if (parsed.pathname === '/api/v1/admin/groups/all') {
        return createJsonResponse({
          code: 0,
          data: [{ id: 5, name: 'codex', platform: 'openai' }],
        });
      }
      if (parsed.pathname === '/api/v1/admin/accounts/import/codex-session') {
        importBody = body;
        return createJsonResponse({
          code: 0,
          data: { total: 1, created: 1, updated: 0, skipped: 0, failed: 0 },
        });
      }

      return createJsonResponse({ code: 1, message: `unexpected path ${parsed.pathname}` }, 404);
    },
  });

  await api.importCurrentChatGptSession({
    sub2apiUrl: 'https://sub.example/admin/accounts',
    sub2apiEmail: 'admin@example.com',
    sub2apiPassword: 'secret',
    sub2apiGroupName: 'codex',
    session: {
      accessToken: jwtToken,
      user: {
        name: 'dyson willion',
      },
    },
    accessToken: jwtToken,
    email: 'registration@example.com',
    accountIdentifierType: 'email',
    accountIdentifier: 'identifier@example.com',
  });

  assert.ok(importBody, 'expected codex-session import call');
  assert.equal(importBody.name, 'jwt@example.com');
});

test('sub2api session import falls back to registration email when session has no readable email', async () => {
  const apiModule = loadSub2ApiApiModule();
  let importBody = null;

  const api = apiModule.createSub2ApiApi({
    addLog: async () => {},
    normalizeSub2ApiUrl: (value) => value,
    DEFAULT_SUB2API_GROUP_NAME: 'codex',
    fetchImpl: async (url, options = {}) => {
      const parsed = new URL(url);
      const body = options.body ? JSON.parse(options.body) : null;

      if (parsed.pathname === '/api/v1/auth/login') {
        return createJsonResponse({ code: 0, data: { access_token: 'admin-token' } });
      }
      if (parsed.pathname === '/api/v1/admin/groups/all') {
        return createJsonResponse({
          code: 0,
          data: [{ id: 5, name: 'codex', platform: 'openai' }],
        });
      }
      if (parsed.pathname === '/api/v1/admin/accounts/import/codex-session') {
        importBody = body;
        return createJsonResponse({
          code: 0,
          data: { total: 1, created: 1, updated: 0, skipped: 0, failed: 0 },
        });
      }

      return createJsonResponse({ code: 1, message: `unexpected path ${parsed.pathname}` }, 404);
    },
  });

  await api.importCurrentChatGptSession({
    sub2apiUrl: 'https://sub.example/admin/accounts',
    sub2apiEmail: 'admin@example.com',
    sub2apiPassword: 'secret',
    sub2apiGroupName: 'codex',
    session: {
      accessToken: 'opaque-token',
      user: {
        name: 'dyson willion',
      },
    },
    accessToken: 'opaque-token',
    email: 'registration@example.com',
    accountIdentifierType: 'email',
    accountIdentifier: 'identifier@example.com',
  });

  assert.ok(importBody, 'expected codex-session import call');
  assert.equal(importBody.name, 'registration@example.com');
});

test('sub2api agent identity import registers an agent and never submits the access token as import content', async () => {
  const apiModule = loadSub2ApiApiModule();
  const token = createJwtToken({
    sub: 'user-123',
    email: 'owner@example.com',
    'https://api.openai.com/auth': {
      chatgpt_account_id: 'account-123',
      chatgpt_user_id: 'user-123',
      chatgpt_plan_type: 'plus',
    },
    'https://api.openai.com/profile': { email: 'owner@example.com' },
  });
  let importBody = null;
  const api = apiModule.createSub2ApiApi({
    addLog: async () => {},
    normalizeSub2ApiUrl: (value) => value,
    DEFAULT_SUB2API_GROUP_NAME: 'codex',
    cryptoImpl: {
      subtle: {
        async generateKey() { return { privateKey: {}, publicKey: {} }; },
        async exportKey(format) {
          return format === 'pkcs8'
            ? Uint8Array.from([1, 2, 3]).buffer
            : Uint8Array.from(new Array(32).fill(7)).buffer;
        },
      },
    },
    fetchImpl: async (url, options = {}) => {
      const parsed = new URL(url);
      const body = options.body ? JSON.parse(options.body) : null;
      if (parsed.origin === 'https://auth.openai.com') {
        assert.equal(parsed.pathname, '/api/accounts/v1/agent/register');
        assert.equal(options.headers.Authorization, `Bearer ${token}`);
        assert.match(body.agent_public_key, /^ssh-ed25519 /);
        return createJsonResponse({ agent_runtime_id: 'agent-123' });
      }
      if (parsed.pathname === '/api/v1/auth/login') {
        return createJsonResponse({ code: 0, data: { access_token: 'admin-token' } });
      }
      if (parsed.pathname === '/api/v1/admin/groups/all') {
        return createJsonResponse({ code: 0, data: [{ id: 5, name: 'codex', platform: 'openai' }] });
      }
      if (parsed.pathname === '/api/v1/admin/proxies/all') {
        return createJsonResponse({ code: 0, data: [{ id: 7, name: '新加坡', status: 'active' }] });
      }
      if (parsed.pathname === '/api/v1/admin/accounts/import/codex-session') {
        importBody = body;
        return createJsonResponse({ code: 0, data: { total: 1, created: 1, updated: 0, skipped: 0, failed: 0 } });
      }
      return createJsonResponse({ code: 1, message: `unexpected path ${parsed.pathname}` }, 404);
    },
  });

  const result = await api.importCurrentChatGptSessionAsAgentIdentity({
    sub2apiUrl: 'https://sub.example/admin/accounts',
    sub2apiEmail: 'admin@example.com',
    sub2apiPassword: 'secret',
    sub2apiGroupName: 'codex',
    sub2apiDefaultProxyName: '新加坡',
    sub2apiAccountPriority: 2,
    accessToken: token,
  });

  const authJson = JSON.parse(importBody.content);
  assert.equal(authJson.auth_mode, 'agent_identity');
  assert.equal(authJson.agent_identity.agent_runtime_id, 'agent-123');
  assert.equal(authJson.agent_identity.email, 'owner@example.com');
  assert.equal(importBody.name, 'owner@example.com');
  assert.equal(importBody.proxy_id, 7);
  assert.deepEqual(importBody.group_ids, [5]);
  assert.equal(importBody.priority, 2);
  assert.equal(importBody.content.includes(token), false);
  assert.match(result.verifiedStatus, /Agent Identity/);
});

test('session import step reads current ChatGPT session and completes node', async () => {
  const moduleApi = loadSub2ApiSessionImportModule();
  const completed = [];
  const logs = [];
  const ensureCalls = [];
  const sentMessages = [];
  const importedPayloads = [];

  const executor = moduleApi.createSub2ApiSessionImportExecutor({
    addLog: async (message, level = 'info', options = {}) => {
      logs.push({ message, level, step: options.step, stepKey: options.stepKey });
    },
    chrome: {
      tabs: {
        get: async (tabId) => ({
          id: tabId,
          url: 'https://chatgpt.com/?model=gpt-4o',
        }),
        update: async () => {},
      },
    },
    completeNodeFromBackground: async (nodeId, payload) => {
      completed.push({ nodeId, payload });
    },
    createSub2ApiApi: () => ({
      importCurrentChatGptSession: async (state, options) => {
        importedPayloads.push({ state, options });
        return {
          verifiedStatus: 'SUB2API 会话导入完成：新建 1，更新 0，跳过 0，失败 0',
          sub2apiImportCreated: 1,
          sub2apiImportUpdated: 0,
          sub2apiImportSkipped: 0,
          sub2apiImportFailed: 0,
        };
      },
    }),
    ensureContentScriptReadyOnTabUntilStopped: async (source, tabId, options = {}) => {
      ensureCalls.push({ source, tabId, options });
    },
    getTabId: async () => null,
    isTabAlive: async () => false,
    normalizeSub2ApiUrl: (value) => value,
    registerTab: async () => {},
    sendTabMessageUntilStopped: async (tabId, source, message) => {
      sentMessages.push({ tabId, source, message });
      return {
        session: {
          accessToken: 'session-access-token',
          expires: '2026-05-20T12:34:56.000Z',
          user: {
            email: 'flow@example.com',
          },
        },
        accessToken: 'session-access-token',
      };
    },
    sleepWithStop: async () => {},
    throwIfStopped: () => {},
    waitForTabCompleteUntilStopped: async () => {},
    DEFAULT_SUB2API_GROUP_NAME: 'codex',
  });

  await executor.executeSub2ApiSessionImport({
    nodeId: 'sub2api-session-import',
    visibleStep: 10,
    plusCheckoutTabId: 91,
    sub2apiUrl: 'https://sub.example/admin/accounts',
    sub2apiEmail: 'admin@example.com',
    sub2apiPassword: 'secret',
    sub2apiGroupName: 'codex',
  });

  assert.equal(ensureCalls.length, 1);
  assert.equal(ensureCalls[0].source, 'plus-checkout');
  assert.deepStrictEqual(ensureCalls[0].options.inject, [
    'content/utils.js',
    'content/operation-delay.js',
    'flows/openai/content/plus-checkout.js',
  ]);
  assert.deepStrictEqual(sentMessages, [{
    tabId: 91,
    source: 'plus-checkout',
    message: {
      type: 'PLUS_CHECKOUT_GET_STATE',
      source: 'background',
      payload: {
        includeSession: true,
        includeAccessToken: true,
      },
    },
  }]);
  assert.equal(importedPayloads.length, 1);
  assert.equal(importedPayloads[0].state.accessToken, 'session-access-token');
  assert.equal(importedPayloads[0].state.session.user.email, 'flow@example.com');
  assert.equal(completed.length, 1);
  assert.deepStrictEqual(completed[0], {
    nodeId: 'sub2api-session-import',
    payload: {
      verifiedStatus: 'SUB2API 会话导入完成：新建 1，更新 0，跳过 0，失败 0',
      sub2apiImportCreated: 1,
      sub2apiImportUpdated: 0,
      sub2apiImportSkipped: 0,
      sub2apiImportFailed: 0,
    },
  });
  assert.equal(
    logs.some((entry) => entry.stepKey === 'sub2api-session-import' && /读取当前 ChatGPT 登录会话/.test(entry.message)),
    true
  );
});

test('session import retries session token reads after a short initial delay', async () => {
  const moduleApi = loadSub2ApiSessionImportModule();
  const sleeps = [];
  const sentMessages = [];
  const logs = [];
  const importedPayloads = [];

  const executor = moduleApi.createSub2ApiSessionImportExecutor({
    addLog: async (message, level = 'info', options = {}) => {
      logs.push({ message, level, step: options.step, stepKey: options.stepKey });
    },
    chrome: {
      tabs: {
        get: async (tabId) => ({
          id: tabId,
          url: 'https://chatgpt.com/',
        }),
        update: async () => {},
      },
    },
    completeNodeFromBackground: async () => {},
    createSub2ApiApi: () => ({
      importCurrentChatGptSession: async (state) => {
        importedPayloads.push(state);
        return { verifiedStatus: 'ok' };
      },
    }),
    ensureContentScriptReadyOnTabUntilStopped: async () => {},
    getTabId: async () => null,
    isTabAlive: async () => false,
    normalizeSub2ApiUrl: (value) => value,
    registerTab: async () => {},
    sendTabMessageUntilStopped: async (tabId, source, message) => {
      sentMessages.push({ tabId, source, message });
      if (sentMessages.length === 1) {
        return {};
      }
      return {
        session: {
          accessToken: 'retry-access-token',
          user: { email: 'retry@example.com' },
        },
        accessToken: 'retry-access-token',
      };
    },
    sessionReadMaxAttempts: 2,
    sleepWithStop: async (ms) => {
      sleeps.push(ms);
    },
    throwIfStopped: () => {},
    waitForTabCompleteUntilStopped: async () => {},
  });

  await executor.executeSub2ApiSessionImport({
    nodeId: 'sub2api-session-import',
    visibleStep: 10,
    plusCheckoutTabId: 91,
  });

  assert.deepStrictEqual(sleeps, [1000, 2000]);
  assert.equal(sentMessages.length, 2);
  assert.equal(importedPayloads.length, 1);
  assert.equal(importedPayloads[0].accessToken, 'retry-access-token');
  assert.equal(
    logs.some((entry) => entry.level === 'warn' && /2 秒后重试/.test(entry.message)),
    true
  );
});

test('agent identity import retries when session exists but access token is not ready', async () => {
  const moduleApi = loadSub2ApiSessionImportModule();
  const sleeps = [];
  const sentMessages = [];
  const importedPayloads = [];

  const executor = moduleApi.createSub2ApiSessionImportExecutor({
    addLog: async () => {},
    chrome: {
      tabs: {
        get: async (tabId) => ({
          id: tabId,
          url: 'https://chatgpt.com/',
        }),
        update: async () => {},
      },
    },
    completeNodeFromBackground: async () => {},
    createSub2ApiApi: () => ({
      importCurrentChatGptSessionAsAgentIdentity: async (state) => {
        importedPayloads.push(state);
        return { verifiedStatus: 'ok' };
      },
    }),
    ensureContentScriptReadyOnTabUntilStopped: async () => {},
    getTabId: async () => null,
    isTabAlive: async () => false,
    normalizeSub2ApiUrl: (value) => value,
    registerTab: async () => {},
    sendTabMessageUntilStopped: async () => {
      sentMessages.push(true);
      if (sentMessages.length === 1) {
        return {
          session: {
            user: { email: 'pending@example.com' },
          },
          accessToken: '',
        };
      }
      return {
        session: {
          accessToken: 'agent-access-token',
          user: { email: 'ready@example.com' },
        },
        accessToken: 'agent-access-token',
      };
    },
    sessionReadMaxAttempts: 2,
    sleepWithStop: async (ms) => {
      sleeps.push(ms);
    },
    throwIfStopped: () => {},
    waitForTabCompleteUntilStopped: async () => {},
  });

  await executor.executeSub2ApiAgentIdentityImport({
    nodeId: 'sub2api-agent-identity-import',
    visibleStep: 7,
    plusCheckoutTabId: 91,
  });

  assert.deepStrictEqual(sleeps, [1000, 2000]);
  assert.equal(sentMessages.length, 2);
  assert.equal(importedPayloads.length, 1);
  assert.equal(importedPayloads[0].accessToken, 'agent-access-token');
  assert.equal(importedPayloads[0].session.user.email, 'ready@example.com');
});

test('session import step falls back to an active ChatGPT tab when no checkout tab is tracked', async () => {
  const moduleApi = loadSub2ApiSessionImportModule();
  const completed = [];
  const importedPayloads = [];
  const queryCalls = [];
  const registerCalls = [];
  const sentMessages = [];

  const sessionTab = {
    id: 77,
    url: 'https://chatgpt.com/?model=gpt-4o',
    active: true,
    currentWindow: true,
    lastAccessed: 1234,
  };

  const executor = moduleApi.createSub2ApiSessionImportExecutor({
    addLog: async () => {},
    chrome: {
      tabs: {
        get: async (tabId) => ({
          ...sessionTab,
          id: tabId,
        }),
        query: async (queryInfo = {}) => {
          queryCalls.push(queryInfo);
          if (queryInfo.active && queryInfo.currentWindow) {
            return [sessionTab];
          }
          return [sessionTab];
        },
        update: async () => {},
      },
    },
    completeNodeFromBackground: async (nodeId, payload) => {
      completed.push({ nodeId, payload });
    },
    createSub2ApiApi: () => ({
      importCurrentChatGptSession: async (state, options) => {
        importedPayloads.push({ state, options });
        return {
          verifiedStatus: 'SUB2API 会话导入完成：新建 1，更新 0，跳过 0，失败 0',
          sub2apiImportCreated: 1,
          sub2apiImportUpdated: 0,
          sub2apiImportSkipped: 0,
          sub2apiImportFailed: 0,
        };
      },
    }),
    ensureContentScriptReadyOnTabUntilStopped: async () => {},
    getTabId: async () => null,
    isTabAlive: async () => false,
    normalizeSub2ApiUrl: (value) => value,
    registerTab: async (source, tabId) => {
      registerCalls.push({ source, tabId });
    },
    sendTabMessageUntilStopped: async (tabId, source, message) => {
      sentMessages.push({ tabId, source, message });
      return {
        session: {
          accessToken: 'session-access-token',
          user: {
            email: 'fallback@example.com',
          },
        },
        accessToken: 'session-access-token',
      };
    },
    sleepWithStop: async () => {},
    throwIfStopped: () => {},
    waitForTabCompleteUntilStopped: async () => {},
    DEFAULT_SUB2API_GROUP_NAME: 'codex',
  });

  await executor.executeSub2ApiSessionImport({
    nodeId: 'sub2api-session-import',
    visibleStep: 10,
    sub2apiUrl: 'https://sub.example/admin/accounts',
    sub2apiEmail: 'admin@example.com',
    sub2apiPassword: 'secret',
    sub2apiGroupName: 'codex',
  });

  assert.deepStrictEqual(queryCalls, [
    { active: true, currentWindow: true },
    {},
  ]);
  assert.deepStrictEqual(registerCalls, [{
    source: 'plus-checkout',
    tabId: 77,
  }]);
  assert.equal(sentMessages.length, 1);
  assert.equal(sentMessages[0].tabId, 77);
  assert.equal(importedPayloads.length, 1);
  assert.equal(importedPayloads[0].state.session.user.email, 'fallback@example.com');
  assert.equal(completed.length, 1);
});

test('session import step ignores unusable tracked tabs and prefers a real ChatGPT tab from open tabs', async () => {
  const moduleApi = loadSub2ApiSessionImportModule();
  const registerCalls = [];
  const sentMessages = [];

  const tabsById = {
    91: {
      id: 91,
      url: 'https://www.paypal.com/checkoutnow',
      active: false,
      currentWindow: false,
      lastAccessed: 10,
    },
    101: {
      id: 101,
      url: 'https://platform.openai.com/settings/profile',
      active: true,
      currentWindow: true,
      lastAccessed: 50,
    },
    203: {
      id: 203,
      url: 'https://chatgpt.com/c/abc123',
      active: false,
      currentWindow: false,
      lastAccessed: 40,
    },
  };

  const executor = moduleApi.createSub2ApiSessionImportExecutor({
    addLog: async () => {},
    chrome: {
      tabs: {
        get: async (tabId) => tabsById[tabId] || null,
        query: async (queryInfo = {}) => {
          if (queryInfo.active && queryInfo.currentWindow) {
            return [tabsById[101]];
          }
          return [tabsById[101], tabsById[203]];
        },
        update: async () => {},
      },
    },
    completeNodeFromBackground: async () => {},
    createSub2ApiApi: () => ({
      importCurrentChatGptSession: async () => ({
        verifiedStatus: 'SUB2API 会话导入完成：新建 1，更新 0，跳过 0，失败 0',
      }),
    }),
    ensureContentScriptReadyOnTabUntilStopped: async () => {},
    getTabId: async () => 91,
    isTabAlive: async () => true,
    normalizeSub2ApiUrl: (value) => value,
    registerTab: async (source, tabId) => {
      registerCalls.push({ source, tabId });
    },
    sendTabMessageUntilStopped: async (tabId, source, message) => {
      sentMessages.push({ tabId, source, message });
      return {
        session: {
          accessToken: 'session-access-token',
          user: {
            email: 'best-match@example.com',
          },
        },
        accessToken: 'session-access-token',
      };
    },
    sleepWithStop: async () => {},
    throwIfStopped: () => {},
    waitForTabCompleteUntilStopped: async () => {},
    DEFAULT_SUB2API_GROUP_NAME: 'codex',
  });

  await executor.executeSub2ApiSessionImport({
    nodeId: 'sub2api-session-import',
    visibleStep: 10,
    sub2apiUrl: 'https://sub.example/admin/accounts',
    sub2apiEmail: 'admin@example.com',
    sub2apiPassword: 'secret',
    sub2apiGroupName: 'codex',
  });

  assert.deepStrictEqual(registerCalls, [{
    source: 'plus-checkout',
    tabId: 203,
  }]);
  assert.equal(sentMessages.length, 1);
  assert.equal(sentMessages[0].tabId, 203);
});

test('session import step reports missing readable session tab when tracked tabs are unusable', async () => {
  const moduleApi = loadSub2ApiSessionImportModule();
  let sendCalled = false;

  const executor = moduleApi.createSub2ApiSessionImportExecutor({
    addLog: async () => {},
    chrome: {
      tabs: {
        get: async (tabId) => ({
          id: tabId,
          url: 'https://example.com/not-chatgpt',
        }),
        update: async () => {},
      },
    },
    completeNodeFromBackground: async () => {},
    createSub2ApiApi: () => ({
      importCurrentChatGptSession: async () => ({}),
    }),
    ensureContentScriptReadyOnTabUntilStopped: async () => {},
    getTabId: async () => 91,
    isTabAlive: async () => true,
    normalizeSub2ApiUrl: (value) => value,
    sendTabMessageUntilStopped: async () => {
      sendCalled = true;
      return {};
    },
    sleepWithStop: async () => {},
    throwIfStopped: () => {},
    waitForTabCompleteUntilStopped: async () => {},
  });

  await assert.rejects(
    () => executor.executeSub2ApiSessionImport({
      nodeId: 'sub2api-session-import',
      visibleStep: 10,
    }),
    /未找到可读取 ChatGPT 会话的标签页/
  );

  assert.equal(sendCalled, false);
});

test('background wires sub2api session import executor into the workflow runtime', () => {
  const source = fs.readFileSync('background.js', 'utf8');
  assert.match(source, /background\/steps\/sub2api-session-import\.js/);
  assert.match(source, /'sub2api-session-import': \(state\) => sub2ApiSessionImportExecutor\.executeSub2ApiSessionImport\(state\)/);
  assert.match(source, /'sub2api-session-import',[\s\S]*'oauth-login'/);
});
