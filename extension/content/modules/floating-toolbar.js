// Floating pill toolbar — always visible, bottom-right by default
// Draggable, collapsible, position persisted to storage
// Settings dropdown with theme toggle, MCP status, clear-on-copy

var VibeToolbar = (() => {
  let toolbarEl = null;
  let settingsDropdown = null;
  let isAnnotating = false;
  let isCollapsed = false;
  let serverOnline = false;
  let annotationCount = 0;
  let clearOnCopy = false;
  let screenshotEnabled = true;

  const ICONS = {
    annotate: '<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M17 3a2.85 2.83 0 1 1 4 4L7.5 20.5 2 22l1.5-5.5Z"/></svg>',
    stop: '<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><rect x="6" y="6" width="12" height="12" rx="1"/></svg>',
    copy: '<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><rect x="9" y="9" width="13" height="13" rx="2"/><path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1"/></svg>',
    trash: '<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M3 6h18"/><path d="M19 6v14c0 1-1 2-2 2H7c-1 0-2-1-2-2V6"/><path d="M8 6V4c0-1 1-2 2-2h4c1 0 2 1 2 2v2"/></svg>',
    settings: '<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="3"/><path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 0 1 0 2.83 2 2 0 0 1-2.83 0l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 0 1-2 2 2 2 0 0 1-2-2v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 0 1-2.83 0 2 2 0 0 1 0-2.83l.06-.06A1.65 1.65 0 0 0 4.68 15a1.65 1.65 0 0 0-1.51-1H3a2 2 0 0 1-2-2 2 2 0 0 1 2-2h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 0 1 0-2.83 2 2 0 0 1 2.83 0l.06.06A1.65 1.65 0 0 0 9 4.68a1.65 1.65 0 0 0 1-1.51V3a2 2 0 0 1 2-2 2 2 0 0 1 2 2v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 0 1 2.83 0 2 2 0 0 1 0 2.83l-.06.06A1.65 1.65 0 0 0 19.4 9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 0 1 2 2 2 2 0 0 1-2 2h-.09a1.65 1.65 0 0 0-1.51 1z"/></svg>',
    collapse: '<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><polyline points="9 18 15 12 9 6"/></svg>',
    // Vibe logo — actual icon (set dynamically in buildToolbar)
    logo: '',
    eyeOff: '<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M17.94 17.94A10.07 10.07 0 0 1 12 20c-7 0-11-8-11-8a18.45 18.45 0 0 1 5.06-5.94"/><path d="M9.9 4.24A9.12 9.12 0 0 1 12 4c7 0 11 8 11 8a18.5 18.5 0 0 1-2.16 3.19"/><path d="M1 1l22 22"/><path d="M14.12 14.12a3 3 0 1 1-4.24-4.24"/></svg>',
    // Theme icons
    sun: '<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><circle cx="12" cy="12" r="5"/><line x1="12" y1="1" x2="12" y2="3"/><line x1="12" y1="21" x2="12" y2="23"/><line x1="4.22" y1="4.22" x2="5.64" y2="5.64"/><line x1="18.36" y1="18.36" x2="19.78" y2="19.78"/><line x1="1" y1="12" x2="3" y2="12"/><line x1="21" y1="12" x2="23" y2="12"/><line x1="4.22" y1="19.78" x2="5.64" y2="18.36"/><line x1="18.36" y1="5.64" x2="19.78" y2="4.22"/></svg>',
    moon: '<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M21 12.79A9 9 0 1 1 11.21 3 7 7 0 0 0 21 12.79z"/></svg>',
    system: '<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><rect x="2" y="3" width="20" height="14" rx="2"/><line x1="8" y1="21" x2="16" y2="21"/><line x1="12" y1="17" x2="12" y2="21"/></svg>',
    // Links
    github: '<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M9 19c-5 1.5-5-2.5-7-3m14 6v-3.87a3.37 3.37 0 0 0-.94-2.61c3.14-.35 6.44-1.54 6.44-7A5.44 5.44 0 0 0 20 4.77 5.07 5.07 0 0 0 19.91 1S18.73.65 16 2.48a13.38 13.38 0 0 0-7 0C6.27.65 5.09 1 5.09 1A5.07 5.07 0 0 0 5 4.77a5.44 5.44 0 0 0-1.5 3.78c0 5.42 3.3 6.61 6.44 7A3.37 3.37 0 0 0 9 18.13V22"/></svg>',
    server: '<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><rect x="2" y="2" width="20" height="8" rx="2"/><rect x="2" y="14" width="20" height="8" rx="2"/><line x1="6" y1="6" x2="6.01" y2="6"/><line x1="6" y1="18" x2="6.01" y2="18"/></svg>',
    camera: '<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M23 19a2 2 0 0 1-2 2H3a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h4l2-3h6l2 3h4a2 2 0 0 1 2 2z"/><circle cx="12" cy="13" r="4"/></svg>',
    newspaper: '<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M4 22h16a2 2 0 0 0 2-2V4a2 2 0 0 0-2-2H8a2 2 0 0 0-2 2v16a2 2 0 0 1-2 2Zm0 0a2 2 0 0 1-2-2v-9c0-1.1.9-2 2-2h2"/><path d="M18 14h-8"/><path d="M15 18h-5"/><path d="M10 6h8v4h-8V6Z"/></svg>'
  };

  const THEME_ICONS = { light: ICONS.sun, dark: ICONS.moon, system: ICONS.system };
  const THEME_CYCLE = ['light', 'dark', 'system'];

  async function init() {
    const root = VibeShadowHost.getRoot();
    if (!root) return;

    isCollapsed = await VibeAPI.getToolbarCollapsed();
    clearOnCopy = await VibeAPI.getClearOnCopy();
    screenshotEnabled = await VibeAPI.getScreenshotEnabled();
    await refreshServerStatus();

    buildToolbar(root);
    await restorePosition();

    // Listen for events
    VibeEvents.on('inspection:started', () => { isAnnotating = true; updateUI(); });
    VibeEvents.on('inspection:stopped', () => { isAnnotating = false; updateUI(); });
    VibeEvents.on('badges:rendered', ({ total }) => { annotationCount = total; updateUI(); });
    VibeEvents.on('annotations:cleared', () => { annotationCount = 0; updateUI(); });

    // Periodic server status check
    setInterval(refreshServerStatus, 10000);
  }

  function buildToolbar(root) {
    const logoUrl = chrome.runtime.getURL('assets/icons/icon-hq.png');
    ICONS.logo = `<img src="${logoUrl}" style="pointer-events:none;">`;

    toolbarEl = document.createElement('div');
    toolbarEl.className = 'vibe-toolbar' + (isCollapsed ? ' collapsed' : '');

    toolbarEl.innerHTML = `
      <button class="vibe-toolbar-btn vibe-tb-collapse" title="${isCollapsed ? 'Expand' : 'Collapse'}">
        ${isCollapsed ? ICONS.logo : ICONS.collapse}
        <span class="vibe-toolbar-tip">${isCollapsed ? 'Expand' : 'Collapse'}</span>
      </button>
      <div class="vibe-toolbar-inner">
        <div class="vibe-toolbar-divider"></div>
        <button class="vibe-toolbar-btn vibe-tb-annotate" title="Annotate">
          ${ICONS.annotate}
          <span class="vibe-toolbar-tip">Annotate</span>
        </button>
        <button class="vibe-toolbar-btn vibe-tb-copy" title="Copy all annotations" disabled>
          ${ICONS.copy}
          <span class="vibe-toolbar-tip">Copy all</span>
        </button>
        <button class="vibe-toolbar-btn vibe-tb-delete" title="Delete all annotations" disabled>
          ${ICONS.trash}
          <span class="vibe-toolbar-tip">Delete all</span>
        </button>
        <div class="vibe-toolbar-drag-handle" title="Move">
          <span class="vibe-toolbar-tip">Move</span>
        </div>
        <button class="vibe-toolbar-btn vibe-tb-settings" title="Settings">
          ${ICONS.settings}
          <span class="vibe-toolbar-tip">Settings</span>
        </button>
      </div>
    `;

    root.appendChild(toolbarEl);
    wireButtons();
    setupDrag();
    updateUI();
  }

  function wireButtons() {
    // Collapse/expand
    toolbarEl.querySelector('.vibe-tb-collapse').addEventListener('click', toggleCollapse);

    // Annotate toggle
    toolbarEl.querySelector('.vibe-tb-annotate').addEventListener('click', () => {
      if (isAnnotating) {
        VibeEvents.emit('inspection:stop');
      } else {
        VibeEvents.emit('inspection:start');
      }
    });

    // Copy all
    toolbarEl.querySelector('.vibe-tb-copy').addEventListener('click', async () => {
      const annotations = await VibeAPI.loadAnnotations();
      if (!annotations.length) return;
      const text = formatAnnotationsForClipboard(annotations);
      try {
        await navigator.clipboard.writeText(text);
        showCopyFeedback();
      } catch {
        const ta = document.createElement('textarea');
        ta.value = text;
        document.body.appendChild(ta);
        ta.select();
        document.execCommand('copy');
        ta.remove();
        showCopyFeedback();
      }

      // Clear on copy if setting is enabled
      if (clearOnCopy) {
        // Reset count immediately so UI stays consistent
        annotationCount = 0;
        VibeEvents.emit('annotations:cleared', { count: annotations.length });
        for (const a of annotations) {
          await VibeAPI.deleteAnnotation(a.id);
        }
      }
    });

    // Delete all
    toolbarEl.querySelector('.vibe-tb-delete').addEventListener('click', async () => {
      const root = VibeShadowHost.getRoot();
      if (!root) return;

      const confirmed = await showDeleteConfirm(root);
      if (!confirmed) return;

      const annotations = await VibeAPI.loadAnnotations();
      annotationCount = 0;
      VibeEvents.emit('annotations:cleared', { count: annotations.length });
      for (const a of annotations) {
        await VibeAPI.deleteAnnotation(a.id);
      }
    });

    // Settings
    toolbarEl.querySelector('.vibe-tb-settings').addEventListener('click', (e) => {
      e.stopPropagation();
      toggleSettings();
    });
  }

  // --- Settings dropdown ---

  function toggleSettings() {
    if (settingsDropdown) {
      closeSettings();
    } else {
      openSettings();
    }
  }

  function openSettings() {
    closeSettings();

    const version = chrome.runtime.getManifest().version;
    const currentTheme = VibeThemeManager.getPreference();
    const themeIcon = THEME_ICONS[currentTheme] || THEME_ICONS.system;
    const route = window.location.pathname;

    settingsDropdown = document.createElement('div');
    const rect = toolbarEl.getBoundingClientRect();
    const inLowerHalf = rect.top > window.innerHeight / 2;
    settingsDropdown.className = 'vibe-settings-dropdown' + (inLowerHalf ? ' above' : '');

    settingsDropdown.innerHTML = `
      <div class="vibe-settings-header">
        <div>
          <span class="vibe-settings-title">${escapeHTML(route)}</span>
          <span class="vibe-settings-version">v${escapeHTML(version)}</span>
        </div>
        <div class="vibe-settings-header-right">
          <button class="vibe-theme-btn" title="${capitalize(currentTheme)} theme">
            ${themeIcon}
          </button>
        </div>
      </div>
      <div class="vibe-settings-body">
        <div class="vibe-settings-item">
          <div class="vibe-settings-item-left">
            ${ICONS.server}
            <span>MCP Server</span>
          </div>
          <div style="display:flex;align-items:center;gap:6px;">
            <span class="vibe-status-dot ${serverOnline ? 'online' : 'offline'}"></span>
            <span style="font-size:12px;color:var(--v-text-secondary);">${serverOnline ? 'Connected' : 'Offline'}</span>
          </div>
        </div>
        <div class="vibe-settings-separator"></div>
        <div class="vibe-settings-item">
          <div class="vibe-settings-item-left">
            ${ICONS.copy}
            <span>Clear after copy</span>
          </div>
          <button class="vibe-toggle vibe-clear-on-copy-toggle ${clearOnCopy ? 'on' : ''}" type="button"></button>
        </div>
        <div class="vibe-settings-item">
          <div class="vibe-settings-item-left">
            ${ICONS.camera}
            <div>
              <span>Screenshots</span>
              <div style="font-size:11px;color:var(--v-text-secondary);margin-top:1px;">Only used via MCP server, not clipboard</div>
            </div>
          </div>
          <button class="vibe-toggle vibe-screenshot-toggle ${screenshotEnabled ? 'on' : ''}" type="button"></button>
        </div>
        <div class="vibe-settings-separator"></div>
        <a href="https://github.com/RaphaelRegnier/vibe-annotations" target="_blank" rel="noopener" class="vibe-settings-link">
          ${ICONS.github}
          <span>Documentation</span>
        </a>
        <a href="https://github.com/RaphaelRegnier/vibe-annotations/releases/tag/v${escapeHTML(version)}" target="_blank" rel="noopener" class="vibe-settings-link">
          ${ICONS.newspaper}
          <span>Release notes</span>
        </a>
        <div class="vibe-settings-separator"></div>
        <button class="vibe-settings-link vibe-close-overlay" type="button">
          ${ICONS.eyeOff}
          <span>Hide Vibe Annotations</span>
          <span style="margin-left:auto;font-size:11px;opacity:0.5;">or click ext. icon</span>
        </button>
      </div>
    `;

    toolbarEl.appendChild(settingsDropdown);

    // Theme toggle
    settingsDropdown.querySelector('.vibe-theme-btn').addEventListener('click', () => {
      const current = VibeThemeManager.getPreference();
      const idx = THEME_CYCLE.indexOf(current);
      const next = THEME_CYCLE[(idx + 1) % THEME_CYCLE.length];
      VibeThemeManager.setPreference(next);

      // Update icon
      const btn = settingsDropdown.querySelector('.vibe-theme-btn');
      btn.innerHTML = THEME_ICONS[next];
      btn.title = `${capitalize(next)} theme`;
    });

    // Clear on copy toggle
    settingsDropdown.querySelector('.vibe-clear-on-copy-toggle').addEventListener('click', async (e) => {
      clearOnCopy = !clearOnCopy;
      e.currentTarget.classList.toggle('on', clearOnCopy);
      await VibeAPI.saveClearOnCopy(clearOnCopy);
    });

    // Screenshot toggle
    settingsDropdown.querySelector('.vibe-screenshot-toggle').addEventListener('click', async (e) => {
      screenshotEnabled = !screenshotEnabled;
      e.currentTarget.classList.toggle('on', screenshotEnabled);
      await VibeAPI.saveScreenshotEnabled(screenshotEnabled);
    });

    // Close overlay
    settingsDropdown.querySelector('.vibe-close-overlay').addEventListener('click', () => {
      closeSettings();
      VibeShadowHost.hide();
    });

    // Prevent clicks inside dropdown from triggering outside-click close
    settingsDropdown.addEventListener('click', (e) => {
      e.stopPropagation();
    });

    // Close on outside click (next tick to avoid immediate close)
    setTimeout(() => {
      document.addEventListener('click', onOutsideClick);
    }, 0);
  }

  function closeSettings() {
    if (settingsDropdown) {
      settingsDropdown.remove();
      settingsDropdown = null;
    }
    document.removeEventListener('click', onOutsideClick);
  }

  function onOutsideClick(e) {
    if (settingsDropdown && !settingsDropdown.contains(e.target) && !e.target.closest('.vibe-tb-settings')) {
      closeSettings();
    }
  }

  function toggleCollapse() {
    isCollapsed = !isCollapsed;
    toolbarEl.classList.toggle('collapsed', isCollapsed);
    closeSettings();

    const btn = toolbarEl.querySelector('.vibe-tb-collapse');
    btn.innerHTML = (isCollapsed ? ICONS.logo : ICONS.collapse) +
      `<span class="vibe-toolbar-tip">${isCollapsed ? 'Expand' : 'Collapse'}</span>`;
    btn.title = isCollapsed ? 'Expand' : 'Collapse';

    VibeAPI.saveToolbarCollapsed(isCollapsed);
  }

  function updateUI() {
    if (!toolbarEl) return;

    // Annotate button active state
    const annotateBtn = toolbarEl.querySelector('.vibe-tb-annotate');
    if (annotateBtn) {
      annotateBtn.classList.toggle('active', isAnnotating);
      annotateBtn.innerHTML = (isAnnotating ? ICONS.stop : ICONS.annotate) +
        `<span class="vibe-toolbar-tip">${isAnnotating ? 'Stop' : 'Annotate'}</span>`;
    }

    // Enable/disable copy + delete, badge on copy
    const copyBtn = toolbarEl.querySelector('.vibe-tb-copy');
    const deleteBtn = toolbarEl.querySelector('.vibe-tb-delete');
    if (copyBtn) {
      copyBtn.disabled = annotationCount === 0;
      copyBtn.innerHTML = ICONS.copy +
        (annotationCount > 0 ? `<span class="vibe-toolbar-count">${annotationCount}</span>` : '') +
        '<span class="vibe-toolbar-tip">Copy all</span>';
    }
    if (deleteBtn) deleteBtn.disabled = annotationCount === 0;
  }

  async function refreshServerStatus() {
    const status = await VibeAPI.checkServerStatus();
    const changed = serverOnline !== status.connected;
    serverOnline = status.connected;
    if (changed) {
      updateUI();
      // Update settings dropdown if open
      if (settingsDropdown) {
        const dot = settingsDropdown.querySelector('.vibe-status-dot');
        if (dot) dot.className = `vibe-status-dot ${serverOnline ? 'online' : 'offline'}`;
      }
    }
  }

  function showCopyFeedback() {
    const btn = toolbarEl.querySelector('.vibe-tb-copy');
    if (!btn) return;
    btn.innerHTML = '<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="#10b981" stroke-width="2.5"><polyline points="20 6 9 17 4 12"/></svg>';
    setTimeout(() => { updateUI(); }, 1200);
  }

  // --- Drag ---

  function setupDrag() {
    let isDragging = false;
    let didDrag = false;
    let startX, startY, startLeft, startTop;
    const DRAG_THRESHOLD = 4;

    toolbarEl.addEventListener('mousedown', (e) => {
      if (e.target.closest('.vibe-toolbar-btn') && !e.target.closest('.vibe-tb-collapse')) return;

      isDragging = true;
      didDrag = false;
      toolbarEl.classList.add('dragging');
      const rect = toolbarEl.getBoundingClientRect();
      startX = e.clientX;
      startY = e.clientY;
      startLeft = rect.left;
      startTop = rect.top;

      e.preventDefault();
    });

    document.addEventListener('mousemove', (e) => {
      if (!isDragging) return;
      const dx = e.clientX - startX;
      const dy = e.clientY - startY;

      if (!didDrag && (Math.abs(dx) > DRAG_THRESHOLD || Math.abs(dy) > DRAG_THRESHOLD)) {
        didDrag = true;
      }

      const newRight = window.innerWidth - (startLeft + toolbarEl.offsetWidth) - dx;
      const newTop = startTop + dy;

      const clampedRight = Math.max(8, Math.min(newRight, window.innerWidth - toolbarEl.offsetWidth - 8));
      const clampedTop = Math.max(8, Math.min(newTop, window.innerHeight - toolbarEl.offsetHeight - 8));

      toolbarEl.style.right = `${clampedRight}px`;
      toolbarEl.style.top = `${clampedTop}px`;
    });

    document.addEventListener('mouseup', () => {
      if (!isDragging) return;
      isDragging = false;
      toolbarEl.classList.remove('dragging');

      if (didDrag) {
        VibeAPI.saveToolbarPosition({
          right: toolbarEl.style.right,
          top: toolbarEl.style.top
        });
      }
    });

    // Suppress click on collapse button if it was actually a drag
    toolbarEl.querySelector('.vibe-tb-collapse').addEventListener('click', (e) => {
      if (didDrag) {
        e.stopImmediatePropagation();
        didDrag = false;
      }
    }, true);
  }

  async function restorePosition() {
    const pos = await VibeAPI.getToolbarPosition();
    if (pos && toolbarEl) {
      toolbarEl.style.right = pos.right;
      toolbarEl.style.top = pos.top;
    }
  }

  // --- Delete confirm ---

  function showDeleteConfirm(root) {
    return new Promise(resolve => {
      const backdrop = document.createElement('div');
      backdrop.className = 'vibe-confirm-backdrop';
      backdrop.innerHTML = `
        <div class="vibe-confirm">
          <div class="vibe-confirm-title">Delete all annotations?</div>
          <div class="vibe-confirm-msg">All annotations on this page will be permanently deleted.</div>
          <div class="vibe-confirm-actions">
            <button class="vibe-btn vibe-btn-secondary vibe-confirm-no">Cancel</button>
            <button class="vibe-btn vibe-btn-danger vibe-confirm-yes">Delete All</button>
          </div>
        </div>
      `;
      root.appendChild(backdrop);

      backdrop.querySelector('.vibe-confirm-no').addEventListener('click', () => { backdrop.remove(); resolve(false); });
      backdrop.querySelector('.vibe-confirm-yes').addEventListener('click', () => { backdrop.remove(); resolve(true); });
      backdrop.addEventListener('click', (e) => { if (e.target === backdrop) { backdrop.remove(); resolve(false); } });
    });
  }

  // --- Helpers ---

  function escapeHTML(str) {
    const div = document.createElement('div');
    div.textContent = str;
    return div.innerHTML;
  }

  function capitalize(s) { return s.charAt(0).toUpperCase() + s.slice(1); }

  // --- Clipboard format ---

  const TRIVIAL_STYLES = {
    display: 'block',
    position: 'static',
    fontSize: '16px',
    color: 'rgb(0, 0, 0)',
    backgroundColor: 'rgba(0, 0, 0, 0)',
    margin: '0px',
    padding: '0px'
  };

  function formatAnnotationsForClipboard(annotations) {
    const loc = window.location;
    const route = loc.pathname;
    const host = loc.host;
    const vp = annotations[0]?.viewport;
    const vpStr = vp ? `${vp.width}\u00D7${vp.height}` : '';
    const count = annotations.length;

    let header = `# Vibe Annotations \u2014 ${route}`;
    header += `\n${host}`;
    if (vpStr) header += ` \u00B7 ${vpStr}`;
    header += ` \u00B7 ${count} annotation${count !== 1 ? 's' : ''}`;

    const blocks = annotations.map((a, i) => {
      const ec = a.element_context || {};
      const tag = ec.tag ? `<${ec.tag}>` : '';
      const text = ec.text ? truncate(ec.text, 40) : '';
      const identity = [tag, text ? `"${text}"` : ''].filter(Boolean).join(' ');

      const lines = [];
      lines.push(`${i + 1}. ${identity}`);
      lines.push(`   Comment: ${a.comment}`);
      lines.push(`   Selector: ${a.selector}`);

      // Styles — only non-trivial
      const styleStr = formatStyles(ec.styles);
      if (styleStr) lines.push(`   Styles: ${styleStr}`);

      // Size from position
      const pos = ec.position;
      if (pos && pos.width && pos.height) {
        lines.push(`   Size: ${Math.round(pos.width)}\u00D7${Math.round(pos.height)}`);
      }

      // Source file
      if (a.source_file_path) {
        let src = a.source_file_path;
        if (a.source_line_range) src += ` (lines ${a.source_line_range})`;
        lines.push(`   Source: ${src}`);
      }

      // Context hints
      if (a.context_hints && a.context_hints.length) {
        lines.push(`   Hints: ${a.context_hints.join(' \u00B7 ')}`);
      }

      return lines.join('\n');
    });

    return header + '\n\n---\n\n' + blocks.join('\n\n');
  }

  function formatStyles(styles) {
    if (!styles) return '';
    const STYLE_KEYS = {
      display: 'display',
      fontSize: 'font-size',
      color: 'color',
      backgroundColor: 'background-color',
      padding: 'padding',
      margin: 'margin',
      position: 'position'
    };
    const parts = [];
    for (const [key, cssName] of Object.entries(STYLE_KEYS)) {
      const val = styles[key];
      if (!val) continue;
      if (TRIVIAL_STYLES[key] === val) continue;
      parts.push(`${cssName}:${val}`);
    }
    return parts.join(' \u00B7 ');
  }

  function truncate(str, max) {
    const clean = str.replace(/\s+/g, ' ').trim();
    if (clean.length <= max) return clean;
    return clean.substring(0, max) + '\u2026';
  }

  return { init };
})();
