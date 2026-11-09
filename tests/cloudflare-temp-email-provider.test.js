const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('fs');

const source = fs.readFileSync('background.js', 'utf8');

function extractFunction(name) {
  const markers = [`async function ${name}(`, `function ${name}(`];
  const start = markers
    .map((marker) => source.indexOf(marker))
    .find((index) => index >= 0);
  if (start < 0) {
    throw new Error(`missing function ${name}`);
  }

  let parenDepth = 0;
  let signatureEnded = false;
  let braceStart = -1;
  for (let i = start; i < source.length; i += 1) {
    const ch = source[i];
    if (ch === '(') {
      parenDepth += 1;
    } else if (ch === ')') {
      parenDepth -= 1;
      if (parenDepth === 0) {
        signatureEnded = true;
      }
    } else if (ch === '{' && signatureEnded) {
      braceStart = i;
      break;
    }
  }
  if (braceStart < 0) {
    throw new Error(`missing body for function ${name}`);
  }

  let depth = 0;
  let end = braceStart;
  for (; end < source.length; end += 1) {
    const ch = source[end];
    if (ch === '{') depth += 1;
    if (ch === '}') {
      depth -= 1;
      if (depth === 0) {
        end += 1;
        break;
      }
    }
  }

  return source.slice(start, end);
}

function createProviderApi(options = {}) {
  const {
    receiveMailbox = '',
    messages = [{
      id: 'mail-1',
      address: 'user@example.com',
      receivedDateTime: '2026-04-13T09:20:00.000Z',
      subject: 'OpenAI verification code',
      from: { emailAddress: { address: 'noreply@tm.openai.com' } },
      bodyPreview: 'Your verification code is 123456.',
    }],
    deleteShouldFail = false,
  } = options;

  const bundle = [
    extractFunction('isStopError'),
    extractFunction('throwIfStopped'),
    extractFunction('normalizeCloudflareTempEmailLookupMode'),
    extractFunction('normalizeCloudflareTempEmailReceiveMailbox'),
    extractFunction('resolveCloudflareTempEmailEffectiveLookupMode'),
    extractFunction('resolveCloudflareTempEmailPollTargetEmail'),
    extractFunction('summarizeCloudflareTempEmailMessagesForLog'),
    extractFunction('shouldReportMissingCloudflareTempEmailOriginalRecipient'),
    extractFunction('buildCloudflareTempEmailMailSearchParams'),
    extractFunction('listCloudflareTempEmailMessages'),
    extractFunction('pollCloudflareTempEmailVerificationCode'),
  ].join('\n');

  return new Function('options', `
let stopRequested = false;
const STOP_ERROR_MESSAGE = '流程已被用户停止。';
const CLOUDFLARE_TEMP_EMAIL_DEFAULT_PAGE_SIZE = 5;
const CLOUDFLARE_TEMP_EMAIL_LOOKUP_MODE_RECEIVE_MAILBOX = 'receive-mailbox';
const CLOUDFLARE_TEMP_EMAIL_LOOKUP_MODE_REGISTRATION_EMAIL = 'registration-email';
const DEFAULT_CLOUDFLARE_TEMP_EMAIL_LOOKUP_MODE = CLOUDFLARE_TEMP_EMAIL_LOOKUP_MODE_RECEIVE_MAILBOX;
const CLOUDFLARE_TEMP_EMAIL_PROVIDER = 'cloudflare-temp-email';
const CLOUDFLARE_TEMP_EMAIL_GENERATOR = 'cloudflare-temp-email';
const MAX_CLOUDFLARE_TEMP_EMAIL_SCAN_PAGES = 5;
const logs = [];
const listCalls = [];
const messages = options.messages;
function normalizeCloudflareTempEmailAddress(value) {
  return String(value || '').trim().toLowerCase();
}
async function addLog(message, level) {
  logs.push({ message, level });
}
async function sleepWithStop() {}
function ensureCloudflareTempEmailConfig() {
  return {
    receiveMailbox: options.receiveMailbox,
    lookupMode: options.lookupMode || 'receive-mailbox',
  };
}
async function requestCloudflareTempEmailJson(_config, _path, options = {}) {
  const searchParams = options.searchParams || {};
  const originalRecipient = normalizeCloudflareTempEmailReceiveMailbox(searchParams.original_recipient);
  const address = normalizeCloudflareTempEmailAddress(searchParams.address);
  listCalls.push({
    address: searchParams.address || '',
    lookupMode: originalRecipient ? 'registration-email' : 'receive-mailbox',
    originalRecipient,
  });

  const hasOriginalRecipient = messages.some((message) => (
    normalizeCloudflareTempEmailReceiveMailbox(message.originalRecipient)
  ));
  let filteredMessages = messages;
  if (originalRecipient && hasOriginalRecipient) {
    filteredMessages = messages.filter((message) => (
      normalizeCloudflareTempEmailReceiveMailbox(message.originalRecipient) === originalRecipient
    ));
  }
  if (address) {
    filteredMessages = filteredMessages.filter((message) => (
      !message.address || normalizeCloudflareTempEmailAddress(message.address) === address
    ));
  }

  const offset = Math.max(0, Number(searchParams.offset) || 0);
  const limit = Math.max(0, Number(searchParams.limit) || 0);
  return {
    results: filteredMessages.slice(offset, offset + limit),
    count: filteredMessages.length,
  };
}
function normalizeCloudflareTempEmailMailApiMessages(payload) {
  return Array.isArray(payload?.results) ? payload.results : [];
}
function pickVerificationMessageWithTimeFallback(currentMessages) {
  return {
    match: currentMessages[0]
      ? {
          code: String(currentMessages[0].bodyPreview).match(/(\\d{6})/)[1],
          receivedAt: Date.parse(currentMessages[0].receivedDateTime),
          message: currentMessages[0],
        }
      : null,
    usedRelaxedFilters: false,
    usedTimeFallback: false,
  };
}
async function deleteCloudflareTempEmailMail() {
  if (options.deleteShouldFail) {
    throw new Error('delete failed');
  }
}

${bundle}

return {
  buildCloudflareTempEmailMailSearchParams,
  pollCloudflareTempEmailVerificationCode,
  snapshot() {
    return { logs, listCalls };
  },
};
`)({
  ...options,
  receiveMailbox,
  messages,
  deleteShouldFail,
});
}

