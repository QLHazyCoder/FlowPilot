(function attachOpenAiReauthCaptureCallbackStep(root, factory) {
  root.MultiPageOpenAiReauthCaptureCallbackStep = factory();
})(typeof self !== 'undefined' ? self : globalThis, function createCaptureCallbackStepModule() {
  const NODE_ID = 'capture-reauth-callback';
  const VISIBLE_STEP = 4;
  const STEP_KEY = NODE_ID;
  const CALLBACK_TIMEOUT_MS = 5 * 60 * 1000;
  const CALLBACK_CHECK_INTERVAL_MS = 1000;
  const ACCOUNT_FATAL_PREFIX = 'ACCOUNT_FATAL::';
  const PHONE_VERIFICATION_TEXT_PATTERNS = Object.freeze([
    'phone-verification',
    'phone verification',
    'verify your phone',
    'phone number verification',
    'add phone',
    'add a phone number',
    '验证您的手机号码',
    '验证手机号码',
    '手机验证码页',
    '手机验证',
    '添加手机号页',
    '添加手机号',
    '手机号',
    '一次性验证码',
    'whatsapp',
  ]);

  const ACCOUNT_BANNED_TEXT_PATTERNS = Object.freeze([
    'account_deactivated',
    'account suspended',
    'account deactivated',
    'account banned',
    'account has been',
    'account locked',
    'account disabled',
    'not authorized',
    'account compromised',
    'violation of our',
    'account flagged',
    // 中文封禁/停用页面对应的关键词（覆盖 OpenAI 各种中文 UI）
    '身份验证错误',
    '你没有账户',
    '已被删除',
    '已停用',
    '停用',
    '已封禁',
    '封禁',
    '已被禁用',
    '账号已被',
    '账号异常',
    'your account',
  ]);

  function getErrorMessage(error) {
    return error instanceof Error ? error.message : String(error ?? '未知错误');
  }

  function isPhoneVerificationRequiredError(error) {
    const message = getErrorMessage(error).toLowerCase();
    return PHONE_VERIFICATION_TEXT_PATTERNS.some((pattern) => message.includes(pattern.toLowerCase()));
  }

  function createCaptureReauthCallbackExecutor(deps = {}) {
    const {
      addLog = async () => {},
      chrome: chromeApi = (typeof globalThis !== 'undefined' ? globalThis.chrome : null),
      completeNodeFromBackground,
      exchangeAuthorizationCode,
      parseCallbackUrl,
      buildUpdatedAccount,
      fetchImpl = (typeof fetch === 'function' ? fetch.bind(globalThis) : null),
      setState,
      // step9 辅助函数（复用注册流程的 OAuth 同意页点击编排）
      getTabId = null,
      isTabAlive = null,
      ensureStep8SignupPageReady = null,
      waitForStep8Ready = null,
      prepareStep8DebuggerClick = null,
      clickWithDebugger = null,
      triggerStep8ContentStrategy = null,
      waitForStep8ClickEffect = null,
      getStep8EffectLabel = null,
      reloadStep8ConsentPage = null,
      sleepWithStop = null,
      throwIfStopped = () => {},
      STEP8_STRATEGIES = null,
      STEP8_MAX_ROUNDS = 3,
      STEP8_CLICK_RETRY_DELAY_MS = 1500,
      STEP8_READY_WAIT_TIMEOUT_MS = 30000,
    } = deps;

    if (typeof completeNodeFromBackground !== 'function') {
      throw new Error('capture-reauth-callback executor 缺少 completeNodeFromBackground。');
    }
    if (typeof exchangeAuthorizationCode !== 'function') {
      throw new Error('capture-reauth-callback executor 缺少 exchangeAuthorizationCode。');
    }
    if (typeof parseCallbackUrl !== 'function') {
      throw new Error('capture-reauth-callback executor 缺少 parseCallbackUrl。');
    }
    if (typeof buildUpdatedAccount !== 'function') {
      throw new Error('capture-reauth-callback executor 缺少 buildUpdatedAccount。');
    }
    if (typeof setState !== 'function') {
      throw new Error('capture-reauth-callback executor 缺少 setState。');
    }
    if (!chromeApi?.webNavigation || !chromeApi?.tabs) {
      throw new Error('capture-reauth-callback executor 需要 chrome.webNavigation / chrome.tabs。');
    }

    const consentClickEnabled = (
      typeof getTabId === 'function'
      && typeof isTabAlive === 'function'
      && typeof ensureStep8SignupPageReady === 'function'
      && typeof waitForStep8Ready === 'function'
      && typeof prepareStep8DebuggerClick === 'function'
      && typeof clickWithDebugger === 'function'
      && typeof triggerStep8ContentStrategy === 'function'
      && typeof waitForStep8ClickEffect === 'function'
      && typeof getStep8EffectLabel === 'function'
      && typeof reloadStep8ConsentPage === 'function'
      && typeof sleepWithStop === 'function'
      && Array.isArray(STEP8_STRATEGIES) && STEP8_STRATEGIES.length > 0
    );
    // 建设性日志：标记 consent 主动点击能力是否就绪，方便排查步骤 4 行为差异。
    if (!consentClickEnabled) {
      logStep('OAuth 同意页主动点击能力未注入（部分 step9 辅助函数缺失），步骤 4 将仅依赖 localhost 回调监听。', 'warn')
        .catch(() => {});
    }

    function logStep(message, level = 'info') {
      return addLog(message, level, { step: VISIBLE_STEP, stepKey: STEP_KEY });
    }

    /**
     * 检测认证页是否显示账号封禁/停用文案。
     * 主路径走 content script 的 DETECT_ACCOUNT_BANNED 消息（已注入到页面，最可靠）；
     * 降级路径走 chrome.scripting.executeScript 直接注入检测。
     */
    async function checkTabForBannedAccount(tabId) {
      if (!Number.isInteger(tabId)) return false;

      const lowerPatterns = ACCOUNT_BANNED_TEXT_PATTERNS.map((p) => p.toLowerCase());

      // 主路径：通过已注入的 content script 检测（不受 host_permissions 限制）
      if (chromeApi?.tabs?.sendMessage) {
        try {
          const response = await chromeApi.tabs.sendMessage(tabId, {
            type: 'DETECT_ACCOUNT_BANNED',
            payload: { patterns: lowerPatterns },
          });
          if (response?.accountBanned) return true;
        } catch {
          // content script 可能未就绪，降级到 executeScript
        }
      }

      // 降级路径：chrome.scripting 直接注入
      if (chromeApi?.scripting?.executeScript) {
        try {
          const results = await chromeApi.scripting.executeScript({
            target: { tabId },
            func: (patterns) => {
              const text = (document.body?.innerText || document.title || '').toLowerCase();
              return patterns.some((p) => text.includes(p));
            },
            args: [lowerPatterns],
          });
          return results?.[0]?.result === true;
        } catch {
          return false;
        }
      }

      return false;
    }

    function isPhoneVerificationState(pageState) {
      if (!pageState || typeof pageState !== 'object') return false;
      return Boolean(pageState.phoneVerificationPage)
        || Boolean(pageState.addPhonePage)
        || pageState.state === 'phone_verification_page'
        || pageState.state === 'add_phone_page'
        || isPhoneVerificationRequiredError(pageState.url || pageState.path || '');
    }

    function isPhoneVerificationSnapshot(snapshot) {
      if (!snapshot || typeof snapshot !== 'object') return false;
      const combined = [
        snapshot.url,
        snapshot.title,
        snapshot.text,
      ]
        .filter(Boolean)
        .join('\n');
      return isPhoneVerificationRequiredError(combined);
    }

    /**
     * 步骤 3 邮箱验证码通过后，OpenAI 可能不会进入 OAuth 同意页，而是立即要求手机验证。
     * 这里在步骤 4 刚开始就做一次轻量预检，避免等待 OAuth ready/点击超时才跳过账号。
     */
    async function checkTabForPhoneVerificationRequired(tabId) {
      if (!Number.isInteger(tabId)) return false;

      if (chromeApi?.tabs?.get) {
        try {
          const tab = await chromeApi.tabs.get(tabId);
          if (isPhoneVerificationSnapshot(tab)) return true;
        } catch {
          // 标签页可能正在跳转，继续尝试 content / executeScript 路径。
        }
      }

      if (chromeApi?.tabs?.sendMessage) {
        try {
          const response = await chromeApi.tabs.sendMessage(tabId, {
            type: 'GET_LOGIN_AUTH_STATE',
            source: 'background',
            payload: {},
          });
          if (isPhoneVerificationState(response)) return true;
        } catch {
          // content script 可能未就绪，降级到 executeScript。
        }
      }

      if (chromeApi?.scripting?.executeScript) {
        try {
          const results = await chromeApi.scripting.executeScript({
            target: { tabId },
            func: () => ({
              url: String(location.href || ''),
              title: String(document.title || ''),
              text: String(document.body?.innerText || document.documentElement?.innerText || '').trim(),
            }),
          });
          return isPhoneVerificationSnapshot(results?.[0]?.result);
        } catch {
          return false;
        }
      }

      return false;
    }

    function buildAccountBannedError() {
      return new Error(`${ACCOUNT_FATAL_PREFIX}account_banned::该账号已被 OpenAI 封禁/停用，无法继续重新授权。`);
    }

    function buildPhoneVerificationRequiredError(error) {
      const reason = getErrorMessage(error);
      return new Error(
        `${ACCOUNT_FATAL_PREFIX}phone_verification_required::该账号重新授权触发手机验证，当前 reauth 流程不处理手机验证，已跳过该账号。`
        + (reason ? ` 原因：${reason}` : '')
      );
    }

    function executeCaptureReauthCallback(state = {}) {
      const nodeId = String(state?.nodeId || NODE_ID).trim();
      const expectedState = String(state?.reauthState || '').trim();
      const codeVerifier = String(state?.reauthCodeVerifier || '').trim();
      const originalAccount = state?.reauthInputAccount;

      return new Promise((resolve, reject) => {
        if (!expectedState) {
          reject(new Error('缺少 OAuth state，请先执行步骤 1。'));
          return;
        }
        if (!codeVerifier) {
          reject(new Error('缺少 PKCE code_verifier，请先执行步骤 1。'));
          return;
        }
        if (!originalAccount || typeof originalAccount !== 'object') {
          reject(new Error('缺少待重新授权的账号 JSON。'));
          return;
        }

        let resolved = false;
        const startedAt = Date.now();
        let timeoutTimer = null;
        let onBeforeNavigate = null;
        let onCommitted = null;
        let onTabUpdated = null;

        function cleanup() {
          if (timeoutTimer) {
            clearTimeout(timeoutTimer);
            timeoutTimer = null;
          }
          if (onBeforeNavigate) {
            chromeApi.webNavigation.onBeforeNavigate.removeListener?.(onBeforeNavigate);
            onBeforeNavigate = null;
          }
          if (onCommitted) {
            chromeApi.webNavigation.onCommitted.removeListener?.(onCommitted);
            onCommitted = null;
          }
          if (onTabUpdated) {
            chromeApi.tabs.onUpdated.removeListener?.(onTabUpdated);
            onTabUpdated = null;
          }
        }

        function rejectStep(error) {
          if (resolved) return;
          resolved = true;
          cleanup();
          reject(error);
        }

        async function finalize(parsed) {
          if (resolved || !parsed) return;
          if (parsed.error) {
            rejectStep(new Error(`OAuth 回调错误：${parsed.error}`));
            return;
          }
          const code = String(parsed.code || '').trim();
          if (!code) return;

          resolved = true;
          cleanup();

          try {
            await logStep(`已捕获 localhost 回调，正在向 OAuth 服务端换取新 Token...`);
            const tokens = await exchangeAuthorizationCode({
              code,
              codeVerifier,
              fetchImpl,
            });
            const updatedAccount = buildUpdatedAccount(originalAccount, tokens);
            await setState({
              reauthResultAccount: updatedAccount,
              reauthCodeVerifier: '',
              reauthState: '',
              reauthLastError: '',
            });
            await logStep('Token 换取成功，新 access_token / refresh_token / id_token 已写入会话状态。', 'ok');
            await completeNodeFromBackground(nodeId, { reauthResultAccount: updatedAccount });
            resolve();
          } catch (error) {
            const message = getErrorMessage(error);
            await setState({ reauthLastError: message }).catch(() => {});
            await logStep(`步骤 4 失败：${message}`, 'error');
            reject(error);
          }
        }

        function handleNavigation(details = {}) {
          const url = String(details?.url || '').trim();
          if (!url) return;
          const parsed = parseCallbackUrl(url, expectedState);
          if (parsed) {
            finalize(parsed);
            const tabId = Number(details?.tabId);
            if (Number.isInteger(tabId) && chromeApi.tabs?.remove) {
              chromeApi.tabs.remove(tabId).catch(() => {});
            }
          }
        }

        function handleTabUpdated(_tabId, _changeInfo, tab) {
          const url = String(tab?.url || _changeInfo?.url || '').trim();
          if (!url) return;
          const parsed = parseCallbackUrl(url, expectedState);
          if (parsed) {
            finalize(parsed);
            const tabIdToClose = Number(_tabId);
            if (Number.isInteger(tabIdToClose) && chromeApi.tabs?.remove) {
              chromeApi.tabs.remove(tabIdToClose).catch(() => {});
            }
          }
        }

        // 同一 localhost 回调可能被 onBeforeNavigate / onCommitted 同时观察到；
        // finalize 内部用 resolved guard 保证幂等，保留双监听以提高捕获率。
        onBeforeNavigate = handleNavigation;
        onCommitted = handleNavigation;
        onTabUpdated = handleTabUpdated;
        chromeApi.webNavigation.onBeforeNavigate.addListener(onBeforeNavigate);
        chromeApi.webNavigation.onCommitted.addListener(onCommitted);
        chromeApi.tabs.onUpdated.addListener(onTabUpdated);

        function isResolved() {
          return resolved;
        }

        async function drivePrimaryContinueClick() {
          if (!consentClickEnabled) {
            await logStep('OAuth 同意页主动点击能力未注入，仅依赖 localhost 监听等待回调。', 'warn');
            return;
          }
          let tabId = null;
          try {
            tabId = await getTabId('openai-auth');
            if (!Number.isInteger(tabId) || !(await isTabAlive('openai-auth'))) {
              await logStep('OAuth 认证页 tab 不存在或已关闭，跳过主动点击「继续」按钮。', 'warn');
              return;
            }

            try {
              await chromeApi.tabs.update(tabId, { active: true });
            } catch (_focusError) {}

            // 步骤 3 验证码通过后先立即预检账号级阻断：封禁/停用或手机验证都直接跳过当前账号。
            if (await checkTabForBannedAccount(tabId)) {
              throw buildAccountBannedError();
            }
            if (await checkTabForPhoneVerificationRequired(tabId)) {
              throw buildPhoneVerificationRequiredError('认证页要求手机验证。');
            }

            await ensureStep8SignupPageReady(tabId, {
              timeoutMs: 15000,
              visibleStep: VISIBLE_STEP,
              logStepKey: STEP_KEY,
              logMessage: '认证页内容脚本尚未就绪，正在等待页面恢复...',
            });

            if (await checkTabForBannedAccount(tabId)) {
              throw buildAccountBannedError();
            }
            if (await checkTabForPhoneVerificationRequired(tabId)) {
              throw buildPhoneVerificationRequiredError('认证页要求手机验证。');
            }

            for (let round = 1; round <= STEP8_MAX_ROUNDS && !isResolved(); round++) {
              throwIfStopped();

              // 每轮先快速检测账号级阻断页面，避免 waitForStep8Ready 的 30s 超时白等。
              if (await checkTabForBannedAccount(tabId)) {
                throw buildAccountBannedError();
              }
              if (await checkTabForPhoneVerificationRequired(tabId)) {
                throw buildPhoneVerificationRequiredError('认证页要求手机验证。');
              }

              const pageState = await waitForStep8Ready(
                tabId,
                STEP8_READY_WAIT_TIMEOUT_MS,
                { visibleStep: VISIBLE_STEP }
              );
              if (isResolved()) return;
              if (pageState?.phoneVerificationPage || pageState?.addPhonePage) {
                throw buildPhoneVerificationRequiredError(pageState?.url || '认证页要求手机验证。');
              }
              if (!pageState?.consentReady) {
                await sleepWithStop(STEP8_CLICK_RETRY_DELAY_MS);
                continue;
              }

              const strategy = STEP8_STRATEGIES[Math.min(round - 1, STEP8_STRATEGIES.length - 1)];
              await logStep(`第 ${round}/${STEP8_MAX_ROUNDS} 轮尝试点击 OAuth 同意页「继续」（${strategy.label}）...`);

              if (strategy.mode === 'debugger') {
                const clickTarget = await prepareStep8DebuggerClick(tabId, {
                  timeoutMs: 15000,
                  responseTimeoutMs: 15000,
                  visibleStep: VISIBLE_STEP,
                });
                if (isResolved()) return;
                await clickWithDebugger(tabId, clickTarget?.rect, { visibleStep: VISIBLE_STEP });
              } else {
                await triggerStep8ContentStrategy(tabId, strategy.strategy, {
                  timeoutMs: 15000,
                  responseTimeoutMs: 15000,
                  visibleStep: VISIBLE_STEP,
                });
              }
              if (isResolved()) return;

              const effect = await waitForStep8ClickEffect(
                tabId,
                pageState.url,
                15000,
                { visibleStep: VISIBLE_STEP }
              );
              if (isResolved()) return;

              if (effect.progressed) {
                await logStep(`已点击「继续」，${getStep8EffectLabel(effect)}，继续等待 localhost 回调...`, 'ok');
                return;
              }

              if (round >= STEP8_MAX_ROUNDS) {
                throw new Error(`连续 ${STEP8_MAX_ROUNDS} 轮点击「继续」后页面仍无反应。`);
              }

              await logStep(`${strategy.label} 本轮点击后页面无反应，正在刷新认证页后重试（下一轮 ${round + 1}/${STEP8_MAX_ROUNDS}）...`, 'warn');
              await reloadStep8ConsentPage(tabId, 30000, { visibleStep: VISIBLE_STEP });
              await sleepWithStop(STEP8_CLICK_RETRY_DELAY_MS);
            }
          } catch (clickError) {
            if (isResolved()) return;

            // 同意页点击失败后做一次封号页面检测：若确认是封禁/停用，立即抛出 fatal 错误终止等待。
            const banned = await checkTabForBannedAccount(tabId);
            if (banned) {
              rejectStep(buildAccountBannedError());
              return;
            }

            if (isPhoneVerificationRequiredError(clickError)) {
              rejectStep(buildPhoneVerificationRequiredError(clickError));
              return;
            }

            const message = getErrorMessage(clickError);
            await logStep(`主动点击 OAuth 同意页失败：${message}（继续等待 localhost 回调，可能由用户手动完成同意）`, 'warn');
          }
        }

        // 封号等 fatal 错误需穿透静默 catch 传播给 rejectStep，避免被吞掉后继续干等 callback timeout。
        drivePrimaryContinueClick().catch((err) => {
          if (resolved) return;
          if (/ACCOUNT_FATAL::/i.test(String(err?.message || ''))) {
            rejectStep(err);
          }
        });

        function checkTimeout() {
          if (resolved) return;
          if (Date.now() - startedAt >= CALLBACK_TIMEOUT_MS) {
            rejectStep(new Error(`${Math.round(CALLBACK_TIMEOUT_MS / 1000)} 秒内未捕获到 localhost 回调，OAuth 同意点击可能被拦截。`));
            return;
          }
          timeoutTimer = setTimeout(checkTimeout, CALLBACK_CHECK_INTERVAL_MS);
        }
        timeoutTimer = setTimeout(checkTimeout, CALLBACK_CHECK_INTERVAL_MS);

        logStep('正在监听 localhost:1455 回调...').catch(() => {});
      });
    }

    return { executeCaptureReauthCallback };
  }

  return {
    NODE_ID,
    VISIBLE_STEP,
    createCaptureReauthCallbackExecutor,
  };
});
