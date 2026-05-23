const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');

const source = fs.readFileSync('flows/openai/content/openai-auth.js', 'utf8');

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

test('waitForVerificationSubmitOutcome recovers signup retry page after submit', async () => {
  const api = new Function(`
let retryVisible = true;
let step5Ready = false;
let recoverCalls = 0;
const location = { href: 'https://auth.openai.com/email-verification' };

function throwIfStopped() {}
function log() {}
function getVerificationErrorText() { return ''; }
function isStep5Ready() { return step5Ready; }
function isStep8Ready() { return false; }
function isAddPhonePageReady() { return false; }
function isVerificationPageStillVisible() { return false; }
function createSignupUserAlreadyExistsError() {
  return new Error('SIGNUP_USER_ALREADY_EXISTS::步骤 4：检测到 user_already_exists，说明当前用户已存在，当前轮将直接停止。');
}
function getCurrentAuthRetryPageState(flow) {
  if (flow === 'signup' && retryVisible) {
    return {
      retryEnabled: true,
      userAlreadyExistsBlocked: false,
    };
  }
  return null;
}
async function recoverCurrentAuthRetryPage() {
  recoverCalls += 1;
  retryVisible = false;
  step5Ready = true;
}
async function sleep() {}

${extractFunction('isSignupProfilePageUrl')}
${extractFunction('isLikelyLoggedInChatgptHomeUrl')}
${extractFunction('getStep4PostVerificationState')}
${extractFunction('waitForVerificationSubmitOutcome')}

return {
  run() {
    return waitForVerificationSubmitOutcome(4, 1000);
  },
  snapshot() {
    return { recoverCalls };
  },
};
`)();

  const result = await api.run();

  assert.deepStrictEqual(result, { success: true });
  assert.equal(api.snapshot().recoverCalls, 1);
});

test('waitForVerificationSubmitOutcome does not assume success after repeated signup retry pages', async () => {
  const api = new Function(`
let recoverCalls = 0;
const location = { href: 'https://auth.openai.com/email-verification' };

function throwIfStopped() {}
function log() {}
function getVerificationErrorText() { return ''; }
function isStep5Ready() { return false; }
function isStep8Ready() { return false; }
function isAddPhonePageReady() { return false; }
function isVerificationPageStillVisible() { return false; }
function createSignupUserAlreadyExistsError() {
  return new Error('SIGNUP_USER_ALREADY_EXISTS::步骤 4：检测到 user_already_exists，说明当前用户已存在，当前轮将直接停止。');
}
function getCurrentAuthRetryPageState(flow) {
  if (flow === 'signup') {
    return {
      retryEnabled: true,
      userAlreadyExistsBlocked: false,
    };
  }
  return null;
}
async function recoverCurrentAuthRetryPage() {
  recoverCalls += 1;
}
async function sleep() {}

${extractFunction('isSignupProfilePageUrl')}
${extractFunction('isLikelyLoggedInChatgptHomeUrl')}
${extractFunction('getStep4PostVerificationState')}
${extractFunction('waitForVerificationSubmitOutcome')}

return {
  run() {
    return waitForVerificationSubmitOutcome(4, 1000);
  },
  snapshot() {
    return { recoverCalls };
  },
};
`)();

  await assert.rejects(
    api.run(),
    /连续进入认证重试页 2 次，页面仍未恢复/
  );
  assert.equal(api.snapshot().recoverCalls, 2);
});

test('waitForVerificationSubmitOutcome marks step 5 skipped when step 4 already lands on chatgpt home', async () => {
  const api = new Function(`
const location = { href: 'https://chatgpt.com/' };

function throwIfStopped() {}
function log() {}
function getVerificationErrorText() { return ''; }
function isStep5Ready() { return false; }
function isStep8Ready() { return false; }
function isAddPhonePageReady() { return false; }
function isVerificationPageStillVisible() { return false; }
function createSignupUserAlreadyExistsError() {
  return new Error('SIGNUP_USER_ALREADY_EXISTS::步骤 4：检测到 user_already_exists，说明当前用户已存在，当前轮将直接停止。');
}
function getCurrentAuthRetryPageState() {
  return null;
}
async function recoverCurrentAuthRetryPage() {
  throw new Error('should not recover retry page');
}
async function sleep() {}

${extractFunction('isSignupProfilePageUrl')}
${extractFunction('isLikelyLoggedInChatgptHomeUrl')}
${extractFunction('getStep4PostVerificationState')}
${extractFunction('waitForVerificationSubmitOutcome')}

return {
  run() {
    return waitForVerificationSubmitOutcome(4, 1000);
  },
};
`)();

  const result = await api.run();

  assert.deepStrictEqual(result, {
    success: true,
    skipProfileStep: true,
    url: 'https://chatgpt.com/',
  });
});

