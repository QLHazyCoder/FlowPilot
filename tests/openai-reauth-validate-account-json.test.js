'use strict';

const assert = require('node:assert');
const test = require('node:test');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');

const VALIDATOR_PATH = path.join(__dirname, '..', 'flows', 'openai-reauth', 'reauth-account-validator.js');

function loadValidatorModule() {
  const source = fs.readFileSync(VALIDATOR_PATH, 'utf-8');
  const sandbox = { self: {}, globalThis: {} };
  vm.createContext(sandbox);
  vm.runInContext(source, sandbox);
  return sandbox.self.MultiPageOpenAiReauthAccountValidator;
}

test('SUPPORTED_MAIL_PROVIDERS 暴露 7 个 provider', () => {
  const mod = loadValidatorModule();
  assert.deepEqual([...mod.SUPPORTED_MAIL_PROVIDERS].sort(), [
    '2925',
    'cloudflare-temp-email',
    'cloudmail',
    'hotmail-api',
    'icloud',
    'luckmail-api',
    'yyds-mail',
  ]);
});

test('parseAccountsFromJson 空文本返回错误', () => {
  const mod = loadValidatorModule();
  const r = mod.parseAccountsFromJson('');
  assert.equal(r.ok, false);
  assert.match(r.error, /请粘贴/);
});

test('parseAccountsFromJson 非法 JSON', () => {
  const mod = loadValidatorModule();
  assert.equal(mod.parseAccountsFromJson('{not json').ok, false);
});

test('parseAccountsFromJson 非对象/数组拒绝', () => {
  const mod = loadValidatorModule();
  assert.equal(mod.parseAccountsFromJson('"str"').ok, false);
  assert.equal(mod.parseAccountsFromJson('42').ok, false);
  assert.equal(mod.parseAccountsFromJson('null').ok, false);
});

test('parseAccountsFromJson 单账号对象', () => {
  const mod = loadValidatorModule();
  const r = mod.parseAccountsFromJson(JSON.stringify({
    credentials: { email: 'a@b.com' },
  }));
  assert.equal(r.ok, true);
  assert.equal(r.accounts.length, 1);
  assert.equal(r.accounts[0].email, 'a@b.com');
  assert.equal(r.accounts[0].index, 0);
});

test('parseAccountsFromJson sub2api 整文件 - 3 个账号', () => {
  const mod = loadValidatorModule();
  const r = mod.parseAccountsFromJson(JSON.stringify({
    exported_at: '2026-05-28T07:52:21Z',
    proxies: [],
    accounts: [
      { name: 'a@2925.com', credentials: { email: 'a@2925.com' } },
      { name: 'b@2925.com', credentials: { email: 'b@2925.com' } },
      { name: 'c@2925.com', credentials: { email: 'c@2925.com' } },
    ],
  }));
  assert.equal(r.ok, true);
  assert.equal(r.accounts.length, 3);
  assert.equal(r.accounts[0].email, 'a@2925.com');
  assert.equal(r.accounts[1].email, 'b@2925.com');
  assert.equal(r.accounts[2].email, 'c@2925.com');
});

test('parseAccountsFromJson accounts 是数组（无 wrapper）', () => {
  const mod = loadValidatorModule();
  const r = mod.parseAccountsFromJson(JSON.stringify([
    { credentials: { email: 'x@y.com' } },
  ]));
  assert.equal(r.ok, true);
  assert.equal(r.accounts.length, 1);
});

test('parseAccountsFromJson accounts 数组为空时拒绝', () => {
  const mod = loadValidatorModule();
  const r = mod.parseAccountsFromJson(JSON.stringify({ accounts: [] }));
  assert.equal(r.ok, false);
  assert.match(r.error, /列表为空/);
});

test('parseAccountsFromJson 某个 account 缺 email 时报错并指明 index', () => {
  const mod = loadValidatorModule();
  const r = mod.parseAccountsFromJson(JSON.stringify({
    accounts: [
      { credentials: { email: 'a@b.com' } },
      { credentials: {} },
    ],
  }));
  assert.equal(r.ok, false);
  assert.match(r.error, /accounts\[1\]/);
  assert.match(r.error, /email/);
});

test('parseAccountsFromJson email 格式非法时报错', () => {
  const mod = loadValidatorModule();
  const r = mod.parseAccountsFromJson(JSON.stringify({
    accounts: [{ credentials: { email: 'not-email' } }],
  }));
  assert.equal(r.ok, false);
  assert.match(r.error, /格式无效/);
});

test('parseAccountsFromJson 兼容 email 在顶层 / name 字段', () => {
  const mod = loadValidatorModule();
  const r1 = mod.parseAccountsFromJson(JSON.stringify({ accounts: [{ email: 'top@x.com' }] }));
  assert.equal(r1.accounts[0].email, 'top@x.com');
  const r2 = mod.parseAccountsFromJson(JSON.stringify({ accounts: [{ name: 'name@x.com' }] }));
  assert.equal(r2.accounts[0].email, 'name@x.com');
});

test('buildResolvedAccount 注入 mailProvider', () => {
  const mod = loadValidatorModule();
  const original = {
    name: 'a@2925.com',
    platform: 'openai',
    credentials: { email: 'a@2925.com', refresh_token: 'old' },
    concurrency: 3,
  };
  const resolved = mod.buildResolvedAccount(original, '2925');
  assert.equal(resolved.mailProvider, '2925');
  assert.equal(resolved.concurrency, 3);
  assert.equal(resolved.credentials.refresh_token, 'old');
});

test('buildResolvedAccount 拒绝空 provider', () => {
  const mod = loadValidatorModule();
  assert.throws(
    () => mod.buildResolvedAccount({ credentials: { email: 'a@b.com' } }, ''),
    /mailProvider/
  );
});

test('buildResolvedAccount 不修改原对象（不可变）', () => {
  const mod = loadValidatorModule();
  const original = { credentials: { email: 'a@b.com' } };
  const resolved = mod.buildResolvedAccount(original, 'hotmail-api');
  assert.equal(original.mailProvider, undefined);
  assert.equal(resolved.mailProvider, 'hotmail-api');
});

test('extractAccountEmail 优先级：credentials.email > email > name', () => {
  const mod = loadValidatorModule();
  assert.equal(mod.extractAccountEmail({ credentials: { email: 'c@x.com' }, email: 'e@x.com', name: 'n@x.com' }), 'c@x.com');
  assert.equal(mod.extractAccountEmail({ email: 'e@x.com', name: 'n@x.com' }), 'e@x.com');
  assert.equal(mod.extractAccountEmail({ name: 'n@x.com' }), 'n@x.com');
  assert.equal(mod.extractAccountEmail({}), '');
});
