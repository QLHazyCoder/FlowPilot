const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');

const source = fs.readFileSync('background/verification-flow.js', 'utf8');
const globalScope = {};
const api = new Function('self', `${source}; return self.MultiPageBackgroundVerificationFlow;`)(globalScope);

test('verification flow uses yahoo foreground top-message command', async () => {
  const calls = [];
  const helpers = api.createVerificationFlowHelpers({
    addLog: async () => {},
    buildVerificationPollPayload: (_step, state, overrides = {}) => ({
      step: 4,
      filterAfterTimestamp: 0,
      targetEmail: state.email,
      maxAttempts: 60,
      intervalMs: 5000,
      ...overrides,
    }),
    chrome: {
      tabs: {
        get: async () => ({ url: 'https://mail.yahoo.com/n/inbox/all?listFilter=ALL_INBOX' }),
        remove: async () => {},
        update: async () => {},
      },
    },
    closeConflictingTabsForSource: async () => {},
    CLOUDFLARE_TEMP_EMAIL_PROVIDER: 'cloudflare-temp-email',
    CLOUD_MAIL_PROVIDER: 'cloudmail',
    completeNodeFromBackground: async () => {},
    confirmCustomVerificationStepBypassRequest: async () => ({}),
    getNodeIdByStepForState: () => 'fetch-signup-code',
    getHotmailVerificationPollConfig: () => ({}),
    getHotmailVerificationRequestTimestamp: () => 0,
    handleMail2925LimitReachedError: async (_step, err) => err,
    getState: async () => ({ mailProvider: 'yahoo' }),
    getTabId: async (sourceId) => (sourceId === 'signup-page' ? 1 : 2),
    HOTMAIL_PROVIDER: 'hotmail-api',
    isMail2925LimitReachedError: () => false,
    isStopError: () => false,
    isTabAlive: async () => true,
    LUCKMAIL_PROVIDER: 'luckmail-api',
    YYDS_MAIL_PROVIDER: 'yyds-mail',
    MAIL_2925_VERIFICATION_INTERVAL_MS: 15000,
    MAIL_2925_VERIFICATION_MAX_ATTEMPTS: 15,
    pollCloudflareTempEmailVerificationCode: async () => ({}),
    pollCloudMailVerificationCode: async () => ({}),
    pollHotmailVerificationCode: async () => ({}),
    pollLuckmailVerificationCode: async () => ({}),
    pollYydsMailVerificationCode: async () => ({}),
    reuseOrCreateTab: async () => 2,
    sendToContentScript: async (_sourceId, message) => {
      calls.push(['sendToContentScript', message]);
      return {};
    },
    sendToContentScriptResilient: async () => ({}),
    sendToMailContentScriptResilient: async (_mail, message) => {
      calls.push(['sendToMailContentScriptResilient', message]);
      return {
        code: '123456',
        emailTimestamp: 111,
        freshnessMatched: true,
        topMessageFingerprint: 'fp-1',
      };
    },
    setNodeStatus: async () => {},
    setState: async () => {},
    sleepWithStop: async () => {},
    throwIfStopped: () => {},
    VERIFICATION_POLL_MAX_ROUNDS: 5,
  });

  const result = await helpers.pollFreshVerificationCode(
    4,
    { mailProvider: 'yahoo', email: 'user@yahoo.com' },
    {
      provider: 'yahoo',
      source: 'yahoo-mail',
      url: 'https://mail.yahoo.com/n/inbox/all?listFilter=ALL_INBOX',
      label: 'Yahoo 邮箱',
      inject: ['content/activation-utils.js', 'shared/source-registry.js', 'content/utils.js', 'content/yahoo-mail.js'],
      injectSource: 'yahoo-mail',
    },
    {
      intervalMs: 5000,
      maxAttempts: 60,
      refreshesBeforeResend: 5,
      maxResendRequests: 0,
      seedRejectedCodesFromState: false,
    }
  );

  assert.equal(result.code, '123456');
  assert.equal(calls.some(([, message]) => message.type === 'RESEND_VERIFICATION_CODE'), true);
  const yahooCheck = calls.find(([, message]) => message.type === 'YAHOO_CHECK_TOP_MESSAGE');
  assert.ok(yahooCheck);
  assert.equal(yahooCheck[1].payload.yahooTopRowOnly, true);
  assert.equal(yahooCheck[1].payload.filterAfterTimestamp, 0);
});

