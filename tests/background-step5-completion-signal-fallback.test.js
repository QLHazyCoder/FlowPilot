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

function getErrorMessage(error) {
  return error?.message || String(error || '');
}

async function getState() {
  return {};
}

function assertNodeExecutionAllowedForState() {}

function getNodeCompletionSignalTimeoutMs() {
  return 12345;
}

function waitForNodeComplete() {
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

async function recoverFillProfileCompletionFromBackground(error) {
  events.push({ type: 'backgroundRecovery', error: getErrorMessage(error) });
  return {
    nodeId: 'fill-profile',
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
  assert.equal(events.some((entry) => entry.type === 'notifyNodeError'), false);
  assert.equal(events.some((entry) => entry.type === 'finalizeDeferredNodeExecutionError'), false);
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

function assertNodeExecutionAllowedForState() {}

function getNodeCompletionSignalTimeoutMs() {
  return 12345;
}

function waitForNodeComplete() {
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
    return { advanced: promptAdvanceCount <= 2, state: { url: 'https://chatgpt.com/' } };
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
  assert.equal(result.url, 'https://chatgpt.com/');
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
