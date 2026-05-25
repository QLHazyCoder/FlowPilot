const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');

const source = fs.readFileSync('background.js', 'utf8');

function extractFunction(name) {
  const markers = [`async function ${name}(`, `function ${name}(`];
  const start = markers
    .map((marker) => source.indexOf(marker))
    .find((index) => index >= 0);
  if (start < 0) {
    throw new Error(`missing function ${name}`);
  }

  let parenDepth = 0;
  let signatureEnded = false;
  let braceStart = -1;
  for (let i = start; i < source.length; i += 1) {
    const ch = source[i];
    if (ch === '(') {
      parenDepth += 1;
    } else if (ch === ')') {
      parenDepth -= 1;
      if (parenDepth === 0) {
        signatureEnded = true;
      }
    } else if (ch === '{' && signatureEnded) {
      braceStart = i;
      break;
    }
  }

  let depth = 0;
  let end = braceStart;
  for (; end < source.length; end += 1) {
    const ch = source[end];
    if (ch === '{') depth += 1;
    if (ch === '}') {
      depth -= 1;
      if (depth === 0) {
        end += 1;
        break;
      }
    }
  }

  return source.slice(start, end);
}

const NODE_COMPAT_HELPERS = `
const workflowEngine = null;
const STEP_NODE_IDS = {
  1: 'open-chatgpt',
  2: 'submit-signup-email',
  3: 'fill-password',
  4: 'fetch-signup-code',
  5: 'fill-profile',
  6: 'wait-registration-success',
  7: 'oauth-login',
  8: 'fetch-login-code',
  9: 'confirm-oauth',
  10: 'platform-verify',
};
const NODE_STEP_IDS = Object.fromEntries(Object.entries(STEP_NODE_IDS).map(([step, nodeId]) => [nodeId, Number(step)]));
function getNodeIdsForState() {
  return Object.values(STEP_NODE_IDS);
}
function getNodeIdByStepForState(step) {
  return STEP_NODE_IDS[Number(step)] || '';
}
function getStepIdByNodeIdForState(nodeId) {
  return NODE_STEP_IDS[String(nodeId || '').trim()] || null;
}
function projectStepStatusesToNodeStatuses(stepStatuses = {}) {
  const nodeStatuses = {};
  for (const [step, status] of Object.entries(stepStatuses || {})) {
    const nodeId = getNodeIdByStepForState(step);
    if (nodeId) nodeStatuses[nodeId] = status;
  }
  return nodeStatuses;
}
function normalizeStatusMapForNodes(statuses = {}, state = {}) {
  return {
    ...DEFAULT_STATE.nodeStatuses,
    ...projectStepStatusesToNodeStatuses(state?.stepStatuses || {}),
    ...(state?.nodeStatuses || {}),
    ...(statuses || {}),
  };
}
DEFAULT_STATE.nodeStatuses = projectStepStatusesToNodeStatuses(DEFAULT_STATE.stepStatuses || {});
`;

test('generic stopped record resolves to next unfinished step during execution gap', async () => {
  const bundle = [
    NODE_COMPAT_HELPERS,
    extractFunction('isStepDoneStatus'),
    extractFunction('getRunningNodeIds'),
    extractFunction('getRunningSteps'),
    extractFunction('inferStoppedRecordNode'),
    extractFunction('inferStoppedRecordStep'),
    extractFunction('resolveAccountRunRecordStatusForStop'),
    extractFunction('extractStoppedNodeFromRecordStatus'),
    extractFunction('extractStoppedStepFromRecordStatus'),
    extractFunction('resolveAccountRunRecordReasonForStop'),
    extractFunction('appendAndBroadcastAccountRunRecord'),
  ].join('\n');

const api = new Function(`
const STEP_IDS = [1, 2, 3, 4, 5, 6, 7, 8, 9, 10];
const STOP_ERROR_MESSAGE = '流程已被用户停止。';
const DEFAULT_STATE = {
  stepStatuses: Object.fromEntries(STEP_IDS.map((step) => [step, 'pending'])),
};
let captured = null;
const accountRunHistoryHelpers = {
  appendAccountRunRecord: async (status, state, reason) => {
    captured = { status, state, reason };
    return { status, state, reason };
  },
};
async function broadcastAccountRunHistoryUpdate() {}
async function getState() {
  return {};
}
${bundle}
return {
  inferStoppedRecordStep,
  resolveAccountRunRecordStatusForStop,
  resolveAccountRunRecordReasonForStop,
  appendAndBroadcastAccountRunRecord,
  getCaptured() {
    return captured;
  },
};
`)();

  const state = {
    email: 'user@example.com',
    password: 'secret',
    stepStatuses: {
      1: 'completed',
      2: 'completed',
      3: 'completed',
      4: 'completed',
      5: 'completed',
      6: 'completed',
      7: 'pending',
      8: 'pending',
      9: 'pending',
      10: 'pending',
    },
  };
  assert.equal(api.inferStoppedRecordStep(state), 7);
  assert.equal(api.resolveAccountRunRecordStatusForStop('stopped', state), 'node:oauth-login:stopped');
  assert.equal(api.resolveAccountRunRecordReasonForStop('node:oauth-login:stopped', '流程已被用户停止。'), '节点 oauth-login 已被用户停止。');
  assert.equal(
    api.resolveAccountRunRecordReasonForStop('step2_stopped', '步骤 2 已使用邮箱，流程尚未完成。'),
    '步骤 2 已停止：邮箱已设置，流程尚未完成。'
  );

  await api.appendAndBroadcastAccountRunRecord('stopped', state, '流程已被用户停止。');
  assert.deepStrictEqual(api.getCaptured(), {
    status: 'node:oauth-login:stopped',
    state,
    reason: '节点 oauth-login 已被用户停止。',
  });
});

