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
  for (let index = start; index < source.length; index += 1) {
    const char = source[index];
    if (char === '(') {
      parenDepth += 1;
    } else if (char === ')') {
      parenDepth -= 1;
      if (parenDepth === 0) {
        signatureEnded = true;
      }
    } else if (char === '{' && signatureEnded) {
      braceStart = index;
      break;
    }
  }
  if (braceStart < 0) {
    throw new Error(`missing body for function ${name}`);
  }

  let depth = 0;
  let end = braceStart;
  for (; end < source.length; end += 1) {
    const char = source[end];
    if (char === '{') depth += 1;
    if (char === '}') {
      depth -= 1;
      if (depth === 0) {
        end += 1;
        break;
      }
    }
  }

  return source.slice(start, end);
}

test('step 8 click effect throws when retry page appears after clicking continue', async () => {
  const api = new Function(`
const chrome = {
  tabs: {
    async get() {
      return {
        id: 88,
        url: 'https://auth.openai.com/authorize',
      };
    },
  },
};

function throwIfStopped() {}
async function sleepWithStop() {}
async function ensureStep8SignupPageReady() {}
async function getStep8PageState() {
  return {
    url: 'https://auth.openai.com/authorize',
    retryPage: true,
    addPhonePage: false,
    consentPage: false,
    verificationPage: false,
  };
}

${extractFunction('waitForStep8ClickEffect')}

return {
  async run() {
    return waitForStep8ClickEffect(88, 'https://auth.openai.com/authorize', 1000);
  },
};
`)();

  await assert.rejects(
    () => api.run(),
    /点击“继续”后页面进入认证页重试页/
  );
});

test('step 8 ready check throws when consent page is already a retry page before clicking', async () => {
  const api = new Function(`
const chrome = {
  tabs: {
    async get() {
      return {
        id: 88,
        url: 'https://auth.openai.com/authorize',
      };
    },
  },
};

function throwIfStopped() {}
async function sleepWithStop() {}
async function ensureStep8SignupPageReady() {}
async function getStep8PageState() {
  return {
    url: 'https://auth.openai.com/authorize',
    retryPage: true,
    addPhonePage: false,
    consentReady: false,
  };
}

${extractFunction('waitForStep8Ready')}

return {
  async run() {
    return waitForStep8Ready(88, 1000);
  },
};
`)();

  await assert.rejects(
    () => api.run(),
    /当前认证页已进入重试页/
  );
});

test('step 8 ready check keeps waiting when retryPage is reported on consent URL', async () => {
  const api = new Function(`
let pollCount = 0;

function throwIfStopped() {}
async function sleepWithStop() {}
async function ensureStep8SignupPageReady() {}
async function getState() {
  return {};
}
const phoneVerificationHelpers = {
  async completePhoneVerificationFlow() {
    throw new Error('should not trigger phone verification flow');
  },
};
async function getStep8PageState() {
  pollCount += 1;
  if (pollCount === 1) {
    return {
      url: 'https://auth.openai.com/sign-in-with-chatgpt/codex/consent',
      retryPage: true,
      consentPage: true,
      consentReady: false,
      addPhonePage: false,
      phoneVerificationPage: false,
    };
  }
  return {
    url: 'https://auth.openai.com/sign-in-with-chatgpt/codex/consent',
    retryPage: false,
    consentPage: true,
    consentReady: true,
    addPhonePage: false,
    phoneVerificationPage: false,
  };
}

${extractFunction('waitForStep8Ready')}

return {
  async run() {
    return waitForStep8Ready(88, 1000);
  },
};
`)();

  const result = await api.run();
  assert.equal(result?.consentReady, true);
  assert.equal(result?.retryPage, false);
});

