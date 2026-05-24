(function attachBackgroundStep5(root, factory) {
  root.MultiPageBackgroundStep5 = factory();
})(typeof self !== 'undefined' ? self : globalThis, function createBackgroundStep5Module() {
  function createStep5Executor(deps = {}) {
    const {
      addLog,
      generateRandomBirthday,
      generateRandomName,
      getState,
      sendToContentScript,
    } = deps;

    async function executeStep5(state = {}) {
      const { firstName, lastName } = generateRandomName();
      const { year, month, day } = generateRandomBirthday();
      const currentState = state && typeof state === 'object' && Object.keys(state).length
        ? state
        : (typeof getState === 'function' ? await getState() : {});
      const completionToken = String(currentState?.completionToken || currentState?.currentCompletionTokenByNode?.['fill-profile'] || '').trim();

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
          ...(completionToken ? { completionToken } : {}),
        },
      });
    }

    return { executeStep5 };
  }

  return { createStep5Executor };
});
