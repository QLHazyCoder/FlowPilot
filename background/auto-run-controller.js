(function attachBackgroundAutoRunController(root, factory) {
  root.MultiPageBackgroundAutoRunController = factory();
})(typeof self !== 'undefined' ? self : globalThis, function createBackgroundAutoRunControllerModule() {
  function createAutoRunController(deps = {}) {
    const {
      addLog,
      appendAccountRunRecord,
      AUTO_RUN_MAX_RETRIES_PER_ROUND,
      AUTO_RUN_RETRY_DELAY_MS,
      AUTO_RUN_TIMER_KIND_BEFORE_RETRY,
      AUTO_RUN_TIMER_KIND_BETWEEN_ROUNDS,
      broadcastAutoRunStatus,
      broadcastStopToContentScripts,
      buildFreshAutoRunKeepState,
      cancelPendingCommands,
      clearStopRequest,
      createAutoRunSessionId,
      ensureHotmailMailboxReadyForAutoRunRound,
      getAutoRunStatusPayload,
      getErrorMessage,
      getFirstUnfinishedNodeId,
      getPendingAutoRunTimerPlan,
      getRunningNodeIds,
      getState,
      hasSavedNodeProgress,
      isAddPhoneAuthFailure,
      isGpcTaskEndedFailure,
      isKiroProxyFailure,
      isPhoneSmsPlatformRateLimitFailure,
      isPlusCheckoutNonFreeTrialFailure,
      isRestartCurrentAttemptError,
      isStep4Route405RecoveryLimitFailure,
      isSignupUserAlreadyExistsFailure,
      isStopError,
      launchAutoRunTimerPlan,
      normalizeAutoRunFallbackThreadIntervalMinutes,
      persistAutoRunTimerPlan,
      resetState,
      runAutoSequenceFromNode,
      runtime,
      setState,
      sleepWithStop,
      throwIfAutoRunSessionStopped,
      waitForRunningNodesToFinish,
    } = deps;

    function getRunningWorkflowNodes(state = {}) {
      if (typeof getRunningNodeIds === 'function') {
        return getRunningNodeIds(state.nodeStatuses || {}, state);
      }
      return [];
    }

    function getFirstUnfinishedWorkflowNode(state = {}) {
      if (typeof getFirstUnfinishedNodeId === 'function') {
        return getFirstUnfinishedNodeId(state.nodeStatuses || {}, state);
      }
      return null;
    }

    function hasSavedWorkflowProgress(state = {}) {
      if (typeof hasSavedNodeProgress === 'function') {
        return hasSavedNodeProgress(state.nodeStatuses || {}, state);
      }
      return false;
    }

    async function waitForRunningWorkflowNodesToFinish(payload = {}) {
      if (typeof waitForRunningNodesToFinish === 'function') {
        return waitForRunningNodesToFinish(payload);
      }
      return getState();
    }

    async function runAutoSequenceFromWorkflowNode(startNodeId, context = {}) {
      if (typeof runAutoSequenceFromNode === 'function') {
        return runAutoSequenceFromNode(startNodeId, context);
      }
      throw new Error('Auto-run node executor is not connected.');
    }

    function buildFreshStartStateSnapshot(state = {}) {
      return {
        ...(state || {}),
        currentNodeId: '',
        nodeStatuses: {},
        stepStatuses: {},
      };
    }

    function resolveFreshStartNodeId(state = {}) {
      const freshState = buildFreshStartStateSnapshot(state);
      return String(getFirstUnfinishedWorkflowNode(freshState) || '').trim();
    }

    function stripRuntimeProgressFromFreshKeepState(value) {
      if (!value || typeof value !== 'object' || Array.isArray(value)) {
        return value;
      }
      const next = {
        ...value,
      };
      delete next.currentNodeId;
      delete next.nodeStatuses;
      delete next.stepStatuses;
      if (next.runtimeState && typeof next.runtimeState === 'object' && !Array.isArray(next.runtimeState)) {
        const runtimeState = {
          ...next.runtimeState,
        };
        delete runtimeState.currentNodeId;
        delete runtimeState.nodeStatuses;
        if (runtimeState.sharedState && typeof runtimeState.sharedState === 'object' && !Array.isArray(runtimeState.sharedState)) {
          const sharedState = {
            ...runtimeState.sharedState,
          };
          delete sharedState.tabRegistry;
          delete sharedState.sourceLastUrls;
          delete sharedState.flowStartTime;
          runtimeState.sharedState = sharedState;
        }
        next.runtimeState = runtimeState;
      }
      return next;
    }

    function buildFreshAttemptNodeStatuses(state = {}) {
      const knownNodeIds = getKnownNodeIdsFromState(state);
      if (knownNodeIds.length) {
        return Object.fromEntries(knownNodeIds.map((nodeId) => [nodeId, 'pending']));
      }
      return {};
    }

    function buildFreshAttemptKeepState(state = {}, context = {}) {
      if (typeof buildFreshAutoRunKeepState === 'function') {
        const helperPatch = buildFreshAutoRunKeepState(state, context);
        if (helperPatch && typeof helperPatch === 'object' && !Array.isArray(helperPatch)) {
          return stripRuntimeProgressFromFreshKeepState({
            ...helperPatch,
          });
        }
      }

      return stripRuntimeProgressFromFreshKeepState({
        activeFlowId: state.activeFlowId,
        flowId: state.flowId || state.activeFlowId,
        targetId: state.targetId,
        vpsUrl: state.vpsUrl,
        vpsPassword: state.vpsPassword,
        customPassword: state.customPassword,
        plusModeEnabled: state.plusModeEnabled,
        plusPaymentMethod: state.plusPaymentMethod,
        phoneVerificationEnabled: state.phoneVerificationEnabled,
        phoneSignupReloginAfterBindEmailEnabled: state.phoneSignupReloginAfterBindEmailEnabled,
        paypalEmail: state.paypalEmail,
        paypalPassword: state.paypalPassword,
        kiroRsUrl: state.kiroRsUrl,
        kiroRsKey: state.kiroRsKey,
        autoRunSkipFailures: state.autoRunSkipFailures,
        autoRunFallbackThreadIntervalMinutes: state.autoRunFallbackThreadIntervalMinutes,
        autoStepDelaySeconds: state.autoStepDelaySeconds,
        stepExecutionRangeByFlow: state.stepExecutionRangeByFlow,
        signupMethod: state.signupMethod,
        mailProvider: state.mailProvider,
        emailGenerator: state.emailGenerator,
        gmailBaseEmail: state.gmailBaseEmail,
        mail2925BaseEmail: state.mail2925BaseEmail,
        currentMail2925AccountId: state.currentMail2925AccountId,
        emailPrefix: state.emailPrefix,
        inbucketHost: state.inbucketHost,
        inbucketMailbox: state.inbucketMailbox,
        cloudflareDomain: state.cloudflareDomain,
        cloudflareDomains: state.cloudflareDomains,
        reusablePhoneActivation: state.reusablePhoneActivation,
      });
    }

    function createAutoRunRoundSummary(round) {
      return {
        round,
        status: 'pending',
        attempts: 0,
        failureReasons: [],
        finalFailureReason: '',
      };
    }

    function normalizeAutoRunRoundSummary(summary, round) {
      const base = createAutoRunRoundSummary(round);
      if (!summary || typeof summary !== 'object') {
        return base;
      }

      const status = String(summary.status || '').trim().toLowerCase();
      return {
        round,
        status: ['pending', 'success', 'failed'].includes(status) ? status : base.status,
        attempts: Math.max(0, Math.floor(Number(summary.attempts) || 0)),
        failureReasons: Array.isArray(summary.failureReasons)
          ? summary.failureReasons.map((item) => String(item || '').trim()).filter(Boolean)
          : [],
        finalFailureReason: String(summary.finalFailureReason || '').trim(),
      };
    }

    function buildAutoRunRoundSummaries(totalRuns, rawSummaries = []) {
      return Array.from({ length: totalRuns }, (_, index) => normalizeAutoRunRoundSummary(rawSummaries[index], index + 1));
    }

    function serializeAutoRunRoundSummaries(totalRuns, roundSummaries = []) {
      return buildAutoRunRoundSummaries(totalRuns, roundSummaries).map((summary) => ({
        ...summary,
        failureReasons: [...summary.failureReasons],
      }));
    }

    function getAutoRunRoundRetryCount(summary) {
      return Math.max(0, Number(summary?.attempts || 0) - 1);
    }

    function normalizeRecordNode(value = '') {
      return String(value || '').trim();
    }

    function extractNodeFromRecordStatus(status = '') {
      const match = String(status || '').trim().match(/^node:([^:]+):(failed|stopped)$/i);
      return match ? normalizeRecordNode(match[1]) : '';
    }

    function getKnownNodeIdsFromState(state = {}) {
      const ids = new Set();
      for (const key of Object.keys(state?.nodeStatuses || {})) {
        const nodeId = normalizeRecordNode(key);
        if (nodeId) {
          ids.add(nodeId);
        }
      }

      const currentNodeId = normalizeRecordNode(state?.currentNodeId);
      if (currentNodeId) {
        ids.add(currentNodeId);
      }

      return Array.from(ids);
    }

    function inferRecordNodeFromState(state = {}, preferredStatuses = []) {
      const statuses = state?.nodeStatuses || {};
      const preferredStatusSet = new Set(preferredStatuses.map((item) => String(item || '').trim()).filter(Boolean));
      const nodeIds = getKnownNodeIdsFromState(state);
      const currentNodeId = normalizeRecordNode(state?.currentNodeId);

      if (currentNodeId && preferredStatusSet.has(String(statuses[currentNodeId] || '').trim())) {
        return currentNodeId;
      }

      const matchingNodes = nodeIds.filter((nodeId) => preferredStatusSet.has(String(statuses[nodeId] || '').trim()));
      if (matchingNodes.length) {
        return matchingNodes[matchingNodes.length - 1];
      }

      if (currentNodeId) {
        const currentStatus = String(statuses[currentNodeId] || '').trim();
        if (!['', 'pending', 'completed', 'manual_completed', 'skipped'].includes(currentStatus)) {
          return currentNodeId;
        }
      }

      return '';
    }

    function inferRecordNodeFromError(errorLike = null, state = {}) {
      if (!errorLike || typeof errorLike !== 'object') {
        return '';
      }

      return normalizeRecordNode(errorLike.failedNodeId)
        || normalizeRecordNode(errorLike.nodeId)
        || normalizeRecordNode(errorLike.currentNodeId);
    }

    function resolveAutoRunAccountRecordStatus(status, state = {}, errorLike = null) {
      const normalizedStatus = String(status || '').trim().toLowerCase();
      const explicitNode = extractNodeFromRecordStatus(status);
      if (explicitNode) {
        return `node:${explicitNode}:${normalizedStatus.endsWith(':stopped') ? 'stopped' : 'failed'}`;
      }
      if (normalizedStatus === 'failed') {
        const failedNode = inferRecordNodeFromError(errorLike, state)
          || inferRecordNodeFromState(state, ['failed', 'running']);
        return failedNode ? `node:${failedNode}:failed` : status;
      }

      if (normalizedStatus === 'stopped') {
        const stoppedNode = inferRecordNodeFromError(errorLike, state)
          || inferRecordNodeFromState(state, ['stopped', 'running']);
        return stoppedNode ? `node:${stoppedNode}:stopped` : status;
      }

      return status;
    }

    function formatAutoRunFailureReasons(reasons = []) {
      if (!Array.isArray(reasons) || !reasons.length) {
        return 'Unknown error';
      }

      const counts = new Map();
      for (const reason of reasons) {
        const normalized = String(reason || '').trim() || 'Unknown error';
        counts.set(normalized, (counts.get(normalized) || 0) + 1);
      }

      return Array.from(counts.entries())
        .map(([reason, count]) => (count > 1 ? `${reason} (${count} times)` : reason))
        .join('; ');
    }

    function isPhoneNumberSupplyExhaustedFailure(errorLike) {
      const message = String(
        typeof errorLike === 'string'
          ? errorLike
          : (errorLike?.message || errorLike || '')
      ).trim();
      if (!message) {
        return false;
      }
      const hasGlobalNoSupplySignal = /Step\s*9:\s*all\s+provider\s+candidates\s+failed\s+to\s+acquire\s+number|(?:HeroSMS|5sim|NexSMS)\s+no\s+numbers\s+available\s+across|no\s+numbers\s+within\s+maxPrice|no\s+free\s+phones|numbers?\s+not\s+found/i.test(message);
      if (!hasGlobalNoSupplySignal) {
        return false;
      }
      const hasRecoverableStep9RotationSignal = /phone\s+verification\s+did\s+not\s+succeed\s+after\s+\d+\s+number\s+replacements|sms_timeout_after_|route_405_retry_loop|resend_throttled|activation_not_found|order\s+not\s+found/i.test(message);
      if (hasRecoverableStep9RotationSignal) {
        return false;
      }
      return true;
    }

    function shouldKeepCustomMailProviderPoolEmail(state = {}) {
      return String(state?.mailProvider || '').trim().toLowerCase() === 'custom'
        && Array.isArray(state?.customMailProviderPool)
        && state.customMailProviderPool.length > 0;
    }

    function isPhoneNumberSupplyExhaustedFailure(error) {
      const text = String(
        typeof getErrorMessage === 'function'
          ? getErrorMessage(error)
          : (error?.message || error || '')
      ).trim();
      if (!text) {
        return false;
      }
      return /no\s+numbers\s+available\s+across|all provider candidates failed to acquire number|no\s+free\s+phones|numbers?\s+not\s+found|no\s+numbers\s+within\s+maxprice|countries\s+are\s+empty|均无可用号码|暂无可用号码|无可用号码|接码号池暂无|\bNO_NUMBERS\b/i.test(text);
    }

    async function logAutoRunFinalSummary(totalRuns, roundSummaries = []) {
      const summaries = buildAutoRunRoundSummaries(totalRuns, roundSummaries);
      const successRounds = summaries.filter((item) => item.status === 'success');
      const failedRounds = summaries.filter((item) => item.status === 'failed');
      const pendingRounds = summaries.filter((item) => item.status === 'pending');

      await addLog('=== Auto-run summary ===', failedRounds.length ? 'warn' : 'ok');
      await addLog(
        `Total rounds: ${totalRuns}; Success: ${successRounds.length}; Failed: ${failedRounds.length}; Pending: ${pendingRounds.length}`,
        failedRounds.length ? 'warn' : 'ok'
      );

      if (successRounds.length) {
        await addLog(
          `Successful rounds: ${successRounds
            .map((item) => `Round ${item.round} (retries: ${getAutoRunRoundRetryCount(item)})`)
            .join('; ')}`,
          'ok'
        );
      }

      if (failedRounds.length) {
        await addLog(
          `Failed rounds: ${failedRounds
            .map((item) => {
              const retryCount = getAutoRunRoundRetryCount(item);
              const finalReason = item.finalFailureReason || item.failureReasons[item.failureReasons.length - 1] || 'Unknown error';
              const reasonSummary = formatAutoRunFailureReasons(item.failureReasons);
              return !reasonSummary || reasonSummary === finalReason
                ? `Round ${item.round} (retries: ${retryCount}, final reason: ${finalReason})`
                : `Round ${item.round} (retries: ${retryCount}, final reason: ${finalReason}; failure history: ${reasonSummary})`;
            })
            .join('; ')}`,
          'error'
        );
      }

      if (pendingRounds.length) {
        await addLog(
          `Pending rounds: ${pendingRounds.map((item) => `Round ${item.round}`).join('; ')}`,
          'warn'
        );
      }
    }

    async function skipAutoRunCountdown() {
      const state = await getState();
      const plan = getPendingAutoRunTimerPlan(state);
      if (!plan || state.autoRunPhase !== 'waiting_interval') {
        return false;
      }

      return launchAutoRunTimerPlan('manual', {
        expectedKinds: [
          AUTO_RUN_TIMER_KIND_BETWEEN_ROUNDS,
          AUTO_RUN_TIMER_KIND_BEFORE_RETRY,
        ],
      });
    }

    async function waitBetweenAutoRunRounds(targetRun, totalRuns, roundSummary, options = {}) {
      const { autoRunSkipFailures = false, roundSummaries = [] } = options;
      if (totalRuns <= 1 || targetRun >= totalRuns) {
        return false;
      }

      const fallbackThreadIntervalMinutes = normalizeAutoRunFallbackThreadIntervalMinutes(
        (await getState()).autoRunFallbackThreadIntervalMinutes
      );
      if (fallbackThreadIntervalMinutes <= 0) {
        return false;
      }

      const currentRuntime = runtime.get();
      const statusLabel = roundSummary?.status === 'failed' ? 'failed' : 'completed';
      await addLog(
        `Thread interval: Round ${targetRun}/${totalRuns} ${statusLabel}, waiting ${fallbackThreadIntervalMinutes} minutes before next round.`,
        'info'
      );
      await persistAutoRunTimerPlan({
        kind: AUTO_RUN_TIMER_KIND_BETWEEN_ROUNDS,
        fireAt: Date.now() + fallbackThreadIntervalMinutes * 60 * 1000,
        currentRun: targetRun,
        totalRuns,
        attemptRun: currentRuntime.autoRunAttemptRun,
        autoRunSessionId: currentRuntime.autoRunSessionId,
        autoRunSkipFailures,
        roundSummaries,
        countdownTitle: 'Thread interval in progress',
        countdownNote: `Round ${Math.min(targetRun + 1, totalRuns)}/${totalRuns} about to start`,
      }, {
        autoRunSkipFailures,
        autoRunRoundSummaries: serializeAutoRunRoundSummaries(totalRuns, roundSummaries),
      });
      runtime.set({ autoRunActive: false });
      return true;
    }

    async function waitBeforeAutoRunRetry(targetRun, totalRuns, nextAttemptRun, options = {}) {
      const { autoRunSkipFailures = false, roundSummaries = [] } = options;
      const fallbackThreadIntervalMinutes = normalizeAutoRunFallbackThreadIntervalMinutes(
        (await getState()).autoRunFallbackThreadIntervalMinutes
      );
      if (fallbackThreadIntervalMinutes <= 0) {
        return false;
      }

      await addLog(
        `Thread interval: Waiting ${fallbackThreadIntervalMinutes} minutes before starting Round ${targetRun}/${totalRuns} attempt ${nextAttemptRun}.`,
        'info'
      );
      await persistAutoRunTimerPlan({
        kind: AUTO_RUN_TIMER_KIND_BEFORE_RETRY,
        fireAt: Date.now() + fallbackThreadIntervalMinutes * 60 * 1000,
        currentRun: targetRun,
        totalRuns,
        attemptRun: nextAttemptRun,
        autoRunSessionId: runtime.get().autoRunSessionId,
        autoRunSkipFailures,
        roundSummaries,
        countdownTitle: 'Thread interval in progress',
        countdownNote: `Round ${targetRun}/${totalRuns} attempt ${nextAttemptRun} about to start`,
      }, {
        autoRunSkipFailures,
        autoRunRoundSummaries: serializeAutoRunRoundSummaries(totalRuns, roundSummaries),
      });
      runtime.set({ autoRunActive: false });
      return true;
    }

    async function handleAutoRunLoopUnhandledError(error) {
      const currentRuntime = runtime.get();
      console.error('Auto run loop crashed:', error);
      if (!isStopError(error)) {
        await addLog(`Auto-run terminated abnormally: ${getErrorMessage(error) || 'Unknown error'}`, 'error');
      }

      runtime.set({ autoRunActive: false, autoRunSessionId: 0 });
      await broadcastAutoRunStatus('stopped', {
        currentRun: currentRuntime.autoRunCurrentRun,
        totalRuns: currentRuntime.autoRunTotalRuns,
        attemptRun: currentRuntime.autoRunAttemptRun,
        sessionId: 0,
      }, {
        autoRunSessionId: 0,
        autoRunTimerPlan: null,
      });
      clearStopRequest();
    }

    function startAutoRunLoop(totalRuns, options = {}) {
      autoRunLoop(totalRuns, options).catch((error) => {
        handleAutoRunLoopUnhandledError(error).catch(() => {});
      });
    }

    async function autoRunLoop(totalRuns, options = {}) {
      let currentRuntime = runtime.get();
      if (currentRuntime.autoRunActive) {
        await addLog('Auto-run is already in progress', 'warn');
        return;
      }

      let sessionId = Number.isInteger(options.autoRunSessionId) && options.autoRunSessionId > 0
        ? options.autoRunSessionId
        : 0;
      if (sessionId) {
        throwIfAutoRunSessionStopped(sessionId);
      } else {
        sessionId = createAutoRunSessionId();
      }

      clearStopRequest();
      runtime.set({
        autoRunActive: true,
        autoRunTotalRuns: totalRuns,
        autoRunCurrentRun: 0,
        autoRunAttemptRun: 0,
        autoRunSessionId: sessionId,
      });
      currentRuntime = runtime.get();

      const autoRunSkipFailures = Boolean(options.autoRunSkipFailures);
      const initialMode = options.mode === 'continue' ? 'continue' : 'restart';
      const resumeCurrentRun = Number.isInteger(options.resumeCurrentRun) && options.resumeCurrentRun > 0
        ? Math.min(totalRuns, options.resumeCurrentRun)
        : 1;
      const resumeAttemptRun = Number.isInteger(options.resumeAttemptRun) && options.resumeAttemptRun > 0
        ? Math.min(AUTO_RUN_MAX_RETRIES_PER_ROUND + 1, options.resumeAttemptRun)
        : 1;
      let continueCurrentOnFirstAttempt = initialMode === 'continue';
      let forceFreshTabsNextRun = false;
      let stoppedEarly = false;
      let parkedByTimer = false;
      const roundSummaries = buildAutoRunRoundSummaries(totalRuns, options.resumeRoundSummaries);

      if (continueCurrentOnFirstAttempt && resumeCurrentRun > 1) {
        for (let round = 1; round < resumeCurrentRun; round += 1) {
          const summary = roundSummaries[round - 1];
          if (summary.status === 'pending') {
            summary.status = 'success';
            if (!summary.attempts) {
              summary.attempts = 1;
            }
          }
        }
      }

      let successfulRuns = roundSummaries.filter((item) => item.status === 'success').length;
      const initialState = await getState();
      const initialPhase = continueCurrentOnFirstAttempt && getRunningWorkflowNodes(initialState).length
        ? 'waiting_step'
        : 'running';
      const showResumePosition = continueCurrentOnFirstAttempt || resumeCurrentRun > 1 || resumeAttemptRun > 1;

      await setState({
        autoRunSessionId: sessionId,
        autoRunSkipFailures,
        autoRunRoundSummaries: serializeAutoRunRoundSummaries(totalRuns, roundSummaries),
        ...getAutoRunStatusPayload(initialPhase, {
          currentRun: showResumePosition ? resumeCurrentRun : 0,
          totalRuns,
          attemptRun: showResumePosition ? resumeAttemptRun : 0,
          sessionId,
        }),
      });

      for (let targetRun = resumeCurrentRun; targetRun <= totalRuns; targetRun += 1) {
        const roundSummary = roundSummaries[targetRun - 1];
        let roundRecordAppended = false;
        const resumingCurrentRound = continueCurrentOnFirstAttempt && targetRun === resumeCurrentRun;
        let attemptRun = resumingCurrentRound ? resumeAttemptRun : 1;
        let reuseExistingProgress = resumingCurrentRound;
        const currentRoundState = await getState();
        const keepSameEmailUntilAddPhone = autoRunSkipFailures && shouldKeepCustomMailProviderPoolEmail(currentRoundState);
        const maxAttemptsForRound = autoRunSkipFailures
          ? (keepSameEmailUntilAddPhone ? Number.MAX_SAFE_INTEGER : AUTO_RUN_MAX_RETRIES_PER_ROUND + 1)
          : Math.max(1, attemptRun);

        while (attemptRun <= maxAttemptsForRound) {
          runtime.set({
            autoRunCurrentRun: targetRun,
            autoRunAttemptRun: attemptRun,
          });
          roundSummary.attempts = attemptRun;
          const attemptState = await getState();
          const defaultStartNodeId = resolveFreshStartNodeId(attemptState);
          let startNodeId = defaultStartNodeId;
          let useExistingProgress = false;

          if (reuseExistingProgress) {
            let currentState = attemptState;
            if (getRunningWorkflowNodes(currentState).length) {
              currentState = await waitForRunningWorkflowNodesToFinish({
                currentRun: targetRun,
                totalRuns,
                attemptRun,
              });
            }
            const resumeNodeId = getFirstUnfinishedWorkflowNode(currentState);
            if (resumeNodeId && hasSavedWorkflowProgress(currentState)) {
              startNodeId = resumeNodeId;
              useExistingProgress = true;
            } else if (hasSavedWorkflowProgress(currentState)) {
              await addLog('Current flow already processed — this round will restart from the first node.', 'info');
            }
          }

          if (!useExistingProgress) {
            const prevState = attemptState;
            const keepSettings = {
              ...buildFreshAttemptKeepState(prevState, {
                targetRun,
                totalRuns,
                attemptRun,
                sessionId,
              }),
              currentNodeId: '',
              nodeStatuses: buildFreshAttemptNodeStatuses(prevState),
              autoRunRoundSummaries: serializeAutoRunRoundSummaries(totalRuns, roundSummaries),
              autoRunSessionId: sessionId,
              tabRegistry: {},
              sourceLastUrls: {},
              ...getAutoRunStatusPayload('running', { currentRun: targetRun, totalRuns, attemptRun, sessionId }),
            };
            await resetState();
            await setState(keepSettings);
            deps.chrome.runtime.sendMessage({ type: 'AUTO_RUN_RESET' }).catch(() => { });
            await sleepWithStop(500);
          } else {
            await setState({
              autoRunSessionId: sessionId,
              autoRunSkipFailures,
              autoRunRoundSummaries: serializeAutoRunRoundSummaries(totalRuns, roundSummaries),
              ...getAutoRunStatusPayload('running', { currentRun: targetRun, totalRuns, attemptRun, sessionId }),
            });
          }

          if (forceFreshTabsNextRun) {
            await addLog(`Previous attempt abandoned, now starting Round ${targetRun}/${totalRuns} attempt ${attemptRun}.`, 'warn');
            forceFreshTabsNextRun = false;
          }

          const appendRoundRecordIfNeeded = async (status, reason = '', errorLike = null) => {
            if (roundRecordAppended) {
              return;
            }

            if (typeof appendAccountRunRecord !== 'function') {
              return;
            }

            const recordState = await getState();
            const recordStatus = resolveAutoRunAccountRecordStatus(status, recordState, errorLike);
            const record = await appendAccountRunRecord(recordStatus, recordState, reason);
            if (record) {
              roundRecordAppended = true;
            }
          };

          try {
            throwIfAutoRunSessionStopped(sessionId);
            await broadcastAutoRunStatus('running', {
              currentRun: targetRun,
              totalRuns,
              attemptRun,
              sessionId,
            });

            if (!useExistingProgress && startNodeId === defaultStartNodeId && typeof ensureHotmailMailboxReadyForAutoRunRound === 'function') {
              await ensureHotmailMailboxReadyForAutoRunRound({
                targetRun,
                totalRuns,
                attemptRun,
                sessionId,
              });
            }

            await runAutoSequenceFromWorkflowNode(startNodeId, {
              targetRun,
              totalRuns,
              attemptRuns: attemptRun,
              continued: useExistingProgress,
            });

            roundSummary.status = 'success';
            roundSummary.finalFailureReason = '';
            successfulRuns += 1;
            await setState({
              autoRunRoundSummaries: serializeAutoRunRoundSummaries(totalRuns, roundSummaries),
            });
            await addLog(`=== Round ${targetRun}/${totalRuns} completed (attempt ${attemptRun} succeeded) ===`, 'ok');
            break;
          } catch (err) {
            if (isStopError(err)) {
              stoppedEarly = true;
              await appendRoundRecordIfNeeded('stopped', getErrorMessage(err), err);
              await addLog(`Round ${targetRun}/${totalRuns} stopped by user`, 'warn');
              await broadcastAutoRunStatus('stopped', {
                currentRun: targetRun,
                totalRuns,
                attemptRun,
                sessionId: 0,
              });
              break;
            }

            const reason = getErrorMessage(err);
            roundSummary.failureReasons.push(reason);
            const blockedByPhoneSmsRateLimit = typeof isPhoneSmsPlatformRateLimitFailure === 'function'
              && isPhoneSmsPlatformRateLimitFailure(err);
            const blockedByPhoneNoSupply = !blockedByPhoneSmsRateLimit
              && isPhoneNumberSupplyExhaustedFailure(err);
            const blockedByAddPhone = !blockedByPhoneSmsRateLimit
              && !blockedByPhoneNoSupply
              && typeof isAddPhoneAuthFailure === 'function'
              && isAddPhoneAuthFailure(err);
            const blockedByPlusNonFreeTrial = typeof isPlusCheckoutNonFreeTrialFailure === 'function'
              && isPlusCheckoutNonFreeTrialFailure(err);
            const blockedByGpcTaskEnded = typeof isGpcTaskEndedFailure === 'function'
              ? isGpcTaskEndedFailure(err)
              : /GPC_TASK_ENDED::/i.test(err?.message || String(err || ''));
            const blockedBySignupUserAlreadyExists = typeof isSignupUserAlreadyExistsFailure === 'function'
              && !keepSameEmailUntilAddPhone
              && isSignupUserAlreadyExistsFailure(err);
            const blockedByStep4Route405 = typeof isStep4Route405RecoveryLimitFailure === 'function'
              && isStep4Route405RecoveryLimitFailure(err);
            const blockedByKiroProxy = typeof isKiroProxyFailure === 'function'
              && isKiroProxyFailure(err);
            const canRetry = !blockedByAddPhone
              && !blockedByPhoneNoSupply
              && !blockedByPlusNonFreeTrial
              && !blockedByGpcTaskEnded
              && !blockedBySignupUserAlreadyExists
              && !blockedByStep4Route405
              && !blockedByKiroProxy
              && autoRunSkipFailures
              && attemptRun < maxAttemptsForRound;

            await setState({
              autoRunRoundSummaries: serializeAutoRunRoundSummaries(totalRuns, roundSummaries),
            });

            if (blockedByAddPhone) {
              roundSummary.status = 'failed';
              roundSummary.finalFailureReason = reason;
              await setState({
                autoRunRoundSummaries: serializeAutoRunRoundSummaries(totalRuns, roundSummaries),
              });
              await appendRoundRecordIfNeeded('failed', reason, err);
              cancelPendingCommands('Current round aborted due to add-phone authentication.');
              await broadcastStopToContentScripts();
              if (!autoRunSkipFailures) {
                await addLog(
                  `Round ${targetRun}/${totalRuns} hit add-phone/phone page, auto-retry not enabled, auto-run will stop.`,
                  'warn'
                );
                stoppedEarly = true;
                await broadcastAutoRunStatus('stopped', {
                  currentRun: targetRun,
                  totalRuns,
                  attemptRun,
                  sessionId: 0,
                });
                break;
              }

              await addLog(`Round ${targetRun}/${totalRuns} hit add-phone/phone page, this round will fail directly and skip remaining retries.`, 'warn');
              await addLog(
                targetRun < totalRuns
                  ? `Round ${targetRun}/${totalRuns} ended early due to add-phone/phone page, auto-run will continue to next round.`
                  : `Round ${targetRun}/${totalRuns} ended early due to add-phone/phone page, no remaining rounds, auto-run finished.`,
                'warn'
              );
              forceFreshTabsNextRun = true;
              break;
            }

            if (blockedByPhoneNoSupply) {
              roundSummary.status = 'failed';
              roundSummary.finalFailureReason = reason;
              await setState({
                autoRunRoundSummaries: serializeAutoRunRoundSummaries(totalRuns, roundSummaries),
              });
              await appendRoundRecordIfNeeded('failed', reason, err);
              cancelPendingCommands('Current round aborted due to no available SMS numbers.');
              await broadcastStopToContentScripts();
              if (!autoRunSkipFailures) {
                await addLog(
                  `Round ${targetRun}/${totalRuns} no SMS numbers available, auto-retry not enabled, auto-run will stop.`,
                  'warn'
                );
                stoppedEarly = true;
                await broadcastAutoRunStatus('stopped', {
                  currentRun: targetRun,
                  totalRuns,
                  attemptRun,
                  sessionId: 0,
                });
                break;
              }

              await addLog(`Round ${targetRun}/${totalRuns} no SMS numbers available, this round will fail directly and skip remaining retries.`, 'warn');
              await addLog(
                targetRun < totalRuns
                  ? `Round ${targetRun}/${totalRuns} ended early due to no SMS numbers, auto-run will continue to next round.`
                  : `Round ${targetRun}/${totalRuns} ended early due to no SMS numbers, no remaining rounds, auto-run finished.`,
                'warn'
              );
              forceFreshTabsNextRun = true;
              break;
            }

            if (blockedByPlusNonFreeTrial) {
              roundSummary.status = 'failed';
              roundSummary.finalFailureReason = reason;
              await setState({
                autoRunRoundSummaries: serializeAutoRunRoundSummaries(totalRuns, roundSummaries),
              });
              await appendRoundRecordIfNeeded('failed', reason, err);
              cancelPendingCommands('Current round aborted because Plus free trial eligibility is unavailable.');
              await broadcastStopToContentScripts();
              if (!autoRunSkipFailures) {
                await addLog(
                  `Round ${targetRun}/${totalRuns} detected non-zero Plus charge today, auto-retry not enabled, auto-run will stop.`,
                  'warn'
                );
                stoppedEarly = true;
                await broadcastAutoRunStatus('stopped', {
                  currentRun: targetRun,
                  totalRuns,
                  attemptRun,
                  sessionId: 0,
                });
                break;
              }

              await addLog(`Round ${targetRun}/${totalRuns} has no Plus free trial eligibility, this round will fail directly and skip remaining retries.`, 'warn');
              await addLog(
                targetRun < totalRuns
                  ? `Round ${targetRun}/${totalRuns} ended early because Plus charge today is non-zero, auto-run will continue to next round.`
                  : `Round ${targetRun}/${totalRuns} ended early because Plus charge today is non-zero, no remaining rounds, auto-run finished.`,
                'warn'
              );
              forceFreshTabsNextRun = true;
              break;
            }

            if (blockedByGpcTaskEnded) {
              roundSummary.status = 'failed';
              roundSummary.finalFailureReason = reason;
              await setState({
                autoRunRoundSummaries: serializeAutoRunRoundSummaries(totalRuns, roundSummaries),
              });
              await appendRoundRecordIfNeeded('failed', reason, err);
              cancelPendingCommands('Current round aborted because GPC task ended.');
              await broadcastStopToContentScripts();
              if (!autoRunSkipFailures) {
                await addLog(
                  `Round ${targetRun}/${totalRuns} GPC task ended, auto-retry not enabled, auto-run will stop.`,
                  'warn'
                );
                stoppedEarly = true;
                await broadcastAutoRunStatus('stopped', {
                  currentRun: targetRun,
                  totalRuns,
                  attemptRun,
                  sessionId: 0,
                });
                break;
              }

              await addLog(`Round ${targetRun}/${totalRuns} GPC task ended, this round will fail directly and skip remaining retries.`, 'warn');
              await addLog(
                targetRun < totalRuns
                  ? `Round ${targetRun}/${totalRuns} ended early because GPC task ended, auto-run will continue to next round.`
                  : `Round ${targetRun}/${totalRuns} ended early because GPC task ended, no remaining rounds, auto-run finished.`,
                'warn'
              );
              forceFreshTabsNextRun = true;
              break;
            }

            if (blockedBySignupUserAlreadyExists) {
              roundSummary.status = 'failed';
              roundSummary.finalFailureReason = reason;
              await setState({
                autoRunRoundSummaries: serializeAutoRunRoundSummaries(totalRuns, roundSummaries),
              });
              await appendRoundRecordIfNeeded('failed', reason, err);
              cancelPendingCommands('Current round aborted because of user_already_exists.');
              await broadcastStopToContentScripts();
              if (!autoRunSkipFailures) {
                await addLog(
                  `Round ${targetRun}/${totalRuns} hit user_already_exists/user already exists, auto-retry not enabled, auto-run will stop.`,
                  'warn'
                );
                stoppedEarly = true;
                await broadcastAutoRunStatus('stopped', {
                  currentRun: targetRun,
                  totalRuns,
                  attemptRun,
                  sessionId: 0,
                });
                break;
              }

              await addLog(`Round ${targetRun}/${totalRuns} hit user_already_exists/user already exists, this round will fail directly and skip remaining retries.`, 'warn');
              await addLog(
                targetRun < totalRuns
                  ? `Round ${targetRun}/${totalRuns} ended early due to user_already_exists/user already exists, auto-run will continue to next round.`
                  : `Round ${targetRun}/${totalRuns} ended early due to user_already_exists/user already exists, no remaining rounds, auto-run finished.`,
                'warn'
              );
              forceFreshTabsNextRun = true;
              break;
            }

            if (blockedByStep4Route405) {
              roundSummary.status = 'failed';
              roundSummary.finalFailureReason = reason;
              await setState({
                autoRunRoundSummaries: serializeAutoRunRoundSummaries(totalRuns, roundSummaries),
              });
              await appendRoundRecordIfNeeded('failed', reason, err);
              cancelPendingCommands('Current round aborted due to Step 4 consecutive 405 errors.');
              await broadcastStopToContentScripts();
              if (!autoRunSkipFailures) {
                await addLog(
                  `Round ${targetRun}/${totalRuns} Step 4 consecutive 405 recovery failed, auto-retry not enabled, auto-run will stop.`,
                  'warn'
                );
                stoppedEarly = true;
                await broadcastAutoRunStatus('stopped', {
                  currentRun: targetRun,
                  totalRuns,
                  attemptRun,
                  sessionId: 0,
                });
                break;
              }

              await addLog(`Round ${targetRun}/${totalRuns} Step 4 consecutive 405 recovery failed, this round will fail directly and skip remaining retries.`, 'warn');
              await addLog(
                targetRun < totalRuns
                  ? `Round ${targetRun}/${totalRuns} ended early due to Step 4 consecutive 405, auto-run will continue to next round.`
                  : `Round ${targetRun}/${totalRuns} ended early due to Step 4 consecutive 405, no remaining rounds, auto-run finished.`,
                'warn'
              );
              forceFreshTabsNextRun = true;
              break;
            }

            if (blockedByKiroProxy) {
              roundSummary.status = 'failed';
              roundSummary.finalFailureReason = reason;
              await setState({
                autoRunRoundSummaries: serializeAutoRunRoundSummaries(totalRuns, roundSummaries),
              });
              await appendRoundRecordIfNeeded('failed', reason, err);
              cancelPendingCommands('Current round detected Kiro proxy error page, auto-run stopped, waiting for user to switch proxy.');
              await broadcastStopToContentScripts();
              await addLog(`Round ${targetRun}/${totalRuns} detected Kiro proxy error page: ${reason}`, 'error');
              await addLog('Current proxy may be unavailable. Please switch proxy before continuing. Auto-run stopped.', 'warn');
              stoppedEarly = true;
              await broadcastAutoRunStatus('stopped', {
                currentRun: targetRun,
                totalRuns,
                attemptRun,
                sessionId: 0,
              });
              break;
            }

            if (canRetry) {
              const retryIndex = attemptRun;
              if (isRestartCurrentAttemptError(err)) {
                await addLog(`Round ${targetRun}/${totalRuns} attempt ${attemptRun} requires full restart: ${reason}`, 'warn');
              } else {
                await addLog(`Round ${targetRun}/${totalRuns} attempt ${attemptRun} failed: ${reason}`, 'error');
              }
              cancelPendingCommands('Current attempt abandoned.');
              await broadcastStopToContentScripts();
              await broadcastAutoRunStatus('retrying', {
                currentRun: targetRun,
                totalRuns,
                attemptRun,
                sessionId,
              });
              forceFreshTabsNextRun = true;
              await addLog(
                keepSameEmailUntilAddPhone
                  ? `Auto-retry: continuing with current email after ${Math.round(AUTO_RUN_RETRY_DELAY_MS / 1000)} seconds, starting Round ${targetRun}/${totalRuns} attempt ${attemptRun + 1}.`
                  : `Auto-retry: starting Round ${targetRun}/${totalRuns} attempt ${attemptRun + 1} (retry ${retryIndex}/${AUTO_RUN_MAX_RETRIES_PER_ROUND}) after ${Math.round(AUTO_RUN_RETRY_DELAY_MS / 1000)} seconds.`,
                'warn'
              );
              try {
                await sleepWithStop(AUTO_RUN_RETRY_DELAY_MS);
              } catch (sleepError) {
                if (isStopError(sleepError)) {
                  stoppedEarly = true;
                  await appendRoundRecordIfNeeded('stopped', getErrorMessage(sleepError), sleepError);
                  await addLog(`Round ${targetRun}/${totalRuns} stopped by user`, 'warn');
                  await broadcastAutoRunStatus('stopped', {
                    currentRun: targetRun,
                    totalRuns,
                    attemptRun,
                    sessionId: 0,
                  });
                  break;
                }
                throw sleepError;
              }
              try {
                const parkedForRetry = await waitBeforeAutoRunRetry(targetRun, totalRuns, attemptRun + 1, {
                  autoRunSkipFailures,
                  roundSummaries,
                });
                if (parkedForRetry) {
                  parkedByTimer = true;
                  break;
                }
              } catch (sleepError) {
                if (isStopError(sleepError)) {
                  stoppedEarly = true;
                  await appendRoundRecordIfNeeded('stopped', getErrorMessage(sleepError), sleepError);
                  await addLog(`Round ${targetRun}/${totalRuns} stopped by user`, 'warn');
                  await broadcastAutoRunStatus('stopped', {
                    currentRun: targetRun,
                    totalRuns,
                    attemptRun,
                    sessionId: 0,
                  });
                  break;
                }
                throw sleepError;
              }
              attemptRun += 1;
              reuseExistingProgress = false;
              continue;
            }

            roundSummary.status = 'failed';
            roundSummary.finalFailureReason = reason;
            await setState({
              autoRunRoundSummaries: serializeAutoRunRoundSummaries(totalRuns, roundSummaries),
            });
            await appendRoundRecordIfNeeded('failed', reason, err);
            if (!autoRunSkipFailures) {
              cancelPendingCommands('Current round execution failed.');
              await broadcastStopToContentScripts();
              await addLog('Auto-retry not enabled, auto-run will stop on this failure.', 'warn');
              stoppedEarly = true;
              await broadcastAutoRunStatus('stopped', {
                currentRun: targetRun,
                totalRuns,
                attemptRun,
                sessionId: 0,
              });
              break;
            }
            await addLog(`Round ${targetRun}/${totalRuns} final failure: ${reason}`, 'error');
            await addLog(
              targetRun < totalRuns
                ? `Round ${targetRun}/${totalRuns} reached retry limit of ${AUTO_RUN_MAX_RETRIES_PER_ROUND}, continuing to next round.`
                : `Round ${targetRun}/${totalRuns} reached retry limit of ${AUTO_RUN_MAX_RETRIES_PER_ROUND}, auto-run finished.`,
              'warn'
            );
            cancelPendingCommands('Current round reached retry limit.');
            await broadcastStopToContentScripts();
            forceFreshTabsNextRun = true;
            break;
          } finally {
            reuseExistingProgress = false;
            continueCurrentOnFirstAttempt = false;
          }
        }

        if (stoppedEarly || parkedByTimer) {
          break;
        }

        try {
          const parkedForNextRound = await waitBetweenAutoRunRounds(targetRun, totalRuns, roundSummary, {
            autoRunSkipFailures,
            roundSummaries,
          });
          if (parkedForNextRound) {
            parkedByTimer = true;
            break;
          }
        } catch (sleepError) {
          if (isStopError(sleepError)) {
            stoppedEarly = true;
            await addLog(`Round ${targetRun}/${totalRuns} stopped by user`, 'warn');
            await broadcastAutoRunStatus('stopped', {
              currentRun: targetRun,
              totalRuns,
              attemptRun: runtime.get().autoRunAttemptRun,
              sessionId: 0,
            });
            break;
          }
          throw sleepError;
        }
      }

      if (parkedByTimer) {
        runtime.set({ autoRunActive: false });
        clearStopRequest();
        return;
      }

      await setState({
        autoRunRoundSummaries: serializeAutoRunRoundSummaries(totalRuns, roundSummaries),
      });
      await logAutoRunFinalSummary(totalRuns, roundSummaries);

      const finalRuntime = runtime.get();
      if (deps.getStopRequested() || stoppedEarly) {
        await addLog(`=== Stopped, completed ${successfulRuns}/${finalRuntime.autoRunTotalRuns} rounds ===`, 'warn');
        await broadcastAutoRunStatus('stopped', {
          currentRun: finalRuntime.autoRunCurrentRun,
          totalRuns: finalRuntime.autoRunTotalRuns,
          attemptRun: finalRuntime.autoRunAttemptRun,
          sessionId: 0,
        });
      } else {
        await addLog(`=== All ${finalRuntime.autoRunTotalRuns} rounds completed, ${successfulRuns} succeeded ===`, 'ok');
        await broadcastAutoRunStatus('complete', {
          currentRun: finalRuntime.autoRunTotalRuns,
          totalRuns: finalRuntime.autoRunTotalRuns,
          attemptRun: finalRuntime.autoRunAttemptRun,
          sessionId: 0,
        });
      }
      runtime.set({ autoRunActive: false, autoRunSessionId: 0 });
      const afterRuntime = runtime.get();
      await setState({
        autoRunSessionId: 0,
        autoRunRoundSummaries: serializeAutoRunRoundSummaries(totalRuns, roundSummaries),
        autoRunTimerPlan: null,
        ...getAutoRunStatusPayload(deps.getStopRequested() || stoppedEarly ? 'stopped' : 'complete', {
          currentRun: deps.getStopRequested() || stoppedEarly ? afterRuntime.autoRunCurrentRun : afterRuntime.autoRunTotalRuns,
          totalRuns: afterRuntime.autoRunTotalRuns,
          attemptRun: afterRuntime.autoRunAttemptRun,
          sessionId: 0,
        }),
      });
      clearStopRequest();
    }

    return {
      autoRunLoop,
      buildAutoRunRoundSummaries,
      createAutoRunRoundSummary,
      formatAutoRunFailureReasons,
      getAutoRunRoundRetryCount,
      handleAutoRunLoopUnhandledError,
      logAutoRunFinalSummary,
      normalizeAutoRunRoundSummary,
      resolveAutoRunAccountRecordStatus,
      serializeAutoRunRoundSummaries,
      skipAutoRunCountdown,
      startAutoRunLoop,
      waitBetweenAutoRunRounds,
      waitBeforeAutoRunRetry,
    };
  }

  return {
    createAutoRunController,
  };
});
