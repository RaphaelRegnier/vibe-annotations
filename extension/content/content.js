// Vibe Annotations V2 — Entry Point
// Orchestrates all modules loaded via manifest.json content_scripts
// Modules are loaded in order and share execution context (no build step)
(async function VibeAnnotationsV2() {
  'use strict';

  // --- State ---
  let annotations = [];
  let localSaveCount = 0;

  // --- Font injection (on main document — fonts cascade into shadow DOM) ---
  function injectFontFace() {
    if (document.querySelector('[data-vibe-font]')) return;
    const style = document.createElement('style');
    style.setAttribute('data-vibe-font', 'true');
    const fontUrl = chrome.runtime.getURL('assets/fonts/InterVariable.woff2');
    style.textContent = `
      @font-face {
        font-family: 'Inter';
        src: url('${fontUrl}') format('woff2-variations');
        font-weight: 100 900;
        font-display: swap;
      }
    `;
    document.head.appendChild(style);
  }

  // --- Initialize all modules ---
  async function init() {
    injectFontFace();

    // 1. Shadow host + styles
    VibeShadowHost.init();

    // 1b. Overlay hidden state — persisted in chrome.storage.local
    const overlayClosed = await VibeAPI.getOverlayHidden();

    // 1c. Show overlay if not closed (starts hidden to avoid flash)
    if (!overlayClosed) {
      VibeShadowHost.show();
    }

    // 2. Theme
    await VibeThemeManager.init();

    // 3. API bridge is stateless, no init needed

    // 4. Load annotations
    annotations = await VibeAPI.loadAnnotations();

    // 5. Initialize modules
    VibeBadgeManager.init();
    VibeInspectionMode.init();
    VibeAnnotationPopover.init();
    VibeBridgeHandler.init(() => annotations);
    await VibeToolbar.init();

    // 6. Set up message listener (popup ↔ content)
    setupMessageListener();

    // 7. Set up storage listener for external changes
    setupStorageListener();

    // 7b. Set up SPA route change detection
    setupRouteChangeDetection();

    // 8. Set up keyboard shortcuts
    setupKeyboardShortcuts();

    // 9. Wire up annotation lifecycle events
    setupAnnotationEvents();

    // 10. Wait for hydration, then show badges (skip if overlay is closed)
    if (!overlayClosed) {
      waitForHydrationAndShowAnnotations();
    }
  }

  // --- Message listener (popup communication) ---
  function setupMessageListener() {
    chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
      switch (request.action) {
        case 'startAnnotationMode':
          VibeEvents.emit('inspection:start');
          sendResponse({ success: true });
          break;

        case 'stopAnnotationMode':
          VibeEvents.emit('inspection:stop');
          sendResponse({ success: true });
          break;

        case 'getAnnotationModeStatus':
          sendResponse({ success: true, isAnnotationMode: VibeInspectionMode.isActive() });
          break;

        case 'toggleOverlay':
          if (VibeShadowHost.isVisible()) {
            // Animate out — toolbar handles the actual hide via animateToolbarOut
            VibeToolbar.animateOut();
            sendResponse({ success: true, visible: false });
          } else {
            VibeShadowHost.show();
            sendResponse({ success: true, visible: true });
          }
          break;

        case 'getOverlayState':
          sendResponse({ success: true, visible: VibeShadowHost.isVisible() });
          break;

        case 'toggleAnnotate':
          if (VibeInspectionMode.isActive()) {
            VibeEvents.emit('inspection:stop');
          } else {
            VibeEvents.emit('inspection:start');
          }
          sendResponse({ success: true });
          break;

        case 'highlightAnnotation':
          VibeBadgeManager.highlightElement(request.annotation);
          sendResponse({ success: true });
          break;

        case 'targetAnnotationElement':
          VibeBadgeManager.targetBadge(request.annotation?.id);
          sendResponse({ success: true });
          break;

        case 'annotationsUpdated':
          // Server sync detected changes (e.g. MCP deletion) — reload from storage
          VibeAPI.loadAnnotations().then(fresh => {
            annotations = fresh;
            if (VibeShadowHost.isVisible()) {
              VibeEvents.emit('annotations:render', annotations);
            }
          }).catch(() => {});
          sendResponse({ success: true });
          break;

        default:
          sendResponse({ success: false, error: 'Unknown action' });
      }
      return true;
    });
  }

  // --- SPA route change detection ---
  function setupRouteChangeDetection() {
    let currentURL = window.location.href;

    function onRouteChange() {
      const newURL = window.location.href;
      if (newURL === currentURL) return;
      currentURL = newURL;
      reloadAnnotationsForCurrentRoute();
    }

    // Back/forward navigation
    window.addEventListener('popstate', onRouteChange);

    // Hash-based routers
    window.addEventListener('hashchange', onRouteChange);

    // Detect pushState/replaceState navigations via DOM observation.
    // SPAs update the URL without firing popstate/hashchange, but they
    // almost always mutate <title> or other head elements on navigation.
    // A MutationObserver on <head> catches these changes without polling.
    const headObserver = new MutationObserver(() => onRouteChange());
    if (document.head) {
      headObserver.observe(document.head, { childList: true, subtree: true, characterData: true });
    }
    // Also observe URL changes via the Navigation API if available (Chrome 102+)
    if (typeof navigation !== 'undefined') {
      navigation.addEventListener('navigatesuccess', onRouteChange);
    }
  }

  async function reloadAnnotationsForCurrentRoute() {
    annotations = await VibeAPI.loadAnnotations();
    badgesShown = false;
    if (VibeShadowHost.isVisible()) {
      VibeBadgeManager.clearAll();
      // Immediately update toolbar count so it doesn't show stale numbers
      VibeEvents.emit('badges:rendered', { count: 0, total: annotations.length });

      // Wait briefly for new route's DOM to render, then show badges
      waitForDOMStability(() => {
        badgesShown = true;
        showAnnotationsWithRetry();
      });
    }
  }

  // --- Storage listener ---
  function setupStorageListener() {
    VibeAPI.onAnnotationsChanged((allAnnotations) => {
      if (localSaveCount > 0) {
        localSaveCount--;
        return;
      }
      annotations = (allAnnotations || []).filter(a => a.url === window.location.href);
      // Don't re-render if overlay is closed (styles should stay stripped)
      if (VibeShadowHost.isVisible()) {
        VibeEvents.emit('annotations:render', annotations);
      }
    });
  }

  // --- Keyboard shortcuts ---
  function setupKeyboardShortcuts() {
    let customShortcut = null;

    // Load custom shortcut from storage
    VibeAPI.getCustomShortcut().then(s => { customShortcut = s; }).catch(() => {});

    // Listen for storage changes to update live
    chrome.storage.onChanged.addListener((changes, ns) => {
      if (ns === 'local' && changes.vibeCustomShortcut) {
        customShortcut = changes.vibeCustomShortcut.newValue || null;
      }
    });

    document.addEventListener('keydown', (e) => {
      // ESC — stop annotation mode
      if (e.key === 'Escape' && VibeInspectionMode.isActive()) {
        VibeEvents.emit('inspection:stop');
        return;
      }

      // Custom shortcut — toggle annotation mode
      if (customShortcut && matchesShortcut(e, customShortcut)) {
        e.preventDefault();
        if (VibeInspectionMode.isActive()) {
          VibeEvents.emit('inspection:stop');
        } else {
          VibeEvents.emit('inspection:start');
        }
      }
    });
  }

  function matchesShortcut(e, shortcut) {
    return e.key === shortcut.key
      && e.ctrlKey === !!shortcut.ctrlKey
      && e.metaKey === !!shortcut.metaKey
      && e.shiftKey === !!shortcut.shiftKey
      && e.altKey === !!shortcut.altKey;
  }

  // --- Annotation lifecycle ---
  function setupAnnotationEvents() {
    // New annotation saved
    VibeEvents.on('annotation:saved', ({ annotation, element }) => {
      localSaveCount++;
      // Deduplicate — storage listener may have already added it
      if (!annotations.some(a => a.id === annotation.id)) {
        annotations.push(annotation);
      }
      // Re-render all badges to get consistent numbering
      VibeEvents.emit('annotations:render', annotations);
    });

    // Annotation updated
    VibeEvents.on('annotation:updated', ({ id, comment, pending_changes, css }) => {
      localSaveCount++;
      const idx = annotations.findIndex(a => a.id === id);
      if (idx !== -1) {
        const updates = { comment, updated_at: new Date().toISOString() };
        if (pending_changes !== undefined) updates.pending_changes = pending_changes;
        if (css !== undefined) updates.css = css;
        annotations[idx] = { ...annotations[idx], ...updates };
      }
    });

    // Annotation deleted
    VibeEvents.on('annotation:deleted', ({ id }) => {
      localSaveCount++;
      annotations = annotations.filter(a => a.id !== id);
      // Re-render to update numbering
      VibeEvents.emit('annotations:render', annotations);
    });

    // Overlay closed — strip all visual changes from page
    VibeEvents.on('overlay:closed', () => {
      VibeBadgeManager.clearAll(annotations);
    });

    // Overlay opened — re-apply visual changes
    VibeEvents.on('overlay:opened', () => {
      badgesShown = false;
      showAnnotationsWithRetry();
    });

    // All annotations cleared
    VibeEvents.on('annotations:cleared', ({ count } = {}) => {
      // Each delete triggers a storage change; suppress all of them
      localSaveCount += count || annotations.length || 1;
      VibeBadgeManager.clearAll(annotations);
      annotations = [];
      VibeEvents.emit('badges:rendered', { count: 0, total: 0 });
    });
  }

  // --- Hydration waiting (framework support) ---
  let badgesShown = false;
  function waitForHydrationAndShowAnnotations() {
    const showBadges = () => {
      if (badgesShown) return;
      badgesShown = true;
      showAnnotationsWithRetry();
    };

    if (document.readyState === 'complete') {
      waitForDOMStability(showBadges);
    } else {
      window.addEventListener('load', () => waitForDOMStability(showBadges), { once: true });
    }

    // Fallback
    setTimeout(showBadges, 8000);
  }

  function waitForDOMStability(callback) {
    let stabilityTimer;
    let mutationCount = 0;
    const maxMutations = 10;
    const stabilityDelay = 1500;

    const observer = new MutationObserver(() => {
      mutationCount++;
      clearTimeout(stabilityTimer);
      if (mutationCount > maxMutations) {
        observer.disconnect();
        setTimeout(callback, 500);
        return;
      }
      stabilityTimer = setTimeout(() => { observer.disconnect(); callback(); }, stabilityDelay);
    });

    observer.observe(document.body, { childList: true, subtree: true });
    stabilityTimer = setTimeout(() => { observer.disconnect(); callback(); }, stabilityDelay);
  }

  let lazyObserver = null;
  function showAnnotationsWithRetry(maxAttempts = 5, delay = 500) {
    // Clean up previous lazy observer
    if (lazyObserver) { lazyObserver.disconnect(); lazyObserver = null; }

    const elementAnnotations = annotations.filter(a => a.type !== 'stylesheet');
    let attempts = 0;
    const tryShow = () => {
      attempts++;
      VibeEvents.emit('annotations:render', annotations);
      const found = VibeBadgeManager.getCount();
      if (found < elementAnnotations.length && attempts < maxAttempts) {
        setTimeout(tryShow, delay);
      }
      // After retries exhausted, if still missing badges, watch for lazy-loaded content
      if (attempts >= maxAttempts && found < elementAnnotations.length) {
        startLazyElementObserver();
      }
    };
    tryShow();
  }

  // Persistent observer for code-split / lazy-loaded components that arrive late
  function startLazyElementObserver() {
    if (lazyObserver) lazyObserver.disconnect();

    let debounceTimer = null;
    const elementCount = annotations.filter(a => a.type !== 'stylesheet').length;
    lazyObserver = new MutationObserver(() => {
      clearTimeout(debounceTimer);
      debounceTimer = setTimeout(() => {
        VibeEvents.emit('annotations:render', annotations);
        const found = VibeBadgeManager.getCount();
        // All badges found — stop watching
        if (found >= elementCount) {
          lazyObserver.disconnect();
          lazyObserver = null;
        }
      }, 300);
    });

    lazyObserver.observe(document.body, { childList: true, subtree: true });

    // Safety: stop after 30s to avoid indefinite observation
    setTimeout(() => {
      if (lazyObserver) {
        lazyObserver.disconnect();
        lazyObserver = null;
      }
    }, 30000);
  }

  // --- Boot ---
  function safeBoot() {
    init().catch(err => console.error('[Vibe] Init failed:', err));
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', safeBoot);
  } else {
    safeBoot();
  }
})();
