(function attachMultiPageKiroWorkflow(root, factory) {
  root.MultiPageKiroWorkflow = factory();
})(typeof self !== 'undefined' ? self : globalThis, function createMultiPageKiroWorkflow() {
  const KIRO_CONTRIBUTION_STEP_TITLE = 'Contribution upload';

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
  "default": [
    {
      "id": 1,
      "order": 10,
      "key": "kiro-open-register-page",
      "title": "Open signup page",
      "sourceId": "kiro-register-page",
      "driverId": "flows/kiro/background/register-runner",
      "command": "kiro-open-register-page",
      "flowId": "kiro"
    },
    {
      "id": 2,
      "order": 20,
      "key": "kiro-submit-email",
      "title": "Get email and continue",
      "sourceId": "kiro-register-page",
      "driverId": "flows/kiro/background/register-runner",
      "command": "kiro-submit-email",
      "flowId": "kiro"
    },
    {
      "id": 3,
      "order": 30,
      "key": "kiro-submit-name",
      "title": "Fill in name and continue",
      "sourceId": "kiro-register-page",
      "driverId": "flows/kiro/background/register-runner",
      "command": "kiro-submit-name",
      "flowId": "kiro"
    },
    {
      "id": 4,
      "order": 40,
      "key": "kiro-submit-verification-code",
      "title": "Get verification code and continue",
      "sourceId": "kiro-register-page",
      "driverId": "flows/kiro/background/register-runner",
      "command": "kiro-submit-verification-code",
      "flowId": "kiro"
    },
    {
      "id": 5,
      "order": 50,
      "key": "kiro-submit-password",
      "title": "Set password and continue",
      "sourceId": "kiro-register-page",
      "driverId": "flows/kiro/background/register-runner",
      "command": "kiro-submit-password",
      "flowId": "kiro"
    },
    {
      "id": 6,
      "order": 60,
      "key": "kiro-complete-register-consent",
      "title": "Complete signup authorization",
      "sourceId": "kiro-register-page",
      "driverId": "flows/kiro/background/register-runner",
      "command": "kiro-complete-register-consent",
      "flowId": "kiro"
    },
    {
      "id": 7,
      "order": 70,
      "key": "kiro-start-desktop-authorize",
      "title": "Start desktop authorization",
      "sourceId": "kiro-desktop-authorize",
      "driverId": "flows/kiro/background/desktop-authorize-runner",
      "command": "kiro-start-desktop-authorize",
      "flowId": "kiro"
    },
    {
      "id": 8,
      "order": 80,
      "key": "kiro-complete-desktop-authorize",
      "title": "Complete desktop authorization",
      "sourceId": "kiro-desktop-authorize",
      "driverId": "flows/kiro/background/desktop-authorize-runner",
      "command": "kiro-complete-desktop-authorize",
      "flowId": "kiro"
    },
    {
      "id": 9,
      "order": 90,
      "key": "kiro-upload-credential",
      "title": "Upload credentials to kiro.rs",
      "sourceId": "kiro-rs-admin",
      "driverId": "flows/kiro/background/publisher-kiro-rs",
      "command": "kiro-upload-credential",
      "flowId": "kiro"
    }
  ]
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

  function resolveStepTitle(step = {}, options = {}) {
    if (step?.key === 'kiro-upload-credential' && Boolean(options?.accountContributionEnabled || options?.state?.accountContributionEnabled)) {
      return KIRO_CONTRIBUTION_STEP_TITLE;
    }
    return step?.title || '';
  }

  return {
    flowId: 'kiro',
    getAllSteps,
    getModeStepDefinitions,
    getPlusPaymentStepTitle,
    getVariantStepDefinitions,
    resolveStepTitle,
  };
});
