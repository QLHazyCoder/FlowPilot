(function attachManagedAliasUtils(root, factory) {
  root.MultiPageManagedAliasUtils = factory();
})(typeof self !== 'undefined' ? self : globalThis, function createManagedAliasUtilsModule() {
  const GMAIL_PROVIDER = 'gmail';
  const MAIL_2925_PROVIDER = '2925';
  const MAIL_2925_MODE_PROVIDE = 'provide';
  const MAIL_2925_MODE_RECEIVE = 'receive';
  const DEFAULT_MAIL_2925_MODE = MAIL_2925_MODE_PROVIDE;

  const PROVIDER_CONFIGS = {
    [GMAIL_PROVIDER]: {
      baseLabel: 'Gmail Base Email',
      basePlaceholder: 'e.g. yourname@gmail.com',
      label: 'Gmail +tag Email',
      parseBaseEmail(rawValue = '') {
        const value = String(rawValue || '').trim().toLowerCase();
        const match = value.match(/^([^@\s+]+)@((?:gmail|googlemail)\.com)$/i);
        if (!match) return null;
        return {
          localPart: match[1],
          domain: match[2].toLowerCase(),
        };
      },
      matchesProviderDomain(domain = '') {
        return /^(?:gmail|googlemail)\.com$/i.test(String(domain || '').trim());
      },
      matchesAliasLocalPart(baseLocalPart = '', candidateLocalPart = '') {
        return String(candidateLocalPart || '').split('+')[0] === String(baseLocalPart || '');
      },
      buildAlias(parsedBaseEmail, tag) {
        return `${parsedBaseEmail.localPart}+${tag}@${parsedBaseEmail.domain}`;
      },
      generationHint: 'Fill in the Gmail base email then click "Generate". You can also manually enter a full Gmail address.',
      registrationPlaceholder: 'Click to generate a Gmail +tag email, or manually enter a full email',
    },
    [MAIL_2925_PROVIDER]: {
      baseLabel: '2925 Base Email',
      basePlaceholder: 'e.g. yourname@2925.com',
      label: '2925 Email',
      parseBaseEmail(rawValue = '') {
        const value = String(rawValue || '').trim().toLowerCase();
        const match = value.match(/^([^@\s+]+)@(2925\.com)$/i);
        if (!match) return null;
        return {
          localPart: match[1],
          domain: match[2].toLowerCase(),
        };
      },
      matchesProviderDomain(domain = '') {
        return String(domain || '').trim().toLowerCase() === '2925.com';
      },
      matchesAliasLocalPart(baseLocalPart = '', candidateLocalPart = '') {
        const normalizedBaseLocalPart = String(baseLocalPart || '');
        const normalizedCandidateLocalPart = String(candidateLocalPart || '');
        return normalizedCandidateLocalPart === normalizedBaseLocalPart
          || normalizedCandidateLocalPart.startsWith(normalizedBaseLocalPart);
      },
      buildAlias(parsedBaseEmail, tag) {
        return `${parsedBaseEmail.localPart}${tag}@${parsedBaseEmail.domain}`;
      },
      generationHint: 'Fill in the 2925 base email then click "Generate". You can also manually enter a full 2925 address.',
      registrationPlaceholder: 'Click to generate a 2925 email, or manually enter a full email',
    },
  };

  function getManagedAliasProviderConfig(provider = '') {
    return PROVIDER_CONFIGS[String(provider || '').trim().toLowerCase()] || null;
  }

  function normalizeMail2925Mode(value = '') {
    return String(value || '').trim().toLowerCase() === MAIL_2925_MODE_RECEIVE
      ? MAIL_2925_MODE_RECEIVE
      : DEFAULT_MAIL_2925_MODE;
  }

  function isManagedAliasProvider(provider = '') {
    return Boolean(getManagedAliasProviderConfig(provider));
  }

  function usesManagedAliasGeneration(provider = '', options = {}) {
    const normalizedProvider = String(provider || '').trim().toLowerCase();
    if (!isManagedAliasProvider(normalizedProvider)) {
      return false;
    }
    if (normalizedProvider !== MAIL_2925_PROVIDER) {
      return true;
    }

    const mail2925Mode = typeof options === 'string'
      ? options
      : options?.mail2925Mode;
    return normalizeMail2925Mode(mail2925Mode) === MAIL_2925_MODE_PROVIDE;
  }

  function parseEmailParts(rawValue = '') {
    const value = String(rawValue || '').trim().toLowerCase();
    const match = value.match(/^([^@\s]+)@([^@\s]+\.[^@\s]+)$/);
    if (!match) return null;
    return {
      localPart: match[1],
      domain: match[2],
    };
  }

  function parseManagedAliasBaseEmail(rawValue, provider = '') {
    const config = getManagedAliasProviderConfig(provider);
    return config?.parseBaseEmail(rawValue) || null;
  }

  function isManagedAliasEmail(value, provider = '', baseEmail = '') {
    const config = getManagedAliasProviderConfig(provider);
    if (!config) return false;

    const parsedEmail = parseEmailParts(value);
    if (!parsedEmail || !config.matchesProviderDomain(parsedEmail.domain)) {
      return false;
    }

    const parsedBaseEmail = parseManagedAliasBaseEmail(baseEmail, provider);
    if (!parsedBaseEmail) {
      return true;
    }

    return parsedEmail.domain === parsedBaseEmail.domain
      && config.matchesAliasLocalPart(parsedBaseEmail.localPart, parsedEmail.localPart);
  }

  function buildManagedAliasEmail(provider = '', baseEmail = '', tag = '') {
    const config = getManagedAliasProviderConfig(provider);
    if (!config) {
      throw new Error(`Unsupported managed alias provider: ${provider}`);
    }

    const parsedBaseEmail = parseManagedAliasBaseEmail(baseEmail, provider);
    if (!parsedBaseEmail) {
      throw new Error(`${config.baseLabel} format is invalid`);
    }

    const normalizedTag = String(tag || '').trim();
    if (!normalizedTag) {
      throw new Error(`${config.label} generated tag is empty`);
    }

    return config.buildAlias(parsedBaseEmail, normalizedTag);
  }

  function getManagedAliasProviderUiCopy(provider = '') {
    const config = getManagedAliasProviderConfig(provider);
    if (!config) return null;
    return {
      baseLabel: config.baseLabel,
      basePlaceholder: config.basePlaceholder,
      buttonLabel: 'Generate',
      successVerb: 'Generated',
      label: config.label,
      placeholder: config.registrationPlaceholder,
      hint: config.generationHint,
    };
  }

  return {
    buildManagedAliasEmail,
    DEFAULT_MAIL_2925_MODE,
    getManagedAliasProviderConfig,
    getManagedAliasProviderUiCopy,
    isManagedAliasEmail,
    isManagedAliasProvider,
    MAIL_2925_MODE_PROVIDE,
    MAIL_2925_MODE_RECEIVE,
    normalizeMail2925Mode,
    parseEmailParts,
    parseManagedAliasBaseEmail,
    usesManagedAliasGeneration,
  };
});
