(function attachOpenAiReauthBatchRunner(root, factory) {
  root.MultiPageOpenAiReauthBatchRunner = factory();
})(typeof self !== 'undefined' ? self : globalThis, function createBatchRunnerModule() {
  const REAUTH_NODE_IDS = Object.freeze([
    'prepare-reauth',
    'submit-reauth-email',
    'fetch-reauth-code',
    'capture-reauth-callback',
  ]);

  const DEFAULT_INTER_ACCOUNT_DELAY_MS = 2000;
  const BATCH_LOG_STEP_KEY = 'reauth-batch';

  function getErrorMessage(error) {
    return error instanceof Error ? error.message : String(error ?? '未知错误');
  }

  function cleanString(value = '') {
    return String(value ?? '').trim();
  }

  function isPlainObject(value) {
    return Boolean(value) && typeof value === 'object' && !Array.isArray(value);
  }

  function extractAccountEmail(account = {}) {
    // 优先走 validator 的统一实现，保持双端 email 提取逻辑一致。
    const validator = (typeof self !== 'undefined' ? self : globalThis)
      .MultiPageOpenAiReauthAccountValidator;
    const base = (validator && typeof validator.extractAccountEmail === 'function')
      ? (validator.extractAccountEmail(account) || '')
      : (function fallbackExtractAccountEmail() {
          if (!account || typeof account !== 'object') return '';
          const credentials = isPlainObject(account.credentials) ? account.credentials : {};
          return cleanString(credentials.email || account.email || account.name);
        })();
    return base.toLowerCase();
  }

  function isLikelyStopError(error) {
    const message = String(error?.message || error || '');
    return /已被用户停止|user_stop|operation_aborted|stop signal|stopped by user/i.test(message);
  }

  function isLikelyAccountFatalError(error) {
    const message = String(error?.message || error || '');
    return /ACCOUNT_FATAL::/i.test(message);
  }

  function buildResolvedAccountForState(account, mailProvider) {
    if (!account || typeof account !== 'object') return account;
    if (cleanString(account.mailProvider)) return account;
    const provider = cleanString(mailProvider);
    return provider ? { ...account, mailProvider: provider } : account;
  }

  /**
   * 将原始文件 JSON + 成功账号列表合并成新的整文件 JSON。
   * - 单账号对象 / accounts 数组 / 顶层数组 三种 schema 都支持。
   * - 成功账号按 email 匹配，merge 字段（保留原 metadata 如 priority/concurrency）。
   * - 失败账号保留原 entry，不丢数据。
   * - 原始文本不可用时退化为输出 success 数组。
   */
  function mergeBatchResultsIntoFile(originalFileText, successAccounts = [], extractEmail = extractAccountEmail) {
    const safeAccounts = Array.isArray(successAccounts) ? successAccounts.filter(Boolean) : [];
    const trimmedText = cleanString(originalFileText);

    if (!trimmedText) {
      return JSON.stringify(safeAccounts, null, 2);
    }

    let parsed;
    try {
      parsed = JSON.parse(trimmedText);
    } catch {
      return JSON.stringify(safeAccounts, null, 2);
    }

    const successByEmail = new Map();
    for (const account of safeAccounts) {
      const email = extractEmail(account);
      if (email) {
        successByEmail.set(email, account);
      }
    }

    function mergeEntry(entry) {
      if (!entry || typeof entry !== 'object') return entry;
      const email = extractEmail(entry);
      if (!email || !successByEmail.has(email)) {
        return entry;
      }
      const next = { ...entry };
      const updated = successByEmail.get(email);
      if (updated && typeof updated === 'object') {
        for (const [key, value] of Object.entries(updated)) {
          next[key] = value;
        }
      }
      return next;
    }

    let updated;
    if (Array.isArray(parsed)) {
      updated = parsed.map(mergeEntry);
    } else if (parsed && typeof parsed === 'object' && Array.isArray(parsed.accounts)) {
      updated = { ...parsed, accounts: parsed.accounts.map(mergeEntry) };
    } else if (parsed && typeof parsed === 'object') {
      updated = mergeEntry(parsed);
    } else {
      updated = parsed;
    }

    return JSON.stringify(updated, null, 2);
  }

  /**
   * 将原始文件 JSON 裁剪为“仅成功账号”的同结构 JSON。
   * - 顶层数组：只保留成功账号 entry。
   * - { accounts: [] }：保留顶层 metadata，只裁剪 accounts。
   * - 单账号对象：成功时输出合并后的对象；未匹配时输出成功账号兜底。
   * - 原始文本不可用/不可解析时退化为 success 数组。
   */
  function buildSuccessOnlyBatchFileJson(originalFileText, successAccounts = [], extractEmail = extractAccountEmail) {
    const safeAccounts = Array.isArray(successAccounts) ? successAccounts.filter(Boolean) : [];
    const trimmedText = cleanString(originalFileText);

    if (!trimmedText) {
      return JSON.stringify(safeAccounts, null, 2);
    }

    let parsed;
    try {
      parsed = JSON.parse(trimmedText);
    } catch {
      return JSON.stringify(safeAccounts, null, 2);
    }

    const successByEmail = new Map();
    for (const account of safeAccounts) {
      const email = extractEmail(account);
      if (email) {
        successByEmail.set(email, account);
      }
    }

    function mergeSuccessfulEntry(entry) {
      if (!entry || typeof entry !== 'object') return null;
      const email = extractEmail(entry);
      if (!email || !successByEmail.has(email)) {
        return null;
      }
      const next = { ...entry };
      const updated = successByEmail.get(email);
      if (updated && typeof updated === 'object') {
        for (const [key, value] of Object.entries(updated)) {
          next[key] = value;
        }
      }
      return next;
    }

    let updated;
    if (Array.isArray(parsed)) {
      updated = parsed.map(mergeSuccessfulEntry).filter(Boolean);
    } else if (parsed && typeof parsed === 'object' && Array.isArray(parsed.accounts)) {
      updated = {
        ...parsed,
        accounts: parsed.accounts.map(mergeSuccessfulEntry).filter(Boolean),
      };
    } else if (parsed && typeof parsed === 'object') {
      updated = mergeSuccessfulEntry(parsed) || safeAccounts[0] || null;
    } else {
      updated = safeAccounts;
    }

    return JSON.stringify(updated, null, 2);
  }

  function createReauthBatchRunner(deps = {}) {
    const {
      addLog = async () => {},
      executeNode,
      getNodeIdsForState = null,
      getState,
      setState,
      throwIfStopped = () => {},
      sleepWithStop = null,
      interAccountDelayMs = DEFAULT_INTER_ACCOUNT_DELAY_MS,
      extractAccountEmail: injectedExtractAccountEmail = null,
    } = deps;

    if (typeof executeNode !== 'function') {
      throw new Error('reauth-batch-runner 缺少 executeNode。');
    }
    if (typeof getState !== 'function') {
      throw new Error('reauth-batch-runner 缺少 getState。');
    }
    if (typeof setState !== 'function') {
      throw new Error('reauth-batch-runner 缺少 setState。');
    }

    async function log(message, level = 'info', options = {}) {
      const normalized = options && typeof options === 'object' ? { ...options } : {};
      if (!normalized.stepKey) normalized.stepKey = BATCH_LOG_STEP_KEY;
      return addLog(message, level, normalized);
    }

    async function safeSleep(ms) {
      const duration = Math.max(0, Math.floor(Number(ms) || 0));
      if (duration <= 0) return;
      throwIfStopped();
      if (typeof sleepWithStop === 'function') {
        await sleepWithStop(duration);
        return;
      }
      await new Promise((resolve) => setTimeout(resolve, duration));
      throwIfStopped();
    }

    function getAccountEmail(account) {
      if (typeof injectedExtractAccountEmail === 'function') {
        try {
          const injectedEmail = cleanString(injectedExtractAccountEmail(account));
          if (injectedEmail) return injectedEmail.toLowerCase();
        } catch {
          // 注入的提取器异常时回退到模块内置逻辑，避免批量流程因日志/测试替身中断。
        }
      }
      return extractAccountEmail(account);
    }

    async function resolveOrderedNodeIds() {
      if (typeof getNodeIdsForState !== 'function') {
        return [...REAUTH_NODE_IDS];
      }
      try {
        const state = await getState();
        const ids = (getNodeIdsForState(state) || []).filter(Boolean);
        return ids.length > 0 ? ids : [...REAUTH_NODE_IDS];
      } catch {
        return [...REAUTH_NODE_IDS];
      }
    }

    async function runSingleAccount(account, options = {}) {
      const email = getAccountEmail(account);
      const accountForState = buildResolvedAccountForState(account, options.mailProvider);

      await setState({
        reauthInputAccount: accountForState,
        reauthResultAccount: null,
        reauthLastError: '',
        reauthEmail: email,
        nodeStatuses: {},
      });

      const orderedNodeIds = await resolveOrderedNodeIds();

      for (const nodeId of orderedNodeIds) {
        throwIfStopped();
        await executeNode(nodeId);
      }

      const finalState = await getState();
      return finalState?.reauthResultAccount || null;
    }

    async function executeReauthBatch(options = {}) {
      const accounts = Array.isArray(options.accounts) ? options.accounts.filter(Boolean) : [];
      if (accounts.length === 0) {
        throw new Error('reauth 批量队列为空，请先选择待处理的账号。');
      }

      const mailProvider = cleanString(options.mailProvider);
      const originalFileText = String(options.originalFileText || '');
      const skipOnFailure = options.skipOnFailure !== false;
      const total = accounts.length;
      const success = [];
      const failed = [];
      const startedAt = Date.now();

      await setState({
        reauthBatchRunning: true,
        reauthBatchProgress: {
          current: 0,
          total,
          currentEmail: '',
          currentStatus: 'pending',
        },
        reauthBatchResult: null,
      });

      await log(`开始 reauth 批量处理（共 ${total} 个账号）...`, 'info');

      try {
        for (let index = 0; index < total; index += 1) {
          throwIfStopped();
          const account = accounts[index];
          const email = getAccountEmail(account) || `账号 #${index + 1}`;
          const current = index + 1;

          await setState({
            reauthBatchProgress: {
              current,
              total,
              currentEmail: email,
              currentStatus: 'running',
            },
          });
          await log(`[${current}/${total}] 开始处理 ${email}`, 'info');

          try {
            const updatedAccount = await runSingleAccount(account, { mailProvider });
            if (!updatedAccount || typeof updatedAccount !== 'object') {
              throw new Error('reauth 完成但 reauthResultAccount 为空。');
            }
            success.push(updatedAccount);
            await log(`[${current}/${total}] ${email} 重新授权成功 ✓`, 'ok');
            await setState({
              reauthBatchProgress: {
                current,
                total,
                currentEmail: email,
                currentStatus: 'success',
              },
            });
          } catch (error) {
            if (isLikelyStopError(error)) {
              throw error;
            }
            const message = getErrorMessage(error);
            const fatal = isLikelyAccountFatalError(error);
            failed.push({ account, email, error: message, fatal });
            const fatalLabel = fatal ? '（账号异常，已跳过）' : '';
            await log(`[${current}/${total}] ${email} ${fatal ? '账号不可用' : '失败'}：${message}${fatalLabel}`, fatal ? 'warn' : 'error');
            await setState({
              reauthBatchProgress: {
                current,
                total,
                currentEmail: email,
                currentStatus: 'failed',
              },
            });
            if (!skipOnFailure) {
              throw error;
            }
          }

          if (current < total) {
            await safeSleep(interAccountDelayMs);
          }
        }
      } catch (error) {
        const stopped = isLikelyStopError(error);
        try {
          await setState({
            reauthBatchRunning: false,
            reauthBatchProgress: {
              current: success.length + failed.length,
              total,
              currentEmail: '',
              currentStatus: stopped ? 'stopped' : 'aborted',
            },
            reauthBatchResult: {
              success: success.map((account) => ({ account, email: getAccountEmail(account) })),
              failed,
              updatedFileJson: mergeBatchResultsIntoFile(originalFileText, success, getAccountEmail),
              successOnlyFileJson: buildSuccessOnlyBatchFileJson(originalFileText, success, getAccountEmail),
              successCount: success.length,
              failedCount: failed.length,
              total,
              startedAt,
              finalizedAt: Date.now(),
              aborted: true,
              stopReason: stopped ? 'user_stop' : getErrorMessage(error),
            },
          });
        } catch (stateError) {
          try {
            await log(`批量终止状态写入失败：${getErrorMessage(stateError)}`, 'warn');
          } catch {
            // 保留原始错误，状态写入/日志失败不应覆盖真正的批量终止原因。
          }
        }
        throw error;
      }

      const updatedFileJson = mergeBatchResultsIntoFile(originalFileText, success, getAccountEmail);
      const successOnlyFileJson = buildSuccessOnlyBatchFileJson(originalFileText, success, getAccountEmail);
      const finalResult = {
        success: success.map((account) => ({ account, email: getAccountEmail(account) })),
        failed,
        updatedFileJson,
        successOnlyFileJson,
        successCount: success.length,
        failedCount: failed.length,
        total,
        startedAt,
        finalizedAt: Date.now(),
        aborted: false,
      };

      await setState({
        reauthBatchRunning: false,
        reauthBatchProgress: {
          current: total,
          total,
          currentEmail: '',
          currentStatus: 'completed',
        },
        reauthBatchResult: finalResult,
      });

      await log(
        `reauth 批量处理完成：${success.length}/${total} 成功，${failed.length} 失败。`,
        failed.length > 0 ? 'warn' : 'ok'
      );

      return finalResult;
    }

    return {
      executeReauthBatch,
      runSingleAccount,
    };
  }

  return {
    REAUTH_NODE_IDS,
    DEFAULT_INTER_ACCOUNT_DELAY_MS,
    BATCH_LOG_STEP_KEY,
    extractAccountEmail,
    mergeBatchResultsIntoFile,
    buildSuccessOnlyBatchFileJson,
    isLikelyStopError,
    isLikelyAccountFatalError,
    createReauthBatchRunner,
  };
});
