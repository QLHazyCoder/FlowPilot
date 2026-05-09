const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');

const source = fs.readFileSync('background/verification-flow.js', 'utf8');
const globalScope = {};
const api = new Function('self', `${source}; return self.MultiPageBackgroundVerificationFlow;`)(globalScope);

function createVerificationFlowTestHelpers(overrides = {}) {
  return api.createVerificationFlowHelpers({
    addLog: async () => {},
    chrome: {
      tabs: {
        update: async () => {},
        remove: async () => {},
      },
    },
    CLOUDFLARE_TEMP_EMAIL_PROVIDER: 'cloudflare-temp-email',
    CLOUD_MAIL_PROVIDER: 'cloudmail',
    completeStepFromBackground: async () => {},
    confirmCustomVerificationStepBypassRequest: async () => ({ confirmed: true }),
    getHotmailVerificationPollConfig: () => ({}),
    getHotmailVerificationRequestTimestamp: () => 0,
    getState: async () => ({}),
    getTabId: async () => 1,
    HOTMAIL_PROVIDER: 'hotmail-api',
    isStopError: () => false,
    LUCKMAIL_PROVIDER: 'luckmail-api',
    MAIL_2925_VERIFICATION_INTERVAL_MS: 15000,
    MAIL_2925_VERIFICATION_MAX_ATTEMPTS: 15,
    pollCloudflareTempEmailVerificationCode: async () => ({}),
    pollCloudMailVerificationCode: async () => ({}),
    pollHotmailVerificationCode: async () => ({}),
    pollLuckmailVerificationCode: async () => ({}),
    sendToContentScript: async () => ({}),
    sendToMailContentScriptResilient: async () => ({}),
    setState: async () => {},
    setStepStatus: async () => {},
    sleepWithStop: async () => {},
    throwIfStopped: () => {},
    VERIFICATION_POLL_MAX_ROUNDS: 5,
    ...overrides,
  });
}

test('verification flow keeps 2925 polling cadence in the default payload', () => {
  const helpers = api.createVerificationFlowHelpers({
    addLog: async () => {},
    chrome: { tabs: { update: async () => {} } },
    CLOUDFLARE_TEMP_EMAIL_PROVIDER: 'cloudflare-temp-email',
    completeStepFromBackground: async () => {},
    confirmCustomVerificationStepBypassRequest: async () => ({ confirmed: true }),
    getHotmailVerificationPollConfig: () => ({}),
    getHotmailVerificationRequestTimestamp: () => 0,
    getState: async () => ({}),
    getTabId: async () => 1,
    HOTMAIL_PROVIDER: 'hotmail-api',
    isStopError: () => false,
    LUCKMAIL_PROVIDER: 'luckmail-api',
    MAIL_2925_VERIFICATION_INTERVAL_MS: 15000,
    MAIL_2925_VERIFICATION_MAX_ATTEMPTS: 15,
    pollCloudflareTempEmailVerificationCode: async () => ({}),
    pollHotmailVerificationCode: async () => ({}),
    pollLuckmailVerificationCode: async () => ({}),
    sendToContentScript: async () => ({}),
    sendToMailContentScriptResilient: async () => ({}),
    setState: async () => {},
    setStepStatus: async () => {},
    sleepWithStop: async () => {},
    throwIfStopped: () => {},
    VERIFICATION_POLL_MAX_ROUNDS: 5,
  });

  const step4Payload = helpers.getVerificationPollPayload(4, { email: 'user@example.com', mailProvider: '2925' });
  const step8Payload = helpers.getVerificationPollPayload(8, { email: 'user@example.com', mailProvider: '2925' });

  assert.equal(step4Payload.maxAttempts, 15);
  assert.equal(step4Payload.intervalMs, 15000);
  assert.equal(step8Payload.maxAttempts, 15);
  assert.equal(step8Payload.intervalMs, 15000);
});

test('verification flow keeps iCloud step 4 polling at least five attempts under a short remaining budget', async () => {
  const pollRequests = [];
  const helpers = createVerificationFlowTestHelpers({
    sendToMailContentScriptResilient: async (_mail, message, options = {}) => {
      pollRequests.push({ payload: message.payload, options });
      return {};
    },
  });

  await assert.rejects(
    helpers.pollFreshVerificationCode(
      4,
      { email: 'user@example.com', mailProvider: 'icloud', lastSignupCode: null },
      { source: 'icloud-mail', provider: 'icloud', label: 'iCloud 邮箱' },
      {
        filterAfterTimestamp: 123456,
        getRemainingTimeMs: async () => 3000,
        maxResendRequests: 0,
      }
    ),
    /邮箱轮询结束|无法获取/
  );

  assert.equal(pollRequests.length, 1);
  const [{ payload, options }] = pollRequests;
  assert.equal(payload.maxAttempts >= 5, true);
  assert.equal(payload.intervalMs >= 3000, true);
  assert.equal(options.responseTimeoutMs >= (payload.maxAttempts * payload.intervalMs) + 10000, true);
});

test('verification flow keeps iCloud step 8 polling at least five attempts before no-code failure', async () => {
  const pollRequests = [];
  const helpers = createVerificationFlowTestHelpers({
    sendToMailContentScriptResilient: async (_mail, message, options = {}) => {
      pollRequests.push({ payload: message.payload, options });
      return {};
    },
  });

  await assert.rejects(
    helpers.pollFreshVerificationCodeWithResendInterval(
      8,
      { email: 'user@example.com', mailProvider: 'icloud', lastLoginCode: null },
      { source: 'icloud-mail', provider: 'icloud', label: 'iCloud 邮箱' },
      {
        filterAfterTimestamp: 123456,
        getRemainingTimeMs: async () => 3000,
        maxResendRequests: 0,
        resendIntervalMs: 25000,
      }
    ),
    /空轮询循环|停止当前链路/
  );

  assert.equal(pollRequests.length >= 1, true);
  assert.equal(pollRequests.every(({ payload }) => payload.maxAttempts >= 5), true);
  assert.equal(
    pollRequests.every(({ payload, options }) => options.responseTimeoutMs >= (payload.maxAttempts * payload.intervalMs) + 10000),
    true
  );
});

test('verification flow only enables 2925 target email matching in receive mode', () => {
  const helpers = api.createVerificationFlowHelpers({
    addLog: async () => {},
    chrome: { tabs: { update: async () => {} } },
    CLOUDFLARE_TEMP_EMAIL_PROVIDER: 'cloudflare-temp-email',
    completeStepFromBackground: async () => {},
    confirmCustomVerificationStepBypassRequest: async () => ({ confirmed: true }),
    getHotmailVerificationPollConfig: () => ({}),
    getHotmailVerificationRequestTimestamp: () => 0,
    getState: async () => ({}),
    getTabId: async () => 1,
    HOTMAIL_PROVIDER: 'hotmail-api',
    isStopError: () => false,
    LUCKMAIL_PROVIDER: 'luckmail-api',
    MAIL_2925_VERIFICATION_INTERVAL_MS: 15000,
    MAIL_2925_VERIFICATION_MAX_ATTEMPTS: 15,
    pollCloudflareTempEmailVerificationCode: async () => ({}),
    pollHotmailVerificationCode: async () => ({}),
    pollLuckmailVerificationCode: async () => ({}),
    sendToContentScript: async () => ({}),
    sendToMailContentScriptResilient: async () => ({}),
    setState: async () => {},
    setStepStatus: async () => {},
    sleepWithStop: async () => {},
    throwIfStopped: () => {},
    VERIFICATION_POLL_MAX_ROUNDS: 5,
  });

  const providePayload = helpers.getVerificationPollPayload(4, {
    email: 'user@example.com',
    mailProvider: '2925',
    mail2925Mode: 'provide',
  });
  const receivePayload = helpers.getVerificationPollPayload(4, {
    email: 'user@example.com',
    mailProvider: '2925',
    mail2925Mode: 'receive',
  });

  assert.equal(providePayload.mail2925MatchTargetEmail, false);
  assert.equal(receivePayload.mail2925MatchTargetEmail, true);
});

