const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');

const source = fs.readFileSync('background/steps/fetch-signup-code.js', 'utf8');
const globalScope = {};
const api = new Function('self', `${source}; return self.MultiPageBackgroundStep4;`)(globalScope);

test('step 4 passes a fixed 10-minute lookback window to 2925 mailbox polling', async () => {
  let capturedOptions = null;
  let ensureCalls = 0;
  const tabUpdates = [];
  const tabReuses = [];
  const realDateNow = Date.now;
  Date.now = () => 700000;

  const executor = api.createStep4Executor({
    addLog: async () => {},
    chrome: {
      tabs: {
        update: async (tabId, payload) => {
          tabUpdates.push({ tabId, payload });
        },
      },
    },
    completeStepFromBackground: async () => {},
    confirmCustomVerificationStepBypass: async () => {},
    ensureMail2925MailboxSession: async () => {
      ensureCalls += 1;
    },
    getMailConfig: () => ({
      provider: '2925',
      label: '2925 邮箱',
      source: 'mail-2925',
      url: 'https://2925.com',
    }),
    getTabId: async () => 1,
    HOTMAIL_PROVIDER: 'hotmail-api',
    isTabAlive: async () => true,
    LUCKMAIL_PROVIDER: 'luckmail-api',
    CLOUDFLARE_TEMP_EMAIL_PROVIDER: 'cloudflare-temp-email',
    resolveVerificationStep: async (_step, _state, _mail, options) => {
      capturedOptions = options;
    },
    reuseOrCreateTab: async (source, url) => {
      tabReuses.push({ source, url });
    },
    sendToContentScript: async () => ({}),
    sendToContentScriptResilient: async () => ({}),
    isRetryableContentScriptTransportError: () => false,
    shouldUseCustomRegistrationEmail: () => false,
    STANDARD_MAIL_VERIFICATION_RESEND_INTERVAL_MS: 25000,
    throwIfStopped: () => {},
  });

  try {
    await executor.executeStep4({
      email: 'user@example.com',
      password: 'secret',
      mail2925UseAccountPool: true,
    });
  } finally {
    Date.now = realDateNow;
  }

  assert.equal(ensureCalls, 1);
  assert.deepStrictEqual(tabReuses, []);
  assert.deepStrictEqual(tabUpdates, [
    { tabId: 1, payload: { active: true } },
  ]);
  assert.equal(capturedOptions.filterAfterTimestamp, 100000);
  assert.equal(capturedOptions.resendIntervalMs, 0);
});

test('step 4 does not request a fresh code first for Cloudflare temp mail', async () => {
  let capturedOptions = null;
  const realDateNow = Date.now;
  Date.now = () => 700000;

  const executor = api.createStep4Executor({
    addLog: async () => {},
    chrome: {
      tabs: {
        update: async () => {},
      },
    },
    completeStepFromBackground: async () => {},
    confirmCustomVerificationStepBypass: async () => {},
    ensureMail2925MailboxSession: async () => {},
    getMailConfig: () => ({
      provider: 'cloudflare-temp-email',
      label: 'Cloudflare Temp Email',
      source: 'cloudflare-temp-email',
      url: 'https://temp.peekcart.com',
    }),
    getTabId: async () => 1,
    HOTMAIL_PROVIDER: 'hotmail-api',
    isTabAlive: async () => true,
    LUCKMAIL_PROVIDER: 'luckmail-api',
    CLOUDFLARE_TEMP_EMAIL_PROVIDER: 'cloudflare-temp-email',
    resolveVerificationStep: async (_step, _state, _mail, options) => {
      capturedOptions = options;
    },
    reuseOrCreateTab: async () => {},
    sendToContentScript: async () => ({}),
    sendToContentScriptResilient: async () => ({}),
    isRetryableContentScriptTransportError: () => false,
    shouldUseCustomRegistrationEmail: () => false,
    STANDARD_MAIL_VERIFICATION_RESEND_INTERVAL_MS: 25000,
    throwIfStopped: () => {},
  });

  try {
    await executor.executeStep4({
      email: 'user@example.com',
      password: 'secret',
    });
  } finally {
    Date.now = realDateNow;
  }

  assert.equal(capturedOptions.filterAfterTimestamp, 700000);
  assert.equal(capturedOptions.requestFreshCodeFirst, false);
  assert.equal(capturedOptions.resendIntervalMs, 25000);
});

