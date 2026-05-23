const test = require('node:test');
const assert = require('node:assert/strict');

require('../background/cloudmail-provider.js');

function createProviderApi(options = {}) {
  const {
    receiveMailbox = '',
    messages = [{
      id: 'mail-1',
      address: 'user@example.com',
      receivedDateTime: '2026-05-07T09:20:00.000Z',
      subject: 'OpenAI verification code',
      from: { emailAddress: { address: 'noreply@tm.openai.com' } },
      bodyPreview: 'Your verification code is 123456.',
    }],
  } = options;
  const logs = [];
  const listCalls = [];
  const fetchImpl = async (url, request = {}) => {
    const payload = request.body ? JSON.parse(request.body) : {};
    if (String(url).includes('/api/public/emailList')) {
      listCalls.push(payload.toEmail || '');
      return {
        ok: true,
        text: async () => JSON.stringify({ code: 200, data: { records: messages } }),
      };
    }
    return {
      ok: true,
      text: async () => JSON.stringify({ code: 200, data: { token: 'token' } }),
    };
  };

  const api = globalThis.MultiPageBackgroundCloudMailProvider.createCloudMailProvider({
    addLog: async (message, level) => logs.push({ message, level }),
    buildCloudMailHeaders: () => ({}),
    CLOUD_MAIL_DEFAULT_PAGE_SIZE: 20,
    CLOUD_MAIL_GENERATOR: 'cloudmail',
    CLOUD_MAIL_PROVIDER: 'cloudmail',
    fetchImpl,
    getCloudMailTokenFromResponse: () => 'token',
    getState: async () => ({}),
    joinCloudMailUrl: (baseUrl, path) => `${baseUrl}${path}`,
    normalizeCloudMailAddress: (value) => String(value || '').trim().toLowerCase(),
    normalizeCloudMailBaseUrl: (value) => String(value || '').trim(),
    normalizeCloudMailDomain: (value) => String(value || '').trim(),
    normalizeCloudMailDomains: (values) => values || [],
    normalizeCloudMailMailApiMessages: (payload) => payload?.data?.records || [],
    pickVerificationMessageWithTimeFallback: (currentMessages) => ({
      match: currentMessages[0]
        ? {
            code: String(currentMessages[0].bodyPreview).match(/(\d{6})/)[1],
            receivedAt: Date.parse(currentMessages[0].receivedDateTime),
            message: currentMessages[0],
          }
        : null,
      usedRelaxedFilters: false,
      usedTimeFallback: false,
    }),
    setEmailState: async () => {},
    setPersistentSettings: async () => {},
    sleepWithStop: async () => {},
    throwIfStopped: () => {},
  });

  return {
    ...api,
    snapshot() {
      return { logs, listCalls };
    },
  };
}

test('pollCloudMailVerificationCode returns code for generated Cloud Mail address', async () => {
  const api = createProviderApi();

  const result = await api.pollCloudMailVerificationCode(4, {
    email: 'user@example.com',
    cloudMailBaseUrl: 'https://mail.example.com',
    cloudMailAdminEmail: 'admin@example.com',
    cloudMailAdminPassword: 'secret',
    cloudMailToken: 'token',
  }, {
    targetEmail: 'user@example.com',
    maxAttempts: 1,
    intervalMs: 1,
  });

  assert.equal(result.code, '123456');
  assert.deepEqual(api.snapshot().listCalls, ['user@example.com']);
});

test('pollCloudMailVerificationCode prefers configured receive mailbox over registration email', async () => {
  const api = createProviderApi({
    receiveMailbox: 'forward-box@example.com',
    messages: [{
      id: 'mail-2',
      address: 'forward-box@example.com',
      receivedDateTime: '2026-05-07T10:20:00.000Z',
      subject: 'Login verification code',
      from: { emailAddress: { address: 'noreply@tm.openai.com' } },
      bodyPreview: 'Your verification code is 654321.',
    }],
  });

  const result = await api.pollCloudMailVerificationCode(8, {
    email: 'duck-forwarded@duck.com',
    mailProvider: 'cloudmail',
    emailGenerator: 'duck',
    cloudMailBaseUrl: 'https://mail.example.com',
    cloudMailReceiveMailbox: 'forward-box@example.com',
    cloudMailAdminEmail: 'admin@example.com',
    cloudMailAdminPassword: 'secret',
    cloudMailToken: 'token',
  }, {
    targetEmail: 'duck-forwarded@duck.com',
    maxAttempts: 1,
    intervalMs: 1,
  });

  assert.equal(result.code, '654321');
  assert.deepEqual(api.snapshot().listCalls, ['forward-box@example.com']);
});

test('pollCloudMailVerificationCode ignores stale receive mailbox when generator owns the address', async () => {
  const api = createProviderApi({
    receiveMailbox: 'forward-box@example.com',
    messages: [{
      id: 'mail-3',
      address: 'generated@example.com',
      receivedDateTime: '2026-05-07T11:20:00.000Z',
      subject: 'Signup verification code',
      from: { emailAddress: { address: 'noreply@tm.openai.com' } },
      bodyPreview: 'Your verification code is 246810.',
    }],
  });

  const result = await api.pollCloudMailVerificationCode(4, {
    email: 'generated@example.com',
    mailProvider: 'cloudmail',
    emailGenerator: 'cloudmail',
    cloudMailBaseUrl: 'https://mail.example.com',
    cloudMailReceiveMailbox: 'forward-box@example.com',
    cloudMailAdminEmail: 'admin@example.com',
    cloudMailAdminPassword: 'secret',
    cloudMailToken: 'token',
  }, {
    targetEmail: 'generated@example.com',
    maxAttempts: 1,
    intervalMs: 1,
  });

  assert.equal(result.code, '246810');
  assert.deepEqual(api.snapshot().listCalls, ['generated@example.com']);
});

