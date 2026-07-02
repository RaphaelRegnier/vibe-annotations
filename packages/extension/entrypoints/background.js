// Vibe Annotations Background Service Worker — WXT entrypoint.
// Body is unchanged from the pre-WXT build; paths updated + wrapped in defineBackground().

import { isSupportedUrl, isLocalhostUrl } from '../lib/background/url-filter.js';
import { updateBadge, clearBadge, updateBadgeForUrl, updateAllBadges } from '../lib/background/badge.js';
import { isConnected, checkConnection, syncAll, saveOne, deleteOne, smartSync, fetchAnnotations, uploadAttachment, deleteAttachment } from '../lib/background/api-sync.js';
import { formatExport } from '../lib/background/export.js';
import { migrateSyncFlags } from '../lib/background/utils.js';

function isRestrictedUrl(url) {
  if (!url) return true;
  return url.startsWith('chrome://') ||
    url.startsWith('chrome-extension://') ||
    url.startsWith('edge://') ||
    url.startsWith('about:') ||
    url.startsWith('view-source:');
}

async function injectContentScripts(tabId) {
  await chrome.scripting.executeScript({
    target: { tabId, allFrames: true },
    files: ['content-scripts/content.js'],
  });
  await chrome.scripting.executeScript({
    target: { tabId },
    files: ['content-scripts/bridge.js'],
    world: 'MAIN',
  });
}

async function seedBootIntent(tabId, intent, data) {
  await chrome.scripting.executeScript({
    target: { tabId },
    func: (i, d) => { window.__VIBE_BOOT_INTENT = i; window.__VIBE_BOOT_DATA = d; },
    args: [intent, data],
  });
}

class VibeAnnotationsBackground {
  constructor() {
    this._storageQueue = Promise.resolve();
    this.init();
  }

  _withStorageLock(fn) {
    this._storageQueue = this._storageQueue.then(fn, fn);
    return this._storageQueue;
  }

  init() {
    this.setupInstallListener();
    this.setupMessageListener();
    this.setupTabListener();
    this.setupStorageListener();
    this.restoreEnabledSites();
    migrateSyncFlags();
    this.startConnectionMonitoring();
  }

  // --- Lifecycle ---

  setupInstallListener() {
    chrome.runtime.onInstalled.addListener((details) => {
      if (details.reason === 'install') this.handleFirstInstall();
      else if (details.reason === 'update') this.handleUpdate(details.previousVersion);
    });
  }

  async handleFirstInstall() {
    try {
      await chrome.storage.local.set({
        annotations: [],
        settings: { version: '0.1.0', firstInstall: Date.now(), apiEnabled: false }
      });
    } catch (error) {
      console.error('Error setting up initial storage:', error);
    }
  }

  async handleUpdate(previousVersion) {
    try {
      const currentVersion = chrome.runtime.getManifest().version;
      await chrome.storage.local.set({
        updateInfo: {
          hasUpdate: true, previousVersion, currentVersion,
          timestamp: Date.now(),
          releaseUrl: `https://github.com/RaphaelRegnier/vibe-annotations/releases/tag/v${currentVersion}`
        }
      });
      chrome.action.setBadgeText({ text: 'NEW' });
      chrome.action.setBadgeBackgroundColor({ color: '#D03D68' });

      const result = await chrome.storage.local.get(['settings']);
      const settings = result.settings || {};
      settings.lastUpdate = Date.now();
      settings.previousVersion = previousVersion;
      await chrome.storage.local.set({ settings });
    } catch (error) {
      console.error('Error during update migration:', error);
    }
  }

  // --- Message routing ---

