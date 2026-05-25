// flows/openai/content/openai-auth.js — Content script for ChatGPT signup entry + OpenAI auth pages
// Injected on: auth0.openai.com, auth.openai.com, accounts.openai.com
// Dynamically injected on: chatgpt.com

console.log('[MultiPage:openai-auth] Content script loaded on', location.href);

const OPENAI_AUTH_LISTENER_SENTINEL = 'data-multipage-openai-auth-listener';

function getOperationDelayRunner() {
  const rootScope = typeof window !== 'undefined' ? window : globalThis;
  const gate = rootScope?.CodexOperationDelay?.performOperationWithDelay;
  return typeof gate === 'function'
    ? gate
    : async (_metadata, operation) => operation();
}

if (document.documentElement.getAttribute(OPENAI_AUTH_LISTENER_SENTINEL) !== '1') {
  document.documentElement.setAttribute(OPENAI_AUTH_LISTENER_SENTINEL, '1');

  // Listen for commands from Background
  chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
    if (
      message.type === 'EXECUTE_NODE'
      || message.type === 'FILL_CODE'
      || message.type === 'STEP8_FIND_AND_CLICK'
      || message.type === 'STEP8_GET_STATE'
      || message.type === 'STEP8_TRIGGER_CONTINUE'
      || message.type === 'GET_LOGIN_AUTH_STATE'
      || message.type === 'SUBMIT_ADD_EMAIL'
      || message.type === 'GET_STEP5_SUBMIT_STATE'
      || message.type === 'PREPARE_SIGNUP_VERIFICATION'
      || message.type === 'RECOVER_AUTH_RETRY_PAGE'
      || message.type === 'RECOVER_STEP5_SUBMIT_RETRY_PAGE'
      || message.type === 'RESEND_VERIFICATION_CODE'
      || message.type === 'SUBMIT_PHONE_NUMBER'
      || message.type === 'SUBMIT_PHONE_VERIFICATION_CODE'
      || message.type === 'RESEND_PHONE_VERIFICATION_CODE'
      || message.type === 'CHECK_PHONE_RESEND_ERROR'
      || message.type === 'RETURN_TO_ADD_PHONE'
      || message.type === 'ENSURE_SIGNUP_ENTRY_READY'
      || message.type === 'ENSURE_SIGNUP_PHONE_ENTRY_READY'
      || message.type === 'ENSURE_SIGNUP_PASSWORD_PAGE_READY'
    ) {
      resetStopState();
      handleCommand(message).then((result) => {
        sendResponse({ ok: true, ...(result || {}) });
      }).catch(err => {
        const reportedStep = Number(message.payload?.visibleStep) || message.step;
        const reportedNodeId = resolveCommandNodeId(message);
        if (isStopError(err)) {
          if (reportedStep) {
            log(`步骤 ${reportedStep || 8}：已被用户停止。`, 'warn');
          }
          sendResponse({ stopped: true, error: err.message });
          return;
        }

        if (message.type === 'STEP8_FIND_AND_CLICK') {
          log(err.message, 'error', { step: reportedStep || 9, stepKey: 'confirm-oauth' });
          sendResponse({ error: err.message });
          return;
        }

        if (reportedStep) {
          reportError(reportedNodeId || reportedStep, err.message);
        }
        sendResponse({ error: err.message });
      });
      return true;
    }
  });
} else {
  console.log('[MultiPage:openai-auth] 消息监听已存在，跳过重复注册');
}

const OPENAI_AUTH_NODE_HANDLERS = Object.freeze({
  'submit-signup-email': (payload) => step2_clickRegister(payload),
  'fill-password': (payload) => step3_fillEmailPassword(payload),
  'fill-profile': (payload) => step5_fillNameBirthday(payload),
  'oauth-login': (payload) => step6_login(payload),
  'relogin-bound-email': (payload) => step6_login(payload),
  'confirm-oauth': (_payload) => step8_findAndClick(),
});

function resolveCommandNodeId(message = {}) {
  const directNodeId = String(message.nodeId || message.payload?.nodeId || '').trim();
  if (directNodeId) {
    return directNodeId;
  }
  const visibleStep = Number(message.payload?.visibleStep || message.step) || 0;
  if (visibleStep === 4) return 'fetch-signup-code';
  if (message.type === 'FILL_CODE' && (visibleStep === 12 || visibleStep === 15)) {
    return 'fetch-bound-email-login-code';
  }
  if (
    (
      message.type === 'SUBMIT_PHONE_NUMBER'
      || message.type === 'SUBMIT_PHONE_VERIFICATION_CODE'
      || message.type === 'RESEND_PHONE_VERIFICATION_CODE'
      || message.type === 'CHECK_PHONE_RESEND_ERROR'
      || message.type === 'RETURN_TO_ADD_PHONE'
    )
    && (visibleStep === 13 || visibleStep === 16)
  ) {
    return 'post-bound-email-phone-verification';
  }
  if (visibleStep === 8 || visibleStep === 11) return 'fetch-login-code';
  if (visibleStep === 9 || visibleStep === 12) return 'post-login-phone-verification';
  if (visibleStep === 10 || visibleStep === 13) return 'confirm-oauth';
  if (visibleStep === 16) return 'confirm-oauth';
  if (visibleStep === 14 || visibleStep === 15 || visibleStep === 17) return 'platform-verify';
  if (visibleStep === 7) return 'oauth-login';
  if (visibleStep === 5) return 'fill-profile';
  if (visibleStep === 3) return 'fill-password';
  if (visibleStep === 2) return 'submit-signup-email';
  return '';
}

async function handleCommand(message) {
  switch (message.type) {
    case 'EXECUTE_NODE': {
      const nodeId = String(message.nodeId || message.payload?.nodeId || '').trim();
      const handler = OPENAI_AUTH_NODE_HANDLERS[nodeId];
      if (!handler) {
        throw new Error(`openai-auth.js 不处理节点 ${nodeId}`);
      }
      return await handler(message.payload || {});
    }
    case 'FILL_CODE':
      // Step 4 = signup code, Step 7 = login code (same handler)
      return await fillVerificationCode(message.step, message.payload);
    case 'GET_LOGIN_AUTH_STATE':
      return serializeLoginAuthState(inspectLoginAuthState());
    case 'SUBMIT_ADD_EMAIL':
      return await submitAddEmailAndContinue(message.payload);
    case 'GET_STEP5_SUBMIT_STATE':
      return getStep5SubmitState();
    case 'PREPARE_SIGNUP_VERIFICATION':
      return await prepareSignupVerificationFlow(message.payload);
    case 'RECOVER_AUTH_RETRY_PAGE':
      return await recoverCurrentAuthRetryPage(message.payload);
    case 'RECOVER_STEP5_SUBMIT_RETRY_PAGE':
      return await recoverStep5SubmitRetryPage(message.payload);
    case 'RESEND_VERIFICATION_CODE':
      return await resendVerificationCode(message.step);
    case 'SUBMIT_PHONE_NUMBER':
      return await phoneAuthHelpers.submitPhoneNumber(message.payload);
    case 'SUBMIT_PHONE_VERIFICATION_CODE':
      if (message.payload?.purpose === 'signup') {
        return await fillVerificationCode(message.step || 4, message.payload);
      }
      if (message.payload?.purpose === 'login') {
        return await fillVerificationCode(message.step || 8, message.payload);
      }
      return await submitPhoneVerificationCodeWithProfileFallback(message.payload);
    case 'RESEND_PHONE_VERIFICATION_CODE':
      return await phoneAuthHelpers.resendPhoneVerificationCode(undefined, message.payload || {});
    case 'CHECK_PHONE_RESEND_ERROR':
      return phoneAuthHelpers.checkPhoneResendError();
    case 'RETURN_TO_ADD_PHONE':
      return await phoneAuthHelpers.returnToAddPhone();
    case 'ENSURE_SIGNUP_ENTRY_READY':
      return await ensureSignupEntryReady();
    case 'ENSURE_SIGNUP_PHONE_ENTRY_READY':
      return await ensureSignupPhoneEntryReady();
    case 'ENSURE_SIGNUP_PASSWORD_PAGE_READY':
      return await ensureSignupPasswordPageReady();
    case 'STEP8_FIND_AND_CLICK':
      return await step8_findAndClick(message.payload);
    case 'STEP8_GET_STATE':
      return getStep8State();
    case 'STEP8_TRIGGER_CONTINUE':
      return await step8_triggerContinue(message.payload);
  }
}

function resolveVisibleStep(payload = {}, fallback = 0) {
  const step = Math.floor(Number(payload?.visibleStep) || 0);
  return step > 0 ? step : fallback;
}

function stepLog(step, message, level = 'info', stepKey = '') {
  return log(message, level, { step, stepKey });
}

const VERIFICATION_CODE_INPUT_SELECTOR = [
  'input[name="code"]',
  'input[name="otp"]',
  'input[autocomplete="one-time-code"]',
  'input[type="text"][maxlength="6"]',
  'input[type="tel"][maxlength="6"]',
  'input[aria-label*="code" i]',
  'input[aria-label*="コード"]',
  'input[aria-label*="認証"]',
  'input[aria-label*="確認"]',
  'input[placeholder*="code" i]',
  'input[placeholder*="コード"]',
  'input[placeholder*="認証"]',
  'input[placeholder*="確認"]',
  'input[inputmode="numeric"]',
].join(', ');

const ONE_TIME_CODE_LOGIN_PATTERN = /使用一次性验证码登录|改用(?:一次性)?验证码(?:登录)?|使用验证码登录|一次性验证码|验证码登录|ワンタイム(?:コード|パスコード)|一回限りの?(?:コード|パスコード)|(?:認証|確認)?コード(?:で|を使用して)?(?:ログイン|サインイン)|one[-\s]*time\s*(?:passcode|password|code)|use\s+(?:a\s+)?one[-\s]*time\s*(?:passcode|password|code)(?:\s+instead)?|use\s+(?:a\s+)?code(?:\s+instead)?|sign\s+in\s+with\s+(?:email|code)|email\s+(?:me\s+)?(?:a\s+)?code/i;
const LOGIN_ENTRY_ACTION_PATTERN = /(?:^|\b)(?:log\s*in|sign\s*in|continue\s+(?:with|using)\s+(?:email|chatgpt)|use\s+(?:an?\s+)?email|email\s+address)(?:\b|$)|登录|登陆|邮箱|电子邮件|ログイン|サインイン|メールアドレス|メール|電子メール/i;
const LOGIN_SWITCH_TO_PHONE_PATTERN = /继续使用(?:手机|手机号|电话)(?:号码)?登录|改用(?:手机|手机号|电话)(?:号码)?登录|手机号登录|(?:電話番号|電話|携帯電話|携帯)(?:で|を使用して)?(?:続行|続ける|ログイン|サインイン)|(?:続行|続ける|使用|ログイン|サインイン).*(?:電話番号|電話|携帯電話|携帯)|continue\s+(?:with|using)\s+(?:a\s+)?phone(?:\s+number)?|use\s+(?:a\s+)?phone(?:\s+number)?(?:\s+instead)?|sign\s*in\s+with\s+(?:a\s+)?phone/i;
const LOGIN_PHONE_ACTION_PATTERN = /手机|电话|phone|telephone|電話番号|電話|携帯電話|携帯/i;
const LOGIN_PHONE_ENTRY_PAGE_PATTERN = /(?:\+\s*\(?\d{1,4}\)?\s*)?(?:手机号码|手机号|电话号码|電話番号|携帯電話番号|携帯番号)|(?:phone|mobile)\s+number|telephone/i;
const LOGIN_MORE_OPTIONS_PATTERN = /更多(?:选项|登录方式|方式)|其他(?:登录方式|选项|方式)|显示更多|その他|他の(?:ログイン)?方法|別の(?:ログイン)?方法|もっと見る|オプション|more\s+(?:login\s+|sign[-\s]*in\s+)?options|other\s+(?:login\s+|sign[-\s]*in\s+)?(?:options|ways)|show\s+more/i;
const LOGIN_EXTERNAL_IDP_PATTERN = /google|microsoft|apple|sso|single\s+sign[-\s]*on|企业|工作区|workspace/i;
const LOGIN_CODE_ONLY_ACTION_PATTERN = /one[-\s]*time|passcode|use\s+(?:a\s+)?code|验证码|一次性|ワンタイム|パスコード|認証コード|確認コード/i;

