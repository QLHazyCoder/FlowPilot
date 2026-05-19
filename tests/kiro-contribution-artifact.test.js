const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');

function loadKiroContributionModules() {
  const stateSource = fs.readFileSync('background/kiro/state.js', 'utf8');
  const artifactSource = fs.readFileSync('background/kiro/credential-artifact.js', 'utf8');
  const adapterSource = fs.readFileSync('background/contribution/adapters/kiro-builder-id.js', 'utf8');
  const globalScope = {};
  new Function('self', `${stateSource}; ${artifactSource}; ${adapterSource}; return self;`)(globalScope);
  return globalScope;
}

function buildAuthorizedKiroState(overrides = {}) {
  return {
    activeFlowId: 'kiro',
    flowId: 'kiro',
    accountContributionEnabled: true,
    contributionAdapterId: 'kiro-builder-id',
    contributionNickname: '贡献者',
    contributionQq: '123456',
    kiroRuntime: {
      register: {
        email: 'kiro-user@example.com',
      },
      desktopAuth: {
        region: 'us-east-1',
        clientId: 'client-id-001',
        clientSecret: 'client-secret-super-long',
        refreshToken: 'refresh-token-super-secret',
        tokenSource: 'desktop_authorization_code_pkce',
        authorizedAt: 1760000000000,
      },
      upload: {
        targetId: 'kiro-rs',
      },
    },
    ...overrides,
  };
}

test('Kiro Builder ID artifact builder validates and builds unified contribution artifact', () => {
  const scope = loadKiroContributionModules();
  const api = scope.MultiPageBackgroundKiroCredentialArtifact;
  const artifact = api.buildKiroBuilderIdArtifact(buildAuthorizedKiroState());

  assert.equal(artifact.flow, 'kiro');
  assert.equal(artifact.adapter, 'kiro-builder-id');
  assert.equal(artifact.artifact, 'kiro-builder-id');
  assert.equal(artifact.account.email, 'kiro-user@example.com');
  assert.equal(artifact.credentials.refreshToken, 'refresh-token-super-secret');
  assert.equal(artifact.credentials.clientId, 'client-id-001');
  assert.equal(artifact.credentials.clientSecret, 'client-secret-super-long');
  assert.equal(artifact.credentials.region, 'us-east-1');
  assert.equal(artifact.metadata.targetId, 'kiro-rs');

  const safeSummary = api.buildSafeArtifactSummary(artifact);
  assert.equal(safeSummary.refreshToken.includes('refresh-token-super-secret'), false);
  assert.equal(safeSummary.clientSecret.includes('client-secret-super-long'), false);
});

test('Kiro Builder ID artifact builder rejects missing required fields', () => {
  const scope = loadKiroContributionModules();
  const api = scope.MultiPageBackgroundKiroCredentialArtifact;

  assert.throws(
    () => api.buildKiroBuilderIdArtifact(buildAuthorizedKiroState({
      kiroRuntime: {
        ...buildAuthorizedKiroState().kiroRuntime,
        desktopAuth: {
          ...buildAuthorizedKiroState().kiroRuntime.desktopAuth,
          refreshToken: '',
        },
      },
    })),
    /refreshToken/
  );
  assert.throws(
    () => api.buildKiroBuilderIdArtifact(buildAuthorizedKiroState({
      kiroRuntime: {
        ...buildAuthorizedKiroState().kiroRuntime,
        desktopAuth: {
          ...buildAuthorizedKiroState().kiroRuntime.desktopAuth,
          clientId: '',
        },
      },
    })),
    /clientId/
  );
  assert.throws(
    () => api.buildKiroBuilderIdArtifact(buildAuthorizedKiroState({
      kiroRuntime: {
        ...buildAuthorizedKiroState().kiroRuntime,
        desktopAuth: {
          ...buildAuthorizedKiroState().kiroRuntime.desktopAuth,
          clientSecret: '',
        },
      },
    })),
    /clientSecret/
  );
  assert.throws(
    () => api.buildKiroBuilderIdArtifact(buildAuthorizedKiroState({
      kiroRuntime: {
        ...buildAuthorizedKiroState().kiroRuntime,
        register: { email: '' },
      },
      email: '',
      accountIdentifier: '',
    })),
    /注册邮箱/
  );
});

