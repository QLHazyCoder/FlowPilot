const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');

const source = fs.readFileSync('background/steps/fetch-login-code.js', 'utf8');
const globalScope = {};
const api = new Function('self', `${source}; return self.MultiPageBackgroundStep8;`)(globalScope);

test('step 8 uses yahoo refresh-then-resend polling cycle', async () => {
  let capturedOptions = null;
  const realDateNow = Date.now;
  const realSetTimeout = global.setTimeout;
  Date.now = () => 700000;
  global.setTimeout = (callback) => {
    if (typeof callback === 'function') callback();
    return 0;
  };

  const executor = api.createStep8Executor({
    addLog: async () => {},
    chrome: {
      tabs: {
        update: async () => {},
      },
    },
    CLOUDFLARE_TEMP_EMAIL_PROVIDER: 'cloudflare-temp-email',
    confirmCustomVerificationStepBypass: async () => {},
    ensureMail2925MailboxSession: async () => {},
    ensureStep8VerificationPageReady: async () => ({ displayedEmail: 'user@example.com' }),
    getMailConfig: () => ({
      provider: 'yahoo',
      label: 'Yahoo 邮箱',
      source: 'yahoo-mail',
      url: 'https://mail.yahoo.com/n/inbox/all',
    }),
    getState: async () => ({}),
    getTabId: async () => 1,
    HOTMAIL_PROVIDER: 'hotmail-api',
    isTabAlive: async () => false,
    isVerificationMailPollingError: () => false,
    LUCKMAIL_PROVIDER: 'luckmail-api',
    resolveVerificationStep: async (_step, _state, _mail, options) => {
      capturedOptions = options;
    },
    rerunStep7ForStep8Recovery: async () => {},
    reuseOrCreateTab: async () => {},
    setState: async () => {},
    shouldUseCustomRegistrationEmail: () => false,
    STANDARD_MAIL_VERIFICATION_RESEND_INTERVAL_MS: 25000,
    STEP7_MAIL_POLLING_RECOVERY_MAX_ATTEMPTS: 3,
    throwIfStopped: () => {},
  });

  try {
    await executor.executeStep8({
      email: 'user@example.com',
      oauthUrl: 'https://auth.openai.com/',
    });
  } finally {
    Date.now = realDateNow;
    global.setTimeout = realSetTimeout;
  }

  assert.equal(capturedOptions.requestFreshCodeFirst, false);
  assert.equal(capturedOptions.lastResendAt, 700000);
  assert.equal(capturedOptions.intervalMs, 5000);
  assert.equal(capturedOptions.maxAttempts, 60);
  assert.equal(capturedOptions.refreshesBeforeResend, 5);
  assert.equal(capturedOptions.maxResendRequests, 0);
  assert.equal(capturedOptions.keepRefreshingUntilCode, false);
  assert.equal(capturedOptions.resendIntervalMs, 25000);
});

test('step 8 yahoo mail config is normalized from legacy inbox url to standard all inbox', async () => {
  let capturedMail = null;

  const executor = api.createStep8Executor({
    addLog: async () => {},
    chrome: {
      tabs: {
        update: async () => {},
      },
    },
    CLOUDFLARE_TEMP_EMAIL_PROVIDER: 'cloudflare-temp-email',
    confirmCustomVerificationStepBypass: async () => {},
    ensureMail2925MailboxSession: async () => {},
    ensureStep8VerificationPageReady: async () => ({ displayedEmail: 'user@example.com' }),
    getMailConfig: () => ({
      provider: 'yahoo',
      label: 'Yahoo 邮箱',
      source: 'yahoo-mail',
      url: 'https://mail.yahoo.com/n/inbox/all',
    }),
    getState: async () => ({}),
    getTabId: async () => 1,
    HOTMAIL_PROVIDER: 'hotmail-api',
    isTabAlive: async () => false,
    isVerificationMailPollingError: () => false,
    LUCKMAIL_PROVIDER: 'luckmail-api',
    resolveVerificationStep: async (_step, _state, mail) => {
      capturedMail = mail;
    },
    rerunStep7ForStep8Recovery: async () => {},
    reuseOrCreateTab: async () => {},
    setState: async () => {},
    shouldUseCustomRegistrationEmail: () => false,
    STANDARD_MAIL_VERIFICATION_RESEND_INTERVAL_MS: 25000,
    STEP7_MAIL_POLLING_RECOVERY_MAX_ATTEMPTS: 3,
    throwIfStopped: () => {},
  });

  await executor.executeStep8({
    email: 'user@example.com',
    oauthUrl: 'https://auth.openai.com/',
  });

  assert.ok(capturedMail);
  assert.equal(capturedMail.url, 'https://mail.yahoo.com/n/inbox/all?listFilter=ALL_INBOX');
});
