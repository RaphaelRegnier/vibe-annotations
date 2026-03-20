// Vibe Annotations Background Service Worker

class VibeAnnotationsBackground {
  constructor() {
    this.apiServerUrl = 'http://127.0.0.1:3846'; // Updated to match external server
    this.apiConnected = false;
    this._storageQueue = Promise.resolve(); // Serializes chrome.storage read-modify-write ops
    this.init();
  }

  // Serialize all storage mutations to prevent concurrent read-modify-write races
  _withStorageLock(fn) {
    this._storageQueue = this._storageQueue.then(fn, fn);
    return this._storageQueue;
  }

  init() {

    // Set up event listeners
    this.setupInstallListener();
    this.setupMessageListener();
    this.setupTabListener();
    this.setupStorageListener();

    // Re-register content scripts for user-enabled sites
    this.restoreEnabledSites();

    // Start API server connection monitoring
    this.startAPIConnectionMonitoring();
  }

  setupInstallListener() {
    chrome.runtime.onInstalled.addListener((details) => {
        
      if (details.reason === 'install') {
        this.handleFirstInstall();
      } else if (details.reason === 'update') {
        this.handleUpdate(details.previousVersion);
      }
    });
  }

  async handleFirstInstall() {
    
    // Initialize storage with empty annotations array
    try {
      await chrome.storage.local.set({
        annotations: [],
        settings: {
          version: '0.1.0',
          firstInstall: Date.now(),
          apiEnabled: false
        }
      });
      
    } catch (error) {
      console.error('Error setting up initial storage:', error);
    }
  }

  async handleUpdate(previousVersion) {
    
    // Handle any migration logic here
    try {
      const currentVersion = chrome.runtime.getManifest().version;
      
      // Store update info for popup to display
      await chrome.storage.local.set({
        updateInfo: {
          hasUpdate: true,
          previousVersion,
          currentVersion,
          timestamp: Date.now(),
          changelog: this.getChangelogForVersion(currentVersion),
          releaseUrl: `https://github.com/RaphaelRegnier/vibe-annotations/releases/tag/v${currentVersion}`
        }
      });
      
      // Set badge to notify user
      chrome.action.setBadgeText({ text: 'NEW' });
      chrome.action.setBadgeBackgroundColor({ color: '#d97757' }); // Vibe orange
      
      // Also update settings
      const result = await chrome.storage.local.get(['settings']);
      const settings = result.settings || {};
      
      settings.lastUpdate = Date.now();
      settings.previousVersion = previousVersion;
      
      await chrome.storage.local.set({ settings });
      
    } catch (error) {
      console.error('Error during update migration:', error);
    }
  }

