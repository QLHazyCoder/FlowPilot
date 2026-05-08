// sidepanel/sidepanel.js — Side Panel logic

const STATUS_ICONS = {
  pending: '',
  running: '',
  completed: '\u2713',  // ✓
  failed: '\u2717',     // ✗
  stopped: '\u25A0',    // ■
  manual_completed: '跳',
  skipped: '跳',
};

const logArea = document.getElementById('log-area');
const btnOpenAccountRecords = document.getElementById('btn-open-account-records');
const accountRecordsOverlay = document.getElementById('account-records-overlay');
const accountRecordsMeta = document.getElementById('account-records-meta');
const accountRecordsStats = document.getElementById('account-records-stats');
const accountRecordsList = document.getElementById('account-records-list');
const accountRecordsPageLabel = document.getElementById('account-records-page-label');
const btnAccountRecordsPrev = document.getElementById('btn-account-records-prev');
const btnAccountRecordsNext = document.getElementById('btn-account-records-next');
const btnCloseAccountRecords = document.getElementById('btn-close-account-records');
const btnClearAccountRecords = document.getElementById('btn-clear-account-records');
const btnToggleAccountRecordsSelection = document.getElementById('btn-toggle-account-records-selection');
const btnDeleteSelectedAccountRecords = document.getElementById('btn-delete-selected-account-records');
const updateSection = document.getElementById('update-section');
const btnRepoHome = document.getElementById('btn-repo-home');
const extensionUpdateStatus = document.getElementById('extension-update-status');
const extensionVersionMeta = document.getElementById('extension-version-meta');
const btnReleaseLog = document.getElementById('btn-release-log');
const updateCardVersion = document.getElementById('update-card-version');
const updateCardSummary = document.getElementById('update-card-summary');
const updateReleaseList = document.getElementById('update-release-list');
const btnIgnoreRelease = document.getElementById('btn-ignore-release');
const btnOpenRelease = document.getElementById('btn-open-release');
const settingsCard = document.getElementById('settings-card');
const contributionModePanel = document.getElementById('contribution-mode-panel');
const contributionModeBadge = document.getElementById('contribution-mode-badge');
const contributionModeText = document.getElementById('contribution-mode-text');
const inputContributionNickname = document.getElementById('input-contribution-nickname');
const inputContributionQq = document.getElementById('input-contribution-qq');
const contributionOauthStatus = document.getElementById('contribution-oauth-status');
const contributionCallbackStatus = document.getElementById('contribution-callback-status');
const contributionModeSummary = document.getElementById('contribution-mode-summary');
const btnStartContribution = document.getElementById('btn-start-contribution');
const btnOpenContributionUpload = document.getElementById('btn-open-contribution-upload');
const btnExitContributionMode = document.getElementById('btn-exit-contribution-mode');
const displayOauthUrl = document.getElementById('display-oauth-url');
const displayLocalhostUrl = document.getElementById('display-localhost-url');
const displayStatus = document.getElementById('display-status');
const statusBar = document.getElementById('status-bar');
const inputEmail = document.getElementById('input-email');
const inputSignupPhone = document.getElementById('input-signup-phone');
const inputPassword = document.getElementById('input-password');
const btnToggleVpsUrl = document.getElementById('btn-toggle-vps-url');
const btnToggleVpsPassword = document.getElementById('btn-toggle-vps-password');
const btnFetchEmail = document.getElementById('btn-fetch-email');
const btnTogglePassword = document.getElementById('btn-toggle-password');
const btnSaveSettings = document.getElementById('btn-save-settings');
const btnStop = document.getElementById('btn-stop');
const btnReset = document.getElementById('btn-reset');
const btnContributionMode = document.getElementById('btn-contribution-mode');
const contributionUpdateLayer = document.getElementById('contribution-update-layer');
const contributionUpdateHint = document.getElementById('contribution-update-hint');
const contributionUpdateHintText = document.getElementById('contribution-update-hint-text');
const btnDismissContributionUpdateHint = document.getElementById('btn-dismiss-contribution-update-hint');
const stepsProgress = document.getElementById('steps-progress');
const btnAutoRun = document.getElementById('btn-auto-run');
const btnAutoContinue = document.getElementById('btn-auto-continue');
const autoContinueBar = document.getElementById('auto-continue-bar');
const autoScheduleBar = document.getElementById('auto-schedule-bar');
const autoScheduleTitle = document.getElementById('auto-schedule-title');
const autoScheduleMeta = document.getElementById('auto-schedule-meta');
const btnAutoRunNow = document.getElementById('btn-auto-run-now');
const btnAutoCancelSchedule = document.getElementById('btn-auto-cancel-schedule');
const btnClearLog = document.getElementById('btn-clear-log');
const configMenuShell = document.getElementById('config-menu-shell');
const btnConfigMenu = document.getElementById('btn-config-menu');
const configMenu = document.getElementById('config-menu');
const btnExportSettings = document.getElementById('btn-export-settings');
const btnImportSettings = document.getElementById('btn-import-settings');
const inputImportSettingsFile = document.getElementById('input-import-settings-file');
const selectPanelMode = document.getElementById('select-panel-mode');
const rowVpsUrl = document.getElementById('row-vps-url');
const inputVpsUrl = document.getElementById('input-vps-url');
const rowVpsPassword = document.getElementById('row-vps-password');
const inputVpsPassword = document.getElementById('input-vps-password');
const rowLocalCpaStep9Mode = document.getElementById('row-local-cpa-step9-mode');
const localCpaStep9ModeButtons = Array.from(document.querySelectorAll('[data-local-cpa-step9-mode]'));
const rowSub2ApiUrl = document.getElementById('row-sub2api-url');
const inputSub2ApiUrl = document.getElementById('input-sub2api-url');
const rowSub2ApiEmail = document.getElementById('row-sub2api-email');
const inputSub2ApiEmail = document.getElementById('input-sub2api-email');
const rowSub2ApiPassword = document.getElementById('row-sub2api-password');
const inputSub2ApiPassword = document.getElementById('input-sub2api-password');
const rowSub2ApiGroup = document.getElementById('row-sub2api-group');
const inputSub2ApiGroup = document.getElementById('input-sub2api-group');
const sub2ApiGroupPickerRoot = document.getElementById('sub2api-group-picker');
const btnSub2ApiGroupMenu = document.getElementById('btn-sub2api-group-menu');
const sub2ApiGroupCurrent = document.getElementById('sub2api-group-current');
const sub2ApiGroupMenu = document.getElementById('sub2api-group-menu');
const btnAddSub2ApiGroup = document.getElementById('btn-add-sub2api-group');
const rowSub2ApiAccountPriority = document.getElementById('row-sub2api-account-priority');
const inputSub2ApiAccountPriority = document.getElementById('input-sub2api-account-priority');
const rowSub2ApiDefaultProxy = document.getElementById('row-sub2api-default-proxy');
const inputSub2ApiDefaultProxy = document.getElementById('input-sub2api-default-proxy');
const rowIpProxyEnabled = document.getElementById('row-ip-proxy-enabled');
const inputIpProxyEnabled = document.getElementById('input-ip-proxy-enabled');
const btnToggleIpProxySection = document.getElementById('btn-toggle-ip-proxy-section');
const ipProxyEnabledStatus = document.getElementById('ip-proxy-enabled-status');
const ipProxyEnabledStatusDot = document.getElementById('ip-proxy-enabled-status-dot');
const ipProxyEnabledStatusText = document.getElementById('ip-proxy-enabled-status-text');
const ipProxyEnabledButtons = Array.from(document.querySelectorAll('[data-ip-proxy-enabled]'));
const rowIpProxyFold = document.getElementById('row-ip-proxy-fold');
const rowIpProxyPromo = document.getElementById('row-ip-proxy-promo');
const ipProxyPromo = document.getElementById('ip-proxy-promo');
const ipProxyPromoText = document.getElementById('ip-proxy-promo-text');
const rowIpProxyService = document.getElementById('row-ip-proxy-service');
const selectIpProxyService = document.getElementById('select-ip-proxy-service');
const btnIpProxyServiceLogin = document.getElementById('btn-ip-proxy-service-login');
const rowIpProxyMode = document.getElementById('row-ip-proxy-mode');
const ipProxyModeButtons = Array.from(document.querySelectorAll('[data-ip-proxy-mode]'));
const rowIpProxyLayout = document.getElementById('row-ip-proxy-layout');
const ipProxyLayout = document.getElementById('ip-proxy-layout');
const ipProxyApiPanel = document.getElementById('ip-proxy-api-panel');
const rowIpProxyApiUrl = document.getElementById('row-ip-proxy-api-url');
const inputIpProxyApiUrl = document.getElementById('input-ip-proxy-api-url');
const btnToggleIpProxyApiUrl = document.getElementById('btn-toggle-ip-proxy-api-url');
const rowIpProxyAccountList = document.getElementById('row-ip-proxy-account-list');
const inputIpProxyAccountList = document.getElementById('input-ip-proxy-account-list');
const rowIpProxyAccountSessionPrefix = document.getElementById('row-ip-proxy-account-session-prefix');
const inputIpProxyAccountSessionPrefix = document.getElementById('input-ip-proxy-account-session-prefix');
const rowIpProxyAccountLifeMinutes = document.getElementById('row-ip-proxy-account-life-minutes');
const inputIpProxyAccountLifeMinutes = document.getElementById('input-ip-proxy-account-life-minutes');
const rowIpProxyPoolTargetCount = document.getElementById('row-ip-proxy-pool-target-count');
const inputIpProxyPoolTargetCount = document.getElementById('input-ip-proxy-pool-target-count');
const rowIpProxyAutoSyncEnabled = document.getElementById('row-ip-proxy-auto-sync-enabled');
const inputIpProxyAutoSyncEnabled = document.getElementById('input-ip-proxy-auto-sync-enabled');
const rowIpProxyAutoSyncInterval = document.getElementById('row-ip-proxy-auto-sync-interval');
const inputIpProxyAutoSyncIntervalMinutes = document.getElementById('input-ip-proxy-auto-sync-interval-minutes');
const rowIpProxyHost = document.getElementById('row-ip-proxy-host');
const inputIpProxyHost = document.getElementById('input-ip-proxy-host');
const rowIpProxyPort = document.getElementById('row-ip-proxy-port');
const inputIpProxyPort = document.getElementById('input-ip-proxy-port');
const rowIpProxyProtocol = document.getElementById('row-ip-proxy-protocol');
const selectIpProxyProtocol = document.getElementById('select-ip-proxy-protocol');
const rowIpProxyUsername = document.getElementById('row-ip-proxy-username');
const inputIpProxyUsername = document.getElementById('input-ip-proxy-username');
const btnToggleIpProxyUsername = document.getElementById('btn-toggle-ip-proxy-username');
const rowIpProxyPassword = document.getElementById('row-ip-proxy-password');
const inputIpProxyPassword = document.getElementById('input-ip-proxy-password');
const btnToggleIpProxyPassword = document.getElementById('btn-toggle-ip-proxy-password');
const rowIpProxyRegion = document.getElementById('row-ip-proxy-region');
const inputIpProxyRegion = document.getElementById('input-ip-proxy-region');
const rowIpProxyActions = document.getElementById('row-ip-proxy-actions');
const ipProxyActionButtons = document.getElementById('ip-proxy-action-buttons');
const ipProxyActionHint = document.getElementById('ip-proxy-action-hint');
const btnIpProxyRefresh = document.getElementById('btn-ip-proxy-refresh');
const btnIpProxyNext = document.getElementById('btn-ip-proxy-next');
const btnIpProxyChange = document.getElementById('btn-ip-proxy-change');
const btnIpProxyProbe = document.getElementById('btn-ip-proxy-probe');
const btnIpProxyCheckIp = document.getElementById('btn-ip-proxy-check-ip');
const ipProxyCurrent = document.getElementById('ip-proxy-current');
const rowIpProxyRuntimeStatus = document.getElementById('row-ip-proxy-runtime-status');
const ipProxyRuntimeStatus = document.getElementById('ip-proxy-runtime-status');
const ipProxyRuntimeDot = document.getElementById('ip-proxy-runtime-dot');
const ipProxyRuntimeText = document.getElementById('ip-proxy-runtime-text');
const ipProxyRuntimeDetails = document.getElementById('ip-proxy-runtime-details');
const ipProxyRuntimeDetailsText = document.getElementById('ip-proxy-runtime-details-text');
const rowCodex2ApiUrl = document.getElementById('row-codex2api-url');
const inputCodex2ApiUrl = document.getElementById('input-codex2api-url');
const rowCodex2ApiAdminKey = document.getElementById('row-codex2api-admin-key');
const inputCodex2ApiAdminKey = document.getElementById('input-codex2api-admin-key');
const rowCustomPassword = document.getElementById('row-custom-password');
const rowPlusMode = document.getElementById('row-plus-mode');
const inputPlusModeEnabled = document.getElementById('input-plus-mode-enabled');
const rowPlusPaymentMethod = document.getElementById('row-plus-payment-method');
const selectPlusPaymentMethod = document.getElementById('select-plus-payment-method');
const btnGpcCardKeyPurchase = document.getElementById('btn-gpc-card-key-purchase');
const plusPaymentMethodCaption = document.getElementById('plus-payment-method-caption');
const rowPayPalAccount = document.getElementById('row-paypal-account');
const selectPayPalAccount = document.getElementById('select-paypal-account');
const payPalAccountPickerRoot = document.getElementById('paypal-account-picker');
const btnPayPalAccountMenu = document.getElementById('btn-paypal-account-menu');
const payPalAccountCurrent = document.getElementById('paypal-account-current');
const payPalAccountMenu = document.getElementById('paypal-account-menu');
const btnAddPayPalAccount = document.getElementById('btn-add-paypal-account');
const rowGpcHelperApi = document.getElementById('row-gpc-helper-api');
const inputGpcHelperApi = document.getElementById('input-gpc-helper-api');
const btnGpcHelperConvertApiKey = document.getElementById('btn-gpc-helper-convert-api-key');
const rowGpcHelperCardKey = document.getElementById('row-gpc-helper-card-key');
const inputGpcHelperCardKey = document.getElementById('input-gpc-helper-card-key');
const btnToggleGpcHelperCardKey = document.getElementById('btn-toggle-gpc-helper-card-key');
const btnGpcHelperBalance = document.getElementById('btn-gpc-helper-balance');
const displayGpcHelperBalance = document.getElementById('display-gpc-helper-balance');
const rowGpcHelperPhoneMode = document.getElementById('row-gpc-helper-phone-mode');
const selectGpcHelperPhoneMode = document.getElementById('select-gpc-helper-phone-mode');
const rowGpcHelperCountryCode = document.getElementById('row-gpc-helper-country-code');
const selectGpcHelperCountryCode = document.getElementById('select-gpc-helper-country-code');
const rowGpcHelperPhone = document.getElementById('row-gpc-helper-phone');
const inputGpcHelperPhone = document.getElementById('input-gpc-helper-phone');
const rowGpcHelperOtpChannel = document.getElementById('row-gpc-helper-otp-channel');
const selectGpcHelperOtpChannel = document.getElementById('select-gpc-helper-otp-channel');
const rowGpcHelperLocalSmsEnabled = document.getElementById('row-gpc-helper-local-sms-enabled');
const inputGpcHelperLocalSmsEnabled = document.getElementById('input-gpc-helper-local-sms-enabled');
const rowGpcHelperLocalSmsUrl = document.getElementById('row-gpc-helper-local-sms-url');
const inputGpcHelperLocalSmsUrl = document.getElementById('input-gpc-helper-local-sms-url');
const rowGpcHelperPin = document.getElementById('row-gpc-helper-pin');
const inputGpcHelperPin = document.getElementById('input-gpc-helper-pin');
const btnToggleGpcHelperPin = document.getElementById('btn-toggle-gpc-helper-pin');
const rowGoPayCountryCode = document.getElementById('row-gopay-country-code');
const selectGoPayCountryCode = document.getElementById('select-gopay-country-code');
const rowGoPayPhone = document.getElementById('row-gopay-phone');
const inputGoPayPhone = document.getElementById('input-gopay-phone');
const rowGoPayOtp = document.getElementById('row-gopay-otp');
const inputGoPayOtp = document.getElementById('input-gopay-otp');
const rowGoPayPin = document.getElementById('row-gopay-pin');
const inputGoPayPin = document.getElementById('input-gopay-pin');
const selectMailProvider = document.getElementById('select-mail-provider');
const btnMailLogin = document.getElementById('btn-mail-login');
const rowCustomMailProviderPool = document.getElementById('row-custom-mail-provider-pool');
const inputCustomMailProviderPool = document.getElementById('input-custom-mail-provider-pool');
const rowMail2925Mode = document.getElementById('row-mail-2925-mode');
const rowMail2925PoolSettings = document.getElementById('row-mail2925-pool-settings');
const mail2925ModeButtons = Array.from(document.querySelectorAll('[data-mail2925-mode]'));
const rowEmailGenerator = document.getElementById('row-email-generator');
const selectEmailGenerator = document.getElementById('select-email-generator');
const rowCustomEmailPool = document.getElementById('row-custom-email-pool');
const inputCustomEmailPool = document.getElementById('input-custom-email-pool');
const btnCustomEmailPoolRefresh = document.getElementById('btn-custom-email-pool-refresh');
const btnCustomEmailPoolClearUsed = document.getElementById('btn-custom-email-pool-clear-used');
const btnCustomEmailPoolDeleteAll = document.getElementById('btn-custom-email-pool-delete-all');
const inputCustomEmailPoolImport = document.getElementById('input-custom-email-pool-import');
const btnCustomEmailPoolImport = document.getElementById('btn-custom-email-pool-import');
const customEmailPoolSummary = document.getElementById('custom-email-pool-summary');
const inputCustomEmailPoolSearch = document.getElementById('input-custom-email-pool-search');
const selectCustomEmailPoolFilter = document.getElementById('select-custom-email-pool-filter');
const checkboxCustomEmailPoolSelectAll = document.getElementById('checkbox-custom-email-pool-select-all');
const customEmailPoolSelectionSummary = document.getElementById('custom-email-pool-selection-summary');
const btnCustomEmailPoolBulkUsed = document.getElementById('btn-custom-email-pool-bulk-used');
const btnCustomEmailPoolBulkUnused = document.getElementById('btn-custom-email-pool-bulk-unused');
const btnCustomEmailPoolBulkEnable = document.getElementById('btn-custom-email-pool-bulk-enable');
const btnCustomEmailPoolBulkDisable = document.getElementById('btn-custom-email-pool-bulk-disable');
const btnCustomEmailPoolBulkDelete = document.getElementById('btn-custom-email-pool-bulk-delete');
const customEmailPoolList = document.getElementById('custom-email-pool-list');
const rowTempEmailBaseUrl = document.getElementById('row-temp-email-base-url');
const inputTempEmailBaseUrl = document.getElementById('input-temp-email-base-url');
const rowTempEmailAdminAuth = document.getElementById('row-temp-email-admin-auth');
const inputTempEmailAdminAuth = document.getElementById('input-temp-email-admin-auth');
const rowTempEmailCustomAuth = document.getElementById('row-temp-email-custom-auth');
const inputTempEmailCustomAuth = document.getElementById('input-temp-email-custom-auth');
const rowTempEmailReceiveMailbox = document.getElementById('row-temp-email-receive-mailbox');
const inputTempEmailReceiveMailbox = document.getElementById('input-temp-email-receive-mailbox');
const rowTempEmailRandomSubdomainToggle = document.getElementById('row-temp-email-random-subdomain-toggle');
const inputTempEmailUseRandomSubdomain = document.getElementById('input-temp-email-use-random-subdomain');
const rowTempEmailDomain = document.getElementById('row-temp-email-domain');
const selectTempEmailDomain = document.getElementById('select-temp-email-domain');
const tempEmailDomainPickerRoot = document.getElementById('temp-email-domain-picker');
const btnTempEmailDomainMenu = document.getElementById('btn-temp-email-domain-menu');
const tempEmailDomainCurrent = document.getElementById('temp-email-domain-current');
const tempEmailDomainMenu = document.getElementById('temp-email-domain-menu');
const inputTempEmailDomain = document.getElementById('input-temp-email-domain');
const btnTempEmailDomainMode = document.getElementById('btn-temp-email-domain-mode');
const cloudflareTempEmailSection = document.getElementById('cloudflare-temp-email-section');
const btnCloudflareTempEmailUsageGuide = document.getElementById('btn-cloudflare-temp-email-usage-guide');
const btnCloudflareTempEmailGithub = document.getElementById('btn-cloudflare-temp-email-github');
const cloudMailSection = document.getElementById('cloud-mail-section');
const rowCloudMailBaseUrl = document.getElementById('row-cloud-mail-base-url');
const rowCloudMailAdminEmail = document.getElementById('row-cloud-mail-admin-email');
const rowCloudMailAdminPassword = document.getElementById('row-cloud-mail-admin-password');
const rowCloudMailReceiveMailbox = document.getElementById('row-cloud-mail-receive-mailbox');
const rowCloudMailDomain = document.getElementById('row-cloud-mail-domain');
const inputCloudMailBaseUrl = document.getElementById('input-cloud-mail-base-url');
const inputCloudMailAdminEmail = document.getElementById('input-cloud-mail-admin-email');
const inputCloudMailAdminPassword = document.getElementById('input-cloud-mail-admin-password');
const inputCloudMailReceiveMailbox = document.getElementById('input-cloud-mail-receive-mailbox');
const inputCloudMailDomain = document.getElementById('input-cloud-mail-domain');
const hotmailSection = document.getElementById('hotmail-section');
const mail2925Section = document.getElementById('mail2925-section');
const luckmailSection = document.getElementById('luckmail-section');
const icloudSection = document.getElementById('icloud-section');
const icloudSummary = document.getElementById('icloud-summary');
const icloudList = document.getElementById('icloud-list');
const icloudLoginHelp = document.getElementById('icloud-login-help');
const icloudLoginHelpTitle = document.getElementById('icloud-login-help-title');
const icloudLoginHelpText = document.getElementById('icloud-login-help-text');
const btnIcloudLoginDone = document.getElementById('btn-icloud-login-done');
const btnIcloudRefresh = document.getElementById('btn-icloud-refresh');
const btnIcloudDeleteUsed = document.getElementById('btn-icloud-delete-used');
const selectIcloudHostPreference = document.getElementById('select-icloud-host-preference');
const rowIcloudTargetMailboxType = document.getElementById('row-icloud-target-mailbox-type');
const selectIcloudTargetMailboxType = document.getElementById('select-icloud-target-mailbox-type');
const rowIcloudForwardMailProvider = document.getElementById('row-icloud-forward-mail-provider');
const selectIcloudForwardMailProvider = document.getElementById('select-icloud-forward-mail-provider');
const selectIcloudFetchMode = document.getElementById('select-icloud-fetch-mode');
const checkboxAutoDeleteIcloud = document.getElementById('checkbox-auto-delete-icloud');
const inputIcloudSearch = document.getElementById('input-icloud-search');
const selectIcloudFilter = document.getElementById('select-icloud-filter');
const checkboxIcloudSelectAll = document.getElementById('checkbox-icloud-select-all');
const icloudSelectionSummary = document.getElementById('icloud-selection-summary');
const btnIcloudBulkUsed = document.getElementById('btn-icloud-bulk-used');
const btnIcloudBulkUnused = document.getElementById('btn-icloud-bulk-unused');
const btnIcloudBulkPreserve = document.getElementById('btn-icloud-bulk-preserve');
const btnIcloudBulkUnpreserve = document.getElementById('btn-icloud-bulk-unpreserve');
const btnIcloudBulkDelete = document.getElementById('btn-icloud-bulk-delete');
const rowHotmailServiceMode = document.getElementById('row-hotmail-service-mode');
const hotmailServiceModeButtons = Array.from(document.querySelectorAll('[data-hotmail-service-mode]'));
const rowHotmailRemoteBaseUrl = document.getElementById('row-hotmail-remote-base-url');
const inputHotmailRemoteBaseUrl = document.getElementById('input-hotmail-remote-base-url');
const rowHotmailLocalBaseUrl = document.getElementById('row-hotmail-local-base-url');
const inputHotmailLocalBaseUrl = document.getElementById('input-hotmail-local-base-url');
const inputHotmailEmail = document.getElementById('input-hotmail-email');
const inputHotmailClientId = document.getElementById('input-hotmail-client-id');
const inputHotmailPassword = document.getElementById('input-hotmail-password');
const inputHotmailRefreshToken = document.getElementById('input-hotmail-refresh-token');
const inputHotmailImport = document.getElementById('input-hotmail-import');
const inputHotmailSearch = document.getElementById('input-hotmail-search');
const selectHotmailFilter = document.getElementById('select-hotmail-filter');
const btnAddHotmailAccount = document.getElementById('btn-add-hotmail-account');
const btnImportHotmailAccounts = document.getElementById('btn-import-hotmail-accounts');
const btnToggleHotmailForm = document.getElementById('btn-toggle-hotmail-form');
const btnHotmailUsageGuide = document.getElementById('btn-hotmail-usage-guide');
const btnClearUsedHotmailAccounts = document.getElementById('btn-clear-used-hotmail-accounts');
const btnDeleteAllHotmailAccounts = document.getElementById('btn-delete-all-hotmail-accounts');
const btnToggleHotmailList = document.getElementById('btn-toggle-hotmail-list');
const hotmailFormShell = document.getElementById('hotmail-form-shell');
const hotmailListShell = document.getElementById('hotmail-list-shell');
const hotmailAccountsList = document.getElementById('hotmail-accounts-list');
const inputMail2925Email = document.getElementById('input-mail2925-email');
const inputMail2925Password = document.getElementById('input-mail2925-password');
const inputMail2925Import = document.getElementById('input-mail2925-import');
const inputMail2925Search = document.getElementById('input-mail2925-search');
const selectMail2925Filter = document.getElementById('select-mail2925-filter');
const btnAddMail2925Account = document.getElementById('btn-add-mail2925-account');
const btnToggleMail2925Form = document.getElementById('btn-toggle-mail2925-form');
const btnImportMail2925Accounts = document.getElementById('btn-import-mail2925-accounts');
const btnDeleteAllMail2925Accounts = document.getElementById('btn-delete-all-mail2925-accounts');
const btnToggleMail2925List = document.getElementById('btn-toggle-mail2925-list');
const mail2925FormShell = document.getElementById('mail2925-form-shell');
const mail2925ListShell = document.getElementById('mail2925-list-shell');
const mail2925AccountsList = document.getElementById('mail2925-accounts-list');
const inputLuckmailApiKey = document.getElementById('input-luckmail-api-key');
const inputLuckmailBaseUrl = document.getElementById('input-luckmail-base-url');
const selectLuckmailEmailType = document.getElementById('select-luckmail-email-type');
const inputLuckmailDomain = document.getElementById('input-luckmail-domain');
const btnLuckmailRefresh = document.getElementById('btn-luckmail-refresh');
const btnLuckmailDisableUsed = document.getElementById('btn-luckmail-disable-used');
const luckmailSummary = document.getElementById('luckmail-summary');
const inputLuckmailSearch = document.getElementById('input-luckmail-search');
const selectLuckmailFilter = document.getElementById('select-luckmail-filter');
const checkboxLuckmailSelectAll = document.getElementById('checkbox-luckmail-select-all');
const luckmailSelectionSummary = document.getElementById('luckmail-selection-summary');
const btnLuckmailBulkUsed = document.getElementById('btn-luckmail-bulk-used');
const btnLuckmailBulkUnused = document.getElementById('btn-luckmail-bulk-unused');
const btnLuckmailBulkPreserve = document.getElementById('btn-luckmail-bulk-preserve');
const btnLuckmailBulkUnpreserve = document.getElementById('btn-luckmail-bulk-unpreserve');
const btnLuckmailBulkDisable = document.getElementById('btn-luckmail-bulk-disable');
const btnLuckmailBulkEnable = document.getElementById('btn-luckmail-bulk-enable');
const luckmailList = document.getElementById('luckmail-list');
const rowEmailPrefix = document.getElementById('row-email-prefix');
const labelEmailPrefix = document.getElementById('label-email-prefix');
const inputEmailPrefix = document.getElementById('input-email-prefix');
const selectMail2925PoolAccount = document.getElementById('select-mail2925-pool-account');
const inputMail2925UseAccountPool = document.getElementById('input-mail2925-use-account-pool');
const labelMail2925UseAccountPool = document.getElementById('label-mail2925-use-account-pool');
const rowInbucketHost = document.getElementById('row-inbucket-host');
const inputInbucketHost = document.getElementById('input-inbucket-host');
const rowInbucketMailbox = document.getElementById('row-inbucket-mailbox');
const inputInbucketMailbox = document.getElementById('input-inbucket-mailbox');
const rowCfDomain = document.getElementById('row-cf-domain');
const selectCfDomain = document.getElementById('select-cf-domain');
const cfDomainPickerRoot = document.getElementById('cf-domain-picker');
const btnCfDomainMenu = document.getElementById('btn-cf-domain-menu');
const cfDomainCurrent = document.getElementById('cf-domain-current');
const cfDomainMenu = document.getElementById('cf-domain-menu');
const inputCfDomain = document.getElementById('input-cf-domain');
const btnCfDomainMode = document.getElementById('btn-cf-domain-mode');
const inputRunCount = document.getElementById('input-run-count');
const inputAutoSkipFailures = document.getElementById('input-auto-skip-failures');
const inputAutoSkipFailuresThreadIntervalMinutes = document.getElementById('input-auto-skip-failures-thread-interval-minutes');
const inputStep6CookieCleanupEnabled = document.getElementById('input-step6-cookie-cleanup-enabled');
const inputAutoDelayEnabled = document.getElementById('input-auto-delay-enabled');
const inputAutoDelayMinutes = document.getElementById('input-auto-delay-minutes');
const inputAutoStepDelaySeconds = document.getElementById('input-auto-step-delay-seconds');
const inputOperationDelayEnabled = document.getElementById('input-operation-delay-enabled');
const inputOAuthFlowTimeoutEnabled = document.getElementById('input-oauth-flow-timeout-enabled');
const inputVerificationResendCount = document.getElementById('input-verification-resend-count');
const rowPhoneVerificationEnabled = document.getElementById('row-phone-verification-enabled');
const btnTogglePhoneVerificationSection = document.getElementById('btn-toggle-phone-verification-section');
const rowPhoneVerificationFold = document.getElementById('row-phone-verification-fold');
const inputPhoneVerificationEnabled = document.getElementById('input-phone-verification-enabled');
const rowSignupMethod = document.getElementById('row-signup-method');
const rowSignupPhone = document.getElementById('row-signup-phone');
const signupMethodButtons = Array.from(document.querySelectorAll('[data-signup-method]'));
const selectPhoneSmsProvider = document.getElementById('select-phone-sms-provider');
const rowHeroSmsPlatform = document.getElementById('row-hero-sms-platform');
const rowHeroSmsCountry = document.getElementById('row-hero-sms-country');
const rowHeroSmsCountryFallback = document.getElementById('row-hero-sms-country-fallback');
const rowHeroSmsAcquirePriority = document.getElementById('row-hero-sms-acquire-priority');
const rowHeroSmsApiKey = document.getElementById('row-hero-sms-api-key');
const rowHeroSmsMaxPrice = document.getElementById('row-hero-sms-max-price');
const rowPhoneSmsProvider = document.getElementById('row-phone-sms-provider');
const rowPhoneSmsProviderOrder = document.getElementById('row-phone-sms-provider-order');
const rowPhoneSmsProviderOrderActions = document.getElementById('row-phone-sms-provider-order-actions');
const rowFiveSimApiKey = document.getElementById('row-five-sim-api-key');
const rowFiveSimCountry = document.getElementById('row-five-sim-country');
const rowFiveSimCountryFallback = document.getElementById('row-five-sim-country-fallback');
const rowFiveSimOperator = document.getElementById('row-five-sim-operator');
const rowFiveSimProduct = document.getElementById('row-five-sim-product');
const rowNexSmsApiKey = document.getElementById('row-nex-sms-api-key');
const rowNexSmsCountry = document.getElementById('row-nex-sms-country');
const rowNexSmsCountryFallback = document.getElementById('row-nex-sms-country-fallback');
const rowNexSmsServiceCode = document.getElementById('row-nex-sms-service-code');
const rowHeroSmsRuntimePair = document.getElementById('row-hero-sms-runtime-pair');
const rowHeroSmsCurrentNumber = document.getElementById('row-hero-sms-current-number');
const rowHeroSmsCurrentCountdown = document.getElementById('row-hero-sms-current-countdown');
const rowHeroSmsPriceTiers = document.getElementById('row-hero-sms-price-tiers');
const rowHeroSmsCurrentCode = document.getElementById('row-hero-sms-current-code');
const rowHeroSmsPreferredActivation = document.getElementById('row-hero-sms-preferred-activation');
const rowPhoneCodeSettingsGroup = document.getElementById('row-phone-code-settings-group');
const rowPhoneVerificationResendCount = document.getElementById('row-phone-verification-resend-count');
const rowPhoneReplacementLimit = document.getElementById('row-phone-replacement-limit');
const rowPhoneCodeWaitSeconds = document.getElementById('row-phone-code-wait-seconds');
const rowPhoneCodeTimeoutWindows = document.getElementById('row-phone-code-timeout-windows');
const rowPhoneCodePollIntervalSeconds = document.getElementById('row-phone-code-poll-interval-seconds');
const rowPhoneCodePollMaxRounds = document.getElementById('row-phone-code-poll-max-rounds');
const rowFreePhoneReuseEnabled = document.getElementById('row-free-phone-reuse-enabled');
const rowFreePhoneReuseAutoEnabled = document.getElementById('row-free-phone-reuse-auto-enabled');
const rowFreeReusablePhone = document.getElementById('row-free-reusable-phone');
const inputHeroSmsApiKey = document.getElementById('input-hero-sms-api-key');
const btnToggleHeroSmsApiKey = document.getElementById('btn-toggle-hero-sms-api-key');
const inputFiveSimApiKey = document.getElementById('input-five-sim-api-key');
const btnToggleFiveSimApiKey = document.getElementById('btn-toggle-five-sim-api-key');
const inputFiveSimOperator = document.getElementById('input-five-sim-operator');
const inputFiveSimProduct = document.getElementById('input-five-sim-product');
const inputNexSmsApiKey = document.getElementById('input-nex-sms-api-key');
const btnToggleNexSmsApiKey = document.getElementById('btn-toggle-nex-sms-api-key');
const inputNexSmsServiceCode = document.getElementById('input-nex-sms-service-code');
const inputHeroSmsMaxPrice = document.getElementById('input-hero-sms-max-price');
const inputHeroSmsPreferredPrice = document.getElementById('input-hero-sms-preferred-price');
const inputPhoneReplacementLimit = document.getElementById('input-phone-replacement-limit');
const inputPhoneCodeWaitSeconds = document.getElementById('input-phone-code-wait-seconds');
const inputPhoneCodeTimeoutWindows = document.getElementById('input-phone-code-timeout-windows');
const inputPhoneCodePollIntervalSeconds = document.getElementById('input-phone-code-poll-interval-seconds');
const inputPhoneCodePollMaxRounds = document.getElementById('input-phone-code-poll-max-rounds');
const inputHeroSmsReuseEnabled = document.getElementById('input-hero-sms-reuse-enabled');
const inputFreePhoneReuseEnabled = document.getElementById('input-free-phone-reuse-enabled');
const inputFreePhoneReuseAutoEnabled = document.getElementById('input-free-phone-reuse-auto-enabled');
const inputFreeReusablePhone = document.getElementById('input-free-reusable-phone');
const selectHeroSmsCountry = document.getElementById('select-hero-sms-country');
const selectHeroSmsCountryFallback = document.getElementById('select-hero-sms-country-fallback');
const selectHeroSmsAcquirePriority = document.getElementById('select-hero-sms-acquire-priority');
const selectHeroSmsPreferredActivation = document.getElementById('select-hero-sms-preferred-activation');
const selectFiveSimCountry = document.getElementById('select-five-sim-country');
const heroSmsCountryMenuShell = document.getElementById('hero-sms-country-menu-shell');
const btnHeroSmsCountryMenu = document.getElementById('btn-hero-sms-country-menu');
const heroSmsCountryMenu = document.getElementById('hero-sms-country-menu');
const btnHeroSmsCountryClear = document.getElementById('btn-hero-sms-country-clear');
const fiveSimCountryMenuShell = document.getElementById('five-sim-country-menu-shell');
const btnFiveSimCountryMenu = document.getElementById('btn-five-sim-country-menu');
const fiveSimCountryMenu = document.getElementById('five-sim-country-menu');
const btnFiveSimCountryClear = document.getElementById('btn-five-sim-country-clear');
const selectNexSmsCountry = document.getElementById('select-nex-sms-country');
const nexSmsCountryMenuShell = document.getElementById('nex-sms-country-menu-shell');
const btnNexSmsCountryMenu = document.getElementById('btn-nex-sms-country-menu');
const nexSmsCountryMenu = document.getElementById('nex-sms-country-menu');
const btnNexSmsCountryClear = document.getElementById('btn-nex-sms-country-clear');
const selectPhoneSmsProviderOrder = document.getElementById('select-phone-sms-provider-order');
const phoneSmsProviderOrderMenuShell = document.getElementById('phone-sms-provider-order-menu-shell');
const btnPhoneSmsProviderOrderMenu = document.getElementById('btn-phone-sms-provider-order-menu');
const phoneSmsProviderOrderMenu = document.getElementById('phone-sms-provider-order-menu');
const btnPhoneSmsProviderOrderReset = document.getElementById('btn-phone-sms-provider-order-reset');
const btnHeroSmsPricePreview = document.getElementById('btn-hero-sms-price-preview');
const btnPhoneSmsBalance = document.getElementById('btn-phone-sms-balance');
const displayHeroSmsPlatform = document.getElementById('display-hero-sms-platform');
const displayHeroSmsCurrentNumber = document.getElementById('display-hero-sms-current-number');
const displayHeroSmsCurrentCountdown = document.getElementById('display-hero-sms-current-countdown');
const displayHeroSmsPriceTiers = document.getElementById('display-hero-sms-price-tiers');
const displayPhoneSmsBalance = document.getElementById('display-phone-sms-balance');
const displayHeroSmsCurrentCode = document.getElementById('display-hero-sms-current-code');
const displayFreeReusablePhoneCountry = document.getElementById('display-free-reusable-phone-country');
const displayFreeReusablePhone = document.getElementById('display-free-reusable-phone');
const displayHeroSmsCountryFallbackOrder = document.getElementById('display-hero-sms-country-fallback-order');
const displayFiveSimCountryFallbackOrder = document.getElementById('display-five-sim-country-fallback-order');
const displayNexSmsCountryFallbackOrder = document.getElementById('display-nex-sms-country-fallback-order');
const displayPhoneSmsProviderOrder = document.getElementById('display-phone-sms-provider-order');
const btnSaveFreeReusablePhone = document.getElementById('btn-save-free-reusable-phone');
const btnClearFreeReusablePhone = document.getElementById('btn-clear-free-reusable-phone');
const rowAccountRunHistoryHelperBaseUrl = document.getElementById('row-account-run-history-helper-base-url');
const inputAccountRunHistoryHelperBaseUrl = document.getElementById('input-account-run-history-helper-base-url');
const autoStartModal = document.getElementById('auto-start-modal');
const sharedFormModal = document.getElementById('shared-form-modal');
const sharedFormModalTitle = document.getElementById('shared-form-modal-title');
const btnSharedFormModalClose = document.getElementById('btn-shared-form-modal-close');
const sharedFormModalMessage = document.getElementById('shared-form-modal-message');
const sharedFormModalAlert = document.getElementById('shared-form-modal-alert');
const sharedFormModalFields = document.getElementById('shared-form-modal-fields');
const btnSharedFormModalCancel = document.getElementById('btn-shared-form-modal-cancel');
const btnSharedFormModalConfirm = document.getElementById('btn-shared-form-modal-confirm');
const autoStartTitle = autoStartModal?.querySelector('.modal-title');
const autoStartMessage = document.getElementById('auto-start-message');
const autoStartAlert = document.getElementById('auto-start-alert');
const modalOptionRow = document.getElementById('modal-option-row');
const modalOptionInput = document.getElementById('modal-option-input');
const modalOptionText = document.getElementById('modal-option-text');
const btnAutoStartClose = document.getElementById('btn-auto-start-close');
const btnAutoStartCancel = document.getElementById('btn-auto-start-cancel');
const btnAutoStartRestart = document.getElementById('btn-auto-start-restart');
const btnAutoStartContinue = document.getElementById('btn-auto-start-continue');
const autoHintText = document.querySelector('.auto-hint');
const stepsList = document.querySelector('.steps-list');
const PLUS_PAYMENT_METHOD_PAYPAL = 'paypal';
const PLUS_PAYMENT_METHOD_GOPAY = 'gopay';
const PLUS_PAYMENT_METHOD_GPC_HELPER = 'gpc-helper';
const DEFAULT_GPC_HELPER_API_URL = 'https://gpc.qlhazycoder.top';
const GPC_HELPER_PORTAL_URL = 'https://gpc.qlhazycoder.top/';
const GPC_HELPER_PHONE_MODE_AUTO = 'auto';
const GPC_HELPER_PHONE_MODE_MANUAL = 'manual';
const DEFAULT_PLUS_PAYMENT_METHOD = PLUS_PAYMENT_METHOD_PAYPAL;
const SIGNUP_METHOD_EMAIL = 'email';
const SIGNUP_METHOD_PHONE = 'phone';
const DEFAULT_SIGNUP_METHOD = SIGNUP_METHOD_EMAIL;
let currentPlusModeEnabled = false;
let currentPlusPaymentMethod = DEFAULT_PLUS_PAYMENT_METHOD;
let currentSignupMethod = DEFAULT_SIGNUP_METHOD;
let lastConfirmedOperationDelayEnabled = true;
let heroSmsCountrySelectionOrder = [];
let phoneSmsProviderOrderSelection = [];
let heroSmsCountryMenuSearchKeyword = '';
const heroSmsCountrySearchTextById = new Map();
const phonePreferredActivationOptionMap = new Map();
let phoneRuntimeCountdownTimer = null;
let phoneRuntimeCountdownEndsAt = 0;
let phoneRuntimeCountdownWindowIndex = 0;
let phoneRuntimeCountdownWindowTotal = 0;
let fiveSimCountrySelectionOrder = [];
let fiveSimCountryMenuSearchKeyword = '';
const fiveSimCountrySearchTextByCode = new Map();
let nexSmsCountrySelectionOrder = [];
let nexSmsCountryMenuSearchKeyword = '';
const nexSmsCountrySearchTextById = new Map();
let stepDefinitions = getStepDefinitionsForMode(false, {
  plusPaymentMethod: currentPlusPaymentMethod,
  signupMethod: currentSignupMethod,
});
let STEP_IDS = stepDefinitions.map((step) => Number(step.id)).filter(Number.isFinite);
let STEP_DEFAULT_STATUSES = Object.fromEntries(STEP_IDS.map((stepId) => [stepId, 'pending']));
let SKIPPABLE_STEPS = new Set(STEP_IDS);
const AUTO_DELAY_MIN_MINUTES = 1;
const AUTO_DELAY_MAX_MINUTES = 1440;
const AUTO_DELAY_DEFAULT_MINUTES = 30;
const AUTO_FALLBACK_THREAD_INTERVAL_MIN_MINUTES = 0;
const AUTO_FALLBACK_THREAD_INTERVAL_MAX_MINUTES = 1440;
const AUTO_FALLBACK_THREAD_INTERVAL_DEFAULT_MINUTES = 0;
const AUTO_RUN_MAX_RETRIES_PER_ROUND = 3;
const AUTO_STEP_DELAY_MIN_SECONDS = 0;
const AUTO_STEP_DELAY_MAX_SECONDS = 600;
const VERIFICATION_RESEND_COUNT_MIN = 0;
const VERIFICATION_RESEND_COUNT_MAX = 20;
const DEFAULT_VERIFICATION_RESEND_COUNT = 4;
const PHONE_REPLACEMENT_LIMIT_MIN = 1;
const PHONE_REPLACEMENT_LIMIT_MAX = 20;
const DEFAULT_PHONE_VERIFICATION_REPLACEMENT_LIMIT = 3;
const PHONE_CODE_WAIT_SECONDS_MIN = 15;
const PHONE_CODE_WAIT_SECONDS_MAX = 300;
const DEFAULT_PHONE_CODE_WAIT_SECONDS = 60;
const PHONE_CODE_TIMEOUT_WINDOWS_MIN = 1;
const PHONE_CODE_TIMEOUT_WINDOWS_MAX = 10;
const DEFAULT_PHONE_CODE_TIMEOUT_WINDOWS = 2;
const PHONE_CODE_POLL_INTERVAL_SECONDS_MIN = 1;
const PHONE_CODE_POLL_INTERVAL_SECONDS_MAX = 30;
const DEFAULT_PHONE_CODE_POLL_INTERVAL_SECONDS = 5;
const PHONE_CODE_POLL_MAX_ROUNDS_MIN = 1;
const PHONE_CODE_POLL_MAX_ROUNDS_MAX = 120;
const DEFAULT_PHONE_CODE_POLL_MAX_ROUNDS = 4;
const PHONE_SMS_PROVIDER_HERO = 'hero-sms';
const PHONE_SMS_PROVIDER_FIVE_SIM = '5sim';
const PHONE_SMS_PROVIDER_HERO_SMS = PHONE_SMS_PROVIDER_HERO;
const PHONE_SMS_PROVIDER_NEXSMS = 'nexsms';
const DEFAULT_PHONE_SMS_PROVIDER = PHONE_SMS_PROVIDER_HERO;
const DEFAULT_PHONE_SMS_PROVIDER_ORDER = Object.freeze([
  PHONE_SMS_PROVIDER_HERO,
  PHONE_SMS_PROVIDER_FIVE_SIM,
  PHONE_SMS_PROVIDER_NEXSMS,
]);
const DEFAULT_FIVE_SIM_COUNTRY_ORDER = Object.freeze(['thailand']);
const DEFAULT_FIVE_SIM_OPERATOR = 'any';
const DEFAULT_FIVE_SIM_PRODUCT = 'openai';
const DEFAULT_NEX_SMS_COUNTRY_ORDER = Object.freeze([1]);
const DEFAULT_NEX_SMS_SERVICE_CODE = 'ot';
const HERO_SMS_COUNTRY_SELECTION_MAX = 3;
const DEFAULT_HERO_SMS_REUSE_ENABLED = true;
const HERO_SMS_ACQUIRE_PRIORITY_COUNTRY = 'country';
const HERO_SMS_ACQUIRE_PRIORITY_PRICE = 'price';
const HERO_SMS_ACQUIRE_PRIORITY_PRICE_HIGH = 'price_high';
const DEFAULT_HERO_SMS_ACQUIRE_PRIORITY = HERO_SMS_ACQUIRE_PRIORITY_COUNTRY;
const HERO_SMS_SUPPORTED_COUNTRY_ITEMS = Object.freeze([
  { id: 6, chn: '印度尼西亚', eng: 'Indonesia' },
  { id: 52, chn: '泰国', eng: 'Thailand' },
  { id: 187, chn: '美国（物理)', eng: 'USA' },
  { id: 16, chn: '英国', eng: 'United Kingdom' },
  { id: 151, chn: '日本', eng: 'Japan' },
  { id: 43, chn: '德国', eng: 'Germany' },
  { id: 73, chn: '法国', eng: 'France' },
  { id: 10, chn: '越南', eng: 'Vietnam' },
]);
const HERO_SMS_SUPPORTED_COUNTRY_ID_SET = new Set(HERO_SMS_SUPPORTED_COUNTRY_ITEMS.map((item) => String(item.id)));
const HERO_SMS_FALLBACK_COUNTRY_ITEMS = HERO_SMS_SUPPORTED_COUNTRY_ITEMS;
const FIVE_SIM_COUNTRY_CN_BY_ID = Object.freeze({
  afghanistan: '阿富汗',
  albania: '阿尔巴尼亚',
  algeria: '阿尔及利亚',
  angola: '安哥拉',
  argentina: '阿根廷',
  armenia: '亚美尼亚',
  australia: '澳大利亚',
  austria: '奥地利',
  azerbaijan: '阿塞拜疆',
  bahamas: '巴哈马',
  bahrain: '巴林',
  bangladesh: '孟加拉国',
  belarus: '白俄罗斯',
  belgium: '比利时',
  bolivia: '玻利维亚',
  bosnia: '波黑',
  brazil: '巴西',
  bulgaria: '保加利亚',
  cambodia: '柬埔寨',
  cameroon: '喀麦隆',
  canada: '加拿大',
  chile: '智利',
  china: '中国',
  colombia: '哥伦比亚',
  croatia: '克罗地亚',
  cyprus: '塞浦路斯',
  czech: '捷克',
  denmark: '丹麦',
  egypt: '埃及',
  england: '英国',
  estonia: '爱沙尼亚',
  ethiopia: '埃塞俄比亚',
  finland: '芬兰',
  france: '法国',
  georgia: '格鲁吉亚',
  germany: '德国',
  ghana: '加纳',
  greece: '希腊',
  hongkong: '中国香港',
  hungary: '匈牙利',
  india: '印度',
  indonesia: '印度尼西亚',
  ireland: '爱尔兰',
  israel: '以色列',
  italy: '意大利',
  japan: '日本',
  jordan: '约旦',
  kazakhstan: '哈萨克斯坦',
  kenya: '肯尼亚',
  kyrgyzstan: '吉尔吉斯斯坦',
  laos: '老挝',
  latvia: '拉脱维亚',
  lithuania: '立陶宛',
  malaysia: '马来西亚',
  mexico: '墨西哥',
  moldova: '摩尔多瓦',
  morocco: '摩洛哥',
  myanmar: '缅甸',
  nepal: '尼泊尔',
  netherlands: '荷兰',
  newzealand: '新西兰',
  nigeria: '尼日利亚',
  norway: '挪威',
  pakistan: '巴基斯坦',
  paraguay: '巴拉圭',
  peru: '秘鲁',
  philippines: '菲律宾',
  poland: '波兰',
  portugal: '葡萄牙',
  romania: '罗马尼亚',
  russia: '俄罗斯',
  saudiarabia: '沙特阿拉伯',
  serbia: '塞尔维亚',
  singapore: '新加坡',
  slovakia: '斯洛伐克',
  slovenia: '斯洛文尼亚',
  southafrica: '南非',
  spain: '西班牙',
  srilanka: '斯里兰卡',
  sweden: '瑞典',
  switzerland: '瑞士',
  taiwan: '中国台湾',
  tajikistan: '塔吉克斯坦',
  tanzania: '坦桑尼亚',
  thailand: '泰国',
  turkey: '土耳其',
  ukraine: '乌克兰',
  uruguay: '乌拉圭',
  usa: '美国',
  uzbekistan: '乌兹别克斯坦',
  venezuela: '委内瑞拉',
  vietnam: '越南',
});
const HERO_SMS_COUNTRY_CODE_ALIAS_OVERRIDES = Object.freeze({
  'bahamas': ['BS'],
  'bolivia': ['BO'],
  'czech republic': ['CZ'],
  'democratic republic of the congo': ['CD'],
  'laos': ['LA'],
  'moldova': ['MD'],
  'north korea': ['KP'],
  'south korea': ['KR'],
  'russia': ['RU'],
  'russian federation': ['RU'],
  'syria': ['SY'],
  'taiwan': ['TW'],
  'tanzania': ['TZ'],
  'united kingdom': ['GB', 'UK'],
  'united states': ['US', 'USA'],
  'venezuela': ['VE'],
  'vietnam': ['VN'],
});
const HERO_SMS_COUNTRY_ISO_CODE_BY_NAME = (() => {
  const lookup = new Map();
  if (typeof Intl === 'undefined' || typeof Intl.DisplayNames !== 'function') {
    return lookup;
  }
  const displayNames = new Intl.DisplayNames(['en'], { type: 'region' });
  for (let first = 65; first <= 90; first += 1) {
    for (let second = 65; second <= 90; second += 1) {
      const code = String.fromCharCode(first) + String.fromCharCode(second);
      const name = displayNames.of(code);
      const key = normalizeHeroSmsCountryAliasKey(name);
      if (!key || lookup.has(key)) {
        continue;
      }
      lookup.set(key, code);
    }
  }
  return lookup;
})();
const DEFAULT_LOCAL_CPA_STEP9_MODE = 'submit';
const DEFAULT_CPA_CALLBACK_MODE = 'step8';
const MAIL_2925_MODE_PROVIDE = 'provide';
const MAIL_2925_MODE_RECEIVE = 'receive';
const DEFAULT_MAIL_2925_MODE = MAIL_2925_MODE_PROVIDE;
const NEW_USER_GUIDE_PROMPT_DISMISSED_STORAGE_KEY = 'multipage-new-user-guide-prompt-dismissed';
const AUTO_SKIP_FAILURES_PROMPT_DISMISSED_STORAGE_KEY = 'multipage-auto-skip-failures-prompt-dismissed';
const AUTO_RUN_FALLBACK_RISK_PROMPT_DISMISSED_STORAGE_KEY = 'multipage-auto-run-fallback-risk-prompt-dismissed';
const CPA_PHONE_SIGNUP_PROMPT_DISMISSED_STORAGE_KEY = 'multipage-cpa-phone-signup-prompt-dismissed';
const CPA_PHONE_SIGNUP_WARNING_MESSAGE = 'CPA 未适配手机号注册模式，认证成功后无法使用。请使用 SUB2API，或者认证成功后重新登录一遍进行解决。';
const PHONE_VERIFICATION_SECTION_EXPANDED_STORAGE_KEY = 'multipage-phone-verification-section-expanded';
let phoneVerificationSectionExpanded = false;

function readPhoneVerificationSectionExpanded() {
  try {
    return window.localStorage?.getItem(PHONE_VERIFICATION_SECTION_EXPANDED_STORAGE_KEY) === '1';
  } catch (err) {
    return false;
  }
}

function persistPhoneVerificationSectionExpanded(expanded) {
  try {
    if (expanded) {
      window.localStorage?.setItem(PHONE_VERIFICATION_SECTION_EXPANDED_STORAGE_KEY, '1');
    } else {
      window.localStorage?.removeItem(PHONE_VERIFICATION_SECTION_EXPANDED_STORAGE_KEY);
    }
  } catch (err) {
    // Ignore storage errors; the current in-memory state is enough for this session.
  }
}

function setPhoneVerificationSectionExpanded(expanded) {
  phoneVerificationSectionExpanded = Boolean(expanded);
  persistPhoneVerificationSectionExpanded(phoneVerificationSectionExpanded);
  if (typeof updatePhoneVerificationSettingsUI === 'function') {
    updatePhoneVerificationSettingsUI();
  }
}

function togglePhoneVerificationSectionExpanded() {
  setPhoneVerificationSectionExpanded(!phoneVerificationSectionExpanded);
}

function initPhoneVerificationSectionExpandedState() {
  phoneVerificationSectionExpanded = readPhoneVerificationSectionExpanded();
  if (typeof updatePhoneVerificationSettingsUI === 'function') {
    updatePhoneVerificationSettingsUI();
  }
}

function getStepDefinitionsForMode(plusModeEnabled = false, options = {}) {
  const defaultMethod = typeof DEFAULT_PLUS_PAYMENT_METHOD !== 'undefined' ? DEFAULT_PLUS_PAYMENT_METHOD : 'paypal';
  const rawPaymentMethod = typeof options === 'string'
    ? options
    : (options.plusPaymentMethod || currentPlusPaymentMethod || defaultMethod);
  const rawSignupMethod = typeof options === 'string'
    ? currentSignupMethod
    : (options.signupMethod || currentSignupMethod || DEFAULT_SIGNUP_METHOD);
  return (window.MultiPageStepDefinitions?.getSteps?.({
    plusModeEnabled,
    plusPaymentMethod: normalizePlusPaymentMethod(rawPaymentMethod),
    signupMethod: normalizeSignupMethod(rawSignupMethod),
  }) || [])
    .sort((left, right) => {
      const leftOrder = Number.isFinite(left.order) ? left.order : left.id;
      const rightOrder = Number.isFinite(right.order) ? right.order : right.id;
      if (leftOrder !== rightOrder) return leftOrder - rightOrder;
      return left.id - right.id;
    });
}

function getStepIdByKeyForCurrentMode(stepKey = '') {
  const normalizedKey = String(stepKey || '').trim();
  if (!normalizedKey) {
    return 0;
  }
  const match = (stepDefinitions || []).find((step) => String(step?.key || '') === normalizedKey);
  return Number(match?.id) || 0;
}

function rebuildStepDefinitionState(plusModeEnabled = false, options = {}) {
  currentPlusModeEnabled = Boolean(plusModeEnabled);
  const defaultMethod = typeof DEFAULT_PLUS_PAYMENT_METHOD !== 'undefined' ? DEFAULT_PLUS_PAYMENT_METHOD : 'paypal';
  const rawPaymentMethod = typeof options === 'string'
    ? options
    : (options.plusPaymentMethod || currentPlusPaymentMethod || defaultMethod);
  const rawSignupMethod = typeof options === 'string'
    ? currentSignupMethod
    : (options.signupMethod || currentSignupMethod || DEFAULT_SIGNUP_METHOD);
  currentPlusPaymentMethod = normalizePlusPaymentMethod(rawPaymentMethod);
  currentSignupMethod = normalizeSignupMethod(rawSignupMethod);
  stepDefinitions = getStepDefinitionsForMode(currentPlusModeEnabled, {
    plusPaymentMethod: currentPlusPaymentMethod,
    signupMethod: currentSignupMethod,
  });
  STEP_IDS = stepDefinitions.map((step) => Number(step.id)).filter(Number.isFinite);
  STEP_DEFAULT_STATUSES = Object.fromEntries(STEP_IDS.map((stepId) => [stepId, 'pending']));
  SKIPPABLE_STEPS = new Set(STEP_IDS);
}
const CONTRIBUTION_CONTENT_PROMPT_DISMISSED_VERSION_STORAGE_KEY = 'multipage-contribution-content-prompt-dismissed-version';
const AUTO_RUN_FALLBACK_RISK_WARNING_MIN_RUNS = 3;
const HOTMAIL_SERVICE_MODE_REMOTE = 'remote';
const HOTMAIL_SERVICE_MODE_LOCAL = 'local';
const ICLOUD_PROVIDER = 'icloud';
const GMAIL_PROVIDER = 'gmail';
const GMAIL_ALIAS_GENERATOR = 'gmail-alias';
const LUCKMAIL_PROVIDER = 'luckmail-api';
const CUSTOM_EMAIL_POOL_GENERATOR = 'custom-pool';
const DEFAULT_LUCKMAIL_BASE_URL = 'https://mails.luckyous.com';
const DEFAULT_LUCKMAIL_EMAIL_TYPE = 'ms_graph';
const DISPLAY_TIMEZONE = 'Asia/Shanghai';
const DEFAULT_ACCOUNT_RUN_HISTORY_HELPER_BASE_URL = 'http://127.0.0.1:17373';
const CONTRIBUTION_UPLOAD_URL = 'https://apikey.qzz.io/';
const DEFAULT_PHONE_VERIFICATION_ENABLED = false;
const DEFAULT_HERO_SMS_COUNTRY_ID = 52;
const DEFAULT_HERO_SMS_COUNTRY_LABEL = 'Thailand';
const DEFAULT_FIVE_SIM_COUNTRY_ID = 'vietnam';
const DEFAULT_FIVE_SIM_COUNTRY_LABEL = '越南 (Vietnam)';
const FIVE_SIM_SUPPORTED_COUNTRY_ITEMS = Object.freeze([
  { id: 'indonesia', chn: '印度尼西亚', eng: 'Indonesia', searchText: 'indonesia 印度尼西亚 印尼 Indonesia ID +62' },
  { id: 'thailand', chn: '泰国', eng: 'Thailand', searchText: 'thailand 泰国 Thailand TH +66' },
  { id: 'england', chn: '英国', eng: 'England', searchText: 'england 英国 England UK GB United Kingdom +44' },
  { id: 'usa', chn: '美国', eng: 'United States', searchText: 'usa 美国 United States US +1' },
  { id: 'japan', chn: '日本', eng: 'Japan', searchText: 'japan 日本 Japan JP +81' },
  { id: 'germany', chn: '德国', eng: 'Germany', searchText: 'germany 德国 Germany DE +49' },
  { id: 'vietnam', chn: '越南', eng: 'Vietnam', searchText: 'vietnam 越南 Vietnam VN +84' },
]);
const FIVE_SIM_SUPPORTED_COUNTRY_ID_SET = new Set(FIVE_SIM_SUPPORTED_COUNTRY_ITEMS.map((item) => item.id));
const NEX_SMS_FALLBACK_COUNTRY_ITEMS = Object.freeze([
  { id: 1, label: 'Ukraine (#1)', searchText: 'Ukraine 1 UA' },
  { id: 6, label: 'Indonesia (#6)', searchText: 'Indonesia 6 ID' },
  { id: 7, label: 'Malaysia (#7)', searchText: 'Malaysia 7 MY' },
]);
const DEFAULT_IP_PROXY_SERVICE = '711proxy';
const SUPPORTED_IP_PROXY_SERVICES = ['711proxy', 'lumiproxy', 'iproyal', 'omegaproxy'];
const IP_PROXY_ENABLED_SERVICES = ['711proxy'];
const DEFAULT_IP_PROXY_MODE = 'account';
const SUPPORTED_IP_PROXY_MODES = ['api', 'account'];
const DEFAULT_IP_PROXY_PROTOCOL = 'http';
const SUPPORTED_IP_PROXY_PROTOCOLS = ['http', 'https', 'socks4', 'socks5'];
const IP_PROXY_API_MODE_ENABLED = false;
const IP_PROXY_ACCOUNT_LIST_ENABLED = false;

function getManagedAliasUtils() {
  return window.MultiPageManagedAliasUtils || null;
}

function isManagedAliasProvider(provider = selectMailProvider.value, mail2925Mode = getSelectedMail2925Mode()) {
  const utils = getManagedAliasUtils();
  if (utils?.usesManagedAliasGeneration) {
    return utils.usesManagedAliasGeneration(provider, { mail2925Mode });
  }
  if (utils?.isManagedAliasProvider) {
    const normalizedProvider = String(provider || '').trim().toLowerCase();
    if (normalizedProvider === '2925') {
      return utils.isManagedAliasProvider(provider)
        && normalizeMail2925Mode(mail2925Mode) === MAIL_2925_MODE_PROVIDE;
    }
    return utils.isManagedAliasProvider(provider);
  }
  const normalizedProvider = String(provider || '').trim().toLowerCase();
  if (normalizedProvider === '2925') {
    return normalizeMail2925Mode(mail2925Mode) === MAIL_2925_MODE_PROVIDE;
  }
  return normalizedProvider === GMAIL_PROVIDER;
}

function parseManagedAliasBaseEmail(rawValue, provider = selectMailProvider.value) {
  const utils = getManagedAliasUtils();
  if (utils?.parseManagedAliasBaseEmail) {
    return utils.parseManagedAliasBaseEmail(rawValue, provider);
  }
  return null;
}

function isManagedAliasEmail(value, baseEmail = '', provider = selectMailProvider.value) {
  const utils = getManagedAliasUtils();
  if (utils?.isManagedAliasEmail) {
    return utils.isManagedAliasEmail(value, provider, baseEmail);
  }
  return false;
}

function getManagedAliasProviderUiCopy(provider = selectMailProvider.value, mail2925Mode = getSelectedMail2925Mode()) {
  if (!isManagedAliasProvider(provider, mail2925Mode)) {
    return null;
  }
  const utils = getManagedAliasUtils();
  if (utils?.getManagedAliasProviderUiCopy) {
    return utils.getManagedAliasProviderUiCopy(provider);
  }
  if (String(provider || '').trim().toLowerCase() === GMAIL_PROVIDER) {
    return {
      baseLabel: '基邮箱',
      basePlaceholder: '例如 yourname@gmail.com',
      buttonLabel: '生成',
      successVerb: '生成',
      label: 'Gmail +tag 邮箱',
      placeholder: '点击生成 Gmail +tag 邮箱，或手动填写完整邮箱',
      hint: '先填写基邮箱后点“生成”，也可以直接手动填写完整的 Gmail 邮箱。',
    };
  }
  if (String(provider || '').trim().toLowerCase() === '2925') {
    return {
      baseLabel: '基邮箱',
      basePlaceholder: '例如 yourname@2925.com',
      buttonLabel: '生成',
      successVerb: '生成',
      label: '2925 邮箱',
      placeholder: '点击生成 2925 邮箱，或手动填写完整邮箱',
      hint: '先填写基邮箱后点“生成”，也可以直接手动填写完整的 2925 邮箱。',
    };
  }
  return null;
}

function getManagedAliasBaseEmailKey(provider = selectMailProvider.value) {
  const normalizedProvider = String(provider || '').trim().toLowerCase();
  if (normalizedProvider === GMAIL_PROVIDER) {
    return 'gmailBaseEmail';
  }
  if (normalizedProvider === '2925') {
    return 'mail2925BaseEmail';
  }
  return '';
}

function isMail2925AccountPoolEnabled(state = latestState) {
  return Boolean(state?.mail2925UseAccountPool);
}

function getPreferredMail2925PoolAccountId(state = latestState) {
  const currentId = String(state?.currentMail2925AccountId || '').trim();
  if (currentId && getMail2925Accounts(state).some((account) => account.id === currentId)) {
    return currentId;
  }
  return '';
}

function syncMail2925PoolAccountOptions(state = latestState) {
  if (!selectMail2925PoolAccount) {
    return;
  }

  const accounts = getMail2925Accounts(state);
  const selectedId = getPreferredMail2925PoolAccountId(state);
  const options = ['<option value="">请选择号池邮箱</option>'].concat(
    accounts.map((account) => `<option value="${escapeHtml(account.id)}">${escapeHtml(account.email || '(未命名账号)')}</option>`)
  );
  selectMail2925PoolAccount.innerHTML = options.join('');
  selectMail2925PoolAccount.value = selectedId;
}

async function syncSelectedMail2925PoolAccount(options = {}) {
  const { silent = false } = options;
  if (!selectMail2925PoolAccount || !isMail2925AccountPoolEnabled(latestState)) {
    return null;
  }

  const accountId = String(selectMail2925PoolAccount.value || '').trim();
  if (!accountId) {
    syncLatestState({ currentMail2925AccountId: null });
    setManagedAliasBaseEmailInputForProvider('2925', latestState);
    return null;
  }

  const response = await chrome.runtime.sendMessage({
    type: 'SELECT_MAIL2925_ACCOUNT',
    source: 'sidepanel',
    payload: { accountId },
  });
  if (response?.error) {
    throw new Error(response.error);
  }

  syncLatestState({
    currentMail2925AccountId: response.account?.id || accountId,
    ...(response.account?.email ? { mail2925BaseEmail: String(response.account.email).trim() } : {}),
  });
  setManagedAliasBaseEmailInputForProvider('2925', latestState);
  if (!silent) {
    showToast(`已切换当前 2925 号池邮箱为 ${response.account?.email || accountId}`, 'success', 1800);
  }
  return response.account || null;
}

function getManagedAliasBaseEmailForProvider(provider = selectMailProvider.value, state = latestState) {
  if (String(provider || '').trim().toLowerCase() === '2925' && isMail2925AccountPoolEnabled(state)) {
    const currentMail2925Email = getCurrentMail2925Email(state);
    if (currentMail2925Email) {
      return currentMail2925Email;
    }
  }

  const key = getManagedAliasBaseEmailKey(provider);
  if (!key) {
    return '';
  }

  const providerValue = String(state?.[key] || '').trim();
  if (providerValue) {
    return providerValue;
  }

  const legacyEmailPrefix = String(state?.emailPrefix || '').trim();
  return parseManagedAliasBaseEmail(legacyEmailPrefix, provider) ? legacyEmailPrefix : '';
}

function buildManagedAliasBaseEmailPayload(state = latestState) {
  const payload = {
    gmailBaseEmail: String(state?.gmailBaseEmail || '').trim(),
    mail2925BaseEmail: String(state?.mail2925BaseEmail || '').trim(),
    mail2925UseAccountPool: Boolean(state?.mail2925UseAccountPool),
    emailPrefix: '',
  };
  const key = getManagedAliasBaseEmailKey();
  if (key) {
    if (key === 'mail2925BaseEmail' && isMail2925AccountPoolEnabled(state)) {
      payload[key] = String(state?.mail2925BaseEmail || '').trim();
    } else {
      payload[key] = inputEmailPrefix.value.trim();
    }
  }
  return payload;
}

function syncManagedAliasBaseEmailDraftFromInput(provider = selectMailProvider.value) {
  const key = getManagedAliasBaseEmailKey(provider);
  if (!key) {
    return;
  }
  if (key === 'mail2925BaseEmail' && isMail2925AccountPoolEnabled(latestState)) {
    return;
  }
  syncLatestState({ [key]: inputEmailPrefix.value.trim() });
}

function setManagedAliasBaseEmailInputForProvider(provider = selectMailProvider.value, state = latestState) {
  syncMail2925PoolAccountOptions(state);
  inputEmailPrefix.value = getManagedAliasBaseEmailForProvider(provider, state);
}

function getCurrentRegistrationEmailUiCopy() {
  if (isCustomMailProvider()) {
    return getCustomMailProviderUiCopy();
  }
  if (usesGeneratedAliasMailProvider()) {
    return getManagedAliasProviderUiCopy();
  }
  return getEmailGeneratorUiCopy();
}

function isCurrentRegistrationEmailCompatible(email = inputEmail.value.trim(), provider = selectMailProvider.value, state = latestState) {
  if (!usesGeneratedAliasMailProvider(provider, getSelectedMail2925Mode()) || !email) {
    return true;
  }
  const baseEmail = getManagedAliasBaseEmailForProvider(provider, state);
  return isManagedAliasEmail(email, baseEmail, provider);
}

function validateCurrentRegistrationEmail(email = inputEmail.value.trim(), options = {}) {
  const { showToastOnFailure = false } = options;
  if (isCurrentRegistrationEmailCompatible(email)) {
    return true;
  }

  if (showToastOnFailure) {
    const uiCopy = getManagedAliasProviderUiCopy();
    const baseEmail = getManagedAliasBaseEmailForProvider();
    showToast(
      baseEmail
        ? `当前邮箱服务为“${uiCopy?.label || '别名邮箱'}”，注册邮箱需与 ${uiCopy?.baseLabel || '基邮箱'} 对应。`
        : `当前邮箱服务为“${uiCopy?.label || '别名邮箱'}”，请直接填写完整邮箱，或先填写基邮箱后点击“生成”。`,
      'warn'
    );
  }
  return false;
}

let latestState = null;
let currentAutoRun = {
  autoRunning: false,
  phase: 'idle',
  currentRun: 0,
  totalRuns: 1,
  attemptRun: 0,
  scheduledAt: null,
  countdownAt: null,
  countdownTitle: '',
  countdownNote: '',
};
let pendingAutoRunStartTotalRuns = 0;
let pendingAutoRunStartExpiresAt = 0;
let settingsDirty = false;
let settingsSaveInFlight = false;
let settingsAutoSaveTimer = null;
let settingsSaveRevision = 0;
let signupPhoneInputDirty = false;
let signupPhoneInputFocused = false;
let signupPhoneInputPersistPromise = null;
let cloudflareDomainEditMode = false;
let cloudflareTempEmailDomainEditMode = false;
let modalChoiceResolver = null;
let currentModalActions = [];
let modalResultBuilder = null;
let activePlusManualConfirmationRequestId = '';
let plusManualConfirmationDialogInFlight = false;
let scheduledCountdownTimer = null;
let configMenuOpen = false;
let configActionInFlight = false;
let currentReleaseSnapshot = null;
let currentContributionContentSnapshot = null;
let contributionContentSnapshotRequestInFlight = null;

const DEFAULT_SUB2API_GROUP_OPTIONS = ['codex', 'openai-plus'];
const editableListPickerModule = window.SidepanelEditableListPicker || {};
const normalizeEditableListValues = editableListPickerModule.normalizeEditableListValues
  || ((...sources) => {
    const values = [];
    const seen = new Set();
    const append = (value) => {
      const items = Array.isArray(value)
        ? value
        : String(value || '').split(/[\r\n,，、]+/);
      items.forEach((item) => {
        const normalized = String(item || '').trim();
        const key = normalized.toLowerCase();
        if (key && !seen.has(key)) {
          seen.add(key);
          values.push(normalized);
        }
      });
    };
    sources.forEach(append);
    return values;
  });
const createEditableListPicker = editableListPickerModule.createEditableListPicker
  || (() => ({
    close() { },
    render() { },
    setOpen() { },
    setSelection() { },
    setVisible() { },
  }));
const closeEditableListPickers = editableListPickerModule.closeEditableListPickers || (() => { });
const isClickInsideEditableListPicker = editableListPickerModule.isClickInsideEditableListPicker || (() => false);

function normalizeSub2ApiGroupOptions(...sources) {
  return normalizeEditableListValues(...sources);
}

function normalizeSub2ApiAccountPriorityValue(value) {
  const rawValue = String(value ?? '').trim();
  const numeric = Number(rawValue);
  if (!rawValue || !Number.isSafeInteger(numeric) || numeric < 1) {
    return 1;
  }
  return numeric;
}

function getSelectedSub2ApiGroupName() {
  return String(inputSub2ApiGroup?.value || '').trim()
    || DEFAULT_SUB2API_GROUP_OPTIONS[0];
}

function getSub2ApiGroupOptionsState(state = latestState) {
  const options = normalizeSub2ApiGroupOptions(
    state?.sub2apiGroupNames,
    state?.sub2apiGroupName
  );
  return options.length ? options : [...DEFAULT_SUB2API_GROUP_OPTIONS];
}

const sub2ApiGroupPicker = createEditableListPicker({
  root: sub2ApiGroupPickerRoot,
  input: inputSub2ApiGroup,
  trigger: btnSub2ApiGroupMenu,
  current: sub2ApiGroupCurrent,
  menu: sub2ApiGroupMenu,
  fallbackItems: DEFAULT_SUB2API_GROUP_OPTIONS,
  minItems: 1,
  itemLabel: '分组',
  onDelete: handleDeleteSub2ApiGroup,
  onDeleteError: (error) => showToast(error?.message || '删除 SUB2API 分组失败。', 'error'),
});

const cfDomainPicker = createEditableListPicker({
  root: cfDomainPickerRoot,
  input: selectCfDomain,
  trigger: btnCfDomainMenu,
  current: cfDomainCurrent,
  menu: cfDomainMenu,
  emptyLabel: '请先添加域名',
  itemLabel: '域名',
  normalizeItems: normalizeCloudflareDomains,
  normalizeValue: normalizeCloudflareDomainValue,
  onDelete: handleDeleteCloudflareDomain,
  onDeleteError: (error) => showToast(error?.message || '删除 Cloudflare 域名失败。', 'error'),
});

const tempEmailDomainPicker = createEditableListPicker({
  root: tempEmailDomainPickerRoot,
  input: selectTempEmailDomain,
  trigger: btnTempEmailDomainMenu,
  current: tempEmailDomainCurrent,
  menu: tempEmailDomainMenu,
  emptyLabel: '请先添加域名',
  itemLabel: '域名',
  normalizeItems: normalizeCloudflareTempEmailDomains,
  normalizeValue: normalizeCloudflareTempEmailDomainValue,
  onDelete: handleDeleteCloudflareTempEmailDomain,
  onDeleteError: (error) => showToast(error?.message || '删除 Cloudflare Temp Email 域名失败。', 'error'),
});

function renderSub2ApiGroupOptions(state = latestState, selectedValue = '') {
  if (!inputSub2ApiGroup) {
    return;
  }

  const selected = String(selectedValue || state?.sub2apiGroupName || '').trim();
  const options = getSub2ApiGroupOptionsState({
    ...(state || {}),
    sub2apiGroupName: selected || state?.sub2apiGroupName,
  });
  if (selected && !options.some((name) => name.toLowerCase() === selected.toLowerCase())) {
    options.unshift(selected);
  }

  sub2ApiGroupPicker.render(options, selected || options[0] || DEFAULT_SUB2API_GROUP_OPTIONS[0]);
}
let customEmailPoolEntriesState = [];

const EYE_OPEN_ICON = '<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M1 12s4-7 11-7 11 7 11 7-4 7-11 7S1 12 1 12z"/><circle cx="12" cy="12" r="3"/></svg>';
const EYE_CLOSED_ICON = '<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M17.94 17.94A10.94 10.94 0 0 1 12 19C5 19 1 12 1 12a21.77 21.77 0 0 1 5.06-6.94"/><path d="M9.9 4.24A10.94 10.94 0 0 1 12 5c7 0 11 7 11 7a21.86 21.86 0 0 1-2.16 3.19"/><path d="M1 1l22 22"/><path d="M14.12 14.12a3 3 0 1 1-4.24-4.24"/></svg>';
const COPY_ICON = '<svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><rect x="9" y="9" width="13" height="13" rx="2" ry="2"/><path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1"/></svg>';
const parseHotmailImportText = window.HotmailUtils?.parseHotmailImportText;
const normalizeHotmailServiceModeFromUtils = window.HotmailUtils?.normalizeHotmailServiceMode;
const shouldClearHotmailCurrentSelection = window.HotmailUtils?.shouldClearHotmailCurrentSelection;
const upsertHotmailAccountInList = window.HotmailUtils?.upsertHotmailAccountInList;
const filterHotmailAccountsByUsage = window.HotmailUtils?.filterHotmailAccountsByUsage;
const getHotmailBulkActionLabel = window.HotmailUtils?.getHotmailBulkActionLabel;
const getHotmailListToggleLabel = window.HotmailUtils?.getHotmailListToggleLabel;
const upsertPayPalAccountInList = window.PayPalUtils?.upsertPayPalAccountInList;
const normalizeLuckmailTimestampValue = window.LuckMailUtils?.normalizeTimestamp
  || ((value) => {
    const timestamp = Date.parse(String(value || ''));
    return Number.isFinite(timestamp) ? timestamp : 0;
  });
const sidepanelUpdateService = window.SidepanelUpdateService;
const contributionContentService = window.SidepanelContributionContentService;
const sharedFormDialog = window.SidepanelFormDialog?.createFormDialog?.({
  overlay: sharedFormModal,
  titleNode: sharedFormModalTitle,
  closeButton: btnSharedFormModalClose,
  messageNode: sharedFormModalMessage,
  alertNode: sharedFormModalAlert,
  fieldsContainer: sharedFormModalFields,
  cancelButton: btnSharedFormModalCancel,
  confirmButton: btnSharedFormModalConfirm,
});
const DEFAULT_LUCKMAIL_PRESERVE_TAG_NAME = window.LuckMailUtils?.DEFAULT_LUCKMAIL_PRESERVE_TAG_NAME || '保留';
const normalizeIcloudHost = window.IcloudUtils?.normalizeIcloudHost
  || ((value) => {
    const normalized = String(value || '').trim().toLowerCase();
    return normalized === 'icloud.com' || normalized === 'icloud.com.cn' ? normalized : '';
  });
const normalizeIcloudFetchMode = (value) => {
  const normalized = String(value || '').trim().toLowerCase();
  return normalized === 'always_new' ? 'always_new' : 'reuse_existing';
};
const normalizeIcloudTargetMailboxType = window.MailProviderUtils?.normalizeIcloudTargetMailboxType
  || ((value) => String(value || '').trim().toLowerCase() === 'forward-mailbox'
    ? 'forward-mailbox'
    : 'icloud-inbox');
const getIcloudForwardMailProviderOptions = window.MailProviderUtils?.getIcloudForwardMailProviderOptions
  || (() => Array.from(selectIcloudForwardMailProvider?.options || [])
    .map((option) => ({
      value: String(option?.value || '').trim().toLowerCase(),
      label: String(option?.textContent || option?.label || option?.value || '').trim(),
    }))
    .filter((option) => option.value));
const normalizeIcloudForwardMailProvider = window.MailProviderUtils?.normalizeIcloudForwardMailProvider
  || ((value) => {
    const normalized = String(value || '').trim().toLowerCase();
    const options = getIcloudForwardMailProviderOptions();
    return options.some((option) => option.value === normalized)
      ? normalized
      : (options[0]?.value || 'qq');
  });
const ICLOUD_FORWARD_MAIL_PROVIDER_LABELS = Object.fromEntries(
  getIcloudForwardMailProviderOptions().map((option) => [option.value, option.label])
);
const getIcloudLoginUrlForHost = window.IcloudUtils?.getIcloudLoginUrlForHost
  || ((host) => host === 'icloud.com.cn' ? 'https://www.icloud.com.cn/' : (host === 'icloud.com' ? 'https://www.icloud.com/' : ''));

btnAutoCancelSchedule?.remove();
const MAIL_PROVIDER_LOGIN_CONFIGS = {
  [ICLOUD_PROVIDER]: {
    label: 'iCloud 邮箱',
    buttonLabel: '登录',
  },
  [GMAIL_PROVIDER]: {
    label: 'Gmail 邮箱',
    url: 'https://mail.google.com/mail/u/0/#inbox',
    buttonLabel: '登录',
  },
  '163': {
    label: '163 邮箱',
    url: 'https://mail.163.com/',
    buttonLabel: '登录',
  },
  '163-vip': {
    label: '163 VIP 邮箱',
    url: 'https://webmail.vip.163.com/',
    buttonLabel: '登录',
  },
  '126': {
    label: '126 邮箱',
    url: 'https://mail.126.com/',
    buttonLabel: '登录',
  },
  qq: {
    label: 'QQ 邮箱',
    url: 'https://wx.mail.qq.com/',
    buttonLabel: '登录',
  },
  'cloudflare-temp-email': {
    label: 'Cloudflare Temp Email GitHub',
    url: 'https://github.com/dreamhunter2333/cloudflare_temp_email',
    buttonLabel: 'GitHub',
  },
  '2925': {
    label: '2925 邮箱',
    url: 'https://2925.com/#/mailList',
  },
};
const IP_PROXY_SERVICE_LOGIN_CONFIGS = {
  '711proxy': {
    label: '711Proxy',
    url: 'https://www.711proxy.com/signup?code=AD2497',
    buttonLabel: '注册',
  },
};

// ============================================================
// Toast Notifications
// ============================================================

const toastContainer = document.getElementById('toast-container');

const TOAST_ICONS = {
  error: '<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="10"/><line x1="15" y1="9" x2="9" y2="15"/><line x1="9" y1="9" x2="15" y2="15"/></svg>',
  warn: '<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M10.29 3.86L1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0z"/><line x1="12" y1="9" x2="12" y2="13"/><line x1="12" y1="17" x2="12.01" y2="17"/></svg>',
  success: '<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M22 11.08V12a10 10 0 1 1-5.93-9.14"/><polyline points="22 4 12 14.01 9 11.01"/></svg>',
  info: '<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="10"/><line x1="12" y1="16" x2="12" y2="12"/><line x1="12" y1="8" x2="12.01" y2="8"/></svg>',
};

const LOG_LEVEL_LABELS = {
  info: '信息',
  ok: '成功',
  warn: '警告',
  error: '错误',
};

const CLOUDFLARE_TEMP_EMAIL_REPOSITORY_URL = 'https://github.com/dreamhunter2333/cloudflare_temp_email';

function usesGeneratedAliasMailProvider(
  provider,
  mail2925Mode = getSelectedMail2925Mode(),
  generator = undefined
) {
  const customEmailPoolGenerator = typeof CUSTOM_EMAIL_POOL_GENERATOR === 'string'
    ? CUSTOM_EMAIL_POOL_GENERATOR
    : 'custom-pool';
  const resolvedGenerator = generator !== undefined
    ? generator
    : (typeof getSelectedEmailGenerator === 'function' ? getSelectedEmailGenerator() : '');
  return resolvedGenerator !== customEmailPoolGenerator
    && isManagedAliasProvider(provider, mail2925Mode);
}

function parseGmailBaseEmail(rawValue = '') {
  const value = String(rawValue || '').trim().toLowerCase();
  const match = value.match(/^([^@\s+]+)@((?:gmail|googlemail)\.com)$/i);
  if (!match) return null;

  return {
    localPart: match[1],
    domain: match[2].toLowerCase(),
  };
}

function isManagedGmailAlias(value, baseEmail) {
  const parsedBase = parseGmailBaseEmail(baseEmail);
  if (!parsedBase) return false;

  const match = String(value || '').trim().toLowerCase().match(/^([^@\s+]+)(?:\+[^@\s]+)?@((?:gmail|googlemail)\.com)$/i);
  if (!match) return false;

  return match[1] === parsedBase.localPart && match[2] === parsedBase.domain;
}

function showToast(message, type = 'error', duration = 4000) {
  const toast = document.createElement('div');
  toast.className = `toast toast-${type}`;
  toast.innerHTML = `${TOAST_ICONS[type] || ''}<span class="toast-msg">${escapeHtml(message)}</span><button class="toast-close">&times;</button>`;

  toast.querySelector('.toast-close').addEventListener('click', () => dismissToast(toast));
  toastContainer.appendChild(toast);

  if (duration > 0) {
    setTimeout(() => dismissToast(toast), duration);
  }
}

function dismissToast(toast) {
  if (!toast.parentNode) return;
  toast.classList.add('toast-exit');
  toast.addEventListener('animationend', () => toast.remove());
}

function resetActionModalOption() {
  if (!modalOptionRow || !modalOptionInput || !modalOptionText) {
    return;
  }

  modalOptionRow.hidden = true;
  modalOptionInput.checked = false;
  modalOptionInput.disabled = false;
  modalOptionText.textContent = '不再提示';
}

function resetActionModalAlert() {
  if (!autoStartAlert) {
    return;
  }

  autoStartAlert.hidden = true;
  autoStartAlert.textContent = '';
  autoStartAlert.className = 'modal-alert';
}

function setActionModalMessageContent({ text = '', html = '' } = {}) {
  if (!autoStartMessage) {
    return;
  }

  if (html) {
    autoStartMessage.innerHTML = html;
    return;
  }

  autoStartMessage.textContent = text;
}

function resetActionModalButtons() {
  const buttons = [btnAutoStartCancel, btnAutoStartRestart, btnAutoStartContinue];
  buttons.forEach((button) => {
    if (!button) return;
    button.hidden = true;
    button.disabled = false;
    button.onclick = null;
  });
  currentModalActions = [];
}

function configureActionModalButton(button, action) {
  if (!button) return;
  if (!action) {
    button.hidden = true;
    button.onclick = null;
    return;
  }

  button.hidden = false;
  button.disabled = false;
  button.textContent = action.label;
  button.className = `btn ${action.variant || 'btn-outline'} btn-sm`;
  button.onclick = () => resolveModalChoice(action.id);
}

function configureActionModalOption(option) {
  if (!modalOptionRow || !modalOptionInput || !modalOptionText) {
    return;
  }

  if (!option) {
    resetActionModalOption();
    return;
  }

  modalOptionRow.hidden = false;
  modalOptionInput.checked = Boolean(option.checked);
  modalOptionInput.disabled = Boolean(option.disabled);
  modalOptionText.textContent = option.label || '不再提示';
}

function configureActionModalAlert(alert) {
  if (!autoStartAlert) {
    return;
  }

  if (!alert?.text) {
    resetActionModalAlert();
    return;
  }

  autoStartAlert.hidden = false;
  autoStartAlert.textContent = alert.text;
  autoStartAlert.className = `modal-alert${alert.tone === 'danger' ? ' is-danger' : ''}`;
}

function resolveModalChoice(choice) {
  const optionChecked = Boolean(modalOptionInput?.checked);
  const result = typeof modalResultBuilder === 'function'
    ? modalResultBuilder(choice, { optionChecked })
    : choice;
  if (modalChoiceResolver) {
    modalChoiceResolver(result);
    modalChoiceResolver = null;
  }
  modalResultBuilder = null;
  resetActionModalButtons();
  resetActionModalAlert();
  resetActionModalOption();
  if (autoStartModal) {
    autoStartModal.hidden = true;
  }
}

function openActionModal({ title, message, messageHtml, actions, option, alert, buildResult }) {
  if (!autoStartModal) {
    return Promise.resolve(null);
  }

  if (modalChoiceResolver) {
    resolveModalChoice(null);
  }

  resetActionModalButtons();
  autoStartTitle.textContent = title;
  setActionModalMessageContent({ text: message, html: messageHtml });
  currentModalActions = actions || [];
  modalResultBuilder = typeof buildResult === 'function' ? buildResult : null;
  const buttonSlots = currentModalActions.length <= 2
    ? [btnAutoStartCancel, btnAutoStartContinue]
    : [btnAutoStartCancel, btnAutoStartRestart, btnAutoStartContinue];
  buttonSlots.forEach((button, index) => {
    configureActionModalButton(button, currentModalActions[index]);
  });
  configureActionModalAlert(alert);
  configureActionModalOption(option);
  autoStartModal.hidden = false;

  return new Promise((resolve) => {
    modalChoiceResolver = resolve;
  });
}

function openAutoStartChoiceDialog(startStep, options = {}) {
  const runningStep = Number.isInteger(options.runningStep) ? options.runningStep : null;
  const continueMessage = runningStep
    ? `继续当前会先等待步骤 ${runningStep} 完成，再按最新进度自动执行。`
    : `继续当前会从步骤 ${startStep} 开始自动执行。`;
  return openActionModal({
    title: '启动自动',
    message: `检测到当前已有流程进度。${continueMessage}重新开始会清空当前流程进度并从步骤 1 新开一轮。`,
    actions: [
      { id: null, label: '取消', variant: 'btn-ghost' },
      { id: 'restart', label: '重新开始', variant: 'btn-outline' },
      { id: 'continue', label: '继续当前', variant: 'btn-primary' },
    ],
  });
}

async function openConfirmModal({ title, message, confirmLabel = '确认', confirmVariant = 'btn-primary', alert = null }) {
  const choice = await openActionModal({
    title,
    message,
    alert,
    actions: [
      { id: null, label: '取消', variant: 'btn-ghost' },
      { id: 'confirm', label: confirmLabel, variant: confirmVariant },
    ],
  });
  return choice === 'confirm';
}

async function openConfirmModalWithOption({
  title,
  message,
  confirmLabel = '确认',
  confirmVariant = 'btn-primary',
  alert = null,
  optionLabel = '不再提示',
  optionChecked = false,
  optionDisabled = false,
}) {
  const result = await openActionModal({
    title,
    message,
    alert,
    actions: [
      { id: null, label: '取消', variant: 'btn-ghost' },
      { id: 'confirm', label: confirmLabel, variant: confirmVariant },
    ],
    option: {
      label: optionLabel,
      checked: optionChecked,
      disabled: optionDisabled,
    },
    buildResult: (choice, meta) => ({
      choice,
      optionChecked: Boolean(meta?.optionChecked),
    }),
  });

  return {
    confirmed: result?.choice === 'confirm',
    optionChecked: Boolean(result?.optionChecked),
  };
}

async function openPlusManualConfirmationDialog(options = {}) {
  const method = String(options.method || '').trim().toLowerCase();
  const title = String(options.title || '').trim() || (method === 'gopay' ? 'GoPay 订阅确认' : '手动确认');
  const message = String(options.message || '').trim()
    || (method === 'gopay'
      ? '请在当前订阅页中手动完成 GoPay 订阅，完成后点击“我已完成订阅”继续。'
      : '请先在页面中完成当前手动操作，完成后点击确认继续。');
  return openActionModal({
    title,
    message,
    actions: [
      { id: 'cancel', label: '取消等待', variant: 'btn-ghost' },
      { id: 'confirm', label: '我已完成订阅', variant: 'btn-primary' },
    ],
    alert: method === 'gopay'
      ? { text: '确认后流程会直接继续到 Plus 模式第 10 步 OAuth 登录。', tone: 'info' }
      : null,
  });
}

async function syncPlusManualConfirmationDialog() {
  const requestId = String(latestState?.plusManualConfirmationRequestId || '').trim();
  const pending = Boolean(latestState?.plusManualConfirmationPending);
  if (!pending || !requestId || plusManualConfirmationDialogInFlight || activePlusManualConfirmationRequestId === requestId) {
    return;
  }

  const step = Number(latestState?.plusManualConfirmationStep) || 0;
  const method = String(latestState?.plusManualConfirmationMethod || '').trim().toLowerCase();
  const title = latestState?.plusManualConfirmationTitle;
  const message = latestState?.plusManualConfirmationMessage;
  activePlusManualConfirmationRequestId = requestId;
  plusManualConfirmationDialogInFlight = true;
  let shouldReopenDialog = false;

  try {
    const choice = await openPlusManualConfirmationDialog({
      method,
      title,
      message,
    });
    const currentRequestId = String(latestState?.plusManualConfirmationRequestId || '').trim();
    const stillPending = Boolean(latestState?.plusManualConfirmationPending);
    if (!stillPending || currentRequestId !== requestId) {
      return;
    }
    if (choice == null) {
      shouldReopenDialog = true;
      showToast('当前订阅确认仍在等待中，将重新弹出确认窗口。', 'info', 1800);
      return;
    }

    const confirmed = choice === 'confirm';
    const response = await chrome.runtime.sendMessage({
      type: 'RESOLVE_PLUS_MANUAL_CONFIRMATION',
      source: 'sidepanel',
      payload: {
        step,
        requestId,
        confirmed,
      },
    });
    if (response?.error) {
      throw new Error(response.error);
    }
    if (confirmed) {
      showToast(method === 'gopay' ? 'GoPay 订阅已确认，正在继续 OAuth 登录...' : '已确认，流程继续执行中...', 'info', 2200);
    } else {
      showToast(method === 'gopay' ? '已取消 GoPay 订阅等待。' : '已取消当前手动确认。', 'warn', 2200);
    }
  } catch (error) {
    showToast(error?.message || String(error || '未知错误'), 'error');
  } finally {
    if (activePlusManualConfirmationRequestId === requestId) {
      activePlusManualConfirmationRequestId = '';
    }
    plusManualConfirmationDialogInFlight = false;
    if (
      shouldReopenDialog
      && latestState?.plusManualConfirmationPending
      && String(latestState?.plusManualConfirmationRequestId || '').trim() === requestId
    ) {
      setTimeout(() => {
        void syncPlusManualConfirmationDialog();
      }, 0);
    }
  }
}

function isPromptDismissed(storageKey) {
  return localStorage.getItem(storageKey) === '1';
}

function setPromptDismissed(storageKey, dismissed) {
  if (dismissed) {
    localStorage.setItem(storageKey, '1');
  } else {
    localStorage.removeItem(storageKey);
  }
}

function isNewUserGuidePromptDismissed() {
  return isPromptDismissed(NEW_USER_GUIDE_PROMPT_DISMISSED_STORAGE_KEY);
}

function setNewUserGuidePromptDismissed(dismissed) {
  setPromptDismissed(NEW_USER_GUIDE_PROMPT_DISMISSED_STORAGE_KEY, dismissed);
}

function shouldPromptNewUserGuide() {
  if (isNewUserGuidePromptDismissed()) {
    return false;
  }
  if (!btnContributionMode || btnContributionMode.disabled) {
    return false;
  }
  if (latestState?.contributionMode) {
    return false;
  }
  return true;
}

function getContributionPortalUrl() {
  return String(contributionContentService?.portalUrl || 'https://apikey.qzz.io').trim();
}

function openNewUserGuidePrompt() {
  return openActionModal({
    title: '新手引导',
    message: '如果你是第一次使用，可以先查看贡献页里的公告和使用教程。点击“查看引导”会自动打开贡献页面。',
    alert: {
      text: '本提示仅出现一次。',
    },
    actions: [
      { id: null, label: '取消', variant: 'btn-ghost' },
      { id: 'confirm', label: '查看引导', variant: 'btn-primary' },
    ],
  });
}

async function maybeShowNewUserGuidePrompt() {
  if (!shouldPromptNewUserGuide()) {
    return false;
  }

  setNewUserGuidePromptDismissed(true);
  const choice = await openNewUserGuidePrompt();
  if (choice === 'confirm') {
    openExternalUrl(getContributionPortalUrl());
    return true;
  }
  return false;
}

function getDismissedContributionContentPromptVersion() {
  return String(localStorage.getItem(CONTRIBUTION_CONTENT_PROMPT_DISMISSED_VERSION_STORAGE_KEY) || '').trim();
}

function setDismissedContributionContentPromptVersion(version) {
  const normalized = String(version || '').trim();
  if (normalized) {
    localStorage.setItem(CONTRIBUTION_CONTENT_PROMPT_DISMISSED_VERSION_STORAGE_KEY, normalized);
  } else {
    localStorage.removeItem(CONTRIBUTION_CONTENT_PROMPT_DISMISSED_VERSION_STORAGE_KEY);
  }
}

function isAutoSkipFailuresPromptDismissed() {
  return isPromptDismissed(AUTO_SKIP_FAILURES_PROMPT_DISMISSED_STORAGE_KEY);
}

function setAutoSkipFailuresPromptDismissed(dismissed) {
  setPromptDismissed(AUTO_SKIP_FAILURES_PROMPT_DISMISSED_STORAGE_KEY, dismissed);
}

function isAutoRunFallbackRiskPromptDismissed() {
  return isPromptDismissed(AUTO_RUN_FALLBACK_RISK_PROMPT_DISMISSED_STORAGE_KEY);
}

function setAutoRunFallbackRiskPromptDismissed(dismissed) {
  setPromptDismissed(AUTO_RUN_FALLBACK_RISK_PROMPT_DISMISSED_STORAGE_KEY, dismissed);
}

function isCpaPhoneSignupPromptDismissed() {
  return isPromptDismissed(CPA_PHONE_SIGNUP_PROMPT_DISMISSED_STORAGE_KEY);
}

function setCpaPhoneSignupPromptDismissed(dismissed) {
  setPromptDismissed(CPA_PHONE_SIGNUP_PROMPT_DISMISSED_STORAGE_KEY, dismissed);
}

function shouldWarnAutoRunFallbackRisk(totalRuns, autoRunSkipFailures) {
  return totalRuns >= AUTO_RUN_FALLBACK_RISK_WARNING_MIN_RUNS;
}

function shouldWarnCpaPhoneSignup(signupMethod = null, panelMode = null) {
  const resolvedSignupMethod = normalizeSignupMethod(
    signupMethod ?? (
      typeof getSelectedSignupMethod === 'function'
        ? getSelectedSignupMethod()
        : DEFAULT_SIGNUP_METHOD
    )
  );
  const resolvedPanelMode = normalizePanelMode(
    panelMode ?? (
      typeof getSelectedPanelMode === 'function'
        ? getSelectedPanelMode()
        : 'cpa'
    )
  );

  return resolvedSignupMethod === SIGNUP_METHOD_PHONE
    && resolvedPanelMode === 'cpa'
    && !isCpaPhoneSignupPromptDismissed();
}

async function openCpaPhoneSignupWarningModal() {
  const result = await openConfirmModalWithOption({
    title: 'CPA 手机号注册提醒',
    message: CPA_PHONE_SIGNUP_WARNING_MESSAGE,
    confirmLabel: '继续',
    optionLabel: '不再提醒',
  });

  return {
    confirmed: result.confirmed,
    dismissPrompt: result.optionChecked,
  };
}

async function confirmCpaPhoneSignupIfNeeded(options = {}) {
  const signupMethod = Object.prototype.hasOwnProperty.call(options, 'signupMethod')
    ? options.signupMethod
    : null;
  const panelMode = Object.prototype.hasOwnProperty.call(options, 'panelMode')
    ? options.panelMode
    : null;

  if (!shouldWarnCpaPhoneSignup(signupMethod, panelMode)) {
    return true;
  }

  const result = await openCpaPhoneSignupWarningModal();
  if (result.dismissPrompt) {
    setCpaPhoneSignupPromptDismissed(true);
  }

  return result.confirmed;
}

async function openAutoSkipFailuresConfirmModal() {
  const result = await openConfirmModalWithOption({
    title: '自动重试说明',
    message: `开启后，自动模式在某一轮失败时，会先在当前轮自动重试；单轮最多重试 ${AUTO_RUN_MAX_RETRIES_PER_ROUND} 次，仍失败则放弃当前轮并继续下一轮。线程间隔只在开启自动重试且总轮数大于 1 时生效。`,
    confirmLabel: '确认开启',
  });

  return {
    confirmed: result.confirmed,
    dismissPrompt: result.optionChecked,
  };
}

async function openAutoRunFallbackRiskConfirmModal(totalRuns) {
  const result = await openConfirmModalWithOption({
    title: '自动运行风险提醒',
    message: `当前轮数已经不适合单节点情况，请确保已经配置并打开节点轮询功能（若没有配置，请点击贡献/使用按钮，根据网页中使用教程进行配置），避免连续使用一个节点注册，导致出现手机号验证。`,
    confirmLabel: '继续',
  });

  return {
    confirmed: result.confirmed,
    dismissPrompt: result.optionChecked,
  };
}

function updateConfigMenuControls() {
  const disabled = configActionInFlight || settingsSaveInFlight;
  const contributionModeEnabled = Boolean(latestState?.contributionMode);
  if (contributionModeEnabled && configMenuOpen) {
    configMenuOpen = false;
  }
  const importLocked = disabled
    || contributionModeEnabled
    || currentAutoRun.autoRunning
    || Object.values(getStepStatuses()).some((status) => status === 'running');
  if (btnConfigMenu) {
    btnConfigMenu.disabled = disabled || contributionModeEnabled;
    btnConfigMenu.setAttribute('aria-expanded', String(configMenuOpen));
  }
  if (configMenu) {
    configMenu.hidden = contributionModeEnabled || !configMenuOpen;
  }
  if (btnExportSettings) {
    btnExportSettings.disabled = disabled || contributionModeEnabled;
  }
  if (btnImportSettings) {
    btnImportSettings.disabled = importLocked;
  }
}

function closeConfigMenu() {
  configMenuOpen = false;
  updateConfigMenuControls();
}

function openConfigMenu() {
  configMenuOpen = true;
  updateConfigMenuControls();
}

function toggleConfigMenu() {
  configMenuOpen ? closeConfigMenu() : openConfigMenu();
}

async function waitForSettingsSaveIdle() {
  while (settingsSaveInFlight) {
    await new Promise((resolve) => setTimeout(resolve, 50));
  }
}

async function flushPendingSettingsBeforeExport() {
  clearTimeout(settingsAutoSaveTimer);
  await waitForSettingsSaveIdle();
  if (settingsDirty) {
    await saveSettings({ silent: true });
  }
}

async function settlePendingSettingsBeforeImport() {
  clearTimeout(settingsAutoSaveTimer);
  await waitForSettingsSaveIdle();
}

function downloadTextFile(content, fileName, mimeType = 'application/json;charset=utf-8') {
  const blob = new Blob([content], { type: mimeType });
  const objectUrl = URL.createObjectURL(blob);
  const anchor = document.createElement('a');
  anchor.href = objectUrl;
  anchor.download = fileName;
  document.body.appendChild(anchor);
  anchor.click();
  anchor.remove();
  setTimeout(() => URL.revokeObjectURL(objectUrl), 0);
}

function isDoneStatus(status) {
  return status === 'completed' || status === 'manual_completed' || status === 'skipped';
}

function getStepStatuses(state = latestState) {
  const merged = { ...STEP_DEFAULT_STATUSES, ...(state?.stepStatuses || {}) };
  return Object.fromEntries(STEP_IDS.map((stepId) => [stepId, merged[stepId] || 'pending']));
}

function getFirstUnfinishedStep(state = latestState) {
  const statuses = getStepStatuses(state);
  for (const step of STEP_IDS) {
    if (!isDoneStatus(statuses[step])) {
      return step;
    }
  }
  return null;
}

function getRunningSteps(state = latestState) {
  const statuses = getStepStatuses(state);
  return Object.entries(statuses)
    .filter(([, status]) => status === 'running')
    .map(([step]) => Number(step))
    .sort((a, b) => a - b);
}

function hasSavedProgress(state = latestState) {
  const statuses = getStepStatuses(state);
  return Object.values(statuses).some((status) => status !== 'pending');
}

function isContributionModeSwitchBlocked(state = latestState) {
  const statuses = getStepStatuses(state);
  const anyRunning = Object.values(statuses).some((status) => status === 'running');
  return anyRunning || isAutoRunLockedPhase() || isAutoRunPausedPhase() || isAutoRunScheduledPhase();
}

function shouldOfferAutoModeChoice(state = latestState) {
  return hasSavedProgress(state) && getFirstUnfinishedStep(state) !== null;
}

function syncLatestState(nextState) {
  const mergedStepStatuses = nextState?.stepStatuses
    ? { ...STEP_DEFAULT_STATUSES, ...(latestState?.stepStatuses || {}), ...nextState.stepStatuses }
    : getStepStatuses(latestState);

  latestState = {
    ...(latestState || {}),
    ...(nextState || {}),
    stepStatuses: mergedStepStatuses,
  };

  renderAccountRecords(latestState);
}

function normalizeOperationDelayEnabled(value) {
  return typeof value === 'boolean' ? value : true;
}

function appendOperationDelayLog(enabled, level = 'info', message = '') {
  appendLog({
    timestamp: Date.now(),
    level,
    message: message || (enabled
      ? '操作间延迟已开启：页面输入、选择、点击、提交、继续、授权后等待 2 秒。'
      : '操作间延迟已关闭：页面操作将连续执行。'),
  });
}

function applyOperationDelayState(state = latestState, options = {}) {
  const enabled = options.restoreFailed ? true : normalizeOperationDelayEnabled(state?.operationDelayEnabled);
  lastConfirmedOperationDelayEnabled = enabled;
  if (inputOperationDelayEnabled) inputOperationDelayEnabled.checked = enabled;
  if (typeof syncLatestState === 'function') {
    syncLatestState({ operationDelayEnabled: enabled });
  }
  if (options.restoreFailed) {
    appendOperationDelayLog(true, 'warn', '操作间延迟设置读取失败，已回退为默认开启。');
  }
}

async function persistOperationDelayToggle() {
  const nextEnabled = normalizeOperationDelayEnabled(inputOperationDelayEnabled?.checked);
  try {
    const response = await chrome.runtime.sendMessage({
      type: 'SAVE_SETTING',
      source: 'sidepanel',
      payload: { operationDelayEnabled: nextEnabled },
    });
    if (response?.error) throw new Error(response.error);
    const confirmed = normalizeOperationDelayEnabled(response?.state?.operationDelayEnabled ?? nextEnabled);
    lastConfirmedOperationDelayEnabled = confirmed;
    if (inputOperationDelayEnabled) inputOperationDelayEnabled.checked = confirmed;
    syncLatestState({ operationDelayEnabled: confirmed });
    appendOperationDelayLog(confirmed);
  } catch (error) {
    if (inputOperationDelayEnabled) inputOperationDelayEnabled.checked = lastConfirmedOperationDelayEnabled;
    appendOperationDelayLog(lastConfirmedOperationDelayEnabled, 'error', `操作间延迟设置保存失败，已恢复为上一次确认的状态：${error.message}`);
    throw error;
  }
}

function normalizePlusPaymentMethod(value = '') {
  const rootScope = typeof window !== 'undefined' ? window : globalThis;
  if (rootScope.GoPayUtils?.normalizePlusPaymentMethod) {
    return rootScope.GoPayUtils.normalizePlusPaymentMethod(value);
  }
  const gopayValue = typeof PLUS_PAYMENT_METHOD_GOPAY !== 'undefined' ? PLUS_PAYMENT_METHOD_GOPAY : 'gopay';
  const gpcValue = typeof PLUS_PAYMENT_METHOD_GPC_HELPER !== 'undefined' ? PLUS_PAYMENT_METHOD_GPC_HELPER : 'gpc-helper';
  const paypalValue = typeof PLUS_PAYMENT_METHOD_PAYPAL !== 'undefined' ? PLUS_PAYMENT_METHOD_PAYPAL : 'paypal';
  const normalized = String(value || '').trim().toLowerCase();
  if (normalized === gpcValue) {
    return gpcValue;
  }
  return normalized === gopayValue ? gopayValue : paypalValue;
}

function getSelectedPlusPaymentMethod(state = latestState) {
  const defaultMethod = typeof DEFAULT_PLUS_PAYMENT_METHOD !== 'undefined' ? DEFAULT_PLUS_PAYMENT_METHOD : 'paypal';
  if (typeof selectPlusPaymentMethod !== 'undefined' && selectPlusPaymentMethod?.value) {
    return normalizePlusPaymentMethod(selectPlusPaymentMethod.value);
  }
  return normalizePlusPaymentMethod(state?.plusPaymentMethod || currentPlusPaymentMethod || defaultMethod);
}

function normalizeGpcHelperPhoneModeValue(value = '') {
  const rootScope = typeof window !== 'undefined' ? window : globalThis;
  if (rootScope.GoPayUtils?.normalizeGpcHelperPhoneMode) {
    return rootScope.GoPayUtils.normalizeGpcHelperPhoneMode(value);
  }
  const normalized = String(value || '').trim().toLowerCase();
  return normalized === GPC_HELPER_PHONE_MODE_AUTO || normalized === 'builtin'
    ? GPC_HELPER_PHONE_MODE_AUTO
    : GPC_HELPER_PHONE_MODE_MANUAL;
}

function getGpcHelperAutoModeEnabled(state = latestState) {
  return Boolean(state?.gopayHelperAutoModeEnabled);
}

function hasGpcAutoModePermissionField(payload = {}) {
  if (!payload || typeof payload !== 'object' || Array.isArray(payload)) {
    return false;
  }
  return payload.auto_mode_enabled !== undefined
    || payload.autoModeEnabled !== undefined
    || payload.auto_enabled !== undefined
    || payload.autoEnabled !== undefined
    || (payload.data && typeof payload.data === 'object' && !Array.isArray(payload.data) && hasGpcAutoModePermissionField(payload.data));
}

function isGpcAutoModePermissionDenied(state = latestState) {
  if (getGpcHelperAutoModeEnabled(state)) {
    return false;
  }
  return hasGpcAutoModePermissionField(state?.gopayHelperBalancePayload);
}

function normalizeGpcRemainingUsesValue(value) {
  const rootScope = typeof window !== 'undefined' ? window : globalThis;
  if (rootScope.GoPayUtils?.normalizeGpcRemainingUses) {
    return rootScope.GoPayUtils.normalizeGpcRemainingUses(value);
  }
  if (value === undefined || value === null || String(value).trim() === '') {
    return null;
  }
  const numeric = Number(value);
  return Number.isFinite(numeric) ? Math.max(0, Math.floor(numeric)) : null;
}

function getGpcBalanceRemainingUsesFromResponse(response = {}) {
  const rootScope = typeof window !== 'undefined' ? window : globalThis;
  if (rootScope.GoPayUtils?.getGpcBalanceRemainingUses) {
    const remaining = rootScope.GoPayUtils.getGpcBalanceRemainingUses(response?.data || response?.payload || response);
    if (remaining !== null && remaining !== undefined) {
      return remaining;
    }
  }
  return normalizeGpcRemainingUsesValue(
    response?.remainingUses
    ?? response?.data?.remaining_uses
    ?? response?.data?.remainingUses
    ?? response?.payload?.data?.remaining_uses
    ?? response?.payload?.remaining_uses
    ?? response?.payload?.remainingUses
  );
}

function getGpcAutoModeEnabledFromResponse(response = {}) {
  if (typeof response?.autoModeEnabled === 'boolean') {
    return response.autoModeEnabled;
  }
  const rootScope = typeof window !== 'undefined' ? window : globalThis;
  if (rootScope.GoPayUtils?.isGpcAutoModeEnabled) {
    return rootScope.GoPayUtils.isGpcAutoModeEnabled(response?.data || response?.payload || response);
  }
  return Boolean(
    response?.data?.auto_mode_enabled
    ?? response?.data?.autoModeEnabled
    ?? response?.payload?.data?.auto_mode_enabled
    ?? response?.payload?.auto_mode_enabled
    ?? response?.payload?.autoModeEnabled
  );
}

function normalizeGpcOtpChannelValue(value = '') {
  const rootScope = typeof window !== 'undefined' ? window : globalThis;
  if (rootScope.GoPayUtils?.normalizeGpcOtpChannel) {
    return rootScope.GoPayUtils.normalizeGpcOtpChannel(value);
  }
  return String(value || '').trim().toLowerCase() === 'sms' ? 'sms' : 'whatsapp';
}

function normalizeGpcLocalSmsHelperBaseUrlValue(value = '') {
  const fallback = 'http://127.0.0.1:18767';
  const rawValue = String(value || fallback).trim();
  try {
    const parsed = new URL(rawValue);
    if (!['http:', 'https:'].includes(parsed.protocol)) {
      return fallback;
    }
    const endpointPath = parsed.pathname.replace(/\/+$/g, '') || '/';
    if (['/otp', '/latest-otp', '/health'].includes(endpointPath)) {
      parsed.pathname = '';
      parsed.search = '';
      parsed.hash = '';
    }
    return parsed.toString().replace(/\/$/, '');
  } catch {
    return fallback;
  }
}

function hasOwnStateValue(source, key) {
  return Object.prototype.hasOwnProperty.call(source, key);
}

function readAutoRunStateValue(source, keys, fallback) {
  for (const key of keys) {
    if (hasOwnStateValue(source, key)) {
      return source[key];
    }
  }
  return fallback;
}

function normalizePendingAutoRunStartRunCount(value) {
  const numeric = Math.floor(Number(value) || 0);
  return numeric > 0 ? numeric : 0;
}

function registerPendingAutoRunStartRunCount(totalRuns) {
  pendingAutoRunStartTotalRuns = normalizePendingAutoRunStartRunCount(totalRuns);
  pendingAutoRunStartExpiresAt = pendingAutoRunStartTotalRuns > 0
    ? Date.now() + 30000
    : 0;
}

function clearPendingAutoRunStartRunCount() {
  pendingAutoRunStartTotalRuns = 0;
  pendingAutoRunStartExpiresAt = 0;
}

function getPendingAutoRunStartRunCount() {
  if (pendingAutoRunStartTotalRuns > 0 && pendingAutoRunStartExpiresAt > 0 && Date.now() > pendingAutoRunStartExpiresAt) {
    clearPendingAutoRunStartRunCount();
  }
  return pendingAutoRunStartTotalRuns;
}

function getAutoRunSourceTotalRuns(source = {}) {
  return normalizePendingAutoRunStartRunCount(readAutoRunStateValue(source, ['autoRunTotalRuns', 'totalRuns'], 0));
}

function syncAutoRunState(source = {}) {
  const phase = source.autoRunPhase ?? source.phase ?? currentAutoRun.phase;
  const autoRunning = source.autoRunning !== undefined
    ? Boolean(source.autoRunning)
    : (source.autoRunPhase !== undefined || source.phase !== undefined
      ? ['scheduled', 'running', 'waiting_step', 'waiting_email', 'retrying', 'waiting_interval'].includes(phase)
      : currentAutoRun.autoRunning);

  currentAutoRun = {
    autoRunning,
    phase,
    currentRun: readAutoRunStateValue(source, ['autoRunCurrentRun', 'currentRun'], currentAutoRun.currentRun),
    totalRuns: readAutoRunStateValue(source, ['autoRunTotalRuns', 'totalRuns'], currentAutoRun.totalRuns),
    attemptRun: readAutoRunStateValue(source, ['autoRunAttemptRun', 'attemptRun'], currentAutoRun.attemptRun),
    scheduledAt: readAutoRunStateValue(source, ['scheduledAutoRunAt', 'scheduledAt'], currentAutoRun.scheduledAt),
    countdownAt: readAutoRunStateValue(source, ['autoRunCountdownAt', 'countdownAt'], currentAutoRun.countdownAt),
    countdownTitle: readAutoRunStateValue(source, ['autoRunCountdownTitle', 'countdownTitle'], currentAutoRun.countdownTitle),
    countdownNote: readAutoRunStateValue(source, ['autoRunCountdownNote', 'countdownNote'], currentAutoRun.countdownNote),
  };
}

function isContributionButtonLocked() {
  const autoActive = currentAutoRun.autoRunning
    || isAutoRunLockedPhase()
    || isAutoRunPausedPhase()
    || isAutoRunScheduledPhase();
  if (autoActive) {
    return false;
  }

  const statuses = getStepStatuses();
  const anyRunning = Object.values(statuses).some((status) => status === 'running');
  return anyRunning;
}

function isAutoRunLockedPhase() {
  return currentAutoRun.phase === 'running'
    || currentAutoRun.phase === 'waiting_step'
    || currentAutoRun.phase === 'retrying'
    || currentAutoRun.phase === 'waiting_interval';
}

function isAutoRunPausedPhase() {
  return currentAutoRun.phase === 'waiting_email';
}

function isAutoRunWaitingStepPhase() {
  return currentAutoRun.phase === 'waiting_step';
}

function isAutoRunScheduledPhase() {
  return currentAutoRun.phase === 'scheduled';
}

function isAutoRunSourceSyncPhase(phase) {
  return ['scheduled', 'running', 'waiting_step', 'waiting_email', 'retrying', 'waiting_interval'].includes(phase);
}

function shouldSyncRunCountFromAutoRunSource(source = {}) {
  const phase = source.autoRunPhase ?? source.phase ?? currentAutoRun.phase;
  const autoRunning = source.autoRunning !== undefined
    ? Boolean(source.autoRunning)
    : isAutoRunSourceSyncPhase(phase);
  const shouldSync = autoRunning || isAutoRunSourceSyncPhase(phase);
  if (!shouldSync) {
    return false;
  }

  const pendingTotalRuns = getPendingAutoRunStartRunCount();
  if (pendingTotalRuns > 0) {
    const sourceTotalRuns = getAutoRunSourceTotalRuns(source);
    if (sourceTotalRuns > 0 && sourceTotalRuns !== pendingTotalRuns) {
      return false;
    }
    if (sourceTotalRuns === pendingTotalRuns) {
      clearPendingAutoRunStartRunCount();
    }
  }
  return true;
}

function getAutoRunLabel(payload = currentAutoRun) {
  if ((payload.phase ?? currentAutoRun.phase) === 'scheduled') {
    return (payload.totalRuns || 1) > 1 ? ` (${payload.totalRuns}轮)` : '';
  }
  const attemptLabel = payload.attemptRun ? ` · 尝试${payload.attemptRun}` : '';
  if ((payload.totalRuns || 1) > 1) {
    return ` (${payload.currentRun}/${payload.totalRuns}${attemptLabel})`;
  }
  return attemptLabel ? ` (${attemptLabel.slice(3)})` : '';
}

function normalizeAutoDelayMinutes(value) {
  const numeric = Number(value);
  if (!Number.isFinite(numeric)) {
    return AUTO_DELAY_DEFAULT_MINUTES;
  }
  return Math.min(AUTO_DELAY_MAX_MINUTES, Math.max(AUTO_DELAY_MIN_MINUTES, Math.floor(numeric)));
}

function normalizeAutoRunThreadIntervalMinutes(value) {
  const rawValue = String(value ?? '').trim();
  if (!rawValue) {
    return AUTO_FALLBACK_THREAD_INTERVAL_DEFAULT_MINUTES;
  }

  const numeric = Number(rawValue);
  if (!Number.isFinite(numeric)) {
    return AUTO_FALLBACK_THREAD_INTERVAL_DEFAULT_MINUTES;
  }

  return Math.min(
    AUTO_FALLBACK_THREAD_INTERVAL_MAX_MINUTES,
    Math.max(AUTO_FALLBACK_THREAD_INTERVAL_MIN_MINUTES, Math.floor(numeric))
  );
}

function normalizeAutoStepDelaySeconds(value) {
  const rawValue = String(value ?? '').trim();
  if (!rawValue) {
    return null;
  }

  const numeric = Number(rawValue);
  if (!Number.isFinite(numeric)) {
    return null;
  }

  return Math.min(AUTO_STEP_DELAY_MAX_SECONDS, Math.max(AUTO_STEP_DELAY_MIN_SECONDS, Math.floor(numeric)));
}

function normalizeVerificationResendCount(value, fallback) {
  const rawValue = String(value ?? '').trim();
  if (!rawValue) {
    return fallback;
  }

  const numeric = Number(rawValue);
  if (!Number.isFinite(numeric)) {
    return fallback;
  }

  return Math.min(
    VERIFICATION_RESEND_COUNT_MAX,
    Math.max(VERIFICATION_RESEND_COUNT_MIN, Math.floor(numeric))
  );
}

function formatAutoStepDelayInputValue(value) {
  const normalized = normalizeAutoStepDelaySeconds(value);
  return normalized === null ? '' : String(normalized);
}

function normalizeCustomEmailPoolEntries(value = '') {
  const source = Array.isArray(value)
    ? value
    : String(value || '').split(/[\r\n,，;；]+/);

  return source
    .map((item) => String(item || '').trim().toLowerCase())
    .filter((item) => /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(item));
}

function normalizeCustomEmailPoolEntryEmail(value = '') {
  return String(value || '').trim().toLowerCase();
}

function createCustomEmailPoolEntryId() {
  if (typeof crypto !== 'undefined' && typeof crypto.randomUUID === 'function') {
    return crypto.randomUUID();
  }
  return `custom-pool-${Date.now()}-${Math.random().toString(36).slice(2, 10)}`;
}

function normalizeCustomEmailPoolEntryObjects(value = []) {
  const source = Array.isArray(value) ? value : [];
  const seenEmails = new Set();
  const entries = [];

  for (const rawEntry of source) {
    const asObject = rawEntry && typeof rawEntry === 'object'
      ? rawEntry
      : { email: rawEntry };
    const email = normalizeCustomEmailPoolEntryEmail(asObject.email || '');
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
      continue;
    }
    if (seenEmails.has(email)) {
      continue;
    }
    seenEmails.add(email);
    entries.push({
      id: String(asObject.id || createCustomEmailPoolEntryId()),
      email,
      enabled: asObject.enabled !== undefined ? Boolean(asObject.enabled) : true,
      used: Boolean(asObject.used),
      note: String(asObject.note || '').trim(),
      lastUsedAt: Number.isFinite(Number(asObject.lastUsedAt)) ? Number(asObject.lastUsedAt) : 0,
    });
  }

  return entries;
}

function getNormalizedCustomEmailPoolEntriesState() {
  const entries = (typeof customEmailPoolEntriesState !== 'undefined' && Array.isArray(customEmailPoolEntriesState))
    ? customEmailPoolEntriesState
    : [];
  return normalizeCustomEmailPoolEntryObjects(entries);
}

function getActiveCustomEmailPoolEmails(entries = getNormalizedCustomEmailPoolEntriesState()) {
  return normalizeCustomEmailPoolEntryObjects(entries)
    .filter((entry) => entry.enabled && !entry.used)
    .map((entry) => entry.email);
}

function setCustomEmailPoolEntriesState(entries = [], options = {}) {
  const { syncInput = true } = options;
  customEmailPoolEntriesState = normalizeCustomEmailPoolEntryObjects(entries);
  if (syncInput && inputCustomEmailPool) {
    inputCustomEmailPool.value = getActiveCustomEmailPoolEmails(customEmailPoolEntriesState).join('\n');
  }
}

function restoreCustomEmailPoolEntriesFromState(state = {}) {
  const rawEntries = Array.isArray(state?.customEmailPoolEntries)
    ? state.customEmailPoolEntries
    : [];
  if (rawEntries.length > 0) {
    return normalizeCustomEmailPoolEntryObjects(rawEntries);
  }
  return normalizeCustomEmailPoolEntries(state?.customEmailPool).map((email) => ({
    id: createCustomEmailPoolEntryId(),
    email,
    enabled: true,
    used: false,
    note: '',
    lastUsedAt: 0,
  }));
}

function usesCustomEmailPoolGenerator(provider = selectMailProvider.value) {
  return !isCustomMailProvider(provider)
    && !isLuckmailProvider(provider)
    && getSelectedEmailGenerator() === CUSTOM_EMAIL_POOL_GENERATOR;
}

function getCustomMailProviderPoolSize() {
  return normalizeCustomEmailPoolEntries(inputCustomMailProviderPool?.value).length;
}

function usesCustomMailProviderPool(provider = selectMailProvider.value) {
  return isCustomMailProvider(provider) && getCustomMailProviderPoolSize() > 0;
}

function getCustomEmailPoolSize() {
  if (typeof customEmailPoolEntriesState !== 'undefined' && Array.isArray(customEmailPoolEntriesState)) {
    const activeEntries = getActiveCustomEmailPoolEmails(customEmailPoolEntriesState);
    if (activeEntries.length > 0 || customEmailPoolEntriesState.length > 0) {
      return activeEntries.length;
    }
  }
  return normalizeCustomEmailPoolEntries(inputCustomEmailPool?.value).length;
}

function getLockedRunCountFromEmailPool(provider = selectMailProvider.value) {
  if (usesCustomMailProviderPool(provider)) {
    return getCustomMailProviderPoolSize();
  }
  if (usesCustomEmailPoolGenerator(provider)) {
    return getCustomEmailPoolSize();
  }
  return 0;
}

function shouldLockRunCountToEmailPool(provider = (typeof selectMailProvider !== 'undefined' ? selectMailProvider?.value : undefined)) {
  return getLockedRunCountFromEmailPool(provider) > 0;
}

function syncRunCountFromCustomEmailPool() {
  if (!usesCustomEmailPoolGenerator()) {
    return;
  }
  inputRunCount.value = String(getCustomEmailPoolSize());
}

function syncRunCountFromCustomMailProviderPool() {
  if (!usesCustomMailProviderPool()) {
    return;
  }
  inputRunCount.value = String(getCustomMailProviderPoolSize());
}

function syncRunCountFromConfiguredEmailPool(provider = selectMailProvider.value) {
  const poolSize = getLockedRunCountFromEmailPool(provider);
  if (poolSize > 0) {
    inputRunCount.value = String(poolSize);
  }
}

function getRunCountValue() {
  const lockedRunCount = typeof getLockedRunCountFromEmailPool === 'function'
    ? getLockedRunCountFromEmailPool()
    : 0;
  if (lockedRunCount > 0) {
    return lockedRunCount;
  }
  return Math.max(1, parseInt(inputRunCount.value, 10) || 1);
}

function updateFallbackThreadIntervalInputState() {
  if (!inputAutoSkipFailuresThreadIntervalMinutes) {
    return;
  }

  inputAutoSkipFailuresThreadIntervalMinutes.disabled = Boolean(inputAutoSkipFailures.disabled);
}

function updateAutoDelayInputState() {
  const scheduled = isAutoRunScheduledPhase();
  inputAutoDelayEnabled.disabled = scheduled;
  inputAutoDelayMinutes.disabled = scheduled || !inputAutoDelayEnabled.checked;
}

function formatCountdown(remainingMs) {
  const totalSeconds = Math.max(0, Math.ceil(remainingMs / 1000));
  const hours = Math.floor(totalSeconds / 3600);
  const minutes = Math.floor((totalSeconds % 3600) / 60);
  const seconds = totalSeconds % 60;
  return `${String(hours).padStart(2, '0')}:${String(minutes).padStart(2, '0')}:${String(seconds).padStart(2, '0')}`;
}

function formatScheduleTime(timestamp) {
  return new Date(timestamp).toLocaleString('zh-CN', {
    hour12: false,
    timeZone: DISPLAY_TIMEZONE,
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
  });
}

function stopScheduledCountdownTicker() {
  clearInterval(scheduledCountdownTimer);
  scheduledCountdownTimer = null;
}

function getActiveAutoRunCountdown() {
  if (isAutoRunScheduledPhase() && Number.isFinite(currentAutoRun.scheduledAt)) {
    return {
      at: currentAutoRun.scheduledAt,
      title: '已计划自动运行',
      note: `计划于 ${formatScheduleTime(currentAutoRun.scheduledAt)} 开始`,
      tone: 'scheduled',
    };
  }

  if (currentAutoRun.phase !== 'waiting_interval') {
    return null;
  }

  if (!Number.isFinite(currentAutoRun.countdownAt)) {
    return null;
  }

  return {
    at: currentAutoRun.countdownAt,
    title: currentAutoRun.countdownTitle || '等待中',
    note: currentAutoRun.countdownNote || '',
    tone: 'running',
  };
}

function renderScheduledAutoRunInfo() {
  if (!autoScheduleBar) {
    return;
  }

  const countdown = getActiveAutoRunCountdown();
  if (!countdown) {
    autoScheduleBar.style.display = 'none';
    return;
  }

  const remainingMs = countdown.at - Date.now();
  autoScheduleBar.style.display = 'flex';
  if (btnAutoRunNow) {
    btnAutoRunNow.hidden = false;
    btnAutoRunNow.textContent = currentAutoRun.phase === 'waiting_interval' ? '立即继续' : '立即开始';
  }
  if (btnAutoCancelSchedule) {
    btnAutoCancelSchedule.hidden = true;
  }
  autoScheduleTitle.textContent = countdown.title;
  autoScheduleMeta.textContent = remainingMs > 0
    ? `${countdown.note ? `${countdown.note}，` : ''}剩余 ${formatCountdown(remainingMs)}`
    : '倒计时即将结束，正在准备继续...';
  return;
}

function syncScheduledCountdownTicker() {
  renderScheduledAutoRunInfo();
  if (getActiveAutoRunCountdown()) {
    if (scheduledCountdownTimer) {
      return;
    }

    scheduledCountdownTimer = setInterval(() => {
      renderScheduledAutoRunInfo();
      updateStatusDisplay(latestState);
    }, 1000);
    return;
  }

  stopScheduledCountdownTicker();
  return;
}

function setDefaultAutoRunButton() {
  btnAutoRun.disabled = false;
  inputRunCount.disabled = shouldLockRunCountToEmailPool();
  btnAutoRun.innerHTML = '<svg width="14" height="14" viewBox="0 0 24 24" fill="currentColor"><polygon points="5 3 19 12 5 21 5 3"/></svg> 自动';
}

function normalizeCloudflareDomainValue(value = '') {
  let normalized = String(value || '').trim().toLowerCase();
  if (!normalized) return '';
  normalized = normalized.replace(/^@+/, '');
  normalized = normalized.replace(/^https?:\/\//, '');
  normalized = normalized.replace(/\/.*$/, '');
  if (!/^[a-z0-9.-]+\.[a-z]{2,}$/.test(normalized)) {
    return '';
  }
  return normalized;
}

function normalizeCloudflareDomains(values = []) {
  const seen = new Set();
  const domains = [];
  for (const value of Array.isArray(values) ? values : []) {
    const normalized = normalizeCloudflareDomainValue(value);
    if (!normalized || seen.has(normalized)) continue;
    seen.add(normalized);
    domains.push(normalized);
  }
  return domains;
}

function normalizeCloudflareTempEmailBaseUrlValue(value = '') {
  const raw = String(value || '').trim();
  if (!raw) return '';
  const candidate = /^[a-zA-Z][a-zA-Z\d+\-.]*:\/\//.test(raw) ? raw : `https://${raw}`;
  try {
    const parsed = new URL(candidate);
    parsed.hash = '';
    parsed.search = '';
    const pathname = parsed.pathname === '/' ? '' : parsed.pathname.replace(/\/+$/, '');
    return `${parsed.origin}${pathname}`;
  } catch {
    return '';
  }
}

function normalizeCloudflareTempEmailReceiveMailboxValue(value = '') {
  const normalized = String(value || '').trim().toLowerCase();
  if (!normalized) return '';
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(normalized) ? normalized : '';
}

function normalizeCloudflareTempEmailDomainValue(value = '') {
  return normalizeCloudflareDomainValue(value);
}

function normalizeCloudflareTempEmailDomains(values = []) {
  const seen = new Set();
  const domains = [];
  for (const value of Array.isArray(values) ? values : []) {
    const normalized = normalizeCloudflareTempEmailDomainValue(value);
    if (!normalized || seen.has(normalized)) continue;
    seen.add(normalized);
    domains.push(normalized);
  }
  return domains;
}

function normalizeCloudMailBaseUrlValue(value = '') {
  return normalizeCloudflareTempEmailBaseUrlValue(value);
}

function normalizeCloudMailReceiveMailboxValue(value = '') {
  return normalizeCloudflareTempEmailReceiveMailboxValue(value);
}

function normalizeCloudMailDomainValue(value = '') {
  return normalizeCloudflareDomainValue(value);
}

function getCloudflareDomainsFromState() {
  const domains = normalizeCloudflareDomains(latestState?.cloudflareDomains || []);
  const activeDomain = normalizeCloudflareDomainValue(latestState?.cloudflareDomain || '');
  if (activeDomain && !domains.includes(activeDomain)) {
    domains.unshift(activeDomain);
  }
  return { domains, activeDomain: activeDomain || domains[0] || '' };
}

function getCloudflareTempEmailDomainsFromState() {
  const domains = normalizeCloudflareTempEmailDomains(latestState?.cloudflareTempEmailDomains || []);
  const activeDomain = normalizeCloudflareTempEmailDomainValue(latestState?.cloudflareTempEmailDomain || '');
  if (activeDomain && !domains.includes(activeDomain)) {
    domains.unshift(activeDomain);
  }
  return { domains, activeDomain: activeDomain || domains[0] || '' };
}

function renderCloudflareDomainOptions(preferredDomain = '') {
  const preferred = normalizeCloudflareDomainValue(preferredDomain);
  const { domains, activeDomain } = getCloudflareDomainsFromState();
  const selected = preferred || activeDomain;
  cfDomainPicker.render(domains, domains.includes(selected) ? selected : domains[0] || '');
}

function renderCloudflareTempEmailDomainOptions(preferredDomain = '') {
  const preferred = normalizeCloudflareTempEmailDomainValue(preferredDomain);
  const { domains, activeDomain } = getCloudflareTempEmailDomainsFromState();
  const selected = preferred || activeDomain;
  tempEmailDomainPicker.render(domains, domains.includes(selected) ? selected : domains[0] || '');
}

function setCloudflareDomainEditMode(editing, options = {}) {
  const { clearInput = false } = options;
  cloudflareDomainEditMode = Boolean(editing);
  cfDomainPicker.setVisible(!cloudflareDomainEditMode);
  inputCfDomain.style.display = cloudflareDomainEditMode ? '' : 'none';
  btnCfDomainMode.textContent = cloudflareDomainEditMode ? '保存' : '添加';
  if (cloudflareDomainEditMode) {
    if (clearInput) {
      inputCfDomain.value = '';
    }
    inputCfDomain.focus();
  } else if (clearInput) {
    inputCfDomain.value = '';
  }
}

function setCloudflareTempEmailDomainEditMode(editing, options = {}) {
  const { clearInput = false } = options;
  cloudflareTempEmailDomainEditMode = Boolean(editing);
  tempEmailDomainPicker.setVisible(!cloudflareTempEmailDomainEditMode);
  inputTempEmailDomain.style.display = cloudflareTempEmailDomainEditMode ? '' : 'none';
  btnTempEmailDomainMode.textContent = cloudflareTempEmailDomainEditMode ? '保存' : '添加';
  if (cloudflareTempEmailDomainEditMode) {
    if (clearInput) {
      inputTempEmailDomain.value = '';
    }
    inputTempEmailDomain.focus();
  } else if (clearInput) {
    inputTempEmailDomain.value = '';
  }
}

function applyCloudflareTempEmailSettingsState(state = {}) {
  inputTempEmailBaseUrl.value = state?.cloudflareTempEmailBaseUrl || '';
  inputTempEmailAdminAuth.value = state?.cloudflareTempEmailAdminAuth || '';
  inputTempEmailCustomAuth.value = state?.cloudflareTempEmailCustomAuth || '';
  inputTempEmailReceiveMailbox.value = state?.cloudflareTempEmailReceiveMailbox || '';
  if (inputTempEmailUseRandomSubdomain) {
    inputTempEmailUseRandomSubdomain.checked = Boolean(state?.cloudflareTempEmailUseRandomSubdomain);
  }
  renderCloudflareTempEmailDomainOptions(state?.cloudflareTempEmailDomain || '');
  setCloudflareTempEmailDomainEditMode(false, { clearInput: true });
}

function applyCloudMailSettingsState(state = {}) {
  if (inputCloudMailBaseUrl) {
    inputCloudMailBaseUrl.value = state?.cloudMailBaseUrl || '';
  }
  if (inputCloudMailAdminEmail) {
    inputCloudMailAdminEmail.value = state?.cloudMailAdminEmail || '';
  }
  if (inputCloudMailAdminPassword) {
    inputCloudMailAdminPassword.value = state?.cloudMailAdminPassword || '';
  }
  if (inputCloudMailReceiveMailbox) {
    inputCloudMailReceiveMailbox.value = state?.cloudMailReceiveMailbox || '';
  }
  if (inputCloudMailDomain) {
    inputCloudMailDomain.value = state?.cloudMailDomain || '';
  }
}

function collectSettingsPayload() {
  const defaultGpcHelperApiUrl = typeof DEFAULT_GPC_HELPER_API_URL !== 'undefined'
    ? DEFAULT_GPC_HELPER_API_URL
    : 'https://gpc.qlhazycoder.top';
  const { domains, activeDomain } = getCloudflareDomainsFromState();
  const selectedCloudflareDomain = normalizeCloudflareDomainValue(
    !cloudflareDomainEditMode ? selectCfDomain.value : activeDomain
  ) || activeDomain;
  const { domains: tempEmailDomains, activeDomain: tempEmailActiveDomain } = getCloudflareTempEmailDomainsFromState();
  const selectedCloudflareTempEmailDomain = normalizeCloudflareTempEmailDomainValue(
    !cloudflareTempEmailDomainEditMode ? selectTempEmailDomain.value : tempEmailActiveDomain
  ) || tempEmailActiveDomain;
  const normalizeCloudMailBaseUrlInput = typeof normalizeCloudMailBaseUrlValue === 'function'
    ? normalizeCloudMailBaseUrlValue
    : normalizeCloudflareTempEmailBaseUrlValue;
  const normalizeCloudMailReceiveMailboxInput = typeof normalizeCloudMailReceiveMailboxValue === 'function'
    ? normalizeCloudMailReceiveMailboxValue
    : normalizeCloudflareTempEmailReceiveMailboxValue;
  const normalizeCloudMailDomainInput = typeof normalizeCloudMailDomainValue === 'function'
    ? normalizeCloudMailDomainValue
    : normalizeCloudflareTempEmailDomainValue;
  const contributionModeEnabled = Boolean(latestState?.contributionMode);
  const icloudFetchModeRawValue = typeof selectIcloudFetchMode !== 'undefined'
    ? String(selectIcloudFetchMode?.value || '')
    : '';
  const icloudTargetMailboxTypeValue = typeof selectIcloudTargetMailboxType !== 'undefined'
    ? selectIcloudTargetMailboxType?.value
    : '';
  const icloudForwardMailProviderValue = typeof selectIcloudForwardMailProvider !== 'undefined'
    ? selectIcloudForwardMailProvider?.value
    : '';
  const normalizedIcloudTargetMailboxType = normalizeIcloudTargetMailboxType(icloudTargetMailboxTypeValue);
  const normalizedIcloudForwardMailProvider = normalizeIcloudForwardMailProvider(icloudForwardMailProviderValue);
  const normalizeIpProxyServiceSafe = typeof normalizeIpProxyService === 'function'
    ? normalizeIpProxyService
    : ((value = '') => {
      const normalized = String(value || '').trim().toLowerCase();
      return ['711proxy'].includes(normalized)
        ? normalized
        : '711proxy';
    });
  const normalizeIpProxyModeSafe = typeof normalizeIpProxyMode === 'function'
    ? normalizeIpProxyMode
    : ((value = '') => {
      const normalized = String(value || '').trim().toLowerCase();
      return ['api', 'account'].includes(normalized) ? normalized : 'account';
    });
  const normalizeIpProxyProtocolSafe = typeof normalizeIpProxyProtocol === 'function'
    ? normalizeIpProxyProtocol
    : ((value = '') => {
      const normalized = String(value || '').trim().toLowerCase();
      return ['http', 'https', 'socks4', 'socks5'].includes(normalized) ? normalized : 'http';
    });
  const normalizeIpProxyPortSafe = typeof normalizeIpProxyPort === 'function'
    ? normalizeIpProxyPort
    : ((value = '') => {
      const numeric = Number.parseInt(String(value || '').trim(), 10);
      if (!Number.isInteger(numeric) || numeric <= 0 || numeric > 65535) {
        return 0;
      }
      return numeric;
    });
  const normalizeIpProxyPoolTargetCountSafe = typeof normalizeIpProxyPoolTargetCount === 'function'
    ? normalizeIpProxyPoolTargetCount
    : ((value = '', fallback = 20) => {
      const rawValue = String(value ?? '').trim();
      if (!rawValue) {
        return String(Math.max(1, Math.min(500, Number(fallback) || 20)));
      }
      const numeric = Number.parseInt(rawValue, 10);
      if (!Number.isInteger(numeric)) {
        return String(Math.max(1, Math.min(500, Number(fallback) || 20)));
      }
      return String(Math.max(1, Math.min(500, numeric)));
    });
  const normalizeIpProxyAutoSyncIntervalMinutesSafe = (value = '', fallback = 15) => {
    const rawValue = String(value ?? '').trim();
    if (!rawValue) {
      return Math.max(1, Math.min(1440, Number(fallback) || 15));
    }
    const numeric = Number.parseInt(rawValue, 10);
    if (!Number.isFinite(numeric)) {
      return Math.max(1, Math.min(1440, Number(fallback) || 15));
    }
    return Math.max(1, Math.min(1440, numeric));
  };
  const normalizeIpProxyAccountLifeMinutesSafe = typeof normalizeIpProxyAccountLifeMinutes === 'function'
    ? normalizeIpProxyAccountLifeMinutes
    : ((value = '', fallback = '') => {
      const rawValue = String(value ?? '').trim();
      if (!rawValue) {
        return String(fallback || '').trim();
      }
      const numeric = Number.parseInt(rawValue, 10);
      if (!Number.isInteger(numeric)) {
        return String(fallback || '').trim();
      }
      return String(Math.max(1, Math.min(1440, numeric)));
    });
  const normalizeIpProxyAccountSessionPrefixSafe = typeof normalizeIpProxyAccountSessionPrefix === 'function'
    ? normalizeIpProxyAccountSessionPrefix
    : ((value = '') => String(value || '').trim().replace(/[^A-Za-z0-9_-]/g, '').slice(0, 32));
  const normalizeIpProxyAccountListSafe = typeof normalizeIpProxyAccountList === 'function'
    ? normalizeIpProxyAccountList
    : ((value = '') => String(value || '')
      .replace(/\r/g, '')
      .split('\n')
      .map((line) => line.trim())
      .filter(Boolean)
      .join('\n'));
  const normalizeGpcOtpChannelSafe = typeof normalizeGpcOtpChannelValue === 'function'
    ? normalizeGpcOtpChannelValue
    : ((value = '') => {
      const rootScope = typeof window !== 'undefined' ? window : globalThis;
      if (rootScope.GoPayUtils?.normalizeGpcOtpChannel) {
        return rootScope.GoPayUtils.normalizeGpcOtpChannel(value);
      }
      return String(value || '').trim().toLowerCase() === 'sms' ? 'sms' : 'whatsapp';
    });
  const normalizeGpcLocalSmsHelperBaseUrlSafe = typeof normalizeGpcLocalSmsHelperBaseUrlValue === 'function'
    ? normalizeGpcLocalSmsHelperBaseUrlValue
    : ((value = '') => {
      const fallback = 'http://127.0.0.1:18767';
      const rawValue = String(value || fallback).trim();
      try {
        const parsed = new URL(rawValue);
        if (!['http:', 'https:'].includes(parsed.protocol)) {
          return fallback;
        }
        const endpointPath = parsed.pathname.replace(/\/+$/g, '') || '/';
        if (['/otp', '/latest-otp', '/health'].includes(endpointPath)) {
          parsed.pathname = '';
          parsed.search = '';
          parsed.hash = '';
        }
        return parsed.toString().replace(/\/$/, '');
      } catch {
        return fallback;
      }
    });
  const getSelectedIpProxyEnabledSafe = typeof getSelectedIpProxyEnabled === 'function'
    ? getSelectedIpProxyEnabled
    : (() => false);
  const getSelectedIpProxyModeSafe = typeof getSelectedIpProxyMode === 'function'
    ? getSelectedIpProxyMode
    : (() => 'account');
  const isIpProxyApiModeEnabledSafe = typeof isIpProxyApiModeAvailable === 'function'
    ? Boolean(isIpProxyApiModeAvailable())
    : (typeof IP_PROXY_API_MODE_ENABLED !== 'undefined' ? Boolean(IP_PROXY_API_MODE_ENABLED) : false);
  const normalizeIpProxyServiceProfilesSafe = typeof normalizeIpProxyServiceProfiles === 'function'
    ? normalizeIpProxyServiceProfiles
    : ((rawValue = {}, fallbackState = {}) => {
      const raw = (rawValue && typeof rawValue === 'object' && !Array.isArray(rawValue))
        ? rawValue
        : {};
      const services = ['711proxy'];
      const fallbackProfile = {
        mode: normalizeIpProxyModeSafe(fallbackState?.ipProxyMode || 'account'),
        apiUrl: String(fallbackState?.ipProxyApiUrl || '').trim(),
        accountList: normalizeIpProxyAccountListSafe(fallbackState?.ipProxyAccountList || ''),
        accountSessionPrefix: normalizeIpProxyAccountSessionPrefixSafe(fallbackState?.ipProxyAccountSessionPrefix || ''),
        accountLifeMinutes: normalizeIpProxyAccountLifeMinutesSafe(fallbackState?.ipProxyAccountLifeMinutes || ''),
        poolTargetCount: normalizeIpProxyPoolTargetCountSafe(fallbackState?.ipProxyPoolTargetCount || '', 20),
        host: String(fallbackState?.ipProxyHost || '').trim(),
        port: String(normalizeIpProxyPortSafe(fallbackState?.ipProxyPort || '') || ''),
        protocol: normalizeIpProxyProtocolSafe(fallbackState?.ipProxyProtocol || ''),
        username: String(fallbackState?.ipProxyUsername || '').trim(),
        password: String(fallbackState?.ipProxyPassword || ''),
        region: String(fallbackState?.ipProxyRegion || '').trim(),
      };
      const result = {};
      services.forEach((service) => {
        const candidate = raw?.[service];
        const source = (candidate && typeof candidate === 'object' && !Array.isArray(candidate))
          ? candidate
          : fallbackProfile;
        result[service] = {
          mode: normalizeIpProxyModeSafe(source.mode || fallbackProfile.mode),
          apiUrl: String(source.apiUrl || fallbackProfile.apiUrl || '').trim(),
          accountList: normalizeIpProxyAccountListSafe(source.accountList || fallbackProfile.accountList),
          accountSessionPrefix: normalizeIpProxyAccountSessionPrefixSafe(source.accountSessionPrefix || fallbackProfile.accountSessionPrefix),
          accountLifeMinutes: normalizeIpProxyAccountLifeMinutesSafe(source.accountLifeMinutes || fallbackProfile.accountLifeMinutes),
          poolTargetCount: normalizeIpProxyPoolTargetCountSafe(source.poolTargetCount || fallbackProfile.poolTargetCount, 20),
          host: String(source.host || fallbackProfile.host || '').trim(),
          port: String(normalizeIpProxyPortSafe(source.port || fallbackProfile.port || '') || ''),
          protocol: normalizeIpProxyProtocolSafe(source.protocol || fallbackProfile.protocol),
          username: String(source.username || fallbackProfile.username || '').trim(),
          password: String(source.password || fallbackProfile.password || ''),
          region: String(source.region || fallbackProfile.region || '').trim(),
        };
      });
      return result;
    });
  const ipProxyServiceRawValue = typeof selectIpProxyService !== 'undefined'
    ? selectIpProxyService?.value
    : '';
  const ipProxyApiUrlRawValue = typeof inputIpProxyApiUrl !== 'undefined'
    ? inputIpProxyApiUrl?.value
    : '';
  const ipProxyAccountListRawValue = typeof inputIpProxyAccountList !== 'undefined'
    ? inputIpProxyAccountList?.value
    : '';
  const ipProxyAccountSessionPrefixRawValue = typeof inputIpProxyAccountSessionPrefix !== 'undefined'
    ? inputIpProxyAccountSessionPrefix?.value
    : '';
  const ipProxyAccountLifeMinutesRawValue = typeof inputIpProxyAccountLifeMinutes !== 'undefined'
    ? inputIpProxyAccountLifeMinutes?.value
    : '';
  const ipProxyPoolTargetCountRawValue = typeof inputIpProxyPoolTargetCount !== 'undefined'
    ? inputIpProxyPoolTargetCount?.value
    : '';
  const ipProxyAutoSyncEnabledRawValue = typeof inputIpProxyAutoSyncEnabled !== 'undefined'
    ? Boolean(inputIpProxyAutoSyncEnabled?.checked)
    : Boolean(latestState?.ipProxyAutoSyncEnabled);
  const ipProxyAutoSyncIntervalMinutesRawValue = typeof inputIpProxyAutoSyncIntervalMinutes !== 'undefined'
    ? inputIpProxyAutoSyncIntervalMinutes?.value
    : '';
  const ipProxyHostRawValue = typeof inputIpProxyHost !== 'undefined'
    ? inputIpProxyHost?.value
    : '';
  const ipProxyPortRawValue = typeof inputIpProxyPort !== 'undefined'
    ? inputIpProxyPort?.value
    : '';
  const ipProxyProtocolRawValue = typeof selectIpProxyProtocol !== 'undefined'
    ? selectIpProxyProtocol?.value
    : '';
  const ipProxyUsernameRawValue = typeof inputIpProxyUsername !== 'undefined'
    ? inputIpProxyUsername?.value
    : '';
  const ipProxyPasswordRawValue = typeof inputIpProxyPassword !== 'undefined'
    ? inputIpProxyPassword?.value
    : '';
  const ipProxyRegionRawValue = typeof inputIpProxyRegion !== 'undefined'
    ? inputIpProxyRegion?.value
    : '';
  const selectedIpProxyService = normalizeIpProxyServiceSafe(
    ipProxyServiceRawValue || latestState?.ipProxyService || '711proxy'
  );
  const selectedIpProxyModeRaw = normalizeIpProxyModeSafe(getSelectedIpProxyModeSafe());
  const selectedIpProxyMode = (!isIpProxyApiModeEnabledSafe && selectedIpProxyModeRaw === 'api')
    ? 'account'
    : selectedIpProxyModeRaw;
  const currentIpProxyServiceProfile = {
    mode: selectedIpProxyMode,
    apiUrl: String(ipProxyApiUrlRawValue || '').trim(),
    accountList: normalizeIpProxyAccountListSafe(ipProxyAccountListRawValue || ''),
    accountSessionPrefix: normalizeIpProxyAccountSessionPrefixSafe(ipProxyAccountSessionPrefixRawValue || ''),
    accountLifeMinutes: normalizeIpProxyAccountLifeMinutesSafe(ipProxyAccountLifeMinutesRawValue || ''),
    poolTargetCount: normalizeIpProxyPoolTargetCountSafe(ipProxyPoolTargetCountRawValue || '', 20),
    host: String(ipProxyHostRawValue || '').trim(),
    port: String(normalizeIpProxyPortSafe(ipProxyPortRawValue || '') || ''),
    protocol: normalizeIpProxyProtocolSafe(ipProxyProtocolRawValue),
    username: String(ipProxyUsernameRawValue || '').trim(),
    password: String(ipProxyPasswordRawValue || ''),
    region: String(ipProxyRegionRawValue || '').trim(),
  };
  const ipProxyServiceProfiles = normalizeIpProxyServiceProfilesSafe({
    ...(latestState?.ipProxyServiceProfiles || {}),
    [selectedIpProxyService]: currentIpProxyServiceProfile,
  }, {
    ...(latestState || {}),
    ipProxyService: selectedIpProxyService,
    ipProxyMode: currentIpProxyServiceProfile.mode,
    ipProxyApiUrl: currentIpProxyServiceProfile.apiUrl,
    ipProxyAccountList: currentIpProxyServiceProfile.accountList,
    ipProxyAccountSessionPrefix: currentIpProxyServiceProfile.accountSessionPrefix,
    ipProxyAccountLifeMinutes: currentIpProxyServiceProfile.accountLifeMinutes,
    ipProxyPoolTargetCount: currentIpProxyServiceProfile.poolTargetCount,
    ipProxyHost: currentIpProxyServiceProfile.host,
    ipProxyPort: currentIpProxyServiceProfile.port,
    ipProxyProtocol: currentIpProxyServiceProfile.protocol,
    ipProxyUsername: currentIpProxyServiceProfile.username,
    ipProxyPassword: currentIpProxyServiceProfile.password,
    ipProxyRegion: currentIpProxyServiceProfile.region,
  });
  const mail2925UseAccountPool = typeof inputMail2925UseAccountPool !== 'undefined'
    ? Boolean(inputMail2925UseAccountPool?.checked)
    : Boolean(latestState?.mail2925UseAccountPool);
  const phoneSmsProviderValue = typeof selectPhoneSmsProvider !== 'undefined' && selectPhoneSmsProvider
    ? normalizePhoneSmsProvider(selectPhoneSmsProvider.value)
    : normalizePhoneSmsProvider(latestState?.phoneSmsProvider);
  const phoneSmsProviderOrderValue = typeof getSelectedPhoneSmsProviderOrder === 'function'
    ? getSelectedPhoneSmsProviderOrder()
    : (typeof normalizePhoneSmsProviderOrderValue === 'function'
      ? normalizePhoneSmsProviderOrderValue(latestState?.phoneSmsProviderOrder || [], [])
      : []);
  const currentPhoneSmsApiKeyValue = typeof inputHeroSmsApiKey !== 'undefined' && inputHeroSmsApiKey
    ? (inputHeroSmsApiKey.value || '')
    : '';
  const heroSmsApiKeyValue = phoneSmsProviderValue === PHONE_SMS_PROVIDER_HERO_SMS
    ? currentPhoneSmsApiKeyValue
    : String(latestState?.heroSmsApiKey || '');
  const fiveSimApiKeyValue = typeof inputFiveSimApiKey !== 'undefined' && inputFiveSimApiKey
    ? String(inputFiveSimApiKey.value || '')
    : String(latestState?.fiveSimApiKey || '');
  const nexSmsApiKeyValue = typeof inputNexSmsApiKey !== 'undefined' && inputNexSmsApiKey
    ? String(inputNexSmsApiKey.value || '')
    : String(latestState?.nexSmsApiKey || '');
  const defaultHeroSmsReuseEnabled = typeof DEFAULT_HERO_SMS_REUSE_ENABLED !== 'undefined'
    ? DEFAULT_HERO_SMS_REUSE_ENABLED
    : true;
  const defaultPhoneCodeWaitSeconds = typeof DEFAULT_PHONE_CODE_WAIT_SECONDS !== 'undefined'
    ? DEFAULT_PHONE_CODE_WAIT_SECONDS
    : 60;
  const defaultPhoneCodeTimeoutWindows = typeof DEFAULT_PHONE_CODE_TIMEOUT_WINDOWS !== 'undefined'
    ? DEFAULT_PHONE_CODE_TIMEOUT_WINDOWS
    : 2;
  const defaultPhoneCodePollIntervalSeconds = typeof DEFAULT_PHONE_CODE_POLL_INTERVAL_SECONDS !== 'undefined'
    ? DEFAULT_PHONE_CODE_POLL_INTERVAL_SECONDS
    : 5;
  const defaultPhoneCodePollMaxRounds = typeof DEFAULT_PHONE_CODE_POLL_MAX_ROUNDS !== 'undefined'
    ? DEFAULT_PHONE_CODE_POLL_MAX_ROUNDS
    : 12;
  const heroSmsReuseEnabledValue = typeof inputHeroSmsReuseEnabled !== 'undefined' && inputHeroSmsReuseEnabled
    ? normalizeHeroSmsReuseEnabledValue(inputHeroSmsReuseEnabled.checked)
    : defaultHeroSmsReuseEnabled;
  const freePhoneReuseEnabledValue = typeof inputFreePhoneReuseEnabled !== 'undefined' && inputFreePhoneReuseEnabled
    ? Boolean(inputFreePhoneReuseEnabled.checked)
    : Boolean(latestState?.freePhoneReuseEnabled);
  const freePhoneReuseAutoEnabledValue = typeof inputFreePhoneReuseAutoEnabled !== 'undefined' && inputFreePhoneReuseAutoEnabled
    ? Boolean(inputFreePhoneReuseAutoEnabled.checked)
    : Boolean(latestState?.freePhoneReuseAutoEnabled);
  const defaultHeroSmsAcquirePriority = typeof DEFAULT_HERO_SMS_ACQUIRE_PRIORITY !== 'undefined'
    ? DEFAULT_HERO_SMS_ACQUIRE_PRIORITY
    : (typeof HERO_SMS_ACQUIRE_PRIORITY_COUNTRY !== 'undefined' ? HERO_SMS_ACQUIRE_PRIORITY_COUNTRY : 'country');
  const heroSmsAcquirePriorityValue = typeof selectHeroSmsAcquirePriority !== 'undefined' && selectHeroSmsAcquirePriority
    ? normalizeHeroSmsAcquirePriority(selectHeroSmsAcquirePriority.value)
    : normalizeHeroSmsAcquirePriority(
      typeof DEFAULT_HERO_SMS_ACQUIRE_PRIORITY !== 'undefined'
        ? DEFAULT_HERO_SMS_ACQUIRE_PRIORITY
        : 'country'
    );
  const currentPhoneSmsMaxPriceValue = typeof inputHeroSmsMaxPrice !== 'undefined' && inputHeroSmsMaxPrice
    ? normalizePhoneSmsMaxPriceValue(inputHeroSmsMaxPrice.value, phoneSmsProviderValue)
    : '';
  const heroSmsMaxPriceValue = phoneSmsProviderValue === PHONE_SMS_PROVIDER_HERO_SMS
    ? currentPhoneSmsMaxPriceValue
    : normalizeHeroSmsMaxPriceValue(latestState?.heroSmsMaxPrice || '');
  const fiveSimMaxPriceValue = phoneSmsProviderValue === PHONE_SMS_PROVIDER_FIVE_SIM
    ? currentPhoneSmsMaxPriceValue
    : normalizeFiveSimMaxPriceValue(latestState?.fiveSimMaxPrice || '');
  const defaultFiveSimProduct = typeof DEFAULT_FIVE_SIM_PRODUCT !== 'undefined'
    ? DEFAULT_FIVE_SIM_PRODUCT
    : 'openai';
  const defaultNexSmsServiceCode = typeof DEFAULT_NEX_SMS_SERVICE_CODE !== 'undefined'
    ? DEFAULT_NEX_SMS_SERVICE_CODE
    : 'ot';
  const normalizeFiveSimProductForPayload = typeof normalizeFiveSimProductValue === 'function'
    ? normalizeFiveSimProductValue
    : ((value = '') => String(value || '').trim().toLowerCase().replace(/[^a-z0-9_-]+/g, '') || defaultFiveSimProduct);
  const normalizeNexSmsServiceCodeForPayload = typeof normalizeNexSmsServiceCodeValue === 'function'
    ? normalizeNexSmsServiceCodeValue
    : ((value = '') => String(value || '').trim().toLowerCase().replace(/[^a-z0-9_-]+/g, '') || defaultNexSmsServiceCode);
  const normalizeFiveSimCountryOrderForPayload = typeof normalizeFiveSimCountryOrderValue === 'function'
    ? normalizeFiveSimCountryOrderValue
    : ((value = []) => (Array.isArray(value) ? value : [])
      .map((entry) => normalizeFiveSimCountryId(entry, ''))
      .filter(Boolean));
  const normalizeNexSmsCountryIdForPayload = typeof normalizeNexSmsCountryIdValue === 'function'
    ? normalizeNexSmsCountryIdValue
    : ((value, fallback = -1) => {
      const normalized = Math.floor(Number(value));
      return Number.isFinite(normalized) && normalized >= 0 ? normalized : fallback;
    });
  const normalizeNexSmsCountryOrderForPayload = typeof normalizeNexSmsCountryOrderValue === 'function'
    ? normalizeNexSmsCountryOrderValue
    : ((value = []) => (Array.isArray(value) ? value : [])
      .map((entry) => normalizeNexSmsCountryIdForPayload(entry, -1))
      .filter((entry) => entry >= 0));
  const phoneSmsProviderNexsms = typeof PHONE_SMS_PROVIDER_NEXSMS !== 'undefined'
    ? PHONE_SMS_PROVIDER_NEXSMS
    : 'nexsms';
  const defaultNexSmsCountryOrder = typeof DEFAULT_NEX_SMS_COUNTRY_ORDER !== 'undefined'
    ? DEFAULT_NEX_SMS_COUNTRY_ORDER
    : [1];
  const fiveSimOperatorValue = typeof inputFiveSimOperator !== 'undefined' && inputFiveSimOperator
    ? normalizeFiveSimOperator(inputFiveSimOperator.value || latestState?.fiveSimOperator)
    : normalizeFiveSimOperator(latestState?.fiveSimOperator);
  const fiveSimProductValue = typeof inputFiveSimProduct !== 'undefined' && inputFiveSimProduct
    ? normalizeFiveSimProductForPayload(inputFiveSimProduct.value || latestState?.fiveSimProduct)
    : normalizeFiveSimProductForPayload(latestState?.fiveSimProduct || defaultFiveSimProduct);
  const nexSmsServiceCodeValue = typeof inputNexSmsServiceCode !== 'undefined' && inputNexSmsServiceCode
    ? normalizeNexSmsServiceCodeForPayload(inputNexSmsServiceCode.value || latestState?.nexSmsServiceCode)
    : normalizeNexSmsServiceCodeForPayload(latestState?.nexSmsServiceCode || defaultNexSmsServiceCode);
  const heroSmsPreferredPriceValue = typeof inputHeroSmsPreferredPrice !== 'undefined' && inputHeroSmsPreferredPrice
    ? normalizeHeroSmsMaxPriceValue(inputHeroSmsPreferredPrice.value)
    : normalizeHeroSmsMaxPriceValue(latestState?.heroSmsPreferredPrice || '');
  const phonePreferredActivationValue = typeof getSelectedPhonePreferredActivation === 'function'
    ? getSelectedPhonePreferredActivation()
    : null;
  const phoneVerificationReplacementLimitValue = typeof inputPhoneReplacementLimit !== 'undefined' && inputPhoneReplacementLimit
    ? normalizePhoneVerificationReplacementLimit(
      inputPhoneReplacementLimit.value,
      latestState?.phoneVerificationReplacementLimit
    )
    : DEFAULT_PHONE_VERIFICATION_REPLACEMENT_LIMIT;
  const phoneCodeWaitSecondsValue = typeof inputPhoneCodeWaitSeconds !== 'undefined' && inputPhoneCodeWaitSeconds
    ? normalizePhoneCodeWaitSecondsValue(
      inputPhoneCodeWaitSeconds.value,
      latestState?.phoneCodeWaitSeconds
    )
    : defaultPhoneCodeWaitSeconds;
  const phoneCodeTimeoutWindowsValue = typeof inputPhoneCodeTimeoutWindows !== 'undefined' && inputPhoneCodeTimeoutWindows
    ? normalizePhoneCodeTimeoutWindowsValue(
      inputPhoneCodeTimeoutWindows.value,
      latestState?.phoneCodeTimeoutWindows
    )
    : defaultPhoneCodeTimeoutWindows;
  const phoneCodePollIntervalSecondsValue = typeof inputPhoneCodePollIntervalSeconds !== 'undefined' && inputPhoneCodePollIntervalSeconds
    ? normalizePhoneCodePollIntervalSecondsValue(
      inputPhoneCodePollIntervalSeconds.value,
      latestState?.phoneCodePollIntervalSeconds
    )
    : defaultPhoneCodePollIntervalSeconds;
  const phoneCodePollMaxRoundsValue = typeof inputPhoneCodePollMaxRounds !== 'undefined' && inputPhoneCodePollMaxRounds
    ? normalizePhoneCodePollMaxRoundsValue(
      inputPhoneCodePollMaxRounds.value,
      latestState?.phoneCodePollMaxRounds
    )
    : defaultPhoneCodePollMaxRounds;
  const selectedPhoneSmsCountry = phoneSmsProviderValue === PHONE_SMS_PROVIDER_FIVE_SIM
    ? ((typeof getSelectedFiveSimCountries === 'function' ? getSelectedFiveSimCountries()[0] : null)
      || { id: DEFAULT_FIVE_SIM_COUNTRY_ID, code: DEFAULT_FIVE_SIM_COUNTRY_ID, label: DEFAULT_FIVE_SIM_COUNTRY_LABEL })
    : (phoneSmsProviderValue === phoneSmsProviderNexsms
      ? ((typeof getSelectedNexSmsCountries === 'function' ? getSelectedNexSmsCountries()[0] : null)
        || { id: defaultNexSmsCountryOrder[0], label: `Country #${defaultNexSmsCountryOrder[0]}` })
      : (typeof getSelectedHeroSmsCountryOption === 'function'
        ? getSelectedHeroSmsCountryOption()
        : {
          id: typeof DEFAULT_HERO_SMS_COUNTRY_ID !== 'undefined' ? DEFAULT_HERO_SMS_COUNTRY_ID : 52,
          label: typeof DEFAULT_HERO_SMS_COUNTRY_LABEL !== 'undefined' ? DEFAULT_HERO_SMS_COUNTRY_LABEL : 'Thailand',
        }));
  const heroSmsCountry = phoneSmsProviderValue === PHONE_SMS_PROVIDER_HERO_SMS
    ? selectedPhoneSmsCountry
    : {
      id: normalizeHeroSmsCountryId(latestState?.heroSmsCountryId),
      label: normalizeHeroSmsCountryLabel(latestState?.heroSmsCountryLabel),
    };
  const fiveSimCountry = phoneSmsProviderValue === PHONE_SMS_PROVIDER_FIVE_SIM
    ? selectedPhoneSmsCountry
    : {
      id: normalizeFiveSimCountryId(latestState?.fiveSimCountryId),
      label: normalizeFiveSimCountryLabel(latestState?.fiveSimCountryLabel),
    };
  const normalizedCustomEmailPool = typeof getActiveCustomEmailPoolEmails === 'function'
    ? getActiveCustomEmailPoolEmails()
    : (typeof normalizeCustomEmailPoolEntries === 'function'
      ? normalizeCustomEmailPoolEntries(inputCustomEmailPool?.value)
      : []);
  const normalizedCustomEmailPoolEntries = typeof getNormalizedCustomEmailPoolEntriesState === 'function'
    ? getNormalizedCustomEmailPoolEntriesState()
    : [];
  const selectedPhoneSmsCountryFallback = typeof syncHeroSmsFallbackSelectionOrderFromSelect === 'function'
    ? syncHeroSmsFallbackSelectionOrderFromSelect()
      .filter((country) => String(country.id) !== String(selectedPhoneSmsCountry.id))
    : [];
  const fiveSimCountryOrderValue = typeof getSelectedFiveSimCountries === 'function'
    ? getSelectedFiveSimCountries()
      .map((country) => normalizeFiveSimCountryCode(country.code || country.id, ''))
      .filter(Boolean)
    : normalizeFiveSimCountryOrderForPayload(latestState?.fiveSimCountryOrder || []);
  const nexSmsCountryOrderValue = typeof getSelectedNexSmsCountries === 'function'
    ? getSelectedNexSmsCountries()
      .map((country) => normalizeNexSmsCountryIdForPayload(country.id, -1))
      .filter((countryId) => countryId >= 0)
    : normalizeNexSmsCountryOrderForPayload(latestState?.nexSmsCountryOrder || []);
  const heroSmsCountryFallback = phoneSmsProviderValue === PHONE_SMS_PROVIDER_HERO_SMS
    ? selectedPhoneSmsCountryFallback
    : normalizeHeroSmsCountryFallbackList(latestState?.heroSmsCountryFallback || []);
  const fiveSimCountryFallback = phoneSmsProviderValue === PHONE_SMS_PROVIDER_FIVE_SIM
    ? selectedPhoneSmsCountryFallback
    : normalizeFiveSimCountryFallbackList(latestState?.fiveSimCountryFallback || []);
  const payPalAccounts = typeof getPayPalAccounts === 'function'
    ? getPayPalAccounts(latestState)
    : (Array.isArray(latestState?.paypalAccounts) ? latestState.paypalAccounts : []);
  const currentPayPalAccount = typeof getCurrentPayPalAccount === 'function'
    ? getCurrentPayPalAccount(latestState)
    : payPalAccounts.find((account) => account?.id === String(latestState?.currentPayPalAccountId || '').trim()) || null;
  const selectedSignupMethod = typeof getSelectedSignupMethod === 'function'
    ? getSelectedSignupMethod()
    : (
      (typeof normalizeSignupMethod === 'function'
        ? normalizeSignupMethod(latestState?.signupMethod)
        : (String(latestState?.signupMethod || '').trim().toLowerCase() === 'phone' ? 'phone' : 'email'))
    );
  const plusPaymentMethod = getSelectedPlusPaymentMethod();
  const normalizeGpcHelperPhoneModeSafe = typeof normalizeGpcHelperPhoneModeValue === 'function'
    ? normalizeGpcHelperPhoneModeValue
    : ((value = '') => String(value || '').trim().toLowerCase() === 'auto' || String(value || '').trim().toLowerCase() === 'builtin' ? 'auto' : 'manual');
  const selectedGpcPhoneMode = normalizeGpcHelperPhoneModeSafe(
    typeof selectGpcHelperPhoneMode !== 'undefined' && selectGpcHelperPhoneMode
      ? selectGpcHelperPhoneMode.value
      : (latestState?.gopayHelperPhoneMode || 'manual')
  );
  const effectiveGpcPhoneMode = (typeof isGpcAutoModePermissionDenied === 'function' && isGpcAutoModePermissionDenied(latestState))
    ? 'manual'
    : selectedGpcPhoneMode;
  const selectedGpcOtpChannel = normalizeGpcOtpChannelSafe(
    typeof selectGpcHelperOtpChannel !== 'undefined' && selectGpcHelperOtpChannel
      ? selectGpcHelperOtpChannel.value
      : (latestState?.gopayHelperOtpChannel || 'whatsapp')
  );
  const selectedGpcLocalSmsHelperEnabled = effectiveGpcPhoneMode === 'auto' ? false : Boolean(
    typeof inputGpcHelperLocalSmsEnabled !== 'undefined' && inputGpcHelperLocalSmsEnabled
      ? inputGpcHelperLocalSmsEnabled.checked
      : latestState?.gopayHelperLocalSmsHelperEnabled
  );
  const selectedSub2ApiGroupName = String(inputSub2ApiGroup.value || '').trim();
  const sub2apiGroupNames = [];
  const seenSub2ApiGroupNames = new Set();
  const appendSub2ApiGroupNames = (value) => {
    if (Array.isArray(value)) {
      value.forEach(appendSub2ApiGroupNames);
      return;
    }
    String(value || '')
      .split(/[\r\n,，、]+/)
      .map((name) => name.trim())
      .filter(Boolean)
      .forEach((name) => {
        const key = name.toLowerCase();
        if (!key || seenSub2ApiGroupNames.has(key)) {
          return;
        }
        seenSub2ApiGroupNames.add(key);
        sub2apiGroupNames.push(name);
      });
  };
  [
    latestState?.sub2apiGroupNames,
    latestState?.sub2apiGroupName,
    selectedSub2ApiGroupName,
  ].forEach(appendSub2ApiGroupNames);
  if (sub2apiGroupNames.length === 0) {
    appendSub2ApiGroupNames(['codex', 'openai-plus']);
  }
  const sub2apiAccountPriorityNormalizer = typeof normalizeSub2ApiAccountPriorityValue === 'function'
    ? normalizeSub2ApiAccountPriorityValue
    : ((value) => {
      const numeric = Number(String(value ?? '').trim());
      return Number.isSafeInteger(numeric) && numeric >= 1 ? numeric : 1;
    });
  return {
    ...(contributionModeEnabled ? {} : {
      panelMode: selectPanelMode.value,
    }),
    vpsUrl: inputVpsUrl.value.trim(),
    vpsPassword: inputVpsPassword.value,
    localCpaStep9Mode: getSelectedLocalCpaStep9Mode(),
    sub2apiUrl: inputSub2ApiUrl.value.trim(),
    sub2apiEmail: inputSub2ApiEmail.value.trim(),
    sub2apiPassword: inputSub2ApiPassword.value,
    sub2apiGroupName: selectedSub2ApiGroupName,
    sub2apiGroupNames,
    sub2apiAccountPriority: sub2apiAccountPriorityNormalizer(
      typeof inputSub2ApiAccountPriority !== 'undefined' && inputSub2ApiAccountPriority
        ? inputSub2ApiAccountPriority.value
        : latestState?.sub2apiAccountPriority
    ),
    sub2apiDefaultProxyName: inputSub2ApiDefaultProxy.value.trim(),
    ipProxyEnabled: getSelectedIpProxyEnabledSafe(),
    ipProxyService: selectedIpProxyService,
    ipProxyMode: currentIpProxyServiceProfile.mode,
    ipProxyApiUrl: currentIpProxyServiceProfile.apiUrl,
    ipProxyServiceProfiles,
    ipProxyAccountList: currentIpProxyServiceProfile.accountList,
    ipProxyAccountSessionPrefix: currentIpProxyServiceProfile.accountSessionPrefix,
    ipProxyAccountLifeMinutes: currentIpProxyServiceProfile.accountLifeMinutes,
    ipProxyPoolTargetCount: currentIpProxyServiceProfile.poolTargetCount,
    ipProxyAutoSyncEnabled: Boolean(ipProxyAutoSyncEnabledRawValue),
    ipProxyAutoSyncIntervalMinutes: normalizeIpProxyAutoSyncIntervalMinutesSafe(
      ipProxyAutoSyncIntervalMinutesRawValue,
      latestState?.ipProxyAutoSyncIntervalMinutes
    ),
    ipProxyHost: currentIpProxyServiceProfile.host,
    ipProxyPort: normalizeIpProxyPortSafe(currentIpProxyServiceProfile.port),
    ipProxyProtocol: currentIpProxyServiceProfile.protocol,
    ipProxyUsername: currentIpProxyServiceProfile.username,
    ipProxyPassword: currentIpProxyServiceProfile.password,
    ipProxyRegion: currentIpProxyServiceProfile.region,
    codex2apiUrl: inputCodex2ApiUrl.value.trim(),
    codex2apiAdminKey: inputCodex2ApiAdminKey.value.trim(),
    plusModeEnabled: typeof inputPlusModeEnabled !== 'undefined' && inputPlusModeEnabled
      ? Boolean(inputPlusModeEnabled.checked)
      : Boolean(latestState?.plusModeEnabled),
    plusPaymentMethod,
    paypalEmail: String(currentPayPalAccount?.email || latestState?.paypalEmail || '').trim(),
    paypalPassword: String(currentPayPalAccount?.password || latestState?.paypalPassword || ''),
    currentPayPalAccountId: String(latestState?.currentPayPalAccountId || '').trim(),
    paypalAccounts: payPalAccounts,
    gopayCountryCode: window.GoPayUtils?.normalizeGoPayCountryCode
      ? window.GoPayUtils.normalizeGoPayCountryCode(typeof selectGoPayCountryCode !== 'undefined' && selectGoPayCountryCode ? selectGoPayCountryCode.value : latestState?.gopayCountryCode)
      : (typeof selectGoPayCountryCode !== 'undefined' && selectGoPayCountryCode
        ? String(selectGoPayCountryCode.value || '+86').trim()
        : String(latestState?.gopayCountryCode || '+86').trim()),
    gopayPhone: window.GoPayUtils?.normalizeGoPayPhone
      ? window.GoPayUtils.normalizeGoPayPhone(typeof inputGoPayPhone !== 'undefined' && inputGoPayPhone ? inputGoPayPhone.value : latestState?.gopayPhone)
      : (typeof inputGoPayPhone !== 'undefined' && inputGoPayPhone
        ? String(inputGoPayPhone.value || '').trim()
        : String(latestState?.gopayPhone || '').trim()),
    gopayOtp: window.GoPayUtils?.normalizeGoPayOtp
      ? window.GoPayUtils.normalizeGoPayOtp(typeof inputGoPayOtp !== 'undefined' && inputGoPayOtp ? inputGoPayOtp.value : latestState?.gopayOtp)
      : (typeof inputGoPayOtp !== 'undefined' && inputGoPayOtp
        ? String(inputGoPayOtp.value || '').trim().replace(/[^\d]/g, '')
        : String(latestState?.gopayOtp || '').trim().replace(/[^\d]/g, '')),
    gopayPin: window.GoPayUtils?.normalizeGoPayPin
      ? window.GoPayUtils.normalizeGoPayPin(typeof inputGoPayPin !== 'undefined' && inputGoPayPin ? inputGoPayPin.value : latestState?.gopayPin)
      : (typeof inputGoPayPin !== 'undefined' && inputGoPayPin
        ? String(inputGoPayPin.value || '')
        : String(latestState?.gopayPin || '')),
    gopayHelperApiUrl: window.GoPayUtils?.normalizeGpcHelperBaseUrl
      ? window.GoPayUtils.normalizeGpcHelperBaseUrl(defaultGpcHelperApiUrl)
      : String(defaultGpcHelperApiUrl).trim().replace(/\/+$/g, ''),
    gopayHelperApiKey: typeof inputGpcHelperCardKey !== 'undefined' && inputGpcHelperCardKey
      ? String(inputGpcHelperCardKey.value || '').trim()
      : String(latestState?.gopayHelperApiKey || latestState?.gopayHelperCardKey || '').trim(),
    gopayHelperCardKey: '',
    gopayHelperPhoneMode: effectiveGpcPhoneMode,
    gopayHelperCountryCode: window.GoPayUtils?.normalizeGoPayCountryCode
      ? window.GoPayUtils.normalizeGoPayCountryCode(typeof selectGpcHelperCountryCode !== 'undefined' && selectGpcHelperCountryCode ? selectGpcHelperCountryCode.value : latestState?.gopayHelperCountryCode)
      : (typeof selectGpcHelperCountryCode !== 'undefined' && selectGpcHelperCountryCode
        ? String(selectGpcHelperCountryCode.value || '+86').trim()
        : String(latestState?.gopayHelperCountryCode || '+86').trim()),
    gopayHelperPhoneNumber: window.GoPayUtils?.normalizeGoPayPhone
      ? window.GoPayUtils.normalizeGoPayPhone(typeof inputGpcHelperPhone !== 'undefined' && inputGpcHelperPhone ? inputGpcHelperPhone.value : latestState?.gopayHelperPhoneNumber)
      : (typeof inputGpcHelperPhone !== 'undefined' && inputGpcHelperPhone
        ? String(inputGpcHelperPhone.value || '').trim()
        : String(latestState?.gopayHelperPhoneNumber || '').trim()),
    gopayHelperPin: window.GoPayUtils?.normalizeGoPayPin
      ? window.GoPayUtils.normalizeGoPayPin(typeof inputGpcHelperPin !== 'undefined' && inputGpcHelperPin ? inputGpcHelperPin.value : latestState?.gopayHelperPin)
      : (typeof inputGpcHelperPin !== 'undefined' && inputGpcHelperPin
        ? String(inputGpcHelperPin.value || '')
        : String(latestState?.gopayHelperPin || '')),
    gopayHelperOtpChannel: selectedGpcOtpChannel,
    gopayHelperLocalSmsHelperEnabled: selectedGpcLocalSmsHelperEnabled,
    gopayHelperLocalSmsHelperUrl: normalizeGpcLocalSmsHelperBaseUrlSafe(
      typeof inputGpcHelperLocalSmsUrl !== 'undefined' && inputGpcHelperLocalSmsUrl
        ? inputGpcHelperLocalSmsUrl.value
        : (latestState?.gopayHelperLocalSmsHelperUrl || '')
    ),
    ...(contributionModeEnabled ? {} : {
      customPassword: inputPassword.value,
    }),
    mailProvider: selectMailProvider.value,
    mail2925Mode: getSelectedMail2925Mode(),
    mail2925UseAccountPool,
    currentMail2925AccountId: String(latestState?.currentMail2925AccountId || '').trim(),
    emailGenerator: selectEmailGenerator.value,
    customMailProviderPool: typeof normalizeCustomEmailPoolEntries === 'function'
      ? normalizeCustomEmailPoolEntries(inputCustomMailProviderPool?.value)
      : [],
    customEmailPool: normalizedCustomEmailPool,
    customEmailPoolEntries: normalizedCustomEmailPoolEntries,
    autoDeleteUsedIcloudAlias: checkboxAutoDeleteIcloud?.checked,
    icloudHostPreference: selectIcloudHostPreference?.value || 'auto',
    icloudTargetMailboxType: normalizedIcloudTargetMailboxType,
    icloudForwardMailProvider: normalizedIcloudForwardMailProvider,
    icloudFetchMode: (icloudFetchModeRawValue.trim().toLowerCase() === 'always_new'
      ? 'always_new'
      : 'reuse_existing'),
    ...(contributionModeEnabled ? {} : {
      accountRunHistoryTextEnabled: true,
      accountRunHistoryHelperBaseUrl: normalizeAccountRunHistoryHelperBaseUrlValue(inputAccountRunHistoryHelperBaseUrl?.value),
    }),
    ...buildManagedAliasBaseEmailPayload(),
    inbucketHost: inputInbucketHost.value.trim(),
    inbucketMailbox: inputInbucketMailbox.value.trim(),
    hotmailServiceMode: getSelectedHotmailServiceMode(),
    hotmailRemoteBaseUrl: inputHotmailRemoteBaseUrl.value.trim(),
    hotmailLocalBaseUrl: inputHotmailLocalBaseUrl.value.trim(),
    luckmailApiKey: inputLuckmailApiKey.value,
    luckmailBaseUrl: normalizeLuckmailBaseUrl(inputLuckmailBaseUrl.value),
    luckmailEmailType: normalizeLuckmailEmailType(selectLuckmailEmailType.value),
    luckmailDomain: inputLuckmailDomain.value.trim(),
    cloudflareDomain: selectedCloudflareDomain,
    cloudflareDomains: domains,
    cloudflareTempEmailBaseUrl: normalizeCloudflareTempEmailBaseUrlValue(inputTempEmailBaseUrl.value),
    cloudflareTempEmailAdminAuth: inputTempEmailAdminAuth.value,
    cloudflareTempEmailCustomAuth: inputTempEmailCustomAuth.value,
    cloudflareTempEmailReceiveMailbox: normalizeCloudflareTempEmailReceiveMailboxValue(inputTempEmailReceiveMailbox.value),
    cloudflareTempEmailUseRandomSubdomain: Boolean(inputTempEmailUseRandomSubdomain?.checked),
    cloudflareTempEmailDomain: selectedCloudflareTempEmailDomain,
    cloudflareTempEmailDomains: tempEmailDomains,
    cloudMailBaseUrl: normalizeCloudMailBaseUrlInput((typeof inputCloudMailBaseUrl !== 'undefined' && inputCloudMailBaseUrl) ? inputCloudMailBaseUrl.value : ''),
    cloudMailAdminEmail: ((typeof inputCloudMailAdminEmail !== 'undefined' && inputCloudMailAdminEmail) ? inputCloudMailAdminEmail.value : '').trim(),
    cloudMailAdminPassword: (typeof inputCloudMailAdminPassword !== 'undefined' && inputCloudMailAdminPassword) ? inputCloudMailAdminPassword.value : '',
    cloudMailReceiveMailbox: normalizeCloudMailReceiveMailboxInput((typeof inputCloudMailReceiveMailbox !== 'undefined' && inputCloudMailReceiveMailbox) ? inputCloudMailReceiveMailbox.value : ''),
    cloudMailDomain: normalizeCloudMailDomainInput((typeof inputCloudMailDomain !== 'undefined' && inputCloudMailDomain) ? inputCloudMailDomain.value : ''),
    autoRunSkipFailures: inputAutoSkipFailures.checked,
    autoRunFallbackThreadIntervalMinutes: normalizeAutoRunThreadIntervalMinutes(inputAutoSkipFailuresThreadIntervalMinutes.value),
    step6CookieCleanupEnabled: typeof inputStep6CookieCleanupEnabled !== 'undefined' && inputStep6CookieCleanupEnabled
      ? Boolean(inputStep6CookieCleanupEnabled.checked)
      : false,
    autoRunDelayEnabled: inputAutoDelayEnabled.checked,
    autoRunDelayMinutes: normalizeAutoDelayMinutes(inputAutoDelayMinutes.value),
    autoStepDelaySeconds: normalizeAutoStepDelaySeconds(inputAutoStepDelaySeconds.value),
    oauthFlowTimeoutEnabled: typeof inputOAuthFlowTimeoutEnabled !== 'undefined' && inputOAuthFlowTimeoutEnabled
      ? Boolean(inputOAuthFlowTimeoutEnabled.checked)
      : true,
    phoneVerificationEnabled: Boolean(inputPhoneVerificationEnabled?.checked),
    signupMethod: selectedSignupMethod,
    phoneSmsProvider: phoneSmsProviderValue,
    phoneSmsProviderOrder: phoneSmsProviderOrderValue,
    verificationResendCount: normalizeVerificationResendCount(
      inputVerificationResendCount?.value,
      DEFAULT_VERIFICATION_RESEND_COUNT
    ),
    heroSmsApiKey: heroSmsApiKeyValue,
    fiveSimApiKey: fiveSimApiKeyValue,
    fiveSimCountryOrder: fiveSimCountryOrderValue,
    fiveSimOperator: fiveSimOperatorValue,
    fiveSimProduct: fiveSimProductValue,
    nexSmsApiKey: nexSmsApiKeyValue,
    nexSmsCountryOrder: nexSmsCountryOrderValue,
    nexSmsServiceCode: nexSmsServiceCodeValue,
    heroSmsReuseEnabled: heroSmsReuseEnabledValue,
    freePhoneReuseEnabled: freePhoneReuseEnabledValue,
    freePhoneReuseAutoEnabled: freePhoneReuseAutoEnabledValue,
    heroSmsAcquirePriority: heroSmsAcquirePriorityValue,
    heroSmsMaxPrice: heroSmsMaxPriceValue,
    heroSmsPreferredPrice: heroSmsPreferredPriceValue,
    phonePreferredActivation: phonePreferredActivationValue,
    phoneVerificationReplacementLimit: phoneVerificationReplacementLimitValue,
    phoneCodeWaitSeconds: phoneCodeWaitSecondsValue,
    phoneCodeTimeoutWindows: phoneCodeTimeoutWindowsValue,
    phoneCodePollIntervalSeconds: phoneCodePollIntervalSecondsValue,
    phoneCodePollMaxRounds: phoneCodePollMaxRoundsValue,
    heroSmsCountryId: heroSmsCountry.id,
    heroSmsCountryLabel: heroSmsCountry.label,
    heroSmsCountryFallback,
    fiveSimCountryId: fiveSimCountry.id,
    fiveSimCountryLabel: fiveSimCountry.label,
    fiveSimCountryFallback,
    fiveSimMaxPrice: fiveSimMaxPriceValue,
  };
}

function normalizeLocalCpaStep9Mode(value = '') {
  return String(value || '').trim().toLowerCase() === 'bypass'
    ? 'bypass'
    : DEFAULT_LOCAL_CPA_STEP9_MODE;
}

function normalizeMail2925Mode(value = '') {
  return String(value || '').trim().toLowerCase() === MAIL_2925_MODE_RECEIVE
    ? MAIL_2925_MODE_RECEIVE
    : DEFAULT_MAIL_2925_MODE;
}

function normalizeHotmailServiceMode(value = '') {
  if (typeof normalizeHotmailServiceModeFromUtils === 'function') {
    return normalizeHotmailServiceModeFromUtils(value);
  }
  return String(value || '').trim().toLowerCase() === HOTMAIL_SERVICE_MODE_REMOTE
    ? HOTMAIL_SERVICE_MODE_REMOTE
    : HOTMAIL_SERVICE_MODE_LOCAL;
}

function normalizeAccountRunHistoryHelperBaseUrlValue(value = '') {
  const trimmed = String(value || '').trim();
  if (!trimmed) {
    return DEFAULT_ACCOUNT_RUN_HISTORY_HELPER_BASE_URL;
  }

  try {
    const parsed = new URL(trimmed);
    if (!['http:', 'https:'].includes(parsed.protocol)) {
      return DEFAULT_ACCOUNT_RUN_HISTORY_HELPER_BASE_URL;
    }

    if (parsed.pathname === '/append-account-log' || parsed.pathname === '/sync-account-run-records') {
      parsed.pathname = '';
      parsed.search = '';
      parsed.hash = '';
    }

    return parsed.toString().replace(/\/$/, '');
  } catch {
    return DEFAULT_ACCOUNT_RUN_HISTORY_HELPER_BASE_URL;
  }
}


function normalizePhoneSmsProvider(value = '') {
  if (typeof window !== 'undefined' && window.PhoneSmsProviderRegistry?.normalizeProviderId) {
    return window.PhoneSmsProviderRegistry.normalizeProviderId(value);
  }
  const normalized = String(value || '').trim().toLowerCase();
  return normalized === PHONE_SMS_PROVIDER_FIVE_SIM
    ? PHONE_SMS_PROVIDER_FIVE_SIM
    : PHONE_SMS_PROVIDER_HERO_SMS;
}

function setPhoneSmsProviderSelectValue(provider) {
  const normalizedProvider = normalizePhoneSmsProvider(provider);
  if (selectPhoneSmsProvider) {
    selectPhoneSmsProvider.value = normalizedProvider;
    if (selectPhoneSmsProvider.dataset) {
      selectPhoneSmsProvider.dataset.activeProvider = normalizedProvider;
    }
  }
  return normalizedProvider;
}

function getLastAppliedPhoneSmsProvider() {
  return normalizePhoneSmsProvider(
    selectPhoneSmsProvider?.dataset?.activeProvider
      || latestState?.phoneSmsProvider
      || selectPhoneSmsProvider?.value
  );
}

function getSelectedPhoneSmsProvider() {
  return normalizePhoneSmsProvider(selectPhoneSmsProvider?.value || latestState?.phoneSmsProvider);
}

function getPhoneSmsProviderLabel(provider = getSelectedPhoneSmsProvider()) {
  if (typeof window !== 'undefined' && window.PhoneSmsProviderRegistry?.getProviderLabel) {
    return window.PhoneSmsProviderRegistry.getProviderLabel(provider);
  }
  return normalizePhoneSmsProvider(provider) === PHONE_SMS_PROVIDER_FIVE_SIM ? '5sim' : 'HeroSMS';
}

function isFiveSimProviderSelected() {
  return getSelectedPhoneSmsProvider() === PHONE_SMS_PROVIDER_FIVE_SIM;
}

function normalizePhoneSmsCountryId(value, provider = getSelectedPhoneSmsProvider()) {
  if (normalizePhoneSmsProvider(provider) === PHONE_SMS_PROVIDER_FIVE_SIM) {
    return normalizeFiveSimCountryId(value);
  }
  return normalizeHeroSmsCountryId(value);
}

function normalizePhoneSmsCountryLabel(value = '', provider = getSelectedPhoneSmsProvider()) {
  if (normalizePhoneSmsProvider(provider) === PHONE_SMS_PROVIDER_FIVE_SIM) {
    return normalizeFiveSimCountryLabel(value);
  }
  return normalizeHeroSmsCountryLabel(value);
}

function normalizePhoneSmsMaxPriceValue(value = '', provider = getSelectedPhoneSmsProvider()) {
  if (normalizePhoneSmsProvider(provider) === PHONE_SMS_PROVIDER_FIVE_SIM) {
    return normalizeFiveSimMaxPriceValue(value);
  }
  return normalizeHeroSmsMaxPriceValue(value);
}

function normalizeFiveSimCountryId(value, fallback = DEFAULT_FIVE_SIM_COUNTRY_ID) {
  const fallbackSource = fallback === undefined || fallback === null ? DEFAULT_FIVE_SIM_COUNTRY_ID : fallback;
  const normalizedFallback = String(fallbackSource).trim().toLowerCase().replace(/[^a-z0-9_-]+/g, '');
  const rawNormalized = typeof window !== 'undefined' && window.PhoneSmsFiveSimProvider?.normalizeFiveSimCountryId
    ? window.PhoneSmsFiveSimProvider.normalizeFiveSimCountryId(value, '')
    : String(value || '').trim().toLowerCase().replace(/[^a-z0-9_-]+/g, '');
  const normalized = String(rawNormalized || '').trim().toLowerCase();
  if (normalized) {
    return normalized;
  }
  if (!normalizedFallback) {
    return '';
  }
  return normalizedFallback || DEFAULT_FIVE_SIM_COUNTRY_ID;
}

function normalizeFiveSimCountryLabel(value = '', fallback = DEFAULT_FIVE_SIM_COUNTRY_LABEL) {
  if (typeof window !== 'undefined' && window.PhoneSmsFiveSimProvider?.normalizeFiveSimCountryLabel) {
    return window.PhoneSmsFiveSimProvider.normalizeFiveSimCountryLabel(value, fallback);
  }
  return String(value || '').trim() || fallback;
}

function formatFiveSimCountryDisplayLabel(id = '', englishValue = '', fallback = DEFAULT_FIVE_SIM_COUNTRY_LABEL) {
  if (typeof window !== 'undefined' && window.PhoneSmsFiveSimProvider?.formatFiveSimCountryLabel) {
    return window.PhoneSmsFiveSimProvider.formatFiveSimCountryLabel(id, englishValue, fallback);
  }
  const countryId = normalizeFiveSimCountryId(id, '');
  const english = normalizeFiveSimCountryLabel(englishValue || countryId || fallback, fallback);
  const chinese = FIVE_SIM_COUNTRY_CN_BY_ID[countryId] || '';
  if (chinese && english) {
    if (String(english).includes(chinese)) {
      return english;
    }
    if (chinese.toLowerCase() !== english.toLowerCase()) {
      return `${chinese} (${english})`;
    }
  }
  return chinese || english;
}

function normalizeFiveSimOperator(value = '', fallback = DEFAULT_FIVE_SIM_OPERATOR) {
  if (typeof window !== 'undefined' && window.PhoneSmsFiveSimProvider?.normalizeFiveSimOperator) {
    return window.PhoneSmsFiveSimProvider.normalizeFiveSimOperator(value || fallback);
  }
  return String(value || '').trim().toLowerCase().replace(/[^a-z0-9_-]+/g, '') || fallback;
}

function normalizeFiveSimMaxPriceValue(value = '') {
  if (typeof window !== 'undefined' && window.PhoneSmsFiveSimProvider?.normalizeFiveSimMaxPrice) {
    return window.PhoneSmsFiveSimProvider.normalizeFiveSimMaxPrice(value);
  }
  const rawValue = String(value ?? '').trim();
  if (!rawValue) {
    return '';
  }
  const numeric = Number(rawValue);
  if (!Number.isFinite(numeric) || numeric <= 0) {
    return '';
  }
  return String(Math.round(numeric * 10000) / 10000);
}

function normalizeFiveSimCountryFallbackList(value = []) {
  if (typeof window !== 'undefined' && window.PhoneSmsFiveSimProvider?.normalizeFiveSimCountryFallback) {
    return window.PhoneSmsFiveSimProvider.normalizeFiveSimCountryFallback(value);
  }
  const source = Array.isArray(value)
    ? value
    : String(value || '')
      .split(/[\r\n,，;；]+/)
      .map((entry) => String(entry || '').trim())
      .filter(Boolean);
  const seen = new Set();
  const normalized = [];

  source.forEach((entry) => {
    let id = '';
    let label = '';
    if (entry && typeof entry === 'object' && !Array.isArray(entry)) {
      id = normalizeFiveSimCountryId(entry.id ?? entry.countryId ?? entry.slug, '');
      label = normalizeFiveSimCountryLabel(
        entry.label ?? entry.countryLabel ?? formatFiveSimCountryDisplayLabel(id, entry.text_en ?? entry.name, id),
        id
      );
    } else {
      const text = String(entry || '').trim();
      const structured = text.match(/^([a-z0-9_-]+)\s*(?:[:|/-]\s*(.+))?$/i);
      id = normalizeFiveSimCountryId(structured?.[1] || text, '');
      label = String(structured?.[2] || '').trim() || formatFiveSimCountryDisplayLabel(id, id, id);
    }
    if (!id || seen.has(id)) {
      return;
    }
    seen.add(id);
    normalized.push({ id, label: label || formatFiveSimCountryDisplayLabel(id, id, id) });
  });

  return normalized;
}

function normalizeHeroSmsCountryId(value, fallback = DEFAULT_HERO_SMS_COUNTRY_ID) {
  const parsed = Math.floor(Number(value));
  if (Number.isFinite(parsed) && parsed > 0) {
    return parsed;
  }
  const fallbackParsed = Math.floor(Number(fallback));
  return Number.isFinite(fallbackParsed) && fallbackParsed > 0 ? fallbackParsed : DEFAULT_HERO_SMS_COUNTRY_ID;
}

function normalizeHeroSmsCountryLabel(value = '') {
  return String(value || '').trim() || DEFAULT_HERO_SMS_COUNTRY_LABEL;
}

function normalizeHeroSmsMaxPriceValue(value = '') {
  const rawValue = String(value ?? '').trim();
  if (!rawValue) {
    return '';
  }
  const numeric = Number(rawValue);
  if (!Number.isFinite(numeric) || numeric <= 0) {
    return '';
  }
  return String(Math.round(numeric * 10000) / 10000);
}

function normalizePhoneSmsProviderValue(value = '') {
  const normalized = String(value || '').trim().toLowerCase();
  if (normalized === PHONE_SMS_PROVIDER_FIVE_SIM) {
    return PHONE_SMS_PROVIDER_FIVE_SIM;
  }
  if (normalized === PHONE_SMS_PROVIDER_NEXSMS) {
    return PHONE_SMS_PROVIDER_NEXSMS;
  }
  return PHONE_SMS_PROVIDER_HERO;
}

function normalizePhoneSmsProviderOrderValue(value = [], fallbackOrder = []) {
  const source = Array.isArray(value)
    ? value
    : String(value || '')
      .split(/[\r\n,，;；|/]+/)
      .map((entry) => String(entry || '').trim())
      .filter(Boolean);
  const normalized = [];
  const seen = new Set();

  source.forEach((entry) => {
    const provider = normalizePhoneSmsProviderValue(entry);
    if (seen.has(provider)) {
      return;
    }
    seen.add(provider);
    normalized.push(provider);
  });

  if (normalized.length) {
    return normalized.slice(0, 3);
  }

  const fallback = Array.isArray(fallbackOrder) ? fallbackOrder : [];
  if (!fallback.length) {
    return [];
  }
  const fallbackNormalized = [];
  fallback.forEach((entry) => {
    const provider = normalizePhoneSmsProviderValue(entry);
    if (!provider || fallbackNormalized.includes(provider)) {
      return;
    }
    fallbackNormalized.push(provider);
  });
  return fallbackNormalized.slice(0, 3);
}

function formatPhoneSmsProviderOrderSummary(order = []) {
  const normalized = normalizePhoneSmsProviderOrderValue(order, []);
  if (!normalized.length) {
    return '未设置';
  }
  return normalized
    .map((provider, index) => `${index + 1}. ${getPhoneSmsProviderLabel(provider)}`)
    .join(' → ');
}

function updatePhoneSmsProviderOrderSummary(order = []) {
  const normalized = normalizePhoneSmsProviderOrderValue(order, []);
  if (displayPhoneSmsProviderOrder) {
    displayPhoneSmsProviderOrder.textContent = formatPhoneSmsProviderOrderSummary(normalized);
  }
  if (btnPhoneSmsProviderOrderMenu) {
    btnPhoneSmsProviderOrderMenu.textContent = normalized.length
      ? `${normalized.map((provider) => getPhoneSmsProviderLabel(provider)).join(' / ')} (${normalized.length}/3)`
      : `未选择 (0/3)`;
  }
}

function resolveNormalizedProviderOrderForRuntime(state = {}) {
  const rawOrder = Array.isArray(state?.phoneSmsProviderOrder)
    ? state.phoneSmsProviderOrder
    : [];
  const normalizedOrder = normalizePhoneSmsProviderOrderValue(rawOrder, []);
  if (normalizedOrder.length) {
    return normalizedOrder;
  }
  const fallbackProvider = normalizePhoneSmsProviderValue(
    state?.phoneSmsProvider || selectPhoneSmsProvider?.value || DEFAULT_PHONE_SMS_PROVIDER
  );
  return [fallbackProvider];
}

function setPhoneSmsProviderOrderMenuOpen(open) {
  const nextOpen = Boolean(open);
  if (btnPhoneSmsProviderOrderMenu) {
    btnPhoneSmsProviderOrderMenu.setAttribute('aria-expanded', String(nextOpen));
  }
  if (phoneSmsProviderOrderMenu) {
    phoneSmsProviderOrderMenu.hidden = !nextOpen;
  }
}

function renderPhoneSmsProviderOrderMenu() {
  if (!phoneSmsProviderOrderMenu || !selectPhoneSmsProviderOrder) {
    return;
  }
  phoneSmsProviderOrderMenu.innerHTML = '';
  const selectedOrder = normalizePhoneSmsProviderOrderValue(phoneSmsProviderOrderSelection, []);
  const selectedSet = new Set(selectedOrder);

  Array.from(selectPhoneSmsProviderOrder.options || []).forEach((option) => {
    const provider = normalizePhoneSmsProviderValue(option.value || '');
    const active = selectedSet.has(provider);
    const orderIndex = active ? selectedOrder.findIndex((entry) => entry === provider) + 1 : 0;
    const item = document.createElement('button');
    item.type = 'button';
    item.className = 'header-dropdown-item hero-sms-country-menu-item';
    item.classList.toggle('is-active', active);

    const labelText = document.createElement('span');
    labelText.className = 'hero-sms-country-menu-item-label';
    labelText.textContent = getPhoneSmsProviderLabel(provider);

    const badge = document.createElement('span');
    badge.className = 'hero-sms-country-menu-item-badge';
    badge.textContent = active ? `✓ ${orderIndex}` : '';

    item.appendChild(labelText);
    item.appendChild(badge);
    item.addEventListener('click', () => {
      option.selected = !option.selected;
      const nextOrder = syncPhoneSmsProviderOrderFromSelect({
        enforceMax: true,
        ensureDefault: false,
        showLimitToast: false,
        syncProvider: false,
      });
      updatePhoneSmsProviderOrderSummary(nextOrder);
      markSettingsDirty(true);
      saveSettings({ silent: true }).catch(() => { });
    });
    phoneSmsProviderOrderMenu.appendChild(item);
  });
}

function syncPhoneSmsProviderOrderFromSelect(options = {}) {
  const selectionLimit = Math.max(1, Math.floor(Number(options.maxSelection) || 3));
  const enforceMax = options.enforceMax !== false;
  const ensureDefault = options.ensureDefault !== false;
  const syncProvider = Boolean(options.syncProvider);
  const showLimitToast = Boolean(options.showLimitToast);
  if (!selectPhoneSmsProviderOrder) {
    phoneSmsProviderOrderSelection = [];
    updatePhoneSmsProviderOrderSummary([]);
    return [];
  }

  const selectedProviders = Array.from(selectPhoneSmsProviderOrder.options)
    .filter((option) => option.selected)
    .map((option) => normalizePhoneSmsProviderValue(option.value || ''))
    .filter(Boolean);
  const selectedSet = new Set(selectedProviders);

  let nextOrder = phoneSmsProviderOrderSelection.filter((provider) => selectedSet.has(provider));
  selectedProviders.forEach((provider) => {
    if (!nextOrder.includes(provider)) {
      nextOrder.push(provider);
    }
  });

  if (ensureDefault && !nextOrder.length) {
    const fallbackProvider = getSelectedPhoneSmsProvider();
    nextOrder = normalizePhoneSmsProviderOrderValue([fallbackProvider], []);
  }

  if (enforceMax && nextOrder.length > selectionLimit) {
    const droppedCount = nextOrder.length - selectionLimit;
    nextOrder = nextOrder.slice(0, selectionLimit);
    if (showLimitToast && droppedCount > 0 && typeof showToast === 'function') {
      showToast(`服务商顺序最多 ${selectionLimit} 个，已保留前 ${selectionLimit} 个。`, 'warn', 2200);
    }
  }

  const nextOrderSet = new Set(nextOrder);
  Array.from(selectPhoneSmsProviderOrder.options).forEach((option) => {
    const provider = normalizePhoneSmsProviderValue(option.value || '');
    option.selected = nextOrderSet.has(provider);
  });

  phoneSmsProviderOrderSelection = [...nextOrder];
  if (syncProvider && nextOrder.length && selectPhoneSmsProvider) {
    selectPhoneSmsProvider.value = normalizePhoneSmsProviderValue(nextOrder[0]);
  }
  renderPhoneSmsProviderOrderMenu();
  updatePhoneSmsProviderOrderSummary(nextOrder);
  return nextOrder;
}

function applyPhoneSmsProviderOrderSelection(order = [], options = {}) {
  const ensureDefault = options.ensureDefault !== false;
  const syncProvider = Boolean(options.syncProvider);
  const normalizedOrder = normalizePhoneSmsProviderOrderValue(order, []);
  phoneSmsProviderOrderSelection = [...normalizedOrder];
  if (selectPhoneSmsProviderOrder) {
    const selectedSet = new Set(normalizedOrder);
    Array.from(selectPhoneSmsProviderOrder.options).forEach((option) => {
      const provider = normalizePhoneSmsProviderValue(option.value || '');
      option.selected = selectedSet.has(provider);
    });
  }
  return syncPhoneSmsProviderOrderFromSelect({
    ensureDefault,
    enforceMax: true,
    syncProvider,
    showLimitToast: false,
  });
}

function clearPhoneSmsProviderOrderSelection(options = {}) {
  const syncProvider = Boolean(options.syncProvider);
  phoneSmsProviderOrderSelection = [];
  if (selectPhoneSmsProviderOrder) {
    Array.from(selectPhoneSmsProviderOrder.options || []).forEach((option) => {
      option.selected = false;
    });
  }
  const nextOrder = syncPhoneSmsProviderOrderFromSelect({
    ensureDefault: false,
    enforceMax: true,
    syncProvider,
    showLimitToast: false,
  });
  if (!nextOrder.length && !syncProvider && selectPhoneSmsProvider) {
    selectPhoneSmsProvider.value = normalizePhoneSmsProviderValue(
      selectPhoneSmsProvider.value || DEFAULT_PHONE_SMS_PROVIDER
    );
  }
  return nextOrder;
}

function getSelectedPhoneSmsProviderOrder() {
  const normalized = syncPhoneSmsProviderOrderFromSelect({
    ensureDefault: false,
    enforceMax: true,
    syncProvider: false,
    showLimitToast: false,
  });
  return normalizePhoneSmsProviderOrderValue(normalized, []);
}

function getSelectedPhoneSmsProvider() {
  if (!selectPhoneSmsProvider) {
    return DEFAULT_PHONE_SMS_PROVIDER;
  }
  const normalized = normalizePhoneSmsProviderValue(selectPhoneSmsProvider.value);
  selectPhoneSmsProvider.value = normalized;
  return normalized;
}

function normalizeFiveSimCountryCode(value = '', fallback = 'thailand') {
  const normalized = String(value || '')
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9_-]/g, '');
  return normalized || fallback;
}

function normalizeFiveSimCountryOrderValue(value = []) {
  const source = Array.isArray(value)
    ? value
    : String(value || '')
      .split(/[\r\n,，;；]+/)
      .map((entry) => String(entry || '').trim())
      .filter(Boolean);
  const normalized = [];
  const seen = new Set();

  source.forEach((entry) => {
    const code = normalizeFiveSimCountryCode(
      entry && typeof entry === 'object' && !Array.isArray(entry)
        ? (entry.code || entry.country || entry.id || '')
        : entry,
      ''
    );
    if (!code || seen.has(code)) {
      return;
    }
    seen.add(code);
    normalized.push(code);
  });

  if (!normalized.length) {
    return [];
  }
  return normalized.slice(0, 10);
}

function formatFiveSimCountryOrderValue(value = []) {
  return normalizeFiveSimCountryOrderValue(value).join(',');
}

function normalizeFiveSimOperatorValue(value = '') {
  return normalizeFiveSimCountryCode(value, DEFAULT_FIVE_SIM_OPERATOR);
}

function normalizeFiveSimProductValue(value = '') {
  return normalizeFiveSimCountryCode(value, DEFAULT_FIVE_SIM_PRODUCT);
}

function normalizeNexSmsCountryIdValue(value, fallback = 0) {
  const parsed = Math.floor(Number(value));
  if (Number.isFinite(parsed) && parsed >= 0) {
    return parsed;
  }
  const fallbackParsed = Math.floor(Number(fallback));
  if (Number.isFinite(fallbackParsed) && fallbackParsed >= 0) {
    return fallbackParsed;
  }
  return 0;
}

function normalizeNexSmsCountryOrderValue(value = []) {
  const source = Array.isArray(value)
    ? value
    : String(value || '')
      .split(/[\r\n,，;；]+/)
      .map((entry) => String(entry || '').trim())
      .filter(Boolean);
  const normalized = [];
  const seen = new Set();
  source.forEach((entry) => {
    const countryId = normalizeNexSmsCountryIdValue(
      entry && typeof entry === 'object' && !Array.isArray(entry)
        ? (entry.id || entry.countryId || entry.country || '')
        : entry,
      -1
    );
    if (countryId < 0 || seen.has(countryId)) {
      return;
    }
    seen.add(countryId);
    normalized.push(countryId);
  });
  if (!normalized.length) {
    return [];
  }
  return normalized.slice(0, 10);
}

function normalizeNexSmsServiceCodeValue(value = '') {
  const normalized = String(value || '')
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9_-]/g, '');
  return normalized || DEFAULT_NEX_SMS_SERVICE_CODE;
}

function normalizeFiveSimCountryLabel(value = '', fallback = 'Thailand') {
  return String(value || '').trim() || fallback;
}

function normalizeFiveSimCountryFallbackList(value = []) {
  const source = Array.isArray(value)
    ? value
    : String(value || '')
      .split(/[\r\n,，;；]+/)
      .map((entry) => String(entry || '').trim())
      .filter(Boolean);
  const normalized = [];
  const seen = new Set();
  source.forEach((entry) => {
    let code = '';
    let label = '';
    if (entry && typeof entry === 'object' && !Array.isArray(entry)) {
      code = normalizeFiveSimCountryCode(entry.code || entry.id || entry.country || '', '');
      label = normalizeFiveSimCountryLabel(entry.label || entry.countryLabel || '');
    } else {
      code = normalizeFiveSimCountryCode(entry, '');
    }
    if (!code || seen.has(code)) {
      return;
    }
    seen.add(code);
    normalized.push({
      id: code,
      code,
      label: label || code,
    });
  });
  return normalized;
}

function normalizeNexSmsCountryLabel(value = '', fallback = '') {
  return String(value || '').trim() || fallback;
}

function normalizeNexSmsCountryFallbackList(value = []) {
  const source = Array.isArray(value)
    ? value
    : String(value || '')
      .split(/[\r\n,，;；]+/)
      .map((entry) => String(entry || '').trim())
      .filter(Boolean);
  const normalized = [];
  const seen = new Set();
  source.forEach((entry) => {
    let countryId = -1;
    let label = '';
    if (entry && typeof entry === 'object' && !Array.isArray(entry)) {
      countryId = normalizeNexSmsCountryIdValue(entry.id || entry.countryId || entry.country || '', -1);
      label = normalizeNexSmsCountryLabel(entry.label || entry.countryLabel || '');
    } else {
      countryId = normalizeNexSmsCountryIdValue(entry, -1);
    }
    if (countryId < 0 || seen.has(countryId)) {
      return;
    }
    seen.add(countryId);
    normalized.push({
      id: countryId,
      label: label || `Country #${countryId}`,
    });
  });
  return normalized;
}

function getFiveSimCountryDisplayNameByIso(isoCode = '') {
  const normalizedIso = String(isoCode || '').trim().toUpperCase();
  if (!normalizedIso || typeof Intl === 'undefined' || typeof Intl.DisplayNames !== 'function') {
    return '';
  }
  try {
    const zhDisplayNames = new Intl.DisplayNames(['zh-CN'], { type: 'region' });
    return String(zhDisplayNames.of(normalizedIso) || '').trim();
  } catch {
    return '';
  }
}

function buildFiveSimCountryDisplayLabel(country = {}) {
  const code = normalizeFiveSimCountryCode(country.code || country.id || country.country || '', 'thailand');
  const english = String(country.text_en || country.eng || country.english || code).trim();
  const iso = String(
    country.isoCode
    || country.iso
    || country.countryCode
    || ''
  ).trim().toUpperCase();
  const chinese = getFiveSimCountryDisplayNameByIso(iso);
  const base = chinese && english
    ? `${chinese} (${english})`
    : (chinese || english || code);
  return iso ? `${base} [${iso}]` : base;
}

function buildFiveSimCountrySearchText(country = {}, label = '', code = '') {
  const tokens = new Set();
  const iso = String(country.isoCode || country.iso || country.countryCode || '').trim().toUpperCase();
  const chinese = getFiveSimCountryDisplayNameByIso(iso);
  [label, code, iso, chinese, country.text_en, country.english, country.text_ru].forEach((entry) => {
    const token = String(entry || '').trim();
    if (token) {
      tokens.add(token);
    }
  });
  return Array.from(tokens).join(' ');
}

function parseFiveSimCountriesPayload(payload = {}) {
  if (!payload || typeof payload !== 'object' || Array.isArray(payload)) {
    return [];
  }
  const entries = Object.entries(payload)
    .map(([countryCode, details]) => {
      const isoObject = details?.iso && typeof details.iso === 'object' ? details.iso : {};
      const isoCode = Object.keys(isoObject)[0] || '';
      const normalizedCode = normalizeFiveSimCountryCode(countryCode, '');
      if (!normalizedCode) {
        return null;
      }
      const option = {
        code: normalizedCode,
        id: normalizedCode,
        isoCode: String(isoCode || '').trim().toUpperCase(),
        text_en: String(details?.text_en || normalizedCode).trim(),
      };
      const label = buildFiveSimCountryDisplayLabel(option);
      return {
        id: normalizedCode,
        code: normalizedCode,
        isoCode: option.isoCode,
        label,
        searchText: buildFiveSimCountrySearchText(option, label, normalizedCode),
      };
    })
    .filter(Boolean);
  return entries.sort((left, right) => String(left.label || '').localeCompare(String(right.label || '')));
}

function normalizePhoneVerificationReplacementLimit(value, fallback = DEFAULT_PHONE_VERIFICATION_REPLACEMENT_LIMIT) {
  const rawValue = String(value ?? '').trim();
  const parsed = Number.parseInt(rawValue, 10);
  if (!Number.isFinite(parsed)) {
    return Math.max(
      PHONE_REPLACEMENT_LIMIT_MIN,
      Math.min(PHONE_REPLACEMENT_LIMIT_MAX, Number(fallback) || DEFAULT_PHONE_VERIFICATION_REPLACEMENT_LIMIT)
    );
  }
  return Math.max(PHONE_REPLACEMENT_LIMIT_MIN, Math.min(PHONE_REPLACEMENT_LIMIT_MAX, parsed));
}

function normalizePhoneCodeWaitSecondsValue(value, fallback = DEFAULT_PHONE_CODE_WAIT_SECONDS) {
  const rawValue = String(value ?? '').trim();
  const parsed = Number.parseInt(rawValue, 10);
  if (!Number.isFinite(parsed)) {
    return Math.max(
      PHONE_CODE_WAIT_SECONDS_MIN,
      Math.min(PHONE_CODE_WAIT_SECONDS_MAX, Number(fallback) || DEFAULT_PHONE_CODE_WAIT_SECONDS)
    );
  }
  return Math.max(PHONE_CODE_WAIT_SECONDS_MIN, Math.min(PHONE_CODE_WAIT_SECONDS_MAX, parsed));
}

function normalizePhoneCodeTimeoutWindowsValue(value, fallback = DEFAULT_PHONE_CODE_TIMEOUT_WINDOWS) {
  const rawValue = String(value ?? '').trim();
  const parsed = Number.parseInt(rawValue, 10);
  if (!Number.isFinite(parsed)) {
    return Math.max(
      PHONE_CODE_TIMEOUT_WINDOWS_MIN,
      Math.min(PHONE_CODE_TIMEOUT_WINDOWS_MAX, Number(fallback) || DEFAULT_PHONE_CODE_TIMEOUT_WINDOWS)
    );
  }
  return Math.max(PHONE_CODE_TIMEOUT_WINDOWS_MIN, Math.min(PHONE_CODE_TIMEOUT_WINDOWS_MAX, parsed));
}

function normalizePhoneCodePollIntervalSecondsValue(value, fallback = DEFAULT_PHONE_CODE_POLL_INTERVAL_SECONDS) {
  const rawValue = String(value ?? '').trim();
  const parsed = Number.parseInt(rawValue, 10);
  if (!Number.isFinite(parsed)) {
    return Math.max(
      PHONE_CODE_POLL_INTERVAL_SECONDS_MIN,
      Math.min(PHONE_CODE_POLL_INTERVAL_SECONDS_MAX, Number(fallback) || DEFAULT_PHONE_CODE_POLL_INTERVAL_SECONDS)
    );
  }
  return Math.max(PHONE_CODE_POLL_INTERVAL_SECONDS_MIN, Math.min(PHONE_CODE_POLL_INTERVAL_SECONDS_MAX, parsed));
}

function normalizePhoneCodePollMaxRoundsValue(value, fallback = DEFAULT_PHONE_CODE_POLL_MAX_ROUNDS) {
  const rawValue = String(value ?? '').trim();
  const parsed = Number.parseInt(rawValue, 10);
  if (!Number.isFinite(parsed)) {
    return Math.max(
      PHONE_CODE_POLL_MAX_ROUNDS_MIN,
      Math.min(PHONE_CODE_POLL_MAX_ROUNDS_MAX, Number(fallback) || DEFAULT_PHONE_CODE_POLL_MAX_ROUNDS)
    );
  }
  return Math.max(PHONE_CODE_POLL_MAX_ROUNDS_MIN, Math.min(PHONE_CODE_POLL_MAX_ROUNDS_MAX, parsed));
}

function normalizeHeroSmsReuseEnabledValue(value) {
  if (value === undefined || value === null) {
    return DEFAULT_HERO_SMS_REUSE_ENABLED;
  }
  return Boolean(value);
}

function normalizeHeroSmsAcquirePriority(value = '') {
  const normalized = String(value || '').trim().toLowerCase();
  if (normalized === HERO_SMS_ACQUIRE_PRIORITY_PRICE) {
    return HERO_SMS_ACQUIRE_PRIORITY_PRICE;
  }
  if (normalized === HERO_SMS_ACQUIRE_PRIORITY_PRICE_HIGH) {
    return HERO_SMS_ACQUIRE_PRIORITY_PRICE_HIGH;
  }
  return HERO_SMS_ACQUIRE_PRIORITY_COUNTRY;
}

function normalizeHeroSmsCountryFallbackList(value = []) {
  const source = Array.isArray(value)
    ? value
    : String(value || '')
      .split(/[\r\n,，;；]+/)
      .map((entry) => String(entry || '').trim())
      .filter(Boolean);
  const seen = new Set();
  const normalized = [];

  source.forEach((entry) => {
    let id = 0;
    let label = '';
    if (entry && typeof entry === 'object' && !Array.isArray(entry)) {
      const parsedId = Math.floor(Number(entry.id ?? entry.countryId));
      id = Number.isFinite(parsedId) && parsedId > 0 ? parsedId : 0;
      label = normalizeHeroSmsCountryLabel(entry.label ?? entry.countryLabel);
    } else {
      const text = String(entry || '').trim();
      const structured = text.match(/^(\d+)\s*(?:[:|/-]\s*(.+))?$/);
      if (structured) {
        const parsedId = Math.floor(Number(structured[1]));
        id = Number.isFinite(parsedId) && parsedId > 0 ? parsedId : 0;
        label = normalizeHeroSmsCountryLabel(structured[2]);
      } else {
        const parsedId = Math.floor(Number(text));
        id = Number.isFinite(parsedId) && parsedId > 0 ? parsedId : 0;
      }
    }

    if (!id || seen.has(id)) {
      return;
    }
    seen.add(id);
    normalized.push({
      id,
      label: label || `Country #${id}`,
    });
  });

  return normalized;
}

function collectHeroSmsCountrySearchTokens(value, tokens, depth = 0) {
  if (depth > 2 || value === null || value === undefined) {
    return;
  }
  if (typeof value === 'string') {
    const normalized = value.trim();
    if (normalized) {
      tokens.add(normalized);
    }
    return;
  }
  if (Array.isArray(value)) {
    value.forEach((entry) => collectHeroSmsCountrySearchTokens(entry, tokens, depth + 1));
    return;
  }
  if (typeof value === 'object') {
    Object.values(value).forEach((entry) => collectHeroSmsCountrySearchTokens(entry, tokens, depth + 1));
  }
}

function normalizeHeroSmsCountryAliasKey(value = '') {
  return String(value || '')
    .trim()
    .toLowerCase()
    .replace(/[’'`]/g, '')
    .replace(/&/g, ' and ')
    .replace(/\(.*?\)/g, ' ')
    .replace(/[^a-z0-9]+/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

function collectHeroSmsCountryCodeAliases(country = {}, label = '') {
  const aliases = new Set();
  const candidateLabels = [
    String(label || '').trim(),
    String(country?.eng || '').trim(),
    String(country?.name || '').trim(),
    String(country?.country || '').trim(),
  ].filter(Boolean);
  candidateLabels.forEach((candidate) => {
    const normalized = normalizeHeroSmsCountryAliasKey(candidate);
    if (!normalized) {
      return;
    }
    const code = HERO_SMS_COUNTRY_ISO_CODE_BY_NAME.get(normalized);
    if (code) {
      aliases.add(code);
    }
    const overrideAliases = HERO_SMS_COUNTRY_CODE_ALIAS_OVERRIDES[normalized];
    if (Array.isArray(overrideAliases)) {
      overrideAliases.forEach((entry) => {
        const token = String(entry || '').trim().toUpperCase();
        if (token) {
          aliases.add(token);
        }
      });
    }
  });
  return Array.from(aliases);
}

function buildHeroSmsCountrySearchText(country = {}, label = '', id = '') {
  const tokens = new Set();
  collectHeroSmsCountrySearchTokens(country, tokens, 0);
  if (label) {
    tokens.add(String(label).trim());
  }
  if (id) {
    tokens.add(String(id).trim());
  }
  collectHeroSmsCountryCodeAliases(country, label).forEach((alias) => tokens.add(alias));
  return Array.from(tokens).join(' ');
}

function buildHeroSmsCountryDisplayLabel(country = {}) {
  const english = String(country?.eng || '').trim();
  const chinese = String(country?.chn || '').trim();
  if (chinese && english) {
    if (chinese.toLowerCase() === english.toLowerCase()) {
      return english;
    }
    return `${chinese} (${english})`;
  }
  return chinese || english;
}

function normalizeHeroSmsFetchErrorMessage(error) {
  const message = String(error?.message || error || '').trim();
  if (!message) {
    return '未知网络错误';
  }
  if (/aborted|abort|timed out|timeout/i.test(message)) {
    return '请求超时，请稍后重试';
  }
  if (/failed to fetch|networkerror|network request failed/i.test(message)) {
    return '网络不可用或被拦截';
  }
  return message;
}

function normalizeHeroSmsPriceForPreview(value) {
  const direct = Number(value);
  if (Number.isFinite(direct) && direct >= 0) {
    return direct;
  }
  const text = String(value ?? '').trim();
  if (!text) {
    return null;
  }
  const matched = text.match(/-?\d+(?:[.,]\d+)?/);
  if (!matched) {
    return null;
  }
  const parsed = Number(String(matched[0] || '').replace(',', '.'));
  if (!Number.isFinite(parsed) || parsed < 0) {
    return null;
  }
  return parsed;
}

function formatHeroSmsPriceForPreview(value) {
  const price = Number(value);
  if (!Number.isFinite(price) || price < 0) {
    return '';
  }
  const rounded = Math.round(price * 10000) / 10000;
  return rounded.toFixed(4).replace(/\.?0+$/, '');
}

function isHeroSmsPreviewEmptyPayload(payload) {
  if (payload === undefined || payload === null) {
    return true;
  }
  if (typeof payload === 'string') {
    return !payload.trim();
  }
  if (Array.isArray(payload)) {
    return payload.length === 0;
  }
  if (typeof payload === 'object') {
    return Object.keys(payload).length === 0;
  }
  return false;
}

function collectHeroSmsPriceEntriesForPreview(payload, entries = []) {
  if (Array.isArray(payload)) {
    payload.forEach((entry) => collectHeroSmsPriceEntriesForPreview(entry, entries));
    return entries;
  }
  if (!payload || typeof payload !== 'object') {
    return entries;
  }

  const cost = normalizeHeroSmsPriceForPreview(payload.cost ?? payload.price ?? payload.Price);
  if (cost !== null) {
    const count = Number(payload.count ?? payload.qty ?? payload.Qty);
    const physicalCount = Number(payload.physicalCount);
    const hasCount = Number.isFinite(count);
    const hasPhysicalCount = Number.isFinite(physicalCount);
    const stockCount = hasPhysicalCount
      ? physicalCount
      : (hasCount ? count : 0);
    const hasStockField = hasCount || hasPhysicalCount;
    entries.push({
      cost,
      hasStockField,
      stockCount: Number.isFinite(stockCount) ? stockCount : 0,
      inStock: !hasStockField || stockCount > 0,
    });
  }

  const pushTierMapEntries = (tierMap) => {
    if (!tierMap || typeof tierMap !== 'object') {
      return;
    }
    Object.entries(tierMap).forEach(([priceKey, countRaw]) => {
      const priceValue = normalizeHeroSmsPriceForPreview(priceKey);
      if (priceValue === null) {
        return;
      }
      const stockCount = Number(countRaw);
      if (!Number.isFinite(stockCount)) {
        return;
      }
      entries.push({
        cost: priceValue,
        hasStockField: true,
        stockCount: Math.max(0, stockCount),
        inStock: stockCount > 0,
      });
    });
  };

  pushTierMapEntries(payload.freePriceMap);
  pushTierMapEntries(payload.priceMap);

  // Some HeroSMS payloads encode tiers as object keys, e.g.:
  // { "0.05": { count: 0 }, "0.35": { count: 12 } }
  // Parse those keyed tiers as well, so preview does not miss higher-price stock.
  Object.entries(payload).forEach(([key, value]) => {
    const keyedPrice = normalizeHeroSmsPriceForPreview(key);
    if (keyedPrice === null) {
      return;
    }
    if (value && typeof value === 'object') {
      const stockCandidates = [
        value.count,
        value.physicalCount,
        value.stock,
        value.available,
        value.quantity,
        value.qty,
        value.left,
        value.free,
      ]
        .map((raw) => Number(raw))
        .filter((raw) => Number.isFinite(raw));
      const hasStockField = stockCandidates.length > 0;
      const trimmedKey = String(key || '').trim();
      const looksLikeCountryOrServiceKey = /^[0-9]{1,4}$/.test(trimmedKey);
      const looksLikeDecimalPriceKey = /^-?\d+[.,]\d+$/.test(trimmedKey)
        || /^[^\d-]*-?\d+[.,]\d+[^\d]*$/.test(trimmedKey);
      // Guard against country/service IDs encoded as numeric keys (e.g. "52", "16").
      // For numeric keys we require explicit stock fields, while decimal price keys can
      // still be consumed even when the provider only returns a scalar quantity.
      if (looksLikeCountryOrServiceKey && !looksLikeDecimalPriceKey) {
        return;
      }
      const stockCount = hasStockField ? Math.max(...stockCandidates) : 0;
      entries.push({
        cost: keyedPrice,
        hasStockField,
        stockCount: Number.isFinite(stockCount) ? stockCount : 0,
        inStock: stockCount > 0,
      });
      return;
    }
    const numericCount = Number(value);
    if (Number.isFinite(numericCount)) {
      entries.push({
        cost: keyedPrice,
        hasStockField: true,
        stockCount: Math.max(0, numericCount),
        inStock: numericCount > 0,
      });
    }
  });

  Object.values(payload).forEach((entry) => collectHeroSmsPriceEntriesForPreview(entry, entries));
  return entries;
}

function collectHeroSmsPriceEntriesFromTopCountriesPayload(payload, countryId, entries = []) {
  const normalizedCountryId = normalizeHeroSmsCountryId(countryId, 0);
  if (normalizedCountryId <= 0) {
    return entries;
  }
  if (!payload || typeof payload !== 'object' || Array.isArray(payload)) {
    return entries;
  }
  Object.values(payload).forEach((entry) => {
    if (!entry || typeof entry !== 'object' || Array.isArray(entry)) {
      return;
    }
    const entryCountryId = normalizeHeroSmsCountryId(
      entry.country ?? entry.countryId ?? entry.country_id ?? entry.id,
      0
    );
    if (entryCountryId !== normalizedCountryId) {
      return;
    }
    collectHeroSmsPriceEntriesForPreview(entry, entries);
  });
  return entries;
}

function collectHeroSmsPriceEntriesFromVerificationPayload(payload, countryId, serviceCode = 'dr', entries = []) {
  const normalizedCountryId = normalizeHeroSmsCountryId(countryId, 0);
  if (normalizedCountryId <= 0) {
    return entries;
  }
  if (!payload || typeof payload !== 'object' || Array.isArray(payload)) {
    return entries;
  }
  const normalizedServiceCode = String(serviceCode || '').trim();
  if (!normalizedServiceCode) {
    return entries;
  }
  const serviceNode = payload?.[normalizedServiceCode];
  if (!serviceNode || typeof serviceNode !== 'object' || Array.isArray(serviceNode)) {
    return entries;
  }
  const countryNode = serviceNode?.[String(normalizedCountryId)];
  if (!countryNode || typeof countryNode !== 'object' || Array.isArray(countryNode)) {
    return entries;
  }
  const priceValue = normalizeHeroSmsPriceForPreview(countryNode.price);
  if (priceValue === null) {
    return entries;
  }
  const stockCount = Number(countryNode.count);
  entries.push({
    cost: priceValue,
    hasStockField: Number.isFinite(stockCount),
    stockCount: Number.isFinite(stockCount) ? Math.max(0, stockCount) : 0,
    inStock: !Number.isFinite(stockCount) || stockCount > 0,
  });
  return entries;
}

function collectHeroSmsPriceCandidatesForPreview(payload, candidates = []) {
  collectHeroSmsPriceEntriesForPreview(payload, [])
    .filter((entry) => entry.inStock)
    .forEach((entry) => {
      candidates.push(entry.cost);
    });
  return candidates;
}

function formatPhoneSmsPriceEntriesSummary(payload) {
  const entries = collectHeroSmsPriceEntriesForPreview(payload, [])
    .filter((entry) => Number.isFinite(Number(entry.cost)) && Number(entry.cost) > 0);
  const inStockPrices = Array.from(new Set(
    entries
      .filter((entry) => entry.inStock)
      .map((entry) => Math.round(Number(entry.cost) * 10000) / 10000)
  )).sort((left, right) => left - right);
  const allPrices = Array.from(new Set(
    entries.map((entry) => Math.round(Number(entry.cost) * 10000) / 10000)
  )).sort((left, right) => left - right);
  return { entries, inStockPrices, allPrices };
}

function describeHeroSmsPreviewPayload(payload) {
  if (payload === undefined || payload === null) {
    return '';
  }
  if (typeof payload === 'string') {
    return payload.trim();
  }
  if (typeof payload === 'number' || typeof payload === 'boolean') {
    return String(payload);
  }
  if (typeof payload === 'object') {
    const directMessage = String(
      payload.message
      || payload.msg
      || payload.error
      || payload.title
      || payload.statusText
      || ''
    ).trim();
    if (directMessage) {
      const extra = String(payload?.info?.text || payload?.info?.description || '').trim();
      return extra ? `${directMessage}: ${extra}` : directMessage;
    }
    try {
      return JSON.stringify(payload);
    } catch {
      return '[object]';
    }
  }
  return String(payload);
}

function summarizeHeroSmsPreviewError(payload, responseStatus = 0) {
  if (isHeroSmsPreviewEmptyPayload(payload)) {
    return '未返回有效价格';
  }
  const text = describeHeroSmsPreviewPayload(payload);
  if (text === '{}' || text === '[]') {
    return '未返回有效价格';
  }
  if (/UNPROCESSABLE_ENTITY/i.test(text) && /api_key/i.test(text) && /REQUIRED/i.test(text)) {
    return '请先填写接码 API Key';
  }
  if (/BAD_KEY|WRONG_KEY|INVALID_KEY/i.test(text)) {
    return 'API Key 无效';
  }
  if (/NO_BALANCE|NOT_ENOUGH_BALANCE/i.test(text)) {
    return '余额不足';
  }
  if (/BANNED|ACCOUNT_BANNED/i.test(text)) {
    return '账号已被封禁';
  }
  if (/WRONG_SERVICE|SERVICE_NOT_FOUND/i.test(text)) {
    return '服务代码无效';
  }
  if (/WRONG_COUNTRY|COUNTRY_NOT_FOUND/i.test(text)) {
    return '国家参数无效';
  }
  if (/NO_NUMBERS/i.test(text)) {
    return '暂无可用号源';
  }
  if (responseStatus && responseStatus >= 400) {
    return `HTTP ${responseStatus}`;
  }
  return text || '未知错误';
}

function formatPriceTiersForPreview(entries = [], options = {}) {
  const maxPrice = Number(options?.maxPrice);
  const hasMaxPrice = Number.isFinite(maxPrice) && maxPrice > 0;
  const normalized = Array.from(
    new Map(
      (Array.isArray(entries) ? entries : [])
        .map((entry) => {
          const price = Number(entry?.price ?? entry?.cost);
          if (!Number.isFinite(price) || price <= 0) {
            return null;
          }
          const normalizedPrice = Math.round(price * 10000) / 10000;
          const countRaw = Number(entry?.count);
          const count = Number.isFinite(countRaw) ? Math.max(0, Math.floor(countRaw)) : null;
          return [normalizedPrice, count];
        })
        .filter(Boolean)
    ).entries()
  )
    .map(([price, count]) => ({ price: Number(price), count }))
    .sort((left, right) => left.price - right.price);
  if (!normalized.length) {
    return '';
  }

  const limit = 16;
  const displayed = normalized.slice(0, limit);
  const suffix = normalized.length > limit ? ` ... +${normalized.length - limit} 档` : '';
  return displayed.map((entry) => {
    const priceText = formatHeroSmsPriceForPreview(entry.price) || String(entry.price);
    const countText = entry.count === null ? '' : `x${entry.count}`;
    const overLimitText = hasMaxPrice && entry.price > maxPrice ? '↑' : '';
    return `${priceText}${countText ? `(${countText})` : ''}${overLimitText}`;
  }).join(', ') + suffix;
}

function formatPriceTiersWithZeroStockForPreview(entries = [], options = {}) {
  const maxPrice = Number(options?.maxPrice);
  const hasMaxPrice = Number.isFinite(maxPrice) && maxPrice > 0;
  const normalized = Array.from(
    new Map(
      (Array.isArray(entries) ? entries : [])
        .map((entry) => {
          const price = Number(entry?.price ?? entry?.cost);
          if (!Number.isFinite(price) || price <= 0) {
            return null;
          }
          const normalizedPrice = Math.round(price * 10000) / 10000;
          const countRaw = Number(entry?.count);
          const count = Number.isFinite(countRaw) ? Math.max(0, Math.floor(countRaw)) : null;
          return [normalizedPrice, count];
        })
        .filter(Boolean)
    ).entries()
  )
    .map(([price, count]) => ({ price: Number(price), count }))
    .sort((left, right) => left.price - right.price);
  if (!normalized.length) {
    return '';
  }

  const limit = 16;
  const displayed = normalized.slice(0, limit);
  const suffix = normalized.length > limit ? ` ... +${normalized.length - limit} 档` : '';
  return displayed.map((entry) => {
    const priceText = formatHeroSmsPriceForPreview(entry.price) || String(entry.price);
    const countText = entry.count === null ? '' : `x${entry.count}`;
    const overLimitText = hasMaxPrice && entry.price > maxPrice ? '↑' : '';
    return `${priceText}${countText ? `(${countText})` : ''}${overLimitText}`;
  }).join(', ') + suffix;
}

function describeNexSmsPreviewPayload(payload) {
  if (payload === undefined || payload === null) {
    return '';
  }
  if (typeof payload === 'string') {
    return payload.trim();
  }
  if (typeof payload === 'number' || typeof payload === 'boolean') {
    return String(payload);
  }
  if (typeof payload === 'object') {
    const directMessage = String(
      payload.message
      || payload.msg
      || payload.error
      || payload.title
      || payload.statusText
      || payload?.data?.message
      || payload?.data?.error
      || ''
    ).trim();
    if (directMessage) {
      return directMessage;
    }
    try {
      return JSON.stringify(payload);
    } catch {
      return '[object]';
    }
  }
  return String(payload);
}

function getSelectedHeroSmsCountryOption() {
  const selectedCountries = syncHeroSmsFallbackSelectionOrderFromSelect({
    enforceMax: true,
    ensureDefault: false,
    showLimitToast: false,
  });
  if (selectedCountries.length) {
    return selectedCountries[0];
  }
  return isFiveSimProviderSelected()
    ? { id: DEFAULT_FIVE_SIM_COUNTRY_ID, label: DEFAULT_FIVE_SIM_COUNTRY_LABEL }
    : { id: DEFAULT_HERO_SMS_COUNTRY_ID, label: DEFAULT_HERO_SMS_COUNTRY_LABEL };
}

function getFiveSimCountryOptionLabel(code = '') {
  const normalizedCode = normalizeFiveSimCountryCode(code, '');
  if (!normalizedCode) {
    return '';
  }
  const matched = Array.from(selectFiveSimCountry?.options || [])
    .find((option) => normalizeFiveSimCountryCode(option.value, '') === normalizedCode);
  if (matched) {
    return normalizeFiveSimCountryLabel(matched.textContent, normalizedCode);
  }
  const fallback = FIVE_SIM_SUPPORTED_COUNTRY_ITEMS.find((item) => item.id === normalizedCode);
  return fallback ? formatFiveSimCountryDisplayLabel(fallback.id, fallback.eng, fallback.id) : normalizedCode;
}

function getNexSmsCountryLabelById(id) {
  const countryId = normalizeNexSmsCountryIdValue(id, -1);
  if (countryId < 0) {
    return '';
  }
  const matched = Array.from(selectNexSmsCountry?.options || [])
    .find((option) => normalizeNexSmsCountryIdValue(option.value, -1) === countryId);
  return normalizeNexSmsCountryLabel(matched?.textContent || '', `Country #${countryId}`);
}

function getSelectedFiveSimCountries() {
  return syncFiveSimCountrySelectionOrderFromSelect({
    enforceMax: true,
    ensureDefault: false,
    showLimitToast: false,
  });
}

function getSelectedNexSmsCountries() {
  return syncNexSmsCountrySelectionOrderFromSelect({
    enforceMax: true,
    ensureDefault: false,
    showLimitToast: false,
  });
}

function updateHeroSmsPlatformDisplay() {
  if (!displayHeroSmsPlatform) {
    return;
  }
  const provider = getSelectedPhoneSmsProvider();
  const selected = provider === PHONE_SMS_PROVIDER_FIVE_SIM
    ? (getSelectedFiveSimCountries()[0] || { id: DEFAULT_FIVE_SIM_COUNTRY_ID, label: DEFAULT_FIVE_SIM_COUNTRY_LABEL })
    : (provider === PHONE_SMS_PROVIDER_NEXSMS
      ? (getSelectedNexSmsCountries()[0] || { id: DEFAULT_NEX_SMS_COUNTRY_ORDER[0], label: `Country #${DEFAULT_NEX_SMS_COUNTRY_ORDER[0]}` })
      : getSelectedHeroSmsCountryOption());
  const countryText = selected?.label ? ` / ${selected.label}` : '';
  displayHeroSmsPlatform.textContent = `${getPhoneSmsProviderLabel(provider)} / OpenAI${countryText}`;
  if (inputHeroSmsApiKey) {
    inputHeroSmsApiKey.placeholder = provider === PHONE_SMS_PROVIDER_FIVE_SIM
      ? '请输入 5sim API Key'
      : (provider === PHONE_SMS_PROVIDER_NEXSMS ? '请输入 NexSMS API Key' : '请输入 HeroSMS API Key');
  }
}

function getHeroSmsCountryLabelById(id) {
  const targetId = String(id || '').trim();
  const countrySelect = selectHeroSmsCountry || selectHeroSmsCountryFallback;
  if (!targetId || !countrySelect) {
    return '';
  }
  const matched = Array.from(countrySelect.options).find((option) => option.value === targetId);
  return String(matched?.textContent || '').trim()
    || (isFiveSimProviderSelected() ? targetId : `Country #${targetId}`);
}

function renderHeroSmsCountryFallbackOrder(countries = []) {
  if (!displayHeroSmsCountryFallbackOrder) {
    return;
  }
  displayHeroSmsCountryFallbackOrder.textContent = '';
  const normalized = isFiveSimProviderSelected() ? normalizeFiveSimCountryFallbackList(countries) : normalizeHeroSmsCountryFallbackList(countries);
  if (!normalized.length) {
    displayHeroSmsCountryFallbackOrder.textContent = '未设置';
    return;
  }
  normalized.forEach((country, index) => {
    const chip = document.createElement('span');
    chip.className = 'country-order-chip';
    const label = document.createElement('span');
    label.className = 'country-order-chip-label';
    label.textContent = `${index + 1}. ${country.label}(${country.id})`;
    const removeBtn = document.createElement('button');
    removeBtn.type = 'button';
    removeBtn.className = 'country-order-remove';
    removeBtn.title = `移除 ${country.label}`;
    removeBtn.setAttribute('aria-label', `移除 ${country.label}`);
    removeBtn.textContent = '×';
    removeBtn.addEventListener('click', (event) => {
      event.preventDefault();
      event.stopPropagation();
      removeHeroSmsCountryFromOrder(country.id);
    });
    chip.appendChild(label);
    chip.appendChild(removeBtn);
    displayHeroSmsCountryFallbackOrder.appendChild(chip);
    if (index < normalized.length - 1) {
      const separator = document.createElement('span');
      separator.className = 'country-order-separator';
      separator.textContent = '→';
      displayHeroSmsCountryFallbackOrder.appendChild(separator);
    }
  });
}

function setHeroSmsCountryMenuOpen(open) {
  const nextOpen = Boolean(open);
  if (btnHeroSmsCountryMenu) {
    btnHeroSmsCountryMenu.setAttribute('aria-expanded', String(nextOpen));
  }
  if (heroSmsCountryMenu) {
    heroSmsCountryMenu.hidden = !nextOpen;
    if (nextOpen) {
      const searchInput = heroSmsCountryMenu.querySelector('.hero-sms-country-menu-search-input');
      if (searchInput) {
        // Always reset previous keyword on open to avoid accidental "empty list" state.
        heroSmsCountryMenuSearchKeyword = '';
        searchInput.value = '';
        applyHeroSmsCountryMenuFilter('');
        setTimeout(() => {
          searchInput.focus();
          searchInput.select();
        }, 0);
      }
    }
  }
}

function applyHeroSmsCountryMenuFilter(keyword = '') {
  if (!heroSmsCountryMenu) {
    return;
  }
  const normalizedKeyword = String(keyword || '').trim().toLowerCase();
  const items = Array.from(heroSmsCountryMenu.querySelectorAll('.hero-sms-country-menu-item'));
  let visibleCount = 0;
  items.forEach((item) => {
    const haystack = String(item.dataset.searchText || '').toLowerCase();
    const visible = !normalizedKeyword || haystack.includes(normalizedKeyword);
    item.hidden = !visible;
    if (visible) {
      visibleCount += 1;
    }
  });

  let empty = heroSmsCountryMenu.querySelector('.hero-sms-country-menu-empty');
  if (visibleCount === 0) {
    if (!empty) {
      empty = document.createElement('span');
      empty.className = 'data-value hero-sms-country-menu-empty';
      empty.textContent = '没有匹配国家';
      heroSmsCountryMenu.appendChild(empty);
    }
  } else if (empty) {
    empty.remove();
  }
}

function updateHeroSmsCountryMenuSummary(selectedCountries = []) {
  if (!btnHeroSmsCountryMenu) {
    return;
  }
  const normalized = isFiveSimProviderSelected() ? normalizeFiveSimCountryFallbackList(selectedCountries) : normalizeHeroSmsCountryFallbackList(selectedCountries);
  if (!normalized.length) {
    btnHeroSmsCountryMenu.textContent = `\u672a\u9009\u62e9 (0/${HERO_SMS_COUNTRY_SELECTION_MAX})`;
    return;
  }
  const labels = normalized.map((country) => country.label);
  btnHeroSmsCountryMenu.textContent = `${labels.join(' / ')} (${normalized.length}/${HERO_SMS_COUNTRY_SELECTION_MAX})`;
}

function renderHeroSmsCountryChoiceButtons() {
  if (!heroSmsCountryMenu || !selectHeroSmsCountry) {
    return;
  }
  const options = Array.from(selectHeroSmsCountry.options || []);
  const selectedOrder = [...heroSmsCountrySelectionOrder];
  const selectedSet = new Set(selectedOrder.map((id) => String(id)));

  heroSmsCountryMenu.innerHTML = '';
  const searchWrap = document.createElement('div');
  searchWrap.className = 'hero-sms-country-menu-search';
  const searchInput = document.createElement('input');
  searchInput.type = 'search';
  searchInput.className = 'data-input mono hero-sms-country-menu-search-input';
  searchInput.placeholder = '搜索国家（中/英/代码/ID）';
  searchInput.value = heroSmsCountryMenuSearchKeyword;
  searchInput.addEventListener('input', () => {
    heroSmsCountryMenuSearchKeyword = String(searchInput.value || '').trim();
    applyHeroSmsCountryMenuFilter(heroSmsCountryMenuSearchKeyword);
  });
  searchWrap.appendChild(searchInput);
  heroSmsCountryMenu.appendChild(searchWrap);

  if (!options.length) {
    const empty = document.createElement('span');
    empty.className = 'data-value hero-sms-country-menu-empty';
    empty.textContent = '暂无国家选项';
    heroSmsCountryMenu.appendChild(empty);
    updateHeroSmsCountryMenuSummary([]);
    return;
  }

  options.forEach((option) => {
    const countryId = String(option.value || '').trim();
    if (!countryId) {
      return;
    }
    const item = document.createElement('button');
    item.type = 'button';
    item.className = 'header-dropdown-item hero-sms-country-menu-item';
    const active = selectedSet.has(countryId);
    const orderIndex = active
      ? selectedOrder.findIndex((id) => String(id) === countryId) + 1
      : 0;
    const label = String(option.textContent || '').trim() || `Country #${countryId}`;
    item.classList.toggle('is-active', active);
    const labelText = document.createElement('span');
    labelText.className = 'hero-sms-country-menu-item-label';
    labelText.textContent = label;
    const badge = document.createElement('span');
    badge.className = 'hero-sms-country-menu-item-badge';
    badge.textContent = active ? `✓ ${orderIndex}` : '';
    item.appendChild(labelText);
    item.appendChild(badge);
    item.dataset.searchText = `${label} ${countryId} ${heroSmsCountrySearchTextById.get(countryId) || ''}`;
    item.addEventListener('click', () => {
      option.selected = !option.selected;
      syncHeroSmsFallbackSelectionOrderFromSelect({
        enforceMax: true,
        ensureDefault: false,
        showLimitToast: true,
      });
      updateHeroSmsPlatformDisplay();
      markSettingsDirty(true);
      saveSettings({ silent: true }).catch(() => { });
    });
    heroSmsCountryMenu.appendChild(item);
  });

  applyHeroSmsCountryMenuFilter(heroSmsCountryMenuSearchKeyword);

  updateHeroSmsCountryMenuSummary(
    selectedOrder.map((id) => ({
      id,
      label: getHeroSmsCountryLabelById(id),
    }))
  );
}

function syncHeroSmsFallbackSelectionOrderFromSelect(options = {}) {
  const countrySelect = selectHeroSmsCountry || selectHeroSmsCountryFallback;
  const selectionLimit = Math.max(1, Math.floor(Number(options.maxSelection) || HERO_SMS_COUNTRY_SELECTION_MAX));
  const enforceMax = options.enforceMax !== false;
  const ensureDefault = options.ensureDefault !== false;
  const showLimitToast = Boolean(options.showLimitToast);

  if (!countrySelect) {
    const defaultCountry = isFiveSimProviderSelected()
      ? { id: DEFAULT_FIVE_SIM_COUNTRY_ID, label: DEFAULT_FIVE_SIM_COUNTRY_LABEL }
      : { id: normalizeHeroSmsCountryId(DEFAULT_HERO_SMS_COUNTRY_ID), label: DEFAULT_HERO_SMS_COUNTRY_LABEL };
    heroSmsCountrySelectionOrder = [defaultCountry.id];
    renderHeroSmsCountryFallbackOrder([defaultCountry]);
    return [defaultCountry];
  }

  const selectedIds = Array.from(countrySelect.options)
    .filter((option) => option.selected)
    .map((option) => normalizePhoneSmsCountryId(option.value, getSelectedPhoneSmsProvider()))
    .filter(Boolean);
  if (!selectedIds.length && !countrySelect.multiple) {
    const fallbackId = normalizePhoneSmsCountryId(countrySelect.value, getSelectedPhoneSmsProvider());
    if (fallbackId) {
      selectedIds.push(fallbackId);
    }
  }

  const selectedSet = new Set(selectedIds);
  let nextOrder = heroSmsCountrySelectionOrder.filter((id) => selectedSet.has(id));
  selectedIds.forEach((id) => {
    if (!nextOrder.includes(id)) {
      nextOrder.push(id);
    }
  });

  if (ensureDefault && !nextOrder.length) {
    const defaultId = normalizePhoneSmsCountryId(countrySelect.value || (isFiveSimProviderSelected() ? DEFAULT_FIVE_SIM_COUNTRY_ID : DEFAULT_HERO_SMS_COUNTRY_ID));
    nextOrder = [defaultId];
  }

  if (enforceMax && nextOrder.length > selectionLimit) {
    const droppedCount = nextOrder.length - selectionLimit;
    nextOrder = nextOrder.slice(0, selectionLimit);
    if (showLimitToast && droppedCount > 0 && typeof showToast === 'function') {
      showToast(`接码国家最多选择 ${selectionLimit} 个，已保留前 ${selectionLimit} 个。`, 'warn', 2200);
    }
  }

  const nextOrderSet = new Set(nextOrder.map((id) => String(id)));
  Array.from(countrySelect.options).forEach((option) => {
    option.selected = nextOrderSet.has(String(option.value));
  });

  heroSmsCountrySelectionOrder = nextOrder;
  const selectedCountries = heroSmsCountrySelectionOrder.map((id) => ({
    id,
    label: getHeroSmsCountryLabelById(id),
  }));
  renderHeroSmsCountryFallbackOrder(selectedCountries);
  renderHeroSmsCountryChoiceButtons();
  return selectedCountries;
}

function applyHeroSmsFallbackSelection(countries = [], options = {}) {
  const includePrimary = Boolean(options.includePrimary);
  const normalizeFallbackForCurrentProvider = isFiveSimProviderSelected()
    ? normalizeFiveSimCountryFallbackList
    : normalizeHeroSmsCountryFallbackList;
  const sourceCountries = includePrimary
    ? countries
    : [
      getSelectedHeroSmsCountryOption(),
      ...normalizeFallbackForCurrentProvider(countries),
    ];
  const normalized = (isFiveSimProviderSelected()
    ? normalizeFiveSimCountryFallbackList(sourceCountries)
    : normalizeHeroSmsCountryFallbackList(sourceCountries)
  ).slice(0, HERO_SMS_COUNTRY_SELECTION_MAX);
  const selectedIds = normalized
    .map((entry) => normalizePhoneSmsCountryId(entry.id, getSelectedPhoneSmsProvider()))
    .filter(Boolean);

  const countrySelect = selectHeroSmsCountry || selectHeroSmsCountryFallback;
  if (countrySelect) {
    const selectedSet = new Set(selectedIds.map((id) => String(id)));
    Array.from(countrySelect.options).forEach((option) => {
      option.selected = selectedSet.has(String(option.value));
    });
  }
  heroSmsCountrySelectionOrder = [...selectedIds];
  return syncHeroSmsFallbackSelectionOrderFromSelect({
    enforceMax: true,
    ensureDefault: false,
    showLimitToast: false,
  });
}

function removeHeroSmsCountryFromOrder(id) {
  const provider = getSelectedPhoneSmsProvider();
  const normalizedId = normalizePhoneSmsCountryId(id, provider);
  if (!normalizedId) {
    return [];
  }
  heroSmsCountrySelectionOrder = heroSmsCountrySelectionOrder
    .filter((entry) => String(entry) !== String(normalizedId));
  [selectHeroSmsCountry, selectHeroSmsCountryFallback].forEach((selectEl) => {
    if (!selectEl) {
      return;
    }
    Array.from(selectEl.options || []).forEach((option) => {
      if (String(normalizePhoneSmsCountryId(option.value, provider)) === String(normalizedId)) {
        option.selected = false;
      }
    });
  });
  const nextOrder = syncHeroSmsFallbackSelectionOrderFromSelect({
    enforceMax: true,
    ensureDefault: false,
    showLimitToast: false,
  });
  updateHeroSmsPlatformDisplay();
  markSettingsDirty(true);
  saveSettings({ silent: true }).catch(() => { });
  return nextOrder;
}

function normalizePhoneActivationState(record = {}) {
  if (!record || typeof record !== 'object' || Array.isArray(record)) {
    return null;
  }
  const provider = normalizePhoneSmsProviderValue(record.provider || latestState?.phoneSmsProvider || PHONE_SMS_PROVIDER_HERO);
  const activationId = String(record.activationId ?? record.id ?? record.activation ?? '').trim();
  const phoneNumber = String(record.phoneNumber ?? record.phone ?? record.number ?? '').trim();
  if (!activationId || !phoneNumber) {
    return null;
  }
  const normalized = {
    provider,
    activationId,
    phoneNumber,
    serviceCode: String(record.serviceCode || '').trim(),
    successfulUses: Math.max(0, Math.floor(Number(record.successfulUses) || 0)),
    maxUses: Math.max(1, Math.floor(Number(record.maxUses) || 3)),
  };

  if (provider === PHONE_SMS_PROVIDER_FIVE_SIM) {
    normalized.countryId = normalizeFiveSimCountryCode(
      record.countryCode || record.countryId || '',
      ''
    );
  } else if (provider === PHONE_SMS_PROVIDER_NEXSMS) {
    normalized.countryId = normalizeNexSmsCountryId(record.countryId, -1);
  } else {
    normalized.countryId = normalizeHeroSmsCountryId(record.countryId, 0);
  }

  const countryLabel = String(record.countryLabel || '').trim();
  if (countryLabel) {
    normalized.countryLabel = countryLabel;
  }
  const expiresAt = Number(record.expiresAt);
  if (Number.isFinite(expiresAt) && expiresAt > 0) {
    normalized.expiresAt = Math.floor(expiresAt);
  }
  return normalized;
}

function buildPhoneActivationOptionKey(activation) {
  const normalized = normalizePhoneActivationState(activation);
  if (!normalized) {
    return '';
  }
  return [
    normalized.provider,
    String(normalized.activationId || '').trim(),
    String(normalized.phoneNumber || '').trim(),
  ].join('::');
}

function resolvePhoneActivationCountryLabel(activation = null) {
  const normalized = normalizePhoneActivationState(activation);
  if (!normalized) {
    return '';
  }
  if (normalized.countryLabel) {
    return normalized.countryLabel;
  }
  if (normalized.provider === PHONE_SMS_PROVIDER_FIVE_SIM) {
    return String(normalized.countryId || '').trim();
  }
  if (normalized.provider === PHONE_SMS_PROVIDER_NEXSMS) {
    const countryId = normalizeNexSmsCountryId(normalized.countryId, -1);
    return countryId >= 0 ? `Country #${countryId}` : '';
  }
  return normalizeHeroSmsCountryLabel(
    getHeroSmsCountryLabelById(normalized.countryId || '')
  );
}

function getPhoneSmsProviderLabel(provider = '') {
  const normalized = normalizePhoneSmsProviderValue(provider);
  if (normalized === PHONE_SMS_PROVIDER_FIVE_SIM) {
    return '5sim';
  }
  if (normalized === PHONE_SMS_PROVIDER_NEXSMS) {
    return 'NexSMS';
  }
  return 'HeroSMS';
}

function buildPhoneActivationOptionLabel(activation = null, sourceLabel = '') {
  const normalized = normalizePhoneActivationState(activation);
  if (!normalized) {
    return '';
  }
  const countryLabel = resolvePhoneActivationCountryLabel(normalized);
  const providerLabel = getPhoneSmsProviderLabel(normalized.provider);
  const reuseLabel = normalized.maxUses > 1
    ? ` / ${Math.max(0, normalized.successfulUses) + 1}/${normalized.maxUses}`
    : '';
  const sourcePrefix = sourceLabel ? `[${sourceLabel}] ` : '';
  return `${sourcePrefix}${normalized.phoneNumber} / ${providerLabel}${countryLabel ? ` / ${countryLabel}` : ''} (#${normalized.activationId})${reuseLabel}`;
}

function stopPhoneRuntimeCountdownTicker() {
  clearInterval(phoneRuntimeCountdownTimer);
  phoneRuntimeCountdownTimer = null;
}

function renderPhoneRuntimeCountdown() {
  if (!displayHeroSmsCurrentCountdown) {
    return;
  }
  const hasActivation = Boolean(normalizePhoneActivationState(latestState?.currentPhoneActivation));
  const endsAt = Number(phoneRuntimeCountdownEndsAt) || 0;
  const now = Date.now();
  if (!hasActivation || !Number.isFinite(endsAt) || endsAt <= 0) {
    displayHeroSmsCurrentCountdown.textContent = hasActivation ? '等待中' : '未启动';
    stopPhoneRuntimeCountdownTicker();
    return;
  }
  const remainingMs = endsAt - now;
  const windowHint = (
    phoneRuntimeCountdownWindowTotal > 0
      ? `（${Math.max(1, phoneRuntimeCountdownWindowIndex)}/${phoneRuntimeCountdownWindowTotal}）`
      : ''
  );
  if (remainingMs <= 0) {
    displayHeroSmsCurrentCountdown.textContent = `00:00:00${windowHint}`;
    stopPhoneRuntimeCountdownTicker();
    return;
  }
  displayHeroSmsCurrentCountdown.textContent = `${formatCountdown(remainingMs)}${windowHint}`;
}

function syncPhoneRuntimeCountdown(state = {}) {
  phoneRuntimeCountdownEndsAt = Math.max(0, Number(state?.currentPhoneVerificationCountdownEndsAt) || 0);
  phoneRuntimeCountdownWindowIndex = Math.max(0, Math.floor(Number(state?.currentPhoneVerificationCountdownWindowIndex) || 0));
  phoneRuntimeCountdownWindowTotal = Math.max(0, Math.floor(Number(state?.currentPhoneVerificationCountdownWindowTotal) || 0));
  renderPhoneRuntimeCountdown();
  if (phoneRuntimeCountdownEndsAt > Date.now()) {
    if (!phoneRuntimeCountdownTimer) {
      phoneRuntimeCountdownTimer = setInterval(() => {
        renderPhoneRuntimeCountdown();
      }, 1000);
    }
  } else {
    stopPhoneRuntimeCountdownTicker();
  }
}

function renderPhonePreferredActivationOptions(state = {}) {
  if (!selectHeroSmsPreferredActivation) {
    return;
  }
  const provider = normalizePhoneSmsProviderValue(
    state?.phoneSmsProvider || latestState?.phoneSmsProvider || getSelectedPhoneSmsProvider()
  );
  const selectedPreferred = normalizePhoneActivationState(state?.phonePreferredActivation || latestState?.phonePreferredActivation);
  const reusablePool = Array.isArray(state?.phoneReusableActivationPool)
    ? state.phoneReusableActivationPool
    : (Array.isArray(latestState?.phoneReusableActivationPool) ? latestState.phoneReusableActivationPool : []);
  const optionEntries = [];
  const seen = new Set();
  const pushActivationOption = (activation, sourceLabel) => {
    const normalized = normalizePhoneActivationState(activation);
    if (!normalized || normalized.provider !== provider) {
      return;
    }
    const key = buildPhoneActivationOptionKey(normalized);
    if (!key || seen.has(key)) {
      return;
    }
    seen.add(key);
    optionEntries.push({
      key,
      activation: normalized,
      label: buildPhoneActivationOptionLabel(normalized, sourceLabel),
    });
  };
  pushActivationOption(state?.currentPhoneActivation || latestState?.currentPhoneActivation, '当前');
  pushActivationOption(state?.reusablePhoneActivation || latestState?.reusablePhoneActivation, '复用');
  reusablePool.forEach((activation) => pushActivationOption(activation, '池'));
  pushActivationOption(selectedPreferred, '已选');

  phonePreferredActivationOptionMap.clear();
  selectHeroSmsPreferredActivation.innerHTML = '';
  const autoOption = document.createElement('option');
  autoOption.value = '';
  autoOption.textContent = '自动（先复用已有可用号，再创建新号）';
  selectHeroSmsPreferredActivation.appendChild(autoOption);
  optionEntries.forEach((entry) => {
    phonePreferredActivationOptionMap.set(entry.key, entry.activation);
    const option = document.createElement('option');
    option.value = entry.key;
    option.textContent = entry.label;
    selectHeroSmsPreferredActivation.appendChild(option);
  });

  const selectedKey = buildPhoneActivationOptionKey(selectedPreferred);
  if (selectedKey && phonePreferredActivationOptionMap.has(selectedKey)) {
    selectHeroSmsPreferredActivation.value = selectedKey;
  } else {
    selectHeroSmsPreferredActivation.value = '';
  }
}

function getSelectedPhonePreferredActivation() {
  if (!selectHeroSmsPreferredActivation) {
    return null;
  }
  const selectedKey = String(selectHeroSmsPreferredActivation.value || '').trim();
  if (!selectedKey) {
    return null;
  }
  const activation = phonePreferredActivationOptionMap.get(selectedKey);
  return activation ? { ...activation } : null;
}

function updateHeroSmsRuntimeDisplay(state = {}) {
  if (displayHeroSmsCurrentNumber) {
    const activation = normalizePhoneActivationState(state?.currentPhoneActivation || latestState?.currentPhoneActivation);
    const phoneNumber = String(activation?.phoneNumber || '').trim();
    const activationId = String(activation?.activationId || '').trim();
    const countryLabel = normalizePhoneSmsCountryLabel(
      activation?.countryLabel || getHeroSmsCountryLabelById(activation?.countryId || ''),
      activation?.provider || getSelectedPhoneSmsProvider()
    );
    displayHeroSmsCurrentNumber.textContent = phoneNumber
      ? `${phoneNumber}${activationId ? ` (#${activationId})` : ''}${countryLabel ? ` / ${countryLabel}` : ''}`
      : '未分配';
  }
  if (displayHeroSmsCurrentCode) {
    const code = String(state?.currentPhoneVerificationCode ?? latestState?.currentPhoneVerificationCode ?? '').trim();
    displayHeroSmsCurrentCode.textContent = code || '未获取';
  }
  if (displayFreeReusablePhone || displayFreeReusablePhoneCountry || inputFreeReusablePhone) {
    const activation = state?.freeReusablePhoneActivation ?? latestState?.freeReusablePhoneActivation ?? null;
    const phoneNumber = String(activation?.phoneNumber || '').trim();
    const activationId = String(activation?.activationId || '').trim();
    const successfulUses = Number.isFinite(Number(activation?.successfulUses))
      ? Number(activation.successfulUses)
      : null;
    const maxUses = Number.isFinite(Number(activation?.maxUses))
      ? Number(activation.maxUses)
      : null;
    const countryLabel = normalizePhoneSmsCountryLabel(
      activation?.countryLabel
      || getHeroSmsCountryLabelById(activation?.countryId || '')
      || state?.heroSmsCountryLabel
      || latestState?.heroSmsCountryLabel
      || getHeroSmsCountryLabelById(state?.heroSmsCountryId || latestState?.heroSmsCountryId || ''),
      activation?.provider || getSelectedPhoneSmsProvider()
    );
    const usesText = successfulUses !== null || maxUses !== null
      ? ` / ${successfulUses ?? 0}/${maxUses ?? 3}`
      : '';
    if (displayFreeReusablePhone) {
      displayFreeReusablePhone.textContent = phoneNumber
        ? `${phoneNumber}${activationId ? ` (#${activationId})` : ''}${usesText}`
        : '未保存';
    }
    if (displayFreeReusablePhoneCountry) {
      displayFreeReusablePhoneCountry.textContent = phoneNumber
        ? `地区：${countryLabel || '未保存'}`
        : '地区：未保存';
    }
    if (inputFreeReusablePhone) {
      inputFreeReusablePhone.value = phoneNumber;
    }
  }
  syncPhoneRuntimeCountdown(state);
  renderPhonePreferredActivationOptions(state);
}

function applyFreeReusablePhoneMutationResult(refreshedState = {}, mutationResult = {}, options = {}) {
  const { clear = false } = options;
  const explicitActivation = clear
    ? null
    : (
      mutationResult?.freeReusablePhoneActivation
      || mutationResult?.state?.freeReusablePhoneActivation
      || null
    );
  const statePatch = {
    ...(refreshedState || {}),
    ...(mutationResult?.state || {}),
    ...(clear || explicitActivation
      ? { freeReusablePhoneActivation: explicitActivation }
      : {}),
  };
  syncLatestState(statePatch);
  updateHeroSmsRuntimeDisplay(latestState || statePatch);
}

async function refreshFreeReusablePhoneStateFallback(mutationResult = {}, options = {}) {
  if (mutationResult?.state || mutationResult?.freeReusablePhoneActivation || options.clear) {
    applyFreeReusablePhoneMutationResult(latestState, mutationResult, options);
    return;
  }
  try {
    const refreshedState = await chrome.runtime.sendMessage({ type: 'GET_STATE', source: 'sidepanel' });
    applyFreeReusablePhoneMutationResult(refreshedState || latestState, mutationResult, options);
  } catch (error) {
    console.warn('Failed to refresh free reusable phone state:', error);
    applyFreeReusablePhoneMutationResult(latestState, mutationResult, options);
  }
}

async function loadHeroSmsCountries() {
  const countrySelect = selectHeroSmsCountry || selectHeroSmsCountryFallback;
  if (!countrySelect) {
    return;
  }

  const provider = getSelectedPhoneSmsProvider();
  const previousSelectionOrder = [...heroSmsCountrySelectionOrder];
  const previousSelectedIds = previousSelectionOrder.length
    ? previousSelectionOrder
    : Array.from(countrySelect.options)
        .filter((option) => option.selected)
        .map((option) => normalizePhoneSmsCountryId(option.value, provider))
        .filter(Boolean);

  const applyOptions = (optionItems = [], selectEl) => {
    if (!selectEl) {
      return;
    }
    selectEl.innerHTML = '';
    optionItems.forEach((entry) => {
      const option = document.createElement('option');
      option.value = String(entry.id);
      option.textContent = entry.label;
      selectEl.appendChild(option);
    });
  };

  if (provider === PHONE_SMS_PROVIDER_FIVE_SIM) {
    try {
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), 10000);
      const response = await fetch('https://5sim.net/v1/guest/countries', {
        signal: controller.signal,
        cache: 'no-store',
        headers: { Accept: 'application/json' },
      });
      clearTimeout(timeoutId);
      if (!response.ok) {
        throw new Error(`HTTP ${response.status}`);
      }
      const payload = await response.json();
      const countriesPayload = payload && typeof payload === 'object' && !Array.isArray(payload) ? payload : {};
      const optionItems = Object.entries(countriesPayload)
        .map(([slug, entry]) => {
          const id = normalizeFiveSimCountryId(slug, '');
          const label = formatFiveSimCountryDisplayLabel(id, entry?.text_en || slug, slug);
          return {
            id,
            label,
            searchText: [
              slug,
              label,
              entry?.text_en,
              entry?.text_ru,
              Object.keys(entry?.iso || {}).join(' '),
              Object.keys(entry?.prefix || {}).join(' '),
            ].filter(Boolean).join(' '),
          };
        })
        .filter((entry) => entry.id)
        .sort((left, right) => String(left.label || '').localeCompare(String(right.label || '')));
      if (!optionItems.length) {
        throw new Error('empty country list');
      }
      heroSmsCountrySearchTextById.clear();
      optionItems.forEach((entry) => heroSmsCountrySearchTextById.set(String(entry.id), entry.searchText));
      applyOptions(optionItems, selectHeroSmsCountry);
      applyOptions(optionItems, selectHeroSmsCountryFallback);
    } catch (error) {
      console.warn('Failed to load 5sim countries:', error);
      const fallbackItems = FIVE_SIM_SUPPORTED_COUNTRY_ITEMS.map((item) => ({
        id: item.id,
        label: formatFiveSimCountryDisplayLabel(item.id, item.eng),
        searchText: item.searchText,
      }));
      applyOptions(fallbackItems, selectHeroSmsCountry);
      applyOptions(fallbackItems, selectHeroSmsCountryFallback);
      heroSmsCountrySearchTextById.clear();
      fallbackItems.forEach((entry) => heroSmsCountrySearchTextById.set(String(entry.id), entry.searchText));
      if (typeof showToast === 'function') {
        showToast(`5sim 国家列表加载失败：${normalizeHeroSmsFetchErrorMessage(error)}（已切换为内置国家列表）`, 'warn', 2800);
      }
    }
  } else try {
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 10000);
    const response = await fetch('https://hero-sms.com/stubs/handler_api.php?action=getCountries', {
      signal: controller.signal,
      cache: 'no-store',
    });
    clearTimeout(timeoutId);
    const payload = await response.json();
    const countries = Array.isArray(payload?.value) ? payload.value : (Array.isArray(payload) ? payload : []);
    if (!countries.length) {
      throw new Error('empty country list');
    }
    const optionItems = countries
      .filter((item) => Number(item?.id) > 0 && (String(item?.eng || '').trim() || String(item?.chn || '').trim()))
      .sort((left, right) => String(left.eng || '').localeCompare(String(right.eng || '')))
      .map((item) => {
        const id = normalizeHeroSmsCountryId(item.id);
        const label = buildHeroSmsCountryDisplayLabel(item);
        return {
          id,
          label: String(label || '').trim() || `Country #${id}`,
          searchText: buildHeroSmsCountrySearchText(item, label, String(id)),
        };
      });

    if (!optionItems.length) {
      throw new Error('empty country list');
    }

    heroSmsCountrySearchTextById.clear();
    optionItems.forEach((entry) => {
      heroSmsCountrySearchTextById.set(String(entry.id), entry.searchText);
    });

    applyOptions(optionItems, selectHeroSmsCountry);
    applyOptions(optionItems, selectHeroSmsCountryFallback);
  } catch (error) {
    console.warn('Failed to load HeroSMS countries:', error);
    const fallbackItems = HERO_SMS_FALLBACK_COUNTRY_ITEMS
      .map((item) => {
        const id = normalizeHeroSmsCountryId(item.id);
        const label = buildHeroSmsCountryDisplayLabel(item);
        return {
          id,
          label: String(label || '').trim() || `Country #${id}`,
          searchText: buildHeroSmsCountrySearchText(item, label, String(id)),
        };
      })
      .filter((item) => item.id > 0);
    if (!fallbackItems.some((item) => item.id === DEFAULT_HERO_SMS_COUNTRY_ID)) {
      fallbackItems.unshift({
        id: DEFAULT_HERO_SMS_COUNTRY_ID,
        label: DEFAULT_HERO_SMS_COUNTRY_LABEL,
        searchText: `${DEFAULT_HERO_SMS_COUNTRY_LABEL} ${DEFAULT_HERO_SMS_COUNTRY_ID}`,
      });
    }
    applyOptions(fallbackItems, selectHeroSmsCountry);
    applyOptions(fallbackItems, selectHeroSmsCountryFallback);
    heroSmsCountrySearchTextById.clear();
    fallbackItems.forEach((entry) => {
      heroSmsCountrySearchTextById.set(String(entry.id), entry.searchText);
    });
    if (typeof showToast === 'function') {
      showToast(`国家列表加载失败：${normalizeHeroSmsFetchErrorMessage(error)}（已切换为内置国家列表）`, 'warn', 2800);
    }
  }
  const availableIds = new Set(Array.from(countrySelect.options).map((option) => String(option.value)));
  const normalizedSelectedIds = previousSelectedIds
    .map((id) => String(id))
    .filter((id) => availableIds.has(id))
    .map((id) => normalizePhoneSmsCountryId(id, provider));
  heroSmsCountrySelectionOrder = normalizedSelectedIds;
  const selectedSet = new Set(normalizedSelectedIds.map((id) => String(id)));
  Array.from(countrySelect.options).forEach((option) => {
    option.selected = selectedSet.has(String(option.value));
  });
  syncHeroSmsFallbackSelectionOrderFromSelect({
    enforceMax: true,
    ensureDefault: false,
    showLimitToast: false,
  });
  updateHeroSmsPlatformDisplay();
}

function getFiveSimCountryLabelByCode(code = '') {
  const normalizedCode = normalizeFiveSimCountryCode(code, '');
  if (!normalizedCode || !selectFiveSimCountry) {
    return '';
  }
  const matched = Array.from(selectFiveSimCountry.options || [])
    .find((option) => String(option.value || '').trim() === normalizedCode);
  return normalizeFiveSimCountryLabel(matched?.textContent || '', normalizedCode);
}

function renderFiveSimCountryFallbackOrder(countries = []) {
  if (!displayFiveSimCountryFallbackOrder) {
    return;
  }
  const normalized = normalizeFiveSimCountryFallbackList(countries);
  displayFiveSimCountryFallbackOrder.textContent = '';
  if (!normalized.length) {
    displayFiveSimCountryFallbackOrder.textContent = '未设置';
    return;
  }
  normalized.forEach((country, index) => {
    const chip = document.createElement('span');
    chip.className = 'country-order-chip';
    const label = document.createElement('span');
    label.className = 'country-order-chip-label';
    label.textContent = `${index + 1}. ${country.label}`;
    const removeBtn = document.createElement('button');
    removeBtn.type = 'button';
    removeBtn.className = 'country-order-remove';
    removeBtn.title = `移除 ${country.label}`;
    removeBtn.setAttribute('aria-label', `移除 ${country.label}`);
    removeBtn.textContent = '×';
    removeBtn.addEventListener('click', (event) => {
      event.preventDefault();
      event.stopPropagation();
      removeFiveSimCountryFromOrder(country.code || country.id);
    });
    chip.appendChild(label);
    chip.appendChild(removeBtn);
    displayFiveSimCountryFallbackOrder.appendChild(chip);
    if (index < normalized.length - 1) {
      const separator = document.createElement('span');
      separator.className = 'country-order-separator';
      separator.textContent = '→';
      displayFiveSimCountryFallbackOrder.appendChild(separator);
    }
  });
}

function setFiveSimCountryMenuOpen(open) {
  const nextOpen = Boolean(open);
  if (btnFiveSimCountryMenu) {
    btnFiveSimCountryMenu.setAttribute('aria-expanded', String(nextOpen));
  }
  if (fiveSimCountryMenu) {
    fiveSimCountryMenu.hidden = !nextOpen;
    if (nextOpen) {
      const searchInput = fiveSimCountryMenu.querySelector('.hero-sms-country-menu-search-input');
      if (searchInput) {
        fiveSimCountryMenuSearchKeyword = '';
        searchInput.value = '';
        applyFiveSimCountryMenuFilter('');
        setTimeout(() => {
          searchInput.focus();
          searchInput.select();
        }, 0);
      }
    }
  }
}

function applyFiveSimCountryMenuFilter(keyword = '') {
  if (!fiveSimCountryMenu) {
    return;
  }
  const normalizedKeyword = String(keyword || '').trim().toLowerCase();
  const items = Array.from(fiveSimCountryMenu.querySelectorAll('.hero-sms-country-menu-item'));
  let visibleCount = 0;
  items.forEach((item) => {
    const haystack = String(item.dataset.searchText || '').toLowerCase();
    const visible = !normalizedKeyword || haystack.includes(normalizedKeyword);
    item.hidden = !visible;
    if (visible) {
      visibleCount += 1;
    }
  });

  let empty = fiveSimCountryMenu.querySelector('.hero-sms-country-menu-empty');
  if (visibleCount === 0) {
    if (!empty) {
      empty = document.createElement('span');
      empty.className = 'data-value hero-sms-country-menu-empty';
      empty.textContent = '没有匹配国家';
      fiveSimCountryMenu.appendChild(empty);
    }
  } else if (empty) {
    empty.remove();
  }
}

function updateFiveSimCountryMenuSummary(selectedCountries = []) {
  if (!btnFiveSimCountryMenu) {
    return;
  }
  const normalized = normalizeFiveSimCountryFallbackList(selectedCountries);
  if (!normalized.length) {
    btnFiveSimCountryMenu.textContent = `未选择 (0/${HERO_SMS_COUNTRY_SELECTION_MAX})`;
    return;
  }
  const labels = normalized.map((country) => country.label);
  btnFiveSimCountryMenu.textContent = `${labels.join(' / ')} (${normalized.length}/${HERO_SMS_COUNTRY_SELECTION_MAX})`;
}

function renderFiveSimCountryChoiceButtons() {
  if (!fiveSimCountryMenu || !selectFiveSimCountry) {
    return;
  }
  const options = Array.from(selectFiveSimCountry.options || []);
  const selectedOrder = [...fiveSimCountrySelectionOrder];
  const selectedSet = new Set(selectedOrder);

  fiveSimCountryMenu.innerHTML = '';
  const searchWrap = document.createElement('div');
  searchWrap.className = 'hero-sms-country-menu-search';
  const searchInput = document.createElement('input');
  searchInput.type = 'search';
  searchInput.className = 'data-input mono hero-sms-country-menu-search-input';
  searchInput.placeholder = '搜索国家（中/英/代码）';
  searchInput.value = fiveSimCountryMenuSearchKeyword;
  searchInput.addEventListener('input', () => {
    fiveSimCountryMenuSearchKeyword = String(searchInput.value || '').trim();
    applyFiveSimCountryMenuFilter(fiveSimCountryMenuSearchKeyword);
  });
  searchWrap.appendChild(searchInput);
  fiveSimCountryMenu.appendChild(searchWrap);

  if (!options.length) {
    const empty = document.createElement('span');
    empty.className = 'data-value hero-sms-country-menu-empty';
    empty.textContent = '暂无国家选项';
    fiveSimCountryMenu.appendChild(empty);
    updateFiveSimCountryMenuSummary([]);
    return;
  }

  options.forEach((option) => {
    const countryId = normalizeFiveSimCountryId(option.value, '');
    if (!countryId) {
      return;
    }
    const item = document.createElement('button');
    item.type = 'button';
    item.className = 'hero-sms-country-menu-item';
    item.dataset.countryId = countryId;
    item.dataset.searchText = fiveSimCountrySearchTextByCode.get(countryId)
      || `${countryId} ${option.textContent || ''}`;
    const selected = selectedSet.has(countryId);
    item.setAttribute('aria-pressed', selected ? 'true' : 'false');
    item.textContent = option.textContent || countryId;
    item.addEventListener('click', (event) => {
      event.preventDefault();
      toggleFiveSimCountryInOrder(countryId);
    });
    fiveSimCountryMenu.appendChild(item);
  });
  applyFiveSimCountryMenuFilter(fiveSimCountryMenuSearchKeyword);
}

function syncFiveSimCountrySelectionOrderFromSelect(options = {}) {
  const selectionLimit = Math.max(1, Math.floor(Number(options.maxSelection) || HERO_SMS_COUNTRY_SELECTION_MAX));
  const enforceMax = options.enforceMax !== false;
  const ensureDefault = options.ensureDefault !== false;
  const showLimitToast = Boolean(options.showLimitToast);
  const countrySelect = selectFiveSimCountry;
  if (!countrySelect) {
    fiveSimCountrySelectionOrder = [];
    renderFiveSimCountryFallbackOrder([]);
    updateFiveSimCountryMenuSummary([]);
    return [];
  }

  const selectedCodes = Array.from(countrySelect.options || [])
    .filter((option) => option.selected)
    .map((option) => normalizeFiveSimCountryCode(option.value, ''))
    .filter(Boolean);
  const selectedSet = new Set(selectedCodes);
  let nextOrder = fiveSimCountrySelectionOrder.filter((code) => selectedSet.has(code));
  selectedCodes.forEach((code) => {
    if (!nextOrder.includes(code)) {
      nextOrder.push(code);
    }
  });

  if (ensureDefault && !nextOrder.length) {
    nextOrder = [normalizeFiveSimCountryCode(countrySelect.value || DEFAULT_FIVE_SIM_COUNTRY_ID)];
  }
  if (enforceMax && nextOrder.length > selectionLimit) {
    const droppedCount = nextOrder.length - selectionLimit;
    nextOrder = nextOrder.slice(0, selectionLimit);
    if (showLimitToast && droppedCount > 0 && typeof showToast === 'function') {
      showToast(`5sim 国家最多选择 ${selectionLimit} 个，已保留前 ${selectionLimit} 个。`, 'warn', 2200);
    }
  }

  const nextOrderSet = new Set(nextOrder);
  Array.from(countrySelect.options || []).forEach((option) => {
    option.selected = nextOrderSet.has(normalizeFiveSimCountryCode(option.value, ''));
  });
  fiveSimCountrySelectionOrder = [...nextOrder];
  const selectedCountries = fiveSimCountrySelectionOrder.map((code) => ({
    id: code,
    code,
    label: getFiveSimCountryOptionLabel(code),
  }));
  renderFiveSimCountryFallbackOrder(selectedCountries);
  updateFiveSimCountryMenuSummary(selectedCountries);
  renderFiveSimCountryChoiceButtons();
  return selectedCountries;
}

function applyFiveSimCountrySelection(countries = [], options = {}) {
  const normalized = normalizeFiveSimCountryFallbackList(countries).slice(0, HERO_SMS_COUNTRY_SELECTION_MAX);
  const selectedCodes = normalized
    .map((entry) => normalizeFiveSimCountryCode(entry.code || entry.id, ''))
    .filter(Boolean);
  fiveSimCountrySelectionOrder = [...selectedCodes];
  if (selectFiveSimCountry) {
    const selectedSet = new Set(selectedCodes);
    Array.from(selectFiveSimCountry.options || []).forEach((option) => {
      option.selected = selectedSet.has(normalizeFiveSimCountryCode(option.value, ''));
    });
  }
  return syncFiveSimCountrySelectionOrderFromSelect({
    ensureDefault: options.ensureDefault !== false,
    enforceMax: true,
    showLimitToast: false,
  });
}

function toggleFiveSimCountryInOrder(code = '') {
  const normalizedCode = normalizeFiveSimCountryCode(code, '');
  if (!normalizedCode || !selectFiveSimCountry) {
    return [];
  }
  const option = Array.from(selectFiveSimCountry.options || [])
    .find((entry) => normalizeFiveSimCountryCode(entry.value, '') === normalizedCode);
  if (option) {
    option.selected = !option.selected;
  }
  const nextOrder = syncFiveSimCountrySelectionOrderFromSelect({
    enforceMax: true,
    ensureDefault: false,
    showLimitToast: true,
  });
  markSettingsDirty(true);
  saveSettings({ silent: true }).catch(() => { });
  return nextOrder;
}

function removeFiveSimCountryFromOrder(code = '') {
  const normalizedCode = normalizeFiveSimCountryCode(code, '');
  fiveSimCountrySelectionOrder = fiveSimCountrySelectionOrder.filter((entry) => entry !== normalizedCode);
  if (selectFiveSimCountry) {
    Array.from(selectFiveSimCountry.options || []).forEach((option) => {
      if (normalizeFiveSimCountryCode(option.value, '') === normalizedCode) {
        option.selected = false;
      }
    });
  }
  const nextOrder = syncFiveSimCountrySelectionOrderFromSelect({
    enforceMax: true,
    ensureDefault: false,
    showLimitToast: false,
  });
  markSettingsDirty(true);
  saveSettings({ silent: true }).catch(() => { });
  return nextOrder;
}

async function loadFiveSimCountries() {
  if (!selectFiveSimCountry) {
    return;
  }
  const previousOrder = [...fiveSimCountrySelectionOrder];
  const applyOptions = (items = []) => {
    selectFiveSimCountry.innerHTML = '';
    fiveSimCountrySearchTextByCode.clear();
    items.forEach((entry) => {
      const code = normalizeFiveSimCountryCode(entry.code || entry.id, '');
      if (!code) {
        return;
      }
      const option = document.createElement('option');
      option.value = code;
      option.textContent = entry.label || getFiveSimCountryOptionLabel(code) || code;
      selectFiveSimCountry.appendChild(option);
      fiveSimCountrySearchTextByCode.set(code, entry.searchText || `${option.textContent} ${code}`);
    });
  };
  const fallbackItems = FIVE_SIM_SUPPORTED_COUNTRY_ITEMS.map((item) => ({
    id: item.id,
    code: item.id,
    label: formatFiveSimCountryDisplayLabel(item.id, item.eng, item.id),
    searchText: item.searchText,
  }));

  try {
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 10000);
    const response = await fetch('https://5sim.net/v1/guest/countries', {
      signal: controller.signal,
      cache: 'no-store',
      headers: { Accept: 'application/json' },
    });
    clearTimeout(timeoutId);
    if (!response.ok) {
      throw new Error(`HTTP ${response.status}`);
    }
    const payload = await response.json();
    const items = parseFiveSimCountriesPayload(payload);
    applyOptions(items.length ? items : fallbackItems);
  } catch (error) {
    console.warn('Failed to load 5sim countries:', error);
    applyOptions(fallbackItems);
  }

  applyFiveSimCountrySelection(previousOrder.length ? previousOrder : latestState?.fiveSimCountryOrder || [], {
    ensureDefault: false,
  });
}

function renderNexSmsCountryFallbackOrder(countries = []) {
  if (!displayNexSmsCountryFallbackOrder) {
    return;
  }
  const normalized = normalizeNexSmsCountryFallbackList(countries);
  displayNexSmsCountryFallbackOrder.textContent = '';
  if (!normalized.length) {
    displayNexSmsCountryFallbackOrder.textContent = '未设置';
    return;
  }
  normalized.forEach((country, index) => {
    const chip = document.createElement('span');
    chip.className = 'country-order-chip';
    const label = document.createElement('span');
    label.className = 'country-order-chip-label';
    label.textContent = `${index + 1}. ${country.label}`;
    const removeBtn = document.createElement('button');
    removeBtn.type = 'button';
    removeBtn.className = 'country-order-remove';
    removeBtn.title = `移除 ${country.label}`;
    removeBtn.setAttribute('aria-label', `移除 ${country.label}`);
    removeBtn.textContent = '×';
    removeBtn.addEventListener('click', (event) => {
      event.preventDefault();
      event.stopPropagation();
      removeNexSmsCountryFromOrder(country.id);
    });
    chip.appendChild(label);
    chip.appendChild(removeBtn);
    displayNexSmsCountryFallbackOrder.appendChild(chip);
    if (index < normalized.length - 1) {
      const separator = document.createElement('span');
      separator.className = 'country-order-separator';
      separator.textContent = '→';
      displayNexSmsCountryFallbackOrder.appendChild(separator);
    }
  });
}

function setNexSmsCountryMenuOpen(open) {
  const nextOpen = Boolean(open);
  if (btnNexSmsCountryMenu) {
    btnNexSmsCountryMenu.setAttribute('aria-expanded', String(nextOpen));
  }
  if (nexSmsCountryMenu) {
    nexSmsCountryMenu.hidden = !nextOpen;
    if (nextOpen) {
      const searchInput = nexSmsCountryMenu.querySelector('.hero-sms-country-menu-search-input');
      if (searchInput) {
        nexSmsCountryMenuSearchKeyword = '';
        searchInput.value = '';
        applyNexSmsCountryMenuFilter('');
        setTimeout(() => {
          searchInput.focus();
          searchInput.select();
        }, 0);
      }
    }
  }
}

function applyNexSmsCountryMenuFilter(keyword = '') {
  if (!nexSmsCountryMenu) {
    return;
  }
  const normalizedKeyword = String(keyword || '').trim().toLowerCase();
  const items = Array.from(nexSmsCountryMenu.querySelectorAll('.hero-sms-country-menu-item'));
  let visibleCount = 0;
  items.forEach((item) => {
    const haystack = String(item.dataset.searchText || '').toLowerCase();
    const visible = !normalizedKeyword || haystack.includes(normalizedKeyword);
    item.hidden = !visible;
    if (visible) {
      visibleCount += 1;
    }
  });
  let empty = nexSmsCountryMenu.querySelector('.hero-sms-country-menu-empty');
  if (visibleCount === 0) {
    if (!empty) {
      empty = document.createElement('span');
      empty.className = 'data-value hero-sms-country-menu-empty';
      empty.textContent = '没有匹配国家';
      nexSmsCountryMenu.appendChild(empty);
    }
  } else if (empty) {
    empty.remove();
  }
}

function updateNexSmsCountryMenuSummary(selectedCountries = []) {
  if (!btnNexSmsCountryMenu) {
    return;
  }
  const normalized = normalizeNexSmsCountryFallbackList(selectedCountries);
  btnNexSmsCountryMenu.textContent = normalized.length
    ? `${normalized.map((country) => country.label).join(' / ')} (${normalized.length}/${HERO_SMS_COUNTRY_SELECTION_MAX})`
    : `未选择 (0/${HERO_SMS_COUNTRY_SELECTION_MAX})`;
}

function renderNexSmsCountryChoiceButtons() {
  if (!nexSmsCountryMenu || !selectNexSmsCountry) {
    return;
  }
  const options = Array.from(selectNexSmsCountry.options || []);
  const selectedOrder = [...nexSmsCountrySelectionOrder];
  const selectedSet = new Set(selectedOrder);
  nexSmsCountryMenu.innerHTML = '';
  const searchWrap = document.createElement('div');
  searchWrap.className = 'hero-sms-country-menu-search';
  const searchInput = document.createElement('input');
  searchInput.type = 'search';
  searchInput.className = 'data-input mono hero-sms-country-menu-search-input';
  searchInput.placeholder = '搜索国家 ID';
  searchInput.value = nexSmsCountryMenuSearchKeyword;
  searchInput.addEventListener('input', () => {
    nexSmsCountryMenuSearchKeyword = String(searchInput.value || '').trim();
    applyNexSmsCountryMenuFilter(nexSmsCountryMenuSearchKeyword);
  });
  searchWrap.appendChild(searchInput);
  nexSmsCountryMenu.appendChild(searchWrap);

  if (!options.length) {
    const empty = document.createElement('span');
    empty.className = 'data-value hero-sms-country-menu-empty';
    empty.textContent = '暂无国家选项';
    nexSmsCountryMenu.appendChild(empty);
    updateNexSmsCountryMenuSummary([]);
    return;
  }

  options.forEach((option) => {
    const countryId = normalizeNexSmsCountryIdValue(option.value, -1);
    if (countryId < 0) {
      return;
    }
    const item = document.createElement('button');
    item.type = 'button';
    item.className = 'hero-sms-country-menu-item';
    item.dataset.countryId = String(countryId);
    item.dataset.searchText = nexSmsCountrySearchTextById.get(countryId)
      || `${countryId} ${option.textContent || ''}`;
    const selected = selectedSet.has(countryId);
    item.setAttribute('aria-pressed', selected ? 'true' : 'false');
    item.textContent = option.textContent || `Country #${countryId}`;
    item.addEventListener('click', (event) => {
      event.preventDefault();
      toggleNexSmsCountryInOrder(countryId);
    });
    nexSmsCountryMenu.appendChild(item);
  });
  applyNexSmsCountryMenuFilter(nexSmsCountryMenuSearchKeyword);
}

function syncNexSmsCountrySelectionOrderFromSelect(options = {}) {
  const selectionLimit = Math.max(1, Math.floor(Number(options.maxSelection) || HERO_SMS_COUNTRY_SELECTION_MAX));
  const enforceMax = options.enforceMax !== false;
  const ensureDefault = options.ensureDefault !== false;
  const showLimitToast = Boolean(options.showLimitToast);
  const countrySelect = selectNexSmsCountry;
  if (!countrySelect) {
    nexSmsCountrySelectionOrder = [];
    renderNexSmsCountryFallbackOrder([]);
    updateNexSmsCountryMenuSummary([]);
    return [];
  }

  const selectedIds = Array.from(countrySelect.options || [])
    .filter((option) => option.selected)
    .map((option) => normalizeNexSmsCountryIdValue(option.value, -1))
    .filter((id) => id >= 0);
  const selectedSet = new Set(selectedIds);
  let nextOrder = nexSmsCountrySelectionOrder.filter((id) => selectedSet.has(id));
  selectedIds.forEach((id) => {
    if (!nextOrder.includes(id)) {
      nextOrder.push(id);
    }
  });

  if (ensureDefault && !nextOrder.length) {
    nextOrder = [normalizeNexSmsCountryIdValue(DEFAULT_NEX_SMS_COUNTRY_ORDER[0], 1)];
  }
  if (enforceMax && nextOrder.length > selectionLimit) {
    const droppedCount = nextOrder.length - selectionLimit;
    nextOrder = nextOrder.slice(0, selectionLimit);
    if (showLimitToast && droppedCount > 0 && typeof showToast === 'function') {
      showToast(`NexSMS 国家最多选择 ${selectionLimit} 个，已保留前 ${selectionLimit} 个。`, 'warn', 2200);
    }
  }

  const nextOrderSet = new Set(nextOrder);
  Array.from(countrySelect.options || []).forEach((option) => {
    option.selected = nextOrderSet.has(normalizeNexSmsCountryIdValue(option.value, -1));
  });
  nexSmsCountrySelectionOrder = [...nextOrder];
  const selectedCountries = nexSmsCountrySelectionOrder.map((id) => ({
    id,
    label: getNexSmsCountryLabelById(id),
  }));
  renderNexSmsCountryFallbackOrder(selectedCountries);
  updateNexSmsCountryMenuSummary(selectedCountries);
  renderNexSmsCountryChoiceButtons();
  return selectedCountries;
}

function applyNexSmsCountrySelection(countries = [], options = {}) {
  const normalized = normalizeNexSmsCountryFallbackList(countries).slice(0, HERO_SMS_COUNTRY_SELECTION_MAX);
  const selectedIds = normalized
    .map((entry) => normalizeNexSmsCountryIdValue(entry.id, -1))
    .filter((id) => id >= 0);
  nexSmsCountrySelectionOrder = [...selectedIds];
  if (selectNexSmsCountry) {
    const selectedSet = new Set(selectedIds);
    Array.from(selectNexSmsCountry.options || []).forEach((option) => {
      option.selected = selectedSet.has(normalizeNexSmsCountryIdValue(option.value, -1));
    });
  }
  return syncNexSmsCountrySelectionOrderFromSelect({
    ensureDefault: options.ensureDefault !== false,
    enforceMax: true,
    showLimitToast: false,
  });
}

function toggleNexSmsCountryInOrder(id = -1) {
  const countryId = normalizeNexSmsCountryIdValue(id, -1);
  if (countryId < 0 || !selectNexSmsCountry) {
    return [];
  }
  const option = Array.from(selectNexSmsCountry.options || [])
    .find((entry) => normalizeNexSmsCountryIdValue(entry.value, -1) === countryId);
  if (option) {
    option.selected = !option.selected;
  }
  const nextOrder = syncNexSmsCountrySelectionOrderFromSelect({
    enforceMax: true,
    ensureDefault: false,
    showLimitToast: true,
  });
  markSettingsDirty(true);
  saveSettings({ silent: true }).catch(() => { });
  return nextOrder;
}

function removeNexSmsCountryFromOrder(id = -1) {
  const countryId = normalizeNexSmsCountryIdValue(id, -1);
  nexSmsCountrySelectionOrder = nexSmsCountrySelectionOrder.filter((entry) => entry !== countryId);
  if (selectNexSmsCountry) {
    Array.from(selectNexSmsCountry.options || []).forEach((option) => {
      if (normalizeNexSmsCountryIdValue(option.value, -1) === countryId) {
        option.selected = false;
      }
    });
  }
  const nextOrder = syncNexSmsCountrySelectionOrderFromSelect({
    enforceMax: true,
    ensureDefault: false,
    showLimitToast: false,
  });
  markSettingsDirty(true);
  saveSettings({ silent: true }).catch(() => { });
  return nextOrder;
}

async function loadNexSmsCountries() {
  if (!selectNexSmsCountry) {
    return;
  }
  const previousOrder = [...nexSmsCountrySelectionOrder];
  selectNexSmsCountry.innerHTML = '';
  nexSmsCountrySearchTextById.clear();
  NEX_SMS_FALLBACK_COUNTRY_ITEMS.forEach((entry) => {
    const id = normalizeNexSmsCountryIdValue(entry.id, -1);
    if (id < 0) {
      return;
    }
    const option = document.createElement('option');
    option.value = String(id);
    option.textContent = entry.label || `Country #${id}`;
    selectNexSmsCountry.appendChild(option);
    nexSmsCountrySearchTextById.set(id, entry.searchText || `${option.textContent} ${id}`);
  });
  applyNexSmsCountrySelection(previousOrder.length ? previousOrder : latestState?.nexSmsCountryOrder || [], {
    ensureDefault: false,
  });
}

async function buildNexSmsPricePreviewLines(options = {}) {
  const countryIds = (
    typeof getSelectedNexSmsCountries === 'function'
      ? getSelectedNexSmsCountries()
      : normalizeNexSmsCountryFallbackList(
        Array.isArray(latestState?.nexSmsCountryOrder) ? latestState.nexSmsCountryOrder : []
      )
  )
    .map((country) => normalizeNexSmsCountryIdValue(country.id, -1))
    .filter((id) => id >= 0);
  const serviceCode = normalizeNexSmsServiceCodeValue(
    inputNexSmsServiceCode?.value || latestState?.nexSmsServiceCode || DEFAULT_NEX_SMS_SERVICE_CODE
  );
  const maxPriceText = normalizeHeroSmsMaxPriceValue(inputHeroSmsMaxPrice?.value || '');
  const maxPrice = maxPriceText ? Number(maxPriceText) : null;
  const apiKey = String(inputNexSmsApiKey?.value || '').trim();
  const providerLabel = String(options?.providerLabel || 'NexSMS').trim();

  if (!apiKey) {
    return [`${providerLabel}: 请先填写 NexSMS API Key`];
  }
  if (!countryIds.length) {
    return [`${providerLabel}: 请先选择至少 1 个国家`];
  }

  const previews = [];
  for (const countryId of countryIds) {
    const countryLabel = getNexSmsCountryLabelById(countryId) || `Country #${countryId}`;
    try {
      const url = new URL('/api/getCountryByService', 'https://api.nexsms.net');
      url.searchParams.set('apiKey', apiKey);
      url.searchParams.set('serviceCode', serviceCode);
      url.searchParams.set('countryId', String(countryId));
      const response = await fetch(url.toString(), { cache: 'no-store' });
      const payload = await response.json().catch(() => ({}));
      if (!response.ok || Number(payload?.code) !== 0) {
        previews.push(`${countryLabel}: ${describeNexSmsPreviewPayload(payload) || `HTTP ${response.status}`}`);
        continue;
      }
      const data = payload?.data || {};
      const tierEntries = data?.priceMap && typeof data.priceMap === 'object'
        ? Object.entries(data.priceMap)
          .map(([price, count]) => {
            const numericPrice = Number(price);
            const numericCount = Number(count);
            if (!Number.isFinite(numericPrice) || numericPrice <= 0) {
              return null;
            }
            return {
              price: Math.round(numericPrice * 10000) / 10000,
              count: Number.isFinite(numericCount) ? Math.max(0, Math.floor(numericCount)) : null,
            };
          })
          .filter(Boolean)
        : [];
      const availablePrices = tierEntries
        .filter((entry) => entry.count === null || entry.count > 0)
        .map((entry) => entry.price);
      const uniqueSorted = Array.from(new Set(availablePrices)).sort((left, right) => left - right);
      const fallbackMin = Number(data?.minPrice);
      const lowest = uniqueSorted.length
        ? uniqueSorted[0]
        : (Number.isFinite(fallbackMin) && fallbackMin > 0 ? Math.round(fallbackMin * 10000) / 10000 : null);
      if (!Number.isFinite(lowest)) {
        previews.push(`${countryLabel}: 暂无可用号源`);
        continue;
      }
      const tierText = formatPriceTiersForPreview(tierEntries, { maxPrice });
      if (Number.isFinite(maxPrice) && maxPrice > 0 && lowest > maxPrice) {
        previews.push(`${countryLabel}: 最低 ${lowest}（高于上限 ${maxPrice}）${tierText ? `；档位：${tierText}` : ''}`);
      } else {
        previews.push(`${countryLabel}: 最低 ${lowest}${tierText ? `；档位：${tierText}` : ''}`);
      }
    } catch (error) {
      previews.push(`${countryLabel}: 查询失败（${normalizeHeroSmsFetchErrorMessage(error)}）`);
    }
  }

  if (!previews.length) {
    previews.push('未获取');
  }
  return [`${providerLabel}:`, ...previews];
}

async function previewFiveSimPriceTiers() {
  if (!displayHeroSmsPriceTiers) {
    return;
  }
  const countryCodes = (
    typeof getSelectedFiveSimCountries === 'function'
      ? getSelectedFiveSimCountries()
      : normalizeFiveSimCountryFallbackList(
        Array.isArray(latestState?.fiveSimCountryOrder) ? latestState.fiveSimCountryOrder : []
      )
  )
    .map((country) => normalizeFiveSimCountryCode(country.code || country.id, ''))
    .filter(Boolean);
  const product = normalizeFiveSimProductValue(
    inputFiveSimProduct?.value || latestState?.fiveSimProduct || DEFAULT_FIVE_SIM_PRODUCT
  );
  const maxPriceText = normalizeHeroSmsMaxPriceValue(inputHeroSmsMaxPrice?.value || '');
  const maxPrice = maxPriceText ? Number(maxPriceText) : null;

  displayHeroSmsPriceTiers.textContent = '查询中...';
  if (rowHeroSmsPriceTiers) {
    rowHeroSmsPriceTiers.style.display = '';
  }
  if (!countryCodes.length) {
    displayHeroSmsPriceTiers.textContent = '请先选择至少 1 个国家，再查询价格';
    return;
  }

  const collectPriceEntries = (payload, entries = []) => {
    if (Array.isArray(payload)) {
      payload.forEach((entry) => collectPriceEntries(entry, entries));
      return entries;
    }
    if (!payload || typeof payload !== 'object') {
      return entries;
    }
    const cost = Number(payload.cost);
    const count = Number(payload.count);
    if (Number.isFinite(cost) && cost > 0) {
      entries.push({
        cost: Math.round(cost * 10000) / 10000,
        count: Number.isFinite(count) ? count : 0,
      });
    }
    Object.entries(payload).forEach(([key, value]) => {
      const keyedPrice = Number(key);
      if (!Number.isFinite(keyedPrice) || keyedPrice <= 0) {
        return;
      }
      if (value && typeof value === 'object') {
        const keyedCount = Number(value.count);
        entries.push({
          cost: Math.round(keyedPrice * 10000) / 10000,
          count: Number.isFinite(keyedCount) ? keyedCount : 0,
        });
        return;
      }
      const numericCount = Number(value);
      entries.push({
        cost: Math.round(keyedPrice * 10000) / 10000,
        count: Number.isFinite(numericCount) ? numericCount : 0,
      });
    });
    Object.values(payload).forEach((entry) => collectPriceEntries(entry, entries));
    return entries;
  };

  const previews = [];
  for (const countryCode of countryCodes) {
    const countryLabel = getFiveSimCountryLabelByCode(countryCode) || countryCode;
    try {
      const url = new URL('https://5sim.net/v1/guest/prices');
      url.searchParams.set('country', countryCode);
      url.searchParams.set('product', product);
      const response = await fetch(url.toString(), { cache: 'no-store' });
      const payload = await response.json().catch(() => ({}));
      if (!response.ok) {
        previews.push(`${countryLabel}: HTTP ${response.status}`);
        continue;
      }
      const productRoot = payload?.[product] || payload;
      const countryRoot = productRoot?.[countryCode] || productRoot;
      const tierEntries = collectPriceEntries(countryRoot, [])
        .filter((entry) => Number.isFinite(entry.cost) && entry.cost > 0)
        .map((entry) => ({
          price: entry.cost,
          count: Number.isFinite(entry.count) ? Math.max(0, Math.floor(entry.count)) : null,
        }));
      const prices = tierEntries
        .filter((entry) => entry.count === null || entry.count > 0)
        .map((entry) => entry.price);
      const uniqueSorted = Array.from(new Set(prices)).sort((left, right) => left - right);
      if (!uniqueSorted.length) {
        previews.push(`${countryLabel}: 暂无可用号源`);
        continue;
      }
      const lowest = uniqueSorted[0];
      const tierText = formatPriceTiersForPreview(tierEntries, { maxPrice });
      if (Number.isFinite(maxPrice) && maxPrice > 0 && lowest > maxPrice) {
        previews.push(`${countryLabel}: 最低 ${lowest}（高于上限 ${maxPrice}）${tierText ? `；档位：${tierText}` : ''}`);
      } else {
        previews.push(`${countryLabel}: 最低 ${lowest}${tierText ? `；档位：${tierText}` : ''}`);
      }
    } catch (error) {
      previews.push(`${countryLabel}: 查询失败（${normalizeHeroSmsFetchErrorMessage(error)}）`);
    }
  }
  displayHeroSmsPriceTiers.textContent = previews.join('\n') || '未获取';
}

async function buildFiveSimPricePreviewLines(options = {}) {
  const countryCodes = (
    typeof getSelectedFiveSimCountries === 'function'
      ? getSelectedFiveSimCountries()
      : normalizeFiveSimCountryFallbackList(
        Array.isArray(latestState?.fiveSimCountryOrder) ? latestState.fiveSimCountryOrder : []
      )
  )
    .map((country) => normalizeFiveSimCountryCode(country.code || country.id, ''))
    .filter(Boolean);
  const product = normalizeFiveSimProductValue(
    inputFiveSimProduct?.value || latestState?.fiveSimProduct || DEFAULT_FIVE_SIM_PRODUCT
  );
  const maxPriceText = normalizeHeroSmsMaxPriceValue(inputHeroSmsMaxPrice?.value || '');
  const maxPrice = maxPriceText ? Number(maxPriceText) : null;
  const providerLabel = String(options?.providerLabel || '5sim').trim();

  if (!countryCodes.length) {
    return [`${providerLabel}: 请先选择至少 1 个国家`];
  }

  const collectPriceEntries = (payload, entries = []) => {
    if (Array.isArray(payload)) {
      payload.forEach((entry) => collectPriceEntries(entry, entries));
      return entries;
    }
    if (!payload || typeof payload !== 'object') {
      return entries;
    }
    const cost = Number(payload.cost);
    const count = Number(payload.count);
    if (Number.isFinite(cost) && cost > 0) {
      entries.push({
        cost: Math.round(cost * 10000) / 10000,
        count: Number.isFinite(count) ? count : 0,
      });
    }
    Object.entries(payload).forEach(([key, value]) => {
      const keyedPrice = Number(key);
      if (!Number.isFinite(keyedPrice) || keyedPrice <= 0) {
        return;
      }
      if (value && typeof value === 'object') {
        const keyedCount = Number(value.count);
        entries.push({
          cost: Math.round(keyedPrice * 10000) / 10000,
          count: Number.isFinite(keyedCount) ? keyedCount : 0,
        });
        return;
      }
      const numericCount = Number(value);
      entries.push({
        cost: Math.round(keyedPrice * 10000) / 10000,
        count: Number.isFinite(numericCount) ? numericCount : 0,
      });
    });
    Object.values(payload).forEach((entry) => collectPriceEntries(entry, entries));
    return entries;
  };

  const previews = [];
  for (const countryCode of countryCodes) {
    const countryLabel = getFiveSimCountryLabelByCode(countryCode) || countryCode;
    try {
      const url = new URL('https://5sim.net/v1/guest/prices');
      url.searchParams.set('country', countryCode);
      url.searchParams.set('product', product);
      const response = await fetch(url.toString(), { cache: 'no-store' });
      const payload = await response.json().catch(() => ({}));
      if (!response.ok) {
        previews.push(`${countryLabel}: HTTP ${response.status}`);
        continue;
      }
      const productRoot = payload?.[product] || payload;
      const countryRoot = productRoot?.[countryCode] || productRoot;
      const tierEntries = collectPriceEntries(countryRoot, [])
        .filter((entry) => Number.isFinite(entry.cost) && entry.cost > 0)
        .map((entry) => ({
          price: entry.cost,
          count: Number.isFinite(entry.count) ? Math.max(0, Math.floor(entry.count)) : null,
        }));
      const prices = tierEntries
        .filter((entry) => entry.count === null || entry.count > 0)
        .map((entry) => entry.price);
      const uniqueSorted = Array.from(new Set(prices)).sort((left, right) => left - right);
      if (!uniqueSorted.length) {
        previews.push(`${countryLabel}: 暂无可用号源`);
        continue;
      }
      const lowest = uniqueSorted[0];
      const tierText = formatPriceTiersForPreview(tierEntries, { maxPrice });
      if (Number.isFinite(maxPrice) && maxPrice > 0 && lowest > maxPrice) {
        previews.push(`${countryLabel}: 最低 ${lowest}（高于上限 ${maxPrice}）${tierText ? `；档位：${tierText}` : ''}`);
      } else {
        previews.push(`${countryLabel}: 最低 ${lowest}${tierText ? `；档位：${tierText}` : ''}`);
      }
    } catch (error) {
      previews.push(`${countryLabel}: 查询失败（${normalizeHeroSmsFetchErrorMessage(error)}）`);
    }
  }

  if (!previews.length) {
    previews.push('未获取');
  }
  return [`${providerLabel}:`, ...previews];
}

async function previewHeroSmsPriceTiers() {
  const normalizeProvider = typeof normalizePhoneSmsProviderValue === 'function'
    ? normalizePhoneSmsProviderValue
    : ((value = '') => {
      const normalized = String(value || '').trim().toLowerCase();
      if (normalized === '5sim') return '5sim';
      if (normalized === 'nexsms') return 'nexsms';
      return 'hero-sms';
    });
  const fiveSimProviderValue = typeof PHONE_SMS_PROVIDER_FIVE_SIM !== 'undefined' ? PHONE_SMS_PROVIDER_FIVE_SIM : '5sim';
  const nexSmsProviderValue = typeof PHONE_SMS_PROVIDER_NEXSMS !== 'undefined' ? PHONE_SMS_PROVIDER_NEXSMS : 'nexsms';
  const heroProviderValue = typeof PHONE_SMS_PROVIDER_HERO !== 'undefined' ? PHONE_SMS_PROVIDER_HERO : 'hero-sms';
  const defaultProviderValue = typeof DEFAULT_PHONE_SMS_PROVIDER !== 'undefined' ? DEFAULT_PHONE_SMS_PROVIDER : 'hero-sms';
  const activeProvider = typeof getSelectedPhoneSmsProvider === 'function'
    ? getSelectedPhoneSmsProvider()
    : normalizeProvider(selectPhoneSmsProvider?.value || defaultProviderValue);
  displayHeroSmsPriceTiers.textContent = '查询中...';
  if (rowHeroSmsPriceTiers) {
    rowHeroSmsPriceTiers.style.display = '';
  }
  if (!displayHeroSmsPriceTiers) {
    return;
  }

  const selectedProviderOrder = (
    typeof getSelectedPhoneSmsProviderOrder === 'function'
      ? getSelectedPhoneSmsProviderOrder()
      : normalizePhoneSmsProviderOrderValue(phoneSmsProviderOrderSelection, [])
  );
  const providerOrder = selectedProviderOrder.length
    ? selectedProviderOrder
    : [normalizeProvider(activeProvider)];

  const previews = [];
  for (const provider of providerOrder) {
    if (provider === fiveSimProviderValue) {
      const lines = await buildFiveSimPricePreviewLines({ providerLabel: '5sim' });
      previews.push(...lines, '');
      continue;
    }
    if (provider === nexSmsProviderValue) {
      const lines = await buildNexSmsPricePreviewLines({ providerLabel: 'NexSMS' });
      previews.push(...lines, '');
      continue;
    }
    if (provider !== heroProviderValue) {
      continue;
    }

    const selectedCountries = syncHeroSmsFallbackSelectionOrderFromSelect({
      enforceMax: true,
      ensureDefault: false,
      showLimitToast: false,
    });
    const candidates = selectedCountries
      .map((country) => ({
        id: normalizeHeroSmsCountryId(country?.id, 0),
        label: normalizeHeroSmsCountryLabel(country?.label, ''),
      }))
      .filter((country) => country.id > 0);
    const maxPriceText = normalizeHeroSmsMaxPriceValue(inputHeroSmsMaxPrice?.value || '');
    const maxPrice = maxPriceText ? Number(maxPriceText) : null;
    const apiKey = String(inputHeroSmsApiKey?.value || '').trim();

    const heroLines = ['HeroSMS:'];
    if (!apiKey) {
      heroLines.push('请先填写接码 API Key');
      previews.push(...heroLines, '');
      continue;
    }
    if (!candidates.length) {
      heroLines.push('请先选择至少 1 个国家');
      previews.push(...heroLines, '');
      continue;
    }
    for (const country of candidates) {
      const countryId = normalizeHeroSmsCountryId(country.id, 0);
      if (countryId <= 0) {
        continue;
      }
      const countryLabel = normalizeHeroSmsCountryLabel(
        country.label || getHeroSmsCountryLabelById(countryId),
        `Country #${countryId}`
      );
      try {
        const parsedPayloads = [];
        const failedPriceActions = [];
        const fetchPriceAction = async (action) => {
          const url = new URL('https://hero-sms.com/stubs/handler_api.php');
          url.searchParams.set('action', action);
          url.searchParams.set('service', 'dr');
          url.searchParams.set('country', String(countryId));
          if (action === 'getPricesExtended') {
            url.searchParams.set('freePrice', 'true');
          }
          if (apiKey) {
            url.searchParams.set('api_key', apiKey);
          }
          const response = await fetch(url.toString(), { cache: 'no-store' });
          const rawText = await response.text();
          let payload = rawText;
          try {
            payload = rawText ? JSON.parse(rawText) : '';
          } catch {
            payload = rawText;
          }
          if (!response.ok) {
            const reason = summarizeHeroSmsPreviewError(payload, response.status);
            failedPriceActions.push(`${action}: ${reason}`);
            return;
          }
          parsedPayloads.push(payload);
        };

        const fetchTopCountriesPayload = async () => {
          const url = new URL('https://hero-sms.com/stubs/handler_api.php');
          url.searchParams.set('action', 'getTopCountriesByService');
          url.searchParams.set('service', 'dr');
          url.searchParams.set('freePrice', 'true');
          if (apiKey) {
            url.searchParams.set('api_key', apiKey);
          }
          const response = await fetch(url.toString(), { cache: 'no-store' });
          const rawText = await response.text();
          let payload = rawText;
          try {
            payload = rawText ? JSON.parse(rawText) : '';
          } catch {
            payload = rawText;
          }
          if (!response.ok) {
            const reason = summarizeHeroSmsPreviewError(payload, response.status);
            failedPriceActions.push(`getTopCountriesByService: ${reason}`);
            return null;
          }
          return payload;
        };

        const fetchVerificationPricesPayload = async () => {
          const url = new URL('https://hero-sms.com/stubs/handler_api.php');
          url.searchParams.set('action', 'getPricesVerification');
          url.searchParams.set('service', 'dr');
          url.searchParams.set('country', String(countryId));
          if (apiKey) {
            url.searchParams.set('api_key', apiKey);
          }
          const response = await fetch(url.toString(), { cache: 'no-store' });
          const rawText = await response.text();
          let payload = rawText;
          try {
            payload = rawText ? JSON.parse(rawText) : '';
          } catch {
            payload = rawText;
          }
          if (!response.ok) {
            const reason = summarizeHeroSmsPreviewError(payload, response.status);
            failedPriceActions.push(`getPricesVerification: ${reason}`);
            return null;
          }
          return payload;
        };

        await fetchPriceAction('getPricesExtended');
        await fetchPriceAction('getPrices');
        // Additional visibility probe: some regions expose richer tier maps on getPricesForVerification.
        await fetchPriceAction('getPricesForVerification');
        const [topCountriesPayload, verificationPayload] = await Promise.all([
          fetchTopCountriesPayload(),
          fetchVerificationPricesPayload(),
        ]);

        const priceEntries = parsedPayloads
          .flatMap((payload) => collectHeroSmsPriceEntriesForPreview(payload, []))
          .concat(
            collectHeroSmsPriceEntriesFromTopCountriesPayload(topCountriesPayload, countryId, []),
            collectHeroSmsPriceEntriesFromVerificationPayload(verificationPayload, countryId, 'dr', [])
          )
          .filter((entry) => Number.isFinite(Number(entry.cost)) && Number(entry.cost) > 0);
        const tierStockByPrice = new Map();
        for (const entry of priceEntries) {
          const cost = Math.round(Number(entry.cost) * 10000) / 10000;
          if (!Number.isFinite(cost) || cost <= 0) {
            continue;
          }
          const stockCount = Number.isFinite(Number(entry.stockCount)) ? Math.max(0, Number(entry.stockCount)) : 0;
          const previous = tierStockByPrice.get(cost);
          tierStockByPrice.set(cost, Number.isFinite(previous) ? Math.max(previous, stockCount) : stockCount);
        }
        const allPrices = Array.from(tierStockByPrice.keys()).sort((left, right) => left - right);
        const inStockPrices = allPrices.filter((price) => Number(tierStockByPrice.get(price)) > 0);
        const tierEntries = allPrices.map((price) => ({
          price,
          count: Math.max(0, Number(tierStockByPrice.get(price)) || 0),
        }));
        const withinLimitInStockPrices = Number.isFinite(maxPrice) && maxPrice > 0
          ? inStockPrices.filter((price) => price <= maxPrice)
          : inStockPrices;
        const tierPreviewText = formatPriceTiersWithZeroStockForPreview(tierEntries, { maxPrice });
        if (!inStockPrices.length) {
          if (allPrices.length) {
            const lowestKnown = formatHeroSmsPriceForPreview(allPrices[0]) || String(allPrices[0]);
            heroLines.push(`${countryLabel}: 全档位均无库存（最低标价 ${lowestKnown}）${tierPreviewText ? `；档位：${tierPreviewText}` : ''}`);
            continue;
          }
          if (failedPriceActions.length) {
            heroLines.push(`${countryLabel}: ${failedPriceActions.join(' | ')}`);
            continue;
          }
          heroLines.push(`${countryLabel}: 无可用价格`);
          continue;
        }
        if (Number.isFinite(maxPrice) && maxPrice > 0 && !withinLimitInStockPrices.length) {
          const lowestInStockText = formatHeroSmsPriceForPreview(inStockPrices[0]) || String(inStockPrices[0]);
          heroLines.push(`${countryLabel}: 上限内无可用号源（上限 ${formatHeroSmsPriceForPreview(maxPrice) || maxPrice}，最低可用 ${lowestInStockText}）${tierPreviewText ? `；档位：${tierPreviewText}` : ''}`);
        } else {
          const lowestWithinLimit = withinLimitInStockPrices[0];
          const lowestText = formatHeroSmsPriceForPreview(lowestWithinLimit) || String(lowestWithinLimit);
          heroLines.push(`${countryLabel}: 上限内最低 ${lowestText}${tierPreviewText ? `；档位：${tierPreviewText}` : ''}`);
        }
      } catch (error) {
        heroLines.push(`${countryLabel}: 查询失败（${normalizeHeroSmsFetchErrorMessage(error)}）`);
      }
    }
    if (heroLines.length === 1) {
      heroLines.push('未获取');
    }
    previews.push(...heroLines, '');
  }

  while (previews.length && previews[previews.length - 1] === '') {
    previews.pop();
  }
  displayHeroSmsPriceTiers.textContent = previews.join('\n') || '未获取';
}

async function previewPhoneSmsBalance() {
  if (!displayPhoneSmsBalance) {
    return;
  }
  const provider = getSelectedPhoneSmsProvider();
  const apiKey = String(inputHeroSmsApiKey?.value || '').trim();
  if (!apiKey) {
    displayPhoneSmsBalance.textContent = '请先填写接码 API Key';
    if (rowHeroSmsPriceTiers) rowHeroSmsPriceTiers.style.display = '';
    return;
  }
  displayPhoneSmsBalance.textContent = '余额查询中...';
  if (rowHeroSmsPriceTiers) rowHeroSmsPriceTiers.style.display = '';
  try {
    const url = provider === PHONE_SMS_PROVIDER_FIVE_SIM
      ? new URL('https://5sim.net/v1/user/profile')
      : new URL('https://hero-sms.com/stubs/handler_api.php');
    const requestOptions = {};
    if (provider === PHONE_SMS_PROVIDER_FIVE_SIM) {
      requestOptions.headers = {
        Accept: 'application/json',
        Authorization: `Bearer ${apiKey}`,
      };
    } else {
      url.searchParams.set('action', 'getBalance');
      url.searchParams.set('api_key', apiKey);
    }
    const response = await fetch(url.toString(), requestOptions);
    const rawText = await response.text();
    let payload = rawText;
    try {
      payload = rawText ? JSON.parse(rawText) : '';
    } catch {
      payload = rawText;
    }
    if (!response.ok) {
      displayPhoneSmsBalance.textContent = `余额查询失败：${summarizeHeroSmsPreviewError(payload, response.status)}`;
      return;
    }
    if (provider === PHONE_SMS_PROVIDER_FIVE_SIM) {
      const balance = Number(payload?.balance);
      const frozen = Number(payload?.frozen_balance);
      displayPhoneSmsBalance.textContent = Number.isFinite(balance)
        ? `5sim 余额 ${formatHeroSmsPriceForPreview(balance) || balance}${Number.isFinite(frozen) ? `，冻结 ${formatHeroSmsPriceForPreview(frozen) || frozen}` : ''}`
        : `5sim 余额：${describeHeroSmsPreviewPayload(payload) || '未知'}`;
    } else {
      const text = describeHeroSmsPreviewPayload(payload).replace(/^ACCESS_BALANCE:/i, '').trim();
      displayPhoneSmsBalance.textContent = `HeroSMS 余额 ${text || '未知'}`;
    }
  } catch (error) {
    displayPhoneSmsBalance.textContent = `余额查询失败：${normalizeHeroSmsFetchErrorMessage(error)}`;
  }
}

function getSelectedLocalCpaStep9Mode() {
  const activeButton = localCpaStep9ModeButtons.find((button) => button.classList.contains('is-active'));
  return normalizeLocalCpaStep9Mode(activeButton?.dataset.localCpaStep9Mode);
}

function setLocalCpaStep9Mode(mode) {
  const resolvedMode = normalizeLocalCpaStep9Mode(mode);
  localCpaStep9ModeButtons.forEach((button) => {
    const active = button.dataset.localCpaStep9Mode === resolvedMode;
    button.classList.toggle('is-active', active);
    button.setAttribute('aria-pressed', String(active));
  });
}

function getSelectedMail2925Mode() {
  const activeButton = mail2925ModeButtons.find((button) => button.classList.contains('is-active'));
  return normalizeMail2925Mode(activeButton?.dataset.mail2925Mode);
}

function setMail2925Mode(mode) {
  const resolvedMode = normalizeMail2925Mode(mode);
  mail2925ModeButtons.forEach((button) => {
    const active = button.dataset.mail2925Mode === resolvedMode;
    button.classList.toggle('is-active', active);
    button.setAttribute('aria-pressed', String(active));
  });
}

function getSelectedHotmailServiceMode() {
  const activeButton = hotmailServiceModeButtons.find((button) => button.classList.contains('is-active'));
  return normalizeHotmailServiceMode(activeButton?.dataset.hotmailServiceMode);
}

function setHotmailServiceMode(mode) {
  const resolvedMode = normalizeHotmailServiceMode(mode);
  hotmailServiceModeButtons.forEach((button) => {
    const active = button.dataset.hotmailServiceMode === resolvedMode;
    button.disabled = false;
    button.setAttribute('aria-disabled', 'false');
    button.classList.toggle('is-active', active);
    button.setAttribute('aria-pressed', String(active));
  });
}

function updateAccountRunHistorySettingsUI() {
  if (!rowAccountRunHistoryHelperBaseUrl) {
    return;
  }

  rowAccountRunHistoryHelperBaseUrl.style.display = 'none';
}

function normalizeSignupMethod(value = '') {
  return String(value || '').trim().toLowerCase() === 'phone'
    ? 'phone'
    : 'email';
}

function normalizePanelMode(value = '') {
  const normalized = String(value || '').trim().toLowerCase();
  if (normalized === 'sub2api' || normalized === 'codex2api') {
    return normalized;
  }
  return 'cpa';
}

function getSelectedPanelMode() {
  const selectedValue = typeof selectPanelMode !== 'undefined' && selectPanelMode
    ? selectPanelMode.value
    : (typeof latestState !== 'undefined' ? latestState?.panelMode : '');
  return normalizePanelMode(selectedValue || 'cpa');
}

function getSelectedSignupMethod() {
  const activeButton = signupMethodButtons.find((button) => button.classList.contains('is-active'));
  return normalizeSignupMethod(activeButton?.dataset.signupMethod || latestState?.signupMethod || DEFAULT_SIGNUP_METHOD);
}

function setSignupMethod(method) {
  const resolvedMethod = normalizeSignupMethod(method);
  signupMethodButtons.forEach((button) => {
    const active = normalizeSignupMethod(button.dataset.signupMethod) === resolvedMethod;
    button.classList.toggle('is-active', active);
    button.setAttribute('aria-pressed', String(active));
  });
  syncLatestState({ signupMethod: resolvedMethod });
  return resolvedMethod;
}

function canSelectPhoneSignupMethod() {
  const phoneEnabled = Boolean(inputPhoneVerificationEnabled?.checked);
  const plusModeEnabled = typeof inputPlusModeEnabled !== 'undefined' && inputPlusModeEnabled
    ? Boolean(inputPlusModeEnabled.checked)
    : Boolean(latestState?.plusModeEnabled);
  const contributionModeEnabled = Boolean(latestState?.contributionMode);
  return phoneEnabled && !plusModeEnabled && !contributionModeEnabled;
}

function isSignupMethodSwitchLocked() {
  return isAutoRunLockedPhase() || isAutoRunPausedPhase() || isAutoRunScheduledPhase();
}

function updateSignupMethodUI(options = {}) {
  if (!signupMethodButtons.length) {
    if (typeof syncSignupPhoneInputFromState === 'function') {
      syncSignupPhoneInputFromState(latestState);
    }
    return;
  }

  const showSignupMethod = Boolean(inputPhoneVerificationEnabled?.checked);
  if (rowSignupMethod) {
    rowSignupMethod.style.display = showSignupMethod ? '' : 'none';
  }

  let selectedMethod = normalizeSignupMethod(getSelectedSignupMethod());
  const phoneSelectable = canSelectPhoneSignupMethod();
  if (!phoneSelectable && selectedMethod === SIGNUP_METHOD_PHONE) {
    selectedMethod = setSignupMethod(SIGNUP_METHOD_EMAIL);
    if (options.notify && typeof showToast === 'function') {
      showToast('已切回邮箱注册', 'info', 1600);
    }
  } else {
    setSignupMethod(selectedMethod);
  }

  const locked = isSignupMethodSwitchLocked();
  signupMethodButtons.forEach((button) => {
    const method = normalizeSignupMethod(button.dataset.signupMethod);
    const disabled = locked || (method === SIGNUP_METHOD_PHONE && !phoneSelectable);
    button.disabled = disabled;
    button.setAttribute('aria-disabled', String(disabled));
    if (method === SIGNUP_METHOD_PHONE) {
      if (!Boolean(inputPhoneVerificationEnabled?.checked)) {
        button.title = '开启接码后可选择手机号注册';
      } else if (typeof inputPlusModeEnabled !== 'undefined' && inputPlusModeEnabled?.checked) {
        button.title = 'Plus 模式第一版暂不支持手机号注册';
      } else if (latestState?.contributionMode) {
        button.title = '贡献模式第一版暂不支持手机号注册';
      } else if (locked) {
        button.title = '自动流程运行中不能切换注册方式';
      } else {
        button.title = '';
      }
    }
  });
  syncStepDefinitionsForMode(
    typeof inputPlusModeEnabled !== 'undefined' && inputPlusModeEnabled
      ? Boolean(inputPlusModeEnabled.checked)
      : Boolean(latestState?.plusModeEnabled),
    {
      plusPaymentMethod: getSelectedPlusPaymentMethod(latestState),
      signupMethod: selectedMethod,
    }
  );
  if (typeof syncSignupPhoneInputFromState === 'function') {
    syncSignupPhoneInputFromState(latestState);
  }
}

function updatePhoneVerificationSettingsUI() {
  const enabled = Boolean(inputPhoneVerificationEnabled?.checked);
  const showSettings = enabled && phoneVerificationSectionExpanded;
  const normalizeProvider = typeof normalizePhoneSmsProviderValue === 'function'
    ? normalizePhoneSmsProviderValue
    : ((value = '') => {
      const normalized = String(value || '').trim().toLowerCase();
      if (normalized === '5sim') return '5sim';
      if (normalized === 'nexsms') return 'nexsms';
      return 'hero-sms';
    });
  const heroProviderValue = typeof PHONE_SMS_PROVIDER_HERO !== 'undefined' ? PHONE_SMS_PROVIDER_HERO : 'hero-sms';
  const fiveSimProviderValue = typeof PHONE_SMS_PROVIDER_FIVE_SIM !== 'undefined' ? PHONE_SMS_PROVIDER_FIVE_SIM : '5sim';
  const nexSmsProviderValue = typeof PHONE_SMS_PROVIDER_NEXSMS !== 'undefined' ? PHONE_SMS_PROVIDER_NEXSMS : 'nexsms';
  const providerOrderForDisplay = resolveNormalizedProviderOrderForRuntime(latestState || {});
  const provider = providerOrderForDisplay[0] || (
    typeof getSelectedPhoneSmsProvider === 'function'
      ? getSelectedPhoneSmsProvider()
      : normalizeProvider(selectPhoneSmsProvider?.value || latestState?.phoneSmsProvider || heroProviderValue)
  );
  const heroProvider = provider === heroProviderValue;
  const fiveSimProvider = provider === fiveSimProviderValue;
  const nexSmsProvider = provider === nexSmsProviderValue;
  if (rowPhoneVerificationEnabled) {
    rowPhoneVerificationEnabled.style.display = '';
  }
  if (rowHeroSmsPlatform) {
    rowHeroSmsPlatform.style.display = '';
  }
  updateSignupMethodUI();
  if (btnTogglePhoneVerificationSection) {
    btnTogglePhoneVerificationSection.disabled = !enabled;
    btnTogglePhoneVerificationSection.textContent = showSettings ? '收起设置' : '展开设置';
    btnTogglePhoneVerificationSection.title = enabled
      ? (showSettings ? '收起接码设置' : '展开接码设置')
      : '开启接码后可展开设置';
    btnTogglePhoneVerificationSection.setAttribute('aria-expanded', String(showSettings));
  }
  if (rowPhoneVerificationFold) {
    rowPhoneVerificationFold.style.display = showSettings ? '' : 'none';
  }

  const phoneVerificationRows = [
    typeof rowPhoneSmsProvider !== 'undefined' ? rowPhoneSmsProvider : null,
    typeof rowPhoneSmsProviderOrder !== 'undefined' ? rowPhoneSmsProviderOrder : null,
    typeof rowPhoneSmsProviderOrderActions !== 'undefined' ? rowPhoneSmsProviderOrderActions : null,
    typeof rowHeroSmsCountry !== 'undefined' ? rowHeroSmsCountry : null,
    typeof rowHeroSmsCountryFallback !== 'undefined' ? rowHeroSmsCountryFallback : null,
    typeof rowHeroSmsAcquirePriority !== 'undefined' ? rowHeroSmsAcquirePriority : null,
    typeof rowHeroSmsApiKey !== 'undefined' ? rowHeroSmsApiKey : null,
    typeof rowFiveSimApiKey !== 'undefined' ? rowFiveSimApiKey : null,
    typeof rowFiveSimCountry !== 'undefined' ? rowFiveSimCountry : null,
    typeof rowFiveSimCountryFallback !== 'undefined' ? rowFiveSimCountryFallback : null,
    typeof rowFiveSimProduct !== 'undefined' ? rowFiveSimProduct : null,
    typeof rowNexSmsApiKey !== 'undefined' ? rowNexSmsApiKey : null,
    typeof rowNexSmsCountry !== 'undefined' ? rowNexSmsCountry : null,
    typeof rowNexSmsCountryFallback !== 'undefined' ? rowNexSmsCountryFallback : null,
    typeof rowNexSmsServiceCode !== 'undefined' ? rowNexSmsServiceCode : null,
    typeof rowHeroSmsMaxPrice !== 'undefined' ? rowHeroSmsMaxPrice : null,
    typeof rowFiveSimOperator !== 'undefined' ? rowFiveSimOperator : null,
    typeof rowPhoneCodeSettingsGroup !== 'undefined' ? rowPhoneCodeSettingsGroup : null,
    typeof rowPhoneVerificationResendCount !== 'undefined' ? rowPhoneVerificationResendCount : null,
    typeof rowPhoneReplacementLimit !== 'undefined' ? rowPhoneReplacementLimit : null,
    typeof rowPhoneCodeWaitSeconds !== 'undefined' ? rowPhoneCodeWaitSeconds : null,
    typeof rowPhoneCodeTimeoutWindows !== 'undefined' ? rowPhoneCodeTimeoutWindows : null,
    typeof rowPhoneCodePollIntervalSeconds !== 'undefined' ? rowPhoneCodePollIntervalSeconds : null,
    typeof rowPhoneCodePollMaxRounds !== 'undefined' ? rowPhoneCodePollMaxRounds : null,
    typeof rowFreePhoneReuseEnabled !== 'undefined' ? rowFreePhoneReuseEnabled : null,
    typeof rowFreePhoneReuseAutoEnabled !== 'undefined' ? rowFreePhoneReuseAutoEnabled : null,
  ];
  phoneVerificationRows.forEach((row) => {
    if (row) {
      row.style.display = showSettings ? '' : 'none';
    }
  });
  if (rowHeroSmsCountry) rowHeroSmsCountry.style.display = showSettings && heroProvider ? '' : 'none';
  if (rowHeroSmsCountryFallback) rowHeroSmsCountryFallback.style.display = showSettings && heroProvider ? '' : 'none';
  if (rowHeroSmsAcquirePriority) rowHeroSmsAcquirePriority.style.display = showSettings && heroProvider ? '' : 'none';
  if (rowHeroSmsApiKey) rowHeroSmsApiKey.style.display = showSettings && heroProvider ? '' : 'none';
  if (rowFiveSimApiKey) rowFiveSimApiKey.style.display = showSettings && fiveSimProvider ? '' : 'none';
  if (rowFiveSimCountry) rowFiveSimCountry.style.display = showSettings && fiveSimProvider ? '' : 'none';
  if (rowFiveSimCountryFallback) rowFiveSimCountryFallback.style.display = showSettings && fiveSimProvider ? '' : 'none';
  if (rowFiveSimOperator) rowFiveSimOperator.style.display = showSettings && fiveSimProvider ? '' : 'none';
  if (rowFiveSimProduct) rowFiveSimProduct.style.display = showSettings && fiveSimProvider ? '' : 'none';
  if (rowNexSmsApiKey) rowNexSmsApiKey.style.display = showSettings && nexSmsProvider ? '' : 'none';
  if (rowNexSmsCountry) rowNexSmsCountry.style.display = showSettings && nexSmsProvider ? '' : 'none';
  if (rowNexSmsCountryFallback) rowNexSmsCountryFallback.style.display = showSettings && nexSmsProvider ? '' : 'none';
  if (rowNexSmsServiceCode) rowNexSmsServiceCode.style.display = showSettings && nexSmsProvider ? '' : 'none';
  if (rowFiveSimOperator) {
    rowFiveSimOperator.style.display = showSettings && fiveSimProvider ? '' : 'none';
  }
  if (typeof rowFreePhoneReuseEnabled !== 'undefined' && rowFreePhoneReuseEnabled) {
    rowFreePhoneReuseEnabled.style.display = showSettings ? '' : 'none';
  }
  if (typeof rowFreePhoneReuseAutoEnabled !== 'undefined' && rowFreePhoneReuseAutoEnabled) {
    rowFreePhoneReuseAutoEnabled.style.display = showSettings ? '' : 'none';
  }
  const freePhoneReuseEnabled = Boolean(
    typeof inputFreePhoneReuseEnabled !== 'undefined' && inputFreePhoneReuseEnabled?.checked
  );
  const freePhoneReuseAutoAvailable = showSettings && freePhoneReuseEnabled;
  if (typeof inputFreePhoneReuseAutoEnabled !== 'undefined' && inputFreePhoneReuseAutoEnabled) {
    inputFreePhoneReuseAutoEnabled.disabled = !freePhoneReuseAutoAvailable;
    if (!freePhoneReuseAutoAvailable) {
      inputFreePhoneReuseAutoEnabled.checked = false;
    }
  }
  setFreePhoneReuseControlsLocked(isAutoRunLockedPhase() || isAutoRunScheduledPhase());
  if (typeof rowFreePhoneReuseAutoEnabled !== 'undefined' && rowFreePhoneReuseAutoEnabled) {
    rowFreePhoneReuseAutoEnabled.classList.toggle('is-disabled', !freePhoneReuseAutoAvailable);
  }
  const runtimeVisible = enabled;
  [
    typeof rowHeroSmsRuntimePair !== 'undefined' ? rowHeroSmsRuntimePair : null,
    typeof rowHeroSmsCurrentNumber !== 'undefined' ? rowHeroSmsCurrentNumber : null,
    typeof rowHeroSmsCurrentCountdown !== 'undefined' ? rowHeroSmsCurrentCountdown : null,
    typeof rowHeroSmsCurrentCode !== 'undefined' ? rowHeroSmsCurrentCode : null,
    typeof rowFreeReusablePhone !== 'undefined' ? rowFreeReusablePhone : null,
    typeof rowHeroSmsPreferredActivation !== 'undefined' ? rowHeroSmsPreferredActivation : null,
  ].forEach((row) => {
    if (row) {
      row.style.display = runtimeVisible ? '' : 'none';
    }
  });
  if (typeof syncSignupPhoneInputFromState === 'function') {
    syncSignupPhoneInputFromState(latestState);
  }
  if (!showSettings && typeof rowHeroSmsPriceTiers !== 'undefined' && rowHeroSmsPriceTiers) {
    rowHeroSmsPriceTiers.style.display = 'none';
  }
  updateHeroSmsPlatformDisplay();
}

function updatePlusModeUI() {
  const paypalValue = typeof PLUS_PAYMENT_METHOD_PAYPAL !== 'undefined' ? PLUS_PAYMENT_METHOD_PAYPAL : 'paypal';
  const gopayValue = typeof PLUS_PAYMENT_METHOD_GOPAY !== 'undefined' ? PLUS_PAYMENT_METHOD_GOPAY : 'gopay';
  const gpcValue = typeof PLUS_PAYMENT_METHOD_GPC_HELPER !== 'undefined' ? PLUS_PAYMENT_METHOD_GPC_HELPER : 'gpc-helper';
  const defaultMethod = typeof DEFAULT_PLUS_PAYMENT_METHOD !== 'undefined' ? DEFAULT_PLUS_PAYMENT_METHOD : paypalValue;
  const enabled = typeof inputPlusModeEnabled !== 'undefined' && inputPlusModeEnabled
    ? Boolean(inputPlusModeEnabled.checked)
    : false;
  const method = enabled ? getSelectedPlusPaymentMethod() : defaultMethod;
  const gpcPhoneMode = normalizeGpcHelperPhoneModeValue(
    typeof selectGpcHelperPhoneMode !== 'undefined' && selectGpcHelperPhoneMode
      ? selectGpcHelperPhoneMode.value
      : (latestState?.gopayHelperPhoneMode || 'manual')
  );
  const gpcAutoModeDenied = isGpcAutoModePermissionDenied(latestState);
  const gpcAutoModeEnabled = getGpcHelperAutoModeEnabled(latestState);
  const isGpcAutoMode = !gpcAutoModeDenied && gpcPhoneMode === GPC_HELPER_PHONE_MODE_AUTO;
  const gpcOtpChannel = normalizeGpcOtpChannelValue(
    typeof selectGpcHelperOtpChannel !== 'undefined' && selectGpcHelperOtpChannel
      ? selectGpcHelperOtpChannel.value
      : (latestState?.gopayHelperOtpChannel || 'whatsapp')
  );
  const localSmsEnabled = Boolean(
    typeof inputGpcHelperLocalSmsEnabled !== 'undefined' && inputGpcHelperLocalSmsEnabled
      ? inputGpcHelperLocalSmsEnabled.checked
      : latestState?.gopayHelperLocalSmsHelperEnabled
  );
  const selectedMethod = typeof selectPlusPaymentMethod !== 'undefined' && selectPlusPaymentMethod?.value
    ? normalizePlusPaymentMethod(selectPlusPaymentMethod.value)
    : method;
  const gpcRowsVisible = enabled && selectedMethod === gpcValue;
  const canShowGpcModeSelector = gpcRowsVisible && (gpcAutoModeEnabled || !gpcAutoModeDenied);
  const localSmsControlsVisible = gpcRowsVisible && !isGpcAutoMode;
  const effectiveLocalSmsEnabled = !isGpcAutoMode && localSmsEnabled;
  if (typeof selectPlusPaymentMethod !== 'undefined' && selectPlusPaymentMethod) {
    selectPlusPaymentMethod.value = method;
    if (selectPlusPaymentMethod.style) {
      selectPlusPaymentMethod.style.display = enabled ? '' : 'none';
    }
  }
  if (typeof plusPaymentMethodCaption !== 'undefined' && plusPaymentMethodCaption) {
    plusPaymentMethodCaption.textContent = method === gpcValue
      ? `GPC ${isGpcAutoMode ? '自动' : '手动'}订阅链路`
      : method === gopayValue
      ? 'GoPay 印尼订阅链路'
      : 'PayPal 订阅链路';
  }
  [
    typeof rowPlusPaymentMethod !== 'undefined' ? rowPlusPaymentMethod : null,
  ].forEach((row) => {
    if (!row) {
      return;
    }
    row.style.display = enabled ? '' : 'none';
  });
  [
    typeof rowPayPalAccount !== 'undefined' ? rowPayPalAccount : null,
  ].forEach((row) => {
    if (!row) {
      return;
    }
    row.style.display = enabled && selectedMethod === paypalValue ? '' : 'none';
  });
  [
    typeof rowGpcHelperApi !== 'undefined' ? rowGpcHelperApi : null,
    typeof rowGpcHelperCardKey !== 'undefined' ? rowGpcHelperCardKey : null,
  ].forEach((row) => {
    if (!row) {
      return;
    }
    row.style.display = gpcRowsVisible ? '' : 'none';
  });
  if (typeof rowGpcHelperPhoneMode !== 'undefined' && rowGpcHelperPhoneMode) {
    rowGpcHelperPhoneMode.style.display = canShowGpcModeSelector ? '' : 'none';
  }
  if (typeof selectGpcHelperPhoneMode !== 'undefined' && selectGpcHelperPhoneMode) {
    selectGpcHelperPhoneMode.value = gpcAutoModeDenied ? GPC_HELPER_PHONE_MODE_MANUAL : gpcPhoneMode;
  }
  [
    typeof rowGpcHelperCountryCode !== 'undefined' ? rowGpcHelperCountryCode : null,
    typeof rowGpcHelperPhone !== 'undefined' ? rowGpcHelperPhone : null,
    typeof rowGpcHelperOtpChannel !== 'undefined' ? rowGpcHelperOtpChannel : null,
    typeof rowGpcHelperPin !== 'undefined' ? rowGpcHelperPin : null,
  ].forEach((row) => {
    if (!row) {
      return;
    }
    row.style.display = gpcRowsVisible && !isGpcAutoMode ? '' : 'none';
  });
  if (typeof selectGpcHelperOtpChannel !== 'undefined' && selectGpcHelperOtpChannel) {
    selectGpcHelperOtpChannel.value = gpcOtpChannel;
  }
  if (typeof inputGpcHelperLocalSmsEnabled !== 'undefined' && inputGpcHelperLocalSmsEnabled) {
    inputGpcHelperLocalSmsEnabled.checked = effectiveLocalSmsEnabled;
  }
  if (typeof rowGpcHelperLocalSmsEnabled !== 'undefined' && rowGpcHelperLocalSmsEnabled) {
    rowGpcHelperLocalSmsEnabled.style.display = localSmsControlsVisible ? '' : 'none';
  }
  if (typeof rowGpcHelperLocalSmsUrl !== 'undefined' && rowGpcHelperLocalSmsUrl) {
    rowGpcHelperLocalSmsUrl.style.display = localSmsControlsVisible && effectiveLocalSmsEnabled ? '' : 'none';
  }
  if (typeof btnGpcCardKeyPurchase !== 'undefined' && btnGpcCardKeyPurchase) {
    btnGpcCardKeyPurchase.style.display = gpcRowsVisible ? '' : 'none';
  }
  [
    typeof rowGoPayCountryCode !== 'undefined' ? rowGoPayCountryCode : null,
    typeof rowGoPayPhone !== 'undefined' ? rowGoPayPhone : null,
    typeof rowGoPayOtp !== 'undefined' ? rowGoPayOtp : null,
    typeof rowGoPayPin !== 'undefined' ? rowGoPayPin : null,
  ].forEach((row) => {
    if (!row) {
      return;
    }
    row.style.display = enabled && selectedMethod === gopayValue ? '' : 'none';
  });
}

function setSettingsCardLocked(locked) {
  if (!settingsCard) {
    return;
  }
  settingsCard.classList.toggle('is-locked', locked);
  settingsCard.toggleAttribute('inert', false);
  Array.from(settingsCard.children).forEach((child) => {
    const keepInteractive = child?.id === 'row-custom-email-pool';
    child.toggleAttribute('inert', Boolean(locked && !keepInteractive));
  });
}

function setFreePhoneReuseControlsLocked(locked) {
  if (inputFreePhoneReuseEnabled) {
    inputFreePhoneReuseEnabled.disabled = locked;
  }
  if (inputFreePhoneReuseAutoEnabled) {
    inputFreePhoneReuseAutoEnabled.disabled = locked
      || !Boolean(inputFreePhoneReuseEnabled?.checked)
      || !Boolean(inputPhoneVerificationEnabled?.checked && phoneVerificationSectionExpanded);
  }
}

async function setRuntimeEmailState(email) {
  const normalizedEmail = String(email || '').trim() || null;
  const response = await chrome.runtime.sendMessage({
    type: 'SET_EMAIL_STATE',
    source: 'sidepanel',
    payload: { email: normalizedEmail },
  });

  if (response?.error) {
    throw new Error(response.error);
  }

  return normalizedEmail;
}

function getRuntimeSignupPhoneValue(state = latestState) {
  const identifierType = String(state?.accountIdentifierType || '').trim().toLowerCase();
  return String(
    state?.signupPhoneNumber
    || (identifierType === 'phone' ? state?.accountIdentifier : '')
    || ''
  ).trim();
}

function shouldExecuteStep3WithSignupPhoneIdentity(state = latestState) {
  const identifierType = String(state?.accountIdentifierType || '').trim().toLowerCase();
  const resolvedMethod = normalizeSignupMethod(
    state?.resolvedSignupMethod
    || state?.signupMethod
    || (typeof getSelectedSignupMethod === 'function' ? getSelectedSignupMethod() : DEFAULT_SIGNUP_METHOD)
  );
  return identifierType === 'phone'
    || Boolean(getRuntimeSignupPhoneValue(state))
    || resolvedMethod === SIGNUP_METHOD_PHONE;
}

function getSignupPhoneInputValue() {
  return typeof inputSignupPhone !== 'undefined' && inputSignupPhone
    ? String(inputSignupPhone.value || '').trim()
    : '';
}

function shouldPreserveSignupPhoneInputValue(stateSignupPhone = '') {
  if (typeof inputSignupPhone === 'undefined' || !inputSignupPhone || !signupPhoneInputDirty) {
    return false;
  }
  if (getSignupPhoneInputValue() === String(stateSignupPhone || '').trim()) {
    signupPhoneInputDirty = false;
    return false;
  }
  return signupPhoneInputFocused || (typeof document !== 'undefined' && document.activeElement === inputSignupPhone);
}

function syncSignupPhoneInputFromState(state = latestState) {
  const signupPhone = getRuntimeSignupPhoneValue(state);
  if (typeof inputSignupPhone !== 'undefined' && inputSignupPhone) {
    if (!shouldPreserveSignupPhoneInputValue(signupPhone)) {
      inputSignupPhone.value = signupPhone;
    }
  }
  if (typeof rowSignupPhone !== 'undefined' && rowSignupPhone) {
    const phoneVerificationEnabled = typeof inputPhoneVerificationEnabled !== 'undefined' && inputPhoneVerificationEnabled
      ? Boolean(inputPhoneVerificationEnabled.checked)
      : Boolean(state?.phoneVerificationEnabled || latestState?.phoneVerificationEnabled);
    const rawSignupMethod = state?.signupMethod || (
      typeof getSelectedSignupMethod === 'function'
        ? getSelectedSignupMethod()
        : 'email'
    );
    const selectedMethod = typeof normalizeSignupMethod === 'function'
      ? normalizeSignupMethod(rawSignupMethod)
      : (String(rawSignupMethod || '').trim().toLowerCase() === 'phone' ? 'phone' : 'email');
    rowSignupPhone.style.display = phoneVerificationEnabled
      && (selectedMethod === 'phone' || Boolean(signupPhone) || Boolean(getSignupPhoneInputValue()) || signupPhoneInputDirty)
      ? ''
      : 'none';
  }
}

async function setRuntimeSignupPhoneState(phoneNumber) {
  const normalizedPhone = String(phoneNumber || '').trim() || null;
  const response = await chrome.runtime.sendMessage({
    type: 'SET_SIGNUP_PHONE_STATE',
    source: 'sidepanel',
    payload: { phoneNumber: normalizedPhone },
  });

  if (response?.error) {
    throw new Error(response.error);
  }

  return normalizedPhone;
}

async function persistSignupPhoneInputValue(options = {}) {
  const { final = true, silent = true } = options;
  if (typeof inputSignupPhone === 'undefined' || !inputSignupPhone) {
    return getRuntimeSignupPhoneValue(latestState);
  }
  if (signupPhoneInputPersistPromise) {
    return signupPhoneInputPersistPromise;
  }

  const phoneNumber = getSignupPhoneInputValue();
  inputSignupPhone.value = phoneNumber;
  const currentPhone = getRuntimeSignupPhoneValue(latestState);
  if (!signupPhoneInputDirty && phoneNumber === currentPhone) {
    return phoneNumber;
  }

  signupPhoneInputPersistPromise = (async () => {
    const response = await chrome.runtime.sendMessage({
      type: final ? 'SAVE_SIGNUP_PHONE' : 'SET_SIGNUP_PHONE_STATE',
      source: 'sidepanel',
      payload: { phoneNumber },
    });
    if (response?.error) {
      throw new Error(response.error);
    }

    const normalizedPhone = String(response?.phoneNumber || phoneNumber || '').trim();
    signupPhoneInputDirty = getSignupPhoneInputValue() !== normalizedPhone;
    syncLatestState({
      signupPhoneNumber: normalizedPhone,
      phoneNumber: '',
      ...(normalizedPhone
        ? {
          accountIdentifierType: 'phone',
          accountIdentifier: normalizedPhone,
        }
        : (String(latestState?.accountIdentifierType || '').trim().toLowerCase() === 'phone'
          ? {
            accountIdentifierType: null,
            accountIdentifier: '',
          }
          : {})),
    });
    syncSignupPhoneInputFromState(latestState);
    if (!silent) {
      showToast(normalizedPhone ? '注册手机号已保存。' : '注册手机号已清空。', 'success', 1600);
    }
    return normalizedPhone;
  })();

  try {
    return await signupPhoneInputPersistPromise;
  } finally {
    signupPhoneInputPersistPromise = null;
  }
}

async function persistSignupPhoneInputForAction() {
  if (typeof inputSignupPhone === 'undefined' || !inputSignupPhone) {
    return;
  }
  const phoneNumber = getSignupPhoneInputValue();
  const currentPhone = getRuntimeSignupPhoneValue(latestState);
  if (!signupPhoneInputDirty && phoneNumber === currentPhone) {
    return;
  }
  await persistSignupPhoneInputValue({ final: true, silent: true });
}

function isGpcHelperCheckoutSelected() {
  const gpcValue = typeof PLUS_PAYMENT_METHOD_GPC_HELPER !== 'undefined' ? PLUS_PAYMENT_METHOD_GPC_HELPER : 'gpc-helper';
  const plusEnabled = typeof inputPlusModeEnabled !== 'undefined' && inputPlusModeEnabled
    ? Boolean(inputPlusModeEnabled.checked)
    : Boolean(latestState?.plusModeEnabled);
  return plusEnabled && getSelectedPlusPaymentMethod() === gpcValue;
}

function getSelectedGpcHelperPhoneMode() {
  return normalizeGpcHelperPhoneModeValue(
    typeof selectGpcHelperPhoneMode !== 'undefined' && selectGpcHelperPhoneMode
      ? selectGpcHelperPhoneMode.value
      : (latestState?.gopayHelperPhoneMode || GPC_HELPER_PHONE_MODE_MANUAL)
  );
}

async function showGpcStartBlockedDialog(message) {
  await openConfirmModal({
    title: 'GPC 任务无法开启',
    message,
    confirmLabel: '知道了',
  });
}

async function refreshGpcBalanceForStart() {
  const response = await chrome.runtime.sendMessage({
    type: 'REFRESH_GPC_CARD_BALANCE',
    source: 'sidepanel',
    payload: {
      gopayHelperApiUrl: inputGpcHelperApi?.value || DEFAULT_GPC_HELPER_API_URL,
      gopayHelperApiKey: inputGpcHelperCardKey?.value || latestState?.gopayHelperApiKey || '',
      reason: 'before_start',
    },
  });
  if (response?.error) {
    throw new Error(response.error);
  }
  const nextState = {
    gopayHelperBalance: response?.balance || latestState?.gopayHelperBalance || '',
    gopayHelperBalancePayload: response?.data || response?.payload?.data || response?.payload || latestState?.gopayHelperBalancePayload || null,
    gopayHelperBalanceUpdatedAt: response?.updatedAt || Date.now(),
    gopayHelperBalanceError: '',
    gopayHelperRemainingUses: getGpcBalanceRemainingUsesFromResponse(response) ?? 0,
    gopayHelperAutoModeEnabled: getGpcAutoModeEnabledFromResponse(response),
    gopayHelperApiKeyStatus: response?.apiKeyStatus || response?.data?.status || response?.payload?.data?.status || response?.payload?.status || '',
  };
  syncLatestState(nextState);
  if (displayGpcHelperBalance && nextState.gopayHelperBalance) {
    displayGpcHelperBalance.textContent = nextState.gopayHelperBalance;
  }
  updatePlusModeUI();
  return nextState;
}

async function ensureGpcApiKeyReadyForStart(options = {}) {
  if (!isGpcHelperCheckoutSelected()) {
    return true;
  }
  const selectedMode = getSelectedGpcHelperPhoneMode();
  let balanceState;
  try {
    balanceState = await refreshGpcBalanceForStart();
  } catch (error) {
    await showGpcStartBlockedDialog(`API Key 余额校验失败：${error?.message || '未知错误'}。请先确认 API Key 是否正确。`);
    return false;
  }

  const remainingUses = normalizeGpcRemainingUsesValue(balanceState.gopayHelperRemainingUses);
  const apiKeyStatus = String(balanceState.gopayHelperApiKeyStatus || '').trim().toLowerCase();
  if (apiKeyStatus && apiKeyStatus !== 'active') {
    await showGpcStartBlockedDialog(`当前 GPC API Key 状态为 ${balanceState.gopayHelperApiKeyStatus}，不能开启任务。`);
    return false;
  }
  if (remainingUses !== null && remainingUses <= 0) {
    await showGpcStartBlockedDialog('当前 GPC API Key 剩余次数不足，不能开启任务。');
    return false;
  }

  if (selectedMode === GPC_HELPER_PHONE_MODE_AUTO && !balanceState.gopayHelperAutoModeEnabled) {
    if (typeof selectGpcHelperPhoneMode !== 'undefined' && selectGpcHelperPhoneMode) {
      selectGpcHelperPhoneMode.value = GPC_HELPER_PHONE_MODE_MANUAL;
    }
    syncLatestState({ gopayHelperPhoneMode: GPC_HELPER_PHONE_MODE_MANUAL });
    updatePlusModeUI();
    await saveSettings({ silent: true, force: true }).catch(() => {});
    await showGpcStartBlockedDialog('当前 GPC API Key 未开通自动模式，已切回手动模式，不能以自动模式开启任务。');
    return false;
  }

  if (options?.notify) {
    showToast('GPC API Key 余额和权限校验通过。', 'success', 1800);
  }
  return true;
}

async function openPlusManualConfirmationDialog(options = {}) {
  const method = String(options.method || '').trim().toLowerCase();
  const gopayValue = typeof PLUS_PAYMENT_METHOD_GOPAY !== 'undefined' ? PLUS_PAYMENT_METHOD_GOPAY : 'gopay';
  if (method === 'gopay-otp') {
    if (!sharedFormDialog?.open) {
      return null;
    }
    const result = await sharedFormDialog.open({
      title: String(options.title || '').trim() || 'GPC OTP 验证',
      message: String(options.message || '').trim() || '请在WhatsApp里面获取验证码（耐心等待三十秒左右）',
      fields: [
        {
          key: 'otp',
          label: 'OTP',
          type: 'text',
          placeholder: '请输入 OTP 验证码',
          inputMode: 'numeric',
          autocomplete: 'one-time-code',
          required: true,
          requiredMessage: '请输入 OTP 验证码。',
          normalize: (value) => String(value || '').trim().replace(/[^\d]/g, ''),
          validate: (value) => {
            const normalized = String(value || '').trim().replace(/[^\d]/g, '');
            if (!normalized) return '请输入 OTP 验证码。';
            if (!/^\d{6}$/.test(normalized)) return 'OTP 必须是 6 位数字，请检查。';
            return '';
          },
        },
      ],
      confirmLabel: '提交 OTP',
    });
    return result ? { action: 'confirm', otp: String(result.otp || '').trim().replace(/[^\d]/g, '') } : { action: 'cancel' };
  }
  const title = String(options.title || '').trim() || (method === gopayValue ? 'GoPay 订阅确认' : '手动确认');
  const message = String(options.message || '').trim()
    || (method === gopayValue
      ? '请在当前订阅页中手动完成 GoPay 订阅，完成后点击“我已完成订阅”继续。'
      : '请先在页面中完成当前手动操作，完成后点击确认继续。');
  return openActionModal({
    title,
    message,
    actions: [
      { id: 'cancel', label: '取消等待', variant: 'btn-ghost' },
      { id: 'confirm', label: '我已完成订阅', variant: 'btn-primary' },
    ],
    alert: method === gopayValue
      ? { text: '确认后流程会直接继续到 Plus 模式第 10 步 OAuth 登录。', tone: 'info' }
      : null,
  });
}

async function syncPlusManualConfirmationDialog() {
  const gopayValue = typeof PLUS_PAYMENT_METHOD_GOPAY !== 'undefined' ? PLUS_PAYMENT_METHOD_GOPAY : 'gopay';
  const requestId = String(latestState?.plusManualConfirmationRequestId || '').trim();
  const pending = Boolean(latestState?.plusManualConfirmationPending);
  if (!pending || !requestId || plusManualConfirmationDialogInFlight || activePlusManualConfirmationRequestId === requestId) {
    return;
  }

  const step = Number(latestState?.plusManualConfirmationStep) || 0;
  const method = String(latestState?.plusManualConfirmationMethod || '').trim().toLowerCase();
  const title = latestState?.plusManualConfirmationTitle;
  const message = latestState?.plusManualConfirmationMessage;
  activePlusManualConfirmationRequestId = requestId;
  plusManualConfirmationDialogInFlight = true;
  let shouldReopenDialog = false;

  try {
    const choice = await openPlusManualConfirmationDialog({
      method,
      title,
      message,
    });
    const currentRequestId = String(latestState?.plusManualConfirmationRequestId || '').trim();
    const stillPending = Boolean(latestState?.plusManualConfirmationPending);
    if (!stillPending || currentRequestId !== requestId) {
      return;
    }
    if (choice == null) {
      shouldReopenDialog = true;
      showToast('当前订阅确认仍在等待中，将重新弹出确认窗口。', 'info', 1800);
      return;
    }

    const confirmed = choice === 'confirm' || choice?.action === 'confirm';
    const response = await chrome.runtime.sendMessage({
      type: 'RESOLVE_PLUS_MANUAL_CONFIRMATION',
      source: 'sidepanel',
      payload: {
        step,
        requestId,
        confirmed,
        ...(choice?.otp ? { otp: choice.otp } : {}),
      },
    });
    if (response?.error) {
      throw new Error(response.error);
    }
    if (confirmed) {
      showToast(
        method === 'gopay-otp'
          ? 'GPC OTP 已提交，正在继续验证...'
          : (method === gopayValue ? 'GoPay 订阅已确认，正在继续 OAuth 登录...' : '已确认，流程继续执行中...'),
        'info',
        2200
      );
    } else {
      showToast(
        method === 'gopay-otp'
          ? '已取消 GPC OTP 输入。'
          : (method === gopayValue ? '已取消 GoPay 订阅等待。' : '已取消当前手动确认。'),
        'warn',
        2200
      );
    }
  } catch (error) {
    showToast(error?.message || String(error || '未知错误'), 'error');
  } finally {
    if (activePlusManualConfirmationRequestId === requestId) {
      activePlusManualConfirmationRequestId = '';
    }
    plusManualConfirmationDialogInFlight = false;
    if (
      shouldReopenDialog
      && latestState?.plusManualConfirmationPending
      && String(latestState?.plusManualConfirmationRequestId || '').trim() === requestId
    ) {
      setTimeout(() => {
        void syncPlusManualConfirmationDialog();
      }, 0);
    }
  }
}

async function clearRegistrationEmail(options = {}) {
  const { silent = false } = options;
  if (!inputEmail.value.trim() && !latestState?.email) {
    return;
  }

  inputEmail.value = '';
  syncLatestState({ email: null });

  try {
    await setRuntimeEmailState(null);
  } catch (err) {
    if (!silent) {
      showToast(`清空邮箱失败：${err.message}`, 'error');
    }
    throw err;
  }
}

async function clearRegistrationSignupPhone(options = {}) {
  const { silent = false } = options;
  if (!getRuntimeSignupPhoneValue(latestState)) {
    if (typeof inputSignupPhone !== 'undefined' && inputSignupPhone) {
      inputSignupPhone.value = '';
    }
    signupPhoneInputDirty = false;
    syncSignupPhoneInputFromState(latestState);
    return;
  }

  if (typeof inputSignupPhone !== 'undefined' && inputSignupPhone) {
    inputSignupPhone.value = '';
  }
  signupPhoneInputDirty = false;
  syncLatestState({
    signupPhoneNumber: '',
    ...(String(latestState?.accountIdentifierType || '').trim().toLowerCase() === 'phone'
      ? {
        accountIdentifierType: null,
        accountIdentifier: '',
      }
      : {}),
  });
  syncSignupPhoneInputFromState(latestState);

  try {
    await setRuntimeSignupPhoneState(null);
  } catch (err) {
    if (!silent) {
      showToast(`清空注册手机号失败：${err.message}`, 'error');
    }
    throw err;
  }
}

function markSettingsDirty(isDirty = true) {
  settingsDirty = isDirty;
  if (isDirty) {
    settingsSaveRevision += 1;
  }
  updateSaveButtonState();
}

function updateSaveButtonState() {
  btnSaveSettings.disabled = settingsSaveInFlight || !settingsDirty;
  updateConfigMenuControls();
  btnSaveSettings.textContent = settingsSaveInFlight ? '保存中' : '保存';
}

function scheduleSettingsAutoSave() {
  clearTimeout(settingsAutoSaveTimer);
  settingsAutoSaveTimer = setTimeout(() => {
    saveSettings({ silent: true }).catch(() => { });
  }, 500);
}

async function saveSettings(options = {}) {
  const { silent = false, force = false } = options;
  clearTimeout(settingsAutoSaveTimer);

  if (!force && !settingsDirty && !settingsSaveInFlight && silent) {
    return;
  }

  const payload = collectSettingsPayload();
  const saveRevision = settingsSaveRevision;
  settingsSaveInFlight = true;
  updateSaveButtonState();

  try {
    const response = await chrome.runtime.sendMessage({
      type: 'SAVE_SETTING',
      source: 'sidepanel',
      payload,
    });

    if (response?.error) {
      throw new Error(response.error);
    }

    if (response?.state && saveRevision === settingsSaveRevision) {
      applySettingsState(response.state);
    } else {
      syncLatestState(payload);
      if (saveRevision === settingsSaveRevision) {
        markSettingsDirty(false);
      }
      updatePanelModeUI();
      updateMailProviderUI();
      updateButtonStates();
    }
    if (!silent) {
      showToast('配置已保存', 'success', 1800);
    }
  } catch (err) {
    markSettingsDirty(true);
    if (!silent) {
      showToast(`保存失败：${err.message}`, 'error');
    }
    throw err;
  } finally {
    settingsSaveInFlight = false;
    updateSaveButtonState();
  }
}

async function persistCurrentSettingsForAction() {
  clearTimeout(settingsAutoSaveTimer);
  await waitForSettingsSaveIdle();
  await persistSignupPhoneInputForAction();
  await saveSettings({ silent: true, force: true });
}

function applyAutoRunStatus(payload = currentAutoRun) {
  syncAutoRunState(payload);
  const runLabel = getAutoRunLabel(currentAutoRun);
  const locked = isAutoRunLockedPhase();
  const paused = isAutoRunPausedPhase();
  const scheduled = isAutoRunScheduledPhase();
  const settingsCardLocked = scheduled || locked;

  setSettingsCardLocked(settingsCardLocked);
  setFreePhoneReuseControlsLocked(settingsCardLocked);

  inputRunCount.disabled = currentAutoRun.autoRunning || (
    typeof shouldLockRunCountToEmailPool === 'function'
      ? shouldLockRunCountToEmailPool()
      : getLockedRunCountFromEmailPool() > 0
  );
  btnAutoRun.disabled = currentAutoRun.autoRunning;
  btnFetchEmail.disabled = locked
    || isCustomMailProvider()
    || usesCustomEmailPoolGenerator();
  inputEmail.disabled = locked;
  if (typeof inputSignupPhone !== 'undefined' && inputSignupPhone) {
    inputSignupPhone.disabled = locked;
  }
  if (typeof inputSub2ApiAccountPriority !== 'undefined' && inputSub2ApiAccountPriority) {
    inputSub2ApiAccountPriority.disabled = locked;
  }
  inputAutoSkipFailures.disabled = scheduled;

  const lockedRunCount = typeof getLockedRunCountFromEmailPool === 'function'
    ? getLockedRunCountFromEmailPool()
    : 0;
  const isSyncPhase = typeof isAutoRunSourceSyncPhase === 'function'
    ? isAutoRunSourceSyncPhase
    : (phase) => ['scheduled', 'running', 'waiting_step', 'waiting_email', 'retrying', 'waiting_interval'].includes(phase);
  const shouldSyncRunCount = typeof shouldSyncRunCountFromAutoRunSource === 'function'
    ? shouldSyncRunCountFromAutoRunSource(currentAutoRun)
    : (currentAutoRun.autoRunning || isSyncPhase(currentAutoRun.phase));
  if (lockedRunCount > 0) {
    inputRunCount.value = String(lockedRunCount);
  } else if (shouldSyncRunCount && currentAutoRun.totalRuns > 0) {
    inputRunCount.value = String(currentAutoRun.totalRuns);
  }

  switch (currentAutoRun.phase) {
    case 'scheduled':
      autoContinueBar.style.display = 'none';
      btnAutoRun.innerHTML = `已计划${runLabel}`;
      break;
    case 'waiting_step':
      autoContinueBar.style.display = 'none';
      btnAutoRun.innerHTML = `等待中${runLabel}`;
      break;
    case 'waiting_email':
      autoContinueBar.style.display = 'flex';
      btnAutoRun.innerHTML = `已暂停${runLabel}`;
      break;
    case 'running':
      autoContinueBar.style.display = 'none';
      btnAutoRun.innerHTML = `运行中${runLabel}`;
      break;
    case 'retrying':
      autoContinueBar.style.display = 'none';
      btnAutoRun.innerHTML = `重试中${runLabel}`;
      break;
    case 'waiting_interval':
      autoContinueBar.style.display = 'none';
      btnAutoRun.innerHTML = `等待中${runLabel}`;
      break;
    default:
      autoContinueBar.style.display = 'none';
      setDefaultAutoRunButton();
      inputEmail.disabled = false;
      if (!locked) {
        btnFetchEmail.disabled = isCustomMailProvider() || usesCustomEmailPoolGenerator();
      }
      break;
  }

  updateAutoDelayInputState();
  updateFallbackThreadIntervalInputState();
  syncScheduledCountdownTicker();
  updateStopButtonState(scheduled || paused || locked || Object.values(getStepStatuses()).some(status => status === 'running'));
  updateConfigMenuControls();
  renderContributionMode();
}

function initializeManualStepActions() {
  document.querySelectorAll('.step-row').forEach((row) => {
    if (row.querySelector('.step-actions')) {
      return;
    }
    const step = Number(row.dataset.step);
    const statusEl = row.querySelector('.step-status');
    if (!statusEl) return;

    const actions = document.createElement('div');
    actions.className = 'step-actions';

    const manualBtn = document.createElement('button');
    manualBtn.type = 'button';
    manualBtn.className = 'step-manual-btn';
    manualBtn.dataset.step = String(step);
    manualBtn.title = '跳过此步';
    manualBtn.setAttribute('aria-label', `跳过步骤 ${step}`);
    manualBtn.innerHTML = '<svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><polyline points="13 17 18 12 13 7"/><polyline points="6 17 11 12 6 7"/></svg>';
    manualBtn.addEventListener('click', async (event) => {
      event.stopPropagation();
      try {
        await handleSkipStep(step);
      } catch (err) {
        showToast(err.message, 'error');
      }
    });

    statusEl.parentNode.replaceChild(actions, statusEl);
    actions.appendChild(manualBtn);
    actions.appendChild(statusEl);
  });
}

function renderStepsList() {
  if (!stepsList) return;

  stepsList.innerHTML = stepDefinitions.map((step) => `
    <div class="step-row" data-step="${step.id}" data-step-key="${escapeHtml(step.key)}">
      <div class="step-indicator" data-step="${step.id}"><span class="step-num">${step.id}</span></div>
      <button class="step-btn" data-step="${step.id}" data-step-key="${escapeHtml(step.key)}">${escapeHtml(step.title)}</button>
      <span class="step-status" data-step="${step.id}"></span>
    </div>
  `).join('');

  if (stepsProgress) {
    stepsProgress.textContent = `0 / ${STEP_IDS.length}`;
  }

  initializeManualStepActions();
  renderStepStatuses();
  updateButtonStates();
}

function syncStepDefinitionsForMode(plusModeEnabled = false, plusPaymentMethodOrOptions = {}, maybeOptions = {}) {
  const nextPlusModeEnabled = Boolean(plusModeEnabled);
  const options = typeof plusPaymentMethodOrOptions === 'string'
    ? maybeOptions
    : (plusPaymentMethodOrOptions || {});
  const rawPaymentMethod = typeof plusPaymentMethodOrOptions === 'string'
    ? plusPaymentMethodOrOptions
    : (options.plusPaymentMethod || getSelectedPlusPaymentMethod(latestState));
  const nextSignupMethod = normalizeSignupMethod(options.signupMethod || currentSignupMethod || DEFAULT_SIGNUP_METHOD);
  const nextPaymentMethod = normalizePlusPaymentMethod(rawPaymentMethod);
  const rootScope = typeof window !== 'undefined' ? window : globalThis;
  const currentPaymentStep = stepDefinitions.find((step) => step.key === 'paypal-approve');
  const nextPaymentTitle = rootScope.MultiPageStepDefinitions?.getPlusPaymentStepTitle?.({
    plusModeEnabled: nextPlusModeEnabled,
    plusPaymentMethod: nextPaymentMethod,
    signupMethod: nextSignupMethod,
  });
  const paymentTitleChanged = Boolean(nextPlusModeEnabled && currentPaymentStep && nextPaymentTitle && currentPaymentStep.title !== nextPaymentTitle);
  const shouldRender = Boolean(options.render)
    || nextPlusModeEnabled !== currentPlusModeEnabled
    || nextPaymentMethod !== currentPlusPaymentMethod
    || nextSignupMethod !== currentSignupMethod
    || paymentTitleChanged;
  if (!shouldRender) {
    return;
  }

  rebuildStepDefinitionState(nextPlusModeEnabled, {
    plusPaymentMethod: nextPaymentMethod,
    signupMethod: nextSignupMethod,
  });
  renderStepsList();
}

// ============================================================
// State Restore on load
// ============================================================

function applySettingsState(state) {
  if (typeof syncStepDefinitionsForMode === 'function') {
    syncStepDefinitionsForMode(Boolean(state?.plusModeEnabled), {
      plusPaymentMethod: state?.plusPaymentMethod,
      signupMethod: state?.signupMethod,
    });
  }
  const fallbackIpProxyService = '711proxy';
  const fallbackIpProxyMode = 'account';
  const fallbackIpProxyProtocol = 'http';
  const resolveIpProxyService = (value) => (typeof normalizeIpProxyService === 'function'
    ? normalizeIpProxyService(value)
    : String(value || fallbackIpProxyService).trim().toLowerCase() || fallbackIpProxyService);
  const resolveIpProxyMode = (value) => {
    if (typeof normalizeIpProxyModeForCurrentRelease === 'function') {
      return normalizeIpProxyModeForCurrentRelease(value);
    }
    if (typeof normalizeIpProxyMode === 'function') {
      return normalizeIpProxyMode(value);
    }
    const normalized = String(value || fallbackIpProxyMode).trim().toLowerCase();
    return normalized || fallbackIpProxyMode;
  };
  const resolveIpProxyProtocol = (value) => (typeof normalizeIpProxyProtocol === 'function'
    ? normalizeIpProxyProtocol(value)
    : String(value || fallbackIpProxyProtocol).trim().toLowerCase() || fallbackIpProxyProtocol);
  const resolveIpProxyPort = (value) => {
    if (typeof normalizeIpProxyPort === 'function') {
      return normalizeIpProxyPort(value);
    }
    const numeric = Number.parseInt(String(value || '').trim(), 10);
    return Number.isInteger(numeric) && numeric > 0 && numeric <= 65535 ? numeric : 0;
  };
  const resolveIpProxyAccountList = (value) => (typeof normalizeIpProxyAccountList === 'function'
    ? normalizeIpProxyAccountList(value || '')
    : String(value || '').replace(/\r/g, '').trim());
  const resolveIpProxySessionPrefix = (value) => (typeof normalizeIpProxyAccountSessionPrefix === 'function'
    ? normalizeIpProxyAccountSessionPrefix(value || '')
    : String(value || '').trim());
  const resolveIpProxyAccountLifeMinutes = (value) => (typeof normalizeIpProxyAccountLifeMinutes === 'function'
    ? normalizeIpProxyAccountLifeMinutes(value || '')
    : String(value || '').trim());
  const resolveIpProxyPoolTargetCount = (value) => (typeof normalizeIpProxyPoolTargetCount === 'function'
    ? normalizeIpProxyPoolTargetCount(value || '', 20)
    : String(value || '20').trim() || '20');
  const resolveIpProxyAutoSyncEnabled = (value) => Boolean(value);
  const resolveIpProxyAutoSyncIntervalMinutes = (value) => {
    const numeric = Number.parseInt(String(value ?? '').trim(), 10);
    if (!Number.isFinite(numeric)) {
      return 15;
    }
    return Math.max(1, Math.min(1440, numeric));
  };
  syncLatestState(state);
  if (typeof applyOperationDelayState === 'function') {
    applyOperationDelayState(state);
  }
  syncAutoRunState(state);
  renderStepStatuses(latestState);

  inputEmail.value = state?.email || '';
  if (typeof syncSignupPhoneInputFromState === 'function') {
    syncSignupPhoneInputFromState(state);
  }
  syncPasswordField(state || {});
  if (typeof inputPlusModeEnabled !== 'undefined' && inputPlusModeEnabled) {
    inputPlusModeEnabled.checked = Boolean(state?.plusModeEnabled);
  }
  if (typeof selectPlusPaymentMethod !== 'undefined' && selectPlusPaymentMethod) {
    selectPlusPaymentMethod.value = normalizePlusPaymentMethod(state?.plusPaymentMethod);
  }
  if (typeof inputGpcHelperApi !== 'undefined' && inputGpcHelperApi) {
    const defaultGpcHelperApiUrl = typeof DEFAULT_GPC_HELPER_API_URL !== 'undefined'
      ? DEFAULT_GPC_HELPER_API_URL
      : 'https://gpc.qlhazycoder.top';
    inputGpcHelperApi.value = `${defaultGpcHelperApiUrl.replace(/\/+$/g, '')}/`;
  }
  if (typeof inputGpcHelperCardKey !== 'undefined' && inputGpcHelperCardKey) {
    inputGpcHelperCardKey.value = state?.gopayHelperApiKey || state?.gopayHelperCardKey || '';
  }
  if (typeof selectGpcHelperPhoneMode !== 'undefined' && selectGpcHelperPhoneMode) {
    selectGpcHelperPhoneMode.value = normalizeGpcHelperPhoneModeValue(state?.gopayHelperPhoneMode || 'manual');
  }
  if (typeof selectGpcHelperCountryCode !== 'undefined' && selectGpcHelperCountryCode) {
    const normalizedCountryCode = window.GoPayUtils?.normalizeGoPayCountryCode
      ? window.GoPayUtils.normalizeGoPayCountryCode(state?.gopayHelperCountryCode)
      : String(state?.gopayHelperCountryCode || '+86').trim();
    const hasOption = Array.from(selectGpcHelperCountryCode.options || [])
      .some((option) => option.value === normalizedCountryCode);
    if (!hasOption && normalizedCountryCode) {
      const option = document.createElement('option');
      option.value = normalizedCountryCode;
      option.textContent = `自定义 ${normalizedCountryCode}`;
      selectGpcHelperCountryCode.appendChild(option);
    }
    selectGpcHelperCountryCode.value = normalizedCountryCode || '+86';
  }
  if (typeof inputGpcHelperPhone !== 'undefined' && inputGpcHelperPhone) {
    inputGpcHelperPhone.value = state?.gopayHelperPhoneNumber || '';
  }
  if (typeof selectGpcHelperOtpChannel !== 'undefined' && selectGpcHelperOtpChannel) {
    selectGpcHelperOtpChannel.value = normalizeGpcOtpChannelValue(state?.gopayHelperOtpChannel || 'whatsapp');
  }
  if (typeof inputGpcHelperLocalSmsEnabled !== 'undefined' && inputGpcHelperLocalSmsEnabled) {
    inputGpcHelperLocalSmsEnabled.checked = Boolean(state?.gopayHelperLocalSmsHelperEnabled);
  }
  if (typeof inputGpcHelperLocalSmsUrl !== 'undefined' && inputGpcHelperLocalSmsUrl) {
    inputGpcHelperLocalSmsUrl.value = normalizeGpcLocalSmsHelperBaseUrlValue(state?.gopayHelperLocalSmsHelperUrl || '');
  }
  if (typeof inputGpcHelperPin !== 'undefined' && inputGpcHelperPin) {
    inputGpcHelperPin.value = state?.gopayHelperPin || '';
  }
  if (typeof displayGpcHelperBalance !== 'undefined' && displayGpcHelperBalance) {
    const balanceText = String(state?.gopayHelperBalance || '').trim();
    const balanceError = String(state?.gopayHelperBalanceError || '').trim();
    const balanceAt = Number(state?.gopayHelperBalanceUpdatedAt) || 0;
    displayGpcHelperBalance.textContent = balanceError
      ? `余额查询失败：${balanceError}`
      : (balanceText || (balanceAt ? '余额已更新' : '余额未获取'));
  }
  if (typeof selectGoPayCountryCode !== 'undefined' && selectGoPayCountryCode) {
    const normalizedGoPayCountryCode = window.GoPayUtils?.normalizeGoPayCountryCode
      ? window.GoPayUtils.normalizeGoPayCountryCode(state?.gopayCountryCode)
      : String(state?.gopayCountryCode || '+86').trim();
    const hasOption = Array.from(selectGoPayCountryCode.options || [])
      .some((option) => option.value === normalizedGoPayCountryCode);
    if (!hasOption && normalizedGoPayCountryCode) {
      const option = document.createElement('option');
      option.value = normalizedGoPayCountryCode;
      option.textContent = `自定义 ${normalizedGoPayCountryCode}`;
      selectGoPayCountryCode.appendChild(option);
    }
    selectGoPayCountryCode.value = normalizedGoPayCountryCode || '+86';
  }
  if (typeof inputGoPayPhone !== 'undefined' && inputGoPayPhone) {
    inputGoPayPhone.value = state?.gopayPhone || '';
  }
  if (typeof inputGoPayOtp !== 'undefined' && inputGoPayOtp) {
    inputGoPayOtp.value = state?.gopayOtp || '';
  }
  if (typeof inputGoPayPin !== 'undefined' && inputGoPayPin) {
    inputGoPayPin.value = state?.gopayPin || '';
  }
  inputVpsUrl.value = state?.vpsUrl || '';
  inputVpsPassword.value = state?.vpsPassword || '';
  setLocalCpaStep9Mode(state?.localCpaStep9Mode);
  selectPanelMode.value = normalizePanelMode(state?.panelMode || 'cpa');
  inputSub2ApiUrl.value = state?.sub2apiUrl || '';
  inputSub2ApiEmail.value = state?.sub2apiEmail || '';
  inputSub2ApiPassword.value = state?.sub2apiPassword || '';
  renderSub2ApiGroupOptions(state, state?.sub2apiGroupName || '');
  if (typeof inputSub2ApiAccountPriority !== 'undefined' && inputSub2ApiAccountPriority) {
    inputSub2ApiAccountPriority.value = String(normalizeSub2ApiAccountPriorityValue(state?.sub2apiAccountPriority));
  }
  inputSub2ApiDefaultProxy.value = state?.sub2apiDefaultProxyName || '';
  const normalizedIpProxyService = resolveIpProxyService(state?.ipProxyService);
  const normalizedIpProxyServiceProfiles = typeof normalizeIpProxyServiceProfiles === 'function'
    ? normalizeIpProxyServiceProfiles(state?.ipProxyServiceProfiles || {}, state || {})
    : (state?.ipProxyServiceProfiles || {});
  const activeIpProxyProfile = typeof getIpProxyServiceProfile === 'function'
    ? getIpProxyServiceProfile(normalizedIpProxyService, {
      ...(state || {}),
      ipProxyService: normalizedIpProxyService,
      ipProxyServiceProfiles: normalizedIpProxyServiceProfiles,
    })
    : {
      mode: resolveIpProxyMode(state?.ipProxyMode),
      apiUrl: String(state?.ipProxyApiUrl || '').trim(),
      accountList: resolveIpProxyAccountList(state?.ipProxyAccountList || ''),
      accountSessionPrefix: resolveIpProxySessionPrefix(state?.ipProxyAccountSessionPrefix || ''),
      accountLifeMinutes: resolveIpProxyAccountLifeMinutes(state?.ipProxyAccountLifeMinutes || ''),
      poolTargetCount: resolveIpProxyPoolTargetCount(state?.ipProxyPoolTargetCount || ''),
      host: String(state?.ipProxyHost || '').trim(),
      port: String(resolveIpProxyPort(state?.ipProxyPort || '') || ''),
      protocol: resolveIpProxyProtocol(state?.ipProxyProtocol),
      username: String(state?.ipProxyUsername || '').trim(),
      password: String(state?.ipProxyPassword || ''),
      region: String(state?.ipProxyRegion || '').trim(),
    };
  if (typeof selectIpProxyService !== 'undefined' && selectIpProxyService) {
    selectIpProxyService.value = normalizedIpProxyService;
  }
  if (typeof inputIpProxyApiUrl !== 'undefined' && inputIpProxyApiUrl) {
    inputIpProxyApiUrl.value = String(activeIpProxyProfile.apiUrl || '').trim();
  }
  if (typeof inputIpProxyAccountList !== 'undefined' && inputIpProxyAccountList) {
    inputIpProxyAccountList.value = activeIpProxyProfile.accountList;
  }
  if (typeof inputIpProxyAccountSessionPrefix !== 'undefined' && inputIpProxyAccountSessionPrefix) {
    inputIpProxyAccountSessionPrefix.value = activeIpProxyProfile.accountSessionPrefix;
  }
  if (typeof inputIpProxyAccountLifeMinutes !== 'undefined' && inputIpProxyAccountLifeMinutes) {
    inputIpProxyAccountLifeMinutes.value = activeIpProxyProfile.accountLifeMinutes;
  }
  if (typeof inputIpProxyPoolTargetCount !== 'undefined' && inputIpProxyPoolTargetCount) {
    inputIpProxyPoolTargetCount.value = activeIpProxyProfile.poolTargetCount;
  }
  if (typeof inputIpProxyAutoSyncEnabled !== 'undefined' && inputIpProxyAutoSyncEnabled) {
    inputIpProxyAutoSyncEnabled.checked = resolveIpProxyAutoSyncEnabled(state?.ipProxyAutoSyncEnabled);
  }
  if (typeof inputIpProxyAutoSyncIntervalMinutes !== 'undefined' && inputIpProxyAutoSyncIntervalMinutes) {
    inputIpProxyAutoSyncIntervalMinutes.value = String(
      resolveIpProxyAutoSyncIntervalMinutes(state?.ipProxyAutoSyncIntervalMinutes)
    );
  }
  if (typeof inputIpProxyHost !== 'undefined' && inputIpProxyHost) {
    inputIpProxyHost.value = activeIpProxyProfile.host;
  }
  if (typeof inputIpProxyPort !== 'undefined' && inputIpProxyPort) {
    const normalizedPort = resolveIpProxyPort(activeIpProxyProfile.port || '');
    inputIpProxyPort.value = normalizedPort > 0 ? String(normalizedPort) : '';
  }
  if (typeof selectIpProxyProtocol !== 'undefined' && selectIpProxyProtocol) {
    selectIpProxyProtocol.value = resolveIpProxyProtocol(activeIpProxyProfile.protocol);
  }
  if (typeof inputIpProxyUsername !== 'undefined' && inputIpProxyUsername) {
    inputIpProxyUsername.value = activeIpProxyProfile.username;
  }
  if (typeof inputIpProxyPassword !== 'undefined' && inputIpProxyPassword) {
    inputIpProxyPassword.value = activeIpProxyProfile.password;
  }
  if (typeof inputIpProxyRegion !== 'undefined' && inputIpProxyRegion) {
    inputIpProxyRegion.value = activeIpProxyProfile.region;
  }
  if (typeof setIpProxyMode === 'function') {
    setIpProxyMode(activeIpProxyProfile.mode);
  }
  if (typeof setIpProxyEnabled === 'function') {
    setIpProxyEnabled(Boolean(state?.ipProxyEnabled));
  }
  syncLatestState({
    ipProxyService: normalizedIpProxyService,
    ipProxyServiceProfiles: normalizedIpProxyServiceProfiles,
    ...(typeof buildIpProxyStatePatchFromServiceProfile === 'function'
      ? buildIpProxyStatePatchFromServiceProfile(normalizedIpProxyService, activeIpProxyProfile)
      : {}),
  });
  if (typeof updateIpProxyUI === 'function') {
    updateIpProxyUI(latestState);
  }
  inputCodex2ApiUrl.value = state?.codex2apiUrl || '';
  inputCodex2ApiAdminKey.value = state?.codex2apiAdminKey || '';
  const restoredMailProvider = isCustomMailProvider(state?.mailProvider)
    || [ICLOUD_PROVIDER, 'hotmail-api', GMAIL_PROVIDER, 'luckmail-api', '163', '163-vip', '126', 'qq', 'inbucket', '2925', 'cloudflare-temp-email', 'cloudmail'].includes(String(state?.mailProvider || '').trim())
    ? String(state?.mailProvider || '163').trim()
    : (String(state?.emailGenerator || '').trim().toLowerCase() === 'custom'
      || String(state?.emailGenerator || '').trim().toLowerCase() === 'manual'
      ? 'custom'
      : '163');
  selectMailProvider.value = restoredMailProvider;
  setMail2925Mode(state?.mail2925Mode);
  {
    const restoredEmailGenerator = String(state?.emailGenerator || '').trim().toLowerCase();
    if (restoredMailProvider === GMAIL_PROVIDER) {
      selectEmailGenerator.value = restoredEmailGenerator === CUSTOM_EMAIL_POOL_GENERATOR
        ? CUSTOM_EMAIL_POOL_GENERATOR
        : GMAIL_ALIAS_GENERATOR;
    } else if (restoredEmailGenerator === CUSTOM_EMAIL_POOL_GENERATOR) {
      selectEmailGenerator.value = CUSTOM_EMAIL_POOL_GENERATOR;
    } else if (restoredEmailGenerator === 'icloud') {
      selectEmailGenerator.value = 'icloud';
    } else if (restoredEmailGenerator === 'cloudflare') {
      selectEmailGenerator.value = 'cloudflare';
    } else if (restoredEmailGenerator === 'cloudflare-temp-email') {
      selectEmailGenerator.value = 'cloudflare-temp-email';
    } else if (restoredEmailGenerator === 'cloudmail') {
      selectEmailGenerator.value = 'cloudmail';
    } else {
      selectEmailGenerator.value = 'duck';
    }
  }
  if (selectIcloudHostPreference) {
    selectIcloudHostPreference.value = String(state?.icloudHostPreference || '').trim().toLowerCase() === 'icloud.com'
      ? 'icloud.com'
      : (String(state?.icloudHostPreference || '').trim().toLowerCase() === 'icloud.com.cn' ? 'icloud.com.cn' : 'auto');
  }
  if (selectIcloudFetchMode) {
    selectIcloudFetchMode.value = normalizeIcloudFetchMode(state?.icloudFetchMode);
  }
  if (selectIcloudTargetMailboxType) {
    selectIcloudTargetMailboxType.value = normalizeIcloudTargetMailboxType(state?.icloudTargetMailboxType);
  }
  if (selectIcloudForwardMailProvider) {
    selectIcloudForwardMailProvider.value = normalizeIcloudForwardMailProvider(state?.icloudForwardMailProvider);
  }
  if (checkboxAutoDeleteIcloud) {
    checkboxAutoDeleteIcloud.checked = Boolean(state?.autoDeleteUsedIcloudAlias);
  }
  if (inputAccountRunHistoryHelperBaseUrl) {
    inputAccountRunHistoryHelperBaseUrl.value = normalizeAccountRunHistoryHelperBaseUrlValue(state?.accountRunHistoryHelperBaseUrl);
  }
  if (inputContributionNickname) {
    inputContributionNickname.value = state?.contributionNickname || '';
  }
  if (inputContributionQq) {
    inputContributionQq.value = state?.contributionQq || '';
  }
  if (inputMail2925UseAccountPool) {
    inputMail2925UseAccountPool.checked = Boolean(state?.mail2925UseAccountPool);
  }
  setManagedAliasBaseEmailInputForProvider(restoredMailProvider, state);
  inputInbucketHost.value = state?.inbucketHost || '';
  inputInbucketMailbox.value = state?.inbucketMailbox || '';
  if (inputCustomMailProviderPool) {
    inputCustomMailProviderPool.value = normalizeCustomEmailPoolEntries(state?.customMailProviderPool).join('\n');
  }
  const restoredCustomEmailPoolEntries = typeof restoreCustomEmailPoolEntriesFromState === 'function'
    ? restoreCustomEmailPoolEntriesFromState(state)
    : normalizeCustomEmailPoolEntries(state?.customEmailPool);
  if (typeof setCustomEmailPoolEntriesState === 'function') {
    setCustomEmailPoolEntriesState(restoredCustomEmailPoolEntries);
  } else if (inputCustomEmailPool) {
    inputCustomEmailPool.value = restoredCustomEmailPoolEntries.join('\n');
  }
  setHotmailServiceMode(state?.hotmailServiceMode);
  inputHotmailRemoteBaseUrl.value = state?.hotmailRemoteBaseUrl || '';
  inputHotmailLocalBaseUrl.value = state?.hotmailLocalBaseUrl || '';
  inputLuckmailApiKey.value = state?.luckmailApiKey || '';
  inputLuckmailBaseUrl.value = normalizeLuckmailBaseUrl(state?.luckmailBaseUrl);
  selectLuckmailEmailType.value = normalizeLuckmailEmailType(state?.luckmailEmailType);
  inputLuckmailDomain.value = state?.luckmailDomain || '';
  applyCloudflareTempEmailSettingsState(state);
  if (typeof applyCloudMailSettingsState === 'function') {
    applyCloudMailSettingsState(state);
  }
  renderCloudflareDomainOptions(state?.cloudflareDomain || '');
  setCloudflareDomainEditMode(false, { clearInput: true });
  inputAutoSkipFailures.checked = Boolean(state?.autoRunSkipFailures);
  inputAutoSkipFailuresThreadIntervalMinutes.value = String(normalizeAutoRunThreadIntervalMinutes(state?.autoRunFallbackThreadIntervalMinutes));
  if (typeof inputStep6CookieCleanupEnabled !== 'undefined' && inputStep6CookieCleanupEnabled) {
    inputStep6CookieCleanupEnabled.checked = Boolean(state?.step6CookieCleanupEnabled);
  }
  inputAutoDelayEnabled.checked = Boolean(state?.autoRunDelayEnabled);
  inputAutoDelayMinutes.value = String(normalizeAutoDelayMinutes(state?.autoRunDelayMinutes));
  inputAutoStepDelaySeconds.value = formatAutoStepDelayInputValue(state?.autoStepDelaySeconds);
  if (typeof inputOAuthFlowTimeoutEnabled !== 'undefined' && inputOAuthFlowTimeoutEnabled) {
    inputOAuthFlowTimeoutEnabled.checked = state?.oauthFlowTimeoutEnabled !== undefined
      ? Boolean(state.oauthFlowTimeoutEnabled)
      : true;
  }
  if (inputVerificationResendCount) {
    const restoredVerificationResendCount = state?.verificationResendCount !== undefined
      ? state.verificationResendCount
      : (state?.signupVerificationResendCount ?? state?.loginVerificationResendCount);
    inputVerificationResendCount.value = String(
      normalizeVerificationResendCount(restoredVerificationResendCount, DEFAULT_VERIFICATION_RESEND_COUNT)
    );
  }
  if (inputPhoneVerificationEnabled) {
    inputPhoneVerificationEnabled.checked = state?.phoneVerificationEnabled !== undefined
      ? Boolean(state.phoneVerificationEnabled)
      : DEFAULT_PHONE_VERIFICATION_ENABLED;
  }
  if (typeof setSignupMethod === 'function') {
    setSignupMethod(state?.signupMethod || DEFAULT_SIGNUP_METHOD);
  }
  const restoredPhoneSmsProvider = normalizePhoneSmsProvider(state?.phoneSmsProvider);
  const previousPhoneSmsProvider = selectPhoneSmsProvider ? normalizePhoneSmsProvider(selectPhoneSmsProvider.value) : restoredPhoneSmsProvider;
  const defaultFiveSimProduct = typeof DEFAULT_FIVE_SIM_PRODUCT !== 'undefined'
    ? DEFAULT_FIVE_SIM_PRODUCT
    : 'openai';
  const defaultNexSmsServiceCode = typeof DEFAULT_NEX_SMS_SERVICE_CODE !== 'undefined'
    ? DEFAULT_NEX_SMS_SERVICE_CODE
    : 'ot';
  setPhoneSmsProviderSelectValue(restoredPhoneSmsProvider);
  const restoredPhoneSmsProviderOrder = typeof applyPhoneSmsProviderOrderSelection === 'function'
    ? applyPhoneSmsProviderOrderSelection(state?.phoneSmsProviderOrder || [], {
      ensureDefault: false,
      syncProvider: false,
    })
    : [];
  updatePhoneSmsProviderOrderSummary(restoredPhoneSmsProviderOrder);
  if (previousPhoneSmsProvider !== restoredPhoneSmsProvider) {
    heroSmsCountrySelectionOrder = [];
    loadHeroSmsCountries().catch((error) => {
      console.warn('Failed to reload SMS countries after provider restore:', error);
    });
  }
  if (inputHeroSmsApiKey) {
    inputHeroSmsApiKey.value = restoredPhoneSmsProvider === PHONE_SMS_PROVIDER_FIVE_SIM
      ? (state?.fiveSimApiKey || '')
      : (state?.heroSmsApiKey || '');
  }
  if (typeof inputFiveSimApiKey !== 'undefined' && inputFiveSimApiKey) {
    inputFiveSimApiKey.value = String(state?.fiveSimApiKey || '');
  }
  if (typeof inputFiveSimOperator !== 'undefined' && inputFiveSimOperator) {
    inputFiveSimOperator.value = typeof normalizeFiveSimOperatorValue === 'function'
      ? normalizeFiveSimOperatorValue(state?.fiveSimOperator || DEFAULT_FIVE_SIM_OPERATOR)
      : normalizeFiveSimOperator(state?.fiveSimOperator || DEFAULT_FIVE_SIM_OPERATOR);
  }
  if (typeof inputFiveSimProduct !== 'undefined' && inputFiveSimProduct) {
    inputFiveSimProduct.value = typeof normalizeFiveSimProductValue === 'function'
      ? normalizeFiveSimProductValue(state?.fiveSimProduct || defaultFiveSimProduct)
      : String(state?.fiveSimProduct || defaultFiveSimProduct).trim().toLowerCase().replace(/[^a-z0-9_-]+/g, '') || defaultFiveSimProduct;
  }
  if (typeof inputNexSmsApiKey !== 'undefined' && inputNexSmsApiKey) {
    inputNexSmsApiKey.value = String(state?.nexSmsApiKey || '');
  }
  if (typeof inputNexSmsServiceCode !== 'undefined' && inputNexSmsServiceCode) {
    inputNexSmsServiceCode.value = typeof normalizeNexSmsServiceCodeValue === 'function'
      ? normalizeNexSmsServiceCodeValue(state?.nexSmsServiceCode || defaultNexSmsServiceCode)
      : String(state?.nexSmsServiceCode || defaultNexSmsServiceCode).trim().toLowerCase().replace(/[^a-z0-9_-]+/g, '') || defaultNexSmsServiceCode;
  }
  if (typeof inputHeroSmsReuseEnabled !== 'undefined' && inputHeroSmsReuseEnabled) {
    inputHeroSmsReuseEnabled.checked = normalizeHeroSmsReuseEnabledValue(state?.heroSmsReuseEnabled);
  }
  if (typeof inputFreePhoneReuseEnabled !== 'undefined' && inputFreePhoneReuseEnabled) {
    inputFreePhoneReuseEnabled.checked = Boolean(state?.freePhoneReuseEnabled);
  }
  if (typeof inputFreePhoneReuseAutoEnabled !== 'undefined' && inputFreePhoneReuseAutoEnabled) {
    inputFreePhoneReuseAutoEnabled.checked = Boolean(state?.freePhoneReuseAutoEnabled);
  }
  if (typeof selectHeroSmsAcquirePriority !== 'undefined' && selectHeroSmsAcquirePriority) {
    selectHeroSmsAcquirePriority.value = normalizeHeroSmsAcquirePriority(state?.heroSmsAcquirePriority);
  }
  if (inputHeroSmsMaxPrice) {
    inputHeroSmsMaxPrice.value = restoredPhoneSmsProvider === PHONE_SMS_PROVIDER_FIVE_SIM
      ? normalizeFiveSimMaxPriceValue(state?.fiveSimMaxPrice || '')
      : normalizeHeroSmsMaxPriceValue(state?.heroSmsMaxPrice || '');
  }
  if (inputFiveSimOperator) {
    inputFiveSimOperator.value = normalizeFiveSimOperator(state?.fiveSimOperator);
  }
  if (typeof inputHeroSmsPreferredPrice !== 'undefined' && inputHeroSmsPreferredPrice) {
    inputHeroSmsPreferredPrice.value = normalizeHeroSmsMaxPriceValue(state?.heroSmsPreferredPrice || '');
  }
  if (typeof inputPhoneReplacementLimit !== 'undefined' && inputPhoneReplacementLimit) {
    inputPhoneReplacementLimit.value = String(
      normalizePhoneVerificationReplacementLimit(
        state?.phoneVerificationReplacementLimit,
        DEFAULT_PHONE_VERIFICATION_REPLACEMENT_LIMIT
      )
    );
  }
  if (typeof inputPhoneCodeWaitSeconds !== 'undefined' && inputPhoneCodeWaitSeconds) {
    inputPhoneCodeWaitSeconds.value = String(
      normalizePhoneCodeWaitSecondsValue(state?.phoneCodeWaitSeconds, DEFAULT_PHONE_CODE_WAIT_SECONDS)
    );
  }
  if (typeof inputPhoneCodeTimeoutWindows !== 'undefined' && inputPhoneCodeTimeoutWindows) {
    inputPhoneCodeTimeoutWindows.value = String(
      normalizePhoneCodeTimeoutWindowsValue(state?.phoneCodeTimeoutWindows, DEFAULT_PHONE_CODE_TIMEOUT_WINDOWS)
    );
  }
  if (typeof inputPhoneCodePollIntervalSeconds !== 'undefined' && inputPhoneCodePollIntervalSeconds) {
    inputPhoneCodePollIntervalSeconds.value = String(
      normalizePhoneCodePollIntervalSecondsValue(
        state?.phoneCodePollIntervalSeconds,
        DEFAULT_PHONE_CODE_POLL_INTERVAL_SECONDS
      )
    );
  }
  if (typeof inputPhoneCodePollMaxRounds !== 'undefined' && inputPhoneCodePollMaxRounds) {
    inputPhoneCodePollMaxRounds.value = String(
      normalizePhoneCodePollMaxRoundsValue(state?.phoneCodePollMaxRounds, DEFAULT_PHONE_CODE_POLL_MAX_ROUNDS)
    );
  }
  if (typeof applyHeroSmsFallbackSelection === 'function') {
    const primaryCountry = restoredPhoneSmsProvider === PHONE_SMS_PROVIDER_FIVE_SIM
      ? {
        id: normalizeFiveSimCountryId(state?.fiveSimCountryId),
        label: normalizeFiveSimCountryLabel(state?.fiveSimCountryLabel),
      }
      : {
        id: normalizeHeroSmsCountryId(state?.heroSmsCountryId),
        label: normalizeHeroSmsCountryLabel(state?.heroSmsCountryLabel),
      };
    applyHeroSmsFallbackSelection(
      [
        primaryCountry,
        ...(restoredPhoneSmsProvider === PHONE_SMS_PROVIDER_FIVE_SIM
          ? normalizeFiveSimCountryFallbackList(state?.fiveSimCountryFallback || [])
          : normalizeHeroSmsCountryFallbackList(state?.heroSmsCountryFallback || [])),
      ],
      { includePrimary: true }
    );
    updateHeroSmsPlatformDisplay();
  } else if (selectHeroSmsCountry) {
    const restoredCountryId = restoredPhoneSmsProvider === PHONE_SMS_PROVIDER_FIVE_SIM
      ? String(normalizeFiveSimCountryId(state?.fiveSimCountryId))
      : String(normalizeHeroSmsCountryId(state?.heroSmsCountryId));
    if (Array.from(selectHeroSmsCountry.options).some((option) => option.value === restoredCountryId)) {
      selectHeroSmsCountry.value = restoredCountryId;
    } else {
      Array.from(selectHeroSmsCountry.options).forEach((option) => {
        option.selected = false;
      });
    }
    updateHeroSmsPlatformDisplay();
  }
  updateHeroSmsPlatformDisplay();
  if (typeof updateHeroSmsRuntimeDisplay === 'function') {
    updateHeroSmsRuntimeDisplay(state);
  }
  const isSyncPhase = typeof isAutoRunSourceSyncPhase === 'function'
    ? isAutoRunSourceSyncPhase
    : (phase) => ['scheduled', 'running', 'waiting_step', 'waiting_email', 'retrying', 'waiting_interval'].includes(phase);
  const shouldSyncInitialRunCount = typeof shouldSyncRunCountFromAutoRunSource === 'function'
    ? shouldSyncRunCountFromAutoRunSource(state)
    : (Boolean(state?.autoRunning) || isSyncPhase(state?.autoRunPhase ?? state?.phase));
  if (state?.autoRunTotalRuns && shouldSyncInitialRunCount) {
    inputRunCount.value = String(state.autoRunTotalRuns);
  }

  applyAutoRunStatus(state);
  markSettingsDirty(false);
  updateAutoDelayInputState();
  updateFallbackThreadIntervalInputState();
  updateAccountRunHistorySettingsUI();
  updatePhoneVerificationSettingsUI();
  if (typeof renderPayPalAccounts === 'function') {
    renderPayPalAccounts();
  }
  if (typeof updatePlusModeUI === 'function') {
    updatePlusModeUI();
  }
  updatePanelModeUI();
  updateMailProviderUI();
  if (typeof queueCustomEmailPoolRefresh === 'function') {
    queueCustomEmailPoolRefresh();
  }
  if (isLuckmailProvider(state?.mailProvider)) {
    if (typeof queueLuckmailPurchaseRefresh === 'function') {
      queueLuckmailPurchaseRefresh();
    }
  }
  updateButtonStates();
  if (typeof syncPlusManualConfirmationDialog === 'function') {
    void syncPlusManualConfirmationDialog();
  }
}

async function restoreState() {
  try {
    const state = await chrome.runtime.sendMessage({ type: 'GET_STATE', source: 'sidepanel' });
    applySettingsState(state);
    if (getSelectedEmailGenerator() === 'icloud' && icloudSection?.style.display !== 'none') {
      refreshIcloudAliases({ silent: true }).catch(() => { });
    }

    if (state.oauthUrl) {
      displayOauthUrl.textContent = state.oauthUrl;
      displayOauthUrl.classList.add('has-value');
    }
    if (state.localhostUrl) {
      displayLocalhostUrl.textContent = state.localhostUrl;
      displayLocalhostUrl.classList.add('has-value');
    }
    if (state.stepStatuses) {
      for (const [step, status] of Object.entries(state.stepStatuses)) {
        updateStepUI(Number(step), status);
      }
    }

    if (state.logs) {
      for (const entry of state.logs) {
        appendLog(entry);
      }
    }

    updateStatusDisplay(latestState);
    updateProgressCounter();
    renderContributionMode();
  } catch (err) {
    console.error('Failed to restore state:', err);
    if (typeof applyOperationDelayState === 'function') {
      applyOperationDelayState(undefined, { restoreFailed: true });
    }
  }
}

function openExternalUrl(url) {
  const targetUrl = String(url || '').trim();
  if (!targetUrl) {
    return;
  }

  if (chrome?.tabs?.create) {
    chrome.tabs.create({ url: targetUrl, active: true }).catch(() => {
      window.open(targetUrl, '_blank', 'noopener');
    });
    return;
  }

  window.open(targetUrl, '_blank', 'noopener');
}

function getRepositoryHomeUrl() {
  const serviceRepositoryUrl = String(sidepanelUpdateService?.repositoryUrl || '').trim();
  if (serviceRepositoryUrl) {
    return serviceRepositoryUrl;
  }

  const releasesPageUrl = String(sidepanelUpdateService?.releasesPageUrl || '').trim();
  if (releasesPageUrl) {
    return releasesPageUrl.replace(/\/releases\/?$/, '');
  }

  return 'https://github.com/QLHazyCoder/codex-oauth-automation-extension';
}

function getReleaseListUrl() {
  const snapshotReleaseListUrl = String(currentReleaseSnapshot?.releasesPageUrl || '').trim();
  if (snapshotReleaseListUrl) {
    return snapshotReleaseListUrl;
  }

  const serviceReleaseListUrl = String(sidepanelUpdateService?.releasesPageUrl || '').trim();
  if (serviceReleaseListUrl) {
    return serviceReleaseListUrl;
  }

  return `${getRepositoryHomeUrl()}/releases`;
}

function openRepositoryHomePage() {
  openExternalUrl(getRepositoryHomeUrl());
}

function openReleaseListPage() {
  openExternalUrl(getReleaseListUrl());
}

function ignoreCurrentReleaseUpdate() {
  if (!sidepanelUpdateService?.ignoreReleaseSnapshot) {
    return;
  }

  const ignoredVersion = sidepanelUpdateService.ignoreReleaseSnapshot(currentReleaseSnapshot);
  if (!ignoredVersion) {
    return;
  }

  renderReleaseSnapshot({
    ...currentReleaseSnapshot,
    status: 'ignored',
    ignoredVersion,
  });
  showToast(`已忽略 ${ignoredVersion} 更新，有新版本时会再次提醒。`, 'info', 2200);
}

function openCloudflareTempEmailUsageGuidePage() {
  const targetUrl = getContributionPortalUrl();
  if (!targetUrl) {
    return;
  }
  openExternalUrl(targetUrl);
}

function openCloudflareTempEmailRepositoryPage() {
  openExternalUrl(CLOUDFLARE_TEMP_EMAIL_REPOSITORY_URL);
}

function createUpdateNoteList(notes = []) {
  if (!Array.isArray(notes) || notes.length === 0) {
    const empty = document.createElement('p');
    empty.className = 'update-release-empty';
    empty.textContent = '该版本未提供可解析的更新说明，请查看完整更新日志。';
    return empty;
  }

  const list = document.createElement('ul');
  list.className = 'update-release-notes';

  notes.forEach((note) => {
    const item = document.createElement('li');
    item.textContent = note;
    list.appendChild(item);
  });

  return list;
}

function renderUpdateReleaseList(releases = []) {
  if (!updateReleaseList) {
    return;
  }

  updateReleaseList.innerHTML = '';

  releases.forEach((release) => {
    const item = document.createElement('article');
    item.className = 'update-release-item';

    const head = document.createElement('div');
    head.className = 'update-release-head';

    const titleRow = document.createElement('div');
    titleRow.className = 'update-release-title-row';

    const version = document.createElement('span');
    version.className = 'update-release-version';
    version.textContent = release.displayVersion || `Ultra${release.version}`;
    titleRow.appendChild(version);

    if (release.title) {
      const name = document.createElement('span');
      name.className = 'update-release-name';
      name.textContent = release.title;
      titleRow.appendChild(name);
    }

    head.appendChild(titleRow);

    const publishedAt = sidepanelUpdateService?.formatReleaseDate?.(release.publishedAt) || '';
    if (publishedAt) {
      const date = document.createElement('span');
      date.className = 'update-release-date';
      date.textContent = publishedAt;
      head.appendChild(date);
    }

    item.appendChild(head);
    item.appendChild(createUpdateNoteList(release.notes));
    updateReleaseList.appendChild(item);
  });
}

function resetUpdateCard() {
  if (updateSection) {
    updateSection.hidden = true;
  }
  if (updateCardVersion) {
    updateCardVersion.textContent = '';
  }
  if (updateCardSummary) {
    updateCardSummary.textContent = '';
  }
  if (updateReleaseList) {
    updateReleaseList.innerHTML = '';
  }
  if (btnOpenRelease) {
    btnOpenRelease.hidden = true;
    btnOpenRelease.onclick = null;
  }
  if (btnIgnoreRelease) {
    btnIgnoreRelease.hidden = true;
    btnIgnoreRelease.onclick = null;
  }
}

function renderReleaseSnapshot(snapshot) {
  currentReleaseSnapshot = snapshot;

  if (!extensionUpdateStatus || !extensionVersionMeta) {
    return;
  }

  extensionUpdateStatus.classList.remove('is-update-available', 'is-check-failed', 'is-version-label');

  const localVersionText = snapshot?.localVersion || '';
  const logUrl = snapshot?.logUrl || snapshot?.releasesPageUrl || sidepanelUpdateService?.releasesPageUrl || '';

  if (btnReleaseLog) {
    btnReleaseLog.onclick = () => openExternalUrl(logUrl);
    btnReleaseLog.hidden = true;
  }
  extensionVersionMeta.hidden = true;
  extensionVersionMeta.textContent = '';

  switch (snapshot?.status) {
    case 'update-available': {
      extensionUpdateStatus.textContent = '有更新';
      extensionUpdateStatus.classList.add('is-update-available');
      if (btnReleaseLog) {
        btnReleaseLog.hidden = false;
      }

      if (updateSection) {
        updateSection.hidden = false;
      }
      if (updateCardVersion) {
        updateCardVersion.textContent = `最新版本 ${snapshot.latestVersion}`;
      }
      if (updateCardSummary) {
        const updateCount = Array.isArray(snapshot.newerReleases) ? snapshot.newerReleases.length : 0;
        updateCardSummary.textContent = updateCount > 1
          ? `当前 ${localVersionText}，共有 ${updateCount} 个新版本可更新。`
          : `当前 ${localVersionText}，可更新到 ${snapshot.latestVersion}。`;
      }
      renderUpdateReleaseList(snapshot.newerReleases || []);
      if (btnOpenRelease) {
        btnOpenRelease.hidden = false;
        btnOpenRelease.textContent = '前往更新';
        btnOpenRelease.onclick = () => openExternalUrl(logUrl);
      }
      if (btnIgnoreRelease) {
        btnIgnoreRelease.hidden = false;
        btnIgnoreRelease.onclick = ignoreCurrentReleaseUpdate;
      }
      break;
    }

    case 'ignored': {
      extensionUpdateStatus.textContent = localVersionText || 'Ultra0.0';
      extensionUpdateStatus.classList.add('is-version-label');
      resetUpdateCard();
      break;
    }

    case 'latest': {
      extensionUpdateStatus.textContent = localVersionText || 'Ultra0.0';
      extensionUpdateStatus.classList.add('is-version-label');
      resetUpdateCard();
      break;
    }

    case 'empty': {
      extensionUpdateStatus.textContent = localVersionText || 'Ultra0.0';
      extensionUpdateStatus.classList.add('is-version-label');
      resetUpdateCard();
      break;
    }

    case 'error':
    default: {
      extensionUpdateStatus.textContent = localVersionText || 'Ultra0.0';
      extensionUpdateStatus.classList.add('is-version-label', 'is-check-failed');
      extensionVersionMeta.textContent = snapshot?.errorMessage || 'GitHub Releases 检查失败';
      extensionVersionMeta.hidden = false;
      resetUpdateCard();
      break;
    }
  }
}

async function initializeReleaseInfo() {
  const fallbackReleaseUrl = sidepanelUpdateService?.releasesPageUrl || 'https://github.com/QLHazyCoder/codex-oauth-automation-extension/releases';

  if (btnReleaseLog) {
    btnReleaseLog.onclick = () => openExternalUrl(currentReleaseSnapshot?.logUrl || fallbackReleaseUrl);
  }

  if (!extensionUpdateStatus || !extensionVersionMeta) {
    return;
  }

  const localVersion = sidepanelUpdateService?.getLocalVersionLabel?.(chrome.runtime.getManifest())
    || chrome.runtime.getManifest()?.version_name
    || (chrome.runtime.getManifest()?.version ? `Ultra${chrome.runtime.getManifest().version}` : '');
  extensionUpdateStatus.textContent = localVersion || 'Ultra0.0';
  extensionUpdateStatus.classList.remove('is-update-available', 'is-check-failed');
  extensionUpdateStatus.classList.add('is-version-label');
  extensionVersionMeta.hidden = true;
  extensionVersionMeta.textContent = '';
  if (btnReleaseLog) {
    btnReleaseLog.hidden = true;
  }
  resetUpdateCard();

  if (!sidepanelUpdateService) {
    extensionVersionMeta.textContent = '更新检查服务不可用';
    extensionVersionMeta.hidden = false;
    return;
  }

  const snapshot = await sidepanelUpdateService.getReleaseSnapshot();
  renderReleaseSnapshot(snapshot);
}

function getContributionUpdateHintMessage(snapshot = currentContributionContentSnapshot) {
  const lines = getContributionUpdatePromptLines(snapshot);
  if (!lines.length) {
    return '';
  }
  if (lines.length === 1) {
    return lines[0];
  }
  return lines.map((line, index) => `${index + 1}. ${line}`).join('\n');
}

function getContributionUpdatePromptLines(snapshot = currentContributionContentSnapshot) {
  if (!snapshot?.promptVersion) {
    return [];
  }

  const items = Array.isArray(snapshot.items) ? snapshot.items : [];
  const autoRunNoticeItem = items.find((item) =>
    item
    && String(item.slug || '').trim().toLowerCase() === 'auto_run_notice'
  );
  if (autoRunNoticeItem) {
    const noticeText = String(autoRunNoticeItem.text || '').trim();
    return autoRunNoticeItem.isVisible && noticeText ? [noticeText] : [];
  }

  const hasAnnouncementOrTutorial = items.some((item) =>
    item
    && item.isVisible
    && ['announcement', 'tutorial'].includes(String(item.slug || '').trim().toLowerCase())
  );
  const hasQuestionnaire = items.some((item) =>
    item
    && item.isVisible
    && String(item.slug || '').trim().toLowerCase() === 'questionnaire'
  );

  const lines = [];
  if (hasAnnouncementOrTutorial) {
    lines.push('公告 / 使用教程有更新了，可点上方“贡献/使用”查看。');
  }
  if (hasQuestionnaire) {
    lines.push('有新的征求意见，请佬友共同参与选择。');
  }
  return lines;
}

function positionContributionUpdateHint() {
  if (!contributionUpdateLayer || !contributionUpdateHint || !btnContributionMode) {
    return;
  }
  if (contributionUpdateLayer.hidden || contributionUpdateHint.hidden) {
    return;
  }

  const buttonRect = btnContributionMode.getBoundingClientRect();
  const viewportWidth = Math.max(document.documentElement?.clientWidth || 0, window.innerWidth || 0);
  const viewportHeight = Math.max(document.documentElement?.clientHeight || 0, window.innerHeight || 0);
  const hintWidth = contributionUpdateHint.offsetWidth || 220;
  const hintHeight = contributionUpdateHint.offsetHeight || 56;
  const viewportPadding = 12;
  const gap = 10;

  const maxLeft = Math.max(viewportPadding, viewportWidth - hintWidth - viewportPadding);
  const left = Math.min(Math.max(viewportPadding, Math.round(buttonRect.left)), maxLeft);
  const shouldPlaceAbove = (buttonRect.bottom + gap + hintHeight) > (viewportHeight - viewportPadding)
    && buttonRect.top > (hintHeight + gap + viewportPadding);
  const top = shouldPlaceAbove
    ? Math.max(viewportPadding, Math.round(buttonRect.top - hintHeight - gap))
    : Math.max(viewportPadding, Math.round(buttonRect.bottom + gap));
  const buttonCenter = Math.round(buttonRect.left + (buttonRect.width / 2));
  const arrowOffset = Math.min(Math.max(16, buttonCenter - left), Math.max(16, hintWidth - 16));

  contributionUpdateHint.style.left = `${left}px`;
  contributionUpdateHint.style.top = `${top}px`;
  contributionUpdateHint.style.setProperty('--contribution-update-arrow-left', `${arrowOffset}px`);
}

function shouldShowContributionUpdateHint(snapshot = currentContributionContentSnapshot) {
  const promptVersion = String(snapshot?.promptVersion || '').trim();
  if (!contributionUpdateLayer || !contributionUpdateHint || !contributionUpdateHintText || !btnContributionMode) {
    return false;
  }
  if (!promptVersion) {
    return false;
  }
  if (!getContributionUpdatePromptLines(snapshot).length) {
    return false;
  }
  if (promptVersion === getDismissedContributionContentPromptVersion()) {
    return false;
  }
  if (latestState?.contributionMode) {
    return false;
  }
  return !btnContributionMode.disabled;
}

function renderContributionUpdateHint(snapshot = currentContributionContentSnapshot) {
  if (!contributionUpdateLayer || !contributionUpdateHint) {
    return;
  }

  const visible = shouldShowContributionUpdateHint(snapshot);
  contributionUpdateLayer.hidden = !visible;
  contributionUpdateHint.hidden = !visible;
  if (!visible || !contributionUpdateHintText) {
    return;
  }

  contributionUpdateHintText.textContent = getContributionUpdateHintMessage(snapshot);
  if (typeof window.requestAnimationFrame === 'function') {
    window.requestAnimationFrame(() => positionContributionUpdateHint());
    return;
  }
  positionContributionUpdateHint();
}

function dismissContributionUpdateHint() {
  const promptVersion = String(currentContributionContentSnapshot?.promptVersion || '').trim();
  if (promptVersion) {
    setDismissedContributionContentPromptVersion(promptVersion);
  }
  renderContributionUpdateHint();
}

async function refreshContributionContentHint() {
  if (!contributionContentService?.getContentUpdateSnapshot) {
    currentContributionContentSnapshot = null;
    renderContributionUpdateHint();
    return null;
  }
  if (contributionContentSnapshotRequestInFlight) {
    return contributionContentSnapshotRequestInFlight;
  }

  contributionContentSnapshotRequestInFlight = contributionContentService.getContentUpdateSnapshot()
    .then((snapshot) => {
      currentContributionContentSnapshot = snapshot;
      renderContributionUpdateHint(snapshot);
      return snapshot;
    })
    .catch((error) => {
      currentContributionContentSnapshot = null;
      renderContributionUpdateHint(null);
      throw error;
    })
    .finally(() => {
      contributionContentSnapshotRequestInFlight = null;
    });

  return contributionContentSnapshotRequestInFlight;
}

function syncPasswordField(state) {
  inputPassword.value = state?.contributionMode ? '' : (state.customPassword || state.password || '');
}

function isCustomMailProvider(provider = selectMailProvider.value) {
  return String(provider || '').trim().toLowerCase() === 'custom';
}

function isLuckmailProvider(provider = selectMailProvider.value) {
  return String(provider || '').trim().toLowerCase() === LUCKMAIL_PROVIDER;
}

function isIcloudMailProvider(provider = selectMailProvider.value) {
  return String(provider || '').trim().toLowerCase() === ICLOUD_PROVIDER;
}

function normalizeLuckmailBaseUrl(value = '') {
  const trimmed = String(value || '').trim();
  if (!trimmed) {
    return DEFAULT_LUCKMAIL_BASE_URL;
  }

  try {
    const parsed = new URL(trimmed);
    if (!['http:', 'https:'].includes(parsed.protocol)) {
      return DEFAULT_LUCKMAIL_BASE_URL;
    }
    parsed.pathname = parsed.pathname.replace(/\/+$/, '');
    parsed.search = '';
    parsed.hash = '';
    return parsed.toString().replace(/\/$/, '');
  } catch {
    return DEFAULT_LUCKMAIL_BASE_URL;
  }
}

function normalizeLuckmailEmailType(value = '') {
  const normalized = String(value || '').trim().toLowerCase();
  return ['self_built', 'ms_imap', 'ms_graph', 'google_variant'].includes(normalized)
    ? normalized
    : DEFAULT_LUCKMAIL_EMAIL_TYPE;
}

function getSelectedEmailGenerator() {
  const generator = String(selectEmailGenerator.value || '').trim().toLowerCase();
  if (generator === 'custom' || generator === 'manual') {
    return 'custom';
  }
  if (generator === GMAIL_ALIAS_GENERATOR) {
    return GMAIL_ALIAS_GENERATOR;
  }
  if (generator === CUSTOM_EMAIL_POOL_GENERATOR) {
    return CUSTOM_EMAIL_POOL_GENERATOR;
  }
  if (generator === 'icloud') {
    return 'icloud';
  }
  if (generator === 'cloudflare') return 'cloudflare';
  if (generator === 'cloudflare-temp-email') return 'cloudflare-temp-email';
  if (generator === 'cloudmail') return 'cloudmail';
  return 'duck';
}

function getEmailGeneratorUiCopy() {
  if (getSelectedEmailGenerator() === 'custom') {
    return getCustomMailProviderUiCopy();
  }
  if (getSelectedEmailGenerator() === GMAIL_ALIAS_GENERATOR) {
    return {
      buttonLabel: '生成',
      placeholder: '步骤 3 自动生成 Gmail +tag 邮箱并回填',
      successVerb: '生成',
      label: 'Gmail +tag 邮箱',
    };
  }
  if (getSelectedEmailGenerator() === CUSTOM_EMAIL_POOL_GENERATOR) {
    return {
      buttonLabel: '取下一个',
      placeholder: '按邮箱池顺序自动回填，也可以手动粘贴当前轮邮箱',
      successVerb: '取用',
      label: '自定义邮箱池',
    };
  }
  if (getSelectedEmailGenerator() === 'icloud') {
    return {
      buttonLabel: '获取',
      placeholder: '点击获取 iCloud 隐私邮箱，或手动粘贴邮箱',
      successVerb: '获取',
      label: 'iCloud 隐私邮箱',
    };
  }
  if (getSelectedEmailGenerator() === 'cloudflare') {
    return {
      buttonLabel: '生成',
      placeholder: '点击生成 Cloudflare 邮箱，或手动粘贴邮箱',
      successVerb: '生成',
      label: 'Cloudflare 邮箱',
    };
  }
  if (getSelectedEmailGenerator() === 'cloudflare-temp-email') {
    return {
      buttonLabel: '生成 Temp',
      placeholder: '点击生成 Cloudflare Temp Email，或手动粘贴邮箱',
      successVerb: '生成',
      label: 'Cloudflare Temp Email',
    };
  }
  if (getSelectedEmailGenerator() === 'cloudmail') {
    return {
      buttonLabel: '生成',
      placeholder: '点击生成 Cloud Mail 邮箱，或手动粘贴邮箱',
      successVerb: '生成',
      label: 'Cloud Mail',
    };
  }

  return {
    buttonLabel: '获取',
    placeholder: '点击获取 DuckDuckGo 邮箱，或手动粘贴邮箱',
    successVerb: '获取',
    label: 'Duck 邮箱',
  };
}

function getCustomMailProviderUiCopy() {
  if (usesCustomMailProviderPool()) {
    return {
      buttonLabel: '自定义邮箱',
      placeholder: '号池会按顺序自动回填，也可以手动覆盖当前轮邮箱',
      successVerb: '使用',
      label: '自定义邮箱',
    };
  }
  return {
    buttonLabel: '自定义邮箱',
    placeholder: '请填写本轮要使用的注册邮箱',
    successVerb: '使用',
    label: '自定义邮箱',
  };
}

function getCustomVerificationPromptCopy(step) {
  const verificationLabel = step === 4 ? '注册验证码' : '登录验证码';
  const isLoginVerificationStep = step === 8 || step === 11;
  return {
    title: `手动处理${verificationLabel}`,
    message: `当前邮箱服务为“自定义邮箱”。请先在页面中手动输入${verificationLabel}，并确认已经进入下一页面后，再点击确认。`,
    alert: {
      text: `点击确认后会跳过步骤 ${step}。`,
      tone: 'danger',
    },
    ...(isLoginVerificationStep ? {
      phoneActionLabel: '出现手机号验证',
      phoneActionAlert: {
        text: '如果当前页面已经进入手机号验证，可直接标记为失败并继续下一个邮箱。',
        tone: 'danger',
      },
    } : {}),
  };
}

function normalizeGoPayOtpInputValue(value = '') {
  return window.GoPayUtils?.normalizeGoPayOtp
    ? window.GoPayUtils.normalizeGoPayOtp(value)
    : String(value || '').trim().replace(/[^\d]/g, '');
}

async function openGoPayOtpInputDialog(payload = {}) {
  if (!sharedFormDialog?.open) {
    throw new Error('验证码输入弹窗未加载，请刷新扩展后重试。');
  }

  const initialCode = normalizeGoPayOtpInputValue(payload.code || inputGoPayOtp?.value || latestState?.gopayOtp || '');
  const result = await sharedFormDialog.open({
    title: '输入 GoPay 验证码',
    message: '请把当前 GoPay 页面收到的验证码填到这里，确认后插件会继续填写验证码并进入 PIN 步骤。',
    confirmLabel: '提交验证码',
    confirmVariant: 'btn-primary',
    fields: [
      {
        key: 'code',
        label: '验证码',
        type: 'text',
        required: true,
        requiredMessage: '请输入 GoPay 验证码。',
        placeholder: '请输入数字验证码',
        inputMode: 'numeric',
        autocomplete: 'one-time-code',
        value: initialCode,
        validate: (value) => {
          const normalized = normalizeGoPayOtpInputValue(value);
          if (!normalized) return '请输入 GoPay 验证码。';
          if (normalized.length < 4) return 'GoPay 验证码长度过短，请检查。';
          return '';
        },
      },
    ],
  });
  const code = normalizeGoPayOtpInputValue(result?.code || '');
  if (!code) {
    return { cancelled: true, code: '' };
  }
  if (inputGoPayOtp) {
    inputGoPayOtp.value = code;
  }
  syncLatestState({ gopayOtp: code });
  markSettingsDirty(true);
  saveSettings({ silent: true }).catch(() => {});
  return { code };
}

async function openCustomVerificationConfirmDialog(step) {
  const promptCopy = getCustomVerificationPromptCopy(step);
  if (step === 8 || step === 11) {
    return openActionModal({
      title: promptCopy.title,
      message: promptCopy.message,
      alert: promptCopy.alert,
      actions: [
        { id: null, label: '取消', variant: 'btn-ghost' },
        { id: 'add_phone', label: promptCopy.phoneActionLabel || '出现手机号验证', variant: 'btn-outline' },
        { id: 'confirm', label: '确认跳过', variant: 'btn-danger' },
      ],
      buildResult: (choice) => ({
        confirmed: choice === 'confirm',
        addPhoneDetected: choice === 'add_phone',
      }),
    });
  }

  const confirmed = await openConfirmModal({
    title: promptCopy.title,
    message: promptCopy.message,
    confirmLabel: '确认跳过',
    confirmVariant: 'btn-danger',
    alert: promptCopy.alert,
  });
  return { confirmed, addPhoneDetected: false };
}

function getHotmailAccounts(state = latestState) {
  return Array.isArray(state?.hotmailAccounts) ? state.hotmailAccounts : [];
}

function getCurrentHotmailAccount(state = latestState) {
  const currentId = state?.currentHotmailAccountId;
  return getHotmailAccounts(state).find((account) => account.id === currentId) || null;
}

function getCurrentHotmailEmail(state = latestState) {
  return String(getCurrentHotmailAccount(state)?.email || '').trim();
}

function getMail2925Accounts(state = latestState) {
  return Array.isArray(state?.mail2925Accounts) ? state.mail2925Accounts : [];
}

function getCurrentMail2925Account(state = latestState) {
  const currentId = state?.currentMail2925AccountId;
  return getMail2925Accounts(state).find((account) => account.id === currentId) || null;
}

function getCurrentMail2925Email(state = latestState) {
  return String(getCurrentMail2925Account(state)?.email || '').trim();
}

function getPayPalAccounts(state = latestState) {
  return Array.isArray(state?.paypalAccounts) ? state.paypalAccounts : [];
}

function getCurrentPayPalAccount(state = latestState) {
  const currentId = String(state?.currentPayPalAccountId || '').trim();
  return getPayPalAccounts(state).find((account) => account.id === currentId) || null;
}

function syncMail2925BaseEmailFromCurrentAccount(state = latestState, options = {}) {
  const { persist = false } = options;
  if (!isMail2925AccountPoolEnabled(state)) {
    return false;
  }

  const currentEmail = getCurrentMail2925Email(state);
  if (!currentEmail || currentEmail === String(state?.mail2925BaseEmail || '').trim()) {
    return false;
  }

  syncLatestState({ mail2925BaseEmail: currentEmail });
  if (persist) {
    saveSettings({ silent: true }).catch(() => { });
  }
  return true;
}

function getCurrentLuckmailPurchase(state = latestState) {
  return state?.currentLuckmailPurchase || null;
}

function getCurrentLuckmailEmail(state = latestState) {
  return String(getCurrentLuckmailPurchase(state)?.email_address || '').trim();
}

function getLuckmailUsedPurchases(state = latestState) {
  const rawValue = state?.luckmailUsedPurchases;
  if (!rawValue || typeof rawValue !== 'object' || Array.isArray(rawValue)) {
    return {};
  }

  return Object.entries(rawValue).reduce((result, [key, value]) => {
    const numeric = Number(key);
    if (!Number.isFinite(numeric) || numeric <= 0) {
      return result;
    }
    result[String(Math.floor(numeric))] = Boolean(value);
    return result;
  }, {});
}

function normalizeLuckmailProjectName(value = '') {
  return String(value || '').trim().toLowerCase();
}

function getLuckmailPreserveTagName(state = latestState) {
  return String(state?.luckmailPreserveTagName || '').trim() || DEFAULT_LUCKMAIL_PRESERVE_TAG_NAME;
}

function formatLuckmailDateTime(value) {
  const timestamp = normalizeLuckmailTimestampValue(value);
  if (!timestamp) {
    return String(value || '').trim() || '未知';
  }
  return new Date(timestamp).toLocaleString('zh-CN', {
    hour12: false,
    timeZone: DISPLAY_TIMEZONE,
  });
}

function getMailProviderLoginConfig(provider = selectMailProvider.value) {
  return MAIL_PROVIDER_LOGIN_CONFIGS[String(provider || '').trim()] || null;
}

function getSelectedIcloudHostPreference() {
  return normalizeIcloudHost(selectIcloudHostPreference?.value || latestState?.icloudHostPreference || '')
    || normalizeIcloudHost(latestState?.preferredIcloudHost)
    || 'icloud.com';
}

function getMailProviderLoginUrl(provider = selectMailProvider.value) {
  const config = getMailProviderLoginConfig(provider);
  if (String(provider || '').trim() === ICLOUD_PROVIDER) {
    return getIcloudLoginUrlForHost(getSelectedIcloudHostPreference());
  }
  const url = String(config?.url || '').trim();
  return url ? url : '';
}

function getIpProxyServiceLoginConfig(service = selectIpProxyService?.value || latestState?.ipProxyService || DEFAULT_IP_PROXY_SERVICE) {
  return IP_PROXY_SERVICE_LOGIN_CONFIGS[String(service || '').trim()] || null;
}

function getIpProxyServiceLoginUrl(service = selectIpProxyService?.value || latestState?.ipProxyService || DEFAULT_IP_PROXY_SERVICE) {
  const config = getIpProxyServiceLoginConfig(service);
  const url = String(config?.url || '').trim();
  return url ? url : '';
}

function isCurrentEmailManagedByHotmail(state = latestState) {
  const hotmailEmail = getCurrentHotmailEmail(state);
  if (!hotmailEmail) {
    return false;
  }

  const inputEmailValue = String(inputEmail.value || '').trim();
  const stateEmailValue = String(state?.email || '').trim();
  return inputEmailValue === hotmailEmail || stateEmailValue === hotmailEmail;
}

function isCurrentEmailManagedByLuckmail(state = latestState) {
  const luckmailEmail = getCurrentLuckmailEmail(state);
  if (!luckmailEmail) {
    return false;
  }

  const inputEmailValue = String(inputEmail.value || '').trim();
  const stateEmailValue = String(state?.email || '').trim();
  return inputEmailValue === luckmailEmail || stateEmailValue === luckmailEmail;
}

function isCurrentEmailManagedByGeneratedAlias(
  provider = latestState?.mailProvider,
  state = latestState,
  mail2925Mode = latestState?.mail2925Mode
) {
  const normalizedProvider = String(provider || '').trim();
  if (!usesGeneratedAliasMailProvider(normalizedProvider, mail2925Mode)) {
    return false;
  }

  const inputEmailValue = String(inputEmail.value || '').trim().toLowerCase();
  const stateEmailValue = String(state?.email || '').trim().toLowerCase();
  const baseEmail = getManagedAliasBaseEmailForProvider(normalizedProvider, state);
  return isManagedAliasEmail(inputEmailValue, baseEmail, normalizedProvider)
    || isManagedAliasEmail(stateEmailValue, baseEmail, normalizedProvider);
}

async function maybeClearGeneratedAliasAfterEmailPrefixChange() {
  const provider = selectMailProvider.value;
  if (!usesGeneratedAliasMailProvider(provider, latestState?.mail2925Mode)) {
    return;
  }

  const previousPrefix = getManagedAliasBaseEmailForProvider(provider, latestState);
  const nextPrefix = inputEmailPrefix.value.trim();
  if (previousPrefix === nextPrefix) {
    return;
  }

  if (!previousPrefix) {
    return;
  }

  if (!isCurrentEmailManagedByGeneratedAlias(provider, latestState, latestState?.mail2925Mode)) {
    return;
  }

  await clearRegistrationEmail({ silent: true });
}

function updateMailLoginButtonState() {
  if (!btnMailLogin) {
    return;
  }

  const config = getMailProviderLoginConfig();
  const loginUrl = getMailProviderLoginUrl();
  btnMailLogin.disabled = !loginUrl;
  btnMailLogin.textContent = config?.buttonLabel || '登录';
  btnMailLogin.title = loginUrl ? `打开 ${config.label} 登录页` : '当前邮箱服务没有可跳转的登录页';
}

function updateIpProxyServiceLoginButtonState(options = {}) {
  if (!btnIpProxyServiceLogin) {
    return;
  }
  const service = normalizeIpProxyService(
    options?.service
    || selectIpProxyService?.value
    || latestState?.ipProxyService
    || DEFAULT_IP_PROXY_SERVICE
  );
  const loginConfig = getIpProxyServiceLoginConfig(service);
  const loginUrl = getIpProxyServiceLoginUrl(service);
  const enabled = options?.enabled !== undefined
    ? Boolean(options.enabled)
    : Boolean(getSelectedIpProxyEnabled());
  btnIpProxyServiceLogin.disabled = !enabled || !loginUrl;
  const buttonLabel = loginConfig?.buttonLabel || '登录';
  btnIpProxyServiceLogin.textContent = buttonLabel;
  btnIpProxyServiceLogin.title = loginUrl
    ? `打开 ${loginConfig?.label || service} ${buttonLabel}页`
    : '当前代理服务没有可跳转的登录页';
}

function updateMailProviderUI() {
  const normalizeIcloudHostValue = typeof normalizeIcloudHost === 'function'
    ? normalizeIcloudHost
    : ((value) => {
      const normalized = String(value || '').trim().toLowerCase();
      return normalized === 'icloud.com' || normalized === 'icloud.com.cn' ? normalized : '';
    });
  const icloudTargetMailboxTypeValue = typeof selectIcloudTargetMailboxType !== 'undefined'
    ? selectIcloudTargetMailboxType?.value
    : latestState?.icloudTargetMailboxType;
  const icloudForwardMailProviderValue = typeof selectIcloudForwardMailProvider !== 'undefined'
    ? selectIcloudForwardMailProvider?.value
    : latestState?.icloudForwardMailProvider;
  const icloudHostPreferenceValue = typeof selectIcloudHostPreference !== 'undefined'
    ? selectIcloudHostPreference?.value
    : latestState?.icloudHostPreference;
  const use2925 = selectMailProvider.value === '2925';
  const useGmail = selectMailProvider.value === GMAIL_PROVIDER;
  const useMail2925 = selectMailProvider.value === '2925';
  const useMail2925AccountPool = useMail2925 && Boolean(inputMail2925UseAccountPool?.checked);
  const mail2925Mode = getSelectedMail2925Mode();
  const gmailAliasGenerator = typeof GMAIL_ALIAS_GENERATOR === 'string'
    ? GMAIL_ALIAS_GENERATOR
    : 'gmail-alias';
  const customEmailPoolGenerator = typeof CUSTOM_EMAIL_POOL_GENERATOR === 'string'
    ? CUSTOM_EMAIL_POOL_GENERATOR
    : 'custom-pool';
  const gmailOnlyGenerators = new Set([gmailAliasGenerator, customEmailPoolGenerator]);
  Array.from(selectEmailGenerator?.options || []).forEach((option) => {
    if (!option) return;
    if (useGmail) {
      option.hidden = !gmailOnlyGenerators.has(String(option.value || '').trim().toLowerCase());
      return;
    }
    option.hidden = String(option.value || '').trim().toLowerCase() === gmailAliasGenerator;
  });
  if (useGmail && !gmailOnlyGenerators.has(String(selectEmailGenerator.value || '').trim().toLowerCase())) {
    selectEmailGenerator.value = gmailAliasGenerator;
  }
  if (!useGmail && String(selectEmailGenerator.value || '').trim().toLowerCase() === gmailAliasGenerator) {
    selectEmailGenerator.value = 'duck';
  }
  const selectedGenerator = getSelectedEmailGenerator();
  const useGeneratedAlias = usesGeneratedAliasMailProvider(selectMailProvider.value, mail2925Mode, selectedGenerator);
  const useInbucket = selectMailProvider.value === 'inbucket';
  const useHotmail = selectMailProvider.value === 'hotmail-api';
  const useLuckmail = isLuckmailProvider();
  const useCustomEmail = isCustomMailProvider();
  const useCustomMailProviderPool = useCustomEmail && usesCustomMailProviderPool(selectMailProvider.value);
  const useIcloudProvider = isIcloudMailProvider();
  const useEmailGenerator = !useHotmail && !useLuckmail && !useCustomEmail && (!useGeneratedAlias || useGmail);
  const useCloudflareTempEmailProvider = selectMailProvider.value === 'cloudflare-temp-email';
  const useCloudMailProvider = selectMailProvider.value === 'cloudmail';
  const aliasUiCopy = useGeneratedAlias
    ? getManagedAliasProviderUiCopy(selectMailProvider.value, mail2925Mode)
    : null;
  const uiCopy = getCurrentRegistrationEmailUiCopy();
  updateMailLoginButtonState();
  if (rowMail2925Mode) {
    rowMail2925Mode.style.display = use2925 ? '' : 'none';
  }
  if (rowMail2925PoolSettings) {
    rowMail2925PoolSettings.style.display = useMail2925 ? '' : 'none';
  }
  if (typeof rowCustomMailProviderPool !== 'undefined' && rowCustomMailProviderPool) {
    rowCustomMailProviderPool.style.display = useCustomEmail ? '' : 'none';
  }
  rowEmailPrefix.style.display = useGeneratedAlias && !useMail2925AccountPool ? '' : 'none';
  const hotmailServiceMode = getSelectedHotmailServiceMode();
  rowInbucketHost.style.display = useInbucket ? '' : 'none';
  rowInbucketMailbox.style.display = useInbucket ? '' : 'none';
  const useCustomEmailPool = useEmailGenerator && selectedGenerator === customEmailPoolGenerator;
  const useCloudflare = selectedGenerator === 'cloudflare';
  const useIcloud = selectedGenerator === 'icloud';
  const useCloudflareTempEmailGenerator = selectedGenerator === 'cloudflare-temp-email';
  const useCloudMailGenerator = selectedGenerator === 'cloudmail';
  const showCloudflareDomain = useEmailGenerator && useCloudflare;
  const showCloudflareTempEmailSettings = useCloudflareTempEmailProvider || (useEmailGenerator && useCloudflareTempEmailGenerator);
  const showCloudflareTempEmailReceiveMailbox = useCloudflareTempEmailProvider && !useCloudflareTempEmailGenerator;
  const showCloudMailSettings = useCloudMailProvider || (useEmailGenerator && useCloudMailGenerator);
  const showCloudMailReceiveMailbox = useCloudMailProvider && !useCloudMailGenerator;
  const showCloudMailDomain = useEmailGenerator && useCloudMailGenerator;
  const selectedIcloudHost = typeof getSelectedIcloudHostPreference === 'function'
    ? getSelectedIcloudHostPreference()
    : (normalizeIcloudHostValue(icloudHostPreferenceValue || latestState?.icloudHostPreference || '')
      || normalizeIcloudHostValue(latestState?.preferredIcloudHost)
      || 'icloud.com');
  const icloudTargetMailboxType = normalizeIcloudTargetMailboxType(icloudTargetMailboxTypeValue);
  const isIcloudComCnHost = selectedIcloudHost === 'icloud.com.cn';
  const showIcloudTargetMailboxType = useIcloudProvider;
  const showIcloudForwardMailProvider = useIcloudProvider && icloudTargetMailboxType === 'forward-mailbox';
  const showCloudflareTempEmailRandomSubdomainToggle = useEmailGenerator && useCloudflareTempEmailGenerator;
  const showCloudflareTempEmailDomain = useEmailGenerator && useCloudflareTempEmailGenerator;
  if (rowEmailGenerator) {
    rowEmailGenerator.style.display = useEmailGenerator ? '' : 'none';
  }
  if (typeof rowCustomEmailPool !== 'undefined' && rowCustomEmailPool) {
    rowCustomEmailPool.style.display = useCustomEmailPool ? '' : 'none';
    if (useCustomEmailPool) {
      queueCustomEmailPoolRefresh();
    } else {
      resetCustomEmailPoolManager();
    }
  }
  if (cloudflareTempEmailSection) {
    cloudflareTempEmailSection.style.display = showCloudflareTempEmailSettings ? '' : 'none';
  }
  if (typeof cloudMailSection !== 'undefined' && cloudMailSection) {
    cloudMailSection.style.display = showCloudMailSettings ? '' : 'none';
  }
  if (typeof rowCloudMailBaseUrl !== 'undefined' && rowCloudMailBaseUrl) rowCloudMailBaseUrl.style.display = showCloudMailSettings ? '' : 'none';
  if (typeof rowCloudMailAdminEmail !== 'undefined' && rowCloudMailAdminEmail) rowCloudMailAdminEmail.style.display = showCloudMailSettings ? '' : 'none';
  if (typeof rowCloudMailAdminPassword !== 'undefined' && rowCloudMailAdminPassword) rowCloudMailAdminPassword.style.display = showCloudMailSettings ? '' : 'none';
  if (typeof rowCloudMailReceiveMailbox !== 'undefined' && rowCloudMailReceiveMailbox) rowCloudMailReceiveMailbox.style.display = showCloudMailReceiveMailbox ? '' : 'none';
  if (typeof rowCloudMailDomain !== 'undefined' && rowCloudMailDomain) rowCloudMailDomain.style.display = showCloudMailDomain ? '' : 'none';
  if (icloudSection) {
    const showIcloudSection = (useEmailGenerator && useIcloud) || useIcloudProvider;
    icloudSection.style.display = showIcloudSection ? '' : 'none';
    if (showIcloudSection) {
      queueIcloudAliasRefresh();
    }
    if (!showIcloudSection) {
      hideIcloudLoginHelp();
    }
  }
  if (typeof rowIcloudTargetMailboxType !== 'undefined' && rowIcloudTargetMailboxType) {
    rowIcloudTargetMailboxType.style.display = showIcloudTargetMailboxType ? '' : 'none';
  }
  if (typeof rowIcloudForwardMailProvider !== 'undefined' && rowIcloudForwardMailProvider) {
    rowIcloudForwardMailProvider.style.display = showIcloudForwardMailProvider ? '' : 'none';
  }
  rowCfDomain.style.display = showCloudflareDomain ? '' : 'none';
  const { domains } = getCloudflareDomainsFromState();
  if (showCloudflareDomain) {
    setCloudflareDomainEditMode(cloudflareDomainEditMode || domains.length === 0, { clearInput: false });
  } else {
    setCloudflareDomainEditMode(false, { clearInput: false });
  }
  rowTempEmailBaseUrl.style.display = showCloudflareTempEmailSettings ? '' : 'none';
  rowTempEmailAdminAuth.style.display = showCloudflareTempEmailSettings ? '' : 'none';
  rowTempEmailCustomAuth.style.display = showCloudflareTempEmailSettings ? '' : 'none';
  rowTempEmailReceiveMailbox.style.display = showCloudflareTempEmailReceiveMailbox ? '' : 'none';
  if (rowTempEmailRandomSubdomainToggle) {
    rowTempEmailRandomSubdomainToggle.style.display = showCloudflareTempEmailRandomSubdomainToggle ? '' : 'none';
  }
  rowTempEmailDomain.style.display = showCloudflareTempEmailDomain ? '' : 'none';
  const { domains: tempEmailDomains } = getCloudflareTempEmailDomainsFromState();
  if (showCloudflareTempEmailDomain) {
    setCloudflareTempEmailDomainEditMode(cloudflareTempEmailDomainEditMode || tempEmailDomains.length === 0, { clearInput: false });
  } else {
    setCloudflareTempEmailDomainEditMode(false, { clearInput: false });
  }

  if (hotmailSection) {
    hotmailSection.style.display = useHotmail ? '' : 'none';
  }
  if (mail2925Section) {
    mail2925Section.style.display = useMail2925AccountPool ? '' : 'none';
  }
  if (luckmailSection) {
    luckmailSection.style.display = useLuckmail ? '' : 'none';
  }
  labelEmailPrefix.textContent = '邮箱前缀';
  inputEmailPrefix.placeholder = '例如 abc';
  if (labelMail2925UseAccountPool) {
    labelMail2925UseAccountPool.style.display = useMail2925 ? '' : 'none';
  }
  syncMail2925PoolAccountOptions(latestState);
  if (selectMail2925PoolAccount) {
    selectMail2925PoolAccount.style.display = useMail2925AccountPool ? '' : 'none';
    selectMail2925PoolAccount.disabled = !useMail2925AccountPool || getMail2925Accounts().length === 0;
  }
  inputEmailPrefix.style.display = '';
  inputEmailPrefix.readOnly = false;
  selectEmailGenerator.disabled = useHotmail || useLuckmail || useCustomEmail || (useGeneratedAlias && !useGmail);
  if (useGmail) {
    labelEmailPrefix.textContent = 'Gmail 原邮箱';
    inputEmailPrefix.placeholder = '例如 yourname@gmail.com';
  }
  labelEmailPrefix.textContent = aliasUiCopy?.baseLabel || labelEmailPrefix.textContent;
  inputEmailPrefix.placeholder = aliasUiCopy?.basePlaceholder || inputEmailPrefix.placeholder;
  if (rowHotmailServiceMode) {
    rowHotmailServiceMode.style.display = useHotmail ? '' : 'none';
  }
  if (rowHotmailRemoteBaseUrl) {
    rowHotmailRemoteBaseUrl.style.display = useHotmail && hotmailServiceMode === HOTMAIL_SERVICE_MODE_REMOTE ? '' : 'none';
  }
  if (rowHotmailLocalBaseUrl) {
    rowHotmailLocalBaseUrl.style.display = useHotmail && hotmailServiceMode === HOTMAIL_SERVICE_MODE_LOCAL ? '' : 'none';
  }
  btnFetchEmail.hidden = useHotmail || useLuckmail || useCustomEmail || useCustomEmailPool;
  inputEmail.readOnly = useHotmail || useLuckmail;
  inputEmail.placeholder = useHotmail
    ? '由 Hotmail 账号池自动分配'
    : (useLuckmail
      ? '步骤 3 自动购买 LuckMail 邮箱并回填'
      : (useGeneratedAlias ? '步骤 3 自动生成 2925 邮箱并回填' : uiCopy.placeholder));
  if (useGmail && useGeneratedAlias) {
    inputEmail.placeholder = '步骤 3 自动生成 Gmail +tag 邮箱并回填';
  }
  if (!useHotmail && !useLuckmail) {
    inputEmail.placeholder = uiCopy.placeholder;
  }
  if (useCustomEmail && useCustomMailProviderPool) {
    inputEmail.placeholder = '号池会按顺序自动回填当前轮邮箱，也可以手动覆盖';
  }
  btnFetchEmail.disabled = useLuckmail || useCustomEmail || useCustomEmailPool || isAutoRunLockedPhase();
  if (!btnFetchEmail.disabled) {
    btnFetchEmail.textContent = uiCopy.buttonLabel;
  }
  if (autoHintText) {
    autoHintText.textContent = useHotmail
      ? '请先校验并选择一个 Hotmail 账号'
      : (useLuckmail
        ? '步骤 3 会自动购买 LuckMail 邮箱并用于收码'
        : (useGeneratedAlias
          ? '步骤 3 会自动生成邮箱，无需手动获取'
          : (useCustomEmail ? '请先填写自定义注册邮箱，成功一轮后会自动清空' : `先自动获取${uiCopy.label}，或手动粘贴邮箱后再继续`)));
  }
  if (autoHintText && useCustomEmailPool) {
    autoHintText.textContent = getCustomEmailPoolSize() > 0
      ? `当前邮箱池共 ${getCustomEmailPoolSize()} 个邮箱，自动轮数会跟随数量；实际收码仍走当前邮箱服务`
      : '请先在邮箱池里每行填写一个邮箱，自动轮数会跟随数量';
  }
  if (autoHintText && useCustomEmail && useCustomMailProviderPool) {
    autoHintText.textContent = `当前自定义号池共 ${getCustomMailProviderPoolSize()} 个邮箱，自动轮数会跟随数量；第 4/8 步仍需手动输入验证码`;
  }
  if (autoHintText && useGmail && useGeneratedAlias) {
    autoHintText.textContent = '请先填写 Gmail 原邮箱，步骤 3 会自动生成 Gmail +tag 地址';
  }
  if (autoHintText && useGeneratedAlias && aliasUiCopy?.hint) {
    autoHintText.textContent = aliasUiCopy.hint;
  }
  if (autoHintText && useMail2925AccountPool && !useCustomEmailPool) {
    autoHintText.textContent = getMail2925Accounts().length
      ? (useGeneratedAlias
        ? '当前已启用 2925 号池模式，步骤 3 会基于下拉框选中的号池邮箱生成别名地址'
        : '当前已启用 2925 号池模式，步骤 4 / 8 遇到登录页时会优先使用下拉框选中的账号自动登录')
      : '当前已启用 2925 号池模式，请先在下方 2925 账号池中添加账号并选择邮箱';
  }
  if (autoHintText && showCloudflareTempEmailReceiveMailbox && !useCustomEmailPool) {
    autoHintText.textContent = '若注册邮箱会转发到 Cloudflare Temp Email，请在“邮件接收”中填写实际接收转发邮件的邮箱。';
  }
  if (autoHintText && showCloudflareTempEmailRandomSubdomainToggle && inputTempEmailUseRandomSubdomain?.checked) {
    autoHintText.textContent = '已启用随机子域名：扩展会按当前选中的 Temp 域名提交，并额外携带 enableRandomSubdomain；是否生效取决于后端 RANDOM_SUBDOMAIN_DOMAINS 配置。';
  }
  if (autoHintText && useIcloudProvider && showIcloudForwardMailProvider) {
    const forwardProvider = normalizeIcloudForwardMailProvider(icloudForwardMailProviderValue);
    const forwardProviderLabel = ICLOUD_FORWARD_MAIL_PROVIDER_LABELS[forwardProvider]
      || MAIL_PROVIDER_LOGIN_CONFIGS[forwardProvider]?.label
      || '目标邮箱';
    autoHintText.textContent = `iCloud ${isIcloudComCnHost ? 'com.cn' : ''} 当前使用转发收码：第 4/8 步会从 ${forwardProviderLabel} 轮询验证码。`;
  }
  if (useHotmail) {
    inputEmail.value = getCurrentHotmailEmail();
  } else if (useLuckmail) {
    inputEmail.value = getCurrentLuckmailEmail();
  }
  if (useCustomEmailPool) {
    syncRunCountFromCustomEmailPool();
    if (typeof queueCustomEmailPoolRefresh === 'function') {
      queueCustomEmailPoolRefresh();
    }
  }
  if (useCustomMailProviderPool) {
    syncRunCountFromCustomMailProviderPool();
  }
  if (typeof inputRunCount !== 'undefined' && inputRunCount) {
    inputRunCount.disabled = currentAutoRun.autoRunning || shouldLockRunCountToEmailPool();
  }
  renderHotmailAccounts();
  if (useMail2925) {
    renderMail2925Accounts();
  }
  if (useLuckmail) {
    renderLuckmailPurchases();
  }
}

async function saveCloudflareDomainSettings(domains, activeDomain, options = {}) {
  const { silent = false } = options;
  const normalizedDomains = normalizeCloudflareDomains(domains);
  const normalizedActiveDomain = normalizeCloudflareDomainValue(activeDomain) || normalizedDomains[0] || '';
  const payload = {
    cloudflareDomain: normalizedActiveDomain,
    cloudflareDomains: normalizedDomains,
  };

  const response = await chrome.runtime.sendMessage({
    type: 'SAVE_SETTING',
    source: 'sidepanel',
    payload,
  });

  if (response?.error) {
    throw new Error(response.error);
  }

  syncLatestState({
    ...payload,
  });
  renderCloudflareDomainOptions(normalizedActiveDomain);
  setCloudflareDomainEditMode(false, { clearInput: true });
  markSettingsDirty(false);
  updateMailProviderUI();

  if (!silent) {
    showToast('Cloudflare 域名已保存', 'success', 1800);
  }
}

async function saveCloudflareTempEmailDomainSettings(domains, activeDomain, options = {}) {
  const { silent = false } = options;
  const normalizedDomains = normalizeCloudflareTempEmailDomains(domains);
  const normalizedActiveDomain = normalizeCloudflareTempEmailDomainValue(activeDomain) || normalizedDomains[0] || '';
  const payload = {
    cloudflareTempEmailDomain: normalizedActiveDomain,
    cloudflareTempEmailDomains: normalizedDomains,
  };

  const response = await chrome.runtime.sendMessage({
    type: 'SAVE_SETTING',
    source: 'sidepanel',
    payload,
  });

  if (response?.error) {
    throw new Error(response.error);
  }

  syncLatestState({
    ...payload,
  });
  renderCloudflareTempEmailDomainOptions(normalizedActiveDomain);
  setCloudflareTempEmailDomainEditMode(false, { clearInput: true });
  markSettingsDirty(false);
  updateMailProviderUI();

  if (!silent) {
    showToast('Cloudflare Temp Email 域名已保存', 'success', 1800);
  }
}

async function handleDeleteCloudflareDomain(domain) {
  const targetDomain = normalizeCloudflareDomainValue(domain);
  if (!targetDomain) {
    return;
  }

  const { domains, activeDomain } = getCloudflareDomainsFromState();
  const nextDomains = domains.filter((item) => item !== targetDomain);
  if (nextDomains.length === domains.length) {
    return;
  }

  const currentDomain = normalizeCloudflareDomainValue(selectCfDomain.value || activeDomain);
  const nextActiveDomain = currentDomain === targetDomain
    ? (nextDomains[0] || '')
    : (nextDomains.includes(currentDomain) ? currentDomain : nextDomains[0] || '');
  await saveCloudflareDomainSettings(nextDomains, nextActiveDomain, { silent: true });
  showToast(`已删除 Cloudflare 域名：${targetDomain}`, 'success', 1600);
}

async function handleDeleteCloudflareTempEmailDomain(domain) {
  const targetDomain = normalizeCloudflareTempEmailDomainValue(domain);
  if (!targetDomain) {
    return;
  }

  const { domains, activeDomain } = getCloudflareTempEmailDomainsFromState();
  const nextDomains = domains.filter((item) => item !== targetDomain);
  if (nextDomains.length === domains.length) {
    return;
  }

  const currentDomain = normalizeCloudflareTempEmailDomainValue(selectTempEmailDomain.value || activeDomain);
  const nextActiveDomain = currentDomain === targetDomain
    ? (nextDomains[0] || '')
    : (nextDomains.includes(currentDomain) ? currentDomain : nextDomains[0] || '');
  await saveCloudflareTempEmailDomainSettings(nextDomains, nextActiveDomain, { silent: true });
  showToast(`已删除 Cloudflare Temp Email 域名：${targetDomain}`, 'success', 1600);
}

async function handleAddSub2ApiGroup() {
  if (!sharedFormDialog?.open) {
    showToast('表单弹窗未加载，请刷新扩展后重试。', 'error');
    return;
  }

  const result = await sharedFormDialog.open({
    title: '添加 SUB2API 分组',
    confirmLabel: '添加',
    confirmVariant: 'btn-primary',
    fields: [
      {
        key: 'groupName',
        label: '分组',
        type: 'text',
        placeholder: '例如 openai-plus',
        autocomplete: 'off',
        required: true,
        requiredMessage: '请先填写 SUB2API 分组名称。',
        validate: (value) => {
          const names = normalizeSub2ApiGroupOptions(value);
          return names.length ? '' : '请先填写 SUB2API 分组名称。';
        },
      },
    ],
  });
  if (!result) {
    return;
  }

  const newGroups = normalizeSub2ApiGroupOptions(result.groupName);
  if (!newGroups.length) {
    return;
  }

  const selectedGroup = newGroups[0];
  const nextGroups = normalizeSub2ApiGroupOptions(
    getSub2ApiGroupOptionsState(latestState),
    newGroups
  );
  syncLatestState({
    sub2apiGroupName: selectedGroup,
    sub2apiGroupNames: nextGroups,
  });
  renderSub2ApiGroupOptions(latestState, selectedGroup);
  markSettingsDirty(true);
  await saveSettings({ silent: true }).catch(() => { });
  showToast(`已添加并切换到 SUB2API 分组：${selectedGroup}`, 'success', 1800);
}

async function handleDeleteSub2ApiGroup(groupName) {
  const targetName = String(groupName || '').trim();
  if (!targetName) {
    return;
  }

  const currentGroups = getSub2ApiGroupOptionsState(latestState);
  if (currentGroups.length <= 1) {
    showToast('至少保留一个 SUB2API 分组。', 'warn', 1800);
    return;
  }

  const targetKey = targetName.toLowerCase();
  const nextGroups = currentGroups.filter((name) => name.toLowerCase() !== targetKey);
  if (nextGroups.length === currentGroups.length) {
    return;
  }

  const currentGroup = getSelectedSub2ApiGroupName();
  const nextSelectedGroup = currentGroup.toLowerCase() === targetKey
    ? nextGroups[0]
    : (nextGroups.find((name) => name.toLowerCase() === currentGroup.toLowerCase()) || nextGroups[0]);

  syncLatestState({
    sub2apiGroupName: nextSelectedGroup,
    sub2apiGroupNames: nextGroups,
  });
  renderSub2ApiGroupOptions(latestState, nextSelectedGroup);
  sub2ApiGroupPicker.setOpen(true);
  markSettingsDirty(true);
  await saveSettings({ silent: true }).catch(() => { });
  showToast(`已删除 SUB2API 分组：${targetName}`, 'success', 1600);
}

function updatePanelModeUI() {
  const panelMode = getSelectedPanelMode();
  if (selectPanelMode) {
    selectPanelMode.value = panelMode;
  }
  const useSub2Api = panelMode === 'sub2api';
  const useCodex2Api = panelMode === 'codex2api';
  const useCpa = !useSub2Api && !useCodex2Api;
  rowVpsUrl.style.display = useCpa ? '' : 'none';
  rowVpsPassword.style.display = useCpa ? '' : 'none';
  rowLocalCpaStep9Mode.style.display = useCpa ? '' : 'none';
  rowSub2ApiUrl.style.display = useSub2Api ? '' : 'none';
  rowSub2ApiEmail.style.display = useSub2Api ? '' : 'none';
  rowSub2ApiPassword.style.display = useSub2Api ? '' : 'none';
  rowSub2ApiGroup.style.display = useSub2Api ? '' : 'none';
  rowSub2ApiAccountPriority.style.display = useSub2Api ? '' : 'none';
  rowSub2ApiDefaultProxy.style.display = useSub2Api ? '' : 'none';
  rowCodex2ApiUrl.style.display = useCodex2Api ? '' : 'none';
  rowCodex2ApiAdminKey.style.display = useCodex2Api ? '' : 'none';

  const step9Btn = document.querySelector('.step-btn[data-step-key="platform-verify"]');
  if (step9Btn) {
    step9Btn.textContent = useSub2Api
      ? 'SUB2API 回调验证'
      : (useCodex2Api ? 'Codex2API 回调验证' : 'CPA 回调验证');
  }
}

// ============================================================
// UI Updates
// ============================================================

function updateStepUI(step, status) {
  syncLatestState({
    stepStatuses: {
      ...getStepStatuses(),
      [step]: status,
    },
  });

  renderSingleStepStatus(step, status);
  updateButtonStates();
  updateProgressCounter();
  updateConfigMenuControls();
}

function renderSingleStepStatus(step, status) {
  const normalizedStatus = status || 'pending';
  const statusEl = document.querySelector(`.step-status[data-step="${step}"]`);
  const row = document.querySelector(`.step-row[data-step="${step}"]`);

  if (statusEl) statusEl.textContent = STATUS_ICONS[normalizedStatus] || '';
  if (row) {
    row.className = `step-row ${normalizedStatus}`;
  }
}

function renderStepStatuses(state = latestState) {
  const statuses = getStepStatuses(state);
  for (const step of STEP_IDS) {
    renderSingleStepStatus(step, statuses[step]);
  }
  updateProgressCounter();
}

function updateProgressCounter() {
  const completed = Object.values(getStepStatuses()).filter(isDoneStatus).length;
  stepsProgress.textContent = `${completed} / ${STEP_IDS.length}`;
}

function updateButtonStates() {
  const statuses = getStepStatuses();
  const anyRunning = Object.values(statuses).some(s => s === 'running');
  const autoLocked = isAutoRunLockedPhase();
  const autoScheduled = isAutoRunScheduledPhase();
  const icloudTargetMailboxTypeValue = typeof selectIcloudTargetMailboxType !== 'undefined'
    ? selectIcloudTargetMailboxType?.value
    : latestState?.icloudTargetMailboxType;

  for (const step of STEP_IDS) {
    const btn = document.querySelector(`.step-btn[data-step="${step}"]`);
    if (!btn) continue;

    if (anyRunning || autoLocked || autoScheduled) {
      btn.disabled = true;
    } else if (step === 1) {
      btn.disabled = false;
    } else {
      const currentIndex = STEP_IDS.indexOf(step);
      const prevStep = currentIndex > 0 ? STEP_IDS[currentIndex - 1] : null;
      const prevStatus = prevStep === null ? 'completed' : statuses[prevStep];
      const currentStatus = statuses[step];
      btn.disabled = !(isDoneStatus(prevStatus) || currentStatus === 'failed' || isDoneStatus(currentStatus) || currentStatus === 'stopped');
    }
  }

  document.querySelectorAll('.step-manual-btn').forEach((btn) => {
    const step = Number(btn.dataset.step);
    const currentStatus = statuses[step];
    const currentIndex = STEP_IDS.indexOf(step);
    const prevStep = currentIndex > 0 ? STEP_IDS[currentIndex - 1] : null;
    const prevStatus = prevStep === null ? 'completed' : statuses[prevStep];

    if (!SKIPPABLE_STEPS.has(step) || anyRunning || autoLocked || autoScheduled || currentStatus === 'running' || isDoneStatus(currentStatus)) {
      btn.style.display = 'none';
      btn.disabled = true;
      btn.title = '当前不可跳过';
      return;
    }

    if (prevStep !== null && !isDoneStatus(prevStatus)) {
      btn.style.display = 'none';
      btn.disabled = true;
      btn.title = `请先完成步骤 ${prevStep}`;
      return;
    }

    btn.style.display = '';
    btn.disabled = false;
    btn.title = `跳过步骤 ${step}`;
  });

  btnReset.disabled = anyRunning || autoScheduled || isAutoRunPausedPhase() || autoLocked;
  const disableIcloudControls = anyRunning || autoScheduled || autoLocked;
  if (btnIcloudRefresh) btnIcloudRefresh.disabled = disableIcloudControls;
  if (btnIcloudDeleteUsed) btnIcloudDeleteUsed.disabled = disableIcloudControls || !hasDeletableUsedIcloudAliases();
  if (selectIcloudHostPreference) selectIcloudHostPreference.disabled = disableIcloudControls;
  if (typeof selectIcloudTargetMailboxType !== 'undefined' && selectIcloudTargetMailboxType) {
    selectIcloudTargetMailboxType.disabled = disableIcloudControls;
  }
  if (typeof selectIcloudForwardMailProvider !== 'undefined' && selectIcloudForwardMailProvider) {
    const normalizedIcloudTargetMailboxType = normalizeIcloudTargetMailboxType(icloudTargetMailboxTypeValue);
    const allowIcloudForwardMailProvider = isIcloudMailProvider()
      && normalizedIcloudTargetMailboxType === 'forward-mailbox';
    selectIcloudForwardMailProvider.disabled = disableIcloudControls || !allowIcloudForwardMailProvider;
  }
  if (selectIcloudFetchMode) {
    const allowIcloudFetchMode = getSelectedEmailGenerator() === ICLOUD_PROVIDER
      && !isCustomMailProvider()
      && !isManagedAliasProvider();
    selectIcloudFetchMode.disabled = disableIcloudControls || !allowIcloudFetchMode;
  }
  if (checkboxAutoDeleteIcloud) checkboxAutoDeleteIcloud.disabled = disableIcloudControls;
  if (btnContributionMode) btnContributionMode.disabled = isContributionButtonLocked();
  updateStopButtonState(anyRunning || autoScheduled || isAutoRunPausedPhase() || autoLocked);
  renderContributionMode();
}

function updateStopButtonState(active) {
  btnStop.disabled = !active;
}

function updateStatusDisplay(state) {
  if (!state || !state.stepStatuses) return;

  statusBar.className = 'status-bar';

  const countdown = getActiveAutoRunCountdown();
  if (countdown) {
    const remainingMs = countdown.at - Date.now();
    displayStatus.textContent = remainingMs > 0
      ? `${countdown.title}，剩余 ${formatCountdown(remainingMs)}`
      : `${countdown.title}，即将结束...`;
    statusBar.classList.add(countdown.tone === 'scheduled' ? 'scheduled' : 'running');
    return;
  }

  if (isAutoRunScheduledPhase()) {
    const remainingMs = Number.isFinite(currentAutoRun.scheduledAt)
      ? currentAutoRun.scheduledAt - Date.now()
      : 0;
    displayStatus.textContent = remainingMs > 0
      ? `自动计划中，剩余 ${formatCountdown(remainingMs)}`
      : '倒计时即将结束，正在准备启动...';
    statusBar.classList.add('scheduled');
    return;
  }

  if (isAutoRunPausedPhase()) {
    displayStatus.textContent = `自动已暂停${getAutoRunLabel()}，等待邮箱后继续`;
    statusBar.classList.add('paused');
    return;
  }

  if (isAutoRunWaitingStepPhase()) {
    const runningSteps = getRunningSteps(state);
    displayStatus.textContent = runningSteps.length
      ? `自动等待步骤 ${runningSteps.join(', ')} 完成后继续${getAutoRunLabel()}`
      : `自动正在按最新进度准备继续${getAutoRunLabel()}`;
    statusBar.classList.add('running');
    return;
  }

  const running = Object.entries(state.stepStatuses).find(([, s]) => s === 'running');
  if (running) {
    displayStatus.textContent = `步骤 ${running[0]} 运行中...`;
    statusBar.classList.add('running');
    return;
  }

  if (isAutoRunLockedPhase()) {
    displayStatus.textContent = `${currentAutoRun.phase === 'retrying' ? '自动重试中' : '自动运行中'}${getAutoRunLabel()}`;
    statusBar.classList.add('running');
    return;
  }

  const failed = Object.entries(state.stepStatuses).find(([, s]) => s === 'failed');
  if (failed) {
    displayStatus.textContent = `步骤 ${failed[0]} 失败`;
    statusBar.classList.add('failed');
    return;
  }

  const stopped = Object.entries(state.stepStatuses).find(([, s]) => s === 'stopped');
  if (stopped) {
    displayStatus.textContent = `步骤 ${stopped[0]} 已停止`;
    statusBar.classList.add('stopped');
    return;
  }

  const lastCompleted = Object.entries(state.stepStatuses)
    .filter(([, s]) => isDoneStatus(s))
    .map(([k]) => Number(k))
    .sort((a, b) => b - a)[0];

  if (lastCompleted === STEP_IDS[STEP_IDS.length - 1]) {
    displayStatus.textContent = (state.stepStatuses[lastCompleted] === 'manual_completed' || state.stepStatuses[lastCompleted] === 'skipped') ? '全部步骤已跳过/完成' : '全部步骤已完成';
    statusBar.classList.add('completed');
  } else if (lastCompleted) {
    displayStatus.textContent = (state.stepStatuses[lastCompleted] === 'manual_completed' || state.stepStatuses[lastCompleted] === 'skipped')
      ? `步骤 ${lastCompleted} 已跳过`
      : `步骤 ${lastCompleted} 已完成`;
  } else {
    displayStatus.textContent = '就绪';
  }
}

function appendLog(entry) {
  const time = new Date(entry.timestamp).toLocaleTimeString('zh-CN', {
    hour12: false,
    timeZone: DISPLAY_TIMEZONE,
  });
  const levelLabel = LOG_LEVEL_LABELS[entry.level] || entry.level;
  const line = document.createElement('div');
  line.className = `log-line log-${entry.level}`;

  const normalizedStep = Math.floor(Number(entry.step) || 0);
  const stepNum = normalizedStep > 0 ? String(normalizedStep) : null;

  let html = `<span class="log-time">${time}</span> `;
  html += `<span class="log-level log-level-${entry.level}">${levelLabel}</span> `;
  if (stepNum) {
    html += `<span class="log-step-tag step-${stepNum}">步${stepNum}</span>`;
  }
  html += `<span class="log-msg">${escapeHtml(entry.message)}</span>`;

  line.innerHTML = html;
  logArea.appendChild(line);
  logArea.scrollTop = logArea.scrollHeight;
}

function escapeHtml(text) {
  const div = document.createElement('div');
  div.textContent = text;
  return div.innerHTML;
}

async function fetchGeneratedEmail(options = {}) {
  const { showFailureToast = true } = options;
  const uiCopy = getCurrentRegistrationEmailUiCopy();
  if (isCustomMailProvider()) {
    throw new Error('当前邮箱服务为自定义邮箱，请直接填写注册邮箱。');
  }
  const defaultLabel = uiCopy.buttonLabel;
  btnFetchEmail.disabled = true;
  btnFetchEmail.textContent = '...';

  try {
    const response = await chrome.runtime.sendMessage({
      type: 'FETCH_GENERATED_EMAIL',
      source: 'sidepanel',
      payload: {
        generateNew: true,
        generator: selectEmailGenerator.value,
        mailProvider: selectMailProvider.value,
        mail2925Mode: getSelectedMail2925Mode(),
        ...(getSelectedEmailGenerator() === CUSTOM_EMAIL_POOL_GENERATOR
          ? {
              customEmailPool: getActiveCustomEmailPoolEmails(),
            }
          : {}),
        ...buildManagedAliasBaseEmailPayload(),
      },
    });

    if (response?.error) {
      throw new Error(response.error);
    }
    if (!response?.email) {
      throw new Error('未返回可用邮箱。');
    }

    inputEmail.value = response.email;
    if (getSelectedEmailGenerator() === 'icloud') {
      queueIcloudAliasRefresh();
    }
    showToast(`已${uiCopy.successVerb} ${uiCopy.label}：${response.email}`, 'success', 2500);
    return response.email;
  } catch (err) {
    if (showFailureToast) {
      showToast(`${uiCopy.label}${uiCopy.successVerb}失败：${err.message}`, 'error');
    }
    throw err;
  } finally {
    btnFetchEmail.disabled = false;
    btnFetchEmail.textContent = defaultLabel;
  }
}

function syncToggleButtonLabel(button, input, labels) {
  if (!button || !input) return;

  const isHidden = input.type === 'password';
  button.innerHTML = isHidden ? EYE_OPEN_ICON : EYE_CLOSED_ICON;
  button.setAttribute('aria-label', isHidden ? labels.show : labels.hide);
  button.title = isHidden ? labels.show : labels.hide;
}

function getPasswordToggleLabels(button) {
  if (!button) {
    return {
      show: '\u663e\u793a\u5185\u5bb9',
      hide: '\u9690\u85cf\u5185\u5bb9',
    };
  }
  const show = button.dataset?.showLabel
    || button.getAttribute('aria-label')
    || button.title
    || '\u663e\u793a\u5185\u5bb9';
  const hide = button.dataset?.hideLabel
    || String(show).replace(/^\u663e\u793a/, '\u9690\u85cf')
    || '\u9690\u85cf\u5185\u5bb9';
  return { show, hide };
}

function syncPasswordVisibilityToggle(button) {
  const targetId = String(button?.dataset?.passwordToggle || '').trim();
  const input = targetId ? document.getElementById(targetId) : null;
  if (!button || !input) return;
  syncToggleButtonLabel(button, input, getPasswordToggleLabels(button));
}

function syncPasswordVisibilityToggles(root = document) {
  root.querySelectorAll?.('[data-password-toggle]').forEach(syncPasswordVisibilityToggle);
}

function bindPasswordVisibilityToggles(root = document) {
  root.querySelectorAll?.('[data-password-toggle]').forEach((button) => {
    if (button.dataset?.passwordToggleBound === 'true') {
      syncPasswordVisibilityToggle(button);
      return;
    }
    if (button.dataset) {
      button.dataset.passwordToggleBound = 'true';
    }
    syncPasswordVisibilityToggle(button);
    button.addEventListener('click', () => {
      const targetId = String(button.dataset?.passwordToggle || '').trim();
      const input = targetId ? document.getElementById(targetId) : null;
      if (!input) return;
      input.type = input.type === 'password' ? 'text' : 'password';
      syncPasswordVisibilityToggle(button);
    });
  });
}

async function copyTextToClipboard(text) {
  const value = String(text || '').trim();
  if (!value) {
    throw new Error('没有可复制的内容。');
  }
  if (!navigator.clipboard?.writeText) {
    throw new Error('当前环境不支持剪贴板复制。');
  }
  await navigator.clipboard.writeText(value);
}

const hotmailManager = window.SidepanelHotmailManager?.createHotmailManager({
  state: {
    getLatestState: () => latestState,
    syncLatestState,
  },
  dom: {
    btnAddHotmailAccount,
    btnClearUsedHotmailAccounts,
    btnDeleteAllHotmailAccounts,
    btnHotmailUsageGuide,
    btnImportHotmailAccounts,
    btnToggleHotmailForm,
    btnToggleHotmailList,
    hotmailFormShell,
    hotmailAccountsList,
    hotmailListShell,
    inputEmail,
    inputHotmailClientId,
    inputHotmailEmail,
    inputHotmailImport,
    inputHotmailPassword,
    inputHotmailRefreshToken,
    inputHotmailSearch,
    selectHotmailFilter,
    selectMailProvider,
  },
  helpers: {
    copyTextToClipboard,
    escapeHtml,
    getCurrentHotmailEmail,
    getHotmailAccounts,
    openConfirmModal,
    showToast,
  },
  runtime: {
    sendMessage: (message) => chrome.runtime.sendMessage(message),
  },
  constants: {
    copyIcon: COPY_ICON,
    displayTimeZone: DISPLAY_TIMEZONE,
    expandedStorageKey: 'multipage-hotmail-list-expanded',
  },
  hotmailUtils: {
    filterHotmailAccountsByUsage,
    getHotmailBulkActionLabel,
    getHotmailListToggleLabel,
    parseHotmailImportText,
    shouldClearHotmailCurrentSelection,
    upsertHotmailAccountInList,
  },
});
const initHotmailListExpandedState = hotmailManager?.initHotmailListExpandedState
  || (() => { });
const renderHotmailAccounts = hotmailManager?.renderHotmailAccounts
  || (() => { });
const bindHotmailEvents = hotmailManager?.bindHotmailEvents
  || (() => { });
bindHotmailEvents();

const payPalManager = window.SidepanelPayPalManager?.createPayPalManager({
  state: {
    getLatestState: () => latestState,
    syncLatestState,
  },
  dom: {
    btnAddPayPalAccount,
    btnPayPalAccountMenu,
    payPalAccountCurrent,
    payPalAccountMenu,
    payPalAccountPickerRoot,
    selectPayPalAccount,
  },
  helpers: {
    editableListPicker: editableListPickerModule,
    escapeHtml,
    getPayPalAccounts,
    openFormDialog: (options) => {
      if (!sharedFormDialog?.open) {
        throw new Error('表单弹窗能力未加载，请刷新扩展后重试。');
      }
      return sharedFormDialog.open(options);
    },
    showToast,
  },
  runtime: {
    sendMessage: (message) => chrome.runtime.sendMessage(message),
  },
  paypalUtils: {
    upsertPayPalAccountInList,
  },
});
const renderPayPalAccounts = payPalManager?.renderPayPalAccounts
  || (() => { });
const bindPayPalEvents = payPalManager?.bindPayPalEvents
  || (() => { });
bindPayPalEvents();

const mail2925Manager = window.SidepanelMail2925Manager?.createMail2925Manager({
  state: {
    getLatestState: () => latestState,
    syncLatestState,
  },
  dom: {
    btnAddMail2925Account,
    btnDeleteAllMail2925Accounts,
    btnImportMail2925Accounts,
    btnToggleMail2925Form,
    btnToggleMail2925List,
    inputMail2925Email,
    inputMail2925Import,
    inputMail2925Password,
    inputMail2925Search,
    selectMail2925Filter,
    mail2925AccountsList,
    mail2925FormShell,
    mail2925ListShell,
  },
  helpers: {
    copyTextToClipboard,
    escapeHtml,
    getMail2925Accounts,
    openConfirmModal,
    refreshManagedAliasBaseEmail: () => {
      syncMail2925BaseEmailFromCurrentAccount(latestState, { persist: true });
      setManagedAliasBaseEmailInputForProvider('2925', latestState);
    },
    showToast,
  },
  runtime: {
    sendMessage: (message) => chrome.runtime.sendMessage(message),
  },
  constants: {
    copyIcon: COPY_ICON,
    displayTimeZone: DISPLAY_TIMEZONE,
    expandedStorageKey: 'multipage-mail2925-list-expanded',
  },
  mail2925Utils: window.Mail2925Utils || {},
});
const initMail2925ListExpandedState = mail2925Manager?.initMail2925ListExpandedState
  || (() => { });
const renderMail2925Accounts = mail2925Manager?.renderMail2925Accounts
  || (() => { });
const bindMail2925Events = mail2925Manager?.bindMail2925Events
  || (() => { });
bindMail2925Events();

const icloudManager = window.SidepanelIcloudManager?.createIcloudManager({
  dom: {
    btnIcloudBulkDelete,
    btnIcloudBulkPreserve,
    btnIcloudBulkUnpreserve,
    btnIcloudBulkUnused,
    btnIcloudBulkUsed,
    btnIcloudDeleteUsed,
    btnIcloudLoginDone,
    btnIcloudRefresh,
    checkboxIcloudSelectAll,
    icloudList,
    icloudLoginHelp,
    icloudLoginHelpText,
    icloudLoginHelpTitle,
    icloudSection,
    icloudSelectionSummary,
    icloudSummary,
    inputIcloudSearch,
    selectIcloudFilter,
  },
  helpers: {
    copyTextToClipboard,
    escapeHtml,
    openConfirmModal,
    showToast,
  },
  runtime: {
    sendMessage: (message) => chrome.runtime.sendMessage(message),
  },
});
const hideIcloudLoginHelp = icloudManager?.hideIcloudLoginHelp
  || (() => { });
const hasDeletableUsedIcloudAliases = icloudManager?.hasDeletableUsedAliases
  || (() => false);
const queueIcloudAliasRefresh = icloudManager?.queueIcloudAliasRefresh
  || (() => { });
const refreshIcloudAliases = icloudManager?.refreshIcloudAliases
  || (async () => { });
const renderIcloudAliases = icloudManager?.renderIcloudAliases
  || (() => { });
const resetIcloudManager = icloudManager?.reset
  || (() => { });
const showIcloudLoginHelp = icloudManager?.showIcloudLoginHelp
  || (() => { });
const updateIcloudBulkUI = icloudManager?.updateIcloudBulkUI
  || (() => { });
const bindIcloudEvents = icloudManager?.bindIcloudEvents
  || (() => { });
bindIcloudEvents();

const luckmailManager = window.SidepanelLuckmailManager?.createLuckmailManager({
  dom: {
    btnLuckmailBulkDisable,
    btnLuckmailBulkEnable,
    btnLuckmailBulkPreserve,
    btnLuckmailBulkUnpreserve,
    btnLuckmailBulkUnused,
    btnLuckmailBulkUsed,
    btnLuckmailDisableUsed,
    btnLuckmailRefresh,
    checkboxLuckmailSelectAll,
    inputEmail,
    inputLuckmailSearch,
    luckmailList,
    luckmailSection,
    luckmailSelectionSummary,
    luckmailSummary,
    selectLuckmailFilter,
  },
  helpers: {
    copyTextToClipboard,
    escapeHtml,
    formatLuckmailDateTime,
    getLuckmailPreserveTagName,
    normalizeLuckmailProjectName,
    openConfirmModal,
    showToast,
  },
  runtime: {
    sendMessage: (message) => chrome.runtime.sendMessage(message),
  },
  constants: {
    copyIcon: COPY_ICON,
  },
});
const queueLuckmailPurchaseRefresh = luckmailManager?.queueLuckmailPurchaseRefresh
  || (() => { });
const refreshLuckmailPurchases = luckmailManager?.refreshLuckmailPurchases
  || (async () => { });
const renderLuckmailPurchases = luckmailManager?.renderLuckmailPurchases
  || (() => { });
const resetLuckmailManager = luckmailManager?.reset
  || (() => { });
const bindLuckmailEvents = luckmailManager?.bindLuckmailEvents
  || (() => { });
bindLuckmailEvents();

const customEmailPoolManager = window.SidepanelCustomEmailPoolManager?.createCustomEmailPoolManager({
  dom: {
    btnCustomEmailPoolRefresh,
    btnCustomEmailPoolClearUsed,
    btnCustomEmailPoolDeleteAll,
    inputCustomEmailPoolImport,
    btnCustomEmailPoolImport,
    customEmailPoolSummary,
    inputCustomEmailPoolSearch,
    selectCustomEmailPoolFilter,
    checkboxCustomEmailPoolSelectAll,
    customEmailPoolSelectionSummary,
    btnCustomEmailPoolBulkUsed,
    btnCustomEmailPoolBulkUnused,
    btnCustomEmailPoolBulkEnable,
    btnCustomEmailPoolBulkDisable,
    btnCustomEmailPoolBulkDelete,
    customEmailPoolList,
  },
  helpers: {
    copyTextToClipboard,
    escapeHtml,
    openConfirmModal,
    showToast,
  },
  state: {
    getEntries: () => getNormalizedCustomEmailPoolEntriesState(),
    setEntries: (entries) => {
      setCustomEmailPoolEntriesState(entries);
    },
    getCurrentEmail: () => String(inputEmail?.value || latestState?.email || '').trim().toLowerCase(),
    isVisible: () => Boolean(rowCustomEmailPool) && rowCustomEmailPool.style.display !== 'none',
  },
  actions: {
    persistEntries: async () => {
      syncRunCountFromConfiguredEmailPool();
      updateMailProviderUI();
      markSettingsDirty(true);
      await saveSettings({ silent: true });
    },
    setRuntimeEmail: async (email) => {
      await setRuntimeEmailState(email);
      syncLatestState({ email });
      if (inputEmail) {
        inputEmail.value = email || '';
      }
    },
  },
  constants: {
    copyIcon: COPY_ICON,
  },
});
const queueCustomEmailPoolRefresh = customEmailPoolManager?.queueCustomEmailPoolRefresh
  || (() => { });
const refreshCustomEmailPoolEntries = customEmailPoolManager?.refreshCustomEmailPoolEntries
  || (async () => { });
const renderCustomEmailPoolEntries = customEmailPoolManager?.renderCustomEmailPoolEntries
  || (() => { });
const resetCustomEmailPoolManager = customEmailPoolManager?.reset
  || (() => { });
const bindCustomEmailPoolEvents = customEmailPoolManager?.bindEvents
  || (() => { });
bindCustomEmailPoolEvents();

const accountRecordsManager = window.SidepanelAccountRecordsManager?.createAccountRecordsManager({
  state: {
    getLatestState: () => latestState,
    syncLatestState,
  },
  dom: {
    accountRecordsList,
    accountRecordsMeta,
    accountRecordsOverlay,
    accountRecordsPageLabel,
    accountRecordsStats,
    btnAccountRecordsNext,
    btnAccountRecordsPrev,
    btnClearAccountRecords,
    btnDeleteSelectedAccountRecords,
    btnCloseAccountRecords,
    btnOpenAccountRecords,
    btnToggleAccountRecordsSelection,
  },
  helpers: {
    escapeHtml,
    openConfirmModal,
    showToast,
  },
  runtime: {
    sendMessage: (message) => chrome.runtime.sendMessage(message),
  },
  constants: {
    displayTimeZone: DISPLAY_TIMEZONE,
    pageSize: 10,
  },
});
const renderAccountRecords = accountRecordsManager?.render
  || (() => { });
const bindAccountRecordEvents = accountRecordsManager?.bindEvents
  || (() => { });
const closeAccountRecordsPanel = accountRecordsManager?.closePanel
  || (() => { });
bindAccountRecordEvents();
const contributionModeManager = window.SidepanelContributionMode?.createContributionModeManager({
  state: {
    getLatestState: () => latestState,
  },
  dom: {
    btnConfigMenu,
    btnContributionMode,
    inputContributionNickname,
    inputContributionQq,
    contributionCallbackStatus,
    btnExitContributionMode,
    btnOpenAccountRecords,
    btnOpenContributionUpload,
    btnStartContribution,
    contributionModeBadge,
    contributionModePanel,
    contributionModeSummary,
    contributionModeText,
    contributionOauthStatus,
    rowAccountRunHistoryHelperBaseUrl,
    rowPhoneVerificationEnabled,
    rowCustomPassword,
    rowLocalCpaStep9Mode,
    rowSub2ApiAccountPriority,
    rowSub2ApiDefaultProxy,
    rowSub2ApiEmail,
    rowSub2ApiGroup,
    rowSub2ApiPassword,
    rowSub2ApiUrl,
    rowVpsPassword,
    rowVpsUrl,
    selectPanelMode,
  },
  helpers: {
    applySettingsState,
    closeAccountRecordsPanel,
    closeConfigMenu,
    getContributionNickname: () => latestState?.email || '',
    getContributionProfile: () => ({
      nickname: String(inputContributionNickname?.value || '').trim(),
      qq: String(inputContributionQq?.value || '').trim(),
    }),
    isModeSwitchBlocked: isContributionModeSwitchBlocked,
    openConfirmModal,
    openExternalUrl,
    showToast,
    startContributionAutoRun: () => startAutoRunFromCurrentSettings(),
    updateAccountRunHistorySettingsUI,
    updateConfigMenuControls,
    updatePanelModeUI,
    updateStatusDisplay,
  },
  runtime: {
    sendMessage: (message) => chrome.runtime.sendMessage(message),
  },
  constants: {
    contributionOauthUrl: `${String(contributionContentService?.portalUrl || 'https://apikey.qzz.io').replace(/\/+$/, '')}/oauth/`,
    contributionPortalUrl: String(contributionContentService?.portalUrl || 'https://apikey.qzz.io').replace(/\/+$/, ''),
    contributionUploadUrl: `${String(contributionContentService?.portalUrl || 'https://apikey.qzz.io').replace(/\/+$/, '')}/upload`,
  },
});
const baseRenderContributionMode = contributionModeManager?.render
  || (() => { });
const renderContributionMode = () => {
  baseRenderContributionMode();
  renderContributionUpdateHint();
  updateSignupMethodUI({ notify: true });
};
const bindContributionModeEvents = contributionModeManager?.bindEvents
  || (() => { });
bindContributionModeEvents();
renderStepsList();

async function exportSettingsFile() {
  closeConfigMenu();
  configActionInFlight = true;
  updateConfigMenuControls();

  try {
    await flushPendingSettingsBeforeExport();
    const response = await chrome.runtime.sendMessage({
      type: 'EXPORT_SETTINGS',
      source: 'sidepanel',
      payload: {},
    });

    if (response?.error) {
      throw new Error(response.error);
    }
    if (!response?.fileContent || !response?.fileName) {
      throw new Error('\u672a\u751f\u6210\u53ef\u4e0b\u8f7d\u7684\u914d\u7f6e\u6587\u4ef6\u3002');
    }

    downloadTextFile(response.fileContent, response.fileName);
    showToast('\u914d\u7f6e\u5df2\u5bfc\u51fa\uff1a' + response.fileName, 'success', 2200);
  } catch (err) {
    showToast('\u5bfc\u51fa\u914d\u7f6e\u5931\u8d25\uff1a' + err.message, 'error');
  } finally {
    configActionInFlight = false;
    updateConfigMenuControls();
  }
}

async function importSettingsFromFile(file) {
  if (!file) return;

  configActionInFlight = true;
  closeConfigMenu();
  updateConfigMenuControls();

  try {
    await settlePendingSettingsBeforeImport();
    const rawText = await file.text();

    let parsedConfig = null;
    try {
      parsedConfig = JSON.parse(rawText);
    } catch {
      throw new Error('\u914d\u7f6e\u6587\u4ef6\u4e0d\u662f\u6709\u6548\u7684 JSON\u3002');
    }

    const confirmed = await openConfirmModal({
      title: '\u5bfc\u5165\u914d\u7f6e',
      message: '\u786e\u8ba4\u5bfc\u5165\u914d\u7f6e\u6587\u4ef6 "' + file.name + '" \u5417\uff1f\u5bfc\u5165\u540e\u4f1a\u8986\u76d6\u5f53\u524d\u914d\u7f6e\u3002',
      confirmLabel: '\u786e\u8ba4\u8986\u76d6\u5bfc\u5165',
      confirmVariant: 'btn-danger',
    });
    if (!confirmed) {
      return;
    }

    const response = await chrome.runtime.sendMessage({
      type: 'IMPORT_SETTINGS',
      source: 'sidepanel',
      payload: {
        config: parsedConfig,
      },
    });

    if (response?.error) {
      throw new Error(response.error);
    }
    if (!response?.state) {
      throw new Error('\u5bfc\u5165\u540e\u672a\u8fd4\u56de\u6700\u65b0\u914d\u7f6e\u72b6\u6001\u3002');
    }

    applySettingsState(response.state);
    updateStatusDisplay(latestState);
    showToast('\u914d\u7f6e\u5df2\u5bfc\u5165\uff0c\u5f53\u524d\u914d\u7f6e\u5df2\u8986\u76d6\u3002', 'success', 2200);
  } catch (err) {
    showToast('\u5bfc\u5165\u914d\u7f6e\u5931\u8d25\uff1a' + err.message, 'error');
  } finally {
    configActionInFlight = false;
    updateConfigMenuControls();
    if (inputImportSettingsFile) {
      inputImportSettingsFile.value = '';
    }
  }
}

function syncPasswordToggleLabel() {
  syncToggleButtonLabel(btnTogglePassword, inputPassword, {
    show: '显示密码',
    hide: '隐藏密码',
  });
}

function syncVpsUrlToggleLabel() {
  syncToggleButtonLabel(btnToggleVpsUrl, inputVpsUrl, {
    show: '显示 CPA 地址',
    hide: '隐藏 CPA 地址',
  });
}

function syncVpsPasswordToggleLabel() {
  syncToggleButtonLabel(btnToggleVpsPassword, inputVpsPassword, {
    show: '显示管理密钥',
    hide: '隐藏管理密钥',
  });
}

function syncIpProxyApiUrlToggleLabel() {
  syncToggleButtonLabel(btnToggleIpProxyApiUrl, inputIpProxyApiUrl, {
    show: '显示代理 API',
    hide: '隐藏代理 API',
  });
}

function syncIpProxyUsernameToggleLabel() {
  syncToggleButtonLabel(btnToggleIpProxyUsername, inputIpProxyUsername, {
    show: '显示代理账号',
    hide: '隐藏代理账号',
  });
}

function syncIpProxyPasswordToggleLabel() {
  syncToggleButtonLabel(btnToggleIpProxyPassword, inputIpProxyPassword, {
    show: '显示代理密码',
    hide: '隐藏代理密码',
  });
}

function syncHeroSmsApiKeyToggleLabel() {
  syncToggleButtonLabel(btnToggleHeroSmsApiKey, inputHeroSmsApiKey, {
    show: '显示接码 API Key',
    hide: '隐藏接码 API Key',
  });
}

async function maybeTakeoverAutoRun(actionLabel) {
  if (!isAutoRunPausedPhase()) {
    return true;
  }

  const confirmed = await openConfirmModal({
    title: '接管自动',
    message: `当前自动流程已暂停。若继续${actionLabel}，将停止自动流程并切换为手动控制。是否继续？`,
    confirmLabel: '确认接管',
    confirmVariant: 'btn-primary',
  });
  if (!confirmed) {
    return false;
  }

  await chrome.runtime.sendMessage({ type: 'TAKEOVER_AUTO_RUN', source: 'sidepanel', payload: {} });
  return true;
}

async function handleSkipStep(step) {
  if (isAutoRunPausedPhase()) {
    const takeoverResponse = await chrome.runtime.sendMessage({
      type: 'TAKEOVER_AUTO_RUN',
      source: 'sidepanel',
      payload: {},
    });
    if (takeoverResponse?.error) {
      throw new Error(takeoverResponse.error);
    }
  }

  await persistCurrentSettingsForAction();

  const response = await chrome.runtime.sendMessage({
    type: 'SKIP_STEP',
    source: 'sidepanel',
    payload: { step },
  });

  if (response?.error) {
    throw new Error(response.error);
  }

  showToast(`步骤 ${step} 已跳过`, 'success', 2200);
}

// ============================================================
// Button Handlers
// ============================================================

stepsList?.addEventListener('click', async (event) => {
  const btn = event.target.closest('.step-btn');
  if (!btn) {
    return;
  }
  try {
    const step = Number(btn.dataset.step);
    if (!(await maybeTakeoverAutoRun(`执行步骤 ${step}`))) {
      return;
    }
    await persistCurrentSettingsForAction();
    const gpcCreateStep = getStepIdByKeyForCurrentMode('plus-checkout-create') || 6;
    if (step === gpcCreateStep && !(await ensureGpcApiKeyReadyForStart())) {
      return;
    }
    if (step === 3) {
      if (inputPassword.value !== (latestState?.customPassword || '')) {
        await chrome.runtime.sendMessage({
          type: 'SAVE_SETTING',
          source: 'sidepanel',
          payload: { customPassword: inputPassword.value },
        });
        syncLatestState({ customPassword: inputPassword.value });
      }
      if (shouldExecuteStep3WithSignupPhoneIdentity(latestState)) {
        const response = await chrome.runtime.sendMessage({ type: 'EXECUTE_STEP', source: 'sidepanel', payload: { step } });
        if (response?.error) {
          throw new Error(response.error);
        }
      } else if (selectMailProvider.value === 'hotmail-api' || isLuckmailProvider()) {
        const response = await chrome.runtime.sendMessage({ type: 'EXECUTE_STEP', source: 'sidepanel', payload: { step } });
        if (response?.error) {
          throw new Error(response.error);
        }
      } else if (false && usesGeneratedAliasMailProvider(selectMailProvider.value)) {
        const emailPrefix = inputEmailPrefix.value.trim();
        if (!emailPrefix) {
          showToast(selectMailProvider.value === GMAIL_PROVIDER ? '请先填写 Gmail 原邮箱。' : '请先填写 2925 邮箱前缀。', 'warn');
          return;
        }
        const response = await chrome.runtime.sendMessage({ type: 'EXECUTE_STEP', source: 'sidepanel', payload: { step, emailPrefix } });
        if (response?.error) {
          throw new Error(response.error);
        }
      } else {
        let email = inputEmail.value.trim();
        if (!email) {
          if (isCustomMailProvider()) {
            showToast('当前邮箱服务为自定义邮箱，请先填写注册邮箱后再执行第 3 步。', 'warn');
            return;
          }
          try {
            email = await fetchGeneratedEmail({ showFailureToast: false });
          } catch (err) {
            showToast(`自动获取失败：${err.message}，请手动粘贴邮箱后重试。`, 'warn');
            return;
          }
        }
        if (!validateCurrentRegistrationEmail(email, { showToastOnFailure: true })) {
          return;
        }
        const response = await chrome.runtime.sendMessage({ type: 'EXECUTE_STEP', source: 'sidepanel', payload: { step, email } });
        if (response?.error) {
          throw new Error(response.error);
        }
      }
    } else {
      const response = await chrome.runtime.sendMessage({ type: 'EXECUTE_STEP', source: 'sidepanel', payload: { step } });
      if (response?.error) {
        throw new Error(response.error);
      }
    }
  } catch (err) {
    showToast(err.message, 'error');
  }
});

btnFetchEmail.addEventListener('click', async () => {
  if (selectMailProvider.value === 'hotmail-api' || isLuckmailProvider() || isCustomMailProvider()) {
    return;
  }
  await fetchGeneratedEmail().catch(() => { });
});

btnTogglePassword.addEventListener('click', () => {
  inputPassword.type = inputPassword.type === 'password' ? 'text' : 'password';
  syncPasswordToggleLabel();
});

btnToggleVpsUrl.addEventListener('click', () => {
  inputVpsUrl.type = inputVpsUrl.type === 'password' ? 'text' : 'password';
  syncVpsUrlToggleLabel();
});

btnToggleVpsPassword.addEventListener('click', () => {
  inputVpsPassword.type = inputVpsPassword.type === 'password' ? 'text' : 'password';
  syncVpsPasswordToggleLabel();
});

btnToggleIpProxyApiUrl?.addEventListener('click', () => {
  inputIpProxyApiUrl.type = inputIpProxyApiUrl.type === 'password' ? 'text' : 'password';
  syncIpProxyApiUrlToggleLabel();
});

btnToggleIpProxyUsername?.addEventListener('click', () => {
  inputIpProxyUsername.type = inputIpProxyUsername.type === 'password' ? 'text' : 'password';
  syncIpProxyUsernameToggleLabel();
});

btnToggleIpProxyPassword?.addEventListener('click', () => {
  inputIpProxyPassword.type = inputIpProxyPassword.type === 'password' ? 'text' : 'password';
  syncIpProxyPasswordToggleLabel();
});

btnToggleIpProxySection?.addEventListener('click', () => {
  if (typeof toggleIpProxySectionExpanded === 'function') {
    toggleIpProxySectionExpanded();
  }
});

btnTogglePhoneVerificationSection?.addEventListener('click', () => {
  togglePhoneVerificationSectionExpanded();
});

btnMailLogin?.addEventListener('click', async () => {
  const config = getMailProviderLoginConfig();
  const loginUrl = getMailProviderLoginUrl();
  if (!config || !loginUrl) {
    return;
  }

  try {
    await chrome.tabs.create({ url: loginUrl, active: true });
  } catch (err) {
    showToast(`打开${config.label}失败：${err.message}`, 'error');
  }
});

btnIpProxyServiceLogin?.addEventListener('click', () => {
  const service = normalizeIpProxyService(
    selectIpProxyService?.value || latestState?.ipProxyService || DEFAULT_IP_PROXY_SERVICE
  );
  const config = getIpProxyServiceLoginConfig(service);
  const loginUrl = getIpProxyServiceLoginUrl(service);
  if (!config || !loginUrl) {
    showToast('当前代理服务没有可跳转的登录页。', 'warn', 1800);
    return;
  }
  openExternalUrl(loginUrl);
});

localCpaStep9ModeButtons.forEach((button) => {
  button.addEventListener('click', () => {
    const nextMode = button.dataset.localCpaStep9Mode;
    if (getSelectedLocalCpaStep9Mode() === normalizeLocalCpaStep9Mode(nextMode)) {
      return;
    }
    setLocalCpaStep9Mode(nextMode);
    markSettingsDirty(true);
    saveSettings({ silent: true }).catch(() => { });
  });
});

hotmailServiceModeButtons.forEach((button) => {
  button.addEventListener('click', () => {
    if (button.disabled) {
      return;
    }
    const nextMode = button.dataset.hotmailServiceMode;
    if (getSelectedHotmailServiceMode() === normalizeHotmailServiceMode(nextMode)) {
      return;
    }
    setHotmailServiceMode(nextMode);
    updateMailProviderUI();
    markSettingsDirty(true);
    saveSettings({ silent: true }).catch(() => { });
  });
});

btnSaveSettings.addEventListener('click', async () => {
  if (!settingsDirty) {
    showToast('配置已是最新', 'info', 1400);
    return;
  }
  await saveSettings({ silent: false }).catch(() => { });
});

btnStop.addEventListener('click', async () => {
  btnStop.disabled = true;
  await chrome.runtime.sendMessage({ type: 'STOP_FLOW', source: 'sidepanel', payload: {} });
  showToast(isAutoRunScheduledPhase() ? '正在取消倒计时计划...' : '正在停止当前流程...', 'warn', 2000);
});

btnConfigMenu?.addEventListener('click', (event) => {
  event.stopPropagation();
  toggleConfigMenu();
});

btnRepoHome?.addEventListener('click', () => {
  openRepositoryHomePage();
});

btnCloudflareTempEmailUsageGuide?.addEventListener('click', () => {
  openCloudflareTempEmailUsageGuidePage();
});

btnCloudflareTempEmailGithub?.addEventListener('click', () => {
  openCloudflareTempEmailRepositoryPage();
});

extensionUpdateStatus?.addEventListener('click', () => {
  openReleaseListPage();
});

btnDismissContributionUpdateHint?.addEventListener('click', (event) => {
  event.stopPropagation();
  dismissContributionUpdateHint();
});

configMenu?.addEventListener('click', (event) => {
  event.stopPropagation();
});

btnExportSettings?.addEventListener('click', async () => {
  if (configActionInFlight || settingsSaveInFlight) {
    return;
  }
  await exportSettingsFile();
});

btnImportSettings?.addEventListener('click', async () => {
  if (configActionInFlight || settingsSaveInFlight) {
    return;
  }
  closeConfigMenu();
  if (inputImportSettingsFile) {
    inputImportSettingsFile.value = '';
    inputImportSettingsFile.click();
  }
});

inputImportSettingsFile?.addEventListener('change', async () => {
  const file = inputImportSettingsFile.files?.[0] || null;
  await importSettingsFromFile(file);
});

autoStartModal?.addEventListener('click', (event) => {
  if (event.target === autoStartModal) {
    resolveModalChoice(null);
  }
});
btnAutoStartClose?.addEventListener('click', () => resolveModalChoice(null));

async function startAutoRunFromCurrentSettings() {
  const initialLockedRunCount = typeof getLockedRunCountFromEmailPool === 'function'
    ? getLockedRunCountFromEmailPool()
    : 0;
  const requestedTotalRuns = initialLockedRunCount > 0
    ? initialLockedRunCount
    : getRunCountValue();
  registerPendingAutoRunStartRunCount(requestedTotalRuns);

  try {
    await refreshContributionContentHint();
  } catch (error) {
    console.warn('Failed to refresh contribution content hint before auto run:', error);
  }

  if (typeof persistCurrentSettingsForAction === 'function') {
    await persistCurrentSettingsForAction();
  }
  if (!(await ensureGpcApiKeyReadyForStart())) {
    clearPendingAutoRunStartRunCount();
    return false;
  }

  const customEmailPoolEnabled = typeof usesCustomEmailPoolGenerator === 'function'
    && usesCustomEmailPoolGenerator();
  const lockedRunCount = typeof getLockedRunCountFromEmailPool === 'function'
    ? getLockedRunCountFromEmailPool()
    : 0;
  if (customEmailPoolEnabled && lockedRunCount <= 0) {
    throw new Error('请先在邮箱池里至少填写 1 个邮箱。');
  }
  const totalRuns = lockedRunCount > 0 ? lockedRunCount : requestedTotalRuns;
  registerPendingAutoRunStartRunCount(totalRuns);
  if (lockedRunCount > 0) {
    inputRunCount.value = String(lockedRunCount);
  }
  let mode = 'restart';
  const autoRunSkipFailures = inputAutoSkipFailures.checked;
  const contributionNickname = String(inputContributionNickname?.value || '').trim();
  const contributionQq = String(inputContributionQq?.value || '').trim();
  const fallbackThreadIntervalMinutes = normalizeAutoRunThreadIntervalMinutes(
    inputAutoSkipFailuresThreadIntervalMinutes.value
  );
  inputAutoSkipFailuresThreadIntervalMinutes.value = String(fallbackThreadIntervalMinutes);

  if (shouldOfferAutoModeChoice()) {
    const startStep = getFirstUnfinishedStep();
    const runningStep = getRunningSteps()[0] ?? null;
    const choice = await openAutoStartChoiceDialog(startStep, { runningStep });
    if (!choice) {
      clearPendingAutoRunStartRunCount();
      return false;
    }
    mode = choice;
  }

  if (shouldWarnAutoRunFallbackRisk(totalRuns, autoRunSkipFailures)
    && !isAutoRunFallbackRiskPromptDismissed()) {
    const result = await openAutoRunFallbackRiskConfirmModal(totalRuns);
    if (!result.confirmed) {
      clearPendingAutoRunStartRunCount();
      return false;
    }
    if (result.dismissPrompt) {
      setAutoRunFallbackRiskPromptDismissed(true);
    }
  }

  btnAutoRun.disabled = true;
  inputRunCount.disabled = true;
  const delayEnabled = inputAutoDelayEnabled.checked;
  const delayMinutes = normalizeAutoDelayMinutes(inputAutoDelayMinutes.value);
  inputAutoDelayMinutes.value = String(delayMinutes);
  btnAutoRun.innerHTML = delayEnabled
    ? '<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><circle cx="12" cy="12" r="10"/><path d="M12 6v6l4 2"/></svg> 计划中...'
    : '<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><circle cx="12" cy="12" r="10"/><path d="M12 6v6l4 2"/></svg> 运行中...';
  const response = await chrome.runtime.sendMessage({
    type: delayEnabled ? 'SCHEDULE_AUTO_RUN' : 'AUTO_RUN',
    source: 'sidepanel',
    payload: {
      totalRuns,
      delayMinutes,
      autoRunSkipFailures,
      contributionMode: Boolean(latestState?.contributionMode),
      contributionNickname,
      contributionQq,
      mode,
    },
  });
  if (response?.error) {
    clearPendingAutoRunStartRunCount();
    throw new Error(response.error);
  }
  return true;
}

// Auto Run
btnAutoRun.addEventListener('click', async () => {
  try {
    await startAutoRunFromCurrentSettings();
  } catch (err) {
    clearPendingAutoRunStartRunCount();
    setDefaultAutoRunButton();
    inputRunCount.disabled = shouldLockRunCountToEmailPool();
    showToast(err.message, 'error');
  }
});

btnAutoContinue.addEventListener('click', async () => {
  const email = inputEmail.value.trim();
  if (!email) {
    showToast(
      isCustomMailProvider() ? '请先填写自定义注册邮箱。' : '请先获取或粘贴邮箱。',
      'warn'
    );
    return;
  }
  autoContinueBar.style.display = 'none';
  await chrome.runtime.sendMessage({ type: 'RESUME_AUTO_RUN', source: 'sidepanel', payload: { email } });
});

btnAutoRunNow?.addEventListener('click', async () => {
  try {
    btnAutoRunNow.disabled = true;
    const waitingInterval = currentAutoRun.phase === 'waiting_interval';
    await chrome.runtime.sendMessage({
      type: waitingInterval ? 'SKIP_AUTO_RUN_COUNTDOWN' : 'START_SCHEDULED_AUTO_RUN_NOW',
      source: 'sidepanel',
      payload: {},
    });
    if (waitingInterval) {
      showToast('已跳过当前倒计时，自动流程将立即继续。', 'info', 1800);
    }
  } catch (err) {
    showToast(err.message, 'error');
  } finally {
    btnAutoRunNow.disabled = false;
  }
});

btnAutoCancelSchedule?.addEventListener('click', async () => {
  try {
    btnAutoCancelSchedule.disabled = true;
    await chrome.runtime.sendMessage({ type: 'CANCEL_SCHEDULED_AUTO_RUN', source: 'sidepanel', payload: {} });
    showToast('已取消倒计时计划。', 'info', 1800);
  } catch (err) {
    showToast(err.message, 'error');
  } finally {
    btnAutoCancelSchedule.disabled = false;
  }
});

// Reset
btnReset.addEventListener('click', async () => {
  const confirmed = await openConfirmModal({
    title: '重置流程',
    message: '确认重置全部步骤和数据吗？',
    confirmLabel: '确认重置',
    confirmVariant: 'btn-danger',
  });
  if (!confirmed) {
    return;
  }

  await chrome.runtime.sendMessage({ type: 'RESET', source: 'sidepanel' });
  syncLatestState({
    stepStatuses: STEP_DEFAULT_STATUSES,
    currentHotmailAccountId: null,
    currentLuckmailPurchase: null,
    currentLuckmailMailCursor: null,
    email: null,
    signupPhoneNumber: '',
    accountIdentifierType: null,
    accountIdentifier: '',
  });
  syncAutoRunState({
    autoRunning: false,
    autoRunPhase: 'idle',
    autoRunCurrentRun: 0,
    autoRunTotalRuns: 1,
    autoRunAttemptRun: 0,
    scheduledAutoRunAt: null,
    autoRunCountdownAt: null,
    autoRunCountdownTitle: '',
    autoRunCountdownNote: '',
  });
  displayOauthUrl.textContent = '等待中...';
  displayOauthUrl.classList.remove('has-value');
  displayLocalhostUrl.textContent = '等待中...';
  displayLocalhostUrl.classList.remove('has-value');
  inputEmail.value = '';
  if (typeof inputSignupPhone !== 'undefined' && inputSignupPhone) {
    inputSignupPhone.value = '';
  }
  if (typeof syncSignupPhoneInputFromState === 'function') {
    syncSignupPhoneInputFromState(latestState);
  }
  displayStatus.textContent = '就绪';
  statusBar.className = 'status-bar';
  logArea.innerHTML = '';
  resetIcloudManager();
  document.querySelectorAll('.step-row').forEach(row => row.className = 'step-row');
  document.querySelectorAll('.step-status').forEach(el => el.textContent = '');
  setDefaultAutoRunButton();
  applyAutoRunStatus(currentAutoRun);
  markSettingsDirty(false);
  updateStopButtonState(false);
  updateButtonStates();
  updateProgressCounter();
  renderHotmailAccounts();
  resetLuckmailManager();
  if (isLuckmailProvider()) {
    queueLuckmailPurchaseRefresh();
  }
});

// Clear log
btnClearLog.addEventListener('click', () => {
  logArea.innerHTML = '';
});

// Save settings on change
inputEmail.addEventListener('change', async () => {
  if (selectMailProvider.value === 'hotmail-api' || isLuckmailProvider()) {
    return;
  }
  const email = inputEmail.value.trim();
  inputEmail.value = email;
  try {
    if (email) {
      if (!validateCurrentRegistrationEmail(email, { showToastOnFailure: true })) {
        return;
      }
      const response = await chrome.runtime.sendMessage({ type: 'SAVE_EMAIL', source: 'sidepanel', payload: { email } });
      if (response?.error) {
        throw new Error(response.error);
      }
    } else {
      await setRuntimeEmailState(null);
    }
  } catch (err) {
    showToast(err.message, 'error');
  }
});
inputEmail.addEventListener('input', updateButtonStates);
if (typeof inputSignupPhone !== 'undefined' && inputSignupPhone) {
  inputSignupPhone.addEventListener('focus', () => {
    signupPhoneInputFocused = true;
  });
  inputSignupPhone.addEventListener('blur', async () => {
    signupPhoneInputFocused = false;
    if (!signupPhoneInputDirty) {
      return;
    }
    try {
      await persistSignupPhoneInputValue({ final: true, silent: true });
    } catch (err) {
      showToast(err.message, 'error');
    }
  });
  inputSignupPhone.addEventListener('change', async () => {
    try {
      await persistSignupPhoneInputValue({ final: true, silent: true });
    } catch (err) {
      showToast(err.message, 'error');
    }
  });
  inputSignupPhone.addEventListener('input', () => {
    signupPhoneInputDirty = true;
    updateButtonStates();
  });
}
inputVpsUrl.addEventListener('input', () => {
  markSettingsDirty(true);
  scheduleSettingsAutoSave();
});
inputVpsUrl.addEventListener('blur', () => {
  saveSettings({ silent: true }).catch(() => { });
});

inputVpsPassword.addEventListener('input', () => {
  markSettingsDirty(true);
  scheduleSettingsAutoSave();
});
inputVpsPassword.addEventListener('blur', () => {
  saveSettings({ silent: true }).catch(() => { });
});

[inputHotmailRemoteBaseUrl, inputHotmailLocalBaseUrl].forEach((input) => {
  input?.addEventListener('input', () => {
    markSettingsDirty(true);
    scheduleSettingsAutoSave();
  });
  input?.addEventListener('blur', () => {
    saveSettings({ silent: true }).catch(() => { });
  });
});

[inputLuckmailApiKey, inputLuckmailBaseUrl, inputLuckmailDomain].forEach((input) => {
  input?.addEventListener('input', () => {
    markSettingsDirty(true);
    scheduleSettingsAutoSave();
  });
  input?.addEventListener('blur', () => {
    saveSettings({ silent: true }).catch(() => { });
  });
});

selectLuckmailEmailType?.addEventListener('change', () => {
  markSettingsDirty(true);
  saveSettings({ silent: true }).catch(() => { });
});

inputPassword.addEventListener('input', () => {
  markSettingsDirty(true);
  updateButtonStates();
  scheduleSettingsAutoSave();
});
inputPassword.addEventListener('blur', () => {
  saveSettings({ silent: true }).catch(() => { });
});

inputPlusModeEnabled?.addEventListener('change', () => {
  updatePlusModeUI();
  updateSignupMethodUI({ notify: true });
  syncStepDefinitionsForMode(Boolean(inputPlusModeEnabled.checked), getSelectedPlusPaymentMethod(), { render: true });
  markSettingsDirty(true);
  saveSettings({ silent: true }).catch(() => { });
});

inputOperationDelayEnabled?.addEventListener('change', () => {
  persistOperationDelayToggle().catch(() => { });
});

selectPlusPaymentMethod?.addEventListener('change', () => {
  selectPlusPaymentMethod.value = normalizePlusPaymentMethod(selectPlusPaymentMethod.value);
  updatePlusModeUI();
  syncStepDefinitionsForMode(Boolean(inputPlusModeEnabled?.checked), selectPlusPaymentMethod.value, { render: true });
  markSettingsDirty(true);
  saveSettings({ silent: true }).catch(() => { });
});

btnGpcCardKeyPurchase?.addEventListener('click', () => {
  openExternalUrl('https://pay.ldxp.cn/shop/gpc');
});

btnGpcHelperConvertApiKey?.addEventListener('click', () => {
  openExternalUrl(GPC_HELPER_PORTAL_URL);
});

btnGpcHelperBalance?.addEventListener('click', async () => {
  try {
    const response = await chrome.runtime.sendMessage({
      type: 'REFRESH_GPC_CARD_BALANCE',
      source: 'sidepanel',
      payload: {
        gopayHelperApiUrl: inputGpcHelperApi?.value || DEFAULT_GPC_HELPER_API_URL,
        gopayHelperApiKey: inputGpcHelperCardKey?.value || '',
        gopayHelperCountryCode: selectGpcHelperCountryCode?.value || '+86',
        reason: 'manual',
      },
    });
    if (response?.error) {
      throw new Error(response.error);
    }
    if (displayGpcHelperBalance) {
      displayGpcHelperBalance.textContent = response?.balance || '余额已更新';
    }
    const nextState = {
      gopayHelperBalance: response?.balance || latestState?.gopayHelperBalance || '',
      gopayHelperBalancePayload: response?.data || response?.payload?.data || response?.payload || latestState?.gopayHelperBalancePayload || null,
      gopayHelperBalanceUpdatedAt: response?.updatedAt || Date.now(),
      gopayHelperBalanceError: '',
      gopayHelperRemainingUses: getGpcBalanceRemainingUsesFromResponse(response) ?? 0,
      gopayHelperAutoModeEnabled: getGpcAutoModeEnabledFromResponse(response),
      gopayHelperApiKeyStatus: response?.apiKeyStatus || response?.data?.status || response?.payload?.data?.status || response?.payload?.status || '',
    };
    syncLatestState(nextState);
    if (!nextState.gopayHelperAutoModeEnabled && getSelectedGpcHelperPhoneMode() === GPC_HELPER_PHONE_MODE_AUTO) {
      selectGpcHelperPhoneMode.value = GPC_HELPER_PHONE_MODE_MANUAL;
      syncLatestState({ gopayHelperPhoneMode: GPC_HELPER_PHONE_MODE_MANUAL });
      await saveSettings({ silent: true, force: true }).catch(() => {});
      showToast('当前 API Key 未开通自动模式，已切回手动模式。', 'warn');
    } else {
      showToast(nextState.gopayHelperAutoModeEnabled ? 'GPC 余额已更新，自动模式可用。' : 'GPC 余额已更新，当前 API Key 只能使用手动模式。', 'success');
    }
    updatePlusModeUI();
  } catch (error) {
    showToast(error?.message || '查询 GPC 余额失败。', 'error');
  }
});

selectPlusPaymentMethod?.addEventListener('change', () => {
  updatePlusModeUI();
  syncStepDefinitionsForMode(Boolean(inputPlusModeEnabled?.checked), {
    render: true,
    plusPaymentMethod: selectPlusPaymentMethod.value,
  });
  markSettingsDirty(true);
  saveSettings({ silent: true }).catch(() => { });
});

[
  inputGpcHelperApi,
  inputGpcHelperCardKey,
  selectGpcHelperPhoneMode,
  selectGpcHelperCountryCode,
  inputGpcHelperPhone,
  selectGpcHelperOtpChannel,
  inputGpcHelperLocalSmsEnabled,
  inputGpcHelperLocalSmsUrl,
  inputGpcHelperPin,
  selectGoPayCountryCode,
  inputGoPayPhone,
  inputGoPayOtp,
  inputGoPayPin,
].forEach((input) => {
  input?.addEventListener('input', () => {
    markSettingsDirty(true);
    scheduleSettingsAutoSave();
  });
  input?.addEventListener('change', () => {
    if (input === selectGpcHelperPhoneMode || input === selectGpcHelperOtpChannel || input === inputGpcHelperLocalSmsEnabled) {
      updatePlusModeUI();
    }
    markSettingsDirty(true);
    saveSettings({ silent: true }).catch(() => { });
  });
  input?.addEventListener('blur', () => {
    saveSettings({ silent: true }).catch(() => { });
  });
});

selectMailProvider.addEventListener('change', async () => {
  const previousProvider = latestState?.mailProvider || '';
  const previousMail2925Mode = latestState?.mail2925Mode;
  const nextProvider = selectMailProvider.value;
  syncManagedAliasBaseEmailDraftFromInput(previousProvider);
  setManagedAliasBaseEmailInputForProvider(nextProvider, latestState);
  updateMailProviderUI();
  const leavingHotmail = previousProvider === 'hotmail-api'
    && nextProvider !== 'hotmail-api'
    && isCurrentEmailManagedByHotmail();
  const leavingLuckmail = previousProvider === LUCKMAIL_PROVIDER
    && nextProvider !== LUCKMAIL_PROVIDER
    && isCurrentEmailManagedByLuckmail();
  const leavingGeneratedAlias = (
    previousProvider !== nextProvider
    || (previousProvider === '2925' && normalizeMail2925Mode(previousMail2925Mode) !== getSelectedMail2925Mode())
  ) && usesGeneratedAliasMailProvider(previousProvider, previousMail2925Mode)
    && isCurrentEmailManagedByGeneratedAlias(previousProvider, latestState, previousMail2925Mode);
  if (leavingHotmail || leavingLuckmail || leavingGeneratedAlias) {
    await clearRegistrationEmail({ silent: true }).catch(() => { });
  }
  if (nextProvider === '2925' && Boolean(inputMail2925UseAccountPool?.checked)) {
    syncMail2925PoolAccountOptions(latestState);
    if (!selectMail2925PoolAccount.value && getMail2925Accounts().length > 0) {
      selectMail2925PoolAccount.value = String(getMail2925Accounts()[0]?.id || '');
    }
    await syncSelectedMail2925PoolAccount({ silent: true }).catch(() => { });
  }
  if (nextProvider === LUCKMAIL_PROVIDER) {
    queueLuckmailPurchaseRefresh();
  }
  markSettingsDirty(true);
  saveSettings({ silent: true }).catch(() => { });
});

mail2925ModeButtons.forEach((button) => {
  button.addEventListener('click', async () => {
    const nextMode = normalizeMail2925Mode(button.dataset.mail2925Mode);
    const previousMode = normalizeMail2925Mode(latestState?.mail2925Mode);
    if (nextMode === getSelectedMail2925Mode()) {
      return;
    }

    setMail2925Mode(nextMode);
    updateMailProviderUI();

    const leavingGeneratedAlias = selectMailProvider.value === '2925'
      && previousMode === MAIL_2925_MODE_PROVIDE
      && nextMode !== MAIL_2925_MODE_PROVIDE
      && isCurrentEmailManagedByGeneratedAlias('2925', latestState, previousMode);
    if (leavingGeneratedAlias) {
      await clearRegistrationEmail({ silent: true }).catch(() => { });
    }

    markSettingsDirty(true);
    saveSettings({ silent: true }).catch(() => { });
  });
});

selectEmailGenerator.addEventListener('change', () => {
  updateMailProviderUI();
  clearRegistrationEmail({ silent: true }).catch(() => { });
  markSettingsDirty(true);
  saveSettings({ silent: true }).catch(() => { });
});

selectIcloudHostPreference?.addEventListener('change', () => {
  updateMailProviderUI();
  markSettingsDirty(true);
  saveSettings({ silent: true }).catch(() => { });
  if (getSelectedEmailGenerator() === 'icloud') {
    queueIcloudAliasRefresh();
  }
});

selectIcloudTargetMailboxType?.addEventListener('change', () => {
  updateMailProviderUI();
  markSettingsDirty(true);
  saveSettings({ silent: true }).catch(() => { });
});

selectIcloudForwardMailProvider?.addEventListener('change', () => {
  updateMailProviderUI();
  markSettingsDirty(true);
  saveSettings({ silent: true }).catch(() => { });
});

selectIcloudFetchMode?.addEventListener('change', () => {
  markSettingsDirty(true);
  saveSettings({ silent: true }).catch(() => { });
});

checkboxAutoDeleteIcloud?.addEventListener('change', () => {
  markSettingsDirty(true);
  saveSettings({ silent: true }).catch(() => { });
});

selectPanelMode.addEventListener('change', async () => {
  const previousPanelMode = normalizePanelMode(latestState?.panelMode || 'cpa');
  const nextPanelMode = normalizePanelMode(selectPanelMode.value);
  selectPanelMode.value = nextPanelMode;
  const confirmed = await confirmCpaPhoneSignupIfNeeded({
    signupMethod: getSelectedSignupMethod(),
    panelMode: nextPanelMode,
  });
  if (!confirmed) {
    selectPanelMode.value = previousPanelMode;
    updatePanelModeUI();
    return;
  }
  syncLatestState({ panelMode: nextPanelMode });
  updatePanelModeUI();
  markSettingsDirty(true);
  saveSettings({ silent: true }).catch(() => { });
});

function syncCurrentIpProxyServiceProfileToLatestState() {
  const selectedService = normalizeIpProxyService(
    selectIpProxyService?.value || latestState?.ipProxyService || DEFAULT_IP_PROXY_SERVICE
  );
  const normalizedProfiles = typeof buildIpProxyServiceProfilesPatch === 'function'
    ? buildIpProxyServiceProfilesPatch(selectedService, latestState || {})
    : { ...(latestState?.ipProxyServiceProfiles || {}) };
  const currentProfile = typeof getIpProxyServiceProfile === 'function'
    ? getIpProxyServiceProfile(selectedService, {
      ...(latestState || {}),
      ipProxyService: selectedService,
      ipProxyServiceProfiles: normalizedProfiles,
    })
    : {
      mode: normalizeIpProxyMode(getSelectedIpProxyMode()),
      apiUrl: String(inputIpProxyApiUrl?.value || '').trim(),
      accountList: normalizeIpProxyAccountList(inputIpProxyAccountList?.value || ''),
      accountSessionPrefix: normalizeIpProxyAccountSessionPrefix(inputIpProxyAccountSessionPrefix?.value || ''),
      accountLifeMinutes: normalizeIpProxyAccountLifeMinutes(inputIpProxyAccountLifeMinutes?.value || ''),
      poolTargetCount: normalizeIpProxyPoolTargetCount(inputIpProxyPoolTargetCount?.value || '', 20),
      host: String(inputIpProxyHost?.value || '').trim(),
      port: String(normalizeIpProxyPort(inputIpProxyPort?.value || '') || ''),
      protocol: normalizeIpProxyProtocol(selectIpProxyProtocol?.value || ''),
      username: String(inputIpProxyUsername?.value || '').trim(),
      password: String(inputIpProxyPassword?.value || ''),
      region: String(inputIpProxyRegion?.value || '').trim(),
    };
  syncLatestState({
    ipProxyService: selectedService,
    ipProxyServiceProfiles: normalizedProfiles,
    ...(typeof buildIpProxyStatePatchFromServiceProfile === 'function'
      ? buildIpProxyStatePatchFromServiceProfile(selectedService, currentProfile)
      : {}),
  });
}

function handleIpProxyEnabledToggle(nextEnabled) {
  const enabled = Boolean(nextEnabled);
  const previousEnabled = Boolean(latestState?.ipProxyEnabled);
  if (previousEnabled === enabled) {
    setIpProxyEnabled(enabled);
    updateIpProxyUI(latestState);
    return;
  }
  setIpProxyEnabled(enabled);
  if (enabled && typeof setIpProxySectionExpanded === 'function') {
    setIpProxySectionExpanded(true);
  }
  syncLatestState({ ipProxyEnabled: enabled });
  updateIpProxyUI(latestState);
  markSettingsDirty(true);
  saveSettings({ silent: true }).catch(() => {});
}

if (inputIpProxyEnabled) {
  inputIpProxyEnabled.addEventListener('change', () => {
    handleIpProxyEnabledToggle(Boolean(inputIpProxyEnabled.checked));
  });
} else {
  ipProxyEnabledButtons.forEach((button) => {
    button.addEventListener('click', () => {
      const nextEnabled = String(button.dataset.ipProxyEnabled) === 'true';
      handleIpProxyEnabledToggle(nextEnabled);
    });
  });
}

selectIpProxyService?.addEventListener('change', () => {
  const previousService = normalizeIpProxyService(latestState?.ipProxyService || DEFAULT_IP_PROXY_SERVICE);
  const nextService = normalizeIpProxyService(selectIpProxyService.value);
  const normalizedProfiles = typeof normalizeIpProxyServiceProfiles === 'function'
    ? normalizeIpProxyServiceProfiles(latestState?.ipProxyServiceProfiles || {}, latestState || {})
    : { ...(latestState?.ipProxyServiceProfiles || {}) };

  if (typeof buildCurrentIpProxyServiceProfileFromInputs === 'function') {
    normalizedProfiles[previousService] = buildCurrentIpProxyServiceProfileFromInputs();
  }

  const nextProfile = typeof getIpProxyServiceProfile === 'function'
    ? getIpProxyServiceProfile(nextService, {
      ...(latestState || {}),
      ipProxyService: nextService,
      ipProxyServiceProfiles: normalizedProfiles,
    })
    : {
      mode: typeof normalizeIpProxyModeForCurrentRelease === 'function'
        ? normalizeIpProxyModeForCurrentRelease(latestState?.ipProxyMode)
        : normalizeIpProxyMode(latestState?.ipProxyMode),
      apiUrl: String(latestState?.ipProxyApiUrl || '').trim(),
      accountList: normalizeIpProxyAccountList(latestState?.ipProxyAccountList || ''),
      accountSessionPrefix: normalizeIpProxyAccountSessionPrefix(latestState?.ipProxyAccountSessionPrefix || ''),
      accountLifeMinutes: normalizeIpProxyAccountLifeMinutes(latestState?.ipProxyAccountLifeMinutes || ''),
      poolTargetCount: normalizeIpProxyPoolTargetCount(latestState?.ipProxyPoolTargetCount || '', 20),
      host: String(latestState?.ipProxyHost || '').trim(),
      port: String(normalizeIpProxyPort(latestState?.ipProxyPort || '') || ''),
      protocol: normalizeIpProxyProtocol(latestState?.ipProxyProtocol),
      username: String(latestState?.ipProxyUsername || '').trim(),
      password: String(latestState?.ipProxyPassword || ''),
      region: String(latestState?.ipProxyRegion || '').trim(),
    };

  if (typeof applyIpProxyServiceProfileToInputs === 'function') {
    applyIpProxyServiceProfileToInputs(nextProfile);
  } else {
    setIpProxyMode(nextProfile.mode);
  }

  syncLatestState({
    ipProxyService: nextService,
    ipProxyServiceProfiles: normalizedProfiles,
    ...(typeof buildIpProxyStatePatchFromServiceProfile === 'function'
      ? buildIpProxyStatePatchFromServiceProfile(nextService, nextProfile)
      : {}),
  });
  updateIpProxyUI(latestState);
  markSettingsDirty(true);
  saveSettings({ silent: true }).catch(() => {});
});

ipProxyModeButtons.forEach((button) => {
  button.addEventListener('click', () => {
    const nextMode = normalizeIpProxyMode(button.dataset.ipProxyMode || DEFAULT_IP_PROXY_MODE);
    const apiModeAvailable = typeof isIpProxyApiModeAvailable === 'function'
      ? Boolean(isIpProxyApiModeAvailable())
      : (typeof IP_PROXY_API_MODE_ENABLED !== 'undefined' ? Boolean(IP_PROXY_API_MODE_ENABLED) : false);
    if (!apiModeAvailable && nextMode === 'api') {
      setIpProxyMode('account');
      updateIpProxyUI(latestState);
      showToast('API 模式暂未开放，请先使用账号密码模式。', 'info', 1800);
      return;
    }
    if (getSelectedIpProxyMode() === nextMode) {
      return;
    }
    setIpProxyMode(nextMode);
    syncCurrentIpProxyServiceProfileToLatestState();
    updateIpProxyUI(latestState);
    markSettingsDirty(true);
    saveSettings({ silent: true }).catch(() => {});
  });
});

selectIpProxyProtocol?.addEventListener('change', () => {
  syncCurrentIpProxyServiceProfileToLatestState();
  updateIpProxyUI(latestState);
  markSettingsDirty(true);
  saveSettings({ silent: true }).catch(() => {});
});

btnIpProxyRefresh?.addEventListener('click', async () => {
  try {
    const result = typeof runIpProxyActionWithLock === 'function'
      ? await runIpProxyActionWithLock('refresh', async () => {
        await saveSettings({ silent: true });
        await refreshIpProxyPoolByApi();
      })
      : await (async () => {
        await saveSettings({ silent: true });
        await refreshIpProxyPoolByApi();
        return { skipped: false };
      })();
    if (result?.skipped) {
      return;
    }
  } catch (err) {
    showToast(err?.message || String(err || '未知错误'), 'error');
  }
});

btnIpProxyNext?.addEventListener('click', async () => {
  try {
    const result = typeof runIpProxyActionWithLock === 'function'
      ? await runIpProxyActionWithLock('next', async () => {
        await saveSettings({ silent: true });
        await switchIpProxyToNext();
      })
      : await (async () => {
        await saveSettings({ silent: true });
        await switchIpProxyToNext();
        return { skipped: false };
      })();
    if (result?.skipped) {
      return;
    }
  } catch (err) {
    showToast(err?.message || String(err || '未知错误'), 'error');
  }
});

btnIpProxyChange?.addEventListener('click', async () => {
  try {
    const result = typeof runIpProxyActionWithLock === 'function'
      ? await runIpProxyActionWithLock('change', async () => {
        await saveSettings({ silent: true });
        await changeIpProxyExitBySession();
      })
      : await (async () => {
        await saveSettings({ silent: true });
        await changeIpProxyExitBySession();
        return { skipped: false };
      })();
    if (result?.skipped) {
      return;
    }
  } catch (err) {
    showToast(err?.message || String(err || '未知错误'), 'error');
  }
});

btnIpProxyProbe?.addEventListener('click', async () => {
  try {
    const result = typeof runIpProxyActionWithLock === 'function'
      ? await runIpProxyActionWithLock('probe', async () => {
        await saveSettings({ silent: true });
        await probeIpProxyExit();
      })
      : await (async () => {
        await saveSettings({ silent: true });
        await probeIpProxyExit();
        return { skipped: false };
      })();
    if (result?.skipped) {
      return;
    }
  } catch (err) {
    showToast(err?.message || String(err || '未知错误'), 'error');
  }
});

btnIpProxyCheckIp?.addEventListener('click', async () => {
  try {
    await chrome.tabs.create({ url: 'https://ipinfo.io/what-is-my-ip' });
  } catch (err) {
    showToast(`打开 IP 检测页失败：${err?.message || String(err || '未知错误')}`, 'error');
  }
});

selectCfDomain.addEventListener('change', () => {
  if (selectCfDomain.disabled) {
    return;
  }
  markSettingsDirty(true);
  saveSettings({ silent: true }).catch(() => { });
});

selectTempEmailDomain.addEventListener('change', () => {
  if (selectTempEmailDomain.disabled) {
    return;
  }
  markSettingsDirty(true);
  saveSettings({ silent: true }).catch(() => { });
});

btnCfDomainMode.addEventListener('click', async () => {
  try {
    if (!cloudflareDomainEditMode) {
      setCloudflareDomainEditMode(true, { clearInput: true });
      return;
    }

    const newDomain = normalizeCloudflareDomainValue(inputCfDomain.value);
    if (!newDomain) {
      showToast('请输入有效的 Cloudflare 域名。', 'warn');
      inputCfDomain.focus();
      return;
    }

    const { domains } = getCloudflareDomainsFromState();
    await saveCloudflareDomainSettings([...domains, newDomain], newDomain);
  } catch (err) {
    showToast(err.message, 'error');
  }
});

btnTempEmailDomainMode.addEventListener('click', async () => {
  try {
    if (!cloudflareTempEmailDomainEditMode) {
      setCloudflareTempEmailDomainEditMode(true, { clearInput: true });
      return;
    }

    const newDomain = normalizeCloudflareTempEmailDomainValue(inputTempEmailDomain.value);
    if (!newDomain) {
      showToast('请输入有效的 Cloudflare Temp Email 域名。', 'warn');
      inputTempEmailDomain.focus();
      return;
    }

    const { domains } = getCloudflareTempEmailDomainsFromState();
    await saveCloudflareTempEmailDomainSettings([...domains, newDomain], newDomain);
  } catch (err) {
    showToast(err.message, 'error');
  }
});

inputCfDomain.addEventListener('keydown', (event) => {
  if (event.key === 'Enter') {
    event.preventDefault();
    btnCfDomainMode.click();
  }
});

inputTempEmailDomain.addEventListener('keydown', (event) => {
  if (event.key === 'Enter') {
    event.preventDefault();
    btnTempEmailDomainMode.click();
  }
});

inputSub2ApiUrl.addEventListener('input', () => {
  markSettingsDirty(true);
  scheduleSettingsAutoSave();
});
inputSub2ApiUrl.addEventListener('blur', () => {
  saveSettings({ silent: true }).catch(() => { });
});

inputSub2ApiEmail.addEventListener('input', () => {
  markSettingsDirty(true);
  scheduleSettingsAutoSave();
});
inputSub2ApiEmail.addEventListener('blur', () => {
  saveSettings({ silent: true }).catch(() => { });
});

inputSub2ApiPassword.addEventListener('input', () => {
  markSettingsDirty(true);
  scheduleSettingsAutoSave();
});
inputSub2ApiPassword.addEventListener('blur', () => {
  saveSettings({ silent: true }).catch(() => { });
});

inputSub2ApiGroup.addEventListener('change', () => {
  syncLatestState({
    sub2apiGroupName: getSelectedSub2ApiGroupName(),
    sub2apiGroupNames: normalizeSub2ApiGroupOptions(
      getSub2ApiGroupOptionsState(latestState),
      getSelectedSub2ApiGroupName()
    ),
  });
  markSettingsDirty(true);
  saveSettings({ silent: true }).catch(() => { });
});

inputSub2ApiAccountPriority.addEventListener('input', () => {
  markSettingsDirty(true);
  scheduleSettingsAutoSave();
});
inputSub2ApiAccountPriority.addEventListener('blur', () => {
  inputSub2ApiAccountPriority.value = String(normalizeSub2ApiAccountPriorityValue(inputSub2ApiAccountPriority.value));
  saveSettings({ silent: true }).catch(() => { });
});

btnAddSub2ApiGroup?.addEventListener('click', () => {
  handleAddSub2ApiGroup().catch((error) => {
    showToast(error?.message || '添加 SUB2API 分组失败。', 'error');
  });
});

inputSub2ApiDefaultProxy.addEventListener('input', () => {
  markSettingsDirty(true);
  scheduleSettingsAutoSave();
});
inputSub2ApiDefaultProxy.addEventListener('blur', () => {
  saveSettings({ silent: true }).catch(() => { });
});

inputCodex2ApiUrl.addEventListener('input', () => {
  markSettingsDirty(true);
  scheduleSettingsAutoSave();
});
inputCodex2ApiUrl.addEventListener('blur', () => {
  saveSettings({ silent: true }).catch(() => { });
});

inputCodex2ApiAdminKey.addEventListener('input', () => {
  markSettingsDirty(true);
  scheduleSettingsAutoSave();
});
inputCodex2ApiAdminKey.addEventListener('blur', () => {
  saveSettings({ silent: true }).catch(() => { });
});

[
  inputIpProxyApiUrl,
  inputIpProxyAccountList,
  inputIpProxyHost,
  inputIpProxyUsername,
  inputIpProxyPassword,
].forEach((input) => {
  input?.addEventListener('input', () => {
    markSettingsDirty(true);
    scheduleSettingsAutoSave();
  });
  input?.addEventListener('blur', () => {
    saveSettings({ silent: true }).catch(() => {});
  });
});

inputIpProxyUsername?.addEventListener('paste', () => {
  setTimeout(() => {
    let profileUpdated = false;
    if (typeof sync711SessionFieldsFromUsernameForPanel !== 'function') {
      profileUpdated = false;
    } else {
      const result = sync711SessionFieldsFromUsernameForPanel();
      profileUpdated = profileUpdated || Boolean(result?.updated);
    }
    if (typeof sync711RegionFieldFromUsernameForPanel === 'function') {
      const regionResult = sync711RegionFieldFromUsernameForPanel();
      profileUpdated = profileUpdated || Boolean(regionResult?.updated);
    }
    if (typeof syncIpProxyRegionInputFromCredentials === 'function') {
      const beforeRegion = String(inputIpProxyRegion?.value || '');
      syncIpProxyRegionInputFromCredentials({ force: true });
      const afterRegion = String(inputIpProxyRegion?.value || '');
      profileUpdated = profileUpdated || (beforeRegion !== afterRegion);
    }
    if (!profileUpdated) return;
    syncCurrentIpProxyServiceProfileToLatestState();
    updateIpProxyUI(latestState);
    markSettingsDirty(true);
    scheduleSettingsAutoSave();
  }, 0);
});

inputIpProxyHost?.addEventListener('blur', () => {
  if (typeof syncIpProxyRegionInputFromCredentials === 'function') {
    const beforeRegion = String(inputIpProxyRegion?.value || '');
    syncIpProxyRegionInputFromCredentials({ force: true });
    const afterRegion = String(inputIpProxyRegion?.value || '');
    if (afterRegion !== beforeRegion) {
      markSettingsDirty(true);
      saveSettings({ silent: true }).catch(() => {});
    }
  }
});

inputIpProxyUsername?.addEventListener('blur', () => {
  let profileUpdated = false;
  if (typeof sync711SessionFieldsFromUsernameForPanel === 'function') {
    const result = sync711SessionFieldsFromUsernameForPanel();
    profileUpdated = profileUpdated || Boolean(result?.updated);
  }
  if (typeof sync711RegionFieldFromUsernameForPanel === 'function') {
    const regionResult = sync711RegionFieldFromUsernameForPanel();
    profileUpdated = profileUpdated || Boolean(regionResult?.updated);
  }

  if (typeof syncIpProxyRegionInputFromCredentials === 'function') {
    const beforeRegion = String(inputIpProxyRegion?.value || '');
    syncIpProxyRegionInputFromCredentials({ force: true });
    const afterRegion = String(inputIpProxyRegion?.value || '');
    profileUpdated = profileUpdated || (afterRegion !== beforeRegion);
  }

  if (profileUpdated) {
    syncCurrentIpProxyServiceProfileToLatestState();
    updateIpProxyUI(latestState);
    markSettingsDirty(true);
    saveSettings({ silent: true }).catch(() => {});
  }
});

inputIpProxyAccountSessionPrefix?.addEventListener('input', () => {
  const syncResult = typeof sync711UsernameFromSessionFieldsForPanel === 'function'
    ? sync711UsernameFromSessionFieldsForPanel()
    : null;
  if (syncResult?.updated) {
    syncCurrentIpProxyServiceProfileToLatestState();
    updateIpProxyUI(latestState);
  }
  markSettingsDirty(true);
  scheduleSettingsAutoSave();
});
inputIpProxyAccountSessionPrefix?.addEventListener('blur', () => {
  inputIpProxyAccountSessionPrefix.value = normalizeIpProxyAccountSessionPrefix(inputIpProxyAccountSessionPrefix.value || '');
  const syncResult = typeof sync711UsernameFromSessionFieldsForPanel === 'function'
    ? sync711UsernameFromSessionFieldsForPanel({ removeWhenEmpty: true })
    : null;
  if (syncResult?.updated) {
    syncCurrentIpProxyServiceProfileToLatestState();
    updateIpProxyUI(latestState);
    markSettingsDirty(true);
  }
  saveSettings({ silent: true }).catch(() => {});
});

inputIpProxyAccountLifeMinutes?.addEventListener('input', () => {
  const syncResult = typeof sync711UsernameFromSessionFieldsForPanel === 'function'
    ? sync711UsernameFromSessionFieldsForPanel()
    : null;
  if (syncResult?.updated) {
    syncCurrentIpProxyServiceProfileToLatestState();
    updateIpProxyUI(latestState);
  }
  markSettingsDirty(true);
  scheduleSettingsAutoSave();
});
inputIpProxyAccountLifeMinutes?.addEventListener('blur', () => {
  inputIpProxyAccountLifeMinutes.value = normalizeIpProxyAccountLifeMinutes(inputIpProxyAccountLifeMinutes.value || '');
  const syncResult = typeof sync711UsernameFromSessionFieldsForPanel === 'function'
    ? sync711UsernameFromSessionFieldsForPanel({ removeWhenEmpty: true })
    : null;
  if (syncResult?.updated) {
    syncCurrentIpProxyServiceProfileToLatestState();
    updateIpProxyUI(latestState);
    markSettingsDirty(true);
  }
  saveSettings({ silent: true }).catch(() => {});
});

inputIpProxyRegion?.addEventListener('input', () => {
  const normalizedRegion = typeof normalize711RegionCodeForPanel === 'function'
    ? normalize711RegionCodeForPanel(inputIpProxyRegion.value || '')
    : String(inputIpProxyRegion.value || '').trim().toUpperCase();
  if (normalizedRegion) {
    inputIpProxyRegion.value = normalizedRegion;
  }

  const syncResult = typeof sync711UsernameFromRegionForPanel === 'function'
    ? sync711UsernameFromRegionForPanel()
    : null;
  if (syncResult?.updated) {
    syncCurrentIpProxyServiceProfileToLatestState();
    updateIpProxyUI(latestState);
  }
  markSettingsDirty(true);
  scheduleSettingsAutoSave();
});
inputIpProxyRegion?.addEventListener('blur', () => {
  const normalizedRegion = typeof normalize711RegionCodeForPanel === 'function'
    ? normalize711RegionCodeForPanel(inputIpProxyRegion.value || '')
    : String(inputIpProxyRegion.value || '').trim().toUpperCase();
  inputIpProxyRegion.value = normalizedRegion;
  const syncResult = typeof sync711UsernameFromRegionForPanel === 'function'
    ? sync711UsernameFromRegionForPanel({ removeWhenEmpty: true })
    : null;
  if (syncResult?.updated) {
    syncCurrentIpProxyServiceProfileToLatestState();
    updateIpProxyUI(latestState);
    markSettingsDirty(true);
  }
  saveSettings({ silent: true }).catch(() => {});
});

inputIpProxyPoolTargetCount?.addEventListener('input', () => {
  markSettingsDirty(true);
  scheduleSettingsAutoSave();
});
inputIpProxyPoolTargetCount?.addEventListener('blur', () => {
  inputIpProxyPoolTargetCount.value = normalizeIpProxyPoolTargetCount(inputIpProxyPoolTargetCount.value || '', 20);
  saveSettings({ silent: true }).catch(() => {});
});

inputIpProxyAutoSyncEnabled?.addEventListener('change', () => {
  markSettingsDirty(true);
  if (typeof updateIpProxyUI === 'function') {
    updateIpProxyUI(latestState);
  }
  saveSettings({ silent: true }).catch(() => {});
});

inputIpProxyAutoSyncIntervalMinutes?.addEventListener('input', () => {
  markSettingsDirty(true);
  scheduleSettingsAutoSave();
});

inputIpProxyAutoSyncIntervalMinutes?.addEventListener('blur', () => {
  const numeric = Number.parseInt(String(inputIpProxyAutoSyncIntervalMinutes.value || '').trim(), 10);
  const normalized = Number.isFinite(numeric)
    ? Math.max(1, Math.min(1440, numeric))
    : 15;
  inputIpProxyAutoSyncIntervalMinutes.value = String(normalized);
  saveSettings({ silent: true }).catch(() => {});
});

inputIpProxyPort?.addEventListener('input', () => {
  markSettingsDirty(true);
  scheduleSettingsAutoSave();
});
inputIpProxyPort?.addEventListener('blur', () => {
  const normalizedPort = normalizeIpProxyPort(inputIpProxyPort.value || '');
  inputIpProxyPort.value = normalizedPort > 0 ? String(normalizedPort) : '';
  saveSettings({ silent: true }).catch(() => {});
});

inputEmailPrefix.addEventListener('input', () => {
  maybeClearGeneratedAliasAfterEmailPrefixChange().catch(() => { });
  syncManagedAliasBaseEmailDraftFromInput();
  markSettingsDirty(true);
  scheduleSettingsAutoSave();
});
inputEmailPrefix.addEventListener('blur', () => {
  maybeClearGeneratedAliasAfterEmailPrefixChange().catch(() => { });
  syncManagedAliasBaseEmailDraftFromInput();
  saveSettings({ silent: true }).catch(() => { });
});

inputCustomEmailPool?.addEventListener('input', () => {
  syncRunCountFromConfiguredEmailPool();
  updateMailProviderUI();
  markSettingsDirty(true);
  scheduleSettingsAutoSave();
});
inputCustomEmailPool?.addEventListener('blur', () => {
  inputCustomEmailPool.value = normalizeCustomEmailPoolEntries(inputCustomEmailPool.value).join('\n');
  syncRunCountFromConfiguredEmailPool();
  updateMailProviderUI();
  saveSettings({ silent: true }).catch(() => { });
});

inputCustomMailProviderPool?.addEventListener('input', () => {
  syncRunCountFromConfiguredEmailPool();
  updateMailProviderUI();
  markSettingsDirty(true);
  scheduleSettingsAutoSave();
});
inputCustomMailProviderPool?.addEventListener('blur', () => {
  inputCustomMailProviderPool.value = normalizeCustomEmailPoolEntries(inputCustomMailProviderPool.value).join('\n');
  syncRunCountFromConfiguredEmailPool();
  updateMailProviderUI();
  saveSettings({ silent: true }).catch(() => { });
});

selectMail2925PoolAccount?.addEventListener('change', async () => {
  try {
    await syncSelectedMail2925PoolAccount();
    markSettingsDirty(true);
    saveSettings({ silent: true }).catch(() => { });
  } catch (err) {
    showToast(err.message, 'error');
  }
});

inputMail2925UseAccountPool?.addEventListener('change', async () => {
  const enabled = Boolean(inputMail2925UseAccountPool.checked);
  syncLatestState({ mail2925UseAccountPool: enabled });
  if (enabled) {
    syncMail2925PoolAccountOptions(latestState);
    if (!selectMail2925PoolAccount.value && getMail2925Accounts().length > 0) {
      selectMail2925PoolAccount.value = String(getMail2925Accounts()[0]?.id || '');
    }
    try {
      await syncSelectedMail2925PoolAccount({ silent: true });
    } catch (err) {
      showToast(err.message, 'error');
    }
  }
  setManagedAliasBaseEmailInputForProvider('2925', latestState);
  updateMailProviderUI();
  markSettingsDirty(true);
  saveSettings({ silent: true }).catch(() => { });
});

inputInbucketMailbox.addEventListener('input', () => {
  markSettingsDirty(true);
  scheduleSettingsAutoSave();
});
inputInbucketMailbox.addEventListener('blur', () => {
  saveSettings({ silent: true }).catch(() => { });
});

inputInbucketHost.addEventListener('input', () => {
  markSettingsDirty(true);
  scheduleSettingsAutoSave();
});
inputInbucketHost.addEventListener('blur', () => {
  saveSettings({ silent: true }).catch(() => { });
});

inputRunCount.addEventListener('input', () => {
  clearPendingAutoRunStartRunCount();
  updateFallbackThreadIntervalInputState();
});
inputRunCount.addEventListener('blur', () => {
  if (shouldLockRunCountToEmailPool()) {
    syncRunCountFromConfiguredEmailPool();
    updateFallbackThreadIntervalInputState();
    return;
  }
  inputRunCount.value = String(getRunCountValue());
  updateFallbackThreadIntervalInputState();
});

inputAutoSkipFailures.addEventListener('change', async () => {
  if (inputAutoSkipFailures.checked && !isAutoSkipFailuresPromptDismissed()) {
    const result = await openAutoSkipFailuresConfirmModal();
    if (!result.confirmed) {
      inputAutoSkipFailures.checked = false;
      updateFallbackThreadIntervalInputState();
      return;
    }
    if (result.dismissPrompt) {
      setAutoSkipFailuresPromptDismissed(true);
    }
  }
  updateFallbackThreadIntervalInputState();
  markSettingsDirty(true);
  saveSettings({ silent: true }).catch(() => { });
});

inputTempEmailBaseUrl.addEventListener('input', () => {
  markSettingsDirty(true);
  scheduleSettingsAutoSave();
});
inputTempEmailBaseUrl.addEventListener('blur', () => {
  inputTempEmailBaseUrl.value = normalizeCloudflareTempEmailBaseUrlValue(inputTempEmailBaseUrl.value);
  saveSettings({ silent: true }).catch(() => { });
});

inputTempEmailAdminAuth.addEventListener('input', () => {
  markSettingsDirty(true);
  scheduleSettingsAutoSave();
});
inputTempEmailAdminAuth.addEventListener('blur', () => {
  saveSettings({ silent: true }).catch(() => { });
});

inputTempEmailCustomAuth.addEventListener('input', () => {
  markSettingsDirty(true);
  scheduleSettingsAutoSave();
});
inputTempEmailCustomAuth.addEventListener('blur', () => {
  saveSettings({ silent: true }).catch(() => { });
});

inputTempEmailReceiveMailbox.addEventListener('input', () => {
  markSettingsDirty(true);
  scheduleSettingsAutoSave();
});
inputTempEmailReceiveMailbox.addEventListener('blur', () => {
  inputTempEmailReceiveMailbox.value = normalizeCloudflareTempEmailReceiveMailboxValue(inputTempEmailReceiveMailbox.value);
  saveSettings({ silent: true }).catch(() => { });
});

inputTempEmailUseRandomSubdomain?.addEventListener('change', () => {
  updateMailProviderUI();
  clearRegistrationEmail({ silent: true }).catch(() => { });
  markSettingsDirty(true);
  saveSettings({ silent: true }).catch(() => { });
});

inputAutoSkipFailuresThreadIntervalMinutes.addEventListener('input', () => {
  markSettingsDirty(true);
  scheduleSettingsAutoSave();
});
inputAutoSkipFailuresThreadIntervalMinutes.addEventListener('blur', () => {
  inputAutoSkipFailuresThreadIntervalMinutes.value = String(
    normalizeAutoRunThreadIntervalMinutes(inputAutoSkipFailuresThreadIntervalMinutes.value)
  );
  saveSettings({ silent: true }).catch(() => { });
});

inputAutoDelayEnabled.addEventListener('change', () => {
  updateAutoDelayInputState();
  markSettingsDirty(true);
  saveSettings({ silent: true }).catch(() => { });
});

inputStep6CookieCleanupEnabled?.addEventListener('change', () => {
  markSettingsDirty(true);
  saveSettings({ silent: true }).catch(() => { });
});

inputAutoDelayMinutes.addEventListener('input', () => {
  markSettingsDirty(true);
  scheduleSettingsAutoSave();
});
inputAutoDelayMinutes.addEventListener('blur', () => {
  inputAutoDelayMinutes.value = String(normalizeAutoDelayMinutes(inputAutoDelayMinutes.value));
  saveSettings({ silent: true }).catch(() => { });
});



function getPhoneSmsCountrySelectionForProvider(provider = getSelectedPhoneSmsProvider(), options = {}) {
  const normalizedProvider = normalizePhoneSmsProvider(provider);
  const countrySelect = selectHeroSmsCountry || selectHeroSmsCountryFallback;
  const selectionLimit = Math.max(1, Math.floor(Number(options.maxSelection) || HERO_SMS_COUNTRY_SELECTION_MAX));
  const ensureDefault = options.ensureDefault !== false;
  const defaultCountry = normalizedProvider === PHONE_SMS_PROVIDER_FIVE_SIM
    ? { id: DEFAULT_FIVE_SIM_COUNTRY_ID, label: DEFAULT_FIVE_SIM_COUNTRY_LABEL }
    : { id: DEFAULT_HERO_SMS_COUNTRY_ID, label: DEFAULT_HERO_SMS_COUNTRY_LABEL };

  if (!countrySelect) {
    return ensureDefault ? [defaultCountry] : [];
  }

  const optionByValue = new Map(
    Array.from(countrySelect.options || []).map((option) => [String(option.value), option])
  );
  const selectedIds = Array.from(countrySelect.options || [])
    .filter((option) => option.selected)
    .map((option) => normalizePhoneSmsCountryId(option.value, normalizedProvider))
    .filter(Boolean);

  if (!selectedIds.length && !countrySelect.multiple) {
    const fallbackId = normalizePhoneSmsCountryId(countrySelect.value, normalizedProvider);
    if (fallbackId) {
      selectedIds.push(fallbackId);
    }
  }

  const selectedSet = new Set(selectedIds.map((id) => String(id)));
  let orderedIds = heroSmsCountrySelectionOrder
    .map((id) => normalizePhoneSmsCountryId(id, normalizedProvider))
    .filter((id) => id && selectedSet.has(String(id)));

  selectedIds.forEach((id) => {
    if (!orderedIds.some((existing) => String(existing) === String(id))) {
      orderedIds.push(id);
    }
  });

  if (!orderedIds.length && ensureDefault) {
    orderedIds = [defaultCountry.id];
  }

  return orderedIds.slice(0, selectionLimit).map((id) => {
    const option = optionByValue.get(String(id));
    const optionLabel = String(option?.textContent || '').trim();
    return {
      id,
      label: optionLabel || normalizePhoneSmsCountryLabel(defaultCountry.id === id ? defaultCountry.label : '', normalizedProvider),
    };
  });
}

async function switchPhoneSmsProvider(nextProvider) {
  const previousProvider = getLastAppliedPhoneSmsProvider();
  const normalizedNextProvider = normalizePhoneSmsProvider(nextProvider);

  const currentApiKey = String(inputHeroSmsApiKey?.value || '');
  const currentMaxPrice = normalizePhoneSmsMaxPriceValue(inputHeroSmsMaxPrice?.value || '', previousProvider);
  const currentSelection = typeof getPhoneSmsCountrySelectionForProvider === 'function'
    ? getPhoneSmsCountrySelectionForProvider(previousProvider, { ensureDefault: true })
    : [];
  const currentPrimary = currentSelection[0] || getSelectedHeroSmsCountryOption();
  const currentFallback = currentSelection.slice(1);

  const patch = {
    phoneSmsProvider: normalizedNextProvider,
  };
  if (previousProvider === PHONE_SMS_PROVIDER_FIVE_SIM) {
    patch.fiveSimApiKey = currentApiKey;
    patch.fiveSimMaxPrice = currentMaxPrice;
    patch.fiveSimCountryId = currentPrimary.id;
    patch.fiveSimCountryLabel = currentPrimary.label;
    patch.fiveSimCountryFallback = currentFallback;
    patch.fiveSimCountryOrder = [currentPrimary, ...currentFallback]
      .map((country) => normalizeFiveSimCountryId(country?.id, ''))
      .filter(Boolean);
    patch.fiveSimOperator = normalizeFiveSimOperator(inputFiveSimOperator?.value || latestState?.fiveSimOperator);
  } else {
    patch.heroSmsApiKey = currentApiKey;
    patch.heroSmsMaxPrice = currentMaxPrice;
    patch.heroSmsCountryId = currentPrimary.id;
    patch.heroSmsCountryLabel = currentPrimary.label;
    patch.heroSmsCountryFallback = currentFallback;
  }

  syncLatestState(patch);
  setPhoneSmsProviderSelectValue(normalizedNextProvider);
  heroSmsCountrySelectionOrder = [];
  if (inputHeroSmsApiKey) {
    inputHeroSmsApiKey.value = normalizedNextProvider === PHONE_SMS_PROVIDER_FIVE_SIM
      ? String(latestState?.fiveSimApiKey || '')
      : String(latestState?.heroSmsApiKey || '');
  }
  if (inputHeroSmsMaxPrice) {
    inputHeroSmsMaxPrice.value = normalizedNextProvider === PHONE_SMS_PROVIDER_FIVE_SIM
      ? normalizeFiveSimMaxPriceValue(latestState?.fiveSimMaxPrice || '')
      : normalizeHeroSmsMaxPriceValue(latestState?.heroSmsMaxPrice || '');
  }
  if (inputFiveSimOperator) {
    inputFiveSimOperator.value = normalizeFiveSimOperator(latestState?.fiveSimOperator);
  }
  if (displayHeroSmsPriceTiers) displayHeroSmsPriceTiers.textContent = '未获取';
  if (displayPhoneSmsBalance) displayPhoneSmsBalance.textContent = '余额未获取';
  if (rowHeroSmsPriceTiers) rowHeroSmsPriceTiers.style.display = 'none';

  await loadHeroSmsCountries();
  const restoredPrimary = normalizedNextProvider === PHONE_SMS_PROVIDER_FIVE_SIM
    ? {
      id: normalizeFiveSimCountryId(latestState?.fiveSimCountryId),
      label: normalizeFiveSimCountryLabel(latestState?.fiveSimCountryLabel),
    }
    : {
      id: normalizeHeroSmsCountryId(latestState?.heroSmsCountryId),
      label: normalizeHeroSmsCountryLabel(latestState?.heroSmsCountryLabel),
    };
  const restoredFallback = normalizedNextProvider === PHONE_SMS_PROVIDER_FIVE_SIM
    ? normalizeFiveSimCountryFallbackList(latestState?.fiveSimCountryFallback || [])
    : normalizeHeroSmsCountryFallbackList(latestState?.heroSmsCountryFallback || []);
  applyHeroSmsFallbackSelection([restoredPrimary, ...restoredFallback], { includePrimary: true });
  updatePhoneVerificationSettingsUI();
  markSettingsDirty(true);
  saveSettings({ silent: true }).catch(() => {});
}

selectPhoneSmsProvider?.addEventListener('change', () => {
  switchPhoneSmsProvider(selectPhoneSmsProvider.value).catch((error) => {
    showToast(`切换接码平台失败：${error?.message || error}`, 'warn', 2200);
  });
});

inputPhoneVerificationEnabled?.addEventListener('change', () => {
  if (inputPhoneVerificationEnabled.checked) {
    setPhoneVerificationSectionExpanded(true);
  } else {
    setSignupMethod(SIGNUP_METHOD_EMAIL);
    updatePhoneVerificationSettingsUI();
    showToast('已切回邮箱注册', 'info', 1600);
  }
  markSettingsDirty(true);
  saveSettings({ silent: true }).catch(() => { });
});

signupMethodButtons.forEach((button) => {
  button.addEventListener('click', async () => {
    if (button.disabled) {
      return;
    }
    const nextSignupMethod = normalizeSignupMethod(button.dataset.signupMethod);
    const confirmed = await confirmCpaPhoneSignupIfNeeded({
      signupMethod: nextSignupMethod,
      panelMode: getSelectedPanelMode(),
    });
    if (!confirmed) {
      updateSignupMethodUI();
      return;
    }
    setSignupMethod(nextSignupMethod);
    updateSignupMethodUI();
    markSettingsDirty(true);
    saveSettings({ silent: true }).catch(() => { });
  });
});

selectPhoneSmsProvider?.addEventListener('change', async () => {
  if (selectPhoneSmsProvider) {
    selectPhoneSmsProvider.value = normalizePhoneSmsProviderValue(selectPhoneSmsProvider.value);
  }
  if (selectPhoneSmsProvider?.value === PHONE_SMS_PROVIDER_FIVE_SIM) {
    await loadFiveSimCountries().catch(() => { });
    applyFiveSimCountrySelection(
      Array.isArray(latestState?.fiveSimCountryOrder) ? latestState.fiveSimCountryOrder : []
    );
  } else if (selectPhoneSmsProvider?.value === PHONE_SMS_PROVIDER_NEXSMS) {
    await loadNexSmsCountries().catch(() => { });
    applyNexSmsCountrySelection(
      Array.isArray(latestState?.nexSmsCountryOrder) ? latestState.nexSmsCountryOrder : []
    );
  } else {
    await loadHeroSmsCountries().catch(() => { });
    const nextPrimaryCountryId = normalizeHeroSmsCountryId(latestState?.heroSmsCountryId, 0);
    const nextPrimaryCountries = nextPrimaryCountryId > 0
      ? [{
        id: nextPrimaryCountryId,
        label: normalizeHeroSmsCountryLabel(latestState?.heroSmsCountryLabel),
      }]
      : [];
    applyHeroSmsFallbackSelection(
      [
        ...nextPrimaryCountries,
        ...normalizeHeroSmsCountryFallbackList(
          Array.isArray(latestState?.heroSmsCountryFallback) ? latestState.heroSmsCountryFallback : []
        ),
      ],
      { includePrimary: true }
    );
  }
  updateHeroSmsPlatformDisplay();
  updatePhoneVerificationSettingsUI();
  if (rowHeroSmsPriceTiers) {
    rowHeroSmsPriceTiers.style.display = 'none';
  }
  markSettingsDirty(true);
  saveSettings({ silent: true }).catch(() => { });
});

inputAccountRunHistoryHelperBaseUrl?.addEventListener('input', () => {
  markSettingsDirty(true);
  scheduleSettingsAutoSave();
});

inputAccountRunHistoryHelperBaseUrl?.addEventListener('blur', () => {
  inputAccountRunHistoryHelperBaseUrl.value = normalizeAccountRunHistoryHelperBaseUrlValue(inputAccountRunHistoryHelperBaseUrl.value);
  saveSettings({ silent: true }).catch(() => { });
});

function syncAutoStepDelayInputs() {
  inputAutoStepDelaySeconds.value = formatAutoStepDelayInputValue(inputAutoStepDelaySeconds.value);
}

inputAutoStepDelaySeconds.addEventListener('input', () => {
  markSettingsDirty(true);
  scheduleSettingsAutoSave();
});
inputAutoStepDelaySeconds.addEventListener('blur', () => {
  syncAutoStepDelayInputs();
  saveSettings({ silent: true }).catch(() => { });
});

inputVerificationResendCount?.addEventListener('input', () => {
  markSettingsDirty(true);
  scheduleSettingsAutoSave();
});
inputVerificationResendCount?.addEventListener('blur', () => {
  inputVerificationResendCount.value = String(
    normalizeVerificationResendCount(
      inputVerificationResendCount.value,
      DEFAULT_VERIFICATION_RESEND_COUNT
    )
  );
  saveSettings({ silent: true }).catch(() => { });
});

inputHeroSmsApiKey?.addEventListener('input', () => {
  markSettingsDirty(true);
  scheduleSettingsAutoSave();
});
inputHeroSmsApiKey?.addEventListener('blur', () => {
  saveSettings({ silent: true }).catch(() => { });
});

inputFiveSimApiKey?.addEventListener('input', () => {
  markSettingsDirty(true);
  scheduleSettingsAutoSave();
});
inputFiveSimApiKey?.addEventListener('blur', () => {
  saveSettings({ silent: true }).catch(() => { });
});

inputFiveSimOperator?.addEventListener('input', () => {
  markSettingsDirty(true);
  scheduleSettingsAutoSave();
});
inputFiveSimOperator?.addEventListener('blur', () => {
  inputFiveSimOperator.value = normalizeFiveSimOperatorValue(inputFiveSimOperator.value);
  saveSettings({ silent: true }).catch(() => { });
});

inputFiveSimProduct?.addEventListener('input', () => {
  markSettingsDirty(true);
  scheduleSettingsAutoSave();
});
inputFiveSimProduct?.addEventListener('blur', () => {
  inputFiveSimProduct.value = normalizeFiveSimProductValue(inputFiveSimProduct.value);
  updateHeroSmsPlatformDisplay();
  saveSettings({ silent: true }).catch(() => { });
});

inputNexSmsApiKey?.addEventListener('input', () => {
  markSettingsDirty(true);
  scheduleSettingsAutoSave();
});
inputNexSmsApiKey?.addEventListener('blur', () => {
  saveSettings({ silent: true }).catch(() => { });
});

inputNexSmsServiceCode?.addEventListener('input', () => {
  markSettingsDirty(true);
  scheduleSettingsAutoSave();
});
inputNexSmsServiceCode?.addEventListener('blur', () => {
  inputNexSmsServiceCode.value = normalizeNexSmsServiceCodeValue(inputNexSmsServiceCode.value);
  updateHeroSmsPlatformDisplay();
  saveSettings({ silent: true }).catch(() => { });
});

inputHeroSmsReuseEnabled?.addEventListener('change', () => {
  markSettingsDirty(true);
  saveSettings({ silent: true }).catch(() => { });
});

inputFreePhoneReuseEnabled?.addEventListener('change', () => {
  if (!inputFreePhoneReuseEnabled.checked && inputFreePhoneReuseAutoEnabled) {
    inputFreePhoneReuseAutoEnabled.checked = false;
  }
  updatePhoneVerificationSettingsUI();
  markSettingsDirty(true);
  saveSettings({ silent: true }).catch(() => { });
});

inputFreePhoneReuseAutoEnabled?.addEventListener('change', () => {
  updatePhoneVerificationSettingsUI();
  markSettingsDirty(true);
  saveSettings({ silent: true }).catch(() => { });
});

btnSaveFreeReusablePhone?.addEventListener('click', async () => {
  const phoneNumber = String(inputFreeReusablePhone?.value || '').trim();
  if (!phoneNumber) {
    showToast?.('请先填写白嫖复用手机号。', 'warn', 2200);
    inputFreeReusablePhone?.focus?.();
    return;
  }
  try {
    const response = await chrome.runtime.sendMessage({
      type: 'SET_FREE_REUSABLE_PHONE', payload: { phoneNumber },
    });
    if (response?.error) {
      throw new Error(response.error);
    }
    await refreshFreeReusablePhoneStateFallback(response || {});
    showToast?.('已记录白嫖复用手机号。', 'success', 1800);
  } catch (error) {
    console.error('Failed to save free reusable phone:', error);
    showToast?.(`记录白嫖复用手机号失败：${error?.message || error}`, 'error', 4000);
  }
});

btnClearFreeReusablePhone?.addEventListener('click', async () => {
  try {
    const response = await chrome.runtime.sendMessage({
      type: 'CLEAR_FREE_REUSABLE_PHONE',
    });
    if (response?.error) {
      throw new Error(response.error);
    }
    await refreshFreeReusablePhoneStateFallback(response || {}, { clear: true });
    showToast?.('已清除白嫖复用手机号。', 'info', 1800);
  } catch (error) {
    console.error('Failed to clear free reusable phone:', error);
    showToast?.(`清除白嫖复用手机号失败：${error?.message || error}`, 'error', 4000);
  }
});

selectHeroSmsAcquirePriority?.addEventListener('change', () => {
  selectHeroSmsAcquirePriority.value = normalizeHeroSmsAcquirePriority(selectHeroSmsAcquirePriority.value);
  markSettingsDirty(true);
  saveSettings({ silent: true }).catch(() => { });
});
selectHeroSmsPreferredActivation?.addEventListener('change', () => {
  markSettingsDirty(true);
  saveSettings({ silent: true }).catch(() => { });
});
inputHeroSmsMaxPrice?.addEventListener('input', () => {
  markSettingsDirty(true);
});
inputHeroSmsMaxPrice?.addEventListener('blur', () => {
  inputHeroSmsMaxPrice.value = normalizePhoneSmsMaxPriceValue(inputHeroSmsMaxPrice.value, getSelectedPhoneSmsProvider());
  saveSettings({ silent: true }).catch(() => { });
});

inputFiveSimOperator?.addEventListener('input', () => {
  markSettingsDirty(true);
  scheduleSettingsAutoSave();
});
inputFiveSimOperator?.addEventListener('blur', () => {
  inputFiveSimOperator.value = normalizeFiveSimOperator(inputFiveSimOperator.value);
  saveSettings({ silent: true }).catch(() => { });
});
inputHeroSmsPreferredPrice?.addEventListener('input', () => {
  markSettingsDirty(true);
  scheduleSettingsAutoSave();
});
inputHeroSmsPreferredPrice?.addEventListener('blur', () => {
  inputHeroSmsPreferredPrice.value = normalizeHeroSmsMaxPriceValue(inputHeroSmsPreferredPrice.value);
  saveSettings({ silent: true }).catch(() => { });
});

selectFiveSimCountry?.addEventListener('change', () => {
  syncFiveSimCountrySelectionOrderFromSelect({
    enforceMax: true,
    ensureDefault: false,
    showLimitToast: true,
  });
  markSettingsDirty(true);
  saveSettings({ silent: true }).catch(() => { });
});

selectNexSmsCountry?.addEventListener('change', () => {
  syncNexSmsCountrySelectionOrderFromSelect({
    enforceMax: true,
    ensureDefault: false,
    showLimitToast: true,
  });
  updateHeroSmsPlatformDisplay();
  markSettingsDirty(true);
  saveSettings({ silent: true }).catch(() => { });
});

btnHeroSmsPricePreview?.addEventListener('click', async () => {
  try {
    await previewHeroSmsPriceTiers();
    if (typeof showToast === 'function') {
      showToast('已刷新接码国家价格预览。', 'info', 1600);
    }
  } catch (error) {
    if (typeof showToast === 'function') {
      showToast(`价格预览失败：${error?.message || error}`, 'warn', 2200);
    }
  }
});

btnPhoneSmsBalance?.addEventListener('click', async () => {
  try {
    await previewPhoneSmsBalance();
    if (typeof showToast === 'function') {
      showToast('已刷新接码平台余额。', 'info', 1600);
    }
  } catch (error) {
    if (typeof showToast === 'function') {
      showToast(`余额查询失败：${error?.message || error}`, 'warn', 2200);
    }
  }
});

inputPhoneReplacementLimit?.addEventListener('input', () => {
  markSettingsDirty(true);
  scheduleSettingsAutoSave();
});
inputPhoneReplacementLimit?.addEventListener('blur', () => {
  inputPhoneReplacementLimit.value = String(
    normalizePhoneVerificationReplacementLimit(
      inputPhoneReplacementLimit.value,
      DEFAULT_PHONE_VERIFICATION_REPLACEMENT_LIMIT
    )
  );
  saveSettings({ silent: true }).catch(() => { });
});

inputPhoneCodeWaitSeconds?.addEventListener('input', () => {
  markSettingsDirty(true);
  scheduleSettingsAutoSave();
});
inputPhoneCodeWaitSeconds?.addEventListener('blur', () => {
  inputPhoneCodeWaitSeconds.value = String(
    normalizePhoneCodeWaitSecondsValue(inputPhoneCodeWaitSeconds.value, DEFAULT_PHONE_CODE_WAIT_SECONDS)
  );
  saveSettings({ silent: true }).catch(() => { });
});

inputPhoneCodeTimeoutWindows?.addEventListener('input', () => {
  markSettingsDirty(true);
  scheduleSettingsAutoSave();
});
inputPhoneCodeTimeoutWindows?.addEventListener('blur', () => {
  inputPhoneCodeTimeoutWindows.value = String(
    normalizePhoneCodeTimeoutWindowsValue(
      inputPhoneCodeTimeoutWindows.value,
      DEFAULT_PHONE_CODE_TIMEOUT_WINDOWS
    )
  );
  saveSettings({ silent: true }).catch(() => { });
});

inputPhoneCodePollIntervalSeconds?.addEventListener('input', () => {
  markSettingsDirty(true);
  scheduleSettingsAutoSave();
});
inputPhoneCodePollIntervalSeconds?.addEventListener('blur', () => {
  inputPhoneCodePollIntervalSeconds.value = String(
    normalizePhoneCodePollIntervalSecondsValue(
      inputPhoneCodePollIntervalSeconds.value,
      DEFAULT_PHONE_CODE_POLL_INTERVAL_SECONDS
    )
  );
  saveSettings({ silent: true }).catch(() => { });
});

inputPhoneCodePollMaxRounds?.addEventListener('input', () => {
  markSettingsDirty(true);
  scheduleSettingsAutoSave();
});
inputPhoneCodePollMaxRounds?.addEventListener('blur', () => {
  inputPhoneCodePollMaxRounds.value = String(
    normalizePhoneCodePollMaxRoundsValue(
      inputPhoneCodePollMaxRounds.value,
      DEFAULT_PHONE_CODE_POLL_MAX_ROUNDS
    )
  );
  saveSettings({ silent: true }).catch(() => { });
});
selectHeroSmsCountry?.addEventListener('change', () => {
  syncHeroSmsFallbackSelectionOrderFromSelect({
    enforceMax: true,
    ensureDefault: false,
    showLimitToast: true,
  });
  updateHeroSmsPlatformDisplay();
  markSettingsDirty(true);
  saveSettings({ silent: true }).catch(() => { });
});

selectHeroSmsCountryFallback?.addEventListener('change', () => {
  syncHeroSmsFallbackSelectionOrderFromSelect({
    enforceMax: true,
    ensureDefault: false,
    showLimitToast: true,
  });
  updateHeroSmsPlatformDisplay();
  markSettingsDirty(true);
  saveSettings({ silent: true }).catch(() => { });
});

btnHeroSmsCountryMenu?.addEventListener('click', (event) => {
  event.preventDefault();
  const nextOpen = btnHeroSmsCountryMenu.getAttribute('aria-expanded') !== 'true';
  setHeroSmsCountryMenuOpen(nextOpen);
});

btnHeroSmsCountryClear?.addEventListener('click', () => {
  if (!selectHeroSmsCountry) {
    return;
  }
  Array.from(selectHeroSmsCountry.options).forEach((option) => {
    option.selected = false;
  });
  heroSmsCountryMenuSearchKeyword = '';
  syncHeroSmsFallbackSelectionOrderFromSelect({
    enforceMax: true,
    ensureDefault: false,
    showLimitToast: false,
  });
  updateHeroSmsPlatformDisplay();
  setHeroSmsCountryMenuOpen(false);
  markSettingsDirty(true);
  saveSettings({ silent: true }).catch(() => { });
  if (typeof showToast === 'function') {
    showToast('已清空国家优先级。', 'info', 1800);
  }
});

btnFiveSimCountryMenu?.addEventListener('click', (event) => {
  event.preventDefault();
  const nextOpen = btnFiveSimCountryMenu.getAttribute('aria-expanded') !== 'true';
  setFiveSimCountryMenuOpen(nextOpen);
});

btnFiveSimCountryClear?.addEventListener('click', () => {
  if (!selectFiveSimCountry) {
    return;
  }
  Array.from(selectFiveSimCountry.options).forEach((option) => {
    option.selected = false;
  });
  fiveSimCountryMenuSearchKeyword = '';
  syncFiveSimCountrySelectionOrderFromSelect({
    enforceMax: true,
    ensureDefault: false,
    showLimitToast: false,
  });
  setFiveSimCountryMenuOpen(false);
  markSettingsDirty(true);
  saveSettings({ silent: true }).catch(() => { });
  if (typeof showToast === 'function') {
    showToast('已清空国家优先级。', 'info', 1800);
  }
});

btnNexSmsCountryMenu?.addEventListener('click', (event) => {
  event.preventDefault();
  const nextOpen = btnNexSmsCountryMenu.getAttribute('aria-expanded') !== 'true';
  setNexSmsCountryMenuOpen(nextOpen);
});

btnNexSmsCountryClear?.addEventListener('click', () => {
  if (!selectNexSmsCountry) {
    return;
  }
  Array.from(selectNexSmsCountry.options).forEach((option) => {
    option.selected = false;
  });
  nexSmsCountryMenuSearchKeyword = '';
  syncNexSmsCountrySelectionOrderFromSelect({
    enforceMax: true,
    ensureDefault: false,
    showLimitToast: false,
  });
  updateHeroSmsPlatformDisplay();
  setNexSmsCountryMenuOpen(false);
  markSettingsDirty(true);
  saveSettings({ silent: true }).catch(() => { });
  if (typeof showToast === 'function') {
    showToast('已清空国家优先级。', 'info', 1800);
  }
});

btnPhoneSmsProviderOrderMenu?.addEventListener('click', (event) => {
  event.preventDefault();
  const nextOpen = btnPhoneSmsProviderOrderMenu.getAttribute('aria-expanded') !== 'true';
  setPhoneSmsProviderOrderMenuOpen(nextOpen);
});

selectPhoneSmsProviderOrder?.addEventListener('change', () => {
  const nextOrder = syncPhoneSmsProviderOrderFromSelect({
    ensureDefault: false,
    enforceMax: true,
    syncProvider: false,
    showLimitToast: true,
  });
  updatePhoneVerificationSettingsUI();
  updateHeroSmsPlatformDisplay();
  updatePhoneSmsProviderOrderSummary(nextOrder);
  markSettingsDirty(true);
  saveSettings({ silent: true }).catch(() => { });
});

btnPhoneSmsProviderOrderReset?.addEventListener('click', () => {
  const nextOrder = clearPhoneSmsProviderOrderSelection({
    syncProvider: false,
  });
  setPhoneSmsProviderOrderMenuOpen(false);
  updatePhoneVerificationSettingsUI();
  updateHeroSmsPlatformDisplay();
  updatePhoneSmsProviderOrderSummary(nextOrder);
  markSettingsDirty(true);
  saveSettings({ silent: true }).catch(() => { });
  if (typeof showToast === 'function') {
    showToast('已清空服务商顺序。', 'info', 1800);
  }
});

// ============================================================
// Listen for Background broadcasts
// ============================================================

chrome.runtime.onMessage.addListener((message, _sender, sendResponse) => {
  switch (message.type) {
    case 'REQUEST_CUSTOM_VERIFICATION_BYPASS_CONFIRMATION': {
      (async () => {
        const step = Number(message.payload?.step);
        const result = await openCustomVerificationConfirmDialog(step);
        sendResponse(result || { confirmed: false, addPhoneDetected: false });
      })().catch((err) => {
        sendResponse({ error: err.message });
      });
      return true;
    }

    case 'REQUEST_GOPAY_OTP_INPUT': {
      (async () => {
        const result = await openGoPayOtpInputDialog(message.payload || {});
        sendResponse(result || { cancelled: true, code: '' });
      })().catch((err) => {
        sendResponse({ error: err.message });
      });
      return true;
    }

    case 'SECURITY_BLOCKED_ALERT': {
      openConfirmModal({
        title: message.payload?.title || '流程已完全停止',
        message: message.payload?.message || '检测到安全风控，当前流程已完全停止。',
        alert: message.payload?.alert || { text: '检测到 Cloudflare 风控，请暂停当前操作。', tone: 'danger' },
        confirmLabel: '我知道了',
        confirmVariant: 'btn-danger',
      }).catch(() => { });
      break;
    }

    case 'LOG_ENTRY':
      appendLog(message.payload);
      if (message.payload.level === 'error') {
        showToast(message.payload.message, 'error');
      }
      break;

    case 'STEP_STATUS_CHANGED': {
      const { step, status } = message.payload;
      updateStepUI(step, status);
      chrome.runtime.sendMessage({ type: 'GET_STATE', source: 'sidepanel' }).then(state => {
        syncLatestState(state);
        syncAutoRunState(state);
        updateStatusDisplay(latestState);
        updateButtonStates();
        if (status === 'completed' || status === 'manual_completed' || status === 'skipped') {
          syncPasswordField(state);
          if (state.oauthUrl) {
            displayOauthUrl.textContent = state.oauthUrl;
            displayOauthUrl.classList.add('has-value');
          }
          if (state.localhostUrl) {
            displayLocalhostUrl.textContent = state.localhostUrl;
            displayLocalhostUrl.classList.add('has-value');
          }
        }
      }
      ).catch(() => { });
      break;
    }

    case 'AUTO_RUN_RESET': {
      // Full UI reset for next run
      syncLatestState({
        oauthUrl: null,
        localhostUrl: null,
        email: null,
        password: null,
        stepStatuses: STEP_DEFAULT_STATUSES,
        logs: [],
        scheduledAutoRunAt: null,
        autoRunCountdownAt: null,
        autoRunCountdownTitle: '',
        autoRunCountdownNote: '',
      });
      displayOauthUrl.textContent = '等待中...';
      displayOauthUrl.classList.remove('has-value');
      displayLocalhostUrl.textContent = '等待中...';
      displayLocalhostUrl.classList.remove('has-value');
      inputEmail.value = '';
      if (typeof inputSignupPhone !== 'undefined' && inputSignupPhone) {
        inputSignupPhone.value = '';
      }
      syncLatestState({
        signupPhoneNumber: '',
        accountIdentifierType: null,
        accountIdentifier: '',
      });
      if (typeof syncSignupPhoneInputFromState === 'function') {
        syncSignupPhoneInputFromState(latestState);
      }
      displayStatus.textContent = '就绪';
      statusBar.className = 'status-bar';
      logArea.innerHTML = '';
      resetIcloudManager();
      resetLuckmailManager();
      resetCustomEmailPoolManager();
      document.querySelectorAll('.step-row').forEach(row => row.className = 'step-row');
      document.querySelectorAll('.step-status').forEach(el => el.textContent = '');
      syncAutoRunState({
        autoRunning: false,
        autoRunPhase: 'idle',
        autoRunCurrentRun: 0,
        autoRunTotalRuns: 1,
        autoRunAttemptRun: 0,
        scheduledAutoRunAt: null,
        autoRunCountdownAt: null,
        autoRunCountdownTitle: '',
        autoRunCountdownNote: '',
      });
      applyAutoRunStatus(currentAutoRun);
      updateProgressCounter();
      updateButtonStates();
      renderPayPalAccounts();
      renderHotmailAccounts();
      renderMail2925Accounts();
      if (isLuckmailProvider()) {
        queueLuckmailPurchaseRefresh();
      }
      break;
    }

    case 'DATA_UPDATED': {
      syncLatestState(message.payload);
      if (message.payload.operationDelayEnabled !== undefined && typeof applyOperationDelayState === 'function') {
        applyOperationDelayState(message.payload);
      }
      if (message.payload.email !== undefined) {
        inputEmail.value = message.payload.email || '';
        queueCustomEmailPoolRefresh();
      }
      if (
        message.payload.signupPhoneNumber !== undefined
        || message.payload.accountIdentifierType !== undefined
        || message.payload.accountIdentifier !== undefined
      ) {
        if (typeof syncSignupPhoneInputFromState === 'function') {
          syncSignupPhoneInputFromState(latestState);
        }
      }
      if (
        message.payload.password !== undefined
        || message.payload.customPassword !== undefined
        || message.payload.contributionMode !== undefined
      ) {
        syncPasswordField(latestState || {});
      }
      if (message.payload.localCpaStep9Mode !== undefined) {
        setLocalCpaStep9Mode(message.payload.localCpaStep9Mode);
      }
      if (message.payload.panelMode !== undefined) {
        selectPanelMode.value = normalizePanelMode(message.payload.panelMode || 'cpa');
        updatePanelModeUI();
      }
      if (
        message.payload.sub2apiGroupName !== undefined
        || message.payload.sub2apiGroupNames !== undefined
      ) {
        renderSub2ApiGroupOptions(latestState, latestState?.sub2apiGroupName || '');
      }
      if (
        message.payload.ipProxyEnabled !== undefined
        || message.payload.ipProxyService !== undefined
        || message.payload.ipProxyServiceProfiles !== undefined
        || message.payload.ipProxyMode !== undefined
        || message.payload.ipProxyApiUrl !== undefined
        || message.payload.ipProxyAccountList !== undefined
        || message.payload.ipProxyAccountSessionPrefix !== undefined
        || message.payload.ipProxyAccountLifeMinutes !== undefined
        || message.payload.ipProxyPoolTargetCount !== undefined
        || message.payload.ipProxyHost !== undefined
        || message.payload.ipProxyPort !== undefined
        || message.payload.ipProxyProtocol !== undefined
        || message.payload.ipProxyUsername !== undefined
        || message.payload.ipProxyPassword !== undefined
        || message.payload.ipProxyRegion !== undefined
        || message.payload.ipProxyApiPool !== undefined
        || message.payload.ipProxyApiCurrentIndex !== undefined
        || message.payload.ipProxyApiCurrent !== undefined
        || message.payload.ipProxyAccountPool !== undefined
        || message.payload.ipProxyAccountCurrentIndex !== undefined
        || message.payload.ipProxyAccountCurrent !== undefined
        || message.payload.ipProxyCurrent !== undefined
        || message.payload.ipProxyCurrentIndex !== undefined
        || message.payload.ipProxyPool !== undefined
        || message.payload.ipProxyApplied !== undefined
        || message.payload.ipProxyAppliedReason !== undefined
        || message.payload.ipProxyAppliedHost !== undefined
        || message.payload.ipProxyAppliedPort !== undefined
        || message.payload.ipProxyAppliedRegion !== undefined
        || message.payload.ipProxyAppliedHasAuth !== undefined
        || message.payload.ipProxyAppliedWarning !== undefined
        || message.payload.ipProxyAppliedExitIp !== undefined
        || message.payload.ipProxyAppliedExitRegion !== undefined
        || message.payload.ipProxyAppliedExitDetecting !== undefined
        || message.payload.ipProxyAppliedExitError !== undefined
        || message.payload.ipProxyAppliedExitSource !== undefined
        || message.payload.ipProxyAutoSyncEnabled !== undefined
        || message.payload.ipProxyAutoSyncIntervalMinutes !== undefined
      ) {
        const hasIpProxyConfigPayload = (
          message.payload.ipProxyService !== undefined
          || message.payload.ipProxyServiceProfiles !== undefined
          || message.payload.ipProxyMode !== undefined
          || message.payload.ipProxyApiUrl !== undefined
          || message.payload.ipProxyAccountList !== undefined
          || message.payload.ipProxyAccountSessionPrefix !== undefined
          || message.payload.ipProxyAccountLifeMinutes !== undefined
          || message.payload.ipProxyPoolTargetCount !== undefined
          || message.payload.ipProxyHost !== undefined
          || message.payload.ipProxyPort !== undefined
          || message.payload.ipProxyProtocol !== undefined
          || message.payload.ipProxyUsername !== undefined
          || message.payload.ipProxyPassword !== undefined
          || message.payload.ipProxyRegion !== undefined
        );
        const selectedProxyService = normalizeIpProxyService(
          message.payload.ipProxyService !== undefined
            ? message.payload.ipProxyService
            : latestState?.ipProxyService
        );
        const mergedProxyState = {
          ...(latestState || {}),
          ...message.payload,
          ipProxyService: selectedProxyService,
        };
        let normalizedProxyProfiles = (mergedProxyState?.ipProxyServiceProfiles || {});
        if (typeof normalizeIpProxyServiceProfiles === 'function') {
          normalizedProxyProfiles = normalizeIpProxyServiceProfiles(
            mergedProxyState?.ipProxyServiceProfiles || {},
            mergedProxyState
          );
        }
        if (typeof buildIpProxyServiceProfileFromFlatState === 'function') {
          normalizedProxyProfiles[selectedProxyService] = buildIpProxyServiceProfileFromFlatState(mergedProxyState);
        }
        if (selectIpProxyService) {
          selectIpProxyService.value = selectedProxyService;
        }
        if (message.payload.ipProxyEnabled !== undefined) {
          setIpProxyEnabled(Boolean(message.payload.ipProxyEnabled));
        }
        if (message.payload.ipProxyAutoSyncEnabled !== undefined && inputIpProxyAutoSyncEnabled) {
          inputIpProxyAutoSyncEnabled.checked = Boolean(message.payload.ipProxyAutoSyncEnabled);
        }
        if (message.payload.ipProxyAutoSyncIntervalMinutes !== undefined && inputIpProxyAutoSyncIntervalMinutes) {
          const numeric = Number.parseInt(String(message.payload.ipProxyAutoSyncIntervalMinutes ?? '').trim(), 10);
          inputIpProxyAutoSyncIntervalMinutes.value = String(
            Number.isFinite(numeric) ? Math.max(1, Math.min(1440, numeric)) : 15
          );
        }
        if (message.payload.ipProxyApiUrl !== undefined && inputIpProxyApiUrl) {
          inputIpProxyApiUrl.value = String(message.payload.ipProxyApiUrl || '').trim();
        }
        if (hasIpProxyConfigPayload) {
          const activeProxyProfile = typeof getIpProxyServiceProfile === 'function'
            ? getIpProxyServiceProfile(selectedProxyService, {
              ...mergedProxyState,
              ipProxyServiceProfiles: normalizedProxyProfiles,
            })
            : {
              mode: typeof normalizeIpProxyModeForCurrentRelease === 'function'
                ? normalizeIpProxyModeForCurrentRelease(mergedProxyState?.ipProxyMode)
                : normalizeIpProxyMode(mergedProxyState?.ipProxyMode),
              apiUrl: String(mergedProxyState?.ipProxyApiUrl || '').trim(),
              accountList: normalizeIpProxyAccountList(mergedProxyState?.ipProxyAccountList || ''),
              accountSessionPrefix: normalizeIpProxyAccountSessionPrefix(mergedProxyState?.ipProxyAccountSessionPrefix || ''),
              accountLifeMinutes: normalizeIpProxyAccountLifeMinutes(mergedProxyState?.ipProxyAccountLifeMinutes || ''),
              poolTargetCount: normalizeIpProxyPoolTargetCount(mergedProxyState?.ipProxyPoolTargetCount || '', 20),
              host: String(mergedProxyState?.ipProxyHost || '').trim(),
              port: String(normalizeIpProxyPort(mergedProxyState?.ipProxyPort || '') || ''),
              protocol: normalizeIpProxyProtocol(mergedProxyState?.ipProxyProtocol),
              username: String(mergedProxyState?.ipProxyUsername || '').trim(),
              password: String(mergedProxyState?.ipProxyPassword || ''),
              region: String(mergedProxyState?.ipProxyRegion || '').trim(),
            };
          if (typeof applyIpProxyServiceProfileToInputs === 'function') {
            applyIpProxyServiceProfileToInputs(activeProxyProfile);
          } else {
            setIpProxyMode(activeProxyProfile.mode);
            if (inputIpProxyApiUrl) inputIpProxyApiUrl.value = String(activeProxyProfile.apiUrl || '').trim();
            if (inputIpProxyAccountList) inputIpProxyAccountList.value = activeProxyProfile.accountList;
            if (inputIpProxyAccountSessionPrefix) inputIpProxyAccountSessionPrefix.value = activeProxyProfile.accountSessionPrefix;
            if (inputIpProxyAccountLifeMinutes) inputIpProxyAccountLifeMinutes.value = activeProxyProfile.accountLifeMinutes;
            if (inputIpProxyPoolTargetCount) inputIpProxyPoolTargetCount.value = activeProxyProfile.poolTargetCount;
            if (inputIpProxyHost) inputIpProxyHost.value = activeProxyProfile.host;
            if (inputIpProxyPort) inputIpProxyPort.value = activeProxyProfile.port;
            if (selectIpProxyProtocol) selectIpProxyProtocol.value = normalizeIpProxyProtocol(activeProxyProfile.protocol);
            if (inputIpProxyUsername) inputIpProxyUsername.value = activeProxyProfile.username;
            if (inputIpProxyPassword) inputIpProxyPassword.value = activeProxyProfile.password;
            if (inputIpProxyRegion) inputIpProxyRegion.value = activeProxyProfile.region;
          }
          syncLatestState({
            ipProxyService: selectedProxyService,
            ipProxyServiceProfiles: normalizedProxyProfiles,
            ...(typeof buildIpProxyStatePatchFromServiceProfile === 'function'
              ? buildIpProxyStatePatchFromServiceProfile(selectedProxyService, activeProxyProfile)
              : {}),
          });
        } else {
          syncLatestState({
            ipProxyService: selectedProxyService,
            ipProxyServiceProfiles: normalizedProxyProfiles,
          });
        }
        updateIpProxyUI(latestState);
      }
      if (message.payload.oauthUrl !== undefined) {
        displayOauthUrl.textContent = message.payload.oauthUrl || '等待中...';
        displayOauthUrl.classList.toggle('has-value', Boolean(message.payload.oauthUrl));
      }
      if (message.payload.localhostUrl !== undefined) {
        displayLocalhostUrl.textContent = message.payload.localhostUrl || '等待中...';
        displayLocalhostUrl.classList.toggle('has-value', Boolean(message.payload.localhostUrl));
      }
      if (message.payload.cloudflareTempEmailBaseUrl !== undefined) {
        inputTempEmailBaseUrl.value = message.payload.cloudflareTempEmailBaseUrl || '';
      }
      if (message.payload.cloudflareTempEmailAdminAuth !== undefined) {
        inputTempEmailAdminAuth.value = message.payload.cloudflareTempEmailAdminAuth || '';
      }
      if (message.payload.cloudflareTempEmailCustomAuth !== undefined) {
        inputTempEmailCustomAuth.value = message.payload.cloudflareTempEmailCustomAuth || '';
      }
      if (message.payload.cloudflareTempEmailReceiveMailbox !== undefined) {
        inputTempEmailReceiveMailbox.value = message.payload.cloudflareTempEmailReceiveMailbox || '';
      }
      if (message.payload.cloudflareTempEmailUseRandomSubdomain !== undefined && inputTempEmailUseRandomSubdomain) {
        inputTempEmailUseRandomSubdomain.checked = Boolean(message.payload.cloudflareTempEmailUseRandomSubdomain);
      }
      if (message.payload.cloudflareTempEmailDomain !== undefined || message.payload.cloudflareTempEmailDomains !== undefined) {
        renderCloudflareTempEmailDomainOptions(message.payload.cloudflareTempEmailDomain || latestState?.cloudflareTempEmailDomain || '');
      }
      if (
        message.payload.cloudflareTempEmailUseRandomSubdomain !== undefined
        || message.payload.cloudflareTempEmailDomain !== undefined
        || message.payload.cloudflareTempEmailDomains !== undefined
      ) {
        updateMailProviderUI();
      }
      if (message.payload.cloudMailBaseUrl !== undefined && inputCloudMailBaseUrl) {
        inputCloudMailBaseUrl.value = message.payload.cloudMailBaseUrl || '';
      }
      if (message.payload.cloudMailAdminEmail !== undefined && inputCloudMailAdminEmail) {
        inputCloudMailAdminEmail.value = message.payload.cloudMailAdminEmail || '';
      }
      if (message.payload.cloudMailAdminPassword !== undefined && inputCloudMailAdminPassword) {
        inputCloudMailAdminPassword.value = message.payload.cloudMailAdminPassword || '';
      }
      if (message.payload.cloudMailReceiveMailbox !== undefined && inputCloudMailReceiveMailbox) {
        inputCloudMailReceiveMailbox.value = message.payload.cloudMailReceiveMailbox || '';
      }
      if (message.payload.cloudMailDomain !== undefined && inputCloudMailDomain) {
        inputCloudMailDomain.value = message.payload.cloudMailDomain || '';
      }
      if (message.payload.plusModeEnabled !== undefined && inputPlusModeEnabled) {
        inputPlusModeEnabled.checked = Boolean(message.payload.plusModeEnabled);
      }
      if (message.payload.plusPaymentMethod !== undefined && selectPlusPaymentMethod) {
        selectPlusPaymentMethod.value = normalizePlusPaymentMethod(message.payload.plusPaymentMethod);
      }
      if (message.payload.gopayHelperPhoneMode !== undefined && selectGpcHelperPhoneMode) {
        selectGpcHelperPhoneMode.value = normalizeGpcHelperPhoneModeValue(message.payload.gopayHelperPhoneMode);
      }
      if (message.payload.gopayHelperAutoModeEnabled === false && selectGpcHelperPhoneMode?.value === GPC_HELPER_PHONE_MODE_AUTO) {
        selectGpcHelperPhoneMode.value = GPC_HELPER_PHONE_MODE_MANUAL;
        syncLatestState({ gopayHelperPhoneMode: GPC_HELPER_PHONE_MODE_MANUAL });
        showToast('当前 API Key 未开通自动模式，已切回手动模式。', 'warn', 2200);
      }
      if (message.payload.gopayHelperOtpChannel !== undefined && selectGpcHelperOtpChannel) {
        selectGpcHelperOtpChannel.value = normalizeGpcOtpChannelValue(message.payload.gopayHelperOtpChannel);
      }
      if (message.payload.gopayHelperLocalSmsHelperEnabled !== undefined && inputGpcHelperLocalSmsEnabled) {
        inputGpcHelperLocalSmsEnabled.checked = Boolean(message.payload.gopayHelperLocalSmsHelperEnabled);
      }
      if (message.payload.gopayHelperLocalSmsHelperUrl !== undefined && inputGpcHelperLocalSmsUrl) {
        inputGpcHelperLocalSmsUrl.value = normalizeGpcLocalSmsHelperBaseUrlValue(message.payload.gopayHelperLocalSmsHelperUrl);
      }
      if (message.payload.gopayHelperBalance !== undefined || message.payload.gopayHelperBalanceError !== undefined) {
        if (typeof displayGpcHelperBalance !== 'undefined' && displayGpcHelperBalance) {
          const balanceText = String(message.payload.gopayHelperBalance ?? latestState?.gopayHelperBalance ?? '').trim();
          const balanceError = String(message.payload.gopayHelperBalanceError ?? latestState?.gopayHelperBalanceError ?? '').trim();
          displayGpcHelperBalance.textContent = balanceError
            ? `余额查询失败：${balanceError}`
            : (balanceText || '余额已更新');
        }
      }
      if (
        message.payload.plusModeEnabled !== undefined
        || message.payload.plusPaymentMethod !== undefined
        || message.payload.gopayHelperPhoneMode !== undefined
        || message.payload.gopayHelperAutoModeEnabled !== undefined
        || message.payload.gopayHelperOtpChannel !== undefined
        || message.payload.gopayHelperLocalSmsHelperEnabled !== undefined
      ) {
        syncStepDefinitionsForMode(
          Boolean(latestState?.plusModeEnabled),
          latestState?.plusPaymentMethod,
          { render: true }
        );
        updatePlusModeUI();
        updateSignupMethodUI({ notify: true });
      }
      if (
        message.payload.plusManualConfirmationPending !== undefined
        || message.payload.plusManualConfirmationRequestId !== undefined
        || message.payload.plusManualConfirmationStep !== undefined
        || message.payload.plusManualConfirmationMethod !== undefined
        || message.payload.plusManualConfirmationTitle !== undefined
        || message.payload.plusManualConfirmationMessage !== undefined
      ) {
        void syncPlusManualConfirmationDialog();
      }
      if (message.payload.currentHotmailAccountId !== undefined || message.payload.hotmailAccounts !== undefined) {
        renderHotmailAccounts();
        if (selectMailProvider.value === 'hotmail-api') {
          inputEmail.value = getCurrentHotmailEmail();
        }
      }
      if (message.payload.currentPayPalAccountId !== undefined || message.payload.paypalAccounts !== undefined) {
        renderPayPalAccounts();
      }
      if (message.payload.currentMail2925AccountId !== undefined || message.payload.mail2925Accounts !== undefined) {
        renderMail2925Accounts();
        if (selectMailProvider.value === '2925') {
          setManagedAliasBaseEmailInputForProvider('2925', latestState);
        }
      }
      if (message.payload.customEmailPoolEntries !== undefined || message.payload.customEmailPool !== undefined) {
        setCustomEmailPoolEntriesState(restoreCustomEmailPoolEntriesFromState({
          ...latestState,
          ...message.payload,
        }));
        syncRunCountFromConfiguredEmailPool();
        queueCustomEmailPoolRefresh();
      }
      if (message.payload.luckmailApiKey !== undefined) {
        inputLuckmailApiKey.value = message.payload.luckmailApiKey || '';
      }
      if (message.payload.luckmailBaseUrl !== undefined) {
        inputLuckmailBaseUrl.value = normalizeLuckmailBaseUrl(message.payload.luckmailBaseUrl);
      }
      if (message.payload.luckmailEmailType !== undefined) {
        selectLuckmailEmailType.value = normalizeLuckmailEmailType(message.payload.luckmailEmailType);
      }
      if (message.payload.luckmailDomain !== undefined) {
        inputLuckmailDomain.value = message.payload.luckmailDomain || '';
      }
      if (message.payload.luckmailUsedPurchases !== undefined && isLuckmailProvider()) {
        queueLuckmailPurchaseRefresh();
      }
      if (message.payload.currentLuckmailPurchase !== undefined && isLuckmailProvider()) {
        inputEmail.value = getCurrentLuckmailEmail();
        queueLuckmailPurchaseRefresh();
      }
      if (message.payload.autoDeleteUsedIcloudAlias !== undefined && checkboxAutoDeleteIcloud) {
        checkboxAutoDeleteIcloud.checked = Boolean(message.payload.autoDeleteUsedIcloudAlias);
      }
      if (message.payload.accountRunHistoryHelperBaseUrl !== undefined && inputAccountRunHistoryHelperBaseUrl) {
        inputAccountRunHistoryHelperBaseUrl.value = normalizeAccountRunHistoryHelperBaseUrlValue(message.payload.accountRunHistoryHelperBaseUrl);
        updateAccountRunHistorySettingsUI();
      }
      if (message.payload.icloudHostPreference !== undefined && selectIcloudHostPreference) {
        const hostPreference = String(message.payload.icloudHostPreference || '').trim().toLowerCase();
        selectIcloudHostPreference.value = hostPreference === 'icloud.com'
          ? 'icloud.com'
          : (hostPreference === 'icloud.com.cn' ? 'icloud.com.cn' : 'auto');
        updateMailProviderUI();
      }
      if (message.payload.icloudTargetMailboxType !== undefined && selectIcloudTargetMailboxType) {
        selectIcloudTargetMailboxType.value = normalizeIcloudTargetMailboxType(message.payload.icloudTargetMailboxType);
        updateMailProviderUI();
      }
      if (message.payload.icloudForwardMailProvider !== undefined && selectIcloudForwardMailProvider) {
        selectIcloudForwardMailProvider.value = normalizeIcloudForwardMailProvider(message.payload.icloudForwardMailProvider);
        updateMailProviderUI();
      }
      if (message.payload.icloudFetchMode !== undefined && selectIcloudFetchMode) {
        selectIcloudFetchMode.value = normalizeIcloudFetchMode(message.payload.icloudFetchMode);
      }
      if (message.payload.autoRunSkipFailures !== undefined) {
        inputAutoSkipFailures.checked = Boolean(message.payload.autoRunSkipFailures);
        updateFallbackThreadIntervalInputState();
      }
      if (message.payload.autoRunDelayEnabled !== undefined) {
        inputAutoDelayEnabled.checked = Boolean(message.payload.autoRunDelayEnabled);
        updateAutoDelayInputState();
      }
      if (
        message.payload.step6CookieCleanupEnabled !== undefined
        && typeof inputStep6CookieCleanupEnabled !== 'undefined'
        && inputStep6CookieCleanupEnabled
      ) {
        inputStep6CookieCleanupEnabled.checked = Boolean(message.payload.step6CookieCleanupEnabled);
      }
      if (message.payload.autoRunDelayMinutes !== undefined) {
        inputAutoDelayMinutes.value = String(normalizeAutoDelayMinutes(message.payload.autoRunDelayMinutes));
      }
      if (message.payload.autoRunFallbackThreadIntervalMinutes !== undefined) {
        inputAutoSkipFailuresThreadIntervalMinutes.value = String(
          normalizeAutoRunThreadIntervalMinutes(message.payload.autoRunFallbackThreadIntervalMinutes)
        );
        updateFallbackThreadIntervalInputState();
      }
      if (message.payload.autoStepDelaySeconds !== undefined) {
        inputAutoStepDelaySeconds.value = formatAutoStepDelayInputValue(message.payload.autoStepDelaySeconds);
      }
      if (message.payload.oauthFlowTimeoutEnabled !== undefined && typeof inputOAuthFlowTimeoutEnabled !== 'undefined' && inputOAuthFlowTimeoutEnabled) {
        inputOAuthFlowTimeoutEnabled.checked = Boolean(message.payload.oauthFlowTimeoutEnabled);
      }
      if (
        (
          message.payload.verificationResendCount !== undefined
          || message.payload.signupVerificationResendCount !== undefined
          || message.payload.loginVerificationResendCount !== undefined
        )
        && inputVerificationResendCount
      ) {
        const nextVerificationResendCount = message.payload.verificationResendCount !== undefined
          ? message.payload.verificationResendCount
          : (message.payload.signupVerificationResendCount ?? message.payload.loginVerificationResendCount);
        inputVerificationResendCount.value = String(
          normalizeVerificationResendCount(
            nextVerificationResendCount,
            DEFAULT_VERIFICATION_RESEND_COUNT
          )
        );
      }
      if (message.payload.phoneSmsProvider !== undefined && selectPhoneSmsProvider) {
        setPhoneSmsProviderSelectValue(message.payload.phoneSmsProvider);
      }
      if ((message.payload.heroSmsApiKey !== undefined || message.payload.fiveSimApiKey !== undefined) && inputHeroSmsApiKey) {
        inputHeroSmsApiKey.value = getSelectedPhoneSmsProvider() === PHONE_SMS_PROVIDER_FIVE_SIM
          ? (message.payload.fiveSimApiKey !== undefined ? message.payload.fiveSimApiKey || '' : latestState?.fiveSimApiKey || '')
          : (message.payload.heroSmsApiKey !== undefined ? message.payload.heroSmsApiKey || '' : latestState?.heroSmsApiKey || '');
      }
      if (message.payload.fiveSimApiKey !== undefined && inputFiveSimApiKey) {
        inputFiveSimApiKey.value = String(message.payload.fiveSimApiKey || '').trim();
      }
      if (message.payload.nexSmsApiKey !== undefined && inputNexSmsApiKey) {
        inputNexSmsApiKey.value = String(message.payload.nexSmsApiKey || '').trim();
      }
      if (message.payload.fiveSimCountryOrder !== undefined && typeof applyFiveSimCountrySelection === 'function') {
        applyFiveSimCountrySelection(
          Array.isArray(message.payload.fiveSimCountryOrder) ? message.payload.fiveSimCountryOrder : []
        );
      }
      if (message.payload.nexSmsCountryOrder !== undefined && typeof applyNexSmsCountrySelection === 'function') {
        applyNexSmsCountrySelection(
          Array.isArray(message.payload.nexSmsCountryOrder) ? message.payload.nexSmsCountryOrder : []
        );
      }
      if (message.payload.fiveSimOperator !== undefined && inputFiveSimOperator) {
        inputFiveSimOperator.value = normalizeFiveSimOperatorValue(message.payload.fiveSimOperator);
      }
      if (message.payload.fiveSimProduct !== undefined && inputFiveSimProduct) {
        inputFiveSimProduct.value = normalizeFiveSimProductValue(message.payload.fiveSimProduct);
      }
      if (message.payload.nexSmsServiceCode !== undefined && inputNexSmsServiceCode) {
        inputNexSmsServiceCode.value = normalizeNexSmsServiceCodeValue(message.payload.nexSmsServiceCode);
      }
      if (message.payload.heroSmsReuseEnabled !== undefined && inputHeroSmsReuseEnabled) {
        inputHeroSmsReuseEnabled.checked = normalizeHeroSmsReuseEnabledValue(message.payload.heroSmsReuseEnabled);
      }
      if (message.payload.freePhoneReuseEnabled !== undefined && inputFreePhoneReuseEnabled) {
        inputFreePhoneReuseEnabled.checked = Boolean(message.payload.freePhoneReuseEnabled);
        updatePhoneVerificationSettingsUI();
      }
      if (message.payload.freePhoneReuseAutoEnabled !== undefined && inputFreePhoneReuseAutoEnabled) {
        inputFreePhoneReuseAutoEnabled.checked = Boolean(message.payload.freePhoneReuseAutoEnabled);
        updatePhoneVerificationSettingsUI();
      }
      if (message.payload.heroSmsAcquirePriority !== undefined && selectHeroSmsAcquirePriority) {
        selectHeroSmsAcquirePriority.value = normalizeHeroSmsAcquirePriority(message.payload.heroSmsAcquirePriority);
      }
      if ((message.payload.heroSmsMaxPrice !== undefined || message.payload.fiveSimMaxPrice !== undefined) && inputHeroSmsMaxPrice) {
        inputHeroSmsMaxPrice.value = getSelectedPhoneSmsProvider() === PHONE_SMS_PROVIDER_FIVE_SIM
          ? normalizeFiveSimMaxPriceValue(message.payload.fiveSimMaxPrice !== undefined ? message.payload.fiveSimMaxPrice : latestState?.fiveSimMaxPrice)
          : normalizeHeroSmsMaxPriceValue(message.payload.heroSmsMaxPrice !== undefined ? message.payload.heroSmsMaxPrice : latestState?.heroSmsMaxPrice);
      }
      if (message.payload.fiveSimOperator !== undefined && inputFiveSimOperator) {
        inputFiveSimOperator.value = normalizeFiveSimOperator(message.payload.fiveSimOperator);
      }
      if (message.payload.heroSmsPreferredPrice !== undefined && typeof inputHeroSmsPreferredPrice !== 'undefined' && inputHeroSmsPreferredPrice) {
        inputHeroSmsPreferredPrice.value = normalizeHeroSmsMaxPriceValue(message.payload.heroSmsPreferredPrice);
      }
      if (message.payload.phoneVerificationReplacementLimit !== undefined && typeof inputPhoneReplacementLimit !== 'undefined' && inputPhoneReplacementLimit) {
        inputPhoneReplacementLimit.value = String(
          normalizePhoneVerificationReplacementLimit(
            message.payload.phoneVerificationReplacementLimit,
            DEFAULT_PHONE_VERIFICATION_REPLACEMENT_LIMIT
          )
        );
      }
      if (message.payload.phoneCodeWaitSeconds !== undefined && inputPhoneCodeWaitSeconds) {
        inputPhoneCodeWaitSeconds.value = String(
          normalizePhoneCodeWaitSecondsValue(message.payload.phoneCodeWaitSeconds, DEFAULT_PHONE_CODE_WAIT_SECONDS)
        );
      }
      if (message.payload.phoneCodeTimeoutWindows !== undefined && inputPhoneCodeTimeoutWindows) {
        inputPhoneCodeTimeoutWindows.value = String(
          normalizePhoneCodeTimeoutWindowsValue(message.payload.phoneCodeTimeoutWindows, DEFAULT_PHONE_CODE_TIMEOUT_WINDOWS)
        );
      }
      if (message.payload.phoneCodePollIntervalSeconds !== undefined && inputPhoneCodePollIntervalSeconds) {
        inputPhoneCodePollIntervalSeconds.value = String(
          normalizePhoneCodePollIntervalSecondsValue(
            message.payload.phoneCodePollIntervalSeconds,
            DEFAULT_PHONE_CODE_POLL_INTERVAL_SECONDS
          )
        );
      }
      if (message.payload.phoneCodePollMaxRounds !== undefined && inputPhoneCodePollMaxRounds) {
        inputPhoneCodePollMaxRounds.value = String(
          normalizePhoneCodePollMaxRoundsValue(message.payload.phoneCodePollMaxRounds, DEFAULT_PHONE_CODE_POLL_MAX_ROUNDS)
        );
      }
      if (
        message.payload.phoneSmsProvider !== undefined
        || message.payload.phoneSmsProviderOrder !== undefined
      ) {
        const nextOrder = applyPhoneSmsProviderOrderSelection(
          message.payload.phoneSmsProviderOrder !== undefined
            ? message.payload.phoneSmsProviderOrder
            : (Array.isArray(latestState?.phoneSmsProviderOrder)
              ? latestState.phoneSmsProviderOrder
              : []),
          { ensureDefault: false, syncProvider: false }
        );
        if (selectPhoneSmsProvider) {
          selectPhoneSmsProvider.value = normalizePhoneSmsProviderValue(
            message.payload.phoneSmsProvider !== undefined
              ? message.payload.phoneSmsProvider
              : latestState?.phoneSmsProvider
          );
        }
        updatePhoneSmsProviderOrderSummary(nextOrder);
        updatePhoneVerificationSettingsUI();
      }
      if (message.payload.phoneVerificationEnabled !== undefined && inputPhoneVerificationEnabled) {
        inputPhoneVerificationEnabled.checked = Boolean(message.payload.phoneVerificationEnabled);
      }
      if (message.payload.signupMethod !== undefined) {
        setSignupMethod(message.payload.signupMethod);
      }
      if (message.payload.phoneVerificationEnabled !== undefined || message.payload.signupMethod !== undefined) {
        updatePhoneVerificationSettingsUI();
      }
      const activePhoneSmsProvider = normalizePhoneSmsProviderValue(
        message.payload.phoneSmsProvider !== undefined
          ? message.payload.phoneSmsProvider
          : latestState?.phoneSmsProvider
      );
      if (activePhoneSmsProvider === PHONE_SMS_PROVIDER_FIVE_SIM) {
        if (
          message.payload.fiveSimCountryOrder !== undefined
          || message.payload.phoneSmsProvider !== undefined
          || message.payload.phoneSmsProviderOrder !== undefined
        ) {
          applyFiveSimCountrySelection(
            message.payload.fiveSimCountryOrder !== undefined
              ? message.payload.fiveSimCountryOrder
              : (Array.isArray(latestState?.fiveSimCountryOrder) ? latestState.fiveSimCountryOrder : [])
          );
        }
      } else if (activePhoneSmsProvider === PHONE_SMS_PROVIDER_NEXSMS) {
        if (
          message.payload.nexSmsCountryOrder !== undefined
          || message.payload.phoneSmsProvider !== undefined
          || message.payload.phoneSmsProviderOrder !== undefined
        ) {
          applyNexSmsCountrySelection(
            message.payload.nexSmsCountryOrder !== undefined
              ? message.payload.nexSmsCountryOrder
              : (Array.isArray(latestState?.nexSmsCountryOrder) ? latestState.nexSmsCountryOrder : [])
          );
        }
      } else if (
        message.payload.heroSmsCountryId !== undefined
        || message.payload.heroSmsCountryLabel !== undefined
        || message.payload.heroSmsCountryFallback !== undefined
        || message.payload.fiveSimCountryId !== undefined
        || message.payload.fiveSimCountryLabel !== undefined
        || message.payload.fiveSimCountryFallback !== undefined
        || message.payload.fiveSimCountryOrder !== undefined
      ) {
        const activeProvider = getSelectedPhoneSmsProvider();
        const nextPrimary = activeProvider === PHONE_SMS_PROVIDER_FIVE_SIM
          ? {
            id: normalizeFiveSimCountryId(
              message.payload.fiveSimCountryId !== undefined
                ? message.payload.fiveSimCountryId
                : latestState?.fiveSimCountryId
            ),
            label: normalizeFiveSimCountryLabel(
              message.payload.fiveSimCountryLabel !== undefined
                ? message.payload.fiveSimCountryLabel
                : latestState?.fiveSimCountryLabel
            ),
          }
          : {
            id: normalizeHeroSmsCountryId(
              message.payload.heroSmsCountryId !== undefined
                ? message.payload.heroSmsCountryId
                : latestState?.heroSmsCountryId
            ),
            label: normalizeHeroSmsCountryLabel(
              message.payload.heroSmsCountryLabel !== undefined
                ? message.payload.heroSmsCountryLabel
                : latestState?.heroSmsCountryLabel
            ),
          };
        const nextFallback = activeProvider === PHONE_SMS_PROVIDER_FIVE_SIM
          ? normalizeFiveSimCountryFallbackList(
            message.payload.fiveSimCountryFallback !== undefined
              ? message.payload.fiveSimCountryFallback
              : message.payload.fiveSimCountryOrder !== undefined
                ? message.payload.fiveSimCountryOrder
              : latestState?.fiveSimCountryFallback
          )
          : normalizeHeroSmsCountryFallbackList(
            message.payload.heroSmsCountryFallback !== undefined
              ? message.payload.heroSmsCountryFallback
              : latestState?.heroSmsCountryFallback
          );
        applyHeroSmsFallbackSelection(
          [nextPrimary, ...nextFallback],
          { includePrimary: true }
        );
        updateHeroSmsPlatformDisplay();
      }
      if (
        message.payload.currentPhoneActivation !== undefined
        || message.payload.reusablePhoneActivation !== undefined
        || message.payload.phoneReusableActivationPool !== undefined
        || message.payload.phonePreferredActivation !== undefined
        || message.payload.currentPhoneVerificationCode !== undefined
        || message.payload.currentPhoneVerificationCountdownEndsAt !== undefined
        || message.payload.currentPhoneVerificationCountdownWindowIndex !== undefined
        || message.payload.currentPhoneVerificationCountdownWindowTotal !== undefined
        || message.payload.freeReusablePhoneActivation !== undefined
        || message.payload.heroSmsLastPriceTiers !== undefined
        || message.payload.heroSmsLastPriceCountryId !== undefined
        || message.payload.heroSmsLastPriceCountryLabel !== undefined
        || message.payload.heroSmsLastPriceUserLimit !== undefined
        || message.payload.phoneSmsProvider !== undefined
        || message.payload.phoneSmsProviderOrder !== undefined
      ) {
        updateHeroSmsRuntimeDisplay({
          ...latestState,
          ...message.payload,
        });
      }
      updateAccountRunHistorySettingsUI();
      renderContributionMode();
      void syncPlusManualConfirmationDialog();
      break;
    }

    case 'ICLOUD_LOGIN_REQUIRED': {
      const loginMessage = '需要登录 iCloud，我已经为你打开登录页。';
      showToast(loginMessage, 'warn', 5000);
      if (icloudSummary) {
        icloudSummary.textContent = loginMessage;
      }
      showIcloudLoginHelp(message.payload || {});
      break;
    }

    case 'ICLOUD_ALIASES_CHANGED': {
      queueIcloudAliasRefresh();
      break;
    }

    case 'AUTO_RUN_STATUS': {
      syncLatestState({
        autoRunning: ['scheduled', 'running', 'waiting_step', 'waiting_email', 'retrying', 'waiting_interval'].includes(message.payload.phase),
        autoRunPhase: message.payload.phase,
        autoRunCurrentRun: message.payload.currentRun,
        autoRunTotalRuns: message.payload.totalRuns,
        autoRunAttemptRun: message.payload.attemptRun,
        scheduledAutoRunAt: message.payload.scheduledAt ?? null,
        autoRunCountdownAt: message.payload.countdownAt ?? null,
        autoRunCountdownTitle: message.payload.countdownTitle ?? '',
        autoRunCountdownNote: message.payload.countdownNote ?? '',
      });
      applyAutoRunStatus(message.payload);
      updateStatusDisplay(latestState);
      updateButtonStates();
      break;
    }
  }
});

// ============================================================
// Theme Toggle
// ============================================================

const btnTheme = document.getElementById('btn-theme');

function setTheme(theme) {
  document.documentElement.setAttribute('data-theme', theme);
  localStorage.setItem('multipage-theme', theme);
}

function initTheme() {
  const saved = localStorage.getItem('multipage-theme');
  if (saved) {
    setTheme(saved);
  } else if (window.matchMedia('(prefers-color-scheme: dark)').matches) {
    setTheme('dark');
  }
}

btnTheme.addEventListener('click', () => {
  const current = document.documentElement.getAttribute('data-theme');
  setTheme(current === 'dark' ? 'light' : 'dark');
});

document.addEventListener('click', (event) => {
  const clickedInsideConfigMenu = Boolean(configMenuShell?.contains(event.target));
  const clickedInsideCountryMenu = Boolean(heroSmsCountryMenuShell?.contains(event.target));
  const clickedInsideFiveSimCountryMenu = Boolean(fiveSimCountryMenuShell?.contains(event.target));
  const clickedInsideNexSmsCountryMenu = Boolean(nexSmsCountryMenuShell?.contains(event.target));
  const clickedInsideProviderOrderMenu = Boolean(phoneSmsProviderOrderMenuShell?.contains(event.target));
  const clickedInsideEditableListPicker = isClickInsideEditableListPicker(event.target);

  if (configMenuOpen && !clickedInsideConfigMenu) {
    closeConfigMenu();
  }

  const countryMenuOpen = btnHeroSmsCountryMenu?.getAttribute('aria-expanded') === 'true';
  if (countryMenuOpen && !clickedInsideCountryMenu) {
    setHeroSmsCountryMenuOpen(false);
  }
  const fiveSimCountryMenuOpen = btnFiveSimCountryMenu?.getAttribute('aria-expanded') === 'true';
  if (fiveSimCountryMenuOpen && !clickedInsideFiveSimCountryMenu) {
    setFiveSimCountryMenuOpen(false);
  }
  const nexSmsCountryMenuOpen = btnNexSmsCountryMenu?.getAttribute('aria-expanded') === 'true';
  if (nexSmsCountryMenuOpen && !clickedInsideNexSmsCountryMenu) {
    setNexSmsCountryMenuOpen(false);
  }
  const providerOrderMenuOpen = btnPhoneSmsProviderOrderMenu?.getAttribute('aria-expanded') === 'true';
  if (providerOrderMenuOpen && !clickedInsideProviderOrderMenu) {
    setPhoneSmsProviderOrderMenuOpen(false);
  }
  if (!clickedInsideEditableListPicker) {
    closeEditableListPickers();
  }
});

document.addEventListener('keydown', (event) => {
  if (event.key !== 'Escape') {
    return;
  }
  if (configMenuOpen) {
    closeConfigMenu();
  }
  if (btnHeroSmsCountryMenu?.getAttribute('aria-expanded') === 'true') {
    setHeroSmsCountryMenuOpen(false);
  }
  if (btnFiveSimCountryMenu?.getAttribute('aria-expanded') === 'true') {
    setFiveSimCountryMenuOpen(false);
  }
  if (btnNexSmsCountryMenu?.getAttribute('aria-expanded') === 'true') {
    setNexSmsCountryMenuOpen(false);
  }
  if (btnPhoneSmsProviderOrderMenu?.getAttribute('aria-expanded') === 'true') {
    setPhoneSmsProviderOrderMenuOpen(false);
  }
  closeEditableListPickers();
});

window.addEventListener('resize', () => {
  positionContributionUpdateHint();
});

document.addEventListener('scroll', () => {
  positionContributionUpdateHint();
}, true);

// ============================================================
// Init
// ============================================================

initializeManualStepActions();
bindPasswordVisibilityToggles();
initTheme();
initHotmailListExpandedState();
initMail2925ListExpandedState();
if (typeof initIpProxySectionExpandedState === 'function') {
  initIpProxySectionExpandedState();
}
if (typeof initPhoneVerificationSectionExpandedState === 'function') {
  initPhoneVerificationSectionExpandedState();
}
applyPhoneSmsProviderOrderSelection([], { ensureDefault: false, syncProvider: false });
updateSaveButtonState();
updateConfigMenuControls();
setLocalCpaStep9Mode(DEFAULT_LOCAL_CPA_STEP9_MODE);
setMail2925Mode(DEFAULT_MAIL_2925_MODE);
initializeReleaseInfo().catch((err) => {
  console.error('Failed to initialize release info:', err);
});
Promise.allSettled([
  loadHeroSmsCountries(),
  loadFiveSimCountries(),
  loadNexSmsCountries({ silent: true }),
]).then((results) => {
  const heroResult = results[0];
  const fiveSimResult = results[1];
  const nexSmsResult = results[2];
  if (heroResult?.status === 'rejected') {
    console.error('Failed to load HeroSMS countries:', heroResult.reason);
  }
  if (fiveSimResult?.status === 'rejected') {
    console.error('Failed to load 5sim countries:', fiveSimResult.reason);
  }
  if (nexSmsResult?.status === 'rejected') {
    console.error('Failed to load NexSMS countries:', nexSmsResult.reason);
  }
  return restoreState().then(() => {
    syncPasswordToggleLabel();
    syncVpsUrlToggleLabel();
    syncVpsPasswordToggleLabel();
    syncIpProxyApiUrlToggleLabel();
    syncIpProxyUsernameToggleLabel();
    syncIpProxyPasswordToggleLabel();
    syncHeroSmsApiKeyToggleLabel();
    syncPasswordVisibilityToggles();
    syncHeroSmsApiKeyToggleLabel();
    updatePanelModeUI();
    updateButtonStates();
    updateStatusDisplay(latestState);
    return refreshContributionContentHint()
      .catch((error) => {
        console.warn('Failed to refresh contribution content hint during initialization:', error);
        return null;
      })
      .then(() => maybeShowNewUserGuidePrompt());
  }).catch((err) => {
    console.error('Failed to initialize sidepanel state:', err);
  });
});
