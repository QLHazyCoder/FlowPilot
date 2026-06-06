const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');

test('background imports account run history module', () => {
  const source = fs.readFileSync('background.js', 'utf8');
  assert.match(source, /background\/account-run-history\.js/);
});

test('account run history module exposes a factory', () => {
  const source = fs.readFileSync('background/account-run-history.js', 'utf8');
  const globalScope = {};

  const api = new Function('self', `${source}; return self.MultiPageBackgroundAccountRunHistory;`)(globalScope);

  assert.equal(typeof api?.createAccountRunHistoryHelpers, 'function');
});

test('account run history helper upgrades old records, keeps stopped items and stores normalized failed snapshot records', async () => {
  const source = fs.readFileSync('background/account-run-history.js', 'utf8');
  const globalScope = {};
  const api = new Function('self', `${source}; return self.MultiPageBackgroundAccountRunHistory;`)(globalScope);

  let storedHistory = [
    { email: 'old@example.com', password: 'old-pass', status: 'success', recordedAt: '2026-04-17T00:00:00.000Z' },
    { email: 'stop@example.com', password: 'stop-pass', status: 'stopped', recordedAt: '2026-04-17T00:10:00.000Z' },
  ];
  let fetchCalled = false;
  global.fetch = async () => {
    fetchCalled = true;
    throw new Error('should not call fetch');
  };

  const helpers = api.createAccountRunHistoryHelpers({
    ACCOUNT_RUN_HISTORY_STORAGE_KEY: 'accountRunHistory',
    addLog: async () => {},
    buildLocalHelperEndpoint: (baseUrl, path) => `${baseUrl}${path}`,
    chrome: {
      storage: {
        local: {
          get: async () => ({ accountRunHistory: storedHistory }),
          set: async (payload) => {
            storedHistory = payload.accountRunHistory;
          },
        },
      },
    },
    getErrorMessage: (error) => error?.message || String(error || ''),
    getNodeTitleForState: (nodeId) => ({
      'fetch-login-code': '获取登录验证码',
      'oauth-login': '刷新 OAuth 并登录',
    })[nodeId] || nodeId,
    getState: async () => ({
      flowId: 'openai',
      runId: 'run-2',
      email: ' latest@example.com ',
      password: ' secret ',
      autoRunning: true,
      autoRunCurrentRun: 2,
      autoRunTotalRuns: 10,
      autoRunAttemptRun: 3,
      accountRunHistoryTextEnabled: false,
      accountRunHistoryHelperBaseUrl: 'http://127.0.0.1:17373',
    }),
    normalizeAccountRunHistoryHelperBaseUrl: (value) => String(value || '').trim(),
  });

  const record = helpers.buildAccountRunHistoryRecord(
    {
      flowId: 'openai',
      runId: 'run-2',
      email: ' latest@example.com ',
      password: ' secret ',
      autoRunning: true,
      autoRunCurrentRun: 2,
      autoRunTotalRuns: 10,
      autoRunAttemptRun: 3,
    },
    'node:fetch-login-code:failed',
    '步骤 8：认证页进入了手机号页面，当前不是 OAuth 同意页，无法继续自动授权。'
  );
  assert.deepStrictEqual(record, {
    recordId: 'latest@example.com',
    flowId: 'openai',
    runId: 'run-2',
    accountIdentifierType: 'email',
    accountIdentifier: 'latest@example.com',
    email: 'latest@example.com',
    phoneNumber: '',
    password: 'secret',
    finalStatus: 'failed',
    finishedAt: record.finishedAt,
    retryCount: 2,
    failureLabel: '出现手机号验证',
    failureDetail: '步骤 8：认证页进入了手机号页面，当前不是 OAuth 同意页，无法继续自动授权。',
    failedNodeId: 'fetch-login-code',
    failedStep: null,
    source: 'auto',
    autoRunContext: {
      currentRun: 2,
      totalRuns: 10,
      attemptRun: 3,
    },
    plusModeEnabled: false,
    accountContributionEnabled: false,
  });

  const appended = await helpers.appendAccountRunRecord('node:fetch-login-code:failed', null, '步骤 8：认证页进入了手机号页面，当前不是 OAuth 同意页，无法继续自动授权。');
  assert.equal(appended.email, 'latest@example.com');
  assert.equal(appended.finalStatus, 'failed');
  assert.equal(appended.flowId, 'openai');
  assert.equal(appended.runId, 'run-2');
  assert.equal(appended.failedNodeId, 'fetch-login-code');
  assert.equal(appended.failureLabel, '出现手机号验证');
  assert.equal(storedHistory.length, 3, '旧的 stopped 记录应在新结构中保留');
  assert.equal(storedHistory.some((item) => item.email === 'stop@example.com' && item.finalStatus === 'stopped'), true);
  assert.equal(storedHistory.some((item) => item.email === 'latest@example.com' && item.retryCount === 2), true);
  assert.equal(storedHistory.some((item) => item.email === 'old@example.com'), true);
  assert.equal(fetchCalled, true);
  assert.equal(helpers.shouldAppendAccountRunTextFile({ accountRunHistoryTextEnabled: false, accountRunHistoryHelperBaseUrl: 'http://127.0.0.1:17373' }), true);
  assert.equal(helpers.shouldAppendAccountRunTextFile({ accountRunHistoryTextEnabled: true, accountRunHistoryHelperBaseUrl: 'http://127.0.0.1:17373' }), true);
  const stoppedRecord = helpers.buildAccountRunHistoryRecord(
    { flowId: 'openai', runId: 'manual-run', email: 'a@b.com', password: 'x' },
    'node:oauth-login:stopped',
    '节点 oauth-login 已被用户停止'
  );
  assert.equal(stoppedRecord.recordId, 'a@b.com');
  assert.equal(stoppedRecord.flowId, 'openai');
  assert.equal(stoppedRecord.runId, 'manual-run');
  assert.equal(stoppedRecord.email, 'a@b.com');
  assert.equal(stoppedRecord.password, 'x');
  assert.equal(stoppedRecord.finalStatus, 'stopped');
  assert.equal(stoppedRecord.retryCount, 0);
  assert.equal(stoppedRecord.failureLabel, '节点 刷新 OAuth 并登录 停止');
  assert.equal(stoppedRecord.failureDetail, '节点 oauth-login 已被用户停止');
  assert.equal(stoppedRecord.failedNodeId, 'oauth-login');
  assert.equal(stoppedRecord.failedStep, null);
  assert.equal(stoppedRecord.source, 'manual');
  assert.equal(stoppedRecord.autoRunContext, null);
  assert.ok(stoppedRecord.finishedAt);

  const genericStoppedRecord = helpers.buildAccountRunHistoryRecord({ email: 'stop@b.com', password: 'y' }, 'stopped', 'stop');
  assert.equal(genericStoppedRecord.failureLabel, '流程已停止');
  assert.equal(genericStoppedRecord.failedStep, null);

  const runningRecord = helpers.buildAccountRunHistoryRecord({
    email: 'run@b.com',
    password: 'z',
    autoRunning: true,
    autoRunCurrentRun: 1,
    autoRunTotalRuns: 2,
    autoRunAttemptRun: 1,
  }, 'running', '正在运行');
  assert.equal(runningRecord, null);

  const normalizedStoppedRecord = helpers.normalizeAccountRunHistoryRecord({
    recordId: 'legacy-stop@example.com',
    email: 'legacy-stop@example.com',
    password: 'secret',
    finalStatus: 'stopped',
    finishedAt: '2026-04-17T00:12:00.000Z',
    retryCount: 0,
    failureLabel: '流程已停止',
    failureDetail: '步骤 7 已被用户停止。',
    failedNodeId: 'oauth-login',
    failedStep: 7,
    source: 'manual',
    autoRunContext: null,
  });
  assert.equal(normalizedStoppedRecord.failureLabel, '节点 刷新 OAuth 并登录 停止');
  assert.equal(normalizedStoppedRecord.failedNodeId, 'oauth-login');
  assert.equal(normalizedStoppedRecord.failedStep, 7);
});

