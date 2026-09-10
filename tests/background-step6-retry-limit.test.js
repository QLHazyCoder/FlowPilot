const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');

test('step 6 waits for registration success and completes from background', async () => {
  const source = fs.readFileSync('flows/openai/background/steps/wait-registration-success.js', 'utf8');
  const globalScope = {};
  const api = new Function('self', `${source}; return self.MultiPageBackgroundStep6;`)(globalScope);

  const events = {
    logs: [],
    waits: [],
    completedSteps: [],
  };

  const executor = api.createStep6Executor({
    addLog: async (message, level = 'info') => {
      events.logs.push({ message, level });
    },
    completeNodeFromBackground: async (step) => {
      events.completedSteps.push(step);
    },
    sleepWithStop: async (ms) => {
      events.waits.push(ms);
    },
  });

  await executor.executeStep6();

  assert.deepStrictEqual(events.waits, [7000]);
  assert.deepStrictEqual(events.completedSteps, ['wait-registration-success']);
  assert.ok(events.logs.some(({ message }) => /等待 7 秒/.test(message)));
});

test('step 6 only clears cookies when cleanup switch is enabled', async () => {
  const source = fs.readFileSync('flows/openai/background/steps/wait-registration-success.js', 'utf8');
  const globalScope = {};
  const api = new Function('self', `${source}; return self.MultiPageBackgroundStep6;`)(globalScope);

  const events = {
    removedCookies: [],
    browsingDataCalls: [],
    completedSteps: [],
  };
  const chromeApi = {
    cookies: {
      getAllCookieStores: async () => [{ id: 'store-a' }],
      getAll: async () => [
        { domain: '.chatgpt.com', path: '/auth', name: 'session', storeId: 'store-a' },
        { domain: '.example.com', path: '/', name: 'keep', storeId: 'store-a' },
      ],
      remove: async (details) => {
        events.removedCookies.push(details);
        return details;
      },
    },
    browsingData: {
      removeCookies: async (details) => {
        events.browsingDataCalls.push(details);
      },
    },
  };

  const executor = api.createStep6Executor({
    addLog: async () => {},
    chrome: chromeApi,
    completeNodeFromBackground: async (step) => {
      events.completedSteps.push(step);
    },
    sleepWithStop: async () => {},
  });

  await executor.executeStep6({ step6CookieCleanupEnabled: false });

  assert.deepStrictEqual(events.removedCookies, []);
  assert.deepStrictEqual(events.browsingDataCalls, []);

  await executor.executeStep6({ step6CookieCleanupEnabled: true });

  assert.deepStrictEqual(events.completedSteps, ['wait-registration-success', 'wait-registration-success']);
  assert.deepStrictEqual(events.removedCookies, [
    {
      url: 'https://chatgpt.com/auth',
      name: 'session',
      storeId: 'store-a',
    },
  ]);
  assert.equal(events.browsingDataCalls.length, 1);
  assert.ok(events.browsingDataCalls[0].origins.includes('https://chatgpt.com'));
});

test('step 7 retries up to configured limit and then fails', async () => {
  const source = fs.readFileSync('flows/openai/background/steps/oauth-login.js', 'utf8');
  const globalScope = {};
  const api = new Function('self', `${source}; return self.MultiPageBackgroundStep7;`)(globalScope);

  const events = {
    refreshCalls: 0,
    sendCalls: 0,
    completed: 0,
  };

  const executor = api.createStep7Executor({
    addLog: async () => {},
    completeNodeFromBackground: async () => {
      events.completed += 1;
    },
    getErrorMessage: (error) => error?.message || String(error || ''),
    getLoginAuthStateLabel: (state) => state || 'unknown',
    getState: async () => ({ email: 'user@example.com', password: 'secret' }),
    isStep6RecoverableResult: (result) => result?.step6Outcome === 'recoverable',
    isStep6SuccessResult: (result) => result?.step6Outcome === 'success',
    refreshOAuthUrlBeforeStep6: async () => {
      events.refreshCalls += 1;
      return `https://oauth.example/${events.refreshCalls}`;
    },
    reuseOrCreateTab: async () => {},
    sendToContentScriptResilient: async () => {
      events.sendCalls += 1;
      return {
        step6Outcome: 'recoverable',
        state: 'email_page',
        message: '当前仍停留在邮箱页。',
      };
    },
    STEP6_MAX_ATTEMPTS: 3,
    throwIfStopped: () => {},
  });

  await assert.rejects(
    () => executor.executeStep7({ email: 'user@example.com', password: 'secret' }),
    /已重试 2 次，仍未成功/
  );

  assert.equal(events.refreshCalls, 3);
  assert.equal(events.sendCalls, 3);
  assert.equal(events.completed, 0);
});

