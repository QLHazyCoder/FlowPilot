const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');

const source = fs.readFileSync('sidepanel/sidepanel.js', 'utf8');

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

test('getMailProviderLoginUrl reuses preferred icloud host when preference is auto', () => {
  const bundle = [
    extractFunction('getSelectedIcloudHostPreference'),
    extractFunction('getMailProviderLoginUrl'),
  ].join('\n');

  const api = new Function(`
const ICLOUD_PROVIDER = 'icloud';
const selectMailProvider = { value: ICLOUD_PROVIDER };
const selectIcloudHostPreference = { value: 'auto' };
const latestState = { icloudHostPreference: 'auto', preferredIcloudHost: 'icloud.com.cn' };
function normalizeIcloudHost(value = '') {
  const normalized = String(value || '').trim().toLowerCase();
  return normalized === 'icloud.com' || normalized === 'icloud.com.cn' ? normalized : '';
}
function getIcloudLoginUrlForHost(host) {
  return host === 'icloud.com.cn' ? 'https://www.icloud.com.cn/' : 'https://www.icloud.com/';
}
function getMailProviderLoginConfig() {
  return { label: 'iCloud 邮箱' };
}
${bundle}
return { getSelectedIcloudHostPreference, getMailProviderLoginUrl };
`)();

  assert.equal(api.getSelectedIcloudHostPreference(), 'icloud.com.cn');
  assert.equal(api.getMailProviderLoginUrl(), 'https://www.icloud.com.cn/');
});