test('registration lookup adds original_recipient while receive lookup keeps address filtering', () => {
  const api = createProviderApi({ messages: [] });

  assert.deepEqual(
    api.buildCloudflareTempEmailMailSearchParams({
      address: 'forward-box@email.example.com',
      originalRecipient: ' Target@Duck.com ',
      useRegistrationLookup: true,
    }),
    {
      limit: 5,
      offset: 0,
      address: '',
      original_recipient: 'target@duck.com',
    },
  );
  assert.deepEqual(
    api.buildCloudflareTempEmailMailSearchParams({
      address: 'Forward-Box@Email.Example.com',
      originalRecipient: 'target@duck.com',
    }),
    {
      limit: 5,
      offset: 0,
      address: 'forward-box@email.example.com',
    },
  );
});

test('registration lookup treats an empty page as no match instead of unsupported field', async () => {
  const api = createProviderApi({
    lookupMode: 'registration-email',
    messages: [],
  });

  await assert.rejects(
    api.pollCloudflareTempEmailVerificationCode(4, {
      email: 'target@duck.com',
      mailProvider: 'cloudflare-temp-email',
      emailGenerator: 'custom-pool',
      cloudflareTempEmailLookupMode: 'registration-email',
    }, {
      targetEmail: 'target@duck.com',
      maxAttempts: 1,
      intervalMs: 1,
    }),
    (error) => {
      assert.match(error.message, /暂未在 Cloudflare Temp Email 中找到匹配验证码/);
      assert.doesNotMatch(error.message, /未返回 original_recipient/);
      return true;
    }
  );
});

