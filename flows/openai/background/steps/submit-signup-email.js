(function attachBackgroundStep2(root, factory) {
  root.MultiPageBackgroundStep2 = factory();
})(typeof self !== 'undefined' ? self : globalThis, function createBackgroundStep2Module() {
  function createStep2Executor(deps = {}) {
    const {
      addLog,
      chrome,
      completeNodeFromBackground,
      ensureContentScriptReadyOnTab,
      ensureSignupAuthEntryPageReady,
      ensureSignupEntryPageReady,
      ensureSignupPostEmailPageReadyInTab,
      ensureSignupPostIdentityPageReadyInTab = ensureSignupPostEmailPageReadyInTab,
      getTabId,
      isTabAlive,
      phoneVerificationHelpers = null,
      resolveSignupMethod = () => 'email',
      resolveSignupEmailForFlow,
      sendToContentScriptResilient,
      OPENAI_AUTH_INJECT_FILES,
      waitForTabStableComplete = null,
    } = deps;

    function getErrorMessage(error) {
      return String(typeof error === 'string' ? error : error?.message || '');
    }

    function isSignupEntryUnavailableErrorMessage(errorLike) {
      const message = getErrorMessage(errorLike);
      return /未找到可用的邮箱输入入口|当前页面没有可用的注册入口，也不在邮箱\/密码页/i.test(message);
    }

    function isSignupPhoneEntryUnavailableErrorMessage(errorLike) {
      const message = getErrorMessage(errorLike);
      return /未找到可用的手机号输入入口|当前页面没有可用的手机号注册入口，也不在密码页/i.test(message);
    }

    function isRetryableStep2TransportErrorMessage(errorLike) {
      const message = getErrorMessage(errorLike);
      return /Content script on [\w-]+ did not respond in \d+s|内容脚本\s+\d+(?:\.\d+)?\s*秒内未响应|Receiving end does not exist|message channel closed|A listener indicated an asynchronous response|port closed before a response was received|did not respond in \d+s/i.test(message);
    }

    function isLikelyLoggedInChatgptHomeUrl(rawUrl) {
      const url = String(rawUrl || '').trim();
      if (!url) {
        return false;
      }

      try {
        const parsed = new URL(url);
        const host = String(parsed.hostname || '').toLowerCase();
        if (!['chatgpt.com', 'www.chatgpt.com'].includes(host)) {
          return false;
        }

        const path = String(parsed.pathname || '');
        if (/^\/(?:auth\/|create-account\/|email-verification|log-in|add-phone)(?:[/?#]|$)/i.test(path)) {
          return false;
        }

        return true;
      } catch {
        return false;
      }
    }

    function isReadySignupEntryState(state = '') {
      const normalized = String(state || '').trim().toLowerCase();
      return normalized === 'entry_home'
        || normalized === 'email_entry'
        || normalized === 'phone_entry'
        || normalized === 'password_page';
    }

    async function getSignupEntryReadyState(tabId) {
      if (!Number.isInteger(tabId) || typeof sendToContentScriptResilient !== 'function') {
        return '';
      }

      try {
        const result = await sendToContentScriptResilient('openai-auth', {
          type: 'ENSURE_SIGNUP_ENTRY_READY',
          step: 2,
          source: 'background',
          payload: {},
        }, {
          timeoutMs: 12000,
          retryDelayMs: 500,
          logMessage: '步骤 2：正在检查官网注册入口状态...',
        });
        if (result?.error) {
          return '';
        }
        return String(result?.state || '').trim().toLowerCase();
      } catch {
        return '';
      }
    }

    async function isLikelyLoggedInChatgptHomeTab(tabId) {
      if (typeof chrome?.tabs?.get !== 'function') {
        return false;
      }

      const readyState = await getSignupEntryReadyState(tabId);
      if (isReadySignupEntryState(readyState)) {
        return false;
      }

      const currentUrl = await getTabUrl(tabId);
      return isLikelyLoggedInChatgptHomeUrl(currentUrl);
    }

    async function shouldForceAuthEntryRetry(tabId) {
      if (!Number.isInteger(tabId)) {
        return false;
      }
      return isLikelyLoggedInChatgptHomeTab(tabId);
    }

    async function getTabUrl(tabId) {
      if (!Number.isInteger(tabId) || typeof chrome?.tabs?.get !== 'function') {
        return '';
      }

      try {
        const tab = await chrome.tabs.get(tabId);
        return String(tab?.url || '');
      } catch {
        return '';
      }
    }

    async function failStep2OnLoggedInSession(tabId, reasonMessage = '') {
      if (!(await isLikelyLoggedInChatgptHomeTab(tabId))) {
        return false;
      }

      const reasonText = getErrorMessage(reasonMessage);
      const reasonSuffix = reasonText ? `（触发原因：${reasonText}）` : '';
      const message = `步骤 2：检测到当前停留在已登录 ChatGPT 首页，已阻止自动跳过步骤 3/4/5。请先执行步骤 1 清理会话后重试。${reasonSuffix}`;
      await addLog(message, 'error');
      throw new Error(message);
    }

    async function sendSignupIdentity(payload = {}, options = {}) {
      const {
        timeoutMs = 35000,
        retryDelayMs = 700,
        logMessage = '步骤 2：官网注册入口正在切换，等待页面恢复后继续输入邮箱...',
      } = options;

      try {
        return await sendToContentScriptResilient('openai-auth', {
          type: 'EXECUTE_NODE',
          nodeId: 'submit-signup-email',
          step: 2,
          source: 'background',
          payload,
        }, {
          timeoutMs,
          retryDelayMs,
          logMessage,
        });
      } catch (error) {
        return { error: getErrorMessage(error) };
      }
    }

    async function waitForStep2SignupTabToSettle(tabId, logMessage) {
      if (!Number.isInteger(tabId) || typeof waitForTabStableComplete !== 'function') {
        return null;
      }

      await addLog(
        logMessage || '步骤 2：注册页标签已切换，正在等待页面加载完成并额外稳定 3 秒...',
        'info',
        { step: 2, stepKey: 'signup-entry' }
      );

      return waitForTabStableComplete(tabId, {
        timeoutMs: 45000,
        retryDelayMs: 300,
        stableMs: 3000,
        initialDelayMs: 300,
      });
    }

    async function keepSignupTabWindowInBackgroundForStep2(tabId) {
      // Intentionally no-op: the task tab is locked to the selected Chrome
      // window by the tab-runtime layer. Step 2 must not focus/raise that
      // window while the user is working in another app or browser window.
      void tabId;
    }

    async function ensureSignupPhoneEntryReady(tabId) {
      if (!Number.isInteger(tabId)) {
        throw new Error('步骤 2：未找到可用的注册页标签，无法切换到手机号注册入口。');
      }

      const result = await sendToContentScriptResilient('openai-auth', {
        type: 'ENSURE_SIGNUP_PHONE_ENTRY_READY',
        step: 2,
        source: 'background',
        payload: {},
      }, {
        timeoutMs: 30000,
        retryDelayMs: 700,
        logMessage: '步骤 2：正在打开官网注册入口并切换到手机号注册...',
      });

      if (result?.error) {
        throw new Error(result.error);
      }
      return result || {};
    }

    async function submitSignupEmail(resolvedEmail, options = {}) {
      return sendSignupIdentity({ email: resolvedEmail }, options);
    }

    async function submitSignupPhone(phoneNumber, activation, options = {}) {
      return sendSignupIdentity({
        signupMethod: 'phone',
        phoneNumber,
        countryId: activation?.countryId ?? null,
        countryLabel: String(activation?.countryLabel || '').trim(),
      }, {
        logMessage: '步骤 2：官网注册入口正在切换，等待手机号注册入口恢复...',
        ...options,
      });
    }

    async function ensureSignupTabForStep2() {
      let signupTabId = await getTabId('openai-auth');
      if (!signupTabId || !(await isTabAlive('openai-auth'))) {
        await addLog('步骤 2：未发现可用的注册页标签，正在重新打开 ChatGPT 官网...', 'warn');
        signupTabId = (await ensureSignupEntryPageReady(2)).tabId;
      } else {
        await chrome.tabs.update(signupTabId, { active: true });
        await keepSignupTabWindowInBackgroundForStep2(signupTabId);
        await waitForStep2SignupTabToSettle(
          signupTabId,
          '步骤 2：已切换到注册页标签，正在等待页面加载完成并额外稳定 3 秒...'
        );
        await ensureContentScriptReadyOnTab('openai-auth', signupTabId, {
          inject: OPENAI_AUTH_INJECT_FILES,
          injectSource: 'openai-auth',
          timeoutMs: 45000,
          retryDelayMs: 900,
          logMessage: '步骤 2：注册入口页内容脚本未就绪，正在等待页面恢复...',
        });
      }
      return signupTabId;
    }

    function normalizeSignupPhoneActivationForStep2(activation) {
      if (typeof phoneVerificationHelpers?.normalizeActivation === 'function') {
        return phoneVerificationHelpers.normalizeActivation(activation);
      }
      if (!activation || typeof activation !== 'object' || Array.isArray(activation)) {
        return null;
      }
      const activationId = String(activation.activationId ?? activation.id ?? activation.activation ?? '').trim();
      const phoneNumber = String(activation.phoneNumber ?? activation.number ?? activation.phone ?? '').trim();
      if (!activationId || !phoneNumber) {
        return null;
      }
      return {
        ...activation,
        activationId,
        phoneNumber,
      };
    }

    function getSignupPhoneNumberFromState(state = {}) {
      return String(
        state?.signupPhoneNumber
        || (String(state?.accountIdentifierType || '').trim().toLowerCase() === 'phone' ? state?.accountIdentifier : '')
        || ''
      ).trim();
    }

    async function resolveSignupPhoneForStep2(state = {}) {
      const existingActivation = normalizeSignupPhoneActivationForStep2(state?.signupPhoneActivation);
      if (existingActivation?.phoneNumber) {
        await addLog(`步骤 2：复用当前注册手机号 ${existingActivation.phoneNumber}，不重新获取号码。`);
        return {
          phoneNumber: existingActivation.phoneNumber,
          activation: existingActivation,
        };
      }

      const manualPhoneNumber = getSignupPhoneNumberFromState(state);
      if (manualPhoneNumber) {
        await addLog(`步骤 2：使用手动填写的注册手机号 ${manualPhoneNumber}，本轮不会重新获取号码。`, 'warn');
        return {
          phoneNumber: manualPhoneNumber,
          activation: null,
        };
      }

      if (typeof phoneVerificationHelpers?.prepareSignupPhoneActivation !== 'function') {
        throw new Error('手机号注册流程不可用：接码模块尚未初始化。');
      }
      const activation = await phoneVerificationHelpers.prepareSignupPhoneActivation(state);
      return {
        phoneNumber: activation.phoneNumber,
        activation,
      };
    }

    async function executeSignupPhoneEntry(state) {
      let signupTabId = await ensureSignupTabForStep2();
      if (await shouldForceAuthEntryRetry(signupTabId)) {
        await addLog('步骤 2：检测到当前位于已登录 ChatGPT 首页，先切换认证入口页再提交手机号。', 'warn');
        try {
          signupTabId = (await ensureSignupAuthEntryPageReady(2)).tabId;
        } catch (entryError) {
          const entryErrorMessage = getErrorMessage(entryError);
          if (await failStep2OnLoggedInSession(signupTabId, entryErrorMessage)) {
            return;
          }
          await addLog('步骤 2：切换认证入口失败，正在重新打开官网入口并重试提交手机号...', 'warn');
          signupTabId = (await ensureSignupEntryPageReady(2)).tabId;
        }
      }

      try {
        await ensureSignupPhoneEntryReady(signupTabId);
      } catch (entryError) {
        const entryErrorMessage = getErrorMessage(entryError);
        if (await failStep2OnLoggedInSession(signupTabId, entryErrorMessage)) {
          return;
        }
        if (
          isSignupPhoneEntryUnavailableErrorMessage(entryErrorMessage)
          || isSignupEntryUnavailableErrorMessage(entryErrorMessage)
          || isRetryableStep2TransportErrorMessage(entryErrorMessage)
        ) {
          await addLog('步骤 2：手机号注册入口尚未就绪，正在重新打开官网入口后重试一次...', 'warn');
          signupTabId = (await ensureSignupEntryPageReady(2)).tabId;
          await ensureSignupPhoneEntryReady(signupTabId);
        } else {
          throw entryError;
        }
      }

      const signupPhone = await resolveSignupPhoneForStep2(state);
      const { phoneNumber, activation } = signupPhone;
      let step2Result = await submitSignupPhone(phoneNumber, activation, {
        timeoutMs: 45000,
        retryDelayMs: 700,
        logMessage: '步骤 2：官网注册入口正在切换，等待手机号注册入口恢复...',
      });

      if (step2Result?.error) {
        const errorMessage = getErrorMessage(step2Result.error);
        if (
          isSignupPhoneEntryUnavailableErrorMessage(errorMessage)
          || isSignupEntryUnavailableErrorMessage(errorMessage)
          || isRetryableStep2TransportErrorMessage(errorMessage)
        ) {
          await addLog('步骤 2：手机号注册入口不可用或通信超时，正在重新准备手机号注册入口后重试一次...', 'warn');
          signupTabId = (await ensureSignupEntryPageReady(2)).tabId;
          await ensureSignupPhoneEntryReady(signupTabId);
          step2Result = await submitSignupPhone(phoneNumber, activation, {
            timeoutMs: 45000,
            retryDelayMs: 700,
            logMessage: '步骤 2：手机号注册入口已就绪，正在重新提交手机号...',
          });
        }
      }

      if (step2Result?.error) {
        const finalErrorMessage = getErrorMessage(step2Result.error);
        if (
          (isSignupEntryUnavailableErrorMessage(finalErrorMessage)
            || isRetryableStep2TransportErrorMessage(finalErrorMessage))
          && await failStep2OnLoggedInSession(signupTabId, finalErrorMessage)
        ) {
          return;
        }
        if (activation && typeof phoneVerificationHelpers?.cancelSignupPhoneActivation === 'function') {
          await phoneVerificationHelpers.cancelSignupPhoneActivation(state, activation).catch(() => {});
        }
        throw new Error(finalErrorMessage);
      }

      await addLog(`步骤 2：手机号 ${phoneNumber} 已提交，正在等待页面加载并确认下一步入口...`);
      const landingResult = await ensureSignupPostIdentityPageReadyInTab(signupTabId, 2, {
        skipUrlWait: Boolean(step2Result?.alreadyOnPasswordPage),
      });

      await completeNodeFromBackground('submit-signup-email', {
        accountIdentifierType: 'phone',
        accountIdentifier: phoneNumber,
        signupPhoneNumber: phoneNumber,
        signupPhoneActivation: activation || null,
        nextSignupState: landingResult?.state || step2Result?.state || 'password_page',
        nextSignupUrl: landingResult?.url || step2Result?.url || '',
        skippedPasswordStep: landingResult?.state === 'phone_verification_page' || landingResult?.state === 'profile_page',
      });
    }

    async function executeSignupEmailEntry(state) {
      const resolvedEmail = await resolveSignupEmailForFlow(state);

      let signupTabId = await ensureSignupTabForStep2();

      if (await shouldForceAuthEntryRetry(signupTabId)) {
        await addLog('步骤 2：检测到当前位于已登录 ChatGPT 首页，先切换认证入口页再提交邮箱。', 'warn');
        try {
          signupTabId = (await ensureSignupAuthEntryPageReady(2)).tabId;
        } catch (entryError) {
          const entryErrorMessage = getErrorMessage(entryError);
          if (await failStep2OnLoggedInSession(signupTabId, entryErrorMessage)) {
            return;
          }
          await addLog('步骤 2：切换认证入口失败，正在重新打开官网入口并重试提交邮箱...', 'warn');
          signupTabId = (await ensureSignupEntryPageReady(2)).tabId;
        }
      }

      let step2Result = await submitSignupEmail(resolvedEmail, {
        timeoutMs: 35000,
        retryDelayMs: 700,
        logMessage: '步骤 2：官网注册入口正在切换，等待页面恢复后继续输入邮箱...',
      });

      if (step2Result?.error) {
        const errorMessage = getErrorMessage(step2Result.error);
        if (isSignupEntryUnavailableErrorMessage(errorMessage)) {
          await addLog('步骤 2：未找到邮箱输入入口，正在切换认证入口页后重试一次...', 'warn');
          signupTabId = (await ensureSignupAuthEntryPageReady(2)).tabId;
          step2Result = await submitSignupEmail(resolvedEmail, {
            timeoutMs: 35000,
            retryDelayMs: 700,
            logMessage: '步骤 2：认证入口页已打开，正在重新提交邮箱...',
          });

          if (step2Result?.error) {
            const retryErrorMessage = getErrorMessage(step2Result.error);
            if (isSignupEntryUnavailableErrorMessage(retryErrorMessage)) {
              if (await failStep2OnLoggedInSession(signupTabId, retryErrorMessage)) {
                return;
              }
              await addLog('步骤 2：认证入口仍不可用，正在重新进入官网注册入口再重试一次...', 'warn');
              signupTabId = (await ensureSignupEntryPageReady(2)).tabId;
              step2Result = await submitSignupEmail(resolvedEmail, {
                timeoutMs: 35000,
                retryDelayMs: 700,
                logMessage: '步骤 2：重试官网注册入口后正在重新提交邮箱...',
              });
            }
          }
        } else if (isRetryableStep2TransportErrorMessage(errorMessage)) {
          await addLog('步骤 2：注册入口页通信超时，正在切换认证入口页并重试提交邮箱...', 'warn');
          signupTabId = (await ensureSignupAuthEntryPageReady(2)).tabId;
          step2Result = await submitSignupEmail(resolvedEmail, {
            timeoutMs: 45000,
            retryDelayMs: 700,
            logMessage: '步骤 2：认证入口页已打开，正在重新提交邮箱...',
          });
        }
      }

      if (step2Result?.error) {
        const finalErrorMessage = getErrorMessage(step2Result.error);
        if (
          (isSignupEntryUnavailableErrorMessage(finalErrorMessage)
            || isRetryableStep2TransportErrorMessage(finalErrorMessage))
          && await failStep2OnLoggedInSession(signupTabId, finalErrorMessage)
        ) {
          return;
        }
        throw new Error(finalErrorMessage);
      }

      if (!step2Result?.alreadyOnPasswordPage) {
        await addLog(`步骤 2：邮箱 ${resolvedEmail} 已提交，正在等待页面加载并确认下一步入口...`);
      }

      const landingResult = await ensureSignupPostEmailPageReadyInTab(signupTabId, 2, {
        skipUrlWait: Boolean(step2Result?.alreadyOnPasswordPage),
      });

      await completeNodeFromBackground('submit-signup-email', {
        email: resolvedEmail,
        accountIdentifierType: 'email',
        accountIdentifier: resolvedEmail,
        nextSignupState: landingResult?.state || 'password_page',
        nextSignupUrl: landingResult?.url || step2Result?.url || '',
        skippedPasswordStep: landingResult?.state === 'verification_page',
      });
    }

    async function executeStep2(state) {
      if (resolveSignupMethod(state) === 'phone') {
        return executeSignupPhoneEntry(state);
      }
      return executeSignupEmailEntry(state);
    }

    return { executeStep2 };
  }

  return { createStep2Executor };
});