test('account run history helper accepts phone-only records without forcing email or password', () => {
  const source = fs.readFileSync('background/account-run-history.js', 'utf8');
  const globalScope = {};
  const api = new Function('self', `${source}; return self.MultiPageBackgroundAccountRunHistory;`)(globalScope);

  const helpers = api.createAccountRunHistoryHelpers({
    chrome: { storage: { local: { get: async () => ({}), set: async () => {} } } },
    getState: async () => ({}),
    normalizeAccountRunHistoryHelperBaseUrl: (value) => String(value || '').trim(),
  });

  const record = helpers.buildAccountRunHistoryRecord({
    accountIdentifierType: 'phone',
    accountIdentifier: '+6612345',
    signupPhoneNumber: '+6612345',
    password: '',
  }, 'success');

  assert.deepStrictEqual(record, {
    recordId: 'phone:+6612345',
    flowId: '',
    runId: '',
    accountIdentifierType: 'phone',
    accountIdentifier: '+6612345',
    email: '',
    phoneNumber: '+6612345',
    password: '',
    finalStatus: 'success',
    finishedAt: record.finishedAt,
    retryCount: 0,
    failureLabel: '流程完成',
    failureDetail: '',
    failedNodeId: '',
    failedStep: null,
    source: 'manual',
    autoRunContext: null,
    plusModeEnabled: false,
    accountContributionEnabled: false,
  });

  const normalized = helpers.normalizeAccountRunHistoryRecord({
    recordId: 'phone:+6612345',
    accountIdentifierType: 'phone',
    accountIdentifier: '+6612345',
    phoneNumber: '+6612345',
    finalStatus: 'failed',
    failureDetail: '步骤 8：手机号验证码超时。',
  });

  assert.equal(normalized.recordId, 'phone:+6612345');
  assert.equal(normalized.accountIdentifierType, 'phone');
  assert.equal(normalized.accountIdentifier, '+6612345');
  assert.equal(normalized.email, '');
  assert.equal(normalized.phoneNumber, '+6612345');
  assert.equal(normalized.password, '');
  assert.equal(normalized.finalStatus, 'failed');
});

