const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');

const source = fs.readFileSync('content/signup-page.js', 'utf8');

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

test('step 3 reports completion before deferred submit click', async () => {
  const api = new Function(`
const logs = [];
const completions = [];
const clicks = [];
const scheduled = [];
const events = [];
let releaseSubmitDelay;
const submitDelay = new Promise((resolve) => { releaseSubmitDelay = resolve; });

const snapshot = {
  state: 'password_page',
  passwordInput: { value: '', hidden: false },
  submitButton: { textContent: 'Continue', hidden: false },
  displayedEmail: 'user@example.com',
};

const window = {
  setTimeout(fn, ms) {
    scheduled.push({ fn, ms });
    return scheduled.length;
  },
  CodexOperationDelay: {
    async performOperationWithDelay(metadata, operation) {
      events.push('operation:' + metadata.label + ':start');
      const result = await operation();
      events.push('operation:' + metadata.label + ':end');
      if (metadata.kind === 'submit') {
        events.push('delay:' + metadata.label + ':pending');
        await submitDelay;
      }
      events.push('delay:' + metadata.label + ':2000');
      return result;
    },
  },
};

const location = {
  href: 'https://auth.openai.com/create-account/password',
};

function inspectSignupEntryState() {
  return snapshot;
}

function isPhoneVerificationPageReady() {
  return false;
}

function getPhoneVerificationDisplayedPhone() {
  return '';
}

function getVerificationCodeTarget() {
  return null;
}

function getStep4PostVerificationState() {
  return null;
}

function isVerificationPageStillVisible() {
  return false;
}

async function ensureSignupPasswordPageReady() {
  return { ready: true };
}

function getSignupPasswordSubmitButton() {
  return snapshot.submitButton;
}

async function waitForElementByText() {
  return null;
}

function fillInput(input, value) {
  input.value = value;
  events.push('fill-password:' + value);
}

async function humanPause() {}
async function sleep() {}
function throwIfStopped() {}
function isStopError() {
  return false;
}

function log(message, level = 'info') {
  logs.push({ message, level });
  events.push('log:' + message);
}

function reportComplete(step, payload) {
  completions.push({ step, payload });
  events.push('report:' + payload.deferredSubmit);
}

function simulateClick(target) {
  clicks.push(target.textContent || 'button');
  events.push('click:' + (target.textContent || 'button'));
}

function getOperationDelayRunner() {
  return window.CodexOperationDelay.performOperationWithDelay;
}

${extractFunction('step3_fillEmailPassword')}

return {
  async run(payload) {
    return step3_fillEmailPassword(payload);
  },
  async flushDeferredSubmit() {
    if (!scheduled.length) {
      throw new Error('missing deferred submit');
    }
    await scheduled[0].fn();
  },
  releaseSubmitDelay() {
    releaseSubmitDelay();
  },
  snapshot() {
    return {
      logs,
      completions,
      clicks,
      events,
      passwordValue: snapshot.passwordInput.value,
      scheduledCount: scheduled.length,
      scheduledDelayMs: scheduled[0]?.ms,
    };
  },
};
`)();

  let settled = false;
  const tracked = api.run({
    email: 'user@example.com',
    password: 'Secret123!',
  }).then((value) => {
    settled = true;
    return value;
  });

  await new Promise((resolve) => setImmediate(resolve));
  assert.equal(settled, true, 'step 3 must return completion before deferred submit can navigate');
  const result = await tracked;

  const beforeSubmit = api.snapshot();
  assert.equal(beforeSubmit.passwordValue, 'Secret123!');
  assert.equal(beforeSubmit.scheduledCount, 1);
  assert.equal(beforeSubmit.scheduledDelayMs, 120);
  assert.deepStrictEqual(beforeSubmit.clicks, []);
  assert.equal(beforeSubmit.completions.length, 1);
  assert.equal(beforeSubmit.completions[0].step, 3);
  assert.deepStrictEqual(result, beforeSubmit.completions[0].payload);
  assert.equal(result.email, 'user@example.com');
  assert.equal(result.deferredSubmit, true);
  assert.equal(typeof result.signupVerificationRequestedAt, 'number');
  assert.equal(beforeSubmit.events.includes('report:true'), true);
  assert.equal(beforeSubmit.events.includes('operation:submit-signup-password:start'), false);

  let flushSettled = false;
  const flushed = api.flushDeferredSubmit().then(() => {
    flushSettled = true;
  });
  await new Promise((resolve) => setImmediate(resolve));

  const duringSubmit = api.snapshot();
  assert.equal(duringSubmit.events.includes('operation:submit-signup-password:start'), true);
  assert.equal(duringSubmit.events.includes('delay:submit-signup-password:pending'), true);
  assert.equal(flushSettled, false);

  api.releaseSubmitDelay();
  await flushed;

  const afterSubmit = api.snapshot();
  assert.deepStrictEqual(afterSubmit.clicks, ['Continue']);
  assert.equal(afterSubmit.events.includes('delay:submit-signup-password:2000'), true);
});