test('registration lookup reports unsupported field only when non-empty mail rows lack it', async () => {
  const api = createProviderApi({
    lookupMode: 'registration-email',
    messages: [{
      id: 'mail-legacy',
      address: 'forward-box@email.20021108.xyz',
      receivedDateTime: '2026-04-13T09:30:00.000Z',
      subject: 'Legacy mail',
      from: { emailAddress: { address: 'noreply@tm.openai.com' } },
      bodyPreview: 'Your verification code is 333333.',
    }],
  });

  await assert.rejects(
    api.pollCloudflareTempEmailVerificationCode(4, {
      email: 'target@duck.com',
      mailProvider: 'cloudflare-temp-email',
      emailGenerator: 'custom-pool',
      cloudflareTempEmailLookupMode: 'registration-email',
    }, {
      targetEmail: 'target@duck.com',
      maxAttempts: 1,
      intervalMs: 1,
    }),
    /未返回 original_recipient/
  );
});

test('custom pool registration lookup accepts a direct Cloudflare Temp Email address', async () => {
  const directEmail = 'tmpdirect@email.20021108.xyz';
  const api = createProviderApi({
    lookupMode: 'registration-email',
    messages: [{
      id: 'mail-direct',
      address: directEmail,
      originalRecipient: directEmail,
      receivedDateTime: '2026-04-13T09:40:00.000Z',
      subject: 'Direct registration code',
      from: { emailAddress: { address: 'noreply@tm.openai.com' } },
      bodyPreview: 'Your verification code is 444444.',
    }],
  });

  const result = await api.pollCloudflareTempEmailVerificationCode(4, {
    email: directEmail,
    mailProvider: 'cloudflare-temp-email',
    emailGenerator: 'custom-pool',
    cloudflareTempEmailLookupMode: 'registration-email',
  }, {
    targetEmail: directEmail,
    maxAttempts: 1,
    intervalMs: 1,
  });

  assert.equal(result.code, '444444');
  assert.deepEqual(api.snapshot().listCalls, [{
    address: '',
    lookupMode: 'registration-email',
    originalRecipient: directEmail,
  }]);
});

test('pollCloudflareTempEmailVerificationCode returns code even if delete fails', async () => {
  const api = createProviderApi({ deleteShouldFail: true });

  const result = await api.pollCloudflareTempEmailVerificationCode(4, { email: 'user@example.com' }, {
    targetEmail: 'user@example.com',
    maxAttempts: 1,
    intervalMs: 1,
  });

  assert.equal(result.code, '123456');
  const state = api.snapshot();
  assert.equal(state.logs.some((entry) => entry.message.includes('删除 Cloudflare Temp Email 邮件失败')), true);
  assert.deepEqual(state.listCalls.map((call) => call.address), ['user@example.com']);
});

test('pollCloudflareTempEmailVerificationCode requires target email or receive mailbox', async () => {
  const api = createProviderApi({ messages: [] });

  await assert.rejects(
    api.pollCloudflareTempEmailVerificationCode(4, {}, {}),
    /目标邮箱地址|邮件接收邮箱/
  );
});

test('pollCloudflareTempEmailVerificationCode prefers configured receive mailbox over registration email', async () => {
  const api = createProviderApi({
    receiveMailbox: 'forward-box@email.20021108.xyz',
    messages: [{
      id: 'mail-2',
      address: 'forward-box@email.20021108.xyz',
      receivedDateTime: '2026-04-13T10:20:00.000Z',
      subject: 'Login verification code',
      from: { emailAddress: { address: 'noreply@tm.openai.com' } },
      bodyPreview: 'Your verification code is 654321.',
    }],
  });

  const result = await api.pollCloudflareTempEmailVerificationCode(4, {
    email: 'duck-forwarded@duck.com',
    mailProvider: 'cloudflare-temp-email',
    emailGenerator: 'duck',
    cloudflareTempEmailReceiveMailbox: 'forward-box@email.20021108.xyz',
  }, {
    targetEmail: 'duck-forwarded@duck.com',
    maxAttempts: 1,
    intervalMs: 1,
  });

  assert.equal(result.code, '654321');
  assert.deepEqual(api.snapshot().listCalls.map((call) => call.address), ['forward-box@email.20021108.xyz']);
});

