(function attachBackgroundKiroCredentialArtifact(root, factory) {
  root.MultiPageBackgroundKiroCredentialArtifact = factory(root);
})(typeof self !== 'undefined' ? self : globalThis, function createBackgroundKiroCredentialArtifactModule(root) {
  const kiroStateApi = root?.MultiPageBackgroundKiroState || null;
  const FLOW_ID = 'kiro';
  const ADAPTER_ID = 'kiro-builder-id';
  const ARTIFACT_KIND = 'kiro-builder-id';
  const DEFAULT_REGION = kiroStateApi?.DEFAULT_REGION || 'us-east-1';
  const DEFAULT_TARGET_ID = kiroStateApi?.DEFAULT_TARGET_ID || 'kiro-rs';
  const BUILDER_ID_PROFILE_ARN = 'arn:aws:codewhisperer:us-east-1:638616132270:profile/AAAACCCCXXXX';

  function isPlainObject(value) {
    return Boolean(value) && typeof value === 'object' && !Array.isArray(value);
  }

  function cleanString(value = '') {
    return String(value ?? '').trim();
  }

  function readKiroRuntime(state = {}) {
    return kiroStateApi?.ensureRuntimeState
      ? kiroStateApi.ensureRuntimeState(state)
      : (isPlainObject(state?.runtimeState?.flowState?.kiro)
        ? state.runtimeState.flowState.kiro
        : (isPlainObject(state?.flowState?.kiro) ? state.flowState.kiro : {}));
  }

  function resolveKiroTargetId(state = {}, runtimeState = readKiroRuntime(state)) {
    return cleanString(
      state?.settingsState?.flows?.kiro?.selectedTargetId
      || state?.targetId
      || runtimeState?.upload?.targetId
      || DEFAULT_TARGET_ID
    ) || DEFAULT_TARGET_ID;
  }

  function resolveEmail(state = {}, runtimeState = readKiroRuntime(state)) {
    return cleanString(
      runtimeState?.register?.email
      || state?.email
      || state?.registrationEmailState?.current
      || state?.accountIdentifier
    );
  }

  function resolveRegion(state = {}, runtimeState = readKiroRuntime(state), targetId = DEFAULT_TARGET_ID) {
    return cleanString(
      runtimeState?.desktopAuth?.region
      || state?.settingsState?.flows?.kiro?.targets?.[targetId]?.region
      || DEFAULT_REGION
    ) || DEFAULT_REGION;
  }

  function assertRequiredField(name, value, message) {
    if (!cleanString(value)) {
      const error = new Error(message);
      error.code = `missing_${name}`;
      throw error;
    }
  }

  function redactSecret(value = '') {
    const normalized = cleanString(value);
    if (!normalized) {
      return '';
    }
    if (normalized.length <= 10) {
      return `${normalized.slice(0, 2)}***`;
    }
    return `${normalized.slice(0, 6)}...${normalized.slice(-4)}`;
  }

  function buildKiroBuilderIdArtifact(state = {}, options = {}) {
    const runtimeState = readKiroRuntime(state);
    const desktopAuth = runtimeState?.desktopAuth || {};
    const targetId = resolveKiroTargetId(state, runtimeState);
    const region = resolveRegion(state, runtimeState, targetId);
    const email = resolveEmail(state, runtimeState);
    const refreshToken = String(desktopAuth.refreshToken || '');
    const clientId = cleanString(desktopAuth.clientId);
    const clientSecret = String(desktopAuth.clientSecret || '');

    assertRequiredField('refreshToken', refreshToken, 'Missing desktop authorization refreshToken, cannot submit Kiro Builder ID contribution.');
    assertRequiredField('clientId', clientId, 'Missing desktop authorization clientId, cannot submit Kiro Builder ID contribution.');
    assertRequiredField('clientSecret', clientSecret, 'Missing desktop authorization clientSecret, cannot submit Kiro Builder ID contribution.');
    assertRequiredField('email', email, 'Missing registration email, cannot submit Kiro Builder ID contribution.');

    return {
      schemaVersion: 1,
      flow: FLOW_ID,
      adapter: ADAPTER_ID,
      artifact: ARTIFACT_KIND,
      account: {
        email,
      },
      credentials: {
        refreshToken,
        clientId,
        clientSecret,
        profileArn: cleanString(options.profileArn) || BUILDER_ID_PROFILE_ARN,
        authMethod: 'idc',
        region,
        authRegion: region,
        apiRegion: region,
        tokenSource: cleanString(desktopAuth.tokenSource) || 'desktop_authorization_code_pkce',
      },
      metadata: {
        targetId,
        authorizedAt: Math.max(0, Number(desktopAuth.authorizedAt) || 0),
        generatedAt: new Date().toISOString(),
        source: 'flowpilot-extension',
      },
    };
  }

  function buildSafeArtifactSummary(artifact = {}) {
    return {
      flow: cleanString(artifact.flow),
      adapter: cleanString(artifact.adapter),
      artifact: cleanString(artifact.artifact),
      email: cleanString(artifact.account?.email),
      clientId: cleanString(artifact.credentials?.clientId),
      refreshToken: redactSecret(artifact.credentials?.refreshToken),
      clientSecret: redactSecret(artifact.credentials?.clientSecret),
      region: cleanString(artifact.credentials?.region),
    };
  }

  return {
    ADAPTER_ID,
    ARTIFACT_KIND,
    BUILDER_ID_PROFILE_ARN,
    FLOW_ID,
    buildKiroBuilderIdArtifact,
    buildSafeArtifactSummary,
    redactSecret,
  };
});
