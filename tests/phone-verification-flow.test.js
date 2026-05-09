const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');

const source = fs.readFileSync('background/phone-verification-flow.js', 'utf8');
const globalScope = {};
const api = new Function('self', `${source}; return self.MultiPageBackgroundPhoneVerification;`)(globalScope);

function buildHeroSmsPricesPayload({ country = '52', service = 'dr', cost = 0.08, count = 25370, physicalCount = 14528 } = {}) {
  return JSON.stringify({
    [country]: {
      [service]: {
        cost,
        count,
        physicalCount,
      },
    },
  });
}

function buildHeroSmsStatusV2Payload({ smsCode = '', smsText = '', callCode = '' } = {}) {
  return JSON.stringify({
    verificationType: 2,
    sms: {
      dateTime: '2026-02-18T16:11:33+00:00',
      code: smsCode,
      text: smsText,
    },
    call: {
      code: callCode,
    },
  });
}

test('phone verification helper requests HeroSMS numbers with fixed OpenAI and Thailand parameters', async () => {
  const requests = [];
  const helpers = api.createPhoneVerificationHelpers({
    addLog: async () => {},
    ensureStep8SignupPageReady: async () => {},
    fetchImpl: async (url) => {
      const parsedUrl = new URL(url);
      requests.push(parsedUrl);
      const action = parsedUrl.searchParams.get('action');
      if (action === 'getPrices') {
        return {
          ok: true,
          text: async () => buildHeroSmsPricesPayload(),
        };
      }
      return {
        ok: true,
        text: async () => 'ACCESS_NUMBER:123456:66959916439',
      };
    },
    getState: async () => ({ heroSmsApiKey: 'demo-key' }),
    sendToContentScriptResilient: async () => ({}),
    setState: async () => {},
    sleepWithStop: async () => {},
    throwIfStopped: () => {},
  });

  const activation = await helpers.requestPhoneActivation({ heroSmsApiKey: 'demo-key' });

  assert.deepStrictEqual(activation, {
    activationId: '123456',
    phoneNumber: '66959916439',
    provider: 'hero-sms',
    serviceCode: 'dr',
    countryId: 52,
    successfulUses: 0,
    maxUses: 3,
  });
  assert.equal(requests.length, 2);
  assert.equal(requests[0].searchParams.get('action'), 'getPrices');
  assert.equal(requests[0].searchParams.get('service'), 'dr');
  assert.equal(requests[0].searchParams.get('country'), '52');
  assert.equal(requests[0].searchParams.get('api_key'), 'demo-key');
  assert.equal(requests[1].searchParams.get('action'), 'getNumber');
  assert.equal(requests[1].searchParams.get('maxPrice'), '0.08');
  assert.equal(requests[1].searchParams.get('fixedPrice'), 'true');
  assert.equal(requests[1].searchParams.get('service'), 'dr');
  assert.equal(requests[1].searchParams.get('country'), '52');
  assert.equal(requests[1].searchParams.get('api_key'), 'demo-key');
});

test('signup phone helper persists signup runtime state without touching add-phone activation', async () => {
  const setStateCalls = [];
  let currentState = {
    heroSmsApiKey: 'demo-key',
    currentPhoneActivation: {
      activationId: 'add-phone-activation',
      phoneNumber: '66880000000',
      provider: 'hero-sms',
      serviceCode: 'dr',
      countryId: 52,
      successfulUses: 0,
      maxUses: 3,
    },
  };
  const helpers = api.createPhoneVerificationHelpers({
    addLog: async () => {},
    ensureStep8SignupPageReady: async () => {},
    fetchImpl: async (url) => {
      const parsedUrl = new URL(url);
      const action = parsedUrl.searchParams.get('action');
      if (action === 'getPrices') {
        return {
          ok: true,
          text: async () => buildHeroSmsPricesPayload(),
        };
      }
      if (action === 'getNumber') {
        return {
          ok: true,
          text: async () => 'ACCESS_NUMBER:signup-123:66959916439',
        };
      }
      throw new Error(`Unexpected HeroSMS action: ${action}`);
    },
    getState: async () => currentState,
    sendToContentScriptResilient: async () => ({}),
    setState: async (updates) => {
      setStateCalls.push(updates);
      currentState = { ...currentState, ...updates };
    },
    sleepWithStop: async () => {},
    throwIfStopped: () => {},
  });

  const activation = await helpers.prepareSignupPhoneActivation(currentState);

  assert.equal(activation.activationId, 'signup-123');
  assert.equal(activation.phoneNumber, '66959916439');
  assert.equal(currentState.signupPhoneNumber, '66959916439');
  assert.equal(currentState.signupPhoneVerificationPurpose, 'signup');
  assert.deepStrictEqual(currentState.signupPhoneActivation, activation);
  assert.equal(currentState.accountIdentifierType, 'phone');
  assert.equal(currentState.accountIdentifier, '66959916439');
  assert.equal(currentState.currentPhoneActivation.activationId, 'add-phone-activation');
  assert.ok(!setStateCalls.some((updates) => Object.prototype.hasOwnProperty.call(updates, 'currentPhoneActivation')));
});

test('signup phone helper polls signup SMS code and keeps activation purpose isolated', async () => {
  const setStateCalls = [];
  let currentState = {
    heroSmsApiKey: 'demo-key',
    phoneCodeWaitSeconds: 15,
    phoneCodeTimeoutWindows: 1,
    phoneCodePollIntervalSeconds: 1,
    phoneCodePollMaxRounds: 2,
    signupPhoneActivation: {
      activationId: 'signup-123',
      phoneNumber: '66959916439',
      provider: 'hero-sms',
      serviceCode: 'dr',
      countryId: 52,
      successfulUses: 0,
      maxUses: 3,
    },
    currentPhoneActivation: {
      activationId: 'add-phone-activation',
      phoneNumber: '66880000000',
      provider: 'hero-sms',
      serviceCode: 'dr',
      countryId: 52,
      successfulUses: 0,
      maxUses: 3,
    },
  };
  const helpers = api.createPhoneVerificationHelpers({
    addLog: async () => {},
    ensureStep8SignupPageReady: async () => {},
    fetchImpl: async (url) => {
      const parsedUrl = new URL(url);
      const action = parsedUrl.searchParams.get('action');
      if (action === 'getStatus') {
        return {
          ok: true,
          text: async () => 'STATUS_OK:123456',
        };
      }
      throw new Error(`Unexpected HeroSMS action: ${action}`);
    },
    getOAuthFlowStepTimeoutMs: async (fallback) => fallback,
    getState: async () => currentState,
    sendToContentScriptResilient: async () => ({}),
    setState: async (updates) => {
      setStateCalls.push(updates);
      currentState = { ...currentState, ...updates };
    },
    sleepWithStop: async () => {},
    throwIfStopped: () => {},
  });

  const code = await helpers.waitForSignupPhoneCode(currentState, currentState.signupPhoneActivation);

  assert.equal(code, '123456');
  assert.equal(currentState.currentPhoneVerificationCode, '123456');
  assert.equal(currentState.signupPhoneNumber, '66959916439');
  assert.equal(currentState.signupPhoneVerificationPurpose, 'signup');
  assert.equal(currentState.currentPhoneActivation.activationId, 'add-phone-activation');
  assert.ok(setStateCalls.some((updates) => updates.signupPhoneVerificationRequestedAt));
  assert.ok(!setStateCalls.some((updates) => Object.prototype.hasOwnProperty.call(updates, 'currentPhoneActivation')));
});

test('signup phone helper finalizes or cancels signup activation without clearing add-phone activation', async () => {
  const setStateCalls = [];
  const statusActions = [];
  let currentState = {
    heroSmsApiKey: 'demo-key',
    heroSmsReuseEnabled: false,
    signupPhoneActivation: {
      activationId: 'signup-123',
      phoneNumber: '66959916439',
      provider: 'hero-sms',
      serviceCode: 'dr',
      countryId: 52,
      successfulUses: 0,
      maxUses: 3,
    },
    currentPhoneActivation: {
      activationId: 'add-phone-activation',
      phoneNumber: '66880000000',
      provider: 'hero-sms',
      serviceCode: 'dr',
      countryId: 52,
      successfulUses: 0,
      maxUses: 3,
    },
  };
  const helpers = api.createPhoneVerificationHelpers({
    addLog: async () => {},
    ensureStep8SignupPageReady: async () => {},
    fetchImpl: async (url) => {
      const parsedUrl = new URL(url);
      const action = parsedUrl.searchParams.get('action');
      if (action === 'setStatus') {
        statusActions.push(parsedUrl.searchParams.get('status'));
        return {
          ok: true,
          text: async () => 'ACCESS_READY',
        };
      }
      throw new Error(`Unexpected HeroSMS action: ${action}`);
    },
    getState: async () => currentState,
    sendToContentScriptResilient: async () => ({}),
    setState: async (updates) => {
      setStateCalls.push(updates);
      currentState = { ...currentState, ...updates };
    },
    sleepWithStop: async () => {},
    throwIfStopped: () => {},
  });

  await helpers.finalizeSignupPhoneActivationAfterSuccess(currentState, currentState.signupPhoneActivation);

  assert.deepStrictEqual(statusActions, ['6']);
  assert.equal(currentState.signupPhoneNumber, '66959916439');
  assert.equal(currentState.signupPhoneActivation, null);
  assert.deepStrictEqual(currentState.signupPhoneCompletedActivation, {
    activationId: 'signup-123',
    phoneNumber: '66959916439',
    provider: 'hero-sms',
    serviceCode: 'dr',
    countryId: 52,
    successfulUses: 1,
    maxUses: 3,
  });
  assert.equal(currentState.signupPhoneVerificationPurpose, '');
  assert.equal(currentState.accountIdentifierType, 'phone');
  assert.equal(currentState.accountIdentifier, '66959916439');
  assert.equal(currentState.currentPhoneActivation.activationId, 'add-phone-activation');
  assert.ok(!setStateCalls.some((updates) => Object.prototype.hasOwnProperty.call(updates, 'currentPhoneActivation')));
});

test('signup phone helper completes signup SMS verification without touching add-phone activation', async () => {
  const setStateCalls = [];
  const contentMessages = [];
  const statusActions = [];
  let currentState = {
    heroSmsApiKey: 'demo-key',
    heroSmsReuseEnabled: false,
    phoneCodeWaitSeconds: 15,
    phoneCodeTimeoutWindows: 1,
    phoneCodePollIntervalSeconds: 1,
    phoneCodePollMaxRounds: 2,
    signupPhoneNumber: '66959916439',
    signupPhoneVerificationPurpose: 'signup',
    signupPhoneActivation: {
      activationId: 'signup-123',
      phoneNumber: '66959916439',
      provider: 'hero-sms',
      serviceCode: 'dr',
      countryId: 52,
      successfulUses: 0,
      maxUses: 3,
    },
    currentPhoneActivation: {
      activationId: 'add-phone-activation',
      phoneNumber: '66880000000',
      provider: 'hero-sms',
      serviceCode: 'dr',
      countryId: 52,
      successfulUses: 0,
      maxUses: 3,
    },
  };
  const helpers = api.createPhoneVerificationHelpers({
    addLog: async () => {},
    ensureStep8SignupPageReady: async () => {},
    fetchImpl: async (url) => {
      const parsedUrl = new URL(url);
      const action = parsedUrl.searchParams.get('action');
      if (action === 'getStatus') {
        return {
          ok: true,
          text: async () => 'STATUS_OK:123456',
        };
      }
      if (action === 'setStatus') {
        statusActions.push(parsedUrl.searchParams.get('status'));
        return {
          ok: true,
          text: async () => 'ACCESS_READY',
        };
      }
      throw new Error(`Unexpected HeroSMS action: ${action}`);
    },
    getOAuthFlowStepTimeoutMs: async (fallback) => fallback,
    getState: async () => currentState,
    sendToContentScriptResilient: async (_source, message) => {
      contentMessages.push(message);
      if (message.type === 'SUBMIT_PHONE_VERIFICATION_CODE') {
        return { success: true };
      }
      throw new Error(`Unexpected content-script message: ${message.type}`);
    },
    setState: async (updates) => {
      setStateCalls.push(updates);
      currentState = { ...currentState, ...updates };
    },
    sleepWithStop: async () => {},
    throwIfStopped: () => {},
  });

  const result = await helpers.completeSignupPhoneVerificationFlow(77, {
    state: currentState,
    signupProfile: {
      firstName: 'Ada',
      lastName: 'Lovelace',
      year: 1995,
      month: 1,
      day: 2,
    },
  });

  assert.deepStrictEqual(result, { success: true });
  assert.deepStrictEqual(statusActions, ['6']);
  assert.deepStrictEqual(contentMessages.map((message) => ({
    type: message.type,
    step: message.step,
    code: message.payload?.code,
    purpose: message.payload?.purpose,
  })), [
    {
      type: 'SUBMIT_PHONE_VERIFICATION_CODE',
      step: 4,
      code: '123456',
      purpose: 'signup',
    },
  ]);
  assert.equal(currentState.signupPhoneNumber, '66959916439');
  assert.equal(currentState.signupPhoneActivation, null);
  assert.equal(currentState.signupPhoneVerificationPurpose, '');
  assert.equal(currentState.currentPhoneVerificationCode, '');
  assert.equal(currentState.currentPhoneActivation.activationId, 'add-phone-activation');
  assert.ok(!setStateCalls.some((updates) => Object.prototype.hasOwnProperty.call(updates, 'currentPhoneActivation')));
});

test('signup phone helper completes login SMS verification by reusing the completed signup activation', async () => {
  const setStateCalls = [];
  const contentMessages = [];
  const statusActions = [];
  let currentState = {
    heroSmsApiKey: 'demo-key',
    phoneCodeWaitSeconds: 15,
    phoneCodeTimeoutWindows: 1,
    phoneCodePollIntervalSeconds: 1,
    phoneCodePollMaxRounds: 2,
    signupPhoneCompletedActivation: {
      activationId: 'signup-done',
      phoneNumber: '66959916439',
      provider: 'hero-sms',
      serviceCode: 'dr',
      countryId: 52,
      countryLabel: 'Thailand',
      successfulUses: 1,
      maxUses: 3,
    },
    currentPhoneActivation: {
      activationId: 'add-phone-activation',
      phoneNumber: '66880000000',
      provider: 'hero-sms',
      serviceCode: 'dr',
      countryId: 52,
      successfulUses: 0,
      maxUses: 3,
    },
  };
  const helpers = api.createPhoneVerificationHelpers({
    addLog: async () => {},
    ensureStep8SignupPageReady: async () => {},
    fetchImpl: async (url) => {
      const parsedUrl = new URL(url);
      const action = parsedUrl.searchParams.get('action');
      const id = parsedUrl.searchParams.get('id');
      if (action === 'reactivate' && id === 'signup-done') {
        return {
          ok: true,
          text: async () => 'ACCESS_READY',
        };
      }
      if (action === 'getStatus' && id === 'signup-done') {
        return {
          ok: true,
          text: async () => 'STATUS_OK:654321',
        };
      }
      if (action === 'setStatus' && id === 'signup-done') {
        statusActions.push(parsedUrl.searchParams.get('status'));
        return {
          ok: true,
          text: async () => 'ACCESS_READY',
        };
      }
      throw new Error(`Unexpected HeroSMS action: ${action}:${id}`);
    },
    getOAuthFlowStepTimeoutMs: async (fallback) => fallback,
    getState: async () => currentState,
    sendToContentScriptResilient: async (_source, message) => {
      contentMessages.push(message);
      if (message.type === 'SUBMIT_PHONE_VERIFICATION_CODE') {
        return { success: true };
      }
      throw new Error(`Unexpected content-script message: ${message.type}`);
    },
    setState: async (updates) => {
      setStateCalls.push(updates);
      currentState = { ...currentState, ...updates };
    },
    sleepWithStop: async () => {},
    throwIfStopped: () => {},
  });

  const result = await helpers.completeLoginPhoneVerificationFlow(77, {
    state: currentState,
    visibleStep: 8,
  });

  assert.deepStrictEqual(result, { success: true });
  assert.deepStrictEqual(statusActions, ['6']);
  assert.deepStrictEqual(contentMessages.map((message) => ({
    type: message.type,
    step: message.step,
    code: message.payload?.code,
    purpose: message.payload?.purpose,
  })), [
    {
      type: 'SUBMIT_PHONE_VERIFICATION_CODE',
      step: 8,
      code: '654321',
      purpose: 'login',
    },
  ]);
  assert.equal(currentState.signupPhoneActivation, null);
  assert.equal(currentState.signupPhoneVerificationPurpose, '');
  assert.equal(currentState.currentPhoneVerificationCode, '');
  assert.deepStrictEqual(currentState.signupPhoneCompletedActivation, {
    activationId: 'signup-done',
    phoneNumber: '66959916439',
    provider: 'hero-sms',
    serviceCode: 'dr',
    countryId: 52,
    countryLabel: 'Thailand',
    successfulUses: 2,
    maxUses: 3,
  });
  assert.equal(currentState.currentPhoneActivation.activationId, 'add-phone-activation');
  assert.ok(setStateCalls.some((updates) => updates.signupPhoneVerificationPurpose === 'login'));
  assert.ok(!setStateCalls.some((updates) => Object.prototype.hasOwnProperty.call(updates, 'currentPhoneActivation')));
});

test('phone verification helper ignores HeroSMS virtual-only stock when physicalCount is zero', async () => {
  const requests = [];
  const helpers = api.createPhoneVerificationHelpers({
    addLog: async () => {},
    ensureStep8SignupPageReady: async () => {},
    fetchImpl: async (url) => {
      const parsedUrl = new URL(url);
      requests.push(parsedUrl);
      const action = parsedUrl.searchParams.get('action');
      if (action === 'getPrices') {
        return {
          ok: true,
          text: async () => buildHeroSmsPricesPayload({ count: 3, physicalCount: 0, cost: 0.05 }),
        };
      }
      if (action === 'getNumber' || action === 'getNumberV2') {
        return {
          ok: true,
          text: async () => 'NO_NUMBERS',
        };
      }
      throw new Error(`Unexpected HeroSMS action: ${action}`);
    },
    getState: async () => ({ heroSmsApiKey: 'demo-key' }),
    sendToContentScriptResilient: async () => ({}),
    setState: async () => {},
    sleepWithStop: async () => {},
    throwIfStopped: () => {},
  });

  await assert.rejects(
    helpers.requestPhoneActivation({ heroSmsApiKey: 'demo-key', heroSmsActivationRetryRounds: 1 }),
    /HeroSMS 已尝试 1 个候选国家，均无可用号码/
  );

  const actions = requests.map((requestUrl) => `${requestUrl.searchParams.get('action')}:${requestUrl.searchParams.get('maxPrice') || ''}`);
  assert.deepStrictEqual(actions, [
    'getPrices:',
    'getPrices:',
    'getPrices:',
    'getNumber:',
    'getNumberV2:',
    'getPrices:',
    'getPrices:',
    'getPrices:',
    'getNumber:',
    'getNumberV2:',
  ]);
});

test('phone verification helper retries HeroSMS getPrices until it receives a usable lowest price', async () => {
  const requests = [];
  let getPricesAttempt = 0;
  const helpers = api.createPhoneVerificationHelpers({
    addLog: async () => {},
    ensureStep8SignupPageReady: async () => {},
    fetchImpl: async (url) => {
      const parsedUrl = new URL(url);
      requests.push(parsedUrl);
      const action = parsedUrl.searchParams.get('action');
      if (action === 'getPrices') {
        getPricesAttempt += 1;
        return getPricesAttempt < 3
          ? {
            ok: true,
            text: async () => JSON.stringify({ unavailable: true }),
          }
          : {
            ok: true,
            text: async () => buildHeroSmsPricesPayload({ cost: 0.09 }),
          };
      }
      if (action === 'getNumber') {
        return {
          ok: true,
          text: async () => 'ACCESS_NUMBER:123456:66959916439',
        };
      }
      throw new Error(`Unexpected HeroSMS action: ${action}`);
    },
    getState: async () => ({ heroSmsApiKey: 'demo-key' }),
    sendToContentScriptResilient: async () => ({}),
    setState: async () => {},
    sleepWithStop: async () => {},
    throwIfStopped: () => {},
  });

  await helpers.requestPhoneActivation({ heroSmsApiKey: 'demo-key' });

  assert.equal(requests.length, 4);
  assert.equal(requests[0].searchParams.get('action'), 'getPrices');
  assert.equal(requests[1].searchParams.get('action'), 'getPrices');
  assert.equal(requests[2].searchParams.get('action'), 'getPrices');
  assert.equal(requests[3].searchParams.get('action'), 'getNumber');
  assert.equal(requests[3].searchParams.get('maxPrice'), '0.09');
  assert.equal(requests[3].searchParams.get('fixedPrice'), 'true');
});

test('phone verification helper falls back to plain getNumber only after HeroSMS getPrices fails three times', async () => {
  const requests = [];
  let getPricesAttempt = 0;
  const helpers = api.createPhoneVerificationHelpers({
    addLog: async () => {},
    ensureStep8SignupPageReady: async () => {},
    fetchImpl: async (url) => {
      const parsedUrl = new URL(url);
      requests.push(parsedUrl);
      const action = parsedUrl.searchParams.get('action');
      if (action === 'getPrices') {
        getPricesAttempt += 1;
        return {
          ok: true,
          text: async () => JSON.stringify({ unavailable: getPricesAttempt }),
        };
      }
      if (action === 'getNumber') {
        return {
          ok: true,
          text: async () => 'ACCESS_NUMBER:123456:66959916439',
        };
      }
      throw new Error(`Unexpected HeroSMS action: ${action}`);
    },
    getState: async () => ({ heroSmsApiKey: 'demo-key' }),
    sendToContentScriptResilient: async () => ({}),
    setState: async () => {},
    sleepWithStop: async () => {},
    throwIfStopped: () => {},
  });

  await helpers.requestPhoneActivation({ heroSmsApiKey: 'demo-key' });

  assert.equal(requests.length, 4);
  assert.equal(requests[0].searchParams.get('action'), 'getPrices');
  assert.equal(requests[1].searchParams.get('action'), 'getPrices');
  assert.equal(requests[2].searchParams.get('action'), 'getPrices');
  assert.equal(requests[2].searchParams.get('service'), 'dr');
  assert.equal(requests[2].searchParams.get('country'), '52');
  assert.equal(requests[2].searchParams.get('api_key'), 'demo-key');
  assert.equal(requests[3].searchParams.get('action'), 'getNumber');
  assert.equal(requests[3].searchParams.get('maxPrice'), null);
  assert.equal(requests[3].searchParams.get('fixedPrice'), null);
});

test('phone verification helper retries with HeroSMS getNumberV2 when getNumber reports NO_NUMBERS', async () => {
  const requests = [];
  const helpers = api.createPhoneVerificationHelpers({
    addLog: async () => {},
    ensureStep8SignupPageReady: async () => {},
    fetchImpl: async (url) => {
      const parsedUrl = new URL(url);
      requests.push(parsedUrl);
      const action = parsedUrl.searchParams.get('action');
      if (action === 'getPrices') {
        return {
          ok: true,
          text: async () => buildHeroSmsPricesPayload({ country: '16' }),
        };
      }
      if (action === 'getNumber') {
        return {
          ok: true,
          text: async () => 'NO_NUMBERS',
        };
      }
      if (action === 'getNumberV2') {
        return {
          ok: true,
          text: async () => JSON.stringify({
            activationId: '654321',
            phoneNumber: '447911123456',
          }),
        };
      }
      throw new Error(`Unexpected HeroSMS action: ${action}`);
    },
    getState: async () => ({ heroSmsApiKey: 'demo-key', heroSmsCountryId: 16 }),
    sendToContentScriptResilient: async () => ({}),
    setState: async () => {},
    sleepWithStop: async () => {},
    throwIfStopped: () => {},
  });

  const activation = await helpers.requestPhoneActivation({
    heroSmsApiKey: 'demo-key',
    heroSmsCountryId: 16,
  });

  assert.deepStrictEqual(activation, {
    activationId: '654321',
    phoneNumber: '447911123456',
    provider: 'hero-sms',
    serviceCode: 'dr',
    countryId: 16,
    successfulUses: 0,
    maxUses: 3,
    statusAction: 'getStatusV2',
  });
  assert.equal(requests.length, 3);
  assert.equal(requests[0].searchParams.get('action'), 'getPrices');
  assert.equal(requests[0].searchParams.get('country'), '16');
  assert.equal(requests[1].searchParams.get('action'), 'getNumber');
  assert.equal(requests[1].searchParams.get('country'), '16');
  assert.equal(requests[1].searchParams.get('maxPrice'), '0.08');
  assert.equal(requests[1].searchParams.get('fixedPrice'), 'true');
  assert.equal(requests[2].searchParams.get('action'), 'getNumberV2');
  assert.equal(requests[2].searchParams.get('country'), '16');
  assert.equal(requests[2].searchParams.get('maxPrice'), '0.08');
  assert.equal(requests[2].searchParams.get('fixedPrice'), 'true');
});

test('phone verification helper applies ordered fallback countries when primary country has no numbers', async () => {
  const requests = [];
  const helpers = api.createPhoneVerificationHelpers({
    addLog: async () => {},
    ensureStep8SignupPageReady: async () => {},
    fetchImpl: async (url) => {
      const parsedUrl = new URL(url);
      requests.push(parsedUrl);
      const action = parsedUrl.searchParams.get('action');
      const country = parsedUrl.searchParams.get('country');

      if (action === 'getPrices') {
        return {
          ok: true,
          text: async () => JSON.stringify({
            [country]: {
              dr: {
                cost: 0.08,
                count: 100,
              },
            },
          }),
        };
      }

      if (action === 'getNumber' || action === 'getNumberV2') {
        if (country === '52') {
          return { ok: true, text: async () => 'NO_NUMBERS' };
        }
        if (country === '16' && action === 'getNumber') {
          return { ok: true, text: async () => 'ACCESS_NUMBER:861234:447955001122' };
        }
      }

      throw new Error(`Unexpected HeroSMS action: ${action} @ country ${country}`);
    },
    getState: async () => ({ heroSmsApiKey: 'demo-key', heroSmsCountryId: 52 }),
    sendToContentScriptResilient: async () => ({}),
    setState: async () => {},
    sleepWithStop: async () => {},
    throwIfStopped: () => {},
  });

  const activation = await helpers.requestPhoneActivation({
    heroSmsApiKey: 'demo-key',
    heroSmsCountryId: 52,
    heroSmsCountryLabel: 'Thailand',
    heroSmsCountryFallback: [{ id: 16, label: 'United Kingdom' }],
  });

  assert.equal(activation.countryId, 16);
  assert.equal(activation.phoneNumber, '447955001122');
  const actionTrace = requests.map((requestUrl) => `${requestUrl.searchParams.get('action')}:${requestUrl.searchParams.get('country')}`);
  assert.deepStrictEqual(actionTrace, [
    'getPrices:52',
    'getNumber:52',
    'getNumberV2:52',
    'getPrices:16',
    'getNumber:16',
  ]);
});

test('phone verification helper honors price-priority acquisition mode across selected countries', async () => {
  const requests = [];
  const helpers = api.createPhoneVerificationHelpers({
    addLog: async () => {},
    ensureStep8SignupPageReady: async () => {},
    fetchImpl: async (url) => {
      const parsedUrl = new URL(url);
      requests.push(parsedUrl);
      const action = parsedUrl.searchParams.get('action');
      const country = parsedUrl.searchParams.get('country');

      if (action === 'getPrices') {
        const cost = country === '52' ? 0.08 : 0.05;
        return {
          ok: true,
          text: async () => JSON.stringify({
            [country]: {
              dr: {
                cost,
                count: 100,
              },
            },
          }),
        };
      }

      if (action === 'getNumber') {
        return {
          ok: true,
          text: async () => `ACCESS_NUMBER:${country}001:44795500${country}`,
        };
      }

      throw new Error(`Unexpected HeroSMS action: ${action} @ country ${country}`);
    },
    getState: async () => ({ heroSmsApiKey: 'demo-key', heroSmsCountryId: 52 }),
    sendToContentScriptResilient: async () => ({}),
    setState: async () => {},
    sleepWithStop: async () => {},
    throwIfStopped: () => {},
  });

  const activation = await helpers.requestPhoneActivation({
    heroSmsApiKey: 'demo-key',
    heroSmsCountryId: 52,
    heroSmsCountryLabel: 'Thailand',
    heroSmsCountryFallback: [{ id: 16, label: 'United Kingdom' }],
    heroSmsAcquirePriority: 'price',
  });

  assert.equal(activation.countryId, 16);
  const actionTrace = requests.map((requestUrl) => `${requestUrl.searchParams.get('action')}:${requestUrl.searchParams.get('country')}`);
  assert.deepStrictEqual(actionTrace, [
    'getPrices:52',
    'getPrices:16',
    'getNumber:16',
  ]);
});

