const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');

const source = fs.readFileSync('background.js', 'utf8');
const messageRouterSource = fs.readFileSync('background/message-router.js', 'utf8');
const messageRouterApi = new Function(
  'self',
  `${messageRouterSource}; return self.MultiPageBackgroundMessageRouter;`
)({});

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

function createLuckmailPlatformVerifyRouter({
  state,
  stepKeyByStep = { 10: 'platform-verify' },
} = {}) {
  let clearedOptions = null;
  let usedMarker = null;
  const logs = [];
  const router = messageRouterApi.createMessageRouter({
    addLog: async (message, level) => {
      logs.push({ message, level });
    },
    buildLocalhostCleanupPrefix: () => '',
    clearLuckmailRuntimeState: async (options) => {
      clearedOptions = options;
    },
    closeLocalhostCallbackTabs: async () => {},
    closeTabsByUrlPrefix: async () => {},
    finalizeIcloudAliasAfterSuccessfulFlow: async () => {},
    finalizePhoneActivationAfterSuccessfulFlow: async () => {},
    getCurrentLuckmailPurchase: (latestState) => latestState.currentLuckmailPurchase,
    getState: async () => state,
    getStepDefinitionForState: (step) => ({ id: step, key: stepKeyByStep[step] || '' }),
    isHotmailProvider: () => false,
    isLocalhostOAuthCallbackUrl: () => true,
    isLuckmailProvider: (latestState) => latestState.mailProvider === 'luckmail-api',
    patchHotmailAccount: async () => {},
    setLuckmailPurchaseUsedState: async (purchaseId, used) => {
      usedMarker = { purchaseId, used };
    },
  });
  return {
    router,
    snapshot() {
      return { clearedOptions, usedMarker, logs };
    },
  };
}

test('ensureLuckmailPurchaseForFlow buys openai mailbox and defaults email type to ms_graph', async () => {
  const bundle = [
    extractFunction('getLuckmailSessionConfig'),
    extractFunction('getCurrentLuckmailPurchase'),
    extractFunction('ensureLuckmailPurchaseForFlow'),
  ].join('\n');

  const factory = new Function('initialState', `
let currentState = { ...initialState };
const DEFAULT_LUCKMAIL_PROJECT_CODE = 'openai';
const purchaseCalls = [];
const activateCalls = [];

function normalizeLuckmailBaseUrl(value) {
  return String(value || '').trim() || 'https://mails.luckyous.com';
}
function normalizeLuckmailEmailType(value) {
  return ['self_built', 'ms_imap', 'ms_graph', 'google_variant'].includes(String(value || '').trim())
    ? String(value || '').trim()
    : 'ms_graph';
}
function normalizeLuckmailPurchase(value) {
  return value;
}
function normalizeLuckmailPurchases(value) {
  return value.purchases || [];
}
async function getState() {
  return currentState;
}
function createLuckmailClient() {
  return {
    user: {
      async purchaseEmails(projectCode, quantity, options) {
        purchaseCalls.push({ projectCode, quantity, options });
        return {
          purchases: [{ id: 15, email_address: 'demo@outlook.com', token: 'tok-1' }],
        };
      },
    },
  };
}
async function findReusableLuckmailPurchaseForFlow() {
  return null;
}
async function activateLuckmailPurchaseForFlow(state, client, purchase, options) {
  activateCalls.push({ state, purchase, options });
  currentState.currentLuckmailPurchase = purchase;
  currentState.email = purchase.email_address;
  return purchase;
}

${bundle}

return {
  ensureLuckmailPurchaseForFlow,
  snapshot() {
    return { currentState, purchaseCalls, activateCalls };
  },
};
`);

  const api = factory({
    luckmailApiKey: 'sk-test',
    luckmailBaseUrl: '',
    luckmailEmailType: '',
    luckmailDomain: '',
    currentLuckmailPurchase: null,
    email: null,
  });

  const purchase = await api.ensureLuckmailPurchaseForFlow();
  const snapshot = api.snapshot();

  assert.equal(purchase.email_address, 'demo@outlook.com');
  assert.deepStrictEqual(snapshot.purchaseCalls, [{
    projectCode: 'openai',
    quantity: 1,
    options: {
      emailType: 'ms_graph',
      domain: undefined,
    },
  }]);
  assert.equal(snapshot.activateCalls[0].options.initializeCursor, false);
  assert.equal(snapshot.currentState.email, 'demo@outlook.com');
});

