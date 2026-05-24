const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');

const source = fs.readFileSync('background.js', 'utf8');

function extractFunction(name) {
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
  if (braceStart < 0) {
    throw new Error(`missing body for function ${name}`);
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

const bundle = [
  extractFunction('normalizeEmailGenerator'),
  extractFunction('normalizeCustomEmailPool'),
  extractFunction('normalizeCustomEmailPoolEntryObjects'),
  extractFunction('getCustomEmailPool'),
  extractFunction('getCustomEmailPoolEmailForRun'),
  extractFunction('getCustomMailProviderPool'),
  extractFunction('getCustomMailProviderPoolEmailForRun'),
  extractFunction('removeCurrentCustomMailProviderPoolEmail'),
  extractFunction('getEmailGeneratorLabel'),
].join('\n');

function createApi() {
  return new Function(`
const CUSTOM_EMAIL_POOL_GENERATOR = 'custom-pool';
const CLOUDFLARE_TEMP_EMAIL_GENERATOR = 'cloudflare-temp-email';

${bundle}

return {
  normalizeEmailGenerator,
  normalizeCustomEmailPool,
  getCustomEmailPool,
  getCustomEmailPoolEmailForRun,
  getCustomMailProviderPool,
  getCustomMailProviderPoolEmailForRun,
  removeCurrentCustomMailProviderPoolEmail,
  getEmailGeneratorLabel,
};
`)();
}

test('background recognizes custom email pool generator and label', () => {
  const api = createApi();

  assert.equal(api.normalizeEmailGenerator('custom-pool'), 'custom-pool');
  assert.equal(api.getEmailGeneratorLabel('custom-pool'), '自定义邮箱池');
});

test('background normalizes custom email pool input and keeps order', () => {
  const api = createApi();

  assert.deepEqual(
    api.normalizeCustomEmailPool(' Foo@Example.com \ninvalid\nbar@example.com；baz@example.com '),
    ['foo@example.com', 'bar@example.com', 'baz@example.com']
  );
});

test('background selects the matching email for the current auto-run round', () => {
  const api = createApi();
  const state = {
    customEmailPool: ['first@example.com', 'second@example.com', 'third@example.com'],
  };

  assert.equal(api.getCustomEmailPoolEmailForRun(state, 1), 'first@example.com');
  assert.equal(api.getCustomEmailPoolEmailForRun(state, 2), 'second@example.com');
  assert.equal(api.getCustomEmailPoolEmailForRun(state, 4), '');
});

test('background selects the matching custom provider pool email for the current auto-run round', () => {
  const api = createApi();
  const state = {
    customMailProviderPool: ['first@example.com', 'second@example.com', 'third@example.com'],
  };

  assert.deepEqual(api.getCustomMailProviderPool(state), [
    'first@example.com',
    'second@example.com',
    'third@example.com',
  ]);
  assert.equal(api.getCustomMailProviderPoolEmailForRun(state, 1), 'first@example.com');
  assert.equal(api.getCustomMailProviderPoolEmailForRun(state, 3), 'third@example.com');
  assert.equal(api.getCustomMailProviderPoolEmailForRun(state, 4), '');
});

test('auto email readiness checks custom provider pool before reusing stale current email', () => {
  const ensureAutoEmailReadySource = extractFunction('ensureAutoEmailReady');
  const staleEmailReuseIndex = ensureAutoEmailReadySource.indexOf('if (currentState.email)');
  const customProviderPoolIndex = ensureAutoEmailReadySource.indexOf('if (isCustomMailProvider(currentState))');

  assert.notEqual(staleEmailReuseIndex, -1);
  assert.notEqual(customProviderPoolIndex, -1);
  assert.equal(customProviderPoolIndex < staleEmailReuseIndex, true);
});

test('background removes successful custom provider pool email and keeps the next email first', async () => {
  const persistentUpdates = [];
  const stateUpdates = [];
  const broadcasts = [];
  const logs = [];
  const api = new Function(`
const CUSTOM_EMAIL_POOL_GENERATOR = 'custom-pool';
const CLOUDFLARE_TEMP_EMAIL_GENERATOR = 'cloudflare-temp-email';
const persistentUpdates = arguments[0];
const stateUpdates = arguments[1];
const broadcasts = arguments[2];
const logs = arguments[3];
async function setPersistentSettings(updates) { persistentUpdates.push(updates); }
async function setState(updates) { stateUpdates.push(updates); }
function broadcastDataUpdate(updates) { broadcasts.push(updates); }
async function addLog(message, level) { logs.push({ message, level }); }
async function getState() { return { email: 'first@example.com' }; }
async function setEmailStateSilently(email) {
  stateUpdates.push({ email });
  broadcasts.push({ email });
}

${bundle}

return { removeCurrentCustomMailProviderPoolEmail };
`)(persistentUpdates, stateUpdates, broadcasts, logs);

  const result = await api.removeCurrentCustomMailProviderPoolEmail({
    mailProvider: 'custom',
    email: 'first@example.com',
    customMailProviderPool: ['first@example.com', 'second@example.com', 'third@example.com'],
  }, {
    logPrefix: '流程完成：自定义邮箱号池',
    level: 'ok',
  });

  assert.equal(result.updated, true);
  assert.deepEqual(result.customMailProviderPool, ['second@example.com', 'third@example.com']);
  assert.equal(result.email, 'second@example.com');
  assert.deepEqual(persistentUpdates.at(-1), {
    customMailProviderPool: ['second@example.com', 'third@example.com'],
  });
  assert.deepEqual(stateUpdates.at(-1), {
    customMailProviderPool: ['second@example.com', 'third@example.com'],
  });
  assert.deepEqual(broadcasts.at(-1), {
    customMailProviderPool: ['second@example.com', 'third@example.com'],
    email: 'second@example.com',
  });
  assert.equal(logs.some((entry) => /已从号池删除 first@example\.com，下轮将使用 second@example\.com/.test(entry.message)), true);
});

test('background derives active custom email pool from structured entries', () => {
  const api = createApi();
  const state = {
    customEmailPoolEntries: [
      { id: 'a', email: 'one@example.com', enabled: true, used: false },
      { id: 'b', email: 'two@example.com', enabled: true, used: true },
      { id: 'c', email: 'three@example.com', enabled: false, used: false },
    ],
  };

  assert.deepEqual(api.getCustomEmailPool(state), ['one@example.com']);
  assert.equal(api.getCustomEmailPoolEmailForRun(state, 1), 'one@example.com');
  assert.equal(api.getCustomEmailPoolEmailForRun(state, 2), '');
});