test('step 7 preserves visible step when refreshing OAuth after retry', async () => {
  const source = fs.readFileSync('flows/openai/background/steps/oauth-login.js', 'utf8');
  const globalScope = {};
  const api = new Function('self', `${source}; return self.MultiPageBackgroundStep7;`)(globalScope);

  const events = {
    refreshSteps: [],
  };

  const executor = api.createStep7Executor({
    addLog: async () => {},
    completeNodeFromBackground: async () => {},
    getErrorMessage: (error) => error?.message || String(error || ''),
    getLoginAuthStateLabel: (state) => state || 'unknown',
    getState: async () => ({ email: 'user@example.com', password: 'secret' }),
    isStep6RecoverableResult: (result) => result?.step6Outcome === 'recoverable',
    isStep6SuccessResult: (result) => result?.step6Outcome === 'success',
    refreshOAuthUrlBeforeStep6: async (state) => {
      events.refreshSteps.push(state.visibleStep);
      return `https://oauth.example/${events.refreshSteps.length}`;
    },
    reuseOrCreateTab: async () => {},
    sendToContentScriptResilient: async () => ({
      step6Outcome: 'recoverable',
      state: 'email_page',
      message: '当前仍停留在邮箱页。',
    }),
    STEP6_MAX_ATTEMPTS: 3,
    throwIfStopped: () => {},
  });

  await assert.rejects(
    () => executor.executeStep7({ email: 'user@example.com', password: 'secret', visibleStep: 9 }),
    /步骤 9：判断失败后已重试 2 次/
  );

  assert.deepStrictEqual(events.refreshSteps, [9, 9, 9]);
});

test('step 7 hands add-phone to the dedicated post-login phone node without internal retry', async () => {
  const source = fs.readFileSync('flows/openai/background/steps/oauth-login.js', 'utf8');
  const globalScope = {};
  const api = new Function('self', `${source}; return self.MultiPageBackgroundStep7;`)(globalScope);

  const events = {
    refreshCalls: 0,
    sendCalls: 0,
    completions: [],
    logs: [],
  };

  const executor = api.createStep7Executor({
    addLog: async (message, level = 'info') => {
      events.logs.push({ message, level });
    },
    completeNodeFromBackground: async (step, payload) => {
      events.completions.push({ step, payload });
    },
    getErrorMessage: (error) => error?.message || String(error || ''),
    getLoginAuthStateLabel: (state) => state || 'unknown',
    getState: async () => ({ email: 'user@example.com', password: 'secret' }),
    isStep6RecoverableResult: (result) => result?.step6Outcome === 'recoverable',
    isStep6SuccessResult: (result) => result?.step6Outcome === 'success',
    refreshOAuthUrlBeforeStep6: async () => {
      events.refreshCalls += 1;
      return `https://oauth.example/${events.refreshCalls}`;
    },
    reuseOrCreateTab: async () => {},
    sendToContentScriptResilient: async () => {
      events.sendCalls += 1;
      throw new Error('提交密码后页面直接进入手机号页面，未经过登录验证码页。URL: https://auth.openai.com/add-phone');
    },
    STEP6_MAX_ATTEMPTS: 3,
    throwIfStopped: () => {},
  });

  await executor.executeStep7({ email: 'user@example.com', password: 'secret' });

  assert.equal(events.refreshCalls, 1, 'add-phone should stop further OAuth refresh attempts');
  assert.equal(events.sendCalls, 1, 'add-phone should stop after the first failed login attempt');
  assert.deepStrictEqual(events.completions, [
    {
      step: 'oauth-login',
      payload: {
        loginVerificationRequestedAt: null,
        skipLoginVerificationStep: true,
        addPhonePage: true,
        directOAuthConsentPage: false,
      },
    },
  ]);
  assert.ok(
    !events.logs.some(({ message }) => /准备重试/.test(message)),
    'add-phone failure should not be logged as an internal retryable attempt'
  );
});

test('step 7 no longer runs shared phone verification inside oauth-login', async () => {
  const source = fs.readFileSync('flows/openai/background/steps/oauth-login.js', 'utf8');
  const globalScope = {};
  const api = new Function('self', `${source}; return self.MultiPageBackgroundStep7;`)(globalScope);

  const events = {
    refreshCalls: 0,
    phoneCalls: [],
    completions: [],
  };

  const executor = api.createStep7Executor({
    addLog: async () => {},
    completeNodeFromBackground: async (step, payload) => {
      events.completions.push({ step, payload });
    },
    getErrorMessage: (error) => error?.message || String(error || ''),
    getLoginAuthStateLabel: (state) => state || 'unknown',
    getState: async () => ({
      email: 'user@example.com',
      password: 'secret',
    }),
    getTabId: async (sourceName) => (sourceName === 'openai-auth' ? 91 : 0),
    isStep6RecoverableResult: (result) => result?.step6Outcome === 'recoverable',
    isStep6SuccessResult: (result) => result?.step6Outcome === 'success',
    phoneVerificationHelpers: {
      completePhoneVerificationFlow: async (tabId, pageState, options) => {
        events.phoneCalls.push({ tabId, pageState, options });
        return { success: true, consentReady: true, url: 'https://auth.openai.com/authorize/resume' };
      },
    },
    refreshOAuthUrlBeforeStep6: async () => {
      events.refreshCalls += 1;
      return `https://oauth.example/${events.refreshCalls}`;
    },
    reuseOrCreateTab: async () => {},
    sendToContentScriptResilient: async () => {
      throw new Error('提交密码后页面直接进入手机号页面，未经过登录验证码页。URL: https://auth.openai.com/add-phone');
    },
    STEP6_MAX_ATTEMPTS: 3,
    throwIfStopped: () => {},
  });

  await executor.executeStep7({
    email: 'user@example.com',
    password: 'secret',
  });

  assert.equal(events.refreshCalls, 1);
  assert.deepStrictEqual(events.phoneCalls, []);
  assert.deepStrictEqual(events.completions, [
    {
      step: 'oauth-login',
      payload: {
        loginVerificationRequestedAt: null,
        skipLoginVerificationStep: true,
        addPhonePage: true,
        directOAuthConsentPage: false,
      },
    },
  ]);
});

