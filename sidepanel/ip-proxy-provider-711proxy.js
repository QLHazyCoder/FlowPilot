// sidepanel/ip-proxy-provider-711proxy.js — 711Proxy panel-specific logic
function normalizeIpProxyCountryCode(value = '') {
  const raw = String(value || '').trim().toUpperCase().replace(/[^A-Z]/g, '');
  return /^[A-Z]{2}$/.test(raw) ? raw : '';
}

function infer711RegionFromHost(host = '') {
  const text = String(host || '').trim().toLowerCase().replace(/\.$/, '');
  if (!text || !text.includes('.')) {
    return '';
  }
  const firstLabel = String(text.split('.')[0] || '').trim();
  return /^[a-z]{2}$/.test(firstLabel) ? firstLabel.toUpperCase() : '';
}

function infer711RegionFromUsername(username = '') {
  const text = String(username || '').trim();
  if (!text) {
    return '';
  }
  const match = text.match(/(?:^|[-_])region[-_:]?([A-Za-z]{2})\b/i);
  return normalizeIpProxyCountryCode(match ? match[1] : '');
}

function resolve711ProxyRegionFromInputs({ host = '', username = '', region = '' } = {}) {
  const fromUsername = infer711RegionFromUsername(username);
  if (fromUsername) {
    return fromUsername;
  }
  const fromHost = infer711RegionFromHost(host);
  if (fromHost) {
    return fromHost;
  }
  return normalizeIpProxyCountryCode(region);
}
