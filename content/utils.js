// content/utils.js — Shared utilities for all content scripts

const getActivationStrategy = self.MultiPageActivationUtils?.getActivationStrategy;

function detectScriptSource({
  injectedSource,
  url = '',
  hostname = '',
} = {}) {
  const sourceRegistry = globalThis?.MultiPageSourceRegistry?.createSourceRegistry?.();
  if (sourceRegistry?.detectSourceFromLocation) {
    return sourceRegistry.detectSourceFromLocation({
      injectedSource,
      url,
      hostname,
    });
  }
  if (injectedSource) return injectedSource;
  if (url.includes('auth0.openai.com') || url.includes('auth.openai.com') || url.includes('accounts.openai.com')) return 'openai-auth';
  if (hostname === 'mail.qq.com' || hostname === 'wx.mail.qq.com') return 'qq-mail';
  if (
    hostname === 'mail.163.com'
    || hostname.endsWith('.mail.163.com')
    || hostname === 'webmail.vip.163.com'
    || hostname === 'mail.126.com'
    || hostname.endsWith('.mail.126.com')
  ) return 'mail-163';
  if (hostname === 'mail.google.com') return 'gmail-mail';
  if (hostname === 'www.icloud.com' || hostname === 'www.icloud.com.cn') return 'icloud-mail';
  if (url.includes('duckduckgo.com/email/settings/autofill')) return 'duck-mail';
  if (url.includes('chatgpt.com')) return 'chatgpt';
  if (url.includes("2925.com")) return "mail-2925";
  return 'unknown-source';
}

const SCRIPT_SOURCE = (() => {
  return detectScriptSource({
    injectedSource: window.__MULTIPAGE_SOURCE,
    url: location.href,
    hostname: location.hostname,
  });
})();

function getRuntimeScriptSource() {
  return window.__MULTIPAGE_SOURCE || SCRIPT_SOURCE;
}

const LOG_PREFIX = `[MultiPage:${SCRIPT_SOURCE}]`;
const STOP_ERROR_MESSAGE = 'Flow stopped by user.';
let flowStopped = false;

if (!window.__MULTIPAGE_UTILS_LISTENER_READY__) {
  window.__MULTIPAGE_UTILS_LISTENER_READY__ = true;

  chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
    if (message.type === 'STOP_FLOW') {
      flowStopped = true;
      console.warn(LOG_PREFIX, STOP_ERROR_MESSAGE);
      return;
    }

    if (message.type === 'PING') {
      sendResponse({
        ok: true,
        source: getRuntimeScriptSource(),
        plusCheckoutReady: Boolean(window.__MULTIPAGE_PLUS_CHECKOUT_READY__),
      });
    }
  });
}

function resetStopState() {
  flowStopped = false;
}

function isStopError(error) {
  const message = typeof error === 'string' ? error : error?.message;
  return message === STOP_ERROR_MESSAGE;
}

function throwIfStopped() {
  if (flowStopped) {
    throw new Error(STOP_ERROR_MESSAGE);
  }
}

/**
 * Wait for a DOM element to appear.
 * @param {string} selector - CSS selector
 * @param {number} timeout - Max wait time in ms (default 10000)
 * @returns {Promise<Element>}
 */
function waitForElement(selector, timeout = 10000) {
  return new Promise((resolve, reject) => {
    throwIfStopped();

    const existing = document.querySelector(selector);
    if (existing) {
      console.log(LOG_PREFIX, `Found element immediately: ${selector}`);
      log(`Element found: ${selector}`);
      resolve(existing);
      return;
    }

    console.log(LOG_PREFIX, `Waiting for element: ${selector} (timeout ${timeout}ms)`);
    log(`Waiting for selector: ${selector}...`);

    let settled = false;
    let stopTimer = null;
    const cleanup = () => {
      if (settled) return;
      settled = true;
      observer.disconnect();
      clearTimeout(timer);
      clearTimeout(stopTimer);
    };

    const observer = new MutationObserver(() => {
      if (flowStopped) {
        cleanup();
        reject(new Error(STOP_ERROR_MESSAGE));
        return;
      }
      const el = document.querySelector(selector);
      if (el) {
        cleanup();
        console.log(LOG_PREFIX, `Element found after wait: ${selector}`);
        log(`Element found: ${selector}`);
        resolve(el);
      }
    });

    observer.observe(document.body || document.documentElement, {
      childList: true,
      subtree: true,
    });

    const timer = setTimeout(() => {
      cleanup();
      const msg = `Timed out waiting for ${selector} at ${location.href}, exceeded ${timeout}ms`;
      console.error(LOG_PREFIX, msg);
      reject(new Error(msg));
    }, timeout);

    const pollStop = () => {
      if (settled) return;
      if (flowStopped) {
        cleanup();
        reject(new Error(STOP_ERROR_MESSAGE));
        return;
      }
      stopTimer = setTimeout(pollStop, 100);
    };
    pollStop();
  });
}

