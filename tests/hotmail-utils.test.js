const test = require('node:test');
const assert = require('node:assert/strict');

const {
  buildHotmailMailApiLatestUrl,
  extractVerificationCodeFromMessage,
  filterHotmailAccountsByUsage,
  extractVerificationCode,
  getLatestHotmailMessage,
  getHotmailBulkActionLabel,
  getHotmailListToggleLabel,
  getHotmailMailApiRequestConfig,
  getHotmailVerificationPollConfig,
  getHotmailVerificationRequestTimestamp,
  normalizeHotmailServiceMode,
  normalizeHotmailMailApiMessages,
  parseHotmailImportText,
  pickHotmailAccountForRun,
  pickVerificationMessage,
  pickVerificationMessageWithFallback,
  pickVerificationMessageWithTimeFallback,
  shouldClearHotmailCurrentSelection,
  upsertHotmailAccountInList,
} = require('../hotmail-utils.js');

test('pickHotmailAccountForRun prefers authorized account with oldest lastUsedAt', () => {
  const now = Date.UTC(2026, 3, 10, 10, 0, 0);
  const accounts = [
    {
      id: 'recent',
      email: 'recent@hotmail.com',
      status: 'authorized',
      refreshToken: 'rt-recent',
      lastUsedAt: now - 1_000,
    },
    {
      id: 'oldest',
      email: 'oldest@hotmail.com',
      status: 'authorized',
      refreshToken: 'rt-oldest',
      lastUsedAt: now - 50_000,
    },
    {
      id: 'pending',
      email: 'pending@hotmail.com',
      status: 'pending',
      refreshToken: '',
      lastUsedAt: 0,
    },
  ];

  const selected = pickHotmailAccountForRun(accounts, { now });

  assert.equal(selected.id, 'oldest');
});

test('pickHotmailAccountForRun skips used accounts but ignores legacy enabled flag', () => {
  const accounts = [
    {
      id: 'disabled',
      email: 'disabled@hotmail.com',
      status: 'authorized',
      refreshToken: 'rt-disabled',
      enabled: false,
      used: false,
      lastUsedAt: 1,
    },
    {
      id: 'used',
      email: 'used@hotmail.com',
      status: 'authorized',
      refreshToken: 'rt-used',
      enabled: true,
      used: true,
      lastUsedAt: 0,
    },
    {
      id: 'available',
      email: 'available@hotmail.com',
      status: 'authorized',
      refreshToken: 'rt-available',
      enabled: true,
      used: false,
      lastUsedAt: 2,
    },
  ];

  const selected = pickHotmailAccountForRun(accounts, {});

  assert.equal(selected.id, 'disabled');
});

test('pickHotmailAccountForRun returns null for used-only pools', () => {
  assert.equal(
    pickHotmailAccountForRun([{
      id: 'used-only',
      email: 'used-only@hotmail.com',
      status: 'authorized',
      refreshToken: 'rt-used-only',
      used: true,
      lastUsedAt: 0,
    }], {}),
    null
  );
});

test('pickHotmailAccountForRun falls back to never-used authorized account first', () => {
  const accounts = [
    {
      id: 'used',
      email: 'used@hotmail.com',
      status: 'authorized',
      refreshToken: 'rt-used',
      lastUsedAt: Date.UTC(2026, 3, 10, 9, 0, 0),
    },
    {
      id: 'fresh',
      email: 'fresh@hotmail.com',
      status: 'authorized',
      refreshToken: 'rt-fresh',
      lastUsedAt: 0,
    },
  ];

  const selected = pickHotmailAccountForRun(accounts, { now: Date.UTC(2026, 3, 10, 10, 0, 0) });

  assert.equal(selected.id, 'fresh');
});

