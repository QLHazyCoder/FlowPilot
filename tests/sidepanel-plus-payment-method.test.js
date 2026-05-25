const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');

const sidepanelSource = fs.readFileSync('sidepanel/sidepanel.js', 'utf8');

function extractFunction(name) {
  const asyncStart = sidepanelSource.indexOf(`async function ${name}`);
  const normalStart = sidepanelSource.indexOf(`function ${name}`);
  const start = asyncStart !== -1
    ? asyncStart
    : normalStart;
  if (start === -1) {
    throw new Error(`Function ${name} not found`);
  }
  const signatureEnd = sidepanelSource.indexOf(')', start);
  const bodyStart = sidepanelSource.indexOf('{', signatureEnd);
  let depth = 0;
  let end = bodyStart;
  for (; end < sidepanelSource.length; end += 1) {
    const char = sidepanelSource[end];
    if (char === '{') {
      depth += 1;
    } else if (char === '}') {
      depth -= 1;
      if (depth === 0) {
        end += 1;
        break;
      }
    }
  }
  return sidepanelSource.slice(start, end);
}

function extractLastFunction(name) {
  const asyncStart = sidepanelSource.lastIndexOf(`async function ${name}`);
  const normalStart = sidepanelSource.lastIndexOf(`function ${name}`);
  const asyncInnerFunctionStart = asyncStart >= 0 ? asyncStart + 'async '.length : -1;
  const start = asyncStart >= 0 && normalStart === asyncInnerFunctionStart
    ? asyncStart
    : (asyncStart > normalStart ? asyncStart : normalStart);
  if (start === -1) {
    throw new Error(`Function ${name} not found`);
  }
  const signatureEnd = sidepanelSource.indexOf(')', start);
  const bodyStart = sidepanelSource.indexOf('{', signatureEnd);
  let depth = 0;
  let end = bodyStart;
  for (; end < sidepanelSource.length; end += 1) {
    const char = sidepanelSource[end];
    if (char === '{') {
      depth += 1;
    } else if (char === '}') {
      depth -= 1;
      if (depth === 0) {
        end += 1;
        break;
      }
    }
  }
  return sidepanelSource.slice(start, end);
}

test('sidepanel step definitions keep the selected Plus payment method', () => {
  const bundle = [
    extractFunction('normalizeSignupMethod'),
    extractFunction('normalizePlusPaymentMethod'),
    extractFunction('normalizePlusAccountAccessStrategy'),
    extractFunction('getStepDefinitionsForMode'),
    extractFunction('rebuildStepDefinitionState'),
    extractFunction('syncStepDefinitionsForMode'),
  ].join('\n');

  const api = new Function(`
const calls = [];
const window = {
  MultiPageStepDefinitions: {
    getSteps(options) {
      calls.push({ type: 'getSteps', options });
      return [{ id: options.plusPaymentMethod === 'gopay' ? 7 : 6, order: 1 }];
    },
  },
};
let currentPlusModeEnabled = false;
let currentPlusPaymentMethod = 'paypal';
const PLUS_ACCOUNT_ACCESS_STRATEGY_OAUTH = 'oauth';
const PLUS_ACCOUNT_ACCESS_STRATEGY_SUB2API_CODEX_SESSION = 'sub2api_codex_session';
const PLUS_ACCOUNT_ACCESS_STRATEGY_CPA_CODEX_SESSION = 'cpa_codex_session';
const DEFAULT_PLUS_ACCOUNT_ACCESS_STRATEGY = PLUS_ACCOUNT_ACCESS_STRATEGY_OAUTH;
let currentPlusAccountAccessStrategy = DEFAULT_PLUS_ACCOUNT_ACCESS_STRATEGY;
let currentSignupMethod = 'email';
let currentPhoneVerificationEnabled = false;
let currentPhoneSignupReloginAfterBindEmailEnabled = false;
const DEFAULT_SIGNUP_METHOD = 'email';
let stepDefinitions = [];
let STEP_IDS = [];
let STEP_DEFAULT_STATUSES = {};
let SKIPPABLE_STEPS = new Set();
function renderStepsList() {
  calls.push({ type: 'render', stepIds: [...STEP_IDS] });
}
${bundle}
return {
  calls,
  syncStepDefinitionsForMode,
  getCurrentPlusPaymentMethod: () => currentPlusPaymentMethod,
  getStepIds: () => [...STEP_IDS],
};
`)();

  api.syncStepDefinitionsForMode(true, 'gopay', { render: true });

  assert.equal(api.getCurrentPlusPaymentMethod(), 'gopay');
  assert.deepEqual(api.getStepIds(), [7]);
  assert.deepEqual(api.calls[0], {
    type: 'getSteps',
    options: { activeFlowId: 'openai', plusModeEnabled: true, plusPaymentMethod: 'gopay', plusAccountAccessStrategy: 'oauth', signupMethod: 'email', phoneVerificationEnabled: false, phoneSignupReloginAfterBindEmailEnabled: false, accountContributionEnabled: false },
  });
  assert.deepEqual(api.calls[1], { type: 'render', stepIds: [7] });
});

test('sidepanel normalizeSignupMethod stays independent from signup constants during bootstrap', () => {
  const source = extractFunction('normalizeSignupMethod');
  assert.doesNotMatch(source, /SIGNUP_METHOD_(PHONE|EMAIL)/);
});

test('sidepanel initializes latestState before bootstrapping shared step definitions', () => {
  const latestStateIndex = sidepanelSource.indexOf('let latestState = null;');
  const bootstrapIndex = sidepanelSource.indexOf('let stepDefinitions = getStepDefinitionsForMode(false, {');

  assert.notEqual(latestStateIndex, -1);
  assert.notEqual(bootstrapIndex, -1);
  assert.ok(latestStateIndex < bootstrapIndex);
});