test('waitForVerificationSubmitOutcome treats step 5 as success after submit even when verification ui residue remains', async () => {
  const api = new Function(`
const location = { href: 'https://auth.openai.com/email-verification/register' };

function throwIfStopped() {}
function log() {}
function getVerificationErrorText() { return ''; }
function isStep5Ready() { return true; }
function isStep8Ready() { return false; }
function isAddPhonePageReady() { return false; }
function isVerificationPageStillVisible() { return true; }
function createSignupUserAlreadyExistsError() {
  return new Error('SIGNUP_USER_ALREADY_EXISTS::步骤 4：检测到 user_already_exists，说明当前用户已存在，当前轮将直接停止。');
}
function getCurrentAuthRetryPageState() {
  return null;
}
async function recoverCurrentAuthRetryPage() {
  throw new Error('should not recover retry page');
}
async function sleep() {}

${extractFunction('isSignupProfilePageUrl')}
${extractFunction('isLikelyLoggedInChatgptHomeUrl')}
${extractFunction('getStep4PostVerificationState')}
${extractFunction('waitForVerificationSubmitOutcome')}

return {
  run() {
    return waitForVerificationSubmitOutcome(4, 1000);
  },
};
`)();

  const result = await api.run();

  assert.deepStrictEqual(result, {
    success: true,
  });
});

test('waitForVerificationSubmitOutcome advances post-verification interstitials until step 5', async () => {
  const api = new Function(`
const clicks = [];
const skipButton = {
  textContent: 'Skip for now',
  hidden: false,
  disabled: false,
  getAttribute(name) {
    if (name === 'aria-disabled') return 'false';
    return '';
  },
};
const location = { href: 'https://chatgpt.com/onboarding' };
const document = {
  body: {
    innerText: 'What brings you to ChatGPT? Tell us about yourself. Skip for now',
    textContent: 'What brings you to ChatGPT? Tell us about yourself. Skip for now',
  },
  querySelector() { return null; },
  querySelectorAll(selector) {
    if (selector === 'button, [role="button"], a, [role="link"], input[type="button"], input[type="submit"]') {
      return [skipButton];
    }
    return [];
  },
};

function throwIfStopped() {}
function log() {}
function getVerificationErrorText() { return ''; }
function isStep5Ready() { return location.href === 'https://auth.openai.com/create-account/profile'; }
function isStep5ProfileStillVisible() { return isStep5Ready(); }
function isStep8Ready() { return false; }
function isAddPhonePageReady() { return false; }
function isVerificationPageStillVisible() { return false; }
function getPageTextSnapshot() { return document.body.innerText; }
function isVisibleElement(el) { return Boolean(el) && !el.hidden; }
function isActionEnabled(el) { return Boolean(el) && !el.disabled && el.getAttribute?.('aria-disabled') !== 'true'; }
function getActionText(el) { return el?.textContent || ''; }
function createSignupUserAlreadyExistsError() {
  return new Error('SIGNUP_USER_ALREADY_EXISTS::步骤 4：检测到 user_already_exists，说明当前用户已存在，当前轮将直接停止。');
}
function getCurrentAuthRetryPageState() {
  return null;
}
async function recoverCurrentAuthRetryPage() {
  throw new Error('should not recover retry page');
}
async function humanPause() {}
function simulateClick(el) {
  clicks.push(el?.textContent || 'clicked');
  location.href = 'https://auth.openai.com/create-account/profile';
  document.body.innerText = 'Tell us about you Birthday';
  document.body.textContent = document.body.innerText;
}
async function sleep() {}

${extractFunction('isSignupProfilePageUrl')}
${extractFunction('isLikelyLoggedInChatgptHomeUrl')}
${extractFunction('isStep5CompletionChatgptUrl')}
${extractFunction('getStep5PostSubmitSuccessState')}
${extractFunction('findStep5PostSubmitOnboardingAction')}
${extractFunction('isStep5PostSubmitOnboardingPage')}
${extractFunction('getStep4PostVerificationState')}
${extractFunction('advanceStep4PostVerificationInterstitialPage')}
${extractFunction('waitForVerificationSubmitOutcome')}

return {
  run() {
    return waitForVerificationSubmitOutcome(4, 1000);
  },
  snapshot() {
    return { clicks, href: location.href };
  },
};
`)();

  const result = await api.run();

  assert.deepStrictEqual(result, { success: true });
  assert.deepStrictEqual(api.snapshot(), {
    clicks: ['Skip for now'],
    href: 'https://auth.openai.com/create-account/profile',
  });
});
