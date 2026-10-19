const test = require('node:test');
const assert = require('node:assert/strict');
const { readFlowRegistryBundle, readBundle } = require('./helpers/script-bundles.js');

const flowRegistrySource = readFlowRegistryBundle();
const settingsSchemaSource = readBundle(['core/flow-kernel/settings-schema.js']);

function loadApis() {
  const scope = {};
  return new Function('self', `${flowRegistrySource}; ${settingsSchemaSource}; return {
    flowRegistry: self.MultiPageFlowRegistry,
    settingsSchema: self.MultiPageSettingsSchema,
  };`)(scope);
}

test('flow registry exposes canonical flow and target metadata', () => {
  const { flowRegistry } = loadApis();

  assert.deepEqual(flowRegistry.getRegisteredFlowIds(), ['openai', 'kiro', 'grok']);
  assert.equal(flowRegistry.normalizeFlowId('kiro'), 'kiro');
  assert.equal(flowRegistry.normalizeFlowId('grok'), 'grok');
  assert.equal(flowRegistry.normalizeFlowId('unknown'), 'openai');
  assert.equal(flowRegistry.getFlowLabel('openai'), 'Codex / OpenAI');
  assert.deepEqual(
    flowRegistry.getFlowDefinition('openai')?.settingsDefaults?.autoRun?.stepExecutionRange,
    { enabled: false, fromStep: 1, toStep: 11 }
  );
  assert.deepEqual(
    flowRegistry.getFlowDefinition('openai')?.targets?.cpa?.defaultState,
    { vpsUrl: '', vpsPassword: '', localCpaStep9Mode: 'submit' }
  );
  assert.equal(
    flowRegistry.getTargetCapabilities('openai', 'cpa')?.usesOauthTimeoutBudget,
    true
  );
  assert.equal(
    flowRegistry.getTargetCapabilities('openai', 'sub2api')?.usesOauthTimeoutBudget,
    undefined
  );
  assert.deepEqual(
    flowRegistry.getFlowDefinition('kiro')?.targets?.['kiro-rs']?.defaultState,
    { baseUrl: '', apiKey: '' }
  );
  assert.equal(flowRegistry.normalizeTargetId('openai', 'sub2api'), 'sub2api');
  assert.equal(flowRegistry.normalizeTargetId('kiro', 'anything-else'), 'kiro-rs');
  assert.equal(flowRegistry.normalizeTargetId('grok', 'anything-else'), 'webchat2api');
  assert.deepEqual(
    flowRegistry.getVisibleGroupIds('openai', 'cpa'),
    ['openai-account-delivery', 'openai-plus', 'shared-auto-run', 'openai-oauth', 'openai-step6', 'openai-phone', 'openai-target-cpa', 'service-account', 'service-email', 'service-proxy']
  );
  assert.deepEqual(
    flowRegistry.getVisibleGroupIds('openai', 'webchat'),
    ['openai-account-delivery', 'openai-plus', 'shared-auto-run', 'openai-oauth', 'openai-step6', 'openai-target-webchat', 'service-account', 'service-email', 'service-proxy']
  );
  assert.deepEqual(
    flowRegistry.getVisibleGroupIds('openai', 'chatgpt2api'),
    ['openai-account-delivery', 'openai-plus', 'shared-auto-run', 'openai-oauth', 'openai-step6', 'openai-target-chatgpt2api', 'service-account', 'service-email', 'service-proxy']
  );
  assert.deepEqual(
    flowRegistry.getVisibleGroupIds('kiro', 'kiro-rs'),
    ['kiro-runtime-status', 'shared-auto-run', 'kiro-target-kiro-rs', 'service-account', 'service-email', 'service-proxy']
  );
  assert.deepEqual(
    flowRegistry.getVisibleGroupIds('grok', 'webchat2api'),
    ['grok-runtime-status', 'shared-auto-run', 'grok-target-webchat2api', 'service-account', 'service-email', 'service-proxy']
  );
  assert.deepEqual(
    flowRegistry.getVisibleGroupIds('grok', 'sub2api'),
    ['grok-runtime-status', 'shared-auto-run', 'grok-target-sub2api', 'service-account', 'service-email', 'service-proxy']
  );
  assert.deepEqual(
    flowRegistry.getVisibleGroupIds('grok', 'grok2api'),
    ['grok-runtime-status', 'shared-auto-run', 'grok-target-grok2api', 'service-account', 'service-email', 'service-proxy']
  );
  assert.deepEqual(
    flowRegistry.getSettingsGroupDefinition('grok-target-sub2api')?.rowIds,
    [
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
    ]
  );
  assert.deepEqual(
    flowRegistry.getSettingsGroupDefinition('grok-runtime-status')?.rowIds,
    [
      'row-grok-register-status',
      'row-grok-sso-status',
      'row-grok-sso-settings',
      'row-grok-upload-status',
    ]
  );
  assert.deepEqual(
    flowRegistry.getTargetOptions('openai').map((entry) => entry.id),
    ['cpa', 'sub2api', 'codex2api', 'webchat', 'chatgpt2api']
  );
  assert.deepEqual(
    flowRegistry.getTargetOptions('grok').map((entry) => entry.id),
    ['webchat2api', 'grok2api', 'sub2api']
  );
  assert.equal(
    flowRegistry.getTargetCapabilities('openai', 'webchat')?.supportsPhoneSignup,
    false
  );
  assert.equal(
    flowRegistry.getTargetCapabilities('openai', 'webchat')?.supportsPhoneVerificationSettings,
    false
  );
  assert.equal(
    flowRegistry.getTargetCapabilities('openai', 'chatgpt2api')?.supportsPhoneSignup,
    false
  );
  assert.equal(
    flowRegistry.getTargetCapabilities('openai', 'chatgpt2api')?.supportsPhoneVerificationSettings,
    false
  );
  assert.deepEqual(
    flowRegistry.getSettingsGroupDefinition('openai-account-delivery')?.rowIds,
    ['row-account-delivery-mode']
  );
  assert.deepEqual(
    flowRegistry.getSettingsGroupDefinition('openai-plus')?.rowIds,
    ['row-plus-mode', 'row-plus-payment-method']
  );
  assert.deepEqual(
    flowRegistry.getSettingsGroupDefinition('shared-auto-run')?.rowIds,
    ['row-shared-auto-run', 'row-auto-run-thread-interval', 'row-step-execution-range']
  );
  assert.deepEqual(
    flowRegistry.getSettingsGroupDefinition('openai-webchat-upload')?.rowIds,
    []
  );
  assert.equal(flowRegistry.getPublicationTargetDefinition('kiro', 'kiro-rs')?.label, 'kiro.rs');
  assert.deepEqual(flowRegistry.getFlowCapabilities('grok').supportedTargetIds, ['webchat2api', 'grok2api', 'sub2api']);
});

