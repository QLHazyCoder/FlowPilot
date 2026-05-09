const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');

function loadOperationDelayApi(overrides = {}) {
  const source = fs.readFileSync('content/operation-delay.js', 'utf8');
  const root = {
    console,
    sleep: async (ms) => overrides.events?.push(`sleep:${ms}`),
    chrome: overrides.chrome || { storage: { local: { get: async () => ({}) }, onChanged: { addListener() {} } } },
  };
  new Function('self', 'globalThis', `${source}; return self.CodexOperationDelay;`)(root, root);
  return root.CodexOperationDelay;
}

async function resolveOrPending(promise, timeoutMs = 10) {
  return Promise.race([
    promise.then(() => 'resolved'),
    new Promise((resolve) => setTimeout(() => resolve('pending'), timeoutMs)),
  ]);
}

function waitForTimer() {
  return new Promise((resolve) => setTimeout(resolve, 0));
}

test('operation delay runs action first and waits once after completion', async () => {
  const events = [];
  const api = loadOperationDelayApi({ events });
  await api.performOperationWithDelay({ stepKey: 'fill-profile', kind: 'fill' }, async () => {
    events.push('operation:start');
    events.push('operation:end');
  }, { sleep: async (ms) => events.push(`sleep:${ms}`), getEnabled: () => true });
  assert.deepStrictEqual(events, ['operation:start', 'operation:end', 'sleep:2000']);
});

test('operation delay skips disabled mode and excluded step keys', async () => {
  const api = loadOperationDelayApi();
  assert.equal(api.shouldDelayOperation({ enabled: false, stepKey: 'fill-profile', kind: 'click' }), false);
  assert.equal(api.shouldDelayOperation({ enabled: true, stepKey: 'confirm-oauth', kind: 'click' }), false);
  assert.equal(api.shouldDelayOperation({ enabled: true, stepKey: 'platform-verify', kind: 'submit' }), false);
  assert.equal(api.shouldDelayOperation({ enabled: true, stepKey: 'fill-profile', kind: 'fill' }), true);
});

test('operation delay defaults unresolved settings to enabled', async () => {
  const events = [];
  const api = loadOperationDelayApi({ events, chrome: { storage: { local: { get: async () => ({}) }, onChanged: { addListener() {} } } } });
  await api.performOperationWithDelay({ stepKey: 'fill-profile', kind: 'fill' }, async () => events.push('operation'), { sleep: async (ms) => events.push(`sleep:${ms}`) });
  assert.deepStrictEqual(events, ['operation', 'sleep:2000']);
});

test('persisted disabled setting prevents first operation delay even before initial restore resolves', async () => {
  const events = [];
  let resolveStorage;
  const storageReady = new Promise((resolve) => { resolveStorage = resolve; });
  const api = loadOperationDelayApi({
    events,
    chrome: { storage: { local: { get: async () => storageReady }, onChanged: { addListener() {} } } },
  });

  const pendingOperation = api.performOperationWithDelay(
    { stepKey: 'fill-profile', kind: 'fill' },
    async () => events.push('operation'),
    { sleep: async (ms) => events.push(`sleep:${ms}`) }
  );

  await Promise.resolve();
  assert.deepStrictEqual(events, ['operation']);

  resolveStorage({ operationDelayEnabled: false });
  await pendingOperation;
  assert.deepStrictEqual(events, ['operation']);
});

test('newer disabled storage change wins over older pending restore', async () => {
  const events = [];
  let changeListener = null;
  let resolveStorage;
  const storageReady = new Promise((resolve) => { resolveStorage = resolve; });
  const api = loadOperationDelayApi({
    events,
    chrome: {
      storage: {
        local: { get: async () => storageReady },
        onChanged: { addListener(listener) { changeListener = listener; } },
      },
    },
  });

  changeListener({ operationDelayEnabled: { newValue: false } }, 'local');
  assert.equal(api.getOperationDelayEnabled(), false);
  resolveStorage({ operationDelayEnabled: true });
  await waitForTimer();

  assert.equal(api.getOperationDelayEnabled(), false);
  await api.performOperationWithDelay(
    { stepKey: 'fill-profile', kind: 'fill' },
    async () => events.push('operation'),
    { sleep: async (ms) => events.push(`sleep:${ms}`) }
  );
  assert.deepStrictEqual(events, ['operation']);
});

test('newer enabled storage change wins over older pending restore', async () => {
  const events = [];
  let changeListener = null;
  let resolveStorage;
  const storageReady = new Promise((resolve) => { resolveStorage = resolve; });
  const api = loadOperationDelayApi({
    events,
    chrome: {
      storage: {
        local: { get: async () => storageReady },
        onChanged: { addListener(listener) { changeListener = listener; } },
      },
    },
  });

  changeListener({ operationDelayEnabled: { newValue: true } }, 'local');
  assert.equal(api.getOperationDelayEnabled(), true);
  resolveStorage({ operationDelayEnabled: false });
  await waitForTimer();

  assert.equal(api.getOperationDelayEnabled(), true);
  await api.performOperationWithDelay(
    { stepKey: 'fill-profile', kind: 'fill' },
    async () => events.push('operation'),
    { sleep: async (ms) => events.push(`sleep:${ms}`) }
  );
  assert.deepStrictEqual(events, ['operation', 'sleep:2000']);
});

