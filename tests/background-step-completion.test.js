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

function createApi(events, lastNodeId = 'platform-verify', initialState = {}) {
  return new Function('events', 'lastNodeId', 'initialState', `
let stopRequested = false;
const LOG_PREFIX = '[test]';
let currentState = { nodeStatuses: {}, accountContributionEnabled: true, ...initialState };
const STOP_ERROR_MESSAGE = '流程已被用户停止。';
function getErrorMessage(error) {
  return error?.message || String(error || '');
}
async function getState() {
  events.push({ type: 'getState' });
  return currentState;
}
function getLastNodeIdForState() {
  return lastNodeId;
}
async function setNodeStatus(nodeId, status) {
  events.push({ type: 'status', nodeId, status });
}
async function setState(updates) {
  currentState = { ...currentState, ...updates };
  events.push({ type: 'setState', updates });
}
function broadcastDataUpdate(updates) {
  events.push({ type: 'broadcast', updates });
}
async function addLog(message, level, options = {}) {
  events.push({ type: 'log', message, level, options });
}
async function appendManualAccountRunRecordIfNeeded() {
  events.push({ type: 'manual-record' });
}
function notifyNodeError(nodeId, error) {
  events.push({ type: 'error', nodeId, error });
}
function notifyNodeComplete(nodeId, payload) {
  events.push({ type: 'notify', nodeId, payload });
}
async function handleNodeData(nodeId, payload) {
  events.push({ type: 'handle-start', nodeId, payload });
  await new Promise((resolve) => setTimeout(resolve, 25));
  events.push({ type: 'handle-done', nodeId });
}
async function appendAndBroadcastAccountRunRecord(status, state) {
  events.push({ type: 'record', status, state });
}
${extractFunction('getSignupPhoneIdentityValue')}
${extractFunction('signupPhoneIdentityValuesMatch')}
${extractFunction('clearSignupPhoneIdentityAfterSuccessfulFlow')}
${extractFunction('runCompletedNodeSideEffects')}
${extractFunction('reportCompletedNodeSideEffectError')}
${extractFunction('completeNodeFromBackground')}
return { completeNodeFromBackground, getCurrentState: () => currentState };
`)(events, lastNodeId, initialState);
}

test('completeNodeFromBackground releases final node before slow post-completion side effects', async () => {
  const events = [];
  const api = createApi(events, 'platform-verify');

  await api.completeNodeFromBackground('platform-verify', { localhostUrl: 'http://localhost:1455/auth/callback?code=ok' });

  const types = events.map((event) => event.type);
  assert.equal(types.indexOf('notify') < types.indexOf('handle-start'), true);
  assert.equal(types.includes('handle-done'), false);
  assert.equal(types.includes('record'), false);

  await new Promise((resolve) => setTimeout(resolve, 40));

  const settledTypes = events.map((event) => event.type);
  assert.equal(settledTypes.includes('handle-done'), true);
  assert.equal(settledTypes.includes('record'), true);
});

test('completeNodeFromBackground keeps non-final node data handling before completion signal', async () => {
  const events = [];
  const api = createApi(events, 'platform-verify');

  await api.completeNodeFromBackground('confirm-oauth', { localhostUrl: 'http://localhost:1455/auth/callback?code=ok' });

  const types = events.map((event) => event.type);
  assert.equal(types.indexOf('handle-done') < types.indexOf('notify'), true);
  assert.equal(types.includes('record'), false);
});

test('completeNodeFromBackground clears signup phone identity before releasing final node', async () => {
  const events = [];
  const api = createApi(events, 'platform-verify', {
    accountIdentifierType: 'phone',
    accountIdentifier: '+56979206303',
    signupPhoneNumber: '+56979206303',
    signupPhoneActivation: { activationId: 'active', phoneNumber: '+56979206303' },
    signupPhoneCompletedActivation: { activationId: 'done', phoneNumber: '+56979206303' },
    signupPhoneVerificationRequestedAt: 123,
    signupPhoneVerificationPurpose: 'login',
  });

  await api.completeNodeFromBackground('platform-verify', { localhostUrl: 'http://localhost:1455/auth/callback?code=ok' });

  const types = events.map((event) => event.type);
  assert.equal(types.indexOf('setState') < types.indexOf('notify'), true);
  assert.equal(types.indexOf('broadcast') < types.indexOf('notify'), true);
  assert.equal(api.getCurrentState().signupPhoneNumber, '');
  assert.equal(api.getCurrentState().signupPhoneActivation, null);
  assert.equal(api.getCurrentState().signupPhoneCompletedActivation, null);
  assert.equal(api.getCurrentState().accountIdentifierType, null);
  assert.equal(api.getCurrentState().accountIdentifier, '');
});