test('account run history does not turn prerequisite guidance into a fake step 2 failure', () => {
  const source = fs.readFileSync('background/account-run-history.js', 'utf8');
  const globalScope = {};
  const api = new Function('self', `${source}; return self.MultiPageBackgroundAccountRunHistory;`)(globalScope);

  const helpers = api.createAccountRunHistoryHelpers({
    chrome: { storage: { local: { get: async () => ({}), set: async () => {} } } },
    getState: async () => ({}),
    normalizeAccountRunHistoryHelperBaseUrl: (value) => String(value || '').trim(),
  });

  const genericFailedRecord = helpers.buildAccountRunHistoryRecord({
    email: 'late@example.com',
    password: 'secret',
    autoRunning: true,
    autoRunCurrentRun: 1,
    autoRunTotalRuns: 3,
    autoRunAttemptRun: 2,
  }, 'failed', '缺少登录账号：请先完成步骤 2，或在侧栏填写账号后再执行当前步骤。');

  assert.equal(genericFailedRecord.failedStep, null);
  assert.equal(genericFailedRecord.failureLabel, '流程失败');

  const explicitFailedRecord = helpers.buildAccountRunHistoryRecord({
    email: 'late@example.com',
    password: 'secret',
    autoRunning: true,
    autoRunCurrentRun: 1,
    autoRunTotalRuns: 3,
    autoRunAttemptRun: 2,
  }, 'node:platform-verify:failed', '缺少登录账号：请先完成步骤 2，或在侧栏填写账号后再执行当前步骤。');

  assert.equal(explicitFailedRecord.failedNodeId, 'platform-verify');
  assert.equal(explicitFailedRecord.failedStep, null);
  assert.equal(explicitFailedRecord.failureLabel, '节点 platform-verify 失败');

  const migratedOldRecord = helpers.normalizeAccountRunHistoryRecord({
    email: 'old@example.com',
    password: 'secret',
    finalStatus: 'failed',
    failureLabel: '步骤 2 失败',
    failureDetail: '缺少登录账号：请先完成步骤 2，或在侧栏填写账号后再执行当前步骤。',
    failedStep: 2,
  });

  assert.equal(migratedOldRecord.failedStep, null);
  assert.equal(migratedOldRecord.failureLabel, '流程失败');
});