  setupMessageListener() {
    chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
      
      switch (request.action) {
        case 'getAnnotations':
          this.getAnnotations(request.url)
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
          
        case 'updateAnnotation':
          this.updateAnnotation(request.id, request.updates)
            .then(() => sendResponse({ success: true }))
            .catch(error => sendResponse({ success: false, error: error.message }));
          break;
          
        case 'exportAnnotations':
          this.exportAnnotations(request.format)
            .then(data => sendResponse({ success: true, data }))
            .catch(error => sendResponse({ success: false, error: error.message }));
          break;
          
        case 'checkMCPStatus':
          this.checkAPIConnectionStatus()
            .then(status => sendResponse({ success: true, status }))
            .catch(error => sendResponse({ success: false, error: error.message }));
          break;
          
        case 'enableSite':
          this.enableSite(request.originPattern, request.tabId)
            .then(() => sendResponse({ success: true }))
            .catch(error => sendResponse({ success: false, error: error.message }));
          break;

        case 'openPopupWithFocus':
          this.openPopupWithFocus(request.annotationId)
            .then(() => sendResponse({ success: true }))
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
      
      return true; // Keep the message channel open for async response
    });
  }

  setupTabListener() {
    // Update badge when switching tabs
    chrome.tabs.onActivated.addListener(async (activeInfo) => {
      try {
        const tab = await chrome.tabs.get(activeInfo.tabId);
        if (await this.isSupportedUrl(tab.url)) {
          await this.updateBadge(tab.id, tab.url);
        } else {
          await this.clearBadge(tab.id);
        }
      } catch (error) {
        console.error('Error updating badge on tab activation:', error);
      }
    });

    // Update badge when URL changes
    chrome.tabs.onUpdated.addListener(async (tabId, changeInfo, tab) => {
      if (changeInfo.status === 'complete' && tab.url) {
        if (await this.isSupportedUrl(tab.url)) {
          await this.updateBadge(tabId, tab.url);
        } else {
          await this.clearBadge(tabId);
        }
      }
    });
  }

  setupStorageListener() {
    // Listen for storage changes to sync data
    chrome.storage.onChanged.addListener((changes, namespace) => {
      if (namespace === 'local' && changes.annotations) {
        this.onAnnotationsChanged(changes.annotations.newValue || []);
      }
    });
  }

  async onAnnotationsChanged(annotations) {
    // Update badges for all localhost tabs
    try {
      
      const tabs = await chrome.tabs.query({});
      const supportedTabs = [];
      for (const tab of tabs) {
        if (await this.isSupportedUrl(tab.url)) supportedTabs.push(tab);
      }

      for (const tab of supportedTabs) {
        // Use direct local storage update for immediate response
        await this.updateBadgeFromLocalStorage(tab.id, tab.url);
      }

      // Sync annotations to API server (in background)
      this.syncAnnotationsToAPI(annotations).catch(error => {
        console.error('Background sync failed:', error);
      });
      
      
    } catch (error) {
      console.error('Error updating badges after storage change:', error);
    }
  }

  async syncAnnotationsToAPI(annotations) {
    try {
      
      // Use the new sync endpoint to replace all annotations
      const response = await fetch(`${this.apiServerUrl}/api/annotations/sync`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({ annotations })
      });
      
      if (!response.ok) {
        throw new Error(`API sync error: ${response.status}`);
      }
      
      const result = await response.json();
      
      if (!result.success) {
        throw new Error(result.error || 'Failed to sync annotations');
      }
      
      await chrome.storage.local.set({
        apiSyncPending: false,
        apiLastSync: Date.now(),
        apiSyncCount: annotations.length
      });
      
      
    } catch (error) {
      console.error('Error syncing annotations to API:', error);
      
      await chrome.storage.local.set({
        apiSyncPending: true,
        apiSyncError: error.message,
        apiLastSync: Date.now()
      });
      
      throw error;
    }
  }

  async getAnnotations(url = null) {
    try {
      // Get annotations from API server
      let apiUrl = `${this.apiServerUrl}/api/annotations`;
      if (url) {
        apiUrl += `?url=${encodeURIComponent(url)}`;
      }
      
      
      const response = await fetch(apiUrl);
      
      if (!response.ok) {
        throw new Error(`API server error: ${response.status}`);
      }
      
      const result = await response.json();
      const annotations = result.annotations || [];
      
      
      return annotations;
    } catch (error) {
      console.error('[Background] Error getting annotations from API:', error);
      // Fallback to local storage if API fails
      const result = await chrome.storage.local.get(['annotations']);
      const annotations = result.annotations || [];
      
      
      if (url) {
        const filtered = annotations.filter(annotation => {
          const match = annotation.url === url;
          return match;
        });
        return filtered;
      }
      
      return annotations;
    }
  }

  async saveAnnotation(annotation) {
    return this._withStorageLock(async () => {
      try {
        const result = await chrome.storage.local.get(['annotations']);
        const annotations = result.annotations || [];

        const existingIndex = annotations.findIndex(a => a.id === annotation.id);
        if (existingIndex >= 0) {
          annotations[existingIndex] = annotation;
        } else {
          annotations.push(annotation);
        }

        await chrome.storage.local.set({ annotations });

        // Also save to API server
        await this.saveAnnotationToAPI(annotation);

        // Force badge update for all tabs with this URL
        await this.updateBadgeForUrl(annotation.url);

      } catch (error) {
        console.error('Error saving annotation:', error);
        throw error;
      }
    });
  }

  async saveAnnotationToAPI(annotation) {
    try {
      const response = await fetch(`${this.apiServerUrl}/api/annotations`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify(annotation)
      });
      
      if (!response.ok) {
        throw new Error(`API server error: ${response.status}`);
      }
      
      const result = await response.json();
      
      if (!result.success) {
        throw new Error(result.error || 'Failed to save annotation to API');
      }
      
      
    } catch (error) {
      console.warn('Failed to save to API server, annotation saved locally:', error.message);
      // Don't throw - local storage save succeeded
    }
  }

  async deleteAnnotation(id) {
    return this._withStorageLock(async () => {
      try {
        const result = await chrome.storage.local.get(['annotations', 'deletedAnnotationIds']);
        const annotations = result.annotations || [];
        const deletedIds = result.deletedAnnotationIds || [];

        const filteredAnnotations = annotations.filter(annotation => annotation.id !== id);

        // Track deletion so sync doesn't resurrect it from server
        if (!deletedIds.includes(id)) deletedIds.push(id);

        await chrome.storage.local.set({
          annotations: filteredAnnotations,
          deletedAnnotationIds: deletedIds
        });

        // Also delete from API server
        try {
          await this.deleteAnnotationFromAPI(id);
        } catch (apiError) {
          console.warn('Failed to delete from API server:', apiError.message);
        }

        // Find the deleted annotation's URL to update badge
        const deletedAnnotation = annotations.find(a => a.id === id);
        if (deletedAnnotation) {
          await this.updateBadgeForUrl(deletedAnnotation.url);
        }

        await this.updateAllBadges();

      } catch (error) {
        console.error('Error deleting annotation:', error);
        throw error;
      }
    });
  }

  async deleteAnnotationFromAPI(id) {
    try {
      const response = await fetch(`${this.apiServerUrl}/api/annotations/${id}`, {
        method: 'DELETE',
        headers: {
          'Content-Type': 'application/json',
        }
      });
      
      if (!response.ok) {
        throw new Error(`API delete error: ${response.status}`);
      }
      
      const result = await response.json();
      
      if (!result.success) {
        throw new Error(result.error || 'Failed to delete annotation from API');
      }
      
      console.log('[Background] Annotation deleted from API:', id);
    } catch (error) {
      console.error('[Background] Error deleting annotation from API:', error);
      throw error;
    }
  }

  async updateAnnotation(id, updates) {
    return this._withStorageLock(async () => {
      try {
        const result = await chrome.storage.local.get(['annotations']);
        const annotations = result.annotations || [];

        const annotationIndex = annotations.findIndex(annotation => annotation.id === id);
        if (annotationIndex === -1) {
          throw new Error('Annotation not found');
        }

        annotations[annotationIndex] = {
          ...annotations[annotationIndex],
          ...updates,
          updated_at: new Date().toISOString()
        };

        await chrome.storage.local.set({ annotations });

        await this.updateBadgeForUrl(annotations[annotationIndex].url);

      } catch (error) {
        console.error('Error updating annotation:', error);
        throw error;
      }
    });
  }

  async exportAnnotations(format = 'json') {
    try {
      const annotations = await this.getAnnotations();
      
      switch (format) {
        case 'json':
          return JSON.stringify(annotations, null, 2);
          
        case 'csv':
          return this.annotationsToCSV(annotations);
          
        case 'mcp':
          return this.annotationsToMCP(annotations);
          
        default:
          throw new Error('Unsupported export format');
      }
    } catch (error) {
      console.error('Error exporting annotations:', error);
      throw error;
    }
  }

  annotationsToCSV(annotations) {
    const headers = ['ID', 'URL', 'Comment', 'Status', 'Element', 'Created', 'Updated'];
    const rows = annotations.map(annotation => [
      annotation.id,
      annotation.url,
      `"${annotation.comment.replace(/"/g, '""')}"`,
      annotation.status,
      annotation.selector,
      annotation.created_at,
      annotation.updated_at
    ]);
    
    return [headers, ...rows].map(row => row.join(',')).join('\n');
  }

  annotationsToMCP(annotations) {
    // Format for MCP server consumption
    return {
      version: '1.0',
      exported_at: new Date().toISOString(),
      total_annotations: annotations.length,
      annotations: annotations.map(annotation => ({
        ...annotation,
        // Add any MCP-specific formatting here
        mcp_ready: true
      }))
    };
  }

  async updateBadge(tabId, url) {
    try {
      const annotations = await this.getAnnotations(url);
      const pendingCount = annotations.filter(a => a.status === 'pending').length;
      
      
      if (pendingCount > 0) {
        await chrome.action.setBadgeText({
          tabId: tabId,
          text: pendingCount.toString()
        });
        
        // Set badge color based on server status
        const badgeColor = this.apiConnected ? '#10b981' : '#FF7A00'; // Green if online, orange if offline
        await chrome.action.setBadgeBackgroundColor({
          tabId: tabId,
          color: badgeColor
        });
        
        await chrome.action.setTitle({
          tabId: tabId,
          title: `Vibe Annotations - ${pendingCount} pending annotation${pendingCount === 1 ? '' : 's'}`
        });
      } else {
        await this.clearBadge(tabId);
      }
    } catch (error) {
      console.error('Error updating badge:', error);
    }
  }

  // Direct badge update from local storage (bypasses API)
  async updateBadgeFromLocalStorage(tabId, url) {
    try {
      const result = await chrome.storage.local.get(['annotations']);
      const annotations = result.annotations || [];
      const urlAnnotations = annotations.filter(a => a.url === url);
      const pendingCount = urlAnnotations.filter(a => a.status === 'pending').length;
      
      
      if (pendingCount > 0) {
        await chrome.action.setBadgeText({
          tabId: tabId,
          text: pendingCount.toString()
        });
        
        // Set badge color based on server status
        const badgeColor = this.apiConnected ? '#10b981' : '#FF7A00'; // Green if online, orange if offline
        await chrome.action.setBadgeBackgroundColor({
          tabId: tabId,
          color: badgeColor
        });
        
        await chrome.action.setTitle({
          tabId: tabId,
          title: `Vibe Annotations - ${pendingCount} pending annotation${pendingCount === 1 ? '' : 's'}`
        });
      } else {
        await this.clearBadge(tabId);
      }
    } catch (error) {
      console.error('Error updating badge from local storage:', error);
    }
  }

  async clearBadge(tabId) {
    try {
      await chrome.action.setBadgeText({ tabId: tabId, text: '' });
      await chrome.action.setTitle({ 
        tabId: tabId, 
        title: 'Vibe Annotations' 
      });
    } catch (error) {
      console.error('Error clearing badge:', error);
    }
  }

  async updateBadgeForUrl(url) {
    try {
      const tabs = await chrome.tabs.query({ url: url });
      for (const tab of tabs) {
        // Use direct local storage update for immediate response
        await this.updateBadgeFromLocalStorage(tab.id, url);
      }
    } catch (error) {
      console.error('Error updating badge for URL:', url, error);
    }
  }

  async updateAllBadges() {
    try {
      const tabs = await chrome.tabs.query({});
      for (const tab of tabs) {
        if (await this.isSupportedUrl(tab.url)) {
          await this.updateBadge(tab.id, tab.url);
        }
      }
    } catch (error) {
      console.error('Error updating all badges:', error);
    }
  }

  async checkAPIConnectionStatus() {
    try {
      const response = await fetch(`${this.apiServerUrl}/health`, {
        method: 'GET',
        signal: AbortSignal.timeout(5000) // 5 second timeout
      });
      
      if (response.ok) {
        const data = await response.json();
        this.apiConnected = true;
        
        // Check version compatibility
        const extensionVersion = chrome.runtime.getManifest().version;
        let versionCompatible = true;
        let compatibilityMessage = null;
        
        if (data.minExtensionVersion) {
          const extensionParts = extensionVersion.split('.').map(Number);
          const minParts = data.minExtensionVersion.split('.').map(Number);
          
          for (let i = 0; i < 3; i++) {
            if ((extensionParts[i] || 0) < (minParts[i] || 0)) {
              versionCompatible = false;
              compatibilityMessage = `Extension update required. Minimum version: ${data.minExtensionVersion}`;
              break;
            }
            if ((extensionParts[i] || 0) > (minParts[i] || 0)) {
              break;
            }
          }
        }
        
        return {
          connected: true,
          server_url: this.apiServerUrl,
          server_version: data.version,
          server_status: data.status,
          version_compatible: versionCompatible,
          compatibility_message: compatibilityMessage,
          last_check: new Date().toISOString()
        };
      } else {
        this.apiConnected = false;
        return {
          connected: false,
          server_url: this.apiServerUrl,
          error: `Server returned ${response.status}`,
          last_check: new Date().toISOString()
        };
      }
    } catch (error) {
      this.apiConnected = false;
      return {
        connected: false,
        server_url: this.apiServerUrl,
        error: error.message,
        last_check: new Date().toISOString()
      };
    }
  }

  startAPIConnectionMonitoring() {
    // Check connection immediately
    this.checkAPIConnectionStatus().then(() => {
      // Update all badges after initial check
      this.updateAllBadges();
    });
    
    // Check connection every 10 seconds and update badges
    setInterval(async () => {
      const wasConnected = this.apiConnected;
      await this.checkAPIConnectionStatus();
      
      // Update badges when connection status changes
      if (wasConnected !== this.apiConnected) {
        await this.updateAllBadges();
      }
      
      // If server is online, smart sync annotations (bidirectional with conflict resolution)
      if (this.apiConnected) {
        await this.smartSyncAnnotations();
      }
    }, 10000);
  }

  async smartSyncAnnotations() {
    try {
      // Get local state
      const localResult = await chrome.storage.local.get(['annotations', 'deletedAnnotationIds']);
      const localAnnotations = localResult.annotations || [];
      const deletedIds = new Set(localResult.deletedAnnotationIds || []);

      // Get server annotations
      const response = await fetch(`${this.apiServerUrl}/api/annotations`);
      if (!response.ok) return; // Skip sync on server error

      const serverResult = await response.json();
      const serverAnnotations = serverResult.annotations || [];

      // Build lookup maps
      const localMap = new Map(localAnnotations.map(a => [a.id, a]));
      const serverMap = new Map(serverAnnotations.map(a => [a.id, a]));
      const allIds = new Set([...localMap.keys(), ...serverMap.keys()]);

      const merged = [];
      let changed = false;

      for (const id of allIds) {
        // Skip anything the user explicitly deleted locally
        if (deletedIds.has(id)) {
          // If server still has it, we'll push the deletion below
          if (serverMap.has(id)) changed = true;
          continue;
        }

        const local = localMap.get(id);
        const server = serverMap.get(id);

        if (local && server) {
          // Both have it — most recent updated_at wins
          const lt = new Date(local.updated_at || local.created_at || 0).getTime();
          const st = new Date(server.updated_at || server.created_at || 0).getTime();
          if (st > lt) {
            merged.push(server);
            changed = true;
          } else {
            merged.push(local);
            if (lt > st) changed = true; // local is newer, need to push
          }
        } else if (local && !server) {
          // Local-only: new annotation created offline, push to server
          merged.push(local);
          changed = true;
        } else if (!local && server) {
          // Server-only: new annotation from MCP/Claude, pull to local
          merged.push(server);
          changed = true;
        }
      }

      if (!changed) return;

      // Persist merged result locally
      await chrome.storage.local.set({
        annotations: merged,
        lastServerSync: Date.now()
      });

      // Push merged result to server (full sync replace)
      try {
        await fetch(`${this.apiServerUrl}/api/annotations/sync`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ annotations: merged })
        });
      } catch (e) {
        console.warn('Failed to push merged annotations to server:', e.message);
      }

      // Delete server-side tombstoned annotations
      for (const id of deletedIds) {
        if (serverMap.has(id)) {
          this.deleteAnnotationFromAPI(id).catch(() => {});
        }
      }

      // Prune tombstones: only keep IDs that the server still had
      // (others are already gone from both sides)
      const activeTombstones = [...deletedIds].filter(id => serverMap.has(id));
      await chrome.storage.local.set({ deletedAnnotationIds: activeTombstones });

      console.log(`[Vibe] Sync complete — merged: ${merged.length} annotations`);

      // Update badges
      await this.updateAllBadges();

      // Notify content scripts to refresh
      try {
        const tabs = await chrome.tabs.query({});
        for (const tab of tabs) {
          if (await this.isSupportedUrl(tab.url)) {
            chrome.tabs.sendMessage(tab.id, { action: 'annotationsUpdated' }).catch(() => {});
          }
        }
      } catch { /* ignore */ }

    } catch (error) {
      console.error('Error during smart sync:', error);
    }
  }


  isLocalhostUrl(url) {
    if (!url) return false;

    try {
      const urlObj = new URL(url);

      // Check localhost URLs
      if (urlObj.hostname === 'localhost' ||
          urlObj.hostname === '127.0.0.1' ||
          urlObj.hostname === '0.0.0.0') {
        return true;
      }

      // Check .local, .test, .localhost development domains
      if (urlObj.hostname.endsWith('.local') ||
          urlObj.hostname.endsWith('.test') ||
          urlObj.hostname.endsWith('.localhost')) {
        return true;
      }

      // Check file URLs - only allow HTML files
      if (urlObj.protocol === 'file:') {
        const path = urlObj.pathname.toLowerCase();
        const htmlExtensions = ['.html', '.htm'];

        // Allow .html/.htm files or files with no extension
        return htmlExtensions.some(ext => path.endsWith(ext)) ||
               (!path.includes('.') || path.endsWith('/'));
      }

      return false;
    } catch {
      return false;
    }
  }

  async isEnabledSite(url) {
    if (!url) return false;
    try {
      const origin = new URL(url).origin + '/*';
      const result = await chrome.storage.local.get(['vibeEnabledSites']);
      const sites = result.vibeEnabledSites || [];
      return sites.includes(origin);
    } catch {
      return false;
    }
  }

  async isSupportedUrl(url) {
    return this.isLocalhostUrl(url) || await this.isEnabledSite(url);
  }

  async restoreEnabledSites() {
    try {
      const result = await chrome.storage.local.get(['vibeEnabledSites']);
      const sites = result.vibeEnabledSites || [];
      for (const originPattern of sites) {
        // Only register if permission is still granted
        const has = await chrome.permissions.contains({ origins: [originPattern] });
        if (has) {
          await this.enableSite(originPattern, null);
        }
      }
    } catch (err) {
      console.error('Error restoring enabled sites:', err);
    }
  }

  async enableSite(originPattern, tabId) {
    // Register dynamic content scripts for this origin
    const scriptId = 'vibe-' + originPattern.replace(/[^a-zA-Z0-9]/g, '_');

    try {
      // Unregister first in case it already exists
      await chrome.scripting.unregisterContentScripts({ ids: [scriptId] }).catch(() => {});

      await chrome.scripting.registerContentScripts([{
        id: scriptId,
        matches: [originPattern],
        js: [
          'content/modules/event-bus.js',
          'content/modules/styles.js',
          'content/modules/shadow-host.js',
          'content/modules/theme-manager.js',
          'content/modules/api-bridge.js',
          'content/modules/shadow-dom-utils.js',
          'content/modules/element-context.js',
          'content/modules/badge-manager.js',
          'content/modules/inspection-mode.js',
          'content/modules/annotation-popover.js',
          'content/modules/floating-toolbar.js',
          'content/content.js'
        ],
        runAt: 'document_idle',
        persistAcrossSessions: true
      }]);
    } catch (err) {
      console.error('Failed to register content scripts:', err);
    }

    // Reload the tab so scripts inject cleanly
    if (tabId) {
      await chrome.tabs.reload(tabId);
    }
  }

  async openPopupWithFocus(annotationId) {
    try {
      // Since we can't programmatically open the popup in MV3,
      // we'll just store the focused annotation ID for when the popup is opened
      
      // The focusedAnnotationId is already stored by the content script
      // This method exists mainly for completeness and potential future use
      return true;
    } catch (error) {
      console.error('Error handling popup focus request:', error);
      throw error;
    }
  }

  async forceAPISync() {
    try {
      // Get all annotations from storage
      const result = await chrome.storage.local.get(['annotations']);
      const annotations = result.annotations || [];
      
      // Force sync to API
      await this.syncAnnotationsToAPI(annotations);
      
      
      return {
        count: annotations.length,
        message: `Synced ${annotations.length} annotations to API server`
      };
      
    } catch (error) {
      console.error('Error in forced API sync:', error);
      throw error;
    }
  }

  // Utility function for generating IDs
  generateId() {
    return 'vibe_' + Date.now() + '_' + Math.random().toString(36).substr(2, 9);
  }

  getChangelogForVersion(version) {
    // Real changelog mapping for actual versions
    const changelogs = {
      '1.0.0': [
        'Initial release of Vibe Annotations',
        'Visual annotation system for localhost development',
        'MCP integration for AI coding agents',
        'Light/dark theme support with system preference detection'
      ],
      '1.0.1': [
        'Added Chrome Web Store download link',
        'Enhanced documentation for local file support (file:// URLs)',
        'Added step-by-step instructions for enabling local file access',
        'Improved error messages for file access permissions',
        'Backwards compatible with current server version'
      ],
      '1.0.2': [
        'Added support for .local, .test, and .localhost development domains',
        'WordPress development compatibility (*.local domains)',
        'Laravel Valet compatibility (*.test domains)',
        'Custom localhost setups (*.localhost domains)',
        'Expanded local development environment support'
      ],
      '1.0.3': [
        'Added HTTPS support for localhost development servers',
        'Support for https://localhost (Vite, Next.js, CRA with SSL)',
        'Support for https://127.0.0.1 and https://0.0.0.0',
        'HTTP transport now recommended over SSE for better stability',
        'Updated all setup instructions to promote HTTP transport first',
        'Compatible with mkcert and other local SSL setups'
      ],
      '1.1.0': [
        'Rich clipboard copy format with full element context for AI agents',
        'Floating toolbar with enhanced settings and improved UX'
      ],
      '1.2.0': [
        'Keyboard shortcut (Cmd+Shift+V / Ctrl+Shift+V) to toggle annotation mode',
        'Release notes opened automatically on extension update',
        'Clipboard copy now nudges AI agents with actionable instruction',
        'Badge color picker with 5 colors in toolbar settings',
        'Provisional pin shown immediately on element click',
        'Badges positioned at click point relative to element',
        'Popover anchored to cursor position for accurate placement',
        'Shadow DOM event containment prevents framework interference'
      ]
    };
    
    return changelogs[version] || ['Various improvements and bug fixes'];
  }
}

// Initialize the background service worker
const bg = new VibeAnnotationsBackground();

// Keyboard shortcut commands (chrome.commands)
chrome.commands.onCommand.addListener(async (command, tab) => {
  if (command === 'toggle-annotate' && tab?.id && await bg.isSupportedUrl(tab.url)) {
    try {
      await chrome.tabs.sendMessage(tab.id, { action: 'toggleAnnotate' });
    } catch { /* Content script not loaded */ }
  }
});

// No onClicked handler — popup.html handles all interaction