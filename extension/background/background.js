// Claude Annotations Background Service Worker

class ClaudeAnnotationsBackground {
  constructor() {
    this.apiServerUrl = 'http://localhost:3846';
    this.apiConnected = false;
    this.init();
  }

  init() {
    console.log('Claude Annotations background service worker initialized');
    
    // Set up event listeners
    this.setupInstallListener();
    this.setupMessageListener();
    this.setupTabListener();
    this.setupStorageListener();
    
    // Start API server connection monitoring
    this.startAPIConnectionMonitoring();
  }

  setupInstallListener() {
    chrome.runtime.onInstalled.addListener((details) => {
      console.log('Claude Annotations installed:', details.reason);
      
      if (details.reason === 'install') {
        this.handleFirstInstall();
      } else if (details.reason === 'update') {
        this.handleUpdate(details.previousVersion);
      }
    });
  }

  async handleFirstInstall() {
    console.log('First time installation');
    
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
      
      console.log('Initial storage set up successfully');
    } catch (error) {
      console.error('Error setting up initial storage:', error);
    }
  }

  async handleUpdate(previousVersion) {
    console.log(`Updated from version ${previousVersion} to current version`);
    
    // Handle any migration logic here
    try {
      const result = await chrome.storage.local.get(['settings']);
      const settings = result.settings || {};
      
      settings.lastUpdate = Date.now();
      settings.previousVersion = previousVersion;
      
      await chrome.storage.local.set({ settings });
      
      console.log('Update migration completed');
    } catch (error) {
      console.error('Error during update migration:', error);
    }
  }

  setupMessageListener() {
    chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
      console.log('Background received message:', request);
      
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
        if (this.isLocalhostUrl(tab.url)) {
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
        if (this.isLocalhostUrl(tab.url)) {
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
        console.log('Annotations storage changed');
        this.onAnnotationsChanged(changes.annotations.newValue || []);
      }
    });
  }

  async onAnnotationsChanged(annotations) {
    // Update badges for all localhost tabs
    try {
      console.log('[Background] Annotations changed, updating badges...');
      
      const tabs = await chrome.tabs.query({});
      const localhostTabs = tabs.filter(tab => this.isLocalhostUrl(tab.url));
      
      for (const tab of localhostTabs) {
        // Use direct local storage update for immediate response
        await this.updateBadgeFromLocalStorage(tab.id, tab.url);
      }
      
      // Sync annotations to API server (in background)
      this.syncAnnotationsToAPI(annotations).catch(error => {
        console.error('Background sync failed:', error);
      });
      
      console.log('[Background] Badge updates completed');
      
    } catch (error) {
      console.error('Error updating badges after storage change:', error);
    }
  }

  async syncAnnotationsToAPI(annotations) {
    try {
      console.log('Syncing annotations to API server:', annotations.length);
      
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
      
      console.log('Annotations synced to API server (full replacement):', annotations.length);
      
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
      
      console.log(`[Background] Fetching annotations from API: ${apiUrl}`);
      
      const response = await fetch(apiUrl);
      
      if (!response.ok) {
        throw new Error(`API server error: ${response.status}`);
      }
      
      const result = await response.json();
      const annotations = result.annotations || [];
      
      console.log(`[Background] API returned ${annotations.length} annotations for ${url || 'all URLs'}`);
      
      return annotations;
    } catch (error) {
      console.error('[Background] Error getting annotations from API:', error);
      // Fallback to local storage if API fails
      const result = await chrome.storage.local.get(['annotations']);
      const annotations = result.annotations || [];
      
      console.log(`[Background] Using local storage fallback: ${annotations.length} total annotations`);
      
      if (url) {
        const filtered = annotations.filter(annotation => {
          const match = annotation.url === url;
          console.log(`[Background] Annotation ${annotation.id}: ${annotation.url} ${match ? 'MATCHES' : 'does not match'} ${url}`);
          return match;
        });
        console.log(`[Background] Local storage filtered to ${filtered.length} for ${url}`);
        return filtered;
      }
      
      return annotations;
    }
  }

  async saveAnnotation(annotation) {
    try {
      // Save to local storage first
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
      
      console.log('Annotation saved:', annotation.id);
      
      // Force badge update for all tabs with this URL
      await this.updateBadgeForUrl(annotation.url);
      
    } catch (error) {
      console.error('Error saving annotation:', error);
      throw error;
    }
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
      
      console.log('Annotation saved to API server:', annotation.id);
      
    } catch (error) {
      console.warn('Failed to save to API server, annotation saved locally:', error.message);
      // Don't throw - local storage save succeeded
    }
  }

  async deleteAnnotation(id) {
    try {
      const result = await chrome.storage.local.get(['annotations']);
      const annotations = result.annotations || [];
      
      const filteredAnnotations = annotations.filter(annotation => annotation.id !== id);
      
      await chrome.storage.local.set({ annotations: filteredAnnotations });
      
      console.log('Annotation deleted in background:', id);
      
      // Find the deleted annotation's URL to update badge
      const deletedAnnotation = annotations.find(a => a.id === id);
      if (deletedAnnotation) {
        await this.updateBadgeForUrl(deletedAnnotation.url);
      }
      
      // Update badges for all localhost tabs
      await this.updateAllBadges();
      
    } catch (error) {
      console.error('Error deleting annotation:', error);
      throw error;
    }
  }

  async updateAnnotation(id, updates) {
    try {
      const result = await chrome.storage.local.get(['annotations']);
      const annotations = result.annotations || [];
      
      const annotationIndex = annotations.findIndex(annotation => annotation.id === id);
      if (annotationIndex === -1) {
        throw new Error('Annotation not found');
      }
      
      // Update the annotation
      annotations[annotationIndex] = {
        ...annotations[annotationIndex],
        ...updates,
        updated_at: new Date().toISOString()
      };
      
      await chrome.storage.local.set({ annotations });
      
      console.log('Annotation updated in background:', id);
      
      // Force badge update for this annotation's URL
      await this.updateBadgeForUrl(annotations[annotationIndex].url);
      
    } catch (error) {
      console.error('Error updating annotation:', error);
      throw error;
    }
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
      
      console.log(`Badge update for ${url}: ${pendingCount} pending annotations out of ${annotations.length} total`);
      
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
          title: `Claude Annotations - ${pendingCount} pending annotation${pendingCount === 1 ? '' : 's'}`
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
      
      console.log(`[Direct] Badge update for ${url}: ${pendingCount} pending annotations out of ${urlAnnotations.length} total`);
      
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
          title: `Claude Annotations - ${pendingCount} pending annotation${pendingCount === 1 ? '' : 's'}`
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
        title: 'Claude Annotations' 
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
      console.log(`[Background] Badge updated for URL: ${url}`);
    } catch (error) {
      console.error('Error updating badge for URL:', url, error);
    }
  }

  async updateAllBadges() {
    try {
      const tabs = await chrome.tabs.query({});
      const localhostTabs = tabs.filter(tab => this.isLocalhostUrl(tab.url));
      
      for (const tab of localhostTabs) {
        await this.updateBadge(tab.id, tab.url);
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
        return {
          connected: true,
          server_url: this.apiServerUrl,
          server_status: data.status,
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
        console.log(`Server connection changed: ${wasConnected ? 'online' : 'offline'} → ${this.apiConnected ? 'online' : 'offline'}`);
        await this.updateAllBadges();
      }
      
      // If server is online, sync annotations to detect external changes
      if (this.apiConnected) {
        await this.syncAnnotationsFromServer();
      }
    }, 10000);
  }

  async syncAnnotationsFromServer() {
    try {
      // Get current local annotations
      const localResult = await chrome.storage.local.get(['annotations', 'lastServerSync']);
      const localAnnotations = localResult.annotations || [];
      const lastSync = localResult.lastServerSync || 0;
      
      // Get server annotations
      const response = await fetch(`${this.apiServerUrl}/api/annotations`);
      if (!response.ok) {
        return; // Skip sync if server error
      }
      
      const serverResult = await response.json();
      const serverAnnotations = serverResult.annotations || [];
      
      // Compare annotation counts and IDs
      const localIds = new Set(localAnnotations.map(a => a.id));
      const serverIds = new Set(serverAnnotations.map(a => a.id));
      
      // Check if there are differences
      const annotationsChanged = 
        localAnnotations.length !== serverAnnotations.length ||
        !Array.from(localIds).every(id => serverIds.has(id)) ||
        !Array.from(serverIds).every(id => localIds.has(id));
      
      if (annotationsChanged) {
        console.log(`Annotations changed on server: ${localAnnotations.length} → ${serverAnnotations.length}`);
        
        // Update local storage with server state
        await chrome.storage.local.set({ 
          annotations: serverAnnotations,
          lastServerSync: Date.now()
        });
        
        // Update badges for all localhost tabs
        await this.updateAllBadges();
        
        console.log('Annotations synced from server');
      }
      
    } catch (error) {
      console.error('Error syncing annotations from server:', error);
    }
  }


  isLocalhostUrl(url) {
    if (!url) return false;
    
    try {
      const urlObj = new URL(url);
      return urlObj.hostname === 'localhost' || 
             urlObj.hostname === '127.0.0.1' || 
             urlObj.hostname === '0.0.0.0';
    } catch {
      return false;
    }
  }

  async openPopupWithFocus(annotationId) {
    try {
      // Since we can't programmatically open the popup in MV3,
      // we'll just store the focused annotation ID for when the popup is opened
      console.log('Storing focused annotation ID for popup:', annotationId);
      
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
      
      console.log('Forced API sync completed:', annotations.length, 'annotations');
      
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
    return 'claude_' + Date.now() + '_' + Math.random().toString(36).substr(2, 9);
  }
}

// Initialize the background service worker
new ClaudeAnnotationsBackground();