test('verification flow runs beforeSubmit hook before filling the code', async () => {
  const events = [];

  const helpers = api.createVerificationFlowHelpers({
    addLog: async () => {},
    chrome: {
      tabs: {
        update: async () => {},
      },
    },
    CLOUDFLARE_TEMP_EMAIL_PROVIDER: 'cloudflare-temp-email',
    completeStepFromBackground: async (_step, payload) => {
      events.push(['complete', payload.code]);
    },
    confirmCustomVerificationStepBypassRequest: async () => ({ confirmed: true }),
    getHotmailVerificationPollConfig: () => ({}),
    getHotmailVerificationRequestTimestamp: () => 0,
    getState: async () => ({}),
    getTabId: async () => 1,
    HOTMAIL_PROVIDER: 'hotmail-api',
    isStopError: () => false,
    LUCKMAIL_PROVIDER: 'luckmail-api',
    MAIL_2925_VERIFICATION_INTERVAL_MS: 15000,
    MAIL_2925_VERIFICATION_MAX_ATTEMPTS: 15,
    pollCloudflareTempEmailVerificationCode: async () => ({}),
    pollHotmailVerificationCode: async () => ({}),
    pollLuckmailVerificationCode: async () => ({}),
    sendToContentScript: async (_source, message) => {
      if (message.type === 'FILL_CODE') {
        events.push(['submit', message.payload.code]);
        return {};
      }
      return {};
    },
    sendToMailContentScriptResilient: async () => ({
      code: '654321',
      emailTimestamp: 123,
    }),
    setState: async (payload) => {
      events.push(['state', payload.lastLoginCode || payload.lastSignupCode]);
    },
    setStepStatus: async () => {},
    sleepWithStop: async () => {},
    throwIfStopped: () => {},
    VERIFICATION_POLL_MAX_ROUNDS: 5,
  });

  await helpers.resolveVerificationStep(
    7,
    { email: 'user@example.com', lastLoginCode: null },
    { provider: 'qq', label: 'QQ 邮箱' },
    {
      beforeSubmit: async (result) => {
        events.push(['beforeSubmit', result.code]);
      },
    }
  );

  assert.deepStrictEqual(events, [
    ['beforeSubmit', '654321'],
    ['submit', '654321'],
    ['state', '654321'],
    ['complete', '654321'],
  ]);
});

test('verification flow skips 2925 mailbox preclear when using a fixed login mail window and still clears after success', async () => {
  const mailMessages = [];

  const helpers = api.createVerificationFlowHelpers({
    addLog: async () => {},
    chrome: {
      tabs: {
        update: async () => {},
      },
    },
    CLOUDFLARE_TEMP_EMAIL_PROVIDER: 'cloudflare-temp-email',
    completeStepFromBackground: async () => {},
    confirmCustomVerificationStepBypassRequest: async () => ({ confirmed: true }),
    getHotmailVerificationPollConfig: () => ({}),
    getHotmailVerificationRequestTimestamp: () => 0,
    getState: async () => ({}),
    getTabId: async () => 1,
    HOTMAIL_PROVIDER: 'hotmail-api',
    isStopError: () => false,
    LUCKMAIL_PROVIDER: 'luckmail-api',
    MAIL_2925_VERIFICATION_INTERVAL_MS: 15000,
    MAIL_2925_VERIFICATION_MAX_ATTEMPTS: 15,
    pollCloudflareTempEmailVerificationCode: async () => ({}),
    pollHotmailVerificationCode: async () => ({}),
    pollLuckmailVerificationCode: async () => ({}),
    sendToContentScript: async (_source, message) => {
      if (message.type === 'FILL_CODE') {
        return {};
      }
      return {};
    },
    sendToMailContentScriptResilient: async (_mail, message) => {
      mailMessages.push(message.type);
      if (message.type === 'POLL_EMAIL') {
        return { code: '654321', emailTimestamp: 123 };
      }
      return { ok: true };
    },
    setState: async () => {},
    setStepStatus: async () => {},
    sleepWithStop: async () => {},
    throwIfStopped: () => {},
    VERIFICATION_POLL_MAX_ROUNDS: 5,
  });

  await helpers.resolveVerificationStep(
    8,
    {
      email: 'user@example.com',
      mailProvider: '2925',
      lastLoginCode: null,
    },
    { provider: '2925', label: '2925 邮箱' },
    { filterAfterTimestamp: 123456 }
  );

  await new Promise((resolve) => setTimeout(resolve, 0));

  assert.deepStrictEqual(mailMessages, ['POLL_EMAIL', 'DELETE_ALL_EMAILS']);
});

test('verification flow skips 2925 mailbox preclear when using a fixed signup mail window and still clears after success', async () => {
  const mailMessages = [];

  const helpers = api.createVerificationFlowHelpers({
    addLog: async () => {},
    chrome: {
      tabs: {
        update: async () => {},
      },
    },
    CLOUDFLARE_TEMP_EMAIL_PROVIDER: 'cloudflare-temp-email',
    completeStepFromBackground: async () => {},
    confirmCustomVerificationStepBypassRequest: async () => ({ confirmed: true }),
    getHotmailVerificationPollConfig: () => ({}),
    getHotmailVerificationRequestTimestamp: () => 0,
    getState: async () => ({}),
    getTabId: async () => 1,
    HOTMAIL_PROVIDER: 'hotmail-api',
    isStopError: () => false,
    LUCKMAIL_PROVIDER: 'luckmail-api',
    MAIL_2925_VERIFICATION_INTERVAL_MS: 15000,
    MAIL_2925_VERIFICATION_MAX_ATTEMPTS: 15,
    pollCloudflareTempEmailVerificationCode: async () => ({}),
    pollHotmailVerificationCode: async () => ({}),
    pollLuckmailVerificationCode: async () => ({}),
    sendToContentScript: async (_source, message) => {
      if (message.type === 'FILL_CODE') {
        return {};
      }
      if (message.type === 'RESEND_VERIFICATION_CODE') {
        return {};
      }
      return {};
    },
    sendToMailContentScriptResilient: async (_mail, message) => {
      mailMessages.push(message.type);
      if (message.type === 'POLL_EMAIL') {
        return { code: '654321', emailTimestamp: 123 };
      }
      return { ok: true, deleted: true };
    },
    setState: async () => {},
    setStepStatus: async () => {},
    sleepWithStop: async () => {},
    throwIfStopped: () => {},
    VERIFICATION_POLL_MAX_ROUNDS: 5,
  });

  await helpers.resolveVerificationStep(
    4,
    {
      email: 'user@example.com',
      mailProvider: '2925',
      lastSignupCode: null,
    },
    { provider: '2925', label: '2925 邮箱' },
    {
      filterAfterTimestamp: 123456,
      requestFreshCodeFirst: false,
    }
  );

  await new Promise((resolve) => setTimeout(resolve, 0));

  assert.deepStrictEqual(mailMessages, ['POLL_EMAIL', 'DELETE_ALL_EMAILS']);
});

test('verification flow closes the tracked iCloud mail tab after a successful verification submit', async () => {
  const removedTabIds = [];
  const logMessages = [];

  const helpers = api.createVerificationFlowHelpers({
    addLog: async (message) => {
      logMessages.push(message);
    },
    chrome: {
      tabs: {
        update: async () => {},
        remove: async (tabId) => {
          removedTabIds.push(tabId);
        },
      },
    },
    closeConflictingTabsForSource: async () => {
      throw new Error('should not use family cleanup when tracked tab exists');
    },
    CLOUDFLARE_TEMP_EMAIL_PROVIDER: 'cloudflare-temp-email',
    completeStepFromBackground: async () => {},
    confirmCustomVerificationStepBypassRequest: async () => ({ confirmed: true }),
    getHotmailVerificationPollConfig: () => ({}),
    getHotmailVerificationRequestTimestamp: () => 0,
    getState: async () => ({}),
    getTabId: async (source) => (source === 'icloud-mail' ? 91 : 1),
    HOTMAIL_PROVIDER: 'hotmail-api',
    isStopError: () => false,
    LUCKMAIL_PROVIDER: 'luckmail-api',
    MAIL_2925_VERIFICATION_INTERVAL_MS: 15000,
    MAIL_2925_VERIFICATION_MAX_ATTEMPTS: 15,
    pollCloudflareTempEmailVerificationCode: async () => ({}),
    pollHotmailVerificationCode: async () => ({}),
    pollLuckmailVerificationCode: async () => ({}),
    sendToContentScript: async (_source, message) => {
      if (message.type === 'FILL_CODE') {
        return {};
      }
      return {};
    },
    sendToMailContentScriptResilient: async () => ({
      code: '654321',
      emailTimestamp: 123,
    }),
    setState: async () => {},
    setStepStatus: async () => {},
    sleepWithStop: async () => {},
    throwIfStopped: () => {},
    VERIFICATION_POLL_MAX_ROUNDS: 5,
  });

  await helpers.resolveVerificationStep(
    4,
    {
      email: 'user@example.com',
      lastSignupCode: null,
    },
    {
      source: 'icloud-mail',
      url: 'https://www.icloud.com/mail/',
      label: 'iCloud 邮箱',
    },
    {}
  );

  await new Promise((resolve) => setTimeout(resolve, 0));

  assert.deepStrictEqual(removedTabIds, [91]);
  assert.ok(logMessages.some((message) => message.includes('已关闭 iCloud 邮箱标签页')));
});