test('upsertHotmailAccountInList replaces matching account state by id', () => {
  const accounts = [
    {
      id: 'active',
      email: 'active@hotmail.com',
      status: 'authorized',
      used: false,
    },
    {
      id: 'other',
      email: 'other@hotmail.com',
      status: 'authorized',
      used: false,
    },
  ];

  const nextAccounts = upsertHotmailAccountInList(accounts, {
    id: 'active',
    email: 'active@hotmail.com',
    status: 'authorized',
    used: true,
  });

  assert.deepEqual(nextAccounts, [
    {
      id: 'active',
      email: 'active@hotmail.com',
      status: 'authorized',
      used: true,
    },
    {
      id: 'other',
      email: 'other@hotmail.com',
      status: 'authorized',
      used: false,
    },
  ]);
});

test('shouldClearHotmailCurrentSelection returns true only when account becomes used', () => {
  assert.equal(shouldClearHotmailCurrentSelection({
    id: 'used',
    used: true,
  }), true);

  assert.equal(shouldClearHotmailCurrentSelection({
    id: 'available',
    used: false,
  }), false);
});

test('extractVerificationCode returns first six-digit code from multilingual mail text', () => {
  assert.equal(extractVerificationCode('你的 ChatGPT 验证码为 370794，请勿泄露。'), '370794');
  assert.equal(extractVerificationCode('Your verification code is 654321.'), '654321');
  assert.equal(extractVerificationCode('ChatGPT Log-in Code\nIf that was you, enter this code:\n\n982219'), '982219');
  assert.equal(extractVerificationCode('No code here'), null);
});

test('extractVerificationCode supports runtime mail rule patterns', () => {
  assert.equal(
    extractVerificationCode('Mailbox notice: use pin A-778899 to continue.', {
      codePatterns: [{ source: 'pin\\s+A-(\\d{6})', flags: 'i' }],
    }),
    '778899'
  );
});

test('extractVerificationCode keeps capture groups when runtime patterns use global flags', () => {
  assert.equal(
    extractVerificationCode('验证码 248680', {
      codePatterns: [{ source: '(?:验证码)[：:\\s]*(\\d{6})', flags: 'gi' }],
    }),
    '248680'
  );
});

test('extractVerificationCodeFromMessage reads code from the latest message subject or preview', () => {
  assert.equal(
    extractVerificationCodeFromMessage({
      subject: '你的 ChatGPT 代码为 192742',
      bodyPreview: 'OpenAI 验证邮件',
      from: { emailAddress: { address: 'noreply@openai.com' } },
    }),
    '192742'
  );

  assert.equal(
    extractVerificationCodeFromMessage({
      subject: 'OpenAI security message',
      bodyPreview: 'Your verification code is 654321.',
      from: { emailAddress: { address: 'noreply@openai.com' } },
    }),
    '654321'
  );

  assert.equal(
    extractVerificationCodeFromMessage({
      subject: 'ChatGPT Log-in Code',
      bodyPreview: 'We noticed a suspicious log-in on your account. If that was you, enter this code:\n\n982219',
      from: { emailAddress: { address: 'noreply@openai.com' } },
    }),
    '982219'
  );
});

test('pickVerificationMessageWithTimeFallback supports required keyword hints and runtime code patterns', () => {
  const messages = [
    {
      id: 'mail-1',
      subject: 'Security center',
      from: { emailAddress: { address: 'alerts@example.com' } },
      bodyPreview: 'Use pin A-661122 to continue',
      receivedDateTime: '2026-04-14T10:06:00.000Z',
    },
  ];

  const result = pickVerificationMessageWithTimeFallback(messages, {
    afterTimestamp: 0,
    senderFilters: [],
    subjectFilters: [],
    requiredKeywords: ['security'],
    codePatterns: [{ source: 'pin\\s+A-(\\d{6})', flags: 'i' }],
    excludeCodes: [],
  });

  assert.equal(result.match?.code, '661122');
  assert.equal(result.usedTimeFallback, false);
});

test('getHotmailListToggleLabel reflects expanded state and account count', () => {
  assert.equal(getHotmailListToggleLabel(false, 0), '展开列表');
  assert.equal(getHotmailListToggleLabel(false, 7), '展开列表（7）');
  assert.equal(getHotmailListToggleLabel(true, 7), '收起列表（7）');
});

