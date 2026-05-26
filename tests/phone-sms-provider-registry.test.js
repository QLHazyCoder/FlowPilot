const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');

const source = fs.readFileSync('phone-sms/providers/registry.js', 'utf8');
const madaoSource = fs.readFileSync('phone-sms/providers/madao.js', 'utf8');
const nexSmsSource = fs.readFileSync('phone-sms/providers/nexsms.js', 'utf8');

function loadRegistry(root = {}) {
  return new Function('self', `${source}; return self.PhoneSmsProviderRegistry;`)(root);
}

test('phone sms provider registry normalizes ids, order and labels consistently', () => {
  const registry = loadRegistry({
    PhoneSmsHeroSmsProvider: {
      createProvider: (deps = {}) => ({ provider: 'hero-sms', deps }),
    },
    PhoneSmsFiveSimProvider: {
      createProvider: (deps = {}) => ({ provider: '5sim', deps }),
    },
    PhoneSmsNexSmsProvider: {
      createProvider: (deps = {}) => ({ provider: 'nexsms', deps }),
    },
    PhoneSmsMaDaoProvider: {
      createProvider: (deps = {}) => ({ provider: 'madao', deps }),
    },
  });

  assert.deepStrictEqual(registry.getProviderIds(), ['hero-sms', '5sim', 'nexsms', 'madao']);
  assert.equal(registry.normalizeProviderId(' NEXSMS '), 'nexsms');
  assert.equal(registry.normalizeProviderId(' MaDao '), 'madao');
  assert.equal(registry.normalizeProviderId('unknown-provider'), 'hero-sms');
  assert.equal(registry.getProviderLabel('nexsms'), 'NexSMS');
  assert.equal(registry.getProviderLabel('madao'), 'MaDao');
  assert.equal(registry.getProviderDefinition('nexsms').moduleKey, 'PhoneSmsNexSmsProvider');
  assert.equal(registry.getProviderDefinition('madao').moduleKey, 'PhoneSmsMaDaoProvider');
  assert.deepStrictEqual(
    registry.normalizeProviderOrder([
      { provider: 'madao' },
      { provider: 'nexsms' },
      { id: '5sim' },
      { value: 'hero-sms' },
      'NEXSMS',
    ]),
    ['madao', 'nexsms', '5sim', 'hero-sms']
  );
  assert.deepStrictEqual(
    registry.normalizeProviderOrder([], ['nexsms', 'madao', '5sim', 'nexsms']),
    ['nexsms', 'madao', '5sim']
  );
  assert.deepStrictEqual(
    registry.createProvider('5sim', { foo: 1 }),
    { provider: '5sim', deps: { foo: 1 } }
  );
  assert.deepStrictEqual(
    registry.createProvider('madao', { bar: 2 }),
    { provider: 'madao', deps: { bar: 2 } }
  );
  assert.deepStrictEqual(
    registry.createProvider('nexsms', { baz: 3 }),
    { provider: 'nexsms', deps: { baz: 3 } }
  );
});

test('phone sms provider registry can create the real MaDao provider module', () => {
  const madaoModule = new Function('self', `${madaoSource}; return self.PhoneSmsMaDaoProvider;`)({});
  const registry = loadRegistry({
    PhoneSmsMaDaoProvider: madaoModule,
  });

  const provider = registry.createProvider('madao', { fetchImpl: 'demo-fetch' });

  assert.equal(provider.id, 'madao');
  assert.equal(provider.label, 'MaDao');
  assert.equal(provider.defaultProduct, 'openai');
  assert.equal(typeof provider.acquireActivation, 'function');
  assert.equal(typeof provider.pollActivation, 'function');
  assert.equal(typeof provider.releaseActivation, 'function');
  assert.equal(provider.mapTicketStatus('waiting_code'), 'waiting_code');
});

test('phone sms provider registry can create the real NexSMS provider module', async () => {
  const nexSmsModule = new Function('self', `${nexSmsSource}; return self.PhoneSmsNexSmsProvider;`)({});
  const registry = loadRegistry({
    PhoneSmsNexSmsProvider: nexSmsModule,
  });

  const provider = registry.createProvider('nexsms', { fetchImpl: 'demo-fetch' });

  assert.equal(provider.id, 'nexsms');
  assert.equal(provider.label, 'NexSMS');
  assert.equal(provider.defaultProduct, 'OpenAI');
  assert.equal(provider.defaultServiceCode, 'ot');
  assert.equal(typeof provider.fetchBalance, 'function');
  assert.equal(typeof provider.fetchPrices, 'function');
  assert.equal(provider.normalizeCountryId('8'), 8);
  assert.equal(provider.normalizeServiceCode(' OT '), 'ot');
});
