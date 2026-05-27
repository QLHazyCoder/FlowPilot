(() => {
  const GITHUB_OWNER = 'QLHazyCoder';
  const GITHUB_REPO = 'FlowPilot';
  const RELEASES_PAGE_URL = `https://github.com/${GITHUB_OWNER}/${GITHUB_REPO}/releases`;
  const RELEASES_API_URL = `https://api.github.com/repos/${GITHUB_OWNER}/${GITHUB_REPO}/releases?per_page=10`;
  const CACHE_KEY = 'flowpilot-release-snapshot-v1';
  const IGNORED_UPDATE_VERSION_KEY = 'flowpilot-ignored-release-version-v1';
  const CACHE_TTL_MS = 60 * 60 * 1000;
  const FETCH_TIMEOUT_MS = 8000;
  const MAX_RELEASES = 10;
  const MAX_NOTES_PER_RELEASE = 5;
  const VERSION_FAMILY_FLOWPILOT = 'flowpilot';
  const VERSION_FAMILY_ULTRA = 'ultra';
  const VERSION_FAMILY_PRO = 'pro';
  const VERSION_FAMILY_LEGACY = 'legacy';

  function getVersionFamily(version, fallbackFamily = VERSION_FAMILY_LEGACY) {
    const trimmed = String(version || '').trim();
    if (/^flowpilot/i.test(trimmed)) {
      return VERSION_FAMILY_FLOWPILOT;
    }
    if (/^ultra/i.test(trimmed)) {
      return VERSION_FAMILY_ULTRA;
    }
    if (/^pro/i.test(trimmed)) {
      return VERSION_FAMILY_PRO;
    }
    if (/^v/i.test(trimmed)) {
      return VERSION_FAMILY_LEGACY;
    }
    return fallbackFamily;
  }

  function stripVersionPrefix(version) {
    return String(version || '').trim().replace(/^(?:flowpilot|ultra|pro|v)\s*/i, '');
  }

  function extractVersionCore(version) {
    const core = stripVersionPrefix(version).split('-')[0];
    return /^\d+(?:\.\d+){1,3}$/.test(core) ? core : '';
  }

  function formatDisplayVersion(version, fallbackFamily = VERSION_FAMILY_LEGACY) {
    const core = extractVersionCore(version);
    if (!core) {
      return '';
    }

    const family = getVersionFamily(version, fallbackFamily);
    return `${getVersionFamilyPrefix(family)}${core}`;
  }

  function parseVersionMeta(version, fallbackFamily = VERSION_FAMILY_LEGACY) {
    const family = getVersionFamily(version, fallbackFamily);
    const core = extractVersionCore(version);
    return {
      family,
      core,
      displayVersion: core ? `${getVersionFamilyPrefix(family)}${core}` : '',
      parts: core
        ? core.split('.').map((part) => {
          const numeric = Number.parseInt(part, 10);
          return Number.isFinite(numeric) ? numeric : 0;
        })
        : [0],
    };
  }

  function getVersionFamilyPrefix(family) {
    if (family === VERSION_FAMILY_FLOWPILOT) {
      return 'FlowPilot';
    }
    if (family === VERSION_FAMILY_ULTRA) {
      return 'Ultra';
    }
    if (family === VERSION_FAMILY_PRO) {
      return 'Pro';
    }
    return 'v';
  }

  function getVersionFamilyRank(family) {
    if (family === VERSION_FAMILY_FLOWPILOT) {
      return 4;
    }
    if (family === VERSION_FAMILY_ULTRA) {
      return 3;
    }
    if (family === VERSION_FAMILY_PRO) {
      return 2;
    }
    return 1;
  }

  function parseVersionParts(version, fallbackFamily = VERSION_FAMILY_LEGACY) {
    return parseVersionMeta(version, fallbackFamily).parts;
  }

  function compareVersions(left, right, fallbackFamily = VERSION_FAMILY_LEGACY) {
    const leftMeta = parseVersionMeta(left, fallbackFamily);
    const rightMeta = parseVersionMeta(right, fallbackFamily);
    const leftFamilyRank = getVersionFamilyRank(leftMeta.family);
    const rightFamilyRank = getVersionFamilyRank(rightMeta.family);

    if (leftFamilyRank > rightFamilyRank) {
      return 1;
    }
    if (leftFamilyRank < rightFamilyRank) {
      return -1;
    }

    const leftParts = leftMeta.parts;
    const rightParts = rightMeta.parts;
    const maxLength = Math.max(leftParts.length, rightParts.length, 3);

    for (let index = 0; index < maxLength; index += 1) {
      const leftPart = leftParts[index] || 0;
      const rightPart = rightParts[index] || 0;
      if (leftPart > rightPart) {
        return 1;
      }
      if (leftPart < rightPart) {
        return -1;
      }
    }

    return 0;
  }

  function sanitizeInlineMarkdown(text) {
    return String(text || '')
      .replace(/!\[[^\]]*]\(([^)]+)\)/g, '')
      .replace(/\[([^\]]+)]\(([^)]+)\)/g, '$1')
      .replace(/`([^`]+)`/g, '$1')
      .replace(/[*_~>#]/g, '')
      .replace(/\s+/g, ' ')
      .trim();
  }

  function parseReleaseNotes(body) {
    const lines = String(body || '')
      .replace(/\r\n/g, '\n')
      .split('\n')
      .map((line) => line.trim())
      .filter(Boolean);

    const bulletLines = [];
    const plainLines = [];

    for (const line of lines) {
      if (/^#{1,6}\s*/.test(line)) {
        continue;
      }

      if (/^```/.test(line) || /^---+$/.test(line)) {
        continue;
      }

      if (/^[-*+]\s+/.test(line)) {
        bulletLines.push(line.replace(/^[-*+]\s+/, ''));
        continue;
      }

      if (/^\d+\.\s+/.test(line)) {
        bulletLines.push(line.replace(/^\d+\.\s+/, ''));
        continue;
      }

      plainLines.push(line);
    }

    const noteLines = bulletLines.length > 0 ? bulletLines : plainLines;
    return noteLines
      .map(sanitizeInlineMarkdown)
      .filter(Boolean)
      .slice(0, MAX_NOTES_PER_RELEASE);
  }

  function normalizeReleaseVersion(release) {
    const candidates = [
      release?.tag_name,
      release?.name,
    ];

    for (const candidate of candidates) {
      const meta = parseVersionMeta(candidate);
      if (meta.core) {
        return meta;
      }
    }

    return null;
  }

  function sanitizeRelease(release) {
    const versionMeta = normalizeReleaseVersion(release);
    if (!versionMeta?.core) {
      return null;
    }

    const rawTitle = sanitizeInlineMarkdown(release?.name || '');
    const titleMeta = parseVersionMeta(rawTitle, versionMeta.family);
    const normalizedTitle = titleMeta.core && titleMeta.displayVersion === versionMeta.displayVersion
      ? ''
      : rawTitle;

    return {
      version: versionMeta.core,
      displayVersion: versionMeta.displayVersion,
      family: versionMeta.family,
      title: normalizedTitle,
      url: String(release?.html_url || RELEASES_PAGE_URL),
      publishedAt: String(release?.published_at || release?.created_at || ''),
      notes: parseReleaseNotes(release?.body || ''),
    };
  }

  function getComparableReleaseVersion(release) {
    const fallbackFamily = [VERSION_FAMILY_FLOWPILOT, VERSION_FAMILY_ULTRA, VERSION_FAMILY_PRO].includes(release?.family)
      ? release.family
      : VERSION_FAMILY_LEGACY;
    const displayVersion = String(release?.displayVersion || '').trim();
    if (displayVersion) {
      return displayVersion;
    }
    return formatDisplayVersion(release?.version || '', fallbackFamily);
  }

  function sortReleasesByVersion(releases = []) {
    return [...releases].sort((left, right) => (
      compareVersions(
        getComparableReleaseVersion(right),
        getComparableReleaseVersion(left)
      )
    ));
  }

  function readCache() {
    try {
      const raw = localStorage.getItem(CACHE_KEY);
      if (!raw) {
        return null;
      }

      const parsed = JSON.parse(raw);
      if (!parsed || !Array.isArray(parsed.releases) || !Number.isFinite(parsed.fetchedAt)) {
        return null;
      }

      if ((Date.now() - parsed.fetchedAt) > CACHE_TTL_MS) {
        return null;
      }

      return sortReleasesByVersion(parsed.releases).slice(0, MAX_RELEASES);
    } catch (error) {
      return null;
    }
  }

  function writeCache(releases) {
    try {
      localStorage.setItem(CACHE_KEY, JSON.stringify({
        fetchedAt: Date.now(),
        releases,
      }));
    } catch (error) {
      // Ignore cache write failures.
    }
  }

  function getIgnoredUpdateVersion() {
    try {
      return String(localStorage.getItem(IGNORED_UPDATE_VERSION_KEY) || '').trim();
    } catch (error) {
      return '';
    }
  }

  function setIgnoredUpdateVersion(version) {
    const normalized = formatDisplayVersion(version, VERSION_FAMILY_FLOWPILOT) || String(version || '').trim();
    try {
      if (normalized) {
        localStorage.setItem(IGNORED_UPDATE_VERSION_KEY, normalized);
      } else {
        localStorage.removeItem(IGNORED_UPDATE_VERSION_KEY);
      }
    } catch (error) {
      // Ignore localStorage failures.
    }
    return normalized;
  }

  function clearIgnoredUpdateVersion() {
    return setIgnoredUpdateVersion('');
  }

  async function fetchReleases() {
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), FETCH_TIMEOUT_MS);

    try {
      const response = await fetch(RELEASES_API_URL, {
        method: 'GET',
        headers: {
          Accept: 'application/vnd.github+json',
        },
        cache: 'no-store',
        signal: controller.signal,
      });

      if (!response.ok) {
        throw new Error(`GitHub Releases request failed (${response.status})`);
      }

      const payload = await response.json();
      if (!Array.isArray(payload)) {
        throw new Error('GitHub Releases response format error');
      }

      const releases = payload
        .filter((release) => release && !release.draft && !release.prerelease)
        .map(sanitizeRelease)
        .filter(Boolean);

      const sortedReleases = sortReleasesByVersion(releases).slice(0, MAX_RELEASES);

      writeCache(sortedReleases);
      return sortedReleases;
    } catch (error) {
      if (error?.name === 'AbortError') {
        throw new Error('GitHub Releases request timed out');
      }
      throw error;
    } finally {
      clearTimeout(timeoutId);
    }
  }

  async function loadReleases(options = {}) {
    if (!options.force) {
      const cached = readCache();
      if (cached) {
        return cached;
      }
    }

    return fetchReleases();
  }

  function buildReleaseSnapshot(releases, localVersion) {
    const latestRelease = releases[0] || null;
    if (!latestRelease) {
      return {
        status: 'empty',
        localVersion,
        latestVersion: null,
        latestRelease: null,
        newerReleases: [],
        logUrl: RELEASES_PAGE_URL,
        releasesPageUrl: RELEASES_PAGE_URL,
        checkedAt: Date.now(),
      };
    }

    const newerReleases = releases.filter((release) => compareVersions(release.displayVersion, localVersion) > 0);
    const ignoredVersion = getIgnoredUpdateVersion();
    const newestUpdateVersion = newerReleases[0]?.displayVersion || '';
    const updateIgnored = Boolean(newestUpdateVersion)
      && Boolean(ignoredVersion)
      && compareVersions(ignoredVersion, newestUpdateVersion) === 0;
    return {
      status: newerReleases.length > 0
        ? (updateIgnored ? 'ignored' : 'update-available')
        : 'latest',
      localVersion,
      latestVersion: latestRelease.displayVersion,
      latestRelease,
      newerReleases,
      ignoredVersion: updateIgnored ? ignoredVersion : '',
      logUrl: latestRelease.url || RELEASES_PAGE_URL,
      releasesPageUrl: RELEASES_PAGE_URL,
      checkedAt: Date.now(),
    };
  }

  function getSnapshotUpdateVersion(snapshot = {}) {
    const newerReleases = Array.isArray(snapshot?.newerReleases) ? snapshot.newerReleases : [];
    return newerReleases[0]?.displayVersion || snapshot?.latestVersion || '';
  }

  function ignoreReleaseSnapshot(snapshot = {}) {
    const targetVersion = getSnapshotUpdateVersion(snapshot);
    if (!targetVersion) {
      return '';
    }
    return setIgnoredUpdateVersion(targetVersion);
  }

  function getLocalVersionLabel(manifest = chrome.runtime.getManifest()) {
    const versionName = formatDisplayVersion(manifest?.version_name, VERSION_FAMILY_FLOWPILOT);
    if (versionName) {
      return versionName;
    }

    const versionCore = extractVersionCore(manifest?.version || '');
    return versionCore ? formatDisplayVersion(`FlowPilot${versionCore}`, VERSION_FAMILY_FLOWPILOT) : '';
  }

  async function getReleaseSnapshot(options = {}) {
    const localVersion = getLocalVersionLabel(chrome.runtime.getManifest()) || 'FlowPilot0.0';

    try {
      const releases = await loadReleases(options);
      return buildReleaseSnapshot(releases, localVersion);
    } catch (error) {
      return {
        status: 'error',
        localVersion,
        latestVersion: null,
        latestRelease: null,
        newerReleases: [],
        logUrl: RELEASES_PAGE_URL,
        releasesPageUrl: RELEASES_PAGE_URL,
        checkedAt: Date.now(),
        errorMessage: error?.message || 'Update check failed',
      };
    }
  }

  function formatReleaseDate(value) {
    if (!value) {
      return '';
    }

    const date = new Date(value);
    if (Number.isNaN(date.getTime())) {
      return '';
    }

    const year = date.getFullYear();
    const month = String(date.getMonth() + 1).padStart(2, '0');
    const day = String(date.getDate()).padStart(2, '0');
    return `${year}-${month}-${day}`;
  }

  window.SidepanelUpdateService = {
    compareVersions,
    formatDisplayVersion,
    formatReleaseDate,
    clearIgnoredUpdateVersion,
    getIgnoredUpdateVersion,
    getLocalVersionLabel,
    getReleaseSnapshot,
    ignoreReleaseSnapshot,
    repositoryUrl: `https://github.com/${GITHUB_OWNER}/${GITHUB_REPO}`,
    releasesPageUrl: RELEASES_PAGE_URL,
    stripVersionPrefix,
  };
})();
