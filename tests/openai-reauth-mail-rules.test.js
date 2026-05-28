'use strict';

const assert = require('node:assert');
const test = require('node:test');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');

const MAIL_RULES_PATH = path.join(__dirname, '..', 'flows', 'openai-reauth', 'mail-rules.js');

function loadMailRulesModule() {
  const source = fs.readFileSync(MAIL_RULES_PATH, 'utf-8');
  const sandbox = { self: {}, globalThis: {} };
  vm.createContext(sandbox);
  vm.runInContext(source, sandbox);
  return sandbox.self.MultiPageOpenAiReauthMailRules;
}

test('createOpenAiReauthMailRules 暴露统一接口', () => {
  const mod = loadMailRulesModule();
  const rules = mod.createOpenAiReauthMailRules({});
  assert.equal(typeof rules.buildVerificationPollPayload, 'function');
  assert.equal(typeof rules.buildVerificationPollPayloadForNode, 'function');
  assert.equal(typeof rules.getRuleDefinition, 'function');
  assert.equal(typeof rules.getRuleDefinitionForNode, 'function');
});

test('getRuleDefinitionForNode 仅识别 fetch-reauth-code', () => {
  const mod = loadMailRulesModule();
  const rules = mod.createOpenAiReauthMailRules({});
  const ok = rules.getRuleDefinitionForNode('fetch-reauth-code', { reauthEmail: 'a@b.com' });
  assert.ok(ok);
  assert.equal(ok.flowId, 'openai-reauth');
  assert.equal(ok.ruleId, 'openai-reauth-code');
  assert.equal(ok.nodeId, 'fetch-reauth-code');
  assert.equal(ok.step, 3);
  assert.equal(ok.targetEmail, 'a@b.com');

  assert.equal(rules.getRuleDefinitionForNode('fetch-signup-code', { email: 'x@y.com' }), null);
  assert.equal(rules.getRuleDefinitionForNode('fetch-login-code', { email: 'x@y.com' }), null);
  assert.equal(rules.getRuleDefinitionForNode('', { email: 'x@y.com' }), null);
});

test('targetEmail 优先 reauthEmail，缺失时 fallback 到 email', () => {
  const mod = loadMailRulesModule();
  const rules = mod.createOpenAiReauthMailRules({});
  const a = rules.getRuleDefinitionForNode('fetch-reauth-code', { reauthEmail: 'r@x.com', email: 'fallback@x.com' });
  assert.equal(a.targetEmail, 'r@x.com');
  const b = rules.getRuleDefinitionForNode('fetch-reauth-code', { email: 'only@x.com' });
  assert.equal(b.targetEmail, 'only@x.com');
});

test('targetEmailHints 包含原始邮箱与 username=domain 形式', () => {
  const mod = loadMailRulesModule();
  const rules = mod.createOpenAiReauthMailRules({});
  const result = rules.getRuleDefinitionForNode('fetch-reauth-code', { reauthEmail: 'foo@2925.com' });
  assert.deepEqual(result.targetEmailHints, ['foo@2925.com', 'foo=2925.com']);
});

test('mail2925 provider 切换到长间隔与多次重试', () => {
  const mod = loadMailRulesModule();
  const rules = mod.createOpenAiReauthMailRules({
    MAIL_2925_VERIFICATION_INTERVAL_MS: 15000,
    MAIL_2925_VERIFICATION_MAX_ATTEMPTS: 15,
  });
  const result = rules.getRuleDefinitionForNode('fetch-reauth-code', {
    reauthEmail: 'r@2925.com',
    mailProvider: '2925',
    mail2925Mode: 'receive',
  });
  assert.equal(result.maxAttempts, 15);
  assert.equal(result.intervalMs, 15000);
  assert.equal(result.mail2925MatchTargetEmail, true);
  assert.equal(result.filterAfterTimestamp, 0);
});

test('非 2925 provider 使用默认短间隔与 5 次重试', () => {
  const mod = loadMailRulesModule();
  const rules = mod.createOpenAiReauthMailRules({});
  const result = rules.getRuleDefinitionForNode('fetch-reauth-code', {
    reauthEmail: 'r@hotmail.com',
    mailProvider: 'hotmail-api',
  });
  assert.equal(result.maxAttempts, 5);
  assert.equal(result.intervalMs, 3000);
  assert.equal(result.mail2925MatchTargetEmail, false);
});

test('hotmail provider 使用 timestamp dep 提供的 filter', () => {
  const mod = loadMailRulesModule();
  let receivedStep = null;
  let receivedState = null;
  const rules = mod.createOpenAiReauthMailRules({
    getHotmailVerificationRequestTimestamp: (step, state) => {
      receivedStep = step;
      receivedState = state;
      return 1779999999999;
    },
  });
  const result = rules.getRuleDefinitionForNode('fetch-reauth-code', {
    reauthEmail: 'r@hotmail.com',
    mailProvider: 'hotmail-api',
  });
  assert.equal(receivedStep, 3);
  assert.equal(receivedState.reauthEmail, 'r@hotmail.com');
  assert.equal(result.filterAfterTimestamp, 1779999999999);
});

test('buildVerificationPollPayloadForNode 合并 overrides', () => {
  const mod = loadMailRulesModule();
  const rules = mod.createOpenAiReauthMailRules({});
  const result = rules.buildVerificationPollPayloadForNode(
    'fetch-reauth-code',
    { reauthEmail: 'a@b.com' },
    { filterAfterTimestamp: 12345 }
  );
  assert.equal(result.filterAfterTimestamp, 12345);
  assert.equal(result.targetEmail, 'a@b.com');
});

test('buildVerificationPollPayloadForNode 拒绝未知 nodeId', () => {
  const mod = loadMailRulesModule();
  const rules = mod.createOpenAiReauthMailRules({});
  assert.equal(
    rules.buildVerificationPollPayloadForNode('fetch-login-code', { email: 'x@y.com' }),
    null
  );
});