test('sidepanel signup method UI syncs shared step definitions with the selected signup method', () => {
  const source = extractFunction('updateSignupMethodUI');
  assert.match(source, /syncStepDefinitionsForMode\(/);
  assert.match(source, /signupMethod:\s*selectedMethod/);
});

test('sidepanel applies restored signup method when rebuilding shared step definitions on load', () => {
  const source = extractFunction('applySettingsState');
  assert.match(source, /resolveStepDefinitionCapabilityState\(state/);
  assert.match(source, /signupMethod:\s*stepDefinitionState\.signupMethod/);
});

test('sidepanel Plus UI hides PayPal account selector while GoPay is selected', () => {
  const bundle = [
    extractFunction('normalizePlusPaymentMethod'),
    extractFunction('normalizePlusAccountAccessStrategy'),
    extractFunction('getSelectedPlusPaymentMethod'),
    extractFunction('getRequestedPlusAccountAccessStrategy'),
    extractFunction('normalizeGpcHelperPhoneModeValue'),
    extractFunction('getGpcHelperAutoModeEnabled'),
    extractFunction('normalizeGpcAutoModePermissionValue'),
    extractFunction('getGpcAutoModePermissionFromPayload'),
    extractFunction('shouldPreserveSelectedGpcAutoMode'),
    extractFunction('hasGpcAutoModePermissionField'),
    extractFunction('isGpcAutoModePermissionDenied'),
    extractFunction('normalizeGpcOtpChannelValue'),
    extractFunction('updatePlusModeUI'),
  ].join('\n');

  const api = new Function(`
let latestState = { plusPaymentMethod: 'gopay' };
let currentPlusPaymentMethod = 'paypal';
let currentPlusAccountAccessStrategy = 'oauth';
const inputPlusModeEnabled = { checked: true };
const selectPlusPaymentMethod = { value: 'gopay', style: { display: 'none' } };
const GPC_HELPER_PHONE_MODE_AUTO = 'auto';
const GPC_HELPER_PHONE_MODE_MANUAL = 'manual';
const PLUS_ACCOUNT_ACCESS_STRATEGY_OAUTH = 'oauth';
const PLUS_ACCOUNT_ACCESS_STRATEGY_SUB2API_CODEX_SESSION = 'sub2api_codex_session';
const PLUS_ACCOUNT_ACCESS_STRATEGY_CPA_CODEX_SESSION = 'cpa_codex_session';
const DEFAULT_PLUS_ACCOUNT_ACCESS_STRATEGY = PLUS_ACCOUNT_ACCESS_STRATEGY_OAUTH;
const rowPayPalAccount = { style: { display: '' } };
${bundle}
return { updatePlusModeUI, selectPlusPaymentMethod, rowPayPalAccount };
`)();

  api.updatePlusModeUI();

  assert.equal(api.selectPlusPaymentMethod.style.display, '');
  assert.equal(api.rowPayPalAccount.style.display, 'none');

  api.selectPlusPaymentMethod.value = 'paypal';
  api.updatePlusModeUI();
  assert.equal(api.rowPayPalAccount.style.display, '');
});

test('sidepanel Plus UI separates PayPal account mode from PayPal no-card binding mode', () => {
  const bundle = [
    extractFunction('normalizePlusPaymentMethod'),
    extractFunction('normalizePlusAccountAccessStrategy'),
    extractFunction('getSelectedPlusPaymentMethod'),
    extractFunction('getRequestedPlusAccountAccessStrategy'),
    extractFunction('normalizeGpcHelperPhoneModeValue'),
    extractFunction('getGpcHelperAutoModeEnabled'),
    extractFunction('normalizeGpcAutoModePermissionValue'),
    extractFunction('getGpcAutoModePermissionFromPayload'),
    extractFunction('shouldPreserveSelectedGpcAutoMode'),
    extractFunction('hasGpcAutoModePermissionField'),
    extractFunction('isGpcAutoModePermissionDenied'),
    extractFunction('normalizeGpcOtpChannelValue'),
    extractFunction('updatePlusModeUI'),
  ].join('\n');

  const api = new Function(`
let latestState = { plusPaymentMethod: 'paypal-hosted' };
let currentPlusPaymentMethod = 'paypal-hosted';
let currentPlusAccountAccessStrategy = 'oauth';
const inputPlusModeEnabled = { checked: true };
const selectPlusPaymentMethod = { value: 'paypal-hosted', style: { display: 'none' } };
const GPC_HELPER_PHONE_MODE_AUTO = 'auto';
const GPC_HELPER_PHONE_MODE_MANUAL = 'manual';
const PLUS_ACCOUNT_ACCESS_STRATEGY_OAUTH = 'oauth';
const PLUS_ACCOUNT_ACCESS_STRATEGY_SUB2API_CODEX_SESSION = 'sub2api_codex_session';
const PLUS_ACCOUNT_ACCESS_STRATEGY_CPA_CODEX_SESSION = 'cpa_codex_session';
const DEFAULT_PLUS_ACCOUNT_ACCESS_STRATEGY = PLUS_ACCOUNT_ACCESS_STRATEGY_OAUTH;
const plusPaymentMethodCaption = { textContent: '' };
const rowPayPalAccount = { style: { display: '' } };
const rowHostedCheckoutVerificationUrl = { style: { display: 'none' } };
const rowHostedCheckoutPhone = { style: { display: 'none' } };
const rowPlusHostedCheckoutOauthDelay = { style: { display: 'none' } };
${bundle}
return {
  updatePlusModeUI,
  selectPlusPaymentMethod,
  rowPayPalAccount,
  plusPaymentMethodCaption,
  rows: { rowHostedCheckoutVerificationUrl, rowHostedCheckoutPhone, rowPlusHostedCheckoutOauthDelay },
};
`)();

  api.updatePlusModeUI();

  assert.equal(api.rowPayPalAccount.style.display, 'none');
  assert.equal(api.rows.rowHostedCheckoutVerificationUrl.style.display, '');
  assert.equal(api.rows.rowHostedCheckoutPhone.style.display, '');
  assert.equal(api.rows.rowPlusHostedCheckoutOauthDelay.style.display, '');
  assert.match(api.plusPaymentMethodCaption.textContent, /无卡直绑/);

  api.selectPlusPaymentMethod.value = 'paypal';
  api.updatePlusModeUI();

  assert.equal(api.rowPayPalAccount.style.display, '');
  assert.equal(api.rows.rowHostedCheckoutVerificationUrl.style.display, 'none');
  assert.equal(api.rows.rowHostedCheckoutPhone.style.display, 'none');
  assert.equal(api.rows.rowPlusHostedCheckoutOauthDelay.style.display, 'none');
});

test('sidepanel Plus UI supports no-payment mode without payment-specific rows', () => {
  const bundle = [
    extractFunction('normalizePlusPaymentMethod'),
    extractFunction('normalizePlusAccountAccessStrategy'),
    extractFunction('getSelectedPlusPaymentMethod'),
    extractFunction('getRequestedPlusAccountAccessStrategy'),
    extractFunction('normalizeGpcHelperPhoneModeValue'),
    extractFunction('getGpcHelperAutoModeEnabled'),
    extractFunction('normalizeGpcAutoModePermissionValue'),
    extractFunction('getGpcAutoModePermissionFromPayload'),
    extractFunction('shouldPreserveSelectedGpcAutoMode'),
    extractFunction('hasGpcAutoModePermissionField'),
    extractFunction('isGpcAutoModePermissionDenied'),
    extractFunction('normalizeGpcOtpChannelValue'),
    extractFunction('updatePlusModeUI'),
  ].join('\n');

  const api = new Function(`
let latestState = { plusPaymentMethod: 'none' };
let currentPlusPaymentMethod = 'none';
let currentPlusAccountAccessStrategy = 'sub2api_codex_session';
const inputPlusModeEnabled = { checked: true };
const selectPlusPaymentMethod = { value: 'none', style: { display: 'none' } };
const GPC_HELPER_PHONE_MODE_AUTO = 'auto';
const GPC_HELPER_PHONE_MODE_MANUAL = 'manual';
const PLUS_PAYMENT_METHOD_NONE = 'none';
const PLUS_ACCOUNT_ACCESS_STRATEGY_OAUTH = 'oauth';
const PLUS_ACCOUNT_ACCESS_STRATEGY_SUB2API_CODEX_SESSION = 'sub2api_codex_session';
const PLUS_ACCOUNT_ACCESS_STRATEGY_CPA_CODEX_SESSION = 'cpa_codex_session';
const DEFAULT_PLUS_ACCOUNT_ACCESS_STRATEGY = PLUS_ACCOUNT_ACCESS_STRATEGY_OAUTH;
const plusPaymentMethodCaption = { textContent: '' };
const rowPayPalAccount = { style: { display: '' } };
const rowHostedCheckoutVerificationUrl = { style: { display: '' } };
const rowHostedCheckoutPhone = { style: { display: '' } };
const rowPlusHostedCheckoutOauthDelay = { style: { display: '' } };
const rowGoPayPhone = { style: { display: '' } };
const rowGpcHelperApi = { style: { display: '' } };
${bundle}
return {
  updatePlusModeUI,
  plusPaymentMethodCaption,
  rows: {
    rowPayPalAccount,
    rowHostedCheckoutVerificationUrl,
    rowHostedCheckoutPhone,
    rowPlusHostedCheckoutOauthDelay,
    rowGoPayPhone,
    rowGpcHelperApi,
  },
};
`)();

  api.updatePlusModeUI();

  assert.match(api.plusPaymentMethodCaption.textContent, /无需配置支付链路/);
  Object.values(api.rows).forEach((row) => {
    assert.equal(row.style.display, 'none');
  });
});

test('sidepanel Plus UI can hide Plus controls when the shared flow capability registry disables them', () => {
  const bundle = [
    extractFunction('normalizePlusPaymentMethod'),
    extractFunction('normalizePlusAccountAccessStrategy'),
    extractFunction('getSelectedPlusPaymentMethod'),
    extractFunction('getRequestedPlusAccountAccessStrategy'),
    extractFunction('normalizeGpcHelperPhoneModeValue'),
    extractFunction('getGpcHelperAutoModeEnabled'),
    extractFunction('normalizeGpcAutoModePermissionValue'),
    extractFunction('getGpcAutoModePermissionFromPayload'),
    extractFunction('shouldPreserveSelectedGpcAutoMode'),
    extractFunction('hasGpcAutoModePermissionField'),
    extractFunction('isGpcAutoModePermissionDenied'),
    extractFunction('normalizeGpcOtpChannelValue'),
    extractFunction('updatePlusModeUI'),
  ].join('\n');

  const api = new Function(`
const window = {
  MultiPageFlowCapabilities: {
    createFlowCapabilityRegistry() {
      return {
        resolveSidepanelCapabilities() {
          return {
            canShowPlusSettings: false,
            runtimeLocks: { plusModeEnabled: false },
          };
        },
      };
    },
  },
};
let latestState = { plusPaymentMethod: 'paypal' };
let currentPlusAccountAccessStrategy = 'oauth';
const inputPlusModeEnabled = { checked: true };
const rowPlusMode = { style: { display: '' } };
const selectPlusPaymentMethod = { value: 'paypal', style: { display: '' } };
const rowPlusPaymentMethod = { style: { display: '' } };
const rowPayPalAccount = { style: { display: '' } };
const GPC_HELPER_PHONE_MODE_AUTO = 'auto';
const GPC_HELPER_PHONE_MODE_MANUAL = 'manual';
const PLUS_ACCOUNT_ACCESS_STRATEGY_OAUTH = 'oauth';
const PLUS_ACCOUNT_ACCESS_STRATEGY_SUB2API_CODEX_SESSION = 'sub2api_codex_session';
const PLUS_ACCOUNT_ACCESS_STRATEGY_CPA_CODEX_SESSION = 'cpa_codex_session';
const DEFAULT_PLUS_ACCOUNT_ACCESS_STRATEGY = PLUS_ACCOUNT_ACCESS_STRATEGY_OAUTH;
${bundle}
return {
  rowPlusMode,
  rowPlusPaymentMethod,
  rowPayPalAccount,
  selectPlusPaymentMethod,
  updatePlusModeUI,
};
`)();

  api.updatePlusModeUI();

  assert.equal(api.rowPlusMode.style.display, 'none');
  assert.equal(api.rowPlusPaymentMethod.style.display, 'none');
  assert.equal(api.rowPayPalAccount.style.display, 'none');
  assert.equal(api.selectPlusPaymentMethod.style.display, 'none');
});

test('sidepanel step definitions keep GPC helper mode distinct', () => {
  const bundle = [
    extractFunction('normalizeSignupMethod'),
    extractFunction('normalizePlusPaymentMethod'),
    extractFunction('normalizePlusAccountAccessStrategy'),
    extractFunction('getStepDefinitionsForMode'),
    extractFunction('rebuildStepDefinitionState'),
    extractFunction('syncStepDefinitionsForMode'),
  ].join('\n');

  const api = new Function(`
const calls = [];
const window = {
  MultiPageStepDefinitions: {
    getSteps(options) {
      calls.push({ type: 'getSteps', options });
      return [{ id: options.plusPaymentMethod === 'gpc-helper' ? 13 : 6, order: 1 }];
    },
  },
};
let currentPlusModeEnabled = false;
let currentPlusPaymentMethod = 'paypal';
const PLUS_ACCOUNT_ACCESS_STRATEGY_OAUTH = 'oauth';
const PLUS_ACCOUNT_ACCESS_STRATEGY_SUB2API_CODEX_SESSION = 'sub2api_codex_session';
const PLUS_ACCOUNT_ACCESS_STRATEGY_CPA_CODEX_SESSION = 'cpa_codex_session';
const DEFAULT_PLUS_ACCOUNT_ACCESS_STRATEGY = PLUS_ACCOUNT_ACCESS_STRATEGY_OAUTH;
let currentPlusAccountAccessStrategy = DEFAULT_PLUS_ACCOUNT_ACCESS_STRATEGY;
let currentSignupMethod = 'email';
let currentPhoneVerificationEnabled = false;
let currentPhoneSignupReloginAfterBindEmailEnabled = false;
const DEFAULT_SIGNUP_METHOD = 'email';
let stepDefinitions = [];
let STEP_IDS = [];
let STEP_DEFAULT_STATUSES = {};
let SKIPPABLE_STEPS = new Set();
function renderStepsList() {
  calls.push({ type: 'render', stepIds: [...STEP_IDS] });
}
${bundle}
return {
  calls,
  syncStepDefinitionsForMode,
  getCurrentPlusPaymentMethod: () => currentPlusPaymentMethod,
  getStepIds: () => [...STEP_IDS],
};
`)();

  api.syncStepDefinitionsForMode(true, 'gpc-helper', { render: true });

  assert.equal(api.getCurrentPlusPaymentMethod(), 'gpc-helper');
  assert.deepEqual(api.getStepIds(), [13]);
  assert.deepEqual(api.calls[0], {
    type: 'getSteps',
    options: { activeFlowId: 'openai', plusModeEnabled: true, plusPaymentMethod: 'gpc-helper', plusAccountAccessStrategy: 'oauth', signupMethod: 'email', phoneVerificationEnabled: false, phoneSignupReloginAfterBindEmailEnabled: false, accountContributionEnabled: false },
  });
});

test('sidepanel Plus UI shows GPC fields and purchase button only for GPC', () => {
  const bundle = [
    extractFunction('normalizePlusPaymentMethod'),
    extractFunction('normalizePlusAccountAccessStrategy'),
    extractFunction('getSelectedPlusPaymentMethod'),
    extractFunction('getRequestedPlusAccountAccessStrategy'),
    extractFunction('normalizeGpcHelperPhoneModeValue'),
    extractFunction('getGpcHelperAutoModeEnabled'),
    extractFunction('normalizeGpcAutoModePermissionValue'),
    extractFunction('getGpcAutoModePermissionFromPayload'),
    extractFunction('shouldPreserveSelectedGpcAutoMode'),
    extractFunction('hasGpcAutoModePermissionField'),
    extractFunction('isGpcAutoModePermissionDenied'),
    extractFunction('normalizeGpcOtpChannelValue'),
    extractFunction('updatePlusModeUI'),
  ].join('\n');

  const api = new Function(`
let latestState = { plusPaymentMethod: 'gpc-helper', gopayHelperAutoModeEnabled: true };
let currentPlusPaymentMethod = 'paypal';
let currentPlusAccountAccessStrategy = 'oauth';
const inputPlusModeEnabled = { checked: true };
const selectPlusPaymentMethod = { value: 'gpc-helper', style: { display: 'none' } };
const GPC_HELPER_PHONE_MODE_AUTO = 'auto';
const GPC_HELPER_PHONE_MODE_MANUAL = 'manual';
const PLUS_ACCOUNT_ACCESS_STRATEGY_OAUTH = 'oauth';
const PLUS_ACCOUNT_ACCESS_STRATEGY_SUB2API_CODEX_SESSION = 'sub2api_codex_session';
const PLUS_ACCOUNT_ACCESS_STRATEGY_CPA_CODEX_SESSION = 'cpa_codex_session';
const DEFAULT_PLUS_ACCOUNT_ACCESS_STRATEGY = PLUS_ACCOUNT_ACCESS_STRATEGY_OAUTH;
const plusPaymentMethodCaption = { textContent: '' };
const btnGpcCardKeyPurchase = { style: { display: 'none' } };
const rowPayPalAccount = { style: { display: '' } };
const rowPlusPaymentMethod = { style: { display: 'none' } };
const rowGpcHelperApi = { style: { display: 'none' } };
const rowGpcHelperCardKey = { style: { display: 'none' } };
const rowGpcHelperPhoneMode = { style: { display: 'none' } };
const selectGpcHelperPhoneMode = { value: 'manual' };
const rowGpcHelperCountryCode = { style: { display: 'none' } };
const rowGpcHelperPhone = { style: { display: 'none' } };
const rowGpcHelperOtpChannel = { style: { display: 'none' } };
const selectGpcHelperOtpChannel = { value: 'whatsapp' };
const rowGpcHelperLocalSmsEnabled = { style: { display: 'none' } };
const inputGpcHelperLocalSmsEnabled = { checked: false };
const rowGpcHelperLocalSmsUrl = { style: { display: 'none' } };
const rowGpcHelperPin = { style: { display: 'none' } };
const rowGoPayCountryCode = { style: { display: 'none' } };
const rowGoPayPhone = { style: { display: 'none' } };
const rowGoPayOtp = { style: { display: 'none' } };
const rowGoPayPin = { style: { display: 'none' } };
${bundle}
return {
  updatePlusModeUI,
  selectPlusPaymentMethod,
  selectGpcHelperPhoneMode,
  selectGpcHelperOtpChannel,
  inputGpcHelperLocalSmsEnabled,
  btnGpcCardKeyPurchase,
  rowPayPalAccount,
  plusPaymentMethodCaption,
  rows: { rowGpcHelperApi, rowGpcHelperCardKey, rowGpcHelperPhoneMode, rowGpcHelperCountryCode, rowGpcHelperPhone, rowGpcHelperOtpChannel, rowGpcHelperLocalSmsEnabled, rowGpcHelperLocalSmsUrl, rowGpcHelperPin },
};
`)();

  api.updatePlusModeUI();

  assert.equal(api.rowPayPalAccount.style.display, 'none');
  assert.equal(api.btnGpcCardKeyPurchase.style.display, '');
  assert.equal(api.rows.rowGpcHelperApi.style.display, '');
  assert.equal(api.rows.rowGpcHelperCardKey.style.display, '');
  assert.equal(api.rows.rowGpcHelperPhoneMode.style.display, '');
  assert.equal(api.rows.rowGpcHelperPhone.style.display, '');
  assert.equal(api.rows.rowGpcHelperOtpChannel.style.display, '');
  assert.equal(api.rows.rowGpcHelperLocalSmsEnabled.style.display, '');
  assert.equal(api.rows.rowGpcHelperLocalSmsUrl.style.display, 'none');
  assert.match(api.plusPaymentMethodCaption.textContent, /GPC/);

  api.inputGpcHelperLocalSmsEnabled.checked = true;
  api.updatePlusModeUI();
  assert.equal(api.selectGpcHelperOtpChannel.value, 'whatsapp');
  assert.equal(api.rows.rowGpcHelperLocalSmsUrl.style.display, '');

  api.selectGpcHelperOtpChannel.value = 'sms';
  api.updatePlusModeUI();
  assert.equal(api.inputGpcHelperLocalSmsEnabled.checked, true);
  assert.equal(api.rows.rowGpcHelperLocalSmsEnabled.style.display, '');
  assert.equal(api.rows.rowGpcHelperLocalSmsUrl.style.display, '');

  api.selectGpcHelperPhoneMode.value = 'auto';
  api.updatePlusModeUI();
  assert.equal(api.rows.rowGpcHelperPhoneMode.style.display, '');
  assert.equal(api.rows.rowGpcHelperPhone.style.display, 'none');
  assert.equal(api.rows.rowGpcHelperOtpChannel.style.display, 'none');
  assert.equal(api.rows.rowGpcHelperLocalSmsEnabled.style.display, 'none');
  assert.equal(api.rows.rowGpcHelperLocalSmsUrl.style.display, 'none');
  assert.match(api.plusPaymentMethodCaption.textContent, /自动/);

  api.selectPlusPaymentMethod.value = 'gopay';
  api.updatePlusModeUI();
  assert.equal(api.btnGpcCardKeyPurchase.style.display, 'none');
  assert.equal(api.rows.rowGpcHelperApi.style.display, 'none');
  assert.equal(api.rowPayPalAccount.style.display, 'none');
});

test('sidepanel keeps selected GPC auto mode when API Key has no auto permission', () => {
  const bundle = [
    extractFunction('normalizePlusPaymentMethod'),
    extractFunction('normalizePlusAccountAccessStrategy'),
    extractFunction('getSelectedPlusPaymentMethod'),
    extractFunction('getRequestedPlusAccountAccessStrategy'),
    extractFunction('normalizeGpcHelperPhoneModeValue'),
    extractFunction('getGpcHelperAutoModeEnabled'),
    extractFunction('normalizeGpcAutoModePermissionValue'),
    extractFunction('getGpcAutoModePermissionFromPayload'),
    extractFunction('shouldPreserveSelectedGpcAutoMode'),
    extractFunction('hasGpcAutoModePermissionField'),
    extractFunction('isGpcAutoModePermissionDenied'),
    extractFunction('normalizeGpcOtpChannelValue'),
    extractFunction('updatePlusModeUI'),
  ].join('\n');

  const api = new Function(`
let latestState = { plusPaymentMethod: 'gpc-helper', gopayHelperPhoneMode: 'auto', gopayHelperAutoModeEnabled: false, gopayHelperBalancePayload: { auto_mode_enabled: false } };
let currentPlusPaymentMethod = 'gpc-helper';
let currentPlusAccountAccessStrategy = 'oauth';
const inputPlusModeEnabled = { checked: true };
const selectPlusPaymentMethod = { value: 'gpc-helper', style: { display: 'none' } };
const GPC_HELPER_PHONE_MODE_AUTO = 'auto';
const GPC_HELPER_PHONE_MODE_MANUAL = 'manual';
const PLUS_ACCOUNT_ACCESS_STRATEGY_OAUTH = 'oauth';
const PLUS_ACCOUNT_ACCESS_STRATEGY_SUB2API_CODEX_SESSION = 'sub2api_codex_session';
const PLUS_ACCOUNT_ACCESS_STRATEGY_CPA_CODEX_SESSION = 'cpa_codex_session';
const DEFAULT_PLUS_ACCOUNT_ACCESS_STRATEGY = PLUS_ACCOUNT_ACCESS_STRATEGY_OAUTH;
const plusPaymentMethodCaption = { textContent: '' };
const btnGpcCardKeyPurchase = { style: { display: 'none' } };
const rowPayPalAccount = { style: { display: '' } };
const rowPlusPaymentMethod = { style: { display: 'none' } };
const rowGpcHelperApi = { style: { display: 'none' } };
const rowGpcHelperCardKey = { style: { display: 'none' } };
const rowGpcHelperPhoneMode = { style: { display: 'none' } };
const selectGpcHelperPhoneMode = { value: 'auto' };
const rowGpcHelperCountryCode = { style: { display: 'none' } };
const rowGpcHelperPhone = { style: { display: 'none' } };
const rowGpcHelperOtpChannel = { style: { display: 'none' } };
const selectGpcHelperOtpChannel = { value: 'whatsapp' };
const rowGpcHelperLocalSmsEnabled = { style: { display: 'none' } };
const inputGpcHelperLocalSmsEnabled = { checked: false };
const rowGpcHelperLocalSmsUrl = { style: { display: 'none' } };
const rowGpcHelperPin = { style: { display: 'none' } };
${bundle}
return { updatePlusModeUI, selectGpcHelperPhoneMode, plusPaymentMethodCaption, rows: { rowGpcHelperPhoneMode, rowGpcHelperPhone, rowGpcHelperOtpChannel, rowGpcHelperPin } };
`)();

  api.updatePlusModeUI();

  assert.equal(api.rows.rowGpcHelperPhoneMode.style.display, '');
  assert.equal(api.selectGpcHelperPhoneMode.value, 'auto');
  assert.equal(api.rows.rowGpcHelperPhone.style.display, 'none');
  assert.equal(api.rows.rowGpcHelperOtpChannel.style.display, 'none');
  assert.equal(api.rows.rowGpcHelperPin.style.display, 'none');
  assert.match(api.plusPaymentMethodCaption.textContent, /手动/);
});

test('sidepanel keeps selected GPC auto mode when persisted permission survives stop refresh', () => {
  const bundle = [
    extractFunction('normalizePlusPaymentMethod'),
    extractFunction('normalizePlusAccountAccessStrategy'),
    extractFunction('getSelectedPlusPaymentMethod'),
    extractFunction('getRequestedPlusAccountAccessStrategy'),
    extractFunction('normalizeGpcHelperPhoneModeValue'),
    extractFunction('getGpcHelperAutoModeEnabled'),
    extractFunction('normalizeGpcAutoModePermissionValue'),
    extractFunction('getGpcAutoModePermissionFromPayload'),
    extractFunction('shouldPreserveSelectedGpcAutoMode'),
    extractFunction('hasGpcAutoModePermissionField'),
    extractFunction('isGpcAutoModePermissionDenied'),
    extractFunction('normalizeGpcOtpChannelValue'),
    extractFunction('updatePlusModeUI'),
  ].join('\n');

  const api = new Function(`
let latestState = {
  plusPaymentMethod: 'gpc-helper',
  gopayHelperPhoneMode: 'auto',
  gopayHelperAutoModeEnabled: true,
  gopayHelperBalancePayload: { auto_mode_enabled: true },
};
let currentPlusPaymentMethod = 'gpc-helper';
let currentPlusAccountAccessStrategy = 'oauth';
const inputPlusModeEnabled = { checked: true };
const selectPlusPaymentMethod = { value: 'gpc-helper', style: { display: 'none' } };
const GPC_HELPER_PHONE_MODE_AUTO = 'auto';
const GPC_HELPER_PHONE_MODE_MANUAL = 'manual';
const PLUS_ACCOUNT_ACCESS_STRATEGY_OAUTH = 'oauth';
const PLUS_ACCOUNT_ACCESS_STRATEGY_SUB2API_CODEX_SESSION = 'sub2api_codex_session';
const PLUS_ACCOUNT_ACCESS_STRATEGY_CPA_CODEX_SESSION = 'cpa_codex_session';
const DEFAULT_PLUS_ACCOUNT_ACCESS_STRATEGY = PLUS_ACCOUNT_ACCESS_STRATEGY_OAUTH;
const plusPaymentMethodCaption = { textContent: '' };
const rowPayPalAccount = { style: { display: '' } };
const rowPlusPaymentMethod = { style: { display: 'none' } };
const rowGpcHelperApi = { style: { display: 'none' } };
const rowGpcHelperCardKey = { style: { display: 'none' } };
const rowGpcHelperPhoneMode = { style: { display: 'none' } };
const selectGpcHelperPhoneMode = { value: 'auto' };
const rowGpcHelperCountryCode = { style: { display: 'none' } };
const rowGpcHelperPhone = { style: { display: 'none' } };
const rowGpcHelperOtpChannel = { style: { display: 'none' } };
const selectGpcHelperOtpChannel = { value: 'whatsapp' };
const rowGpcHelperLocalSmsEnabled = { style: { display: 'none' } };
const inputGpcHelperLocalSmsEnabled = { checked: false };
const rowGpcHelperLocalSmsUrl = { style: { display: 'none' } };
const rowGpcHelperPin = { style: { display: 'none' } };
${bundle}
function syncLatestState(nextState) { latestState = { ...latestState, ...nextState }; }
return {
  updatePlusModeUI,
  selectGpcHelperPhoneMode,
  getSelectedPhoneMode() { return selectGpcHelperPhoneMode.value; },
  getPayloadPhoneMode() {
    return (() => {
      return normalizeGpcHelperPhoneModeValue(selectGpcHelperPhoneMode.value);
    })();
  },
  applyDataUpdated(payload) {
    syncLatestState(payload);
    if (payload.gopayHelperPhoneMode !== undefined) {
      selectGpcHelperPhoneMode.value = normalizeGpcHelperPhoneModeValue(payload.gopayHelperPhoneMode);
    }
    updatePlusModeUI();
  },
  rows: { rowGpcHelperPhoneMode, rowGpcHelperPhone, rowGpcHelperOtpChannel, rowGpcHelperPin },
};
`)();

  api.updatePlusModeUI();
  assert.equal(api.getSelectedPhoneMode(), 'auto');
  assert.equal(api.getPayloadPhoneMode(), 'auto');
  assert.equal(api.rows.rowGpcHelperPhoneMode.style.display, '');
  assert.equal(api.rows.rowGpcHelperPhone.style.display, 'none');

  api.applyDataUpdated({
    autoRunning: false,
    autoRunPhase: 'stopped',
    gopayHelperAutoModeEnabled: false,
  });

  assert.equal(api.getSelectedPhoneMode(), 'auto');
  assert.equal(api.getPayloadPhoneMode(), 'auto');
  assert.equal(api.rows.rowGpcHelperPhone.style.display, 'none');
});

test('sidepanel keeps selected GPC auto mode before permission has been queried', () => {
  const bundle = [
    extractFunction('normalizePlusPaymentMethod'),
    extractFunction('normalizePlusAccountAccessStrategy'),
    extractFunction('getSelectedPlusPaymentMethod'),
    extractFunction('getRequestedPlusAccountAccessStrategy'),
    extractFunction('normalizeGpcHelperPhoneModeValue'),
    extractFunction('getGpcHelperAutoModeEnabled'),
    extractFunction('normalizeGpcAutoModePermissionValue'),
    extractFunction('getGpcAutoModePermissionFromPayload'),
    extractFunction('shouldPreserveSelectedGpcAutoMode'),
    extractFunction('hasGpcAutoModePermissionField'),
    extractFunction('isGpcAutoModePermissionDenied'),
    extractFunction('normalizeGpcOtpChannelValue'),
    extractFunction('updatePlusModeUI'),
  ].join('\n');

  const api = new Function(`
let latestState = { plusPaymentMethod: 'gpc-helper', gopayHelperPhoneMode: 'auto', gopayHelperAutoModeEnabled: false, gopayHelperBalancePayload: null };
let currentPlusPaymentMethod = 'gpc-helper';
let currentPlusAccountAccessStrategy = 'oauth';
const inputPlusModeEnabled = { checked: true };
const selectPlusPaymentMethod = { value: 'gpc-helper', style: { display: 'none' } };
const GPC_HELPER_PHONE_MODE_AUTO = 'auto';
const GPC_HELPER_PHONE_MODE_MANUAL = 'manual';
const PLUS_ACCOUNT_ACCESS_STRATEGY_OAUTH = 'oauth';
const PLUS_ACCOUNT_ACCESS_STRATEGY_SUB2API_CODEX_SESSION = 'sub2api_codex_session';
const PLUS_ACCOUNT_ACCESS_STRATEGY_CPA_CODEX_SESSION = 'cpa_codex_session';
const DEFAULT_PLUS_ACCOUNT_ACCESS_STRATEGY = PLUS_ACCOUNT_ACCESS_STRATEGY_OAUTH;
const plusPaymentMethodCaption = { textContent: '' };
const rowPayPalAccount = { style: { display: '' } };
const rowPlusPaymentMethod = { style: { display: 'none' } };
const rowGpcHelperApi = { style: { display: 'none' } };
const rowGpcHelperCardKey = { style: { display: 'none' } };
const rowGpcHelperPhoneMode = { style: { display: 'none' } };
const selectGpcHelperPhoneMode = { value: 'auto' };
const rowGpcHelperCountryCode = { style: { display: 'none' } };
const rowGpcHelperPhone = { style: { display: 'none' } };
const rowGpcHelperOtpChannel = { style: { display: 'none' } };
const selectGpcHelperOtpChannel = { value: 'whatsapp' };
const rowGpcHelperLocalSmsEnabled = { style: { display: 'none' } };
const inputGpcHelperLocalSmsEnabled = { checked: false };
const rowGpcHelperLocalSmsUrl = { style: { display: 'none' } };
const rowGpcHelperPin = { style: { display: 'none' } };
${bundle}
return { updatePlusModeUI, selectGpcHelperPhoneMode, plusPaymentMethodCaption, rows: { rowGpcHelperPhoneMode, rowGpcHelperPhone, rowGpcHelperOtpChannel, rowGpcHelperPin } };
`)();

  api.updatePlusModeUI();

  assert.equal(api.rows.rowGpcHelperPhoneMode.style.display, '');
  assert.equal(api.selectGpcHelperPhoneMode.value, 'auto');
  assert.equal(api.rows.rowGpcHelperPhone.style.display, 'none');
  assert.equal(api.rows.rowGpcHelperOtpChannel.style.display, 'none');
  assert.equal(api.rows.rowGpcHelperPin.style.display, 'none');
  assert.match(api.plusPaymentMethodCaption.textContent, /自动/);
});

test('sidepanel start check keeps GPC auto mode when balance payload omits permission field', async () => {
  const bundle = [
    extractFunction('normalizeGpcAutoModePermissionValue'),
    extractFunction('getGpcAutoModePermissionFromPayload'),
    extractFunction('isGpcAutoModePermissionDenied'),
    extractFunction('normalizeGpcRemainingUsesValue'),
    extractFunction('ensureGpcApiKeyReadyForStart'),
  ].join('\n');

  const api = new Function(`
let latestState = { gopayHelperPhoneMode: 'auto' };
const GPC_HELPER_PHONE_MODE_AUTO = 'auto';
const GPC_HELPER_PHONE_MODE_MANUAL = 'manual';
const selectGpcHelperPhoneMode = { value: 'auto' };
const dialogs = [];
let saveCalls = 0;
let updateCalls = 0;
${bundle}
function isGpcHelperCheckoutSelected() { return true; }
function getSelectedGpcHelperPhoneMode() { return selectGpcHelperPhoneMode.value; }
async function refreshGpcBalanceForStart() {
  return {
    gopayHelperRemainingUses: 998,
    gopayHelperApiKeyStatus: 'active',
    gopayHelperAutoModeEnabled: false,
    gopayHelperBalancePayload: {
      status: 'active',
      remaining_uses: 998,
    },
  };
}
async function showGpcStartBlockedDialog(message) {
  dialogs.push(message);
}
function syncLatestState(nextState) {
  latestState = { ...latestState, ...nextState };
}
function updatePlusModeUI() {
  updateCalls += 1;
}
async function saveSettings() {
  saveCalls += 1;
}
function showToast() {}
return {
  ensureGpcApiKeyReadyForStart,
  selectGpcHelperPhoneMode,
  getDialogs: () => dialogs.slice(),
  getSaveCalls: () => saveCalls,
  getUpdateCalls: () => updateCalls,
  getPersistedPhoneMode: () => latestState.gopayHelperPhoneMode,
};
`)();

  const allowed = await api.ensureGpcApiKeyReadyForStart();

  assert.equal(allowed, true);
  assert.equal(api.selectGpcHelperPhoneMode.value, 'auto');
  assert.equal(api.getPersistedPhoneMode(), 'auto');
  assert.equal(api.getSaveCalls(), 0);
  assert.equal(api.getUpdateCalls(), 0);
  assert.deepEqual(api.getDialogs(), []);
});

test('sidepanel start check blocks unsupported GPC auto mode without rewriting selection', async () => {
  const bundle = [
    extractFunction('normalizeGpcAutoModePermissionValue'),
    extractFunction('getGpcAutoModePermissionFromPayload'),
    extractFunction('isGpcAutoModePermissionDenied'),
    extractFunction('normalizeGpcRemainingUsesValue'),
    extractFunction('ensureGpcApiKeyReadyForStart'),
  ].join('\n');

  const api = new Function(`
let latestState = { gopayHelperPhoneMode: 'auto' };
const GPC_HELPER_PHONE_MODE_AUTO = 'auto';
const GPC_HELPER_PHONE_MODE_MANUAL = 'manual';
const selectGpcHelperPhoneMode = { value: 'auto' };
const dialogs = [];
let saveCalls = 0;
let updateCalls = 0;
${bundle}
function isGpcHelperCheckoutSelected() { return true; }
function getSelectedGpcHelperPhoneMode() { return selectGpcHelperPhoneMode.value; }
async function refreshGpcBalanceForStart() {
  return {
    gopayHelperRemainingUses: 998,
    gopayHelperApiKeyStatus: 'active',
    gopayHelperAutoModeEnabled: false,
    gopayHelperBalancePayload: {
      status: 'active',
      remaining_uses: 998,
      auto_mode_enabled: false,
    },
  };
}
async function showGpcStartBlockedDialog(message) {
  dialogs.push(message);
}
function syncLatestState(nextState) {
  latestState = { ...latestState, ...nextState };
}
function updatePlusModeUI() {
  updateCalls += 1;
}
async function saveSettings() {
  saveCalls += 1;
}
function showToast() {}
return {
  ensureGpcApiKeyReadyForStart,
  selectGpcHelperPhoneMode,
  getDialogs: () => dialogs.slice(),
  getSaveCalls: () => saveCalls,
  getUpdateCalls: () => updateCalls,
  getPersistedPhoneMode: () => latestState.gopayHelperPhoneMode,
};
`)();

  const allowed = await api.ensureGpcApiKeyReadyForStart();

  assert.equal(allowed, false);
  assert.equal(api.selectGpcHelperPhoneMode.value, 'auto');
  assert.equal(api.getPersistedPhoneMode(), 'auto');
  assert.equal(api.getSaveCalls(), 0);
  assert.equal(api.getUpdateCalls(), 0);
  assert.equal(api.getDialogs().length, 1);
});

test('sidepanel resolves pending GoPay manual confirmation from DATA_UPDATED state', async () => {
  const bundle = [
    extractFunction('openPlusManualConfirmationDialog'),
    extractFunction('syncPlusManualConfirmationDialog'),
  ].join('\n');

  const api = new Function(`
const events = [];
let latestState = {
  activeFlowId: 'openai',
  plusManualConfirmationPending: true,
  plusManualConfirmationRequestId: 'gopay-request-1',
  plusManualConfirmationStep: 7,
  plusManualConfirmationMethod: 'gopay',
  plusManualConfirmationTitle: 'GoPay 订阅确认',
  plusManualConfirmationMessage: '请确认订阅。',
};
let activePlusManualConfirmationRequestId = '';
let plusManualConfirmationDialogInFlight = false;
function openActionModal(options) {
  events.push({ type: 'modal', options });
  return Promise.resolve('confirm');
}
function showToast(message, tone) {
  events.push({ type: 'toast', message, tone });
}
const chrome = {
  runtime: {
    async sendMessage(message) {
      events.push({ type: 'send', message });
      latestState = {
        ...latestState,
        plusManualConfirmationPending: false,
      };
      return { ok: true };
    },
  },
};
${bundle}
return { events, syncPlusManualConfirmationDialog };
`)();

  await api.syncPlusManualConfirmationDialog();

  assert.equal(api.events[0].type, 'modal');
  assert.equal(api.events[0].options.title, 'GoPay 订阅确认');
  assert.deepEqual(api.events[1], {
    type: 'send',
    message: {
      type: 'RESOLVE_PLUS_MANUAL_CONFIRMATION',
      source: 'sidepanel',
      payload: {
        step: 7,
        requestId: 'gopay-request-1',
        confirmed: true,
      },
    },
  });
  assert.match(api.events[2].message, /GoPay/);
  assert.equal(api.events[2].tone, 'info');
});

test('sidepanel resolves pending GPC OTP with typed code', async () => {
  const bundle = [
    extractFunction('normalizeSignupMethod'),
    extractFunction('normalizePlusAccountAccessStrategy'),
    extractFunction('normalizePlusStrategyTargetId'),
    extractFunction('getPlusAccountAccessStrategyContinuationLabel'),
    extractFunction('resolvePlusManualContinuationActionLabelFromState'),
    extractLastFunction('openPlusManualConfirmationDialog'),
    extractLastFunction('syncPlusManualConfirmationDialog'),
  ].join('\n');

  const api = new Function(`
const events = [];
let latestState = {
  plusManualConfirmationPending: true,
  plusManualConfirmationRequestId: 'otp-request-1',
  plusManualConfirmationStep: 7,
  plusManualConfirmationMethod: 'gopay-otp',
  plusManualConfirmationTitle: 'GPC OTP 验证',
  plusManualConfirmationMessage: '',
};
let activePlusManualConfirmationRequestId = '';
let plusManualConfirmationDialogInFlight = false;
const DEFAULT_ACTIVE_FLOW_ID = 'openai';
const SIGNUP_METHOD_EMAIL = 'email';
const SIGNUP_METHOD_PHONE = 'phone';
const DEFAULT_SIGNUP_METHOD = 'email';
const PLUS_ACCOUNT_ACCESS_STRATEGY_OAUTH = 'oauth';
const PLUS_ACCOUNT_ACCESS_STRATEGY_SUB2API_CODEX_SESSION = 'sub2api_codex_session';
const PLUS_ACCOUNT_ACCESS_STRATEGY_CPA_CODEX_SESSION = 'cpa_codex_session';
const DEFAULT_PLUS_ACCOUNT_ACCESS_STRATEGY = 'oauth';
const sharedFormDialog = {
  async open(options) {
    events.push({ type: 'form', options });
    return { otp: ' 12-34 56 ' };
  },
};
function openActionModal(options) {
  events.push({ type: 'modal', options });
  return Promise.resolve('confirm');
}
function showToast(message, tone) {
  events.push({ type: 'toast', message, tone });
}
const chrome = {
  runtime: {
    async sendMessage(message) {
      events.push({ type: 'send', message });
      latestState = { ...latestState, plusManualConfirmationPending: false };
      return { ok: true };
    },
  },
};
${bundle}
return { events, syncPlusManualConfirmationDialog };
`)();

  await api.syncPlusManualConfirmationDialog();

  assert.equal(api.events[0].type, 'form');
  assert.equal(api.events[0].options.message, '请在WhatsApp里面获取验证码（耐心等待三十秒左右）');
  assert.equal(api.events[0].options.confirmLabel, '提交 OTP');
  const sendEvent = api.events.find((event) => event.type === 'send');
  assert.deepEqual(sendEvent.message.payload, {
    step: 7,
    requestId: 'otp-request-1',
    confirmed: true,
    otp: '123456',
  });
  assert.equal(api.events.some((event) => event.type === 'modal'), false);
});
