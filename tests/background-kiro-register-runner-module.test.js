const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');

function loadRegisterRunnerApi() {
  const stateSource = fs.readFileSync('flows/kiro/background/state.js', 'utf8');
  const runnerSource = fs.readFileSync('flows/kiro/background/register-runner.js', 'utf8');
  const globalScope = {};
  new Function('self', `${stateSource}; ${runnerSource}; return self;`)(globalScope);
  return globalScope.MultiPageBackgroundKiroRegisterRunner;
}

function getKiroRuntime(state = {}) {
  return state?.runtimeState?.flowState?.kiro || {};
}

test('kiro register runner module exposes a factory and Kiro official sign-in entry', () => {
  const api = loadRegisterRunnerApi();
  assert.equal(typeof api?.createKiroRegisterRunner, 'function');
  assert.equal(api?.KIRO_SIGNIN_URL, 'https://app.kiro.dev/signin');
});

test('kiro register runner removed the old AWS device authorization bootstrap', () => {
  const source = fs.readFileSync('flows/kiro/background/register-runner.js', 'utf8');
  assert.doesNotMatch(source, /startBuilderIdDeviceLogin/);
  assert.doesNotMatch(source, /device_authorization/);
  assert.doesNotMatch(source, /verificationUriComplete/);
  assert.match(source, /https:\/\/app\.kiro\.dev\/signin/);
});

