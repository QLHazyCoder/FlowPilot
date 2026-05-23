(function attachMultiPageGrokFlowDefinition(root, factory) {
  root.MultiPageGrokFlowDefinition = factory();
})(typeof self !== 'undefined' ? self : globalThis, function createMultiPageGrokFlowDefinition() {
  function freezeDeep(entry) {
    if (!entry || typeof entry !== 'object' || Object.isFrozen(entry)) {
      return entry;
    }
    Object.getOwnPropertyNames(entry).forEach((key) => {
      freezeDeep(entry[key]);
    });
    return Object.freeze(entry);
  }

  const VALUE = freezeDeep({
    id: 'grok',
    label: 'Grok / xAI',
    services: [
      'account',
      'email',
      'proxy',
    ],
    capabilities: {
      supportsEmailSignup: true,
      supportsPhoneSignup: false,
      supportsPhoneVerificationSettings: false,
      supportsPlusMode: false,
      supportsContributionMode: false,
      supportsAccountContribution: false,
      supportsOpenAiOAuthContribution: false,
      contributionAdapterIds: [],
      supportedTargetIds: ['webchat2api'],
      supportsLuckmail: false,
      supportsOauthTimeoutBudget: false,
      canSwitchFlow: true,
      stepDefinitionMode: 'grok',
      targetSelectorLabel: '来源',
    },
    baseGroups: ['grok-runtime-status'],
    targets: {
      webchat2api: {
        id: 'webchat2api',
        label: 'webchat2api',
        groups: [
          'grok-target-webchat2api',
        ],
      },
    },
    publicationTargets: {},
    runtimeSources: {
      'grok-register-page': {
        flowId: 'grok',
        kind: 'flow-page',
        label: 'Grok 注册页',
        readyPolicy: 'top-frame-only',
        family: 'grok-register-page-family',
        driverId: 'flows/grok/content/register-page',
        cleanupScopes: [],
        detectionMatchers: [
          {
            hostnames: [
              'accounts.x.ai',
              'x.ai',
              'grok.com',
            ],
            hostnameEndsWith: [
              '.x.ai',
              '.grok.com',
            ],
            matchMode: 'any',
          },
        ],
        familyMatchers: [
          {
            hostnames: [
              'accounts.x.ai',
              'x.ai',
              'grok.com',
            ],
            hostnameEndsWith: [
              '.x.ai',
              '.grok.com',
            ],
            matchMode: 'any',
          },
        ],
      },
    },
    driverDefinitions: {
      'flows/grok/content/register-page': {
        sourceId: 'grok-register-page',
        commands: [
          'grok-open-signup-page',
          'grok-submit-email',
          'grok-submit-verification-code',
          'grok-submit-profile',
          'grok-extract-sso-cookie',
          'grok-remote-sso-inject',
        ],
      },
      'flows/grok/background/register-runner': {
        sourceId: 'grok-register-page',
        commands: [
          'grok-open-signup-page',
          'grok-submit-email',
          'grok-submit-verification-code',
          'grok-submit-profile',
          'grok-extract-sso-cookie',
          'grok-remote-sso-inject',
        ],
      },
    },
    defaultTargetId: 'webchat2api',
    settingsDefaults: {
      grokRemoteAccountInjectUrl: '',
      grokRemoteAccountInjectAdminKey: '',
      autoRun: {
        stepExecutionRange: {
          enabled: false,
          fromStep: 1,
          toStep: 6,
        },
      },
    },
    settingsGroups: {
      'grok-target-webchat2api': {
        id: 'grok-target-webchat2api',
        label: 'webchat2api',
        rowIds: [
          'row-grok-sso-settings',
          'row-grok-remote-account-inject-url',
          'row-grok-remote-account-inject-admin-key',
        ],
      },
      'grok-runtime-status': {
        id: 'grok-runtime-status',
        label: 'Grok 运行态',
        rowIds: [
          'row-grok-register-status',
          'row-grok-sso-status',
        ],
      },
    },
    sourceAliases: {},
  });

  return VALUE;
});
