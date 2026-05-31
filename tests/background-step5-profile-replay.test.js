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

test('step 5 post-completion validation replays profile submit when retry recovery returns to about-you', async () => {
  const api = new Function(`
const logs = [];
const replays = [];
const states = [];
let stateReadCount = 0;
let currentState = {
  step5ProfilePayload: {
    firstName: 'Ada',
    lastName: 'Lovelace',
    year: 2003,
    month: 6,
    day: 19,
  },
  step5ProfileRecoveryCount: 0,
};

const chrome = {
  tabs: {
    async get() {
      return { url: stateReadCount >= 2 ? 'https://chatgpt.com/' : 'https://auth.openai.com/about-you' };
    },
  },
};

async function getState() {
  return currentState;
}

async function setState(patch) {
  states.push(patch);
  currentState = { ...currentState, ...patch };
}

async function sendToContentScriptResilient(_source, message) {
  if (message.type === 'GET_STEP5_SUBMIT_STATE') {
    stateReadCount += 1;
    if (stateReadCount === 1) {
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

async function addLog(message, level, meta) {
  logs.push({ message, level, meta });
}

async function waitForTabStableComplete() {}

function buildStep5ProfileStatePatch(payload = null, recoveryCount = 0) {
  return {
    step5ProfilePayload: payload,
    step5ProfileRecoveryCount: Math.max(0, Number(recoveryCount) || 0),
  };
}

const stepExecutorsByKey = {
  'fill-profile': async (state) => {
    replays.push({
      payload: state.step5ProfilePayload,
      recoveryCount: state.step5ProfileRecoveryCount,
    });
  },
};

${extractFunction('parseUrlSafely')}
${extractFunction('isSignupEntryHost')}
${extractFunction('isLikelyLoggedInChatgptHomeUrl')}
${extractFunction('isStep5CompletionChatgptUrl')}
${extractFunction('getStep5SubmitStateFromContent')}
${extractFunction('recoverStep5SubmitRetryPageOnTab')}
${extractFunction('validateStep5PostCompletion')}

return {
  async run() {
    return validateStep5PostCompletion(99, {
      navigationStarted: true,
      url: 'https://auth.openai.com/about-you',
    });
  },
  snapshot() {
    return { logs, replays, states };
  },
};
`)();

  const result = await api.run();
  const snapshot = api.snapshot();

  assert.equal(result.successState, 'logged_in_home');
  assert.equal(result.url, 'https://chatgpt.com/');
  assert.deepStrictEqual(snapshot.replays, [{
    payload: {
      firstName: 'Ada',
      lastName: 'Lovelace',
      year: 2003,
      month: 6,
      day: 19,
    },
    recoveryCount: 1,
  }]);
  assert.deepStrictEqual(snapshot.states, [{
    step5ProfilePayload: {
      firstName: 'Ada',
      lastName: 'Lovelace',
      year: 2003,
      month: 6,
      day: 19,
    },
    step5ProfileRecoveryCount: 1,
  }]);
  assert.equal(snapshot.logs.some(({ message }) => /1/.test(message)), true);
});
