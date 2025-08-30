// Vibe Annotations Popup JavaScript

class AnnotationsPopup {
  constructor() {
    this.annotations = [];
    this.themeManager = null;
    this.serverOnline = false;
    this.currentScreen = null; // Track current screen state
    this.init();
  }

  async init() {
    // Initialize theme manager
    this.themeManager = new ThemeManager();
    await this.themeManager.init();
    
    // Check for update notification
    await this.checkForUpdateNotification();
    
    // Set current route subtitle
    await this.setCurrentRoute();
    
    // Check MCP connection status first
    await this.updateMCPStatus();
    
    // Load annotations from storage
    await this.loadAnnotations();
    
    // Update screen visibility based on connection status and annotations
    this.updateScreenVisibility();
    
    // Render the UI
    this.render();
    
    // Set up event listeners
    this.setupEventListeners();
    
    // Check for focused annotation and scroll to it
    await this.handleFocusedAnnotation();
    
    // Update button text based on annotation mode status
    this.updateAnnotationButton();
  }

  async checkForUpdateNotification() {
    try {
      const result = await chrome.storage.local.get(['updateInfo']);
      const updateInfo = result.updateInfo;
      
      if (updateInfo && updateInfo.hasUpdate) {
        const updateBanner = document.getElementById('update-banner');
        const updateMessage = document.getElementById('update-banner-message');
        
        updateMessage.textContent = `Extension updated to v${updateInfo.currentVersion}`;
        updateBanner.style.display = 'block';
        
        // Clear the "NEW" badge since user is viewing the popup
        chrome.action.setBadgeText({ text: '' });
      }
    } catch (error) {
      console.error('Error checking for update notification:', error);
    }
  }

  async setCurrentRoute() {
    try {
      const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
      const routeElement = document.getElementById('current-route');
      
      if (this.isLocalhostUrl(tab.url)) {
        const url = new URL(tab.url);
        if (url.protocol === 'file:') {
          // For file URLs, show just the filename and parent directory
          const parts = url.pathname.split('/');
          const filename = parts[parts.length - 1] || 'index.html';
          const parentDir = parts[parts.length - 2] || '';
          routeElement.textContent = parentDir ? `${parentDir}/${filename}` : filename;
        } else {
          routeElement.textContent = `${url.hostname}:${url.port}${url.pathname}`;
        }
      } else {
        routeElement.textContent = 'Not supported';
      }
    } catch (error) {
      console.error('Error setting current route:', error);
      document.getElementById('current-route').textContent = 'Unknown route';
    }
  }

  async loadAnnotations() {
    try {
      // Get current tab URL for filtering
      const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
      const currentUrl = tab.url;
      
      const result = await chrome.storage.local.get(['annotations']);
      const allAnnotations = result.annotations || [];
      
      // Filter annotations to only show those for the current URL
      this.annotations = allAnnotations.filter(annotation => 
        annotation.url === currentUrl
      );
    } catch (error) {
      console.error('Error loading annotations:', error);
      this.annotations = [];
    }
  }

  async saveAnnotations() {
    try {
      // Get all annotations from storage first
      const result = await chrome.storage.local.get(['annotations']);
      const allAnnotations = result.annotations || [];
      
      // Update the complete annotations array with our local changes
      this.annotations.forEach(updatedAnnotation => {
        const index = allAnnotations.findIndex(a => a.id === updatedAnnotation.id);
        if (index >= 0) {
          allAnnotations[index] = updatedAnnotation;
        }
      });
      
      // Save the complete updated array back to storage
      await chrome.storage.local.set({ annotations: allAnnotations });
    } catch (error) {
      console.error('Error saving annotations:', error);
    }
  }

  render() {
    const annotationsList = document.getElementById('annotations-list');
    
    if (this.annotations.length === 0) {
      annotationsList.innerHTML = '';
      return;
    }

    // Sort annotations by creation date (newest first)
    const sortedAnnotations = [...this.annotations].sort((a, b) => 
      new Date(b.created_at) - new Date(a.created_at)
    );

    annotationsList.innerHTML = `
      <div class="annotations-header">
        <div class="status-indicator-header">
          <span>Pending annotations</span>
        </div>
      </div>
      ${sortedAnnotations.map(annotation => 
        this.renderAnnotationItem(annotation)
      ).join('')}
    `;

    // Add event listeners to annotation items
    this.setupAnnotationListeners();
    
    // Update button states based on server status
    this.updateAnnotationButtons();
    
    // Update screen visibility after rendering
    this.updateScreenVisibility();
  }