test('settings schema normalizes view input into canonical nested namespaces', () => {
  const { settingsSchema } = loadApis();
  const schema = settingsSchema.createSettingsSchema();

  const normalized = schema.normalizeSettingsState({
    activeFlowId: 'kiro',
    targetId: 'kiro-rs',
    mailProvider: 'hotmail',
    ipProxyEnabled: true,
    ipProxyService: '711proxy',
    customPassword: 'SharedSecret123!',
    kiroRsUrl: 'https://kiro.example.com/admin',
    kiroRsKey: 'secret-key',
    openaiWebchatUrl: ' https://webchat.example.com/admin ',
    openaiWebchatAdminKey: ' webchat-key ',
    openaiWebchatUploadEnabled: true,
    openaiChatgpt2ApiUrl: ' https://chatgpt2api.example.com/admin ',
    openaiChatgpt2ApiAdminKey: ' chatgpt2api-key ',
    stepExecutionRangeByFlow: {
      openai: { enabled: true, fromStep: 2, toStep: 9 },
      kiro: { enabled: true, fromStep: 1, toStep: 9 },
      grok: { enabled: true, fromStep: 2, toStep: 4 },
    },
  });

  assert.equal(normalized.activeFlowId, 'kiro');
  assert.equal(normalized.services.email.provider, 'hotmail');
  assert.equal(normalized.services.proxy.enabled, true);
  assert.equal(normalized.services.account.customPassword, 'SharedSecret123!');
  assert.equal(normalized.flows.openai.selectedTargetId, 'cpa');
  assert.equal(normalized.flows.openai.targets.cpa.accountDeliveryMode, 'oauth');
  assert.deepEqual(
    Object.keys(normalized.flows.openai.plus).sort(),
    [
      'hostedCheckoutPhoneNumber',
      'hostedCheckoutVerificationUrl',
      'plusHostedCheckoutOauthDelaySeconds',
      'plusModeEnabled',
      'plusPaymentMethod',
    ].sort()
  );
  assert.equal(normalized.flows.openai.targets.webchat.baseUrl, 'https://webchat.example.com/admin');
  assert.equal(normalized.flows.openai.targets.webchat.apiKey, 'webchat-key');
  assert.equal(normalized.flows.openai.targets.chatgpt2api.baseUrl, 'https://chatgpt2api.example.com/admin');
  assert.equal(normalized.flows.openai.targets.chatgpt2api.apiKey, 'chatgpt2api-key');
  assert.equal(normalized.flows.grok.targets.webchat2api.baseUrl, 'https://webchat.example.com/admin');
  assert.equal(normalized.flows.grok.targets.webchat2api.apiKey, 'webchat-key');
  assert.equal(normalized.flows.openai.webchatUpload.enabled, false);
  assert.equal(normalized.flows.kiro.selectedTargetId, 'kiro-rs');
  assert.equal(normalized.flows.grok.selectedTargetId, 'webchat2api');
  assert.equal(normalized.flows.kiro.targets['kiro-rs'].baseUrl, 'https://kiro.example.com/admin');
  assert.equal(normalized.flows.kiro.targets['kiro-rs'].apiKey, 'secret-key');
  assert.deepEqual(normalized.flows.kiro.autoRun.stepExecutionRange, {
    enabled: true,
    fromStep: 1,
    toStep: 9,
  });
  assert.deepEqual(normalized.flows.grok.autoRun.stepExecutionRange, {
    enabled: true,
    fromStep: 2,
    toStep: 4,
  });
});

