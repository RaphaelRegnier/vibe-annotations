// Inspection mode: hover highlight + click capture
// All visual feedback happens inside shadow DOM (highlight overlay div)
// No host DOM mutation during inspection

var VibeInspectionMode = (() => {
  let active = false;
  let highlightEl = null;
  let toastEl = null;
  let hoveredElement = null;

  // Bound handlers for removal
  let onMouseOver = null;
  let onMouseOut = null;
  let onPointerMove = null;
  let onPointerDown = null;
  let onMouseDown = null;
  let onClick = null;

  function init() {
    VibeEvents.on('inspection:start', start);
    VibeEvents.on('inspection:stop', stop);
  }

  function start() {
    if (active) return;
    active = true;

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

    document.addEventListener('mouseover', onMouseOver, true);
    document.addEventListener('mouseout', onMouseOut, true);
    document.addEventListener('pointermove', onPointerMove, true);
    document.addEventListener('pointerdown', onPointerDown, true);
    document.addEventListener('mousedown', onMouseDown, true);
    document.addEventListener('click', onClick, true);
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
      listenersAttached = false;
    }
    onMouseOver = onMouseOut = onPointerMove = onPointerDown = onMouseDown = onClick = null;

    // Remove highlight
    if (highlightEl) { highlightEl.remove(); highlightEl = null; }

    // Remove toast
    if (toastEl) { toastEl.remove(); toastEl = null; }

    hoveredElement = null;

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
      listenersAttached = false;
    }
    if (highlightEl) highlightEl.style.display = 'none';
    hoveredElement = null;
  }

  function reEnable() {
    if (!active || listenersAttached) return;
    document.addEventListener('mouseover', onMouseOver, true);
    document.addEventListener('mouseout', onMouseOut, true);
    document.addEventListener('pointermove', onPointerMove, true);
    document.addEventListener('pointerdown', onPointerDown, true);
    document.addEventListener('mousedown', onMouseDown, true);
    document.addEventListener('click', onClick, true);
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

    hoveredElement = target;
    updateHighlight(target);
  }

  // Element selection on pointerdown — fires before frameworks can react
  function handlePointerDown(e) {
    if (!active || isOurUI(e)) return;

    e.preventDefault();
    e.stopImmediatePropagation();

    const target = getDeepTarget(e);
    if (!target || target === document.body || target === document.documentElement) return;

    tempDisable();
    VibeEvents.emit('inspection:elementClicked', { element: target, clientX: e.clientX, clientY: e.clientY });
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
      <p class="sub">Press ESC to exit</p>
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
