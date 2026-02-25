// Vibe Annotations V2 — Entry Point
// Orchestrates all modules loaded via manifest.json content_scripts
// Modules are loaded in order and share execution context (no build step)
console.log('[Vibe] content.js loaded');

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

    // 2. Theme
    await VibeThemeManager.init();

    // 3. API bridge is stateless, no init needed

    // 4. Load annotations
    annotations = await VibeAPI.loadAnnotations();

    // 5. Initialize modules
    VibeBadgeManager.init();
    VibeInspectionMode.init();
    VibeAnnotationPopover.init();
    await VibeToolbar.init();

    // 6. Set up message listener (popup ↔ content)
    setupMessageListener();

    // 7. Set up storage listener for external changes
    setupStorageListener();

    // 8. Set up ESC key
    document.addEventListener('keydown', (e) => {
      if (e.key === 'Escape' && VibeInspectionMode.isActive()) {
        VibeEvents.emit('inspection:stop');
      }
    });

    // 9. Wire up annotation lifecycle events
    setupAnnotationEvents();

    // 10. Wait for hydration, then show badges
    waitForHydrationAndShowAnnotations();
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
          VibeShadowHost.toggle();
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

        default:
          sendResponse({ success: false, error: 'Unknown action' });
      }
      return true;
    });
  }

  // --- Storage listener ---
  function setupStorageListener() {
    VibeAPI.onAnnotationsChanged((allAnnotations) => {
      if (localSaveCount > 0) {
        localSaveCount--;
        return;
      }
      annotations = (allAnnotations || []).filter(a => a.url === window.location.href);
      VibeEvents.emit('annotations:render', annotations);
    });
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
    VibeEvents.on('annotation:updated', ({ id, comment }) => {
      localSaveCount++;
      const idx = annotations.findIndex(a => a.id === id);
      if (idx !== -1) {
        annotations[idx] = { ...annotations[idx], comment, updated_at: new Date().toISOString() };
      }
    });

    // Annotation deleted
    VibeEvents.on('annotation:deleted', ({ id }) => {
      localSaveCount++;
      annotations = annotations.filter(a => a.id !== id);
      // Re-render to update numbering
      VibeEvents.emit('annotations:render', annotations);
    });

    // All annotations cleared
    VibeEvents.on('annotations:cleared', ({ count } = {}) => {
      // Each delete triggers a storage change; suppress all of them
      localSaveCount += count || annotations.length || 1;
      annotations = [];
      VibeBadgeManager.clearAll();
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

  function showAnnotationsWithRetry(maxAttempts = 5, delay = 500) {
    let attempts = 0;
    const tryShow = () => {
      attempts++;
      VibeEvents.emit('annotations:render', annotations);
      const found = VibeBadgeManager.getCount();
      if (found < annotations.length && attempts < maxAttempts) {
        setTimeout(tryShow, delay);
      }
    };
    tryShow();
  }

  // --- Boot ---
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
  } else {
    init();
  }
})();