test('settings schema retires legacy GPC and Plus Auto configurations', () => {
  const { settingsSchema } = loadApis();
  const schema = settingsSchema.createSettingsSchema();

  for (const legacyPaymentMethod of ['gpc-helper', 'plus-auto']) {
    const normalized = schema.normalizeSettingsState({
      activeFlowId: 'openai',
      plusModeEnabled: true,
      plusPaymentMethod: legacyPaymentMethod,
      gpcCardKey: 'GPC-AAAA1111-BBBB2222-CCCC3333',
      autoCdk: 'QZ-AAAA-BBBB-CCCC',
    });
    const view = schema.buildSettingsView(normalized);

    assert.equal(normalized.flows.openai.plus.plusModeEnabled, false);
    assert.equal(normalized.flows.openai.plus.plusPaymentMethod, 'paypal');
    assert.equal(view.plusModeEnabled, false);
    assert.equal(view.plusPaymentMethod, 'paypal');
    assert.equal(Object.prototype.hasOwnProperty.call(view, 'gpcCardKey'), false);
    assert.equal(Object.prototype.hasOwnProperty.call(view, 'autoCdk'), false);
  }
});

test('settings schema shares webchat connection config between OpenAI and Grok targets', () => {
  const { settingsSchema } = loadApis();
  const schema = settingsSchema.createSettingsSchema();

  const fromGrokFlat = schema.normalizeSettingsState({
    activeFlowId: 'grok',
    grokWebchat2ApiUrl: ' https://shared.example.com/grok ',
    grokWebchat2ApiAdminKey: ' shared-key ',
  });

  assert.equal(fromGrokFlat.flows.openai.targets.webchat.baseUrl, 'https://shared.example.com/grok');
  assert.equal(fromGrokFlat.flows.openai.targets.webchat.apiKey, 'shared-key');
  assert.equal(fromGrokFlat.flows.grok.targets.webchat2api.baseUrl, 'https://shared.example.com/grok');
  assert.equal(fromGrokFlat.flows.grok.targets.webchat2api.apiKey, 'shared-key');

  const fromOpenAiNested = schema.normalizeSettingsState({
    settingsState: {
      flows: {
        openai: {
          targets: {
            webchat: {
              baseUrl: 'https://nested-openai.example.com/admin',
              apiKey: 'nested-openai-key',
            },
          },
        },
      },
    },
  });

  assert.equal(fromOpenAiNested.flows.openai.targets.webchat.baseUrl, 'https://nested-openai.example.com/admin');
  assert.equal(fromOpenAiNested.flows.grok.targets.webchat2api.baseUrl, 'https://nested-openai.example.com/admin');
  assert.equal(fromOpenAiNested.flows.openai.targets.webchat.apiKey, 'nested-openai-key');
  assert.equal(fromOpenAiNested.flows.grok.targets.webchat2api.apiKey, 'nested-openai-key');
});

