// Creates and manages the shadow DOM host for all Vibe UI.

import { VIBE_STYLES } from './styles.js';
import VibeAPI from './api-bridge.js';
import VibeEvents from './event-bus.js';

let hostEl = null;
let shadowRoot = null;
let modalObserver = null;
let modalStack = [];

function syncModalHost(records = []) {
  if (!hostEl) return;

  const modals = Array.from(document.querySelectorAll('dialog:modal'));
  const initializing = modalStack.length === 0;
  modalStack = modalStack.filter((dialog) => modals.includes(dialog));
  // Attribute records preserve opening order even when DOM order is different.
  for (const { target, type } of records) {
    if (type !== 'attributes' || !modals.includes(target)) continue;
    modalStack = modalStack.filter((dialog) => dialog !== target);
    modalStack.push(target);
  }
  for (const dialog of modals) {
    if (!modalStack.includes(dialog)) modalStack.push(dialog);
  }

  if (initializing) {
    const focusedModal = document.activeElement?.closest('dialog:modal');
    if (focusedModal) {
      modalStack = modalStack.filter((dialog) => dialog !== focusedModal);
      modalStack.push(focusedModal);
    }
  }

  const parent = modalStack.at(-1) || document.body;
  const moved = hostEl.parentNode !== parent;
  const focused = shadowRoot.activeElement;
  if (moved) {
    if (hostEl.matches(':popover-open')) hostEl.hidePopover();
    parent.appendChild(hostEl);
  }

  // A popover escapes dialog transforms/clipping; modal ancestry removes inertness.
  if (parent !== document.body) {
    hostEl.setAttribute('popover', 'manual');
    if (hostEl.style.display !== 'none' && !hostEl.matches(':popover-open')) {
      hostEl.showPopover();
    }
  } else {
    if (hostEl.matches(':popover-open')) hostEl.hidePopover();
    hostEl.removeAttribute('popover');
  }
  if (moved && focused) focused.focus({ preventScroll: true });
}

function init() {
  if (hostEl) return shadowRoot;

  hostEl = document.createElement('div');
  hostEl.id = 'vibe-annotations-root';
  hostEl.style.cssText = `
    position: fixed !important;
    inset: 0 !important;
    margin: 0 !important;
    padding: 0 !important;
    border: 0 !important;
    background: transparent !important;
    color: inherit !important;
    max-width: none !important;
    max-height: none !important;
    width: 100vw !important;
    height: 100vh !important;
    pointer-events: none !important;
    z-index: 2147483647 !important;
    overflow: visible !important;
  `;

  shadowRoot = hostEl.attachShadow({ mode: 'open' });

  // Inject styles synchronously
  const styleEl = document.createElement('style');
  styleEl.textContent = VIBE_STYLES;
  shadowRoot.appendChild(styleEl);

  // Hidden state is checked async in content.js after init
  // Start hidden to avoid flash, content.js will show if not hidden
  hostEl.style.display = 'none';

  document.body.appendChild(hostEl);
  modalObserver = new MutationObserver(syncModalHost);
  modalObserver.observe(document.body, {
    subtree: true,
    childList: true,
    attributes: true,
    attributeFilter: ['open'],
  });
  syncModalHost();

  // Contain composed events at shadow boundary — prevents frameworks
  // from interpreting shadow DOM interactions as "outside clicks"
  for (const type of ['pointerdown', 'mousedown', 'click', 'focusin', 'focusout']) {
    hostEl.addEventListener(type, (e) => e.stopPropagation());
  }

  return shadowRoot;
}

function getRoot() {
  return shadowRoot;
}

function getHost() {
  return hostEl;
}

function destroy() {
  modalObserver?.disconnect();
  modalObserver = null;
  modalStack = [];
  if (hostEl && hostEl.parentNode) {
    hostEl.parentNode.removeChild(hostEl);
  }
  hostEl = null;
  shadowRoot = null;
}

function hide() {
  if (hostEl) {
    if (hostEl.matches(':popover-open')) hostEl.hidePopover();
    hostEl.style.display = 'none';
  }
  VibeAPI.saveOverlayHidden(true);
}

function show() {
  if (hostEl) {
    hostEl.style.display = '';
    syncModalHost();
  }
  VibeAPI.saveOverlayHidden(false);
  VibeEvents.emit('overlay:shown');
}

function isVisible() {
  return hostEl && hostEl.style.display !== 'none';
}

function toggle() {
  if (isVisible()) { hide(); } else { show(); }
}

const VibeShadowHost = { init, getRoot, getHost, destroy, hide, show, isVisible, toggle };
export default VibeShadowHost;
