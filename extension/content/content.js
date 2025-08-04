// Vibe Annotations Content Script

class VibeAnnotations {
  constructor() {
    this.isAnnotationMode = false;
    this.annotations = [];
    this.currentTooltip = null;
    this.hoveredElement = null;
    this.init();
  }

  async init() {
    // Load existing annotations
    await this.loadAnnotations();
    
    // Set up theme
    await this.initTheme();
    
    // Inject font face with correct extension URL
    this.injectFontFace();
    
    // Set up message listener
    this.setupMessageListener();
    
    // Set up global event listeners
    this.setupGlobalListeners();
    
    // Wait for React hydration to complete before showing annotations
    this.waitForHydrationAndShowAnnotations();
    
    // Set up DOM observer for dynamic content
    this.setupDOMObserver();
    
  }

  async loadAnnotations() {
    try {
      const result = await chrome.storage.local.get(['annotations']);
      const allAnnotations = result.annotations || [];
      
      // Filter annotations for current URL
      this.annotations = allAnnotations.filter(annotation => 
        annotation.url === window.location.href
      );
      
    } catch (error) {
      console.error('Error loading annotations:', error);
      this.annotations = [];
    }
  }

  async initTheme() {
    try {
      // Load theme preference from extension storage
      const result = await chrome.storage.local.get(['themePreference']);
      const themePreference = result.themePreference || 'system';
      this.applyTheme(themePreference);
      
      // Listen for theme changes
      chrome.storage.onChanged.addListener((changes, namespace) => {
        if (namespace === 'local' && changes.themePreference) {
          this.applyTheme(changes.themePreference.newValue);
        }
      });
    } catch (error) {
      console.error('Error initializing theme:', error);
    }
  }

  applyTheme(themePreference) {
    // Store current theme for modal creation
    this.currentTheme = themePreference;
    
    // Apply theme variables to document root
    const effectiveTheme = this.getEffectiveTheme();
    const themes = {
      light: {
        surface: '#f8f9fc',
        'surface-1': '#fcfcfd',
        'text-primary': '#0c111b',
        'text-secondary': '#697586',
        outline: '#00000014',
        'outline-highlight': '#00000028',
        accent: '#d97757',
        'on-accent': '#ffffff',
        'surface-hover': '#0d0f1c14',
        warning: '#f79009',
        'on-warning': '#ffffff',
        'warning-container': '#f7900919',
        'on-warning-container': '#93370c'
      },
      dark: {
        surface: '#0d0f1c',
        'surface-1': '#13162a',
        'text-primary': '#fcfcfd',
        'text-secondary': '#697586',
        outline: '#ffffff19',
        'outline-highlight': '#ffffff32',
        accent: '#d97757',
        'on-accent': '#ffffff',
        'surface-hover': '#fcfcfd14',
        warning: '#f79009',
        'on-warning': '#ffffff',
        'warning-container': '#f7900914',
        'on-warning-container': '#f79009'
      }
    };
    
    const tokens = themes[effectiveTheme];
    
    // Apply CSS custom properties to document root
    const root = document.documentElement;
    Object.entries(tokens).forEach(([key, value]) => {
      root.style.setProperty(`--theme-${key}`, value);
    });
  }

  getEffectiveTheme() {
    if (this.currentTheme === 'system') {
      return window.matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light';
    }
    return this.currentTheme || 'light';
  }

  injectFontFace() {
    // Create a style element for the font face
    const fontStyle = document.createElement('style');
    fontStyle.setAttribute('data-vibe-font', 'true');
    
    // Get the extension URL for the font file
    const fontUrl = chrome.runtime.getURL('assets/fonts/InterVariable.woff2');
    
    // Create the font face CSS
    fontStyle.textContent = `
      @font-face {
        font-family: 'Inter';
        src: url('${fontUrl}') format('woff2-variations');
        font-weight: 100 900;
        font-display: swap;
      }
    `;
    
    // Inject into document head
    document.head.appendChild(fontStyle);
  }

