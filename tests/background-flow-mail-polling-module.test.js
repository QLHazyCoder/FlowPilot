const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');

function loadFlowMailPollingApi() {
  const source = fs.readFileSync('background/flow-mail-polling.js', 'utf8');
  const globalScope = {};
  new Function('self', `${source}; return self;`)(globalScope);
  return globalScope.MultiPageBackgroundFlowMailPolling;
}

test('flow mail polling service dispatches API mail providers through shared helper', async () => {
  const api = loadFlowMailPollingApi();
  const logs = [];
  let buildCall = null;
  let hotmailCall = null;
  const service = api.createFlowMailPollingService({
    addLog: async (message, level, options) => {
      logs.push({ message, level, options });
    },
    buildVerificationPollPayloadForNode: (nodeId, state, overrides) => {
      buildCall = { nodeId, state, overrides };
      return {
        flowId: state.activeFlowId,
        nodeId,
        step: 4,
        targetEmail: 'user@example.com',
        maxAttempts: 2,
        intervalMs: 100,
        ...overrides,
      };
    },
    getMailConfig: () => ({ provider: 'hotmail-api', label: 'Hotmail' }),
    pollHotmailVerificationCode: async (step, state, payload) => {
      hotmailCall = { step, state, payload };
      return { code: '123456', emailTimestamp: 456 };
    },
  });

  const result = await service.pollFlowVerificationCode({
    flowId: 'kiro',
    nodeId: 'kiro-submit-verification-code',
    state: { activeFlowId: 'kiro', email: 'user@example.com' },
    step: 4,
    filterAfterTimestamp: 123,
    logStepKey: 'kiro-submit-verification-code',
  });

  assert.equal(result.code, '123456');
  assert.equal(buildCall.nodeId, 'kiro-submit-verification-code');
  assert.equal(buildCall.overrides.filterAfterTimestamp, 123);
  assert.equal(hotmailCall.step, 4);
  assert.equal(hotmailCall.payload.filterAfterTimestamp, 123);
  assert.equal(logs.some((entry) => entry.message.includes('Hotmail')), true);
});

test('flow mail polling service prepares browser mail provider sessions and payload timeouts', async () => {
  const api = loadFlowMailPollingApi();
  let ensured2925 = null;
  let mailMessage = null;
  let mailOptions = null;
  const service = api.createFlowMailPollingService({
    addLog: async () => {},
    buildVerificationPollPayloadForNode: () => ({
      flowId: 'kiro',
      nodeId: 'kiro-submit-verification-code',
      step: 4,
      targetEmail: 'user@example.com',
      maxAttempts: 2,
      intervalMs: 100,
    }),
    ensureMail2925MailboxSession: async (options) => {
      ensured2925 = options;
    },
    getMailConfig: () => ({
      provider: '2925',
      source: 'mail-2925',
      label: '2925 邮箱',
    }),
    sendToMailContentScriptResilient: async (_mail, message, options) => {
      mailMessage = message;
      mailOptions = options;
      return { code: '654321', emailTimestamp: 789 };
    },
  });

  const result = await service.pollFlowVerificationCode({
    flowId: 'kiro',
    nodeId: 'kiro-submit-verification-code',
    state: {
      activeFlowId: 'kiro',
      currentMail2925AccountId: 'acct-1',
      mail2925UseAccountPool: true,
      mail2925Accounts: [
        { id: 'acct-1', email: 'pool@example.com' },
      ],
    },
    step: 4,
    logStepKey: 'kiro-submit-verification-code',
  });

  assert.equal(result.code, '654321');
  assert.equal(ensured2925.accountId, 'acct-1');
  assert.equal(ensured2925.expectedMailboxEmail, 'pool@example.com');
  assert.equal(mailMessage.type, 'POLL_EMAIL');
  assert.equal(mailMessage.payload.targetEmail, 'user@example.com');
  assert.equal(mailOptions.logStepKey, 'kiro-submit-verification-code');
  assert.equal(mailOptions.responseTimeoutMs, 45000);
});

test('flow mail polling service lets 2925 limit errors flow through shared recovery', async () => {
  const api = loadFlowMailPollingApi();
  const limitError = new Error('MAIL2925_LIMIT_REACHED::子邮箱已达上限');
  const recoveredError = new Error('switched-account');
  const service = api.createFlowMailPollingService({
    addLog: async () => {},
    buildVerificationPollPayloadForNode: () => ({
      step: 4,
      maxAttempts: 1,
      intervalMs: 100,
    }),
    getMailConfig: () => ({
      provider: '2925',
      source: 'mail-2925',
      label: '2925 邮箱',
    }),
    ensureMail2925MailboxSession: async () => {},
    isMail2925LimitReachedError: (error) => error === limitError,
    handleMail2925LimitReachedError: async (step, error) => {
      assert.equal(step, 4);
      assert.equal(error, limitError);
      return recoveredError;
    },
    sendToMailContentScriptResilient: async () => {
      throw limitError;
    },
  });

  await assert.rejects(
    () => service.pollFlowVerificationCode({
      flowId: 'kiro',
      nodeId: 'kiro-submit-verification-code',
      state: { activeFlowId: 'kiro' },
      step: 4,
    }),
    /switched-account/
  );
});
