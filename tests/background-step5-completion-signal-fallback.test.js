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
