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

function createClassList() {
  const values = new Set();
  return {
    add(name) {
      values.add(name);
    },
    remove(name) {
      values.delete(name);
    },
    toggle(name, force) {
      if (force === undefined) {
        if (values.has(name)) {
          values.delete(name);
          return false;
        }
        values.add(name);
        return true;
      }
      if (force) {
        values.add(name);
        return true;
      }
      values.delete(name);
      return false;
    },
    contains(name) {
      return values.has(name);
    },
  };
}

function createElement(initial = {}) {
  return {
    disabled: Boolean(initial.disabled),
    hidden: Boolean(initial.hidden),
    value: initial.value || '',
    title: '',
    textContent: initial.textContent || '',
    listeners: {},
    attributes: {},
    classList: createClassList(),
    addEventListener(type, handler) {
      this.listeners[type] = handler;
    },
    setAttribute(name, value) {
      this.attributes[name] = String(value);
    },
  };
}

test('sidepanel html contains contribution mode runtime UI and loads the module before sidepanel bootstrap', () => {
  const html = fs.readFileSync('sidepanel/sidepanel.html', 'utf8');
  const moduleIndex = html.indexOf('<script src="contribution-mode.js"></script>');
  const sidepanelIndex = html.indexOf('<script src="sidepanel.js"></script>');

  assert.match(html, /id="btn-contribution-mode"/);
  assert.match(html, /id="contribution-mode-panel"/);
  assert.match(html, /id="contribution-oauth-status"/);
  assert.match(html, /id="contribution-callback-status"/);
  assert.match(html, /id="contribution-mode-summary"/);
  assert.match(html, /id="btn-start-contribution"/);
  assert.match(html, /id="btn-open-contribution-upload"/);
  assert.match(html, /id="btn-exit-contribution-mode"/);
  assert.match(html, /id="input-contribution-nickname"/);
  assert.match(html, /id="input-contribution-qq"/);
  assert.notEqual(moduleIndex, -1);
  assert.notEqual(sidepanelIndex, -1);
  assert.ok(moduleIndex < sidepanelIndex);
});

test('sidepanel settings refresh preserves rendered step progress', () => {
  const applySettingsStateSource = extractFunction('applySettingsState');
  assert.doesNotMatch(
    applySettingsStateSource,
    /syncStepDefinitionsForMode\(Boolean\(state\?\.plusModeEnabled\),\s*\{\s*render:\s*true\s*\}\)/
  );
  assert.match(applySettingsStateSource, /renderStepStatuses\(latestState\)/);

  const bundle = [
    extractFunction('isDoneStatus'),
    extractFunction('getNodeStatuses'),
    extractFunction('getStepStatuses'),
    extractFunction('escapeCssValue'),
    extractFunction('renderSingleNodeStatus'),
    extractFunction('renderSingleStepStatus'),
    extractFunction('renderStepStatuses'),
    extractFunction('updateProgressCounter'),
  ].join('\n');

  const api = new Function(`
const STATUS_ICONS = {
  pending: '',
  running: '',
  completed: 'C',
  failed: 'F',
  stopped: 'S',
  manual_completed: 'M',
  skipped: 'K',
};
let latestState = { nodeStatuses: { 'open-chatgpt': 'completed', 'submit-signup-email': 'running', 'fill-password': 'pending' } };
let NODE_IDS = ['open-chatgpt', 'submit-signup-email', 'fill-password'];
let NODE_DEFAULT_STATUSES = { 'open-chatgpt': 'pending', 'submit-signup-email': 'pending', 'fill-password': 'pending' };
let STEP_IDS = [1, 2, 3];
let STEP_DEFAULT_STATUSES = { 1: 'pending', 2: 'pending', 3: 'pending' };
function getStepIdByNodeIdForCurrentMode(nodeId) {
  return { 'open-chatgpt': 1, 'submit-signup-email': 2, 'fill-password': 3 }[nodeId] || 0;
}
const rows = new Map(STEP_IDS.map((step) => [step, { className: 'step-row' }]));
const statusEls = new Map(STEP_IDS.map((step) => [step, { textContent: '' }]));
const nodeRows = new Map(NODE_IDS.map((nodeId) => [nodeId, rows.get(getStepIdByNodeIdForCurrentMode(nodeId))]));
const nodeStatusEls = new Map(NODE_IDS.map((nodeId) => [nodeId, statusEls.get(getStepIdByNodeIdForCurrentMode(nodeId))]));
const document = {
  querySelector(selector) {
    const nodeMatch = selector.match(/data-node-id="([^"]+)"/);
    if (nodeMatch) {
      return selector.includes('step-status') ? nodeStatusEls.get(nodeMatch[1]) : nodeRows.get(nodeMatch[1]);
    }
    const match = selector.match(/data-step="(\\d+)"/);
    const step = match ? Number(match[1]) : 0;
    return selector.includes('step-status') ? statusEls.get(step) : rows.get(step);
  },
};
const stepsProgress = { textContent: '' };
${bundle}
return { renderStepStatuses, rows, statusEls, stepsProgress };
`)();

  api.renderStepStatuses();

  assert.equal(api.rows.get(1).className, 'step-row completed');
  assert.equal(api.rows.get(2).className, 'step-row running');
  assert.equal(api.rows.get(3).className, 'step-row pending');
  assert.equal(api.statusEls.get(1).textContent, 'C');
  assert.equal(api.statusEls.get(2).textContent, '');
  assert.equal(api.stepsProgress.textContent, '1 / 3');
});

