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

  // --- Server status ---

  async function checkServerStatus() {
    const now = Date.now();
    if (statusCache && (now - statusCacheTime) < CACHE_TTL) return statusCache;

    let status;

    if (isFileProtocol()) {
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

  async function saveAnnotation(annotation) {
    try {
      const r = await chrome.runtime.sendMessage({ action: 'saveAnnotation', annotation });
      if (!r || !r.success) throw new Error(r?.error || 'save failed');
      return true;
    } catch (e) {
      // Fallback: direct storage
      console.warn('saveAnnotation bg failed, using storage fallback', e);
      const result = await chrome.storage.local.get(['annotations']);
      const all = result.annotations || [];
      all.push(annotation);
      await chrome.storage.local.set({ annotations: all });
      return true;
    }
  }

  async function updateAnnotation(id, updates) {
    try {
      const r = await chrome.runtime.sendMessage({ action: 'updateAnnotation', id, updates });
      if (!r || !r.success) throw new Error(r?.error || 'update failed');
      return true;
    } catch (e) {
      console.warn('updateAnnotation bg failed, using storage fallback', e);
      const result = await chrome.storage.local.get(['annotations']);
      const all = result.annotations || [];
      const idx = all.findIndex(a => a.id === id);
      if (idx !== -1) {
        all[idx] = { ...all[idx], ...updates };
        await chrome.storage.local.set({ annotations: all });
      }
      return true;
    }
  }

  async function deleteAnnotation(id) {
    try {
      const r = await chrome.runtime.sendMessage({ action: 'deleteAnnotation', id });
      if (!r || !r.success) throw new Error(r?.error || 'delete failed');
      return true;
    } catch (e) {
      console.warn('deleteAnnotation bg failed, using storage fallback', e);
      const result = await chrome.storage.local.get(['annotations']);
      const all = result.annotations || [];
      const filtered = all.filter(a => a.id !== id);
      await chrome.storage.local.set({ annotations: filtered });
      return true;
    }
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

  async function getScreenshotEnabled() {
    try {
      const r = await chrome.storage.local.get(['screenshotEnabled']);
      return r.screenshotEnabled !== undefined ? r.screenshotEnabled : true;
    } catch {
      return true;
    }
  }

  async function saveScreenshotEnabled(enabled) {
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
      await chrome.storage.local.set({ vibeOverlayHidden: hidden });
    } catch { /* ignore */ }
  }

  return {
    checkServerStatus,
    clearStatusCache,
    isFileProtocol,
    loadAnnotations,
    saveAnnotation,
    updateAnnotation,
    deleteAnnotation,
    onAnnotationsChanged,
    getScreenshotEnabled,
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
    saveOverlayHidden
  };
})();
