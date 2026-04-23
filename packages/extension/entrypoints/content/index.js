// Vibe Annotations content-script entrypoint.
// Orchestrates all modules that used to be IIFEs sharing globals.

import VibeAPI from '../../lib/content/api-bridge.js';
import VibeEvents from '../../lib/content/event-bus.js';
import VibeShadowHost from '../../lib/content/shadow-host.js';
import VibeThemeManager from '../../lib/content/theme-manager.js';
import VibeBadgeManager from '../../lib/content/badge-manager.js';
import VibeInspectionMode from '../../lib/content/inspection-mode.js';
import VibeAnnotationPopover from '../../lib/content/annotation-popover.js';
import VibeBridgeHandler from '../../lib/content/bridge-handler.js';
import VibeToolbar from '../../lib/content/floating-toolbar.js';

// --- State ---
let annotations = [];
let localSaveCount = 0;
let badgesShown = false;
let lazyObserver = null;

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
        VibeAPI.loadAnnotations().then((fresh) => {
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

  window.addEventListener('popstate', onRouteChange);
  window.addEventListener('hashchange', onRouteChange);

  // SPAs update the URL via pushState/replaceState without firing popstate, but they
  // almost always mutate <title> or other head elements on navigation.
  // A MutationObserver on <head> catches these changes without polling.
  const headObserver = new MutationObserver(() => onRouteChange());
  if (document.head) {
    headObserver.observe(document.head, { childList: true, subtree: true, characterData: true });
  }
  if (typeof navigation !== 'undefined') {
    navigation.addEventListener('navigatesuccess', onRouteChange);
  }
}

async function reloadAnnotationsForCurrentRoute() {
  annotations = await VibeAPI.loadAnnotations();
  badgesShown = false;
  if (VibeShadowHost.isVisible()) {
    VibeBadgeManager.clearAll();
    VibeEvents.emit('badges:rendered', { count: 0, total: annotations.length });

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
    annotations = (allAnnotations || []).filter((a) => a.url === window.location.href);
    if (VibeShadowHost.isVisible()) {
      VibeEvents.emit('annotations:render', annotations);
    }
  });
}

// --- Keyboard shortcuts ---
function setupKeyboardShortcuts() {
  let customShortcut = null;

  VibeAPI.getCustomShortcut().then((s) => { customShortcut = s; }).catch(() => {});

  chrome.storage.onChanged.addListener((changes, ns) => {
    if (ns === 'local' && changes.vibeCustomShortcut) {
      customShortcut = changes.vibeCustomShortcut.newValue || null;
    }
  });

  document.addEventListener('keydown', (e) => {
    if (e.key === 'Escape' && VibeInspectionMode.isActive()) {
      VibeEvents.emit('inspection:stop');
      return;
    }

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
  VibeEvents.on('annotation:saved', ({ annotation }) => {
    localSaveCount++;
    if (!annotations.some((a) => a.id === annotation.id)) {
      annotations.push(annotation);
    }
    VibeEvents.emit('annotations:render', annotations);
  });

  VibeEvents.on('annotation:updated', ({ id, comment, pending_changes, css }) => {
    localSaveCount++;
    const idx = annotations.findIndex((a) => a.id === id);
    if (idx !== -1) {
      const updates = { comment, updated_at: new Date().toISOString() };
      if (pending_changes !== undefined) updates.pending_changes = pending_changes;
      if (css !== undefined) updates.css = css;
      annotations[idx] = { ...annotations[idx], ...updates };
    }
  });

  VibeEvents.on('annotation:deleted', ({ id }) => {
    localSaveCount++;
    annotations = annotations.filter((a) => a.id !== id);
    VibeEvents.emit('annotations:render', annotations);
  });

  VibeEvents.on('overlay:closed', () => {
    VibeBadgeManager.clearAll(annotations);
  });

  VibeEvents.on('overlay:opened', () => {
    badgesShown = false;
    showAnnotationsWithRetry();
  });

  VibeEvents.on('annotations:cleared', ({ count } = {}) => {
    localSaveCount += count || annotations.length || 1;
    VibeBadgeManager.clearAll(annotations);
    annotations = [];
    VibeEvents.emit('badges:rendered', { count: 0, total: 0 });
  });
}

// --- Hydration waiting (framework support) ---
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
  if (lazyObserver) { lazyObserver.disconnect(); lazyObserver = null; }

  const elementAnnotations = annotations.filter((a) => a.type !== 'stylesheet');
  let attempts = 0;
  const tryShow = () => {
    attempts++;
    VibeEvents.emit('annotations:render', annotations);
    const found = VibeBadgeManager.getCount();
    if (found < elementAnnotations.length && attempts < maxAttempts) {
      setTimeout(tryShow, delay);
    }
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
  const elementCount = annotations.filter((a) => a.type !== 'stylesheet').length;
  lazyObserver = new MutationObserver(() => {
    clearTimeout(debounceTimer);
    debounceTimer = setTimeout(() => {
      VibeEvents.emit('annotations:render', annotations);
      const found = VibeBadgeManager.getCount();
      if (found >= elementCount) {
        lazyObserver.disconnect();
        lazyObserver = null;
      }
    }, 300);
  });

  lazyObserver.observe(document.body, { childList: true, subtree: true });

  setTimeout(() => {
    if (lazyObserver) {
      lazyObserver.disconnect();
      lazyObserver = null;
    }
  }, 30000);
}

export default defineContentScript({
  matches: [
    'http://localhost/*',
    'https://localhost/*',
    'http://127.0.0.1/*',
    'https://127.0.0.1/*',
    'http://0.0.0.0/*',
    'https://0.0.0.0/*',
    'http://*.local/*',
    'https://*.local/*',
    'http://*.test/*',
    'https://*.test/*',
    'http://*.localhost/*',
    'https://*.localhost/*',
    'file:///*',
  ],
  allFrames: true,
  runAt: 'document_idle',
  cssInjectionMode: 'manual',
  main() {
    init().catch((err) => console.error('[Vibe] Init failed:', err));
  },
});