  setupMessageListener() {
    
    chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
      
      switch (request.action) {
        case 'startAnnotationMode':
          this.startAnnotationMode();
          sendResponse({ success: true, message: 'Annotation mode started' });
          break;

        case 'stopAnnotationMode':
          this.stopAnnotationMode();
          sendResponse({ success: true, message: 'Annotation mode stopped' });
          break;

        case 'getAnnotationModeStatus':
          sendResponse({ success: true, isAnnotationMode: this.isAnnotationMode });
          break;
          
        case 'highlightAnnotation':
          this.highlightAnnotation(request.annotation);
          sendResponse({ success: true, message: 'Annotation highlighted' });
          break;
          
        case 'targetAnnotationElement':
          this.targetAnnotationElement(request.annotation);
          sendResponse({ success: true, message: 'Element targeted' });
          break;
          
          
        default:
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
    this.isAnnotationMode = true;
    
    // Add visual indicator
    document.body.classList.add('vibe-annotation-mode-active');
    
    // Set up event listeners
    this.setupAnnotationListeners();
    
    // Show instruction overlay
    this.showInspectionModeOverlay();
  }

  showInspectionModeOverlay() {
    // Create overlay with instructions
    const overlay = document.createElement('div');
    overlay.className = 'vibe-inspection-overlay';
    overlay.innerHTML = `
      <div class="vibe-inspection-content">
        <p>Press ESC or click the extension to exit inspection.</p>
      </div>
    `;
    
    document.body.appendChild(overlay);
    
    // Auto-hide after 3 seconds
    setTimeout(() => {
      overlay.classList.add('vibe-inspection-overlay-fade');
      setTimeout(() => {
        if (overlay.parentNode) {
          overlay.remove();
        }
      }, 300);
    }, 3000);
  }

  removeInspectionModeOverlay() {
    const overlay = document.querySelector('.vibe-inspection-overlay');
    if (overlay) {
      overlay.remove();
    }
  }

  stopAnnotationMode() {
    this.isAnnotationMode = false;
    
    // Remove visual indicators
    document.body.classList.remove('vibe-annotation-mode-active');
    this.removeInspectionModeOverlay();
    
    // Remove event listeners
    this.removeAnnotationListeners();
    
    // Clear highlights
    this.clearHighlights();
    
    // Note: No need to rebuild all badges here since they persist after annotation mode
    // Badges are created immediately when annotations are saved in saveAnnotation()
  }

  tempDisableAnnotationMode() {
    
    // Remove visual indicators but keep isAnnotationMode true
    document.body.classList.remove('vibe-annotation-mode-active');
    
    // Remove event listeners temporarily - this is crucial for modal interactions
    this.removeAnnotationListeners();
    
    // Clear highlights
    this.clearHighlights();
  }

  reEnableAnnotationMode() {
    
    if (this.isAnnotationMode) {
      // Re-add visual indicators
      document.body.classList.add('vibe-annotation-mode-active');
      
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
    
    // Skip Vibe annotation elements and badges
    if (e.target.closest('.vibe-comment-modal') || 
        e.target.classList.contains('vibe-annotation-highlight') ||
        e.target.classList.contains('vibe-annotation-badge') ||
        e.target.closest('.vibe-annotation-badge')) {
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
    
    if (!this.isAnnotationMode) return;
    
    e.preventDefault();
    e.stopPropagation();
    
    
    // Skip Vibe annotation elements, modal buttons, and annotation badges
    if (e.target.closest('.vibe-comment-modal') || 
        e.target.classList.contains('vibe-btn') ||
        e.target.closest('.vibe-btn') ||
        e.target.classList.contains('vibe-annotation-badge') ||
        e.target.closest('.vibe-annotation-badge')) {
      return;
    }
    
    this.createAnnotation(e.target);
  }

  highlightElement(element) {
    this.clearHighlights();
    element.classList.add('vibe-annotation-highlight');
  }

  clearHighlights() {
    document.querySelectorAll('.vibe-annotation-highlight').forEach(el => {
      el.classList.remove('vibe-annotation-highlight');
    });
  }

  showModeIndicator() {
    // Create a floating indicator
    const indicator = document.createElement('div');
    indicator.id = 'vibe-mode-indicator';
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
        animation: vibe-fade-in 0.2s ease;
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
    const indicator = document.getElementById('vibe-mode-indicator');
    if (indicator) {
      indicator.remove();
    }
  }

  async createAnnotation(element) {
    // Temporarily disable annotation mode while modal is open
    this.tempDisableAnnotationMode();
    
    // Generate element context (now async for screenshot capture)
    const context = await this.generateElementContext(element);
    
    // Show comment modal
    this.showCommentModal(element, context);
  }

  async generateElementContext(element) {
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

    // Get source mapping information
    const sourceMapping = this.generateSourceMapping(element);
    
    // Capture screenshot if enabled
    let screenshot = null;
    try {
      const result = await chrome.storage.local.get(['screenshotEnabled']);
      const screenshotEnabled = result.screenshotEnabled !== undefined ? result.screenshotEnabled : true;
      
      if (screenshotEnabled) {
        screenshot = await this.captureElementScreenshot(element);
      }
    } catch (error) {
      console.warn('Failed to capture screenshot:', error);
    }

    // Get parent chain context for better element disambiguation
    const parentChain = this.getParentChainContext(element);
    
    return {
      selector,
      tag: element.tagName.toLowerCase(),
      classes: Array.from(element.classList),
      text: element.textContent.substring(0, 100).trim(),
      styles: relevantStyles,
      position,
      viewport,
      source_mapping: sourceMapping,
      screenshot: screenshot,
      parent_chain: parentChain
    };
  }

  async captureElementScreenshot(element) {
    try {
      // Get element bounds for cropping
      const rect = element.getBoundingClientRect();
      const padding = 20; // Add some padding around the element
      
      // Calculate crop area with padding, but constrain to viewport
      const cropArea = {
        x: Math.max(0, rect.left - padding),
        y: Math.max(0, rect.top - padding),
        width: Math.min(window.innerWidth - Math.max(0, rect.left - padding), rect.width + (padding * 2)),
        height: Math.min(window.innerHeight - Math.max(0, rect.top - padding), rect.height + (padding * 2))
      };
      
      // Create canvas for screenshot
      const canvas = document.createElement('canvas');
      const ctx = canvas.getContext('2d');
      
      // Set canvas size to crop area
      canvas.width = cropArea.width;
      canvas.height = cropArea.height;
      
      // Use html2canvas-like approach for cross-browser compatibility
      const elementStyle = window.getComputedStyle(element);
      
      // Create a simplified visual representation
      ctx.fillStyle = elementStyle.backgroundColor || '#ffffff';
      ctx.fillRect(0, 0, canvas.width, canvas.height);
      
      // Add element outline
      ctx.strokeStyle = '#d97757'; // Vibe orange
      ctx.lineWidth = 2;
      const elementX = Math.max(0, rect.left - cropArea.x);
      const elementY = Math.max(0, rect.top - cropArea.y);
      ctx.strokeRect(elementX, elementY, rect.width, rect.height);
      
      // Add element text if available
      const text = element.textContent.trim().substring(0, 50);
      if (text) {
        ctx.fillStyle = elementStyle.color || '#000000';
        ctx.font = '12px Inter, sans-serif';
        ctx.fillText(text + (element.textContent.length > 50 ? '...' : ''), elementX + 5, elementY + 15);
      }
      
      // Convert to WebP with compression for smaller file size
      const dataUrl = canvas.toDataURL('image/webp', 0.8);
      
      // Return metadata about the screenshot
      return {
        data_url: dataUrl,
        crop_area: cropArea,
        element_bounds: {
          x: rect.left,
          y: rect.top,
          width: rect.width,
          height: rect.height
        },
        timestamp: new Date().toISOString(),
        compression: 'webp_80'
      };
      
    } catch (error) {
      console.warn('Failed to capture element screenshot:', error);
      return null;
    }
  }

  getParentChainContext(element, maxDepth = 3) {
    const parentChain = [];
    let current = element.parentElement;
    let depth = 0;
    
    while (current && depth < maxDepth && current.tagName !== 'BODY') {
      const parentInfo = {
        tag: current.tagName.toLowerCase(),
        classes: Array.from(current.classList),
        id: current.id || null,
        role: current.getAttribute('role') || null,
        text_sample: current.textContent.substring(0, 50).trim()
      };
      
      // Only include meaningful parents (not just divs without context)
      if (parentInfo.classes.length > 0 || parentInfo.id || parentInfo.role || 
          ['nav', 'header', 'footer', 'main', 'section', 'article', 'aside'].includes(parentInfo.tag)) {
        parentChain.push(parentInfo);
      }
      
      current = current.parentElement;
      depth++;
    }
    
    return parentChain.length > 0 ? parentChain : null;
  }

  generateSourceMapping(element) {
    try {
      // Get source mapping information
      const sourceInfo = this.extractSourceInfo(element);
      
      // Get route-based project area
      const projectArea = this.getProjectAreaFromURL();
      const urlPath = new URL(window.location.href).pathname;
      
      // Always generate context hints for semantic understanding
      const contextHints = this.generateContextHints(element);
      
      return {
        source_file_path: sourceInfo.filePath || null,
        source_line_range: sourceInfo.lineRange || null,
        project_area: projectArea,
        url_path: urlPath,
        source_map_available: sourceInfo.hasSourceMap || false,
        context_hints: contextHints
      };
      
    } catch (error) {
      return {
        source_file_path: null,
        source_line_range: null,
        project_area: 'unknown',
        url_path: window.location.pathname || '/',
        source_map_available: false,
        context_hints: this.generateContextHints(element)
      };
    }
  }

  generateContextHints(element) {
    const hints = [];
    
    // 1. Semantic hierarchy - what type of UI section is this?
    const semanticRole = this.inferSemanticRole(element);
    if (semanticRole) {
      hints.push(`UI section: ${semanticRole}`);
    }
    
    // 2. Component depth and nesting level
    const componentDepth = this.getComponentDepth(element);
    if (componentDepth > 1) {
      hints.push(`Nested ${componentDepth} levels deep in component hierarchy`);
    }
    
    // 3. Framework-specific patterns (React/Next.js bonus detection)
    const frameworkHints = this.detectFrameworkPatterns(element);
    if (frameworkHints.length > 0) {
      hints.push(...frameworkHints);
    }
    
    // 4. Likely file location based on semantic role and URL
    const fileLocationHint = this.inferFileLocation(element, semanticRole);
    if (fileLocationHint) {
      hints.push(`Likely file: ${fileLocationHint}`);
    }
    
    return hints.length > 0 ? hints : null;
  }

  inferSemanticRole(element) {
    // Determine what type of UI section this element represents
    
    // Check element itself first
    if (element.closest('nav, [role="navigation"]')) return 'navigation';
    if (element.closest('header, [role="banner"]')) return 'header';
    if (element.closest('footer, [role="contentinfo"]')) return 'footer';
    if (element.closest('aside, [role="complementary"]')) return 'sidebar';
    if (element.closest('main, [role="main"]')) return 'main-content';
    if (element.closest('form, [role="form"]')) return 'form';
    
    // Check for modal/dialog patterns
    if (element.closest('[role="dialog"], .modal, .popup, .overlay')) return 'modal';
    
    // Check for card/item patterns
    if (element.closest('.card, .item, .post, .article, [role="article"]')) return 'content-card';
    
    // Check for list item patterns
    if (element.closest('li, [role="listitem"], .list-item')) return 'list-item';
    
    // Check for button/interactive patterns
    if (element.matches('button, [role="button"], .btn, .button')) return 'button';
    if (element.matches('input, select, textarea, [role="textbox"]')) return 'form-input';
    
    // Check for table patterns
    if (element.closest('table, [role="table"], [role="grid"]')) return 'table';
    
    return null;
  }
  
  getComponentDepth(element) {
    // Count how many component-like containers this element is nested within
    let depth = 0;
    let current = element.parentElement;
    const maxDepth = 10;
    
    while (current && depth < maxDepth && current.tagName !== 'BODY') {
      // Look for component-like patterns
      const classes = Array.from(current.classList);
      const hasComponentPattern = classes.some(cls => 
        /^[A-Z][a-zA-Z0-9]*/.test(cls) || // PascalCase
        cls.includes('component') ||
        cls.includes('container') ||
        cls.includes('wrapper')
      );
      
      if (hasComponentPattern) {
        depth++;
      }
      
      current = current.parentElement;
    }
    
    return depth;
  }
  
  detectFrameworkPatterns(element) {
    const patterns = [];
    
    // Look for React-specific patterns
    if (element.hasAttribute('data-testid')) {
      patterns.push(`React test ID: ${element.getAttribute('data-testid')}`);
    }
    
    // Look for Next.js specific patterns
    if (element.closest('[data-nextjs-scroll-focus-boundary]') ||
        document.querySelector('script[src*="_next"]')) {
      patterns.push('Next.js app detected');
    }
    
    // Look for CSS-in-JS patterns (styled-components, emotion, etc.)
    const classes = Array.from(element.classList);
    const hasCSSInJS = classes.some(cls => 
      /^[a-z0-9]{6,}$/.test(cls) || // Hash-like classes
      cls.startsWith('css-') ||
      cls.startsWith('emotion-')
    );
    if (hasCSSInJS) {
      patterns.push('CSS-in-JS styling detected');
    }
    
    return patterns;
  }
  
  inferFileLocation(element, semanticRole) {
    const pathname = window.location.pathname;
    const segments = pathname.split('/').filter(s => s);
    
    // For Next.js App Router patterns
    if (segments.length > 0) {
      const lastSegment = segments[segments.length - 1];
      
      // Common Next.js file patterns
      if (semanticRole === 'header') return `components/Header.tsx or app/layout.tsx`;
      if (semanticRole === 'footer') return `components/Footer.tsx or app/layout.tsx`;
      if (semanticRole === 'navigation') return `components/Navigation.tsx`;
      if (semanticRole === 'main-content') return `app/${segments.join('/')}/page.tsx`;
      if (semanticRole === 'modal') return `components/Modal.tsx or components/dialogs/`;
      
      // Page-specific components
      if (lastSegment) {
        return `app/${segments.join('/')}/page.tsx or components/${this.capitalize(lastSegment)}Page.tsx`;
      }
    }
    
    // Fallback for root pages
    if (semanticRole === 'main-content') return 'app/page.tsx or pages/index.tsx';
    
    return null;
  }
  
  capitalize(str) {
    return str.charAt(0).toUpperCase() + str.slice(1);
  }

  getProjectAreaFromURL() {
    const url = new URL(window.location.href);
    const pathname = url.pathname;
    
    // Remove leading slash and split path segments
    const segments = pathname.substring(1).split('/').filter(seg => seg.length > 0);
    
    // If no segments, it's the home/root area
    if (segments.length === 0) {
      return 'home';
    }
    
    // Use the first segment as the primary project area
    const primaryArea = segments[0].toLowerCase();
    
    // Map common patterns to normalized areas
    const areaMap = {
      // Admin/Dashboard areas
      'admin': 'admin',
      'dashboard': 'dashboard',
      'control-panel': 'admin',
      'cp': 'admin',
      
      // User areas
      'users': 'users',
      'user': 'users',
      'profile': 'users',
      'profiles': 'users',
      'account': 'users',
      'accounts': 'users',
      
      // Product areas
      'products': 'products',
      'product': 'products',
      'items': 'products',
      'item': 'products',
      'catalog': 'products',
      
      // Order/Commerce areas
      'orders': 'orders',
      'order': 'orders',
      'checkout': 'orders',
      'cart': 'orders',
      'shopping': 'orders',
      
      // Content areas
      'posts': 'content',
      'post': 'content',
      'articles': 'content',
      'article': 'content',
      'blog': 'content',
      'news': 'content',
      
      // Settings areas
      'settings': 'settings',
      'config': 'settings',
      'configuration': 'settings',
      'preferences': 'settings',
      
      // Auth areas
      'login': 'auth',
      'signin': 'auth',
      'signup': 'auth',
      'register': 'auth',
      'auth': 'auth',
      'authentication': 'auth'
    };
    
    // Return mapped area or use the primary segment as-is
    return areaMap[primaryArea] || primaryArea;
  }

  extractSourceInfo(element) {
    let sourceInfo = {
      filePath: null,
      lineRange: null,
      hasSourceMap: false
    };

    // Try React fiber detection first (most reliable for React/Next.js)
    try {
      const reactInfo = this.getReactFiberInfo(element);
      if (reactInfo) {
        sourceInfo = { ...sourceInfo, ...reactInfo };
      }
    } catch (error) {
      // Continue with fallback methods
    }

    // Try data attribute detection
    if (!sourceInfo.filePath) {
      try {
        const dataInfo = this.getDataAttributeInfo(element);
        if (dataInfo) {
          sourceInfo = { ...sourceInfo, ...dataInfo };
        }
      } catch (error) {
        // Continue with empty source info
      }
    }

    return sourceInfo;
  }


  getReactFiberInfo(element) {
    // React fiber detection for source file info only (works in development mode)
    let current = element;
    const maxDepth = 10;
    let depth = 0;

    while (current && depth < maxDepth) {
      // Check for React fiber keys
      const allKeys = Object.keys(current);
      const fiberKey = allKeys.find(key => 
        key.startsWith('__reactFiber') || 
        key.startsWith('__reactInternalInstance') ||
        key.startsWith('_reactInternalFiber')
      );
      
      if (fiberKey) {
        const fiber = current[fiberKey];
        
        if (fiber) {
          // Walk up the fiber tree to find source info
          let fiberNode = fiber;
          let fiberDepth = 0;
          const maxFiberDepth = 20;
          
          while (fiberNode && fiberDepth < maxFiberDepth) {
            // Check for source information in various locations
            const source = fiberNode._debugSource || 
                          fiberNode._source ||
                          fiberNode.elementType?._source ||
                          fiberNode.type?._source;
            
            if (source && source.fileName) {
              return {
                filePath: this.normalizeSourcePath(source.fileName),
                lineRange: source.lineNumber ? `${source.lineNumber}-${source.lineNumber + 10}` : null,
                hasSourceMap: true
              };
            }

            // Try alternate location for Next.js
            if (fiberNode._debugOwner) {
              const ownerSource = fiberNode._debugOwner._debugSource || 
                                 fiberNode._debugOwner._source;
              if (ownerSource && ownerSource.fileName) {
                return {
                  filePath: this.normalizeSourcePath(ownerSource.fileName),
                  lineRange: ownerSource.lineNumber ? `${ownerSource.lineNumber}-${ownerSource.lineNumber + 10}` : null,
                  hasSourceMap: true
                };
              }
            }

            // Move up the fiber tree
            fiberNode = fiberNode.return || fiberNode._debugOwner;
            fiberDepth++;
          }
        }
      }

      // Move up the DOM tree
      current = current.parentElement;
      depth++;
    }

    return null;
  }

  getDataAttributeInfo(element) {
    // Look for data attributes that might contain source info
    let current = element;
    const maxDepth = 5;
    let depth = 0;

    while (current && depth < maxDepth) {
      // Check for common data attributes used by build tools
      const dataFile = current.getAttribute('data-source-file') || 
                      current.getAttribute('data-component-file') ||
                      current.getAttribute('data-file');
      
      const dataLine = current.getAttribute('data-source-line') || 
                      current.getAttribute('data-line');
      
      if (dataFile) {
        return {
          filePath: this.normalizeSourcePath(dataFile),
          lineRange: dataLine ? `${dataLine}-${parseInt(dataLine) + 10}` : null,
          hasSourceMap: true
        };
      }

      // Check for Next.js specific attributes
      const nextDataPath = current.getAttribute('data-nextjs-path');
      if (nextDataPath) {
        return {
          filePath: this.normalizeSourcePath(nextDataPath),
          lineRange: null,
          hasSourceMap: true
        };
      }

      current = current.parentElement;
      depth++;
    }

    return null;
  }


  normalizeSourcePath(filePath) {
    // Remove common prefixes and normalize path
    let normalized = filePath
      // Remove Turbopack prefixes
      .replace(/^\[project\]\//, '')
      .replace(/^\[turbopack\]\//, '')
      .replace(/^\[next\]\//, '')
      // Next.js App Router patterns (preserve full path for clarity)
      .replace(/^.*\/(app\/.*?)$/, '$1')
      // React/SPA patterns
      .replace(/^.*\/src\//, 'src/')
      .replace(/^.*\/components\//, 'components/')
      .replace(/^.*\/pages\//, 'pages/')
      // Rails patterns
      .replace(/^.*\/app\/views\//, 'app/views/')
      .replace(/^.*\/app\/assets\//, 'app/assets/')
      .replace(/^.*\/app\/controllers\//, 'app/controllers/')
      .replace(/^.*\/app\/models\//, 'app/models/')
      .replace(/^.*\/app\/helpers\//, 'app/helpers/')
      // Django patterns
      .replace(/^.*\/templates\//, 'templates/')
      .replace(/^.*\/static\//, 'static/')
      // General web patterns
      .replace(/^.*\/public\//, 'public/')
      .replace(/^.*\/assets\//, 'assets/')
      .replace(/^.*\/js\//, 'js/')
      .replace(/^.*\/css\//, 'css/')
      .replace(/^.*\/scss\//, 'scss/')
      .replace(/^.*\/styles\//, 'styles/')
      // Remove query parameters and hash
      .replace(/\?.*$/, '')
      .replace(/#.*$/, '');
    
    // For Next.js app directory, ensure we preserve the app/ prefix
    if (!normalized.startsWith('app/') && normalized.includes('/app/')) {
      normalized = 'app/' + normalized.split('/app/')[1];
    }
    
    return normalized;
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
      .filter(cls => !cls.startsWith('vibe-'))
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
        .filter(cls => !cls.startsWith('vibe-'))
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
        .filter(cls => !cls.startsWith('vibe-'))
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
    const dataId = `vibe-annotation-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
    element.setAttribute('data-vibe-id', dataId);
    return `[data-vibe-id="${dataId}"]`;
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
        .filter(cls => !cls.startsWith('vibe-'))
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
    modal.className = 'vibe-comment-modal';
    modal.setAttribute('data-vibe-theme', this.getEffectiveTheme());
    modal.innerHTML = `
      <div class="vibe-comment-modal-content">
        <div class="vibe-comment-modal-header">
          <h3 class="vibe-comment-modal-title">Edit Annotation</h3>
          <button class="vibe-comment-modal-close">
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
              <line x1="18" y1="6" x2="6" y2="18"></line>
              <line x1="6" y1="6" x2="18" y2="18"></line>
            </svg>
          </button>
        </div>
        
        ${this.isFileProtocol() ? `
          <div class="vibe-api-status-warning">
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
              <path d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z"></path>
            </svg>
            <span>Local file mode - API server access via extension background</span>
          </div>
        ` : !apiStatus.connected ? `
          <div class="vibe-api-status-warning">
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
              <path d="m21.73 18-8-14a2 2 0 0 0-3.48 0l-8 14A2 2 0 0 0 4 21h16a2 2 0 0 0 1.73-3Z"></path>
              <line x1="12" y1="9" x2="12" y2="13"></line>
              <line x1="12" y1="17" x2="12.01" y2="17"></line>
            </svg>
            <span>MCP server is offline - annotation cannot be edited or deleted</span>
          </div>
        ` : ''}
        
        <div class="vibe-element-details">
          <div class="vibe-detail-item">
            <span class="vibe-icon vibe-icon--code-bracket-square"></span>
            <span class="vibe-detail-value">${context.selector}</span>
          </div>
          <div class="vibe-detail-item">
            <span class="vibe-icon vibe-icon--computer-desktop"></span>
            <span class="vibe-detail-value">${context.viewport.width}w</span>
          </div>
          <div class="vibe-detail-item">
            <span class="vibe-icon vibe-icon--map-pin"></span>
            <span class="vibe-detail-value">${Math.round(context.position.x)}, ${Math.round(context.position.y)}</span>
          </div>
          <div class="vibe-detail-item">
            <span class="vibe-icon vibe-icon--arrows-pointing-out"></span>
            <span class="vibe-detail-value">${Math.round(context.position.width)}×${Math.round(context.position.height)}</span>
          </div>
        </div>
        
        <div class="vibe-comment-input-wrapper">
          <textarea 
            id="vibe-comment-textarea"
            class="vibe-comment-textarea" 
            placeholder="Describe what needs to be changed or improved..."
            maxlength="1000"
          >${annotation.comment}</textarea>
          <div class="vibe-comment-helper">${this.isMac() ? '⌘↩' : 'Ctrl+Enter'} to save</div>
        </div>
        
        <div class="vibe-comment-actions">
          <button class="vibe-btn vibe-btn-icon" id="delete-comment" title="Delete annotation">
            <span class="vibe-icon vibe-icon--trash"></span>
          </button>
          <div class="vibe-btn-group">
            <button class="vibe-btn vibe-btn-secondary" id="cancel-comment">Cancel</button>
            <button class="vibe-btn vibe-btn-primary" id="save-comment" disabled>Save Changes</button>
          </div>
        </div>
      </div>
    `;
    
    document.body.appendChild(modal);
    
    // Set up modal event listeners for edit mode
    this.setupEditModalListeners(modal, element, context, annotation);
    
    // Focus textarea and select all text
    const textarea = modal.querySelector('.vibe-comment-textarea');
    textarea.focus();
    textarea.select();
  }

  async showCommentModal(element, context) {
    // Check API status first
    const apiStatus = await this.checkAPIStatus();
    
    // Create modal
    const modal = document.createElement('div');
    modal.className = 'vibe-comment-modal';
    modal.setAttribute('data-vibe-theme', this.getEffectiveTheme());
    modal.innerHTML = `
      <div class="vibe-comment-modal-content">
        <div class="vibe-comment-modal-header">
          <h3 class="vibe-comment-modal-title">Add Annotation</h3>
          <button class="vibe-comment-modal-close">
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
              <line x1="18" y1="6" x2="6" y2="18"></line>
              <line x1="6" y1="6" x2="18" y2="18"></line>
            </svg>
          </button>
        </div>
        
        ${this.isFileProtocol() ? `
          <div class="vibe-api-status-warning">
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
              <path d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z"></path>
            </svg>
            <span>Local file mode - API server access via extension background</span>
          </div>
        ` : !apiStatus.connected ? `
          <div class="vibe-api-status-warning">
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
              <path d="m21.73 18-8-14a2 2 0 0 0-3.48 0l-8 14A2 2 0 0 0 4 21h16a2 2 0 0 0 1.73-3Z"></path>
              <line x1="12" y1="9" x2="12" y2="13"></line>
              <line x1="12" y1="17" x2="12.01" y2="17"></line>
            </svg>
            <span>MCP server is offline - annotation cannot be edited or deleted</span>
          </div>
        ` : ''}
        
        <div class="vibe-element-details">
          <div class="vibe-detail-item">
            <span class="vibe-icon vibe-icon--code-bracket-square"></span>
            <span class="vibe-detail-value">${context.selector}</span>
          </div>
          <div class="vibe-detail-item">
            <span class="vibe-icon vibe-icon--computer-desktop"></span>
            <span class="vibe-detail-value">${context.viewport.width}w</span>
          </div>
          <div class="vibe-detail-item">
            <span class="vibe-icon vibe-icon--map-pin"></span>
            <span class="vibe-detail-value">${Math.round(context.position.x)}, ${Math.round(context.position.y)}</span>
          </div>
          <div class="vibe-detail-item">
            <span class="vibe-icon vibe-icon--arrows-pointing-out"></span>
            <span class="vibe-detail-value">${Math.round(context.position.width)}×${Math.round(context.position.height)}</span>
          </div>
        </div>
        
        <div class="vibe-comment-input-wrapper">
          <textarea 
            id="vibe-comment-textarea"
            class="vibe-comment-textarea" 
            placeholder="Describe what needs to be changed or improved..."
            maxlength="1000"
          ></textarea>
          <div class="vibe-comment-helper">${this.isMac() ? '⌘↩' : 'Ctrl+Enter'} to save</div>
        </div>
        
        <div class="vibe-comment-actions">
          <div class="vibe-btn-group">
            <button class="vibe-btn vibe-btn-secondary" id="cancel-comment">Cancel</button>
            <button class="vibe-btn vibe-btn-primary" id="save-comment" disabled>Save Annotation</button>
          </div>
        </div>
      </div>
    `;
    
    document.body.appendChild(modal);
    
    // Set up modal event listeners
    this.setupModalListeners(modal, element, context);
    
    // Focus textarea
    const textarea = modal.querySelector('.vibe-comment-textarea');
    textarea.focus();
  }

  // Helper method to detect if we're on a file:// URL
  isFileProtocol() {
    return window.location.protocol === 'file:';
  }

  // Cache API status to prevent repeated calls
  apiStatusCache = null;
  apiStatusCacheTime = 0;
  apiStatusCacheDuration = 2000; // Cache for 2 seconds

  // Clear API status cache
  clearAPIStatusCache() {
    this.apiStatusCache = null;
    this.apiStatusCacheTime = 0;
  }

  async checkAPIStatus() {
    // Check cache first
    const now = Date.now();
    if (this.apiStatusCache && (now - this.apiStatusCacheTime) < this.apiStatusCacheDuration) {
      return this.apiStatusCache;
    }

    let status;

    // If we're on file:// protocol, skip direct fetch and use background script immediately
    if (this.isFileProtocol()) {
      try {
        const bgResponse = await chrome.runtime.sendMessage({
          action: 'checkMCPStatus'
        });
        
        if (bgResponse && bgResponse.success && bgResponse.status) {
          status = { connected: bgResponse.status.connected };
        } else {
          status = { connected: false, error: 'Background check failed' };
        }
      } catch (bgError) {
        console.error('Background API check failed on file:// protocol:', bgError);
        status = { connected: false, error: 'Cannot connect to API server from local file' };
      }
    } else {
      // For localhost URLs, try direct fetch first
      try {
        const response = await fetch('http://localhost:3846/health', {
          method: 'GET',
          signal: AbortSignal.timeout(2000), // 2 second timeout
          mode: 'cors', // Explicitly set CORS mode
          credentials: 'omit' // Don't send credentials for localhost
        });
        
        if (response.ok) {
          status = { connected: true };
        } else {
          status = { connected: false, error: `Server returned ${response.status}` };
        }
      } catch (error) {
        // If direct fetch fails, try via background script as fallback
        console.warn('Direct API check failed, trying via background script:', error);
        
        try {
          const bgResponse = await chrome.runtime.sendMessage({
            action: 'checkMCPStatus'
          });
          
          if (bgResponse && bgResponse.success && bgResponse.status) {
            status = { connected: bgResponse.status.connected };
          } else {
            status = { connected: false, error: 'Background check failed' };
          }
        } catch (bgError) {
          console.error('Background API check also failed:', bgError);
          status = { connected: false, error: error.message };
        }
      }
    }

    // Cache the result
    this.apiStatusCache = status;
    this.apiStatusCacheTime = now;

    return status;
  }

  setupEditModalListeners(modal, element, context, annotation) {
    const textarea = modal.querySelector('.vibe-comment-textarea');
    const cancelBtn = modal.querySelector('#cancel-comment');
    const saveBtn = modal.querySelector('#save-comment');
    const deleteBtn = modal.querySelector('#delete-comment');
    const closeBtn = modal.querySelector('.vibe-comment-modal-close');
    
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
    
    // Delete button handler
    if (deleteBtn) {
      deleteBtn.addEventListener('click', async () => {
        if (confirm('Are you sure you want to delete this annotation?')) {
          try {
            await chrome.runtime.sendMessage({
              action: 'deleteAnnotation',
              id: annotation.id
            });
            
            // Remove the badge
            const badge = document.querySelector(`[data-annotation-id="${annotation.id}"]`);
            if (badge) {
              badge.remove();
            }
            
            closeModal();
          } catch (error) {
            console.error('Error deleting annotation:', error);
            alert('Failed to delete annotation. Please try again.');
          }
        }
      });
    }
    
    // Click outside to close
    modal.addEventListener('click', (e) => {
      if (e.target === modal) {
        closeModal();
      }
    });
    
    // ESC to close and Cmd+Enter to save
    document.addEventListener('keydown', function escHandler(e) {
      if (e.key === 'Escape') {
        closeModal();
        document.removeEventListener('keydown', escHandler);
      } else if (e.key === 'Enter' && (e.metaKey || e.ctrlKey)) {
        // Check if we're focused on the textarea and save button is enabled
        if (document.activeElement === textarea && !saveBtn.disabled) {
          e.preventDefault();
          saveBtn.click();
        }
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
        }
        
        await this.updateAnnotation(annotation, newComment);
        closeModal();
        
        // Re-enable annotation mode for continuous inspection
      }
    });
  }

  setupModalListeners(modal, element, context) {
    const textarea = modal.querySelector('.vibe-comment-textarea');
    const cancelBtn = modal.querySelector('#cancel-comment');
    const saveBtn = modal.querySelector('#save-comment');
    const closeBtn = modal.querySelector('.vibe-comment-modal-close');
    
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
    
    // ESC to close and Cmd+Enter to save
    document.addEventListener('keydown', function escHandler(e) {
      if (e.key === 'Escape') {
        closeModal();
        document.removeEventListener('keydown', escHandler);
      } else if (e.key === 'Enter' && (e.metaKey || e.ctrlKey)) {
        // Check if we're focused on the textarea and save button is enabled
        if (document.activeElement === textarea && !saveBtn.disabled) {
          e.preventDefault();
          saveBtn.click();
        }
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
        }
        
        await this.saveAnnotation(element, context, comment);
        closeModal();
        
        // Re-enable annotation mode for continuous inspection
        // User stays in inspection mode until ESC or extension button
      }
    });
  }

  async updateAnnotation(annotation, newComment) {
    try {
      // Update annotation through background script
      const updates = {
        comment: newComment,
        updated_at: new Date().toISOString()
      };
      
      try {
        const bgResponse = await chrome.runtime.sendMessage({
          action: 'updateAnnotation',
          id: annotation.id,
          updates: updates
        });
        
        if (!bgResponse || !bgResponse.success) {
          throw new Error(bgResponse?.error || 'Failed to update annotation');
        }
        
        // Update local array
        const localIndex = this.annotations.findIndex(a => a.id === annotation.id);
        if (localIndex !== -1) {
          this.annotations[localIndex] = { ...this.annotations[localIndex], ...updates };
        }
      } catch (error) {
        console.error('Error updating annotation via background script:', error);
        // Fallback to direct storage update
        const result = await chrome.storage.local.get(['annotations']);
        const allAnnotations = result.annotations || [];
        const index = allAnnotations.findIndex(a => a.id === annotation.id);
        if (index !== -1) {
          allAnnotations[index] = { ...allAnnotations[index], ...updates };
          await chrome.storage.local.set({ annotations: allAnnotations });
          
          // Update local array
          const localIndex = this.annotations.findIndex(a => a.id === annotation.id);
          if (localIndex !== -1) {
            this.annotations[localIndex] = allAnnotations[index];
          }
        }
      }
      
      // Update the tooltip content
      const element = document.querySelector(annotation.selector);
      if (element) {
        const badge = element.querySelector('.vibe-annotation-badge');
        if (badge) {
          const tooltip = badge.querySelector('.vibe-pin-tooltip');
          if (tooltip) {
            tooltip.textContent = newComment;
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
        
        // Test again
        const newTestElement = document.querySelector(newSelector);
        if (newTestElement !== element) {
          console.error('Even regenerated selector fails. Using fallback approach.');
          // Add data attribute as fallback
          const dataId = `vibe-annotation-${Date.now()}`;
          element.setAttribute('data-vibe-id', dataId);
          context.selector = `[data-vibe-id="${dataId}"]`;
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
        source_file_path: context.source_mapping?.source_file_path || null,
        source_line_range: context.source_mapping?.source_line_range || null,
        project_area: context.source_mapping?.project_area || 'unknown',
        url_path: context.source_mapping?.url_path || window.location.pathname,
        source_map_available: context.source_mapping?.source_map_available || false,
        context_hints: context.source_mapping?.context_hints || null,
        screenshot: context.screenshot || null,
        parent_chain: context.parent_chain || null,
        status: 'pending',
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString()
      };
      
      // Save annotation through background script
      try {
        const bgResponse = await chrome.runtime.sendMessage({
          action: 'saveAnnotation',
          annotation: annotation
        });
        
        if (!bgResponse || !bgResponse.success) {
          throw new Error(bgResponse?.error || 'Failed to save annotation');
        }
        
        // Add to local array
        this.annotations.push(annotation);
      } catch (error) {
        console.error('Error saving annotation via background script:', error);
        // Fallback to direct storage save
        const result = await chrome.storage.local.get(['annotations']);
        const allAnnotations = result.annotations || [];
        allAnnotations.push(annotation);
        await chrome.storage.local.set({ annotations: allAnnotations });
        this.annotations.push(annotation);
      }
      
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
    // Add a counter to detect infinite loops
    if (!this.showAnnotationsCallCount) this.showAnnotationsCallCount = 0;
    this.showAnnotationsCallCount++;
    
    if (this.showAnnotationsCallCount > 10) {
      console.error('INFINITE LOOP DETECTED - showExistingAnnotations called', this.showAnnotationsCallCount, 'times. Aborting.');
      return 0;
    }
    
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
        }
      } catch (error) {
        console.warn(`Error with annotation ${annotation.id}:`, error);
      }
    });
    
    // Reset counter after successful completion
    setTimeout(() => {
      this.showAnnotationsCallCount = 0;
    }, 1000);
    
    return foundCount;
  }

  clearAllBadges() {
    const existingBadges = document.querySelectorAll('.vibe-annotation-badge');
    
    // Clear badges from both elements and body
    existingBadges.forEach((badge) => {
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
      if (element) {
        return element;
      }
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
              return element;
            }
          } catch (error) {
            // Continue with other methods
          }
        }
      }
    }
    
    // Try to find by data attribute if it exists
    if (annotation.selector.includes('data-vibe-id')) {
      const dataIdMatch = annotation.selector.match(/data-vibe-id="([^"]+)"/);
      if (dataIdMatch) {
        element = document.querySelector(`[data-vibe-id="${dataIdMatch[1]}"]`);
        if (element) {
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
        this.waitForDOMStability();
        return;
      }
      
      // 2. Wait for load event if not complete
      window.addEventListener('load', () => {
        this.waitForDOMStability();
      }, { once: true });
    };
    
    checkForStability();
    
    // Fallback timeout for edge cases
    setTimeout(() => {
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
        observer.disconnect();
        setTimeout(() => this.showExistingAnnotationsWithRetry(), 500);
        return;
      }
      
      // Set new stability timer
      stabilityTimer = setTimeout(() => {
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
      observer.disconnect();
      this.showExistingAnnotationsWithRetry();
    }, stabilityDelay);
  }

  showExistingAnnotationsWithRetry(maxAttempts = 5, delay = 500) {
    let attempts = 0;
    
    const tryShowAnnotations = () => {
      attempts++;
      
      const foundElements = this.showExistingAnnotations();
      const expectedCount = this.annotations.length;
      const foundCount = foundElements;
      
      
      // If we found all elements or reached max attempts, stop
      if (foundCount === expectedCount || attempts >= maxAttempts) {
        return;
      }
      
      // Retry after delay
      setTimeout(tryShowAnnotations, delay);
    };
    
    tryShowAnnotations();
  }

  setupDOMObserver() {
    // DISABLED - causing infinite loops
    return;
    
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
          const missingCount = this.annotations.length - document.querySelectorAll('.vibe-annotation-badge').length;
          if (missingCount > 0) {
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
    const existingBadge = element.querySelector('.vibe-annotation-badge');
    if (existingBadge) {
      existingBadge.remove();
    }
    
    // Create badge
    const badge = document.createElement('div');
    badge.className = 'vibe-annotation-badge';
    badge.textContent = index.toString(); // Show index number instead of emoji
    // No title to avoid default browser tooltip interfering
    
    // Add click handler to open edit modal
    badge.addEventListener('click', (e) => {
      e.stopPropagation();
      this.openEditModal(element, annotation);
    });
    
    // Create tooltip as child of badge
    const tooltip = document.createElement('div');
    tooltip.className = 'vibe-pin-tooltip';
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
    const elementId = this.generateElementId(element);
    badge.dataset.originalElementId = elementId;
    
    // Re-enable scroll/resize listeners for proper positioning
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
    if (!element.dataset.vibeAnnotationId) {
      element.dataset.vibeAnnotationId = 'vibe-element-' + Date.now() + '-' + Math.random().toString(36).substr(2, 9);
    }
    return element.dataset.vibeAnnotationId;
  }


  async openEditModal(element, annotation) {
    // Temporarily disable annotation mode while modal is open
    this.tempDisableAnnotationMode();
    
    // Generate fresh element context (now async for screenshot capture)
    const context = await this.generateElementContext(element);
    
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


  highlightAnnotation(annotation) {
    try {
      const element = document.querySelector(annotation.selector);
      if (element) {
        // Scroll to element
        element.scrollIntoView({ behavior: 'smooth', block: 'center' });
        
        // Highlight temporarily
        element.style.outline = '3px solid var(--theme-accent)';
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

  targetAnnotationElement(annotation) {
    try {
      // First, find the original element to scroll to its area
      const element = this.findElementBySelector(annotation);
      if (!element) {
        console.warn('Element not found for annotation:', annotation.selector);
        return;
      }
      
      // Scroll to the element area first
      element.scrollIntoView({ behavior: 'smooth', block: 'center' });
      
      // Now find the corresponding pin/badge to apply focus state
      const allBadges = document.querySelectorAll('.vibe-annotation-badge');
      let targetBadge = null;
      
      // Find the badge that corresponds to this annotation
      for (const badge of allBadges) {
        const elementId = badge.dataset.originalElementId;
        if (elementId) {
          const originalElement = document.querySelector(`[data-vibe-annotation-id="${elementId}"]`);
          if (originalElement === element) {
            targetBadge = badge;
            break;
          }
        }
      }
      
      if (targetBadge) {
        // Add blue focus state to the pin
        targetBadge.classList.add('vibe-targeted-element');
        
        // Remove focus state after 3 seconds
        setTimeout(() => {
          targetBadge.classList.remove('vibe-targeted-element');
        }, 3000);
      } else {
        // Fallback: apply focus to the original element if pin not found
        element.classList.add('vibe-targeted-element');
        setTimeout(() => {
          element.classList.remove('vibe-targeted-element');
        }, 3000);
      }
    } catch (error) {
      console.error('Error targeting annotation element:', error);
    }
  }


  generateId() {
    return 'vibe_' + Date.now() + '_' + Math.random().toString(36).substr(2, 9);
  }

  isMac() {
    return navigator.platform.toUpperCase().indexOf('MAC') >= 0;
  }

  isLocalFile() {
    return window.location.protocol === 'file:';
  }

  isValidFileType() {
    if (!this.isLocalFile()) return true; // Non-file URLs are always valid
    
    const path = window.location.pathname.toLowerCase();
    const htmlExtensions = ['.html', '.htm'];
    
    // Check if it ends with .html or .htm, or has no extension (could be index.html)
    if (htmlExtensions.some(ext => path.endsWith(ext))) {
      return true;
    }
    
    // Allow files with no extension if they're likely HTML
    const hasNoExtension = !path.includes('.') || path.endsWith('/');
    return hasNoExtension;
  }
}

// Initialize when DOM is ready
if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', () => {
    new VibeAnnotations();
  });
} else {
  new VibeAnnotations();
}