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
      checkIcloudSession,
      clearAccountRunHistory,
      deleteAccountRunHistoryRecords,
      clearAutoRunTimerAlarm,
      clearFreeReusablePhoneActivation,
      clearGrokSsoCookies,
      clearLuckmailRuntimeState,
      clearYydsMailRuntimeState,
      clearStopRequest,
      closeLocalhostCallbackTabs,
      closeTabsByUrlPrefix,
      completeNodeFromBackground,
      deleteHotmailAccount,
      deleteHotmailAccounts,
      deleteIcloudAlias,
      deleteUsedIcloudAliases,
      disableUsedLuckmailPurchases,
      doesNodeUseCompletionSignal,
      ensureMail2925MailboxSession,
      ensureManualInteractionAllowed,
      assertNodeExecutionAllowedForState,
      executeNode,
      executeNodeViaCompletionSignal,
      exportSettingsBundle,
      fetchGeneratedEmail,
      refreshGpcCardBalance,
      testKiroRsConnection,
      finalizePhoneActivationAfterSuccessfulFlow,
      finalizeStep3Completion,
      finalizeStep5Completion = null,
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
      getNodeDefinitionForState,
      getNodeIdsForState,
      getStepIdByNodeIdForState,
      getStepDefinitionForState,
      getStepIdsForState,
      getLastStepIdForState,
      normalizeSignupMethod = (value = '') => String(value || '').trim().toLowerCase() === 'phone' ? 'phone' : 'email',
      canUsePhoneSignup = (state = {}) => {
        const rootScope = typeof self !== 'undefined' ? self : globalThis;
        const capabilityRegistry = rootScope.MultiPageFlowCapabilities?.createFlowCapabilityRegistry?.({
          defaultFlowId: 'openai',
        }) || null;
        if (capabilityRegistry?.canUsePhoneSignup) {
          return capabilityRegistry.canUsePhoneSignup(state);
        }
        return Boolean(state?.phoneVerificationEnabled)
          && !Boolean(state?.plusModeEnabled)
          && !Boolean(state?.accountContributionEnabled);
      },
      resolveSignupMethod = (state = {}) => {
        const method = normalizeSignupMethod(state?.signupMethod);
        const rootScope = typeof self !== 'undefined' ? self : globalThis;
        const capabilityRegistry = rootScope.MultiPageFlowCapabilities?.createFlowCapabilityRegistry?.({
          defaultFlowId: 'openai',
        }) || null;
        if (capabilityRegistry?.resolveSignupMethod) {
          return capabilityRegistry.resolveSignupMethod(state, method);
        }
        return method === 'phone' && canUsePhoneSignup(state) ? 'phone' : 'email';
      },
      validateAutoRunStart = (state = {}, options = {}) => {
        const validationState = options?.state || state;
        const rootScope = typeof self !== 'undefined' ? self : globalThis;
        const capabilityRegistry = rootScope.MultiPageFlowCapabilities?.createFlowCapabilityRegistry?.({
          defaultFlowId: 'openai',
        }) || null;
        if (!capabilityRegistry?.validateAutoRunStart) {
          return { ok: true, errors: [] };
        }
        return capabilityRegistry.validateAutoRunStart({
          activeFlowId: options?.activeFlowId ?? validationState?.activeFlowId,
          targetId: options?.targetId ?? validationState?.targetId,
          signupMethod: options?.signupMethod ?? validationState?.signupMethod,
          state: validationState,
        });
      },
      validateModeSwitch = (state = {}, options = {}) => {
        const validationState = options?.state || state;
        const rootScope = typeof self !== 'undefined' ? self : globalThis;
        const capabilityRegistry = rootScope.MultiPageFlowCapabilities?.createFlowCapabilityRegistry?.({
          defaultFlowId: 'openai',
        }) || null;
        if (!capabilityRegistry?.validateModeSwitch) {
          return {
            ok: true,
            changedKeys: Array.isArray(options?.changedKeys) ? options.changedKeys : [],
            errors: [],
            normalizedUpdates: {},
          };
        }
        return capabilityRegistry.validateModeSwitch({
          activeFlowId: options?.activeFlowId ?? validationState?.activeFlowId,
          changedKeys: options?.changedKeys,
          targetId: options?.targetId ?? validationState?.targetId,
          signupMethod: options?.signupMethod ?? validationState?.signupMethod,
          state: validationState,
        });
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
      isYydsMailProvider = () => false,
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
      notifyNodeComplete,
      notifyNodeError,
      patchMail2925Account,
      patchHotmailAccount,
      pollContributionStatus,
      submitFlowContribution,
      registerTab,
      requestStop,
      probeIpProxyExit,
      handleCloudflareSecurityBlocked,
      resetState,
      resumeAutoRun,
      selectLuckmailPurchase,
      switchIpProxy,
      changeIpProxyExit,
      setCurrentPayPalAccount,
      setCurrentMail2925Account,
      setCurrentHotmailAccount,
      setAccountContributionMode,
      setEmailState,
      setEmailStateSilently,
      persistRegistrationEmailState,
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
      setNodeStatus,
      skipAutoRunCountdown,
      skipNode,
      startFlowContribution,
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

    function normalizeMessageFlowId(value = '', fallback = 'openai') {
      const rootScope = typeof self !== 'undefined' ? self : globalThis;
      if (typeof rootScope.MultiPageFlowRegistry?.normalizeFlowId === 'function') {
        return rootScope.MultiPageFlowRegistry.normalizeFlowId(value, fallback);
      }
      const fallbackFlowId = String(fallback || 'openai').trim().toLowerCase() || 'openai';
      const normalized = String(value || '').trim().toLowerCase();
      if (!normalized || normalized === 'codex') {
        return fallbackFlowId;
      }
      return normalized;
    }

    function normalizeMessageTargetId(flowId, targetId = '', fallback = '') {
      const rootScope = typeof self !== 'undefined' ? self : globalThis;
      if (typeof rootScope.MultiPageFlowRegistry?.normalizeTargetId === 'function') {
        return rootScope.MultiPageFlowRegistry.normalizeTargetId(flowId, targetId, fallback);
      }
      const fallbackSourceId = String(
        fallback || (normalizeMessageFlowId(flowId) === 'kiro' ? 'kiro-rs' : 'cpa')
      ).trim().toLowerCase();
      return String(targetId || fallbackSourceId).trim().toLowerCase() || fallbackSourceId;
    }

    function buildAutoRunFlowStateUpdates(payload = {}) {
      const hasActiveFlowId = Object.prototype.hasOwnProperty.call(payload, 'activeFlowId');
      const hasTargetId = Object.prototype.hasOwnProperty.call(payload, 'targetId');
      if (!hasActiveFlowId && !hasTargetId) {
        return {};
      }
      const activeFlowId = normalizeMessageFlowId(payload.activeFlowId, 'openai');
      const updates = {
        activeFlowId,
        flowId: activeFlowId,
      };
      if (hasTargetId) {
        updates.targetId = normalizeMessageTargetId(
          activeFlowId,
          payload.targetId,
          activeFlowId === 'kiro' ? 'kiro-rs' : 'cpa'
        );
      }
      return updates;
    }

    function preserveKeyFromState(updates, currentState, key) {
      if (!Object.prototype.hasOwnProperty.call(updates, key)) {
        return;
      }
      if (currentState?.[key] !== undefined) {
        updates[key] = currentState[key];
      } else {
        delete updates[key];
      }
    }

    function preservePhoneReuseSettingsForPhoneSignup(updates, currentState = {}) {
      if (!updates || typeof updates !== 'object') {
        return;
      }

      if (
        Object.prototype.hasOwnProperty.call(updates, 'phoneSmsReuseEnabled')
        || Object.prototype.hasOwnProperty.call(updates, 'heroSmsReuseEnabled')
      ) {
        const currentReuseEnabled = currentState?.phoneSmsReuseEnabled ?? currentState?.heroSmsReuseEnabled;
        if (currentReuseEnabled !== undefined) {
          const normalizedReuseEnabled = Boolean(currentReuseEnabled);
          updates.phoneSmsReuseEnabled = normalizedReuseEnabled;
          updates.heroSmsReuseEnabled = normalizedReuseEnabled;
        } else {
          delete updates.phoneSmsReuseEnabled;
          delete updates.heroSmsReuseEnabled;
        }
      }

      preserveKeyFromState(updates, currentState, 'freePhoneReuseEnabled');
      preserveKeyFromState(updates, currentState, 'freePhoneReuseAutoEnabled');
      preserveKeyFromState(updates, currentState, 'phonePreferredActivation');
    }

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

    const DEFAULT_OPENAI_NODE_BY_STEP = Object.freeze({
      1: 'open-chatgpt',
      2: 'submit-signup-email',
      3: 'fill-password',
      4: 'fetch-signup-code',
      5: 'fill-profile',
      6: 'wait-registration-success',
      7: 'oauth-login',
      8: 'fetch-login-code',
      9: 'post-login-phone-verification',
      10: 'confirm-oauth',
      11: 'fetch-login-code',
      12: 'post-login-phone-verification',
      13: 'confirm-oauth',
      14: 'platform-verify',
      15: 'platform-verify',
      16: 'confirm-oauth',
      17: 'platform-verify',
    });

    function getStepKeyForState(step, state = {}) {
      if (typeof getStepDefinitionForState === 'function') {
        return String(getStepDefinitionForState(step, state)?.key || '').trim();
      }
      return DEFAULT_OPENAI_NODE_BY_STEP[Number(step)] || '';
    }

    function findStepByNodeId(nodeId, state = {}) {
      const normalizedNodeId = String(nodeId || '').trim();
      if (normalizedNodeId && typeof getStepIdByNodeIdForState === 'function') {
        const step = getStepIdByNodeIdForState(normalizedNodeId, state);
        if (Number.isInteger(step) && step > 0) {
          return step;
        }
      }
      if (!normalizedNodeId || typeof getStepIdsForState !== 'function') {
        return 0;
      }
      for (const stepId of getStepIdsForState(state)) {
        if (getStepKeyForState(stepId, state) === normalizedNodeId) {
          return Number(stepId) || 0;
        }
      }
      return 0;
    }

    async function normalizeNodeProtocolMessage(message = {}) {
      const type = String(message?.type || '').trim();
      const nodeProtocolTypes = new Set([
        'EXECUTE_NODE',
        'NODE_COMPLETE',
        'NODE_ERROR',
        'SKIP_NODE',
      ]);
      if (!nodeProtocolTypes.has(type)) {
        return message;
      }

      const nodeId = String(message?.payload?.nodeId || message?.nodeId || '').trim();
      if (!nodeId) {
        throw new Error(`${type} missing nodeId.`);
      }
      const state = await getState();
      const step = findStepByNodeId(nodeId, state);
      if (!step) {
        throw new Error(`Node not found in current flow: ${nodeId}`);
      }

      const payload = {
        ...(message.payload || {}),
        nodeId,
        step,
      };
      return { ...message, nodeId, step, payload };
    }

    function isStaleAutoRunNodeMessage(nodeId, state = {}) {
      const normalizedNodeId = String(nodeId || '').trim();
      if (!normalizedNodeId) {
        return false;
      }
      if (typeof isAutoRunLockedState !== 'function' || !isAutoRunLockedState(state)) {
        return false;
      }
      const currentStatus = String(state?.nodeStatuses?.[normalizedNodeId] || '').trim();
      if (currentStatus === 'running') {
        return false;
      }
      const currentNodeId = String(state?.currentNodeId || '').trim();
      if (currentNodeId && normalizedNodeId !== currentNodeId) {
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

    function hasPhoneSignupIdentity(state = {}) {
      const identifierType = String(state?.accountIdentifierType || '').trim().toLowerCase();
      return Boolean(
        String(state?.signupPhoneNumber || '').trim()
        || (identifierType === 'phone' && String(state?.accountIdentifier || '').trim())
        || state?.signupPhoneActivation
        || state?.signupPhoneCompletedActivation
      );
    }

    function shouldPreservePhoneIdentityForEmailPayload(payload = {}, state = {}) {
      const identifierType = String(payload?.accountIdentifierType || '').trim().toLowerCase();
      if (identifierType === 'email') {
        return false;
      }
      return hasPhoneSignupIdentity(state);
    }

    async function persistEmailIdentityFromStepPayload(email, payload = {}, source = 'step_payload') {
      if (!email) {
        return;
      }
      const state = await getState();
      const preserveAccountIdentity = shouldPreservePhoneIdentityForEmailPayload(payload, state);
      if (preserveAccountIdentity && typeof persistRegistrationEmailState === 'function') {
        await persistRegistrationEmailState(state, email, {
          source,
          preserveAccountIdentity: true,
        });
        return;
      }
      await setEmailState(email, preserveAccountIdentity
        ? { source, preserveAccountIdentity: true }
        : { source });
    }

    function normalizeAutomationWindowId(value) {
      if (value === null || value === undefined || value === '') {
        return null;
      }
      const numeric = Number(value);
      return Number.isInteger(numeric) && numeric >= 0 ? numeric : null;
    }

    function resolveAutomationWindowIdFromMessage(message = {}, sender = {}) {
      return normalizeAutomationWindowId(
        message?.payload?.automationWindowId
        ?? message?.payload?.windowId
        ?? message?.automationWindowId
        ?? message?.windowId
        ?? sender?.tab?.windowId
        ?? null
      );
    }

    async function lockAutomationWindowFromMessage(message = {}, sender = {}) {
      const windowId = resolveAutomationWindowIdFromMessage(message, sender);
      if (windowId === null) {
        return null;
      }
      await setState({ automationWindowId: windowId });
      return windowId;
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
          await persistEmailIdentityFromStepPayload(email, payload, 'step_identity');
        }
        if (email) {
          return;
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

    function findStepByKeyAfter(currentOrder, targetKey, state = {}) {
      const activeStepIds = typeof getStepIdsForState === 'function'
        ? getStepIdsForState(state)
        : [];
      const candidates = activeStepIds.length ? activeStepIds : [Number(currentOrder) + 1, 8];
      return candidates.find((stepId) => {
        const numericStep = Number(stepId);
        if (!Number.isFinite(numericStep) || numericStep <= Number(currentOrder)) {
          return false;
        }
        const stepKey = getStepKeyForState(numericStep, state);
        if (stepKey) {
          return stepKey === targetKey;
        }
        return targetKey === 'fetch-login-code' && Number(currentOrder) === 7 && numericStep === 8;
      }) || null;
    }

    function getNodeStatusByStep(step, state = {}) {
      const nodeId = getStepKeyForState(step, state);
      return nodeId ? (state.nodeStatuses?.[nodeId] || 'pending') : 'pending';
    }

    async function setNodeStatusByStep(step, status, state = {}) {
      const nodeId = getStepKeyForState(step, state);
      if (!nodeId) {
        throw new Error(`Step ${step} has no matching node.`);
      }
      await setNodeStatus(nodeId, status);
      return nodeId;
    }

    function normalizePlusPaymentMethodForDisplay(value = '') {
      const normalized = String(value || '').trim().toLowerCase();
      if (normalized === 'none' || normalized === 'no-payment' || normalized === 'skip-payment') {
        return 'none';
      }
      if (normalized === 'paypal-hosted' || normalized === 'paypal_direct' || normalized === 'paypal-direct') {
        return 'paypal-hosted';
      }
      if (normalized === 'gpc-helper') {
        return 'gpc-helper';
      }
      return normalized === 'gopay' ? 'gopay' : 'paypal';
    }

    function getPlusPaymentMethodLabel(value = '') {
      const method = normalizePlusPaymentMethodForDisplay(value);
      if (method === 'none') {
        return 'No payment';
      }
      if (method === 'paypal-hosted') {
        return 'PayPal cardless direct bind';
      }
      if (method === 'gpc-helper') {
        return 'GPC';
      }
      return method === 'gopay' ? 'GoPay' : 'PayPal';
    }

    function normalizePlusAccountAccessStrategyForDisplay(value = '') {
      const normalized = String(value || '').trim().toLowerCase();
      if (normalized === 'sub2api_codex_session') {
        return 'sub2api_codex_session';
      }
      if (normalized === 'cpa_codex_session') {
        return 'cpa_codex_session';
      }
      return 'oauth';
    }

    function getPlusAccountAccessStrategyLabel(value = '') {
      return normalizePlusAccountAccessStrategyForDisplay(value) === 'sub2api_codex_session'
        ? 'Import current ChatGPT session into SUB2API'
        : 'OAuth';
    }

    function getPlusAccountAccessStrategyLabel(value = '', targetId = '') {
      const strategy = normalizePlusAccountAccessStrategyForDisplay(value);
      const normalizedTargetId = String(targetId || '').trim().toLowerCase();
      if (strategy === 'sub2api_codex_session') {
        return 'Import current ChatGPT session into SUB2API';
      }
      if (strategy === 'cpa_codex_session') {
        return 'Import current ChatGPT session into CPA';
      }
      if (normalizedTargetId === 'cpa') {
        return 'Create CPA account via OAuth callback';
      }
      if (normalizedTargetId === 'sub2api') {
        return 'Create SUB2API account via OAuth callback';
      }
      if (normalizedTargetId === 'codex2api') {
        return 'Create Codex2API account via OAuth callback';
      }
      return 'OAuth';
    }

    async function handlePlatformVerifyStepData(payload) {
      if (payload.localhostUrl) {
        await closeLocalhostCallbackTabs(payload.localhostUrl);
      }
      const latestState = await getState();
      if (typeof markCurrentRegistrationAccountUsed === 'function') {
        await markCurrentRegistrationAccountUsed(latestState, {
          logPrefix: 'Flow completed',
          level: 'ok',
        });
      } else if (latestState.currentHotmailAccountId && isHotmailProvider(latestState)) {
        await patchHotmailAccount(latestState.currentHotmailAccountId, {
          used: true,
          lastUsedAt: Date.now(),
        });
        await addLog('Current Hotmail account automatically marked as used.', 'ok');
      }
      if (typeof markCurrentRegistrationAccountUsed !== 'function' && String(latestState.mailProvider || '').trim().toLowerCase() === '2925' && latestState.currentMail2925AccountId) {
        await patchMail2925Account(latestState.currentMail2925AccountId, {
          lastUsedAt: Date.now(),
          lastError: '',
        });
        await addLog('Current 2925 account: last used time recorded.', 'ok');
      }
      if (typeof markCurrentRegistrationAccountUsed !== 'function' && isLuckmailProvider(latestState)) {
        const currentPurchase = getCurrentLuckmailPurchase(latestState);
        if (currentPurchase?.id) {
          await setLuckmailPurchaseUsedState(currentPurchase.id, true);
          await addLog(`Current LuckMail email ${currentPurchase.email_address} marked as used locally.`, 'ok');
        }
        await clearLuckmailRuntimeState({ clearEmail: true });
        await addLog('Current LuckMail email runtime state cleared. Next round will prefer reusing unused emails or purchasing new ones.', 'ok');
      }
      if (
        typeof markCurrentRegistrationAccountUsed !== 'function'
        && isYydsMailProvider(latestState)
        && typeof clearYydsMailRuntimeState === 'function'
      ) {
        await clearYydsMailRuntimeState({ clearEmail: true });
        await addLog('Current YYDS Mail runtime state cleared. Next round will create new mailbox.', 'ok');
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
        if (payload.sub2apiGroupIds !== undefined) updates.sub2apiGroupIds = Array.isArray(payload.sub2apiGroupIds)
          ? payload.sub2apiGroupIds
          : [];
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

      if (stepKey === 'oauth-login' || stepKey === 'relogin-bound-email') {
        if (stepKey === 'oauth-login') {
          await syncStepAccountIdentityFromPayload(payload);
        }
        if (payload.skipLoginVerificationStep) {
          await setState({ loginVerificationRequestedAt: null });
          const latestState = await getState();
          const loginCodeStep = findStepByKeyAfter(
            step,
            stepKey === 'relogin-bound-email' ? 'fetch-bound-email-login-code' : 'fetch-login-code',
            latestState
          );
          if (loginCodeStep) {
            const currentStatus = getNodeStatusByStep(loginCodeStep, latestState);
            if (!isStepProtectedFromAutoSkip(currentStatus)) {
              await setNodeStatusByStep(loginCodeStep, 'skipped', latestState);
              await addLog(`Auth page directly entered OAuth consent page — auto-skipped Step ${loginCodeStep} login verification code.`, 'warn', {
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

      if (stepKey === 'fetch-login-code' || stepKey === 'fetch-bound-email-login-code') {
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

      if (stepKey === 'post-login-phone-verification' || stepKey === 'post-bound-email-phone-verification') {
        await setState({
          currentPhoneVerificationCode: '',
          signupPhoneVerificationRequestedAt: null,
          signupPhoneVerificationPurpose: '',
        });
        return;
      }

      if (stepKey === 'bind-email') {
        const updates = {};
        if (payload.bindEmailSubmitted !== undefined) {
          updates.bindEmailSubmitted = Boolean(payload.bindEmailSubmitted);
        }
        if (payload.email !== undefined) {
          updates.email = payload.email || null;
        }
        if (payload.step8VerificationTargetEmail !== undefined) {
          updates.step8VerificationTargetEmail = payload.step8VerificationTargetEmail || '';
        }
        if (Object.keys(updates).length) {
          await setState(updates);
        }
        return;
      }

      if (stepKey === 'fetch-bind-email-code') {
        await setState({
          lastEmailTimestamp: payload.emailTimestamp || null,
          loginVerificationRequestedAt: null,
          step8VerificationTargetEmail: '',
          bindEmailSubmitted: false,
        });
        return;
      }

      if (stepKey === 'confirm-oauth') {
        if (payload.localhostUrl) {
          if (!isLocalhostOAuthCallbackUrl(payload.localhostUrl)) {
            throw new Error(`Step ${step} returned invalid localhost OAuth callback URL.`);
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
            for (const skippedStep of [3, 4, 5]) {
              const status = getNodeStatusByStep(skippedStep, latestState);
              if (status === 'running' || status === 'completed' || status === 'manual_completed') {
                continue;
              }
              await setNodeStatusByStep(skippedStep, 'skipped', latestState);
            }
            await addLog('Step 2: Existing logged-in session detected — auto-skipped Steps 3/4/5, flow will go directly to Step 6.', 'warn');
            break;
          }
          if (payload.skippedPasswordStep) {
            const latestState = await getState();
            const step3Status = getNodeStatusByStep(3, latestState);
            if (step3Status !== 'running' && step3Status !== 'completed' && step3Status !== 'manual_completed') {
              await setNodeStatusByStep(3, 'skipped', latestState);
              const identityLabel = payload.accountIdentifierType === 'phone' ? 'phone number' : 'email';
              await addLog(`Step 2: After submitting ${identityLabel}, page went directly to verification code page — auto-skipped Step 3.`, 'warn');
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
            const step5Status = getNodeStatusByStep(5, latestState);
            if (step5Status !== 'running' && step5Status !== 'completed' && step5Status !== 'manual_completed') {
              await setNodeStatusByStep(5, 'skipped', latestState);
              await addLog('Step 3: Page directly entered logged-in state — auto-skipped Step 5.', 'warn');
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
            const step5Status = getNodeStatusByStep(5, latestState);
            if (step5Status !== 'running' && step5Status !== 'completed' && step5Status !== 'manual_completed') {
              await setNodeStatusByStep(5, 'skipped', latestState);
              if (payload.skipProfileStepReason === 'combined_verification_profile') {
                await addLog('Step 4: Current verification code page embedded registration profile submission — auto-skipped Step 5.', 'warn');
              } else {
                await addLog('Step 4: Account directly entered logged-in state — auto-skipped Step 5.', 'warn');
              }
            }
          }
          break;
        case 7:
          await syncStepAccountIdentityFromPayload(payload);
          if (payload.loginVerificationRequestedAt) {
            await setState({ loginVerificationRequestedAt: payload.loginVerificationRequestedAt });
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
              throw new Error('Step 9 returned invalid localhost OAuth callback URL.');
            }
            await setState({ localhostUrl: payload.localhostUrl });
            broadcastDataUpdate({ localhostUrl: payload.localhostUrl });
          }
          break;
        default:
          break;
      }
    }

    async function handleMessage(rawMessage, sender) {
      const message = await normalizeNodeProtocolMessage(rawMessage);
      switch (message.type) {
        case 'CONTENT_SCRIPT_READY': {
          const tabId = sender.tab?.id;
          if (tabId && message.source) {
            await registerTab(message.source, tabId);
            flushCommand(message.source, tabId);
            await addLog(`Content script ready: ${getSourceLabel(message.source)} (tab ${tabId})`);
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

        case 'NODE_COMPLETE': {
          const currentStateForNode = await getState();
          const nodeId = String(message.nodeId || message.payload?.nodeId || '').trim();
          const resolvedStep = findStepByNodeId(nodeId, currentStateForNode);
          if (!nodeId || !resolvedStep) {
            throw new Error('NODE_COMPLETE missing nodeId.');
          }
          const currentState = await getState();
          if (isStaleAutoRunNodeMessage(nodeId, currentState)) {
            await addLog(
              `Auto-run: Ignoring stale completion message for node ${nodeId}, current flow already at node ${currentState.currentNodeId || 'unknown'}.`,
              'warn',
              { nodeId }
            );
            return { ok: true, ignored: true };
          }
          if (getStopRequested()) {
            await setNodeStatus(nodeId, 'stopped');
            await appendManualAccountRunRecordIfNeeded(`node:${nodeId}:stopped`, null, 'Flow stopped by user.');
            notifyNodeError(nodeId, 'Flow stopped by user.');
            return { ok: true };
          }
          try {
            if (nodeId === 'fill-password' && typeof finalizeStep3Completion === 'function') {
              await finalizeStep3Completion(message.payload || {});
            }
          } catch (error) {
            if (typeof isCloudflareSecurityBlockedError === 'function' && isCloudflareSecurityBlockedError(error)) {
              const userMessage = typeof handleCloudflareSecurityBlocked === 'function'
                ? await handleCloudflareSecurityBlocked(error)
                : (error?.message || String(error || ''));
              notifyNodeError(nodeId, 'Flow stopped by user.');
              return { ok: true, error: userMessage };
            }
            const errorMessage = error?.message || String(error || 'Step 3 post-submit confirmation failed');
            await setNodeStatus(nodeId, 'failed');
            await addLog(`Failed: ${errorMessage}`, 'error', {
              nodeId,
            });
            await appendManualAccountRunRecordIfNeeded(`node:${nodeId}:failed`, null, errorMessage);
            notifyNodeError(nodeId, errorMessage);
            return { ok: true, error: errorMessage };
          }

          const deferCompletionUntilBackgroundValidation = nodeId === 'fill-profile';
          const completionStateCandidate = await getState();
          const nodeIds = typeof getNodeIdsForState === 'function' ? getNodeIdsForState(completionStateCandidate) : [];
          const lastNodeId = nodeIds[nodeIds.length - 1] || '';
          const isFinalNode = nodeId === lastNodeId;
          const completionState = isFinalNode ? completionStateCandidate : null;
          if (!deferCompletionUntilBackgroundValidation) {
            await setNodeStatus(nodeId, 'completed');
            await addLog('Completed', 'ok', { nodeId });
          } else {
            await addLog('Step 5: Profile page completion signal received — waiting for background final review before marking as complete.', 'info', {
              step: 5,
              stepKey: nodeId,
            });
          }
          await handleStepData(resolvedStep, message.payload);
          if (isFinalNode && typeof appendAccountRunRecord === 'function') {
            await appendAccountRunRecord('success', completionState);
          }
          notifyNodeComplete(nodeId, message.payload);
          return { ok: true };
        }

        case 'NODE_ERROR': {
          const stateForNode = await getState();
          const nodeId = String(message.nodeId || message.payload?.nodeId || '').trim();
          const resolvedStep = findStepByNodeId(nodeId, stateForNode);
          if (!nodeId || !resolvedStep) {
            throw new Error('NODE_ERROR missing nodeId.');
          }
          const staleCheckState = await getState();
          if (isStaleAutoRunNodeMessage(nodeId, staleCheckState)) {
            await addLog(
              `Auto-run: Ignoring stale failure message for node ${nodeId}, current flow already at node ${staleCheckState.currentNodeId || 'unknown'}. Original error: ${message.error || 'unknown error'}`,
              'warn',
              { nodeId }
            );
            return { ok: true, ignored: true };
          }
          if (typeof isCloudflareSecurityBlockedError === 'function' && isCloudflareSecurityBlockedError(message.error)) {
            const userMessage = typeof handleCloudflareSecurityBlocked === 'function'
              ? await handleCloudflareSecurityBlocked(message.error)
              : (typeof message.error === 'string' ? message.error : String(message.error || ''));
            notifyNodeError(nodeId, 'Flow stopped by user.');
            return { ok: true, error: userMessage };
          }
          const currentState = await getState();
          const currentNodeStatus = currentState?.nodeStatuses?.[nodeId] || '';
          const isSignupPhonePasswordMismatch = /SIGNUP_PHONE_PASSWORD_MISMATCH::/i.test(String(message.error || ''));
          if (isStopError(message.error)) {
            await setNodeStatus(nodeId, 'stopped');
            await addLog('Stopped by user', 'warn', { nodeId });
            await appendManualAccountRunRecordIfNeeded(`node:${nodeId}:stopped`, null, message.error);
            notifyNodeError(nodeId, message.error);
          } else {
            if (!(isSignupPhonePasswordMismatch && currentNodeStatus === 'failed')) {
              await setNodeStatus(nodeId, 'failed');
              await addLog(`Failed: ${message.error}`, 'error', {
                nodeId,
              });
              await appendManualAccountRunRecordIfNeeded(`node:${nodeId}:failed`, null, message.error);
            }
            notifyNodeError(nodeId, message.error);
          }
          return { ok: true };
        }

        case 'RESOLVE_PLUS_MANUAL_CONFIRMATION': {
          const currentState = await getState();
          const step = Number(message.payload?.step) || Number(currentState?.plusManualConfirmationStep) || 0;
          const confirmationNodeId = getStepKeyForState(step, currentState) || String(currentState?.currentNodeId || '').trim();
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
              throw new Error('Please enter the GPC OTP verification code.');
            }
            const otpUpdates = {
              ...clearManualConfirmationState,
              gopayHelperResolvedOtp: otp,
            };
            await setState(otpUpdates);
            if (typeof broadcastDataUpdate === 'function') {
              broadcastDataUpdate(otpUpdates);
            }
            await addLog(`Step ${step}: Received GPC OTP, ready to submit verification.`, 'ok');
            return { ok: true };
          }

          await setState(clearManualConfirmationState);
          if (typeof broadcastDataUpdate === 'function') {
            broadcastDataUpdate(clearManualConfirmationState);
          }

          if (confirmed) {
            const methodLabel = method === 'gopay' ? 'GoPay' : 'Manual';
            await addLog(`Step ${step}: Confirmed ${methodLabel} subscription complete, ready to continue.`, 'ok');
            await completeNodeFromBackground(confirmationNodeId, {
              plusManualConfirmationMethod: currentState?.plusManualConfirmationMethod || '',
              plusManualConfirmedAt: Date.now(),
            });
            return { ok: true };
          }

          const cancelMessage = method === 'gopay'
            ? 'GoPay subscription confirmation cancelled'
            : (isGpcOtp ? 'GPC OTP input cancelled' : 'Current manual confirmation cancelled');
          await setNodeStatus(confirmationNodeId, 'failed');
          await addLog(`Step ${step}: ${cancelMessage}.`, 'warn');
          await appendManualAccountRunRecordIfNeeded(
            confirmationNodeId ? `node:${confirmationNodeId}:failed` : 'failed',
            null,
            cancelMessage
          );
          notifyNodeError(confirmationNodeId, cancelMessage);
          return { ok: true };
        }

        case 'GET_STATE': {
          return await getState();
        }

        case 'RESET': {
          clearStopRequest();
          await clearAutoRunTimerAlarm();
          await resetState();
          await addLog('Flow has been reset', 'info');
          return { ok: true };
        }

        case 'CLEAR_FREE_REUSABLE_PHONE': {
          if (typeof clearFreeReusablePhoneActivation !== 'function') {
            throw new Error('Free reusable phone clearing capability not connected.');
          }
          return await clearFreeReusablePhoneActivation();
        }

        case 'CLEAR_GROK_SSO_COOKIES': {
          if (typeof clearGrokSsoCookies !== 'function') {
            throw new Error('Grok SSO clearing capability not connected.');
          }
          return await clearGrokSsoCookies();
        }

        case 'SET_FREE_REUSABLE_PHONE': {
          if (typeof setFreeReusablePhoneActivation !== 'function') {
            throw new Error('Free reusable phone recording capability not connected.');
          }
          return await setFreeReusablePhoneActivation(message.payload || {});
        }

        case 'SET_ACCOUNT_CONTRIBUTION_MODE': {
          const enabled = Boolean(message.payload?.enabled);
          const state = await ensureManualInteractionAllowed(enabled ? 'Enter account contribution' : 'Exit account contribution');
          if (Object.values(state.nodeStatuses || {}).some((status) => status === 'running')) {
            throw new Error(enabled ? 'A step is currently running — cannot enter account contribution.' : 'A step is currently running — cannot exit account contribution.');
          }
          if (typeof setAccountContributionMode !== 'function') {
            throw new Error('Account contribution toggle capability not connected.');
          }
          return {
            ok: true,
            state: await setAccountContributionMode(enabled, {
              adapterId: message.payload?.adapterId,
              flowId: message.payload?.flowId || state?.activeFlowId || state?.flowId,
            }),
          };
        }

        case 'START_FLOW_CONTRIBUTION': {
          const state = await ensureManualInteractionAllowed('Start contribution');
          if (Object.values(state.nodeStatuses || {}).some((status) => status === 'running')) {
            throw new Error('A step is currently running — cannot start contribution flow.');
          }
          if (!state?.accountContributionEnabled) {
            throw new Error('Please enter account contribution first.');
          }
          if (typeof startFlowContribution !== 'function') {
            throw new Error('Contribution OAuth flow not connected.');
          }
          return {
            ok: true,
            state: await startFlowContribution({
              nickname: message.payload?.nickname,
              qq: message.payload?.qq,
            }),
          };
        }

        case 'SUBMIT_FLOW_CONTRIBUTION': {
          const state = await getState();
          if (!state?.accountContributionEnabled) {
            throw new Error('Please enter account contribution first.');
          }
          if (typeof submitFlowContribution !== 'function') {
            throw new Error('Contribution submission capability not connected.');
          }
          return {
            ok: true,
            state: await submitFlowContribution(message.payload?.callbackUrl, {
              reason: message.payload?.reason || 'sidepanel_submit',
            }),
          };
        }

        case 'POLL_FLOW_CONTRIBUTION_STATUS': {
          if (typeof pollContributionStatus !== 'function') {
            throw new Error('Contribution status polling capability not connected.');
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
            throw new Error('Auto flow is running — cannot clear mailbox records currently.');
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
            throw new Error('Auto flow is running — cannot delete mailbox records currently.');
          }
          if (typeof deleteAccountRunHistoryRecords !== 'function') {
            return { ok: true, deletedCount: 0, remainingCount: 0 };
          }
          const recordIds = Array.isArray(message.payload?.recordIds) ? message.payload.recordIds : [];
          const result = await deleteAccountRunHistoryRecords(recordIds, state);
          return { ok: true, ...result };
        }

        case 'EXECUTE_NODE': {
          clearStopRequest();
          const requestState = await getState();
          const nodeId = String(message.nodeId || message.payload?.nodeId || '').trim();
          const resolvedStep = findStepByNodeId(nodeId, requestState);
          if (!nodeId || !resolvedStep) {
            throw new Error('EXECUTE_NODE missing nodeId.');
          }
          if (message.source === 'sidepanel') {
            await lockAutomationWindowFromMessage(message, sender);
            await ensureManualInteractionAllowed('Manual node execution');
          }
          if (typeof assertNodeExecutionAllowedForState === 'function') {
            assertNodeExecutionAllowedForState(nodeId, requestState, 'Manual node execution');
          }
          if (message.source === 'sidepanel') {
            await invalidateDownstreamAfterStepRestart(resolvedStep, { logLabel: `Node ${nodeId} re-execution` });
          }
          if (message.payload.email) {
            await setEmailState(message.payload.email);
          }
          if (message.payload.emailPrefix !== undefined) {
            await setPersistentSettings({ emailPrefix: message.payload.emailPrefix });
            await setState({ emailPrefix: message.payload.emailPrefix });
          }
          const executionState = await getState();
          if (doesNodeUseCompletionSignal(nodeId, executionState)) {
            const completionPayload = await executeNodeViaCompletionSignal(nodeId);
            if (nodeId === 'fill-profile' && typeof finalizeStep5Completion === 'function') {
              await finalizeStep5Completion(completionPayload || {});
            }
          } else {
            await executeNode(nodeId);
          }
          return { ok: true };
        }

        case 'AUTO_RUN': {
          clearStopRequest();
          if (message.source === 'sidepanel') {
            await lockAutomationWindowFromMessage(message, sender);
          }
          if (Boolean(message.payload?.accountContributionEnabled) && typeof setAccountContributionMode === 'function') {
            await setAccountContributionMode(true, {
              adapterId: message.payload?.contributionAdapterId,
              flowId: message.payload?.activeFlowId || message.payload?.flowId,
            });
            if (typeof setState === 'function') {
              const contributionNickname = String(message.payload?.contributionNickname || '').trim();
              const contributionQq = String(message.payload?.contributionQq || '').trim();
              await setState({
                contributionNickname,
                contributionQq,
              });
            }
          }
          const autoRunFlowStateUpdates = buildAutoRunFlowStateUpdates(message.payload || {});
          if (Object.keys(autoRunFlowStateUpdates).length > 0 && typeof setState === 'function') {
            await setState(autoRunFlowStateUpdates);
          }
          const state = await getState();
          const autoRunStartValidation = validateAutoRunStart(state, {
            activeFlowId: autoRunFlowStateUpdates.activeFlowId ?? state?.activeFlowId,
            targetId: autoRunFlowStateUpdates.targetId ?? state?.targetId,
            state,
          });
          if (autoRunStartValidation?.ok === false) {
            throw new Error(autoRunStartValidation.errors?.[0]?.message || 'Current settings do not support starting the auto flow.');
          }
          if (getPendingAutoRunTimerPlan(state)) {
            throw new Error('A thread interval is already waiting. Please stop or continue immediately first.');
          }
          const totalRuns = normalizeRunCount(message.payload?.totalRuns || 1);
          const autoRunSkipFailures = Boolean(message.payload?.autoRunSkipFailures);
          const mode = message.payload?.mode === 'continue' ? 'continue' : 'restart';
          await setState({ autoRunSkipFailures });
          startAutoRunLoop(totalRuns, { autoRunSkipFailures, mode });
          return { ok: true };
        }

        case 'SKIP_AUTO_RUN_COUNTDOWN': {
          clearStopRequest();
          if (message.source === 'sidepanel') {
            await lockAutomationWindowFromMessage(message, sender);
          }
          const skipped = await skipAutoRunCountdown();
          if (!skipped) {
            throw new Error('No countdown available to start immediately.');
          }
          return { ok: true };
        }

        case 'RESUME_AUTO_RUN': {
          clearStopRequest();
          if (message.source === 'sidepanel') {
            await lockAutomationWindowFromMessage(message, sender);
          }
          if (message.payload.email) {
            await setEmailState(message.payload.email);
          }
          resumeAutoRun().catch((error) => {
            handleAutoRunLoopUnhandledError(error).catch(() => {});
          });
          return { ok: true };
        }

        case 'TAKEOVER_AUTO_RUN': {
          await requestStop({ logMessage: 'Manual takeover confirmed — stopping auto flow and switching to manual control...' });
          await addLog('Auto flow has been switched to manual control.', 'warn');
          return { ok: true };
        }

        case 'SKIP_NODE': {
          const nodeId = String(message.nodeId || message.payload?.nodeId || '').trim();
          if (!nodeId) {
            throw new Error('SKIP_NODE missing nodeId.');
          }
          return await skipNode(nodeId);
        }

        case 'SAVE_SETTING': {
          const currentState = await getState();
          const updates = buildPersistentSettingsPayload(message.payload || {});
          const sessionUpdates = buildLuckmailSessionSettingsPayload(message.payload || {});
          const modeValidation = validateModeSwitch({
            ...currentState,
            ...updates,
            resolvedSignupMethod: null,
          }, {
            changedKeys: Object.keys(updates),
          });
          if (modeValidation?.normalizedUpdates && Object.keys(modeValidation.normalizedUpdates).length > 0) {
            Object.assign(updates, modeValidation.normalizedUpdates);
          }
          const nextSignupState = {
            ...currentState,
            ...updates,
            resolvedSignupMethod: null,
          };
          if (
            Object.prototype.hasOwnProperty.call(updates, 'phoneVerificationEnabled')
            || Object.prototype.hasOwnProperty.call(updates, 'plusModeEnabled')
            || Object.prototype.hasOwnProperty.call(updates, 'signupMethod')
            || Object.prototype.hasOwnProperty.call(updates, 'targetId')
            || Object.prototype.hasOwnProperty.call(updates, 'activeFlowId')
            || Object.prototype.hasOwnProperty.call(updates, 'accountContributionEnabled')
          ) {
            updates.signupMethod = resolveSignupMethod(nextSignupState);
          }
          const nextPersistedSignupMethod = Object.prototype.hasOwnProperty.call(updates, 'signupMethod')
            ? updates.signupMethod
            : currentState?.signupMethod;
          if (normalizeSignupMethod(nextPersistedSignupMethod) === 'phone') {
            preservePhoneReuseSettingsForPhoneSignup(updates, currentState);
          }
          const modeChanged = Object.prototype.hasOwnProperty.call(updates, 'plusModeEnabled')
            && Boolean(currentState?.plusModeEnabled) !== Boolean(updates.plusModeEnabled);
          const plusPaymentChanged = Object.prototype.hasOwnProperty.call(updates, 'plusPaymentMethod')
            && normalizePlusPaymentMethodForDisplay(currentState?.plusPaymentMethod || 'paypal')
              !== normalizePlusPaymentMethodForDisplay(updates.plusPaymentMethod || 'paypal');
          const plusAccountAccessStrategyChanged = Object.prototype.hasOwnProperty.call(updates, 'plusAccountAccessStrategy')
            && normalizePlusAccountAccessStrategyForDisplay(currentState?.plusAccountAccessStrategy || 'oauth')
              !== normalizePlusAccountAccessStrategyForDisplay(updates.plusAccountAccessStrategy || 'oauth');
          const phoneSignupReloginAfterBindEmailChanged = Object.prototype.hasOwnProperty.call(updates, 'phoneSignupReloginAfterBindEmailEnabled')
            && Boolean(currentState?.phoneSignupReloginAfterBindEmailEnabled) !== Boolean(updates.phoneSignupReloginAfterBindEmailEnabled);
          const nextPlusModeEnabled = Object.prototype.hasOwnProperty.call(updates, 'plusModeEnabled')
            ? Boolean(updates.plusModeEnabled)
            : Boolean(currentState?.plusModeEnabled);
          const stepModeChanged = modeChanged
            || (nextPlusModeEnabled && plusPaymentChanged)
            || (nextPlusModeEnabled && plusAccountAccessStrategyChanged)
            || phoneSignupReloginAfterBindEmailChanged;
          const canonicalSettingsUpdates = await setPersistentSettings(updates);
          const stateUpdates = {
            ...canonicalSettingsUpdates,
            ...sessionUpdates,
          };
          if (Object.prototype.hasOwnProperty.call(canonicalSettingsUpdates, 'activeFlowId')
            && !Object.prototype.hasOwnProperty.call(stateUpdates, 'flowId')) {
            stateUpdates.flowId = canonicalSettingsUpdates.activeFlowId;
          }
          if (Object.prototype.hasOwnProperty.call(canonicalSettingsUpdates, 'icloudHostPreference')) {
            const nextHostPreference = String(canonicalSettingsUpdates.icloudHostPreference || '').trim().toLowerCase();
            stateUpdates.preferredIcloudHost = nextHostPreference === 'icloud.com' || nextHostPreference === 'icloud.com.cn'
              ? nextHostPreference
              : '';
          }
          const currentNodeIds = typeof getNodeIdsForState === 'function'
            ? getNodeIdsForState(currentState)
            : (typeof getStepIdsForState === 'function'
              ? getStepIdsForState(currentState).map((stepId) => getStepKeyForState(stepId, currentState)).filter(Boolean)
              : []);
          const nextStateForSteps = { ...currentState, ...stateUpdates };
          const nextNodeIds = typeof getNodeIdsForState === 'function'
            ? getNodeIdsForState(nextStateForSteps)
            : (typeof getStepIdsForState === 'function'
              ? getStepIdsForState(nextStateForSteps).map((stepId) => getStepKeyForState(stepId, nextStateForSteps)).filter(Boolean)
              : []);
          const nodeTopologyChanged = currentNodeIds.length !== nextNodeIds.length
            || currentNodeIds.some((nodeId, index) => nodeId !== nextNodeIds[index]);
          const shouldRebuildNodeStatuses = stepModeChanged || nodeTopologyChanged;
          if (shouldRebuildNodeStatuses && nextNodeIds.length > 0) {
            Object.assign(stateUpdates, {
              oauthUrl: null,
              localhostUrl: null,
              oauthFlowDeadlineAt: null,
              oauthFlowDeadlineSourceUrl: null,
              cpaOAuthState: null,
              cpaManagementOrigin: null,
              sub2apiSessionId: null,
              sub2apiOAuthState: null,
              sub2apiGroupId: null,
              sub2apiGroupIds: [],
              sub2apiDraftName: null,
              sub2apiProxyId: null,
              codex2apiSessionId: null,
              codex2apiOAuthState: null,
              plusManualConfirmationPending: false,
              plusManualConfirmationRequestId: '',
              plusManualConfirmationStep: 0,
              plusManualConfirmationMethod: '',
              plusManualConfirmationTitle: '',
              plusManualConfirmationMessage: '',
            });
          }
          if (shouldRebuildNodeStatuses && nextNodeIds.length > 0) {
            stateUpdates.nodeStatuses = Object.fromEntries(nextNodeIds.map((nodeId) => [nodeId, 'pending']));
            stateUpdates.currentNodeId = '';
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
          // Automatically apply only when "manually toggling proxy".
          // Other field changes (host/account/region/session etc.) require explicit triggers via "Sync/Next/Detect Exit/Change".
          const shouldApplyIpProxyOnSave = hasIpProxyUpdates
            && hasIpProxyEnabledUpdate
            && previousIpProxyEnabled !== nextIpProxyEnabled;
          let proxyRouting = null;
          if (shouldApplyIpProxyOnSave && typeof applyIpProxySettingsFromState === 'function') {
            const isEnablingProxy = !previousIpProxyEnabled && nextIpProxyEnabled;
            proxyRouting = await applyIpProxySettingsFromState(mergedState, {
              // When manually enabling, apply proxy once automatically without exit probing;
              // Exit probing is triggered explicitly by "Sync/Detect Exit" button to avoid false failures on enable.
              skipExitProbe: true,
              resetNetworkState: false,
              forceAuthRebind: false,
              suppressAuthRebind: !isEnablingProxy,
            }).catch((error) => ({
              applied: false,
              reason: 'apply_failed',
              error: error?.message || String(error || 'Proxy apply failed'),
            }));
          }
          if (Boolean(currentState?.accountContributionEnabled) && typeof setAccountContributionMode === 'function') {
            await setAccountContributionMode(true, {
              adapterId: currentState?.contributionAdapterId,
              flowId: currentState?.activeFlowId || currentState?.flowId,
            });
          }
          if (Object.keys(stateUpdates).length > 0 && typeof broadcastDataUpdate === 'function') {
            broadcastDataUpdate(stateUpdates);
          }
          if (modeChanged) {
            const selectedPlusPaymentMethod = getPlusPaymentMethodLabel(
              stateUpdates.plusPaymentMethod ?? currentState?.plusPaymentMethod ?? 'paypal'
            );
            const selectedPlusAccountAccessStrategy = getPlusAccountAccessStrategyLabel(
              stateUpdates.plusAccountAccessStrategy ?? currentState?.plusAccountAccessStrategy ?? 'oauth',
              stateUpdates.targetId
                ?? currentState?.targetId
                ?? 'cpa'
            );
            await addLog(
              Boolean(updates.plusModeEnabled)
                ? `Plus mode enabled — switched to Plus Checkout steps. Current payment method: ${selectedPlusPaymentMethod}, account access strategy: ${selectedPlusAccountAccessStrategy}.`
                : 'Plus mode disabled — restored to regular registration authorization steps.',
              'info'
            );
          } else if (plusPaymentChanged && nextPlusModeEnabled) {
            const selectedPlusPaymentMethod = getPlusPaymentMethodLabel(
              stateUpdates.plusPaymentMethod ?? currentState?.plusPaymentMethod ?? 'paypal'
            );
            await addLog(`Plus payment method switched to ${selectedPlusPaymentMethod}. Updated corresponding Plus steps.`, 'info');
          } else if (plusAccountAccessStrategyChanged && nextPlusModeEnabled) {
            const selectedPlusAccountAccessStrategy = getPlusAccountAccessStrategyLabel(
              stateUpdates.plusAccountAccessStrategy ?? currentState?.plusAccountAccessStrategy ?? 'oauth',
              stateUpdates.targetId
                ?? currentState?.targetId
                ?? 'cpa'
            );
            await addLog(`Plus account access strategy switched to ${selectedPlusAccountAccessStrategy}. Updated corresponding Plus tail chain.`, 'info');
          }
          return {
            ok: true,
            modeValidation,
            proxyRouting,
            state: await getState(),
          };
        }

        case 'REFRESH_GPC_CARD_BALANCE': {
          if (typeof refreshGpcCardBalance !== 'function') {
            throw new Error('GPC API Key balance query capability not connected.');
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

        case 'CHECK_KIRO_RS_CONNECTION': {
          if (typeof testKiroRsConnection !== 'function') {
            throw new Error('kiro.rs connection test capability not connected.');
          }
          const currentState = await getState();
          const activeFlowId = normalizeMessageFlowId(
            message.payload?.activeFlowId || currentState?.activeFlowId || 'kiro',
            'kiro'
          );
          const targetId = normalizeMessageTargetId(
            activeFlowId,
            message.payload?.targetId || currentState?.targetId || 'kiro-rs',
            'kiro-rs'
          );
          const nestedTargetConfig = currentState?.settingsState?.flows?.kiro?.targets?.[targetId]
            || currentState?.flows?.kiro?.targets?.[targetId]
            || {};
          const baseUrl = String(
            message.payload?.baseUrl
            ?? nestedTargetConfig.baseUrl
            ?? currentState?.kiroRsUrl
            ?? ''
          ).trim();
          const apiKey = String(
            message.payload?.apiKey
            ?? nestedTargetConfig.apiKey
            ?? currentState?.kiroRsKey
            ?? ''
          );
          const result = await testKiroRsConnection(baseUrl, apiKey);
          return {
            ok: Boolean(result?.ok),
            targetId,
            status: Number(result?.status) || 0,
            message: String(result?.message || '').trim(),
          };
        }

        case 'RUN_IP_PROXY_AUTO_SYNC_NOW': {
          if (typeof runIpProxyAutoSync !== 'function') {
            throw new Error('IP proxy auto-sync capability not connected.');
          }
          const result = await runIpProxyAutoSync('manual');
          return { ok: true, ...result };
        }

        case 'REFRESH_IP_PROXY_POOL': {
          if (typeof refreshIpProxyPool !== 'function') {
            throw new Error('IP proxy pool capability not connected.');
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
            throw new Error('IP proxy switching capability not connected.');
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
            throw new Error('IP proxy Change capability not connected.');
          }
          const result = await changeIpProxyExit({
            mode: message.payload?.mode,
            skipExitProbe: message.payload?.skipExitProbe,
          });
          return { ok: true, ...result };
        }

        case 'PROBE_IP_PROXY_EXIT': {
          if (message.source === 'sidepanel') {
            await lockAutomationWindowFromMessage(message, sender);
          }
          if (typeof probeIpProxyExit !== 'function') {
            throw new Error('IP proxy exit detection capability not connected.');
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
          const hadMissingAuthChallenge = /challenge=0|provided=0|did not trigger proxy auth challenge|did not receive 407|未触发代理鉴权挑战|未收到 407/i.test(previousExitError);
          const shouldPreRebindBeforeProbe = Boolean(
            probeState?.ipProxyEnabled
            && is711AccountMode
            && (hadMissingAuthChallenge || previousReason === 'connectivity_failed')
          );
          const timeoutMs = Number(message.payload?.timeoutMs) > 0
            ? Number(message.payload.timeoutMs)
            : (is711AccountMode ? (shouldPreRebindBeforeProbe ? 15000 : 12000) : undefined);

          // Before manual "Detect Exit", lightly apply the current config so we don't read stale proxy link state.
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
            await addLog(`Hotmail account ${result.account.email} verified — ready for receiving mail.`, 'ok');
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
            throw new Error('2925 login capability not connected.');
          }
          await deps.ensureMail2925MailboxSession({
            accountId: account.id,
            forceRelogin: Boolean(message.payload?.forceRelogin),
            actionLabel: 'Side panel manual login of 2925 account',
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
            throw new Error('Auto flow is running — cannot manually modify email at this time.');
          }
          const email = String(message.payload?.email || '').trim() || null;
          await setEmailStateSilently(email, { source: 'manual' });
          return { ok: true, email };
        }

        case 'SAVE_EMAIL': {
          const state = await getState();
          if (isAutoRunLockedState(state)) {
            throw new Error('Auto flow is running — cannot manually modify email at this time.');
          }
          await setEmailState(message.payload.email, { source: 'manual' });
          await resumeAutoRun();
          return { ok: true, email: message.payload.email };
        }

        case 'SET_SIGNUP_PHONE_STATE': {
          const state = await getState();
          if (isAutoRunLockedState(state)) {
            throw new Error('Auto flow is running — cannot manually modify signup phone number at this time.');
          }
          const phoneNumber = resolveSignupPhonePayload(message.payload) || null;
          await setSignupPhoneStateSilently(phoneNumber);
          return { ok: true, phoneNumber };
        }

        case 'SAVE_SIGNUP_PHONE': {
          const state = await getState();
          if (isAutoRunLockedState(state)) {
            throw new Error('Auto flow is running — cannot manually modify signup phone number at this time.');
          }
          const phoneNumber = resolveSignupPhonePayload(message.payload) || null;
          await setSignupPhoneState(phoneNumber);
          return { ok: true, phoneNumber };
        }

        case 'FETCH_GENERATED_EMAIL': {
          clearStopRequest();
          const state = await getState();
          if (isAutoRunLockedState(state)) {
            throw new Error('Auto flow is running — cannot manually fetch email at this time.');
          }
          const email = await fetchGeneratedEmail(state, message.payload || {});
          await resumeAutoRun();
          return { ok: true, email };
        }

        case 'FETCH_DUCK_EMAIL': {
          clearStopRequest();
          const state = await getState();
          if (isAutoRunLockedState(state)) {
            throw new Error('Auto flow is running — cannot manually fetch email at this time.');
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