test('ensureLuckmailPurchaseForFlow reuses reusable openai mailbox before buying a new one', async () => {
  const bundle = [
    extractFunction('getLuckmailSessionConfig'),
    extractFunction('getCurrentLuckmailPurchase'),
    extractFunction('ensureLuckmailPurchaseForFlow'),
  ].join('\n');

  const factory = new Function('initialState', `
let currentState = { ...initialState };
const DEFAULT_LUCKMAIL_PROJECT_CODE = 'openai';
const purchaseCalls = [];
const activateCalls = [];

function normalizeLuckmailBaseUrl(value) {
  return String(value || '').trim() || 'https://mails.luckyous.com';
}
function normalizeLuckmailEmailType(value) {
  return ['self_built', 'ms_imap', 'ms_graph', 'google_variant'].includes(String(value || '').trim())
    ? String(value || '').trim()
    : 'ms_graph';
}
function normalizeLuckmailPurchase(value) {
  return value;
}
function normalizeLuckmailPurchases(value) {
  return value.purchases || [];
}
async function getState() {
  return currentState;
}
function createLuckmailClient() {
  return {
    user: {
      async purchaseEmails(projectCode, quantity, options) {
        purchaseCalls.push({ projectCode, quantity, options });
        return { purchases: [] };
      },
    },
  };
}
async function findReusableLuckmailPurchaseForFlow() {
  return {
    id: 99,
    email_address: 'reuse@outlook.com',
    token: 'tok-reuse',
  };
}
async function activateLuckmailPurchaseForFlow(state, client, purchase, options) {
  activateCalls.push({ state, purchase, options });
  currentState.currentLuckmailPurchase = purchase;
  currentState.email = purchase.email_address;
  return purchase;
}

${bundle}

return {
  ensureLuckmailPurchaseForFlow,
  snapshot() {
    return { currentState, purchaseCalls, activateCalls };
  },
};
`);

  const api = factory({
    luckmailApiKey: 'sk-test',
    luckmailBaseUrl: 'https://mails.luckyous.com',
    luckmailEmailType: 'ms_imap',
    luckmailDomain: 'outlook.com',
    currentLuckmailPurchase: null,
    email: null,
  });

  const purchase = await api.ensureLuckmailPurchaseForFlow();
  const snapshot = api.snapshot();

  assert.equal(purchase.id, 99);
  assert.deepStrictEqual(snapshot.purchaseCalls, []);
  assert.equal(snapshot.activateCalls[0].options.initializeCursor, true);
  assert.match(snapshot.activateCalls[0].options.logMessage, /已复用 openai 邮箱/);
});

test('activateLuckmailPurchaseForFlow builds baseline cursor from existing mails when reusing mailbox', async () => {
  const bundle = extractFunction('activateLuckmailPurchaseForFlow');

  const factory = new Function(`
let currentPurchase = null;
let currentCursor = null;
let currentEmail = null;
const buildCalls = [];

function normalizeLuckmailPurchase(value) {
  return value;
}
async function setLuckmailPurchaseState(value) {
  currentPurchase = value;
}
async function setLuckmailMailCursorState(value) {
  currentCursor = value;
}
async function setEmailState(value) {
  currentEmail = value;
}
async function addLog() {}
function buildLuckmailBaselineCursor(mails) {
  buildCalls.push(mails);
  return { messageId: 'mail-new', receivedAt: '2026-04-14 13:32:05' };
}

${bundle}

return {
  activateLuckmailPurchaseForFlow,
  snapshot() {
    return { currentPurchase, currentCursor, currentEmail, buildCalls };
  },
};
`);

  const api = factory();
  const client = {
    user: {
      async getTokenMails() {
        return {
          mails: [
            { message_id: 'mail-old', received_at: '2026-04-14 13:31:15' },
            { message_id: 'mail-new', received_at: '2026-04-14 13:32:05' },
          ],
        };
      },
    },
  };

  await api.activateLuckmailPurchaseForFlow({}, client, {
    id: 5,
    email_address: 'reuse@outlook.com',
    token: 'tok-reuse',
  }, {
    initializeCursor: true,
    logMessage: 'reuse',
  });

  const snapshot = api.snapshot();
  assert.equal(snapshot.currentPurchase.id, 5);
  assert.deepStrictEqual(snapshot.currentCursor, {
    messageId: 'mail-new',
    receivedAt: '2026-04-14 13:32:05',
  });
  assert.equal(snapshot.currentEmail, 'reuse@outlook.com');
  assert.equal(snapshot.buildCalls.length, 1);
});

