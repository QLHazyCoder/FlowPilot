const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const {
  normalizeIcloudForwardMailProvider,
  normalizeIcloudTargetMailboxType,
} = require('../mail-provider-utils');

const sidepanelSource = fs.readFileSync('sidepanel/sidepanel.js', 'utf8');
const sidepanelHtml = fs.readFileSync('sidepanel/sidepanel.html', 'utf8');

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

test('sidepanel html exposes phone verification toggle and multi-provider SMS rows', () => {
  const html = fs.readFileSync('sidepanel/sidepanel.html', 'utf8');

  assert.match(html, /id="row-phone-verification-enabled"/);
  assert.match(html, /id="btn-toggle-phone-verification-section"/);
  assert.match(html, /id="row-phone-verification-fold"/);
  assert.match(html, /id="input-phone-verification-enabled"/);
  assert.match(html, /id="row-signup-method"/);
  assert.match(html, /id="row-signup-phone"/);
  assert.match(html, /id="input-signup-phone"/);
  assert.ok(
    html.indexOf('id="row-signup-phone"') > html.indexOf('id="phone-verification-section"'),
    'signup phone runtime row should live inside the phone verification card'
  );
  assert.ok(
    html.indexOf('id="row-signup-phone"') > html.indexOf('id="row-hero-sms-runtime-pair"'),
    'signup phone runtime row should sit below the SMS order runtime row'
  );
  assert.ok(
    html.indexOf('id="row-signup-phone"') > html.indexOf('hero-sms-runtime-grid'),
    'signup phone runtime row should not be embedded in the SMS order runtime grid'
  );
  assert.match(html, /data-signup-method="email"/);
  assert.match(html, /data-signup-method="phone"/);
  assert.match(html, /id="row-phone-sms-provider"/);
  assert.match(html, /id="select-phone-sms-provider"/);
  assert.match(html, /id="row-phone-sms-provider-order"/);
  assert.match(html, /id="select-phone-sms-provider-order"[^>]*multiple/);
  assert.match(html, /id="btn-phone-sms-provider-order-menu"/);
  assert.match(html, /id="row-phone-sms-provider-order-actions"/);
  assert.match(html, /id="btn-phone-sms-provider-order-reset"/);
  assert.match(html, /id="row-hero-sms-platform"/);
  assert.match(html, /id="select-phone-sms-provider"/);
  assert.match(html, /\.\.\/phone-sms\/providers\/hero-sms\.js/);
  assert.match(html, /\.\.\/phone-sms\/providers\/five-sim\.js/);
  assert.match(html, /\.\.\/phone-sms\/providers\/registry\.js/);
  assert.match(html, /<option value="hero-sms">HeroSMS<\/option>/);
  assert.match(html, /<option value="5sim">5sim<\/option>/);
  assert.match(html, /id="row-hero-sms-country"/);
  assert.match(html, /id="row-hero-sms-country-fallback"/);
  assert.match(html, /id="row-hero-sms-acquire-priority"/);
  assert.match(html, /id="select-hero-sms-acquire-priority"/);
  assert.match(html, /id="select-hero-sms-country"[^>]*multiple/);
  assert.doesNotMatch(html, /id="select-hero-sms-country-fallback"/);
  assert.match(html, /id="row-hero-sms-api-key"/);
  assert.match(html, /id="row-hero-sms-max-price"/);
  assert.match(html, /id="input-hero-sms-min-price"/);
  assert.match(html, /id="btn-phone-sms-balance"/);
  assert.match(html, /id="display-phone-sms-balance"/);
  assert.match(html, /id="row-five-sim-operator"/);
  assert.match(html, /id="input-five-sim-operator"/);
  assert.match(html, /id="row-hero-sms-current-number"/);
  assert.match(html, /id="row-hero-sms-current-countdown"/);
  assert.match(html, /id="row-hero-sms-price-tiers"/);
  assert.match(html, /id="row-hero-sms-current-code"/);
  assert.match(html, /id="row-hero-sms-preferred-activation"/);
  assert.match(html, /id="select-hero-sms-preferred-activation"/);
  assert.match(html, /id="row-free-phone-reuse-enabled"/);
  assert.match(html, /id="input-free-phone-reuse-enabled"/);
  assert.match(html, /id="row-free-phone-reuse-auto-enabled"/);
  assert.match(html, /id="input-free-phone-reuse-auto-enabled"/);
  assert.match(html, /id="row-free-reusable-phone"/);
  assert.match(html, /id="display-free-reusable-phone"/);
  assert.match(html, /id="display-free-reusable-phone-country"/);
  assert.match(html, /id="input-free-reusable-phone"/);
  assert.match(html, /id="btn-save-free-reusable-phone"/);
  assert.match(html, /id="btn-clear-free-reusable-phone"/);
  assert.match(html, /白嫖复用/);
  assert.match(html, /自动白嫖复用/);
  assert.match(html, /id="row-phone-replacement-limit"/);
  assert.match(html, /id="row-phone-verification-resend-count"/);
  assert.match(html, /id="row-phone-code-wait-seconds"/);
  assert.match(html, /id="row-phone-code-timeout-windows"/);
  assert.match(html, /id="row-phone-code-poll-interval-seconds"/);
  assert.match(html, /id="row-phone-code-poll-max-rounds"/);
  assert.match(html, /id="row-five-sim-api-key"/);
  assert.match(html, /id="input-five-sim-api-key"/);
  assert.match(html, /id="row-five-sim-country"/);
  assert.match(html, /id="select-five-sim-country"[^>]*multiple/);
  assert.match(html, /id="row-five-sim-country-fallback"/);
  assert.match(html, /id="row-five-sim-operator"/);
  assert.match(html, /id="input-five-sim-operator"/);
  assert.match(html, /id="row-five-sim-product"/);
  assert.match(html, /id="input-five-sim-product"/);
  assert.match(html, /<option value="nexsms">/);
  assert.match(html, /id="row-nex-sms-api-key"/);
  assert.match(html, /id="input-nex-sms-api-key"/);
  assert.match(html, /id="row-nex-sms-country"/);
  assert.match(html, /id="select-nex-sms-country"[^>]*multiple/);
  assert.match(html, /id="row-nex-sms-country-fallback"/);
  assert.match(html, /id="row-nex-sms-service-code"/);
  assert.match(html, /id="input-nex-sms-service-code"/);
  assert.doesNotMatch(html, /id="input-account-run-history-text-enabled"/);
});

