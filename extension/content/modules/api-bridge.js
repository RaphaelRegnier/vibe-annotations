// Wraps all chrome.runtime.sendMessage and chrome.storage calls
// Single interface for data operations used by all modules

var VibeAPI = (() => {
  const SERVER_URL = 'http://127.0.0.1:3846';
  let statusCache = null;
  let statusCacheTime = 0;
  const CACHE_TTL = 2000;

  function isFileProtocol() {
    return window.location.protocol === 'file:';
  }

  function isLocalOrigin() {
    const h = window.location.hostname;
    return h === 'localhost' || h === '127.0.0.1' || h === '0.0.0.0'
      || h.endsWith('.local') || h.endsWith('.test') || h.endsWith('.localhost');
  }

  // --- Server status ---

  async function checkServerStatus() {
    const now = Date.now();
    if (statusCache && (now - statusCacheTime) < CACHE_TTL) return statusCache;

    let status;

    if (isFileProtocol() || !isLocalOrigin()) {
      // Non-local origins can't fetch localhost directly (CORS) — route via background
      status = await _checkViaBg();
    } else {
      try {
        const res = await fetch(`${SERVER_URL}/health`, {
          method: 'GET',
          signal: AbortSignal.timeout(2000),
          mode: 'cors',
          credentials: 'omit'
        });
        status = { connected: res.ok };
      } catch {
        status = await _checkViaBg();
      }
    }

    statusCache = status;
    statusCacheTime = now;
    return status;
  }

  async function _checkViaBg() {
    try {
      const r = await chrome.runtime.sendMessage({ action: 'checkMCPStatus' });
      return { connected: !!(r && r.success && r.status && r.status.connected) };
    } catch {
      return { connected: false };
    }
  }

  function clearStatusCache() {
    statusCache = null;
    statusCacheTime = 0;
  }

  // --- Annotations CRUD ---

  async function loadAnnotations() {
    try {
      const result = await chrome.storage.local.get(['annotations']);
      const all = result.annotations || [];
      return all.filter(a => a.url === window.location.href);
    } catch {
      return [];
    }
  }

  async function loadProjectAnnotations() {
    try {
      const result = await chrome.storage.local.get(['annotations']);
      const all = result.annotations || [];
      const origin = window.location.origin;
      return all.filter(a => {
        try { return new URL(a.url).origin === origin; } catch { return false; }
      });
    } catch {
      return [];
    }
  }

  async function saveAnnotation(annotation) {
    const r = await chrome.runtime.sendMessage({ action: 'saveAnnotation', annotation });
    if (!r || !r.success) throw new Error(r?.error || 'save failed');
    return true;
  }

  async function updateAnnotation(id, updates) {
    const r = await chrome.runtime.sendMessage({ action: 'updateAnnotation', id, updates });
    if (!r || !r.success) throw new Error(r?.error || 'update failed');
    return true;
  }

  async function deleteAnnotation(id) {
    const r = await chrome.runtime.sendMessage({ action: 'deleteAnnotation', id });
    if (!r || !r.success) throw new Error(r?.error || 'delete failed');
    return true;
  }

  async function deleteAnnotationsByUrl() {
    const r = await chrome.runtime.sendMessage({ action: 'deleteAnnotationsByUrl', url: window.location.href });
    if (!r || !r.success) throw new Error(r?.error || 'bulk delete failed');
    return r.count || 0;
  }

  // --- Storage listeners ---

  function onAnnotationsChanged(cb) {
    chrome.storage.onChanged.addListener((changes, ns) => {
      if (ns === 'local' && changes.annotations) {
        cb(changes.annotations.newValue || []);
      }
    });
  }

  // --- Settings ---

  let _screenshotEnabledCache = true; // default, updated on load + save

  async function getScreenshotEnabled() {
    try {
      const r = await chrome.storage.local.get(['screenshotEnabled']);
      _screenshotEnabledCache = r.screenshotEnabled !== undefined ? r.screenshotEnabled : true;
      return _screenshotEnabledCache;
    } catch {
      return true;
    }
  }

  function isScreenshotEnabled() {
    return _screenshotEnabledCache;
  }

  async function saveScreenshotEnabled(enabled) {
    _screenshotEnabledCache = enabled;
    try {
      await chrome.storage.local.set({ screenshotEnabled: enabled });
    } catch { /* ignore */ }
  }

  async function getToolbarPosition() {
    try {
      const r = await chrome.storage.local.get(['vibeToolbarPos']);
      return r.vibeToolbarPos || null;
    } catch {
      return null;
    }
  }

  async function saveToolbarPosition(pos) {
    try {
      await chrome.storage.local.set({ vibeToolbarPos: pos });
    } catch { /* ignore */ }
  }

  async function getToolbarCollapsed() {
    try {
      const r = await chrome.storage.local.get(['vibeToolbarCollapsed']);
      return !!r.vibeToolbarCollapsed;
    } catch {
      return false;
    }
  }

  async function saveToolbarCollapsed(collapsed) {
    try {
      await chrome.storage.local.set({ vibeToolbarCollapsed: collapsed });
    } catch { /* ignore */ }
  }

  async function getClearOnCopy() {
    try {
      const r = await chrome.storage.local.get(['vibeClearOnCopy']);
      return !!r.vibeClearOnCopy;
    } catch {
      return false;
    }
  }

  async function saveClearOnCopy(enabled) {
    try {
      await chrome.storage.local.set({ vibeClearOnCopy: enabled });
    } catch { /* ignore */ }
  }

  async function getBadgeColor() {
    try {
      const r = await chrome.storage.local.get(['vibeBadgeColor']);
      return r.vibeBadgeColor || '#4b5563';
    } catch {
      return '#4b5563';
    }
  }

  async function saveBadgeColor(color) {
    try {
      await chrome.storage.local.set({ vibeBadgeColor: color });
    } catch { /* ignore */ }
  }

  async function getOverlayHidden() {
    try {
      const r = await chrome.storage.local.get(['vibeOverlayHidden']);
      return !!r.vibeOverlayHidden;
    } catch {
      return false;
    }
  }

  async function saveOverlayHidden(hidden) {
    try {
      await chrome.storage.local.set({ vibeOverlayHidden: !!hidden });
    } catch { /* ignore */ }
  }

  async function getSkipDeleteConfirm() {
    try {
      const r = await chrome.storage.local.get(['vibeSkipDeleteConfirm']);
      return !!r.vibeSkipDeleteConfirm;
    } catch {
      return false;
    }
  }

  async function saveSkipDeleteConfirm(skip) {
    try {
      await chrome.storage.local.set({ vibeSkipDeleteConfirm: skip });
    } catch { /* ignore */ }
  }

  async function getCustomShortcut() {
    try {
      const r = await chrome.storage.local.get(['vibeCustomShortcut']);
      return r.vibeCustomShortcut || null;
    } catch {
      return null;
    }
  }

  async function saveCustomShortcut(shortcut) {
    try {
      await chrome.storage.local.set({ vibeCustomShortcut: shortcut });
    } catch { /* ignore */ }
  }

  async function stopWatchers() {
    try {
      await fetch(`${SERVER_URL}/api/watchers/stop`, { method: 'POST', signal: AbortSignal.timeout(2000) });
    } catch { /* ignore */ }
  }

  async function getWatchers() {
    try {
      const res = await fetch(`${SERVER_URL}/api/watchers`, {
        signal: AbortSignal.timeout(2000),
      });
      if (!res.ok) return { watchers: [], watching: false };
      return await res.json();
    } catch {
      return { watchers: [], watching: false };
    }
  }

  return {
    checkServerStatus,
    clearStatusCache,
    isFileProtocol,
    loadAnnotations,
    loadProjectAnnotations,
    saveAnnotation,
    updateAnnotation,
    deleteAnnotation,
    deleteAnnotationsByUrl,
    onAnnotationsChanged,
    getScreenshotEnabled,
    isScreenshotEnabled,
    saveScreenshotEnabled,
    getToolbarPosition,
    saveToolbarPosition,
    getToolbarCollapsed,
    saveToolbarCollapsed,
    getClearOnCopy,
    saveClearOnCopy,
    getBadgeColor,
    saveBadgeColor,
    getOverlayHidden,
    saveOverlayHidden,
    getSkipDeleteConfirm,
    saveSkipDeleteConfirm,
    getCustomShortcut,
    saveCustomShortcut,
    getWatchers,
    stopWatchers
  };
})();
