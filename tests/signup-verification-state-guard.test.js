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

test('verification visibility text fallback should not treat password retry page as verification page', () => {
  const api = new Function(`
const VERIFICATION_PAGE_PATTERN = /check\\s+your\\s+inbox|we\\s+emailed|resend/i;
const document = {
  querySelector() {
    return null;
  },
};

function getCurrentAuthRetryPageState(flow) {
  if (flow === 'signup_password') {
    return { retryEnabled: true };
  }
  return null;
}

function getVerificationCodeTarget() {
  return null;
}

function findResendVerificationCodeTrigger() {
  return null;
}

function isEmailVerificationPage() {
  return false;
}

function getPageTextSnapshot() {
  return 'Check your inbox and resend email if needed';
}

${extractFunction('isVerificationPageStillVisible')}

return {
  run() {
    return isVerificationPageStillVisible();
  },
};
`)();

  assert.equal(api.run(), false);
});

test('signup verification state should prioritize retry error page over verification visibility', () => {
  const api = new Function(`
const location = {
  href: 'https://auth.openai.com/email-verification',
};

function isStep5Ready() {
  return false;
}

function isVerificationPageStillVisible() {
  return true;
}

function isSignupPasswordErrorPage() {
  return true;
}

function getSignupPasswordTimeoutErrorPageState() {
  return { retryButton: { textContent: 'Try again' } };
}

function isSignupEmailAlreadyExistsPage() {
  return false;
}

function getSignupPasswordInput() {
  return null;
}

function getSignupPasswordSubmitButton() {
  return null;
}

${extractFunction('isSignupProfilePageUrl')}
${extractFunction('isLikelyLoggedInChatgptHomeUrl')}
${extractFunction('getStep4PostVerificationState')}
${extractFunction('inspectSignupVerificationState')}

return {
  run() {
    return inspectSignupVerificationState();
  },
};
`)();

  assert.deepStrictEqual(api.run(), {
    state: 'error',
    retryButton: { textContent: 'Try again' },
    userAlreadyExistsBlocked: false,
  });
});

test('signup verification state treats email-verification retry page as error instead of verification', () => {
  const api = new Function(`
const location = {
  pathname: '/email-verification',
};

function getAuthTimeoutErrorPageState(options) {
  return options.pathPatterns.some((pattern) => pattern.test(location.pathname))
    ? { retryButton: { textContent: 'Try again' } }
    : null;
}

function isStep5Ready() {
  return false;
}

function isVerificationPageStillVisible() {
  return true;
}

function isSignupEmailAlreadyExistsPage() {
  return false;
}

function getSignupPasswordInput() {
  return null;
}

function getSignupPasswordSubmitButton() {
  return null;
}

${extractFunction('getSignupAuthRetryPathPatterns')}
${extractFunction('getSignupPasswordTimeoutErrorPageState')}
${extractFunction('isSignupPasswordErrorPage')}
${extractFunction('isSignupProfilePageUrl')}
${extractFunction('isLikelyLoggedInChatgptHomeUrl')}
${extractFunction('getStep4PostVerificationState')}
${extractFunction('inspectSignupVerificationState')}

return {
  run() {
    return inspectSignupVerificationState();
  },
};
`)();

  assert.deepStrictEqual(api.run(), {
    state: 'error',
    retryButton: { textContent: 'Try again' },
    userAlreadyExistsBlocked: false,
  });
});

test('signup verification state treats profile url as step5 before fields finish rendering', () => {
  const api = new Function(`
const location = {
  href: 'https://auth.openai.com/create-account/profile',
};

function isStep5Ready() {
  return false;
}

function isVerificationPageStillVisible() {
  return false;
}

function isSignupPasswordErrorPage() {
  return false;
}

function getSignupPasswordTimeoutErrorPageState() {
  return null;
}

function isSignupEmailAlreadyExistsPage() {
  return false;
}

function getSignupPasswordInput() {
  return null;
}

function getSignupPasswordSubmitButton() {
  return null;
}

${extractFunction('isSignupProfilePageUrl')}
${extractFunction('isLikelyLoggedInChatgptHomeUrl')}
${extractFunction('getStep4PostVerificationState')}
${extractFunction('inspectSignupVerificationState')}

return {
  run() {
    return inspectSignupVerificationState();
  },
};
`)();

  assert.deepStrictEqual(api.run(), {
    state: 'step5',
  });
});

