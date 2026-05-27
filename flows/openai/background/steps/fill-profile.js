(function attachBackgroundStep5(root, factory) {
  root.MultiPageBackgroundStep5 = factory();
})(typeof self !== 'undefined' ? self : globalThis, function createBackgroundStep5Module() {
  function createStep5Executor(deps = {}) {
    const {
      addLog,
      generateRandomBirthday,
      generateRandomName,
      sendToContentScript,
    } = deps;

    async function executeStep5() {
      const { firstName, lastName } = generateRandomName();
      const { year, month, day } = generateRandomBirthday();

      await addLog(`Step 5: Generated name ${firstName} ${lastName}, birthday ${year}-${month}-${day}`);

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

  return { createStep5Executor };
});