  setupMessageListener() {
    chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
      switch (request.action) {
        case 'getAnnotations':
          fetchAnnotations(request.url)
            .then(annotations => sendResponse({ success: true, annotations }))
            .catch(error => sendResponse({ success: false, error: error.message }));
          break;
        case 'saveAnnotation':
          this.saveAnnotation(request.annotation)
            .then(() => sendResponse({ success: true }))
            .catch(error => sendResponse({ success: false, error: error.message }));
          break;
        case 'deleteAnnotation':
          this.deleteAnnotation(request.id)
            .then(() => sendResponse({ success: true }))
            .catch(error => sendResponse({ success: false, error: error.message }));
          break;
        case 'deleteAnnotationsByUrl':
          this.deleteAnnotationsByUrl(request.url)
            .then(({ count }) => sendResponse({ success: true, count }))
            .catch(error => sendResponse({ success: false, error: error.message }));
          break;
        case 'updateAnnotation':
          this.updateAnnotation(request.id, request.updates)
            .then(() => sendResponse({ success: true }))
            .catch(error => sendResponse({ success: false, error: error.message }));
          break;
        case 'captureAnnotationScreenshot':
          this.captureAnnotationScreenshot(request.id, request.crop, sender)
            .then(() => sendResponse({ success: true }))
            .catch(error => sendResponse({ success: false, error: error.message }));
          break;
        case 'captureVisibleTab':
          chrome.tabs.captureVisibleTab(sender?.tab?.windowId, { format: 'png' })
            .then(dataUrl => sendResponse({ success: true, dataUrl }))
            .catch(error => sendResponse({ success: false, error: error.message }));
          break;
        case 'recordAttachment':
          this.recordAttachment(request.id, request.att)
            .then(() => sendResponse({ success: true }))
            .catch(error => sendResponse({ success: false, error: error.message }));
          break;
        case 'uploadUserImage':
          this.uploadUserImage(request.id, request.mime, request.dataUrl, request.kind)
            .then(attachment => sendResponse({ success: true, attachment }))
            .catch(error => sendResponse({ success: false, error: error.message }));
          break;
        case 'removeAttachment':
          this.removeAttachment(request.id, request.attId)
            .then(() => sendResponse({ success: true }))
            .catch(error => sendResponse({ success: false, error: error.message }));
          break;
        case 'requestScreenshotPermission':
          this.requestScreenshotPermission()
            .then(granted => sendResponse({ success: true, granted }))
            .catch(error => sendResponse({ success: false, error: error.message }));
          break;
        case 'exportAnnotations':
          formatExport(request.format)
            .then(data => sendResponse({ success: true, data }))
            .catch(error => sendResponse({ success: false, error: error.message }));
          break;
        case 'checkMCPStatus':
          checkConnection()
            .then(status => sendResponse({ success: true, status }))
            .catch(error => sendResponse({ success: false, error: error.message }));
          break;
        case 'enableSite':
          this.enableSite(request.originPattern, request.tabId)
            .then(() => sendResponse({ success: true }))
            .catch(error => sendResponse({ success: false, error: error.message }));
          break;
        case 'requestSitePermission':
          this.requestSitePermission(request, sender)
            .then(result => sendResponse({ success: true, ...result }))
            .catch(error => sendResponse({ success: false, error: error.message }));
          break;
        case 'openPopupWithFocus':
          sendResponse({ success: true });
          break;
        case 'importAnnotations':
          this.importAnnotations(request.annotations)
            .then(result => sendResponse({ success: true, ...result }))
            .catch(error => sendResponse({ success: false, error: error.message }));
          break;
        case 'forceMCPSync':
          this.forceAPISync()
            .then(result => sendResponse({ success: true, ...result }))
            .catch(error => sendResponse({ success: false, error: error.message }));
          break;
        default:
          sendResponse({ success: false, error: 'Unknown action' });
      }
      return true;
    });
  }

  // --- Tab & storage listeners ---

  setupTabListener() {
    chrome.tabs.onActivated.addListener(async (activeInfo) => {
      try {
        const tab = await chrome.tabs.get(activeInfo.tabId);
        if (await isSupportedUrl(tab.url)) await updateBadge(tab.id, tab.url);
        else await clearBadge(tab.id);
      } catch (error) {
        console.error('Error updating badge on tab activation:', error);
      }
    });

    chrome.tabs.onUpdated.addListener(async (tabId, changeInfo, tab) => {
      if (changeInfo.status === 'complete' && tab.url) {
        if (await isSupportedUrl(tab.url)) await updateBadge(tabId, tab.url);
        else await clearBadge(tabId);
      }
    });
  }

  setupStorageListener() {
    chrome.storage.onChanged.addListener(async (changes, namespace) => {
      if (namespace === 'local' && changes.annotations) {
        try {
          const tabs = await chrome.tabs.query({});
          for (const tab of tabs) {
            if (await isSupportedUrl(tab.url)) await updateBadge(tab.id, tab.url);
          }
        } catch (error) {
          console.error('Error updating badges after storage change:', error);
        }
      }
    });
  }

  // --- Storage CRUD ---

  async saveAnnotation(annotation) {
    return this._withStorageLock(async () => {
      try {
        const result = await chrome.storage.local.get(['annotations']);
        const annotations = result.annotations || [];
        const idx = annotations.findIndex(a => a.id === annotation.id);
        if (idx >= 0) annotations[idx] = annotation; else annotations.push(annotation);
        await chrome.storage.local.set({ annotations });

        saveOne(annotation).then(async () => {
          const fresh = await chrome.storage.local.get(['annotations']);
          const arr = fresh.annotations || [];
          const target = arr.find(a => a.id === annotation.id);
          if (target && !target._synced) {
            target._synced = true;
            await chrome.storage.local.set({ annotations: arr });
          }
        }).catch(() => {});
        updateBadgeForUrl(annotation.url).catch(() => {});
      } catch (error) {
        console.error('Error saving annotation:', error);
        throw error;
      }
    });
  }

  async deleteAnnotation(id) {
    return this._withStorageLock(async () => {
      try {
        const result = await chrome.storage.local.get(['annotations', 'deletedAnnotationIds']);
        const annotations = result.annotations || [];
        const target = annotations.find(a => a.id === id);

        // Protected delete: a variants annotation that has generated scaffolding is
        // NEVER hard-deleted from the client. Tombstoning it would make smartSync
        // fire a second server DELETE that hard-wipes it (once it's no longer
        // mid-cycle), destroying the agent's cleanup contract. Instead mark it
        // variants-discarded so it persists — surfaced to the agent for cleanup and
        // shown in "View all" as pending agent deletion — until the agent resolves it.
        if (target && target.mode === 'variants' && target.variantsPayload && target.status !== 'resolved') {
          if (target.status !== 'variants-discarded') {
            const updated = annotations.map(a => a.id === id
              ? { ...a, status: 'variants-discarded', updated_at: new Date().toISOString() }
              : a);
            await chrome.storage.local.set({ annotations: updated });
          }
          await updateBadgeForUrl(target.url);
          await updateAllBadges();
          return;
        }

        const deletedIds = result.deletedAnnotationIds || [];
        const filtered = annotations.filter(a => a.id !== id);
        if (!deletedIds.includes(id)) deletedIds.push(id);
        await chrome.storage.local.set({ annotations: filtered, deletedAnnotationIds: deletedIds });
        try { await deleteOne(id); } catch {}
        const deleted = annotations.find(a => a.id === id);
        if (deleted) await updateBadgeForUrl(deleted.url);
        await updateAllBadges();
      } catch (error) {
        console.error('Error deleting annotation:', error);
        throw error;
      }
    });
  }

  async deleteAnnotationsByUrl(url) {
    return this._withStorageLock(async () => {
      const result = await chrome.storage.local.get(['annotations', 'deletedAnnotationIds']);
      const all = result.annotations || [];
      const deletedIds = result.deletedAnnotationIds || [];
      const toDelete = all.filter(a => a.url === url);
      const remaining = all.filter(a => a.url !== url);
      for (const a of toDelete) { if (!deletedIds.includes(a.id)) deletedIds.push(a.id); }
      await chrome.storage.local.set({ annotations: remaining, deletedAnnotationIds: deletedIds });
      for (const a of toDelete) deleteOne(a.id).catch(() => {});
      await updateBadgeForUrl(url);
      await updateAllBadges();
      return { count: toDelete.length };
    });
  }

  async updateAnnotation(id, updates) {
    return this._withStorageLock(async () => {
      try {
        const result = await chrome.storage.local.get(['annotations']);
        const annotations = result.annotations || [];
        const idx = annotations.findIndex(a => a.id === id);
        if (idx === -1) throw new Error('Annotation not found');
        annotations[idx] = { ...annotations[idx], ...updates, updated_at: new Date().toISOString() };
        await chrome.storage.local.set({ annotations });
        updateBadgeForUrl(annotations[idx].url).catch(() => {});
      } catch (error) {
        console.error('Error updating annotation:', error);
        throw error;
      }
    });
  }

  // Capture a real, cropped screenshot of the just-annotated element in one shot.
  // The content script hides our overlay and sends a device-pixel crop rect; here
  // we grab the visible tab, crop with OffscreenCanvas (no base64 — captureVisibleTab's
  // data URL is blob-ified immediately), and upload the raw webp as the capture
  // attachment. Server-authoritative, then mirror into storage.
  async captureAnnotationScreenshot(id, crop, sender) {
    if (!crop || !(crop.sw > 0) || !(crop.sh > 0)) return;

    const dataUrl = await chrome.tabs.captureVisibleTab(sender?.tab?.windowId, { format: 'png' });
    const fullBlob = await (await fetch(dataUrl)).blob();
    const bitmap = await createImageBitmap(fullBlob, crop.sx, crop.sy, crop.sw, crop.sh);

    const canvas = new OffscreenCanvas(crop.sw, crop.sh);
    const ctx = canvas.getContext('2d');
    ctx.drawImage(bitmap, 0, 0);
    if (bitmap.close) bitmap.close();

    const webp = await canvas.convertToBlob({ type: 'image/webp', quality: 0.85 });
    const { attachment } = await uploadAttachment(id, webp, 'capture', 'image/webp');
    if (attachment) await this.recordAttachment(id, attachment);
  }

  // Mirror an attachment's metadata into chrome.storage so the extension UI can
  // render it without waiting for the next server pull. The file already lives on
  // the server; this only tracks { id, kind, mime }. Capture replaces any prior
  // capture (mirrors the server); user attachments append (dedup by id).
  async recordAttachment(id, att) {
    if (!att) return;
    return this._withStorageLock(async () => {
      const { annotations = [] } = await chrome.storage.local.get(['annotations']);
      const idx = annotations.findIndex(a => a.id === id);
      if (idx === -1) return;
      const cur = Array.isArray(annotations[idx].attachments) ? annotations[idx].attachments : [];
      const next = att.kind === 'capture'
        ? [att, ...cur.filter(a => a.kind !== 'capture')]
        : [...cur.filter(a => a.id !== att.id), att];
      annotations[idx] = { ...annotations[idx], attachments: next };
      await chrome.storage.local.set({ annotations });
    });
  }

  // Upload a user image whose bytes arrived as a data URL (non-local origins that
  // can't POST to localhost directly). Decode → upload → mirror into storage.
  async uploadUserImage(id, mime, dataUrl, kind = 'user') {
    const blob = await (await fetch(dataUrl)).blob();
    const { attachment } = await uploadAttachment(id, blob, kind, mime);
    if (attachment) await this.recordAttachment(id, attachment);
    return attachment;
  }

  // Request the broad host permission captureVisibleTab needs (screenshots). The
  // user gesture from the toggle click propagates through sendMessage → here.
  // Already-granted returns true without a prompt.
  async requestScreenshotPermission() {
    try {
      // Must be '<all_urls>' specifically — captureVisibleTab does not accept
      // '*://*/*'. Already-granted returns true without a prompt.
      return await chrome.permissions.request({ origins: ['<all_urls>'] });
    } catch (err) {
      console.error('Screenshot permission request failed:', err);
      return false;
    }
  }

  // Remove an attachment: unlink the file server-side, drop the metadata locally.
  async removeAttachment(id, attId) {
    try { await deleteAttachment(id, attId); } catch (error) { console.warn('Attachment delete failed on server:', error.message); }
    return this._withStorageLock(async () => {
      const { annotations = [] } = await chrome.storage.local.get(['annotations']);
      const idx = annotations.findIndex(a => a.id === id);
      if (idx === -1) return;
      const cur = Array.isArray(annotations[idx].attachments) ? annotations[idx].attachments : [];
      annotations[idx] = { ...annotations[idx], attachments: cur.filter(a => a.id !== attId) };
      await chrome.storage.local.set({ annotations });
    });
  }

  async importAnnotations(newAnnotations) {
    if (!Array.isArray(newAnnotations) || !newAnnotations.length) return { imported: 0 };
    return this._withStorageLock(async () => {
      const result = await chrome.storage.local.get(['annotations', 'deletedAnnotationIds']);
      const all = result.annotations || [];
      const deletedIds = result.deletedAnnotationIds || [];
      const existingIds = new Set(all.map(a => a.id));
      let imported = 0;
      const importedIds = [];
      for (const a of newAnnotations) {
        if (!existingIds.has(a.id)) { all.push(a); existingIds.add(a.id); importedIds.push(a.id); imported++; }
      }
      if (imported > 0) {
        const cleanedTombstones = deletedIds.filter(id => !importedIds.includes(id));
        await chrome.storage.local.set({ annotations: all, deletedAnnotationIds: cleanedTombstones });
        try {
          await syncAll(all);
          let flagsChanged = false;
          for (const a of all) { if (!a._synced) { a._synced = true; flagsChanged = true; } }
          if (flagsChanged) await chrome.storage.local.set({ annotations: all });
        } catch (e) { console.warn('Failed to sync imported annotations to server:', e.message); }
        await updateAllBadges();
      }
      return { imported, total: all.length };
    });
  }

  async forceAPISync() {
    try {
      const result = await chrome.storage.local.get(['annotations']);
      const annotations = result.annotations || [];
      await syncAll(annotations);
      return { count: annotations.length, message: `Synced ${annotations.length} annotations to API server` };
    } catch (error) {
      console.error('Error in forced API sync:', error);
      throw error;
    }
  }

  // --- Connection monitoring ---

  startConnectionMonitoring() {
    checkConnection().then(() => updateAllBadges());
    setInterval(async () => {
      const wasConnected = isConnected();
      await checkConnection();
      if (wasConnected !== isConnected()) await updateAllBadges();
      if (isConnected()) await smartSync(fn => this._withStorageLock(fn));
    }, 10000);
  }

  // --- Content script registration ---

  async restoreEnabledSites() {
    try {
      const result = await chrome.storage.local.get(['vibeEnabledSites']);
      const sites = result.vibeEnabledSites || [];
      for (const originPattern of sites) {
        const has = await chrome.permissions.contains({ origins: [originPattern] });
        if (has) await this.enableSite(originPattern, null);
      }
    } catch (err) {
      console.error('Error restoring enabled sites:', err);
    }
  }

  // Called from the permission modal in the content script. Must run while the user gesture
  // from the modal click is still valid for chrome.permissions.request (MV3 propagates the
  // gesture through sendMessage → onMessage).
  async requestSitePermission({ originPattern, allSites }, sender) {
    const target = allSites ? { origins: ['*://*/*'] } : { origins: [originPattern] };
    let granted = false;
    try {
      granted = await chrome.permissions.request(target);
    } catch (err) {
      console.error('Permission request failed:', err);
      return { granted: false, error: err.message };
    }
    if (!granted) return { granted: false };

    const { vibeEnabledSites = [] } = await chrome.storage.local.get(['vibeEnabledSites']);
    if (!vibeEnabledSites.includes(originPattern)) {
      vibeEnabledSites.push(originPattern);
      await chrome.storage.local.set({ vibeEnabledSites });
    }
    // tabId=null so enableSite skips chrome.tabs.reload — the already-injected content
    // script boots in place via bootNormal() once it sees our grant response.
    await this.enableSite(originPattern, null);
    return { granted: true };
  }

  async enableSite(originPattern, tabId) {
    // WXT bundles each entrypoint into a single file under content-scripts/.
    // Entrypoint `content/index.js` → `content-scripts/content.js`.
    // Entrypoint `bridge.content.js` → `content-scripts/bridge.js`.
    const scriptId = 'vibe-' + originPattern.replace(/[^a-zA-Z0-9]/g, '_');
    try {
      await chrome.scripting.unregisterContentScripts({ ids: [scriptId] }).catch(() => {});
      await chrome.scripting.registerContentScripts([{
        id: scriptId, matches: [originPattern],
        js: ['content-scripts/content.js'],
        runAt: 'document_idle', persistAcrossSessions: true
      }]);
      const bridgeScriptId = scriptId + '_bridge';
      await chrome.scripting.unregisterContentScripts({ ids: [bridgeScriptId] }).catch(() => {});
      await chrome.scripting.registerContentScripts([{
        id: bridgeScriptId, matches: [originPattern],
        js: ['content-scripts/bridge.js'], world: 'MAIN', runAt: 'document_start', persistAcrossSessions: true
      }]);
    } catch (err) {
      console.error('Failed to register content scripts:', err);
    }
    if (tabId) await chrome.tabs.reload(tabId);
  }
}