test('account run history merges email and phone identities from the same run', async () => {
  const source = fs.readFileSync('background/account-run-history.js', 'utf8');
  const globalScope = {};
  const api = new Function('self', `${source}; return self.MultiPageBackgroundAccountRunHistory;`)(globalScope);

  let storedHistory = [
    {
      recordId: 'phone:+447799342687',
      accountIdentifierType: 'phone',
      accountIdentifier: '+447799342687',
      phoneNumber: '+44 7799 342687',
      email: '',
      password: '',
      finalStatus: 'stopped',
      finishedAt: '2026-04-17T04:30:00.000Z',
      failureDetail: '步骤 2 已使用手机号，流程尚未完成。',
    },
    {
      recordId: 'tmp@example.com',
      accountIdentifierType: 'email',
      accountIdentifier: 'tmp@example.com',
      email: 'tmp@example.com',
      phoneNumber: '',
      password: 'old',
      finalStatus: 'stopped',
      finishedAt: '2026-04-17T04:31:00.000Z',
      failureDetail: '步骤 2 已使用邮箱，流程尚未完成。',
    },
  ];

  const helpers = api.createAccountRunHistoryHelpers({
    chrome: {
      storage: {
        local: {
          get: async () => ({ accountRunHistory: storedHistory }),
          set: async (payload) => {
            storedHistory = payload.accountRunHistory;
          },
        },
      },
    },
    getState: async () => ({}),
    normalizeAccountRunHistoryHelperBaseUrl: () => '',
  });

  const failedRecord = helpers.buildAccountRunHistoryRecord({
    accountIdentifierType: 'email',
    accountIdentifier: 'tmp@example.com',
    email: 'tmp@example.com',
    password: 'secret',
    currentPhoneActivation: {
      activationId: 'a1',
      phoneNumber: '+44 7799 342687',
    },
  }, 'node:confirm-oauth:failed', '步骤 9：手机号验证失败。');
  assert.equal(failedRecord.accountIdentifierType, 'email');
  assert.equal(failedRecord.accountIdentifier, 'tmp@example.com');
  assert.equal(failedRecord.phoneNumber, '+44 7799 342687');
  assert.equal(failedRecord.failedNodeId, 'confirm-oauth');
  assert.equal(failedRecord.failedStep, null);

  const successRecord = await helpers.appendAccountRunRecord('success', {
    accountIdentifierType: 'email',
    accountIdentifier: 'tmp@example.com',
    email: 'tmp@example.com',
    phoneNumber: '447799342687',
    password: 'secret',
    accountRunHistoryHelperBaseUrl: '',
  });

  assert.equal(successRecord.recordId, 'tmp@example.com');
  assert.equal(successRecord.email, 'tmp@example.com');
  assert.equal(successRecord.phoneNumber, '447799342687');
  assert.equal(storedHistory.length, 1);
  assert.equal(storedHistory[0].recordId, 'tmp@example.com');
  assert.equal(storedHistory[0].finalStatus, 'success');
});

test('account run history keeps phone as primary identity when phone signup later binds email', async () => {
  const source = fs.readFileSync('background/account-run-history.js', 'utf8');
  const globalScope = {};
  const api = new Function('self', `${source}; return self.MultiPageBackgroundAccountRunHistory;`)(globalScope);

  let storedHistory = [{
    recordId: 'phone:+447700900123',
    accountIdentifierType: 'phone',
    accountIdentifier: '+447700900123',
    phoneNumber: '+447700900123',
    email: '',
    finalStatus: 'stopped',
    finishedAt: '2026-04-17T04:31:00.000Z',
    failureDetail: '步骤 2 已使用手机号，流程尚未完成。',
  }];

  const helpers = api.createAccountRunHistoryHelpers({
    chrome: {
      storage: {
        local: {
          get: async () => ({ accountRunHistory: storedHistory }),
          set: async (payload) => {
            storedHistory = payload.accountRunHistory;
          },
        },
      },
    },
    getState: async () => ({}),
    normalizeAccountRunHistoryHelperBaseUrl: () => '',
  });

  const record = await helpers.appendAccountRunRecord('success', {
    accountIdentifierType: 'phone',
    accountIdentifier: '+447700900123',
    signupPhoneNumber: '+447700900123',
    email: 'bound@example.com',
    password: 'secret',
    accountRunHistoryHelperBaseUrl: '',
  });

  assert.equal(record.recordId, 'phone:+447700900123');
  assert.equal(record.accountIdentifierType, 'phone');
  assert.equal(record.accountIdentifier, '+447700900123');
  assert.equal(record.email, 'bound@example.com');
  assert.equal(record.phoneNumber, '+447700900123');
  assert.equal(storedHistory.length, 1);
  assert.equal(storedHistory[0].recordId, 'phone:+447700900123');
  assert.equal(storedHistory[0].finalStatus, 'success');
});

