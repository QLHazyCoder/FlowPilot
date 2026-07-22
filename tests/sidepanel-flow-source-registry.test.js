const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');

const sidepanelSource = fs.readFileSync('sidepanel/sidepanel.js', 'utf8');
const sidepanelHtml = fs.readFileSync('sidepanel/sidepanel.html', 'utf8');

function stripHtmlComments(html) {
  return String(html || '').replace(/<!--[\s\S]*?-->/g, '');
}

function extractFunction(source, name) {
  const asyncStart = source.indexOf(`async function ${name}`);
  const normalStart = source.indexOf(`function ${name}`);
  const start = asyncStart !== -1
    ? asyncStart
    : normalStart;
  if (start === -1) {
    throw new Error(`Function ${name} not found`);
  }
  const signatureEnd = source.indexOf(')', start);
  const bodyStart = source.indexOf('{', signatureEnd);
  let depth = 0;
  let end = bodyStart;
  for (; end < source.length; end += 1) {
    const char = source[end];
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
  return source.slice(start, end);
}

test('sidepanel html exposes flow selector and kiro source fields', () => {
  const visibleHtml = stripHtmlComments(sidepanelHtml);
  [
    'id="select-flow"',
    '<option value="grok">Grok</option>',
    'id="label-source-selector"',
    'id="btn-open-target-repository"',
    'id="row-step6-cookie-settings"',
    'id="row-shared-auto-run"',
    'id="row-auto-run-thread-interval"',
    'id="row-oauth-callback"',
    'id="row-kiro-rs-url"',
    'id="row-kiro-rs-key"',
    'id="btn-test-kiro-rs"',
    'id="row-kiro-rs-test-status"',
    'id="row-kiro-web-status"',
    'id="row-kiro-login-url"',
    'id="row-kiro-upload-status"',
    'id="row-grok-register-status"',
    'id="row-grok-sso-status"',
    'id="row-grok-upload-status"',
    'id="display-grok-upload-status"',
    'id="row-grok-sso-settings"',
    'id="btn-copy-grok-sso"',
    'id="btn-clear-grok-sso"',
    'id="row-grok-sub2api-group"',
    'id="input-grok-sub2api-group"',
    'id="row-grok-sub2api-account-priority"',
    'id="input-grok-sub2api-account-priority"',
    'id="row-grok-sub2api-default-proxy"',
    'id="input-grok-sub2api-default-proxy"',
    'id="row-openai-webchat-url"',
    'id="input-openai-webchat-url"',
    'id="row-openai-webchat-key"',
    'id="input-openai-webchat-key"',
    'id="row-openai-webchat-upload-status"',
    'id="display-openai-webchat-upload-status"',
    'id="row-openai-chatgpt2api-url"',
    'id="input-openai-chatgpt2api-url"',
    'id="row-openai-chatgpt2api-key"',
    'id="input-openai-chatgpt2api-key"',
    'id="row-openai-chatgpt2api-upload-status"',
    'id="display-openai-chatgpt2api-upload-status"',
    '<script src="../flows/grok/index.js"></script>',
    '<script src="../flows/grok/workflow.js"></script>',
  ].forEach((snippet) => {
    assert.match(visibleHtml, new RegExp(snippet.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')));
  });
  assert.doesNotMatch(visibleHtml, /id="row-openai-webchat-upload-toggle"/);
  assert.doesNotMatch(visibleHtml, /id="input-openai-webchat-upload-enabled"/);
  assert.doesNotMatch(visibleHtml, /id="display-openai-webchat-upload-hint"/);
  assert.doesNotMatch(sidepanelHtml, /id="btn-export-grok-sso"/);
  assert.doesNotMatch(sidepanelHtml, /id="row-grok-webchat2api-upload-status"/);
  assert.match(
    sidepanelHtml,
    /id="btn-open-target-repository"[^>]*class="btn btn-outline btn-sm data-inline-btn"[^>]*>GitHub<\/button>/
  );
  const repositoryButtonTag = sidepanelHtml.match(/<button[^>]*id="btn-open-target-repository"[\s\S]*?<\/button>/)?.[0] || '';
  assert.doesNotMatch(repositoryButtonTag, /<svg/);
  assert.ok(
    sidepanelHtml.indexOf('<script src="../flows/kiro/workflow.js"></script>')
      < sidepanelHtml.indexOf('<script src="../flows/grok/index.js"></script>')
  );
  assert.ok(
    sidepanelHtml.indexOf('<script src="../flows/grok/workflow.js"></script>')
      < sidepanelHtml.indexOf('<script src="../flows/index.js"></script>')
  );
});

test('sidepanel Grok SSO clear action goes through background message instead of direct storage writes', () => {
  const clearButtonIndex = sidepanelSource.indexOf("btnClearGrokSso?.addEventListener('click'");
  assert.notEqual(clearButtonIndex, -1);
  const nextManagerIndex = sidepanelSource.indexOf('const hotmailManager', clearButtonIndex);
  assert.notEqual(nextManagerIndex, -1);
  const block = sidepanelSource.slice(clearButtonIndex, nextManagerIndex);

  assert.match(block, /type:\s*'CLEAR_GROK_SSO_COOKIES'/);
  assert.match(block, /chrome\.runtime\.sendMessage/);
  assert.doesNotMatch(block, /chrome\.storage/);
  assert.doesNotMatch(block, /storage\.local\.set/);
});

test('sidepanel renders target-aware Grok publish status from canonical runtime state', () => {
  const bundle = [
    extractFunction(sidepanelSource, 'getGrokRuntimeState'),
    extractFunction(sidepanelSource, 'normalizeGrokSsoCookies'),
    extractFunction(sidepanelSource, 'getGrokRegisterStatusLabel'),
    extractFunction(sidepanelSource, 'getGrokUploadStatusLabel'),
    extractFunction(sidepanelSource, 'renderGrokRuntimeState'),
  ].join('\n');

  const api = new Function(`
let latestState = {};
const displayGrokRegisterStatus = { textContent: '' };
const displayGrokSsoStatus = { textContent: '' };
const displayGrokSsoCookie = { textContent: '', title: '' };
const displayGrokUploadStatus = { textContent: '', title: '' };
const buttons = [];
const btnCopyGrokSso = { disabled: false };
const btnClearGrokSso = { disabled: false };
${bundle}
return {
  displayGrokRegisterStatus,
  displayGrokSsoStatus,
  displayGrokSsoCookie,
  displayGrokUploadStatus,
  btnCopyGrokSso,
  btnClearGrokSso,
  renderGrokRuntimeState,
};
`)();

  api.renderGrokRuntimeState({
    runtimeState: {
      flowState: {
        grok: {
          register: { status: 'completed' },
          sso: {
            currentCookie: '1234567890abcdef',
            cookies: ['1234567890abcdef', 'second-cookie'],
            extractedAt: 0,
          },
          upload: {
            targetId: 'webchat2api',
            status: 'uploaded',
            uploadedAt: 0,
            message: '上传成功',
            targetUrl: 'https://remote.example.com/api/remote-account/inject',
          },
        },
      },
    },
  });

  assert.equal(api.displayGrokRegisterStatus.textContent, '已完成');
  assert.match(api.displayGrokSsoStatus.textContent, /^已提取 2 条/);
  assert.equal(api.displayGrokSsoCookie.textContent, '12345678...abcdef');
  assert.equal(api.displayGrokUploadStatus.textContent, '已上传：上传成功');
  assert.equal(api.displayGrokUploadStatus.title, 'https://remote.example.com/api/remote-account/inject');
  assert.equal(api.btnCopyGrokSso.disabled, false);
  assert.equal(api.btnClearGrokSso.disabled, false);

  api.renderGrokRuntimeState({
    runtimeState: {
      flowState: {
        grok: {
          upload: {
            targetId: 'sub2api',
            status: 'creating',
            message: '',
            targetUrl: 'https://sub.example.com/api/v1/admin/grok/oauth/create-from-oauth',
          },
        },
      },
    },
  });
  assert.equal(api.displayGrokUploadStatus.textContent, '正在创建');
  assert.equal(api.displayGrokUploadStatus.title, 'https://sub.example.com/api/v1/admin/grok/oauth/create-from-oauth');
});

test('sidepanel project repository button resolves the configured target repositories', () => {
  assert.match(sidepanelSource, /cpa:\s*'https:\/\/github\.com\/router-for-me\/CLIProxyAPI'/);
  assert.match(sidepanelSource, /sub2api:\s*'https:\/\/github\.com\/Wei-Shaw\/sub2api'/);
  assert.match(sidepanelSource, /webchat:\s*'https:\/\/github\.com\/zqbxdev\/webchat2api'/);
  assert.match(sidepanelSource, /chatgpt2api:\s*'https:\/\/github\.com\/basketikun\/chatgpt2api'/);
  assert.match(sidepanelSource, /'kiro-rs':\s*'https:\/\/github\.com\/QLHazyCoder\/kiro\.rs'/);
  assert.match(sidepanelSource, /webchat2api:\s*'https:\/\/github\.com\/zqbxdev\/webchat2api'/);
  assert.match(sidepanelSource, /grok:[\s\S]*sub2api:\s*'https:\/\/github\.com\/Wei-Shaw\/sub2api'/);
  assert.doesNotMatch(sidepanelSource, /github\.com\/hank9999\/kiro\.rs/);
  assert.match(sidepanelSource, /btnOpenTargetRepository\?\.addEventListener\('click'/);
});

test('sidepanel target repository helper switches URLs by current flow target', () => {
  const bundle = [
    extractFunction(sidepanelSource, 'getTargetRepositoryUrl'),
  ].join('\n');

  const api = new Function(`
const TARGET_REPOSITORY_URLS = Object.freeze({
  openai: Object.freeze({
    cpa: 'https://github.com/router-for-me/CLIProxyAPI',
    sub2api: 'https://github.com/Wei-Shaw/sub2api',
    webchat: 'https://github.com/zqbxdev/webchat2api',
    chatgpt2api: 'https://github.com/basketikun/chatgpt2api',
  }),
  kiro: Object.freeze({
    'kiro-rs': 'https://github.com/QLHazyCoder/kiro.rs',
  }),
  grok: Object.freeze({
    webchat2api: 'https://github.com/zqbxdev/webchat2api',
    sub2api: 'https://github.com/Wei-Shaw/sub2api',
  }),
});
function normalizeFlowId(value) {
  return ['openai', 'kiro', 'grok'].includes(value) ? value : 'openai';
}
function getDefaultTargetIdForFlow(flowId) {
  return flowId === 'grok' ? 'webchat2api' : (flowId === 'kiro' ? 'kiro-rs' : 'cpa');
}
function normalizeTargetIdForFlow(flowId, targetId, fallback) {
  const targets = {
    openai: ['cpa', 'sub2api', 'codex2api', 'webchat', 'chatgpt2api'],
    kiro: ['kiro-rs'],
    grok: ['webchat2api', 'sub2api'],
  }[flowId] || [];
  return targets.includes(targetId) ? targetId : fallback;
}
function getSelectedFlowId() { return 'openai'; }
function getSelectedTargetId() { return 'cpa'; }
${bundle}
return { getTargetRepositoryUrl };
`)();

  assert.equal(api.getTargetRepositoryUrl('openai', 'cpa'), 'https://github.com/router-for-me/CLIProxyAPI');
  assert.equal(api.getTargetRepositoryUrl('openai', 'sub2api'), 'https://github.com/Wei-Shaw/sub2api');
  assert.equal(api.getTargetRepositoryUrl('openai', 'webchat'), 'https://github.com/zqbxdev/webchat2api');
  assert.equal(api.getTargetRepositoryUrl('openai', 'chatgpt2api'), 'https://github.com/basketikun/chatgpt2api');
  assert.equal(api.getTargetRepositoryUrl('grok', 'webchat2api'), 'https://github.com/zqbxdev/webchat2api');
  assert.equal(api.getTargetRepositoryUrl('grok', 'sub2api'), 'https://github.com/Wei-Shaw/sub2api');
  assert.equal(api.getTargetRepositoryUrl('openai', 'codex2api'), '');
});

test('sidepanel step definitions rerender when active flow changes even if plus/signup settings stay the same', () => {
  const bundle = [
    extractFunction(sidepanelSource, 'normalizeSignupMethod'),
    extractFunction(sidepanelSource, 'normalizePlusPaymentMethod'),
    extractFunction(sidepanelSource, 'getStepDefinitionsForMode'),
    extractFunction(sidepanelSource, 'rebuildStepDefinitionState'),
    extractFunction(sidepanelSource, 'syncStepDefinitionsForMode'),
  ].join('\n');

  const api = new Function(`
const calls = [];
const window = {
  MultiPageStepDefinitions: {
    getSteps(options) {
      calls.push({ type: 'getSteps', options });
      return [{ id: options.activeFlowId === 'kiro' ? 88 : 6, order: 1, key: options.activeFlowId }];
    },
  },
};
let latestState = { activeFlowId: 'openai' };
let currentPlusModeEnabled = false;
let currentPlusPaymentMethod = 'paypal';
let currentPlusAccountAccessStrategy = 'oauth';
let currentSignupMethod = 'email';
let currentPhoneVerificationEnabled = false;
let currentPhoneSignupReloginAfterBindEmailEnabled = false;
let currentStepDefinitionFlowId = 'openai';
let currentStepDefinitionTargetId = 'cpa';
let currentStepDefinitionOpenAiWebchatUploadEnabled = false;
let currentStepDefinitionGrokSub2apiGrok2ApiUploadEnabled = false;
const DEFAULT_ACTIVE_FLOW_ID = 'openai';
const DEFAULT_SIGNUP_METHOD = 'email';
const DEFAULT_PLUS_PAYMENT_METHOD = 'paypal';
const DEFAULT_PLUS_ACCOUNT_ACCESS_STRATEGY = 'oauth';
let stepDefinitions = [{ id: 6, key: 'openai' }];
let STEP_IDS = [6];
let STEP_DEFAULT_STATUSES = { 6: 'pending' };
let SKIPPABLE_STEPS = new Set([6]);
function renderStepsList() {
  calls.push({ type: 'render', stepIds: [...STEP_IDS] });
}
function normalizePlusAccountAccessStrategy(value = '') {
  return String(value || DEFAULT_PLUS_ACCOUNT_ACCESS_STRATEGY).trim().toLowerCase() || DEFAULT_PLUS_ACCOUNT_ACCESS_STRATEGY;
}
${bundle}
return {
  calls,
  syncStepDefinitionsForMode,
  getStepIds: () => [...STEP_IDS],
  getCurrentFlowId: () => currentStepDefinitionFlowId,
};
`)();

  api.syncStepDefinitionsForMode(false, {
    activeFlowId: 'kiro',
    plusPaymentMethod: 'paypal',
    signupMethod: 'email',
    phoneSignupReloginAfterBindEmailEnabled: false,
  });

  assert.equal(api.getCurrentFlowId(), 'kiro');
  assert.deepEqual(api.getStepIds(), [88]);
  assert.deepEqual(api.calls[0], {
    type: 'getSteps',
    options: {
      activeFlowId: 'kiro',
      targetId: undefined,
      plusModeEnabled: false,
      plusPaymentMethod: 'paypal',
      plusAccountAccessStrategy: 'oauth',
      openaiWebchatUploadEnabled: false,
      grokSub2apiGrok2ApiUploadEnabled: false,
      settingsState: undefined,
      signupMethod: 'email',
      phoneVerificationEnabled: false,
      phoneSignupReloginAfterBindEmailEnabled: false,
      accountContributionEnabled: false,
    },
  });
  assert.deepEqual(api.calls[1], { type: 'render', stepIds: [88] });
});

test('sidepanel step definitions rerender when OpenAI target changes to webchat', () => {
  const bundle = [
    extractFunction(sidepanelSource, 'normalizeSignupMethod'),
    extractFunction(sidepanelSource, 'normalizePlusPaymentMethod'),
    extractFunction(sidepanelSource, 'getStepDefinitionsForMode'),
    extractFunction(sidepanelSource, 'rebuildStepDefinitionState'),
    extractFunction(sidepanelSource, 'syncStepDefinitionsForMode'),
  ].join('\n');

  const api = new Function(`
const calls = [];
const window = {
  MultiPageStepDefinitions: {
    getSteps(options) {
      calls.push({ type: 'getSteps', options });
      return options.targetId === 'webchat'
        ? [{ id: 12, order: 12, key: 'openai-upload-session-to-webchat' }]
        : [{ id: 6, order: 6, key: 'platform-verify' }];
    },
  },
};
let latestState = { activeFlowId: 'openai', targetId: 'cpa' };
let currentPlusModeEnabled = false;
let currentPlusPaymentMethod = 'paypal';
let currentPlusAccountAccessStrategy = 'oauth';
let currentSignupMethod = 'email';
let currentPhoneVerificationEnabled = false;
let currentPhoneSignupReloginAfterBindEmailEnabled = false;
let currentStepDefinitionFlowId = 'openai';
let currentStepDefinitionTargetId = 'cpa';
let currentStepDefinitionOpenAiWebchatUploadEnabled = false;
let currentStepDefinitionGrokSub2apiGrok2ApiUploadEnabled = false;
const DEFAULT_ACTIVE_FLOW_ID = 'openai';
const DEFAULT_SIGNUP_METHOD = 'email';
const DEFAULT_PLUS_PAYMENT_METHOD = 'paypal';
const DEFAULT_PLUS_ACCOUNT_ACCESS_STRATEGY = 'oauth';
let stepDefinitions = [{ id: 6, key: 'platform-verify' }];
let STEP_IDS = [6];
let STEP_DEFAULT_STATUSES = { 6: 'pending' };
let SKIPPABLE_STEPS = new Set([6]);
function renderStepsList() {
  calls.push({ type: 'render', stepIds: [...STEP_IDS] });
}
function normalizePlusAccountAccessStrategy(value = '') {
  return String(value || DEFAULT_PLUS_ACCOUNT_ACCESS_STRATEGY).trim().toLowerCase() || DEFAULT_PLUS_ACCOUNT_ACCESS_STRATEGY;
}
${bundle}
return {
  calls,
  syncStepDefinitionsForMode,
  getStepIds: () => [...STEP_IDS],
  getCurrentTargetId: () => currentStepDefinitionTargetId,
};
`)();

  api.syncStepDefinitionsForMode(false, {
    activeFlowId: 'openai',
    targetId: 'webchat',
    plusPaymentMethod: 'paypal',
    openaiWebchatUploadEnabled: true,
    signupMethod: 'email',
    phoneSignupReloginAfterBindEmailEnabled: false,
  });

  assert.equal(api.getCurrentTargetId(), 'webchat');
  assert.deepEqual(api.getStepIds(), [12]);
  assert.equal(api.calls.at(-1).type, 'render');
  assert.equal(api.calls.at(-2).options.targetId, 'webchat');
  assert.equal(api.calls.at(-2).options.openaiWebchatUploadEnabled, true);
});

test('sidepanel step definitions rerender when SUB2API import mode changes', () => {
  const bundle = [
    extractFunction(sidepanelSource, 'normalizeSignupMethod'),
    extractFunction(sidepanelSource, 'normalizePlusPaymentMethod'),
    extractFunction(sidepanelSource, 'getStepDefinitionsForMode'),
    extractFunction(sidepanelSource, 'rebuildStepDefinitionState'),
    extractFunction(sidepanelSource, 'syncStepDefinitionsForMode'),
  ].join('\n');

  const api = new Function(`
const calls = [];
const window = {
  MultiPageStepDefinitions: {
    getSteps(options) {
      calls.push({ type: 'getSteps', options });
      return options.sub2apiImportMode === 'agent_identity'
        ? [{ id: 7, order: 7, key: 'sub2api-agent-identity-import' }]
        : [{ id: 7, order: 7, key: 'oauth-login' }, { id: 10, order: 10, key: 'platform-verify' }];
    },
  },
};
let latestState = { activeFlowId: 'openai', targetId: 'sub2api', sub2apiImportMode: 'oauth' };
let currentPlusModeEnabled = false;
let currentPlusPaymentMethod = 'paypal';
let currentPlusAccountAccessStrategy = 'oauth';
let currentStepDefinitionSub2ApiImportMode = 'oauth';
let currentSignupMethod = 'email';
let currentPhoneVerificationEnabled = false;
let currentPhoneSignupReloginAfterBindEmailEnabled = false;
let currentStepDefinitionFlowId = 'openai';
let currentStepDefinitionTargetId = 'sub2api';
let currentStepDefinitionOpenAiWebchatUploadEnabled = false;
let currentStepDefinitionGrokSub2apiGrok2ApiUploadEnabled = false;
const DEFAULT_ACTIVE_FLOW_ID = 'openai';
const DEFAULT_SIGNUP_METHOD = 'email';
const DEFAULT_PLUS_PAYMENT_METHOD = 'paypal';
const DEFAULT_PLUS_ACCOUNT_ACCESS_STRATEGY = 'oauth';
let stepDefinitions = [{ id: 7, key: 'oauth-login' }, { id: 10, key: 'platform-verify' }];
let STEP_IDS = [7, 10];
let STEP_DEFAULT_STATUSES = { 7: 'pending', 10: 'pending' };
let SKIPPABLE_STEPS = new Set([7, 10]);
function renderStepsList() {
  calls.push({ type: 'render', stepIds: [...STEP_IDS] });
}
function normalizePlusAccountAccessStrategy(value = '') {
  return String(value || DEFAULT_PLUS_ACCOUNT_ACCESS_STRATEGY).trim().toLowerCase() || DEFAULT_PLUS_ACCOUNT_ACCESS_STRATEGY;
}
${bundle}
return {
  calls,
  syncStepDefinitionsForMode,
  getStepIds: () => [...STEP_IDS],
};
`)();

  api.syncStepDefinitionsForMode(false, {
    activeFlowId: 'openai',
    targetId: 'sub2api',
    sub2apiImportMode: 'agent_identity',
    plusPaymentMethod: 'paypal',
    signupMethod: 'email',
  });

  assert.deepEqual(api.getStepIds(), [7]);
  assert.equal(api.calls.at(-2).options.sub2apiImportMode, 'agent_identity');
  assert.equal(api.calls.at(-1).type, 'render');
});

test('sidepanel step definitions rerender when Grok SUB2API dual publishing changes', () => {
  const bundle = [
    extractFunction(sidepanelSource, 'normalizeSignupMethod'),
    extractFunction(sidepanelSource, 'normalizePlusPaymentMethod'),
    extractFunction(sidepanelSource, 'getStepDefinitionsForMode'),
    extractFunction(sidepanelSource, 'rebuildStepDefinitionState'),
    extractFunction(sidepanelSource, 'syncStepDefinitionsForMode'),
  ].join('\n');

  const api = new Function(`
const calls = [];
const window = {
  MultiPageStepDefinitions: {
    getSteps(options) {
      calls.push({ type: 'getSteps', options });
      return Array.from(
        { length: options.grokSub2apiGrok2ApiUploadEnabled ? 8 : 6 },
        (_, index) => ({ id: index + 1, order: index + 1, key: 'grok-' + (index + 1) })
      );
    },
  },
};
let latestState = { activeFlowId: 'grok', targetId: 'sub2api' };
let currentPlusModeEnabled = false;
let currentPlusPaymentMethod = 'paypal';
let currentPlusAccountAccessStrategy = 'oauth';
let currentSignupMethod = 'email';
let currentPhoneVerificationEnabled = false;
let currentPhoneSignupReloginAfterBindEmailEnabled = false;
let currentStepDefinitionFlowId = 'grok';
let currentStepDefinitionTargetId = 'sub2api';
let currentStepDefinitionOpenAiWebchatUploadEnabled = false;
let currentStepDefinitionGrokSub2apiGrok2ApiUploadEnabled = false;
const DEFAULT_ACTIVE_FLOW_ID = 'openai';
const DEFAULT_SIGNUP_METHOD = 'email';
const DEFAULT_PLUS_PAYMENT_METHOD = 'paypal';
const DEFAULT_PLUS_ACCOUNT_ACCESS_STRATEGY = 'oauth';
let stepDefinitions = Array.from({ length: 6 }, (_, index) => ({ id: index + 1, key: 'grok-' + (index + 1) }));
let STEP_IDS = stepDefinitions.map((step) => step.id);
let STEP_DEFAULT_STATUSES = Object.fromEntries(STEP_IDS.map((stepId) => [stepId, 'pending']));
let SKIPPABLE_STEPS = new Set(STEP_IDS);
function renderStepsList() {
  calls.push({ type: 'render', stepIds: [...STEP_IDS] });
}
function normalizePlusAccountAccessStrategy(value = '') {
  return String(value || DEFAULT_PLUS_ACCOUNT_ACCESS_STRATEGY).trim().toLowerCase() || DEFAULT_PLUS_ACCOUNT_ACCESS_STRATEGY;
}
${bundle}
return {
  calls,
  syncStepDefinitionsForMode,
  getStepIds: () => [...STEP_IDS],
};
`)();

  api.syncStepDefinitionsForMode(false, {
    activeFlowId: 'grok',
    targetId: 'sub2api',
    plusPaymentMethod: 'paypal',
    grokSub2apiGrok2ApiUploadEnabled: true,
    signupMethod: 'email',
  });

  assert.deepEqual(api.getStepIds(), [1, 2, 3, 4, 5, 6, 7, 8]);
  assert.equal(api.calls.at(-2).options.grokSub2apiGrok2ApiUploadEnabled, true);
  assert.equal(api.calls.at(-1).type, 'render');
});

test('sidepanel OpenAI target normalization keeps registry-backed webchat source', () => {
  const bundle = [
    extractFunction(sidepanelSource, 'normalizePanelMode'),
    extractFunction(sidepanelSource, 'normalizeTargetIdForFlow'),
  ].join('\n');

  const api = new Function(`
const DEFAULT_ACTIVE_FLOW_ID = 'openai';
function getDefaultTargetIdForFlow(flowId = DEFAULT_ACTIVE_FLOW_ID) {
  return flowId === 'openai' ? 'cpa' : 'kiro-rs';
}
function normalizeFlowId(value = '', fallback = DEFAULT_ACTIVE_FLOW_ID) {
  const normalized = String(value || fallback || DEFAULT_ACTIVE_FLOW_ID).trim().toLowerCase();
  return ['openai', 'kiro', 'grok'].includes(normalized) ? normalized : DEFAULT_ACTIVE_FLOW_ID;
}
function getFlowRegistry() {
  return {
    normalizeTargetId(flowId, targetId = '', fallback = '') {
      const normalizedFlowId = normalizeFlowId(flowId);
      const normalizedTargetId = String(targetId || '').trim().toLowerCase();
      if (normalizedFlowId === 'openai' && ['cpa', 'sub2api', 'codex2api', 'webchat', 'chatgpt2api'].includes(normalizedTargetId)) {
        return normalizedTargetId;
      }
      return String(fallback || '').trim().toLowerCase() || 'cpa';
    },
  };
}
${bundle}
return { normalizePanelMode, normalizeTargetIdForFlow };
`)();

  assert.equal(api.normalizePanelMode('webchat'), 'webchat');
  assert.equal(api.normalizePanelMode('chatgpt2api'), 'chatgpt2api');
  assert.equal(api.normalizeTargetIdForFlow('openai', 'webchat'), 'webchat');
  assert.equal(api.normalizeTargetIdForFlow('openai', 'chatgpt2api'), 'chatgpt2api');
});

test('syncLatestState keeps activeFlowId and flowId in sync when only one side changes', () => {
  const bundle = [
    extractFunction(sidepanelSource, 'syncLatestState'),
  ].join('\n');

  const api = new Function(`
let latestState = {
  activeFlowId: 'openai',
  flowId: 'openai',
  nodeStatuses: { 'open-chatgpt': 'completed' },
};
const DEFAULT_ACTIVE_FLOW_ID = 'openai';
const NODE_DEFAULT_STATUSES = { 'open-chatgpt': 'pending' };
const calls = [];
function normalizeFlowId(value = '', fallback = DEFAULT_ACTIVE_FLOW_ID) {
  return String(value || fallback || DEFAULT_ACTIVE_FLOW_ID).trim().toLowerCase() || DEFAULT_ACTIVE_FLOW_ID;
}
function getStoredNodeStatuses(state = {}) {
  return { ...NODE_DEFAULT_STATUSES, ...(state?.nodeStatuses || {}) };
}
function renderAccountRecords(state) {
  calls.push({ ...state });
}
${bundle}
return {
  syncLatestState,
  getLatestState() {
    return latestState;
  },
  getCalls() {
    return calls;
  },
};
`)();

  api.syncLatestState({ flowId: 'kiro' });

  assert.deepStrictEqual(api.getLatestState(), {
    activeFlowId: 'kiro',
    flowId: 'kiro',
    nodeStatuses: { 'open-chatgpt': 'completed' },
    targetId: 'kiro-rs',
  });
  assert.equal(api.getCalls()[0].activeFlowId, 'kiro');
  assert.equal(api.getCalls()[0].flowId, 'kiro');
  assert.equal(api.getCalls()[0].targetId, 'kiro-rs');
});

test('sidepanel shares webchat config values between OpenAI and Grok inputs', () => {
  const bundle = [
    extractFunction(sidepanelSource, 'getSharedWebchatUrlFromState'),
    extractFunction(sidepanelSource, 'getSharedWebchatAdminKeyFromState'),
    extractFunction(sidepanelSource, 'buildSharedWebchatConfigPatch'),
    extractFunction(sidepanelSource, 'syncSharedWebchatInputsFromState'),
  ].join('\n');

  const api = new Function(`
let latestState = {};
const inputGrokWebchat2ApiUrl = { value: '' };
const inputGrokWebchat2ApiKey = { value: '' };
const inputOpenAiWebchatUrl = { value: '' };
const inputOpenAiWebchatKey = { value: '' };
${bundle}
return {
  inputGrokWebchat2ApiUrl,
  inputGrokWebchat2ApiKey,
  inputOpenAiWebchatUrl,
  inputOpenAiWebchatKey,
  getSharedWebchatUrlFromState,
  getSharedWebchatAdminKeyFromState,
  buildSharedWebchatConfigPatch,
  syncSharedWebchatInputsFromState,
};
`)();

  const state = {
    grokWebchat2ApiUrl: 'https://shared.example.com/admin',
    grokWebchat2ApiAdminKey: 'shared-key',
  };

  assert.equal(api.getSharedWebchatUrlFromState(state), 'https://shared.example.com/admin');
  assert.equal(api.getSharedWebchatAdminKeyFromState(state), 'shared-key');
  assert.deepEqual(api.buildSharedWebchatConfigPatch(' https://next.example.com/admin ', 'next-key'), {
    openaiWebchatUrl: 'https://next.example.com/admin',
    openaiWebchatAdminKey: 'next-key',
    grokWebchat2ApiUrl: 'https://next.example.com/admin',
    grokWebchat2ApiAdminKey: 'next-key',
  });

  api.syncSharedWebchatInputsFromState(state);

  assert.equal(api.inputOpenAiWebchatUrl.value, 'https://shared.example.com/admin');
  assert.equal(api.inputOpenAiWebchatKey.value, 'shared-key');
  assert.equal(api.inputGrokWebchat2ApiUrl.value, 'https://shared.example.com/admin');
  assert.equal(api.inputGrokWebchat2ApiKey.value, 'shared-key');
});

test('sidepanel keeps ChatGPT2API config independent from shared webchat inputs', () => {
  const bundle = [
    extractFunction(sidepanelSource, 'getOpenAiChatgpt2ApiUrlFromState'),
    extractFunction(sidepanelSource, 'getOpenAiChatgpt2ApiAdminKeyFromState'),
    extractFunction(sidepanelSource, 'buildOpenAiChatgpt2ApiConfigPatch'),
    extractFunction(sidepanelSource, 'syncOpenAiChatgpt2ApiInputsFromState'),
  ].join('\n');

  const api = new Function(`
let latestState = {};
const inputOpenAiChatgpt2ApiUrl = { value: '' };
const inputOpenAiChatgpt2ApiKey = { value: '' };
${bundle}
return {
  inputOpenAiChatgpt2ApiUrl,
  inputOpenAiChatgpt2ApiKey,
  getOpenAiChatgpt2ApiUrlFromState,
  getOpenAiChatgpt2ApiAdminKeyFromState,
  buildOpenAiChatgpt2ApiConfigPatch,
  syncOpenAiChatgpt2ApiInputsFromState,
};
`)();

  const state = {
    openaiWebchatUrl: 'https://shared.example.com/admin',
    openaiWebchatAdminKey: 'shared-key',
    settingsState: {
      flows: {
        openai: {
          targets: {
            chatgpt2api: {
              baseUrl: 'https://nested-chatgpt2api.example.com/admin',
              apiKey: 'nested-key',
            },
          },
        },
      },
    },
  };

  assert.equal(api.getOpenAiChatgpt2ApiUrlFromState(state), 'https://nested-chatgpt2api.example.com/admin');
  assert.equal(api.getOpenAiChatgpt2ApiAdminKeyFromState(state), 'nested-key');
  assert.deepEqual(api.buildOpenAiChatgpt2ApiConfigPatch(' https://next-chatgpt2api.example.com/admin ', 'next-key'), {
    openaiChatgpt2ApiUrl: 'https://next-chatgpt2api.example.com/admin',
    openaiChatgpt2ApiAdminKey: 'next-key',
  });

  api.syncOpenAiChatgpt2ApiInputsFromState(state);

  assert.equal(api.inputOpenAiChatgpt2ApiUrl.value, 'https://nested-chatgpt2api.example.com/admin');
  assert.equal(api.inputOpenAiChatgpt2ApiKey.value, 'nested-key');
});

test('updatePanelModeUI reapplies dynamic Plus and phone visibility after flow group visibility', () => {
  const bundle = [
    extractFunction(sidepanelSource, 'updatePanelModeUI'),
  ].join('\n');

  const api = new Function(`
const calls = [];
let latestState = {
  activeFlowId: 'openai',
  flowId: 'openai',
  targetId: 'cpa',
};
const DEFAULT_ACTIVE_FLOW_ID = 'openai';
const selectFlow = { value: '' };
const selectPanelMode = { value: '' };
function normalizeFlowId(value = '', fallback = DEFAULT_ACTIVE_FLOW_ID) {
  return String(value || fallback || DEFAULT_ACTIVE_FLOW_ID).trim().toLowerCase() || DEFAULT_ACTIVE_FLOW_ID;
}
function normalizePanelMode(value = '', fallback = 'cpa') {
  return String(value || fallback || 'cpa').trim().toLowerCase() || 'cpa';
}
function getSelectedFlowId() {
  return latestState.activeFlowId;
}
function getSelectedTargetId() {
  return 'cpa';
}
function renderFlowSelectorOptions(flowId) {
  calls.push({ type: 'render-flow', flowId });
}
function renderTargetSelectorOptions(flowId, targetId) {
  calls.push({ type: 'render-target', flowId, targetId });
}
function applyFlowSettingsGroupVisibility(visibleGroupIds) {
  calls.push({ type: 'groups', visibleGroupIds: [...visibleGroupIds] });
}
function updatePlusModeUI() {
  calls.push({ type: 'plus' });
}
function updatePhoneVerificationSettingsUI() {
  calls.push({ type: 'phone' });
}
function resolveCurrentSidepanelCapabilities() {
  return {
    visibleGroupIds: ['service-account', 'openai-plus', 'openai-phone'],
    effectiveTargetId: 'cpa',
  };
}
const document = {
  querySelector() {
    return null;
  },
};
${bundle}
return {
  calls,
  updatePanelModeUI,
  selectFlow,
  selectPanelMode,
};
`)();

  api.updatePanelModeUI();

  assert.deepEqual(
    api.calls.map((entry) => entry.type),
    ['render-flow', 'render-target', 'groups', 'plus', 'phone']
  );
  assert.equal(api.selectFlow.value, 'openai');
  assert.equal(api.selectPanelMode.value, 'cpa');
});