test('signup verification state exposes password error text on password page', () => {
  const api = new Function(`
const location = {
  href: 'https://auth.openai.com/log-in/password',
};

function isStep5Ready() {
  return false;
}

function isVerificationPageStillVisible() {
  return false;
}

function isSignupPasswordErrorPage() {
  return false;
}

function getSignupPasswordTimeoutErrorPageState() {
  return null;
}

function isSignupEmailAlreadyExistsPage() {
  return false;
}

function getSignupPasswordInput() {
  return { value: 'Secret123!' };
}

function getSignupPasswordSubmitButton() {
  return { textContent: 'Continue' };
}

function getSignupPasswordFieldErrorText() {
  return 'Incorrect phone number or password';
}

${extractFunction('isSignupProfilePageUrl')}
${extractFunction('isLikelyLoggedInChatgptHomeUrl')}
${extractFunction('getStep4PostVerificationState')}
${extractFunction('inspectSignupVerificationState')}

return {
  run() {
    return inspectSignupVerificationState();
  },
};
`)();

  assert.deepStrictEqual(api.run(), {
    state: 'password',
    passwordInput: { value: 'Secret123!' },
    submitButton: { textContent: 'Continue' },
    passwordErrorText: 'Incorrect phone number or password',
  });
});

test('signup verification state keeps verification priority when email-verification page also shows profile fields', () => {
  const api = new Function(`
const location = {
  href: 'https://auth.openai.com/email-verification/register',
};

function isStep5Ready() {
  return true;
}

function isVerificationPageStillVisible() {
  return true;
}

function isSignupPasswordErrorPage() {
  return false;
}

function getSignupPasswordTimeoutErrorPageState() {
  return null;
}

function isSignupEmailAlreadyExistsPage() {
  return false;
}

function getSignupPasswordInput() {
  return null;
}

function getSignupPasswordSubmitButton() {
  return null;
}

${extractFunction('isSignupProfilePageUrl')}
${extractFunction('isLikelyLoggedInChatgptHomeUrl')}
${extractFunction('getStep4PostVerificationState')}
${extractFunction('inspectSignupVerificationState')}

return {
  run() {
    return inspectSignupVerificationState();
  },
};
`)();

  assert.deepStrictEqual(api.run(), {
    state: 'verification',
  });
});

test('logged-out chatgpt homepage with signup and login actions is not treated as logged-in home', () => {
  const api = new Function(`
const location = {
  href: 'https://chatgpt.com/',
};

const signupButton = {
  textContent: '免费注册',
  disabled: false,
  getAttribute(name) {
    if (name === 'type') return 'button';
    return '';
  },
};

const loginButton = {
  textContent: '登录',
  disabled: false,
  getAttribute(name) {
    if (name === 'type') return 'button';
    return '';
  },
};

const document = {
  querySelectorAll(selector) {
    if (selector === 'a, button, [role="button"], [role="link"], input[type="button"], input[type="submit"]') {
      return [signupButton, loginButton];
    }
    return [];
  },
};

function findSignupEntryTrigger() {
  return signupButton;
}

function getActionText(el) {
  return [el?.textContent, el?.value, el?.getAttribute?.('aria-label'), el?.getAttribute?.('title')]
    .filter(Boolean)
    .join(' ')
    .replace(/\\s+/g, ' ')
    .trim();
}

function isVisibleElement() {
  return true;
}

function isActionEnabled(el) {
  return Boolean(el) && !el.disabled && el.getAttribute('aria-disabled') !== 'true';
}

${extractFunction('isLikelyLoggedInChatgptHomeUrl')}

return {
  run() {
    return isLikelyLoggedInChatgptHomeUrl();
  },
};
`)();

  assert.equal(api.run(), false);
});
