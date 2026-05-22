const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');

test('background imports message router module', () => {
  const source = fs.readFileSync('background.js', 'utf8');
  assert.match(source, /background\/message-router\.js/);
});

test('background defaults enable free phone reuse switches', () => {
  const source = fs.readFileSync('background.js', 'utf8');
  const defaultsStart = source.indexOf('const PERSISTED_SETTING_DEFAULTS = {');
  const defaultsEnd = source.indexOf('const PERSISTED_SETTING_KEYS = Object.keys(PERSISTED_SETTING_DEFAULTS);');
  const defaultsBlock = source.slice(defaultsStart, defaultsEnd);

  assert.match(defaultsBlock, /freePhoneReuseEnabled:\s*true/);
  assert.match(defaultsBlock, /freePhoneReuseAutoEnabled:\s*true/);
  assert.match(defaultsBlock, /phoneSmsReuseEnabled:\s*DEFAULT_HERO_SMS_REUSE_ENABLED/);
});

test('background free reusable phone setter does not depend on module-scoped phone flow constants', () => {
  const source = fs.readFileSync('background.js', 'utf8');
  const setterStart = source.indexOf('async function setFreeReusablePhoneActivation');
  const setterEnd = source.indexOf('// ============================================================\n// Tab Registry', setterStart);
  const setterBlock = source.slice(setterStart, setterEnd);

  assert.ok(setterStart >= 0, 'expected setFreeReusablePhoneActivation to exist');
  assert.doesNotMatch(setterBlock, /DEFAULT_PHONE_NUMBER_MAX_USES/);
  assert.match(setterBlock, /maxUses:\s*Math\.max\(1,\s*Math\.floor\(Number\(record\.maxUses\)\s*\|\|\s*3\)\)/);
});