test('pollLuckmailVerificationCode snapshots existing mails before accepting new LuckMail code', async () => {
  const bundle = extractFunction('pollLuckmailVerificationCode');

  const factory = new Function(`
let currentState = {
  currentLuckmailPurchase: {
    id: 7,
    email_address: 'luck@example.com',
    token: 'tok-luck',
  },
  currentLuckmailMailCursor: null,
};
const logs = [];
const cursorWrites = [];
let tokenCodeCalls = 0;

function getCurrentLuckmailPurchase(state) {
  return state.currentLuckmailPurchase;
}
function createLuckmailClient() {
  return {
    user: {
      async getTokenMails() {
        if (tokenCodeCalls === 0) {
          return {
            mails: [
              { message_id: 'old-mail', received_at: '2026-04-14 13:31:15', verification_code: '111111' },
            ],
          };
        }
        return {
          mails: [
            { message_id: 'new-mail', received_at: '2026-04-14 13:32:05', verification_code: '222222' },
            { message_id: 'old-mail', received_at: '2026-04-14 13:31:15', verification_code: '111111' },
          ],
        };
      },
      async getTokenCode() {
        tokenCodeCalls += 1;
        return tokenCodeCalls === 1
          ? {
            has_new_mail: true,
            verification_code: '111111',
            mail: { message_id: 'old-mail', received_at: '2026-04-14 13:31:15', verification_code: '111111' },
          }
          : {
            has_new_mail: true,
            verification_code: '222222',
            mail: { message_id: 'new-mail', received_at: '2026-04-14 13:32:05', verification_code: '222222' },
          };
      },
      async getTokenMailDetail(_token, messageId) {
        return { message_id: messageId, received_at: '2026-04-14 13:32:05', verification_code: '222222' };
      },
    },
  };
}
async function getState() {
  return currentState;
}
async function setLuckmailMailCursorState(cursor) {
  currentState = { ...currentState, currentLuckmailMailCursor: cursor };
  cursorWrites.push(cursor);
}
function normalizeLuckmailMailCursor(cursor) {
  return {
    messageId: cursor?.messageId || cursor?.message_id || '',
    receivedAt: cursor?.receivedAt || cursor?.received_at || '',
  };
}
function normalizeLuckmailTimestamp(value) {
  return Date.parse(String(value || '').replace(' ', 'T') + 'Z') || 0;
}
function buildLuckmailMailCursor(mail) {
  return { messageId: mail.message_id || '', receivedAt: mail.received_at || '' };
}
function buildLuckmailBaselineCursor(mails) {
  const latest = mails[0] || null;
  return latest ? buildLuckmailMailCursor(latest) : null;
}
function isLuckmailMailNewerThanCursor(mail, cursor) {
  if (!cursor?.messageId && !cursor?.receivedAt) return true;
  if (mail.message_id === cursor.messageId) return false;
  return normalizeLuckmailTimestamp(mail.received_at) > normalizeLuckmailTimestamp(cursor.receivedAt);
}
function pickLuckmailVerificationMail(mails, filters) {
  const excludeCodes = new Set(filters.excludeCodes || []);
  for (const mail of mails || []) {
    if (!mail.verification_code || excludeCodes.has(mail.verification_code)) continue;
    return { mail, code: mail.verification_code };
  }
  return null;
}
function normalizeLuckmailTokenCode(result) {
  return result;
}
async function resolveLuckmailVerificationMail(client, token, filters, tokenCodeResult) {
  if (tokenCodeResult?.mail) {
    const inline = pickLuckmailVerificationMail([tokenCodeResult.mail], filters);
    if (inline) return inline;
  }
  const mailList = await client.user.getTokenMails(token);
  return pickLuckmailVerificationMail(mailList.mails, filters);
}
async function addLog(message, level) {
  logs.push({ message, level });
}
function throwIfStopped() {}
function isStopError() {
  return false;
}
async function sleepWithStop() {}

${bundle}

return {
  pollLuckmailVerificationCode,
  snapshot() {
    return { currentState, cursorWrites, logs, tokenCodeCalls };
  },
};
`);

  const api = factory();
  const result = await api.pollLuckmailVerificationCode(4, await api.snapshot().currentState, {
    maxAttempts: 2,
    intervalMs: 1000,
    senderFilters: ['openai'],
    subjectFilters: ['code'],
    excludeCodes: [],
  });

  assert.equal(result.code, '222222');
  const snapshot = api.snapshot();
  assert.deepStrictEqual(snapshot.cursorWrites[0], {
    messageId: 'old-mail',
    receivedAt: '2026-04-14 13:31:15',
  });
  assert.deepStrictEqual(snapshot.cursorWrites.at(-1), {
    messageId: 'new-mail',
    receivedAt: '2026-04-14 13:32:05',
  });
  assert.equal(snapshot.logs.some((entry) => /已保存当前邮箱旧邮件快照/.test(entry.message)), true);
  assert.equal(snapshot.tokenCodeCalls, 2);
});

