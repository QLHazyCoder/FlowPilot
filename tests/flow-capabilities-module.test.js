const test = require('node:test');
const assert = require('node:assert/strict');
const { readFlowCapabilitiesBundle } = require('./helpers/script-bundles.js');

const source = readFlowCapabilitiesBundle();

function loadApi() {
  const scope = {};
  return new Function('self', `${source}; return self.MultiPageFlowCapabilities;`)(scope);
}

test('flow capability registry keeps OpenAI phone signup available while Plus is unavailable', () => {
  const api = loadApi();
  const registry = api.createFlowCapabilityRegistry();

  const enabledState = registry.resolveSidepanelCapabilities({
    state: {
      activeFlowId: 'openai',
      targetId: 'cpa',
      plusModeEnabled: false,
      accountContributionEnabled: false,
      signupMethod: 'phone',
    },
  });

  assert.equal(enabledState.canUsePhoneSignup, true);
  assert.equal(enabledState.effectiveSignupMethod, 'phone');
  assert.equal(enabledState.shouldWarnCpaPhoneSignup, true);
  assert.equal(enabledState.targetCapabilities.usesOauthTimeoutBudget, true);
  assert.deepEqual(enabledState.effectiveSignupMethods, ['email', 'phone']);

  const plusLockedState = registry.resolveSidepanelCapabilities({
    state: {
      activeFlowId: 'openai',
      targetId: 'sub2api',
      plusModeEnabled: true,
      accountContributionEnabled: false,
      signupMethod: 'phone',
    },
  });

  assert.equal(plusLockedState.runtimeLocks.plusModeEnabled, false);
  assert.equal(plusLockedState.canUsePhoneSignup, true);
  assert.equal(plusLockedState.effectiveSignupMethod, 'phone');
  assert.equal(plusLockedState.shouldWarnCpaPhoneSignup, false);
  assert.equal(plusLockedState.targetCapabilities.usesOauthTimeoutBudget, false);
  assert.deepEqual(plusLockedState.effectiveSignupMethods, ['email', 'phone']);
});

test('flow capability registry keeps Plus unavailable for OpenAI', () => {
  const api = loadApi();
  const registry = api.createFlowCapabilityRegistry();

  const capabilityState = registry.resolveSidepanelCapabilities({
    state: {
      activeFlowId: 'openai',
      targetId: 'cpa',
      plusModeEnabled: true,
    },
  });

  assert.equal(api.FLOW_CAPABILITIES.openai.supportsPlusMode, false);
  assert.equal(capabilityState.canShowPlusSettings, false);
  assert.equal(capabilityState.runtimeLocks.plusModeEnabled, false);
  assert.equal(capabilityState.stepDefinitionOptions.plusModeEnabled, false);

  const validation = registry.validateAutoRunStart({
    state: {
      activeFlowId: 'openai',
      targetId: 'cpa',
      plusModeEnabled: true,
    },
  });
  assert.equal(validation.ok, false);
  assert.equal(validation.errors[0].code, 'plus_mode_unsupported');
});

test('flow capability registry resolves account delivery independently from Plus', () => {
  const api = loadApi();
  const registry = api.createFlowCapabilityRegistry();

  const cpaSession = registry.resolveSidepanelCapabilities({
    state: {
      activeFlowId: 'openai',
      targetId: 'cpa',
      accountDeliveryMode: 'session',
      plusModeEnabled: false,
    },
  });

  assert.deepEqual(cpaSession.availableAccountDeliveryModes, ['oauth', 'session']);
  assert.equal(cpaSession.requestedAccountDeliveryMode, 'session');
  assert.equal(cpaSession.effectiveAccountDeliveryMode, 'session');
  assert.equal(cpaSession.effectiveAccountDeliveryRouteId, 'cpa-session');
  assert.equal(cpaSession.canShowAccountDeliveryControl, true);
  assert.equal(cpaSession.canEditAccountDeliveryMode, true);
  assert.equal(cpaSession.stepDefinitionOptions.targetId, 'cpa');
  assert.equal(cpaSession.stepDefinitionOptions.accountDeliveryMode, 'session');
  assert.equal(cpaSession.stepDefinitionOptions.accountDeliveryRouteId, 'cpa-session');

  const sub2ApiAgent = registry.resolveSidepanelCapabilities({
    state: {
      activeFlowId: 'openai',
      targetId: 'sub2api',
      accountDeliveryMode: 'agent_identity',
      plusModeEnabled: false,
    },
  });

  assert.deepEqual(sub2ApiAgent.availableAccountDeliveryModes, ['oauth', 'session', 'agent_identity']);
  assert.equal(sub2ApiAgent.effectiveAccountDeliveryMode, 'agent_identity');
  assert.equal(sub2ApiAgent.effectiveAccountDeliveryRouteId, 'sub2api-agent-identity');
});

