const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');

test('background imports mail rule registry and flow mail rules modules', () => {
  const source = fs.readFileSync('background.js', 'utf8');
  assert.match(source, /background\/mail-rule-registry\.js/);
  assert.match(source, /flows\/openai\/mail-rules\.js/);
  assert.match(source, /flows\/kiro\/mail-rules\.js/);
  assert.match(source, /flows\/grok\/mail-rules\.js/);
  assert.match(source, /background\/flow-mail-polling\.js/);
});

test('mail rule registry exposes canonical OpenAI verification poll payloads', () => {
  const registrySource = fs.readFileSync('background/mail-rule-registry.js', 'utf8');
  const openAiSource = fs.readFileSync('flows/openai/mail-rules.js', 'utf8');
  const registryApi = new Function('self', `${registrySource}; return self.MultiPageBackgroundMailRuleRegistry;`)({});
  const openAiApi = new Function('self', `${openAiSource}; return self.MultiPageOpenAiMailRules;`)({});

  const openAiMailRules = openAiApi.createOpenAiMailRules({
    getHotmailVerificationRequestTimestamp: (step) => (step === 4 ? 123 : 456),
    MAIL_2925_VERIFICATION_INTERVAL_MS: 15000,
    MAIL_2925_VERIFICATION_MAX_ATTEMPTS: 15,
  });
  const registry = registryApi.createMailRuleRegistry({
    defaultFlowId: 'openai',
    flowBuilders: {
      openai: openAiMailRules,
    },
  });

  assert.deepEqual(
    registry.buildVerificationPollPayload(
      4,
      {
        activeFlowId: 'openai',
        email: 'user@example.com',
        mailProvider: '2925',
        mail2925Mode: 'receive',
      },
      { excludeCodes: ['111111'] }
    ),
    {
      flowId: 'openai',
      ruleId: 'openai-signup-code',
      nodeId: 'fetch-signup-code',
      step: 4,
      artifactType: 'code',
      codePatterns: [
        {
          source: '(?:chatgpt\\s+log-?in\\s+code|enter\\s+this\\s+code)[^0-9]{0,24}(\\d{6})',
          flags: 'i',
        },
        {
          source: 'your\\s+chatgpt\\s+code\\s+is\\s+(\\d{6})',
          flags: 'i',
        },
        {
          source: '(?:verification\\s+code|temporary\\s+verification\\s+code|your\\s+chatgpt\\s+code|code(?:\\s+is)?)[^0-9]{0,16}(\\d{6})',
          flags: 'i',
        },
      ],
      filterAfterTimestamp: 0,
      requiredKeywords: ['openai', 'chatgpt', 'verify', 'verification', 'confirm', '验证码', '代码'],
      senderFilters: ['openai', 'noreply', 'verify', 'auth', 'duckduckgo', 'forward'],
      subjectFilters: ['verify', 'verification', 'code', '验证码', 'confirm'],
      targetEmail: 'user@example.com',
      targetEmailHints: ['user@example.com', 'user=example.com'],
      mail2925MatchTargetEmail: true,
      maxAttempts: 15,
      intervalMs: 15000,
      excludeCodes: ['111111'],
    }
  );

  assert.deepEqual(
    registry.buildVerificationPollPayload(8, {
      activeFlowId: 'openai',
      email: 'user@example.com',
      step8VerificationTargetEmail: 'login@example.com',
    }),
    {
      flowId: 'openai',
      ruleId: 'openai-login-code',
      nodeId: 'fetch-login-code',
      step: 8,
      artifactType: 'code',
      codePatterns: [
        {
          source: '(?:chatgpt\\s+log-?in\\s+code|enter\\s+this\\s+code)[^0-9]{0,24}(\\d{6})',
          flags: 'i',
        },
        {
          source: 'your\\s+chatgpt\\s+code\\s+is\\s+(\\d{6})',
          flags: 'i',
        },
        {
          source: '(?:verification\\s+code|temporary\\s+verification\\s+code|your\\s+chatgpt\\s+code|code(?:\\s+is)?)[^0-9]{0,16}(\\d{6})',
          flags: 'i',
        },
      ],
      filterAfterTimestamp: 456,
      requiredKeywords: ['openai', 'chatgpt', 'verify', 'verification', 'confirm', '验证码', '代码', 'login'],
      senderFilters: ['openai', 'noreply', 'verify', 'auth', 'chatgpt', 'duckduckgo', 'forward'],
      subjectFilters: ['verify', 'verification', 'code', '验证码', 'confirm', 'login'],
      targetEmail: 'login@example.com',
      targetEmailHints: ['login@example.com', 'login=example.com'],
      mail2925MatchTargetEmail: false,
      maxAttempts: 5,
      intervalMs: 3000,
    }
  );

  assert.equal(
    registry.buildVerificationPollPayloadForNode('fetch-signup-code', {
      activeFlowId: 'openai',
      email: 'node@example.com',
    }).nodeId,
    'fetch-signup-code'
  );
});