test('filterHotmailAccountsByUsage can pick only used accounts or return all accounts', () => {
  const accounts = [
    { id: 'used-1', email: 'used-1@hotmail.com', used: true },
    { id: 'fresh-1', email: 'fresh-1@hotmail.com', used: false },
    { id: 'used-2', email: 'used-2@hotmail.com', used: true },
  ];

  assert.deepEqual(
    filterHotmailAccountsByUsage(accounts, 'used').map((account) => account.id),
    ['used-1', 'used-2']
  );

  assert.deepEqual(
    filterHotmailAccountsByUsage(accounts, 'all').map((account) => account.id),
    ['used-1', 'fresh-1', 'used-2']
  );
});

test('getHotmailBulkActionLabel reflects action type and count', () => {
  assert.equal(getHotmailBulkActionLabel('used', 0), '清空已用');
  assert.equal(getHotmailBulkActionLabel('used', 3), '清空已用（3）');
  assert.equal(getHotmailBulkActionLabel('all', 5), '全部删除（5）');
});

test('getLatestHotmailMessage picks the newest received mail', () => {
  const latest = getLatestHotmailMessage([
    {
      id: 'older',
      subject: 'older',
      receivedDateTime: '2026-04-11T00:01:00.000Z',
    },
    {
      id: 'newest',
      subject: 'newest',
      receivedDateTime: '2026-04-11T00:05:00.000Z',
    },
    {
      id: 'middle',
      subject: 'middle',
      receivedDateTime: '2026-04-11T00:03:00.000Z',
    },
  ]);

  assert.equal(latest.id, 'newest');
});

test('pickVerificationMessage filters by time, sender, subject, and excluded codes', () => {
  const messages = [
    {
      id: 'old-mail',
      subject: 'Your code is 111111',
      from: { emailAddress: { address: 'noreply@openai.com' } },
      bodyPreview: '111111',
      receivedDateTime: '2026-04-10T09:00:00.000Z',
    },
    {
      id: 'wrong-sender',
      subject: 'Your code is 222222',
      from: { emailAddress: { address: 'noreply@example.com' } },
      bodyPreview: '222222',
      receivedDateTime: '2026-04-10T10:01:00.000Z',
    },
    {
      id: 'good-mail',
      subject: 'ChatGPT verification code 333333',
      from: { emailAddress: { address: 'noreply@openai.com' } },
      bodyPreview: 'Use 333333 to continue',
      receivedDateTime: '2026-04-10T10:02:00.000Z',
    },
    {
      id: 'excluded-mail',
      subject: 'ChatGPT verification code 444444',
      from: { emailAddress: { address: 'noreply@openai.com' } },
      bodyPreview: 'Use 444444 to continue',
      receivedDateTime: '2026-04-10T10:03:00.000Z',
    },
  ];

  const match = pickVerificationMessage(messages, {
    afterTimestamp: Date.UTC(2026, 3, 10, 10, 0, 0),
    senderFilters: ['openai', 'noreply'],
    subjectFilters: ['verification', 'code', 'chatgpt'],
    excludeCodes: ['444444'],
  });

  assert.equal(match.message.id, 'good-mail');
  assert.equal(match.code, '333333');
});

test('pickVerificationMessageWithFallback no longer matches arbitrary recent mails when filters miss', () => {
  const messages = [
    {
      id: 'login-mail',
      subject: 'Use this security code to continue 555666',
      from: { emailAddress: { address: 'account-security@openai.com' } },
      bodyPreview: 'Your one-time security code is 555666',
      receivedDateTime: '2026-04-10T10:05:00.000Z',
    },
  ];

  const result = pickVerificationMessageWithFallback(messages, {
    afterTimestamp: Date.UTC(2026, 3, 10, 10, 0, 0),
    senderFilters: ['noreply'],
    subjectFilters: ['verification'],
    excludeCodes: [],
  });

  assert.equal(result.match, null);
  assert.equal(result.usedRelaxedFilters, false);
  assert.equal(result.usedTimeFallback, false);
});

