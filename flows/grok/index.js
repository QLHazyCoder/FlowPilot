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
      supportedTargetIds: ['webchat2api', 'grok2api', 'sub2api'],
      supportsLuckmail: false,
      canSwitchFlow: true,
      stepDefinitionMode: 'grok',
      targetSelectorLabel: '来源',
    },
    baseGroups: ['grok-runtime-status', 'shared-auto-run'],
    targets: {
      webchat2api: {
        id: 'webchat2api',
        label: 'webchat2api',
        groups: [
          'grok-target-webchat2api',
        ],
        defaultState: {
          baseUrl: '',
          apiKey: '',
        },
      },
      grok2api: {
        id: 'grok2api',
        label: 'grok2api',
        groups: [
          'grok-target-grok2api',
        ],
        defaultState: {
          baseUrl: '',
          apiKey: '',
        },
      },
      sub2api: {
        id: 'sub2api',
        label: 'SUB2API',
        groups: [
          'grok-target-sub2api',
        ],
        defaultState: {
          sub2apiUrl: '',
          sub2apiEmail: '',
          sub2apiPassword: '',
          sub2apiGroupName: '',
          sub2apiGroupNames: [],
          sub2apiAccountPriority: 1,
          sub2apiDefaultProxyName: '',
          grok2apiUploadEnabled: false,
        },
      },
    },
    publicationTargets: {},
    runtimeSources: {
      'grok-sub2api-oauth-page': {
        flowId: 'grok',
        kind: 'oauth-page',
        label: 'Grok SUB2API OAuth 授权页',
        readyPolicy: 'top-frame-only',
        family: 'grok-sub2api-oauth-page-family',
        driverId: 'flows/grok/content/sub2api-oauth-page',
        cleanupScopes: [],
        detectionMatchers: [
          {
            hostnames: ['auth.x.ai', 'accounts.x.ai'],
            pathPrefixes: ['/oauth2/'],
          },
        ],
        familyMatchers: [
          {
            hostnames: ['auth.x.ai', 'accounts.x.ai'],
            pathPrefixes: ['/oauth2/'],
          },
        ],
      },
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
        ],
      },
      'flows/grok/background/publisher-webchat2api': {
        sourceId: 'grok-webchat2api',
        commands: [
          'grok-upload-sso-to-webchat2api',
        ],
      },
      'flows/grok/background/publisher-grok2api': {
        sourceId: 'grok-grok2api',
        commands: [
          'grok-upload-sso-to-grok2api',
        ],
      },
      'flows/grok/background/sub2api-oauth-runner': {
        sourceId: 'grok-sub2api-oauth-page',
        commands: [
          'grok-start-sub2api-oauth',
          'grok-complete-sub2api-oauth',
        ],
      },
      'flows/grok/content/sub2api-oauth-page': {
        sourceId: 'grok-sub2api-oauth-page',
        commands: [
          'grok-start-sub2api-oauth',
          'grok-complete-sub2api-oauth',
        ],
      },
    },
    defaultTargetId: 'webchat2api',
    settingsDefaults: {
      targets: {
        webchat2api: {
          baseUrl: '',
          apiKey: '',
        },
        grok2api: {
          baseUrl: '',
          apiKey: '',
        },
        sub2api: {
          sub2apiUrl: '',
          sub2apiEmail: '',
          sub2apiPassword: '',
          sub2apiGroupName: '',
          sub2apiGroupNames: [],
          sub2apiAccountPriority: 1,
          sub2apiDefaultProxyName: '',
          grok2apiUploadEnabled: false,
        },
      },
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
          'row-grok-webchat2api-url',
          'row-grok-webchat2api-key',
        ],
      },
      'grok-target-grok2api': {
        id: 'grok-target-grok2api',
        label: 'grok2api',
        rowIds: [
          'row-grok2api-url',
          'row-grok2api-key',
        ],
      },
      'grok-target-sub2api': {
        id: 'grok-target-sub2api',
        label: 'SUB2API',
        rowIds: [
          'row-sub2api-url',
          'row-sub2api-email',
          'row-sub2api-password',
          'row-sub2api-connection-test',
          'row-grok-sub2api-grok2api-upload',
          'row-grok2api-url',
          'row-grok2api-key',
          'row-grok-sub2api-group',
          'row-grok-sub2api-account-priority',
          'row-grok-sub2api-default-proxy',
        ],
      },
      'grok-runtime-status': {
        id: 'grok-runtime-status',
        label: 'Grok 运行态',
        rowIds: [
          'row-grok-register-status',
          'row-grok-sso-status',
          'row-grok-sso-settings',
          'row-grok-upload-status',
        ],
      },
    },
    sourceAliases: {},
  });

  return VALUE;
});