test('first operation honors async persisted disabled setting before fallback budget expires', async () => {
  const events = [];
  const api = loadOperationDelayApi({
    events,
    chrome: {
      storage: {
        local: { get: async () => new Promise((resolve) => setTimeout(() => resolve({ operationDelayEnabled: false }), 5)) },
        onChanged: { addListener() {} },
      },
    },
  });

  await api.performOperationWithDelay(
    { stepKey: 'fill-profile', kind: 'fill' },
    async () => events.push('operation'),
    { sleep: async (ms) => events.push(`sleep:${ms}`) }
  );
  assert.deepStrictEqual(events, ['operation']);
});

test('hanging initial storage restore falls back to enabled delay and returns', async () => {
  const events = [];
  const api = loadOperationDelayApi({
    events,
    chrome: { storage: { local: { get: async () => new Promise(() => {}) }, onChanged: { addListener() {} } } },
  });

  const operation = api.performOperationWithDelay(
    { stepKey: 'fill-profile', kind: 'fill' },
    async () => events.push('operation'),
    { sleep: async (ms) => events.push(`sleep:${ms}`) }
  );

  assert.equal(await resolveOrPending(operation, 100), 'resolved');
  assert.deepStrictEqual(events, ['operation', 'sleep:2000']);
});

test('explicit disabled metadata does not wait for hanging initial storage restore', async () => {
  const events = [];
  const api = loadOperationDelayApi({
    events,
    chrome: { storage: { local: { get: async () => new Promise(() => {}) }, onChanged: { addListener() {} } } },
  });

  const operation = api.performOperationWithDelay(
    { enabled: false, stepKey: 'fill-profile', kind: 'fill' },
    async () => events.push('operation'),
    { sleep: async (ms) => events.push(`sleep:${ms}`) }
  );

  assert.equal(await resolveOrPending(operation), 'resolved');
  assert.deepStrictEqual(events, ['operation']);
});

test('invalid persisted values still resolve to enabled', async () => {
  const api = loadOperationDelayApi({ chrome: { storage: { local: { get: async () => ({ operationDelayEnabled: 'false' }) }, onChanged: { addListener() {} } } } });
  await api.refreshOperationDelaySetting();
  assert.equal(api.getOperationDelayEnabled(), true);
});

test('shouldDelayOperation uses cached disabled setting by default', async () => {
  const api = loadOperationDelayApi({ chrome: { storage: { local: { get: async () => ({ operationDelayEnabled: false }) }, onChanged: { addListener() {} } } } });
  await api.refreshOperationDelaySetting();
  assert.equal(api.getOperationDelayEnabled(), false);
  assert.equal(api.shouldDelayOperation({ stepKey: 'fill-profile', kind: 'fill' }), false);
});

test('storage change to disabled is honored by later delayed operations', async () => {
  const events = [];
  let changeListener = null;
  const api = loadOperationDelayApi({
    events,
    chrome: {
      storage: {
        local: { get: async () => ({ operationDelayEnabled: true }) },
        onChanged: { addListener(listener) { changeListener = listener; } },
      },
    },
  });
  await api.refreshOperationDelaySetting();
  changeListener({ operationDelayEnabled: { newValue: false } }, 'local');

  assert.equal(api.getOperationDelayEnabled(), false);
  assert.equal(api.shouldDelayOperation({ stepKey: 'fill-profile', kind: 'fill' }), false);
  await api.performOperationWithDelay(
    { stepKey: 'fill-profile', kind: 'fill' },
    async () => events.push('operation'),
    { sleep: async (ms) => events.push(`sleep:${ms}`) }
  );
  assert.deepStrictEqual(events, ['operation']);
});

test('storage change to enabled is honored by later delayed operations', async () => {
  const events = [];
  let changeListener = null;
  const api = loadOperationDelayApi({
    events,
    chrome: {
      storage: {
        local: { get: async () => ({ operationDelayEnabled: false }) },
        onChanged: { addListener(listener) { changeListener = listener; } },
      },
    },
  });
  await api.refreshOperationDelaySetting();
  changeListener({ operationDelayEnabled: { newValue: true } }, 'local');

  assert.equal(api.getOperationDelayEnabled(), true);
  assert.equal(api.shouldDelayOperation({ stepKey: 'fill-profile', kind: 'fill' }), true);
  await api.performOperationWithDelay(
    { stepKey: 'fill-profile', kind: 'fill' },
    async () => events.push('operation'),
    { sleep: async (ms) => events.push(`sleep:${ms}`) }
  );
  assert.deepStrictEqual(events, ['operation', 'sleep:2000']);
});

test('operation delay uses stop-aware sleep and propagates stop errors', async () => {
  const api = loadOperationDelayApi();
  await assert.rejects(
    () => api.performOperationWithDelay({ stepKey: 'fill-profile', kind: 'click' }, async () => {}, {
      sleep: async () => { throw new Error('流程已被用户停止。'); },
      getEnabled: () => true,
    }),
    /流程已被用户停止/
  );
});

test('grouped split-code metadata still delays only once', async () => {
  const events = [];
  const api = loadOperationDelayApi();
  await api.performOperationWithDelay({ stepKey: 'fetch-signup-code', kind: 'grouped-code' }, async () => {
    for (let index = 0; index < 6; index += 1) events.push(`fill:${index}`);
  }, { sleep: async (ms) => events.push(`sleep:${ms}`), getEnabled: () => true });
  assert.deepStrictEqual(events, ['fill:0', 'fill:1', 'fill:2', 'fill:3', 'fill:4', 'fill:5', 'sleep:2000']);
});
