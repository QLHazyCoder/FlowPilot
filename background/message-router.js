(function attachBackgroundMessageRouter(root, factory) {
  root.MultiPageBackgroundMessageRouter = factory();
})(typeof self !== 'undefined' ? self : globalThis, function createBackgroundMessageRouterModule() {
  function createMessageRouter(deps = {}) {
    const {
      addLog,
      appendAccountRunRecord,
      batchUpdateLuckmailPurchases,
      buildLocalhostCleanupPrefix,
      buildLuckmailSessionSettingsPayload,
      buildPersistentSettingsPayload,
      broadcastDataUpdate,
      applyIpProxySettingsFromState,
      cancelScheduledAutoRun,
      checkIcloudSession,
      clearAccountRunHistory,
      deleteAccountRunHistoryRecords,
      clearAutoRunTimerAlarm,
      clearFreeReusablePhoneActivation,
      clearLuckmailRuntimeState,
      clearStopRequest,
      closeLocalhostCallbackTabs,
      closeTabsByUrlPrefix,
      completeStepFromBackground,
      deleteHotmailAccount,
      deleteHotmailAccounts,
      deleteIcloudAlias,
      deleteUsedIcloudAliases,
      disableUsedLuckmailPurchases,
      doesStepUseCompletionSignal,
      ensureMail2925MailboxSession,
      ensureManualInteractionAllowed,
      executeStep,
      executeStepViaCompletionSignal,
      exportSettingsBundle,
      fetchGeneratedEmail,
      refreshGpcCardBalance,
      finalizePhoneActivationAfterSuccessfulFlow,
      finalizeStep3Completion,
      finalizeIcloudAliasAfterSuccessfulFlow,
      findHotmailAccount,
      findPayPalAccount,
      flushCommand,
      getCurrentLuckmailPurchase,
      getCurrentPayPalAccount,
      getCurrentMail2925Account,
      getPendingAutoRunTimerPlan,
      getSourceLabel,
      getState,
      getStepDefinitionForState,
      getStepIdsForState,
      getLastStepIdForState,
      normalizeSignupMethod = (value = '') => String(value || '').trim().toLowerCase() === 'phone' ? 'phone' : 'email',
      canUsePhoneSignup = (state = {}) => Boolean(state?.phoneVerificationEnabled)
        && !Boolean(state?.plusModeEnabled)
        && !Boolean(state?.contributionMode),
      resolveSignupMethod = (state = {}) => {
        const method = normalizeSignupMethod(state?.signupMethod);
        return method === 'phone' && canUsePhoneSignup(state) ? 'phone' : 'email';
      },
      getTabId,
      getStopRequested,
      handleAutoRunLoopUnhandledError,
      importSettingsBundle,
      invalidateDownstreamAfterStepRestart,
      isCloudflareSecurityBlockedError,
      isAutoRunLockedState,
      isHotmailProvider,
      isLocalhostOAuthCallbackUrl,
      isLuckmailProvider,
      isStopError,
      isTabAlive,
      launchAutoRunTimerPlan,
      ensureIpProxyAutoSyncAlarm,
      clearIpProxyAutoSyncAlarm,
      runIpProxyAutoSync,
      listIcloudAliases,
      listLuckmailPurchasesForManagement,
      markCurrentCustomEmailPoolEntryUsed,
      markCurrentRegistrationAccountUsed,
      normalizeHotmailAccounts,
      normalizeMail2925Accounts,
      normalizePayPalAccounts,
      normalizeRunCount,
      AUTO_RUN_TIMER_KIND_SCHEDULED_START,
      notifyStepComplete,
      notifyStepError,
      patchMail2925Account,
      patchHotmailAccount,
      pollContributionStatus,
      registerTab,
      requestStop,
      probeIpProxyExit,
      handleCloudflareSecurityBlocked,
      resetState,
      resumeAutoRun,
      scheduleAutoRun,
      selectLuckmailPurchase,
      switchIpProxy,
      changeIpProxyExit,
      setCurrentPayPalAccount,
      setCurrentMail2925Account,
      setCurrentHotmailAccount,
      setContributionMode,
      setEmailState,
      setEmailStateSilently,
      setFreeReusablePhoneActivation,
      setSignupPhoneState,
      setSignupPhoneStateSilently,
      setIcloudAliasPreservedState,
      setIcloudAliasUsedState,
      setLuckmailPurchaseDisabledState,
      setLuckmailPurchasePreservedState,
      setLuckmailPurchaseUsedState,
      setPersistentSettings,
      setState,
      setStepStatus,
      skipAutoRunCountdown,
      skipStep,
      startContributionFlow,
      startAutoRunLoop,
      deleteMail2925Account,
      deleteMail2925Accounts,
      syncHotmailAccounts,
      syncPayPalAccounts,
      testHotmailAccountMailAccess,
      upsertPayPalAccount,
      upsertMail2925Account,
      upsertHotmailAccount,
      verifyHotmailAccount,
    } = deps;

    async function appendManualAccountRunRecordIfNeeded(status, stateOverride = null, reason = '') {
      if (typeof appendAccountRunRecord !== 'function') {
        return null;
      }

      const state = stateOverride || await getState();
      if (isAutoRunLockedState(state)) {
        return null;
      }

      return appendAccountRunRecord(status, state, reason);
    }

    async function ensureManualStepPrerequisites(step) {
      if (step !== 4) {
        return;
      }

      const signupTabId = typeof getTabId === 'function'
        ? await getTabId('signup-page')
        : null;
      const signupTabAlive = signupTabId && typeof isTabAlive === 'function'
        ? await isTabAlive('signup-page')
        : Boolean(signupTabId);

      if (!signupTabId || !signupTabAlive) {
        throw new Error('手动执行步骤 4 前，请先执行步骤 1 或步骤 2，确保认证页仍然打开并停留在验证码页。');
      }
    }

    function getStepKeyForState(step, state = {}) {
      if (typeof getStepDefinitionForState === 'function') {
        return String(getStepDefinitionForState(step, state)?.key || '').trim();
      }
      return '';
    }

    function isStaleAutoRunStepMessage(step, state = {}) {
      if (typeof isAutoRunLockedState !== 'function' || !isAutoRunLockedState(state)) {
        return false;
      }
      const normalizedStep = Number(step);
      if (!Number.isInteger(normalizedStep) || normalizedStep <= 0) {
        return false;
      }
      const currentStatus = String(state?.stepStatuses?.[normalizedStep] || '').trim();
      if (currentStatus === 'running') {
        return false;
      }
      const currentStep = Number(state?.currentStep) || 0;
      if (currentStep > 0 && normalizedStep !== currentStep) {
        return true;
      }
      return ['completed', 'manual_completed', 'skipped', 'failed', 'stopped'].includes(currentStatus);
    }

    function resolveSignupPhonePayload(payload = {}) {
      const directPhone = String(
        payload?.signupPhoneNumber
        || payload?.phoneNumber
        || ''
      ).trim();
      if (directPhone) {
        return directPhone;
      }
      return String(payload?.accountIdentifierType || '').trim().toLowerCase() === 'phone'
        ? String(payload?.accountIdentifier || '').trim()
        : '';
    }

    function resolveEmailIdentityPayload(payload = {}) {
      const directEmail = String(payload?.email || '').trim();
      if (directEmail) {
        return directEmail;
      }
      return String(payload?.accountIdentifierType || '').trim().toLowerCase() === 'email'
        ? String(payload?.accountIdentifier || '').trim()
        : '';
    }

    async function syncStepAccountIdentityFromPayload(payload = {}) {
      const identifierType = String(payload?.accountIdentifierType || '').trim().toLowerCase();
      const signupPhoneNumber = resolveSignupPhonePayload(payload);
      if (identifierType === 'phone' || signupPhoneNumber) {
        if (signupPhoneNumber) {
          await setSignupPhoneStateSilently(signupPhoneNumber);
        }
        const updates = {};
        if (Object.prototype.hasOwnProperty.call(payload, 'signupPhoneActivation')) {
          updates.signupPhoneActivation = payload.signupPhoneActivation || null;
        }
        if (Object.prototype.hasOwnProperty.call(payload, 'signupPhoneCompletedActivation')) {
          updates.signupPhoneCompletedActivation = payload.signupPhoneCompletedActivation || null;
        }
        if (Object.keys(updates).length) {
          await setState(updates);
          broadcastDataUpdate(updates);
        }
        return;
      }

      const email = resolveEmailIdentityPayload(payload);
      if (identifierType === 'email' || email) {
        if (email) {
          await setEmailState(email);
        }
        const updates = {
          phoneNumber: '',
          signupPhoneNumber: '',
          signupPhoneActivation: null,
          signupPhoneCompletedActivation: null,
          signupPhoneVerificationRequestedAt: null,
          signupPhoneVerificationPurpose: '',
          ...(email ? {
            accountIdentifierType: 'email',
            accountIdentifier: email,
          } : {}),
        };
        await setSignupPhoneStateSilently(null);
        await setState(updates);
        broadcastDataUpdate(updates);
      }
    }

    function isStepProtectedFromAutoSkip(status) {
      return status === 'running'
        || status === 'completed'
        || status === 'manual_completed'
        || status === 'skipped';
    }

    function findStepByKeyAfter(currentStep, targetKey, state = {}) {
      const activeStepIds = typeof getStepIdsForState === 'function'
        ? getStepIdsForState(state)
        : [];
      const candidates = activeStepIds.length ? activeStepIds : [Number(currentStep) + 1, 8];
      return candidates.find((stepId) => {
        const numericStep = Number(stepId);
        if (!Number.isFinite(numericStep) || numericStep <= Number(currentStep)) {
          return false;
        }
        const stepKey = getStepKeyForState(numericStep, state);
        if (stepKey) {
          return stepKey === targetKey;
        }
        return targetKey === 'fetch-login-code' && Number(currentStep) === 7 && numericStep === 8;
      }) || null;
    }

    function normalizePlusPaymentMethodForDisplay(value = '') {
      const normalized = String(value || '').trim().toLowerCase();
      if (normalized === 'gpc-helper') {
        return 'gpc-helper';
      }
      return normalized === 'gopay' ? 'gopay' : 'paypal';
    }

    function getPlusPaymentMethodLabel(value = '') {
      const method = normalizePlusPaymentMethodForDisplay(value);
      if (method === 'gpc-helper') {
        return 'GPC';
      }
      return method === 'gopay' ? 'GoPay' : 'PayPal';
    }

    async function handlePlatformVerifyStepData(payload) {
      if (payload.localhostUrl) {
        await closeLocalhostCallbackTabs(payload.localhostUrl);
      }
      const latestState = await getState();
      if (typeof markCurrentRegistrationAccountUsed === 'function') {
        await markCurrentRegistrationAccountUsed(latestState, {
          logPrefix: '流程完成',
          level: 'ok',
        });
      } else if (latestState.currentHotmailAccountId && isHotmailProvider(latestState)) {
        await patchHotmailAccount(latestState.currentHotmailAccountId, {
          used: true,
          lastUsedAt: Date.now(),
        });
        await addLog('当前 Hotmail 账号已自动标记为已用。', 'ok');
      }
      if (typeof markCurrentRegistrationAccountUsed !== 'function' && String(latestState.mailProvider || '').trim().toLowerCase() === '2925' && latestState.currentMail2925AccountId) {
        await patchMail2925Account(latestState.currentMail2925AccountId, {
          lastUsedAt: Date.now(),
          lastError: '',
        });
        await addLog('当前 2925 账号已记录最近使用时间。', 'ok');
      }
      if (typeof markCurrentRegistrationAccountUsed !== 'function' && isLuckmailProvider(latestState)) {
        const currentPurchase = getCurrentLuckmailPurchase(latestState);
        if (currentPurchase?.id) {
          await setLuckmailPurchaseUsedState(currentPurchase.id, true);
          await addLog(`当前 LuckMail 邮箱 ${currentPurchase.email_address} 已在本地标记为已用。`, 'ok');
        }
        await clearLuckmailRuntimeState({ clearEmail: true });
        await addLog('当前 LuckMail 邮箱运行态已清空，下轮将优先复用未用邮箱或重新购买邮箱。', 'ok');
      }
      const localhostPrefix = buildLocalhostCleanupPrefix(payload.localhostUrl);
      if (localhostPrefix) {
        await closeTabsByUrlPrefix(localhostPrefix, {
          excludeUrls: [payload.localhostUrl],
          excludeLocalhostCallbacks: true,
        });
      }
      if (typeof markCurrentRegistrationAccountUsed !== 'function') {
        await finalizeIcloudAliasAfterSuccessfulFlow(latestState);
      }
      if (typeof finalizePhoneActivationAfterSuccessfulFlow === 'function') {
        await finalizePhoneActivationAfterSuccessfulFlow(latestState);
      }
    }

    async function handleStepData(step, payload) {
      if (step === 1) {
        const updates = {};
        if (payload.oauthUrl) {
          updates.oauthUrl = payload.oauthUrl;
          broadcastDataUpdate({ oauthUrl: payload.oauthUrl });
        }
        if (payload.sub2apiSessionId !== undefined) updates.sub2apiSessionId = payload.sub2apiSessionId || null;
        if (payload.sub2apiOAuthState !== undefined) updates.sub2apiOAuthState = payload.sub2apiOAuthState || null;
        if (payload.sub2apiGroupId !== undefined) updates.sub2apiGroupId = payload.sub2apiGroupId || null;
        if (payload.sub2apiDraftName !== undefined) updates.sub2apiDraftName = payload.sub2apiDraftName || null;
        if (payload.sub2apiProxyId !== undefined) updates.sub2apiProxyId = payload.sub2apiProxyId || null;
        if (payload.cpaOAuthState !== undefined) updates.cpaOAuthState = payload.cpaOAuthState || null;
        if (payload.cpaManagementOrigin !== undefined) updates.cpaManagementOrigin = payload.cpaManagementOrigin || null;
        if (payload.codex2apiSessionId !== undefined) updates.codex2apiSessionId = payload.codex2apiSessionId || null;
        if (payload.codex2apiOAuthState !== undefined) updates.codex2apiOAuthState = payload.codex2apiOAuthState || null;
        if (Object.keys(updates).length) {
          await setState(updates);
        }
        return;
      }

      const stateForStep = await getState();
      const stepKey = getStepKeyForState(step, stateForStep);

      if (stepKey === 'oauth-login') {
        if (payload.skipLoginVerificationStep) {
          await setState({ loginVerificationRequestedAt: null });
          const latestState = await getState();
          const loginCodeStep = findStepByKeyAfter(step, 'fetch-login-code', latestState);
          if (loginCodeStep) {
            const currentStatus = latestState.stepStatuses?.[loginCodeStep];
            if (!isStepProtectedFromAutoSkip(currentStatus)) {
              await setStepStatus(loginCodeStep, 'skipped');
              await addLog(`认证页已直接进入 OAuth 授权页，已自动跳过步骤 ${loginCodeStep} 的登录验证码。`, 'warn', {
                step,
                stepKey: 'oauth-login',
              });
            }
          }
        } else if (payload.loginVerificationRequestedAt) {
          await setState({ loginVerificationRequestedAt: payload.loginVerificationRequestedAt });
        }
        return;
      }

      if (stepKey === 'fetch-login-code') {
        await setState({
          ...(payload.phoneVerification || payload.loginPhoneVerification ? {
            currentPhoneVerificationCode: '',
            signupPhoneVerificationRequestedAt: null,
            signupPhoneVerificationPurpose: '',
          } : {
            lastEmailTimestamp: payload.emailTimestamp || null,
          }),
          loginVerificationRequestedAt: null,
        });
        return;
      }

      if (stepKey === 'confirm-oauth') {
        if (payload.localhostUrl) {
          if (!isLocalhostOAuthCallbackUrl(payload.localhostUrl)) {
            throw new Error(`步骤 ${step} 返回了无效的 localhost OAuth 回调地址。`);
          }
          await setState({ localhostUrl: payload.localhostUrl });
          broadcastDataUpdate({ localhostUrl: payload.localhostUrl });
        }
        return;
      }

      if (stepKey === 'platform-verify') {
        await handlePlatformVerifyStepData(payload);
        return;
      }

      switch (step) {
        case 1: {
          const updates = {};
          if (payload.oauthUrl) {
            updates.oauthUrl = payload.oauthUrl;
            broadcastDataUpdate({ oauthUrl: payload.oauthUrl });
          }
          if (payload.sub2apiSessionId !== undefined) updates.sub2apiSessionId = payload.sub2apiSessionId || null;
          if (payload.sub2apiOAuthState !== undefined) updates.sub2apiOAuthState = payload.sub2apiOAuthState || null;
          if (payload.sub2apiGroupId !== undefined) updates.sub2apiGroupId = payload.sub2apiGroupId || null;
          if (payload.sub2apiGroupIds !== undefined) updates.sub2apiGroupIds = Array.isArray(payload.sub2apiGroupIds)
            ? payload.sub2apiGroupIds
            : [];
          if (payload.sub2apiDraftName !== undefined) updates.sub2apiDraftName = payload.sub2apiDraftName || null;
          if (payload.sub2apiProxyId !== undefined) updates.sub2apiProxyId = payload.sub2apiProxyId || null;
          if (payload.codex2apiSessionId !== undefined) updates.codex2apiSessionId = payload.codex2apiSessionId || null;
          if (payload.codex2apiOAuthState !== undefined) updates.codex2apiOAuthState = payload.codex2apiOAuthState || null;
          if (Object.keys(updates).length) {
            await setState(updates);
          }
          break;
        }
        case 2:
          await syncStepAccountIdentityFromPayload(payload);
          if (payload.skipRegistrationFlow) {
            const latestState = await getState();
            for (const skipStep of [3, 4, 5]) {
              const status = latestState.stepStatuses?.[skipStep];
              if (status === 'running' || status === 'completed' || status === 'manual_completed') {
                continue;
              }
              await setStepStatus(skipStep, 'skipped');
            }
            await addLog('步骤 2：检测到当前已登录会话，已自动跳过步骤 3/4/5，流程将直接进入步骤 6。', 'warn');
            break;
          }
          if (payload.skippedPasswordStep) {
            const latestState = await getState();
            const step3Status = latestState.stepStatuses?.[3];
            if (step3Status !== 'running' && step3Status !== 'completed' && step3Status !== 'manual_completed') {
              await setStepStatus(3, 'skipped');
              const identityLabel = payload.accountIdentifierType === 'phone' ? '手机号' : '邮箱';
              await addLog(`步骤 2：提交${identityLabel}后页面直接进入验证码页，已自动跳过步骤 3。`, 'warn');
            }
          }
          break;
        case 3:
          await syncStepAccountIdentityFromPayload(payload);
          if (payload.signupVerificationRequestedAt) {
            await setState({ signupVerificationRequestedAt: payload.signupVerificationRequestedAt });
          }
          if (payload.skipProfileStep) {
            const latestState = await getState();
            const step5Status = latestState.stepStatuses?.[5];
            if (step5Status !== 'running' && step5Status !== 'completed' && step5Status !== 'manual_completed') {
              await setStepStatus(5, 'skipped');
              await addLog('步骤 3：页面已直接进入已登录态，已自动跳过步骤 5。', 'warn');
            }
          }
          if (payload.loginVerificationRequestedAt) {
            await setState({ loginVerificationRequestedAt: payload.loginVerificationRequestedAt });
          }
          break;
        case 4:
          await setState({
            ...(payload.phoneVerification ? {
              currentPhoneVerificationCode: '',
              signupPhoneVerificationRequestedAt: null,
              signupPhoneVerificationPurpose: '',
            } : {
              lastEmailTimestamp: payload.emailTimestamp || null,
            }),
            signupVerificationRequestedAt: null,
          });
          if (payload.skipProfileStep) {
            const latestState = await getState();
            const step5Status = latestState.stepStatuses?.[5];
            if (step5Status !== 'running' && step5Status !== 'completed' && step5Status !== 'manual_completed') {
              await setStepStatus(5, 'skipped');
              if (payload.skipProfileStepReason === 'combined_verification_profile') {
                await addLog('步骤 4：当前验证码页已内嵌完成注册资料提交，已自动跳过步骤 5。', 'warn');
              } else {
                await addLog('步骤 4：检测到账号已直接进入已登录态，已自动跳过步骤 5。', 'warn');
              }
            }
          }
          break;
        case 8:
          await setState({
            ...(payload.phoneVerification || payload.loginPhoneVerification ? {
              currentPhoneVerificationCode: '',
              signupPhoneVerificationRequestedAt: null,
              signupPhoneVerificationPurpose: '',
            } : {
              lastEmailTimestamp: payload.emailTimestamp || null,
            }),
            loginVerificationRequestedAt: null,
          });
          break;
        case 9:
          if (payload.localhostUrl) {
            if (!isLocalhostOAuthCallbackUrl(payload.localhostUrl)) {
              throw new Error('步骤 9 返回了无效的 localhost OAuth 回调地址。');
            }
            await setState({ localhostUrl: payload.localhostUrl });
            broadcastDataUpdate({ localhostUrl: payload.localhostUrl });
          }
          break;
        default:
          break;
      }
    }

    async function handleMessage(message, sender) {
      switch (message.type) {
        case 'CONTENT_SCRIPT_READY': {
          const tabId = sender.tab?.id;
          if (tabId && message.source) {
            await registerTab(message.source, tabId);
            flushCommand(message.source, tabId);
            await addLog(`内容脚本已就绪：${getSourceLabel(message.source)}（标签页 ${tabId}）`);
          }
          return { ok: true };
        }

        case 'LOG': {
          const { message: msg, level, step: payloadStep, stepKey } = message.payload;
          const logStep = Math.floor(Number(message.step || payloadStep) || 0);
          await addLog(
            `[${getSourceLabel(message.source)}] ${msg}`,
            level,
            {
              step: logStep > 0 ? logStep : null,
              stepKey,
            }
          );
          return { ok: true };
        }

        case 'STEP_COMPLETE': {
          const currentState = await getState();
          if (isStaleAutoRunStepMessage(message.step, currentState)) {
            await addLog(`自动运行：忽略过期的步骤 ${message.step} 完成消息，当前流程已在步骤 ${currentState.currentStep || '未知'}。`, 'warn', { step: message.step });
            return { ok: true, ignored: true };
          }
          if (getStopRequested()) {
            await setStepStatus(message.step, 'stopped');
            await appendManualAccountRunRecordIfNeeded(`step${message.step}_stopped`, null, '流程已被用户停止。');
            notifyStepError(message.step, '流程已被用户停止。');
            return { ok: true };
          }
          try {
            if (message.step === 3 && typeof finalizeStep3Completion === 'function') {
              await finalizeStep3Completion(message.payload || {});
            }
          } catch (error) {
            if (typeof isCloudflareSecurityBlockedError === 'function' && isCloudflareSecurityBlockedError(error)) {
              const userMessage = typeof handleCloudflareSecurityBlocked === 'function'
                ? await handleCloudflareSecurityBlocked(error)
                : (error?.message || String(error || ''));
              notifyStepError(message.step, '流程已被用户停止。');
              return { ok: true, error: userMessage };
            }
            const errorMessage = error?.message || String(error || '步骤 3 提交后确认失败');
            await setStepStatus(message.step, 'failed');
            await addLog(`失败：${errorMessage}`, 'error', { step: message.step });
            await appendManualAccountRunRecordIfNeeded(`step${message.step}_failed`, null, errorMessage);
            notifyStepError(message.step, errorMessage);
            return { ok: true, error: errorMessage };
          }

          const completionStateCandidate = await getState();
          const lastStepId = typeof getLastStepIdForState === 'function'
            ? getLastStepIdForState(completionStateCandidate)
            : 10;
          const completionState = message.step === lastStepId ? completionStateCandidate : null;
          await setStepStatus(message.step, 'completed');
          await addLog('已完成', 'ok', { step: message.step });
          await handleStepData(message.step, message.payload);
          if (message.step === lastStepId && typeof appendAccountRunRecord === 'function') {
            await appendAccountRunRecord('success', completionState);
          }
          notifyStepComplete(message.step, message.payload);
          return { ok: true };
        }

        case 'STEP_ERROR': {
          const staleCheckState = await getState();
          if (isStaleAutoRunStepMessage(message.step, staleCheckState)) {
            await addLog(`自动运行：忽略过期的步骤 ${message.step} 失败消息，当前流程已在步骤 ${staleCheckState.currentStep || '未知'}。原始错误：${message.error || '未知错误'}`, 'warn', { step: message.step });
            return { ok: true, ignored: true };
          }
          if (typeof isCloudflareSecurityBlockedError === 'function' && isCloudflareSecurityBlockedError(message.error)) {
            const userMessage = typeof handleCloudflareSecurityBlocked === 'function'
              ? await handleCloudflareSecurityBlocked(message.error)
              : (typeof message.error === 'string' ? message.error : String(message.error || ''));
            notifyStepError(message.step, '流程已被用户停止。');
            return { ok: true, error: userMessage };
          }
          const currentState = await getState();
          const currentStepStatus = currentState?.stepStatuses?.[message.step] || '';
          const isSignupPhonePasswordMismatch = /SIGNUP_PHONE_PASSWORD_MISMATCH::/i.test(String(message.error || ''));
          if (isStopError(message.error)) {
            await setStepStatus(message.step, 'stopped');
            await addLog('已被用户停止', 'warn', { step: message.step });
            await appendManualAccountRunRecordIfNeeded(`step${message.step}_stopped`, null, message.error);
            notifyStepError(message.step, message.error);
          } else {
            if (!(isSignupPhonePasswordMismatch && currentStepStatus === 'failed')) {
              await setStepStatus(message.step, 'failed');
              await addLog(`失败：${message.error}`, 'error', { step: message.step });
              await appendManualAccountRunRecordIfNeeded(`step${message.step}_failed`, null, message.error);
            }
            notifyStepError(message.step, message.error);
          }
          return { ok: true };
        }

        case 'RESOLVE_PLUS_MANUAL_CONFIRMATION': {
          const currentState = await getState();
          const step = Number(message.payload?.step) || Number(currentState?.plusManualConfirmationStep) || 0;
          const confirmed = Boolean(message.payload?.confirmed);
          const requestId = String(message.payload?.requestId || '').trim();
          const currentRequestId = String(currentState?.plusManualConfirmationRequestId || '').trim();
          const method = String(currentState?.plusManualConfirmationMethod || '').trim().toLowerCase();
          const isGpcOtp = method === 'gopay-otp';
          if (!currentState?.plusManualConfirmationPending) {
            return { ok: true, ignored: true };
          }
          if (requestId && currentRequestId && requestId !== currentRequestId) {
            return { ok: true, ignored: true };
          }

          const clearManualConfirmationState = {
            plusManualConfirmationPending: false,
            plusManualConfirmationRequestId: '',
            plusManualConfirmationStep: 0,
            plusManualConfirmationMethod: '',
            plusManualConfirmationTitle: '',
            plusManualConfirmationMessage: '',
          };

          if (isGpcOtp && confirmed) {
            const otp = String(message.payload?.otp || message.payload?.code || '').trim().replace(/[^\d]/g, '');
            if (!otp) {
              throw new Error('请输入 GPC OTP 验证码。');
            }
            const otpUpdates = {
              ...clearManualConfirmationState,
              gopayHelperResolvedOtp: otp,
            };
            await setState(otpUpdates);
            if (typeof broadcastDataUpdate === 'function') {
              broadcastDataUpdate(otpUpdates);
            }
            await addLog(`步骤 ${step}：已收到 GPC OTP，准备提交验证。`, 'ok');
            return { ok: true };
          }

          await setState(clearManualConfirmationState);
          if (typeof broadcastDataUpdate === 'function') {
            broadcastDataUpdate(clearManualConfirmationState);
          }

          if (confirmed) {
            const methodLabel = method === 'gopay' ? 'GoPay' : '手动';
            await addLog(`步骤 ${step}：已确认${methodLabel}订阅完成，准备继续下一步。`, 'ok');
            await completeStepFromBackground(step, {
              plusManualConfirmationMethod: currentState?.plusManualConfirmationMethod || '',
              plusManualConfirmedAt: Date.now(),
            });
            return { ok: true };
          }

          const cancelMessage = method === 'gopay'
            ? '已取消 GoPay 订阅确认'
            : (isGpcOtp ? '已取消 GPC OTP 输入' : '已取消当前手动确认');
          await setStepStatus(step, 'failed');
          await addLog(`步骤 ${step}：${cancelMessage}。`, 'warn');
          await appendManualAccountRunRecordIfNeeded(`step${step}_failed`, null, cancelMessage);
          notifyStepError(step, cancelMessage);
          return { ok: true };
        }

        case 'GET_STATE': {
          return await getState();
        }

        case 'RESET': {
          clearStopRequest();
          await clearAutoRunTimerAlarm();
          await resetState();
          await addLog('流程已重置', 'info');
          return { ok: true };
        }

        case 'CLEAR_FREE_REUSABLE_PHONE': {
          if (typeof clearFreeReusablePhoneActivation !== 'function') {
            throw new Error('白嫖复用手机号清除能力未接入。');
          }
          return await clearFreeReusablePhoneActivation();
        }

        case 'SET_FREE_REUSABLE_PHONE': {
          if (typeof setFreeReusablePhoneActivation !== 'function') {
            throw new Error('白嫖复用手机号记录能力未接入。');
          }
          return await setFreeReusablePhoneActivation(message.payload || {});
        }

        case 'SET_CONTRIBUTION_MODE': {
          const enabled = Boolean(message.payload?.enabled);
          const state = await ensureManualInteractionAllowed(enabled ? '进入贡献模式' : '退出贡献模式');
          if (Object.values(state.stepStatuses || {}).some((status) => status === 'running')) {
            throw new Error(enabled ? '当前有步骤正在执行，无法进入贡献模式。' : '当前有步骤正在执行，无法退出贡献模式。');
          }
          if (typeof setContributionMode !== 'function') {
            throw new Error('贡献模式切换能力未接入。');
          }
          return {
            ok: true,
            state: await setContributionMode(enabled),
          };
        }

        case 'START_CONTRIBUTION_FLOW': {
          const state = await ensureManualInteractionAllowed('开始贡献');
          if (Object.values(state.stepStatuses || {}).some((status) => status === 'running')) {
            throw new Error('当前有步骤正在执行，无法开始贡献流程。');
          }
          if (typeof startContributionFlow !== 'function') {
            throw new Error('贡献 OAuth 流程尚未接入。');
          }
          return {
            ok: true,
            state: await startContributionFlow({
              nickname: message.payload?.nickname,
              qq: message.payload?.qq,
            }),
          };
        }

        case 'SET_CONTRIBUTION_PROFILE': {
          const state = await getState();
          if (!state?.contributionMode) {
            throw new Error('请先进入贡献模式。');
          }
          const nickname = String(message.payload?.nickname || '').trim();
          const qq = String(message.payload?.qq || '').trim();
          if (qq && !/^\d{1,20}$/.test(qq)) {
            throw new Error('QQ 只能填写数字，且长度不能超过 20 位。');
          }
          await setState({
            contributionNickname: nickname,
            contributionQq: qq,
          });
          return {
            ok: true,
            state: await getState(),
          };
        }

        case 'POLL_CONTRIBUTION_STATUS': {
          if (typeof pollContributionStatus !== 'function') {
            throw new Error('贡献状态轮询能力尚未接入。');
          }
          return {
            ok: true,
            state: await pollContributionStatus({
              reason: message.payload?.reason || 'sidepanel_poll',
            }),
          };
        }

        case 'CLEAR_ACCOUNT_RUN_HISTORY': {
          const state = await getState();
          if (isAutoRunLockedState(state)) {
            throw new Error('自动流程运行中，当前不能清理邮箱记录。');
          }
          if (typeof clearAccountRunHistory !== 'function') {
            return { ok: true, clearedCount: 0 };
          }
          const result = await clearAccountRunHistory(state);
          return { ok: true, ...result };
        }

        case 'DELETE_ACCOUNT_RUN_HISTORY_RECORDS': {
          const state = await getState();
          if (isAutoRunLockedState(state)) {
            throw new Error('自动流程运行中，当前不能删除邮箱记录。');
          }
          if (typeof deleteAccountRunHistoryRecords !== 'function') {
            return { ok: true, deletedCount: 0, remainingCount: 0 };
          }
          const recordIds = Array.isArray(message.payload?.recordIds) ? message.payload.recordIds : [];
          const result = await deleteAccountRunHistoryRecords(recordIds, state);
          return { ok: true, ...result };
        }

        case 'EXECUTE_STEP': {
          clearStopRequest();
          if (message.source === 'sidepanel') {
            await ensureManualInteractionAllowed('手动执行步骤');
          }
          const step = message.payload.step;
          if (message.source === 'sidepanel') {
            await ensureManualStepPrerequisites(step);
          }
          if (message.source === 'sidepanel') {
            await invalidateDownstreamAfterStepRestart(step, { logLabel: `步骤 ${step} 重新执行` });
          }
          if (message.payload.email) {
            await setEmailState(message.payload.email);
          }
          if (message.payload.emailPrefix !== undefined) {
            await setPersistentSettings({ emailPrefix: message.payload.emailPrefix });
            await setState({ emailPrefix: message.payload.emailPrefix });
          }
          const executionState = await getState();
          if (doesStepUseCompletionSignal(step, executionState)) {
            await executeStepViaCompletionSignal(step);
          } else {
            await executeStep(step);
          }
          return { ok: true };
        }

        case 'AUTO_RUN': {
          clearStopRequest();
          if (Boolean(message.payload?.contributionMode) && typeof setContributionMode === 'function') {
            await setContributionMode(true);
            if (typeof setState === 'function') {
              const contributionNickname = String(message.payload?.contributionNickname || '').trim();
              const contributionQq = String(message.payload?.contributionQq || '').trim();
              await setState({
                contributionNickname,
                contributionQq,
              });
            }
          }
          const state = await getState();
          if (getPendingAutoRunTimerPlan(state)) {
            throw new Error('已有自动运行倒计时计划，请先取消或立即开始。');
          }
          const totalRuns = normalizeRunCount(message.payload?.totalRuns || 1);
          const autoRunSkipFailures = Boolean(message.payload?.autoRunSkipFailures);
          const mode = message.payload?.mode === 'continue' ? 'continue' : 'restart';
          await setState({ autoRunSkipFailures });
          startAutoRunLoop(totalRuns, { autoRunSkipFailures, mode });
          return { ok: true };
        }

        case 'SCHEDULE_AUTO_RUN': {
          clearStopRequest();
          if (Boolean(message.payload?.contributionMode) && typeof setContributionMode === 'function') {
            await setContributionMode(true);
            if (typeof setState === 'function') {
              const contributionNickname = String(message.payload?.contributionNickname || '').trim();
              const contributionQq = String(message.payload?.contributionQq || '').trim();
              await setState({
                contributionNickname,
                contributionQq,
              });
            }
          }
          const totalRuns = normalizeRunCount(message.payload?.totalRuns || 1);
          return await scheduleAutoRun(totalRuns, {
            delayMinutes: message.payload?.delayMinutes,
            autoRunSkipFailures: Boolean(message.payload?.autoRunSkipFailures),
            mode: message.payload?.mode,
          });
        }

        case 'START_SCHEDULED_AUTO_RUN_NOW': {
          clearStopRequest();
          const started = await launchAutoRunTimerPlan('manual', {
            expectedKinds: [AUTO_RUN_TIMER_KIND_SCHEDULED_START],
          });
          if (!started) {
            throw new Error('当前没有可立即开始的倒计时计划。');
          }
          return { ok: true };
        }

        case 'CANCEL_SCHEDULED_AUTO_RUN': {
          const cancelled = await cancelScheduledAutoRun();
          if (!cancelled) {
            throw new Error('当前没有可取消的倒计时计划。');
          }
          return { ok: true };
        }

        case 'SKIP_AUTO_RUN_COUNTDOWN': {
          clearStopRequest();
          const skipped = await skipAutoRunCountdown();
          if (!skipped) {
            throw new Error('当前没有可立即开始的倒计时。');
          }
          return { ok: true };
        }

        case 'RESUME_AUTO_RUN': {
          clearStopRequest();
          if (message.payload.email) {
            await setEmailState(message.payload.email);
          }
          resumeAutoRun().catch((error) => {
            handleAutoRunLoopUnhandledError(error).catch(() => {});
          });
          return { ok: true };
        }

        case 'TAKEOVER_AUTO_RUN': {
          await requestStop({ logMessage: '已确认手动接管，正在停止自动流程并切换为手动控制...' });
          await addLog('自动流程已切换为手动控制。', 'warn');
          return { ok: true };
        }

        case 'SKIP_STEP': {
          const step = Number(message.payload?.step);
          return await skipStep(step);
        }

        case 'SAVE_SETTING': {
          const currentState = await getState();
          const updates = buildPersistentSettingsPayload(message.payload || {});
          const sessionUpdates = buildLuckmailSessionSettingsPayload(message.payload || {});
          const nextSignupState = {
            ...currentState,
            ...updates,
            resolvedSignupMethod: null,
          };
          if (
            Object.prototype.hasOwnProperty.call(updates, 'phoneVerificationEnabled')
            || Object.prototype.hasOwnProperty.call(updates, 'plusModeEnabled')
            || Object.prototype.hasOwnProperty.call(updates, 'signupMethod')
          ) {
            updates.signupMethod = resolveSignupMethod(nextSignupState);
          }
          const modeChanged = Object.prototype.hasOwnProperty.call(updates, 'plusModeEnabled')
            && Boolean(currentState?.plusModeEnabled) !== Boolean(updates.plusModeEnabled);
          const plusPaymentChanged = Object.prototype.hasOwnProperty.call(updates, 'plusPaymentMethod')
            && normalizePlusPaymentMethodForDisplay(currentState?.plusPaymentMethod || 'paypal')
              !== normalizePlusPaymentMethodForDisplay(updates.plusPaymentMethod || 'paypal');
          const nextPlusModeEnabled = Object.prototype.hasOwnProperty.call(updates, 'plusModeEnabled')
            ? Boolean(updates.plusModeEnabled)
            : Boolean(currentState?.plusModeEnabled);
          const stepModeChanged = modeChanged || (nextPlusModeEnabled && plusPaymentChanged);
          const oauthFlowTimeoutDisabled = Object.prototype.hasOwnProperty.call(updates, 'oauthFlowTimeoutEnabled')
            && updates.oauthFlowTimeoutEnabled === false;
          await setPersistentSettings(updates);
          const stateUpdates = {
            ...updates,
            ...sessionUpdates,
            ...(oauthFlowTimeoutDisabled ? {
              oauthFlowDeadlineAt: null,
              oauthFlowDeadlineSourceUrl: null,
            } : {}),
          };
          if (Object.prototype.hasOwnProperty.call(updates, 'icloudHostPreference')) {
            const nextHostPreference = String(updates.icloudHostPreference || '').trim().toLowerCase();
            stateUpdates.preferredIcloudHost = nextHostPreference === 'icloud.com' || nextHostPreference === 'icloud.com.cn'
              ? nextHostPreference
              : '';
          }
          if (stepModeChanged && typeof getStepIdsForState === 'function') {
            const nextStateForSteps = { ...currentState, ...stateUpdates };
            stateUpdates.stepStatuses = Object.fromEntries(
              getStepIdsForState(nextStateForSteps).map((stepId) => [stepId, 'pending'])
            );
            stateUpdates.currentStep = 0;
          }
          await setState(stateUpdates);
          const mergedState = await getState();
          const hasIpProxyAutoSyncSettingChanged = (
            Object.prototype.hasOwnProperty.call(updates, 'ipProxyAutoSyncEnabled')
            || Object.prototype.hasOwnProperty.call(updates, 'ipProxyAutoSyncIntervalMinutes')
          );
          if (hasIpProxyAutoSyncSettingChanged) {
            if (Boolean(mergedState?.ipProxyAutoSyncEnabled)) {
              if (typeof ensureIpProxyAutoSyncAlarm === 'function') {
                await ensureIpProxyAutoSyncAlarm(mergedState);
              }
            } else if (typeof clearIpProxyAutoSyncAlarm === 'function') {
              await clearIpProxyAutoSyncAlarm();
            }
          }
          const hasIpProxyUpdates = Object.keys(updates).some((key) => key.startsWith('ipProxy'));
          const hasIpProxyEnabledUpdate = Object.prototype.hasOwnProperty.call(updates, 'ipProxyEnabled');
          const previousIpProxyEnabled = Boolean(currentState?.ipProxyEnabled);
          const nextIpProxyEnabled = hasIpProxyEnabledUpdate
            ? Boolean(updates.ipProxyEnabled)
            : previousIpProxyEnabled;
          // 仅在“手动开关代理”时自动应用。
          // 其他字段改动（host/账号/地区/session 等）需由“同步/下一条/检测出口/Change”显式触发。
          const shouldApplyIpProxyOnSave = hasIpProxyUpdates
            && hasIpProxyEnabledUpdate
            && previousIpProxyEnabled !== nextIpProxyEnabled;
          let proxyRouting = null;
          if (shouldApplyIpProxyOnSave && typeof applyIpProxySettingsFromState === 'function') {
            const isEnablingProxy = !previousIpProxyEnabled && nextIpProxyEnabled;
            proxyRouting = await applyIpProxySettingsFromState(mergedState, {
              // 手动开启时自动应用一次代理，不做出口探测；
              // 出口探测由“同步/检测出口”按钮显式触发，避免开启即误判为失败。
              skipExitProbe: true,
              resetNetworkState: false,
              forceAuthRebind: false,
              suppressAuthRebind: !isEnablingProxy,
            }).catch((error) => ({
              applied: false,
              reason: 'apply_failed',
              error: error?.message || String(error || '代理应用失败'),
            }));
          }
          if (Boolean(currentState?.contributionMode) && typeof setContributionMode === 'function') {
            await setContributionMode(true);
          }
          if (Object.keys(stateUpdates).length > 0 && typeof broadcastDataUpdate === 'function') {
            broadcastDataUpdate(stateUpdates);
          }
          if (modeChanged) {
            const selectedPlusPaymentMethod = getPlusPaymentMethodLabel(
              stateUpdates.plusPaymentMethod ?? currentState?.plusPaymentMethod ?? 'paypal'
            );
            await addLog(
              Boolean(updates.plusModeEnabled)
                ? `Plus 模式已开启，已切换为 Plus Checkout 步骤，当前支付方式：${selectedPlusPaymentMethod}。`
                : 'Plus 模式已关闭，已恢复普通注册授权步骤。',
              'info'
            );
          } else if (plusPaymentChanged && nextPlusModeEnabled) {
            const selectedPlusPaymentMethod = getPlusPaymentMethodLabel(
              stateUpdates.plusPaymentMethod ?? currentState?.plusPaymentMethod ?? 'paypal'
            );
            await addLog(`Plus 支付方式已切换为 ${selectedPlusPaymentMethod}，已更新对应的 Plus 步骤。`, 'info');
          }
          return { ok: true, state: await getState(), proxyRouting };
        }

        case 'REFRESH_GPC_CARD_BALANCE': {
          if (typeof refreshGpcCardBalance !== 'function') {
            throw new Error('GPC API Key 余额查询能力尚未接入。');
          }
          const state = await getState();
          const result = await refreshGpcCardBalance({
            ...(state || {}),
            ...(message.payload || {}),
          }, {
            reason: message.payload?.reason,
          });
          return { ok: true, ...result };
        }

        case 'RUN_IP_PROXY_AUTO_SYNC_NOW': {
          if (typeof runIpProxyAutoSync !== 'function') {
            throw new Error('IP 代理自动同步能力尚未接入。');
          }
          const result = await runIpProxyAutoSync('manual');
          return { ok: true, ...result };
        }

        case 'REFRESH_IP_PROXY_POOL': {
          if (typeof refreshIpProxyPool !== 'function') {
            throw new Error('IP 代理池能力尚未接入。');
          }
          const result = await refreshIpProxyPool({
            maxItems: message.payload?.maxItems,
            mode: message.payload?.mode,
            skipExitProbe: message.payload?.skipExitProbe,
          });
          return { ok: true, ...result };
        }

        case 'SWITCH_IP_PROXY': {
          if (typeof switchIpProxy !== 'function') {
            throw new Error('IP 代理切换能力尚未接入。');
          }
          const result = await switchIpProxy(message.payload?.direction || 'next', {
            maxItems: message.payload?.maxItems,
            mode: message.payload?.mode,
            forceRefresh: message.payload?.forceRefresh,
            skipExitProbe: message.payload?.skipExitProbe,
          });
          return { ok: true, ...result };
        }

        case 'CHANGE_IP_PROXY_EXIT': {
          if (typeof changeIpProxyExit !== 'function') {
            throw new Error('IP 代理 Change 能力尚未接入。');
          }
          const result = await changeIpProxyExit({
            mode: message.payload?.mode,
            skipExitProbe: message.payload?.skipExitProbe,
          });
          return { ok: true, ...result };
        }

        case 'PROBE_IP_PROXY_EXIT': {
          if (typeof probeIpProxyExit !== 'function') {
            throw new Error('IP 代理出口检测能力尚未接入。');
          }
          const probeState = await getState();
          const mode = typeof normalizeIpProxyMode === 'function'
            ? normalizeIpProxyMode(probeState?.ipProxyMode)
            : String(probeState?.ipProxyMode || 'account').trim().toLowerCase();
          const provider = typeof normalizeIpProxyProviderValue === 'function'
            ? normalizeIpProxyProviderValue(probeState?.ipProxyService)
            : String(probeState?.ipProxyService || '').trim().toLowerCase();
          const is711AccountMode = mode === 'account' && provider === '711proxy';
          const previousReason = String(probeState?.ipProxyAppliedReason || '').trim().toLowerCase();
          const previousExitError = String(probeState?.ipProxyAppliedExitError || '').trim();
          const hadMissingAuthChallenge = /challenge=0|provided=0|未触发代理鉴权挑战|未收到 407/i.test(previousExitError);
          const shouldPreRebindBeforeProbe = Boolean(
            probeState?.ipProxyEnabled
            && is711AccountMode
            && (hadMissingAuthChallenge || previousReason === 'connectivity_failed')
          );
          const timeoutMs = Number(message.payload?.timeoutMs) > 0
            ? Number(message.payload.timeoutMs)
            : (is711AccountMode ? (shouldPreRebindBeforeProbe ? 15000 : 12000) : undefined);

          // 手动“检测出口”前先轻量应用当前配置，避免读取到旧代理链路状态。
          if (probeState?.ipProxyEnabled && typeof applyIpProxySettingsFromState === 'function') {
            await applyIpProxySettingsFromState(probeState, {
              skipExitProbe: true,
              resetNetworkState: shouldPreRebindBeforeProbe,
              forceAuthRebind: shouldPreRebindBeforeProbe,
              suppressAuthRebind: !shouldPreRebindBeforeProbe,
            }).catch(() => null);
          }

          const result = await probeIpProxyExit({
            timeoutMs,
            authRebindMaxAttempts: is711AccountMode ? 1 : undefined,
          });
          return { ok: true, ...result };
        }

        case 'EXPORT_SETTINGS': {
          return { ok: true, ...(await exportSettingsBundle()) };
        }

        case 'IMPORT_SETTINGS': {
          const state = await importSettingsBundle(message.payload?.config || null);
          return { ok: true, state };
        }

        case 'UPSERT_HOTMAIL_ACCOUNT': {
          const account = await upsertHotmailAccount(message.payload || {});
          return { ok: true, account };
        }

        case 'UPSERT_PAYPAL_ACCOUNT': {
          const account = await upsertPayPalAccount(message.payload || {});
          return { ok: true, account };
        }

        case 'SELECT_PAYPAL_ACCOUNT': {
          const account = await setCurrentPayPalAccount(String(message.payload?.accountId || ''));
          return { ok: true, account };
        }

        case 'DELETE_HOTMAIL_ACCOUNT': {
          await deleteHotmailAccount(String(message.payload?.accountId || ''));
          return { ok: true };
        }

        case 'DELETE_HOTMAIL_ACCOUNTS': {
          const result = await deleteHotmailAccounts(String(message.payload?.mode || 'all'));
          return { ok: true, ...result };
        }

        case 'SELECT_HOTMAIL_ACCOUNT': {
          const account = await setCurrentHotmailAccount(String(message.payload?.accountId || ''), {
            markUsed: false,
            syncEmail: true,
          });
          return { ok: true, account };
        }

        case 'PATCH_HOTMAIL_ACCOUNT': {
          const account = await patchHotmailAccount(
            String(message.payload?.accountId || ''),
            message.payload?.updates || {}
          );
          return { ok: true, account };
        }

        case 'VERIFY_HOTMAIL_ACCOUNT':
        case 'AUTHORIZE_HOTMAIL_ACCOUNT': {
          const accountId = String(message.payload?.accountId || '');
          try {
            const result = await verifyHotmailAccount(accountId);
            await setCurrentHotmailAccount(result.account.id, { markUsed: false, syncEmail: true });
            await addLog(`Hotmail 账号 ${result.account.email} 校验通过，可直接用于收信。`, 'ok');
            return { ok: true, account: result.account, messageCount: result.messageCount };
          } catch (err) {
            const state = await getState();
            const accounts = normalizeHotmailAccounts(state.hotmailAccounts);
            const target = findHotmailAccount(accounts, accountId);
            if (target) {
              target.status = 'error';
              target.lastError = err.message;
              await syncHotmailAccounts(accounts.map((item) => (item.id === target.id ? target : item)));
            }
            throw err;
          }
        }

        case 'TEST_HOTMAIL_ACCOUNT': {
          const result = await testHotmailAccountMailAccess(String(message.payload?.accountId || ''));
          return { ok: true, ...result };
        }

        case 'UPSERT_MAIL2925_ACCOUNT': {
          const account = await upsertMail2925Account(message.payload || {});
          return { ok: true, account };
        }

        case 'DELETE_MAIL2925_ACCOUNT': {
          await deleteMail2925Account(String(message.payload?.accountId || ''));
          return { ok: true };
        }

        case 'DELETE_MAIL2925_ACCOUNTS': {
          const result = await deleteMail2925Accounts(String(message.payload?.mode || 'all'));
          return { ok: true, ...result };
        }

        case 'SELECT_MAIL2925_ACCOUNT': {
          const account = await setCurrentMail2925Account(String(message.payload?.accountId || ''), {
            updateLastUsedAt: false,
          });
          return { ok: true, account };
        }

        case 'PATCH_MAIL2925_ACCOUNT': {
          const account = await patchMail2925Account(
            String(message.payload?.accountId || ''),
            message.payload?.updates || {}
          );
          return { ok: true, account };
        }

        case 'LOGIN_MAIL2925_ACCOUNT': {
          const accountId = String(message.payload?.accountId || '');
          const account = await setCurrentMail2925Account(accountId, {
            updateLastUsedAt: false,
          });
          if (typeof deps.ensureMail2925MailboxSession !== 'function') {
            throw new Error('2925 登录能力尚未接入。');
          }
          await deps.ensureMail2925MailboxSession({
            accountId: account.id,
            forceRelogin: Boolean(message.payload?.forceRelogin),
            actionLabel: '侧边栏手动登录 2925 账号',
          });
          return { ok: true, account };
        }

        case 'LIST_LUCKMAIL_PURCHASES': {
          const purchases = await listLuckmailPurchasesForManagement();
          return { ok: true, purchases };
        }

        case 'SELECT_LUCKMAIL_PURCHASE': {
          const purchase = await selectLuckmailPurchase(message.payload?.purchaseId);
          return { ok: true, purchase };
        }

        case 'SET_LUCKMAIL_PURCHASE_USED_STATE': {
          const result = await setLuckmailPurchaseUsedState(message.payload?.purchaseId, Boolean(message.payload?.used));
          return { ok: true, ...result };
        }

        case 'SET_LUCKMAIL_PURCHASE_PRESERVED_STATE': {
          const purchase = await setLuckmailPurchasePreservedState(message.payload?.purchaseId, Boolean(message.payload?.preserved));
          return { ok: true, purchase };
        }

        case 'SET_LUCKMAIL_PURCHASE_DISABLED_STATE': {
          const purchase = await setLuckmailPurchaseDisabledState(message.payload?.purchaseId, Boolean(message.payload?.disabled));
          return { ok: true, purchase };
        }

        case 'BATCH_UPDATE_LUCKMAIL_PURCHASES': {
          const result = await batchUpdateLuckmailPurchases(message.payload || {});
          return { ok: true, ...result };
        }

        case 'DISABLE_USED_LUCKMAIL_PURCHASES': {
          const result = await disableUsedLuckmailPurchases();
          return { ok: true, ...result };
        }

        case 'SET_EMAIL_STATE': {
          const state = await getState();
          if (isAutoRunLockedState(state)) {
            throw new Error('自动流程运行中，当前不能手动修改邮箱。');
          }
          const email = String(message.payload?.email || '').trim() || null;
          await setEmailStateSilently(email);
          return { ok: true, email };
        }

        case 'SAVE_EMAIL': {
          const state = await getState();
          if (isAutoRunLockedState(state)) {
            throw new Error('自动流程运行中，当前不能手动修改邮箱。');
          }
          await setEmailState(message.payload.email);
          await resumeAutoRun();
          return { ok: true, email: message.payload.email };
        }

        case 'SET_SIGNUP_PHONE_STATE': {
          const state = await getState();
          if (isAutoRunLockedState(state)) {
            throw new Error('自动流程运行中，当前不能手动修改注册手机号。');
          }
          const phoneNumber = resolveSignupPhonePayload(message.payload) || null;
          await setSignupPhoneStateSilently(phoneNumber);
          return { ok: true, phoneNumber };
        }

        case 'SAVE_SIGNUP_PHONE': {
          const state = await getState();
          if (isAutoRunLockedState(state)) {
            throw new Error('自动流程运行中，当前不能手动修改注册手机号。');
          }
          const phoneNumber = resolveSignupPhonePayload(message.payload) || null;
          await setSignupPhoneState(phoneNumber);
          return { ok: true, phoneNumber };
        }

        case 'FETCH_GENERATED_EMAIL': {
          clearStopRequest();
          const state = await getState();
          if (isAutoRunLockedState(state)) {
            throw new Error('自动流程运行中，当前不能手动获取邮箱。');
          }
          const email = await fetchGeneratedEmail(state, message.payload || {});
          await resumeAutoRun();
          return { ok: true, email };
        }

        case 'FETCH_DUCK_EMAIL': {
          clearStopRequest();
          const state = await getState();
          if (isAutoRunLockedState(state)) {
            throw new Error('自动流程运行中，当前不能手动获取邮箱。');
          }
          const email = await fetchGeneratedEmail(state, { ...(message.payload || {}), generator: 'duck' });
          await resumeAutoRun();
          return { ok: true, email };
        }

        case 'CHECK_ICLOUD_SESSION': {
          clearStopRequest();
          return await checkIcloudSession();
        }

        case 'LIST_ICLOUD_ALIASES': {
          clearStopRequest();
          const aliases = await listIcloudAliases();
          return { ok: true, aliases };
        }

        case 'SET_ICLOUD_ALIAS_USED_STATE': {
          clearStopRequest();
          const result = await setIcloudAliasUsedState(message.payload || {});
          return { ok: true, ...result };
        }

        case 'SET_ICLOUD_ALIAS_PRESERVED_STATE': {
          clearStopRequest();
          const result = await setIcloudAliasPreservedState(message.payload || {});
          return { ok: true, ...result };
        }

        case 'DELETE_ICLOUD_ALIAS': {
          clearStopRequest();
          const result = await deleteIcloudAlias(message.payload || {});
          return { ok: true, ...result };
        }

        case 'DELETE_USED_ICLOUD_ALIASES': {
          clearStopRequest();
          const result = await deleteUsedIcloudAliases();
          return { ok: true, ...result };
        }

        case 'STOP_FLOW': {
          await requestStop();
          return { ok: true };
        }

        default:
          console.warn('Unknown message type:', message.type);
          return { error: `Unknown message type: ${message.type}` };
      }
    }

    return {
      handleMessage,
      handleStepData,
    };
  }

  return {
    createMessageRouter,
  };
});