test('buildPersistentSettingsPayload keeps LuckMail config fields for storage.local persistence', () => {
  const bundle = [
    extractFunction('normalizePersistentSettingValue'),
    extractFunction('buildPersistentSettingsPayload'),
  ].join('\n');

  const factory = new Function(`
const DEFAULT_LUCKMAIL_BASE_URL = 'https://mails.luckyous.com';
const DEFAULT_LUCKMAIL_EMAIL_TYPE = 'ms_graph';
const PERSISTED_SETTING_DEFAULTS = {
  luckmailApiKey: '',
  luckmailBaseUrl: DEFAULT_LUCKMAIL_BASE_URL,
  luckmailEmailType: DEFAULT_LUCKMAIL_EMAIL_TYPE,
  luckmailDomain: '',
  luckmailUsedPurchases: {},
  luckmailPreserveTagId: 0,
  luckmailPreserveTagName: '保留',
};
const PERSISTED_SETTING_KEYS = Object.keys(PERSISTED_SETTING_DEFAULTS);
function normalizeLuckmailBaseUrl(value) {
  const normalized = String(value || '').trim() || DEFAULT_LUCKMAIL_BASE_URL;
  return normalized.replace(/\\/$/, '');
}
function normalizeLuckmailEmailType(value) {
  return ['self_built', 'ms_imap', 'ms_graph', 'google_variant'].includes(String(value || '').trim())
    ? String(value || '').trim()
    : DEFAULT_LUCKMAIL_EMAIL_TYPE;
}
function normalizeLuckmailPurchaseId(value) {
  const numeric = Number(value);
  return Number.isFinite(numeric) && numeric > 0 ? String(Math.floor(numeric)) : '';
}
function normalizeLuckmailUsedPurchases(value) {
  if (!value || typeof value !== 'object' || Array.isArray(value)) return {};
  return Object.entries(value).reduce((result, [key, used]) => {
    const normalizedKey = normalizeLuckmailPurchaseId(key);
    if (normalizedKey) result[normalizedKey] = Boolean(used);
    return result;
  }, {});
}
function resolveLegacyAutoStepDelaySeconds() {
  return undefined;
}

${bundle}

return {
  buildPersistentSettingsPayload,
};
`);

  const api = factory();
  const payload = api.buildPersistentSettingsPayload({
    luckmailApiKey: 'sk-live-demo',
    luckmailBaseUrl: 'https://demo.example.com/',
    luckmailEmailType: 'ms_imap',
    luckmailDomain: ' outlook.com ',
  });

  assert.deepStrictEqual(payload, {
    luckmailApiKey: 'sk-live-demo',
    luckmailBaseUrl: 'https://demo.example.com',
    luckmailEmailType: 'ms_imap',
    luckmailDomain: 'outlook.com',
  });

  const statePayload = api.buildPersistentSettingsPayload({
    luckmailUsedPurchases: { 88: true, 99: false, bad: true },
    luckmailPreserveTagId: '9',
    luckmailPreserveTagName: '  保留邮箱  ',
  });
  assert.deepStrictEqual(statePayload, {
    luckmailUsedPurchases: { 88: true, 99: false },
    luckmailPreserveTagId: 9,
    luckmailPreserveTagName: '保留邮箱',
  });
});

