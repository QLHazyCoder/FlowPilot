const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');

test('step 6 waits for registration success and completes from background', async () => {
  const source = fs.readFileSync('background/steps/wait-registration-success.js', 'utf8');
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
    completeStepFromBackground: async (step) => {
      events.completedSteps.push(step);
    },
    sleepWithStop: async (ms) => {
      events.waits.push(ms);
    },
  });

  await executor.executeStep6();

  assert.deepStrictEqual(events.waits, [20000]);
  assert.deepStrictEqual(events.completedSteps, [6]);
  assert.ok(events.logs.some(({ message }) => /等待 20 秒/.test(message)));
});

test('step 6 only clears cookies when cleanup switch is enabled', async () => {
  const source = fs.readFileSync('background/steps/wait-registration-success.js', 'utf8');
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
    completeStepFromBackground: async (step) => {
      events.completedSteps.push(step);
    },
    sleepWithStop: async () => {},
  });

  await executor.executeStep6({ step6CookieCleanupEnabled: false });

  assert.deepStrictEqual(events.removedCookies, []);
  assert.deepStrictEqual(events.browsingDataCalls, []);

  await executor.executeStep6({ step6CookieCleanupEnabled: true });

  assert.deepStrictEqual(events.completedSteps, [6, 6]);
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
  const source = fs.readFileSync('background/steps/oauth-login.js', 'utf8');
  const globalScope = {};
  const api = new Function('self', `${source}; return self.MultiPageBackgroundStep7;`)(globalScope);

  const events = {
    refreshCalls: 0,
    sendCalls: 0,
    completed: 0,
  };

  const executor = api.createStep7Executor({
    addLog: async () => {},
    completeStepFromBackground: async () => {
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

test('step 7 exits internal retry loop immediately when add-phone is detected', async () => {
  const source = fs.readFileSync('background/steps/oauth-login.js', 'utf8');
  const globalScope = {};
  const api = new Function('self', `${source}; return self.MultiPageBackgroundStep7;`)(globalScope);

  const events = {
    refreshCalls: 0,
    sendCalls: 0,
    completed: 0,
    logs: [],
  };

  const executor = api.createStep7Executor({
    addLog: async (message, level = 'info') => {
      events.logs.push({ message, level });
    },
    completeStepFromBackground: async () => {
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
      throw new Error('提交密码后页面直接进入手机号页面，未经过登录验证码页。URL: https://auth.openai.com/add-phone');
    },
    STEP6_MAX_ATTEMPTS: 3,
    throwIfStopped: () => {},
  });

  await assert.rejects(
    () => executor.executeStep7({ email: 'user@example.com', password: 'secret' }),
    /add-phone/
  );

  assert.equal(events.refreshCalls, 1, 'add-phone should stop further OAuth refresh attempts');
  assert.equal(events.sendCalls, 1, 'add-phone should stop after the first failed login attempt');
  assert.equal(events.completed, 0);
  assert.ok(
    !events.logs.some(({ message }) => /准备重试/.test(message)),
    'add-phone failure should not be logged as an internal retryable attempt'
  );
});

test('step 7 hands direct add-phone to shared phone verification when enabled', async () => {
  const source = fs.readFileSync('background/steps/oauth-login.js', 'utf8');
  const globalScope = {};
  const api = new Function('self', `${source}; return self.MultiPageBackgroundStep7;`)(globalScope);

  const events = {
    refreshCalls: 0,
    phoneCalls: [],
    completions: [],
  };

  const executor = api.createStep7Executor({
    addLog: async () => {},
    completeStepFromBackground: async (step, payload) => {
      events.completions.push({ step, payload });
    },
    getErrorMessage: (error) => error?.message || String(error || ''),
    getLoginAuthStateLabel: (state) => state || 'unknown',
    getState: async () => ({
      email: 'user@example.com',
      password: 'secret',
      phoneVerificationEnabled: true,
    }),
    getTabId: async (sourceName) => (sourceName === 'signup-page' ? 91 : 0),
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
    phoneVerificationEnabled: true,
  });

  assert.equal(events.refreshCalls, 1);
  assert.deepStrictEqual(events.phoneCalls, [
    {
      tabId: 91,
      pageState: {
        addPhonePage: true,
        phoneVerificationPage: false,
        state: 'add_phone_page',
        url: 'https://auth.openai.com/add-phone',
      },
      options: {
        step: 7,
        visibleStep: 7,
      },
    },
  ]);
  assert.deepStrictEqual(events.completions, [
    {
      step: 7,
      payload: {
        loginVerificationRequestedAt: null,
        skipLoginVerificationStep: true,
        directOAuthConsentPage: true,
        phoneVerification: true,
        loginPhoneVerification: true,
      },
    },
  ]);
});

test('step 7 direct add-phone stays fatal when phone verification is disabled', async () => {
  const source = fs.readFileSync('background/steps/oauth-login.js', 'utf8');
  const globalScope = {};
  const api = new Function('self', `${source}; return self.MultiPageBackgroundStep7;`)(globalScope);

  const events = {
    phoneCalls: 0,
    completions: 0,
  };

  const executor = api.createStep7Executor({
    addLog: async () => {},
    completeStepFromBackground: async () => {
      events.completions += 1;
    },
    getErrorMessage: (error) => error?.message || String(error || ''),
    getLoginAuthStateLabel: (state) => state || 'unknown',
    getState: async () => ({ email: 'user@example.com', password: 'secret', phoneVerificationEnabled: false }),
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

  await assert.rejects(
    () => executor.executeStep7({ email: 'user@example.com', password: 'secret', phoneVerificationEnabled: false }),
    /手机号页面.*接码|phone verification/i
  );
  assert.equal(events.phoneCalls, 0);
  assert.equal(events.completions, 0);
});

test('step 7 propagates fatal errors from shared add-phone verification', async () => {
  const source = fs.readFileSync('background/steps/oauth-login.js', 'utf8');
  const globalScope = {};
  const api = new Function('self', `${source}; return self.MultiPageBackgroundStep7;`)(globalScope);

  const events = {
    phoneCalls: 0,
    completions: 0,
  };

  const executor = api.createStep7Executor({
    addLog: async () => {},
    completeStepFromBackground: async () => {
      events.completions += 1;
    },
    getErrorMessage: (error) => error?.message || String(error || ''),
    getLoginAuthStateLabel: (state) => state || 'unknown',
    getState: async () => ({ email: 'user@example.com', password: 'secret', phoneVerificationEnabled: true }),
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

  await assert.rejects(
    () => executor.executeStep7({ email: 'user@example.com', password: 'secret', phoneVerificationEnabled: true }),
    /没有可用手机号/
  );
  assert.equal(events.phoneCalls, 1);
  assert.equal(events.completions, 0);
});

test('step 7 starts a new oauth timeout window for each refreshed oauth url', async () => {
  const source = fs.readFileSync('background/steps/oauth-login.js', 'utf8');
  const globalScope = {};
  const api = new Function('self', `${source}; return self.MultiPageBackgroundStep7;`)(globalScope);

  const events = {
    startedWindows: [],
    timeoutRequests: [],
  };

  const executor = api.createStep7Executor({
    addLog: async () => {},
    completeStepFromBackground: async () => {},
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
  const source = fs.readFileSync('background/steps/oauth-login.js', 'utf8');
  const globalScope = {};
  const api = new Function('self', `${source}; return self.MultiPageBackgroundStep7;`)(globalScope);

  const events = {
    completions: [],
  };

  const executor = api.createStep7Executor({
    addLog: async () => {},
    completeStepFromBackground: async (step, payload) => {
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
      step: 10,
      payload: {
        loginVerificationRequestedAt: null,
        skipLoginVerificationStep: true,
        directOAuthConsentPage: true,
      },
    },
  ]);
});

test('step 7 forwards phone login identity payload when account identifier is phone', async () => {
  const source = fs.readFileSync('background/steps/oauth-login.js', 'utf8');
  const globalScope = {};
  const api = new Function('self', `${source}; return self.MultiPageBackgroundStep7;`)(globalScope);

  const events = {
    payloads: [],
  };

  const executor = api.createStep7Executor({
    addLog: async () => {},
    completeStepFromBackground: async () => {},
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
});

test('step 7 keeps Plus email login even when phone sms runtime exists', async () => {
  const source = fs.readFileSync('background/steps/oauth-login.js', 'utf8');
  const globalScope = {};
  const api = new Function('self', `${source}; return self.MultiPageBackgroundStep7;`)(globalScope);

  const events = {
    payloads: [],
  };

  const executor = api.createStep7Executor({
    addLog: async () => {},
    completeStepFromBackground: async () => {},
    getErrorMessage: (error) => error?.message || String(error || ''),
    getLoginAuthStateLabel: (state) => state || 'unknown',
    getState: async () => ({
      plusModeEnabled: true,
      phoneVerificationEnabled: true,
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
    phoneVerificationEnabled: true,
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

test('step 7 can infer phone login from an available phone signup configuration before step 2 finishes', async () => {
  const source = fs.readFileSync('background/steps/oauth-login.js', 'utf8');
  const globalScope = {};
  const api = new Function('self', `${source}; return self.MultiPageBackgroundStep7;`)(globalScope);

  const events = {
    payloads: [],
  };

  const executor = api.createStep7Executor({
    addLog: async () => {},
    completeStepFromBackground: async () => {},
    getErrorMessage: (error) => error?.message || String(error || ''),
    getLoginAuthStateLabel: (state) => state || 'unknown',
    getState: async () => ({
      phoneVerificationEnabled: true,
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
    phoneVerificationEnabled: true,
    signupMethod: 'phone',
    signupPhoneNumber: '+447780579093',
  });

  assert.equal(events.payloads[0].loginIdentifierType, 'phone');
  assert.equal(events.payloads[0].phoneNumber, '+447780579093');
  assert.equal(events.payloads[0].email, '');
});

test('step 7 can start from a manually filled signup phone without completed step 2 or step 3 state', async () => {
  const source = fs.readFileSync('background/steps/oauth-login.js', 'utf8');
  const globalScope = {};
  const api = new Function('self', `${source}; return self.MultiPageBackgroundStep7;`)(globalScope);

  const events = {
    payloads: [],
    completions: [],
  };

  const executor = api.createStep7Executor({
    addLog: async () => {},
    completeStepFromBackground: async (step, payload) => {
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
      step: 7,
      payload: {
        loginVerificationRequestedAt: 987654,
      },
    },
  ]);
});

test('step 7 stops immediately when management secret is missing', async () => {
  const source = fs.readFileSync('background/steps/oauth-login.js', 'utf8');
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
    completeStepFromBackground: async () => {},
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
  const source = fs.readFileSync('background/steps/oauth-login.js', 'utf8');
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
    completeStepFromBackground: async () => {},
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