const RESEND_VERIFICATION_CODE_PATTERN = /重新发送(?:验证码)?|再次发送(?:验证码)?|重发(?:验证码)?|未收到(?:验证码|邮件)|(?:コード|メール|確認コード|認証コード)(?:を)?再送信|再送信|新しい(?:コード|確認コード|認証コード)|届かない|受信していません|resend(?:\s+code)?|send\s+(?:a\s+)?new\s+code|send\s+(?:it\s+)?again|request\s+(?:a\s+)?new\s+code|didn'?t\s+receive/i;
const PHONE_RESEND_SERVER_ERROR_PREFIX = 'PHONE_RESEND_SERVER_ERROR::';
const CONTACT_VERIFICATION_SERVER_ERROR_PATTERN = /this\s+page\s+isn['’]?t\s+working|currently\s+unable\s+to\s+handle\s+this\s+request|http\s+error\s+500|500\s+internal\s+server\s+error/i;

function isVisibleElement(el) {
  if (!el) return false;
  const style = window.getComputedStyle(el);
  const rect = el.getBoundingClientRect();
  return style.display !== 'none'
    && style.visibility !== 'hidden'
    && rect.width > 0
    && rect.height > 0;
}

function getVisibleSplitVerificationInputs() {
  return Array.from(document.querySelectorAll('input[maxlength="1"]'))
    .filter(isVisibleElement);
}

function getVerificationCodeTarget() {
  const splitInputs = getVisibleSplitVerificationInputs();
  const codeInput = document.querySelector(VERIFICATION_CODE_INPUT_SELECTOR);
  if (codeInput && isVisibleElement(codeInput)) {
    const maxLength = Number(codeInput.getAttribute?.('maxlength') || codeInput.maxLength || 0);
    if (maxLength === 1 && splitInputs.length >= 6) {
      return { type: 'split', elements: splitInputs };
    }
    return { type: 'single', element: codeInput };
  }

  if (splitInputs.length >= 6) {
    return { type: 'split', elements: splitInputs };
  }

  return null;
}

function getActionText(el) {
  return [
    el?.textContent,
    el?.value,
    el?.getAttribute?.('aria-label'),
    el?.getAttribute?.('title'),
  ]
    .filter(Boolean)
    .join(' ')
    .replace(/\s+/g, ' ')
    .trim();
}

function isActionEnabled(el) {
  return Boolean(el)
    && !el.disabled
    && el.getAttribute('aria-disabled') !== 'true';
}

function findOneTimeCodeLoginTrigger() {
  const candidates = document.querySelectorAll(
    'button, a, [role="button"], [role="link"], input[type="button"], input[type="submit"]'
  );

  for (const el of candidates) {
    if (!isVisibleElement(el)) continue;
    if (el.disabled || el.getAttribute('aria-disabled') === 'true') continue;

    const text = [
      el.textContent,
      el.value,
      el.getAttribute('aria-label'),
      el.getAttribute('title'),
    ]
      .filter(Boolean)
      .join(' ')
      .replace(/\s+/g, ' ')
      .trim();

    if (text && ONE_TIME_CODE_LOGIN_PATTERN.test(text)) {
      return el;
    }
  }

  return null;
}

function findResendVerificationCodeTrigger({ allowDisabled = false } = {}) {
  const candidates = document.querySelectorAll(
    'button, a, [role="button"], [role="link"], input[type="button"], input[type="submit"]'
  );

  for (const el of candidates) {
    if (!isVisibleElement(el)) continue;
    if (!allowDisabled && !isActionEnabled(el)) continue;

    const text = getActionText(el);
    if (text && RESEND_VERIFICATION_CODE_PATTERN.test(text)) {
      return el;
    }
  }

  return null;
}

function isEmailVerificationPage() {
  return /\/email-verification(?:[/?#]|$)/i.test(location.pathname || '');
}

function getContactVerificationServerErrorText() {
  const path = String(location?.pathname || '');
  if (!/\/contact-verification(?:[/?#]|$)/i.test(path)) {
    return '';
  }
  const text = String(getPageTextSnapshot?.() || document?.body?.textContent || '').replace(/\s+/g, ' ').trim();
  const title = String(document?.title || '').replace(/\s+/g, ' ').trim();
  const combined = `${title} ${text}`.trim();
  if (!CONTACT_VERIFICATION_SERVER_ERROR_PATTERN.test(combined)) {
    return '';
  }
  return combined || 'OpenAI contact-verification page returned HTTP ERROR 500 after resend.';
}

function buildContactVerificationServerError(errorText = '') {
  const serverErrorPrefix = typeof PHONE_RESEND_SERVER_ERROR_PREFIX === 'string'
    ? PHONE_RESEND_SERVER_ERROR_PREFIX
    : 'PHONE_RESEND_SERVER_ERROR::';
  const resolvedText = String(errorText || '').trim()
    || 'OpenAI contact-verification 页面返回 HTTP ERROR 500。';
  return new Error(
    resolvedText.startsWith(serverErrorPrefix)
      ? resolvedText
      : `${serverErrorPrefix}${resolvedText}`
  );
}

function throwIfContactVerificationServerError() {
  const serverErrorText = getContactVerificationServerErrorText();
  if (serverErrorText) {
    throw buildContactVerificationServerError(serverErrorText);
  }
}

async function resendVerificationCode(step, timeout = 45000) {
  const performOperationWithDelay = typeof getOperationDelayRunner === 'function'
    ? getOperationDelayRunner()
    : async (metadata, operation) => {
        const rootScope = typeof window !== 'undefined' ? window : globalThis;
        const gate = rootScope?.CodexOperationDelay?.performOperationWithDelay;
        return typeof gate === 'function' ? gate(metadata, operation) : operation();
      };
  if (step === 8) {
    await waitForLoginVerificationPageReady(10000, step);
  }

  const start = Date.now();
  let action = null;
  let loggedWaiting = false;

  while (Date.now() - start < timeout) {
    throwIfStopped();
    throwIfContactVerificationServerError();

    // Check for 405 error page and recover by clicking "Try again"
    if (is405MethodNotAllowedPage()) {
      await handle405ResendError(step, timeout - (Date.now() - start));
      // After recovery, loop back to find the resend button again
      loggedWaiting = false;
      continue;
    }

    action = findResendVerificationCodeTrigger({ allowDisabled: true });

    if (action && isActionEnabled(action)) {
      log(`步骤 ${step}：重新发送验证码按钮已可用。`);
      await humanPause(350, 900);
      await performOperationWithDelay({ stepKey: step === 8 ? 'oauth-login' : 'fetch-signup-code', kind: 'click', label: 'resend-verification-code' }, async () => {
        simulateClick(action);
      });
      await sleep(1200);

      // After clicking resend, check if 405 error appeared
      if (is405MethodNotAllowedPage()) {
        log(`步骤 ${step}：点击重新发送后出现 405 错误，正在恢复...`, 'warn');
        await handle405ResendError(step, timeout - (Date.now() - start));
        loggedWaiting = false;
        continue;
      }
      throwIfContactVerificationServerError();

      return {
        resent: true,
        buttonText: getActionText(action),
      };
    }

    if (action && !loggedWaiting) {
      loggedWaiting = true;
      log(`步骤 ${step}：正在等待重新发送验证码按钮变为可点击...`);
    }

    await sleep(250);
  }

  throwIfContactVerificationServerError();
  throw new Error('无法点击重新发送验证码按钮。URL: ' + location.href);
}

function is405MethodNotAllowedPage() {
  const pageText = document.body?.textContent || '';
  return AUTH_ROUTE_ERROR_PATTERN.test(pageText);
}

function getStep405RecoveryStateKey(step) {
  return `__MULTIPAGE_STEP_${Number(step) || '?'}_405_RECOVERY_COUNT__`;
}

function getStep405StorageScope() {
  if (typeof window !== 'undefined' && window) {
    return window;
  }
  if (typeof globalThis !== 'undefined' && globalThis) {
    return globalThis;
  }
  return {};
}

function getStep405RecoveryLimit(step) {
  if (Number(step) !== 4) {
    return 0;
  }
  return typeof STEP4_405_RECOVERY_LIMIT !== 'undefined'
    ? STEP4_405_RECOVERY_LIMIT
    : 3;
}

function getStep405RecoveryErrorPrefix(step) {
  if (Number(step) !== 4) {
    return '';
  }
  return typeof STEP4_405_RECOVERY_ERROR_PREFIX !== 'undefined'
    ? STEP4_405_RECOVERY_ERROR_PREFIX
    : 'STEP4_405_RECOVERY_LIMIT::';
}

function getStep405RecoveryCount(step) {
  const key = getStep405RecoveryStateKey(step);
  let value = '';
  try {
    if (typeof sessionStorage !== 'undefined' && sessionStorage?.getItem) {
      value = sessionStorage.getItem(key) || '';
    }
  } catch {}
  if (!value) {
    value = getStep405StorageScope()[key];
  }
  return Math.max(0, Math.floor(Number(value) || 0));
}

function setStep405RecoveryCount(step, count) {
  const key = getStep405RecoveryStateKey(step);
  const value = String(Math.max(0, Math.floor(Number(count) || 0)));
  try {
    if (typeof sessionStorage !== 'undefined' && sessionStorage?.setItem) {
      sessionStorage.setItem(key, value);
    }
  } catch {}
  getStep405StorageScope()[key] = value;
}

function clearStep405RecoveryCount(step) {
  const key = getStep405RecoveryStateKey(step);
  try {
    if (typeof sessionStorage !== 'undefined' && sessionStorage?.removeItem) {
      sessionStorage.removeItem(key);
    }
  } catch {}
  try {
    delete getStep405StorageScope()[key];
  } catch {}
}

function createStep405RecoveryLimitError(step, count) {
  const normalizedStep = Number(step) || step || '?';
  const limit = getStep405RecoveryLimit(normalizedStep) || count;
  const message = `步骤 ${normalizedStep}：检测到 405 错误页面，已连续点击“重试”恢复 ${count}/${limit} 次仍未恢复，当前轮将结束并进入下一轮。URL: ${location.href}`;
  return new Error(`${getStep405RecoveryErrorPrefix(normalizedStep)}${message}`);
}

async function handle405ResendError(step, remainingTimeout = 30000) {
  const currentCount = getStep405RecoveryCount(step);
  if (Number(step) === 4 && currentCount >= getStep405RecoveryLimit(step)) {
    throw createStep405RecoveryLimitError(step, currentCount);
  }

  const nextCount = currentCount + 1;
  setStep405RecoveryCount(step, nextCount);
  const maxClickAttempts = Number(step) === 4 ? 1 : 5;
  await recoverCurrentAuthRetryPage({
    logLabel: Number(step) === 4
      ? `步骤 ${step}：检测到 405 错误页面，正在点击“重试”恢复（总计 ${nextCount}/${getStep405RecoveryLimit(step)}）`
      : `步骤 ${step}：检测到 405 错误页面，正在点击“重试”恢复`,
    maxClickAttempts,
    pathPatterns: [],
    step,
    timeoutMs: Math.max(1000, remainingTimeout),
  });
  if (is405MethodNotAllowedPage()) {
    throw createStep405RecoveryLimitError(step, nextCount);
  }
  if (typeof clearStep405RecoveryCount === 'function') clearStep405RecoveryCount(step);
  log(`步骤 ${step}：405 错误已恢复，页面已返回验证码页面。`);
}

// ============================================================
// Signup Entry Helpers
// ============================================================

const SIGNUP_ENTRY_TRIGGER_PATTERN = /免费注册|立即注册|注册|無料でサインアップ|サインアップ|新規登録|登録する|登録|アカウントを作成|アカウント作成|sign\s*up|register|create\s*account|create\s+account/i;
const SIGNUP_EMAIL_INPUT_SELECTOR = [
  'input[type="email"]',
  'input[autocomplete="email"]',
  'input[autocomplete="username"]',
  'input[name="email"]',
  'input[name="username"]',
  'input[id*="email"]',
  'input[placeholder*="email" i]',
  'input[placeholder*="电子邮件"]',
  'input[placeholder*="邮箱"]',
  'input[placeholder*="メール"]',
  'input[aria-label*="email" i]',
  'input[aria-label*="电子邮件"]',
  'input[aria-label*="邮箱"]',
  'input[aria-label*="メール"]',
].join(', ');
const SIGNUP_PHONE_INPUT_SELECTOR = [
  'input[type="tel"]:not([maxlength="6"])',
  'input[name*="phone" i]',
  'input[id*="phone" i]',
  'input[autocomplete="tel"]',
  'input[placeholder*="手机"]',
  'input[placeholder*="電話"]',
  'input[placeholder*="携帯"]',
  'input[aria-label*="手机"]',
  'input[aria-label*="電話"]',
  'input[aria-label*="携帯"]',
].join(', ');
const SIGNUP_SWITCH_TO_EMAIL_PATTERN = new RegExp([
  String.raw`\u7ee7\u7eed\u4f7f\u7528(?:\u7535\u5b50\u90ae\u4ef6\u5730\u5740|\u90ae\u7bb1)\u767b\u5f55`,
  String.raw`\u6539\u7528(?:\u7535\u5b50\u90ae\u4ef6\u5730\u5740|\u90ae\u7bb1)\u767b\u5f55`,
  String.raw`(?:メールアドレス|メール|電子メール)(?:で|を使用して)?(?:続行|続ける|ログイン|サインイン|サインアップ)`,
  String.raw`(?:続行|続ける|使用|ログイン|サインイン|サインアップ).*(?:メールアドレス|メール|電子メール)`,
  String.raw`continue\s+using\s+(?:an?\s+)?email(?:\s+address)?(?:\s+(?:to\s+)?(?:log\s*in|sign\s*in|sign\s*up))?`,
  String.raw`continue\s+with\s+email(?:\s+address)?`,
  String.raw`use\s+(?:an?\s+)?email(?:\s+address)?(?:\s+instead)?`,
  String.raw`sign\s*(?:in|up)\s+with\s+email`,
].join('|'), 'i');
const SIGNUP_SWITCH_ACTION_PATTERN = /\u7ee7\u7eed\u4f7f\u7528|\u6539\u7528|continue|use|sign\s*(?:in|up)|続行|続ける|使用|ログイン|サイン(?:イン|アップ)/i;
const SIGNUP_EMAIL_ACTION_PATTERN = /\u7535\u5b50\u90ae\u4ef6|\u90ae\u7bb1|email|メールアドレス|メール|電子メール/i;
const SIGNUP_PHONE_ACTION_PATTERN = /手机|手机号|电话号码|phone|telephone|mobile|電話番号|電話|携帯電話|携帯/i;
const SIGNUP_SWITCH_TO_PHONE_PATTERN = new RegExp([
  String.raw`\u7ee7\u7eed\u4f7f\u7528(?:\u624b\u673a|\u624b\u673a\u53f7|\u7535\u8bdd\u53f7\u7801)(?:\u53f7\u7801)?\u767b\u5f55`,
  String.raw`\u6539\u7528(?:\u624b\u673a|\u624b\u673a\u53f7|\u7535\u8bdd\u53f7\u7801)(?:\u53f7\u7801)?\u767b\u5f55`,
  String.raw`\u7ee7\u7eed\u4f7f\u7528(?:\u624b\u673a|\u624b\u673a\u53f7|\u624b\u673a\u53f7\u7801|\u7535\u8bdd\u53f7\u7801)(?:\u53f7\u7801)?`,
  String.raw`\u6539\u7528(?:\u624b\u673a|\u624b\u673a\u53f7|\u624b\u673a\u53f7\u7801|\u7535\u8bdd\u53f7\u7801)(?:\u53f7\u7801)?`,
  String.raw`\u4f7f\u7528(?:\u624b\u673a|\u624b\u673a\u53f7|\u624b\u673a\u53f7\u7801|\u7535\u8bdd\u53f7\u7801)(?:\u53f7\u7801)?`,
  String.raw`(?:電話番号|電話|携帯電話|携帯)(?:で|を使用して)?(?:続行|続ける|ログイン|サインイン|サインアップ)`,
  String.raw`(?:続行|続ける|使用|ログイン|サインイン|サインアップ).*(?:電話番号|電話|携帯電話|携帯)`,
  String.raw`continue\s+(?:with|using)\s+(?:a\s+)?phone(?:\s+number)?`,
  String.raw`use\s+(?:a\s+)?phone(?:\s+number)?(?:\s+instead)?`,
  String.raw`sign\s*(?:in|up)\s+with\s+(?:a\s+)?phone`,
].join('|'), 'i');
const SIGNUP_MORE_OPTIONS_PATTERN = /更多选项|其它方式|其他方式|その他|他の方法|別の方法|もっと見る|オプション|more\s+options|show\s+more|other\s+(?:options|ways)/i;
const SIGNUP_WORK_EMAIL_PATTERN = /\u5de5\u4f5c|business|work\s+email/i;

function getSignupEmailInput() {
  const input = document.querySelector(SIGNUP_EMAIL_INPUT_SELECTOR);
  if (input && isVisibleElement(input)) {
    return input;
  }

  const fallback = Array.from(document.querySelectorAll('input')).find((el) => {
    if (!isVisibleElement(el)) return false;
    const type = String(el.getAttribute?.('type') || '').trim().toLowerCase();
    const name = String(el.getAttribute?.('name') || '').trim().toLowerCase();
    const id = String(el.getAttribute?.('id') || '').trim().toLowerCase();
    const placeholder = String(el.getAttribute?.('placeholder') || '').trim();
    const ariaLabel = String(el.getAttribute?.('aria-label') || '').trim();
    const autocomplete = String(el.getAttribute?.('autocomplete') || '').trim().toLowerCase();
    const combinedText = `${placeholder} ${ariaLabel}`;
    return type === 'email'
      || autocomplete === 'email'
      || autocomplete === 'username'
      || /email|username|mail/i.test(`${name} ${id}`)
      || /email|电子邮件|邮箱|メール|電子メール/i.test(combinedText);
  });

  return fallback || null;
}

function getSignupPhoneInput() {
  const input = document.querySelector(SIGNUP_PHONE_INPUT_SELECTOR);
  if (input && isVisibleElement(input)) {
    return input;
  }

  const fallback = Array.from(document.querySelectorAll('input')).find((el) => {
    if (!isVisibleElement(el)) return false;
    const type = String(el.getAttribute?.('type') || '').trim().toLowerCase();
    const name = String(el.getAttribute?.('name') || '').trim().toLowerCase();
    const id = String(el.getAttribute?.('id') || '').trim().toLowerCase();
    const placeholder = String(el.getAttribute?.('placeholder') || '').trim();
    const ariaLabel = String(el.getAttribute?.('aria-label') || '').trim();
    const autocomplete = String(el.getAttribute?.('autocomplete') || '').trim().toLowerCase();
    const combinedText = `${placeholder} ${ariaLabel}`;
    return type === 'tel'
      || autocomplete === 'tel'
      || /phone|tel/i.test(`${name} ${id}`)
      || /手机|电话|手机号|電話|電話番号|携帯|携帯電話/.test(combinedText);
  });

  return fallback || null;
}

function findSignupUseEmailTrigger() {
  const candidates = document.querySelectorAll('button, a, [role="button"], [role="link"]');
  return Array.from(candidates).find((el) => {
    if (!isVisibleElement(el) || !isActionEnabled(el)) return false;
    const text = getActionText(el);
    if (!text) return false;
    if (SIGNUP_WORK_EMAIL_PATTERN.test(text)) return false;
    return SIGNUP_SWITCH_TO_EMAIL_PATTERN.test(text)
      || (SIGNUP_SWITCH_ACTION_PATTERN.test(text) && SIGNUP_EMAIL_ACTION_PATTERN.test(text));
  }) || null;
}

function findSignupUsePhoneTrigger() {
  const candidates = document.querySelectorAll('button, a, [role="button"], [role="link"]');
  return Array.from(candidates).find((el) => {
    if (!isVisibleElement(el) || !isActionEnabled(el)) return false;
    const text = getActionText(el);
    if (!text) return false;
    return SIGNUP_SWITCH_TO_PHONE_PATTERN.test(text)
      || (SIGNUP_SWITCH_ACTION_PATTERN.test(text) && SIGNUP_PHONE_ACTION_PATTERN.test(text));
  }) || null;
}

function findSignupMoreOptionsTrigger() {
  const candidates = document.querySelectorAll('button, a, [role="button"], [role="link"]');
  return Array.from(candidates).find((el) => {
    if (!isVisibleElement(el) || !isActionEnabled(el)) return false;
    const text = getActionText(el);
    if (!text || !SIGNUP_MORE_OPTIONS_PATTERN.test(text)) return false;
    const expanded = String(el.getAttribute?.('aria-expanded') || '').trim().toLowerCase();
    const state = String(el.getAttribute?.('data-state') || '').trim().toLowerCase();
    return expanded !== 'true' && state !== 'open';
  }) || null;
}

function getSignupEmailContinueButton({ allowDisabled = false } = {}) {
  const direct = document.querySelector('button[type="submit"], input[type="submit"]');
  if (direct && isVisibleElement(direct) && (allowDisabled || isActionEnabled(direct))) {
    return direct;
  }

  const candidates = document.querySelectorAll(
    'button, a, [role="button"], [role="link"], input[type="button"], input[type="submit"]'
  );
  return Array.from(candidates).find((el) => {
    if (!isVisibleElement(el) || (!allowDisabled && !isActionEnabled(el))) return false;
    return /continue|next|submit|继续|下一步|続行|続ける|次へ|送信/i.test(getActionText(el));
  }) || null;
}

function findSignupEntryTrigger(options = {}) {
  const { allowHiddenFallback = true } = options || {};
  const candidates = document.querySelectorAll('a, button, [role="button"], [role="link"]');
  let hiddenSignupTrigger = null;

  for (const el of Array.from(candidates)) {
    if (!isActionEnabled(el)) continue;
    if (!SIGNUP_ENTRY_TRIGGER_PATTERN.test(getActionText(el))) continue;
    if (isVisibleElement(el)) {
      return el;
    }
    if (!hiddenSignupTrigger) {
      hiddenSignupTrigger = el;
    }
  }

  if (!allowHiddenFallback || !hiddenSignupTrigger) {
    return null;
  }

  const view = typeof window !== 'undefined' ? window : globalThis;
  const collapsedViewport = Boolean(
    Math.round(Number(view?.innerWidth) || 0) < 240
    || Math.round(Number(view?.innerHeight) || 0) < 160
    || Math.round(Number(view?.outerWidth) || 0) < 320
    || Math.round(Number(view?.outerHeight) || 0) < 180
  );
  const pageText = typeof getPageTextSnapshot === 'function'
    ? getPageTextSnapshot()
    : '';
  const looksLikeLoggedOutHome = /登录|登入|ログイン|サインイン|log\s*in|sign\s*in/i.test(pageText);
  return collapsedViewport || looksLikeLoggedOutHome ? hiddenSignupTrigger : null;
}

function getSignupPasswordDisplayedEmail() {
  const text = (document.body?.innerText || document.body?.textContent || '')
    .replace(/\s+/g, ' ')
    .trim();
  const matches = text.match(/[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}/ig);
  return matches?.[0] ? String(matches[0]).trim().toLowerCase() : '';
}

function inspectSignupEntryState() {
  if (typeof isPhoneVerificationPageReady === 'function' && isPhoneVerificationPageReady()) {
    return {
      state: 'phone_verification_page',
      verificationTarget: typeof getVerificationCodeTarget === 'function' ? getVerificationCodeTarget() : null,
      displayedPhone: typeof getPhoneVerificationDisplayedPhone === 'function' ? getPhoneVerificationDisplayedPhone() : '',
      url: location.href,
    };
  }

  const postVerificationState = typeof getStep4PostVerificationState === 'function'
    ? getStep4PostVerificationState()
    : null;
  if (postVerificationState?.state === 'step5') {
    return {
      state: 'profile_page',
      url: postVerificationState.url || location.href,
    };
  }

  if (postVerificationState?.state === 'logged_in_home') {
    return {
      state: 'logged_in_home',
      skipProfileStep: true,
      url: postVerificationState.url || location.href,
    };
  }

  if (typeof isVerificationPageStillVisible === 'function' && isVerificationPageStillVisible()) {
    return {
      state: 'verification_page',
      verificationTarget: typeof getVerificationCodeTarget === 'function' ? getVerificationCodeTarget() : null,
      url: location.href,
    };
  }

  const passwordInput = getSignupPasswordInput();
  if (isSignupPasswordPage() && passwordInput) {
    return {
      state: 'password_page',
      passwordInput,
      submitButton: getSignupPasswordSubmitButton({ allowDisabled: true }),
      displayedEmail: getSignupPasswordDisplayedEmail(),
      passwordErrorText: getSignupPasswordFieldErrorText(),
      url: location.href,
    };
  }

  const emailInput = getSignupEmailInput();
  if (emailInput) {
    return {
      state: 'email_entry',
      emailInput,
      continueButton: getSignupEmailContinueButton({ allowDisabled: true }),
      switchToPhoneTrigger: findSignupUsePhoneTrigger(),
      url: location.href,
    };
  }

  const phoneInput = getSignupPhoneInput();
  if (phoneInput) {
    return {
      state: 'phone_entry',
      phoneInput,
      switchToEmailTrigger: findSignupUseEmailTrigger(),
      url: location.href,
    };
  }

  const signupTrigger = findSignupEntryTrigger();
  if (signupTrigger) {
    return {
      state: 'entry_home',
      signupTrigger,
      url: location.href,
    };
  }

  return {
    state: 'unknown',
    url: location.href,
  };
}

function getSignupEntryStateSummary(snapshot = inspectSignupEntryState()) {
  const summary = {
    state: snapshot?.state || 'unknown',
    url: snapshot?.url || location.href,
    hasEmailInput: Boolean(snapshot?.emailInput || getSignupEmailInput()),
    hasPhoneInput: Boolean(snapshot?.phoneInput || getSignupPhoneInput()),
    hasPasswordInput: Boolean(snapshot?.passwordInput || getSignupPasswordInput()),
  };

  if (snapshot?.displayedEmail) {
    summary.displayedEmail = snapshot.displayedEmail;
  }

  if (snapshot?.signupTrigger) {
    summary.signupTrigger = {
      tag: (snapshot.signupTrigger.tagName || '').toLowerCase(),
      text: getActionText(snapshot.signupTrigger).slice(0, 80),
      visible: isVisibleElement(snapshot.signupTrigger),
    };
  }

  if (snapshot?.continueButton) {
    summary.continueButton = {
      tag: (snapshot.continueButton.tagName || '').toLowerCase(),
      text: getActionText(snapshot.continueButton).slice(0, 80),
      enabled: isActionEnabled(snapshot.continueButton),
    };
  }

  if (snapshot?.switchToEmailTrigger) {
    summary.switchToEmailTrigger = {
      tag: (snapshot.switchToEmailTrigger.tagName || '').toLowerCase(),
      text: getActionText(snapshot.switchToEmailTrigger).slice(0, 80),
      enabled: isActionEnabled(snapshot.switchToEmailTrigger),
    };
  }

  if (snapshot?.switchToPhoneTrigger) {
    summary.switchToPhoneTrigger = {
      tag: (snapshot.switchToPhoneTrigger.tagName || '').toLowerCase(),
      text: getActionText(snapshot.switchToPhoneTrigger).slice(0, 80),
      enabled: isActionEnabled(snapshot.switchToPhoneTrigger),
    };
  }

  return summary;
}

function getSignupEntryDiagnostics() {
  const view = typeof window !== 'undefined' ? window : globalThis;
  const safeGetComputedStyle = (el) => {
    if (!el || typeof view?.getComputedStyle !== 'function') {
      return null;
    }
    try {
      return view.getComputedStyle(el);
    } catch {
      return null;
    }
  };
  const buildRectSummary = (el) => {
    const rect = typeof el?.getBoundingClientRect === 'function'
      ? el.getBoundingClientRect()
      : null;
    return rect
      ? {
          width: Math.round(rect.width || 0),
          height: Math.round(rect.height || 0),
        }
      : null;
  };
  const buildVisibilityMeta = (el) => {
    const style = safeGetComputedStyle(el);
    return {
      className: String(el?.className || '').slice(0, 200),
      hidden: Boolean(el?.hidden),
      ariaHidden: el?.getAttribute?.('aria-hidden') || '',
      inert: typeof el?.hasAttribute === 'function' ? el.hasAttribute('inert') : false,
      display: style?.display || '',
      visibility: style?.visibility || '',
      opacity: style?.opacity || '',
      pointerEvents: style?.pointerEvents || '',
    };
  };
  const findBlockingAncestor = (el) => {
    let current = el?.parentElement || null;
    while (current) {
      const style = safeGetComputedStyle(current);
      const rect = buildRectSummary(current);
      const hidden = Boolean(current.hidden);
      const ariaHidden = current.getAttribute?.('aria-hidden') || '';
      const inert = typeof current.hasAttribute === 'function' ? current.hasAttribute('inert') : false;
      const blockedByStyle = Boolean(
        style
        && (
          style.display === 'none'
          || style.visibility === 'hidden'
          || style.opacity === '0'
          || style.pointerEvents === 'none'
        )
      );
      const blockedByRect = Boolean(rect && (rect.width === 0 || rect.height === 0));
      if (hidden || ariaHidden === 'true' || inert || blockedByStyle || blockedByRect) {
        return {
          tag: (current.tagName || '').toLowerCase(),
          id: current.id || '',
          className: String(current.className || '').slice(0, 200),
          hidden,
          ariaHidden,
          inert,
          display: style?.display || '',
          visibility: style?.visibility || '',
          opacity: style?.opacity || '',
          pointerEvents: style?.pointerEvents || '',
          rect,
        };
      }
      current = current.parentElement;
    }
    return null;
  };
  const actionCandidates = document.querySelectorAll(
    'a, button, [role="button"], [role="link"], input[type="button"], input[type="submit"]'
  );
  const allActions = Array.from(actionCandidates).map((el) => {
    const text = getActionText(el);
    return {
      tag: (el.tagName || '').toLowerCase(),
      type: el.getAttribute?.('type') || '',
      text: text.slice(0, 80),
      visible: isVisibleElement(el),
      enabled: isActionEnabled(el),
      rect: buildRectSummary(el),
    };
  });
  const visibleActions = Array.from(actionCandidates)
    .filter(isVisibleElement)
    .slice(0, 12)
    .map((el) => ({
      tag: (el.tagName || '').toLowerCase(),
      type: el.getAttribute?.('type') || '',
      text: getActionText(el).slice(0, 80),
      enabled: isActionEnabled(el),
    }))
    .filter((item) => item.text);
  const signupLikeActions = Array.from(actionCandidates)
    .map((el) => {
      const text = getActionText(el);
      return {
        tag: (el.tagName || '').toLowerCase(),
        type: el.getAttribute?.('type') || '',
        text: text.slice(0, 80),
        visible: isVisibleElement(el),
        enabled: isActionEnabled(el),
        rect: buildRectSummary(el),
        ...buildVisibilityMeta(el),
        blockingAncestor: findBlockingAncestor(el),
      };
    })
    .filter((item) => item.text && SIGNUP_ENTRY_TRIGGER_PATTERN.test(item.text))
    .slice(0, 12);

  return {
    url: location.href,
    title: document.title || '',
    readyState: document.readyState || '',
    viewport: {
      innerWidth: Math.round(Number(view?.innerWidth) || 0),
      innerHeight: Math.round(Number(view?.innerHeight) || 0),
      outerWidth: Math.round(Number(view?.outerWidth) || 0),
      outerHeight: Math.round(Number(view?.outerHeight) || 0),
      devicePixelRatio: Number(view?.devicePixelRatio) || 0,
    },
    hasEmailInput: Boolean(getSignupEmailInput()),
    hasPhoneInput: Boolean(getSignupPhoneInput()),
    hasPasswordInput: Boolean(getSignupPasswordInput()),
    hasSwitchToEmailAction: Boolean(findSignupUseEmailTrigger()),
    bodyContainsSignupText: SIGNUP_ENTRY_TRIGGER_PATTERN.test(getPageTextSnapshot()),
    signupLikeActionCounts: {
      total: signupLikeActions.length,
      visible: signupLikeActions.filter((item) => item.visible).length,
      hidden: signupLikeActions.filter((item) => !item.visible).length,
    },
    signupLikeActions,
    visibleActions,
    bodyTextPreview: getPageTextSnapshot().slice(0, 240),
  };
}

function getSignupPasswordDiagnostics() {
  const view = typeof window !== 'undefined' ? window : globalThis;
  const safeGetComputedStyle = (el) => {
    if (!el || typeof view?.getComputedStyle !== 'function') {
      return null;
    }
    try {
      return view.getComputedStyle(el);
    } catch {
      return null;
    }
  };
  const buildRectSummary = (el) => {
    const rect = typeof el?.getBoundingClientRect === 'function'
      ? el.getBoundingClientRect()
      : null;
    return rect
      ? {
          width: Math.round(rect.width || 0),
          height: Math.round(rect.height || 0),
        }
      : null;
  };
  const buildInputSummary = (el) => {
    const style = safeGetComputedStyle(el);
    return {
      tag: (el?.tagName || '').toLowerCase(),
      type: el?.getAttribute?.('type') || el?.type || '',
      name: el?.getAttribute?.('name') || el?.name || '',
      id: el?.id || '',
      autocomplete: el?.getAttribute?.('autocomplete') || '',
      placeholder: String(el?.getAttribute?.('placeholder') || '').slice(0, 80),
      visible: isVisibleElement(el),
      enabled: isActionEnabled(el),
      valueLength: String(el?.value || '').length,
      rect: buildRectSummary(el),
      className: String(el?.className || '').slice(0, 200),
      display: style?.display || '',
      visibility: style?.visibility || '',
      opacity: style?.opacity || '',
      pointerEvents: style?.pointerEvents || '',
      formAction: el?.form?.action || '',
    };
  };
  const buildActionSummary = (el) => {
    const style = safeGetComputedStyle(el);
    return {
      tag: (el?.tagName || '').toLowerCase(),
      type: el?.getAttribute?.('type') || el?.type || '',
      role: el?.getAttribute?.('role') || '',
      text: getActionText(el).slice(0, 120),
      visible: isVisibleElement(el),
      enabled: isActionEnabled(el),
      rect: buildRectSummary(el),
      className: String(el?.className || '').slice(0, 200),
      display: style?.display || '',
      visibility: style?.visibility || '',
      opacity: style?.opacity || '',
      pointerEvents: style?.pointerEvents || '',
      dataDdActionName: el?.getAttribute?.('data-dd-action-name') || '',
      formAction: el?.form?.action || '',
    };
  };
  const passwordInputs = Array.from(document.querySelectorAll(
    'input[type="password"], input[name*="password" i], input[autocomplete="new-password"], input[autocomplete="current-password"]'
  ))
    .map(buildInputSummary)
    .slice(0, 8);
  const actionCandidates = Array.from(document.querySelectorAll(
    'button, a, [role="button"], [role="link"], input[type="button"], input[type="submit"]'
  ))
    .map(buildActionSummary)
    .filter((item) => item.text)
    .slice(0, 16);
  const visibleActions = actionCandidates.filter((item) => item.visible).slice(0, 12);
  const submitButton = getSignupPasswordSubmitButton({ allowDisabled: true });
  const oneTimeCodeTrigger = findOneTimeCodeLoginTrigger();
  const retryState = getSignupPasswordTimeoutErrorPageState();

  return {
    url: location.href,
    title: document.title || '',
    readyState: document.readyState || '',
    displayedEmail: getSignupPasswordDisplayedEmail(),
    passwordErrorText: getSignupPasswordFieldErrorText(),
    hasVisiblePasswordInput: Boolean(getSignupPasswordInput()),
    passwordInputCount: passwordInputs.length,
    visiblePasswordInputCount: passwordInputs.filter((item) => item.visible).length,
    passwordInputs,
    submitButton: submitButton ? buildActionSummary(submitButton) : null,
    oneTimeCodeTrigger: oneTimeCodeTrigger ? buildActionSummary(oneTimeCodeTrigger) : null,
    retryPage: Boolean(retryState),
    retryEnabled: Boolean(retryState?.retryEnabled),
    userAlreadyExistsBlocked: Boolean(retryState?.userAlreadyExistsBlocked),
    visibleActions,
    bodyTextPreview: getPageTextSnapshot().slice(0, 240),
  };
}

function logSignupPasswordDiagnostics(context, level = 'warn') {
  try {
    log(`${context}：密码页诊断快照：${JSON.stringify(getSignupPasswordDiagnostics())}`, level);
  } catch (error) {
    console.warn('[MultiPage:openai-auth] failed to build signup password diagnostics:', error?.message || error);
  }
}

async function waitForSignupEntryState(options = {}) {
  const performOperationWithDelay = typeof getOperationDelayRunner === 'function'
    ? getOperationDelayRunner()
    : async (metadata, operation) => {
        const rootScope = typeof window !== 'undefined' ? window : globalThis;
        const gate = rootScope?.CodexOperationDelay?.performOperationWithDelay;
        return typeof gate === 'function' ? gate(metadata, operation) : operation();
      };
  const {
    timeout = 15000,
    autoOpenEntry = false,
    step = 2,
    logDiagnostics = false,
  } = options;
  const start = Date.now();
  const maxSignupEntryClickRetries = 5;
  const maxSignupEntryClickAttempts = maxSignupEntryClickRetries + 1;
  let lastTriggerClickAt = 0;
  let clickAttempts = 0;
  let lastState = '';
  let slowSnapshotLogged = false;
  let lastSwitchToEmailAt = 0;
  let loggedMissingSwitchToEmail = false;

  while (Date.now() - start < timeout) {
    throwIfStopped();
    const snapshot = inspectSignupEntryState();

    if (logDiagnostics && snapshot.state !== lastState) {
      lastState = snapshot.state;
      log(`步骤 ${step}：注册入口状态切换为 ${snapshot.state}，状态快照：${JSON.stringify(getSignupEntryStateSummary(snapshot))}`);
    }

    if (snapshot.state === 'password_page' || snapshot.state === 'email_entry') {
      return snapshot;
    }

    if (snapshot.state === 'phone_entry') {
      if (!autoOpenEntry) {
        return snapshot;
      }

      if (snapshot.switchToEmailTrigger && Date.now() - lastSwitchToEmailAt >= 1500) {
        lastSwitchToEmailAt = Date.now();
        loggedMissingSwitchToEmail = false;
        if (logDiagnostics) {
          log(`步骤 ${step}：检测到手机号输入模式，准备点击切换邮箱入口："${getActionText(snapshot.switchToEmailTrigger).slice(0, 80)}"`);
        }
        log('步骤 2：检测到手机号输入模式，正在切换到邮箱输入模式...');
        await humanPause(350, 900);
        await performOperationWithDelay({ stepKey: 'signup-entry', kind: 'click', label: 'switch-to-signup-email' }, async () => {
          simulateClick(snapshot.switchToEmailTrigger);
        });
      } else if (!snapshot.switchToEmailTrigger && !loggedMissingSwitchToEmail) {
        loggedMissingSwitchToEmail = true;
        log('步骤 2：检测到手机号输入模式，但暂未识别到“改用邮箱/继续使用电子邮件地址登录”按钮，继续等待界面稳定...', 'warn');
      }

      if (logDiagnostics && !slowSnapshotLogged && Date.now() - start >= 5000) {
        slowSnapshotLogged = true;
        log(`步骤 ${step}：等待手机号入口切换超过 5 秒，页面诊断快照：${JSON.stringify(getSignupEntryDiagnostics())}`, 'warn');
      }

      await sleep(250);
      continue;
    }

    if (snapshot.state === 'entry_home') {
      if (!autoOpenEntry) {
        return snapshot;
      }

      if (Date.now() - lastTriggerClickAt >= 1500) {
        if (clickAttempts >= maxSignupEntryClickAttempts) {
          log(`步骤 ${step}：官网注册入口已完成 ${maxSignupEntryClickRetries} 次重试，页面仍未进入邮箱输入页，停止重试。`, 'warn');
          return snapshot;
        }
        lastTriggerClickAt = Date.now();
        clickAttempts += 1;
        const retryAttempt = clickAttempts - 1;
        if (logDiagnostics) {
          log(`步骤 ${step}：正在点击官网注册入口（第 ${clickAttempts}/${maxSignupEntryClickAttempts} 次）："${getActionText(snapshot.signupTrigger).slice(0, 80)}"`);
        }
        log(retryAttempt > 0
          ? `步骤 ${step}：上次点击后仍未进入邮箱输入页，等待 3 秒后重试点击官网注册入口（重试 ${retryAttempt}/${maxSignupEntryClickRetries}）...`
          : `步骤 ${step}：已找到官网注册入口，等待 3 秒后点击...`);
        await sleep(3000);
        throwIfStopped();
        const clickTarget = findSignupEntryTrigger({ allowHiddenFallback: false }) || snapshot.signupTrigger;
        if (!isVisibleElement(clickTarget)) {
          log(`步骤 ${step}：注册入口仍处于不可见状态，继续按入口重试节奏尝试恢复点击...`, 'warn');
        }
        await humanPause(350, 900);
        await performOperationWithDelay({ stepKey: 'signup-entry', kind: 'click', label: 'open-signup-entry' }, async () => {
          simulateClick(clickTarget);
        });
      }
    }

    if (logDiagnostics && !slowSnapshotLogged && Date.now() - start >= 5000) {
      slowSnapshotLogged = true;
      log(`步骤 ${step}：等待注册入口超过 5 秒，页面诊断快照：${JSON.stringify(getSignupEntryDiagnostics())}`, 'warn');
    }

    await sleep(250);
  }

  const finalSnapshot = inspectSignupEntryState();
  if (logDiagnostics) {
    log(`步骤 ${step}：等待注册入口状态超时，最终状态快照：${JSON.stringify(getSignupEntryStateSummary(finalSnapshot))}`, 'warn');
  }
  return finalSnapshot;
}

async function ensureSignupEntryReady(timeout = 15000) {
  const snapshot = await waitForSignupEntryState({ timeout, autoOpenEntry: false });
  if (snapshot.state === 'entry_home' || snapshot.state === 'phone_entry' || snapshot.state === 'email_entry' || snapshot.state === 'password_page') {
    return {
      ready: true,
      state: snapshot.state,
      url: snapshot.url || location.href,
    };
  }

  log(`注册入口识别失败，诊断快照：${JSON.stringify(getSignupEntryDiagnostics())}`, 'warn');
  throw new Error('当前页面没有可用的注册入口，也不在邮箱/密码页。URL: ' + location.href);
}

async function ensureSignupPhoneEntryReady(timeout = 25000) {
  const snapshot = await waitForSignupPhoneEntryState({ timeout, step: 2 });
  if (
    (snapshot.state === 'phone_entry' && snapshot.phoneInput)
    || snapshot.state === 'password_page'
  ) {
    return {
      ready: true,
      state: snapshot.state,
      url: snapshot.url || location.href,
    };
  }

  log(`手机号注册入口识别失败，诊断快照：${JSON.stringify(getSignupEntryDiagnostics())}`, 'warn');
  throw new Error('当前页面没有可用的手机号注册入口，也不在密码页。URL: ' + location.href);
}

async function ensureSignupPasswordPageReady(timeout = 20000) {
  const start = Date.now();

  while (Date.now() - start < timeout) {
    throwIfStopped();
    const passwordInput = getSignupPasswordInput();
    if (isSignupPasswordPage() && passwordInput) {
      return {
        ready: true,
        state: 'password_page',
        url: location.href,
      };
    }
    await sleep(200);
  }

  throw new Error('等待进入密码页超时。URL: ' + location.href);
}

async function fillSignupEmailAndContinue(email, step) {
  const performOperationWithDelay = typeof getOperationDelayRunner === 'function'
    ? getOperationDelayRunner()
    : async (metadata, operation) => {
        const rootScope = typeof window !== 'undefined' ? window : globalThis;
        const gate = rootScope?.CodexOperationDelay?.performOperationWithDelay;
        return typeof gate === 'function' ? gate(metadata, operation) : operation();
      };
  if (!email) throw new Error(`未提供邮箱地址，步骤 ${step} 无法继续。`);
  const normalizedEmail = String(email || '').trim().toLowerCase();

  const snapshot = await waitForSignupEntryState({
    timeout: 20000,
    autoOpenEntry: true,
    step,
    logDiagnostics: step === 2,
  });

  if (snapshot.state === 'password_page') {
    if (snapshot.displayedEmail && snapshot.displayedEmail !== normalizedEmail) {
      throw new Error(`步骤 ${step}：当前密码页邮箱为 ${snapshot.displayedEmail}，与目标邮箱 ${email} 不一致，请先回到步骤 1 重新开始。`);
    }
    log(`步骤 ${step}：当前已在密码页，无需重复提交邮箱。`);
    return {
      alreadyOnPasswordPage: true,
      url: snapshot.url || location.href,
    };
  }

  if (snapshot.state !== 'email_entry' || !snapshot.emailInput) {
    if (step === 2) {
      log(`步骤 ${step}：未进入邮箱输入页，最终页面诊断快照：${JSON.stringify(getSignupEntryDiagnostics())}`, 'warn');
    }
    throw new Error(`步骤 ${step}：未找到可用的邮箱输入入口。URL: ${location.href}`);
  }

  log(`步骤 ${step}：正在填写邮箱：${email}`);
  await humanPause(500, 1400);
  await performOperationWithDelay({ stepKey: step === 2 ? 'signup-entry' : 'fill-password', kind: 'fill', label: 'signup-email' }, async () => {
    fillInput(snapshot.emailInput, email);
  });
  log(`步骤 ${step}：邮箱已填写`);

  const continueButton = snapshot.continueButton || getSignupEmailContinueButton({ allowDisabled: true });
  if (!continueButton || !isActionEnabled(continueButton)) {
    throw new Error(`步骤 ${step}：未找到可点击的“继续”按钮。URL: ${location.href}`);
  }

  log(`步骤 ${step}：邮箱已准备提交，正在前往密码页...`);
  window.setTimeout(async () => {
    try {
      throwIfStopped();
      await performOperationWithDelay({ stepKey: step === 2 ? 'signup-entry' : 'fill-password', kind: 'submit', label: 'submit-signup-email' }, async () => {
        simulateClick(continueButton);
      });
    } catch (error) {
      if (!isStopError(error)) {
        console.error('[MultiPage:openai-auth] deferred signup email submit failed:', error?.message || error);
      }
    }
  }, 120);

  return {
    submitted: true,
    email,
    url: location.href,
  };
}

function normalizePhoneDigits(value) {
  const phoneCountryUtils = (typeof self !== 'undefined' ? self : globalThis)?.MultiPagePhoneCountryUtils
    || globalThis?.MultiPagePhoneCountryUtils
    || {};
  if (typeof phoneCountryUtils.normalizePhoneDigits === 'function') {
    return phoneCountryUtils.normalizePhoneDigits(value);
  }
  let digits = String(value || '').replace(/\D+/g, '');
  if (digits.startsWith('00')) {
    digits = digits.slice(2);
  }
  return digits;
}

function extractDialCodeFromText(value) {
  const phoneCountryUtils = (typeof self !== 'undefined' ? self : globalThis)?.MultiPagePhoneCountryUtils
    || globalThis?.MultiPagePhoneCountryUtils
    || {};
  if (typeof phoneCountryUtils.extractDialCodeFromText === 'function') {
    return phoneCountryUtils.extractDialCodeFromText(value);
  }
  const match = String(value || '').match(/\(\+\s*(\d{1,4})\s*\)|\+\s*\(\s*(\d{1,4})\s*\)|\+\s*(\d{1,4})\b/);
  return String(match?.[1] || match?.[2] || match?.[3] || '').trim();
}

function dispatchSignupPhoneFieldEvents(element) {
  if (!element) return;
  element.dispatchEvent(new Event('input', { bubbles: true }));
  element.dispatchEvent(new Event('change', { bubbles: true }));
}

function normalizeSignupCountryLabel(value) {
  const phoneCountryUtils = (typeof self !== 'undefined' ? self : globalThis)?.MultiPagePhoneCountryUtils
    || globalThis?.MultiPagePhoneCountryUtils
    || {};
  if (typeof phoneCountryUtils.normalizeCountryLabel === 'function') {
    return phoneCountryUtils.normalizeCountryLabel(value);
  }
  return String(value || '')
    .normalize('NFKD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/&/g, ' and ')
    .replace(/[^\p{L}\p{N}\s]/gu, ' ')
    .replace(/\s+/g, ' ')
    .trim()
    .toLowerCase();
}

function getSignupCountryLabelAliases(value) {
  const phoneCountryUtils = (typeof self !== 'undefined' ? self : globalThis)?.MultiPagePhoneCountryUtils
    || globalThis?.MultiPagePhoneCountryUtils
    || {};
  if (typeof phoneCountryUtils.getCountryLabelAliases === 'function') {
    return phoneCountryUtils.getCountryLabelAliases(value);
  }
  const aliases = new Set();
  const addAlias = (alias) => {
    const normalized = normalizeSignupCountryLabel(alias);
    if (normalized) {
      aliases.add(normalized);
    }
  };

  const raw = String(value || '').trim();
  addAlias(raw);

  const normalized = normalizeSignupCountryLabel(raw);
  const compact = normalized.replace(/\s+/g, '');
  if (
    /(?:^|\s)(?:gb|uk)(?:\s|$)/i.test(raw)
    || /england|united\s*kingdom|great\s*britain|\bbritain\b/i.test(raw)
    || /英国|英格兰|大不列颠/.test(raw)
    || ['gb', 'uk', 'england', 'unitedkingdom', 'greatbritain', 'britain'].includes(compact)
  ) {
    [
      'GB',
      'UK',
      'United Kingdom',
      'Great Britain',
      'Britain',
      'England',
      '英国',
      '英格兰',
      '大不列颠',
    ].forEach(addAlias);
  }

  return Array.from(aliases);
}

function getSignupPhoneOptionLabel(option) {
  const phoneCountryUtils = (typeof self !== 'undefined' ? self : globalThis)?.MultiPagePhoneCountryUtils
    || globalThis?.MultiPagePhoneCountryUtils
    || {};
  if (typeof phoneCountryUtils.getOptionLabel === 'function') {
    return phoneCountryUtils.getOptionLabel(option);
  }
  return String(option?.textContent || option?.label || '')
    .replace(/\s+/g, ' ')
    .trim();
}

function normalizeSignupCountryOptionValue(value) {
  const phoneCountryUtils = (typeof self !== 'undefined' ? self : globalThis)?.MultiPagePhoneCountryUtils
    || globalThis?.MultiPagePhoneCountryUtils
    || {};
  if (typeof phoneCountryUtils.normalizeCountryOptionValue === 'function') {
    return phoneCountryUtils.normalizeCountryOptionValue(value);
  }
  return String(value || '').trim().toUpperCase();
}

function getSignupRegionDisplayName(regionCode, locale) {
  const phoneCountryUtils = (typeof self !== 'undefined' ? self : globalThis)?.MultiPagePhoneCountryUtils
    || globalThis?.MultiPagePhoneCountryUtils
    || {};
  if (typeof phoneCountryUtils.getRegionDisplayName === 'function') {
    return phoneCountryUtils.getRegionDisplayName(regionCode, locale);
  }
  const normalizedRegionCode = normalizeSignupCountryOptionValue(regionCode);
  const normalizedLocale = String(locale || '').trim();
  if (!/^[A-Z]{2}$/.test(normalizedRegionCode) || !normalizedLocale || typeof Intl?.DisplayNames !== 'function') {
    return '';
  }
  try {
    return String(
      new Intl.DisplayNames([normalizedLocale], { type: 'region' }).of(normalizedRegionCode) || ''
    ).trim();
  } catch {
    return '';
  }
}

function getSignupPhoneCountryMatchLabels(option) {
  const phoneCountryUtils = (typeof self !== 'undefined' ? self : globalThis)?.MultiPagePhoneCountryUtils
    || globalThis?.MultiPagePhoneCountryUtils
    || {};
  if (typeof phoneCountryUtils.getOptionMatchLabels === 'function') {
    const rootScope = typeof self !== 'undefined' ? self : globalThis;
    return phoneCountryUtils.getOptionMatchLabels(option, {
      document: typeof document !== 'undefined' ? document : null,
      navigator: rootScope?.navigator || globalThis?.navigator || null,
      getOptionLabel: getSignupPhoneOptionLabel,
    });
  }

  const labels = new Set();
  const pushLabel = (value) => {
    const label = String(value || '').replace(/\s+/g, ' ').trim();
    if (label) {
      labels.add(label);
    }
  };

  pushLabel(getSignupPhoneOptionLabel(option));

  const regionCode = normalizeSignupCountryOptionValue(option?.value);
  if (/^[A-Z]{2}$/.test(regionCode)) {
    pushLabel(regionCode);
    pushLabel(getSignupRegionDisplayName(regionCode, 'en'));

    const rootScope = typeof self !== 'undefined' ? self : globalThis;
    const pageLocale = String(
      document?.documentElement?.lang
      || document?.documentElement?.getAttribute?.('lang')
      || rootScope?.navigator?.language
      || ''
    ).trim();
    if (pageLocale && !/^en(?:[-_]|$)/i.test(pageLocale)) {
      pushLabel(getSignupRegionDisplayName(regionCode, pageLocale));
    }
  }

  return Array.from(labels);
}

function isSameSignupCountryOption(left, right) {
  if (!left || !right) {
    return false;
  }

  const leftValue = normalizeSignupCountryOptionValue(left.value);
  const rightValue = normalizeSignupCountryOptionValue(right.value);
  if (leftValue && rightValue) {
    return leftValue === rightValue;
  }

  return normalizeSignupCountryLabel(getSignupPhoneOptionLabel(left)) === normalizeSignupCountryLabel(getSignupPhoneOptionLabel(right));
}

function getSignupPhoneForm(phoneInput = getSignupPhoneInput()) {
  return phoneInput?.closest?.('form') || null;
}

function getSignupPhoneControlRoots(phoneInput = getSignupPhoneInput()) {
  const roots = [];
  const addRoot = (root) => {
    if (root && !roots.includes(root)) {
      roots.push(root);
    }
  };

  addRoot(phoneInput?.closest?.('form'));
  addRoot(phoneInput?.closest?.('fieldset'));
  addRoot(phoneInput?.closest?.('[data-rac]'));
  addRoot(phoneInput?.closest?.('[role="group"]'));
  addRoot(phoneInput?.parentElement);
  addRoot(phoneInput?.parentElement?.parentElement);
  addRoot(document);

  return roots;
}

function querySignupPhoneCountryElements(root, selector) {
  if (!root || !selector) {
    return [];
  }
  if (typeof root.querySelectorAll === 'function') {
    const directMatches = Array.from(root.querySelectorAll(selector));
    if (directMatches.length > 0) {
      return directMatches;
    }
  }
  if (typeof root.querySelector === 'function') {
    const selectors = String(selector || '')
      .split(',')
      .map((part) => part.trim())
      .filter(Boolean);
    const matches = [];
    for (const part of selectors) {
      const element = root.querySelector(part);
      if (element && !matches.includes(element)) {
        matches.push(element);
      }
    }
    return matches;
  }
  return [];
}

function isSignupPhoneCountrySelect(select) {
  if (!select) {
    return false;
  }
  return Array.from(select.options || []).some((option) => (
    extractDialCodeFromText(getSignupPhoneOptionLabel(option))
    || /^[A-Z]{2}$/.test(normalizeSignupCountryOptionValue(option?.value))
  ));
}

function getSignupPhoneCountrySelect(phoneInput = getSignupPhoneInput()) {
  const selects = [];
  for (const root of getSignupPhoneControlRoots(phoneInput)) {
    for (const select of querySignupPhoneCountryElements(root, 'select')) {
      if (!selects.includes(select)) {
        selects.push(select);
      }
    }
  }
  return selects.find(isSignupPhoneCountrySelect) || selects[0] || null;
}

function getSignupPhoneSelectedCountryOption(phoneInput = getSignupPhoneInput()) {
  const select = getSignupPhoneCountrySelect(phoneInput);
  if (!select || select.selectedIndex < 0) {
    return null;
  }
  return select.options?.[select.selectedIndex] || null;
}

function getSignupPhoneCountryButtonText(phoneInput = getSignupPhoneInput()) {
  const button = getSignupPhoneCountryButton(phoneInput);
  if (!button) return '';
  const valueNode = button.querySelector('.react-aria-SelectValue');
  return String(valueNode?.textContent || button.textContent || '')
    .replace(/\s+/g, ' ')
    .trim();
}

function getSignupPhoneCountryButton(phoneInput = getSignupPhoneInput()) {
  const candidates = [];
  for (const root of getSignupPhoneControlRoots(phoneInput)) {
    const buttons = querySignupPhoneCountryElements(
      root,
      'button[aria-haspopup="listbox"], [role="button"][aria-haspopup="listbox"], [role="combobox"][aria-haspopup="listbox"], button[aria-expanded]'
    );
    for (const button of buttons) {
      if (!candidates.includes(button)) {
        candidates.push(button);
      }
    }
  }
  return candidates.find((button) => isVisibleElement(button) && extractDialCodeFromText(getActionText(button)))
    || candidates.find(isVisibleElement)
    || null;
}

function getSignupPhoneDisplayedDialCode(phoneInput = getSignupPhoneInput()) {
  const buttonDialCode = extractDialCodeFromText(getSignupPhoneCountryButtonText(phoneInput));
  if (buttonDialCode) {
    return buttonDialCode;
  }
  const inputRoot = phoneInput?.closest?.('fieldset, form, [data-rac], div') || document;
  const visibleText = String(inputRoot?.textContent || '').replace(/\s+/g, ' ').trim();
  const rootDialCode = extractDialCodeFromText(visibleText);
  if (rootDialCode) {
    return rootDialCode;
  }
  const pageDialCode = extractDialCodeFromText(getPageTextSnapshot());
  if (pageDialCode) {
    return pageDialCode;
  }
  return '';
}

function getSignupPhoneHiddenNumberInput(phoneInput = getSignupPhoneInput()) {
  const form = getSignupPhoneForm(phoneInput);
  if (!form || typeof form.querySelector !== 'function') {
    return null;
  }
  return form.querySelector('input[name="phoneNumber"]');
}

function resolveSignupPhoneDialCodeFromNumber(phoneNumber = '', texts = []) {
  const phoneCountryUtils = (typeof self !== 'undefined' ? self : globalThis)?.MultiPagePhoneCountryUtils
    || globalThis?.MultiPagePhoneCountryUtils
    || {};
  if (typeof phoneCountryUtils.resolveDialCodeFromPhoneNumber === 'function') {
    return phoneCountryUtils.resolveDialCodeFromPhoneNumber(phoneNumber, texts);
  }
  const digits = normalizePhoneDigits(phoneNumber);
  if (!digits) {
    return '';
  }

  const textDialCodes = texts
    .map((text) => normalizePhoneDigits(extractDialCodeFromText(text)))
    .filter((dialCode) => dialCode && digits.startsWith(dialCode) && digits.length > dialCode.length)
    .sort((left, right) => right.length - left.length);
  if (textDialCodes[0]) {
    return textDialCodes[0];
  }

  const knownDialCodes = [
    '1246', '1264', '1268', '1284', '1340', '1345', '1441', '1473', '1649', '1664', '1670', '1671', '1684',
    '1721', '1758', '1767', '1784', '1809', '1829', '1849', '1868', '1869', '1876',
    '971', '962', '886', '880', '856', '855', '852', '853', '673', '672', '670', '599', '598', '597', '596',
    '595', '594', '593', '592', '591', '590', '509', '508', '507', '506', '505', '504', '503', '502', '501',
    '423', '421', '420', '389', '387', '386', '385', '383', '382', '381', '380', '379', '378', '377', '376',
    '375', '374', '373', '372', '371', '370', '359', '358', '357', '356', '355', '354', '353', '352', '351',
    '350', '299', '298', '297', '291', '290', '269', '268', '267', '266', '265', '264', '263', '262', '261',
    '260', '258', '257', '256', '255', '254', '253', '252', '251', '250', '249', '248', '247', '246', '245',
    '244', '243', '242', '241', '240', '239', '238', '237', '236', '235', '234', '233', '232', '231', '230',
    '229', '228', '227', '226', '225', '224', '223', '222', '221', '220', '218', '216', '213', '212', '211',
    '98', '95', '94', '93', '92', '91', '90', '89', '88', '86', '84', '82', '81', '66', '65', '64', '63',
    '62', '61', '60', '58', '57', '56', '55', '54', '53', '52', '51', '49', '48', '47', '46', '45', '44',
    '43', '41', '40', '39', '36', '34', '33', '32', '31', '30', '27', '20', '7', '1',
  ];
  return knownDialCodes.find((code) => digits.startsWith(code) && digits.length > code.length) || '';
}

function resolveSignupPhoneTargetDialCode(options = {}, targetOption = null) {
  const optionDialCode = extractDialCodeFromText(getSignupPhoneOptionLabel(targetOption));
  if (optionDialCode) {
    return optionDialCode;
  }

  const countryText = String(options.countryLabel || '').trim();
  if (/australia|澳大利亚/i.test(countryText)) return '61';
  if (/thailand|泰国/i.test(countryText)) return '66';
  if (/vietnam|越南/i.test(countryText)) return '84';
  if (/england|united\s*kingdom|great\s*britain|\bbritain\b|英国|英格兰|uk|gb/i.test(countryText)) return '44';

  return resolveSignupPhoneDialCodeFromNumber(options.phoneNumber);
}

function getSignupPhoneCountryTargetLabels(targetOption, options = {}) {
  const labels = new Set();
  const addLabel = (value) => {
    getSignupCountryLabelAliases(value).forEach((alias) => labels.add(alias));
  };

  addLabel(options.countryLabel);
  if (targetOption) {
    getSignupPhoneCountryMatchLabels(targetOption).forEach(addLabel);
  }

  return Array.from(labels);
}

function doesSignupPhoneCountryTextMatchTarget(text, targetOption, options = {}) {
  const normalizedText = normalizeSignupCountryLabel(text);
  if (!normalizedText) {
    return false;
  }

  const labels = getSignupPhoneCountryTargetLabels(targetOption, options);
  if (labels.some((label) => (
    label
    && (
      normalizedText === label
      || (label.length > 1 && normalizedText.includes(label))
      || (normalizedText.length > 2 && label.includes(normalizedText))
    )
  ))) {
    return true;
  }

  const targetDialCode = resolveSignupPhoneTargetDialCode(options, targetOption);
  return Boolean(targetDialCode && extractDialCodeFromText(text) === targetDialCode);
}

function isSignupPhoneCountrySelectionSynced(phoneInput, targetOption, options = {}) {
  const targetDialCode = resolveSignupPhoneTargetDialCode(options, targetOption);
  const displayedText = getSignupPhoneCountryButtonText(phoneInput);
  const displayedDialCode = extractDialCodeFromText(displayedText);

  if (targetDialCode && displayedDialCode) {
    return displayedDialCode === targetDialCode
      && (!displayedText || doesSignupPhoneCountryTextMatchTarget(displayedText, targetOption, options));
  }

  if (displayedText && doesSignupPhoneCountryTextMatchTarget(displayedText, targetOption, options)) {
    return true;
  }

  const selectedOption = getSignupPhoneSelectedCountryOption(phoneInput);
  if (selectedOption && targetOption && isSameSignupCountryOption(selectedOption, targetOption)) {
    return !displayedDialCode || !targetDialCode || displayedDialCode === targetDialCode;
  }

  return Boolean(selectedOption && !targetOption && targetDialCode && displayedDialCode === targetDialCode);
}

function findSignupPhoneCountryOptionByLabel(phoneInput, countryLabel) {
  const select = getSignupPhoneCountrySelect(phoneInput);
  if (!select) {
    return null;
  }
  const phoneCountryUtils = (typeof self !== 'undefined' ? self : globalThis)?.MultiPagePhoneCountryUtils
    || globalThis?.MultiPagePhoneCountryUtils
    || {};
  if (typeof phoneCountryUtils.findOptionByCountryLabel === 'function') {
    return phoneCountryUtils.findOptionByCountryLabel(select.options, countryLabel, {
      document: typeof document !== 'undefined' ? document : null,
      navigator: (typeof self !== 'undefined' ? self : globalThis)?.navigator || globalThis?.navigator || null,
      getOptionLabel: getSignupPhoneOptionLabel,
    });
  }
  const normalizedTargets = getSignupCountryLabelAliases(countryLabel);
  if (normalizedTargets.length === 0) {
    return null;
  }

  const options = Array.from(select.options || []);
  return options.find((option) => (
    getSignupPhoneCountryMatchLabels(option).some((label) => normalizedTargets.includes(normalizeSignupCountryLabel(label)))
  ))
    || options.find((option) => {
      const normalizedLabels = getSignupPhoneCountryMatchLabels(option)
        .map((label) => normalizeSignupCountryLabel(label))
        .filter(Boolean);
      return normalizedLabels.some((optionLabel) => normalizedTargets.some((normalizedTarget) => (
          optionLabel.length > 2
          && normalizedTarget.length > 2
          && (optionLabel.includes(normalizedTarget) || normalizedTarget.includes(optionLabel))
        )));
    })
    || null;
}

function findSignupPhoneCountryOptionByPhoneNumber(phoneInput, phoneNumber) {
  const select = getSignupPhoneCountrySelect(phoneInput);
  if (!select) {
    return null;
  }
  const phoneCountryUtils = (typeof self !== 'undefined' ? self : globalThis)?.MultiPagePhoneCountryUtils
    || globalThis?.MultiPagePhoneCountryUtils
    || {};
  if (typeof phoneCountryUtils.findOptionByPhoneNumber === 'function') {
    return phoneCountryUtils.findOptionByPhoneNumber(select.options, phoneNumber, {
      getOptionLabel: getSignupPhoneOptionLabel,
    });
  }
  const digits = normalizePhoneDigits(phoneNumber);
  if (!digits) {
    return null;
  }

  let bestMatch = null;
  let bestDialCodeLength = 0;
  for (const option of Array.from(select.options || [])) {
    const dialCode = normalizePhoneDigits(extractDialCodeFromText(getSignupPhoneOptionLabel(option)));
    if (!dialCode || !digits.startsWith(dialCode)) {
      continue;
    }
    if (dialCode.length > bestDialCodeLength) {
      bestMatch = option;
      bestDialCodeLength = dialCode.length;
    }
  }
  return bestMatch;
}

async function trySelectSignupPhoneCountryOption(select, targetOption, phoneInput = getSignupPhoneInput(), options = {}) {
  const performOperationWithDelay = typeof getOperationDelayRunner === 'function'
    ? getOperationDelayRunner()
    : async (metadata, operation) => {
        const rootScope = typeof window !== 'undefined' ? window : globalThis;
        const gate = rootScope?.CodexOperationDelay?.performOperationWithDelay;
        return typeof gate === 'function' ? gate(metadata, operation) : operation();
      };
  if (!select || !targetOption) {
    return false;
  }
  const selectedOption = select.selectedIndex >= 0
    ? (select.options?.[select.selectedIndex] || null)
    : null;
  if (selectedOption && isSameSignupCountryOption(selectedOption, targetOption)) {
    await performOperationWithDelay({ stepKey: 'signup-phone-entry', kind: 'select', label: 'signup-phone-country-select' }, async () => {
      dispatchSignupPhoneFieldEvents(select);
    });
    await sleep(120);
    return isSignupPhoneCountrySelectionSynced(phoneInput, targetOption, options);
  }
  await performOperationWithDelay({ stepKey: 'signup-phone-entry', kind: 'select', label: 'signup-phone-country-select' }, async () => {
    select.value = String(targetOption.value || '');
    dispatchSignupPhoneFieldEvents(select);
  });
  await sleep(250);
  return isSignupPhoneCountrySelectionSynced(phoneInput, targetOption, options);
}

function getVisibleSignupPhoneCountryListboxOptions() {
  const seen = new Set();
  return Array.from(document.querySelectorAll('[role="listbox"] [role="option"], [role="option"]'))
    .filter((option) => {
      if (!option || seen.has(option)) {
        return false;
      }
      seen.add(option);
      return isVisibleElement(option);
    });
}

function findSignupPhoneCountryListboxOption(targetOption, options = {}) {
  const candidates = getVisibleSignupPhoneCountryListboxOptions();
  const byLabel = candidates.find((option) => doesSignupPhoneCountryTextMatchTarget(getActionText(option), targetOption, options));
  if (byLabel) {
    return byLabel;
  }

  const phoneCountryUtils = (typeof self !== 'undefined' ? self : globalThis)?.MultiPagePhoneCountryUtils
    || globalThis?.MultiPagePhoneCountryUtils
    || {};
  if (typeof phoneCountryUtils.findElementByDialCode === 'function') {
    const byPhoneNumber = phoneCountryUtils.findElementByDialCode(candidates, options.phoneNumber, {
      getText: getActionText,
    });
    if (byPhoneNumber) {
      return byPhoneNumber;
    }
  }

  const targetDialCode = resolveSignupPhoneTargetDialCode(options, targetOption);
  if (!targetDialCode) {
    const digits = normalizePhoneDigits(options.phoneNumber);
    let bestMatch = null;
    let bestDialCodeLength = 0;
    for (const option of candidates) {
      const dialCode = normalizePhoneDigits(extractDialCodeFromText(getActionText(option)));
      if (!dialCode || !digits.startsWith(dialCode) || dialCode.length <= bestDialCodeLength) {
        continue;
      }
      bestMatch = option;
      bestDialCodeLength = dialCode.length;
    }
    return bestMatch;
  }
  return candidates.find((option) => extractDialCodeFromText(getActionText(option)) === targetDialCode) || null;
}

async function trySelectSignupPhoneCountryListboxOption(phoneInput, targetOption, options = {}) {
  const performOperationWithDelay = typeof getOperationDelayRunner === 'function'
    ? getOperationDelayRunner()
    : async (metadata, operation) => {
        const rootScope = typeof window !== 'undefined' ? window : globalThis;
        const gate = rootScope?.CodexOperationDelay?.performOperationWithDelay;
        return typeof gate === 'function' ? gate(metadata, operation) : operation();
      };
  const button = getSignupPhoneCountryButton(phoneInput);
  if (!button) {
    return false;
  }

  const getScrollableTargets = () => {
    const seen = new Set();
    const targets = [];
    const pushTarget = (element) => {
      if (!element || seen.has(element)) {
        return;
      }
      seen.add(element);
      const scrollHeight = Number(element.scrollHeight) || 0;
      const clientHeight = Number(element.clientHeight) || 0;
      if (scrollHeight > clientHeight + 2) {
        targets.push(element);
      }
    };

    getVisibleSignupPhoneCountryListboxOptions().forEach((option) => {
      let current = option.parentElement || null;
      let depth = 0;
      while (current && depth < 6) {
        pushTarget(current);
        if (current === document.body || current === document.documentElement) {
          break;
        }
        current = current.parentElement || null;
        depth += 1;
      }
    });

    Array.from(document.querySelectorAll('[role="listbox"]'))
      .filter((listbox) => isVisibleElement(listbox))
      .forEach(pushTarget);

    return targets;
  };

  const dispatchListboxScroll = (element) => {
    if (!element || typeof element.dispatchEvent !== 'function') {
      return;
    }
    try {
      element.dispatchEvent(typeof Event === 'function'
        ? new Event('scroll', { bubbles: true })
        : { type: 'scroll' });
    } catch {
      try {
        element.dispatchEvent({ type: 'scroll' });
      } catch { }
    }
  };

  const resetListboxScroll = () => {
    getScrollableTargets().forEach((target) => {
      if ((Number(target.scrollTop) || 0) > 0) {
        target.scrollTop = 0;
        dispatchListboxScroll(target);
      }
    });
  };

  const scrollListboxDown = () => {
    let scrolled = false;
    getScrollableTargets().forEach((target) => {
      const before = Number(target.scrollTop) || 0;
      const maxScrollTop = Math.max(0, (Number(target.scrollHeight) || 0) - (Number(target.clientHeight) || 0));
      if (maxScrollTop <= before + 1) {
        return;
      }
      const step = Math.max(360, Math.floor((Number(target.clientHeight) || 0) * 0.85));
      target.scrollTop = Math.min(maxScrollTop, before + step);
      dispatchListboxScroll(target);
      scrolled = true;
    });
    return scrolled;
  };

  await performOperationWithDelay({ stepKey: 'signup-phone-entry', kind: 'click', label: 'open-signup-phone-country-listbox' }, async () => {
    simulateClick(button);
  });
  await sleep(200);
  resetListboxScroll();

  const start = Date.now();
  let reachedListEndAt = 0;
  while (Date.now() - start < 8000) {
    throwIfStopped();
    const option = findSignupPhoneCountryListboxOption(targetOption, options);
    if (option) {
      await performOperationWithDelay({ stepKey: 'signup-phone-entry', kind: 'select', label: 'signup-phone-country-listbox-option' }, async () => {
        simulateClick(option);
      });
      await sleep(450);
      if (isSignupPhoneCountrySelectionSynced(phoneInput, targetOption, options)) {
        return true;
      }
    }

    if (!scrollListboxDown()) {
      reachedListEndAt += 1;
      if (reachedListEndAt >= 6) {
        break;
      }
      await sleep(150);
      continue;
    }
    reachedListEndAt = 0;
    await sleep(220);
  }

  return false;
}

async function ensureSignupPhoneCountrySelected(phoneInput, options = {}) {
  const select = getSignupPhoneCountrySelect(phoneInput);
  const hasCountryControl = Boolean(select || getSignupPhoneCountryButton(phoneInput));
  if (!hasCountryControl) {
    return {
      hasSelect: false,
      hasCountryControl: false,
      matched: false,
      selectedOption: null,
    };
  }

  const byLabel = findSignupPhoneCountryOptionByLabel(phoneInput, options.countryLabel);
  const byPhoneNumber = findSignupPhoneCountryOptionByPhoneNumber(phoneInput, options.phoneNumber);
  const targets = [byLabel, byPhoneNumber, null].filter((target, index, list) => (
    index === list.findIndex((item) => (
      (!item && !target)
      || (item && target && isSameSignupCountryOption(item, target))
    ))
  ));

  for (const targetOption of targets) {
    if (await trySelectSignupPhoneCountryOption(select, targetOption, phoneInput, options)) {
      return {
        hasSelect: Boolean(select),
        hasCountryControl: true,
        matched: true,
        selectedOption: getSignupPhoneSelectedCountryOption(phoneInput),
      };
    }

    if (await trySelectSignupPhoneCountryListboxOption(phoneInput, targetOption, options)) {
      return {
        hasSelect: Boolean(select),
        hasCountryControl: true,
        matched: true,
        selectedOption: getSignupPhoneSelectedCountryOption(phoneInput),
      };
    }
  }

  return {
    hasSelect: Boolean(select),
    hasCountryControl: true,
    matched: false,
    selectedOption: getSignupPhoneSelectedCountryOption(phoneInput),
  };
}

function toNationalPhoneNumber(value, dialCode) {
  const digits = normalizePhoneDigits(value);
  const normalizedDialCode = normalizePhoneDigits(dialCode);
  const isExplicitInternational = /^\s*(?:\+|00)\s*\d/.test(String(value || '').trim());
  if (!digits) {
    return '';
  }
  if (normalizedDialCode && digits.startsWith(normalizedDialCode) && digits.length > normalizedDialCode.length) {
    return digits.slice(normalizedDialCode.length);
  }
  if (isExplicitInternational) {
    return digits;
  }
  return digits;
}

function toE164PhoneNumber(value, dialCode) {
  const digits = normalizePhoneDigits(value);
  const normalizedDialCode = normalizePhoneDigits(dialCode);
  const isExplicitInternational = /^\s*(?:\+|00)\s*\d/.test(String(value || '').trim());
  if (!digits) {
    return '';
  }
  if (isExplicitInternational) {
    return `+${digits}`;
  }
  if (!normalizedDialCode) {
    return `+${digits}`;
  }
  if (digits.startsWith(normalizedDialCode)) {
    return `+${digits}`;
  }
  if (digits.startsWith('0')) {
    return `+${normalizedDialCode}${digits.slice(1)}`;
  }
  return `+${normalizedDialCode}${digits}`;
}

function getPhoneInputRenderedValue(phoneInput) {
  return String(phoneInput?.value ?? phoneInput?.getAttribute?.('value') ?? '').trim();
}

function isPhoneInputValueVerified(actualValue, expectedValue, options = {}) {
  const actualDigits = normalizePhoneDigits(actualValue);
  const expectedDigits = normalizePhoneDigits(expectedValue);
  if (!actualDigits || !expectedDigits) {
    return false;
  }
  if (actualDigits === expectedDigits) {
    return true;
  }

  const dialDigits = normalizePhoneDigits(options.dialCode);
  const fullDigits = normalizePhoneDigits(options.phoneNumber);
  if (fullDigits && actualDigits === fullDigits) {
    return true;
  }
  if (!dialDigits) {
    return false;
  }
  if (actualDigits === `${dialDigits}${expectedDigits}`) {
    return true;
  }

  const localDigits = fullDigits && fullDigits.startsWith(dialDigits)
    ? fullDigits.slice(dialDigits.length)
    : expectedDigits;
  return dialDigits === '44' && actualDigits === `${dialDigits}0${localDigits}`;
}

async function waitForPhoneInputValue(phoneInput, expectedValue, options = {}) {
  const {
    timeout = 1800,
    pollInterval = 100,
    resolvePhoneInput = null,
    phoneNumber = '',
    dialCode = '',
  } = options;
  const startedAt = Date.now();
  let currentInput = phoneInput;

  while (Date.now() - startedAt < timeout) {
    throwIfStopped();
    currentInput = (typeof resolvePhoneInput === 'function' && resolvePhoneInput()) || currentInput;
    if (isPhoneInputValueVerified(getPhoneInputRenderedValue(currentInput), expectedValue, { phoneNumber, dialCode })) {
      return {
        ok: true,
        input: currentInput,
        value: getPhoneInputRenderedValue(currentInput),
      };
    }
    await sleep(pollInterval);
  }

  currentInput = (typeof resolvePhoneInput === 'function' && resolvePhoneInput()) || currentInput;
  return {
    ok: false,
    input: currentInput,
    value: getPhoneInputRenderedValue(currentInput),
  };
}

function formatPhoneHiddenFormValue({ phoneNumber = '', dialCode = '', inputValue = '' } = {}) {
  const fullDigits = normalizePhoneDigits(phoneNumber);
  if (fullDigits) {
    return `+${fullDigits}`;
  }

  const localDigits = normalizePhoneDigits(inputValue);
  if (!localDigits) {
    return '';
  }
  const dialDigits = normalizePhoneDigits(dialCode);
  return dialDigits ? `+${dialDigits}${localDigits}` : localDigits;
}

function getPhoneHiddenValueInput(phoneInput) {
  if (typeof getLoginPhoneHiddenValueInput === 'function') {
    const loginHiddenInput = getLoginPhoneHiddenValueInput(phoneInput);
    if (loginHiddenInput) {
      return loginHiddenInput;
    }
  }
  const form = phoneInput?.form || phoneInput?.closest?.('form') || null;
  const root = form || phoneInput?.closest?.('fieldset, form, [data-rac], div') || document;
  const candidates = Array.from(root?.querySelectorAll?.('input[name="phone"], input[name="phoneNumber"], input[type="hidden"][id*="phone" i]') || []);
  return candidates.find((input) => {
    if (!input || input === phoneInput) return false;
    const type = String(input.getAttribute?.('type') || input.type || '').trim().toLowerCase();
    return type === 'hidden' || !isVisibleElement(input);
  }) || null;
}

function setPhoneHiddenValue(input, value) {
  const normalizedValue = String(value || '');
  try {
    const nativeInputValueSetter = typeof window !== 'undefined'
      ? Object.getOwnPropertyDescriptor(window.HTMLInputElement.prototype, 'value')?.set
      : null;
    if (nativeInputValueSetter) {
      nativeInputValueSetter.call(input, normalizedValue);
    } else {
      input.value = normalizedValue;
    }
  } catch {
    input.value = normalizedValue;
  }
  input.dispatchEvent?.(new Event('input', { bubbles: true }));
  input.dispatchEvent?.(new Event('change', { bubbles: true }));
}

function syncPhoneHiddenFormValue(phoneInput, options = {}) {
  const hiddenInput = getPhoneHiddenValueInput(phoneInput);
  const hiddenValue = formatPhoneHiddenFormValue(options);
  if (!hiddenInput || !hiddenValue) {
    return null;
  }

  setPhoneHiddenValue(hiddenInput, hiddenValue);
  return {
    input: hiddenInput,
    value: hiddenInput.value || '',
  };
}

function isPhoneInputValueComplete(phoneInput, phoneNumber, dialCode, expectedLocalNumber = '') {
  return isPhoneInputValueVerified(getPhoneInputRenderedValue(phoneInput), expectedLocalNumber || toNationalPhoneNumber(phoneNumber, dialCode), {
    phoneNumber,
    dialCode,
  });
}

function getLoginPhoneFillCandidates(phoneNumber, dialCode, phoneInput = null) {
  const inputValue = toNationalPhoneNumber(phoneNumber, dialCode);
  const e164Value = toE164PhoneNumber(phoneNumber, dialCode);
  const dialDigits = normalizePhoneDigits(dialCode);
  const currentRenderedValue = getPhoneInputRenderedValue(phoneInput);
  const currentDigits = normalizePhoneDigits(currentRenderedValue);
  const shouldKeepDialPrefix = Boolean(
    e164Value
    && (
      String(currentRenderedValue || '').trim().startsWith('+')
      || (dialDigits && currentDigits === dialDigits)
    )
  );
  const candidates = [];
  const addCandidate = (value) => {
    const normalizedValue = String(value || '').trim();
    if (normalizedValue && !candidates.includes(normalizedValue)) {
      candidates.push(normalizedValue);
    }
  };

  if (shouldKeepDialPrefix) {
    addCandidate(e164Value);
  }
  addCandidate(inputValue);
  addCandidate(e164Value);
  return candidates;
}

function getLoginPhoneSubmitButtonDiagnostics(button) {
  if (!button) {
    return {
      present: false,
    };
  }

  return {
    present: true,
    tag: (button.tagName || '').toLowerCase(),
    type: String(button.getAttribute?.('type') || button.type || '').trim().toLowerCase(),
    text: getActionText(button).slice(0, 80),
    visible: isVisibleElement(button),
    enabled: isActionEnabled(button),
    disabled: Boolean(button.disabled),
    ariaDisabled: String(button.getAttribute?.('aria-disabled') || '').trim(),
  };
}

function getLoginPhoneInputCandidateDiagnostics(limit = 12) {
  return collectPhoneInputCandidates('input', { allowGenericText: true }).slice(0, limit);
}

async function fillLoginPhoneInputAndConfirm(phoneInput, options = {}) {
  const performOperationWithDelay = typeof getOperationDelayRunner === 'function'
    ? getOperationDelayRunner()
    : async (metadata, operation) => {
        const rootScope = typeof window !== 'undefined' ? window : globalThis;
        const gate = rootScope?.CodexOperationDelay?.performOperationWithDelay;
        return typeof gate === 'function' ? gate(metadata, operation) : operation();
      };
  const {
    phoneNumber = '',
    dialCode = '',
    visibleStep = 7,
    resolvePhoneInput = null,
    maxAttempts = 3,
  } = options;
  const inputValue = toNationalPhoneNumber(phoneNumber, dialCode);
  if (!inputValue) {
    throw new Error(`\u6b65\u9aa4 ${visibleStep}\uff1a\u624b\u673a\u53f7\u4e3a\u7a7a\uff0c\u65e0\u6cd5\u586b\u5199\u3002`);
  }

  let currentInput = phoneInput;
  let lastVerification = { ok: false, input: currentInput, value: getPhoneInputRenderedValue(currentInput) };
  for (let attempt = 1; attempt <= maxAttempts; attempt += 1) {
    throwIfStopped();
    currentInput = (typeof resolvePhoneInput === 'function' && resolvePhoneInput()) || currentInput;
    if (!currentInput) {
      break;
    }

    const fillCandidates = getLoginPhoneFillCandidates(phoneNumber, dialCode, currentInput);
    for (const attemptedValue of fillCandidates) {
      currentInput.focus?.();
      await performOperationWithDelay({ stepKey: 'oauth-login', kind: 'fill', label: 'login-phone-number' }, async () => {
        fillInput(currentInput, attemptedValue);
      });
      lastVerification = await waitForPhoneInputValue(currentInput, inputValue, {
        resolvePhoneInput,
        phoneNumber,
        dialCode,
        timeout: 1600,
        pollInterval: 100,
      });
      if (lastVerification.ok) {
        const verifiedInput = lastVerification.input || currentInput;
        const hiddenSync = await performOperationWithDelay({ stepKey: 'oauth-login', kind: 'hidden-sync', label: 'login-phone-hidden-sync' }, async () => (
          syncPhoneHiddenFormValue(verifiedInput, { phoneNumber, dialCode, inputValue })
        ));
        const expectedHiddenDigits = normalizePhoneDigits(phoneNumber) || `${normalizePhoneDigits(dialCode)}${normalizePhoneDigits(inputValue)}`;
        if (hiddenSync && expectedHiddenDigits && normalizePhoneDigits(hiddenSync.value) !== expectedHiddenDigits) {
          throw new Error(`\u6b65\u9aa4 ${visibleStep}\uff1a\u624b\u673a\u53f7\u9690\u85cf\u63d0\u4ea4\u5b57\u6bb5\u540c\u6b65\u5931\u8d25\uff0c\u671f\u671b ${expectedHiddenDigits}\uff0c\u5b9e\u9645 ${normalizePhoneDigits(hiddenSync.value) || '\u7a7a'}\u3002`);
        }
        log(
          `\u6b65\u9aa4 ${visibleStep}\uff1a\u624b\u673a\u53f7\u8f93\u5165\u6821\u9a8c\u901a\u8fc7 ${JSON.stringify({
            attemptedValue,
            renderedValue: lastVerification.value,
            input: getLoginPhoneInputDiagnostics(verifiedInput),
            hidden: getLoginPhoneHiddenValueDiagnostics(hiddenSync?.input || getPhoneHiddenValueInput(verifiedInput)),
          })}`,
          'info',
          { step: visibleStep, stepKey: 'oauth-login' }
        );
        return {
          input: verifiedInput,
          inputValue,
          attemptedValue,
          renderedValue: lastVerification.value,
          hiddenInput: hiddenSync?.input || null,
          hiddenValue: hiddenSync?.value || '',
        };
      }
    }

    const currentDigits = normalizePhoneDigits(lastVerification.value);
    log(
      `\u6b65\u9aa4 ${visibleStep}\uff1a\u624b\u673a\u53f7\u8f93\u5165\u6846\u672a\u7a33\u5b9a\u5199\u5165\uff08\u7b2c ${attempt}/${maxAttempts} \u6b21\uff09\uff0c\u671f\u671b\u672c\u5730\u53f7 ${inputValue}\uff0c\u5f53\u524d\u503c ${currentDigits || '\u7a7a'}\uff0c\u51c6\u5907\u91cd\u8bd5\u3002`,
      'warn',
      { step: visibleStep, stepKey: 'oauth-login' }
    );
    await sleep(200);
  }

  const actualDigits = normalizePhoneDigits(lastVerification.value);
  throw new Error(`\u6b65\u9aa4 ${visibleStep}\uff1a\u624b\u673a\u53f7\u586b\u5199\u540e\u6821\u9a8c\u5931\u8d25\uff0c\u5b8c\u6574\u53f7\u7801 ${phoneNumber}\uff0c\u533a\u53f7 +${dialCode || '\u672a\u8bc6\u522b'}\uff0c\u671f\u671b\u8f93\u5165\u672c\u5730\u53f7 ${inputValue}\uff0c\u5b9e\u9645\u8f93\u5165\u6846\u4e3a ${actualDigits || '\u7a7a'}\uff0c\u5df2\u505c\u6b62\u63d0\u4ea4\u3002`);
}

function resolveSignupPhoneDialCode(phoneInput, options = {}) {
  const { phoneNumber = '', countryLabel = '' } = options;
  const displayedDialCode = getSignupPhoneDisplayedDialCode(phoneInput);
  if (displayedDialCode) {
    return displayedDialCode;
  }
  const countryText = String(countryLabel || '').trim();
  if (/australia|澳大利亚/i.test(countryText)) return '61';
  if (/thailand|泰国/i.test(countryText)) return '66';
  if (/vietnam|越南/i.test(countryText)) return '84';
  if (/england|united kingdom|英国|uk/i.test(countryText)) return '44';
  const digits = normalizePhoneDigits(phoneNumber);
  const knownDialCodes = ['66', '84', '61', '44', '1', '81', '82', '86', '852', '855', '856', '60', '62', '63', '65'];
  return knownDialCodes.find((code) => digits.startsWith(code) && digits.length > code.length) || '';
}

async function waitForSignupPhoneEntryState(options = {}) {
  const performOperationWithDelay = typeof getOperationDelayRunner === 'function'
    ? getOperationDelayRunner()
    : async (metadata, operation) => {
        const rootScope = typeof window !== 'undefined' ? window : globalThis;
        const gate = rootScope?.CodexOperationDelay?.performOperationWithDelay;
        return typeof gate === 'function' ? gate(metadata, operation) : operation();
      };
  const {
    timeout = 20000,
    step = 2,
  } = options;
  const start = Date.now();
  const maxSignupEntryClickRetries = 5;
  const maxSignupEntryClickAttempts = maxSignupEntryClickRetries + 1;
  let lastTriggerClickAt = 0;
  let clickAttempts = 0;
  let lastSwitchToPhoneAt = 0;
  let lastMoreOptionsClickAt = 0;
  let slowSnapshotLogged = false;

  while (Date.now() - start < timeout) {
    throwIfStopped();
    const snapshot = inspectSignupEntryState();

    if (snapshot.state === 'password_page') {
      return snapshot;
    }

    if (snapshot.state === 'phone_entry' && snapshot.phoneInput) {
      return snapshot;
    }

    if (snapshot.state === 'email_entry') {
      const switchToPhone = snapshot.switchToPhoneTrigger || findSignupUsePhoneTrigger();
      if (switchToPhone && Date.now() - lastSwitchToPhoneAt >= 1500) {
        lastSwitchToPhoneAt = Date.now();
        log(`步骤 ${step}：检测到邮箱输入模式，正在切换到手机号注册入口...`);
        await humanPause(350, 900);
        await performOperationWithDelay({ stepKey: 'signup-phone-entry', kind: 'click', label: 'switch-to-signup-phone' }, async () => {
          simulateClick(switchToPhone);
        });
      } else {
        const moreOptionsTrigger = findSignupMoreOptionsTrigger();
        if (moreOptionsTrigger && Date.now() - lastMoreOptionsClickAt >= 1500) {
          lastMoreOptionsClickAt = Date.now();
          log(`步骤 ${step}：手机号入口可能隐藏在更多选项中，正在展开更多选项...`);
          await humanPause(350, 900);
          await performOperationWithDelay({ stepKey: 'signup-phone-entry', kind: 'click', label: 'signup-phone-more-options' }, async () => {
            simulateClick(moreOptionsTrigger);
          });
        } else if (!switchToPhone && !slowSnapshotLogged && Date.now() - start >= 5000) {
          slowSnapshotLogged = true;
          log(`步骤 ${step}：尚未找到手机号入口，页面诊断快照：${JSON.stringify(getSignupEntryDiagnostics())}`, 'warn');
        }
      }
      await sleep(250);
      continue;
    }

    if (snapshot.state === 'entry_home' && snapshot.signupTrigger) {
      if (Date.now() - lastTriggerClickAt >= 1500) {
        if (clickAttempts >= maxSignupEntryClickAttempts) {
          log(`步骤 ${step}：官网注册入口已完成 ${maxSignupEntryClickRetries} 次重试，页面仍未进入手机号输入页，停止重试。`, 'warn');
          return snapshot;
        }
        lastTriggerClickAt = Date.now();
        clickAttempts += 1;
        const retryAttempt = clickAttempts - 1;
        log(retryAttempt > 0
          ? `步骤 ${step}：上次点击后仍未进入手机号输入页，等待 3 秒后重试点击官网注册入口（重试 ${retryAttempt}/${maxSignupEntryClickRetries}）...`
          : `步骤 ${step}：已找到官网注册入口，等待 3 秒后点击...`);
        await sleep(3000);
        throwIfStopped();
        const clickTarget = findSignupEntryTrigger({ allowHiddenFallback: false }) || snapshot.signupTrigger;
        if (!isVisibleElement(clickTarget)) {
          log(`步骤 ${step}：注册入口仍处于不可见状态，继续按入口重试节奏尝试恢复点击...`, 'warn');
        }
        await humanPause(350, 900);
        await performOperationWithDelay({ stepKey: 'signup-phone-entry', kind: 'click', label: 'open-signup-entry' }, async () => {
          simulateClick(clickTarget);
        });
      }
      await sleep(250);
      continue;
    }

    if (!slowSnapshotLogged && Date.now() - start >= 5000) {
      slowSnapshotLogged = true;
      log(`步骤 ${step}：等待手机号注册入口超过 5 秒，页面诊断快照：${JSON.stringify(getSignupEntryDiagnostics())}`, 'warn');
    }

    await sleep(250);
  }

  const finalSnapshot = inspectSignupEntryState();
  log(`步骤 ${step}：等待手机号注册入口超时，最终状态快照：${JSON.stringify(getSignupEntryStateSummary(finalSnapshot))}`, 'warn');
  return finalSnapshot;
}

async function submitSignupPhoneNumberAndContinue(payload = {}) {
  const performOperationWithDelay = typeof getOperationDelayRunner === 'function'
    ? getOperationDelayRunner()
    : async (metadata, operation) => {
        const rootScope = typeof window !== 'undefined' ? window : globalThis;
        const gate = rootScope?.CodexOperationDelay?.performOperationWithDelay;
        return typeof gate === 'function' ? gate(metadata, operation) : operation();
      };
  const phoneNumber = String(payload.phoneNumber || '').trim();
  const countryLabel = String(payload.countryLabel || '').trim();
  if (!phoneNumber) {
    throw new Error('未提供手机号，步骤 2 无法继续。');
  }

  const snapshot = await waitForSignupPhoneEntryState({ timeout: 25000, step: 2 });
  if (snapshot.state === 'password_page') {
    log('步骤 2：当前已在密码页，无需重复提交手机号。');
    return {
      alreadyOnPasswordPage: true,
      url: snapshot.url || location.href,
    };
  }

  if (snapshot.state !== 'phone_entry' || !snapshot.phoneInput) {
    throw new Error(`步骤 2：未找到可用的手机号输入入口。URL: ${location.href}`);
  }

  const countrySelection = await ensureSignupPhoneCountrySelected(snapshot.phoneInput, {
    countryLabel,
    phoneNumber,
  });
  if (countrySelection.hasCountryControl && !countrySelection.matched) {
    const currentCountryText = getSignupPhoneCountryButtonText(snapshot.phoneInput) || '未知';
    const targetDialCode = resolveSignupPhoneTargetDialCode({ countryLabel, phoneNumber }, countrySelection.selectedOption);
    const targetLabel = targetDialCode
      ? `目标区号 +${targetDialCode}（号码 ${phoneNumber}${countryLabel ? `，国家 ${countryLabel}` : ''}）`
      : (countryLabel || phoneNumber);
    throw new Error(`步骤 2：手机号国家下拉框未能自动切换到 ${targetLabel}，当前显示为 ${currentCountryText}，已停止提交以避免区号不匹配。`);
  }

  const dialCode = resolveSignupPhoneDialCode(snapshot.phoneInput, {
    phoneNumber,
    countryId: payload.countryId,
    countryLabel,
  });
  const inputValue = toNationalPhoneNumber(phoneNumber, dialCode);
  if (!inputValue) {
    throw new Error('步骤 2：手机号为空，无法填写。');
  }

  log(`步骤 2：正在填写手机号：${phoneNumber}`);
  await humanPause(500, 1400);
  await performOperationWithDelay({ stepKey: 'signup-phone-entry', kind: 'fill', label: 'signup-phone-number' }, async () => {
    fillInput(snapshot.phoneInput, inputValue);
  });
  const hiddenPhoneNumberInput = getSignupPhoneHiddenNumberInput(snapshot.phoneInput);
  const e164PhoneNumber = toE164PhoneNumber(phoneNumber, dialCode);
  if (hiddenPhoneNumberInput && e164PhoneNumber) {
    await performOperationWithDelay({ stepKey: 'signup-phone-entry', kind: 'hidden-sync', label: 'signup-phone-hidden-sync' }, async () => {
      fillInput(hiddenPhoneNumberInput, e164PhoneNumber);
    });
  }
  log(`步骤 2：手机号已填写：${phoneNumber}${dialCode ? `（区号 +${dialCode}，本地号 ${inputValue}）` : ''}`);

  const continueButton = getSignupEmailContinueButton({ allowDisabled: true });
  if (!continueButton || !isActionEnabled(continueButton)) {
    throw new Error(`步骤 2：未找到可点击的“继续”按钮。URL: ${location.href}`);
  }

  log('步骤 2：手机号已准备提交，正在前往下一页...');
  window.setTimeout(async () => {
    try {
      throwIfStopped();
      await performOperationWithDelay({ stepKey: 'signup-phone-entry', kind: 'submit', label: 'submit-signup-phone' }, async () => {
        simulateClick(continueButton);
      });
    } catch (error) {
      if (!isStopError(error)) {
        console.error('[MultiPage:openai-auth] deferred signup phone submit failed:', error?.message || error);
      }
    }
  }, 120);

  return {
    submitted: true,
    deferredSubmit: true,
    phoneNumber,
    phoneInputValue: snapshot.phoneInput?.value || inputValue,
    url: location.href,
  };
}

// ============================================================
// Step 2: Click Register, fill email, then continue to password page
// ============================================================

async function step2_clickRegister(payload = {}) {
  if (payload?.signupMethod === 'phone' || payload?.phoneNumber) {
    return submitSignupPhoneNumberAndContinue(payload);
  }
  const { email } = payload;
  return fillSignupEmailAndContinue(email, 2);
}

// ============================================================
// Step 3: Fill Password
// ============================================================

async function step3_fillEmailPassword(payload) {
  const performOperationWithDelay = typeof getOperationDelayRunner === 'function'
    ? getOperationDelayRunner()
    : async (metadata, operation) => {
        const rootScope = typeof window !== 'undefined' ? window : globalThis;
        const gate = rootScope?.CodexOperationDelay?.performOperationWithDelay;
        return typeof gate === 'function' ? gate(metadata, operation) : operation();
      };
  const { email, password } = payload;
  if (!password) throw new Error('未提供密码，步骤 3 需要可用密码。');
  const normalizedEmail = String(email || '').trim().toLowerCase();
  const accountIdentifierType = String(payload?.accountIdentifierType || '').trim().toLowerCase() === 'phone'
    ? 'phone'
    : 'email';
  const accountIdentifier = String(payload?.accountIdentifier || email || payload?.phoneNumber || '').trim();

  let snapshot = inspectSignupEntryState();
  if (snapshot.state === 'entry_home') {
    throw new Error('当前仍停留在 ChatGPT 官网首页，请先完成步骤 2。');
  }

  if (
    snapshot.state === 'phone_verification_page'
    || snapshot.state === 'verification_page'
    || snapshot.state === 'profile_page'
    || snapshot.state === 'logged_in_home'
  ) {
    const completionPayload = {
      email: email || '',
      phoneNumber: String(payload?.phoneNumber || '').trim(),
      accountIdentifierType,
      accountIdentifier,
      signupVerificationRequestedAt: (
        snapshot.state === 'phone_verification_page'
        || snapshot.state === 'verification_page'
      ) ? Date.now() : null,
      skippedPasswordPage: true,
      deferredSubmit: false,
      ...(snapshot.skipProfileStep ? { skipProfileStep: true } : {}),
    };
    log('步骤 3：当前页面已进入验证码或后续阶段，密码页按已跳过处理。', 'warn');
    reportComplete(3, completionPayload);
    return completionPayload;
  }

  if (snapshot.state === 'email_entry') {
    const transition = await fillSignupEmailAndContinue(email, 3);
    if (!transition.alreadyOnPasswordPage) {
      await sleep(1200);
      await ensureSignupPasswordPageReady();
    }
    snapshot = inspectSignupEntryState();
  }

  if (snapshot.state !== 'password_page' || !snapshot.passwordInput) {
    await ensureSignupPasswordPageReady();
    snapshot = inspectSignupEntryState();
  }

  if (snapshot.state !== 'password_page' || !snapshot.passwordInput) {
    logSignupPasswordDiagnostics('步骤 3：未能识别可填写的密码输入框');
  }

  if (snapshot.state !== 'password_page' || !snapshot.passwordInput) {
    throw new Error('在密码页未找到密码输入框。URL: ' + location.href);
  }
  if (normalizedEmail && snapshot.displayedEmail && snapshot.displayedEmail !== normalizedEmail) {
    throw new Error(`当前密码页邮箱为 ${snapshot.displayedEmail}，与目标邮箱 ${email} 不一致，请先回到步骤 1 重新开始。`);
  }

  await humanPause(600, 1500);
  await performOperationWithDelay({ stepKey: 'fill-password', kind: 'fill', label: 'signup-password' }, async () => {
    fillInput(snapshot.passwordInput, password);
  });
  log('步骤 3：密码已填写');

  const submitBtn = snapshot.submitButton
    || getSignupPasswordSubmitButton({ allowDisabled: true })
    || await waitForElementByText('button', /continue|sign\s*up|submit|注册|创建|続行|続ける|次へ|サインアップ|登録|作成|create/i, 5000).catch(() => null);

  if (!submitBtn) {
    logSignupPasswordDiagnostics('步骤 3：未找到可提交的密码页按钮');
  } else if (typeof findOneTimeCodeLoginTrigger === 'function' && findOneTimeCodeLoginTrigger()) {
    logSignupPasswordDiagnostics('步骤 3：当前密码页同时存在一次性验证码入口', 'info');
  }

  const signupVerificationRequestedAt = submitBtn ? Date.now() : null;
  const completionPayload = {
    email,
    phoneNumber: String(payload?.phoneNumber || '').trim(),
    accountIdentifierType,
    accountIdentifier,
    signupVerificationRequestedAt,
    deferredSubmit: Boolean(submitBtn),
  };

  reportComplete(3, completionPayload);

  if (submitBtn) {
    window.setTimeout(async () => {
      try {
        throwIfStopped();
        await sleep(500);
        await humanPause(500, 1300);
        await performOperationWithDelay({ stepKey: 'fill-password', kind: 'submit', label: 'submit-signup-password' }, async () => {
          simulateClick(submitBtn);
        });
        log('步骤 3：表单已提交');
      } catch (error) {
        if (!isStopError(error)) {
          console.error('[MultiPage:openai-auth] deferred step 3 submit failed:', error?.message || error);
        }
      }
    }, 120);
  }

  return completionPayload;
}

// ============================================================
// Fill Verification Code (used by step 4 and step 7)
// ============================================================

const INVALID_VERIFICATION_CODE_PATTERN = /代码不正确|验证码不正确|验证码错误|コードが正しくありません|コードが間違っています|無効なコード|認証コードが正しくありません|確認コードが正しくありません|code\s+(?:is\s+)?incorrect|invalid\s+code|incorrect\s+code|try\s+again/i;
const VERIFICATION_PAGE_PATTERN = /检查您的收件箱|输入我们刚刚向|重新发送电子邮件|重新发送验证码|代码不正确|受信(?:トレイ|箱)を確認|(?:認証|確認)?コードを入力|送信した(?:認証|確認)?コード|メールで送信|再送信|email\s+verification|check\s+your\s+inbox|enter\s+the\s+code|we\s+just\s+sent|we\s+emailed|resend/i;
const OAUTH_CONSENT_PAGE_PATTERN = /使用\s*ChatGPT\s*登录到\s*Codex|ChatGPT\s*(?:を使用して|で)\s*Codex\s*(?:に)?(?:ログイン|サインイン)|Codex\s*(?:に)?(?:ログイン|サインイン)|認可|承認|sign\s+in\s+to\s+codex(?:\s+with\s+chatgpt)?|login\s+to\s+codex|log\s+in\s+to\s+codex|authorize|授权/i;
const OAUTH_CONSENT_FORM_SELECTOR = 'form[action*="/sign-in-with-chatgpt/" i][action*="/consent" i]';
const CONTINUE_ACTION_PATTERN = /继续|続行|続ける|次へ|continue/i;
const ADD_PHONE_PAGE_PATTERN = /add[\s-]*(?:a\s+)?phone|添加(?:手机|手机号|电话号码)|绑定(?:手机|手机号|电话号码)|验证(?:你的|您)?(?:手机|手机号|电话号码)|需要(?:手机|手机号|电话号码)|提供(?:手机|手机号|电话号码)|電話番号(?:を)?(?:追加|登録|確認|認証)|電話番号が必要|携帯(?:電話)?番号(?:を)?(?:追加|登録|確認|認証)|provide\s+(?:a\s+)?phone\s+number|phone\s+number\s+(?:required|verification)|verify\s+(?:your\s+)?phone|confirm\s+(?:your\s+)?phone/i;
const ADD_EMAIL_PAGE_PATTERN = /add[\s-]*email|添加(?:电子邮件|邮箱)|要求提供(?:电子邮件|邮箱)地址|提供(?:电子邮件|邮箱)地址|(?:メールアドレス|メール|電子メール)(?:を)?(?:追加|登録|提供)|メールアドレスが必要|provide\s+(?:an?\s+)?email\s+address|email\s+address\s+required/i;
const STEP5_SUBMIT_ERROR_PATTERN = /无法根据该信息创建帐户|请重试|アカウントを作成できません|アカウント作成に失敗|もう一度お試し|問題が発生しました|無効な(?:生年月日|誕生日|日付)|生年月日|誕生日|unable\s+to\s+create\s+(?:your\s+)?account|couldn'?t\s+create\s+(?:your\s+)?account|something\s+went\s+wrong|invalid\s+(?:birthday|birth|date)|生日|出生日期/i;
const AUTH_TIMEOUT_ERROR_TITLE_PATTERN = /糟糕，出错了|問題が発生しました|エラーが発生しました|something\s+went\s+wrong|oops/i;
const AUTH_TIMEOUT_ERROR_DETAIL_PATTERN = /operation\s+timed\s+out|timed\s+out|请求超时|操作超时|タイムアウト|failed\s+to\s+fetch|network\s+error|fetch\s+failed|ネットワークエラー|取得に失敗/i;
const AUTH_ROUTE_ERROR_PATTERN = /405\s+method\s+not\s+allowed|route\s+error.*405|did\s+not\s+provide\s+an?\s+[`'"]?action|post\s+request\s+to\s+["']?\/email-verification/i;
const STEP4_405_RECOVERY_ERROR_PREFIX = 'STEP4_405_RECOVERY_LIMIT::';
const STEP4_405_RECOVERY_LIMIT = 3;
const SIGNUP_USER_ALREADY_EXISTS_ERROR_PREFIX = 'SIGNUP_USER_ALREADY_EXISTS::';
const SIGNUP_PHONE_PASSWORD_MISMATCH_ERROR_PREFIX = 'SIGNUP_PHONE_PASSWORD_MISMATCH::';
const AUTH_MAX_CHECK_ATTEMPTS_ERROR_PREFIX = 'AUTH_MAX_CHECK_ATTEMPTS::';
const STEP8_EMAIL_IN_USE_ERROR_PREFIX = 'STEP8_EMAIL_IN_USE::';
const SIGNUP_EMAIL_EXISTS_PATTERN = /与此电子邮件地址相关联的帐户已存在|この(?:メールアドレス|メール|電子メール)(?:に関連付けられた)?アカウントは(?:既に|すでに)存在|メールアドレス.*(?:既に|すでに)存在|account\s+associated\s+with\s+this\s+email\s+address\s+already\s+exists|email\s+address.*already\s+exists/i;
const SIGNUP_PHONE_PASSWORD_MISMATCH_PATTERN = /incorrect\s+phone\s+number\s+or\s+password|phone\s+number\s+or\s+password|電話番号またはパスワード|電話番号.*アカウントは(?:既に|すでに)存在|与此(?:电话|手机)号码相关联的帐户已存在|account\s+associated\s+with\s+this\s+phone\s+number\s+already\s+exists/i;

const authPageRecovery = self.MultiPageAuthPageRecovery?.createAuthPageRecovery?.({
  detailPattern: AUTH_TIMEOUT_ERROR_DETAIL_PATTERN,
  getActionText,
  getPageTextSnapshot,
  humanPause,
  isActionEnabled,
  isVisibleElement,
  log,
  routeErrorPattern: AUTH_ROUTE_ERROR_PATTERN,
  simulateClick,
  sleep,
  throwIfStopped,
  titlePattern: AUTH_TIMEOUT_ERROR_TITLE_PATTERN,
}) || null;

function getVerificationErrorText() {
  const messages = [];
  const selectors = [
    '.react-aria-FieldError',
    '[slot="errorMessage"]',
    '[id$="-error"]',
    '[data-invalid="true"] + *',
    '[aria-invalid="true"] + *',
    '[class*="error"]',
  ];

  for (const selector of selectors) {
    document.querySelectorAll(selector).forEach((el) => {
      const text = (el.textContent || '').replace(/\s+/g, ' ').trim();
      if (text) {
        messages.push(text);
      }
    });
  }

  const invalidInput = document.querySelector(`${VERIFICATION_CODE_INPUT_SELECTOR}[aria-invalid="true"], ${VERIFICATION_CODE_INPUT_SELECTOR}[data-invalid="true"]`);
  if (invalidInput) {
    const wrapper = invalidInput.closest('form, [data-rac], ._root_18qcl_51, div');
    if (wrapper) {
      const text = (wrapper.textContent || '').replace(/\s+/g, ' ').trim();
      if (text) {
        messages.push(text);
      }
    }
  }

  return messages.find((text) => INVALID_VERIFICATION_CODE_PATTERN.test(text)) || '';
}

function createSignupUserAlreadyExistsError() {
  return new Error(
    `${SIGNUP_USER_ALREADY_EXISTS_ERROR_PREFIX}步骤 4：检测到 user_already_exists，说明当前用户已存在，当前轮将直接停止。`
  );
}

function createSignupPhonePasswordMismatchError(detailText = '') {
  const detail = String(detailText || '').replace(/\s+/g, ' ').trim();
  const suffix = detail ? `页面提示：${detail}` : '页面提示注册手机号不可继续使用，需重新开始当前轮。';
  return new Error(
    `${SIGNUP_PHONE_PASSWORD_MISMATCH_ERROR_PREFIX}步骤 3：检测到注册手机号异常，需要重新开始当前轮。${suffix}`
  );
}

function createAuthMaxCheckAttemptsError() {
  return new Error(`${AUTH_MAX_CHECK_ATTEMPTS_ERROR_PREFIX}max_check_attempts on auth retry page; restart the current auth step without clicking Retry.`);
}

function createStep8EmailInUseError() {
  return new Error(`${STEP8_EMAIL_IN_USE_ERROR_PREFIX}email_in_use on add-email verification page; choose a different email.`);
}

function getVisibleFieldErrorText() {
  const selectors = [
    '.react-aria-FieldError',
    '[slot="errorMessage"]',
    '[id$="-error"]',
    '[data-invalid="true"] + *',
    '[aria-invalid="true"] + *',
    '[class*="error"]',
    '[role="alert"]',
  ];

  for (const selector of selectors) {
    const match = Array.from(document.querySelectorAll(selector)).find((el) => {
      if (!isVisibleElement(el)) return false;
      const text = (el.textContent || '').replace(/\s+/g, ' ').trim();
      return Boolean(text);
    });
    if (match) {
      return (match.textContent || '').replace(/\s+/g, ' ').trim();
    }
  }

  return '';
}

function getSignupPasswordFieldErrorText() {
  const text = getVisibleFieldErrorText();
  if (text && SIGNUP_PHONE_PASSWORD_MISMATCH_PATTERN.test(text)) {
    return text;
  }

  const passwordInput = getSignupPasswordInput();
  if (passwordInput) {
    const wrapper = passwordInput.closest('form, [data-rac], [role="group"], section, div');
    const wrapperText = (wrapper?.textContent || '').replace(/\s+/g, ' ').trim();
    if (wrapperText && SIGNUP_PHONE_PASSWORD_MISMATCH_PATTERN.test(wrapperText)) {
      return wrapperText;
    }
  }

  return '';
}

function isStep5Ready() {
  return Boolean(
    document.querySelector('input[name="name"], input[autocomplete="name"], input[name="birthday"], input[name="age"], [role="spinbutton"][data-type="year"]')
  );
}

function isSignupProfilePageUrl(rawUrl = location.href) {
  const url = String(rawUrl || '').trim();
  if (!url) {
    return false;
  }

  try {
    const parsed = new URL(url);
    const host = String(parsed.hostname || '').toLowerCase();
    if (!['auth.openai.com', 'auth0.openai.com', 'accounts.openai.com'].includes(host)) {
      return false;
    }
    return /\/(?:create-account\/profile|u\/signup\/profile|signup\/profile|about-you)(?:[/?#]|$)/i.test(String(parsed.pathname || ''));
  } catch {
    return false;
  }
}

function isLikelyLoggedInChatgptHomeUrl(rawUrl = location.href) {
  const url = String(rawUrl || '').trim();
  if (!url) {
    return false;
  }

  try {
    const parsed = new URL(url);
    const host = String(parsed.hostname || '').toLowerCase();
    if (!['chatgpt.com', 'www.chatgpt.com', 'chat.openai.com'].includes(host)) {
      return false;
    }

    const path = String(parsed.pathname || '');
    if (/^\/(?:auth\/|create-account\/|email-verification|log-in|add-phone)(?:[/?#]|$)/i.test(path)) {
      return false;
    }

    const signupTrigger = typeof findSignupEntryTrigger === 'function'
      ? findSignupEntryTrigger()
      : null;
    if (signupTrigger) {
      return false;
    }

    if (typeof document !== 'undefined' && document && typeof document.querySelectorAll === 'function') {
      const loginActionPattern = /登录|ログイン|サインイン|log\s*in|sign\s*in/i;
      const candidates = document.querySelectorAll(
        'a, button, [role="button"], [role="link"], input[type="button"], input[type="submit"]'
      );

      for (const el of candidates) {
        const text = typeof getActionText === 'function'
          ? getActionText(el)
          : [
            el?.textContent,
            el?.value,
            el?.getAttribute?.('aria-label'),
            el?.getAttribute?.('title'),
          ]
            .filter(Boolean)
            .join(' ')
            .replace(/\s+/g, ' ')
            .trim();
        if (!text || !loginActionPattern.test(text)) {
          continue;
        }

        const visible = typeof isVisibleElement === 'function'
          ? isVisibleElement(el)
          : true;
        if (!visible) {
          continue;
        }

        const enabled = typeof isActionEnabled === 'function'
          ? isActionEnabled(el)
          : (Boolean(el) && !el.disabled && el?.getAttribute?.('aria-disabled') !== 'true');
        if (enabled) {
          return false;
        }
      }
    }

    return true;
  } catch {
    return false;
  }
}

function isStep5CompletionChatgptUrl(rawUrl = location.href) {
  const url = String(rawUrl || '').trim();
  if (!url) {
    return false;
  }

  try {
    const parsed = new URL(url);
    const protocol = String(parsed.protocol || '').toLowerCase();
    const host = String(parsed.hostname || '').toLowerCase();
    if (protocol !== 'https:' || !['chatgpt.com', 'www.chatgpt.com'].includes(host)) {
      return false;
    }

    const path = String(parsed.pathname || '');
    return !/^\/(?:auth\/|create-account\/|email-verification|log-in|add-phone)(?:[/?#]|$)/i.test(path);
  } catch {
    return false;
  }
}

function getStep4PostVerificationState(options = {}) {
  const { ignoreVerificationVisibility = false } = options;
  // Newer auth flows can briefly render profile fields before the email-verification
  // form fully exits. Do not advance to Step 5 while verification UI is still present.
  if (!ignoreVerificationVisibility && isVerificationPageStillVisible()) {
    return null;
  }

  if (isStep5Ready() || isSignupProfilePageUrl()) {
    return {
      state: 'step5',
      url: location.href,
    };
  }

  if (isLikelyLoggedInChatgptHomeUrl()) {
    return {
      state: 'logged_in_home',
      skipProfileStep: true,
      url: location.href,
    };
  }

  return null;
}

function getPageTextSnapshot() {
  return (document.body?.innerText || document.body?.textContent || '')
    .replace(/\s+/g, ' ')
    .trim();
}

function getLoginVerificationDisplayedEmail() {
  const pageText = getPageTextSnapshot();
  const matches = pageText.match(/[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}/ig) || [];
  return matches[0] ? String(matches[0]).trim().toLowerCase() : '';
}

function getPhoneVerificationDisplayedPhone() {
  const pageText = getPageTextSnapshot();
  const matches = pageText.match(/\+\d[\d\s-]{6,}\d/g) || [];
  return matches[0] ? String(matches[0]).replace(/\s+/g, ' ').trim() : '';
}

function getOAuthConsentForm() {
  return document.querySelector(OAUTH_CONSENT_FORM_SELECTOR);
}

function getPrimaryContinueButton() {
  const consentForm = getOAuthConsentForm();
  if (consentForm) {
    const formButtons = Array.from(
      consentForm.querySelectorAll('button[type="submit"], input[type="submit"], [role="button"]')
    );

    const formContinueButton = formButtons.find((el) => {
      if (!isVisibleElement(el)) return false;

      const ddActionName = el.getAttribute?.('data-dd-action-name') || '';
      return ddActionName === 'Continue' || CONTINUE_ACTION_PATTERN.test(getActionText(el));
    });
    if (formContinueButton) {
      return formContinueButton;
    }

    const firstVisibleSubmit = formButtons.find(isVisibleElement);
    if (firstVisibleSubmit) {
      return firstVisibleSubmit;
    }
  }

  const continueBtn = document.querySelector(
    `${OAUTH_CONSENT_FORM_SELECTOR} button[type="submit"], button[type="submit"][data-dd-action-name="Continue"], button[type="submit"]._primary_3rdp0_107`
  );
  if (continueBtn && isVisibleElement(continueBtn)) {
    return continueBtn;
  }

  const buttons = document.querySelectorAll('button, [role="button"]');
  return Array.from(buttons).find((el) => {
    if (!isVisibleElement(el)) return false;

    const ddActionName = el.getAttribute?.('data-dd-action-name') || '';
    return ddActionName === 'Continue' || CONTINUE_ACTION_PATTERN.test(getActionText(el));
  }) || null;
}

function isOAuthConsentPage() {
  const pageText = getPageTextSnapshot();
  if (OAUTH_CONSENT_PAGE_PATTERN.test(pageText)) {
    return true;
  }

  if (getOAuthConsentForm()) {
    return true;
  }

  return /\bcodex\b/i.test(pageText) && /\bchatgpt\b/i.test(pageText) && Boolean(getPrimaryContinueButton());
}

function isVerificationPageStillVisible() {
  if (getCurrentAuthRetryPageState('signup_password') || getCurrentAuthRetryPageState('login')) {
    return false;
  }
  if (isPhoneVerificationPageReady()) {
    return false;
  }
  if (getVerificationCodeTarget()) return true;
  if (findResendVerificationCodeTrigger({ allowDisabled: true })) return true;
  if (document.querySelector('form[action*="email-verification" i]')) return true;

  if (!isEmailVerificationPage()) {
    return false;
  }

  return VERIFICATION_PAGE_PATTERN.test(getPageTextSnapshot());
}

function isAddPhonePageReady() {
  const path = `${location.pathname || ''} ${location.href || ''}`;
  if (/\/add-phone(?:[/?#]|$)/i.test(path)) return true;

  const addPhoneForm = document.querySelector('form[action*="/add-phone" i]');
  if (addPhoneForm && isVisibleElement(addPhoneForm)) {
    return true;
  }

  return ADD_PHONE_PAGE_PATTERN.test(getPageTextSnapshot());
}

function isAddEmailPageReady() {
  const path = `${location.pathname || ''} ${location.href || ''}`;
  if (/\/add-email(?:[/?#]|$)/i.test(path)) {
    return true;
  }

  const emailInput = getLoginEmailInput();
  if (!emailInput) {
    return false;
  }

  const form = emailInput.form || emailInput.closest?.('form') || null;
  const formAction = String(form?.getAttribute?.('action') || form?.action || '');
  if (/\/add-email(?:[/?#]|$)/i.test(formAction)) {
    return true;
  }

  const pageText = getPageTextSnapshot();
  return ADD_EMAIL_PAGE_PATTERN.test(pageText)
    && !/继续使用(?:电子邮件地址|邮箱)登录|(?:メールアドレス|メール|電子メール)(?:で|を使用して)?(?:続行|続ける|ログイン|サインイン)|continue\s+using\s+(?:an?\s+)?email(?:\s+address)?\s+(?:to\s+)?(?:log\s*in|sign\s*in)|continue\s+with\s+email/i.test(pageText);
}

function isPhoneVerificationPageReady() {
  const path = `${location.pathname || ''} ${location.href || ''}`;
  const isPhoneVerificationRoute = /\/phone-verification(?:[/?#]|$)/i.test(path);
  const isContactVerificationRoute = /\/contact-verification(?:[/?#]|$)/i.test(path);
  if (isContactVerificationRoute && getContactVerificationServerErrorText()) {
    return false;
  }
  if (isPhoneVerificationRoute || isContactVerificationRoute) {
    return true;
  }

  const form = document.querySelector('form[action*="/phone-verification" i]');
  if (form && isVisibleElement(form)) {
    return true;
  }

  if (document.querySelector('button[name="intent"][value="resend"]') && getPhoneVerificationDisplayedPhone()) {
    return true;
  }

  const pageText = getPageTextSnapshot();
  const displayedPhone = getPhoneVerificationDisplayedPhone();
  return Boolean(getVerificationCodeTarget())
    && Boolean(displayedPhone)
    && /check\s+your\s+phone|phone\s+verification|verify\s+your\s+phone|sms|text\s+message|code\s+to\s+\+/.test(pageText);
}

function getDocumentReadyStateSnapshot() {
  const readyState = typeof document !== 'undefined' && document
    ? String(document.readyState || '').trim().toLowerCase()
    : '';
  return readyState || 'complete';
}

function isDocumentLoadComplete() {
  return getDocumentReadyStateSnapshot() === 'complete';
}

async function waitForDocumentLoadComplete(timeout = 15000, label = '页面') {
  const start = Date.now();

  while (Date.now() - start < timeout) {
    throwIfStopped();
    if (isDocumentLoadComplete()) {
      return true;
    }
    await sleep(150);
  }

  throw new Error(`${label}长时间未完成加载，当前 readyState=${getDocumentReadyStateSnapshot()}。URL: ${location.href}`);
}

function isSignupVerificationPageInteractiveReady(snapshot = null) {
  if (!isDocumentLoadComplete()) {
    return false;
  }

  const resolvedSnapshot = snapshot || inspectSignupVerificationState();
  if (resolvedSnapshot?.state !== 'verification') {
    return false;
  }

  return Boolean(getVerificationCodeTarget());
}

function isStep8Ready() {
  const continueBtn = getPrimaryContinueButton();
  if (!continueBtn) return false;
  if (isVerificationPageStillVisible()) return false;
  if (isPhoneVerificationPageReady()) return false;
  if (isAddPhonePageReady()) return false;
  if (isAddEmailPageReady()) return false;

  return isOAuthConsentPage();
}

const phoneAuthHelpers = self.MultiPagePhoneAuth?.createPhoneAuthHelpers?.({
  fillInput,
  getActionText,
  getPageTextSnapshot,
  getVerificationErrorText,
  humanPause,
  isActionEnabled,
  isAddPhonePageReady,
  isConsentReady: isStep8Ready,
  isPhoneVerificationPageReady,
  isVisibleElement,
  simulateClick,
  sleep,
  throwIfStopped,
  waitForElement,
}) || {
  submitPhoneNumber: async () => {
    throw new Error('Phone auth helpers are unavailable.');
  },
  submitPhoneVerificationCode: async () => {
    throw new Error('Phone auth helpers are unavailable.');
  },
  resendPhoneVerificationCode: async () => {
    throw new Error('Phone auth helpers are unavailable.');
  },
  checkPhoneResendError: () => ({ hasError: false, reason: '', message: '', url: location.href }),
  returnToAddPhone: async () => {
    throw new Error('Phone auth helpers are unavailable.');
  },
};

async function waitForPhoneVerificationProfileCompletion(timeout = 30000) {
  const start = Date.now();

  while (Date.now() - start < timeout) {
    throwIfStopped();

    if (isStep8Ready()) {
      return {
        success: true,
        consentReady: true,
        url: location.href,
      };
    }

    if (isAddPhonePageReady()) {
      return {
        returnedToAddPhone: true,
        url: location.href,
      };
    }

    await sleep(150);
  }

  if (isStep8Ready()) {
    return {
      success: true,
      consentReady: true,
      url: location.href,
    };
  }

  return {
    success: true,
    assumed: true,
    url: location.href,
  };
}

async function submitPhoneVerificationCodeWithProfileFallback(payload = {}) {
  const result = await phoneAuthHelpers.submitPhoneVerificationCode(payload);
  if (!(isStep5Ready() || isSignupProfilePageUrl(result?.url || location.href))) {
    return result;
  }

  const signupProfile = payload?.signupProfile || {};
  if (!signupProfile.firstName || !signupProfile.lastName) {
    throw new Error('手机号验证后进入资料页，但未提供步骤 5 所需的姓名数据。');
  }

  await step5_fillNameBirthday(signupProfile);
  const nextState = await waitForPhoneVerificationProfileCompletion();
  const mergedResult = {
    ...result,
    ...nextState,
    profileCompleted: true,
  };
  if (nextState.consentReady || nextState.returnedToAddPhone) {
    delete mergedResult.assumed;
  }
  return mergedResult;
}

function normalizeInlineText(text) {
  return (text || '').replace(/\s+/g, ' ').trim();
}

function isStep5AllConsentText(text) {
  const normalizedText = normalizeInlineText(text).toLowerCase();
  if (!normalizedText) return false;

  return /i\s+agree\s+to\s+all\s+of\s+the\s+following/i.test(normalizedText)
    || normalizedText.includes('\u4ee5\u4e0b\u306e\u3059\u3079\u3066\u306b\u540c\u610f')
    || normalizedText.includes('\u3059\u3079\u3066\u306b\u540c\u610f')
    || normalizedText.includes('\u540c\u610f\u3057\u307e\u3059')
    || normalizedText.includes('\u6211\u540c\u610f\u4ee5\u4e0b\u6240\u6709\u5404\u9879')
    || normalizedText.includes('\u540c\u610f\u4ee5\u4e0b\u6240\u6709\u5404\u9879')
    || normalizedText.includes('\u6211\u540c\u610f\u6240\u6709')
    || normalizedText.includes('\u5168\u90e8\u540c\u610f');
}

function findStep5AllConsentCheckbox() {
  const namedCandidates = Array.from(document.querySelectorAll('input[name="allCheckboxes"][type="checkbox"]'))
    .filter((el) => {
      const checkboxLabel = el.closest?.('label') || null;
      return isVisibleElement(el) || (checkboxLabel && isVisibleElement(checkboxLabel));
    });

  const namedMatch = namedCandidates.find((el) => {
    const checkboxLabel = el.closest?.('label') || null;
    const checkboxText = normalizeInlineText([
      checkboxLabel?.textContent || '',
      el.getAttribute?.('aria-label') || '',
      el.getAttribute?.('title') || '',
      el.getAttribute?.('name') || '',
    ].filter(Boolean).join(' '));
    return isStep5AllConsentText(checkboxText);
  });
  if (namedMatch) {
    return namedMatch;
  }
  if (namedCandidates.length > 0) {
    return namedCandidates[0];
  }

  return Array.from(document.querySelectorAll('input[type="checkbox"]'))
    .find((el) => {
      const checkboxLabel = el.closest?.('label') || null;
      if (!isVisibleElement(el) && !(checkboxLabel && isVisibleElement(checkboxLabel))) {
        return false;
      }
      const checkboxText = normalizeInlineText([
        checkboxLabel?.textContent || '',
        el.getAttribute?.('aria-label') || '',
        el.getAttribute?.('title') || '',
        el.getAttribute?.('name') || '',
      ].filter(Boolean).join(' '));
      return isStep5AllConsentText(checkboxText);
    }) || null;
}

function isStep5CheckboxChecked(checkbox) {
  if (!checkbox) return false;
  if (checkbox.checked === true) return true;

  const ariaChecked = String(
    checkbox.getAttribute?.('aria-checked')
    || checkbox.closest?.('[role="checkbox"]')?.getAttribute?.('aria-checked')
    || ''
  ).toLowerCase();
  return ariaChecked === 'true';
}

function findBirthdayReactAriaSelect(labelText) {
  const normalizedLabels = (Array.isArray(labelText) ? labelText : [labelText])
    .map((text) => normalizeInlineText(text))
    .filter(Boolean);
  const roots = document.querySelectorAll('.react-aria-Select');

  for (const root of roots) {
    const labelEl = Array.from(root.querySelectorAll('span')).find((el) => normalizedLabels.includes(normalizeInlineText(el.textContent)));
    if (!labelEl) continue;

    const item = root.closest('[class*="selectItem"], ._selectItem_ppsls_113') || root.parentElement;
    const nativeSelect = item?.querySelector('[data-testid="hidden-select-container"] select') || null;
    const button = root.querySelector('button[aria-haspopup="listbox"]') || null;
    const valueEl = root.querySelector('.react-aria-SelectValue') || null;

    return { root, item, labelEl, nativeSelect, button, valueEl };
  }

  return null;
}

async function setReactAriaBirthdaySelect(control, value) {
  if (!control?.nativeSelect) {
    throw new Error('未找到可写入的生日下拉框。');
  }

  const desiredValue = String(value);
  const option = Array.from(control.nativeSelect.options).find((item) => item.value === desiredValue);
  if (!option) {
    throw new Error(`生日下拉框中不存在值 ${desiredValue}。`);
  }

  control.nativeSelect.value = desiredValue;
  option.selected = true;
  control.nativeSelect.dispatchEvent(new Event('input', { bubbles: true }));
  control.nativeSelect.dispatchEvent(new Event('change', { bubbles: true }));
  await sleep(120);
}

function getStep5ErrorText() {
  const messages = [];
  const selectors = [
    '.react-aria-FieldError',
    '[slot="errorMessage"]',
    '[id$="-error"]',
    '[id$="-errors"]',
    '[role="alert"]',
    '[aria-live="assertive"]',
    '[aria-live="polite"]',
    '[class*="error"]',
  ];

  for (const selector of selectors) {
    document.querySelectorAll(selector).forEach((el) => {
      if (!isVisibleElement(el)) return;
      const text = normalizeInlineText(el.textContent);
      if (text) {
        messages.push(text);
      }
    });
  }

  const invalidField = Array.from(document.querySelectorAll('[aria-invalid="true"], [data-invalid="true"]'))
    .find((el) => isVisibleElement(el));
  if (invalidField) {
    const wrapper = invalidField.closest('form, fieldset, [data-rac], div');
    if (wrapper) {
      const text = normalizeInlineText(wrapper.textContent);
      if (text) {
        messages.push(text);
      }
    }
  }

  return messages.find((text) => STEP5_SUBMIT_ERROR_PATTERN.test(text)) || '';
}


function isSignupPasswordPage() {
  return /\/(?:create-account|log-in)\/password(?:[/?#]|$)/i.test(location.pathname || '');
}

function getSignupPasswordInput() {
  const input = document.querySelector('input[type="password"]');
  return input && isVisibleElement(input) ? input : null;
}

function getSignupPasswordSubmitButton({ allowDisabled = false } = {}) {
  const direct = document.querySelector('button[type="submit"]');
  if (direct && isVisibleElement(direct) && (allowDisabled || isActionEnabled(direct))) {
    return direct;
  }

  const candidates = document.querySelectorAll('button, [role="button"]');
  return Array.from(candidates).find((el) => {
    if (!isVisibleElement(el) || (!allowDisabled && !isActionEnabled(el))) return false;
    const text = getActionText(el);
    return /继续|continue|submit|创建|続行|続ける|次へ|サインアップ|登録|作成|create/i.test(text);
  }) || null;
}

function getAuthRetryButton({ allowDisabled = false } = {}) {
  if (authPageRecovery?.getAuthRetryButton) {
    return authPageRecovery.getAuthRetryButton({ allowDisabled });
  }

  const direct = document.querySelector('button[data-dd-action-name="Try again"]');
  if (direct && isVisibleElement(direct) && (allowDisabled || isActionEnabled(direct))) {
    return direct;
  }

  const candidates = document.querySelectorAll('button, [role="button"]');
  return Array.from(candidates).find((el) => {
    if (!isVisibleElement(el) || (!allowDisabled && !isActionEnabled(el))) return false;
    const text = getActionText(el);
    return /重试|try\s+again/i.test(text);
  }) || null;
}

function getAuthTimeoutErrorPageState(options = {}) {
  if (authPageRecovery?.getAuthTimeoutErrorPageState) {
    return authPageRecovery.getAuthTimeoutErrorPageState(options);
  }

  const { pathPatterns = [] } = options;
  const path = location.pathname || '';
  if (pathPatterns.length && !pathPatterns.some((pattern) => pattern.test(path))) {
    return null;
  }

  const retryButton = getAuthRetryButton({ allowDisabled: true });
  if (!retryButton) {
    return null;
  }

  const text = getPageTextSnapshot();
  const titleMatched = AUTH_TIMEOUT_ERROR_TITLE_PATTERN.test(text)
    || AUTH_TIMEOUT_ERROR_TITLE_PATTERN.test(document.title || '');
  const detailMatched = AUTH_TIMEOUT_ERROR_DETAIL_PATTERN.test(text);
  const routeErrorMatched = AUTH_ROUTE_ERROR_PATTERN.test(text);
  const fetchFailedMatched = /failed\s+to\s+fetch|network\s+error|fetch\s+failed/i.test(text);
  const maxCheckAttemptsBlocked = /max_check_attempts/i.test(text);
  const emailInUseBlocked = /email_in_use/i.test(text);
  const userAlreadyExistsBlocked = /user_already_exists/i.test(text);

  if (!titleMatched && !detailMatched && !routeErrorMatched && !fetchFailedMatched && !maxCheckAttemptsBlocked && !emailInUseBlocked && !userAlreadyExistsBlocked) {
    return null;
  }

  return {
    path,
    url: location.href,
    retryButton,
    retryEnabled: isActionEnabled(retryButton),
    titleMatched,
    detailMatched,
    routeErrorMatched,
    fetchFailedMatched,
    maxCheckAttemptsBlocked,
    emailInUseBlocked,
    userAlreadyExistsBlocked,
  };
}

function getSignupAuthRetryPathPatterns() {
  return [
    /\/create-account\/password(?:[/?#]|$)/i,
    /\/email-verification(?:[/?#]|$)/i,
  ];
}

function getLoginAuthRetryPathPatterns() {
  return [
    /\/log-in(?:[/?#]|$)/i,
    /\/email-verification(?:[/?#]|$)/i,
  ];
}

function getAuthRetryPathPatternsForFlow(flow = 'auth') {
  switch (flow) {
    case 'signup':
    case 'signup_password':
      return getSignupAuthRetryPathPatterns();
    case 'login':
      return getLoginAuthRetryPathPatterns();
    default:
      return [];
  }
}

function getCurrentAuthRetryPageState(flow = 'auth') {
  return getAuthTimeoutErrorPageState({
    pathPatterns: getAuthRetryPathPatternsForFlow(flow),
  });
}

async function recoverCurrentAuthRetryPage(payload = {}) {
  const performOperationWithDelay = typeof getOperationDelayRunner === 'function'
    ? getOperationDelayRunner()
    : async (metadata, operation) => {
        const rootScope = typeof window !== 'undefined' ? window : globalThis;
        const gate = rootScope?.CodexOperationDelay?.performOperationWithDelay;
        return typeof gate === 'function' ? gate(metadata, operation) : operation();
      };
  const {
    flow = 'auth',
    logLabel = '',
    maxClickAttempts = 5,
    pathPatterns = null,
    step = null,
    timeoutMs = 12000,
    waitAfterClickMs = 3000,
  } = payload;
  const resolvedPathPatterns = Array.isArray(pathPatterns)
    ? pathPatterns
    : getAuthRetryPathPatternsForFlow(flow);
  if (authPageRecovery?.recoverAuthRetryPage) {
    return authPageRecovery.recoverAuthRetryPage({
      logLabel,
      maxClickAttempts,
      pathPatterns: resolvedPathPatterns,
      step,
      stepKey: step === 8 || flow === 'login' ? 'oauth-login' : 'fetch-signup-code',
      timeoutMs,
      waitAfterClickMs,
    });
  }

  const maxIdlePolls = timeoutMs > 0
    ? Math.max(1, Math.ceil(timeoutMs / Math.max(1, 250)))
    : Number.POSITIVE_INFINITY;
  let clickCount = 0;
  let idlePollCount = 0;
  while (clickCount < maxClickAttempts) {
    throwIfStopped();
    const retryState = getAuthTimeoutErrorPageState({ pathPatterns: resolvedPathPatterns });
    if (!retryState) {
      return {
        recovered: clickCount > 0,
        clickCount,
        url: location.href,
      };
    }

    if (retryState.maxCheckAttemptsBlocked) {
      throw new Error('CF_SECURITY_BLOCKED::您已触发Cloudflare 安全防护系统，已完全停止流程，请不要短时间内多次进行重新发送验证码，连续刷新、反复点击重试会加重风控；请先关闭页面等待 15-30 分钟，让系统的临时限制自动解除。或者更换浏览器');
    }
    if (retryState.userAlreadyExistsBlocked) {
      throw createSignupUserAlreadyExistsError();
    }
    if (retryState.retryButton && retryState.retryEnabled) {
      idlePollCount = 0;
      clickCount += 1;
      log(`${logLabel || `步骤 ${step || '?'}：检测到重试页，正在点击“重试”恢复`}（第 ${clickCount} 次）...`, 'warn');
      await humanPause(300, 800);
      await performOperationWithDelay({ stepKey: step === 8 || flow === 'login' ? 'oauth-login' : 'fetch-signup-code', kind: 'click', label: 'auth-retry-click' }, async () => {
        simulateClick(retryState.retryButton);
      });
      const settleStart = Date.now();
      while (Date.now() - settleStart < waitAfterClickMs) {
        throwIfStopped();
        if (!getAuthTimeoutErrorPageState({ pathPatterns: resolvedPathPatterns })) {
          return {
            recovered: true,
            clickCount,
            url: location.href,
          };
        }
        await sleep(250);
      }
      continue;
    }

    idlePollCount += 1;
    if (idlePollCount >= maxIdlePolls) {
      throw new Error(`${logLabel || `步骤 ${step || '?'}：重试页恢复`}超时：重试按钮长时间不可点击。URL: ${location.href}`);
    }

    await sleep(250);
  }

  const finalRetryState = getAuthTimeoutErrorPageState({ pathPatterns: resolvedPathPatterns });
  if (!finalRetryState) {
    return {
      recovered: clickCount > 0,
      clickCount,
      url: location.href,
    };
  }
  if (finalRetryState.maxCheckAttemptsBlocked) {
    throw new Error('CF_SECURITY_BLOCKED::您已触发Cloudflare 安全防护系统，已完全停止流程，请不要短时间内多次进行重新发送验证码，连续刷新、反复点击重试会加重风控；请先关闭页面等待 15-30 分钟，让系统的临时限制自动解除。或者更换浏览器');
  }
  if (finalRetryState.userAlreadyExistsBlocked) {
    throw createSignupUserAlreadyExistsError();
  }

  throw new Error(`${logLabel || `步骤 ${step || '?'}：重试页恢复`}失败：已连续点击“重试” ${maxClickAttempts} 次，页面仍未恢复。URL: ${location.href}`);
}

function getSignupPasswordTimeoutErrorPageState() {
  return getAuthTimeoutErrorPageState({
    pathPatterns: getSignupAuthRetryPathPatterns(),
  });
}

function getLoginTimeoutErrorPageState() {
  return getAuthTimeoutErrorPageState({
    pathPatterns: getLoginAuthRetryPathPatterns(),
  });
}

function isLoginPhoneUsernameKind(rawUrl = location.href) {
  const url = String(rawUrl || '').trim();
  if (!url) {
    return false;
  }

  try {
    const parsed = new URL(url);
    return /\/log-in(?:[/?#]|$)/i.test(parsed.pathname || '')
      && String(parsed.searchParams.get('usernameKind') || '').toLowerCase() === 'phone_number';
  } catch {
    return /\/log-in(?:[/?#]|$)/i.test(url) && /[?&]usernameKind=phone_number(?:[&#]|$)/i.test(url);
  }
}

function isLoginPhoneEntryPageText(pageText = getPageTextSnapshot()) {
  const normalizedText = String(pageText || '').replace(/\s+/g, ' ').trim();
  if (!normalizedText) {
    return false;
  }

  if (isAddPhonePageReady() || isPhoneVerificationPageReady()) {
    return false;
  }

  return LOGIN_PHONE_ENTRY_PAGE_PATTERN.test(normalizedText);
}

function isInsideHiddenPhoneControl(element) {
  if (!element) {
    return true;
  }
  return Boolean(element.closest?.('[aria-hidden="true"], [hidden], [data-testid="hidden-select-container"], [data-react-aria-prevent-focus="true"]'));
}

function summarizePhoneInputCandidate(element, options = {}) {
  const summary = {
    tag: (element?.tagName || '').toLowerCase(),
    type: '',
    name: '',
    id: '',
    autocomplete: '',
    placeholder: '',
    ariaLabel: '',
    visible: false,
    hiddenControl: true,
    readOnly: false,
    maxLength: 0,
    usable: false,
    skipReason: '',
  };

  if (!element) {
    summary.skipReason = 'missing_element';
    return summary;
  }

  summary.visible = isVisibleElement(element);
  summary.hiddenControl = isInsideHiddenPhoneControl(element);
  summary.type = String(element.getAttribute?.('type') || element.type || '').trim().toLowerCase();
  summary.name = String(element.getAttribute?.('name') || element.name || '').trim();
  summary.id = String(element.getAttribute?.('id') || element.id || '').trim();
  summary.autocomplete = String(element.getAttribute?.('autocomplete') || '').trim().toLowerCase();
  summary.placeholder = String(element.getAttribute?.('placeholder') || '').trim().slice(0, 80);
  summary.ariaLabel = String(element.getAttribute?.('aria-label') || '').trim().slice(0, 80);

  const hasReadonlyAttribute = typeof element.hasAttribute === 'function'
    ? element.hasAttribute('readonly')
    : element.readOnly === true;
  summary.readOnly = element.readOnly === true
    || hasReadonlyAttribute
    || String(element.getAttribute?.('aria-readonly') || '').trim().toLowerCase() === 'true';
  summary.maxLength = Number(element.getAttribute?.('maxlength') || element.maxLength || 0);

  if (summary.hiddenControl) {
    summary.skipReason = 'inside_hidden_control';
    return summary;
  }
  if (!summary.visible) {
    summary.skipReason = 'not_visible';
    return summary;
  }
  if (summary.type === 'hidden') {
    summary.skipReason = 'hidden_type';
    return summary;
  }
  if (summary.readOnly) {
    summary.skipReason = 'readonly';
    return summary;
  }
  if (summary.maxLength === 6) {
    summary.skipReason = 'verification_code_input';
    return summary;
  }

  const normalizedName = summary.name.toLowerCase();
  const normalizedId = summary.id.toLowerCase();
  const combinedText = `${normalizedName} ${normalizedId} ${summary.placeholder} ${summary.ariaLabel}`;
  if (isLoginEmailLikeInput(element)) {
    summary.skipReason = 'email_like';
    return summary;
  }
  if (
    summary.type === 'tel'
    || summary.autocomplete === 'tel'
    || /phone|tel/i.test(`${normalizedName} ${normalizedId}`)
    || /手机|电话|手机号|电话号码|国家号码|phone|mobile|telephone/i.test(combinedText)
  ) {
    summary.usable = true;
    return summary;
  }

  if (options.allowGenericText && (!summary.type || summary.type === 'text')) {
    summary.usable = true;
    return summary;
  }

  summary.skipReason = 'not_phone_like';
  return summary;
}

function isUsablePhoneInputElement(element, options = {}) {
  return summarizePhoneInputCandidate(element, options).usable;
}

function collectPhoneInputCandidates(selector, options = {}) {
  return Array.from(document.querySelectorAll(selector))
    .map((element) => summarizePhoneInputCandidate(element, options));
}

function findUsablePhoneInput(selector, options = {}) {
  return Array.from(document.querySelectorAll(selector))
    .find((element) => isUsablePhoneInputElement(element, options)) || null;
}

function getLoginInputAttributeText(input) {
  return {
    type: String(input?.getAttribute?.('type') || input?.type || '').trim().toLowerCase(),
    autocomplete: String(input?.getAttribute?.('autocomplete') || '').trim().toLowerCase(),
    name: String(input?.getAttribute?.('name') || input?.name || '').trim(),
    id: String(input?.getAttribute?.('id') || input?.id || '').trim(),
    placeholder: String(input?.getAttribute?.('placeholder') || '').trim(),
    ariaLabel: String(input?.getAttribute?.('aria-label') || '').trim(),
  };
}

function isLoginEmailLikeInput(input) {
  const summary = getLoginInputAttributeText(input);
  const nameId = `${summary.name} ${summary.id}`;
  const labelText = `${summary.placeholder} ${summary.ariaLabel}`;
  return summary.type === 'email'
    || summary.autocomplete === 'email'
    || /email|mail/i.test(nameId)
    || /email|电子邮件|邮箱|メールアドレス|メール|電子メール/i.test(labelText);
}

function getLoginEmailInput() {
  const input = Array.from(document.querySelectorAll([
    'input[type="email"]',
    'input[autocomplete="email"]',
    'input[name="email"]',
    'input[name="username"]',
    'input[autocomplete="username"]',
    'input[id*="email" i]',
    'input[placeholder*="email" i]',
    'input[placeholder*="Email"]',
    'input[placeholder*="电子邮件"]',
    'input[placeholder*="邮箱"]',
    'input[placeholder*="メール"]',
    'input[aria-label*="email" i]',
    'input[aria-label*="电子邮件"]',
    'input[aria-label*="邮箱"]',
    'input[aria-label*="メール"]',
  ].join(', '))).find((candidate) => isVisibleElement(candidate)) || null;
  if (!input) {
    return null;
  }
  if ((isLoginPhoneUsernameKind() || isLoginPhoneEntryPageText()) && !isLoginEmailLikeInput(input)) {
    return null;
  }
  return input;
}

function getLoginPhoneInput() {
  const phonePage = isLoginPhoneUsernameKind() || isLoginPhoneEntryPageText();
  const selector = [
    'input[type="tel"]:not([maxlength="6"])',
    'input[name*="phone" i]:not([type="hidden"])',
    'input[id*="phone" i]:not([type="hidden"])',
    'input[autocomplete="tel"]',
    'input[inputmode="tel"]',
    'input[placeholder*="phone" i]',
    'input[aria-label*="phone" i]',
    'input[placeholder*="telephone" i]',
    'input[aria-label*="telephone" i]',
    'input[placeholder*="手机"]',
    'input[aria-label*="手机"]',
    'input[placeholder*="电话"]',
    'input[aria-label*="电话"]',
    'input[placeholder*="電話"]',
    'input[aria-label*="電話"]',
    'input[placeholder*="携帯"]',
    'input[aria-label*="携帯"]',
    phonePage ? 'input[name="username"]:not([maxlength="6"])' : '',
    phonePage ? 'input[id*="username" i]:not([maxlength="6"])' : '',
    phonePage ? 'input[autocomplete="username"]:not([maxlength="6"])' : '',
    phonePage ? 'input[type="text"]:not([maxlength="6"])' : '',
  ].filter(Boolean).join(', ');
  return findUsablePhoneInput(selector, { allowGenericText: phonePage });
}

function getLoginPhoneInputDiagnostics(phoneInput) {
  return {
    tag: (phoneInput?.tagName || '').toLowerCase(),
    type: String(phoneInput?.getAttribute?.('type') || phoneInput?.type || '').trim().toLowerCase(),
    name: String(phoneInput?.getAttribute?.('name') || phoneInput?.name || '').trim(),
    id: String(phoneInput?.getAttribute?.('id') || phoneInput?.id || '').trim(),
    autocomplete: String(phoneInput?.getAttribute?.('autocomplete') || '').trim().toLowerCase(),
    placeholder: String(phoneInput?.getAttribute?.('placeholder') || '').trim().slice(0, 80),
    ariaLabel: String(phoneInput?.getAttribute?.('aria-label') || '').trim().slice(0, 80),
    value: getPhoneInputRenderedValue(phoneInput),
  };
}

function getLoginPhoneHiddenValueInput(phoneInput) {
  const form = phoneInput?.form || phoneInput?.closest?.('form') || null;
  const root = form || phoneInput?.closest?.('fieldset, form, [data-rac], div') || document;
  const candidates = Array.from(root?.querySelectorAll?.([
    'input[name="phone"]',
    'input[name*="phone" i]',
    'input[name="phoneNumber"]',
    'input[name*="telephone" i]',
    'input[type="hidden"][id*="phone" i]',
    'input[type="hidden"][id*="telephone" i]',
    'input[type="hidden"][name*="phone" i]',
    'input[type="hidden"][name*="telephone" i]',
  ].join(', ')) || []);
  return candidates.find((input) => {
    if (!input || input === phoneInput) return false;
    const type = String(input.getAttribute?.('type') || input.type || '').trim().toLowerCase();
    return type === 'hidden' || !isVisibleElement(input);
  }) || null;
}

function getLoginPhoneHiddenValueDiagnostics(hiddenInput) {
  return {
    tag: (hiddenInput?.tagName || '').toLowerCase(),
    type: String(hiddenInput?.getAttribute?.('type') || hiddenInput?.type || '').trim().toLowerCase(),
    name: String(hiddenInput?.getAttribute?.('name') || hiddenInput?.name || '').trim(),
    id: String(hiddenInput?.getAttribute?.('id') || hiddenInput?.id || '').trim(),
    value: String(hiddenInput?.value || hiddenInput?.getAttribute?.('value') || '').trim(),
  };
}

function getLoginPasswordInput() {
  const input = document.querySelector('input[type="password"]');
  return input && isVisibleElement(input) ? input : null;
}

function getLoginSubmitButton({ allowDisabled = false } = {}) {
  const direct = document.querySelector('button[type="submit"], input[type="submit"]');
  if (direct && isVisibleElement(direct) && (allowDisabled || isActionEnabled(direct))) {
    return direct;
  }

  const candidates = document.querySelectorAll(
    'button, a, [role="button"], [role="link"], input[type="button"], input[type="submit"]'
  );
  return Array.from(candidates).find((el) => {
    if (!isVisibleElement(el) || (!allowDisabled && !isActionEnabled(el))) return false;
    const text = getActionText(el);
    if (!text || ONE_TIME_CODE_LOGIN_PATTERN.test(text)) return false;
    return /continue|next|submit|sign\s*in|log\s*in|继续|下一步|登录|続行|続ける|次へ|ログイン|サインイン|送信/i.test(text);
  }) || null;
}

function normalizeCountryLabel(value) {
  const phoneCountryUtils = (typeof self !== 'undefined' ? self : globalThis)?.MultiPagePhoneCountryUtils
    || globalThis?.MultiPagePhoneCountryUtils
    || {};
  if (typeof phoneCountryUtils.normalizeCountryLabel === 'function') {
    return phoneCountryUtils.normalizeCountryLabel(value);
  }
  return String(value || '')
    .normalize('NFKD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/&/g, ' and ')
    .replace(/[^\p{L}\p{N}\s]/gu, ' ')
    .replace(/\s+/g, ' ')
    .trim()
    .toLowerCase();
}

function getLoginPhoneCountrySelect(phoneInput) {
  const scope = phoneInput?.closest?.('fieldset, form, [data-rac], div') || document;
  const select = scope.querySelector?.('select');
  return select && isVisibleElement(select) ? select : null;
}

function getLoginPhoneCountryOptionLabel(option) {
  const phoneCountryUtils = (typeof self !== 'undefined' ? self : globalThis)?.MultiPagePhoneCountryUtils
    || globalThis?.MultiPagePhoneCountryUtils
    || {};
  if (typeof phoneCountryUtils.getOptionLabel === 'function') {
    return phoneCountryUtils.getOptionLabel(option);
  }
  return String(option?.textContent || option?.label || '')
    .replace(/\s+/g, ' ')
    .trim();
}

function getLoginPhoneCountryOptionMatchLabels(option) {
  const phoneCountryUtils = (typeof self !== 'undefined' ? self : globalThis)?.MultiPagePhoneCountryUtils
    || globalThis?.MultiPagePhoneCountryUtils
    || {};
  if (typeof phoneCountryUtils.getOptionMatchLabels === 'function') {
    const rootScope = typeof self !== 'undefined' ? self : globalThis;
    return phoneCountryUtils.getOptionMatchLabels(option, {
      document: typeof document !== 'undefined' ? document : null,
      navigator: rootScope?.navigator || globalThis?.navigator || null,
      getOptionLabel: getLoginPhoneCountryOptionLabel,
    });
  }

  const labels = new Set();
  const pushLabel = (value) => {
    const label = String(value || '').replace(/\s+/g, ' ').trim();
    if (label) {
      labels.add(label);
    }
  };

  pushLabel(getLoginPhoneCountryOptionLabel(option));
  pushLabel(option?.value);
  return Array.from(labels);
}

function findLoginPhoneCountryOptionByLabel(select, countryLabel) {
  const phoneCountryUtils = (typeof self !== 'undefined' ? self : globalThis)?.MultiPagePhoneCountryUtils
    || globalThis?.MultiPagePhoneCountryUtils
    || {};
  if (select && typeof phoneCountryUtils.findOptionByCountryLabel === 'function') {
    return phoneCountryUtils.findOptionByCountryLabel(select.options, countryLabel, {
      document: typeof document !== 'undefined' ? document : null,
      navigator: (typeof self !== 'undefined' ? self : globalThis)?.navigator || globalThis?.navigator || null,
      getOptionLabel: getLoginPhoneCountryOptionLabel,
    });
  }

  const normalizedTarget = normalizeCountryLabel(countryLabel);
  if (!select || !normalizedTarget) {
    return null;
  }

  const options = Array.from(select.options || []);
  return options.find((option) => (
    getLoginPhoneCountryOptionMatchLabels(option)
      .some((label) => normalizeCountryLabel(label) === normalizedTarget)
  )) || options.find((option) => {
    const normalizedLabels = getLoginPhoneCountryOptionMatchLabels(option)
      .map((label) => normalizeCountryLabel(label))
      .filter(Boolean);
    return normalizedLabels.some((optionLabel) => (
      optionLabel.length > 2
      && normalizedTarget.length > 2
      && (optionLabel.includes(normalizedTarget) || normalizedTarget.includes(optionLabel))
    ));
  }) || null;
}

function findLoginPhoneCountryOptionByNumber(select, phoneNumber) {
  if (!select) {
    return null;
  }
  const phoneCountryUtils = (typeof self !== 'undefined' ? self : globalThis)?.MultiPagePhoneCountryUtils
    || globalThis?.MultiPagePhoneCountryUtils
    || {};
  if (typeof phoneCountryUtils.findOptionByPhoneNumber === 'function') {
    return phoneCountryUtils.findOptionByPhoneNumber(select.options, phoneNumber, {
      getOptionLabel: getLoginPhoneCountryOptionLabel,
    });
  }
  const digits = normalizePhoneDigits(phoneNumber);
  if (!digits) {
    return null;
  }

  let bestMatch = null;
  let bestDialCodeLength = 0;
  for (const option of Array.from(select.options || [])) {
    const dialCode = normalizePhoneDigits(extractDialCodeFromText(getLoginPhoneCountryOptionLabel(option)));
    if (!dialCode || !digits.startsWith(dialCode)) {
      continue;
    }
    if (dialCode.length > bestDialCodeLength) {
      bestMatch = option;
      bestDialCodeLength = dialCode.length;
    }
  }
  return bestMatch;
}

async function selectCountryForPhoneInput(phoneInput, phoneNumber = '', countryLabel = '', options = {}) {
  const visibleStep = Math.floor(Number(options?.visibleStep) || 0) || 7;
  const selection = await ensureSignupPhoneCountrySelected(phoneInput, {
    countryLabel,
    phoneNumber,
  });
  const selectedOption = selection.selectedOption || getSignupPhoneSelectedCountryOption(phoneInput);
  const targetDialCode = resolveSignupPhoneTargetDialCode({ countryLabel, phoneNumber }, selectedOption);
  const displayedDialCode = getSignupPhoneDisplayedDialCode(phoneInput);

  if (selection.hasCountryControl && targetDialCode) {
    if (!selection.matched || (displayedDialCode && displayedDialCode !== targetDialCode)) {
      const currentCountryText = getSignupPhoneCountryButtonText(phoneInput) || displayedDialCode || '未知';
      const targetLabel = `目标区号 +${targetDialCode}（号码 ${phoneNumber}${countryLabel ? `，国家 ${countryLabel}` : ''}）`;
      throw new Error(`步骤 ${visibleStep}：手机号登录国家下拉框未能自动切换到 ${targetLabel}，当前显示为 ${currentCountryText}，已停止提交以避免区号不匹配。`);
    }
    return targetDialCode;
  }

  const select = getLoginPhoneCountrySelect(phoneInput);
  const fallbackSelectedOption = select?.options?.[select.selectedIndex] || null;
  return extractDialCodeFromText(getLoginPhoneCountryOptionLabel(fallbackSelectedOption))
    || displayedDialCode
    || resolveSignupPhoneDialCodeFromNumber(phoneNumber);
}

function resolveLoginPhoneDialCode(phoneInput, options = {}) {
  return resolveSignupPhoneDialCode(phoneInput, options);
}

function findLoginEntryTrigger() {
  const candidates = Array.from(document.querySelectorAll(
    'button, a, [role="button"], [role="link"], input[type="button"], input[type="submit"]'
  )).filter((el) => isVisibleElement(el) && isActionEnabled(el));

  const preferred = candidates.find((el) => {
    const text = getActionText(el);
    if (!text || LOGIN_CODE_ONLY_ACTION_PATTERN.test(text) || LOGIN_EXTERNAL_IDP_PATTERN.test(text)) return false;
    return /continue\s+(?:with|using)\s+email|use\s+(?:an?\s+)?email|email\s+address|邮箱|电子邮件|メールアドレス|メール|電子メール/i.test(text);
  });
  if (preferred) return preferred;

  return candidates.find((el) => {
    const text = getActionText(el);
    if (!text || LOGIN_CODE_ONLY_ACTION_PATTERN.test(text) || LOGIN_EXTERNAL_IDP_PATTERN.test(text)) return false;
    return LOGIN_ENTRY_ACTION_PATTERN.test(text);
  }) || null;
}

function findLoginPhoneEntryTrigger() {
  const candidates = Array.from(document.querySelectorAll(
    'button, a, [role="button"], [role="link"], input[type="button"], input[type="submit"]'
  )).filter((el) => isVisibleElement(el) && isActionEnabled(el));

  return candidates.find((el) => {
    const text = getActionText(el);
    if (!text || LOGIN_CODE_ONLY_ACTION_PATTERN.test(text) || LOGIN_EXTERNAL_IDP_PATTERN.test(text)) return false;
    return LOGIN_SWITCH_TO_PHONE_PATTERN.test(text)
      || (
        LOGIN_PHONE_ACTION_PATTERN.test(text)
        && !/email|邮箱|电子邮件|メールアドレス|メール|電子メール/i.test(text)
      );
  }) || null;
}

function findLoginMoreOptionsTrigger() {
  const candidates = Array.from(document.querySelectorAll(
    'button, a, [role="button"], [role="link"], input[type="button"], input[type="submit"]'
  )).filter((el) => isVisibleElement(el) && isActionEnabled(el));

  return candidates.find((el) => {
    const text = getActionText(el);
    if (!text || LOGIN_EXTERNAL_IDP_PATTERN.test(text)) return false;
    return LOGIN_MORE_OPTIONS_PATTERN.test(text);
  }) || null;
}

function inspectLoginAuthState() {
  const retryState = getLoginTimeoutErrorPageState();
  const verificationTarget = getVerificationCodeTarget();
  const passwordInput = getLoginPasswordInput();
  const emailInput = getLoginEmailInput();
  const phoneInput = getLoginPhoneInput();
  const switchTrigger = findOneTimeCodeLoginTrigger();
  const loginEntryTrigger = findLoginEntryTrigger();
  const phoneEntryTrigger = findLoginPhoneEntryTrigger();
  const moreOptionsTrigger = findLoginMoreOptionsTrigger();
  const submitButton = getLoginSubmitButton({ allowDisabled: true });
  const verificationVisible = isVerificationPageStillVisible();
  const addPhonePage = isAddPhonePageReady();
  const addEmailPage = isAddEmailPageReady();
  const phoneVerificationPage = isPhoneVerificationPageReady();
  const consentReady = isStep8Ready();
  const oauthConsentPage = isOAuthConsentPage();
  const baseState = {
    state: 'unknown',
    url: location.href,
    path: location.pathname || '',
    displayedEmail: getLoginVerificationDisplayedEmail(),
    retryButton: retryState?.retryButton || null,
    retryEnabled: Boolean(retryState?.retryEnabled),
    titleMatched: Boolean(retryState?.titleMatched),
    detailMatched: Boolean(retryState?.detailMatched),
    maxCheckAttemptsBlocked: Boolean(retryState?.maxCheckAttemptsBlocked),
    emailInUseBlocked: Boolean(retryState?.emailInUseBlocked),
    verificationTarget,
    passwordInput,
    emailInput,
    phoneInput,
    submitButton,
    switchTrigger,
    loginEntryTrigger,
    phoneEntryTrigger,
    moreOptionsTrigger,
    verificationVisible,
    addPhonePage,
    addEmailPage,
    phoneVerificationPage,
    oauthConsentPage,
    consentReady,
  };

  if (retryState) {
    return {
      ...baseState,
      state: 'login_timeout_error_page',
    };
  }

  if (phoneVerificationPage) {
    return {
      ...baseState,
      state: 'phone_verification_page',
      displayedPhone: getPhoneVerificationDisplayedPhone(),
    };
  }

  if (verificationTarget) {
    return {
      ...baseState,
      state: 'verification_page',
    };
  }

  if (addPhonePage) {
    return {
      ...baseState,
      state: 'add_phone_page',
    };
  }

  if (addEmailPage) {
    return {
      ...baseState,
      state: 'add_email_page',
    };
  }

  if (passwordInput || switchTrigger) {
    return {
      ...baseState,
      state: 'password_page',
    };
  }

  if (phoneInput) {
    return {
      ...baseState,
      state: 'phone_entry_page',
    };
  }

  if (emailInput) {
    return {
      ...baseState,
      state: 'email_page',
    };
  }

  if (verificationVisible) {
    return {
      ...baseState,
      state: 'verification_page',
    };
  }

  if (consentReady) {
    return {
      ...baseState,
      state: 'oauth_consent_page',
    };
  }

  if (loginEntryTrigger) {
    return {
      ...baseState,
      state: 'entry_page',
    };
  }

  return baseState;
}

function serializeLoginAuthState(snapshot) {
  return {
    state: snapshot?.state || 'unknown',
    url: snapshot?.url || location.href,
    path: snapshot?.path || location.pathname || '',
    displayedEmail: snapshot?.displayedEmail || '',
    verificationErrorText: getVerificationErrorText(),
    retryEnabled: Boolean(snapshot?.retryEnabled),
    titleMatched: Boolean(snapshot?.titleMatched),
    detailMatched: Boolean(snapshot?.detailMatched),
    maxCheckAttemptsBlocked: Boolean(snapshot?.maxCheckAttemptsBlocked),
    emailInUseBlocked: Boolean(snapshot?.emailInUseBlocked),
    hasVerificationTarget: Boolean(snapshot?.verificationTarget),
    hasPasswordInput: Boolean(snapshot?.passwordInput),
    hasEmailInput: Boolean(snapshot?.emailInput),
    hasPhoneInput: Boolean(snapshot?.phoneInput),
    hasSubmitButton: Boolean(snapshot?.submitButton),
    hasSwitchTrigger: Boolean(snapshot?.switchTrigger),
    hasLoginEntryTrigger: Boolean(snapshot?.loginEntryTrigger),
    hasPhoneEntryTrigger: Boolean(snapshot?.phoneEntryTrigger),
    hasMoreOptionsTrigger: Boolean(snapshot?.moreOptionsTrigger),
    verificationVisible: Boolean(snapshot?.verificationVisible),
    addPhonePage: Boolean(snapshot?.addPhonePage),
    addEmailPage: Boolean(snapshot?.addEmailPage),
    phoneVerificationPage: Boolean(snapshot?.phoneVerificationPage),
    oauthConsentPage: Boolean(snapshot?.oauthConsentPage),
    consentReady: Boolean(snapshot?.consentReady),
  };
}

function getLoginAuthStateLabel(snapshot) {
  const state = snapshot?.state;
  switch (state) {
    case 'verification_page':
      return '登录验证码页';
    case 'password_page':
      return '密码页';
    case 'email_page':
      return '邮箱输入页';
    case 'phone_entry_page':
      return '手机号输入页';
    case 'phone_verification_page':
      return '手机验证码页';
    case 'login_timeout_error_page':
      return '登录超时报错页';
    case 'oauth_consent_page':
      return 'OAuth 授权页';
    case 'entry_page':
      return '登录入口页';
    case 'add_phone_page':
      return '手机号页';
    case 'add_email_page':
      return '添加邮箱页';
    default:
      return '未知页面';
  }
}

async function waitForKnownLoginAuthState(timeout = 15000) {
  const start = Date.now();
  let snapshot = normalizeStep6Snapshot(inspectLoginAuthState());

  while (Date.now() - start < timeout) {
    throwIfStopped();
    snapshot = normalizeStep6Snapshot(inspectLoginAuthState());
    if (snapshot.state !== 'unknown') {
      return snapshot;
    }
    await sleep(200);
  }

  return snapshot;
}

function getAuthLoginStepForLoginCodeStep(step = 8) {
  return Number(step) >= 11 ? 10 : 7;
}

async function waitForLoginVerificationPageReady(timeout = 10000, visibleStep = 8, options = {}) {
  const start = Date.now();
  let snapshot = inspectLoginAuthState();
  const allowPhoneVerificationPage = Boolean(options?.allowPhoneVerificationPage);

  while (Date.now() - start < timeout) {
    throwIfStopped();
    snapshot = inspectLoginAuthState();
    if (snapshot.state === 'verification_page' || (allowPhoneVerificationPage && snapshot.state === 'phone_verification_page')) {
      return snapshot;
    }
    if (snapshot.state !== 'unknown') {
      break;
    }
    await sleep(200);
  }

  throw new Error(
    `当前未进入登录验证码页面，请先重新完成步骤 ${Number(visibleStep) >= 11 ? 10 : 7}。当前状态：${getLoginAuthStateLabel(snapshot)}。URL: ${snapshot?.url || location.href}`
  );
}

function createStep6SuccessResult(snapshot, options = {}) {
  const result = {
    step6Outcome: 'success',
    state: snapshot?.state || 'verification_page',
    url: snapshot?.url || location.href,
    via: options.via || '',
    loginVerificationRequestedAt: options.loginVerificationRequestedAt || null,
  };

  if (options.skipLoginVerificationStep) {
    result.skipLoginVerificationStep = true;
  }
  if (options.directOAuthConsentPage) {
    result.directOAuthConsentPage = true;
  }

  return result;
}

function createStep6OAuthConsentSuccessResult(snapshot, options = {}) {
  return createStep6SuccessResult(snapshot, {
    ...options,
    via: options.via || 'oauth_consent_page',
    loginVerificationRequestedAt: null,
    skipLoginVerificationStep: true,
    directOAuthConsentPage: true,
  });
}

function createStep6AddEmailSuccessResult(snapshot, options = {}) {
  return {
    ...createStep6SuccessResult(snapshot, {
      ...options,
      via: options.via || 'add_email_page',
      loginVerificationRequestedAt: null,
    }),
    addEmailPage: true,
  };
}

function createStep6RecoverableResult(reason, snapshot, options = {}) {
  return {
    step6Outcome: 'recoverable',
    reason,
    state: snapshot?.state || 'unknown',
    url: snapshot?.url || location.href,
    message: options.message || '',
    loginVerificationRequestedAt: options.loginVerificationRequestedAt || null,
  };
}

async function createStep6LoginTimeoutRecoveryTransition(reason, snapshot, message, options = {}) {
  const {
    loginVerificationRequestedAt = null,
    visibleStep = 7,
    via = 'login_timeout_recovered',
    allowPhoneVerificationPage = false,
  } = options;
  let resolvedSnapshot = normalizeStep6Snapshot(snapshot || inspectLoginAuthState());
  let recovered = false;
  if (resolvedSnapshot?.state === 'login_timeout_error_page') {
    try {
      const recoveryResult = await recoverCurrentAuthRetryPage({
        flow: 'login',
        logLabel: `步骤 ${visibleStep}：检测到登录超时报错，正在点击“重试”恢复当前页面`,
        step: visibleStep,
        timeoutMs: 12000,
      });
      recovered = Boolean(recoveryResult?.recovered);
      if (recovered) {
        log('登录超时报错页已点击“重试”，正在按恢复后的页面状态继续当前流程。', 'warn', { step: visibleStep, stepKey: 'oauth-login' });
      }
    } catch (error) {
      if (/CF_SECURITY_BLOCKED::/i.test(String(error?.message || error || ''))) {
        throw error;
      }
      log(`登录超时报错页自动点击“重试”失败：${error.message}`, 'warn', { step: visibleStep, stepKey: 'oauth-login' });
    }
  }

  resolvedSnapshot = recovered
    ? normalizeStep6Snapshot(await waitForKnownLoginAuthState(4000))
    : normalizeStep6Snapshot(inspectLoginAuthState());

  if (resolvedSnapshot.state === 'verification_page' || (allowPhoneVerificationPage && resolvedSnapshot.state === 'phone_verification_page')) {
    return {
      action: 'done',
      result: createStep6SuccessResult(resolvedSnapshot, {
        via,
        loginVerificationRequestedAt,
      }),
    };
  }

  if (resolvedSnapshot.state === 'oauth_consent_page') {
    return {
      action: 'done',
      result: createStep6OAuthConsentSuccessResult(resolvedSnapshot, {
        via,
      }),
    };
  }

  if (resolvedSnapshot.state === 'add_email_page') {
    return {
      action: 'done',
      result: createStep6AddEmailSuccessResult(resolvedSnapshot, {
        via: `${via}_add_email`,
      }),
    };
  }

  if (resolvedSnapshot.state === 'password_page') {
    log('登录超时报错页恢复后已进入密码页，继续当前登录流程。', 'warn', { step: visibleStep, stepKey: 'oauth-login' });
    return { action: 'password', snapshot: resolvedSnapshot };
  }

  if (resolvedSnapshot.state === 'phone_entry_page') {
    log('登录超时报错页恢复后已进入手机号输入页，继续当前登录流程。', 'warn', { step: visibleStep, stepKey: 'oauth-login' });
    return { action: 'phone', snapshot: resolvedSnapshot };
  }

  if (resolvedSnapshot.state === 'email_page') {
    log('登录超时报错页恢复后已回到邮箱输入页，继续当前登录流程。', 'warn', { step: visibleStep, stepKey: 'oauth-login' });
    return { action: 'email', snapshot: resolvedSnapshot };
  }

  return {
    action: 'recoverable',
    result: createStep6RecoverableResult(reason, resolvedSnapshot, {
      message,
      loginVerificationRequestedAt,
    }),
  };
}

async function createStep6LoginTimeoutRecoverableResult(reason, snapshot, message, options = {}) {
  const transition = await createStep6LoginTimeoutRecoveryTransition(reason, snapshot, message, options);
  if (transition?.action === 'done' || transition?.action === 'recoverable') {
    return transition.result;
  }

  return createStep6RecoverableResult(reason, transition?.snapshot || normalizeStep6Snapshot(inspectLoginAuthState()), {
    message,
  });
}

async function finalizeStep6VerificationReady(options = {}) {
  const {
    visibleStep = 7,
    logLabel = `步骤 ${visibleStep} 收尾`,
    loginVerificationRequestedAt = null,
    timeout = 12000,
    via = 'verification_page_ready',
    allowPhoneVerificationPage = false,
  } = options;
  const start = Date.now();
  const maxRounds = 3;
  const settleDelayMs = 3000;
  let round = 0;

  while (Date.now() - start < timeout && round < maxRounds) {
    throwIfStopped();
    round += 1;
    log(`确认页面是否稳定停留在登录验证码阶段（第 ${round}/${maxRounds} 轮，先等待 3 秒）...`, 'info', { step: visibleStep, stepKey: 'oauth-login' });
    await sleep(settleDelayMs);

    const rawSnapshot = inspectLoginAuthState();
    const snapshot = normalizeStep6Snapshot(rawSnapshot);

    if (snapshot.state === 'verification_page' || (allowPhoneVerificationPage && snapshot.state === 'phone_verification_page')) {
      log(
        snapshot.state === 'phone_verification_page' ? '登录手机验证码页面已稳定就绪。' : '登录验证码页面已稳定就绪。',
        'ok',
        { step: visibleStep, stepKey: 'oauth-login' }
      );
      return createStep6SuccessResult(snapshot, {
        via,
        loginVerificationRequestedAt,
      });
    }

    if (snapshot.state === 'oauth_consent_page') {
      log('认证页已直接进入 OAuth 授权页，跳过登录验证码步骤。', 'ok', { step: visibleStep, stepKey: 'oauth-login' });
      return createStep6OAuthConsentSuccessResult(snapshot, {
        via: `${via}_oauth_consent`,
      });
    }

    if (snapshot.state === 'add_email_page') {
      log('认证页已进入添加邮箱页，登录阶段完成。', 'ok', { step: visibleStep, stepKey: 'oauth-login' });
      return createStep6AddEmailSuccessResult(snapshot, {
        via: `${via}_add_email`,
      });
    }

    if (snapshot.state === 'login_timeout_error_page') {
      log(`页面进入登录超时报错页，准备自动恢复后重试步骤 ${visibleStep}。`, 'warn', { step: visibleStep, stepKey: 'oauth-login' });
      return createStep6LoginTimeoutRecoverableResult(
        'login_timeout_error_page',
        snapshot,
        '登录验证码页面准备就绪前进入登录超时报错页。',
        { visibleStep }
      );
    }

    if (snapshot.state === 'password_page' || snapshot.state === 'email_page') {
      return createStep6RecoverableResult('verification_page_unstable', snapshot, {
        message: `页面曾进入登录验证码阶段，但又回到了${getLoginAuthStateLabel(snapshot)}，准备重新执行步骤 ${visibleStep}。`,
        loginVerificationRequestedAt,
      });
    }

    if (snapshot.state === 'add_phone_page') {
      throw new Error(`登录验证码页面准备过程中页面进入手机号页面。URL: ${snapshot.url}`);
    }
  }

  const rawSnapshot = inspectLoginAuthState();
  const snapshot = normalizeStep6Snapshot(rawSnapshot);
  if (snapshot.state === 'verification_page' || (allowPhoneVerificationPage && snapshot.state === 'phone_verification_page')) {
    log(
      snapshot.state === 'phone_verification_page' ? '登录手机验证码页面已稳定就绪。' : '登录验证码页面已稳定就绪。',
      'ok',
      { step: visibleStep, stepKey: 'oauth-login' }
    );
    return createStep6SuccessResult(snapshot, {
      via,
      loginVerificationRequestedAt,
    });
  }
  if (snapshot.state === 'oauth_consent_page') {
    log('认证页已直接进入 OAuth 授权页，跳过登录验证码步骤。', 'ok', { step: visibleStep, stepKey: 'oauth-login' });
    return createStep6OAuthConsentSuccessResult(snapshot, {
      via: `${via}_oauth_consent`,
    });
  }
  if (snapshot.state === 'add_email_page') {
    log('认证页已进入添加邮箱页，登录阶段完成。', 'ok', { step: visibleStep, stepKey: 'oauth-login' });
    return createStep6AddEmailSuccessResult(snapshot, {
      via: `${via}_add_email`,
    });
  }
  if (snapshot.state === 'login_timeout_error_page') {
    log(`页面进入登录超时报错页，准备自动恢复后重试步骤 ${visibleStep}。`, 'warn', { step: visibleStep, stepKey: 'oauth-login' });
    return createStep6LoginTimeoutRecoverableResult(
      'login_timeout_error_page',
      snapshot,
      '登录验证码页面准备就绪前进入登录超时报错页。',
      { visibleStep }
    );
  }
  if (snapshot.state === 'password_page' || snapshot.state === 'email_page') {
    return createStep6RecoverableResult('verification_page_unstable', snapshot, {
      message: `页面曾进入登录验证码阶段，但又回到了${getLoginAuthStateLabel(snapshot)}，准备重新执行步骤 ${visibleStep}。`,
      loginVerificationRequestedAt,
    });
  }

  return createStep6RecoverableResult('verification_page_finalize_unknown', snapshot, {
    message: `登录验证码页面状态在收尾确认阶段未稳定，准备重新执行步骤 ${visibleStep}。`,
    loginVerificationRequestedAt,
  });
}

function normalizeStep6Snapshot(snapshot) {
  return snapshot;
}

function throwForStep6FatalState(snapshot, visibleStep = 7) {
  snapshot = normalizeStep6Snapshot(snapshot);
  switch (snapshot?.state) {
    case 'oauth_consent_page':
      return;
    case 'add_phone_page':
      throw new Error(`当前页面已进入手机号页面，未经过登录验证码页，无法完成步骤 ${visibleStep}。URL: ${snapshot.url}`);
    case 'unknown':
      throw new Error(`无法识别当前登录页面状态。URL: ${snapshot?.url || location.href}`);
    default:
      return;
  }
}

async function triggerLoginSubmitAction(button, fallbackField) {
  const form = button?.form || fallbackField?.form || button?.closest?.('form') || fallbackField?.closest?.('form') || null;
  const performOperationWithDelay = typeof getOperationDelayRunner === 'function'
    ? getOperationDelayRunner()
    : async (metadata, operation) => {
        const rootScope = typeof window !== 'undefined' ? window : globalThis;
        const gate = rootScope?.CodexOperationDelay?.performOperationWithDelay;
        return typeof gate === 'function' ? gate(metadata, operation) : operation();
      };

  await humanPause(400, 1100);
  await performOperationWithDelay({ stepKey: 'oauth-login', kind: 'submit', label: 'login-submit' }, async () => {
    if (button && isActionEnabled(button)) {
      simulateClick(button);
      return;
    }

    if (form && typeof form.requestSubmit === 'function') {
      if (button && button.form === form) {
        form.requestSubmit(button);
      } else {
        form.requestSubmit();
      }
      return;
    }

    if (button && typeof button.click === 'function') {
      button.click();
      return;
    }

    throw new Error('未找到可用的登录提交按钮。URL: ' + location.href);
  });
}

function isSignupPasswordErrorPage() {
  return Boolean(getSignupPasswordTimeoutErrorPageState());
}

function isSignupEmailAlreadyExistsPage() {
  return isSignupPasswordPage() && SIGNUP_EMAIL_EXISTS_PATTERN.test(getPageTextSnapshot());
}

function inspectSignupVerificationState() {
  const postVerificationState = getStep4PostVerificationState();
  if (postVerificationState?.state === 'step5') {
    return { state: 'step5' };
  }

  if (postVerificationState?.state === 'logged_in_home') {
    return {
      state: 'logged_in_home',
      skipProfileStep: true,
      url: postVerificationState.url || location.href,
    };
  }

  if (isSignupPasswordErrorPage()) {
    const timeoutPage = getSignupPasswordTimeoutErrorPageState();
    return {
      state: 'error',
      retryButton: timeoutPage?.retryButton || null,
      userAlreadyExistsBlocked: Boolean(timeoutPage?.userAlreadyExistsBlocked),
    };
  }

  const contactVerificationServerErrorText = typeof getContactVerificationServerErrorText === 'function'
    ? getContactVerificationServerErrorText()
    : '';
  if (contactVerificationServerErrorText) {
    return {
      state: 'contact_verification_server_error',
      serverErrorText: contactVerificationServerErrorText,
    };
  }

  if (typeof isPhoneVerificationPageReady === 'function' && isPhoneVerificationPageReady()) {
    return {
      state: 'verification',
      phoneVerificationPage: true,
    };
  }

  if (isVerificationPageStillVisible()) {
    return { state: 'verification' };
  }

  if (isSignupEmailAlreadyExistsPage()) {
    return { state: 'email_exists' };
  }

  const passwordInput = getSignupPasswordInput();
  if (passwordInput) {
    return {
      state: 'password',
      passwordInput,
      submitButton: getSignupPasswordSubmitButton({ allowDisabled: true }),
      passwordErrorText: getSignupPasswordFieldErrorText(),
    };
  }

  return { state: 'unknown' };
}

async function waitForSignupVerificationTransition(timeout = 5000) {
  const start = Date.now();

  while (Date.now() - start < timeout) {
    throwIfStopped();

    const snapshot = inspectSignupVerificationState();
    if (snapshot.state === 'verification' && !isSignupVerificationPageInteractiveReady(snapshot)) {
      await sleep(200);
      continue;
    }
    if (
      snapshot.state === 'step5'
      || snapshot.state === 'logged_in_home'
      || snapshot.state === 'verification'
      || snapshot.state === 'contact_verification_server_error'
      || snapshot.state === 'error'
      || snapshot.state === 'email_exists'
    ) {
      return snapshot;
    }

    await sleep(200);
  }

  return inspectSignupVerificationState();
}

async function prepareSignupVerificationFlow(payload = {}, timeout = 30000) {
  const performOperationWithDelay = typeof getOperationDelayRunner === 'function'
    ? getOperationDelayRunner()
    : async (metadata, operation) => {
        const rootScope = typeof window !== 'undefined' ? window : globalThis;
        const gate = rootScope?.CodexOperationDelay?.performOperationWithDelay;
        return typeof gate === 'function' ? gate(metadata, operation) : operation();
      };
  const { password } = payload;
  const prepareSource = String(payload?.prepareSource || '').trim() || 'step4_execute';
  const prepareLogLabel = String(payload?.prepareLogLabel || '').trim()
    || (prepareSource === 'step3_finalize' ? '步骤 3 收尾' : '步骤 4 执行');
  const start = Date.now();
  let recoveryRound = 0;
  const maxRecoveryRounds = 3;
  let passwordPageDiagnosticsLogged = false;
  const isPasswordSubmitButtonReadyForRetry = (button) => {
    if (!button || !isActionEnabled(button)) {
      return false;
    }

    const ariaBusy = String(button.getAttribute?.('aria-busy') || '').trim().toLowerCase();
    if (ariaBusy === 'true') {
      return false;
    }

    const pendingAttr = [
      button.getAttribute?.('data-loading'),
      button.getAttribute?.('data-pending'),
      button.getAttribute?.('data-submitting'),
      button.getAttribute?.('data-state'),
    ]
      .map((value) => String(value || '').trim().toLowerCase())
      .filter(Boolean)
      .join(' ');
    if (/\b(?:true|loading|pending|submitting|busy)\b/.test(pendingAttr)) {
      return false;
    }

    let style = null;
    try {
      style = typeof window !== 'undefined' && window.getComputedStyle
        ? window.getComputedStyle(button)
        : null;
    } catch {
      style = null;
    }

    if (style?.pointerEvents === 'none') {
      return false;
    }

    const opacity = Number.parseFloat(style?.opacity || '');
    if (Number.isFinite(opacity) && opacity < 0.8) {
      return false;
    }

    return true;
  };

  while (Date.now() - start < timeout && recoveryRound < maxRecoveryRounds) {
    throwIfStopped();

    const roundNo = recoveryRound + 1;
    log(`${prepareLogLabel}：等待页面进入验证码阶段（第 ${roundNo}/${maxRecoveryRounds} 轮，先等待 5 秒）...`, 'info');
    const snapshot = await waitForSignupVerificationTransition(5000);

    if (snapshot.state === 'step5') {
      log(`${prepareLogLabel}：页面已进入验证码后的下一阶段，本步骤按已完成处理。`, 'ok');
      return { ready: true, alreadyVerified: true, retried: recoveryRound, prepareSource };
    }

    if (snapshot.state === 'logged_in_home') {
      log(`${prepareLogLabel}：页面已直接进入 ChatGPT 已登录态，本步骤按已完成处理，并将跳过步骤 5。`, 'ok');
      return {
        ready: true,
        alreadyVerified: true,
        skipProfileStep: true,
        retried: recoveryRound,
        prepareSource,
      };
    }

    if (snapshot.state === 'verification') {
      await waitForDocumentLoadComplete(15000, `${prepareLogLabel}：注册验证码页面`);
      await waitForVerificationCodeTarget(15000);
      log(`${prepareLogLabel}：验证码页面已完成加载并就绪${recoveryRound ? `（期间自动恢复 ${recoveryRound} 次）` : ''}。`, 'ok');
      return { ready: true, retried: recoveryRound, prepareSource };
    }

    if (snapshot.state === 'email_exists') {
      throw new Error('当前邮箱已存在，需要重新开始新一轮。');
    }

    if (snapshot.state === 'contact_verification_server_error') {
      const serverErrorText = String(snapshot.serverErrorText || '').trim()
        || 'OpenAI contact-verification 页面返回 HTTP ERROR 500。';
      log(`${prepareLogLabel}：检测到 contact-verification 500 错误页，当前轮直接报错。`, 'warn');
      throw buildContactVerificationServerError(serverErrorText);
    }

    if (snapshot.state === 'error') {
      if (snapshot.userAlreadyExistsBlocked) {
        throw createSignupUserAlreadyExistsError();
      }
      recoveryRound += 1;
      await recoverCurrentAuthRetryPage({
        flow: 'signup',
        logLabel: `${prepareLogLabel}：检测到注册认证重试页，正在点击“重试”恢复（第 ${recoveryRound}/${maxRecoveryRounds} 次）`,
        step: 4,
        timeoutMs: 12000,
      });
      continue;
    }

    if (snapshot.state === 'password') {
      if (snapshot.passwordErrorText) {
        log(`${prepareLogLabel}：检测到密码页报错“${snapshot.passwordErrorText}”，当前轮将回到步骤 1 重新开始。`, 'warn');
        throw createSignupPhonePasswordMismatchError(snapshot.passwordErrorText);
      }
      if (!passwordPageDiagnosticsLogged) {
        passwordPageDiagnosticsLogged = true;
        logSignupPasswordDiagnostics(`${prepareLogLabel}：页面仍停留在密码页`);
      }
      if (!password) {
        throw new Error('当前回到了密码页，但没有可用密码，无法自动重新提交。');
      }

      if ((snapshot.passwordInput.value || '') !== password) {
        log(`${prepareLogLabel}：页面仍停留在密码页，正在重新填写密码...`, 'warn');
        await humanPause(450, 1100);
        await performOperationWithDelay({ stepKey: 'fill-password', kind: 'fill', label: 'retry-signup-password' }, async () => {
          fillInput(snapshot.passwordInput, password);
        });
      }

      if (snapshot.submitButton && isPasswordSubmitButtonReadyForRetry(snapshot.submitButton)) {
        recoveryRound += 1;
        log(`${prepareLogLabel}：页面仍停留在密码页，正在重新点击“继续”（第 ${recoveryRound}/${maxRecoveryRounds} 次）...`, 'warn');
        await humanPause(350, 900);
        await performOperationWithDelay({ stepKey: 'fill-password', kind: 'submit', label: 'retry-submit-signup-password' }, async () => {
          simulateClick(snapshot.submitButton);
        });
        await sleep(1200);
        continue;
      }

      log(`${prepareLogLabel}：页面仍停留在密码页，但“继续”按钮暂不可用，准备继续等待（${recoveryRound}/${maxRecoveryRounds}）...`, 'warn');
      continue;
    }

    log(`${prepareLogLabel}：页面仍在切换中，准备继续等待（${recoveryRound}/${maxRecoveryRounds}）...`, 'warn');
  }

  throw new Error(`等待注册验证码页面就绪超时或自动恢复失败（已尝试 ${recoveryRound}/${maxRecoveryRounds} 轮）。URL: ${location.href}`);
}


async function waitForVerificationSubmitOutcome(step, timeout, options = {}) {
  const resolvedTimeout = timeout ?? (step === 8 ? 30000 : 12000);
  const purpose = options?.purpose || '';
  const start = Date.now();
  let recoveryCount = 0;
  const maxRecoveryCount = 2;

  while (Date.now() - start < resolvedTimeout) {
    throwIfStopped();

    const retryFlow = step === 4 ? 'signup' : 'login';
    const retryState = getCurrentAuthRetryPageState(retryFlow);
    if (retryState?.userAlreadyExistsBlocked) {
      throw createSignupUserAlreadyExistsError();
    }
    if (step === 8 && retryState?.emailInUseBlocked) {
      throw createStep8EmailInUseError();
    }
    if (step === 8 && retryState?.maxCheckAttemptsBlocked) {
      throw createAuthMaxCheckAttemptsError();
    }
    if (retryState) {
      if (recoveryCount >= maxRecoveryCount) {
        throw new Error(`步骤 ${step}：验证码提交后连续进入认证重试页 ${maxRecoveryCount} 次，页面仍未恢复。URL: ${location.href}`);
      }
      recoveryCount += 1;
      log(`步骤 ${step}：验证码提交后进入认证重试页，正在自动恢复（${recoveryCount}/${maxRecoveryCount}）...`, 'warn');
      await recoverCurrentAuthRetryPage({
        flow: retryFlow,
        logLabel: `步骤 ${step}：验证码提交后检测到认证重试页，正在点击“重试”恢复`,
        step,
        timeoutMs: 12000,
      });
      continue;
    }

    if (step === 4) {
      const postVerificationState = getStep4PostVerificationState({ ignoreVerificationVisibility: true });
      if (postVerificationState?.state === 'logged_in_home') {
        return {
          success: true,
          skipProfileStep: true,
          url: postVerificationState.url || location.href,
        };
      }
      if (postVerificationState?.state === 'step5') {
        return { success: true };
      }
      if (purpose === 'signup' && isEmailVerificationPage()) {
        return {
          success: true,
          emailVerificationRequired: true,
          emailVerificationPage: true,
          url: location.href,
        };
      }
    }

    const errorText = getVerificationErrorText();
    if (errorText) {
      return { invalidCode: true, errorText };
    }

    if (step === 8 && isStep8Ready()) {
      return { success: true };
    }

    if (step === 8 && isAddPhonePageReady()) {
      return { success: true, addPhonePage: true, url: location.href };
    }

    await sleep(150);
  }

  if (step === 4) {
    const signupRetryState = getCurrentAuthRetryPageState('signup');
    if (signupRetryState?.userAlreadyExistsBlocked) {
      throw createSignupUserAlreadyExistsError();
    }

    const postVerificationState = getStep4PostVerificationState({ ignoreVerificationVisibility: true });
    if (postVerificationState?.state === 'logged_in_home') {
      return {
        success: true,
        skipProfileStep: true,
        url: postVerificationState.url || location.href,
      };
    }
    if (postVerificationState?.state === 'step5') {
      return { success: true };
    }
    if (purpose === 'signup' && isEmailVerificationPage()) {
      return {
        success: true,
        emailVerificationRequired: true,
        emailVerificationPage: true,
        url: location.href,
      };
    }
  }

  if (isVerificationPageStillVisible()) {
    return {
      invalidCode: true,
      errorText: getVerificationErrorText() || '提交后仍停留在验证码页面，准备重新发送验证码。',
    };
  }

  return { success: true, assumed: true };
}

function getVerificationSubmitButtonForTarget(codeInput, options = {}) {
  const { allowDisabled = false } = options;
  const form = codeInput?.form || codeInput?.closest?.('form') || null;
  const isUsableAction = (element) => {
    if (!element || !isVisibleElement(element)) return false;
    return allowDisabled || isActionEnabled(element);
  };

  const findSubmitInRoot = (root) => {
    if (!root?.querySelectorAll) return null;

    const directCandidates = root.querySelectorAll('button[type="submit"], input[type="submit"]');
    for (const element of directCandidates) {
      if (isUsableAction(element)) {
        return element;
      }
    }

    const textCandidates = root.querySelectorAll('button, [role="button"], input[type="button"], input[type="submit"]');
    return Array.from(textCandidates).find((element) => {
      if (!isUsableAction(element)) return false;
      const text = getActionText(element);
    return /verify|confirm|submit|continue|确认|验证|继续|確認|認証|検証|続行|続ける|次へ|送信/i.test(text);
    }) || null;
  };

  return findSubmitInRoot(form) || findSubmitInRoot(document);
}

async function waitForVerificationSubmitButton(codeInput, timeout = 5000) {
  const start = Date.now();

  while (Date.now() - start < timeout) {
    throwIfStopped();
    if (is405MethodNotAllowedPage()) {
      throw new Error('当前页面处于 405 错误恢复流程中，暂时无法定位验证码提交按钮。');
    }

    const button = getVerificationSubmitButtonForTarget(codeInput, { allowDisabled: false });
    if (button) {
      return button;
    }

    await sleep(150);
  }

  return null;
}

async function waitForVerificationCodeTarget(timeout = 10000) {
  const start = Date.now();

  while (Date.now() - start < timeout) {
    throwIfStopped();
    if (is405MethodNotAllowedPage()) {
      throw new Error('当前页面处于 405 错误恢复流程中，暂时无法定位验证码输入框。');
    }

    const target = getVerificationCodeTarget();
    if (target) {
      return target;
    }

    await sleep(150);
  }

  throw new Error('未找到验证码输入框。URL: ' + location.href);
}

async function waitForSplitVerificationInputsFilled(inputs, code, timeout = 2500) {
  const expected = String(code || '').slice(0, 6);
  const start = Date.now();

  while (Date.now() - start < timeout) {
    throwIfStopped();
    const current = Array.from(inputs || [])
      .slice(0, expected.length)
      .map((input) => String(input?.value || '').trim())
      .join('');

    if (current === expected) {
      return true;
    }

    await sleep(100);
  }

  return false;
}

async function fillVerificationCode(step, payload) {
  const { code, signupProfile } = payload;
  if (!code) throw new Error('未提供验证码。');
  const performOperationWithDelay = typeof getOperationDelayRunner === 'function'
    ? getOperationDelayRunner()
    : async (metadata, operation) => {
        const rootScope = typeof window !== 'undefined' ? window : globalThis;
        const gate = rootScope?.CodexOperationDelay?.performOperationWithDelay;
        return typeof gate === 'function' ? gate(metadata, operation) : operation();
      };

  if (step === 4) {
    const postVerificationState = getStep4PostVerificationState();
    if (postVerificationState?.state === 'logged_in_home') {
      if (typeof clearStep405RecoveryCount === 'function') clearStep405RecoveryCount(step);
      log(`步骤 ${step}：检测到页面已进入 ChatGPT 已登录态，本次验证码提交按成功处理。`, 'ok');
      return {
        success: true,
        assumed: true,
        alreadyAdvanced: true,
        skipProfileStep: true,
        url: postVerificationState.url || location.href,
      };
    }
    if (postVerificationState?.state === 'step5') {
      if (typeof clearStep405RecoveryCount === 'function') clearStep405RecoveryCount(step);
      log(`步骤 ${step}：检测到页面已进入下一阶段，本次验证码提交按成功处理。`, 'ok');
      return { success: true, assumed: true, alreadyAdvanced: true };
    }
  }
  if (step === 8) {
    if (isStep8Ready()) {
      log(`步骤 ${step}：检测到页面已进入 OAuth 同意页，本次验证码提交按成功处理。`, 'ok');
      return { success: true, assumed: true, alreadyAdvanced: true };
    }
    if (isAddPhonePageReady()) {
      return { success: true, addPhonePage: true, url: location.href };
    }
  }

  log(`步骤 ${step}：正在填写验证码：${code}`);

  if (step === 8) {
    await waitForLoginVerificationPageReady(10000, step, {
      allowPhoneVerificationPage: payload?.purpose === 'login' || payload?.loginIdentifierType === 'phone',
    });
  }
  if (step === 4) {
    await waitForDocumentLoadComplete(15000, `步骤 ${step}：注册验证码页面`);
  }

  const combinedSignupProfilePage = step === 4
    && await waitForCombinedSignupVerificationProfilePage();
  if (combinedSignupProfilePage) {
    if (!signupProfile || !signupProfile.firstName || !signupProfile.lastName) {
      throw new Error('当前注册验证码页面要求同时填写资料，但未提供姓名或生日数据。');
    }
    await step5_fillNameBirthday({
      ...signupProfile,
      prefillOnly: true,
    });
  }

  // Find code input — could be a single input or multiple separate inputs
  // Retry with 405 error recovery if needed
  const maxRetries = 3;
  let codeInput = null;
  let splitInputs = null;

  for (let retry = 0; retry <= maxRetries; retry++) {
    throwIfStopped();

    // Before looking for input, check if page is in 405 error state
    if (is405MethodNotAllowedPage()) {
      log(`步骤 ${step}：检测到 405 错误页面，正在恢复...`, 'warn');
      await handle405ResendError(step, 30000);
      continue;
    }

    try {
      const verificationTarget = await waitForVerificationCodeTarget(10000);
      if (verificationTarget.type === 'split') {
        splitInputs = verificationTarget.elements;
      } else {
        codeInput = verificationTarget.element;
      }
      break; // Found it
    } catch {
      // No input found — check if it's a 405 error and can be recovered
      if (is405MethodNotAllowedPage() && retry < maxRetries) {
        log(`步骤 ${step}：未找到验证码输入框且页面出现 405 错误，正在恢复...`, 'warn');
        await handle405ResendError(step, 30000);
        continue;
      }

      throw new Error('未找到验证码输入框。URL: ' + location.href);
    }
  }

  if (splitInputs?.length >= 6) {
    log(`步骤 ${step}：发现分开的单字符验证码输入框，正在逐个填写...`);
    await performOperationWithDelay({ stepKey: 'fetch-signup-code', kind: 'grouped-code', label: 'split-code' }, async () => {
      for (let i = 0; i < 6 && i < splitInputs.length; i++) {
        const targetInput = splitInputs[i];
        try {
          targetInput.focus?.();
        } catch {}
        fillInput(splitInputs[i], code[i]);
        try {
          targetInput.dispatchEvent(new KeyboardEvent('keyup', { key: code[i], bubbles: true }));
        } catch {}
      }
    });
    const filled = await waitForSplitVerificationInputsFilled(splitInputs, code, 2500);
    if (!filled) {
      const current = Array.from(splitInputs)
        .slice(0, 6)
        .map((input) => String(input?.value || '').trim() || '_')
        .join('');
      log(`步骤 ${step}：分格验证码输入框未稳定呈现目标值，当前页面值为 ${current}，准备继续观察提交流程。`, 'warn');
    } else {
      log(`步骤 ${step}：分格验证码输入框已稳定显示 ${code}。`, 'info');
    }

    await sleep(800);
    const splitSubmitBtn = await waitForVerificationSubmitButton(splitInputs[0], 2000).catch(() => null);
    if (splitSubmitBtn) {
      await humanPause(450, 1200);
      await performOperationWithDelay({ stepKey: 'fetch-signup-code', kind: 'submit', label: 'submit-code' }, async () => {
        simulateClick(splitSubmitBtn);
      });
      log(`步骤 ${step}：分格验证码已提交`);
    } else {
      log(`步骤 ${step}：分格验证码页面未找到可点击提交按钮，继续等待页面自动推进。`, 'info');
    }

    const outcome = await waitForVerificationSubmitOutcome(step, undefined, payload);
    if (outcome.invalidCode) {
      log(`步骤 ${step}：验证码被拒绝：${outcome.errorText}`, 'warn');
    } else if (outcome.emailVerificationRequired) {
      log(`步骤 ${step}：手机验证码已通过，页面进入邮箱验证码验证。`, 'ok');
    } else if (outcome.addPhonePage) {
      log(`步骤 ${step}：验证码提交后页面进入手机号页面，当前流程将停止自动授权。`, 'warn');
    } else {
      if (typeof clearStep405RecoveryCount === 'function') clearStep405RecoveryCount(step);
      log(`步骤 ${step}：验证码已通过${outcome.assumed ? '（按成功推定）' : ''}。`, 'ok');
    }
    if (combinedSignupProfilePage && !outcome.invalidCode) {
      outcome.skipProfileStep = true;
      outcome.skipProfileStepReason = 'combined_verification_profile';
    }
    return outcome;
  }

  if (!codeInput) {
    throw new Error('未找到验证码输入框。URL: ' + location.href);
  }

  await performOperationWithDelay({ stepKey: step === 8 ? 'oauth-login' : 'fetch-signup-code', kind: 'fill', label: 'verification-code' }, async () => {
    fillInput(codeInput, code);
  });
  log(`步骤 ${step}：验证码已填写`);

  // Submit
  await sleep(800);
  const submitBtn = await waitForVerificationSubmitButton(codeInput, 5000).catch(() => null);

  if (submitBtn) {
    await humanPause(450, 1200);
    await performOperationWithDelay({ stepKey: step === 8 ? 'oauth-login' : 'fetch-signup-code', kind: 'submit', label: 'submit-code' }, async () => {
      simulateClick(submitBtn);
    });
    log(`步骤 ${step}：验证码已提交`);
  } else {
    log(`步骤 ${step}：未找到可提交的验证码按钮，先等待页面自动推进或反馈结果。`, 'warn');
  }

  const outcome = await waitForVerificationSubmitOutcome(step, undefined, payload);
  if (outcome.invalidCode) {
    log(`步骤 ${step}：验证码被拒绝：${outcome.errorText}`, 'warn');
  } else if (outcome.emailVerificationRequired) {
    log(`步骤 ${step}：手机验证码已通过，页面进入邮箱验证码验证。`, 'ok');
  } else if (outcome.addPhonePage) {
    log(`步骤 ${step}：验证码提交后页面进入手机号页面，当前流程将停止自动授权。`, 'warn');
  } else {
    if (typeof clearStep405RecoveryCount === 'function') clearStep405RecoveryCount(step);
    log(`步骤 ${step}：验证码已通过${outcome.assumed ? '（按成功推定）' : ''}。`, 'ok');
  }

  if (combinedSignupProfilePage && !outcome.invalidCode) {
    outcome.skipProfileStep = true;
    outcome.skipProfileStepReason = 'combined_verification_profile';
  }

  return outcome;
}

// ============================================================
// Step 7: Login with registered account (on OAuth auth page)
// ============================================================

function getStep6OptionMessage(value, snapshot) {
  return typeof value === 'function' ? value(snapshot) : String(value || '');
}

async function resolveStep6PostSubmitSnapshot(snapshot, options = {}) {
  const normalizedSnapshot = normalizeStep6Snapshot(snapshot || inspectLoginAuthState());
  const {
    via = 'post_submit',
    loginVerificationRequestedAt = null,
    oauthConsentVia = `${via}_oauth_consent`,
    timeoutRecoveryReason = 'login_timeout_error_page',
    timeoutRecoveryMessage = '登录提交后进入登录超时报错页。',
    timeoutRecoveryVia = `${via}_timeout_recovered`,
    allowPhoneVerificationPage = false,
    allowPhoneAction = false,
    allowPasswordAction = false,
    allowEmailAction = false,
    allowFinalPhoneAction = false,
    allowFinalPasswordAction = false,
    allowFinalEmailAction = false,
    allowFinalSwitchAction = false,
    visibleStep = 7,
    final = false,
    addPhoneMessage,
  } = options;

  if (normalizedSnapshot.state === 'verification_page' || (allowPhoneVerificationPage && normalizedSnapshot.state === 'phone_verification_page')) {
    return {
      action: 'done',
      result: createStep6SuccessResult(normalizedSnapshot, {
        via,
        loginVerificationRequestedAt,
      }),
    };
  }

  if (normalizedSnapshot.state === 'oauth_consent_page') {
    return {
      action: 'done',
      result: createStep6OAuthConsentSuccessResult(normalizedSnapshot, {
        via: oauthConsentVia,
      }),
    };
  }

  if (normalizedSnapshot.state === 'add_email_page') {
    return {
      action: 'done',
      result: createStep6AddEmailSuccessResult(normalizedSnapshot, {
        via: `${via}_add_email`,
      }),
    };
  }

  if (normalizedSnapshot.state === 'login_timeout_error_page') {
    const transition = await createStep6LoginTimeoutRecoveryTransition(
      timeoutRecoveryReason,
      normalizedSnapshot,
      timeoutRecoveryMessage,
      {
        visibleStep,
        loginVerificationRequestedAt,
        via: timeoutRecoveryVia,
        allowPhoneVerificationPage,
      }
    );
    if (transition.action === 'done') {
      return {
        action: 'done',
        result: transition.result,
      };
    }
    if (transition.action === 'phone') {
      return { action: 'phone', snapshot: transition.snapshot };
    }
    if (transition.action === 'password') {
      return { action: 'password', snapshot: transition.snapshot };
    }
    if (transition.action === 'email') {
      return { action: 'email', snapshot: transition.snapshot };
    }
    return {
      action: 'recoverable',
      result: transition.result,
    };
  }

  if (normalizedSnapshot.state === 'phone_entry_page' && (allowPhoneAction || (final && allowFinalPhoneAction))) {
    return { action: 'phone', snapshot: normalizedSnapshot };
  }

  if (normalizedSnapshot.state === 'password_page') {
    if (allowPasswordAction || (final && allowFinalPasswordAction)) {
      return { action: 'password', snapshot: normalizedSnapshot };
    }
    if (final && allowFinalSwitchAction && normalizedSnapshot.switchTrigger) {
      return { action: 'switch', snapshot: normalizedSnapshot };
    }
  }

  if (normalizedSnapshot.state === 'email_page' && (allowEmailAction || (final && allowFinalEmailAction))) {
    return { action: 'email', snapshot: normalizedSnapshot };
  }

  if (normalizedSnapshot.state === 'add_phone_page') {
    const message = getStep6OptionMessage(addPhoneMessage, normalizedSnapshot)
      || `登录提交后页面进入手机号页面。URL: ${normalizedSnapshot.url || location.href}`;
    throw new Error(message);
  }

  return null;
}

async function waitForStep6PostSubmitTransition(options = {}) {
  const {
    timeout = 10000,
    stalledReason = 'post_submit_stalled',
    stalledMessage = '登录提交后未进入可识别的下一页。',
  } = options;
  const start = Date.now();
  let snapshot = normalizeStep6Snapshot(inspectLoginAuthState());

  while (Date.now() - start < timeout) {
    throwIfStopped();
    snapshot = normalizeStep6Snapshot(inspectLoginAuthState());
    const transition = await resolveStep6PostSubmitSnapshot(snapshot, {
      ...options,
      final: false,
    });
    if (transition) {
      return transition;
    }
    await sleep(250);
  }

  snapshot = normalizeStep6Snapshot(inspectLoginAuthState());
  const transition = await resolveStep6PostSubmitSnapshot(snapshot, {
    ...options,
    final: true,
  });
  if (transition) {
    return transition;
  }

  return {
    action: 'recoverable',
    result: createStep6RecoverableResult(stalledReason, snapshot, {
      message: stalledMessage,
      loginVerificationRequestedAt: options.loginVerificationRequestedAt || null,
    }),
  };
}

async function waitForStep6EmailSubmitTransition(emailSubmittedAt, timeout = 12000, options = {}) {
  return waitForStep6PostSubmitTransition({
    timeout,
    visibleStep: Math.floor(Number(options?.visibleStep) || 0) || 7,
    via: 'email_submit',
    oauthConsentVia: 'email_submit_oauth_consent',
    loginVerificationRequestedAt: emailSubmittedAt,
    timeoutRecoveryMessage: '提交邮箱后进入登录超时报错页。',
    timeoutRecoveryVia: 'email_submit_timeout_recovered',
    allowPasswordAction: true,
    stalledReason: 'email_submit_stalled',
    stalledMessage: '提交邮箱后长时间未进入密码页或登录验证码页。',
    addPhoneMessage: (snapshot) => `提交邮箱后页面直接进入手机号页面，未经过登录验证码页。URL: ${snapshot.url}`,
  });
}

async function waitForStep6PhoneSubmitTransition(phoneSubmittedAt, timeout = 12000, options = {}) {
  return waitForStep6PostSubmitTransition({
    timeout,
    visibleStep: Math.floor(Number(options?.visibleStep) || 0) || 7,
    via: 'phone_submit',
    oauthConsentVia: 'phone_submit_oauth_consent',
    loginVerificationRequestedAt: phoneSubmittedAt,
    timeoutRecoveryMessage: '提交手机号后进入登录超时报错页。',
    timeoutRecoveryVia: 'phone_submit_timeout_recovered',
    allowPhoneVerificationPage: true,
    allowPasswordAction: true,
    allowFinalPhoneAction: true,
    stalledReason: 'phone_submit_stalled',
    stalledMessage: '提交手机号后长时间未进入密码页或手机验证码页。',
    addPhoneMessage: (snapshot) => `提交手机号后页面直接进入手机号补全页面，未经过登录验证码页。URL: ${snapshot.url}`,
  });
}

async function waitForStep6PasswordSubmitTransition(passwordSubmittedAt, timeout = 10000, options = {}) {
  return waitForStep6PostSubmitTransition({
    timeout,
    visibleStep: Math.floor(Number(options?.visibleStep) || 0) || 7,
    via: 'password_submit',
    oauthConsentVia: 'password_submit_oauth_consent',
    loginVerificationRequestedAt: passwordSubmittedAt,
    timeoutRecoveryMessage: '提交密码后进入登录超时报错页。',
    timeoutRecoveryVia: 'password_submit_timeout_recovered',
    allowFinalSwitchAction: true,
    stalledReason: 'password_submit_stalled',
    stalledMessage: '提交密码后仍未进入登录验证码页。',
    addPhoneMessage: (snapshot) => `提交密码后页面直接进入手机号页面，未经过登录验证码页。URL: ${snapshot.url}`,
  });
}

async function waitForStep6SwitchTransition(loginVerificationRequestedAt, timeout = 10000, options = {}) {
  const transition = await waitForStep6PostSubmitTransition({
    timeout,
    visibleStep: Math.floor(Number(options?.visibleStep) || 0) || 7,
    via: 'switch_to_one_time_code_login',
    oauthConsentVia: 'switch_to_one_time_code_oauth_consent',
    loginVerificationRequestedAt,
    timeoutRecoveryMessage: '切换到一次性验证码登录后进入登录超时报错页。',
    timeoutRecoveryVia: 'switch_to_one_time_code_timeout_recovered',
    stalledReason: 'one_time_code_switch_stalled',
    stalledMessage: '点击一次性验证码登录后仍未进入登录验证码页。',
    addPhoneMessage: (snapshot) => `切换到一次性验证码登录后页面直接进入手机号页面，未经过登录验证码页。URL: ${snapshot.url}`,
  });

  if (transition.action === 'done' || transition.action === 'recoverable') {
    return transition.result;
  }
  return transition;
}

async function waitForLoginEntryOpenTransition(timeout = 10000) {
  const start = Date.now();
  let snapshot = normalizeStep6Snapshot(inspectLoginAuthState());

  while (Date.now() - start < timeout) {
    throwIfStopped();
    snapshot = normalizeStep6Snapshot(inspectLoginAuthState());
    if (snapshot.state !== 'unknown' && snapshot.state !== 'entry_page') {
      return snapshot;
    }
    await sleep(250);
  }

  return snapshot;
}

async function waitForPhoneLoginEntrySwitchTransition(timeout = 10000) {
  const start = Date.now();
  let snapshot = normalizeStep6Snapshot(inspectLoginAuthState());

  while (Date.now() - start < timeout) {
    throwIfStopped();
    snapshot = normalizeStep6Snapshot(inspectLoginAuthState());
    if (snapshot.state !== 'unknown' && snapshot.state !== 'email_page' && snapshot.state !== 'entry_page') {
      return snapshot;
    }
    await sleep(250);
  }

  return snapshot;
}

async function step6OpenLoginEntry(payload, snapshot) {
  const performOperationWithDelay = typeof getOperationDelayRunner === 'function'
    ? getOperationDelayRunner()
    : async (metadata, operation) => {
        const rootScope = typeof window !== 'undefined' ? window : globalThis;
        const gate = rootScope?.CodexOperationDelay?.performOperationWithDelay;
        return typeof gate === 'function' ? gate(metadata, operation) : operation();
      };
  const visibleStep = Math.floor(Number(payload?.visibleStep) || 0) || 7;
  const currentSnapshot = normalizeStep6Snapshot(snapshot || inspectLoginAuthState());
  const preferPhoneLogin = String(payload?.loginIdentifierType || '').trim() === 'phone' || (!payload?.email && payload?.phoneNumber);
  const genericEntryTrigger = currentSnapshot.loginEntryTrigger || findLoginEntryTrigger();
  const phoneEntryTrigger = currentSnapshot.phoneEntryTrigger || findLoginPhoneEntryTrigger();
  const trigger = genericEntryTrigger || (preferPhoneLogin ? phoneEntryTrigger : null);
  if (!trigger || !isActionEnabled(trigger)) {
    return createStep6RecoverableResult('missing_login_entry_trigger', currentSnapshot, {
      message: preferPhoneLogin
        ? '当前登录入口页没有可点击的手机号登录入口。'
        : '当前登录入口页没有可点击的邮箱登录入口。',
    });
  }

  log(`检测到登录入口页，正在点击 "${getActionText(trigger).slice(0, 80)}"...`, 'info', { step: visibleStep, stepKey: 'oauth-login' });
  await humanPause(350, 900);
  await performOperationWithDelay({ stepKey: 'oauth-login', kind: 'click', label: 'open-login-entry' }, async () => {
    simulateClick(trigger);
  });
  const nextSnapshot = await waitForLoginEntryOpenTransition();

  if (nextSnapshot.state === 'email_page') {
    if (preferPhoneLogin) {
      return switchFromEmailPageToPhoneLogin(payload, nextSnapshot);
    }
    return step6LoginFromEmailPage(payload, nextSnapshot);
  }
  if (nextSnapshot.state === 'password_page') {
    return step6LoginFromPasswordPage(payload, nextSnapshot);
  }
  if (nextSnapshot.state === 'phone_entry_page') {
    return step6LoginFromPhonePage(payload, nextSnapshot);
  }
  if (nextSnapshot.state === 'verification_page') {
    return finalizeStep6VerificationReady({
      visibleStep,
      loginVerificationRequestedAt: null,
      via: 'entry_open_verification_page',
    });
  }
  if (nextSnapshot.state === 'oauth_consent_page') {
    return createStep6OAuthConsentSuccessResult(nextSnapshot, {
      via: 'entry_open_oauth_consent_page',
    });
  }
  if (nextSnapshot.state === 'add_email_page') {
    return createStep6AddEmailSuccessResult(nextSnapshot, {
      via: 'entry_open_add_email_page',
    });
  }
  if (nextSnapshot.state === 'login_timeout_error_page') {
    const transition = await createStep6LoginTimeoutRecoveryTransition(
      'login_timeout_after_entry_open',
      nextSnapshot,
      '点击登录入口后进入登录超时报错页。',
      { visibleStep }
    );
    if (transition.action === 'done') return transition.result;
    if (transition.action === 'phone') return step6LoginFromPhonePage(payload, transition.snapshot);
    if (transition.action === 'email') return step6LoginFromEmailPage(payload, transition.snapshot);
    if (transition.action === 'password') return step6LoginFromPasswordPage(payload, transition.snapshot);
    return transition.result;
  }

  return createStep6RecoverableResult('login_entry_open_stalled', nextSnapshot, {
    message: '点击登录入口后仍未进入手机号/邮箱/密码/验证码页。',
  });
}

async function step6SwitchToOneTimeCodeLogin(payload, snapshot) {
  const performOperationWithDelay = typeof getOperationDelayRunner === 'function'
    ? getOperationDelayRunner()
    : async (metadata, operation) => {
        const rootScope = typeof window !== 'undefined' ? window : globalThis;
        const gate = rootScope?.CodexOperationDelay?.performOperationWithDelay;
        return typeof gate === 'function' ? gate(metadata, operation) : operation();
      };
  const visibleStep = Math.floor(Number(payload?.visibleStep) || 0) || 7;
  const switchTrigger = snapshot?.switchTrigger || findOneTimeCodeLoginTrigger();
  if (!switchTrigger || !isActionEnabled(switchTrigger)) {
    return createStep6RecoverableResult('missing_one_time_code_trigger', normalizeStep6Snapshot(inspectLoginAuthState()), {
      message: '当前登录页没有可用的一次性验证码登录入口。',
    });
  }

  log('已检测到一次性验证码登录入口，准备切换...', 'info', { step: visibleStep, stepKey: 'oauth-login' });
  const loginVerificationRequestedAt = Date.now();
  await humanPause(350, 900);
  await performOperationWithDelay({ stepKey: 'oauth-login', kind: 'click', label: 'switch-one-time-code-login' }, async () => {
    simulateClick(switchTrigger);
  });
  log('已点击一次性验证码登录', 'info', { step: visibleStep, stepKey: 'oauth-login' });
  await sleep(1200);
  const result = await waitForStep6SwitchTransition(loginVerificationRequestedAt, 10000, { visibleStep });
  if (result?.step6Outcome === 'success') {
    if (result.skipLoginVerificationStep || result.addEmailPage) {
      return result;
    }
    return finalizeStep6VerificationReady({
      visibleStep,
      loginVerificationRequestedAt: result.loginVerificationRequestedAt || loginVerificationRequestedAt,
      via: result.via || 'switch_to_one_time_code_login',
    });
  }
  if (result?.action === 'password') {
    return step6LoginFromPasswordPage(payload, result.snapshot);
  }
  if (result?.action === 'phone') {
    return step6LoginFromPhonePage(payload, result.snapshot);
  }
  if (result?.action === 'email') {
    return step6LoginFromEmailPage(payload, result.snapshot);
  }
  return result;
}

async function step6LoginFromPhonePage(payload, snapshot) {
  const performOperationWithDelay = typeof getOperationDelayRunner === 'function'
    ? getOperationDelayRunner()
    : async (metadata, operation) => {
        const rootScope = typeof window !== 'undefined' ? window : globalThis;
        const gate = rootScope?.CodexOperationDelay?.performOperationWithDelay;
        return typeof gate === 'function' ? gate(metadata, operation) : operation();
      };
  const visibleStep = Math.floor(Number(payload?.visibleStep) || 0) || 7;
  const currentSnapshot = normalizeStep6Snapshot(snapshot || inspectLoginAuthState());
  const phoneInput = currentSnapshot.phoneInput || getLoginPhoneInput();
  const phoneNumber = String(payload?.phoneNumber || payload?.accountIdentifier || '').trim();
  const countryLabel = String(payload?.countryLabel || '').trim();
  const countryId = payload?.countryId;

  if (!phoneNumber) {
    return createStep6RecoverableResult('missing_phone_number', currentSnapshot, {
      message: '手机号登录时缺少手机号，请重新执行步骤 2 获取号码。',
    });
  }
  if (!phoneInput) {
    return createStep6RecoverableResult('missing_phone_input', currentSnapshot, {
      message: '当前登录页没有可用的手机号输入框。',
    });
  }

  const dialCodeFromSelection = await selectCountryForPhoneInput(phoneInput, phoneNumber, countryLabel, { visibleStep });
  const dialCode = dialCodeFromSelection || resolveLoginPhoneDialCode(phoneInput, {
    phoneNumber,
    countryId,
    countryLabel,
  });
  const inputValue = toNationalPhoneNumber(phoneNumber, dialCode);
  if (!inputValue) {
    throw new Error(`步骤 ${visibleStep}：手机号为空，无法填写。`);
  }

  log(
    `步骤 ${visibleStep}：手机号登录填写前诊断 ${JSON.stringify({
      phoneNumber,
      countryLabel,
      countryId,
      dialCode,
      input: getLoginPhoneInputDiagnostics(phoneInput),
      candidates: getLoginPhoneInputCandidateDiagnostics(),
    })}`,
    'info',
    { step: visibleStep, stepKey: 'oauth-login' }
  );
  log(`步骤 ${visibleStep}：正在填写手机号 ${phoneNumber}...`, 'info', { step: visibleStep, stepKey: 'oauth-login' });
  await humanPause(500, 1400);
  const fillResult = await fillLoginPhoneInputAndConfirm(phoneInput, {
    phoneNumber,
    dialCode,
    visibleStep,
    resolvePhoneInput: () => getLoginPhoneInput() || phoneInput,
  });
  log(`步骤 ${visibleStep}：手机号已填写${dialCode ? `（区号 +${dialCode}，本地号 ${fillResult.inputValue}，可见提交值 ${fillResult.attemptedValue}）` : ''}。`, 'info', { step: visibleStep, stepKey: 'oauth-login' });

  await sleep(500);
  const verifiedPhoneInput = fillResult.input || phoneInput;
  const hiddenSync = await performOperationWithDelay({ stepKey: 'oauth-login', kind: 'hidden-sync', label: 'login-phone-pre-submit-hidden-sync' }, async () => (
    syncPhoneHiddenFormValue(verifiedPhoneInput, { phoneNumber, dialCode, inputValue })
  ));
  const submitButton = getLoginSubmitButton({ allowDisabled: true }) || currentSnapshot.submitButton;
  const preSubmitRenderedValue = getPhoneInputRenderedValue(verifiedPhoneInput);
  const preSubmitHiddenInput = hiddenSync?.input || getPhoneHiddenValueInput(verifiedPhoneInput);
  const preSubmitDiagnostics = {
    renderedValue: preSubmitRenderedValue,
    inputVerified: isPhoneInputValueComplete(verifiedPhoneInput, phoneNumber, dialCode, inputValue),
    input: getLoginPhoneInputDiagnostics(verifiedPhoneInput),
    hidden: getLoginPhoneHiddenValueDiagnostics(preSubmitHiddenInput),
    submitButton: getLoginPhoneSubmitButtonDiagnostics(submitButton),
  };
  log(
    `步骤 ${visibleStep}：手机号提交前复查 ${JSON.stringify(preSubmitDiagnostics)}`,
    'info',
    { step: visibleStep, stepKey: 'oauth-login' }
  );
  if (!preSubmitDiagnostics.inputVerified) {
    throw new Error(`步骤 ${visibleStep}：提交前手机号输入框复查失败，完整号码 ${phoneNumber}，区号 +${dialCode || '未识别'}，期望本地号 ${inputValue}，当前输入框为 ${normalizePhoneDigits(preSubmitRenderedValue) || '空'}，已停止提交。`);
  }
  const phoneSubmittedAt = Date.now();
  await triggerLoginSubmitAction(submitButton, verifiedPhoneInput);
  log(`步骤 ${visibleStep}：手机号已提交。`, 'info', { step: visibleStep, stepKey: 'oauth-login' });

  const transition = await waitForStep6PhoneSubmitTransition(phoneSubmittedAt, 12000, { visibleStep });
  if (transition.action === 'done') {
    if (transition.result?.skipLoginVerificationStep || transition.result?.addEmailPage) {
      return transition.result;
    }
    return finalizeStep6VerificationReady({
      visibleStep,
      loginVerificationRequestedAt: transition.result.loginVerificationRequestedAt || phoneSubmittedAt,
      via: transition.result.via || 'phone_submit',
      allowPhoneVerificationPage: true,
    });
  }
  if (transition.action === 'recoverable') {
    log(transition.result.message || `提交手机号后仍未进入目标页面，准备重新执行步骤 ${visibleStep}。`, 'warn', {
      step: visibleStep,
      stepKey: 'oauth-login',
    });
    return transition.result;
  }
  if (transition.action === 'phone') {
    return step6LoginFromPhonePage(payload, transition.snapshot);
  }
  if (transition.action === 'password') {
    return step6LoginFromPasswordPage(payload, transition.snapshot);
  }
  if (transition.action === 'email') {
    return step6LoginFromEmailPage(payload, transition.snapshot);
  }

  return createStep6RecoverableResult('phone_submit_unknown', normalizeStep6Snapshot(inspectLoginAuthState()), {
    message: '提交手机号后未得到可用的下一步状态。',
  });
}

async function switchFromEmailPageToPhoneLogin(payload, snapshot) {
  const performOperationWithDelay = typeof getOperationDelayRunner === 'function'
    ? getOperationDelayRunner()
    : async (metadata, operation) => {
        const rootScope = typeof window !== 'undefined' ? window : globalThis;
        const gate = rootScope?.CodexOperationDelay?.performOperationWithDelay;
        return typeof gate === 'function' ? gate(metadata, operation) : operation();
      };
  const visibleStep = Math.floor(Number(payload?.visibleStep) || 0) || 7;
  let currentSnapshot = normalizeStep6Snapshot(snapshot || inspectLoginAuthState());
  let phoneEntryTrigger = currentSnapshot.phoneEntryTrigger || findLoginPhoneEntryTrigger();
  if (!phoneEntryTrigger || !isActionEnabled(phoneEntryTrigger)) {
    const moreOptionsTrigger = currentSnapshot.moreOptionsTrigger || findLoginMoreOptionsTrigger();
    if (moreOptionsTrigger && isActionEnabled(moreOptionsTrigger)) {
      log(`步骤 ${visibleStep}：手机号入口可能隐藏在更多选项中，正在展开更多选项...`, 'info', {
        step: visibleStep,
        stepKey: 'oauth-login',
      });
      await humanPause(350, 900);
      await performOperationWithDelay({ stepKey: 'oauth-login', kind: 'click', label: 'login-more-options' }, async () => {
        simulateClick(moreOptionsTrigger);
      });
      await sleep(800);
      currentSnapshot = normalizeStep6Snapshot(inspectLoginAuthState());
      phoneEntryTrigger = currentSnapshot.phoneEntryTrigger || findLoginPhoneEntryTrigger();
    }
  }

  if (!phoneEntryTrigger || !isActionEnabled(phoneEntryTrigger)) {
    return createStep6RecoverableResult('missing_phone_login_entry_trigger', currentSnapshot, {
      message: '本轮要求使用手机号登录，但当前邮箱登录页没有可用的手机号登录入口。',
    });
  }

  log(`步骤 ${visibleStep}：当前在邮箱入口，正在切换到手机号登录...`, 'info', { step: visibleStep, stepKey: 'oauth-login' });
  await humanPause(350, 900);
  await performOperationWithDelay({ stepKey: 'oauth-login', kind: 'click', label: 'switch-phone-login' }, async () => {
    simulateClick(phoneEntryTrigger);
  });
  const nextSnapshot = normalizeStep6Snapshot(await waitForPhoneLoginEntrySwitchTransition(20000));
  if (nextSnapshot.state === 'phone_entry_page') {
    return step6LoginFromPhonePage(payload, nextSnapshot);
  }
  if (nextSnapshot.state === 'password_page') {
    return step6LoginFromPasswordPage(payload, nextSnapshot);
  }
  if (nextSnapshot.state === 'verification_page' || nextSnapshot.state === 'phone_verification_page') {
    return finalizeStep6VerificationReady({
      visibleStep,
      loginVerificationRequestedAt: null,
      via: 'phone_entry_switch_verification_page',
      allowPhoneVerificationPage: true,
    });
  }
  if (nextSnapshot.state === 'oauth_consent_page') {
    return createStep6OAuthConsentSuccessResult(nextSnapshot, {
      via: 'phone_entry_switch_oauth_consent_page',
    });
  }
  if (nextSnapshot.state === 'add_email_page') {
    return createStep6AddEmailSuccessResult(nextSnapshot, {
      via: 'phone_entry_switch_add_email_page',
    });
  }
  if (nextSnapshot.state === 'login_timeout_error_page') {
    const transition = await createStep6LoginTimeoutRecoveryTransition(
      'login_timeout_after_phone_entry_switch',
      nextSnapshot,
      '点击手机号登录入口后进入登录超时报错页。',
      {
        visibleStep,
        allowPhoneVerificationPage: true,
      }
    );
    if (transition.action === 'done') return transition.result;
    if (transition.action === 'phone') return step6LoginFromPhonePage(payload, transition.snapshot);
    if (transition.action === 'password') return step6LoginFromPasswordPage(payload, transition.snapshot);
    if (transition.action === 'email') return step6LoginFromEmailPage(payload, transition.snapshot);
    return transition.result;
  }

  return createStep6RecoverableResult('phone_login_entry_switch_stalled', nextSnapshot, {
    message: `点击手机号登录入口后仍未进入手机号或密码页，当前停留在${getLoginAuthStateLabel(nextSnapshot)}。`,
  });
}

async function step6LoginFromPasswordPage(payload, snapshot) {
  const performOperationWithDelay = typeof getOperationDelayRunner === 'function'
    ? getOperationDelayRunner()
    : async (metadata, operation) => {
        const rootScope = typeof window !== 'undefined' ? window : globalThis;
        const gate = rootScope?.CodexOperationDelay?.performOperationWithDelay;
        return typeof gate === 'function' ? gate(metadata, operation) : operation();
      };
  const visibleStep = Math.floor(Number(payload?.visibleStep) || 0) || 7;
  const currentSnapshot = normalizeStep6Snapshot(snapshot || inspectLoginAuthState());
  const hasPassword = Boolean(String(payload?.password || '').trim());

  if (currentSnapshot.passwordInput) {
    if (!hasPassword) {
      if (currentSnapshot.switchTrigger) {
        log('当前未提供密码，改走一次性验证码登录。', 'warn', { step: visibleStep, stepKey: 'oauth-login' });
        return step6SwitchToOneTimeCodeLogin(payload, currentSnapshot);
      }

      return createStep6RecoverableResult('missing_password_and_one_time_code_trigger', currentSnapshot, {
        message: '登录时未提供密码，且当前页面没有可用的一次性验证码登录入口。',
      });
    }

    log('已进入密码页，准备填写密码...', 'info', { step: visibleStep, stepKey: 'oauth-login' });
    await humanPause(550, 1450);
    await performOperationWithDelay({ stepKey: 'oauth-login', kind: 'fill', label: 'login-password' }, async () => {
      fillInput(currentSnapshot.passwordInput, payload.password);
    });
    log('已填写密码', 'info', { step: visibleStep, stepKey: 'oauth-login' });

    await sleep(500);
    const passwordSubmittedAt = Date.now();
    await triggerLoginSubmitAction(currentSnapshot.submitButton, currentSnapshot.passwordInput);
    log('已提交密码', 'info', { step: visibleStep, stepKey: 'oauth-login' });

    const transition = await waitForStep6PasswordSubmitTransition(passwordSubmittedAt, 10000, { visibleStep });
    if (transition.action === 'done') {
      if (transition.result?.skipLoginVerificationStep || transition.result?.addEmailPage) {
        return transition.result;
      }
      return finalizeStep6VerificationReady({
        visibleStep,
        loginVerificationRequestedAt: transition.result.loginVerificationRequestedAt || passwordSubmittedAt,
        via: transition.result.via || 'password_submit',
      });
    }
    if (transition.action === 'recoverable') {
      log(transition.result.message || `提交密码后仍未进入登录验证码页面，准备重新执行步骤 ${visibleStep}。`, 'warn', { step: visibleStep, stepKey: 'oauth-login' });
      return transition.result;
    }
    if (transition.action === 'password') {
      return step6LoginFromPasswordPage(payload, transition.snapshot);
    }
    if (transition.action === 'phone') {
      return step6LoginFromPhonePage(payload, transition.snapshot);
    }
    if (transition.action === 'email') {
      return step6LoginFromEmailPage(payload, transition.snapshot);
    }
    if (transition.action === 'switch') {
      return step6SwitchToOneTimeCodeLogin(payload, transition.snapshot);
    }

    return createStep6RecoverableResult('password_submit_unknown', normalizeStep6Snapshot(inspectLoginAuthState()), {
      message: '提交密码后未得到可用的下一步状态。',
    });
  }

  if (currentSnapshot.switchTrigger) {
    return step6SwitchToOneTimeCodeLogin(payload, currentSnapshot);
  }

  return createStep6RecoverableResult('password_page_unactionable', currentSnapshot, {
    message: '当前停留在登录页，但没有可提交密码的输入框，也没有一次性验证码登录入口。',
  });
}

async function step6LoginFromEmailPage(payload, snapshot) {
  const performOperationWithDelay = typeof getOperationDelayRunner === 'function'
    ? getOperationDelayRunner()
    : async (metadata, operation) => {
        const rootScope = typeof window !== 'undefined' ? window : globalThis;
        const gate = rootScope?.CodexOperationDelay?.performOperationWithDelay;
        return typeof gate === 'function' ? gate(metadata, operation) : operation();
      };
  const visibleStep = Math.floor(Number(payload?.visibleStep) || 0) || 7;
  const currentSnapshot = normalizeStep6Snapshot(snapshot || inspectLoginAuthState());
  if (String(payload?.loginIdentifierType || '').trim() === 'phone' && payload?.phoneNumber) {
    return switchFromEmailPageToPhoneLogin(payload, currentSnapshot);
  }
  const emailInput = currentSnapshot.emailInput || getLoginEmailInput();
  if (!emailInput) {
    throw new Error('在登录页未找到邮箱输入框。URL: ' + location.href);
  }

  if ((emailInput.value || '').trim() !== payload.email) {
    await humanPause(500, 1400);
    await performOperationWithDelay({ stepKey: 'oauth-login', kind: 'fill', label: 'login-email' }, async () => {
      fillInput(emailInput, payload.email);
    });
    log('已填写邮箱', 'info', { step: visibleStep, stepKey: 'oauth-login' });
  } else {
    log('邮箱已在输入框中，准备提交...', 'info', { step: visibleStep, stepKey: 'oauth-login' });
  }

  await sleep(500);
  const emailSubmittedAt = Date.now();
  await triggerLoginSubmitAction(currentSnapshot.submitButton, emailInput);
  log('已提交邮箱', 'info', { step: visibleStep, stepKey: 'oauth-login' });

  const transition = await waitForStep6EmailSubmitTransition(emailSubmittedAt, 12000, { visibleStep });
  if (transition.action === 'done') {
    if (transition.result?.skipLoginVerificationStep || transition.result?.addEmailPage) {
      return transition.result;
    }
    return finalizeStep6VerificationReady({
      visibleStep,
      loginVerificationRequestedAt: transition.result.loginVerificationRequestedAt || emailSubmittedAt,
      via: transition.result.via || 'email_submit',
    });
  }
  if (transition.action === 'recoverable') {
    log(transition.result.message || `提交邮箱后仍未进入目标页面，准备重新执行步骤 ${visibleStep}。`, 'warn', { step: visibleStep, stepKey: 'oauth-login' });
    return transition.result;
  }
  if (transition.action === 'email') {
    return step6LoginFromEmailPage(payload, transition.snapshot);
  }
  if (transition.action === 'password') {
    return step6LoginFromPasswordPage(payload, transition.snapshot);
  }
  if (transition.action === 'phone') {
    return step6LoginFromPhonePage(payload, transition.snapshot);
  }

  return createStep6RecoverableResult('email_submit_unknown', normalizeStep6Snapshot(inspectLoginAuthState()), {
    message: '提交邮箱后未得到可用的下一步状态。',
  });
}

async function step6_login(payload) {
  const visibleStep = Math.floor(Number(payload?.visibleStep) || 0) || 7;
  const { email, phoneNumber } = payload;
  const loginIdentifierType = String(payload?.loginIdentifierType || '').trim();
  if (!email && !phoneNumber) throw new Error('登录时缺少邮箱地址或手机号。');

  const snapshot = normalizeStep6Snapshot(await waitForKnownLoginAuthState(15000));

  if (snapshot.state === 'verification_page' || snapshot.state === 'phone_verification_page') {
    log('认证页已在登录验证码页，开始确认页面是否稳定。', 'info', { step: visibleStep, stepKey: 'oauth-login' });
    return finalizeStep6VerificationReady({
      visibleStep,
      loginVerificationRequestedAt: null,
      via: snapshot.state === 'phone_verification_page'
        ? 'already_on_phone_verification_page'
        : 'already_on_verification_page',
      allowPhoneVerificationPage: snapshot.state === 'phone_verification_page',
    });
  }

  if (snapshot.state === 'oauth_consent_page') {
    log('认证页已直接进入 OAuth 授权页，跳过登录验证码步骤。', 'ok', { step: visibleStep, stepKey: 'oauth-login' });
    return createStep6OAuthConsentSuccessResult(snapshot, {
      via: 'already_on_oauth_consent_page',
    });
  }

  if (snapshot.state === 'add_email_page') {
    log('认证页已在添加邮箱页，登录阶段完成。', 'ok', { step: visibleStep, stepKey: 'oauth-login' });
    return createStep6AddEmailSuccessResult(snapshot, {
      via: 'already_on_add_email_page',
    });
  }

  if (snapshot.state === 'login_timeout_error_page') {
    log('检测到登录超时报错页，先尝试恢复当前页面。', 'warn', { step: visibleStep, stepKey: 'oauth-login' });
    const transition = await createStep6LoginTimeoutRecoveryTransition(
      'login_timeout_error_page',
      snapshot,
      '当前页面处于登录超时报错页。',
      {
        visibleStep,
        loginVerificationRequestedAt: null,
        via: 'login_timeout_initial_recovered',
        allowPhoneVerificationPage: loginIdentifierType === 'phone' || Boolean(phoneNumber),
      }
    );
    if (transition.action === 'done') {
      if (transition.result?.skipLoginVerificationStep || transition.result?.addEmailPage) {
        return transition.result;
      }
      return finalizeStep6VerificationReady({
        visibleStep,
        loginVerificationRequestedAt: transition.result.loginVerificationRequestedAt || null,
        via: transition.result.via || 'login_timeout_initial_recovered',
      });
    }
    if (transition.action === 'phone') {
      return step6LoginFromPhonePage(payload, transition.snapshot);
    }
    if (transition.action === 'email') {
      return step6LoginFromEmailPage(payload, transition.snapshot);
    }
    if (transition.action === 'password') {
      return step6LoginFromPasswordPage(payload, transition.snapshot);
    }
    return transition.result;
  }

  if (snapshot.state === 'email_page') {
    if (loginIdentifierType === 'phone' && phoneNumber) {
      return switchFromEmailPageToPhoneLogin(payload, snapshot);
    }
    log(`正在使用 ${email} 登录...`, 'info', { step: visibleStep, stepKey: 'oauth-login' });
    return step6LoginFromEmailPage(payload, snapshot);
  }

  if (snapshot.state === 'phone_entry_page') {
    log('正在使用手机号登录...', 'info', { step: visibleStep, stepKey: 'oauth-login' });
    return step6LoginFromPhonePage(payload, snapshot);
  }

  if (snapshot.state === 'password_page') {
    log('认证页已在密码页，继续当前登录流程。', 'info', { step: visibleStep, stepKey: 'oauth-login' });
    return step6LoginFromPasswordPage(payload, snapshot);
  }

  if (snapshot.state === 'entry_page') {
    return step6OpenLoginEntry(payload, snapshot);
  }

  throwForStep6FatalState(snapshot, visibleStep);
  throw new Error(`无法识别当前登录页面状态。URL: ${snapshot?.url || location.href}`);
}

async function waitForAddEmailPageReady(timeout = 15000) {
  const start = Date.now();
  let sawAddEmailPage = false;
  while (Date.now() - start < timeout) {
    throwIfStopped();
    if (isAddEmailPageReady()) {
      sawAddEmailPage = true;
      const snapshot = inspectLoginAuthState();
      if (snapshot.emailInput || getLoginEmailInput()) {
        return snapshot;
      }
    }
    await sleep(200);
  }
  if (sawAddEmailPage) {
    throw new Error('等待添加邮箱页面输入框就绪超时。URL: ' + location.href);
  }
  throw new Error('等待添加邮箱页面就绪超时。URL: ' + location.href);
}

async function waitForAddEmailSubmitOutcome(timeout = 45000) {
  const start = Date.now();
  let lastState = inspectLoginAuthState();

  while (Date.now() - start < timeout) {
    throwIfStopped();
    lastState = inspectLoginAuthState();

    if (lastState.state === 'verification_page') {
      return {
        success: true,
        verificationPage: true,
        displayedEmail: getLoginVerificationDisplayedEmail(),
        url: location.href,
      };
    }
    if (lastState.state === 'oauth_consent_page') {
      return {
        success: true,
        directOAuthConsentPage: true,
        url: location.href,
      };
    }
    if (lastState.state === 'login_timeout_error_page') {
      return {
        retryPage: true,
        maxCheckAttempts: Boolean(lastState.maxCheckAttemptsBlocked),
        emailInUse: Boolean(lastState.emailInUseBlocked),
        url: location.href,
      };
    }

    const errorText = getVerificationErrorText();
    if (errorText) {
      return {
        errorText,
        url: location.href,
      };
    }

    const addEmailErrorText = isAddEmailPageReady() ? getVisibleFieldErrorText() : '';
    if (addEmailErrorText) {
      return {
        errorText: addEmailErrorText,
        url: location.href,
      };
    }

    await sleep(200);
  }

  throw new Error(`提交邮箱后未进入验证码页。当前状态：${getLoginAuthStateLabel(lastState)}。URL: ${lastState?.url || location.href}`);
}

async function submitAddEmailAndContinue(payload = {}) {
  const performOperationWithDelay = typeof getOperationDelayRunner === 'function'
    ? getOperationDelayRunner()
    : async (metadata, operation) => {
        const rootScope = typeof window !== 'undefined' ? window : globalThis;
        const gate = rootScope?.CodexOperationDelay?.performOperationWithDelay;
        return typeof gate === 'function' ? gate(metadata, operation) : operation();
      };
  const email = String(payload.email || '').trim().toLowerCase();
  if (!email) {
    throw new Error('未提供邮箱地址，无法添加邮箱。');
  }

  const snapshot = await waitForAddEmailPageReady();
  const emailInput = snapshot.emailInput || getLoginEmailInput();
  if (!emailInput) {
    throw new Error('添加邮箱页未找到邮箱输入框。URL: ' + location.href);
  }

  await humanPause(500, 1400);
  await performOperationWithDelay({ stepKey: 'oauth-login', kind: 'fill', label: 'add-email' }, async () => {
    fillInput(emailInput, email);
  });
  log(`步骤 8：已填写邮箱：${email}`);

  await sleep(500);
  const submitButton = snapshot.submitButton || getLoginSubmitButton({ allowDisabled: true });
  if (!submitButton || !isActionEnabled(submitButton)) {
    throw new Error('添加邮箱页未找到可点击的继续按钮。URL: ' + location.href);
  }

  await triggerLoginSubmitAction(submitButton, emailInput);
  log('步骤 8：已提交邮箱，正在等待邮箱验证码页...');

  const outcome = await waitForAddEmailSubmitOutcome();
  if (outcome.errorText && (SIGNUP_EMAIL_EXISTS_PATTERN.test(outcome.errorText) || /email_in_use/i.test(outcome.errorText))) {
    throw createStep8EmailInUseError();
  }
  if (outcome.errorText) {
    throw new Error(`添加邮箱失败：${outcome.errorText}`);
  }
  if (outcome.emailInUse) {
    throw createStep8EmailInUseError();
  }
  if (outcome.maxCheckAttempts) {
    throw createAuthMaxCheckAttemptsError();
  }
  if (outcome.retryPage) {
    throw new Error(`添加邮箱后进入认证重试页，请重新执行步骤 8。URL: ${outcome.url}`);
  }

  return {
    submitted: true,
    email,
    ...outcome,
  };
}

// ============================================================
// Step 9: Find "继续" on OAuth consent page for debugger click
// ============================================================
// After login + verification, page shows:
// "使用 ChatGPT 登录到 Codex" with a "继续" submit button.
// Background performs the actual click through the debugger Input API.

async function step8_findAndClick(payload = {}) {
  const visibleStep = Math.floor(Number(payload?.visibleStep) || 0) || 9;
  log('正在查找 OAuth 同意页的“继续”按钮...', 'info', { step: visibleStep, stepKey: 'confirm-oauth' });

  const continueBtn = await prepareStep8ContinueButton();

  const rect = getSerializableRect(continueBtn);
  log('已找到“继续”按钮并准备好调试器点击坐标。', 'info', { step: visibleStep, stepKey: 'confirm-oauth' });
  return {
    rect,
    buttonText: (continueBtn.textContent || '').trim(),
    url: location.href,
  };
}

function getStep8State() {
  const continueBtn = getPrimaryContinueButton();
  const retryState = getCurrentAuthRetryPageState('auth');
  const state = {
    url: location.href,
    consentPage: isOAuthConsentPage(),
    consentReady: isStep8Ready(),
    verificationPage: isVerificationPageStillVisible(),
    addPhonePage: isAddPhonePageReady(),
    addEmailPage: isAddEmailPageReady(),
    phoneVerificationPage: isPhoneVerificationPageReady(),
    retryPage: Boolean(retryState),
    retryEnabled: Boolean(retryState?.retryEnabled),
    retryTitleMatched: Boolean(retryState?.titleMatched),
    retryDetailMatched: Boolean(retryState?.detailMatched),
    maxCheckAttemptsBlocked: Boolean(retryState?.maxCheckAttemptsBlocked),
    buttonFound: Boolean(continueBtn),
    buttonEnabled: isButtonEnabled(continueBtn),
    buttonText: continueBtn ? getActionText(continueBtn) : '',
  };

  if (continueBtn) {
    try {
      state.rect = getSerializableRect(continueBtn);
    } catch {
      state.rect = null;
    }
  }

  return state;
}

async function step8_triggerContinue(payload = {}) {
  const visibleStep = Math.floor(Number(payload?.visibleStep) || 0) || 9;
  const strategy = payload?.strategy || 'requestSubmit';
  const continueBtn = await prepareStep8ContinueButton({
    findTimeoutMs: payload?.findTimeoutMs,
    enabledTimeoutMs: payload?.enabledTimeoutMs,
  });
  const form = continueBtn.form || continueBtn.closest('form');

  switch (strategy) {
    case 'requestSubmit':
      if (!form || typeof form.requestSubmit !== 'function') {
        throw new Error('“继续”按钮当前不在可提交的 form 中，无法使用 requestSubmit。URL: ' + location.href);
      }
      form.requestSubmit(continueBtn);
      break;
    case 'nativeClick':
      continueBtn.click();
      break;
    case 'dispatchClick':
      simulateClick(continueBtn);
      break;
    default:
      throw new Error(`未知的 Step ${visibleStep} 触发策略：${strategy}`);
  }

  log(`continue button triggered via ${strategy}.`, 'info', { step: visibleStep, stepKey: 'confirm-oauth' });
  return {
    strategy,
    ...getStep8State(),
  };
}

async function prepareStep8ContinueButton(options = {}) {
  const {
    findTimeoutMs = 10000,
    enabledTimeoutMs = 8000,
  } = options;

  const continueBtn = await findContinueButton(findTimeoutMs);
  await waitForButtonEnabled(continueBtn, enabledTimeoutMs);

  await humanPause(250, 700);
  continueBtn.scrollIntoView({ behavior: 'auto', block: 'center' });
  continueBtn.focus();
  await waitForStableButtonRect(continueBtn);
  return continueBtn;
}

async function findContinueButton(timeout = 10000) {
  const start = Date.now();
  while (Date.now() - start < timeout) {
    throwIfStopped();
    if (isAddPhonePageReady()) {
      throw new Error('当前页面已进入手机号页面，不是 OAuth 授权同意页。URL: ' + location.href);
    }
    if (isAddEmailPageReady()) {
      throw new Error('当前页面已进入添加邮箱页面，不是 OAuth 授权同意页。URL: ' + location.href);
    }
    const button = getPrimaryContinueButton();
    if (button && isStep8Ready()) {
      return button;
    }
    await sleep(150);
  }

  throw new Error('在 OAuth 同意页未找到“继续”按钮，或页面尚未进入授权同意状态。URL: ' + location.href);
}

async function waitForButtonEnabled(button, timeout = 8000) {
  const start = Date.now();
  while (Date.now() - start < timeout) {
    throwIfStopped();
    if (isButtonEnabled(button)) return;
    await sleep(150);
  }
  throw new Error('“继续”按钮长时间不可点击。URL: ' + location.href);
}

function isButtonEnabled(button) {
  return Boolean(button)
    && !button.disabled
    && button.getAttribute('aria-disabled') !== 'true';
}

async function waitForStableButtonRect(button, timeout = 1500) {
  let previous = null;
  let stableSamples = 0;
  const start = Date.now();

  while (Date.now() - start < timeout) {
    throwIfStopped();
    const rect = button?.getBoundingClientRect?.();
    if (rect && rect.width > 0 && rect.height > 0) {
      const snapshot = {
        left: rect.left,
        top: rect.top,
        width: rect.width,
        height: rect.height,
      };

      if (
        previous
        && Math.abs(snapshot.left - previous.left) < 1
        && Math.abs(snapshot.top - previous.top) < 1
        && Math.abs(snapshot.width - previous.width) < 1
        && Math.abs(snapshot.height - previous.height) < 1
      ) {
        stableSamples += 1;
        if (stableSamples >= 2) {
          return;
        }
      } else {
        stableSamples = 0;
      }

      previous = snapshot;
    }

    await sleep(80);
  }
}

function getSerializableRect(el) {
  const rect = el.getBoundingClientRect();
  if (!rect.width || !rect.height) {
    throw new Error('滚动后“继续”按钮没有可点击尺寸。URL: ' + location.href);
  }

  return {
    left: rect.left,
    top: rect.top,
    width: rect.width,
    height: rect.height,
    centerX: rect.left + (rect.width / 2),
    centerY: rect.top + (rect.height / 2),
  };
}

// ============================================================
// Step 5: Fill Name & Birthday / Age
// ============================================================

function getStep5DirectCompletionPayload({ isAgeMode = false, navigationStarted = false, navigationEventType = '', outcome = null } = {}) {
  const payload = {
    profileSubmitted: true,
    postSubmitChecked: !navigationStarted,
  };
  if (isAgeMode) {
    payload.ageMode = true;
  }
  if (navigationStarted) {
    payload.navigationStarted = true;
    payload.handoffToBackground = true;
    const resolvedNavigationEventType = String(navigationEventType || '').trim();
    if (resolvedNavigationEventType) {
      payload.navigationEventType = resolvedNavigationEventType;
    }
    if (typeof location !== 'undefined' && location?.href) {
      payload.url = location.href;
    }
  }
  if (outcome?.state) {
    payload.postSubmitChecked = true;
    payload.outcome = outcome.state;
  }
  if (outcome?.url) {
    payload.url = outcome.url;
  }
  return payload;
}

function isCombinedSignupVerificationProfilePage() {
  if (!isEmailVerificationPage() || !isVerificationPageStillVisible()) {
    return false;
  }

  if (!document.querySelector('form[action*="email-verification/register" i]')) {
    return false;
  }

  const nameInput = document.querySelector('input[name="name"], input[autocomplete="name"]');
  if (!nameInput || !isVisibleElement(nameInput)) {
    return false;
  }

  const ageInput = document.querySelector('input[name="age"]');
  if (ageInput && isVisibleElement(ageInput)) {
    return true;
  }

  const yearSpinner = document.querySelector('[role="spinbutton"][data-type="year"]');
  const monthSpinner = document.querySelector('[role="spinbutton"][data-type="month"]');
  const daySpinner = document.querySelector('[role="spinbutton"][data-type="day"]');
  return Boolean(
    yearSpinner
    && monthSpinner
    && daySpinner
    && isVisibleElement(yearSpinner)
    && isVisibleElement(monthSpinner)
    && isVisibleElement(daySpinner)
  );
}

async function waitForCombinedSignupVerificationProfilePage(timeout = 2500) {
  const start = Date.now();

  while (Date.now() - start < timeout) {
    if (isCombinedSignupVerificationProfilePage()) {
      return true;
    }
    await sleep(100);
  }

  return isCombinedSignupVerificationProfilePage();
}

function getStep5ProfilePathPatterns() {
  return [
    /\/create-account\/profile(?:[/?#]|$)/i,
    /\/u\/signup\/profile(?:[/?#]|$)/i,
    /\/signup\/profile(?:[/?#]|$)/i,
    /\/about-you(?:[/?#]|$)/i,
  ];
}

function getStep5AuthRetryPathPatterns() {
  const signupPatterns = typeof getSignupAuthRetryPathPatterns === 'function'
    ? getSignupAuthRetryPathPatterns()
    : [];
  return [
    ...signupPatterns,
    ...getStep5ProfilePathPatterns(),
  ];
}

function isStep5ProfilePageUrl(rawUrl = location.href) {
  return isSignupProfilePageUrl(rawUrl);
}

function getStep5AuthRetryPageState() {
  if (typeof getAuthTimeoutErrorPageState === 'function') {
    return getAuthTimeoutErrorPageState({
      pathPatterns: getStep5AuthRetryPathPatterns(),
    });
  }

  if (typeof getCurrentAuthRetryPageState === 'function') {
    return getCurrentAuthRetryPageState('signup');
  }

  return null;
}

function getStep5SubmitButton() {
  const direct = document.querySelector('button[type="submit"], input[type="submit"]');
  if (direct && isVisibleElement(direct)) {
    return direct;
  }

  const candidates = document.querySelectorAll('button, [role="button"], input[type="button"], input[type="submit"]');
  return Array.from(candidates).find((el) => {
    if (!isVisibleElement(el)) return false;
    const text = typeof getActionText === 'function'
      ? getActionText(el)
      : [
        el?.textContent,
        el?.value,
        el?.getAttribute?.('aria-label'),
        el?.getAttribute?.('title'),
      ]
        .filter(Boolean)
        .join(' ')
        .replace(/\s+/g, ' ')
        .trim();
    return /完成|创建|create|continue|finish|done|agree|完了|作成|アカウント作成|アカウントを作成|続行|続ける|次へ|同意/i.test(text);
  }) || null;
}

async function waitForStep5SubmitButton(timeout = 5000) {
  const start = Date.now();

  while (Date.now() - start < timeout) {
    throwIfStopped();
    const button = getStep5SubmitButton();
    if (button) {
      return button;
    }
    await sleep(150);
  }

  return null;
}

function isStep5SubmitButtonClickable(button) {
  if (
    !button
    || !isVisibleElement(button)
    || button.disabled
    || button.getAttribute?.('aria-disabled') === 'true'
  ) {
    return false;
  }

  const ariaBusy = String(button.getAttribute?.('aria-busy') || '').trim().toLowerCase();
  if (ariaBusy === 'true') {
    return false;
  }

  const pendingAttr = [
    button.getAttribute?.('data-loading'),
    button.getAttribute?.('data-pending'),
    button.getAttribute?.('data-submitting'),
    button.getAttribute?.('data-state'),
  ]
    .map((value) => String(value || '').trim().toLowerCase())
    .filter(Boolean)
    .join(' ');
  if (/\b(?:true|loading|pending|submitting|busy)\b/.test(pendingAttr)) {
    return false;
  }

  const pendingAncestor = button.closest?.([
    '[aria-busy="true"]',
    '[data-loading="true"]',
    '[data-pending="true"]',
    '[data-submitting="true"]',
    '[data-state="loading"]',
    '[data-state="pending"]',
    '[data-state="submitting"]',
  ].join(', '));
  if (pendingAncestor) {
    return false;
  }

  let style = null;
  try {
    style = typeof window !== 'undefined' && window.getComputedStyle
      ? window.getComputedStyle(button)
      : null;
  } catch {
    style = null;
  }

  if (style?.pointerEvents === 'none') {
    return false;
  }

  const opacity = Number.parseFloat(style?.opacity || '');
  if (Number.isFinite(opacity) && opacity < 0.8) {
    return false;
  }

  return true;
}

function isStep5ProfileStillVisible() {
  if (isStep5ProfilePageUrl()) {
    return true;
  }

  return typeof isStep5Ready === 'function' ? isStep5Ready() : false;
}

function getStep5PostSubmitSuccessState() {
  if (getStep5AuthRetryPageState()) {
    return null;
  }

  if (isStep5CompletionChatgptUrl()) {
    return {
      state: 'logged_in_home',
      url: location.href,
    };
  }

  return null;
}

function getStep5SubmitState() {
  const retryState = getStep5AuthRetryPageState();
  const successState = getStep5PostSubmitSuccessState();
  const errorText = typeof getStep5ErrorText === 'function' ? getStep5ErrorText() : '';
  let signupAuthHost = false;
  try {
    const parsed = new URL(String(location.href || '').trim());
    signupAuthHost = ['auth.openai.com', 'auth0.openai.com', 'accounts.openai.com']
      .includes(String(parsed.hostname || '').toLowerCase());
  } catch {
    signupAuthHost = false;
  }

  return {
    url: location.href,
    retryPage: Boolean(retryState),
    retryEnabled: Boolean(retryState?.retryEnabled),
    maxCheckAttemptsBlocked: Boolean(retryState?.maxCheckAttemptsBlocked),
    userAlreadyExistsBlocked: Boolean(retryState?.userAlreadyExistsBlocked),
    successState: successState?.state || '',
    profileVisible: isStep5ProfileStillVisible(),
    errorText,
    unknownAuthPage: Boolean(
      signupAuthHost
      && !retryState
      && !successState
      && !isStep5ProfileStillVisible()
    ),
  };
}

function logStep5SubmitDebug(message, options = {}) {
  const resolvedState = options?.state && typeof options.state === 'object'
    ? options.state
    : getStep5SubmitState();
  const summary = [
    `url=${resolvedState?.url || location.href}`,
    `retryPage=${Boolean(resolvedState?.retryPage)}`,
    `retryEnabled=${Boolean(resolvedState?.retryEnabled)}`,
    `successState=${resolvedState?.successState || 'none'}`,
    `profileVisible=${Boolean(resolvedState?.profileVisible)}`,
    `unknownAuthPage=${Boolean(resolvedState?.unknownAuthPage)}`,
    `maxCheckAttemptsBlocked=${Boolean(resolvedState?.maxCheckAttemptsBlocked)}`,
    `userAlreadyExistsBlocked=${Boolean(resolvedState?.userAlreadyExistsBlocked)}`,
    resolvedState?.errorText ? `errorText=${resolvedState.errorText}` : null,
  ]
    .filter(Boolean)
    .join(' | ');
  log(`步骤 5 [调试] ${message} | ${summary}`, options?.level || 'info', {
    step: 5,
    stepKey: 'fill-profile',
  });
}

async function recoverStep5SubmitRetryPage(payload = {}) {
  return recoverCurrentAuthRetryPage({
    ...payload,
    flow: 'signup',
    logLabel: payload?.logLabel || '步骤 5：资料提交后检测到认证重试页，正在点击“重试”恢复',
    maxClickAttempts: payload?.maxClickAttempts ?? 2,
    pathPatterns: Array.isArray(payload?.pathPatterns) ? payload.pathPatterns : getStep5AuthRetryPathPatterns(),
    step: 5,
    timeoutMs: payload?.timeoutMs ?? 12000,
  });
}

function installStep5NavigationCompletionReporter(completeOnce) {
  if (typeof window === 'undefined' || typeof window.addEventListener !== 'function') {
    return () => {};
  }
  let reportedNavigation = false;
  const debugLog = typeof logStep5SubmitDebug === 'function'
    ? logStep5SubmitDebug
    : (message, options = {}) => {
        if (typeof log === 'function') {
          log(`步骤 5 [调试] ${message}`, options?.level || 'info', {
            step: 5,
            stepKey: 'fill-profile',
          });
        }
      };

  const onNavigationStarted = (event) => {
    const eventType = String(event?.type || 'navigation').trim() || 'navigation';
    if (reportedNavigation) {
      return;
    }
    reportedNavigation = true;
    if (typeof completeOnce === 'function') {
      try {
        completeOnce({
          navigationStarted: true,
          navigationEventType: eventType,
        });
      } catch (error) {
        if (typeof log === 'function') {
          log(`步骤 5 [调试] 导航交棒信号发送失败：${error?.message || error}`, 'warn', {
            step: 5,
            stepKey: 'fill-profile',
          });
        }
      }
    }
    debugLog(`检测到页面开始导航（event=${eventType}）。`, {
      level: 'warn',
    });
  };

  window.addEventListener('pagehide', onNavigationStarted, { once: true });
  window.addEventListener('beforeunload', onNavigationStarted, { once: true });

  return () => {
    window.removeEventListener('pagehide', onNavigationStarted);
    window.removeEventListener('beforeunload', onNavigationStarted);
  };
}

async function waitForStep5SubmitOutcome(options = {}) {
  const debugLog = typeof logStep5SubmitDebug === 'function'
    ? logStep5SubmitDebug
    : (message, logOptions = {}) => {
        if (typeof log === 'function') {
          log(`步骤 5 [调试] ${message}`, logOptions?.level || 'info', {
            step: 5,
            stepKey: 'fill-profile',
          });
        }
      };
  const {
    timeoutMs = 120000,
    maxAuthRetryRecoveries = 2,
    maxSubmitClicks = 3,
    retryClickIntervalMs = 3500,
  } = options;
  const start = Date.now();
  let authRetryRecoveryCount = 0;
  let submitClickCount = 1;
  let lastSubmitClickAt = Date.now();
  let lastStep5Error = '';

  while (Date.now() - start < timeoutMs) {
    throwIfStopped();

    const retryState = getStep5AuthRetryPageState();
    if (retryState?.userAlreadyExistsBlocked) {
      throw createSignupUserAlreadyExistsError();
    }
    if (retryState?.maxCheckAttemptsBlocked) {
      throw createAuthMaxCheckAttemptsError();
    }
    if (retryState) {
      if (authRetryRecoveryCount >= maxAuthRetryRecoveries) {
        throw new Error(`步骤 5：资料提交后连续进入认证重试页 ${maxAuthRetryRecoveries} 次，页面仍未恢复。URL: ${location.href}`);
      }
      authRetryRecoveryCount += 1;
      debugLog(`检测到资料提交后的认证重试页，准备执行恢复（${authRetryRecoveryCount}/${maxAuthRetryRecoveries}）。`, {
        level: 'warn',
      });
      log(`步骤 5：资料提交后进入认证重试页，正在自动恢复（${authRetryRecoveryCount}/${maxAuthRetryRecoveries}）...`, 'warn');
      await recoverCurrentAuthRetryPage({
        flow: 'signup',
        logLabel: '步骤 5：资料提交后检测到认证重试页，正在点击“重试”恢复',
        maxClickAttempts: 2,
        pathPatterns: getStep5AuthRetryPathPatterns(),
        step: 5,
        timeoutMs: 12000,
      });
      debugLog('认证重试页恢复动作已完成，准备继续等待最终结果。', {
        level: 'info',
      });
      lastSubmitClickAt = Date.now();
      continue;
    }

    const successState = getStep5PostSubmitSuccessState();
    if (successState) {
      debugLog(`检测到资料提交成功状态：${successState.state || 'unknown'}`, {
        level: 'ok',
      });
      return successState;
    }

    const step5Error = typeof getStep5ErrorText === 'function' ? getStep5ErrorText() : '';
    if (step5Error) {
      lastStep5Error = step5Error;
    }

    if (
      isStep5ProfileStillVisible()
      && submitClickCount < maxSubmitClicks
      && Date.now() - lastSubmitClickAt >= retryClickIntervalMs
    ) {
      const submitButton = getStep5SubmitButton();
      if (isStep5SubmitButtonClickable(submitButton)) {
        submitClickCount += 1;
        log(`步骤 5：资料提交后仍停留在资料页，正在重新点击“完成帐户创建”（第 ${submitClickCount}/${maxSubmitClicks} 次）...`, 'warn');
        await humanPause(350, 900);
        simulateClick(submitButton);
        lastSubmitClickAt = Date.now();
        await sleep(1000);
        continue;
      }
    }

    await sleep(250);
  }

  const finalRetryState = getStep5AuthRetryPageState();
  if (finalRetryState?.userAlreadyExistsBlocked) {
    throw createSignupUserAlreadyExistsError();
  }
  if (finalRetryState?.maxCheckAttemptsBlocked) {
    throw createAuthMaxCheckAttemptsError();
  }
  if (finalRetryState) {
    throw new Error(`步骤 5：资料提交后仍停留在认证重试页，自动恢复未完成。URL: ${location.href}`);
  }

  const finalSuccessState = getStep5PostSubmitSuccessState();
  if (finalSuccessState) {
    return finalSuccessState;
  }

  const finalStep5Error = (typeof getStep5ErrorText === 'function' ? getStep5ErrorText() : '') || lastStep5Error;
  if (finalStep5Error) {
    throw new Error(`步骤 5：资料提交后页面返回错误：${finalStep5Error}。URL: ${location.href}`);
  }

  throw new Error(`步骤 5：资料提交后未检测到页面跳转或恢复成功（已点击提交 ${submitClickCount}/${maxSubmitClicks} 次）。URL: ${location.href}`);
}

async function step5_fillNameBirthday(payload) {
  const { firstName, lastName, age, year, month, day, prefillOnly = false } = payload;
  if (!firstName || !lastName) throw new Error('未提供姓名数据。');
  const performOperationWithDelay = typeof getOperationDelayRunner === 'function'
    ? getOperationDelayRunner()
    : async (metadata, operation) => {
        const rootScope = typeof window !== 'undefined' ? window : globalThis;
        const gate = rootScope?.CodexOperationDelay?.performOperationWithDelay;
        return typeof gate === 'function' ? gate(metadata, operation) : operation();
      };

  const resolvedAge = age ?? (year ? new Date().getFullYear() - Number(year) : null);
  const hasBirthdayData = [year, month, day].every(value => value != null && !Number.isNaN(Number(value)));
  if (!hasBirthdayData && (resolvedAge == null || Number.isNaN(Number(resolvedAge)))) {
    throw new Error('未提供生日或年龄数据。');
  }

  const fullName = `${firstName} ${lastName}`;
  log(`步骤 5：正在填写姓名：${fullName}`);

  // Actual DOM structure:
  // - Full name: <input name="name" placeholder="全名" type="text">
  // - Birthday: React Aria DateField or hidden input[name="birthday"]
  // - Age: <input name="age" type="text|number">

  // --- Full Name (single field, not first+last) ---
  let nameInput = null;
  try {
    nameInput = await waitForElement(
      'input[name="name"], input[placeholder*="全名"], input[placeholder*="氏名"], input[placeholder*="名前"], input[placeholder*="お名前"], input[autocomplete="name"]',
      10000
    );
  } catch {
    throw new Error('未找到姓名输入框。URL: ' + location.href);
  }
  await humanPause(500, 1300);
  await performOperationWithDelay({ stepKey: 'fill-profile', kind: 'fill', label: 'fill-name' }, async () => {
    fillInput(nameInput, fullName);
  });
  log(`步骤 5：姓名已填写：${fullName}`);

  let birthdayMode = false;
  let ageInput = null;
  let yearSpinner = null;
  let monthSpinner = null;
  let daySpinner = null;
  let hiddenBirthday = null;
  let yearReactSelect = null;
  let monthReactSelect = null;
  let dayReactSelect = null;
  let visibleAgeInput = false;
  let visibleBirthdaySpinners = false;
  let visibleBirthdaySelects = false;
  const findBirthdaySelect = (...labels) => labels
    .map((label) => findBirthdayReactAriaSelect(label))
    .find(Boolean) || null;

  for (let i = 0; i < 100; i++) {
    yearSpinner = document.querySelector('[role="spinbutton"][data-type="year"]');
    monthSpinner = document.querySelector('[role="spinbutton"][data-type="month"]');
    daySpinner = document.querySelector('[role="spinbutton"][data-type="day"]');
    hiddenBirthday = document.querySelector('input[name="birthday"]');
    ageInput = document.querySelector('input[name="age"]');
    yearReactSelect = findBirthdaySelect('年', 'Year');
    monthReactSelect = findBirthdaySelect('月', 'Month');
    dayReactSelect = findBirthdaySelect('天', '日', 'Day');

    visibleAgeInput = Boolean(ageInput && isVisibleElement(ageInput));
    visibleBirthdaySpinners = Boolean(
      yearSpinner
      && monthSpinner
      && daySpinner
      && isVisibleElement(yearSpinner)
      && isVisibleElement(monthSpinner)
      && isVisibleElement(daySpinner)
    );
    visibleBirthdaySelects = Boolean(
      yearReactSelect?.button
      && monthReactSelect?.button
      && dayReactSelect?.button
      && isVisibleElement(yearReactSelect.button)
      && isVisibleElement(monthReactSelect.button)
      && isVisibleElement(dayReactSelect.button)
    );

    if (visibleAgeInput) break;
    if (visibleBirthdaySpinners || visibleBirthdaySelects) {
      birthdayMode = true;
      break;
    }
    await sleep(100);
  }

  if (birthdayMode) {
    if (!hasBirthdayData) {
      throw new Error('检测到生日字段，但未提供生日数据。');
    }

    const yearSpinner = document.querySelector('[role="spinbutton"][data-type="year"]');
    const monthSpinner = document.querySelector('[role="spinbutton"][data-type="month"]');
    const daySpinner = document.querySelector('[role="spinbutton"][data-type="day"]');
    const yearReactSelect = findBirthdaySelect('年', 'Year');
    const monthReactSelect = findBirthdaySelect('月', 'Month');
    const dayReactSelect = findBirthdaySelect('天', '日', 'Day');

    if (yearReactSelect?.nativeSelect && monthReactSelect?.nativeSelect && dayReactSelect?.nativeSelect) {
      const desiredDate = `${year}-${String(month).padStart(2, '0')}-${String(day).padStart(2, '0')}`;
      const hiddenBirthday = document.querySelector('input[name="birthday"]');

      log('步骤 5：检测到 React Aria 下拉生日字段，正在填写生日...');
      await humanPause(450, 1100);
      await performOperationWithDelay({ stepKey: 'fill-profile', kind: 'select', label: 'select-birthday-year' }, async () => {
        await setReactAriaBirthdaySelect(yearReactSelect, year);
      });
      await humanPause(250, 650);
      await performOperationWithDelay({ stepKey: 'fill-profile', kind: 'select', label: 'select-birthday-month' }, async () => {
        await setReactAriaBirthdaySelect(monthReactSelect, month);
      });
      await humanPause(250, 650);
      await performOperationWithDelay({ stepKey: 'fill-profile', kind: 'select', label: 'select-birthday-day' }, async () => {
        await setReactAriaBirthdaySelect(dayReactSelect, day);
      });

      if (hiddenBirthday) {
        const start = Date.now();
        while (Date.now() - start < 2000) {
          if ((hiddenBirthday.value || '') === desiredDate) break;
          await sleep(100);
        }

        if ((hiddenBirthday.value || '') !== desiredDate) {
          throw new Error(`生日值未成功写入页面。期望 ${desiredDate}，实际 ${(hiddenBirthday.value || '空')}。`);
        }
      }

      log(`步骤 5：React Aria 生日已填写：${desiredDate}`);
    }

    if (yearSpinner && monthSpinner && daySpinner) {
      log('步骤 5：检测到生日字段，正在填写生日...');

      async function setSpinButton(el, value) {
        el.focus();
        await sleep(100);
        document.execCommand('selectAll', false, null);
        await sleep(50);

        const valueStr = String(value);
        for (const char of valueStr) {
          el.dispatchEvent(new KeyboardEvent('keydown', { key: char, code: `Digit${char}`, bubbles: true }));
          el.dispatchEvent(new KeyboardEvent('keypress', { key: char, code: `Digit${char}`, bubbles: true }));
          el.dispatchEvent(new InputEvent('beforeinput', { inputType: 'insertText', data: char, bubbles: true }));
          el.dispatchEvent(new InputEvent('input', { inputType: 'insertText', data: char, bubbles: true }));
          await sleep(50);
        }

        el.dispatchEvent(new KeyboardEvent('keyup', { key: 'Tab', code: 'Tab', bubbles: true }));
        el.blur();
        await sleep(100);
      }

      await humanPause(450, 1100);
      await performOperationWithDelay({ stepKey: 'fill-profile', kind: 'fill', label: 'fill-birthday-year' }, async () => {
        await setSpinButton(yearSpinner, year);
      });
      await humanPause(250, 650);
      await performOperationWithDelay({ stepKey: 'fill-profile', kind: 'fill', label: 'fill-birthday-month' }, async () => {
        await setSpinButton(monthSpinner, String(month).padStart(2, '0'));
      });
      await humanPause(250, 650);
      await performOperationWithDelay({ stepKey: 'fill-profile', kind: 'fill', label: 'fill-birthday-day' }, async () => {
        await setSpinButton(daySpinner, String(day).padStart(2, '0'));
      });
      log(`步骤 5：生日已填写：${year}-${String(month).padStart(2, '0')}-${String(day).padStart(2, '0')}`);
    }

    const hiddenBirthday = document.querySelector('input[name="birthday"]');
    if (hiddenBirthday) {
      const dateStr = `${year}-${String(month).padStart(2, '0')}-${String(day).padStart(2, '0')}`;
      await performOperationWithDelay({ stepKey: 'fill-profile', kind: 'hidden-sync', label: 'profile-dom-sync' }, async () => {
        hiddenBirthday.value = dateStr;
        hiddenBirthday.dispatchEvent(new Event('input', { bubbles: true }));
        hiddenBirthday.dispatchEvent(new Event('change', { bubbles: true }));
      });
      log(`步骤 5：已设置隐藏生日输入框：${dateStr}`);
    }
  } else if (ageInput) {
    if (resolvedAge == null || Number.isNaN(Number(resolvedAge))) {
      throw new Error('检测到年龄字段，但未提供年龄数据。');
    }
    await humanPause(500, 1300);
    await performOperationWithDelay({ stepKey: 'fill-profile', kind: 'fill', label: 'fill-birthday' }, async () => {
      fillInput(ageInput, String(resolvedAge));
    });
    log(`步骤 5：年龄已填写：${resolvedAge}`);
  } else {
    throw new Error('未找到生日或年龄输入项。URL: ' + location.href);
  }
  // 韩国IP判断勾选框""I agree"
  const allConsentCheckbox = findStep5AllConsentCheckbox();

  if (allConsentCheckbox) {
    if (!isStep5CheckboxChecked(allConsentCheckbox)) {
      const checkboxLabel = allConsentCheckbox.closest('label');
      await humanPause(500, 1500);
      await performOperationWithDelay({ stepKey: 'fill-profile', kind: 'click', label: 'accept-profile-consent' }, async () => {
        if (checkboxLabel && isVisibleElement(checkboxLabel)) {
          simulateClick(checkboxLabel);
        } else {
          simulateClick(allConsentCheckbox);
        }
      });
      await sleep(250);

      if (!isStep5CheckboxChecked(allConsentCheckbox)) {
        await performOperationWithDelay({ stepKey: 'fill-profile', kind: 'click', label: 'accept-profile-consent-fallback' }, async () => {
          allConsentCheckbox.click();
        });
        await sleep(250);
      }

      if (!isStep5CheckboxChecked(allConsentCheckbox)) {
        throw new Error('未能勾选 “I agree to all of the following” 复选框。');
      }

      log('步骤 5：已勾选 “I agree to all of the following”。');
    } else {
      log('步骤 5：“I agree to all of the following” 已勾选，跳过。');
    }
  }


  if (prefillOnly) {
    log('步骤 4：混合注册页资料已预填，继续填写验证码。', 'info');
    return { prefilled: true };
  }

  // Click "完成帐户创建" button
  await sleep(500);
  const completeBtn = await waitForStep5SubmitButton(5000)
    || await waitForElementByText('button', /完成|完了|作成|アカウント作成|アカウントを作成|続行|続ける|次へ|同意|create|continue|finish|done|agree/i, 5000).catch(() => null);
  if (!completeBtn) {
    throw new Error('未找到“完成帐户创建”按钮。URL: ' + location.href);
  }

  const isAgeMode = !birthdayMode && Boolean(ageInput);
  if (isAgeMode) {
    log('步骤 5：当前为年龄输入模式，点击“完成帐户创建”后将等待页面结果。', 'info');
  }

  let reportedCompletionPayload = null;
  const debugLog = typeof logStep5SubmitDebug === 'function'
    ? logStep5SubmitDebug
    : (message, logOptions = {}) => {
        if (typeof log === 'function') {
          log(`步骤 5 [调试] ${message}`, logOptions?.level || 'info', {
            step: 5,
            stepKey: 'fill-profile',
          });
        }
      };
  function completeStep5Once(extra = {}) {
    const completionReason = extra?.outcome?.state
      || (extra?.navigationStarted ? `navigation_started:${extra?.navigationEventType || 'unknown'}` : 'direct_completion');
    if (reportedCompletionPayload) {
      debugLog(`忽略重复完成信号（reason=${completionReason}）。`, {
        level: 'warn',
      });
      return reportedCompletionPayload;
    }

    const completionPayload = getStep5DirectCompletionPayload({
      isAgeMode,
      navigationStarted: Boolean(extra.navigationStarted),
      navigationEventType: extra.navigationEventType || '',
      outcome: extra.outcome || null,
    });
    reportedCompletionPayload = completionPayload;
    if (extra?.navigationStarted && typeof reportNodeComplete === 'function') {
      reportNodeComplete('fill-profile', completionPayload);
    } else {
      reportComplete(5, completionPayload);
    }
    debugLog(`准备发送完成信号（reason=${completionReason}，isAgeMode=${isAgeMode}）。`, {
      level: extra?.navigationStarted ? 'warn' : 'info',
    });
    return completionPayload;
  }

  const cleanupNavigationReporter = installStep5NavigationCompletionReporter(completeStep5Once);

  await humanPause(500, 1300);
  await performOperationWithDelay({ stepKey: 'fill-profile', kind: 'submit', label: 'submit-profile' }, async () => {
    simulateClick(completeBtn);
  });
  log('步骤 5：已点击“完成帐户创建”，正在等待页面跳转、重试页或提交结果。');

  try {
    const outcome = await waitForStep5SubmitOutcome();
    cleanupNavigationReporter();

    const completionPayload = completeStep5Once({ outcome });
    log(`步骤 5：资料提交结果已确认（${outcome.state || 'success'}），准备继续后续步骤。`, 'ok');
    return completionPayload;
  } catch (error) {
    cleanupNavigationReporter();
    throw error;
  }
}
