const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');

const flowRegistrySource = fs.readFileSync('shared/flow-registry.js', 'utf8');
const contributionRegistrySource = fs.readFileSync('shared/contribution-registry.js', 'utf8');
const settingsSchemaSource = fs.readFileSync('shared/settings-schema.js', 'utf8');
const source = fs.readFileSync('shared/flow-capabilities.js', 'utf8');

function loadApi() {
  const scope = {};
  return new Function(
    'self',
    `${flowRegistrySource}; ${contributionRegistrySource}; ${settingsSchemaSource}; ${source}; return self.MultiPageFlowCapabilities;`
  )(scope);
}

test('flow capability registry keeps OpenAI phone signup available only when runtime locks allow it', () => {
  const api = loadApi();
  const registry = api.createFlowCapabilityRegistry();

  const enabledState = registry.resolveSidepanelCapabilities({
    state: {
      activeFlowId: 'openai',
      openaiIntegrationTargetId: 'cpa',
      phoneVerificationEnabled: true,
      plusModeEnabled: false,
      accountContributionEnabled: false,
      signupMethod: 'phone',
    },
  });

  assert.equal(enabledState.canUsePhoneSignup, true);
  assert.equal(enabledState.effectiveSignupMethod, 'phone');
  assert.equal(enabledState.shouldWarnCpaPhoneSignup, true);
  assert.deepEqual(enabledState.effectiveSignupMethods, ['email', 'phone']);

  const plusLockedState = registry.resolveSidepanelCapabilities({
    state: {
      activeFlowId: 'openai',
      openaiIntegrationTargetId: 'sub2api',
      phoneVerificationEnabled: true,
      plusModeEnabled: true,
      accountContributionEnabled: false,
      signupMethod: 'phone',
    },
  });

  assert.equal(plusLockedState.canUsePhoneSignup, false);
  assert.equal(plusLockedState.effectiveSignupMethod, 'email');
  assert.equal(plusLockedState.shouldWarnCpaPhoneSignup, false);
  assert.deepEqual(plusLockedState.effectiveSignupMethods, ['email']);
});

