(function attachMultiPageOpenAiReauthWorkflow(root, factory) {
  root.MultiPageOpenAiReauthWorkflow = factory();
})(typeof self !== 'undefined' ? self : globalThis, function createMultiPageOpenAiReauthWorkflow() {
  function freezeDeep(entry) {
    if (!entry || typeof entry !== 'object' || Object.isFrozen(entry)) {
      return entry;
    }
    Object.getOwnPropertyNames(entry).forEach((key) => {
      freezeDeep(entry[key]);
    });
    return Object.freeze(entry);
  }

  const STEP_VARIANTS = freezeDeep({
    default: [
      {
        id: 1,
        order: 10,
        key: 'prepare-reauth',
        title: '准备授权（清 cookie / 生成 PKCE / 打开认证页）',
        sourceId: 'openai-auth',
        driverId: null,
        command: 'prepare-reauth',
        flowId: 'openai-reauth',
      },
      {
        id: 2,
        order: 20,
        key: 'submit-reauth-email',
        title: '提交邮箱并等待验证码页',
        sourceId: 'openai-auth',
        driverId: 'flows/openai/content/openai-auth',
        command: 'oauth-login',
        flowId: 'openai-reauth',
      },
      {
        id: 3,
        order: 30,
        key: 'fetch-reauth-code',
        title: '收取邮箱验证码并填回',
        sourceId: 'openai-auth',
        driverId: 'flows/openai/content/openai-auth',
        command: 'submit-verification-code',
        mailRuleId: 'openai-reauth-code',
        flowId: 'openai-reauth',
      },
      {
        id: 4,
        order: 40,
        key: 'capture-reauth-callback',
        title: '抓取 localhost 回调并换取新 Token',
        sourceId: 'openai-auth',
        driverId: null,
        command: 'capture-reauth-callback',
        flowId: 'openai-reauth',
      },
    ],
  });

  function getVariantStepDefinitions(variantKey = 'default') {
    return Array.isArray(STEP_VARIANTS[variantKey]) ? STEP_VARIANTS[variantKey] : STEP_VARIANTS.default;
  }

  function getModeStepDefinitions() {
    return getVariantStepDefinitions('default');
  }

  function getAllSteps() {
    return getVariantStepDefinitions('default');
  }

  function getPlusPaymentStepTitle() {
    return '';
  }

  function resolveStepTitle(step = {}) {
    return step?.title || '';
  }

  return {
    flowId: 'openai-reauth',
    getAllSteps,
    getModeStepDefinitions,
    getPlusPaymentStepTitle,
    getVariantStepDefinitions,
    resolveStepTitle,
  };
});
