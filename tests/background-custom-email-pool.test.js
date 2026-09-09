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