test('listLuckmailPurchasesByProject only keeps openai purchases', async () => {
  const bundle = extractFunction('listLuckmailPurchasesByProject');

  const factory = new Function(`
const DEFAULT_LUCKMAIL_PROJECT_CODE = 'openai';
function normalizeLuckmailProjectName(value) {
  return String(value || '').trim().toLowerCase();
}
function isLuckmailPurchaseForProject(purchase, projectCode) {
  return normalizeLuckmailProjectName(purchase.project_name || purchase.project) === normalizeLuckmailProjectName(projectCode);
}
async function getAllLuckmailPurchases() {
  return [
    { id: 1, project_name: 'OpenAi' },
    { id: 2, project_name: 'other' },
    { id: 3, project: 'openai' },
  ];
}

${bundle}

return { listLuckmailPurchasesByProject };
`);

  const api = factory();
  const result = await api.listLuckmailPurchasesByProject({}, { projectCode: 'openai' });
  assert.deepStrictEqual(result.map((item) => item.id), [1, 3]);
});

test('disableUsedLuckmailPurchases only disables locally used and non-preserved openai mailboxes', async () => {
  const bundle = extractFunction('disableUsedLuckmailPurchases');

  const factory = new Function(`
let clearedOptions = null;
const disabledCalls = [];
const DEFAULT_LUCKMAIL_PROJECT_CODE = 'openai';

function normalizeLuckmailPurchaseId(value) {
  const numeric = Number(value);
  return Number.isFinite(numeric) && numeric > 0 ? String(Math.floor(numeric)) : '';
}
async function ensureManualInteractionAllowed() {
  return {
    luckmailUsedPurchases: { 1: true, 2: true, 3: true },
    luckmailPreserveTagId: 9,
    luckmailPreserveTagName: '保留',
    mailProvider: 'luckmail-api',
  };
}
function getLuckmailUsedPurchases(state) {
  return state.luckmailUsedPurchases;
}
function getLuckmailPreserveTagInfo(state) {
  return {
    id: state.luckmailPreserveTagId,
    name: state.luckmailPreserveTagName,
  };
}
function isLuckmailPurchasePreserved(purchase, options) {
  return purchase.tag_id === options.preserveTagId || purchase.tag_name === options.preserveTagName;
}
function createLuckmailClient() {
  return {
    user: {
      async batchSetPurchaseDisabled(ids, disabled) {
        disabledCalls.push({ ids, disabled });
      },
    },
  };
}
async function listLuckmailPurchasesByProject() {
  return [
    { id: 1, email_address: 'used-1@outlook.com', user_disabled: 0, tag_id: 0, tag_name: '' },
    { id: 2, email_address: 'preserved@outlook.com', user_disabled: 0, tag_id: 9, tag_name: '保留' },
    { id: 3, email_address: 'already-disabled@outlook.com', user_disabled: 1, tag_id: 0, tag_name: '' },
    { id: 4, email_address: 'unused@outlook.com', user_disabled: 0, tag_id: 0, tag_name: '' },
  ];
}
async function getState() {
  return {
    currentLuckmailPurchase: { id: 1 },
    mailProvider: 'luckmail-api',
  };
}
function getCurrentLuckmailPurchase(state) {
  return state.currentLuckmailPurchase;
}
function isLuckmailProvider(state) {
  return state.mailProvider === 'luckmail-api';
}
async function clearLuckmailRuntimeState(options) {
  clearedOptions = options;
}
async function addLog() {}

${bundle}

return {
  disableUsedLuckmailPurchases,
  snapshot() {
    return { disabledCalls, clearedOptions };
  },
};
`);

  const api = factory();
  const result = await api.disableUsedLuckmailPurchases();
  const snapshot = api.snapshot();

  assert.deepStrictEqual(result.disabledIds, [1]);
  assert.deepStrictEqual(snapshot.disabledCalls, [{ ids: [1], disabled: 1 }]);
  assert.deepStrictEqual(snapshot.clearedOptions, { clearEmail: true });
});