test('requestStop appends a stopped record for the next unfinished step when no step is running', async () => {
  const bundle = [
    NODE_COMPAT_HELPERS,
    extractFunction('normalizeAutoRunSessionId'),
    extractFunction('clearCurrentAutoRunSessionId'),
    extractFunction('cleanupStep8NavigationListeners'),
    extractFunction('rejectPendingStep8'),
    extractFunction('isStepDoneStatus'),
    extractFunction('getRunningNodeIds'),
    extractFunction('getRunningSteps'),
    extractFunction('inferStoppedRecordNode'),
    extractFunction('inferStoppedRecordStep'),
    extractFunction('requestStop'),
  ].join('\n');

  const api = new Function(`
let stopRequested = false;
let autoRunActive = false;
let autoRunCurrentRun = 0;
let autoRunTotalRuns = 1;
let autoRunAttemptRun = 0;
let autoRunSessionId = 99;
let webNavListener = null;
let webNavCommittedListener = null;
let step8TabUpdatedListener = null;
let step8PendingReject = null;
let resumeWaiter = null;
const STOP_ERROR_MESSAGE = '流程已被用户停止。';
const DEFAULT_STATE = {
  stepStatuses: Object.fromEntries([1, 2, 3, 4, 5, 6, 7, 8, 9, 10].map((step) => [step, 'pending'])),
};
const nodeWaiters = new Map();
const stepWaiters = new Map();
const appended = [];
const logs = [];
const chrome = {
  webNavigation: {
    onBeforeNavigate: { removeListener() {} },
    onCommitted: { removeListener() {} },
  },
  tabs: {
    onUpdated: { removeListener() {} },
  },
};

function cancelPendingCommands() {}
function abortActiveIcloudRequests() {}
function getPendingAutoRunTimerPlan() {
  return null;
}
async function clearAutoRunTimerAlarm() {}
function clearStopRequest() {
  stopRequested = false;
}
async function addLog(message, level) {
  logs.push({ message, level });
}
async function broadcastStopToContentScripts() {}
async function markRunningStepsStopped() {}
async function markRunningNodesStopped() {}
async function broadcastAutoRunStatus() {}
async function appendAndBroadcastAccountRunRecord(status, state, reason) {
  appended.push({ status, state, reason });
  return { status, state, reason };
}
async function getState() {
  return {
    email: 'user@example.com',
    password: 'secret',
    stepStatuses: {
      1: 'completed',
      2: 'completed',
      3: 'completed',
      4: 'completed',
      5: 'completed',
      6: 'completed',
      7: 'pending',
      8: 'pending',
      9: 'pending',
      10: 'pending',
    },
  };
}

${bundle}

return {
  requestStop,
  snapshot() {
    return { appended, logs, stopRequested, autoRunSessionId };
  },
};
`)();

  await api.requestStop();
  const state = api.snapshot();

  assert.deepStrictEqual(state.appended, [{
    status: 'stopped',
    state: {
      email: 'user@example.com',
      password: 'secret',
      stepStatuses: {
        1: 'completed',
        2: 'completed',
        3: 'completed',
        4: 'completed',
        5: 'completed',
        6: 'completed',
        7: 'pending',
        8: 'pending',
        9: 'pending',
        10: 'pending',
      },
    },
    reason: '流程已被用户停止。',
  }]);
  assert.equal(state.autoRunSessionId, 0);
  assert.equal(state.stopRequested, true);
});
