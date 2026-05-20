(function attachMailProviderUtils(root, factory) {
  const api = factory();

  if (typeof module !== 'undefined' && module.exports) {
    module.exports = api;
  }

  if (root) {
    root.MailProviderUtils = api;
  }
})(typeof self !== 'undefined' ? self : globalThis, function createMailProviderUtils() {
  const HOTMAIL_PROVIDER = 'hotmail-api';
  const GMAIL_PROVIDER = 'gmail';
  const YAHOO_PROVIDER = 'yahoo';
  const YYDS_MAIL_PROVIDER = 'yyds-mail';
  const LUCKMAIL_PROVIDER = 'luckmail-api';
  const CLOUDFLARE_TEMP_EMAIL_PROVIDER = 'cloudflare-temp-email';
  const CLOUD_MAIL_PROVIDER = 'cloudmail';
  const NETEASE_LIST_PATH = '/js6/main.jsp?df=mail163_letter#module=mbox.ListModule%7C%7B%22fid%22%3A1%2C%22order%22%3A%22date%22%2C%22desc%22%3Atrue%7D';
  const ICLOUD_TARGET_MAILBOX_TYPE_INBOX = 'icloud-inbox';
  const ICLOUD_TARGET_MAILBOX_TYPE_FORWARD = 'forward-mailbox';
  const ICLOUD_FORWARD_MAIL_PROVIDER_OPTIONS = [
    { value: 'qq', label: 'QQ 邮箱' },
    { value: '163', label: '163 邮箱' },
    { value: '163-vip', label: '163 VIP 邮箱' },
    { value: '126', label: '126 邮箱' },
    { value: GMAIL_PROVIDER, label: 'Gmail 邮箱' },
  ];

  function normalizeMailProvider(value = '') {
    const normalized = String(value || '').trim().toLowerCase();
    switch (normalized) {
      case HOTMAIL_PROVIDER:
      case YAHOO_PROVIDER:
      case YYDS_MAIL_PROVIDER:
      case '163':
      case '163-vip':
      case '126':
      case 'qq':
      case 'inbucket':
        return normalized;
      default:
        return '163';
    }
  }

  function normalizeIcloudTargetMailboxType(value = '') {
    return String(value || '').trim().toLowerCase() === ICLOUD_TARGET_MAILBOX_TYPE_FORWARD
      ? ICLOUD_TARGET_MAILBOX_TYPE_FORWARD
      : ICLOUD_TARGET_MAILBOX_TYPE_INBOX;
  }

  function normalizeIcloudForwardMailProvider(value = '') {
    const normalized = String(value || '').trim().toLowerCase();
    return ICLOUD_FORWARD_MAIL_PROVIDER_OPTIONS.some((option) => option.value === normalized)
      ? normalized
      : 'qq';
  }

  function getIcloudForwardMailProviderOptions() {
    return ICLOUD_FORWARD_MAIL_PROVIDER_OPTIONS.map((option) => ({ ...option }));
  }

  function getIcloudForwardMailConfig(provider = 'qq') {
    const normalizedProvider = normalizeIcloudForwardMailProvider(provider);
    if (normalizedProvider === GMAIL_PROVIDER) {
      return {
        source: 'gmail-mail',
        url: 'https://mail.google.com/mail/u/0/#inbox',
        label: 'Gmail 邮箱',
        inject: ['content/activation-utils.js', 'content/utils.js', 'content/gmail-mail.js'],
        injectSource: 'gmail-mail',
      };
    }

    return getMailProviderConfig({ mailProvider: normalizedProvider });
  }

  function getMailProviderConfig(state = {}, options = {}) {
    const provider = normalizeMailProvider(state.mailProvider);
    const normalizeInbucketOrigin = options.normalizeInbucketOrigin || (() => '');

    if (provider === HOTMAIL_PROVIDER) {
      return { provider: HOTMAIL_PROVIDER, label: 'Hotmail（微软 Graph）' };
    }
    if (provider === YAHOO_PROVIDER) {
      return {
        provider: YAHOO_PROVIDER,
        source: 'yahoo-mail',
        url: 'https://mail.yahoo.com/n/inbox/all?listFilter=ALL_INBOX',
        label: 'Yahoo 邮箱',
        navigateOnReuse: true,
        inject: ['content/activation-utils.js', 'shared/source-registry.js', 'content/utils.js', 'content/yahoo-mail.js'],
        injectSource: 'yahoo-mail',
      };
    }
    if (provider === YYDS_MAIL_PROVIDER) {
      return { provider: YYDS_MAIL_PROVIDER, label: 'YYDS Mail' };
    }
    if (provider === '163') {
      return {
        source: 'mail-163',
        url: `https://mail.163.com${NETEASE_LIST_PATH}`,
        label: '163 邮箱',
      };
    }
    if (provider === '163-vip') {
      return {
        source: 'mail-163',
        url: `https://webmail.vip.163.com${NETEASE_LIST_PATH}`,
        label: '163 VIP 邮箱',
      };
    }
    if (provider === '126') {
      return {
        source: 'mail-163',
        url: `https://mail.126.com${NETEASE_LIST_PATH}`,
        label: '126 邮箱',
      };
    }
    if (provider === 'inbucket') {
      const host = normalizeInbucketOrigin(state.inbucketHost);
      const mailbox = String(state.inbucketMailbox || '').trim();
      if (!host) {
        return { error: 'Inbucket 主机地址为空或无效。' };
      }
      if (!mailbox) {
        return { error: 'Inbucket 邮箱名称为空。' };
      }
      return {
        source: 'inbucket-mail',
        url: `${host}/m/${encodeURIComponent(mailbox)}/`,
        label: `Inbucket 邮箱（${mailbox}）`,
        navigateOnReuse: true,
        inject: ['content/activation-utils.js', 'content/utils.js', 'content/inbucket-mail.js'],
        injectSource: 'inbucket-mail',
      };
    }
    return { source: 'qq-mail', url: 'https://wx.mail.qq.com/', label: 'QQ 邮箱' };
  }

  function normalizeProviderToken(value = '') {
    return String(value || '').trim().toLowerCase();
  }

  function inferMailProvider(mail = {}, state = {}) {
    const explicitProvider = normalizeProviderToken(mail?.provider);
    if (explicitProvider) {
      return explicitProvider;
    }

    const stateProvider = normalizeProviderToken(state?.mailProvider);
    if (stateProvider) {
      return stateProvider;
    }

    const source = normalizeProviderToken(mail?.source);
    const injectSource = normalizeProviderToken(mail?.injectSource);
    const label = normalizeProviderToken(mail?.label);
    const url = normalizeProviderToken(mail?.url);
    const combined = `${source} ${injectSource} ${label} ${url}`;
    if (/yahoo/.test(combined)) return YAHOO_PROVIDER;
    if (/2925/.test(combined)) return '2925';
    if (/hotmail/.test(combined)) return HOTMAIL_PROVIDER;
    if (/luckmail/.test(combined)) return LUCKMAIL_PROVIDER;
    if (/cloudmail/.test(combined)) return CLOUD_MAIL_PROVIDER;
    if (/yyds/.test(combined)) return YYDS_MAIL_PROVIDER;
    if (/cloudflare/.test(combined)) return CLOUDFLARE_TEMP_EMAIL_PROVIDER;
    return explicitProvider || stateProvider || '';
  }

  function withResolvedMailProvider(mail = {}, state = {}) {
    const provider = inferMailProvider(mail, state);
    if (!mail || typeof mail !== 'object') {
      return { provider };
    }
    if (normalizeProviderToken(mail.provider) === provider) {
      return mail;
    }
    return { ...mail, provider };
  }

  return {
    CLOUDFLARE_TEMP_EMAIL_PROVIDER,
    CLOUD_MAIL_PROVIDER,
    GMAIL_PROVIDER,
    HOTMAIL_PROVIDER,
    LUCKMAIL_PROVIDER,
    YAHOO_PROVIDER,
    YYDS_MAIL_PROVIDER,
    getIcloudForwardMailConfig,
    getIcloudForwardMailProviderOptions,
    getMailProviderConfig,
    inferMailProvider,
    normalizeIcloudForwardMailProvider,
    normalizeIcloudTargetMailboxType,
    normalizeMailProvider,
    withResolvedMailProvider,
  };
});