test('phone verification helper retries acquisition rounds when at least one country reports transient NO_NUMBERS', async () => {
  const requests = [];
  const logs = [];
  const sleeps = [];
  let thailandGetNumberCalls = 0;

  const helpers = api.createPhoneVerificationHelpers({
    addLog: async (message, level) => {
      logs.push({ message, level });
    },
    ensureStep8SignupPageReady: async () => {},
    fetchImpl: async (url) => {
      const parsedUrl = new URL(url);
      requests.push(parsedUrl);
      const action = parsedUrl.searchParams.get('action');
      const country = parsedUrl.searchParams.get('country');

      if (action === 'getPrices') {
        if (country === '52') {
          return {
            ok: true,
            text: async () => buildHeroSmsPricesPayload({ country: '52', cost: 0.05, count: 20 }),
          };
        }
        return {
          ok: true,
          text: async () => buildHeroSmsPricesPayload({ country, cost: 0.3, count: 20 }),
        };
      }

      if (action === 'getNumber' || action === 'getNumberV2') {
        if (country === '52') {
          if (action === 'getNumber') {
            thailandGetNumberCalls += 1;
            if (thailandGetNumberCalls >= 2) {
              return {
                ok: true,
                text: async () => 'ACCESS_NUMBER:991122:66951112233',
              };
            }
          }
          return { ok: true, text: async () => 'NO_NUMBERS: Numbers Not Found. Try Later' };
        }
        return { ok: true, text: async () => 'NO_NUMBERS: Numbers Not Found. Try Later' };
      }

      throw new Error(`Unexpected HeroSMS action: ${action} @ country ${country}`);
    },
    getState: async () => ({ heroSmsApiKey: 'demo-key' }),
    sendToContentScriptResilient: async () => ({}),
    setState: async () => {},
    sleepWithStop: async (ms) => {
      sleeps.push(ms);
    },
    throwIfStopped: () => {},
  });

  const activation = await helpers.requestPhoneActivation({
    heroSmsApiKey: 'demo-key',
    heroSmsMaxPrice: '0.06',
    heroSmsCountryId: 52,
    heroSmsCountryLabel: 'Thailand',
    heroSmsCountryFallback: [
      { id: 6, label: 'Canada' },
      { id: 5, label: 'Japan' },
    ],
    // Simulate stale state value; helper should still perform at least 2 rounds.
    heroSmsActivationRetryRounds: 1,
  });

  assert.equal(activation.countryId, 52);
  assert.equal(activation.phoneNumber, '66951112233');
  assert.equal(sleeps.length, 1);
  assert.equal(sleeps[0], 2000);
  assert.equal(
    logs.filter((entry) => String(entry.message || '').includes('HeroSMS 正在获取手机号')).length >= 2,
    true
  );
  assert.equal(
    logs.some((entry) => String(entry.message || '').includes('HeroSMS 暂无可用号码（第 1/2 轮）')),
    true
  );
});

test('phone verification helper fails fast when HeroSMS country list is empty', async () => {
  const helpers = api.createPhoneVerificationHelpers({
    addLog: async () => {},
    ensureStep8SignupPageReady: async () => {},
    fetchImpl: async () => {
      throw new Error('Unexpected fetch when no countries are configured.');
    },
    getState: async () => ({ heroSmsApiKey: 'demo-key', heroSmsCountryId: 0, heroSmsCountryFallback: [] }),
    sendToContentScriptResilient: async () => ({}),
    setState: async () => {},
    sleepWithStop: async () => {},
    throwIfStopped: () => {},
  });

  await assert.rejects(
    helpers.requestPhoneActivation({
      heroSmsApiKey: 'demo-key',
      heroSmsCountryId: 0,
      heroSmsCountryFallback: [],
    }),
    /HeroSMS countries are empty/i
  );
});

test('phone verification helper uses HeroSMS getStatusV2 after acquiring a number via getNumberV2', async () => {
  const requests = [];
  const stateUpdates = [];
  let currentState = {
    heroSmsApiKey: 'demo-key',
    heroSmsCountryId: 16,
    heroSmsCountryLabel: 'United Kingdom',
    verificationResendCount: 0,
    currentPhoneActivation: null,
    reusablePhoneActivation: null,
  };
  let statusPollCount = 0;

  const helpers = api.createPhoneVerificationHelpers({
    addLog: async () => {},
    ensureStep8SignupPageReady: async () => {},
    fetchImpl: async (url) => {
      const parsedUrl = new URL(url);
      requests.push(parsedUrl);
      const action = parsedUrl.searchParams.get('action');
      if (action === 'getPrices') {
        return {
          ok: true,
          text: async () => buildHeroSmsPricesPayload({ country: '16' }),
        };
      }
      if (action === 'getNumber') {
        return {
          ok: true,
          text: async () => 'NO_NUMBERS',
        };
      }
      if (action === 'getNumberV2') {
        return {
          ok: true,
          text: async () => JSON.stringify({
            activationId: '654321',
            phoneNumber: '447911123456',
          }),
        };
      }
      if (action === 'getStatusV2') {
        statusPollCount += 1;
        return {
          ok: true,
          text: async () => (
            statusPollCount === 1
              ? buildHeroSmsStatusV2Payload()
              : buildHeroSmsStatusV2Payload({ smsCode: '112233', smsText: 'Your code is 112233' })
          ),
        };
      }
      if (action === 'setStatus') {
        return {
          ok: true,
          text: async () => 'ACCESS_ACTIVATION',
        };
      }
      throw new Error(`Unexpected HeroSMS action: ${action}`);
    },
    getOAuthFlowStepTimeoutMs: async (defaultTimeoutMs) => defaultTimeoutMs,
    getState: async () => ({ ...currentState }),
    sendToContentScriptResilient: async (_source, message) => {
      if (message.type === 'SUBMIT_PHONE_NUMBER') {
        return {
          phoneVerificationPage: true,
          url: 'https://auth.openai.com/phone-verification',
        };
      }
      if (message.type === 'SUBMIT_PHONE_VERIFICATION_CODE') {
        return {
          success: true,
          consentReady: true,
          url: 'https://auth.openai.com/authorize',
        };
      }
      throw new Error(`Unexpected content-script message: ${message.type}`);
    },
    setState: async (updates) => {
      stateUpdates.push(updates);
      currentState = { ...currentState, ...updates };
    },
    sleepWithStop: async () => {},
    throwIfStopped: () => {},
  });

  const result = await helpers.completePhoneVerificationFlow(1, {
    addPhonePage: true,
    phoneVerificationPage: false,
    url: 'https://auth.openai.com/add-phone',
  });

  assert.deepStrictEqual(result, {
    success: true,
    consentReady: true,
    url: 'https://auth.openai.com/authorize',
  });
  assert.equal(Array.isArray(stateUpdates[0]?.heroSmsLastPriceTiers), true);
  assert.equal(stateUpdates[0]?.heroSmsLastPriceCountryId, 16);
  assert.equal(stateUpdates[0]?.heroSmsLastPriceCountryLabel, 'United Kingdom');
  assert.equal(
    stateUpdates.some((entry) => entry?.currentPhoneActivation?.activationId === '654321'),
    true
  );
  assert.equal(
    stateUpdates.some((entry) => entry?.currentPhoneVerificationCode === '112233'),
    true
  );
  assert.equal(
    stateUpdates.some((entry) => entry?.reusablePhoneActivation?.activationId === '654321'),
    true
  );
  assert.equal(
    stateUpdates.some((entry) => entry?.currentPhoneActivation === null && entry?.currentPhoneVerificationCode === ''),
    true
  );
  assert.equal(currentState.phoneNumber, '447911123456');
  const actions = requests.map((url) => url.searchParams.get('action'));
  assert.deepStrictEqual(actions, [
    'getPrices',
    'getNumber',
    'getNumberV2',
    'getStatusV2',
    'getStatusV2',
    'setStatus',
  ]);
});

test('phone verification helper refreshes maxPrice when HeroSMS returns WRONG_MAX_PRICE', async () => {
  const requests = [];
  let getNumberAttempt = 0;
  const helpers = api.createPhoneVerificationHelpers({
    addLog: async () => {},
    ensureStep8SignupPageReady: async () => {},
    fetchImpl: async (url) => {
      const parsedUrl = new URL(url);
      requests.push(parsedUrl);
      const action = parsedUrl.searchParams.get('action');
      if (action === 'getPrices') {
        return {
          ok: true,
          text: async () => buildHeroSmsPricesPayload(),
        };
      }
      if (action === 'getNumber') {
        getNumberAttempt += 1;
        return getNumberAttempt === 1
          ? {
            ok: false,
            text: async () => 'WRONG_MAX_PRICE:0.09',
          }
          : {
            ok: true,
            text: async () => 'ACCESS_NUMBER:123456:66959916439',
          };
      }
      throw new Error(`Unexpected HeroSMS action: ${action}`);
    },
    getState: async () => ({ heroSmsApiKey: 'demo-key' }),
    sendToContentScriptResilient: async () => ({}),
    setState: async () => {},
    sleepWithStop: async () => {},
    throwIfStopped: () => {},
  });

  const activation = await helpers.requestPhoneActivation({ heroSmsApiKey: 'demo-key' });

  assert.deepStrictEqual(activation, {
    activationId: '123456',
    phoneNumber: '66959916439',
    provider: 'hero-sms',
    serviceCode: 'dr',
    countryId: 52,
    successfulUses: 0,
    maxUses: 3,
  });
  assert.equal(requests.length, 3);
  assert.equal(requests[0].searchParams.get('action'), 'getPrices');
  assert.equal(requests[1].searchParams.get('action'), 'getNumber');
  assert.equal(requests[1].searchParams.get('maxPrice'), '0.08');
  assert.equal(requests[2].searchParams.get('action'), 'getNumber');
  assert.equal(requests[2].searchParams.get('maxPrice'), '0.09');
  assert.equal(requests[2].searchParams.get('fixedPrice'), 'true');
});

test('phone verification helper climbs price tiers when NO_NUMBERS is returned at lower prices', async () => {
  const requests = [];
  const helpers = api.createPhoneVerificationHelpers({
    addLog: async () => {},
    ensureStep8SignupPageReady: async () => {},
    fetchImpl: async (url) => {
      const parsedUrl = new URL(url);
      requests.push(parsedUrl);
      const action = parsedUrl.searchParams.get('action');
      const maxPrice = parsedUrl.searchParams.get('maxPrice');
      if (action === 'getPrices') {
        return {
          ok: true,
          text: async () => JSON.stringify({
            52: {
              dr: {
                starter: { cost: 0.08, count: 100 },
                premium: { cost: 0.12, count: 100 },
              },
            },
          }),
        };
      }
      if (action === 'getNumber' && maxPrice === '0.08') {
        return {
          ok: true,
          text: async () => 'NO_NUMBERS',
        };
      }
      if (action === 'getNumberV2' && maxPrice === '0.08') {
        return {
          ok: true,
          text: async () => 'NO_NUMBERS',
        };
      }
      if (action === 'getNumber' && maxPrice === '0.12') {
        return {
          ok: true,
          text: async () => 'ACCESS_NUMBER:989898:66951112222',
        };
      }
      throw new Error(`Unexpected HeroSMS action: ${action} @ ${maxPrice || 'no-price'}`);
    },
    getState: async () => ({ heroSmsApiKey: 'demo-key' }),
    sendToContentScriptResilient: async () => ({}),
    setState: async () => {},
    sleepWithStop: async () => {},
    throwIfStopped: () => {},
  });

  const activation = await helpers.requestPhoneActivation({ heroSmsApiKey: 'demo-key' });
  assert.equal(activation.activationId, '989898');
  const actions = requests.map((requestUrl) => `${requestUrl.searchParams.get('action')}:${requestUrl.searchParams.get('maxPrice') || ''}`);
  assert.deepStrictEqual(actions, [
    'getPrices:',
    'getNumber:0.08',
    'getNumberV2:0.08',
    'getNumber:0.12',
  ]);
});

test('phone verification helper stops when WRONG_MAX_PRICE exceeds configured max price limit', async () => {
  const requests = [];
  const helpers = api.createPhoneVerificationHelpers({
    addLog: async () => {},
    ensureStep8SignupPageReady: async () => {},
    fetchImpl: async (url) => {
      const parsedUrl = new URL(url);
      requests.push(parsedUrl);
      const action = parsedUrl.searchParams.get('action');
      if (action === 'getPrices') {
        return {
          ok: true,
          text: async () => buildHeroSmsPricesPayload({ cost: 0.08 }),
        };
      }
      if (action === 'getNumber' || action === 'getNumberV2') {
        return {
          ok: false,
          text: async () => 'WRONG_MAX_PRICE:0.08',
        };
      }
      throw new Error(`Unexpected HeroSMS action: ${action}`);
    },
    getState: async () => ({ heroSmsApiKey: 'demo-key', heroSmsMaxPrice: '0.05' }),
    sendToContentScriptResilient: async () => ({}),
    setState: async () => {},
    sleepWithStop: async () => {},
    throwIfStopped: () => {},
  });

  await assert.rejects(
    helpers.requestPhoneActivation({ heroSmsApiKey: 'demo-key', heroSmsMaxPrice: '0.05' }),
    /exceeds configured maxPrice=0\.05/i
  );

  const actions = requests.map((requestUrl) => `${requestUrl.searchParams.get('action')}:${requestUrl.searchParams.get('maxPrice') || ''}`);
  assert.deepStrictEqual(actions, [
    'getPrices:',
    'getNumber:0.05',
    'getNumberV2:0.05',
  ]);
});

test('phone verification helper falls back to plain getNumber when priced request fails to fetch', async () => {
  const requests = [];
  let getNumberAttempt = 0;
  const helpers = api.createPhoneVerificationHelpers({
    addLog: async () => {},
    ensureStep8SignupPageReady: async () => {},
    fetchImpl: async (url) => {
      const parsedUrl = new URL(url);
      requests.push(parsedUrl);
      const action = parsedUrl.searchParams.get('action');
      if (action === 'getPrices') {
        return {
          ok: true,
          text: async () => buildHeroSmsPricesPayload(),
        };
      }
      if (action === 'getNumber') {
        getNumberAttempt += 1;
        if (getNumberAttempt === 1) {
          throw new TypeError('Failed to fetch');
        }
        return {
          ok: true,
          text: async () => 'ACCESS_NUMBER:123456:66959916439',
        };
      }
      throw new Error(`Unexpected HeroSMS action: ${action}`);
    },
    getState: async () => ({ heroSmsApiKey: 'demo-key' }),
    sendToContentScriptResilient: async () => ({}),
    setState: async () => {},
    sleepWithStop: async () => {},
    throwIfStopped: () => {},
  });

  const activation = await helpers.requestPhoneActivation({ heroSmsApiKey: 'demo-key' });

  assert.deepStrictEqual(activation, {
    activationId: '123456',
    phoneNumber: '66959916439',
    provider: 'hero-sms',
    serviceCode: 'dr',
    countryId: 52,
    successfulUses: 0,
    maxUses: 3,
  });
  assert.equal(requests.length, 3);
  assert.equal(requests[0].searchParams.get('action'), 'getPrices');
  assert.equal(requests[1].searchParams.get('action'), 'getNumber');
  assert.equal(requests[1].searchParams.get('maxPrice'), '0.08');
  assert.equal(requests[1].searchParams.get('fixedPrice'), 'true');
  assert.equal(requests[2].searchParams.get('action'), 'getNumber');
  assert.equal(requests[2].searchParams.get('maxPrice'), null);
  assert.equal(requests[2].searchParams.get('fixedPrice'), null);
});

test('phone verification helper acquires a number from 5sim with fallback countries', async () => {
  const requests = [];
  const helpers = api.createPhoneVerificationHelpers({
    addLog: async () => {},
    ensureStep8SignupPageReady: async () => {},
    fetchImpl: async (url, options = {}) => {
      const parsedUrl = new URL(url);
      requests.push({
        pathname: parsedUrl.pathname,
        search: parsedUrl.searchParams,
        headers: options?.headers || {},
      });
      if (parsedUrl.pathname === '/v1/user/buy/activation/thailand/any/openai') {
        return {
          ok: false,
          status: 400,
          text: async () => JSON.stringify({ message: 'no free phones' }),
        };
      }
      if (parsedUrl.pathname === '/v1/guest/prices') {
        return {
          ok: true,
          status: 200,
          text: async () => JSON.stringify({
            openai: {
              thailand: {
                any: {
                  cost: 0.08,
                  count: 12,
                },
              },
            },
          }),
        };
      }
      if (parsedUrl.pathname === '/v1/user/buy/activation/england/any/openai') {
        return {
          ok: true,
          status: 200,
          text: async () => JSON.stringify({
            id: 9876543,
            phone: '+447911123456',
            country: 'england',
            country_name: 'England',
            product: 'openai',
          }),
        };
      }
      throw new Error(`Unexpected 5sim request: ${parsedUrl.pathname}`);
    },
    getState: async () => ({
      phoneSmsProvider: '5sim',
      fiveSimApiKey: 'five-token',
      fiveSimCountryOrder: ['thailand', 'england'],
      fiveSimOperator: 'any',
      fiveSimProduct: 'openai',
      heroSmsMaxPrice: '0.1',
      heroSmsReuseEnabled: true,
      heroSmsActivationRetryRounds: 1,
    }),
    sendToContentScriptResilient: async () => ({}),
    setState: async () => {},
    sleepWithStop: async () => {},
    throwIfStopped: () => {},
  });

  const activation = await helpers.requestPhoneActivation({
    phoneSmsProvider: '5sim',
    fiveSimApiKey: 'five-token',
    fiveSimCountryOrder: ['thailand', 'england'],
    fiveSimOperator: 'any',
    fiveSimProduct: 'openai',
    heroSmsMaxPrice: '0.1',
    heroSmsReuseEnabled: true,
    heroSmsActivationRetryRounds: 1,
  });

  assert.deepStrictEqual(activation, {
    activationId: '9876543',
    phoneNumber: '+447911123456',
    provider: '5sim',
    serviceCode: 'openai',
    countryId: 'england',
    countryCode: 'england',
    countryLabel: 'England',
    successfulUses: 0,
    maxUses: 3,
  });
  assert.equal(requests.length, 4);
  assert.equal(requests[0].pathname, '/v1/guest/prices');
  assert.equal(requests[0].search.get('country'), 'thailand');
  assert.equal(requests[0].search.get('product'), 'openai');
  assert.equal(requests[1].pathname, '/v1/user/buy/activation/thailand/any/openai');
  assert.equal(requests[1].search.get('maxPrice'), '0.08');
  assert.equal(requests[1].search.get('reuse'), '1');
  assert.equal(requests[1].headers.Authorization, 'Bearer five-token');
  assert.equal(requests[2].pathname, '/v1/guest/prices');
  assert.equal(requests[2].search.get('country'), 'england');
  assert.equal(requests[2].search.get('product'), 'openai');
  assert.equal(requests[3].pathname, '/v1/user/buy/activation/england/any/openai');
});

test('phone verification helper rejects 5sim maxPrice with custom operator before buying', async () => {
  const requests = [];
  const helpers = api.createPhoneVerificationHelpers({
    addLog: async () => {},
    ensureStep8SignupPageReady: async () => {},
    fetchImpl: async (url) => {
      requests.push(url);
      throw new Error(`Unexpected 5sim request: ${url}`);
    },
    getState: async () => ({
      phoneSmsProvider: '5sim',
      fiveSimApiKey: 'five-token',
      fiveSimCountryOrder: ['vietnam'],
      fiveSimOperator: 'virtual21',
      fiveSimMaxPrice: '0.1',
      heroSmsActivationRetryRounds: 1,
    }),
    sendToContentScriptResilient: async () => ({}),
    setState: async () => {},
    sleepWithStop: async () => {},
    throwIfStopped: () => {},
  });

  await assert.rejects(
    () => helpers.requestPhoneActivation({
      phoneSmsProvider: '5sim',
      fiveSimApiKey: 'five-token',
      fiveSimCountryOrder: ['vietnam'],
      fiveSimOperator: 'virtual21',
      fiveSimMaxPrice: '0.1',
      heroSmsActivationRetryRounds: 1,
    }),
    /maxPrice only works when operator is "any"/
  );
  assert.deepStrictEqual(requests, []);
});

test('phone verification helper honors price-priority ordering for 5sim countries', async () => {
  const requests = [];
  const helpers = api.createPhoneVerificationHelpers({
    addLog: async () => {},
    ensureStep8SignupPageReady: async () => {},
    fetchImpl: async (url) => {
      const parsedUrl = new URL(url);
      requests.push(parsedUrl.pathname + parsedUrl.search);
      if (parsedUrl.pathname === '/v1/guest/prices') {
        const country = parsedUrl.searchParams.get('country');
        if (country === 'thailand') {
          return {
            ok: true,
            status: 200,
            text: async () => JSON.stringify({
              openai: {
                thailand: { any: { cost: 0.2, count: 20 } },
              },
            }),
          };
        }
        if (country === 'england') {
          return {
            ok: true,
            status: 200,
            text: async () => JSON.stringify({
              openai: {
                england: { any: { cost: 0.05, count: 8 } },
              },
            }),
          };
        }
      }
      if (parsedUrl.pathname === '/v1/user/buy/activation/england/any/openai') {
        return {
          ok: true,
          status: 200,
          text: async () => JSON.stringify({
            id: 900001,
            phone: '+447900100200',
            country: 'england',
            country_name: 'England',
            product: 'openai',
          }),
        };
      }
      if (parsedUrl.pathname === '/v1/user/buy/activation/thailand/any/openai') {
        return {
          ok: false,
          status: 400,
          text: async () => JSON.stringify({ message: 'no free phones' }),
        };
      }
      throw new Error(`Unexpected 5sim request: ${parsedUrl.pathname}`);
    },
    getState: async () => ({
      phoneSmsProvider: '5sim',
      fiveSimApiKey: 'five-token',
      fiveSimCountryOrder: ['thailand', 'england'],
      fiveSimOperator: 'any',
      fiveSimProduct: 'openai',
      heroSmsAcquirePriority: 'price',
      heroSmsActivationRetryRounds: 1,
    }),
    sendToContentScriptResilient: async () => ({}),
    setState: async () => {},
    sleepWithStop: async () => {},
    throwIfStopped: () => {},
  });

  const activation = await helpers.requestPhoneActivation({
    phoneSmsProvider: '5sim',
    fiveSimApiKey: 'five-token',
    fiveSimCountryOrder: ['thailand', 'england'],
    fiveSimOperator: 'any',
    fiveSimProduct: 'openai',
    heroSmsAcquirePriority: 'price',
    heroSmsActivationRetryRounds: 1,
  });

  assert.equal(activation.countryCode, 'england');
  const firstBuyPath = requests.find((entry) => entry.includes('/v1/user/buy/activation'));
  assert.equal(firstBuyPath?.startsWith('/v1/user/buy/activation/england/any/openai'), true);
});

test('phone verification helper tries multiple 5sim price tiers within the same country before fallback', async () => {
  const requests = [];
  const helpers = api.createPhoneVerificationHelpers({
    addLog: async () => {},
    ensureStep8SignupPageReady: async () => {},
    fetchImpl: async (url) => {
      const parsedUrl = new URL(url);
      requests.push(parsedUrl.pathname + parsedUrl.search);
      if (parsedUrl.pathname === '/v1/guest/prices') {
        return {
          ok: true,
          status: 200,
          text: async () => JSON.stringify({
            openai: {
              thailand: {
                any: {
                  low: { cost: 0.05, count: 3 },
                  mid: { cost: 0.08, count: 2 },
                },
              },
            },
          }),
        };
      }
      if (parsedUrl.pathname === '/v1/user/buy/activation/thailand/any/openai') {
        const maxPrice = parsedUrl.searchParams.get('maxPrice');
        if (maxPrice === '0.05') {
          return {
            ok: false,
            status: 400,
            text: async () => JSON.stringify({ message: 'no free phones' }),
          };
        }
        if (maxPrice === '0.08') {
          return {
            ok: true,
            status: 200,
            text: async () => JSON.stringify({
              id: 800001,
              phone: '+66951112233',
              country: 'thailand',
              country_name: 'Thailand',
              product: 'openai',
            }),
          };
        }
      }
      throw new Error(`Unexpected 5sim request: ${parsedUrl.pathname}${parsedUrl.search}`);
    },
    getState: async () => ({
      phoneSmsProvider: '5sim',
      fiveSimApiKey: 'five-token',
      fiveSimCountryOrder: ['thailand'],
      fiveSimOperator: 'any',
      fiveSimProduct: 'openai',
      heroSmsMaxPrice: '0.1',
      heroSmsActivationRetryRounds: 1,
    }),
    sendToContentScriptResilient: async () => ({}),
    setState: async () => {},
    sleepWithStop: async () => {},
    throwIfStopped: () => {},
  });

  const activation = await helpers.requestPhoneActivation({
    phoneSmsProvider: '5sim',
    fiveSimApiKey: 'five-token',
    fiveSimCountryOrder: ['thailand'],
    fiveSimOperator: 'any',
    fiveSimProduct: 'openai',
    heroSmsMaxPrice: '0.1',
    heroSmsActivationRetryRounds: 1,
  });

  assert.equal(activation.countryCode, 'thailand');
  assert.equal(activation.phoneNumber, '+66951112233');
  const buyRequests = requests.filter((entry) => entry.startsWith('/v1/user/buy/activation/thailand/any/openai'));
  assert.equal(buyRequests.length, 2);
  assert.equal(buyRequests[0].includes('maxPrice=0.05'), true);
  assert.equal(buyRequests[1].includes('maxPrice=0.08'), true);
});

test('phone verification helper polls and parses 5sim verification codes', async () => {
  let checkCount = 0;
  const statusUpdates = [];
  const helpers = api.createPhoneVerificationHelpers({
    addLog: async () => {},
    ensureStep8SignupPageReady: async () => {},
    fetchImpl: async (url) => {
      const parsedUrl = new URL(url);
      if (parsedUrl.pathname !== '/v1/user/check/600001') {
        throw new Error(`Unexpected 5sim request: ${parsedUrl.pathname}`);
      }
      checkCount += 1;
      if (checkCount === 1) {
        return {
          ok: true,
          status: 200,
          text: async () => JSON.stringify({ status: 'PENDING', sms: [] }),
        };
      }
      return {
        ok: true,
        status: 200,
        text: async () => JSON.stringify({
          status: 'RECEIVED',
          sms: [{ text: 'Your OpenAI code is 246810' }],
        }),
      };
    },
    getState: async () => ({
      phoneSmsProvider: '5sim',
      fiveSimApiKey: 'five-token',
      fiveSimCountryOrder: ['thailand'],
      fiveSimOperator: 'any',
      fiveSimProduct: 'openai',
    }),
    sendToContentScriptResilient: async () => ({}),
    setState: async () => {},
    sleepWithStop: async () => {},
    throwIfStopped: () => {},
  });

  const code = await helpers.pollPhoneActivationCode(
    {
      phoneSmsProvider: '5sim',
      fiveSimApiKey: 'five-token',
      fiveSimCountryOrder: ['thailand'],
      fiveSimOperator: 'any',
      fiveSimProduct: 'openai',
    },
    {
      activationId: '600001',
      phoneNumber: '+66900000000',
      provider: '5sim',
      serviceCode: 'openai',
      countryId: 'thailand',
      countryCode: 'thailand',
      maxUses: 1,
      successfulUses: 0,
    },
    {
      timeoutMs: 5000,
      intervalMs: 1,
      maxRounds: 5,
      onStatus: async (payload) => {
        statusUpdates.push(payload.statusText);
      },
    }
  );

  assert.equal(code, '246810');
  assert.equal(checkCount, 2);
  assert.deepStrictEqual(statusUpdates, ['PENDING']);
});