test('account run history records preserve Plus and contribution mode flags', () => {
  const source = fs.readFileSync('background/account-run-history.js', 'utf8');
  const globalScope = {};
  const api = new Function('self', `${source}; return self.MultiPageBackgroundAccountRunHistory;`)(globalScope);

  const helpers = api.createAccountRunHistoryHelpers({
    chrome: { storage: { local: { get: async () => ({}), set: async () => {} } } },
    getState: async () => ({}),
    normalizeAccountRunHistoryHelperBaseUrl: (value) => String(value || '').trim(),
  });

  const record = helpers.buildAccountRunHistoryRecord({
    email: 'plus@example.com',
    password: 'secret',
    plusModeEnabled: true,
    accountContributionEnabled: true,
  }, 'success');

  assert.equal(record.plusModeEnabled, true);
  assert.equal(record.accountContributionEnabled, true);

  const normalized = helpers.normalizeAccountRunHistoryRecord({
    email: 'plus@example.com',
    password: 'secret',
    finalStatus: 'success',
    plusModeEnabled: true,
    accountContributionEnabled: true,
  });

  assert.equal(normalized.plusModeEnabled, true);
  assert.equal(normalized.accountContributionEnabled, true);
});

test('account run history helper clears persisted records and syncs full snapshot payload to local helper', async () => {
  const source = fs.readFileSync('background/account-run-history.js', 'utf8');
  const globalScope = {};
  const api = new Function('self', `${source}; return self.MultiPageBackgroundAccountRunHistory;`)(globalScope);

  let storedHistory = [{
    recordId: 'user@example.com',
    email: 'user@example.com',
    password: 'secret',
    finalStatus: 'failed',
    finishedAt: '2026-04-17T01:00:00.000Z',
    retryCount: 1,
    failureLabel: '步骤 6 失败',
    failureDetail: '步骤 6：判断失败后已重试 2 次，仍未成功。',
    failedStep: 6,
    source: 'auto',
    autoRunContext: {
      currentRun: 1,
      totalRuns: 5,
      attemptRun: 2,
    },
  }];
  const fetchCalls = [];
  global.fetch = async (url, options = {}) => {
    fetchCalls.push({
      url,
      options,
    });
    return {
      ok: true,
      json: async () => ({
        ok: true,
        filePath: 'C:/tmp/account-run-history.json',
      }),
    };
  };

  const logs = [];
  const helpers = api.createAccountRunHistoryHelpers({
    ACCOUNT_RUN_HISTORY_STORAGE_KEY: 'accountRunHistory',
    addLog: async (message, level) => {
      logs.push({ message, level });
    },
    buildLocalHelperEndpoint: (baseUrl, path) => `${baseUrl}${path}`,
    chrome: {
      storage: {
        local: {
          get: async () => ({ accountRunHistory: storedHistory }),
          set: async (payload) => {
            storedHistory = payload.accountRunHistory;
          },
        },
      },
    },
    getErrorMessage: (error) => error?.message || String(error || ''),
    getState: async () => ({
      accountRunHistoryTextEnabled: true,
      accountRunHistoryHelperBaseUrl: 'http://127.0.0.1:17373',
    }),
    normalizeAccountRunHistoryHelperBaseUrl: (value) => String(value || '').trim(),
  });

  const payload = helpers.buildAccountRunHistorySnapshotPayload(storedHistory);
  assert.deepStrictEqual(payload.summary, {
    total: 1,
    success: 0,
    running: 0,
    failed: 1,
    stopped: 0,
    retryTotal: 1,
  });

  const clearResult = await helpers.clearAccountRunHistory();
  assert.deepStrictEqual(clearResult, { clearedCount: 1 });
  assert.deepStrictEqual(storedHistory, []);
  assert.equal(fetchCalls.length, 1);
  assert.equal(fetchCalls[0].url, 'http://127.0.0.1:17373/sync-account-run-records');
  assert.deepStrictEqual(JSON.parse(fetchCalls[0].options.body), {
    generatedAt: JSON.parse(fetchCalls[0].options.body).generatedAt,
    summary: {
      total: 0,
      success: 0,
      running: 0,
      failed: 0,
      stopped: 0,
      retryTotal: 0,
    },
    records: [],
  });
  assert.equal(logs[0].message, '账号记录快照已同步到本地：C:/tmp/account-run-history.json');
});