test('step 7 add-phone handoff does not depend on a removed phone verification switch', async () => {
  const source = fs.readFileSync('flows/openai/background/steps/oauth-login.js', 'utf8');
  const globalScope = {};
  const api = new Function('self', `${source}; return self.MultiPageBackgroundStep7;`)(globalScope);

  const events = {
    phoneCalls: 0,
    completions: 0,
  };

  const executor = api.createStep7Executor({
    addLog: async () => {},
    completeNodeFromBackground: async () => {
      events.completions += 1;
    },
    getErrorMessage: (error) => error?.message || String(error || ''),
    getLoginAuthStateLabel: (state) => state || 'unknown',
    getState: async () => ({ email: 'user@example.com', password: 'secret' }),
    getTabId: async () => 91,
    isStep6RecoverableResult: (result) => result?.step6Outcome === 'recoverable',
    isStep6SuccessResult: (result) => result?.step6Outcome === 'success',
    phoneVerificationHelpers: {
      completePhoneVerificationFlow: async () => {
        events.phoneCalls += 1;
        return {};
      },
    },
    refreshOAuthUrlBeforeStep6: async () => 'https://oauth.example/latest',
    reuseOrCreateTab: async () => {},
    sendToContentScriptResilient: async () => {
      throw new Error('提交密码后页面直接进入手机号页面，未经过登录验证码页。URL: https://auth.openai.com/add-phone');
    },
    STEP6_MAX_ATTEMPTS: 3,
    throwIfStopped: () => {},
  });

  await executor.executeStep7({ email: 'user@example.com', password: 'secret' });
  assert.equal(events.phoneCalls, 0);
  assert.equal(events.completions, 1);
});

test('step 7 ignores obsolete shared add-phone verifier during handoff', async () => {
  const source = fs.readFileSync('flows/openai/background/steps/oauth-login.js', 'utf8');
  const globalScope = {};
  const api = new Function('self', `${source}; return self.MultiPageBackgroundStep7;`)(globalScope);

  const events = {
    phoneCalls: 0,
    completions: 0,
  };

  const executor = api.createStep7Executor({
    addLog: async () => {},
    completeNodeFromBackground: async () => {
      events.completions += 1;
    },
    getErrorMessage: (error) => error?.message || String(error || ''),
    getLoginAuthStateLabel: (state) => state || 'unknown',
    getState: async () => ({ email: 'user@example.com', password: 'secret' }),
    getTabId: async () => 91,
    isStep6RecoverableResult: (result) => result?.step6Outcome === 'recoverable',
    isStep6SuccessResult: (result) => result?.step6Outcome === 'success',
    phoneVerificationHelpers: {
      completePhoneVerificationFlow: async () => {
        events.phoneCalls += 1;
        throw new Error('步骤 9：没有可用手机号。');
      },
    },
    refreshOAuthUrlBeforeStep6: async () => 'https://oauth.example/latest',
    reuseOrCreateTab: async () => {},
    sendToContentScriptResilient: async () => {
      throw new Error('提交密码后页面直接进入手机号页面，未经过登录验证码页。URL: https://auth.openai.com/add-phone');
    },
    STEP6_MAX_ATTEMPTS: 3,
    throwIfStopped: () => {},
  });

  await executor.executeStep7({ email: 'user@example.com', password: 'secret' });
  assert.equal(events.phoneCalls, 0);
  assert.equal(events.completions, 1);
});