test('phone verification helper treats HeroSMS STATUS_WAIT_RETRY payload status as pending', async () => {
  let pollCount = 0;
  const statusUpdates = [];
  const helpers = api.createPhoneVerificationHelpers({
    addLog: async () => {},
    ensureStep8SignupPageReady: async () => {},
    fetchImpl: async (url) => {
      const parsedUrl = new URL(url);
      const action = parsedUrl.searchParams.get('action');
      if (action === 'getStatus') {
        pollCount += 1;
        if (pollCount === 1) {
          return {
            ok: true,
            text: async () => 'STATUS_WAIT_RETRY:846171',
          };
        }
        return {
          ok: true,
          text: async () => 'STATUS_OK:Your OpenAI code is 246810',
        };
      }
      throw new Error(`Unexpected HeroSMS action: ${action}`);
    },
    getState: async () => ({
      phoneSmsProvider: 'hero-sms',
      heroSmsApiKey: 'demo-key',
      heroSmsCountry: 52,
      heroSmsServiceCode: 'dr',
      heroSmsActivationRetryRounds: 1,
    }),
    sendToContentScriptResilient: async () => ({}),
    setState: async () => {},
    sleepWithStop: async () => {},
    throwIfStopped: () => {},
  });

  const code = await helpers.pollPhoneActivationCode(
    {
      phoneSmsProvider: 'hero-sms',
      heroSmsApiKey: 'demo-key',
      heroSmsCountry: 52,
      heroSmsServiceCode: 'dr',
      heroSmsActivationRetryRounds: 1,
    },
    {
      activationId: '123456',
      phoneNumber: '66800000000',
      provider: 'hero-sms',
      serviceCode: 'dr',
      countryId: 52,
      successfulUses: 0,
      maxUses: 1,
    },
    {
      timeoutMs: 2000,
      intervalMs: 1,
      maxRounds: 5,
      onStatus: async ({ statusText }) => {
        statusUpdates.push(statusText);
      },
    }
  );

  assert.equal(code, '246810');
  assert.equal(pollCount, 2);
  assert.equal(statusUpdates[0], 'STATUS_WAIT_RETRY:846171');
});

test('phone verification helper reuses 5sim number via product-plus-number endpoint', async () => {
  const requests = [];
  const helpers = api.createPhoneVerificationHelpers({
    addLog: async () => {},
    ensureStep8SignupPageReady: async () => {},
    fetchImpl: async (url) => {
      const parsedUrl = new URL(url);
      requests.push(parsedUrl.pathname);
      if (parsedUrl.pathname !== '/v1/user/reuse/openai/447911123456') {
        throw new Error(`Unexpected 5sim request: ${parsedUrl.pathname}`);
      }
      return {
        ok: true,
        status: 200,
        text: async () => JSON.stringify({
          id: 700002,
          phone: '+447911123456',
          country: 'england',
          country_name: 'England',
          product: 'openai',
        }),
      };
    },
    getState: async () => ({
      phoneSmsProvider: '5sim',
      fiveSimApiKey: 'five-token',
      fiveSimCountryOrder: ['england'],
      fiveSimOperator: 'any',
      fiveSimProduct: 'openai',
    }),
    sendToContentScriptResilient: async () => ({}),
    setState: async () => {},
    sleepWithStop: async () => {},
    throwIfStopped: () => {},
  });

  const nextActivation = await helpers.reactivatePhoneActivation(
    {
      phoneSmsProvider: '5sim',
      fiveSimApiKey: 'five-token',
      fiveSimCountryOrder: ['england'],
      fiveSimOperator: 'any',
      fiveSimProduct: 'openai',
    },
    {
      activationId: '600001',
      phoneNumber: '+44 7911-123-456',
      provider: '5sim',
      serviceCode: 'openai',
      countryId: 'england',
      countryCode: 'england',
      maxUses: 1,
      successfulUses: 0,
    }
  );

  assert.deepStrictEqual(nextActivation, {
    activationId: '700002',
    phoneNumber: '+447911123456',
    provider: '5sim',
    serviceCode: 'openai',
    countryId: 'england',
    countryCode: 'england',
    countryLabel: 'England',
    successfulUses: 0,
    maxUses: 1,
  });
  assert.deepStrictEqual(requests, ['/v1/user/reuse/openai/447911123456']);
});

test('phone verification helper acquires a number from NexSMS with ordered fallback countries', async () => {
  const requests = [];
  const helpers = api.createPhoneVerificationHelpers({
    addLog: async () => {},
    ensureStep8SignupPageReady: async () => {},
    fetchImpl: async (url, options = {}) => {
      const parsedUrl = new URL(url);
      const method = String(options?.method || 'GET').toUpperCase();
      const body = options?.body ? JSON.parse(options.body) : null;
      requests.push({
        pathname: parsedUrl.pathname,
        search: parsedUrl.searchParams,
        method,
        body,
      });

      if (parsedUrl.pathname === '/api/getCountryByService') {
        const countryId = Number(parsedUrl.searchParams.get('countryId'));
        if (countryId === 1) {
          return {
            ok: true,
            status: 200,
            text: async () => JSON.stringify({
              code: 0,
              data: {
                countryId: 1,
                countryName: 'Ukraine',
                minPrice: 0.06,
                priceMap: { '0.06': 1 },
              },
            }),
          };
        }
        if (countryId === 6) {
          return {
            ok: true,
            status: 200,
            text: async () => JSON.stringify({
              code: 0,
              data: {
                countryId: 6,
                countryName: 'Indonesia',
                minPrice: 0.05,
                priceMap: { '0.05': 2 },
              },
            }),
          };
        }
      }

      if (parsedUrl.pathname === '/api/order/purchase') {
        if (body?.countryId === 1) {
          return {
            ok: true,
            status: 200,
            text: async () => JSON.stringify({
              code: 1001,
              msg: 'NO_NUMBERS',
            }),
          };
        }
        if (body?.countryId === 6) {
          return {
            ok: true,
            status: 200,
            text: async () => JSON.stringify({
              code: 0,
              data: {
                countryId: 6,
                countryName: 'Indonesia',
                serviceCode: 'ot',
                phoneNumbers: ['+6281234567890'],
              },
            }),
          };
        }
      }

      throw new Error(`Unexpected NexSMS request: ${parsedUrl.pathname}`);
    },
    getState: async () => ({
      phoneSmsProvider: 'nexsms',
      nexSmsApiKey: 'nex-key',
      nexSmsCountryOrder: [1, 6],
      nexSmsServiceCode: 'ot',
      heroSmsActivationRetryRounds: 1,
    }),
    sendToContentScriptResilient: async () => ({}),
    setState: async () => {},
    sleepWithStop: async () => {},
    throwIfStopped: () => {},
  });

  const activation = await helpers.requestPhoneActivation({
    phoneSmsProvider: 'nexsms',
    nexSmsApiKey: 'nex-key',
    nexSmsCountryOrder: [1, 6],
    nexSmsServiceCode: 'ot',
    heroSmsActivationRetryRounds: 1,
  });

  assert.deepStrictEqual(activation, {
    activationId: '+6281234567890',
    phoneNumber: '+6281234567890',
    provider: 'nexsms',
    serviceCode: 'ot',
    countryId: 6,
    countryLabel: 'Indonesia',
    successfulUses: 0,
    maxUses: 1,
  });
  assert.equal(requests[0].pathname, '/api/getCountryByService');
  assert.equal(requests[0].search.get('apiKey'), 'nex-key');
  assert.equal(requests[0].search.get('serviceCode'), 'ot');
  assert.equal(requests[0].search.get('countryId'), '1');
  assert.equal(requests[1].pathname, '/api/order/purchase');
  assert.equal(requests[1].method, 'POST');
  assert.equal(requests[1].body?.countryId, 1);
  assert.equal(requests[2].pathname, '/api/getCountryByService');
  assert.equal(requests[2].search.get('countryId'), '6');
  assert.equal(requests[3].pathname, '/api/order/purchase');
  assert.equal(requests[3].body?.countryId, 6);
});

test('phone verification helper polls and parses NexSMS verification codes', async () => {
  let pollCount = 0;
  const statusUpdates = [];
  const helpers = api.createPhoneVerificationHelpers({
    addLog: async () => {},
    ensureStep8SignupPageReady: async () => {},
    fetchImpl: async (url) => {
      const parsedUrl = new URL(url);
      assert.equal(parsedUrl.pathname, '/api/sms/messages');
      assert.equal(parsedUrl.searchParams.get('apiKey'), 'nex-key');
      assert.equal(parsedUrl.searchParams.get('phoneNumber'), '+6281234567890');
      assert.equal(parsedUrl.searchParams.get('format'), 'json_latest');
      pollCount += 1;
      if (pollCount === 1) {
        return {
          ok: true,
          status: 200,
          text: async () => JSON.stringify({ code: 0, data: {} }),
        };
      }
      return {
        ok: true,
        status: 200,
        text: async () => JSON.stringify({
          code: 0,
          data: {
            code: '998877',
            text: 'Your OpenAI code is 998877',
          },
        }),
      };
    },
    getState: async () => ({
      phoneSmsProvider: 'nexsms',
      nexSmsApiKey: 'nex-key',
      nexSmsCountryOrder: [6],
      nexSmsServiceCode: 'ot',
    }),
    sendToContentScriptResilient: async () => ({}),
    setState: async () => {},
    sleepWithStop: async () => {},
    throwIfStopped: () => {},
  });

  const code = await helpers.pollPhoneActivationCode(
    {
      phoneSmsProvider: 'nexsms',
      nexSmsApiKey: 'nex-key',
      nexSmsCountryOrder: [6],
      nexSmsServiceCode: 'ot',
    },
    {
      activationId: '+6281234567890',
      phoneNumber: '+6281234567890',
      provider: 'nexsms',
      serviceCode: 'ot',
      countryId: 6,
      countryLabel: 'Indonesia',
      successfulUses: 0,
      maxUses: 1,
    },
    {
      timeoutMs: 5000,
      intervalMs: 1,
      maxRounds: 5,
      onStatus: async (payload) => {
        statusUpdates.push(payload.statusText);
      },
    }
  );

  assert.equal(code, '998877');
  assert.equal(pollCount, 2);
  assert.equal(statusUpdates.length >= 1, true);
});

test('phone verification helper completes add-phone flow, clears current activation, and stores reusable number state', async () => {
  const requests = [];
  const stateUpdates = [];
  let currentState = {
    heroSmsApiKey: 'demo-key',
    verificationResendCount: 1,
    currentPhoneActivation: null,
    reusablePhoneActivation: null,
  };

  const helpers = api.createPhoneVerificationHelpers({
    addLog: async () => {},
    ensureStep8SignupPageReady: async () => {},
    fetchImpl: async (url) => {
      const parsedUrl = new URL(url);
      requests.push(parsedUrl);
      const action = parsedUrl.searchParams.get('action');
      if (action === 'getPrices') {
        return {
          ok: true,
          text: async () => buildHeroSmsPricesPayload(),
        };
      }
      if (action === 'getNumber') {
        return {
          ok: true,
          text: async () => 'ACCESS_NUMBER:123456:66959916439',
        };
      }
      if (action === 'getStatus') {
        return {
          ok: true,
          text: async () => 'STATUS_OK:654321',
        };
      }
      if (action === 'setStatus') {
        return {
          ok: true,
          text: async () => 'ACCESS_ACTIVATION',
        };
      }
      throw new Error(`Unexpected HeroSMS action: ${action}`);
    },
    getOAuthFlowStepTimeoutMs: async (defaultTimeoutMs) => defaultTimeoutMs,
    getState: async () => ({ ...currentState }),
    sendToContentScriptResilient: async (_source, message) => {
      if (message.type === 'SUBMIT_PHONE_NUMBER') {
        return {
          phoneVerificationPage: true,
          url: 'https://auth.openai.com/phone-verification',
        };
      }
      if (message.type === 'SUBMIT_PHONE_VERIFICATION_CODE') {
        return {
          success: true,
          consentReady: true,
          url: 'https://auth.openai.com/authorize',
        };
      }
      throw new Error(`Unexpected content-script message: ${message.type}`);
    },
    setState: async (updates) => {
      stateUpdates.push(updates);
      currentState = { ...currentState, ...updates };
    },
    sleepWithStop: async () => {},
    throwIfStopped: () => {},
  });

  const result = await helpers.completePhoneVerificationFlow(1, {
    addPhonePage: true,
    phoneVerificationPage: false,
    url: 'https://auth.openai.com/add-phone',
  });

  assert.deepStrictEqual(result, {
    success: true,
    consentReady: true,
    url: 'https://auth.openai.com/authorize',
  });
  assert.equal(Array.isArray(stateUpdates[0]?.heroSmsLastPriceTiers), true);
  assert.equal(stateUpdates[0]?.heroSmsLastPriceCountryId, 52);
  assert.equal(stateUpdates[0]?.heroSmsLastPriceCountryLabel, 'Thailand');
  assert.equal(
    stateUpdates.some((entry) => entry?.currentPhoneActivation?.activationId === '123456'),
    true
  );
  assert.equal(
    stateUpdates.some((entry) => entry?.currentPhoneVerificationCode === '654321'),
    true
  );
  assert.equal(
    stateUpdates.some((entry) => entry?.reusablePhoneActivation?.activationId === '123456'),
    true
  );
  assert.equal(
    stateUpdates.some((entry) => entry?.currentPhoneActivation === null && entry?.currentPhoneVerificationCode === ''),
    true
  );

  const actions = requests.map((url) => url.searchParams.get('action'));
  assert.deepStrictEqual(actions, ['getPrices', 'getNumber', 'getStatus', 'setStatus']);
});

test('phone verification helper forwards signup profile payload when submitting the phone verification code', async () => {
  let currentState = {
    heroSmsApiKey: 'demo-key',
    verificationResendCount: 0,
    currentPhoneActivation: null,
    reusablePhoneActivation: null,
  };
  const submittedPayloads = [];

  const helpers = api.createPhoneVerificationHelpers({
    addLog: async () => {},
    ensureStep8SignupPageReady: async () => {},
    fetchImpl: async (url) => {
      const parsedUrl = new URL(url);
      const action = parsedUrl.searchParams.get('action');
      if (action === 'getPrices') {
        return {
          ok: true,
          text: async () => buildHeroSmsPricesPayload(),
        };
      }
      if (action === 'getNumber') {
        return {
          ok: true,
          text: async () => 'ACCESS_NUMBER:123456:66959916439',
        };
      }
      if (action === 'getStatus') {
        return {
          ok: true,
          text: async () => 'STATUS_OK:654321',
        };
      }
      if (action === 'setStatus') {
        return {
          ok: true,
          text: async () => 'ACCESS_ACTIVATION',
        };
      }
      throw new Error(`Unexpected HeroSMS action: ${action}`);
    },
    generateRandomBirthday: () => ({ year: 2003, month: 6, day: 19 }),
    generateRandomName: () => ({ firstName: 'Ada', lastName: 'Lovelace' }),
    getOAuthFlowStepTimeoutMs: async (defaultTimeoutMs) => defaultTimeoutMs,
    getState: async () => ({ ...currentState }),
    sendToContentScriptResilient: async (_source, message) => {
      if (message.type === 'SUBMIT_PHONE_NUMBER') {
        return {
          phoneVerificationPage: true,
          url: 'https://auth.openai.com/phone-verification',
        };
      }
      if (message.type === 'SUBMIT_PHONE_VERIFICATION_CODE') {
        submittedPayloads.push(message.payload);
        return {
          success: true,
          consentReady: true,
          url: 'https://auth.openai.com/authorize',
        };
      }
      throw new Error(`Unexpected content-script message: ${message.type}`);
    },
    setState: async (updates) => {
      currentState = { ...currentState, ...updates };
    },
    sleepWithStop: async () => {},
    throwIfStopped: () => {},
  });

  const result = await helpers.completePhoneVerificationFlow(1, {
    addPhonePage: true,
    phoneVerificationPage: false,
    url: 'https://auth.openai.com/add-phone',
  });

  assert.deepStrictEqual(result, {
    success: true,
    consentReady: true,
    url: 'https://auth.openai.com/authorize',
  });
  assert.deepStrictEqual(submittedPayloads, [{
    code: '654321',
    signupProfile: {
      firstName: 'Ada',
      lastName: 'Lovelace',
      year: 2003,
      month: 6,
      day: 19,
    },
  }]);
});

test('phone verification helper uses the configured HeroSMS country for both number acquisition and add-phone submission', async () => {
  const requests = [];
  const submittedPayloads = [];
  let currentState = {
    heroSmsApiKey: 'demo-key',
    heroSmsCountryId: 16,
    heroSmsCountryLabel: 'United Kingdom',
    verificationResendCount: 0,
    currentPhoneActivation: null,
    reusablePhoneActivation: null,
  };

  const helpers = api.createPhoneVerificationHelpers({
    addLog: async () => {},
    ensureStep8SignupPageReady: async () => {},
    fetchImpl: async (url) => {
      const parsedUrl = new URL(url);
      requests.push(parsedUrl);
      const action = parsedUrl.searchParams.get('action');
      if (action === 'getPrices') {
        return {
          ok: true,
          text: async () => buildHeroSmsPricesPayload({ country: '16' }),
        };
      }
      if (action === 'getNumber') {
        return {
          ok: true,
          text: async () => 'ACCESS_NUMBER:654321:447911123456',
        };
      }
      if (action === 'getStatus') {
        return {
          ok: true,
          text: async () => 'STATUS_OK:112233',
        };
      }
      if (action === 'setStatus') {
        return {
          ok: true,
          text: async () => 'ACCESS_ACTIVATION',
        };
      }
      throw new Error(`Unexpected HeroSMS action: ${action}`);
    },
    getOAuthFlowStepTimeoutMs: async (defaultTimeoutMs) => defaultTimeoutMs,
    getState: async () => ({ ...currentState }),
    sendToContentScriptResilient: async (_source, message) => {
      if (message.type === 'SUBMIT_PHONE_NUMBER') {
        submittedPayloads.push(message.payload);
        return {
          phoneVerificationPage: true,
          url: 'https://auth.openai.com/phone-verification',
        };
      }
      if (message.type === 'SUBMIT_PHONE_VERIFICATION_CODE') {
        return {
          success: true,
          consentReady: true,
          url: 'https://auth.openai.com/authorize',
        };
      }
      throw new Error(`Unexpected content-script message: ${message.type}`);
    },
    setState: async (updates) => {
      currentState = { ...currentState, ...updates };
    },
    sleepWithStop: async () => {},
    throwIfStopped: () => {},
  });

  const result = await helpers.completePhoneVerificationFlow(1, {
    addPhonePage: true,
    phoneVerificationPage: false,
    url: 'https://auth.openai.com/add-phone',
  });

  assert.deepStrictEqual(result, {
    success: true,
    consentReady: true,
    url: 'https://auth.openai.com/authorize',
  });
  assert.equal(requests[0].searchParams.get('action'), 'getPrices');
  assert.equal(requests[0].searchParams.get('country'), '16');
  assert.equal(requests[1].searchParams.get('action'), 'getNumber');
  assert.equal(requests[1].searchParams.get('country'), '16');
  assert.equal(requests[1].searchParams.get('maxPrice'), '0.08');
  assert.equal(requests[1].searchParams.get('fixedPrice'), 'true');
  assert.deepStrictEqual(submittedPayloads, [{
    phoneNumber: '447911123456',
    countryId: 16,
    countryLabel: 'United Kingdom',
  }]);
});

test('phone verification helper skips reusable activation when reuse toggle is disabled', async () => {
  const requests = [];
  let currentState = {
    heroSmsApiKey: 'demo-key',
    heroSmsReuseEnabled: false,
    verificationResendCount: 0,
    currentPhoneActivation: null,
    reusablePhoneActivation: {
      activationId: 'reuse-001',
      phoneNumber: '66950012345',
      provider: 'hero-sms',
      serviceCode: 'dr',
      countryId: 52,
      successfulUses: 0,
      maxUses: 3,
    },
  };

  const helpers = api.createPhoneVerificationHelpers({
    addLog: async () => {},
    ensureStep8SignupPageReady: async () => {},
    fetchImpl: async (url) => {
      const parsedUrl = new URL(url);
      requests.push(parsedUrl);
      const action = parsedUrl.searchParams.get('action');
      if (action === 'reactivate') {
        throw new Error('reactivate should not be called when reuse is disabled');
      }
      if (action === 'getPrices') {
        return { ok: true, text: async () => buildHeroSmsPricesPayload() };
      }
      if (action === 'getNumber') {
        return { ok: true, text: async () => 'ACCESS_NUMBER:900001:66958887777' };
      }
      if (action === 'getStatus') {
        return { ok: true, text: async () => 'STATUS_OK:777111' };
      }
      if (action === 'setStatus') {
        return { ok: true, text: async () => 'STATUS_UPDATED' };
      }
      throw new Error(`Unexpected HeroSMS action: ${action}`);
    },
    getOAuthFlowStepTimeoutMs: async (defaultTimeoutMs) => defaultTimeoutMs,
    getState: async () => ({ ...currentState }),
    sendToContentScriptResilient: async (_source, message) => {
      if (message.type === 'SUBMIT_PHONE_NUMBER') {
        return {
          phoneVerificationPage: true,
          url: 'https://auth.openai.com/phone-verification',
        };
      }
      if (message.type === 'SUBMIT_PHONE_VERIFICATION_CODE') {
        return {
          success: true,
          consentReady: true,
          url: 'https://auth.openai.com/authorize',
        };
      }
      throw new Error(`Unexpected content-script message: ${message.type}`);
    },
    setState: async (updates) => {
      currentState = { ...currentState, ...updates };
    },
    sleepWithStop: async () => {},
    throwIfStopped: () => {},
  });

  const result = await helpers.completePhoneVerificationFlow(1, {
    addPhonePage: true,
    phoneVerificationPage: false,
    url: 'https://auth.openai.com/add-phone',
  });

  assert.equal(result.success, true);
  assert.equal(requests.some((requestUrl) => requestUrl.searchParams.get('action') === 'reactivate'), false);
  assert.equal(currentState.reusablePhoneActivation, null);
});

test('phone verification helper replaces numbers in step 9 and stops after replacement limit when SMS never arrives', async () => {
  const requests = [];
  const messages = [];
  let currentState = {
    heroSmsApiKey: 'demo-key',
    verificationResendCount: 0,
    currentPhoneActivation: null,
    reusablePhoneActivation: null,
  };
  const statusCallsById = {};
  const realDateNow = Date.now;
  let fakeNow = 0;
  Date.now = () => fakeNow;

  try {
    const helpers = api.createPhoneVerificationHelpers({
      addLog: async () => {},
      ensureStep8SignupPageReady: async () => {},
      fetchImpl: async (url) => {
        const parsedUrl = new URL(url);
        requests.push(parsedUrl);
        const action = parsedUrl.searchParams.get('action');
        const id = parsedUrl.searchParams.get('id');

        if (action === 'getPrices') {
          return {
            ok: true,
            text: async () => buildHeroSmsPricesPayload(),
          };
        }

        if (action === 'getNumber') {
          return {
            ok: true,
            text: async () => 'ACCESS_NUMBER:123456:66959916439',
          };
        }

        if (action === 'getStatus') {
          statusCallsById[id] = (statusCallsById[id] || 0) + 1;
          return {
            ok: true,
            text: async () => 'STATUS_WAIT_CODE',
          };
        }

        if (action === 'setStatus') {
          return {
            ok: true,
            text: async () => 'ACCESS_ACTIVATION',
          };
        }

        throw new Error(`Unexpected HeroSMS action: ${action}`);
      },
      getOAuthFlowStepTimeoutMs: async (defaultTimeoutMs) => defaultTimeoutMs,
      getState: async () => ({ ...currentState }),
      sendToContentScriptResilient: async (_source, message) => {
        messages.push(message.type);
        if (message.type === 'SUBMIT_PHONE_NUMBER') {
          return {
            phoneVerificationPage: true,
            url: 'https://auth.openai.com/phone-verification',
          };
        }
        if (message.type === 'RESEND_PHONE_VERIFICATION_CODE') {
          return {
            resent: true,
            url: 'https://auth.openai.com/phone-verification',
          };
        }
        if (message.type === 'RETURN_TO_ADD_PHONE') {
          return {
            addPhonePage: true,
            url: 'https://auth.openai.com/add-phone',
          };
        }
        throw new Error(`Unexpected content-script message: ${message.type}`);
      },
      setState: async (updates) => {
        currentState = { ...currentState, ...updates };
      },
      sleepWithStop: async () => {
        fakeNow += 61000;
      },
      throwIfStopped: () => {},
    });

    await assert.rejects(
      helpers.completePhoneVerificationFlow(1, {
        addPhonePage: true,
        phoneVerificationPage: false,
        url: 'https://auth.openai.com/add-phone',
      }),
      /更换 3 次号码后手机号验证仍未成功/
    );
    assert.ok(statusCallsById['123456'] >= 2, 'first number should be polled twice before being replaced');
    assert.ok(messages.includes('SUBMIT_PHONE_NUMBER'));
    assert.ok(messages.includes('RESEND_PHONE_VERIFICATION_CODE'));
    assert.ok(messages.filter((type) => type === 'SUBMIT_PHONE_NUMBER').length > 1);

    const actions = requests.map((url) => `${url.searchParams.get('action')}:${url.searchParams.get('id') || ''}`);
    assert.ok(actions.filter((action) => action === 'getNumber:').length > 1);
    assert.ok(actions.filter((action) => action === 'getStatus:123456').length >= 2);
    assert.ok(actions.filter((action) => action === 'setStatus:123456').length >= 2);
    assert.equal(currentState.currentPhoneActivation, null);
  } finally {
    Date.now = realDateNow;
  }
});

test('phone verification helper honors timeout-window and poll-round settings before replacing numbers', async () => {
  const requests = [];
  const messages = [];
  let currentState = {
    heroSmsApiKey: 'demo-key',
    verificationResendCount: 0,
    phoneVerificationReplacementLimit: 1,
    phoneCodeWaitSeconds: 60,
    phoneCodeTimeoutWindows: 1,
    phoneCodePollIntervalSeconds: 1,
    phoneCodePollMaxRounds: 1,
    currentPhoneActivation: null,
    reusablePhoneActivation: null,
  };

  const helpers = api.createPhoneVerificationHelpers({
    addLog: async () => {},
    ensureStep8SignupPageReady: async () => {},
    fetchImpl: async (url) => {
      const parsedUrl = new URL(url);
      requests.push(parsedUrl);
      const action = parsedUrl.searchParams.get('action');
      if (action === 'getPrices') {
        return { ok: true, text: async () => buildHeroSmsPricesPayload() };
      }
      if (action === 'getNumber') {
        return { ok: true, text: async () => 'ACCESS_NUMBER:500001:66957776666' };
      }
      if (action === 'getStatus') {
        return { ok: true, text: async () => 'STATUS_WAIT_CODE' };
      }
      if (action === 'setStatus') {
        return { ok: true, text: async () => 'STATUS_UPDATED' };
      }
      throw new Error(`Unexpected HeroSMS action: ${action}`);
    },
    getOAuthFlowStepTimeoutMs: async (defaultTimeoutMs) => defaultTimeoutMs,
    getState: async () => ({ ...currentState }),
    sendToContentScriptResilient: async (_source, message) => {
      messages.push(message.type);
      if (message.type === 'SUBMIT_PHONE_NUMBER') {
        return {
          phoneVerificationPage: true,
          url: 'https://auth.openai.com/phone-verification',
        };
      }
      if (message.type === 'RETURN_TO_ADD_PHONE') {
        return {
          addPhonePage: true,
          url: 'https://auth.openai.com/add-phone',
        };
      }
      if (message.type === 'RESEND_PHONE_VERIFICATION_CODE') {
        throw new Error('resend should not be called when timeout windows is 1');
      }
      throw new Error(`Unexpected content-script message: ${message.type}`);
    },
    setState: async (updates) => {
      currentState = { ...currentState, ...updates };
    },
    sleepWithStop: async () => {},
    throwIfStopped: () => {},
  });

  await assert.rejects(
    helpers.completePhoneVerificationFlow(1, {
      addPhonePage: true,
      phoneVerificationPage: false,
      url: 'https://auth.openai.com/add-phone',
    }),
    /更换 1 次号码后手机号验证仍未成功/
  );

  assert.equal(messages.includes('RESEND_PHONE_VERIFICATION_CODE'), false);
  assert.ok(
    requests.filter((requestUrl) => requestUrl.searchParams.get('action') === 'getStatus').length >= 2,
    'each replacement attempt should still poll HeroSMS at least once'
  );
});