test('flow capability registry prefers the selected target delivery setting over a stale flat view', () => {
  const api = loadApi();
  const registry = api.createFlowCapabilityRegistry();

  const capabilityState = registry.resolveSidepanelCapabilities({
    state: {
      activeFlowId: 'openai',
      targetId: 'sub2api',
      accountDeliveryMode: 'session',
      settingsState: {
        flows: {
          openai: {
            targets: {
              cpa: { accountDeliveryMode: 'session' },
              sub2api: { accountDeliveryMode: 'agent_identity' },
            },
          },
        },
      },
    },
  });

  assert.equal(capabilityState.requestedAccountDeliveryMode, 'agent_identity');
  assert.equal(capabilityState.effectiveAccountDeliveryMode, 'agent_identity');
  assert.equal(capabilityState.effectiveAccountDeliveryRouteId, 'sub2api-agent-identity');
});

test('flow capability registry hides fixed delivery controls and locks contribution or running changes', () => {
  const api = loadApi();
  const registry = api.createFlowCapabilityRegistry();

  const webchat = registry.resolveSidepanelCapabilities({
    state: {
      activeFlowId: 'openai',
      targetId: 'webchat',
      accountDeliveryMode: 'oauth',
      openaiWebchatUrl: 'https://webchat.example.com/admin',
      openaiWebchatAdminKey: 'admin-key',
    },
  });

  assert.deepEqual(webchat.availableAccountDeliveryModes, ['session']);
  assert.equal(webchat.requestedAccountDeliveryMode, 'oauth');
  assert.equal(webchat.effectiveAccountDeliveryMode, 'session');
  assert.equal(webchat.effectiveAccountDeliveryRouteId, 'webchat-session');
  assert.equal(webchat.canShowAccountDeliveryControl, false);
  assert.equal(webchat.canEditAccountDeliveryMode, false);

  const contribution = registry.resolveSidepanelCapabilities({
    state: {
      activeFlowId: 'openai',
      targetId: 'sub2api',
      accountDeliveryMode: 'agent_identity',
      accountContributionEnabled: true,
    },
  });

  assert.deepEqual(contribution.availableAccountDeliveryModes, ['oauth']);
  assert.equal(contribution.effectiveAccountDeliveryMode, 'oauth');
  assert.equal(contribution.effectiveAccountDeliveryRouteId, 'oauth');
  assert.equal(contribution.canShowAccountDeliveryControl, false);
  assert.equal(contribution.canEditAccountDeliveryMode, false);

  const running = registry.resolveSidepanelCapabilities({
    autoRunLocked: true,
    state: {
      activeFlowId: 'openai',
      targetId: 'cpa',
      accountDeliveryMode: 'session',
    },
  });

  assert.equal(running.canShowAccountDeliveryControl, true);
  assert.equal(running.canEditAccountDeliveryMode, false);
  assert.equal(running.effectiveAccountDeliveryMode, 'session');
});

test('flow capability registry normalizes unsupported account delivery mode switches', () => {
  const api = loadApi();
  const registry = api.createFlowCapabilityRegistry();

  const validation = registry.validateModeSwitch({
    state: {
      activeFlowId: 'openai',
      targetId: 'cpa',
      accountDeliveryMode: 'agent_identity',
    },
    changedKeys: ['accountDeliveryMode'],
  });

  assert.equal(validation.ok, false);
  assert.equal(validation.normalizedUpdates.accountDeliveryMode, 'oauth');
  assert.deepEqual(
    validation.errors.map((entry) => entry.code),
    ['account_delivery_mode_unsupported']
  );
});

