'use strict';

const assert = require('node:assert');
const test = require('node:test');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');

const RUNNER_PATH = path.join(
  __dirname,
  '..',
  'flows',
  'openai-reauth',
  'background',
  'batch-runner.js'
);

function loadRunnerModule() {
  const source = fs.readFileSync(RUNNER_PATH, 'utf-8');
  const sandbox = { self: {}, globalThis: {}, console, setTimeout, clearTimeout };
  vm.createContext(sandbox);
  vm.runInContext(source, sandbox);
  return sandbox.self.MultiPageOpenAiReauthBatchRunner;
}

function buildDeps(overrides = {}) {
  const calls = {
    log: [],
    setState: [],
    executeNode: [],
    sleep: [],
  };

  let mockState = {};
  let stopFlag = false;
  let pollIndex = 0;

  function getMockState() {
    return JSON.parse(JSON.stringify(mockState));
  }

  const deps = {
    addLog: async (message, level, options) => {
      calls.log.push({ message, level, options });
    },
    setState: async (updates) => {
      calls.setState.push(JSON.parse(JSON.stringify(updates || {})));
      mockState = { ...mockState, ...(updates || {}) };
    },
    getState: async () => getMockState(),
    executeNode: async (nodeId) => {
      calls.executeNode.push(nodeId);
      if (typeof overrides.executeNodeHandler === 'function') {
        const result = await overrides.executeNodeHandler(nodeId, pollIndex, mockState);
        if (result && typeof result === 'object') {
          mockState = { ...mockState, ...result };
        }
        return;
      }
      // 默认 stub：在最后一个 node（capture-reauth-callback）执行后写入成功 result
      if (nodeId === 'capture-reauth-callback') {
        pollIndex += 1;
        const successAccount = {
          ...(mockState.reauthInputAccount || {}),
          credentials: {
            ...(mockState.reauthInputAccount?.credentials || {}),
            access_token: `new_access_${pollIndex}`,
            refresh_token: `new_refresh_${pollIndex}`,
          },
        };
        mockState = { ...mockState, reauthResultAccount: successAccount };
      }
    },
    getNodeIdsForState: overrides.getNodeIdsForState || (() => [
      'prepare-reauth',
      'submit-reauth-email',
      'fetch-reauth-code',
      'capture-reauth-callback',
    ]),
    throwIfStopped: () => {
      if (stopFlag) {
        const err = new Error('已被用户停止');
        throw err;
      }
    },
    sleepWithStop: async (ms) => {
      calls.sleep.push(ms);
      if (typeof overrides.onSleep === 'function') {
        await overrides.onSleep(ms, calls.sleep.length);
      }
    },
    interAccountDelayMs: overrides.interAccountDelayMs ?? 0,
  };

  return {
    deps,
    calls,
    setStopped: (value) => { stopFlag = Boolean(value); },
    getMockState,
  };
}

// ============================================================
// 纯函数：extractAccountEmail
// ============================================================

test('extractAccountEmail 优先 credentials.email > email > name', () => {
  const mod = loadRunnerModule();
  assert.equal(
    mod.extractAccountEmail({ credentials: { email: 'A@x.com' }, email: 'B@y.com', name: 'C@z.com' }),
    'a@x.com'
  );
  assert.equal(
    mod.extractAccountEmail({ email: 'B@Y.com', name: 'C@z.com' }),
    'b@y.com'
  );
  assert.equal(mod.extractAccountEmail({ name: 'C@Z.com' }), 'c@z.com');
  assert.equal(mod.extractAccountEmail(null), '');
  assert.equal(mod.extractAccountEmail({}), '');
});

// ============================================================
// 纯函数：mergeBatchResultsIntoFile
// ============================================================

