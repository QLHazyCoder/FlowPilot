(function attachGeneratedEmailHelpers(root, factory) {
  root.MultiPageGeneratedEmailHelpers = factory(root);
})(typeof self !== 'undefined' ? self : globalThis, function createGeneratedEmailHelpersModule(root = globalThis) {
  function createGeneratedEmailHelpers(deps = {}) {
    const {
      addLog,
      buildGeneratedAliasEmail,
      buildCloudflareTempEmailEffectiveDomain,
      buildCloudflareTempEmailHeaders,
      CLOUDFLARE_TEMP_EMAIL_GENERATOR,
      CUSTOM_EMAIL_POOL_GENERATOR,
      DUCK_AUTOFILL_URL,
      fetch,
      fetchIcloudHideMyEmail,
      getCloudflareTempEmailAddressFromResponse,
      getCloudflareTempEmailConfig,
      getCustomEmailPoolEmail,
      getRegistrationEmailBaseline,
      getState,
      ensureMail2925AccountForFlow,
      joinCloudflareTempEmailUrl,
      normalizeCloudflareDomain,
      normalizeCloudflareTempEmailAddress,
      normalizeEmailGenerator,
      isGeneratedAliasProvider,
      persistRegistrationEmailState = null,
      buildNaturalEmailLocalPart = root.MultiPageEmailLocalPartHelpers?.buildNaturalEmailLocalPart,
      buildRandomNameDateTimeLocalPart = root.MultiPageEmailLocalPartHelpers?.buildRandomNameDateTimeLocalPart,
      reuseOrCreateTab,
      sendToContentScript,
      setEmailState,
      throwIfStopped,
    } = deps;

    async function persistResolvedEmailState(state = null, email, options = {}) {
      if (typeof persistRegistrationEmailState === 'function') {
        await persistRegistrationEmailState(state, email, options);
        return;
      }
      await setEmailState(email, options);
    }

    function generateCloudflareAliasLocalPart() {
      const letters = 'abcdefghijklmnopqrstuvwxyz';
      const digits = '0123456789';
      const chars = [];

      for (let i = 0; i < 6; i++) {
        chars.push(letters[Math.floor(Math.random() * letters.length)]);
      }

      for (let i = 0; i < 4; i++) {
        chars.push(digits[Math.floor(Math.random() * digits.length)]);
      }

      for (let i = chars.length - 1; i > 0; i--) {
        const j = Math.floor(Math.random() * (i + 1));
        [chars[i], chars[j]] = [chars[j], chars[i]];
      }

      return chars.join('');
    }

    function buildDefaultGeneratedEmailLocalPart(date = new Date()) {
      return typeof buildRandomNameDateTimeLocalPart === 'function'
        ? buildRandomNameDateTimeLocalPart(date)
        : '';
    }

    function buildDefaultCloudflareTempEmailLocalPart() {
      return typeof buildNaturalEmailLocalPart === 'function'
        ? buildNaturalEmailLocalPart()
        : generateCloudflareAliasLocalPart();
    }

    async function fetchCloudflareEmail(state, options = {}) {
      throwIfStopped();
      const latestState = state || await getState();
      const domain = normalizeCloudflareDomain(latestState.cloudflareDomain);
      if (!domain) {
        throw new Error('Cloudflare 域名为空或格式无效。');
      }

      const localPart = String(options.localPart || '').trim().toLowerCase() || generateCloudflareAliasLocalPart();
      const aliasEmail = `${localPart}@${domain}`;

      await persistResolvedEmailState(latestState, aliasEmail, {
        source: 'generated:cloudflare',
        preserveAccountIdentity: Boolean(options?.preserveAccountIdentity),
      });
      await addLog(`Cloudflare 邮箱：已生成 ${aliasEmail}`, 'ok');
      return aliasEmail;
    }

    function ensureCloudflareTempEmailConfig(state, options = {}) {
      const {
        requireAdminAuth = false,
        requireDomain = false,
      } = options;
      const config = getCloudflareTempEmailConfig(state);
      if (!config.baseUrl) {
        throw new Error('Cloudflare Temp Email 服务地址为空或格式无效。');
      }
      if (requireAdminAuth && !config.adminAuth) {
        throw new Error('Cloudflare Temp Email 缺少 Admin Auth。');
      }
      if (requireDomain && !config.domain) {
        throw new Error('Cloudflare Temp Email 域名为空或格式无效。');
      }
      if (config.useFixedSubdomain && !config.effectiveDomain && typeof buildCloudflareTempEmailEffectiveDomain === 'function') {
        config.effectiveDomain = buildCloudflareTempEmailEffectiveDomain(config);
      }
      if (requireDomain && config.useFixedSubdomain && !config.effectiveDomain) {
        throw new Error('Cloudflare Temp Email 固定子域前缀为空或格式无效。');
      }
      return config;
    }

    async function requestCloudflareTempEmailJson(config, path, options = {}) {
      const {
        method = 'GET',
        payload,
        searchParams,
        timeoutMs = 20000,
      } = options;

      const url = new URL(joinCloudflareTempEmailUrl(config.baseUrl, path));
      if (searchParams && typeof searchParams === 'object') {
        for (const [key, value] of Object.entries(searchParams)) {
          if (value === undefined || value === null || value === '') continue;
          url.searchParams.set(key, String(value));
        }
      }

      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(new Error('timeout')), timeoutMs);

      let response;
      try {
        response = await fetch(url.toString(), {
          method,
          headers: buildCloudflareTempEmailHeaders(config, {
            json: payload !== undefined,
          }),
          body: payload !== undefined ? JSON.stringify(payload) : undefined,
          signal: controller.signal,
        });
      } catch (err) {
        const errorMessage = err?.name === 'AbortError'
          ? `Cloudflare Temp Email 请求超时（>${Math.round(timeoutMs / 1000)} 秒）`
          : `Cloudflare Temp Email 请求失败：${err.message}`;
        throw new Error(errorMessage);
      } finally {
        clearTimeout(timeoutId);
      }

      const text = await response.text();
      let parsed;
      try {
        parsed = text ? JSON.parse(text) : {};
      } catch {
        parsed = text;
      }

      if (!response.ok) {
        const payloadError = typeof parsed === 'object' && parsed
          ? (parsed.message || parsed.error || parsed.msg)
          : '';
        throw new Error(`Cloudflare Temp Email 请求失败：${payloadError || text || `HTTP ${response.status}`}`);
      }

      return parsed;
    }

    async function fetchCloudflareTempEmailAddress(state, options = {}) {
      throwIfStopped();
      const latestState = state || await getState();
      const config = ensureCloudflareTempEmailConfig(latestState, {
        requireAdminAuth: true,
        requireDomain: true,
      });
      const requestedName = String(options.localPart || options.name || '').trim().toLowerCase()
        || buildDefaultCloudflareTempEmailLocalPart()
        || generateCloudflareAliasLocalPart();
      const effectiveDomain = config.effectiveDomain || (
        typeof buildCloudflareTempEmailEffectiveDomain === 'function'
          ? buildCloudflareTempEmailEffectiveDomain(config)
          : config.domain
      );
      const payload = {
        enablePrefix: false,
        enableRandomSubdomain: config.useFixedSubdomain ? false : Boolean(config.useRandomSubdomain),
        name: requestedName,
        domain: effectiveDomain,
      };
      const result = await requestCloudflareTempEmailJson(config, '/admin/new_address', {
        method: 'POST',
        payload,
      });
      const address = normalizeCloudflareTempEmailAddress(getCloudflareTempEmailAddressFromResponse(result));
      if (!address) {
        throw new Error('Cloudflare Temp Email 未返回可用邮箱地址。');
      }

      await persistResolvedEmailState(latestState, address, {
        source: 'generated:cloudflare-temp-email',
        preserveAccountIdentity: Boolean(options?.preserveAccountIdentity),
      });
      await addLog(`Cloudflare Temp Email：已生成 ${address}`, 'ok');
      return address;
    }

    function normalizeEmailForComparison(value) {
      return String(value || '').trim().toLowerCase();
    }

    async function fetchDuckEmail(options = {}) {
      throwIfStopped();
      const {
        generateNew = true,
        baselineEmail = '',
        state = null,
      } = options;

      await addLog(`Duck 邮箱：正在打开自动填充设置（${generateNew ? '生成新地址' : '复用当前地址'}）...`);
      await reuseOrCreateTab('duck-mail', DUCK_AUTOFILL_URL);

      const result = await sendToContentScript('duck-mail', {
        type: 'FETCH_DUCK_EMAIL',
        source: 'background',
        payload: {
          generateNew,
          baselineEmail: normalizeEmailForComparison(baselineEmail),
        },
      });

      if (result?.error) {
        throw new Error(result.error);
      }
      if (!result?.email) {
        throw new Error('未返回 Duck 邮箱地址。');
      }

      await persistResolvedEmailState(state, result.email, {
        source: 'generated:duck',
        preserveAccountIdentity: Boolean(options?.preserveAccountIdentity),
      });
      await addLog(`Duck 邮箱：${result.generated ? '已生成' : '已读取'} ${result.email}`, 'ok');
      return result.email;
    }

    async function fetchCustomEmailPoolEmail(state, options = {}) {
      throwIfStopped();
      const latestState = state || await getState();
      const requestedIndex = Math.max(0, Math.floor(Number(options.poolIndex) || 0));
      const email = String(getCustomEmailPoolEmail?.(latestState, requestedIndex + 1) || '').trim().toLowerCase();
      if (!email) {
        throw new Error(
          requestedIndex > 0
            ? `自定义邮箱池第 ${requestedIndex + 1} 个邮箱不存在，请检查邮箱池配置。`
            : '自定义邮箱池为空，请先至少填写 1 个邮箱。'
        );
      }

      await persistResolvedEmailState(latestState, email, {
        source: 'generated:custom-pool',
        preserveAccountIdentity: Boolean(options?.preserveAccountIdentity),
      });
      await addLog(`自定义邮箱池：已取用 ${email}`, 'ok');
      return email;
    }

    async function fetchManagedAliasEmail(state, options = {}) {
      throwIfStopped();
      const provider = String(options.mailProvider || state?.mailProvider || '').trim().toLowerCase();
      let mergedState = {
        ...(state || {}),
        mailProvider: provider,
      };
      if (options.mail2925Mode !== undefined) {
        mergedState.mail2925Mode = String(options.mail2925Mode || '').trim();
      }
      if (options.gmailBaseEmail !== undefined) {
        mergedState.gmailBaseEmail = String(options.gmailBaseEmail || '').trim();
      }
      if (options.mail2925BaseEmail !== undefined) {
        mergedState.mail2925BaseEmail = String(options.mail2925BaseEmail || '').trim();
      }
      if (
        provider === '2925'
        && Boolean(mergedState.mail2925UseAccountPool)
        && typeof ensureMail2925AccountForFlow === 'function'
      ) {
        const account = await ensureMail2925AccountForFlow({
          allowAllocate: true,
          preferredAccountId: mergedState.currentMail2925AccountId || null,
        });
        const latestState = await getState();
        mergedState = {
          ...latestState,
          ...mergedState,
          currentMail2925AccountId: account.id,
        };
      }

      const email = buildGeneratedAliasEmail(mergedState);
      await persistResolvedEmailState(mergedState, email, {
        source: `generated:${provider || 'alias'}`,
        preserveAccountIdentity: Boolean(options?.preserveAccountIdentity),
      });
      await addLog(`${provider === 'gmail' ? 'Gmail +tag' : '2925'}：已生成 ${email}`, 'ok');
      return email;
    }

    async function fetchGeneratedEmail(state, options = {}) {
      const currentState = state || await getState();
      const provider = String(options.mailProvider || currentState.mailProvider || '').trim().toLowerCase();
      const mail2925Mode = options.mail2925Mode !== undefined
        ? options.mail2925Mode
        : currentState.mail2925Mode;
      const generator = normalizeEmailGenerator(options.generator ?? currentState.emailGenerator);
      const mergedState = {
        ...currentState,
        mailProvider: provider || currentState.mailProvider,
        mail2925Mode,
        emailGenerator: generator,
      };
      if (options.gmailBaseEmail !== undefined) {
        mergedState.gmailBaseEmail = String(options.gmailBaseEmail || '').trim();
      }
      if (options.mail2925BaseEmail !== undefined) {
        mergedState.mail2925BaseEmail = String(options.mail2925BaseEmail || '').trim();
      }
      if (options.customEmailPool !== undefined) {
        mergedState.customEmailPool = options.customEmailPool;
      }
      if (generator === 'custom') {
        throw new Error('当前邮箱生成方式为自定义邮箱，请直接填写注册邮箱。');
      }
      if (generator === CUSTOM_EMAIL_POOL_GENERATOR) {
        return fetchCustomEmailPoolEmail(mergedState, options);
      }
      const shouldUseManagedAlias = typeof isGeneratedAliasProvider === 'function'
        ? isGeneratedAliasProvider(mergedState, mail2925Mode)
        : false;
      if (shouldUseManagedAlias) {
        return fetchManagedAliasEmail(mergedState, options);
      }
      if (generator === 'icloud') {
        const stateFetchMode = String(mergedState.icloudFetchMode || '').trim().toLowerCase();
        const icloudOptions = {
          generateNew: Boolean(options.generateNew) || stateFetchMode === 'always_new',
          preserveAccountIdentity: Boolean(options?.preserveAccountIdentity),
          source: 'generated:icloud',
          state: mergedState,
        };
        if (mergedState.icloudHostPreference !== undefined) {
          icloudOptions.hostPreference = mergedState.icloudHostPreference;
        }
        if (mergedState.preferredIcloudHost !== undefined) {
          icloudOptions.preferredHost = mergedState.preferredIcloudHost;
        }
        return fetchIcloudHideMyEmail(icloudOptions);
      }
      if (generator === 'cloudflare') {
        return fetchCloudflareEmail(mergedState, options);
      }
      if (generator === CLOUDFLARE_TEMP_EMAIL_GENERATOR) {
        return fetchCloudflareTempEmailAddress(mergedState, options);
      }
      const resolvedDuckBaselineEmail = typeof getRegistrationEmailBaseline === 'function'
        ? getRegistrationEmailBaseline(mergedState, {
          preferredEmail: options.currentEmail,
          fallbackEmail: options.baselineEmail,
        })
        : String(
          options.currentEmail
          || options.baselineEmail
          || mergedState.email
          || ''
        ).trim();
      return fetchDuckEmail({
        ...options,
        state: mergedState,
        baselineEmail: resolvedDuckBaselineEmail,
      });
    }

    return {
      ensureCloudflareTempEmailConfig,
      fetchCloudflareEmail,
      fetchCustomEmailPoolEmail,
      fetchCloudflareTempEmailAddress,
      fetchDuckEmail,
      fetchGeneratedEmail,
      buildDefaultCloudflareTempEmailLocalPart,
      buildDefaultGeneratedEmailLocalPart,
      buildNaturalEmailLocalPart,
      buildRandomNameDateTimeLocalPart,
      generateCloudflareAliasLocalPart,
      requestCloudflareTempEmailJson,
    };
  }

  return {
    createGeneratedEmailHelpers,
  };
});
