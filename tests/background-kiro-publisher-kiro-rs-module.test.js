const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');

function loadPublisherApi() {
  const stateSource = fs.readFileSync('background/kiro/state.js', 'utf8');
  const publisherSource = fs.readFileSync('background/kiro/publisher-kiro-rs.js', 'utf8');
  const globalScope = {};
  new Function('self', `${stateSource}; ${publisherSource}; return self;`)(globalScope);
  return globalScope.MultiPageBackgroundKiroPublisherKiroRs;
}

test('kiro publisher exposes a factory and upload payload helpers', () => {
  const api = loadPublisherApi();
  assert.equal(typeof api?.createKiroRsPublisher, 'function');
  assert.equal(typeof api?.buildKiroRsPayload, 'function');
  assert.equal(typeof api?.buildMachineId, 'function');
});

test('kiro publisher builds kiro.rs payload from desktop auth runtime with BuilderId profileArn', async () => {
  const api = loadPublisherApi();
  const payload = api.buildKiroRsPayload({
    kiroTargetId: 'kiro-rs',
    kiroRsUrl: 'https://kiro.example.com/admin',
    kiroRsKey: 'demo-key',
    ipProxyEnabled: true,
    ipProxyHost: '1.2.3.4',
    ipProxyPort: '8080',
    ipProxyProtocol: 'http',
    ipProxyUsername: 'proxy-user',
    ipProxyPassword: 'proxy-pass',
    kiroRuntime: {
      register: {
        email: 'aws-user@example.com',
      },
      desktopAuth: {
        region: 'us-east-1',
        clientId: 'client-001',
        clientSecret: 'secret-001',
        refreshToken: 'refresh-token-001',
      },
      upload: {
        targetId: 'kiro-rs',
      },
    },
  });
  const machineId = await api.buildMachineId('refresh-token-001');

  assert.deepEqual(payload, {
    targetId: 'kiro-rs',
    region: 'us-east-1',
    email: 'aws-user@example.com',
    refreshToken: 'refresh-token-001',
    profileArn: 'arn:aws:codewhisperer:us-east-1:638616132270:profile/AAAACCCCXXXX',
    clientId: 'client-001',
    clientSecret: 'secret-001',
    authMethod: 'idc',
    authRegion: 'us-east-1',
    apiRegion: 'us-east-1',
    proxyUrl: 'http://1.2.3.4:8080',
    proxyUsername: 'proxy-user',
    proxyPassword: 'proxy-pass',
  });
  assert.equal(machineId.length, 64);
  assert.match(machineId, /^[0-9a-f]{64}$/);
});

test('kiro publisher reads latest kiro.rs key from background state instead of stale node snapshot', async () => {
  const api = loadPublisherApi();
  const requests = [];
  let liveState = {
    kiroTargetId: 'kiro-rs',
    kiroRsUrl: 'https://kiro.example.com/admin',
    kiroRsKey: 'live-key',
    email: 'aws-user@example.com',
    kiroRuntime: {
      register: {
        email: 'aws-user@example.com',
      },
      desktopAuth: {
        region: 'us-east-1',
        clientId: 'client-001',
        clientSecret: 'secret-001',
        refreshToken: 'refresh-token-001',
      },
      upload: {
        targetId: 'kiro-rs',
      },
    },
    settingsState: {
      flows: {
        kiro: {
          targetId: 'kiro-rs',
          targets: {
            'kiro-rs': {
              baseUrl: 'https://kiro.example.com/admin',
              apiKey: 'live-key',
            },
          },
        },
      },
    },
  };
  const completed = [];
  const publisher = api.createKiroRsPublisher({
    addLog: async () => {},
    completeNodeFromBackground: async (nodeId, payload) => {
      completed.push({ nodeId, payload });
    },
    fetchImpl: async (url, options = {}) => {
      requests.push({
        url,
        method: options.method || 'GET',
        apiKey: options.headers?.['x-api-key'],
        authorization: options.headers?.Authorization,
        body: options.body ? JSON.parse(options.body) : null,
      });
      if ((options.method || 'GET') === 'GET') {
        return {
          ok: true,
          status: 200,
          statusText: 'OK',
          text: async () => JSON.stringify({ items: [] }),
        };
      }
      return {
        ok: true,
        status: 200,
        statusText: 'OK',
        text: async () => JSON.stringify({
          message: 'Credential uploaded.',
          credentialId: 9,
          email: 'aws-user@example.com',
        }),
      };
    },
    getState: async () => ({ ...liveState }),
    setState: async (updates = {}) => {
      liveState = { ...liveState, ...updates };
    },
  });

  await publisher.executeKiroUploadCredential({
    nodeId: 'kiro-upload-credential',
    kiroRsKey: '',
    settingsState: {
      flows: {
        kiro: {
          targetId: 'kiro-rs',
          targets: {
            'kiro-rs': {
              baseUrl: 'https://kiro.example.com/admin',
              apiKey: '',
            },
          },
        },
      },
    },
  });

  assert.equal(requests.length, 2);
  assert.equal(requests[0].apiKey, 'live-key');
  assert.equal(requests[0].authorization, 'Bearer live-key');
  assert.equal(requests[1].apiKey, 'live-key');
  assert.equal(requests[1].authorization, 'Bearer live-key');
  assert.equal(
    requests[1].body.profileArn,
    'arn:aws:codewhisperer:us-east-1:638616132270:profile/AAAACCCCXXXX'
  );
  assert.equal(completed.length, 1);
  assert.equal(completed[0].nodeId, 'kiro-upload-credential');
});