test('phone verification helper respects configured number replacement limit', async () => {
  const requests = [];
  let currentState = {
    heroSmsApiKey: 'demo-key',
    verificationResendCount: 0,
    phoneVerificationReplacementLimit: 1,
    currentPhoneActivation: null,
    reusablePhoneActivation: null,
  };
  let submitCodeCount = 0;
  const numbers = [
    { activationId: '411111', phoneNumber: '66950000111' },
    { activationId: '422222', phoneNumber: '66950000222' },
  ];
  let numberIndex = 0;

  const helpers = api.createPhoneVerificationHelpers({
    addLog: async () => {},
    ensureStep8SignupPageReady: async () => {},
    fetchImpl: async (url) => {
      const parsedUrl = new URL(url);
      requests.push(parsedUrl);
      const action = parsedUrl.searchParams.get('action');
      const id = parsedUrl.searchParams.get('id');
      if (action === 'getPrices') {
        return {
          ok: true,
          text: async () => buildHeroSmsPricesPayload(),
        };
      }
      if (action === 'getNumber') {
        const nextNumber = numbers[numberIndex];
        numberIndex += 1;
        return {
          ok: true,
          text: async () => `ACCESS_NUMBER:${nextNumber.activationId}:${nextNumber.phoneNumber}`,
        };
      }
      if (action === 'getStatus') {
        return {
          ok: true,
          text: async () => 'STATUS_OK:654321',
        };
      }
      if (action === 'setStatus') {
        return {
          ok: true,
          text: async () => `STATUS_UPDATED:${id}`,
        };
      }
      throw new Error(`Unexpected HeroSMS action: ${action}`);
    },
    getOAuthFlowStepTimeoutMs: async (defaultTimeoutMs) => defaultTimeoutMs,
    getState: async () => ({ ...currentState }),
    sendToContentScriptResilient: async (_source, message) => {
      if (message.type === 'SUBMIT_PHONE_NUMBER') {
        return {
          phoneVerificationPage: true,
          url: 'https://auth.openai.com/phone-verification',
        };
      }
      if (message.type === 'SUBMIT_PHONE_VERIFICATION_CODE') {
        submitCodeCount += 1;
        return {
          invalidCode: true,
          errorText: `This phone number is already linked to the maximum number of accounts. (${submitCodeCount})`,
          url: 'https://auth.openai.com/phone-verification',
        };
      }
      if (message.type === 'RETURN_TO_ADD_PHONE') {
        return {
          addPhonePage: true,
          url: 'https://auth.openai.com/add-phone',
        };
      }
      throw new Error(`Unexpected content-script message: ${message.type}`);
    },
    setState: async (updates) => {
      currentState = { ...currentState, ...updates };
    },
    sleepWithStop: async () => {},
    throwIfStopped: () => {},
  });

  await assert.rejects(
    helpers.completePhoneVerificationFlow(1, {
      addPhonePage: true,
      phoneVerificationPage: false,
      url: 'https://auth.openai.com/add-phone',
    }),
    /更换 1 次号码后手机号验证仍未成功/
  );

  const actions = requests.map((requestUrl) => requestUrl.searchParams.get('action'));
  assert.deepStrictEqual(actions, [
    'getPrices',
    'getNumber',
    'getStatus',
    'setStatus',
    'getPrices',
    'getNumber',
    'getStatus',
    'setStatus',
  ]);
});

test('phone verification helper reuses the current number first when code submission returns to add-phone', async () => {
  const requests = [];
  const messages = [];
  let currentState = {
    heroSmsApiKey: 'demo-key',
    verificationResendCount: 1,
    currentPhoneActivation: null,
    reusablePhoneActivation: null,
  };

  const numbers = [
    { activationId: '111111', phoneNumber: '66950000001' },
    { activationId: '222222', phoneNumber: '66950000002' },
  ];
  let numberIndex = 0;
  let submitCodeCount = 0;

  const helpers = api.createPhoneVerificationHelpers({
    addLog: async () => {},
    ensureStep8SignupPageReady: async () => {},
    fetchImpl: async (url) => {
      const parsedUrl = new URL(url);
      requests.push(parsedUrl);
      const action = parsedUrl.searchParams.get('action');
      const id = parsedUrl.searchParams.get('id');

      if (action === 'getPrices') {
        return {
          ok: true,
          text: async () => buildHeroSmsPricesPayload(),
        };
      }

      if (action === 'getNumber') {
        const nextNumber = numbers[numberIndex];
        numberIndex += 1;
        return {
          ok: true,
          text: async () => `ACCESS_NUMBER:${nextNumber.activationId}:${nextNumber.phoneNumber}`,
        };
      }
      if (action === 'getStatus') {
        return {
          ok: true,
          text: async () => 'STATUS_OK:654321',
        };
      }
      if (action === 'setStatus') {
        return {
          ok: true,
          text: async () => `STATUS_UPDATED:${id}`,
        };
      }
      throw new Error(`Unexpected HeroSMS action: ${action}`);
    },
    getOAuthFlowStepTimeoutMs: async (defaultTimeoutMs) => defaultTimeoutMs,
    getState: async () => ({ ...currentState }),
    sendToContentScriptResilient: async (_source, message) => {
      messages.push(message.type);
      if (message.type === 'SUBMIT_PHONE_NUMBER') {
        return {
          phoneVerificationPage: true,
          url: 'https://auth.openai.com/phone-verification',
        };
      }
      if (message.type === 'SUBMIT_PHONE_VERIFICATION_CODE') {
        submitCodeCount += 1;
        return submitCodeCount === 1
          ? {
            returnedToAddPhone: true,
            url: 'https://auth.openai.com/add-phone',
          }
          : {
            success: true,
            consentReady: true,
            url: 'https://auth.openai.com/authorize',
          };
      }
      if (message.type === 'RESEND_PHONE_VERIFICATION_CODE') {
        return {
          resent: true,
          url: 'https://auth.openai.com/phone-verification',
        };
      }
      throw new Error(`Unexpected content-script message: ${message.type}`);
    },
    setState: async (updates) => {
      currentState = { ...currentState, ...updates };
    },
    sleepWithStop: async () => {},
    throwIfStopped: () => {},
  });

  const result = await helpers.completePhoneVerificationFlow(1, {
    addPhonePage: true,
    phoneVerificationPage: false,
    url: 'https://auth.openai.com/add-phone',
  });

  assert.deepStrictEqual(result, {
    success: true,
    consentReady: true,
    url: 'https://auth.openai.com/authorize',
  });
  assert.deepStrictEqual(messages, [
    'SUBMIT_PHONE_NUMBER',
    'SUBMIT_PHONE_VERIFICATION_CODE',
    'SUBMIT_PHONE_NUMBER',
    'SUBMIT_PHONE_VERIFICATION_CODE',
  ]);

  const actions = requests.map((url) => `${url.searchParams.get('action')}:${url.searchParams.get('id') || ''}`);
  assert.deepStrictEqual(actions, [
    'getPrices:',
    'getNumber:',
    'getStatus:111111',
    'getStatus:111111',
    'setStatus:111111',
  ]);
  assert.deepStrictEqual(currentState.currentPhoneActivation, null);
  assert.deepStrictEqual(currentState.reusablePhoneActivation, {
    activationId: '111111',
    phoneNumber: '66950000001',
    provider: 'hero-sms',
    serviceCode: 'dr',
    countryId: 52,
    successfulUses: 1,
    maxUses: 3,
  });
});

test('phone verification helper immediately replaces number when page says the phone number was already used', async () => {
  const requests = [];
  const messages = [];
  let currentState = {
    heroSmsApiKey: 'demo-key',
    verificationResendCount: 1,
    currentPhoneActivation: null,
    reusablePhoneActivation: null,
    phoneReusableActivationPool: [
      {
        activationId: 'pool-used-match',
        phoneNumber: '+66 95 000 0011',
        provider: 'hero-sms',
        serviceCode: 'dr',
        countryId: 52,
        successfulUses: 1,
        maxUses: 3,
      },
    ],
    freeReusablePhoneActivation: {
      activationId: 'free-used-match',
      phoneNumber: '+66 95 000 0011',
      provider: 'hero-sms',
      serviceCode: 'dr',
      countryId: 52,
      countryLabel: 'Thailand',
      successfulUses: 0,
      maxUses: 3,
      source: 'free-manual-reuse',
    },
  };

  const numbers = [
    { activationId: '311111', phoneNumber: '66950000011' },
    { activationId: '322222', phoneNumber: '66950000022' },
  ];
  let numberIndex = 0;
  let submitCodeCount = 0;

  const helpers = api.createPhoneVerificationHelpers({
    addLog: async () => {},
    ensureStep8SignupPageReady: async () => {},
    fetchImpl: async (url) => {
      const parsedUrl = new URL(url);
      requests.push(parsedUrl);
      const action = parsedUrl.searchParams.get('action');
      const id = parsedUrl.searchParams.get('id');

      if (action === 'getPrices') {
        return {
          ok: true,
          text: async () => buildHeroSmsPricesPayload(),
        };
      }
      if (action === 'getNumber') {
        const nextNumber = numbers[numberIndex];
        numberIndex += 1;
        return {
          ok: true,
          text: async () => `ACCESS_NUMBER:${nextNumber.activationId}:${nextNumber.phoneNumber}`,
        };
      }
      if (action === 'getStatus') {
        return {
          ok: true,
          text: async () => 'STATUS_OK:654321',
        };
      }
      if (action === 'setStatus') {
        return {
          ok: true,
          text: async () => `STATUS_UPDATED:${id}`,
        };
      }
      throw new Error(`Unexpected HeroSMS action: ${action}`);
    },
    getOAuthFlowStepTimeoutMs: async (defaultTimeoutMs) => defaultTimeoutMs,
    getState: async () => ({ ...currentState }),
    sendToContentScriptResilient: async (_source, message) => {
      messages.push(message.type);
      if (message.type === 'SUBMIT_PHONE_NUMBER') {
        return {
          phoneVerificationPage: true,
          url: 'https://auth.openai.com/phone-verification',
        };
      }
      if (message.type === 'SUBMIT_PHONE_VERIFICATION_CODE') {
        submitCodeCount += 1;
        if (submitCodeCount === 1) {
          return {
            invalidCode: true,
            errorText: 'This phone number is already linked to the maximum number of accounts.',
            url: 'https://auth.openai.com/phone-verification',
          };
        }
        return {
          success: true,
          consentReady: true,
          url: 'https://auth.openai.com/authorize',
        };
      }
      if (message.type === 'RETURN_TO_ADD_PHONE') {
        return {
          addPhonePage: true,
          url: 'https://auth.openai.com/add-phone',
        };
      }
      if (message.type === 'RESEND_PHONE_VERIFICATION_CODE') {
        throw new Error('should not resend for already-used number');
      }
      throw new Error(`Unexpected content-script message: ${message.type}`);
    },
    setState: async (updates) => {
      currentState = { ...currentState, ...updates };
    },
    sleepWithStop: async () => {},
    throwIfStopped: () => {},
  });

  const result = await helpers.completePhoneVerificationFlow(1, {
    addPhonePage: true,
    phoneVerificationPage: false,
    url: 'https://auth.openai.com/add-phone',
  });

  assert.deepStrictEqual(result, {
    success: true,
    consentReady: true,
    url: 'https://auth.openai.com/authorize',
  });
  assert.deepStrictEqual(messages, [
    'SUBMIT_PHONE_NUMBER',
    'SUBMIT_PHONE_VERIFICATION_CODE',
    'RETURN_TO_ADD_PHONE',
    'STEP8_GET_STATE',
    'RETURN_TO_ADD_PHONE',
    'SUBMIT_PHONE_NUMBER',
    'SUBMIT_PHONE_VERIFICATION_CODE',
  ]);
  assert.equal(currentState.freeReusablePhoneActivation, null);
  assert.deepStrictEqual(
    currentState.phoneReusableActivationPool.filter((activation) => activation.phoneNumber === '+66 95 000 0011'),
    []
  );
});

test('phone verification helper rotates number when verification code cannot be sent from add-phone rejection', async () => {
  const requests = [];
  const messages = [];
  const submittedNumbers = [];
  const refusedText = '无法向此电话号码发送验证码。请稍后重试或使用其他号码。';
  let currentState = {
    heroSmsApiKey: 'demo-key',
    verificationResendCount: 0,
    phoneVerificationReplacementLimit: 2,
    currentPhoneActivation: null,
    reusablePhoneActivation: null,
  };

  const numbers = [
    { activationId: '331111', phoneNumber: '66950003111' },
    { activationId: '332222', phoneNumber: '66950003222' },
  ];
  let numberIndex = 0;

  const helpers = api.createPhoneVerificationHelpers({
    addLog: async () => {},
    ensureStep8SignupPageReady: async () => {},
    fetchImpl: async (url) => {
      const parsedUrl = new URL(url);
      requests.push(parsedUrl);
      const action = parsedUrl.searchParams.get('action');
      const id = parsedUrl.searchParams.get('id');

      if (action === 'getPrices') {
        return {
          ok: true,
          text: async () => buildHeroSmsPricesPayload(),
        };
      }
      if (action === 'getNumber') {
        const nextNumber = numbers[numberIndex];
        numberIndex += 1;
        return {
          ok: true,
          text: async () => `ACCESS_NUMBER:${nextNumber.activationId}:${nextNumber.phoneNumber}`,
        };
      }
      if (action === 'getStatus') {
        return {
          ok: true,
          text: async () => (id === '332222' ? 'STATUS_OK:654321' : 'STATUS_WAIT_CODE'),
        };
      }
      if (action === 'setStatus') {
        return {
          ok: true,
          text: async () => `STATUS_UPDATED:${id}`,
        };
      }
      throw new Error(`Unexpected HeroSMS action: ${action}`);
    },
    getOAuthFlowStepTimeoutMs: async (defaultTimeoutMs) => defaultTimeoutMs,
    getState: async () => ({ ...currentState }),
    sendToContentScriptResilient: async (_source, message) => {
      messages.push(message.type);
      if (message.type === 'SUBMIT_PHONE_NUMBER') {
        const phoneNumber = message.payload.phoneNumber;
        submittedNumbers.push(phoneNumber);
        if (phoneNumber === '66950003111') {
          return {
            addPhoneRejected: true,
            addPhonePage: true,
            errorText: refusedText,
            url: 'https://auth.openai.com/add-phone',
          };
        }
        return {
          phoneVerificationPage: true,
          url: 'https://auth.openai.com/phone-verification',
        };
      }
      if (message.type === 'RETURN_TO_ADD_PHONE') {
        return {
          addPhonePage: true,
          phoneVerificationPage: false,
          url: 'https://auth.openai.com/add-phone',
        };
      }
      if (message.type === 'STEP8_GET_STATE') {
        return {
          addPhonePage: true,
          phoneVerificationPage: false,
          url: 'https://auth.openai.com/add-phone',
        };
      }
      if (message.type === 'SUBMIT_PHONE_VERIFICATION_CODE') {
        return {
          success: true,
          consentReady: true,
          url: 'https://auth.openai.com/authorize',
        };
      }
      if (message.type === 'RESEND_PHONE_VERIFICATION_CODE') {
        throw new Error('delivery-refused add-phone rejection should rotate before resend.');
      }
      throw new Error(`Unexpected content-script message: ${message.type}`);
    },
    setState: async (updates) => {
      currentState = { ...currentState, ...updates };
    },
    sleepWithStop: async () => {},
    throwIfStopped: () => {},
  });

  const result = await helpers.completePhoneVerificationFlow(1, {
    addPhonePage: true,
    phoneVerificationPage: false,
    url: 'https://auth.openai.com/add-phone',
  });

  assert.deepStrictEqual(result, {
    success: true,
    consentReady: true,
    url: 'https://auth.openai.com/authorize',
  });
  assert.deepStrictEqual(submittedNumbers, ['66950003111', '66950003222']);
  assert.equal(numberIndex, 2);
  assert.equal(messages.includes('RESEND_PHONE_VERIFICATION_CODE'), false);
  assert.equal(
    requests.filter((requestUrl) => requestUrl.searchParams.get('action') === 'getNumber').length,
    2
  );
});

test('phone verification helper keeps used-number cleanup when add-phone rejection asks to use a different phone number', async () => {
  const messages = [];
  const submittedNumbers = [];
  const usedText = 'This phone number is already linked to the maximum number of accounts. Please use a different phone number.';
  let currentState = {
    heroSmsApiKey: 'demo-key',
    verificationResendCount: 0,
    phoneVerificationReplacementLimit: 2,
    currentPhoneActivation: null,
    reusablePhoneActivation: null,
    phoneReusableActivationPool: [
      {
        activationId: 'pool-used-different-match',
        phoneNumber: '+66 95 000 4111',
        provider: 'hero-sms',
        serviceCode: 'dr',
        countryId: 52,
        successfulUses: 1,
        maxUses: 3,
      },
    ],
    freeReusablePhoneActivation: {
      activationId: 'free-used-different-match',
      phoneNumber: '+66 95 000 4111',
      provider: 'hero-sms',
      serviceCode: 'dr',
      countryId: 52,
      countryLabel: 'Thailand',
      successfulUses: 0,
      maxUses: 3,
      source: 'free-manual-reuse',
    },
  };

  const numbers = [
    { activationId: '341111', phoneNumber: '66950004111' },
    { activationId: '342222', phoneNumber: '66950004222' },
  ];
  let numberIndex = 0;

  const helpers = api.createPhoneVerificationHelpers({
    addLog: async () => {},
    ensureStep8SignupPageReady: async () => {},
    fetchImpl: async (url) => {
      const parsedUrl = new URL(url);
      const action = parsedUrl.searchParams.get('action');
      const id = parsedUrl.searchParams.get('id');

      if (action === 'getPrices') {
        return {
          ok: true,
          text: async () => buildHeroSmsPricesPayload(),
        };
      }
      if (action === 'getNumber') {
        const nextNumber = numbers[numberIndex];
        numberIndex += 1;
        return {
          ok: true,
          text: async () => `ACCESS_NUMBER:${nextNumber.activationId}:${nextNumber.phoneNumber}`,
        };
      }
      if (action === 'getStatus') {
        return {
          ok: true,
          text: async () => (id === '342222' ? 'STATUS_OK:654321' : 'STATUS_WAIT_CODE'),
        };
      }
      if (action === 'setStatus') {
        return {
          ok: true,
          text: async () => `STATUS_UPDATED:${id}`,
        };
      }
      throw new Error(`Unexpected HeroSMS action: ${action}`);
    },
    getOAuthFlowStepTimeoutMs: async (defaultTimeoutMs) => defaultTimeoutMs,
    getState: async () => ({ ...currentState }),
    sendToContentScriptResilient: async (_source, message) => {
      messages.push(message.type);
      if (message.type === 'SUBMIT_PHONE_NUMBER') {
        const phoneNumber = message.payload.phoneNumber;
        submittedNumbers.push(phoneNumber);
        if (phoneNumber === '66950004111') {
          return {
            addPhoneRejected: true,
            addPhonePage: true,
            errorText: usedText,
            url: 'https://auth.openai.com/add-phone',
          };
        }
        return {
          phoneVerificationPage: true,
          url: 'https://auth.openai.com/phone-verification',
        };
      }
      if (message.type === 'RETURN_TO_ADD_PHONE') {
        return {
          addPhonePage: true,
          phoneVerificationPage: false,
          url: 'https://auth.openai.com/add-phone',
        };
      }
      if (message.type === 'STEP8_GET_STATE') {
        return {
          addPhonePage: true,
          phoneVerificationPage: false,
          url: 'https://auth.openai.com/add-phone',
        };
      }
      if (message.type === 'SUBMIT_PHONE_VERIFICATION_CODE') {
        return {
          success: true,
          consentReady: true,
          url: 'https://auth.openai.com/authorize',
        };
      }
      if (message.type === 'RESEND_PHONE_VERIFICATION_CODE') {
        throw new Error('used add-phone rejection should rotate before resend.');
      }
      throw new Error(`Unexpected content-script message: ${message.type}`);
    },
    setState: async (updates) => {
      currentState = { ...currentState, ...updates };
    },
    sleepWithStop: async () => {},
    throwIfStopped: () => {},
  });

  const result = await helpers.completePhoneVerificationFlow(1, {
    addPhonePage: true,
    phoneVerificationPage: false,
    url: 'https://auth.openai.com/add-phone',
  });

  assert.deepStrictEqual(result, {
    success: true,
    consentReady: true,
    url: 'https://auth.openai.com/authorize',
  });
  assert.deepStrictEqual(submittedNumbers, ['66950004111', '66950004222']);
  assert.equal(currentState.freeReusablePhoneActivation, null);
  assert.deepStrictEqual(
    currentState.phoneReusableActivationPool.filter((activation) => activation.phoneNumber === '+66 95 000 4111'),
    []
  );
  assert.equal(messages.includes('RESEND_PHONE_VERIFICATION_CODE'), false);
});

test('phone verification helper treats phone_max_usage_exceeded as used-number and rotates immediately', async () => {
  const requests = [];
  const messages = [];
  let currentState = {
    heroSmsApiKey: 'demo-key',
    verificationResendCount: 1,
    currentPhoneActivation: null,
    reusablePhoneActivation: null,
    phoneReusableActivationPool: [
      {
        activationId: 'pool-max-match',
        phoneNumber: '+66 95 000 1011',
        provider: 'hero-sms',
        serviceCode: 'dr',
        countryId: 52,
        successfulUses: 1,
        maxUses: 3,
      },
    ],
    freeReusablePhoneActivation: {
      activationId: 'free-max-match',
      phoneNumber: '+66 95 000 1011',
      provider: 'hero-sms',
      serviceCode: 'dr',
      countryId: 52,
      countryLabel: 'Thailand',
      successfulUses: 0,
      maxUses: 3,
      source: 'free-manual-reuse',
    },
  };

  const numbers = [
    { activationId: '711111', phoneNumber: '66950001011' },
    { activationId: '722222', phoneNumber: '66950001022' },
  ];
  let numberIndex = 0;
  let submitCodeCount = 0;

  const helpers = api.createPhoneVerificationHelpers({
    addLog: async () => {},
    ensureStep8SignupPageReady: async () => {},
    fetchImpl: async (url) => {
      const parsedUrl = new URL(url);
      requests.push(parsedUrl);
      const action = parsedUrl.searchParams.get('action');
      const id = parsedUrl.searchParams.get('id');

      if (action === 'getPrices') {
        return {
          ok: true,
          text: async () => buildHeroSmsPricesPayload(),
        };
      }
      if (action === 'getNumber') {
        const nextNumber = numbers[numberIndex];
        numberIndex += 1;
        return {
          ok: true,
          text: async () => `ACCESS_NUMBER:${nextNumber.activationId}:${nextNumber.phoneNumber}`,
        };
      }
      if (action === 'getStatus') {
        return {
          ok: true,
          text: async () => 'STATUS_OK:654321',
        };
      }
      if (action === 'setStatus') {
        return {
          ok: true,
          text: async () => `STATUS_UPDATED:${id}`,
        };
      }
      throw new Error(`Unexpected HeroSMS action: ${action}`);
    },
    getOAuthFlowStepTimeoutMs: async (defaultTimeoutMs) => defaultTimeoutMs,
    getState: async () => ({ ...currentState }),
    sendToContentScriptResilient: async (_source, message) => {
      messages.push(message.type);
      if (message.type === 'SUBMIT_PHONE_NUMBER') {
        return {
          phoneVerificationPage: true,
          url: 'https://auth.openai.com/phone-verification',
        };
      }
      if (message.type === 'SUBMIT_PHONE_VERIFICATION_CODE') {
        submitCodeCount += 1;
        if (submitCodeCount === 1) {
          return {
            invalidCode: true,
            errorText: 'An error occurred during authentication (phone_max_usage_exceeded). Please try again.',
            url: 'https://auth.openai.com/phone-verification',
          };
        }
        return {
          success: true,
          consentReady: true,
          url: 'https://auth.openai.com/authorize',
        };
      }
      if (message.type === 'RETURN_TO_ADD_PHONE') {
        return {
          addPhonePage: true,
          url: 'https://auth.openai.com/add-phone',
        };
      }
      if (message.type === 'RESEND_PHONE_VERIFICATION_CODE') {
        throw new Error('should not resend for phone_max_usage_exceeded');
      }
      throw new Error(`Unexpected content-script message: ${message.type}`);
    },
    setState: async (updates) => {
      currentState = { ...currentState, ...updates };
    },
    sleepWithStop: async () => {},
    throwIfStopped: () => {},
  });

  const result = await helpers.completePhoneVerificationFlow(1, {
    addPhonePage: true,
    phoneVerificationPage: false,
    url: 'https://auth.openai.com/add-phone',
  });

  assert.deepStrictEqual(result, {
    success: true,
    consentReady: true,
    url: 'https://auth.openai.com/authorize',
  });
  assert.deepStrictEqual(messages, [
    'SUBMIT_PHONE_NUMBER',
    'SUBMIT_PHONE_VERIFICATION_CODE',
    'RETURN_TO_ADD_PHONE',
    'STEP8_GET_STATE',
    'RETURN_TO_ADD_PHONE',
    'SUBMIT_PHONE_NUMBER',
    'SUBMIT_PHONE_VERIFICATION_CODE',
  ]);
  assert.equal(currentState.freeReusablePhoneActivation, null);
  assert.deepStrictEqual(
    currentState.phoneReusableActivationPool.filter((activation) => activation.phoneNumber === '+66 95 000 1011'),
    []
  );
});

test('phone verification helper rotates number when submitPhoneVerificationCode throws phone_max_usage_exceeded', async () => {
  const requests = [];
  const messages = [];
  let currentState = {
    heroSmsApiKey: 'demo-key',
    verificationResendCount: 1,
    currentPhoneActivation: null,
    reusablePhoneActivation: null,
  };

  const numbers = [
    { activationId: '811111', phoneNumber: '66950002011' },
    { activationId: '822222', phoneNumber: '66950002022' },
  ];
  let numberIndex = 0;
  let submitCodeCount = 0;

  const helpers = api.createPhoneVerificationHelpers({
    addLog: async () => {},
    ensureStep8SignupPageReady: async () => {},
    fetchImpl: async (url) => {
      const parsedUrl = new URL(url);
      requests.push(parsedUrl);
      const action = parsedUrl.searchParams.get('action');
      const id = parsedUrl.searchParams.get('id');

      if (action === 'getPrices') {
        return {
          ok: true,
          text: async () => buildHeroSmsPricesPayload(),
        };
      }
      if (action === 'getNumber') {
        const nextNumber = numbers[numberIndex];
        numberIndex += 1;
        return {
          ok: true,
          text: async () => `ACCESS_NUMBER:${nextNumber.activationId}:${nextNumber.phoneNumber}`,
        };
      }
      if (action === 'getStatus') {
        return {
          ok: true,
          text: async () => 'STATUS_OK:654321',
        };
      }
      if (action === 'setStatus') {
        return {
          ok: true,
          text: async () => `STATUS_UPDATED:${id}`,
        };
      }
      throw new Error(`Unexpected HeroSMS action: ${action}`);
    },
    getOAuthFlowStepTimeoutMs: async (defaultTimeoutMs) => defaultTimeoutMs,
    getState: async () => ({ ...currentState }),
    sendToContentScriptResilient: async (_source, message) => {
      messages.push(message.type);
      if (message.type === 'SUBMIT_PHONE_NUMBER') {
        return {
          phoneVerificationPage: true,
          url: 'https://auth.openai.com/phone-verification',
        };
      }
      if (message.type === 'SUBMIT_PHONE_VERIFICATION_CODE') {
        submitCodeCount += 1;
        if (submitCodeCount === 1) {
          return {
            error: 'An error occurred during authentication (phone_max_usage_exceeded). Please try again.',
          };
        }
        return {
          success: true,
          consentReady: true,
          url: 'https://auth.openai.com/authorize',
        };
      }
      if (message.type === 'RETURN_TO_ADD_PHONE') {
        return {
          addPhonePage: true,
          url: 'https://auth.openai.com/add-phone',
        };
      }
      throw new Error(`Unexpected content-script message: ${message.type}`);
    },
    setState: async (updates) => {
      currentState = { ...currentState, ...updates };
    },
    sleepWithStop: async () => {},
    throwIfStopped: () => {},
  });

  const result = await helpers.completePhoneVerificationFlow(1, {
    addPhonePage: true,
    phoneVerificationPage: false,
    url: 'https://auth.openai.com/add-phone',
  });

  assert.deepStrictEqual(result, {
    success: true,
    consentReady: true,
    url: 'https://auth.openai.com/authorize',
  });
  assert.deepStrictEqual(messages, [
    'SUBMIT_PHONE_NUMBER',
    'SUBMIT_PHONE_VERIFICATION_CODE',
    'RETURN_TO_ADD_PHONE',
    'STEP8_GET_STATE',
    'RETURN_TO_ADD_PHONE',
    'SUBMIT_PHONE_NUMBER',
    'SUBMIT_PHONE_VERIFICATION_CODE',
  ]);
});

