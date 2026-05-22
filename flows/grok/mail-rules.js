(function attachGrokMailRules(root, factory) {
  root.MultiPageGrokMailRules = factory(root);
})(typeof self !== 'undefined' ? self : globalThis, function createGrokMailRulesModule(root) {
  const grokStateApi = root.MultiPageBackgroundGrokState || null;
  const SUBMIT_VERIFICATION_CODE_RULE_ID = 'grok-submit-verification-code';
  const SUBMIT_VERIFICATION_CODE_NODE_ID = 'grok-submit-verification-code';
  const GROK_VERIFICATION_CODE_PATTERNS = Object.freeze([
    Object.freeze({
      source: '\\b([A-Z0-9]{3}-[A-Z0-9]{3})\\b',
      flags: 'gi',
    }),
    Object.freeze({
      source: '(?:verification\\s*code|confirmation\\s*code|code\\s*is)[：:\\s]*(\\d{6})',
      flags: 'gi',
    }),
    Object.freeze({
      source: '(?:验证码|代码|确认码)[：:\\s为]+(\\d{6})',
      flags: 'gi',
    }),
    Object.freeze({
      source: '(?<!#)\\b(\\d{6})\\b',
      flags: 'g',
    }),
  ]);
  const GROK_SENDER_FILTERS = Object.freeze([
    'x.ai',
    'xai',
    'grok',
  ]);
  const GROK_SUBJECT_FILTERS = Object.freeze([
    'xai',
    'x.ai',
    'grok',
    'verification',
    'confirmation',
    'code',
    '验证码',
    '确认码',
  ]);
  const GROK_REQUIRED_KEYWORDS = Object.freeze([
    'xai',
    'x.ai',
    'grok',
    'verification',
    'confirmation',
    'code',
    '验证码',
    '确认码',
  ]);

  function cleanString(value = '') {
    return String(value ?? '').trim();
  }

  function readGrokRuntime(state = {}) {
    if (typeof grokStateApi?.ensureRuntimeState === 'function') {
      return grokStateApi.ensureRuntimeState(state);
    }
    return state?.runtimeState?.flowState?.grok || state?.flowState?.grok || {};
  }

  function buildTargetEmailHints(targetEmail = '') {
    const normalizedTarget = cleanString(targetEmail).toLowerCase();
    return normalizedTarget ? [normalizedTarget] : [];
  }

  function getVisibleStep(state = {}) {
    const explicitStep = Number(state?.visibleStep || state?.step);
    return Number.isInteger(explicitStep) && explicitStep > 0 ? explicitStep : 3;
  }

  function isMail2925Provider(state = {}) {
    return cleanString(state?.mailProvider).toLowerCase() === '2925';
  }

  function shouldMatchMail2925TargetEmail(state = {}) {
    return isMail2925Provider(state)
      && cleanString(state?.mail2925Mode).toLowerCase() === 'receive';
  }

  function createGrokMailRules(deps = {}) {
    const {
      LUCKMAIL_PROVIDER = 'luckmail-api',
      MAIL_2925_VERIFICATION_INTERVAL_MS = 15000,
      MAIL_2925_VERIFICATION_MAX_ATTEMPTS = 15,
    } = deps;

    function getRuleDefinition(_input, state = {}) {
      const runtimeState = readGrokRuntime(state);
      const targetEmail = cleanString(runtimeState.register?.email || state?.grokEmail || state?.email).toLowerCase();
      const normalizedProvider = cleanString(state?.mailProvider).toLowerCase();
      const mail2925Provider = isMail2925Provider(state);
      const luckmailProvider = normalizedProvider === cleanString(LUCKMAIL_PROVIDER).toLowerCase();

      return {
        flowId: 'grok',
        ruleId: SUBMIT_VERIFICATION_CODE_RULE_ID,
        nodeId: SUBMIT_VERIFICATION_CODE_NODE_ID,
        step: getVisibleStep(state),
        artifactType: 'code',
        codePatterns: GROK_VERIFICATION_CODE_PATTERNS,
        filterAfterTimestamp: 0,
        requiredKeywords: GROK_REQUIRED_KEYWORDS,
        senderFilters: GROK_SENDER_FILTERS,
        subjectFilters: GROK_SUBJECT_FILTERS,
        targetEmail,
        targetEmailHints: buildTargetEmailHints(targetEmail),
        mail2925MatchTargetEmail: shouldMatchMail2925TargetEmail(state),
        maxAttempts: luckmailProvider
          ? 3
          : (mail2925Provider ? MAIL_2925_VERIFICATION_MAX_ATTEMPTS : 5),
        intervalMs: luckmailProvider
          ? 15000
          : (mail2925Provider ? MAIL_2925_VERIFICATION_INTERVAL_MS : 5000),
      };
    }

    function getRuleDefinitionForNode(nodeId, state = {}) {
      const normalizedNodeId = cleanString(nodeId);
      if (normalizedNodeId && normalizedNodeId !== SUBMIT_VERIFICATION_CODE_NODE_ID) {
        throw new Error(`Grok 邮件规则不支持节点：${normalizedNodeId}`);
      }
      return getRuleDefinition({ nodeId: SUBMIT_VERIFICATION_CODE_NODE_ID }, state);
    }

    function buildVerificationPollPayload(input, state = {}, overrides = {}) {
      return {
        ...getRuleDefinition(input, state),
        ...(overrides || {}),
      };
    }

    function buildVerificationPollPayloadForNode(nodeId, state = {}, overrides = {}) {
      return {
        ...getRuleDefinitionForNode(nodeId, state),
        ...(overrides || {}),
      };
    }

    return {
      buildVerificationPollPayload,
      buildVerificationPollPayloadForNode,
      getRuleDefinition,
      getRuleDefinitionForNode,
    };
  }

  return {
    GROK_REQUIRED_KEYWORDS,
    GROK_SENDER_FILTERS,
    GROK_SUBJECT_FILTERS,
    GROK_VERIFICATION_CODE_PATTERNS,
    SUBMIT_VERIFICATION_CODE_NODE_ID,
    SUBMIT_VERIFICATION_CODE_RULE_ID,
    createGrokMailRules,
  };
});
