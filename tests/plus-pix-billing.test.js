const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');

// 加载 gpc-utils（提供 Pix 归一化）与 fill-plus-checkout 模块。
const gpcUtilsSource = fs.readFileSync('gpc-utils.js', 'utf8');
const source = fs.readFileSync('flows/openai/background/steps/fill-plus-checkout.js', 'utf8');
const globalScope = {};
new Function('self', `${gpcUtilsSource};`)(globalScope);
const api = new Function('self', `${source}; return self.MultiPageBackgroundPlusCheckoutBilling;`)(globalScope);

// orderResponses：按轮询次数依次返回的订单状态（最后一个会重复）。
function createBillingHarness({ orderResponses = [], orderStatus = 200 } = {}) {
  const logs = [];
  const stateUpdates = [];
  const completedNodes = [];
  let pollIndex = 0;

  const deps = {
    addLog: async (message, level = 'info') => { logs.push({ message, level }); },
    chrome: { tabs: { update: async () => ({}) } },
    completeNodeFromBackground: async (key, payload = {}) => { completedNodes.push({ key, payload }); },
    ensureContentScriptReadyOnTabUntilStopped: async () => {},
    fetch: async (url) => {
      const idx = Math.min(pollIndex, orderResponses.length - 1);
      pollIndex += 1;
      const payload = orderResponses[idx];
      return {
        ok: orderStatus >= 200 && orderStatus < 300,
        status: orderStatus,
        text: async () => JSON.stringify(payload),
      };
    },
    getState: async () => ({}),
    getTabId: async () => 0,
    isTabAlive: async () => false,
    setState: async (patch) => { stateUpdates.push(patch); },
    sleepWithStop: async () => {},
    waitForTabCompleteUntilStopped: async () => {},
    throwIfStopped: () => {},
  };

  const executor = api.createPlusCheckoutBillingExecutor(deps);
  return { executor, logs, stateUpdates, completedNodes, getPollCount: () => pollIndex };
}

const PIX_STATE = { plusPaymentMethod: 'plus-pix', pixOrderId: '12', pixBaseUrl: 'https://pixplus.1iiu.com', pixTimeoutSeconds: 60 };

test('Pix 轮询：queued → running → done(paid) 判成功并完成节点', async () => {
  const { executor, completedNodes, getPollCount } = createBillingHarness({
    orderResponses: [
      { state: 'queued' },
      { state: 'running' },
      { state: 'done', payment_status: 'paid' },
    ],
  });

  await executor.executePlusCheckoutBilling(PIX_STATE);

  assert.equal(getPollCount(), 3, '应轮询 3 次');
  const completion = completedNodes.find((node) => node.key === 'plus-checkout-billing');
  assert.ok(completion, '应完成 plus-checkout-billing 节点');
  assert.equal(completion.payload.pixPaymentStatus, 'paid');
});

test('Pix 轮询：done(pix_ready) 视为成功', async () => {
  const { executor, completedNodes } = createBillingHarness({
    orderResponses: [{ state: 'done', payment_status: 'pix_ready' }],
  });

  await executor.executePlusCheckoutBilling(PIX_STATE);
  assert.ok(completedNodes.some((node) => node.key === 'plus-checkout-billing'));
});

test('Pix 轮询：done(already_plus) 视为成功', async () => {
  const { executor, completedNodes } = createBillingHarness({
    orderResponses: [{ state: 'done', payment_status: 'already_plus' }],
  });

  await executor.executePlusCheckoutBilling(PIX_STATE);
  assert.ok(completedNodes.some((node) => node.key === 'plus-checkout-billing'));
});

test('Pix 轮询：state=failed 抛错', async () => {
  const { executor } = createBillingHarness({
    orderResponses: [{ state: 'failed', payment_status: 'declined' }],
  });

  await assert.rejects(
    () => executor.executePlusCheckoutBilling(PIX_STATE),
    /充值失败/,
  );
});

test('Pix 轮询：done 但 payment_status 异常时抛错', async () => {
  const { executor } = createBillingHarness({
    orderResponses: [{ state: 'done', payment_status: 'refunded' }],
  });

  await assert.rejects(
    () => executor.executePlusCheckoutBilling(PIX_STATE),
    /支付状态异常/,
  );
});

test('Pix 轮询：缺少订单号时抛错', async () => {
  const { executor } = createBillingHarness({ orderResponses: [{ state: 'done', payment_status: 'paid' }] });

  await assert.rejects(
    () => executor.executePlusCheckoutBilling({ plusPaymentMethod: 'plus-pix', pixOrderId: '' }),
    /缺少 Pix 订单号/,
  );
});

test('Pix 轮询：HTTP 错误时抛错', async () => {
  const { executor } = createBillingHarness({
    orderResponses: [{ error: '订单不存在' }],
    orderStatus: 404,
  });

  await assert.rejects(
    () => executor.executePlusCheckoutBilling(PIX_STATE),
    /查询 Pix 订单状态失败/,
  );
});
