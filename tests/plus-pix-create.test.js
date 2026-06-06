const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');

// 加载 gpc-utils（提供 Pix 归一化）与 create-plus-checkout 模块。
const gpcUtilsSource = fs.readFileSync('gpc-utils.js', 'utf8');
const source = fs.readFileSync('flows/openai/background/steps/create-plus-checkout.js', 'utf8');
const globalScope = {};
new Function('self', `${gpcUtilsSource};`)(globalScope);
const api = new Function('self', `${source}; return self.MultiPageBackgroundPlusCheckoutCreate;`)(globalScope);

function createExecutorHarness({ redeemResponse, redeemStatus = 200, session = { accessToken: 'eyJ-token' } } = {}) {
  const logs = [];
  const stateUpdates = [];
  const completedNodes = [];
  const fetchCalls = [];
  let nextTabId = 9001;

  const deps = {
    addLog: async (message, level = 'info') => { logs.push({ message, level }); },
    chrome: {
      tabs: {
        create: async () => ({ id: nextTabId }),
        update: async () => ({}),
        remove: async () => ({}),
        get: async (id) => ({ id, url: 'https://chatgpt.com/' }),
      },
    },
    completeNodeFromBackground: async (key, payload = {}) => { completedNodes.push({ key, payload }); },
    createAutomationTab: async () => ({ id: nextTabId }),
    ensureContentScriptReadyOnTabUntilStopped: async () => {},
    fetch: async (url, options = {}) => {
      fetchCalls.push({ url, options });
      return {
        ok: redeemStatus >= 200 && redeemStatus < 300,
        status: redeemStatus,
        json: async () => redeemResponse,
        text: async () => JSON.stringify(redeemResponse),
      };
    },
    registerTab: async () => {},
    sendTabMessageUntilStopped: async (_tabId, _source, message) => {
      // PLUS_CHECKOUT_GET_STATE 用于读取 session。
      if (message?.type === 'PLUS_CHECKOUT_GET_STATE') {
        return { session, accessToken: session?.accessToken || '' };
      }
      return {};
    },
    setState: async (patch) => { stateUpdates.push(patch); },
    sleepWithStop: async () => {},
    waitForTabCompleteUntilStopped: async () => {},
    throwIfStopped: () => {},
  };

  const executor = api.createPlusCheckoutCreateExecutor(deps);
  return { executor, logs, stateUpdates, completedNodes, fetchCalls };
}

test('Pix 发起充值：成功返回 order_id 时存储订单并完成节点', async () => {
  const { executor, stateUpdates, completedNodes, fetchCalls } = createExecutorHarness({
    redeemResponse: { order_id: 12, job_id: 'job-abc', state: 'queued', remaining: 2 },
  });

  await executor.executePlusCheckoutCreate({
    plusPaymentMethod: 'plus-pix',
    pixCdk: 'qz-abcdef1234',
  });

  // 调用了固定内置端点的 redeem 接口（不接受用户自定义地址）
  const redeemCall = fetchCalls.find((call) => String(call.url).includes('/api/v1/redeem'));
  assert.ok(redeemCall, '应调用 /api/v1/redeem');
  assert.ok(String(redeemCall.url).startsWith('https://pixplus.1iiu.com/api/v1/redeem'), '应使用内置 Pix 端点');
  const body = JSON.parse(redeemCall.options.body);
  assert.equal(body.cdk, 'QZ-ABCDEF1234', 'cdk 应被归一化为大写');
  assert.ok(body.access_token.includes('eyJ-token'), 'access_token 应包含 session');

  // 订单号写入 state
  const orderState = stateUpdates.find((patch) => patch.pixOrderId);
  assert.equal(orderState.pixOrderId, '12');
  assert.equal(orderState.plusCheckoutSource, 'plus-pix');

  // 完成节点
  const completion = completedNodes.find((node) => node.key === 'plus-checkout-create');
  assert.ok(completion, '应完成 plus-checkout-create 节点');
  assert.equal(completion.payload.pixOrderId, '12');
});

test('Pix 发起充值：卡密无效返回 400 时抛错', async () => {
  const { executor } = createExecutorHarness({
    redeemResponse: { error: '卡密已用完' },
    redeemStatus: 400,
  });

  await assert.rejects(
    () => executor.executePlusCheckoutCreate({
      plusPaymentMethod: 'plus-pix',
      pixCdk: 'QZ-USED0000000',
    }),
    /卡密已用完/,
  );
});

test('Pix 发起充值：缺少卡密时抛错', async () => {
  const { executor } = createExecutorHarness({ redeemResponse: {} });

  await assert.rejects(
    () => executor.executePlusCheckoutCreate({ plusPaymentMethod: 'plus-pix', pixCdk: '' }),
    /缺少卡密/,
  );
});

test('Pix 发起充值：返回缺少 order_id 时抛错', async () => {
  const { executor } = createExecutorHarness({
    redeemResponse: { state: 'queued' },
  });

  await assert.rejects(
    () => executor.executePlusCheckoutCreate({
      plusPaymentMethod: 'plus-pix',
      pixCdk: 'QZ-NOORDER0000',
    }),
    /不可用响应/,
  );
});