test('mergeBatchResultsIntoFile：sub2api accounts 数组按 email 替换成功账号', () => {
  const mod = loadRunnerModule();
  const original = JSON.stringify({
    accounts: [
      { name: 'A@2925.com', credentials: { email: 'A@2925.com', access_token: 'old_a' }, priority: 1 },
      { name: 'B@2925.com', credentials: { email: 'B@2925.com', access_token: 'old_b' }, priority: 2 },
    ],
  });
  const success = [
    { name: 'A@2925.com', credentials: { email: 'a@2925.com', access_token: 'new_a' } },
  ];

  const merged = JSON.parse(mod.mergeBatchResultsIntoFile(original, success));
  assert.equal(merged.accounts[0].credentials.access_token, 'new_a');
  assert.equal(merged.accounts[0].priority, 1, '原 priority 必须保留');
  assert.equal(merged.accounts[1].credentials.access_token, 'old_b', '未在 success 列表的账号保留原状');
});

test('mergeBatchResultsIntoFile：顶层数组形式正常 merge', () => {
  const mod = loadRunnerModule();
  const original = JSON.stringify([
    { email: 'a@x.com', credentials: { email: 'a@x.com', access_token: 'old' } },
  ]);
  const success = [{ email: 'a@x.com', credentials: { email: 'a@x.com', access_token: 'new' } }];

  const merged = JSON.parse(mod.mergeBatchResultsIntoFile(original, success));
  assert.equal(merged[0].credentials.access_token, 'new');
});

test('mergeBatchResultsIntoFile：单账号对象形式正常 merge', () => {
  const mod = loadRunnerModule();
  const original = JSON.stringify({
    email: 'a@x.com',
    credentials: { email: 'a@x.com', access_token: 'old' },
    extra: { keep: true },
  });
  const success = [{ email: 'a@x.com', credentials: { email: 'a@x.com', access_token: 'new' } }];

  const merged = JSON.parse(mod.mergeBatchResultsIntoFile(original, success));
  assert.equal(merged.credentials.access_token, 'new');
  assert.deepEqual(merged.extra, { keep: true });
});

test('mergeBatchResultsIntoFile：原始文本不可解析时退化为 success 数组', () => {
  const mod = loadRunnerModule();
  const merged = JSON.parse(mod.mergeBatchResultsIntoFile('not a json', [{ email: 'a@x.com' }]));
  assert.deepEqual(merged, [{ email: 'a@x.com' }]);
});

test('mergeBatchResultsIntoFile：空 originalFileText 退化为 success 数组', () => {
  const mod = loadRunnerModule();
  const merged = JSON.parse(mod.mergeBatchResultsIntoFile('', [{ email: 'a@x.com' }]));
  assert.deepEqual(merged, [{ email: 'a@x.com' }]);
});

// ============================================================
// executeReauthBatch 主流程
// ============================================================

test('executeReauthBatch：空 accounts 抛错', async () => {
  const mod = loadRunnerModule();
  const { deps } = buildDeps();
  const { executeReauthBatch } = mod.createReauthBatchRunner(deps);

  await assert.rejects(
    () => executeReauthBatch({ accounts: [] }),
    /批量队列为空/
  );
});

test('executeReauthBatch：顺序跑完 3 个账号，全部成功', async () => {
  const mod = loadRunnerModule();
  const { deps, calls } = buildDeps();
  const { executeReauthBatch } = mod.createReauthBatchRunner(deps);

  const accounts = [
    { email: 'a@2925.com', credentials: { email: 'a@2925.com', access_token: 'old_a' } },
    { email: 'b@2925.com', credentials: { email: 'b@2925.com', access_token: 'old_b' } },
    { email: 'c@2925.com', credentials: { email: 'c@2925.com', access_token: 'old_c' } },
  ];

  const result = await executeReauthBatch({
    accounts,
    mailProvider: '2925',
    originalFileText: JSON.stringify({ accounts }),
  });

  assert.equal(result.successCount, 3);
  assert.equal(result.failedCount, 0);
  assert.equal(result.total, 3);
  assert.equal(result.aborted, false);
  // 每个账号 4 个 node，共 12 次 executeNode
  assert.equal(calls.executeNode.length, 12);

  const merged = JSON.parse(result.updatedFileJson);
  assert.equal(merged.accounts.length, 3);
  assert.equal(merged.accounts[0].credentials.access_token, 'new_access_1');
  assert.equal(merged.accounts[2].credentials.access_token, 'new_access_3');
});