test('step 7 starts a new oauth timeout window for each refreshed oauth url', async () => {
  const source = fs.readFileSync('flows/openai/background/steps/oauth-login.js', 'utf8');
  const globalScope = {};
  const api = new Function('self', `${source}; return self.MultiPageBackgroundStep7;`)(globalScope);

  const events = {
    startedWindows: [],
    timeoutRequests: [],
  };

  const executor = api.createStep7Executor({
    addLog: async () => {},
    completeNodeFromBackground: async () => {},
    getErrorMessage: (error) => error?.message || String(error || ''),
    getLoginAuthStateLabel: (state) => state || 'unknown',
    getOAuthFlowStepTimeoutMs: async (defaultTimeoutMs, options) => {
      events.timeoutRequests.push({ defaultTimeoutMs, options });
      return 5000;
    },
    getState: async () => ({ email: 'user@example.com', password: 'secret' }),
    isStep6RecoverableResult: (result) => result?.step6Outcome === 'recoverable',
    isStep6SuccessResult: (result) => result?.step6Outcome === 'success',
    refreshOAuthUrlBeforeStep6: async () => 'https://oauth.example/latest',
    reuseOrCreateTab: async () => {},
    sendToContentScriptResilient: async (_source, _message, options) => ({
      step6Outcome: 'success',
      state: 'verification_page',
      usedTimeoutMs: options.timeoutMs,
    }),
    startOAuthFlowTimeoutWindow: async (payload) => {
      events.startedWindows.push(payload);
    },
    STEP6_MAX_ATTEMPTS: 3,
    throwIfStopped: () => {},
  });

  await executor.executeStep7({ email: 'user@example.com', password: 'secret' });

  assert.deepStrictEqual(events.startedWindows, [
    { step: 7, oauthUrl: 'https://oauth.example/latest' },
  ]);
  assert.deepStrictEqual(events.timeoutRequests, [
    {
      defaultTimeoutMs: 180000,
      options: {
        step: 7,
        actionLabel: 'OAuth 登录并进入验证码页',
        oauthUrl: 'https://oauth.example/latest',
      },
    },
  ]);
});

test('step 7 forwards direct OAuth consent skip metadata when completing', async () => {
  const source = fs.readFileSync('flows/openai/background/steps/oauth-login.js', 'utf8');
  const globalScope = {};
  const api = new Function('self', `${source}; return self.MultiPageBackgroundStep7;`)(globalScope);

  const events = {
    completions: [],
  };

  const executor = api.createStep7Executor({
    addLog: async () => {},
    completeNodeFromBackground: async (step, payload) => {
      events.completions.push({ step, payload });
    },
    getErrorMessage: (error) => error?.message || String(error || ''),
    getLoginAuthStateLabel: (state) => state || 'unknown',
    getState: async () => ({ email: 'user@example.com', password: 'secret' }),
    isStep6RecoverableResult: (result) => result?.step6Outcome === 'recoverable',
    isStep6SuccessResult: (result) => result?.step6Outcome === 'success',
    refreshOAuthUrlBeforeStep6: async () => 'https://oauth.example/latest',
    reuseOrCreateTab: async () => {},
    sendToContentScriptResilient: async () => ({
      step6Outcome: 'success',
      state: 'oauth_consent_page',
      skipLoginVerificationStep: true,
      directOAuthConsentPage: true,
    }),
    STEP6_MAX_ATTEMPTS: 3,
    throwIfStopped: () => {},
  });

  await executor.executeStep7({
    email: 'user@example.com',
    password: 'secret',
    visibleStep: 10,
  });

  assert.deepStrictEqual(events.completions, [
    {
      step: 'oauth-login',
      payload: {
        loginVerificationRequestedAt: null,
        skipLoginVerificationStep: true,
        directOAuthConsentPage: true,
      },
    },
  ]);
});

test('step 7 treats recoverable add-phone result as post-login phone handoff', async () => {
  const source = fs.readFileSync('flows/openai/background/steps/oauth-login.js', 'utf8');
  const globalScope = {};
  const api = new Function('self', `${source}; return self.MultiPageBackgroundStep7;`)(globalScope);

  const events = {
    completions: [],
    refreshCalls: 0,
    sendCalls: 0,
    logs: [],
  };

  const executor = api.createStep7Executor({
    addLog: async (message, level = 'info') => {
      events.logs.push({ message, level });
    },
    completeNodeFromBackground: async (step, payload) => {
      events.completions.push({ step, payload });
    },
    getErrorMessage: (error) => error?.message || String(error || ''),
    getLoginAuthStateLabel: (state) => state || 'unknown',
    getState: async () => ({ email: 'user@example.com', password: 'secret' }),
    isStep6RecoverableResult: (result) => result?.step6Outcome === 'recoverable',
    isStep6SuccessResult: (result) => result?.step6Outcome === 'success',
    refreshOAuthUrlBeforeStep6: async () => {
      events.refreshCalls += 1;
      return 'https://oauth.example/latest';
    },
    reuseOrCreateTab: async () => {},
    sendToContentScriptResilient: async () => {
      events.sendCalls += 1;
      return {
        step6Outcome: 'recoverable',
        state: 'add_phone_page',
        url: 'https://auth.openai.com/add-phone',
        message: 'Clicked user@example.com on OpenAI choose-account page, but the page did not enter a supported next state.',
      };
    },
    STEP6_MAX_ATTEMPTS: 3,
    throwIfStopped: () => {},
  });

  await executor.executeStep7({
    email: 'user@example.com',
    password: 'secret',
    visibleStep: 9,
  });

  assert.equal(events.refreshCalls, 1);
  assert.equal(events.sendCalls, 1);
  assert.deepStrictEqual(events.completions, [
    {
      step: 'oauth-login',
      payload: {
        loginVerificationRequestedAt: null,
        skipLoginVerificationStep: true,
        addPhonePage: true,
        phoneVerificationPage: false,
      },
    },
  ]);
  assert.equal(events.logs.some(({ message }) => /准备重试/.test(message)), false);
});

