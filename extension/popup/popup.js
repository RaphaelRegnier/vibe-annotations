// Claude Annotations Popup JavaScript

class AnnotationsPopup {
  constructor() {
    this.annotations = [];
    this.init();
  }

  async init() {
    console.log('Initializing Claude Annotations popup...');
    
    // Set current route subtitle
    await this.setCurrentRoute();
    
    // Load annotations from storage
    await this.loadAnnotations();
    
    // Render the UI
    this.render();
    
    // Set up event listeners
    this.setupEventListeners();
    
    // Check for focused annotation and scroll to it
    await this.handleFocusedAnnotation();
    
    // Check MCP connection status
    this.updateMCPStatus();
    
    // Update button text based on annotation mode status
    this.updateAnnotationButton();
  }

  async setCurrentRoute() {
    try {
      const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
      const routeElement = document.getElementById('current-route');
      
      if (this.isLocalhostUrl(tab.url)) {
        const url = new URL(tab.url);
        routeElement.textContent = `${url.hostname}:${url.port}${url.pathname}`;
      } else {
        routeElement.textContent = 'Not on localhost';
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
      
      console.log(`Loaded ${this.annotations.length} annotations for current page`);
    } catch (error) {
      console.error('Error loading annotations:', error);
      this.annotations = [];
    }
  }

  async saveAnnotations() {
    try {
      await chrome.storage.local.set({ annotations: this.annotations });
      console.log('Annotations saved to storage');
    } catch (error) {
      console.error('Error saving annotations:', error);
    }
  }

  render() {
    const annotationsList = document.getElementById('annotations-list');
    
    if (this.annotations.length === 0) {
      annotationsList.innerHTML = `
        <div class="empty-state">
          <div class="empty-icon">
            <svg width="48" height="48" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
              <path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z"></path>
            </svg>
          </div>
          <p class="empty-text">No annotations yet</p>
          <p class="empty-subtext">Click on elements to add comments!</p>
        </div>
      `;
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
  }

  renderAnnotationItem(annotation) {
    const truncatedComment = annotation.comment.length > 100 
      ? annotation.comment.substring(0, 100) + '...'
      : annotation.comment;

    const timeAgo = this.getTimeAgo(annotation.created_at);

    return `
      <div class="annotation-item" data-id="${annotation.id}">
        <div class="annotation-comment">${this.escapeHtml(truncatedComment)}</div>
        <div class="annotation-meta">
          <span class="annotation-timestamp">${timeAgo}</span>
          <div class="annotation-actions">
            <button class="action-btn edit-btn" data-id="${annotation.id}" title="Edit">
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                <path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7"></path>
                <path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4z"></path>
              </svg>
            </button>
            <button class="action-btn delete-btn" data-id="${annotation.id}" title="Delete">
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                <polyline points="3,6 5,6 21,6"></polyline>
                <path d="M19,6v14a2,2 0 0,1 -2,2H7a2,2 0 0,1 -2,-2V6m3,0V4a2,2 0 0,1 2,-2h4a2,2 0 0,1 2,2v2"></path>
              </svg>
            </button>
          </div>
        </div>
      </div>
    `;
  }

  setupEventListeners() {
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

  }

  async handleFocusedAnnotation() {
    try {
      // Check if there's a specific annotation to focus on
      const result = await chrome.storage.local.get(['focusedAnnotationId']);
      const focusedAnnotationId = result.focusedAnnotationId;
      
      if (focusedAnnotationId) {
        console.log('Focusing on annotation:', focusedAnnotationId);
        
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
      annotationElement.style.animation = 'claude-highlight 2s ease-out';
      
      // Remove the animation after it completes
      setTimeout(() => {
        annotationElement.style.animation = '';
      }, 2000);
      
      console.log('Scrolled to annotation:', annotationId);
    } else {
      console.warn('Annotation element not found for ID:', annotationId);
    }
  }

  setupAnnotationListeners() {
    // Edit buttons
    document.querySelectorAll('.edit-btn').forEach(btn => {
      btn.addEventListener('click', (e) => {
        e.stopPropagation();
        const id = btn.dataset.id;
        this.editAnnotation(id);
      });
    });

    // Delete buttons
    document.querySelectorAll('.delete-btn').forEach(btn => {
      btn.addEventListener('click', (e) => {
        e.stopPropagation();
        const id = btn.dataset.id;
        this.deleteAnnotation(id);
      });
    });

    // Annotation items (click to view/navigate)
    document.querySelectorAll('.annotation-item').forEach(item => {
      item.addEventListener('click', () => {
        const id = item.dataset.id;
        this.viewAnnotation(id);
      });
    });
  }

  async startAnnotationMode() {
    try {
      // Get current active tab
      const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
      
      console.log('Current tab:', tab.url);
      
      // Check if it's a localhost URL
      if (!this.isLocalhostUrl(tab.url)) {
        alert('Claude Annotations only works on localhost URLs for security reasons.');
        return;
      }

      console.log('Sending startAnnotationMode message to tab:', tab.id);

      // Send message to content script to start annotation mode
      const response = await chrome.tabs.sendMessage(tab.id, { 
        action: 'startAnnotationMode' 
      });

      console.log('Response from content script:', response);

      // Close popup
      window.close();
    } catch (error) {
      console.error('Error starting annotation mode:', error);
      
      // More specific error message
      if (error.message.includes('receiving end does not exist')) {
        alert('Content script not ready. Please refresh the page and try again.');
      } else {
        alert('Error: Make sure you are on a localhost page and refresh if needed.');
      }
    }
  }

  async stopAnnotationMode() {
    try {
      // Get current active tab
      const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
      
      console.log('Sending stopAnnotationMode message to tab:', tab.id);

      // Send message to content script to stop annotation mode
      const response = await chrome.tabs.sendMessage(tab.id, { 
        action: 'stopAnnotationMode' 
      });

      console.log('Response from content script:', response);

      // Close popup
      window.close();
    } catch (error) {
      console.error('Error stopping annotation mode:', error);
    }
  }

  async editAnnotation(id) {
    const annotationItem = document.querySelector(`.annotation-item[data-id="${id}"]`);
    if (!annotationItem) return;

    const annotation = this.annotations.find(a => a.id === id);
    if (!annotation) return;

    // Add editing class
    annotationItem.classList.add('editing');

    // Create and insert textarea
    const textarea = document.createElement('textarea');
    textarea.className = 'annotation-edit-input';
    textarea.value = annotation.comment;
    
    const commentDiv = annotationItem.querySelector('.annotation-comment');
    commentDiv.parentNode.insertBefore(textarea, commentDiv.nextSibling);

    // Update buttons
    const actionsDiv = annotationItem.querySelector('.annotation-actions');
    
    // Create save button
    const saveBtn = document.createElement('button');
    saveBtn.className = 'action-btn annotation-save-btn';
    saveBtn.innerHTML = `
      <svg width="16" height="16" viewBox="0 0 16 16" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
        <polyline points="14 2 6 10 2 6"></polyline>
      </svg>
    `;
    saveBtn.title = 'Save changes';
    
    // Create cancel button
    const cancelBtn = document.createElement('button');
    cancelBtn.className = 'action-btn annotation-cancel-btn';
    cancelBtn.innerHTML = `
      <svg width="16" height="16" viewBox="0 0 16 16" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
        <line x1="3" y1="3" x2="13" y2="13"></line>
        <line x1="13" y1="3" x2="3" y2="13"></line>
      </svg>
    `;
    cancelBtn.title = 'Cancel';
    
    actionsDiv.appendChild(saveBtn);
    actionsDiv.appendChild(cancelBtn);

    // Focus textarea and select all text
    textarea.focus();
    textarea.select();

    // Save function
    const saveChanges = async () => {
      const newComment = textarea.value.trim();
      if (newComment && newComment !== annotation.comment) {
        annotation.comment = newComment;
        annotation.updated_at = new Date().toISOString();
        
        await this.saveAnnotations();
        this.render();
      } else {
        cancelEdit();
      }
    };

    // Cancel function
    const cancelEdit = () => {
      annotationItem.classList.remove('editing');
      textarea.remove();
      saveBtn.remove();
      cancelBtn.remove();
    };

    // Event listeners
    saveBtn.addEventListener('click', (e) => {
      e.stopPropagation();
      saveChanges();
    });

    cancelBtn.addEventListener('click', (e) => {
      e.stopPropagation();
      cancelEdit();
    });

    // Save on blur (when clicking another item)
    textarea.addEventListener('blur', (e) => {
      // Delay to allow button clicks to register
      setTimeout(() => {
        if (document.activeElement !== saveBtn && document.activeElement !== cancelBtn) {
          saveChanges();
        }
      }, 200);
    });

    // Handle Enter (save) and Escape (cancel)
    textarea.addEventListener('keydown', (e) => {
      if (e.key === 'Enter' && !e.shiftKey) {
        e.preventDefault();
        saveChanges();
      } else if (e.key === 'Escape') {
        e.preventDefault();
        cancelEdit();
      }
    });
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

      // Send message to scroll to and highlight the annotation pin
      setTimeout(async () => {
        try {
          await chrome.tabs.sendMessage(tab.id, {
            action: 'scrollToAnnotation',
            annotation: annotation
          });
        } catch (error) {
          console.error('Error scrolling to annotation:', error);
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
      const response = await chrome.runtime.sendMessage({
        action: 'checkMCPStatus'
      });
      
      const statusIndicator = document.querySelector('.status-indicator');
      const statusText = document.querySelector('.status-text');
      const newAnnotationBtn = document.getElementById('new-annotation-btn');
      
      this.serverOnline = response && response.success && response.status.connected;
      
      if (this.serverOnline) {
        statusIndicator.className = 'status-indicator online';
        statusText.textContent = 'API Connected';
        newAnnotationBtn.disabled = false;
        newAnnotationBtn.title = 'Create new annotation';
      } else {
        statusIndicator.className = 'status-indicator offline';
        statusText.textContent = 'API Offline';
        newAnnotationBtn.disabled = true; // Disable when server is offline
        newAnnotationBtn.title = 'MCP server is offline - cannot create annotations';
      }
      
      // Update existing annotation buttons based on server status
      this.updateAnnotationButtons();
    } catch (error) {
      console.error('Error checking MCP status:', error);
      
      const statusIndicator = document.querySelector('.status-indicator');
      const statusText = document.querySelector('.status-text');
      const newAnnotationBtn = document.getElementById('new-annotation-btn');
      
      this.serverOnline = false;
      statusIndicator.className = 'status-indicator offline';
      statusText.textContent = 'API Error';
      newAnnotationBtn.disabled = true; // Disable when server has errors
      newAnnotationBtn.title = 'MCP server error - cannot create annotations';
      
      // Update existing annotation buttons
      this.updateAnnotationButtons();
    }
  }

  updateAnnotationButtons() {
    // Disable/enable edit and delete buttons based on server status
    document.querySelectorAll('.edit-btn, .delete-btn').forEach(btn => {
      btn.disabled = !this.serverOnline;
      if (!this.serverOnline) {
        btn.title = 'MCP server is offline';
        btn.style.opacity = '0.5';
        btn.style.cursor = 'not-allowed';
      } else {
        btn.title = btn.classList.contains('edit-btn') ? 'Edit' : 'Delete';
        btn.style.opacity = '';
        btn.style.cursor = '';
      }
    });
  }

  // Utility functions
  isLocalhostUrl(url) {
    try {
      const urlObj = new URL(url);
      return urlObj.hostname === 'localhost' || 
             urlObj.hostname === '127.0.0.1' || 
             urlObj.hostname === '0.0.0.0';
    } catch {
      return false;
    }
  }

  getUrlDisplay(url) {
    try {
      const urlObj = new URL(url);
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
        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
          <rect x="6" y="6" width="12" height="12"></rect>
        </svg>
        Stop Annotating
      `;
      newAnnotationBtn.title = 'Stop annotation mode';
    } else {
      newAnnotationBtn.innerHTML = `
        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
          <line x1="12" y1="5" x2="12" y2="19"></line>
          <line x1="5" y1="12" x2="19" y2="12"></line>
        </svg>
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
}

// Initialize popup when DOM is loaded
document.addEventListener('DOMContentLoaded', () => {
  new AnnotationsPopup();
});

// Listen for storage changes to update UI in real-time
chrome.storage.onChanged.addListener((changes, namespace) => {
  if (namespace === 'local' && changes.annotations) {
    // Reload and re-render annotations
    window.location.reload();
  }
});