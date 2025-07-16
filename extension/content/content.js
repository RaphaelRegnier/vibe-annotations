// Claude Annotations Content Script

class ClaudeAnnotations {
  constructor() {
    this.isAnnotationMode = false;
    this.annotations = [];
    this.currentTooltip = null;
    this.hoveredElement = null;
    this.init();
  }

  async init() {
    console.log('Claude Annotations content script initialized on:', window.location.href);
    
    // Load existing annotations
    await this.loadAnnotations();
    
    // Set up message listener
    this.setupMessageListener();
    
    // Set up global event listeners
    this.setupGlobalListeners();
    
    // Wait for React hydration to complete before showing annotations
    this.waitForHydrationAndShowAnnotations();
    
    // Set up DOM observer for dynamic content
    this.setupDOMObserver();
    
    console.log('Claude Annotations content script setup complete');
  }

  async loadAnnotations() {
    try {
      const result = await chrome.storage.local.get(['annotations']);
      const allAnnotations = result.annotations || [];
      
      // Filter annotations for current URL
      this.annotations = allAnnotations.filter(annotation => 
        annotation.url === window.location.href
      );
      
      console.log(`Loaded ${this.annotations.length} annotations for current page`);
    } catch (error) {
      console.error('Error loading annotations:', error);
      this.annotations = [];
    }
  }

