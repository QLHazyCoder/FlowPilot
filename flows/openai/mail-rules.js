(function attachOpenAiMailRules(root, factory) {
  root.MultiPageOpenAiMailRules = factory();
})(typeof self !== 'undefined' ? self : globalThis, function createOpenAiMailRulesModule() {
  const SIGNUP_CODE_RULE_ID = 'openai-signup-code';
  const LOGIN_CODE_RULE_ID = 'openai-login-code';
  const SIGNUP_CODE_NODE_ID = 'fetch-signup-code';
  const LOGIN_CODE_NODE_ID = 'fetch-login-code';
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
    '验证码',
    '代码',
  ]);

  function buildTargetEmailHints(targetEmail = '') {
    const normalizedTarget = String(targetEmail || '').trim().toLowerCase();
    if (!normalizedTarget) {
      return [];
    }
    const hints = [normalizedTarget];
    const atIndex = normalizedTarget.indexOf('@');
    if (atIndex > 0) {
      hints.push(`${normalizedTarget.slice(0, atIndex)}=${normalizedTarget.slice(atIndex + 1)}`);
    }
    return [...new Set(hints)];
  }

  function createOpenAiMailRules(deps = {}) {
    const {
      getHotmailVerificationRequestTimestamp = () => 0,
      MAIL_2925_VERIFICATION_INTERVAL_MS = 15000,
      MAIL_2925_VERIFICATION_MAX_ATTEMPTS = 15,
    } = deps;

    function isMail2925Provider(state = {}) {
      return String(state?.mailProvider || '').trim().toLowerCase() === '2925';
    }

    function isYahooProvider(state = {}) {
      return String(state?.mailProvider || '').trim().toLowerCase() === 'yahoo';
    }

    function shouldMatchMail2925TargetEmail(state = {}) {
      return isMail2925Provider(state)
        && String(state?.mail2925Mode || '').trim().toLowerCase() === 'receive';
    }

    function resolveVerificationNodeId(input) {
      const directNodeId = String(input?.nodeId || input || '').trim();
      if (directNodeId === SIGNUP_CODE_NODE_ID || directNodeId === LOGIN_CODE_NODE_ID) {
        return directNodeId;
      }
      return Number(input?.step ?? input) === 4 ? SIGNUP_CODE_NODE_ID : LOGIN_CODE_NODE_ID;
    }

    function getVisibleStepForNode(nodeId, state = {}) {
      if (nodeId === SIGNUP_CODE_NODE_ID) {
        return 4;
      }
      const explicitStep = Number(state?.visibleStep || state?.step);
      return Number.isInteger(explicitStep) && explicitStep > 0 ? explicitStep : 8;
    }

    function getRuleDefinition(input, state = {}) {
      const nodeId = resolveVerificationNodeId(input);
      const normalizedStep = getVisibleStepForNode(nodeId, state);
      const mail2925Provider = isMail2925Provider(state);
      const yahooProvider = isYahooProvider(state);
      const signupStep = nodeId === SIGNUP_CODE_NODE_ID;
      const targetEmail = signupStep
        ? state?.email
        : (String(state?.step8VerificationTargetEmail || '').trim() || state?.email);
      const defaultMaxAttempts = yahooProvider ? 60 : 5;
      const defaultIntervalMs = yahooProvider ? 5000 : 3000;

      return {
        flowId: 'openai',
        ruleId: signupStep ? SIGNUP_CODE_RULE_ID : LOGIN_CODE_RULE_ID,
        nodeId,
        step: normalizedStep,
        artifactType: 'code',
        codePatterns: OPENAI_CODE_PATTERNS,
        filterAfterTimestamp: mail2925Provider
          ? 0
          : getHotmailVerificationRequestTimestamp(normalizedStep, state),
        requiredKeywords: signupStep
          ? OPENAI_REQUIRED_KEYWORDS
          : [...OPENAI_REQUIRED_KEYWORDS, 'login'],
        senderFilters: signupStep
          ? ['openai', 'noreply', 'verify', 'auth', 'duckduckgo', 'forward']
          : ['openai', 'noreply', 'verify', 'auth', 'chatgpt', 'duckduckgo', 'forward'],
        subjectFilters: signupStep
          ? ['verify', 'verification', 'code', '验证码', 'confirm']
          : ['verify', 'verification', 'code', '验证码', 'confirm', 'login'],
        targetEmail,
        targetEmailHints: buildTargetEmailHints(targetEmail),
        mail2925MatchTargetEmail: shouldMatchMail2925TargetEmail(state),
        maxAttempts: mail2925Provider ? MAIL_2925_VERIFICATION_MAX_ATTEMPTS : defaultMaxAttempts,
        intervalMs: mail2925Provider ? MAIL_2925_VERIFICATION_INTERVAL_MS : defaultIntervalMs,
        ...(yahooProvider ? { keepRefreshingUntilCode: true } : {}),
      };
    }

    function getRuleDefinitionForNode(nodeId, state = {}) {
      return getRuleDefinition({ nodeId }, state);
    }

    function buildVerificationPollPayload(input, state = {}, overrides = {}) {
      return {
        ...getRuleDefinition(input, state),
        ...(overrides || {}),
      };
    }

    function buildVerificationPollPayloadForNode(nodeId, state = {}, overrides = {}) {
      return buildVerificationPollPayload({ nodeId }, state, overrides);
    }

    return {
      buildVerificationPollPayload,
      buildVerificationPollPayloadForNode,
      getRuleDefinition,
      getRuleDefinitionForNode,
    };
  }

  return {
    LOGIN_CODE_RULE_ID,
    LOGIN_CODE_NODE_ID,
    SIGNUP_CODE_RULE_ID,
    SIGNUP_CODE_NODE_ID,
    createOpenAiMailRules,
  };
});