test('flow capability registry defaults unknown flows to minimal non-phone capabilities', () => {
  const api = loadApi();
  const registry = api.createFlowCapabilityRegistry();

  const capabilityState = registry.resolveSidepanelCapabilities({
    state: {
      activeFlowId: 'site-a',
      targetId: 'codex2api',
      plusModeEnabled: true,
      accountContributionEnabled: true,
      signupMethod: 'phone',
    },
  });

  assert.equal(capabilityState.activeFlowId, 'site-a');
  assert.equal(capabilityState.canShowPhoneSettings, false);
  assert.equal(capabilityState.canShowPlusSettings, false);
  assert.equal(capabilityState.canShowLuckmail, false);
  assert.equal(capabilityState.canUsePhoneSignup, false);
  assert.equal(capabilityState.effectiveSignupMethod, 'email');
  assert.equal(capabilityState.effectiveTargetId, 'codex2api');
  assert.deepEqual(capabilityState.supportedTargetIds, []);
});

test('flow capability registry exposes Kiro as an independent flow with its own visible groups', () => {
  const api = loadApi();
  const registry = api.createFlowCapabilityRegistry();

  const capabilityState = registry.resolveSidepanelCapabilities({
    state: {
      activeFlowId: 'kiro',
      targetId: 'kiro-rs',
      signupMethod: 'phone',
      plusModeEnabled: true,
    },
  });

  assert.equal(capabilityState.activeFlowId, 'kiro');
  assert.equal(capabilityState.canShowPhoneSettings, false);
  assert.equal(capabilityState.canShowPlusSettings, false);
  assert.equal(capabilityState.canShowContributionMode, true);
  assert.equal(capabilityState.effectiveSignupMethod, 'email');
  assert.equal(capabilityState.effectiveTargetId, 'kiro-rs');
  assert.deepEqual(capabilityState.flowCapabilities.contributionAdapterIds, ['kiro-builder-id']);
  assert.deepEqual(
    capabilityState.visibleGroupIds,
    ['kiro-runtime-status', 'shared-auto-run', 'kiro-target-kiro-rs', 'service-account', 'service-email', 'service-proxy']
  );
});

test('flow capability registry exposes Grok as an independent SSO flow without OpenAI-only modes', () => {
  const api = loadApi();
  const registry = api.createFlowCapabilityRegistry();

  const capabilityState = registry.resolveSidepanelCapabilities({
    state: {
      activeFlowId: 'grok',
      targetId: 'webchat2api',
      signupMethod: 'phone',
      plusModeEnabled: true,
      accountContributionEnabled: true,
    },
  });

  assert.equal(capabilityState.activeFlowId, 'grok');
  assert.equal(capabilityState.canShowPhoneSettings, false);
  assert.equal(capabilityState.canShowPlusSettings, false);
  assert.equal(capabilityState.canShowContributionMode, false);
  assert.equal(capabilityState.canShowLuckmail, false);
  assert.equal(capabilityState.effectiveSignupMethod, 'email');
  assert.equal(capabilityState.effectiveTargetId, 'webchat2api');
  assert.deepEqual(capabilityState.supportedTargetIds, ['webchat2api', 'grok2api', 'sub2api']);
  assert.deepEqual(capabilityState.flowCapabilities.contributionAdapterIds, []);
  assert.deepEqual(
    capabilityState.visibleGroupIds,
    ['grok-runtime-status', 'shared-auto-run', 'grok-target-webchat2api', 'service-account', 'service-email', 'service-proxy']
  );
});

test('flow capability registry switches Grok settings groups for SUB2API target', () => {
  const api = loadApi();
  const registry = api.createFlowCapabilityRegistry();

  const capabilityState = registry.resolveSidepanelCapabilities({
    state: {
      activeFlowId: 'grok',
      targetId: 'sub2api',
    },
  });

  assert.equal(capabilityState.effectiveTargetId, 'sub2api');
  assert.deepEqual(
    capabilityState.visibleGroupIds,
    ['grok-runtime-status', 'shared-auto-run', 'grok-target-sub2api', 'service-account', 'service-email', 'service-proxy']
  );
  assert.equal(capabilityState.stepDefinitionOptions.grokSub2apiGrok2ApiUploadEnabled, false);
});