test('Kiro contribution adapter submits public contribution without requiring kiro.rs config and redacts logs', async () => {
  const scope = loadKiroContributionModules();
  const adapterApi = scope.MultiPageBackgroundKiroBuilderIdContributionAdapter;
  const fetchCalls = [];
  const logs = [];
  const statePatches = [];
  const adapter = adapterApi.createKiroBuilderIdContributionAdapter({
    addLog: async (message, level, options) => logs.push({ message, level, options }),
    fetchImpl: async (url, options) => {
      fetchCalls.push({ url, options });
      return {
        ok: true,
        status: 200,
        async text() {
          return JSON.stringify({ ok: true, contribution_id: 'kiro-contribution-001', message: '已接收' });
        },
      };
    },
    setState: async (patch) => statePatches.push(patch),
  });

  const result = await adapter.maybeSubmitFlowContribution(buildAuthorizedKiroState({
    kiroRsUrl: '',
    kiroRsKey: '',
  }), { nodeId: 'kiro-complete-desktop-authorize' });

  assert.equal(result.ok, true);
  assert.equal(fetchCalls.length, 1);
  assert.equal(fetchCalls[0].url, 'https://flowpilot.qlhazycoder.top/api/contributions');
  const requestBody = JSON.parse(fetchCalls[0].options.body);
  assert.equal(requestBody.flow, 'kiro');
  assert.equal(requestBody.adapter_id, 'kiro-builder-id');
  assert.equal(requestBody.artifact_kind, 'kiro-builder-id');
  assert.equal(requestBody.artifact.credentials.refreshToken, 'refresh-token-super-secret');
  assert.equal(statePatches.at(-1).flowContributionRuntime.kiro.status, 'submitted');
  const logText = logs.map((entry) => entry.message).join('\n');
  assert.equal(logText.includes('refresh-token-super-secret'), false);
  assert.equal(logText.includes('client-secret-super-long'), false);
});

test('Kiro contribution adapter skips invalid artifacts without sending secrets', async () => {
  const scope = loadKiroContributionModules();
  const adapterApi = scope.MultiPageBackgroundKiroBuilderIdContributionAdapter;
  const fetchCalls = [];
  const logs = [];
  const adapter = adapterApi.createKiroBuilderIdContributionAdapter({
    addLog: async (message) => logs.push(message),
    fetchImpl: async () => {
      fetchCalls.push(true);
      throw new Error('should not be called');
    },
    setState: async () => {},
  });

  const result = await adapter.maybeSubmitFlowContribution(buildAuthorizedKiroState({
    kiroRuntime: {
      ...buildAuthorizedKiroState().kiroRuntime,
      desktopAuth: {
        ...buildAuthorizedKiroState().kiroRuntime.desktopAuth,
        refreshToken: '',
      },
    },
  }));

  assert.equal(result.skipped, true);
  assert.equal(result.reason, 'missing_refreshToken');
  assert.equal(fetchCalls.length, 0);
  assert.equal(logs.join('\n').includes('refresh-token-super-secret'), false);
});

test('Kiro contribution adapter redacts server errors that echo submitted secrets', async () => {
  const scope = loadKiroContributionModules();
  const adapterApi = scope.MultiPageBackgroundKiroBuilderIdContributionAdapter;
  const logs = [];
  const statePatches = [];
  const adapter = adapterApi.createKiroBuilderIdContributionAdapter({
    addLog: async (message) => logs.push(message),
    fetchImpl: async () => ({
      ok: false,
      status: 400,
      async text() {
        return JSON.stringify({
          ok: false,
          message: 'bad refresh-token-super-secret and client-secret-super-long',
        });
      },
    }),
    setState: async (patch) => statePatches.push(patch),
  });

  const result = await adapter.maybeSubmitFlowContribution(buildAuthorizedKiroState());

  assert.equal(result.ok, false);
  const combined = `${logs.join('\n')}\n${JSON.stringify(statePatches)}`;
  assert.equal(combined.includes('refresh-token-super-secret'), false);
  assert.equal(combined.includes('client-secret-super-long'), false);
});

test('Kiro public contribution is triggered from step 9 instead of step 8', () => {
  const desktopSource = fs.readFileSync('background/kiro/desktop-authorize-runner.js', 'utf8');
  const publisherSource = fs.readFileSync('background/kiro/publisher-kiro-rs.js', 'utf8');
  assert.doesNotMatch(desktopSource, /trigger:\s*'kiro-step-8'/);
  assert.match(publisherSource, /maybeSubmitFlowContribution/);
  assert.match(publisherSource, /trigger:\s*'kiro-step-9'/);
});