test('pollCloudflareTempEmailVerificationCode ignores stale receive mailbox when the field should be hidden', async () => {
  const api = createProviderApi({
    receiveMailbox: 'forward-box@email.20021108.xyz',
    messages: [{
      id: 'mail-3',
      address: 'generated@email.20021108.xyz',
      receivedDateTime: '2026-04-13T11:20:00.000Z',
      subject: 'Signup verification code',
      from: { emailAddress: { address: 'noreply@tm.openai.com' } },
      bodyPreview: 'Your verification code is 246810.',
    }],
  });

  const result = await api.pollCloudflareTempEmailVerificationCode(4, {
    email: 'generated@email.20021108.xyz',
    mailProvider: 'cloudflare-temp-email',
    emailGenerator: 'cloudflare-temp-email',
    cloudflareTempEmailReceiveMailbox: 'forward-box@email.20021108.xyz',
  }, {
    targetEmail: 'generated@email.20021108.xyz',
    maxAttempts: 1,
    intervalMs: 1,
  });

  assert.equal(result.code, '246810');
  assert.deepEqual(api.snapshot().listCalls.map((call) => call.address), ['generated@email.20021108.xyz']);
});

test('pollCloudflareTempEmailVerificationCode ignores stale registration lookup mode for generated CFTE mailboxes', async () => {
  const api = createProviderApi({
    receiveMailbox: 'forward-box@email.20021108.xyz',
    lookupMode: 'registration-email',
    messages: [{
      id: 'mail-4',
      address: 'generated@email.20021108.xyz',
      originalRecipient: '',
      receivedDateTime: '2026-04-13T11:30:00.000Z',
      subject: 'Signup verification code',
      from: { emailAddress: { address: 'noreply@tm.openai.com' } },
      bodyPreview: 'Your verification code is 975310.',
    }],
  });

  const result = await api.pollCloudflareTempEmailVerificationCode(4, {
    email: 'generated@email.20021108.xyz',
    mailProvider: 'cloudflare-temp-email',
    emailGenerator: 'cloudflare-temp-email',
    cloudflareTempEmailLookupMode: 'registration-email',
    cloudflareTempEmailReceiveMailbox: 'forward-box@email.20021108.xyz',
  }, {
    targetEmail: 'generated@email.20021108.xyz',
    maxAttempts: 1,
    intervalMs: 1,
  });

  assert.equal(result.code, '975310');
  assert.deepEqual(api.snapshot().listCalls, [{
    address: 'generated@email.20021108.xyz',
    lookupMode: 'receive-mailbox',
    originalRecipient: '',
  }]);
});

test('pollCloudflareTempEmailVerificationCode filters by original recipient in registration lookup mode', async () => {
  const api = createProviderApi({
    receiveMailbox: 'forward-box@email.20021108.xyz',
    lookupMode: 'registration-email',
    messages: [
      {
        id: 'mail-4',
        address: 'forward-box@email.20021108.xyz',
        originalRecipient: 'other@duck.com',
        receivedDateTime: '2026-04-13T12:20:00.000Z',
        subject: 'Other verification code',
        from: { emailAddress: { address: 'noreply@tm.openai.com' } },
        bodyPreview: 'Your verification code is 111111.',
      },
      {
        id: 'mail-5',
        address: 'forward-box@email.20021108.xyz',
        originalRecipient: 'duck-forwarded@duck.com',
        receivedDateTime: '2026-04-13T12:21:00.000Z',
        subject: 'Login verification code',
        from: { emailAddress: { address: 'noreply@tm.openai.com' } },
        bodyPreview: 'Your verification code is 222222.',
      },
    ],
  });

  const result = await api.pollCloudflareTempEmailVerificationCode(4, {
    email: 'duck-forwarded@duck.com',
    mailProvider: 'cloudflare-temp-email',
    emailGenerator: 'duck',
    cloudflareTempEmailLookupMode: 'registration-email',
    cloudflareTempEmailReceiveMailbox: 'forward-box@email.20021108.xyz',
  }, {
    targetEmail: 'duck-forwarded@duck.com',
    maxAttempts: 1,
    intervalMs: 1,
  });

  assert.equal(result.code, '222222');
  assert.deepEqual(api.snapshot().listCalls, [{
    address: '',
    lookupMode: 'registration-email',
    originalRecipient: 'duck-forwarded@duck.com',
  }]);
});