export default defineBackground(() => {
  // Instantiate the existing class — no behavior change, just wrapped for WXT.
  const bg = new VibeAnnotationsBackground();

  // Keyboard shortcut commands.
  chrome.commands.onCommand.addListener(async (command, tab) => {
    if (command === 'toggle-annotate' && tab?.id && (await isSupportedUrl(tab.url))) {
      try {
        await chrome.tabs.sendMessage(tab.id, { action: 'toggleAnnotate' });
      } catch {
        /* Content script not loaded */
      }
    }
  });

  // Icon click — no popup.html anymore. The whole flow lives in the content-script overlay:
  // localhost/granted pages toggle the existing toolbar; unsupported pages get a permission
  // modal inside the shadow host.
  chrome.action.onClicked.addListener(async (tab) => {
    if (!tab?.id || !tab?.url || isRestrictedUrl(tab.url)) return;

    let originPattern, hostname;
    try {
      const u = new URL(tab.url);
      originPattern = `${u.protocol}//${u.host}/*`;
      hostname = u.hostname;
    } catch {
      return;
    }

    const localhost = isLocalhostUrl(tab.url);
    const hasSpecific = await chrome.permissions.contains({ origins: [originPattern] });
    const hasAll = !localhost && !hasSpecific && await chrome.permissions.contains({ origins: ['*://*/*'] });
    const granted = localhost || hasSpecific || hasAll;

    if (granted) {
      // Supported — toggle the overlay. If content scripts haven't loaded (SW restart,
      // freshly-granted non-localhost), inject them now and retry.
      try {
        await chrome.tabs.sendMessage(tab.id, { action: 'toggleOverlay' });
      } catch {
        try {
          await injectContentScripts(tab.id);
          await chrome.tabs.sendMessage(tab.id, { action: 'toggleOverlay' }).catch(() => {});
        } catch (err) {
          console.error('Failed to inject content scripts:', err);
        }
      }
      // Persist registration for non-localhost so future loads auto-inject.
      if (!localhost) bg.enableSite(originPattern, null).catch(() => {});
    } else {
      // Unsupported — seed a boot intent then inject. content/index.js reads the intent and
      // shows the permission modal instead of booting the toolbar.
      try {
        await seedBootIntent(tab.id, 'show-permission-prompt', { originPattern, hostname });
        await injectContentScripts(tab.id);
      } catch (err) {
        console.error('Failed to open permission prompt:', err);
      }
    }
  });
});