test('resetState preserves LuckMail session config, used map, and preserve tag cache while clearing runtime purchase state', async () => {
  const bundle = [
    extractFunction('buildAccountContributionState'),
    extractFunction('clearStep5ProfileStatePatch'),
    extractFunction('resetState'),
  ].join('\n');

  const factory = new Function([
    'let cleared = false;',
    'let storedPayload = null;',
    'const self = {};',
    "const LOG_PREFIX = '[test]';",
    "const DEFAULT_LUCKMAIL_PRESERVE_TAG_NAME = '保留';",
    'const DEFAULT_STATE = {',
    "  luckmailApiKey: '',",
    "  luckmailBaseUrl: 'https://mails.luckyous.com',",
    "  luckmailEmailType: 'ms_graph',",
    "  luckmailDomain: '',",
    "  yydsMailApiKey: '',",
    "  yydsMailBaseUrl: 'https://maliapi.215.im/v1',",
    "  panelMode: 'cpa',",
    '  luckmailUsedPurchases: {},',
    '  luckmailPreserveTagId: 0,',
    "  luckmailPreserveTagName: '保留',",
    "  currentLuckmailPurchase: { token: 'stale' },",
    "  currentLuckmailMailCursor: { messageId: 'stale' },",
    "  currentYydsMailInbox: { address: 'stale@example.com', token: 'stale-token' },",
    '  currentPhoneActivation: null,',
    '  reusablePhoneActivation: null,',
    '  email: null,',
    '};',
    'const CONTRIBUTION_RUNTIME_DEFAULTS = {',
    '  accountContributionEnabled: false,',
    "  contributionSessionId: '',",
    "  contributionAuthUrl: '',",
    "  contributionAuthState: '',",
    "  contributionCallbackUrl: '',",
    "  contributionStatus: '',",
    "  contributionStatusMessage: '',",
    '  contributionLastPollAt: 0,',
    "  contributionCallbackStatus: 'idle',",
    "  contributionCallbackMessage: '',",
    '  contributionAuthOpenedAt: 0,',
    '  contributionAuthTabId: 0,',
    '};',
    'const CONTRIBUTION_RUNTIME_KEYS = Object.keys(CONTRIBUTION_RUNTIME_DEFAULTS);',
    'function normalizeLuckmailBaseUrl(value) {',
    "  const normalized = String(value || '').trim() || 'https://mails.luckyous.com';",
    "  return normalized.replace(/\\/$/, '');",
    '}',
    'function normalizeLuckmailEmailType(value) {',
    "  return ['self_built', 'ms_imap', 'ms_graph', 'google_variant'].includes(String(value || '').trim())",
    "    ? String(value || '').trim()",
    "    : 'ms_graph';",
    '}',
    'function normalizeLuckmailUsedPurchases(value) {',
    '  return value || {};',
    '}',
    'function normalizeYydsMailApiKey(value) {',
    "  return String(value || '').trim();",
    '}',
    'function normalizeYydsMailBaseUrl(value) {',
    "  return (String(value || '').trim() || 'https://maliapi.215.im/v1').replace(/\\/$/, '');",
    '}',
    'async function getPersistedSettings() {',
    "  return { mailProvider: '163' };",
    '}',
    'async function getPersistedAliasState() {',
    '  return {};',
    '}',
    'function buildStatePatchWithRuntimeState(_currentState, updates) {',
    '  return updates;',
    '}',
    'const chrome = {',
    '  storage: {',
    '    session: {',
    '      async get() {',
    '        return {',
    "          seenCodes: ['seen-1'],",
    "          seenInbucketMailIds: ['mail-1'],",
    "          accounts: [{ email: 'saved@example.com' }],",
    "          tabRegistry: { foo: { tabId: 1 } },",
    "          sourceLastUrls: { foo: 'https://example.com' },",
    "          reusablePhoneActivation: { activationId: 'rx-001', phoneNumber: '66951112222', provider: 'hero-sms', serviceCode: 'dr', countryId: 52, successfulUses: 1, maxUses: 3 },",
    "          luckmailApiKey: 'sk-session',",
    "          luckmailBaseUrl: 'https://demo.example.com/',",
    "          luckmailEmailType: 'ms_imap',",
    "          luckmailDomain: 'outlook.com',",
    "          luckmailUsedPurchases: { 88: true },",
    '          luckmailPreserveTagId: 9,',
    "          luckmailPreserveTagName: '保留',",
    "          yydsMailApiKey: 'AC-session',",
    "          yydsMailBaseUrl: 'https://maliapi.215.im/v1/',",
    '        };',
    '      },',
    '      async clear() {',
    '        cleared = true;',
    '      },',
    '      async set(payload) {',
    '        storedPayload = payload;',
    '      },',
    '    },',
    '  },',
    '};',
    bundle,
    'return {',
    '  resetState,',
    '  snapshot() {',
    '    return { cleared, storedPayload };',
    '  },',
    '};',
  ].join('\n'));

  const api = factory();
  await api.resetState();
  const snapshot = api.snapshot();

  assert.equal(snapshot.cleared, true);
  assert.equal(snapshot.storedPayload.luckmailApiKey, 'sk-session');
  assert.equal(snapshot.storedPayload.luckmailBaseUrl, 'https://demo.example.com');
  assert.equal(snapshot.storedPayload.luckmailEmailType, 'ms_imap');
  assert.equal(snapshot.storedPayload.luckmailDomain, 'outlook.com');
  assert.deepStrictEqual(snapshot.storedPayload.luckmailUsedPurchases, { 88: true });
  assert.equal(snapshot.storedPayload.luckmailPreserveTagId, 9);
  assert.equal(snapshot.storedPayload.luckmailPreserveTagName, '保留');
  assert.equal(snapshot.storedPayload.currentLuckmailPurchase, null);
  assert.equal(snapshot.storedPayload.currentLuckmailMailCursor, null);
  assert.equal(snapshot.storedPayload.yydsMailApiKey, 'AC-session');
  assert.equal(snapshot.storedPayload.yydsMailBaseUrl, 'https://maliapi.215.im/v1');
  assert.equal(snapshot.storedPayload.currentYydsMailInbox, null);
  assert.deepStrictEqual(snapshot.storedPayload.reusablePhoneActivation, {
    activationId: 'rx-001',
    phoneNumber: '66951112222',
    provider: 'hero-sms',
    serviceCode: 'dr',
    countryId: 52,
    successfulUses: 1,
    maxUses: 3,
  });
  assert.equal(snapshot.storedPayload.currentPhoneActivation, null);
});

