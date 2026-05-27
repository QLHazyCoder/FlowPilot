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
  const YYDS_MAIL_PROVIDER = 'yyds-mail';
  const NETEASE_LIST_PATH = '/js6/main.jsp?df=mail163_letter#module=mbox.ListModule%7C%7B%22fid%22%3A1%2C%22order%22%3A%22date%22%2C%22desc%22%3Atrue%7D';
  const ICLOUD_TARGET_MAILBOX_TYPE_INBOX = 'icloud-inbox';
  const ICLOUD_TARGET_MAILBOX_TYPE_FORWARD = 'forward-mailbox';
  const ICLOUD_FORWARD_MAIL_PROVIDER_OPTIONS = [
    { value: 'qq', label: 'QQ Mail' },
    { value: '163', label: '163 Mail' },
    { value: '163-vip', label: '163 VIP Mail' },
    { value: '126', label: '126 Mail' },
    { value: GMAIL_PROVIDER, label: 'Gmail' },
  ];

  function normalizeMailProvider(value = '') {
    const normalized = String(value || '').trim().toLowerCase();
    switch (normalized) {
      case HOTMAIL_PROVIDER:
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
        label: 'Gmail',
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
      return { provider: HOTMAIL_PROVIDER, label: 'Hotmail (Microsoft Graph)' };
    }
    if (provider === YYDS_MAIL_PROVIDER) {
      return { provider: YYDS_MAIL_PROVIDER, label: 'YYDS Mail' };
    }
    if (provider === '163') {
      return {
        source: 'mail-163',
        url: `https://mail.163.com${NETEASE_LIST_PATH}`,
        label: '163 Mail',
      };
    }
    if (provider === '163-vip') {
      return {
        source: 'mail-163',
        url: `https://webmail.vip.163.com${NETEASE_LIST_PATH}`,
        label: '163 VIP Mail',
      };
    }
    if (provider === '126') {
      return {
        source: 'mail-163',
        url: `https://mail.126.com${NETEASE_LIST_PATH}`,
        label: '126 Mail',
      };
    }
    if (provider === 'inbucket') {
      const host = normalizeInbucketOrigin(state.inbucketHost);
      const mailbox = String(state.inbucketMailbox || '').trim();
      if (!host) {
        return { error: 'Inbucket host address is empty or invalid.' };
      }
      if (!mailbox) {
        return { error: 'Inbucket mailbox name is empty.' };
      }
      return {
        source: 'inbucket-mail',
        url: `${host}/m/${encodeURIComponent(mailbox)}/`,
        label: `Inbucket Mail (${mailbox})`,
        navigateOnReuse: true,
        inject: ['content/activation-utils.js', 'content/utils.js', 'content/inbucket-mail.js'],
        injectSource: 'inbucket-mail',
      };
    }
    return { source: 'qq-mail', url: 'https://wx.mail.qq.com/', label: 'QQ Mail' };
  }

  return {
    GMAIL_PROVIDER,
    HOTMAIL_PROVIDER,
    YYDS_MAIL_PROVIDER,
    getIcloudForwardMailConfig,
    getIcloudForwardMailProviderOptions,
    getMailProviderConfig,
    normalizeIcloudForwardMailProvider,
    normalizeIcloudTargetMailboxType,
    normalizeMailProvider,
  };
});