test('kiro register runner uses a shared 3-minute page-load timeout budget', () => {
  const source = fs.readFileSync('flows/kiro/background/register-runner.js', 'utf8');
  assert.match(source, /DEFAULT_KIRO_PAGE_LOAD_TIMEOUT_MS/);
  assert.match(source, /createTimeoutBudget/);
  assert.match(source, /resolveTimeoutBudget/);
  assert.match(source, /timeoutBudget\.getRemainingMs\(1000\)/);
  assert.match(source, /onRetryableError: buildKiroRetryRecovery\(tabId, \{\s*\.\.\.options,\s*timeoutBudget,/);
});

test('kiro register runner delegates verification mail polling to the shared flow mail service', () => {
  const source = fs.readFileSync('flows/kiro/background/register-runner.js', 'utf8');
  assert.match(source, /pollFlowVerificationCode/);
  assert.doesNotMatch(source, /buildKiroVerificationPollPayload/);
  assert.doesNotMatch(source, /pollHotmailVerificationCode/);
  assert.doesNotMatch(source, /pollLuckmailVerificationCode/);
  assert.doesNotMatch(source, /pollCloudflareTempEmailVerificationCode/);
  assert.doesNotMatch(source, /pollCloudMailVerificationCode/);
  assert.doesNotMatch(source, /pollYydsMailVerificationCode/);
  assert.doesNotMatch(source, /sendToMailContentScriptResilient/);
});

test('kiro register consent step treats Kiro Web signed-in page as completion', () => {
  const source = fs.readFileSync('flows/kiro/background/register-runner.js', 'utf8');
  assert.match(source, /readKiroRegisterPageState\(tabId, \{/);
  assert.match(source, /\['authorization_page', 'success_page', 'kiro_web_signed_in'\]\.includes\(landingResult\?\.state\)/);
  assert.match(source, /landingResult\?\.state === 'authorization_page'/);
  assert.doesNotMatch(source, /landingResult\?\.state !== 'success_page'/);
});

test('kiro register runner uses registration-only page states instead of shared OpenAI names', () => {
  const source = fs.readFileSync('flows/kiro/background/register-runner.js', 'utf8');
  assert.match(source, /KIRO_REGISTER_PAGE_STATES/);
  assert.match(source, /'register_otp_page'/);
  assert.match(source, /'create_password_page'/);
  assert.match(source, /'login_password_page'/);
  assert.match(source, /'login_otp_page'/);
  assert.doesNotMatch(source, /targetStates: \['otp_page'\]/);
  assert.doesNotMatch(source, /targetStates: \['password_page'\]/);
  assert.doesNotMatch(source, /fromStates: \['password_page'\]/);
});

test('kiro register runner fails existing-account login branches during registration', () => {
  const source = fs.readFileSync('flows/kiro/background/register-runner.js', 'utf8');
  assert.match(source, /KIRO_REGISTER_EXISTING_ACCOUNT_STATES/);
  assert.match(source, /assertKiroRegistrationOnlyState\(landingResult, currentState, 2, resolvedEmail\)/);
  assert.match(source, /邮箱.*已进入 AWS Builder ID 登录页/);
  assert.match(source, /Kiro 注册流程只处理新账号注册/);
});

test('kiro submit-email stops immediately when AWS routes the email to login', async () => {
  const api = loadRegisterRunnerApi();
  const currentState = {
    runtimeState: {
      flowState: {
        kiro: {
          session: {
            registerTabId: 101,
          },
          register: {
            loginUrl: 'https://app.kiro.dev/signin',
          },
        },
      },
    },
  };
  const sentMessages = [];
  const statePatches = [];
  let completed = false;
  const runner = api.createKiroRegisterRunner({
    addLog: async () => {},
    chrome: {
      tabs: {
        get: async (tabId) => ({ id: tabId, url: 'https://us-east-1.signin.aws/platform/d/signup' }),
        update: async () => {},
      },
    },
    completeNodeFromBackground: async () => {
      completed = true;
    },
    getState: async () => currentState,
    getTabId: async () => 101,
    isTabAlive: async () => true,
    resolveSignupEmailForFlow: async () => 'existing-user@duck.com',
    sendToContentScriptResilient: async (_sourceId, message) => {
      sentMessages.push(message);
      if (message.type === 'ENSURE_KIRO_PAGE_STATE') {
        return { state: 'email_entry', url: 'https://us-east-1.signin.aws/platform/d/signup' };
      }
      if (message.type === 'EXECUTE_NODE') {
        return { submitted: true, state: 'email_submitted' };
      }
      if (message.type === 'ENSURE_KIRO_STATE_CHANGE') {
        return {
          state: 'login_password_page',
          url: 'https://us-east-1.signin.aws/platform/d/login',
          email: 'existing-user@duck.com',
        };
      }
      return {};
    },
    setState: async (patch) => {
      statePatches.push(patch);
    },
  });

  await assert.rejects(
    () => runner.executeKiroSubmitEmail({ nodeId: 'kiro-submit-email', ...currentState }),
    /existing-user@duck\.com.*已进入 AWS Builder ID 登录页/
  );

  assert.equal(completed, false);
  assert.equal(sentMessages.some((message) => message.type === 'EXECUTE_NODE'), true);
  assert.equal(statePatches.some((patch) => /已进入 AWS Builder ID 登录页/.test(getKiroRuntime(patch).session?.lastError || '')), true);
});

test('kiro submit-email can adopt an already-open registration OTP page without allocating a new mailbox', async () => {
  const api = loadRegisterRunnerApi();
  const currentState = {
    runtimeState: {
      flowState: {
        kiro: {
          session: {
            registerTabId: 102,
          },
          register: {
            loginUrl: 'https://app.kiro.dev/signin',
          },
        },
      },
    },
    email: 'manual-user@duck.com',
  };
  const sentMessages = [];
  let completedPayload = null;
  const runner = api.createKiroRegisterRunner({
    addLog: async () => {},
    chrome: {
      tabs: {
        get: async (tabId) => ({ id: tabId, url: 'https://us-east-1.signin.aws/platform/d/signup' }),
        update: async () => {},
      },
    },
    completeNodeFromBackground: async (_nodeId, payload) => {
      completedPayload = payload;
    },
    getState: async () => currentState,
    getTabId: async () => 102,
    isTabAlive: async () => true,
    sendToContentScriptResilient: async (_sourceId, message) => {
      sentMessages.push(message);
      assert.equal(message.type, 'ENSURE_KIRO_PAGE_STATE');
      return {
        state: 'register_otp_page',
        url: 'https://us-east-1.signin.aws/platform/d/signup',
        email: 'manual-user@duck.com',
      };
    },
    setState: async () => {},
  });

  await runner.executeKiroSubmitEmail({ nodeId: 'kiro-submit-email', ...currentState });

  assert.equal(getKiroRuntime(completedPayload).register?.email, 'manual-user@duck.com');
  assert.equal(getKiroRuntime(completedPayload).register?.status, 'waiting_otp');
  assert.equal(getKiroRuntime(completedPayload).register?.verificationRequestedAt, 0);
  assert.equal(sentMessages.some((message) => message.type === 'EXECUTE_NODE'), false);
});

test('kiro verification polling uses the registration email field instead of page text', async () => {
  const api = loadRegisterRunnerApi();
  const currentState = {
    email: 'skater-twine-carve@duck.com',
    registrationEmailState: {
      current: 'skater-twine-carve@duck.com',
      previous: 'skater-twine-carve@duck.com',
      source: 'flow',
      updatedAt: Date.now(),
    },
    runtimeState: {
      flowState: {
        kiro: {
          session: {
            registerTabId: 103,
          },
          register: {
            email: 'stale-wrong@duck.comchange',
            loginUrl: 'https://app.kiro.dev/signin',
            verificationRequestedAt: 1000,
          },
        },
      },
    },
  };
  const sentMessages = [];
  const pollPayloads = [];
  let completedPayload = null;
  const runner = api.createKiroRegisterRunner({
    addLog: async () => {},
    chrome: {
      tabs: {
        get: async (tabId) => ({ id: tabId, url: 'https://us-east-1.signin.aws/platform/d/signup' }),
        update: async () => {},
      },
    },
    completeNodeFromBackground: async (_nodeId, payload) => {
      completedPayload = payload;
    },
    getMailConfig: () => ({
      provider: 'cloudflare-temp-email',
      source: 'cloudflare-temp-email',
      label: 'Cloudflare Temp Email',
    }),
    getState: async () => currentState,
    getTabId: async () => 103,
    isTabAlive: async () => true,
    pollFlowVerificationCode: async (options) => {
      pollPayloads.push(options);
      return { code: '123456', emailTimestamp: 2000, mailId: 'mail-1' };
    },
    sendToContentScriptResilient: async (_sourceId, message) => {
      sentMessages.push(message);
      if (message.type === 'ENSURE_KIRO_PAGE_STATE') {
        return {
          state: 'register_otp_page',
          url: 'https://us-east-1.signin.aws/platform/d/signup',
          email: 'skater-twine-carve@duck.comchange',
          accountEmail: 'skater-twine-carve@duck.comchange',
        };
      }
      if (message.type === 'EXECUTE_NODE') {
        return { submitted: true, state: 'verification_submitted' };
      }
      if (message.type === 'ENSURE_KIRO_STATE_CHANGE') {
        return {
          state: 'create_password_page',
          url: 'https://us-east-1.signin.aws/platform/d/signup',
          email: 'skater-twine-carve@duck.comchange',
        };
      }
      return {};
    },
    setState: async () => {},
  });

  await runner.executeKiroSubmitVerificationCode({
    nodeId: 'kiro-submit-verification-code',
    ...currentState,
  });

  assert.equal(pollPayloads.length, 1);
  assert.equal(pollPayloads[0].flowId, 'kiro');
  assert.equal(pollPayloads[0].nodeId, 'kiro-submit-verification-code');
  assert.equal(pollPayloads[0].filterAfterTimestamp, 1000);
  assert.equal(pollPayloads[0].state.email, 'skater-twine-carve@duck.com');
  assert.equal(getKiroRuntime(pollPayloads[0].state).register?.email, 'skater-twine-carve@duck.com');
  assert.equal(sentMessages.some((message) => (
    message.type === 'EXECUTE_NODE'
      && message.nodeId === 'kiro-submit-verification-code'
      && message.payload?.code === '123456'
  )), true);
  assert.equal(getKiroRuntime(completedPayload).register?.email, 'skater-twine-carve@duck.com');
});

test('kiro verification step can adopt the active AWS verify-otp page without step 1 runtime', async () => {
  const api = loadRegisterRunnerApi();
  const currentState = {
    email: 'tmp3x58ft2ivc@edu.email.qlhazycoder.tech',
    registrationEmailState: {
      current: 'tmp3x58ft2ivc@edu.email.qlhazycoder.tech',
      previous: 'tmp3x58ft2ivc@edu.email.qlhazycoder.tech',
      source: 'manual',
      updatedAt: Date.now(),
    },
  };
  const sentMessages = [];
  const statePatches = [];
  const registeredTabs = [];
  const pollPayloads = [];
  let completedPayload = null;
  const runner = api.createKiroRegisterRunner({
    addLog: async () => {},
    chrome: {
      tabs: {
        query: async () => [{
          id: 301,
          active: true,
          url: 'https://profile.aws.amazon.com/?workflowID=b4e8f9ff-3d60-40ce-90ec-d2113d951b08#/signup/verify-otp',
        }],
        update: async () => {},
      },
    },
    completeNodeFromBackground: async (_nodeId, payload) => {
      completedPayload = payload;
    },
    getMailConfig: () => ({
      provider: 'cloudflare-temp-email',
      source: 'cloudflare-temp-email',
      label: 'Cloudflare Temp Email',
    }),
    getState: async () => currentState,
    getTabId: async () => null,
    isTabAlive: async () => false,
    pollFlowVerificationCode: async (options) => {
      pollPayloads.push(options);
      return { code: '248680', emailTimestamp: 2000, mailId: 'mail-active' };
    },
    registerTab: async (source, tabId) => {
      registeredTabs.push({ source, tabId });
    },
    sendToContentScriptResilient: async (_sourceId, message) => {
      sentMessages.push(message);
      if (message.type === 'ENSURE_KIRO_PAGE_STATE') {
        return {
          state: 'register_otp_page',
          url: 'https://profile.aws.amazon.com/?workflowID=b4e8f9ff-3d60-40ce-90ec-d2113d951b08#/signup/verify-otp',
          email: 'tmp3x58ft2ivc@edu.email.qlhazycoder.tech',
        };
      }
      if (message.type === 'EXECUTE_NODE') {
        return { submitted: true, state: 'verification_submitted' };
      }
      if (message.type === 'ENSURE_KIRO_STATE_CHANGE') {
        return {
          state: 'create_password_page',
          url: 'https://profile.aws.amazon.com/?workflowID=b4e8f9ff-3d60-40ce-90ec-d2113d951b08#/signup/create-password',
          email: 'tmp3x58ft2ivc@edu.email.qlhazycoder.tech',
        };
      }
      return {};
    },
    setState: async (patch) => {
      statePatches.push(patch);
    },
  });

  await runner.executeKiroSubmitVerificationCode({
    nodeId: 'kiro-submit-verification-code',
    ...currentState,
  });

  assert.deepEqual(registeredTabs, [{ source: 'kiro-register-page', tabId: 301 }]);
  assert.equal(getKiroRuntime(statePatches[0]).session?.registerTabId, 301);
  assert.equal(pollPayloads[0].flowId, 'kiro');
  assert.equal(pollPayloads[0].nodeId, 'kiro-submit-verification-code');
  assert.equal(pollPayloads[0].state.email, 'tmp3x58ft2ivc@edu.email.qlhazycoder.tech');
  assert.equal(getKiroRuntime(pollPayloads[0].state).register?.email, 'tmp3x58ft2ivc@edu.email.qlhazycoder.tech');
  assert.equal(sentMessages.some((message) => (
    message.type === 'EXECUTE_NODE'
      && message.nodeId === 'kiro-submit-verification-code'
      && message.payload?.code === '248680'
  )), true);
  assert.equal(getKiroRuntime(completedPayload).register?.email, 'tmp3x58ft2ivc@edu.email.qlhazycoder.tech');
});

test('kiro verification step reinjects the register driver when only the generic content script responds', async () => {
  const api = loadRegisterRunnerApi();
  const currentState = {
    email: 'tmp3x58ft2ivc@edu.email.qlhazycoder.tech',
    registrationEmailState: {
      current: 'tmp3x58ft2ivc@edu.email.qlhazycoder.tech',
      previous: 'tmp3x58ft2ivc@edu.email.qlhazycoder.tech',
      source: 'manual',
      updatedAt: Date.now(),
    },
    runtimeState: {
      flowState: {
        kiro: {
          session: {
            registerTabId: 302,
          },
        },
      },
    },
  };
  const sentMessages = [];
  const injectedScripts = [];
  const pollPayloads = [];
  let completedPayload = null;
  const runner = api.createKiroRegisterRunner({
    addLog: async () => {},
    chrome: {
      scripting: {
        executeScript: async (payload) => {
          injectedScripts.push(payload);
        },
      },
      tabs: {
        get: async (tabId) => ({
          id: tabId,
          url: 'https://profile.aws.amazon.com/?workflowID=b4e8f9ff-3d60-40ce-90ec-d2113d951b08#/signup/verify-otp',
        }),
        update: async () => {},
      },
    },
    completeNodeFromBackground: async (_nodeId, payload) => {
      completedPayload = payload;
    },
    getMailConfig: () => ({
      provider: 'cloudflare-temp-email',
      source: 'cloudflare-temp-email',
      label: 'Cloudflare Temp Email',
    }),
    getState: async () => currentState,
    getTabId: async () => 302,
    isTabAlive: async () => true,
    KIRO_REGISTER_INJECT_FILES: [
      'content/utils.js',
      'flows/kiro/content/register-page.js',
    ],
    pollFlowVerificationCode: async (options) => {
      pollPayloads.push(options);
      return { code: '248680', emailTimestamp: 2000, mailId: 'mail-reinject' };
    },
    sendToContentScriptResilient: async (_sourceId, message) => {
      sentMessages.push(message);
      const ensureCount = sentMessages.filter((entry) => entry.type === 'ENSURE_KIRO_PAGE_STATE').length;
      if (message.type === 'ENSURE_KIRO_PAGE_STATE' && ensureCount === 1) {
        return undefined;
      }
      if (message.type === 'ENSURE_KIRO_PAGE_STATE') {
        return {
          state: 'register_otp_page',
          url: 'https://profile.aws.amazon.com/?workflowID=b4e8f9ff-3d60-40ce-90ec-d2113d951b08#/signup/verify-otp',
          email: 'tmp3x58ft2ivc@edu.email.qlhazycoder.tech',
        };
      }
      if (message.type === 'EXECUTE_NODE') {
        return { submitted: true, state: 'verification_submitted' };
      }
      if (message.type === 'ENSURE_KIRO_STATE_CHANGE') {
        return {
          state: 'create_password_page',
          url: 'https://profile.aws.amazon.com/?workflowID=b4e8f9ff-3d60-40ce-90ec-d2113d951b08#/signup/create-password',
          email: 'tmp3x58ft2ivc@edu.email.qlhazycoder.tech',
        };
      }
      return {};
    },
    setState: async () => {},
    sleepWithStop: async () => {},
  });

  await runner.executeKiroSubmitVerificationCode({
    nodeId: 'kiro-submit-verification-code',
    ...currentState,
  });

  assert.equal(sentMessages.filter((message) => message.type === 'ENSURE_KIRO_PAGE_STATE').length, 2);
  assert.equal(injectedScripts.length, 2);
  assert.deepEqual(injectedScripts[0].args, ['kiro-register-page']);
  assert.deepEqual(injectedScripts[1].files, [
    'content/utils.js',
    'flows/kiro/content/register-page.js',
  ]);
  assert.equal(pollPayloads[0].flowId, 'kiro');
  assert.equal(pollPayloads[0].nodeId, 'kiro-submit-verification-code');
  assert.equal(pollPayloads[0].state.email, 'tmp3x58ft2ivc@edu.email.qlhazycoder.tech');
  assert.equal(getKiroRuntime(pollPayloads[0].state).register?.email, 'tmp3x58ft2ivc@edu.email.qlhazycoder.tech');
  assert.equal(getKiroRuntime(completedPayload).register?.email, 'tmp3x58ft2ivc@edu.email.qlhazycoder.tech');
});

test('kiro submit-email reuses the step 1 register tab even when the source registry was reset', async () => {
  const api = loadRegisterRunnerApi();
  const currentState = {
    email: 'fresh-user@duck.com',
    runtimeState: {
      flowState: {
        kiro: {
          session: {
            registerTabId: 1770749825,
          },
          register: {
            loginUrl: 'https://app.kiro.dev/signin',
          },
        },
      },
    },
  };
  const events = [];
  const runner = api.createKiroRegisterRunner({
    addLog: async () => {},
    chrome: {
      tabs: {
        get: async (tabId) => {
          events.push({ type: 'get', tabId });
          return {
            id: tabId,
            url: 'https://us-east-1.signin.aws/platform/d-9067642ac7/signup',
          };
        },
        update: async (tabId, payload) => {
          events.push({ type: 'update', tabId, payload });
        },
      },
    },
    completeNodeFromBackground: async () => {},
    getState: async () => currentState,
    getTabId: async () => null,
    isTabAlive: async () => false,
    registerTab: async (source, tabId) => {
      events.push({ type: 'register', source, tabId });
    },
    resolveSignupEmailForFlow: async () => 'fresh-user@duck.com',
    reuseOrCreateTab: async () => {
      events.push({ type: 'reuse-or-create' });
      return 1770749826;
    },
    sendToContentScriptResilient: async (_sourceId, message) => {
      if (message.type === 'ENSURE_KIRO_PAGE_STATE') {
        return {
          state: 'register_otp_page',
          url: 'https://us-east-1.signin.aws/platform/d-9067642ac7/signup',
          email: 'fresh-user@duck.com',
        };
      }
      return {};
    },
    setState: async () => {},
  });

  await runner.executeKiroSubmitEmail({ nodeId: 'kiro-submit-email', ...currentState });

  assert.equal(events.some((event) => event.type === 'reuse-or-create'), false);
  assert.deepEqual(
    events.filter((event) => event.type === 'register'),
    [{ type: 'register', source: 'kiro-register-page', tabId: 1770749825 }]
  );
  assert.ok(events.some((event) => event.type === 'update' && event.tabId === 1770749825));
});
