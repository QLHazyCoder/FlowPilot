const assert = require('assert');
const fs = require('fs');

const helperSource = fs.readFileSync('background.js', 'utf8');
const step8ModuleSource = fs.readFileSync('flows/openai/background/steps/confirm-oauth.js', 'utf8');

function extractFunction(source, name) {
  const markers = [`async function ${name}(`, `function ${name}(`];
  const start = markers
    .map(marker => source.indexOf(marker))
    .find(index => index >= 0);
  if (start < 0) {
    throw new Error(`missing function ${name}`);
  }

  let parenDepth = 0;
  let signatureEnded = false;
  let braceStart = -1;
  for (let i = start; i < source.length; i++) {
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
  if (braceStart < 0) {
    throw new Error(`missing body for function ${name}`);
  }

  let depth = 0;
  let end = braceStart;
  for (; end < source.length; end++) {
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

const helperBundle = [
  extractFunction(helperSource, 'normalizeAutoRunSessionId'),
  extractFunction(helperSource, 'clearCurrentAutoRunSessionId'),
  extractFunction(helperSource, 'throwIfStopped'),
  extractFunction(helperSource, 'cleanupStep8NavigationListeners'),
  extractFunction(helperSource, 'rejectPendingStep8'),
  extractFunction(helperSource, 'throwIfStep8SettledOrStopped'),
  extractFunction(helperSource, 'getRunningSteps'),
  extractFunction(helperSource, 'inferStoppedRecordStep'),
  extractFunction(helperSource, 'requestStop'),
].join('\n');

const api = new Function('step8ModuleSource', `
const self = {};
let stopRequested = false;
const STOP_ERROR_MESSAGE = '流程已被用户停止。';
let webNavListener = null;
let webNavCommittedListener = null;
let step8TabUpdatedListener = null;
let step8PendingReject = null;
let autoRunActive = true;
let autoRunCurrentRun = 2;
let autoRunTotalRuns = 3;
let autoRunAttemptRun = 4;
let autoRunSessionId = 99;
const DEFAULT_STATE = {
  nodeStatuses: {},
};
const STEP8_CLICK_RETRY_DELAY_MS = 500;
const STEP8_MAX_ROUNDS = 5;
const STEP8_READY_WAIT_TIMEOUT_MS = 30000;
const STEP8_STRATEGIES = [
  { mode: 'content', strategy: 'requestSubmit', label: 'form.requestSubmit' },
  { mode: 'debugger', label: 'debugger click' },
];

const added = {
  beforeNavigate: 0,
  committed: 0,
  tabUpdated: 0,
};
const removed = {
  beforeNavigate: 0,
  committed: 0,
  tabUpdated: 0,
};
const sentMessages = [];
let clickCount = 0;
let resolveTabId = null;

const chrome = {
  webNavigation: {
    onBeforeNavigate: {
      addListener() {
        added.beforeNavigate += 1;
      },
      removeListener() {
        removed.beforeNavigate += 1;
      },
    },
    onCommitted: {
      addListener() {
        added.committed += 1;
      },
      removeListener() {
        removed.committed += 1;
      },
    },
  },
  tabs: {
    onUpdated: {
      addListener() {
        added.tabUpdated += 1;
      },
      removeListener() {
        removed.tabUpdated += 1;
      },
    },
    async update() {},
  },
};

const nodeWaiters = new Map();
const stepWaiters = new Map();
let resumeWaiter = null;

function cancelPendingCommands() {}
function abortActiveIcloudRequests() {}
async function addLog() {}
async function broadcastStopToContentScripts() {}
function getRunningNodeIds() {
  return [];
}
function inferStoppedRecordNode() {
  return '';
}
async function markRunningNodesStopped() {}
async function markRunningStepsStopped() {}
async function broadcastAutoRunStatus() {}
async function appendAndBroadcastAccountRunRecord() {}
async function getState() {
  return { autoRunning: false };
}
function getPendingAutoRunTimerPlan() {
  return null;
}
function getStep8CallbackUrlFromNavigation() { return ''; }
function getStep8CallbackUrlFromTabUpdate() { return ''; }
function getStep8EffectLabel() { return 'no_effect'; }
async function completeNodeFromBackground() {}
async function getTabId() {
  return await new Promise((resolve) => {
    resolveTabId = resolve;
  });
}
async function reuseOrCreateTab() {
  return 999;
}
async function isTabAlive() {
  return true;
}
async function ensureStep8SignupPageReady() {}
async function prepareStep8DebuggerClick() {
  sentMessages.push({ source: 'openai-auth', type: 'STEP8_FIND_AND_CLICK' });
  return { rect: { centerX: 10, centerY: 20 } };
}
async function triggerStep8ContentStrategy() {
  sentMessages.push({ source: 'openai-auth', type: 'STEP8_TRIGGER_CONTINUE' });
}
async function waitForStep8ClickEffect() {
  return { progressed: false, reason: 'no_effect' };
}
async function waitForStep8Ready() {
  return { consentReady: true, url: 'https://example.com/consent' };
}
async function reloadStep8ConsentPage() {}
async function sleepWithStop() {}
async function clickWithDebugger() {
  clickCount += 1;
}

function setWebNavListener(listener) {
  webNavListener = listener;
}
function getWebNavListener() {
  return webNavListener;
}
function setWebNavCommittedListener(listener) {
  webNavCommittedListener = listener;
}
function getWebNavCommittedListener() {
  return webNavCommittedListener;
}
function setStep8TabUpdatedListener(listener) {
  step8TabUpdatedListener = listener;
}
function getStep8TabUpdatedListener() {
  return step8TabUpdatedListener;
}
function setStep8PendingReject(handler) {
  step8PendingReject = handler;
}

${helperBundle}
${step8ModuleSource}

const executor = self.MultiPageBackgroundStep9.createStep9Executor({
  addLog,
  chrome,
  cleanupStep8NavigationListeners,
  clickWithDebugger,
  completeNodeFromBackground,
  ensureStep8SignupPageReady,
  getStep8CallbackUrlFromNavigation,
  getStep8CallbackUrlFromTabUpdate,
  getStep8EffectLabel,
  getTabId,
  getWebNavCommittedListener,
  getWebNavListener,
  getStep8TabUpdatedListener,
  isTabAlive,
  prepareStep8DebuggerClick,
  reloadStep8ConsentPage,
  reuseOrCreateTab,
  setStep8PendingReject,
  setStep8TabUpdatedListener,
  setWebNavCommittedListener,
  setWebNavListener,
  sleepWithStop,
  STEP8_CLICK_RETRY_DELAY_MS,
  STEP8_MAX_ROUNDS,
  STEP8_READY_WAIT_TIMEOUT_MS,
  STEP8_STRATEGIES,
  throwIfStep8SettledOrStopped,
  triggerStep8ContentStrategy,
  waitForStep8ClickEffect,
  waitForStep8Ready,
});

return {
  executeStep9: executor.executeStep9,
  requestStop,
  resolveTabId(tabId) {
    if (!resolveTabId) {
      throw new Error('resolveTabId is not ready');
    }
    resolveTabId(tabId);
  },
  snapshot() {
    return {
      stopRequested,
      webNavListener,
      webNavCommittedListener,
      step8TabUpdatedListener,
      step8PendingReject,
      added,
      removed,
      sentMessages,
      clickCount,
      autoRunActive,
      autoRunSessionId,
    };
  },
};
`)(step8ModuleSource);

(async () => {
  const step8Promise = api.executeStep9({ oauthUrl: 'https://example.com/oauth' });
  const settledStep8Promise = step8Promise.catch((err) => err);

  await new Promise((resolve) => setImmediate(resolve));
  await api.requestStop();
  await new Promise((resolve) => setImmediate(resolve));
  api.resolveTabId(123);
  await new Promise((resolve) => setImmediate(resolve));
  await new Promise((resolve) => setImmediate(resolve));

  const error = await settledStep8Promise;
  const state = api.snapshot();

  assert.strictEqual(error?.message, '流程已被用户停止。', 'Stop 后 Step 8 promise 应被拒绝为停止错误');
  assert.deepStrictEqual(
    state.added,
    { beforeNavigate: 0, committed: 0, tabUpdated: 0 },
    'Stop 先发生时，不应再注册 Step 8 监听'
  );
  assert.strictEqual(state.sentMessages.length, 0, 'Stop 后不应再发送 Step 8 执行动作');
  assert.strictEqual(state.clickCount, 0, 'Stop 后不应再触发 debugger 点击');
  assert.strictEqual(state.webNavListener, null, 'Stop 后 onBeforeNavigate 引用应为空');
  assert.strictEqual(state.webNavCommittedListener, null, 'Stop 后 onCommitted 引用应为空');
  assert.strictEqual(state.step8TabUpdatedListener, null, 'Stop 后 tabs.onUpdated 引用应为空');
  assert.strictEqual(state.step8PendingReject, null, 'Stop 后不应保留 Step 8 挂起 reject');
  assert.strictEqual(state.autoRunSessionId, 0, 'Stop 后自动运行 session 应失效');

  console.log('step8 stop cleanup tests passed');
})().catch((error) => {
  console.error(error);
  process.exit(1);
});
