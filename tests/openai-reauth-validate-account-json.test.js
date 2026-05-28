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

test('空文本返回错误', () => {
  const mod = loadValidatorModule();
  const result = mod.validateReauthAccountJson('');
  assert.equal(result.ok, false);
  assert.match(result.error, /请粘贴/);
});

test('空白字符返回错误', () => {
  const mod = loadValidatorModule();
  const result = mod.validateReauthAccountJson('   \n\t  ');
  assert.equal(result.ok, false);
});

test('非法 JSON 返回错误', () => {
  const mod = loadValidatorModule();
  const result = mod.validateReauthAccountJson('{not json');
  assert.equal(result.ok, false);
  assert.match(result.error, /JSON 解析失败/);
});

test('非对象 JSON 返回错误', () => {
  const mod = loadValidatorModule();
  assert.equal(mod.validateReauthAccountJson('[1,2,3]').ok, false);
  assert.equal(mod.validateReauthAccountJson('"a string"').ok, false);
  assert.equal(mod.validateReauthAccountJson('null').ok, false);
  assert.equal(mod.validateReauthAccountJson('42').ok, false);
});

test('缺少 email 返回错误', () => {
  const mod = loadValidatorModule();
  const result = mod.validateReauthAccountJson(JSON.stringify({
    mailProvider: '2925',
    credentials: {},
  }));
  assert.equal(result.ok, false);
  assert.match(result.error, /email/);
});

test('email 格式不合法返回错误', () => {
  const mod = loadValidatorModule();
  const result = mod.validateReauthAccountJson(JSON.stringify({
    mailProvider: '2925',
    credentials: { email: 'not-an-email' },
  }));
  assert.equal(result.ok, false);
  assert.match(result.error, /合法地址/);
});

test('缺少 mailProvider 返回错误', () => {
  const mod = loadValidatorModule();
  const result = mod.validateReauthAccountJson(JSON.stringify({
    credentials: { email: 'a@b.com' },
  }));
  assert.equal(result.ok, false);
  assert.match(result.error, /mailProvider/);
});

test('mailProvider 是空字符串返回错误', () => {
  const mod = loadValidatorModule();
  const result = mod.validateReauthAccountJson(JSON.stringify({
    mailProvider: '   ',
    credentials: { email: 'a@b.com' },
  }));
  assert.equal(result.ok, false);
});

test('credentials.email 路径成功', () => {
  const mod = loadValidatorModule();
  const result = mod.validateReauthAccountJson(JSON.stringify({
    mailProvider: '2925',
    credentials: { email: 'foo@2925.com' },
    name: 'foo@2925.com',
  }));
  assert.equal(result.ok, true);
  assert.equal(result.email, 'foo@2925.com');
  assert.equal(result.mailProvider, '2925');
});

test('email 字段在顶层时也能识别', () => {
  const mod = loadValidatorModule();
  const result = mod.validateReauthAccountJson(JSON.stringify({
    mailProvider: 'hotmail-api',
    email: 'top@hotmail.com',
  }));
  assert.equal(result.ok, true);
  assert.equal(result.email, 'top@hotmail.com');
  assert.equal(result.mailProvider, 'hotmail-api');
});

test('name 字段作为 fallback 邮箱', () => {
  const mod = loadValidatorModule();
  const result = mod.validateReauthAccountJson(JSON.stringify({
    mailProvider: 'icloud',
    name: 'fallback@icloud.com',
  }));
  assert.equal(result.ok, true);
  assert.equal(result.email, 'fallback@icloud.com');
});

test('保留原始 account 对象供后续使用', () => {
  const mod = loadValidatorModule();
  const original = {
    mailProvider: '2925',
    name: 'a@2925.com',
    platform: 'openai',
    type: 'oauth',
    credentials: { email: 'a@2925.com', refresh_token: 'old' },
    extra: { email: 'a@2925.com' },
    concurrency: 3,
  };
  const result = mod.validateReauthAccountJson(JSON.stringify(original));
  assert.equal(result.ok, true);
  assert.deepEqual(result.account, original);
});

test('email 大小写按原样保留（不强制小写）', () => {
  const mod = loadValidatorModule();
  const result = mod.validateReauthAccountJson(JSON.stringify({
    mailProvider: '2925',
    credentials: { email: 'Mixed.Case@Example.Com' },
  }));
  assert.equal(result.ok, true);
  assert.equal(result.email, 'Mixed.Case@Example.Com');
});