test('flow capability registry validates Grok2API target and optional SUB2API dual publishing', () => {
  const api = loadApi();
  const registry = api.createFlowCapabilityRegistry();

  const missingConfig = registry.validateAutoRunStart({
    state: {
      activeFlowId: 'grok',
      targetId: 'sub2api',
      grokSub2apiGrok2ApiUploadEnabled: true,
    },
  });

  assert.equal(missingConfig.ok, false);
  assert.equal(missingConfig.errors[0].code, 'grok2api_config_required');
  assert.equal(missingConfig.capabilityState.stepDefinitionOptions.grokSub2apiGrok2ApiUploadEnabled, true);

  const configured = registry.validateAutoRunStart({
    state: {
      activeFlowId: 'grok',
      targetId: 'sub2api',
      grokSub2apiGrok2ApiUploadEnabled: true,
      grok2ApiUrl: 'https://grok2api.example.com/admin',
      grok2ApiAdminKey: 'admin-key',
    },
  });

  assert.equal(configured.ok, true);
  assert.equal(configured.capabilityState.grok2Api.configComplete, true);

  const directTargetMissing = registry.validateAutoRunStart({
    state: { activeFlowId: 'grok', targetId: 'grok2api' },
  });
  assert.equal(directTargetMissing.ok, false);
  assert.equal(directTargetMissing.errors[0].code, 'grok2api_config_required');
});

test('flow capability registry rejects retired Plus mode and unsupported targets', () => {
  const api = loadApi();
  const registry = api.createFlowCapabilityRegistry({
    flowCapabilities: {
      openai: api.FLOW_CAPABILITIES.openai,
      'site-a': {
        ...api.DEFAULT_FLOW_CAPABILITIES,
        supportedTargetIds: ['cpa'],
      },
    },
  });

  const plusLockedResult = registry.validateAutoRunStart({
    state: {
      activeFlowId: 'openai',
      targetId: 'cpa',
      signupMethod: 'phone',
      plusModeEnabled: true,
      accountContributionEnabled: false,
    },
  });

  assert.equal(plusLockedResult.ok, false);
  assert.equal(plusLockedResult.errors[0].code, 'plus_mode_unsupported');

  const unsupportedPanelResult = registry.validateAutoRunStart({
    state: {
      activeFlowId: 'site-a',
      targetId: 'sub2api',
      signupMethod: 'email',
    },
  });

  assert.equal(unsupportedPanelResult.ok, false);
  assert.equal(unsupportedPanelResult.errors[0].code, 'panel_mode_unsupported');
});

test('flow capability registry normalizes unsupported mode switches back to the effective capability set', () => {
  const api = loadApi();
  const registry = api.createFlowCapabilityRegistry({
    flowCapabilities: {
      openai: api.FLOW_CAPABILITIES.openai,
      'site-a': {
        ...api.DEFAULT_FLOW_CAPABILITIES,
        supportedTargetIds: ['cpa'],
      },
    },
  });

  const validation = registry.validateModeSwitch({
    state: {
      activeFlowId: 'site-a',
      targetId: 'sub2api',
      signupMethod: 'phone',
      plusModeEnabled: true,
      accountContributionEnabled: true,
    },
    changedKeys: ['targetId', 'signupMethod', 'plusModeEnabled', 'accountContributionEnabled'],
  });

  assert.equal(validation.ok, false);
  assert.deepEqual(validation.normalizedUpdates, {
    targetId: 'cpa',
    signupMethod: 'email',
    plusModeEnabled: false,
    accountContributionEnabled: false,
  });
  assert.deepEqual(
    validation.errors.map((entry) => entry.code),
    [
      'panel_mode_unsupported',
      'plus_mode_unsupported',
      'contribution_mode_unsupported',
      'phone_signup_flow_unsupported',
    ]
  );
});

test('flow capability registry falls back to OAuth when the current source cannot import sessions', () => {
  const api = loadApi();
  const registry = api.createFlowCapabilityRegistry();

  const capabilityState = registry.resolveSidepanelCapabilities({
    state: {
      activeFlowId: 'openai',
      targetId: 'codex2api',
      signupMethod: 'email',
      plusModeEnabled: true,
      accountDeliveryMode: 'session',
    },
  });

  assert.deepEqual(
    capabilityState.availableAccountDeliveryModes,
    ['oauth']
  );
  assert.equal(capabilityState.requestedAccountDeliveryMode, 'session');
  assert.equal(capabilityState.effectiveAccountDeliveryMode, 'oauth');
  assert.equal(capabilityState.canEditAccountDeliveryMode, false);
  assert.equal(capabilityState.stepDefinitionOptions.accountDeliveryMode, 'oauth');
  assert.equal(capabilityState.stepDefinitionOptions.accountDeliveryRouteId, 'oauth');
});

