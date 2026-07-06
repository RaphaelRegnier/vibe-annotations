// Renders numbered pins (badges) inside shadow DOM
// Position-tracked via RAF loop (only runs when badges exist)
// Zero host DOM modification for display

import VibeAPI from './api-bridge.js';
import VibeElementContext from './element-context.js';
import VibeEvents from './event-bus.js';
import VibeShadowHost from './shadow-host.js';

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

  // Revert pending_changes by restoring each prop's original value.
  // Uses the stored original instead of blanking to '' so that pre-existing
  // inline styles (e.g. style="padding: 40px") are preserved.
  function revertPendingChanges(el, pc) {
    for (const prop of Object.keys(pc)) {
      if (prop === 'copyChange') {
        el.textContent = pc.copyChange.original;
        continue;
      }
      const entry = pc[prop];
      if (!entry || !entry.original) { el.style[prop] = ''; continue; }
      // Restore original: if it was a "real" value, set it; if it was empty/default, clear
      const orig = entry.original;
      // Values like "0px", "auto", "none" are real originals — restore them.
      // Only clear if original was explicitly empty.
      el.style[prop] = orig === '' ? '' : orig;
    }
  }

  let badges = []; // { el, annotation, targetElement }
  let styleInjections = []; // { styleEl, annotation } for stylesheet annotations
  let rafId = null;
  let provisionalBadge = null;
  let provisionalPagePos = null;
  let provisionalScrollHandler = null;
  let lastProjectTotal = 0;
  let domObserver = null;
  let rematchDebounceTimer = null;
  let lastTotal = 0; // total annotations (including unanchored)
  let watchMode = false;
  let renderSeq = 0; // guards against out-of-order async renders (see render())

  const EYE_SVG ='<svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z"/><circle cx="12" cy="12" r="3"/></svg>';

  function init() {
    VibeEvents.on('annotations:render', render);
    VibeEvents.on('annotation:deleted', onDeleted);
    VibeEvents.on('annotation:updated', onUpdated);
    VibeEvents.on('inspection:elementClicked', onProvisionalPin);
    VibeEvents.on('popover:cancelled', removeProvisional);
    VibeEvents.on('watch:changed', onWatchChanged);
    // Variant preview switches the active child via CSS only (no size/scroll
    // change), so nudge the badges to re-anchor to the newly-visible variant.
    VibeEvents.on('variants:switched', scheduleReposition);
    startDOMObserver();
  }

  function onWatchChanged({ active }) {
    watchMode = active;
    // Update all existing badges
    badges.forEach((entry, i) => {
      const label = entry.el.querySelector('.vibe-badge-label');
      if (!label) return;
      if (watchMode) {
        label.innerHTML = EYE_SVG;
        entry.el.classList.add('watching');
      } else {
        label.textContent = (i + 1).toString();
        entry.el.classList.remove('watching');
      }
    });
  }

  // --- DOM observer: detect when framework re-renders replace annotated elements ---
  function startDOMObserver() {
    if (domObserver) return;
    const onMutation = () => {
      // Check if any badge targets got disconnected
      const hasDisconnected = badges.some(b => !b.targetElement.isConnected);
      if (hasDisconnected) {
        // Debounce — frameworks often batch multiple mutations
        clearTimeout(rematchDebounceTimer);
        rematchDebounceTimer = setTimeout(rematchDisconnectedBadges, 150);
      }
    };
    domObserver = new MutationObserver(onMutation);
    domObserver.observe(document.body, { childList: true, subtree: true });

    // Also observe inside open shadow roots so we catch web component re-renders
    try {
      const hosts = document.querySelectorAll('*');
      for (const el of hosts) {
        if (el.shadowRoot) {
          const shadowObs = new MutationObserver(onMutation);
          shadowObs.observe(el.shadowRoot, { childList: true, subtree: true });
        }
      }
    } catch { /* skip — shadow roots may not be available yet */ }
  }

  function rematchDisconnectedBadges() {
    let changed = false;
    for (const entry of badges) {
      // Variant badges anchor to the container — re-resolve it, not the original
      // selector (which would find a variant child instead of the wrapper).
      if (entry.variant) {
        if (!entry.variant.container.isConnected) {
          const re = resolveVariantAnchor(entry.annotation);
          if (re) {
            entry.variant = re;
            entry.targetElement = re.container;
            entry.el.style.display = '';
            changed = true;
          }
        }
        continue;
      }
      if (!entry.targetElement.isConnected) {
        const newTarget = VibeElementContext.findElementBySelector(entry.annotation);
        if (newTarget && newTarget !== entry.targetElement) {
          entry.targetElement = newTarget;
          entry.el.style.display = '';
          // Re-apply pending changes on the new target
          const pc = entry.annotation.pending_changes;
          if (pc) {
            for (const prop of getStyleProps(pc)) {
              if (pc[prop]) newTarget.style[prop] = pc[prop].value;
            }
            if (pc.copyChange) newTarget.textContent = pc.copyChange.value;
          }
          changed = true;
        }
      }
    }
    // Re-matched badges after framework re-render
  }

  function onProvisionalPin({ clientX, clientY }) {
    removeProvisional();
    const root = VibeShadowHost.getRoot();
    if (!root || clientX == null) return;

    const badge = document.createElement('div');
    badge.className = 'vibe-badge' + (watchMode ? ' watching' : '');
    const label = document.createElement('span');
    label.className = 'vibe-badge-label';
    if (watchMode) { label.innerHTML = EYE_SVG; } else { label.textContent = (lastProjectTotal + 1).toString(); }
    badge.appendChild(label);
    root.appendChild(badge);
    provisionalBadge = badge;

    // Anchor to the PAGE, not the viewport: badges are position:fixed, so on scroll
    // we recompute viewport coords from the stored page point. This keeps the pin
    // glued to the spot on the page (like a saved badge) while the popover stays put.
    provisionalPagePos = { x: clientX + window.scrollX, y: clientY + window.scrollY };
    const reposition = () => {
      if (!provisionalBadge || !provisionalPagePos) return;
      provisionalBadge.style.top = `${provisionalPagePos.y - window.scrollY - 11}px`;
      provisionalBadge.style.left = `${provisionalPagePos.x - window.scrollX}px`;
    };
    reposition();
    provisionalScrollHandler = () => reposition();
    window.addEventListener('scroll', provisionalScrollHandler, { passive: true, capture: true });
    window.addEventListener('resize', provisionalScrollHandler, { passive: true });
  }

  function removeProvisional() {
    if (provisionalScrollHandler) {
      window.removeEventListener('scroll', provisionalScrollHandler, { capture: true });
      window.removeEventListener('resize', provisionalScrollHandler);
      provisionalScrollHandler = null;
    }
    provisionalPagePos = null;
    if (provisionalBadge) {
      provisionalBadge.remove();
      provisionalBadge = null;
    }
  }

  async function render(annotations) {
    const myGen = ++renderSeq;
    removeProvisional();
    // In watch mode, don't revert pending changes — agent implemented them in source
    clearAll(undefined, { skipRevert: watchMode });

    // Load all project annotations for project-wide numbering and total count.
    // Exclude resolved — the agent has finalized/cleaned those, so they're done
    // and must not inflate the "View all" count pill (variants-discarded and
    // variant-chosen still count: they're pending agent action, shown in the list).
    const projectAnnotations = (await VibeAPI.loadProjectAnnotations())
      .filter(a => a.status !== 'resolved');
    // A newer render started while we awaited — bail so we don't emit a stale
    // total (e.g. leaving the "View all" count at 1 after deleting everything).
    if (myGen !== renderSeq) return;
    const projectSorted = [...projectAnnotations].sort((a, b) =>
      new Date(a.created_at) - new Date(b.created_at)
    );
    // Build a map: annotation id → project-wide index
    const projectIndexMap = new Map();
    projectSorted.forEach((a, i) => projectIndexMap.set(a.id, i + 1));

    const sorted = [...annotations].sort((a, b) =>
      new Date(a.created_at) - new Date(b.created_at)
    );

    sorted.forEach((annotation) => {
      // Terminal variant states are agent-only (cleanup / done) — no badge on the
      // page. Skipping here also stops a discarded variant from falling through to
      // the normal selector path and drawing a stray pin on a variant child.
      if (annotation.status === 'variants-discarded' || annotation.status === 'resolved') {
        // Revert the live preview to the original (variant 1) so the page stops
        // showing the abandoned choice. This runs on every render, so ANY deletion
        // surface (popover discard, View-all card/delete-all) reverts immediately —
        // not just the popover. Matches what a reload shows (scaffold hardcodes "1").
        if (annotation.status === 'variants-discarded') revertVariantToOriginal(annotation);
        return;
      }

      // Stylesheet annotations — inject as <style> tag
      if (annotation.type === 'stylesheet' && annotation.css) {
        injectStyleAnnotation(annotation);
        return;
      }

      // Variant annotations: anchor to the stable container, not the original
      // selector element (which becomes one variant child and gets hidden when
      // another variant is selected). positionBadge() tracks the active child.
      const variant = resolveVariantAnchor(annotation);
      if (variant) {
        const badgeNum = projectIndexMap.get(annotation.id) || 1;
        addBadge(variant.container, annotation, badgeNum, variant);
        return;
      }

      const target = VibeElementContext.findElementBySelector(annotation);
      if (target) {
        // Rehydrate pending design changes
        const rpc = annotation.pending_changes;
        if (rpc) {
          for (const prop of getStyleProps(rpc)) {
            if (rpc[prop]) target.style[prop] = rpc[prop].value;
          }
          if (rpc.copyChange) target.textContent = rpc.copyChange.value;
        }
        // Inject companion CSS rules if present
        if (annotation.css) {
          injectStyleAnnotation(annotation);
        }
        // Badge number is project-wide
        const badgeNum = projectIndexMap.get(annotation.id) || 1;
        addBadge(target, annotation, badgeNum);
      }
    });

    lastTotal = annotations.length;
    lastProjectTotal = projectAnnotations.length;
    VibeEvents.emit('badges:rendered', { count: badges.length, total: projectAnnotations.length, styleCount: styleInjections.filter(s => s.annotation.type === 'stylesheet').length });
  }

  function injectStyleAnnotation(annotation) {
    const style = document.createElement('style');
    style.setAttribute('data-vibe-style', annotation.id);
    style.textContent = annotation.css;
    document.head.appendChild(style);
    styleInjections.push({ styleEl: style, annotation });
  }

  // For a variant annotation, resolve the stable wrapper container so the badge
  // can follow whichever variant child is currently active.
  function resolveVariantAnchor(annotation) {
    if (!annotation || annotation.mode !== 'variants') return null;
    if (annotation.status === 'resolved' || annotation.status === 'variants-discarded') return null;
    const p = annotation.variantsPayload;
    if (!p || !p.container) return null;
    let container = null;
    try { container = document.querySelector(p.container); } catch (_) {}
    if (!container) return null;
    return { container, attribute: p.attribute || 'data-vibe-active' };
  }

  // Point a discarded variant's live wrapper back at the original (variant 1),
  // undoing whatever choice was being previewed. No-op if the wrapper isn't on
  // this page (wrong route / not reloaded) or already shows the original.
  function revertVariantToOriginal(annotation) {
    if (!annotation || annotation.mode !== 'variants') return;
    const p = annotation.variantsPayload;
    if (!p || !p.container) return;
    let container = null;
    try { container = document.querySelector(p.container); } catch (_) {}
    if (!container) return;
    const attr = p.attribute || 'data-vibe-active';
    const original = (p.variants && p.variants[0]) ? String(p.variants[0].value) : '1';
    if (container.getAttribute(attr) !== original) container.setAttribute(attr, original);
  }

  function addBadge(targetElement, annotation, index, variant) {
    const root = VibeShadowHost.getRoot();
    if (!root) return;

    const badge = document.createElement('div');
    badge.className = 'vibe-badge' + (watchMode ? ' watching' : '');
    badge.dataset.annotationId = annotation.id;

    // Label span (number or eye)
    const label = document.createElement('span');
    label.className = 'vibe-badge-label';
    if (watchMode) { label.innerHTML = EYE_SVG; } else { label.textContent = index.toString(); }
    badge.appendChild(label);

    // Tooltip
    if (annotation.comment) {
      const tooltip = document.createElement('div');
      tooltip.className = 'vibe-badge-tooltip';
      tooltip.textContent = annotation.comment;
      badge.appendChild(tooltip);
    }

    root.appendChild(badge);

    const entry = { el: badge, annotation, targetElement, variant: variant || null };

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
    // Variant badges anchor to the container but position against whichever
    // variant child is active (the container itself is display:contents and
    // has no box). Re-resolving here means the badge follows variant switches.
    if (entry.variant) {
      const { container, attribute } = entry.variant;
      if (!container.isConnected) { entry.el.style.display = 'none'; return; }
      const active = container.getAttribute(attribute) || '1';
      let child = null;
      try {
        const esc = (window.CSS && CSS.escape) ? CSS.escape(active) : active;
        child = container.querySelector(`:scope > [data-variant="${esc}"]`);
      } catch (_) {}
      const anchor = child || container;
      const rect = anchor.getBoundingClientRect();
      if (!rect.width && !rect.height) { entry.el.style.display = 'none'; return; }
      entry.el.style.display = '';
      entry.el.style.top = `${rect.top - 11}px`;
      entry.el.style.left = `${rect.left + rect.width / 2}px`;
      return;
    }

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

  let repositionTimer = null;
  let scrollListener = null;
  let resizeObserver = null;

  function repositionAll() {
    for (const entry of badges) positionBadge(entry);
  }

  function scheduleReposition() {
    if (repositionTimer) return;
    repositionTimer = requestAnimationFrame(() => {
      repositionTimer = null;
      repositionAll();
    });
  }

  function startRAF() {
    // Use scroll + resize listeners instead of permanent RAF loop
    if (scrollListener) return;

    scrollListener = () => scheduleReposition();
    window.addEventListener('scroll', scrollListener, { passive: true, capture: true });
    window.addEventListener('resize', scrollListener, { passive: true });

    // ResizeObserver for layout changes on badge targets
    resizeObserver = new ResizeObserver(() => scheduleReposition());
    for (const entry of badges) {
      if (entry.targetElement.isConnected) {
        resizeObserver.observe(entry.targetElement);
      }
    }
  }

  function stopRAF() {
    if (repositionTimer) { cancelAnimationFrame(repositionTimer); repositionTimer = null; }
    if (scrollListener) {
      window.removeEventListener('scroll', scrollListener, { capture: true });
      window.removeEventListener('resize', scrollListener);
      scrollListener = null;
    }
    if (resizeObserver) { resizeObserver.disconnect(); resizeObserver = null; }
    if (rafId) { cancelAnimationFrame(rafId); rafId = null; }
  }

  function clearAll(annotations, { skipRevert = false } = {}) {
    // Clear injected stylesheets
    for (const entry of styleInjections) entry.styleEl.remove();
    styleInjections = [];

    // Clear tracked badges
    const clearedEls = new Set();
    for (const entry of badges) {
      const pc = entry.annotation.pending_changes;
      if (pc && !skipRevert) {
        revertPendingChanges(entry.targetElement, pc);
      }
      clearedEls.add(entry.targetElement);
      entry.el.remove();
    }
    badges = [];
    lastTotal = 0;
    stopRAF();
    clearTimeout(rematchDebounceTimer);

    // Sweep for orphaned styled elements (badges lost their target but styles remain)
    if (annotations && !skipRevert) {
      for (const a of annotations) {
        if (!a.pending_changes) continue;
        const el = VibeElementContext.findElementBySelector(a);
        if (el && !clearedEls.has(el)) {
          revertPendingChanges(el, a.pending_changes);
        }
      }
    }
  }

  function onDeleted({ id, annotation }) {
    // Remove companion style tag if any (both standalone stylesheet and element-anchored css)
    const styleIdx = styleInjections.findIndex(s => s.annotation.id === id);
    if (styleIdx !== -1) {
      styleInjections[styleIdx].styleEl.remove();
      styleInjections.splice(styleIdx, 1);
      // If this was a pure stylesheet annotation (no badge), we're done
      if (annotation?.type === 'stylesheet') return;
    }

    const idx = badges.findIndex(b => b.annotation.id === id);
    if (idx !== -1) {
      const entry = badges[idx];
      const pc = entry.annotation.pending_changes;
      // In watch mode, agent implemented the change in source — don't revert DOM preview
      if (pc && !watchMode) {
        revertPendingChanges(entry.targetElement, pc);
      }
      entry.el.remove();
      badges.splice(idx, 1);
    } else if (annotation?.pending_changes && !watchMode) {
      // Badge was lost but element may still have inline styles — retry selector
      const el = VibeElementContext.findElementBySelector(annotation);
      if (el) {
        revertPendingChanges(el, annotation.pending_changes);
      }
    }
    if (!badges.length) stopRAF();

    // Re-number remaining badges (or keep eye icons in watch mode)
    badges.forEach((entry, i) => {
      const label = entry.el.querySelector('.vibe-badge-label');
      if (!label) return;
      if (watchMode) {
        label.innerHTML = EYE_SVG;
      } else {
        label.textContent = (i + 1).toString();
      }
    });
  }

  function onUpdated({ id, comment, pending_changes, css }) {
    const entry = badges.find(b => b.annotation.id === id);
    if (entry) {
      let tooltip = entry.el.querySelector('.vibe-badge-tooltip');
      if (comment) {
        if (!tooltip) {
          tooltip = document.createElement('div');
          tooltip.className = 'vibe-badge-tooltip';
          entry.el.appendChild(tooltip);
        }
        tooltip.textContent = comment;
      } else if (tooltip) {
        tooltip.remove();
      }
      const oldPC = entry.annotation.pending_changes;
      // Revert old changes before applying new state
      if (oldPC) {
        revertPendingChanges(entry.targetElement, oldPC);
      }
      entry.annotation = { ...entry.annotation, comment, pending_changes, css };
      if (pending_changes) {
        for (const prop of getStyleProps(pending_changes)) {
          if (pending_changes[prop]) entry.targetElement.style[prop] = pending_changes[prop].value;
        }
        if (pending_changes.copyChange) entry.targetElement.textContent = pending_changes.copyChange.value;
      }

      // Update companion style tag
      const styleEntry = styleInjections.find(s => s.annotation.id === id);
      if (css && styleEntry) {
        styleEntry.styleEl.textContent = css;
      } else if (css && !styleEntry) {
        injectStyleAnnotation({ id, css });
      } else if (css === null && styleEntry) {
        styleEntry.styleEl.remove();
        styleInjections.splice(styleInjections.indexOf(styleEntry), 1);
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

const VibeBadgeManager = { init, render, clearAll, targetBadge, highlightElement, getCount };
export default VibeBadgeManager;