test('step 7 forwards phone login identity payload when account identifier is phone', async () => {
  const source = fs.readFileSync('flows/openai/background/steps/oauth-login.js', 'utf8');
  const globalScope = {};
  const api = new Function('self', `${source}; return self.MultiPageBackgroundStep7;`)(globalScope);

  const events = {
    completions: [],
    payloads: [],
  };

  const executor = api.createStep7Executor({
    addLog: async () => {},
    completeNodeFromBackground: async (step, payload) => {
      events.completions.push({ step, payload });
    },
    getErrorMessage: (error) => error?.message || String(error || ''),
    getLoginAuthStateLabel: (state) => state || 'unknown',
    getState: async () => ({
      accountIdentifierType: 'phone',
      accountIdentifier: '66959916439',
      signupPhoneNumber: '66959916439',
      signupPhoneCompletedActivation: {
        activationId: 'signup-done',
        phoneNumber: '66959916439',
        countryId: 52,
        countryLabel: 'Thailand',
      },
      password: 'secret',
    }),
    isStep6RecoverableResult: (result) => result?.step6Outcome === 'recoverable',
    isStep6SuccessResult: (result) => result?.step6Outcome === 'success',
    refreshOAuthUrlBeforeStep6: async () => 'https://oauth.example/latest',
    reuseOrCreateTab: async () => {},
    sendToContentScriptResilient: async (_sourceName, message) => {
      events.payloads.push(message.payload);
      return {
        step6Outcome: 'success',
        state: 'phone_verification_page',
        loginVerificationRequestedAt: 123456,
      };
    },
    STEP6_MAX_ATTEMPTS: 3,
    throwIfStopped: () => {},
  });

  await executor.executeStep7({
    accountIdentifierType: 'phone',
    accountIdentifier: '66959916439',
    signupPhoneNumber: '66959916439',
    signupPhoneCompletedActivation: {
      activationId: 'signup-done',
      phoneNumber: '66959916439',
      countryId: 52,
      countryLabel: 'Thailand',
    },
    password: 'secret',
  });

  assert.deepStrictEqual(events.payloads, [
    {
      email: '',
      phoneNumber: '66959916439',
      countryId: 52,
      countryLabel: 'Thailand',
      accountIdentifier: '66959916439',
      loginIdentifierType: 'phone',
      password: 'secret',
      visibleStep: 7,
    },
  ]);
  assert.deepStrictEqual(events.completions, [
    {
      step: 'oauth-login',
      payload: {
        loginVerificationRequestedAt: 123456,
        accountIdentifierType: 'phone',
        accountIdentifier: '66959916439',
        signupPhoneNumber: '66959916439',
        signupPhoneCompletedActivation: {
          activationId: 'signup-done',
          phoneNumber: '66959916439',
          countryId: 52,
          countryLabel: 'Thailand',
        },
        signupPhoneActivation: null,
      },
    },
  ]);
});

test('step 7 keeps Plus email login even when phone sms runtime exists', async () => {
  const source = fs.readFileSync('flows/openai/background/steps/oauth-login.js', 'utf8');
  const globalScope = {};
  const api = new Function('self', `${source}; return self.MultiPageBackgroundStep7;`)(globalScope);

  const events = {
    payloads: [],
  };

  const executor = api.createStep7Executor({
    addLog: async () => {},
    completeNodeFromBackground: async () => {},
    getErrorMessage: (error) => error?.message || String(error || ''),
    getLoginAuthStateLabel: (state) => state || 'unknown',
    getState: async () => ({
      plusModeEnabled: true,
      signupMethod: 'phone',
      email: 'plus.user@example.com',
      password: 'secret',
      signupPhoneNumber: '+441111111111',
    }),
    isStep6RecoverableResult: (result) => result?.step6Outcome === 'recoverable',
    isStep6SuccessResult: (result) => result?.step6Outcome === 'success',
    refreshOAuthUrlBeforeStep6: async () => 'https://oauth.example/latest',
    reuseOrCreateTab: async () => {},
    sendToContentScriptResilient: async (_sourceName, message) => {
      events.payloads.push(message.payload);
      return {
        step6Outcome: 'success',
        state: 'verification_page',
        loginVerificationRequestedAt: 123456,
      };
    },
    STEP6_MAX_ATTEMPTS: 3,
    throwIfStopped: () => {},
  });

  await executor.executeStep7({
    plusModeEnabled: true,
    signupMethod: 'phone',
    email: 'plus.user@example.com',
    password: 'secret',
    signupPhoneNumber: '+441111111111',
    visibleStep: 10,
  });

  assert.equal(events.payloads[0].loginIdentifierType, 'email');
  assert.equal(events.payloads[0].email, 'plus.user@example.com');
  assert.equal(events.payloads[0].phoneNumber, '');
  assert.equal(events.payloads[0].accountIdentifier, 'plus.user@example.com');
});