test('collectSettingsPayload omits custom password and local sync settings in contribution mode', () => {
  const bundle = extractFunction('collectSettingsPayload');

  const api = new Function('normalizeIcloudTargetMailboxType', 'normalizeIcloudForwardMailProvider', `
let latestState = { accountContributionEnabled: true };
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
const inputVpsUrl = { value: 'https://panel.example.com' };
const inputVpsPassword = { value: 'panel-secret' };
const inputSub2ApiUrl = { value: 'https://sub.example.com' };
const inputSub2ApiEmail = { value: 'user@example.com' };
const inputSub2ApiPassword = { value: 'sub-secret' };
const inputSub2ApiGroup = { value: ' codex ' };
const inputSub2ApiDefaultProxy = { value: ' proxy-a ' };
const inputCodex2ApiUrl = { value: 'http://localhost:8080/admin/accounts' };
const inputCodex2ApiAdminKey = { value: 'codex-admin-secret' };
const inputPassword = { value: 'Secret123!' };
const selectMailProvider = { value: '163' };
const selectEmailGenerator = { value: 'duck' };
const checkboxAutoDeleteIcloud = { checked: true };
const selectIcloudHostPreference = { value: 'auto' };
const inputPhoneVerificationEnabled = { checked: true };
const selectPhoneSmsProvider = { value: 'hero-sms' };
const inputHeroSmsApiKey = { value: '' };
const inputHeroSmsReuseEnabled = { checked: true };
const selectHeroSmsAcquirePriority = { value: 'country' };
const inputHeroSmsMaxPrice = { value: '' };
const inputFiveSimOperator = { value: 'any' };
const inputPhoneReplacementLimit = { value: '3' };
const inputPhoneCodeWaitSeconds = { value: '60' };
const inputPhoneCodeTimeoutWindows = { value: '2' };
const inputPhoneCodePollIntervalSeconds = { value: '5' };
const inputPhoneCodePollMaxRounds = { value: '4' };
const inputAccountRunHistoryTextEnabled = { checked: true };
const inputAccountRunHistoryHelperBaseUrl = { value: 'http://127.0.0.1:17373' };
const inputInbucketHost = { value: 'inbucket.local' };
const inputInbucketMailbox = { value: 'demo' };
const inputHotmailRemoteBaseUrl = { value: 'https://hotmail.example.com' };
const inputHotmailLocalBaseUrl = { value: 'http://127.0.0.1:17373' };
const inputLuckmailApiKey = { value: 'lk-api-key' };
const inputLuckmailBaseUrl = { value: 'https://mails.example.com' };
const selectLuckmailEmailType = { value: 'ms_graph' };
const inputLuckmailDomain = { value: 'luckmail.example.com' };
const inputTempEmailBaseUrl = { value: 'https://temp.example.com' };
const inputTempEmailAdminAuth = { value: 'admin-secret' };
const inputTempEmailCustomAuth = { value: 'custom-secret' };
const inputTempEmailReceiveMailbox = { value: 'relay@example.com' };
const inputTempEmailUseRandomSubdomain = { checked: true };
const inputAutoSkipFailures = { checked: false };
const inputAutoSkipFailuresThreadIntervalMinutes = { value: '5' };
const inputAutoDelayEnabled = { checked: true };
const inputAutoDelayMinutes = { value: '30' };
const inputAutoStepDelaySeconds = { value: '10' };
const inputOAuthFlowTimeoutEnabled = { checked: true };
const inputVerificationResendCount = { value: '6' };
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
const DEFAULT_PHONE_VERIFICATION_REPLACEMENT_LIMIT = 3;
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

function getCloudflareDomainsFromState() { return { domains: ['example.com'], activeDomain: 'example.com' }; }
function normalizeCloudflareDomainValue(value) { return String(value || '').trim(); }
function getCloudflareTempEmailDomainsFromState() { return { domains: ['mail.example.com'], activeDomain: 'mail.example.com' }; }
function normalizeCloudflareTempEmailDomainValue(value) { return String(value || '').trim(); }
function getSelectedLocalCpaStep9Mode() { return 'submit'; }
function getSelectedMail2925Mode() { return 'provide'; }
function normalizeAccountRunHistoryHelperBaseUrlValue(value) { return String(value || '').trim(); }
function buildManagedAliasBaseEmailPayload() { return { gmailBaseEmail: '', mail2925BaseEmail: '', emailPrefix: '' }; }
function getSelectedHotmailServiceMode() { return 'local'; }
function normalizeLuckmailBaseUrl(value) { return String(value || '').trim(); }
function normalizeLuckmailEmailType(value) { return String(value || '').trim(); }
function normalizeCloudflareTempEmailBaseUrlValue(value) { return String(value || '').trim(); }
function normalizeCloudflareTempEmailReceiveMailboxValue(value) { return String(value || '').trim(); }
function normalizeAutoRunThreadIntervalMinutes(value) { return Number(value) || 0; }
function normalizeAutoDelayMinutes(value) { return Number(value) || 30; }
function normalizeAutoStepDelaySeconds(value) { return value === '' ? null : Number(value); }
function normalizeVerificationResendCount(value, fallback) { return Number.isFinite(Number(value)) ? Number(value) : fallback; }
function normalizePlusAccountAccessStrategy(value = '') { return String(value || '').trim().toLowerCase() === PLUS_ACCOUNT_ACCESS_STRATEGY_SUB2API_CODEX_SESSION ? PLUS_ACCOUNT_ACCESS_STRATEGY_SUB2API_CODEX_SESSION : PLUS_ACCOUNT_ACCESS_STRATEGY_OAUTH; }
function normalizePhoneSmsProvider(value = '') { return String(value || '').trim().toLowerCase() === '5sim' ? '5sim' : 'hero-sms'; }
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
function normalizeHeroSmsMaxPriceValue(value = '') { const numeric = Number(String(value ?? '').trim()); return Number.isFinite(numeric) && numeric > 0 ? String(Math.round(numeric * 10000) / 10000) : ''; }
function normalizePhoneSmsMaxPriceValue(value = '', provider = getSelectedPhoneSmsProvider()) { return normalizePhoneSmsProvider(provider) === '5sim' ? normalizeFiveSimMaxPriceValue(value) : normalizeHeroSmsMaxPriceValue(value); }
function normalizePhoneSmsMinPriceValue(value = '', provider = getSelectedPhoneSmsProvider()) { return normalizePhoneSmsMaxPriceValue(value, provider); }
function normalizeHeroSmsReuseEnabledValue(value) { return value === undefined || value === null ? true : Boolean(value); }
function normalizeHeroSmsAcquirePriority(value = '') { return String(value || '').trim().toLowerCase() === 'price' ? 'price' : 'country'; }
function normalizeHeroSmsCountryId(value) { return Math.max(1, Math.floor(Number(value) || 52)); }
function normalizeHeroSmsCountryLabel(value = '') { return String(value || '').trim() || 'Thailand'; }
function normalizeHeroSmsCountryFallbackList(value = []) { return Array.isArray(value) ? value.map((entry) => ({ id: normalizeHeroSmsCountryId(entry?.id ?? entry), label: String(entry?.label || 'Thailand') })) : []; }
function normalizeFiveSimProductValue(value = '') { return String(value || '').trim().toLowerCase() || 'openai'; }
function normalizeNexSmsServiceCodeValue(value = '') { return String(value || '').trim().toLowerCase() || 'ot'; }
function normalizeNexSmsCountryIdValue(value, fallback = -1) { const normalized = Math.floor(Number(value)); return Number.isFinite(normalized) && normalized >= 0 ? normalized : fallback; }
function normalizeNexSmsCountryOrderValue(value = []) { return Array.isArray(value) ? value : []; }
function getSelectedFiveSimCountries() { return [{ id: DEFAULT_FIVE_SIM_COUNTRY_ID, code: DEFAULT_FIVE_SIM_COUNTRY_ID, label: DEFAULT_FIVE_SIM_COUNTRY_LABEL }]; }
function getSelectedNexSmsCountries() { return [{ id: DEFAULT_NEX_SMS_COUNTRY_ORDER[0], label: 'Country #1' }]; }
function getSelectedPhoneSmsProviderOrder() { return [getSelectedPhoneSmsProvider()]; }
function getSelectedPhonePreferredActivation() { return null; }
function normalizePhoneVerificationReplacementLimit(value, fallback = 3) { const parsed = Number.parseInt(String(value ?? '').trim(), 10); return Number.isFinite(parsed) ? parsed : fallback; }
function normalizePhoneCodeWaitSecondsValue(value, fallback = 60) { const parsed = Number.parseInt(String(value ?? '').trim(), 10); return Number.isFinite(parsed) ? parsed : fallback; }
function normalizePhoneCodeTimeoutWindowsValue(value, fallback = 2) { const parsed = Number.parseInt(String(value ?? '').trim(), 10); return Number.isFinite(parsed) ? parsed : fallback; }
function normalizePhoneCodePollIntervalSecondsValue(value, fallback = 5) { const parsed = Number.parseInt(String(value ?? '').trim(), 10); return Number.isFinite(parsed) ? parsed : fallback; }
function normalizePhoneCodePollMaxRoundsValue(value, fallback = 4) { const parsed = Number.parseInt(String(value ?? '').trim(), 10); return Number.isFinite(parsed) ? parsed : fallback; }
function getSelectedHeroSmsCountryOption() { return { id: 52, label: 'Thailand' }; }
function syncHeroSmsFallbackSelectionOrderFromSelect() { return [{ id: 52, label: 'Thailand' }]; }
${bundle}
return {
  collectSettingsPayload,
  setLatestState(nextState) { latestState = nextState; },
};
`)(normalizeIcloudTargetMailboxType, normalizeIcloudForwardMailProvider);

  const contributionPayload = api.collectSettingsPayload();
  assert.equal('panelMode' in contributionPayload, false);
  assert.equal('customPassword' in contributionPayload, false);
  assert.equal('accountRunHistoryTextEnabled' in contributionPayload, false);
  assert.equal('accountRunHistoryHelperBaseUrl' in contributionPayload, false);
  assert.equal(contributionPayload.phoneVerificationEnabled, true);
  assert.equal(contributionPayload.cloudflareTempEmailUseRandomSubdomain, true);

  api.setLatestState({ accountContributionEnabled: false });
  const normalPayload = api.collectSettingsPayload();
  assert.equal('panelMode' in normalPayload, false);
  assert.equal(normalPayload.targetId, 'cpa');
  assert.equal(normalPayload.customPassword, 'Secret123!');
  assert.equal(normalPayload.accountRunHistoryTextEnabled, true);
  assert.equal(normalPayload.accountRunHistoryHelperBaseUrl, 'http://127.0.0.1:17373');
  assert.equal(normalPayload.phoneVerificationEnabled, true);
  assert.equal(normalPayload.codex2apiUrl, 'http://localhost:8080/admin/accounts');
  assert.equal(normalPayload.codex2apiAdminKey, 'codex-admin-secret');
  assert.equal(normalPayload.cloudflareTempEmailUseRandomSubdomain, true);
});

