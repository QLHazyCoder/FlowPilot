(function attachBackgroundKiroPublisherKiroRs(root, factory) {
  root.MultiPageBackgroundKiroPublisherKiroRs = factory(root);
})(typeof self !== 'undefined' ? self : globalThis, function createBackgroundKiroPublisherKiroRsModule(root) {
  const kiroStateApi = root?.MultiPageBackgroundKiroState || null;
  const DEFAULT_REGION = kiroStateApi?.DEFAULT_REGION || 'us-east-1';
  const DEFAULT_TARGET_ID = kiroStateApi?.DEFAULT_TARGET_ID || 'kiro-rs';
  const BUILDER_ID_PROFILE_ARN = 'arn:aws:codewhisperer:us-east-1:638616132270:profile/AAAACCCCXXXX';

  function isPlainObject(value) {
    return Boolean(value) && typeof value === 'object' && !Array.isArray(value);
  }

  function cloneValue(value) {
    if (Array.isArray(value)) {
      return value.map((entry) => cloneValue(entry));
    }
    if (isPlainObject(value)) {
      return Object.fromEntries(
        Object.entries(value).map(([key, entryValue]) => [key, cloneValue(entryValue)])
      );
    }
    return value;
  }

  function deepMerge(baseValue, patchValue) {
    if (Array.isArray(patchValue)) {
      return patchValue.map((entry) => cloneValue(entry));
    }
    if (!isPlainObject(patchValue)) {
      return patchValue === undefined ? cloneValue(baseValue) : patchValue;
    }

    const baseObject = isPlainObject(baseValue) ? baseValue : {};
    const next = {
      ...cloneValue(baseObject),
    };
    Object.entries(patchValue).forEach(([key, value]) => {
      next[key] = deepMerge(baseObject[key], value);
    });
    return next;
  }

  function cleanString(value = '') {
    return String(value ?? '').trim();
  }

  function normalizeRegion(value = '', fallback = DEFAULT_REGION) {
    return cleanString(value) || fallback;
  }

  function normalizeKiroRsApiKey(value = '') {
    return cleanString(value);
  }

  function buildKiroRsAdminHeaders(apiKey = '', extraHeaders = {}) {
    const normalizedApiKey = normalizeKiroRsApiKey(apiKey);
    return {
      ...extraHeaders,
      ...(normalizedApiKey ? {
        'x-api-key': normalizedApiKey,
        Authorization: `Bearer ${normalizedApiKey}`,
      } : {}),
    };
  }

  function readKiroRsResponseMessage(body = {}, fallback = '') {
    return cleanString(body?.json?.error?.message || body?.json?.message || body?.text || fallback);
  }

  function normalizeKiroRsBaseUrl(value = '') {
    const normalized = cleanString(value).replace(/\/+$/, '');
    if (!normalized) {
      throw new Error('Missing kiro.rs admin URL.');
    }
    return normalized.endsWith('/admin')
      ? normalized.slice(0, -'/admin'.length)
      : normalized;
  }

  function normalizeKiroUploadMessage(value = '') {
    const rawValue = cleanString(value);
    if (!rawValue) {
      return 'Upload succeeded';
    }

    const normalizedValue = rawValue.toLowerCase();
    if (normalizedValue === 'uploaded' || normalizedValue === 'credential uploaded.') {
      return 'Upload succeeded';
    }
    return rawValue;
  }

  function getErrorMessage(error) {
    return error instanceof Error ? error.message : String(error ?? 'Unknown error');
  }

  async function readResponse(response) {
    const text = await response.text();
    let json = null;
    try {
      json = text ? JSON.parse(text) : null;
    } catch (_error) {
      json = null;
    }
    return { text, json };
  }

  function readKiroRuntime(state = {}) {
    return kiroStateApi?.ensureRuntimeState
      ? kiroStateApi.ensureRuntimeState(state)
      : (isPlainObject(state?.runtimeState?.flowState?.kiro)
        ? state.runtimeState.flowState.kiro
        : (isPlainObject(state?.flowState?.kiro) ? state.flowState.kiro : {}));
  }

  function buildCanonicalRuntimePatch(currentState = {}, nextRuntimeState = {}) {
    if (typeof kiroStateApi?.buildRuntimeStatePatch === 'function') {
      return kiroStateApi.buildRuntimeStatePatch(currentState, nextRuntimeState);
    }
    const baseRuntimeState = isPlainObject(currentState?.runtimeState)
      ? cloneValue(currentState.runtimeState)
      : {};
    const baseFlowState = isPlainObject(baseRuntimeState.flowState)
      ? cloneValue(baseRuntimeState.flowState)
      : {};
    return {
      runtimeState: {
        ...baseRuntimeState,
        flowState: {
          ...baseFlowState,
          kiro: deepMerge(readKiroRuntime(currentState), nextRuntimeState),
        },
      },
    };
  }

  function mergeRuntimePatch(currentState = {}, patch = {}) {
    return buildCanonicalRuntimePatch(
      currentState,
      deepMerge(readKiroRuntime(currentState), patch)
    );
  }

  function resolveKiroTargetId(state = {}) {
    return cleanString(
      state?.settingsState?.flows?.kiro?.selectedTargetId
      || state?.targetId
      || readKiroRuntime(state).upload?.targetId
      || DEFAULT_TARGET_ID
    ) || DEFAULT_TARGET_ID;
  }

  function resolveKiroTargetConfig(state = {}, targetId = DEFAULT_TARGET_ID) {
    if (targetId !== DEFAULT_TARGET_ID) {
      throw new Error(`Kiro publish target not supported: ${targetId}`);
    }
    const nestedConfig = state?.settingsState?.flows?.kiro?.targets?.[targetId] || {};
    return {
      baseUrl: cleanString(nestedConfig.baseUrl || state?.kiroRsUrl),
      apiKey: normalizeKiroRsApiKey(nestedConfig.apiKey ?? state?.kiroRsKey ?? ''),
    };
  }

  function buildProxyPayload(state = {}) {
    if (!state?.ipProxyEnabled) {
      return {};
    }

    const apiProxyUrl = cleanString(state?.ipProxyApiUrl);
    const host = cleanString(state?.ipProxyHost);
    const port = cleanString(state?.ipProxyPort);
    const protocol = cleanString(state?.ipProxyProtocol) || 'http';
    const proxyUrl = apiProxyUrl || (host && port ? `${protocol}://${host}:${port}` : '');
    const proxyUsername = cleanString(state?.ipProxyUsername);
    const proxyPassword = String(state?.ipProxyPassword || '');

    return {
      ...(proxyUrl ? { proxyUrl } : {}),
      ...(proxyUsername ? { proxyUsername } : {}),
      ...(proxyPassword ? { proxyPassword } : {}),
    };
  }

  async function sha256Hex(input = '') {
    const encoder = new TextEncoder();
    const bytes = encoder.encode(String(input ?? ''));
    const digest = await globalThis.crypto.subtle.digest('SHA-256', bytes);
    return Array.from(new Uint8Array(digest))
      .map((value) => value.toString(16).padStart(2, '0'))
      .join('');
  }

  async function buildMachineId(refreshToken = '') {
    const normalizedRefreshToken = cleanString(refreshToken);
    if (!normalizedRefreshToken) {
      throw new Error('Missing refreshToken, cannot generate machineId.');
    }
    return sha256Hex(`KotlinNativeAPI/${normalizedRefreshToken}`);
  }

  function buildUploadPayload(state = {}) {
    const runtimeState = readKiroRuntime(state);
    const targetId = resolveKiroTargetId(state);
    const desktopAuth = runtimeState.desktopAuth || {};
    const register = runtimeState.register || {};
    const refreshToken = String(desktopAuth.refreshToken || '');
    const clientId = cleanString(desktopAuth.clientId);
    const clientSecret = String(desktopAuth.clientSecret || '');
    const region = normalizeRegion(
      desktopAuth.region
      || state?.settingsState?.flows?.kiro?.targets?.[targetId]?.region
      || DEFAULT_REGION
    );
    const email = cleanString(register.email || state?.email);

    if (!refreshToken) {
      throw new Error('Missing desktop authorization refreshToken, please complete step 8 first.');
    }
    if (!clientId || !clientSecret) {
      throw new Error('Missing desktop authorization clientId or clientSecret, please complete steps 7-8 first.');
    }
    if (!email) {
      throw new Error('Missing registration email, cannot upload to kiro.rs.');
    }

    return {
      targetId,
      region,
      email,
      refreshToken,
      profileArn: BUILDER_ID_PROFILE_ARN,
      clientId,
      clientSecret,
      authMethod: 'idc',
      authRegion: region,
      apiRegion: region,
      ...buildProxyPayload(state),
    };
  }

  async function checkKiroRsConnection(baseUrl, apiKey, fetchImpl) {
    const normalizedBaseUrl = normalizeKiroRsBaseUrl(baseUrl);
    const normalizedApiKey = normalizeKiroRsApiKey(apiKey);
    const response = await fetchImpl(`${normalizedBaseUrl}/api/admin/credentials`, {
      method: 'GET',
      headers: buildKiroRsAdminHeaders(normalizedApiKey, {
        Accept: 'application/json',
      }),
    });
    const body = await readResponse(response);
    const detail = readKiroRsResponseMessage(body, response.statusText);
    if (response.ok) {
      return {
        ok: true,
        status: response.status,
        message: `kiro.rs connection OK (HTTP ${response.status})`,
      };
    }
    if (response.status === 405) {
      return {
        ok: true,
        status: response.status,
        message: 'kiro.rs upload endpoint is reachable.',
      };
    }
    if (response.status === 401 || response.status === 403) {
      return {
        ok: false,
        status: response.status,
        message: `kiro.rs API key rejected (HTTP ${response.status}${detail ? `: ${detail}` : ''})`,
      };
    }
    if (response.status === 404) {
      return {
        ok: false,
        status: response.status,
        message: `kiro.rs admin endpoint not found (HTTP 404${detail ? `: ${detail}` : ''})`,
      };
    }
    return {
      ok: false,
      status: response.status,
      message: detail || `kiro.rs connection failed (HTTP ${response.status})`,
    };
  }

  async function uploadBuilderIdCredential(baseUrl, apiKey, payload, fetchImpl) {
    const normalizedBaseUrl = normalizeKiroRsBaseUrl(baseUrl);
    const normalizedApiKey = normalizeKiroRsApiKey(apiKey);
    const response = await fetchImpl(`${normalizedBaseUrl}/api/admin/credentials`, {
      method: 'POST',
      headers: buildKiroRsAdminHeaders(normalizedApiKey, {
        'Content-Type': 'application/json',
        Accept: 'application/json',
      }),
      body: JSON.stringify(payload),
    });
    const body = await readResponse(response);
    if (!response.ok) {
      const message = readKiroRsResponseMessage(body, response.statusText) || `HTTP ${response.status}`;
      throw new Error(`kiro.rs credential upload failed: ${message}`);
    }

    return {
      credentialId: Number(body.json?.credentialId || body.json?.credential_id || 0) || null,
      email: cleanString(body.json?.email),
      message: normalizeKiroUploadMessage(body.json?.message),
      raw: body.json,
    };
  }

  function createKiroRsPublisher(deps = {}) {
    const {
      addLog = async () => {},
      completeNodeFromBackground,
      fetchImpl = typeof fetch === 'function' ? fetch.bind(globalThis) : null,
      getState = async () => ({}),
      maybeSubmitFlowContribution = async () => ({ ok: true, skipped: true, reason: 'not_configured' }),
      setState = async () => {},
    } = deps;

    if (typeof completeNodeFromBackground !== 'function') {
      throw new Error('Kiro kiro.rs publisher requires completeNodeFromBackground.');
    }
    if (typeof fetchImpl !== 'function') {
      throw new Error('Kiro kiro.rs publisher requires fetch support.');
    }

    async function log(message, level = 'info', nodeId = '') {
      await addLog(message, level, nodeId ? { nodeId } : {});
    }

    async function applyRuntimeState(currentState = {}, patch = {}) {
      const nextPatch = mergeRuntimePatch(currentState, patch);
      await setState(nextPatch);
      return nextPatch;
    }

    async function persistFailure(currentState = {}, message = '') {
      const nextPatch = mergeRuntimePatch(currentState, {
        session: {
          currentStage: 'upload',
          lastError: message,
        },
        upload: {
          status: 'error',
          error: message,
        },
      });
      await setState(nextPatch);
    }

    function shouldUseContributionUpload(state = {}) {
      return Boolean(state?.accountContributionEnabled)
        && cleanString(state?.activeFlowId || state?.flowId).toLowerCase() === 'kiro'
        && cleanString(state?.contributionAdapterId).toLowerCase() === 'kiro-builder-id';
    }

    async function executeKiroUploadCredential(state = {}) {
      const nodeId = String(state?.nodeId || 'kiro-upload-credential').trim();
      const currentState = await getState();
      try {
        if (shouldUseContributionUpload(currentState)) {
          await applyRuntimeState(currentState, {
            session: {
              currentStage: 'upload',
              lastError: '',
              lastWarning: '',
            },
            upload: {
              targetId: 'contribution',
              status: 'uploading',
              error: '',
            },
          });

          await log('Step 9: uploading Builder ID to contribution pool...', 'info', nodeId);
          const contributionResult = await maybeSubmitFlowContribution(currentState, {
            nodeId,
            trigger: 'kiro-step-9',
          });
          if (!contributionResult?.ok || contributionResult?.skipped) {
            throw new Error(contributionResult?.message || 'Kiro contribution upload failed.');
          }

          const uploadedAt = Date.now();
          const payload = await applyRuntimeState(currentState, {
            session: {
              currentStage: 'upload',
              lastError: '',
            },
            upload: {
              targetId: 'contribution',
              status: 'uploaded',
              error: '',
              credentialId: contributionResult.contributionId || '',
              lastMessage: contributionResult.message || 'Contribution uploaded',
              lastUploadedAt: uploadedAt,
            },
          });
          await log(`Step 9: contribution upload complete, status: ${contributionResult.message || 'Contribution uploaded'}`, 'ok', nodeId);
          await completeNodeFromBackground(nodeId, payload);
          return;
        }

        const targetId = resolveKiroTargetId(currentState);
        const targetConfig = resolveKiroTargetConfig(currentState, targetId);
        const baseUrl = normalizeKiroRsBaseUrl(targetConfig.baseUrl);
        const apiKey = String(targetConfig.apiKey || '');
        if (!apiKey) {
          throw new Error('Missing kiro.rs API key.');
        }

        const uploadInput = buildUploadPayload(currentState);
        const machineId = await buildMachineId(uploadInput.refreshToken);

        await applyRuntimeState(currentState, {
          session: {
            currentStage: 'upload',
            lastError: '',
            lastWarning: '',
          },
          upload: {
            targetId,
            status: 'uploading',
            error: '',
          },
        });

        await log('Step 9: uploading Builder ID credential to kiro.rs...', 'info', nodeId);

        const connection = await checkKiroRsConnection(baseUrl, apiKey, fetchImpl);
        if (!connection.ok) {
          throw new Error(connection.message);
        }

        const uploadResult = await uploadBuilderIdCredential(baseUrl, apiKey, {
          refreshToken: uploadInput.refreshToken,
          profileArn: uploadInput.profileArn,
          authMethod: uploadInput.authMethod,
          clientId: uploadInput.clientId,
          clientSecret: uploadInput.clientSecret,
          region: uploadInput.region,
          authRegion: uploadInput.authRegion,
          apiRegion: uploadInput.apiRegion,
          machineId,
          email: uploadInput.email,
          ...(uploadInput.proxyUrl ? { proxyUrl: uploadInput.proxyUrl } : {}),
          ...(uploadInput.proxyUsername ? { proxyUsername: uploadInput.proxyUsername } : {}),
          ...(uploadInput.proxyPassword ? { proxyPassword: uploadInput.proxyPassword } : {}),
        }, fetchImpl);

        const uploadedAt = Date.now();
        const payload = await applyRuntimeState(currentState, {
          session: {
            currentStage: 'upload',
            lastError: '',
          },
          upload: {
            targetId,
            status: 'uploaded',
            error: '',
            credentialId: uploadResult.credentialId,
            lastMessage: uploadResult.message || 'Upload succeeded',
            lastUploadedAt: uploadedAt,
          },
        });
        await log(`Step 9: kiro.rs upload complete, status: ${uploadResult.message || 'Upload succeeded'}`, 'ok', nodeId);
        await completeNodeFromBackground(nodeId, payload);
      } catch (error) {
        const message = getErrorMessage(error);
        await persistFailure(currentState, message);
        throw error;
      }
    }

    return {
      executeKiroUploadCredential,
    };
  }

  return {
    buildKiroRsPayload: buildUploadPayload,
    buildMachineId,
    checkKiroRsConnection,
    createKiroRsPublisher,
    normalizeKiroRsBaseUrl,
    normalizeKiroUploadMessage,
    uploadBuilderIdCredential,
  };
});