test('step 4 checks iCloud session before polling iCloud mailbox', async () => {
  let icloudChecks = 0;
  let resolved = false;

  const executor = api.createStep4Executor({
    addLog: async () => {},
    chrome: {
      tabs: {
        update: async () => {},
      },
    },
    completeStepFromBackground: async () => {},
    confirmCustomVerificationStepBypass: async () => {},
    ensureIcloudMailSession: async () => {
      icloudChecks += 1;
    },
    ensureMail2925MailboxSession: async () => {},
    getMailConfig: () => ({
      source: 'icloud-mail',
      url: 'https://www.icloud.com/mail/',
      label: 'iCloud 邮箱',
    }),
    getTabId: async () => 1,
    HOTMAIL_PROVIDER: 'hotmail-api',
    isTabAlive: async () => true,
    LUCKMAIL_PROVIDER: 'luckmail-api',
    CLOUDFLARE_TEMP_EMAIL_PROVIDER: 'cloudflare-temp-email',
    resolveVerificationStep: async () => {
      resolved = true;
    },
    reuseOrCreateTab: async () => {},
    sendToContentScript: async () => ({}),
    sendToContentScriptResilient: async () => ({}),
    isRetryableContentScriptTransportError: () => false,
    shouldUseCustomRegistrationEmail: () => false,
    STANDARD_MAIL_VERIFICATION_RESEND_INTERVAL_MS: 25000,
    throwIfStopped: () => {},
  });

  await executor.executeStep4({
    email: 'user@example.com',
    password: 'secret',
  });

  assert.equal(icloudChecks, 1);
  assert.equal(resolved, true);
});

test('step 4 forwards skipProfileStep when prepare stage already reached logged-in home', async () => {
  const completions = [];
  let resolveCalls = 0;

  const executor = api.createStep4Executor({
    addLog: async () => {},
    chrome: {
      tabs: {
        update: async () => {},
      },
    },
    completeStepFromBackground: async (step, payload) => {
      completions.push({ step, payload });
    },
    confirmCustomVerificationStepBypass: async () => {},
    ensureMail2925MailboxSession: async () => {},
    getMailConfig: () => ({
      provider: '163',
      label: '163 邮箱',
      source: 'mail-163',
      url: 'https://mail.163.com',
    }),
    getTabId: async () => 1,
    HOTMAIL_PROVIDER: 'hotmail-api',
    isTabAlive: async () => true,
    LUCKMAIL_PROVIDER: 'luckmail-api',
    CLOUDFLARE_TEMP_EMAIL_PROVIDER: 'cloudflare-temp-email',
    resolveVerificationStep: async () => {
      resolveCalls += 1;
    },
    reuseOrCreateTab: async () => {},
    sendToContentScript: async () => ({
      alreadyVerified: true,
      skipProfileStep: true,
    }),
    sendToContentScriptResilient: async () => ({
      alreadyVerified: true,
      skipProfileStep: true,
    }),
    isRetryableContentScriptTransportError: () => false,
    shouldUseCustomRegistrationEmail: () => false,
    STANDARD_MAIL_VERIFICATION_RESEND_INTERVAL_MS: 25000,
    throwIfStopped: () => {},
  });

  await executor.executeStep4({
    email: 'user@example.com',
    password: 'secret',
  });

  assert.deepStrictEqual(completions, [
    {
      step: 4,
      payload: { skipProfileStep: true },
    },
  ]);
  assert.equal(resolveCalls, 0);
});