test('phone verification helper replaces number when add-phone submission fails with country selection mismatch', async () => {
  const requests = [];
  const messages = [];
  let currentState = {
    heroSmsApiKey: 'demo-key',
    heroSmsCountryId: 16,
    heroSmsCountryLabel: 'United Kingdom',
    verificationResendCount: 0,
    phoneVerificationReplacementLimit: 2,
    currentPhoneActivation: null,
    reusablePhoneActivation: null,
  };

  const numbers = [
    { activationId: '611111', phoneNumber: '447999221823' },
    { activationId: '622222', phoneNumber: '447777000111' },
  ];
  let numberIndex = 0;
  let submitNumberCount = 0;

  const helpers = api.createPhoneVerificationHelpers({
    addLog: async () => {},
    ensureStep8SignupPageReady: async () => {},
    fetchImpl: async (url) => {
      const parsedUrl = new URL(url);
      requests.push(parsedUrl);
      const action = parsedUrl.searchParams.get('action');
      const id = parsedUrl.searchParams.get('id');
      if (action === 'getPrices') {
        return {
          ok: true,
          text: async () => buildHeroSmsPricesPayload({ country: '16', cost: 0.09 }),
        };
      }
      if (action === 'getNumber') {
        const nextNumber = numbers[numberIndex];
        numberIndex += 1;
        return {
          ok: true,
          text: async () => `ACCESS_NUMBER:${nextNumber.activationId}:${nextNumber.phoneNumber}`,
        };
      }
      if (action === 'getStatus') {
        return {
          ok: true,
          text: async () => 'STATUS_OK:654321',
        };
      }
      if (action === 'setStatus') {
        return {
          ok: true,
          text: async () => `STATUS_UPDATED:${id}`,
        };
      }
      throw new Error(`Unexpected HeroSMS action: ${action}`);
    },
    getOAuthFlowStepTimeoutMs: async (defaultTimeoutMs) => defaultTimeoutMs,
    getState: async () => ({ ...currentState }),
    sendToContentScriptResilient: async (_source, message) => {
      messages.push(message.type);
      if (message.type === 'SUBMIT_PHONE_NUMBER') {
        submitNumberCount += 1;
        if (submitNumberCount === 1) {
          throw new Error('Failed to select "Country #16" on the add-phone page.');
        }
        return {
          phoneVerificationPage: true,
          url: 'https://auth.openai.com/phone-verification',
        };
      }
      if (message.type === 'SUBMIT_PHONE_VERIFICATION_CODE') {
        return {
          success: true,
          consentReady: true,
          url: 'https://auth.openai.com/authorize',
        };
      }
      throw new Error(`Unexpected content-script message: ${message.type}`);
    },
    setState: async (updates) => {
      currentState = { ...currentState, ...updates };
    },
    sleepWithStop: async () => {},
    throwIfStopped: () => {},
  });

  const result = await helpers.completePhoneVerificationFlow(1, {
    addPhonePage: true,
    phoneVerificationPage: false,
    url: 'https://auth.openai.com/add-phone',
  });

  assert.deepStrictEqual(result, {
    success: true,
    consentReady: true,
    url: 'https://auth.openai.com/authorize',
  });
  assert.equal(messages.filter((type) => type === 'SUBMIT_PHONE_NUMBER').length, 2);
  assert.equal(requests.filter((url) => url.searchParams.get('action') === 'getNumber').length, 2);
});

test('phone verification helper reuses the same number up to three successful registrations', async () => {
  const requests = [];
  let currentState = {
    heroSmsApiKey: 'demo-key',
    verificationResendCount: 0,
    currentPhoneActivation: null,
    reusablePhoneActivation: {
      activationId: '123456',
      phoneNumber: '66959916439',
      provider: 'hero-sms',
      serviceCode: 'dr',
      countryId: 52,
      successfulUses: 2,
      maxUses: 3,
    },
  };

  const helpers = api.createPhoneVerificationHelpers({
    addLog: async () => {},
    ensureStep8SignupPageReady: async () => {},
    fetchImpl: async (url) => {
      const parsedUrl = new URL(url);
      requests.push(parsedUrl);
      const action = parsedUrl.searchParams.get('action');
      if (action === 'reactivate') {
        return {
          ok: true,
          text: async () => JSON.stringify({
            activationId: '222333',
            phoneNumber: '66959916439',
          }),
        };
      }
      if (action === 'getStatus') {
        return {
          ok: true,
          text: async () => 'STATUS_OK:654321',
        };
      }
      if (action === 'setStatus') {
        return {
          ok: true,
          text: async () => 'ACCESS_ACTIVATION',
        };
      }
      throw new Error(`Unexpected HeroSMS action: ${action}`);
    },
    getOAuthFlowStepTimeoutMs: async (defaultTimeoutMs) => defaultTimeoutMs,
    getState: async () => ({ ...currentState }),
    sendToContentScriptResilient: async (_source, message) => {
      if (message.type === 'SUBMIT_PHONE_NUMBER') {
        return {
          phoneVerificationPage: true,
          url: 'https://auth.openai.com/phone-verification',
        };
      }
      if (message.type === 'SUBMIT_PHONE_VERIFICATION_CODE') {
        return {
          success: true,
          consentReady: true,
          url: 'https://auth.openai.com/authorize',
        };
      }
      throw new Error(`Unexpected content-script message: ${message.type}`);
    },
    setState: async (updates) => {
      currentState = { ...currentState, ...updates };
    },
    sleepWithStop: async () => {},
    throwIfStopped: () => {},
  });

  const result = await helpers.completePhoneVerificationFlow(1, {
    addPhonePage: true,
    phoneVerificationPage: false,
    url: 'https://auth.openai.com/add-phone',
  });

  assert.deepStrictEqual(result, {
    success: true,
    consentReady: true,
    url: 'https://auth.openai.com/authorize',
  });
  assert.equal(requests[0].searchParams.get('action'), 'reactivate');
  assert.equal(requests[0].searchParams.get('id'), '123456');
  assert.deepStrictEqual(currentState.reusablePhoneActivation, null);
});

test('phone verification helper keeps maxUses behavior for reused V2 activations', async () => {
  const requests = [];
  let currentState = {
    heroSmsApiKey: 'demo-key',
    heroSmsCountryId: 16,
    heroSmsCountryLabel: 'United Kingdom',
    verificationResendCount: 0,
    currentPhoneActivation: null,
    reusablePhoneActivation: {
      activationId: '123456',
      phoneNumber: '447911123456',
      provider: 'hero-sms',
      serviceCode: 'dr',
      countryId: 16,
      successfulUses: 2,
      maxUses: 3,
      statusAction: 'getStatusV2',
    },
  };

  const helpers = api.createPhoneVerificationHelpers({
    addLog: async () => {},
    ensureStep8SignupPageReady: async () => {},
    fetchImpl: async (url) => {
      const parsedUrl = new URL(url);
      requests.push(parsedUrl);
      const action = parsedUrl.searchParams.get('action');
      if (action === 'reactivate') {
        return {
          ok: true,
          text: async () => JSON.stringify({
            activationId: '222333',
            phoneNumber: '447911123456',
          }),
        };
      }
      if (action === 'getStatusV2') {
        return {
          ok: true,
          text: async () => buildHeroSmsStatusV2Payload({ smsCode: '654321', smsText: 'Your code is 654321' }),
        };
      }
      if (action === 'setStatus') {
        return {
          ok: true,
          text: async () => 'ACCESS_ACTIVATION',
        };
      }
      throw new Error(`Unexpected HeroSMS action: ${action}`);
    },
    getOAuthFlowStepTimeoutMs: async (defaultTimeoutMs) => defaultTimeoutMs,
    getState: async () => ({ ...currentState }),
    sendToContentScriptResilient: async (_source, message) => {
      if (message.type === 'SUBMIT_PHONE_NUMBER') {
        return {
          phoneVerificationPage: true,
          url: 'https://auth.openai.com/phone-verification',
        };
      }
      if (message.type === 'SUBMIT_PHONE_VERIFICATION_CODE') {
        return {
          success: true,
          consentReady: true,
          url: 'https://auth.openai.com/authorize',
        };
      }
      throw new Error(`Unexpected content-script message: ${message.type}`);
    },
    setState: async (updates) => {
      currentState = { ...currentState, ...updates };
    },
    sleepWithStop: async () => {},
    throwIfStopped: () => {},
  });

  const result = await helpers.completePhoneVerificationFlow(1, {
    addPhonePage: true,
    phoneVerificationPage: false,
    url: 'https://auth.openai.com/add-phone',
  });

  assert.deepStrictEqual(result, {
    success: true,
    consentReady: true,
    url: 'https://auth.openai.com/authorize',
  });
  const actions = requests.map((url) => url.searchParams.get('action'));
  assert.deepStrictEqual(actions, ['reactivate', 'getStatusV2', 'setStatus']);
  assert.deepStrictEqual(currentState.reusablePhoneActivation, null);
});

test('phone verification helper gives automatic free reuse priority over paid reuse and new acquisition', async () => {
  const requests = [];
  let statusPollCount = 0;
  let currentState = {
    heroSmsApiKey: 'demo-key',
    heroSmsReuseEnabled: true,
    freePhoneReuseEnabled: true,
    freePhoneReuseAutoEnabled: true,
    verificationResendCount: 0,
    currentPhoneActivation: null,
    reusablePhoneActivation: {
      activationId: 'paid-reuse',
      phoneNumber: '66950003333',
      provider: 'hero-sms',
      serviceCode: 'dr',
      countryId: 52,
      countryLabel: 'Thailand',
      successfulUses: 0,
      maxUses: 3,
    },
    freeReusablePhoneActivation: {
      activationId: 'free-priority',
      phoneNumber: '66950004444',
      provider: 'hero-sms',
      serviceCode: 'dr',
      countryId: 52,
      countryLabel: 'Thailand',
      successfulUses: 0,
      maxUses: 3,
      source: 'free-manual-reuse',
    },
  };

  const helpers = api.createPhoneVerificationHelpers({
    addLog: async () => {},
    ensureStep8SignupPageReady: async () => {},
    fetchImpl: async (url) => {
      const parsedUrl = new URL(url);
      requests.push(parsedUrl);
      const action = parsedUrl.searchParams.get('action');
      const id = parsedUrl.searchParams.get('id');
      if (action === 'reactivate' || action === 'getPrices' || action === 'getNumber' || action === 'getNumberV2') {
        throw new Error(`${action} should not be called before automatic free reuse`);
      }
      if (action === 'setStatus' && id === 'free-priority') {
        return { ok: true, text: async () => 'ACCESS_RETRY_GET' };
      }
      if (action === 'getStatus' && id === 'free-priority') {
        statusPollCount += 1;
        return { ok: true, text: async () => (statusPollCount === 1 ? 'STATUS_WAIT_CODE' : 'STATUS_OK:112233') };
      }
      throw new Error(`Unexpected HeroSMS action: ${action}:${id || ''}`);
    },
    getOAuthFlowStepTimeoutMs: async (defaultTimeoutMs) => defaultTimeoutMs,
    getState: async () => ({ ...currentState }),
    sendToContentScriptResilient: async (_source, message) => {
      if (message.type === 'SUBMIT_PHONE_NUMBER') {
        return { phoneVerificationPage: true, url: 'https://auth.openai.com/phone-verification' };
      }
      if (message.type === 'SUBMIT_PHONE_VERIFICATION_CODE') {
        return { success: true, consentReady: true, url: 'https://auth.openai.com/authorize' };
      }
      throw new Error(`Unexpected content-script message: ${message.type}`);
    },
    setState: async (updates) => {
      currentState = { ...currentState, ...updates };
    },
    sleepWithStop: async () => {},
    throwIfStopped: () => {},
  });

  const result = await helpers.completePhoneVerificationFlow(1, {
    addPhonePage: true,
    phoneVerificationPage: false,
    url: 'https://auth.openai.com/add-phone',
  });

  assert.deepStrictEqual(result, {
    success: true,
    consentReady: true,
    url: 'https://auth.openai.com/authorize',
  });
  assert.deepStrictEqual(
    requests.map((requestUrl) => requestUrl.searchParams.get('action')),
    ['setStatus', 'getStatus', 'getStatus']
  );
  assert.deepStrictEqual(
    requests
      .filter((requestUrl) => requestUrl.searchParams.get('action') === 'setStatus')
      .map((requestUrl) => requestUrl.searchParams.get('status')),
    ['3']
  );
  assert.equal(currentState.freeReusablePhoneActivation.successfulUses, 1);
  assert.equal(currentState.freeReusablePhoneActivation.activationId, 'free-priority');
  assert.equal(currentState.reusablePhoneActivation.activationId, 'paid-reuse');
});

test('phone verification helper hands off manual-only free reuse even when automatic free reuse is enabled', async () => {
  const requests = [];
  const messages = [];
  const stops = [];
  let currentState = {
    heroSmsApiKey: 'demo-key',
    heroSmsReuseEnabled: true,
    freePhoneReuseEnabled: true,
    freePhoneReuseAutoEnabled: true,
    verificationResendCount: 0,
    currentPhoneActivation: null,
    reusablePhoneActivation: {
      activationId: 'paid-reuse',
      phoneNumber: '66950003333',
      provider: 'hero-sms',
      serviceCode: 'dr',
      countryId: 52,
      countryLabel: 'Thailand',
      successfulUses: 0,
      maxUses: 3,
    },
    freeReusablePhoneActivation: {
      phoneNumber: '84943328460',
      provider: 'hero-sms',
      serviceCode: 'dr',
      countryId: 52,
      countryLabel: 'Thailand',
      successfulUses: 1,
      maxUses: 3,
      source: 'free-manual-reuse',
      manualOnly: true,
    },
  };

  const helpers = api.createPhoneVerificationHelpers({
    addLog: async () => {},
    ensureStep8SignupPageReady: async () => {},
    fetchImpl: async (url) => {
      const parsedUrl = new URL(url);
      requests.push(parsedUrl);
      throw new Error(`HeroSMS should not be called for manual-only free reuse: ${parsedUrl.searchParams.get('action')}`);
    },
    getOAuthFlowStepTimeoutMs: async (defaultTimeoutMs) => defaultTimeoutMs,
    getState: async () => ({ ...currentState }),
    requestStop: async (payload) => {
      stops.push(payload);
    },
    sendToContentScriptResilient: async (_source, message) => {
      messages.push(message);
      if (message.type === 'SUBMIT_PHONE_NUMBER') {
        assert.equal(message.payload.phoneNumber, '84943328460');
        return { phoneVerificationPage: true, url: 'https://auth.openai.com/phone-verification' };
      }
      throw new Error(`Unexpected content-script message: ${message.type}`);
    },
    setState: async (updates) => {
      currentState = { ...currentState, ...updates };
    },
    sleepWithStop: async () => {},
    throwIfStopped: () => {},
  });

  await assert.rejects(
    helpers.completePhoneVerificationFlow(1, {
      addPhonePage: true,
      phoneVerificationPage: false,
      url: 'https://auth.openai.com/add-phone',
    }),
    (error) => {
      assert.match(error.message, /^PHONE_MANUAL_FREE_REUSE::/);
      assert.equal(error.result?.manualFreePhoneReuse, true);
      assert.equal(error.result?.phoneNumber, '84943328460');
      assert.deepStrictEqual(error.result?.fillResult, {
        phoneVerificationPage: true,
        url: 'https://auth.openai.com/phone-verification',
      });
      return true;
    }
  );

  assert.deepStrictEqual(messages.map((message) => message.type), ['SUBMIT_PHONE_NUMBER']);
  assert.equal(stops.length, 1);
  assert.match(stops[0].logMessage, /开始手动复用手机 84943328460/);
  assert.deepStrictEqual(requests, []);
  assert.equal(currentState.currentPhoneActivation, null);
  assert.equal(currentState.reusablePhoneActivation.activationId, 'paid-reuse');
  assert.equal(currentState.freeReusablePhoneActivation.phoneNumber, '84943328460');
});

test('phone verification helper infers manual free reuse country from phone prefix', async () => {
  const messages = [];
  const stops = [];
  let currentState = {
    heroSmsApiKey: 'demo-key',
    heroSmsCountryId: 52,
    heroSmsCountryLabel: 'Thailand',
    freePhoneReuseEnabled: true,
    freePhoneReuseAutoEnabled: true,
    verificationResendCount: 0,
    currentPhoneActivation: null,
    freeReusablePhoneActivation: {
      phoneNumber: '84943328460',
      provider: 'hero-sms',
      serviceCode: 'dr',
      successfulUses: 1,
      maxUses: 3,
      source: 'free-manual-reuse',
      manualOnly: true,
    },
  };

  const helpers = api.createPhoneVerificationHelpers({
    addLog: async () => {},
    ensureStep8SignupPageReady: async () => {},
    fetchImpl: async (url) => {
      const parsedUrl = new URL(url);
      throw new Error(`HeroSMS should not be called for manual-only free reuse: ${parsedUrl.searchParams.get('action')}`);
    },
    getOAuthFlowStepTimeoutMs: async (defaultTimeoutMs) => defaultTimeoutMs,
    getState: async () => ({ ...currentState }),
    requestStop: async (payload) => {
      stops.push(payload);
    },
    sendToContentScriptResilient: async (_source, message) => {
      messages.push(message);
      if (message.type === 'SUBMIT_PHONE_NUMBER') {
        return { phoneVerificationPage: true, url: 'https://auth.openai.com/phone-verification' };
      }
      throw new Error(`Unexpected content-script message: ${message.type}`);
    },
    setState: async (updates) => {
      currentState = { ...currentState, ...updates };
    },
    sleepWithStop: async () => {},
    throwIfStopped: () => {},
  });

  await assert.rejects(
    helpers.completePhoneVerificationFlow(1, {
      addPhonePage: true,
      phoneVerificationPage: false,
      url: 'https://auth.openai.com/add-phone',
    }),
    (error) => {
      assert.match(error.message, /^PHONE_MANUAL_FREE_REUSE::/);
      return true;
    }
  );

  assert.equal(stops.length, 1);
  assert.deepStrictEqual(messages.map((message) => message.type), ['SUBMIT_PHONE_NUMBER']);
  assert.equal(messages[0].payload.phoneNumber, '84943328460');
  assert.equal(messages[0].payload.countryId, 10);
  assert.equal(messages[0].payload.countryLabel, 'Vietnam');
});

test('phone verification helper infers major HeroSMS countries from phone prefixes', async () => {
  const cases = [
    { phoneNumber: '12025550123', countryId: 187, countryLabel: 'USA' },
    { phoneNumber: '447911123456', countryId: 16, countryLabel: 'United Kingdom' },
    { phoneNumber: '819012345678', countryId: 151, countryLabel: 'Japan' },
    { phoneNumber: '4915112345678', countryId: 43, countryLabel: 'Germany' },
    { phoneNumber: '33612345678', countryId: 73, countryLabel: 'France' },
    { phoneNumber: '84943328460', countryId: 10, countryLabel: 'Vietnam' },
    { phoneNumber: '66950003333', countryId: 52, countryLabel: 'Thailand' },
    { phoneNumber: '628111111111', countryId: 6, countryLabel: 'Indonesia' },
  ];

  for (const testCase of cases) {
    const messages = [];
    let currentState = {
      heroSmsApiKey: 'demo-key',
      heroSmsCountryId: 52,
      heroSmsCountryLabel: 'Thailand',
      freePhoneReuseEnabled: true,
      freePhoneReuseAutoEnabled: true,
      verificationResendCount: 0,
      currentPhoneActivation: null,
      freeReusablePhoneActivation: {
        phoneNumber: testCase.phoneNumber,
        provider: 'hero-sms',
        serviceCode: 'dr',
        successfulUses: 1,
        maxUses: 3,
        source: 'free-manual-reuse',
        manualOnly: true,
      },
    };

    const helpers = api.createPhoneVerificationHelpers({
      addLog: async () => {},
      ensureStep8SignupPageReady: async () => {},
      fetchImpl: async (url) => {
        const parsedUrl = new URL(url);
        throw new Error(`HeroSMS should not be called for manual-only free reuse: ${parsedUrl.searchParams.get('action')}`);
      },
      getOAuthFlowStepTimeoutMs: async (defaultTimeoutMs) => defaultTimeoutMs,
      getState: async () => ({ ...currentState }),
      requestStop: async () => {},
      sendToContentScriptResilient: async (_source, message) => {
        messages.push(message);
        if (message.type === 'SUBMIT_PHONE_NUMBER') {
          return { phoneVerificationPage: true, url: 'https://auth.openai.com/phone-verification' };
        }
        throw new Error(`Unexpected content-script message: ${message.type}`);
      },
      setState: async (updates) => {
        currentState = { ...currentState, ...updates };
      },
      sleepWithStop: async () => {},
      throwIfStopped: () => {},
    });

    await assert.rejects(
      helpers.completePhoneVerificationFlow(1, {
        addPhonePage: true,
        phoneVerificationPage: false,
        url: 'https://auth.openai.com/add-phone',
      }),
      (error) => {
        assert.match(error.message, /^PHONE_MANUAL_FREE_REUSE::/);
        return true;
      }
    );

    assert.equal(messages.length, 1, testCase.phoneNumber);
    assert.equal(messages[0].payload.phoneNumber, testCase.phoneNumber);
    assert.equal(messages[0].payload.countryId, testCase.countryId, testCase.phoneNumber);
    assert.equal(messages[0].payload.countryLabel, testCase.countryLabel, testCase.phoneNumber);
  }
});

test('phone verification helper accepts HeroSMS WAIT_RETRY as free-reuse ready without using its suffix as code', async () => {
  const requests = [];
  const events = [];
  const submittedCodes = [];
  let statusPollCount = 0;
  let currentState = {
    heroSmsApiKey: 'demo-key',
    freePhoneReuseEnabled: true,
    freePhoneReuseAutoEnabled: true,
    verificationResendCount: 0,
    currentPhoneActivation: null,
    freeReusablePhoneActivation: {
      activationId: 'retry-ready-free',
      phoneNumber: '6283184934060',
      provider: 'hero-sms',
      serviceCode: 'dr',
      countryId: 6,
      countryLabel: 'Indonesia',
      successfulUses: 0,
      maxUses: 3,
      source: 'free-manual-reuse',
    },
  };

  const helpers = api.createPhoneVerificationHelpers({
    addLog: async () => {},
    ensureStep8SignupPageReady: async () => {},
    fetchImpl: async (url) => {
      const parsedUrl = new URL(url);
      requests.push(parsedUrl);
      const action = parsedUrl.searchParams.get('action');
      const id = parsedUrl.searchParams.get('id');
      const status = parsedUrl.searchParams.get('status');
      events.push(action === 'setStatus' ? `${action}:${status}` : action);
      if (action === 'setStatus' && id === 'retry-ready-free' && status === '3') {
        return { ok: true, text: async () => 'ACCESS_RETRY_GET' };
      }
      if (action === 'getStatus' && id === 'retry-ready-free') {
        statusPollCount += 1;
        return {
          ok: true,
          text: async () => (statusPollCount === 1 ? 'STATUS_WAIT_RETRY:100001' : 'STATUS_OK:654321'),
        };
      }
      throw new Error(`Unexpected HeroSMS action: ${action}:${id || ''}:${status || ''}`);
    },
    getOAuthFlowStepTimeoutMs: async (defaultTimeoutMs) => defaultTimeoutMs,
    getState: async () => ({ ...currentState }),
    sendToContentScriptResilient: async (_source, message) => {
      events.push(message.type);
      if (message.type === 'SUBMIT_PHONE_NUMBER') {
        assert.equal(message.payload.phoneNumber, '6283184934060');
        return { phoneVerificationPage: true, url: 'https://auth.openai.com/phone-verification' };
      }
      if (message.type === 'SUBMIT_PHONE_VERIFICATION_CODE') {
        submittedCodes.push(message.payload.code);
        return { success: true, consentReady: true, url: 'https://auth.openai.com/authorize' };
      }
      throw new Error(`Unexpected content-script message: ${message.type}`);
    },
    setState: async (updates) => {
      currentState = { ...currentState, ...updates };
    },
    sleepWithStop: async () => {
      events.push('sleep');
    },
    throwIfStopped: () => {},
  });

  const result = await helpers.completePhoneVerificationFlow(1, {
    addPhonePage: true,
    phoneVerificationPage: false,
    url: 'https://auth.openai.com/add-phone',
  });

  assert.deepStrictEqual(result, {
    success: true,
    consentReady: true,
    url: 'https://auth.openai.com/authorize',
  });
  assert.deepStrictEqual(submittedCodes, ['654321']);
  assert.equal(submittedCodes.includes('100001'), false);
  assert.deepStrictEqual(
    events.slice(0, 4),
    ['setStatus:3', 'sleep', 'getStatus', 'SUBMIT_PHONE_NUMBER']
  );
  assert.equal(currentState.freeReusablePhoneActivation.successfulUses, 1);
  assert.equal(
    requests.some((requestUrl) => ['reactivate', 'getPrices', 'getNumber', 'getNumberV2'].includes(requestUrl.searchParams.get('action'))),
    false
  );
});

test('phone verification helper stops failed automatic free reuse without buying a new number', async () => {
  const requests = [];
  const messages = [];
  const stops = [];
  let currentState = {
    heroSmsApiKey: 'demo-key',
    freePhoneReuseEnabled: true,
    freePhoneReuseAutoEnabled: true,
    verificationResendCount: 0,
    currentPhoneActivation: null,
    freeReusablePhoneActivation: {
      activationId: 'cancelled-free',
      phoneNumber: '66950007777',
      provider: 'hero-sms',
      serviceCode: 'dr',
      countryId: 52,
      countryLabel: 'Thailand',
      successfulUses: 0,
      maxUses: 3,
      source: 'free-manual-reuse',
    },
  };

  const helpers = api.createPhoneVerificationHelpers({
    addLog: async () => {},
    ensureStep8SignupPageReady: async () => {},
    fetchImpl: async (url) => {
      const parsedUrl = new URL(url);
      requests.push(parsedUrl);
      const action = parsedUrl.searchParams.get('action');
      const id = parsedUrl.searchParams.get('id');
      if (action === 'setStatus' && id === 'cancelled-free') {
        return { ok: true, text: async () => 'ACCESS_RETRY_GET' };
      }
      if (action === 'getStatus' && id === 'cancelled-free') {
        return { ok: true, text: async () => 'STATUS_CANCEL' };
      }
      if (action === 'reactivate' || action === 'getPrices' || action === 'getNumber' || action === 'getNumberV2') {
        throw new Error(`${action} should not be called after automatic free reuse preparation fails`);
      }
      throw new Error(`Unexpected HeroSMS action: ${action}:${id || ''}`);
    },
    getOAuthFlowStepTimeoutMs: async (defaultTimeoutMs) => defaultTimeoutMs,
    getState: async () => ({ ...currentState }),
    requestStop: async (payload) => {
      stops.push(payload);
    },
    sendToContentScriptResilient: async (_source, message) => {
      messages.push(message);
      throw new Error(`Auth page should not be touched after failed free reuse: ${message.type}`);
    },
    setState: async (updates) => {
      currentState = { ...currentState, ...updates };
    },
    sleepWithStop: async () => {},
    throwIfStopped: () => {},
  });

  await assert.rejects(
    helpers.completePhoneVerificationFlow(1, {
      addPhonePage: true,
      phoneVerificationPage: false,
      url: 'https://auth.openai.com/add-phone',
    }),
    /PHONE_AUTO_FREE_REUSE_PREPARE::/
  );

  assert.deepStrictEqual(messages, []);
  assert.equal(stops.length, 1);
  assert.match(stops[0].logMessage, /不购买新 HeroSMS 号码/);
  assert.equal(currentState.freeReusablePhoneActivation, null);
  assert.equal(
    requests.some((requestUrl) => ['reactivate', 'getPrices', 'getNumber', 'getNumberV2'].includes(requestUrl.searchParams.get('action'))),
    false
  );
});

