// Small popover card anchored to target element
// Core show/dismiss/positioning logic — panel builders live in popover-panels.js

import VibeAPI from './api-bridge.js';
import VibeElementContext from './element-context.js';
import VibeEvents, { vibeLocationPath } from './event-bus.js';
import VibeInspectionMode from './inspection-mode.js';
import VibePopoverPanels from './popover-panels.js';
import VibeShadowHost from './shadow-host.js';

  let currentPopover = null;
  let currentTargetHighlight = null;
  let highlightRafId = null;
  let escHandler = null;
  let activeElement = null;
  let activeExistingAnnotation = null;
  let activeElType = null;
  let activeRawCssOriginals = null;
  let activeOriginalText = null;
  let activeTextDirty = false;
  let activeOriginalCssText = null;
  let activeCssRulesStyleEl = null;
  let activePendingAttachments = null;

  const P = VibePopoverPanels; // shorthand

  const VIBE_IMG_ICON = '<svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><rect x="3" y="3" width="18" height="18" rx="2"/><circle cx="8.5" cy="8.5" r="1.5"/><path d="M21 15l-5-5L5 21"/></svg>';
  const VIBE_X_ICON = '<svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round"><path d="M18 6L6 18M6 6l12 12"/></svg>';
  const ATTACH_MIMES = new Set(['image/png', 'image/jpeg', 'image/webp', 'image/gif', 'image/svg+xml', 'image/bmp', 'image/avif']);
  const ATTACH_ACCEPT = 'image/png,image/jpeg,image/webp,image/gif,image/svg+xml,image/bmp,image/avif';
  const VIBE_PLUS_ICON = '<svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M12 5v14M5 12h14"/></svg>';
  const VIBE_PAPERCLIP_ICON = '<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="m21.44 11.05-9.19 9.19a6 6 0 0 1-8.49-8.49l8.57-8.57A4 4 0 1 1 18 8.84l-8.59 8.57a2 2 0 0 1-2.83-2.83l8.49-8.48"/></svg>';
  const VIBE_CAMERA_ICON = '<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M14.5 4h-5L7 7H4a2 2 0 0 0-2 2v9a2 2 0 0 0 2 2h16a2 2 0 0 0 2-2V9a2 2 0 0 0-2-2h-3l-2.5-3z"/><circle cx="12" cy="13" r="3"/></svg>';
  const VIBE_VARIANTS_ICON = '<svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><rect x="3" y="3" width="7" height="7" rx="1"/><rect x="14" y="3" width="7" height="7" rx="1"/><rect x="3" y="14" width="7" height="7" rx="1"/><rect x="14" y="14" width="7" height="7" rx="1"/></svg>';
  const VIBE_COMMENT_ICON = '<svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z"/></svg>';
  const VIBE_DESIGN_ICON = '<svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M4 8V5a1 1 0 0 1 1-1h3"/><path d="M16 4h3a1 1 0 0 1 1 1v3"/><path d="M4 16v3a1 1 0 0 1 1 1h3"/><path d="M12 12l7.5 3-3.2 1.1-1.1 3.2z"/></svg>';

  // Maps a pending-change property (camelCase) to its Design-accordion section, so
  // a "changed" dot can light on the right section header. Unmapped raw-CSS edits
  // fall back to the 'raw-css' section (handled separately via _userEdited).
  const PROP_TO_SECTION = {
    copyChange: 'content',
    fontSize: 'font', fontWeight: 'font', lineHeight: 'font', textAlign: 'font', color: 'font',
    letterSpacing: 'font', textTransform: 'font', fontStyle: 'font', textDecoration: 'font',
    width: 'sizing', minWidth: 'sizing', maxWidth: 'sizing', height: 'sizing', minHeight: 'sizing', maxHeight: 'sizing',
    paddingTop: 'spacing', paddingRight: 'spacing', paddingBottom: 'spacing', paddingLeft: 'spacing',
    marginTop: 'spacing', marginRight: 'spacing', marginBottom: 'spacing', marginLeft: 'spacing',
    display: 'layout', flexDirection: 'layout', flexWrap: 'layout', justifyContent: 'layout', alignItems: 'layout',
    gap: 'layout', columnGap: 'layout', rowGap: 'layout', gridTemplateColumns: 'layout', gridTemplateRows: 'layout',
    borderWidth: 'appearance', borderRadius: 'appearance', borderStyle: 'appearance', borderColor: 'appearance', backgroundColor: 'appearance',
  };

  function init() {
    VibeEvents.on('inspection:elementClicked', onElementClicked);
    VibeEvents.on('annotation:edit', onEditRequested);
  }

  async function onElementClicked({ element, clientX, clientY }) {
    const context = await VibeElementContext.generate(element);
    show(element, context, null, clientX, clientY);
  }

  async function onEditRequested({ annotation, element }) {
    VibeInspectionMode.tempDisable();
    const context = await VibeElementContext.generate(element);
    show(element, context, annotation);
  }

  // --- Show popover ---

  async function show(targetElement, context, existingAnnotation, clickX, clickY) {
    dismiss();

    const root = VibeShadowHost.getRoot();
    if (!root) return;

    const isEdit = !!existingAnnotation;
    const isFile = VibeAPI.isFileProtocol();
    const elType = P.classifyElement(targetElement);
    // Once the agent has generated variants, reopening shows the live variant
    // browser (keyed on variantsPayload to tolerate a lagging local status).
    const isVariantsReview = !!(existingAnnotation && existingAnnotation.mode === 'variants'
      && existingAnnotation.variantsPayload && existingAnnotation.status !== 'resolved');

    // Target highlight — skipped for variants review so the selection rect doesn't
    // obscure the live preview of the variant being browsed.
    if (!isVariantsReview) {
      currentTargetHighlight = document.createElement('div');
      currentTargetHighlight.className = 'vibe-target-highlight';
      root.appendChild(currentTargetHighlight);
      positionTargetHighlight(targetElement);
    }

    // Anchor wrapper
    const anchor = document.createElement('div');
    anchor.className = 'vibe-popover-anchor';
    root.appendChild(anchor);

    // Popover card
    const popover = document.createElement('div');
    popover.className = 'vibe-popover';

    if (isVariantsReview) {
      renderVariantsReview(anchor, popover, targetElement, existingAnnotation, clickX, clickY);
      return;
    }

    let warningHTML = '';
    if (isFile) {
      warningHTML = `<div class="vibe-warning">${P.ICONS.warning}<span>Local file mode</span></div>`;
    }

    const pc = isEdit ? existingAnnotation.pending_changes : null;
    const s = context.styles;

    // Build panel HTML via VibePopoverPanels
    const hasText = elType === 'text' || elType === 'both';
    const textParts = hasText ? P.buildTextToolbarHTML(pc, s) : null;
    const containerParts = (elType === 'container' || elType === 'both') ? P.buildContainerToolbarHTML(pc, s) : null;
    const sizingParts = P.buildSizingToolbarHTML(pc, s);

    const panelContent = {};
    if (hasText) panelContent.content = P.buildContentToolbarHTML(targetElement, pc);
    if (textParts) panelContent.font = textParts.font;
    panelContent.sizing = sizingParts.sizing;
    panelContent.spacing = sizingParts.spacing;
    if (containerParts) panelContent.layout = containerParts.layout;
    if (containerParts) panelContent.appearance = containerParts.border + containerParts.colorRows;

    context._element = targetElement;
    const rawCssInitial = P.buildRawCssContent(context);
    const hasCssRules = !!(existingAnnotation?.css);
    panelContent['raw-css'] = `
      <div class="vibe-raw-css-section">
        <button class="vibe-raw-css-toggle" type="button">
          <span class="vibe-raw-css-chevron${hasCssRules ? '' : ' open'}">${P.ICONS.chevron}</span>
          <span class="vibe-raw-css-label">Inline overrides</span>
        </button>
        <div class="vibe-raw-css-collapsible" style="display:${hasCssRules ? 'none' : ''}">
          <textarea class="vibe-raw-css" spellcheck="false">${P.escapeHTML(rawCssInitial)}</textarea>
        </div>
      </div>
      <div class="vibe-raw-css-section">
        <button class="vibe-raw-css-toggle" type="button">
          <span class="vibe-raw-css-chevron${hasCssRules ? ' open' : ''}">${P.ICONS.chevron}</span>
          <span class="vibe-raw-css-label">CSS rules <span class="vibe-raw-css-hint">:hover, ::before, @media…</span></span>
        </button>
        <div class="vibe-raw-css-collapsible" style="display:${hasCssRules ? '' : 'none'}">
          <textarea class="vibe-css-rules" spellcheck="false" placeholder=".element:hover {\n  opacity: 0.8;\n}">${P.escapeHTML(existingAnnotation?.css || '')}</textarea>
        </div>
      </div>`;

    // Design edit is a vertical accordion — reuse the design panels as collapsible
    // sections (same order as the old tab bar). First section opens by default.
    const sections = P.getTabsForType(elType);
    const designAccordionHTML = sections.map((sec, i) => {
      const open = i === 0;
      return `
        <div class="vibe-design-section">
          <button class="vibe-design-sec-toggle" type="button">
            <span class="vibe-design-sec-chevron${open ? ' open' : ''}">${P.ICONS.chevron}</span>
            <span class="vibe-design-sec-label">${sec.label}</span>
            <span class="vibe-design-sec-dot" data-sec-dot="${sec.key}"></span>
          </button>
          <div class="vibe-design-sec-body" style="display:${open ? '' : 'none'}">${panelContent[sec.key] || ''}</div>
        </div>`;
    }).join('');

    const selectorLabel = context.classes.length
      ? `${context.tag}.${context.classes[0]}`
      : context.tag;

    popover.innerHTML = `
      <div class="vibe-drag-handle"></div>
      <div class="vibe-popover-title">
        <span>Editing <code>${P.escapeHTML(selectorLabel)}</code></span>
        <button class="vibe-design-reset" type="button" title="Reset design changes">${P.ICONS.reset}</button>
      </div>
      <div class="vibe-mode-bar">
        <button class="vibe-mode-tab active" data-mode="comment" type="button" title="Comment — an AI instruction">${VIBE_COMMENT_ICON}<span>Comment</span></button>
        <button class="vibe-mode-tab" data-mode="design" type="button" title="Design edit — tweak CSS visually">${VIBE_DESIGN_ICON}<span>Design</span><span class="vibe-mode-dot"></span></button>
        ${isEdit ? '' : `<button class="vibe-mode-tab" data-mode="variants" type="button" disabled title="Requires the MCP server">${VIBE_VARIANTS_ICON}<span>Variants</span></button>`}
      </div>
      ${warningHTML}
      <div class="vibe-mode-panel" data-mode="comment">
        <div class="vibe-input-wrap">
          <textarea class="vibe-textarea vibe-textarea-add" placeholder="Describe the change for your AI agent…" maxlength="1000">${isEdit ? P.escapeHTML(existingAnnotation.comment) : ''}</textarea>
          <div class="vibe-input-foot">
            <button class="vibe-add-btn" type="button" title="Add an attachment">${VIBE_PLUS_ICON}</button>
            <span class="vibe-foot-right">
              <span class="vibe-kbd-hint">${P.kbdHint} to save</span>
              <span class="vibe-resize-grip" title="Drag to resize">
                <svg width="9" height="9" viewBox="0 0 9 9" fill="none"><path d="M8 1L1 8M8 5L5 8" stroke="currentColor" stroke-width="1.2" stroke-linecap="round"/></svg>
              </span>
            </span>
          </div>
          <div class="vibe-add-menu" hidden>
            <button class="vibe-add-opt" data-add="file" type="button">${VIBE_PAPERCLIP_ICON}<span>Attach file</span></button>
            <button class="vibe-add-opt" data-add="shot" type="button">${VIBE_CAMERA_ICON}<span>Take a screenshot</span></button>
          </div>
        </div>
        <p class="vibe-variants-explain" hidden>Your agent builds these in your codebase, you'll preview and pick your favorite right here.</p>
        <div class="vibe-attachments empty"></div>
        <input type="file" accept="${ATTACH_ACCEPT}" class="vibe-attach-input" hidden multiple>
      </div>
      <div class="vibe-mode-panel vibe-design-accordion" data-mode="design" hidden>
        ${designAccordionHTML}
      </div>
      <div class="vibe-popover-footer">
        <div class="vibe-footer-left">
          ${isEdit ? `<button class="vibe-btn-icon vibe-delete-btn" title="Delete">${P.ICONS.trash}</button>` : ''}
          <span class="vibe-viewport-info">${P.getDeviceIcon(window.innerWidth)} ${window.innerWidth}w</span>
        </div>
        <div class="vibe-footer-right">
          <button class="vibe-btn vibe-btn-secondary vibe-cancel-btn">Cancel</button>
          <button class="vibe-btn vibe-btn-primary vibe-save-btn">${isEdit ? 'Save' : 'Save as pointer'}</button>
        </div>
      </div>
    `;

    anchor.appendChild(popover);
    currentPopover = anchor;

    positionPopover(anchor, targetElement, clickX, clickY);
    wireDragHandle(popover.querySelector('.vibe-drag-handle'), popover);

    const textarea = popover.querySelector('.vibe-textarea');
    const saveBtn = popover.querySelector('.vibe-save-btn');
    const cancelBtn = popover.querySelector('.vibe-cancel-btn');
    const deleteBtn = popover.querySelector('.vibe-delete-btn');
    const resetBtn = popover.querySelector('.vibe-design-reset');

    // Auto-grow the comment field with its content, capped at 180px (then it
    // scrolls). Dragging the grip sets a manual height that sticks and turns
    // auto-grow off — the user can take it past the cap.
    const MAX_AUTO_H = 180;
    let manualH = 0;
    const autosize = () => {
      if (manualH) return;
      textarea.style.height = 'auto';
      textarea.style.height = Math.min(textarea.scrollHeight, MAX_AUTO_H) + 'px';
    };
    textarea.addEventListener('input', autosize);
    requestAnimationFrame(autosize); // initial fit — edit mode preloads a comment

    const grip = popover.querySelector('.vibe-resize-grip');
    grip.addEventListener('pointerdown', (e) => {
      e.preventDefault();
      grip.setPointerCapture(e.pointerId);
      const startY = e.clientY;
      const startH = textarea.offsetHeight;
      const onMove = (ev) => {
        manualH = Math.max(60, startH + (ev.clientY - startY));
        textarea.style.height = manualH + 'px';
      };
      const onUp = () => {
        grip.removeEventListener('pointermove', onMove);
        grip.removeEventListener('pointerup', onUp);
        grip.removeEventListener('pointercancel', onUp);
      };
      grip.addEventListener('pointermove', onMove);
      grip.addEventListener('pointerup', onUp);
      grip.addEventListener('pointercancel', onUp);
    });

    activeElement = targetElement;
    activeOriginalCssText = targetElement.style.cssText;
    activeExistingAnnotation = existingAnnotation;
    activeElType = elType;

    // Capture the click offset within the element NOW, same frame as the click —
    // it's element-relative and scroll-invariant. Computing it later (at save) would
    // mix a stale viewport clickY with the element's current rect if the user scrolled
    // while typing, landing the badge far from where they clicked.
    let savedBadgeOffset = null;
    if (clickX != null) {
      const r0 = targetElement.getBoundingClientRect();
      savedBadgeOffset = { x: clickX - r0.left, y: clickY - r0.top };
    }

    // --- Attachments (paste / pick / screenshot / clear) ---
    const attachInput = popover.querySelector('.vibe-attach-input');
    const attachmentsEl = popover.querySelector('.vibe-attachments');
    const isLocal = VibeAPI.isLocalOrigin();
    // For a not-yet-saved annotation we buffer blobs and upload them on save.
    const pendingAttachments = []; // { blob, mime, url }
    // Object URLs for images added this session, keyed by server attachment id —
    // lets us show a real thumbnail even on https (where we couldn't re-fetch).
    const sessionBlobUrls = new Map();
    // Track attachment add/remove so the save button reflects it (see updateSave).
    let attachmentsDirty = false;
    const markAttachmentsChanged = () => { attachmentsDirty = true; popover._updateSave?.(); };

    function renderAttachments() {
      const saved = (isEdit && Array.isArray(activeExistingAnnotation?.attachments)) ? activeExistingAnnotation.attachments : [];
      const tiles = [];
      saved.forEach(att => {
        const blobUrl = sessionBlobUrls.get(att.id);
        const src = blobUrl || (isLocal ? VibeAPI.attachmentUrl(activeExistingAnnotation.id, att.id) : null);
        tiles.push(attachmentTileHTML({ src, attId: att.id, kind: att.kind }));
      });
      pendingAttachments.forEach((p, i) => tiles.push(attachmentTileHTML({ src: p.url, pendingIndex: i, kind: p.kind || 'user' })));
      attachmentsEl.innerHTML = tiles.join('');
      attachmentsEl.classList.toggle('empty', tiles.length === 0);
    }

    function attachmentTileHTML({ src, attId, pendingIndex, kind }) {
      const ref = attId != null ? `data-att="${P.escapeHTML(attId)}"` : `data-pending="${pendingIndex}"`;
      const label = kind === 'capture' ? 'Screenshot' : 'Image';
      const inner = src
        ? `<img class="vibe-att-img" src="${P.escapeHTML(src)}" alt="${label}">`
        : `<span class="vibe-att-chip">${VIBE_IMG_ICON}<span>${label}</span></span>`;
      return `<div class="vibe-att-tile" ${ref} title="${label} — click to open">
        ${inner}
        <button class="vibe-att-remove" type="button" title="Remove" ${ref}>${VIBE_X_ICON}</button>
      </div>`;
    }

    async function handleAttach(blob, mime, kind = 'user') {
      if (!blob || !ATTACH_MIMES.has(mime)) return;
      if (isEdit && activeExistingAnnotation?.id) {
        try {
          const att = await VibeAPI.uploadUserImage(activeExistingAnnotation.id, blob, mime, kind);
          sessionBlobUrls.set(att.id, URL.createObjectURL(blob));
          const cur = activeExistingAnnotation.attachments || [];
          // A capture is singular (server replaces the prior one) — mirror that locally.
          activeExistingAnnotation.attachments = kind === 'capture'
            ? [att, ...cur.filter(a => a.kind !== 'capture')]
            : [...cur, att];
          renderAttachments();
          markAttachmentsChanged();
        } catch (err) { console.warn('[Vibe] attach failed:', err); }
      } else {
        pendingAttachments.push({ blob, mime, kind, url: URL.createObjectURL(blob) });
        renderAttachments();
        markAttachmentsChanged();
      }
    }

    // "+" menu: Attach file / Take a screenshot. The "+" rotates into an "×" open.
    const addBtn = popover.querySelector('.vibe-add-btn');
    const addMenu = popover.querySelector('.vibe-add-menu');
    const closeAddMenu = () => { addMenu.hidden = true; addBtn.classList.remove('open'); };
    addBtn.addEventListener('click', (e) => {
      e.stopPropagation();
      const open = addMenu.hidden;
      addMenu.hidden = !open;
      addBtn.classList.toggle('open', open);
    });
    addMenu.querySelector('[data-add="file"]').addEventListener('click', () => { closeAddMenu(); attachInput.click(); });
    addMenu.querySelector('[data-add="shot"]').addEventListener('click', () => { closeAddMenu(); takeScreenshot(); });
    // Close on any click inside the popover that isn't the button/menu. Scoped to the
    // popover so the listener is GC'd with it (no cross-open leak); clicks outside the
    // popover dismiss it entirely anyway.
    popover.addEventListener('pointerdown', (e) => {
      if (!addMenu.hidden && !addMenu.contains(e.target) && !addBtn.contains(e.target)) closeAddMenu();
    }, true);

    attachInput.addEventListener('change', () => {
      for (const file of attachInput.files) handleAttach(file, file.type);
      attachInput.value = '';
    });

    // Take a screenshot of the annotated element: request the capture permission
    // (a natural discovery moment), hide our overlay for the shot so the popover
    // isn't in it, grab the element's region, and attach it as a capture. Works even
    // when the Screenshots setting is off.
    let capturing = false;
    async function takeScreenshot() {
      if (capturing) return;
      capturing = true;
      try {
        const granted = await VibeAPI.requestScreenshotPermission();
        if (!granted) return;
        const r = targetElement.getBoundingClientRect();
        const PAD = 16;
        const left = Math.max(0, r.left - PAD);
        const top = Math.max(0, r.top - PAD);
        const right = Math.min(window.innerWidth, r.right + PAD);
        const bottom = Math.min(window.innerHeight, r.bottom + PAD);
        const cw = right - left, ch = bottom - top;
        if (cw <= 0 || ch <= 0) return;
        const dpr = window.devicePixelRatio || 1;
        const crop = { sx: Math.round(left * dpr), sy: Math.round(top * dpr), sw: Math.round(cw * dpr), sh: Math.round(ch * dpr) };

        const host = VibeShadowHost.getHost();
        if (host) host.style.visibility = 'hidden';
        await new Promise(rf => requestAnimationFrame(() => rf()));
        let fullDataUrl;
        try {
          fullDataUrl = await VibeAPI.captureVisibleTab();
        } finally {
          if (host) host.style.visibility = '';
        }
        if (!fullDataUrl) return;

        // Crop to the element region in the content world (service workers can't
        // easily turn a Blob back into a data URL), then attach the webp.
        const fullBlob = await (await fetch(fullDataUrl)).blob();
        const bitmap = await createImageBitmap(fullBlob, crop.sx, crop.sy, crop.sw, crop.sh);
        const canvas = document.createElement('canvas');
        canvas.width = crop.sw; canvas.height = crop.sh;
        canvas.getContext('2d').drawImage(bitmap, 0, 0);
        if (bitmap.close) bitmap.close();
        const webp = await new Promise(res => canvas.toBlob(res, 'image/webp', 0.85));
        if (webp) await handleAttach(webp, 'image/webp', 'capture');
      } catch (err) {
        console.warn('[Vibe] screenshot failed:', err);
      } finally {
        capturing = false;
      }
    }
    textarea.addEventListener('paste', (e) => {
      const items = e.clipboardData?.items || [];
      for (const item of items) {
        if (item.type && item.type.startsWith('image/')) {
          const file = item.getAsFile();
          if (file) { e.preventDefault(); handleAttach(file, item.type); }
        }
      }
    });
    attachmentsEl.addEventListener('click', async (e) => {
      const removeBtn = e.target.closest('.vibe-att-remove');
      if (removeBtn) {
        e.stopPropagation();
        const attId = removeBtn.getAttribute('data-att');
        const pendingIndex = removeBtn.getAttribute('data-pending');
        if (attId) {
          try { await VibeAPI.removeAttachment(activeExistingAnnotation.id, attId); } catch (err) { console.warn('[Vibe] remove failed:', err); }
          const url = sessionBlobUrls.get(attId);
          if (url) { URL.revokeObjectURL(url); sessionBlobUrls.delete(attId); }
          activeExistingAnnotation.attachments = (activeExistingAnnotation.attachments || []).filter(a => a.id !== attId);
        } else if (pendingIndex != null) {
          const p = pendingAttachments[Number(pendingIndex)];
          if (p) { URL.revokeObjectURL(p.url); pendingAttachments.splice(Number(pendingIndex), 1); }
        }
        renderAttachments();
        markAttachmentsChanged();
        return;
      }
      // Click a tile → open the full image in a new tab.
      const tile = e.target.closest('.vibe-att-tile');
      if (!tile) return;
      const attId = tile.getAttribute('data-att');
      const pendingIndex = tile.getAttribute('data-pending');
      if (attId) window.open(VibeAPI.attachmentUrl(activeExistingAnnotation.id, attId), '_blank', 'noopener');
      else if (pendingIndex != null && pendingAttachments[Number(pendingIndex)]) window.open(pendingAttachments[Number(pendingIndex)].url, '_blank', 'noopener');
    });
    attachmentsEl.addEventListener('error', (e) => {
      const img = e.target;
      if (img.classList && img.classList.contains('vibe-att-img')) {
        img.closest('.vibe-att-tile')?.classList.add('vibe-att-unavailable');
      }
    }, true);
    renderAttachments();

    // Expose pending uploads to doSave (uploaded once the annotation exists).
    activePendingAttachments = pendingAttachments;

    // --- Mode bar (Comment / Design / Variants) ---
    // Comment + Design are combinable views on ONE annotation (both save together).
    // Variants is a distinct save path (mode:"variants") — new annotations only,
    // gated on the MCP server being connected.
    let activeMode = 'comment';
    const modeTabs = popover.querySelectorAll('.vibe-mode-tab');
    const instructionPanel = popover.querySelector('.vibe-mode-panel[data-mode="comment"]');
    const designPanel = popover.querySelector('.vibe-mode-panel[data-mode="design"]');
    const variantsExplain = popover.querySelector('.vibe-variants-explain');

    const variantsTab = popover.querySelector('.vibe-mode-tab[data-mode="variants"]');
    if (variantsTab) {
      VibeAPI.checkServerStatus().then(s => {
        if (s?.connected) {
          variantsTab.disabled = false;
          variantsTab.title = 'Ask your agent to generate several coexisting design variants';
        }
      }).catch(() => {});
    }

    // Lazy touch-ups when a design section reveals: keep the content input sized and
    // the raw-CSS textarea fresh (mirrors the old per-tab behavior).
    function refreshDesignSection(body) {
      const contentInput = body.querySelector('.vibe-content-input');
      if (contentInput) requestAnimationFrame(() => P.autoResizeContentInput(contentInput));
      const rawTA = body.querySelector('.vibe-raw-css');
      if (rawTA && !rawTA._userEdited) rawTA.value = P.buildRawCssContent(context);
    }

    function setMode(mode) {
      activeMode = mode;
      modeTabs.forEach(t => t.classList.toggle('active', t.dataset.mode === mode));
      const isDesign = mode === 'design';
      // Comment and Variants share ONE instruction field (both feed the annotation's
      // comment); only the framing changes. Design swaps in the accordion.
      designPanel.hidden = !isDesign;
      instructionPanel.hidden = isDesign;
      if (variantsExplain) variantsExplain.hidden = mode !== 'variants';
      textarea.placeholder = mode === 'variants'
        ? 'What variants do you want?'
        : 'Describe the change for your AI agent…';
      if (isDesign) {
        popover.querySelectorAll('.vibe-design-sec-body').forEach(body => {
          if (body.style.display !== 'none') refreshDesignSection(body);
        });
      } else {
        textarea.focus();
      }
      popover._updateSave?.();
    }
    modeTabs.forEach(tab => {
      tab.addEventListener('click', () => { if (!tab.disabled) setMode(tab.dataset.mode); });
    });

    // Design accordion — single-open: opening a section collapses the others, so the
    // active panel's content (e.g. the CSS textareas) is always fully visible near the
    // top instead of buried below other expanded sections.
    const designSections = popover.querySelectorAll('.vibe-design-section');
    popover.querySelectorAll('.vibe-design-sec-toggle').forEach(btn => {
      btn.addEventListener('click', () => {
        const section = btn.parentElement;
        const body = section.querySelector('.vibe-design-sec-body');
        const chevron = btn.querySelector('.vibe-design-sec-chevron');
        const willOpen = body.style.display === 'none';
        designSections.forEach(sec => {
          const b = sec.querySelector('.vibe-design-sec-body');
          const c = sec.querySelector('.vibe-design-sec-chevron');
          const open = sec === section && willOpen;
          if (b) b.style.display = open ? '' : 'none';
          if (c) c.classList.toggle('open', open);
        });
        if (willOpen) {
          refreshDesignSection(body);
          requestAnimationFrame(() => btn.scrollIntoView({ block: 'nearest' }));
        }
      });
    });

    // Collapsible toggles inside the CSS section (Inline overrides / CSS rules)
    popover.querySelectorAll('.vibe-raw-css-toggle').forEach(btn => {
      btn.addEventListener('click', () => {
        const section = btn.closest('.vibe-raw-css-section');
        const body = section.querySelector('.vibe-raw-css-collapsible');
        const chevron = btn.querySelector('.vibe-raw-css-chevron');
        const isOpen = body.style.display !== 'none';
        body.style.display = isOpen ? 'none' : '';
        chevron.classList.toggle('open', !isOpen);
      });
    });

    // Raw CSS panel wiring
    const rawCssTextarea = popover.querySelector('.vibe-raw-css');
    const rawCssOriginals = new Map();
    rawCssInitial.split('\n').forEach(line => {
      const m = line.match(/^\s*([\w-]+)\s*:\s*(.+?)\s*;?\s*$/);
      if (m) rawCssOriginals.set(m[1], m[2]);
    });
    activeRawCssOriginals = rawCssOriginals;

    if (rawCssTextarea) {
      rawCssTextarea.addEventListener('input', () => {
        rawCssTextarea._userEdited = true;
        const lines = rawCssTextarea.value.split('\n');
        const seen = new Set();
        for (const line of lines) {
          const m = line.match(/^\s*([\w-]+)\s*:\s*(.+?)\s*;?\s*$/);
          if (!m) continue;
          const [, prop, val] = m;
          seen.add(prop);
          targetElement.style[P.kebabToCamel(prop)] = val;
        }
        for (const [prop] of rawCssOriginals) {
          if (!seen.has(prop)) {
            targetElement.style[P.kebabToCamel(prop)] = '';
          }
        }
        popover._updateResetVisibility?.();
        popover._updateSave?.();
      });
    }

    // CSS Rules panel wiring
    const cssRulesTextarea = popover.querySelector('.vibe-css-rules');
    const cssRulesOriginal = existingAnnotation?.css || '';
    let cssRulesPreviewStyle = null;

    if (cssRulesTextarea) {
      cssRulesPreviewStyle = document.createElement('style');
      cssRulesPreviewStyle.setAttribute('data-vibe-css-preview', 'true');
      if (cssRulesOriginal) cssRulesPreviewStyle.textContent = cssRulesOriginal;
      document.head.appendChild(cssRulesPreviewStyle);
      activeCssRulesStyleEl = cssRulesPreviewStyle;

      cssRulesTextarea.addEventListener('input', () => {
        cssRulesTextarea._userEdited = true;
        cssRulesPreviewStyle.textContent = cssRulesTextarea.value;
        popover._updateResetVisibility?.();
        popover._updateSave?.();
      });
    }

    // Wire design panels via VibePopoverPanels
    const bpcFns = [];
    if (hasText) {
      bpcFns.push(P.wireContentToolbar(popover, targetElement, pc, resetBtn));
    }
    if (elType === 'text' || elType === 'both') {
      bpcFns.push(P.wireTextToolbar(popover, targetElement, pc, s, resetBtn));
    }
    if (elType === 'container' || elType === 'both') {
      bpcFns.push(P.wireContainerToolbar(popover, targetElement, pc, s, resetBtn));
    }
    bpcFns.push(P.wireSizingToolbar(popover, targetElement, pc, s, resetBtn));

    // Raw CSS buildPendingChanges
    function buildRawCssPC() {
      if (!rawCssTextarea?._userEdited) return null;
      const changes = {};
      const lines = rawCssTextarea.value.split('\n');
      for (const line of lines) {
        const m = line.match(/^\s*([\w-]+)\s*:\s*(.+?)\s*;?\s*$/);
        if (!m) continue;
        const [, prop, val] = m;
        const orig = rawCssOriginals.get(prop);
        if (orig !== undefined && val !== orig) {
          changes[P.kebabToCamel(prop)] = { original: orig, value: val };
        }
      }
      return Object.keys(changes).length ? changes : null;
    }

    function buildPendingChanges() {
      const merged = {};
      for (const fn of bpcFns) {
        const result = fn();
        if (result) Object.assign(merged, result);
      }
      const rawChanges = buildRawCssPC();
      if (rawChanges) {
        for (const [k, v] of Object.entries(rawChanges)) {
          if (!merged[k]) merged[k] = v;
        }
      }
      return Object.keys(merged).length ? merged : null;
    }

    // Raw CSS reset
    resetBtn.addEventListener('click', () => {
      if (rawCssTextarea) {
        rawCssTextarea.value = rawCssInitial;
        rawCssTextarea._userEdited = false;
        for (const [prop] of rawCssOriginals) {
          targetElement.style[P.kebabToCamel(prop)] = '';
        }
      }
      if (cssRulesTextarea) {
        cssRulesTextarea.value = cssRulesOriginal;
        cssRulesTextarea._userEdited = false;
        if (cssRulesPreviewStyle) cssRulesPreviewStyle.textContent = cssRulesOriginal;
      }
    });

    function updateResetVisibility() {
      resetBtn.style.visibility = buildPendingChanges() ? 'visible' : 'hidden';
    }

    // Apply saved pending_changes on open (edit mode)
    if (pc) {
      for (const prop of P.ALL_DESIGN_PROPS) {
        if (pc[prop]) targetElement.style[prop] = pc[prop].value;
      }
      if (pc.copyChange) targetElement.textContent = pc.copyChange.value;
    }
    updateResetVisibility();

    // Light a "changed" dot on each Design section header (and the Design tab) that
    // currently carries a pending change, so edits are visible without opening every
    // section.
    function updateSectionDots() {
      const pc = buildPendingChanges() || {};
      const active = new Set();
      for (const key of Object.keys(pc)) {
        const sec = PROP_TO_SECTION[key];
        active.add(sec || 'raw-css');
      }
      if (rawCssTextarea?._userEdited || cssRulesTextarea?._userEdited) active.add('raw-css');
      popover.querySelectorAll('.vibe-design-sec-dot').forEach(dot => {
        dot.classList.toggle('on', active.has(dot.getAttribute('data-sec-dot')));
      });
      const designDot = popover.querySelector('.vibe-mode-tab[data-mode="design"] .vibe-mode-dot');
      if (designDot) designDot.classList.toggle('on', active.size > 0);
    }

    // Enable/disable save
    const updateSave = () => {
      updateSectionDots();
      // Variants is its own path — save is gated on the (shared) instruction only.
      if (activeMode === 'variants') {
        saveBtn.textContent = 'Create variants';
        saveBtn.disabled = !textarea.value.trim();
        return;
      }
      const text = textarea.value.trim();
      const hasDesignChanges = !!buildPendingChanges();
      // An image attachment (pending/added) or a screenshot that will be captured
      // on save counts as content — the annotation isn't just a bare pointer.
      const hasImage = pendingAttachments.length > 0 || VibeAPI.isScreenshotEnabled();
      if (isEdit) {
        const commentChanged = text !== (existingAnnotation.comment || '');
        const savedPC = existingAnnotation.pending_changes || null;
        const designChanged = JSON.stringify(buildPendingChanges()) !== JSON.stringify(savedPC);
        const cssRulesVal = cssRulesTextarea ? cssRulesTextarea.value : '';
        const cssRulesChanged = cssRulesVal !== cssRulesOriginal;
        saveBtn.disabled = !commentChanged && !designChanged && !cssRulesChanged && !attachmentsDirty;
        saveBtn.textContent = 'Save';
      } else {
        saveBtn.disabled = false;
        saveBtn.textContent = (text || hasDesignChanges || hasImage) ? 'Save annotation' : 'Save as pointer';
      }
    };
    textarea.addEventListener('input', updateSave);
    popover._updateSave = updateSave;
    popover._updateResetVisibility = updateResetVisibility;
    updateSave();

    // Focus textarea
    const prevActive = document.activeElement;
    const blurBlocker = (e) => {
      if (e.target === prevActive) { e.stopImmediatePropagation(); e.stopPropagation(); }
    };
    document.addEventListener('blur', blurBlocker, true);
    document.addEventListener('focusout', blurBlocker, true);
    textarea.focus();
    if (isEdit) textarea.select();
    document.removeEventListener('blur', blurBlocker, true);
    document.removeEventListener('focusout', blurBlocker, true);
    textarea.addEventListener('pointerdown', () => textarea.focus());

    // Cancel / close
    const close = () => dismiss(true);
    cancelBtn.addEventListener('click', close);
    anchor.addEventListener('pointerdown', (e) => {
      if (e.target === anchor) close();
    });

    // ESC / Cmd+Enter
    escHandler = (e) => {
      if (e.key === 'Escape') {
        close();
      } else if (e.key === 'Enter' && (e.metaKey || e.ctrlKey) && !saveBtn.disabled) {
        e.preventDefault();
        saveBtn.click();
      }
    };
    document.addEventListener('keydown', escHandler);

    // Delete
    if (deleteBtn && isEdit) {
      deleteBtn.addEventListener('click', async () => {
        const skip = await VibeAPI.getSkipDeleteConfirm();
        if (skip) {
          await VibeAPI.deleteAnnotation(existingAnnotation.id);
          VibeEvents.emit('annotation:deleted', { id: existingAnnotation.id });
          activeExistingAnnotation = null;
          activeOriginalCssText = null;
          dismiss(true);
          return;
        }
        const confirmed = await showConfirm(root, 'Delete annotation?', 'This cannot be undone.');
        if (confirmed) {
          await VibeAPI.deleteAnnotation(existingAnnotation.id);
          VibeEvents.emit('annotation:deleted', { id: existingAnnotation.id, annotation: existingAnnotation });
          activeExistingAnnotation = null;
          activeOriginalCssText = null;
          dismiss(true);
        }
      });
    }

    // Save
    let saving = false;
    async function doSave() {
      if (saving) return;
      saving = true;
      saveBtn.disabled = true;

      try {
        // Variants is a separate flow: use the variants instruction as the comment
        // and skip design edits. Otherwise the comment comes from the Comment tab and
        // design edits from the accordion (the two combine on one annotation).
        const isVariants = activeMode === 'variants';
        const comment = textarea.value.trim();
        const pendingChanges = isVariants ? null : buildPendingChanges();
        const cssRulesVal = (!isVariants && cssRulesTextarea) ? cssRulesTextarea.value.trim() : '';
        const cssField = cssRulesVal || null;

        targetElement.style.cssText = activeOriginalCssText || '';
        if (pendingChanges) {
          for (const prop of Object.keys(pendingChanges)) {
            if (prop === 'copyChange') continue;
            if (pendingChanges[prop]) targetElement.style[prop] = pendingChanges[prop].value;
          }
        }

        if (isEdit) {
          const updates = { comment, updated_at: new Date().toISOString(), pending_changes: pendingChanges, css: cssField };
          await VibeAPI.updateAnnotation(existingAnnotation.id, updates);
          VibeEvents.emit('annotation:updated', { id: existingAnnotation.id, comment, pending_changes: pendingChanges, css: cssField });
        } else {
          const annotation = buildAnnotation(context, comment, pendingChanges);
          if (isVariants) annotation.mode = 'variants';
          annotation.selector_preview = getElementOpenTagPreview(targetElement);
          annotation.element_context.id = targetElement.id || null;
          annotation.element_context.role = targetElement.getAttribute('role') || null;
          if (cssField) annotation.css = cssField;
          if (savedBadgeOffset) annotation.badge_offset = savedBadgeOffset;
          await VibeAPI.saveAnnotation(annotation);
          // Upload any images attached before the annotation existed on the server.
          if (activePendingAttachments && activePendingAttachments.length) {
            for (const p of activePendingAttachments) {
              VibeAPI.uploadUserImage(annotation.id, p.blob, p.mime, p.kind || 'user').catch(() => {});
            }
          }
          VibeEvents.emit('annotation:saved', { annotation, element: targetElement });
        }

        dismiss(true, true);
      } catch (err) {
        saving = false;
        saveBtn.disabled = false;
        console.warn('[Vibe] Save failed:', err);
      }
    }

    saveBtn.addEventListener('click', doSave);
  }

  // --- Variants review (browse + choose) ---

  function renderVariantsReview(anchor, popover, targetElement, annotation, clickX, clickY) {
    const payload = annotation.variantsPayload || {};
    const variants = Array.isArray(payload.variants) ? payload.variants : [];
    const attribute = payload.attribute || 'data-vibe-active';
    const container = payload.container ? document.querySelector(payload.container) : null;
    let chosenValue = annotation.chosenVariant != null ? String(annotation.chosenVariant) : null;
    const title = P.escapeHTML(annotation.comment || 'Variants');

    const close = () => dismiss(true);

    if (!container || !variants.length) {
      // Container not on this page (wrong route, not reloaded, or scaffolding gone).
      popover.innerHTML = `
        <div class="vibe-drag-handle"></div>
        <div class="vibe-popover-title"><span>${title}</span></div>
        <div class="vibe-variants-review">
          <p class="vibe-variants-warn">Variants not detected on this page — reload the page, or check you're on the route where they were generated.</p>
        </div>
        <div class="vibe-popover-footer"><div class="vibe-footer-left"></div><div class="vibe-footer-right"><button class="vibe-btn vibe-btn-secondary vibe-cancel-btn">Close</button></div></div>
      `;
      anchor.appendChild(popover);
      currentPopover = anchor;
      positionPopover(anchor, targetElement, clickX, clickY);
      wireDragHandle(popover.querySelector('.vibe-drag-handle'), popover);
      popover.querySelector('.vibe-cancel-btn').addEventListener('click', close);
      anchor.addEventListener('pointerdown', (e) => { if (e.target === anchor) close(); });
      escHandler = (e) => { if (e.key === 'Escape') close(); };
      document.addEventListener('keydown', escHandler);
      return;
    }

    // Restore the chosen variant into the live preview on open (the code hardcodes
    // data-vibe-active="1", so the page won't otherwise reflect a prior choice).
    if (chosenValue) {
      container.setAttribute(attribute, chosenValue);
      VibeEvents.emit('variants:switched', { id: annotation.id, variant: chosenValue });
    }
    const current = chosenValue || container.getAttribute(attribute) || String(variants[0].value);
    const rows = variants.map(v => {
      const val = P.escapeHTML(String(v.value));
      const on = String(v.value) === String(current);
      return `<label class="vibe-variant-row${on ? ' active' : ''}">
        <input type="radio" name="vibe-variant" value="${val}"${on ? ' checked' : ''}>
        <span>${P.escapeHTML(v.name || String(v.value))}</span>
      </label>`;
    }).join('');

    popover.innerHTML = `
      <div class="vibe-drag-handle"></div>
      <div class="vibe-popover-title"><span>${title}</span></div>
      <div class="vibe-variants-review">
        <p class="vibe-variants-hint">${chosenValue != null ? 'Chosen — now ask your agent to finalize.' : 'Pick a variant to preview it live in the page.'}</p>
        <div class="vibe-variant-list">${rows}</div>
      </div>
      <div class="vibe-popover-footer">
        <div class="vibe-footer-left"><button class="vibe-btn-icon vibe-variants-delete" title="Discard variants">${P.ICONS.trash}</button></div>
        <div class="vibe-footer-right">
          <button class="vibe-btn vibe-btn-secondary vibe-cancel-btn">Close</button>
          <button class="vibe-btn vibe-btn-primary vibe-variants-choose"${chosenValue != null ? ' disabled' : ''}>${chosenValue != null ? 'Chosen ✓' : 'Choose this variant'}</button>
        </div>
      </div>
    `;

    anchor.appendChild(popover);
    currentPopover = anchor;
    // The badge (and thus targetElement) anchors to the container, which is
    // display:contents and has an empty rect at (0,0) — positioning against it
    // would fling the popover to the top-left. Position against the active variant
    // child, which has a real box on the page.
    let posEl = null;
    try {
      const esc = (window.CSS && CSS.escape) ? CSS.escape(current) : current;
      posEl = container.querySelector(`:scope > [data-variant="${esc}"]`) || container.querySelector(':scope > [data-variant]');
    } catch (_) {}
    positionPopover(anchor, posEl || targetElement, clickX, clickY);
    wireDragHandle(popover.querySelector('.vibe-drag-handle'), popover);

    popover.querySelector('.vibe-cancel-btn').addEventListener('click', close);
    anchor.addEventListener('pointerdown', (e) => { if (e.target === anchor) close(); });
    escHandler = (e) => { if (e.key === 'Escape') close(); };
    document.addEventListener('keydown', escHandler);

    const chooseBtn = popover.querySelector('.vibe-variants-choose');
    const hint = popover.querySelector('.vibe-variants-hint');

    // The CTA reflects whether the selected radio matches the persisted choice:
    // same → "Chosen ✓" (disabled); different (or none yet) → an actionable button.
    function refreshChoose() {
      const selected = popover.querySelector('input[name="vibe-variant"]:checked')?.value;
      const isSel = chosenValue != null && String(selected) === chosenValue;
      chooseBtn.textContent = isSel ? 'Chosen ✓' : (chosenValue != null ? 'Update selection' : 'Choose this variant');
      chooseBtn.disabled = isSel;
      if (hint) hint.textContent = chosenValue == null
        ? 'Pick a variant to preview it live in the page.'
        : (isSel ? 'Chosen — now ask your agent to finalize.' : 'Selection changed — update it to save.');
    }

    // Radio → flip the single attribute (THE ONLY DOM write) + refresh the CTA.
    popover.querySelectorAll('input[name="vibe-variant"]').forEach(input => {
      input.addEventListener('change', () => {
        container.setAttribute(attribute, input.value);
        popover.querySelectorAll('.vibe-variant-row').forEach(r => r.classList.toggle('active', r.contains(input)));
        VibeEvents.emit('variants:switched', { id: annotation.id, variant: input.value });
        refreshChoose();
      });
    });

    // Choose / update → persist chosenVariant + status:variant-chosen.
    chooseBtn.addEventListener('click', async () => {
      const active = popover.querySelector('input[name="vibe-variant"]:checked')?.value
        || container.getAttribute(attribute) || String(variants[0].value);
      try {
        await VibeAPI.updateAnnotation(annotation.id, { chosenVariant: active, status: 'variant-chosen' });
        VibeAPI.forceSync(); // push to server so the agent can finalize right away
        chosenValue = String(active);
        refreshChoose();
      } catch (err) { console.warn('[Vibe] choose variant failed:', err); }
    });

    // Discard → mark variants-discarded (NOT a hard delete). A plain delete
    // tombstones the id and hard-deletes it from the server on sync, losing the
    // scaffolding-cleanup contract. Marking discarded keeps the annotation so the
    // agent still sees it (with cleanup instructions) on a normal read; the badge
    // is removed from view via annotation:deleted. Also revert the live preview to
    // the original (variant 1) so the page no longer shows the abandoned choice.
    popover.querySelector('.vibe-variants-delete').addEventListener('click', async () => {
      const original = String(variants[0].value);
      container.setAttribute(attribute, original);
      VibeEvents.emit('variants:switched', { id: annotation.id, variant: original });
      try {
        await VibeAPI.updateAnnotation(annotation.id, { status: 'variants-discarded' });
        VibeAPI.forceSync();
      } catch { /* ignore */ }
      VibeEvents.emit('annotation:deleted', { id: annotation.id });
      close();
    });
  }

  // --- Dismiss ---

  function dismiss(reEnableInspection = false, saved = false) {
    const hadPopover = !!currentPopover;

    if (hadPopover && !saved && activeElement && activeOriginalCssText !== null) {
      activeElement.style.cssText = activeOriginalCssText;
      if (activeTextDirty && activeOriginalText !== null) {
        activeElement.textContent = activeOriginalText;
      }
      const apc = activeExistingAnnotation?.pending_changes;
      if (apc) {
        for (const prop of P.ALL_DESIGN_PROPS) {
          if (apc[prop]) activeElement.style[prop] = apc[prop].value;
        }
        if (apc.copyChange) activeElement.textContent = apc.copyChange.value;
      }
    }

    if (activeCssRulesStyleEl) {
      activeCssRulesStyleEl.remove();
      activeCssRulesStyleEl = null;
    }

    if (currentPopover) { currentPopover.remove(); currentPopover = null; }
    stopHighlightRAF();
    if (currentTargetHighlight) { currentTargetHighlight.remove(); currentTargetHighlight = null; }
    if (escHandler) { document.removeEventListener('keydown', escHandler); escHandler = null; }
    activeElement = null;
    activeExistingAnnotation = null;
    activeElType = null;
    activeRawCssOriginals = null;
    activeOriginalText = null;
    activeTextDirty = false;
    activeOriginalCssText = null;
    if (hadPopover && !saved) VibeEvents.emit('popover:cancelled');
    if (reEnableInspection) VibeInspectionMode.reEnable();
  }

  // --- Drag handle ---

  function wireDragHandle(handle, popover) {
    if (!handle) return;
    let startX, startY, startLeft, startTop;

    handle.addEventListener('pointerdown', (e) => {
      e.preventDefault();
      e.stopPropagation();
      startX = e.clientX;
      startY = e.clientY;
      startLeft = parseFloat(popover.style.left) || 0;
      startTop = parseFloat(popover.style.top) || 0;
      handle.setPointerCapture(e.pointerId);
      popover.classList.add('dragging');

      const onMove = (ev) => {
        popover.style.left = `${startLeft + ev.clientX - startX}px`;
        popover.style.top = `${startTop + ev.clientY - startY}px`;
      };
      const onUp = () => {
        handle.removeEventListener('pointermove', onMove);
        handle.removeEventListener('pointerup', onUp);
        popover.classList.remove('dragging');
      };
      handle.addEventListener('pointermove', onMove);
      handle.addEventListener('pointerup', onUp);
    });
  }

  // --- Positioning ---

  function positionPopover(anchor, targetElement, clickX, clickY) {
    const gap = 10;
    const popoverWidth = 340;
    const popover = anchor.querySelector('.vibe-popover');
    if (!popover) return;

    popover.style.position = 'fixed';
    popover.style.left = '-9999px';
    popover.style.top = '0';
    const popoverHeight = popover.offsetHeight || 300;

    let anchorX = clickX, anchorY = clickY;
    if (anchorX == null || anchorY == null) {
      const rect = targetElement.getBoundingClientRect();
      anchorX = rect.left + rect.width / 2;
      anchorY = rect.top + rect.height / 2;
    }

    let top, left;
    if (anchorY + gap + popoverHeight < window.innerHeight) {
      top = anchorY + gap;
    } else if (anchorY - gap - popoverHeight > 0) {
      top = anchorY - gap - popoverHeight;
    } else {
      top = Math.max(10, window.innerHeight - popoverHeight - 10);
    }
    left = anchorX - popoverWidth / 2;
    left = Math.max(10, Math.min(left, window.innerWidth - popoverWidth - 10));

    popover.style.position = 'fixed';
    popover.style.top = `${top}px`;
    popover.style.left = `${left}px`;
  }

  function positionTargetHighlight(element) {
    if (!currentTargetHighlight) return;
    const update = () => {
      if (!currentTargetHighlight) return;
      const rect = element.getBoundingClientRect();
      currentTargetHighlight.style.top = `${rect.top - 2}px`;
      currentTargetHighlight.style.left = `${rect.left - 2}px`;
      currentTargetHighlight.style.width = `${rect.width + 4}px`;
      currentTargetHighlight.style.height = `${rect.height + 4}px`;
      highlightRafId = requestAnimationFrame(update);
    };
    update();
  }

  function stopHighlightRAF() {
    if (highlightRafId) {
      cancelAnimationFrame(highlightRafId);
      highlightRafId = null;
    }
  }

  // --- Confirm dialog ---

  function showConfirm(root, title, message) {
    return new Promise(resolve => {
      const backdrop = document.createElement('div');
      backdrop.className = 'vibe-confirm-backdrop';
      backdrop.innerHTML = `
        <div class="vibe-confirm">
          <div class="vibe-confirm-title">${P.escapeHTML(title)}</div>
          <div class="vibe-confirm-msg">${P.escapeHTML(message)}</div>
          <label class="vibe-confirm-skip" style="display:flex;align-items:center;gap:6px;margin:8px 0 4px;font-size:12px;color:var(--v-text-secondary,#6b7280);cursor:pointer;user-select:none;">
            <input type="checkbox" class="vibe-confirm-skip-cb" style="margin:0;">
            Don't ask again
          </label>
          <div class="vibe-confirm-actions">
            <button class="vibe-btn vibe-btn-secondary vibe-confirm-no">Cancel</button>
            <button class="vibe-btn vibe-btn-danger vibe-confirm-yes">Delete</button>
          </div>
        </div>
      `;
      root.appendChild(backdrop);

      backdrop.querySelector('.vibe-confirm-no').addEventListener('click', () => {
        backdrop.remove();
        resolve(false);
      });
      backdrop.querySelector('.vibe-confirm-yes').addEventListener('click', () => {
        const skipCb = backdrop.querySelector('.vibe-confirm-skip-cb');
        if (skipCb && skipCb.checked) {
          VibeAPI.saveSkipDeleteConfirm(true);
        }
        backdrop.remove();
        resolve(true);
      });
      backdrop.addEventListener('click', (e) => {
        if (e.target === backdrop) { backdrop.remove(); resolve(false); }
      });
    });
  }

  // --- Build annotation data ---

  function buildAnnotation(context, comment, pendingChanges) {
    const annotation = {
      id: 'vibe_' + Date.now() + '_' + Math.random().toString(36).substr(2, 9),
      url: window.location.href,
      selector: context.selector,
      comment,
      viewport: context.viewport,
      element_context: {
        tag: context.tag,
        classes: context.classes,
        text: context.text,
        path: context.path || null,
        styles: context.styles,
        position: context.position
      },
      source_file_path: context.source_mapping?.source_file_path || null,
      source_line_range: context.source_mapping?.source_line_range || null,
      project_area: context.source_mapping?.project_area || 'unknown',
      url_path: context.source_mapping?.url_path || vibeLocationPath(window.location),
      source_map_available: context.source_mapping?.source_map_available || false,
      context_hints: context.source_mapping?.context_hints || null,
      screenshot: context.screenshot || null,
      parent_chain: context.parent_chain || null,
      status: 'pending',
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString()
    };
    if (pendingChanges) annotation.pending_changes = pendingChanges;
    return annotation;
  }

  function getElementOpenTagPreview(element) {
    if (!(element instanceof Element)) return '';
    const tag = element.tagName.toLowerCase();
    const attrs = [];

    const pushAttr = (name, value, { includeEmpty = false, maxLen = 160 } = {}) => {
      if (value == null) return;
      const normalized = String(value).replace(/\s+/g, ' ').trim();
      if (!normalized && !includeEmpty) return;
      attrs.push(`${name}="${P.escapeHTML(normalized.slice(0, maxLen))}"`);
    };

    const classPreview = VibeElementContext.getDisplayClasses(element)
      .slice(0, 6)
      .join(' ');

    pushAttr('class', classPreview);
    pushAttr('id', element.id);
    pushAttr('role', element.getAttribute('role'));
    pushAttr('name', element.getAttribute('name'));
    pushAttr('type', element.getAttribute('type'));

    return `<${tag}${attrs.length ? ' ' + attrs.join(' ') : ''}>`;
  }

const VibeAnnotationPopover = { init, dismiss };
export default VibeAnnotationPopover;