test('settings schema shares SUB2API credentials while keeping Grok policy independent', () => {
  const { settingsSchema } = loadApis();
  const schema = settingsSchema.createSettingsSchema();

  const normalized = schema.normalizeSettingsState({
    activeFlowId: 'grok',
    targetId: 'sub2api',
    sub2apiUrl: ' https://sub2api.example.com/admin/accounts ',
    sub2apiEmail: ' owner@example.com ',
    sub2apiPassword: 'shared-secret',
    sub2apiGroupName: 'openai-pool',
    sub2apiGroupNames: ['openai-pool'],
    sub2apiAccountPriority: 7,
    sub2apiDefaultProxyName: 'openai-proxy',
    grokSub2apiGroupName: 'grok-pool',
    grokSub2apiGroupNames: ['grok-default', 'grok-pool'],
    grokSub2apiAccountPriority: 3,
    grokSub2apiDefaultProxyName: 'xai-proxy',
    grok2ApiUrl: ' https://grok2api.example.com/admin/account ',
    grok2ApiAdminKey: ' grok2api-key ',
    grokSub2apiGrok2ApiUploadEnabled: true,
  });
  const view = schema.buildSettingsView(normalized);
  const openAiTarget = normalized.flows.openai.targets.sub2api;
  const grokTarget = normalized.flows.grok.targets.sub2api;

  assert.equal(normalized.flows.grok.selectedTargetId, 'sub2api');
  assert.equal(openAiTarget.sub2apiUrl, 'https://sub2api.example.com/admin/accounts');
  assert.equal(grokTarget.sub2apiUrl, openAiTarget.sub2apiUrl);
  assert.equal(grokTarget.sub2apiEmail, 'owner@example.com');
  assert.equal(grokTarget.sub2apiPassword, 'shared-secret');
  assert.equal(openAiTarget.sub2apiGroupName, 'openai-pool');
  assert.equal(openAiTarget.sub2apiAccountPriority, 7);
  assert.equal(openAiTarget.sub2apiDefaultProxyName, 'openai-proxy');
  assert.equal(grokTarget.sub2apiGroupName, 'grok-pool');
  assert.deepEqual(grokTarget.sub2apiGroupNames, ['grok-default', 'grok-pool']);
  assert.equal(grokTarget.sub2apiAccountPriority, 3);
  assert.equal(grokTarget.sub2apiDefaultProxyName, 'xai-proxy');
  assert.equal(normalized.flows.grok.targets.grok2api.baseUrl, 'https://grok2api.example.com/admin/account');
  assert.equal(normalized.flows.grok.targets.grok2api.apiKey, 'grok2api-key');
  assert.equal(grokTarget.grok2apiUploadEnabled, true);
  assert.equal(Object.hasOwn(grokTarget, 'webchat2apiUploadEnabled'), false);
  assert.equal(Object.hasOwn(openAiTarget, 'grok2apiUploadEnabled'), false);
  assert.equal(view.grokSub2apiGroupName, 'grok-pool');
  assert.deepEqual(view.grokSub2apiGroupNames, ['grok-default', 'grok-pool']);
  assert.equal(view.grokSub2apiAccountPriority, 3);
  assert.equal(view.grokSub2apiDefaultProxyName, 'xai-proxy');
  assert.equal(view.grok2ApiUrl, 'https://grok2api.example.com/admin/account');
  assert.equal(view.grok2ApiAdminKey, 'grok2api-key');
  assert.equal(view.grokSub2apiGrok2ApiUploadEnabled, true);

  const conflictingSettingsState = {
    flows: {
      openai: {
        targets: {
          sub2api: {
            sub2apiUrl: 'https://openai-canonical.example.com',
            sub2apiEmail: 'openai-canonical@example.com',
            sub2apiPassword: 'openai-canonical-secret',
          },
        },
      },
      grok: {
        targets: {
          sub2api: {
            sub2apiUrl: 'https://grok-canonical.example.com',
            sub2apiEmail: 'grok-canonical@example.com',
            sub2apiPassword: 'grok-canonical-secret',
          },
        },
      },
    },
  };
  const canonicalConflict = schema.normalizeSettingsState({ settingsState: conflictingSettingsState });
  assert.equal(canonicalConflict.flows.openai.targets.sub2api.sub2apiUrl, 'https://openai-canonical.example.com');
  assert.equal(canonicalConflict.flows.grok.targets.sub2api.sub2apiEmail, 'openai-canonical@example.com');
  assert.equal(canonicalConflict.flows.grok.targets.sub2api.sub2apiPassword, 'openai-canonical-secret');

  const explicitFlatConflict = schema.normalizeSettingsState({
    settingsState: conflictingSettingsState,
    sub2apiUrl: 'https://flat.example.com',
    sub2apiEmail: 'flat@example.com',
    sub2apiPassword: 'flat-secret',
  });
  assert.equal(explicitFlatConflict.flows.openai.targets.sub2api.sub2apiUrl, 'https://flat.example.com');
  assert.equal(explicitFlatConflict.flows.grok.targets.sub2api.sub2apiEmail, 'flat@example.com');
  assert.equal(explicitFlatConflict.flows.grok.targets.sub2api.sub2apiPassword, 'flat-secret');

  const grokCanonicalFallback = schema.normalizeSettingsState({
    settingsState: {
      flows: {
        grok: conflictingSettingsState.flows.grok,
      },
    },
  });
  assert.equal(grokCanonicalFallback.flows.openai.targets.sub2api.sub2apiUrl, 'https://grok-canonical.example.com');
  assert.equal(grokCanonicalFallback.flows.openai.targets.sub2api.sub2apiEmail, 'grok-canonical@example.com');
  assert.equal(grokCanonicalFallback.flows.grok.targets.sub2api.sub2apiPassword, 'grok-canonical-secret');
});