test('phone verification helper stops never-ready automatic free reuse without buying or reactivating', async () => {
  const requests = [];
  const messages = [];
  const stops = [];
  let currentState = {
    heroSmsApiKey: 'demo-key',
    heroSmsReuseEnabled: true,
    freePhoneReuseEnabled: true,
    freePhoneReuseAutoEnabled: true,
    verificationResendCount: 0,
    currentPhoneActivation: null,
    freeReusablePhoneActivation: {
      activationId: 'never-ready-free',
      phoneNumber: '66950008888',
      provider: 'hero-sms',
      serviceCode: 'dr',
      countryId: 52,
      countryLabel: 'Thailand',
      successfulUses: 0,
      maxUses: 3,
      source: 'free-manual-reuse',
    },
  };

  const helpers = api.createPhoneVerificationHelpers({
    addLog: async () => {},
    ensureStep8SignupPageReady: async () => {},
    fetchImpl: async (url) => {
      const parsedUrl = new URL(url);
      requests.push(parsedUrl);
      const action = parsedUrl.searchParams.get('action');
      const id = parsedUrl.searchParams.get('id');
      if (action === 'setStatus' && id === 'never-ready-free') {
        return { ok: true, text: async () => 'ACCESS_RETRY_GET' };
      }
      if (action === 'getStatus' && id === 'never-ready-free') {
        return { ok: true, text: async () => 'STATUS_OK:445566' };
      }
      if (action === 'reactivate' || action === 'getPrices' || action === 'getNumber' || action === 'getNumberV2') {
        throw new Error(`${action} should not be called after automatic free reuse never becomes ready`);
      }
      throw new Error(`Unexpected HeroSMS action: ${action}:${id || ''}`);
    },
    getOAuthFlowStepTimeoutMs: async (defaultTimeoutMs) => defaultTimeoutMs,
    getState: async () => ({ ...currentState }),
    requestStop: async (payload) => {
      stops.push(payload);
    },
    sendToContentScriptResilient: async (_source, message) => {
      messages.push(message);
      throw new Error(`Auth page should not be touched when automatic free reuse is never ready: ${message.type}`);
    },
    setState: async (updates) => {
      currentState = { ...currentState, ...updates };
    },
    sleepWithStop: async () => {},
    throwIfStopped: () => {},
  });

  await assert.rejects(
    helpers.completePhoneVerificationFlow(1, {
      addPhonePage: true,
      phoneVerificationPage: false,
      url: 'https://auth.openai.com/add-phone',
    }),
    /PHONE_AUTO_FREE_REUSE_PREPARE::/
  );

  assert.deepStrictEqual(messages, []);
  assert.equal(stops.length, 1);
  assert.match(stops[0].logMessage, /不购买新 HeroSMS 号码/);
  assert.equal(currentState.freeReusablePhoneActivation.activationId, 'never-ready-free');
  assert.equal(
    requests.some((requestUrl) => ['reactivate', 'getPrices', 'getNumber', 'getNumberV2'].includes(requestUrl.searchParams.get('action'))),
    false
  );
  assert.equal(requests.every((requestUrl) => requestUrl.searchParams.get('id') === 'never-ready-free'), true);
});

test('phone verification helper accepts HeroSMS WAIT_RESEND as free-reuse ready before submit', async () => {
  const requests = [];
  const messages = [];
  let statusPollCount = 0;
  let currentState = {
    heroSmsApiKey: 'demo-key',
    freePhoneReuseEnabled: true,
    freePhoneReuseAutoEnabled: true,
    verificationResendCount: 0,
    currentPhoneActivation: null,
    freeReusablePhoneActivation: {
      activationId: 'not-waiting-free',
      phoneNumber: '66950005555',
      provider: 'hero-sms',
      serviceCode: 'dr',
      countryId: 52,
      countryLabel: 'Thailand',
      successfulUses: 0,
      maxUses: 3,
      source: 'free-manual-reuse',
    },
  };

  const helpers = api.createPhoneVerificationHelpers({
    addLog: async () => {},
    ensureStep8SignupPageReady: async () => {},
    fetchImpl: async (url) => {
      const parsedUrl = new URL(url);
      requests.push(parsedUrl);
      const action = parsedUrl.searchParams.get('action');
      const id = parsedUrl.searchParams.get('id');
      if (action === 'setStatus' && id === 'not-waiting-free') {
        return { ok: true, text: async () => 'ACCESS_RETRY_GET' };
      }
      if (action === 'getStatus' && id === 'not-waiting-free') {
        statusPollCount += 1;
        return {
          ok: true,
          text: async () => (statusPollCount === 1 ? 'STATUS_WAIT_RESEND' : 'STATUS_OK:778899'),
        };
      }
      if (action === 'reactivate' || action === 'getPrices' || action === 'getNumber' || action === 'getNumberV2') {
        throw new Error(`${action} should not be called for accepted saved free reuse waiting state`);
      }
      throw new Error(`Unexpected HeroSMS action: ${action}:${id || ''}`);
    },
    getOAuthFlowStepTimeoutMs: async (defaultTimeoutMs) => defaultTimeoutMs,
    getState: async () => ({ ...currentState }),
    sendToContentScriptResilient: async (_source, message) => {
      messages.push(message);
      if (message.type === 'SUBMIT_PHONE_NUMBER') {
        return { phoneVerificationPage: true, url: 'https://auth.openai.com/phone-verification' };
      }
      if (message.type === 'SUBMIT_PHONE_VERIFICATION_CODE') {
        return { success: true, consentReady: true, url: 'https://auth.openai.com/authorize' };
      }
      throw new Error(`Unexpected content-script message: ${message.type}`);
    },
    setState: async (updates) => {
      currentState = { ...currentState, ...updates };
    },
    sleepWithStop: async () => {},
    throwIfStopped: () => {},
  });

  const result = await helpers.completePhoneVerificationFlow(1, {
    addPhonePage: true,
    phoneVerificationPage: false,
    url: 'https://auth.openai.com/add-phone',
  });

  assert.deepStrictEqual(result, {
    success: true,
    consentReady: true,
    url: 'https://auth.openai.com/authorize',
  });
  assert.deepStrictEqual(
    messages.map((message) => message.type),
    ['SUBMIT_PHONE_NUMBER', 'SUBMIT_PHONE_VERIFICATION_CODE']
  );
  assert.deepStrictEqual(
    requests
      .filter((requestUrl) => requestUrl.searchParams.get('action') === 'setStatus')
      .map((requestUrl) => requestUrl.searchParams.get('status')),
    ['3']
  );
});

test('phone verification helper accepts HeroSMS WAIT_RESEND suffix as free-reuse ready before submit', async () => {
  const requests = [];
  const messages = [];
  let statusPollCount = 0;
  let currentState = {
    heroSmsApiKey: 'demo-key',
    freePhoneReuseEnabled: true,
    freePhoneReuseAutoEnabled: true,
    verificationResendCount: 0,
    currentPhoneActivation: null,
    freeReusablePhoneActivation: {
      activationId: 'resend-info-free',
      phoneNumber: '66950005656',
      provider: 'hero-sms',
      serviceCode: 'dr',
      countryId: 52,
      countryLabel: 'Thailand',
      successfulUses: 0,
      maxUses: 3,
      source: 'free-manual-reuse',
    },
  };

  const helpers = api.createPhoneVerificationHelpers({
    addLog: async () => {},
    ensureStep8SignupPageReady: async () => {},
    fetchImpl: async (url) => {
      const parsedUrl = new URL(url);
      requests.push(parsedUrl);
      const action = parsedUrl.searchParams.get('action');
      const id = parsedUrl.searchParams.get('id');
      if (action === 'setStatus' && id === 'resend-info-free') {
        return { ok: true, text: async () => 'ACCESS_RETRY_GET' };
      }
      if (action === 'getStatus' && id === 'resend-info-free') {
        statusPollCount += 1;
        return {
          ok: true,
          text: async () => (statusPollCount === 1 ? 'STATUS_WAIT_RESEND:100001' : 'STATUS_OK:887766'),
        };
      }
      if (action === 'reactivate' || action === 'getPrices' || action === 'getNumber' || action === 'getNumberV2') {
        throw new Error(`${action} should not be called for accepted saved free reuse resend state`);
      }
      throw new Error(`Unexpected HeroSMS action: ${action}:${id || ''}`);
    },
    getOAuthFlowStepTimeoutMs: async (defaultTimeoutMs) => defaultTimeoutMs,
    getState: async () => ({ ...currentState }),
    sendToContentScriptResilient: async (_source, message) => {
      messages.push(message);
      if (message.type === 'SUBMIT_PHONE_NUMBER') {
        assert.equal(message.payload.phoneNumber, '66950005656');
        return { phoneVerificationPage: true, url: 'https://auth.openai.com/phone-verification' };
      }
      if (message.type === 'SUBMIT_PHONE_VERIFICATION_CODE') {
        assert.equal(message.payload.code, '887766');
        return { success: true, consentReady: true, url: 'https://auth.openai.com/authorize' };
      }
      throw new Error(`Unexpected content-script message: ${message.type}`);
    },
    setState: async (updates) => {
      currentState = { ...currentState, ...updates };
    },
    sleepWithStop: async () => {},
    throwIfStopped: () => {},
  });

  const result = await helpers.completePhoneVerificationFlow(1, {
    addPhonePage: true,
    phoneVerificationPage: false,
    url: 'https://auth.openai.com/add-phone',
  });

  assert.deepStrictEqual(result, {
    success: true,
    consentReady: true,
    url: 'https://auth.openai.com/authorize',
  });
  assert.deepStrictEqual(
    messages.map((message) => message.type),
    ['SUBMIT_PHONE_NUMBER', 'SUBMIT_PHONE_VERIFICATION_CODE']
  );
  assert.deepStrictEqual(
    requests
      .filter((requestUrl) => requestUrl.searchParams.get('action') === 'setStatus')
      .map((requestUrl) => requestUrl.searchParams.get('status')),
    ['3']
  );
});

test('phone verification helper retires automatic free reuse record at max uses', async () => {
  const requests = [];
  let statusPollCount = 0;
  let currentState = {
    heroSmsApiKey: 'demo-key',
    freePhoneReuseEnabled: true,
    freePhoneReuseAutoEnabled: true,
    verificationResendCount: 0,
    currentPhoneActivation: null,
    freeReusablePhoneActivation: {
      activationId: 'free-max',
      phoneNumber: '66950009999',
      provider: 'hero-sms',
      serviceCode: 'dr',
      countryId: 52,
      countryLabel: 'Thailand',
      successfulUses: 2,
      maxUses: 3,
      source: 'free-manual-reuse',
    },
  };

  const helpers = api.createPhoneVerificationHelpers({
    addLog: async () => {},
    ensureStep8SignupPageReady: async () => {},
    fetchImpl: async (url) => {
      const parsedUrl = new URL(url);
      requests.push(parsedUrl);
      const action = parsedUrl.searchParams.get('action');
      const id = parsedUrl.searchParams.get('id');
      if (action === 'setStatus' && id === 'free-max') {
        return { ok: true, text: async () => 'ACCESS_RETRY_GET' };
      }
      if (action === 'getStatus' && id === 'free-max') {
        statusPollCount += 1;
        return { ok: true, text: async () => (statusPollCount === 1 ? 'STATUS_WAIT_CODE' : 'STATUS_OK:778899') };
      }
      throw new Error(`Unexpected HeroSMS action: ${action}:${id || ''}`);
    },
    getOAuthFlowStepTimeoutMs: async (defaultTimeoutMs) => defaultTimeoutMs,
    getState: async () => ({ ...currentState }),
    sendToContentScriptResilient: async (_source, message) => {
      if (message.type === 'SUBMIT_PHONE_NUMBER') {
        return { phoneVerificationPage: true, url: 'https://auth.openai.com/phone-verification' };
      }
      if (message.type === 'SUBMIT_PHONE_VERIFICATION_CODE') {
        return { success: true, consentReady: true, url: 'https://auth.openai.com/authorize' };
      }
      throw new Error(`Unexpected content-script message: ${message.type}`);
    },
    setState: async (updates) => {
      currentState = { ...currentState, ...updates };
    },
    sleepWithStop: async () => {},
    throwIfStopped: () => {},
  });

  await helpers.completePhoneVerificationFlow(1, {
    addPhonePage: true,
    phoneVerificationPage: false,
    url: 'https://auth.openai.com/add-phone',
  });

  assert.equal(currentState.freeReusablePhoneActivation, null);
  assert.deepStrictEqual(
    requests.map((requestUrl) => requestUrl.searchParams.get('action')),
    ['setStatus', 'getStatus', 'getStatus']
  );
  assert.deepStrictEqual(
    requests
      .filter((requestUrl) => requestUrl.searchParams.get('action') === 'setStatus')
      .map((requestUrl) => requestUrl.searchParams.get('status')),
    ['3']
  );
});

test('phone verification helper preserves coded free-reuse activation when code submission errors', async () => {
  const requests = [];
  let currentState = {
    heroSmsApiKey: 'demo-key',
    heroSmsCountryId: 52,
    heroSmsCountryLabel: 'Thailand',
    freePhoneReuseEnabled: true,
    verificationResendCount: 0,
    currentPhoneActivation: null,
    freeReusablePhoneActivation: null,
    reusablePhoneActivation: null,
  };

  const helpers = api.createPhoneVerificationHelpers({
    addLog: async () => {},
    ensureStep8SignupPageReady: async () => {},
    fetchImpl: async (url) => {
      const parsedUrl = new URL(url);
      requests.push(parsedUrl);
      const action = parsedUrl.searchParams.get('action');
      const id = parsedUrl.searchParams.get('id');
      const status = parsedUrl.searchParams.get('status');
      if (action === 'getPrices') {
        return { ok: true, text: async () => buildHeroSmsPricesPayload() };
      }
      if (action === 'getNumber') {
        return { ok: true, text: async () => 'ACCESS_NUMBER:new-free-save:66950006666' };
      }
      if (action === 'getStatus' && id === 'new-free-save') {
        return { ok: true, text: async () => 'STATUS_OK:445566' };
      }
      if (action === 'setStatus' && id === 'new-free-save' && status === '8') {
        throw new Error('free-reuse activation should not be cancelled after SMS code was received');
      }
      if (action === 'setStatus' && id === 'new-free-save' && status === '6') {
        throw new Error('free-reuse activation should not be completed after SMS code was received');
      }
      throw new Error(`Unexpected HeroSMS action: ${action}:${id || ''}:${status || ''}`);
    },
    getOAuthFlowStepTimeoutMs: async (defaultTimeoutMs) => defaultTimeoutMs,
    getState: async () => ({ ...currentState }),
    sendToContentScriptResilient: async (_source, message) => {
      if (message.type === 'SUBMIT_PHONE_NUMBER') {
        return { phoneVerificationPage: true, url: 'https://auth.openai.com/phone-verification' };
      }
      if (message.type === 'SUBMIT_PHONE_VERIFICATION_CODE') {
        throw new Error('simulated auth-page failure after code submit');
      }
      throw new Error(`Unexpected content-script message: ${message.type}`);
    },
    setState: async (updates) => {
      currentState = { ...currentState, ...updates };
    },
    sleepWithStop: async () => {},
    throwIfStopped: () => {},
  });

  await assert.rejects(
    helpers.completePhoneVerificationFlow(1, {
      addPhonePage: true,
      phoneVerificationPage: false,
      url: 'https://auth.openai.com/add-phone',
    }),
    /simulated auth-page failure/
  );

  assert.equal(currentState.freeReusablePhoneActivation.activationId, 'new-free-save');
  assert.equal(currentState.freeReusablePhoneActivation.phoneNumber, '66950006666');
  assert.equal(
    requests.some((requestUrl) => (
      requestUrl.searchParams.get('action') === 'setStatus'
      && requestUrl.searchParams.get('id') === 'new-free-save'
      && ['6', '8'].includes(requestUrl.searchParams.get('status'))
    )),
    false
  );
  assert.deepStrictEqual(
    requests
      .filter((requestUrl) => (
        requestUrl.searchParams.get('action') === 'setStatus'
        && requestUrl.searchParams.get('id') === 'new-free-save'
      ))
      .map((requestUrl) => requestUrl.searchParams.get('status')),
    []
  );
});

test('phone verification helper preserves newly saved free-reuse activation after OAuth success without source marker', async () => {
  const requests = [];
  let currentState = {
    heroSmsApiKey: 'demo-key',
    heroSmsCountryId: 52,
    heroSmsCountryLabel: 'Thailand',
    freePhoneReuseEnabled: true,
    verificationResendCount: 0,
    currentPhoneActivation: null,
    freeReusablePhoneActivation: null,
    reusablePhoneActivation: null,
  };

  const helpers = api.createPhoneVerificationHelpers({
    addLog: async () => {},
    ensureStep8SignupPageReady: async () => {},
    fetchImpl: async (url) => {
      const parsedUrl = new URL(url);
      requests.push(parsedUrl);
      const action = parsedUrl.searchParams.get('action');
      const id = parsedUrl.searchParams.get('id');
      const status = parsedUrl.searchParams.get('status');
      if (action === 'getPrices') {
        return { ok: true, text: async () => buildHeroSmsPricesPayload() };
      }
      if (action === 'getNumber') {
        return { ok: true, text: async () => 'ACCESS_NUMBER:new-free-success:66950007777' };
      }
      if (action === 'getStatus' && id === 'new-free-success') {
        return { ok: true, text: async () => 'STATUS_OK:778899' };
      }
      if (action === 'setStatus' && id === 'new-free-success' && ['6', '8'].includes(status)) {
        throw new Error(`free-reuse activation should not receive terminal setStatus(${status}) after OAuth success`);
      }
      throw new Error(`Unexpected HeroSMS action: ${action}:${id || ''}:${status || ''}`);
    },
    getOAuthFlowStepTimeoutMs: async (defaultTimeoutMs) => defaultTimeoutMs,
    getState: async () => ({ ...currentState }),
    sendToContentScriptResilient: async (_source, message) => {
      if (message.type === 'SUBMIT_PHONE_NUMBER') {
        return { phoneVerificationPage: true, url: 'https://auth.openai.com/phone-verification' };
      }
      if (message.type === 'SUBMIT_PHONE_VERIFICATION_CODE') {
        return { success: true, consentReady: true, url: 'https://auth.openai.com/authorize' };
      }
      throw new Error(`Unexpected content-script message: ${message.type}`);
    },
    setState: async (updates) => {
      currentState = { ...currentState, ...updates };
    },
    sleepWithStop: async () => {},
    throwIfStopped: () => {},
  });

  const result = await helpers.completePhoneVerificationFlow(1, {
    addPhonePage: true,
    phoneVerificationPage: false,
    url: 'https://auth.openai.com/add-phone',
  });

  assert.deepStrictEqual(result, {
    success: true,
    consentReady: true,
    url: 'https://auth.openai.com/authorize',
  });
  assert.equal(currentState.freeReusablePhoneActivation.activationId, 'new-free-success');
  assert.equal(currentState.freeReusablePhoneActivation.phoneNumber, '66950007777');
  assert.equal(currentState.freeReusablePhoneActivation.source, 'free-manual-reuse');
  assert.equal(currentState.freeReusablePhoneActivation.successfulUses, 1);
  assert.equal(currentState.freeReusablePhoneActivation.maxUses, 3);
  assert.equal(
    requests.some((requestUrl) => (
      requestUrl.searchParams.get('action') === 'setStatus'
      && requestUrl.searchParams.get('id') === 'new-free-success'
      && ['6', '8'].includes(requestUrl.searchParams.get('status'))
    )),
    false
  );
});

test('phone verification helper replaces number immediately when resend is throttled and does not spam resend clicks', async () => {
  const requests = [];
  const messages = [];
  let resendCalls = 0;
  let currentState = {
    heroSmsApiKey: 'demo-key',
    heroSmsCountryId: 52,
    heroSmsCountryLabel: 'Thailand',
    verificationResendCount: 0,
    phoneVerificationReplacementLimit: 2,
    phoneCodeWaitSeconds: 60,
    phoneCodeTimeoutWindows: 3,
    phoneCodePollIntervalSeconds: 1,
    phoneCodePollMaxRounds: 1,
    currentPhoneActivation: null,
    reusablePhoneActivation: null,
  };

  const numbers = [
    { activationId: '900001', phoneNumber: '66951110001' },
    { activationId: '900002', phoneNumber: '66951110002' },
  ];
  let numberIndex = 0;

  const helpers = api.createPhoneVerificationHelpers({
    addLog: async () => {},
    ensureStep8SignupPageReady: async () => {},
    fetchImpl: async (url) => {
      const parsedUrl = new URL(url);
      requests.push(parsedUrl);
      const action = parsedUrl.searchParams.get('action');
      const id = parsedUrl.searchParams.get('id');
      if (action === 'getPrices') {
        return { ok: true, text: async () => buildHeroSmsPricesPayload() };
      }
      if (action === 'getNumber') {
        const nextNumber = numbers[numberIndex];
        numberIndex += 1;
        return { ok: true, text: async () => `ACCESS_NUMBER:${nextNumber.activationId}:${nextNumber.phoneNumber}` };
      }
      if (action === 'getStatus') {
        if (id === '900001') {
          return { ok: true, text: async () => 'STATUS_WAIT_CODE' };
        }
        return { ok: true, text: async () => 'STATUS_OK:654321' };
      }
      if (action === 'setStatus') {
        return { ok: true, text: async () => `STATUS_UPDATED:${id}` };
      }
      throw new Error(`Unexpected HeroSMS action: ${action}`);
    },
    getOAuthFlowStepTimeoutMs: async (defaultTimeoutMs) => defaultTimeoutMs,
    getState: async () => ({ ...currentState }),
    sendToContentScriptResilient: async (_source, message) => {
      messages.push(message.type);
      if (message.type === 'SUBMIT_PHONE_NUMBER') {
        return {
          phoneVerificationPage: true,
          url: 'https://auth.openai.com/phone-verification',
        };
      }
      if (message.type === 'RESEND_PHONE_VERIFICATION_CODE') {
        resendCalls += 1;
        throw new Error('PHONE_RESEND_THROTTLED::Tried to resend too many times. Please try again later.');
      }
      if (message.type === 'RETURN_TO_ADD_PHONE') {
        return {
          addPhonePage: true,
          url: 'https://auth.openai.com/add-phone',
        };
      }
      if (message.type === 'SUBMIT_PHONE_VERIFICATION_CODE') {
        return {
          success: true,
          consentReady: true,
          url: 'https://auth.openai.com/authorize',
        };
      }
      throw new Error(`Unexpected content-script message: ${message.type}`);
    },
    setState: async (updates) => {
      currentState = { ...currentState, ...updates };
    },
    sleepWithStop: async () => {},
    throwIfStopped: () => {},
  });

  const result = await helpers.completePhoneVerificationFlow(1, {
    addPhonePage: true,
    phoneVerificationPage: false,
    url: 'https://auth.openai.com/add-phone',
  });

  assert.deepStrictEqual(result, {
    success: true,
    consentReady: true,
    url: 'https://auth.openai.com/authorize',
  });
  assert.equal(resendCalls, 1, 'resend should be attempted once for the number before replacement');
  assert.equal(messages.filter((type) => type === 'SUBMIT_PHONE_NUMBER').length, 2);
  assert.equal(messages.includes('RETURN_TO_ADD_PHONE'), true);
});

test('phone verification helper replaces number immediately when phone-verification route is stuck on 405 retry page', async () => {
  const requests = [];
  const messages = [];
  let resendCalls = 0;
  let currentState = {
    heroSmsApiKey: 'demo-key',
    heroSmsCountryId: 52,
    heroSmsCountryLabel: 'Thailand',
    verificationResendCount: 0,
    phoneVerificationReplacementLimit: 2,
    phoneCodeWaitSeconds: 60,
    phoneCodeTimeoutWindows: 2,
    phoneCodePollIntervalSeconds: 1,
    phoneCodePollMaxRounds: 1,
    currentPhoneActivation: null,
    reusablePhoneActivation: null,
  };

  const numbers = [
    { activationId: '910001', phoneNumber: '66952220001' },
    { activationId: '910002', phoneNumber: '66952220002' },
  ];
  let numberIndex = 0;

  const helpers = api.createPhoneVerificationHelpers({
    addLog: async () => {},
    ensureStep8SignupPageReady: async () => {},
    fetchImpl: async (url) => {
      const parsedUrl = new URL(url);
      requests.push(parsedUrl);
      const action = parsedUrl.searchParams.get('action');
      const id = parsedUrl.searchParams.get('id');
      if (action === 'getPrices') {
        return { ok: true, text: async () => buildHeroSmsPricesPayload() };
      }
      if (action === 'getNumber') {
        const nextNumber = numbers[numberIndex];
        numberIndex += 1;
        return { ok: true, text: async () => `ACCESS_NUMBER:${nextNumber.activationId}:${nextNumber.phoneNumber}` };
      }
      if (action === 'getStatus') {
        if (id === '910001') {
          return { ok: true, text: async () => 'STATUS_WAIT_CODE' };
        }
        return { ok: true, text: async () => 'STATUS_OK:654321' };
      }
      if (action === 'setStatus') {
        return { ok: true, text: async () => `STATUS_UPDATED:${id}` };
      }
      throw new Error(`Unexpected HeroSMS action: ${action}`);
    },
    getOAuthFlowStepTimeoutMs: async (defaultTimeoutMs) => defaultTimeoutMs,
    getState: async () => ({ ...currentState }),
    sendToContentScriptResilient: async (_source, message) => {
      messages.push(message.type);
      if (message.type === 'SUBMIT_PHONE_NUMBER') {
        return {
          phoneVerificationPage: true,
          url: 'https://auth.openai.com/phone-verification',
        };
      }
      if (message.type === 'RESEND_PHONE_VERIFICATION_CODE') {
        resendCalls += 1;
        throw new Error('PHONE_ROUTE_405_RECOVERY_FAILED::Phone verification route stayed on 405 after 3 retry click(s). URL: https://auth.openai.com/phone-verification');
      }
      if (message.type === 'RETURN_TO_ADD_PHONE') {
        return {
          addPhonePage: true,
          url: 'https://auth.openai.com/add-phone',
        };
      }
      if (message.type === 'SUBMIT_PHONE_VERIFICATION_CODE') {
        return {
          success: true,
          consentReady: true,
          url: 'https://auth.openai.com/authorize',
        };
      }
      throw new Error(`Unexpected content-script message: ${message.type}`);
    },
    setState: async (updates) => {
      currentState = { ...currentState, ...updates };
    },
    sleepWithStop: async () => {},
    throwIfStopped: () => {},
  });

  const result = await helpers.completePhoneVerificationFlow(1, {
    addPhonePage: true,
    phoneVerificationPage: false,
    url: 'https://auth.openai.com/add-phone',
  });

  assert.deepStrictEqual(result, {
    success: true,
    consentReady: true,
    url: 'https://auth.openai.com/authorize',
  });
  assert.equal(resendCalls, 1, 'resend should not loop endlessly on 405 route error');
  assert.equal(messages.filter((type) => type === 'SUBMIT_PHONE_NUMBER').length, 2);
  assert.equal(messages.includes('RETURN_TO_ADD_PHONE'), true);
});