test('step 4 phone signup branch uses SMS helper and does not poll mailbox', async () => {
  const completions = [];
  const phoneCalls = [];
  let getMailConfigCalls = 0;
  let resolveCalls = 0;

  const executor = api.createStep4Executor({
    addLog: async () => {},
    chrome: {
      tabs: {
        update: async () => {},
      },
    },
    completeStepFromBackground: async (step, payload) => {
      completions.push({ step, payload });
    },
    confirmCustomVerificationStepBypass: async () => {},
    ensureMail2925MailboxSession: async () => {},
    getMailConfig: () => {
      getMailConfigCalls += 1;
      throw new Error('mail config should not be required for phone signup');
    },
    getTabId: async () => 1,
    HOTMAIL_PROVIDER: 'hotmail-api',
    isTabAlive: async () => true,
    LUCKMAIL_PROVIDER: 'luckmail-api',
    CLOUDFLARE_TEMP_EMAIL_PROVIDER: 'cloudflare-temp-email',
    phoneVerificationHelpers: {
      completeSignupPhoneVerificationFlow: async (tabId, options) => {
        phoneCalls.push({ tabId, options });
        return {
          success: true,
          skipProfileStep: true,
          skipProfileStepReason: 'combined_verification_profile',
        };
      },
    },
    resolveSignupMethod: () => 'phone',
    resolveVerificationStep: async () => {
      resolveCalls += 1;
    },
    reuseOrCreateTab: async () => {},
    sendToContentScript: async () => ({ ready: true }),
    sendToContentScriptResilient: async () => ({ ready: true }),
    isRetryableContentScriptTransportError: () => false,
    shouldUseCustomRegistrationEmail: () => false,
    STANDARD_MAIL_VERIFICATION_RESEND_INTERVAL_MS: 25000,
    throwIfStopped: () => {},
  });

  await executor.executeStep4({
    resolvedSignupMethod: 'phone',
    accountIdentifierType: 'phone',
    signupPhoneNumber: '66959916439',
    signupPhoneActivation: { activationId: 'signup-123', phoneNumber: '66959916439' },
  });

  assert.equal(getMailConfigCalls, 0);
  assert.equal(resolveCalls, 0);
  assert.equal(phoneCalls.length, 1);
  assert.equal(phoneCalls[0].tabId, 1);
  assert.equal(phoneCalls[0].options.state.accountIdentifierType, 'phone');
  assert.equal(Object.prototype.hasOwnProperty.call(phoneCalls[0].options, 'signupProfile'), true);
  assert.deepStrictEqual(completions, [
    {
      step: 4,
      payload: {
        phoneVerification: true,
        code: '',
        skipProfileStep: true,
        skipProfileStepReason: 'combined_verification_profile',
      },
    },
  ]);
});

