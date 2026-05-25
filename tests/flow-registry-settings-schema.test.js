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
    ['openai-plus', 'openai-phone', 'shared-auto-run', 'openai-oauth', 'openai-step6', 'shared-settings-actions', 'openai-target-cpa', 'service-account', 'service-email', 'service-proxy']
  );
  assert.deepEqual(
    flowRegistry.getVisibleGroupIds('kiro', 'kiro-rs'),
    ['kiro-runtime-status', 'shared-auto-run', 'shared-settings-actions', 'kiro-target-kiro-rs', 'service-account', 'service-email', 'service-proxy']
  );
  assert.deepEqual(
    flowRegistry.getVisibleGroupIds('grok', 'webchat2api'),
    ['grok-runtime-status', 'shared-auto-run', 'shared-settings-actions', 'grok-target-webchat2api', 'service-account', 'service-email', 'service-proxy']
  );
  assert.deepEqual(
    flowRegistry.getTargetOptions('openai').map((entry) => entry.id),
    ['cpa', 'sub2api', 'codex2api']
  );
  assert.deepEqual(
    flowRegistry.getTargetOptions('grok').map((entry) => entry.id),
    ['webchat2api']
  );
  assert.deepEqual(
    flowRegistry.getSettingsGroupDefinition('openai-plus')?.rowIds,
    ['row-plus-mode', 'row-plus-account-access-strategy', 'row-plus-payment-method']
  );
  assert.deepEqual(
    flowRegistry.getSettingsGroupDefinition('shared-auto-run')?.rowIds,
    ['row-shared-auto-run', 'row-auto-run-thread-interval', 'row-step-execution-range']
  );
  assert.deepEqual(
    flowRegistry.getSettingsGroupDefinition('shared-settings-actions')?.rowIds,
    ['row-settings-actions']
  );
  assert.equal(flowRegistry.getPublicationTargetDefinition('kiro', 'kiro-rs')?.label, 'kiro.rs');
  assert.equal(flowRegistry.getFlowCapabilities('openai').supportsAccountContribution, true);
  assert.equal(flowRegistry.getFlowCapabilities('kiro').supportsAccountContribution, true);
  assert.equal(flowRegistry.getFlowCapabilities('grok').supportsAccountContribution, false);
  assert.deepEqual(flowRegistry.getFlowCapabilities('grok').supportedTargetIds, ['webchat2api']);
  assert.deepEqual(
    flowRegistry.getFlowCapabilities('openai').contributionAdapterIds,
    ['openai-oauth', 'openai-codex-file', 'openai-sub2api-file']
  );
  assert.deepEqual(
    flowRegistry.getFlowCapabilities('kiro').contributionAdapterIds,
    ['kiro-builder-id']
  );
  assert.deepEqual(flowRegistry.getFlowCapabilities('grok').contributionAdapterIds, []);
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
    plusAccountAccessStrategy: 'sub2api_codex_session',
    kiroRsUrl: 'https://kiro.example.com/admin',
    kiroRsKey: 'secret-key',
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
  assert.equal(normalized.flows.openai.plus.plusAccountAccessStrategy, 'sub2api_codex_session');
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
    plusAccountAccessStrategy: 'sub2api_codex_session',
  });
  const view = schema.buildSettingsView(normalized);

  assert.equal(view.activeFlowId, 'kiro');
  assert.equal(view.targetId, 'kiro-rs');
  assert.equal(view.kiroRsUrl, 'https://kiro.example.com/admin');
  assert.equal(view.kiroRsKey, 'key-123');
  assert.equal(view.plusAccountAccessStrategy, 'sub2api_codex_session');
  assert.equal(view.settingsSchemaVersion, 5);
  assert.equal(view.settingsState.activeFlowId, 'kiro');
  assert.deepEqual(view.stepExecutionRangeByFlow.grok, {
    enabled: false,
    fromStep: 1,
    toStep: 6,
  });
});

test('settings schema preserves CPA session strategy in canonical state and read view', () => {
  const { settingsSchema } = loadApis();
  const schema = settingsSchema.createSettingsSchema();
  const normalized = schema.normalizeSettingsState({
    plusAccountAccessStrategy: 'cpa_codex_session',
  });
  const view = schema.buildSettingsView(normalized);

  assert.equal(normalized.flows.openai.plus.plusAccountAccessStrategy, 'cpa_codex_session');
  assert.equal(view.plusAccountAccessStrategy, 'cpa_codex_session');
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