test('collectSettingsPayload persists icloud target mailbox settings', () => {
  const bundle = extractFunction('collectSettingsPayload');

  const api = new Function(`
let latestState = { accountContributionEnabled: false };
const window = {};
const PLUS_ACCOUNT_ACCESS_STRATEGY_OAUTH = 'oauth';
const PLUS_ACCOUNT_ACCESS_STRATEGY_SUB2API_CODEX_SESSION = 'sub2api_codex_session';
const DEFAULT_PLUS_ACCOUNT_ACCESS_STRATEGY = PLUS_ACCOUNT_ACCESS_STRATEGY_OAUTH;
let cloudflareDomainEditMode = false;
let cloudflareTempEmailDomainEditMode = false;
const selectCfDomain = { value: '' };
const selectTempEmailDomain = { value: '' };
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
const selectMailProvider = { value: 'icloud' };
const selectEmailGenerator = { value: 'duck' };
const checkboxAutoDeleteIcloud = { checked: false };
const selectIcloudHostPreference = { value: 'auto' };
const selectIcloudFetchMode = { value: 'reuse_existing' };
const selectIcloudTargetMailboxType = { value: 'forward-mailbox' };
const selectIcloudForwardMailProvider = { value: 'gmail' };
const inputPhoneVerificationEnabled = { checked: false };
const selectPhoneSmsProvider = { value: 'hero-sms' };
const inputFiveSimOperator = { value: 'any' };
const inputAccountRunHistoryTextEnabled = { checked: false };
const inputAccountRunHistoryHelperBaseUrl = { value: '' };
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
const inputAutoDelayEnabled = { checked: false };
const inputAutoDelayMinutes = { value: '30' };
const inputAutoStepDelaySeconds = { value: '' };
const inputOAuthFlowTimeoutEnabled = { checked: true };
const inputVerificationResendCount = { value: '4' };
const DEFAULT_VERIFICATION_RESEND_COUNT = 4;
const PHONE_SMS_PROVIDER_HERO_SMS = 'hero-sms';
const PHONE_SMS_PROVIDER_FIVE_SIM = '5sim';
const PHONE_SMS_PROVIDER_MADAO = 'madao';
const PHONE_SMS_PROVIDER_NEXSMS = 'nexsms';
const MADAO_DEFAULT_BASE_URL = 'http://127.0.0.1:7822';
const MADAO_MODE_ROUTING_PLAN = 'routing_plan';
const MADAO_MODE_DIRECT = 'direct';
const inputFiveSimApiKey = { value: '' };
const inputNexSmsApiKey = { value: '' };
const inputMaDaoBaseUrl = { value: '' };
const inputMaDaoHttpSecret = { value: '' };
const selectMaDaoMode = { value: 'routing_plan' };
const selectMaDaoProviderId = { value: '' };
const selectMaDaoRoutingPlanId = { value: '' };
const selectMaDaoCountry = { value: '' };
const inputMaDaoAutoPickCountry = { checked: true };
const inputMaDaoReusePhone = { checked: true };
const inputHeroSmsMinPrice = { value: '' };
const inputHeroSmsPreferredPrice = { value: '' };
const inputFiveSimProduct = { value: 'openai' };
const inputNexSmsServiceCode = { value: 'ot' };
const DEFAULT_PHONE_SMS_PROVIDER = PHONE_SMS_PROVIDER_HERO_SMS;
const DEFAULT_FIVE_SIM_COUNTRY_ID = 'vietnam';
const DEFAULT_FIVE_SIM_COUNTRY_LABEL = '越南 (Vietnam)';
const DEFAULT_FIVE_SIM_OPERATOR = 'any';
const DEFAULT_FIVE_SIM_PRODUCT = 'openai';
const DEFAULT_NEX_SMS_SERVICE_CODE = 'ot';
const DEFAULT_NEX_SMS_COUNTRY_ORDER = [1];
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
const inputHeroSmsApiKey = { value: '' };
const inputHeroSmsReuseEnabled = { checked: true };
const selectHeroSmsAcquirePriority = { value: 'country' };
const inputHeroSmsMaxPrice = { value: '' };
const inputPhoneReplacementLimit = { value: '3' };
const inputPhoneCodeWaitSeconds = { value: '60' };
const inputPhoneCodeTimeoutWindows = { value: '2' };
const inputPhoneCodePollIntervalSeconds = { value: '5' };
const inputPhoneCodePollMaxRounds = { value: '4' };
const selectHeroSmsCountry = { value: '52', selectedIndex: 0, options: [{ value: '52', textContent: 'Thailand' }] };
function normalizeHeroSmsMaxPriceValue(value = '') { return String(value || '').trim(); }
function normalizeHeroSmsReuseEnabledValue(value) { return value === undefined || value === null ? true : Boolean(value); }
function normalizeHeroSmsAcquirePriority(value = '') { return String(value || '').trim().toLowerCase() === 'price' ? 'price' : 'country'; }
function normalizeHeroSmsCountryId(value) { return Math.max(1, Math.floor(Number(value) || 52)); }
function normalizeHeroSmsCountryLabel(value = '') { return String(value || '').trim() || 'Thailand'; }
function normalizePhoneVerificationReplacementLimit(value, fallback = 3) {
  const parsed = Number.parseInt(String(value ?? '').trim(), 10);
  return Number.isFinite(parsed) ? parsed : fallback;
}
function normalizePhoneCodeWaitSecondsValue(value, fallback = 60) {
  const parsed = Number.parseInt(String(value ?? '').trim(), 10);
  return Number.isFinite(parsed) ? parsed : fallback;
}
function normalizePhoneCodeTimeoutWindowsValue(value, fallback = 2) {
  const parsed = Number.parseInt(String(value ?? '').trim(), 10);
  return Number.isFinite(parsed) ? parsed : fallback;
}
function normalizePhoneCodePollIntervalSecondsValue(value, fallback = 5) {
  const parsed = Number.parseInt(String(value ?? '').trim(), 10);
  return Number.isFinite(parsed) ? parsed : fallback;
}
function normalizePhoneCodePollMaxRoundsValue(value, fallback = 12) {
  const parsed = Number.parseInt(String(value ?? '').trim(), 10);
  return Number.isFinite(parsed) ? parsed : fallback;
}
function getSelectedHeroSmsCountryOption() { return { id: 52, label: 'Thailand' }; }
function syncHeroSmsFallbackSelectionOrderFromSelect() { return [{ id: 52, label: 'Thailand' }]; }
function getPayPalAccounts() { return []; }
function getCurrentPayPalAccount() { return null; }
function getCloudflareDomainsFromState() { return { domains: [], activeDomain: '' }; }
function normalizeCloudflareDomainValue(value) { return String(value || '').trim(); }
function getCloudflareTempEmailDomainsFromState() { return { domains: [], activeDomain: '' }; }
function normalizeCloudflareTempEmailDomainValue(value) { return String(value || '').trim(); }
function getSelectedLocalCpaStep9Mode() { return 'submit'; }
function getSelectedMail2925Mode() { return 'provide'; }
function buildManagedAliasBaseEmailPayload() { return { gmailBaseEmail: '', mail2925BaseEmail: '', emailPrefix: '' }; }
function getSelectedHotmailServiceMode() { return 'local'; }
function normalizeLuckmailBaseUrl(value) { return String(value || '').trim(); }
function normalizeLuckmailEmailType(value) { return String(value || '').trim() || 'ms_graph'; }
function normalizeCloudflareTempEmailBaseUrlValue(value) { return String(value || '').trim(); }
function normalizeCloudflareTempEmailReceiveMailboxValue(value) { return String(value || '').trim(); }
function normalizeAccountRunHistoryHelperBaseUrlValue(value) { return String(value || '').trim(); }
function normalizeAutoRunThreadIntervalMinutes(value) { return Number(value) || 0; }
function normalizeAutoDelayMinutes(value) { return Number(value) || 30; }
function normalizeAutoStepDelaySeconds(value) { return value === '' ? null : Number(value); }
function normalizeVerificationResendCount(value, fallback) { return Number(value) || fallback; }
function normalizePlusAccountAccessStrategy(value = '') { return String(value || '').trim().toLowerCase() === PLUS_ACCOUNT_ACCESS_STRATEGY_SUB2API_CODEX_SESSION ? PLUS_ACCOUNT_ACCESS_STRATEGY_SUB2API_CODEX_SESSION : PLUS_ACCOUNT_ACCESS_STRATEGY_OAUTH; }
function normalizePhoneSmsProvider(value = '') { return String(value || '').trim().toLowerCase() === '5sim' ? '5sim' : 'hero-sms'; }
function setPhoneSmsProviderSelectValue(provider) {
  const normalizedProvider = normalizePhoneSmsProvider(provider);
  selectPhoneSmsProvider.value = normalizedProvider;
  return normalizedProvider;
}
function getSelectedPhoneSmsProvider() { return normalizePhoneSmsProvider(selectPhoneSmsProvider?.value || latestState?.phoneSmsProvider); }
function normalizeMaDaoModeValue(value = '') { return String(value || '').trim().toLowerCase() === 'direct' ? 'direct' : 'routing_plan'; }
function normalizeMaDaoProviderIdValue(value = '') { return String(value || '').trim().toLowerCase().replace(/[^a-z0-9_-]+/g, ''); }
function normalizeMaDaoRoutingPlanIdValue(value = '') { return String(value || '').trim(); }
function normalizeMaDaoCountryValue(value = '') { return String(value || '').trim().toLowerCase(); }
function resolveMaDaoServiceName() { return 'openai'; }
function normalizeFiveSimCountryId(value, fallback = DEFAULT_FIVE_SIM_COUNTRY_ID) { return String(value || '').trim().toLowerCase().replace(/[^a-z0-9_-]+/g, '') || fallback; }
function normalizeFiveSimCountryLabel(value = '', fallback = DEFAULT_FIVE_SIM_COUNTRY_LABEL) { return String(value || '').trim() || fallback; }
function normalizeFiveSimCountryCode(value = '', fallback = DEFAULT_FIVE_SIM_COUNTRY_ID) { return normalizeFiveSimCountryId(value, fallback); }
function normalizeFiveSimOperator(value = '', fallback = DEFAULT_FIVE_SIM_OPERATOR) { return String(value || '').trim().toLowerCase().replace(/[^a-z0-9_-]+/g, '') || fallback; }
function normalizeFiveSimMaxPriceValue(value = '') { const numeric = Number(String(value ?? '').trim()); return Number.isFinite(numeric) && numeric > 0 ? String(Math.round(numeric * 10000) / 10000) : ''; }
function normalizeFiveSimCountryFallbackList(value = []) { return Array.isArray(value) ? value.map((entry) => ({ id: normalizeFiveSimCountryId(entry?.id ?? entry, ''), label: String(entry?.label || entry?.id || entry || '').trim() })).filter((entry) => entry.id) : []; }
function normalizePhoneSmsMaxPriceValue(value = '', provider = getSelectedPhoneSmsProvider()) { return normalizePhoneSmsProvider(provider) === '5sim' ? normalizeFiveSimMaxPriceValue(value) : normalizeHeroSmsMaxPriceValue(value); }
function normalizePhoneSmsMinPriceValue(value = '', provider = getSelectedPhoneSmsProvider()) { return normalizePhoneSmsMaxPriceValue(value, provider); }
function normalizeHeroSmsCountryFallbackList(value = []) { return Array.isArray(value) ? value.map((entry) => ({ id: normalizeHeroSmsCountryId(entry?.id ?? entry), label: String(entry?.label || 'Thailand') })) : []; }
function normalizeFiveSimProductValue(value = '') { return String(value || '').trim().toLowerCase() || 'openai'; }
function normalizeNexSmsServiceCodeValue(value = '') { return String(value || '').trim().toLowerCase() || 'ot'; }
function normalizeNexSmsCountryIdValue(value, fallback = -1) { const normalized = Math.floor(Number(value)); return Number.isFinite(normalized) && normalized >= 0 ? normalized : fallback; }
function normalizeNexSmsCountryOrderValue(value = []) { return Array.isArray(value) ? value : []; }
function getSelectedFiveSimCountries() { return [{ id: DEFAULT_FIVE_SIM_COUNTRY_ID, code: DEFAULT_FIVE_SIM_COUNTRY_ID, label: DEFAULT_FIVE_SIM_COUNTRY_LABEL }]; }
function getSelectedNexSmsCountries() { return [{ id: DEFAULT_NEX_SMS_COUNTRY_ORDER[0], label: 'Country #1' }]; }
function getSelectedPhoneSmsProviderOrder() { return [getSelectedPhoneSmsProvider()]; }
function getSelectedPhonePreferredActivation() { return null; }
function normalizeIcloudTargetMailboxType(value) { return String(value || '').trim().toLowerCase() === 'forward-mailbox' ? 'forward-mailbox' : 'icloud-inbox'; }
function normalizeIcloudForwardMailProvider(value) { return String(value || '').trim().toLowerCase() === 'gmail' ? 'gmail' : 'qq'; }
${bundle}
return { collectSettingsPayload };
`)();

  const payload = api.collectSettingsPayload();
  assert.equal(payload.icloudTargetMailboxType, 'forward-mailbox');
  assert.equal(payload.icloudForwardMailProvider, 'gmail');
});

