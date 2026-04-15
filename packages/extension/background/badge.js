// Extension icon badge management
import { isSupportedUrl } from './url-filter.js';

export async function updateBadge(tabId, url) {
  try {
    const result = await chrome.storage.local.get(['annotations']);
    const annotations = result.annotations || [];
    let origin;
    try { origin = new URL(url).origin; } catch { origin = null; }
    const projectAnnotations = origin
      ? annotations.filter(a => { try { return new URL(a.url).origin === origin; } catch { return false; } })
      : annotations.filter(a => a.url === url);
    const pendingCount = projectAnnotations.filter(a => a.status === 'pending').length;

    if (pendingCount > 0) {
      await chrome.action.setBadgeText({ tabId, text: pendingCount.toString() });
      await chrome.action.setBadgeBackgroundColor({ tabId, color: '#D03D68' });
      await chrome.action.setTitle({ tabId, title: `Vibe Annotations - ${pendingCount} pending annotation${pendingCount === 1 ? '' : 's'}` });
    } else {
      await clearBadge(tabId);
    }
  } catch (error) {
    console.error('Error updating badge:', error);
  }
}

export async function clearBadge(tabId) {
  try {
    await chrome.action.setBadgeText({ tabId, text: '' });
    await chrome.action.setTitle({ tabId, title: 'Vibe Annotations' });
  } catch (error) {
    console.error('Error clearing badge:', error);
  }
}

export async function updateBadgeForUrl(url) {
  try {
    const tabs = await chrome.tabs.query({ url });
    for (const tab of tabs) await updateBadge(tab.id, url);
  } catch (error) {
    console.error('Error updating badge for URL:', url, error);
  }
}

export async function updateAllBadges() {
  try {
    const tabs = await chrome.tabs.query({});
    for (const tab of tabs) {
      if (await isSupportedUrl(tab.url)) await updateBadge(tab.id, tab.url);
    }
  } catch (error) {
    console.error('Error updating all badges:', error);
  }
}