  renderAnnotationItem(annotation) {
    const timeAgo = this.getTimeAgo(annotation.created_at);
    const viewportWidth = annotation.viewport?.width || 'unknown';

    return `
      <div class="annotation-item" data-id="${annotation.id}">
        <div class="annotation-comment" data-full-comment="${this.escapeHtml(annotation.comment)}" title="Click to edit">${this.escapeHtml(annotation.comment)}</div>
        <div class="annotation-meta">
          <span class="annotation-timestamp">${timeAgo} • ${viewportWidth}w</span>
          <div class="annotation-actions">
            <button class="action-btn target-btn" data-id="${annotation.id}" title="Go to element">
              <iconify-icon icon="heroicons:magnifying-glass" width="14" height="14"></iconify-icon>
            </button>
            <button class="action-btn delete-btn" data-id="${annotation.id}" title="Delete">
              <iconify-icon icon="heroicons-outline:trash" width="14" height="14"></iconify-icon>
            </button>
          </div>
        </div>
      </div>
    `;
  }

  setupEventListeners() {
    // Listen for annotation updates from background script
    chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
      if (request.action === 'annotationsUpdated') {
        // Reload annotations and re-render if they've changed
        this.loadAnnotations().then(() => {
          this.updateScreenVisibility();
          this.render();
        });
      }
    });

    // New annotation button
    const newAnnotationBtn = document.getElementById('new-annotation-btn');
    newAnnotationBtn.addEventListener('click', async () => {
      // Check if annotation mode is currently active
      const isActive = await this.checkAnnotationModeStatus();
      
      if (isActive) {
        this.stopAnnotationMode();
      } else {
        this.startAnnotationMode();
      }
    });

    // Settings button
    const settingsBtn = document.getElementById('settings-btn');
    settingsBtn.addEventListener('click', () => {
      this.openSettings();
    });

    // Update banner buttons
    const viewChangelogBtn = document.getElementById('view-changelog-btn');
    if (viewChangelogBtn) {
      viewChangelogBtn.addEventListener('click', () => {
        this.showChangelog();
      });
    }
    
    const dismissUpdateBtn = document.getElementById('dismiss-update-btn');
    if (dismissUpdateBtn) {
      dismissUpdateBtn.addEventListener('click', () => {
        this.dismissUpdateBanner();
      });
    }

    // Theme selector
    const themeSelect = document.getElementById('theme-select');
    themeSelect.addEventListener('change', (e) => {
      this.changeTheme(e.target.value);
    });

    // Initialize theme selector with current theme
    this.updateThemeSelector();

    // Screenshot toggle
    const screenshotToggle = document.getElementById('screenshot-toggle');
    screenshotToggle.addEventListener('change', (e) => {
      this.updateScreenshotSetting(e.target.checked);
    });

    // Initialize screenshot toggle with current setting
    this.updateScreenshotToggle();

    // Refresh status button
    const refreshStatusBtn = document.getElementById('refresh-status-btn');
    if (refreshStatusBtn) {
      refreshStatusBtn.addEventListener('click', async () => {
        await this.updateMCPStatus();
      });
    }

    // Setup command copying
    this.setupCommandCopying();

    // Setup agent tabs
    this.setupAgentTabs();

    // Setup screen navigation
    this.setupScreenNavigation();
  }

  async handleFocusedAnnotation() {
    try {
      // Check if there's a specific annotation to focus on
      const result = await chrome.storage.local.get(['focusedAnnotationId']);
      const focusedAnnotationId = result.focusedAnnotationId;
      
      if (focusedAnnotationId) {
        // Clear the stored focused annotation ID
        await chrome.storage.local.remove(['focusedAnnotationId']);
        
        // Scroll to and highlight the annotation
        this.scrollToAnnotation(focusedAnnotationId);
      }
    } catch (error) {
      console.error('Error handling focused annotation:', error);
    }
  }

  scrollToAnnotation(annotationId) {
    // Find the annotation element in the list
    const annotationElement = document.querySelector(`[data-id="${annotationId}"]`);
    
    if (annotationElement) {
      // Scroll to the annotation
      annotationElement.scrollIntoView({
        behavior: 'smooth',
        block: 'center'
      });
      
      // Add a highlight effect
      annotationElement.style.animation = 'vibe-highlight 2s ease-out';
      
      // Remove the animation after it completes
      setTimeout(() => {
        annotationElement.style.animation = '';
      }, 2000);
    } else {
      console.warn('Annotation element not found for ID:', annotationId);
    }
  }

  setupAnnotationListeners() {
    // Target buttons
    document.querySelectorAll('.target-btn').forEach(btn => {
      btn.addEventListener('click', (e) => {
        e.stopPropagation();
        e.preventDefault();
        const id = btn.dataset.id;
        this.targetAnnotation(id);
      });
    });
    
    // Add event delegation as backup for SVG clicks
    const annotationsList = document.getElementById('annotations-list');
    if (annotationsList) {
      annotationsList.addEventListener('click', (e) => {
        // Handle clicks on target button or its SVG children
        const targetBtn = e.target.closest('.target-btn');
        if (targetBtn) {
          e.preventDefault();
          e.stopPropagation();
          const id = targetBtn.dataset.id;
          this.targetAnnotation(id);
          return;
        }
        
        // Handle SVG elements specifically
        if (e.target.tagName === 'svg' || e.target.tagName === 'circle') {
          const parentBtn = e.target.closest('.target-btn');
          if (parentBtn) {
            e.preventDefault();
            e.stopPropagation();
            const id = parentBtn.dataset.id;
            this.targetAnnotation(id);
            return;
          }
        }
      });
    }

    // Delete buttons (high priority - stop propagation)
    document.querySelectorAll('.delete-btn').forEach(btn => {
      btn.addEventListener('click', (e) => {
        e.stopPropagation();
        const id = btn.dataset.id;
        this.deleteAnnotation(id);
      });
    });

    // Annotation items (click anywhere to edit)
    document.querySelectorAll('.annotation-item').forEach(item => {
      item.addEventListener('click', (e) => {
        // Skip if clicking on action buttons (they handle their own clicks with stopPropagation)
        if (e.target.closest('.annotation-actions') || 
            e.target.closest('.action-btn') ||
            e.target.classList.contains('action-btn')) {
          return;
        }
        
        // Check if server is online before allowing edit
        if (!this.serverOnline) {
          return;
        }
        
        // Don't start editing if already in edit mode
        const commentDiv = item.querySelector('.annotation-comment');
        if (commentDiv && commentDiv.classList.contains('editing')) {
          return;
        }
        
        const id = item.dataset.id;
        if (commentDiv) {
          this.startInlineEdit(id, commentDiv);
        }
      });
    });
  }

  async startAnnotationMode() {
    try {
      // Get current active tab
      const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
      
      // Check if it's a localhost or local file URL
      if (!this.isLocalhostUrl(tab.url)) {
        alert('Vibe Annotations only works on local development URLs (.local, .test, .localhost, localhost) and local HTML files for security reasons.');
        return;
      }

      // Send message to content script to start annotation mode
      const response = await chrome.tabs.sendMessage(tab.id, { 
        action: 'startAnnotationMode' 
      });

      // Close popup
      window.close();
    } catch (error) {
      console.error('Error starting annotation mode:', error);
      
      // More specific error message
      const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
      if (error.message.includes('receiving end does not exist')) {
        if (tab.url.startsWith('file://')) {
          alert('File access required: Please go to chrome://extensions/, find "Vibe Annotations", and enable "Allow access to file URLs". Then refresh this page.');
        } else {
          alert('Content script not ready. Please refresh the page and try again.');
        }
      } else {
        alert('Error: Make sure you are on a local development page and refresh if needed.');
      }
    }
  }

  async stopAnnotationMode() {
    try {
      // Get current active tab
      const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
      
      // Send message to content script to stop annotation mode
      const response = await chrome.tabs.sendMessage(tab.id, { 
        action: 'stopAnnotationMode' 
      });

      // Close popup
      window.close();
    } catch (error) {
      console.error('Error stopping annotation mode:', error);
    }
  }

  async targetAnnotation(id) {
    const annotation = this.annotations.find(a => a.id === id);
    if (!annotation) return;

    try {
      const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
      
      if (tab.url !== annotation.url) {
        await chrome.tabs.update(tab.id, { url: annotation.url });
      }

      setTimeout(async () => {
        try {
          await chrome.tabs.sendMessage(tab.id, {
            action: 'targetAnnotationElement',
            annotation: annotation
          });
          // Close popup after message is sent
          setTimeout(() => window.close(), 100);
        } catch (error) {
          console.error('Error targeting annotation element:', error);
          // Close popup even on error
          setTimeout(() => window.close(), 100);
        }
      }, tab.url !== annotation.url ? 2000 : 100);
    } catch (error) {
      console.error('Error targeting annotation:', error);
    }
  }

  startInlineEdit(id, commentDiv) {
    const annotation = this.annotations.find(a => a.id === id);
    if (!annotation) return;

    // Don't start editing if already in edit mode
    if (commentDiv.classList.contains('editing')) return;

    // Get the annotation item to find the action buttons
    const annotationItem = commentDiv.closest('.annotation-item');
    const actionsDiv = annotationItem.querySelector('.annotation-actions');
    
    // Store original buttons HTML
    const originalActionsHTML = actionsDiv.innerHTML;
    annotationItem.setAttribute('data-original-actions', originalActionsHTML);

    // Create textarea for editing
    const textarea = document.createElement('textarea');
    textarea.className = 'annotation-edit-textarea';
    textarea.value = annotation.comment;
    textarea.setAttribute('data-original-value', annotation.comment);
    
    // Auto-resize function
    const autoResize = () => {
      textarea.style.height = '0px';
      textarea.style.height = textarea.scrollHeight + 'px';
    };
    
    // Store reference to original content
    const originalContent = commentDiv.innerHTML;
    commentDiv.setAttribute('data-original-content', originalContent);
    
    // Replace action buttons with save/cancel
    actionsDiv.innerHTML = `
      <button class="action-btn cancel-edit-btn" data-id="${id}" title="Cancel editing">
        <iconify-icon icon="lucide:x" width="14" height="14"></iconify-icon>
      </button>
      <button class="action-btn save-edit-btn" data-id="${id}" title="Save changes">
        <iconify-icon icon="lucide:check" width="14" height="14"></iconify-icon>
      </button>
    `;
    
    // Replace content with textarea
    commentDiv.innerHTML = '';
    commentDiv.appendChild(textarea);
    commentDiv.classList.add('editing');
    annotationItem.classList.add('editing');
    
    // Focus and select text
    textarea.focus();
    textarea.select();
    
    // Initial resize and setup auto-resize
    autoResize();
    textarea.addEventListener('input', autoResize);
    
    // Set up event listeners for save/cancel buttons
    this.setupEditControls(id, textarea, commentDiv, annotationItem);
    
    // Handle escape and enter keys
    textarea.addEventListener('keydown', (e) => {
      if (e.key === 'Escape') {
        this.cancelInlineEdit(commentDiv, annotationItem);
      } else if (e.key === 'Enter' && !e.shiftKey) {
        e.preventDefault();
        this.finishInlineEdit(id, textarea, commentDiv, annotationItem);
      }
    });
    
    // Handle blur to save (when clicking outside)
    textarea.addEventListener('blur', (e) => {
      // Small delay to allow button clicks to register first
      setTimeout(() => {
        // Check if we're still in editing mode (button clicks might have cancelled/saved already)
        if (commentDiv.classList.contains('editing')) {
          this.finishInlineEdit(id, textarea, commentDiv, annotationItem);
        }
      }, 150);
    });
  }

  setupEditControls(id, textarea, commentDiv, annotationItem) {
    // Set up cancel button
    const cancelBtn = annotationItem.querySelector('.cancel-edit-btn');
    cancelBtn.addEventListener('click', (e) => {
      e.stopPropagation();
      this.cancelInlineEdit(commentDiv, annotationItem);
    });
    
    // Set up save button
    const saveBtn = annotationItem.querySelector('.save-edit-btn');
    saveBtn.addEventListener('click', (e) => {
      e.stopPropagation();
      this.finishInlineEdit(id, textarea, commentDiv, annotationItem);
    });
  }

  async saveInlineEdit(id, newComment) {
    const annotation = this.annotations.find(a => a.id === id);
    if (!annotation) {
      console.error('Annotation not found for inline edit:', id);
      return;
    }

    annotation.comment = newComment;
    annotation.updated_at = new Date().toISOString();
    
    await this.saveAnnotations();
    // Don't re-render while editing to avoid losing focus
  }

  finishInlineEdit(id, textarea, commentDiv, annotationItem) {
    const newValue = textarea.value.trim();
    
    if (newValue === '') {
      // Don't allow empty comments, revert to original
      this.cancelInlineEdit(commentDiv, annotationItem);
      return;
    }
    
    // Save final changes
    this.saveInlineEdit(id, newValue).then(() => {
      // Update the display and restore buttons
      this.exitInlineEdit(commentDiv, annotationItem, newValue);
    });
  }

  cancelInlineEdit(commentDiv, annotationItem) {
    // Restore original content
    const originalContent = commentDiv.getAttribute('data-original-content');
    this.exitInlineEdit(commentDiv, annotationItem, null, originalContent);
  }

  exitInlineEdit(commentDiv, annotationItem, newComment = null, originalContent = null) {
    commentDiv.classList.remove('editing');
    annotationItem.classList.remove('editing');
    
    // Restore original action buttons
    const actionsDiv = annotationItem.querySelector('.annotation-actions');
    const originalActionsHTML = annotationItem.getAttribute('data-original-actions');
    if (originalActionsHTML) {
      actionsDiv.innerHTML = originalActionsHTML;
      // Re-setup event listeners for the restored buttons
      this.setupAnnotationListeners();
    }
    
    if (newComment !== null) {
      // Update with new content (full content, no truncation)
      commentDiv.innerHTML = this.escapeHtml(newComment);
      commentDiv.setAttribute('data-full-comment', this.escapeHtml(newComment));
    } else if (originalContent !== null) {
      // Restore original content
      commentDiv.innerHTML = originalContent;
    }
    
    // Clean up attributes
    commentDiv.removeAttribute('data-original-content');
    annotationItem.removeAttribute('data-original-actions');
  }

  async deleteAnnotation(id) {
    if (confirm('Are you sure you want to delete this annotation?')) {
      // Get all annotations from storage
      const result = await chrome.storage.local.get(['annotations']);
      const allAnnotations = result.annotations || [];
      
      // Remove the annotation completely
      const filteredAnnotations = allAnnotations.filter(a => a.id !== id);
      
      // Save back to storage
      await chrome.storage.local.set({ annotations: filteredAnnotations });
      
      // Update local array
      this.annotations = this.annotations.filter(a => a.id !== id);
      
      this.render();
    }
  }

  async viewAnnotation(id) {
    const annotation = this.annotations.find(a => a.id === id);
    if (!annotation) return;

    try {
      // Try to navigate to the annotation's URL
      const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
      
      if (tab.url !== annotation.url) {
        // Navigate to the annotation's page
        await chrome.tabs.update(tab.id, { url: annotation.url });
      }

      // Send message to highlight the annotation
      setTimeout(async () => {
        try {
          await chrome.tabs.sendMessage(tab.id, {
            action: 'highlightAnnotation',
            annotation: annotation
          });
        } catch (error) {
          console.error('Error highlighting annotation:', error);
        }
      }, tab.url !== annotation.url ? 2000 : 100);

      // Close popup
      window.close();
    } catch (error) {
      console.error('Error viewing annotation:', error);
    }
  }


  async updateMCPStatus() {
    try {
      // Check external server health via direct HTTP call
      const response = await fetch('http://127.0.0.1:3846/health', {
        method: 'GET',
        signal: AbortSignal.timeout(2000) // 2 second timeout
      });
      
      const statusIndicator = document.querySelector('.status-indicator');
      const statusText = document.querySelector('.status-text');
      const newAnnotationBtn = document.getElementById('new-annotation-btn');
      
      this.serverOnline = response.ok;
      
      if (this.serverOnline) {
        statusIndicator.className = 'status-indicator online';
        statusText.textContent = 'API online';
        newAnnotationBtn.disabled = false;
        newAnnotationBtn.title = 'Create new annotation';
        
        // Update server status in setup screens
        const serverStatusText = document.getElementById('server-status-text');
        const serverRunningStatus = document.getElementById('server-running-status');
        if (serverStatusText) {
          serverStatusText.textContent = '✅ Running (:3846)';
          serverStatusText.className = 'status-online';
        }
        if (serverRunningStatus) {
          serverRunningStatus.textContent = '✅ Running (:3846)';
          serverRunningStatus.className = 'status-online';
        }
      } else {
        statusIndicator.className = 'status-indicator offline';
        statusText.textContent = 'API offline';
        newAnnotationBtn.disabled = true;
        newAnnotationBtn.title = 'Server not running - follow setup instructions';
        
        // Update server status in setup screens
        const serverStatusText = document.getElementById('server-status-text');
        if (serverStatusText) {
          serverStatusText.textContent = '❌ Not detected';
          serverStatusText.className = 'status-offline';
        }
      }
      
      // Update existing annotation buttons based on server status
      this.updateAnnotationButtons();
      
      // Update screen visibility when connection status changes
      this.updateScreenVisibility();
    } catch (error) {
      console.error('Error checking server status:', error);
      
      const statusIndicator = document.querySelector('.status-indicator');
      const statusText = document.querySelector('.status-text');
      const newAnnotationBtn = document.getElementById('new-annotation-btn');
      
      this.serverOnline = false;
      statusIndicator.className = 'status-indicator offline';
      statusText.textContent = 'API offline';
      newAnnotationBtn.disabled = true;
      newAnnotationBtn.title = 'Server not running - follow setup instructions';
      
      // Update server status in setup screens
      const serverStatusText = document.getElementById('server-status-text');
      if (serverStatusText) {
        serverStatusText.textContent = '❌ Not detected';
        serverStatusText.className = 'status-offline';
      }
      
      // Update existing annotation buttons
      this.updateAnnotationButtons();
      
      // Update screen visibility when connection status changes
      this.updateScreenVisibility();
    }
  }

  updateAnnotationButtons() {
    // Target buttons should always work (they just scroll to elements)
    document.querySelectorAll('.target-btn').forEach(btn => {
      btn.disabled = false;
      btn.title = 'Go to element';
      btn.style.opacity = '';
      btn.style.cursor = '';
    });
    
    // Disable/enable delete buttons and inline editing based on server status
    document.querySelectorAll('.delete-btn').forEach(btn => {
      btn.disabled = !this.serverOnline;
      if (!this.serverOnline) {
        btn.title = 'MCP server is offline';
        btn.style.opacity = '0.5';
        btn.style.cursor = 'not-allowed';
      } else {
        btn.title = 'Delete';
        btn.style.opacity = '';
        btn.style.cursor = '';
      }
    });
    
    // Enable/disable inline editing based on server status
    document.querySelectorAll('.annotation-item').forEach(annotationItem => {
      if (!this.serverOnline) {
        annotationItem.style.cursor = 'not-allowed';
        annotationItem.title = 'MCP server is offline - cannot edit';
        annotationItem.classList.add('disabled');
      } else {
        annotationItem.style.cursor = 'pointer';
        annotationItem.title = 'Click to edit';
        annotationItem.classList.remove('disabled');
      }
    });
  }

  // Utility functions
  isLocalhostUrl(url) {
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


  getUrlDisplay(url) {
    try {
      const urlObj = new URL(url);
      if (urlObj.protocol === 'file:') {
        // For file URLs, show just the filename
        const parts = urlObj.pathname.split('/');
        return parts[parts.length - 1] || 'index.html';
      }
      return `${urlObj.hostname}:${urlObj.port || '80'}`;
    } catch {
      return url;
    }
  }

  getTimeAgo(timestamp) {
    const now = new Date();
    const time = new Date(timestamp);
    const diffInMinutes = Math.floor((now - time) / (1000 * 60));

    if (diffInMinutes < 1) return 'Just now';
    if (diffInMinutes < 60) return `${diffInMinutes}m ago`;
    
    const diffInHours = Math.floor(diffInMinutes / 60);
    if (diffInHours < 24) return `${diffInHours}h ago`;
    
    const diffInDays = Math.floor(diffInHours / 24);
    return `${diffInDays}d ago`;
  }

  async checkAnnotationModeStatus() {
    try {
      // Get current active tab
      const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
      
      // Check if it's a localhost URL
      if (!this.isLocalhostUrl(tab.url)) {
        return false;
      }

      // Send message to content script to check annotation mode status
      const response = await chrome.tabs.sendMessage(tab.id, { 
        action: 'getAnnotationModeStatus' 
      });

      return response && response.success && response.isAnnotationMode;
    } catch (error) {
      console.error('Error checking annotation mode status:', error);
      return false;
    }
  }

  async updateAnnotationButton() {
    const newAnnotationBtn = document.getElementById('new-annotation-btn');
    const isActive = await this.checkAnnotationModeStatus();
    
    if (isActive) {
      newAnnotationBtn.innerHTML = `
        <iconify-icon icon="lucide:square" width="16" height="16"></iconify-icon>
        Stop Annotating
      `;
      newAnnotationBtn.title = 'Stop annotation mode';
    } else {
      newAnnotationBtn.innerHTML = `
        <iconify-icon icon="heroicons-solid:cursor-arrow-ripple" width="16" height="16"></iconify-icon>
        Start Annotating
      `;
      newAnnotationBtn.title = 'Create new annotation';
    }
  }

  escapeHtml(text) {
    const div = document.createElement('div');
    div.textContent = text;
    return div.innerHTML;
  }

  // Settings Screen Methods
  openSettings() {
    this.currentScreen = 'settings';
    this.updateScreenVisibility();
    this.updateThemeSelector();
    this.updateScreenshotToggle();
  }

  updateThemeSelector() {
    if (this.themeManager) {
      const themeSelect = document.getElementById('theme-select');
      themeSelect.value = this.themeManager.getCurrentTheme();
    }
  }

  async changeTheme(theme) {
    if (this.themeManager) {
      await this.themeManager.saveThemePreference(theme);
    }
  }

  async updateScreenshotSetting(enabled) {
    try {
      await chrome.storage.local.set({ screenshotEnabled: enabled });
      console.log(`Screenshot capture ${enabled ? 'enabled' : 'disabled'}`);
    } catch (error) {
      console.error('Error saving screenshot setting:', error);
    }
  }

  async updateScreenshotToggle() {
    try {
      const result = await chrome.storage.local.get(['screenshotEnabled']);
      const screenshotToggle = document.getElementById('screenshot-toggle');
      // Default to enabled (true) if not set
      const enabled = result.screenshotEnabled !== undefined ? result.screenshotEnabled : true;
      screenshotToggle.checked = enabled;
    } catch (error) {
      console.error('Error loading screenshot setting:', error);
      // Default to enabled on error
      const screenshotToggle = document.getElementById('screenshot-toggle');
      screenshotToggle.checked = true;
    }
  }

  updateScreenVisibility() {
    const welcomeScreen = document.getElementById('welcome-screen');
    const getStartedScreen = document.getElementById('get-started-screen');
    const setupCompleteScreen = document.getElementById('setup-complete-screen');
    const howItWorksScreen = document.getElementById('how-it-works-screen');
    const settingsScreen = document.getElementById('settings-screen');
    const readyScreen = document.getElementById('ready-screen');
    const annotationsList = document.getElementById('annotations-list');

    // Hide all screens first
    welcomeScreen.style.display = 'none';
    getStartedScreen.style.display = 'none';
    setupCompleteScreen.style.display = 'none';
    howItWorksScreen.style.display = 'none';
    settingsScreen.style.display = 'none';
    readyScreen.style.display = 'none';
    annotationsList.style.display = 'none';

    // Check if we're in specific screens
    if (this.currentScreen === 'get-started') {
      getStartedScreen.style.display = 'flex';
      return;
    }
    
    if (this.currentScreen === 'how-it-works') {
      howItWorksScreen.style.display = 'flex';
      return;
    }

    if (this.currentScreen === 'settings') {
      settingsScreen.style.display = 'flex';
      return;
    }

    if (this.annotations.length > 0) {
      // Show annotations list when there are annotations
      annotationsList.style.display = 'flex';
    } else if (this.serverOnline) {
      // Show setup complete screen briefly, then ready screen
      if (this.currentScreen === 'setup-complete') {
        setupCompleteScreen.style.display = 'flex';
      } else {
        readyScreen.style.display = 'flex';
      }
    } else {
      // Show welcome screen when server is offline
      welcomeScreen.style.display = 'flex';
    }
  }

  setupCommandCopying() {
    // Individual copy buttons
    document.querySelectorAll('.copy-btn').forEach(btn => {
      btn.addEventListener('click', async (e) => {
        e.stopPropagation();
        const command = btn.dataset.command;
        if (command) {
          try {
            await navigator.clipboard.writeText(command);
            this.showCopyFeedback(btn);
          } catch (error) {
            console.error('Failed to copy command:', error);
          }
        }
      });
    });

    // Copy all commands button
    const copyAllBtn = document.getElementById('copy-all-commands');
    if (copyAllBtn) {
      copyAllBtn.addEventListener('click', async () => {
        const commands = [
          'npm install -g vibe-annotations-server',
          'vibe-annotations-server start',
          'claude mcp add --transport http vibe-annotations http://127.0.0.1:3846/mcp'
        ];
        const allCommands = commands.join('\n');
        try {
          await navigator.clipboard.writeText(allCommands);
          this.showCopyFeedback(copyAllBtn, 'All commands copied!');
        } catch (error) {
          console.error('Failed to copy all commands:', error);
        }
      });
    }

    // Check server button
    const checkServerBtn = document.getElementById('check-server-btn');
    if (checkServerBtn) {
      checkServerBtn.addEventListener('click', async () => {
        await this.updateMCPStatus();
        if (this.serverOnline) {
          // Show setup complete screen briefly
          this.currentScreen = 'setup-complete';
          this.updateScreenVisibility();
          
          // Auto-transition to ready screen after 3 seconds
          setTimeout(() => {
            this.currentScreen = null;
            this.updateScreenVisibility();
          }, 3000);
        }
      });
    }
  }

  setupScreenNavigation() {
    // Get started button in welcome screen
    const getStartedBtn = document.getElementById('get-started-btn');
    if (getStartedBtn) {
      getStartedBtn.addEventListener('click', () => {
        this.currentScreen = 'get-started';
        this.updateScreenVisibility();
      });
    }

    // Get started header button
    const getStartedHeaderBtn = document.getElementById('get-started-header-btn');
    if (getStartedHeaderBtn) {
      getStartedHeaderBtn.addEventListener('click', () => {
        this.currentScreen = 'get-started';
        this.updateScreenVisibility();
      });
    }

    // Back to welcome button
    const backToWelcomeBtn = document.getElementById('back-to-welcome-btn');
    if (backToWelcomeBtn) {
      backToWelcomeBtn.addEventListener('click', () => {
        this.currentScreen = null;
        this.updateScreenVisibility();
      });
    }

    // How it works button
    const howItWorksBtn = document.getElementById('how-it-works-btn');
    if (howItWorksBtn) {
      howItWorksBtn.addEventListener('click', () => {
        this.currentScreen = 'how-it-works';
        this.updateScreenVisibility();
      });
    }

    // Back to setup button
    const backToSetupBtn = document.getElementById('back-to-setup-btn');
    if (backToSetupBtn) {
      backToSetupBtn.addEventListener('click', () => {
        this.currentScreen = null;
        this.updateScreenVisibility();
      });
    }

    // Back from settings button
    const backFromSettingsBtn = document.getElementById('back-from-settings-btn');
    if (backFromSettingsBtn) {
      backFromSettingsBtn.addEventListener('click', () => {
        this.currentScreen = null;
        this.updateScreenVisibility();
      });
    }

    // Server management buttons
    const viewLogsBtn = document.getElementById('view-logs-btn');
    const restartServerBtn = document.getElementById('restart-server-btn');

    if (viewLogsBtn) {
      viewLogsBtn.addEventListener('click', () => {
        // For now, just show an alert with instructions
        alert('To view server logs, run:\nvibe-annotations-server logs\n\nOr check your terminal where you started the server.');
      });
    }

    if (restartServerBtn) {
      restartServerBtn.addEventListener('click', () => {
        // For now, just show an alert with instructions
        alert('To restart the server, run:\nvibe-annotations-server restart\n\nThen click "Check Again" to verify.');
      });
    }
  }

  setupAgentTabs() {
    // Setup tab switching functionality
    const tabButtons = document.querySelectorAll('.tab-btn');
    const tabContents = document.querySelectorAll('.tab-content');

    tabButtons.forEach(button => {
      button.addEventListener('click', () => {
        const targetAgent = button.getAttribute('data-agent');
        
        // Remove active class from all buttons and contents
        tabButtons.forEach(btn => btn.classList.remove('active'));
        tabContents.forEach(content => content.classList.remove('active'));
        
        // Add active class to clicked button and corresponding content
        button.classList.add('active');
        const targetContent = document.querySelector(`.tab-content[data-agent="${targetAgent}"]`);
        if (targetContent) {
          targetContent.classList.add('active');
        }
      });
    });
  }

  showCopyFeedback(button, message = 'Copied!') {
    const originalContent = button.innerHTML;
    button.innerHTML = `<iconify-icon icon="lucide:check" width="14" height="14"></iconify-icon>`;
    button.style.color = '#10b981';
    
    setTimeout(() => {
      button.innerHTML = originalContent;
      button.style.color = '';
    }, 1000);
  }

  async showChangelog() {
    try {
      const result = await chrome.storage.local.get(['updateInfo']);
      const updateInfo = result.updateInfo;
      
      if (updateInfo && updateInfo.changelog) {
        // For now, just show an alert. In a real app, you'd open a modal or new tab
        const changes = updateInfo.changelog.join('\n• ');
        alert(`What's new in v${updateInfo.currentVersion}:\n\n• ${changes}`);
      }
    } catch (error) {
      console.error('Error showing changelog:', error);
    }
  }

  async dismissUpdateBanner() {
    try {
      // Hide the banner
      const updateBanner = document.getElementById('update-banner');
      updateBanner.style.display = 'none';
      
      // Clear the update info from storage
      await chrome.storage.local.remove(['updateInfo']);
    } catch (error) {
      console.error('Error dismissing update banner:', error);
    }
  }
}

// Initialize popup when DOM is loaded
document.addEventListener('DOMContentLoaded', () => {
  new AnnotationsPopup();
});

// Listen for storage changes to update UI in real-time
chrome.storage.onChanged.addListener((changes, namespace) => {
  if (namespace === 'local' && changes.annotations) {
    // Don't reload if we're currently editing an annotation
    const isCurrentlyEditing = document.querySelector('.annotation-comment.editing');
    if (!isCurrentlyEditing) {
      // Reload and re-render annotations
      window.location.reload();
    }
  }
});