  setupMessageListener() {
    console.log('Setting up message listener for content script');
    
    chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
      console.log('Content script received message:', request);
      
      switch (request.action) {
        case 'startAnnotationMode':
          console.log('Starting annotation mode from message');
          this.startAnnotationMode();
          sendResponse({ success: true, message: 'Annotation mode started' });
          break;

        case 'stopAnnotationMode':
          console.log('Stopping annotation mode from message');
          this.stopAnnotationMode();
          sendResponse({ success: true, message: 'Annotation mode stopped' });
          break;

        case 'getAnnotationModeStatus':
          console.log('Getting annotation mode status');
          sendResponse({ success: true, isAnnotationMode: this.isAnnotationMode });
          break;
          
        case 'highlightAnnotation':
          console.log('Highlighting annotation from message');
          this.highlightAnnotation(request.annotation);
          sendResponse({ success: true, message: 'Annotation highlighted' });
          break;
          
          
        default:
          console.log('Unknown action received:', request.action);
          sendResponse({ success: false, error: 'Unknown action' });
      }
      
      return true; // Keep the message channel open for async response
    });
  }

  setupGlobalListeners() {
    // Listen for storage changes to update annotations
    chrome.storage.onChanged.addListener((changes, namespace) => {
      if (namespace === 'local' && changes.annotations) {
        this.loadAnnotations().then(() => {
          this.showExistingAnnotations();
        });
      }
    });

    // ESC key to exit annotation mode
    document.addEventListener('keydown', (e) => {
      if (e.key === 'Escape' && this.isAnnotationMode) {
        this.stopAnnotationMode();
      }
    });
  }

  startAnnotationMode() {
    console.log('Starting annotation mode');
    this.isAnnotationMode = true;
    
    // Add visual indicator
    document.body.classList.add('claude-annotation-mode-active');
    console.log('Added annotation mode class to body');
    
    // Set up event listeners
    this.setupAnnotationListeners();
    console.log('Annotation listeners set up');
    
    // Show instruction overlay
    this.showInspectionModeOverlay();
  }

  showInspectionModeOverlay() {
    // Create overlay with instructions
    const overlay = document.createElement('div');
    overlay.className = 'claude-inspection-overlay';
    overlay.innerHTML = `
      <div class="claude-inspection-content">
        <p>Press ESC or click the extension to exit inspection.</p>
      </div>
    `;
    
    document.body.appendChild(overlay);
    
    // Auto-hide after 3 seconds
    setTimeout(() => {
      overlay.classList.add('claude-inspection-overlay-fade');
      setTimeout(() => {
        if (overlay.parentNode) {
          overlay.remove();
        }
      }, 300);
    }, 3000);
  }

  removeInspectionModeOverlay() {
    const overlay = document.querySelector('.claude-inspection-overlay');
    if (overlay) {
      overlay.remove();
    }
  }

  stopAnnotationMode() {
    console.log('Stopping annotation mode');
    this.isAnnotationMode = false;
    
    // Remove visual indicators
    document.body.classList.remove('claude-annotation-mode-active');
    this.removeInspectionModeOverlay();
    
    // Remove event listeners
    this.removeAnnotationListeners();
    
    // Clear highlights
    this.clearHighlights();
    
    // Clean up any body-positioned badges
    this.clearAllBadges();
  }

  tempDisableAnnotationMode() {
    console.log('Temporarily disabling annotation mode for modal');
    
    // Remove visual indicators but keep isAnnotationMode true
    document.body.classList.remove('claude-annotation-mode-active');
    
    // Remove event listeners temporarily - this is crucial for modal interactions
    this.removeAnnotationListeners();
    
    // Clear highlights
    this.clearHighlights();
  }

  reEnableAnnotationMode() {
    console.log('Re-enabling annotation mode after modal close');
    
    if (this.isAnnotationMode) {
      // Re-add visual indicators
      document.body.classList.add('claude-annotation-mode-active');
      
      // Re-setup event listeners
      this.setupAnnotationListeners();
    }
  }

  setupAnnotationListeners() {
    // Store bound functions for proper removal
    this.boundMouseOver = this.handleMouseOver.bind(this);
    this.boundMouseOut = this.handleMouseOut.bind(this);
    this.boundClick = this.handleClick.bind(this);
    
    // Mouse events for element selection
    document.addEventListener('mouseover', this.boundMouseOver, true);
    document.addEventListener('mouseout', this.boundMouseOut, true);
    document.addEventListener('click', this.boundClick, true);
  }

  removeAnnotationListeners() {
    if (this.boundMouseOver) {
      document.removeEventListener('mouseover', this.boundMouseOver, true);
    }
    if (this.boundMouseOut) {
      document.removeEventListener('mouseout', this.boundMouseOut, true);
    }
    if (this.boundClick) {
      document.removeEventListener('click', this.boundClick, true);
    }
  }

  handleMouseOver(e) {
    if (!this.isAnnotationMode) return;
    
    e.preventDefault();
    e.stopPropagation();
    
    // Skip Claude annotation elements
    if (e.target.closest('.claude-comment-modal') || 
        e.target.classList.contains('claude-annotation-highlight')) {
      return;
    }
    
    this.hoveredElement = e.target;
    this.highlightElement(e.target);
  }

  handleMouseOut(e) {
    if (!this.isAnnotationMode) return;
    
    e.preventDefault();
    e.stopPropagation();
    
    this.hoveredElement = null;
    this.clearHighlights();
  }

  handleClick(e) {
    console.log('Click detected, annotation mode:', this.isAnnotationMode);
    
    if (!this.isAnnotationMode) return;
    
    e.preventDefault();
    e.stopPropagation();
    
    console.log('Click prevented, target:', e.target);
    
    // Skip Claude annotation elements and modal buttons
    if (e.target.closest('.claude-comment-modal') || 
        e.target.classList.contains('claude-btn') ||
        e.target.closest('.claude-btn')) {
      console.log('Skipping click on modal element or button');
      return;
    }
    
    console.log('Creating annotation for element:', e.target);
    this.createAnnotation(e.target);
  }

  highlightElement(element) {
    this.clearHighlights();
    element.classList.add('claude-annotation-highlight');
  }

  clearHighlights() {
    document.querySelectorAll('.claude-annotation-highlight').forEach(el => {
      el.classList.remove('claude-annotation-highlight');
    });
  }

  showModeIndicator() {
    // Create a floating indicator
    const indicator = document.createElement('div');
    indicator.id = 'claude-mode-indicator';
    indicator.innerHTML = `
      <div style="
        position: fixed;
        top: 20px;
        right: 20px;
        background: #2563eb;
        color: white;
        padding: 12px 16px;
        border-radius: 8px;
        font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
        font-size: 14px;
        font-weight: 500;
        z-index: 2147483646;
        box-shadow: 0 4px 12px rgba(0, 0, 0, 0.15);
        animation: claude-fade-in 0.2s ease;
      ">
        Click on any element to add a comment
        <div style="font-size: 12px; opacity: 0.8; margin-top: 4px;">
          Press ESC to exit
        </div>
      </div>
    `;
    document.body.appendChild(indicator);
  }

  removeModeIndicator() {
    const indicator = document.getElementById('claude-mode-indicator');
    if (indicator) {
      indicator.remove();
    }
  }

  async createAnnotation(element) {
    console.log('Creating annotation for element:', element);
    
    // Temporarily disable annotation mode while modal is open
    this.tempDisableAnnotationMode();
    
    // Generate element context
    const context = this.generateElementContext(element);
    
    // Show comment modal
    this.showCommentModal(element, context);
  }

  generateElementContext(element) {
    // Generate CSS selector
    const selector = this.generateSelector(element);
    
    // Get element styles
    const computedStyle = window.getComputedStyle(element);
    const relevantStyles = {
      display: computedStyle.display,
      position: computedStyle.position,
      fontSize: computedStyle.fontSize,
      color: computedStyle.color,
      backgroundColor: computedStyle.backgroundColor,
      margin: computedStyle.margin,
      padding: computedStyle.padding
    };
    
    // Get element position
    const rect = element.getBoundingClientRect();
    const position = {
      x: rect.left + window.scrollX,
      y: rect.top + window.scrollY,
      width: rect.width,
      height: rect.height
    };
    
    // Get viewport dimensions
    const viewport = {
      width: window.innerWidth,
      height: window.innerHeight
    };
    
    return {
      selector,
      tag: element.tagName.toLowerCase(),
      classes: Array.from(element.classList),
      text: element.textContent.substring(0, 100).trim(),
      styles: relevantStyles,
      position,
      viewport
    };
  }

  generateSelector(element) {
    // Start with the most specific selectors and work up
    
    // 1. Try ID first (most specific)
    if (element.id) {
      const escapedId = CSS.escape(element.id);
      return `#${escapedId}`;
    }
    
    // 2. Try to find unique attribute combinations
    const uniqueSelector = this.findUniqueAttributeSelector(element);
    if (uniqueSelector) {
      return uniqueSelector;
    }
    
    // 3. Try text content for buttons and links (more stable)
    const textSelector = this.generateTextBasedSelector(element);
    if (textSelector && this.isUnique(textSelector)) {
      return textSelector;
    }
    
    // 4. Try class-based selector with uniqueness checking
    const classSelector = this.generateClassSelector(element);
    if (classSelector && this.isUnique(classSelector)) {
      return classSelector;
    }
    
    // 5. Try with limited parent context (avoid too deep nesting)
    const contextSelector = this.generateLimitedContextSelector(element);
    if (contextSelector && this.isUnique(contextSelector)) {
      return contextSelector;
    }
    
    // 6. Try multiple fallback strategies
    const fallbackSelector = this.generateFallbackSelector(element);
    if (fallbackSelector && this.isUnique(fallbackSelector)) {
      return fallbackSelector;
    }
    
    // 7. Try robust path-based selector for deeply nested elements
    const pathSelector = this.generateRobustPathSelector(element);
    if (pathSelector && this.isUnique(pathSelector)) {
      return pathSelector;
    }
    
    // 8. Last resort: use data attribute
    return this.generateDataAttributeSelector(element);
  }
  
  findUniqueAttributeSelector(element) {
    // Check for unique attributes like aria-label, title, data-*, etc.
    const uniqueAttributes = ['aria-label', 'title', 'data-testid', 'data-test', 'role'];
    
    for (const attr of uniqueAttributes) {
      const value = element.getAttribute(attr);
      if (value) {
        const selector = `${element.tagName.toLowerCase()}[${attr}="${CSS.escape(value)}"]`;
        if (this.isUnique(selector)) {
          return selector;
        }
      }
    }
    
    return null;
  }
  
  generateClassSelector(element) {
    if (!element.className) return null;
    
    const classes = Array.from(element.classList)
      .filter(cls => !cls.startsWith('claude-'))
      .filter(cls => this.isStableClass(cls))
      .slice(0, 4); // Use more classes for better specificity
    
    if (classes.length === 0) return null;
    
    const escapedClasses = classes.map(cls => CSS.escape(cls)).join('.');
    return `${element.tagName.toLowerCase()}.${escapedClasses}`;
  }
  
  generateLimitedContextSelector(element) {
    const classSelector = this.generateClassSelector(element);
    if (!classSelector) return null;
    
    // Add parent context for more specificity, but limit depth
    const parent = element.parentElement;
    if (parent && parent.tagName !== 'BODY') {
      const parentClasses = Array.from(parent.classList)
        .filter(cls => !cls.startsWith('claude-'))
        .filter(cls => this.isStableClass(cls))
        .slice(0, 2);
      
      if (parentClasses.length > 0) {
        const parentSelector = parentClasses.map(cls => CSS.escape(cls)).join('.');
        return `${parent.tagName.toLowerCase()}.${parentSelector} > ${classSelector}`;
      }
    }
    
    return null;
  }

  generateRobustPathSelector(element) {
    // Generate a path-based selector that's more robust for deeply nested elements
    const path = [];
    let current = element;
    let depth = 0;
    const maxDepth = 4; // Limit depth to avoid overly specific selectors
    
    while (current && current.tagName !== 'BODY' && depth < maxDepth) {
      const tag = current.tagName.toLowerCase();
      
      // Try to find a meaningful identifier for this level
      let identifier = tag;
      
      // 1. Check for stable classes
      const stableClasses = Array.from(current.classList)
        .filter(cls => !cls.startsWith('claude-'))
        .filter(cls => this.isStableClass(cls))
        .slice(0, 2);
      
      if (stableClasses.length > 0) {
        identifier = `${tag}.${stableClasses.map(cls => CSS.escape(cls)).join('.')}`;
      }
      // 2. Check for unique attributes
      else if (current.id) {
        identifier = `${tag}#${CSS.escape(current.id)}`;
      }
      else if (current.getAttribute('role')) {
        identifier = `${tag}[role="${current.getAttribute('role')}"]`;
      }
      // 3. Use nth-of-type for position if no classes/attributes
      else {
        const siblings = Array.from(current.parentElement?.children || []);
        const sameTagSiblings = siblings.filter(sibling => 
          sibling.tagName.toLowerCase() === tag
        );
        
        if (sameTagSiblings.length > 1) {
          const index = sameTagSiblings.indexOf(current) + 1;
          identifier = `${tag}:nth-of-type(${index})`;
        }
      }
      
      path.unshift(identifier);
      current = current.parentElement;
      depth++;
    }
    
    // Build selector with limited depth
    if (path.length > 0) {
      return path.join(' > ');
    }
    
    return null;
  }
  
  generateTextBasedSelector(element) {
    const text = element.textContent?.trim();
    if (!text || text.length > 100) return null;
    
    // For buttons and links, text content is often stable
    const tag = element.tagName.toLowerCase();
    if (['button', 'a', 'span', 'div'].includes(tag)) {
      // Try to find by text content combined with tag
      const textSanitized = text.replace(/[^\w\s]/g, '').trim();
      if (textSanitized.length > 0 && textSanitized.length < 50) {
        // Use a more robust approach - find by text content
        const candidates = Array.from(document.querySelectorAll(tag));
        const matches = candidates.filter(el => 
          el.textContent?.trim().replace(/[^\w\s]/g, '').trim() === textSanitized
        );
        
        if (matches.length === 1) {
          // Create a selector that finds elements by text content
          return `${tag}[data-text-content="${CSS.escape(textSanitized)}"]`;
        }
      }
    }
    
    return null;
  }

  generateFallbackSelector(element) {
    // Try combining tag + attributes + position
    const tag = element.tagName.toLowerCase();
    const parent = element.parentElement;
    
    if (parent) {
      const siblings = Array.from(parent.children);
      const sameTagSiblings = siblings.filter(el => el.tagName.toLowerCase() === tag);
      const index = sameTagSiblings.indexOf(element) + 1;
      
      // Try to get some identifying attributes
      const attributes = [];
      if (element.type) attributes.push(`[type="${element.type}"]`);
      if (element.role) attributes.push(`[role="${element.role}"]`);
      
      const attrString = attributes.join('');
      
      // Build selector with parent context
      const parentTag = parent.tagName.toLowerCase();
      return `${parentTag} > ${tag}${attrString}:nth-of-type(${index})`;
    }
    
    return null;
  }

  generateDataAttributeSelector(element) {
    // Last resort: add a data attribute to the element
    const dataId = `claude-annotation-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
    element.setAttribute('data-claude-id', dataId);
    return `[data-claude-id="${dataId}"]`;
  }

  generatePositionSelector(element) {
    // Use text content for better identification if available
    const text = element.textContent?.trim();
    if (text && text.length > 0 && text.length < 50) {
      // Try to find by text content
      const textSelector = `${element.tagName.toLowerCase()}:contains("${text}")`;
      // Note: :contains is not standard CSS, so we'll use a different approach
    }
    
    // Fall back to nth-child with parent context
    const parent = element.parentElement;
    if (parent) {
      const siblings = Array.from(parent.children);
      const index = siblings.indexOf(element) + 1;
      
      // Add parent context for better stability
      const parentClasses = Array.from(parent.classList)
        .filter(cls => !cls.startsWith('claude-'))
        .filter(cls => this.isStableClass(cls))
        .slice(0, 2);
      
      if (parentClasses.length > 0) {
        const parentSelector = parentClasses.map(cls => CSS.escape(cls)).join('.');
        return `${parent.tagName.toLowerCase()}.${parentSelector} > ${element.tagName.toLowerCase()}:nth-child(${index})`;
      }
      
      return `${element.tagName.toLowerCase()}:nth-child(${index})`;
    }
    
    return element.tagName.toLowerCase();
  }
  
  isStableClass(className) {
    // Filter out utility classes that might change and framework-specific classes
    const unstablePatterns = [
      /^hover:/, /^focus:/, /^active:/, /^disabled:/, // Tailwind state classes
      /^transition/, /^duration/, /^ease/, // Animation classes
      /^[a-z0-9]{8,}$/, // Hash-like classes (CSS modules, etc.)
      /--/, // CSS custom properties in class names
      /\[.*\]/, // Tailwind arbitrary values
    ];
    
    return !unstablePatterns.some(pattern => pattern.test(className));
  }
  
  isUnique(selector) {
    try {
      const matches = document.querySelectorAll(selector);
      return matches.length === 1;
    } catch (e) {
      return false;
    }
  }

  isValidCSSClass(className) {
    // Filter out classes with brackets, parentheses, or other problematic characters
    // Keep only alphanumeric, hyphens, underscores, and basic characters
    return /^[a-zA-Z0-9_-]+$/.test(className);
  }

  async showEditModal(element, context, annotation) {
    // Check API status first
    const apiStatus = await this.checkAPIStatus();
    
    // Create modal for editing
    const modal = document.createElement('div');
    modal.className = 'claude-comment-modal';
    modal.innerHTML = `
      <div class="claude-comment-modal-content">
        <div class="claude-comment-modal-header">
          <h3 class="claude-comment-modal-title">Edit Annotation</h3>
          <button class="claude-comment-modal-close">
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
              <line x1="18" y1="6" x2="6" y2="18"></line>
              <line x1="6" y1="6" x2="18" y2="18"></line>
            </svg>
          </button>
        </div>
        
        ${!apiStatus.connected ? `
          <div class="claude-api-status-warning">
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
              <path d="M10.29 3.86L1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0z"></path>
              <line x1="12" y1="9" x2="12" y2="13"></line>
              <line x1="12" y1="17" x2="12.01" y2="17"></line>
            </svg>
            <span>MCP server is offline - annotation cannot be edited or deleted</span>
          </div>
        ` : ''}
        
        <div class="claude-element-preview">
          <div class="claude-element-info">
            <strong>Element:</strong> ${context.tag}${context.classes.length ? '.' + context.classes.join('.') : ''}
          </div>
          <div class="claude-element-selector">${context.selector}</div>
        </div>
        
        <div class="claude-viewport-info">
          <span><strong>Viewport:</strong> ${context.viewport.width}x${context.viewport.height}</span>
          <span><strong>Position:</strong> ${Math.round(context.position.x)}, ${Math.round(context.position.y)}</span>
          <span><strong>Size:</strong> ${Math.round(context.position.width)}x${Math.round(context.position.height)}</span>
        </div>
        
        <textarea 
          class="claude-comment-textarea" 
          placeholder="Describe what needs to be changed or improved..."
          maxlength="1000"
        >${annotation.comment}</textarea>
        
        <div class="claude-comment-actions">
          <button class="claude-btn claude-btn-secondary" id="cancel-comment">Cancel</button>
          <button class="claude-btn claude-btn-primary" id="save-comment" disabled>Save Changes</button>
        </div>
      </div>
    `;
    
    document.body.appendChild(modal);
    
    // Set up modal event listeners for edit mode
    this.setupEditModalListeners(modal, element, context, annotation);
    
    // Focus textarea and select all text
    const textarea = modal.querySelector('.claude-comment-textarea');
    textarea.focus();
    textarea.select();
  }

  async showCommentModal(element, context) {
    // Check API status first
    const apiStatus = await this.checkAPIStatus();
    
    // Create modal
    const modal = document.createElement('div');
    modal.className = 'claude-comment-modal';
    modal.innerHTML = `
      <div class="claude-comment-modal-content">
        <div class="claude-comment-modal-header">
          <h3 class="claude-comment-modal-title">Add Annotation</h3>
          <button class="claude-comment-modal-close">
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
              <line x1="18" y1="6" x2="6" y2="18"></line>
              <line x1="6" y1="6" x2="18" y2="18"></line>
            </svg>
          </button>
        </div>
        
        ${!apiStatus.connected ? `
          <div class="claude-api-status-warning">
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
              <path d="M10.29 3.86L1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0z"></path>
              <line x1="12" y1="9" x2="12" y2="13"></line>
              <line x1="12" y1="17" x2="12.01" y2="17"></line>
            </svg>
            <span>MCP server is offline - annotation cannot be edited or deleted</span>
          </div>
        ` : ''}
        
        <div class="claude-element-preview">
          <div class="claude-element-info">
            <strong>Element:</strong> ${context.tag}${context.classes.length ? '.' + context.classes.join('.') : ''}
          </div>
          <div class="claude-element-selector">${context.selector}</div>
        </div>
        
        <div class="claude-viewport-info">
          <span><strong>Viewport:</strong> ${context.viewport.width}x${context.viewport.height}</span>
          <span><strong>Position:</strong> ${Math.round(context.position.x)}, ${Math.round(context.position.y)}</span>
          <span><strong>Size:</strong> ${Math.round(context.position.width)}x${Math.round(context.position.height)}</span>
        </div>
        
        <textarea 
          class="claude-comment-textarea" 
          placeholder="Describe what needs to be changed or improved..."
          maxlength="1000"
        ></textarea>
        
        <div class="claude-comment-actions">
          <button class="claude-btn claude-btn-secondary" id="cancel-comment">Cancel</button>
          <button class="claude-btn claude-btn-primary" id="save-comment" disabled>Save Annotation</button>
        </div>
      </div>
    `;
    
    document.body.appendChild(modal);
    
    // Set up modal event listeners
    this.setupModalListeners(modal, element, context);
    
    // Focus textarea
    const textarea = modal.querySelector('.claude-comment-textarea');
    textarea.focus();
  }

  async checkAPIStatus() {
    try {
      const response = await fetch('http://localhost:3846/health', {
        method: 'GET',
        signal: AbortSignal.timeout(2000) // 2 second timeout
      });
      
      if (response.ok) {
        return { connected: true };
      } else {
        return { connected: false, error: `Server returned ${response.status}` };
      }
    } catch (error) {
      return { connected: false, error: error.message };
    }
  }

  setupEditModalListeners(modal, element, context, annotation) {
    const textarea = modal.querySelector('.claude-comment-textarea');
    const cancelBtn = modal.querySelector('#cancel-comment');
    const saveBtn = modal.querySelector('#save-comment');
    const closeBtn = modal.querySelector('.claude-comment-modal-close');
    
    // Enable/disable save button based on textarea content and API status
    const updateSaveButton = async () => {
      const hasText = textarea.value.trim().length > 0;
      const hasChanges = textarea.value.trim() !== annotation.comment;
      const apiStatus = await this.checkAPIStatus();
      
      // Disable if no text, no changes, or server offline
      saveBtn.disabled = !hasText || !hasChanges || !apiStatus.connected;
      
      // Update button text based on server status
      if (!apiStatus.connected) {
        saveBtn.textContent = 'Server Offline';
      } else {
        saveBtn.textContent = 'Save Changes';
      }
    };
    
    textarea.addEventListener('input', updateSaveButton);
    
    // Initial update
    updateSaveButton();
    
    // Cancel/close handlers
    const closeModal = () => {
      if (modal.parentNode) {
        modal.remove();
        // Re-enable annotation mode when modal closes
        this.reEnableAnnotationMode();
      }
    };
    
    cancelBtn.addEventListener('click', closeModal);
    closeBtn.addEventListener('click', closeModal);
    
    // Click outside to close
    modal.addEventListener('click', (e) => {
      if (e.target === modal) {
        closeModal();
      }
    });
    
    // ESC to close
    document.addEventListener('keydown', function escHandler(e) {
      if (e.key === 'Escape') {
        closeModal();
        document.removeEventListener('keydown', escHandler);
      }
    });
    
    // Save handler for edit mode
    saveBtn.addEventListener('click', async () => {
      const newComment = textarea.value.trim();
      if (newComment && newComment !== annotation.comment) {
        // Check API status before saving
        const apiStatus = await this.checkAPIStatus();
        
        if (!apiStatus.connected) {
          // Server is offline, still save but show warning
          console.log('Server offline, saving annotation edit locally only');
        }
        
        await this.updateAnnotation(annotation, newComment);
        closeModal();
        
        // Re-enable annotation mode for continuous inspection
        console.log('Annotation updated, re-enabling inspection mode');
      }
    });
  }

  setupModalListeners(modal, element, context) {
    const textarea = modal.querySelector('.claude-comment-textarea');
    const cancelBtn = modal.querySelector('#cancel-comment');
    const saveBtn = modal.querySelector('#save-comment');
    const closeBtn = modal.querySelector('.claude-comment-modal-close');
    
    // Enable/disable save button based on textarea content and API status
    const updateSaveButton = async () => {
      const hasText = textarea.value.trim().length > 0;
      const apiStatus = await this.checkAPIStatus();
      
      // Disable if no text or server offline
      saveBtn.disabled = !hasText || !apiStatus.connected;
      
      // Update button text based on server status
      if (!apiStatus.connected) {
        saveBtn.textContent = 'Server Offline';
      } else {
        saveBtn.textContent = 'Save Annotation';
      }
    };
    
    textarea.addEventListener('input', updateSaveButton);
    
    // Initial update
    updateSaveButton();
    
    // Cancel/close handlers
    const closeModal = () => {
      if (modal.parentNode) {
        modal.remove();
        // Re-enable annotation mode when modal closes
        this.reEnableAnnotationMode();
      }
    };
    
    cancelBtn.addEventListener('click', closeModal);
    closeBtn.addEventListener('click', closeModal);
    
    // Click outside to close
    modal.addEventListener('click', (e) => {
      if (e.target === modal) {
        closeModal();
      }
    });
    
    // ESC to close
    document.addEventListener('keydown', function escHandler(e) {
      if (e.key === 'Escape') {
        closeModal();
        document.removeEventListener('keydown', escHandler);
      }
    });
    
    // Save handler
    saveBtn.addEventListener('click', async () => {
      const comment = textarea.value.trim();
      if (comment) {
        // Check API status before saving
        const apiStatus = await this.checkAPIStatus();
        
        if (!apiStatus.connected) {
          // Server is offline, still save but show warning
          console.log('Server offline, saving annotation locally only');
        }
        
        await this.saveAnnotation(element, context, comment);
        closeModal();
        
        // Re-enable annotation mode for continuous inspection
        // User stays in inspection mode until ESC or extension button
        console.log('Annotation saved, re-enabling inspection mode');
      }
    });
  }

  async updateAnnotation(annotation, newComment) {
    try {
      // Update the annotation in storage
      const result = await chrome.storage.local.get(['annotations']);
      const allAnnotations = result.annotations || [];
      
      // Find and update the annotation
      const index = allAnnotations.findIndex(a => a.id === annotation.id);
      if (index !== -1) {
        allAnnotations[index].comment = newComment;
        allAnnotations[index].updated_at = new Date().toISOString();
        
        // Save back to storage
        await chrome.storage.local.set({ annotations: allAnnotations });
        
        console.log('Annotation updated:', allAnnotations[index]);
        
        // Update local array
        const localIndex = this.annotations.findIndex(a => a.id === annotation.id);
        if (localIndex !== -1) {
          this.annotations[localIndex] = allAnnotations[index];
        }
        
        // Update the tooltip content
        const element = document.querySelector(annotation.selector);
        if (element) {
          const badge = element.querySelector('.claude-annotation-badge');
          if (badge) {
            const tooltip = badge.querySelector('.claude-pin-tooltip');
            if (tooltip) {
              tooltip.textContent = newComment;
            }
          }
        }
      }
    } catch (error) {
      console.error('Error updating annotation:', error);
      alert('Error updating annotation. Please try again.');
    }
  }

  async saveAnnotation(element, context, comment) {
    try {
      // Validate selector works correctly
      const testElement = document.querySelector(context.selector);
      if (testElement !== element) {
        console.warn('Generated selector does not match original element:', context.selector);
        console.warn('Original element:', element);
        console.warn('Found element:', testElement);
        
        // Regenerate selector and update context
        const newSelector = this.generateSelector(element);
        context.selector = newSelector;
        console.log('Regenerated selector:', newSelector);
        
        // Test again
        const newTestElement = document.querySelector(newSelector);
        if (newTestElement !== element) {
          console.error('Even regenerated selector fails. Using fallback approach.');
          // Add data attribute as fallback
          const dataId = `claude-annotation-${Date.now()}`;
          element.setAttribute('data-claude-id', dataId);
          context.selector = `[data-claude-id="${dataId}"]`;
        }
      }
      
      const annotation = {
        id: this.generateId(),
        url: window.location.href,
        selector: context.selector,
        comment: comment,
        viewport: context.viewport,
        element_context: {
          tag: context.tag,
          classes: context.classes,
          text: context.text,
          styles: context.styles,
          position: context.position
        },
        status: 'pending',
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString()
      };
      
      // Get existing annotations from storage
      const result = await chrome.storage.local.get(['annotations']);
      const allAnnotations = result.annotations || [];
      
      // Add new annotation
      allAnnotations.push(annotation);
      
      // Save back to storage
      await chrome.storage.local.set({ annotations: allAnnotations });
      
      console.log('Annotation saved:', annotation);
      
      // Add to local array
      this.annotations.push(annotation);
      
      // Show visual indicator on element with correct index
      const sortedAnnotations = [...this.annotations].sort((a, b) => 
        new Date(a.created_at) - new Date(b.created_at)
      );
      const index = sortedAnnotations.findIndex(a => a.id === annotation.id) + 1;
      this.addAnnotationBadge(element, annotation, index);
      
    } catch (error) {
      console.error('Error saving annotation:', error);
      alert('Error saving annotation. Please try again.');
    }
  }

  showExistingAnnotations() {
    // Clear existing badges and their cleanup functions
    this.clearAllBadges();
    
    let foundCount = 0;
    
    // Sort annotations by creation date to get consistent indexing
    const sortedAnnotations = [...this.annotations].sort((a, b) => 
      new Date(a.created_at) - new Date(b.created_at)
    );
    
    // Add badges for existing annotations with index numbers
    sortedAnnotations.forEach((annotation, index) => {
      try {
        let element = this.findElementBySelector(annotation);
        if (element) {
          this.addAnnotationBadge(element, annotation, index + 1);
          foundCount++;
        } else {
          console.warn('Could not find element for annotation:', annotation.selector);
        }
      } catch (error) {
        console.warn('Error finding element for annotation:', annotation.selector, error);
      }
    });
    
    return foundCount;
  }

  clearAllBadges() {
    // Clear badges from both elements and body
    document.querySelectorAll('.claude-annotation-badge').forEach(badge => {
      // Call cleanup function if it exists (for badges positioned in body)
      if (badge.cleanup) {
        badge.cleanup();
      } else {
        badge.remove();
      }
    });
  }

  findElementBySelector(annotation) {
    // Try the original selector first
    let element = null;
    try {
      element = document.querySelector(annotation.selector);
      if (element) return element;
    } catch (error) {
      // Selector might be invalid, continue with fallbacks
    }
    
    // Try to find by text content if annotation has element context
    if (annotation.element_context && annotation.element_context.text) {
      const tag = annotation.element_context.tag;
      const text = annotation.element_context.text;
      
      if (tag && text) {
        const textSanitized = text.replace(/[^\w\s]/g, '').trim();
        const candidates = Array.from(document.querySelectorAll(tag));
        const matches = candidates.filter(el => {
          const elText = el.textContent?.trim().replace(/[^\w\s]/g, '').trim();
          return elText === textSanitized;
        });
        
        if (matches.length === 1) {
          element = matches[0];
          console.log(`Found element by text content: "${textSanitized}"`);
          return element;
        }
        
        if (matches.length > 1) {
          // Multiple matches, try to find by position or other attributes
          const contextClasses = annotation.element_context.classes || [];
          if (contextClasses.length > 0) {
            const bestMatch = matches.find(el => {
              const elClasses = Array.from(el.classList);
              return contextClasses.some(cls => elClasses.includes(cls));
            });
            if (bestMatch) {
              element = bestMatch;
              console.log(`Found element by text + class context: "${textSanitized}"`);
              return element;
            }
          }
          
          // Try to find by position if we have position data
          if (annotation.element_context.position) {
            const expectedPosition = annotation.element_context.position;
            const bestMatch = matches.find(el => {
              const rect = el.getBoundingClientRect();
              const position = {
                x: rect.left + window.scrollX,
                y: rect.top + window.scrollY
              };
              
              // Allow some tolerance for position matching
              const tolerance = 50;
              return Math.abs(position.x - expectedPosition.x) < tolerance &&
                     Math.abs(position.y - expectedPosition.y) < tolerance;
            });
            
            if (bestMatch) {
              element = bestMatch;
              console.log(`Found element by text + position context: "${textSanitized}"`);
              return element;
            }
          }
        }
      }
    }
    
    // Try to find by classes if available
    if (annotation.element_context && annotation.element_context.classes) {
      const tag = annotation.element_context.tag;
      const classes = annotation.element_context.classes;
      
      if (tag && classes.length > 0) {
        // Try with stable classes only
        const stableClasses = classes.filter(cls => this.isStableClass(cls));
        if (stableClasses.length > 0) {
          const classSelector = stableClasses.map(cls => CSS.escape(cls)).join('.');
          const selector = `${tag}.${classSelector}`;
          
          try {
            const candidates = Array.from(document.querySelectorAll(selector));
            if (candidates.length === 1) {
              element = candidates[0];
              console.log(`Found element by stable classes: ${selector}`);
              return element;
            }
          } catch (error) {
            // Continue with other methods
          }
        }
      }
    }
    
    // Try to find by data attribute if it exists
    if (annotation.selector.includes('data-claude-id')) {
      const dataIdMatch = annotation.selector.match(/data-claude-id="([^"]+)"/);
      if (dataIdMatch) {
        element = document.querySelector(`[data-claude-id="${dataIdMatch[1]}"]`);
        if (element) {
          console.log(`Found element by data attribute: ${dataIdMatch[1]}`);
          return element;
        }
      }
    }
    
    return null;
  }

  waitForHydrationAndShowAnnotations() {
    // Wait for framework hydration/initialization to complete
    // This prevents hydration mismatch errors in SSR frameworks (React, Vue, Svelte, etc.)
    
    const checkForStability = () => {
      // Strategy: Wait for DOM stability rather than framework-specific signals
      
      // 1. Check if document is fully loaded
      if (document.readyState === 'complete') {
        console.log('Document complete, waiting for framework stability...');
        this.waitForDOMStability();
        return;
      }
      
      // 2. Wait for load event if not complete
      window.addEventListener('load', () => {
        console.log('Window loaded, waiting for framework stability...');
        this.waitForDOMStability();
      }, { once: true });
    };
    
    checkForStability();
    
    // Fallback timeout for edge cases
    setTimeout(() => {
      console.log('Fallback: showing annotations after extended timeout');
      this.showExistingAnnotationsWithRetry();
    }, 8000);
  }

  waitForDOMStability() {
    // Wait for DOM to stabilize after framework hydration/initialization
    let stabilityTimer;
    let mutationCount = 0;
    const maxMutations = 10;
    const stabilityDelay = 1500; // Wait for 1.5s of stability
    
    const observer = new MutationObserver(() => {
      mutationCount++;
      
      // Reset stability timer on each mutation
      clearTimeout(stabilityTimer);
      
      // If too many mutations, just proceed (heavily dynamic page)
      if (mutationCount > maxMutations) {
        console.log('High mutation count detected, proceeding with annotations...');
        observer.disconnect();
        setTimeout(() => this.showExistingAnnotationsWithRetry(), 500);
        return;
      }
      
      // Set new stability timer
      stabilityTimer = setTimeout(() => {
        console.log('DOM stable, showing annotations...');
        observer.disconnect();
        this.showExistingAnnotationsWithRetry();
      }, stabilityDelay);
    });
    
    // Start observing
    observer.observe(document.body, {
      childList: true,
      subtree: true,
      attributes: false // Don't care about attribute changes
    });
    
    // Trigger initial timer
    stabilityTimer = setTimeout(() => {
      console.log('Initial DOM stability timeout, showing annotations...');
      observer.disconnect();
      this.showExistingAnnotationsWithRetry();
    }, stabilityDelay);
  }

  showExistingAnnotationsWithRetry(maxAttempts = 5, delay = 500) {
    let attempts = 0;
    
    const tryShowAnnotations = () => {
      attempts++;
      console.log(`Attempting to show annotations (attempt ${attempts}/${maxAttempts})`);
      
      const foundElements = this.showExistingAnnotations();
      const expectedCount = this.annotations.length;
      const foundCount = foundElements;
      
      console.log(`Found ${foundCount}/${expectedCount} annotation elements`);
      
      // If we found all elements or reached max attempts, stop
      if (foundCount === expectedCount || attempts >= maxAttempts) {
        console.log(`Finished showing annotations after ${attempts} attempts`);
        return;
      }
      
      // Retry after delay
      setTimeout(tryShowAnnotations, delay);
    };
    
    tryShowAnnotations();
  }

  setupDOMObserver() {
    // Observe DOM changes to re-show annotations when content changes
    const observer = new MutationObserver((mutations) => {
      let shouldUpdate = false;
      
      mutations.forEach((mutation) => {
        // Only care about significant changes that might affect our annotations
        if (mutation.type === 'childList' && mutation.addedNodes.length > 0) {
          // Check if any added nodes are substantial (not just text nodes or small elements)
          const hasSubstantialChanges = Array.from(mutation.addedNodes).some(node => {
            return node.nodeType === Node.ELEMENT_NODE && 
                   node.children.length > 0; // Has child elements
          });
          
          if (hasSubstantialChanges) {
            shouldUpdate = true;
          }
        }
      });
      
      if (shouldUpdate) {
        // Debounce updates with longer delay
        clearTimeout(this.updateTimeout);
        this.updateTimeout = setTimeout(() => {
          // Only update if we have missing annotations
          const missingCount = this.annotations.length - document.querySelectorAll('.claude-annotation-badge').length;
          if (missingCount > 0) {
            console.log(`DOM changed, ${missingCount} annotations missing - re-showing annotations`);
            this.showExistingAnnotations();
          }
        }, 2000); // Increased debounce delay
      }
    });
    
    observer.observe(document.body, {
      childList: true,
      subtree: true
    });
    
    this.domObserver = observer;
  }

  addAnnotationBadge(element, annotation, index) {
    // Remove existing badge if any
    const existingBadge = element.querySelector('.claude-annotation-badge');
    if (existingBadge) {
      existingBadge.remove();
    }
    
    // Create badge
    const badge = document.createElement('div');
    badge.className = 'claude-annotation-badge';
    badge.textContent = index.toString(); // Show index number instead of emoji
    // No title to avoid default browser tooltip interfering
    
    // Add click handler to open edit modal
    badge.addEventListener('click', (e) => {
      e.stopPropagation();
      console.log('Annotation marker clicked, opening edit modal for annotation:', annotation.id);
      this.openEditModal(element, annotation);
    });
    
    // Create tooltip as child of badge
    const tooltip = document.createElement('div');
    tooltip.className = 'claude-pin-tooltip';
    tooltip.textContent = annotation.comment;
    badge.appendChild(tooltip);
    
    // Simple positioning - always position relative to body to avoid clipping issues
    this.positionBadgeOnBody(element, badge);
  }

  positionBadgeOnBody(element, badge) {
    // Get element's position relative to viewport
    const elementRect = element.getBoundingClientRect();
    
    // Position badge absolutely relative to body
    badge.style.position = 'fixed';
    badge.style.top = `${elementRect.top - 10}px`;
    badge.style.left = `${elementRect.left + elementRect.width / 2}px`;
    badge.style.transform = 'translateX(-50%)';
    badge.style.zIndex = '999999';
    
    // Add to body to avoid any parent clipping issues
    document.body.appendChild(badge);
    
    // Store reference to original element
    badge.dataset.originalElementId = this.generateElementId(element);
    
    // Update position on scroll/resize
    const updatePosition = () => {
      const newRect = element.getBoundingClientRect();
      badge.style.top = `${newRect.top - 10}px`;
      badge.style.left = `${newRect.left + newRect.width / 2}px`;
    };
    
    window.addEventListener('scroll', updatePosition, { passive: true });
    window.addEventListener('resize', updatePosition, { passive: true });
    
    // Store cleanup function
    badge.cleanup = () => {
      window.removeEventListener('scroll', updatePosition);
      window.removeEventListener('resize', updatePosition);
      badge.remove();
    };
  }

  generateElementId(element) {
    // Generate unique ID for element if it doesn't have one
    if (!element.dataset.claudeAnnotationId) {
      element.dataset.claudeAnnotationId = 'claude-element-' + Date.now() + '-' + Math.random().toString(36).substr(2, 9);
    }
    return element.dataset.claudeAnnotationId;
  }


  async openEditModal(element, annotation) {
    // Temporarily disable annotation mode while modal is open
    this.tempDisableAnnotationMode();
    
    // Generate fresh element context
    const context = this.generateElementContext(element);
    
    // Show comment modal in edit mode
    this.showEditModal(element, context, annotation);
  }

  openPopupWithAnnotation(annotationId) {
    // Store the annotation ID that should be focused when popup opens
    chrome.storage.local.set({ 
      focusedAnnotationId: annotationId 
    }, () => {
      // Send message to background script to open popup
      chrome.runtime.sendMessage({
        action: 'openPopupWithFocus',
        annotationId: annotationId
      });
    });
  }

  showPopupPrompt() {
    // Show a temporary prompt to click the extension icon
    const prompt = document.createElement('div');
    prompt.className = 'claude-popup-prompt';
    prompt.innerHTML = `
      <div class="claude-popup-prompt-content">
        <div class="claude-popup-prompt-icon">💬</div>
        <div class="claude-popup-prompt-text">Click the Claude Annotations extension to view this annotation</div>
      </div>
    `;
    
    document.body.appendChild(prompt);
    
    // Remove after 4 seconds
    setTimeout(() => {
      if (prompt.parentNode) {
        prompt.remove();
      }
    }, 4000);
    
    // Remove on click anywhere
    const removePrompt = () => {
      if (prompt.parentNode) {
        prompt.remove();
      }
      document.removeEventListener('click', removePrompt);
    };
    
    setTimeout(() => {
      document.addEventListener('click', removePrompt);
    }, 100);
  }

  highlightAnnotation(annotation) {
    try {
      const element = document.querySelector(annotation.selector);
      if (element) {
        // Scroll to element
        element.scrollIntoView({ behavior: 'smooth', block: 'center' });
        
        // Highlight temporarily
        element.style.outline = '3px solid var(--claude-orange)';
        element.style.outlineOffset = '2px';
        
        setTimeout(() => {
          element.style.outline = '';
          element.style.outlineOffset = '';
        }, 3000);
      }
    } catch (error) {
      console.error('Error highlighting annotation:', error);
    }
  }

  generateId() {
    return 'claude_' + Date.now() + '_' + Math.random().toString(36).substr(2, 9);
  }
}

// Initialize when DOM is ready
if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', () => {
    new ClaudeAnnotations();
  });
} else {
  new ClaudeAnnotations();
}