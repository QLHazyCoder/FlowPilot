const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');

test('background imports verification flow module', () => {
  const source = fs.readFileSync('background.js', 'utf8');
  assert.match(source, /background\/verification-flow\.js/);
});

test('verification flow module exposes a factory', () => {
  const source = fs.readFileSync('background/verification-flow.js', 'utf8');
  const globalScope = {};

  const api = new Function('self', `${source}; return self.MultiPageBackgroundVerificationFlow;`)(globalScope);

  assert.equal(typeof api?.createVerificationFlowHelpers, 'function');
});

test('verification flow routes YYDS Mail provider to background poller', async () => {
  const source = fs.readFileSync('background/verification-flow.js', 'utf8');
  const globalScope = {};
  const api = new Function('self', `${source}; return self.MultiPageBackgroundVerificationFlow;`)(globalScope);
  const pollCalls = [];
  const helpers = api.createVerificationFlowHelpers({
    addLog: async () => {},
    buildVerificationPollPayload: () => ({ maxAttempts: 1, intervalMs: 1 }),
    getState: async () => ({}),
    getTabId: async () => 1,
    isStopError: () => false,
    pollYydsMailVerificationCode: async (step, state, payload) => {
      pollCalls.push({ step, state, payload });
      return { ok: true, code: '123456', emailTimestamp: 1, mailId: 'msg-1' };
    },
    sendToContentScript: async () => ({}),
    setState: async () => {},
    sleepWithStop: async () => {},
    throwIfStopped: () => {},
    YYDS_MAIL_PROVIDER: 'yyds-mail',
  });

  const result = await helpers.pollFreshVerificationCode(
    4,
    { mailProvider: 'yyds-mail' },
    { provider: 'yyds-mail', label: 'YYDS Mail' },
    { disableTimeBudgetCap: true }
  );

  assert.equal(result.code, '123456');
  assert.equal(pollCalls.length, 1);
  assert.equal(pollCalls[0].step, 4);
  assert.equal(pollCalls[0].payload.maxAttempts, 1);
});

test('verification flow routes custom mail provider to local helper poller', async () => {
  const source = fs.readFileSync('background/verification-flow.js', 'utf8');
  const globalScope = {};
  const api = new Function('self', `${source}; return self.MultiPageBackgroundVerificationFlow;`)(globalScope);
  const pollCalls = [];
  const helpers = api.createVerificationFlowHelpers({
    addLog: async () => {},
    buildVerificationPollPayload: () => ({ maxAttempts: 1, intervalMs: 1, targetEmail: 'target@example.com' }),
    CUSTOM_MAIL_PROVIDER: 'custom',
    getState: async () => ({}),
    getTabId: async () => 1,
    isStopError: () => false,
    pollCustomMailVerificationCode: async (step, state, payload) => {
      pollCalls.push({ step, state, payload });
      return { ok: true, code: '654321', emailTimestamp: 2, mailId: 'custom-msg-1' };
    },
    sendToContentScript: async () => ({}),
    setState: async () => {},
    sleepWithStop: async () => {},
    throwIfStopped: () => {},
  });

  const result = await helpers.pollFreshVerificationCode(
    4,
    { mailProvider: 'custom', email: 'target@example.com' },
    { provider: 'custom', label: '自定义邮箱' },
    { disableTimeBudgetCap: true }
  );

  assert.equal(result.code, '654321');
  assert.equal(pollCalls.length, 1);
  assert.equal(pollCalls[0].step, 4);
  assert.equal(pollCalls[0].payload.targetEmail, 'target@example.com');
});
