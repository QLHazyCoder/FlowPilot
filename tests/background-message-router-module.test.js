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
    setPersistentSettings: async () => {},
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
    setPersistentSettings: async () => {},
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
    setPersistentSettings: async () => {},
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

test('SAVE_SETTING re-resolves signup method when panel mode changes', async () => {
  const source = fs.readFileSync('background/message-router.js', 'utf8');
  const globalScope = { console };
  const api = new Function('self', `${source}; return self.MultiPageBackgroundMessageRouter;`)(globalScope);
  let state = {
    signupMethod: 'phone',
    phoneVerificationEnabled: true,
    plusModeEnabled: false,
    panelMode: 'sub2api',
  };

  const router = api.createMessageRouter({
    addLog: async () => {},
    buildLuckmailSessionSettingsPayload: () => ({}),
    buildPersistentSettingsPayload: (input = {}) => Object.prototype.hasOwnProperty.call(input, 'panelMode')
      ? { panelMode: input.panelMode }
      : {},
    broadcastDataUpdate: () => {},
    getState: async () => ({ ...state }),
    resolveSignupMethod: (nextState = {}) => nextState.panelMode === 'cpa' ? 'email' : 'phone',
    setPersistentSettings: async () => {},
    setState: async (updates) => {
      state = { ...state, ...updates };
    },
  });

  const response = await router.handleMessage({
    type: 'SAVE_SETTING',
    payload: { panelMode: 'cpa' },
  });

  assert.equal(response.ok, true);
  assert.equal(state.panelMode, 'cpa');
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
    panelMode: 'cpa',
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