test('contribution mode manager enters mode, starts main auto flow, polls contribution status, and exits cleanly', async () => {
  const source = fs.readFileSync('sidepanel/contribution-mode.js', 'utf8');
  const windowObject = {};
  const timers = [];

  const api = new Function('window', 'setTimeout', 'clearTimeout', `${source}; return window.SidepanelContributionMode;`)(
    windowObject,
    (handler) => {
      timers.push(handler);
      return timers.length;
    },
    (id) => {
      if (timers[id - 1]) {
        timers[id - 1] = null;
      }
    }
  );

  assert.equal(typeof api?.createContributionModeManager, 'function');

  let latestState = {
    accountContributionEnabled: false,
    panelMode: 'sub2api',
    contributionSource: 'sub2api',
    contributionTargetGroupName: 'codex号池',
    contributionSessionId: '',
    contributionStatus: '',
    contributionStatusMessage: '',
    contributionCallbackStatus: 'idle',
    contributionCallbackMessage: '',
    email: 'user@example.com',
  };
  let blocked = false;
  let appliedState = null;
  let statusState = null;
  let closeConfigMenuCount = 0;
  let closeAccountRecordsCount = 0;
  let contributionAutoRunStartCount = 0;
  let updatePanelModeCount = 0;
  let updateSyncUiCount = 0;
  let updateConfigMenuCount = 0;
  const toasts = [];
  const openedUrls = [];
  const sentMessages = [];

  const dom = {
    btnConfigMenu: createElement(),
    btnContributionMode: createElement(),
    btnExitContributionMode: createElement(),
    btnOpenAccountRecords: createElement(),
    btnOpenContributionUpload: createElement(),
    btnStartContribution: createElement(),
    accountContributionBadge: createElement(),
    inputContributionNickname: createElement({ value: '贡献者昵称' }),
    inputContributionQq: createElement({ value: '123456' }),
    contributionCallbackStatus: createElement(),
    accountContributionPanel: createElement({ hidden: true }),
    accountContributionSummary: createElement(),
    accountContributionText: createElement(),
    contributionOauthStatus: createElement(),
    rowAccountRunHistoryHelperBaseUrl: createElement(),
    rowAccountRunHistoryTextEnabled: createElement(),
    rowCustomPassword: createElement(),
    rowLocalCpaStep9Mode: createElement(),
    rowSub2ApiDefaultProxy: createElement(),
    rowSub2ApiEmail: createElement(),
    rowSub2ApiGroup: createElement(),
    rowSub2ApiPassword: createElement(),
    rowSub2ApiUrl: createElement(),
    rowCodex2ApiUrl: createElement(),
    rowCodex2ApiAdminKey: createElement(),
    rowVpsPassword: createElement(),
    rowVpsUrl: createElement(),
    selectPanelMode: createElement({ value: 'sub2api' }),
  };

  const manager = api.createContributionModeManager({
    state: {
      getLatestState: () => latestState,
    },
    dom,
    helpers: {
      applySettingsState(nextState) {
        latestState = nextState;
        appliedState = nextState;
      },
      closeAccountRecordsPanel() {
        closeAccountRecordsCount += 1;
      },
      closeConfigMenu() {
        closeConfigMenuCount += 1;
      },
      getContributionNickname() {
        return latestState.email;
      },
      getContributionProfile() {
        return {
          nickname: dom.inputContributionNickname.value,
          qq: dom.inputContributionQq.value,
        };
      },
      isModeSwitchBlocked() {
        return blocked;
      },
      openConfirmModal: async () => {
        throw new Error('should not ask for confirmation before entering contribution mode');
      },
      openExternalUrl(url) {
        openedUrls.push(url);
      },
      showToast(message, type) {
        toasts.push({ message, type });
      },
      async startContributionAutoRun() {
        contributionAutoRunStartCount += 1;
        latestState = {
          ...latestState,
          contributionSessionId: 'session-002',
          contributionAuthUrl: 'https://auth.example.com/oauth?state=oauth-state-002',
          contributionAuthState: 'oauth-state-002',
          contributionStatus: 'started',
          contributionStatusMessage: '\u5df2\u751f\u6210\u767b\u5f55\u5730\u5740',
          contributionCallbackStatus: 'waiting',
          contributionCallbackMessage: '\u7b49\u5f85\u56de\u8c03',
        };
        return true;
      },
      updateAccountRunHistorySettingsUI() {
        updateSyncUiCount += 1;
      },
      updateConfigMenuControls() {
        updateConfigMenuCount += 1;
      },
      updatePanelModeUI() {
        updatePanelModeCount += 1;
      },
      updateStatusDisplay(nextState) {
        statusState = nextState;
      },
    },
    runtime: {
      sendMessage: async (message) => {
        sentMessages.push(message);
        if (message.type === 'SET_ACCOUNT_CONTRIBUTION_MODE') {
          return {
            state: message.payload.enabled
              ? {
                accountContributionEnabled: true,
                panelMode: 'sub2api',
                contributionSource: 'sub2api',
                contributionTargetGroupName: 'codex号池',
                contributionNickname: '',
                contributionQq: '',
                contributionSessionId: '',
                contributionAuthUrl: '',
                contributionAuthState: '',
                contributionStatus: '',
                contributionStatusMessage: '',
                contributionCallbackStatus: 'idle',
                contributionCallbackMessage: '',
                email: latestState.email,
              }
              : {
                accountContributionEnabled: false,
                panelMode: 'cpa',
                contributionSource: 'cpa',
                contributionTargetGroupName: '',
                contributionNickname: '',
                contributionQq: '',
                contributionSessionId: '',
                contributionAuthUrl: '',
                contributionAuthState: '',
                contributionCallbackUrl: '',
                contributionStatus: '',
                contributionStatusMessage: '',
                contributionCallbackStatus: 'idle',
                contributionCallbackMessage: '',
                email: latestState.email,
              },
          };
        }
        if (message.type === 'POLL_FLOW_CONTRIBUTION_STATUS') {
          return {
            state: {
              ...latestState,
              contributionStatus: 'processing',
              contributionStatusMessage: '已提交回调，等待服务端确认',
              contributionCallbackStatus: 'submitted',
              contributionCallbackMessage: '已提交回调',
            },
          };
        }
        return {};
      },
    },
    constants: {
      contributionPortalUrl: 'https://flowpilot.qlhazycoder.top',
      contributionUploadUrl: 'https://flowpilot.qlhazycoder.top/upload',
      pollIntervalMs: 2500,
    },
  });

  manager.render();
  assert.equal(dom.accountContributionPanel.hidden, true);
  assert.equal(dom.btnContributionMode.disabled, false);
  assert.equal(dom.accountContributionBadge.textContent, '');

  manager.bindEvents();
  await dom.btnContributionMode.listeners.click();

  assert.equal(dom.accountContributionPanel.hidden, false);
  assert.equal(dom.selectPanelMode.value, 'sub2api');
  assert.equal(dom.selectPanelMode.disabled, true);
  assert.equal(dom.accountContributionBadge.textContent, 'SUB2API');
  assert.equal(dom.btnOpenAccountRecords.disabled, true);
  assert.equal(dom.contributionOauthStatus.textContent, '\u672a\u751f\u6210\u767b\u5f55\u5730\u5740');
  assert.equal(dom.contributionCallbackStatus.textContent, '\u7b49\u5f85\u56de\u8c03');
  assert.equal(dom.accountContributionSummary.textContent.length > 0, true);
  assert.equal(dom.btnContributionMode.classList.contains('is-active'), true);
  assert.equal(dom.rowVpsUrl.classList.contains('is-contribution-hidden'), true);
  assert.equal(dom.rowCodex2ApiUrl.classList.contains('is-contribution-hidden'), true);
  assert.equal(dom.rowCodex2ApiAdminKey.classList.contains('is-contribution-hidden'), true);
  assert.ok(closeConfigMenuCount >= 1);
  assert.ok(closeAccountRecordsCount >= 1);
  assert.ok(updatePanelModeCount >= 1);
  assert.ok(updateSyncUiCount >= 1);
  assert.ok(updateConfigMenuCount >= 1);
  assert.equal(timers.length, 0);
  assert.deepStrictEqual(openedUrls, ['https://flowpilot.qlhazycoder.top']);

  dom.inputContributionNickname.value = '贡献者昵称';
  dom.inputContributionQq.value = '123456';

  await dom.btnStartContribution.listeners.click();
  assert.equal(contributionAutoRunStartCount, 1);
  assert.equal(appliedState.contributionSessionId, '');
  assert.equal(latestState.contributionSessionId, 'session-002');
  assert.equal(latestState.contributionStatus, 'started');
  assert.equal(latestState.contributionNickname, '贡献者昵称');
  assert.equal(latestState.contributionQq, '123456');
  assert.equal(timers.length > 0, true);

  await manager.pollOnce({ reason: 'test_poll' });
  assert.equal(statusState.contributionStatus, 'processing');
  assert.equal(dom.contributionOauthStatus.textContent, '\u5df2\u63d0\u4ea4\u56de\u8c03');
  assert.equal(dom.contributionCallbackStatus.textContent, '\u5df2\u63d0\u4ea4\u56de\u8c03');
  assert.equal(dom.accountContributionSummary.textContent, '\u5df2\u63d0\u4ea4\u56de\u8c03\uff0c\u7b49\u5f85\u670d\u52a1\u7aef\u786e\u8ba4');

  dom.btnOpenContributionUpload.listeners.click();
  assert.deepStrictEqual(openedUrls, ['https://flowpilot.qlhazycoder.top', 'https://flowpilot.qlhazycoder.top/upload']);

  await dom.btnExitContributionMode.listeners.click();
  manager.render();
  assert.equal(dom.accountContributionPanel.hidden, true);
  assert.equal(dom.btnContributionMode.classList.contains('is-active'), false);
  assert.equal(dom.selectPanelMode.disabled, false);
  assert.equal(dom.rowVpsUrl.classList.contains('is-contribution-hidden'), false);
  assert.deepStrictEqual(
    sentMessages.map((message) => message.type),
    ['SET_ACCOUNT_CONTRIBUTION_MODE', 'POLL_FLOW_CONTRIBUTION_STATUS', 'SET_ACCOUNT_CONTRIBUTION_MODE']
  );
  assert.deepStrictEqual(
    toasts.map((item) => item.message),
    ['\u5df2\u8fdb\u5165\u8d21\u732e\u6a21\u5f0f\u3002', '\u8d21\u732e\u81ea\u52a8\u6d41\u7a0b\u5df2\u542f\u52a8\u3002', '\u5df2\u9000\u51fa\u8d21\u732e\u6a21\u5f0f\u3002']
  );

  blocked = true;
  latestState = {
    accountContributionEnabled: true,
    panelMode: 'sub2api',
    contributionSource: 'sub2api',
    contributionTargetGroupName: 'codex号池',
    contributionNickname: '贡献者昵称',
    contributionQq: '123456',
    contributionSessionId: 'session-002',
    contributionAuthUrl: 'https://auth.example.com/oauth?state=oauth-state-002',
    contributionStatus: 'waiting',
    contributionStatusMessage: '\u7b49\u5f85\u6388\u6743\u5b8c\u6210',
    contributionCallbackStatus: 'waiting',
    contributionCallbackMessage: '\u7b49\u5f85\u56de\u8c03',
  };
  manager.render();
  assert.equal(dom.selectPanelMode.value, 'sub2api');
  assert.equal(dom.accountContributionBadge.textContent, 'SUB2API');
  assert.equal(dom.btnExitContributionMode.disabled, true);
  manager.stopPolling();
});