test('flow capability registry defaults unknown flows to minimal non-phone capabilities', () => {
  const api = loadApi();
  const registry = api.createFlowCapabilityRegistry();

  const capabilityState = registry.resolveSidepanelCapabilities({
    state: {
      activeFlowId: 'site-a',
      openaiIntegrationTargetId: 'codex2api',
      phoneVerificationEnabled: true,
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
  assert.equal(capabilityState.panelMode, 'codex2api');
  assert.deepEqual(capabilityState.supportedTargetIds, []);
});

test('flow capability registry exposes Kiro as an independent flow with its own visible groups', () => {
  const api = loadApi();
  const registry = api.createFlowCapabilityRegistry();

  const capabilityState = registry.resolveSidepanelCapabilities({
    state: {
      activeFlowId: 'kiro',
      kiroTargetId: 'kiro-rs',
      openaiIntegrationTargetId: 'sub2api',
      signupMethod: 'phone',
      plusModeEnabled: true,
      phoneVerificationEnabled: true,
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
    ['kiro-runtime-status', 'kiro-target-kiro-rs', 'service-account', 'service-email', 'service-proxy']
  );
});

test('flow capability registry exposes shared auto-run validation for phone locks and target support', () => {
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
      openaiIntegrationTargetId: 'cpa',
      signupMethod: 'phone',
      phoneVerificationEnabled: true,
      plusModeEnabled: true,
      accountContributionEnabled: false,
    },
  });

  assert.equal(plusLockedResult.ok, false);
  assert.equal(plusLockedResult.errors[0].code, 'phone_signup_plus_mode_locked');

  const unsupportedPanelResult = registry.validateAutoRunStart({
    state: {
      activeFlowId: 'site-a',
      openaiIntegrationTargetId: 'sub2api',
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
      openaiIntegrationTargetId: 'sub2api',
      signupMethod: 'phone',
      phoneVerificationEnabled: true,
      plusModeEnabled: true,
      accountContributionEnabled: true,
    },
    changedKeys: [
      'openaiIntegrationTargetId',
      'signupMethod',
      'phoneVerificationEnabled',
      'plusModeEnabled',
      'accountContributionEnabled',
    ],
  });

  assert.equal(validation.ok, false);
  assert.deepEqual(validation.normalizedUpdates, {
    panelMode: 'cpa',
    openaiIntegrationTargetId: 'cpa',
    kiroTargetId: 'cpa',
    signupMethod: 'email',
    phoneVerificationEnabled: false,
    plusModeEnabled: false,
    accountContributionEnabled: false,
    accountContributionEnabled: false,
  });
  assert.deepEqual(
    validation.errors.map((entry) => entry.code),
    [
      'panel_mode_unsupported',
      'plus_mode_unsupported',
      'contribution_mode_unsupported',
      'phone_verification_unsupported',
      'phone_signup_flow_unsupported',
    ]
  );
});

test('flow capability registry exposes editable Plus account access strategies for SUB2API', () => {
  const api = loadApi();
  const registry = api.createFlowCapabilityRegistry();

  const capabilityState = registry.resolveSidepanelCapabilities({
    state: {
      activeFlowId: 'openai',
      openaiIntegrationTargetId: 'sub2api',
      signupMethod: 'email',
      plusModeEnabled: true,
      plusAccountAccessStrategy: 'sub2api_codex_session',
    },
  });

  assert.deepEqual(
    capabilityState.availablePlusAccountAccessStrategies,
    ['oauth', 'cpa_codex_session', 'sub2api_codex_session']
  );
  assert.equal(capabilityState.requestedPlusAccountAccessStrategy, 'sub2api_codex_session');
  assert.equal(capabilityState.effectivePlusAccountAccessStrategy, 'sub2api_codex_session');
  assert.equal(capabilityState.canEditPlusAccountAccessStrategy, true);
  assert.equal(capabilityState.stepDefinitionOptions.plusAccountAccessStrategy, 'sub2api_codex_session');
});

test('flow capability registry exposes editable Plus account access strategies for CPA', () => {
  const api = loadApi();
  const registry = api.createFlowCapabilityRegistry();

  const capabilityState = registry.resolveSidepanelCapabilities({
    state: {
      activeFlowId: 'openai',
      openaiIntegrationTargetId: 'cpa',
      signupMethod: 'email',
      plusModeEnabled: true,
      plusAccountAccessStrategy: 'cpa_codex_session',
    },
  });

  assert.deepEqual(
    capabilityState.availablePlusAccountAccessStrategies,
    ['oauth', 'cpa_codex_session', 'sub2api_codex_session']
  );
  assert.equal(capabilityState.requestedPlusAccountAccessStrategy, 'cpa_codex_session');
  assert.equal(capabilityState.effectivePlusAccountAccessStrategy, 'cpa_codex_session');
  assert.equal(capabilityState.canEditPlusAccountAccessStrategy, true);
  assert.equal(capabilityState.stepDefinitionOptions.plusAccountAccessStrategy, 'cpa_codex_session');
});

test('flow capability registry keeps Plus session strategies independent from the current OpenAI target', () => {
  const api = loadApi();
  const registry = api.createFlowCapabilityRegistry();

  const capabilityState = registry.resolveSidepanelCapabilities({
    state: {
      activeFlowId: 'openai',
      openaiIntegrationTargetId: 'codex2api',
      signupMethod: 'email',
      plusModeEnabled: true,
      plusAccountAccessStrategy: 'sub2api_codex_session',
    },
  });

  assert.deepEqual(
    capabilityState.availablePlusAccountAccessStrategies,
    ['oauth', 'cpa_codex_session', 'sub2api_codex_session']
  );
  assert.equal(capabilityState.requestedPlusAccountAccessStrategy, 'sub2api_codex_session');
  assert.equal(capabilityState.effectivePlusAccountAccessStrategy, 'sub2api_codex_session');
  assert.equal(capabilityState.canEditPlusAccountAccessStrategy, true);
  assert.equal(capabilityState.stepDefinitionOptions.plusAccountAccessStrategy, 'sub2api_codex_session');
});

test('flow capability registry forces SUB2API Plus session import during contribution mode', () => {
  const api = loadApi();
  const registry = api.createFlowCapabilityRegistry();

  const capabilityState = registry.resolveSidepanelCapabilities({
    state: {
      activeFlowId: 'openai',
      openaiIntegrationTargetId: 'cpa',
      signupMethod: 'email',
      plusModeEnabled: true,
      accountContributionEnabled: true,
      plusAccountAccessStrategy: 'cpa_codex_session',
    },
  });

  assert.deepEqual(capabilityState.availablePlusAccountAccessStrategies, ['sub2api_codex_session']);
  assert.equal(capabilityState.requestedPlusAccountAccessStrategy, 'cpa_codex_session');
  assert.equal(capabilityState.effectivePlusAccountAccessStrategy, 'sub2api_codex_session');
  assert.equal(capabilityState.canEditPlusAccountAccessStrategy, false);
  assert.equal(capabilityState.stepDefinitionOptions.plusAccountAccessStrategy, 'sub2api_codex_session');
});
