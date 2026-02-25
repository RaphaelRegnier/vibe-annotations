// Small popover card anchored to target element
// Collapsible element details showing tag + computed CSS.
// Edit mode with pre-filled text + delete button.

var VibeAnnotationPopover = (() => {
  let currentPopover = null;
  let currentTargetHighlight = null;
  let escHandler = null;

  const ICONS = {
    close: '<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></svg>',
    trash: '<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M3 6h18"/><path d="M19 6v14c0 1-1 2-2 2H7c-1 0-2-1-2-2V6"/><path d="M8 6V4c0-1 1-2 2-2h4c1 0 2 1 2 2v2"/></svg>',
    chevron: '<svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><polyline points="9 18 15 12 9 6"/></svg>',
    warning: '<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="m21.73 18-8-14a2 2 0 0 0-3.48 0l-8 14A2 2 0 0 0 4 21h16a2 2 0 0 0 1.73-3Z"/><line x1="12" y1="9" x2="12" y2="13"/><line x1="12" y1="17" x2="12.01" y2="17"/></svg>'
  };

  const isMac = navigator.platform.toUpperCase().indexOf('MAC') >= 0;
  const kbdHint = isMac ? '\u2318\u21A9' : 'Ctrl+Enter';

  function init() {
    VibeEvents.on('inspection:elementClicked', onElementClicked);
    VibeEvents.on('annotation:edit', onEditRequested);
  }

  async function onElementClicked({ element }) {
    const context = await VibeElementContext.generate(element);
    show(element, context, null);
  }

  async function onEditRequested({ annotation, element }) {
    VibeInspectionMode.tempDisable();
    const context = await VibeElementContext.generate(element);
    show(element, context, annotation);
  }

  // --- Show popover ---

  async function show(targetElement, context, existingAnnotation) {
    dismiss();

    const root = VibeShadowHost.getRoot();
    if (!root) return;

    const isEdit = !!existingAnnotation;
    const apiStatus = await VibeAPI.checkServerStatus();
    const isOffline = !apiStatus.connected;
    const isFile = VibeAPI.isFileProtocol();

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

    popover.innerHTML = `
      <button class="vibe-element-toggle" type="button">
        ${ICONS.chevron}
        <span>&lt;${escapeHTML(context.tag)}&gt;</span>
        ${context.classes.length ? `<span style="opacity:0.5">.${escapeHTML(context.classes[0])}</span>` : ''}
      </button>
      <div class="vibe-element-props">
        <pre>${propsHTML}</pre>
      </div>
      ${warningHTML}
      <div class="vibe-popover-body">
        <div class="vibe-input-wrap">
          <textarea class="vibe-textarea" placeholder="What should change?" maxlength="1000">${isEdit ? escapeHTML(existingAnnotation.comment) : ''}</textarea>
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
    positionPopover(anchor, targetElement);

    // Wire up
    const textarea = popover.querySelector('.vibe-textarea');
    const saveBtn = popover.querySelector('.vibe-save-btn');
    const cancelBtn = popover.querySelector('.vibe-cancel-btn');
    const toggleBtn = popover.querySelector('.vibe-element-toggle');
    const propsDiv = popover.querySelector('.vibe-element-props');
    const deleteBtn = popover.querySelector('.vibe-delete-btn');

    // Collapsible element details
    toggleBtn.addEventListener('click', () => {
      toggleBtn.classList.toggle('open');
      propsDiv.classList.toggle('open');
    });

    // Enable/disable save
    const updateSave = () => {
      const text = textarea.value.trim();
      if (isEdit) {
        saveBtn.disabled = !text || text === existingAnnotation.comment || (isOffline && !isFile);
      } else {
        saveBtn.disabled = !text || (isOffline && !isFile);
      }
      if (isOffline && !isFile) {
        saveBtn.textContent = 'Offline';
      } else {
        saveBtn.textContent = isEdit ? 'Save' : 'Add';
      }
    };
    textarea.addEventListener('input', updateSave);
    updateSave();

    // Focus
    textarea.focus();
    if (isEdit) textarea.select();

    // Cancel / close
    const close = () => dismiss(true);
    cancelBtn.addEventListener('click', close);

    // Click outside
    anchor.addEventListener('mousedown', (e) => {
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
        const confirmed = await showConfirm(root, 'Delete annotation?', 'This cannot be undone.');
        if (confirmed) {
          await VibeAPI.deleteAnnotation(existingAnnotation.id);
          VibeEvents.emit('annotation:deleted', { id: existingAnnotation.id });
          dismiss(true);
        }
      });
    }

    // Save
    saveBtn.addEventListener('click', async () => {
      const comment = textarea.value.trim();
      if (!comment) return;

      if (isEdit) {
        const updates = { comment, updated_at: new Date().toISOString() };
        await VibeAPI.updateAnnotation(existingAnnotation.id, updates);
        VibeEvents.emit('annotation:updated', { id: existingAnnotation.id, comment });
      } else {
        const annotation = buildAnnotation(context, comment);
        await VibeAPI.saveAnnotation(annotation);
        VibeEvents.emit('annotation:saved', { annotation, element: targetElement });
      }

      dismiss(true);
    });
  }

  function dismiss(reEnableInspection = false) {
    if (currentPopover) { currentPopover.remove(); currentPopover = null; }
    if (currentTargetHighlight) { currentTargetHighlight.remove(); currentTargetHighlight = null; }
    if (escHandler) { document.removeEventListener('keydown', escHandler); escHandler = null; }
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
    if (pos.width != null) lines.push(propLine('size', `${Math.round(pos.width)} × ${Math.round(pos.height)}`));

    return lines.join('\n') || '<span class="prop-name">no computed styles</span>';
  }

  function propLine(name, value) {
    return `<span class="prop-name">${escapeHTML(name)}</span>: <span class="prop-val">${escapeHTML(value)}</span>`;
  }

  // --- Positioning ---

  function positionPopover(anchor, targetElement) {
    const rect = targetElement.getBoundingClientRect();
    const gap = 10;
    const popoverWidth = 340;
    const popoverHeight = 300;
    const popover = anchor.querySelector('.vibe-popover');
    if (!popover) return;

    let top, left;

    if (rect.bottom + gap + popoverHeight < window.innerHeight) {
      top = rect.bottom + gap;
    } else if (rect.top - gap - popoverHeight > 0) {
      top = rect.top - gap - popoverHeight;
    } else {
      top = Math.max(10, (window.innerHeight - popoverHeight) / 2);
    }

    left = rect.left + rect.width / 2 - popoverWidth / 2;
    left = Math.max(10, Math.min(left, window.innerWidth - popoverWidth - 10));

    popover.style.position = 'fixed';
    popover.style.top = `${top}px`;
    popover.style.left = `${left}px`;
  }

  function positionTargetHighlight(element) {
    if (!currentTargetHighlight) return;
    const rect = element.getBoundingClientRect();
    currentTargetHighlight.style.top = `${rect.top - 2}px`;
    currentTargetHighlight.style.left = `${rect.left - 2}px`;
    currentTargetHighlight.style.width = `${rect.width + 4}px`;
    currentTargetHighlight.style.height = `${rect.height + 4}px`;
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
        backdrop.remove();
        resolve(true);
      });
      backdrop.addEventListener('click', (e) => {
        if (e.target === backdrop) { backdrop.remove(); resolve(false); }
      });
    });
  }

  // --- Build annotation data ---

  function buildAnnotation(context, comment) {
    return {
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
  }

  // --- Helpers ---

  function escapeHTML(str) {
    const div = document.createElement('div');
    div.textContent = str;
    return div.innerHTML;
  }

  return { init, dismiss };
})();