test('verification flow completes step 8 and flags phone verification when add-phone appears after login code submit', async () => {
  const events = [];

  const helpers = api.createVerificationFlowHelpers({
    addLog: async () => {},
    chrome: {
      tabs: {
        update: async () => {},
      },
    },
    CLOUDFLARE_TEMP_EMAIL_PROVIDER: 'cloudflare-temp-email',
    completeStepFromBackground: async (_step, payload) => {
      events.push(['complete', payload.code]);
    },
    confirmCustomVerificationStepBypassRequest: async () => ({ confirmed: true }),
    getHotmailVerificationPollConfig: () => ({}),
    getHotmailVerificationRequestTimestamp: () => 0,
    getState: async () => ({}),
    getTabId: async () => 1,
    HOTMAIL_PROVIDER: 'hotmail-api',
    isStopError: () => false,
    LUCKMAIL_PROVIDER: 'luckmail-api',
    MAIL_2925_VERIFICATION_INTERVAL_MS: 15000,
    MAIL_2925_VERIFICATION_MAX_ATTEMPTS: 15,
    pollCloudflareTempEmailVerificationCode: async () => ({}),
    pollHotmailVerificationCode: async () => ({}),
    pollLuckmailVerificationCode: async () => ({}),
    sendToContentScript: async (_source, message) => {
      if (message.type === 'FILL_CODE') {
        events.push(['submit', message.payload.code]);
        return {
          addPhonePage: true,
          url: 'https://auth.openai.com/add-phone',
        };
      }
      return {};
    },
    sendToMailContentScriptResilient: async () => ({
      code: '654321',
      emailTimestamp: 123,
    }),
    setState: async (payload) => {
      events.push(['state', payload.lastLoginCode || payload.lastSignupCode]);
    },
    setStepStatus: async () => {},
    sleepWithStop: async () => {},
    throwIfStopped: () => {},
    VERIFICATION_POLL_MAX_ROUNDS: 5,
  });

  const result = await helpers.resolveVerificationStep(
    8,
    { email: 'user@example.com', lastLoginCode: null },
    { provider: 'qq', label: 'QQ Mail' },
    {}
  );

  assert.deepStrictEqual(result, {
    phoneVerificationRequired: true,
    url: 'https://auth.openai.com/add-phone',
  });
  assert.deepStrictEqual(events, [
    ['submit', '654321'],
    ['state', '654321'],
    ['complete', '654321'],
  ]);
});

test('verification flow keeps step 8 successful when code submit transport fails but auth page already reaches oauth consent', async () => {
  const events = [];

  const helpers = api.createVerificationFlowHelpers({
    addLog: async (message) => {
      events.push(['log', message]);
    },
    chrome: {
      tabs: {
        update: async () => {},
      },
    },
    CLOUDFLARE_TEMP_EMAIL_PROVIDER: 'cloudflare-temp-email',
    completeStepFromBackground: async (_step, payload) => {
      events.push(['complete', payload.code]);
    },
    confirmCustomVerificationStepBypassRequest: async () => ({ confirmed: true }),
    getHotmailVerificationPollConfig: () => ({}),
    getHotmailVerificationRequestTimestamp: () => 0,
    getState: async () => ({}),
    getTabId: async () => 1,
    HOTMAIL_PROVIDER: 'hotmail-api',
    isStopError: () => false,
    LUCKMAIL_PROVIDER: 'luckmail-api',
    MAIL_2925_VERIFICATION_INTERVAL_MS: 15000,
    MAIL_2925_VERIFICATION_MAX_ATTEMPTS: 15,
    pollCloudflareTempEmailVerificationCode: async () => ({}),
    pollHotmailVerificationCode: async () => ({}),
    pollLuckmailVerificationCode: async () => ({}),
    sendToContentScript: async (_source, message) => {
      if (message.type === 'FILL_CODE') {
        throw new Error('message channel is closed before a response was received');
      }
      return {};
    },
    sendToContentScriptResilient: async (_source, message) => {
      if (message.type === 'FILL_CODE') {
        throw new Error('message channel is closed before a response was received');
      }
      if (message.type === 'GET_LOGIN_AUTH_STATE') {
        return {
          state: 'oauth_consent_page',
          url: 'https://auth.openai.com/authorize?client_id=test',
        };
      }
      return {};
    },
    sendToMailContentScriptResilient: async () => ({
      code: '654321',
      emailTimestamp: 123,
    }),
    setState: async (payload) => {
      events.push(['state', payload.lastLoginCode || payload.lastSignupCode]);
    },
    setStepStatus: async () => {},
    sleepWithStop: async () => {},
    throwIfStopped: () => {},
    VERIFICATION_POLL_MAX_ROUNDS: 5,
  });

  const result = await helpers.resolveVerificationStep(
    8,
    { email: 'user@example.com', lastLoginCode: null },
    { provider: 'qq', label: 'QQ Mail' },
    {}
  );

  assert.deepStrictEqual(result, {
    phoneVerificationRequired: false,
    url: 'https://auth.openai.com/authorize?client_id=test',
  });
  assert.deepStrictEqual(events.filter((entry) => entry[0] !== 'log'), [
    ['state', '654321'],
    ['complete', '654321'],
  ]);
  assert.ok(events.some((entry) => entry[0] === 'log' && /通信中断/.test(entry[1])));
});

test('verification flow treats manual step 8 add-phone confirmation as the same fatal add-phone error', async () => {
  const helpers = api.createVerificationFlowHelpers({
    addLog: async () => {},
    chrome: {
      tabs: {
        update: async () => {},
      },
    },
    CLOUDFLARE_TEMP_EMAIL_PROVIDER: 'cloudflare-temp-email',
    completeStepFromBackground: async () => {
      throw new Error('should not complete step 8');
    },
    confirmCustomVerificationStepBypassRequest: async () => ({
      confirmed: false,
      addPhoneDetected: true,
    }),
    getHotmailVerificationPollConfig: () => ({}),
    getHotmailVerificationRequestTimestamp: () => 0,
    getState: async () => ({}),
    getTabId: async () => 1,
    HOTMAIL_PROVIDER: 'hotmail-api',
    isStopError: () => false,
    LUCKMAIL_PROVIDER: 'luckmail-api',
    MAIL_2925_VERIFICATION_INTERVAL_MS: 15000,
    MAIL_2925_VERIFICATION_MAX_ATTEMPTS: 15,
    pollCloudflareTempEmailVerificationCode: async () => ({}),
    pollHotmailVerificationCode: async () => ({}),
    pollLuckmailVerificationCode: async () => ({}),
    sendToContentScript: async () => ({}),
    sendToMailContentScriptResilient: async () => ({}),
    setState: async () => {},
    setStepStatus: async () => {
      throw new Error('should not mark step skipped when add-phone is chosen');
    },
    sleepWithStop: async () => {},
    throwIfStopped: () => {},
    VERIFICATION_POLL_MAX_ROUNDS: 5,
  });

  await assert.rejects(
    () => helpers.confirmCustomVerificationStepBypass(8),
    /验证码提交后页面进入手机号页面/
  );
});

test('verification flow caps mail polling timeout to the remaining oauth budget', async () => {
  const mailPollCalls = [];

  const helpers = api.createVerificationFlowHelpers({
    addLog: async () => {},
    chrome: {
      tabs: {
        update: async () => {},
      },
    },
    CLOUDFLARE_TEMP_EMAIL_PROVIDER: 'cloudflare-temp-email',
    completeStepFromBackground: async () => {},
    confirmCustomVerificationStepBypassRequest: async () => ({ confirmed: true }),
    getHotmailVerificationPollConfig: () => ({}),
    getHotmailVerificationRequestTimestamp: () => 0,
    getState: async () => ({}),
    getTabId: async () => 1,
    HOTMAIL_PROVIDER: 'hotmail-api',
    isStopError: () => false,
    LUCKMAIL_PROVIDER: 'luckmail-api',
    MAIL_2925_VERIFICATION_INTERVAL_MS: 15000,
    MAIL_2925_VERIFICATION_MAX_ATTEMPTS: 15,
    pollCloudflareTempEmailVerificationCode: async () => ({}),
    pollHotmailVerificationCode: async () => ({}),
    pollLuckmailVerificationCode: async () => ({}),
    sendToContentScript: async (_source, message) => {
      if (message.type === 'FILL_CODE') {
        return {};
      }
      return {};
    },
    sendToMailContentScriptResilient: async (_mail, message, options) => {
      mailPollCalls.push({
        payload: message.payload,
        options,
      });
      return { code: '654321', emailTimestamp: 123 };
    },
    setState: async () => {},
    setStepStatus: async () => {},
    sleepWithStop: async () => {},
    throwIfStopped: () => {},
    VERIFICATION_POLL_MAX_ROUNDS: 5,
  });

  await helpers.resolveVerificationStep(
    8,
    {
      email: 'user@example.com',
      lastLoginCode: null,
    },
    { provider: 'qq', label: 'QQ 邮箱' },
    {
      getRemainingTimeMs: async () => 5000,
      resendIntervalMs: 0,
    }
  );

  assert.ok(mailPollCalls.length >= 1);
  assert.equal(mailPollCalls[0].options.timeoutMs, 5000);
  assert.equal(mailPollCalls[0].options.responseTimeoutMs, 5000);
  assert.equal(mailPollCalls[0].payload.maxAttempts, 2);
});

