(function attachSignupFlowHelpers(root, factory) {
  root.MultiPageSignupFlowHelpers = factory();
})(typeof self !== 'undefined' ? self : globalThis, function createSignupFlowHelpersModule() {
  function createSignupFlowHelpers(deps = {}) {
    const {
      addLog,
      buildGeneratedAliasEmail,
      chrome,
      ensureContentScriptReadyOnTab,
      ensureHotmailAccountForFlow,
      ensureMail2925AccountForFlow,
      ensureLuckmailPurchaseForFlow,
      fetchGeneratedEmail,
      isGeneratedAliasProvider,
      isReusableGeneratedAliasEmail,
      isHotmailProvider,
      isRetryableContentScriptTransportError = () => false,
      isLuckmailProvider,
      isSignupEmailVerificationPageUrl,
      isSignupPasswordPageUrl,
      isSignupPhoneVerificationPageUrl = null,
      isSignupProfilePageUrl = null,
      persistRegistrationEmailState = null,
      reuseOrCreateTab,
      sendToContentScriptResilient,
      setEmailState,
      setState,
      SIGNUP_ENTRY_URL,
      OPENAI_AUTH_INJECT_FILES,
      waitForTabStableComplete = null,
      waitForTabUrlMatch,
    } = deps;

    async function waitForSignupEntryTabToSettle(tabId, step = 1) {
      if (step !== 2 || !Number.isInteger(tabId) || typeof waitForTabStableComplete !== 'function') {
        return null;
      }

      // Do not request window focus here. The automation tab is already
      // locked to the selected Chrome window; raising that window would
      // interrupt the user's active workspace.

      if (typeof addLog === 'function') {
        await addLog(
          `步骤 ${step}：注册页已打开，正在等待页面加载完成并额外稳定 3 秒...`,
          'info',
          { step, stepKey: 'signup-entry' }
        );
      }

      return waitForTabStableComplete(tabId, {
        timeoutMs: 45000,
        retryDelayMs: 300,
        stableMs: 3000,
        initialDelayMs: 300,
      });
    }

    async function openSignupEntryTab(step = 1) {
      const tabId = await reuseOrCreateTab('openai-auth', SIGNUP_ENTRY_URL, {
        inject: OPENAI_AUTH_INJECT_FILES,
        injectSource: 'openai-auth',
        forceNew: Number(step) === 1,
      });

      await waitForSignupEntryTabToSettle(tabId, step);

      await ensureContentScriptReadyOnTab('openai-auth', tabId, {
        inject: OPENAI_AUTH_INJECT_FILES,
        injectSource: 'openai-auth',
        timeoutMs: 45000,
        retryDelayMs: 900,
        logMessage: `步骤 ${step}：ChatGPT 官网仍在加载，正在重试连接内容脚本...`,
      });

      return tabId;
    }

    async function ensureSignupEntryPageReady(step = 1) {
      const tabId = await openSignupEntryTab(step);
      const result = await sendToContentScriptResilient('openai-auth', {
        type: 'ENSURE_SIGNUP_ENTRY_READY',
        step,
        source: 'background',
        payload: {},
      }, {
        timeoutMs: 20000,
        retryDelayMs: 700,
        logMessage: `步骤 ${step}：官网注册入口正在切换，等待页面恢复...`,
      });

      if (result?.error) {
        throw new Error(result.error);
      }

      return { tabId, result: result || {} };
    }

    function parseUrlSafely(rawUrl) {
      if (!rawUrl) return null;
      try {
        return new URL(rawUrl);
      } catch {
        return null;
      }
    }

    function fallbackSignupPhoneVerificationPageUrl(rawUrl) {
      const parsed = parseUrlSafely(rawUrl);
      if (!parsed) return false;
      return /\/phone-verification(?:[/?#]|$)/i.test(parsed.pathname || '');
    }

    function fallbackSignupProfilePageUrl(rawUrl) {
      const parsed = parseUrlSafely(rawUrl);
      if (!parsed) return false;
      return /\/(?:create-account\/profile|u\/signup\/profile|signup\/profile|about-you)(?:[/?#]|$)/i.test(parsed.pathname || '');
    }

    function resolveSignupPostIdentityState(rawUrl) {
      if (isSignupPasswordPageUrl(rawUrl)) {
        return 'password_page';
      }
      if (isSignupEmailVerificationPageUrl(rawUrl)) {
        return 'verification_page';
      }
      const isPhoneVerificationUrl = typeof isSignupPhoneVerificationPageUrl === 'function'
        ? isSignupPhoneVerificationPageUrl(rawUrl)
        : fallbackSignupPhoneVerificationPageUrl(rawUrl);
      if (isPhoneVerificationUrl) {
        return 'phone_verification_page';
      }
      const isProfileUrl = typeof isSignupProfilePageUrl === 'function'
        ? isSignupProfilePageUrl(rawUrl)
        : fallbackSignupProfilePageUrl(rawUrl);
      if (isProfileUrl) {
        return 'profile_page';
      }
      return '';
    }

    async function ensureSignupPostIdentityPageReadyInTab(tabId, step = 2, options = {}) {
      const { skipUrlWait = false } = options;
      let landingUrl = '';
      let landingState = '';

      if (!skipUrlWait) {
        const matchedTab = await waitForTabUrlMatch(tabId, (url) => Boolean(resolveSignupPostIdentityState(url)), {
          timeoutMs: 45000,
          retryDelayMs: 300,
        });
        if (!matchedTab) {
          throw new Error('等待注册身份提交后的页面跳转超时，请检查页面是否仍停留在输入页。');
        }

        landingUrl = matchedTab.url || '';
        landingState = resolveSignupPostIdentityState(landingUrl);
      }

      if (!landingState) {
        try {
          const currentTab = await chrome.tabs.get(tabId);
          landingUrl = landingUrl || currentTab?.url || '';
          landingState = resolveSignupPostIdentityState(landingUrl);
        } catch {
          landingUrl = landingUrl || '';
        }
      }

      if (!landingState) {
        throw new Error(`注册身份提交后未能识别当前页面，既不是密码页、验证码页，也不是资料页。URL: ${landingUrl || 'unknown'}`);
      }

      if (landingState !== 'password_page' && typeof waitForTabStableComplete === 'function') {
        const stableTab = await waitForTabStableComplete(tabId, {
          timeoutMs: 45000,
          retryDelayMs: 300,
          stableMs: 800,
          initialDelayMs: 300,
        });
        if (stableTab?.url) {
          const stableState = resolveSignupPostIdentityState(stableTab.url);
          if (stableState) {
            landingUrl = stableTab.url;
            landingState = stableState;
          }
        }
      }

      await ensureContentScriptReadyOnTab('openai-auth', tabId, {
        inject: OPENAI_AUTH_INJECT_FILES,
        injectSource: 'openai-auth',
        timeoutMs: 45000,
        retryDelayMs: 900,
        logMessage: landingState === 'password_page'
          ? `步骤 ${step}：密码页仍在加载，正在重试连接内容脚本...`
          : `步骤 ${step}：注册后续页面仍在加载，正在等待页面恢复...`,
      });

      if (landingState !== 'password_page') {
        return {
          ready: true,
          state: landingState,
          url: landingUrl,
        };
      }

      const result = await sendToContentScriptResilient('openai-auth', {
        type: 'ENSURE_SIGNUP_PASSWORD_PAGE_READY',
        step,
        source: 'background',
        payload: {},
      }, {
        timeoutMs: 20000,
        retryDelayMs: 700,
        logMessage: `步骤 ${step}：认证页正在切换，等待密码页重新就绪...`,
      });

      if (result?.error) {
        throw new Error(result.error);
      }

      return {
        ...(result || {}),
        ready: true,
        state: landingState,
        url: landingUrl,
      };
    }

    async function ensureSignupPostEmailPageReadyInTab(tabId, step = 2, options = {}) {
      return ensureSignupPostIdentityPageReadyInTab(tabId, step, options);
    }

    async function ensureSignupPasswordPageReadyInTab(tabId, step = 2, options = {}) {
      const result = await ensureSignupPostEmailPageReadyInTab(tabId, step, options);
      if (result.state !== 'password_page') {
        throw new Error(`当前页面不是密码页，实际落地为 ${result.state || 'unknown'}。URL: ${result.url || 'unknown'}`);
      }
      return result;
    }

    async function finalizeSignupPasswordSubmitInTab(tabId, password = '', step = 3) {
      if (!Number.isInteger(tabId)) {
        throw new Error(`认证页面标签页已关闭，无法完成步骤 ${step} 的提交后确认。`);
      }

      await ensureContentScriptReadyOnTab('openai-auth', tabId, {
        inject: OPENAI_AUTH_INJECT_FILES,
        injectSource: 'openai-auth',
        timeoutMs: 45000,
        retryDelayMs: 900,
        logMessage: `步骤 ${step}：认证页仍在切换，正在等待页面恢复后继续确认提交流程...`,
      });

      let result;
      try {
        result = await sendToContentScriptResilient('openai-auth', {
          type: 'PREPARE_SIGNUP_VERIFICATION',
          step,
          source: 'background',
          payload: {
            password: password || '',
            prepareSource: 'step3_finalize',
            prepareLogLabel: '步骤 3 收尾',
          },
        }, {
          timeoutMs: 30000,
          retryDelayMs: 700,
          logMessage: `步骤 ${step}：密码已提交，正在确认是否进入下一页面，必要时自动恢复重试页...`,
        });
      } catch (error) {
        if (isRetryableContentScriptTransportError(error)) {
          const message = `步骤 ${step}：认证页在提交后切换过程中页面通信超时，未能重新就绪，暂时无法确认是否进入下一页面。请重试当前轮。`;
          if (typeof addLog === 'function') {
            await addLog(message, 'warn');
          }
          throw new Error(message);
        }
        throw error;
      }

      if (result?.error) {
        throw new Error(result.error);
      }

      return result || {};
    }

    function getPreservedPhoneIdentityForEmailResolution(state = {}, options = {}) {
      if (!Boolean(options?.preserveAccountIdentity)) {
        return null;
      }
      const accountIdentifierType = String(state?.accountIdentifierType || '').trim().toLowerCase();
      const signupPhoneNumber = String(
        state?.signupPhoneNumber
        || (accountIdentifierType === 'phone' ? state?.accountIdentifier : '')
        || state?.signupPhoneCompletedActivation?.phoneNumber
        || state?.signupPhoneActivation?.phoneNumber
        || ''
      ).trim();
      if (accountIdentifierType !== 'phone' && !signupPhoneNumber) {
        return null;
      }
      return {
        accountIdentifierType: 'phone',
        accountIdentifier: signupPhoneNumber || String(state?.accountIdentifier || '').trim(),
        signupPhoneNumber,
        signupPhoneActivation: state?.signupPhoneActivation || null,
        signupPhoneCompletedActivation: state?.signupPhoneCompletedActivation || null,
        signupPhoneVerificationRequestedAt: state?.signupPhoneVerificationRequestedAt ?? null,
        signupPhoneVerificationPurpose: state?.signupPhoneVerificationPurpose || '',
      };
    }

    async function persistResolvedSignupEmail(resolvedEmail, state = {}, options = {}) {
      if (resolvedEmail === state.email && !options?.preserveAccountIdentity) {
        return;
      }
      const generatedEmailAlreadyPersisted = Boolean(options?.generatedEmailAlreadyPersisted);
      if (typeof persistRegistrationEmailState === 'function') {
        if (!generatedEmailAlreadyPersisted) {
          await persistRegistrationEmailState(state, resolvedEmail, {
            source: 'flow',
            preserveAccountIdentity: Boolean(options?.preserveAccountIdentity),
          });
        }
        return;
      }
      const preservedPhoneIdentity = getPreservedPhoneIdentityForEmailResolution(state, options);
      if (preservedPhoneIdentity && typeof setState === 'function') {
        if (!generatedEmailAlreadyPersisted && resolvedEmail !== state.email) {
          await setEmailState(resolvedEmail, { source: 'flow' });
        }
        await setState(preservedPhoneIdentity);
        return;
      }
      if (resolvedEmail !== state.email) {
        await setEmailState(resolvedEmail);
      }
    }

    async function resolveSignupEmailForFlow(state, options = {}) {
      let resolvedEmail = state.email;
      let generatedEmailAlreadyPersisted = false;
      if (isHotmailProvider(state)) {
        const account = await ensureHotmailAccountForFlow({
          allowAllocate: true,
          markUsed: true,
          preferredAccountId: state.currentHotmailAccountId || null,
        });
        resolvedEmail = account.email;
      } else if (isLuckmailProvider(state)) {
        const purchase = await ensureLuckmailPurchaseForFlow({ allowReuse: true });
        resolvedEmail = purchase.email_address;
      } else if (isGeneratedAliasProvider(state)) {
        if (Boolean(state?.mail2925UseAccountPool)
          && String(state?.mailProvider || '').trim().toLowerCase() === '2925'
          && typeof ensureMail2925AccountForFlow === 'function') {
          await ensureMail2925AccountForFlow({
            allowAllocate: true,
            preferredAccountId: state.currentMail2925AccountId || null,
            markUsed: true,
          });
        }
        if (!isReusableGeneratedAliasEmail?.(state, resolvedEmail)) {
          resolvedEmail = buildGeneratedAliasEmail(state);
        }
      } else if (!resolvedEmail && typeof fetchGeneratedEmail === 'function') {
        resolvedEmail = await fetchGeneratedEmail(state, options);
        generatedEmailAlreadyPersisted = true;
      }

      if (!resolvedEmail) {
        throw new Error('缺少邮箱地址，请先在侧边栏粘贴邮箱。');
      }

      if (!generatedEmailAlreadyPersisted || options?.preserveAccountIdentity) {
        await persistResolvedSignupEmail(resolvedEmail, state, {
          ...options,
          generatedEmailAlreadyPersisted,
        });
      }

      return resolvedEmail;
    }

    return {
      ensureSignupEntryPageReady,
      ensureSignupPostIdentityPageReadyInTab,
      ensureSignupPostEmailPageReadyInTab,
      finalizeSignupPasswordSubmitInTab,
      ensureSignupPasswordPageReadyInTab,
      openSignupEntryTab,
      resolveSignupEmailForFlow,
    };
  }

  return {
    createSignupFlowHelpers,
  };
});