test('background free reusable phone setter can recover local HeroSMS activation id by phone number', () => {
  const source = fs.readFileSync('background.js', 'utf8');
  const setterStart = source.indexOf('async function setFreeReusablePhoneActivation');
  const setterEnd = source.indexOf('// ============================================================\n// Tab Registry', setterStart);
  const setterBlock = source.slice(setterStart, setterEnd);

  assert.match(source, /function findLocalHeroSmsActivationForPhone\(/);
  assert.match(source, /state\.currentPhoneActivation/);
  assert.match(source, /state\.reusablePhoneActivation/);
  assert.match(source, /state\.signupPhoneActivation/);
  assert.match(source, /state\.signupPhoneCompletedActivation/);
  assert.match(source, /state\.phonePreferredActivation/);
  assert.match(source, /state\.phoneReusableActivationPool/);
  assert.match(setterBlock, /findLocalHeroSmsActivationForPhone\(state,\s*phoneNumber\)/);
  assert.match(setterBlock, /activationId = String\(\s*record\.activationId[\s\S]*localActivation\?\.activationId/);
  assert.match(setterBlock, /manualOnly:\s*!activationId/);
});

test('background blocks free reusable phone mutations while phone signup owns the identity', () => {
  const source = fs.readFileSync('background.js', 'utf8');
  const clearStart = source.indexOf('async function clearFreeReusablePhoneActivation');
  const setterStart = source.indexOf('async function setFreeReusablePhoneActivation');
  const setterEnd = source.indexOf('// ============================================================\n// Tab Registry', setterStart);
  const clearBlock = source.slice(clearStart, setterStart);
  const setterBlock = source.slice(setterStart, setterEnd);

  assert.match(source, /function isPhoneSignupIdentityStateForReuse\(/);
  assert.match(source, /function hasSignupPhoneActivationState\(/);
  assert.match(clearBlock, /isPhoneSignupIdentityStateForReuse\(state\)/);
  assert.match(setterBlock, /isPhoneSignupIdentityStateForReuse\(state\)/);
});

test('background HeroSMS phone prefix inference covers built-in major countries', () => {
  const source = fs.readFileSync('background.js', 'utf8');
  const supportedStart = source.indexOf('const HERO_SMS_SUPPORTED_COUNTRY_IDS = [');
  const prefixStart = source.indexOf('const HERO_SMS_COUNTRY_BY_PHONE_PREFIX = Object.freeze([');
  const prefixEnd = source.indexOf(']);', prefixStart);
  const supportedBlock = source.slice(supportedStart, source.indexOf('];', supportedStart));
  const prefixBlock = source.slice(prefixStart, prefixEnd);

  assert.match(supportedBlock, /\[6,\s*52,\s*187,\s*16,\s*151,\s*43,\s*73,\s*10/);
  [
    ['84', 10, 'Vietnam'],
    ['66', 52, 'Thailand'],
    ['62', 6, 'Indonesia'],
    ['44', 16, 'United Kingdom'],
    ['81', 151, 'Japan'],
    ['49', 43, 'Germany'],
    ['33', 73, 'France'],
    ['1', 187, 'USA'],
  ].forEach(([prefix, id, label]) => {
    assert.match(prefixBlock, new RegExp(`prefix:\\s*'${prefix}'[\\s\\S]*id:\\s*${id}[\\s\\S]*label:\\s*'${label}'`));
  });
});

test('message router module exposes a factory', () => {
  const source = fs.readFileSync('background/message-router.js', 'utf8');
  const globalScope = {};

  const api = new Function('self', `${source}; return self.MultiPageBackgroundMessageRouter;`)(globalScope);

  assert.equal(typeof api?.createMessageRouter, 'function');
});

test('SAVE_SETTING broadcasts free phone reuse setting updates for realtime sidepanel sync', async () => {
  const source = fs.readFileSync('background/message-router.js', 'utf8');
  const globalScope = { console };
  const api = new Function('self', `${source}; return self.MultiPageBackgroundMessageRouter;`)(globalScope);
  const broadcasts = [];
  let state = {
    freePhoneReuseEnabled: false,
    freePhoneReuseAutoEnabled: false,
    plusModeEnabled: false,
    plusPaymentMethod: 'paypal',
  };

  const router = api.createMessageRouter({
    addLog: async () => {},
    buildLuckmailSessionSettingsPayload: () => ({}),
    buildPersistentSettingsPayload: (input = {}) => {
      const updates = {};
      if (Object.prototype.hasOwnProperty.call(input, 'freePhoneReuseEnabled')) {
        updates.freePhoneReuseEnabled = Boolean(input.freePhoneReuseEnabled);
      }
      if (Object.prototype.hasOwnProperty.call(input, 'freePhoneReuseAutoEnabled')) {
        updates.freePhoneReuseAutoEnabled = Boolean(input.freePhoneReuseAutoEnabled);
      }
      return updates;
    },
    broadcastDataUpdate: (payload) => broadcasts.push(payload),
    getState: async () => ({ ...state }),
    setPersistentSettings: async (updates) => ({ ...updates }),
    setState: async (updates) => {
      state = { ...state, ...updates };
    },
  });

  const response = await router.handleMessage({
    type: 'SAVE_SETTING',
    payload: {
      freePhoneReuseEnabled: true,
      freePhoneReuseAutoEnabled: true,
    },
  });

  assert.equal(response.ok, true);
  assert.equal(state.freePhoneReuseEnabled, true);
  assert.equal(state.freePhoneReuseAutoEnabled, true);
  assert.ok(
    broadcasts.some((payload) => (
      payload.freePhoneReuseEnabled === true
      && payload.freePhoneReuseAutoEnabled === true
    )),
    'expected SAVE_SETTING to broadcast free reuse switch updates'
  );
});

test('SAVE_SETTING preserves phone reuse preferences while phone signup is selected', async () => {
  const source = fs.readFileSync('background/message-router.js', 'utf8');
  const globalScope = { console };
  const api = new Function('self', `${source}; return self.MultiPageBackgroundMessageRouter;`)(globalScope);
  const persistedPayloads = [];
  let state = {
    signupMethod: 'phone',
    phoneVerificationEnabled: true,
    plusModeEnabled: false,
    phoneSmsReuseEnabled: true,
    heroSmsReuseEnabled: true,
    freePhoneReuseEnabled: true,
    freePhoneReuseAutoEnabled: true,
    phonePreferredActivation: {
      provider: 'hero-sms',
      activationId: 'stored',
      phoneNumber: '66950001111',
    },
  };

  const router = api.createMessageRouter({
    addLog: async () => {},
    buildLuckmailSessionSettingsPayload: () => ({}),
    buildPersistentSettingsPayload: (input = {}) => ({
      signupMethod: String(input.signupMethod || state.signupMethod),
      phoneSmsReuseEnabled: Boolean(input.phoneSmsReuseEnabled),
      heroSmsReuseEnabled: Boolean(input.heroSmsReuseEnabled),
      freePhoneReuseEnabled: Boolean(input.freePhoneReuseEnabled),
      freePhoneReuseAutoEnabled: Boolean(input.freePhoneReuseAutoEnabled),
      phonePreferredActivation: input.phonePreferredActivation ?? null,
    }),
    broadcastDataUpdate: () => {},
    getState: async () => ({ ...state }),
    setPersistentSettings: async (updates) => {
      persistedPayloads.push({ ...updates });
      return { ...updates };
    },
    setState: async (updates) => {
      state = { ...state, ...updates };
    },
  });

  const response = await router.handleMessage({
    type: 'SAVE_SETTING',
    payload: {
      signupMethod: 'phone',
      phoneSmsReuseEnabled: false,
      heroSmsReuseEnabled: false,
      freePhoneReuseEnabled: false,
      freePhoneReuseAutoEnabled: false,
      phonePreferredActivation: null,
    },
  });

  assert.equal(response.ok, true);
  assert.equal(state.phoneSmsReuseEnabled, true);
  assert.equal(state.heroSmsReuseEnabled, true);
  assert.equal(state.freePhoneReuseEnabled, true);
  assert.equal(state.freePhoneReuseAutoEnabled, true);
  assert.deepStrictEqual(state.phonePreferredActivation, {
    provider: 'hero-sms',
    activationId: 'stored',
    phoneNumber: '66950001111',
  });
  assert.equal(persistedPayloads[0].phoneSmsReuseEnabled, true);
  assert.equal(persistedPayloads[0].freePhoneReuseEnabled, true);
});

test('SAVE_SETTING allows phone reuse preferences after switching back to email signup', async () => {
  const source = fs.readFileSync('background/message-router.js', 'utf8');
  const globalScope = { console };
  const api = new Function('self', `${source}; return self.MultiPageBackgroundMessageRouter;`)(globalScope);
  let state = {
    signupMethod: 'phone',
    phoneVerificationEnabled: true,
    plusModeEnabled: false,
    phoneSmsReuseEnabled: true,
    heroSmsReuseEnabled: true,
    freePhoneReuseEnabled: true,
    freePhoneReuseAutoEnabled: true,
  };

  const router = api.createMessageRouter({
    addLog: async () => {},
    buildLuckmailSessionSettingsPayload: () => ({}),
    buildPersistentSettingsPayload: (input = {}) => ({
      signupMethod: String(input.signupMethod || state.signupMethod),
      phoneSmsReuseEnabled: Boolean(input.phoneSmsReuseEnabled),
      heroSmsReuseEnabled: Boolean(input.heroSmsReuseEnabled),
      freePhoneReuseEnabled: Boolean(input.freePhoneReuseEnabled),
      freePhoneReuseAutoEnabled: Boolean(input.freePhoneReuseAutoEnabled),
    }),
    broadcastDataUpdate: () => {},
    getState: async () => ({ ...state }),
    setPersistentSettings: async (updates) => ({ ...updates }),
    setState: async (updates) => {
      state = { ...state, ...updates };
    },
  });

  const response = await router.handleMessage({
    type: 'SAVE_SETTING',
    payload: {
      signupMethod: 'email',
      phoneSmsReuseEnabled: false,
      heroSmsReuseEnabled: false,
      freePhoneReuseEnabled: false,
      freePhoneReuseAutoEnabled: false,
    },
  });

  assert.equal(response.ok, true);
  assert.equal(state.signupMethod, 'email');
  assert.equal(state.phoneSmsReuseEnabled, false);
  assert.equal(state.heroSmsReuseEnabled, false);
  assert.equal(state.freePhoneReuseEnabled, false);
  assert.equal(state.freePhoneReuseAutoEnabled, false);
});

test('SAVE_SETTING broadcasts operation delay setting without background success log', async () => {
  const source = fs.readFileSync('background/message-router.js', 'utf8');
  const globalScope = { console };
  const api = new Function('self', `${source}; return self.MultiPageBackgroundMessageRouter;`)(globalScope);
  const broadcasts = [];
  const logs = [];
  let state = { operationDelayEnabled: true, plusModeEnabled: false, plusPaymentMethod: 'paypal' };

  const router = api.createMessageRouter({
    addLog: async (message, level = 'info') => logs.push({ message, level }),
    buildLuckmailSessionSettingsPayload: () => ({}),
    buildPersistentSettingsPayload: (input = {}) => Object.prototype.hasOwnProperty.call(input, 'operationDelayEnabled')
      ? { operationDelayEnabled: true }
      : {},
    broadcastDataUpdate: (payload) => broadcasts.push(payload),
    getState: async () => ({ ...state }),
    setPersistentSettings: async (updates) => ({ ...updates }),
    setState: async (updates) => { state = { ...state, ...updates }; },
  });

  const response = await router.handleMessage({
    type: 'SAVE_SETTING',
    source: 'sidepanel',
    payload: { operationDelayEnabled: false },
  });

  assert.equal(response.ok, true);
  assert.equal(state.operationDelayEnabled, true);
  assert.deepStrictEqual(broadcasts.at(-1), { operationDelayEnabled: true });
  assert.equal(logs.length, 0);
});

test('SAVE_SETTING rebuilds Plus node statuses when the account access strategy changes', async () => {
  const source = fs.readFileSync('background/message-router.js', 'utf8');
  const globalScope = { console };
  const api = new Function('self', `${source}; return self.MultiPageBackgroundMessageRouter;`)(globalScope);
  const broadcasts = [];
  let state = {
    plusModeEnabled: true,
    plusPaymentMethod: 'paypal',
    plusAccountAccessStrategy: 'oauth',
    oauthUrl: 'https://oauth.example/current',
    localhostUrl: 'http://localhost:38080/callback',
    oauthFlowDeadlineAt: Date.now() + 60000,
    oauthFlowDeadlineSourceUrl: 'https://oauth.example/current',
    cpaOAuthState: 'cpa-state',
    cpaManagementOrigin: 'https://cpa.example.com',
    sub2apiSessionId: 'sub-session',
    sub2apiOAuthState: 'sub-oauth-state',
    sub2apiGroupId: 'group-id',
    sub2apiGroupIds: ['group-id'],
    sub2apiDraftName: 'draft-name',
    sub2apiProxyId: 'proxy-id',
    codex2apiSessionId: 'codex-session',
    codex2apiOAuthState: 'codex-oauth-state',
    plusManualConfirmationPending: true,
    plusManualConfirmationRequestId: 'gopay-req',
    plusManualConfirmationStep: 9,
    plusManualConfirmationMethod: 'gopay',
    plusManualConfirmationTitle: 'GoPay 订阅确认',
    plusManualConfirmationMessage: '完成后继续 OAuth 登录。',
    currentNodeId: 'confirm-oauth',
    nodeStatuses: {
      'open-chatgpt': 'completed',
      'plus-checkout-create': 'completed',
      'plus-checkout-billing': 'completed',
      'paypal-approve': 'completed',
      'plus-checkout-return': 'completed',
      'oauth-login': 'completed',
      'fetch-login-code': 'completed',
      'post-login-phone-verification': 'completed',
      'confirm-oauth': 'running',
      'platform-verify': 'pending',
    },
  };

  const router = api.createMessageRouter({
    addLog: async () => {},
    buildLuckmailSessionSettingsPayload: () => ({}),
    buildPersistentSettingsPayload: (input = {}) => Object.prototype.hasOwnProperty.call(input, 'plusAccountAccessStrategy')
      ? { plusAccountAccessStrategy: input.plusAccountAccessStrategy }
      : {},
    broadcastDataUpdate: (payload) => broadcasts.push(payload),
    getNodeIdsForState: (nextState = {}) => (
      String(nextState.plusAccountAccessStrategy || '').trim() === 'sub2api_codex_session'
        ? [
          'open-chatgpt',
          'plus-checkout-create',
          'plus-checkout-billing',
          'paypal-approve',
          'plus-checkout-return',
          'sub2api-session-import',
        ]
        : [
          'open-chatgpt',
          'plus-checkout-create',
          'plus-checkout-billing',
          'paypal-approve',
          'plus-checkout-return',
          'oauth-login',
          'fetch-login-code',
          'post-login-phone-verification',
          'confirm-oauth',
          'platform-verify',
        ]
    ),
    getState: async () => ({ ...state }),
    getStepIdsForState: () => [],
    setPersistentSettings: async (updates) => ({ ...updates }),
    setState: async (updates) => {
      state = { ...state, ...updates };
    },
  });

  const response = await router.handleMessage({
    type: 'SAVE_SETTING',
    payload: {
      plusAccountAccessStrategy: 'sub2api_codex_session',
    },
  });

  assert.equal(response.ok, true);
  assert.equal(state.plusAccountAccessStrategy, 'sub2api_codex_session');
  assert.equal(state.currentNodeId, '');
  assert.equal(state.oauthUrl, null);
  assert.equal(state.localhostUrl, null);
  assert.equal(state.oauthFlowDeadlineAt, null);
  assert.equal(state.oauthFlowDeadlineSourceUrl, null);
  assert.equal(state.cpaOAuthState, null);
  assert.equal(state.cpaManagementOrigin, null);
  assert.equal(state.sub2apiSessionId, null);
  assert.equal(state.sub2apiOAuthState, null);
  assert.equal(state.sub2apiGroupId, null);
  assert.deepStrictEqual(state.sub2apiGroupIds, []);
  assert.equal(state.sub2apiDraftName, null);
  assert.equal(state.sub2apiProxyId, null);
  assert.equal(state.codex2apiSessionId, null);
  assert.equal(state.codex2apiOAuthState, null);
  assert.equal(state.plusManualConfirmationPending, false);
  assert.equal(state.plusManualConfirmationRequestId, '');
  assert.equal(state.plusManualConfirmationStep, 0);
  assert.equal(state.plusManualConfirmationMethod, '');
  assert.equal(state.plusManualConfirmationTitle, '');
  assert.equal(state.plusManualConfirmationMessage, '');
  assert.deepStrictEqual(state.nodeStatuses, {
    'open-chatgpt': 'pending',
    'plus-checkout-create': 'pending',
    'plus-checkout-billing': 'pending',
    'paypal-approve': 'pending',
    'plus-checkout-return': 'pending',
    'sub2api-session-import': 'pending',
  });
  assert.equal(Object.prototype.hasOwnProperty.call(state.nodeStatuses, 'oauth-login'), false);
  assert.equal(Object.prototype.hasOwnProperty.call(state.nodeStatuses, 'platform-verify'), false);
  assert.deepStrictEqual(broadcasts.at(-1), {
    plusAccountAccessStrategy: 'sub2api_codex_session',
    oauthUrl: null,
    localhostUrl: null,
    oauthFlowDeadlineAt: null,
    oauthFlowDeadlineSourceUrl: null,
    cpaOAuthState: null,
    cpaManagementOrigin: null,
    sub2apiSessionId: null,
    sub2apiOAuthState: null,
    sub2apiGroupId: null,
    sub2apiGroupIds: [],
    sub2apiDraftName: null,
    sub2apiProxyId: null,
    codex2apiSessionId: null,
    codex2apiOAuthState: null,
    plusManualConfirmationPending: false,
    plusManualConfirmationRequestId: '',
    plusManualConfirmationStep: 0,
    plusManualConfirmationMethod: '',
    plusManualConfirmationTitle: '',
    plusManualConfirmationMessage: '',
    nodeStatuses: {
      'open-chatgpt': 'pending',
      'plus-checkout-create': 'pending',
      'plus-checkout-billing': 'pending',
      'paypal-approve': 'pending',
      'plus-checkout-return': 'pending',
      'sub2api-session-import': 'pending',
    },
    currentNodeId: '',
  });
});

test('SAVE_SETTING rebuilds Plus node statuses when panel mode forces the effective strategy back to OAuth', async () => {
  const source = fs.readFileSync('background/message-router.js', 'utf8');
  const globalScope = { console };
  const api = new Function('self', `${source}; return self.MultiPageBackgroundMessageRouter;`)(globalScope);
  const broadcasts = [];
  let state = {
    targetId: 'sub2api',
    plusModeEnabled: true,
    plusPaymentMethod: 'paypal',
    plusAccountAccessStrategy: 'sub2api_codex_session',
    oauthUrl: 'https://oauth.example/current',
    localhostUrl: 'http://localhost:38080/callback',
    sub2apiSessionId: 'sub-session',
    plusManualConfirmationPending: true,
    plusManualConfirmationRequestId: 'gopay-req',
    plusManualConfirmationStep: 9,
    plusManualConfirmationMethod: 'gopay',
    plusManualConfirmationTitle: 'GoPay 订阅确认',
    plusManualConfirmationMessage: '完成后继续导入当前 ChatGPT 会话到 SUB2API。',
    currentNodeId: 'sub2api-session-import',
    nodeStatuses: {
      'open-chatgpt': 'completed',
      'plus-checkout-create': 'completed',
      'plus-checkout-billing': 'completed',
      'paypal-approve': 'completed',
      'plus-checkout-return': 'completed',
      'sub2api-session-import': 'running',
    },
  };

  const router = api.createMessageRouter({
    addLog: async () => {},
    buildLuckmailSessionSettingsPayload: () => ({}),
    buildPersistentSettingsPayload: (input = {}) => Object.prototype.hasOwnProperty.call(input, 'targetId')
      ? { targetId: input.targetId }
      : {},
    broadcastDataUpdate: (payload) => broadcasts.push(payload),
    getNodeIdsForState: (nextState = {}) => (
      String(nextState.targetId || '').trim() === 'sub2api'
      && String(nextState.plusAccountAccessStrategy || '').trim() === 'sub2api_codex_session'
        ? [
          'open-chatgpt',
          'plus-checkout-create',
          'plus-checkout-billing',
          'paypal-approve',
          'plus-checkout-return',
          'sub2api-session-import',
        ]
        : [
          'open-chatgpt',
          'plus-checkout-create',
          'plus-checkout-billing',
          'paypal-approve',
          'plus-checkout-return',
          'oauth-login',
          'fetch-login-code',
          'post-login-phone-verification',
          'confirm-oauth',
          'platform-verify',
        ]
    ),
    getState: async () => ({ ...state }),
    getStepIdsForState: () => [],
    setPersistentSettings: async (updates) => ({ ...updates }),
    setState: async (updates) => {
      state = { ...state, ...updates };
    },
  });

  const response = await router.handleMessage({
    type: 'SAVE_SETTING',
    payload: {
      targetId: 'cpa',
    },
  });

  assert.equal(response.ok, true);
  assert.equal(state.targetId, 'cpa');
  assert.equal(state.plusAccountAccessStrategy, 'sub2api_codex_session');
  assert.equal(state.currentNodeId, '');
  assert.equal(state.oauthUrl, null);
  assert.equal(state.localhostUrl, null);
  assert.equal(state.sub2apiSessionId, null);
  assert.equal(state.plusManualConfirmationPending, false);
  assert.equal(state.plusManualConfirmationMessage, '');
  assert.deepStrictEqual(state.nodeStatuses, {
    'open-chatgpt': 'pending',
    'plus-checkout-create': 'pending',
    'plus-checkout-billing': 'pending',
    'paypal-approve': 'pending',
    'plus-checkout-return': 'pending',
    'oauth-login': 'pending',
    'fetch-login-code': 'pending',
    'post-login-phone-verification': 'pending',
    'confirm-oauth': 'pending',
    'platform-verify': 'pending',
  });
  assert.equal(Object.prototype.hasOwnProperty.call(state.nodeStatuses, 'sub2api-session-import'), false);
  assert.deepStrictEqual(broadcasts.at(-1), {
    targetId: 'cpa',
    signupMethod: 'email',
    oauthUrl: null,
    localhostUrl: null,
    oauthFlowDeadlineAt: null,
    oauthFlowDeadlineSourceUrl: null,
    cpaOAuthState: null,
    cpaManagementOrigin: null,
    sub2apiSessionId: null,
    sub2apiOAuthState: null,
    sub2apiGroupId: null,
    sub2apiGroupIds: [],
    sub2apiDraftName: null,
    sub2apiProxyId: null,
    codex2apiSessionId: null,
    codex2apiOAuthState: null,
    plusManualConfirmationPending: false,
    plusManualConfirmationRequestId: '',
    plusManualConfirmationStep: 0,
    plusManualConfirmationMethod: '',
    plusManualConfirmationTitle: '',
    plusManualConfirmationMessage: '',
    nodeStatuses: {
      'open-chatgpt': 'pending',
      'plus-checkout-create': 'pending',
      'plus-checkout-billing': 'pending',
      'paypal-approve': 'pending',
      'plus-checkout-return': 'pending',
      'oauth-login': 'pending',
      'fetch-login-code': 'pending',
      'post-login-phone-verification': 'pending',
      'confirm-oauth': 'pending',
      'platform-verify': 'pending',
    },
    currentNodeId: '',
  });
});

test('SAVE_SETTING mirrors activeFlowId into flowId when switching to kiro flow', async () => {
  const source = fs.readFileSync('background/message-router.js', 'utf8');
  const globalScope = { console };
  const api = new Function('self', `${source}; return self.MultiPageBackgroundMessageRouter;`)(globalScope);
  const broadcasts = [];
  let state = { activeFlowId: 'openai', flowId: 'openai', targetId: 'cpa', plusModeEnabled: false, plusPaymentMethod: 'paypal' };

  const router = api.createMessageRouter({
    addLog: async () => {},
    buildLuckmailSessionSettingsPayload: () => ({}),
    buildPersistentSettingsPayload: (input = {}) => Object.prototype.hasOwnProperty.call(input, 'activeFlowId')
      ? { activeFlowId: input.activeFlowId }
      : {},
    broadcastDataUpdate: (payload) => broadcasts.push(payload),
    getState: async () => ({ ...state }),
    setPersistentSettings: async (updates) => ({ ...updates }),
    setState: async (updates) => { state = { ...state, ...updates }; },
  });

  const response = await router.handleMessage({
    type: 'SAVE_SETTING',
    source: 'sidepanel',
    payload: { activeFlowId: 'kiro' },
  });

  assert.equal(response.ok, true);
  assert.equal(state.activeFlowId, 'kiro');
  assert.equal(state.flowId, 'kiro');
  assert.deepStrictEqual(broadcasts.at(-1), {
    activeFlowId: 'kiro',
    flowId: 'kiro',
    signupMethod: 'email',
  });
});

test('CLEAR_GROK_SSO_COOKIES delegates canonical runtime cleanup to background', async () => {
  const source = fs.readFileSync('background/message-router.js', 'utf8');
  const globalScope = { console };
  const api = new Function('self', `${source}; return self.MultiPageBackgroundMessageRouter;`)(globalScope);
  let called = false;
  const router = api.createMessageRouter({
    clearGrokSsoCookies: async () => {
      called = true;
      return {
        ok: true,
        state: {
          grokSsoCookie: '',
          grokSsoCookies: [],
          runtimeState: {
            flowState: {
              grok: {
                sso: {
                  currentCookie: '',
                  cookies: [],
                  extractedAt: 0,
                },
              },
            },
          },
        },
      };
    },
  });

  const response = await router.handleMessage({
    type: 'CLEAR_GROK_SSO_COOKIES',
    source: 'sidepanel',
    payload: {},
  });

  assert.equal(called, true);
  assert.equal(response.ok, true);
  assert.deepStrictEqual(response.state.grokSsoCookies, []);
  assert.equal(response.state.runtimeState.flowState.grok.sso.currentCookie, '');
});

test('SAVE_SETTING syncs canonical kiro settingsState back into session state', async () => {
  const source = fs.readFileSync('background/message-router.js', 'utf8');
  const globalScope = { console };
  const api = new Function('self', `${source}; return self.MultiPageBackgroundMessageRouter;`)(globalScope);
  const canonicalSettingsState = {
    schemaVersion: 4,
    activeFlowId: 'kiro',
    services: {
      account: { customPassword: '' },
      email: { provider: 'duck' },
      proxy: { enabled: false, provider: '711proxy', mode: 'account' },
    },
    flows: {
      openai: {
        integrationTargetId: 'cpa',
        integrationTargets: {
          cpa: { vpsUrl: '', vpsPassword: '', localCpaStep9Mode: 'submit' },
          sub2api: {
            sub2apiUrl: '',
            sub2apiEmail: '',
            sub2apiPassword: '',
            sub2apiGroupName: 'codex',
            sub2apiGroupNames: ['codex', 'openai-plus'],
            sub2apiAccountPriority: 1,
            sub2apiDefaultProxyName: '',
          },
          codex2api: { codex2apiUrl: '', codex2apiAdminKey: '' },
        },
        signup: {
          signupMethod: 'email',
          phoneVerificationEnabled: false,
          phoneSignupReloginAfterBindEmailEnabled: false,
        },
        plus: {
          plusModeEnabled: false,
          plusPaymentMethod: 'paypal',
        },
        autoRun: {
          stepExecutionRange: { enabled: false, fromStep: 1, toStep: 11 },
        },
      },
      kiro: {
        targetId: 'kiro-rs',
        targets: {
          'kiro-rs': {
            baseUrl: 'https://kiro.example.com/admin',
            apiKey: 'live-key',
          },
        },
        autoRun: {
          stepExecutionRange: { enabled: false, fromStep: 1, toStep: 9 },
        },
      },
    },
  };
  let state = {
    activeFlowId: 'kiro',
    flowId: 'kiro',
    targetId: 'kiro-rs',
    kiroRsUrl: 'https://kiro.example.com/admin',
    kiroRsKey: '',
    settingsSchemaVersion: 4,
    settingsState: {
      ...canonicalSettingsState,
      flows: {
        ...canonicalSettingsState.flows,
        kiro: {
          ...canonicalSettingsState.flows.kiro,
          targets: {
            'kiro-rs': {
              baseUrl: 'https://kiro.example.com/admin',
              apiKey: '',
            },
          },
        },
      },
    },
    plusModeEnabled: false,
    plusPaymentMethod: 'paypal',
  };

  const router = api.createMessageRouter({
    addLog: async () => {},
    buildLuckmailSessionSettingsPayload: () => ({}),
    buildPersistentSettingsPayload: (input = {}) => ({
      activeFlowId: String(input.activeFlowId || 'kiro'),
      kiroRsKey: String(input.kiroRsKey || ''),
    }),
    broadcastDataUpdate: () => {},
    getState: async () => ({ ...state }),
    setPersistentSettings: async () => ({
      activeFlowId: 'kiro',
      flowId: 'kiro',
      targetId: 'kiro-rs',
      kiroRsUrl: 'https://kiro.example.com/admin',
      kiroRsKey: 'live-key',
      settingsSchemaVersion: 4,
      settingsState: canonicalSettingsState,
    }),
    setState: async (updates) => {
      state = { ...state, ...updates };
    },
  });

  const response = await router.handleMessage({
    type: 'SAVE_SETTING',
    payload: {
      activeFlowId: 'kiro',
      kiroRsKey: 'live-key',
    },
  });

  assert.equal(response.ok, true);
  assert.equal(state.kiroRsKey, 'live-key');
  assert.equal(state.settingsState.flows.kiro.targets['kiro-rs'].apiKey, 'live-key');
});

test('CHECK_KIRO_RS_CONNECTION prefers current sidepanel payload over stale saved kiro.rs config', async () => {
  const source = fs.readFileSync('background/message-router.js', 'utf8');
  const globalScope = { console };
  const api = new Function('self', `${source}; return self.MultiPageBackgroundMessageRouter;`)(globalScope);
  const calls = [];
  const router = api.createMessageRouter({
    getState: async () => ({
      activeFlowId: 'kiro',
      flowId: 'kiro',
      targetId: 'kiro-rs',
      kiroRsUrl: 'https://old.example.com/admin',
      kiroRsKey: 'old-key',
      settingsState: {
        flows: {
          kiro: {
            targetId: 'kiro-rs',
            targets: {
              'kiro-rs': {
                baseUrl: 'https://old.example.com/admin',
                apiKey: 'old-key',
              },
            },
          },
        },
      },
    }),
    testKiroRsConnection: async (baseUrl, apiKey) => {
      calls.push({ baseUrl, apiKey });
      return {
        ok: false,
        status: 401,
        message: 'kiro.rs API Key 被拒绝（HTTP 401：Invalid or missing admin API key）',
      };
    },
  });

  const response = await router.handleMessage({
    type: 'CHECK_KIRO_RS_CONNECTION',
    payload: {
      activeFlowId: 'kiro',
      targetId: 'kiro-rs',
      baseUrl: ' https://new.example.com/admin/ ',
      apiKey: ' new-key ',
    },
  });

  assert.equal(response.ok, false);
  assert.equal(response.status, 401);
  assert.equal(response.message, 'kiro.rs API Key 被拒绝（HTTP 401：Invalid or missing admin API key）');
  assert.deepStrictEqual(calls, [
    {
      baseUrl: 'https://new.example.com/admin/',
      apiKey: ' new-key ',
    },
  ]);
});

test('AUTO_RUN applies current flow selection from payload before starting loop', async () => {
  const source = fs.readFileSync('background/message-router.js', 'utf8');
  const globalScope = { console };
  const api = new Function('self', `${source}; return self.MultiPageBackgroundMessageRouter;`)(globalScope);
  const calls = [];
  const validations = [];
  let state = {
    activeFlowId: 'openai',
    flowId: 'openai',
    targetId: 'cpa',
    plusModeEnabled: false,
    plusPaymentMethod: 'paypal',
  };

  const router = api.createMessageRouter({
    clearStopRequest: () => {},
    getPendingAutoRunTimerPlan: () => null,
    getState: async () => ({ ...state }),
    normalizeRunCount: (value) => Number(value) || 1,
    setState: async (updates) => {
      calls.push({ type: 'setState', updates: { ...updates } });
      state = { ...state, ...updates };
    },
    startAutoRunLoop: (totalRuns, options) => {
      calls.push({ type: 'startAutoRunLoop', totalRuns, options });
    },
    validateAutoRunStart: (validationState, options = {}) => {
      validations.push({
        activeFlowId: validationState?.activeFlowId,
        flowId: validationState?.flowId,
        targetId: validationState?.targetId,
        optionActiveFlowId: options?.activeFlowId,
      });
      return { ok: true, errors: [] };
    },
  });

  const response = await router.handleMessage({
    type: 'AUTO_RUN',
    payload: {
      totalRuns: 1,
      activeFlowId: 'kiro',
      targetId: 'kiro-rs',
    },
  });

  assert.equal(response.ok, true);
  assert.equal(state.activeFlowId, 'kiro');
  assert.equal(state.flowId, 'kiro');
  assert.equal(state.targetId, 'kiro-rs');
  assert.deepStrictEqual(calls, [
    {
      type: 'setState',
      updates: {
        activeFlowId: 'kiro',
        flowId: 'kiro',
        targetId: 'kiro-rs',
      },
    },
    {
      type: 'setState',
      updates: {
        autoRunSkipFailures: false,
      },
    },
    {
      type: 'startAutoRunLoop',
      totalRuns: 1,
      options: {
        autoRunSkipFailures: false,
        mode: 'restart',
      },
    },
  ]);
  assert.deepStrictEqual(validations, [
    {
      activeFlowId: 'kiro',
      flowId: 'kiro',
      targetId: 'kiro-rs',
      optionActiveFlowId: 'kiro',
    },
  ]);
});

test('SAVE_SETTING re-resolves signup method when panel mode changes', async () => {
  const source = fs.readFileSync('background/message-router.js', 'utf8');
  const globalScope = { console };
  const api = new Function('self', `${source}; return self.MultiPageBackgroundMessageRouter;`)(globalScope);
  let state = {
    signupMethod: 'phone',
    phoneVerificationEnabled: true,
    plusModeEnabled: false,
    targetId: 'sub2api',
  };

  const router = api.createMessageRouter({
    addLog: async () => {},
    buildLuckmailSessionSettingsPayload: () => ({}),
    buildPersistentSettingsPayload: (input = {}) => Object.prototype.hasOwnProperty.call(input, 'targetId')
      ? { targetId: input.targetId }
      : {},
    broadcastDataUpdate: () => {},
    getState: async () => ({ ...state }),
    resolveSignupMethod: (nextState = {}) => nextState.targetId === 'cpa' ? 'email' : 'phone',
    setPersistentSettings: async (updates) => ({ ...updates }),
    setState: async (updates) => {
      state = { ...state, ...updates };
    },
  });

  const response = await router.handleMessage({
    type: 'SAVE_SETTING',
    payload: { targetId: 'cpa' },
  });

  assert.equal(response.ok, true);
  assert.equal(state.targetId, 'cpa');
  assert.equal(state.signupMethod, 'email');
});

test('SAVE_SETTING applies shared mode-switch normalization before persisting incompatible capability flags', async () => {
  const source = fs.readFileSync('background/message-router.js', 'utf8');
  const globalScope = { console };
  const api = new Function('self', `${source}; return self.MultiPageBackgroundMessageRouter;`)(globalScope);
  const persistedPayloads = [];
  let state = {
    activeFlowId: 'site-a',
    signupMethod: 'email',
    phoneVerificationEnabled: false,
    plusModeEnabled: false,
    targetId: 'cpa',
  };

  const router = api.createMessageRouter({
    addLog: async () => {},
    buildLuckmailSessionSettingsPayload: () => ({}),
    buildPersistentSettingsPayload: (input = {}) => ({
      plusModeEnabled: Boolean(input.plusModeEnabled),
      phoneVerificationEnabled: Boolean(input.phoneVerificationEnabled),
      signupMethod: String(input.signupMethod || 'email'),
    }),
    broadcastDataUpdate: () => {},
    getState: async () => ({ ...state }),
    resolveSignupMethod: (nextState = {}) => (
      Boolean(nextState.phoneVerificationEnabled) && Boolean(nextState.plusModeEnabled) ? 'phone' : 'email'
    ),
    setPersistentSettings: async (updates) => {
      persistedPayloads.push({ ...updates });
      return { ...updates };
    },
    setState: async (updates) => {
      state = { ...state, ...updates };
    },
    validateModeSwitch: () => ({
      ok: false,
      errors: [{ code: 'plus_mode_unsupported', message: '当前 flow 不支持 Plus 模式。' }],
      normalizedUpdates: {
        plusModeEnabled: false,
        phoneVerificationEnabled: false,
        signupMethod: 'email',
      },
    }),
  });

  const response = await router.handleMessage({
    type: 'SAVE_SETTING',
    payload: {
      plusModeEnabled: true,
      phoneVerificationEnabled: true,
      signupMethod: 'phone',
    },
  });

  assert.equal(response.ok, true);
  assert.equal(state.plusModeEnabled, false);
  assert.equal(state.phoneVerificationEnabled, false);
  assert.equal(state.signupMethod, 'email');
  assert.deepEqual(persistedPayloads[0], {
    plusModeEnabled: false,
    phoneVerificationEnabled: false,
    signupMethod: 'email',
  });
  assert.equal(response.modeValidation?.errors?.[0]?.code, 'plus_mode_unsupported');
});