test('verification flow keeps mail polling response timeout above minimum floor', async () => {
  const mailPollCalls = [];

  const helpers = api.createVerificationFlowHelpers({
    addLog: async () => {},
    chrome: {
      tabs: {
        update: async () => {},
      },
    },
    CLOUDFLARE_TEMP_EMAIL_PROVIDER: 'cloudflare-temp-email',
    completeStepFromBackground: async () => {},
    confirmCustomVerificationStepBypassRequest: async () => ({ confirmed: true }),
    getHotmailVerificationPollConfig: () => ({}),
    getHotmailVerificationRequestTimestamp: () => 0,
    getState: async () => ({}),
    getTabId: async () => 1,
    HOTMAIL_PROVIDER: 'hotmail-api',
    isStopError: () => false,
    LUCKMAIL_PROVIDER: 'luckmail-api',
    MAIL_2925_VERIFICATION_INTERVAL_MS: 15000,
    MAIL_2925_VERIFICATION_MAX_ATTEMPTS: 15,
    pollCloudflareTempEmailVerificationCode: async () => ({}),
    pollHotmailVerificationCode: async () => ({}),
    pollLuckmailVerificationCode: async () => ({}),
    sendToContentScript: async (_source, message) => {
      if (message.type === 'FILL_CODE') {
        return {};
      }
      return {};
    },
    sendToMailContentScriptResilient: async (_mail, message, options) => {
      mailPollCalls.push({
        payload: message.payload,
        options,
      });
      return { code: '654321', emailTimestamp: 123 };
    },
    setState: async () => {},
    setStepStatus: async () => {},
    sleepWithStop: async () => {},
    throwIfStopped: () => {},
    VERIFICATION_POLL_MAX_ROUNDS: 5,
  });

  await helpers.resolveVerificationStep(
    8,
    {
      email: 'user@example.com',
      lastLoginCode: null,
    },
    { provider: 'qq', label: 'QQ 邮箱' },
    {
      getRemainingTimeMs: async () => 1200,
      resendIntervalMs: 0,
    }
  );

  assert.ok(mailPollCalls.length >= 1);
  assert.equal(mailPollCalls[0].options.timeoutMs, 5000);
  assert.equal(mailPollCalls[0].options.responseTimeoutMs, 5000);
});

test('verification flow keeps 2925 mailbox polling at 15 refresh attempts even when oauth budget is smaller', async () => {
  const mailPollCalls = [];

  const helpers = api.createVerificationFlowHelpers({
    addLog: async () => {},
    chrome: {
      tabs: {
        update: async () => {},
      },
    },
    CLOUDFLARE_TEMP_EMAIL_PROVIDER: 'cloudflare-temp-email',
    completeStepFromBackground: async () => {},
    confirmCustomVerificationStepBypassRequest: async () => ({ confirmed: true }),
    getHotmailVerificationPollConfig: () => ({}),
    getHotmailVerificationRequestTimestamp: () => 0,
    getState: async () => ({}),
    getTabId: async () => 1,
    HOTMAIL_PROVIDER: 'hotmail-api',
    isStopError: () => false,
    LUCKMAIL_PROVIDER: 'luckmail-api',
    MAIL_2925_VERIFICATION_INTERVAL_MS: 15000,
    MAIL_2925_VERIFICATION_MAX_ATTEMPTS: 15,
    pollCloudflareTempEmailVerificationCode: async () => ({}),
    pollHotmailVerificationCode: async () => ({}),
    pollLuckmailVerificationCode: async () => ({}),
    sendToContentScript: async (_source, message) => {
      if (message.type === 'FILL_CODE') {
        return {};
      }
      return {};
    },
    sendToMailContentScriptResilient: async (_mail, message, options) => {
      mailPollCalls.push({
        type: message.type,
        payload: message.payload,
        options,
      });
      return { code: '654321', emailTimestamp: 123 };
    },
    setState: async () => {},
    setStepStatus: async () => {},
    sleepWithStop: async () => {},
    throwIfStopped: () => {},
    VERIFICATION_POLL_MAX_ROUNDS: 5,
  });

  await helpers.resolveVerificationStep(
    8,
    {
      email: 'user@example.com',
      mailProvider: '2925',
      lastLoginCode: null,
    },
    { provider: '2925', label: '2925 邮箱' },
    {
      getRemainingTimeMs: async () => 5000,
      resendIntervalMs: 0,
      disableTimeBudgetCap: true,
    }
  );

  const pollCall = mailPollCalls.find((entry) => entry.type === 'POLL_EMAIL');
  assert.ok(pollCall);
  assert.equal(pollCall.payload.maxAttempts, 15);
  assert.ok(pollCall.options.timeoutMs >= 250000);
});

test('verification flow keeps Hotmail request timestamp filtering on the first poll', async () => {
  const pollPayloads = [];

  const helpers = api.createVerificationFlowHelpers({
    addLog: async () => {},
    chrome: { tabs: { update: async () => {} } },
    CLOUDFLARE_TEMP_EMAIL_PROVIDER: 'cloudflare-temp-email',
    completeStepFromBackground: async () => {},
    confirmCustomVerificationStepBypassRequest: async () => ({ confirmed: true }),
    getHotmailVerificationPollConfig: () => ({}),
    getHotmailVerificationRequestTimestamp: () => 87654,
    getState: async () => ({}),
    getTabId: async () => 1,
    HOTMAIL_PROVIDER: 'hotmail-api',
    isStopError: () => false,
    LUCKMAIL_PROVIDER: 'luckmail-api',
    MAIL_2925_VERIFICATION_INTERVAL_MS: 15000,
    MAIL_2925_VERIFICATION_MAX_ATTEMPTS: 15,
    pollCloudflareTempEmailVerificationCode: async () => ({}),
    pollHotmailVerificationCode: async (_step, _state, payload) => {
      pollPayloads.push(payload);
      return { code: '654321', emailTimestamp: 123 };
    },
    pollLuckmailVerificationCode: async () => ({}),
    sendToContentScript: async (_source, message) => {
      if (message.type === 'FILL_CODE') {
        return {};
      }
      return {};
    },
    sendToMailContentScriptResilient: async () => ({}),
    setState: async () => {},
    setStepStatus: async () => {},
    sleepWithStop: async () => {},
    throwIfStopped: () => {},
    VERIFICATION_POLL_MAX_ROUNDS: 5,
  });

  await helpers.resolveVerificationStep(
    7,
    {
      email: 'user@example.com',
      loginVerificationRequestedAt: 100000,
      lastLoginCode: null,
    },
    { provider: 'hotmail-api', label: 'Hotmail' },
    {}
  );

  assert.equal(pollPayloads.length, 1);
  assert.equal(pollPayloads[0].filterAfterTimestamp, 87654);
});

test('verification flow keeps fixed filter timestamp after step 4 resend', async () => {
  const pollPayloads = [];

  let submitCount = 0;

  const helpers = api.createVerificationFlowHelpers({
    addLog: async () => {},
    chrome: { tabs: { update: async () => {} } },
    CLOUDFLARE_TEMP_EMAIL_PROVIDER: 'cloudflare-temp-email',
    completeStepFromBackground: async () => {},
    confirmCustomVerificationStepBypassRequest: async () => ({ confirmed: true }),
    getHotmailVerificationPollConfig: () => ({}),
    getHotmailVerificationRequestTimestamp: (_step, state) => Math.max(0, Number(state.signupVerificationRequestedAt || 0) - 15000),
    getState: async () => ({}),
    getTabId: async () => 1,
    HOTMAIL_PROVIDER: 'hotmail-api',
    isStopError: () => false,
    LUCKMAIL_PROVIDER: 'luckmail-api',
    MAIL_2925_VERIFICATION_INTERVAL_MS: 15000,
    MAIL_2925_VERIFICATION_MAX_ATTEMPTS: 15,
    pollCloudflareTempEmailVerificationCode: async () => ({}),
    pollHotmailVerificationCode: async (_step, _state, payload) => {
      pollPayloads.push(payload);
      return {
        code: pollPayloads.length === 1 ? '111111' : '222222',
        emailTimestamp: pollPayloads.length,
      };
    },
    pollLuckmailVerificationCode: async () => ({}),
    sendToContentScript: async (_source, message) => {
      if (message.type === 'FILL_CODE') {
        submitCount += 1;
        return submitCount === 1
          ? { invalidCode: true, errorText: '旧验证码' }
          : {};
      }
      if (message.type === 'RESEND_VERIFICATION_CODE') {
        return {};
      }
      return {};
    },
    sendToMailContentScriptResilient: async () => ({}),
    setState: async () => {},
    setStepStatus: async () => {},
    sleepWithStop: async () => {},
    throwIfStopped: () => {},
    VERIFICATION_POLL_MAX_ROUNDS: 5,
  });

  await helpers.resolveVerificationStep(
    4,
    {
      email: 'user@example.com',
      signupVerificationRequestedAt: 100000,
      lastSignupCode: null,
    },
    { provider: 'hotmail-api', label: 'Hotmail' },
    {
      filterAfterTimestamp: 123456,
    }
  );

  assert.equal(pollPayloads.length, 2);
  assert.equal(pollPayloads[0].filterAfterTimestamp, 123456);
  assert.equal(pollPayloads[1].filterAfterTimestamp, 123456);
});