test('mail rule registry rejects unknown active flow ids instead of silently using OpenAI rules', () => {
  const registrySource = fs.readFileSync('background/mail-rule-registry.js', 'utf8');
  const registryApi = new Function('self', `${registrySource}; return self.MultiPageBackgroundMailRuleRegistry;`)({});
  const registry = registryApi.createMailRuleRegistry({
    defaultFlowId: 'openai',
    flowBuilders: {},
  });

  assert.throws(
    () => registry.buildVerificationPollPayload(4, {
      activeFlowId: 'site-a',
      email: 'user@example.com',
    }),
    /未找到 flow=site-a 的邮件轮询规则构造器/
  );
});

test('mail rule registry exposes Kiro AWS verification poll payloads by node', () => {
  const stateSource = fs.readFileSync('flows/kiro/background/state.js', 'utf8');
  const registrySource = fs.readFileSync('background/mail-rule-registry.js', 'utf8');
  const kiroSource = fs.readFileSync('flows/kiro/mail-rules.js', 'utf8');
  const globalScope = {};
  new Function('self', `${stateSource}; ${registrySource}; ${kiroSource}; return self;`)(globalScope);

  const kiroMailRules = globalScope.MultiPageKiroMailRules.createKiroMailRules({
    LUCKMAIL_PROVIDER: 'luckmail-api',
    MAIL_2925_VERIFICATION_INTERVAL_MS: 16000,
    MAIL_2925_VERIFICATION_MAX_ATTEMPTS: 17,
  });
  const registry = globalScope.MultiPageBackgroundMailRuleRegistry.createMailRuleRegistry({
    defaultFlowId: 'openai',
    flowBuilders: {
      kiro: kiroMailRules,
    },
  });
  const baseState = {
    activeFlowId: 'kiro',
    mailProvider: '2925',
    mail2925Mode: 'receive',
    runtimeState: {
      flowState: {
        kiro: {
          register: {
            email: 'kiro-user@example.com',
          },
        },
      },
    },
  };

  assert.deepEqual(
    registry.buildVerificationPollPayloadForNode(
      'kiro-submit-verification-code',
      baseState,
      { filterAfterTimestamp: 12345 }
    ),
    {
      flowId: 'kiro',
      ruleId: 'kiro-submit-verification-code',
      nodeId: 'kiro-submit-verification-code',
      step: 4,
      artifactType: 'code',
      codePatterns: [
        {
          source: '(?:verification\\s*code|验证码|Your code is|code is)[：:\\s]*(\\d{6})',
          flags: 'gi',
        },
        {
          source: '^\\s*(\\d{6})\\s*$',
          flags: 'gm',
        },
        {
          source: '>\\s*(\\d{6})\\s*<',
          flags: 'g',
        },
      ],
      filterAfterTimestamp: 12345,
      requiredKeywords: ['verification', '验证码', 'code', 'aws'],
      senderFilters: [
        'no-reply@signin.aws',
        'no-reply@login.awsapps.com',
        'noreply@amazon.com',
        'account-update@amazon.com',
        'no-reply@aws.amazon.com',
        'noreply@aws.amazon.com',
        'aws',
      ],
      subjectFilters: ['aws builder id', 'verification', '验证码', 'code', 'aws'],
      targetEmail: 'kiro-user@example.com',
      targetEmailHints: ['kiro-user@example.com'],
      mail2925MatchTargetEmail: true,
      maxAttempts: 17,
      intervalMs: 16000,
    }
  );

  const desktopPayload = registry.buildVerificationPollPayloadForNode(
    'kiro-complete-desktop-authorize',
    {
      ...baseState,
      mailProvider: 'luckmail-api',
      mail2925Mode: 'provide',
    }
  );
  assert.equal(desktopPayload.ruleId, 'kiro-complete-desktop-authorize');
  assert.equal(desktopPayload.step, 8);
  assert.equal(desktopPayload.mail2925MatchTargetEmail, false);
  assert.equal(desktopPayload.maxAttempts, 3);
  assert.equal(desktopPayload.intervalMs, 15000);
});

