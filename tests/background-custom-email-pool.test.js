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
  extractFunction('normalizeCustomEmailPoolEntryObjects'),
  extractFunction('getCustomEmailPool'),
  extractFunction('getCustomEmailPoolEmailForRun'),
  extractFunction('getNextCustomEmailPoolEmail'),
  extractFunction('getEmailGeneratorLabel'),
].join('\n');

const poolBundle = [
  extractFunction('normalizeCustomEmailPoolEntryObjects'),
  extractFunction('getCustomEmailPool'),
  extractFunction('getNextCustomEmailPoolEmail'),
].join('\n');

function createPoolApi() {
  return new Function(`
${poolBundle}

return {
  getNextCustomEmailPoolEmail,
};
`)();
}

function createApi() {
  return new Function(`
const CUSTOM_EMAIL_POOL_GENERATOR = 'custom-pool';
const CLOUDFLARE_TEMP_EMAIL_GENERATOR = 'cloudflare-temp-email';

${bundle}

return {
  normalizeEmailGenerator,
  getCustomEmailPool,
  getCustomEmailPoolEmailForRun,
  getNextCustomEmailPoolEmail,
  getEmailGeneratorLabel,
};
`)();
}

test('background recognizes custom email pool generator and label', () => {
  const api = createApi();

  assert.equal(api.normalizeEmailGenerator('custom-pool'), 'custom-pool');
  assert.equal(api.getEmailGeneratorLabel('custom-pool'), '自定义邮箱池');
});

test('background selects the matching email for the current auto-run round', () => {
  const api = createApi();
  const state = {
    customEmailPoolEntries: [
      { id: 'a', email: 'first@example.com', enabled: true, used: false },
      { id: 'b', email: 'second@example.com', enabled: true, used: false },
      { id: 'c', email: 'third@example.com', enabled: true, used: false },
    ],
  };

  assert.equal(api.getCustomEmailPoolEmailForRun(state, 1), 'first@example.com');
  assert.equal(api.getCustomEmailPoolEmailForRun(state, 2), 'second@example.com');
  assert.equal(api.getCustomEmailPoolEmailForRun(state, 4), '');
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


test('background selects the first enabled unused email after previous entries become used', () => {
  const api = createPoolApi();
  const state = {
    customEmailPoolEntries: [
      { id: 'a', email: 'first@example.com', enabled: true, used: true },
      { id: 'b', email: 'second@example.com', enabled: true, used: false },
      { id: 'c', email: 'third@example.com', enabled: true, used: false },
    ],
  };

  assert.equal(api.getNextCustomEmailPoolEmail(state), 'second@example.com');

  state.customEmailPoolEntries[1].used = true;
  assert.equal(api.getNextCustomEmailPoolEmail(state), 'third@example.com');

  state.customEmailPoolEntries[2].used = true;
  assert.equal(api.getNextCustomEmailPoolEmail(state), '');
});

test('background marks the current custom email pool entry as used', async () => {
  const bundle = [
    extractFunction('normalizeCustomEmailPoolEntryObjects'),
    extractFunction('getCustomEmailPoolEntries'),
    extractFunction('isCustomEmailPoolGenerator'),
    extractFunction('markCurrentCustomEmailPoolEntryUsed'),
  ].join('\n');

  const api = new Function(`
const CUSTOM_EMAIL_POOL_GENERATOR = 'custom-pool';
const writes = [];
function normalizeEmailGenerator(value) {
  return String(value || '').trim().toLowerCase();
}
function isCustomMailProvider(state) {
  return String(state?.mailProvider || '').trim().toLowerCase() === 'custom';
}
async function setPersistentSettings(payload) {
  writes.push({ type: 'persistent', payload });
}
async function setState(payload) {
  writes.push({ type: 'state', payload });
}
function broadcastDataUpdate(payload) {
  writes.push({ type: 'broadcast', payload });
}
async function addLog() {}

${bundle}

return {
  markCurrentCustomEmailPoolEntryUsed,
  writes,
};
`)();

  const result = await api.markCurrentCustomEmailPoolEntryUsed({
    mailProvider: 'custom',
    email: 'first@example.com',
    customEmailPoolEntries: [
      { id: 'a', email: 'first@example.com', enabled: true, used: false },
      { id: 'b', email: 'second@example.com', enabled: true, used: false },
    ],
  }, {
    logPrefix: '第 1/2 轮检测到 account_deactivated，自定义邮箱池',
    level: 'warn',
  });

  assert.equal(result.updated, true);
  assert.equal(result.customEmailPoolEntries[0].used, true);
  assert.ok(result.customEmailPoolEntries[0].lastUsedAt > 0);
  assert.equal(result.customEmailPoolEntries[1].used, false);
  assert.deepEqual(api.writes.map((entry) => entry.type), ['persistent', 'state', 'broadcast']);
});