test('verification flow uses configured signup resend count for step 4', async () => {
  const resendSteps = [];
  let pollCalls = 0;

  const helpers = api.createVerificationFlowHelpers({
    addLog: async () => {},
    chrome: { tabs: { update: async () => {} } },
    CLOUDFLARE_TEMP_EMAIL_PROVIDER: 'cloudflare-temp-email',
    completeStepFromBackground: async () => {},
    confirmCustomVerificationStepBypassRequest: async () => ({ confirmed: true }),
    getHotmailVerificationPollConfig: () => ({}),
    getHotmailVerificationRequestTimestamp: () => 0,
    getState: async () => ({}),
    getTabId: async () => 1,
    HOTMAIL_PROVIDER: 'hotmail-api',
    isStopError: () => false,
    LUCKMAIL_PROVIDER: 'luckmail-api',
    MAIL_2925_VERIFICATION_INTERVAL_MS: 15000,
    MAIL_2925_VERIFICATION_MAX_ATTEMPTS: 15,
    pollCloudflareTempEmailVerificationCode: async () => ({}),
    pollHotmailVerificationCode: async () => ({}),
    pollLuckmailVerificationCode: async () => ({}),
    sendToContentScript: async (_source, message) => {
      if (message.type === 'RESEND_VERIFICATION_CODE') {
        resendSteps.push(message.step);
      }
      return {};
    },
    sendToMailContentScriptResilient: async () => {
      pollCalls += 1;
      return pollCalls === 2
        ? { code: '654321', emailTimestamp: 123 }
        : {};
    },
    setState: async () => {},
    setStepStatus: async () => {},
    sleepWithStop: async () => {},
    throwIfStopped: () => {},
    VERIFICATION_POLL_MAX_ROUNDS: 5,
  });

  await helpers.resolveVerificationStep(
    4,
    {
      email: 'user@example.com',
      verificationResendCount: 2,
      lastSignupCode: null,
    },
    { provider: 'qq', label: 'QQ 邮箱' },
    {
      requestFreshCodeFirst: true,
      resendIntervalMs: 0,
    }
  );

  assert.deepStrictEqual(resendSteps, [4, 4]);
  assert.equal(pollCalls, 2);
});

test('verification flow uses configured login resend count for step 8', async () => {
  const resendSteps = [];
  let pollCalls = 0;

  const helpers = api.createVerificationFlowHelpers({
    addLog: async () => {},
    chrome: { tabs: { update: async () => {} } },
    CLOUDFLARE_TEMP_EMAIL_PROVIDER: 'cloudflare-temp-email',
    completeStepFromBackground: async () => {},
    confirmCustomVerificationStepBypassRequest: async () => ({ confirmed: true }),
    getHotmailVerificationPollConfig: () => ({}),
    getHotmailVerificationRequestTimestamp: () => 0,
    getState: async () => ({}),
    getTabId: async () => 1,
    HOTMAIL_PROVIDER: 'hotmail-api',
    isStopError: () => false,
    LUCKMAIL_PROVIDER: 'luckmail-api',
    MAIL_2925_VERIFICATION_INTERVAL_MS: 15000,
    MAIL_2925_VERIFICATION_MAX_ATTEMPTS: 15,
    pollCloudflareTempEmailVerificationCode: async () => ({}),
    pollHotmailVerificationCode: async () => ({}),
    pollLuckmailVerificationCode: async () => ({}),
    sendToContentScript: async (_source, message) => {
      if (message.type === 'RESEND_VERIFICATION_CODE') {
        resendSteps.push(message.step);
      }
      return {};
    },
    sendToMailContentScriptResilient: async () => {
      pollCalls += 1;
      return pollCalls === 3
        ? { code: '654321', emailTimestamp: 123 }
        : {};
    },
    setState: async () => {},
    setStepStatus: async () => {},
    sleepWithStop: async () => {},
    throwIfStopped: () => {},
    VERIFICATION_POLL_MAX_ROUNDS: 5,
  });

  await helpers.resolveVerificationStep(
    8,
    {
      email: 'user@example.com',
      verificationResendCount: 2,
      lastLoginCode: null,
    },
    { provider: 'qq', label: 'QQ 邮箱' },
    {
      requestFreshCodeFirst: false,
      resendIntervalMs: 0,
    }
  );

  assert.deepStrictEqual(resendSteps, [8, 8]);
  assert.equal(pollCalls, 3);
});

test('verification flow can complete Plus visible login-code step with shared step 8 semantics', async () => {
  const completed = [];
  const fillMessages = [];

  const helpers = api.createVerificationFlowHelpers({
    addLog: async () => {},
    chrome: { tabs: { update: async () => {} } },
    CLOUDFLARE_TEMP_EMAIL_PROVIDER: 'cloudflare-temp-email',
    completeStepFromBackground: async (step, payload) => {
      completed.push({ step, payload });
    },
    confirmCustomVerificationStepBypassRequest: async () => ({ confirmed: true }),
    getHotmailVerificationPollConfig: () => ({}),
    getHotmailVerificationRequestTimestamp: () => 0,
    getState: async () => ({}),
    getTabId: async () => 1,
    HOTMAIL_PROVIDER: 'hotmail-api',
    isStopError: () => false,
    LUCKMAIL_PROVIDER: 'luckmail-api',
    MAIL_2925_VERIFICATION_INTERVAL_MS: 15000,
    MAIL_2925_VERIFICATION_MAX_ATTEMPTS: 15,
    pollCloudflareTempEmailVerificationCode: async () => ({}),
    pollHotmailVerificationCode: async () => ({}),
    pollLuckmailVerificationCode: async () => ({}),
    sendToContentScript: async (_source, message) => {
      if (message.type === 'FILL_CODE') {
        fillMessages.push(message);
      }
      return {};
    },
    sendToMailContentScriptResilient: async () => ({ code: '654321', emailTimestamp: 456 }),
    setState: async () => {},
    setStepStatus: async () => {},
    sleepWithStop: async () => {},
    throwIfStopped: () => {},
    VERIFICATION_POLL_MAX_ROUNDS: 5,
  });

  await helpers.resolveVerificationStep(
    8,
    { email: 'user@example.com', lastLoginCode: null },
    { provider: 'qq', label: 'QQ 邮箱' },
    {
      completionStep: 11,
      requestFreshCodeFirst: false,
      maxResendRequests: 0,
      resendIntervalMs: 0,
    }
  );

  assert.deepStrictEqual(fillMessages.map((message) => message.step), [8]);
  assert.deepStrictEqual(completed, [
    {
      step: 11,
      payload: {
        emailTimestamp: 456,
        code: '654321',
        phoneVerificationRequired: false,
      },
    },
  ]);
});

test('verification flow waits during resend cooldown instead of tight-looping', async () => {
  const sleepCalls = [];
  let pollCalls = 0;

  const helpers = api.createVerificationFlowHelpers({
    addLog: async () => {},
    chrome: { tabs: { update: async () => {} } },
    CLOUDFLARE_TEMP_EMAIL_PROVIDER: 'cloudflare-temp-email',
    completeStepFromBackground: async () => {},
    confirmCustomVerificationStepBypassRequest: async () => ({ confirmed: true }),
    getHotmailVerificationPollConfig: () => ({}),
    getHotmailVerificationRequestTimestamp: () => 0,
    getState: async () => ({}),
    getTabId: async () => 1,
    HOTMAIL_PROVIDER: 'hotmail-api',
    isStopError: () => false,
    LUCKMAIL_PROVIDER: 'luckmail-api',
    MAIL_2925_VERIFICATION_INTERVAL_MS: 15000,
    MAIL_2925_VERIFICATION_MAX_ATTEMPTS: 15,
    pollCloudflareTempEmailVerificationCode: async () => ({}),
    pollHotmailVerificationCode: async () => ({}),
    pollLuckmailVerificationCode: async () => ({}),
    sendToContentScript: async () => ({}),
    sendToMailContentScriptResilient: async (_mail, message) => {
      if (message.type !== 'POLL_EMAIL') {
        return {};
      }
      pollCalls += 1;
      return pollCalls === 1
        ? {}
        : { code: '654321', emailTimestamp: 123 };
    },
    setState: async () => {},
    setStepStatus: async () => {},
    sleepWithStop: async (ms) => {
      sleepCalls.push(ms);
    },
    throwIfStopped: () => {},
    VERIFICATION_POLL_MAX_ROUNDS: 5,
  });

  const result = await helpers.pollFreshVerificationCodeWithResendInterval(
    4,
    {
      email: 'user@example.com',
      lastSignupCode: null,
    },
    { provider: 'qq', label: 'QQ 邮箱' },
    {
      maxResendRequests: 0,
      resendIntervalMs: 25000,
      lastResendAt: Date.now(),
    }
  );

  assert.equal(result.code, '654321');
  assert.equal(pollCalls, 2);
  assert.ok(sleepCalls.length >= 1);
  assert.ok(sleepCalls[0] >= 1000);
});

