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

test('step 5 post-completion validation recovers about-you retry page before allowing success', async () => {
  const api = new Function(`
const logs = [];
const messages = [];
let stateReadCount = 0;

const chrome = {
  tabs: {
    async get() {
      return { url: 'https://auth.openai.com/about-you' };
    },
  },
};

async function sendToContentScriptResilient(source, message) {
  messages.push({ source, type: message.type });
  if (message.type === 'ADVANCE_STEP5_POST_SUBMIT_PROMPT') {
    return { advanced: false };
  }
  if (message.type === 'GET_STEP5_SUBMIT_STATE') {
    stateReadCount += 1;
    if (stateReadCount === 1) {
      return {
        retryPage: true,
        retryEnabled: true,
        maxCheckAttemptsBlocked: false,
        userAlreadyExistsBlocked: false,
        successState: '',
        profileVisible: false,
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
  if (message.type === 'RECOVER_STEP5_SUBMIT_RETRY_PAGE') {
    return { recovered: true, clickCount: 1 };
  }
  throw new Error('unexpected message type: ' + message.type);
}

async function addLog(message, level, meta) {
  logs.push({ message, level, meta });
}

function getErrorMessage(error) {
  return error?.message || String(error || '');
}

async function waitForTabStableComplete() {}

${extractFunction('parseUrlSafely')}
${extractFunction('isSignupEntryHost')}
${extractFunction('isLikelyLoggedInChatgptHomeUrl')}
${extractFunction('isStep5CompletionChatgptUrl')}
${extractFunction('advanceStep5PostSubmitPromptOnTab')}
${extractFunction('getStep5SubmitStateFromContent')}
${extractFunction('recoverStep5SubmitRetryPageOnTab')}
${extractFunction('validateStep5PostCompletion')}

return {
  async run() {
    return validateStep5PostCompletion(99, {});
  },
  snapshot() {
    return { logs, messages, stateReadCount };
  },
};
`)();

  const result = await api.run();
  const snapshot = api.snapshot();

  assert.equal(result.successState, 'logged_in_home');
  assert.deepStrictEqual(
    snapshot.messages.map(({ type }) => type),
    ['ADVANCE_STEP5_POST_SUBMIT_PROMPT', 'GET_STEP5_SUBMIT_STATE', 'RECOVER_STEP5_SUBMIT_RETRY_PAGE', 'ADVANCE_STEP5_POST_SUBMIT_PROMPT', 'GET_STEP5_SUBMIT_STATE']
  );
  assert.equal(snapshot.stateReadCount, 2);
  assert.equal(
    snapshot.logs.some(({ message }) => /检测到认证重试页/.test(message)),
    true
  );
});

test('step 5 post-completion validation rejects non-chatgpt success candidates', async () => {
  const api = new Function(`
const logs = [];
const chrome = {
  tabs: {
    async get() {
      return { url: 'https://auth.openai.com/sign-in-with-chatgpt/codex/consent' };
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
      successState: 'oauth_consent',
      profileVisible: false,
      errorText: '',
      unknownAuthPage: false,
      url: 'https://auth.openai.com/sign-in-with-chatgpt/codex/consent',
    };
  }
  throw new Error('unexpected message type: ' + message.type);
}

async function addLog(message, level, meta) {
  logs.push({ message, level, meta });
}

function getErrorMessage(error) {
  return error?.message || String(error || '');
}

async function waitForTabStableComplete() {}

${extractFunction('parseUrlSafely')}
${extractFunction('isSignupEntryHost')}
${extractFunction('isLikelyLoggedInChatgptHomeUrl')}
${extractFunction('isStep5CompletionChatgptUrl')}
${extractFunction('advanceStep5PostSubmitPromptOnTab')}
${extractFunction('getStep5SubmitStateFromContent')}
${extractFunction('recoverStep5SubmitRetryPageOnTab')}
${extractFunction('validateStep5PostCompletion')}

return {
  run() {
    return validateStep5PostCompletion(99, {});
  },
  snapshot() {
    return { logs };
  },
};
`)();

  await assert.rejects(
    api.run(),
    /尚未跳转到 https:\/\/chatgpt\.com/
  );
  assert.equal(
    api.snapshot().logs.some(({ message }) => /非 chatgpt\.com 的步骤 5 完成候选/.test(message)),
    true
  );
});