test('sidepanel loads live SMS country lists silently during startup', () => {
  const heroLoader = extractFunction('loadHeroSmsCountries');
  const fiveSimLoader = extractFunction('loadFiveSimCountries');

  assert.match(heroLoader, /async function loadHeroSmsCountries\(options = \{\}\)/);
  assert.match(fiveSimLoader, /async function loadFiveSimCountries\(options = \{\}\)/);
  assert.match(heroLoader, /const preferFallbackOnly = Boolean\(options\?\.preferFallbackOnly\)/);
  assert.match(fiveSimLoader, /const preferFallbackOnly = Boolean\(options\?\.preferFallbackOnly\)/);
  assert.doesNotMatch(heroLoader, /console\.(?:warn|error)\('加载 (?:5sim|HeroSMS) 国家列表失败：'/);
  assert.doesNotMatch(fiveSimLoader, /console\.(?:warn|error)\('加载 5sim 国家列表失败：'/);
  assert.match(sidepanelSource, /loadHeroSmsCountries\(\{ silent: true \}\)/);
  assert.match(sidepanelSource, /loadFiveSimCountries\(\{ silent: true \}\)/);
  assert.match(sidepanelSource, /await loadHeroSmsCountries\(\{ silent: true \}\);/);
  assert.doesNotMatch(sidepanelSource, /loadHeroSmsCountries\(\{ silent: true, preferFallbackOnly: true \}\)/);
  assert.doesNotMatch(sidepanelSource, /loadFiveSimCountries\(\{ silent: true, preferFallbackOnly: true \}\)/);
  assert.doesNotMatch(sidepanelSource, /console\.error\('加载 (?:HeroSMS|5sim|NexSMS) 国家列表失败：'/);
});

test('HeroSMS country parser accepts keyed country maps from the live API', () => {
  const api = new Function(`
${extractFunction('normalizeHeroSmsCountryPayloadEntries')}
${extractFunction('parseHeroSmsCountryPayload')}
return { parseHeroSmsCountryPayload };
`)();

  const keyedPayload = {
    52: { id: 52, eng: 'Thailand', chn: '泰国' },
    6: { id: 6, eng: 'Indonesia', chn: '印度尼西亚' },
  };
  const ids = (payload) => api.parseHeroSmsCountryPayload(payload)
    .map((entry) => entry.id)
    .sort((left, right) => left - right);

  assert.deepStrictEqual(
    ids(keyedPayload),
    [6, 52]
  );
  assert.deepStrictEqual(
    ids({ value: keyedPayload }),
    [6, 52]
  );
  assert.deepStrictEqual(
    ids({ value: Object.values(keyedPayload) }),
    [6, 52]
  );
});

test('sidepanel source wires free reusable phone save and clear actions to runtime messages', () => {
  assert.match(sidepanelSource, /const inputFreePhoneReuseEnabled = document\.getElementById\('input-free-phone-reuse-enabled'\);/);
  assert.match(sidepanelSource, /const inputFreePhoneReuseAutoEnabled = document\.getElementById\('input-free-phone-reuse-auto-enabled'\);/);
  assert.match(sidepanelSource, /const displayFreeReusablePhone = document\.getElementById\('display-free-reusable-phone'\);/);
  assert.match(sidepanelSource, /const inputFreeReusablePhone = document\.getElementById\('input-free-reusable-phone'\);/);
  assert.match(sidepanelSource, /const btnSaveFreeReusablePhone = document\.getElementById\('btn-save-free-reusable-phone'\);/);
  assert.match(sidepanelSource, /const btnClearFreeReusablePhone = document\.getElementById\('btn-clear-free-reusable-phone'\);/);
  assert.match(sidepanelSource, /type:\s*'SET_FREE_REUSABLE_PHONE'/);
  assert.match(sidepanelSource, /payload:\s*\{\s*phoneNumber\s*\}/s);
  assert.match(sidepanelSource, /type:\s*'CLEAR_FREE_REUSABLE_PHONE'/);
});

test('sidepanel keeps free reuse switches realtime and locks them during auto run', () => {
  assert.match(
    sidepanelSource,
    /message\.payload\.freePhoneReuseEnabled !== undefined[\s\S]*updatePhoneVerificationSettingsUI\(\);/
  );
  assert.match(
    sidepanelSource,
    /message\.payload\.freePhoneReuseAutoEnabled !== undefined[\s\S]*updatePhoneVerificationSettingsUI\(\);/
  );
  assert.match(sidepanelSource, /setFreePhoneReuseControlsLocked\(settingsCardLocked\);/);
  assert.match(
    sidepanelSource,
    /inputFreePhoneReuseEnabled\.disabled = locked;[\s\S]*inputFreePhoneReuseAutoEnabled\.disabled = locked/
  );
});

test('sidepanel free reusable phone paths avoid stale identifiers and empty-save errors', () => {
  assert.doesNotMatch(
    sidepanelSource,
    /applyHeroSmsFallbackSelection\(\s*\[\.\.\.nextPrimaryCountries,\s*\.\.\.nextFallback\]/
  );
  assert.match(
    sidepanelSource,
    /applyHeroSmsFallbackSelection\(\s*\[\s*nextPrimary,\s*\.\.\.nextFallback\]/
  );
  assert.match(
    sidepanelSource,
    /if \(!phoneNumber\) \{[\s\S]*请先填写白嫖复用手机号[\s\S]*return;[\s\S]*chrome\.runtime\.sendMessage\(\{\s*type:\s*'SET_FREE_REUSABLE_PHONE'/
  );
});

test('sidepanel source wires runtime signup phone field to background sync messages', () => {
  assert.match(sidepanelSource, /function getRuntimeSignupPhoneValue\(state = latestState\)/);
  assert.match(sidepanelSource, /function shouldExecuteStep3WithSignupPhoneIdentity\(state = latestState\)/);
  assert.match(sidepanelSource, /function shouldPreserveSignupPhoneInputValue\(stateSignupPhone = ''\)/);
  assert.match(sidepanelSource, /function syncSignupPhoneInputFromState\(state = latestState\)/);
  assert.match(sidepanelSource, /async function persistSignupPhoneInputForAction\(\)/);
  assert.match(sidepanelSource, /type:\s*'SET_SIGNUP_PHONE_STATE'/);
  assert.match(sidepanelSource, /final \? 'SAVE_SIGNUP_PHONE' : 'SET_SIGNUP_PHONE_STATE'/);
  assert.match(sidepanelSource, /message\.payload\.signupPhoneNumber !== undefined/);
  assert.match(sidepanelSource, /await persistSignupPhoneInputForAction\(\);\s*await saveSettings/);
  assert.match(sidepanelSource, /if \(shouldExecuteStep3WithSignupPhoneIdentity\(latestState\)\)[\s\S]*type:\s*'EXECUTE_NODE'[\s\S]*payload: \{ nodeId \}/);
  assert.match(sidepanelSource, /async function handleSkipStep\(step\)[\s\S]*await persistCurrentSettingsForAction\(\);/);
  assert.match(sidepanelSource, /inputSignupPhone\.addEventListener\('input'[\s\S]*signupPhoneInputDirty = true/);
});

test('sidepanel warns once before using phone signup with CPA source', async () => {
  assert.match(
    sidepanelSource,
    /signupMethodButtons\.forEach\(\(button\) => \{[\s\S]*await confirmCpaPhoneSignupIfNeeded\(\{[\s\S]*signupMethod: nextSignupMethod,[\s\S]*targetId: getSelectedPanelMode\(latestState\),/
  );
  assert.match(
    sidepanelSource,
    /selectPanelMode\.addEventListener\('change', async \(\) => \{[\s\S]*await confirmCpaPhoneSignupIfNeeded\(\{[\s\S]*signupMethod: getSelectedSignupMethod\(\),[\s\S]*targetId: nextPanelMode,/
  );

  const bundle = [
    extractFunction('normalizeSignupMethod'),
    extractFunction('normalizePanelMode'),
    extractFunction('isPromptDismissed'),
    extractFunction('setPromptDismissed'),
    extractFunction('isCpaPhoneSignupPromptDismissed'),
    extractFunction('setCpaPhoneSignupPromptDismissed'),
    extractFunction('shouldWarnCpaPhoneSignup'),
    extractFunction('openCpaPhoneSignupWarningModal'),
    extractFunction('confirmCpaPhoneSignupIfNeeded'),
  ].join('\n');

  const api = new Function(`
const SIGNUP_METHOD_PHONE = 'phone';
const SIGNUP_METHOD_EMAIL = 'email';
const DEFAULT_SIGNUP_METHOD = SIGNUP_METHOD_EMAIL;
const DEFAULT_ACTIVE_FLOW_ID = 'openai';
const CPA_PHONE_SIGNUP_PROMPT_DISMISSED_STORAGE_KEY = 'multipage-cpa-phone-signup-prompt-dismissed';
const CPA_PHONE_SIGNUP_WARNING_MESSAGE = '请确保打开手机接码设置中的“绑定后重登”开关，不然可能无法使用（有些版本无需开启）';
const storage = new Map();
const localStorage = {
  getItem(key) {
    return storage.has(key) ? storage.get(key) : null;
  },
  setItem(key, value) {
    storage.set(key, String(value));
  },
  removeItem(key) {
    storage.delete(key);
  },
};
let latestState = {
  activeFlowId: 'openai',
  flowId: 'openai',
  targetId: 'cpa',
};
let selectedSignupMethod = 'phone';
let selectedPanelMode = 'cpa';
let capturedOptions = null;
let modalResult = { confirmed: true, optionChecked: false };
function getSelectedSignupMethod() {
  return selectedSignupMethod;
}
function getSelectedPanelMode() {
  return selectedPanelMode;
}
function getSelectedTargetId() {
  return selectedPanelMode;
}
function getSelectedTargetIdForState() {
  return selectedPanelMode;
}
async function openConfirmModalWithOption(options) {
  capturedOptions = options;
  return modalResult;
}
${bundle}
return {
  shouldWarnCpaPhoneSignup,
  confirmCpaPhoneSignupIfNeeded,
  getCapturedOptions() {
    return capturedOptions;
  },
  getDismissed() {
    return localStorage.getItem(CPA_PHONE_SIGNUP_PROMPT_DISMISSED_STORAGE_KEY);
  },
  setModalResult(result) {
    modalResult = result;
  },
};
`)();

  assert.equal(api.shouldWarnCpaPhoneSignup('phone', 'cpa'), true);
  assert.equal(api.shouldWarnCpaPhoneSignup('email', 'cpa'), false);
  assert.equal(api.shouldWarnCpaPhoneSignup('phone', 'sub2api'), false);
  assert.equal(api.shouldWarnCpaPhoneSignup('phone', 'codex2api'), false);

  const firstResult = await api.confirmCpaPhoneSignupIfNeeded({ signupMethod: 'phone', targetId: 'cpa' });
  assert.equal(firstResult, true);
  assert.equal(api.getCapturedOptions().title, 'CPA 手机号注册提醒');
  assert.equal(api.getCapturedOptions().message, '请确保打开手机接码设置中的“绑定后重登”开关，不然可能无法使用（有些版本无需开启）');
  assert.equal(api.getCapturedOptions().confirmLabel, '继续');
  assert.equal(api.getCapturedOptions().optionLabel, '不再提醒');
  assert.equal(api.getDismissed(), null);

  api.setModalResult({ confirmed: false, optionChecked: true });
  const secondResult = await api.confirmCpaPhoneSignupIfNeeded({ signupMethod: 'phone', targetId: 'cpa' });
  assert.equal(secondResult, false);
  assert.equal(api.getDismissed(), '1');
  assert.equal(api.shouldWarnCpaPhoneSignup('phone', 'cpa'), false);
});

test('sidepanel phone signup gating can follow the shared flow capability registry', () => {
  const bundle = [
    extractFunction('normalizeSignupMethod'),
    extractFunction('normalizePanelMode'),
    extractFunction('canSelectPhoneSignupMethod'),
    extractFunction('shouldWarnCpaPhoneSignup'),
  ].join('\n');

  const api = new Function(`
const window = {
  MultiPageFlowCapabilities: {
    createFlowCapabilityRegistry() {
      return {
        resolveSidepanelCapabilities({ state = {}, targetId = 'cpa', signupMethod = 'email' } = {}) {
          const phoneAllowed = String(state?.activeFlowId || '').trim().toLowerCase() === 'openai';
          return {
            canSelectPhoneSignup: phoneAllowed,
            shouldWarnCpaPhoneSignup: phoneAllowed && signupMethod === 'phone' && targetId === 'cpa',
          };
        },
      };
    },
  },
};
let latestState = {
  activeFlowId: 'site-a',
  accountContributionEnabled: false,
  targetId: 'cpa',
};
const inputPhoneVerificationEnabled = { checked: true };
const inputPlusModeEnabled = { checked: false };
function getSelectedFlowId() { return latestState.activeFlowId; }
function getSelectedPanelMode() { return 'cpa'; }
function getSelectedTargetId() { return 'cpa'; }
function getSelectedTargetIdForState() { return 'cpa'; }
function getSelectedSignupMethod() { return 'phone'; }
function isCpaPhoneSignupPromptDismissed() { return false; }
${bundle}
return {
  canSelectPhoneSignupMethod,
  shouldWarnCpaPhoneSignup,
  setFlow(flowId) {
    latestState.activeFlowId = flowId;
  },
};
`)();

  assert.equal(api.canSelectPhoneSignupMethod(), false);
  assert.equal(api.shouldWarnCpaPhoneSignup('phone', 'cpa'), false);

  api.setFlow('openai');
  assert.equal(api.canSelectPhoneSignupMethod(), true);
  assert.equal(api.shouldWarnCpaPhoneSignup('phone', 'cpa'), true);
});

test('phone signup relogin-after-bind-email switch is wired into UI and step definitions', () => {
  assert.match(sidepanelHtml, /row-phone-signup-relogin-after-bind-email/);
  assert.match(sidepanelHtml, /input-phone-signup-relogin-after-bind-email/);
  assert.match(sidepanelSource, /phoneSignupReloginAfterBindEmailEnabled: typeof inputPhoneSignupReloginAfterBindEmail !== 'undefined'/);
  assert.match(sidepanelSource, /phoneSignupReloginAfterBindEmailEnabled: Boolean\(state\?\.phoneSignupReloginAfterBindEmailEnabled\)/);
  assert.match(sidepanelSource, /nextPhoneSignupReloginAfterBindEmailEnabled !== currentPhoneSignupReloginAfterBindEmailEnabled/);
});

test('manual step 3 uses phone identity without requiring registration email', () => {
  const api = new Function(`
let latestState = { signupMethod: 'phone', phoneVerificationEnabled: true, signupPhoneNumber: '+441111111111', accountIdentifierType: 'phone', accountIdentifier: '+441111111111' };
const DEFAULT_SIGNUP_METHOD = 'email';
const SIGNUP_METHOD_PHONE = 'phone';
function getSelectedSignupMethod() { return 'phone'; }
${extractFunction('normalizeSignupMethod')}
${extractFunction('getRuntimeSignupPhoneValue')}
${extractFunction('shouldExecuteStep3WithSignupPhoneIdentity')}
return { shouldExecuteStep3WithSignupPhoneIdentity };
`)();

  assert.equal(api.shouldExecuteStep3WithSignupPhoneIdentity({
    signupMethod: 'phone',
    phoneVerificationEnabled: true,
    accountIdentifierType: 'phone',
    accountIdentifier: '+441111111111',
    signupPhoneNumber: '+441111111111',
    email: '',
  }), true);
  assert.equal(api.shouldExecuteStep3WithSignupPhoneIdentity({
    signupMethod: 'email',
    accountIdentifierType: 'email',
    accountIdentifier: 'user@example.com',
    signupPhoneNumber: '',
    email: 'user@example.com',
  }), false);
});

test('runtime signup phone sync preserves active manual input until it is saved', () => {
  const api = new Function(`
let latestState = { signupMethod: 'phone', phoneVerificationEnabled: true, signupPhoneNumber: '+441111111111' };
let signupPhoneInputDirty = true;
let signupPhoneInputFocused = true;
const inputSignupPhone = { value: '+442222222222' };
const rowSignupPhone = { style: { display: 'none' } };
const inputPhoneVerificationEnabled = { checked: true };
const document = { activeElement: inputSignupPhone };
function getSelectedSignupMethod() { return 'phone'; }
${extractFunction('normalizeSignupMethod')}
${extractFunction('getRuntimeSignupPhoneValue')}
${extractFunction('getSignupPhoneInputValue')}
${extractFunction('shouldPreserveSignupPhoneInputValue')}
${extractFunction('syncSignupPhoneInputFromState')}
return {
  inputSignupPhone,
  rowSignupPhone,
  syncSignupPhoneInputFromState,
  getDirty: () => signupPhoneInputDirty,
  setFocused: (value) => { signupPhoneInputFocused = Boolean(value); document.activeElement = value ? inputSignupPhone : null; },
};
`)();

  api.syncSignupPhoneInputFromState({
    signupMethod: 'phone',
    phoneVerificationEnabled: true,
    signupPhoneNumber: '+441111111111',
  });
  assert.equal(api.inputSignupPhone.value, '+442222222222');
  assert.equal(api.rowSignupPhone.style.display, '');
  assert.equal(api.getDirty(), true);

  api.setFocused(false);
  api.syncSignupPhoneInputFromState({
    signupMethod: 'phone',
    phoneVerificationEnabled: true,
    signupPhoneNumber: '+441111111111',
  });
  assert.equal(api.inputSignupPhone.value, '+441111111111');
});

test('hero sms country helpers keep empty summary state and expose removable order handling', () => {
  assert.match(
    sidepanelSource,
    /function removeHeroSmsCountryFromOrder\(id\)/
  );
  assert.match(
    sidepanelSource,
    /displayHeroSmsCountryFallbackOrder\.textContent = '';/
  );

  const api = new Function(`
const HERO_SMS_COUNTRY_SELECTION_MAX = 3;
const btnHeroSmsCountryMenu = { textContent: '' };
function isFiveSimProviderSelected() { return false; }
function normalizeFiveSimCountryFallbackList(value = []) { return Array.isArray(value) ? value : []; }
function normalizeHeroSmsCountryFallbackList(value = []) { return Array.isArray(value) ? value : []; }
${extractFunction('updateHeroSmsCountryMenuSummary')}
return { btnHeroSmsCountryMenu, updateHeroSmsCountryMenuSummary };
`)();

  api.updateHeroSmsCountryMenuSummary([]);
  assert.equal(api.btnHeroSmsCountryMenu.textContent, '\u672a\u9009\u62e9 (0/3)');
});

test('live phone country sources are not hard-filtered down to the reduced country whitelist', () => {
  assert.doesNotMatch(
    sidepanelSource,
    /\.filter\(\(entry\) => entry\.id && FIVE_SIM_SUPPORTED_COUNTRY_ID_SET\.has\(String\(entry\.id\)\)\)/
  );
  assert.doesNotMatch(
    sidepanelSource,
    /\.filter\(\(item\) => HERO_SMS_SUPPORTED_COUNTRY_ID_SET\.has\(String\(Math\.floor\(Number\(item\?\.id\)\)\)\)/
  );
  assert.doesNotMatch(
    sidepanelSource,
    /\.filter\(\(entry\) => FIVE_SIM_SUPPORTED_COUNTRY_ID_SET\.has\(entry\.code \|\| entry\.id\)\)/
  );
});

test('removeHeroSmsCountryFromOrder clears the selected country and triggers a silent save', async () => {
  const api = new Function(`
let heroSmsCountrySelectionOrder = [52, 6];
const selectHeroSmsCountry = {
  options: [
    { value: '52', selected: true },
    { value: '6', selected: true },
  ],
};
const selectHeroSmsCountryFallback = {
  options: [
    { value: '52', selected: true },
    { value: '6', selected: true },
  ],
};
let dirtyValue = null;
let saveCount = 0;
let platformRefreshCount = 0;
function getSelectedPhoneSmsProvider() { return 'hero-sms'; }
function normalizePhoneSmsCountryId(value) {
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : 0;
}
function syncHeroSmsFallbackSelectionOrderFromSelect() {
  heroSmsCountrySelectionOrder = Array.from(selectHeroSmsCountry.options || [])
    .filter((option) => option.selected)
    .map((option) => Number(option.value));
  return heroSmsCountrySelectionOrder.map((id) => ({ id, label: 'Country #' + id }));
}
function updateHeroSmsPlatformDisplay() { platformRefreshCount += 1; }
function markSettingsDirty(value) { dirtyValue = value; }
function saveSettings() { saveCount += 1; return Promise.resolve(); }
${extractFunction('removeHeroSmsCountryFromOrder')}
return {
  removeHeroSmsCountryFromOrder,
  selectHeroSmsCountry,
  selectHeroSmsCountryFallback,
  getHeroSmsCountrySelectionOrder: () => [...heroSmsCountrySelectionOrder],
  getDirtyValue: () => dirtyValue,
  getSaveCount: () => saveCount,
  getPlatformRefreshCount: () => platformRefreshCount,
};
`)();

  const nextOrder = api.removeHeroSmsCountryFromOrder(52);
  await Promise.resolve();

  assert.deepStrictEqual(nextOrder, [{ id: 6, label: 'Country #6' }]);
  assert.deepStrictEqual(api.getHeroSmsCountrySelectionOrder(), [6]);
  assert.equal(api.selectHeroSmsCountry.options[0].selected, false);
  assert.equal(api.selectHeroSmsCountry.options[1].selected, true);
  assert.equal(api.selectHeroSmsCountryFallback.options[0].selected, false);
  assert.equal(api.selectHeroSmsCountryFallback.options[1].selected, true);
  assert.equal(api.getDirtyValue(), true);
  assert.equal(api.getSaveCount(), 1);
  assert.equal(api.getPlatformRefreshCount(), 1);
});

test('updatePhoneVerificationSettingsUI toggles SMS rows from the sms switch and provider selection', () => {
  const api = new Function(`
let phoneVerificationSectionExpanded = false;
let latestState = {};
let phoneSignupReuseUiWasLocked = false;
const PHONE_SIGNUP_REUSE_LOCK_TITLE = '手机号注册流程不使用号码复用，切回邮箱注册后会恢复原设置';
const SIGNUP_METHOD_EMAIL = 'email';
const SIGNUP_METHOD_PHONE = 'phone';
const DEFAULT_SIGNUP_METHOD = SIGNUP_METHOD_EMAIL;
const DEFAULT_HERO_SMS_REUSE_ENABLED = true;
function createMockClassList() {
  const values = new Set();
  return {
    toggle(name, force) {
      const enabled = force === undefined ? !values.has(name) : Boolean(force);
      if (enabled) values.add(name);
      else values.delete(name);
    },
    contains(name) {
      return values.has(name);
    },
  };
}
function createMockRow() {
  return { style: { display: 'none' }, classList: createMockClassList(), title: '' };
}
const inputPhoneVerificationEnabled = { checked: false };
const rowPhoneVerificationEnabled = { style: { display: 'none' } };
const rowPhoneVerificationFold = { style: { display: 'none' } };
const rowSignupMethod = { style: { display: 'none' } };
const rowSignupPhone = { style: { display: 'none' } };
const rowPhoneSmsProvider = { style: { display: 'none' } };
const rowPhoneSmsProviderOrder = { style: { display: 'none' } };
const rowPhoneSmsProviderOrderActions = { style: { display: 'none' } };
const selectPhoneSmsProvider = { value: 'hero-sms' };
const btnTogglePhoneVerificationSection = {
  disabled: false,
  textContent: '',
  title: '',
  setAttribute: () => {},
};
  const DEFAULT_PHONE_SMS_PROVIDER_ORDER = ['hero-sms', '5sim', 'nexsms'];
  const phoneSmsProviderOrderSelection = [];
  function normalizePhoneSmsProviderOrderValue(value = [], fallbackOrder = DEFAULT_PHONE_SMS_PROVIDER_ORDER) {
    const source = Array.isArray(value) ? value : [];
    const normalized = [...source];
    if (normalized.length) {
      return normalized.slice(0, 3);
    }
    if (!Array.isArray(fallbackOrder) || !fallbackOrder.length) {
      return [];
    }
    const fallbackNormalized = [];
    for (const provider of fallbackOrder) {
      if (!fallbackNormalized.includes(provider)) {
        fallbackNormalized.push(provider);
      }
    }
    return fallbackNormalized.slice(0, 3);
  }
  function resolveNormalizedProviderOrderForRuntime(state = {}) {
    const rawOrder = Array.isArray(state?.phoneSmsProviderOrder) ? state.phoneSmsProviderOrder : [];
    const normalizedOrder = normalizePhoneSmsProviderOrderValue(rawOrder, []);
    if (normalizedOrder.length) {
      return normalizedOrder;
    }
    const fallbackProvider = String(state?.phoneSmsProvider || selectPhoneSmsProvider?.value || 'hero-sms').trim().toLowerCase() || 'hero-sms';
    return [fallbackProvider];
  }
function updatePhoneSmsProviderOrderSummary() {}
const rowHeroSmsPlatform = { style: { display: 'none' } };
const rowHeroSmsCountry = { style: { display: 'none' } };
const rowHeroSmsCountryFallback = { style: { display: 'none' } };
const rowHeroSmsAcquirePriority = { style: { display: 'none' } };
const rowHeroSmsApiKey = { style: { display: 'none' } };
const rowHeroSmsMaxPrice = { style: { display: 'none' } };
const rowFiveSimApiKey = { style: { display: 'none' } };
const rowFiveSimCountry = { style: { display: 'none' } };
const rowFiveSimCountryFallback = { style: { display: 'none' } };
const rowFiveSimOperator = { style: { display: 'none' } };
const rowFiveSimProduct = { style: { display: 'none' } };
const rowNexSmsApiKey = { style: { display: 'none' } };
const rowNexSmsCountry = { style: { display: 'none' } };
const rowNexSmsCountryFallback = { style: { display: 'none' } };
const rowNexSmsServiceCode = { style: { display: 'none' } };
const rowHeroSmsRuntimePair = { style: { display: 'none' } };
const rowHeroSmsCurrentNumber = { style: { display: 'none' } };
const rowHeroSmsCurrentCountdown = { style: { display: 'none' } };
const rowHeroSmsPriceTiers = { style: { display: 'none' } };
const rowHeroSmsCurrentCode = { style: { display: 'none' } };
const rowHeroSmsPreferredActivation = createMockRow();
const rowPhoneVerificationResendCount = { style: { display: 'none' } };
const rowPhoneReplacementLimit = { style: { display: 'none' } };
const rowPhoneCodeWaitSeconds = { style: { display: 'none' } };
const rowPhoneCodeTimeoutWindows = { style: { display: 'none' } };
const rowPhoneCodePollIntervalSeconds = { style: { display: 'none' } };
const rowPhoneCodePollMaxRounds = { style: { display: 'none' } };
const rowFreePhoneReuseEnabled = createMockRow();
const rowFreePhoneReuseAutoEnabled = createMockRow();
const rowFreeReusablePhone = createMockRow();
const heroSmsReuseRow = createMockRow();
const inputHeroSmsReuseEnabled = { checked: true, disabled: false, closest: () => heroSmsReuseRow };
const inputFreePhoneReuseEnabled = { checked: true, disabled: false };
const inputFreePhoneReuseAutoEnabled = { checked: true, disabled: false };
const selectHeroSmsPreferredActivation = { disabled: false };
const inputFreeReusablePhone = { disabled: false };
const btnSaveFreeReusablePhone = { disabled: false };
const btnClearFreeReusablePhone = { disabled: false };
const PHONE_SMS_PROVIDER_HERO_SMS = 'hero-sms';
const PHONE_SMS_PROVIDER_FIVE_SIM = '5sim';
const PHONE_SMS_PROVIDER_NEXSMS = 'nexsms';
function getSelectedPhoneSmsProvider() { return selectPhoneSmsProvider.value; }
function isFiveSimProviderSelected() { return getSelectedPhoneSmsProvider() === PHONE_SMS_PROVIDER_FIVE_SIM; }
function updateHeroSmsPlatformDisplay() {}
function updateSignupMethodUI() {
  rowSignupMethod.style.display = inputPhoneVerificationEnabled.checked ? '' : 'none';
}
function syncSignupPhoneInputFromState() {
  rowSignupPhone.style.display = inputPhoneVerificationEnabled.checked && latestState.signupPhoneNumber ? '' : 'none';
}
function setFreePhoneReuseControlsLocked(locked) {
  inputFreePhoneReuseEnabled.disabled = Boolean(locked);
  inputFreePhoneReuseAutoEnabled.disabled = Boolean(locked)
    || !Boolean(inputFreePhoneReuseEnabled.checked)
    || !Boolean(inputPhoneVerificationEnabled.checked && phoneVerificationSectionExpanded);
}
function isAutoRunLockedPhase() { return false; }

${extractFunction('normalizeSignupMethod')}
${extractFunction('normalizeHeroSmsReuseEnabledValue')}
${extractFunction('isPhoneSignupReuseLocked')}
${extractFunction('getStoredPhoneSmsReuseEnabled')}
${extractFunction('getStoredFreePhoneReuseEnabled')}
${extractFunction('getStoredFreePhoneReuseAutoEnabled')}
${extractFunction('restorePhoneReuseControlsFromState')}
${extractFunction('setElementReuseLockedState')}
${extractFunction('updatePhoneVerificationSettingsUI')}

return {
  setExpanded(value) { phoneVerificationSectionExpanded = Boolean(value); },
  setLatestState: (state) => { latestState = state || {}; },
  rowPhoneVerificationEnabled,
  rowPhoneVerificationFold,
  rowSignupMethod,
  rowSignupPhone,
  rowPhoneSmsProvider,
  rowPhoneSmsProviderOrder,
  rowPhoneSmsProviderOrderActions,
  selectPhoneSmsProvider,
  btnTogglePhoneVerificationSection,
  inputPhoneVerificationEnabled,
  rowHeroSmsPlatform,
  rowHeroSmsCountry,
  rowHeroSmsCountryFallback,
  rowHeroSmsAcquirePriority,
  rowHeroSmsApiKey,
  rowHeroSmsMaxPrice,
  rowFiveSimApiKey,
  rowFiveSimCountry,
  rowFiveSimCountryFallback,
  rowFiveSimOperator,
  rowFiveSimProduct,
  rowNexSmsApiKey,
  rowNexSmsCountry,
  rowNexSmsCountryFallback,
  rowNexSmsServiceCode,
  rowHeroSmsRuntimePair,
  rowHeroSmsCurrentNumber,
  rowHeroSmsCurrentCountdown,
  rowHeroSmsPriceTiers,
  rowHeroSmsCurrentCode,
  rowHeroSmsPreferredActivation,
  rowFreePhoneReuseEnabled,
  rowFreePhoneReuseAutoEnabled,
  rowFreeReusablePhone,
  rowPhoneVerificationResendCount,
  rowPhoneReplacementLimit,
  rowPhoneCodeWaitSeconds,
  rowPhoneCodeTimeoutWindows,
  rowPhoneCodePollIntervalSeconds,
  rowPhoneCodePollMaxRounds,
  heroSmsReuseRow,
  inputHeroSmsReuseEnabled,
  inputFreePhoneReuseEnabled,
  inputFreePhoneReuseAutoEnabled,
  selectHeroSmsPreferredActivation,
  inputFreeReusablePhone,
  btnSaveFreeReusablePhone,
  btnClearFreeReusablePhone,
  setSelectedPhoneSmsProvider(value) { selectPhoneSmsProvider.value = value; },
  updatePhoneVerificationSettingsUI,
};
`)();

  api.updatePhoneVerificationSettingsUI();
  assert.equal(api.rowPhoneVerificationEnabled.style.display, '');
  assert.equal(api.rowPhoneVerificationFold.style.display, 'none');
  assert.equal(api.rowSignupMethod.style.display, 'none');
  assert.equal(api.rowSignupPhone.style.display, 'none');
  assert.equal(api.rowPhoneSmsProvider.style.display, 'none');
  assert.equal(api.rowPhoneSmsProviderOrder.style.display, 'none');
  assert.equal(api.rowPhoneSmsProviderOrderActions.style.display, 'none');
  assert.equal(api.btnTogglePhoneVerificationSection.disabled, true);
  assert.equal(api.btnTogglePhoneVerificationSection.textContent, '展开设置');
  assert.equal(api.rowHeroSmsPlatform.style.display, '');
  assert.equal(api.rowHeroSmsRuntimePair.style.display, 'none');
  assert.equal(api.rowHeroSmsCountry.style.display, 'none');
  assert.equal(api.rowHeroSmsCountryFallback.style.display, 'none');
  assert.equal(api.rowHeroSmsAcquirePriority.style.display, 'none');
  assert.equal(api.rowHeroSmsApiKey.style.display, 'none');
  assert.equal(api.rowHeroSmsMaxPrice.style.display, 'none');
  assert.equal(api.rowFiveSimOperator.style.display, 'none');
  assert.equal(api.rowHeroSmsCurrentNumber.style.display, 'none');
  assert.equal(api.rowHeroSmsCurrentCountdown.style.display, 'none');
  assert.equal(api.rowHeroSmsPriceTiers.style.display, 'none');
  assert.equal(api.rowHeroSmsCurrentCode.style.display, 'none');
  assert.equal(api.rowHeroSmsPreferredActivation.style.display, 'none');
  assert.equal(api.rowPhoneVerificationResendCount.style.display, 'none');
  assert.equal(api.rowPhoneReplacementLimit.style.display, 'none');
  assert.equal(api.rowPhoneCodeWaitSeconds.style.display, 'none');
  assert.equal(api.rowPhoneCodeTimeoutWindows.style.display, 'none');
  assert.equal(api.rowPhoneCodePollIntervalSeconds.style.display, 'none');
  assert.equal(api.rowPhoneCodePollMaxRounds.style.display, 'none');
  assert.equal(api.rowFiveSimApiKey.style.display, 'none');
  assert.equal(api.rowFiveSimCountry.style.display, 'none');
  assert.equal(api.rowFiveSimCountryFallback.style.display, 'none');
  assert.equal(api.rowFiveSimOperator.style.display, 'none');
  assert.equal(api.rowFiveSimProduct.style.display, 'none');
  assert.equal(api.rowNexSmsApiKey.style.display, 'none');
  assert.equal(api.rowNexSmsCountry.style.display, 'none');
  assert.equal(api.rowNexSmsCountryFallback.style.display, 'none');
  assert.equal(api.rowNexSmsServiceCode.style.display, 'none');

  api.inputPhoneVerificationEnabled.checked = true;
  api.setLatestState({ signupPhoneNumber: '66959916439' });
  api.updatePhoneVerificationSettingsUI();
  assert.equal(api.rowPhoneVerificationFold.style.display, 'none');
  assert.equal(api.rowSignupMethod.style.display, '');
  assert.equal(api.rowSignupPhone.style.display, '');
  assert.equal(api.rowPhoneSmsProvider.style.display, 'none');
  assert.equal(api.rowHeroSmsRuntimePair.style.display, '');
  assert.equal(api.rowHeroSmsCurrentNumber.style.display, '');
  assert.equal(api.rowHeroSmsCurrentCountdown.style.display, '');
  assert.equal(api.rowHeroSmsCurrentCode.style.display, '');
  assert.equal(api.rowHeroSmsPreferredActivation.style.display, '');

  api.setExpanded(true);
  api.updatePhoneVerificationSettingsUI();
  assert.equal(api.rowPhoneVerificationFold.style.display, '');
  assert.equal(api.rowSignupMethod.style.display, '');
  assert.equal(api.rowPhoneSmsProvider.style.display, '');
  assert.equal(api.rowPhoneSmsProviderOrder.style.display, '');
  assert.equal(api.rowPhoneSmsProviderOrderActions.style.display, '');
  assert.equal(api.btnTogglePhoneVerificationSection.disabled, false);
  assert.equal(api.btnTogglePhoneVerificationSection.textContent, '收起设置');
  assert.equal(api.rowHeroSmsPlatform.style.display, '');
  assert.equal(api.rowHeroSmsCountry.style.display, '');
  assert.equal(api.rowHeroSmsCountryFallback.style.display, '');
  assert.equal(api.rowHeroSmsAcquirePriority.style.display, '');
  assert.equal(api.rowHeroSmsApiKey.style.display, '');
  assert.equal(api.rowHeroSmsMaxPrice.style.display, '');
  assert.equal(api.rowFiveSimOperator.style.display, 'none');
  assert.equal(api.rowHeroSmsCurrentNumber.style.display, '');
  assert.equal(api.rowHeroSmsCurrentCountdown.style.display, '');
  assert.equal(api.rowHeroSmsPriceTiers.style.display, 'none');
  assert.equal(api.rowHeroSmsCurrentCode.style.display, '');
  assert.equal(api.rowHeroSmsPreferredActivation.style.display, '');
  assert.equal(api.rowPhoneVerificationResendCount.style.display, '');
  assert.equal(api.rowPhoneReplacementLimit.style.display, '');
  assert.equal(api.rowPhoneCodeWaitSeconds.style.display, '');
  assert.equal(api.rowPhoneCodeTimeoutWindows.style.display, '');
  assert.equal(api.rowPhoneCodePollIntervalSeconds.style.display, '');
  assert.equal(api.rowPhoneCodePollMaxRounds.style.display, '');

  api.setLatestState({
    signupMethod: 'phone',
    signupPhoneNumber: '66959916439',
    phoneSmsReuseEnabled: true,
    freePhoneReuseEnabled: true,
    freePhoneReuseAutoEnabled: true,
  });
  api.updatePhoneVerificationSettingsUI();
  assert.equal(api.inputHeroSmsReuseEnabled.checked, false);
  assert.equal(api.inputHeroSmsReuseEnabled.disabled, true);
  assert.equal(api.inputFreePhoneReuseEnabled.checked, false);
  assert.equal(api.inputFreePhoneReuseEnabled.disabled, true);
  assert.equal(api.inputFreePhoneReuseAutoEnabled.checked, false);
  assert.equal(api.inputFreePhoneReuseAutoEnabled.disabled, true);
  assert.equal(api.selectHeroSmsPreferredActivation.disabled, true);
  assert.equal(api.inputFreeReusablePhone.disabled, true);
  assert.equal(api.btnSaveFreeReusablePhone.disabled, true);
  assert.equal(api.btnClearFreeReusablePhone.disabled, true);
  assert.equal(api.rowFreePhoneReuseEnabled.classList.contains('is-disabled'), true);
  assert.equal(api.rowFreeReusablePhone.classList.contains('is-disabled'), true);

  api.setLatestState({
    signupMethod: 'email',
    signupPhoneNumber: '',
    phoneSmsReuseEnabled: true,
    freePhoneReuseEnabled: true,
    freePhoneReuseAutoEnabled: true,
  });
  api.updatePhoneVerificationSettingsUI();
  assert.equal(api.inputHeroSmsReuseEnabled.checked, true);
  assert.equal(api.inputHeroSmsReuseEnabled.disabled, false);
  assert.equal(api.inputFreePhoneReuseEnabled.checked, true);
  assert.equal(api.inputFreePhoneReuseEnabled.disabled, false);
  assert.equal(api.inputFreePhoneReuseAutoEnabled.checked, true);
  assert.equal(api.inputFreePhoneReuseAutoEnabled.disabled, false);
  assert.equal(api.selectHeroSmsPreferredActivation.disabled, false);
  assert.equal(api.inputFreeReusablePhone.disabled, false);
  assert.equal(api.btnSaveFreeReusablePhone.disabled, false);
  assert.equal(api.btnClearFreeReusablePhone.disabled, false);

  api.setSelectedPhoneSmsProvider('5sim');
  api.updatePhoneVerificationSettingsUI();
  assert.equal(api.rowFiveSimApiKey.style.display, '');
  assert.equal(api.rowFiveSimCountry.style.display, '');
  assert.equal(api.rowFiveSimCountryFallback.style.display, '');
  assert.equal(api.rowFiveSimOperator.style.display, '');
  assert.equal(api.rowFiveSimProduct.style.display, '');

  api.setSelectedPhoneSmsProvider('nexsms');
  api.updatePhoneVerificationSettingsUI();
  assert.equal(api.rowNexSmsApiKey.style.display, '');
  assert.equal(api.rowNexSmsCountry.style.display, '');
  assert.equal(api.rowNexSmsCountryFallback.style.display, '');
  assert.equal(api.rowNexSmsServiceCode.style.display, '');
});

test('collectSettingsPayload keeps local helper sync enabled while persisting sms toggle state', () => {
  const api = new Function('normalizeIcloudTargetMailboxType', 'normalizeIcloudForwardMailProvider', `
const window = {};
const PLUS_ACCOUNT_ACCESS_STRATEGY_OAUTH = 'oauth';
const PLUS_ACCOUNT_ACCESS_STRATEGY_SUB2API_CODEX_SESSION = 'sub2api_codex_session';
const DEFAULT_PLUS_ACCOUNT_ACCESS_STRATEGY = PLUS_ACCOUNT_ACCESS_STRATEGY_OAUTH;
let latestState = {
  accountContributionEnabled: false,
  mail2925UseAccountPool: false,
  currentMail2925AccountId: '',
  fiveSimCountryOrder: ['thailand', 'england'],
  heroSmsMinPrice: '0.0444',
  fiveSimMinPrice: '0.3333',
  phoneSmsReuseEnabled: false,
  heroSmsReuseEnabled: false,
  freePhoneReuseEnabled: false,
  freePhoneReuseAutoEnabled: false,
  phonePreferredActivation: {
    provider: 'hero-sms',
    activationId: 'stored-activation',
    phoneNumber: '66950001111',
    countryId: 52,
    countryLabel: 'Thailand',
    successfulUses: 2,
    maxUses: 3,
  },
};
let cloudflareDomainEditMode = false;
let cloudflareTempEmailDomainEditMode = false;
const selectCfDomain = { value: '' };
const selectTempEmailDomain = { value: '' };
const selectPanelMode = { value: 'cpa' };
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
const selectMailProvider = { value: '163' };
const selectEmailGenerator = { value: 'duck' };
const checkboxAutoDeleteIcloud = { checked: false };
const selectIcloudHostPreference = { value: 'auto' };
const inputMail2925UseAccountPool = { checked: false };
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
const inputPhoneVerificationEnabled = { checked: true };
const inputFreePhoneReuseEnabled = { checked: true };
const inputFreePhoneReuseAutoEnabled = { checked: true };
const selectPhoneSmsProvider = { value: 'hero-sms' };
const inputVerificationResendCount = { value: '4' };
const inputHeroSmsApiKey = { value: 'demo-key' };
const inputFiveSimApiKey = { value: 'five-sim-key' };
const inputFiveSimOperator = { value: 'any' };
const inputFiveSimProduct = { value: 'openai' };
const inputNexSmsApiKey = { value: 'nex-key' };
const inputNexSmsServiceCode = { value: 'ot' };
const inputHeroSmsReuseEnabled = { checked: true };
const selectHeroSmsAcquirePriority = { value: 'price' };
function getSelectedPhonePreferredActivation() {
  return {
    provider: 'hero-sms',
    activationId: 'demo-activation',
    phoneNumber: '66958889999',
    countryId: 52,
    countryLabel: 'Thailand',
    successfulUses: 0,
    maxUses: 3,
  };
}
const inputHeroSmsMaxPrice = { value: '0.12' };
const inputHeroSmsMinPrice = { value: '0.03' };
const inputHeroSmsPreferredPrice = { value: '0.0512' };
const inputPhoneReplacementLimit = { value: '5' };
const inputPhoneCodeWaitSeconds = { value: '75' };
const inputPhoneCodeTimeoutWindows = { value: '3' };
const inputPhoneCodePollIntervalSeconds = { value: '6' };
const inputPhoneCodePollMaxRounds = { value: '18' };
const inputAccountRunHistoryHelperBaseUrl = { value: 'http://127.0.0.1:17373' };
const DEFAULT_VERIFICATION_RESEND_COUNT = 4;
const DEFAULT_PHONE_VERIFICATION_REPLACEMENT_LIMIT = 3;
const DEFAULT_PHONE_CODE_WAIT_SECONDS = 60;
const DEFAULT_PHONE_CODE_TIMEOUT_WINDOWS = 2;
const DEFAULT_PHONE_CODE_POLL_INTERVAL_SECONDS = 5;
const DEFAULT_PHONE_CODE_POLL_MAX_ROUNDS = 4;
const PHONE_CODE_WAIT_SECONDS_MIN = 15;
const PHONE_CODE_WAIT_SECONDS_MAX = 300;
const PHONE_CODE_TIMEOUT_WINDOWS_MIN = 1;
const PHONE_CODE_TIMEOUT_WINDOWS_MAX = 10;
const PHONE_CODE_POLL_INTERVAL_SECONDS_MIN = 1;
const PHONE_CODE_POLL_INTERVAL_SECONDS_MAX = 30;
const PHONE_CODE_POLL_MAX_ROUNDS_MIN = 1;
const PHONE_CODE_POLL_MAX_ROUNDS_MAX = 120;
const DEFAULT_HERO_SMS_REUSE_ENABLED = true;
const HERO_SMS_ACQUIRE_PRIORITY_COUNTRY = 'country';
const HERO_SMS_ACQUIRE_PRIORITY_PRICE = 'price';
const DEFAULT_HERO_SMS_ACQUIRE_PRIORITY = HERO_SMS_ACQUIRE_PRIORITY_COUNTRY;
const PHONE_REPLACEMENT_LIMIT_MIN = 1;
const PHONE_REPLACEMENT_LIMIT_MAX = 20;
const DEFAULT_HERO_SMS_COUNTRY_ID = 52;
const DEFAULT_HERO_SMS_COUNTRY_LABEL = 'Thailand';
const PHONE_SMS_PROVIDER_HERO_SMS = 'hero-sms';
const PHONE_SMS_PROVIDER_FIVE_SIM = '5sim';
const PHONE_SMS_PROVIDER_NEXSMS = 'nexsms';
const DEFAULT_PHONE_SMS_PROVIDER = PHONE_SMS_PROVIDER_HERO_SMS;
const SIGNUP_METHOD_EMAIL = 'email';
const SIGNUP_METHOD_PHONE = 'phone';
const DEFAULT_SIGNUP_METHOD = SIGNUP_METHOD_EMAIL;
const DEFAULT_FIVE_SIM_COUNTRY_ID = 'vietnam';
const DEFAULT_FIVE_SIM_COUNTRY_LABEL = '越南 (Vietnam)';
const DEFAULT_FIVE_SIM_OPERATOR = 'any';
const DEFAULT_FIVE_SIM_PRODUCT = 'openai';
const DEFAULT_NEX_SMS_COUNTRY_ORDER = [1];
const DEFAULT_NEX_SMS_SERVICE_CODE = 'ot';
const FIVE_SIM_SUPPORTED_COUNTRY_ID_SET = new Set(['indonesia', 'thailand', 'vietnam']);
const HERO_SMS_SUPPORTED_COUNTRY_ID_SET = new Set(['6', '52', '10']);
const selectHeroSmsCountry = {
  value: '52',
  selectedIndex: 0,
  options: [{ textContent: 'Thailand' }],
};
function getCloudflareDomainsFromState() { return { domains: [], activeDomain: '' }; }
function normalizeCloudflareDomainValue(value) { return String(value || '').trim(); }
function getCloudflareTempEmailDomainsFromState() { return { domains: [], activeDomain: '' }; }
function normalizeCloudflareTempEmailDomainValue(value) { return String(value || '').trim(); }
function getSelectedLocalCpaStep9Mode() { return 'submit'; }
function getSelectedPlusPaymentMethod() { return 'paypal'; }
function getSelectedMail2925Mode() { return 'provide'; }
function getSelectedHotmailServiceMode() { return 'local'; }
function buildManagedAliasBaseEmailPayload() { return { gmailBaseEmail: '', mail2925BaseEmail: '', emailPrefix: '' }; }
function normalizeLuckmailBaseUrl(value) { return String(value || '').trim(); }
function normalizeLuckmailEmailType(value) { return String(value || '').trim() || 'ms_graph'; }
function normalizeCloudflareTempEmailBaseUrlValue(value) { return String(value || '').trim(); }
function normalizeCloudflareTempEmailReceiveMailboxValue(value) { return String(value || '').trim(); }
function normalizeAccountRunHistoryHelperBaseUrlValue(value) { return String(value || '').trim(); }
function normalizeAutoRunThreadIntervalMinutes(value) { return Number(value) || 0; }
function normalizeAutoStepDelaySeconds(value) { return value === '' ? null : Number(value); }
function normalizeVerificationResendCount(value, fallback) { return Number(value) || fallback; }
function normalizePlusAccountAccessStrategy(value = '') { return String(value || '').trim().toLowerCase() === PLUS_ACCOUNT_ACCESS_STRATEGY_SUB2API_CODEX_SESSION ? PLUS_ACCOUNT_ACCESS_STRATEGY_SUB2API_CODEX_SESSION : PLUS_ACCOUNT_ACCESS_STRATEGY_OAUTH; }
function resolvePlusAccountAccessStrategyForTarget(value = '') { return normalizePlusAccountAccessStrategy(value); }
${extractFunction('normalizePhoneSmsProvider')}
${extractFunction('normalizePhoneSmsProviderValue')}
${extractFunction('normalizeFiveSimCountryCode')}
${extractFunction('normalizeFiveSimCountryOrderValue')}
${extractFunction('normalizeFiveSimProductValue')}
${extractFunction('normalizeNexSmsCountryIdValue')}
${extractFunction('normalizeNexSmsCountryOrderValue')}
${extractFunction('normalizeNexSmsServiceCodeValue')}
function getSelectedPhoneSmsProvider() { return normalizePhoneSmsProvider(selectPhoneSmsProvider?.value || latestState?.phoneSmsProvider); }
function getSelectedPhoneSmsProviderOrder() { return ['nexsms', '5sim']; }
${extractFunction('normalizeFiveSimCountryId')}
${extractFunction('normalizeFiveSimCountryLabel')}
${extractFunction('normalizeFiveSimOperator')}
${extractFunction('normalizeFiveSimMaxPriceValue')}
${extractFunction('normalizeFiveSimCountryFallbackList')}
${extractFunction('normalizePhoneSmsMaxPriceValue')}
${extractFunction('normalizePhoneSmsMinPriceValue')}
${extractFunction('normalizeHeroSmsMaxPriceValue')}
${extractFunction('normalizePhoneVerificationReplacementLimit')}
${extractFunction('normalizePhoneCodeWaitSecondsValue')}
${extractFunction('normalizePhoneCodeTimeoutWindowsValue')}
${extractFunction('normalizePhoneCodePollIntervalSecondsValue')}
${extractFunction('normalizePhoneCodePollMaxRoundsValue')}
${extractFunction('normalizeHeroSmsReuseEnabledValue')}
${extractFunction('normalizeHeroSmsAcquirePriority')}
${extractFunction('normalizeHeroSmsCountryId')}
${extractFunction('normalizeHeroSmsCountryLabel')}
${extractFunction('getSelectedHeroSmsCountryOption')}
${extractFunction('normalizeSignupMethod')}
${extractFunction('isPhoneSignupReuseLocked')}
${extractFunction('getStoredPhoneSmsReuseEnabled')}
${extractFunction('getStoredFreePhoneReuseEnabled')}
${extractFunction('getStoredFreePhoneReuseAutoEnabled')}
function syncHeroSmsFallbackSelectionOrderFromSelect() {
  return [{ id: 52, label: 'Thailand' }, { id: 16, label: 'United Kingdom' }];
}
function getSelectedSignupMethod() { return 'phone'; }
${extractFunction('normalizePanelMode')}
${extractFunction('getSelectedPanelMode')}
function getSelectedFiveSimCountries() {
  return [{ id: 'thailand', code: 'thailand', label: 'Thailand' }, { id: 'vietnam', code: 'vietnam', label: 'Vietnam' }];
}
function getSelectedNexSmsCountries() {
  return [{ id: 1, label: 'Country #1' }];
}
${extractFunction('collectSettingsPayload')}
return { collectSettingsPayload };
`)(normalizeIcloudTargetMailboxType, normalizeIcloudForwardMailProvider);

  const payload = api.collectSettingsPayload();

  assert.equal(payload.phoneVerificationEnabled, true);
  assert.equal(payload.signupMethod, 'phone');
  assert.equal(payload.phoneSmsProvider, 'hero-sms');
  assert.deepStrictEqual(payload.phoneSmsProviderOrder, ['nexsms', '5sim']);
  assert.equal(payload.accountRunHistoryTextEnabled, true);
  assert.equal(payload.accountRunHistoryHelperBaseUrl, 'http://127.0.0.1:17373');
  assert.equal(payload.heroSmsApiKey, 'demo-key');
  assert.equal(payload.fiveSimApiKey, 'five-sim-key');
  assert.deepStrictEqual(payload.fiveSimCountryOrder, ['thailand', 'vietnam']);
  assert.equal(payload.fiveSimOperator, 'any');
  assert.equal(payload.fiveSimProduct, 'openai');
  assert.equal(payload.nexSmsApiKey, 'nex-key');
  assert.deepStrictEqual(payload.nexSmsCountryOrder, [1]);
  assert.equal(payload.nexSmsServiceCode, 'ot');
  assert.equal(payload.phoneSmsReuseEnabled, false);
  assert.equal(payload.heroSmsReuseEnabled, false);
  assert.equal(payload.freePhoneReuseEnabled, false);
  assert.equal(payload.freePhoneReuseAutoEnabled, false);
  assert.equal(payload.heroSmsAcquirePriority, 'price');
  assert.equal(payload.heroSmsMinPrice, '0.03');
  assert.equal(payload.heroSmsMaxPrice, '0.12');
  assert.equal(payload.heroSmsPreferredPrice, '0.0512');
  assert.deepStrictEqual(payload.phonePreferredActivation, {
    provider: 'hero-sms',
    activationId: 'stored-activation',
    phoneNumber: '66950001111',
    countryId: 52,
    countryLabel: 'Thailand',
    successfulUses: 2,
    maxUses: 3,
  });
  assert.equal(payload.phoneVerificationReplacementLimit, 5);
  assert.equal(payload.phoneCodeWaitSeconds, 75);
  assert.equal(payload.phoneCodeTimeoutWindows, 3);
  assert.equal(payload.phoneCodePollIntervalSeconds, 6);
  assert.equal(payload.phoneCodePollMaxRounds, 18);
  assert.equal(payload.heroSmsCountryId, 52);
  assert.equal(payload.heroSmsCountryLabel, 'Thailand');
  assert.deepStrictEqual(payload.heroSmsCountryFallback, [{ id: 16, label: 'United Kingdom' }]);
  assert.equal(payload.fiveSimApiKey, 'five-sim-key');
  assert.equal(payload.fiveSimCountryId, 'vietnam');
  assert.equal(payload.fiveSimMinPrice, '0.3333');
});

test('switchPhoneSmsProvider saves API keys independently when the select value has already changed', async () => {
  const api = new Function(`
let latestState = {
  phoneSmsProvider: 'hero-sms',
  heroSmsApiKey: 'hero-old',
  fiveSimApiKey: 'five-old',
  heroSmsMinPrice: '0.04',
  heroSmsMaxPrice: '0.11',
  fiveSimMinPrice: '0.88',
  fiveSimMaxPrice: '12',
  heroSmsCountryId: 52,
  heroSmsCountryLabel: 'Thailand',
  heroSmsCountryFallback: [],
  fiveSimCountryId: 'vietnam',
  fiveSimCountryLabel: '越南 (Vietnam)',
  fiveSimCountryFallback: [],
  fiveSimOperator: 'any',
};
const PHONE_SMS_PROVIDER_HERO_SMS = 'hero-sms';
const PHONE_SMS_PROVIDER_FIVE_SIM = '5sim';
const DEFAULT_FIVE_SIM_COUNTRY_ID = 'vietnam';
const DEFAULT_FIVE_SIM_COUNTRY_LABEL = '越南 (Vietnam)';
const DEFAULT_FIVE_SIM_OPERATOR = 'any';
const DEFAULT_HERO_SMS_COUNTRY_ID = 52;
const DEFAULT_HERO_SMS_COUNTRY_LABEL = 'Thailand';
const FIVE_SIM_SUPPORTED_COUNTRY_ID_SET = new Set(['indonesia', 'thailand', 'vietnam']);
const HERO_SMS_SUPPORTED_COUNTRY_ID_SET = new Set(['6', '52', '10']);
const selectPhoneSmsProvider = { value: 'hero-sms', dataset: { activeProvider: 'hero-sms' } };
const inputHeroSmsApiKey = { value: 'hero-live' };
const inputHeroSmsMinPrice = { value: '0.03' };
const inputHeroSmsMaxPrice = { value: '0.22' };
const inputFiveSimOperator = { value: 'any' };
const displayHeroSmsPriceTiers = { textContent: '' };
const displayPhoneSmsBalance = { textContent: '' };
const rowHeroSmsPriceTiers = { style: { display: '' } };
let heroSmsCountrySelectionOrder = [];
let savedPayload = null;

${extractFunction('normalizePhoneSmsProvider')}
${extractFunction('setPhoneSmsProviderSelectValue')}
${extractFunction('getLastAppliedPhoneSmsProvider')}
function getSelectedPhoneSmsProvider() { return normalizePhoneSmsProvider(selectPhoneSmsProvider?.value || latestState?.phoneSmsProvider); }
${extractFunction('normalizeFiveSimCountryId')}
${extractFunction('normalizeFiveSimCountryLabel')}
${extractFunction('normalizeFiveSimOperator')}
${extractFunction('normalizeFiveSimMaxPriceValue')}
${extractFunction('normalizeHeroSmsMaxPriceValue')}
${extractFunction('normalizePhoneSmsMinPriceValue')}
${extractFunction('normalizePhoneSmsMaxPriceValue')}
${extractFunction('normalizeHeroSmsCountryId')}
${extractFunction('normalizeHeroSmsCountryLabel')}
${extractFunction('normalizeHeroSmsCountryFallbackList')}
${extractFunction('normalizeFiveSimCountryFallbackList')}
function getSelectedHeroSmsCountryOption() {
  return getSelectedPhoneSmsProvider() === PHONE_SMS_PROVIDER_FIVE_SIM
    ? { id: latestState.fiveSimCountryId || DEFAULT_FIVE_SIM_COUNTRY_ID, label: latestState.fiveSimCountryLabel || DEFAULT_FIVE_SIM_COUNTRY_LABEL }
    : { id: latestState.heroSmsCountryId || DEFAULT_HERO_SMS_COUNTRY_ID, label: latestState.heroSmsCountryLabel || DEFAULT_HERO_SMS_COUNTRY_LABEL };
}
function syncHeroSmsFallbackSelectionOrderFromSelect() {
  return getSelectedPhoneSmsProvider() === PHONE_SMS_PROVIDER_FIVE_SIM
    ? [{ id: 'vietnam', label: '越南 (Vietnam)' }]
    : [{ id: 52, label: 'Thailand' }];
}
function syncLatestState(patch) { latestState = { ...latestState, ...patch }; }
function loadHeroSmsCountries() { return Promise.resolve(); }
function applyHeroSmsFallbackSelection() {}
function updatePhoneVerificationSettingsUI() {}
function markSettingsDirty() {}
function saveSettings() { savedPayload = { ...latestState }; return Promise.resolve(); }

${extractFunction('switchPhoneSmsProvider')}

return {
  selectPhoneSmsProvider,
  inputHeroSmsApiKey,
  inputHeroSmsMinPrice,
  get latestState() { return latestState; },
  get savedPayload() { return savedPayload; },
  switchPhoneSmsProvider,
};
`)();

  // Browser change events update <select>.value before the listener runs.
  api.selectPhoneSmsProvider.value = '5sim';
  await api.switchPhoneSmsProvider(api.selectPhoneSmsProvider.value);

  assert.equal(api.latestState.phoneSmsProvider, '5sim');
  assert.equal(api.latestState.heroSmsApiKey, 'hero-live');
  assert.equal(api.latestState.fiveSimApiKey, 'five-old');
  assert.equal(api.latestState.heroSmsMinPrice, '0.03');
  assert.equal(api.latestState.fiveSimMinPrice, '0.88');
  assert.equal(api.inputHeroSmsApiKey.value, 'five-old');
  assert.equal(api.inputHeroSmsMinPrice.value, '0.88');
  assert.equal(api.selectPhoneSmsProvider.dataset.activeProvider, '5sim');

  api.inputHeroSmsApiKey.value = 'five-live';
  api.selectPhoneSmsProvider.value = 'hero-sms';
  await api.switchPhoneSmsProvider(api.selectPhoneSmsProvider.value);

  assert.equal(api.latestState.phoneSmsProvider, 'hero-sms');
  assert.equal(api.latestState.heroSmsApiKey, 'hero-live');
  assert.equal(api.latestState.fiveSimApiKey, 'five-live');
  assert.equal(api.latestState.heroSmsMinPrice, '0.03');
  assert.equal(api.latestState.fiveSimMinPrice, '0.88');
  assert.equal(api.inputHeroSmsApiKey.value, 'hero-live');
  assert.equal(api.inputHeroSmsMinPrice.value, '0.03');
  assert.equal(api.selectPhoneSmsProvider.dataset.activeProvider, 'hero-sms');
  assert.equal(api.savedPayload.heroSmsApiKey, 'hero-live');
  assert.equal(api.savedPayload.fiveSimApiKey, 'five-live');
  assert.equal(api.savedPayload.heroSmsMinPrice, '0.03');
  assert.equal(api.savedPayload.fiveSimMinPrice, '0.88');
});

test('formatPhoneSmsPriceEntriesSummary treats HeroSMS physicalCount=0 as out of stock even when count is positive', () => {
  const api = new Function(`
${extractFunction('normalizeHeroSmsPriceForPreview')}
${extractFunction('collectHeroSmsPriceEntriesForPreview')}
${extractFunction('formatPhoneSmsPriceEntriesSummary')}
return { formatPhoneSmsPriceEntriesSummary };
`)();

  const summary = api.formatPhoneSmsPriceEntriesSummary({
    52: {
      dr: {
        cost: 0.05,
        count: 3,
        physicalCount: 0,
      },
    },
  });

  assert.deepStrictEqual(summary.inStockPrices, []);
  assert.deepStrictEqual(summary.allPrices, [0.05]);
  assert.equal(summary.entries[0].inStock, false);
  assert.equal(summary.entries[0].stockCount, 0);
});

test('previewHeroSmsPriceTiers prefers 5sim products price for buy-compatible any operator', async () => {
  const api = new Function(`
let latestState = { phoneSmsProvider: '5sim', fiveSimOperator: 'any' };
const PHONE_SMS_PROVIDER_HERO_SMS = 'hero-sms';
const PHONE_SMS_PROVIDER_FIVE_SIM = '5sim';
const DEFAULT_FIVE_SIM_COUNTRY_ID = 'vietnam';
const DEFAULT_FIVE_SIM_COUNTRY_LABEL = '越南 (Vietnam)';
const DEFAULT_FIVE_SIM_OPERATOR = 'any';
const DEFAULT_FIVE_SIM_PRODUCT = 'openai';
const FIVE_SIM_SUPPORTED_COUNTRY_ID_SET = new Set(['indonesia', 'thailand', 'vietnam']);
const HERO_SMS_SUPPORTED_COUNTRY_ID_SET = new Set(['6', '52', '10']);
const inputHeroSmsMaxPrice = { value: '' };
const inputHeroSmsMinPrice = { value: '0.1' };
const inputHeroSmsApiKey = { value: '' };
const inputFiveSimOperator = { value: 'any' };
const inputFiveSimProduct = { value: 'openai' };
const displayHeroSmsPriceTiers = { textContent: '' };
const rowHeroSmsPriceTiers = { style: { display: 'none' } };
const fetchCalls = [];

${extractFunction('normalizePhoneSmsProvider')}
${extractFunction('normalizePhoneSmsProviderValue')}
${extractFunction('normalizePhoneSmsProviderOrderValue')}
const phoneSmsProviderOrderSelection = [];
function getSelectedPhoneSmsProvider() { return '5sim'; }
function getSelectedPhoneSmsProviderOrder() { return ['5sim']; }
${extractFunction('normalizeFiveSimCountryId')}
${extractFunction('normalizeFiveSimCountryLabel')}
${extractFunction('normalizeFiveSimCountryCode')}
${extractFunction('normalizeFiveSimProductValue')}
${extractFunction('normalizeFiveSimOperator')}
${extractFunction('normalizePhoneSmsMaxPriceValue')}
${extractFunction('normalizePhoneSmsMinPriceValue')}
${extractFunction('normalizeFiveSimMaxPriceValue')}
${extractFunction('normalizeHeroSmsMaxPriceValue')}
${extractFunction('normalizeHeroSmsPriceForPreview')}
${extractFunction('formatHeroSmsPriceForPreview')}
${extractFunction('isHeroSmsPreviewEmptyPayload')}
${extractFunction('collectHeroSmsPriceEntriesForPreview')}
${extractFunction('formatPhoneSmsPriceEntriesSummary')}
${extractFunction('describeHeroSmsPreviewPayload')}
${extractFunction('summarizeHeroSmsPreviewError')}
${extractFunction('resolvePhoneSmsPricePreviewRange')}
${extractFunction('isPhoneSmsPriceWithinPreviewRange')}
${extractFunction('filterPhoneSmsPriceEntriesForPreviewRange')}
${extractFunction('filterPhoneSmsPriceValuesForPreviewRange')}
${extractFunction('formatPhoneSmsPriceRangePreviewText')}
${extractFunction('buildPhoneSmsPriceRangePreviewMessage')}
${extractFunction('formatPriceTiersForPreview')}
${extractFunction('formatPriceTiersWithZeroStockForPreview')}
function normalizeHeroSmsFetchErrorMessage(error) { return error?.message || String(error); }
function getFiveSimCountryLabelByCode() { return '越南 (Vietnam)'; }
function getSelectedFiveSimCountries() {
  return [{ id: 'vietnam', code: 'vietnam', label: '越南 (Vietnam)' }];
}
function syncHeroSmsFallbackSelectionOrderFromSelect() {
  return [{ id: 'vietnam', label: '越南 (Vietnam)' }];
}
function getSelectedHeroSmsCountryOption() {
  return { id: 'vietnam', label: '越南 (Vietnam)' };
}
function normalizePhoneSmsCountryId(value) { return normalizeFiveSimCountryId(value); }
function normalizePhoneSmsCountryLabel(value) { return normalizeFiveSimCountryLabel(value); }
function getHeroSmsCountryLabelById() { return '越南 (Vietnam)'; }
async function fetch(url, options = {}) {
  const parsed = new URL(url);
  fetchCalls.push({ url: parsed, options });
  if (parsed.pathname === '/v1/guest/products/vietnam/any') {
    return {
      ok: true,
      status: 200,
      json: async () => ({ openai: { Category: 'activation', Qty: 4609, Price: 0.08 } }),
    };
  }
  if (parsed.pathname === '/v1/guest/prices') {
    return {
      ok: true,
      status: 200,
      json: async () => ({
        vietnam: {
          openai: {
            virtual21: { cost: 0.0769, count: 0 },
            virtual47: { cost: 0.1282, count: 4608 },
          },
        },
      }),
    };
  }
  throw new Error('unexpected ' + parsed.pathname);
}

${extractFunction('buildFiveSimPricePreviewLines')}
${extractFunction('previewHeroSmsPriceTiers')}

return {
  displayHeroSmsPriceTiers,
  rowHeroSmsPriceTiers,
  fetchCalls,
  previewHeroSmsPriceTiers,
};
`)();

  await api.previewHeroSmsPriceTiers();

  assert.equal(
    api.displayHeroSmsPriceTiers.textContent,
    '5sim:\n越南 (Vietnam): 区间内最低 0.1282；档位：0.1282(x4608)'
  );
  assert.equal(api.rowHeroSmsPriceTiers.style.display, '');
  assert.deepStrictEqual(
    api.fetchCalls.map((entry) => entry.url.pathname),
    ['/v1/guest/prices']
  );
});

test('hero sms max price input does not auto-save partial typing states', () => {
  assert.match(
    sidepanelSource,
    /inputHeroSmsMaxPrice\?\.\s*addEventListener\('input',\s*\(\)\s*=>\s*\{\s*markSettingsDirty\(true\);\s*\}\);/
  );
  assert.doesNotMatch(
    sidepanelSource,
    /inputHeroSmsMaxPrice\?\.\s*addEventListener\('input',\s*\(\)\s*=>\s*\{\s*markSettingsDirty\(true\);\s*scheduleSettingsAutoSave\(\);/
  );
  assert.match(
    sidepanelSource,
    /inputHeroSmsMinPrice\?\.\s*addEventListener\('input',\s*\(\)\s*=>\s*\{\s*markSettingsDirty\(true\);\s*\}\);/
  );
  assert.doesNotMatch(
    sidepanelSource,
    /inputHeroSmsMinPrice\?\.\s*addEventListener\('input',\s*\(\)\s*=>\s*\{\s*markSettingsDirty\(true\);\s*scheduleSettingsAutoSave\(\);/
  );
});