test('phone verification helper directly navigates back to add-phone when replace-number recovery loses the auth page', async () => {
  const requests = [];
  const messages = [];
  const navigationCalls = [];
  const submittedNumbers = [];
  const statusCallsById = {};
  let addPhoneRouteReady = false;
  let currentState = {
    heroSmsApiKey: 'demo-key',
    heroSmsCountryId: 52,
    heroSmsCountryLabel: 'Thailand',
    verificationResendCount: 0,
    phoneVerificationReplacementLimit: 2,
    phoneCodeWaitSeconds: 60,
    phoneCodeTimeoutWindows: 2,
    phoneCodePollIntervalSeconds: 1,
    phoneCodePollMaxRounds: 1,
    currentPhoneActivation: null,
    reusablePhoneActivation: null,
  };
  const numbers = [
    { activationId: '930001', phoneNumber: '66953330001' },
    { activationId: '930002', phoneNumber: '66953330002' },
  ];
  let numberIndex = 0;
  const realDateNow = Date.now;
  let fakeNow = 0;
  Date.now = () => fakeNow;

  try {
    const helpers = api.createPhoneVerificationHelpers({
      addLog: async () => {},
      ensureStep8SignupPageReady: async () => {},
      fetchImpl: async (url) => {
        const parsedUrl = new URL(url);
        requests.push(parsedUrl);
        const action = parsedUrl.searchParams.get('action');
        const id = parsedUrl.searchParams.get('id');

        if (action === 'getPrices') {
          return {
            ok: true,
            text: async () => buildHeroSmsPricesPayload(),
          };
        }

        if (action === 'getNumber') {
          const nextNumber = numbers[numberIndex];
          numberIndex += 1;
          return {
            ok: true,
            text: async () => `ACCESS_NUMBER:${nextNumber.activationId}:${nextNumber.phoneNumber}`,
          };
        }

        if (action === 'getStatus') {
          statusCallsById[id] = (statusCallsById[id] || 0) + 1;
          return {
            ok: true,
            text: async () => (id === '930001' ? 'STATUS_WAIT_CODE' : 'STATUS_OK:654321'),
          };
        }

        if (action === 'setStatus') {
          return {
            ok: true,
            text: async () => `STATUS_UPDATED:${id}`,
          };
        }

        throw new Error(`Unexpected HeroSMS action: ${action}`);
      },
      getOAuthFlowStepTimeoutMs: async (defaultTimeoutMs) => defaultTimeoutMs,
      getState: async () => ({ ...currentState }),
      navigateAuthTabToAddPhone: async (tabId) => {
        navigationCalls.push(tabId);
        addPhoneRouteReady = true;
        return {
          addPhonePage: true,
          phoneVerificationPage: false,
          url: 'https://auth.openai.com/add-phone',
        };
      },
      sendToContentScriptResilient: async (_source, message) => {
        messages.push(message.type);
        if (message.type === 'SUBMIT_PHONE_NUMBER') {
          submittedNumbers.push(message.payload.phoneNumber);
          if (submittedNumbers.length === 1) {
            return {
              phoneVerificationPage: true,
              url: 'https://auth.openai.com/phone-verification',
            };
          }
          if (!addPhoneRouteReady) {
            throw new Error('Could not establish connection. Receiving end does not exist.');
          }
          return {
            phoneVerificationPage: true,
            url: 'https://auth.openai.com/phone-verification',
          };
        }
        if (message.type === 'RESEND_PHONE_VERIFICATION_CODE') {
          addPhoneRouteReady = false;
          throw new Error('Could not establish connection. Receiving end does not exist.');
        }
        if (message.type === 'RETURN_TO_ADD_PHONE') {
          addPhoneRouteReady = false;
          throw new Error('Could not establish connection. Receiving end does not exist.');
        }
        if (message.type === 'STEP8_GET_STATE') {
          if (!addPhoneRouteReady) {
            throw new Error('Frame with ID 0 is showing error page.');
          }
          return {
            addPhonePage: true,
            phoneVerificationPage: false,
            url: 'https://auth.openai.com/add-phone',
          };
        }
        if (message.type === 'SUBMIT_PHONE_VERIFICATION_CODE') {
          return {
            success: true,
            consentReady: true,
            url: 'https://auth.openai.com/authorize',
          };
        }
        throw new Error(`Unexpected content-script message: ${message.type}`);
      },
      setState: async (updates) => {
        currentState = { ...currentState, ...updates };
      },
      sleepWithStop: async () => {
        fakeNow += 61000;
      },
      throwIfStopped: () => {},
    });

    const result = await helpers.completePhoneVerificationFlow(1, {
      addPhonePage: true,
      phoneVerificationPage: false,
      url: 'https://auth.openai.com/add-phone',
    });

    assert.deepStrictEqual(result, {
      success: true,
      consentReady: true,
      url: 'https://auth.openai.com/authorize',
    });
    assert.deepStrictEqual(submittedNumbers, ['66953330001', '66953330002']);
    assert.deepStrictEqual(navigationCalls, [1]);
    assert.ok(statusCallsById['930001'] >= 2, 'first number should be polled across both timeout windows');
    assert.equal(messages.includes('RETURN_TO_ADD_PHONE'), true);
  } finally {
    Date.now = realDateNow;
  }
});

test('phone verification helper stops when add-phone recovery cannot be verified after number replacement', async () => {
  const messages = [];
  const submittedNumbers = [];
  let currentState = {
    heroSmsApiKey: 'demo-key',
    heroSmsCountryId: 52,
    heroSmsCountryLabel: 'Thailand',
    verificationResendCount: 0,
    phoneVerificationReplacementLimit: 2,
    phoneCodeWaitSeconds: 60,
    phoneCodeTimeoutWindows: 2,
    phoneCodePollIntervalSeconds: 1,
    phoneCodePollMaxRounds: 1,
    currentPhoneActivation: null,
    reusablePhoneActivation: null,
  };
  const numbers = [
    { activationId: '940001', phoneNumber: '66954440001' },
    { activationId: '940002', phoneNumber: '66954440002' },
  ];
  let numberIndex = 0;
  const realDateNow = Date.now;
  let fakeNow = 0;
  Date.now = () => fakeNow;

  try {
    const helpers = api.createPhoneVerificationHelpers({
      addLog: async () => {},
      ensureStep8SignupPageReady: async () => {},
      fetchImpl: async (url) => {
        const parsedUrl = new URL(url);
        const action = parsedUrl.searchParams.get('action');
        const id = parsedUrl.searchParams.get('id');

        if (action === 'getPrices') {
          return {
            ok: true,
            text: async () => buildHeroSmsPricesPayload(),
          };
        }

        if (action === 'getNumber') {
          const nextNumber = numbers[numberIndex];
          numberIndex += 1;
          return {
            ok: true,
            text: async () => `ACCESS_NUMBER:${nextNumber.activationId}:${nextNumber.phoneNumber}`,
          };
        }

        if (action === 'getStatus') {
          return {
            ok: true,
            text: async () => (id === '940001' ? 'STATUS_WAIT_CODE' : 'STATUS_OK:654321'),
          };
        }

        if (action === 'setStatus') {
          return {
            ok: true,
            text: async () => `STATUS_UPDATED:${id}`,
          };
        }

        throw new Error(`Unexpected HeroSMS action: ${action}`);
      },
      getOAuthFlowStepTimeoutMs: async (defaultTimeoutMs) => defaultTimeoutMs,
      getState: async () => ({ ...currentState }),
      navigateAuthTabToAddPhone: async () => {
        throw new Error('direct navigation failed');
      },
      sendToContentScriptResilient: async (_source, message) => {
        messages.push(message.type);
        if (message.type === 'SUBMIT_PHONE_NUMBER') {
          submittedNumbers.push(message.payload.phoneNumber);
          if (submittedNumbers.length === 1) {
            return {
              phoneVerificationPage: true,
              url: 'https://auth.openai.com/phone-verification',
            };
          }
          throw new Error('Could not establish connection. Receiving end does not exist.');
        }
        if (message.type === 'RESEND_PHONE_VERIFICATION_CODE') {
          throw new Error('Could not establish connection. Receiving end does not exist.');
        }
        if (message.type === 'RETURN_TO_ADD_PHONE') {
          throw new Error('Could not establish connection. Receiving end does not exist.');
        }
        if (message.type === 'STEP8_GET_STATE') {
          throw new Error('Frame with ID 0 is showing error page.');
        }
        if (message.type === 'SUBMIT_PHONE_VERIFICATION_CODE') {
          return {
            success: true,
            consentReady: true,
            url: 'https://auth.openai.com/authorize',
          };
        }
        throw new Error(`Unexpected content-script message: ${message.type}`);
      },
      setState: async (updates) => {
        currentState = { ...currentState, ...updates };
      },
      sleepWithStop: async () => {
        fakeNow += 61000;
      },
      throwIfStopped: () => {},
    });

    await assert.rejects(
      helpers.completePhoneVerificationFlow(1, {
        addPhonePage: true,
        phoneVerificationPage: false,
        url: 'https://auth.openai.com/add-phone',
      }),
      /direct navigation failed/
    );
    assert.deepStrictEqual(submittedNumbers, ['66954440001']);
    assert.equal(messages.includes('RETURN_TO_ADD_PHONE'), true);
  } finally {
    Date.now = realDateNow;
  }
});

test('phone verification helper skips page resend for 5sim timeouts and rotates number directly', async () => {
  const requests = [];
  const messages = [];
  let currentState = {
    phoneSmsProvider: '5sim',
    fiveSimApiKey: 'five-token',
    fiveSimCountryOrder: ['indonesia'],
    fiveSimOperator: 'any',
    fiveSimProduct: 'openai',
    verificationResendCount: 0,
    phoneVerificationReplacementLimit: 2,
    phoneCodeWaitSeconds: 60,
    phoneCodeTimeoutWindows: 2,
    phoneCodePollIntervalSeconds: 1,
    phoneCodePollMaxRounds: 1,
    currentPhoneActivation: null,
    reusablePhoneActivation: null,
  };

  const numbers = [
    { activationId: '500001', phoneNumber: '+628111111111' },
    { activationId: '500002', phoneNumber: '+628222222222' },
  ];
  let numberIndex = 0;

  const helpers = api.createPhoneVerificationHelpers({
    addLog: async () => {},
    ensureStep8SignupPageReady: async () => {},
    fetchImpl: async (url) => {
      const parsedUrl = new URL(url);
      requests.push(parsedUrl.pathname);
      if (parsedUrl.pathname === '/v1/user/buy/activation/indonesia/any/openai') {
        const next = numbers[Math.min(numberIndex, numbers.length - 1)];
        numberIndex += 1;
        return {
          ok: true,
          status: 200,
          text: async () => JSON.stringify({
            id: next.activationId,
            phone: next.phoneNumber,
            country: 'indonesia',
            country_name: 'Indonesia',
            product: 'openai',
          }),
        };
      }
      if (parsedUrl.pathname === '/v1/user/check/500001') {
        return {
          ok: true,
          status: 200,
          text: async () => JSON.stringify({
            status: 'RECEIVED',
            sms: [],
          }),
        };
      }
      if (parsedUrl.pathname === '/v1/user/check/500002') {
        return {
          ok: true,
          status: 200,
          text: async () => JSON.stringify({
            status: 'RECEIVED',
            sms: [{ text: 'OpenAI code 123456' }],
          }),
        };
      }
      if (parsedUrl.pathname === '/v1/user/cancel/500001') {
        return {
          ok: true,
          status: 200,
          text: async () => JSON.stringify({ status: 'CANCELED' }),
        };
      }
      if (parsedUrl.pathname === '/v1/user/finish/500002') {
        return {
          ok: true,
          status: 200,
          text: async () => JSON.stringify({ status: 'FINISHED' }),
        };
      }
      throw new Error(`Unexpected 5sim request: ${parsedUrl.pathname}`);
    },
    getOAuthFlowStepTimeoutMs: async (defaultTimeoutMs) => defaultTimeoutMs,
    getState: async () => ({ ...currentState }),
    sendToContentScriptResilient: async (_source, message) => {
      messages.push(message.type);
      if (message.type === 'SUBMIT_PHONE_NUMBER') {
        return {
          phoneVerificationPage: true,
          url: 'https://auth.openai.com/phone-verification',
        };
      }
      if (message.type === 'RETURN_TO_ADD_PHONE') {
        return {
          addPhonePage: true,
          phoneVerificationPage: false,
          url: 'https://auth.openai.com/add-phone',
        };
      }
      if (message.type === 'SUBMIT_PHONE_VERIFICATION_CODE') {
        return {
          success: true,
          consentReady: true,
          url: 'https://auth.openai.com/authorize',
        };
      }
      if (message.type === 'RESEND_PHONE_VERIFICATION_CODE') {
        throw new Error('5sim flow should not trigger page resend.');
      }
      throw new Error(`Unexpected content-script message: ${message.type}`);
    },
    setState: async (updates) => {
      currentState = { ...currentState, ...updates };
    },
    sleepWithStop: async () => {},
    throwIfStopped: () => {},
  });

  const result = await helpers.completePhoneVerificationFlow(1, {
    addPhonePage: true,
    phoneVerificationPage: false,
    url: 'https://auth.openai.com/add-phone',
  });

  assert.deepStrictEqual(result, {
    success: true,
    consentReady: true,
    url: 'https://auth.openai.com/authorize',
  });
  assert.equal(messages.includes('RESEND_PHONE_VERIFICATION_CODE'), false);
  assert.equal(messages.filter((type) => type === 'SUBMIT_PHONE_NUMBER').length, 2);
  assert.equal(
    requests.filter((pathname) => pathname === '/v1/user/check/500001').length,
    2,
    'first 5sim number should be polled across both timeout windows before replacement'
  );
});

test('phone verification helper rotates number when resend action is WhatsApp in SMS provider mode', async () => {
  const requests = [];
  const messages = [];
  const submittedNumbers = [];
  const statusCallsById = {};
  const heroSmsResendStatusCalls = [];
  let currentState = {
    heroSmsApiKey: 'demo-key',
    heroSmsCountryId: 52,
    heroSmsCountryLabel: 'Thailand',
    verificationResendCount: 1,
    phoneVerificationReplacementLimit: 2,
    phoneCodeWaitSeconds: 60,
    phoneCodeTimeoutWindows: 2,
    phoneCodePollIntervalSeconds: 1,
    phoneCodePollMaxRounds: 1,
    currentPhoneActivation: null,
    reusablePhoneActivation: null,
  };
  const numbers = [
    { activationId: '520001', phoneNumber: '66952220001' },
    { activationId: '520002', phoneNumber: '66952220002' },
  ];
  let numberIndex = 0;
  const realDateNow = Date.now;
  let fakeNow = 0;
  Date.now = () => fakeNow;

  try {
    const helpers = api.createPhoneVerificationHelpers({
      addLog: async () => {},
      ensureStep8SignupPageReady: async () => {},
      fetchImpl: async (url) => {
        const parsedUrl = new URL(url);
        requests.push(parsedUrl);
        const action = parsedUrl.searchParams.get('action');
        const id = parsedUrl.searchParams.get('id');
        const status = parsedUrl.searchParams.get('status');

        if (action === 'getPrices') {
          return {
            ok: true,
            text: async () => buildHeroSmsPricesPayload(),
          };
        }
        if (action === 'getNumber') {
          const nextNumber = numbers[numberIndex];
          numberIndex += 1;
          return {
            ok: true,
            text: async () => `ACCESS_NUMBER:${nextNumber.activationId}:${nextNumber.phoneNumber}`,
          };
        }
        if (action === 'getStatus') {
          statusCallsById[id] = (statusCallsById[id] || 0) + 1;
          return {
            ok: true,
            text: async () => (id === '520001' ? 'STATUS_WAIT_CODE' : 'STATUS_OK:123456'),
          };
        }
        if (action === 'setStatus') {
          if (id === '520001' && status === '3') {
            heroSmsResendStatusCalls.push(parsedUrl);
          }
          return {
            ok: true,
            text: async () => `STATUS_UPDATED:${id}`,
          };
        }
        throw new Error(`Unexpected HeroSMS action: ${action}`);
      },
      getOAuthFlowStepTimeoutMs: async (defaultTimeoutMs) => defaultTimeoutMs,
      getState: async () => ({ ...currentState }),
      sendToContentScriptResilient: async (_source, message) => {
        messages.push(message.type);
        if (message.type === 'SUBMIT_PHONE_NUMBER') {
          submittedNumbers.push(message.payload.phoneNumber);
          return {
            phoneVerificationPage: true,
            url: 'https://auth.openai.com/phone-verification',
          };
        }
        if (message.type === 'RESEND_PHONE_VERIFICATION_CODE') {
          return {
            resent: false,
            channel: 'whatsapp',
            channelText: '重新发送 WhatsApp 消息',
            text: '重新发送 WhatsApp 消息',
            url: 'https://auth.openai.com/phone-verification',
          };
        }
        if (message.type === 'RETURN_TO_ADD_PHONE') {
          return {
            addPhonePage: true,
            phoneVerificationPage: false,
            url: 'https://auth.openai.com/add-phone',
          };
        }
        if (message.type === 'STEP8_GET_STATE') {
          return {
            addPhonePage: true,
            phoneVerificationPage: false,
            url: 'https://auth.openai.com/add-phone',
          };
        }
        if (message.type === 'SUBMIT_PHONE_VERIFICATION_CODE') {
          return {
            success: true,
            consentReady: true,
            url: 'https://auth.openai.com/authorize',
          };
        }
        throw new Error(`Unexpected content-script message: ${message.type}`);
      },
      setState: async (updates) => {
        currentState = { ...currentState, ...updates };
      },
      sleepWithStop: async () => {
        fakeNow += 61000;
      },
      throwIfStopped: () => {},
    });

    const result = await helpers.completePhoneVerificationFlow(1, {
      addPhonePage: true,
      phoneVerificationPage: false,
      url: 'https://auth.openai.com/add-phone',
    });

    assert.deepStrictEqual(result, {
      success: true,
      consentReady: true,
      url: 'https://auth.openai.com/authorize',
    });
    assert.deepStrictEqual(submittedNumbers, ['66952220001', '66952220002']);
    assert.equal(heroSmsResendStatusCalls.length, 0, 'WhatsApp resend must not call HeroSMS setStatus(3)');
    assert.equal(statusCallsById['520001'], 1, 'WhatsApp resend should replace after the first SMS wait window');
    assert.equal(messages.includes('RESEND_PHONE_VERIFICATION_CODE'), true);
  } finally {
    Date.now = realDateNow;
  }
});

test('phone verification helper rotates number immediately when 5sim activation is missing (order not found)', async () => {
  const requests = [];
  let currentState = {
    phoneSmsProvider: '5sim',
    fiveSimApiKey: 'five-token',
    fiveSimCountryOrder: ['indonesia'],
    fiveSimOperator: 'any',
    fiveSimProduct: 'openai',
    verificationResendCount: 0,
    phoneVerificationReplacementLimit: 2,
    phoneCodeWaitSeconds: 60,
    phoneCodeTimeoutWindows: 2,
    phoneCodePollIntervalSeconds: 1,
    phoneCodePollMaxRounds: 2,
    currentPhoneActivation: null,
    reusablePhoneActivation: null,
  };

  const numbers = [
    { activationId: '510001', phoneNumber: '+628111111111' },
    { activationId: '510002', phoneNumber: '+628222222222' },
  ];
  let numberIndex = 0;

  const helpers = api.createPhoneVerificationHelpers({
    addLog: async () => {},
    ensureStep8SignupPageReady: async () => {},
    fetchImpl: async (url) => {
      const parsedUrl = new URL(url);
      requests.push(parsedUrl.pathname);
      if (parsedUrl.pathname === '/v1/user/buy/activation/indonesia/any/openai') {
        const next = numbers[Math.min(numberIndex, numbers.length - 1)];
        numberIndex += 1;
        return {
          ok: true,
          status: 200,
          text: async () => JSON.stringify({
            id: next.activationId,
            phone: next.phoneNumber,
            country: 'indonesia',
            country_name: 'Indonesia',
            product: 'openai',
          }),
        };
      }
      if (parsedUrl.pathname === '/v1/user/check/510001') {
        return {
          ok: false,
          status: 404,
          text: async () => JSON.stringify({
            status: 'error',
            message: 'order not found',
          }),
        };
      }
      if (parsedUrl.pathname === '/v1/user/check/510002') {
        return {
          ok: true,
          status: 200,
          text: async () => JSON.stringify({
            status: 'RECEIVED',
            sms: [{ text: 'OpenAI code 123456' }],
          }),
        };
      }
      if (parsedUrl.pathname === '/v1/user/cancel/510001') {
        return {
          ok: true,
          status: 200,
          text: async () => JSON.stringify({ status: 'CANCELED' }),
        };
      }
      if (parsedUrl.pathname === '/v1/user/finish/510002') {
        return {
          ok: true,
          status: 200,
          text: async () => JSON.stringify({ status: 'FINISHED' }),
        };
      }
      throw new Error(`Unexpected 5sim request: ${parsedUrl.pathname}`);
    },
    getOAuthFlowStepTimeoutMs: async (defaultTimeoutMs) => defaultTimeoutMs,
    getState: async () => ({ ...currentState }),
    sendToContentScriptResilient: async (_source, message) => {
      if (message.type === 'SUBMIT_PHONE_NUMBER') {
        return {
          phoneVerificationPage: true,
          url: 'https://auth.openai.com/phone-verification',
        };
      }
      if (message.type === 'RETURN_TO_ADD_PHONE') {
        return {
          addPhonePage: true,
          phoneVerificationPage: false,
          url: 'https://auth.openai.com/add-phone',
        };
      }
      if (message.type === 'SUBMIT_PHONE_VERIFICATION_CODE') {
        return {
          success: true,
          consentReady: true,
          url: 'https://auth.openai.com/authorize',
        };
      }
      if (message.type === 'RESEND_PHONE_VERIFICATION_CODE') {
        throw new Error('order-not-found path should replace number before page resend.');
      }
      throw new Error(`Unexpected content-script message: ${message.type}`);
    },
    setState: async (updates) => {
      currentState = { ...currentState, ...updates };
    },
    sleepWithStop: async () => {},
    throwIfStopped: () => {},
  });

  const result = await helpers.completePhoneVerificationFlow(1, {
    addPhonePage: true,
    phoneVerificationPage: false,
    url: 'https://auth.openai.com/add-phone',
  });

  assert.deepStrictEqual(result, {
    success: true,
    consentReady: true,
    url: 'https://auth.openai.com/authorize',
  });
  assert.ok(requests.includes('/v1/user/check/510001'));
  assert.ok(requests.includes('/v1/user/check/510002'));
  assert.equal(
    requests.filter((pathname) => pathname === '/v1/user/check/510001').length,
    1,
    'missing activation should trigger immediate number replacement instead of repeated polling'
  );
});

test('phone verification helper propagates stop errors instead of swallowing resend failures', async () => {
  const messages = [];
  let currentState = {
    heroSmsApiKey: 'demo-key',
    heroSmsCountryId: 52,
    heroSmsCountryLabel: 'Thailand',
    verificationResendCount: 0,
    phoneVerificationReplacementLimit: 3,
    phoneCodeWaitSeconds: 60,
    phoneCodeTimeoutWindows: 2,
    phoneCodePollIntervalSeconds: 1,
    phoneCodePollMaxRounds: 1,
    currentPhoneActivation: null,
    reusablePhoneActivation: null,
  };

  const helpers = api.createPhoneVerificationHelpers({
    addLog: async () => {},
    ensureStep8SignupPageReady: async () => {},
    fetchImpl: async (url) => {
      const parsedUrl = new URL(url);
      const action = parsedUrl.searchParams.get('action');
      if (action === 'getPrices') {
        return { ok: true, text: async () => buildHeroSmsPricesPayload() };
      }
      if (action === 'getNumber') {
        return { ok: true, text: async () => 'ACCESS_NUMBER:700001:66955550001' };
      }
      if (action === 'getStatus') {
        return { ok: true, text: async () => 'STATUS_WAIT_CODE' };
      }
      if (action === 'setStatus') {
        return { ok: true, text: async () => 'STATUS_UPDATED' };
      }
      throw new Error(`Unexpected HeroSMS action: ${action}`);
    },
    getOAuthFlowStepTimeoutMs: async (defaultTimeoutMs) => defaultTimeoutMs,
    getState: async () => ({ ...currentState }),
    sendToContentScriptResilient: async (_source, message) => {
      messages.push(message.type);
      if (message.type === 'SUBMIT_PHONE_NUMBER') {
        return {
          phoneVerificationPage: true,
          url: 'https://auth.openai.com/phone-verification',
        };
      }
      if (message.type === 'RESEND_PHONE_VERIFICATION_CODE') {
        throw new Error('流程已被用户停止。');
      }
      throw new Error(`Unexpected content-script message: ${message.type}`);
    },
    setState: async (updates) => {
      currentState = { ...currentState, ...updates };
    },
    sleepWithStop: async () => {},
    throwIfStopped: () => {},
  });

  await assert.rejects(
    helpers.completePhoneVerificationFlow(1, {
      addPhonePage: true,
      phoneVerificationPage: false,
      url: 'https://auth.openai.com/add-phone',
    }),
    /流程已被用户停止/
  );

  assert.equal(messages.filter((type) => type === 'SUBMIT_PHONE_NUMBER').length, 1);
  assert.equal(messages.filter((type) => type === 'RESEND_PHONE_VERIFICATION_CODE').length, 1);
  assert.equal(messages.includes('RETURN_TO_ADD_PHONE'), false);
});

test('phone verification helper falls back to the next country after repeated sms timeout on the same country', async () => {
  const requests = [];
  let currentState = {
    heroSmsApiKey: 'demo-key',
    heroSmsCountryId: 52,
    heroSmsCountryLabel: 'Thailand',
    heroSmsCountryFallback: [{ id: 16, label: 'United Kingdom' }],
    verificationResendCount: 0,
    phoneVerificationReplacementLimit: 3,
    phoneCodeWaitSeconds: 60,
    phoneCodeTimeoutWindows: 1,
    phoneCodePollIntervalSeconds: 1,
    phoneCodePollMaxRounds: 1,
    currentPhoneActivation: null,
    reusablePhoneActivation: null,
  };

  let thailandAcquireIndex = 0;

  const helpers = api.createPhoneVerificationHelpers({
    addLog: async () => {},
    ensureStep8SignupPageReady: async () => {},
    fetchImpl: async (url) => {
      const parsedUrl = new URL(url);
      requests.push(parsedUrl);
      const action = parsedUrl.searchParams.get('action');
      const id = parsedUrl.searchParams.get('id');
      const country = parsedUrl.searchParams.get('country');

      if (action === 'getPrices') {
        return {
          ok: true,
          text: async () => JSON.stringify({
            [country]: {
              dr: {
                cost: country === '52' ? 0.08 : 0.09,
                count: 100,
              },
            },
          }),
        };
      }

      if (action === 'getNumber') {
        if (country === '52') {
          thailandAcquireIndex += 1;
          return {
            ok: true,
            text: async () => `ACCESS_NUMBER:52${thailandAcquireIndex}:66950000${thailandAcquireIndex}`,
          };
        }
        if (country === '16') {
          return {
            ok: true,
            text: async () => 'ACCESS_NUMBER:160001:447955001122',
          };
        }
      }

      if (action === 'getStatus') {
        if (id === '160001') {
          return { ok: true, text: async () => 'STATUS_OK:888999' };
        }
        return { ok: true, text: async () => 'STATUS_WAIT_CODE' };
      }

      if (action === 'setStatus') {
        return { ok: true, text: async () => 'STATUS_UPDATED' };
      }

      throw new Error(`Unexpected HeroSMS action: ${action} @ country ${country || 'n/a'}`);
    },
    getOAuthFlowStepTimeoutMs: async (defaultTimeoutMs) => defaultTimeoutMs,
    getState: async () => ({ ...currentState }),
    sendToContentScriptResilient: async (_source, message) => {
      if (message.type === 'SUBMIT_PHONE_NUMBER') {
        return {
          phoneVerificationPage: true,
          url: 'https://auth.openai.com/phone-verification',
        };
      }
      if (message.type === 'RETURN_TO_ADD_PHONE') {
        return {
          addPhonePage: true,
          phoneVerificationPage: false,
          url: 'https://auth.openai.com/add-phone',
        };
      }
      if (message.type === 'SUBMIT_PHONE_VERIFICATION_CODE') {
        return {
          success: true,
          consentReady: true,
          url: 'https://auth.openai.com/authorize',
        };
      }
      throw new Error(`Unexpected content-script message: ${message.type}`);
    },
    setState: async (updates) => {
      currentState = { ...currentState, ...updates };
    },
    sleepWithStop: async () => {},
    throwIfStopped: () => {},
  });

  const result = await helpers.completePhoneVerificationFlow(1, {
    addPhonePage: true,
    phoneVerificationPage: false,
    url: 'https://auth.openai.com/add-phone',
  });

  assert.deepStrictEqual(result, {
    success: true,
    consentReady: true,
    url: 'https://auth.openai.com/authorize',
  });

  const getNumberCountries = requests
    .filter((requestUrl) => requestUrl.searchParams.get('action') === 'getNumber')
    .map((requestUrl) => requestUrl.searchParams.get('country'));
  assert.deepStrictEqual(getNumberCountries, ['52', '16']);
});

