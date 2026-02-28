// Renders numbered pins (badges) inside shadow DOM
// Position-tracked via RAF loop (only runs when badges exist)
// Zero host DOM modification for display

var VibeBadgeManager = (() => {
  let badges = []; // { el, annotation, targetElement }
  let rafId = null;
  let provisionalBadge = null;

  function init() {
    VibeEvents.on('annotations:render', render);
    VibeEvents.on('annotation:deleted', onDeleted);
    VibeEvents.on('annotation:updated', onUpdated);
    VibeEvents.on('inspection:elementClicked', onProvisionalPin);
    VibeEvents.on('popover:cancelled', removeProvisional);
  }

  function onProvisionalPin({ clientX, clientY }) {
    removeProvisional();
    const root = VibeShadowHost.getRoot();
    if (!root || clientX == null) return;

    const badge = document.createElement('div');
    badge.className = 'vibe-badge';
    badge.textContent = (badges.length + 1).toString();
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
      if (target) addBadge(target, annotation, i + 1);
    });

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

    // Click → edit
    badge.addEventListener('click', (e) => {
      e.stopPropagation();
      VibeEvents.emit('annotation:edit', { annotation, element: targetElement });
    });

    root.appendChild(badge);

    const entry = { el: badge, annotation, targetElement };
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

  function clearAll() {
    for (const entry of badges) {
      entry.el.remove();
    }
    badges = [];
    stopRAF();
  }

  function onDeleted({ id }) {
    const idx = badges.findIndex(b => b.annotation.id === id);
    if (idx !== -1) {
      badges[idx].el.remove();
      badges.splice(idx, 1);
    }
    if (!badges.length) stopRAF();

    // Re-number remaining badges
    badges.forEach((entry, i) => {
      entry.el.childNodes[0].textContent = (i + 1).toString();
    });
  }

  function onUpdated({ id, comment }) {
    const entry = badges.find(b => b.annotation.id === id);
    if (entry) {
      const tooltip = entry.el.querySelector('.vibe-badge-tooltip');
      if (tooltip) tooltip.textContent = comment;
      entry.annotation = { ...entry.annotation, comment };
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