test('Grok SUB2API group policy starts empty and remains empty until configured', () => {
  const { settingsSchema } = loadApis();
  const schema = settingsSchema.createSettingsSchema();

  const normalized = schema.normalizeSettingsState({
    activeFlowId: 'grok',
    targetId: 'sub2api',
  });
  const view = schema.buildSettingsView(normalized);

  assert.equal(normalized.flows.grok.targets.sub2api.sub2apiGroupName, '');
  assert.deepEqual(normalized.flows.grok.targets.sub2api.sub2apiGroupNames, []);
  assert.equal(view.grokSub2apiGroupName, '');
  assert.deepEqual(view.grokSub2apiGroupNames, []);
  assert.equal(normalized.flows.grok.targets.sub2api.grok2apiUploadEnabled, false);
  assert.equal(Object.hasOwn(normalized.flows.grok.targets.sub2api, 'webchat2apiUploadEnabled'), false);
  assert.equal(view.grokSub2apiGrok2ApiUploadEnabled, false);
});

test('settings schema migrates the retired Grok SUB2API webchat switch to grok2api', () => {
  const { settingsSchema } = loadApis();
  const schema = settingsSchema.createSettingsSchema();
  const normalized = schema.normalizeSettingsState({
    grokSub2apiWebchat2ApiUploadEnabled: true,
    settingsState: {
      flows: {
        grok: {
          targets: {
            sub2api: { webchat2apiUploadEnabled: true },
          },
        },
      },
    },
  });
  const view = schema.buildSettingsView(normalized);

  assert.equal(normalized.flows.grok.targets.sub2api.grok2apiUploadEnabled, true);
  assert.equal(Object.hasOwn(normalized.flows.grok.targets.sub2api, 'webchat2apiUploadEnabled'), false);
  assert.equal(view.grokSub2apiGrok2ApiUploadEnabled, true);
  assert.equal(Object.hasOwn(view, 'grokSub2apiWebchat2ApiUploadEnabled'), false);
});