test('account run history helper deletes selected records and syncs remaining snapshot payload', async () => {
  const source = fs.readFileSync('background/account-run-history.js', 'utf8');
  const globalScope = {};
  const api = new Function('self', `${source}; return self.MultiPageBackgroundAccountRunHistory;`)(globalScope);

  let storedHistory = [
    {
      recordId: 'keep@example.com',
      email: 'keep@example.com',
      password: 'secret',
      finalStatus: 'success',
      finishedAt: '2026-04-17T01:10:00.000Z',
      retryCount: 0,
      failureLabel: '流程完成',
      failureDetail: '',
      failedStep: null,
      source: 'manual',
      autoRunContext: null,
    },
    {
      recordId: 'remove@example.com',
      email: 'remove@example.com',
      password: 'secret',
      finalStatus: 'failed',
      finishedAt: '2026-04-17T01:00:00.000Z',
      retryCount: 2,
      failureLabel: '步骤 8 失败',
      failureDetail: '步骤 8：认证页异常',
      failedStep: 8,
      source: 'auto',
      autoRunContext: {
        currentRun: 1,
        totalRuns: 5,
        attemptRun: 3,
      },
    },
  ];
  const fetchCalls = [];
  global.fetch = async (url, options = {}) => {
    fetchCalls.push({
      url,
      options,
    });
    return {
      ok: true,
      json: async () => ({
        ok: true,
        filePath: 'C:/tmp/account-run-history.json',
      }),
    };
  };

  const logs = [];
  const helpers = api.createAccountRunHistoryHelpers({
    ACCOUNT_RUN_HISTORY_STORAGE_KEY: 'accountRunHistory',
    addLog: async (message, level) => {
      logs.push({ message, level });
    },
    buildLocalHelperEndpoint: (baseUrl, path) => `${baseUrl}${path}`,
    chrome: {
      storage: {
        local: {
          get: async () => ({ accountRunHistory: storedHistory }),
          set: async (payload) => {
            storedHistory = payload.accountRunHistory;
          },
        },
      },
    },
    getErrorMessage: (error) => error?.message || String(error || ''),
    getState: async () => ({
      accountRunHistoryTextEnabled: true,
      accountRunHistoryHelperBaseUrl: 'http://127.0.0.1:17373',
    }),
    normalizeAccountRunHistoryHelperBaseUrl: (value) => String(value || '').trim(),
  });

  const result = await helpers.deleteAccountRunHistoryRecords(['remove@example.com']);
  assert.deepStrictEqual(result, {
    deletedCount: 1,
    remainingCount: 1,
  });
  assert.equal(storedHistory.length, 1);
  assert.equal(storedHistory[0].email, 'keep@example.com');
  assert.equal(fetchCalls.length, 1);
  assert.equal(fetchCalls[0].url, 'http://127.0.0.1:17373/sync-account-run-records');
  assert.deepStrictEqual(JSON.parse(fetchCalls[0].options.body), {
    generatedAt: JSON.parse(fetchCalls[0].options.body).generatedAt,
    summary: {
      total: 1,
      success: 1,
      running: 0,
      failed: 0,
      stopped: 0,
      retryTotal: 0,
    },
    records: storedHistory,
  });
  assert.equal(logs[0].message, '账号记录快照已同步到本地：C:/tmp/account-run-history.json');
});
