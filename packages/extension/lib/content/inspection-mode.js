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
  let onClick = null;
  let onKeyDown = null;

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

    // Set up capture-phase listeners on document
    onMouseOver = handleMouseOver;
    onMouseOut = handleMouseOut;
    onPointerMove = throttle(handlePointerMove, 16); // ~60fps cap
    onPointerDown = handlePointerDown;
    onMouseDown = handleMouseDown;
    onClick = handleClick;
    onKeyDown = handleKeyDown;

    document.addEventListener('mouseover', onMouseOver, true);
    document.addEventListener('mouseout', onMouseOut, true);
    document.addEventListener('pointermove', onPointerMove, true);
    document.addEventListener('pointerdown', onPointerDown, true);
    document.addEventListener('mousedown', onMouseDown, true);
    document.addEventListener('click', onClick, true);
    document.addEventListener('keydown', onKeyDown, true);
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

    // Remove listeners
    if (listenersAttached) {
      document.removeEventListener('mouseover', onMouseOver, true);
      document.removeEventListener('mouseout', onMouseOut, true);
      document.removeEventListener('pointermove', onPointerMove, true);
      document.removeEventListener('pointerdown', onPointerDown, true);
      document.removeEventListener('mousedown', onMouseDown, true);
      document.removeEventListener('click', onClick, true);
      document.removeEventListener('keydown', onKeyDown, true);
      listenersAttached = false;
    }
    onMouseOver = onMouseOut = onPointerMove = onPointerDown = onMouseDown = onClick = onKeyDown = null;

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
    // Remove listeners but keep active=true so we can re-enable
    if (listenersAttached) {
      document.removeEventListener('mouseover', onMouseOver, true);
      document.removeEventListener('mouseout', onMouseOut, true);
      document.removeEventListener('pointermove', onPointerMove, true);
      document.removeEventListener('pointerdown', onPointerDown, true);
      document.removeEventListener('mousedown', onMouseDown, true);
      document.removeEventListener('click', onClick, true);
      document.removeEventListener('keydown', onKeyDown, true);
      listenersAttached = false;
    }
    if (highlightEl) highlightEl.style.display = 'none';
    hoveredElement = null;
    navigatedByKeyboard = false;
    navStack = [];
  }

  function reEnable() {
    if (!active || listenersAttached) return;
    document.addEventListener('mouseover', onMouseOver, true);
    document.addEventListener('mouseout', onMouseOut, true);
    document.addEventListener('pointermove', onPointerMove, true);
    document.addEventListener('pointerdown', onPointerDown, true);
    document.addEventListener('mousedown', onMouseDown, true);
    document.addEventListener('click', onClick, true);
    document.addEventListener('keydown', onKeyDown, true);
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

    tempDisable();
    VibeEvents.emit('inspection:elementClicked', { element: target, clientX: e.clientX, clientY: e.clientY });
  }

  // Arrow key DOM navigation — ↑ parent, ↓ retrace path back to anchor
  function handleKeyDown(e) {
    if (!active) return;
    if (e.key !== 'ArrowUp' && e.key !== 'ArrowDown' && e.key !== 'Enter') return;

    // Always handle these keys in inspection mode, even if focus is on our toolbar
    e.preventDefault();
    e.stopPropagation();

    // Blur any focused toolbar element so it doesn't steal subsequent keys
    const root = VibeShadowHost.getRoot();
    if (root && root.activeElement) root.activeElement.blur();

    const current = hoveredElement;
    if (!current) return;

    // Enter — select the currently highlighted element
    if (e.key === 'Enter') {
      const rect = current.getBoundingClientRect();
      tempDisable();
      VibeEvents.emit('inspection:elementClicked', {
        element: current,
        clientX: rect.left + rect.width / 2,
        clientY: rect.top + rect.height / 2
      });
      return;
    }

    let next;
    if (e.key === 'ArrowUp') {
      next = VibeShadowDOMUtils.getNavigableParent(current);
      if (!next || !next.isConnected) return;
      if (next === document.documentElement || next === document.body) return;
      // Push current onto stack so ArrowDown can retrace
      navStack.push(current);
    } else {
      // ArrowDown — retrace the path back toward the anchor element
      if (navStack.length === 0) return;
      next = navStack.pop();
      if (!next || !next.isConnected) { navStack = []; return; }
    }

    hoveredElement = next;
    navigatedByKeyboard = true;
    updateHighlight(next);
  }

  // Safety nets — swallow mousedown/click so frameworks never see the interaction
  function handleMouseDown(e) {
    if (!active || isOurUI(e)) return;
    e.preventDefault();
    e.stopPropagation();
  }

  function handleClick(e) {
    if (!active || isOurUI(e)) return;
    e.preventDefault();
    e.stopPropagation();
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

const VibeInspectionMode = { init, start, stop, isActive, tempDisable, reEnable };
export default VibeInspectionMode;