test('pickVerificationMessageWithTimeFallback can ignore afterTimestamp while keeping sender and subject filters', () => {
  const messages = [
    {
      id: 'slightly-old-mail',
      subject: '你的 ChatGPT 代码为 141735',
      from: { emailAddress: { address: 'unknown' } },
      bodyPreview: 'OpenAI logo ...',
      receivedDateTime: '2026-04-10T10:00:02.000Z',
    },
  ];

  const result = pickVerificationMessageWithTimeFallback(messages, {
    afterTimestamp: Date.UTC(2026, 3, 10, 10, 0, 10),
    senderFilters: ['openai', 'noreply'],
    subjectFilters: ['verify', 'verification', 'code'],
    excludeCodes: [],
  });

  assert.equal(result.match.message.id, 'slightly-old-mail');
  assert.equal(result.match.code, '141735');
  assert.equal(result.usedRelaxedFilters, false);
  assert.equal(result.usedTimeFallback, true);
});

test('pickVerificationMessageWithTimeFallback preserves runtime code patterns when only time is relaxed', () => {
  const messages = [
    {
      id: 'old-custom-code-mail',
      subject: 'AWS Builder ID verification',
      from: { emailAddress: { address: 'no-reply@signin.aws' } },
      bodyPreview: 'Use token A661122B to continue.',
      receivedDateTime: '2026-05-22T09:41:00.000Z',
    },
  ];

  const result = pickVerificationMessageWithTimeFallback(messages, {
    afterTimestamp: Date.UTC(2026, 4, 22, 9, 42, 0),
    senderFilters: ['signin.aws'],
    subjectFilters: ['aws'],
    codePatterns: [{ source: 'token\\s+A(\\d{6})B', flags: 'i' }],
    excludeCodes: [],
  });

  assert.equal(result.match.message.id, 'old-custom-code-mail');
  assert.equal(result.match.code, '661122');
  assert.equal(result.usedTimeFallback, true);
});

test('buildHotmailMailApiLatestUrl includes email, client id, refresh token, and mailbox', () => {
  const url = new URL(buildHotmailMailApiLatestUrl({
    apiUrl: 'https://example.com/api/mail-new',
    clientId: 'client-123',
    email: 'user@hotmail.com',
    refreshToken: 'refresh-token-xyz',
    mailbox: 'Junk',
  }));

  assert.equal(url.origin + url.pathname, 'https://example.com/api/mail-new');
  assert.equal(url.searchParams.get('client_id'), 'client-123');
  assert.equal(url.searchParams.get('email'), 'user@hotmail.com');
  assert.equal(url.searchParams.get('refresh_token'), 'refresh-token-xyz');
  assert.equal(url.searchParams.get('mailbox'), 'Junk');
  assert.equal(url.searchParams.get('response_type'), 'json');
});

test('buildHotmailMailApiLatestUrl requires an explicit api url', () => {
  assert.throws(
    () => buildHotmailMailApiLatestUrl({ email: 'user@hotmail.com' }),
    /Hotmail mail API URL is required/
  );
});

test('buildHotmailMailApiLatestUrl supports custom api url and can omit response_type', () => {
  const url = new URL(buildHotmailMailApiLatestUrl({
    apiUrl: 'https://example.com/custom-mail-api',
    clientId: 'client-789',
    email: 'custom@hotmail.com',
    refreshToken: 'refresh-token-custom',
    mailbox: 'Spam',
    responseType: '',
  }));

  assert.equal(url.origin + url.pathname, 'https://example.com/custom-mail-api');
  assert.equal(url.searchParams.get('client_id'), 'client-789');
  assert.equal(url.searchParams.get('email'), 'custom@hotmail.com');
  assert.equal(url.searchParams.get('refresh_token'), 'refresh-token-custom');
  assert.equal(url.searchParams.get('mailbox'), 'Spam');
  assert.equal(url.searchParams.has('response_type'), false);
});