test('executeReauthBatch：中间账号失败时 skip 继续，最终统计正确', async () => {
  const mod = loadRunnerModule();
  let nodeRun = 0;
  const { deps } = buildDeps({
    executeNodeHandler: async (nodeId, currentSuccess, state) => {
      nodeRun += 1;
      const targetEmail = state?.reauthInputAccount?.credentials?.email;
      if (nodeId === 'fetch-reauth-code' && targetEmail === 'b@2925.com') {
        throw new Error('mock 第二个账号 fetch-code 失败');
      }
      if (nodeId === 'capture-reauth-callback') {
        return {
          reauthResultAccount: {
            ...(state.reauthInputAccount || {}),
            credentials: {
              ...(state.reauthInputAccount?.credentials || {}),
              access_token: `new_for_${targetEmail}`,
            },
          },
        };
      }
    },
  });
  const { executeReauthBatch } = mod.createReauthBatchRunner(deps);

  const accounts = [
    { credentials: { email: 'a@2925.com' } },
    { credentials: { email: 'b@2925.com' } },
    { credentials: { email: 'c@2925.com' } },
  ];

  const result = await executeReauthBatch({
    accounts,
    mailProvider: '2925',
  });

  assert.equal(result.successCount, 2);
  assert.equal(result.failedCount, 1);
  assert.equal(result.failed[0].email, 'b@2925.com');
  assert.match(result.failed[0].error, /fetch-code 失败/);
  assert.equal(result.aborted, false);
});

test('executeReauthBatch：skipOnFailure=false 时失败立即终止', async () => {
  const mod = loadRunnerModule();
  const { deps, calls, getMockState } = buildDeps({
    executeNodeHandler: async (nodeId, _, state) => {
      const email = state?.reauthInputAccount?.credentials?.email;
      if (email === 'b@2925.com' && nodeId === 'prepare-reauth') {
        throw new Error('mock 第二账号一上来就 fail');
      }
      if (nodeId === 'capture-reauth-callback') {
        return {
          reauthResultAccount: {
            ...(state.reauthInputAccount || {}),
            credentials: {
              ...(state.reauthInputAccount?.credentials || {}),
              access_token: 'new',
            },
          },
        };
      }
    },
  });
  const { executeReauthBatch } = mod.createReauthBatchRunner(deps);

  const accounts = [
    { credentials: { email: 'a@2925.com' } },
    { credentials: { email: 'b@2925.com' } },
    { credentials: { email: 'c@2925.com' } },
  ];

  await assert.rejects(
    () => executeReauthBatch({
      accounts,
      mailProvider: '2925',
      skipOnFailure: false,
    }),
    /mock 第二账号一上来就 fail/
  );

  // 第三个账号不应被处理
  const lastStateUpdate = calls.setState[calls.setState.length - 1];
  assert.equal(lastStateUpdate.reauthBatchResult.aborted, true);
  assert.equal(lastStateUpdate.reauthBatchResult.successCount, 1);
  assert.equal(lastStateUpdate.reauthBatchResult.failedCount, 1);
  assert.match(lastStateUpdate.reauthBatchResult.stopReason, /第二账号一上来就 fail/);
});

