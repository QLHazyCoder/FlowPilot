const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');

// 加载 gpc-utils（提供 Plus 自动充值归一化）与 fill-plus-checkout 模块。
const gpcUtilsSource = fs.readFileSync('gpc-utils.js', 'utf8');
const source = fs.readFileSync('flows/openai/background/steps/fill-plus-checkout.js', 'utf8');
const globalScope = {};
new Function('self', `${gpcUtilsSource};`)(globalScope);
const api = new Function('self', `${source}; return self.MultiPageBackgroundPlusCheckoutBilling;`)(globalScope);

// responses：按轮询次数依次返回 { status, payload }（最后一个重复）。
// 默认 status=200。fetch 会按请求 URL 区分 jobs/logs 与 orders。
function createBillingHarness({ responses = [] } = {}) {
  const logs = [];
  const stateUpdates = [];
  const completedNodes = [];
  const fetchedUrls = [];
  let pollIndex = 0;

  const deps = {
    addLog: async (message, level = 'info') => { logs.push({ message, level }); },
    chrome: { tabs: { update: async () => ({}) } },
    completeNodeFromBackground: async (key, payload = {}) => { completedNodes.push({ key, payload }); },
    ensureContentScriptReadyOnTabUntilStopped: async () => {},
    fetch: async (url) => {
      fetchedUrls.push(String(url));
      const idx = Math.min(pollIndex, responses.length - 1);
      pollIndex += 1;
      const entry = responses[idx] || { payload: {} };
      const status = entry.status || 200;
      return {
        ok: status >= 200 && status < 300,
        status,
        text: async () => JSON.stringify(entry.payload ?? {}),
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
  return { executor, logs, stateUpdates, completedNodes, fetchedUrls, getPollCount: () => pollIndex };
}

const AUTO_STATE = { plusPaymentMethod: 'plus-auto', autoOrderId: '12', autoJobId: 'job-abc', autoTimeoutSeconds: 60 };

test('Plus 自动充值轮询 jobs/logs：queued → running → done 判成功并渲染进度日志', async () => {
  const { executor, completedNodes, fetchedUrls, logs, getPollCount } = createBillingHarness({
    responses: [
      { payload: { state: 'queued', logs: [{ t: '14:22:01', msg: '🔑 已解析账号', key: 'parsed' }] } },
      { payload: { state: 'running', logs: [
        { t: '14:22:01', msg: '🔑 已解析账号', key: 'parsed' },
        { t: '14:22:25', msg: '⏳ 结账中…（已等 20s）', key: 'checkout' },
      ] } },
      { payload: { state: 'done', email: 'user@example.com', logs: [
        { t: '14:22:01', msg: '🔑 已解析账号', key: 'parsed' },
        { t: '14:22:25', msg: '⏳ 结账中…（已等 20s）', key: 'checkout' },
        { t: '14:23:16', msg: '🚀 开通 Plus 成功', key: 'done_ok' },
      ] } },
    ],
  });

  await executor.executePlusCheckoutBilling(AUTO_STATE);

  assert.equal(getPollCount(), 3, '应轮询 3 次');
  assert.ok(fetchedUrls.every((u) => u.includes('/api/v1/jobs/job-abc/logs')), '应轮询 jobs/logs 接口');
  const completion = completedNodes.find((node) => node.key === 'plus-checkout-billing');
  assert.ok(completion, '应完成 plus-checkout-billing 节点');
  // 进度日志增量渲染：每条 msg 只输出一次
  assert.ok(logs.some((l) => l.message.includes('🚀 开通 Plus 成功')), '应渲染成功进度');
  const parsedCount = logs.filter((l) => l.message.includes('🔑 已解析账号')).length;
  assert.equal(parsedCount, 1, '同一条进度日志不应重复渲染');
});

test('Plus 自动充值轮询：done_already（账号已是 Plus）也判成功', async () => {
  const { executor, completedNodes } = createBillingHarness({
    responses: [{ payload: { state: 'done', logs: [{ t: '14:22:05', msg: '✅ 该账号已是 Plus', key: 'done_already' }] } }],
  });
  await executor.executePlusCheckoutBilling(AUTO_STATE);
  assert.ok(completedNodes.some((node) => node.key === 'plus-checkout-billing'));
});

test('Plus 自动充值轮询：state=failed 时按 error_key 给出友好提示', async () => {
  const { executor } = createBillingHarness({
    responses: [{ payload: { state: 'failed', error_key: 'err_no_trial', error: '❌ 该账号无免费试用资格' } }],
  });
  await assert.rejects(
    () => executor.executePlusCheckoutBilling(AUTO_STATE),
    /无免费试用资格/,
  );
});

test('Plus 自动充值轮询：job 404 时回退到 orders 终态查询并成功', async () => {
  const { executor, completedNodes, fetchedUrls } = createBillingHarness({
    responses: [
      { status: 404, payload: { error: 'job not found or expired' } },
      { payload: { state: 'done', payment_status: 'paid', email: 'u@e.com' } },
    ],
  });
  await executor.executePlusCheckoutBilling(AUTO_STATE);
  assert.ok(fetchedUrls.some((u) => u.includes('/api/v1/jobs/')), '先查 jobs/logs');
  assert.ok(fetchedUrls.some((u) => u.includes('/api/v1/orders/12')), '404 后回退 orders');
  assert.ok(completedNodes.some((node) => node.key === 'plus-checkout-billing'));
});

test('Plus 自动充值轮询：无 job_id 时直接走 orders 终态轮询', async () => {
  const { executor, completedNodes, fetchedUrls } = createBillingHarness({
    responses: [{ payload: { state: 'done', payment_status: 'paid' } }],
  });
  await executor.executePlusCheckoutBilling({ plusPaymentMethod: 'plus-auto', autoOrderId: '12', autoTimeoutSeconds: 60 });
  assert.ok(fetchedUrls.every((u) => u.includes('/api/v1/orders/12')), '应仅查 orders 接口');
  assert.ok(completedNodes.some((node) => node.key === 'plus-checkout-billing'));
});

test('Plus 自动充值轮询：缺少订单号时抛错', async () => {
  const { executor } = createBillingHarness({ responses: [{ payload: { state: 'done' } }] });
  await assert.rejects(
    () => executor.executePlusCheckoutBilling({ plusPaymentMethod: 'plus-auto', autoOrderId: '' }),
    /缺少 Plus 自动充值订单号/,
  );
});

test('Plus 自动充值轮询：jobs/logs 非 404 错误时抛错', async () => {
  const { executor } = createBillingHarness({
    responses: [{ status: 500, payload: { error: '服务器错误' } }],
  });
  await assert.rejects(
    () => executor.executePlusCheckoutBilling(AUTO_STATE),
    /查询进度失败/,
  );
});
