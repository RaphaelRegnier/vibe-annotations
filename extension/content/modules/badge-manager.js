// Renders numbered pins (badges) inside shadow DOM
// Position-tracked via RAF loop (only runs when badges exist)
// Zero host DOM modification for display

var VibeBadgeManager = (() => {
  const DESIGN_PROPS = [
    'fontSize','fontWeight','lineHeight','textAlign',
    'paddingTop','paddingRight','paddingBottom','paddingLeft',
    'marginTop','marginRight','marginBottom','marginLeft',
    'display','flexDirection','flexWrap','gap','columnGap','rowGap',
    'justifyContent','alignItems','gridTemplateColumns','gridTemplateRows',
    'borderWidth','borderRadius','borderStyle',
    'color','backgroundColor','borderColor',
    'width','minWidth','maxWidth','height','minHeight','maxHeight'
  ];

  // Get all style props to clear/apply from pending_changes + DESIGN_PROPS
  function getStyleProps(pc) {
    if (!pc) return DESIGN_PROPS;
    const keys = new Set(DESIGN_PROPS);
    for (const k of Object.keys(pc)) keys.add(k);
    return keys;
  }

  let badges = []; // { el, annotation, targetElement }
  let rafId = null;
  let provisionalBadge = null;
  let domObserver = null;
  let rematchDebounceTimer = null;
  let lastTotal = 0; // total annotations (including unanchored)

  function init() {
    VibeEvents.on('annotations:render', render);
    VibeEvents.on('annotation:deleted', onDeleted);
    VibeEvents.on('annotation:updated', onUpdated);
    VibeEvents.on('inspection:elementClicked', onProvisionalPin);
    VibeEvents.on('popover:cancelled', removeProvisional);
    startDOMObserver();
  }

  // --- DOM observer: detect when framework re-renders replace annotated elements ---
  function startDOMObserver() {
    if (domObserver) return;
    domObserver = new MutationObserver(() => {
      // Check if any badge targets got disconnected
      const hasDisconnected = badges.some(b => !b.targetElement.isConnected);
      if (hasDisconnected) {
        // Debounce — frameworks often batch multiple mutations
        clearTimeout(rematchDebounceTimer);
        rematchDebounceTimer = setTimeout(rematchDisconnectedBadges, 150);
      }
    });
    domObserver.observe(document.body, { childList: true, subtree: true });
  }

  function rematchDisconnectedBadges() {
    let changed = false;
    for (const entry of badges) {
      if (!entry.targetElement.isConnected) {
        const newTarget = VibeElementContext.findElementBySelector(entry.annotation);
        if (newTarget && newTarget !== entry.targetElement) {
          entry.targetElement = newTarget;
          entry.el.style.display = '';
          changed = true;
        }
      }
    }
    if (changed) console.log('[Vibe] Re-matched badges after framework re-render');
  }

  function onProvisionalPin({ clientX, clientY }) {
    removeProvisional();
    const root = VibeShadowHost.getRoot();
    if (!root || clientX == null) return;

    const badge = document.createElement('div');
    badge.className = 'vibe-badge';
    badge.textContent = (lastTotal + 1).toString();
    badge.style.top = `${clientY - 11}px`;
    badge.style.left = `${clientX}px`;
    root.appendChild(badge);
    provisionalBadge = badge;
  }

  function removeProvisional() {
    if (provisionalBadge) {
      provisionalBadge.remove();
      provisionalBadge = null;
    }
  }

  function render(annotations) {
    removeProvisional();
    clearAll();

    const sorted = [...annotations].sort((a, b) =>
      new Date(a.created_at) - new Date(b.created_at)
    );

    sorted.forEach((annotation, i) => {
      const target = VibeElementContext.findElementBySelector(annotation);
      if (target) {
        // Rehydrate pending design changes
        const rpc = annotation.pending_changes;
        if (rpc) {
          for (const prop of getStyleProps(rpc)) {
            if (rpc[prop]) target.style[prop] = rpc[prop].value;
          }
        }
        addBadge(target, annotation, i + 1);
      }
    });

    lastTotal = annotations.length;
    VibeEvents.emit('badges:rendered', { count: badges.length, total: annotations.length });
  }

  function addBadge(targetElement, annotation, index) {
    const root = VibeShadowHost.getRoot();
    if (!root) return;

    const badge = document.createElement('div');
    badge.className = 'vibe-badge';
    badge.textContent = index.toString();
    badge.dataset.annotationId = annotation.id;

    // Tooltip
    const tooltip = document.createElement('div');
    tooltip.className = 'vibe-badge-tooltip';
    tooltip.textContent = annotation.comment;
    badge.appendChild(tooltip);

    root.appendChild(badge);

    const entry = { el: badge, annotation, targetElement };

    // Click → edit (read from entry so we get the latest annotation after updates)
    badge.addEventListener('click', (e) => {
      e.stopPropagation();
      VibeEvents.emit('annotation:edit', { annotation: entry.annotation, element: entry.targetElement });
    });
    badges.push(entry);

    // Position immediately
    positionBadge(entry);

    // Start RAF loop if not running
    if (!rafId) startRAF();
  }

  function positionBadge(entry) {
    if (!entry.targetElement.isConnected) {
      entry.el.style.display = 'none';
      return;
    }
    const rect = entry.targetElement.getBoundingClientRect();
    const off = entry.annotation.badge_offset;
    entry.el.style.display = '';
    entry.el.style.top = `${rect.top + (off ? off.y : 0) - 11}px`;
    entry.el.style.left = `${rect.left + (off ? off.x : rect.width / 2)}px`;
  }

  function startRAF() {
    const tick = () => {
      for (const entry of badges) {
        positionBadge(entry);
      }
      rafId = requestAnimationFrame(tick);
    };
    rafId = requestAnimationFrame(tick);
  }

  function stopRAF() {
    if (rafId) {
      cancelAnimationFrame(rafId);
      rafId = null;
    }
  }

  function clearAll(annotations) {
    // Clear tracked badges
    const clearedEls = new Set();
    for (const entry of badges) {
      for (const prop of DESIGN_PROPS) entry.targetElement.style[prop] = '';
      clearedEls.add(entry.targetElement);
      entry.el.remove();
    }
    badges = [];
    lastTotal = 0;
    stopRAF();
    clearTimeout(rematchDebounceTimer);

    // Sweep for orphaned styled elements (badges lost their target but styles remain)
    if (annotations) {
      for (const a of annotations) {
        if (!a.pending_changes) continue;
        const el = VibeElementContext.findElementBySelector(a);
        if (el && !clearedEls.has(el)) {
          for (const prop of getStyleProps(a.pending_changes)) el.style[prop] = '';
        }
      }
    }
  }

  function onDeleted({ id, annotation }) {
    const idx = badges.findIndex(b => b.annotation.id === id);
    if (idx !== -1) {
      const entry = badges[idx];
      for (const prop of getStyleProps(entry.annotation.pending_changes)) entry.targetElement.style[prop] = '';
      entry.el.remove();
      badges.splice(idx, 1);
    } else if (annotation?.pending_changes) {
      // Badge was lost but element may still have inline styles — retry selector
      const el = VibeElementContext.findElementBySelector(annotation);
      if (el) {
        for (const prop of getStyleProps(annotation.pending_changes)) el.style[prop] = '';
      }
    }
    if (!badges.length) stopRAF();

    // Re-number remaining badges
    badges.forEach((entry, i) => {
      entry.el.childNodes[0].textContent = (i + 1).toString();
    });
  }

  function onUpdated({ id, comment, pending_changes }) {
    const entry = badges.find(b => b.annotation.id === id);
    if (entry) {
      const tooltip = entry.el.querySelector('.vibe-badge-tooltip');
      if (tooltip) tooltip.textContent = comment;
      const oldPC = entry.annotation.pending_changes;
      entry.annotation = { ...entry.annotation, comment, pending_changes };
      for (const prop of getStyleProps(oldPC)) entry.targetElement.style[prop] = '';
      if (pending_changes) {
        for (const prop of getStyleProps(pending_changes)) {
          if (pending_changes[prop]) entry.targetElement.style[prop] = pending_changes[prop].value;
        }
      }
    }
  }

  function targetBadge(annotationId) {
    const entry = badges.find(b => b.annotation.id === annotationId);
    if (!entry) return;

    entry.targetElement.scrollIntoView({ behavior: 'smooth', block: 'center' });
    entry.el.classList.add('targeted');
    setTimeout(() => entry.el.classList.remove('targeted'), 2000);
  }

  function highlightElement(annotation) {
    const el = VibeElementContext.findElementBySelector(annotation);
    if (!el) return;
    el.scrollIntoView({ behavior: 'smooth', block: 'center' });
    el.style.outline = '3px solid #d97757';
    el.style.outlineOffset = '2px';
    setTimeout(() => {
      el.style.outline = '';
      el.style.outlineOffset = '';
    }, 3000);
  }

  function getCount() {
    return badges.length;
  }

  return { init, render, clearAll, targetBadge, highlightElement, getCount };
})();
