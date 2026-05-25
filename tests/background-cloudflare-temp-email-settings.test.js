const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');

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

test('cloudflare temp email settings normalize and expose the random-subdomain toggle', () => {
  const bundle = [
    extractFunction('normalizeCloudflareTempEmailLookupMode'),
    extractFunction('normalizeCloudflareTempEmailReceiveMailbox'),
    extractFunction('getCloudflareTempEmailConfig'),
    extractFunction('normalizePersistentSettingValue'),
    extractFunction('buildPersistentSettingsPayload'),
  ].join('\n');

  const api = new Function(`
const DEFAULT_VERIFICATION_RESEND_COUNT = 4;
const CLOUDFLARE_TEMP_EMAIL_LOOKUP_MODE_RECEIVE_MAILBOX = 'receive-mailbox';
const CLOUDFLARE_TEMP_EMAIL_LOOKUP_MODE_REGISTRATION_EMAIL = 'registration-email';
const DEFAULT_CLOUDFLARE_TEMP_EMAIL_LOOKUP_MODE = CLOUDFLARE_TEMP_EMAIL_LOOKUP_MODE_RECEIVE_MAILBOX;
const PERSISTED_SETTING_DEFAULTS = {
  panelMode: 'cpa',
  autoStepDelaySeconds: null,
  verificationResendCount: DEFAULT_VERIFICATION_RESEND_COUNT,
  mailProvider: '163',
  mail2925Mode: 'provide',
  emailGenerator: 'duck',
  autoDeleteUsedIcloudAlias: false,
  accountRunHistoryTextEnabled: false,
  cloudflareTempEmailLookupMode: 'receive-mailbox',
  cloudflareTempEmailUseRandomSubdomain: false,
  cloudflareTempEmailDomain: '',
  cloudflareTempEmailDomains: [],
};
const PERSISTED_SETTING_KEYS = Object.keys(PERSISTED_SETTING_DEFAULTS);
function normalizePanelMode(value) { return value === 'sub2api' ? 'sub2api' : 'cpa'; }
function normalizeSignupMethod(value = '') { return String(value || '').trim().toLowerCase() === 'phone' ? 'phone' : 'email'; }
function resolveSignupMethod(state = {}) { return normalizeSignupMethod(state?.signupMethod); }
function normalizeLocalCpaStep9Mode(value) { return value === 'bypass' ? 'bypass' : 'submit'; }
function normalizeAutoRunFallbackThreadIntervalMinutes(value) { return Number(value) || 0; }
function normalizeAutoStepDelaySeconds(value, fallback = null) { return value == null || value === '' ? fallback : Number(value); }
function normalizeVerificationResendCount(value, fallback) { return Number.isFinite(Number(value)) ? Number(value) : fallback; }
function normalizeMailProvider(value) { return String(value || '').trim().toLowerCase() || '163'; }
function normalizeMail2925Mode(value) { return String(value || '').trim().toLowerCase() === 'receive' ? 'receive' : 'provide'; }
function normalizeEmailGenerator(value) { return String(value || '').trim().toLowerCase() || 'duck'; }
function normalizeIcloudHost(value) { const normalized = String(value || '').trim().toLowerCase(); return normalized === 'icloud.com' || normalized === 'icloud.com.cn' ? normalized : ''; }
function normalizeAccountRunHistoryHelperBaseUrl(value) { return String(value || '').trim(); }
function normalizeHotmailServiceMode(value) { return String(value || '').trim().toLowerCase() === 'remote' ? 'remote' : 'local'; }
function normalizeHotmailRemoteBaseUrl(value) { return String(value || '').trim(); }
function normalizeHotmailLocalBaseUrl(value) { return String(value || '').trim(); }
function normalizeCloudflareDomain(value) { return String(value || '').trim().toLowerCase(); }
function normalizeCloudflareDomains(value) { return Array.isArray(value) ? value.map((item) => String(item || '').trim().toLowerCase()).filter(Boolean) : []; }
function normalizeCloudflareTempEmailBaseUrl(value) { return String(value || '').trim(); }
function normalizeCloudflareTempEmailAddress(value = '') { return String(value || '').trim().toLowerCase(); }
function normalizeCloudflareTempEmailDomain(value) { return String(value || '').trim().toLowerCase(); }
function normalizeCloudflareTempEmailDomains(value) {
  const seen = new Set();
  const domains = [];
  for (const item of Array.isArray(value) ? value : []) {
    const normalized = normalizeCloudflareTempEmailDomain(item);
    if (!normalized || seen.has(normalized)) continue;
    seen.add(normalized);
    domains.push(normalized);
  }
  return domains;
}
function normalizeHotmailAccounts(value) { return Array.isArray(value) ? value : []; }
function normalizeMail2925Accounts(value) { return Array.isArray(value) ? value : []; }
function resolveLegacyAutoStepDelaySeconds() { return undefined; }
${bundle}
return {
  buildPersistentSettingsPayload,
  getCloudflareTempEmailConfig,
  normalizePersistentSettingValue,
};
  `)();

  assert.equal(api.normalizePersistentSettingValue('cloudflareTempEmailUseRandomSubdomain', 1), true);
  assert.equal(api.normalizePersistentSettingValue('cloudflareTempEmailLookupMode', 'registration-email'), 'registration-email');
  assert.equal(api.normalizePersistentSettingValue('cloudflareTempEmailLookupMode', 'bad'), 'receive-mailbox');

  const payload = api.buildPersistentSettingsPayload({
    cloudflareTempEmailLookupMode: 'registration-email',
    cloudflareTempEmailUseRandomSubdomain: true,
    cloudflareTempEmailDomain: 'mail.example.com',
    cloudflareTempEmailDomains: ['mail.example.com', 'alt.example.com'],
  });
  assert.equal(payload.cloudflareTempEmailLookupMode, 'registration-email');
  assert.equal(payload.cloudflareTempEmailUseRandomSubdomain, true);
  assert.equal(payload.cloudflareTempEmailDomain, 'mail.example.com');
  assert.deepEqual(payload.cloudflareTempEmailDomains, ['mail.example.com', 'alt.example.com']);

  const config = api.getCloudflareTempEmailConfig({
    cloudflareTempEmailBaseUrl: 'https://temp.example.com',
    cloudflareTempEmailAdminAuth: 'admin-secret',
    cloudflareTempEmailCustomAuth: 'custom-secret',
    cloudflareTempEmailLookupMode: 'registration-email',
    cloudflareTempEmailReceiveMailbox: 'Forward@Example.com',
    cloudflareTempEmailUseRandomSubdomain: true,
    cloudflareTempEmailDomain: 'mail.example.com',
    cloudflareTempEmailDomains: ['mail.example.com'],
  });
  assert.deepEqual(config, {
    baseUrl: 'https://temp.example.com',
    adminAuth: 'admin-secret',
    customAuth: 'custom-secret',
    lookupMode: 'registration-email',
    receiveMailbox: 'forward@example.com',
    useRandomSubdomain: true,
    domain: 'mail.example.com',
    domains: ['mail.example.com'],
  });
});

