const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const {
  normalizeIcloudForwardMailProvider,
  normalizeIcloudTargetMailboxType,
} = require('../mail-provider-utils');

const sidepanelSource = fs.readFileSync('sidepanel/sidepanel.js', 'utf8');

function extractFunction(name) {
  const markers = [`async function ${name}(`, `function ${name}(`];
  const start = markers
    .map((marker) => sidepanelSource.indexOf(marker))
    .find((index) => index >= 0);
  if (start < 0) {
    throw new Error(`missing function ${name}`);
  }

  let parenDepth = 0;
  let signatureEnded = false;
  let braceStart = -1;
  for (let i = start; i < sidepanelSource.length; i += 1) {
    const ch = sidepanelSource[i];
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
  for (; end < sidepanelSource.length; end += 1) {
    const ch = sidepanelSource[end];
    if (ch === '{') depth += 1;
    if (ch === '}') {
      depth -= 1;
      if (depth === 0) {
        end += 1;
        break;
      }
    }
  }

  return sidepanelSource.slice(start, end);
}

test('syncSelectedMail2925PoolAccount writes selected pool email back to mail2925BaseEmail', async () => {
  const bundle = [
    extractFunction('getMail2925Accounts'),
    extractFunction('getCurrentMail2925Account'),
    extractFunction('getCurrentMail2925Email'),
    extractFunction('isMail2925AccountPoolEnabled'),
    extractFunction('syncMail2925PoolAccountOptions'),
    extractFunction('getPreferredMail2925PoolAccountId'),
    extractFunction('syncSelectedMail2925PoolAccount'),
  ].join('\n');

  const api = new Function(`
let latestState = {
  mail2925UseAccountPool: true,
  mail2925BaseEmail: 'old@2925.com',
  currentMail2925AccountId: '',
  mail2925Accounts: [{ id: 'acc-1', email: 'new@2925.com' }],
};
const selectMail2925PoolAccount = { value: 'acc-1', innerHTML: '' };
const chrome = {
  runtime: {
    async sendMessage() {
      return { account: { id: 'acc-1', email: 'new@2925.com' } };
    },
  },
};
const toastEvents = [];
function syncLatestState(patch) {
  latestState = { ...latestState, ...patch };
}
function setManagedAliasBaseEmailInputForProvider() {}
function showToast(message) {
  toastEvents.push(message);
}
function escapeHtml(value) {
  return String(value || '');
}
${bundle}
return {
  syncSelectedMail2925PoolAccount,
  getLatestState() {
    return latestState;
  },
};
`)();

  await api.syncSelectedMail2925PoolAccount({ silent: true });

  assert.equal(api.getLatestState().currentMail2925AccountId, 'acc-1');
  assert.equal(api.getLatestState().mail2925BaseEmail, 'new@2925.com');
});

test('syncMail2925BaseEmailFromCurrentAccount reuses current pool account email for manual base email field', async () => {
  const bundle = [
    extractFunction('getMail2925Accounts'),
    extractFunction('getCurrentMail2925Account'),
    extractFunction('getCurrentMail2925Email'),
    extractFunction('isMail2925AccountPoolEnabled'),
    extractFunction('syncMail2925BaseEmailFromCurrentAccount'),
  ].join('\n');

  const api = new Function(`
let latestState = {
  mail2925UseAccountPool: true,
  mail2925BaseEmail: 'old@2925.com',
  currentMail2925AccountId: 'acc-1',
  mail2925Accounts: [{ id: 'acc-1', email: 'new@2925.com' }],
};
let saveCalls = 0;
function syncLatestState(patch) {
  latestState = { ...latestState, ...patch };
}
async function saveSettings() {
  saveCalls += 1;
}
${bundle}
return {
  syncMail2925BaseEmailFromCurrentAccount,
  getLatestState() {
    return latestState;
  },
  getSaveCalls() {
    return saveCalls;
  },
};
`)();

  const changed = api.syncMail2925BaseEmailFromCurrentAccount(undefined, { persist: true });
  await Promise.resolve();

  assert.equal(changed, true);
  assert.equal(api.getLatestState().mail2925BaseEmail, 'new@2925.com');
  assert.equal(api.getSaveCalls(), 1);
});

test('collectSettingsPayload persists currentMail2925AccountId for 2925 account pool restore', () => {
  const bundle = [
    extractFunction('collectSettingsPayload'),
  ].join('\n');

  const api = new Function('normalizeIcloudTargetMailboxType', 'normalizeIcloudForwardMailProvider', `
let latestState = {
  accountContributionEnabled: false,
  mail2925UseAccountPool: true,
  currentMail2925AccountId: 'acc-2',
};
const window = {};
const PLUS_ACCOUNT_ACCESS_STRATEGY_OAUTH = 'oauth';
const PLUS_ACCOUNT_ACCESS_STRATEGY_SUB2API_CODEX_SESSION = 'sub2api_codex_session';
const DEFAULT_PLUS_ACCOUNT_ACCESS_STRATEGY = PLUS_ACCOUNT_ACCESS_STRATEGY_OAUTH;
let cloudflareDomainEditMode = false;
let cloudflareTempEmailDomainEditMode = false;
const selectCfDomain = { value: 'example.com' };
const selectTempEmailDomain = { value: 'mail.example.com' };
const selectPanelMode = { value: 'cpa' };
function getSelectedPlusPaymentMethod() { return 'paypal'; }
const inputVpsUrl = { value: '' };
const inputVpsPassword = { value: '' };
const inputSub2ApiUrl = { value: '' };
const inputSub2ApiEmail = { value: '' };
const inputSub2ApiPassword = { value: '' };
const inputSub2ApiGroup = { value: '' };
const inputSub2ApiDefaultProxy = { value: '' };
const inputCodex2ApiUrl = { value: '' };
const inputCodex2ApiAdminKey = { value: '' };
const inputPassword = { value: '' };
const selectMailProvider = { value: '2925' };
const selectEmailGenerator = { value: 'duck' };
const checkboxAutoDeleteIcloud = { checked: false };
const selectIcloudHostPreference = { value: 'auto' };
const inputPhoneVerificationEnabled = { checked: false };
const selectPhoneSmsProvider = { value: 'hero-sms' };
const inputFiveSimOperator = { value: 'any' };
const inputAccountRunHistoryTextEnabled = { checked: false };
const inputAccountRunHistoryHelperBaseUrl = { value: '' };
const inputMail2925UseAccountPool = { checked: true };
const inputInbucketHost = { value: '' };
const inputInbucketMailbox = { value: '' };
const inputHotmailRemoteBaseUrl = { value: '' };
const inputHotmailLocalBaseUrl = { value: '' };
const inputLuckmailApiKey = { value: '' };
const inputLuckmailBaseUrl = { value: '' };
const selectLuckmailEmailType = { value: 'ms_graph' };
const inputLuckmailDomain = { value: '' };
const inputTempEmailBaseUrl = { value: '' };
const inputTempEmailAdminAuth = { value: '' };
const inputTempEmailCustomAuth = { value: '' };
const inputTempEmailReceiveMailbox = { value: '' };
const inputTempEmailUseRandomSubdomain = { checked: false };
const inputAutoSkipFailures = { checked: false };
const inputAutoSkipFailuresThreadIntervalMinutes = { value: '0' };
const inputAutoStepDelaySeconds = { value: '' };
const inputOAuthFlowTimeoutEnabled = { checked: true };
const inputVerificationResendCount = { value: '4' };
const DEFAULT_VERIFICATION_RESEND_COUNT = 4;
const PHONE_SMS_PROVIDER_HERO_SMS = 'hero-sms';
const PHONE_SMS_PROVIDER_FIVE_SIM = '5sim';
const DEFAULT_PHONE_SMS_PROVIDER = PHONE_SMS_PROVIDER_HERO_SMS;
const DEFAULT_FIVE_SIM_COUNTRY_ID = 'vietnam';
const DEFAULT_FIVE_SIM_COUNTRY_LABEL = '越南 (Vietnam)';
const DEFAULT_FIVE_SIM_OPERATOR = 'any';
const FIVE_SIM_SUPPORTED_COUNTRY_ID_SET = new Set(['indonesia', 'thailand', 'vietnam']);
const HERO_SMS_SUPPORTED_COUNTRY_ID_SET = new Set(['6', '52', '10']);
const DEFAULT_HERO_SMS_REUSE_ENABLED = true;
const HERO_SMS_ACQUIRE_PRIORITY_COUNTRY = 'country';
const HERO_SMS_ACQUIRE_PRIORITY_PRICE = 'price';
const DEFAULT_HERO_SMS_ACQUIRE_PRIORITY = HERO_SMS_ACQUIRE_PRIORITY_COUNTRY;
const DEFAULT_HERO_SMS_COUNTRY_ID = 52;
const DEFAULT_HERO_SMS_COUNTRY_LABEL = 'Thailand';
const PHONE_REPLACEMENT_LIMIT_MIN = 1;
const PHONE_REPLACEMENT_LIMIT_MAX = 20;
const PHONE_CODE_WAIT_SECONDS_MIN = 15;
const PHONE_CODE_WAIT_SECONDS_MAX = 300;
const DEFAULT_PHONE_CODE_WAIT_SECONDS = 60;
const PHONE_CODE_TIMEOUT_WINDOWS_MIN = 1;
const PHONE_CODE_TIMEOUT_WINDOWS_MAX = 10;
const DEFAULT_PHONE_CODE_TIMEOUT_WINDOWS = 2;
const PHONE_CODE_POLL_INTERVAL_SECONDS_MIN = 1;
const PHONE_CODE_POLL_INTERVAL_SECONDS_MAX = 30;
const DEFAULT_PHONE_CODE_POLL_INTERVAL_SECONDS = 5;
const PHONE_CODE_POLL_MAX_ROUNDS_MIN = 1;
const PHONE_CODE_POLL_MAX_ROUNDS_MAX = 120;
const DEFAULT_PHONE_CODE_POLL_MAX_ROUNDS = 4;
const DEFAULT_PHONE_VERIFICATION_REPLACEMENT_LIMIT = 3;
function getCloudflareDomainsFromState() {
  return { domains: [], activeDomain: '' };
}
function normalizeCloudflareDomainValue(value) { return String(value || '').trim(); }
function getCloudflareTempEmailDomainsFromState() {
  return { domains: [], activeDomain: '' };
}
function normalizeCloudflareTempEmailDomainValue(value) { return String(value || '').trim(); }
function getSelectedLocalCpaStep9Mode() { return 'submit'; }
function getSelectedMail2925Mode() { return 'provide'; }
function getSelectedHotmailServiceMode() { return 'local'; }
function buildManagedAliasBaseEmailPayload() {
  return { gmailBaseEmail: '', mail2925BaseEmail: 'demo@2925.com', emailPrefix: '' };
}
function normalizeLuckmailBaseUrl(value) { return String(value || '').trim(); }
function normalizeLuckmailEmailType(value) { return String(value || '').trim() || 'ms_graph'; }
function normalizeCloudflareTempEmailBaseUrlValue(value) { return String(value || '').trim(); }
function normalizeCloudflareTempEmailReceiveMailboxValue(value) { return String(value || '').trim(); }
function normalizeAccountRunHistoryHelperBaseUrlValue(value) { return String(value || '').trim(); }
function normalizeAutoRunThreadIntervalMinutes(value) { return Number(value) || 0; }
function normalizeAutoStepDelaySeconds(value) { return value === '' ? null : Number(value); }
function normalizeVerificationResendCount(value, fallback) { return Number(value) || fallback; }
function normalizePlusAccountAccessStrategy(value = '') { return String(value || '').trim().toLowerCase() === PLUS_ACCOUNT_ACCESS_STRATEGY_SUB2API_CODEX_SESSION ? PLUS_ACCOUNT_ACCESS_STRATEGY_SUB2API_CODEX_SESSION : PLUS_ACCOUNT_ACCESS_STRATEGY_OAUTH; }
function normalizePhoneSmsProvider(value = '') { return String(value || '').trim().toLowerCase() === '5sim' ? '5sim' : 'hero-sms'; }
function getSelectedPhoneSmsProvider() { return normalizePhoneSmsProvider(selectPhoneSmsProvider?.value || latestState?.phoneSmsProvider); }
function normalizeFiveSimCountryId(value, fallback = DEFAULT_FIVE_SIM_COUNTRY_ID) { return String(value || '').trim().toLowerCase().replace(/[^a-z0-9_-]+/g, '') || fallback; }
function normalizeFiveSimCountryLabel(value = '', fallback = DEFAULT_FIVE_SIM_COUNTRY_LABEL) { return String(value || '').trim() || fallback; }
function normalizeFiveSimOperator(value = '', fallback = DEFAULT_FIVE_SIM_OPERATOR) { return String(value || '').trim().toLowerCase().replace(/[^a-z0-9_-]+/g, '') || fallback; }
function normalizeFiveSimMaxPriceValue(value = '') { const numeric = Number(String(value ?? '').trim()); return Number.isFinite(numeric) && numeric > 0 ? String(Math.round(numeric * 10000) / 10000) : ''; }
function normalizeFiveSimCountryFallbackList(value = []) { return Array.isArray(value) ? value.map((entry) => ({ id: normalizeFiveSimCountryId(entry?.id ?? entry, ''), label: String(entry?.label || entry?.id || entry || '').trim() })).filter((entry) => entry.id) : []; }
function normalizeHeroSmsMaxPriceValue(value = '') { const numeric = Number(String(value ?? '').trim()); return Number.isFinite(numeric) && numeric > 0 ? String(Math.round(numeric * 10000) / 10000) : ''; }
function normalizePhoneSmsMaxPriceValue(value = '', provider = getSelectedPhoneSmsProvider()) { return normalizePhoneSmsProvider(provider) === '5sim' ? normalizeFiveSimMaxPriceValue(value) : normalizeHeroSmsMaxPriceValue(value); }
function normalizeHeroSmsReuseEnabledValue(value) { return value === undefined || value === null ? true : Boolean(value); }
function normalizeHeroSmsAcquirePriority(value = '') { return String(value || '').trim().toLowerCase() === 'price' ? 'price' : 'country'; }
function normalizeHeroSmsCountryId(value) { return Math.max(1, Math.floor(Number(value) || 52)); }
function normalizeHeroSmsCountryLabel(value = '') { return String(value || '').trim() || 'Thailand'; }
function normalizeHeroSmsCountryFallbackList(value = []) { return Array.isArray(value) ? value.map((entry) => ({ id: normalizeHeroSmsCountryId(entry?.id ?? entry), label: String(entry?.label || 'Thailand') })) : []; }
function normalizePhoneVerificationReplacementLimit(value, fallback = 3) { const parsed = Number.parseInt(String(value ?? '').trim(), 10); return Number.isFinite(parsed) ? parsed : fallback; }
function normalizePhoneCodeWaitSecondsValue(value, fallback = 60) { const parsed = Number.parseInt(String(value ?? '').trim(), 10); return Number.isFinite(parsed) ? parsed : fallback; }
function normalizePhoneCodeTimeoutWindowsValue(value, fallback = 2) { const parsed = Number.parseInt(String(value ?? '').trim(), 10); return Number.isFinite(parsed) ? parsed : fallback; }
function normalizePhoneCodePollIntervalSecondsValue(value, fallback = 5) { const parsed = Number.parseInt(String(value ?? '').trim(), 10); return Number.isFinite(parsed) ? parsed : fallback; }
function normalizePhoneCodePollMaxRoundsValue(value, fallback = 4) { const parsed = Number.parseInt(String(value ?? '').trim(), 10); return Number.isFinite(parsed) ? parsed : fallback; }
function getSelectedHeroSmsCountryOption() { return { id: 52, label: 'Thailand' }; }
function syncHeroSmsFallbackSelectionOrderFromSelect() { return [{ id: 52, label: 'Thailand' }]; }
${bundle}
return { collectSettingsPayload };
`)(normalizeIcloudTargetMailboxType, normalizeIcloudForwardMailProvider);

  const payload = api.collectSettingsPayload();

  assert.equal(payload.currentMail2925AccountId, 'acc-2');
  assert.equal(payload.mail2925UseAccountPool, true);
  assert.equal(payload.phoneVerificationEnabled, false);
});
