(function attachStepDefinitions(root, factory) {
  root.MultiPageStepDefinitions = factory();
})(typeof self !== 'undefined' ? self : globalThis, function createStepDefinitionsModule() {
  const DEFAULT_ACTIVE_FLOW_ID = 'openai';
  const PLUS_PAYMENT_METHOD_PAYPAL = 'paypal';
  const PLUS_PAYMENT_METHOD_GOPAY = 'gopay';
  const PLUS_PAYMENT_METHOD_GPC_HELPER = 'gpc-helper';
  const PLUS_ACCOUNT_ACCESS_STRATEGY_OAUTH = 'oauth';
  const PLUS_ACCOUNT_ACCESS_STRATEGY_SUB2API_CODEX_SESSION = 'sub2api_codex_session';
  const PLUS_ACCOUNT_ACCESS_STRATEGY_CPA_CODEX_SESSION = 'cpa_codex_session';
  const PLUS_PAYMENT_STEP_KEY = 'paypal-approve';
  const SIGNUP_METHOD_EMAIL = 'email';
  const SIGNUP_METHOD_PHONE = 'phone';

  const NORMAL_PREFIX_STEP_DEFINITIONS = [
    { id: 1, order: 10, key: 'open-chatgpt', title: '打开 ChatGPT 官网', sourceId: 'chatgpt', driverId: null, command: 'open-chatgpt' },
    { id: 2, order: 20, key: 'submit-signup-email', title: '注册并输入邮箱', sourceId: 'openai-auth', driverId: 'content/signup-page', command: 'submit-signup-email' },
    { id: 3, order: 30, key: 'fill-password', title: '填写密码并继续', sourceId: 'openai-auth', driverId: 'content/signup-page', command: 'fill-password' },
    { id: 4, order: 40, key: 'fetch-signup-code', title: '获取注册验证码', sourceId: 'openai-auth', driverId: 'content/signup-page', command: 'submit-verification-code', mailRuleId: 'openai-signup-code' },
    { id: 5, order: 50, key: 'fill-profile', title: '填写姓名和生日', sourceId: 'openai-auth', driverId: 'content/signup-page', command: 'fill-profile' },
    { id: 6, order: 60, key: 'wait-registration-success', title: '等待注册成功', sourceId: 'chatgpt', driverId: null, command: 'wait-registration-success' },
  ];

  const PLUS_PAYPAL_PREFIX_STEP_DEFINITIONS = [
    { id: 1, order: 10, key: 'open-chatgpt', title: '打开 ChatGPT 官网', sourceId: 'chatgpt', driverId: null, command: 'open-chatgpt' },
    { id: 2, order: 20, key: 'submit-signup-email', title: '注册并输入邮箱', sourceId: 'openai-auth', driverId: 'content/signup-page', command: 'submit-signup-email' },
    { id: 3, order: 30, key: 'fill-password', title: '填写密码并继续', sourceId: 'openai-auth', driverId: 'content/signup-page', command: 'fill-password' },
    { id: 4, order: 40, key: 'fetch-signup-code', title: '获取注册验证码', sourceId: 'openai-auth', driverId: 'content/signup-page', command: 'submit-verification-code', mailRuleId: 'openai-signup-code' },
    { id: 5, order: 50, key: 'fill-profile', title: '填写姓名和生日', sourceId: 'openai-auth', driverId: 'content/signup-page', command: 'fill-profile' },
    { id: 6, order: 60, key: 'plus-checkout-create', title: '创建 Plus Checkout', sourceId: 'plus-checkout', driverId: 'content/plus-checkout', command: 'plus-checkout-create' },
    { id: 7, order: 70, key: 'plus-checkout-billing', title: '填写账单并提交订单', sourceId: 'plus-checkout', driverId: 'content/plus-checkout', command: 'plus-checkout-billing' },
    { id: 8, order: 80, key: 'paypal-approve', title: 'PayPal 登录与授权', sourceId: 'paypal-flow', driverId: 'content/paypal-flow', command: 'paypal-approve' },
    { id: 9, order: 90, key: 'plus-checkout-return', title: '订阅回跳确认', sourceId: 'plus-checkout', driverId: 'content/plus-checkout', command: 'plus-checkout-return' },
  ];

  const PLUS_GOPAY_PREFIX_STEP_DEFINITIONS = [
    { id: 1, order: 10, key: 'open-chatgpt', title: '打开 ChatGPT 官网', sourceId: 'chatgpt', driverId: null, command: 'open-chatgpt' },
    { id: 2, order: 20, key: 'submit-signup-email', title: '注册并输入邮箱', sourceId: 'openai-auth', driverId: 'content/signup-page', command: 'submit-signup-email' },
    { id: 3, order: 30, key: 'fill-password', title: '填写密码并继续', sourceId: 'openai-auth', driverId: 'content/signup-page', command: 'fill-password' },
    { id: 4, order: 40, key: 'fetch-signup-code', title: '获取注册验证码', sourceId: 'openai-auth', driverId: 'content/signup-page', command: 'submit-verification-code', mailRuleId: 'openai-signup-code' },
    { id: 5, order: 50, key: 'fill-profile', title: '填写姓名和生日', sourceId: 'openai-auth', driverId: 'content/signup-page', command: 'fill-profile' },
    { id: 6, order: 60, key: 'plus-checkout-create', title: '打开 GoPay 订阅页', sourceId: 'plus-checkout', driverId: 'content/plus-checkout', command: 'plus-checkout-create' },
    { id: 7, order: 70, key: 'gopay-subscription-confirm', title: '等待 GoPay 订阅确认', sourceId: 'gopay-flow', driverId: 'content/gopay-flow', command: 'gopay-subscription-confirm' },
  ];

  const PLUS_GPC_PREFIX_STEP_DEFINITIONS = [
    { id: 1, order: 10, key: 'open-chatgpt', title: '打开 ChatGPT 官网', sourceId: 'chatgpt', driverId: null, command: 'open-chatgpt' },
    { id: 2, order: 20, key: 'submit-signup-email', title: '注册并输入邮箱', sourceId: 'openai-auth', driverId: 'content/signup-page', command: 'submit-signup-email' },
    { id: 3, order: 30, key: 'fill-password', title: '填写密码并继续', sourceId: 'openai-auth', driverId: 'content/signup-page', command: 'fill-password' },
    { id: 4, order: 40, key: 'fetch-signup-code', title: '获取注册验证码', sourceId: 'openai-auth', driverId: 'content/signup-page', command: 'submit-verification-code', mailRuleId: 'openai-signup-code' },
    { id: 5, order: 50, key: 'fill-profile', title: '填写姓名和生日', sourceId: 'openai-auth', driverId: 'content/signup-page', command: 'fill-profile' },
    { id: 6, order: 60, key: 'plus-checkout-create', title: '创建 GPC 订单', sourceId: 'plus-checkout', driverId: 'content/plus-checkout', command: 'plus-checkout-create' },
    { id: 7, order: 70, key: 'plus-checkout-billing', title: '等待 GPC 任务完成', sourceId: 'plus-checkout', driverId: 'content/plus-checkout', command: 'plus-checkout-billing' },
  ];

  function isPhoneSignupReloginAfterBindEmailEnabled(options = {}) {
    return Boolean(options?.phoneSignupReloginAfterBindEmailEnabled);
  }

  function createOpenAiAuthTail(startId, startOrder, signupMethod = SIGNUP_METHOD_EMAIL, options = {}) {
    const id = Number(startId) || 7;
    const order = Number(startOrder) || id * 10;
    const commonStart = [
      { id, order, key: 'oauth-login', title: '刷新 OAuth 并登录', sourceId: 'openai-auth', driverId: 'content/signup-page', command: 'oauth-login' },
      { id: id + 1, order: order + 10, key: 'fetch-login-code', title: '获取登录验证码', sourceId: 'openai-auth', driverId: 'content/signup-page', command: 'submit-verification-code', mailRuleId: 'openai-login-code' },
    ];

    if (signupMethod === SIGNUP_METHOD_PHONE) {
      if (isPhoneSignupReloginAfterBindEmailEnabled(options)) {
        return [
          ...commonStart,
          { id: id + 2, order: order + 20, key: 'bind-email', title: '绑定邮箱', sourceId: 'openai-auth', driverId: 'content/signup-page', command: 'bind-email' },
          { id: id + 3, order: order + 30, key: 'fetch-bind-email-code', title: '获取绑定邮箱验证码', sourceId: 'openai-auth', driverId: 'content/signup-page', command: 'fetch-bind-email-code', mailRuleId: 'openai-login-code' },
          { id: id + 4, order: order + 40, key: 'relogin-bound-email', title: '绑定邮箱后刷新 OAuth 并登录（邮箱）', sourceId: 'openai-auth', driverId: 'content/signup-page', command: 'oauth-login' },
          { id: id + 5, order: order + 50, key: 'fetch-bound-email-login-code', title: '获取登录验证码（邮箱）', sourceId: 'openai-auth', driverId: 'content/signup-page', command: 'submit-verification-code', mailRuleId: 'openai-login-code' },
          { id: id + 6, order: order + 60, key: 'post-bound-email-phone-verification', title: '手机号验证', sourceId: 'openai-auth', driverId: 'content/signup-page', command: 'post-login-phone-verification' },
          { id: id + 7, order: order + 70, key: 'confirm-oauth', title: '自动确认 OAuth', sourceId: 'openai-auth', driverId: 'content/signup-page', command: 'confirm-oauth' },
          { id: id + 8, order: order + 80, key: 'platform-verify', title: '平台回调验证', sourceId: 'platform-panel', driverId: 'content/platform-panel', command: 'platform-verify' },
        ];
      }
      return [
        ...commonStart,
        { id: id + 2, order: order + 20, key: 'bind-email', title: '绑定邮箱', sourceId: 'openai-auth', driverId: 'content/signup-page', command: 'bind-email' },
        { id: id + 3, order: order + 30, key: 'fetch-bind-email-code', title: '获取绑定邮箱验证码', sourceId: 'openai-auth', driverId: 'content/signup-page', command: 'fetch-bind-email-code', mailRuleId: 'openai-login-code' },
        { id: id + 4, order: order + 40, key: 'confirm-oauth', title: '自动确认 OAuth', sourceId: 'openai-auth', driverId: 'content/signup-page', command: 'confirm-oauth' },
        { id: id + 5, order: order + 50, key: 'platform-verify', title: '平台回调验证', sourceId: 'platform-panel', driverId: 'content/platform-panel', command: 'platform-verify' },
      ];
    }

    return [
      ...commonStart,
      { id: id + 2, order: order + 20, key: 'post-login-phone-verification', title: '手机号验证', sourceId: 'openai-auth', driverId: 'content/signup-page', command: 'post-login-phone-verification' },
      { id: id + 3, order: order + 30, key: 'confirm-oauth', title: '自动确认 OAuth', sourceId: 'openai-auth', driverId: 'content/signup-page', command: 'confirm-oauth' },
      { id: id + 4, order: order + 40, key: 'platform-verify', title: '平台回调验证', sourceId: 'platform-panel', driverId: 'content/platform-panel', command: 'platform-verify' },
    ];
  }

  function createSub2ApiSessionImportTail(startId, startOrder) {
    const id = Number(startId) || 10;
    const order = Number(startOrder) || id * 10;
    return [
      {
        id,
        order,
        key: 'sub2api-session-import',
        title: '导入当前 ChatGPT 会话到 SUB2API',
        sourceId: 'sub2api-panel',
        driverId: 'background/sub2api-session-import',
        command: 'sub2api-session-import',
      },
    ];
  }

  function createCpaSessionImportTail(startId, startOrder) {
    const id = Number(startId) || 10;
    const order = Number(startOrder) || id * 10;
    return [
      {
        id,
        order,
        key: 'cpa-session-import',
        title: '导入当前 ChatGPT 会话到 CPA',
        sourceId: 'vps-panel',
        driverId: 'background/cpa-session-import',
        command: 'cpa-session-import',
      },
    ];
  }

  function normalizePlusAccountAccessStrategy(value = '') {
    const normalized = String(value || '').trim().toLowerCase();
    if (normalized === PLUS_ACCOUNT_ACCESS_STRATEGY_SUB2API_CODEX_SESSION) {
      return PLUS_ACCOUNT_ACCESS_STRATEGY_SUB2API_CODEX_SESSION;
    }
    if (normalized === PLUS_ACCOUNT_ACCESS_STRATEGY_CPA_CODEX_SESSION) {
      return PLUS_ACCOUNT_ACCESS_STRATEGY_CPA_CODEX_SESSION;
    }
    return PLUS_ACCOUNT_ACCESS_STRATEGY_OAUTH;
  }

  function resolvePlusSessionImportTail(options = {}, signupMethod = SIGNUP_METHOD_EMAIL) {
    if (signupMethod !== SIGNUP_METHOD_EMAIL) {
      return null;
    }
    const strategy = normalizePlusAccountAccessStrategy(options?.plusAccountAccessStrategy);
    if (strategy === PLUS_ACCOUNT_ACCESS_STRATEGY_SUB2API_CODEX_SESSION) {
      return createSub2ApiSessionImportTail;
    }
    if (strategy === PLUS_ACCOUNT_ACCESS_STRATEGY_CPA_CODEX_SESSION) {
      return createCpaSessionImportTail;
    }
    return null;
  }

  function createOpenAiSteps(prefixSteps, startId, startOrder, signupMethod = SIGNUP_METHOD_EMAIL, options = {}) {
    const sessionTailFactory = resolvePlusSessionImportTail(options, signupMethod);
    const tailSteps = sessionTailFactory
      ? sessionTailFactory(startId, startOrder)
      : createOpenAiAuthTail(startId, startOrder, signupMethod, options);
    return [
      ...prefixSteps,
      ...tailSteps,
    ];
  }

  const NORMAL_STEP_DEFINITIONS = createOpenAiSteps(NORMAL_PREFIX_STEP_DEFINITIONS, 7, 70, SIGNUP_METHOD_EMAIL);
  const NORMAL_PHONE_STEP_DEFINITIONS = createOpenAiSteps(NORMAL_PREFIX_STEP_DEFINITIONS, 7, 70, SIGNUP_METHOD_PHONE);
  const NORMAL_PHONE_BOUND_EMAIL_RELOGIN_STEP_DEFINITIONS = createOpenAiSteps(NORMAL_PREFIX_STEP_DEFINITIONS, 7, 70, SIGNUP_METHOD_PHONE, { phoneSignupReloginAfterBindEmailEnabled: true });
  const PLUS_PAYPAL_STEP_DEFINITIONS = createOpenAiSteps(PLUS_PAYPAL_PREFIX_STEP_DEFINITIONS, 10, 100, SIGNUP_METHOD_EMAIL);
  const PLUS_PAYPAL_SUB2API_SESSION_STEP_DEFINITIONS = createOpenAiSteps(
    PLUS_PAYPAL_PREFIX_STEP_DEFINITIONS,
    10,
    100,
    SIGNUP_METHOD_EMAIL,
    { plusAccountAccessStrategy: PLUS_ACCOUNT_ACCESS_STRATEGY_SUB2API_CODEX_SESSION }
  );
  const PLUS_PAYPAL_CPA_SESSION_STEP_DEFINITIONS = createOpenAiSteps(
    PLUS_PAYPAL_PREFIX_STEP_DEFINITIONS,
    10,
    100,
    SIGNUP_METHOD_EMAIL,
    { plusAccountAccessStrategy: PLUS_ACCOUNT_ACCESS_STRATEGY_CPA_CODEX_SESSION }
  );
  const PLUS_PAYPAL_PHONE_STEP_DEFINITIONS = createOpenAiSteps(PLUS_PAYPAL_PREFIX_STEP_DEFINITIONS, 10, 100, SIGNUP_METHOD_PHONE);
  const PLUS_PAYPAL_PHONE_BOUND_EMAIL_RELOGIN_STEP_DEFINITIONS = createOpenAiSteps(PLUS_PAYPAL_PREFIX_STEP_DEFINITIONS, 10, 100, SIGNUP_METHOD_PHONE, { phoneSignupReloginAfterBindEmailEnabled: true });
  const PLUS_GOPAY_STEP_DEFINITIONS = createOpenAiSteps(PLUS_GOPAY_PREFIX_STEP_DEFINITIONS, 10, 100, SIGNUP_METHOD_EMAIL);
  const PLUS_GOPAY_SUB2API_SESSION_STEP_DEFINITIONS = createOpenAiSteps(
    PLUS_GOPAY_PREFIX_STEP_DEFINITIONS,
    10,
    100,
    SIGNUP_METHOD_EMAIL,
    { plusAccountAccessStrategy: PLUS_ACCOUNT_ACCESS_STRATEGY_SUB2API_CODEX_SESSION }
  );
  const PLUS_GOPAY_CPA_SESSION_STEP_DEFINITIONS = createOpenAiSteps(
    PLUS_GOPAY_PREFIX_STEP_DEFINITIONS,
    10,
    100,
    SIGNUP_METHOD_EMAIL,
    { plusAccountAccessStrategy: PLUS_ACCOUNT_ACCESS_STRATEGY_CPA_CODEX_SESSION }
  );
  const PLUS_GOPAY_PHONE_STEP_DEFINITIONS = createOpenAiSteps(PLUS_GOPAY_PREFIX_STEP_DEFINITIONS, 10, 100, SIGNUP_METHOD_PHONE);
  const PLUS_GOPAY_PHONE_BOUND_EMAIL_RELOGIN_STEP_DEFINITIONS = createOpenAiSteps(PLUS_GOPAY_PREFIX_STEP_DEFINITIONS, 10, 100, SIGNUP_METHOD_PHONE, { phoneSignupReloginAfterBindEmailEnabled: true });
  const PLUS_GPC_STEP_DEFINITIONS = createOpenAiSteps(PLUS_GPC_PREFIX_STEP_DEFINITIONS, 10, 100, SIGNUP_METHOD_EMAIL);
  const PLUS_GPC_SUB2API_SESSION_STEP_DEFINITIONS = createOpenAiSteps(
    PLUS_GPC_PREFIX_STEP_DEFINITIONS,
    10,
    100,
    SIGNUP_METHOD_EMAIL,
    { plusAccountAccessStrategy: PLUS_ACCOUNT_ACCESS_STRATEGY_SUB2API_CODEX_SESSION }
  );
  const PLUS_GPC_CPA_SESSION_STEP_DEFINITIONS = createOpenAiSteps(
    PLUS_GPC_PREFIX_STEP_DEFINITIONS,
    10,
    100,
    SIGNUP_METHOD_EMAIL,
    { plusAccountAccessStrategy: PLUS_ACCOUNT_ACCESS_STRATEGY_CPA_CODEX_SESSION }
  );
  const PLUS_GPC_PHONE_STEP_DEFINITIONS = createOpenAiSteps(PLUS_GPC_PREFIX_STEP_DEFINITIONS, 10, 100, SIGNUP_METHOD_PHONE);
  const PLUS_GPC_PHONE_BOUND_EMAIL_RELOGIN_STEP_DEFINITIONS = createOpenAiSteps(PLUS_GPC_PREFIX_STEP_DEFINITIONS, 10, 100, SIGNUP_METHOD_PHONE, { phoneSignupReloginAfterBindEmailEnabled: true });
  const KIRO_STEP_DEFINITIONS = [
    {
      id: 1,
      order: 10,
      key: 'kiro-open-register-page',
      title: '打开注册页',
      sourceId: 'kiro-register-page',
      driverId: 'background/kiro-register',
      command: 'kiro-open-register-page',
    },
    {
      id: 2,
      order: 20,
      key: 'kiro-submit-email',
      title: '获取邮箱并继续',
      sourceId: 'kiro-register-page',
      driverId: 'background/kiro-register',
      command: 'kiro-submit-email',
    },
    {
      id: 3,
      order: 30,
      key: 'kiro-submit-name',
      title: '填写姓名并继续',
      sourceId: 'kiro-register-page',
      driverId: 'background/kiro-register',
      command: 'kiro-submit-name',
    },
    {
      id: 4,
      order: 40,
      key: 'kiro-submit-verification-code',
      title: '获取验证码并继续',
      sourceId: 'kiro-register-page',
      driverId: 'background/kiro-register',
      command: 'kiro-submit-verification-code',
    },
    {
      id: 5,
      order: 50,
      key: 'kiro-submit-password',
      title: '设置密码并继续',
      sourceId: 'kiro-register-page',
      driverId: 'background/kiro-register',
      command: 'kiro-submit-password',
    },
    {
      id: 6,
      order: 60,
      key: 'kiro-complete-register-consent',
      title: '完成注册授权',
      sourceId: 'kiro-register-page',
      driverId: 'background/kiro-register',
      command: 'kiro-complete-register-consent',
    },
    {
      id: 7,
      order: 70,
      key: 'kiro-start-desktop-authorize',
      title: '启动桌面授权',
      sourceId: 'kiro-desktop-authorize',
      driverId: 'background/kiro-desktop-authorize',
      command: 'kiro-start-desktop-authorize',
    },
    {
      id: 8,
      order: 80,
      key: 'kiro-complete-desktop-authorize',
      title: '完成桌面授权',
      sourceId: 'kiro-desktop-authorize',
      driverId: 'background/kiro-desktop-authorize',
      command: 'kiro-complete-desktop-authorize',
    },
    {
      id: 9,
      order: 90,
      key: 'kiro-upload-credential',
      title: '上传凭据到 kiro.rs',
      sourceId: 'kiro-rs-admin',
      driverId: 'background/kiro-publisher-kiro-rs',
      command: 'kiro-upload-credential',
    },
  ];

  const PHONE_SIGNUP_TITLE_OVERRIDES = Object.freeze({
    'submit-signup-email': '注册并输入手机号',
    'fetch-signup-code': '获取手机验证码',
  });
  const KIRO_CONTRIBUTION_STEP_TITLE = '贡献上传';

  function isPlusModeEnabled(options = {}) {
    return Boolean(options?.plusModeEnabled || options?.plusMode);
  }

  function normalizePlusPaymentMethod(value = '') {
    const normalized = String(value || '').trim().toLowerCase();
    if (normalized === PLUS_PAYMENT_METHOD_GPC_HELPER) {
      return PLUS_PAYMENT_METHOD_GPC_HELPER;
    }
    return normalized === PLUS_PAYMENT_METHOD_GOPAY ? PLUS_PAYMENT_METHOD_GOPAY : PLUS_PAYMENT_METHOD_PAYPAL;
  }

  function normalizeSignupMethod(value = '') {
    return String(value || '').trim().toLowerCase() === SIGNUP_METHOD_PHONE
      ? SIGNUP_METHOD_PHONE
      : SIGNUP_METHOD_EMAIL;
  }

  function normalizeActiveFlowId(value = '', fallback = DEFAULT_ACTIVE_FLOW_ID) {
    const normalized = String(value || '').trim().toLowerCase();
    if (normalized) {
      return normalized;
    }
    const fallbackValue = String(fallback || '').trim().toLowerCase();
    return fallbackValue || DEFAULT_ACTIVE_FLOW_ID;
  }

  function getResolvedSignupMethod(options = {}) {
    return normalizeSignupMethod(options?.resolvedSignupMethod || options?.signupMethod);
  }

  function getOpenAiModeStepDefinitions(options = {}) {
    const signupMethod = getResolvedSignupMethod(options);
    const reloginAfterBindEmail = signupMethod === SIGNUP_METHOD_PHONE
      && isPhoneSignupReloginAfterBindEmailEnabled(options);
    if (!isPlusModeEnabled(options)) {
      if (signupMethod === SIGNUP_METHOD_PHONE) {
        return reloginAfterBindEmail
          ? NORMAL_PHONE_BOUND_EMAIL_RELOGIN_STEP_DEFINITIONS
          : NORMAL_PHONE_STEP_DEFINITIONS;
      }
      return NORMAL_STEP_DEFINITIONS;
    }
    const paymentMethod = normalizePlusPaymentMethod(options?.plusPaymentMethod || options?.paymentMethod);
    const plusAccountAccessStrategy = normalizePlusAccountAccessStrategy(options?.plusAccountAccessStrategy);
    if (paymentMethod === PLUS_PAYMENT_METHOD_GPC_HELPER) {
      if (signupMethod === SIGNUP_METHOD_PHONE) {
        return reloginAfterBindEmail
          ? PLUS_GPC_PHONE_BOUND_EMAIL_RELOGIN_STEP_DEFINITIONS
          : PLUS_GPC_PHONE_STEP_DEFINITIONS;
      }
      if (plusAccountAccessStrategy === PLUS_ACCOUNT_ACCESS_STRATEGY_SUB2API_CODEX_SESSION) {
        return PLUS_GPC_SUB2API_SESSION_STEP_DEFINITIONS;
      }
      if (plusAccountAccessStrategy === PLUS_ACCOUNT_ACCESS_STRATEGY_CPA_CODEX_SESSION) {
        return PLUS_GPC_CPA_SESSION_STEP_DEFINITIONS;
      }
      return PLUS_GPC_STEP_DEFINITIONS;
    }
    if (paymentMethod === PLUS_PAYMENT_METHOD_GOPAY) {
      if (signupMethod === SIGNUP_METHOD_PHONE) {
        return reloginAfterBindEmail
          ? PLUS_GOPAY_PHONE_BOUND_EMAIL_RELOGIN_STEP_DEFINITIONS
          : PLUS_GOPAY_PHONE_STEP_DEFINITIONS;
      }
      if (plusAccountAccessStrategy === PLUS_ACCOUNT_ACCESS_STRATEGY_SUB2API_CODEX_SESSION) {
        return PLUS_GOPAY_SUB2API_SESSION_STEP_DEFINITIONS;
      }
      if (plusAccountAccessStrategy === PLUS_ACCOUNT_ACCESS_STRATEGY_CPA_CODEX_SESSION) {
        return PLUS_GOPAY_CPA_SESSION_STEP_DEFINITIONS;
      }
      return PLUS_GOPAY_STEP_DEFINITIONS;
    }
    if (signupMethod === SIGNUP_METHOD_PHONE) {
      return reloginAfterBindEmail
        ? PLUS_PAYPAL_PHONE_BOUND_EMAIL_RELOGIN_STEP_DEFINITIONS
        : PLUS_PAYPAL_PHONE_STEP_DEFINITIONS;
    }
    if (plusAccountAccessStrategy === PLUS_ACCOUNT_ACCESS_STRATEGY_SUB2API_CODEX_SESSION) {
      return PLUS_PAYPAL_SUB2API_SESSION_STEP_DEFINITIONS;
    }
    if (plusAccountAccessStrategy === PLUS_ACCOUNT_ACCESS_STRATEGY_CPA_CODEX_SESSION) {
      return PLUS_PAYPAL_CPA_SESSION_STEP_DEFINITIONS;
    }
    return PLUS_PAYPAL_STEP_DEFINITIONS;
  }

  function getOpenAiPlusPaymentStepTitle(options = {}) {
    if (!isPlusModeEnabled(options)) {
      return '';
    }
    const paymentStep = getOpenAiModeStepDefinitions({
      ...options,
      plusModeEnabled: true,
    }).find((step) => step.key === PLUS_PAYMENT_STEP_KEY);
    return paymentStep?.title || '';
  }

  function getOpenAiResolvedStepTitle(step = {}, options = {}) {
    if (isPlusModeEnabled(options) && step.key === PLUS_PAYMENT_STEP_KEY) {
      return getOpenAiPlusPaymentStepTitle(options) || step.title;
    }
    const signupMethod = getResolvedSignupMethod(options);
    if (signupMethod === SIGNUP_METHOD_PHONE && PHONE_SIGNUP_TITLE_OVERRIDES[step.key]) {
      return PHONE_SIGNUP_TITLE_OVERRIDES[step.key];
    }
    return step.title;
  }

  function isKiroContributionModeEnabled(options = {}) {
    return Boolean(options?.accountContributionEnabled || options?.state?.accountContributionEnabled);
  }

  const FLOW_DEFINITION_BUILDERS = Object.freeze({
    openai: {
      getAllSteps() {
        const keyed = new Map();
        for (const step of [
          ...NORMAL_STEP_DEFINITIONS,
          ...NORMAL_PHONE_STEP_DEFINITIONS,
          ...NORMAL_PHONE_BOUND_EMAIL_RELOGIN_STEP_DEFINITIONS,
          ...PLUS_PAYPAL_STEP_DEFINITIONS,
          ...PLUS_PAYPAL_SUB2API_SESSION_STEP_DEFINITIONS,
          ...PLUS_PAYPAL_CPA_SESSION_STEP_DEFINITIONS,
          ...PLUS_PAYPAL_PHONE_STEP_DEFINITIONS,
          ...PLUS_PAYPAL_PHONE_BOUND_EMAIL_RELOGIN_STEP_DEFINITIONS,
          ...PLUS_GOPAY_STEP_DEFINITIONS,
          ...PLUS_GOPAY_SUB2API_SESSION_STEP_DEFINITIONS,
          ...PLUS_GOPAY_CPA_SESSION_STEP_DEFINITIONS,
          ...PLUS_GOPAY_PHONE_STEP_DEFINITIONS,
          ...PLUS_GOPAY_PHONE_BOUND_EMAIL_RELOGIN_STEP_DEFINITIONS,
          ...PLUS_GPC_STEP_DEFINITIONS,
          ...PLUS_GPC_SUB2API_SESSION_STEP_DEFINITIONS,
          ...PLUS_GPC_CPA_SESSION_STEP_DEFINITIONS,
          ...PLUS_GPC_PHONE_STEP_DEFINITIONS,
          ...PLUS_GPC_PHONE_BOUND_EMAIL_RELOGIN_STEP_DEFINITIONS,
        ]) {
          keyed.set(`${step.id}:${step.key}`, step);
        }
        return Array.from(keyed.values()).sort((left, right) => {
          const leftOrder = Number.isFinite(left.order) ? left.order : left.id;
          const rightOrder = Number.isFinite(right.order) ? right.order : right.id;
          if (leftOrder !== rightOrder) return leftOrder - rightOrder;
          return left.id - right.id;
        });
      },
      getModeStepDefinitions: getOpenAiModeStepDefinitions,
      getPlusPaymentStepTitle: getOpenAiPlusPaymentStepTitle,
      resolveStepTitle: getOpenAiResolvedStepTitle,
    },
    kiro: {
      getAllSteps() {
        return KIRO_STEP_DEFINITIONS;
      },
      getModeStepDefinitions() {
        return KIRO_STEP_DEFINITIONS;
      },
      getPlusPaymentStepTitle() {
        return '';
      },
      resolveStepTitle(step, options = {}) {
        if (step?.key === 'kiro-upload-credential' && isKiroContributionModeEnabled(options)) {
          return KIRO_CONTRIBUTION_STEP_TITLE;
        }
        return step?.title || '';
      },
    },
  });

  function hasFlow(flowId) {
    const normalizedFlowId = normalizeActiveFlowId(flowId, '');
    return Boolean(normalizedFlowId && FLOW_DEFINITION_BUILDERS[normalizedFlowId]);
  }

  function getRegisteredFlowIds() {
    return Object.keys(FLOW_DEFINITION_BUILDERS);
  }

  function getFlowDefinitionBuilder(options = {}) {
    const flowId = normalizeActiveFlowId(options?.activeFlowId, DEFAULT_ACTIVE_FLOW_ID);
    return {
      flowId,
      builder: FLOW_DEFINITION_BUILDERS[flowId] || null,
    };
  }

  function cloneSteps(steps = [], options = {}, flowId = DEFAULT_ACTIVE_FLOW_ID) {
    const { builder } = getFlowDefinitionBuilder({ activeFlowId: flowId });
    return steps.map((step) => ({
      ...step,
      flowId,
      title: builder?.resolveStepTitle ? builder.resolveStepTitle(step, options) : step.title,
    }));
  }

  function cloneNodes(steps = [], options = {}, flowId = DEFAULT_ACTIVE_FLOW_ID) {
    const { builder } = getFlowDefinitionBuilder({ activeFlowId: flowId });
    return steps.map((step) => ({
      nodeId: String(step.key || '').trim(),
      flowId,
      title: builder?.resolveStepTitle ? builder.resolveStepTitle(step, options) : step.title,
      displayOrder: Number.isFinite(Number(step.id)) ? Number(step.id) : Number(step.order),
      nodeType: 'task',
      sourceId: step.sourceId || '',
      driverId: step.driverId || '',
      executeKey: String(step.key || '').trim(),
      command: String(step.command || step.key || '').trim(),
      mailRuleId: String(step.mailRuleId || '').trim(),
      next: Array.isArray(step.next) ? [...step.next] : [],
      retryPolicy: step.retryPolicy && typeof step.retryPolicy === 'object' ? { ...step.retryPolicy } : {},
      recoveryPolicy: step.recoveryPolicy && typeof step.recoveryPolicy === 'object' ? { ...step.recoveryPolicy } : {},
      ui: step.ui && typeof step.ui === 'object' ? { ...step.ui } : {},
    })).filter((node) => Boolean(node.nodeId));
  }

  function getSteps(options = {}) {
    const { flowId, builder } = getFlowDefinitionBuilder(options);
    if (!builder?.getModeStepDefinitions) {
      return [];
    }
    return cloneSteps(builder.getModeStepDefinitions(options), options, flowId);
  }

  function linkLinearNodes(nodes = []) {
    return nodes.map((node, index) => ({
      ...node,
      next: Array.isArray(node.next) && node.next.length
        ? [...node.next]
        : (nodes[index + 1]?.nodeId ? [nodes[index + 1].nodeId] : []),
    }));
  }

  function getNodes(options = {}) {
    const { flowId, builder } = getFlowDefinitionBuilder(options);
    if (!builder?.getModeStepDefinitions) {
      return [];
    }
    return linkLinearNodes(cloneNodes(builder.getModeStepDefinitions(options), options, flowId));
  }

  function getAllSteps(options = {}) {
    const { flowId, builder } = getFlowDefinitionBuilder(options);
    if (!builder?.getAllSteps) {
      return [];
    }
    return cloneSteps(builder.getAllSteps(options), options, flowId);
  }

  function getAllNodes(options = {}) {
    const { flowId, builder } = getFlowDefinitionBuilder(options);
    if (!builder?.getAllSteps) {
      return [];
    }
    return cloneNodes(builder.getAllSteps(options), options, flowId)
      .sort((left, right) => {
        if (left.displayOrder !== right.displayOrder) return left.displayOrder - right.displayOrder;
        return left.nodeId.localeCompare(right.nodeId);
      });
  }

  function getPlusPaymentStepTitle(options = {}) {
    const { builder } = getFlowDefinitionBuilder(options);
    if (!builder?.getPlusPaymentStepTitle) {
      return '';
    }
    return builder.getPlusPaymentStepTitle(options);
  }

  function getStepIds(options = {}) {
    return getSteps(options)
      .map((step) => Number(step.id))
      .filter(Number.isFinite)
      .sort((left, right) => left - right);
  }

  function getNodeIds(options = {}) {
    return getNodes(options).map((node) => node.nodeId);
  }

  function getLastStepId(options = {}) {
    const ids = getStepIds(options);
    return ids[ids.length - 1] || 0;
  }

  function getStepById(id, options = {}) {
    const numericId = Number(id);
    const { flowId, builder } = getFlowDefinitionBuilder(options);
    if (!builder?.getModeStepDefinitions) {
      return null;
    }
    const match = builder.getModeStepDefinitions(options).find((step) => step.id === numericId);
    return match ? cloneSteps([match], options, flowId)[0] : null;
  }

  function getNodeById(nodeId, options = {}) {
    const normalizedNodeId = String(nodeId || '').trim();
    if (!normalizedNodeId) {
      return null;
    }
    return getNodes(options).find((node) => node.nodeId === normalizedNodeId) || null;
  }

  function getNodeByDisplayOrder(displayOrder, options = {}) {
    const normalizedOrder = Number(displayOrder);
    if (!Number.isFinite(normalizedOrder)) {
      return null;
    }
    return getNodes(options).find((node) => node.displayOrder === normalizedOrder) || null;
  }

  function getWorkflow(options = {}) {
    const flowId = normalizeActiveFlowId(options?.activeFlowId, DEFAULT_ACTIVE_FLOW_ID);
    const nodes = getNodes(options);
    return {
      flowId,
      workflowVersion: 1,
      nodes,
      nodeIds: nodes.map((node) => node.nodeId),
    };
  }

  return {
    DEFAULT_ACTIVE_FLOW_ID,
    STEP_DEFINITIONS: NORMAL_STEP_DEFINITIONS,
    NORMAL_STEP_DEFINITIONS,
    NORMAL_PHONE_STEP_DEFINITIONS,
    NORMAL_PHONE_BOUND_EMAIL_RELOGIN_STEP_DEFINITIONS,
    PLUS_STEP_DEFINITIONS: PLUS_PAYPAL_STEP_DEFINITIONS,
    PLUS_PAYPAL_STEP_DEFINITIONS,
    PLUS_PAYPAL_SUB2API_SESSION_STEP_DEFINITIONS,
    PLUS_PAYPAL_PHONE_STEP_DEFINITIONS,
    PLUS_PAYPAL_PHONE_BOUND_EMAIL_RELOGIN_STEP_DEFINITIONS,
    PLUS_GOPAY_STEP_DEFINITIONS,
    PLUS_GOPAY_SUB2API_SESSION_STEP_DEFINITIONS,
    PLUS_GOPAY_PHONE_STEP_DEFINITIONS,
    PLUS_GOPAY_PHONE_BOUND_EMAIL_RELOGIN_STEP_DEFINITIONS,
    PLUS_GPC_STEP_DEFINITIONS,
    PLUS_GPC_SUB2API_SESSION_STEP_DEFINITIONS,
    PLUS_GPC_PHONE_STEP_DEFINITIONS,
    PLUS_GPC_PHONE_BOUND_EMAIL_RELOGIN_STEP_DEFINITIONS,
    SIGNUP_METHOD_EMAIL,
    SIGNUP_METHOD_PHONE,
    getAllSteps,
    getAllNodes,
    getLastStepId,
    getNodeByDisplayOrder,
    getNodeById,
    getNodeIds,
    getNodes,
    getPlusPaymentStepTitle,
    getRegisteredFlowIds,
    getStepById,
    getStepIds,
    getSteps,
    getWorkflow,
    hasFlow,
    isPlusModeEnabled,
    normalizeActiveFlowId,
    normalizePlusPaymentMethod,
    normalizeSignupMethod,
  };
});
