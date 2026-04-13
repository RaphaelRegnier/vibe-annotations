// Small popover card anchored to target element
// Core show/dismiss/positioning logic — panel builders live in popover-panels.js

var VibeAnnotationPopover = (() => {
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

  const P = VibePopoverPanels; // shorthand

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

    // Target highlight
    currentTargetHighlight = document.createElement('div');
    currentTargetHighlight.className = 'vibe-target-highlight';
    root.appendChild(currentTargetHighlight);
    positionTargetHighlight(targetElement);

    // Anchor wrapper
    const anchor = document.createElement('div');
    anchor.className = 'vibe-popover-anchor';
    root.appendChild(anchor);

    // Popover card
    const popover = document.createElement('div');
    popover.className = 'vibe-popover';

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

    const tabs = P.getTabsForType(elType);
    const tabBarHTML = tabs.map(t =>
      `<button class="vibe-tab" data-tab="${t.key}" type="button">${t.label}</button>`
    ).join('');
    const panelsHTML = tabs.map(t =>
      `<div class="vibe-tab-panel" data-tab-panel="${t.key}" style="display:none">${panelContent[t.key] || ''}</div>`
    ).join('');

    const selectorLabel = context.classes.length
      ? `${context.tag}.${context.classes[0]}`
      : context.tag;

    popover.innerHTML = `
      <div class="vibe-drag-handle"></div>
      <div class="vibe-popover-title">
        <span>Editing <code>${P.escapeHTML(selectorLabel)}</code></span>
        <button class="vibe-design-reset" type="button" title="Reset all">${P.ICONS.reset}</button>
      </div>
      <div class="vibe-tab-bar">${tabBarHTML}</div>
      <div class="vibe-design-toolbar">
        ${panelsHTML}
      </div>
      ${warningHTML}
      <div class="vibe-popover-body">
        <div class="vibe-input-wrap">
          <textarea class="vibe-textarea" placeholder="What should change?" maxlength="1000">${isEdit ? P.escapeHTML(existingAnnotation.comment) : ''}</textarea>
          <span class="vibe-kbd-hint">${P.kbdHint} to save</span>
        </div>
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

    activeElement = targetElement;
    activeOriginalCssText = targetElement.style.cssText;
    activeExistingAnnotation = existingAnnotation;
    activeElType = elType;

    // Tab switching
    const tabBtns = popover.querySelectorAll('.vibe-tab');
    const tabPanels = popover.querySelectorAll('.vibe-tab-panel');
    const designToolbar = popover.querySelector('.vibe-design-toolbar');
    designToolbar.style.display = 'none';
    tabBtns.forEach(tab => {
      tab.addEventListener('click', () => {
        const wasActive = tab.classList.contains('active');
        tabBtns.forEach(t => t.classList.remove('active'));
        if (wasActive) {
          designToolbar.style.display = 'none';
          tabPanels.forEach(p => p.style.display = 'none');
        } else {
          tab.classList.add('active');
          designToolbar.style.display = '';
          tabPanels.forEach(p => p.style.display = p.dataset.tabPanel === tab.dataset.tab ? '' : 'none');
          if (tab.dataset.tab === 'content') {
            const contentInput = popover.querySelector('.vibe-content-input');
            if (contentInput) requestAnimationFrame(() => P.autoResizeContentInput(contentInput));
          }
          if (tab.dataset.tab === 'raw-css') {
            const rawTA = popover.querySelector('.vibe-raw-css');
            if (rawTA && !rawTA._userEdited) {
              rawTA.value = P.buildRawCssContent(context);
            }
          }
        }
      });
    });

    // Collapsible toggles in CSS panel
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

    // Enable/disable save
    const updateSave = () => {
      const text = textarea.value.trim();
      const hasDesignChanges = !!buildPendingChanges();
      if (isEdit) {
        const commentChanged = text !== (existingAnnotation.comment || '');
        const savedPC = existingAnnotation.pending_changes || null;
        const designChanged = JSON.stringify(buildPendingChanges()) !== JSON.stringify(savedPC);
        const cssRulesVal = cssRulesTextarea ? cssRulesTextarea.value : '';
        const cssRulesChanged = cssRulesVal !== cssRulesOriginal;
        saveBtn.disabled = !commentChanged && !designChanged && !cssRulesChanged;
        saveBtn.textContent = 'Save';
      } else {
        saveBtn.disabled = false;
        saveBtn.textContent = (text || hasDesignChanges) ? 'Save annotation' : 'Save as pointer';
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
        const comment = textarea.value.trim();
        const pendingChanges = buildPendingChanges();
        const cssRulesVal = cssRulesTextarea ? cssRulesTextarea.value.trim() : '';
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
          annotation.selector_preview = getElementOpenTagPreview(targetElement);
          annotation.element_context.id = targetElement.id || null;
          annotation.element_context.role = targetElement.getAttribute('role') || null;
          if (cssField) annotation.css = cssField;
          if (clickX != null) {
            const r = targetElement.getBoundingClientRect();
            annotation.badge_offset = { x: clickX - r.left, y: clickY - r.top };
          }
          await VibeAPI.saveAnnotation(annotation);
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

  return { init, dismiss };
})();