test('message router platform verify marks current LuckMail purchase as used and clears runtime state', async () => {
  const { router, snapshot } = createLuckmailPlatformVerifyRouter({
    state: {
    mailProvider: 'luckmail-api',
    currentHotmailAccountId: null,
    currentLuckmailPurchase: {
      id: 123,
      email_address: 'demo@outlook.com',
    },
    email: 'demo@outlook.com',
    },
  });

  await router.handleStepData(10, {
    localhostUrl: 'http://localhost:1455/auth/callback?code=abc&state=xyz',
  });

  const result = snapshot();
  assert.deepStrictEqual(result.usedMarker, { purchaseId: 123, used: true });
  assert.deepStrictEqual(result.clearedOptions, { clearEmail: true });
  assert.equal(result.logs.at(-1).message, '当前 LuckMail 邮箱运行态已清空，下轮将优先复用未用邮箱或重新购买邮箱。');
});

test('message router marks current LuckMail purchase as used on Plus platform verify step 13', async () => {
  const { router, snapshot } = createLuckmailPlatformVerifyRouter({
    state: {
    plusModeEnabled: true,
    mailProvider: 'luckmail-api',
    currentHotmailAccountId: null,
    currentLuckmailPurchase: {
      id: 456,
      email_address: 'plus@outlook.com',
    },
    email: 'plus@outlook.com',
    },
    stepKeyByStep: {
      10: 'oauth-login',
      13: 'platform-verify',
    },
  });

  await router.handleStepData(10, {});
  assert.equal(snapshot().usedMarker, null);

  await router.handleStepData(13, {
    localhostUrl: 'http://localhost:1455/auth/callback?code=abc&state=xyz',
  });

  const result = snapshot();
  assert.deepStrictEqual(result.usedMarker, { purchaseId: 456, used: true });
  assert.equal(result.logs.some((entry) => /已在本地标记为已用/.test(entry.message)), true);
});

