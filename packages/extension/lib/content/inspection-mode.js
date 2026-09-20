// Inspection mode: hover highlight + click capture
// All visual feedback happens inside shadow DOM (highlight overlay div)
// No host DOM mutation during inspection

import VibeEvents from './event-bus.js';
import VibeShadowDOMUtils from './shadow-dom-utils.js';
import VibeShadowHost from './shadow-host.js';
import VibeElementContext from './element-context.js';

  let active = false;
  let highlightEl = null;
  let labelEl = null;
  let hoveredElement = null;
  let navigatedByKeyboard = false;
  let navStack = []; // ancestors visited via ArrowUp, for ArrowDown to retrace

  // Bound handlers for removal
  let onMouseOver = null;
  let onMouseOut = null;
  let onPointerMove = null;
  let onPointerDown = null;
  let onMouseDown = null;
  let onPointerUp = null;
  let onMouseUp = null;
  let onPointerCancel = null;
  let onClick = null;
  let swallowingClick = false;
  let swallowTimeout = null;

  function getEventTarget() {
    return typeof window !== 'undefined' ? window : document;
  }

  function init() {
    VibeEvents.on('inspection:start', start);
    VibeEvents.on('inspection:stop', stop);
  }

  function start() {
    if (active) return;
    active = true;

    const root = VibeShadowHost.getRoot();
    if (!root) return;

    // Create highlight overlay + its selector label (a child so it rides along)
    highlightEl = document.createElement('div');
    highlightEl.className = 'vibe-highlight';
    highlightEl.style.display = 'none';
    labelEl = document.createElement('div');
    labelEl.className = 'vibe-inspect-label';
    highlightEl.appendChild(labelEl);
    root.appendChild(highlightEl);

    // Set up capture-phase listeners on window (or document)
    // Window capture listeners execute BEFORE any document capture listeners
    // (such as Base UI / Floating UI / Radix UI dialog dismiss listeners).
    const target = getEventTarget();
    onMouseOver = handleMouseOver;
    onMouseOut = handleMouseOut;
    onPointerMove = throttle(handlePointerMove, 16); // ~60fps cap
    onPointerDown = handlePointerDown;
    onMouseDown = handleMouseDown;
    onPointerUp = handlePointerUp;
    onMouseUp = handleMouseUp;
    onPointerCancel = handlePointerCancel;
    onClick = handleClick;

    target.addEventListener('mouseover', onMouseOver, true);
    target.addEventListener('mouseout', onMouseOut, true);
    target.addEventListener('pointermove', onPointerMove, true);
    target.addEventListener('pointerdown', onPointerDown, true);
    target.addEventListener('mousedown', onMouseDown, true);
    target.addEventListener('pointerup', onPointerUp, true);
    target.addEventListener('mouseup', onMouseUp, true);
    target.addEventListener('pointercancel', onPointerCancel, true);
    target.addEventListener('click', onClick, true);
    listenersAttached = true;

    // Crosshair cursor on all host page elements
    const cursorStyle = document.createElement('style');
    cursorStyle.setAttribute('data-vibe-cursor', '');
    cursorStyle.textContent = '*, *::before, *::after { cursor: crosshair !important; }';
    document.head.appendChild(cursorStyle);

    VibeEvents.emit('inspection:started');
  }

  function stop() {
    if (!active) return;
    active = false;
    clearTimeout(swallowTimeout);
    swallowingClick = false;

    // Remove listeners
    if (listenersAttached) {
      const target = getEventTarget();
      target.removeEventListener('mouseover', onMouseOver, true);
      target.removeEventListener('mouseout', onMouseOut, true);
      target.removeEventListener('pointermove', onPointerMove, true);
      target.removeEventListener('pointerdown', onPointerDown, true);
      target.removeEventListener('mousedown', onMouseDown, true);
      target.removeEventListener('pointerup', onPointerUp, true);
      target.removeEventListener('mouseup', onMouseUp, true);
      target.removeEventListener('pointercancel', onPointerCancel, true);
      target.removeEventListener('click', onClick, true);
      listenersAttached = false;
    }
    onMouseOver = onMouseOut = onPointerMove = onPointerDown = onMouseDown = null;
    onPointerUp = onMouseUp = onPointerCancel = onClick = null;

    // Remove highlight (the label is a child, removed with it)
    if (highlightEl) { highlightEl.remove(); highlightEl = null; }
    labelEl = null;

    hoveredElement = null;
    navigatedByKeyboard = false;
    navStack = [];

    // Restore cursor
    const cursorStyle = document.querySelector('[data-vibe-cursor]');
    if (cursorStyle) cursorStyle.remove();

    VibeEvents.emit('inspection:stopped');
  }

  function isActive() {
    return active;
  }

  let listenersAttached = false;

  // --- Shadow-aware target resolution ---

  // Get the deepest actual element from the event's composed path
  function getDeepTarget(e) {
    const path = e.composedPath?.() || [];
    for (const node of path) {
      if (node instanceof Element) return node;
    }
    return e.target instanceof Element ? e.target : null;
  }

  function isOurUI(e) {
    const path = e.composedPath();
    const host = VibeShadowHost.getHost();
    return host && path.includes(host);
  }

  // --- Throttle utility ---

  function throttle(fn, ms) {
    let last = 0;
    return function(e) {
      const now = performance.now();
      if (now - last < ms) return;
      last = now;
      fn(e);
    };
  }

  function tempDisable() {
    clearTimeout(swallowTimeout);
    swallowingClick = false;

    // Remove listeners but keep active=true so we can re-enable
    if (listenersAttached) {
      const target = getEventTarget();
      target.removeEventListener('mouseover', onMouseOver, true);
      target.removeEventListener('mouseout', onMouseOut, true);
      target.removeEventListener('pointermove', onPointerMove, true);
      target.removeEventListener('pointerdown', onPointerDown, true);
      target.removeEventListener('mousedown', onMouseDown, true);
      target.removeEventListener('pointerup', onPointerUp, true);
      target.removeEventListener('mouseup', onMouseUp, true);
      target.removeEventListener('pointercancel', onPointerCancel, true);
      target.removeEventListener('click', onClick, true);
      listenersAttached = false;
    }
    if (highlightEl) highlightEl.style.display = 'none';
    hoveredElement = null;
    navigatedByKeyboard = false;
    navStack = [];
  }

  function reEnable() {
    if (!active || listenersAttached) return;
    const target = getEventTarget();
    target.addEventListener('mouseover', onMouseOver, true);
    target.addEventListener('mouseout', onMouseOut, true);
    target.addEventListener('pointermove', onPointerMove, true);
    target.addEventListener('pointerdown', onPointerDown, true);
    target.addEventListener('mousedown', onMouseDown, true);
    target.addEventListener('pointerup', onPointerUp, true);
    target.addEventListener('mouseup', onMouseUp, true);
    target.addEventListener('pointercancel', onPointerCancel, true);
    target.addEventListener('click', onClick, true);
    listenersAttached = true;
  }

  // --- Handlers ---

  function handleMouseOver(e) {
    if (!active || isOurUI(e)) return;
    e.stopPropagation();

    const target = getDeepTarget(e) || VibeShadowDOMUtils.elementFromPointDeep(e.clientX, e.clientY);
    if (!target) return;

    hoveredElement = target;
    updateHighlight(target);
  }

  function handleMouseOut(e) {
    if (!active || isOurUI(e)) return;
    e.stopPropagation();

    // Ignore intermediate transitions between elements
    if (e.relatedTarget) return;

    hoveredElement = null;
    if (highlightEl) highlightEl.style.display = 'none';
  }

  // Reliable hover across nested shadow roots — pointermove fires for
  // shadow DOM children where mouseover only reports the host.
  // Throttled to ~60fps to avoid performance overhead.
  function handlePointerMove(e) {
    if (!active || isOurUI(e)) return;

    const target = getDeepTarget(e) || VibeShadowDOMUtils.elementFromPointDeep(e.clientX, e.clientY);
    if (!target || target === document.body || target === document.documentElement) return;
    if (target === hoveredElement) return;

    // After keyboard nav, ignore mousemove within the selected element's subtree
    if (navigatedByKeyboard && hoveredElement && hoveredElement.contains(target)) return;

    hoveredElement = target;
    navigatedByKeyboard = false;
    navStack = [];
    updateHighlight(target);
  }

  // Element selection on pointerdown — fires before frameworks can react
  function handlePointerDown(e) {
    if (!active || isOurUI(e)) return;

    e.preventDefault();
    e.stopImmediatePropagation();

    // Prefer keyboard-navigated element over click target
    const target = (navigatedByKeyboard && hoveredElement?.isConnected) ? hoveredElement : getDeepTarget(e);
    if (!target || target === document.body || target === document.documentElement) return;

    // Visually dismiss highlight
    if (highlightEl) highlightEl.style.display = 'none';
    hoveredElement = null;
    navigatedByKeyboard = false;
    navStack = [];

    // Detach hover and key listeners immediately
    const eventTarget = getEventTarget();
    eventTarget.removeEventListener('mouseover', onMouseOver, true);
    eventTarget.removeEventListener('mouseout', onMouseOut, true);
    eventTarget.removeEventListener('pointermove', onPointerMove, true);

    // Keep click-sequence swallowers (mousedown, pointerup, mouseup, click) active
    // so the remainder of this click does not leak into host frameworks/dialogs!
    swallowingClick = true;
    clearTimeout(swallowTimeout);
    swallowTimeout = setTimeout(() => {
      endClickSwallow();
    }, 400);

    VibeEvents.emit('inspection:elementClicked', { element: target, clientX: e.clientX, clientY: e.clientY });
  }

  function endClickSwallow() {
    clearTimeout(swallowTimeout);
    swallowingClick = false;
    tempDisable();
  }

  // Arrow key DOM navigation — ↑ parent, ↓ retrace path back to anchor
  function handleNavigationKey(e) {
    if (!active) return false;
    if (e.key !== 'ArrowUp' && e.key !== 'ArrowDown' && e.key !== 'Enter') return false;

    // Blur any focused toolbar element so it doesn't steal subsequent keys
    const root = VibeShadowHost.getRoot();
    if (root && root.activeElement) root.activeElement.blur();

    const current = hoveredElement;
    if (!current) return true;

    // Enter — select the currently highlighted element
    if (e.key === 'Enter') {
      const rect = current.getBoundingClientRect();
      tempDisable();
      VibeEvents.emit('inspection:elementClicked', {
        element: current,
        clientX: rect.left + rect.width / 2,
        clientY: rect.top + rect.height / 2
      });
      return true;
    }

    let next;
    if (e.key === 'ArrowUp') {
      next = VibeShadowDOMUtils.getNavigableParent(current);
      if (!next || !next.isConnected) return true;
      if (next === document.documentElement || next === document.body) return true;
      // Push current onto stack so ArrowDown can retrace
      navStack.push(current);
    } else {
      // ArrowDown — retrace the path back toward the anchor element
      if (navStack.length === 0) return true;
      next = navStack.pop();
      if (!next || !next.isConnected) { navStack = []; return true; }
    }

    hoveredElement = next;
    navigatedByKeyboard = true;
    updateHighlight(next);
    return true;
  }

  // Safety nets — swallow all remaining mouse events of the interaction
  // so frameworks and dialog dismiss handlers never see them.
  function handleMouseDown(e) {
    if (!active || isOurUI(e)) return;
    e.preventDefault();
    e.stopImmediatePropagation();
  }

  function handlePointerUp(e) {
    if (!active || isOurUI(e)) return;
    e.preventDefault();
    e.stopImmediatePropagation();
  }

  function handleMouseUp(e) {
    if (!active || isOurUI(e)) return;
    e.preventDefault();
    e.stopImmediatePropagation();
  }

  function handlePointerCancel(e) {
    if (!active || isOurUI(e)) return;
    e.preventDefault();
    e.stopImmediatePropagation();
    if (swallowingClick) {
      endClickSwallow();
    }
  }

  function handleClick(e) {
    if (!active || isOurUI(e)) return;
    e.preventDefault();
    e.stopImmediatePropagation();
    if (swallowingClick) {
      endClickSwallow();
    }
  }

  // --- Visuals ---

  function updateHighlight(element) {
    if (!highlightEl) return;
    const rect = element.getBoundingClientRect();
    highlightEl.style.display = 'block';
    highlightEl.style.top = `${rect.top}px`;
    highlightEl.style.left = `${rect.left}px`;
    highlightEl.style.width = `${rect.width}px`;
    highlightEl.style.height = `${rect.height}px`;

    // Brief selector hint above the rect's top-left; flip inside when the
    // element is too close to the top of the viewport for the label to fit.
    if (labelEl) {
      labelEl.textContent = briefSelectorLabel(element);
      labelEl.classList.toggle('vibe-inspect-label--inside', rect.top < 22);
    }
  }

  // A short, readable hint for the hovered element — tag + id, or tag + its
  // first couple of stable classes. Not the full capture selector (that runs on
  // click); just enough to tell elements apart while hovering.
  function briefSelectorLabel(element) {
    const tag = element.tagName ? element.tagName.toLowerCase() : 'node';
    if (element.id) return `${tag}#${element.id}`.slice(0, 42);
    let out = tag;
    try {
      const classes = (VibeElementContext.getDisplayClasses(element) || []).slice(0, 2);
      out += classes.map((c) => `.${c}`).join('');
    } catch { /* getDisplayClasses is best-effort */ }
    return out.length > 42 ? out.slice(0, 41) + '…' : out;
  }

const VibeInspectionMode = { init, start, stop, isActive, tempDisable, reEnable, handleNavigationKey };
export default VibeInspectionMode;
