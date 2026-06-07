const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');

const sidepanelSource = fs.readFileSync('sidepanel/sidepanel.js', 'utf8');
const sidepanelHtml = fs.readFileSync('sidepanel/sidepanel.html', 'utf8');

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

test('sidepanel defaults Plus payment method to Auto', () => {
  assert.match(sidepanelSource, /const DEFAULT_PLUS_PAYMENT_METHOD = PLUS_PAYMENT_METHOD_AUTO;/);
  assert.match(sidepanelSource, /currentPlusPaymentMethod = DEFAULT_PLUS_PAYMENT_METHOD/);
  assert.match(sidepanelSource, /state\?\.plusPaymentMethod \|\| DEFAULT_PLUS_PAYMENT_METHOD/);
  assert.match(sidepanelHtml, /<option value="plus-auto" selected>Plus 自动充值<\/option>/);
});

test('sidepanel step definitions normalize legacy gopay payment method to PayPal', () => {
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
      return [{ id: options.plusPaymentMethod === 'paypal' ? 6 : 7, order: 1 }];
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

  assert.equal(api.getCurrentPlusPaymentMethod(), 'paypal');
  assert.deepEqual(api.getStepIds(), [6]);
  assert.deepEqual(api.calls[0], {
    type: 'getSteps',
    options: {
      activeFlowId: 'openai',
      targetId: '',
      plusModeEnabled: true,
      plusPaymentMethod: 'paypal',
      plusAccountAccessStrategy: 'oauth',
      openaiWebchatUploadEnabled: false,
      settingsState: undefined,
      signupMethod: 'email',
      phoneVerificationEnabled: false,
      phoneSignupReloginAfterBindEmailEnabled: false,
      accountContributionEnabled: false,
    },
  });
  assert.deepEqual(api.calls[1], { type: 'render', stepIds: [6] });
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

test('sidepanel Plus UI treats legacy gopay selection as PayPal', () => {
  const bundle = [
    extractFunction('normalizePlusPaymentMethod'),
    extractFunction('normalizePlusAccountAccessStrategy'),
    extractFunction('getSelectedPlusPaymentMethod'),
    extractFunction('getRequestedPlusAccountAccessStrategy'),
    extractFunction('updatePlusModeUI'),
  ].join('\n');

  const api = new Function(`
let latestState = { plusPaymentMethod: 'gopay' };
let currentPlusPaymentMethod = 'paypal';
let currentPlusAccountAccessStrategy = 'oauth';
const inputPlusModeEnabled = { checked: true };
const selectPlusPaymentMethod = { value: 'gopay', style: { display: 'none' } };
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
  assert.equal(api.selectPlusPaymentMethod.value, 'paypal');
  assert.equal(api.rowPayPalAccount.style.display, '');

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
    extractFunction('updatePlusModeUI'),
  ].join('\n');

  const api = new Function(`
let latestState = { plusPaymentMethod: 'paypal-hosted' };
let currentPlusPaymentMethod = 'paypal-hosted';
let currentPlusAccountAccessStrategy = 'oauth';
const inputPlusModeEnabled = { checked: true };
const selectPlusPaymentMethod = { value: 'paypal-hosted', style: { display: 'none' } };
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
    extractFunction('updatePlusModeUI'),
  ].join('\n');

  const api = new Function(`
let latestState = { plusPaymentMethod: 'none' };
let currentPlusPaymentMethod = 'none';
let currentPlusAccountAccessStrategy = 'sub2api_codex_session';
const inputPlusModeEnabled = { checked: true };
const selectPlusPaymentMethod = { value: 'none', style: { display: 'none' } };
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
const rowGpcCardKey = { style: { display: '' } };
${bundle}
return {
  updatePlusModeUI,
  plusPaymentMethodCaption,
  rows: {
    rowPayPalAccount,
    rowHostedCheckoutVerificationUrl,
    rowHostedCheckoutPhone,
    rowPlusHostedCheckoutOauthDelay,
    rowGpcCardKey,
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

test('sidepanel step definitions keep GPC payment mode distinct', () => {
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
    options: {
      activeFlowId: 'openai',
      targetId: '',
      plusModeEnabled: true,
      plusPaymentMethod: 'gpc-helper',
      plusAccountAccessStrategy: 'oauth',
      openaiWebchatUploadEnabled: false,
      settingsState: undefined,
      signupMethod: 'email',
      phoneVerificationEnabled: false,
      phoneSignupReloginAfterBindEmailEnabled: false,
      accountContributionEnabled: false,
    },
  });
});

test('sidepanel Plus UI shows GPC fields and purchase button only for GPC', () => {
  const bundle = [
    extractFunction('normalizePlusPaymentMethod'),
    extractFunction('normalizePlusAccountAccessStrategy'),
    extractFunction('getSelectedPlusPaymentMethod'),
    extractFunction('getRequestedPlusAccountAccessStrategy'),
    extractFunction('updatePlusModeUI'),
  ].join('\n');

  const api = new Function(`
let latestState = { plusPaymentMethod: 'gpc-helper' };
let currentPlusPaymentMethod = 'paypal';
let currentPlusAccountAccessStrategy = 'oauth';
const inputPlusModeEnabled = { checked: true };
const selectPlusPaymentMethod = { value: 'gpc-helper', style: { display: 'none' } };
const PLUS_ACCOUNT_ACCESS_STRATEGY_OAUTH = 'oauth';
const PLUS_ACCOUNT_ACCESS_STRATEGY_SUB2API_CODEX_SESSION = 'sub2api_codex_session';
const PLUS_ACCOUNT_ACCESS_STRATEGY_CPA_CODEX_SESSION = 'cpa_codex_session';
const DEFAULT_PLUS_ACCOUNT_ACCESS_STRATEGY = PLUS_ACCOUNT_ACCESS_STRATEGY_OAUTH;
const plusPaymentMethodCaption = { textContent: '' };
const btnGpcCardKeyPurchase = { style: { display: 'none' } };
const rowPayPalAccount = { style: { display: '' } };
const rowPlusPaymentMethod = { style: { display: 'none' } };
const rowGpcCardKey = { style: { display: 'none' } };
${bundle}
return {
  updatePlusModeUI,
  selectPlusPaymentMethod,
  btnGpcCardKeyPurchase,
  rowPayPalAccount,
  plusPaymentMethodCaption,
  rows: { rowGpcCardKey },
};
`)();

  api.updatePlusModeUI();

  assert.equal(api.rowPayPalAccount.style.display, 'none');
  assert.equal(api.btnGpcCardKeyPurchase.style.display, '');
  assert.equal(api.rows.rowGpcCardKey.style.display, '');
  assert.equal(api.plusPaymentMethodCaption.textContent, 'GPC 网页充值链路');

  api.selectPlusPaymentMethod.value = 'gopay';
  api.updatePlusModeUI();
  assert.equal(api.btnGpcCardKeyPurchase.style.display, 'none');
  assert.equal(api.rows.rowGpcCardKey.style.display, 'none');
  assert.equal(api.rowPayPalAccount.style.display, '');
});

test('sidepanel Plus UI shows auto-charge fields only for the auto payment method', () => {
  const bundle = [
    extractFunction('normalizePlusPaymentMethod'),
    extractFunction('normalizePlusAccountAccessStrategy'),
    extractFunction('getSelectedPlusPaymentMethod'),
    extractFunction('getRequestedPlusAccountAccessStrategy'),
    extractFunction('updatePlusModeUI'),
  ].join('\n');

  const api = new Function(`
let latestState = { plusPaymentMethod: 'plus-auto' };
let currentPlusPaymentMethod = 'paypal';
let currentPlusAccountAccessStrategy = 'oauth';
const inputPlusModeEnabled = { checked: true };
const selectPlusPaymentMethod = { value: 'plus-auto', style: { display: 'none' } };
const PLUS_PAYMENT_METHOD_AUTO = 'plus-auto';
const PLUS_ACCOUNT_ACCESS_STRATEGY_OAUTH = 'oauth';
const PLUS_ACCOUNT_ACCESS_STRATEGY_SUB2API_CODEX_SESSION = 'sub2api_codex_session';
const PLUS_ACCOUNT_ACCESS_STRATEGY_CPA_CODEX_SESSION = 'cpa_codex_session';
const DEFAULT_PLUS_ACCOUNT_ACCESS_STRATEGY = PLUS_ACCOUNT_ACCESS_STRATEGY_OAUTH;
const plusPaymentMethodCaption = { textContent: '' };
const rowPayPalAccount = { style: { display: '' } };
const rowGpcCardKey = { style: { display: '' } };
const rowAutoCdk = { style: { display: 'none' } };
const btnAutoCdkPurchase = { style: { display: 'none' } };
${bundle}
return {
  updatePlusModeUI,
  selectPlusPaymentMethod,
  plusPaymentMethodCaption,
  rows: { rowGpcCardKey, rowAutoCdk, rowPayPalAccount },
  btnAutoCdkPurchase,
};
`)();

  api.updatePlusModeUI();

  assert.equal(api.rows.rowAutoCdk.style.display, '');
  assert.equal(api.rows.rowGpcCardKey.style.display, 'none');
  assert.equal(api.rows.rowPayPalAccount.style.display, 'none');
  assert.equal(api.plusPaymentMethodCaption.textContent, '', 'Plus 自动充值不显示说明文字');
  assert.equal(api.btnAutoCdkPurchase.style.display, '', 'Plus 自动充值显示获取卡密按钮');

  api.selectPlusPaymentMethod.value = 'gpc-helper';
  api.updatePlusModeUI();
  assert.equal(api.rows.rowAutoCdk.style.display, 'none');
  assert.equal(api.btnAutoCdkPurchase.style.display, 'none', '非 Plus 自动充值隐藏获取卡密按钮');
  assert.equal(api.rows.rowGpcCardKey.style.display, '');
});

test('sidepanel HTML exposes the auto payment option and config rows', () => {
  assert.match(sidepanelHtml, /<option value="plus-auto" selected>Plus 自动充值<\/option>/);
  assert.match(sidepanelHtml, /id="row-auto-cdk"/);
  assert.match(sidepanelHtml, /id="input-auto-cdk"/);
  // Plus 自动充值接口地址固定内置，不在 UI 暴露。
  assert.doesNotMatch(sidepanelHtml, /id="input-auto-base-url"/);
  // 「获取卡密」按钮
  assert.match(sidepanelHtml, /id="btn-auto-cdk-purchase"[^>]*>获取卡密</);
});

test('sidepanel start check only requires a GPC card key', async () => {
  const bundle = [
    extractFunction('normalizeGpcCardKeyInput'),
    extractFunction('isGpcCardKeyInputFormat'),
    extractFunction('setGpcCardKeyStatus'),
    extractFunction('ensureGpcCardKeyReadyForStart'),
  ].join('\n');

  const api = new Function(`
let latestState = { gpcCardKey: '' };
const inputGpcCardKey = { value: '' };
const displayGpcCardKeyStatus = { textContent: '', dataset: {} };
const dialogs = [];
const toasts = [];
const window = { GpcUtils: null };
${bundle}
function isGpcHelperCheckoutSelected() { return true; }
async function showGpcStartBlockedDialog(message) {
  dialogs.push(message);
}
function showToast(message, type, duration) {
  toasts.push({ message, type, duration });
}
return {
  ensureGpcCardKeyReadyForStart,
  inputGpcCardKey,
  displayGpcCardKeyStatus,
  setLatestState(nextState) { latestState = { ...latestState, ...nextState }; },
  getDialogs: () => dialogs.slice(),
  getToasts: () => toasts.slice(),
};
`)();

  assert.equal(await api.ensureGpcCardKeyReadyForStart(), false);
  assert.deepEqual(api.getDialogs(), ['请先填写 GPC 卡密。']);

  api.inputGpcCardKey.value = ' card-key-1 ';
  assert.equal(await api.ensureGpcCardKeyReadyForStart(), false);
  assert.match(api.getDialogs()[1], /GPC/);
  assert.equal(api.displayGpcCardKeyStatus.dataset.tone, 'error');

  api.inputGpcCardKey.value = ' gpc-6c9f1a32-45734795-914e6f00 ';
  assert.equal(await api.ensureGpcCardKeyReadyForStart({ notify: true }), true);
  assert.equal(api.inputGpcCardKey.value, 'GPC-6C9F1A32-45734795-914E6F00');
  assert.deepEqual(api.getToasts(), [{ message: 'GPC 卡密已填写。', type: 'success', duration: 1800 }]);
});