test('cloudflare temp email settings payload ignores removed UI-only flags', () => {
  const api = new Function(`
const DEFAULT_VERIFICATION_RESEND_COUNT = 4;
const PERSISTED_SETTING_DEFAULTS = {
  panelMode: 'cpa',
  autoStepDelaySeconds: null,
  verificationResendCount: DEFAULT_VERIFICATION_RESEND_COUNT,
  mailProvider: '163',
  mail2925Mode: 'provide',
  emailGenerator: 'duck',
  autoDeleteUsedIcloudAlias: false,
  accountRunHistoryTextEnabled: false,
  cloudflareTempEmailUseRandomSubdomain: false,
  cloudflareTempEmailDomain: '',
  cloudflareTempEmailDomains: [],
};
const PERSISTED_SETTING_KEYS = Object.keys(PERSISTED_SETTING_DEFAULTS);
function normalizePanelMode(value) { return value === 'sub2api' ? 'sub2api' : 'cpa'; }
function normalizeSignupMethod(value = '') { return String(value || '').trim().toLowerCase() === 'phone' ? 'phone' : 'email'; }
function resolveSignupMethod(state = {}) { return normalizeSignupMethod(state?.signupMethod); }
function normalizeLocalCpaStep9Mode(value) { return value === 'bypass' ? 'bypass' : 'submit'; }
function normalizeAutoRunFallbackThreadIntervalMinutes(value) { return Number(value) || 0; }
function normalizeAutoStepDelaySeconds(value, fallback = null) { return value == null || value === '' ? fallback : Number(value); }
function normalizeVerificationResendCount(value, fallback) { return Number.isFinite(Number(value)) ? Number(value) : fallback; }
function normalizeMailProvider(value) { return String(value || '').trim().toLowerCase() || '163'; }
function normalizeMail2925Mode(value) { return String(value || '').trim().toLowerCase() === 'receive' ? 'receive' : 'provide'; }
function normalizeEmailGenerator(value) { return String(value || '').trim().toLowerCase() || 'duck'; }
function normalizeIcloudHost(value) { return ''; }
function normalizeIcloudTargetMailboxType(value) { return String(value || '').trim() || 'icloud-inbox'; }
function normalizeIcloudForwardMailProvider(value) { return String(value || '').trim() || 'qq'; }
function normalizeIcloudFetchMode(value) { return String(value || '').trim() === 'always_new' ? 'always_new' : 'reuse_existing'; }
function normalizeAccountRunHistoryHelperBaseUrl(value) { return String(value || '').trim(); }
function normalizeHotmailServiceMode(value) { return String(value || '').trim().toLowerCase() === 'remote' ? 'remote' : 'local'; }
function normalizeHotmailRemoteBaseUrl(value) { return String(value || '').trim(); }
function normalizeHotmailLocalBaseUrl(value) { return String(value || '').trim(); }
function normalizeLuckmailBaseUrl(value) { return String(value || '').trim(); }
function normalizeLuckmailEmailType(value) { return String(value || '').trim(); }
function normalizeCloudflareDomain(value) { return String(value || '').trim().toLowerCase(); }
function normalizeCloudflareDomains(value) { return Array.isArray(value) ? value.map((item) => String(item || '').trim().toLowerCase()).filter(Boolean) : []; }
function normalizeCustomEmailPool(value) { return Array.isArray(value) ? value : []; }
function normalizeCloudflareTempEmailBaseUrl(value) { return String(value || '').trim(); }
function normalizeCloudflareTempEmailAddress(value = '') { return String(value || '').trim().toLowerCase(); }
function normalizeCloudflareTempEmailReceiveMailbox(value = '') { return String(value || '').trim().toLowerCase(); }
function normalizeCloudflareTempEmailDomain(value) { return String(value || '').trim().toLowerCase(); }
function normalizeCloudflareTempEmailDomains(value) { return Array.isArray(value) ? value.map((item) => String(item || '').trim().toLowerCase()).filter(Boolean) : []; }
function normalizeHotmailAccounts(value) { return Array.isArray(value) ? value : []; }
function normalizeMail2925Accounts(value) { return Array.isArray(value) ? value : []; }
function normalizePayPalAccounts(value) { return Array.isArray(value) ? value : []; }
function normalizeHeroSmsAcquirePriority(value) { return String(value || '').trim() === 'price' ? 'price' : 'country'; }
function normalizeHeroSmsMaxPrice(value) { return String(value || '').trim(); }
function normalizeHeroSmsCountryFallback(value) { return Array.isArray(value) ? value : []; }
function normalizePhoneVerificationReplacementLimit(value) { return Number(value) || 3; }
function normalizePhoneCodeWaitSeconds(value) { return Number(value) || 60; }
function normalizePhoneCodeTimeoutWindows(value) { return Number(value) || 2; }
function normalizePhoneCodePollIntervalSeconds(value) { return Number(value) || 5; }
function normalizePhoneCodePollMaxRounds(value) { return Number(value) || 4; }
function resolveLegacyAutoStepDelaySeconds() { return undefined; }
${extractFunction('normalizePersistentSettingValue')}
${extractFunction('buildPersistentSettingsPayload')}
return {
  buildPersistentSettingsPayload,
  normalizePersistentSettingValue,
};
  `)();

  assert.deepEqual(api.buildPersistentSettingsPayload({
    removedUiOnlyFlag: false,
  }), {});

  const defaults = api.buildPersistentSettingsPayload({}, { fillDefaults: true });
  assert.equal(Object.prototype.hasOwnProperty.call(defaults, 'removedUiOnlyFlag'), false);
});
