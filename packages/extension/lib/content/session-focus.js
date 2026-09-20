// Remembers which host-page element had DOM focus before an Annotate session and
// gives focus back on exit. Restoration never simulates clicks, never touches the
// host's logical selection, and never scrolls the page (preventScroll).

import VibeEvents from './event-bus.js';
import VibeShadowHost from './shadow-host.js';

let lastHostFocus = null;
let restoreTarget = null;
let wired = false;

// host.contains() does not cross shadow boundaries, so walk the root chain.
function isOurUI(el) {
  const host = VibeShadowHost.getHost?.();
  if (!host || !el) return false;

  let node = el;
  while (node) {
    if (node === host) return true;
    const root = typeof node.getRootNode === 'function' ? node.getRootNode() : null;
    if (!root || root === node || !root.host) return false;
    node = root.host;
  }
  return false;
}

function deepActiveElement() {
  let active = typeof document !== 'undefined' ? document.activeElement : null;
  while (active && active.shadowRoot && active.shadowRoot.activeElement) {
    active = active.shadowRoot.activeElement;
  }
  return active;
}

function isFocusable(el) {
  if (!el || el === document.body || el === document.documentElement) return false;
  if (!el.isConnected || typeof el.focus !== 'function' || el.disabled) return false;
  if (typeof el.getClientRects === 'function') return el.getClientRects().length > 0;
  return true;
}

// Page focus moved somewhere real: remember it in case entering Annotate takes
// DOM focus away from it. Extension UI focus is ignored.
function onFocusIn(e) {
  const path = e.composedPath ? e.composedPath() : [];
  const target = path[0] || e.target;
  if (!target || isOurUI(target)) return;
  if (target === document.body || target === document.documentElement) return;
  lastHostFocus = target;
}

function onSessionStart() {
  const active = deepActiveElement();
  const candidate = active && !isOurUI(active) && active !== document.body ? active : lastHostFocus;
  restoreTarget = isFocusable(candidate) ? candidate : null;
}

function onSessionEnd() {
  const target = restoreTarget;
  restoreTarget = null;
  if (!isFocusable(target)) return;

  // Only restore while focus is ours (or nowhere): a host element focused by the
  // page during the session keeps it.
  const active = deepActiveElement();
  if (active && active !== document.body && !isOurUI(active)) return;

  try {
    target.focus({ preventScroll: true });
  } catch (_) { /* focus() without effect — never fall back to a scrolling focus */ }
}

function init() {
  if (wired) return;
  wired = true;

  document.addEventListener('focusin', onFocusIn, true);
  VibeEvents.on('inspection:start', onSessionStart);
  VibeEvents.on('inspection:stopped', onSessionEnd);
}

function teardown() {
  if (!wired) return;
  wired = false;

  document.removeEventListener('focusin', onFocusIn, true);
  VibeEvents.off('inspection:start', onSessionStart);
  VibeEvents.off('inspection:stopped', onSessionEnd);
  lastHostFocus = null;
  restoreTarget = null;
}

const VibeSessionFocus = { init, teardown };
export default VibeSessionFocus;