test('step 7 keeps relogin-bound-email as the active node id', async () => {
  const source = fs.readFileSync('flows/openai/background/steps/oauth-login.js', 'utf8');
  const globalScope = {};
  const api = new Function('self', `${source}; return self.MultiPageBackgroundStep7;`)(globalScope);

  const events = {
    completions: [],
    messages: [],
  };

  const executor = api.createStep7Executor({
    addLog: async () => {},
    completeNodeFromBackground: async (step, payload) => {
      events.completions.push({ step, payload });
    },
    getErrorMessage: (error) => error?.message || String(error || ''),
    getLoginAuthStateLabel: (state) => state || 'unknown',
    getState: async () => ({
      email: 'bound.user@example.com',
      password: 'secret',
      plusModeEnabled: true,
      signupMethod: 'phone',
      phoneSignupReloginAfterBindEmailEnabled: true,
    }),
    isStep6RecoverableResult: (result) => result?.step6Outcome === 'recoverable',
    isStep6SuccessResult: (result) => result?.step6Outcome === 'success',
    refreshOAuthUrlBeforeStep6: async () => 'https://oauth.example/relogin',
    reuseOrCreateTab: async () => {},
    sendToContentScriptResilient: async (_sourceName, message) => {
      events.messages.push(message);
      return {
        step6Outcome: 'success',
        state: 'verification_page',
        loginVerificationRequestedAt: 223344,
      };
    },
    STEP6_MAX_ATTEMPTS: 3,
    throwIfStopped: () => {},
  });

  await executor.executeStep7({
    nodeId: 'relogin-bound-email',
    visibleStep: 14,
    forceLoginIdentifierType: 'email',
    forceEmailLogin: true,
    signupMethod: 'email',
    resolvedSignupMethod: 'email',
    accountIdentifierType: 'email',
    accountIdentifier: 'bound.user@example.com',
    email: 'bound.user@example.com',
    password: 'secret',
  });

  assert.equal(events.messages.length, 1);
  assert.equal(events.messages[0].nodeId, 'relogin-bound-email');
  assert.equal(events.messages[0].payload.visibleStep, 14);
  assert.deepStrictEqual(events.completions, [
    {
      step: 'relogin-bound-email',
      payload: {
        loginVerificationRequestedAt: 223344,
      },
    },
  ]);
});

test('step 7 keeps phone login after step 8 stores an unbound email for phone signup', async () => {
  const source = fs.readFileSync('flows/openai/background/steps/oauth-login.js', 'utf8');
  const globalScope = {};
  const api = new Function('self', `${source}; return self.MultiPageBackgroundStep7;`)(globalScope);

  const events = {
    payloads: [],
  };

  const phoneSignupState = {
    signupMethod: 'phone',
    resolvedSignupMethod: 'email',
    email: 'bound.step8@example.com',
    accountIdentifierType: 'email',
    accountIdentifier: 'bound.step8@example.com',
    signupPhoneNumber: '66959916439',
    signupPhoneCompletedActivation: {
      activationId: 'signup-done',
      phoneNumber: '66959916439',
      countryId: 52,
      countryLabel: 'Thailand',
    },
    password: 'secret',
  };

  const executor = api.createStep7Executor({
    addLog: async () => {},
    completeNodeFromBackground: async () => {},
    getErrorMessage: (error) => error?.message || String(error || ''),
    getLoginAuthStateLabel: (state) => state || 'unknown',
    getState: async () => ({ ...phoneSignupState }),
    isStep6RecoverableResult: (result) => result?.step6Outcome === 'recoverable',
    isStep6SuccessResult: (result) => result?.step6Outcome === 'success',
    refreshOAuthUrlBeforeStep6: async () => 'https://oauth.example/latest',
    reuseOrCreateTab: async () => {},
    sendToContentScriptResilient: async (_sourceName, message) => {
      events.payloads.push(message.payload);
      return {
        step6Outcome: 'success',
        state: 'phone_verification_page',
        loginVerificationRequestedAt: 123456,
      };
    },
    STEP6_MAX_ATTEMPTS: 3,
    throwIfStopped: () => {},
  });

  await executor.executeStep7(phoneSignupState);

  assert.equal(events.payloads[0].loginIdentifierType, 'phone');
  assert.equal(events.payloads[0].phoneNumber, '66959916439');
  assert.equal(events.payloads[0].email, '');
  assert.equal(events.payloads[0].accountIdentifier, '66959916439');
});