test('phone verification helper escalates HeroSMS price tier in the same country after sms timeout before changing country', async () => {
  const requests = [];
  let currentState = {
    heroSmsApiKey: 'demo-key',
    heroSmsCountryId: 52,
    heroSmsCountryLabel: 'Thailand',
    heroSmsCountryFallback: [{ id: 16, label: 'United Kingdom' }],
    verificationResendCount: 0,
    phoneVerificationReplacementLimit: 2,
    phoneCodeWaitSeconds: 60,
    phoneCodeTimeoutWindows: 1,
    phoneCodePollIntervalSeconds: 1,
    phoneCodePollMaxRounds: 1,
    currentPhoneActivation: null,
    reusablePhoneActivation: null,
  };

  let thailandAcquireIndex = 0;

  const helpers = api.createPhoneVerificationHelpers({
    addLog: async () => {},
    ensureStep8SignupPageReady: async () => {},
    fetchImpl: async (url) => {
      const parsedUrl = new URL(url);
      requests.push(parsedUrl);
      const action = parsedUrl.searchParams.get('action');
      const id = parsedUrl.searchParams.get('id');
      const country = parsedUrl.searchParams.get('country');
      const maxPrice = parsedUrl.searchParams.get('maxPrice');

      if (action === 'getPrices') {
        if (country === '52') {
          return {
            ok: true,
            text: async () => JSON.stringify({
              52: {
                dr: {
                  starter: { cost: 0.05, count: 10 },
                  premium: { cost: 0.08, count: 10 },
                },
              },
            }),
          };
        }
        return {
          ok: true,
          text: async () => JSON.stringify({
            [country]: {
              dr: {
                cost: 0.09,
                count: 10,
              },
            },
          }),
        };
      }

      if (action === 'getNumber') {
        if (country === '52') {
          if (maxPrice === '0.05') {
            thailandAcquireIndex += 1;
            return {
              ok: true,
              text: async () => `ACCESS_NUMBER:52low${thailandAcquireIndex}:66950000${thailandAcquireIndex}`,
            };
          }
          if (maxPrice === '0.08') {
            return {
              ok: true,
              text: async () => 'ACCESS_NUMBER:52high1:66958888888',
            };
          }
        }
        if (country === '16') {
          return {
            ok: true,
            text: async () => 'ACCESS_NUMBER:160001:447955001122',
          };
        }
      }

      if (action === 'getStatus') {
        if (id === '52high1') {
          return { ok: true, text: async () => 'STATUS_OK:112233' };
        }
        if (id === '160001') {
          return { ok: true, text: async () => 'STATUS_OK:223344' };
        }
        return { ok: true, text: async () => 'STATUS_WAIT_CODE' };
      }

      if (action === 'setStatus') {
        return { ok: true, text: async () => 'STATUS_UPDATED' };
      }

      throw new Error(`Unexpected HeroSMS action: ${action} @ country ${country || 'n/a'} @ maxPrice ${maxPrice || ''}`);
    },
    getOAuthFlowStepTimeoutMs: async (defaultTimeoutMs) => defaultTimeoutMs,
    getState: async () => ({ ...currentState }),
    sendToContentScriptResilient: async (_source, message) => {
      if (message.type === 'SUBMIT_PHONE_NUMBER') {
        return {
          phoneVerificationPage: true,
          url: 'https://auth.openai.com/phone-verification',
        };
      }
      if (message.type === 'RETURN_TO_ADD_PHONE') {
        return {
          addPhonePage: true,
          phoneVerificationPage: false,
          url: 'https://auth.openai.com/add-phone',
        };
      }
      if (message.type === 'SUBMIT_PHONE_VERIFICATION_CODE') {
        return {
          success: true,
          consentReady: true,
          url: 'https://auth.openai.com/authorize',
        };
      }
      throw new Error(`Unexpected content-script message: ${message.type}`);
    },
    setState: async (updates) => {
      currentState = { ...currentState, ...updates };
    },
    sleepWithStop: async () => {},
    throwIfStopped: () => {},
  });

  const result = await helpers.completePhoneVerificationFlow(1, {
    addPhonePage: true,
    phoneVerificationPage: false,
    url: 'https://auth.openai.com/add-phone',
  });

  assert.deepStrictEqual(result, {
    success: true,
    consentReady: true,
    url: 'https://auth.openai.com/authorize',
  });

  const getNumberEntries = requests
    .filter((requestUrl) => requestUrl.searchParams.get('action') === 'getNumber')
    .map((requestUrl) => `${requestUrl.searchParams.get('country')}:${requestUrl.searchParams.get('maxPrice') || ''}`);
  assert.deepStrictEqual(getNumberEntries, ['52:0.05', '52:0.08']);
});

test('phone verification helper parses currency-formatted HeroSMS tiers and retries higher tier in same country', async () => {
  const requests = [];
  let currentState = {
    heroSmsApiKey: 'demo-key',
    heroSmsCountryId: 52,
    heroSmsCountryLabel: 'Thailand',
    heroSmsCountryFallback: [{ id: 16, label: 'United Kingdom' }],
    verificationResendCount: 0,
    phoneVerificationReplacementLimit: 2,
    phoneCodeWaitSeconds: 60,
    phoneCodeTimeoutWindows: 1,
    phoneCodePollIntervalSeconds: 1,
    phoneCodePollMaxRounds: 1,
    currentPhoneActivation: null,
    reusablePhoneActivation: null,
    heroSmsMaxPrice: '0.12',
    heroSmsAcquirePriority: 'price',
  };

  let thailandAcquireIndex = 0;

  const helpers = api.createPhoneVerificationHelpers({
    addLog: async () => {},
    ensureStep8SignupPageReady: async () => {},
    fetchImpl: async (url) => {
      const parsedUrl = new URL(url);
      requests.push(parsedUrl);
      const action = parsedUrl.searchParams.get('action');
      const id = parsedUrl.searchParams.get('id');
      const country = parsedUrl.searchParams.get('country');
      const maxPrice = parsedUrl.searchParams.get('maxPrice');

      if (action === 'getPrices' || action === 'getPricesExtended') {
        if (country === '52') {
          return {
            ok: true,
            text: async () => JSON.stringify({
              52: {
                dr: {
                  '$0.1183': { cost: '$0.1183', count: 925 },
                  '$0.1036': { cost: '$0.1036', count: 35 },
                  '$0.0942': { cost: '$0.0942', count: 25 },
                  '$0.0500': { cost: '$0.0500', count: 10 },
                },
              },
            }),
          };
        }
        return {
          ok: true,
          text: async () => JSON.stringify({
            [country]: {
              dr: {
                cost: 0.09,
                count: 10,
              },
            },
          }),
        };
      }

      if (action === 'getNumber') {
        if (country === '52') {
          if (maxPrice === '0.05') {
            thailandAcquireIndex += 1;
            return {
              ok: true,
              text: async () => `ACCESS_NUMBER:52low${thailandAcquireIndex}:66950000${thailandAcquireIndex}`,
            };
          }
          if (maxPrice === '0.0942') {
            return {
              ok: true,
              text: async () => 'ACCESS_NUMBER:52mid1:66954443322',
            };
          }
        }
        if (country === '16') {
          return {
            ok: true,
            text: async () => 'ACCESS_NUMBER:160001:447955001122',
          };
        }
      }

      if (action === 'getStatus') {
        if (id === '52mid1') {
          return { ok: true, text: async () => 'STATUS_OK:998877' };
        }
        if (id === '160001') {
          return { ok: true, text: async () => 'STATUS_OK:223344' };
        }
        return { ok: true, text: async () => 'STATUS_WAIT_CODE' };
      }

      if (action === 'setStatus') {
        return { ok: true, text: async () => 'STATUS_UPDATED' };
      }

      throw new Error(`Unexpected HeroSMS action: ${action} @ country ${country || 'n/a'} @ maxPrice ${maxPrice || ''}`);
    },
    getOAuthFlowStepTimeoutMs: async (defaultTimeoutMs) => defaultTimeoutMs,
    getState: async () => ({ ...currentState }),
    sendToContentScriptResilient: async (_source, message) => {
      if (message.type === 'SUBMIT_PHONE_NUMBER') {
        return {
          phoneVerificationPage: true,
          url: 'https://auth.openai.com/phone-verification',
        };
      }
      if (message.type === 'RETURN_TO_ADD_PHONE') {
        return {
          addPhonePage: true,
          phoneVerificationPage: false,
          url: 'https://auth.openai.com/add-phone',
        };
      }
      if (message.type === 'SUBMIT_PHONE_VERIFICATION_CODE') {
        return {
          success: true,
          consentReady: true,
          url: 'https://auth.openai.com/authorize',
        };
      }
      throw new Error(`Unexpected content-script message: ${message.type}`);
    },
    setState: async (updates) => {
      currentState = { ...currentState, ...updates };
    },
    sleepWithStop: async () => {},
    throwIfStopped: () => {},
  });

  const result = await helpers.completePhoneVerificationFlow(1, {
    addPhonePage: true,
    phoneVerificationPage: false,
    url: 'https://auth.openai.com/add-phone',
  });

  assert.deepStrictEqual(result, {
    success: true,
    consentReady: true,
    url: 'https://auth.openai.com/authorize',
  });

  const getNumberEntries = requests
    .filter((requestUrl) => requestUrl.searchParams.get('action') === 'getNumber')
    .map((requestUrl) => `${requestUrl.searchParams.get('country')}:${requestUrl.searchParams.get('maxPrice') || ''}`);
  assert.deepStrictEqual(getNumberEntries, ['52:0.05', '52:0.0942']);
});

test('phone verification helper prefers manually selected activation before automatic reuse/new acquisition', async () => {
  const requests = [];
  let currentState = {
    heroSmsApiKey: 'demo-key',
    heroSmsCountryId: 52,
    heroSmsCountryLabel: 'Thailand',
    verificationResendCount: 0,
    phoneVerificationReplacementLimit: 1,
    phoneCodeWaitSeconds: 15,
    phoneCodeTimeoutWindows: 1,
    phoneCodePollIntervalSeconds: 1,
    phoneCodePollMaxRounds: 1,
    phonePreferredActivation: {
      provider: 'hero-sms',
      activationId: 'preferred-activation',
      phoneNumber: '66951112233',
      countryId: 52,
      countryLabel: 'Thailand',
      successfulUses: 0,
      maxUses: 3,
    },
    reusablePhoneActivation: {
      provider: 'hero-sms',
      activationId: 'reusable-activation',
      phoneNumber: '66959998888',
      countryId: 52,
      countryLabel: 'Thailand',
      successfulUses: 0,
      maxUses: 3,
    },
    currentPhoneActivation: null,
  };
  const helpers = api.createPhoneVerificationHelpers({
    addLog: async () => {},
    ensureStep8SignupPageReady: async () => {},
    fetchImpl: async (url) => {
      const parsedUrl = new URL(url);
      requests.push(parsedUrl);
      const action = parsedUrl.searchParams.get('action');
      const id = parsedUrl.searchParams.get('id');
      if (action === 'reactivate' && id === 'preferred-activation') {
        return { ok: true, text: async () => 'ACCESS_READY' };
      }
      if (action === 'getStatus' && id === 'preferred-activation') {
        return { ok: true, text: async () => 'STATUS_OK:556677' };
      }
      if (action === 'setStatus') {
        return { ok: true, text: async () => 'STATUS_UPDATED' };
      }
      throw new Error(`Unexpected HeroSMS action: ${action} @ id ${id || 'n/a'}`);
    },
    getOAuthFlowStepTimeoutMs: async (defaultTimeoutMs) => defaultTimeoutMs,
    getState: async () => ({ ...currentState }),
    sendToContentScriptResilient: async (_source, message) => {
      if (message.type === 'SUBMIT_PHONE_NUMBER') {
        return {
          phoneVerificationPage: true,
          url: 'https://auth.openai.com/phone-verification',
        };
      }
      if (message.type === 'SUBMIT_PHONE_VERIFICATION_CODE') {
        return {
          success: true,
          consentReady: true,
          url: 'https://auth.openai.com/authorize',
        };
      }
      throw new Error(`Unexpected content-script message: ${message.type}`);
    },
    setState: async (updates) => {
      currentState = { ...currentState, ...updates };
    },
    sleepWithStop: async () => {},
    throwIfStopped: () => {},
  });

  const result = await helpers.completePhoneVerificationFlow(1, {
    addPhonePage: true,
    phoneVerificationPage: false,
    url: 'https://auth.openai.com/add-phone',
  });

  assert.deepStrictEqual(result, {
    success: true,
    consentReady: true,
    url: 'https://auth.openai.com/authorize',
  });
  const actionTrace = requests.map((requestUrl) => (
    `${requestUrl.searchParams.get('action')}:${requestUrl.searchParams.get('id') || requestUrl.searchParams.get('country') || ''}`
  ));
  assert.equal(actionTrace.includes('reactivate:preferred-activation'), true);
  assert.equal(actionTrace.some((item) => item.startsWith('reactivate:reusable-activation')), false);
  assert.equal(actionTrace.some((item) => item.startsWith('getNumber:')), false);
});

test('phone verification helper retries with a new number after preferred activation timeout and updates runtime countdown state', async () => {
  const requests = [];
  const stateUpdates = [];
  let currentState = {
    heroSmsApiKey: 'demo-key',
    heroSmsCountryId: 52,
    heroSmsCountryLabel: 'Thailand',
    verificationResendCount: 0,
    phoneVerificationReplacementLimit: 2,
    phoneCodeWaitSeconds: 15,
    phoneCodeTimeoutWindows: 1,
    phoneCodePollIntervalSeconds: 1,
    phoneCodePollMaxRounds: 1,
    phonePreferredActivation: {
      provider: 'hero-sms',
      activationId: 'preferred-activation',
      phoneNumber: '66951112233',
      countryId: 52,
      countryLabel: 'Thailand',
      successfulUses: 0,
      maxUses: 3,
    },
    currentPhoneActivation: null,
    reusablePhoneActivation: null,
  };

  const helpers = api.createPhoneVerificationHelpers({
    addLog: async () => {},
    ensureStep8SignupPageReady: async () => {},
    fetchImpl: async (url) => {
      const parsedUrl = new URL(url);
      requests.push(parsedUrl);
      const action = parsedUrl.searchParams.get('action');
      const id = parsedUrl.searchParams.get('id');
      const country = parsedUrl.searchParams.get('country');

      if (action === 'reactivate' && id === 'preferred-activation') {
        return { ok: true, text: async () => 'ACCESS_READY' };
      }
      if (action === 'getStatus') {
        if (id === 'preferred-activation') {
          return { ok: true, text: async () => 'STATUS_WAIT_CODE' };
        }
        if (id === 'new-activation') {
          return { ok: true, text: async () => 'STATUS_OK:112233' };
        }
      }
      if (action === 'setStatus') {
        return { ok: true, text: async () => 'STATUS_UPDATED' };
      }
      if (action === 'getPrices') {
        return {
          ok: true,
          text: async () => buildHeroSmsPricesPayload({ country: country || '52', cost: 0.08, count: 100 }),
        };
      }
      if (action === 'getNumber') {
        return {
          ok: true,
          text: async () => 'ACCESS_NUMBER:new-activation:66950000123',
        };
      }
      throw new Error(`Unexpected HeroSMS action: ${action} @ id ${id || 'n/a'}`);
    },
    getOAuthFlowStepTimeoutMs: async (defaultTimeoutMs) => defaultTimeoutMs,
    getState: async () => ({ ...currentState }),
    sendToContentScriptResilient: async (_source, message) => {
      if (message.type === 'SUBMIT_PHONE_NUMBER') {
        return {
          phoneVerificationPage: true,
          url: 'https://auth.openai.com/phone-verification',
        };
      }
      if (message.type === 'RETURN_TO_ADD_PHONE') {
        return {
          addPhonePage: true,
          phoneVerificationPage: false,
          url: 'https://auth.openai.com/add-phone',
        };
      }
      if (message.type === 'SUBMIT_PHONE_VERIFICATION_CODE') {
        return {
          success: true,
          consentReady: true,
          url: 'https://auth.openai.com/authorize',
        };
      }
      throw new Error(`Unexpected content-script message: ${message.type}`);
    },
    setState: async (updates) => {
      stateUpdates.push(updates);
      currentState = { ...currentState, ...updates };
    },
    sleepWithStop: async () => {},
    throwIfStopped: () => {},
  });

  const result = await helpers.completePhoneVerificationFlow(1, {
    addPhonePage: true,
    phoneVerificationPage: false,
    url: 'https://auth.openai.com/add-phone',
  });

  assert.deepStrictEqual(result, {
    success: true,
    consentReady: true,
    url: 'https://auth.openai.com/authorize',
  });

  const reactivatePreferredCalls = requests.filter((requestUrl) => (
    requestUrl.searchParams.get('action') === 'reactivate'
    && requestUrl.searchParams.get('id') === 'preferred-activation'
  ));
  assert.equal(reactivatePreferredCalls.length, 1);

  const getNumberCalls = requests.filter((requestUrl) => requestUrl.searchParams.get('action') === 'getNumber');
  assert.equal(getNumberCalls.length, 1);
  assert.equal(getNumberCalls[0].searchParams.get('country'), '52');

  assert.equal(
    stateUpdates.some((updates) => Number(updates.currentPhoneVerificationCountdownEndsAt) > 0),
    true,
    'should expose countdown window start in runtime state'
  );
  assert.equal(
    stateUpdates.some((updates) => Number(updates.currentPhoneVerificationCountdownEndsAt) === 0),
    true,
    'should clear countdown window after step9 rotation/completion'
  );
});

test('phone verification helper logs no-supply diagnostics with consecutive streak when all providers fail to acquire number', async () => {
  const logs = [];
  const requests = [];
  let currentState = {
    heroSmsApiKey: 'demo-key',
    phoneSmsProvider: 'hero-sms',
    phoneSmsProviderOrder: ['hero-sms'],
    heroSmsCountryId: 52,
    heroSmsCountryLabel: 'Thailand',
    heroSmsCountryFallback: [],
    heroSmsMaxPrice: '0.06',
    currentPhoneActivation: null,
    reusablePhoneActivation: null,
    verificationResendCount: 0,
    phoneVerificationReplacementLimit: 1,
  };

  const helpers = api.createPhoneVerificationHelpers({
    addLog: async (message, level = 'info', options = {}) => {
      logs.push({ message, level, options });
    },
    ensureStep8SignupPageReady: async () => {},
    fetchImpl: async (url) => {
      const parsedUrl = new URL(url);
      requests.push(parsedUrl);
      const action = parsedUrl.searchParams.get('action');
      if (action === 'getPrices') {
        return {
          ok: true,
          text: async () => buildHeroSmsPricesPayload({ country: '52', cost: 0.05, count: 20 }),
        };
      }
      if (action === 'getNumber' || action === 'getNumberV2') {
        return {
          ok: true,
          text: async () => 'NO_NUMBERS',
        };
      }
      throw new Error(`Unexpected HeroSMS action: ${action}`);
    },
    getOAuthFlowStepTimeoutMs: async (defaultTimeoutMs) => defaultTimeoutMs,
    getState: async () => ({ ...currentState }),
    sendToContentScriptResilient: async (_source, message) => {
      throw new Error(`Unexpected content-script message: ${message.type}`);
    },
    setState: async (updates) => {
      currentState = { ...currentState, ...updates };
    },
    sleepWithStop: async () => {},
    throwIfStopped: () => {},
  });

  const runOnce = async () => assert.rejects(
    helpers.completePhoneVerificationFlow(1, {
      addPhonePage: true,
      phoneVerificationPage: false,
      url: 'https://auth.openai.com/add-phone',
    }),
    /all provider candidates failed to acquire number/i
  );

  await runOnce();
  await runOnce();

  const diagnosticsLogs = logs
    .filter((entry) => String(entry.message || '').includes('diagnostics: 无号连续失败'));

  assert.equal(diagnosticsLogs.length >= 2, true);
  assert.equal(diagnosticsLogs.every((entry) => entry.options?.step === 9), true);
  assert.equal(diagnosticsLogs.every((entry) => entry.options?.stepKey === 'phone-verification'), true);
  assert.equal(diagnosticsLogs.some((entry) => entry.message.includes('无号连续失败 1 次')), true);
  assert.equal(diagnosticsLogs.some((entry) => entry.message.includes('无号连续失败 2 次')), true);
  assert.equal(
    diagnosticsLogs.some((entry) => entry.message.includes('maxPrice=0.06')),
    true
  );
  assert.equal(
    diagnosticsLogs.some((entry) => entry.message.includes('国家数 HeroSMS=1, 5sim=0, NexSMS=0')),
    true
  );
  assert.equal(currentState.phoneNoSupplyFailureStreak, 2);
  assert.equal(requests.some((entry) => entry.searchParams.get('action') === 'getNumber'), true);
});

test('phone verification helper routes 5sim buy, check, and finish by current activation provider', async () => {
  const requests = [];
  let currentState = {
    phoneSmsProvider: '5sim',
    fiveSimApiKey: 'demo-key',
    fiveSimCountryId: 'vietnam',
    fiveSimCountryLabel: '越南 (Vietnam)',
    fiveSimMaxPrice: '12',
    fiveSimOperator: 'any',
    verificationResendCount: 0,
    phoneVerificationReplacementLimit: 2,
    phoneCodeWaitSeconds: 60,
    phoneCodeTimeoutWindows: 1,
    phoneCodePollIntervalSeconds: 1,
    phoneCodePollMaxRounds: 1,
    currentPhoneActivation: null,
    reusablePhoneActivation: null,
  };

  const fiveSimSource = fs.readFileSync('phone-sms/providers/five-sim.js', 'utf8');
  const fiveSimModule = new Function('self', `${fiveSimSource}; return self.PhoneSmsFiveSimProvider;`)({});
  const helpers = api.createPhoneVerificationHelpers({
    addLog: async () => {},
    ensureStep8SignupPageReady: async () => {},
    createFiveSimProvider: fiveSimModule.createProvider,
    fetchImpl: async (url, options = {}) => {
      const parsedUrl = new URL(url);
      requests.push({ url: parsedUrl, options });
      if (parsedUrl.pathname === '/v1/guest/products/vietnam/any') {
        return {
          ok: true,
          status: 200,
          text: async () => JSON.stringify({ openai: { Category: 'activation', Qty: 3, Price: 9.5 } }),
        };
      }
      if (parsedUrl.pathname === '/v1/guest/prices') {
        return {
          ok: true,
          status: 200,
          text: async () => JSON.stringify({ vietnam: { any: { openai: { cost: 9.5, count: 3 } } } }),
        };
      }
      if (parsedUrl.pathname === '/v1/user/buy/activation/vietnam/any/openai') {
        return {
          ok: true,
          status: 200,
          text: async () => JSON.stringify({ id: 5001, phone: '+84901122334', country: 'vietnam', operator: 'any', status: 'PENDING' }),
        };
      }
      if (parsedUrl.pathname === '/v1/user/check/5001') {
        return {
          ok: true,
          status: 200,
          text: async () => JSON.stringify({ id: 5001, phone: '+447911223344', status: 'RECEIVED', sms: [{ text: 'OpenAI code 123456' }] }),
        };
      }
      if (parsedUrl.pathname === '/v1/user/finish/5001') {
        return {
          ok: true,
          status: 200,
          text: async () => JSON.stringify({ status: 'FINISHED' }),
        };
      }
      throw new Error(`Unexpected 5sim path: ${parsedUrl.pathname}`);
    },
    getOAuthFlowStepTimeoutMs: async (defaultTimeoutMs) => defaultTimeoutMs,
    getState: async () => ({ ...currentState }),
    sendToContentScriptResilient: async (_source, message) => {
      if (message.type === 'SUBMIT_PHONE_NUMBER') {
        return { phoneVerificationPage: true, url: 'https://auth.openai.com/phone-verification' };
      }
      if (message.type === 'SUBMIT_PHONE_VERIFICATION_CODE') {
        return { success: true, consentReady: true, url: 'https://auth.openai.com/authorize' };
      }
      throw new Error(`Unexpected content-script message: ${message.type}`);
    },
    setState: async (updates) => {
      currentState = { ...currentState, ...updates };
    },
    sleepWithStop: async () => {},
    throwIfStopped: () => {},
  });

  const result = await helpers.completePhoneVerificationFlow(1, {
    addPhonePage: true,
    phoneVerificationPage: false,
    url: 'https://auth.openai.com/add-phone',
  });

  assert.deepStrictEqual(result, {
    success: true,
    consentReady: true,
    url: 'https://auth.openai.com/authorize',
  });
  assert.equal(currentState.currentPhoneActivation, null);
  assert.equal(currentState.reusablePhoneActivation.provider, '5sim');
  assert.equal(currentState.reusablePhoneActivation.activationId, '5001');
  assert.equal(currentState.reusablePhoneActivation.successfulUses, 1);
  const buy = requests.find((entry) => entry.url.pathname.includes('/buy/activation'));
  assert.equal(buy.url.searchParams.get('maxPrice'), '12');
  assert.equal(buy.url.searchParams.get('reuse'), '1');
  assert.equal(buy.options.headers.Authorization, 'Bearer demo-key');
  assert.deepStrictEqual(
    requests.map((entry) => entry.url.pathname),
    [
      '/v1/guest/products/vietnam/any',
      '/v1/guest/prices',
      '/v1/user/buy/activation/vietnam/any/openai',
      '/v1/user/check/5001',
      '/v1/user/finish/5001',
    ]
  );
});

test('phone verification helper routes 5sim reusable activation through reuse endpoint', async () => {
  const requests = [];
  let currentState = {
    phoneSmsProvider: '5sim',
    fiveSimApiKey: 'demo-key',
    fiveSimCountryId: 'vietnam',
    fiveSimCountryLabel: '越南 (Vietnam)',
    fiveSimOperator: 'any',
    verificationResendCount: 0,
    phoneVerificationReplacementLimit: 2,
    phoneCodeWaitSeconds: 60,
    phoneCodeTimeoutWindows: 1,
    phoneCodePollIntervalSeconds: 1,
    phoneCodePollMaxRounds: 1,
    currentPhoneActivation: null,
    reusablePhoneActivation: {
      activationId: '4001',
      phoneNumber: '+84901122334',
      provider: '5sim',
      serviceCode: 'openai',
      countryId: 'vietnam',
      countryLabel: '越南 (Vietnam)',
      successfulUses: 1,
      maxUses: 3,
    },
  };

  const fiveSimSource = fs.readFileSync('phone-sms/providers/five-sim.js', 'utf8');
  const fiveSimModule = new Function('self', `${fiveSimSource}; return self.PhoneSmsFiveSimProvider;`)({});
  const helpers = api.createPhoneVerificationHelpers({
    addLog: async () => {},
    ensureStep8SignupPageReady: async () => {},
    createFiveSimProvider: fiveSimModule.createProvider,
    fetchImpl: async (url) => {
      const parsedUrl = new URL(url);
      requests.push(parsedUrl);
      if (parsedUrl.pathname === '/v1/user/reuse/openai/84901122334') {
        return { ok: true, status: 200, text: async () => JSON.stringify({ id: 4002, phone: '+84901122334', country: 'vietnam', status: 'PENDING' }) };
      }
      if (parsedUrl.pathname === '/v1/user/check/4002') {
        return { ok: true, status: 200, text: async () => JSON.stringify({ id: 4002, phone: '+447911223344', status: 'RECEIVED', sms: [{ code: '654321' }] }) };
      }
      if (parsedUrl.pathname === '/v1/user/finish/4002') {
        return { ok: true, status: 200, text: async () => JSON.stringify({ status: 'FINISHED' }) };
      }
      throw new Error(`Unexpected 5sim path: ${parsedUrl.pathname}`);
    },
    getOAuthFlowStepTimeoutMs: async (defaultTimeoutMs) => defaultTimeoutMs,
    getState: async () => ({ ...currentState }),
    sendToContentScriptResilient: async (_source, message) => {
      if (message.type === 'SUBMIT_PHONE_NUMBER') {
        return { phoneVerificationPage: true, url: 'https://auth.openai.com/phone-verification' };
      }
      if (message.type === 'SUBMIT_PHONE_VERIFICATION_CODE') {
        return { success: true, consentReady: true, url: 'https://auth.openai.com/authorize' };
      }
      throw new Error(`Unexpected content-script message: ${message.type}`);
    },
    setState: async (updates) => {
      currentState = { ...currentState, ...updates };
    },
    sleepWithStop: async () => {},
    throwIfStopped: () => {},
  });

  const result = await helpers.completePhoneVerificationFlow(1, {
    addPhonePage: true,
    phoneVerificationPage: false,
    url: 'https://auth.openai.com/add-phone',
  });

  assert.deepStrictEqual(result, {
    success: true,
    consentReady: true,
    url: 'https://auth.openai.com/authorize',
  });
  assert.equal(currentState.reusablePhoneActivation.activationId, '4002');
  assert.equal(currentState.reusablePhoneActivation.successfulUses, 1);
  assert.deepStrictEqual(
    requests.map((url) => url.pathname),
    [
      '/v1/user/reuse/openai/84901122334',
      '/v1/user/check/4002',
      '/v1/user/finish/4002',
    ]
  );
});
