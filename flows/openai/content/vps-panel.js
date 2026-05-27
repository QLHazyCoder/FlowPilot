// flows/openai/content/vps-panel.js — Content script for CPA panel (OAuth URL request / platform verification node)
// Injected on: CPA panel (user-configured URL)
//
// Actual DOM structure (after login click):
// <div class="card">
//   <div class="card-header">
//     <span class="OAuthPage-module__cardTitle___yFaP0">Codex OAuth</span>
//     <button class="btn btn-primary"><span>Login</span></button>
//   </div>
//   <div class="OAuthPage-module__cardContent___1sXLA">
//     <div class="OAuthPage-module__authUrlBox___Iu1d4">
//       <div class="OAuthPage-module__authUrlLabel___mYFJB">Authorization link:</div>
//       <div class="OAuthPage-module__authUrlValue___axvUJ">https://auth.openai.com/...</div>
//       <div class="OAuthPage-module__authUrlActions___venPj">
//         <button class="btn btn-secondary btn-sm"><span>Copy link</span></button>
//         <button class="btn btn-secondary btn-sm"><span>Open link</span></button>
//       </div>
//     </div>
//     <div class="OAuthPage-module__callbackSection___8kA31">
//       <input class="input" placeholder="http://localhost:1455/auth/callback?code=...&state=...">
//       <button class="btn btn-secondary btn-sm"><span>Submit callback URL</span></button>
//       <div class="status-badge success">Callback URL submitted, waiting for authentication...</div>
//       <div class="status-badge error">Callback URL submission failed: ...</div>
//     </div>
//     <div class="status-badge">Waiting for authentication... / Authentication successful! / Authentication failed: ...</div>
//   </div>
// </div>

console.log('[MultiPage:vps-panel] Content script loaded on', location.href);

const VPS_PANEL_LISTENER_SENTINEL = 'data-multipage-vps-panel-listener';
const STEP9_SUCCESS_BADGE_TIMEOUT_MS = 120000;
const {
  isRecoverableStep9AuthFailure,
} = self.MultiPageActivationUtils || {};

if (document.documentElement.getAttribute(VPS_PANEL_LISTENER_SENTINEL) !== '1') {
  document.documentElement.setAttribute(VPS_PANEL_LISTENER_SENTINEL, '1');

  // Listen for commands from Background
  chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
    if (message.type === 'EXECUTE_NODE' || message.type === 'REQUEST_OAUTH_URL') {
      resetStopState();
      const startedAt = Date.now();
      const actionLabel = message.type === 'REQUEST_OAUTH_URL'
        ? 'REQUEST_OAUTH_URL'
        : `EXECUTE_NODE received for node ${message.nodeId || message.payload?.nodeId || ''}`;
      console.log(LOG_PREFIX, actionLabel, {
        url: location.href,
        payloadKeys: Object.keys(message.payload || {}),
        snapshot: getVpsPanelSnapshot(),
      });
      const handler = message.type === 'REQUEST_OAUTH_URL'
        ? requestOAuthUrl(message.payload)
        : handleNode(message.nodeId || message.payload?.nodeId, message.payload);
      handler.then((result) => {
        console.log(LOG_PREFIX, `${actionLabel} resolved after ${Date.now() - startedAt}ms`, {
          url: location.href,
          snapshot: getVpsPanelSnapshot(),
        });
        sendResponse({ ok: true, ...(result || {}) });
      }).catch(err => {
        console.error(LOG_PREFIX, `${actionLabel} rejected after ${Date.now() - startedAt}ms: ${err?.message || err}`, {
          url: location.href,
          snapshot: getVpsPanelSnapshot(),
        });
        if (isStopError(err)) {
          if (message.payload?.visibleStep || message.step) {
            log('Stopped by user.', 'warn', { step: message.payload?.visibleStep || message.step });
          }
          sendResponse({ stopped: true, error: err.message });
          return;
        }
        if (message.nodeId || message.payload?.nodeId) {
          reportError(message.nodeId || message.payload?.nodeId, err.message);
        }
        sendResponse({ error: err.message });
      });
      return true;
    }
  });
} else {
  console.log('[MultiPage:vps-panel] message listener already exists, skipping duplicate registration');
}

async function handleStep(step, payload) {
  switch (step) {
    case 1: return await step1_getOAuthLink(payload);
    case 10:
    case 12:
    case 13:
      return await step9_vpsVerify({ ...(payload || {}), visibleStep: step });
    default:
      throw new Error(`vps-panel.js does not handle step ${step}`);
  }
}

async function handleNode(nodeId, payload = {}) {
  const normalizedNodeId = String(nodeId || '').trim();
  switch (normalizedNodeId) {
    case 'platform-verify':
      return await step9_vpsVerify(payload);
    default:
      throw new Error(`vps-panel.js does not handle node ${normalizedNodeId}`);
  }
}

