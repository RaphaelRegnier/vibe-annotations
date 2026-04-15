// URL validation and filtering for supported origins

export function isLocalhostUrl(url) {
  if (!url) return false;
  try {
    const urlObj = new URL(url);
    if (urlObj.hostname === 'localhost' ||
        urlObj.hostname === '127.0.0.1' ||
        urlObj.hostname === '0.0.0.0') return true;
    if (urlObj.hostname.endsWith('.local') ||
        urlObj.hostname.endsWith('.test') ||
        urlObj.hostname.endsWith('.localhost')) return true;
    if (urlObj.protocol === 'file:') {
      const path = urlObj.pathname.toLowerCase();
      return ['.html', '.htm'].some(ext => path.endsWith(ext)) ||
             (!path.includes('.') || path.endsWith('/'));
    }
    return false;
  } catch { return false; }
}

export async function isEnabledSite(url) {
  if (!url) return false;
  try {
    const origin = new URL(url).origin + '/*';
    const result = await chrome.storage.local.get(['vibeEnabledSites']);
    return (result.vibeEnabledSites || []).includes(origin);
  } catch { return false; }
}

export async function isSupportedUrl(url) {
  return isLocalhostUrl(url) || await isEnabledSite(url);
}