/**
 * Wait for an element matching a text pattern among multiple candidates.
 * @param {string} containerSelector - Selector for candidate elements
 * @param {RegExp} textPattern - Regex to match against textContent
 * @param {number} timeout - Max wait time in ms
 * @returns {Promise<Element>}
 */
function waitForElementByText(containerSelector, textPattern, timeout = 10000) {
  return new Promise((resolve, reject) => {
    throwIfStopped();

    function search() {
      const candidates = document.querySelectorAll(containerSelector);
      for (const el of candidates) {
        if (textPattern.test(el.textContent)) {
          return el;
        }
      }
      return null;
    }

    const existing = search();
    if (existing) {
      console.log(LOG_PREFIX, `Element found immediately by text: ${containerSelector} matches ${textPattern}`);
      log(`Element found by text: ${textPattern}`);
      resolve(existing);
      return;
    }

    console.log(LOG_PREFIX, `Waiting for text match: ${containerSelector} / ${textPattern}`);
    log(`Waiting for element containing text: ${textPattern}...`);

    let settled = false;
    let stopTimer = null;
    const cleanup = () => {
      if (settled) return;
      settled = true;
      observer.disconnect();
      clearTimeout(timer);
      clearTimeout(stopTimer);
    };

    const observer = new MutationObserver(() => {
      if (flowStopped) {
        cleanup();
        reject(new Error(STOP_ERROR_MESSAGE));
        return;
      }
      const el = search();
      if (el) {
        cleanup();
        console.log(LOG_PREFIX, `Element found by text after wait: ${textPattern}`);
        log(`Element found by text: ${textPattern}`);
        resolve(el);
      }
    });

    observer.observe(document.body || document.documentElement, {
      childList: true,
      subtree: true,
    });

    const timer = setTimeout(() => {
      cleanup();
      const msg = `Timed out waiting for text "${textPattern}" in ${containerSelector} at ${location.href}, exceeded ${timeout}ms`;
      console.error(LOG_PREFIX, msg);
      reject(new Error(msg));
    }, timeout);

    const pollStop = () => {
      if (settled) return;
      if (flowStopped) {
        cleanup();
        reject(new Error(STOP_ERROR_MESSAGE));
        return;
      }
      stopTimer = setTimeout(pollStop, 100);
    };
    pollStop();
  });
}

/**
 * React-compatible form filling.
 * Sets value via native setter and dispatches input + change events.
 * @param {HTMLInputElement} el
 * @param {string} value
 */
function fillInput(el, value) {
  throwIfStopped();
  const nativeInputValueSetter = Object.getOwnPropertyDescriptor(
    window.HTMLInputElement.prototype,
    'value'
  ).set;
  nativeInputValueSetter.call(el, value);
  el.dispatchEvent(new Event('input', { bubbles: true }));
  el.dispatchEvent(new Event('change', { bubbles: true }));
  console.log(LOG_PREFIX, `Filled input ${el.name || el.id || el.type}: ${value}`);
  log(`Filled input [${el.name || el.id || el.type || 'unknown'}]`);
}

/**
 * Fill a select element by setting its value and triggering change.
 * @param {HTMLSelectElement} el
 * @param {string} value
 */
function fillSelect(el, value) {
  throwIfStopped();
  el.value = value;
  el.dispatchEvent(new Event('change', { bubbles: true }));
  console.log(LOG_PREFIX, `Selected value in ${el.name || el.id}: ${value}`);
  log(`Selected [${el.name || el.id || 'unknown'}] = ${value}`);
}

function normalizeLogStep(value) {
  const step = Math.floor(Number(value) || 0);
  return step > 0 ? step : null;
}

const DEFAULT_OPENAI_NODE_BY_STEP = Object.freeze({
  1: 'open-chatgpt',
  2: 'submit-signup-email',
  3: 'fill-password',
  4: 'fetch-signup-code',
  5: 'fill-profile',
  6: 'wait-registration-success',
  7: 'oauth-login',
  8: 'fetch-login-code',
  9: 'post-login-phone-verification',
  10: 'confirm-oauth',
  11: 'fetch-login-code',
  12: 'post-login-phone-verification',
  13: 'confirm-oauth',
  14: 'platform-verify',
  15: 'platform-verify',
  16: 'confirm-oauth',
  17: 'platform-verify',
});