function isVisibleElement(el) {
  if (!el) return false;
  const style = window.getComputedStyle(el);
  const rect = el.getBoundingClientRect();
  return style.display !== 'none'
    && style.visibility !== 'hidden'
    && rect.width > 0
    && rect.height > 0;
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

function getInlineTextSnippet(text, maxLength = 160) {
  const normalized = (text || '').replace(/\s+/g, ' ').trim();
  if (!normalized) return '';
  if (normalized.length <= maxLength) return normalized;
  return `${normalized.slice(0, maxLength)}...`;
}

function getPageTextSnippet(maxLength = 240) {
  const bodyText = document.body?.innerText || document.documentElement?.innerText || '';
  return getInlineTextSnippet(bodyText, maxLength);
}

function getVpsPanelSnapshot() {
  const authUrlEl = findAuthUrlElement();
  const oauthHeader = findCodexOAuthHeader();
  const managementKeyInput = findManagementKeyInput();
  const managementLoginButton = findManagementLoginButton();
  const rememberCheckbox = findRememberPasswordCheckbox();
  const oauthNavLink = findOAuthNavLink();

  return {
    url: location.href,
    readyState: document.readyState,
    title: getInlineTextSnippet(document.title || '', 80),
    authUrlVisible: Boolean(authUrlEl),
    authUrlText: getInlineTextSnippet(authUrlEl?.textContent || '', 120),
    oauthHeaderVisible: Boolean(oauthHeader),
    oauthHeaderText: getInlineTextSnippet(oauthHeader?.textContent || '', 120),
    managementKeyVisible: Boolean(managementKeyInput),
    managementLoginVisible: Boolean(managementLoginButton),
    managementLoginText: getInlineTextSnippet(getActionText(managementLoginButton), 60),
    rememberCheckboxVisible: Boolean(rememberCheckbox),
    rememberCheckboxChecked: Boolean(rememberCheckbox?.checked),
    oauthNavVisible: Boolean(oauthNavLink),
    oauthNavText: getInlineTextSnippet(getActionText(oauthNavLink), 80),
    bodySnippet: getPageTextSnippet(),
  };
}

function getVpsPanelSnapshotSignature(snapshot) {
  return JSON.stringify({
    readyState: snapshot.readyState,
    title: snapshot.title,
    authUrlVisible: snapshot.authUrlVisible,
    authUrlText: snapshot.authUrlText,
    oauthHeaderVisible: snapshot.oauthHeaderVisible,
    oauthHeaderText: snapshot.oauthHeaderText,
    managementKeyVisible: snapshot.managementKeyVisible,
    managementLoginVisible: snapshot.managementLoginVisible,
    rememberCheckboxVisible: snapshot.rememberCheckboxVisible,
    rememberCheckboxChecked: snapshot.rememberCheckboxChecked,
    oauthNavVisible: snapshot.oauthNavVisible,
    oauthNavText: snapshot.oauthNavText,
    bodySnippet: snapshot.bodySnippet,
  });
}

function parseUrlSafely(rawUrl) {
  if (!rawUrl) return null;
  try {
    return new URL(rawUrl);
  } catch {
    return null;
  }
}

function isLocalhostOAuthCallbackUrl(rawUrl) {
  const parsed = parseUrlSafely(rawUrl);
  if (!parsed) return false;
  if (!['http:', 'https:'].includes(parsed.protocol)) return false;
  if (!['localhost', '127.0.0.1'].includes(parsed.hostname)) return false;
  if (!['/auth/callback', '/codex/callback'].includes(parsed.pathname)) return false;

  const code = (parsed.searchParams.get('code') || '').trim();
  const state = (parsed.searchParams.get('state') || '').trim();
  return Boolean(code && state);
}

function getStatusBadgeSelectors() {
  return [
    '#root .OAuthPage-module__cardContent___1sXLA .status-badge',
    '[class*="cardContent"] .status-badge',
    '.status-badge',
  ];
}

function getStatusBadgeEntries() {
  const searchRoot = findCodexOAuthCard() || document;
  const seen = new Set();
  const entries = [];

  for (const selector of getStatusBadgeSelectors()) {
    const candidates = searchRoot.querySelectorAll(selector);
    for (const candidate of candidates) {
      if (seen.has(candidate)) continue;
      seen.add(candidate);
      entries.push(createStep9Entry(candidate, selector));
    }
  }

  return entries;
}

function summarizeStatusBadgeEntries(entries) {
  if (!entries.length) return 'No visible status badge';
  return entries
    .map((entry, index) => {
      const text = entry.text || '(empty text)';
      const className = entry.className ? ` class=${getInlineTextSnippet(entry.className, 80)}` : '';
      const errorVisual = entry.errorVisualSummary ? ` error=${getInlineTextSnippet(entry.errorVisualSummary, 80)}` : '';
      return `#${index + 1}="${getInlineTextSnippet(text, 80)}"${className}${errorVisual}`;
    })
    .join(' | ');
}

const STEP9_SUCCESS_STATUSES = new Set([
  'Authentication successful!',
  'Аутентификация успешна!',
  'Authentication successful!',
]);

function normalizeStep9StatusText(statusText) {
  return String(statusText || '').replace(/\s+/g, ' ').trim();
}

function isOAuthCallbackTimeoutFailure(statusText) {
  return /(?:认证失败\s*[:：]?\s*)?(?:Timeout waiting for OAuth callback|timeout of \d+ms exceeded|OAuth flow timed out)/i.test(statusText || '');
}

function getStep10StatusBadgeLocation(element) {
  if (element?.closest?.('[class*="callbackSection"]')) {
    return 'callback';
  }
  if (element?.closest?.('[class*="cardContent"]')) {
    return 'main';
  }
  return 'page';
}

function isStep10CallbackSubmittedStatus(statusText) {
  const text = normalizeStep9StatusText(statusText);
  return /回调\s*url\s*已提交.*等待认证中/i.test(text)
    || /callback\s*url\s*submitted.*waiting/i.test(text);
}

function isStep10CallbackFailureText(statusText) {
  const text = normalizeStep9StatusText(statusText);
  if (!text) return false;
  return /(?:回调\s*url\s*提交失败|回调url提交失败|提交回调失败)\s*[:：,，]?\s*/i.test(text)
    || /请更新\s*cli\s*proxy\s*api\s*或检查连接/i.test(text);
}

function isStep10MainWaitingStatus(statusText) {
  const text = normalizeStep9StatusText(statusText);
  return /等待认证中/i.test(text);
}

function isStep10MainFailureText(statusText) {
  const text = normalizeStep9StatusText(statusText);
  if (!text) return false;
  if (/^认证失败\s*[:：]?\s*/i.test(text)) return true;
  return /bad request|state code error|failed to exchange authorization code for tokens|failed to save authentication tokens|unknown or expired state|invalid state|state is required|code or error is required|invalid redirect_url|provider does not match state|failed to persist oauth callback|timeout waiting for oauth callback|oauth flow timed out|request failed with status code \d+|timeout of \d+ms exceeded|network error|failed to fetch/i.test(text);
}

function isStep9FailureText(statusText) {
  const text = normalizeStep9StatusText(statusText);
  if (!text) return false;
  if (isOAuthCallbackTimeoutFailure(text)) return true;
  if (isStep10CallbackFailureText(text)) return true;
  if (isStep10MainFailureText(text)) return true;
  if (typeof isRecoverableStep9AuthFailure === 'function' && isRecoverableStep9AuthFailure(text)) {
    return true;
  }
  return /callback\s*url\s*submit\s*failed|oauth flow is not pending/i.test(text);
}

function isStep9SuccessStatus(statusText) {
  const text = normalizeStep9StatusText(statusText);
  if (!text) return false;
  return STEP9_SUCCESS_STATUSES.has(text)
    || /^认证成功[!！]?$/i.test(text)
    || /^Authentication successful!?$/i.test(text)
    || /^Аутентификация успешна!?$/i.test(text);
}

function isStep9SuccessLikeStatus(statusText) {
  const text = normalizeStep9StatusText(statusText);
  return /authentication successful|аутентификац.*успеш|认证成功/i.test(text);
}

function parseCssColorChannels(colorText) {
  const text = String(colorText || '').trim().toLowerCase();
  if (!text || text === 'transparent' || text === 'inherit' || text === 'initial' || text === 'unset') {
    return null;
  }

  if (text.startsWith('#')) {
    const hex = text.slice(1);
    if (hex.length === 3 || hex.length === 4) {
      const expanded = hex.split('').map((part) => part + part);
      const [r, g, b, a = 'ff'] = expanded;
      return {
        r: Number.parseInt(r, 16),
        g: Number.parseInt(g, 16),
        b: Number.parseInt(b, 16),
        a: Number.parseInt(a, 16) / 255,
      };
    }
    if (hex.length === 6 || hex.length === 8) {
      const parts = hex.match(/.{1,2}/g) || [];
      const [r, g, b, a = 'ff'] = parts;
      return {
        r: Number.parseInt(r, 16),
        g: Number.parseInt(g, 16),
        b: Number.parseInt(b, 16),
        a: Number.parseInt(a, 16) / 255,
      };
    }
  }

  if (text.startsWith('rgb')) {
    const numericParts = text.match(/[\d.]+/g) || [];
    if (numericParts.length >= 3) {
      const [r, g, b, a = '1'] = numericParts.map(Number);
      return { r, g, b, a };
    }
  }

  return null;
}

function isReddishColor(colorText) {
  const channels = parseCssColorChannels(colorText);
  if (!channels) return false;
  const { r, g, b, a = 1 } = channels;
  if (a <= 0.05) return false;
  return r >= 120 && r >= g + 35 && r >= b + 35;
}

function getStep9ErrorVisualSignals(element, className = '') {
  const signals = [];
  const normalizedClassName = String(className || '').replace(/\s+/g, ' ').trim();
  if (/(?:error|danger|fail|destructive|text-red|text-danger|alert)/i.test(normalizedClassName)) {
    signals.push(`class=${getInlineTextSnippet(normalizedClassName, 80)}`);
  }

  if (!element) {
    return signals;
  }

  const style = window.getComputedStyle(element);
  if (isReddishColor(style.color)) {
    signals.push(`color=${style.color}`);
  }
  if (isReddishColor(style.borderColor)) {
    signals.push(`border=${style.borderColor}`);
  }
  if (isReddishColor(style.backgroundColor)) {
    signals.push(`background=${style.backgroundColor}`);
  }

  return signals;
}

function createStep9Entry(candidate, selector) {
  const className = String(candidate?.className || '').replace(/\s+/g, ' ').trim();
  const errorVisualSignals = getStep9ErrorVisualSignals(candidate, className);
  return {
    element: candidate,
    selector,
    location: getStep10StatusBadgeLocation(candidate),
    visible: isVisibleElement(candidate),
    text: normalizeStep9StatusText(candidate?.textContent || ''),
    className,
    errorVisualSignals,
    errorVisualSummary: errorVisualSignals.join(', '),
    hasErrorVisualSignal: errorVisualSignals.length > 0,
  };
}

function getStep9PageErrorSelectors() {
  return [
    '[role="alert"]',
    '[aria-live="assertive"]',
    '[aria-live="polite"]',
    '.alert',
    '[class*="alert"]',
    '[class*="error"]',
    '[class*="danger"]',
    '.text-danger',
    '.text-red',
  ];
}

function getStep9PageErrorEntries() {
  const cardRoot = findCodexOAuthCard();
  const searchRoots = [cardRoot, document].filter(Boolean);
  const seen = new Set();
  const entries = [];

  for (const root of searchRoots) {
    for (const selector of getStep9PageErrorSelectors()) {
      const candidates = root.querySelectorAll(selector);
      for (const candidate of candidates) {
        if (seen.has(candidate)) continue;
        seen.add(candidate);
        if (!isVisibleElement(candidate)) continue;

        const entry = createStep9Entry(candidate, selector);
        if (/\bstatus-badge\b/i.test(entry.className)) continue;
        if (!isStep9FailureText(entry.text)) continue;
        entries.push(entry);
      }
    }
  }

  return entries;
}

function formatStep10StatusSummaryValue(text, emptyText = 'None') {
  return text ? `"${getInlineTextSnippet(text, 80)}"` : emptyText;
}

function isStep10BrowserSwitchRequiredConflict(diagnostics = {}) {
  return Boolean(diagnostics?.hasExactSuccessVisibleBadge)
    && /请更新\s*cli\s*proxy\s*api\s*或检查连接/i.test(String(diagnostics?.callbackFailureText || ''));
}

function getStep10BrowserSwitchRequiredMessage(diagnostics = {}) {
  const callbackFailureText = normalizeStep9StatusText(diagnostics?.callbackFailureText || '');
  return [
    'Detected that the CPA page is showing both "Authentication successful" and "Callback URL submission failed: Please update CLI Proxy API or check the connection".',
    'This is usually not a browser issue. CPA clears multi-threaded OAuth sessions, so CPA cannot use multi-threaded OAuth. Update the CPA server or switch to single-threaded registration.',
    callbackFailureText ? `Panel text: ${callbackFailureText}` : '',
  ].filter(Boolean).join(' ');
}

function buildStep9StatusDiagnostics(entries = [], pageErrorEntries = [], pageSnippet = '') {
  const visibleEntries = entries.filter((entry) => entry.visible);
  const callbackEntries = visibleEntries.filter((entry) => entry.location === 'callback');
  const mainEntries = visibleEntries.filter((entry) => entry.location === 'main');
  const successLikeEntries = mainEntries.filter((entry) => isStep9SuccessLikeStatus(entry.text));
  const exactSuccessEntries = mainEntries.filter((entry) => isStep9SuccessStatus(entry.text) && !entry.hasErrorVisualSignal);
  const callbackSubmittedEntries = callbackEntries.filter((entry) => isStep10CallbackSubmittedStatus(entry.text) && !entry.hasErrorVisualSignal);
  const callbackFailureEntries = callbackEntries.filter((entry) => isStep10CallbackFailureText(entry.text));
  const mainWaitingEntries = mainEntries.filter((entry) => isStep10MainWaitingStatus(entry.text) && !entry.hasErrorVisualSignal);
  const mainFailureEntries = mainEntries.filter((entry) => isStep10MainFailureText(entry.text));
  const failureEntries = [...callbackFailureEntries, ...mainFailureEntries];
  const errorStyledEntries = visibleEntries.filter((entry) => entry.hasErrorVisualSignal);
  const allFailureEntries = [...failureEntries, ...pageErrorEntries];
  const decisiveFailureEntry = allFailureEntries[0] || null;
  const selectedEntry = decisiveFailureEntry
    || exactSuccessEntries[0]
    || callbackSubmittedEntries[0]
    || mainWaitingEntries[0]
    || visibleEntries[0]
    || null;
  const selectedText = selectedEntry?.text || '';
  const visibleSummary = summarizeStatusBadgeEntries(visibleEntries);
  const callbackSummary = summarizeStatusBadgeEntries(callbackEntries);
  const mainSummary = summarizeStatusBadgeEntries(mainEntries);
  const successLikeSummary = summarizeStatusBadgeEntries(successLikeEntries);
  const exactSuccessSummary = summarizeStatusBadgeEntries(exactSuccessEntries);
  const failureSummary = summarizeStatusBadgeEntries(failureEntries);
  const pageErrorSummary = summarizeStatusBadgeEntries(pageErrorEntries);
  const errorStyledSummary = summarizeStatusBadgeEntries(errorStyledEntries);
  const extraFailureSuffix = pageErrorEntries.length ? `；Additional error hint: ${pageErrorSummary}` : '';
  const errorStyledSuffix = errorStyledEntries.length ? `；Red/error-styled badge: ${errorStyledSummary}` : '';

  return {
    selectedText,
    exactSuccessText: exactSuccessEntries[0]?.text || '',
    failureText: decisiveFailureEntry?.text || '',
    failureSource: decisiveFailureEntry?.location || (pageErrorEntries.length ? 'page' : ''),
    visibleCount: visibleEntries.length,
    visibleSummary,
    callbackSummary,
    mainSummary,
    callbackStatusText: callbackEntries[0]?.text || '',
    callbackSubmittedText: callbackSubmittedEntries[0]?.text || '',
    callbackFailureText: callbackFailureEntries[0]?.text || '',
    mainStatusText: mainEntries[0]?.text || '',
    mainWaitingText: mainWaitingEntries[0]?.text || '',
    mainFailureText: mainFailureEntries[0]?.text || '',
    hasSuccessLikeVisibleBadge: successLikeEntries.length > 0,
    hasExactSuccessVisibleBadge: exactSuccessEntries.length > 0,
    hasCallbackSubmittedBadge: callbackSubmittedEntries.length > 0,
    hasFailureVisibleBadge: allFailureEntries.length > 0,
    hasErrorStyledVisibleBadge: errorStyledEntries.length > 0,
    successLikeSummary,
    exactSuccessSummary,
    failureSummary,
    pageErrorSummary,
    errorStyledSummary,
    pageSnippet,
    signature: JSON.stringify({
      selectedText,
      visibleCount: visibleEntries.length,
      visibleSummary,
      callbackSummary,
      mainSummary,
      successLikeSummary,
      exactSuccessSummary,
      failureSummary,
      pageErrorSummary,
      errorStyledSummary,
    }),
    summary: selectedText
      ? `Current focused state=${formatStep10StatusSummaryValue(selectedText)}；callback hint=${formatStep10StatusSummaryValue(callbackEntries[0]?.text || '')}；main state=${formatStep10StatusSummaryValue(mainEntries[0]?.text || '')}；page error=${formatStep10StatusSummaryValue(pageErrorEntries[0]?.text || '')}；visible badges: ${visibleEntries.length} | ${visibleSummary}${extraFailureSuffix}${errorStyledSuffix}`
      : `No visible status is currently selected; callback hint=${formatStep10StatusSummaryValue(callbackEntries[0]?.text || '')}；main state=${formatStep10StatusSummaryValue(mainEntries[0]?.text || '')}；page error=${formatStep10StatusSummaryValue(pageErrorEntries[0]?.text || '')}；visible badges: ${visibleEntries.length} | ${visibleSummary}${extraFailureSuffix}${errorStyledSuffix}；page snippet="${getInlineTextSnippet(pageSnippet, 120)}"`,
  };
}

function getStatusBadgeDiagnostics() {
  return buildStep9StatusDiagnostics(
    getStatusBadgeEntries(),
    getStep9PageErrorEntries(),
    getPageTextSnippet()
  );
}

function getStatusBadgeElement() {
  const visibleEntry = getStatusBadgeEntries().find((entry) => entry.visible);
  return visibleEntry ? visibleEntry.element : null;
}

function getStatusBadgeText() {
  const diagnostics = getStatusBadgeDiagnostics();
  return diagnostics.selectedText;
}

function extractStep10FailureDetail(statusText, sourceKind = '') {
  const text = normalizeStep9StatusText(statusText);
  if (!text) return '';
  if (sourceKind === 'callback' || isStep10CallbackFailureText(text)) {
    return text.replace(/^(?:回调\s*url\s*提交失败|回调url提交失败|提交回调失败)\s*[:：,，]?\s*/i, '').trim();
  }
  if (sourceKind === 'main' || isStep10MainFailureText(text)) {
    return text.replace(/^认证失败\s*[:：]?\s*/i, '').trim();
  }
  return text;
}

function explainStep10Failure(statusText, sourceKind = 'unknown') {
  const rawText = normalizeStep9StatusText(statusText);
  const detail = extractStep10FailureDetail(rawText, sourceKind) || rawText;
  const phaseLabel = sourceKind === 'callback'
    ? 'Callback submission stage'
    : sourceKind === 'main'
      ? 'Authentication result stage'
      : 'Page state stage';

  const rules = [
    {
      code: 'callback_submit_api_unavailable',
      pattern: /请更新\s*cli\s*proxy\s*api\s*或检查连接/i,
      message: 'The CPA panel cannot submit the callback to the backend. Usually the CLI Proxy API is outdated, the admin interface is not running, or the panel connection to the backend is broken.',
    },
    {
      code: 'oauth_state_expired',
      pattern: /unknown or expired state/i,
      message: 'The current OAuth session no longer exists or has expired in CPA. Usually this means an old callback link was used, an old link was submitted after refreshing a new auth link, or CPA just restarted.',
    },
    {
      code: 'oauth_not_pending',
      pattern: /oauth flow is not pending/i,
      message: 'The current OAuth session is no longer in a waiting state. Usually this means the callback was submitted repeatedly, submitted too slowly, or this authentication round already ended.',
    },
    {
      code: 'callback_state_invalid',
      pattern: /invalid state|state is required|missing_state/i,
      message: 'The callback link state is missing or invalid. Usually this means an incomplete localhost callback link was copied, or an old link from another round was submitted.',
    },
    {
      code: 'callback_missing_result',
      pattern: /code or error is required/i,
      message: 'The callback link contains neither an authorization code nor an error message. Usually the copied localhost callback link was incomplete.',
    },
    {
      code: 'callback_invalid_url',
      pattern: /invalid redirect_url/i,
      message: 'The callback URL submitted to CPA cannot be parsed. Usually the pasted content is incomplete, contains extra characters, or is not a localhost OAuth callback URL.',
    },
    {
      code: 'callback_provider_mismatch',
      pattern: /provider does not match state/i,
      message: 'This callback does not belong to the current Codex OAuth round. The session and callback source do not match, usually because callbacks from other rounds or providers were mixed in.',
    },
    {
      code: 'callback_persist_failed',
      pattern: /failed to persist oauth callback/i,
      message: 'CPA received the callback, but cannot write the callback result to the local cache file. Usually this is caused by auth directory permissions, disk issues, or an environment problem.',
    },
    {
      code: 'oauth_bad_request',
      pattern: /^bad request$/i,
      message: 'CPA received the callback, but the OpenAI OAuth callback itself returned an error. Common causes are user-canceled authorization, expired requests, or an already-invalid callback.',
    },
    {
      code: 'oauth_state_mismatch',
      pattern: /state code error/i,
      message: 'CPA detected that the state in the callback does not match the current OAuth session. Usually the auth link was refreshed, but platform callback verification still submitted the old callback.',
    },
    {
      code: 'oauth_code_exchange_failed',
      pattern: /failed to exchange authorization code for tokens/i,
      message: 'CPA received the authorization code, but failed to exchange it with OpenAI for tokens. Common causes are CPA-to-OpenAI network or proxy issues, or an expired authorization code.',
    },
    {
      code: 'oauth_token_save_failed',
      pattern: /failed to save authentication tokens/i,
      message: 'CPA completed authentication, but saving the auth file failed. Common causes are auth directory permissions, disk writes, or a post-auth hook issue.',
    },
    {
      code: 'oauth_callback_timeout',
      pattern: /timeout waiting for oauth callback|oauth flow timed out/i,
      message: 'CPA did not finish this OAuth flow for too long. Common causes are submitting too late, panel polling issues, or backend state not refreshing in time.',
    },
    {
      code: 'oauth_http_timeout',
      pattern: /timeout of \d+ms exceeded/i,
      message: 'CPA panel timed out while requesting the backend API. Usually the CLI Proxy API responded too slowly, the API was not started, or the network connection was unstable.',
    },
    {
      code: 'oauth_http_status_error',
      pattern: /request failed with status code \d+/i,
      message: 'CPA panel received an abnormal HTTP status code while requesting the backend API. Usually the API is abnormal, reverse-proxy configuration is wrong, or the current session is invalid.',
    },
    {
      code: 'oauth_network_error',
      pattern: /network error|failed to fetch/i,
      message: 'CPA panel failed to communicate with the backend. Usually the network is unreachable, the admin API is not started, or the current browser connection was lost.',
    },
  ];

  const matchedRule = rules.find((rule) => rule.pattern.test(detail) || rule.pattern.test(rawText));
  const message = matchedRule
    ? matchedRule.message
    : `CPA returned an uncategorized failure during ${phaseLabel}. Use the panel text for further investigation.`;

  return {
    code: matchedRule?.code || 'oauth_unknown_failure',
    phaseLabel,
    rawText,
    detail,
    userMessage: `CPA returned a failure during ${phaseLabel}: ${message}. Panel text: ${rawText}`,
  };
}

async function waitForExactSuccessBadge(timeout = STEP9_SUCCESS_BADGE_TIMEOUT_MS, visibleStep = 10) {
  const start = Date.now();
  let lastDiagnosticsSignature = '';
  let lastHeartbeatLoggedAt = 0;
  let lastCallbackSubmittedSignature = '';
  let lastSuccessFailureConflictSignature = '';

  while (Date.now() - start < timeout) {
    throwIfStopped();
    const diagnostics = getStatusBadgeDiagnostics();
    const elapsed = Date.now() - start;

    if (diagnostics.signature !== lastDiagnosticsSignature) {
      lastDiagnosticsSignature = diagnostics.signature;
      lastHeartbeatLoggedAt = elapsed;
      log(`Checking authentication status, ${diagnostics.summary}`, 'info', { step: visibleStep, stepKey: 'platform-verify' });
      console.log(LOG_PREFIX, '[Step 9] status badge diagnostics changed', diagnostics);
    } else if (elapsed - lastHeartbeatLoggedAt >= 10000) {
      lastHeartbeatLoggedAt = elapsed;
      log(`Still waiting for authentication success, ${diagnostics.summary}`, 'info', { step: visibleStep, stepKey: 'platform-verify' });
      console.log(LOG_PREFIX, '[Step 9] still waiting for success badge', diagnostics);
    }

    if (diagnostics.hasCallbackSubmittedBadge && !diagnostics.hasExactSuccessVisibleBadge) {
      const callbackSubmittedSignature = JSON.stringify({
        callbackStatusText: diagnostics.callbackStatusText,
        mainStatusText: diagnostics.mainStatusText,
      });
      if (callbackSubmittedSignature !== lastCallbackSubmittedSignature) {
        lastCallbackSubmittedSignature = callbackSubmittedSignature;
        log(
          `CPA accepted the localhost callback. Waiting for the backend to finish authentication.callback hint=${formatStep10StatusSummaryValue(diagnostics.callbackStatusText)}；main state=${formatStep10StatusSummaryValue(diagnostics.mainStatusText)}`,
          'info',
          { step: visibleStep, stepKey: 'platform-verify' }
        );
        console.info(LOG_PREFIX, '[Step 9] callback accepted and waiting for auth completion', diagnostics);
      }
    }

    if (isStep10BrowserSwitchRequiredConflict(diagnostics)) {
      const browserSwitchMessage = getStep10BrowserSwitchRequiredMessage(diagnostics);
      log(browserSwitchMessage, 'error', { step: visibleStep, stepKey: 'platform-verify' });
      console.error(LOG_PREFIX, '[Step 9] browser-switch conflict detected', diagnostics);
      throw new Error(`BROWSER_SWITCH_REQUIRED::${browserSwitchMessage}`);
    }

    if (diagnostics.hasExactSuccessVisibleBadge && diagnostics.hasFailureVisibleBadge) {
      const conflictSignature = JSON.stringify({
        exactSuccessSummary: diagnostics.exactSuccessSummary,
        failureSummary: diagnostics.failureSummary,
        pageErrorSummary: diagnostics.pageErrorSummary,
      });
      if (conflictSignature !== lastSuccessFailureConflictSignature) {
        lastSuccessFailureConflictSignature = conflictSignature;
        const failureSummary = diagnostics.pageErrorSummary !== 'No visible status badge'
          ? diagnostics.pageErrorSummary
          : diagnostics.failureSummary;
        log(
          `Detected both a success badge and a failure hint. This round will not be treated as successful. Success badge: ${diagnostics.exactSuccessSummary}; failure hint: ${failureSummary}`,
          'warn',
          { step: visibleStep, stepKey: 'platform-verify' }
        );
        console.warn(LOG_PREFIX, '[Step 9] success badge is blocked by visible failure', diagnostics);
      }
    }

    if (diagnostics.failureText) {
      const failureExplanation = explainStep10Failure(diagnostics.failureText, diagnostics.failureSource || 'unknown');
      if (isOAuthCallbackTimeoutFailure(diagnostics.failureText)) {
        throw new Error(`STEP9_OAUTH_TIMEOUT::${failureExplanation.userMessage}`);
      }
      throw new Error(`STEP9_OAUTH_RETRY::${failureExplanation.userMessage}`);
    }
    if (diagnostics.exactSuccessText) {
      return diagnostics.exactSuccessText;
    }
    await sleep(200);
  }

  const finalDiagnostics = getStatusBadgeDiagnostics();
  const finalText = finalDiagnostics.failureText || finalDiagnostics.selectedText;
  const diagnosticsSuffix = ` Current diagnostics: ${finalDiagnostics.summary}`;
  if (isOAuthCallbackTimeoutFailure(finalText)) {
    const failureExplanation = explainStep10Failure(finalText, finalDiagnostics.failureSource || 'main');
    throw new Error(`STEP9_OAUTH_TIMEOUT::${failureExplanation.userMessage}${diagnosticsSuffix}`);
  }
  if (isStep9FailureText(finalText)) {
    const failureExplanation = explainStep10Failure(finalText, finalDiagnostics.failureSource || 'unknown');
    throw new Error(`STEP9_OAUTH_RETRY::${failureExplanation.userMessage}${diagnosticsSuffix}`);
  }
  if (finalDiagnostics.hasCallbackSubmittedBadge || finalDiagnostics.mainWaitingText) {
    throw new Error(
      'STEP9_OAUTH_TIMEOUT::CPA accepted the callback, but the page still did not enter the authentication-success state within 120 seconds. Usually CPA backend processing is too slow, panel polling is abnormal, or CPA-to-OpenAI network/proxy has an issue.'
      + diagnosticsSuffix
    );
  }
  throw new Error(finalText
    ? `CPA panel state did not enter a success state. Current state: "${finalText}."${diagnosticsSuffix}`
    : `CPA panel did not show a success-state badge for a long time.${diagnosticsSuffix}`);
}

function findManagementKeyInput() {
  const candidates = document.querySelectorAll(
    '.LoginPage-module__loginCard___OgP-R input[type="password"], input[placeholder*="admin key"], input[aria-label*="admin key"]'
  );
  return Array.from(candidates).find(isVisibleElement) || null;
}

function findManagementLoginButton() {
  const candidates = document.querySelectorAll('.LoginPage-module__loginCard___OgP-R button, .LoginPage-module__loginCard___OgP-R .btn');
  return Array.from(candidates).find((el) => {
    if (!isVisibleElement(el)) return false;
    return /登录|login/i.test(getActionText(el));
  }) || null;
}

function findRememberPasswordCheckbox() {
  const candidates = document.querySelectorAll('.LoginPage-module__loginCard___OgP-R input[type="checkbox"]');
  return Array.from(candidates).find((el) => {
    const label = el.closest('label');
    const text = getActionText(label || el);
    return /记住密码|remember/i.test(text);
  }) || null;
}

function findOAuthNavLink() {
  const candidates = document.querySelectorAll('a[href*="#/oauth"], a.nav-item, button, [role="link"], [role="button"]');
  return Array.from(candidates).find((el) => {
    if (!isVisibleElement(el)) return false;
    const text = getActionText(el);
    const href = el.getAttribute('href') || '';
    return href.includes('#/oauth') || /oauth/i.test(text);
  }) || null;
}

function findCodexOAuthHeader() {
  const candidates = document.querySelectorAll('.card-header, [class*="cardHeader"], .card, [class*="card"]');
  return Array.from(candidates).find((el) => {
    if (!isVisibleElement(el)) return false;
    const text = (el.textContent || '').toLowerCase();
    return text.includes('codex') && text.includes('oauth');
  }) || null;
}

function findCodexOAuthCard() {
  const header = findCodexOAuthHeader();
  return header?.closest('.card, [class*="card"]') || header || null;
}

function findOAuthCardLoginButton(header) {
  const card = header?.closest('.card, [class*="card"]') || header?.parentElement || document;
  const candidates = card.querySelectorAll('button.btn.btn-primary, button.btn-primary, button.btn');
  return Array.from(candidates).find((el) => isVisibleElement(el) && /登录|login/i.test(getActionText(el))) || null;
}

function findAuthUrlElement() {
  const candidates = document.querySelectorAll('[class*="authUrlValue"], .OAuthPage-module__authUrlValue___axvUJ');
  return Array.from(candidates).find((el) => isVisibleElement(el) && /^https?:\/\//i.test((el.textContent || '').trim())) || null;
}

async function ensureOAuthManagementPage(vpsPassword, step = 1, timeout = 45000) {
  const start = Date.now();
  let lastLoginAttemptAt = 0;
  let lastOauthNavAttemptAt = 0;
  let lastSnapshotSignature = '';
  let lastSnapshotLogAt = 0;

  console.log(LOG_PREFIX, `[Step ${step}] ensureOAuthManagementPage start`, {
    timeout,
    url: location.href,
    hasVpsPassword: Boolean(vpsPassword),
    snapshot: getVpsPanelSnapshot(),
  });

  while (Date.now() - start < timeout) {
    throwIfStopped();
    const elapsed = Date.now() - start;
    const snapshot = getVpsPanelSnapshot();
    const signature = getVpsPanelSnapshotSignature(snapshot);
    if (signature !== lastSnapshotSignature || elapsed - lastSnapshotLogAt >= 5000) {
      lastSnapshotSignature = signature;
      lastSnapshotLogAt = elapsed;
      console.log(LOG_PREFIX, `[Step ${step}] panel snapshot at ${elapsed}ms`, snapshot);
    }

    const authUrlEl = findAuthUrlElement();
    if (authUrlEl) {
      console.log(LOG_PREFIX, `[Step ${step}] found visible auth URL after ${elapsed}ms`, {
        url: location.href,
        authUrlText: getInlineTextSnippet(authUrlEl.textContent || '', 120),
      });
      return { header: findCodexOAuthHeader(), authUrlEl };
    }

    const oauthHeader = findCodexOAuthHeader();
    if (oauthHeader) {
      console.log(LOG_PREFIX, `[Step ${step}] found OAuth card header after ${elapsed}ms`, {
        url: location.href,
        headerText: getInlineTextSnippet(oauthHeader.textContent || '', 120),
      });
      return { header: oauthHeader, authUrlEl: null };
    }

    const managementKeyInput = findManagementKeyInput();
    const managementLoginButton = findManagementLoginButton();
    if (managementKeyInput && managementLoginButton) {
      if (!vpsPassword) {
        throw new Error('The CPA panel requires an admin key. Please fill in the CPA key in the side panel first.');
      }

      if ((managementKeyInput.value || '') !== vpsPassword) {
        await humanPause(350, 900);
        fillInput(managementKeyInput, vpsPassword);
        console.log(LOG_PREFIX, `[Step ${step}] filled management key after ${elapsed}ms`);
        log(`Step ${step}：CPA admin key filled.`);
      }

      const rememberCheckbox = findRememberPasswordCheckbox();
      if (rememberCheckbox && !rememberCheckbox.checked) {
        simulateClick(rememberCheckbox);
        console.log(LOG_PREFIX, `[Step ${step}] toggled remember checkbox after ${elapsed}ms`);
        log(`Step ${step}：Checked "Remember password" in the CPA panel.`);
        await sleep(300);
      }

      if (Date.now() - lastLoginAttemptAt > 3000) {
        lastLoginAttemptAt = Date.now();
        await humanPause(350, 900);
        simulateClick(managementLoginButton);
        console.log(LOG_PREFIX, `[Step ${step}] clicked management login after ${elapsed}ms`, {
          buttonText: getInlineTextSnippet(getActionText(managementLoginButton), 80),
        });
        log(`Step ${step}：Submitted CPA admin login.`);
      }

      await sleep(1500);
      continue;
    }

    const oauthNavLink = findOAuthNavLink();
    if (oauthNavLink && Date.now() - lastOauthNavAttemptAt > 2000) {
      lastOauthNavAttemptAt = Date.now();
      await humanPause(300, 800);
      simulateClick(oauthNavLink);
      console.log(LOG_PREFIX, `[Step ${step}] clicked OAuth nav after ${elapsed}ms`, {
        navText: getInlineTextSnippet(getActionText(oauthNavLink), 80),
      });
      log(`Step ${step}：Opened the "OAuth login" navigation.`);
      await sleep(1200);
      continue;
    }

    await sleep(250);
  }

  console.error(LOG_PREFIX, `[Step ${step}] ensureOAuthManagementPage timeout after ${Date.now() - start}ms`, {
    url: location.href,
    snapshot: getVpsPanelSnapshot(),
  });

  throw new Error('Cannot enter the CPA OAuth admin page. Check whether the panel loaded correctly. URL: ' + location.href);
}

async function requestOAuthUrl(payload = {}) {
  return step1_getOAuthLink(payload, { report: false });
}

// ============================================================
// Step 1: Get OAuth Link
// ============================================================

async function step1_getOAuthLink(payload, options = {}) {
  const { report = true } = options;
  const { vpsPassword } = payload || {};
  const logStep = Number.isInteger(payload?.logStep) ? payload.logStep : 1;
  console.log(LOG_PREFIX, '[Step 1] step1_getOAuthLink start', {
    url: location.href,
    hasVpsPassword: Boolean(vpsPassword),
    snapshot: getVpsPanelSnapshot(),
  });

  log(`Step ${logStep}：Waiting for the CPA panel to load and enter the OAuth page...`);

  const { header, authUrlEl: existingAuthUrlEl } = await ensureOAuthManagementPage(vpsPassword, logStep);
  let authUrlEl = existingAuthUrlEl;
  console.log(LOG_PREFIX, '[Step 1] ensureOAuthManagementPage resolved', {
    url: location.href,
    hasHeader: Boolean(header),
    hasExistingAuthUrl: Boolean(existingAuthUrlEl),
    snapshot: getVpsPanelSnapshot(),
  });

  if (!authUrlEl) {
    const loginBtn = findOAuthCardLoginButton(header);
    if (!loginBtn) {
      throw new Error('Found the Codex OAuth card, but there is no login button inside it. URL: ' + location.href);
    }

    if (loginBtn.disabled) {
      console.log(LOG_PREFIX, '[Step 1] OAuth login button is disabled, waiting for auth URL', {
        url: location.href,
        buttonText: getInlineTextSnippet(getActionText(loginBtn), 80),
      });
      log(`Step ${logStep}：OAuth login button is currently unavailable. Waiting for the authorization link to appear...`);
    } else {
      await humanPause(500, 1400);
      simulateClick(loginBtn);
      console.log(LOG_PREFIX, '[Step 1] clicked OAuth login button and waiting for auth URL', {
        url: location.href,
        buttonText: getInlineTextSnippet(getActionText(loginBtn), 80),
      });
      log(`Step ${logStep}：Clicked the OAuth login button. Waiting for the authorization link...`);
    }

    try {
      authUrlEl = await waitForElement('[class*="authUrlValue"]', 15000);
    } catch {
      throw new Error(
        'No authorization link appeared after clicking the OAuth login button.' +
        'Check whether the CPA panel service is running. URL: ' + location.href
      );
    }
  } else {
    log(`Step ${logStep}：Authorization link is already shown on the CPA panel.`);
  }

  const oauthUrl = (authUrlEl.textContent || '').trim();
  if (!oauthUrl || !oauthUrl.startsWith('http')) {
    throw new Error(`Received an invalid OAuth URL: "${oauthUrl.slice(0, 50)}". It should start with http.`);
  }

  log(`Step ${logStep}：Obtained OAuth URL: ${oauthUrl.slice(0, 80)}...`, 'ok');
  console.log(LOG_PREFIX, '[Step 1] reporting completion with oauthUrl', {
    url: location.href,
    oauthUrlPreview: oauthUrl.slice(0, 120),
  });
  if (report) {
    reportComplete(1, { oauthUrl });
  }
  return { oauthUrl };
}

// ============================================================
// Step 10: CPA callback verification - fill in the localhost callback URL and submit it
// ============================================================

async function step9_vpsVerify(payload) {
  const visibleStep = Number(payload?.visibleStep) || 10;
  const confirmStep = visibleStep >= 13 ? 12 : 9;
  await ensureOAuthManagementPage(payload?.vpsPassword, confirmStep);

  // Prefer localhostUrl from the payload; fall back to global state if needed.
  let localhostUrl = payload?.localhostUrl;
  if (localhostUrl && !isLocalhostOAuthCallbackUrl(localhostUrl)) {
    throw new Error(`Step ${visibleStep} only accepts a real localhost OAuth callback URL. Please rerun Step ${confirmStep}.`);
  }
  if (!localhostUrl) {
    log('payload does not contain localhostUrl. Reading it from state...', 'info', { step: visibleStep, stepKey: 'platform-verify' });
    const state = await chrome.runtime.sendMessage({ type: 'GET_STATE' });
    localhostUrl = state.localhostUrl;
    if (localhostUrl && !isLocalhostOAuthCallbackUrl(localhostUrl)) {
      throw new Error(`Step ${visibleStep} only accepts a real localhost OAuth callback URL. Please rerun Step ${confirmStep}.`);
    }
  }
  if (!localhostUrl) {
    throw new Error(`No localhost callback URL was found. Please complete Step ${confirmStep} first.`);
  }
  log(`Obtained localhostUrl: ${localhostUrl.slice(0, 60)}...`, 'info', { step: visibleStep, stepKey: 'platform-verify' });

  log('Looking for the callback URL input...', 'info', { step: visibleStep, stepKey: 'platform-verify' });

  // Find the callback URL input.
  // Actual DOM: <input class="input" placeholder="http://localhost:1455/auth/callback?code=...&state=...">
  let urlInput = null;
  try {
    urlInput = await waitForElement('[class*="callbackSection"] input.input', 10000);
  } catch {
    try {
      urlInput = await waitForElement('input[placeholder*="localhost"]', 5000);
    } catch {
      throw new Error('Could not find the callback URL input in the CPA panel. URL: ' + location.href);
    }
  }

  await humanPause(600, 1500);
  fillInput(urlInput, localhostUrl);
  log(`Filled callback URL: ${localhostUrl.slice(0, 80)}...`, 'info', { step: visibleStep, stepKey: 'platform-verify' });

  // Find and click the callback submit button in supported UI languages.
  const callbackSubmitPattern = /提交回调\s*URL|Submit\s+Callback\s+URL|Отправить\s+Callback\s+URL/i;
  let submitBtn = null;
  try {
    submitBtn = await waitForElementByText(
      '[class*="callbackActions"] button, [class*="callbackSection"] button',
      callbackSubmitPattern,
      5000
    );
  } catch {
    try {
      submitBtn = await waitForElementByText('button.btn', callbackSubmitPattern, 5000);
    } catch {
      throw new Error('Could not find the callback submit button (Submit Callback URL / Отправить Callback URL). URL: ' + location.href);
    }
  }

  await humanPause(450, 1200);
  simulateClick(submitBtn);
  log('Clicked the callback submit button. Waiting for the authentication result...', 'info', { step: visibleStep, stepKey: 'platform-verify' });

  const verifiedStatus = await waitForExactSuccessBadge(STEP9_SUCCESS_BADGE_TIMEOUT_MS, visibleStep);
  log(verifiedStatus, 'ok', { step: visibleStep, stepKey: 'platform-verify' });
  reportComplete('platform-verify', { localhostUrl, verifiedStatus, visibleStep });
}