test('step 8 click effect ignores consent-like retry snapshots and waits for real page progress', async () => {
  const api = new Function(`
let pollCount = 0;
const chrome = {
  tabs: {
    async get() {
      return {
        id: 88,
        url: 'https://auth.openai.com/sign-in-with-chatgpt/codex/consent',
      };
    },
  },
};

function throwIfStopped() {}
async function sleepWithStop() {}
async function ensureStep8SignupPageReady() {}
async function getStep8PageState() {
  pollCount += 1;
  if (pollCount === 1) {
    return {
      url: 'https://auth.openai.com/sign-in-with-chatgpt/codex/consent',
      retryPage: true,
      consentPage: true,
      consentReady: false,
      addPhonePage: false,
      verificationPage: false,
    };
  }
  return {
    url: 'https://chatgpt.com/',
    retryPage: false,
    consentPage: false,
    consentReady: false,
    addPhonePage: false,
    verificationPage: false,
  };
}

${extractFunction('waitForStep8ClickEffect')}

return {
  async run() {
    return waitForStep8ClickEffect(
      88,
      'https://auth.openai.com/sign-in-with-chatgpt/codex/consent',
      1000
    );
  },
};
`)();

  const result = await api.run();
  assert.equal(result?.progressed, true);
  assert.equal(result?.reason, 'left_consent_page');
  assert.match(String(result?.url || ''), /chatgpt\.com/);
});

test('step 8 ready check waits through a transient add-phone state before OAuth consent', async () => {
  const api = new Function(`
let pollCount = 0;
const phoneVerificationCalls = [];

function throwIfStopped() {}
async function sleepWithStop() {}
async function ensureStep8SignupPageReady() {}
async function getState() {
  return {};
}
const phoneVerificationHelpers = {
  async completePhoneVerificationFlow(tabId, pageState) {
    phoneVerificationCalls.push({ tabId, pageState });
    return {
      success: true,
      consentReady: true,
      url: 'https://auth.openai.com/authorize',
    };
  },
};
async function getStep8PageState() {
  pollCount += 1;
  if (pollCount === 1) {
    return {
      url: 'https://auth.openai.com/add-phone',
      addPhonePage: true,
      phoneVerificationPage: false,
      consentReady: false,
    };
  }
  return {
    url: 'https://auth.openai.com/authorize',
    addPhonePage: false,
    phoneVerificationPage: false,
    consentReady: true,
  };
}

${extractFunction('waitForStep8Ready')}

return {
  async run() {
    return {
      result: await waitForStep8Ready(88, 1000),
      phoneVerificationCalls,
    };
  },
};
`)();

  const { result, phoneVerificationCalls } = await api.run();
  assert.equal(result?.consentReady, true);
  assert.deepStrictEqual(phoneVerificationCalls, []);
});

test('step 8 ready check does not classify a persistent add-phone state as a direct OAuth fatal error', async () => {
  const api = new Function(`
const phoneVerificationCalls = [];

function throwIfStopped() {}
async function sleepWithStop() {}
async function ensureStep8SignupPageReady() {}
async function getState() {
  return {};
}
const phoneVerificationHelpers = {
  async completePhoneVerificationFlow(tabId, pageState) {
    phoneVerificationCalls.push({ tabId, pageState });
    return {
      success: true,
      consentReady: true,
      url: 'https://auth.openai.com/authorize',
    };
  },
};
async function getStep8PageState() {
  return {
    url: 'https://auth.openai.com/add-phone',
    addPhonePage: true,
    phoneVerificationPage: false,
    consentReady: false,
  };
}

${extractFunction('waitForStep8Ready')}

return {
  async run() {
    try {
      await waitForStep8Ready(88, 1000);
      return { error: null, phoneVerificationCalls };
    } catch (error) {
      return { error, phoneVerificationCalls };
    }
  },
};
`)();

  const { error, phoneVerificationCalls } = await api.run();

  assert.match(String(error?.message || ''), /长时间未进入 OAuth 同意页/);
  assert.doesNotMatch(String(error?.message || ''), /自动确认 OAuth 只处理 OAuth 授权页/);
  assert.deepStrictEqual(phoneVerificationCalls, []);
});