test('flow capability registry validates OpenAI webchat target configuration', () => {
  const api = loadApi();
  const registry = api.createFlowCapabilityRegistry();

  const missingConfigResult = registry.validateAutoRunStart({
    state: {
      activeFlowId: 'openai',
      targetId: 'webchat',
      signupMethod: 'email',
      plusModeEnabled: false,
    },
  });

  assert.equal(missingConfigResult.ok, false);
  assert.equal(missingConfigResult.errors[0].code, 'openai_webchat_config_required');
  assert.equal(missingConfigResult.capabilityState.openaiWebchat.targetIsWebchat, true);
  assert.equal(missingConfigResult.capabilityState.stepDefinitionOptions.openaiWebchatUploadEnabled, true);
  assert.equal(missingConfigResult.capabilityState.effectiveAccountDeliveryMode, 'session');

  const configuredState = registry.resolveSidepanelCapabilities({
    state: {
      activeFlowId: 'openai',
      targetId: 'webchat',
      openaiWebchatUrl: 'https://webchat.example.com/admin',
      openaiWebchatAdminKey: 'admin-key',
      plusModeEnabled: false,
    },
  });

  assert.equal(configuredState.openaiWebchat.configComplete, true);
  assert.equal(configuredState.openaiWebchat.uploadRequired, true);
  assert.equal(configuredState.stepDefinitionOptions.openaiWebchatUploadEnabled, true);
  assert.deepEqual(configuredState.availableAccountDeliveryModes, ['session']);
  assert.equal(configuredState.effectiveAccountDeliveryMode, 'session');
  assert.equal(configuredState.effectiveAccountDeliveryRouteId, 'webchat-session');
});

test('flow capability registry disables phone settings for OpenAI webchat target', () => {
  const api = loadApi();
  const registry = api.createFlowCapabilityRegistry();

  const capabilityState = registry.resolveSidepanelCapabilities({
    state: {
      activeFlowId: 'openai',
      targetId: 'webchat',
      signupMethod: 'phone',
      openaiWebchatUrl: 'https://webchat.example.com/admin',
      openaiWebchatAdminKey: 'admin-key',
    },
  });

  assert.equal(capabilityState.canShowPhoneSettings, false);
  assert.equal(capabilityState.canUsePhoneSignup, false);
  assert.equal(capabilityState.effectiveSignupMethod, 'email');
  assert.deepEqual(capabilityState.effectiveSignupMethods, ['email']);
  assert.equal(capabilityState.stepDefinitionOptions.signupMethod, 'email');
  assert.equal(capabilityState.stepDefinitionOptions.openaiWebchatUploadEnabled, true);
  assert.deepEqual(
    capabilityState.visibleGroupIds,
    ['openai-account-delivery', 'openai-plus', 'shared-auto-run', 'openai-oauth', 'openai-step6', 'openai-target-webchat', 'service-account', 'service-email', 'service-proxy']
  );

  const validation = registry.validateModeSwitch({
    state: {
      activeFlowId: 'openai',
      targetId: 'webchat',
      signupMethod: 'phone',
      openaiWebchatUrl: 'https://webchat.example.com/admin',
      openaiWebchatAdminKey: 'admin-key',
    },
    changedKeys: ['targetId', 'signupMethod'],
  });

  assert.equal(validation.ok, false);
  assert.equal(validation.normalizedUpdates.signupMethod, 'email');
  assert.deepEqual(
    validation.errors.map((entry) => entry.code),
    ['phone_signup_panel_unsupported']
  );
});

test('flow capability registry validates OpenAI ChatGPT2API target configuration', () => {
  const api = loadApi();
  const registry = api.createFlowCapabilityRegistry();

  const missingConfigResult = registry.validateAutoRunStart({
    state: {
      activeFlowId: 'openai',
      targetId: 'chatgpt2api',
      signupMethod: 'email',
      plusModeEnabled: false,
    },
  });

  assert.equal(missingConfigResult.ok, false);
  assert.equal(missingConfigResult.errors[0].code, 'openai_chatgpt2api_config_required');
  assert.equal(missingConfigResult.capabilityState.openaiChatgpt2Api.targetIsChatgpt2Api, true);
  assert.equal(missingConfigResult.capabilityState.stepDefinitionOptions.openaiChatgpt2ApiUploadEnabled, true);
  assert.equal(missingConfigResult.capabilityState.stepDefinitionOptions.openaiWebchatUploadEnabled, false);
  assert.equal(missingConfigResult.capabilityState.effectiveAccountDeliveryMode, 'session');

  const configuredState = registry.resolveSidepanelCapabilities({
    state: {
      activeFlowId: 'openai',
      targetId: 'chatgpt2api',
      openaiChatgpt2ApiUrl: 'https://chatgpt2api.example.com/admin',
      openaiChatgpt2ApiAdminKey: 'admin-key',
      plusModeEnabled: false,
    },
  });

  assert.equal(configuredState.openaiChatgpt2Api.configComplete, true);
  assert.equal(configuredState.openaiChatgpt2Api.uploadRequired, true);
  assert.equal(configuredState.stepDefinitionOptions.openaiChatgpt2ApiUploadEnabled, true);
  assert.equal(configuredState.stepDefinitionOptions.openaiWebchatUploadEnabled, false);
  assert.deepEqual(configuredState.availableAccountDeliveryModes, ['session']);
  assert.equal(configuredState.effectiveAccountDeliveryMode, 'session');
  assert.equal(configuredState.effectiveAccountDeliveryRouteId, 'chatgpt2api-session');
});

