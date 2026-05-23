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

function loadRemoteAccountInjectApiModule() {
  const source = fs.readFileSync('background/remote-account-inject-api.js', 'utf8');
  return new Function('self', `${source}; return self.MultiPageBackgroundRemoteAccountInjectApi;`)({});
}

test('remote account inject helper posts to normalized origin endpoint with bearer admin key', async () => {
  const moduleApi = loadRemoteAccountInjectApiModule();
  const calls = [];
  const api = moduleApi.createRemoteAccountInjectApi({
    fetchImpl: async (url, options = {}) => {
      calls.push({ url, options });
      return createJsonResponse({ total: 1, added: 1 });
    },
  });

  const result = await api.injectRemoteAccounts({
    url: 'https://remote.example.com/admin/deep/path',
    adminKey: 'admin-secret',
    body: {
      tokens: ['access-token'],
      strategy: 'merge',
      provider: 'gpt',
    },
  });

  assert.equal(calls.length, 1);
  assert.equal(calls[0].url, 'https://remote.example.com/api/remote-account/inject');
  assert.equal(calls[0].options.method, 'POST');
  assert.equal(calls[0].options.headers.Authorization, 'Bearer admin-secret');
  assert.equal(calls[0].options.headers['Content-Type'], 'application/json');
  assert.deepEqual(JSON.parse(calls[0].options.body), {
    tokens: ['access-token'],
    strategy: 'merge',
    provider: 'gpt',
  });
  assert.equal(result.skipped, false);
});

test('remote account inject helper skips missing URL or admin key without fetching', async () => {
  const moduleApi = loadRemoteAccountInjectApiModule();
  let fetchCalled = false;
  const api = moduleApi.createRemoteAccountInjectApi({
    fetchImpl: async () => {
      fetchCalled = true;
      return createJsonResponse({});
    },
  });

  assert.deepEqual(await api.injectRemoteAccounts({ adminKey: 'admin-secret' }), {
    skipped: true,
    reason: 'missing_url',
  });
  assert.deepEqual(await api.injectRemoteAccounts({ url: 'http://remote.example.com' }), {
    skipped: true,
    reason: 'missing_admin_key',
  });
  assert.equal(fetchCalled, false);
});

test('remote account inject helper unwraps code-zero API envelopes', async () => {
  const moduleApi = loadRemoteAccountInjectApiModule();
  const api = moduleApi.createRemoteAccountInjectApi({
    fetchImpl: async () => createJsonResponse({ code: 0, data: { total: 1, added: 1 } }),
  });

  const result = await api.injectRemoteAccounts({
    url: 'http://remote.example.com',
    adminKey: 'admin-secret',
    body: { tokens: ['access-token'] },
  });

  assert.equal(result.skipped, false);
  assert.deepEqual(result.payload, { total: 1, added: 1 });
});

test('remote account inject helper reports API error messages without exposing secrets', async () => {
  const moduleApi = loadRemoteAccountInjectApiModule();
  const api = moduleApi.createRemoteAccountInjectApi({
    fetchImpl: async () => createJsonResponse({ error: 'invalid admin key' }, 403),
  });

  await assert.rejects(
    () => api.injectRemoteAccounts({
      url: 'remote.example.com/trailing/path',
      adminKey: 'admin-secret',
      body: { accounts: [] },
    }),
    /invalid admin key/
  );
});
