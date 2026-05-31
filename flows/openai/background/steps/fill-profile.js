(function attachBackgroundStep5(root, factory) {
  root.MultiPageBackgroundStep5 = factory();
})(typeof self !== 'undefined' ? self : globalThis, function createBackgroundStep5Module() {
  function normalizeStep5ProfilePayload(payload = {}) {
    if (!payload || typeof payload !== 'object' || Array.isArray(payload)) {
      return null;
    }

    const firstName = String(payload.firstName || '').trim();
    const lastName = String(payload.lastName || '').trim();
    const year = Math.floor(Number(payload.year));
    const month = Math.floor(Number(payload.month));
    const day = Math.floor(Number(payload.day));

    if (!firstName || !lastName) {
      return null;
    }
    if (!Number.isFinite(year) || !Number.isFinite(month) || !Number.isFinite(day)) {
      return null;
    }

    return {
      firstName,
      lastName,
      year,
      month,
      day,
    };
  }

  function getStep5ProfileState(state = {}) {
    return {
      payload: normalizeStep5ProfilePayload(state?.step5ProfilePayload),
      recoveryCount: Math.max(0, Number(state?.step5ProfileRecoveryCount) || 0),
    };
  }

  function clearStep5ProfileStatePatch() {
    return {
      step5ProfilePayload: null,
      step5ProfileRecoveryCount: 0,
    };
  }

  function buildStep5ProfileStatePatch(payload = null, recoveryCount = 0) {
    const normalizedPayload = normalizeStep5ProfilePayload(payload);
    if (!normalizedPayload) {
      return clearStep5ProfileStatePatch();
    }

    return {
      step5ProfilePayload: normalizedPayload,
      step5ProfileRecoveryCount: Math.max(0, Number(recoveryCount) || 0),
    };
  }

  function createStep5Executor(deps = {}) {
    const {
      addLog,
      generateRandomBirthday,
      generateRandomName,
      setState,
      sendToContentScript,
    } = deps;

    async function executeStep5(state = {}) {
      const persistedState = getStep5ProfileState(state);
      const resolvedPayload = persistedState.payload || (() => {
        const { firstName, lastName } = generateRandomName();
        const { year, month, day } = generateRandomBirthday();
        return { firstName, lastName, year, month, day };
      })();
      const { firstName, lastName, year, month, day } = resolvedPayload;

      if (typeof setState === 'function') {
        await setState(buildStep5ProfileStatePatch(
          { firstName, lastName, year, month, day },
          persistedState.recoveryCount
        ));
      }

      await addLog(`步骤 5：已生成姓名 ${firstName} ${lastName}，生日 ${year}-${month}-${day}`);

      await sendToContentScript('openai-auth', {
        type: 'EXECUTE_NODE',
        nodeId: 'fill-profile',
        step: 5,
        source: 'background',
        payload: {
          firstName,
          lastName,
          year,
          month,
          day,
        },
      });
    }

    return { executeStep5 };
  }

  return {
    buildStep5ProfileStatePatch,
    clearStep5ProfileStatePatch,
    createStep5Executor,
    getStep5ProfileState,
    normalizeStep5ProfilePayload,
  };
});
