// Small popover card anchored to target element
// Collapsible element details showing tag + computed CSS.
// Edit mode with pre-filled text + delete button.
// Element-aware toolbar: text elements get typography, containers get layout/spacing/border.

var VibeAnnotationPopover = (() => {
  let currentPopover = null;
  let currentTargetHighlight = null;
  let highlightRafId = null;
  let escHandler = null;
  let activeElement = null;
  let activeExistingAnnotation = null;
  let activeElType = null;

  // All design properties — used for dismiss/revert
  const ALL_DESIGN_PROPS = [
    'fontSize','fontWeight','lineHeight','textAlign',
    'paddingTop','paddingRight','paddingBottom','paddingLeft',
    'display','flexDirection','gap',
    'borderWidth','borderRadius','borderStyle',
    'color','backgroundColor','borderColor'
  ];

  const TEXT_ELEMENTS = new Set([
    'p','h1','h2','h3','h4','h5','h6','span','a','label',
    'li','td','th','dt','dd','figcaption','legend','summary',
    'blockquote','q','cite','em','strong','small','b','i','u',
    'mark','code','pre','abbr','time','caption'
  ]);
  const BOTH_ELEMENTS = new Set(['button']);

  function classifyElement(tag) {
    if (BOTH_ELEMENTS.has(tag)) return 'both';
    if (TEXT_ELEMENTS.has(tag)) return 'text';
    return 'container';
  }

  const ICONS = {
    close: '<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></svg>',
    trash: '<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M3 6h18"/><path d="M19 6v14c0 1-1 2-2 2H7c-1 0-2-1-2-2V6"/><path d="M8 6V4c0-1 1-2 2-2h4c1 0 2 1 2 2v2"/></svg>',
    chevron: '<svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><polyline points="9 18 15 12 9 6"/></svg>',
    warning: '<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="m21.73 18-8-14a2 2 0 0 0-3.48 0l-8 14A2 2 0 0 0 4 21h16a2 2 0 0 0 1.73-3Z"/><line x1="12" y1="9" x2="12" y2="13"/><line x1="12" y1="17" x2="12.01" y2="17"/></svg>',
    reset: '<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M3 12a9 9 0 1 0 9-9 9.75 9.75 0 0 0-6.74 2.74L3 8"/><path d="M3 3v5h5"/></svg>',
    // Text toolbar icons
    typeSize: '<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><polyline points="4 7 4 4 20 4 20 7"/><line x1="12" y1="4" x2="12" y2="20"/><line x1="8" y1="20" x2="16" y2="20"/></svg>',
    typeWeight: '<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><path d="M6 4h8a4 4 0 0 1 4 4 4 4 0 0 1-4 4H6z"/><path d="M6 12h9a4 4 0 0 1 4 4 4 4 0 0 1-4 4H6z"/></svg>',
    typeLeading: '<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><polyline points="8 18 12 22 16 18"/><polyline points="8 6 12 2 16 6"/><line x1="12" y1="2" x2="12" y2="22"/></svg>',
    alignLeft: '<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"><line x1="3" y1="6" x2="21" y2="6"/><line x1="3" y1="12" x2="15" y2="12"/><line x1="3" y1="18" x2="18" y2="18"/></svg>',
    alignCenter: '<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"><line x1="3" y1="6" x2="21" y2="6"/><line x1="6" y1="12" x2="18" y2="12"/><line x1="4" y1="18" x2="20" y2="18"/></svg>',
    alignRight: '<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"><line x1="3" y1="6" x2="21" y2="6"/><line x1="9" y1="12" x2="21" y2="12"/><line x1="6" y1="18" x2="21" y2="18"/></svg>',
    // Container toolbar icons
    paddingV: '<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"><line x1="12" y1="3" x2="12" y2="21"/><polyline points="8 7 12 3 16 7"/><polyline points="8 17 12 21 16 17"/></svg>',
    paddingH: '<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"><line x1="3" y1="12" x2="21" y2="12"/><polyline points="7 8 3 12 7 16"/><polyline points="17 8 21 12 17 16"/></svg>',
    split: '<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"><rect x="3" y="3" width="18" height="18" rx="2"/><line x1="12" y1="3" x2="12" y2="21"/><line x1="3" y1="12" x2="21" y2="12"/></svg>',
    merge: '<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"><rect x="3" y="3" width="18" height="18" rx="2"/></svg>',
    flexRow: '<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"><line x1="5" y1="12" x2="19" y2="12"/><polyline points="15 8 19 12 15 16"/></svg>',
    flexCol: '<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"><line x1="12" y1="5" x2="12" y2="19"/><polyline points="8 15 12 19 16 15"/></svg>',
    gapIcon: '<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"><line x1="8" y1="3" x2="8" y2="21"/><line x1="16" y1="3" x2="16" y2="21"/><line x1="8" y1="12" x2="16" y2="12"/></svg>',
    borderW: '<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round"><rect x="3" y="3" width="18" height="18" rx="2"/></svg>',
    borderR: '<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"><path d="M3 9V5a2 2 0 0 1 2-2h4"/><path d="M3 15v4a2 2 0 0 0 2 2h4"/><path d="M15 3h4a2 2 0 0 1 2 2v4"/><path d="M15 21h4a2 2 0 0 0 2-2v-4"/></svg>',
    fillColor: '<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"><path d="m19 11-8-8-8.6 8.6a2 2 0 0 0 0 2.8l5.2 5.2c.8.8 2 .8 2.8 0L19 11Z"/><path d="m5 2 5 5"/><path d="M2 13h15"/><path d="M22 20a2 2 0 1 1-4 0c0-1.6 2-3 2-3s2 1.4 2 3"/></svg>',
    bgColor: '<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"><rect x="3" y="3" width="18" height="18" rx="2"/><circle cx="12" cy="12" r="3"/></svg>',
    borderColor: '<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-dasharray="4 3"><rect x="3" y="3" width="18" height="18" rx="2"/></svg>'
  };

  const isMac = navigator.platform.toUpperCase().indexOf('MAC') >= 0;
  const kbdHint = isMac ? '\u2318\u21A9' : 'Ctrl+Enter';

  // --- Prop configs per element type ---

  const TEXT_PROP_CONFIG = {
    fontSize:   { step: 1, shiftStep: 10, min: 1, max: 999, unit: 'px' },
    fontWeight: { step: 100, shiftStep: 100, min: 100, max: 900, unit: '' },
    lineHeight: { step: 1, shiftStep: 10, min: 1, max: 999, unit: 'px' },
  };

  const CONTAINER_PROP_CONFIG = {
    paddingTop:    { step: 1, shiftStep: 10, min: 0, max: 999, unit: 'px' },
    paddingRight:  { step: 1, shiftStep: 10, min: 0, max: 999, unit: 'px' },
    paddingBottom: { step: 1, shiftStep: 10, min: 0, max: 999, unit: 'px' },
    paddingLeft:   { step: 1, shiftStep: 10, min: 0, max: 999, unit: 'px' },
    gap:           { step: 1, shiftStep: 10, min: 0, max: 999, unit: 'px' },
    borderWidth:   { step: 1, shiftStep: 1,  min: 0, max: 20,  unit: 'px' },
    borderRadius:  { step: 1, shiftStep: 10, min: 0, max: 999, unit: 'px' },
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
    const apiStatus = await VibeAPI.checkServerStatus();
    const isOffline = !apiStatus.connected;
    const isFile = VibeAPI.isFileProtocol();
    const elType = classifyElement(context.tag);

    // Target highlight
    currentTargetHighlight = document.createElement('div');
    currentTargetHighlight.className = 'vibe-target-highlight';
    root.appendChild(currentTargetHighlight);
    positionTargetHighlight(targetElement);

    // Anchor wrapper (full viewport, catches outside clicks)
    const anchor = document.createElement('div');
    anchor.className = 'vibe-popover-anchor';
    root.appendChild(anchor);

    // Popover card
    const popover = document.createElement('div');
    popover.className = 'vibe-popover';

    // Build element props HTML
    const propsHTML = buildElementPropsHTML(context);

    // Warning bar
    let warningHTML = '';
    if (isFile) {
      warningHTML = `<div class="vibe-warning">${ICONS.warning}<span>Local file mode</span></div>`;
    } else if (isOffline) {
      warningHTML = `<div class="vibe-warning">${ICONS.warning}<span>Server offline — cannot save</span></div>`;
    }

    // Original computed values — use pending_changes.*.original when editing
    const pc = isEdit ? existingAnnotation.pending_changes : null;
    const s = context.styles;

    // Build toolbar HTML based on element type
    let toolbarHTML;
    if (elType === 'both') {
      toolbarHTML = buildTextToolbarHTML(pc, s) + buildContainerToolbarHTML(pc, s);
    } else if (elType === 'text') {
      toolbarHTML = buildTextToolbarHTML(pc, s);
    } else {
      toolbarHTML = buildContainerToolbarHTML(pc, s);
    }

    popover.innerHTML = `
      <button class="vibe-element-toggle" type="button">
        ${ICONS.chevron}
        <span>&lt;${escapeHTML(context.tag)}&gt;</span>
        ${context.classes.length ? `<span style="opacity:0.5">.${escapeHTML(context.classes[0])}</span>` : ''}
      </button>
      <div class="vibe-element-props">
        <pre>${propsHTML}</pre>
      </div>
      <div class="vibe-design-toolbar">
        ${toolbarHTML}
        <div class="vibe-design-row">
          <button class="vibe-design-reset" type="button" title="Reset all" style="display:none">${ICONS.reset}</button>
        </div>
      </div>
      ${warningHTML}
      <div class="vibe-popover-body">
        <div class="vibe-input-wrap">
          <textarea class="vibe-textarea" placeholder="Describe changes (optional — leave empty to use as anchor point)" maxlength="1000">${isEdit ? escapeHTML(existingAnnotation.comment) : ''}</textarea>
          <span class="vibe-kbd-hint">${kbdHint} to save</span>
        </div>
      </div>
      <div class="vibe-popover-footer">
        ${isEdit ? `<button class="vibe-btn-icon vibe-delete-btn" title="Delete">${ICONS.trash}</button>` : '<span></span>'}
        <div class="right" style="display:flex;gap:8px;align-items:center;margin-left:auto;">
          <button class="vibe-btn vibe-btn-secondary vibe-cancel-btn">Cancel</button>
          <button class="vibe-btn vibe-btn-primary vibe-save-btn" disabled>${isEdit ? 'Save' : 'Add'}</button>
        </div>
      </div>
    `;

    anchor.appendChild(popover);
    currentPopover = anchor;

    // Position
    positionPopover(anchor, targetElement, clickX, clickY);

    // Wire up
    const textarea = popover.querySelector('.vibe-textarea');
    const saveBtn = popover.querySelector('.vibe-save-btn');
    const cancelBtn = popover.querySelector('.vibe-cancel-btn');
    const toggleBtn = popover.querySelector('.vibe-element-toggle');
    const propsDiv = popover.querySelector('.vibe-element-props');
    const deleteBtn = popover.querySelector('.vibe-delete-btn');
    const resetBtn = popover.querySelector('.vibe-design-reset');

    // Track active element for revert-on-dismiss
    activeElement = targetElement;
    activeExistingAnnotation = existingAnnotation;
    activeElType = elType;

    // Collapsible element details
    toggleBtn.addEventListener('click', () => {
      toggleBtn.classList.toggle('open');
      propsDiv.classList.toggle('open');
    });

    // Wire type-specific toolbar and get buildPendingChanges function
    let buildPendingChanges;
    if (elType === 'both') {
      const textBPC = wireTextToolbar(popover, targetElement, pc, s, resetBtn);
      const containerBPC = wireContainerToolbar(popover, targetElement, pc, s, resetBtn);
      buildPendingChanges = () => {
        const merged = { ...(textBPC() || {}), ...(containerBPC() || {}) };
        return Object.keys(merged).length ? merged : null;
      };
    } else if (elType === 'text') {
      buildPendingChanges = wireTextToolbar(popover, targetElement, pc, s, resetBtn);
    } else {
      buildPendingChanges = wireContainerToolbar(popover, targetElement, pc, s, resetBtn);
    }

    function updateResetVisibility() {
      resetBtn.style.display = buildPendingChanges() ? '' : 'none';
    }

    // Apply saved pending_changes on open (edit mode)
    if (pc) {
      for (const prop of ALL_DESIGN_PROPS) {
        if (pc[prop]) targetElement.style[prop] = pc[prop].value;
      }
    }
    updateResetVisibility();

    // Enable/disable save
    const updateSave = () => {
      const text = textarea.value.trim();
      const hasDesignChanges = !!buildPendingChanges();

      if (isOffline && !isFile) {
        saveBtn.disabled = true;
        saveBtn.textContent = 'Offline';
        return;
      }
      if (isEdit) {
        const commentChanged = text !== (existingAnnotation.comment || '');
        const savedPC = existingAnnotation.pending_changes || null;
        const designChanged = JSON.stringify(buildPendingChanges()) !== JSON.stringify(savedPC);
        saveBtn.disabled = !commentChanged && !designChanged;
      } else {
        saveBtn.disabled = false;
      }
      saveBtn.textContent = isEdit ? 'Save' : 'Add';
    };
    textarea.addEventListener('input', updateSave);

    // Expose updateSave and updateResetVisibility to toolbar wiring
    popover._updateSave = updateSave;
    popover._updateResetVisibility = updateResetVisibility;
    updateSave();

    // Focus textarea ASAP — temporarily block blur/focusout so framework doesn't react
    const prevActive = document.activeElement;
    const blurBlocker = (e) => {
      if (e.target === prevActive) {
        e.stopImmediatePropagation();
        e.stopPropagation();
      }
    };
    document.addEventListener('blur', blurBlocker, true);
    document.addEventListener('focusout', blurBlocker, true);
    textarea.focus();
    if (isEdit) textarea.select();
    document.removeEventListener('blur', blurBlocker, true);
    document.removeEventListener('focusout', blurBlocker, true);

    // Ensure click-to-focus works even if a framework capture-handler cancelled pointerdown
    textarea.addEventListener('pointerdown', () => textarea.focus());

    // Cancel / close
    const close = () => dismiss(true);
    cancelBtn.addEventListener('click', close);

    // Click outside
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
          dismiss(true);
          return;
        }
        const confirmed = await showConfirm(root, 'Delete annotation?', 'This cannot be undone.');
        if (confirmed) {
          await VibeAPI.deleteAnnotation(existingAnnotation.id);
          VibeEvents.emit('annotation:deleted', { id: existingAnnotation.id, annotation: existingAnnotation });
          dismiss(true, true);
        }
      });
    }

    // Save
    saveBtn.addEventListener('click', async () => {
      const comment = textarea.value.trim();
      const pendingChanges = buildPendingChanges();

      if (isEdit) {
        const updates = { comment, updated_at: new Date().toISOString(), pending_changes: pendingChanges };
        await VibeAPI.updateAnnotation(existingAnnotation.id, updates);
        VibeEvents.emit('annotation:updated', { id: existingAnnotation.id, comment, pending_changes: pendingChanges });
      } else {
        const annotation = buildAnnotation(context, comment, pendingChanges);
        if (clickX != null) {
          const r = targetElement.getBoundingClientRect();
          annotation.badge_offset = { x: clickX - r.left, y: clickY - r.top };
        }
        await VibeAPI.saveAnnotation(annotation);
        VibeEvents.emit('annotation:saved', { annotation, element: targetElement });
      }

      dismiss(true, true);
    });
  }

  // --- Text toolbar HTML + wiring ---

  function buildTextToolbarHTML(pc, s) {
    const origFS = pc?.fontSize ? parseFloat(pc.fontSize.original) : (parseFloat(s.fontSize) || 16);
    const origFW = pc?.fontWeight ? parseInt(pc.fontWeight.original) : (parseInt(s.fontWeight) || 400);
    const origLH = pc?.lineHeight ? parseFloat(pc.lineHeight.original) : (parseFloat(s.lineHeight) || Math.round(origFS * 1.2));
    const origTA = pc?.textAlign ? pc.textAlign.original : normalizeTextAlign(s.textAlign);
    const origColor = pc?.color ? pc.color.original : (s.color || 'rgb(0,0,0)');

    const curFS = pc?.fontSize ? parseFloat(pc.fontSize.value) : origFS;
    const curFW = pc?.fontWeight ? parseInt(pc.fontWeight.value) : origFW;
    const curLH = pc?.lineHeight ? parseFloat(pc.lineHeight.value) : origLH;
    const curTA = pc?.textAlign ? pc.textAlign.value : origTA;
    const curColor = pc?.color ? pc.color.value : origColor;
    const curColorHex = toHex(curColor);

    return `
      <div class="vibe-design-row">
        <span class="vibe-design-icon" title="Font size">${ICONS.typeSize}</span>
        <div class="vibe-stepper">
          <input class="vibe-stepper-input" data-prop="fontSize" type="number" min="1" max="999" value="${Math.round(curFS)}">
          <span class="vibe-stepper-unit">px</span>
        </div>
        <span class="vibe-design-icon" title="Font weight">${ICONS.typeWeight}</span>
        <div class="vibe-stepper">
          <input class="vibe-stepper-input" data-prop="fontWeight" type="number" min="100" max="900" step="100" value="${Math.round(curFW)}">
        </div>
        <span class="vibe-design-icon" title="Line height">${ICONS.typeLeading}</span>
        <div class="vibe-stepper">
          <input class="vibe-stepper-input" data-prop="lineHeight" type="number" min="1" max="999" value="${Math.round(curLH)}">
          <span class="vibe-stepper-unit">px</span>
        </div>
      </div>
      <div class="vibe-design-row">
        <div class="vibe-align-group">
          <button class="vibe-align-btn ${curTA === 'left' ? 'active' : ''}" data-align="left" type="button" title="Align left">${ICONS.alignLeft}</button>
          <button class="vibe-align-btn ${curTA === 'center' ? 'active' : ''}" data-align="center" type="button" title="Align center">${ICONS.alignCenter}</button>
          <button class="vibe-align-btn ${curTA === 'right' ? 'active' : ''}" data-align="right" type="button" title="Align right">${ICONS.alignRight}</button>
        </div>
      </div>
      <div class="vibe-design-row vibe-color-row">
        <span class="vibe-design-icon" title="Text color">${ICONS.fillColor}</span>
        <button class="vibe-color-swatch" data-color-prop="color" type="button" style="background:${curColorHex}"></button>
        <input class="vibe-color-input" data-color-prop="color" type="text" value="${curColorHex}" placeholder="#000000">
      </div>
    `;
  }

  function wireTextToolbar(popover, targetElement, pc, s, resetBtn) {
    const origFS = pc?.fontSize ? parseFloat(pc.fontSize.original) : (parseFloat(s.fontSize) || 16);
    const origFW = pc?.fontWeight ? parseInt(pc.fontWeight.original) : (parseInt(s.fontWeight) || 400);
    const origLH = pc?.lineHeight ? parseFloat(pc.lineHeight.original) : (parseFloat(s.lineHeight) || Math.round(origFS * 1.2));
    const origTA = pc?.textAlign ? pc.textAlign.original : normalizeTextAlign(s.textAlign);
    const origColor = pc?.color ? pc.color.original : (s.color || 'rgb(0,0,0)');

    const PROP_CONFIG = {
      fontSize:   { ...TEXT_PROP_CONFIG.fontSize, orig: origFS },
      fontWeight: { ...TEXT_PROP_CONFIG.fontWeight, orig: origFW },
      lineHeight: { ...TEXT_PROP_CONFIG.lineHeight, orig: origLH },
    };

    const alignBtns = popover.querySelectorAll('.vibe-align-btn');
    let currentTextAlign = pc?.textAlign ? pc.textAlign.value : origTA;

    // Color state
    const colorState = { color: { orig: origColor, value: pc?.color?.value || origColor, variable: pc?.color?.variable || null } };

    // Wire numeric stepper inputs
    wireStepperInputs(popover, targetElement, PROP_CONFIG);

    // Wire text-align toggle
    alignBtns.forEach(btn => {
      btn.addEventListener('click', () => {
        currentTextAlign = btn.dataset.align;
        targetElement.style.textAlign = currentTextAlign;
        alignBtns.forEach(b => b.classList.toggle('active', b.dataset.align === currentTextAlign));
        popover._updateResetVisibility?.();
        popover._updateSave?.();
      });
    });

    // Wire color picker
    wireColorPicker(popover, targetElement, colorState, 'color');

    // Reset handler
    resetBtn.addEventListener('click', () => {
      popover.querySelectorAll('.vibe-stepper-input').forEach(input => {
        const cfg = PROP_CONFIG[input.dataset.prop];
        if (!cfg) return;
        input.value = Math.round(cfg.orig);
        targetElement.style[input.dataset.prop] = '';
      });
      currentTextAlign = origTA;
      targetElement.style.textAlign = '';
      alignBtns.forEach(b => b.classList.toggle('active', b.dataset.align === origTA));
      resetColorPicker(popover, targetElement, colorState, 'color', origColor);
      popover._updateResetVisibility?.();
      popover._updateSave?.();
    });

    // Return buildPendingChanges
    return function buildPendingChanges() {
      const changes = {};
      popover.querySelectorAll('.vibe-stepper-input').forEach(input => {
        const prop = input.dataset.prop;
        const cfg = PROP_CONFIG[prop];
        if (!cfg) return;
        const cur = Math.round(parseFloat(input.value) || 0);
        if (cur !== Math.round(cfg.orig)) {
          changes[prop] = { original: Math.round(cfg.orig) + cfg.unit, value: cur + cfg.unit };
        }
      });
      if (currentTextAlign !== origTA) {
        changes.textAlign = { original: origTA, value: currentTextAlign };
      }
      // Color
      if (colorState.color.value !== colorState.color.orig) {
        const entry = { original: colorState.color.orig, value: colorState.color.value };
        if (colorState.color.variable) entry.variable = colorState.color.variable;
        changes.color = entry;
      }
      return Object.keys(changes).length ? changes : null;
    };
  }

  // --- Container toolbar HTML + wiring ---

  function buildContainerToolbarHTML(pc, s) {
    const origPT = pc?.paddingTop ? parseFloat(pc.paddingTop.original) : (parseFloat(s.paddingTop) || 0);
    const origPR = pc?.paddingRight ? parseFloat(pc.paddingRight.original) : (parseFloat(s.paddingRight) || 0);
    const origPB = pc?.paddingBottom ? parseFloat(pc.paddingBottom.original) : (parseFloat(s.paddingBottom) || 0);
    const origPL = pc?.paddingLeft ? parseFloat(pc.paddingLeft.original) : (parseFloat(s.paddingLeft) || 0);

    const curPT = pc?.paddingTop ? parseFloat(pc.paddingTop.value) : origPT;
    const curPR = pc?.paddingRight ? parseFloat(pc.paddingRight.value) : origPR;
    const curPB = pc?.paddingBottom ? parseFloat(pc.paddingBottom.value) : origPB;
    const curPL = pc?.paddingLeft ? parseFloat(pc.paddingLeft.value) : origPL;

    // Determine if split mode needed (values differ)
    const needsSplit = (curPT !== curPB) || (curPL !== curPR);

    const vDisplay = curPT === curPB ? `${Math.round(curPT)}` : `${Math.round(curPT)}, ${Math.round(curPB)}`;
    const hDisplay = curPL === curPR ? `${Math.round(curPL)}` : `${Math.round(curPL)}, ${Math.round(curPR)}`;

    const curDisplay = normalizeDisplay(pc?.display ? pc.display.value : s.display);
    const isFlex = curDisplay === 'flex';

    const origGap = pc?.gap ? parseFloat(pc.gap.original) : (parseFloat(s.gap) || 0);
    const curGap = pc?.gap ? parseFloat(pc.gap.value) : origGap;
    const origFlexDir = pc?.flexDirection ? pc.flexDirection.original : (s.flexDirection || 'row');
    const curFlexDir = pc?.flexDirection ? pc.flexDirection.value : origFlexDir;

    const origBW = pc?.borderWidth ? parseFloat(pc.borderWidth.original) : (parseFloat(s.borderTopWidth) || 0);
    const curBW = pc?.borderWidth ? parseFloat(pc.borderWidth.value) : origBW;
    const origBR = pc?.borderRadius ? parseFloat(pc.borderRadius.original) : (parseFloat(s.borderRadius) || 0);
    const curBR = pc?.borderRadius ? parseFloat(pc.borderRadius.value) : origBR;

    const origBgColor = pc?.backgroundColor ? pc.backgroundColor.original : (s.backgroundColor || 'rgba(0,0,0,0)');
    const curBgColor = pc?.backgroundColor ? pc.backgroundColor.value : origBgColor;
    const curBgHex = toHex(curBgColor);

    const origBorderColor = pc?.borderColor ? pc.borderColor.original : (s.borderColor || 'rgb(0,0,0)');
    const curBorderColor = pc?.borderColor ? pc.borderColor.value : origBorderColor;
    const curBorderHex = toHex(curBorderColor);

    return `
      <div class="vibe-design-row vibe-padding-vh-row" ${needsSplit ? 'style="display:none"' : ''}>
        <span class="vibe-design-icon" title="Padding vertical">${ICONS.paddingV}</span>
        <div class="vibe-stepper">
          <input class="vibe-stepper-text vibe-pad-v" type="text" value="${vDisplay}" title="Top, Bottom">
          <span class="vibe-stepper-unit">px</span>
        </div>
        <span class="vibe-design-icon" title="Padding horizontal">${ICONS.paddingH}</span>
        <div class="vibe-stepper">
          <input class="vibe-stepper-text vibe-pad-h" type="text" value="${hDisplay}" title="Left, Right">
          <span class="vibe-stepper-unit">px</span>
        </div>
        <button class="vibe-split-btn" type="button" title="Split padding">${ICONS.split}</button>
      </div>
      <div class="vibe-design-row vibe-padding-split-row" ${needsSplit ? '' : 'style="display:none"'}>
        <span class="vibe-design-icon-label" title="Top">T</span>
        <div class="vibe-stepper vibe-stepper-sm">
          <input class="vibe-stepper-input" data-prop="paddingTop" type="number" min="0" max="999" value="${Math.round(curPT)}">
        </div>
        <span class="vibe-design-icon-label" title="Right">R</span>
        <div class="vibe-stepper vibe-stepper-sm">
          <input class="vibe-stepper-input" data-prop="paddingRight" type="number" min="0" max="999" value="${Math.round(curPR)}">
        </div>
        <span class="vibe-design-icon-label" title="Bottom">B</span>
        <div class="vibe-stepper vibe-stepper-sm">
          <input class="vibe-stepper-input" data-prop="paddingBottom" type="number" min="0" max="999" value="${Math.round(curPB)}">
        </div>
        <span class="vibe-design-icon-label" title="Left">L</span>
        <div class="vibe-stepper vibe-stepper-sm">
          <input class="vibe-stepper-input" data-prop="paddingLeft" type="number" min="0" max="999" value="${Math.round(curPL)}">
        </div>
        <button class="vibe-split-btn active" type="button" title="Merge padding">${ICONS.merge}</button>
      </div>
      <div class="vibe-design-row">
        <div class="vibe-toggle-group">
          <button class="vibe-toggle-btn ${curDisplay === 'block' ? 'active' : ''}" data-display="block" type="button">Block</button>
          <button class="vibe-toggle-btn ${curDisplay === 'flex' ? 'active' : ''}" data-display="flex" type="button">Flex</button>
        </div>
        <div class="vibe-flex-controls" ${isFlex ? '' : 'style="display:none"'}>
          <div class="vibe-toggle-group">
            <button class="vibe-toggle-btn ${curFlexDir === 'row' ? 'active' : ''}" data-dir="row" type="button" title="Row">${ICONS.flexRow}</button>
            <button class="vibe-toggle-btn ${curFlexDir === 'column' ? 'active' : ''}" data-dir="column" type="button" title="Column">${ICONS.flexCol}</button>
          </div>
          <span class="vibe-design-icon" title="Gap">${ICONS.gapIcon}</span>
          <div class="vibe-stepper vibe-stepper-sm">
            <input class="vibe-stepper-input" data-prop="gap" type="number" min="0" max="999" value="${Math.round(curGap)}">
            <span class="vibe-stepper-unit">px</span>
          </div>
        </div>
      </div>
      <div class="vibe-design-row">
        <span class="vibe-design-icon" title="Border width">${ICONS.borderW}</span>
        <div class="vibe-stepper vibe-stepper-sm">
          <input class="vibe-stepper-input" data-prop="borderWidth" type="number" min="0" max="20" value="${Math.round(curBW)}">
          <span class="vibe-stepper-unit">px</span>
        </div>
        <span class="vibe-design-icon" title="Border radius">${ICONS.borderR}</span>
        <div class="vibe-stepper vibe-stepper-sm">
          <input class="vibe-stepper-input" data-prop="borderRadius" type="number" min="0" max="999" value="${Math.round(curBR)}">
          <span class="vibe-stepper-unit">px</span>
        </div>
      </div>
      <div class="vibe-design-row vibe-color-row">
        <span class="vibe-design-icon" title="Background">${ICONS.bgColor}</span>
        <button class="vibe-color-swatch" data-color-prop="backgroundColor" type="button" style="background:${curBgHex}"></button>
        <input class="vibe-color-input" data-color-prop="backgroundColor" type="text" value="${curBgHex}" placeholder="#000000">
      </div>
      <div class="vibe-design-row vibe-color-row">
        <span class="vibe-design-icon" title="Border color">${ICONS.borderColor}</span>
        <button class="vibe-color-swatch" data-color-prop="borderColor" type="button" style="background:${curBorderHex}"></button>
        <input class="vibe-color-input" data-color-prop="borderColor" type="text" value="${curBorderHex}" placeholder="#000000">
      </div>
    `;
  }

  function wireContainerToolbar(popover, targetElement, pc, s, resetBtn) {
    // Original values
    const origPT = pc?.paddingTop ? parseFloat(pc.paddingTop.original) : (parseFloat(s.paddingTop) || 0);
    const origPR = pc?.paddingRight ? parseFloat(pc.paddingRight.original) : (parseFloat(s.paddingRight) || 0);
    const origPB = pc?.paddingBottom ? parseFloat(pc.paddingBottom.original) : (parseFloat(s.paddingBottom) || 0);
    const origPL = pc?.paddingLeft ? parseFloat(pc.paddingLeft.original) : (parseFloat(s.paddingLeft) || 0);
    const origDisplay = normalizeDisplay(pc?.display ? pc.display.original : s.display);
    const origFlexDir = pc?.flexDirection ? pc.flexDirection.original : (s.flexDirection || 'row');
    const origGap = pc?.gap ? parseFloat(pc.gap.original) : (parseFloat(s.gap) || 0);
    const origBW = pc?.borderWidth ? parseFloat(pc.borderWidth.original) : (parseFloat(s.borderTopWidth) || 0);
    const origBR = pc?.borderRadius ? parseFloat(pc.borderRadius.original) : (parseFloat(s.borderRadius) || 0);
    const origBS = pc?.borderStyle ? pc.borderStyle.original : (s.borderStyle || 'none');
    const origBgColor = pc?.backgroundColor ? pc.backgroundColor.original : (s.backgroundColor || 'rgba(0,0,0,0)');
    const origBorderColor = pc?.borderColor ? pc.borderColor.original : (s.borderColor || 'rgb(0,0,0)');

    const PROP_CONFIG = {};
    for (const [k, v] of Object.entries(CONTAINER_PROP_CONFIG)) {
      let origVal;
      if (k === 'paddingTop') origVal = origPT;
      else if (k === 'paddingRight') origVal = origPR;
      else if (k === 'paddingBottom') origVal = origPB;
      else if (k === 'paddingLeft') origVal = origPL;
      else if (k === 'gap') origVal = origGap;
      else if (k === 'borderWidth') origVal = origBW;
      else if (k === 'borderRadius') origVal = origBR;
      PROP_CONFIG[k] = { ...v, orig: origVal };
    }

    // State
    let currentDisplay = normalizeDisplay(pc?.display ? pc.display.value : s.display);
    let currentFlexDir = pc?.flexDirection ? pc.flexDirection.value : origFlexDir;
    let isSplit = popover.querySelector('.vibe-padding-split-row')?.style.display !== 'none';

    // Color states
    const colorState = {
      backgroundColor: { orig: origBgColor, value: pc?.backgroundColor?.value || origBgColor, variable: pc?.backgroundColor?.variable || null },
      borderColor: { orig: origBorderColor, value: pc?.borderColor?.value || origBorderColor, variable: pc?.borderColor?.variable || null }
    };

    const notify = () => { popover._updateResetVisibility?.(); popover._updateSave?.(); };

    // Wire stepper inputs (paddingTop/Right/Bottom/Left, gap, borderWidth, borderRadius)
    wireStepperInputs(popover, targetElement, PROP_CONFIG);

    // --- Padding V/H text inputs ---
    const padVInput = popover.querySelector('.vibe-pad-v');
    const padHInput = popover.querySelector('.vibe-pad-h');
    const vhRow = popover.querySelector('.vibe-padding-vh-row');
    const splitRow = popover.querySelector('.vibe-padding-split-row');
    const splitBtns = popover.querySelectorAll('.vibe-split-btn');

    function applyPadVH() {
      const v = parsePaddingInput(padVInput.value);
      const h = parsePaddingInput(padHInput.value);
      if (v) {
        targetElement.style.paddingTop = v.a + 'px';
        targetElement.style.paddingBottom = v.b + 'px';
      }
      if (h) {
        targetElement.style.paddingLeft = h.a + 'px';
        targetElement.style.paddingRight = h.b + 'px';
      }
      notify();
    }

    padVInput.addEventListener('input', applyPadVH);
    padHInput.addEventListener('input', applyPadVH);

    // Arrow keys on V/H text inputs — step all values
    [padVInput, padHInput].forEach(input => {
      input.addEventListener('keydown', (e) => {
        if (e.key === 'ArrowUp' || e.key === 'ArrowDown') {
          e.preventDefault();
          const step = e.shiftKey ? 10 : 1;
          const delta = e.key === 'ArrowUp' ? step : -step;
          const parts = input.value.split(',').map(s => parseFloat(s.trim())).filter(n => !isNaN(n));
          if (parts.length === 0) parts.push(0);
          const stepped = parts.map(v => Math.max(0, Math.min(999, v + delta)));
          input.value = stepped.length === 1 ? `${stepped[0]}` : `${stepped[0]}, ${stepped[1]}`;
          applyPadVH();
        }
      });
    });

    // Split / merge toggle
    splitBtns.forEach(btn => {
      btn.addEventListener('click', () => {
        isSplit = !isSplit;
        vhRow.style.display = isSplit ? 'none' : '';
        splitRow.style.display = isSplit ? '' : 'none';

        if (isSplit) {
          // Populate split inputs from V/H values
          const v = parsePaddingInput(padVInput.value) || { a: 0, b: 0 };
          const h = parsePaddingInput(padHInput.value) || { a: 0, b: 0 };
          const ptInput = popover.querySelector('[data-prop="paddingTop"]');
          const prInput = popover.querySelector('[data-prop="paddingRight"]');
          const pbInput = popover.querySelector('[data-prop="paddingBottom"]');
          const plInput = popover.querySelector('[data-prop="paddingLeft"]');
          if (ptInput) ptInput.value = Math.round(v.a);
          if (pbInput) pbInput.value = Math.round(v.b);
          if (plInput) plInput.value = Math.round(h.a);
          if (prInput) prInput.value = Math.round(h.b);
        } else {
          // Merge split inputs back to V/H format
          const pt = parseFloat(popover.querySelector('[data-prop="paddingTop"]')?.value) || 0;
          const pr = parseFloat(popover.querySelector('[data-prop="paddingRight"]')?.value) || 0;
          const pb = parseFloat(popover.querySelector('[data-prop="paddingBottom"]')?.value) || 0;
          const pl = parseFloat(popover.querySelector('[data-prop="paddingLeft"]')?.value) || 0;
          padVInput.value = pt === pb ? `${Math.round(pt)}` : `${Math.round(pt)}, ${Math.round(pb)}`;
          padHInput.value = pl === pr ? `${Math.round(pl)}` : `${Math.round(pl)}, ${Math.round(pr)}`;
        }
        notify();
      });
    });

    // --- Display toggle ---
    const displayBtns = popover.querySelectorAll('[data-display]');
    const flexControls = popover.querySelector('.vibe-flex-controls');

    displayBtns.forEach(btn => {
      btn.addEventListener('click', () => {
        currentDisplay = btn.dataset.display;
        targetElement.style.display = currentDisplay;
        displayBtns.forEach(b => b.classList.toggle('active', b.dataset.display === currentDisplay));
        flexControls.style.display = currentDisplay === 'flex' ? '' : 'none';
        if (currentDisplay !== 'flex') {
          targetElement.style.flexDirection = '';
          targetElement.style.gap = '';
        }
        notify();
      });
    });

    // --- Flex direction toggle ---
    const dirBtns = popover.querySelectorAll('[data-dir]');
    dirBtns.forEach(btn => {
      btn.addEventListener('click', () => {
        currentFlexDir = btn.dataset.dir;
        targetElement.style.flexDirection = currentFlexDir;
        dirBtns.forEach(b => b.classList.toggle('active', b.dataset.dir === currentFlexDir));
        notify();
      });
    });

    // --- Border width special: set borderStyle=solid when > 0 ---
    const bwInput = popover.querySelector('[data-prop="borderWidth"]');
    if (bwInput) {
      const origHandler = bwInput._vibeInputHandler;
      bwInput.addEventListener('input', () => {
        const bw = parseFloat(bwInput.value) || 0;
        if (bw > 0) {
          targetElement.style.borderStyle = 'solid';
        } else {
          targetElement.style.borderStyle = '';
          targetElement.style.borderWidth = '';
        }
      });
    }

    // Wire color pickers
    wireColorPicker(popover, targetElement, colorState, 'backgroundColor');
    wireColorPicker(popover, targetElement, colorState, 'borderColor');

    // Reset handler
    resetBtn.addEventListener('click', () => {
      // Reset stepper inputs
      popover.querySelectorAll('.vibe-stepper-input').forEach(input => {
        const cfg = PROP_CONFIG[input.dataset.prop];
        if (!cfg) return;
        input.value = Math.round(cfg.orig);
        targetElement.style[input.dataset.prop] = '';
      });
      // Reset padding V/H
      padVInput.value = origPT === origPB ? `${Math.round(origPT)}` : `${Math.round(origPT)}, ${Math.round(origPB)}`;
      padHInput.value = origPL === origPR ? `${Math.round(origPL)}` : `${Math.round(origPL)}, ${Math.round(origPR)}`;
      // Reset display
      currentDisplay = origDisplay;
      targetElement.style.display = '';
      displayBtns.forEach(b => b.classList.toggle('active', b.dataset.display === origDisplay));
      flexControls.style.display = origDisplay === 'flex' ? '' : 'none';
      // Reset flex
      currentFlexDir = origFlexDir;
      targetElement.style.flexDirection = '';
      targetElement.style.gap = '';
      dirBtns.forEach(b => b.classList.toggle('active', b.dataset.dir === origFlexDir));
      // Reset border
      targetElement.style.borderStyle = '';
      targetElement.style.borderWidth = '';
      targetElement.style.borderRadius = '';
      // Reset colors
      resetColorPicker(popover, targetElement, colorState, 'backgroundColor', origBgColor);
      resetColorPicker(popover, targetElement, colorState, 'borderColor', origBorderColor);
      notify();
    });

    // Return buildPendingChanges
    return function buildPendingChanges() {
      const changes = {};

      // Padding — read from split inputs if split, V/H inputs if merged
      let pt, pr, pb, pl;
      if (isSplit) {
        pt = parseFloat(popover.querySelector('[data-prop="paddingTop"]')?.value) || 0;
        pr = parseFloat(popover.querySelector('[data-prop="paddingRight"]')?.value) || 0;
        pb = parseFloat(popover.querySelector('[data-prop="paddingBottom"]')?.value) || 0;
        pl = parseFloat(popover.querySelector('[data-prop="paddingLeft"]')?.value) || 0;
      } else {
        const v = parsePaddingInput(padVInput.value) || { a: origPT, b: origPB };
        const h = parsePaddingInput(padHInput.value) || { a: origPL, b: origPR };
        pt = v.a; pb = v.b; pl = h.a; pr = h.b;
      }
      if (Math.round(pt) !== Math.round(origPT)) changes.paddingTop = { original: Math.round(origPT) + 'px', value: Math.round(pt) + 'px' };
      if (Math.round(pr) !== Math.round(origPR)) changes.paddingRight = { original: Math.round(origPR) + 'px', value: Math.round(pr) + 'px' };
      if (Math.round(pb) !== Math.round(origPB)) changes.paddingBottom = { original: Math.round(origPB) + 'px', value: Math.round(pb) + 'px' };
      if (Math.round(pl) !== Math.round(origPL)) changes.paddingLeft = { original: Math.round(origPL) + 'px', value: Math.round(pl) + 'px' };

      // Display
      if (currentDisplay !== origDisplay) {
        changes.display = { original: origDisplay, value: currentDisplay };
      }

      // Flex direction + gap (only if flex)
      if (currentDisplay === 'flex') {
        if (currentFlexDir !== origFlexDir) {
          changes.flexDirection = { original: origFlexDir, value: currentFlexDir };
        }
        const gapInput = popover.querySelector('[data-prop="gap"]');
        const curGap = Math.round(parseFloat(gapInput?.value) || 0);
        if (curGap !== Math.round(origGap)) {
          changes.gap = { original: Math.round(origGap) + 'px', value: curGap + 'px' };
        }
      }

      // Border
      const curBW = Math.round(parseFloat(popover.querySelector('[data-prop="borderWidth"]')?.value) || 0);
      const curBR = Math.round(parseFloat(popover.querySelector('[data-prop="borderRadius"]')?.value) || 0);
      if (curBW !== Math.round(origBW)) {
        changes.borderWidth = { original: Math.round(origBW) + 'px', value: curBW + 'px' };
        // Implicit borderStyle
        if (curBW > 0) {
          changes.borderStyle = { original: origBS, value: 'solid' };
        } else {
          changes.borderStyle = { original: origBS, value: 'none' };
        }
      }
      if (curBR !== Math.round(origBR)) {
        changes.borderRadius = { original: Math.round(origBR) + 'px', value: curBR + 'px' };
      }

      // Colors
      if (colorState.backgroundColor.value !== colorState.backgroundColor.orig) {
        const entry = { original: colorState.backgroundColor.orig, value: colorState.backgroundColor.value };
        if (colorState.backgroundColor.variable) entry.variable = colorState.backgroundColor.variable;
        changes.backgroundColor = entry;
      }
      if (colorState.borderColor.value !== colorState.borderColor.orig) {
        const entry = { original: colorState.borderColor.orig, value: colorState.borderColor.value };
        if (colorState.borderColor.variable) entry.variable = colorState.borderColor.variable;
        changes.borderColor = entry;
      }

      return Object.keys(changes).length ? changes : null;
    };
  }

  // --- Shared: wire stepper inputs ---

  function wireStepperInputs(popover, targetElement, PROP_CONFIG) {
    popover.querySelectorAll('.vibe-stepper-input').forEach(input => {
      const prop = input.dataset.prop;
      const cfg = PROP_CONFIG[prop];
      if (!cfg) return;

      const handler = () => {
        const val = parseFloat(input.value);
        if (!isNaN(val) && val >= cfg.min && val <= cfg.max) {
          targetElement.style[prop] = val + cfg.unit;
        }
        popover._updateResetVisibility?.();
        popover._updateSave?.();
      };
      input._vibeInputHandler = handler;
      input.addEventListener('input', handler);

      input.addEventListener('keydown', (e) => {
        if (e.key === 'ArrowUp' || e.key === 'ArrowDown') {
          e.preventDefault();
          const step = e.shiftKey ? cfg.shiftStep : cfg.step;
          const delta = e.key === 'ArrowUp' ? step : -step;
          input.value = Math.max(cfg.min, Math.min(cfg.max, (parseFloat(input.value) || 0) + delta));
          input.dispatchEvent(new Event('input'));
        }
      });
    });
  }

  // --- Shared: color picker ---

  function wireColorPicker(popover, targetElement, colorState, prop) {
    const swatch = popover.querySelector(`.vibe-color-swatch[data-color-prop="${prop}"]`);
    const hexInput = popover.querySelector(`.vibe-color-input[data-color-prop="${prop}"]`);
    if (!swatch || !hexInput) return;

    // Hex input → apply live
    hexInput.addEventListener('input', () => {
      const val = hexInput.value.trim();
      if (/^#[0-9a-fA-F]{3,8}$/.test(val)) {
        targetElement.style[prop] = val;
        swatch.style.background = val;
        colorState[prop].value = val;
        colorState[prop].variable = null;
        popover._updateResetVisibility?.();
        popover._updateSave?.();
      }
    });

    hexInput.addEventListener('blur', () => {
      // Normalize on blur
      const val = hexInput.value.trim();
      if (val && !/^#/.test(val)) hexInput.value = '#' + val;
    });

    // Swatch click → open palette
    swatch.addEventListener('click', (e) => {
      e.stopPropagation();
      // Close any existing palette
      const existing = popover.querySelector('.vibe-color-palette');
      if (existing) { existing.remove(); return; }

      const vars = VibeElementContext.scanPageColorVariables();
      const palette = document.createElement('div');
      palette.className = 'vibe-color-palette';

      if (vars.length === 0) {
        palette.innerHTML = '<span class="vibe-color-palette-empty">No CSS variables detected</span>';
      } else {
        vars.forEach(v => {
          const btn = document.createElement('button');
          btn.className = 'vibe-color-palette-swatch';
          if (colorState[prop].variable === v.name) btn.classList.add('active');
          btn.style.background = v.value;
          btn.title = v.name;
          btn.type = 'button';
          btn.addEventListener('click', (ev) => {
            ev.stopPropagation();
            targetElement.style[prop] = v.value;
            swatch.style.background = v.value;
            hexInput.value = v.value;
            colorState[prop].value = v.value;
            colorState[prop].variable = v.name;
            palette.remove();
            popover._updateResetVisibility?.();
            popover._updateSave?.();
          });
          palette.appendChild(btn);
        });
      }

      swatch.style.position = 'relative';
      swatch.appendChild(palette);

      // Close on outside click — use composedPath to cross shadow DOM boundary
      const closePalette = (ev) => {
        const path = ev.composedPath();
        if (!path.includes(palette) && !path.includes(swatch)) {
          palette.remove();
          document.removeEventListener('pointerdown', closePalette, true);
        }
      };
      setTimeout(() => document.addEventListener('pointerdown', closePalette, true), 0);
    });
  }

  function resetColorPicker(popover, targetElement, colorState, prop, origValue) {
    colorState[prop].value = origValue;
    colorState[prop].variable = null;
    targetElement.style[prop] = '';
    const swatch = popover.querySelector(`.vibe-color-swatch[data-color-prop="${prop}"]`);
    const hexInput = popover.querySelector(`.vibe-color-input[data-color-prop="${prop}"]`);
    const hex = toHex(origValue);
    if (swatch) swatch.style.background = hex;
    if (hexInput) hexInput.value = hex;
  }

  // --- Dismiss ---

  function dismiss(reEnableInspection = false, saved = false) {
    const hadPopover = !!currentPopover;

    // Revert design changes on cancel (not on save)
    if (hadPopover && !saved && activeElement) {
      for (const prop of ALL_DESIGN_PROPS) activeElement.style[prop] = '';
      // Re-apply existing pending_changes if editing an annotation that had them
      const apc = activeExistingAnnotation?.pending_changes;
      if (apc) {
        for (const prop of ALL_DESIGN_PROPS) {
          if (apc[prop]) activeElement.style[prop] = apc[prop].value;
        }
      }
    }

    if (currentPopover) { currentPopover.remove(); currentPopover = null; }
    stopHighlightRAF();
    if (currentTargetHighlight) { currentTargetHighlight.remove(); currentTargetHighlight = null; }
    if (escHandler) { document.removeEventListener('keydown', escHandler); escHandler = null; }
    activeElement = null;
    activeExistingAnnotation = null;
    activeElType = null;
    if (hadPopover && !saved) VibeEvents.emit('popover:cancelled');
    if (reEnableInspection) VibeInspectionMode.reEnable();
  }

  // --- Element props HTML ---

  function buildElementPropsHTML(context) {
    const lines = [];
    const s = context.styles || {};

    if (s.display) lines.push(propLine('display', s.display));
    if (s.position && s.position !== 'static') lines.push(propLine('position', s.position));
    if (s.fontSize) lines.push(propLine('font-size', s.fontSize));
    if (s.color) lines.push(propLine('color', s.color));
    if (s.backgroundColor && s.backgroundColor !== 'rgba(0, 0, 0, 0)') lines.push(propLine('background', s.backgroundColor));
    if (s.padding && s.padding !== '0px') lines.push(propLine('padding', s.padding));
    if (s.margin && s.margin !== '0px') lines.push(propLine('margin', s.margin));

    const pos = context.position || {};
    if (pos.width != null) lines.push(propLine('size', `${Math.round(pos.width)} \u00D7 ${Math.round(pos.height)}`));

    return lines.join('\n') || '<span class="prop-name">no computed styles</span>';
  }

  function propLine(name, value) {
    return `<span class="prop-name">${escapeHTML(name)}</span>: <span class="prop-val">${escapeHTML(value)}</span>`;
  }

  // --- Positioning ---

  function positionPopover(anchor, targetElement, clickX, clickY) {
    const gap = 10;
    const popoverWidth = 340;
    const popover = anchor.querySelector('.vibe-popover');
    if (!popover) return;

    // Measure actual rendered height
    popover.style.position = 'fixed';
    popover.style.left = '-9999px';
    popover.style.top = '0';
    const popoverHeight = popover.offsetHeight || 300;

    // Use click position as anchor; fall back to element center (edit mode)
    let anchorX = clickX, anchorY = clickY;
    if (anchorX == null || anchorY == null) {
      const rect = targetElement.getBoundingClientRect();
      anchorX = rect.left + rect.width / 2;
      anchorY = rect.top + rect.height / 2;
    }

    let top, left;

    // Prefer below click point, then above, then pin to bottom
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
          <div class="vibe-confirm-title">${escapeHTML(title)}</div>
          <div class="vibe-confirm-msg">${escapeHTML(message)}</div>
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
        styles: context.styles,
        position: context.position
      },
      source_file_path: context.source_mapping?.source_file_path || null,
      source_line_range: context.source_mapping?.source_line_range || null,
      project_area: context.source_mapping?.project_area || 'unknown',
      url_path: context.source_mapping?.url_path || window.location.pathname,
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

  // --- Helpers ---

  function normalizeTextAlign(val) {
    if (val === 'start') return 'left';
    if (val === 'end') return 'right';
    return val || 'left';
  }

  function normalizeDisplay(val) {
    if (val === 'flex' || val === 'inline-flex') return 'flex';
    return 'block';
  }

  function parsePaddingInput(val) {
    const parts = val.split(',').map(s => parseFloat(s.trim())).filter(n => !isNaN(n));
    if (parts.length === 0) return null;
    if (parts.length === 1) return { a: parts[0], b: parts[0] };
    return { a: parts[0], b: parts[1] };
  }

  function toHex(color) {
    if (!color) return '#000000';
    // Already hex
    if (/^#[0-9a-fA-F]{3,8}$/.test(color)) return color;
    try {
      const ctx = document.createElement('canvas').getContext('2d');
      ctx.fillStyle = color;
      return ctx.fillStyle;
    } catch {
      return '#000000';
    }
  }

  function escapeHTML(str) {
    const div = document.createElement('div');
    div.textContent = str;
    return div.innerHTML;
  }

  return { init, dismiss };
})();