test('step 7 ignores stale email force flags outside bound-email relogin', async () => {
  const source = fs.readFileSync('flows/openai/background/steps/oauth-login.js', 'utf8');
  const globalScope = {};
  const api = new Function('self', `${source}; return self.MultiPageBackgroundStep7;`)(globalScope);

  const events = {
    payloads: [],
  };

  const pollutedPhoneSignupState = {
    nodeId: 'oauth-login',
    authLoginPhase: 'primary-login',
    signupMethod: 'phone',
    resolvedSignupMethod: 'phone',
    forceLoginIdentifierType: 'email',
    forceEmailLogin: true,
    email: 'bound.step8@example.com',
    accountIdentifierType: 'phone',
    accountIdentifier: '66959916439',
    signupPhoneNumber: '66959916439',
    signupPhoneCompletedActivation: {
      activationId: 'signup-done',
      phoneNumber: '66959916439',
      countryId: 52,
      countryLabel: 'Thailand',
    },
    password: 'secret',
  };

  const executor = api.createStep7Executor({
    addLog: async () => {},
    completeNodeFromBackground: async () => {},
    getErrorMessage: (error) => error?.message || String(error || ''),
    getLoginAuthStateLabel: (state) => state || 'unknown',
    getState: async () => ({ ...pollutedPhoneSignupState }),
    isStep6RecoverableResult: (result) => result?.step6Outcome === 'recoverable',
    isStep6SuccessResult: (result) => result?.step6Outcome === 'success',
    refreshOAuthUrlBeforeStep6: async () => 'https://oauth.example/latest',
    reuseOrCreateTab: async () => {},
    sendToContentScriptResilient: async (_sourceName, message) => {
      events.payloads.push(message.payload);
      return {
        step6Outcome: 'success',
        state: 'phone_verification_page',
        loginVerificationRequestedAt: 123456,
      };
    },
    STEP6_MAX_ATTEMPTS: 3,
    throwIfStopped: () => {},
  });

  await executor.executeStep7(pollutedPhoneSignupState);

  assert.equal(events.payloads[0].loginIdentifierType, 'phone');
  assert.equal(events.payloads[0].phoneNumber, '66959916439');
  assert.equal(events.payloads[0].email, '');
  assert.equal(events.payloads[0].accountIdentifier, '66959916439');
});

test('step 7 can infer phone login from an available phone signup configuration before step 2 finishes', async () => {
  const source = fs.readFileSync('flows/openai/background/steps/oauth-login.js', 'utf8');
  const globalScope = {};
  const api = new Function('self', `${source}; return self.MultiPageBackgroundStep7;`)(globalScope);

  const events = {
    payloads: [],
  };

  const executor = api.createStep7Executor({
    addLog: async () => {},
    completeNodeFromBackground: async () => {},
    getErrorMessage: (error) => error?.message || String(error || ''),
    getLoginAuthStateLabel: (state) => state || 'unknown',
    getState: async () => ({
      signupMethod: 'phone',
      signupPhoneNumber: '+447780579093',
    }),
    isStep6RecoverableResult: (result) => result?.step6Outcome === 'recoverable',
    isStep6SuccessResult: (result) => result?.step6Outcome === 'success',
    refreshOAuthUrlBeforeStep6: async () => 'https://oauth.example/latest',
    reuseOrCreateTab: async () => {},
    sendToContentScriptResilient: async (_sourceName, message) => {
      events.payloads.push(message.payload);
      return {
        step6Outcome: 'success',
        state: 'phone_verification_page',
        loginVerificationRequestedAt: 987654,
      };
    },
    STEP6_MAX_ATTEMPTS: 3,
    throwIfStopped: () => {},
  });

  await executor.executeStep7({
    signupMethod: 'phone',
    signupPhoneNumber: '+447780579093',
  });

  assert.equal(events.payloads[0].loginIdentifierType, 'phone');
  assert.equal(events.payloads[0].phoneNumber, '+447780579093');
  assert.equal(events.payloads[0].email, '');
});

