(function attachBackgroundNavigationUtils(root, factory) {
  root.MultiPageBackgroundNavigationUtils = factory();
})(typeof self !== 'undefined' ? self : globalThis, function createBackgroundNavigationUtilsModule() {
  function createNavigationUtils(deps = {}) {
    const {
      DEFAULT_CODEX2API_URL,
      DEFAULT_SUB2API_URL,
      normalizeLocalCpaStep9Mode,
      sourceRegistry = null,
    } = deps;

    function parseUrlSafely(rawUrl) {
      if (!rawUrl) return null;
      try {
        return new URL(rawUrl);
      } catch {
        return null;
      }
    }

    function normalizeSub2ApiUrl(rawUrl) {
      const input = (rawUrl || '').trim() || DEFAULT_SUB2API_URL;
      if (!input) return '';
      const withProtocol = /^https?:\/\//i.test(input) ? input : `https://${input}`;
      const parsed = new URL(withProtocol);
      if (!parsed.pathname || parsed.pathname === '/') {
        parsed.pathname = '/admin/accounts';
      }
      parsed.hash = '';
      return parsed.toString();
    }

    function normalizeCodex2ApiUrl(rawUrl) {
      const input = (rawUrl || '').trim() || DEFAULT_CODEX2API_URL;
      const withProtocol = /^https?:\/\//i.test(input) ? input : `http://${input}`;
      const parsed = new URL(withProtocol);
      if (!parsed.pathname || parsed.pathname === '/' || parsed.pathname === '/admin') {
        parsed.pathname = '/admin/accounts';
      }
      parsed.hash = '';
      return parsed.toString();
    }

    function getPanelMode(state = {}) {
      if (state.panelMode === 'sub2api') {
        return 'sub2api';
      }
      if (state.panelMode === 'codex2api') {
        return 'codex2api';
      }
      return 'cpa';
    }

    function getPanelModeLabel(modeOrState) {
      const mode = typeof modeOrState === 'string' ? modeOrState : getPanelMode(modeOrState);
      if (mode === 'sub2api') {
        return 'SUB2API';
      }
      if (mode === 'codex2api') {
        return 'Codex2API';
      }
      return 'CPA';
    }

    function isSignupPageHost(hostname = '') {
      return ['auth0.openai.com', 'auth.openai.com', 'accounts.openai.com'].includes(hostname);
    }

    function isSignupEntryHost(hostname = '') {
      return ['chatgpt.com', 'www.chatgpt.com', 'chat.openai.com'].includes(hostname);
    }

    function isSignupPasswordPageUrl(rawUrl) {
      const parsed = parseUrlSafely(rawUrl);
      if (!parsed) return false;
      return isSignupPageHost(parsed.hostname)
        && /\/(?:create-account|log-in)\/password(?:[/?#]|$)/i.test(parsed.pathname || '');
    }

    function isSignupEmailVerificationPageUrl(rawUrl) {
      const parsed = parseUrlSafely(rawUrl);
      if (!parsed) return false;
      return isSignupPageHost(parsed.hostname)
        && /\/email-verification(?:[/?#]|$)/i.test(parsed.pathname || '');
    }

    function is163MailHost(hostname = '') {
      return hostname === 'mail.163.com'
        || hostname.endsWith('.mail.163.com')
        || hostname === 'mail.126.com'
        || hostname.endsWith('.mail.126.com')
        || hostname === 'webmail.vip.163.com';
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

    function isLocalCpaUrl(rawUrl) {
      const parsed = parseUrlSafely(rawUrl);
      if (!parsed) return false;
      if (!['http:', 'https:'].includes(parsed.protocol)) return false;
      return ['localhost', '127.0.0.1'].includes(parsed.hostname);
    }

    function shouldBypassStep9ForLocalCpa(state) {
      return normalizeLocalCpaStep9Mode(state?.localCpaStep9Mode) === 'bypass'
        && Boolean(state?.localhostUrl)
        && isLocalCpaUrl(state?.vpsUrl);
    }

    function matchesSourceUrlFamily(source, candidateUrl, referenceUrl) {
      if (sourceRegistry?.matchesSourceUrlFamily) {
        return sourceRegistry.matchesSourceUrlFamily(source, candidateUrl, referenceUrl);
      }
      const candidate = parseUrlSafely(candidateUrl);
      if (!candidate) return false;

      const reference = parseUrlSafely(referenceUrl);

      switch (source) {
        case 'openai-auth':
        case 'signup-page':
          return isSignupPageHost(candidate.hostname) || isSignupEntryHost(candidate.hostname);
        case 'duck-mail':
          return candidate.hostname === 'duckduckgo.com' && candidate.pathname.startsWith('/email/');
        case 'qq-mail':
          return candidate.hostname === 'mail.qq.com' || candidate.hostname === 'wx.mail.qq.com';
        case 'mail-163':
          return is163MailHost(candidate.hostname);
        case 'gmail-mail':
          return candidate.hostname === 'mail.google.com';
        case 'yahoo-mail':
          return candidate.hostname === 'mail.yahoo.com';
        case 'icloud-mail':
          return candidate.hostname === 'www.icloud.com'
            || candidate.hostname === 'www.icloud.com.cn';
        case 'inbucket-mail':
          return Boolean(reference)
            && candidate.origin === reference.origin
            && candidate.pathname.startsWith('/m/');
        case 'mail-2925':
          return candidate.hostname === '2925.com' || candidate.hostname === 'www.2925.com';
        case 'vps-panel':
          return Boolean(reference)
            && candidate.origin === reference.origin
            && candidate.pathname === reference.pathname;
        case 'sub2api-panel':
          return Boolean(reference)
            && candidate.origin === reference.origin
            && (
              candidate.pathname.startsWith('/admin/accounts')
              || candidate.pathname.startsWith('/login')
              || candidate.pathname === '/'
            );
        case 'codex2api-panel':
          return Boolean(reference)
            && candidate.origin === reference.origin
            && (
              candidate.pathname.startsWith('/admin/accounts')
              || candidate.pathname === '/admin'
              || candidate.pathname === '/'
            );
        default:
          return false;
      }
    }

    function getStep8CallbackUrlFromNavigation(details, signupTabId) {
      if (!Number.isInteger(signupTabId) || !details) return '';
      if (details.tabId !== signupTabId) return '';
      if (details.frameId !== 0) return '';
      return isLocalhostOAuthCallbackUrl(details.url) ? details.url : '';
    }

    function getStep8CallbackUrlFromTabUpdate(tabId, changeInfo, tab, signupTabId) {
      if (!Number.isInteger(signupTabId) || tabId !== signupTabId) return '';
      const candidates = [changeInfo?.url, tab?.url];
      for (const candidate of candidates) {
        if (isLocalhostOAuthCallbackUrl(candidate)) {
          return candidate;
        }
      }
      return '';
    }

    return {
      getPanelMode,
      getPanelModeLabel,
      getStep8CallbackUrlFromNavigation,
      getStep8CallbackUrlFromTabUpdate,
      is163MailHost,
      isLocalCpaUrl,
      isLocalhostOAuthCallbackUrl,
      isSignupEmailVerificationPageUrl,
      isSignupEntryHost,
      isSignupPageHost,
      isSignupPasswordPageUrl,
      matchesSourceUrlFamily,
      normalizeCodex2ApiUrl,
      normalizeSub2ApiUrl,
      parseUrlSafely,
      shouldBypassStep9ForLocalCpa,
    };
  }

  return {
    createNavigationUtils,
  };
});