test('flow capability registry disables phone settings for OpenAI ChatGPT2API target', () => {
  const api = loadApi();
  const registry = api.createFlowCapabilityRegistry();

  const capabilityState = registry.resolveSidepanelCapabilities({
    state: {
      activeFlowId: 'openai',
      targetId: 'chatgpt2api',
      signupMethod: 'phone',
      openaiChatgpt2ApiUrl: 'https://chatgpt2api.example.com/admin',
      openaiChatgpt2ApiAdminKey: 'admin-key',
    },
  });

  assert.equal(capabilityState.canShowPhoneSettings, false);
  assert.equal(capabilityState.canUsePhoneSignup, false);
  assert.equal(capabilityState.effectiveSignupMethod, 'email');
  assert.deepEqual(capabilityState.effectiveSignupMethods, ['email']);
  assert.equal(capabilityState.stepDefinitionOptions.signupMethod, 'email');
  assert.equal(capabilityState.stepDefinitionOptions.openaiChatgpt2ApiUploadEnabled, true);
  assert.deepEqual(
    capabilityState.visibleGroupIds,
    ['openai-account-delivery', 'openai-plus', 'shared-auto-run', 'openai-oauth', 'openai-step6', 'openai-target-chatgpt2api', 'service-account', 'service-email', 'service-proxy']
  );

  const validation = registry.validateModeSwitch({
    state: {
      activeFlowId: 'openai',
      targetId: 'chatgpt2api',
      signupMethod: 'phone',
      openaiChatgpt2ApiUrl: 'https://chatgpt2api.example.com/admin',
      openaiChatgpt2ApiAdminKey: 'admin-key',
    },
    changedKeys: ['targetId', 'signupMethod'],
  });

  assert.equal(validation.ok, false);
  assert.equal(validation.normalizedUpdates.signupMethod, 'email');
  assert.deepEqual(
    validation.errors.map((entry) => entry.code),
    ['phone_signup_panel_unsupported']
  );
});

test('flow capability registry ignores hidden OpenAI webchat add-on upload outside webchat target', () => {
  const api = loadApi();
  const registry = api.createFlowCapabilityRegistry();

  const validation = registry.validateModeSwitch({
    state: {
      activeFlowId: 'openai',
      targetId: 'cpa',
      openaiWebchatUploadEnabled: true,
      openaiWebchatUrl: '',
      openaiWebchatAdminKey: '',
    },
    changedKeys: ['openaiWebchatUploadEnabled'],
  });

  assert.equal(validation.ok, true);
  assert.deepEqual(validation.normalizedUpdates, {});
  assert.deepEqual(validation.errors, []);
  assert.equal(validation.capabilityState.openaiWebchat.additionalUploadEnabled, false);
  assert.equal(validation.capabilityState.openaiWebchat.uploadRequired, false);
  assert.equal(validation.capabilityState.stepDefinitionOptions.openaiWebchatUploadEnabled, false);

  const configuredState = registry.resolveSidepanelCapabilities({
    state: {
      activeFlowId: 'openai',
      targetId: 'cpa',
      openaiWebchatUploadEnabled: true,
      openaiWebchatUrl: 'https://webchat.example.com/admin',
      openaiWebchatAdminKey: 'admin-key',
    },
  });

  assert.equal(configuredState.openaiWebchat.additionalUploadEnabled, false);
  assert.equal(configuredState.openaiWebchat.uploadRequired, false);
  assert.equal(configuredState.stepDefinitionOptions.openaiWebchatUploadEnabled, false);
});