test('fetchCloudMailAddress preserves phone identity through the shared persistence helper', async () => {
  const persistCalls = [];
  const setEmailCalls = [];
  const api = globalThis.MultiPageBackgroundCloudMailProvider.createCloudMailProvider({
    addLog: async () => {},
    buildCloudMailHeaders: () => ({}),
    CLOUD_MAIL_DEFAULT_PAGE_SIZE: 20,
    CLOUD_MAIL_GENERATOR: 'cloudmail',
    CLOUD_MAIL_PROVIDER: 'cloudmail',
    fetchImpl: async (url) => {
      if (String(url).includes('/api/public/addUser')) {
        return {
          ok: true,
          text: async () => JSON.stringify({ code: 200 }),
        };
      }
      return {
        ok: true,
        text: async () => JSON.stringify({ code: 200, data: { token: 'token' } }),
      };
    },
    getCloudMailTokenFromResponse: () => 'token',
    getState: async () => ({}),
    joinCloudMailUrl: (baseUrl, path) => `${baseUrl}${path}`,
    normalizeCloudMailAddress: (value) => String(value || '').trim().toLowerCase(),
    normalizeCloudMailBaseUrl: (value) => String(value || '').trim(),
    normalizeCloudMailDomain: (value) => String(value || '').trim(),
    normalizeCloudMailDomains: (values) => values || [],
    normalizeCloudMailMailApiMessages: () => [],
    persistRegistrationEmailState: async (state, email, options) => {
      persistCalls.push({ state, email, options });
    },
    pickVerificationMessageWithTimeFallback: () => ({
      match: null,
      usedRelaxedFilters: false,
      usedTimeFallback: false,
    }),
    setEmailState: async (email) => {
      setEmailCalls.push(email);
    },
    setPersistentSettings: async () => {},
    sleepWithStop: async () => {},
    throwIfStopped: () => {},
  });

  const state = {
    cloudMailBaseUrl: 'https://mail.example.com',
    cloudMailAdminEmail: 'admin@example.com',
    cloudMailAdminPassword: 'secret',
    cloudMailToken: 'token',
    cloudMailDomain: 'example.com',
    accountIdentifierType: 'phone',
    accountIdentifier: '+447780579093',
    signupPhoneNumber: '+447780579093',
  };
  const email = await api.fetchCloudMailAddress(state, {
    localPart: 'fresh',
    preserveAccountIdentity: true,
  });

  assert.equal(email, 'fresh@example.com');
  assert.deepStrictEqual(setEmailCalls, []);
  assert.deepStrictEqual(persistCalls, [
    {
      state,
      email: 'fresh@example.com',
      options: {
        source: 'generated:cloudmail',
        preserveAccountIdentity: true,
      },
    },
  ]);
});

test('fetchCloudMailAddress builds random english name plus current date-time local part by default', async () => {
  const api = globalThis.MultiPageBackgroundCloudMailProvider.createCloudMailProvider({
    addLog: async () => {},
    buildCloudMailHeaders: () => ({}),
    CLOUD_MAIL_DEFAULT_PAGE_SIZE: 20,
    CLOUD_MAIL_GENERATOR: 'cloudmail',
    CLOUD_MAIL_PROVIDER: 'cloudmail',
    fetchImpl: async (url) => {
      if (String(url).includes('/api/public/addUser')) {
        return {
          ok: true,
          text: async () => JSON.stringify({ code: 200 }),
        };
      }
      return {
        ok: true,
        text: async () => JSON.stringify({ code: 200, data: { token: 'token' } }),
      };
    },
    getCloudMailTokenFromResponse: () => 'token',
    getState: async () => ({}),
    joinCloudMailUrl: (baseUrl, path) => `${baseUrl}${path}`,
    normalizeCloudMailAddress: (value) => String(value || '').trim().toLowerCase(),
    normalizeCloudMailBaseUrl: (value) => String(value || '').trim(),
    normalizeCloudMailDomain: (value) => String(value || '').trim(),
    normalizeCloudMailDomains: (values) => values || [],
    normalizeCloudMailMailApiMessages: () => [],
    persistRegistrationEmailState: async () => {},
    pickVerificationMessageWithTimeFallback: () => ({
      match: null,
      usedRelaxedFilters: false,
      usedTimeFallback: false,
    }),
    setEmailState: async () => {},
    setPersistentSettings: async () => {},
    sleepWithStop: async () => {},
    throwIfStopped: () => {},
  });

  const state = {
    cloudMailBaseUrl: 'https://mail.example.com',
    cloudMailAdminEmail: 'admin@example.com',
    cloudMailAdminPassword: 'secret',
    cloudMailToken: 'token',
    cloudMailDomain: 'example.com',
  };
  const email = await api.fetchCloudMailAddress(state, {
    date: '2026-05-17T08:09:10',
  });

  assert.match(email, /^[a-z]+20260517080910@example\.com$/);
});