test('verification flow clicks resend before waiting for the next LuckMail /code retry', async () => {
  const events = [];
  let pollCalls = 0;

  const helpers = api.createVerificationFlowHelpers({
    addLog: async () => {},
    chrome: { tabs: { update: async () => {} } },
    CLOUDFLARE_TEMP_EMAIL_PROVIDER: 'cloudflare-temp-email',
    completeStepFromBackground: async () => {},
    confirmCustomVerificationStepBypassRequest: async () => ({ confirmed: true }),
    getHotmailVerificationPollConfig: () => ({}),
    getHotmailVerificationRequestTimestamp: () => 0,
    getState: async () => ({}),
    getTabId: async () => 1,
    HOTMAIL_PROVIDER: 'hotmail-api',
    isStopError: () => false,
    LUCKMAIL_PROVIDER: 'luckmail-api',
    MAIL_2925_VERIFICATION_INTERVAL_MS: 15000,
    MAIL_2925_VERIFICATION_MAX_ATTEMPTS: 15,
    pollCloudflareTempEmailVerificationCode: async () => ({}),
    pollHotmailVerificationCode: async () => ({}),
    pollLuckmailVerificationCode: async (_step, _state, payload) => {
      pollCalls += 1;
      events.push(['poll', payload.maxAttempts, payload.intervalMs]);
      if (pollCalls === 1) {
        throw new Error('步骤 4：LuckMail /code 接口暂未返回新的验证码。');
      }
      return {
        code: '654321',
        emailTimestamp: 123,
      };
    },
    sendToContentScript: async (_source, message) => {
      if (message.type === 'RESEND_VERIFICATION_CODE') {
        events.push(['resend', message.step]);
      }
      return {};
    },
    sendToMailContentScriptResilient: async () => ({}),
    setState: async () => {},
    setStepStatus: async () => {},
    sleepWithStop: async (ms) => {
      events.push(['sleep', ms]);
    },
    throwIfStopped: () => {},
    VERIFICATION_POLL_MAX_ROUNDS: 5,
  });

  const result = await helpers.pollFreshVerificationCode(
    4,
    {
      email: 'user@example.com',
      lastSignupCode: null,
    },
    { provider: 'luckmail-api', label: 'LuckMail（API 购邮）' },
    {
      resendIntervalMs: 15000,
    }
  );

  assert.equal(result.code, '654321');
  assert.deepStrictEqual(events, [
    ['poll', 1, 15000],
    ['resend', 4],
    ['sleep', 15000],
    ['poll', 1, 15000],
  ]);
});

test('verification flow notifies onResendRequestedAt when resend is triggered', async () => {
  const resendRequestedAtCalls = [];
  const stateUpdates = [];
  let pollCalls = 0;

  const helpers = api.createVerificationFlowHelpers({
    addLog: async () => {},
    chrome: { tabs: { update: async () => {} } },
    CLOUDFLARE_TEMP_EMAIL_PROVIDER: 'cloudflare-temp-email',
    completeStepFromBackground: async () => {},
    confirmCustomVerificationStepBypassRequest: async () => ({ confirmed: true }),
    getHotmailVerificationPollConfig: () => ({}),
    getHotmailVerificationRequestTimestamp: () => 0,
    getState: async () => ({}),
    getTabId: async () => 1,
    HOTMAIL_PROVIDER: 'hotmail-api',
    isStopError: () => false,
    LUCKMAIL_PROVIDER: 'luckmail-api',
    MAIL_2925_VERIFICATION_INTERVAL_MS: 15000,
    MAIL_2925_VERIFICATION_MAX_ATTEMPTS: 15,
    pollCloudflareTempEmailVerificationCode: async () => ({}),
    pollHotmailVerificationCode: async () => ({}),
    pollLuckmailVerificationCode: async () => ({}),
    sendToContentScript: async (_source, message) => {
      if (message.type === 'RESEND_VERIFICATION_CODE') {
        return { resent: true };
      }
      return {};
    },
    sendToMailContentScriptResilient: async (_mail, message) => {
      if (message.type !== 'POLL_EMAIL') {
        return {};
      }
      pollCalls += 1;
      return pollCalls === 1
        ? {}
        : { code: '654321', emailTimestamp: 123 };
    },
    setState: async (payload) => {
      stateUpdates.push(payload);
    },
    setStepStatus: async () => {},
    sleepWithStop: async () => {},
    throwIfStopped: () => {},
    VERIFICATION_POLL_MAX_ROUNDS: 5,
  });

  await helpers.resolveVerificationStep(
    8,
    {
      email: 'user@example.com',
      lastLoginCode: null,
    },
    { provider: 'qq', label: 'QQ 邮箱' },
    {
      maxResendRequests: 1,
      resendIntervalMs: 0,
      onResendRequestedAt: async (requestedAt) => {
        resendRequestedAtCalls.push(Number(requestedAt) || 0);
      },
    }
  );

  assert.equal(resendRequestedAtCalls.length >= 1, true);
  assert.equal(resendRequestedAtCalls[0] > 0, true);
  assert.equal(
    stateUpdates.some((payload) => Number(payload?.loginVerificationRequestedAt) > 0),
    true
  );
});

test('verification flow uses resilient signup-page transport when submitting verification code', async () => {
  const resilientCalls = [];

  const helpers = api.createVerificationFlowHelpers({
    addLog: async () => {},
    chrome: {
      tabs: {
        update: async () => {},
      },
    },
    CLOUDFLARE_TEMP_EMAIL_PROVIDER: 'cloudflare-temp-email',
    completeStepFromBackground: async () => {},
    confirmCustomVerificationStepBypassRequest: async () => ({ confirmed: true }),
    getHotmailVerificationPollConfig: () => ({}),
    getHotmailVerificationRequestTimestamp: () => 0,
    getState: async () => ({}),
    getTabId: async () => 1,
    HOTMAIL_PROVIDER: 'hotmail-api',
    isStopError: () => false,
    LUCKMAIL_PROVIDER: 'luckmail-api',
    MAIL_2925_VERIFICATION_INTERVAL_MS: 15000,
    MAIL_2925_VERIFICATION_MAX_ATTEMPTS: 15,
    pollCloudflareTempEmailVerificationCode: async () => ({}),
    pollHotmailVerificationCode: async () => ({}),
    pollLuckmailVerificationCode: async () => ({}),
    sendToContentScript: async () => {
      throw new Error('should not use non-resilient channel');
    },
    sendToContentScriptResilient: async (_source, message, options) => {
      resilientCalls.push({ message, options });
      return { success: true };
    },
    sendToMailContentScriptResilient: async () => ({}),
    setState: async () => {},
    setStepStatus: async () => {},
    sleepWithStop: async () => {},
    throwIfStopped: () => {},
    VERIFICATION_POLL_MAX_ROUNDS: 5,
  });

  const result = await helpers.submitVerificationCode(4, '654321');

  assert.deepStrictEqual(result, { success: true });
  assert.equal(resilientCalls.length, 1);
  assert.equal(resilientCalls[0].message.type, 'FILL_CODE');
  assert.equal(resilientCalls[0].message.payload.code, '654321');
  assert.ok(resilientCalls[0].options.timeoutMs >= 30000);
});

test('verification flow does not replay step 8 code submit after transient auth-page transport failure', async () => {
  const directMessages = [];
  const resilientMessages = [];

  const helpers = api.createVerificationFlowHelpers({
    addLog: async () => {},
    chrome: {
      tabs: {
        update: async () => {},
      },
    },
    CLOUDFLARE_TEMP_EMAIL_PROVIDER: 'cloudflare-temp-email',
    completeStepFromBackground: async () => {},
    confirmCustomVerificationStepBypassRequest: async () => ({ confirmed: true }),
    getHotmailVerificationPollConfig: () => ({}),
    getHotmailVerificationRequestTimestamp: () => 0,
    getState: async () => ({}),
    getTabId: async () => 1,
    HOTMAIL_PROVIDER: 'hotmail-api',
    isRetryableContentScriptTransportError: (error) => /did not respond/i.test(String(error?.message || error || '')),
    isStopError: () => false,
    LUCKMAIL_PROVIDER: 'luckmail-api',
    MAIL_2925_VERIFICATION_INTERVAL_MS: 15000,
    MAIL_2925_VERIFICATION_MAX_ATTEMPTS: 15,
    pollCloudflareTempEmailVerificationCode: async () => ({}),
    pollHotmailVerificationCode: async () => ({}),
    pollLuckmailVerificationCode: async () => ({}),
    sendToContentScript: async (_source, message) => {
      directMessages.push(message.type);
      if (message.type === 'FILL_CODE') {
        throw new Error('步骤 8：页面通信异常 did not respond in 30s');
      }
      return {};
    },
    sendToContentScriptResilient: async (_source, message) => {
      resilientMessages.push(message.type);
      if (message.type === 'GET_LOGIN_AUTH_STATE') {
        return {
          state: 'verification_page',
          verificationErrorText: '代码不正确',
          url: 'https://auth.openai.com/email-verification',
        };
      }
      throw new Error('FILL_CODE should not be replayed through resilient transport');
    },
    sendToMailContentScriptResilient: async () => ({}),
    setState: async () => {},
    setStepStatus: async () => {},
    sleepWithStop: async () => {},
    throwIfStopped: () => {},
    VERIFICATION_POLL_MAX_ROUNDS: 5,
  });

  const result = await helpers.submitVerificationCode(8, '510725', { completionStep: 11 });

  assert.deepStrictEqual(result, {
    invalidCode: true,
    errorText: '代码不正确',
    url: 'https://auth.openai.com/email-verification',
  });
  assert.deepStrictEqual(directMessages, ['FILL_CODE']);
  assert.deepStrictEqual(resilientMessages, ['GET_LOGIN_AUTH_STATE']);
});