test('settings schema keeps ChatGPT2API config independent from shared webchat config', () => {
  const { settingsSchema } = loadApis();
  const schema = settingsSchema.createSettingsSchema();

  const normalized = schema.normalizeSettingsState({
    openaiWebchatUrl: 'https://shared-webchat.example.com/admin',
    openaiWebchatAdminKey: 'shared-webchat-key',
    openaiChatgpt2ApiUrl: ' https://chatgpt2api.example.com/admin ',
    openaiChatgpt2ApiAdminKey: ' chatgpt2api-key ',
  });
  const view = schema.buildSettingsView(normalized);

  assert.equal(normalized.flows.openai.targets.webchat.baseUrl, 'https://shared-webchat.example.com/admin');
  assert.equal(normalized.flows.grok.targets.webchat2api.baseUrl, 'https://shared-webchat.example.com/admin');
  assert.equal(normalized.flows.openai.targets.chatgpt2api.baseUrl, 'https://chatgpt2api.example.com/admin');
  assert.equal(normalized.flows.openai.targets.chatgpt2api.apiKey, 'chatgpt2api-key');
  assert.equal(view.openaiChatgpt2ApiUrl, 'https://chatgpt2api.example.com/admin');
  assert.equal(view.openaiChatgpt2ApiAdminKey, 'chatgpt2api-key');
});

test('settings schema lets explicit flat step range override stale canonical range', () => {
  const { settingsSchema } = loadApis();
  const schema = settingsSchema.createSettingsSchema();
  const oldState = schema.normalizeSettingsState({
    activeFlowId: 'openai',
    stepExecutionRangeByFlow: {
      openai: { enabled: true, fromStep: 3, toStep: 6 },
    },
  });

  const normalized = schema.normalizeSettingsState({
    settingsState: oldState,
    stepExecutionRangeByFlow: {
      openai: { enabled: false, fromStep: 3, toStep: 6 },
    },
  });

  assert.deepEqual(normalized.flows.openai.autoRun.stepExecutionRange, {
    enabled: false,
    fromStep: 3,
    toStep: 6,
  });
});

test('settings schema can project canonical state into a read view without legacy rebuild helpers', () => {
  const { settingsSchema } = loadApis();
  const schema = settingsSchema.createSettingsSchema();
  const normalized = schema.normalizeSettingsState({
    activeFlowId: 'kiro',
    targetId: 'kiro-rs',
    kiroRsUrl: 'https://kiro.example.com/admin',
    kiroRsKey: 'key-123',
    openaiWebchatUrl: 'https://webchat.example.com/admin',
    openaiWebchatAdminKey: 'key-webchat',
    openaiWebchatUploadEnabled: true,
    openaiChatgpt2ApiUrl: 'https://chatgpt2api.example.com/admin',
    openaiChatgpt2ApiAdminKey: 'key-chatgpt2api',
  });
  const view = schema.buildSettingsView(normalized);

  assert.equal(view.activeFlowId, 'kiro');
  assert.equal(view.targetId, 'kiro-rs');
  assert.equal(view.kiroRsUrl, 'https://kiro.example.com/admin');
  assert.equal(view.kiroRsKey, 'key-123');
  assert.equal(view.openaiWebchatUrl, 'https://webchat.example.com/admin');
  assert.equal(view.openaiWebchatAdminKey, 'key-webchat');
  assert.equal(view.openaiWebchatUploadEnabled, false);
  assert.equal(view.openaiChatgpt2ApiUrl, 'https://chatgpt2api.example.com/admin');
  assert.equal(view.openaiChatgpt2ApiAdminKey, 'key-chatgpt2api');
  assert.equal(view.accountDeliveryMode, 'oauth');
  assert.equal(view.settingsSchemaVersion, 6);
  assert.equal(view.settingsState.activeFlowId, 'kiro');
  assert.deepEqual(view.stepExecutionRangeByFlow.grok, {
    enabled: false,
    fromStep: 1,
    toStep: 6,
  });
});

