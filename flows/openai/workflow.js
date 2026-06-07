(function attachMultiPageOpenAiWorkflow(root, factory) {
  root.MultiPageOpenAiWorkflow = factory();
})(typeof self !== 'undefined' ? self : globalThis, function createMultiPageOpenAiWorkflow() {
  const SIGNUP_METHOD_EMAIL = 'email';
  const SIGNUP_METHOD_PHONE = 'phone';
  const PLUS_PAYMENT_METHOD_PAYPAL = 'paypal';
  const PLUS_PAYMENT_METHOD_PAYPAL_HOSTED = 'paypal-hosted';
  const PLUS_PAYMENT_METHOD_NONE = 'none';

  const PLUS_PAYMENT_METHOD_GPC_HELPER = 'gpc-helper';
  const PLUS_PAYMENT_METHOD_AUTO = 'plus-auto';
  const PLUS_ACCOUNT_ACCESS_STRATEGY_OAUTH = 'oauth';
  const PLUS_ACCOUNT_ACCESS_STRATEGY_SUB2API_CODEX_SESSION = 'sub2api_codex_session';
  const PLUS_ACCOUNT_ACCESS_STRATEGY_CPA_CODEX_SESSION = 'cpa_codex_session';
  const PLUS_PAYMENT_STEP_KEY = 'paypal-approve';
  const PLUS_REGISTRATION_WAIT_STEP_KEY = 'wait-registration-success';
  const OPENAI_WEBCHAT_TARGET_ID = 'webchat';
  const OPENAI_WEBCHAT_UPLOAD_STEP_KEY = 'openai-upload-session-to-webchat';

  function freezeDeep(entry) {
    if (!entry || typeof entry !== 'object' || Object.isFrozen(entry)) {
      return entry;
    }
    Object.getOwnPropertyNames(entry).forEach((key) => {
      freezeDeep(entry[key]);
    });
    return Object.freeze(entry);
  }

  const STEP_VARIANTS_RAW = ({
  "normal": [
    {
      "id": 1,
      "order": 10,
      "key": "open-chatgpt",
      "title": "打开 ChatGPT 官网",
      "sourceId": "chatgpt",
      "driverId": null,
      "command": "open-chatgpt",
      "flowId": "openai"
    },
    {
      "id": 2,
      "order": 20,
      "key": "submit-signup-email",
      "title": "注册并输入邮箱",
      "sourceId": "openai-auth",
      "driverId": "flows/openai/content/openai-auth",
      "command": "submit-signup-email",
      "flowId": "openai"
    },
    {
      "id": 3,
      "order": 30,
      "key": "fill-password",
      "title": "填写密码并继续",
      "sourceId": "openai-auth",
      "driverId": "flows/openai/content/openai-auth",
      "command": "fill-password",
      "flowId": "openai"
    },
    {
      "id": 4,
      "order": 40,
      "key": "fetch-signup-code",
      "title": "获取注册验证码",
      "sourceId": "openai-auth",
      "driverId": "flows/openai/content/openai-auth",
      "command": "submit-verification-code",
      "mailRuleId": "openai-signup-code",
      "flowId": "openai"
    },
    {
      "id": 5,
      "order": 50,
      "key": "fill-profile",
      "title": "填写姓名和生日",
      "sourceId": "openai-auth",
      "driverId": "flows/openai/content/openai-auth",
      "command": "fill-profile",
      "flowId": "openai"
    },
    {
      "id": 6,
      "order": 60,
      "key": "wait-registration-success",
      "title": "等待注册成功",
      "sourceId": "chatgpt",
      "driverId": null,
      "command": "wait-registration-success",
      "flowId": "openai"
    },
    {
      "id": 7,
      "order": 70,
      "key": "oauth-login",
      "title": "刷新 OAuth 并登录",
      "sourceId": "openai-auth",
      "driverId": "flows/openai/content/openai-auth",
      "command": "oauth-login",
      "flowId": "openai"
    },
    {
      "id": 8,
      "order": 80,
      "key": "fetch-login-code",
      "title": "获取登录验证码",
      "sourceId": "openai-auth",
      "driverId": "flows/openai/content/openai-auth",
      "command": "submit-verification-code",
      "mailRuleId": "openai-login-code",
      "flowId": "openai"
    },
    {
      "id": 9,
      "order": 90,
      "key": "post-login-phone-verification",
      "title": "手机号验证",
      "sourceId": "openai-auth",
      "driverId": "flows/openai/content/openai-auth",
      "command": "post-login-phone-verification",
      "flowId": "openai"
    },
    {
      "id": 10,
      "order": 100,
      "key": "confirm-oauth",
      "title": "自动确认 OAuth",
      "sourceId": "openai-auth",
      "driverId": "flows/openai/content/openai-auth",
      "command": "confirm-oauth",
      "flowId": "openai"
    },
    {
      "id": 11,
      "order": 110,
      "key": "platform-verify",
      "title": "平台回调验证",
      "sourceId": "platform-panel",
      "driverId": "content/platform-panel",
      "command": "platform-verify",
      "flowId": "openai"
    }
  ],
  "normalPhone": [
    {
      "id": 1,
      "order": 10,
      "key": "open-chatgpt",
      "title": "打开 ChatGPT 官网",
      "sourceId": "chatgpt",
      "driverId": null,
      "command": "open-chatgpt",
      "flowId": "openai"
    },
    {
      "id": 2,
      "order": 20,
      "key": "submit-signup-email",
      "title": "注册并输入手机号",
      "sourceId": "openai-auth",
      "driverId": "flows/openai/content/openai-auth",
      "command": "submit-signup-email",
      "flowId": "openai"
    },
    {
      "id": 3,
      "order": 30,
      "key": "fill-password",
      "title": "填写密码并继续",
      "sourceId": "openai-auth",
      "driverId": "flows/openai/content/openai-auth",
      "command": "fill-password",
      "flowId": "openai"
    },
    {
      "id": 4,
      "order": 40,
      "key": "fetch-signup-code",
      "title": "获取手机验证码",
      "sourceId": "openai-auth",
      "driverId": "flows/openai/content/openai-auth",
      "command": "submit-verification-code",
      "mailRuleId": "openai-signup-code",
      "flowId": "openai"
    },
    {
      "id": 5,
      "order": 50,
      "key": "fill-profile",
      "title": "填写姓名和生日",
      "sourceId": "openai-auth",
      "driverId": "flows/openai/content/openai-auth",
      "command": "fill-profile",
      "flowId": "openai"
    },
    {
      "id": 6,
      "order": 60,
      "key": "wait-registration-success",
      "title": "等待注册成功",
      "sourceId": "chatgpt",
      "driverId": null,
      "command": "wait-registration-success",
      "flowId": "openai"
    },
    {
      "id": 7,
      "order": 70,
      "key": "oauth-login",
      "title": "刷新 OAuth 并登录",
      "sourceId": "openai-auth",
      "driverId": "flows/openai/content/openai-auth",
      "command": "oauth-login",
      "flowId": "openai"
    },
    {
      "id": 8,
      "order": 80,
      "key": "fetch-login-code",
      "title": "获取登录验证码",
      "sourceId": "openai-auth",
      "driverId": "flows/openai/content/openai-auth",
      "command": "submit-verification-code",
      "mailRuleId": "openai-login-code",
      "flowId": "openai"
    },
    {
      "id": 9,
      "order": 90,
      "key": "bind-email",
      "title": "绑定邮箱",
      "sourceId": "openai-auth",
      "driverId": "flows/openai/content/openai-auth",
      "command": "bind-email",
      "flowId": "openai"
    },
    {
      "id": 10,
      "order": 100,
      "key": "fetch-bind-email-code",
      "title": "获取绑定邮箱验证码",
      "sourceId": "openai-auth",
      "driverId": "flows/openai/content/openai-auth",
      "command": "fetch-bind-email-code",
      "mailRuleId": "openai-login-code",
      "flowId": "openai"
    },
    {
      "id": 11,
      "order": 110,
      "key": "confirm-oauth",
      "title": "自动确认 OAuth",
      "sourceId": "openai-auth",
      "driverId": "flows/openai/content/openai-auth",
      "command": "confirm-oauth",
      "flowId": "openai"
    },
    {
      "id": 12,
      "order": 120,
      "key": "platform-verify",
      "title": "平台回调验证",
      "sourceId": "platform-panel",
      "driverId": "content/platform-panel",
      "command": "platform-verify",
      "flowId": "openai"
    }
  ],
  "normalPhoneRelogin": [
    {
      "id": 1,
      "order": 10,
      "key": "open-chatgpt",
      "title": "打开 ChatGPT 官网",
      "sourceId": "chatgpt",
      "driverId": null,
      "command": "open-chatgpt",
      "flowId": "openai"
    },
    {
      "id": 2,
      "order": 20,
      "key": "submit-signup-email",
      "title": "注册并输入手机号",
      "sourceId": "openai-auth",
      "driverId": "flows/openai/content/openai-auth",
      "command": "submit-signup-email",
      "flowId": "openai"
    },
    {
      "id": 3,
      "order": 30,
      "key": "fill-password",
      "title": "填写密码并继续",
      "sourceId": "openai-auth",
      "driverId": "flows/openai/content/openai-auth",
      "command": "fill-password",
      "flowId": "openai"
    },
    {
      "id": 4,
      "order": 40,
      "key": "fetch-signup-code",
      "title": "获取手机验证码",
      "sourceId": "openai-auth",
      "driverId": "flows/openai/content/openai-auth",
      "command": "submit-verification-code",
      "mailRuleId": "openai-signup-code",
      "flowId": "openai"
    },
    {
      "id": 5,
      "order": 50,
      "key": "fill-profile",
      "title": "填写姓名和生日",
      "sourceId": "openai-auth",
      "driverId": "flows/openai/content/openai-auth",
      "command": "fill-profile",
      "flowId": "openai"
    },
    {
      "id": 6,
      "order": 60,
      "key": "wait-registration-success",
      "title": "等待注册成功",
      "sourceId": "chatgpt",
      "driverId": null,
      "command": "wait-registration-success",
      "flowId": "openai"
    },
    {
      "id": 7,
      "order": 70,
      "key": "oauth-login",
      "title": "刷新 OAuth 并登录",
      "sourceId": "openai-auth",
      "driverId": "flows/openai/content/openai-auth",
      "command": "oauth-login",
      "flowId": "openai"
    },
    {
      "id": 8,
      "order": 80,
      "key": "fetch-login-code",
      "title": "获取登录验证码",
      "sourceId": "openai-auth",
      "driverId": "flows/openai/content/openai-auth",
      "command": "submit-verification-code",
      "mailRuleId": "openai-login-code",
      "flowId": "openai"
    },
    {
      "id": 9,
      "order": 90,
      "key": "bind-email",
      "title": "绑定邮箱",
      "sourceId": "openai-auth",
      "driverId": "flows/openai/content/openai-auth",
      "command": "bind-email",
      "flowId": "openai"
    },
    {
      "id": 10,
      "order": 100,
      "key": "fetch-bind-email-code",
      "title": "获取绑定邮箱验证码",
      "sourceId": "openai-auth",
      "driverId": "flows/openai/content/openai-auth",
      "command": "fetch-bind-email-code",
      "mailRuleId": "openai-login-code",
      "flowId": "openai"
    },
    {
      "id": 11,
      "order": 110,
      "key": "relogin-bound-email",
      "title": "绑定邮箱后刷新 OAuth 并登录（邮箱）",
      "sourceId": "openai-auth",
      "driverId": "flows/openai/content/openai-auth",
      "command": "oauth-login",
      "flowId": "openai"
    },
    {
      "id": 12,
      "order": 120,
      "key": "fetch-bound-email-login-code",
      "title": "获取登录验证码（邮箱）",
      "sourceId": "openai-auth",
      "driverId": "flows/openai/content/openai-auth",
      "command": "submit-verification-code",
      "mailRuleId": "openai-login-code",
      "flowId": "openai"
    },
    {
      "id": 13,
      "order": 130,
      "key": "post-bound-email-phone-verification",
      "title": "手机号验证",
      "sourceId": "openai-auth",
      "driverId": "flows/openai/content/openai-auth",
      "command": "post-login-phone-verification",
      "flowId": "openai"
    },
    {
      "id": 14,
      "order": 140,
      "key": "confirm-oauth",
      "title": "自动确认 OAuth",
      "sourceId": "openai-auth",
      "driverId": "flows/openai/content/openai-auth",
      "command": "confirm-oauth",
      "flowId": "openai"
    },
    {
      "id": 15,
      "order": 150,
      "key": "platform-verify",
      "title": "平台回调验证",
      "sourceId": "platform-panel",
      "driverId": "content/platform-panel",
      "command": "platform-verify",
      "flowId": "openai"
    }
  ],
  "plusPaypal": [
    {
      "id": 1,
      "order": 10,
      "key": "open-chatgpt",
      "title": "打开 ChatGPT 官网",
      "sourceId": "chatgpt",
      "driverId": null,
      "command": "open-chatgpt",
      "flowId": "openai"
    },
    {
      "id": 2,
      "order": 20,
      "key": "submit-signup-email",
      "title": "注册并输入邮箱",
      "sourceId": "openai-auth",
      "driverId": "flows/openai/content/openai-auth",
      "command": "submit-signup-email",
      "flowId": "openai"
    },
    {
      "id": 3,
      "order": 30,
      "key": "fill-password",
      "title": "填写密码并继续",
      "sourceId": "openai-auth",
      "driverId": "flows/openai/content/openai-auth",
      "command": "fill-password",
      "flowId": "openai"
    },
    {
      "id": 4,
      "order": 40,
      "key": "fetch-signup-code",
      "title": "获取注册验证码",
      "sourceId": "openai-auth",
      "driverId": "flows/openai/content/openai-auth",
      "command": "submit-verification-code",
      "mailRuleId": "openai-signup-code",
      "flowId": "openai"
    },
    {
      "id": 5,
      "order": 50,
      "key": "fill-profile",
      "title": "填写姓名和生日",
      "sourceId": "openai-auth",
      "driverId": "flows/openai/content/openai-auth",
      "command": "fill-profile",
      "flowId": "openai"
    },
    {
      "id": 6,
      "order": 60,
      "key": "plus-checkout-create",
      "title": "创建 Plus Checkout",
      "sourceId": "plus-checkout",
      "driverId": "flows/openai/content/plus-checkout",
      "command": "plus-checkout-create",
      "flowId": "openai"
    },
    {
      "id": 7,
      "order": 70,
      "key": "plus-checkout-billing",
      "title": "填写账单并提交订单",
      "sourceId": "plus-checkout",
      "driverId": "flows/openai/content/plus-checkout",
      "command": "plus-checkout-billing",
      "flowId": "openai"
    },
    {
      "id": 8,
      "order": 80,
      "key": "paypal-approve",
      "title": "PayPal 登录与授权",
      "sourceId": "paypal-flow",
      "driverId": "flows/openai/content/paypal-flow",
      "command": "paypal-approve",
      "flowId": "openai"
    },
    {
      "id": 9,
      "order": 90,
      "key": "plus-checkout-return",
      "title": "订阅回跳确认",
      "sourceId": "plus-checkout",
      "driverId": "flows/openai/content/plus-checkout",
      "command": "plus-checkout-return",
      "flowId": "openai"
    },
    {
      "id": 10,
      "order": 100,
      "key": "oauth-login",
      "title": "刷新 OAuth 并登录",
      "sourceId": "openai-auth",
      "driverId": "flows/openai/content/openai-auth",
      "command": "oauth-login",
      "flowId": "openai"
    },
    {
      "id": 11,
      "order": 110,
      "key": "fetch-login-code",
      "title": "获取登录验证码",
      "sourceId": "openai-auth",
      "driverId": "flows/openai/content/openai-auth",
      "command": "submit-verification-code",
      "mailRuleId": "openai-login-code",
      "flowId": "openai"
    },
    {
      "id": 12,
      "order": 120,
      "key": "post-login-phone-verification",
      "title": "手机号验证",
      "sourceId": "openai-auth",
      "driverId": "flows/openai/content/openai-auth",
      "command": "post-login-phone-verification",
      "flowId": "openai"
    },
    {
      "id": 13,
      "order": 130,
      "key": "confirm-oauth",
      "title": "自动确认 OAuth",
      "sourceId": "openai-auth",
      "driverId": "flows/openai/content/openai-auth",
      "command": "confirm-oauth",
      "flowId": "openai"
    },
    {
      "id": 14,
      "order": 140,
      "key": "platform-verify",
      "title": "平台回调验证",
      "sourceId": "platform-panel",
      "driverId": "content/platform-panel",
      "command": "platform-verify",
      "flowId": "openai"
    }
  ],
  "plusPaypalSub2apiSession": [
    {
      "id": 1,
      "order": 10,
      "key": "open-chatgpt",
      "title": "打开 ChatGPT 官网",
      "sourceId": "chatgpt",
      "driverId": null,
      "command": "open-chatgpt",
      "flowId": "openai"
    },
    {
      "id": 2,
      "order": 20,
      "key": "submit-signup-email",
      "title": "注册并输入邮箱",
      "sourceId": "openai-auth",
      "driverId": "flows/openai/content/openai-auth",
      "command": "submit-signup-email",
      "flowId": "openai"
    },
    {
      "id": 3,
      "order": 30,
      "key": "fill-password",
      "title": "填写密码并继续",
      "sourceId": "openai-auth",
      "driverId": "flows/openai/content/openai-auth",
      "command": "fill-password",
      "flowId": "openai"
    },
    {
      "id": 4,
      "order": 40,
      "key": "fetch-signup-code",
      "title": "获取注册验证码",
      "sourceId": "openai-auth",
      "driverId": "flows/openai/content/openai-auth",
      "command": "submit-verification-code",
      "mailRuleId": "openai-signup-code",
      "flowId": "openai"
    },
    {
      "id": 5,
      "order": 50,
      "key": "fill-profile",
      "title": "填写姓名和生日",
      "sourceId": "openai-auth",
      "driverId": "flows/openai/content/openai-auth",
      "command": "fill-profile",
      "flowId": "openai"
    },
    {
      "id": 6,
      "order": 60,
      "key": "plus-checkout-create",
      "title": "创建 Plus Checkout",
      "sourceId": "plus-checkout",
      "driverId": "flows/openai/content/plus-checkout",
      "command": "plus-checkout-create",
      "flowId": "openai"
    },
    {
      "id": 7,
      "order": 70,
      "key": "plus-checkout-billing",
      "title": "填写账单并提交订单",
      "sourceId": "plus-checkout",
      "driverId": "flows/openai/content/plus-checkout",
      "command": "plus-checkout-billing",
      "flowId": "openai"
    },
    {
      "id": 8,
      "order": 80,
      "key": "paypal-approve",
      "title": "PayPal 登录与授权",
      "sourceId": "paypal-flow",
      "driverId": "flows/openai/content/paypal-flow",
      "command": "paypal-approve",
      "flowId": "openai"
    },
    {
      "id": 9,
      "order": 90,
      "key": "plus-checkout-return",
      "title": "订阅回跳确认",
      "sourceId": "plus-checkout",
      "driverId": "flows/openai/content/plus-checkout",
      "command": "plus-checkout-return",
      "flowId": "openai"
    },
    {
      "id": 10,
      "order": 100,
      "key": "sub2api-session-import",
      "title": "导入当前 ChatGPT 会话到 SUB2API",
      "sourceId": "sub2api-panel",
      "driverId": "flows/openai/background/steps/sub2api-session-import",
      "command": "sub2api-session-import",
      "flowId": "openai"
    }
  ],
  "plusPaypalCpaSession": [
    {
      "id": 1,
      "order": 10,
      "key": "open-chatgpt",
      "title": "打开 ChatGPT 官网",
      "sourceId": "chatgpt",
      "driverId": null,
      "command": "open-chatgpt",
      "flowId": "openai"
    },
    {
      "id": 2,
      "order": 20,
      "key": "submit-signup-email",
      "title": "注册并输入邮箱",
      "sourceId": "openai-auth",
      "driverId": "flows/openai/content/openai-auth",
      "command": "submit-signup-email",
      "flowId": "openai"
    },
    {
      "id": 3,
      "order": 30,
      "key": "fill-password",
      "title": "填写密码并继续",
      "sourceId": "openai-auth",
      "driverId": "flows/openai/content/openai-auth",
      "command": "fill-password",
      "flowId": "openai"
    },
    {
      "id": 4,
      "order": 40,
      "key": "fetch-signup-code",
      "title": "获取注册验证码",
      "sourceId": "openai-auth",
      "driverId": "flows/openai/content/openai-auth",
      "command": "submit-verification-code",
      "mailRuleId": "openai-signup-code",
      "flowId": "openai"
    },
    {
      "id": 5,
      "order": 50,
      "key": "fill-profile",
      "title": "填写姓名和生日",
      "sourceId": "openai-auth",
      "driverId": "flows/openai/content/openai-auth",
      "command": "fill-profile",
      "flowId": "openai"
    },
    {
      "id": 6,
      "order": 60,
      "key": "plus-checkout-create",
      "title": "创建 Plus Checkout",
      "sourceId": "plus-checkout",
      "driverId": "flows/openai/content/plus-checkout",
      "command": "plus-checkout-create",
      "flowId": "openai"
    },
    {
      "id": 7,
      "order": 70,
      "key": "plus-checkout-billing",
      "title": "填写账单并提交订单",
      "sourceId": "plus-checkout",
      "driverId": "flows/openai/content/plus-checkout",
      "command": "plus-checkout-billing",
      "flowId": "openai"
    },
    {
      "id": 8,
      "order": 80,
      "key": "paypal-approve",
      "title": "PayPal 登录与授权",
      "sourceId": "paypal-flow",
      "driverId": "flows/openai/content/paypal-flow",
      "command": "paypal-approve",
      "flowId": "openai"
    },
    {
      "id": 9,
      "order": 90,
      "key": "plus-checkout-return",
      "title": "订阅回跳确认",
      "sourceId": "plus-checkout",
      "driverId": "flows/openai/content/plus-checkout",
      "command": "plus-checkout-return",
      "flowId": "openai"
    },
    {
      "id": 10,
      "order": 100,
      "key": "cpa-session-import",
      "title": "导入当前 ChatGPT 会话到 CPA",
      "sourceId": "vps-panel",
      "driverId": "flows/openai/background/steps/cpa-session-import",
      "command": "cpa-session-import",
      "flowId": "openai"
    }
  ],
  "plusPaypalPhone": [
    {
      "id": 1,
      "order": 10,
      "key": "open-chatgpt",
      "title": "打开 ChatGPT 官网",
      "sourceId": "chatgpt",
      "driverId": null,
      "command": "open-chatgpt",
      "flowId": "openai"
    },
    {
      "id": 2,
      "order": 20,
      "key": "submit-signup-email",
      "title": "注册并输入手机号",
      "sourceId": "openai-auth",
      "driverId": "flows/openai/content/openai-auth",
      "command": "submit-signup-email",
      "flowId": "openai"
    },
    {
      "id": 3,
      "order": 30,
      "key": "fill-password",
      "title": "填写密码并继续",
      "sourceId": "openai-auth",
      "driverId": "flows/openai/content/openai-auth",
      "command": "fill-password",
      "flowId": "openai"
    },
    {
      "id": 4,
      "order": 40,
      "key": "fetch-signup-code",
      "title": "获取手机验证码",
      "sourceId": "openai-auth",
      "driverId": "flows/openai/content/openai-auth",
      "command": "submit-verification-code",
      "mailRuleId": "openai-signup-code",
      "flowId": "openai"
    },
    {
      "id": 5,
      "order": 50,
      "key": "fill-profile",
      "title": "填写姓名和生日",
      "sourceId": "openai-auth",
      "driverId": "flows/openai/content/openai-auth",
      "command": "fill-profile",
      "flowId": "openai"
    },
    {
      "id": 6,
      "order": 60,
      "key": "plus-checkout-create",
      "title": "创建 Plus Checkout",
      "sourceId": "plus-checkout",
      "driverId": "flows/openai/content/plus-checkout",
      "command": "plus-checkout-create",
      "flowId": "openai"
    },
    {
      "id": 7,
      "order": 70,
      "key": "plus-checkout-billing",
      "title": "填写账单并提交订单",
      "sourceId": "plus-checkout",
      "driverId": "flows/openai/content/plus-checkout",
      "command": "plus-checkout-billing",
      "flowId": "openai"
    },
    {
      "id": 8,
      "order": 80,
      "key": "paypal-approve",
      "title": "PayPal 登录与授权",
      "sourceId": "paypal-flow",
      "driverId": "flows/openai/content/paypal-flow",
      "command": "paypal-approve",
      "flowId": "openai"
    },
    {
      "id": 9,
      "order": 90,
      "key": "plus-checkout-return",
      "title": "订阅回跳确认",
      "sourceId": "plus-checkout",
      "driverId": "flows/openai/content/plus-checkout",
      "command": "plus-checkout-return",
      "flowId": "openai"
    },
    {
      "id": 10,
      "order": 100,
      "key": "oauth-login",
      "title": "刷新 OAuth 并登录",
      "sourceId": "openai-auth",
      "driverId": "flows/openai/content/openai-auth",
      "command": "oauth-login",
      "flowId": "openai"
    },
    {
      "id": 11,
      "order": 110,
      "key": "fetch-login-code",
      "title": "获取登录验证码",
      "sourceId": "openai-auth",
      "driverId": "flows/openai/content/openai-auth",
      "command": "submit-verification-code",
      "mailRuleId": "openai-login-code",
      "flowId": "openai"
    },
    {
      "id": 12,
      "order": 120,
      "key": "bind-email",
      "title": "绑定邮箱",
      "sourceId": "openai-auth",
      "driverId": "flows/openai/content/openai-auth",
      "command": "bind-email",
      "flowId": "openai"
    },
    {
      "id": 13,
      "order": 130,
      "key": "fetch-bind-email-code",
      "title": "获取绑定邮箱验证码",
      "sourceId": "openai-auth",
      "driverId": "flows/openai/content/openai-auth",
      "command": "fetch-bind-email-code",
      "mailRuleId": "openai-login-code",
      "flowId": "openai"
    },
    {
      "id": 14,
      "order": 140,
      "key": "confirm-oauth",
      "title": "自动确认 OAuth",
      "sourceId": "openai-auth",
      "driverId": "flows/openai/content/openai-auth",
      "command": "confirm-oauth",
      "flowId": "openai"
    },
    {
      "id": 15,
      "order": 150,
      "key": "platform-verify",
      "title": "平台回调验证",
      "sourceId": "platform-panel",
      "driverId": "content/platform-panel",
      "command": "platform-verify",
      "flowId": "openai"
    }
  ],
  "plusPaypalPhoneRelogin": [
    {
      "id": 1,
      "order": 10,
      "key": "open-chatgpt",
      "title": "打开 ChatGPT 官网",
      "sourceId": "chatgpt",
      "driverId": null,
      "command": "open-chatgpt",
      "flowId": "openai"
    },
    {
      "id": 2,
      "order": 20,
      "key": "submit-signup-email",
      "title": "注册并输入手机号",
      "sourceId": "openai-auth",
      "driverId": "flows/openai/content/openai-auth",
      "command": "submit-signup-email",
      "flowId": "openai"
    },
    {
      "id": 3,
      "order": 30,
      "key": "fill-password",
      "title": "填写密码并继续",
      "sourceId": "openai-auth",
      "driverId": "flows/openai/content/openai-auth",
      "command": "fill-password",
      "flowId": "openai"
    },
    {
      "id": 4,
      "order": 40,
      "key": "fetch-signup-code",
      "title": "获取手机验证码",
      "sourceId": "openai-auth",
      "driverId": "flows/openai/content/openai-auth",
      "command": "submit-verification-code",
      "mailRuleId": "openai-signup-code",
      "flowId": "openai"
    },
    {
      "id": 5,
      "order": 50,
      "key": "fill-profile",
      "title": "填写姓名和生日",
      "sourceId": "openai-auth",
      "driverId": "flows/openai/content/openai-auth",
      "command": "fill-profile",
      "flowId": "openai"
    },
    {
      "id": 6,
      "order": 60,
      "key": "plus-checkout-create",
      "title": "创建 Plus Checkout",
      "sourceId": "plus-checkout",
      "driverId": "flows/openai/content/plus-checkout",
      "command": "plus-checkout-create",
      "flowId": "openai"
    },
    {
      "id": 7,
      "order": 70,
      "key": "plus-checkout-billing",
      "title": "填写账单并提交订单",
      "sourceId": "plus-checkout",
      "driverId": "flows/openai/content/plus-checkout",
      "command": "plus-checkout-billing",
      "flowId": "openai"
    },
    {
      "id": 8,
      "order": 80,
      "key": "paypal-approve",
      "title": "PayPal 登录与授权",
      "sourceId": "paypal-flow",
      "driverId": "flows/openai/content/paypal-flow",
      "command": "paypal-approve",
      "flowId": "openai"
    },
    {
      "id": 9,
      "order": 90,
      "key": "plus-checkout-return",
      "title": "订阅回跳确认",
      "sourceId": "plus-checkout",
      "driverId": "flows/openai/content/plus-checkout",
      "command": "plus-checkout-return",
      "flowId": "openai"
    },
    {
      "id": 10,
      "order": 100,
      "key": "oauth-login",
      "title": "刷新 OAuth 并登录",
      "sourceId": "openai-auth",
      "driverId": "flows/openai/content/openai-auth",
      "command": "oauth-login",
      "flowId": "openai"
    },
    {
      "id": 11,
      "order": 110,
      "key": "fetch-login-code",
      "title": "获取登录验证码",
      "sourceId": "openai-auth",
      "driverId": "flows/openai/content/openai-auth",
      "command": "submit-verification-code",
      "mailRuleId": "openai-login-code",
      "flowId": "openai"
    },
    {
      "id": 12,
      "order": 120,
      "key": "bind-email",
      "title": "绑定邮箱",
      "sourceId": "openai-auth",
      "driverId": "flows/openai/content/openai-auth",
      "command": "bind-email",
      "flowId": "openai"
    },
    {
      "id": 13,
      "order": 130,
      "key": "fetch-bind-email-code",
      "title": "获取绑定邮箱验证码",
      "sourceId": "openai-auth",
      "driverId": "flows/openai/content/openai-auth",
      "command": "fetch-bind-email-code",
      "mailRuleId": "openai-login-code",
      "flowId": "openai"
    },
    {
      "id": 14,
      "order": 140,
      "key": "relogin-bound-email",
      "title": "绑定邮箱后刷新 OAuth 并登录（邮箱）",
      "sourceId": "openai-auth",
      "driverId": "flows/openai/content/openai-auth",
      "command": "oauth-login",
      "flowId": "openai"
    },
    {
      "id": 15,
      "order": 150,
      "key": "fetch-bound-email-login-code",
      "title": "获取登录验证码（邮箱）",
      "sourceId": "openai-auth",
      "driverId": "flows/openai/content/openai-auth",
      "command": "submit-verification-code",
      "mailRuleId": "openai-login-code",
      "flowId": "openai"
    },
    {
      "id": 16,
      "order": 160,
      "key": "post-bound-email-phone-verification",
      "title": "手机号验证",
      "sourceId": "openai-auth",
      "driverId": "flows/openai/content/openai-auth",
      "command": "post-login-phone-verification",
      "flowId": "openai"
    },
    {
      "id": 17,
      "order": 170,
      "key": "confirm-oauth",
      "title": "自动确认 OAuth",
      "sourceId": "openai-auth",
      "driverId": "flows/openai/content/openai-auth",
      "command": "confirm-oauth",
      "flowId": "openai"
    },
    {
      "id": 18,
      "order": 180,
      "key": "platform-verify",
      "title": "平台回调验证",
      "sourceId": "platform-panel",
      "driverId": "content/platform-panel",
      "command": "platform-verify",
      "flowId": "openai"
    }
  ],
  "plusPaypalHosted": [
    {
      "id": 1,
      "order": 10,
      "key": "open-chatgpt",
      "title": "打开 ChatGPT 官网",
      "sourceId": "chatgpt",
      "driverId": null,
      "command": "open-chatgpt",
      "flowId": "openai"
    },
    {
      "id": 2,
      "order": 20,
      "key": "submit-signup-email",
      "title": "注册并输入邮箱",
      "sourceId": "openai-auth",
      "driverId": "flows/openai/content/openai-auth",
      "command": "submit-signup-email",
      "flowId": "openai"
    },
    {
      "id": 3,
      "order": 30,
      "key": "fill-password",
      "title": "填写密码并继续",
      "sourceId": "openai-auth",
      "driverId": "flows/openai/content/openai-auth",
      "command": "fill-password",
      "flowId": "openai"
    },
    {
      "id": 4,
      "order": 40,
      "key": "fetch-signup-code",
      "title": "获取注册验证码",
      "sourceId": "openai-auth",
      "driverId": "flows/openai/content/openai-auth",
      "command": "submit-verification-code",
      "mailRuleId": "openai-signup-code",
      "flowId": "openai"
    },
    {
      "id": 5,
      "order": 50,
      "key": "fill-profile",
      "title": "填写姓名和生日",
      "sourceId": "openai-auth",
      "driverId": "flows/openai/content/openai-auth",
      "command": "fill-profile",
      "flowId": "openai"
    },
    {
      "id": 6,
      "order": 60,
      "key": "plus-checkout-create",
      "title": "创建 Plus Checkout",
      "sourceId": "plus-checkout",
      "driverId": "flows/openai/content/plus-checkout",
      "command": "plus-checkout-create",
      "flowId": "openai"
    },
    {
      "id": 7,
      "order": 70,
      "key": "paypal-hosted-email",
      "title": "无卡直绑填写 PayPal 邮箱",
      "sourceId": "paypal-flow",
      "driverId": "flows/openai/content/paypal-flow",
      "command": "paypal-hosted-email",
      "flowId": "openai"
    },
    {
      "id": 8,
      "order": 80,
      "key": "paypal-hosted-card",
      "title": "无卡直绑填写 PayPal 资料",
      "sourceId": "paypal-flow",
      "driverId": "flows/openai/content/paypal-flow",
      "command": "paypal-hosted-card",
      "flowId": "openai"
    },
    {
      "id": 9,
      "order": 90,
      "key": "paypal-hosted-create-account",
      "title": "无卡直绑确认创建 PayPal",
      "sourceId": "paypal-flow",
      "driverId": "flows/openai/content/paypal-flow",
      "command": "paypal-hosted-create-account",
      "flowId": "openai"
    },
    {
      "id": 10,
      "order": 100,
      "key": "paypal-hosted-review",
      "title": "无卡直绑完成 PayPal 授权",
      "sourceId": "paypal-flow",
      "driverId": "flows/openai/content/paypal-flow",
      "command": "paypal-hosted-review",
      "flowId": "openai"
    },
    {
      "id": 11,
      "order": 110,
      "key": "oauth-login",
      "title": "刷新 OAuth 并登录",
      "sourceId": "openai-auth",
      "driverId": "flows/openai/content/openai-auth",
      "command": "oauth-login",
      "flowId": "openai"
    },
    {
      "id": 12,
      "order": 120,
      "key": "fetch-login-code",
      "title": "获取登录验证码",
      "sourceId": "openai-auth",
      "driverId": "flows/openai/content/openai-auth",
      "command": "submit-verification-code",
      "mailRuleId": "openai-login-code",
      "flowId": "openai"
    },
    {
      "id": 13,
      "order": 130,
      "key": "confirm-oauth",
      "title": "自动确认 OAuth",
      "sourceId": "openai-auth",
      "driverId": "flows/openai/content/openai-auth",
      "command": "confirm-oauth",
      "flowId": "openai"
    },
    {
      "id": 14,
      "order": 140,
      "key": "platform-verify",
      "title": "平台回调验证",
      "sourceId": "platform-panel",
      "driverId": "content/platform-panel",
      "command": "platform-verify",
      "flowId": "openai"
    }
  ],
  "plusPaypalHostedSub2apiSession": [
    {
      "id": 1,
      "order": 10,
      "key": "open-chatgpt",
      "title": "打开 ChatGPT 官网",
      "sourceId": "chatgpt",
      "driverId": null,
      "command": "open-chatgpt",
      "flowId": "openai"
    },
    {
      "id": 2,
      "order": 20,
      "key": "submit-signup-email",
      "title": "注册并输入邮箱",
      "sourceId": "openai-auth",
      "driverId": "flows/openai/content/openai-auth",
      "command": "submit-signup-email",
      "flowId": "openai"
    },
    {
      "id": 3,
      "order": 30,
      "key": "fill-password",
      "title": "填写密码并继续",
      "sourceId": "openai-auth",
      "driverId": "flows/openai/content/openai-auth",
      "command": "fill-password",
      "flowId": "openai"
    },
    {
      "id": 4,
      "order": 40,
      "key": "fetch-signup-code",
      "title": "获取注册验证码",
      "sourceId": "openai-auth",
      "driverId": "flows/openai/content/openai-auth",
      "command": "submit-verification-code",
      "mailRuleId": "openai-signup-code",
      "flowId": "openai"
    },
    {
      "id": 5,
      "order": 50,
      "key": "fill-profile",
      "title": "填写姓名和生日",
      "sourceId": "openai-auth",
      "driverId": "flows/openai/content/openai-auth",
      "command": "fill-profile",
      "flowId": "openai"
    },
    {
      "id": 6,
      "order": 60,
      "key": "plus-checkout-create",
      "title": "创建 Plus Checkout",
      "sourceId": "plus-checkout",
      "driverId": "flows/openai/content/plus-checkout",
      "command": "plus-checkout-create",
      "flowId": "openai"
    },
    {
      "id": 7,
      "order": 70,
      "key": "paypal-hosted-email",
      "title": "无卡直绑填写 PayPal 邮箱",
      "sourceId": "paypal-flow",
      "driverId": "flows/openai/content/paypal-flow",
      "command": "paypal-hosted-email",
      "flowId": "openai"
    },
    {
      "id": 8,
      "order": 80,
      "key": "paypal-hosted-card",
      "title": "无卡直绑填写 PayPal 资料",
      "sourceId": "paypal-flow",
      "driverId": "flows/openai/content/paypal-flow",
      "command": "paypal-hosted-card",
      "flowId": "openai"
    },
    {
      "id": 9,
      "order": 90,
      "key": "paypal-hosted-create-account",
      "title": "无卡直绑确认创建 PayPal",
      "sourceId": "paypal-flow",
      "driverId": "flows/openai/content/paypal-flow",
      "command": "paypal-hosted-create-account",
      "flowId": "openai"
    },
    {
      "id": 10,
      "order": 100,
      "key": "paypal-hosted-review",
      "title": "无卡直绑完成 PayPal 授权",
      "sourceId": "paypal-flow",
      "driverId": "flows/openai/content/paypal-flow",
      "command": "paypal-hosted-review",
      "flowId": "openai"
    },
    {
      "id": 11,
      "order": 110,
      "key": "sub2api-session-import",
      "title": "导入当前 ChatGPT 会话到 SUB2API",
      "sourceId": "sub2api-panel",
      "driverId": "flows/openai/background/steps/sub2api-session-import",
      "command": "sub2api-session-import",
      "flowId": "openai"
    }
  ],
  "plusPaypalHostedCpaSession": [
    {
      "id": 1,
      "order": 10,
      "key": "open-chatgpt",
      "title": "打开 ChatGPT 官网",
      "sourceId": "chatgpt",
      "driverId": null,
      "command": "open-chatgpt",
      "flowId": "openai"
    },
    {
      "id": 2,
      "order": 20,
      "key": "submit-signup-email",
      "title": "注册并输入邮箱",
      "sourceId": "openai-auth",
      "driverId": "flows/openai/content/openai-auth",
      "command": "submit-signup-email",
      "flowId": "openai"
    },
    {
      "id": 3,
      "order": 30,
      "key": "fill-password",
      "title": "填写密码并继续",
      "sourceId": "openai-auth",
      "driverId": "flows/openai/content/openai-auth",
      "command": "fill-password",
      "flowId": "openai"
    },
    {
      "id": 4,
      "order": 40,
      "key": "fetch-signup-code",
      "title": "获取注册验证码",
      "sourceId": "openai-auth",
      "driverId": "flows/openai/content/openai-auth",
      "command": "submit-verification-code",
      "mailRuleId": "openai-signup-code",
      "flowId": "openai"
    },
    {
      "id": 5,
      "order": 50,
      "key": "fill-profile",
      "title": "填写姓名和生日",
      "sourceId": "openai-auth",
      "driverId": "flows/openai/content/openai-auth",
      "command": "fill-profile",
      "flowId": "openai"
    },
    {
      "id": 6,
      "order": 60,
      "key": "plus-checkout-create",
      "title": "创建 Plus Checkout",
      "sourceId": "plus-checkout",
      "driverId": "flows/openai/content/plus-checkout",
      "command": "plus-checkout-create",
      "flowId": "openai"
    },
    {
      "id": 7,
      "order": 70,
      "key": "paypal-hosted-email",
      "title": "无卡直绑填写 PayPal 邮箱",
      "sourceId": "paypal-flow",
      "driverId": "flows/openai/content/paypal-flow",
      "command": "paypal-hosted-email",
      "flowId": "openai"
    },
    {
      "id": 8,
      "order": 80,
      "key": "paypal-hosted-card",
      "title": "无卡直绑填写 PayPal 资料",
      "sourceId": "paypal-flow",
      "driverId": "flows/openai/content/paypal-flow",
      "command": "paypal-hosted-card",
      "flowId": "openai"
    },
    {
      "id": 9,
      "order": 90,
      "key": "paypal-hosted-create-account",
      "title": "无卡直绑确认创建 PayPal",
      "sourceId": "paypal-flow",
      "driverId": "flows/openai/content/paypal-flow",
      "command": "paypal-hosted-create-account",
      "flowId": "openai"
    },
    {
      "id": 10,
      "order": 100,
      "key": "paypal-hosted-review",
      "title": "无卡直绑完成 PayPal 授权",
      "sourceId": "paypal-flow",
      "driverId": "flows/openai/content/paypal-flow",
      "command": "paypal-hosted-review",
      "flowId": "openai"
    },
    {
      "id": 11,
      "order": 110,
      "key": "cpa-session-import",
      "title": "导入当前 ChatGPT 会话到 CPA",
      "sourceId": "vps-panel",
      "driverId": "flows/openai/background/steps/cpa-session-import",
      "command": "cpa-session-import",
      "flowId": "openai"
    }
  ],
  "plusPaypalHostedPhone": [
    {
      "id": 1,
      "order": 10,
      "key": "open-chatgpt",
      "title": "打开 ChatGPT 官网",
      "sourceId": "chatgpt",
      "driverId": null,
      "command": "open-chatgpt",
      "flowId": "openai"
    },
    {
      "id": 2,
      "order": 20,
      "key": "submit-signup-email",
      "title": "注册并输入手机号",
      "sourceId": "openai-auth",
      "driverId": "flows/openai/content/openai-auth",
      "command": "submit-signup-email",
      "flowId": "openai"
    },
    {
      "id": 3,
      "order": 30,
      "key": "fill-password",
      "title": "填写密码并继续",
      "sourceId": "openai-auth",
      "driverId": "flows/openai/content/openai-auth",
      "command": "fill-password",
      "flowId": "openai"
    },
    {
      "id": 4,
      "order": 40,
      "key": "fetch-signup-code",
      "title": "获取手机验证码",
      "sourceId": "openai-auth",
      "driverId": "flows/openai/content/openai-auth",
      "command": "submit-verification-code",
      "mailRuleId": "openai-signup-code",
      "flowId": "openai"
    },
    {
      "id": 5,
      "order": 50,
      "key": "fill-profile",
      "title": "填写姓名和生日",
      "sourceId": "openai-auth",
      "driverId": "flows/openai/content/openai-auth",
      "command": "fill-profile",
      "flowId": "openai"
    },
    {
      "id": 6,
      "order": 60,
      "key": "plus-checkout-create",
      "title": "创建 Plus Checkout",
      "sourceId": "plus-checkout",
      "driverId": "flows/openai/content/plus-checkout",
      "command": "plus-checkout-create",
      "flowId": "openai"
    },
    {
      "id": 7,
      "order": 70,
      "key": "paypal-hosted-email",
      "title": "无卡直绑填写 PayPal 邮箱",
      "sourceId": "paypal-flow",
      "driverId": "flows/openai/content/paypal-flow",
      "command": "paypal-hosted-email",
      "flowId": "openai"
    },
    {
      "id": 8,
      "order": 80,
      "key": "paypal-hosted-card",
      "title": "无卡直绑填写 PayPal 资料",
      "sourceId": "paypal-flow",
      "driverId": "flows/openai/content/paypal-flow",
      "command": "paypal-hosted-card",
      "flowId": "openai"
    },
    {
      "id": 9,
      "order": 90,
      "key": "paypal-hosted-create-account",
      "title": "无卡直绑确认创建 PayPal",
      "sourceId": "paypal-flow",
      "driverId": "flows/openai/content/paypal-flow",
      "command": "paypal-hosted-create-account",
      "flowId": "openai"
    },
    {
      "id": 10,
      "order": 100,
      "key": "paypal-hosted-review",
      "title": "无卡直绑完成 PayPal 授权",
      "sourceId": "paypal-flow",
      "driverId": "flows/openai/content/paypal-flow",
      "command": "paypal-hosted-review",
      "flowId": "openai"
    },
    {
      "id": 11,
      "order": 110,
      "key": "oauth-login",
      "title": "刷新 OAuth 并登录",
      "sourceId": "openai-auth",
      "driverId": "flows/openai/content/openai-auth",
      "command": "oauth-login",
      "flowId": "openai"
    },
    {
      "id": 12,
      "order": 120,
      "key": "fetch-login-code",
      "title": "获取登录验证码",
      "sourceId": "openai-auth",
      "driverId": "flows/openai/content/openai-auth",
      "command": "submit-verification-code",
      "mailRuleId": "openai-login-code",
      "flowId": "openai"
    },
    {
      "id": 13,
      "order": 130,
      "key": "bind-email",
      "title": "绑定邮箱",
      "sourceId": "openai-auth",
      "driverId": "flows/openai/content/openai-auth",
      "command": "bind-email",
      "flowId": "openai"
    },
    {
      "id": 14,
      "order": 140,
      "key": "fetch-bind-email-code",
      "title": "获取绑定邮箱验证码",
      "sourceId": "openai-auth",
      "driverId": "flows/openai/content/openai-auth",
      "command": "fetch-bind-email-code",
      "mailRuleId": "openai-login-code",
      "flowId": "openai"
    },
    {
      "id": 15,
      "order": 150,
      "key": "confirm-oauth",
      "title": "自动确认 OAuth",
      "sourceId": "openai-auth",
      "driverId": "flows/openai/content/openai-auth",
      "command": "confirm-oauth",
      "flowId": "openai"
    },
    {
      "id": 16,
      "order": 160,
      "key": "platform-verify",
      "title": "平台回调验证",
      "sourceId": "platform-panel",
      "driverId": "content/platform-panel",
      "command": "platform-verify",
      "flowId": "openai"
    }
  ],
  "plusPaypalHostedPhoneRelogin": [
    {
      "id": 1,
      "order": 10,
      "key": "open-chatgpt",
      "title": "打开 ChatGPT 官网",
      "sourceId": "chatgpt",
      "driverId": null,
      "command": "open-chatgpt",
      "flowId": "openai"
    },
    {
      "id": 2,
      "order": 20,
      "key": "submit-signup-email",
      "title": "注册并输入手机号",
      "sourceId": "openai-auth",
      "driverId": "flows/openai/content/openai-auth",
      "command": "submit-signup-email",
      "flowId": "openai"
    },
    {
      "id": 3,
      "order": 30,
      "key": "fill-password",
      "title": "填写密码并继续",
      "sourceId": "openai-auth",
      "driverId": "flows/openai/content/openai-auth",
      "command": "fill-password",
      "flowId": "openai"
    },
    {
      "id": 4,
      "order": 40,
      "key": "fetch-signup-code",
      "title": "获取手机验证码",
      "sourceId": "openai-auth",
      "driverId": "flows/openai/content/openai-auth",
      "command": "submit-verification-code",
      "mailRuleId": "openai-signup-code",
      "flowId": "openai"
    },
    {
      "id": 5,
      "order": 50,
      "key": "fill-profile",
      "title": "填写姓名和生日",
      "sourceId": "openai-auth",
      "driverId": "flows/openai/content/openai-auth",
      "command": "fill-profile",
      "flowId": "openai"
    },
    {
      "id": 6,
      "order": 60,
      "key": "plus-checkout-create",
      "title": "创建 Plus Checkout",
      "sourceId": "plus-checkout",
      "driverId": "flows/openai/content/plus-checkout",
      "command": "plus-checkout-create",
      "flowId": "openai"
    },
    {
      "id": 7,
      "order": 70,
      "key": "paypal-hosted-email",
      "title": "无卡直绑填写 PayPal 邮箱",
      "sourceId": "paypal-flow",
      "driverId": "flows/openai/content/paypal-flow",
      "command": "paypal-hosted-email",
      "flowId": "openai"
    },
    {
      "id": 8,
      "order": 80,
      "key": "paypal-hosted-card",
      "title": "无卡直绑填写 PayPal 资料",
      "sourceId": "paypal-flow",
      "driverId": "flows/openai/content/paypal-flow",
      "command": "paypal-hosted-card",
      "flowId": "openai"
    },
    {
      "id": 9,
      "order": 90,
      "key": "paypal-hosted-create-account",
      "title": "无卡直绑确认创建 PayPal",
      "sourceId": "paypal-flow",
      "driverId": "flows/openai/content/paypal-flow",
      "command": "paypal-hosted-create-account",
      "flowId": "openai"
    },
    {
      "id": 10,
      "order": 100,
      "key": "paypal-hosted-review",
      "title": "无卡直绑完成 PayPal 授权",
      "sourceId": "paypal-flow",
      "driverId": "flows/openai/content/paypal-flow",
      "command": "paypal-hosted-review",
      "flowId": "openai"
    },
    {
      "id": 11,
      "order": 110,
      "key": "oauth-login",
      "title": "刷新 OAuth 并登录",
      "sourceId": "openai-auth",
      "driverId": "flows/openai/content/openai-auth",
      "command": "oauth-login",
      "flowId": "openai"
    },
    {
      "id": 12,
      "order": 120,
      "key": "fetch-login-code",
      "title": "获取登录验证码",
      "sourceId": "openai-auth",
      "driverId": "flows/openai/content/openai-auth",
      "command": "submit-verification-code",
      "mailRuleId": "openai-login-code",
      "flowId": "openai"
    },
    {
      "id": 13,
      "order": 130,
      "key": "bind-email",
      "title": "绑定邮箱",
      "sourceId": "openai-auth",
      "driverId": "flows/openai/content/openai-auth",
      "command": "bind-email",
      "flowId": "openai"
    },
    {
      "id": 14,
      "order": 140,
      "key": "fetch-bind-email-code",
      "title": "获取绑定邮箱验证码",
      "sourceId": "openai-auth",
      "driverId": "flows/openai/content/openai-auth",
      "command": "fetch-bind-email-code",
      "mailRuleId": "openai-login-code",
      "flowId": "openai"
    },
    {
      "id": 15,
      "order": 150,
      "key": "relogin-bound-email",
      "title": "绑定邮箱后刷新 OAuth 并登录（邮箱）",
      "sourceId": "openai-auth",
      "driverId": "flows/openai/content/openai-auth",
      "command": "oauth-login",
      "flowId": "openai"
    },
    {
      "id": 16,
      "order": 160,
      "key": "fetch-bound-email-login-code",
      "title": "获取登录验证码（邮箱）",
      "sourceId": "openai-auth",
      "driverId": "flows/openai/content/openai-auth",
      "command": "submit-verification-code",
      "mailRuleId": "openai-login-code",
      "flowId": "openai"
    },
    {
      "id": 17,
      "order": 170,
      "key": "confirm-oauth",
      "title": "自动确认 OAuth",
      "sourceId": "openai-auth",
      "driverId": "flows/openai/content/openai-auth",
      "command": "confirm-oauth",
      "flowId": "openai"
    },
    {
      "id": 18,
      "order": 180,
      "key": "platform-verify",
      "title": "平台回调验证",
      "sourceId": "platform-panel",
      "driverId": "content/platform-panel",
      "command": "platform-verify",
      "flowId": "openai"
    }
  ],
  "plusGpc": [
    {
      "id": 1,
      "order": 10,
      "key": "open-chatgpt",
      "title": "打开 ChatGPT 官网",
      "sourceId": "chatgpt",
      "driverId": null,
      "command": "open-chatgpt",
      "flowId": "openai"
    },
    {
      "id": 2,
      "order": 20,
      "key": "submit-signup-email",
      "title": "注册并输入邮箱",
      "sourceId": "openai-auth",
      "driverId": "flows/openai/content/openai-auth",
      "command": "submit-signup-email",
      "flowId": "openai"
    },
    {
      "id": 3,
      "order": 30,
      "key": "fill-password",
      "title": "填写密码并继续",
      "sourceId": "openai-auth",
      "driverId": "flows/openai/content/openai-auth",
      "command": "fill-password",
      "flowId": "openai"
    },
    {
      "id": 4,
      "order": 40,
      "key": "fetch-signup-code",
      "title": "获取注册验证码",
      "sourceId": "openai-auth",
      "driverId": "flows/openai/content/openai-auth",
      "command": "submit-verification-code",
      "mailRuleId": "openai-signup-code",
      "flowId": "openai"
    },
    {
      "id": 5,
      "order": 50,
      "key": "fill-profile",
      "title": "填写姓名和生日",
      "sourceId": "openai-auth",
      "driverId": "flows/openai/content/openai-auth",
      "command": "fill-profile",
      "flowId": "openai"
    },
    {
      "id": 6,
      "order": 60,
      "key": "plus-checkout-create",
      "title": "打开 GPC 页面并准备",
      "sourceId": "plus-checkout",
      "driverId": "flows/openai/content/plus-checkout",
      "command": "plus-checkout-create",
      "flowId": "openai"
    },
    {
      "id": 7,
      "order": 70,
      "key": "plus-checkout-billing",
      "title": "启动并等待 GPC 完成",
      "sourceId": "plus-checkout",
      "driverId": "flows/openai/content/plus-checkout",
      "command": "plus-checkout-billing",
      "flowId": "openai"
    },
    {
      "id": 10,
      "order": 100,
      "key": "oauth-login",
      "title": "刷新 OAuth 并登录",
      "sourceId": "openai-auth",
      "driverId": "flows/openai/content/openai-auth",
      "command": "oauth-login",
      "flowId": "openai"
    },
    {
      "id": 11,
      "order": 110,
      "key": "fetch-login-code",
      "title": "获取登录验证码",
      "sourceId": "openai-auth",
      "driverId": "flows/openai/content/openai-auth",
      "command": "submit-verification-code",
      "mailRuleId": "openai-login-code",
      "flowId": "openai"
    },
    {
      "id": 12,
      "order": 120,
      "key": "post-login-phone-verification",
      "title": "手机号验证",
      "sourceId": "openai-auth",
      "driverId": "flows/openai/content/openai-auth",
      "command": "post-login-phone-verification",
      "flowId": "openai"
    },
    {
      "id": 13,
      "order": 130,
      "key": "confirm-oauth",
      "title": "自动确认 OAuth",
      "sourceId": "openai-auth",
      "driverId": "flows/openai/content/openai-auth",
      "command": "confirm-oauth",
      "flowId": "openai"
    },
    {
      "id": 14,
      "order": 140,
      "key": "platform-verify",
      "title": "平台回调验证",
      "sourceId": "platform-panel",
      "driverId": "content/platform-panel",
      "command": "platform-verify",
      "flowId": "openai"
    }
  ],
  "plusGpcSub2apiSession": [
    {
      "id": 1,
      "order": 10,
      "key": "open-chatgpt",
      "title": "打开 ChatGPT 官网",
      "sourceId": "chatgpt",
      "driverId": null,
      "command": "open-chatgpt",
      "flowId": "openai"
    },
    {
      "id": 2,
      "order": 20,
      "key": "submit-signup-email",
      "title": "注册并输入邮箱",
      "sourceId": "openai-auth",
      "driverId": "flows/openai/content/openai-auth",
      "command": "submit-signup-email",
      "flowId": "openai"
    },
    {
      "id": 3,
      "order": 30,
      "key": "fill-password",
      "title": "填写密码并继续",
      "sourceId": "openai-auth",
      "driverId": "flows/openai/content/openai-auth",
      "command": "fill-password",
      "flowId": "openai"
    },
    {
      "id": 4,
      "order": 40,
      "key": "fetch-signup-code",
      "title": "获取注册验证码",
      "sourceId": "openai-auth",
      "driverId": "flows/openai/content/openai-auth",
      "command": "submit-verification-code",
      "mailRuleId": "openai-signup-code",
      "flowId": "openai"
    },
    {
      "id": 5,
      "order": 50,
      "key": "fill-profile",
      "title": "填写姓名和生日",
      "sourceId": "openai-auth",
      "driverId": "flows/openai/content/openai-auth",
      "command": "fill-profile",
      "flowId": "openai"
    },
    {
      "id": 6,
      "order": 60,
      "key": "plus-checkout-create",
      "title": "打开 GPC 页面并准备",
      "sourceId": "plus-checkout",
      "driverId": "flows/openai/content/plus-checkout",
      "command": "plus-checkout-create",
      "flowId": "openai"
    },
    {
      "id": 7,
      "order": 70,
      "key": "plus-checkout-billing",
      "title": "启动并等待 GPC 完成",
      "sourceId": "plus-checkout",
      "driverId": "flows/openai/content/plus-checkout",
      "command": "plus-checkout-billing",
      "flowId": "openai"
    },
    {
      "id": 10,
      "order": 100,
      "key": "sub2api-session-import",
      "title": "导入当前 ChatGPT 会话到 SUB2API",
      "sourceId": "sub2api-panel",
      "driverId": "flows/openai/background/steps/sub2api-session-import",
      "command": "sub2api-session-import",
      "flowId": "openai"
    }
  ],
  "plusGpcCpaSession": [
    {
      "id": 1,
      "order": 10,
      "key": "open-chatgpt",
      "title": "打开 ChatGPT 官网",
      "sourceId": "chatgpt",
      "driverId": null,
      "command": "open-chatgpt",
      "flowId": "openai"
    },
    {
      "id": 2,
      "order": 20,
      "key": "submit-signup-email",
      "title": "注册并输入邮箱",
      "sourceId": "openai-auth",
      "driverId": "flows/openai/content/openai-auth",
      "command": "submit-signup-email",
      "flowId": "openai"
    },
    {
      "id": 3,
      "order": 30,
      "key": "fill-password",
      "title": "填写密码并继续",
      "sourceId": "openai-auth",
      "driverId": "flows/openai/content/openai-auth",
      "command": "fill-password",
      "flowId": "openai"
    },
    {
      "id": 4,
      "order": 40,
      "key": "fetch-signup-code",
      "title": "获取注册验证码",
      "sourceId": "openai-auth",
      "driverId": "flows/openai/content/openai-auth",
      "command": "submit-verification-code",
      "mailRuleId": "openai-signup-code",
      "flowId": "openai"
    },
    {
      "id": 5,
      "order": 50,
      "key": "fill-profile",
      "title": "填写姓名和生日",
      "sourceId": "openai-auth",
      "driverId": "flows/openai/content/openai-auth",
      "command": "fill-profile",
      "flowId": "openai"
    },
    {
      "id": 6,
      "order": 60,
      "key": "plus-checkout-create",
      "title": "打开 GPC 页面并准备",
      "sourceId": "plus-checkout",
      "driverId": "flows/openai/content/plus-checkout",
      "command": "plus-checkout-create",
      "flowId": "openai"
    },
    {
      "id": 7,
      "order": 70,
      "key": "plus-checkout-billing",
      "title": "启动并等待 GPC 完成",
      "sourceId": "plus-checkout",
      "driverId": "flows/openai/content/plus-checkout",
      "command": "plus-checkout-billing",
      "flowId": "openai"
    },
    {
      "id": 10,
      "order": 100,
      "key": "cpa-session-import",
      "title": "导入当前 ChatGPT 会话到 CPA",
      "sourceId": "vps-panel",
      "driverId": "flows/openai/background/steps/cpa-session-import",
      "command": "cpa-session-import",
      "flowId": "openai"
    }
  ],
  "plusGpcPhone": [
    {
      "id": 1,
      "order": 10,
      "key": "open-chatgpt",
      "title": "打开 ChatGPT 官网",
      "sourceId": "chatgpt",
      "driverId": null,
      "command": "open-chatgpt",
      "flowId": "openai"
    },
    {
      "id": 2,
      "order": 20,
      "key": "submit-signup-email",
      "title": "注册并输入手机号",
      "sourceId": "openai-auth",
      "driverId": "flows/openai/content/openai-auth",
      "command": "submit-signup-email",
      "flowId": "openai"
    },
    {
      "id": 3,
      "order": 30,
      "key": "fill-password",
      "title": "填写密码并继续",
      "sourceId": "openai-auth",
      "driverId": "flows/openai/content/openai-auth",
      "command": "fill-password",
      "flowId": "openai"
    },
    {
      "id": 4,
      "order": 40,
      "key": "fetch-signup-code",
      "title": "获取手机验证码",
      "sourceId": "openai-auth",
      "driverId": "flows/openai/content/openai-auth",
      "command": "submit-verification-code",
      "mailRuleId": "openai-signup-code",
      "flowId": "openai"
    },
    {
      "id": 5,
      "order": 50,
      "key": "fill-profile",
      "title": "填写姓名和生日",
      "sourceId": "openai-auth",
      "driverId": "flows/openai/content/openai-auth",
      "command": "fill-profile",
      "flowId": "openai"
    },
    {
      "id": 6,
      "order": 60,
      "key": "plus-checkout-create",
      "title": "打开 GPC 页面并准备",
      "sourceId": "plus-checkout",
      "driverId": "flows/openai/content/plus-checkout",
      "command": "plus-checkout-create",
      "flowId": "openai"
    },
    {
      "id": 7,
      "order": 70,
      "key": "plus-checkout-billing",
      "title": "启动并等待 GPC 完成",
      "sourceId": "plus-checkout",
      "driverId": "flows/openai/content/plus-checkout",
      "command": "plus-checkout-billing",
      "flowId": "openai"
    },
    {
      "id": 10,
      "order": 100,
      "key": "oauth-login",
      "title": "刷新 OAuth 并登录",
      "sourceId": "openai-auth",
      "driverId": "flows/openai/content/openai-auth",
      "command": "oauth-login",
      "flowId": "openai"
    },
    {
      "id": 11,
      "order": 110,
      "key": "fetch-login-code",
      "title": "获取登录验证码",
      "sourceId": "openai-auth",
      "driverId": "flows/openai/content/openai-auth",
      "command": "submit-verification-code",
      "mailRuleId": "openai-login-code",
      "flowId": "openai"
    },
    {
      "id": 12,
      "order": 120,
      "key": "bind-email",
      "title": "绑定邮箱",
      "sourceId": "openai-auth",
      "driverId": "flows/openai/content/openai-auth",
      "command": "bind-email",
      "flowId": "openai"
    },
    {
      "id": 13,
      "order": 130,
      "key": "fetch-bind-email-code",
      "title": "获取绑定邮箱验证码",
      "sourceId": "openai-auth",
      "driverId": "flows/openai/content/openai-auth",
      "command": "fetch-bind-email-code",
      "mailRuleId": "openai-login-code",
      "flowId": "openai"
    },
    {
      "id": 14,
      "order": 140,
      "key": "confirm-oauth",
      "title": "自动确认 OAuth",
      "sourceId": "openai-auth",
      "driverId": "flows/openai/content/openai-auth",
      "command": "confirm-oauth",
      "flowId": "openai"
    },
    {
      "id": 15,
      "order": 150,
      "key": "platform-verify",
      "title": "平台回调验证",
      "sourceId": "platform-panel",
      "driverId": "content/platform-panel",
      "command": "platform-verify",
      "flowId": "openai"
    }
  ],
  "plusGpcPhoneRelogin": [
    {
      "id": 1,
      "order": 10,
      "key": "open-chatgpt",
      "title": "打开 ChatGPT 官网",
      "sourceId": "chatgpt",
      "driverId": null,
      "command": "open-chatgpt",
      "flowId": "openai"
    },
    {
      "id": 2,
      "order": 20,
      "key": "submit-signup-email",
      "title": "注册并输入手机号",
      "sourceId": "openai-auth",
      "driverId": "flows/openai/content/openai-auth",
      "command": "submit-signup-email",
      "flowId": "openai"
    },
    {
      "id": 3,
      "order": 30,
      "key": "fill-password",
      "title": "填写密码并继续",
      "sourceId": "openai-auth",
      "driverId": "flows/openai/content/openai-auth",
      "command": "fill-password",
      "flowId": "openai"
    },
    {
      "id": 4,
      "order": 40,
      "key": "fetch-signup-code",
      "title": "获取手机验证码",
      "sourceId": "openai-auth",
      "driverId": "flows/openai/content/openai-auth",
      "command": "submit-verification-code",
      "mailRuleId": "openai-signup-code",
      "flowId": "openai"
    },
    {
      "id": 5,
      "order": 50,
      "key": "fill-profile",
      "title": "填写姓名和生日",
      "sourceId": "openai-auth",
      "driverId": "flows/openai/content/openai-auth",
      "command": "fill-profile",
      "flowId": "openai"
    },
    {
      "id": 6,
      "order": 60,
      "key": "plus-checkout-create",
      "title": "打开 GPC 页面并准备",
      "sourceId": "plus-checkout",
      "driverId": "flows/openai/content/plus-checkout",
      "command": "plus-checkout-create",
      "flowId": "openai"
    },
    {
      "id": 7,
      "order": 70,
      "key": "plus-checkout-billing",
      "title": "启动并等待 GPC 完成",
      "sourceId": "plus-checkout",
      "driverId": "flows/openai/content/plus-checkout",
      "command": "plus-checkout-billing",
      "flowId": "openai"
    },
    {
      "id": 10,
      "order": 100,
      "key": "oauth-login",
      "title": "刷新 OAuth 并登录",
      "sourceId": "openai-auth",
      "driverId": "flows/openai/content/openai-auth",
      "command": "oauth-login",
      "flowId": "openai"
    },
    {
      "id": 11,
      "order": 110,
      "key": "fetch-login-code",
      "title": "获取登录验证码",
      "sourceId": "openai-auth",
      "driverId": "flows/openai/content/openai-auth",
      "command": "submit-verification-code",
      "mailRuleId": "openai-login-code",
      "flowId": "openai"
    },
    {
      "id": 12,
      "order": 120,
      "key": "bind-email",
      "title": "绑定邮箱",
      "sourceId": "openai-auth",
      "driverId": "flows/openai/content/openai-auth",
      "command": "bind-email",
      "flowId": "openai"
    },
    {
      "id": 13,
      "order": 130,
      "key": "fetch-bind-email-code",
      "title": "获取绑定邮箱验证码",
      "sourceId": "openai-auth",
      "driverId": "flows/openai/content/openai-auth",
      "command": "fetch-bind-email-code",
      "mailRuleId": "openai-login-code",
      "flowId": "openai"
    },
    {
      "id": 14,
      "order": 140,
      "key": "relogin-bound-email",
      "title": "绑定邮箱后刷新 OAuth 并登录（邮箱）",
      "sourceId": "openai-auth",
      "driverId": "flows/openai/content/openai-auth",
      "command": "oauth-login",
      "flowId": "openai"
    },
    {
      "id": 15,
      "order": 150,
      "key": "fetch-bound-email-login-code",
      "title": "获取登录验证码（邮箱）",
      "sourceId": "openai-auth",
      "driverId": "flows/openai/content/openai-auth",
      "command": "submit-verification-code",
      "mailRuleId": "openai-login-code",
      "flowId": "openai"
    },
    {
      "id": 16,
      "order": 160,
      "key": "post-bound-email-phone-verification",
      "title": "手机号验证",
      "sourceId": "openai-auth",
      "driverId": "flows/openai/content/openai-auth",
      "command": "post-login-phone-verification",
      "flowId": "openai"
    },
    {
      "id": 17,
      "order": 170,
      "key": "confirm-oauth",
      "title": "自动确认 OAuth",
      "sourceId": "openai-auth",
      "driverId": "flows/openai/content/openai-auth",
      "command": "confirm-oauth",
      "flowId": "openai"
    },
    {
      "id": 18,
      "order": 180,
      "key": "platform-verify",
      "title": "平台回调验证",
      "sourceId": "platform-panel",
      "driverId": "content/platform-panel",
      "command": "platform-verify",
      "flowId": "openai"
    }
  ]
});

  // Plus 自动充值渠道与 GPC 渠道流程同构（发起 → 轮询等待完成 → 后续登录接入），
  // 因此从 plusGpc* 变体派生 plusAuto* 变体，仅替换 step6/step7 的标题文案，
  // 避免手写复制整组步骤定义造成重复。
  const AUTO_STEP_TITLE_OVERRIDES = {
    'plus-checkout-create': '发起 Plus 自动充值',
    'plus-checkout-billing': '等待 Plus 自动充值完成',
  };

  function deriveAutoVariantSteps(gpcSteps = []) {
    return gpcSteps.map((step) => {
      const overrideTitle = AUTO_STEP_TITLE_OVERRIDES[String(step?.key || '').trim()];
      return overrideTitle ? { ...step, title: overrideTitle } : { ...step };
    });
  }

  Object.keys(STEP_VARIANTS_RAW)
    .filter((variantKey) => variantKey.startsWith('plusGpc'))
    .forEach((gpcVariantKey) => {
      const autoVariantKey = gpcVariantKey.replace(/^plusGpc/, 'plusAuto');
      STEP_VARIANTS_RAW[autoVariantKey] = deriveAutoVariantSteps(STEP_VARIANTS_RAW[gpcVariantKey]);
    });

  const STEP_VARIANTS = freezeDeep(STEP_VARIANTS_RAW);

  const PLUS_PAYMENT_CHAIN_STEP_KEYS = Object.freeze([
    'plus-checkout-create',
    'plus-checkout-billing',
    'paypal-approve',
    'plus-checkout-return',
    'paypal-hosted-email',
    'paypal-hosted-card',
    'paypal-hosted-create-account',
    'paypal-hosted-review',

  ]);
  const POST_LOGIN_PHONE_VERIFICATION_STEP_KEYS = Object.freeze([
    'post-login-phone-verification',
    'post-bound-email-phone-verification',
  ]);
  const OPENAI_WEBCHAT_OMITTED_STEP_KEYS = Object.freeze([
    'oauth-login',
    'fetch-login-code',
    'bind-email',
    'fetch-bind-email-code',
    'relogin-bound-email',
    'fetch-bound-email-login-code',
    'post-login-phone-verification',
    'post-bound-email-phone-verification',
    'confirm-oauth',
    'platform-verify',
  ]);

  function omitPlusPaymentChainSteps(steps = []) {
    return steps.filter((step) => !PLUS_PAYMENT_CHAIN_STEP_KEYS.includes(String(step?.key || '').trim()));
  }

  function omitPostLoginPhoneVerificationSteps(steps = []) {
    return steps.filter((step) => !POST_LOGIN_PHONE_VERIFICATION_STEP_KEYS.includes(String(step?.key || '').trim()));
  }

  function omitOpenAiWebchatPublicationSteps(steps = []) {
    return steps.filter((step) => !OPENAI_WEBCHAT_OMITTED_STEP_KEYS.includes(String(step?.key || '').trim()));
  }

  function reindexModeStepDefinitions(steps = []) {
    return (Array.isArray(steps) ? steps : []).map((step, index) => ({
      ...step,
      id: index + 1,
      order: (index + 1) * 10,
    }));
  }

  function getOpenAiWebchatUploadStep() {
    return {
      key: OPENAI_WEBCHAT_UPLOAD_STEP_KEY,
      title: '上传 ChatGPT 会话到 webchat',
      sourceId: 'openai-webchat',
      driverId: 'flows/openai/background/publisher-webchat',
      command: OPENAI_WEBCHAT_UPLOAD_STEP_KEY,
      flowId: 'openai',
    };
  }

  function getPlusRegistrationWaitStep() {
    const sourceStep = STEP_VARIANTS.normal.find((step) => step.key === PLUS_REGISTRATION_WAIT_STEP_KEY);
    return {
      ...(sourceStep || {
        key: PLUS_REGISTRATION_WAIT_STEP_KEY,
        title: '等待注册成功',
        sourceId: 'chatgpt',
        driverId: null,
        command: PLUS_REGISTRATION_WAIT_STEP_KEY,
        flowId: 'openai',
      }),
      id: 6,
      order: 60,
    };
  }

  function shiftPlusStepAfterRegistrationWait(step = {}) {
    const nextStep = { ...step };
    const id = Number(step.id);
    const order = Number(step.order);
    if (Number.isFinite(id)) {
      nextStep.id = id + 1;
    }
    if (Number.isFinite(order)) {
      nextStep.order = order + 10;
    }
    return nextStep;
  }

  function insertPlusRegistrationWaitStep(steps = []) {
    if (!Array.isArray(steps) || steps.some((step) => step.key === PLUS_REGISTRATION_WAIT_STEP_KEY)) {
      return steps;
    }
    const fillProfileIndex = steps.findIndex((step) => step.key === 'fill-profile');
    if (fillProfileIndex < 0) {
      return steps;
    }
    return steps.flatMap((step, index) => {
      if (index < fillProfileIndex) {
        return [step];
      }
      if (index === fillProfileIndex) {
        return [step, getPlusRegistrationWaitStep()];
      }
      return [shiftPlusStepAfterRegistrationWait(step)];
    });
  }

  function isPlusModeEnabled(options = {}) {
    return Boolean(options?.plusModeEnabled || options?.plusMode);
  }

  function normalizePlusPaymentMethod(value = '') {
    const normalized = String(value || '').trim().toLowerCase();
    if (normalized === PLUS_PAYMENT_METHOD_NONE || normalized === 'no-payment' || normalized === 'skip-payment') {
      return PLUS_PAYMENT_METHOD_NONE;
    }
    if (normalized === PLUS_PAYMENT_METHOD_PAYPAL_HOSTED || normalized === 'paypal_direct' || normalized === 'paypal-direct') {
      return PLUS_PAYMENT_METHOD_PAYPAL_HOSTED;
    }
    if (normalized === PLUS_PAYMENT_METHOD_GPC_HELPER) {
      return PLUS_PAYMENT_METHOD_GPC_HELPER;
    }
    if (normalized === PLUS_PAYMENT_METHOD_AUTO || normalized === 'pix' || normalized === 'pix_plus' || normalized === 'pixplus') {
      return PLUS_PAYMENT_METHOD_AUTO;
    }
    return PLUS_PAYMENT_METHOD_PAYPAL;
  }

  function normalizeSignupMethod(value = '') {
    return String(value || '').trim().toLowerCase() === SIGNUP_METHOD_PHONE
      ? SIGNUP_METHOD_PHONE
      : SIGNUP_METHOD_EMAIL;
  }

  function isPhoneSignupReloginAfterBindEmailEnabled(options = {}) {
    return Boolean(options?.phoneSignupReloginAfterBindEmailEnabled);
  }

  function isPhoneVerificationEnabled(options = {}) {
    if (Object.prototype.hasOwnProperty.call(options || {}, 'phoneVerificationEnabled')) {
      return Boolean(options.phoneVerificationEnabled);
    }
    return true;
  }

  function isOpenAiWebchatUploadEnabled(options = {}) {
    if (String(options?.targetId || '').trim().toLowerCase() === OPENAI_WEBCHAT_TARGET_ID) {
      return true;
    }
    return false;
  }

  function isOpenAiWebchatTarget(options = {}) {
    return String(options?.targetId || '').trim().toLowerCase() === OPENAI_WEBCHAT_TARGET_ID;
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

  function resolveVariantKey(options = {}) {
    const signupMethod = normalizeSignupMethod(options?.resolvedSignupMethod || options?.signupMethod);
    const reloginAfterBindEmail = signupMethod === SIGNUP_METHOD_PHONE && isPhoneSignupReloginAfterBindEmailEnabled(options);
    if (!isPlusModeEnabled(options)) {
      if (signupMethod === SIGNUP_METHOD_PHONE) {
        return reloginAfterBindEmail ? 'normalPhoneRelogin' : 'normalPhone';
      }
      return 'normal';
    }

    const plusAccountAccessStrategy = normalizePlusAccountAccessStrategy(options?.plusAccountAccessStrategy);
    const paymentMethod = normalizePlusPaymentMethod(options?.plusPaymentMethod || options?.paymentMethod);
    if (paymentMethod === PLUS_PAYMENT_METHOD_PAYPAL_HOSTED) {
      if (signupMethod === SIGNUP_METHOD_PHONE) {
        return reloginAfterBindEmail ? 'plusPaypalHostedPhoneRelogin' : 'plusPaypalHostedPhone';
      }
      if (plusAccountAccessStrategy === PLUS_ACCOUNT_ACCESS_STRATEGY_SUB2API_CODEX_SESSION) {
        return 'plusPaypalHostedSub2apiSession';
      }
      if (plusAccountAccessStrategy === PLUS_ACCOUNT_ACCESS_STRATEGY_CPA_CODEX_SESSION) {
        return 'plusPaypalHostedCpaSession';
      }
      return 'plusPaypalHosted';
    }

    if (paymentMethod === PLUS_PAYMENT_METHOD_GPC_HELPER) {
      if (signupMethod === SIGNUP_METHOD_PHONE) {
        return reloginAfterBindEmail ? 'plusGpcPhoneRelogin' : 'plusGpcPhone';
      }
      if (plusAccountAccessStrategy === PLUS_ACCOUNT_ACCESS_STRATEGY_SUB2API_CODEX_SESSION) {
        return 'plusGpcSub2apiSession';
      }
      if (plusAccountAccessStrategy === PLUS_ACCOUNT_ACCESS_STRATEGY_CPA_CODEX_SESSION) {
        return 'plusGpcCpaSession';
      }
      return 'plusGpc';
    }

    if (paymentMethod === PLUS_PAYMENT_METHOD_AUTO) {
      if (signupMethod === SIGNUP_METHOD_PHONE) {
        return reloginAfterBindEmail ? 'plusAutoPhoneRelogin' : 'plusAutoPhone';
      }
      if (plusAccountAccessStrategy === PLUS_ACCOUNT_ACCESS_STRATEGY_SUB2API_CODEX_SESSION) {
        return 'plusAutoSub2apiSession';
      }
      if (plusAccountAccessStrategy === PLUS_ACCOUNT_ACCESS_STRATEGY_CPA_CODEX_SESSION) {
        return 'plusAutoCpaSession';
      }
      return 'plusAuto';
    }

    if (signupMethod === SIGNUP_METHOD_PHONE) {
      return reloginAfterBindEmail ? 'plusPaypalPhoneRelogin' : 'plusPaypalPhone';
    }
    if (plusAccountAccessStrategy === PLUS_ACCOUNT_ACCESS_STRATEGY_SUB2API_CODEX_SESSION) {
      return 'plusPaypalSub2apiSession';
    }
    if (plusAccountAccessStrategy === PLUS_ACCOUNT_ACCESS_STRATEGY_CPA_CODEX_SESSION) {
      return 'plusPaypalCpaSession';
    }
    return 'plusPaypal';
  }

  function getVariantStepDefinitions(variantKey) {
    return Array.isArray(STEP_VARIANTS[variantKey]) ? STEP_VARIANTS[variantKey] : STEP_VARIANTS.normal;
  }

  function getModeStepDefinitions(options = {}) {
    const isPlusMode = isPlusModeEnabled(options);
    let steps = getVariantStepDefinitions(resolveVariantKey(options));
    if (isPlusMode) {
      steps = insertPlusRegistrationWaitStep(steps);
    }
    if (
      isPlusMode
      && normalizePlusPaymentMethod(options?.plusPaymentMethod || options?.paymentMethod) === PLUS_PAYMENT_METHOD_NONE
    ) {
      steps = omitPlusPaymentChainSteps(steps);
    }
    if (!isPhoneVerificationEnabled(options)) {
      steps = omitPostLoginPhoneVerificationSteps(steps);
    }
    if (isOpenAiWebchatTarget(options)) {
      steps = omitOpenAiWebchatPublicationSteps(steps);
    }
    if (isOpenAiWebchatUploadEnabled(options) && !steps.some((step) => step.key === OPENAI_WEBCHAT_UPLOAD_STEP_KEY)) {
      steps = [
        ...steps,
        getOpenAiWebchatUploadStep(),
      ];
    }
    return reindexModeStepDefinitions(steps);
  }

  function getAllSteps() {
    const keyed = new Map();
    Object.entries(STEP_VARIANTS).forEach(([variantKey, steps]) => {
      const variantSteps = String(variantKey || '').startsWith('plus')
        ? insertPlusRegistrationWaitStep(steps)
        : steps;
      reindexModeStepDefinitions(variantSteps).forEach((step) => {
        keyed.set(`${step.id}:${step.key}`, step);
      });
    });
    const uploadStep = reindexModeStepDefinitions([
      ...STEP_VARIANTS.normal,
      getOpenAiWebchatUploadStep(),
    ]).at(-1);
    if (uploadStep) {
      keyed.set(`${uploadStep.id}:${uploadStep.key}`, uploadStep);
    }
    return Array.from(keyed.values()).sort((left, right) => {
      const leftOrder = Number.isFinite(left.order) ? left.order : left.id;
      const rightOrder = Number.isFinite(right.order) ? right.order : right.id;
      if (leftOrder !== rightOrder) return leftOrder - rightOrder;
      return left.id - right.id;
    });
  }

  function getPlusPaymentStepTitle(options = {}) {
    if (!isPlusModeEnabled(options)) {
      return '';
    }
    const paymentStep = getModeStepDefinitions({
      ...options,
      plusModeEnabled: true,
    }).find((step) => step.key === PLUS_PAYMENT_STEP_KEY);
    return paymentStep?.title || '';
  }

  function resolveStepTitle(step = {}) {
    return step?.title || '';
  }

  return {
    flowId: 'openai',
    getAllSteps,
    getModeStepDefinitions,
    getPlusPaymentStepTitle,
    getVariantStepDefinitions,
    isPlusModeEnabled,
    normalizePlusPaymentMethod,
    normalizePlusAccountAccessStrategy,
    normalizeSignupMethod,
    resolveStepTitle,
  };
});