test('updateMailProviderUI toggles icloud forward mailbox controls and hint', () => {
  const bundle = extractFunction('updateMailProviderUI');
  const createRow = (display = 'none') => ({ style: { display } });

  const api = new Function('createRow', `
let latestState = { icloudHostPreference: 'icloud.com.cn' };
let cloudflareDomainEditMode = false;
let cloudflareTempEmailDomainEditMode = false;
const ICLOUD_PROVIDER = 'icloud';
const GMAIL_PROVIDER = 'gmail';
const GMAIL_ALIAS_GENERATOR = 'gmail-alias';
const LUCKMAIL_PROVIDER = 'luckmail-api';
const CUSTOM_EMAIL_POOL_GENERATOR = 'custom-pool';
const HOTMAIL_SERVICE_MODE_REMOTE = 'remote';
const HOTMAIL_SERVICE_MODE_LOCAL = 'local';
const rowMail2925Mode = createRow();
const rowMail2925PoolSettings = createRow();
const rowEmailPrefix = createRow();
const rowCustomMailProviderPool = createRow();
const rowInbucketHost = createRow();
const rowInbucketMailbox = createRow();
const rowEmailGenerator = createRow();
const rowCfDomain = createRow();
const rowTempEmailBaseUrl = createRow();
const rowTempEmailAdminAuth = createRow();
const rowTempEmailCustomAuth = createRow();
const rowTempEmailReceiveMailbox = createRow();
const rowTempEmailRandomSubdomainToggle = createRow();
const rowTempEmailDomain = createRow();
const cloudflareTempEmailSection = createRow();
const hotmailSection = createRow();
const mail2925Section = createRow();
const luckmailSection = createRow();
const icloudSection = createRow();
const rowIcloudTargetMailboxType = createRow();
const rowIcloudForwardMailProvider = createRow();
const labelEmailPrefix = { textContent: '' };
const inputEmailPrefix = { placeholder: '', style: { display: '' }, readOnly: false };
const labelMail2925UseAccountPool = createRow();
const selectMail2925PoolAccount = { style: { display: 'none' }, disabled: false };
const btnFetchEmail = { hidden: false, disabled: false, textContent: '' };
const btnMailLogin = { disabled: false, textContent: '', title: '' };
const inputEmail = { readOnly: false, placeholder: '', value: '' };
const autoHintText = { textContent: '' };
const rowHotmailServiceMode = createRow();
const rowHotmailRemoteBaseUrl = createRow();
const rowHotmailLocalBaseUrl = createRow();
const inputMail2925UseAccountPool = { checked: false };
const selectMailProvider = { value: 'icloud' };
const selectEmailGenerator = { value: 'duck', disabled: false, options: [] };
const selectIcloudTargetMailboxType = { value: 'icloud-inbox' };
const selectIcloudForwardMailProvider = { value: 'gmail' };
const selectIcloudHostPreference = { value: 'icloud.com.cn' };
const inputTempEmailUseRandomSubdomain = { checked: false };
const inputRunCount = { disabled: false };
const currentAutoRun = { autoRunning: false };
const MAIL_PROVIDER_LOGIN_CONFIGS = { gmail: { label: 'Gmail 邮箱' } };
const ICLOUD_FORWARD_MAIL_PROVIDER_LABELS = { gmail: 'Gmail 邮箱' };
function normalizeIcloudHost(value) { return String(value || '').trim().toLowerCase(); }
function normalizeIcloudTargetMailboxType(value) { return String(value || '').trim().toLowerCase() === 'forward-mailbox' ? 'forward-mailbox' : 'icloud-inbox'; }
function normalizeIcloudForwardMailProvider(value) { return String(value || '').trim().toLowerCase() === 'gmail' ? 'gmail' : 'qq'; }
function getSelectedIcloudHostPreference() { return selectIcloudHostPreference.value; }
function isLuckmailProvider() { return false; }
function isCustomMailProvider() { return false; }
function isIcloudMailProvider() { return selectMailProvider.value === ICLOUD_PROVIDER; }
function usesCustomMailProviderPool() { return false; }
function usesGeneratedAliasMailProvider() { return false; }
function getSelectedMail2925Mode() { return 'provide'; }
function getManagedAliasProviderUiCopy() { return null; }
function getCurrentRegistrationEmailUiCopy() { return { buttonLabel: '获取邮箱', placeholder: '邮箱', label: '邮箱' }; }
function updateMailLoginButtonState() {}
function getSelectedHotmailServiceMode() { return 'local'; }
function getCloudflareDomainsFromState() { return { domains: [], activeDomain: '' }; }
function setCloudflareDomainEditMode() {}
function getCloudflareTempEmailDomainsFromState() { return { domains: [], activeDomain: '' }; }
function setCloudflareTempEmailDomainEditMode() {}
function queueIcloudAliasRefresh() {}
function hideIcloudLoginHelp() {}
function syncMail2925PoolAccountOptions() {}
function getMail2925Accounts() { return []; }
function renderHotmailAccounts() {}
function renderMail2925Accounts() {}
function renderLuckmailPurchases() {}
function getSelectedEmailGenerator() { return selectEmailGenerator.value; }
function isAutoRunLockedPhase() { return false; }
function getCurrentHotmailEmail() { return ''; }
function getCurrentLuckmailEmail() { return ''; }
function getCustomEmailPoolSize() { return 0; }
function getCustomMailProviderPoolSize() { return 0; }
function syncRunCountFromCustomEmailPool() {}
function syncRunCountFromCustomMailProviderPool() {}
function shouldLockRunCountToEmailPool() { return false; }
${bundle}
return {
  updateMailProviderUI,
  rowIcloudTargetMailboxType,
  rowIcloudForwardMailProvider,
  selectIcloudTargetMailboxType,
  autoHintText,
};
`)(createRow);

  api.updateMailProviderUI();
  assert.equal(api.rowIcloudTargetMailboxType.style.display, '');
  assert.equal(api.rowIcloudForwardMailProvider.style.display, 'none');

  api.selectIcloudTargetMailboxType.value = 'forward-mailbox';
  api.updateMailProviderUI();
  assert.equal(api.rowIcloudForwardMailProvider.style.display, '');
  assert.match(api.autoHintText.textContent, /Gmail 邮箱/);
});