test('executeReauthBatch：stop 信号 → 立即终止，aborted=true & stopReason=user_stop', async () => {
  const mod = loadRunnerModule();
  let nodeRun = 0;
  const { deps, calls } = buildDeps({
    executeNodeHandler: async (nodeId, _, state) => {
      nodeRun += 1;
      if (nodeRun === 5) {
        throw new Error('已被用户停止');
      }
      if (nodeId === 'capture-reauth-callback') {
        return {
          reauthResultAccount: {
            ...(state.reauthInputAccount || {}),
            credentials: {
              ...(state.reauthInputAccount?.credentials || {}),
              access_token: 'new',
            },
          },
        };
      }
    },
  });
  const { executeReauthBatch } = mod.createReauthBatchRunner(deps);

  const accounts = [
    { credentials: { email: 'a@2925.com' } },
    { credentials: { email: 'b@2925.com' } },
    { credentials: { email: 'c@2925.com' } },
  ];

  await assert.rejects(
    () => executeReauthBatch({ accounts, mailProvider: '2925' }),
    /已被用户停止/
  );

  const lastStateUpdate = calls.setState[calls.setState.length - 1];
  assert.equal(lastStateUpdate.reauthBatchResult.aborted, true);
  assert.equal(lastStateUpdate.reauthBatchResult.stopReason, 'user_stop');
  assert.equal(lastStateUpdate.reauthBatchProgress.currentStatus, 'stopped');
});

test('executeReauthBatch：progress 每轮 currentStatus 流转 running → success / failed', async () => {
  const mod = loadRunnerModule();
  const { deps, calls } = buildDeps();
  const { executeReauthBatch } = mod.createReauthBatchRunner(deps);

  await executeReauthBatch({
    accounts: [{ credentials: { email: 'a@2925.com' } }],
    mailProvider: '2925',
    originalFileText: JSON.stringify({ accounts: [{ credentials: { email: 'a@2925.com' } }] }),
  });

  const progressUpdates = calls.setState
    .filter((u) => u.reauthBatchProgress)
    .map((u) => u.reauthBatchProgress.currentStatus);

  assert.ok(progressUpdates.includes('pending'));
  assert.ok(progressUpdates.includes('running'));
  assert.ok(progressUpdates.includes('success'));
  assert.ok(progressUpdates.includes('completed'));
});

test('executeReauthBatch：runSingleAccount 把 mailProvider 注入到 state.reauthInputAccount', async () => {
  const mod = loadRunnerModule();
  const { deps, calls } = buildDeps();
  const { executeReauthBatch } = mod.createReauthBatchRunner(deps);

  await executeReauthBatch({
    accounts: [{ credentials: { email: 'a@2925.com' } }],
    mailProvider: '2925',
  });

  const inputAccountUpdate = calls.setState
    .find((u) => u.reauthInputAccount && u.reauthInputAccount.credentials?.email === 'a@2925.com');
  assert.ok(inputAccountUpdate);
  assert.equal(inputAccountUpdate.reauthInputAccount.mailProvider, '2925');
});

test('executeReauthBatch：每账号开始前清空 reauthResultAccount / nodeStatuses 避免污染', async () => {
  const mod = loadRunnerModule();
  const { deps, calls } = buildDeps();
  const { executeReauthBatch } = mod.createReauthBatchRunner(deps);

  await executeReauthBatch({
    accounts: [
      { credentials: { email: 'a@2925.com' } },
      { credentials: { email: 'b@2925.com' } },
    ],
    mailProvider: '2925',
  });

  const inputResets = calls.setState.filter(
    (u) => u.reauthInputAccount && u.reauthResultAccount === null
  );
  assert.equal(inputResets.length, 2, '每个账号开始时都应 reset reauthResultAccount');
  inputResets.forEach((reset) => {
    assert.deepEqual(reset.nodeStatuses, {}, '应重置 nodeStatuses');
  });
});

test('executeReauthBatch：interAccountDelayMs > 0 时账号之间会 sleep（最后一个账号不 sleep）', async () => {
  const mod = loadRunnerModule();
  const { deps, calls } = buildDeps({ interAccountDelayMs: 1000 });
  const { executeReauthBatch } = mod.createReauthBatchRunner(deps);

  await executeReauthBatch({
    accounts: [
      { credentials: { email: 'a@2925.com' } },
      { credentials: { email: 'b@2925.com' } },
      { credentials: { email: 'c@2925.com' } },
    ],
    mailProvider: '2925',
  });

  // 3 个账号之间 sleep 2 次
  assert.equal(calls.sleep.length, 2);
  assert.equal(calls.sleep[0], 1000);
});
