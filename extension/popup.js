// popup.js — unified popup for all sites

(async () => {
  const mainBtn = document.getElementById('mainBtn');
  const siteUrlEl = document.getElementById('siteUrl');
  const messageEl = document.getElementById('message');
  const successEl = document.getElementById('success');
  const updateBanner = document.getElementById('updateBanner');
  const updateLink = document.getElementById('updateLink');

  // --- Update banner ---
  const updateText = document.getElementById('updateText');
  const updateDismiss = document.getElementById('updateDismiss');
  try {
    const { updateInfo } = await chrome.storage.local.get(['updateInfo']);
    if (updateInfo?.hasUpdate) {
      // Clear the NEW badge immediately on popup open
      chrome.action.setBadgeText({ text: '' });

      updateBanner.classList.remove('hidden');
      updateText.textContent = `Version ${updateInfo.currentVersion} installed`;
      const releaseUrl = updateInfo.releaseUrl || 'https://github.com/RaphaelRegnier/vibe-annotations/releases';
      updateLink.href = releaseUrl;

      async function dismissBanner() {
        await chrome.storage.local.set({ updateInfo: { ...updateInfo, hasUpdate: false } });
        updateBanner.classList.add('hidden');
      }

      updateLink.addEventListener('click', dismissBanner);
      updateDismiss.addEventListener('click', dismissBanner);
    }
  } catch { /* ignore */ }

  // --- Get active tab ---
  const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
  if (!tab?.url) {
    mainBtn.classList.remove('hidden');
    mainBtn.disabled = true;
    mainBtn.textContent = 'No active tab';
    return;
  }

  // Chrome internal pages
  if (tab.url.startsWith('chrome://') || tab.url.startsWith('chrome-extension://') || tab.url.startsWith('about:')) {
    mainBtn.classList.remove('hidden');
    mainBtn.disabled = true;
    mainBtn.textContent = 'Cannot enable for browser pages';
    return;
  }

  let origin;
  try {
    const url = new URL(tab.url);
    origin = `${url.protocol}//${url.host}`;
  } catch {
    mainBtn.classList.remove('hidden');
    mainBtn.disabled = true;
    mainBtn.textContent = 'Invalid URL';
    return;
  }

  const originPattern = `${origin}/*`;

  // --- Check if content script is loaded and get overlay state ---
  let contentScriptLoaded = false;
  let overlayVisible = false;
  try {
    const response = await chrome.tabs.sendMessage(tab.id, { action: 'getOverlayState' });
    if (response?.success) {
      contentScriptLoaded = true;
      overlayVisible = response.visible;
    }
  } catch { /* content script not loaded */ }

  // --- Determine site support ---
  const isLocalhost = isLocalhostUrl(tab.url);
  const granted = !isLocalhost && await chrome.permissions.contains({ origins: [originPattern] });
  const isSupported = isLocalhost || granted;

  if (isSupported) {
    // --- Supported site (localhost or user-enabled) ---
    if (granted) {
      // Re-ensure content scripts are registered (may have been lost on SW restart)
      await chrome.runtime.sendMessage({
        action: 'enableSite',
        originPattern,
        tabId: null
      });
    }

    mainBtn.classList.remove('hidden');

    if (contentScriptLoaded) {
      // Content script running — show toggle
      setToggleState(overlayVisible);
      mainBtn.addEventListener('click', async () => {
        const r = await chrome.tabs.sendMessage(tab.id, { action: 'toggleOverlay' });
        setToggleState(r?.visible ?? !overlayVisible);
      });
    } else {
      // Content script not loaded — offer reload
      mainBtn.textContent = 'Reload to activate';
      mainBtn.addEventListener('click', async () => {
        await chrome.tabs.reload(tab.id);
        setTimeout(() => window.close(), 500);
      });
    }
  } else {
    // --- Non-supported site — offer per-site enable ---
    messageEl.classList.remove('hidden');
    messageEl.innerHTML = '<strong>This site isn\'t a local development URL.</strong> You can enable it for this specific site if you need to annotate here.';
    siteUrlEl.classList.remove('hidden');
    siteUrlEl.textContent = origin;
    mainBtn.classList.remove('hidden');
    mainBtn.textContent = 'Enable for this site';

    mainBtn.addEventListener('click', async () => {
      try {
        const ok = await chrome.permissions.request({ origins: [originPattern] });
        if (ok) {
          // Save to storage so background.js can track enabled sites
          const result = await chrome.storage.local.get(['vibeEnabledSites']);
          const sites = result.vibeEnabledSites || [];
          if (!sites.includes(originPattern)) {
            sites.push(originPattern);
            await chrome.storage.local.set({ vibeEnabledSites: sites });
          }

          // Register content scripts and reload
          await chrome.runtime.sendMessage({
            action: 'enableSite',
            originPattern,
            tabId: tab.id
          });

          messageEl.classList.add('hidden');
          siteUrlEl.classList.add('hidden');
          successEl.classList.remove('hidden');
          successEl.innerHTML = '<strong>Site enabled!</strong> Page is reloading.';
          mainBtn.classList.add('hidden');

          setTimeout(() => window.close(), 1500);
        }
      } catch (err) {
        console.error('Permission request failed:', err);
        mainBtn.textContent = 'Permission denied';
        mainBtn.disabled = true;
      }
    });
  }

  // --- Helpers ---

  function setToggleState(visible) {
    overlayVisible = visible;
    mainBtn.textContent = visible ? 'Hide Vibe Annotations' : 'Show Vibe Annotations';
  }

  function isLocalhostUrl(url) {
    try {
      const u = new URL(url);
      if (u.hostname === 'localhost' || u.hostname === '127.0.0.1' || u.hostname === '0.0.0.0') return true;
      if (u.hostname.endsWith('.local') || u.hostname.endsWith('.test') || u.hostname.endsWith('.localhost')) return true;
      if (u.protocol === 'file:') return true;
      return false;
    } catch {
      return false;
    }
  }
})();