test('settings schema preserves registered custom flow settings without openai/kiro hardcoding', () => {
  const { settingsSchema } = loadApis();
  const customFlowRegistry = {
    DEFAULT_FLOW_ID: 'openai',
    getRegisteredFlowIds: () => ['openai', 'kiro', 'sample'],
    getDefaultTargetId(flowId) {
      return flowId === 'sample' ? 'sample-target' : (flowId === 'kiro' ? 'kiro-rs' : 'cpa');
    },
    getFlowDefinition(flowId) {
      if (flowId !== 'sample') {
        return null;
      }
      return {
        id: 'sample',
        defaultTargetId: 'sample-target',
        settingsDefaults: {
          targets: {
            'sample-target': {
              endpoint: 'https://sample.example.com',
            },
          },
          autoRun: {
            stepExecutionRange: { enabled: false, fromStep: 1, toStep: 3 },
          },
        },
      };
    },
    getTargetDefinitions(flowId) {
      if (flowId === 'sample') {
        return {
          'sample-target': { id: 'sample-target', label: 'Sample Target' },
        };
      }
      if (flowId === 'kiro') {
        return {
          'kiro-rs': { id: 'kiro-rs', label: 'kiro.rs' },
        };
      }
      return {
        cpa: { id: 'cpa', label: 'CPA' },
        sub2api: { id: 'sub2api', label: 'SUB2API' },
        codex2api: { id: 'codex2api', label: 'Codex2API' },
      };
    },
    normalizeFlowId(value = '', fallback = 'openai') {
      const normalized = String(value || '').trim().toLowerCase();
      return ['openai', 'kiro', 'sample'].includes(normalized)
        ? normalized
        : (['openai', 'kiro', 'sample'].includes(fallback) ? fallback : 'openai');
    },
    normalizeTargetId(flowId, targetId = '', fallback = '') {
      const targets = Object.keys(customFlowRegistry.getTargetDefinitions(flowId));
      const normalized = String(targetId || '').trim().toLowerCase();
      if (targets.includes(normalized)) {
        return normalized;
      }
      if (targets.includes(fallback)) {
        return fallback;
      }
      return customFlowRegistry.getDefaultTargetId(flowId);
    },
  };
  const schema = settingsSchema.createSettingsSchema({ flowRegistry: customFlowRegistry });

  const normalized = schema.normalizeSettingsState({
    activeFlowId: 'sample',
    targetId: 'sample-target',
    settingsState: {
      flows: {
        sample: {
          selectedTargetId: 'sample-target',
          targets: {
            'sample-target': {
              endpoint: 'https://custom.example.com',
            },
          },
          autoRun: {
            stepExecutionRange: { enabled: true, fromStep: 2, toStep: 3 },
          },
        },
      },
    },
  });
  const view = schema.buildSettingsView(normalized);

  assert.equal(normalized.activeFlowId, 'sample');
  assert.equal(normalized.flows.sample.selectedTargetId, 'sample-target');
  assert.equal(normalized.flows.sample.targets['sample-target'].endpoint, 'https://custom.example.com');
  assert.deepEqual(view.stepExecutionRangeByFlow.sample, {
    enabled: true,
    fromStep: 2,
    toStep: 3,
  });
  assert.equal(schema.getSelectedTargetId(normalized, 'sample'), 'sample-target');
});
