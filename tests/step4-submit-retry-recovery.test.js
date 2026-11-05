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

  const extracted = source.slice(start, end);
  return name === 'getStep4PostVerificationState'
    ? `${extractFunction('isRegistrationCompletionChatgptUrl')}\n${extracted}`
    : extracted;
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
function inspectSignupVerificationState() { return getStep4PostVerificationState(); }
function inspectSignupVerificationState() { return getStep4PostVerificationState(); }
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
function inspectSignupVerificationState() { return { state: 'error' }; }
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
function inspectSignupVerificationState() { return getStep4PostVerificationState(); }
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
    skipRegistrationWaitStep: true,
    url: 'https://chatgpt.com/',
  });
});

test('getStep4PostVerificationState recognizes the registration success page without skipping step 6', () => {
  const api = new Function(`
const location = { href: 'https://chatgpt.com/c/registration-complete' };

function isVerificationPageStillVisible() { return false; }
function isStep5Ready() { return false; }
function findSignupEntryTrigger() { return {}; }

${extractFunction('isSignupProfilePageUrl')}
${extractFunction('isLikelyLoggedInChatgptHomeUrl')}
${extractFunction('getStep4PostVerificationState')}

return {
  run() {
    return getStep4PostVerificationState();
  },
};
`)();

  assert.deepStrictEqual(api.run(), {
    state: 'registration_success_page',
    skipProfileStep: true,
    skipProfileStepReason: 'registration_success_page',
    url: 'https://chatgpt.com/c/registration-complete',
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
function inspectSignupVerificationState() { return getStep4PostVerificationState(); }
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


test('waitForVerificationSubmitOutcome throws account_deactivated without retrying', async () => {
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
  return new Error('SIGNUP_USER_ALREADY_EXISTS::步骤 4：检测到 user_already_exists');
}
function createSignupAccountDeactivatedError() {
  return new Error('SIGNUP_ACCOUNT_DEACTIVATED::步骤 4：检测到 account_deactivated');
}
function getCurrentAuthRetryPageState(flow) {
  if (flow === 'signup') {
    return {
      retryEnabled: true,
      userAlreadyExistsBlocked: false,
      accountDeactivatedBlocked: true,
    };
  }
  return null;
}
function inspectSignupVerificationState() {
  return { state: 'error', accountDeactivatedBlocked: true };
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

  await assert.rejects(api.run(), /SIGNUP_ACCOUNT_DEACTIVATED::/);
  assert.equal(api.snapshot().recoverCalls, 0);
});


test('waitForVerificationSubmitOutcome detects account_deactivated after the previous 12-second window', async () => {
  const api = new Function(`
let fakeNow = 0;
const originalDateNow = Date.now;
Date.now = () => fakeNow;
const location = { href: 'https://auth.openai.com/email-verification' };

function throwIfStopped() {}
function log() {}
function getVerificationErrorText() { return ''; }
function isEmailVerificationPage() { return false; }
function isStep5Ready() { return false; }
function isStep8Ready() { return false; }
function isAddPhonePageReady() { return false; }
function isVerificationPageStillVisible() { return false; }
function getStep4PostVerificationState() { return null; }
function createSignupUserAlreadyExistsError() {
  return new Error('SIGNUP_USER_ALREADY_EXISTS::步骤 4：检测到 user_already_exists');
}
function createSignupAccountDeactivatedError() {
  return new Error('SIGNUP_ACCOUNT_DEACTIVATED::步骤 4：检测到 account_deactivated');
}
function createStep8EmailInUseError() { return new Error('STEP8_EMAIL_IN_USE::'); }
function createAuthMaxCheckAttemptsError() { return new Error('AUTH_MAX_CHECK_ATTEMPTS::'); }
function getCurrentAuthRetryPageState(flow) {
  if (flow === 'signup' && fakeNow >= 13000) {
    return { accountDeactivatedBlocked: true };
  }
  return null;
}
function inspectSignupVerificationState() {
  const retryState = getCurrentAuthRetryPageState('signup');
  return retryState?.accountDeactivatedBlocked
    ? { state: 'error', accountDeactivatedBlocked: true }
    : { state: 'unknown' };
}
async function recoverCurrentAuthRetryPage() {
  throw new Error('should not recover');
}
async function sleep() { fakeNow += 500; }

${extractFunction('waitForVerificationSubmitOutcome')}

return {
  run() {
    return waitForVerificationSubmitOutcome(4, undefined);
  },
  restore() {
    Date.now = originalDateNow;
  },
};
`)();

  try {
    await assert.rejects(api.run(), /SIGNUP_ACCOUNT_DEACTIVATED::/);
  } finally {
    api.restore();
  }
});

test('waitForVerificationSubmitOutcome does not assume success on an unknown auth page', async () => {
  const api = new Function(`
const location = { href: 'https://auth.openai.com/email-verification' };
function throwIfStopped() {}
function log() {}
function getVerificationErrorText() { return ''; }
function isEmailVerificationPage() { return false; }
function isStep5Ready() { return false; }
function isStep8Ready() { return false; }
function isAddPhonePageReady() { return false; }
function isVerificationPageStillVisible() { return false; }
function getStep4PostVerificationState() { return null; }
function createSignupUserAlreadyExistsError() { return new Error('SIGNUP_USER_ALREADY_EXISTS::'); }
function inspectSignupVerificationState() { return { state: 'unknown' }; }
function createSignupAccountDeactivatedError() { return new Error('SIGNUP_ACCOUNT_DEACTIVATED::'); }
function createStep8EmailInUseError() { return new Error('STEP8_EMAIL_IN_USE::'); }
function createAuthMaxCheckAttemptsError() { return new Error('AUTH_MAX_CHECK_ATTEMPTS::'); }
function getCurrentAuthRetryPageState() { return null; }
async function recoverCurrentAuthRetryPage() {}
async function sleep() {}

${extractFunction('waitForVerificationSubmitOutcome')}

return {
  run() {
    return waitForVerificationSubmitOutcome(4, 100);
  },
};
`)();

  await assert.rejects(api.run(), /STEP4_POST_SUBMIT_UNKNOWN_STATE::/);
});


test('waitForVerificationSubmitOutcome inspects the page immediately after submit and before sleeping', async () => {
  const api = new Function(`
const events = [];
const location = { href: 'https://auth.openai.com/email-verification' };
function throwIfStopped() {}
function log() {}
function getVerificationErrorText() { return ''; }
function isEmailVerificationPage() { return false; }
function isStep8Ready() { return false; }
function isAddPhonePageReady() { return false; }
function isVerificationPageStillVisible() { return false; }
function getCurrentAuthRetryPageState() { return null; }
function createSignupUserAlreadyExistsError() { return new Error('SIGNUP_USER_ALREADY_EXISTS::'); }
function createSignupAccountDeactivatedError() { return new Error('SIGNUP_ACCOUNT_DEACTIVATED::'); }
function inspectSignupVerificationState() {
  events.push('inspect');
  return { state: 'error', accountDeactivatedBlocked: true };
}
async function sleep() { events.push('sleep'); }

${extractFunction('waitForVerificationSubmitOutcome')}

return {
  run() {
    return waitForVerificationSubmitOutcome(4, 1000);
  },
  events() {
    return events;
  },
};
`)();

  await assert.rejects(api.run(), /SIGNUP_ACCOUNT_DEACTIVATED::/);
  assert.deepStrictEqual(api.events(), ['inspect']);
});