test('kiro publisher routes step 9 through public contribution upload when contribution mode is enabled', async () => {
  const api = loadPublisherApi();
  const requests = [];
  const completed = [];
  let liveState = {
    activeFlowId: 'kiro',
    flowId: 'kiro',
    accountContributionEnabled: true,
    contributionAdapterId: 'kiro-builder-id',
    kiroTargetId: 'kiro-rs',
    kiroRuntime: {
      register: {
        email: 'aws-user@example.com',
      },
      desktopAuth: {
        region: 'us-east-1',
        clientId: 'client-001',
        clientSecret: 'secret-001',
        refreshToken: 'refresh-token-001',
      },
      upload: {
        targetId: 'kiro-rs',
      },
    },
  };
  const publisher = api.createKiroRsPublisher({
    addLog: async () => {},
    completeNodeFromBackground: async (nodeId, payload) => {
      completed.push({ nodeId, payload });
    },
    fetchImpl: async (url, options = {}) => {
      requests.push({ url, options });
      throw new Error('kiro.rs upload should not be called in contribution mode');
    },
    getState: async () => ({ ...liveState }),
    maybeSubmitFlowContribution: async (_state, options = {}) => ({
      ok: true,
      skipped: false,
      contributionId: 'kiro-contribution-009',
      message: `贡献链路成功:${options.trigger || 'unknown'}`,
    }),
    setState: async (updates = {}) => {
      liveState = { ...liveState, ...updates };
    },
  });

  await publisher.executeKiroUploadCredential({
    nodeId: 'kiro-upload-credential',
  });

  assert.equal(requests.length, 0);
  assert.equal(completed.length, 1);
  assert.equal(completed[0].nodeId, 'kiro-upload-credential');
  assert.equal(completed[0].payload.kiroRuntime.upload.targetId, 'contribution');
  assert.equal(completed[0].payload.kiroRuntime.upload.status, 'uploaded');
  assert.equal(completed[0].payload.kiroRuntime.upload.credentialId, 'kiro-contribution-009');
  assert.equal(completed[0].payload.kiroRuntime.upload.lastMessage, '贡献链路成功:kiro-step-9');
});

test('kiro publisher trims api key and includes fallback Authorization header during connection check', async () => {
  const api = loadPublisherApi();
  const requests = [];

  const result = await api.checkKiroRsConnection(
    'https://kiro.example.com/admin',
    ' live-key ',
    async (url, options = {}) => {
      requests.push({
        url,
        method: options.method || 'GET',
        apiKey: options.headers?.['x-api-key'],
        authorization: options.headers?.Authorization,
      });
      return {
        ok: false,
        status: 401,
        statusText: 'Unauthorized',
        text: async () => JSON.stringify({
          error: {
            message: 'Invalid or missing admin API key',
          },
        }),
      };
    }
  );

  assert.equal(requests.length, 1);
  assert.equal(requests[0].method, 'GET');
  assert.equal(requests[0].apiKey, 'live-key');
  assert.equal(requests[0].authorization, 'Bearer live-key');
  assert.equal(result.ok, false);
  assert.equal(result.status, 401);
  assert.equal(result.message, 'kiro.rs API Key 被拒绝（HTTP 401：Invalid or missing admin API key）');
});