test('applySettingsState restores icloud forward mailbox settings before UI refresh', () => {
  const bundle = extractFunction('applySettingsState');
  const calls = [];

  const api = new Function('calls', `
let latestState = {};
const PLUS_ACCOUNT_ACCESS_STRATEGY_OAUTH = 'oauth';
const PLUS_ACCOUNT_ACCESS_STRATEGY_SUB2API_CODEX_SESSION = 'sub2api_codex_session';
const DEFAULT_PLUS_ACCOUNT_ACCESS_STRATEGY = PLUS_ACCOUNT_ACCESS_STRATEGY_OAUTH;
const inputEmail = { value: '' };
const inputVpsUrl = { value: '' };
const inputVpsPassword = { value: '' };
const selectPanelMode = { value: 'cpa' };
const inputSub2ApiUrl = { value: '' };
const inputSub2ApiEmail = { value: '' };
const inputSub2ApiPassword = { value: '' };
const inputSub2ApiGroup = { value: '' };
const inputSub2ApiDefaultProxy = { value: '' };
const inputCodex2ApiUrl = { value: '' };
const inputCodex2ApiAdminKey = { value: '' };
const ICLOUD_PROVIDER = 'icloud';
const GMAIL_PROVIDER = 'gmail';
const GMAIL_ALIAS_GENERATOR = 'gmail-alias';
const CUSTOM_EMAIL_POOL_GENERATOR = 'custom-pool';
const selectMailProvider = { value: '163' };
const selectEmailGenerator = { value: 'duck' };
const selectIcloudHostPreference = { value: 'auto' };
const selectIcloudFetchMode = { value: 'reuse_existing' };
const selectIcloudTargetMailboxType = { value: 'icloud-inbox' };
const selectIcloudForwardMailProvider = { value: 'qq' };
const checkboxAutoDeleteIcloud = { checked: false };
const inputAccountRunHistoryHelperBaseUrl = { value: '' };
const inputContributionNickname = { value: '' };
const inputContributionQq = { value: '' };
const inputMail2925UseAccountPool = { checked: false };
const inputInbucketHost = { value: '' };
const inputInbucketMailbox = { value: '' };
const inputCustomMailProviderPool = { value: '' };
const inputCustomEmailPool = { value: '' };
const inputHotmailRemoteBaseUrl = { value: '' };
const inputHotmailLocalBaseUrl = { value: '' };
const inputLuckmailApiKey = { value: '' };
const inputLuckmailBaseUrl = { value: '' };
const selectLuckmailEmailType = { value: 'ms_graph' };
const inputLuckmailDomain = { value: '' };
const inputAutoSkipFailures = { checked: false };
const inputAutoSkipFailuresThreadIntervalMinutes = { value: '' };
const inputAutoDelayEnabled = { checked: false };
const inputAutoDelayMinutes = { value: '' };
const inputAutoStepDelaySeconds = { value: '' };
const inputOAuthFlowTimeoutEnabled = { checked: true };
const inputVerificationResendCount = { value: '' };
const inputPhoneVerificationEnabled = { checked: false };
const selectPhoneSmsProvider = { value: 'hero-sms' };
const DEFAULT_PHONE_VERIFICATION_ENABLED = false;
const inputHeroSmsApiKey = { value: '' };
const inputHeroSmsReuseEnabled = { checked: true };
const selectHeroSmsAcquirePriority = { value: 'country' };
const inputHeroSmsMaxPrice = { value: '' };
const inputFiveSimOperator = { value: 'any' };
const inputPhoneReplacementLimit = { value: '' };
const inputPhoneCodeWaitSeconds = { value: '' };
const inputPhoneCodeTimeoutWindows = { value: '' };
const inputPhoneCodePollIntervalSeconds = { value: '' };
const inputPhoneCodePollMaxRounds = { value: '' };
const selectHeroSmsCountry = { value: '52', options: [{ value: '52' }] };
const inputRunCount = { value: '' };
const DEFAULT_VERIFICATION_RESEND_COUNT = 4;
const PHONE_SMS_PROVIDER_HERO_SMS = 'hero-sms';
const PHONE_SMS_PROVIDER_FIVE_SIM = '5sim';
const PHONE_SMS_PROVIDER_MADAO = 'madao';
const DEFAULT_PHONE_SMS_PROVIDER = PHONE_SMS_PROVIDER_HERO_SMS;
const DEFAULT_FIVE_SIM_COUNTRY_ID = 'vietnam';
const DEFAULT_FIVE_SIM_COUNTRY_LABEL = '越南 (Vietnam)';
const DEFAULT_FIVE_SIM_OPERATOR = 'any';
const FIVE_SIM_SUPPORTED_COUNTRY_ID_SET = new Set(['indonesia', 'thailand', 'vietnam']);
const HERO_SMS_SUPPORTED_COUNTRY_ID_SET = new Set(['6', '52', '10']);
const DEFAULT_PHONE_VERIFICATION_REPLACEMENT_LIMIT = 3;
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
const DEFAULT_HERO_SMS_REUSE_ENABLED = true;
const HERO_SMS_ACQUIRE_PRIORITY_COUNTRY = 'country';
const HERO_SMS_ACQUIRE_PRIORITY_PRICE = 'price';
const DEFAULT_HERO_SMS_ACQUIRE_PRIORITY = HERO_SMS_ACQUIRE_PRIORITY_COUNTRY;
const DEFAULT_HERO_SMS_COUNTRY_ID = 52;
const DEFAULT_HERO_SMS_COUNTRY_LABEL = 'Thailand';
function syncLatestState(state) { latestState = { ...latestState, ...state }; }
function syncAutoRunState() {}
function syncPasswordField() {}
function renderStepStatuses() {}
function setLocalCpaStep9Mode() {}
function normalizePanelMode(value = '') {
  const normalized = String(value || '').trim().toLowerCase();
  return normalized === 'sub2api' || normalized === 'codex2api' ? normalized : 'cpa';
}
function normalizePlusAccountAccessStrategy(value = '') { return String(value || '').trim().toLowerCase() === PLUS_ACCOUNT_ACCESS_STRATEGY_SUB2API_CODEX_SESSION ? PLUS_ACCOUNT_ACCESS_STRATEGY_SUB2API_CODEX_SESSION : PLUS_ACCOUNT_ACCESS_STRATEGY_OAUTH; }
function isCustomMailProvider() { return false; }
function setMail2925Mode() {}
function normalizeIcloudFetchMode(value) { return String(value || '') === 'always_new' ? 'always_new' : 'reuse_existing'; }
function normalizeIcloudTargetMailboxType(value) { return String(value || '').trim().toLowerCase() === 'forward-mailbox' ? 'forward-mailbox' : 'icloud-inbox'; }
function normalizeIcloudForwardMailProvider(value) { return String(value || '').trim().toLowerCase() === 'gmail' ? 'gmail' : 'qq'; }
function normalizeAccountRunHistoryHelperBaseUrlValue(value) { return String(value || '').trim(); }
function setManagedAliasBaseEmailInputForProvider() {}
function normalizeCustomEmailPoolEntries(value) { return Array.isArray(value) ? value : []; }
function setHotmailServiceMode() {}
function normalizeLuckmailBaseUrl(value) { return String(value || '').trim(); }
function normalizeLuckmailEmailType(value) { return String(value || '').trim() || 'ms_graph'; }
function applyCloudflareTempEmailSettingsState() {}
function renderCloudflareDomainOptions() {}
function setCloudflareDomainEditMode() {}
function normalizeAutoRunThreadIntervalMinutes(value) { return Number(value) || 0; }
function normalizeAutoDelayMinutes(value) { return Number(value) || 30; }
function formatAutoStepDelayInputValue(value) { return value == null ? '' : String(value); }
function normalizeVerificationResendCount(value, fallback) { return Number(value) || fallback; }
function normalizeHeroSmsMaxPriceValue(value = '') { return String(value || '').trim(); }
function normalizePhoneVerificationReplacementLimit(value, fallback = 3) {
  const numeric = Number(value);
  if (!Number.isFinite(numeric)) return fallback;
  return Math.max(PHONE_REPLACEMENT_LIMIT_MIN, Math.min(PHONE_REPLACEMENT_LIMIT_MAX, Math.floor(numeric)));
}
function normalizePhoneSmsProvider(value = '') { return String(value || '').trim().toLowerCase() === '5sim' ? '5sim' : 'hero-sms'; }
function setPhoneSmsProviderSelectValue(provider) {
  const normalizedProvider = normalizePhoneSmsProvider(provider);
  selectPhoneSmsProvider.value = normalizedProvider;
  return normalizedProvider;
}
function getSelectedPhoneSmsProvider() { return normalizePhoneSmsProvider(selectPhoneSmsProvider?.value || latestState?.phoneSmsProvider); }
function normalizeFiveSimCountryId(value, fallback = DEFAULT_FIVE_SIM_COUNTRY_ID) { return String(value || '').trim().toLowerCase().replace(/[^a-z0-9_-]+/g, '') || fallback; }
function normalizeFiveSimCountryLabel(value = '', fallback = DEFAULT_FIVE_SIM_COUNTRY_LABEL) { return String(value || '').trim() || fallback; }
function normalizeFiveSimOperator(value = '', fallback = DEFAULT_FIVE_SIM_OPERATOR) { return String(value || '').trim().toLowerCase().replace(/[^a-z0-9_-]+/g, '') || fallback; }
function normalizeFiveSimMaxPriceValue(value = '') { const numeric = Number(String(value ?? '').trim()); return Number.isFinite(numeric) && numeric > 0 ? String(Math.round(numeric * 10000) / 10000) : ''; }
function normalizeFiveSimCountryFallbackList(value = []) { return Array.isArray(value) ? value.map((entry) => ({ id: normalizeFiveSimCountryId(entry?.id ?? entry, ''), label: String(entry?.label || entry?.id || entry || '').trim() })).filter((entry) => entry.id) : []; }
function normalizeHeroSmsCountryId() { return 52; }
function normalizeHeroSmsCountryLabel(value = '') { return String(value || '').trim() || 'Thailand'; }
function normalizeHeroSmsCountryFallbackList(value = []) { return Array.isArray(value) ? value : []; }
function normalizeHeroSmsReuseEnabledValue(value) { return value === undefined || value === null ? true : Boolean(value); }
function normalizeHeroSmsAcquirePriority(value = '') { return String(value || '').trim().toLowerCase() === 'price' ? 'price' : 'country'; }
function normalizePhoneCodeWaitSecondsValue(value, fallback = 60) { const parsed = Number.parseInt(String(value ?? '').trim(), 10); return Number.isFinite(parsed) ? parsed : fallback; }
function normalizePhoneCodeTimeoutWindowsValue(value, fallback = 2) { const parsed = Number.parseInt(String(value ?? '').trim(), 10); return Number.isFinite(parsed) ? parsed : fallback; }
function normalizePhoneCodePollIntervalSecondsValue(value, fallback = 5) { const parsed = Number.parseInt(String(value ?? '').trim(), 10); return Number.isFinite(parsed) ? parsed : fallback; }
function normalizePhoneCodePollMaxRoundsValue(value, fallback = 4) { const parsed = Number.parseInt(String(value ?? '').trim(), 10); return Number.isFinite(parsed) ? parsed : fallback; }
function getSelectedHeroSmsCountryOption() { return { id: 52, label: 'Thailand' }; }
function applyHeroSmsFallbackSelection() {}
function updateHeroSmsPlatformDisplay() {}
function updatePhoneSmsProviderOrderSummary() {}
function applyAutoRunStatus() {}
function markSettingsDirty() {}
function updateAutoDelayInputState() {}
function updateFallbackThreadIntervalInputState() {}
function updateAccountRunHistorySettingsUI() {}
function updatePhoneVerificationSettingsUI() {}
function updatePanelModeUI() {}
function updateMailProviderUI() { calls.push({ target: selectIcloudTargetMailboxType.value, provider: selectIcloudForwardMailProvider.value }); }
function renderGrokRuntimeState() {}
function renderSub2ApiGroupOptions() {}
function isLuckmailProvider() { return false; }
function updateButtonStates() {}
${bundle}
return { applySettingsState, selectIcloudTargetMailboxType, selectIcloudForwardMailProvider };
`)(calls);

  api.applySettingsState({
    mailProvider: 'icloud',
    icloudTargetMailboxType: 'forward-mailbox',
    icloudForwardMailProvider: 'gmail',
  });

  assert.equal(api.selectIcloudTargetMailboxType.value, 'forward-mailbox');
  assert.equal(api.selectIcloudForwardMailProvider.value, 'gmail');
  assert.deepEqual(calls.at(-1), { target: 'forward-mailbox', provider: 'gmail' });
});