test('verification flow requests a new code immediately after Cloudflare Temp Email code is rejected', async () => {
  const events = [];
  const pollPayloads = [];
  const completed = [];

  const helpers = api.createVerificationFlowHelpers({
    addLog: async () => {},
    chrome: {
      tabs: {
        update: async () => {},
      },
    },
    CLOUDFLARE_TEMP_EMAIL_PROVIDER: 'cloudflare-temp-email',
    completeStepFromBackground: async (_step, payload) => {
      completed.push(payload);
    },
    confirmCustomVerificationStepBypassRequest: async () => ({ confirmed: true }),
    getHotmailVerificationPollConfig: () => ({}),
    getHotmailVerificationRequestTimestamp: () => 0,
    getState: async () => ({}),
    getTabId: async () => 1,
    HOTMAIL_PROVIDER: 'hotmail-api',
    isStopError: () => false,
    LUCKMAIL_PROVIDER: 'luckmail-api',
    MAIL_2925_VERIFICATION_INTERVAL_MS: 15000,
    MAIL_2925_VERIFICATION_MAX_ATTEMPTS: 15,
    pollCloudflareTempEmailVerificationCode: async (_step, _state, payload) => {
      pollPayloads.push(payload);
      const code = pollPayloads.length === 1 ? '111111' : '222222';
      events.push(['poll', code]);
      return { code, emailTimestamp: pollPayloads.length };
    },
    pollHotmailVerificationCode: async () => ({}),
    pollLuckmailVerificationCode: async () => ({}),
    sendToContentScript: async (_source, message) => {
      if (message.type === 'RESEND_VERIFICATION_CODE') {
        events.push(['resend', message.step]);
        return {};
      }
      if (message.type === 'FILL_CODE') {
        events.push(['submit', message.payload.code]);
        return message.payload.code === '111111'
          ? { invalidCode: true, errorText: '代码不正确' }
          : { success: true };
      }
      return {};
    },
    sendToMailContentScriptResilient: async () => ({}),
    setState: async () => {},
    setStepStatus: async () => {},
    sleepWithStop: async () => {},
    throwIfStopped: () => {},
    VERIFICATION_POLL_MAX_ROUNDS: 5,
  });

  await helpers.resolveVerificationStep(
    8,
    {
      email: 'user@example.com',
      loginVerificationRequestedAt: Date.now(),
      verificationResendCount: 1,
    },
    { provider: 'cloudflare-temp-email', label: 'Cloudflare Temp Email' },
    {
      completionStep: 11,
      lastResendAt: Date.now(),
      resendIntervalMs: 25000,
    }
  );

  assert.deepStrictEqual(events, [
    ['poll', '111111'],
    ['submit', '111111'],
    ['resend', 8],
    ['poll', '222222'],
    ['submit', '222222'],
  ]);
  assert.deepStrictEqual(pollPayloads[1].excludeCodes, ['111111']);
  assert.equal(completed[0].code, '222222');
});

test('verification flow forwards optional signup profile payload when submitting signup verification code', async () => {
  const resilientCalls = [];

  const helpers = api.createVerificationFlowHelpers({
    addLog: async () => {},
    chrome: {
      tabs: {
        update: async () => {},
      },
    },
    CLOUDFLARE_TEMP_EMAIL_PROVIDER: 'cloudflare-temp-email',
    completeStepFromBackground: async () => {},
    confirmCustomVerificationStepBypassRequest: async () => ({ confirmed: true }),
    getHotmailVerificationPollConfig: () => ({}),
    getHotmailVerificationRequestTimestamp: () => 0,
    getState: async () => ({}),
    getTabId: async () => 1,
    HOTMAIL_PROVIDER: 'hotmail-api',
    isStopError: () => false,
    LUCKMAIL_PROVIDER: 'luckmail-api',
    MAIL_2925_VERIFICATION_INTERVAL_MS: 15000,
    MAIL_2925_VERIFICATION_MAX_ATTEMPTS: 15,
    pollCloudflareTempEmailVerificationCode: async () => ({}),
    pollHotmailVerificationCode: async () => ({}),
    pollLuckmailVerificationCode: async () => ({}),
    sendToContentScript: async () => {
      throw new Error('should not use non-resilient channel');
    },
    sendToContentScriptResilient: async (_source, message) => {
      resilientCalls.push(message);
      return { success: true, skipProfileStep: true };
    },
    sendToMailContentScriptResilient: async () => ({}),
    setState: async () => {},
    setStepStatus: async () => {},
    sleepWithStop: async () => {},
    throwIfStopped: () => {},
    VERIFICATION_POLL_MAX_ROUNDS: 5,
  });

  const result = await helpers.submitVerificationCode(4, '654321', {
    signupProfile: {
      firstName: 'Ada',
      lastName: 'Lovelace',
      year: 2003,
      month: 6,
      day: 19,
    },
  });

  assert.deepStrictEqual(result, { success: true, skipProfileStep: true });
  assert.deepStrictEqual(resilientCalls[0].payload.signupProfile, {
    firstName: 'Ada',
    lastName: 'Lovelace',
    year: 2003,
    month: 6,
    day: 19,
  });
});

test('verification flow keeps combined signup profile skip reason when completing signup verification', async () => {
  const completed = [];
  const resilientCalls = [];

  const helpers = api.createVerificationFlowHelpers({
    addLog: async () => {},
    chrome: {
      tabs: {
        update: async () => {},
      },
    },
    CLOUDFLARE_TEMP_EMAIL_PROVIDER: 'cloudflare-temp-email',
    completeStepFromBackground: async (step, payload) => {
      completed.push({ step, payload });
    },
    confirmCustomVerificationStepBypassRequest: async () => ({ confirmed: true }),
    getHotmailVerificationPollConfig: () => ({}),
    getHotmailVerificationRequestTimestamp: () => 0,
    getState: async () => ({}),
    getTabId: async () => 1,
    HOTMAIL_PROVIDER: 'hotmail-api',
    isStopError: () => false,
    LUCKMAIL_PROVIDER: 'luckmail-api',
    MAIL_2925_VERIFICATION_INTERVAL_MS: 15000,
    MAIL_2925_VERIFICATION_MAX_ATTEMPTS: 15,
    pollCloudflareTempEmailVerificationCode: async () => ({}),
    pollHotmailVerificationCode: async () => ({}),
    pollLuckmailVerificationCode: async () => ({}),
    sendToContentScript: async () => {
      throw new Error('should not use non-resilient channel');
    },
    sendToContentScriptResilient: async (_source, message) => {
      resilientCalls.push(message);
      return {
        success: true,
        skipProfileStep: true,
        skipProfileStepReason: 'combined_verification_profile',
      };
    },
    sendToMailContentScriptResilient: async () => ({
      code: '654321',
      emailTimestamp: 123,
    }),
    setState: async () => {},
    setStepStatus: async () => {},
    sleepWithStop: async () => {},
    throwIfStopped: () => {},
    VERIFICATION_POLL_MAX_ROUNDS: 5,
  });

  await helpers.resolveVerificationStep(
    4,
    { email: 'user@example.com', lastSignupCode: null },
    { provider: 'qq', label: 'QQ 邮箱' },
    {
      signupProfile: {
        firstName: 'Ada',
        lastName: 'Lovelace',
        year: 2003,
        month: 6,
        day: 19,
      },
    }
  );

  assert.equal(resilientCalls[0].payload.signupProfile.firstName, 'Ada');
  assert.deepStrictEqual(completed, [
    {
      step: 4,
      payload: {
        emailTimestamp: 123,
        code: '654321',
        phoneVerificationRequired: false,
        skipProfileStep: true,
        skipProfileStepReason: 'combined_verification_profile',
      },
    },
  ]);
});