test('normalizeHotmailMailApiMessages maps third-party payload fields into verification message shape', () => {
  const messages = normalizeHotmailMailApiMessages([
    {
      id: 'mail-1',
      from: 'noreply@openai.com',
      subject: 'ChatGPT verification code',
      text: 'Use 135790 to continue',
      date: '2026-04-10T10:02:00.000Z',
    },
    {
      message_id: 'mail-2',
      sender_email: 'alerts@example.com',
      title: 'Ignored',
      body: 'No code here',
      received_at: '2026-04-10T10:03:00.000Z',
    },
  ]);

  assert.deepEqual(messages, [
    {
      id: 'mail-1',
      subject: 'ChatGPT verification code',
      from: { emailAddress: { address: 'noreply@openai.com' } },
      bodyPreview: 'Use 135790 to continue',
      receivedDateTime: '2026-04-10T10:02:00.000Z',
    },
    {
      id: 'mail-2',
      subject: 'Ignored',
      from: { emailAddress: { address: 'alerts@example.com' } },
      bodyPreview: 'No code here',
      receivedDateTime: '2026-04-10T10:03:00.000Z',
    },
  ]);
});

test('getHotmailVerificationPollConfig gives Hotmail a slower initial wait and longer polling window', () => {
  assert.deepEqual(getHotmailVerificationPollConfig(4), {
    initialDelayMs: 5000,
    maxAttempts: 12,
    intervalMs: 5000,
    requestFreshCodeFirst: false,
    ignorePersistedLastCode: true,
  });

  assert.deepEqual(getHotmailVerificationPollConfig(7), {
    initialDelayMs: 5000,
    maxAttempts: 12,
    intervalMs: 5000,
    requestFreshCodeFirst: false,
    ignorePersistedLastCode: true,
  });
});

test('getHotmailVerificationRequestTimestamp prefers actual request timestamps with a safety buffer', () => {
  const signupRequestedAt = Date.UTC(2026, 3, 10, 12, 0, 30);
  const loginRequestedAt = Date.UTC(2026, 3, 10, 12, 5, 45);

  assert.equal(
    getHotmailVerificationRequestTimestamp(4, {
      signupVerificationRequestedAt: signupRequestedAt,
      flowStartTime: signupRequestedAt - 60_000,
    }),
    signupRequestedAt - 15_000
  );

  assert.equal(
    getHotmailVerificationRequestTimestamp(7, {
      loginVerificationRequestedAt: loginRequestedAt,
      lastEmailTimestamp: loginRequestedAt - 120_000,
      flowStartTime: loginRequestedAt - 300_000,
    }),
    loginRequestedAt - 15_000
  );
});

test('getHotmailMailApiRequestConfig defines third-party mail API request defaults', () => {
  assert.deepEqual(getHotmailMailApiRequestConfig(), {
    timeoutMs: 15000,
  });
});

test('normalizeHotmailServiceMode supports API对接 remote 模式并默认回退到本地助手', () => {
  assert.equal(normalizeHotmailServiceMode('remote'), 'remote');
  assert.equal(normalizeHotmailServiceMode('REMOTE'), 'remote');
  assert.equal(normalizeHotmailServiceMode('local'), 'local');
  assert.equal(normalizeHotmailServiceMode(''), 'local');
  assert.equal(normalizeHotmailServiceMode('unknown'), 'local');
});

test('parseHotmailImportText parses account lines in email----password----clientId----token format', () => {
  const parsed = parseHotmailImportText(`
账号----密码----ID----Token
JohnRodriguez5425@hotmail.com----nb4ta1OK----9e5f94bc-e8a4-4e73-b8be-63364c29d753----refresh-token-1
alice@hotmail.com----pass-2----client-2----refresh-token-2
  `.trim());

  assert.deepEqual(parsed, [
    {
      email: 'JohnRodriguez5425@hotmail.com',
      password: 'nb4ta1OK',
      clientId: '9e5f94bc-e8a4-4e73-b8be-63364c29d753',
      refreshToken: 'refresh-token-1',
    },
    {
      email: 'alice@hotmail.com',
      password: 'pass-2',
      clientId: 'client-2',
      refreshToken: 'refresh-token-2',
    },
  ]);
});
