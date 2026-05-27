(function attachMultiPageGrokWorkflow(root, factory) {
  root.MultiPageGrokWorkflow = factory();
})(typeof self !== 'undefined' ? self : globalThis, function createMultiPageGrokWorkflow() {
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
        key: 'grok-open-signup-page',
        title: 'Open Grok signup page',
        sourceId: 'grok-register-page',
        driverId: 'flows/grok/background/register-runner',
        command: 'grok-open-signup-page',
        flowId: 'grok',
      },
      {
        id: 2,
        order: 20,
        key: 'grok-submit-email',
        title: 'Get email and continue',
        sourceId: 'grok-register-page',
        driverId: 'flows/grok/background/register-runner',
        command: 'grok-submit-email',
        flowId: 'grok',
      },
      {
        id: 3,
        order: 30,
        key: 'grok-submit-verification-code',
        title: 'Get verification code and continue',
        sourceId: 'grok-register-page',
        driverId: 'flows/grok/background/register-runner',
        command: 'grok-submit-verification-code',
        mailRuleId: 'grok-submit-verification-code',
        flowId: 'grok',
      },
      {
        id: 4,
        order: 40,
        key: 'grok-submit-profile',
        title: 'Fill in profile and continue',
        sourceId: 'grok-register-page',
        driverId: 'flows/grok/background/register-runner',
        command: 'grok-submit-profile',
        flowId: 'grok',
      },
      {
        id: 5,
        order: 50,
        key: 'grok-extract-sso-cookie',
        title: 'Extract SSO Cookie',
        sourceId: 'grok-register-page',
        driverId: 'flows/grok/background/register-runner',
        command: 'grok-extract-sso-cookie',
        flowId: 'grok',
      },
      {
        id: 6,
        order: 60,
        key: 'grok-upload-sso-to-webchat2api',
        title: 'Upload SSO to webchat2api',
        sourceId: 'grok-webchat2api',
        driverId: 'flows/grok/background/publisher-webchat2api',
        command: 'grok-upload-sso-to-webchat2api',
        flowId: 'grok',
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
    flowId: 'grok',
    getAllSteps,
    getModeStepDefinitions,
    getPlusPaymentStepTitle,
    getVariantStepDefinitions,
    resolveStepTitle,
  };
});