test('verification flow treats retryable submit transport failure as success when step 4 already redirected to logged-in home', async () => {
  const logs = [];

  const helpers = api.createVerificationFlowHelpers({
    addLog: async (message, level = 'info') => {
      logs.push({ message, level });
    },
    chrome: {
      tabs: {
        update: async () => {},
        get: async () => ({ url: 'https://chatgpt.com/' }),
      },
    },
    CLOUDFLARE_TEMP_EMAIL_PROVIDER: 'cloudflare-temp-email',
    completeStepFromBackground: async () => {},
    confirmCustomVerificationStepBypassRequest: async () => ({ confirmed: true }),
    getHotmailVerificationPollConfig: () => ({}),
    getHotmailVerificationRequestTimestamp: () => 0,
    getState: async () => ({}),
    getTabId: async () => 1,
    HOTMAIL_PROVIDER: 'hotmail-api',
    isRetryableContentScriptTransportError: (error) => /message channel is closed/i.test(String(error?.message || error || '')),
    isStopError: () => false,
    LUCKMAIL_PROVIDER: 'luckmail-api',
    MAIL_2925_VERIFICATION_INTERVAL_MS: 15000,
    MAIL_2925_VERIFICATION_MAX_ATTEMPTS: 15,
    pollCloudflareTempEmailVerificationCode: async () => ({}),
    pollHotmailVerificationCode: async () => ({}),
    pollLuckmailVerificationCode: async () => ({}),
    sendToContentScript: async () => {
      throw new Error('should not use non-resilient channel');
    },
    sendToContentScriptResilient: async () => {
      throw new Error('The page keeping the extension port is moved into back/forward cache, so the message channel is closed.');
    },
    sendToMailContentScriptResilient: async () => ({}),
    setState: async () => {},
    setStepStatus: async () => {},
    sleepWithStop: async () => {},
    throwIfStopped: () => {},
    VERIFICATION_POLL_MAX_ROUNDS: 5,
  });

  const result = await helpers.submitVerificationCode(4, '654321');

  assert.equal(result.success, true);
  assert.equal(result.skipProfileStep, true);
  assert.equal(result.assumed, true);
  assert.equal(result.transportRecovered, true);
  assert.equal(logs.some(({ message }) => /验证码提交后页面已切换到ChatGPT 已登录首页/.test(message)), true);
});

test('verification flow avoids resend storms when iCloud polling keeps hitting transport errors', async () => {
  let resendRequests = 0;
  let pollAttempts = 0;

  const helpers = api.createVerificationFlowHelpers({
    addLog: async () => {},
    chrome: {
      tabs: {
        update: async () => {},
      },
    },
    CLOUDFLARE_TEMP_EMAIL_PROVIDER: 'cloudflare-temp-email',
    completeStepFromBackground: async () => {},
    confirmCustomVerificationStepBypassRequest: async () => ({ confirmed: true }),
    getHotmailVerificationPollConfig: () => ({}),
    getHotmailVerificationRequestTimestamp: () => 0,
    getState: async () => ({}),
    getTabId: async () => 1,
    HOTMAIL_PROVIDER: 'hotmail-api',
    isStopError: () => false,
    LUCKMAIL_PROVIDER: 'luckmail-api',
    MAIL_2925_VERIFICATION_INTERVAL_MS: 15000,
    MAIL_2925_VERIFICATION_MAX_ATTEMPTS: 15,
    pollCloudflareTempEmailVerificationCode: async () => ({}),
    pollHotmailVerificationCode: async () => ({}),
    pollLuckmailVerificationCode: async () => ({}),
    sendToContentScript: async (_source, message) => {
      if (message.type === 'RESEND_VERIFICATION_CODE') {
        resendRequests += 1;
        return {};
      }
      return {};
    },
    sendToMailContentScriptResilient: async () => {
      pollAttempts += 1;
      throw new Error('Content script on icloud-mail did not respond in 1s. Try refreshing the tab and retry.');
    },
    setState: async () => {},
    setStepStatus: async () => {},
    sleepWithStop: async () => {},
    throwIfStopped: () => {},
    VERIFICATION_POLL_MAX_ROUNDS: 5,
  });

  await assert.rejects(
    helpers.pollFreshVerificationCodeWithResendInterval(
      8,
      { email: 'user@example.com', lastLoginCode: null },
      { source: 'icloud-mail', provider: 'icloud', label: 'iCloud 邮箱' },
      {
        intervalMs: 1000,
        maxAttempts: 1,
        resendIntervalMs: 25000,
        maxResendRequests: 2,
      }
    ),
    /页面通信异常连续/
  );

  assert.equal(pollAttempts >= 6, true);
  assert.equal(resendRequests, 0);
});

test('verification flow stops iCloud poll-only loop after repeated no-code rounds before resend', async () => {
  let resendRequests = 0;
  let pollCalls = 0;

  const helpers = api.createVerificationFlowHelpers({
    addLog: async () => {},
    chrome: {
      tabs: {
        update: async () => {},
      },
    },
    CLOUDFLARE_TEMP_EMAIL_PROVIDER: 'cloudflare-temp-email',
    completeStepFromBackground: async () => {},
    confirmCustomVerificationStepBypassRequest: async () => ({ confirmed: true }),
    getHotmailVerificationPollConfig: () => ({}),
    getHotmailVerificationRequestTimestamp: () => 0,
    getState: async () => ({}),
    getTabId: async () => 1,
    HOTMAIL_PROVIDER: 'hotmail-api',
    isStopError: () => false,
    LUCKMAIL_PROVIDER: 'luckmail-api',
    MAIL_2925_VERIFICATION_INTERVAL_MS: 15000,
    MAIL_2925_VERIFICATION_MAX_ATTEMPTS: 15,
    pollCloudflareTempEmailVerificationCode: async () => ({}),
    pollHotmailVerificationCode: async () => ({}),
    pollLuckmailVerificationCode: async () => ({}),
    sendToContentScript: async (_source, message) => {
      if (message.type === 'RESEND_VERIFICATION_CODE') {
        resendRequests += 1;
      }
      return {};
    },
    sendToMailContentScriptResilient: async () => {
      pollCalls += 1;
      return {};
    },
    setState: async () => {},
    setStepStatus: async () => {},
    sleepWithStop: async () => {},
    throwIfStopped: () => {},
    VERIFICATION_POLL_MAX_ROUNDS: 5,
  });

  await assert.rejects(
    helpers.pollFreshVerificationCodeWithResendInterval(
      8,
      { email: 'user@example.com', lastLoginCode: null },
      { source: 'icloud-mail', provider: 'icloud', label: 'iCloud 邮箱' },
      {
        intervalMs: 1000,
        maxAttempts: 1,
        resendIntervalMs: 25000,
        maxResendRequests: 2,
      }
    ),
    /空轮询循环|停止当前链路/
  );

  assert.equal(pollCalls >= 4, true);
  assert.equal(resendRequests, 0);
});

test('verification flow derives iCloud polling response timeout from the configured polling window', async () => {
  const pollRequests = [];

  const helpers = api.createVerificationFlowHelpers({
    addLog: async () => {},
    chrome: {
      tabs: {
        update: async () => {},
      },
    },
    CLOUDFLARE_TEMP_EMAIL_PROVIDER: 'cloudflare-temp-email',
    completeStepFromBackground: async () => {},
    confirmCustomVerificationStepBypassRequest: async () => ({ confirmed: true }),
    getHotmailVerificationPollConfig: () => ({}),
    getHotmailVerificationRequestTimestamp: () => 0,
    getState: async () => ({}),
    getTabId: async () => 1,
    HOTMAIL_PROVIDER: 'hotmail-api',
    isStopError: () => false,
    LUCKMAIL_PROVIDER: 'luckmail-api',
    MAIL_2925_VERIFICATION_INTERVAL_MS: 15000,
    MAIL_2925_VERIFICATION_MAX_ATTEMPTS: 15,
    pollCloudflareTempEmailVerificationCode: async () => ({}),
    pollHotmailVerificationCode: async () => ({}),
    pollLuckmailVerificationCode: async () => ({}),
    sendToContentScript: async (_source, message) => {
      if (message.type === 'RESEND_VERIFICATION_CODE') {
        return {};
      }
      return {};
    },
    sendToMailContentScriptResilient: async (_mail, message, options = {}) => {
      pollRequests.push({
        payload: message.payload,
        timeoutMs: Number(options.timeoutMs) || 0,
        responseTimeoutMs: Number(options.responseTimeoutMs) || 0,
      });
      return {};
    },
    setState: async () => {},
    setStepStatus: async () => {},
    sleepWithStop: async () => {},
    throwIfStopped: () => {},
    VERIFICATION_POLL_MAX_ROUNDS: 5,
  });

  await assert.rejects(
    helpers.pollFreshVerificationCodeWithResendInterval(
      4,
      { email: 'user@example.com', lastSignupCode: null },
      { source: 'icloud-mail', provider: 'icloud', label: 'iCloud 邮箱' },
      {
        intervalMs: 3000,
        maxAttempts: 5,
        resendIntervalMs: 25000,
        maxResendRequests: 1,
      }
    ),
    /空轮询循环|停止当前链路/
  );

  assert.equal(pollRequests.length > 0, true);
  assert.equal(
    pollRequests.every(({ payload, responseTimeoutMs }) => responseTimeoutMs >= (payload.maxAttempts * payload.intervalMs) + 10000),
    true
  );
  assert.equal(
    pollRequests.every(({ timeoutMs, responseTimeoutMs }) => timeoutMs >= responseTimeoutMs),
    true
  );
});
