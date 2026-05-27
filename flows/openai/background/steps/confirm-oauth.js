(function attachBackgroundStep9(root, factory) {
  root.MultiPageBackgroundStep9 = factory();
})(typeof self !== 'undefined' ? self : globalThis, function createBackgroundStep9Module() {
  function createStep9Executor(deps = {}) {
    const {
      addLog,
      chrome,
      cleanupStep8NavigationListeners,
      clickWithDebugger,
      completeNodeFromBackground,
      ensureStep8SignupPageReady,
      getOAuthFlowRemainingMs,
      getOAuthFlowStepTimeoutMs,
      getStep8CallbackUrlFromNavigation,
      getStep8CallbackUrlFromTabUpdate,
      getStep8EffectLabel,
      getTabId,
      isTabAlive,
      prepareStep8DebuggerClick,
      recoverOAuthLocalhostTimeout,
      reloadStep8ConsentPage,
      reuseOrCreateTab,
      sleepWithStop,
      STEP8_CLICK_RETRY_DELAY_MS,
      STEP8_MAX_ROUNDS,
      STEP8_READY_WAIT_TIMEOUT_MS,
      STEP8_STRATEGIES,
      throwIfStep8SettledOrStopped,
      triggerStep8ContentStrategy,
      waitForStep8ClickEffect,
      waitForStep8Ready,
      setWebNavListener,
      setWebNavCommittedListener,
      setStep8PendingReject,
      setStep8TabUpdatedListener,
      shouldDeferStep9CallbackTimeout,
      getStepIdByKeyForState = null,
    } = deps;

    const LOCALHOST_CALLBACK_LOCAL_TIMEOUT_MS = 240000;
    const CALLBACK_TIMEOUT_CHECK_INTERVAL_MS = 1000;

    function getVisibleStep(state, fallback = 9) {
      const visibleStep = Math.floor(Number(state?.visibleStep) || 0);
      return visibleStep > 0 ? visibleStep : fallback;
    }

    function getAuthLoginStepForVisibleStep(visibleStep) {
      return visibleStep >= 12 ? Math.max(1, visibleStep - 3) : 7;
    }

    function getAuthLoginStepForState(state = {}, visibleStep = 9) {
      const authStep = typeof getStepIdByKeyForState === 'function'
        ? Number(getStepIdByKeyForState('oauth-login', state))
        : 0;
      if (Number.isInteger(authStep) && authStep > 0) {
        return authStep;
      }
      return getAuthLoginStepForVisibleStep(visibleStep);
    }

    function addStepLog(step, message, level = 'info') {
      return addLog(message, level, { step, stepKey: 'confirm-oauth' });
    }

    async function executeStep9(state) {
      const visibleStep = getVisibleStep(state, 9);
      let activeState = state;

      if (!activeState.oauthUrl) {
        const authLoginStep = getAuthLoginStepForState(activeState, visibleStep);
        throw new Error(`Missing OAuth login link, please complete step ${authLoginStep} first.`);
      }

      await addStepLog(visibleStep, 'Listening for localhost callback URL...');

      let callbackTimeoutMs = LOCALHOST_CALLBACK_LOCAL_TIMEOUT_MS;
      let timeoutRecoveryAttempted = false;
      while (true) {
        try {
          callbackTimeoutMs = typeof getOAuthFlowStepTimeoutMs === 'function'
            ? await getOAuthFlowStepTimeoutMs(LOCALHOST_CALLBACK_LOCAL_TIMEOUT_MS, {
              step: visibleStep,
              actionLabel: 'OAuth localhost callback',
              oauthUrl: activeState?.oauthUrl || '',
            })
            : LOCALHOST_CALLBACK_LOCAL_TIMEOUT_MS;
          break;
        } catch (error) {
          if (timeoutRecoveryAttempted || typeof recoverOAuthLocalhostTimeout !== 'function') {
            throw error;
          }
          const recoveredState = await recoverOAuthLocalhostTimeout({
            error,
            state: activeState,
            visibleStep,
          });
          if (!recoveredState) {
            throw error;
          }
          activeState = recoveredState;
          timeoutRecoveryAttempted = true;
        }
      }

      return new Promise((resolve, reject) => {
        let resolved = false;
        let signupTabId = null;
        const callbackWaitStartedAt = Date.now();
        let timeoutCheckTimer = null;
        let timeoutDeferredLogged = false;

        const cleanupListener = () => {
          if (timeoutCheckTimer) {
            clearTimeout(timeoutCheckTimer);
            timeoutCheckTimer = null;
          }
          cleanupStep8NavigationListeners();
          setStep8PendingReject(null);
        };

        const rejectStep9 = (error) => {
          if (resolved) return;
          resolved = true;
          cleanupListener();
          reject(error);
        };

        const finalizeStep9Callback = (callbackUrl) => {
          if (resolved || !callbackUrl) return;

          resolved = true;
          cleanupListener();

          addStepLog(visibleStep, `Captured localhost URL: ${callbackUrl}`, 'ok').then(() => {
            return completeNodeFromBackground(state?.nodeId || 'confirm-oauth', { localhostUrl: callbackUrl });
          }).then(() => {
            resolve();
          }).catch((err) => {
            reject(err);
          });
        };

        const isCallbackTimeoutDeferred = async (elapsedMs) => {
          if (typeof shouldDeferStep9CallbackTimeout !== 'function') {
            return false;
          }
          try {
            const deferred = await shouldDeferStep9CallbackTimeout({
              tabId: signupTabId,
              visibleStep,
              elapsedMs,
              oauthUrl: activeState?.oauthUrl || '',
            });
            if (deferred && !timeoutDeferredLogged) {
              timeoutDeferredLogged = true;
              await addStepLog(
                visibleStep,
                'Detected that auth page is still in security verification/authorization redirect, pausing local callback timeout check, continuing to wait for localhost callback...',
                'info'
              );
            }
            return Boolean(deferred);
          } catch (error) {
            await addStepLog(
              visibleStep,
              `Failed to verify auth page redirect status (${error?.message || error}), continuing to wait for callback per original timeout rules.`,
              'warn'
            );
            return false;
          }
        };

        const checkCallbackTimeout = async () => {
          if (resolved) {
            return;
          }
          const elapsedMs = Date.now() - callbackWaitStartedAt;
          if (await isCallbackTimeoutDeferred(elapsedMs)) {
            timeoutCheckTimer = setTimeout(checkCallbackTimeout, CALLBACK_TIMEOUT_CHECK_INTERVAL_MS);
            return;
          }

          if (elapsedMs >= LOCALHOST_CALLBACK_LOCAL_TIMEOUT_MS) {
            rejectStep9(new Error(`Did not capture localhost callback redirect within ${Math.round(LOCALHOST_CALLBACK_LOCAL_TIMEOUT_MS / 1000)} seconds, the click in step ${visibleStep} may have been intercepted.`));
            return;
          }

          if (typeof getOAuthFlowRemainingMs === 'function') {
            try {
              await getOAuthFlowRemainingMs({
                step: visibleStep,
                actionLabel: 'OAuth localhost callback',
                oauthUrl: activeState?.oauthUrl || '',
              });
            } catch (error) {
              rejectStep9(error);
              return;
            }
          } else if (elapsedMs >= callbackTimeoutMs) {
            rejectStep9(new Error(`Did not capture localhost callback redirect within ${Math.round(callbackTimeoutMs / 1000)} seconds, the click in step ${visibleStep} may have been intercepted.`));
            return;
          }

          timeoutCheckTimer = setTimeout(checkCallbackTimeout, CALLBACK_TIMEOUT_CHECK_INTERVAL_MS);
        };

        timeoutCheckTimer = setTimeout(
          checkCallbackTimeout,
          Math.min(CALLBACK_TIMEOUT_CHECK_INTERVAL_MS, Math.max(1, callbackTimeoutMs))
        );

        setStep8PendingReject((error) => {
          rejectStep9(error);
        });

        setWebNavListener((details) => {
          const callbackUrl = getStep8CallbackUrlFromNavigation(details, signupTabId);
          finalizeStep9Callback(callbackUrl);
        });

        setWebNavCommittedListener((details) => {
          const callbackUrl = getStep8CallbackUrlFromNavigation(details, signupTabId);
          finalizeStep9Callback(callbackUrl);
        });

        setStep8TabUpdatedListener((tabId, changeInfo, tab) => {
          const callbackUrl = getStep8CallbackUrlFromTabUpdate(tabId, changeInfo, tab, signupTabId);
          finalizeStep9Callback(callbackUrl);
        });

        (async () => {
          try {
            throwIfStep8SettledOrStopped(resolved);
            signupTabId = await getTabId('openai-auth');
            throwIfStep8SettledOrStopped(resolved);

            if (signupTabId && await isTabAlive('openai-auth')) {
              await chrome.tabs.update(signupTabId, { active: true });
              await addStepLog(visibleStep, 'Switched back to auth page, preparing debugger click...');
            } else {
              signupTabId = await reuseOrCreateTab('openai-auth', activeState.oauthUrl);
              await addStepLog(visibleStep, 'Reopened auth page, preparing debugger click...');
            }

            throwIfStep8SettledOrStopped(resolved);
            chrome.webNavigation.onBeforeNavigate.addListener(deps.getWebNavListener());
            chrome.webNavigation.onCommitted.addListener(deps.getWebNavCommittedListener());
            chrome.tabs.onUpdated.addListener(deps.getStep8TabUpdatedListener());
            await ensureStep8SignupPageReady(signupTabId, {
              timeoutMs: typeof getOAuthFlowStepTimeoutMs === 'function'
                ? await getOAuthFlowStepTimeoutMs(15000, {
                  step: visibleStep,
                  actionLabel: 'Wait for OAuth consent page content script to be ready',
                })
                : 15000,
              visibleStep,
              logStepKey: 'confirm-oauth',
              logMessage: 'Auth page content script not yet ready, waiting for page to recover...',
            });

            for (let round = 1; round <= STEP8_MAX_ROUNDS && !resolved; round++) {
              throwIfStep8SettledOrStopped(resolved);
              const pageState = await waitForStep8Ready(
                signupTabId,
                typeof getOAuthFlowStepTimeoutMs === 'function'
                  ? await getOAuthFlowStepTimeoutMs(STEP8_READY_WAIT_TIMEOUT_MS, {
                    step: visibleStep,
                    actionLabel: 'Wait for OAuth consent page to appear',
                  })
                  : STEP8_READY_WAIT_TIMEOUT_MS,
                { visibleStep }
              );
              if (!pageState?.consentReady) {
                await sleepWithStop(STEP8_CLICK_RETRY_DELAY_MS);
                continue;
              }

              const strategy = STEP8_STRATEGIES[Math.min(round - 1, STEP8_STRATEGIES.length - 1)];

              await addStepLog(visibleStep, `Round ${round}/${STEP8_MAX_ROUNDS} attempting to click "Continue" (${strategy.label})...`);

              if (strategy.mode === 'debugger') {
                const clickActionTimeoutMs = typeof getOAuthFlowStepTimeoutMs === 'function'
                  ? await getOAuthFlowStepTimeoutMs(15000, {
                    step: visibleStep,
                    actionLabel: 'Locate OAuth consent page Continue button',
                  })
                  : 15000;
                const clickTarget = await prepareStep8DebuggerClick(signupTabId, {
                  timeoutMs: clickActionTimeoutMs,
                  responseTimeoutMs: clickActionTimeoutMs,
                  visibleStep,
                });
                throwIfStep8SettledOrStopped(resolved);
                await clickWithDebugger(signupTabId, clickTarget?.rect, { visibleStep });
              } else {
                const clickActionTimeoutMs = typeof getOAuthFlowStepTimeoutMs === 'function'
                  ? await getOAuthFlowStepTimeoutMs(15000, {
                    step: visibleStep,
                    actionLabel: 'Click OAuth consent page Continue button',
                  })
                  : 15000;
                await triggerStep8ContentStrategy(signupTabId, strategy.strategy, {
                  timeoutMs: clickActionTimeoutMs,
                  responseTimeoutMs: clickActionTimeoutMs,
                  visibleStep,
                });
              }

              if (resolved) {
                return;
              }

              const effect = await waitForStep8ClickEffect(
                signupTabId,
                pageState.url,
                typeof getOAuthFlowStepTimeoutMs === 'function'
                  ? await getOAuthFlowStepTimeoutMs(15000, {
                    step: visibleStep,
                    actionLabel: 'Wait for OAuth consent page click to take effect',
                  })
                  : 15000,
                { visibleStep }
              );
              if (resolved) {
                return;
              }

              if (effect.progressed) {
                await addStepLog(visibleStep, `Detected that this click took effect, ${getStep8EffectLabel(effect)}, continuing to wait for localhost callback...`, 'info');
                break;
              }

              if (round >= STEP8_MAX_ROUNDS) {
                throw new Error(`Step ${visibleStep}: page still unresponsive after ${STEP8_MAX_ROUNDS} consecutive rounds of clicking "Continue".`);
              }

              await addStepLog(visibleStep, `${strategy.label} no page response after this round's click, refreshing auth page and retrying (next round ${round + 1}/${STEP8_MAX_ROUNDS})...`, 'warn');
              await reloadStep8ConsentPage(
                signupTabId,
                typeof getOAuthFlowStepTimeoutMs === 'function'
                  ? await getOAuthFlowStepTimeoutMs(30000, {
                    step: visibleStep,
                    actionLabel: 'Refresh OAuth consent page',
                  })
                  : 30000,
                { visibleStep }
              );
              await sleepWithStop(STEP8_CLICK_RETRY_DELAY_MS);
            }
          } catch (err) {
            rejectStep9(err);
          }
        })();
      });
    }

    return { executeStep9 };
  }

  return { createStep9Executor };
});
