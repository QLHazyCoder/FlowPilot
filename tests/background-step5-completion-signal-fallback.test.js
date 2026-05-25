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

  if (braceStart < 0) {
    throw new Error(`missing body for function ${name}`);
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

test('executeNodeViaCompletionSignal lets fill-profile succeed through background recovery after retryable transport error', async () => {
  const api = new Function(`
const events = [];
const LOG_PREFIX = '[test]';
const nodeWaiters = new Map();

function getErrorMessage(error) {
  return error?.message || String(error || '');
}

async function getState() {
  return {};
}

async function setState(updates) {
  events.push({ type: 'setState', updates });
}

function createNodeCompletionToken(nodeId) {
  return String(nodeId || 'node').trim() + ':token';
}

function assertNodeExecutionAllowedForState() {}

function getNodeCompletionSignalTimeoutMs() {
  return 12345;
}

function waitForNodeComplete(nodeId) {
  nodeWaiters.set(nodeId, {});
  return new Promise((_, reject) => {
    setTimeout(() => reject(new Error('节点 fill-profile 等待超时（>12 秒）')), 5);
  });
}

async function executeNode(nodeId, options) {
  events.push({ type: 'executeNode', nodeId, options });
  throw new Error('The page keeping the extension port is moved into back/forward cache, so the message channel is closed.');
}

function isStopError() {
  return false;
}

function isRetryableContentScriptTransportError(error) {
  return /back\\/forward cache|message channel is closed/i.test(String(error?.message || error || ''));
}

function notifyNodeError(nodeId, error) {
  events.push({ type: 'notifyNodeError', nodeId, error });
}

async function recoverFillProfileCompletionFromBackground(error, completionToken) {
  events.push({ type: 'backgroundRecovery', error: getErrorMessage(error), completionToken });
  return {
    nodeId: 'fill-profile',
    completionToken,
    outcome: 'background_transport_recovered',
    successState: 'logged_in_home',
    url: 'https://chatgpt.com/',
    recoveredByBackground: true,
  };
}

async function finalizeDeferredNodeExecutionError(nodeId, error) {
  events.push({ type: 'finalizeDeferredNodeExecutionError', nodeId, error: getErrorMessage(error) });
}

${extractFunction('executeNodeViaCompletionSignal')}

return {
  run() {
    return executeNodeViaCompletionSignal('fill-profile');
  },
  snapshot() {
    return events;
  },
};
`)();

  const result = await api.run();
  const events = api.snapshot();

  assert.equal(result.recoveredByBackground, true);
  assert.equal(result.url, 'https://chatgpt.com/');
  assert.equal(events.some((entry) => entry.type === 'backgroundRecovery'), true);
  assert.equal(events.find((entry) => entry.type === 'executeNode').options.completionToken, 'fill-profile:token');
  assert.equal(events.find((entry) => entry.type === 'backgroundRecovery').completionToken, 'fill-profile:token');
  assert.equal(events.some((entry) => entry.type === 'notifyNodeError'), false);
  assert.equal(events.some((entry) => entry.type === 'finalizeDeferredNodeExecutionError'), false);
});

test('notifyNodeComplete ignores stale fill-profile completion token from previous auto-run round', async () => {
  const api = new Function(`
const events = [];
const LOG_PREFIX = '[test]';
const nodeWaiters = new Map();

${extractFunction('notifyNodeComplete')}

return {
  run() {
    const resolved = [];
    nodeWaiters.set('fill-profile', {
      completionToken: 'round-2-token',
      resolve(payload) {
        resolved.push(payload);
      },
    });
    notifyNodeComplete('fill-profile', { completionToken: 'round-1-token', url: 'https://old.example/' });
    notifyNodeComplete('fill-profile', { completionToken: 'round-2-token', url: 'https://chatgpt.com/' });
    return resolved;
  },
};
`)();

  const resolved = api.run();

  assert.deepStrictEqual(resolved, [
    { completionToken: 'round-2-token', url: 'https://chatgpt.com/' },
  ]);
});

test('executeNodeViaCompletionSignal keeps non-fill-profile retryable transport errors on original path', async () => {
  const api = new Function(`
const events = [];
const LOG_PREFIX = '[test]';

function getErrorMessage(error) {
  return error?.message || String(error || '');
}

async function getState() {
  return {};
}

async function setState(updates) {
  events.push({ type: 'setState', updates });
}

function createNodeCompletionToken(nodeId) {
  return String(nodeId || 'node').trim() + ':token';
}

function assertNodeExecutionAllowedForState() {}

function getNodeCompletionSignalTimeoutMs() {
  return 12345;
}

const nodeWaiters = new Map();

function waitForNodeComplete(nodeId) {
  nodeWaiters.set(nodeId, {});
  return new Promise((_, reject) => {
    setTimeout(() => reject(new Error('节点 oauth-login 等待超时（>12 秒）')), 5);
  });
}

async function executeNode(nodeId, options) {
  events.push({ type: 'executeNode', nodeId, options });
  throw new Error('The page keeping the extension port is moved into back/forward cache, so the message channel is closed.');
}

function isStopError() {
  return false;
}

function isRetryableContentScriptTransportError(error) {
  return /back\\/forward cache|message channel is closed/i.test(String(error?.message || error || ''));
}

function notifyNodeError(nodeId, error) {
  events.push({ type: 'notifyNodeError', nodeId, error });
}

async function recoverFillProfileCompletionFromBackground(error) {
  events.push({ type: 'backgroundRecovery', error: getErrorMessage(error) });
  return {};
}

async function finalizeDeferredNodeExecutionError(nodeId, error) {
  events.push({ type: 'finalizeDeferredNodeExecutionError', nodeId, error: getErrorMessage(error) });
}

${extractFunction('executeNodeViaCompletionSignal')}

return {
  run() {
    return executeNodeViaCompletionSignal('oauth-login');
  },
  snapshot() {
    return events;
  },
};
`)();

  await assert.rejects(
    api.run(),
    /message channel is closed/
  );
  const events = api.snapshot();
  assert.equal(events.some((entry) => entry.type === 'backgroundRecovery'), false);
  assert.equal(events.some((entry) => entry.type === 'finalizeDeferredNodeExecutionError'), true);
});

test('step 5 background recovery clears prompts and converts retryable transport error into success', async () => {
  const api = new Function(`
const logs = [];
const completions = [];
const waitCalls = [];
const messages = [];
let promptAdvanceCount = 0;

function getErrorMessage(error) {
  return error?.message || String(error || '');
}

async function addLog(message, level, meta) {
  logs.push({ message, level, meta });
}

async function getTabId(source) {
  return source === 'openai-auth' ? 99 : null;
}

async function waitForTabStableComplete(tabId, options) {
  waitCalls.push({ tabId, options });
}

function notifyNodeComplete(nodeId, payload) {
  completions.push({ nodeId, payload });
}

const chrome = {
  tabs: {
    async get() {
      return { url: 'https://chatgpt.com/' };
    },
  },
};

async function sendToContentScriptResilient(source, message) {
  messages.push({ source, type: message.type });
  if (message.type === 'ADVANCE_STEP5_POST_SUBMIT_PROMPT') {
    promptAdvanceCount += 1;
    return {
      advanced: promptAdvanceCount <= 2,
      reason: promptAdvanceCount > 2 ? 'prompt_not_detected' : '',
      state: { url: 'https://chatgpt.com/' },
    };
  }
  if (message.type === 'GET_STEP5_SUBMIT_STATE') {
    return {
      retryPage: false,
      retryEnabled: false,
      maxCheckAttemptsBlocked: false,
      userAlreadyExistsBlocked: false,
      successState: 'logged_in_home',
      profileVisible: false,
      errorText: '',
      unknownAuthPage: false,
      url: 'https://chatgpt.com/',
    };
  }
  throw new Error('unexpected message type: ' + message.type);
}

${extractFunction('parseUrlSafely')}
${extractFunction('isSignupEntryHost')}
${extractFunction('isLikelyLoggedInChatgptHomeUrl')}
${extractFunction('isStep5CompletionChatgptUrl')}
${extractFunction('advanceStep5PostSubmitPromptOnTab')}
${extractFunction('getStep5SubmitStateFromContent')}
${extractFunction('recoverStep5SubmitRetryPageOnTab')}
${extractFunction('validateStep5PostCompletion')}
${extractFunction('recoverFillProfileCompletionFromBackground')}

return {
  async run() {
    return recoverFillProfileCompletionFromBackground(
      new Error('The page keeping the extension port is moved into back/forward cache, so the message channel is closed.')
    );
  },
  snapshot() {
    return { logs, completions, waitCalls, messages, promptAdvanceCount };
  },
};
`)();

  const result = await api.run();
  const snapshot = api.snapshot();

  assert.equal(result.successState, 'logged_in_home');
  assert.equal(result.recoveredByBackground, true);
  assert.equal(result.step5PostCompletionValidated, true);
  assert.equal(result.url, 'https://chatgpt.com/');
  assert.equal(result.requireContentStateBeforeUrlSuccess, true);
  assert.equal(result.postSubmitPromptActionsCompleted, true);
  assert.equal(result.postSubmitPromptActionCount, 2);
  assert.equal(snapshot.promptAdvanceCount, 3);
  assert.equal(snapshot.waitCalls.length, 3);
  assert.deepStrictEqual(snapshot.completions, [
    {
      nodeId: 'fill-profile',
      payload: result,
    },
  ]);
  assert.deepStrictEqual(
    snapshot.messages.map(({ type }) => type),
    [
      'ADVANCE_STEP5_POST_SUBMIT_PROMPT',
      'ADVANCE_STEP5_POST_SUBMIT_PROMPT',
      'ADVANCE_STEP5_POST_SUBMIT_PROMPT',
    ]
  );
  assert.equal(
    snapshot.logs.some(({ message }) => /页面通信中断，正在通过后台复核最终状态/.test(message)),
    true
  );
});

test('executeNodeAndWait skips duplicate step 5 validation after background recovery already validated completion', async () => {
  const api = new Function(`
const events = [];

function throwIfStopped() {}

async function getState() {
  return {
    autoStepDelaySeconds: 0,
    nodeStatuses: {
      'fill-profile': 'running',
      'wait-registration-success': 'pending',
    },
  };
}

function assertNodeExecutionAllowedForState() {}
function normalizeAutoStepDelaySeconds() { return 0; }
async function addLog(message, level, meta) { events.push({ type: 'log', message, level, meta }); }
async function sleepWithStop() {}
function getStepIdByNodeIdForState(nodeId) { return nodeId === 'fill-profile' ? 5 : 0; }
function getAutoRunPreExecutionDelayMsForNode() { return 0; }
function doesNodeUseBackgroundCompletion() { return false; }
function doesNodeUseCompletionSignal(nodeId) { return nodeId === 'fill-profile'; }
function getNodeCompletionSignalTimeoutMs() { return 150000; }
async function executeNode() { throw new Error('executeNode should not be called directly'); }
async function executeNodeViaCompletionSignal(nodeId, timeoutMs) {
  events.push({ type: 'completionSignal', nodeId, timeoutMs });
  return {
    nodeId,
    outcome: 'background_transport_recovered',
    successState: 'logged_in_home',
    url: 'https://chatgpt.com/',
    recoveredByBackground: true,
    step5PostCompletionValidated: true,
  };
}
async function getTabId(source) { return source === 'openai-auth' ? 99 : null; }
async function waitForTabStableComplete() { events.push({ type: 'waitForTabStableComplete' }); }
async function validateStep5PostCompletion() { throw new Error('duplicate validation should be skipped'); }
async function setNodeStatus(nodeId, status) { events.push({ type: 'status', nodeId, status }); }
function getErrorMessage(error) { return error?.message || String(error || ''); }

${extractFunction('executeNodeAndWait')}

return {
  async run() {
    await executeNodeAndWait('fill-profile', 0);
  },
  snapshot() {
    return events;
  },
};
`)();

  await api.run();
  const events = api.snapshot();

  assert.equal(events.some((entry) => entry.type === 'waitForTabStableComplete'), false);
  assert.equal(
    events.some((entry) => entry.type === 'log' && /后台恢复已完成最终复核，直接进入后续节点/.test(entry.message)),
    true
  );
  assert.equal(
    events.some((entry) => entry.type === 'status' && entry.nodeId === 'fill-profile' && entry.status === 'completed'),
    true
  );
});

test('step 5 background recovery still fails when page remains on profile after retryable transport error', async () => {
  const api = new Function(`
const logs = [];

function getErrorMessage(error) {
  return error?.message || String(error || '');
}

async function addLog(message, level, meta) {
  logs.push({ message, level, meta });
}

async function getTabId(source) {
  return source === 'openai-auth' ? 99 : null;
}

async function waitForTabStableComplete() {}

function notifyNodeComplete() {
  throw new Error('should not notify completion');
}

const chrome = {
  tabs: {
    async get() {
      return { url: 'https://auth.openai.com/about-you' };
    },
  },
};

async function sendToContentScriptResilient(source, message) {
  if (message.type === 'ADVANCE_STEP5_POST_SUBMIT_PROMPT') {
    return { advanced: false };
  }
  if (message.type === 'GET_STEP5_SUBMIT_STATE') {
    return {
      retryPage: false,
      retryEnabled: false,
      maxCheckAttemptsBlocked: false,
      userAlreadyExistsBlocked: false,
      successState: '',
      profileVisible: true,
      errorText: '',
      unknownAuthPage: false,
      url: 'https://auth.openai.com/about-you',
    };
  }
  throw new Error('unexpected message type: ' + message.type);
}

${extractFunction('parseUrlSafely')}
${extractFunction('isSignupEntryHost')}
${extractFunction('isLikelyLoggedInChatgptHomeUrl')}
${extractFunction('isStep5CompletionChatgptUrl')}
${extractFunction('advanceStep5PostSubmitPromptOnTab')}
${extractFunction('getStep5SubmitStateFromContent')}
${extractFunction('recoverStep5SubmitRetryPageOnTab')}
${extractFunction('validateStep5PostCompletion')}
${extractFunction('recoverFillProfileCompletionFromBackground')}

return {
  run() {
    return recoverFillProfileCompletionFromBackground(
      new Error('The page keeping the extension port is moved into back/forward cache, so the message channel is closed.')
    );
  },
  snapshot() {
    return { logs };
  },
};
`)();

  await assert.rejects(
    api.run(),
    /资料提交完成信号已收到，但页面仍停留在资料页/
  );
  assert.equal(
    api.snapshot().logs.some(({ message }) => /页面通信中断，正在通过后台复核最终状态/.test(message)),
    true
  );
});
