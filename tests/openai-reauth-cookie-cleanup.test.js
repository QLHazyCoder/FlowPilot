'use strict';

const assert = require('node:assert');
const test = require('node:test');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');

const COOKIE_CLEANUP_PATH = path.join(__dirname, '..', 'flows', 'openai-reauth', 'background', 'cookie-cleanup.js');

function loadCookieCleanupModule() {
  const source = fs.readFileSync(COOKIE_CLEANUP_PATH, 'utf-8');
  const sandbox = { self: {}, globalThis: {}, console };
  vm.createContext(sandbox);
  vm.runInContext(source, sandbox);
  return sandbox.self.MultiPageOpenAiReauthCookieCleanup;
}

function buildFakeChromeApi(cookies, options = {}) {
  const removeCalls = [];
  return {
    removeCalls,
    chromeApi: {
      cookies: {
        getAllCookieStores: async () => options.stores || [{ id: '0' }],
        getAll: async (query) => cookies.filter((c) =>
          (!query.storeId || c.storeId === query.storeId)
          && (!query.domain || c.domain === query.domain || c.domain === `.${query.domain}`)
        ),
        remove: async (details) => {
          removeCalls.push(details);
          if (options.removeFails && options.removeFails.has(details.name)) {
            throw new Error(`mock remove failure for ${details.name}`);
          }
          return { name: details.name, url: details.url };
        },
      },
    },
  };
}

test('REAUTH_COOKIE_CLEAR_DOMAINS 包含 6 个目标 domain', () => {
  const mod = loadCookieCleanupModule();
  assert.deepEqual(
    [...mod.REAUTH_COOKIE_CLEAR_DOMAINS].sort(),
    [
      'accounts.openai.com',
      'auth.openai.com',
      'auth0.openai.com',
      'chat.openai.com',
      'chatgpt.com',
      'openai.com',
    ]
  );
});

test('clearOpenAiAuthCookies 收集并删除目标 domain 的 cookie', async () => {
  const mod = loadCookieCleanupModule();
  const fake = buildFakeChromeApi([
    { name: 'session', domain: '.openai.com', path: '/', storeId: '0' },
    { name: 'auth_token', domain: 'auth.openai.com', path: '/', storeId: '0' },
    { name: 'cf_token', domain: 'chatgpt.com', path: '/', storeId: '0' },
    { name: 'unrelated', domain: 'google.com', path: '/', storeId: '0' },
  ]);
  const result = await mod.clearOpenAiAuthCookies({ chromeApi: fake.chromeApi });
  assert.equal(result.collected, 3);
  assert.equal(result.removed, 3);
  assert.equal(fake.removeCalls.length, 3);
  for (const call of fake.removeCalls) {
    assert.match(call.url, /^https:\/\/(chatgpt\.com|auth\.openai\.com|openai\.com)\/$/);
  }
  assert.equal(fake.removeCalls.find((c) => c.name === 'unrelated'), undefined);
});

test('clearOpenAiAuthCookies 跨 storeId 不重复', async () => {
  const mod = loadCookieCleanupModule();
  const fake = buildFakeChromeApi(
    [
      { name: 'a', domain: 'auth.openai.com', path: '/', storeId: '0' },
      { name: 'a', domain: 'auth.openai.com', path: '/', storeId: '1' },
    ],
    { stores: [{ id: '0' }, { id: '1' }] }
  );
  const result = await mod.clearOpenAiAuthCookies({ chromeApi: fake.chromeApi });
  assert.equal(result.collected, 2);
  assert.equal(result.removed, 2);
});

test('clearOpenAiAuthCookies 部分失败时不影响其他 cookie', async () => {
  const mod = loadCookieCleanupModule();
  const fake = buildFakeChromeApi(
    [
      { name: 'good', domain: 'auth.openai.com', path: '/', storeId: '0' },
      { name: 'bad', domain: 'auth.openai.com', path: '/', storeId: '0' },
    ],
    { removeFails: new Set(['bad']) }
  );
  const result = await mod.clearOpenAiAuthCookies({ chromeApi: fake.chromeApi });
  assert.equal(result.collected, 2);
  assert.equal(result.removed, 1);
});

test('clearOpenAiAuthCookies 在 chromeApi 缺失时安全返回', async () => {
  const mod = loadCookieCleanupModule();
  const result = await mod.clearOpenAiAuthCookies({});
  assert.deepEqual(result, { collected: 0, removed: 0 });
});

test('clearOpenAiAuthCookies 保留 partitionKey', async () => {
  const mod = loadCookieCleanupModule();
  const fake = buildFakeChromeApi([
    { name: 'p', domain: 'auth.openai.com', path: '/', storeId: '0', partitionKey: { topLevelSite: 'https://chatgpt.com' } },
  ]);
  await mod.clearOpenAiAuthCookies({ chromeApi: fake.chromeApi });
  assert.deepEqual(fake.removeCalls[0].partitionKey, { topLevelSite: 'https://chatgpt.com' });
});
