const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');

const source = fs.readFileSync('background.js', 'utf8');

const NODE_IDS = [
  'open-chatgpt',
  'submit-signup-email',
  'fill-password',
  'fetch-signup-code',
  'fill-profile',
  'wait-registration-success',
  'oauth-login',
  'fetch-login-code',
  'confirm-oauth',
  'platform-verify',
];
const NODE_STEPS = Object.fromEntries(NODE_IDS.map((nodeId, index) => [nodeId, index + 1]));

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

function createApi() {
  const bundle = [
    'isPlainObjectValue',
    'normalizeStepExecutionRangeFlowId',
    'hasStepExecutionRangeShape',
    'normalizePositiveStepNumber',
    'normalizeStepExecutionRangeEntry',
    'normalizeStepExecutionRangeByFlow',
    'getStepExecutionRangeForState',
    'isStepAllowedByExecutionRangeForState',
    'isNodeExecutionAllowedForState',
    'getExecutionAllowedNodeIdsForState',
    'assertNodeExecutionAllowedForState',
    'isStepDoneStatus',
    'normalizeStatusMapForNodes',
    'getFirstUnfinishedNodeId',
    'hasSavedNodeProgress',
  ].map(extractFunction).join('\n');

  return new Function(`
const DEFAULT_ACTIVE_FLOW_ID = 'openai';
const DEFAULT_STATE = { nodeStatuses: ${JSON.stringify(Object.fromEntries(NODE_IDS.map((nodeId) => [nodeId, 'pending'])))} };
function getNodeIdsForState() {
  return ${JSON.stringify(NODE_IDS)};
}
function getStepIdByNodeIdForState(nodeId) {
  return ${JSON.stringify(NODE_STEPS)}[String(nodeId || '').trim()] || 0;
}
function getNodeIdByStepForState(step) {
  return ${JSON.stringify(Object.fromEntries(Object.entries(NODE_STEPS).map(([nodeId, step]) => [step, nodeId])))}[Number(step)] || '';
}
${bundle}
return {
  normalizeStepExecutionRangeByFlow,
  getStepExecutionRangeForState,
  isNodeExecutionAllowedForState,
  getExecutionAllowedNodeIdsForState,
  assertNodeExecutionAllowedForState,
  getFirstUnfinishedNodeId,
  hasSavedNodeProgress,
};
`)();
}

test('step execution range normalizes codex flow config to the active OpenAI flow', () => {
  const api = createApi();
  assert.deepStrictEqual(
    api.normalizeStepExecutionRangeByFlow({
      codex: { enabled: true, fromStep: 6, toStep: 3 },
    }),
    {
      openai: { enabled: true, fromStep: 3, toStep: 6 },
    }
  );
});

test('step execution range disables nodes outside the configured bounds', () => {
  const api = createApi();
  const state = {
    activeFlowId: 'openai',
    stepExecutionRangeByFlow: {
      openai: { enabled: true, fromStep: 3, toStep: 6 },
    },
    nodeStatuses: Object.fromEntries(NODE_IDS.map((nodeId) => [nodeId, 'pending'])),
  };

  assert.equal(api.isNodeExecutionAllowedForState('open-chatgpt', state), false);
  assert.equal(api.isNodeExecutionAllowedForState('fill-password', state), true);
  assert.deepStrictEqual(api.getExecutionAllowedNodeIdsForState(state), [
    'fill-password',
    'fetch-signup-code',
    'fill-profile',
    'wait-registration-success',
  ]);
  assert.equal(api.getFirstUnfinishedNodeId(state.nodeStatuses, state), 'fill-password');
  assert.throws(
    () => api.assertNodeExecutionAllowedForState('open-chatgpt', state, '手动执行节点'),
    /执行范围禁用/
  );
});

test('step execution range ignores progress outside the allowed range', () => {
  const api = createApi();
  const state = {
    activeFlowId: 'openai',
    stepExecutionRangeByFlow: {
      openai: { enabled: true, fromStep: 3, toStep: 6 },
    },
    nodeStatuses: {
      'open-chatgpt': 'completed',
      'submit-signup-email': 'completed',
      'fill-password': 'pending',
    },
  };

  assert.equal(api.hasSavedNodeProgress(state.nodeStatuses, state), false);
  state.nodeStatuses['fill-password'] = 'completed';
  assert.equal(api.hasSavedNodeProgress(state.nodeStatuses, state), true);
  assert.equal(api.getFirstUnfinishedNodeId(state.nodeStatuses, state), 'fetch-signup-code');
});

test('setNodeStatus advances current node to step 6 after fill-profile completes', async () => {
  const events = [];
  const api = new Function('events', `
let state = {
  activeFlowId: 'openai',
  nodeStatuses: {
    'open-chatgpt': 'completed',
    'submit-signup-email': 'completed',
    'fill-password': 'completed',
    'fetch-signup-code': 'completed',
    'fill-profile': 'running',
    'wait-registration-success': 'pending',
  },
  currentNodeId: 'fill-profile',
};
const DEFAULT_ACTIVE_FLOW_ID = 'openai';
const DEFAULT_STATE = { nodeStatuses: ${JSON.stringify(Object.fromEntries(NODE_IDS.map((nodeId) => [nodeId, 'pending'])))} };
const chrome = {
  runtime: {
    sendMessage(message) {
      events.push({ type: 'message', message });
      return { catch() {} };
    },
  },
};
async function getState() { return state; }
async function setState(updates) {
  events.push({ type: 'setState', updates });
  state = { ...state, ...updates };
}
function getNodeIdsForState() { return ${JSON.stringify(NODE_IDS)}; }
function getStepIdByNodeIdForState(nodeId) { return ${JSON.stringify(NODE_STEPS)}[String(nodeId || '').trim()] || 0; }
function getNodeIdByStepForState(step) { return ${JSON.stringify(Object.fromEntries(Object.entries(NODE_STEPS).map(([nodeId, step]) => [step, nodeId])))}[Number(step)] || ''; }
${[
  'isPlainObjectValue',
  'normalizeStepExecutionRangeFlowId',
  'hasStepExecutionRangeShape',
  'normalizePositiveStepNumber',
  'normalizeStepExecutionRangeEntry',
  'normalizeStepExecutionRangeByFlow',
  'getStepExecutionRangeForState',
  'isStepAllowedByExecutionRangeForState',
  'isNodeExecutionAllowedForState',
  'getExecutionAllowedNodeIdsForState',
  'isStepDoneStatus',
  'normalizeStatusMapForNodes',
  'getFirstUnfinishedNodeId',
  'setNodeStatus',
].map(extractFunction).join('\n')}
return {
  async run() {
    await setNodeStatus('fill-profile', 'completed');
    return state;
  },
};
`)(events);

  const nextState = await api.run();

  assert.equal(nextState.nodeStatuses['fill-profile'], 'completed');
  assert.equal(nextState.currentNodeId, 'wait-registration-success');
});