test('step 5 post-completion validation clears chatgpt home prompts before allowing success', async () => {
  const api = new Function(`
const messages = [];
let promptAdvanceCount = 0;
let stateReadCount = 0;
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
    return { advanced: promptAdvanceCount <= 2, actionText: promptAdvanceCount === 1 ? '跳过' : '继续' };
  }
  if (message.type === 'GET_STEP5_SUBMIT_STATE') {
    stateReadCount += 1;
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

async function addLog() {}
function getErrorMessage(error) { return error?.message || String(error || ''); }
async function waitForTabStableComplete() {}

${extractFunction('parseUrlSafely')}
${extractFunction('isSignupEntryHost')}
${extractFunction('isLikelyLoggedInChatgptHomeUrl')}
${extractFunction('isStep5CompletionChatgptUrl')}
${extractFunction('advanceStep5PostSubmitPromptOnTab')}
${extractFunction('getStep5SubmitStateFromContent')}
${extractFunction('recoverStep5SubmitRetryPageOnTab')}
${extractFunction('validateStep5PostCompletion')}

return {
  async run() {
    return validateStep5PostCompletion(99, { maxPostSubmitPromptActions: 4 });
  },
  snapshot() {
    return { messages, promptAdvanceCount, stateReadCount };
  },
};
`)();

  const result = await api.run();
  const snapshot = api.snapshot();

  assert.equal(result.successState, 'logged_in_home');
  assert.deepStrictEqual(
    snapshot.messages.map(({ type }) => type),
    [
      'ADVANCE_STEP5_POST_SUBMIT_PROMPT',
      'ADVANCE_STEP5_POST_SUBMIT_PROMPT',
      'ADVANCE_STEP5_POST_SUBMIT_PROMPT',
    ]
  );
  assert.equal(snapshot.promptAdvanceCount, 3);
  assert.equal(snapshot.stateReadCount, 0);
});

test('step 5 post-completion validation falls back to direct button click when content prompt command stalls', async () => {
  const api = new Function(`
const messages = [];
const logs = [];
const fallbackClicks = [];
let stateReadCount = 0;
let fallbackPromptVisible = true;
const chrome = {
  tabs: {
    async get() {
      return { url: 'https://chatgpt.com/' };
    },
  },
  scripting: {
    async executeScript(details) {
      const result = fallbackPromptVisible
        ? { advanced: true, actionText: '跳过', fallback: true }
        : { advanced: false, reason: 'prompt_not_detected' };
      if (result.advanced) {
        fallbackClicks.push(result.actionText);
        fallbackPromptVisible = false;
      }
      return [{ result }];
    },
  },
};

async function sendToContentScriptResilient(source, message) {
  messages.push({ source, type: message.type });
  if (message.type === 'ADVANCE_STEP5_POST_SUBMIT_PROMPT') {
    throw new Error('message channel is closed');
  }
  if (message.type === 'GET_STEP5_SUBMIT_STATE') {
    stateReadCount += 1;
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

async function addLog(message, level, meta) { logs.push({ message, level, meta }); }
async function waitForTabStableComplete() {}
async function getTabId() { return 99; }
function getErrorMessage(error) { return error?.message || String(error || ''); }

${extractFunction('parseUrlSafely')}
${extractFunction('isSignupEntryHost')}
${extractFunction('isLikelyLoggedInChatgptHomeUrl')}
${extractFunction('isStep5CompletionChatgptUrl')}
${extractFunction('advanceStep5PostSubmitPromptOnTab')}
${extractFunction('getStep5SubmitStateFromContent')}
${extractFunction('recoverStep5SubmitRetryPageOnTab')}
${extractFunction('validateStep5PostCompletion')}

return {
  async run() {
    return validateStep5PostCompletion(99, {
      maxPostSubmitPromptActions: 4,
      requireContentStateBeforeUrlSuccess: true,
    });
  },
  snapshot() {
    return { messages, logs, fallbackClicks, stateReadCount };
  },
};
`)();

  const result = await api.run();
  const snapshot = api.snapshot();

  assert.equal(result.successState, 'logged_in_home');
  assert.deepStrictEqual(snapshot.fallbackClicks, ['跳过']);
  assert.equal(snapshot.stateReadCount, 1);
  assert.equal(
    snapshot.logs.some(({ message }) => /后台兜底已点击注册后弹窗按钮“跳过”/.test(message)),
    true
  );
});