test('setLuckmailPurchaseUsedState persists used map to storage.local so reload keeps it non-reusable', async () => {
  const bundle = [
    extractFunction('getLuckmailUsedPurchases'),
    extractFunction('setLuckmailUsedPurchasesState'),
    extractFunction('setLuckmailPurchaseUsedState'),
  ].join('\n');

  const factory = new Function(`
let sessionState = {
  luckmailUsedPurchases: { 7: true },
};
let persistentUpdates = [];
let sessionUpdates = [];
let broadcasts = [];
function normalizeLuckmailPurchaseId(value) {
  const numeric = Number(value);
  return Number.isFinite(numeric) && numeric > 0 ? String(Math.floor(numeric)) : '';
}
function normalizeLuckmailUsedPurchases(value) {
  if (!value || typeof value !== 'object' || Array.isArray(value)) return {};
  return Object.entries(value).reduce((result, [key, used]) => {
    const normalizedKey = normalizeLuckmailPurchaseId(key);
    if (normalizedKey) result[normalizedKey] = Boolean(used);
    return result;
  }, {});
}
async function getState() {
  return { ...sessionState };
}
async function setPersistentSettings(updates) {
  persistentUpdates.push(updates);
}
async function setState(updates) {
  sessionUpdates.push(updates);
  sessionState = { ...sessionState, ...updates };
}
function broadcastDataUpdate(updates) {
  broadcasts.push(updates);
}

${bundle}

return {
  setLuckmailPurchaseUsedState,
  snapshot() {
    return { sessionState, persistentUpdates, sessionUpdates, broadcasts };
  },
};
`);

  const api = factory();
  const result = await api.setLuckmailPurchaseUsedState(88, true);
  const snapshot = api.snapshot();

  assert.deepStrictEqual(result, { purchaseId: 88, used: true });
  assert.deepStrictEqual(snapshot.sessionState.luckmailUsedPurchases, { 7: true, 88: true });
  assert.deepStrictEqual(snapshot.persistentUpdates, [
    { luckmailUsedPurchases: { 7: true, 88: true } },
  ]);
  assert.deepStrictEqual(snapshot.sessionUpdates, [
    { luckmailUsedPurchases: { 7: true, 88: true } },
  ]);
  assert.deepStrictEqual(snapshot.broadcasts, [
    { luckmailUsedPurchases: { 7: true, 88: true } },
  ]);
});

test('setLuckmailPreserveTagInfo persists tag cache to storage.local', async () => {
  const bundle = extractFunction('setLuckmailPreserveTagInfo');

  const factory = new Function(`
let persistentUpdates = [];
let sessionUpdates = [];
let broadcasts = [];
const DEFAULT_LUCKMAIL_PRESERVE_TAG_NAME = '保留';
function normalizeLuckmailTags(tags) {
  return (Array.isArray(tags) ? tags : []).map((tag) => ({
    id: Number(tag?.id) || 0,
    name: String(tag?.name || '').trim(),
  })).filter((tag) => tag.id > 0 || tag.name);
}
async function setPersistentSettings(updates) {
  persistentUpdates.push(updates);
}
async function setState(updates) {
  sessionUpdates.push(updates);
}
function broadcastDataUpdate(updates) {
  broadcasts.push(updates);
}

${bundle}

return {
  setLuckmailPreserveTagInfo,
  snapshot() {
    return { persistentUpdates, sessionUpdates, broadcasts };
  },
};
`);

  const api = factory();
  const result = await api.setLuckmailPreserveTagInfo({ id: '12', name: ' 保留邮箱 ' });
  const expected = {
    luckmailPreserveTagId: 12,
    luckmailPreserveTagName: '保留邮箱',
  };

  assert.deepStrictEqual(result, expected);
  assert.deepStrictEqual(api.snapshot().persistentUpdates, [expected]);
  assert.deepStrictEqual(api.snapshot().sessionUpdates, [expected]);
  assert.deepStrictEqual(api.snapshot().broadcasts, [expected]);
});