test('step 7 can start from a manually filled signup phone without completed step 2 or step 3 state', async () => {
  const source = fs.readFileSync('flows/openai/background/steps/oauth-login.js', 'utf8');
  const globalScope = {};
  const api = new Function('self', `${source}; return self.MultiPageBackgroundStep7;`)(globalScope);

  const events = {
    payloads: [],
    completions: [],
  };

  const executor = api.createStep7Executor({
    addLog: async () => {},
    completeNodeFromBackground: async (step, payload) => {
      events.completions.push({ step, payload });
    },
    getErrorMessage: (error) => error?.message || String(error || ''),
    getLoginAuthStateLabel: (state) => state || 'unknown',
    getState: async () => ({
      accountIdentifierType: 'phone',
      accountIdentifier: '+447780579093',
      signupPhoneNumber: '+447780579093',
      stepStatuses: { 2: 'pending', 3: 'pending' },
    }),
    isStep6RecoverableResult: (result) => result?.step6Outcome === 'recoverable',
    isStep6SuccessResult: (result) => result?.step6Outcome === 'success',
    refreshOAuthUrlBeforeStep6: async () => 'https://oauth.example/latest',
    reuseOrCreateTab: async () => {},
    sendToContentScriptResilient: async (_sourceName, message) => {
      events.payloads.push(message.payload);
      return {
        step6Outcome: 'success',
        state: 'phone_verification_page',
        loginVerificationRequestedAt: 987654,
      };
    },
    STEP6_MAX_ATTEMPTS: 3,
    throwIfStopped: () => {},
  });

  await executor.executeStep7({
    accountIdentifierType: 'phone',
    accountIdentifier: '+447780579093',
    signupPhoneNumber: '+447780579093',
    stepStatuses: { 2: 'pending', 3: 'pending' },
  });

  assert.equal(events.payloads[0].loginIdentifierType, 'phone');
  assert.equal(events.payloads[0].phoneNumber, '+447780579093');
  assert.equal(events.payloads[0].email, '');
  assert.equal(events.payloads[0].password, '');
  assert.deepStrictEqual(events.completions, [
    {
      step: 'oauth-login',
      payload: {
        loginVerificationRequestedAt: 987654,
        accountIdentifierType: 'phone',
        accountIdentifier: '+447780579093',
        signupPhoneNumber: '+447780579093',
        signupPhoneCompletedActivation: null,
        signupPhoneActivation: null,
      },
    },
  ]);
});

test('step 7 stops immediately when management secret is missing', async () => {
  const source = fs.readFileSync('flows/openai/background/steps/oauth-login.js', 'utf8');
  const globalScope = {};
  const api = new Function('self', `${source}; return self.MultiPageBackgroundStep7;`)(globalScope);

  const events = {
    refreshCalls: 0,
    sendCalls: 0,
    logs: [],
  };

  const executor = api.createStep7Executor({
    addLog: async (message, level = 'info') => {
      events.logs.push({ message, level });
    },
    completeNodeFromBackground: async () => {},
    getErrorMessage: (error) => error?.message || String(error || ''),
    getLoginAuthStateLabel: (state) => state || 'unknown',
    getState: async () => ({ email: 'user@example.com', password: 'secret' }),
    isStep6RecoverableResult: (result) => result?.step6Outcome === 'recoverable',
    isStep6SuccessResult: (result) => result?.step6Outcome === 'success',
    refreshOAuthUrlBeforeStep6: async () => {
      events.refreshCalls += 1;
      throw new Error('尚未配置 Codex2API 管理密钥，请先在侧边栏填写。');
    },
    reuseOrCreateTab: async () => {},
    sendToContentScriptResilient: async () => {
      events.sendCalls += 1;
      return { step6Outcome: 'success' };
    },
    STEP6_MAX_ATTEMPTS: 3,
    throwIfStopped: () => {},
  });

  await assert.rejects(
    () => executor.executeStep7({ email: 'user@example.com', password: 'secret' }),
    /管理密钥/
  );

  assert.equal(events.refreshCalls, 1);
  assert.equal(events.sendCalls, 0);
  assert.ok(events.logs.some(({ message }) => /管理密钥缺失或错误，不再重试，当前流程停止/.test(message)));
  assert.ok(!events.logs.some(({ message }) => /准备重试/.test(message)));
});

test('step 7 stops immediately when management secret is invalid', async () => {
  const source = fs.readFileSync('flows/openai/background/steps/oauth-login.js', 'utf8');
  const globalScope = {};
  const api = new Function('self', `${source}; return self.MultiPageBackgroundStep7;`)(globalScope);

  const events = {
    refreshCalls: 0,
    logs: [],
  };

  const executor = api.createStep7Executor({
    addLog: async (message, level = 'info') => {
      events.logs.push({ message, level });
    },
    completeNodeFromBackground: async () => {},
    getErrorMessage: (error) => error?.message || String(error || ''),
    getLoginAuthStateLabel: (state) => state || 'unknown',
    getState: async () => ({ email: 'user@example.com', password: 'secret' }),
    isStep6RecoverableResult: (result) => result?.step6Outcome === 'recoverable',
    isStep6SuccessResult: (result) => result?.step6Outcome === 'success',
    refreshOAuthUrlBeforeStep6: async () => {
      events.refreshCalls += 1;
      throw new Error('Codex2API 请求失败（HTTP 401）。X-Admin-Key 无效或未授权。');
    },
    reuseOrCreateTab: async () => {},
    sendToContentScriptResilient: async () => ({ step6Outcome: 'success' }),
    STEP6_MAX_ATTEMPTS: 3,
    throwIfStopped: () => {},
  });

  await assert.rejects(
    () => executor.executeStep7({ email: 'user@example.com', password: 'secret' }),
    /401|未授权|无效/
  );

  assert.equal(events.refreshCalls, 1);
  assert.ok(events.logs.some(({ message }) => /管理密钥缺失或错误，不再重试，当前流程停止/.test(message)));
  assert.ok(!events.logs.some(({ message }) => /准备重试/.test(message)));
});
