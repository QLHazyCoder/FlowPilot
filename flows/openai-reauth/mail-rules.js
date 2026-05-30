(function attachOpenAiReauthMailRules(root, factory) {
  root.MultiPageOpenAiReauthMailRules = factory();
})(typeof self !== 'undefined' ? self : globalThis, function createOpenAiReauthMailRulesModule() {
  const REAUTH_CODE_RULE_ID = 'openai-reauth-code';
  const REAUTH_CODE_NODE_ID = 'fetch-reauth-code';
  const REAUTH_VISIBLE_STEP = 3;

  const OPENAI_CODE_PATTERNS = Object.freeze([
    Object.freeze({
      source: '(?:chatgpt\\s+log-?in\\s+code|enter\\s+this\\s+code)[^0-9]{0,24}(\\d{6})',
      flags: 'i',
    }),
    Object.freeze({
      source: 'your\\s+chatgpt\\s+code\\s+is\\s+(\\d{6})',
      flags: 'i',
    }),
    Object.freeze({
      source: '(?:verification\\s+code|temporary\\s+verification\\s+code|your\\s+chatgpt\\s+code|code(?:\\s+is)?)[^0-9]{0,16}(\\d{6})',
      flags: 'i',
    }),
  ]);
  const OPENAI_REQUIRED_KEYWORDS = Object.freeze([
    'openai',
    'chatgpt',
    'verify',
    'verification',
    'confirm',
    'login',
    '验证码',
    '代码',
  ]);
  const OPENAI_SENDER_FILTERS = Object.freeze([
    'openai', 'noreply', 'verify', 'auth', 'chatgpt', 'duckduckgo', 'forward',
  ]);
  const OPENAI_SUBJECT_FILTERS = Object.freeze([
    'verify', 'verification', 'code', '验证码', 'confirm', 'login',
  ]);

  function buildTargetEmailHints(targetEmail = '') {
    const normalized = String(targetEmail || '').trim().toLowerCase();
    if (!normalized) return [];
    const hints = [normalized];
    const atIndex = normalized.indexOf('@');
    if (atIndex > 0) {
      hints.push(`${normalized.slice(0, atIndex)}=${normalized.slice(atIndex + 1)}`);
    }
    return [...new Set(hints)];
  }

  function createOpenAiReauthMailRules(deps = {}) {
    const {
      getHotmailVerificationRequestTimestamp = () => 0,
      MAIL_2925_VERIFICATION_INTERVAL_MS = 15000,
      MAIL_2925_VERIFICATION_MAX_ATTEMPTS = 15,
    } = deps;

    function isMail2925Provider(state = {}) {
      return String(state?.mailProvider || '').trim().toLowerCase() === '2925';
    }

    function shouldMatchMail2925TargetEmail(state = {}) {
      return isMail2925Provider(state)
        && String(state?.mail2925Mode || '').trim().toLowerCase() === 'receive';
    }

    function resolveTargetEmail(state = {}) {
      return String(state?.reauthEmail || state?.email || '').trim();
    }

    function getVisibleStepForNode(_nodeId, _state = {}) {
      return REAUTH_VISIBLE_STEP;
    }

    function getRuleDefinition(_input, state = {}) {
      const mail2925Provider = isMail2925Provider(state);
      const targetEmail = resolveTargetEmail(state);
      return {
        flowId: 'openai-reauth',
        ruleId: REAUTH_CODE_RULE_ID,
        nodeId: REAUTH_CODE_NODE_ID,
        step: REAUTH_VISIBLE_STEP,
        artifactType: 'code',
        codePatterns: OPENAI_CODE_PATTERNS,
        filterAfterTimestamp: mail2925Provider
          ? 0
          : getHotmailVerificationRequestTimestamp(REAUTH_VISIBLE_STEP, state),
        requiredKeywords: OPENAI_REQUIRED_KEYWORDS,
        senderFilters: OPENAI_SENDER_FILTERS,
        subjectFilters: OPENAI_SUBJECT_FILTERS,
        targetEmail,
        targetEmailHints: buildTargetEmailHints(targetEmail),
        mail2925MatchTargetEmail: shouldMatchMail2925TargetEmail(state),
        maxAttempts: mail2925Provider ? MAIL_2925_VERIFICATION_MAX_ATTEMPTS : 5,
        intervalMs: mail2925Provider ? MAIL_2925_VERIFICATION_INTERVAL_MS : 3000,
      };
    }

    function getRuleDefinitionForNode(nodeId, state = {}) {
      if (String(nodeId || '').trim() !== REAUTH_CODE_NODE_ID) {
        return null;
      }
      return getRuleDefinition({ nodeId }, state);
    }

    function buildVerificationPollPayload(input, state = {}, overrides = {}) {
      return {
        ...getRuleDefinition(input, state),
        ...(overrides || {}),
      };
    }

    function buildVerificationPollPayloadForNode(nodeId, state = {}, overrides = {}) {
      const rule = getRuleDefinitionForNode(nodeId, state);
      if (!rule) return null;
      return { ...rule, ...(overrides || {}) };
    }

    return {
      buildVerificationPollPayload,
      buildVerificationPollPayloadForNode,
      getRuleDefinition,
      getRuleDefinitionForNode,
      getVisibleStepForNode,
    };
  }

  return {
    REAUTH_CODE_RULE_ID,
    REAUTH_CODE_NODE_ID,
    REAUTH_VISIBLE_STEP,
    createOpenAiReauthMailRules,
  };
});
