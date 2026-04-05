// Inspection mode: hover highlight + click capture
// All visual feedback happens inside shadow DOM (highlight overlay div)
// No host DOM mutation during inspection

var VibeInspectionMode = (() => {
  let active = false;
  let highlightEl = null;
  let toastEl = null;
  let hoveredElement = null;
  let navigatedByKeyboard = false;
  let navStack = []; // ancestors visited via ArrowUp, for ArrowDown to retrace
  let tempDisabled = false;
  let modifierSuspended = false;
  const isMac = navigator.platform.toUpperCase().indexOf('MAC') >= 0;

  // Bound handlers for removal
  let onMouseOver = null;
  let onMouseOut = null;
  let onPointerMove = null;
  let onPointerDown = null;
  let onMouseDown = null;
  let onClick = null;
  let onKeyDown = null;
  let onGlobalKeyDown = null;
  let onGlobalKeyUp = null;
  let onWindowBlur = null;

  function init() {
    VibeEvents.on('inspection:start', start);
    VibeEvents.on('inspection:stop', stop);
  }

  function start() {
    if (active) return;
    active = true;
    tempDisabled = false;
    modifierSuspended = false;

    const root = VibeShadowHost.getRoot();
    if (!root) return;

    // Create highlight overlay
    highlightEl = document.createElement('div');
    highlightEl.className = 'vibe-highlight';
    highlightEl.style.display = 'none';
    root.appendChild(highlightEl);

    // Show instruction toast
    showToast(root);

    // Set up capture-phase listeners on document
    onMouseOver = handleMouseOver;
    onMouseOut = handleMouseOut;
    onPointerMove = throttle(handlePointerMove, 16); // ~60fps cap
    onPointerDown = handlePointerDown;
    onMouseDown = handleMouseDown;
    onClick = handleClick;
    onKeyDown = handleKeyDown;
    onGlobalKeyDown = handleGlobalKeyDown;
    onGlobalKeyUp = handleGlobalKeyUp;
    onWindowBlur = handleWindowBlur;

    attachInteractionListeners();
    document.addEventListener('keydown', onGlobalKeyDown, true);
    document.addEventListener('keyup', onGlobalKeyUp, true);
    window.addEventListener('blur', onWindowBlur);

    // Crosshair cursor on all host page elements
    setInspectionCursorEnabled(true);

    VibeEvents.emit('inspection:started');
  }

  function stop() {
    if (!active) return;
    active = false;
    tempDisabled = false;
    modifierSuspended = false;

    // Remove listeners
    detachInteractionListeners();
    document.removeEventListener('keydown', onGlobalKeyDown, true);
    document.removeEventListener('keyup', onGlobalKeyUp, true);
    window.removeEventListener('blur', onWindowBlur);
    onMouseOver = onMouseOut = onPointerMove = onPointerDown = onMouseDown = onClick = onKeyDown = null;
    onGlobalKeyDown = onGlobalKeyUp = onWindowBlur = null;
    // Remove highlight
    if (highlightEl) { highlightEl.remove(); highlightEl = null; }

    // Remove toast
    if (toastEl) { toastEl.remove(); toastEl = null; }

    hoveredElement = null;
    navigatedByKeyboard = false;
    navStack = [];

    // Restore cursor
    setInspectionCursorEnabled(false);

    VibeEvents.emit('inspection:stopped');
  }

  function isActive() {
    return active;
  }

  let listenersAttached = false;

  function attachInteractionListeners() {
    if (listenersAttached) return;
    document.addEventListener('mouseover', onMouseOver, true);
    document.addEventListener('mouseout', onMouseOut, true);
    document.addEventListener('pointermove', onPointerMove, true);
    document.addEventListener('pointerdown', onPointerDown, true);
    document.addEventListener('mousedown', onMouseDown, true);
    document.addEventListener('click', onClick, true);
    document.addEventListener('keydown', onKeyDown, true);
    listenersAttached = true;
  }

  function detachInteractionListeners() {
    if (!listenersAttached) return;
    document.removeEventListener('mouseover', onMouseOver, true);
    document.removeEventListener('mouseout', onMouseOut, true);
    document.removeEventListener('pointermove', onPointerMove, true);
    document.removeEventListener('pointerdown', onPointerDown, true);
    document.removeEventListener('mousedown', onMouseDown, true);
    document.removeEventListener('click', onClick, true);
    document.removeEventListener('keydown', onKeyDown, true);
    listenersAttached = false;
  }

  function setInspectionCursorEnabled(enabled) {
    const cursorStyle = document.querySelector('[data-vibe-cursor]');
    if (enabled) {
      if (cursorStyle) return;
      const style = document.createElement('style');
      style.setAttribute('data-vibe-cursor', '');
      style.textContent = '*, *::before, *::after { cursor: crosshair !important; }';
      document.head.appendChild(style);
      return;
    }
    if (cursorStyle) cursorStyle.remove();
  }

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
    tempDisabled = true;
    suspendInteractions();
  }

  function reEnable() {
    tempDisabled = false;
    if (!active || modifierSuspended) return;
    attachInteractionListeners();
  }

  function suspendInteractions() {
    detachInteractionListeners();
    if (highlightEl) highlightEl.style.display = 'none';
    hoveredElement = null;
    navigatedByKeyboard = false;
    navStack = [];
  }

  function isPrimaryModifierKey(key) {
    return isMac ? key === 'Meta' : key === 'Control';
  }

  function isPrimaryModifierPressed(e) {
    return isMac ? !!e.metaKey : !!e.ctrlKey;
  }

  function handleGlobalKeyDown(e) {
    if (!active || modifierSuspended) return;
    if (!isPrimaryModifierKey(e.key) && !isPrimaryModifierPressed(e)) return;

    modifierSuspended = true;
    suspendInteractions();
    setInspectionCursorEnabled(false);
  }

  function handleGlobalKeyUp(e) {
    if (!active || !modifierSuspended) return;
    if (isPrimaryModifierPressed(e)) return;

    modifierSuspended = false;
    setInspectionCursorEnabled(true);
    if (!tempDisabled) attachInteractionListeners();
  }

  function handleWindowBlur() {
    if (!active || !modifierSuspended) return;
    modifierSuspended = false;
    setInspectionCursorEnabled(true);
    if (!tempDisabled) attachInteractionListeners();
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
  }

  function showToast(root) {
    toastEl = document.createElement('div');
    toastEl.className = 'vibe-toast';
    toastEl.innerHTML = `
      <p>Click any element to annotate</p>
      <p class="sub">↑/↓ to traverse DOM · Enter to select · ESC to exit</p>
    `;
    root.appendChild(toastEl);

    // Auto-fade after 3s
    setTimeout(() => {
      if (!toastEl) return;
      toastEl.classList.add('vibe-toast--out');
      setTimeout(() => {
        if (toastEl) { toastEl.remove(); toastEl = null; }
      }, 250);
    }, 3000);
  }

  return { init, start, stop, isActive, tempDisable, reEnable };
})();
