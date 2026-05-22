const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const { readFlowRegistryBundle } = require('./helpers/script-bundles.js');

const flowRegistrySource = readFlowRegistryBundle();
const contributionRegistrySource = fs.readFileSync('shared/contribution-registry.js', 'utf8');

function loadApi() {
  const scope = {};
  return new Function(
    'self',
    `${flowRegistrySource}; ${contributionRegistrySource}; return self.MultiPageContributionRegistry;`
  )(scope);
}

test('contribution registry exposes OpenAI and Kiro adapters through one contract', () => {
  const api = loadApi();

  assert.deepEqual(
    api.getContributionAdapterIds('openai'),
    ['openai-oauth', 'openai-codex-file', 'openai-sub2api-file']
  );
  assert.deepEqual(api.getContributionAdapterIds('kiro'), ['kiro-builder-id']);
  assert.equal(api.getDefaultContributionAdapterId('openai'), 'openai-oauth');
  assert.equal(api.getDefaultContributionAdapterId('kiro'), 'kiro-builder-id');
  assert.equal(api.getAdapterDefinition('kiro-builder-id')?.artifactKind, 'kiro-builder-id');
  assert.equal(api.getAdapterDefinition('openai-oauth')?.flowId, 'openai');
  assert.equal(api.hasContributionAdapter('kiro', 'kiro-builder-id'), true);
  assert.equal(api.hasContributionAdapter('kiro', 'openai-oauth'), false);
});

test('contribution registry resolves the combined tutorial entry per flow', () => {
  const api = loadApi();

  assert.deepEqual(
    api.getContributionTutorialEntry('openai', {
      portalBaseUrl: 'https://flowpilot.example/root/',
      targetId: 'sub2api',
    }),
    {
      id: 'openai-contribution-tutorial',
      flowId: 'openai',
      label: '贡献/使用教程',
      portalPath: '/tutorial',
      defaultTargetId: 'cpa',
      contributionAdapterId: 'openai-oauth',
      action: 'open-portal-and-enable-contribution',
      targetId: 'sub2api',
      portalUrl: 'https://flowpilot.example/root/tutorial?flow=openai&target=sub2api',
    }
  );

  assert.deepEqual(
    api.getContributionTutorialEntry('kiro', {
      portalBaseUrl: 'https://flowpilot.example',
    }),
    {
      id: 'kiro-contribution-tutorial',
      flowId: 'kiro',
      label: '贡献/使用教程',
      portalPath: '/tutorial',
      defaultTargetId: 'kiro-rs',
      contributionAdapterId: 'kiro-builder-id',
      action: 'open-portal-and-enable-contribution',
      targetId: 'kiro-rs',
      portalUrl: 'https://flowpilot.example/tutorial?flow=kiro&target=kiro-rs',
    }
  );
});

test('contribution registry keeps Grok SSO export flow out of published contribution checks', () => {
  const api = loadApi();

  assert.equal(api.getContributionTutorialEntry('grok'), null);
  assert.deepEqual(api.getContributionAdapterIds('grok'), []);
  assert.deepEqual(api.getPublishedContributionFlowIds(['openai', 'kiro', 'grok']), ['openai', 'kiro']);
  assert.throws(
    () => api.assertPublishedFlowsHaveContributionAdapters(['grok']),
    /缺少账号贡献适配器：grok/
  );
});

test('contribution registry fails fast when a published flow has no adapter', () => {
  const api = loadApi();

  assert.deepEqual(api.getPublishedContributionFlowIds(), ['openai', 'kiro']);
  assert.equal(api.assertPublishedFlowsHaveContributionAdapters(), true);
  assert.equal(api.assertPublishedFlowsHaveContributionAdapters(['openai', 'kiro']), true);
  assert.throws(
    () => api.assertPublishedFlowsHaveContributionAdapters(['openai', 'missing-flow']),
    /缺少账号贡献适配器：missing-flow/
  );
});
