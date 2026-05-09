const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');

const { createAuthPageRecovery } = require('../content/auth-page-recovery.js');
const source = fs.readFileSync('content/auth-page-recovery.js', 'utf8');

function extractFunction(sourceText, name) {
  const start = sourceText.indexOf(`function ${name}(`);
  assert.notEqual(start, -1, `missing ${name}`);
  const bodyStart = sourceText.indexOf('{', start);
  let depth = 0;
  for (let i = bodyStart; i < sourceText.length; i += 1) {
    if (sourceText[i] === '{') depth += 1;
    if (sourceText[i] === '}') {
      depth -= 1;
      if (depth === 0) return sourceText.slice(start, i + 1);
    }
  }
  throw new Error(`unterminated ${name}`);
}

function createRetryButton() {
  return {
    disabled: false,
    textContent: 'Try again',
    getAttribute(name) {
      if (name === 'data-dd-action-name') return 'Try again';
      if (name === 'aria-disabled') return 'false';
      return '';
    },
  };
}

function createRecoveryApi(state) {
  const retryButton = createRetryButton();
  global.location = {
    pathname: state.pathname || '/log-in',
    href: state.href || `https://auth.openai.com${state.pathname || '/log-in'}`,
  };
  global.document = {
    title: state.title ?? 'Something went wrong',
    querySelector(selector) {
      if (selector === 'button[data-dd-action-name="Try again"]' && state.retryVisible) {
        return retryButton;
      }
      return null;
    },
    querySelectorAll() {
      return state.retryVisible ? [retryButton] : [];
    },
  };

  return createAuthPageRecovery({
    detailPattern: /timed out/i,
    getActionText: (element) => element?.textContent || '',
    getPageTextSnapshot: () => state.pageText,
    humanPause: async () => {},
    isActionEnabled: (element) => Boolean(element) && !element.disabled && element.getAttribute('aria-disabled') !== 'true',
    isVisibleElement: () => true,
    log: () => {},
    performOperationWithDelay: state.performOperationWithDelay,
    routeErrorPattern: /405\s+method\s+not\s+allowed|route\s+error.*405|did\s+not\s+provide\s+an?\s+[`'"]?action|post\s+request\s+to\s+["']?\/email-verification/i,
    simulateClick: () => {
      state.clickCount += 1;
      if (Array.isArray(state.events)) {
        state.events.push('click:retry');
      }
      if (typeof state.onClick === 'function') {
        state.onClick(state);
        return;
      }
      state.retryVisible = false;
      state.pageText = 'Recovered login form';
    },
    sleep: async (ms = 0) => {
      await new Promise((resolve) => setTimeout(resolve, Math.max(1, Math.min(5, ms))));
      if (Array.isArray(state.events) && ms === 250) {
        state.events.push(`poll-sleep:${ms}`);
      }
      if (typeof state.onSleep === 'function') {
        state.onSleep(state);
      }
    },
    throwIfStopped: () => {},
    titlePattern: /something went wrong/i,
  });
}

test('auth page recovery detects retry page state', () => {
  const state = {
    clickCount: 0,
    pageText: 'Something went wrong. Please try again.',
    retryVisible: true,
  };
  const api = createRecoveryApi(state);

  const snapshot = api.getAuthTimeoutErrorPageState({
    pathPatterns: [/\/log-in(?:[/?#]|$)/i],
  });

  assert.equal(Boolean(snapshot), true);
  assert.equal(snapshot.retryEnabled, true);
  assert.equal(snapshot.titleMatched, true);
  assert.equal(snapshot.detailMatched, false);
  assert.equal(snapshot.routeErrorMatched, false);
  assert.equal(snapshot.maxCheckAttemptsBlocked, false);
});

test('auth page recovery detects route error retry page on email verification route', () => {
  const state = {
    clickCount: 0,
    pageText: 'Route Error (405 Method Not Allowed): email-verification action missing.',
    pathname: '/email-verification',
    retryVisible: true,
    title: '',
  };
  const api = createRecoveryApi(state);

  const snapshot = api.getAuthTimeoutErrorPageState({
    pathPatterns: [/\/email-verification(?:[/?#]|$)/i],
  });

  assert.equal(Boolean(snapshot), true);
  assert.equal(snapshot.titleMatched, false);
  assert.equal(snapshot.detailMatched, false);
  assert.equal(snapshot.routeErrorMatched, true);
});

test('auth page recovery detects email route missing-action retry page text', () => {
  const state = {
    clickCount: 0,
    pageText: "Error: You made a POST request to \"/email-verification\" but did not provide an `action` for route \"EMAIL_VERIFICATION\"",
    pathname: '/email-verification',
    retryVisible: true,
    title: '',
  };
  const api = createRecoveryApi(state);

  const snapshot = api.getAuthTimeoutErrorPageState({
    pathPatterns: [/\/email-verification(?:[/?#]|$)/i],
  });

  assert.equal(Boolean(snapshot), true);
  assert.equal(snapshot.routeErrorMatched, true);
});

test('auth page recovery detects failed-to-fetch retry page on email verification route', () => {
  const state = {
    clickCount: 0,
    pageText: 'Oops, an error occurred! Failed to fetch',
    pathname: '/email-verification',
    retryVisible: true,
    title: 'Oops, an error occurred!',
  };
  const api = createRecoveryApi(state);

  const snapshot = api.getAuthTimeoutErrorPageState({
    pathPatterns: [/\/email-verification(?:[/?#]|$)/i],
  });

  assert.equal(Boolean(snapshot), true);
  assert.equal(snapshot.fetchFailedMatched, true);
});

test('auth page recovery clicks retry and waits until page recovers', async () => {
  const state = {
    clickCount: 0,
    pageText: 'Something went wrong. Please try again.',
    retryVisible: true,
  };
  const api = createRecoveryApi(state);

  const result = await api.recoverAuthRetryPage({
    logLabel: '步骤 8：检测到重试页，正在点击“重试”恢复',
    pathPatterns: [/\/log-in(?:[/?#]|$)/i],
    step: 8,
    timeoutMs: 1000,
  });

  assert.deepStrictEqual(result, {
    recovered: true,
    clickCount: 1,
    url: 'https://auth.openai.com/log-in',
  });
  assert.equal(state.clickCount, 1);
  assert.equal(state.retryVisible, false);
});

test('auth page recovery routes retry click through operation delay without wrapping polling sleeps', async () => {
  const authRetryEvents = [];
  const state = {
    clickCount: 0,
    events: authRetryEvents,
    pageText: 'Something went wrong. Please try again.',
    retryVisible: true,
    onClick() {},
    onSleep(currentState) {
      currentState.retryVisible = false;
      currentState.pageText = 'Recovered login form';
    },
    async performOperationWithDelay(metadata, operation) {
      authRetryEvents.push(`operation:${metadata.label}:start`);
      const result = await operation();
      authRetryEvents.push(`operation:${metadata.label}:end`);
      authRetryEvents.push(`delay:${metadata.label}:2000`);
      return result;
    },
  };
  const api = createRecoveryApi(state);

  await api.recoverAuthRetryPage({
    logLabel: '步骤 8：检测到重试页，正在点击“重试”恢复',
    pathPatterns: [/\/log-in(?:[/?#]|$)/i],
    step: 8,
    timeoutMs: 1000,
    waitAfterClickMs: 1000,
    pollIntervalMs: 250,
  });

  assert.deepStrictEqual(authRetryEvents, [
    'operation:auth-retry-click:start',
    'click:retry',
    'operation:auth-retry-click:end',
    'delay:auth-retry-click:2000',
    'poll-sleep:250',
  ]);
  assert.equal(authRetryEvents.filter((event) => event.startsWith('delay:auth-retry-click')).length, 1);
  assert.doesNotMatch(extractFunction(source, 'waitForRetryPageRecoveryAfterClick'), /performOperationWithDelay\(/);
});

test('auth page recovery can click retry twice before page recovers', async () => {
  const state = {
    clickCount: 0,
    pageText: 'Something went wrong. Please try again.',
    retryVisible: true,
    onClick(currentState) {
      if (currentState.clickCount >= 2) {
        currentState.retryVisible = false;
        currentState.pageText = 'Recovered login form';
      }
    },
  };
  const api = createRecoveryApi(state);

  const result = await api.recoverAuthRetryPage({
    logLabel: '步骤 8：检测到重试页，正在点击“重试”恢复',
    pathPatterns: [/\/log-in(?:[/?#]|$)/i],
    step: 8,
    timeoutMs: 200,
    waitAfterClickMs: 10,
    pollIntervalMs: 1,
  });

  assert.deepStrictEqual(result, {
    recovered: true,
    clickCount: 2,
    url: 'https://auth.openai.com/log-in',
  });
  assert.equal(state.clickCount, 2);
  assert.equal(state.retryVisible, false);
});

test('auth page recovery stops after five retry clicks when page does not recover', async () => {
  const state = {
    clickCount: 0,
    pageText: 'Something went wrong. Please try again.',
    retryVisible: true,
    onClick() {},
  };
  const api = createRecoveryApi(state);

  await assert.rejects(
    () => api.recoverAuthRetryPage({
      logLabel: '步骤 8：检测到重试页，正在点击“重试”恢复',
      maxClickAttempts: 5,
      pathPatterns: [/\/log-in(?:[/?#]|$)/i],
      step: 8,
      timeoutMs: 1000,
      waitAfterClickMs: 10,
      pollIntervalMs: 1,
    }),
    /已连续点击“重试” 5 次/
  );

  assert.equal(state.clickCount, 5);
  assert.equal(state.retryVisible, true);
});

test('auth page recovery throws cloudflare security blocked error on max_check_attempts page', async () => {
  const state = {
    clickCount: 0,
    pageText: 'Something went wrong. max_check_attempts reached.',
    retryVisible: true,
  };
  const api = createRecoveryApi(state);

  await assert.rejects(
    () => api.recoverAuthRetryPage({
      logLabel: '步骤 7：检测到登录超时报错，正在点击“重试”恢复当前页面',
      pathPatterns: [/\/log-in(?:[/?#]|$)/i],
      step: 7,
      timeoutMs: 1000,
    }),
    /CF_SECURITY_BLOCKED::/
  );
});

test('auth page recovery throws signup user already exists error without clicking retry', async () => {
  const state = {
    clickCount: 0,
    pageText: 'Something went wrong. user_already_exists.',
    pathname: '/email-verification',
    retryVisible: true,
  };
  const api = createRecoveryApi(state);

  await assert.rejects(
    () => api.recoverAuthRetryPage({
      logLabel: '步骤 4：检测到注册认证重试页，正在点击“重试”恢复',
      pathPatterns: [/\/email-verification(?:[/?#]|$)/i],
      step: 4,
      timeoutMs: 1000,
    }),
    /SIGNUP_USER_ALREADY_EXISTS::/
  );

  assert.equal(state.clickCount, 0);
});
