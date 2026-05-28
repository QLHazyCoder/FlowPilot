(function attachMultiPageOpenAiReauthFlowDefinition(root, factory) {
  root.MultiPageOpenAiReauthFlowDefinition = factory();
})(typeof self !== 'undefined' ? self : globalThis, function createMultiPageOpenAiReauthFlowDefinition() {
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
    id: 'openai-reauth',
    label: 'OpenAI 重新授权',
    services: ['account', 'email'],
    capabilities: {
      stepDefinitionMode: 'openai-reauth-static',
      canSwitchFlow: false,
      supportsEmailSignup: false,
      supportsPhoneSignup: false,
      supportsPlusMode: false,
      supportsContributionMode: false,
      supportsAccountContribution: false,
      supportedTargetIds: [],
    },
    baseGroups: ['openai-oauth', 'reauth-input'],
    targets: {},
    defaultTargetId: null,
    settingsDefaults: {},
    settingsGroups: {
      'reauth-input': {
        id: 'reauth-input',
        label: 'OAuth 重新授权',
        rowIds: ['row-reauth-account-json', 'row-reauth-result'],
      },
    },
    targetCapabilities: {},
    runtimeSources: {
      'openai-auth': {
        flowId: 'openai-reauth',
        kind: 'flow-page',
        label: '认证页',
        readyPolicy: 'allow-child-frame',
        family: 'openai-auth-family',
        driverId: 'flows/openai/content/openai-auth',
        cleanupScopes: ['oauth-localhost-callback'],
        detectionMatchers: [
          {
            hostnames: ['auth0.openai.com', 'auth.openai.com', 'accounts.openai.com'],
          },
        ],
        familyMatchers: [
          {
            hostnames: ['auth0.openai.com', 'auth.openai.com', 'accounts.openai.com'],
          },
        ],
      },
    },
    driverDefinitions: {
      'flows/openai/content/openai-auth': {
        sourceId: 'openai-auth',
        commands: ['oauth-login', 'submit-verification-code', 'detect-auth-state'],
      },
    },
    nodes: [
      {
        id: 'prepare-reauth',
        step: 1,
        label: '准备授权（清 cookie / 生成 PKCE / 打开认证页）',
      },
      {
        id: 'submit-reauth-email',
        step: 2,
        label: '提交邮箱并等待验证码页',
      },
      {
        id: 'fetch-reauth-code',
        step: 3,
        label: '收取邮箱验证码并填回',
      },
      {
        id: 'capture-reauth-callback',
        step: 4,
        label: '抓取 localhost 回调并换取新 Token',
      },
    ],
  });

  return VALUE;
});