test('step 4 phone signup email-verification handoff polls mailbox instead of completing phone-only', async () => {
  const completions = [];
  const phoneCalls = [];
  const mailConfigCalls = [];
  const resolvedCalls = [];
  const tabReuses = [];

  const executor = api.createStep4Executor({
    addLog: async () => {},
    chrome: {
      tabs: {
        update: async () => {},
      },
    },
    completeStepFromBackground: async (step, payload) => {
      completions.push({ step, payload });
    },
    confirmCustomVerificationStepBypass: async () => {},
    ensureMail2925MailboxSession: async () => {},
    getMailConfig: (state) => {
      mailConfigCalls.push({ state });
      return {
        provider: '163',
        label: '163 邮箱',
        source: 'mail-163',
        url: 'https://mail.163.com',
      };
    },
    getTabId: async () => 1,
    HOTMAIL_PROVIDER: 'hotmail-api',
    isTabAlive: async () => false,
    LUCKMAIL_PROVIDER: 'luckmail-api',
    CLOUDFLARE_TEMP_EMAIL_PROVIDER: 'cloudflare-temp-email',
    phoneVerificationHelpers: {
      completeSignupPhoneVerificationFlow: async (tabId, options) => {
        phoneCalls.push({ tabId, options });
        return {
          success: true,
          code: '123456',
          emailVerificationRequired: true,
          emailVerificationPage: true,
          url: 'https://auth.openai.com/email-verification',
        };
      },
    },
    resolveSignupMethod: () => 'phone',
    resolveVerificationStep: async (step, state, mail, options) => {
      resolvedCalls.push({ step, state, mail, options });
    },
    reuseOrCreateTab: async (source, url) => {
      tabReuses.push({ source, url });
    },
    sendToContentScript: async () => ({ ready: true }),
    sendToContentScriptResilient: async () => ({ ready: true }),
    isRetryableContentScriptTransportError: () => false,
    shouldUseCustomRegistrationEmail: () => false,
    STANDARD_MAIL_VERIFICATION_RESEND_INTERVAL_MS: 25000,
    throwIfStopped: () => {},
  });

  await executor.executeStep4({
    email: 'user@example.com',
    resolvedSignupMethod: 'phone',
    accountIdentifierType: 'phone',
    signupPhoneNumber: '66959916439',
    signupPhoneActivation: { activationId: 'signup-123', phoneNumber: '66959916439' },
  });

  assert.equal(phoneCalls.length, 1);
  assert.equal(mailConfigCalls.length, 1);
  assert.equal(resolvedCalls.length, 1);
  assert.deepStrictEqual(completions, []);
  assert.deepStrictEqual(tabReuses, [
    { source: 'mail-163', url: 'https://mail.163.com' },
  ]);
  assert.equal(resolvedCalls[0].step, 4);
  assert.equal(resolvedCalls[0].mail.label, '163 邮箱');
  assert.equal(resolvedCalls[0].options.requestFreshCodeFirst, true);
  assert.equal(Object.prototype.hasOwnProperty.call(resolvedCalls[0].options, 'signupProfile'), true);
});

test('step 4 prepare retries transport by recovering retry page without replaying full prepare loop', async () => {
  let sendToContentScriptCalls = 0;
  let recoverCalls = 0;
  let resolveCalls = 0;
  const logs = [];

  const executor = api.createStep4Executor({
    addLog: async (message, level) => {
      logs.push({ message, level: level || 'info' });
    },
    chrome: {
      tabs: {
        update: async () => {},
      },
    },
    completeStepFromBackground: async () => {},
    confirmCustomVerificationStepBypass: async () => {},
    ensureMail2925MailboxSession: async () => {},
    getMailConfig: () => ({
      provider: '163',
      label: '163 邮箱',
      source: 'mail-163',
      url: 'https://mail.163.com',
    }),
    getTabId: async () => 1,
    HOTMAIL_PROVIDER: 'hotmail-api',
    isTabAlive: async () => true,
    LUCKMAIL_PROVIDER: 'luckmail-api',
    CLOUDFLARE_TEMP_EMAIL_PROVIDER: 'cloudflare-temp-email',
    resolveVerificationStep: async () => {
      resolveCalls += 1;
    },
    reuseOrCreateTab: async () => {},
    sendToContentScript: async (_source, message) => {
      if (message.type !== 'PREPARE_SIGNUP_VERIFICATION') {
        return {};
      }
      sendToContentScriptCalls += 1;
      if (sendToContentScriptCalls === 1) {
        throw new Error('Content script on signup-page did not respond in 30s. Try refreshing the tab and retry.');
      }
      return { ready: true };
    },
    sendToContentScriptResilient: async (_source, message) => {
      if (message.type === 'RECOVER_AUTH_RETRY_PAGE') {
        recoverCalls += 1;
        return { recovered: true };
      }
      return {};
    },
    isRetryableContentScriptTransportError: (error) => /did not respond in \d+s/i.test(String(error?.message || error)),
    shouldUseCustomRegistrationEmail: () => false,
    STANDARD_MAIL_VERIFICATION_RESEND_INTERVAL_MS: 25000,
    throwIfStopped: () => {},
  });

  await executor.executeStep4({
    email: 'user@example.com',
    password: 'secret',
  });

  assert.equal(sendToContentScriptCalls, 2);
  assert.equal(recoverCalls, 1);
  assert.equal(resolveCalls, 1);
  assert.equal(
    logs.some((entry) => /正在确认注册验证码页面是否就绪/.test(entry.message)),
    true
  );
});