function resolveReportNodeId(stepOrNodeId, data = {}) {
  const explicitNodeId = String(data?.nodeId || data?.nodeKey || '').trim();
  if (explicitNodeId) {
    return explicitNodeId;
  }
  const directNodeId = String(stepOrNodeId || '').trim();
  if (directNodeId && !/^\d+$/.test(directNodeId)) {
    return directNodeId;
  }
  const step = normalizeLogStep(stepOrNodeId || data?.step || data?.visibleStep);
  return step ? DEFAULT_OPENAI_NODE_BY_STEP[step] || '' : '';
}

/**
 * Send a log message to Side Panel via Background.
 * @param {string} message
 * @param {string} level - 'info' | 'ok' | 'warn' | 'error'
 * @param {{ step?: number, stepKey?: string }} options
 */
function log(message, level = 'info', options = {}) {
  const step = normalizeLogStep(options?.step);
  chrome.runtime.sendMessage({
    type: 'LOG',
    source: getRuntimeScriptSource(),
    step,
    payload: {
      message: String(message || ''),
      level,
      timestamp: Date.now(),
      step,
      stepKey: String(options?.stepKey || '').trim(),
    },
    error: null,
  });
}

/**
 * Report that this content script is loaded and ready.
 */
function reportReady() {
  if (getRuntimeScriptSource() === 'unknown-source') {
    console.warn(LOG_PREFIX, 'skip CONTENT_SCRIPT_READY for unknown source');
    return;
  }
  console.log(LOG_PREFIX, 'Content script ready');
  const message = {
    type: 'CONTENT_SCRIPT_READY',
    source: getRuntimeScriptSource(),
    step: null,
    payload: {},
    error: null,
  };
  Promise.resolve(chrome.runtime.sendMessage(message))
    .then((response) => {
      console.log(LOG_PREFIX, 'CONTENT_SCRIPT_READY sent successfully', { response, url: location.href });
    })
    .catch((err) => {
      console.error(LOG_PREFIX, 'CONTENT_SCRIPT_READY send failed', err?.message || err, { url: location.href });
    });
}

/**
 * Report node completion.
 * @param {string|number} stepOrNodeId
 * @param {Object} data - Node output data
 */
function reportComplete(stepOrNodeId, data = {}) {
  const nodeId = resolveReportNodeId(stepOrNodeId, data);
  const step = normalizeLogStep(stepOrNodeId || data?.step || data?.visibleStep);
  console.log(LOG_PREFIX, `Node ${nodeId || stepOrNodeId} completed`, data);
  log('Completed successfully', 'ok', { step, stepKey: nodeId });
  const message = {
    type: 'NODE_COMPLETE',
    source: getRuntimeScriptSource(),
    nodeId,
    payload: {
      ...(data || {}),
      ...(nodeId ? { nodeId } : {}),
      ...(step ? { step } : {}),
    },
    error: null,
  };
  Promise.resolve(chrome.runtime.sendMessage(message))
    .then((response) => {
      console.log(LOG_PREFIX, `NODE_COMPLETE sent successfully for node ${nodeId || stepOrNodeId}`, {
        response,
        url: location.href,
        payloadKeys: Object.keys(data || {}),
      });
    })
    .catch((err) => {
      console.error(LOG_PREFIX, `NODE_COMPLETE send failed for node ${nodeId || stepOrNodeId}`, err?.message || err, {
        url: location.href,
        payloadKeys: Object.keys(data || {}),
      });
    });
}

function reportNodeComplete(nodeId, data = {}) {
  const normalizedNodeId = String(nodeId || '').trim();
  console.log(LOG_PREFIX, `Node ${normalizedNodeId} completed`, data);
  const message = {
    type: 'NODE_COMPLETE',
    source: getRuntimeScriptSource(),
    nodeId: normalizedNodeId,
    payload: {
      ...(data || {}),
      nodeId: normalizedNodeId,
    },
    error: null,
  };
  Promise.resolve(chrome.runtime.sendMessage(message))
    .then((response) => {
      console.log(LOG_PREFIX, `NODE_COMPLETE sent successfully for node ${normalizedNodeId}`, {
        response,
        url: location.href,
        payloadKeys: Object.keys(data || {}),
      });
    })
    .catch((err) => {
      console.error(LOG_PREFIX, `NODE_COMPLETE send failed for node ${normalizedNodeId}`, err?.message || err, {
        url: location.href,
        payloadKeys: Object.keys(data || {}),
      });
    });
}

/**
 * Report node error.
 * @param {string|number} stepOrNodeId
 * @param {string} errorMessage
 */
