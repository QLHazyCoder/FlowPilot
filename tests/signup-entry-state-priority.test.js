/*
 * @Author: QLHazycoder
 * @Date: 2026-09-09 02:32:34
 * @LastEditors: QLHazycoder
 * @LastEditTime: 2026-09-09 11:03:00
 * @Description: Verify that signup entry detection stays within Step 2 responsibilities.
 */
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');

const source = fs.readFileSync('flows/openai/content/openai-auth.js', 'utf8');

function extractFunction(name) {
  const start = source.indexOf(`function ${name}(`);
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
    if (source[end] === '{') depth += 1;
    if (source[end] === '}') {
      depth -= 1;
      if (depth === 0) {
        end += 1;
        break;
      }
    }
  }

  return source.slice(start, end);
}

function createStateInspector({ emailInput = null, signupTrigger = null } = {}) {
  return new Function(`
const location = { href: 'https://chatgpt.com/' };
let postVerificationChecks = 0;

function isPhoneVerificationPageReady() { return false; }
function isVerificationPageStillVisible() { return false; }
function getSignupPasswordInput() { return null; }
function isSignupPasswordPage() { return false; }
function getSignupEmailInput() { return ${emailInput ? '{ id: \'email\' }' : 'null'}; }
function getSignupEmailContinueButton() { return null; }
function findSignupUsePhoneTrigger() { return null; }
function getSignupPhoneInput() { return null; }
function findSignupUseEmailTrigger() { return null; }
function findSignupEntryTrigger() { return ${signupTrigger ? '{ id: \'signup\' }' : 'null'}; }
function getStep4PostVerificationState() {
  postVerificationChecks += 1;
  return {
    state: 'registration_success_page',
    skipProfileStep: true,
    skipProfileStepReason: 'registration_success_page',
    url: location.href,
  };
}

${extractFunction('inspectSignupEntryState')}

return {
  inspect: inspectSignupEntryState,
  postVerificationChecks: () => postVerificationChecks,
};
`)();
}

test('signup entry state recognizes a visible signup trigger', () => {
  const api = createStateInspector({ signupTrigger: true });

  assert.deepStrictEqual(api.inspect(), {
    state: 'entry_home',
    signupTrigger: { id: 'signup' },
    url: 'https://chatgpt.com/',
  });
  assert.equal(api.postVerificationChecks(), 0);
});

test('signup entry state recognizes an email input', () => {
  const api = createStateInspector({ emailInput: true });

  assert.deepStrictEqual(api.inspect(), {
    state: 'email_entry',
    emailInput: { id: 'email' },
    continueButton: null,
    switchToPhoneTrigger: null,
    url: 'https://chatgpt.com/',
  });
  assert.equal(api.postVerificationChecks(), 0);
});

test('signup entry state falls back to a completed registration state without registration UI', () => {
  const api = createStateInspector();

  assert.deepStrictEqual(api.inspect(), {
    state: 'registration_success_page',
    skipProfileStep: true,
    skipProfileStepReason: 'registration_success_page',
    url: 'https://chatgpt.com/',
  });
  assert.equal(api.postVerificationChecks(), 1);
});
