(function attachFlowPilotSidepanelI18n(root, factory) {
  root.FlowPilotSidepanelI18n = factory();
})(typeof self !== 'undefined' ? self : globalThis, function createFlowPilotSidepanelI18n() {
  const TEXT_EN_US = Object.freeze({
    '126 \u90ae\u7bb1': '126 Mail',
    '126 \u90ae\u7bb1 (mail.126.com) \u7248\u672c\u8001\u65e7\uff0c\u8bf7\u81ea\u884c\u7ef4\u62a4\u4f7f\u7528': '126 Mail (mail.126.com) outdated, please maintain yourself',
    '163 \u90ae\u7bb1': '163 Mail',
    '163 \u90ae\u7bb1 (mail.163.com) \u7248\u672c\u8001\u65e7\uff0c\u8bf7\u81ea\u884c\u7ef4\u62a4\u4f7f\u7528': '163 Mail (mail.163.com) outdated, please maintain yourself',
    '163 VIP \u90ae\u7bb1': '163 VIP Mail',
    '163 VIP \u90ae\u7bb1 (vip.163.com) \u7248\u672c\u8001\u65e7\uff0c\u8bf7\u81ea\u884c\u7ef4\u62a4\u4f7f\u7528': '163 VIP Mail (vip.163.com) outdated, please maintain yourself',
    '2925 \u53f7\u6c60': '2925 Pool',
    '2925 \u6a21\u5f0f': '2925 Mode',
    '2925 \u90ae\u7bb1 (2925.com)\uff08\u63a8\u8350\uff09': '2925 Mail (2925.com) (Recommended)',
    '2925 \u8d26\u53f7\u6c60': '2925 Account Pool',
    '711Proxy\uff08\u9996\u7248\uff09': '711Proxy (first release)',
    '\u7ed1\u5b9a\u540e\u91cd\u767b': 'Re-login After Bind',
    '\u7ed1\u5b9a\u90ae\u7bb1\u540e\u5207\u5165\u90ae\u7bb1\u6ce8\u518c\u6a21\u5f0f OAuth \u5c3e\u90e8': 'After binding email, switch to email signup OAuth tail',
    '\u4fdd\u5b58\u590d\u7528\u53f7': 'Free Reuse',
    '\u4fdd\u5b58\u53f7\u7801': 'Free Number',
    '\u4fdd\u7559': 'Preserve',
    '\u672c\u5730\u90e8\u7f72': 'Local Deploy',
    '\u672c\u5730\u52a9\u624b': 'Local Helper',
    '\u6807\u8bb0\u672a\u7528': 'Mark Unused',
    '\u6807\u8bb0\u5df2\u7528': 'Mark Used',
    '\u522b\u540d\u57fa\u90ae\u7bb1': 'Alias Base Email',
    '\u4e0d\u518d\u63d0\u793a': 'Don\'t show again',
    '\u6b65\u95f4\u95f4\u9694': 'Step Interval',
    '\u90e8\u7f72': 'Deploy',
    '\u6d4b\u8bd5': 'Test',
    '\u67e5\u4fe1\u65b9\u5f0f': 'Lookup Mode',
    '\u67e5\u8be2\u4ef7\u683c': 'Query Price',
    '\u67e5\u8be2\u95f4\u9694': 'Poll Interval',
    '\u67e5\u4f59\u989d': 'Check Balance',
    '\u4ea7\u54c1\u4ee3\u7801': 'Product Code',
    '\u6210\u529f\u7b49\u5f85': 'Success Wait',
    '\u6210\u529f\u4f7f\u7528\u540e\u81ea\u52a8\u5220\u9664 iCloud \u522b\u540d': 'Auto delete iCloud alias after successful use',
    '\u6b21': 'times',
    '\u9519\u7801\u540e\u91cd\u53d1': 'SMS Resend',
    '\u4ee3\u7406 Host': 'Proxy Host',
    '\u4ee3\u7406 Port': 'Proxy Port',
    '\u4ee3\u7406\u670d\u52a1': 'Proxy Service',
    '\u4ee3\u7406\u5bc6\u7801': 'Proxy Password',
    '\u4ee3\u7406\u6a21\u5f0f': 'Proxy Mode',
    '\u4ee3\u7406\u534f\u8bae': 'Proxy Protocol',
    '\u4ee3\u7406\u8d26\u53f7': 'Proxy Username',
    '\u4ee3\u7406\u72b6\u6001': 'Proxy Status',
    '\u4ee3\u7406API': 'Proxy API',
    '\u5f53\u524d': 'Current',
    '\u5f53\u524d\u5206\u914d': 'Allocated',
    '\u5bfc\u51fa\u914d\u7f6e': 'Export Config',
    '\u5bfc\u5165\u4f60\u63d0\u524d\u51c6\u5907\u597d\u7684\u6ce8\u518c\u90ae\u7bb1\uff0c\u6bcf\u884c\u4e00\u4e2a\u90ae\u7bb1\u5730\u5740\u3002': 'Import your pre-prepared registration emails, one email per line.',
    '\u5bfc\u5165\u914d\u7f6e': 'Import Config',
    '\u5bfc\u5165\u5931\u8d25': 'Import Failed',
    '\u5df2\u5bfc\u5165': 'Imported',
    '\u6b63\u5728\u5bfc\u5165': 'Importing',
    '\u5bfc\u5165\u90ae\u7bb1': 'Import Emails',
    '\u5230': 'to',
    '\u5012\u8ba1\u65f6': 'Countdown',
    '\u5730\u533a\uff1a\u672a\u4fdd\u5b58': 'Region: not saved',
    '\u5730\u533a\u53c2\u6570': 'Region',
    '\u767b\u5f55': 'Login',
    '\u7b49\u5f85\u5012\u8ba1\u65f6\u5f00\u59cb...': 'Waiting for countdown to start...',
    '\u7b49\u5f85\u56de\u8c03': 'Waiting for callback',
    '\u7b49\u5f85\u7ee7\u7eed': 'Waiting to continue',
    '\u7b49\u5f85\u8f6e\u6570': 'Timeout Rounds',
    '\u7b49\u5f85\u4e2d...': 'Waiting...',
    '\u4f4e\u4ef7\u4f18\u5148\uff08\u540c\u4ef7\u6309\u56fd\u5bb6\u987a\u5e8f\uff09': 'Low price first (same price by country order)',
    '\u7b2c\u516d\u6b65': 'Step 6',
    '\u7b2c\u4e00\u4f4d\u4e3a\u4e3b\u670d\u52a1\u5546\uff0c\u540e\u7eed\u6309\u987a\u5e8f\u81ea\u52a8\u56de\u9000\u3002': 'The first is the primary provider; the rest fall back in order.',
    '\u5b9a\u65f6\u5237\u65b0\u4ee3\u7406\uff0c\u964d\u4f4e\u8d26\u53f7\u51ed\u636e\u8fc7\u671f\u5bfc\u81f4\u7684\u4e2d\u65ad\u6982\u7387': 'Periodically refresh proxy to reduce interruptions from expired credentials',
    '\u591a\u9009': 'Multi-select',
    '\u591a\u9009\u6700\u591a 3 \u4e2a\uff0c\u6309\u70b9\u51fb\u987a\u5e8f\u751f\u6548\u3002': 'Multi-select up to 3, applied in click order.',
    '\u5206\u949f': 'min',
    '\u5206\u7ec4': 'Group',
    '\u670d\u52a1\u4ee3\u7801': 'Service Code',
    '\u670d\u52a1\u5668\u90e8\u7f72': 'Server Deploy',
    '\u670d\u52a1\u5546\u987a\u5e8f': 'Provider Order',
    '\u590d\u5236': 'Copy',
    '\u53d1\u5e03\u72b6\u6001': 'Publish Status',
    '\u9ad8\u4ef7\u4f18\u5148\uff08\u540c\u4ef7\u6309\u56fd\u5bb6\u987a\u5e8f\uff09': 'High price first (same price by country order)',
    '\u66f4\u65b0': 'Update',
    '\u66f4\u65b0\u5185\u5bb9': 'Update Details',
    '\u66f4\u65b0\u65e5\u5fd7': 'Release Notes',
    '\u516c\u544a / \u4f7f\u7528\u6559\u7a0b\u6709\u66f4\u65b0\u4e86\uff0c\u53ef\u70b9\u4e0a\u65b9\u201c\u4f7f\u7528\u6559\u7a0b\u201d\u67e5\u770b\u3002': 'Announcements / Tutorials have been updated. Click "Tutorial" above to view.',
    '\u4f7f\u7528\u6559\u7a0b': 'Tutorial',
    '\u8d2d\u4e70\u5361\u5bc6': 'Buy Card Key',
    '\u8c37\u6b4c\u53d8\u79cd': 'Google variant',
    '\u7ba1\u7406\u5bc6\u94a5': 'Admin Key',
    '\u7ba1\u7406\u5458\u5bc6\u7801': 'Admin Password',
    '\u7ba1\u7406\u5458\u90ae\u7bb1': 'Admin Email',
    '\u4e0a\u4f20\u72b6\u6001': 'Upload Status',
    '\u56fd\u5bb6\u4f18\u5148\uff08\u9ed8\u8ba4\uff09': 'Country first (default)',
    '\u56fd\u5bb6\u4f18\u5148\u7ea7': 'Country Priority',
    '\u53f7\u6c60': 'Pool',
    '\u5ffd\u7565\u672c\u6b21\u66f4\u65b0': 'Ignore this update',
    '\u6362\u53f7\u4e0a\u9650': 'Replace Limit',
    '\u56de\u8c03': 'Callback',
    '\u56de\u8c03\u65b9\u5f0f': 'Callback Mode',
    '\u4f1a\u8bdd(session)': 'Session',
    '\u83b7\u53d6': 'Fetch',
    '\u83b7\u53d6\u7b56\u7565': 'Fetch Strategy',
    '\u8bb0\u5f55': 'Records',
    '\u7ee7\u7eed': 'Continue',
    '\u7ee7\u7eed\u5f53\u524d': 'Continue',
    '\u52a0\u8f7d\u4f60\u7684 iCloud Hide My Email \u522b\u540d\u4ee5\u4fbf\u5728\u8fd9\u91cc\u7ba1\u7406\u3002': 'Load your iCloud Hide My Email aliases to manage them here.',
    '\u52a0\u8f7d\u5df2\u8d2d\u90ae\u7bb1\u540e\u53ef\u5728\u8fd9\u91cc\u7ba1\u7406 openai \u9879\u76ee\u7684 LuckMail \u90ae\u7bb1\u3002': 'Load purchased mailboxes to manage LuckMail mailboxes for the openai project here.',
    '\u4ef7\u683c\u4e0a\u9650': 'Number Reuse',
    '\u68c0\u6d4b\u51fa\u53e3': 'Probe Exit',
    '\u68c0\u6d4b\u5230\u5df2\u6709\u6d41\u7a0b\u8fdb\u5ea6\uff0c\u9009\u62e9\u7ee7\u7eed\u5f53\u524d\u8fd8\u662f\u91cd\u65b0\u5f00\u59cb\u3002': 'Existing flow progress detected. Choose to continue current or restart.',
    '\u68c0\u67e5IP': 'Check IP',
    '\u63a5\u7801 API': 'SMS API',
    '\u63a5\u7801\u670d\u52a1\u5546': 'SMS Provider',
    '\u63a5\u7801\u6a21\u5f0f': 'SMS Mode',
    '\u63a5\u7801\u5e73\u53f0': 'SMS Platform',
    '\u63a5\u7801\u8bbe\u7f6e': 'SMS Verification',
    '\u63a5\u6536\u90ae\u7bb1': 'Receive Email',
    '\u8282\u70b9': 'Node',
    '\u4ec5\u663e\u793a\u9879\u76ee\u4e3a': 'Only shows mailboxes with project',
    '\u7981\u7528': 'Disable',
    '\u7981\u7528\u5df2\u7528': 'Disable Used',
    '\u5c31\u7eea': 'Ready',
    '\u53ef\u5206\u914d': 'Available',
    '\u53ef\u590d\u7528': 'Reusable',
    '\u53ef\u7528': 'Active',
    '\u5ba2\u6237\u7aef ID': 'Client ID',
    '\u62c9\u53d6': 'Fetch',
    '\u6765\u6e90': 'Source',
    '\u51b7\u5374\u4e2d': 'Cooling',
    '\u7acb\u5373\u5f00\u59cb': 'Start Now',
    '\u8fde\u63a5\u6d4b\u8bd5': 'Connection Test',
    '\u6d41\u7a0b': 'Flow',
    '\u8f6e': 'rounds',
    '\u4e70\u53f7\u4ef7\u683c': 'Price Range',
    '\u4e70\u53f7\u7b5b\u9009': 'Min Buy Price',
    '\u6bcf\u8f6e\u7b49\u5f85': 'SMS Wait',
    '\u5bc6\u7801': 'Password',
    '\u79d2': 's',
    '\u9ed8\u8ba4\u4ee3\u7406': 'Default Proxy',
    '\u76ee\u6807\u90ae\u7bb1\u7c7b\u578b': 'Target Mailbox Type',
    '\u62ff\u53f7\u4f18\u5148\u7ea7': 'Acquire Priority',
    '\u5185\u90e8\u8f6e\u8be2\u4e0b\u9650': 'Poll Rounds',
    '\u914d\u7f6e': 'Config',
    '\u6279\u91cf\u5bfc\u5165': 'Bulk Import',
    '\u542f\u52a8\u81ea\u52a8': 'Start Auto',
    '\u542f\u7528': 'Enable',
    '\u524d\u5f80\u66f4\u65b0': 'Go to Update',
    '\u5207\u6362\u4ee3\u7406': 'Switch Proxy',
    '\u6e05 Cookies': 'Clear Cookies',
    '\u6e05\u9664': 'Clear',
    '\u6e05\u7a7a': 'Clear',
    '\u6e05\u7a7a\u5df2\u7528': 'Clear Used',
    '\u6e05\u7406\u8bb0\u5f55': 'Clear Records',
    '\u8bf7\u5148\u66f4\u65b0\u57df\u540d': 'Please update domain first',
    '\u8bf7\u5148\u6dfb\u52a0 PayPal \u8d26\u53f7': 'Please add a PayPal account first',
    '\u8bf7\u5148\u6dfb\u52a0\u57df\u540d': 'Please add a domain first',
    '\u8bf7\u9009\u62e9\u53f7\u6c60\u90ae\u7bb1': 'Please select a pool email',
    '\u53d6\u6d88': 'Cancel',
    '\u53d6\u6d88\u4fdd\u7559': 'Unpreserve',
    '\u5168\u90e8': 'All',
    '\u5168\u90e8\u5220\u9664': 'Delete All',
    '\u786e\u8ba4': 'Confirm',
    '\u4efb\u52a1\u5207\u6362\u9608\u503c': 'Rotation Threshold',
    '\u65e5\u5fd7': 'Log',
    '\u5220\u9664': 'Delete',
    '\u5220\u9664\u9009\u4e2d': 'Delete Selected',
    '\u5220\u9664\u5df2\u7528': 'Delete Used',
    '\u4e0a\u4f20\u72b6\u6001': 'Upload Status',
    '\u4e0a\u4e00\u9875': 'Prev',
    '\u751f\u6548\u987a\u5e8f': 'Effective Order',
    '\u65f6\u957f(life)': 'Life',
    '\u4f7f\u7528\u6559\u7a0b': 'Tutorial',
    '\u59cb\u7ec8\u521b\u5efa\u65b0\u522b\u540d': 'Always create new alias',
    '\u6536\u7801\u5904\u7406': 'SMS Params',
    '\u624b\u673a\u53f7\u9a8c\u8bc1\u4e0e\u63a5\u7801\u670d\u52a1\u5546\u83b7\u53d6\u7b56\u7565': 'Phone number verification and SMS provider fetch strategy',
    '\u624b\u673a\u53f7\u6ce8\u518c': 'Phone Signup',
    '\u552e\u540e\u4fdd\u969c': 'After-sale support',
    '\u5237\u65b0': 'Refresh',
    '\u5237\u65b0\u4ee4\u724c': 'Refresh Token',
    '\u987a\u5e8f\u7ba1\u7406': 'Order Manage',
    '\u6cf0\u56fd (Thailand) [TH]': 'Thailand [TH]',
    '\u63d0\u4f9b\u90ae\u7bb1': 'Provide Email',
    '\u6dfb\u52a0': 'Add',
    '\u6dfb\u52a0\u8d26\u53f7': 'Add Account',
    '\u505c\u7528': 'Disable',
    '\u505c\u6b62': 'Stop',
    '\u540c\u6b65\u670d\u52a1': 'Sync Service',
    '\u540c\u6b65\u95f4\u9694': 'Sync Interval',
    '\u5fae\u8f6f Graph': 'Microsoft Graph',
    '\u5fae\u8f6f IMAP': 'Microsoft IMAP',
    '\u672a\u4fdd\u5b58': 'Not saved',
    '\u672a\u6d4b\u8bd5': 'Not tested',
    '\u672a\u6253\u5f00': 'Not opened',
    '\u672a\u5206\u914d': 'Unallocated',
    '\u672a\u83b7\u53d6': 'Not received',
    '\u672a\u5f00\u59cb': 'Not started',
    '\u672a\u542f\u52a8': 'Not started',
    '\u672a\u542f\u7528\uff0c\u6cbf\u7528\u6d4f\u89c8\u5668\u9ed8\u8ba4/\u5168\u5c40\u4ee3\u7406\u3002': 'Not enabled, using browser default/global proxy.',
    '\u672a\u8bbe\u7f6e': 'Not set',
    '\u672a\u751f\u6210\u767b\u5f55\u5730\u5740': 'Login URL not generated',
    '\u672a\u63d0\u53d6': 'Not extracted',
    '\u672a\u9009\u62e9 (0/3)': 'None selected (0/3)',
    '\u672a\u7528': 'Unused',
    '\u6211\u5df2\u767b\u5f55': 'I\'ve logged in',
    '\u6211\u5df2\u7ecf\u4e3a\u4f60\u6253\u5f00 iCloud \u767b\u5f55\u9875\u3002\u8bf7\u5728\u90a3\u4e2a\u9875\u9762\u5b8c\u6210\u767b\u5f55\uff0c\u7136\u540e\u56de\u5230\u8fd9\u91cc\u70b9\u51fb\u201c\u6211\u5df2\u767b\u5f55\u201d\u3002': 'The iCloud login page has been opened for you. Please complete login on that page, then come back here and click "I\'ve logged in".',
    '\u65e0\u9700\u652f\u4ed8': 'No payment required',
    '\u4e0b\u4e00\u6761': 'Next',
    '\u4e0b\u4e00\u6761\uff1a\u5207\u5230\u4ee3\u7406\u6c60\u4e0b\u4e00\u6761\u3002Change\uff1a\u4fdd\u6301\u5f53\u524d session \u91cd\u7ed1\u94fe\u8def\uff08\u4ec5 711 + session\uff09\u3002': 'Next: switch to next proxy in pool. Change: keep current session and re-bind link (711 + session only).',
    '\u4e0b\u4e00\u9875': 'Next',
    '\u5148\u6309\u56fd\u5bb6/\u4ef7\u683c\u7b56\u7565\u9009\u6863\u4f4d\uff0c\u518d\u6309\u4ef7\u683c\u9650\u5236\u8d2d\u4e70\u3002': 'Price Cap',
    '\u5148\u81ea\u52a8\u83b7\u53d6\u90ae\u7bb1\uff0c\u6216\u624b\u52a8\u7c98\u8d34\u90ae\u7bb1\u540e\u518d\u7ee7\u7eed': 'Auto-fetch email first, or paste email manually before continuing',
    '\u7ebf\u7a0b\u95f4\u9694': 'Thread Interval',
    '\u8be6\u60c5': 'Details',
    '\u9879\u76ee': 'Project',
    '\u9700\u8981\u767b\u5f55 iCloud': 'iCloud login required',
    '\u9a8c\u8bc1\u7801': 'SMS Code',
    '\u4e00\u5b9a\u8bf7\u5148\u5bfc\u51fa\u914d\u7f6e\uff0c\u518d\u6267\u884c\u66f4\u65b0': 'Be sure to export your config before updating',
    '\u5df2\u7981\u7528': 'Disabled',
    '\u5df2\u9009 0 \u4e2a': 'Selected 0',
    '\u5df2\u7528': 'Used',
    '\u5df2\u6709\u8ba4\u8bc1\u6587\u4ef6\uff1f\u524d\u5f80\u4e0a\u4f20': 'Already have auth file? Go to upload',
    '\u5f02\u5e38': 'Error',
    '\u7528\u4e8e\u6d4f\u89c8\u5668\u4ee3\u7406\u63a5\u7ba1\u4e0e\u51fa\u53e3\u5207\u6362': 'For browser proxy takeover and exit switching',
    '\u7528\u4e8e\u751f\u6210\u90ae\u7bb1\u6216\u63a5\u6536\u8f6c\u53d1\u90ae\u4ef6': 'Generate emails or receive forwarded emails',
    '\u7528\u4e8e\u751f\u6210\u90ae\u7bb1\u6216\u63a5\u6536\u8f6c\u53d1\u90ae\u4ef6\uff08skymail.ink API\uff09': 'Generate emails or receive forwarded emails (skymail.ink API)',
    '\u4f18\u5148\u590d\u7528\u5df2\u6709\u672a\u7528\u522b\u540d': 'Prefer reusing existing unused alias',
    '\u4f18\u5148\u53f7\u7801': 'Preferred Number',
    '\u4f18\u5148\u7ea7': 'Priority',
    '\u90ae\u4ef6\u63a5\u6536': 'Receive Mailbox',
    '\u90ae\u7bb1': 'Email',
    '\u90ae\u7bb1\u6c60': 'Email Pool',
    '\u90ae\u7bb1\u670d\u52a1': 'Mail Service',
    '\u90ae\u7bb1\u7c7b\u578b': 'Email Type',
    '\u90ae\u7bb1\u5bc6\u7801': 'Email Password',
    '\u90ae\u7bb1\u540d': 'Mailbox',
    '\u90ae\u7bb1\u751f\u6210': 'Email Generator',
    '\u90ae\u7bb1\u6ce8\u518c': 'Email Signup',
    '\u4f59\u989d\u672a\u83b7\u53d6': 'Balance not retrieved',
    '\u57df\u540d': 'Domain',
    '\u8fd0\u884c\u72b6\u6001': 'Runtime',
    '\u8fd0\u8425\u5546': 'Operator',
    '\u6682\u65e0\u53ef\u7528\u4ee3\u7406': 'No proxy available',
    '\u6682\u65e0\u8d26\u53f7\u8bb0\u5f55': 'No account records',
    '\u5c55\u5f00\u5217\u8868': 'Expand List',
    '\u5c55\u5f00\u8bbe\u7f6e': 'Expand Settings',
    '\u8d26\u53f7': 'Account',
    '\u8d26\u53f7\u4ee3\u7406\u5217\u8868': 'Account Proxy List',
    '\u8d26\u53f7\u4ea4\u4ed8': 'Account Delivery',
    '\u8d26\u53f7\u8bb0\u5f55': 'Account Records',
    '\u8d26\u53f7\u5bc6\u7801': 'Account/Password',
    '\u8d26\u53f7\u5bc6\u7801\u6a21\u5f0f': 'Account/Password Mode',
    '\u8d26\u6237\u5bc6\u7801': 'Account Password',
    '\u652f\u4ed8\u6210\u529f\u9875\u51fa\u73b0\u540e\u518d\u7ee7\u7eed\u8d26\u53f7\u63a5\u5165': 'Wait after success page appears, then continue account access',
    '\u6267\u884c\u8303\u56f4': 'Execution Range',
    '\u76f4\u7ed1\u7535\u8bdd': 'Direct Bind Phone',
    '\u76f4\u7ed1\u9a8c\u8bc1\u7801': 'Direct Bind Code',
    '\u91cd\u65b0\u5f00\u59cb': 'Restart',
    '\u6ce8\u518c': 'Sign Up',
    '\u6ce8\u518c\u65b9\u5f0f': 'Signup Method',
    '\u6ce8\u518c\u5165\u53e3': 'Register Entry',
    '\u6ce8\u518c\u624b\u673a\u53f7': 'Signup Phone',
    '\u6ce8\u518c\u90ae\u7bb1': 'Registration Email',
    '\u8f6c\u53d1\u5230\u5176\u4ed6\u90ae\u7bb1': 'Forward to other mailbox',
    '\u8f6c\u53d1\u90ae\u7bb1': 'Forward Mailbox',
    '\u81ea\u5b9a\u4e49\u53f7\u6c60': 'Custom Pool',
    '\u81ea\u5b9a\u4e49\u90ae\u7bb1': 'Custom Email',
    '\u81ea\u5b9a\u4e49\u90ae\u7bb1\u6c60': 'Custom Email Pool',
    '\u81ea\u52a8': 'Auto',
    '\u81ea\u52a8\uff08\u5148\u590d\u7528\u5df2\u6709\u53ef\u7528\u53f7\uff0c\u518d\u521b\u5efa\u65b0\u53f7\uff09': 'Auto (reuse existing available number first, then create new)',
    '\u81ea\u52a8\u521b\u5efa\u4e34\u65f6\u90ae\u7bb1\u5e76\u901a\u8fc7 API \u6536\u53d6\u9a8c\u8bc1\u7801': 'Automatically create temp mailboxes and fetch verification codes via API',
    '\u81ea\u52a8\u5220\u9664': 'Auto Delete',
    '\u81ea\u52a8\u540c\u6b65': 'Auto Sync',
    '\u81ea\u52a8\u7528\u4fdd\u5b58\u53f7': 'Auto Free Reuse',
    '\u81ea\u52a8\u91cd\u8bd5': 'Auto Retry',
    '\u81ea\u5efa\u90ae\u7bb1': 'Self-built mailbox',
    '\u6700\u4f4e\u8d2d\u4e70\u4ef7': 'Preferred Tier',
    '\u4f5c\u8005\u81ea\u8425': 'Author-operated',
    'API \u5730\u5740': 'API URL',
    'API \u62c9\u53d6\uff08\u6682\u672a\u5f00\u653e\uff09': 'API Pull (not available)',
    'API \u6a21\u5f0f': 'API Mode',
    'API\u5bf9\u63a5': 'API Integration',
    'CF \u57df\u540d': 'CF Domain',
    'Cloudflare Temp Email\uff08\u63a8\u8350\uff09': 'Cloudflare Temp Email (Recommended)',
    'CPA \u9762\u677f': 'CPA Panel',
    'Gmail \u90ae\u7bb1': 'Gmail',
    'Gmail \u90ae\u7bb1 (mail.google.com)': 'Gmail Mail (mail.google.com)',
    'Grok \u6ce8\u518c': 'Grok Register',
    'Hotmail \u8d26\u53f7\u6c60': 'Hotmail Account Pool',
    'Hotmail\uff08\u8d26\u53f7\u6c60\uff09': 'Hotmail (account pool)',
    'iCloud \u6536\u4ef6\u7bb1': 'iCloud Inbox',
    'iCloud \u9690\u79c1\u90ae\u7bb1': 'iCloud Hide My Email',
    'iCloud \u90ae\u7bb1': 'iCloud Mail',
    'Inbucket\uff08\u81ea\u5b9a\u4e49\u4e3b\u673a\uff09': 'Inbucket (custom host)',
    'IP \u4ee3\u7406': 'IP Proxy',
    'LuckMail \u914d\u7f6e': 'LuckMail Config',
    'LuckMail \u90ae\u7bb1\u5217\u8868': 'LuckMail Email List',
    'LuckMail\uff08API \u8d2d\u90ae\uff09': 'LuckMail (API purchase)',
    'PayPal \u65e0\u5361\u76f4\u7ed1': 'PayPal Cardless Direct',
    'PayPal \u8d26\u53f7': 'PayPal Account',
    'Plus \u8ba2\u9605\u94fe\u8def': 'Plus subscription flow',
    'Plus \u6a21\u5f0f': 'Plus Mode',
    'Plus \u652f\u4ed8': 'Plus Payment',
    'QQ \u90ae\u7bb1': 'QQ Mail',
    'QQ \u90ae\u7bb1 (wx.mail.qq.com) \u7248\u672c\u8001\u65e7\uff0c\u8bf7\u81ea\u884c\u7ef4\u62a4\u4f7f\u7528': 'QQ Mail (wx.mail.qq.com) outdated, please maintain yourself',
    'SSO \u72b6\u6001': 'SSO Status',
    '\u901a\u8fc7\u76ee\u6807\u5e73\u53f0 OAuth \u6388\u6743\u4ea4\u4ed8\u8d26\u53f7': 'Deliver account through target platform OAuth authorization',
    '\u8bfb\u53d6\u5f53\u524d ChatGPT \u767b\u5f55\u4f1a\u8bdd\u5e76\u5bfc\u5165\u76ee\u6807\u5e73\u53f0': 'Read the current ChatGPT session and import it into the target platform',
    '\u6ce8\u518c\u672c\u5730 Agent Identity \u540e\u5bfc\u5165\u76ee\u6807\u5e73\u53f0': 'Register a local Agent Identity and import it into the target platform',
  });

  const ATTRIBUTE_EN_US = Object.freeze({
    '20\uff08\u6210\u529f\u8f6e\u6b21\uff09': '20 (success rounds)',
    '2925 \u767b\u5f55\u5bc6\u7801': '2925 login password',
    '2925 \u90ae\u7bb1\u6a21\u5f0f': '2925 mail mode',
    '5-180\uff08\u5206\u949f\uff09': '5-180 (minutes)',
    '711Proxy \u4f1a\u8bdd\u65f6\u957f\u8303\u56f4\uff1a5-180 \u5206\u949f': '711Proxy session lifetime: 5-180 minutes',
    '\u4fdd\u6301\u5f53\u524d\u4f1a\u8bdd\u5e76\u5237\u65b0\u51fa\u53e3\uff08\u4ec5 711 + session\uff09': 'Keep current session and refresh exit (711 + session only)',
    '\u5fc5\u586b\uff0c\u7c98\u8d34\u5237\u65b0\u4ee4\u724c\uff08refresh token\uff09': 'Required, paste refresh token',
    '\u6b65\u95f4\u5ef6\u8fdf\u79d2\u6570\uff0c0 \u6216\u7559\u7a7a\u5219\u4e0d\u5ef6\u8fdf': 'Step delay in seconds, 0 or empty means no delay',
    '\u67e5\u770b\u8d26\u53f7\u8bb0\u5f55': 'View account records',
    '\u6253\u5f00 GitHub Releases \u9875\u9762': 'Open GitHub Releases page',
    '\u5355\u8f6e\u7b49\u5f85\u77ed\u4fe1\u5230\u8fbe\u7684\u6700\u957f\u79d2\u6570': 'Seconds to wait for SMS code per round',
    '\u5f53\u524d\u53f7\u7801\u5931\u8d25\u540e\uff0c\u6b65\u9aa4 9 \u5185\u90e8\u6700\u591a\u66f4\u6362\u51e0\u4e2a\u65b0\u53f7\u7801': 'Max times to replace number inside step 9',
    '\u515c\u5e95\u6a21\u5f0f\u4e0b\uff0c\u4e24\u8f6e\u7ebf\u7a0b\u4e4b\u95f4\u7684\u7b49\u5f85\u5206\u949f\u6570': 'In fallback mode, wait minutes between thread rounds',
    '\u590d\u7528\u624b\u673a\u53f7': 'Reuse phone number',
    '\u5173\u95ed': 'Close',
    '\u5173\u95ed\u66f4\u65b0\u63d0\u793a': 'Close update hint',
    '\u56de\u8c03\u65b9\u5f0f': 'Callback mode',
    '\u4f1a\u8bdd\u524d\u7f00\uff0c\u4f8b\u5982 ZC28qZ0KQL': 'Session prefix, e.g. ZC28qZ0KQL',
    '\u63a5\u7801\u4ef7\u683c\u4e0a\u9650\uff1b\u53ef\u7a7a\uff08\u7a7a=\u4e0d\u8bbe\u4e0a\u9650\uff09': 'SMS price cap; can be empty (empty = no upper limit)',
    '\u63a5\u7801\u6700\u4f4e\u8d2d\u4e70\u4ef7\uff1b\u53ef\u7a7a\uff08\u7a7a=\u4e0d\u8bbe\u4e0b\u9650\uff09': 'Minimum SMS buy price; can be empty (empty = no lower limit)',
    '\u4ec5\u5f53\u7ad9\u70b9\u542f\u7528\u4e86\u8bbf\u95ee\u5bc6\u7801\u65f6\u518d\u586b\u5199\uff1b\u8fd9\u662f\u989d\u5916\u9274\u6743\uff0c\u4e0d\u66ff\u4ee3 Admin Auth\u3002': 'Only fill in if the site has an access password; this is additional auth, does not replace Admin Auth.',
    '\u5f00\u542f\u540e\u542f\u7528 2925 \u8d26\u53f7\u6c60': 'Enable 2925 account pool',
    '\u53ef\u7559\u7a7a\uff0c\u5c06\u663e\u793a\u4e3a\u533f\u540d\u8d21\u732e\u8005': 'Optional, will display as anonymous contributor',
    '\u53ef\u7559\u7a7a\uff0c\u53ea\u80fd\u586b\u5199\u6570\u5b57': 'Optional, digits only',
    '\u53ef\u9009\uff0c\u4ec5\u7528\u4e8e\u8bb0\u5f55': 'Optional, used only for record',
    '\u53ef\u9009\uff0c\u4f8b\u5982 US / DE / HK': 'Optional, e.g. US / DE / HK',
    '\u53ef\u9009\uff0c\u7559\u7a7a\u5219\u7531 LuckMail \u9ed8\u8ba4\u5904\u7406': 'Optional, leave blank to use LuckMail default',
    '\u4f8b\u5982 0.0512\uff08\u53ef\u7a7a\uff09': 'e.g. 0.0512 (optional)',
    '\u4f8b\u5982 10000': 'e.g. 10000',
    '\u4f8b\u5982 global.rotgb.711proxy.com': 'e.g. global.rotgb.711proxy.com',
    '\u4f8b\u5982 mail.example.com': 'e.g. mail.example.com',
    '\u4f8b\u5982 USER047152-zone-custom-region-US-asn-ASN81': 'e.g. USER047152-zone-custom-region-US-asn-ASN81',
    '\u4f8b\u5982 yourdomain.xyz': 'e.g. yourdomain.xyz',
    '\u4f8b\u5982 yourname@example.com': 'e.g. yourname@example.com',
    '\u4f8b\u5982 zju2001': 'e.g. zju2001',
    '\u7559\u7a7a\u5219\u4e0d\u4f7f\u7528\u4ee3\u7406\uff1b\u6216\u586b\u5199\u4ee3\u7406\u540d\u79f0 / ID': 'Leave blank for no proxy; or fill in proxy name / ID',
    '\u6bcf\u6210\u529f\u591a\u5c11\u8f6e\u4efb\u52a1\u540e\u81ea\u52a8\u5207\u6362\u4e00\u6b21\u4ee3\u7406\uff1b\u4ec5 1 \u6761\u8282\u70b9\u65f6\u4f1a\u8df3\u8fc7\u81ea\u52a8\u5207\u6362': 'Auto-rotate proxy after every N successful rounds; auto-rotation is skipped when there is only 1 node',
    '\u6bcf\u4e2a\u9a8c\u8bc1\u7801\u7b49\u5f85\u7a97\u53e3\u7684\u57fa\u7840\u8f6e\u8be2\u6b21\u6570\uff1b\u5982\u679c\u4f4e\u4e8e\u7b49\u5f85\u65f6\u957f\u548c\u8f6e\u8be2\u95f4\u9694\u6240\u9700\u6b21\u6570\uff0c\u4f1a\u81ea\u52a8\u8865\u8db3\uff0c\u907f\u514d\u63d0\u524d\u7ed3\u675f': 'Base poll rounds per SMS wait window; auto-padded if below the count needed for wait duration and poll interval, to avoid ending early',
    '\u6bcf\u884c\u4e00\u4e2a\u90ae\u7bb1\uff0c\u4f8b\u5982&#10;alias001@gmail.com&#10;alias002@gmail.com': 'One email per line, e.g.&#10;alias001@gmail.com&#10;alias002@gmail.com',
    '\u6bcf\u884c\u4e00\u4e2a\u6ce8\u518c\u90ae\u7bb1\uff0c\u4f8b\u5982&#10;alias001@example.com&#10;alias002@example.com': 'One registration email per line, e.g.&#10;alias001@example.com&#10;alias002@example.com',
    '\u6bcf\u884c\u4e00\u6761\uff1ahost:port \u6216 host:port:username:password&#10;\u4f8b\u5982 global.rotgb.711proxy.com:10000:username:password': 'One per line: host:port or host:port:username:password&#10;e.g. global.rotgb.711proxy.com:10000:username:password',
    '\u5207\u6362\u4e3b\u9898': 'Toggle theme',
    '\u6e05\u7a7a\u65e5\u5fd7': 'Clear log',
    '\u8bf7\u8f93\u5165 5sim API Key\uff08Bearer Token\uff09': 'Enter 5sim API Key (Bearer Token)',
    '\u8bf7\u8f93\u5165 Codex2API Admin Secret': 'Enter Codex2API Admin Secret',
    '\u8bf7\u8f93\u5165 CPA \u7ba1\u7406\u5bc6\u94a5': 'Enter CPA admin key',
    '\u8bf7\u8f93\u5165 HeroSMS API Key': 'Enter HeroSMS API Key',
    '\u8bf7\u8f93\u5165 kiro.rs \u7ba1\u7406\u5730\u5740': 'Enter kiro.rs management URL',
    '\u8bf7\u8f93\u5165 kiro.rs API Key': 'Enter kiro.rs API Key',
    '\u8bf7\u8f93\u5165 LuckMail API Key': 'Enter LuckMail API Key',
    '\u8bf7\u8f93\u5165 NexSMS API Key': 'Enter NexSMS API Key',
    '\u8bf7\u8f93\u5165 SUB2API \u767b\u5f55\u5bc6\u7801': 'Enter SUB2API login password',
    '\u8bf7\u8f93\u5165 SUB2API \u767b\u5f55\u90ae\u7bb1': 'Enter SUB2API login email',
    '\u8bf7\u8f93\u5165 webchat2api \u5730\u5740\uff0c\u4f8b\u5982 http://localhost:83': 'Enter webchat2api URL, e.g. http://localhost:83',
    '\u8bf7\u8f93\u5165 webchat2api \u7ba1\u7406\u5bc6\u94a5': 'Enter webchat2api admin key',
    '\u8bf7\u8f93\u5165 YYDS Mail API Key\uff08AC-...\uff09': 'Enter YYDS Mail API Key (AC-...)',
    '\u641c\u7d22\u90ae\u7bb1 / \u5907\u6ce8': 'Search email / note',
    '\u641c\u7d22\u90ae\u7bb1 / \u6807\u7b7e / \u5907\u6ce8': 'Search email / tag / note',
    '\u641c\u7d22\u90ae\u7bb1 / \u6807\u7b7e / \u9879\u76ee': 'Search email / tag / project',
    '\u641c\u7d22\u90ae\u7bb1 / \u72b6\u6001': 'Search email / status',
    '\u586b 10 \u4f4d\u7f8e\u56fd\u672c\u5730\u53f7\u7801\uff0c\u4e0d\u8981\u5e26 +1': 'Enter 10-digit US local number, without +1',
    '\u586b\u5199\u4e3b\u673a\u6216 https://\u4e3b\u673a\u5730\u5740': 'Enter host or https://host',
    '\u505c\u6b62\u5f53\u524d\u6d41\u7a0b': 'Stop current flow',
    '\u540c\u4e00\u53f7\u7801\u6700\u591a\u7b49\u5f85\u51e0\u8f6e\uff1b\u672a\u5230\u6700\u540e\u4e00\u8f6e\u65f6\u53ef\u80fd\u89e6\u53d1\u9875\u9762\u91cd\u53d1\u6216\u5e73\u53f0\u8ffd\u52a0\u77ed\u4fe1': 'After SMS timeout, max rounds to keep waiting before replacing the number',
    '\u5b8c\u6574\u56fd\u9645\u53f7\u7801\uff0c\u5982 +44...': 'Full international number, e.g. +44...',
    '\u5fae\u8f6f\u5e94\u7528\u5ba2\u6237\u7aef ID': 'Microsoft application client ID',
    '\u5fae\u8f6f\u90ae\u7bb1 API \u5bf9\u63a5\u6a21\u5f0f\u65e0\u9700\u586b\u5199\u5730\u5740': 'Microsoft mailbox API integration mode does not require a URL',
    '\u663e\u793a 2925 \u5bc6\u7801': 'Show 2925 password',
    '\u663e\u793a 5sim API Key': 'Show 5sim API Key',
    '\u663e\u793a Admin Auth': 'Show Admin Auth',
    '\u663e\u793a Cloud Mail \u5bc6\u7801': 'Show Cloud Mail password',
    '\u663e\u793a Codex2API \u7ba1\u7406\u5bc6\u94a5': 'Show Codex2API admin key',
    '\u663e\u793a CPA \u5730\u5740': 'Show CPA URL',
    '\u663e\u793a Custom Auth': 'Show Custom Auth',
    '\u663e\u793a HeroSMS API Key': 'Show HeroSMS API Key',
    '\u663e\u793a Hotmail \u5bc6\u7801': 'Show Hotmail password',
    '\u663e\u793a Hotmail \u5237\u65b0\u4ee4\u724c': 'Show Hotmail refresh token',
    '\u663e\u793a kiro.rs API Key': 'Show kiro.rs API Key',
    '\u663e\u793a LuckMail API Key': 'Show LuckMail API Key',
    '\u663e\u793a NexSMS API Key': 'Show NexSMS API Key',
    '\u663e\u793a SUB2API \u5bc6\u7801': 'Show SUB2API password',
    '\u663e\u793a webchat2api \u7ba1\u7406\u5bc6\u94a5': 'Show webchat2api admin key',
    '\u663e\u793a YYDS Mail API Key': 'Show YYDS Mail API Key',
    '\u663e\u793a\u4ee3\u7406 API': 'Show proxy API',
    '\u663e\u793a\u4ee3\u7406\u5bc6\u7801': 'Show proxy password',
    '\u663e\u793a\u4ee3\u7406\u8d26\u53f7': 'Show proxy username',
    '\u663e\u793a\u7ba1\u7406\u5bc6\u94a5': 'Show admin key',
    '\u663e\u793a\u5bc6\u7801': 'Show password',
    '\u5411\u63a5\u7801\u5e73\u53f0\u67e5\u8be2\u77ed\u4fe1\u72b6\u6001\u7684\u95f4\u9694\u79d2\u6570': 'Seconds between SMS status polls to HeroSMS',
    '\u9a8c\u8bc1\u7801\u5df2\u6536\u5230\u4f46\u88ab OpenAI \u5224\u5b9a\u9519\u8bef\u65f6\uff0c\u6700\u591a\u91cd\u65b0\u8bf7\u6c42\u77ed\u4fe1\u7684\u6b21\u6570\uff1b\u7b49\u5f85\u77ed\u4fe1\u8d85\u65f6\u4e0d\u6d88\u8017\u8fd9\u4e2a\u6b21\u6570': 'Number of times to auto-click resend verification code',
    '\u5df2\u8bb0\u5f55\u53f7\u7801\u4f1a\u81ea\u52a8\u663e\u793a\uff1b\u672a\u8bb0\u5f55\u65f6\u53ef\u624b\u52a8\u586b\u5199\u5e76\u8bb0\u5f55': 'Recorded numbers are shown automatically; if none recorded, fill in and record manually',
    '\u9690\u85cf 2925 \u5bc6\u7801': 'Hide 2925 password',
    '\u9690\u85cf 5sim API Key': 'Hide 5sim API Key',
    '\u9690\u85cf Admin Auth': 'Hide Admin Auth',
    '\u9690\u85cf Cloud Mail \u5bc6\u7801': 'Hide Cloud Mail password',
    '\u9690\u85cf Codex2API \u7ba1\u7406\u5bc6\u94a5': 'Hide Codex2API admin key',
    '\u9690\u85cf Custom Auth': 'Hide Custom Auth',
    '\u9690\u85cf HeroSMS API Key': 'Hide HeroSMS API Key',
    '\u9690\u85cf Hotmail \u5bc6\u7801': 'Hide Hotmail password',
    '\u9690\u85cf Hotmail \u5237\u65b0\u4ee4\u724c': 'Hide Hotmail refresh token',
    '\u9690\u85cf kiro.rs API Key': 'Hide kiro.rs API Key',
    '\u9690\u85cf LuckMail API Key': 'Hide LuckMail API Key',
    '\u9690\u85cf NexSMS API Key': 'Hide NexSMS API Key',
    '\u9690\u85cf SUB2API \u5bc6\u7801': 'Hide SUB2API password',
    '\u9690\u85cf webchat2api \u7ba1\u7406\u5bc6\u94a5': 'Hide webchat2api admin key',
    '\u9690\u85cf YYDS Mail API Key': 'Hide YYDS Mail API Key',
    '\u7528\u4e8e\u8bfb\u53d6 PayPal / OpenAI \u9a8c\u8bc1\u7801\u7684\u63a5\u53e3\u5730\u5740': 'API URL for reading PayPal / OpenAI verification codes',
    '\u7528\u4e8e\u63a5\u6536\u8f6c\u53d1\u90ae\u4ef6\u7684\u90ae\u7bb1\uff0c\u4f8b\u5982 1@email.example.com': 'Mailbox used to receive forwarded emails, e.g. 1@email.example.com',
    '\u4f18\u5148\u5c1d\u8bd5\u8be5\u4ef7\u683c\u6863\u4f4d\uff1b\u53ef\u7a7a\uff08\u7a7a=\u6309\u4f18\u5148\u7ea7\u7b56\u7565\uff09': 'Prefer trying this price tier first; can be empty (empty = use priority strategy)',
    '\u90ae\u7bb1----\u5bc6\u7801&#10;name@2925.com----password': 'Email----Password&#10;name@2925.com----password',
    '\u5141\u8bb8\u6267\u884c\u7684\u7ed3\u675f\u8282\u70b9': 'Allowed end node',
    '\u5141\u8bb8\u6267\u884c\u7684\u8d77\u59cb\u8282\u70b9': 'Allowed start node',
    '\u8fd0\u884c\u6b21\u6570': 'Run count',
    '\u7c98\u8d34\u5b8c\u6574 API \u94fe\u63a5': 'Paste full API URL',
    '\u8d26\u53f7----\u5bc6\u7801----\u5ba2\u6237\u7aefID----\u5237\u65b0\u4ee4\u724c&#10;name@hotmail.com----password----client-id----refresh-token': 'Account----Password----Client ID----Refresh Token&#10;name@hotmail.com----password----client-id----refresh-token',
    '\u8d26\u53f7\u8bb0\u5f55\u7b5b\u9009': 'Account records filter',
    '\u8d26\u53f7\u5bc6\u7801\u4ee3\u7406\u7684\u5bc6\u7801': 'Password for account/password proxy',
    '\u8d26\u6237\u5bc6\u7801\uff0c\u7559\u7a7a\u5219\u81ea\u52a8\u751f\u6210': 'Account password, auto-generated if empty',
    '\u91cd\u7f6e\u5168\u90e8\u6b65\u9aa4': 'Reset all steps',
    '\u6ce8\u518c\u65b9\u5f0f': 'Signup method',
    '\u81ea\u52a8\u751f\u6210\u6216\u624b\u52a8\u7c98\u8d34\u90ae\u7bb1': 'Auto-generated or manually pasted email',
    '\u81ea\u52a8\u540c\u6b65\u95f4\u9694\uff08\u5206\u949f\uff09': 'Auto sync interval (minutes)',
    '\u81ea\u52a8\u6267\u884c\u5168\u90e8\u6b65\u9aa4': 'Automatically execute all steps',
    'Cloud Mail \u7ba1\u7406\u5458\u5bc6\u7801': 'Cloud Mail admin password',
    'Cloudflare Temp Email \u67e5\u4fe1\u65b9\u5f0f': 'Cloudflare Temp Email lookup mode',
    'Flow \u9009\u62e9': 'Flow selection',
    'Hotmail \u63a5\u7801\u6a21\u5f0f': 'Hotmail SMS verification mode',
    'IP\u4ee3\u7406\u6a21\u5f0f': 'IP proxy mode',
  });

  const DYNAMIC_TEXT_EN_US = Object.freeze({
    '\u6253\u5f00 ChatGPT \u5b98\u7f51': 'Open ChatGPT website',
    '\u6ce8\u518c\u5e76\u8f93\u5165\u90ae\u7bb1': 'Sign up and enter email',
    '\u586b\u5199\u5bc6\u7801\u5e76\u7ee7\u7eed': 'Enter password and continue',
    '\u83b7\u53d6\u6ce8\u518c\u9a8c\u8bc1\u7801': 'Get signup verification code',
    '\u586b\u5199\u59d3\u540d\u548c\u751f\u65e5': 'Fill in name and birthday',
    '\u5237\u65b0 OAuth \u5e76\u767b\u5f55': 'Refresh OAuth and log in',
    '\u83b7\u53d6\u767b\u5f55\u9a8c\u8bc1\u7801': 'Get login verification code',
    '\u6ce8\u518c\u5e76\u8f93\u5165\u624b\u673a\u53f7': 'Sign up and enter phone number',
    '\u83b7\u53d6\u624b\u673a\u9a8c\u8bc1\u7801': 'Get SMS verification code',
    '\u7ed1\u5b9a\u90ae\u7bb1': 'Bind email',
    '\u83b7\u53d6\u7ed1\u5b9a\u90ae\u7bb1\u9a8c\u8bc1\u7801': 'Get email binding verification code',
    '\u7ed1\u5b9a\u90ae\u7bb1\u540e\u5237\u65b0 OAuth \u5e76\u767b\u5f55\uff08\u90ae\u7bb1\uff09': 'Refresh OAuth and log in after email binding (email)',
    '\u83b7\u53d6\u767b\u5f55\u9a8c\u8bc1\u7801\uff08\u90ae\u7bb1\uff09': 'Get login verification code (email)',
    '\u521b\u5efa Plus Checkout': 'Create Plus Checkout',
    '\u586b\u5199\u8d26\u5355\u5e76\u63d0\u4ea4\u8ba2\u5355': 'Fill billing details and submit order',
    'PayPal \u767b\u5f55\u4e0e\u6388\u6743': 'PayPal login and authorization',
    '\u8ba2\u9605\u56de\u8df3\u786e\u8ba4': 'Confirm subscription return',
    '\u5bfc\u5165\u5f53\u524d ChatGPT \u4f1a\u8bdd\u5230 SUB2API': 'Import current ChatGPT session to SUB2API',
    '\u5bfc\u5165\u5f53\u524d ChatGPT \u4f1a\u8bdd\u5230 CPA': 'Import current ChatGPT session to CPA',
    '\u65e0\u5361\u76f4\u7ed1\u586b\u5199 PayPal \u90ae\u7bb1': 'No-card direct bind: enter PayPal email',
    '\u65e0\u5361\u76f4\u7ed1\u586b\u5199 PayPal \u8d44\u6599': 'No-card direct bind: fill PayPal details',
    '\u65e0\u5361\u76f4\u7ed1\u786e\u8ba4\u521b\u5efa PayPal': 'No-card direct bind: confirm PayPal creation',
    '\u65e0\u5361\u76f4\u7ed1\u5b8c\u6210 PayPal \u6388\u6743': 'No-card direct bind: complete PayPal authorization',
    '\u6253\u5f00\u6ce8\u518c\u9875': 'Open signup page',
    '\u83b7\u53d6\u90ae\u7bb1\u5e76\u7ee7\u7eed': 'Get email and continue',
    '\u586b\u5199\u59d3\u540d\u5e76\u7ee7\u7eed': 'Fill in name and continue',
    '\u83b7\u53d6\u9a8c\u8bc1\u7801\u5e76\u7ee7\u7eed': 'Get verification code and continue',
    '\u8bbe\u7f6e\u5bc6\u7801\u5e76\u7ee7\u7eed': 'Set password and continue',
    '\u5b8c\u6210\u6ce8\u518c\u6388\u6743': 'Complete signup authorization',
    '\u542f\u52a8\u684c\u9762\u6388\u6743': 'Start desktop authorization',
    '\u5b8c\u6210\u684c\u9762\u6388\u6743': 'Complete desktop authorization',
    '\u4e0a\u4f20\u51ed\u636e\u5230 kiro.rs': 'Upload credentials to kiro.rs',
    '\u6253\u5f00 Grok \u6ce8\u518c\u9875': 'Open Grok signup page',
    '\u586b\u5199\u8d44\u6599\u5e76\u7ee7\u7eed': 'Fill in profile and continue',
    '\u63d0\u53d6 SSO Cookie': 'Extract SSO Cookie',
    '\u4e0a\u4f20 SSO \u5230 webchat2api': 'Upload SSO to webchat2api',
    '\u4e0a\u4f20 ChatGPT \u4f1a\u8bdd\u5230 webchat': 'Upload ChatGPT session to webchat',
    '\u4e0a\u4f20 ChatGPT \u4f1a\u8bdd\u5230 ChatGPT2API': 'Upload ChatGPT session to ChatGPT2API',
    '\u6709\u66f4\u65b0': 'Update available',
    '\u6267\u884c\u8303\u56f4\u5df2\u5b8c\u6210': 'Execution range completed',
    '\u5168\u90e8\u8282\u70b9\u5df2\u5b8c\u6210': 'All nodes completed',
    '\u6267\u884c\u8303\u56f4\u5df2\u5b8c\u6210/\u8df3\u8fc7': 'Execution range completed/skipped',
    '\u5168\u90e8\u8282\u70b9\u5df2\u5b8c\u6210/\u8df3\u8fc7': 'All nodes completed/skipped',
    '\u7b49\u5f85\u4e2d': 'Waiting',
    '\u5df2\u6682\u505c': 'Paused',
    '\u8fd0\u884c\u4e2d': 'Running',
    '\u91cd\u8bd5\u4e2d': 'Retrying',
    '\u4fe1\u606f': 'Info',
    '\u6210\u529f': 'Success',
    '\u8b66\u544a': 'Warning',
    '\u9519\u8bef': 'Error',
    '\u914d\u7f6e\u5df2\u4fdd\u5b58': 'Config saved',
    '\u6b63\u5728\u53d6\u6d88\u7b49\u5f85\u4e2d\u7684\u5012\u8ba1\u65f6...': 'Canceling the waiting countdown...',
    '\u6b63\u5728\u505c\u6b62\u5f53\u524d\u6d41\u7a0b...': 'Stopping the current flow...',
    '\u5df2\u8df3\u8fc7\u5f53\u524d\u5012\u8ba1\u65f6\uff0c\u81ea\u52a8\u6d41\u7a0b\u5c06\u7acb\u5373\u7ee7\u7eed\u3002': 'Skipped the current countdown. The auto flow will continue immediately.',
    '\u8bf7\u9009\u62e9 webchat \u6765\u6e90\u5e76\u5b8c\u6210\u914d\u7f6e\u540e\u518d\u5f00\u542f\u540c\u6b65\u3002': 'Select a webchat source and complete configuration before enabling sync.',
    'API \u6a21\u5f0f\u6682\u672a\u5f00\u653e\uff0c\u8bf7\u5148\u4f7f\u7528\u8d26\u53f7\u5bc6\u7801\u6a21\u5f0f\u3002': 'API mode is not available yet. Use account/password mode first.',
    '\u8bf7\u8f93\u5165\u6709\u6548\u7684 Cloudflare \u57df\u540d\u3002': 'Enter a valid Cloudflare domain.',
    '\u5df2\u5237\u65b0\u63a5\u7801\u56fd\u5bb6\u4ef7\u683c\u9884\u89c8\u3002': 'SMS country price preview refreshed.',
    '\u5df2\u5237\u65b0\u63a5\u7801\u5e73\u53f0\u4f59\u989d\u3002': 'SMS platform balance refreshed.',
    '\u5df2\u6e05\u7a7a\u56fd\u5bb6\u4f18\u5148\u7ea7\u3002': 'Country priority cleared.',
    '\u5df2\u6e05\u7a7a\u670d\u52a1\u5546\u987a\u5e8f\u3002': 'Provider order cleared.',
    '\u5f53\u524d\u4ee3\u7406\u670d\u52a1\u6ca1\u6709\u53ef\u8df3\u8f6c\u7684\u767b\u5f55\u9875\u3002': 'The current proxy service has no login page to open.',
    '\u8868\u5355\u5f39\u7a97\u672a\u52a0\u8f7d\uff0c\u8bf7\u5237\u65b0\u6269\u5c55\u540e\u91cd\u8bd5\u3002': 'Form dialog not loaded. Refresh the extension and retry.',
    '\u81f3\u5c11\u4fdd\u7559\u4e00\u4e2a SUB2API \u5206\u7ec4\u3002': 'At least one SUB2API group must be kept.',
    '\u5f53\u524d\u6ca1\u6709 Grok SSO Cookie\u3002': 'There is currently no Grok SSO Cookie.',
    'Grok SSO Cookie \u5df2\u590d\u5236\u3002': 'Grok SSO Cookie copied.',
    'Grok SSO Cookie \u5df2\u6e05\u7a7a\u3002': 'Grok SSO Cookie cleared.',
  });

  const TRANSLATABLE_ATTRS = Object.freeze(['title', 'aria-label', 'placeholder', 'data-show-label', 'data-hide-label']);
  const originalTextByNode = new WeakMap();
  const originalAttrByElement = new WeakMap();
  let observer = null;
  let activeLocale = 'zh-CN';
  let applying = false;

  function isEnglish(locale) {
    return String(locale || '').toLowerCase() === 'en-us';
  }

  function preserveWhitespace(source, translated) {
    const match = String(source || '').match(/^(\s*)([\s\S]*?)(\s*)$/);
    return match ? match[1] + translated + match[3] : translated;
  }

  function translateDynamicText(compact) {
    const exact = DYNAMIC_TEXT_EN_US[compact];
    if (exact) {
      return exact;
    }
    let match = compact.match(/^\u81ea\u52a8\u5df2\u6682\u505c(.*)\uff0c\u7b49\u5f85\u90ae\u7bb1\u540e\u7ee7\u7eed$/);
    if (match) {
      return `Auto paused${translateAutoRunLabel(match[1])}, waiting for email to continue`;
    }
    match = compact.match(/^\u81ea\u52a8\u7b49\u5f85\u8282\u70b9 (.+) \u5b8c\u6210\u540e\u7ee7\u7eed(.*)$/);
    if (match) {
      return `Auto waiting for node ${match[1]} to complete${translateAutoRunLabel(match[2])}`;
    }
    match = compact.match(/^\u81ea\u52a8\u6b63\u5728\u6309\u6700\u65b0\u8fdb\u5ea6\u51c6\u5907\u7ee7\u7eed(.*)$/);
    if (match) {
      return `Auto preparing to continue from latest progress${translateAutoRunLabel(match[1])}`;
    }
    match = compact.match(/^\u81ea\u52a8\u91cd\u8bd5\u4e2d(.*)$/);
    if (match) {
      return `Auto retrying${translateAutoRunLabel(match[1])}`;
    }
    match = compact.match(/^\u81ea\u52a8\u8fd0\u884c\u4e2d(.*)$/);
    if (match) {
      return `Auto running${translateAutoRunLabel(match[1])}`;
    }
    match = compact.match(/^\u8282\u70b9 (.+) \u8fd0\u884c\u4e2d\.\.\.$/);
    if (match) {
      return `Node ${match[1]} running...`;
    }
    match = compact.match(/^\u8282\u70b9 (.+) \u5931\u8d25$/);
    if (match) {
      return `Node ${match[1]} failed`;
    }
    match = compact.match(/^\u8282\u70b9 (.+) \u5df2\u505c\u6b62$/);
    if (match) {
      return `Node ${match[1]} stopped`;
    }
    match = compact.match(/^\u8282\u70b9 (.+) \u5df2\u8df3\u8fc7$/);
    if (match) {
      return `Node ${match[1]} skipped`;
    }
    match = compact.match(/^\u8282\u70b9 (.+) \u5df2\u5b8c\u6210$/);
    if (match) {
      return `Node ${match[1]} completed`;
    }
    match = compact.match(/^(.+)\uff0c\u5269\u4f59 (.+)$/);
    if (match) {
      return `${translateValue(match[1], 'en-US', TEXT_EN_US)}, remaining ${match[2]}`;
    }
    match = compact.match(/^(.+)\uff0c\u5373\u5c06\u7ed3\u675f\.\.\.$/);
    if (match) {
      return `${translateValue(match[1], 'en-US', TEXT_EN_US)}, ending soon...`;
    }
    match = compact.match(/^\u6700\u65b0\u7248\u672c (.+)$/);
    if (match) {
      return `Latest version ${match[1]}`;
    }
    match = compact.match(/^\u5f53\u524d (.+)\uff0c\u5171\u6709 (.+) \u4e2a\u65b0\u7248\u672c\u53ef\u66f4\u65b0\u3002$/);
    if (match) {
      return `Current ${match[1]}, ${match[2]} new versions available.`;
    }
    match = compact.match(/^\u5f53\u524d (.+)\uff0c\u53ef\u66f4\u65b0\u5230 (.+)\u3002$/);
    if (match) {
      return `Current ${match[1]}, update available to ${match[2]}.`;
    }
    match = compact.match(/^\u7b49\u5f85\u4e2d(.*)$/);
    if (match) {
      return `Waiting${translateAutoRunLabel(match[1])}`;
    }
    match = compact.match(/^\u5df2\u6682\u505c(.*)$/);
    if (match) {
      return `Paused${translateAutoRunLabel(match[1])}`;
    }
    match = compact.match(/^\u8fd0\u884c\u4e2d(.*)$/);
    if (match) {
      return `Running${translateAutoRunLabel(match[1])}`;
    }
    match = compact.match(/^\u91cd\u8bd5\u4e2d(.*)$/);
    if (match) {
      return `Retrying${translateAutoRunLabel(match[1])}`;
    }
    match = compact.match(/^\u6b65(\d+)$/);
    if (match) {
      return `Step ${match[1]}`;
    }
    match = compact.match(/^\u6b65\u9aa4 (\d+)\uff1a(.+)$/);
    if (match) {
      return `Step ${match[1]}: ${translateLogFragment(match[2])}`;
    }
    match = compact.match(/^\u8282\u70b9 (.+) \u5df2\u8df3\u8fc7$/);
    if (match) {
      return `Node ${match[1]} skipped`;
    }
    match = compact.match(/^\u4fdd\u5b58\u5931\u8d25\uff1a(.+)$/);
    if (match) {
      return `Save failed: ${match[1]}`;
    }
    match = compact.match(/^\u914d\u7f6e\u5df2\u5bfc\u51fa\uff1a(.+)$/);
    if (match) {
      return `Config exported: ${match[1]}`;
    }
    match = compact.match(/^\u5bfc\u51fa\u914d\u7f6e\u5931\u8d25\uff1a(.+)$/);
    if (match) {
      return `Export config failed: ${match[1]}`;
    }
    match = compact.match(/^\u5bfc\u5165\u914d\u7f6e\u5931\u8d25\uff1a(.+)$/);
    if (match) {
      return `Import config failed: ${match[1]}`;
    }
    match = compact.match(/^\u5df2\u5ffd\u7565 (.+) \u66f4\u65b0\uff0c\u6709\u65b0\u7248\u672c\u65f6\u4f1a\u518d\u6b21\u63d0\u9192\u3002$/);
    if (match) {
      return `Ignored ${match[1]} update. You will be reminded again when a new version is available.`;
    }
    match = compact.match(/^\u6253\u5f00(.+)\u5931\u8d25\uff1a(.+)$/);
    if (match) {
      return `Failed to open ${translateValue(match[1], 'en-US', TEXT_EN_US)}: ${match[2]}`;
    }
    match = compact.match(/^\u6253\u5f00 IP \u68c0\u6d4b\u9875\u5931\u8d25\uff1a(.+)$/);
    if (match) {
      return `Failed to open the IP check page: ${match[1]}`;
    }
    match = compact.match(/^(.+)\u5931\u8d25\uff1a(.+)$/);
    if (match) {
      return `${translateLogFragment(match[1])} failed: ${match[2]}`;
    }
    return '';
  }

  function translateLogFragment(fragment = '') {
    const compact = String(fragment || '').trim().replace(/\s+/g, ' ');
    const direct = TEXT_EN_US[compact] || DYNAMIC_TEXT_EN_US[compact];
    if (direct) {
      return direct;
    }
    let match = compact.match(/^\u6b63\u5728\u901a\u8fc7 (.+) \u8f6e\u8be2\u9a8c\u8bc1\u7801\uff08(.+)\uff09\.\.\.$/);
    if (match) {
      return `Polling verification code via ${match[1]} (${match[2]})...`;
    }
    match = compact.match(/^\u5df2\u901a\u8fc7 (.+) \u627e\u5230\u9a8c\u8bc1\u7801\uff1a(.+)$/);
    if (match) {
      return `Found verification code via ${match[1]}: ${match[2]}`;
    }
    match = compact.match(/^\u6682\u672a\u5728 (.+) \u4e2d\u627e\u5230\u5339\u914d\u9a8c\u8bc1\u7801\uff08(.+)\uff09\u3002$/);
    if (match) {
      return `No matching verification code found in ${match[1]} yet (${match[2]}).`;
    }
    match = compact.match(/^(.+) \u8f6e\u8be2\u5931\u8d25\uff1a(.+)$/);
    if (match) {
      return `${match[1]} polling failed: ${match[2]}`;
    }
    match = compact.match(/^\u672a\u5728 (.+) \u4e2d\u627e\u5230\u65b0\u7684\u5339\u914d\u9a8c\u8bc1\u7801\u3002$/);
    if (match) {
      return `No new matching verification code found in ${match[1]}.`;
    }
    return compact;
  }

  function translateAutoRunLabel(label = '') {
    const raw = String(label || '');
    if (!raw) {
      return '';
    }
    let next = raw
      .replace(/(\d+)\u8f6e/g, '$1 rounds')
      .replace(/\u5c1d\u8bd5(\d+)/g, 'attempt $1')
      .replace(/\s*\u00b7\s*/g, ' / ');
    return next;
  }

  function translateValue(value, locale = activeLocale, dictionary = TEXT_EN_US) {
    if (!isEnglish(locale)) {
      return String(value || '');
    }
    const raw = String(value || '');
    const compact = raw.trim().replace(/\s+/g, ' ');
    if (!compact) {
      return raw;
    }
    const translated = dictionary[compact] || (dictionary === TEXT_EN_US ? translateDynamicText(compact) : '');
    return translated ? preserveWhitespace(raw, translated) : raw;
  }

  function shouldSkipNode(node) {
    const parent = node?.parentElement || node?.parentNode || null;
    if (!parent) {
      return true;
    }
    const tagName = String(parent.tagName || '').toLowerCase();
    return tagName === 'script' || tagName === 'style' || tagName === 'template' || Boolean(parent.closest?.('[data-i18n-ignore]'));
  }

  function translateTextNode(node, locale = activeLocale) {
    if (!node || node.nodeType !== 3 || shouldSkipNode(node)) {
      return;
    }
    if (!originalTextByNode.has(node)) {
      originalTextByNode.set(node, node.nodeValue || '');
    }
    const source = originalTextByNode.get(node) || '';
    const nextValue = isEnglish(locale) ? translateValue(source, locale, TEXT_EN_US) : source;
    if (node.nodeValue !== nextValue) {
      node.nodeValue = nextValue;
    }
  }

  function getOriginalAttrMap(element) {
    let map = originalAttrByElement.get(element);
    if (!map) {
      map = new Map();
      originalAttrByElement.set(element, map);
    }
    return map;
  }

  function translateElementAttrs(element, locale = activeLocale) {
    if (!element || element.nodeType !== 1 || element.closest?.('[data-i18n-ignore]')) {
      return;
    }
    const originalAttrs = getOriginalAttrMap(element);
    TRANSLATABLE_ATTRS.forEach((attrName) => {
      if (!element.hasAttribute(attrName)) {
        return;
      }
      if (!originalAttrs.has(attrName)) {
        originalAttrs.set(attrName, element.getAttribute(attrName) || '');
      }
      const source = originalAttrs.get(attrName) || '';
      const nextValue = isEnglish(locale) ? translateValue(source, locale, ATTRIBUTE_EN_US) : source;
      if (element.getAttribute(attrName) !== nextValue) {
        element.setAttribute(attrName, nextValue);
      }
    });
  }

  function walkTextNodes(rootNode, visitor) {
    const doc = rootNode?.ownerDocument || rootNode;
    if (!doc?.createTreeWalker) {
      return;
    }
    const walker = doc.createTreeWalker(rootNode, 4);
    let node = walker.nextNode();
    while (node) {
      visitor(node);
      node = walker.nextNode();
    }
  }

  function apply(rootNode, options = {}) {
    const target = rootNode?.body || rootNode?.documentElement || rootNode;
    if (!target?.querySelectorAll) {
      return;
    }
    activeLocale = options.locale || activeLocale || 'zh-CN';
    applying = true;
    try {
      if (target.nodeType === 1) {
        translateElementAttrs(target, activeLocale);
      }
      target.querySelectorAll('*').forEach((element) => translateElementAttrs(element, activeLocale));
      walkTextNodes(target, (node) => translateTextNode(node, activeLocale));
      observer?.takeRecords?.();
    } finally {
      applying = false;
    }
  }

  function handleMutations(mutations) {
    if (applying) {
      return;
    }
    applying = true;
    try {
      mutations.forEach((mutation) => {
        if (mutation.type === 'characterData') {
          originalTextByNode.set(mutation.target, mutation.target.nodeValue || '');
          translateTextNode(mutation.target, activeLocale);
          return;
        }
        if (mutation.type === 'attributes') {
          const element = mutation.target;
          const map = getOriginalAttrMap(element);
          map.set(mutation.attributeName, element.getAttribute(mutation.attributeName) || '');
          translateElementAttrs(element, activeLocale);
          return;
        }
        mutation.addedNodes.forEach((node) => {
          if (node.nodeType === 3) {
            translateTextNode(node, activeLocale);
          } else if (node.nodeType === 1) {
            translateElementAttrs(node, activeLocale);
            node.querySelectorAll?.('*').forEach((element) => translateElementAttrs(element, activeLocale));
            walkTextNodes(node, (textNode) => translateTextNode(textNode, activeLocale));
          }
        });
      });
      observer?.takeRecords?.();
    } finally {
      applying = false;
    }
  }

  function setLocale(locale = 'zh-CN', rootNode) {
    activeLocale = locale || 'zh-CN';
    if (rootNode) {
      apply(rootNode, { locale: activeLocale });
    }
  }

  function start(rootNode) {
    const target = rootNode?.body || rootNode?.documentElement || rootNode;
    if (!target || observer || typeof MutationObserver === 'undefined') {
      return;
    }
    observer = new MutationObserver(handleMutations);
    observer.observe(target, {
      attributes: true,
      attributeFilter: TRANSLATABLE_ATTRS,
      characterData: true,
      childList: true,
      subtree: true,
    });
  }

  function stop() {
    observer?.disconnect?.();
    observer = null;
  }

  return {
    apply,
    setLocale,
    start,
    stop,
    translateValue,
  };
});
