const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');

const source = fs.readFileSync('flows/openai/background/steps/fetch-login-code.js', 'utf8');
const globalScope = {};
const api = new Function('self', `${source}; return self.MultiPageBackgroundStep8;`)(globalScope);

test('step 8 routes custom mail provider through resolver instead of manual confirmation', async () => {
  let bypassCalls = 0;
  let capturedMail = null;
  let capturedState = null;
  let capturedOptions = null;
  const executor = api.createStep8Executor({
    addLog: async () => {},
    chrome: { tabs: { update: async () => {} } },
    completeNodeFromBackground: async () => {},
    confirmCustomVerificationStepBypass: async () => { bypassCalls += 1; },
    ensureStep8VerificationPageReady: async () => ({
      state: 'verification_page',
      displayedEmail: 'target@example.com',
      url: 'https://auth.openai.com/verify',
    }),
    getMailConfig: () => ({ provider: 'custom', label: '自定义邮箱' }),
    getState: async () => ({ mailProvider: 'custom', email: 'target@example.com' }),
    getTabId: async () => 1,
    HOTMAIL_PROVIDER: 'hotmail-api',
    isTabAlive: async () => false,
    isVerificationMailPollingError: () => false,
    LUCKMAIL_PROVIDER: 'luckmail-api',
    CLOUDFLARE_TEMP_EMAIL_PROVIDER: 'cloudflare-temp-email',
    CLOUD_MAIL_PROVIDER: 'cloudmail',
    resolveVerificationStep: async (_step, state, mail, options) => {
      capturedState = state;
      capturedMail = mail;
      capturedOptions = options;
    },
    rerunStep7ForStep8Recovery: async () => {},
    resolveSignupEmailForFlow: async () => 'target@example.com',
    reuseOrCreateTab: async () => {},
    sendToContentScriptResilient: async () => ({}),
    setState: async () => {},
    shouldUseCustomRegistrationEmail: () => true,
    sleepWithStop: async () => {},
    STANDARD_MAIL_VERIFICATION_RESEND_INTERVAL_MS: 25000,
    STEP7_MAIL_POLLING_RECOVERY_MAX_ATTEMPTS: 1,
    throwIfStopped: () => {},
  });

  await executor.executeStep8({
    mailProvider: 'custom',
    email: 'target@example.com',
    oauthUrl: 'https://auth.openai.com/oauth',
  });

  assert.equal(bypassCalls, 0);
  assert.equal(capturedMail.provider, 'custom');
  assert.equal(capturedState.step8VerificationTargetEmail, 'target@example.com');
  assert.equal(capturedOptions.targetEmail, 'target@example.com');
});