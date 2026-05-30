const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');

function loadPublisherApi() {
  const source = fs.readFileSync('flows/openai/background/publisher-webchat.js', 'utf8');
  const globalScope = {};
  new Function('self', `${source}; return self;`)(globalScope);
  return globalScope.MultiPageBackgroundOpenAiPublisherWebchat;
}

function createJsonResponse(payload, status = 200) {
  return {
    ok: status >= 200 && status < 300,
    status,
    statusText: status >= 200 && status < 300 ? 'OK' : 'Error',
    text: async () => JSON.stringify(payload),
  };
}

test('OpenAI webchat publisher exposes helpers and normalizes to origin inject endpoint', () => {
  const api = loadPublisherApi();

  assert.equal(typeof api?.createOpenAiWebchatPublisher, 'function');
  assert.equal(
    api.buildWebchatInjectUrl('https://remote.example.com/admin/deep/path'),
    'https://remote.example.com/api/remote-account/inject'
  );
  assert.equal(
    api.buildWebchatInjectUrl('remote.example.com/admin'),
    'http://remote.example.com/api/remote-account/inject'
  );
});

test('OpenAI webchat publisher builds session payload without requiring Plus strategy', () => {
  const api = loadPublisherApi();

  assert.deepEqual(api.buildOpenAiSessionInjectPayload(
    {
      accessToken: 'session-token',
      user: { email: 'flow@example.com' },
    },
    ''
  ), {
    accounts: [{
      provider: 'openai',
      type: 'session',
      session: {
        accessToken: 'session-token',
        user: { email: 'flow@example.com' },
      },
      token: 'session-token',
      accessToken: 'session-token',
    }],
    strategy: 'merge',
    source_id: 'flowpilot-openai-session',
    source_name: 'FlowPilot OpenAI Session',
    provider: 'openai',
  });

  assert.throws(
    () => api.buildOpenAiSessionInjectPayload(null, ''),
    /缺少 ChatGPT 会话或 accessToken/
  );
});

test('OpenAI webchat publisher posts session payload with bearer admin key', async () => {
  const api = loadPublisherApi();
  const requests = [];

  const result = await api.uploadOpenAiSessionToWebchat(
    'https://remote.example.com/admin/deep/path',
    ' admin-secret ',
    {
      session: {
        accessToken: 'session-token',
        user: { email: 'flow@example.com' },
      },
      accessToken: 'session-token',
    },
    async (url, options = {}) => {
      requests.push({
        url,
        method: options.method,
        authorization: options.headers?.Authorization,
        contentType: options.headers?.['Content-Type'],
        body: JSON.parse(options.body),
      });
      return createJsonResponse({ code: 0, data: { total: 1 }, message: 'ok' });
    }
  );

  assert.equal(requests.length, 1);
  assert.equal(requests[0].url, 'https://remote.example.com/api/remote-account/inject');
  assert.equal(requests[0].method, 'POST');
  assert.equal(requests[0].authorization, 'Bearer admin-secret');
  assert.equal(requests[0].contentType, 'application/json');
  assert.equal(requests[0].body.accounts[0].provider, 'openai');
  assert.equal(requests[0].body.accounts[0].type, 'session');
  assert.equal(requests[0].body.accounts[0].token, 'session-token');
  assert.equal(requests[0].body.strategy, 'merge');
  assert.equal(result.endpointUrl, 'https://remote.example.com/api/remote-account/inject');
  assert.equal(result.message, 'ok');
});