function reportError(stepOrNodeId, errorMessage) {
  const nodeId = resolveReportNodeId(stepOrNodeId);
  const step = normalizeLogStep(stepOrNodeId);
  console.error(LOG_PREFIX, `Node ${nodeId || stepOrNodeId} failed: ${errorMessage}`);
  const message = {
    type: 'NODE_ERROR',
    source: getRuntimeScriptSource(),
    nodeId,
    payload: {
      ...(nodeId ? { nodeId } : {}),
      ...(step ? { step } : {}),
    },
    error: errorMessage,
  };
  Promise.resolve(chrome.runtime.sendMessage(message))
    .then((response) => {
      console.log(LOG_PREFIX, `NODE_ERROR sent successfully for node ${nodeId || stepOrNodeId}`, {
        response,
        url: location.href,
        errorMessage,
      });
    })
    .catch((err) => {
      console.error(LOG_PREFIX, `NODE_ERROR send failed for node ${nodeId || stepOrNodeId}`, err?.message || err, {
        url: location.href,
        errorMessage,
      });
    });
}

function reportNodeError(nodeId, errorMessage) {
  const normalizedNodeId = String(nodeId || '').trim();
  console.error(LOG_PREFIX, `Node ${normalizedNodeId} failed: ${errorMessage}`);
  const message = {
    type: 'NODE_ERROR',
    source: getRuntimeScriptSource(),
    nodeId: normalizedNodeId,
    payload: {
      nodeId: normalizedNodeId,
    },
    error: errorMessage,
  };
  Promise.resolve(chrome.runtime.sendMessage(message))
    .then((response) => {
      console.log(LOG_PREFIX, `NODE_ERROR sent successfully for node ${normalizedNodeId}`, {
        response,
        url: location.href,
        errorMessage,
      });
    })
    .catch((err) => {
      console.error(LOG_PREFIX, `NODE_ERROR send failed for node ${normalizedNodeId}`, err?.message || err, {
        url: location.href,
        errorMessage,
      });
    });
}

/**
 * Simulate a click with proper event dispatching.
 * @param {Element} el
 */
function simulateClick(el) {
  throwIfStopped();
  if (!el) {
    throw new Error('Cannot click null element.');
  }

  const form = el.form || el.closest?.('form') || null;
  const strategy = typeof getActivationStrategy === 'function'
    ? getActivationStrategy({
      tagName: el.tagName,
      type: el.getAttribute?.('type') || el.type || '',
      hasForm: Boolean(form),
      pathname: location.pathname || '',
    })
    : { method: 'click' };

  let method = strategy.method || 'click';
  const textBeforeClick = el.textContent || '';

  if (method === 'requestSubmit' && form && typeof form.requestSubmit === 'function') {
    form.requestSubmit(el);
  } else if (typeof el.click === 'function') {
    method = 'click';
    el.click();
  } else {
    method = 'dispatchEvent';
    el.dispatchEvent(new MouseEvent('click', { bubbles: true, cancelable: true }));
  }

  console.log(LOG_PREFIX, `Clicked (${method}): ${el.tagName} ${textBeforeClick.slice(0, 30)}`);
  log(`Clicked (${method}) [${el.tagName}] "${textBeforeClick.trim().slice(0, 30) || ''}"`);
}

/**
 * Wait a specified number of milliseconds.
 * @param {number} ms
 * @returns {Promise<void>}
 */
function sleep(ms) {
  return new Promise((resolve, reject) => {
    const start = Date.now();

    function tick() {
      if (flowStopped) {
        reject(new Error(STOP_ERROR_MESSAGE));
        return;
      }
      if (Date.now() - start >= ms) {
        resolve();
        return;
      }
      setTimeout(tick, Math.min(100, Math.max(25, ms - (Date.now() - start))));
    }

    tick();
  });
}

async function humanPause(min = 250, max = 850) {
  const duration = Math.floor(Math.random() * (max - min + 1)) + min;
  await sleep(duration);
}

function shouldReportReadyForFrame(source, isChildFrame) {
  const sourceRegistry = globalThis?.MultiPageSourceRegistry?.createSourceRegistry?.();
  if (sourceRegistry?.shouldReportReadyForFrame) {
    return sourceRegistry.shouldReportReadyForFrame(source, isChildFrame);
  }
  if (!isChildFrame) return true;
  return ![
    'qq-mail',
    'mail-163',
    'gmail-mail',
    'mail-2925',
    'inbucket-mail',
    'plus-checkout',
    'unknown-source',
  ].includes(source);
}

// Auto-report ready on load. Child frames are probed explicitly by frameId, so
// they should not overwrite the tab-level registration or spam the side panel.
if (shouldReportReadyForFrame(getRuntimeScriptSource(), window !== window.top)) {
  reportReady();
}
