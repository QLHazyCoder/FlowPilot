(function attachBackgroundKiroBuilderIdContributionAdapter(root, factory) {
  root.MultiPageBackgroundKiroBuilderIdContributionAdapter = factory(root);
})(typeof self !== 'undefined' ? self : globalThis, function createBackgroundKiroBuilderIdContributionAdapterModule(root) {
  const artifactApi = root?.MultiPageBackgroundKiroCredentialArtifact || {};
  const FLOW_ID = artifactApi.FLOW_ID || 'kiro';
  const ADAPTER_ID = artifactApi.ADAPTER_ID || 'kiro-builder-id';
  const ARTIFACT_KIND = artifactApi.ARTIFACT_KIND || 'kiro-builder-id';
  const DEFAULT_CONTRIBUTION_API_URL = 'https://flowpilot.qlhazycoder.top/api/contributions';

  function isPlainObject(value) {
    return Boolean(value) && typeof value === 'object' && !Array.isArray(value);
  }

  function cleanString(value = '') {
    return String(value ?? '').trim();
  }

  function getErrorMessage(error) {
    return error instanceof Error ? error.message : String(error ?? 'Unknown error');
  }

  function normalizeFlowId(state = {}) {
    return cleanString(state.activeFlowId || state.flowId).toLowerCase() || 'openai';
  }

  function normalizeAdapterId(state = {}) {
    return cleanString(state.contributionAdapterId || ADAPTER_ID).toLowerCase() || ADAPTER_ID;
  }

  function shouldSubmitKiroBuilderIdContribution(state = {}) {
    return Boolean(state?.accountContributionEnabled)
      && normalizeFlowId(state) === FLOW_ID
      && normalizeAdapterId(state) === ADAPTER_ID;
  }

  function normalizeContributionApiUrl(value = '') {
    const normalized = cleanString(value).replace(/\/+$/, '');
    if (!normalized) {
      return DEFAULT_CONTRIBUTION_API_URL;
    }
    if (/\/api\/contributions$/i.test(normalized)) {
      return normalized;
    }
    return `${normalized}/api/contributions`;
  }

  function mergeFlowContributionRuntime(currentRuntime = {}, flowId = FLOW_ID, patch = {}) {
    const runtime = isPlainObject(currentRuntime) ? currentRuntime : {};
    const currentFlowRuntime = isPlainObject(runtime[flowId]) ? runtime[flowId] : {};
    return {
      ...runtime,
      [flowId]: {
        ...currentFlowRuntime,
        ...patch,
      },
    };
  }

  function redactKnownArtifactSecrets(message = '', artifact = {}) {
    let result = cleanString(message);
    const secrets = [
      artifact?.credentials?.refreshToken,
      artifact?.credentials?.clientSecret,
    ]
      .map((value) => cleanString(value))
      .filter(Boolean);
    secrets.forEach((secret) => {
      result = result.split(secret).join(artifactApi.redactSecret?.(secret) || '[redacted]');
    });
    return result;
  }

  async function readJsonResponse(response) {
    const text = await response.text();
    try {
      return text ? JSON.parse(text) : {};
    } catch (_error) {
      return { message: text };
    }
  }

  async function submitContributionArtifact(artifact = {}, options = {}) {
    const fetchImpl = options.fetchImpl;
    if (typeof fetchImpl !== 'function') {
      throw new Error('Account contribution submission capability is missing fetch.');
    }
    const endpoint = normalizeContributionApiUrl(options.apiUrl);
    const payload = {
      flow: FLOW_ID,
      adapter_id: ADAPTER_ID,
      artifact_kind: ARTIFACT_KIND,
      source: 'flowpilot-extension',
      contributor: {
        nickname: cleanString(options.nickname),
        qq: cleanString(options.qq),
      },
      artifact,
    };
    const response = await fetchImpl(endpoint, {
      method: 'POST',
      headers: {
        Accept: 'application/json',
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(payload),
    });
    const body = await readJsonResponse(response);
    if (!response.ok || body?.ok === false) {
      throw new Error(cleanString(body?.message || body?.detail || body?.error) || `Contribution service request failed (HTTP ${response.status}).`);
    }
    return {
      ok: true,
      status: response.status,
      contributionId: cleanString(body?.contribution_id || body?.contributionId || body?.id),
      message: cleanString(body?.message) || 'Contribution submitted successfully',
      raw: body,
    };
  }

  function createKiroBuilderIdContributionAdapter(deps = {}) {
    const {
      addLog = async () => {},
      contributionApiUrl = DEFAULT_CONTRIBUTION_API_URL,
      fetchImpl = typeof fetch === 'function' ? fetch.bind(globalThis) : null,
      getState = async () => ({}),
      setState = async () => {},
    } = deps;

    async function updateFlowContributionRuntime(currentState = {}, patch = {}) {
      const runtime = mergeFlowContributionRuntime(currentState.flowContributionRuntime, FLOW_ID, {
        adapterId: ADAPTER_ID,
        ...patch,
      });
      await setState({
        flowContributionRuntime: runtime,
      });
      return runtime;
    }

    async function log(message, level = 'info', nodeId = '') {
      await addLog(message, level, nodeId ? { nodeId } : {});
    }

    async function maybeSubmitFlowContribution(state = {}, options = {}) {
      const currentState = Object.keys(state || {}).length ? state : await getState();
      const nodeId = cleanString(options.nodeId || 'kiro-complete-desktop-authorize');
      if (!shouldSubmitKiroBuilderIdContribution(currentState)) {
        return {
          ok: true,
          skipped: true,
          reason: 'not_enabled_for_kiro_builder_id',
        };
      }

      let artifact = null;
      try {
        artifact = artifactApi.buildKiroBuilderIdArtifact(currentState);
      } catch (error) {
        const message = redactKnownArtifactSecrets(getErrorMessage(error), artifact);
        await updateFlowContributionRuntime(currentState, {
          enabled: true,
          status: 'skipped',
          error: message,
          lastMessage: message,
          updatedAt: Date.now(),
        });
        await log(`Kiro account contribution skipped: ${message}`, 'warn', nodeId);
        return {
          ok: false,
          skipped: true,
          reason: error?.code || 'artifact_invalid',
          message,
        };
      }

      await updateFlowContributionRuntime(currentState, {
        enabled: true,
        status: 'submitting',
        error: '',
        lastMessage: 'Submitting Kiro Builder ID contribution',
        updatedAt: Date.now(),
      });

      const safeSummary = artifactApi.buildSafeArtifactSummary?.(artifact) || {};
      await log(`Kiro account contribution: Submitting Builder ID, email ${safeSummary.email || 'unknown'}.`, 'info', nodeId);

      try {
        const result = await submitContributionArtifact(artifact, {
          apiUrl: options.contributionApiUrl || contributionApiUrl,
          fetchImpl,
          nickname: currentState.contributionNickname,
          qq: currentState.contributionQq,
        });
        await updateFlowContributionRuntime(currentState, {
          enabled: true,
          status: 'submitted',
          error: '',
          contributionId: result.contributionId,
          lastMessage: result.message,
          submittedAt: Date.now(),
          updatedAt: Date.now(),
        });
        await log(`Kiro account contribution: Submission complete, ${result.message}.`, 'ok', nodeId);
        return result;
      } catch (error) {
        const message = redactKnownArtifactSecrets(getErrorMessage(error), artifact);
        await updateFlowContributionRuntime(currentState, {
          enabled: true,
          status: 'error',
          error: message,
          lastMessage: message,
          updatedAt: Date.now(),
        });
        await log(`Kiro account contribution submission failed: ${message}`, 'warn', nodeId);
        return {
          ok: false,
          skipped: false,
          reason: 'submit_failed',
          message,
        };
      }
    }

    return {
      maybeSubmitFlowContribution,
      shouldSubmitKiroBuilderIdContribution,
      submitContributionArtifact: (artifact, options = {}) => submitContributionArtifact(artifact, {
        ...options,
        apiUrl: options.apiUrl || contributionApiUrl,
        fetchImpl: options.fetchImpl || fetchImpl,
      }),
    };
  }

  return {
    ADAPTER_ID,
    ARTIFACT_KIND,
    DEFAULT_CONTRIBUTION_API_URL,
    FLOW_ID,
    createKiroBuilderIdContributionAdapter,
    normalizeContributionApiUrl,
    shouldSubmitKiroBuilderIdContribution,
    submitContributionArtifact,
  };
});