test('mail rule registry exposes Grok xAI verification poll payloads by node', () => {
  const stateSource = fs.readFileSync('flows/grok/background/state.js', 'utf8');
  const registrySource = fs.readFileSync('background/mail-rule-registry.js', 'utf8');
  const grokSource = fs.readFileSync('flows/grok/mail-rules.js', 'utf8');
  const globalScope = {};
  new Function('self', `${stateSource}; ${registrySource}; ${grokSource}; return self;`)(globalScope);

  const grokMailRules = globalScope.MultiPageGrokMailRules.createGrokMailRules({
    LUCKMAIL_PROVIDER: 'luckmail-api',
    MAIL_2925_VERIFICATION_INTERVAL_MS: 16000,
    MAIL_2925_VERIFICATION_MAX_ATTEMPTS: 17,
  });
  const registry = globalScope.MultiPageBackgroundMailRuleRegistry.createMailRuleRegistry({
    defaultFlowId: 'openai',
    flowBuilders: {
      grok: grokMailRules,
    },
  });

  assert.deepEqual(
    registry.buildVerificationPollPayloadForNode(
      'grok-submit-verification-code',
      {
        activeFlowId: 'grok',
        mailProvider: '2925',
        mail2925Mode: 'receive',
        runtimeState: {
          flowState: {
            grok: {
              register: {
                email: 'grok-user@example.com',
              },
            },
          },
        },
      },
      { filterAfterTimestamp: 12345 }
    ),
    {
      flowId: 'grok',
      ruleId: 'grok-submit-verification-code',
      nodeId: 'grok-submit-verification-code',
      step: 3,
      artifactType: 'code',
      codePatterns: [
        {
          source: '\\b([A-Z0-9]{3}-[A-Z0-9]{3})\\b',
          flags: 'gi',
        },
        {
          source: '(?:verification\\s*code|confirmation\\s*code|code\\s*is)[：:\\s]*(\\d{6})',
          flags: 'gi',
        },
        {
          source: '(?:验证码|代码|确认码)[：:\\s为]+(\\d{6})',
          flags: 'gi',
        },
        {
          source: '(?<!#)\\b(\\d{6})\\b',
          flags: 'g',
        },
      ],
      filterAfterTimestamp: 12345,
      requiredKeywords: ['xai', 'x.ai', 'grok', 'verification', 'confirmation', 'code', '验证码', '确认码'],
      senderFilters: ['x.ai', 'xai', 'grok'],
      subjectFilters: ['xai', 'x.ai', 'grok', 'verification', 'confirmation', 'code', '验证码', '确认码'],
      targetEmail: 'grok-user@example.com',
      targetEmailHints: ['grok-user@example.com'],
      mail2925MatchTargetEmail: true,
      maxAttempts: 17,
      intervalMs: 16000,
    }
  );

  const luckmailPayload = registry.buildVerificationPollPayloadForNode(
    'grok-submit-verification-code',
    {
      activeFlowId: 'grok',
      mailProvider: 'luckmail-api',
      mail2925Mode: 'provide',
      grokEmail: 'fallback@example.com',
    }
  );
  assert.equal(luckmailPayload.mail2925MatchTargetEmail, false);
  assert.equal(luckmailPayload.maxAttempts, 3);
  assert.equal(luckmailPayload.intervalMs, 15000);
});
