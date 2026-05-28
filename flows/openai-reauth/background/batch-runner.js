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

  function extractAccountEmail(account = {}) {
    if (!account || typeof account !== 'object') return '';
    const credentials = account.credentials && typeof account.credentials === 'object'
      ? account.credentials
      : {};
    return cleanString(credentials.email || account.email || account.name).toLowerCase();
  }

  function isLikelyStopError(error) {
    const message = String(error?.message || error || '');
    return /已被用户停止|user_stop|operation_aborted|stop signal|stopped by user/i.test(message);
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
  function mergeBatchResultsIntoFile(originalFileText, successAccounts = []) {
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
      const email = extractAccountEmail(account);
      if (email) {
        successByEmail.set(email, account);
      }
    }

    function mergeEntry(entry) {
      if (!entry || typeof entry !== 'object') return entry;
      const email = extractAccountEmail(entry);
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
      const email = extractAccountEmail(account);
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
          const email = extractAccountEmail(account) || `账号 #${index + 1}`;
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
            failed.push({ account, email, error: message });
            await log(`[${current}/${total}] ${email} 失败：${message}`, 'error');
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
        await setState({
          reauthBatchRunning: false,
          reauthBatchProgress: {
            current: success.length + failed.length,
            total,
            currentEmail: '',
            currentStatus: stopped ? 'stopped' : 'aborted',
          },
          reauthBatchResult: {
            success: success.map((account) => ({ account, email: extractAccountEmail(account) })),
            failed,
            updatedFileJson: mergeBatchResultsIntoFile(originalFileText, success),
            successCount: success.length,
            failedCount: failed.length,
            total,
            startedAt,
            finalizedAt: Date.now(),
            aborted: true,
            stopReason: stopped ? 'user_stop' : getErrorMessage(error),
          },
        });
        throw error;
      }

      const updatedFileJson = mergeBatchResultsIntoFile(originalFileText, success);
      const finalResult = {
        success: success.map((account) => ({ account, email: extractAccountEmail(account) })),
        failed,
        updatedFileJson,
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
    isLikelyStopError,
    createReauthBatchRunner,
  };
});
