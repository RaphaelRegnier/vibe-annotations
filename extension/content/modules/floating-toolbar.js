// Floating pill toolbar — always visible, bottom-right by default
// Draggable, collapsible, position persisted to storage
// Settings dropdown with theme toggle, MCP status, clear-on-copy

var VibeToolbar = (() => {
  let toolbarEl = null;
  let settingsDropdown = null;
  let activeRecordingCleanup = null;
  let isAnnotating = false;
  let isCollapsed = false;
  let serverOnline = false;
  let annotationCount = 0;
  let styleAnnotationCount = 0;
  let clearOnCopy = false;
  let screenshotEnabled = true;
  let badgeColor = '#4b5563';
  let watcherActive = false;

  const BADGE_COLORS = ['#4b5563', '#d97757', '#3b82f6', '#22c55e', '#a855f7'];

  const isMac = navigator.platform.toUpperCase().indexOf('MAC') >= 0;
  const defaultShortcutHint = isMac ? '\u2318\u21E7,' : 'Ctrl+Shift+,';
  let shortcutHint = defaultShortcutHint;
  let customShortcut = null;

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
    power: '<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M18.36 6.64a9 9 0 1 1-12.73 0"/><line x1="12" y1="2" x2="12" y2="12"/></svg>',
    // Theme icons
    sun: '<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><circle cx="12" cy="12" r="5"/><line x1="12" y1="1" x2="12" y2="3"/><line x1="12" y1="21" x2="12" y2="23"/><line x1="4.22" y1="4.22" x2="5.64" y2="5.64"/><line x1="18.36" y1="18.36" x2="19.78" y2="19.78"/><line x1="1" y1="12" x2="3" y2="12"/><line x1="21" y1="12" x2="23" y2="12"/><line x1="4.22" y1="19.78" x2="5.64" y2="18.36"/><line x1="18.36" y1="5.64" x2="19.78" y2="4.22"/></svg>',
    moon: '<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M21 12.79A9 9 0 1 1 11.21 3 7 7 0 0 0 21 12.79z"/></svg>',
    system: '<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><rect x="2" y="3" width="20" height="14" rx="2"/><line x1="8" y1="21" x2="16" y2="21"/><line x1="12" y1="17" x2="12" y2="21"/></svg>',
    // Links
    github: '<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M9 19c-5 1.5-5-2.5-7-3m14 6v-3.87a3.37 3.37 0 0 0-.94-2.61c3.14-.35 6.44-1.54 6.44-7A5.44 5.44 0 0 0 20 4.77 5.07 5.07 0 0 0 19.91 1S18.73.65 16 2.48a13.38 13.38 0 0 0-7 0C6.27.65 5.09 1 5.09 1A5.07 5.07 0 0 0 5 4.77a5.44 5.44 0 0 0-1.5 3.78c0 5.42 3.3 6.61 6.44 7A3.37 3.37 0 0 0 9 18.13V22"/></svg>',
    server: '<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><rect x="2" y="2" width="20" height="8" rx="2"/><rect x="2" y="14" width="20" height="8" rx="2"/><line x1="6" y1="6" x2="6.01" y2="6"/><line x1="6" y1="18" x2="6.01" y2="18"/></svg>',
    camera: '<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M23 19a2 2 0 0 1-2 2H3a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h4l2-3h6l2 3h4a2 2 0 0 1 2 2z"/><circle cx="12" cy="13" r="4"/></svg>',
    keyboard: '<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><rect x="2" y="4" width="20" height="16" rx="2"/><path d="M6 8h.01M10 8h.01M14 8h.01M18 8h.01M8 12h.01M12 12h.01M16 12h.01M7 16h10"/></svg>',
    newspaper: '<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M4 22h16a2 2 0 0 0 2-2V4a2 2 0 0 0-2-2H8a2 2 0 0 0-2 2v16a2 2 0 0 1-2 2Zm0 0a2 2 0 0 1-2-2v-9c0-1.1.9-2 2-2h2"/><path d="M18 14h-8"/><path d="M15 18h-5"/><path d="M10 6h8v4h-8V6Z"/></svg>',
    palette: '<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="13.5" cy="6.5" r="0.5" fill="currentColor"/><circle cx="17.5" cy="10.5" r="0.5" fill="currentColor"/><circle cx="8.5" cy="7.5" r="0.5" fill="currentColor"/><circle cx="6.5" cy="12" r="0.5" fill="currentColor"/><path d="M12 2C6.5 2 2 6.5 2 12s4.5 10 10 10c.9 0 1.5-.7 1.5-1.5 0-.4-.1-.7-.4-1-.3-.3-.4-.7-.4-1 0-.8.7-1.5 1.5-1.5H16c3.3 0 6-2.7 6-6 0-5.5-4.5-10-10-10z"/></svg>',
    rocket: '<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M4.5 16.5c-1.5 1.26-2 5-2 5s3.74-.5 5-2c.71-.84.7-2.13-.09-2.91a2.18 2.18 0 0 0-2.91-.09z"/><path d="m12 15-3-3a22 22 0 0 1 2-3.95A12.88 12.88 0 0 1 22 2c0 2.72-.78 7.5-6 11a22.35 22.35 0 0 1-4 2z"/><path d="M9 12H4s.55-3.03 2-4c1.62-1.08 5 0 5 0"/><path d="M12 15v5s3.03-.55 4-2c1.08-1.62 0-5 0-5"/></svg>',
    back: '<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="m15 18-6-6 6-6"/></svg>',
    clipboard: '<svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><rect x="9" y="9" width="13" height="13" rx="2"/><path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1"/></svg>',
    check: '<svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><polyline points="20 6 9 17 4 12"/></svg>',
    chevronRight: '<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><polyline points="9 18 15 12 9 6"/></svg>',
    download: '<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/><polyline points="7 10 12 15 17 10"/><line x1="12" y1="15" x2="12" y2="3"/></svg>',
    upload: '<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/><polyline points="17 8 12 3 7 8"/><line x1="12" y1="3" x2="12" y2="15"/></svg>',
    users: '<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M16 21v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2"/><circle cx="9" cy="7" r="4"/><path d="M22 21v-2a4 4 0 0 0-3-3.87"/><path d="M16 3.13a4 4 0 0 1 0 7.75"/></svg>',
    webpage: '<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><rect x="3" y="3" width="18" height="18" rx="2"/><path d="M3 9h18"/><path d="M9 21V9"/></svg>',
    globe: '<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="10"/><path d="M12 2a14.5 14.5 0 0 0 0 20 14.5 14.5 0 0 0 0-20"/><path d="M2 12h20"/></svg>',
    robot: '<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><rect x="3" y="11" width="18" height="10" rx="2"/><circle cx="12" cy="5" r="2"/><path d="M12 7v4"/><line x1="8" y1="16" x2="8" y2="16"/><line x1="16" y1="16" x2="16" y2="16"/></svg>',
    book: '<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M4 19.5v-15A2.5 2.5 0 0 1 6.5 2H20v20H6.5a2.5 2.5 0 0 1 0-5H20"/></svg>',
    eye: '<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z"/><circle cx="12" cy="12" r="3"/></svg>'
  };

  const THEME_ICONS = { light: ICONS.sun, dark: ICONS.moon, system: ICONS.system };
  const THEME_CYCLE = ['light', 'dark', 'system'];

  function isLocalhost() {
    const h = window.location.hostname;
    return h === 'localhost' || h === '127.0.0.1' || h === '0.0.0.0'
      || h.endsWith('.local') || h.endsWith('.test') || h.endsWith('.localhost')
      || window.location.protocol === 'file:';
  }

  async function init() {
    const root = VibeShadowHost.getRoot();
    if (!root) return;

    isCollapsed = await VibeAPI.getToolbarCollapsed();
    clearOnCopy = await VibeAPI.getClearOnCopy();
    screenshotEnabled = await VibeAPI.getScreenshotEnabled();
    badgeColor = await VibeAPI.getBadgeColor();
    applyBadgeColor(badgeColor);
    customShortcut = await VibeAPI.getCustomShortcut();
    if (customShortcut) shortcutHint = formatShortcut(customShortcut);
    await refreshServerStatus();

    buildToolbar(root);
    await restorePosition();

    // Listen for events
    VibeEvents.on('inspection:started', () => { isAnnotating = true; updateUI(); });
    VibeEvents.on('inspection:stopped', () => { isAnnotating = false; updateUI(); });
    VibeEvents.on('badges:rendered', ({ count, total, styleCount }) => { annotationCount = count; styleAnnotationCount = styleCount || 0; updateUI(); });
    VibeEvents.on('annotations:cleared', () => { annotationCount = 0; styleAnnotationCount = 0; updateUI(); });
    VibeEvents.on('overlay:closed', resetPosition);

    // Periodic server status + watcher check
    setInterval(refreshServerStatus, 10000);
    refreshWatchers();
    setInterval(refreshWatchers, 5000);
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
        <button class="vibe-toolbar-btn vibe-tb-annotate" title="Annotate (${shortcutHint})">
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
        <div class="vibe-toolbar-drag-handle" title="Drag to move"></div>
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

    // Copy all — or stop watch mode when active
    toolbarEl.querySelector('.vibe-tb-copy').addEventListener('click', async () => {
      if (watcherActive) {
        await VibeAPI.stopWatchers();
        watcherActive = false;
        updateUI();
        VibeEvents.emit('watch:changed', { active: false });
        return;
      }
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
        styleAnnotationCount = 0;
        VibeEvents.emit('annotations:cleared', { count: annotations.length });
        await VibeAPI.deleteAnnotationsByUrl();
      }
    });

    // Delete all
    toolbarEl.querySelector('.vibe-tb-delete').addEventListener('click', async () => {
      const root = VibeShadowHost.getRoot();
      if (!root) return;

      const skip = await VibeAPI.getSkipDeleteConfirm();
      if (!skip) {
        const confirmed = await showDeleteConfirm(root);
        if (!confirmed) return;
      }

      const annotations = await VibeAPI.loadAnnotations();
      annotationCount = 0;
      styleAnnotationCount = 0;
      VibeEvents.emit('annotations:cleared', { count: annotations.length });
      await VibeAPI.deleteAnnotationsByUrl();
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
    const route = vibeLocationPath(window.location);

    settingsDropdown = document.createElement('div');
    const rect = toolbarEl.getBoundingClientRect();
    const inLowerHalf = rect.top > window.innerHeight / 2;
    settingsDropdown.className = 'vibe-settings-dropdown' + (inLowerHalf ? ' above' : '');

    settingsDropdown.innerHTML = `
      <div class="vibe-settings-header">
        <div>
          <span class="vibe-settings-title">${escapeHTML(route)}</span>
          <a href="https://github.com/RaphaelRegnier/vibe-annotations/releases/tag/v${escapeHTML(version)}" target="_blank" rel="noopener" class="vibe-settings-version">v${escapeHTML(version)}</a>
        </div>
        <div class="vibe-settings-header-right">
          <button class="vibe-theme-btn" title="${capitalize(currentTheme)} theme">
            ${themeIcon}
          </button>
        </div>
      </div>
      <div class="vibe-settings-body">
        <button class="vibe-settings-link vibe-get-started-btn" type="button">
          ${ICONS.book}
          <span>Documentation</span>
          <span style="margin-left:auto;color:var(--v-text-secondary);">${ICONS.chevronRight}</span>
        </button>
        <div class="vibe-settings-separator"></div>
        <button class="vibe-settings-link vibe-mcp-server-btn" type="button">
          ${ICONS.server}
          <span>MCP Server</span>
          <span style="margin-left:auto;display:flex;align-items:center;gap:6px;">
            <span class="vibe-status-dot ${serverOnline ? 'online' : 'offline'}"></span>
            <span style="font-size:12px;color:var(--v-text-secondary);">${serverOnline ? 'Connected' : 'Offline'}</span>
            <span style="color:var(--v-text-secondary);">${ICONS.chevronRight}</span>
          </span>
        </button>
        <div class="vibe-settings-separator"></div>
        <div class="vibe-settings-item">
          <div class="vibe-settings-item-left">
            ${ICONS.palette}
            <span>Pin color</span>
          </div>
          <div class="vibe-color-picker" style="display:flex;gap:6px;">
            ${BADGE_COLORS.map(c => `<button class="vibe-color-dot${c === badgeColor ? ' active' : ''}" data-color="${c}" style="background:${c};" type="button"></button>`).join('')}
          </div>
        </div>
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
        <div class="vibe-settings-item">
          <div class="vibe-settings-item-left">
            ${ICONS.keyboard}
            <span>Trigger hotkey</span>
          </div>
          <button class="vibe-shortcut-btn" type="button">${escapeHTML(shortcutHint)}</button>
        </div>
        <div class="vibe-settings-separator"></div>
        <button class="vibe-settings-link vibe-export-btn" type="button">
          ${ICONS.upload}
          <span>Export annotations</span>
        </button>
        <button class="vibe-settings-link vibe-import-btn" type="button">
          ${ICONS.download}
          <span>Import annotations</span>
        </button>
        <div class="vibe-settings-separator"></div>
        <button class="vibe-settings-link vibe-close-overlay" type="button">
          ${ICONS.power}
          <span>Close Vibe Annotations</span>
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

    // Shortcut key recorder
    const shortcutBtn = settingsDropdown.querySelector('.vibe-shortcut-btn');
    let recording = false;
    shortcutBtn.addEventListener('click', () => {
      if (recording) {
        // Cancel recording
        recording = false;
        shortcutBtn.textContent = shortcutHint;
        shortcutBtn.classList.remove('recording');
        return;
      }
      recording = true;
      shortcutBtn.textContent = 'Press keys\u2026';
      shortcutBtn.classList.add('recording');

      function onKey(e) {
        // Ignore lone modifier keys
        if (['Control', 'Shift', 'Alt', 'Meta'].includes(e.key)) return;
        e.preventDefault();
        e.stopPropagation();

        const sc = {
          key: e.key,
          ctrlKey: e.ctrlKey,
          metaKey: e.metaKey,
          shiftKey: e.shiftKey,
          altKey: e.altKey
        };

        customShortcut = sc;
        shortcutHint = formatShortcut(sc);
        shortcutBtn.textContent = shortcutHint;
        shortcutBtn.classList.remove('recording');
        recording = false;
        document.removeEventListener('keydown', onKey, true);
        activeRecordingCleanup = null;
        VibeAPI.saveCustomShortcut(sc);
      }

      document.addEventListener('keydown', onKey, true);
      activeRecordingCleanup = () => document.removeEventListener('keydown', onKey, true);
    });

    // Badge color picker
    settingsDropdown.querySelectorAll('.vibe-color-dot').forEach(dot => {
      dot.addEventListener('click', async () => {
        badgeColor = dot.dataset.color;
        settingsDropdown.querySelectorAll('.vibe-color-dot').forEach(d => d.classList.remove('active'));
        dot.classList.add('active');
        applyBadgeColor(badgeColor);
        await VibeAPI.saveBadgeColor(badgeColor);
      });
    });

    // MCP Server setup
    settingsDropdown.querySelector('.vibe-mcp-server-btn').addEventListener('click', () => {
      showWorkflow('mcp-setup');
    });

    // Documentation
    settingsDropdown.querySelector('.vibe-get-started-btn').addEventListener('click', () => {
      showDocumentation();
    });

    // Export
    settingsDropdown.querySelector('.vibe-export-btn').addEventListener('click', () => {
      closeSettings();
      showExportModal();
    });

    // Import
    settingsDropdown.querySelector('.vibe-import-btn').addEventListener('click', () => {
      closeSettings();
      triggerImport();
    });

    // Close overlay — strip all visual changes from page
    settingsDropdown.querySelector('.vibe-close-overlay').addEventListener('click', () => {
      closeSettings();
      VibeEvents.emit('overlay:closed');
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

  function showDocumentation() {
    if (!settingsDropdown) return;
    const header = settingsDropdown.querySelector('.vibe-settings-header');
    const body = settingsDropdown.querySelector('.vibe-settings-body');
    if (!header || !body) return;

    const version = chrome.runtime.getManifest().version;

    // Replace header with back navigation
    header.innerHTML = `
      <button class="vibe-guide-back-btn" type="button" style="display:flex;align-items:center;gap:6px;background:none;border:none;cursor:pointer;color:var(--v-text-secondary);font-family:var(--v-font);font-size:13px;padding:0;">
        ${ICONS.back}
        <span style="color:var(--v-text-primary);font-weight:600;">Documentation</span>
      </button>
    `;

    // Replace body with documentation links
    body.innerHTML = `
      <button class="vibe-settings-link vibe-get-started-guide-btn" type="button">
        ${ICONS.rocket}
        <span>Get started</span>
        <span style="margin-left:auto;color:var(--v-text-secondary);">${ICONS.chevronRight}</span>
      </button>
      <div class="vibe-settings-separator"></div>
      <button class="vibe-settings-link vibe-workflow-btn" data-workflow="single-page" type="button">
        ${ICONS.webpage}
        <span>Editing a single page</span>
        <span style="margin-left:auto;color:var(--v-text-secondary);">${ICONS.chevronRight}</span>
      </button>
      <button class="vibe-settings-link vibe-workflow-btn" data-workflow="multi-page" type="button">
        ${ICONS.globe}
        <span>Editing multiple pages</span>
        <span style="margin-left:auto;color:var(--v-text-secondary);">${ICONS.chevronRight}</span>
      </button>
      <button class="vibe-settings-link vibe-workflow-btn" data-workflow="collaborate" type="button">
        ${ICONS.users}
        <span>Collaborating</span>
        <span style="margin-left:auto;color:var(--v-text-secondary);">${ICONS.chevronRight}</span>
      </button>
      <button class="vibe-settings-link vibe-workflow-btn" data-workflow="agents" type="button">
        ${ICONS.robot}
        <span>Annotating with agents</span>
        <span style="margin-left:auto;color:var(--v-text-secondary);">${ICONS.chevronRight}</span>
      </button>
      <button class="vibe-settings-link vibe-workflow-btn" data-workflow="watch-mode" type="button">
        ${ICONS.eye}
        <span>Watch mode</span>
        <span style="margin-left:auto;color:var(--v-text-secondary);">${ICONS.chevronRight}</span>
      </button>
      <div class="vibe-settings-separator"></div>
      <a href="https://github.com/RaphaelRegnier/vibe-annotations" target="_blank" rel="noopener" class="vibe-settings-link">
        ${ICONS.github}
        <span>Contribute to Vibe Annotations</span>
      </a>
      <a href="https://github.com/RaphaelRegnier/vibe-annotations/releases/tag/v${escapeHTML(version)}" target="_blank" rel="noopener" class="vibe-settings-link">
        ${ICONS.newspaper}
        <span>Release notes</span>
      </a>
    `;

    // Back button — restores full settings
    header.querySelector('.vibe-guide-back-btn').addEventListener('click', () => {
      closeSettings();
      openSettings();
    });

    // Get started guide
    body.querySelector('.vibe-get-started-guide-btn').addEventListener('click', () => showGetStartedGuide());

    // Workflow navigation buttons
    body.querySelectorAll('.vibe-workflow-btn').forEach(btn => {
      btn.addEventListener('click', () => showWorkflow(btn.dataset.workflow));
    });
  }

  function showGetStartedGuide() {
    if (!settingsDropdown) return;
    const header = settingsDropdown.querySelector('.vibe-settings-header');
    const body = settingsDropdown.querySelector('.vibe-settings-body');
    if (!header || !body) return;

    header.innerHTML = `
      <button class="vibe-guide-back-btn" type="button" style="display:flex;align-items:center;gap:6px;background:none;border:none;cursor:pointer;color:var(--v-text-secondary);font-family:var(--v-font);font-size:13px;padding:0;">
        ${ICONS.back}
        <span style="color:var(--v-text-primary);font-weight:600;">Get started</span>
      </button>
    `;

    body.innerHTML = `
      <div class="vibe-guide">
        <div class="vibe-guide-section">
          <div class="vibe-guide-label">1. Start annotating</div>
          <p class="vibe-guide-text">Click the <strong>pencil button</strong> or your configured hotkey to enter inspection mode. Click any element to add a comment or modify its design.</p>
        </div>

        <div class="vibe-guide-section">
          <div class="vibe-guide-label">2. Send to your agent</div>
          <p class="vibe-guide-text">Hit <strong>Copy</strong> in the toolbar and paste into any AI chat, or <strong>Export</strong> to share a file. No server needed.</p>
        </div>

        <div class="vibe-guide-section">
          <div class="vibe-guide-label">3. Install MCP server <span style="font-weight:400;color:var(--v-text-secondary);">(optional)</span></div>
          <p class="vibe-guide-text">Let your coding agent fetch and resolve annotations automatically.</p>
          <div class="vibe-guide-cmd" data-cmd="npm install -g vibe-annotations-server">
            <code>npm install -g vibe-annotations-server</code>
            <button class="vibe-guide-copy" type="button">${ICONS.clipboard}</button>
          </div>
          <div class="vibe-guide-cmd" data-cmd="vibe-annotations-server start">
            <code>vibe-annotations-server start</code>
            <button class="vibe-guide-copy" type="button">${ICONS.clipboard}</button>
          </div>
          <p class="vibe-guide-text" style="margin-top:8px;">Then connect your agent:</p>
          <div class="vibe-guide-tabs">
            <button class="vibe-guide-tab active" data-tab="claude">Claude Code</button>
            <button class="vibe-guide-tab" data-tab="cursor">Cursor</button>
            <button class="vibe-guide-tab" data-tab="windsurf">Windsurf</button>
            <button class="vibe-guide-tab" data-tab="codex">Codex</button>
            <button class="vibe-guide-tab" data-tab="openclaw">OpenClaw</button>
          </div>
          <div class="vibe-guide-panel active" data-panel="claude">
            <div class="vibe-guide-cmd" data-cmd="claude mcp add --transport http vibe-annotations http://127.0.0.1:3846/mcp">
              <code>claude mcp add --transport http vibe-annotations http://127.0.0.1:3846/mcp</code>
              <button class="vibe-guide-copy" type="button">${ICONS.clipboard}</button>
            </div>
          </div>
          <div class="vibe-guide-panel" data-panel="cursor">
            <p class="vibe-guide-text">Add to <strong>.cursor/mcp.json</strong>:</p>
            <div class="vibe-guide-cmd" data-cmd='{"mcpServers":{"vibe-annotations":{"url":"http://127.0.0.1:3846/mcp"}}}'>
              <code>{"mcpServers":{"vibe-annotations":{"url":"http://127.0.0.1:3846/mcp"}}}</code>
              <button class="vibe-guide-copy" type="button">${ICONS.clipboard}</button>
            </div>
          </div>
          <div class="vibe-guide-panel" data-panel="windsurf">
            <p class="vibe-guide-text">Add to Windsurf MCP settings:</p>
            <div class="vibe-guide-cmd" data-cmd='{"mcpServers":{"vibe-annotations":{"serverUrl":"http://127.0.0.1:3846/mcp"}}}'>
              <code>{"mcpServers":{"vibe-annotations":{"serverUrl":"http://127.0.0.1:3846/mcp"}}}</code>
              <button class="vibe-guide-copy" type="button">${ICONS.clipboard}</button>
            </div>
          </div>
          <div class="vibe-guide-panel" data-panel="codex">
            <p class="vibe-guide-text">Add to <strong>~/.codex/config.toml</strong>:</p>
            <div class="vibe-guide-cmd" data-cmd="[mcp_servers.vibe-annotations]&#10;url = &quot;http://127.0.0.1:3846/mcp&quot;">
              <code>[mcp_servers.vibe-annotations] url = "..."</code>
              <button class="vibe-guide-copy" type="button">${ICONS.clipboard}</button>
            </div>
          </div>
          <div class="vibe-guide-panel" data-panel="openclaw">
            <p class="vibe-guide-text">Add to <strong>~/.openclaw/openclaw.json</strong>:</p>
            <div class="vibe-guide-cmd" data-cmd='{"mcpServers":{"vibe-annotations":{"url":"http://127.0.0.1:3846/mcp"}}}'>
              <code>{"mcpServers":{"vibe-annotations":{"url":"http://127.0.0.1:3846/mcp"}}}</code>
              <button class="vibe-guide-copy" type="button">${ICONS.clipboard}</button>
            </div>
          </div>
        </div>
      </div>
    `;

    // Back → return to Documentation
    header.querySelector('.vibe-guide-back-btn').addEventListener('click', () => showDocumentation());

    // Tab switching
    body.querySelectorAll('.vibe-guide-tab').forEach(tab => {
      tab.addEventListener('click', () => {
        body.querySelectorAll('.vibe-guide-tab').forEach(t => t.classList.remove('active'));
        body.querySelectorAll('.vibe-guide-panel').forEach(p => p.classList.remove('active'));
        tab.classList.add('active');
        body.querySelector(`[data-panel="${tab.dataset.tab}"]`).classList.add('active');
      });
    });

    // Copy buttons
    body.querySelectorAll('.vibe-guide-copy').forEach(btn => {
      btn.addEventListener('click', async () => {
        const cmd = btn.closest('.vibe-guide-cmd').dataset.cmd;
        await navigator.clipboard.writeText(cmd);
        btn.innerHTML = ICONS.check;
        setTimeout(() => { btn.innerHTML = ICONS.clipboard; }, 1500);
      });
    });
  }

  function showWorkflow(type) {
    if (!settingsDropdown) return;
    const header = settingsDropdown.querySelector('.vibe-settings-header');
    const body = settingsDropdown.querySelector('.vibe-settings-body');
    if (!header || !body) return;

    const workflows = {
      'mcp-setup': {
        title: 'MCP Server',
        content: `
          <div class="vibe-guide-section">
            <div class="vibe-guide-label">1. Install and start the server</div>
            <div class="vibe-guide-cmd" data-cmd="npm install -g vibe-annotations-server">
              <code>npm install -g vibe-annotations-server</code>
              <button class="vibe-guide-copy" type="button">${ICONS.clipboard}</button>
            </div>
            <div class="vibe-guide-cmd" data-cmd="vibe-annotations-server start">
              <code>vibe-annotations-server start</code>
              <button class="vibe-guide-copy" type="button">${ICONS.clipboard}</button>
            </div>
          </div>
          <div class="vibe-guide-section">
            <div class="vibe-guide-label">2. Connect your agent</div>
            <div class="vibe-guide-tabs">
              <button class="vibe-guide-tab active" data-tab="claude">Claude Code</button>
              <button class="vibe-guide-tab" data-tab="cursor">Cursor</button>
              <button class="vibe-guide-tab" data-tab="windsurf">Windsurf</button>
              <button class="vibe-guide-tab" data-tab="codex">Codex</button>
              <button class="vibe-guide-tab" data-tab="openclaw">OpenClaw</button>
            </div>
            <div class="vibe-guide-panel active" data-panel="claude">
              <div class="vibe-guide-cmd" data-cmd="claude mcp add --transport http vibe-annotations http://127.0.0.1:3846/mcp">
                <code>claude mcp add --transport http vibe-annotations http://127.0.0.1:3846/mcp</code>
                <button class="vibe-guide-copy" type="button">${ICONS.clipboard}</button>
              </div>
            </div>
            <div class="vibe-guide-panel" data-panel="cursor">
              <p class="vibe-guide-text">Add to <strong>.cursor/mcp.json</strong>:</p>
              <div class="vibe-guide-cmd" data-cmd='{"mcpServers":{"vibe-annotations":{"url":"http://127.0.0.1:3846/mcp"}}}'>
                <code>{"mcpServers":{"vibe-annotations":{"url":"http://127.0.0.1:3846/mcp"}}}</code>
                <button class="vibe-guide-copy" type="button">${ICONS.clipboard}</button>
              </div>
            </div>
            <div class="vibe-guide-panel" data-panel="windsurf">
              <p class="vibe-guide-text">Add to Windsurf MCP settings:</p>
              <div class="vibe-guide-cmd" data-cmd='{"mcpServers":{"vibe-annotations":{"serverUrl":"http://127.0.0.1:3846/mcp"}}}'>
                <code>{"mcpServers":{"vibe-annotations":{"serverUrl":"http://127.0.0.1:3846/mcp"}}}</code>
                <button class="vibe-guide-copy" type="button">${ICONS.clipboard}</button>
              </div>
            </div>
            <div class="vibe-guide-panel" data-panel="codex">
              <p class="vibe-guide-text">Add to <strong>~/.codex/config.toml</strong>:</p>
              <div class="vibe-guide-cmd" data-cmd="[mcp_servers.vibe-annotations]&#10;url = &quot;http://127.0.0.1:3846/mcp&quot;">
                <code>[mcp_servers.vibe-annotations] url = "..."</code>
                <button class="vibe-guide-copy" type="button">${ICONS.clipboard}</button>
              </div>
            </div>
            <div class="vibe-guide-panel" data-panel="openclaw">
              <p class="vibe-guide-text">Add to <strong>~/.openclaw/openclaw.json</strong>:</p>
              <div class="vibe-guide-cmd" data-cmd='{"mcpServers":{"vibe-annotations":{"url":"http://127.0.0.1:3846/mcp"}}}'>
                <code>{"mcpServers":{"vibe-annotations":{"url":"http://127.0.0.1:3846/mcp"}}}</code>
                <button class="vibe-guide-copy" type="button">${ICONS.clipboard}</button>
              </div>
            </div>
          </div>
          <div class="vibe-guide-section">
            <div class="vibe-guide-label">3. Watch mode <span style="font-weight:400;color:var(--v-text-secondary);">(hands-free)</span></div>
            <p class="vibe-guide-text">Your agent can automatically pick up annotations as you drop them. Just tell it:</p>
            <div class="vibe-guide-cmd" data-cmd="Start watching Vibe Annotations">
              <code>Start watching Vibe Annotations</code>
              <button class="vibe-guide-copy" type="button">${ICONS.clipboard}</button>
            </div>
            <p class="vibe-guide-text" style="margin-top:8px;">The agent calls <code>watch_annotations</code> in a loop, implements each change, and deletes the annotation when done. An eye icon appears in the toolbar and on badges while watching. Click the eye to stop.</p>
          </div>
        `
      },
      'single-page': {
        title: 'Editing a single page',
        content: `
          <div class="vibe-guide-section">
            <div class="vibe-guide-label">Best for quick edits</div>
            <p class="vibe-guide-text">For a few annotations on one page, <strong>copy & paste</strong> is the fastest option. No server, no setup.</p>
          </div>
          <div class="vibe-guide-section">
            <div class="vibe-guide-label">Workflow</div>
            <p class="vibe-guide-text">1. Annotate elements on the page (comments, CSS tweaks, text changes)</p>
            <p class="vibe-guide-text">2. Click <strong>Copy</strong> in the toolbar</p>
            <p class="vibe-guide-text">3. Paste into any AI chat (Claude, ChatGPT, Cursor...) and ask the agent to implement the changes</p>
          </div>
          <div class="vibe-guide-section">
            <div class="vibe-guide-label">Tips</div>
            <p class="vibe-guide-text">Enable <strong>Clear on copy</strong> in settings to auto-delete annotations after copying. Keeps things clean between iterations.</p>
            <p class="vibe-guide-text">Each annotation includes the selector, your comment, element context, and any pending changes. The agent gets everything it needs to locate and edit the right code.</p>
          </div>
        `
      },
      'multi-page': {
        title: 'Editing multiple pages',
        content: `
          <div class="vibe-guide-section">
            <div class="vibe-guide-label">Best for cross-page changes</div>
            <p class="vibe-guide-text">When you're annotating across multiple routes, the <strong>MCP server</strong> is preferable. Your coding agent can read and resolve annotations from all pages at once, without manual copy-paste per route.</p>
          </div>
          <div class="vibe-guide-section">
            <div class="vibe-guide-label">Setup</div>
            <div class="vibe-guide-cmd" data-cmd="npm install -g vibe-annotations-server">
              <code>npm install -g vibe-annotations-server</code>
              <button class="vibe-guide-copy" type="button">${ICONS.clipboard}</button>
            </div>
            <div class="vibe-guide-cmd" data-cmd="vibe-annotations-server start">
              <code>vibe-annotations-server start</code>
              <button class="vibe-guide-copy" type="button">${ICONS.clipboard}</button>
            </div>
            <p class="vibe-guide-text" style="margin-top:8px;">Then connect your agent (e.g. Claude Code):</p>
            <div class="vibe-guide-cmd" data-cmd="claude mcp add --transport http vibe-annotations http://127.0.0.1:3846/mcp">
              <code>claude mcp add --transport http vibe-annotations http://127.0.0.1:3846/mcp</code>
              <button class="vibe-guide-copy" type="button">${ICONS.clipboard}</button>
            </div>
          </div>
          <div class="vibe-guide-section">
            <div class="vibe-guide-label">Workflow</div>
            <p class="vibe-guide-text">1. Navigate your app and annotate elements across as many routes as needed</p>
            <p class="vibe-guide-text">2. Tell your agent: <em>"read vibe annotations and implement the changes"</em></p>
            <p class="vibe-guide-text">3. The agent pulls all pending annotations via MCP, edits your source files, and deletes each one when done</p>
          </div>
        `
      },
      collaborate: {
        title: 'Collaborating with annotations',
        content: `
          <div class="vibe-guide-section">
            <div class="vibe-guide-label">Annotations as a feedback tool</div>
            <p class="vibe-guide-text">Anyone can annotate a website: add comments, tweak styles, edit text. Then <strong>export</strong> the annotations as a .json file and share it with a teammate.</p>
          </div>
          <div class="vibe-guide-section">
            <div class="vibe-guide-label">Workflow</div>
            <p class="vibe-guide-text">1. A reviewer annotates the live site (staging, production, or localhost)</p>
            <p class="vibe-guide-text">2. They click <strong>Export</strong> and share the .json file (Slack, email, etc.)</p>
            <p class="vibe-guide-text">3. A developer clicks <strong>Import</strong> on their localhost. Annotations, badges, and style previews appear instantly.</p>
            <p class="vibe-guide-text">4. The developer copies or uses MCP to send the annotations to their coding agent</p>
          </div>
          <div class="vibe-guide-section">
            <div class="vibe-guide-label">Cross-origin remap</div>
            <p class="vibe-guide-text">Importing annotations from a public URL into localhost? The extension offers to <strong>remap URLs</strong> automatically so annotations anchor to your local dev server.</p>
          </div>
        `
      },
      'watch-mode': {
        title: 'Watch mode',
        content: `
          <div class="vibe-guide-section">
            <div class="vibe-guide-label">Hands-free annotation processing</div>
            <p class="vibe-guide-text">Your coding agent automatically picks up and implements annotations as you drop them. No copy-paste, no manual triggering. Requires the MCP server.</p>
          </div>
          <div class="vibe-guide-section">
            <div class="vibe-guide-label">Start watching</div>
            <p class="vibe-guide-text">Tell your agent:</p>
            <div class="vibe-guide-cmd" data-cmd="Start watching Vibe Annotations">
              <code>Start watching Vibe Annotations</code>
              <button class="vibe-guide-copy" type="button">${ICONS.clipboard}</button>
            </div>
            <p class="vibe-guide-text" style="margin-top:8px;">The agent calls <code>watch_annotations</code> in a loop, implements each change, and deletes the annotation when done.</p>
          </div>
          <div class="vibe-guide-section">
            <div class="vibe-guide-label">Visual feedback</div>
            <p class="vibe-guide-text">While watching, an eye icon replaces the copy button in the toolbar, and badges show eyes instead of numbers. Click the eye to stop watching.</p>
            <p class="vibe-guide-text">Auto-stops after 5 minutes of inactivity.</p>
          </div>
        `
      },
      agents: {
        title: 'Annotating with agents',
        content: `
          <div class="vibe-guide-section">
            <div class="vibe-guide-label">Let agents annotate for you</div>
            <p class="vibe-guide-text">Agents can help you annotate collaboratively, or work fully autonomously to review any site.</p>
          </div>
          <div class="vibe-guide-section">
            <div class="vibe-guide-label">Compatible agents</div>
            <p class="vibe-guide-text"><strong>Claude Chrome extension</strong> has direct page access and can call the API from its javascript tool.</p>
            <p class="vibe-guide-text"><strong>OpenClaw</strong> uses CDP evaluate to run JS on the page.</p>
            <p class="vibe-guide-text"><strong>Claude Code, Cursor, Windsurf</strong> can access the page via a DevTools MCP server or Playwright.</p>
          </div>
          <div class="vibe-guide-section">
            <div class="vibe-guide-label">Prompt to get started</div>
            <p class="vibe-guide-text">Copy this and paste it into your agent's chat to orient it towards the bridge API:</p>
            <div class="vibe-guide-cmd" data-cmd="Read window.__vibeAnnotations.help() and use this extension for my comments on this project.">
              <code>Read window.__vibeAnnotations.help() and use this extension for my comments on this project.</code>
              <button class="vibe-guide-copy" type="button">${ICONS.clipboard}</button>
            </div>
          </div>
          <div class="vibe-guide-section">
            <div class="vibe-guide-label">Requirement</div>
            <p class="vibe-guide-text">The extension must be active on the page for the bridge API to be available. This works best when the agent uses <strong>your browser</strong> (Claude Chrome, DevTools MCP), since the extension is already installed.</p>
            <p class="vibe-guide-text">Agents that launch their own browser (Playwright, Puppeteer) won't have the extension loaded by default. This can be configured by passing the extension path at launch, but requires some local setup.</p>
          </div>
          <div class="vibe-guide-section">
            <div class="vibe-guide-label">How it works</div>
            <p class="vibe-guide-text">The agent calls <code>__vibeAnnotations.help()</code> to discover the API, then uses <strong>createStyleAnnotation</strong> for broad CSS changes and <strong>createAnnotation</strong> for single-element edits. Changes preview live in the browser and get recorded as annotations for a coding agent to implement in source.</p>
          </div>
        `
      }
    };

    const wf = workflows[type];
    if (!wf) return;

    header.innerHTML = `
      <button class="vibe-guide-back-btn" type="button" style="display:flex;align-items:center;gap:6px;background:none;border:none;cursor:pointer;color:var(--v-text-secondary);font-family:var(--v-font);font-size:13px;padding:0;">
        ${ICONS.back}
        <span style="color:var(--v-text-primary);font-weight:600;">${wf.title}</span>
      </button>
    `;

    body.innerHTML = `<div class="vibe-guide">${wf.content}</div>`;

    // Back → return to Documentation
    header.querySelector('.vibe-guide-back-btn').addEventListener('click', () => showDocumentation());

    // Copy buttons (for MCP workflow)
    body.querySelectorAll('.vibe-guide-copy').forEach(btn => {
      btn.addEventListener('click', async () => {
        const cmd = btn.closest('.vibe-guide-cmd').dataset.cmd;
        await navigator.clipboard.writeText(cmd);
        btn.innerHTML = ICONS.check;
        setTimeout(() => { btn.innerHTML = ICONS.clipboard; }, 1500);
      });
    });
  }

  function closeSettings() {
    if (activeRecordingCleanup) { activeRecordingCleanup(); activeRecordingCleanup = null; }
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
        `<span class="vibe-toolbar-tip">${isAnnotating ? 'Stop' : 'Annotate'} (${shortcutHint})</span>`;
    }

    // Copy button — swaps to eye indicator when watch mode is active
    const totalCount = annotationCount + styleAnnotationCount;
    const copyBtn = toolbarEl.querySelector('.vibe-tb-copy');
    const deleteBtn = toolbarEl.querySelector('.vibe-tb-delete');
    if (copyBtn) {
      if (watcherActive) {
        copyBtn.disabled = false;
        copyBtn.classList.add('active');
        copyBtn.innerHTML = ICONS.eye + '<span class="vibe-toolbar-tip">Stop watching</span>';
        copyBtn.title = 'Click to stop watch mode';
      } else {
        copyBtn.classList.remove('active');
        copyBtn.disabled = totalCount === 0;
        copyBtn.innerHTML = ICONS.copy +
          (annotationCount > 0 ? `<span class="vibe-toolbar-count">${annotationCount}</span>` : '') +
          (styleAnnotationCount > 0 ? `<span class="vibe-toolbar-style-count">${styleAnnotationCount}</span>` : '') +
          '<span class="vibe-toolbar-tip">Copy all</span>';
        copyBtn.title = 'Copy all annotations';
      }
    }
    if (deleteBtn) deleteBtn.disabled = totalCount === 0;
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

  async function refreshWatchers() {
    if (!serverOnline) {
      if (watcherActive) {
        watcherActive = false;
        updateUI();
        VibeEvents.emit('watch:changed', { active: false });
      }
      return;
    }
    const data = await VibeAPI.getWatchers();
    const wasActive = watcherActive;
    // Only show watch mode if a watcher matches the current page's origin
    const origin = window.location.origin; // e.g. "http://localhost:3001"
    watcherActive = (data.watchers || []).some(w => {
      const base = w.url.replace('*', '').replace(/\/$/, '');
      return origin.startsWith(base) || base.startsWith(origin);
    });
    if (wasActive !== watcherActive) {
      updateUI();
      VibeEvents.emit('watch:changed', { active: watcherActive });
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

  function resetPosition() {
    if (toolbarEl) {
      toolbarEl.style.right = '';
      toolbarEl.style.top = '';
    }
    VibeAPI.saveToolbarPosition(null);
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
          <label class="vibe-confirm-skip" style="display:flex;align-items:center;gap:6px;margin:8px 0 4px;font-size:12px;color:var(--v-text-secondary,#6b7280);cursor:pointer;user-select:none;">
            <input type="checkbox" class="vibe-confirm-skip-cb" style="margin:0;">
            Don't ask again
          </label>
          <div class="vibe-confirm-actions">
            <button class="vibe-btn vibe-btn-secondary vibe-confirm-no">Cancel</button>
            <button class="vibe-btn vibe-btn-danger vibe-confirm-yes">Delete All</button>
          </div>
        </div>
      `;
      root.appendChild(backdrop);

      backdrop.querySelector('.vibe-confirm-no').addEventListener('click', () => { backdrop.remove(); resolve(false); });
      backdrop.querySelector('.vibe-confirm-yes').addEventListener('click', () => {
        const skipCb = backdrop.querySelector('.vibe-confirm-skip-cb');
        if (skipCb && skipCb.checked) {
          VibeAPI.saveSkipDeleteConfirm(true);
        }
        backdrop.remove();
        resolve(true);
      });
      backdrop.addEventListener('click', (e) => { if (e.target === backdrop) { backdrop.remove(); resolve(false); } });
    });
  }

  // --- Import / Export ---

  function showExportModal() {
    const root = VibeShadowHost.getRoot();
    if (!root) return;

    const backdrop = document.createElement('div');
    backdrop.className = 'vibe-confirm-backdrop';
    backdrop.innerHTML = `
      <div class="vibe-confirm">
        <div class="vibe-confirm-title">Export annotations</div>
        <div class="vibe-confirm-msg">Choose what to include in the export file.</div>
        <div class="vibe-export-options">
          <button class="vibe-export-option vibe-export-page" type="button">This page only</button>
          <button class="vibe-export-option vibe-export-project" type="button">All from this site</button>
        </div>
        <div class="vibe-confirm-actions" style="margin-top:12px;justify-content:flex-start;">
          <button class="vibe-btn vibe-btn-secondary vibe-export-cancel">Cancel</button>
        </div>
      </div>
    `;
    root.appendChild(backdrop);

    backdrop.querySelector('.vibe-export-cancel').addEventListener('click', () => backdrop.remove());
    backdrop.addEventListener('click', (e) => { if (e.target === backdrop) backdrop.remove(); });

    backdrop.querySelector('.vibe-export-page').addEventListener('click', async () => {
      const annotations = await VibeAPI.loadAnnotations();
      if (!annotations.length) {
        backdrop.remove();
        showInfoModal('Nothing to export', 'No annotations on this page.');
        return;
      }
      doExport(annotations, 'page');
      backdrop.remove();
    });

    backdrop.querySelector('.vibe-export-project').addEventListener('click', async () => {
      const annotations = await VibeAPI.loadProjectAnnotations();
      if (!annotations.length) {
        backdrop.remove();
        showInfoModal('Nothing to export', 'No annotations for this site.');
        return;
      }
      doExport(annotations, 'project');
      backdrop.remove();
    });
  }

  function doExport(annotations, scope) {
    const loc = window.location;
    const exportData = {
      vibe_annotations_export: true,
      version: '1.0',
      exported_at: new Date().toISOString(),
      source: {
        origin: loc.origin,
        hostname: loc.hostname,
        port: loc.port || ''
      },
      scope,
      annotations: annotations.map(a => {
        const cleaned = { ...a };
        delete cleaned.screenshot;
        return cleaned;
      })
    };

    const blob = new Blob([JSON.stringify(exportData, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);

    const dateStr = new Date().toISOString().slice(0, 10);
    const hostStr = loc.hostname + (loc.port ? '-' + loc.port : '');
    const filename = `vibe-annotations-${hostStr}-${dateStr}.json`;

    // Must append to document.body (not shadow root) for downloads to work
    const a = document.createElement('a');
    a.href = url;
    a.download = filename;
    document.body.appendChild(a);
    a.click();
    a.remove();
    URL.revokeObjectURL(url);
  }

  function triggerImport() {
    const input = document.createElement('input');
    input.type = 'file';
    input.accept = '.json';
    input.style.display = 'none';
    document.body.appendChild(input);

    input.addEventListener('change', async () => {
      const file = input.files[0];
      input.remove();
      if (!file) return;

      try {
        const text = await file.text();
        const data = JSON.parse(text);
        await processImport(data);
      } catch {
        showInfoModal('Invalid file', 'The selected file is not valid JSON.');
      }
    });

    input.click();
  }

  async function processImport(data) {
    const root = VibeShadowHost.getRoot();
    if (!root) return;

    // Validate envelope
    if (!data || data.vibe_annotations_export !== true || !Array.isArray(data.annotations)) {
      showInfoModal('Invalid format', 'This file is not a Vibe Annotations export.');
      return;
    }

    // Validate origin match — offer remap if importing public URL annotations into localhost
    const currentOrigin = window.location.origin;
    let remapFrom = null;
    if (data.source?.origin && data.source.origin !== currentOrigin) {
      if (isLocalDev()) {
        const accepted = await showRemapConfirm(root, data.source.origin, currentOrigin);
        if (!accepted) return;
        remapFrom = data.source.origin;
      } else {
        showInfoModal(
          'Origin mismatch',
          `These annotations were exported from ${data.source.origin} but you are on ${currentOrigin}. Origins must match to import.`
        );
        return;
      }
    }

    // Remap URLs if importing from a different origin
    if (remapFrom) {
      for (const a of data.annotations) {
        if (a.url) a.url = a.url.replace(remapFrom, currentOrigin);
        if (a.url_path) { /* url_path is pathname-only, no origin to remap */ }
      }
    }

    // Deduplicate against existing
    const existing = await VibeAPI.loadProjectAnnotations();
    const existingIds = new Set(existing.map(a => a.id));
    const newAnnotations = data.annotations.filter(a => !existingIds.has(a.id));
    const skipped = data.annotations.length - newAnnotations.length;

    if (newAnnotations.length === 0) {
      showInfoModal('Nothing to import', `All ${data.annotations.length} annotation${data.annotations.length !== 1 ? 's' : ''} already exist locally.`);
      return;
    }

    // Confirm
    const confirmed = await showImportConfirm(root, {
      total: data.annotations.length,
      newCount: newAnnotations.length,
      skipped
    });
    if (!confirmed) return;

    // Import via background script (handles storage lock + server sync)
    await chrome.runtime.sendMessage({ action: 'importAnnotations', annotations: newAnnotations });
    // Storage listener in content.js handles re-render automatically
  }

  function showImportConfirm(root, { total, newCount, skipped }) {
    return new Promise(resolve => {
      const backdrop = document.createElement('div');
      backdrop.className = 'vibe-confirm-backdrop';
      const skipText = skipped > 0 ? `<br>${skipped} already exist and will be skipped.` : '';
      backdrop.innerHTML = `
        <div class="vibe-confirm">
          <div class="vibe-confirm-title">Import annotations</div>
          <div class="vibe-confirm-msg">${newCount} annotation${newCount !== 1 ? 's' : ''} will be imported.${skipText}</div>
          <div class="vibe-confirm-actions">
            <button class="vibe-btn vibe-btn-secondary vibe-confirm-no">Cancel</button>
            <button class="vibe-btn vibe-btn-primary vibe-confirm-yes">Import</button>
          </div>
        </div>
      `;
      root.appendChild(backdrop);

      backdrop.querySelector('.vibe-confirm-no').addEventListener('click', () => { backdrop.remove(); resolve(false); });
      backdrop.querySelector('.vibe-confirm-yes').addEventListener('click', () => { backdrop.remove(); resolve(true); });
      backdrop.addEventListener('click', (e) => { if (e.target === backdrop) { backdrop.remove(); resolve(false); } });
    });
  }

  function isLocalDev() {
    const h = window.location.hostname;
    return h === 'localhost' || h === '127.0.0.1' || h === '0.0.0.0'
      || h.endsWith('.local') || h.endsWith('.test') || h.endsWith('.localhost');
  }

  function showRemapConfirm(root, sourceOrigin, currentOrigin) {
    return new Promise(resolve => {
      const backdrop = document.createElement('div');
      backdrop.className = 'vibe-confirm-backdrop';
      backdrop.innerHTML = `
        <div class="vibe-confirm">
          <div class="vibe-confirm-title">Remap annotations?</div>
          <div class="vibe-confirm-msg">
            These annotations were exported from <strong>${escapeHTML(sourceOrigin)}</strong>.
            Remap URLs to <strong>${escapeHTML(currentOrigin)}</strong> for local development?
          </div>
          <div style="font-size:12px;color:var(--v-text-secondary);margin-top:8px;margin-bottom:4px;line-height:1.5;">
            Important: Annotations might not perfectly anchor or apply the styling changes if the selectors aren't identical.
          </div>
          <div class="vibe-confirm-actions">
            <button class="vibe-btn vibe-btn-secondary vibe-confirm-no">Cancel</button>
            <button class="vibe-btn vibe-btn-primary vibe-confirm-yes">Remap & Import</button>
          </div>
        </div>
      `;
      root.appendChild(backdrop);

      backdrop.querySelector('.vibe-confirm-no').addEventListener('click', () => { backdrop.remove(); resolve(false); });
      backdrop.querySelector('.vibe-confirm-yes').addEventListener('click', () => { backdrop.remove(); resolve(true); });
      backdrop.addEventListener('click', (e) => { if (e.target === backdrop) { backdrop.remove(); resolve(false); } });
    });
  }

  function showInfoModal(title, message) {
    const root = VibeShadowHost.getRoot();
    if (!root) return;

    const backdrop = document.createElement('div');
    backdrop.className = 'vibe-confirm-backdrop';
    backdrop.innerHTML = `
      <div class="vibe-confirm">
        <div class="vibe-confirm-title">${escapeHTML(title)}</div>
        <div class="vibe-confirm-msg">${escapeHTML(message)}</div>
        <div class="vibe-confirm-actions">
          <button class="vibe-btn vibe-btn-secondary vibe-confirm-no">OK</button>
        </div>
      </div>
    `;
    root.appendChild(backdrop);

    backdrop.querySelector('.vibe-confirm-no').addEventListener('click', () => backdrop.remove());
    backdrop.addEventListener('click', (e) => { if (e.target === backdrop) backdrop.remove(); });
  }

  // --- Helpers ---

  function escapeHTML(str) {
    const div = document.createElement('div');
    div.textContent = str;
    return div.innerHTML;
  }

  function capitalize(s) { return s.charAt(0).toUpperCase() + s.slice(1); }

  function formatShortcut(sc) {
    const parts = [];
    if (sc.ctrlKey) parts.push(isMac ? '\u2303' : 'Ctrl');
    if (sc.metaKey) parts.push(isMac ? '\u2318' : 'Win');
    if (sc.altKey) parts.push(isMac ? '\u2325' : 'Alt');
    if (sc.shiftKey) parts.push(isMac ? '\u21E7' : 'Shift');
    // Friendly key name
    const keyMap = { ',': ',', '.': '.', '/': '/', ' ': 'Space', ArrowUp: '\u2191', ArrowDown: '\u2193', ArrowLeft: '\u2190', ArrowRight: '\u2192' };
    const keyLabel = keyMap[sc.key] || (sc.key.length === 1 ? sc.key.toUpperCase() : sc.key);
    parts.push(keyLabel);
    return isMac ? parts.join('') : parts.join('+');
  }

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
    const route = vibeLocationPath(loc);
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

      // Design changes
      const pc = a.pending_changes;
      if (pc) {
        const changes = [];
        // Text props
        if (pc.fontSize) changes.push(`font-size: ${pc.fontSize.original} \u2192 ${pc.fontSize.value}`);
        if (pc.fontWeight) changes.push(`font-weight: ${pc.fontWeight.original} \u2192 ${pc.fontWeight.value}`);
        if (pc.lineHeight) changes.push(`line-height: ${pc.lineHeight.original} \u2192 ${pc.lineHeight.value}`);
        if (pc.textAlign) changes.push(`text-align: ${pc.textAlign.original} \u2192 ${pc.textAlign.value}`);
        // Container props
        ['paddingTop','paddingRight','paddingBottom','paddingLeft','marginTop','marginRight','marginBottom','marginLeft'].filter(p => pc[p]).forEach(p => {
          changes.push(`${camelToKebab(p)}: ${pc[p].original} \u2192 ${pc[p].value}`);
        });
        if (pc.display) changes.push(`display: ${pc.display.original} \u2192 ${pc.display.value}`);
        if (pc.flexDirection) changes.push(`flex-direction: ${pc.flexDirection.original} \u2192 ${pc.flexDirection.value}`);
        if (pc.flexWrap) changes.push(`flex-wrap: ${pc.flexWrap.original} \u2192 ${pc.flexWrap.value}`);
        if (pc.justifyContent) changes.push(`justify-content: ${pc.justifyContent.original} \u2192 ${pc.justifyContent.value}`);
        if (pc.alignItems) changes.push(`align-items: ${pc.alignItems.original} \u2192 ${pc.alignItems.value}`);
        if (pc.gridTemplateColumns) changes.push(`grid-template-columns: ${pc.gridTemplateColumns.original} \u2192 ${pc.gridTemplateColumns.value}`);
        if (pc.gridTemplateRows) changes.push(`grid-template-rows: ${pc.gridTemplateRows.original} \u2192 ${pc.gridTemplateRows.value}`);
        if (pc.gap) changes.push(`gap: ${pc.gap.original} \u2192 ${pc.gap.value}`);
        if (pc.columnGap) changes.push(`column-gap: ${pc.columnGap.original} \u2192 ${pc.columnGap.value}`);
        if (pc.rowGap) changes.push(`row-gap: ${pc.rowGap.original} \u2192 ${pc.rowGap.value}`);
        if (pc.borderWidth) changes.push(`border-width: ${pc.borderWidth.original} \u2192 ${pc.borderWidth.value}`);
        if (pc.borderRadius) changes.push(`border-radius: ${pc.borderRadius.original} \u2192 ${pc.borderRadius.value}`);
        // Colors — include variable name if present
        if (pc.color) changes.push(`color: ${pc.color.original} \u2192 ${pc.color.variable ? `var(${pc.color.variable})` : pc.color.value}`);
        if (pc.backgroundColor) changes.push(`background-color: ${pc.backgroundColor.original} \u2192 ${pc.backgroundColor.variable ? `var(${pc.backgroundColor.variable})` : pc.backgroundColor.value}`);
        if (pc.borderColor) changes.push(`border-color: ${pc.borderColor.original} \u2192 ${pc.borderColor.variable ? `var(${pc.borderColor.variable})` : pc.borderColor.value}`);
        // Sizing
        if (pc.width) changes.push(`width: ${pc.width.original} \u2192 ${pc.width.value}`);
        if (pc.minWidth) changes.push(`min-width: ${pc.minWidth.original} \u2192 ${pc.minWidth.value}`);
        if (pc.maxWidth) changes.push(`max-width: ${pc.maxWidth.original} \u2192 ${pc.maxWidth.value}`);
        if (pc.height) changes.push(`height: ${pc.height.original} \u2192 ${pc.height.value}`);
        if (pc.minHeight) changes.push(`min-height: ${pc.minHeight.original} \u2192 ${pc.minHeight.value}`);
        if (pc.maxHeight) changes.push(`max-height: ${pc.maxHeight.original} \u2192 ${pc.maxHeight.value}`);
        // Catch extra raw CSS changes not covered above
        const standardProps = new Set(['fontSize','fontWeight','lineHeight','textAlign','paddingTop','paddingRight','paddingBottom','paddingLeft','marginTop','marginRight','marginBottom','marginLeft','display','flexDirection','flexWrap','justifyContent','alignItems','gridTemplateColumns','gridTemplateRows','gap','columnGap','rowGap','borderWidth','borderRadius','borderStyle','color','backgroundColor','borderColor','width','minWidth','maxWidth','height','minHeight','maxHeight']);
        for (const [prop, change] of Object.entries(pc)) {
          if (!standardProps.has(prop) && change.original && change.value) {
            changes.push(`${camelToKebab(prop)}: ${change.original} \u2192 ${change.value}`);
          }
        }
        if (changes.length) {
          lines.push(`   Design changes: ${changes.join(', ')}`);
        }
      }

      // CSS rules (pseudo-elements, :hover, @media, etc.)
      if (a.css) {
        lines.push(`   CSS rules:\n${a.css.split('\n').map(l => '      ' + l).join('\n')}`);
      }

      return lines.join('\n');
    });

    return header + '\n\nFollow my instructions on these elements.\nWhen applying design changes, map values to the project design system (Tailwind classes, CSS variables, or design tokens).\n\n---\n\n' + blocks.join('\n\n');
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

  function applyBadgeColor(color) {
    const root = VibeShadowHost.getRoot();
    if (root) root.host.style.setProperty('--v-badge-bg', color);
  }

  function camelToKebab(str) {
    return str.replace(/[A-Z]/g, m => '-' + m.toLowerCase());
  }

  function truncate(str, max) {
    const clean = str.replace(/\s+/g, ' ').trim();
    if (clean.length <= max) return clean;
    return clean.substring(0, max) + '\u2026';
  }

  return { init };
})();
