(function attachMultiPageFlowRegistry(root, factory) {
  root.MultiPageFlowRegistry = factory();
})(typeof self !== 'undefined' ? self : globalThis, function createFlowRegistryModule() {
  const DEFAULT_FLOW_ID = 'openai';
  const DEFAULT_OPENAI_TARGET_ID = 'cpa';
  const DEFAULT_KIRO_TARGET_ID = 'kiro-rs';
  const DEFAULT_KIRO_PUBLICATION_TARGET_ID = 'kiro-rs';
  const DEFAULT_KIRO_RS_URL = '';
  const DEFAULT_KIRO_GO_URL = '';
  const KIRO_TARGET_IDS = Object.freeze(['kiro-rs', 'kiro-go']);
  const OPENAI_TARGET_IDS = Object.freeze(['cpa', 'sub2api', 'codex2api']);
  const SHARED_SERVICE_IDS = Object.freeze(['account', 'email', 'proxy']);

  const DEFAULT_FLOW_CAPABILITIES = Object.freeze({
    supportsEmailSignup: true,
    supportsPhoneSignup: false,
    supportsPhoneVerificationSettings: false,
    supportsPlusMode: false,
    supportsContributionMode: false,
    supportsAccountContribution: false,
    supportsOpenAiOAuthContribution: false,
    contributionAdapterIds: [],
    supportedTargetIds: [],
    supportsLuckmail: false,
    supportsOauthTimeoutBudget: false,
    canSwitchFlow: true,
    stepDefinitionMode: 'default',
    targetSelectorLabel: '来源',
  });

  function freezeDeep(value) {
    if (!value || typeof value !== 'object' || Object.isFrozen(value)) {
      return value;
    }
    Object.getOwnPropertyNames(value).forEach((key) => {
      freezeDeep(value[key]);
    });
    return Object.freeze(value);
  }

  const FLOW_DEFINITIONS = freezeDeep({
    openai: {
      id: 'openai',
      label: 'Codex / OpenAI',
      services: ['account', 'email', 'proxy'],
      capabilities: {
        ...DEFAULT_FLOW_CAPABILITIES,
        supportsPhoneSignup: true,
        supportsPhoneVerificationSettings: true,
        supportsPlusMode: true,
        supportsContributionMode: true,
        supportsAccountContribution: true,
        supportsOpenAiOAuthContribution: true,
        contributionAdapterIds: ['openai-oauth', 'openai-codex-file', 'openai-sub2api-file'],
        supportedTargetIds: [...OPENAI_TARGET_IDS],
        supportsLuckmail: true,
        supportsOauthTimeoutBudget: true,
        stepDefinitionMode: 'openai-dynamic',
      },
      baseGroups: [
        'openai-plus',
        'openai-phone',
        'openai-oauth',
        'openai-step6',
      ],
      targets: {
        cpa: {
          id: 'cpa',
          label: 'CPA 面板',
          groups: ['openai-target-cpa'],
        },
        sub2api: {
          id: 'sub2api',
          label: 'SUB2API',
          groups: ['openai-target-sub2api'],
        },
        codex2api: {
          id: 'codex2api',
          label: 'Codex2API',
          groups: ['openai-target-codex2api'],
        },
      },
      runtimeSources: {
        'openai-auth': {
          flowId: 'openai',
          kind: 'flow-page',
          label: '认证页',
          readyPolicy: 'allow-child-frame',
          family: 'openai-auth-family',
          driverId: 'content/signup-page',
          cleanupScopes: ['oauth-localhost-callback'],
        },
        chatgpt: {
          flowId: 'openai',
          kind: 'flow-entry',
          label: 'ChatGPT 首页',
          readyPolicy: 'allow-child-frame',
          family: 'chatgpt-entry-family',
          driverId: null,
          cleanupScopes: [],
        },
        'vps-panel': {
          flowId: 'openai',
          kind: 'panel-page',
          label: 'CPA 面板',
          readyPolicy: 'allow-child-frame',
          family: 'vps-panel-family',
          driverId: 'content/vps-panel',
          cleanupScopes: [],
        },
        'platform-panel': {
          flowId: 'openai',
          kind: 'virtual-page',
          label: '平台回调面板',
          readyPolicy: 'disabled',
          family: 'platform-panel-family',
          driverId: 'content/platform-panel',
          cleanupScopes: [],
        },
        'sub2api-panel': {
          flowId: 'openai',
          kind: 'panel-page',
          label: 'SUB2API 后台',
          readyPolicy: 'allow-child-frame',
          family: 'sub2api-panel-family',
          driverId: 'content/sub2api-panel',
          cleanupScopes: [],
        },
        'codex2api-panel': {
          flowId: 'openai',
          kind: 'panel-page',
          label: 'Codex2API 后台',
          readyPolicy: 'allow-child-frame',
          family: 'codex2api-panel-family',
          driverId: 'content/sub2api-panel',
          cleanupScopes: [],
        },
        'plus-checkout': {
          flowId: 'openai',
          kind: 'flow-page',
          label: 'Plus Checkout',
          readyPolicy: 'top-frame-only',
          family: 'plus-checkout-family',
          driverId: 'content/plus-checkout',
          cleanupScopes: [],
        },
        'paypal-flow': {
          flowId: 'openai',
          kind: 'flow-page',
          label: 'PayPal 授权页',
          readyPolicy: 'allow-child-frame',
          family: 'paypal-flow-family',
          driverId: 'content/paypal-flow',
          cleanupScopes: [],
        },
        'gopay-flow': {
          flowId: 'openai',
          kind: 'flow-page',
          label: 'GoPay 授权页',
          readyPolicy: 'allow-child-frame',
          family: 'gopay-flow-family',
          driverId: 'content/gopay-flow',
          cleanupScopes: [],
        },
      },
      driverDefinitions: {
        'content/signup-page': {
          sourceId: 'openai-auth',
          commands: [
            'submit-signup-email',
            'fill-password',
            'fill-profile',
            'oauth-login',
            'submit-verification-code',
            'post-login-phone-verification',
            'bind-email',
            'fetch-bind-email-code',
            'confirm-oauth',
            'detect-auth-state',
          ],
        },
        'content/sub2api-panel': {
          sourceId: 'sub2api-panel',
          commands: ['open-panel', 'fetch-oauth-url', 'platform-verify'],
        },
        'content/vps-panel': {
          sourceId: 'vps-panel',
          commands: ['open-panel', 'fetch-oauth-url', 'platform-verify'],
        },
        'content/platform-panel': {
          sourceId: 'platform-panel',
          commands: ['platform-verify', 'fetch-oauth-url'],
        },
        'content/plus-checkout': {
          sourceId: 'plus-checkout',
          commands: [
            'plus-checkout-create',
            'paypal-hosted-openai-checkout',
            'plus-checkout-billing',
            'plus-checkout-return',
          ],
        },
        'content/paypal-flow': {
          sourceId: 'paypal-flow',
          commands: [
            'paypal-approve',
            'paypal-hosted-email',
            'paypal-hosted-card',
            'paypal-hosted-create-account',
            'paypal-hosted-review',
          ],
        },
        'content/gopay-flow': {
          sourceId: 'gopay-flow',
          commands: ['gopay-subscription-confirm'],
        },
      },
    },
    kiro: {
      id: 'kiro',
      label: 'Kiro',
      services: ['account', 'email', 'proxy'],
      capabilities: {
        ...DEFAULT_FLOW_CAPABILITIES,
        supportsAccountContribution: true,
        contributionAdapterIds: ['kiro-builder-id'],
        supportedTargetIds: [...KIRO_TARGET_IDS],
        stepDefinitionMode: 'kiro',
      },
      baseGroups: [
        'kiro-runtime-status',
      ],
      targets: {
        'kiro-rs': {
          id: 'kiro-rs',
          label: 'kiro.rs',
          groups: ['kiro-target-kiro-rs'],
        },
        'kiro-go': {
          id: 'kiro-go',
          label: 'Kiro-Go',
          groups: ['kiro-target-kiro-go'],
        },
      },
      publicationTargets: {
        'kiro-rs': {
          id: 'kiro-rs',
          label: 'kiro.rs',
        },
        'kiro-go': {
          id: 'kiro-go',
          label: 'Kiro-Go',
        },
      },
      runtimeSources: {
        'kiro-register-page': {
          flowId: 'kiro',
          kind: 'flow-page',
          label: 'Kiro 注册页',
          readyPolicy: 'top-frame-only',
          family: 'kiro-register-page-family',
          driverId: 'content/kiro/register-page',
          cleanupScopes: [],
        },
        'kiro-desktop-authorize': {
          flowId: 'kiro',
          kind: 'flow-page',
          label: 'Kiro 桌面授权页',
          readyPolicy: 'top-frame-only',
          family: 'kiro-desktop-authorize-family',
          driverId: 'content/kiro/desktop-authorize-page',
          cleanupScopes: [],
        },
        'kiro-rs-admin': {
          flowId: 'kiro',
          kind: 'virtual-page',
          label: 'kiro.rs Admin',
          readyPolicy: 'disabled',
          family: 'kiro-rs-admin-family',
          driverId: null,
          cleanupScopes: [],
        },
      },
      driverDefinitions: {
        'content/kiro/register-page': {
          sourceId: 'kiro-register-page',
          commands: [
            'kiro-open-register-page',
            'kiro-submit-email',
            'kiro-submit-name',
            'kiro-submit-verification-code',
            'kiro-submit-password',
            'kiro-complete-register-consent',
          ],
        },
        'content/kiro/desktop-authorize-page': {
          sourceId: 'kiro-desktop-authorize',
          commands: [
            'kiro-complete-desktop-authorize',
          ],
        },
        'background/kiro-register': {
          sourceId: 'kiro-register-page',
          commands: [
            'kiro-open-register-page',
            'kiro-submit-email',
            'kiro-submit-name',
            'kiro-submit-verification-code',
            'kiro-submit-password',
            'kiro-complete-register-consent',
          ],
        },
        'background/kiro-desktop-authorize': {
          sourceId: 'kiro-desktop-authorize',
          commands: [
            'kiro-start-desktop-authorize',
            'kiro-complete-desktop-authorize',
          ],
        },
        'background/kiro-publisher-kiro-rs': {
          sourceId: 'kiro-rs-admin',
          commands: [
            'kiro-upload-credential',
          ],
        },
      },
    },
  });

  const SETTINGS_GROUP_DEFINITIONS = freezeDeep({
    'service-account': {
      id: 'service-account',
      label: '账户',
      rowIds: ['row-custom-password'],
    },
    'service-email': {
      id: 'service-email',
      label: '邮箱服务',
    },
    'service-proxy': {
      id: 'service-proxy',
      label: 'IP 代理',
      sectionIds: ['ip-proxy-section'],
    },
    'openai-target-cpa': {
      id: 'openai-target-cpa',
      label: 'CPA 来源',
      rowIds: ['row-vps-url', 'row-vps-password', 'row-local-cpa-step9-mode'],
    },
    'openai-target-sub2api': {
      id: 'openai-target-sub2api',
      label: 'SUB2API 来源',
      rowIds: [
        'row-sub2api-url',
        'row-sub2api-email',
        'row-sub2api-password',
        'row-sub2api-group',
        'row-sub2api-account-priority',
        'row-sub2api-default-proxy',
      ],
    },
    'openai-target-codex2api': {
      id: 'openai-target-codex2api',
      label: 'Codex2API 来源',
      rowIds: ['row-codex2api-url', 'row-codex2api-admin-key'],
    },
    'openai-plus': {
      id: 'openai-plus',
      label: 'Plus',
      rowIds: ['row-plus-mode', 'row-plus-account-access-strategy', 'row-plus-payment-method'],
    },
    'openai-phone': {
      id: 'openai-phone',
      label: '接码设置',
      sectionIds: ['phone-verification-section'],
      rowIds: [],
    },
    'openai-oauth': {
      id: 'openai-oauth',
      label: 'OAuth',
      rowIds: ['row-oauth-flow-timeout', 'row-oauth-display'],
    },
    'openai-step6': {
      id: 'openai-step6',
      label: '第六步',
      rowIds: ['row-step6-cookie-settings'],
    },
    'kiro-target-kiro-rs': {
      id: 'kiro-target-kiro-rs',
      label: 'kiro.rs 配置',
      rowIds: ['row-kiro-rs-url', 'row-kiro-rs-key', 'row-kiro-rs-test-status'],
    },
    'kiro-target-kiro-go': {
      id: 'kiro-target-kiro-go',
      label: 'Kiro-Go 配置',
      rowIds: ['row-kiro-go-url', 'row-kiro-go-password', 'row-kiro-go-test-status'],
    },
    'kiro-runtime-status': {
      id: 'kiro-runtime-status',
      label: 'Kiro 运行态',
      rowIds: ['row-kiro-web-status', 'row-kiro-login-url', 'row-kiro-upload-status'],
    },
  });

  function normalizeFlowId(value = '', fallback = DEFAULT_FLOW_ID) {
    const normalized = String(value || '').trim().toLowerCase();
    if (normalized && Object.prototype.hasOwnProperty.call(FLOW_DEFINITIONS, normalized)) {
      return normalized;
    }
    const fallbackValue = String(fallback || '').trim().toLowerCase();
    return Object.prototype.hasOwnProperty.call(FLOW_DEFINITIONS, fallbackValue)
      ? fallbackValue
      : DEFAULT_FLOW_ID;
  }

  function getRegisteredFlowIds() {
    return Object.keys(FLOW_DEFINITIONS);
  }

  function getFlowDefinition(flowId) {
    return FLOW_DEFINITIONS[normalizeFlowId(flowId)] || FLOW_DEFINITIONS[DEFAULT_FLOW_ID];
  }

  function getFlowLabel(flowId) {
    return getFlowDefinition(flowId)?.label || normalizeFlowId(flowId);
  }

  function getDefaultTargetId(flowId) {
    return normalizeFlowId(flowId) === 'kiro'
      ? DEFAULT_KIRO_TARGET_ID
      : DEFAULT_OPENAI_TARGET_ID;
  }

  function normalizeOpenAiTargetId(value = '', fallback = DEFAULT_OPENAI_TARGET_ID) {
    const normalized = String(value || '').trim().toLowerCase();
    if (OPENAI_TARGET_IDS.includes(normalized)) {
      return normalized;
    }
    const fallbackValue = String(fallback || '').trim().toLowerCase();
    return OPENAI_TARGET_IDS.includes(fallbackValue)
      ? fallbackValue
      : DEFAULT_OPENAI_TARGET_ID;
  }

  function normalizeKiroTargetId(value = '', fallback = DEFAULT_KIRO_TARGET_ID) {
    const normalized = String(value || '').trim().toLowerCase();
    if (KIRO_TARGET_IDS.includes(normalized)) {
      return normalized;
    }
    const fallbackValue = String(fallback || '').trim().toLowerCase();
    return KIRO_TARGET_IDS.includes(fallbackValue)
      ? fallbackValue
      : DEFAULT_KIRO_TARGET_ID;
  }

  function normalizeTargetId(flowId, targetId = '', fallback = undefined) {
    const normalizedFlowId = normalizeFlowId(flowId);
    if (normalizedFlowId === 'kiro') {
      return normalizeKiroTargetId(
        targetId,
        fallback || DEFAULT_KIRO_TARGET_ID
      );
    }
    return normalizeOpenAiTargetId(
      targetId,
      fallback || DEFAULT_OPENAI_TARGET_ID
    );
  }

  function getTargetDefinitions(flowId) {
    return getFlowDefinition(flowId)?.targets || {};
  }

  function getTargetDefinition(flowId, targetId) {
    const normalizedFlowId = normalizeFlowId(flowId);
    const normalizedTargetId = normalizeTargetId(
      normalizedFlowId,
      targetId,
      getDefaultTargetId(normalizedFlowId)
    );
    return getTargetDefinitions(normalizedFlowId)[normalizedTargetId] || null;
  }

  function getTargetOptions(flowId) {
    return Object.values(getTargetDefinitions(flowId));
  }

  function getTargetLabel(flowId, targetId) {
    return getTargetDefinition(flowId, targetId)?.label
      || normalizeTargetId(flowId, targetId);
  }

  function getPublicationTargetDefinitions(flowId) {
    return getFlowDefinition(flowId)?.publicationTargets || {};
  }

  function getPublicationTargetDefinition(flowId, publicationTargetId) {
    const normalizedFlowId = normalizeFlowId(flowId);
    const normalizedPublicationTargetId = String(
      publicationTargetId || (
        normalizedFlowId === 'kiro'
          ? DEFAULT_KIRO_PUBLICATION_TARGET_ID
          : ''
      )
    ).trim().toLowerCase();
    return getPublicationTargetDefinitions(normalizedFlowId)[normalizedPublicationTargetId] || null;
  }

  function getFlowCapabilities(flowId) {
    return {
      ...DEFAULT_FLOW_CAPABILITIES,
      ...(getFlowDefinition(flowId)?.capabilities || {}),
    };
  }

  function getVisibleGroupIds(flowId, targetId, options = {}) {
    const normalizedFlowId = normalizeFlowId(flowId);
    const flowDefinition = getFlowDefinition(normalizedFlowId);
    const normalizedTargetId = normalizeTargetId(
      normalizedFlowId,
      targetId,
      getDefaultTargetId(normalizedFlowId)
    );
    const targetDefinition = getTargetDefinition(
      normalizedFlowId,
      normalizedTargetId
    );
    const includeSharedServices = options?.includeSharedServices !== false;
    const serviceGroups = includeSharedServices
      ? (Array.isArray(flowDefinition?.services)
        ? flowDefinition.services.map((serviceId) => `service-${serviceId}`)
        : [])
      : [];
    return Array.from(new Set([
      ...(Array.isArray(flowDefinition?.baseGroups) ? flowDefinition.baseGroups : []),
      ...(Array.isArray(targetDefinition?.groups) ? targetDefinition.groups : []),
      ...serviceGroups,
    ]));
  }

  function getSettingsGroupDefinition(groupId) {
    const normalizedGroupId = String(groupId || '').trim();
    return SETTINGS_GROUP_DEFINITIONS[normalizedGroupId] || null;
  }

  function getSettingsGroupDefinitions() {
    return SETTINGS_GROUP_DEFINITIONS;
  }

  function getRuntimeSourceDefinitions() {
    const next = {};
    Object.values(FLOW_DEFINITIONS).forEach((flowDefinition) => {
      Object.assign(next, flowDefinition.runtimeSources || {});
    });
    return next;
  }

  function getDriverDefinitions() {
    const next = {};
    Object.values(FLOW_DEFINITIONS).forEach((flowDefinition) => {
      Object.assign(next, flowDefinition.driverDefinitions || {});
    });
    return next;
  }

  return {
    DEFAULT_FLOW_CAPABILITIES,
    DEFAULT_FLOW_ID,
    DEFAULT_KIRO_TARGET_ID,
    DEFAULT_KIRO_PUBLICATION_TARGET_ID,
    DEFAULT_KIRO_RS_URL,
    DEFAULT_KIRO_GO_URL,
    DEFAULT_OPENAI_TARGET_ID,
    FLOW_DEFINITIONS,
    KIRO_TARGET_IDS,
    OPENAI_TARGET_IDS,
    SETTINGS_GROUP_DEFINITIONS,
    SHARED_SERVICE_IDS,
    getDriverDefinitions,
    getDefaultTargetId,
    getFlowCapabilities,
    getFlowDefinition,
    getFlowLabel,
    getPublicationTargetDefinition,
    getPublicationTargetDefinitions,
    getRegisteredFlowIds,
    getRuntimeSourceDefinitions,
    getSettingsGroupDefinition,
    getSettingsGroupDefinitions,
    getTargetDefinition,
    getTargetDefinitions,
    getTargetLabel,
    getTargetOptions,
    getVisibleGroupIds,
    normalizeFlowId,
    normalizeKiroTargetId,
    normalizeOpenAiTargetId,
    normalizeTargetId,
  };
});
