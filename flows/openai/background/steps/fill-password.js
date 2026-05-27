(function attachBackgroundStep3(root, factory) {
  root.MultiPageBackgroundStep3 = factory();
})(typeof self !== 'undefined' ? self : globalThis, function createBackgroundStep3Module() {
  function createStep3Executor(deps = {}) {
    const {
      addLog,
      chrome,
      ensureContentScriptReadyOnTab,
      generatePassword,
      getTabId,
      isTabAlive,
      resolveSignupMethod,
      sendToContentScript,
      setPasswordState,
      setState,
      OPENAI_AUTH_INJECT_FILES,
    } = deps;

    function normalizeSignupMethod(value = '') {
      return String(value || '').trim().toLowerCase() === 'phone'
        ? 'phone'
        : 'email';
    }

    function getResolvedSignupMethodForStep3(state = {}) {
      if (typeof resolveSignupMethod === 'function') {
        return normalizeSignupMethod(resolveSignupMethod(state));
      }
      const frozenMethod = String(state?.resolvedSignupMethod || '').trim().toLowerCase();
      if (frozenMethod === 'phone' || frozenMethod === 'email') {
        return normalizeSignupMethod(frozenMethod);
      }
      return normalizeSignupMethod(state?.signupMethod);
    }

    function resolveStep3AccountIdentity(state = {}) {
      const resolvedEmail = String(state?.email || '').trim();
      const rawAccountIdentifierType = String(state?.accountIdentifierType || '').trim().toLowerCase();
      const signupPhoneNumber = String(
        state?.signupPhoneNumber
        || (rawAccountIdentifierType === 'phone' ? state?.accountIdentifier : '')
        || ''
      ).trim();
      const explicitEmailIdentity = rawAccountIdentifierType === 'email' && resolvedEmail;
      const shouldUsePhoneIdentity = !explicitEmailIdentity && (
        rawAccountIdentifierType === 'phone'
        || Boolean(signupPhoneNumber)
        || getResolvedSignupMethodForStep3(state) === 'phone'
      );
      const accountIdentifierType = shouldUsePhoneIdentity
        ? 'phone'
        : (resolvedEmail ? 'email' : 'email');
      const accountIdentifier = accountIdentifierType === 'phone'
        ? signupPhoneNumber
        : resolvedEmail;

      return {
        accountIdentifierType,
        accountIdentifier,
        email: resolvedEmail,
        phoneNumber: signupPhoneNumber,
      };
    }

    async function executeStep3(state) {
      const identity = resolveStep3AccountIdentity(state);
      if (!identity.accountIdentifier) {
        if (identity.accountIdentifierType === 'phone') {
          throw new Error('Missing registration phone number. Please complete step 2 or set the registration phone number in the side panel before running step 3.');
        }
        throw new Error('Missing registration account, please complete step 2 first.');
      }

      const signupTabId = await getTabId('openai-auth');
      if (!signupTabId || !(await isTabAlive('openai-auth'))) {
        throw new Error('Auth page tab is closed, please re-run step 2 first.');
      }

      const password = state.customPassword || state.password || generatePassword();
      await setPasswordState(password);

      const accounts = state.accounts || [];
      accounts.push({
        email: identity.email,
        phoneNumber: identity.phoneNumber,
        accountIdentifierType: identity.accountIdentifierType,
        accountIdentifier: identity.accountIdentifier,
        createdAt: new Date().toISOString(),
      });
      await setState({ accounts });

      await chrome.tabs.update(signupTabId, { active: true });
      await ensureContentScriptReadyOnTab('openai-auth', signupTabId, {
        inject: OPENAI_AUTH_INJECT_FILES,
        injectSource: 'openai-auth',
        timeoutMs: 45000,
        retryDelayMs: 900,
        logMessage: 'Step 3: password page content script not ready, waiting for page recovery...',
      });

      const identityLabel = identity.accountIdentifierType === 'phone'
        ? `registration phone ${identity.accountIdentifier}`
        : `email ${identity.accountIdentifier}`;
      await addLog(
        `Step 3: filling password, ${identityLabel}, password is ${state.customPassword ? 'custom' : 'auto-generated'} (${password.length} chars)`
      );
      await sendToContentScript('openai-auth', {
        type: 'EXECUTE_NODE',
        nodeId: 'fill-password',
        step: 3,
        source: 'background',
        payload: {
          email: identity.email,
          phoneNumber: identity.phoneNumber,
          accountIdentifierType: identity.accountIdentifierType,
          accountIdentifier: identity.accountIdentifier,
          password,
        },
      });
    }

    return { executeStep3 };
  }

  return { createStep3Executor };
});