test('OpenAI webchat executor reads latest state and writes upload status without leaking secrets', async () => {
  const api = loadPublisherApi();
  const requests = [];
  const logs = [];
  const broadcasts = [];
  const completed = [];
  let liveState = {
    openaiWebchatUrl: '',
    openaiWebchatAdminKey: '',
    settingsState: {
      flows: {
        openai: {
          targets: {
            webchat: {
              baseUrl: 'https://remote.example.com/admin',
              apiKey: 'live-admin-key',
            },
          },
        },
      },
    },
  };
  const publisher = api.createOpenAiWebchatPublisher({
    addLog: async (message, level) => logs.push({ message, level }),
    broadcastDataUpdate: (updates) => broadcasts.push(updates),
    completeNodeFromBackground: async (nodeId, payload) => completed.push({ nodeId, payload }),
    createOpenAiSessionReader: () => ({
      readCurrentSessionFromState: async () => ({
        session: {
          accessToken: 'live-session-token',
          user: { email: 'flow@example.com' },
        },
        accessToken: 'live-session-token',
        tabId: 91,
      }),
    }),
    fetchImpl: async (url, options = {}) => {
      requests.push({
        url,
        authorization: options.headers?.Authorization,
        body: JSON.parse(options.body),
      });
      return createJsonResponse({ code: 0, message: 'uploaded' });
    },
    getState: async () => ({ ...liveState }),
    setState: async (updates = {}) => {
      liveState = { ...liveState, ...updates };
    },
  });

  await publisher.executeOpenAiUploadSessionToWebchat({
    nodeId: 'openai-upload-session-to-webchat',
    visibleStep: 12,
    openaiWebchatAdminKey: 'stale-key',
  });

  assert.equal(requests.length, 1);
  assert.equal(requests[0].url, 'https://remote.example.com/api/remote-account/inject');
  assert.equal(requests[0].authorization, 'Bearer live-admin-key');
  assert.equal(requests[0].body.accounts[0].token, 'live-session-token');
  assert.equal(completed.length, 1);
  assert.equal(completed[0].nodeId, 'openai-upload-session-to-webchat');
  assert.equal(completed[0].payload.openaiWebchatUploadStatus, 'uploaded');
  assert.equal(completed[0].payload.openaiWebchatUploadMessage, 'uploaded');
  assert.equal(completed[0].payload.openaiWebchatTargetUrl, 'https://remote.example.com/api/remote-account/inject');
  assert.equal(typeof completed[0].payload.openaiWebchatUploadedAt, 'number');
  assert.equal(broadcasts.some((entry) => entry.openaiWebchatUploadStatus === 'uploaded'), true);
  assert.equal(logs.some(({ message }) => message.includes('live-session-token') || message.includes('live-admin-key')), false);
});

test('OpenAI webchat executor can use shared Grok webchat2api config', async () => {
  const api = loadPublisherApi();
  const requests = [];
  let liveState = {
    settingsState: {
      flows: {
        grok: {
          targets: {
            webchat2api: {
              baseUrl: 'https://shared.example.com/admin',
              apiKey: 'shared-admin-key',
            },
          },
        },
      },
    },
  };
  const publisher = api.createOpenAiWebchatPublisher({
    completeNodeFromBackground: async () => {},
    createOpenAiSessionReader: () => ({
      readCurrentSessionFromState: async () => ({
        accessToken: 'shared-session-token',
      }),
    }),
    fetchImpl: async (url, options = {}) => {
      requests.push({
        url,
        authorization: options.headers?.Authorization,
        body: JSON.parse(options.body),
      });
      return createJsonResponse({ code: 0, message: 'uploaded' });
    },
    getState: async () => ({ ...liveState }),
    setState: async (updates = {}) => {
      liveState = { ...liveState, ...updates };
    },
  });

  await publisher.executeOpenAiUploadSessionToWebchat({ nodeId: 'openai-upload-session-to-webchat' });

  assert.equal(requests.length, 1);
  assert.equal(requests[0].url, 'https://shared.example.com/api/remote-account/inject');
  assert.equal(requests[0].authorization, 'Bearer shared-admin-key');
  assert.equal(requests[0].body.accounts[0].token, 'shared-session-token');
  assert.equal(liveState.openaiWebchatUploadStatus, 'uploaded');
});

test('OpenAI webchat executor persists failure state without completing or leaking secrets', async () => {
  const api = loadPublisherApi();
  const logs = [];
  const completed = [];
  let liveState = {
    settingsState: {
      flows: {
        openai: {
          targets: {
            webchat: {
              baseUrl: 'https://remote.example.com/admin',
              apiKey: 'secret-admin-key',
            },
          },
        },
      },
    },
  };
  const publisher = api.createOpenAiWebchatPublisher({
    addLog: async (message, level) => logs.push({ message, level }),
    completeNodeFromBackground: async (nodeId, payload) => completed.push({ nodeId, payload }),
    createOpenAiSessionReader: () => ({
      readCurrentSessionFromState: async () => ({
        session: { accessToken: 'secret-session-token' },
        accessToken: 'secret-session-token',
      }),
    }),
    fetchImpl: async () => createJsonResponse({ error: 'invalid admin key' }, 403),
    getState: async () => ({ ...liveState }),
    setState: async (updates = {}) => {
      liveState = { ...liveState, ...updates };
    },
  });

  await assert.rejects(
    () => publisher.executeOpenAiUploadSessionToWebchat({ nodeId: 'openai-upload-session-to-webchat' }),
    /webchat 会话上传失败：invalid admin key/
  );

  assert.equal(completed.length, 0);
  assert.equal(liveState.openaiWebchatUploadStatus, 'error');
  assert.equal(liveState.openaiWebchatUploadedAt, 0);
  assert.equal(liveState.openaiWebchatUploadMessage, 'webchat 会话上传失败：invalid admin key');
  assert.equal(liveState.openaiWebchatTargetUrl, 'https://remote.example.com/api/remote-account/inject');
  assert.equal(logs.some(({ message }) => message.includes('secret-session-token') || message.includes('secret-admin-key')), false);
});
