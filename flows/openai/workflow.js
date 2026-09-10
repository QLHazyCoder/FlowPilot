/*
 * @Author: QLHazycoder
 * @Date: 2026-07-22 00:00:00
 * @LastEditors: QLHazycoder
 * @LastEditTime: 2026-09-10 18:50:11
 * @Description: OpenAI registration, payment, and account-delivery workflow composition.
 */
(function attachMultiPageOpenAiWorkflow(root, factory) {
  root.MultiPageOpenAiWorkflow = factory();
})(typeof self !== 'undefined' ? self : globalThis, function createMultiPageOpenAiWorkflow() {
  const SIGNUP_METHOD_EMAIL = 'email';
  const SIGNUP_METHOD_PHONE = 'phone';
  const PLUS_PAYMENT_METHOD_PAYPAL = 'paypal';
  const PLUS_PAYMENT_METHOD_PAYPAL_HOSTED = 'paypal-hosted';
  const PLUS_PAYMENT_METHOD_NONE = 'none';
  const ACCOUNT_DELIVERY_MODE_OAUTH = 'oauth';
  const ACCOUNT_DELIVERY_MODE_SESSION = 'session';
  const ACCOUNT_DELIVERY_MODE_AGENT_IDENTITY = 'agent_identity';
  const OPENAI_TARGET_CPA = 'cpa';
  const OPENAI_TARGET_SUB2API = 'sub2api';
  const OPENAI_TARGET_CODEX2API = 'codex2api';
  const OPENAI_TARGET_WEBCHAT = 'webchat';
  const OPENAI_TARGET_CHATGPT2API = 'chatgpt2api';

  function freezeDeep(entry) {
    if (!entry || typeof entry !== 'object' || Object.isFrozen(entry)) {
      return entry;
    }
    Object.getOwnPropertyNames(entry).forEach((key) => freezeDeep(entry[key]));
    return Object.freeze(entry);
  }

  function createStep(key, title, options = {}) {
    return {
      key,
      title,
      sourceId: options.sourceId || '',
      driverId: options.driverId ?? null,
      command: options.command || key,
      ...(options.mailRuleId ? { mailRuleId: options.mailRuleId } : {}),
      flowId: 'openai',
    };
  }

  const REGISTRATION_STAGE_EMAIL = freezeDeep([
    createStep('open-chatgpt', '打开 ChatGPT 官网', { sourceId: 'chatgpt' }),
    createStep('submit-signup-email', '注册并输入邮箱', {
      sourceId: 'openai-auth',
      driverId: 'flows/openai/content/openai-auth',
    }),
    createStep('fill-password', '填写密码并继续', {
      sourceId: 'openai-auth',
      driverId: 'flows/openai/content/openai-auth',
    }),
    createStep('fetch-signup-code', '获取注册验证码', {
      sourceId: 'openai-auth',
      driverId: 'flows/openai/content/openai-auth',
      command: 'submit-verification-code',
      mailRuleId: 'openai-signup-code',
    }),
    createStep('fill-profile', '填写姓名和生日', {
      sourceId: 'openai-auth',
      driverId: 'flows/openai/content/openai-auth',
    }),
    createStep('wait-registration-success', '等待注册成功', { sourceId: 'chatgpt' }),
  ]);

  const REGISTRATION_STAGE_PHONE = freezeDeep(REGISTRATION_STAGE_EMAIL.map((step) => (
    step.key === 'submit-signup-email'
      ? { ...step, title: '注册并输入手机号' }
      : step.key === 'fetch-signup-code'
        ? { ...step, title: '获取手机验证码' }
        : step
  )));

  const OAUTH_DELIVERY_STAGE_EMAIL = freezeDeep([
    createStep('oauth-login', '刷新 OAuth 并登录', {
      sourceId: 'openai-auth',
      driverId: 'flows/openai/content/openai-auth',
    }),
    createStep('fetch-login-code', '获取登录验证码', {
      sourceId: 'openai-auth',
      driverId: 'flows/openai/content/openai-auth',
      command: 'submit-verification-code',
      mailRuleId: 'openai-login-code',
    }),
    createStep('post-login-phone-verification', '手机号验证', {
      sourceId: 'openai-auth',
      driverId: 'flows/openai/content/openai-auth',
      command: 'post-login-phone-verification',
    }),
    createStep('confirm-oauth', '自动确认 OAuth', {
      sourceId: 'openai-auth',
      driverId: 'flows/openai/content/openai-auth',
    }),
    createStep('platform-verify', '平台回调验证', {
      sourceId: 'platform-panel',
      driverId: 'content/platform-panel',
    }),
  ]);

  const OAUTH_DELIVERY_STAGE_PHONE = freezeDeep([
    createStep('oauth-login', '刷新 OAuth 并登录', {
      sourceId: 'openai-auth',
      driverId: 'flows/openai/content/openai-auth',
    }),
    createStep('fetch-login-code', '获取登录验证码', {
      sourceId: 'openai-auth',
      driverId: 'flows/openai/content/openai-auth',
      command: 'submit-verification-code',
      mailRuleId: 'openai-login-code',
    }),
    createStep('bind-email', '绑定邮箱', {
      sourceId: 'openai-auth',
      driverId: 'flows/openai/content/openai-auth',
    }),
    createStep('fetch-bind-email-code', '获取绑定邮箱验证码', {
      sourceId: 'openai-auth',
      driverId: 'flows/openai/content/openai-auth',
      mailRuleId: 'openai-login-code',
    }),
    createStep('confirm-oauth', '自动确认 OAuth', {
      sourceId: 'openai-auth',
      driverId: 'flows/openai/content/openai-auth',
    }),
    createStep('platform-verify', '平台回调验证', {
      sourceId: 'platform-panel',
      driverId: 'content/platform-panel',
    }),
  ]);

  const OAUTH_DELIVERY_STAGE_PHONE_RELOGIN = freezeDeep([
    ...OAUTH_DELIVERY_STAGE_PHONE.slice(0, 4),
    createStep('relogin-bound-email', '绑定邮箱后刷新 OAuth 并登录（邮箱）', {
      sourceId: 'openai-auth',
      driverId: 'flows/openai/content/openai-auth',
      command: 'oauth-login',
    }),
    createStep('fetch-bound-email-login-code', '获取登录验证码（邮箱）', {
      sourceId: 'openai-auth',
      driverId: 'flows/openai/content/openai-auth',
      command: 'submit-verification-code',
      mailRuleId: 'openai-login-code',
    }),
    createStep('post-bound-email-phone-verification', '手机号验证', {
      sourceId: 'openai-auth',
      driverId: 'flows/openai/content/openai-auth',
      command: 'post-login-phone-verification',
    }),
    ...OAUTH_DELIVERY_STAGE_PHONE.slice(-2),
  ]);

  const PAYMENT_STAGE_PAYPAL = freezeDeep([
    createStep('plus-checkout-create', '创建 Plus Checkout', {
      sourceId: 'plus-checkout',
      driverId: 'flows/openai/content/plus-checkout',
    }),
    createStep('plus-checkout-billing', '填写账单并提交订单', {
      sourceId: 'plus-checkout',
      driverId: 'flows/openai/content/plus-checkout',
    }),
    createStep('paypal-approve', 'PayPal 登录与授权', {
      sourceId: 'paypal-flow',
      driverId: 'flows/openai/content/paypal-flow',
    }),
    createStep('plus-checkout-return', '订阅回跳确认', {
      sourceId: 'plus-checkout',
      driverId: 'flows/openai/content/plus-checkout',
    }),
  ]);

  const PAYMENT_STAGE_HOSTED = freezeDeep([
    createStep('plus-checkout-create', '创建 Plus Checkout', {
      sourceId: 'plus-checkout',
      driverId: 'flows/openai/content/plus-checkout',
    }),
    createStep('paypal-hosted-email', '无卡直绑填写 PayPal 邮箱', {
      sourceId: 'paypal-flow',
      driverId: 'flows/openai/content/paypal-flow',
    }),
    createStep('paypal-hosted-card', '无卡直绑填写 PayPal 资料', {
      sourceId: 'paypal-flow',
      driverId: 'flows/openai/content/paypal-flow',
    }),
    createStep('paypal-hosted-create-account', '无卡直绑确认创建 PayPal', {
      sourceId: 'paypal-flow',
      driverId: 'flows/openai/content/paypal-flow',
    }),
    createStep('paypal-hosted-review', '无卡直绑完成 PayPal 授权', {
      sourceId: 'paypal-flow',
      driverId: 'flows/openai/content/paypal-flow',
    }),
  ]);

  const ACCOUNT_DELIVERY_STAGE_BY_ROUTE = freezeDeep({
    oauth: OAUTH_DELIVERY_STAGE_EMAIL,
    'cpa-session': [createStep('cpa-session-import', '导入 ChatGPT Session 到 CPA', {
      sourceId: 'openai-session',
      driverId: 'flows/openai/background/steps/cpa-session-import',
    })],
    'sub2api-session': [createStep('sub2api-session-import', '导入 ChatGPT Session 到 SUB2API', {
      sourceId: 'openai-session',
      driverId: 'flows/openai/background/steps/sub2api-session-import',
    })],
    'sub2api-agent-identity': [createStep('sub2api-agent-identity-import', '导入 Agent Identity 到 SUB2API', {
      sourceId: 'openai-session',
      driverId: 'flows/openai/background/steps/sub2api-agent-identity-import',
    })],
    'webchat-session': [createStep('openai-upload-session-to-webchat', '上传 ChatGPT 会话到 webchat', {
      sourceId: 'openai-webchat',
      driverId: 'flows/openai/background/publisher-webchat',
    })],
    'chatgpt2api-session': [createStep('openai-upload-session-to-chatgpt2api', '上传 ChatGPT 会话到 ChatGPT2API', {
      sourceId: 'openai-chatgpt2api',
      driverId: 'flows/openai/background/publisher-chatgpt2api',
    })],
  });

  const TARGET_DELIVERY_ROUTES = freezeDeep({
    [OPENAI_TARGET_CPA]: {
      defaultMode: ACCOUNT_DELIVERY_MODE_OAUTH,
      modes: { oauth: 'oauth', session: 'cpa-session' },
    },
    [OPENAI_TARGET_SUB2API]: {
      defaultMode: ACCOUNT_DELIVERY_MODE_OAUTH,
      modes: {
        oauth: 'oauth',
        session: 'sub2api-session',
        agent_identity: 'sub2api-agent-identity',
      },
    },
    [OPENAI_TARGET_CODEX2API]: {
      defaultMode: ACCOUNT_DELIVERY_MODE_OAUTH,
      modes: { oauth: 'oauth' },
    },
    [OPENAI_TARGET_WEBCHAT]: {
      defaultMode: ACCOUNT_DELIVERY_MODE_SESSION,
      modes: { session: 'webchat-session' },
    },
    [OPENAI_TARGET_CHATGPT2API]: {
      defaultMode: ACCOUNT_DELIVERY_MODE_SESSION,
      modes: { session: 'chatgpt2api-session' },
    },
  });

  function cloneSteps(steps = []) {
    return (Array.isArray(steps) ? steps : []).map((step) => ({ ...step }));
  }

  function normalizeSignupMethod(value = '') {
    return String(value || '').trim().toLowerCase() === SIGNUP_METHOD_PHONE
      ? SIGNUP_METHOD_PHONE
      : SIGNUP_METHOD_EMAIL;
  }

  function normalizePlusPaymentMethod(value = '') {
    const normalized = String(value || '').trim().toLowerCase();
    if (normalized === PLUS_PAYMENT_METHOD_NONE) {
      return PLUS_PAYMENT_METHOD_NONE;
    }
    if (normalized === PLUS_PAYMENT_METHOD_PAYPAL_HOSTED) {
      return PLUS_PAYMENT_METHOD_PAYPAL_HOSTED;
    }
    return PLUS_PAYMENT_METHOD_PAYPAL;
  }

  function isPlusModeEnabled(options = {}) {
    return Boolean(options?.plusModeEnabled || options?.plusMode);
  }

  function normalizeTargetId(value = '') {
    const normalized = String(value || '').trim().toLowerCase();
    return TARGET_DELIVERY_ROUTES[normalized] ? normalized : OPENAI_TARGET_CPA;
  }

  function normalizeAccountDeliveryMode(value = '', targetId = OPENAI_TARGET_CPA) {
    const target = TARGET_DELIVERY_ROUTES[normalizeTargetId(targetId)];
    const normalized = String(value || '').trim().toLowerCase();
    return Object.prototype.hasOwnProperty.call(target.modes, normalized)
      ? normalized
      : target.defaultMode;
  }

  function resolveAccountDeliveryRouteId(options = {}) {
    const targetId = normalizeTargetId(options?.targetId);
    const target = TARGET_DELIVERY_ROUTES[targetId];
    const explicitRoute = String(options?.accountDeliveryRouteId || '').trim();
    if (explicitRoute && Object.values(target.modes).includes(explicitRoute)) {
      return explicitRoute;
    }
    const mode = normalizeAccountDeliveryMode(options?.accountDeliveryMode, targetId);
    return target.modes[mode] || target.modes[target.defaultMode];
  }

  function buildRegistrationStage(options = {}) {
    const signupMethod = normalizeSignupMethod(options?.resolvedSignupMethod || options?.signupMethod);
    return signupMethod === SIGNUP_METHOD_PHONE
      ? cloneSteps(REGISTRATION_STAGE_PHONE)
      : cloneSteps(REGISTRATION_STAGE_EMAIL);
  }

  function buildPaymentStage(options = {}) {
    if (!isPlusModeEnabled(options)) {
      return [];
    }
    const paymentMethod = normalizePlusPaymentMethod(options?.plusPaymentMethod || options?.paymentMethod);
    if (paymentMethod === PLUS_PAYMENT_METHOD_NONE) {
      return [];
    }
    return cloneSteps(paymentMethod === PLUS_PAYMENT_METHOD_PAYPAL_HOSTED
      ? PAYMENT_STAGE_HOSTED
      : PAYMENT_STAGE_PAYPAL);
  }

  function buildAccountDeliveryStage(options = {}) {
    const targetId = normalizeTargetId(options?.targetId);
    const routeId = resolveAccountDeliveryRouteId(options);
    const routeSteps = ACCOUNT_DELIVERY_STAGE_BY_ROUTE[routeId];
    if (routeId === 'oauth') {
      const signupMethod = normalizeSignupMethod(options?.resolvedSignupMethod || options?.signupMethod);
      if (signupMethod === SIGNUP_METHOD_PHONE) {
        return cloneSteps(
          options?.phoneSignupReloginAfterBindEmailEnabled
            ? OAUTH_DELIVERY_STAGE_PHONE_RELOGIN
            : OAUTH_DELIVERY_STAGE_PHONE
        );
      }
    }
    if (routeSteps) {
      return cloneSteps(routeSteps);
    }
    const fallbackRoute = TARGET_DELIVERY_ROUTES[targetId].modes[ACCOUNT_DELIVERY_MODE_OAUTH]
      || TARGET_DELIVERY_ROUTES[targetId].modes[TARGET_DELIVERY_ROUTES[targetId].defaultMode];
    return cloneSteps(ACCOUNT_DELIVERY_STAGE_BY_ROUTE[fallbackRoute] || OAUTH_DELIVERY_STAGE_EMAIL);
  }

  function reindexModeStepDefinitions(steps = []) {
    return steps.map((step, index) => ({
      ...step,
      id: index + 1,
      order: (index + 1) * 10,
      flowId: 'openai',
    }));
  }

  function buildModeStepDefinitions(options = {}) {
    const registration = buildRegistrationStage(options);
    const payment = buildPaymentStage(options);
    const delivery = buildAccountDeliveryStage(options);
    const steps = [...registration, ...payment, ...delivery];
    return reindexModeStepDefinitions(steps);
  }

  function getAllSteps() {
    const combinations = [
      { targetId: OPENAI_TARGET_CPA, accountDeliveryMode: ACCOUNT_DELIVERY_MODE_OAUTH },
      { targetId: OPENAI_TARGET_CPA, accountDeliveryMode: ACCOUNT_DELIVERY_MODE_SESSION },
      { targetId: OPENAI_TARGET_SUB2API, accountDeliveryMode: ACCOUNT_DELIVERY_MODE_SESSION },
      { targetId: OPENAI_TARGET_SUB2API, accountDeliveryMode: ACCOUNT_DELIVERY_MODE_AGENT_IDENTITY },
      { targetId: OPENAI_TARGET_CODEX2API, accountDeliveryMode: ACCOUNT_DELIVERY_MODE_OAUTH },
      { targetId: OPENAI_TARGET_WEBCHAT, accountDeliveryMode: ACCOUNT_DELIVERY_MODE_SESSION },
      { targetId: OPENAI_TARGET_CHATGPT2API, accountDeliveryMode: ACCOUNT_DELIVERY_MODE_SESSION },
      { targetId: OPENAI_TARGET_CPA, accountDeliveryMode: ACCOUNT_DELIVERY_MODE_OAUTH, signupMethod: SIGNUP_METHOD_PHONE },
      {
        targetId: OPENAI_TARGET_CPA,
        accountDeliveryMode: ACCOUNT_DELIVERY_MODE_OAUTH,
        signupMethod: SIGNUP_METHOD_PHONE,
        phoneSignupReloginAfterBindEmailEnabled: true,
      },
      { targetId: OPENAI_TARGET_CPA, accountDeliveryMode: ACCOUNT_DELIVERY_MODE_OAUTH, plusModeEnabled: true },
      {
        targetId: OPENAI_TARGET_SUB2API,
        accountDeliveryMode: ACCOUNT_DELIVERY_MODE_AGENT_IDENTITY,
        plusModeEnabled: true,
        plusPaymentMethod: PLUS_PAYMENT_METHOD_PAYPAL_HOSTED,
      },
    ];
    const keyed = new Map();
    combinations.forEach((options) => {
      buildModeStepDefinitions(options).forEach((step) => keyed.set(step.key, step));
    });
    return reindexModeStepDefinitions(Array.from(keyed.values()));
  }

  function getPlusPaymentStepTitle(options = {}) {
    if (!isPlusModeEnabled(options)) {
      return '';
    }
    return buildPaymentStage(options)[0]?.title || '';
  }

  function resolveStepTitle(step = {}) {
    return step?.title || '';
  }

  return {
    flowId: 'openai',
    buildAccountDeliveryStage,
    buildPaymentStage,
    buildRegistrationStage,
    getAllSteps,
    getModeStepDefinitions: buildModeStepDefinitions,
    getPlusPaymentStepTitle,
    isPlusModeEnabled,
    normalizePlusPaymentMethod,
    normalizeSignupMethod,
    resolveAccountDeliveryRouteId,
    resolveStepTitle,
  };
});
