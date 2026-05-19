const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');

const source = fs.readFileSync('background/plus-hosted-checkout-success.js', 'utf8');

function loadApi() {
  const scope = {};
  return new Function('self', `${source}; return self.MultiPagePlusHostedCheckoutSuccess;`)(scope);
}

function createState(overrides = {}) {
  return {
    plusModeEnabled: true,
    plusPaymentMethod: 'paypal',
    plusHostedCheckoutCompletionPending: true,
    plusCheckoutTabId: 77,
    nodeStatuses: {
      'plus-checkout-create': 'running',
    },
    ...overrides,
  };
}

test('hosted checkout success manager completes plus-checkout-create on the tracked success tab', async () => {
  const api = loadApi();
  const events = [];
  let state = createState();
  const manager = api.createPlusHostedCheckoutSuccessManager({
    addLog: async (message, level, options) => events.push({ type: 'log', message, level, options }),
    completeNodeFromBackground: async (nodeId, payload) => events.push({ type: 'complete', nodeId, payload }),
    getState: async () => state,
    setState: async (payload) => {
      events.push({ type: 'set-state', payload });
      state = { ...state, ...payload };
    },
  });

  const successUrl = 'https://chatgpt.com/payments/success?session_id=cs_test';
  const result = await manager.handleTabUpdated(77, { status: 'complete' }, { url: successUrl });

  assert.deepEqual(result, {
    completed: true,
    plusReturnUrl: successUrl,
  });
  assert.deepEqual(events.find((event) => event.type === 'complete'), {
    type: 'complete',
    nodeId: 'plus-checkout-create',
    payload: {
      plusReturnUrl: successUrl,
      plusHostedCheckoutCompleted: true,
    },
  });
  assert.equal(state.plusHostedCheckoutCompletionPending, false);
  assert.equal(state.plusHostedCheckoutCompleted, true);
  assert.equal(state.plusReturnUrl, successUrl);
  assert.equal(events.find((event) => event.type === 'log')?.options?.nodeId, 'plus-checkout-create');
});

test('hosted checkout success manager ignores unrelated updates and inactive states', async () => {
  const api = loadApi();
  const events = [];
  let state = createState();
  const manager = api.createPlusHostedCheckoutSuccessManager({
    completeNodeFromBackground: async () => events.push('complete'),
    getState: async () => state,
    setState: async () => events.push('set-state'),
  });

  assert.equal(api.isPaymentSuccessUrl('https://chatgpt.com/payments/success'), true);
  assert.equal(api.isPaymentSuccessUrl('https://example.com/payments/success'), false);
  assert.equal(await manager.handleTabUpdated(77, { status: 'loading' }, { url: 'https://chatgpt.com/payments/success' }), null);
  assert.equal(await manager.handleTabUpdated(77, { status: 'complete' }, { url: 'https://chatgpt.com/' }), null);
  assert.equal(await manager.handleTabUpdated(88, { status: 'complete' }, { url: 'https://chatgpt.com/payments/success' }), null);

  state = createState({ plusHostedCheckoutCompletionPending: false });
  assert.equal(await manager.handleTabUpdated(77, { status: 'complete' }, { url: 'https://chatgpt.com/payments/success' }), null);

  state = createState({ plusHostedCheckoutCompletionPending: true, nodeStatuses: { 'plus-checkout-create': 'completed' } });
  assert.equal(await manager.handleTabUpdated(77, { status: 'complete' }, { url: 'https://chatgpt.com/payments/success' }), null);
  assert.deepEqual(events, []);
});

test('hosted checkout success manager deduplicates concurrent success events for one tab', async () => {
  const api = loadApi();
  const events = [];
  const state = createState();
  let releaseComplete;
  const completeGate = new Promise((resolve) => {
    releaseComplete = resolve;
  });
  const manager = api.createPlusHostedCheckoutSuccessManager({
    addLog: async () => {},
    completeNodeFromBackground: async (nodeId) => {
      events.push({ type: 'complete', nodeId });
      await completeGate;
    },
    getState: async () => state,
    setState: async (payload) => events.push({ type: 'set-state', payload }),
  });

  const first = manager.handleTabUpdated(77, { status: 'complete' }, { url: 'https://chatgpt.com/payments/success' });
  const second = manager.handleTabUpdated(77, { status: 'complete' }, { url: 'https://chatgpt.com/payments/success' });
  await Promise.resolve();
  releaseComplete();

  const results = await Promise.all([first, second]);
  assert.equal(results.filter(Boolean).length, 1);
  assert.equal(events.filter((event) => event.type === 'complete').length, 1);
});

test('hosted checkout success manager fails the checkout node when continuation throws', async () => {
  const api = loadApi();
  const events = [];
  const manager = api.createPlusHostedCheckoutSuccessManager({
    addLog: async (message, level) => events.push({ type: 'log', message, level }),
    completeNodeFromBackground: async () => {
      throw new Error('boom');
    },
    failNodeFromBackground: async (nodeId, message) => events.push({ type: 'fail', nodeId, message }),
    getState: async () => createState(),
    setState: async () => {},
  });

  const result = await manager.handleTabUpdated(77, { status: 'complete' }, { url: 'https://chatgpt.com/payments/success' });

  assert.equal(result.failed, true);
  assert.equal(result.message, 'boom');
  assert.deepEqual(events.find((event) => event.type === 'fail'), {
    type: 'fail',
    nodeId: 'plus-checkout-create',
    message: 'boom',
  });
  assert.equal(events.some((event) => event.type === 'log' && event.level === 'error'), true);
});
