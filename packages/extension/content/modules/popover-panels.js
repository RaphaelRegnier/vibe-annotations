// Design panel builders, wirers, and shared controls for the annotation popover.
// Extracted from annotation-popover.js to keep each module focused.

var VibePopoverPanels = (() => {

  // --- Constants ---

  const ALL_DESIGN_PROPS = [
    'fontSize','fontWeight','lineHeight','textAlign',
    'paddingTop','paddingRight','paddingBottom','paddingLeft',
    'marginTop','marginRight','marginBottom','marginLeft',
    'display','flexDirection','flexWrap','gap','columnGap','rowGap','justifyContent','alignItems',
    'gridTemplateColumns','gridTemplateRows',
    'borderWidth','borderRadius','borderStyle',
    'width','minWidth','maxWidth','height','minHeight','maxHeight',
    'color','backgroundColor','borderColor'
  ];

  const TEXT_ELEMENTS = new Set([
    'p','h1','h2','h3','h4','h5','h6','span','a','label',
    'li','td','th','dt','dd','figcaption','legend','summary',
    'blockquote','q','cite','em','strong','small','b','i','u',
    'mark','code','pre','abbr','time','caption'
  ]);
  const BOTH_ELEMENTS = new Set(['button']);

  const BLOCK_DISPLAYS = new Set([
    'block','flex','inline-flex','grid','inline-grid','table','list-item'
  ]);

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
    marginTop:     { step: 1, shiftStep: 10, min: -999, max: 999, unit: 'px' },
    marginRight:   { step: 1, shiftStep: 10, min: -999, max: 999, unit: 'px' },
    marginBottom:  { step: 1, shiftStep: 10, min: -999, max: 999, unit: 'px' },
    marginLeft:    { step: 1, shiftStep: 10, min: -999, max: 999, unit: 'px' },
    gap:           { step: 1, shiftStep: 10, min: 0, max: 999, unit: 'px' },
    borderWidth:   { step: 1, shiftStep: 1,  min: 0, max: 20,  unit: 'px' },
    borderRadius:  { step: 1, shiftStep: 10, min: 0, max: 999, unit: 'px' },
  };

  const SIZING_PROPS = ['width','minWidth','maxWidth','height','minHeight','maxHeight'];
  const SIZING_UNSET = { width: 'auto', minWidth: '0px', maxWidth: 'none', height: 'auto', minHeight: '0px', maxHeight: 'none' };

  const ICONS = {
    close: '<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></svg>',
    trash: '<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M3 6h18"/><path d="M19 6v14c0 1-1 2-2 2H7c-1 0-2-1-2-2V6"/><path d="M8 6V4c0-1 1-2 2-2h4c1 0 2 1 2 2v2"/></svg>',
    chevron: '<svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><polyline points="9 18 15 12 9 6"/></svg>',
    warning: '<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="m21.73 18-8-14a2 2 0 0 0-3.48 0l-8 14A2 2 0 0 0 4 21h16a2 2 0 0 0 1.73-3Z"/><line x1="12" y1="9" x2="12" y2="13"/><line x1="12" y1="17" x2="12.01" y2="17"/></svg>',
    reset: '<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M3 12a9 9 0 1 0 9-9 9.75 9.75 0 0 0-6.74 2.74L3 8"/><path d="M3 3v5h5"/></svg>',
    typeSize: '<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><polyline points="4 7 4 4 20 4 20 7"/><line x1="12" y1="4" x2="12" y2="20"/><line x1="8" y1="20" x2="16" y2="20"/></svg>',
    typeWeight: '<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><path d="M6 4h8a4 4 0 0 1 4 4 4 4 0 0 1-4 4H6z"/><path d="M6 12h9a4 4 0 0 1 4 4 4 4 0 0 1-4 4H6z"/></svg>',
    typeLeading: '<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><polyline points="8 18 12 22 16 18"/><polyline points="8 6 12 2 16 6"/><line x1="12" y1="2" x2="12" y2="22"/></svg>',
    alignLeft: '<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"><line x1="3" y1="6" x2="21" y2="6"/><line x1="3" y1="12" x2="15" y2="12"/><line x1="3" y1="18" x2="18" y2="18"/></svg>',
    alignCenter: '<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"><line x1="3" y1="6" x2="21" y2="6"/><line x1="6" y1="12" x2="18" y2="12"/><line x1="4" y1="18" x2="20" y2="18"/></svg>',
    alignRight: '<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"><line x1="3" y1="6" x2="21" y2="6"/><line x1="9" y1="12" x2="21" y2="12"/><line x1="6" y1="18" x2="21" y2="18"/></svg>',
    paddingV: '<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"><line x1="12" y1="3" x2="12" y2="21"/><polyline points="8 7 12 3 16 7"/><polyline points="8 17 12 21 16 17"/></svg>',
    paddingH: '<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"><line x1="3" y1="12" x2="21" y2="12"/><polyline points="7 8 3 12 7 16"/><polyline points="17 8 21 12 17 16"/></svg>',
    split: '<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"><rect x="3" y="3" width="18" height="18" rx="2"/><line x1="12" y1="3" x2="12" y2="21"/><line x1="3" y1="12" x2="21" y2="12"/></svg>',
    merge: '<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"><rect x="3" y="3" width="18" height="18" rx="2"/></svg>',
    displayBlock: '<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round"><rect x="4" y="6" width="16" height="12" rx="2"/></svg>',
    displayVFlex: '<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round"><rect x="4" y="3" width="16" height="7" rx="1.5"/><rect x="4" y="14" width="16" height="7" rx="1.5"/></svg>',
    displayHFlex: '<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round"><rect x="3" y="4" width="7" height="16" rx="1.5"/><rect x="14" y="4" width="7" height="16" rx="1.5"/></svg>',
    displayGrid: '<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round"><rect x="3" y="3" width="7" height="7" rx="1.5"/><rect x="14" y="3" width="7" height="7" rx="1.5"/><rect x="3" y="14" width="7" height="7" rx="1.5"/><rect x="14" y="14" width="7" height="7" rx="1.5"/></svg>',
    marginV: '<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"><rect x="6" y="6" width="12" height="12" rx="1" stroke-dasharray="3 2"/><line x1="12" y1="2" x2="12" y2="6"/><line x1="12" y1="18" x2="12" y2="22"/></svg>',
    marginH: '<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"><rect x="6" y="6" width="12" height="12" rx="1" stroke-dasharray="3 2"/><line x1="2" y1="12" x2="6" y2="12"/><line x1="18" y1="12" x2="22" y2="12"/></svg>',
    gapV: '<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"><line x1="3" y1="7" x2="21" y2="7"/><line x1="6" y1="12" x2="18" y2="12"/><line x1="3" y1="17" x2="21" y2="17"/></svg>',
    gapH: '<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"><line x1="7" y1="3" x2="7" y2="21"/><line x1="12" y1="6" x2="12" y2="18"/><line x1="17" y1="3" x2="17" y2="21"/></svg>',
    borderW: '<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="3" stroke-linecap="round"><line x1="3" y1="12" x2="21" y2="12"/></svg>',
    borderR: '<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"><path d="M3 9V5a2 2 0 0 1 2-2h4"/><path d="M3 15v4a2 2 0 0 0 2 2h4"/><path d="M15 3h4a2 2 0 0 1 2 2v4"/><path d="M15 21h4a2 2 0 0 0 2-2v-4"/></svg>',
    textContent: '<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M17 6.1H3"/><path d="M21 12.1H3"/><path d="M15.1 18H3"/></svg>',
    droplet: '<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M12 22a7 7 0 0 0 7-7c0-2-1-3.9-3-5.5s-3.5-4-4-6.5c-.5 2.5-2 4.9-4 6.5C6 11.1 5 13 5 15a7 7 0 0 0 7 7z"/></svg>',
    phone: '<svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><rect x="5" y="2" width="14" height="20" rx="2" ry="2"/><line x1="12" y1="18" x2="12.01" y2="18"/></svg>',
    tablet: '<svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><rect x="4" y="2" width="16" height="20" rx="2" ry="2"/><line x1="12" y1="18" x2="12.01" y2="18"/></svg>',
    monitor: '<svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><rect x="2" y="3" width="20" height="14" rx="2" ry="2"/><line x1="8" y1="21" x2="16" y2="21"/><line x1="12" y1="17" x2="12" y2="21"/></svg>'
  };

  const isMac = navigator.platform.toUpperCase().indexOf('MAC') >= 0;
  const kbdHint = isMac ? '\u2318\u21A9' : 'Ctrl+Enter';

  // Raw CSS properties to show — expanded computed styles
  const RAW_CSS_PROPS = [
    { css: 'display', js: 'display' },
    { css: 'position', js: 'position', skip: v => v === 'static' },
    { css: 'font-size', js: 'fontSize' },
    { css: 'font-weight', js: 'fontWeight' },
    { css: 'line-height', js: 'lineHeight' },
    { css: 'text-align', js: 'textAlign' },
    { css: 'color', js: 'color' },
    { css: 'background-color', js: 'backgroundColor', skip: v => v === 'rgba(0, 0, 0, 0)' },
    { css: 'padding-top', js: 'paddingTop' },
    { css: 'padding-right', js: 'paddingRight' },
    { css: 'padding-bottom', js: 'paddingBottom' },
    { css: 'padding-left', js: 'paddingLeft' },
    { css: 'margin-top', js: 'marginTop' },
    { css: 'margin-right', js: 'marginRight' },
    { css: 'margin-bottom', js: 'marginBottom' },
    { css: 'margin-left', js: 'marginLeft' },
    { css: 'gap', js: 'gap', skip: v => v === 'normal' || v === '0px' },
    { css: 'flex-direction', js: 'flexDirection', skip: (v, s) => s.display !== 'flex' && s.display !== 'inline-flex' },
    { css: 'flex-wrap', js: 'flexWrap', skip: (v, s) => s.display !== 'flex' && s.display !== 'inline-flex' },
    { css: 'justify-content', js: 'justifyContent', skip: (v, s) => s.display !== 'flex' && s.display !== 'inline-flex' },
    { css: 'align-items', js: 'alignItems', skip: (v, s) => s.display !== 'flex' && s.display !== 'inline-flex' },
    { css: 'grid-template-columns', js: 'gridTemplateColumns', skip: (v, s) => s.display !== 'grid' },
    { css: 'grid-template-rows', js: 'gridTemplateRows', skip: (v, s) => s.display !== 'grid' },
    { css: 'border-width', js: 'borderTopWidth' },
    { css: 'border-radius', js: 'borderRadius' },
    { css: 'border-style', js: 'borderStyle', skip: v => v === 'none' },
    { css: 'border-color', js: 'borderColor', skip: (v, s) => s.borderStyle === 'none' },
    { css: 'width', js: 'width' },
    { css: 'min-width', js: 'minWidth', skip: v => v === '0px' },
    { css: 'max-width', js: 'maxWidth', skip: v => v === 'none' },
    { css: 'height', js: 'height' },
    { css: 'min-height', js: 'minHeight', skip: v => v === '0px' },
    { css: 'max-height', js: 'maxHeight', skip: v => v === 'none' }
  ];

  // Flex alignment constants
  const JUSTIFY_3 = ['flex-start', 'center', 'flex-end'];
  const ALIGN_3 = ['flex-start', 'center', 'flex-end'];
  const ALIGN_WORDS = { 'flex-start': ['top','left'], 'start': ['top','left'], 'center': ['center','center'], 'flex-end': ['bottom','right'], 'end': ['bottom','right'], 'stretch': ['top','left'], 'normal': ['top','left'], 'space-between': ['top','left'], 'space-around': ['center','center'], 'space-evenly': ['center','center'] };

  // --- Element classification ---

  function classifyElement(el) {
    const tag = typeof el === 'string' ? el : el.tagName.toLowerCase();
    if (BOTH_ELEMENTS.has(tag)) return 'both';
    if (TEXT_ELEMENTS.has(tag)) return 'text';
    if (typeof el !== 'string' && isTextLike(el)) return 'text';
    return 'container';
  }

  function isTextLike(el) {
    let hasDirectText = false;
    for (const node of el.childNodes) {
      if (node.nodeType === Node.TEXT_NODE && node.textContent.trim()) {
        hasDirectText = true;
        break;
      }
    }
    if (!hasDirectText) return false;
    for (const child of el.children) {
      const d = getComputedStyle(child).display;
      if (BLOCK_DISPLAYS.has(d)) return false;
    }
    return true;
  }

  function getTabsForType(elType) {
    if (elType === 'text') return [
      { key: 'content', label: 'Content' },
      { key: 'font', label: 'Font' },
      { key: 'sizing', label: 'Sizing' },
      { key: 'spacing', label: 'Spacing' },
      { key: 'raw-css', label: 'CSS' }
    ];
    if (elType === 'container') return [
      { key: 'sizing', label: 'Sizing' },
      { key: 'spacing', label: 'Spacing' },
      { key: 'layout', label: 'Layout' },
      { key: 'appearance', label: 'Appearance' },
      { key: 'raw-css', label: 'CSS' }
    ];
    return [
      { key: 'content', label: 'Content' },
      { key: 'font', label: 'Font' },
      { key: 'sizing', label: 'Sizing' },
      { key: 'spacing', label: 'Spacing' },
      { key: 'layout', label: 'Layout' },
      { key: 'appearance', label: 'Appearance' },
      { key: 'raw-css', label: 'CSS' }
    ];
  }

  // --- Utility functions ---

  function escapeHTML(str) {
    const div = document.createElement('div');
    div.textContent = str;
    return div.innerHTML;
  }

  function toHex(color) {
    if (!color) return '#000000';
    if (/^#[0-9a-fA-F]{3,8}$/.test(color)) return color;
    try {
      const ctx = document.createElement('canvas').getContext('2d');
      ctx.fillStyle = color;
      return ctx.fillStyle;
    } catch {
      return '#000000';
    }
  }

  function kebabToCamel(str) {
    return str.replace(/-([a-z])/g, (_, c) => c.toUpperCase());
  }

  function normalizeTextAlign(val) {
    if (val === 'start') return 'left';
    if (val === 'end') return 'right';
    return val || 'left';
  }

  function normalizeDisplay(val) {
    if (val === 'flex' || val === 'inline-flex') return 'flex';
    if (val === 'grid' || val === 'inline-grid') return 'grid';
    return 'block';
  }

  function parsePaddingInput(val) {
    const parts = val.split(',').map(s => parseFloat(s.trim())).filter(n => !isNaN(n));
    if (parts.length === 0) return null;
    if (parts.length === 1) return { a: parts[0], b: parts[0] };
    return { a: parts[0], b: parts[1] };
  }

  function parseGridCount(val) {
    if (!val || val === 'none' || val === 'auto') return 1;
    const repeatMatch = val.match(/repeat\(\s*(\d+)/);
    if (repeatMatch) return parseInt(repeatMatch[1]);
    const tracks = val.trim().split(/\s+/).filter(t => t.length > 0);
    return Math.max(1, tracks.length);
  }

  function gridCountToTemplate(n) {
    n = Math.max(1, Math.min(24, n));
    return n === 1 ? '1fr' : `repeat(${n}, 1fr)`;
  }

  function formatSizingVal(val, prop) {
    if (!val || val === SIZING_UNSET[prop]) return '';
    return val;
  }

  function getDeviceIcon(width) {
    if (width <= 480) return ICONS.phone;
    if (width <= 1024) return ICONS.tablet;
    return ICONS.monitor;
  }

  function getInputVal(popover, prop) {
    return parseFloat(popover.querySelector(`[data-prop="${prop}"]`)?.value) || 0;
  }

  function setInputVal(popover, prop, val) {
    const el = popover.querySelector(`[data-prop="${prop}"]`);
    if (el) el.value = val;
  }

  // --- Display mode helpers ---

  function detectDisplayMode(display, flexDir) {
    const d = normalizeDisplay(display);
    if (d === 'grid') return 'grid';
    if (d === 'flex') return (flexDir === 'column' || flexDir === 'column-reverse') ? 'vflex' : 'hflex';
    return 'block';
  }

  function isReversedDir(flexDir) {
    return flexDir === 'row-reverse' || flexDir === 'column-reverse';
  }

  function alignMiniDots(jc, ai, isVert) {
    const posMap = { 'flex-start': 0, 'start': 0, 'center': 1, 'flex-end': 2, 'end': 2 };
    const activeCol = isVert ? (posMap[ai] ?? 0) : (posMap[jc] ?? 0);
    const activeRow = isVert ? (posMap[jc] ?? 0) : (posMap[ai] ?? 0);
    let dots = '';
    for (let r = 0; r < 3; r++) {
      for (let c = 0; c < 3; c++) {
        const isActive = r === activeRow && c === activeCol;
        const cx = 4 + c * 5;
        const cy = 4 + r * 5;
        dots += `<circle cx="${cx}" cy="${cy}" r="1.4" fill="${isActive ? 'var(--v-accent)' : 'currentColor'}" opacity="${isActive ? '1' : '0.35'}"/>`;
      }
    }
    return `<svg width="14" height="14" viewBox="0 0 18 18" class="vibe-align-dots">${dots}</svg>`;
  }

  function alignLabel(jc, ai, isVert) {
    const vEntry = ALIGN_WORDS[isVert ? jc : ai] || ['top','left'];
    const hEntry = ALIGN_WORDS[isVert ? ai : jc] || ['left','left'];
    const vWord = vEntry[0];
    const hWord = hEntry[1];
    let pos;
    if (vWord === 'center' && hWord === 'center') pos = 'center';
    else if (vWord === 'center') pos = hWord;
    else if (hWord === 'center') pos = vWord;
    else pos = vWord + ' ' + hWord;
    return 'Align ' + pos;
  }

  // --- Raw CSS content builder ---

  function buildRawCssContent(context) {
    const s = window.getComputedStyle(context._element || document.body);
    const lines = [];
    for (const prop of RAW_CSS_PROPS) {
      const val = s[prop.js];
      if (prop.skip && prop.skip(val, s)) continue;
      lines.push(`${prop.css}: ${val};`);
    }
    const pos = context.position || {};
    if (pos.width != null) {
      lines.push(`width: ${Math.round(pos.width)}px;`);
      lines.push(`height: ${Math.round(pos.height)}px;`);
    }
    return lines.join('\n');
  }

  // --- Content (text edit) panel ---

  function buildContentToolbarHTML(targetElement, pc) {
    const currentText = pc?.copyChange ? pc.copyChange.value : targetElement.textContent;
    return `
      <div class="vibe-design-row vibe-content-row">
        <span class="vibe-design-icon vibe-content-icon" title="Text content">${ICONS.textContent}</span>
        <textarea class="vibe-content-input" spellcheck="false">${escapeHTML(currentText)}</textarea>
      </div>`;
  }

  function autoResizeContentInput(el) {
    el.style.height = 'auto';
    el.style.height = el.scrollHeight + 'px';
  }

  function wireContentToolbar(popover, targetElement, pc, resetBtn) {
    const origText = pc?.copyChange ? pc.copyChange.original : targetElement.textContent;
    const input = popover.querySelector('.vibe-content-input');
    if (!input) return () => null;

    input.addEventListener('focus', () => input.select());

    input.addEventListener('input', () => {
      targetElement.textContent = input.value;
      autoResizeContentInput(input);
      popover._updateResetVisibility?.();
      popover._updateSave?.();
    });

    resetBtn.addEventListener('click', () => {
      input.value = origText;
      targetElement.textContent = origText;
      autoResizeContentInput(input);
    });

    return function buildPendingChanges() {
      const cur = input.value;
      if (cur !== origText) {
        return { copyChange: { original: origText, value: cur } };
      }
      return null;
    };
  }

  // --- Text (font) panel ---

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

    return {
      font: `
        <div class="vibe-design-row">
          <span class="vibe-design-icon" title="Font size">${ICONS.typeSize}</span>
          <div class="vibe-stepper">
            <input class="vibe-stepper-input" data-prop="fontSize" type="number" min="1" max="999" value="${Math.round(curFS)}">
            <span class="vibe-stepper-unit">px</span>
          </div>
          <div class="vibe-prop-spacer"></div>
          <span class="vibe-design-icon" title="Font weight">${ICONS.typeWeight}</span>
          <div class="vibe-stepper">
            <input class="vibe-stepper-input" data-prop="fontWeight" type="number" min="100" max="900" step="100" value="${Math.round(curFW)}">
          </div>
          <div class="vibe-prop-spacer"></div>
          <span class="vibe-design-icon" title="Line height">${ICONS.typeLeading}</span>
          <div class="vibe-stepper">
            <input class="vibe-stepper-input" data-prop="lineHeight" type="number" min="1" max="999" value="${Math.round(curLH)}">
            <span class="vibe-stepper-unit">px</span>
          </div>
        </div>
        <div class="vibe-design-row">
          <span class="vibe-design-icon" title="Text color">${ICONS.droplet}</span>
          <button class="vibe-color-swatch" data-color-prop="color" type="button" style="background:${curColorHex}"></button>
          <input class="vibe-color-input vibe-color-input-inline" data-color-prop="color" type="text" value="${curColorHex}" placeholder="#000000">
          <div class="vibe-prop-spacer"></div>
          <div class="vibe-align-group">
            <button class="vibe-align-btn ${curTA === 'left' ? 'active' : ''}" data-align="left" type="button" title="Align left">${ICONS.alignLeft}</button>
            <button class="vibe-align-btn ${curTA === 'center' ? 'active' : ''}" data-align="center" type="button" title="Align center">${ICONS.alignCenter}</button>
            <button class="vibe-align-btn ${curTA === 'right' ? 'active' : ''}" data-align="right" type="button" title="Align right">${ICONS.alignRight}</button>
          </div>
        </div>`
    };
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

    const colorState = { color: { orig: origColor, value: pc?.color?.value || origColor, variable: pc?.color?.variable || null } };

    wireStepperInputs(popover, targetElement, PROP_CONFIG);

    alignBtns.forEach(btn => {
      btn.addEventListener('click', () => {
        currentTextAlign = btn.dataset.align;
        targetElement.style.textAlign = currentTextAlign;
        alignBtns.forEach(b => b.classList.toggle('active', b.dataset.align === currentTextAlign));
        popover._updateResetVisibility?.();
        popover._updateSave?.();
      });
    });

    wireColorPicker(popover, targetElement, colorState, 'color');

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
      if (colorState.color.value !== colorState.color.orig) {
        const entry = { original: colorState.color.orig, value: colorState.color.value };
        if (colorState.color.variable) entry.variable = colorState.color.variable;
        changes.color = entry;
      }
      return Object.keys(changes).length ? changes : null;
    };
  }

  // --- Container (layout/appearance) panel ---

  function buildContainerToolbarHTML(pc, s) {
    const curDisplayRaw = normalizeDisplay(pc?.display ? pc.display.value : s.display);
    const curFlexDir = pc?.flexDirection ? pc.flexDirection.value : (s.flexDirection || 'row');
    const mode = detectDisplayMode(curDisplayRaw, curFlexDir);
    const reversed = isReversedDir(curFlexDir);
    const curFlexWrap = pc?.flexWrap ? pc.flexWrap.value : (s.flexWrap || 'nowrap');
    const isWrapped = curFlexWrap === 'wrap' || curFlexWrap === 'wrap-reverse';

    const origGap = pc?.gap ? parseFloat(pc.gap.original) : (parseFloat(s.gap) || 0);
    const curGap = pc?.gap ? parseFloat(pc.gap.value) : origGap;

    const curJC = pc?.justifyContent ? pc.justifyContent.value : (s.justifyContent || 'flex-start');
    const curAI = pc?.alignItems ? pc.alignItems.value : (s.alignItems || 'stretch');

    const curGTC = pc?.gridTemplateColumns ? pc.gridTemplateColumns.value : (s.gridTemplateColumns || '1fr');
    const curGTR = pc?.gridTemplateRows ? pc.gridTemplateRows.value : (s.gridTemplateRows || 'auto');

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

    const isFlex = mode === 'vflex' || mode === 'hflex';
    const isGrid = mode === 'grid';

    const gridCols = parseGridCount(curGTC);
    const gridRows = parseGridCount(curGTR);

    const curColGap = pc?.columnGap ? parseFloat(pc.columnGap.value) : (parseFloat(s.columnGap) || curGap);
    const curRowGap = pc?.rowGap ? parseFloat(pc.rowGap.value) : (parseFloat(s.rowGap) || curGap);

    const isVert = mode === 'vflex';
    let matrixHTML = '';
    for (let row = 0; row < 3; row++) {
      for (let col = 0; col < 3; col++) {
        const jc = isVert ? JUSTIFY_3[row] : JUSTIFY_3[col];
        const ai = isVert ? ALIGN_3[col] : ALIGN_3[row];
        const isActive = curJC === jc && curAI === ai;
        const label = alignLabel(jc, ai, isVert);
        matrixHTML += `<button class="vibe-matrix-cell ${isActive ? 'active' : ''}" data-jc="${jc}" data-ai="${ai}" type="button" title="${label}"><span class="vibe-matrix-dot"></span></button>`;
      }
    }
    return {
      layout: `
        <div class="vibe-design-row">
          <div class="vibe-toggle-group vibe-flow-group">
            <button class="vibe-toggle-btn ${mode === 'block' ? 'active' : ''}" data-mode="block" type="button" title="Block">${ICONS.displayBlock}</button>
            <button class="vibe-toggle-btn ${mode === 'vflex' ? 'active' : ''}" data-mode="vflex" type="button" title="Vertical flex">${ICONS.displayVFlex}</button>
            <button class="vibe-toggle-btn ${mode === 'hflex' ? 'active' : ''}" data-mode="hflex" type="button" title="Horizontal flex">${ICONS.displayHFlex}</button>
            <button class="vibe-toggle-btn ${mode === 'grid' ? 'active' : ''}" data-mode="grid" type="button" title="CSS Grid">${ICONS.displayGrid}</button>
          </div>
        </div>
        <div class="vibe-flex-options" ${isFlex ? '' : 'style="display:none"'}>
          <div class="vibe-layout-split">
            <div class="vibe-layout-left">
              <div class="vibe-align-matrix" data-direction="${mode}">${matrixHTML}</div>
            </div>
            <div class="vibe-layout-right">
              <label class="vibe-check-label">
                <input type="checkbox" class="vibe-reverse-check" ${reversed ? 'checked' : ''}>
                <span>Reverse order</span>
              </label>
              <label class="vibe-check-label">
                <input type="checkbox" class="vibe-wrap-check" ${isWrapped ? 'checked' : ''}>
                <span>Wrap items</span>
              </label>
            </div>
          </div>
          <div class="vibe-layout-split vibe-gap-row">
            <div class="vibe-layout-left">
              <div class="vibe-design-row vibe-gap-input-row ${curJC === 'space-between' ? 'disabled' : ''}">
                <span class="vibe-gap-label">Gap space</span>
                <div class="vibe-stepper vibe-stepper-grow">
                  <input class="vibe-stepper-input" data-prop="gap" type="number" min="0" max="999" value="${Math.round(curGap)}" ${curJC === 'space-between' ? 'disabled' : ''}>
                  <span class="vibe-stepper-unit">px</span>
                </div>
              </div>
            </div>
            <div class="vibe-layout-right">
              <label class="vibe-check-label">
                <input type="checkbox" class="vibe-space-auto-check" ${curJC === 'space-between' ? 'checked' : ''}>
                <span>Space auto</span>
              </label>
            </div>
          </div>
        </div>
        <div class="vibe-grid-options" ${isGrid ? '' : 'style="display:none"'}>
          <div class="vibe-design-row">
            <span class="vibe-design-icon-label vibe-design-icon-label-wide" title="Columns">Cols</span>
            <div class="vibe-stepper vibe-stepper-sm">
              <input class="vibe-stepper-input vibe-grid-cols" type="number" min="1" max="24" value="${gridCols}">
            </div>
            <div class="vibe-prop-spacer"></div>
            <span class="vibe-design-icon" title="Column gap">${ICONS.gapH}</span>
            <div class="vibe-stepper vibe-stepper-sm">
              <input class="vibe-stepper-input vibe-grid-col-gap" type="number" min="0" max="999" value="${Math.round(curColGap)}">
              <span class="vibe-stepper-unit">px</span>
            </div>
          </div>
          <div class="vibe-design-row">
            <span class="vibe-design-icon-label vibe-design-icon-label-wide" title="Rows">Rows</span>
            <div class="vibe-stepper vibe-stepper-sm">
              <input class="vibe-stepper-input vibe-grid-rows" type="number" min="1" max="24" value="${gridRows}">
            </div>
            <div class="vibe-prop-spacer"></div>
            <span class="vibe-design-icon" title="Row gap">${ICONS.gapV}</span>
            <div class="vibe-stepper vibe-stepper-sm">
              <input class="vibe-stepper-input vibe-grid-row-gap" type="number" min="0" max="999" value="${Math.round(curRowGap)}">
              <span class="vibe-stepper-unit">px</span>
            </div>
          </div>
        </div>`,
      border: `
        <div class="vibe-section-header"><span class="vibe-section-label">Border</span></div>
        <div class="vibe-design-row">
          <span class="vibe-design-icon" title="Border radius">${ICONS.borderR}</span>
          <div class="vibe-stepper vibe-stepper-sm">
            <input class="vibe-stepper-input" data-prop="borderRadius" type="number" min="0" max="999" value="${Math.round(curBR)}">
            <span class="vibe-stepper-unit">px</span>
          </div>
          <div class="vibe-prop-spacer"></div>
          <span class="vibe-design-icon" title="Border width">${ICONS.borderW}</span>
          <div class="vibe-stepper vibe-stepper-sm">
            <input class="vibe-stepper-input" data-prop="borderWidth" type="number" min="0" max="20" value="${Math.round(curBW)}">
            <span class="vibe-stepper-unit">px</span>
          </div>
          <div class="vibe-prop-spacer"></div>
          <span class="vibe-design-icon" title="Border color">${ICONS.droplet}</span>
          <button class="vibe-color-swatch" data-color-prop="borderColor" type="button" style="background:${curBorderHex}"></button>
          <input class="vibe-color-input" data-color-prop="borderColor" type="text" value="${curBorderHex}" placeholder="#000000">
        </div>`,
      colorRows: `
        <div class="vibe-section-header"><span class="vibe-section-label">Background</span></div>
        <div class="vibe-design-row vibe-color-row">
          <span class="vibe-design-icon" title="Background">${ICONS.droplet}</span>
          <button class="vibe-color-swatch" data-color-prop="backgroundColor" type="button" style="background:${curBgHex}"></button>
          <input class="vibe-color-input" data-color-prop="backgroundColor" type="text" value="${curBgHex}" placeholder="#000000">
        </div>`
    };
  }

  function wireContainerToolbar(popover, targetElement, pc, s, resetBtn) {
    const origDisplayRaw = normalizeDisplay(pc?.display ? pc.display.original : s.display);
    const origFlexDir = pc?.flexDirection ? pc.flexDirection.original : (s.flexDirection || 'row');
    const origGap = pc?.gap ? parseFloat(pc.gap.original) : (parseFloat(s.gap) || 0);
    const origJC = pc?.justifyContent ? pc.justifyContent.original : (s.justifyContent || 'flex-start');
    const origAI = pc?.alignItems ? pc.alignItems.original : (s.alignItems || 'stretch');
    const origFlexWrap = pc?.flexWrap ? pc.flexWrap.original : (s.flexWrap || 'nowrap');
    const origGTC = pc?.gridTemplateColumns ? pc.gridTemplateColumns.original : (s.gridTemplateColumns || 'none');
    const origGTR = pc?.gridTemplateRows ? pc.gridTemplateRows.original : (s.gridTemplateRows || 'none');
    const origBW = pc?.borderWidth ? parseFloat(pc.borderWidth.original) : (parseFloat(s.borderTopWidth) || 0);
    const origBR = pc?.borderRadius ? parseFloat(pc.borderRadius.original) : (parseFloat(s.borderRadius) || 0);
    const origBS = pc?.borderStyle ? pc.borderStyle.original : (s.borderStyle || 'none');
    const origBgColor = pc?.backgroundColor ? pc.backgroundColor.original : (s.backgroundColor || 'rgba(0,0,0,0)');
    const origBorderColor = pc?.borderColor ? pc.borderColor.original : (s.borderColor || 'rgb(0,0,0)');
    const origMode = detectDisplayMode(origDisplayRaw, origFlexDir);

    const PROP_CONFIG = {
      gap: { ...CONTAINER_PROP_CONFIG.gap, orig: origGap },
      borderWidth: { ...CONTAINER_PROP_CONFIG.borderWidth, orig: origBW },
      borderRadius: { ...CONTAINER_PROP_CONFIG.borderRadius, orig: origBR }
    };

    const initFlexDir = pc?.flexDirection ? pc.flexDirection.value : origFlexDir;
    let currentMode = detectDisplayMode(
      normalizeDisplay(pc?.display ? pc.display.value : s.display),
      initFlexDir
    );
    let currentReversed = isReversedDir(initFlexDir);
    let currentJC = pc?.justifyContent ? pc.justifyContent.value : origJC;
    let currentAI = pc?.alignItems ? pc.alignItems.value : origAI;
    let currentFlexWrap = pc?.flexWrap ? pc.flexWrap.value : (s.flexWrap || 'nowrap');
    let currentGTC = pc?.gridTemplateColumns ? pc.gridTemplateColumns.value : (s.gridTemplateColumns || '1fr');
    let currentGTR = pc?.gridTemplateRows ? pc.gridTemplateRows.value : (s.gridTemplateRows || 'auto');

    const colorState = {
      backgroundColor: { orig: origBgColor, value: pc?.backgroundColor?.value || origBgColor, variable: pc?.backgroundColor?.variable || null },
      borderColor: { orig: origBorderColor, value: pc?.borderColor?.value || origBorderColor, variable: pc?.borderColor?.variable || null }
    };

    const notify = () => { popover._updateResetVisibility?.(); popover._updateSave?.(); };

    wireStepperInputs(popover, targetElement, PROP_CONFIG);

    const modeBtns = popover.querySelectorAll('[data-mode]');
    const flexOptions = popover.querySelector('.vibe-flex-options');
    const gridOptions = popover.querySelector('.vibe-grid-options');

    function getFlexDir(mode, rev) {
      if (mode === 'vflex') return rev ? 'column-reverse' : 'column';
      if (mode === 'hflex') return rev ? 'row-reverse' : 'row';
      return '';
    }

    function applyMode(mode) {
      currentMode = mode;
      modeBtns.forEach(b => b.classList.toggle('active', b.dataset.mode === mode));

      if (mode === 'block') {
        targetElement.style.display = 'block';
        targetElement.style.flexDirection = '';
        targetElement.style.flexWrap = '';
        targetElement.style.justifyContent = '';
        targetElement.style.alignItems = '';
        targetElement.style.gridTemplateColumns = '';
        targetElement.style.gridTemplateRows = '';
      } else if (mode === 'vflex' || mode === 'hflex') {
        targetElement.style.display = 'flex';
        targetElement.style.flexDirection = getFlexDir(mode, currentReversed);
        targetElement.style.flexWrap = currentFlexWrap;
        targetElement.style.justifyContent = currentJC;
        targetElement.style.alignItems = currentAI;
        targetElement.style.gridTemplateColumns = '';
        targetElement.style.gridTemplateRows = '';
      } else if (mode === 'grid') {
        targetElement.style.display = 'grid';
        targetElement.style.flexDirection = '';
        targetElement.style.flexWrap = '';
        targetElement.style.justifyContent = '';
        targetElement.style.alignItems = '';
        targetElement.style.gridTemplateColumns = currentGTC;
        targetElement.style.gridTemplateRows = currentGTR;
      }

      flexOptions.style.display = (mode === 'vflex' || mode === 'hflex') ? '' : 'none';
      gridOptions.style.display = mode === 'grid' ? '' : 'none';
      notify();
    }

    modeBtns.forEach(btn => {
      btn.addEventListener('click', () => {
        applyMode(btn.dataset.mode);
        rebuildMatrix(btn.dataset.mode);
      });
    });

    const matrixContainer = popover.querySelector('.vibe-align-matrix');

    function rebuildMatrix(newMode) {
      if (!matrixContainer) return;
      const isVert = newMode === 'vflex';
      matrixContainer.dataset.direction = newMode;
      let html = '';
      for (let row = 0; row < 3; row++) {
        for (let col = 0; col < 3; col++) {
          const jc = isVert ? JUSTIFY_3[row] : JUSTIFY_3[col];
          const ai = isVert ? ALIGN_3[col] : ALIGN_3[row];
          const isActive = currentJC === jc && currentAI === ai;
          const label = alignLabel(jc, ai, isVert);
          html += `<button class="vibe-matrix-cell ${isActive ? 'active' : ''}" data-jc="${jc}" data-ai="${ai}" type="button" title="${label}"><span class="vibe-matrix-dot"></span></button>`;
        }
      }
      matrixContainer.innerHTML = html;
      wireMatrixCells();
    }

    function wireMatrixCells() {
      const cells = popover.querySelectorAll('.vibe-matrix-cell');
      cells.forEach(cell => {
        cell.addEventListener('click', () => {
          currentJC = cell.dataset.jc;
          currentAI = cell.dataset.ai;
          targetElement.style.justifyContent = currentJC;
          targetElement.style.alignItems = currentAI;
          cells.forEach(c => c.classList.toggle('active', c.dataset.jc === currentJC && c.dataset.ai === currentAI));
          if (spaceAutoCheck && spaceAutoCheck.checked) {
            spaceAutoCheck.checked = false;
            updateSpaceAutoState(false);
          }
          jcBeforeSpaceAuto = currentJC;
          notify();
        });
      });
    }

    const spaceAutoCheck = popover.querySelector('.vibe-space-auto-check');
    const gapInputRow = popover.querySelector('.vibe-gap-input-row');
    const gapInput = popover.querySelector('.vibe-flex-options [data-prop="gap"]');
    let jcBeforeSpaceAuto = currentJC !== 'space-between' ? currentJC : 'flex-start';

    function updateSpaceAutoState(isAuto) {
      if (gapInputRow) gapInputRow.classList.toggle('disabled', isAuto);
      if (gapInput) gapInput.disabled = isAuto;
    }

    wireMatrixCells();

    const reverseCheck = popover.querySelector('.vibe-reverse-check');
    if (reverseCheck) {
      reverseCheck.addEventListener('change', () => {
        currentReversed = reverseCheck.checked;
        targetElement.style.flexDirection = getFlexDir(currentMode, currentReversed);
        notify();
      });
    }

    const wrapCheck = popover.querySelector('.vibe-wrap-check');
    if (wrapCheck) {
      wrapCheck.addEventListener('change', () => {
        currentFlexWrap = wrapCheck.checked ? 'wrap' : 'nowrap';
        targetElement.style.flexWrap = currentFlexWrap;
        notify();
      });
    }

    if (spaceAutoCheck) {
      spaceAutoCheck.addEventListener('change', () => {
        if (spaceAutoCheck.checked) {
          jcBeforeSpaceAuto = currentJC;
          currentJC = 'space-between';
        } else {
          currentJC = jcBeforeSpaceAuto;
        }
        targetElement.style.justifyContent = currentJC;
        updateSpaceAutoState(spaceAutoCheck.checked);
        rebuildMatrix(currentMode);
        notify();
      });
    }

    const gridColsInput = popover.querySelector('.vibe-grid-cols');
    const gridRowsInput = popover.querySelector('.vibe-grid-rows');
    const gridColGapInput = popover.querySelector('.vibe-grid-col-gap');
    const gridRowGapInput = popover.querySelector('.vibe-grid-row-gap');

    function applyGridCols() {
      const n = parseInt(gridColsInput?.value) || 1;
      currentGTC = gridCountToTemplate(n);
      targetElement.style.gridTemplateColumns = currentGTC;
      notify();
    }
    function applyGridRows() {
      const n = parseInt(gridRowsInput?.value) || 1;
      currentGTR = gridCountToTemplate(n);
      targetElement.style.gridTemplateRows = currentGTR;
      notify();
    }
    function applyGridGaps() {
      const cg = Math.round(parseFloat(gridColGapInput?.value) || 0);
      const rg = Math.round(parseFloat(gridRowGapInput?.value) || 0);
      targetElement.style.columnGap = cg + 'px';
      targetElement.style.rowGap = rg + 'px';
      notify();
    }
    if (gridColsInput) { gridColsInput.addEventListener('input', applyGridCols); wireNumArrowKeys(gridColsInput, applyGridCols, 1, 24); }
    if (gridRowsInput) { gridRowsInput.addEventListener('input', applyGridRows); wireNumArrowKeys(gridRowsInput, applyGridRows, 1, 24); }
    if (gridColGapInput) { gridColGapInput.addEventListener('input', applyGridGaps); wireNumArrowKeys(gridColGapInput, applyGridGaps, 0, 999); }
    if (gridRowGapInput) { gridRowGapInput.addEventListener('input', applyGridGaps); wireNumArrowKeys(gridRowGapInput, applyGridGaps, 0, 999); }

    const bwInput = popover.querySelector('[data-prop="borderWidth"]');
    if (bwInput) {
      bwInput.addEventListener('input', () => {
        const bw = parseFloat(bwInput.value) || 0;
        if (bw > 0) { targetElement.style.borderStyle = 'solid'; }
        else { targetElement.style.borderStyle = ''; targetElement.style.borderWidth = ''; }
      });
    }

    wireColorPicker(popover, targetElement, colorState, 'backgroundColor');
    wireColorPicker(popover, targetElement, colorState, 'borderColor');

    resetBtn.addEventListener('click', () => {
      popover.querySelectorAll('.vibe-stepper-input').forEach(input => {
        const cfg = PROP_CONFIG[input.dataset.prop];
        if (!cfg) return;
        input.value = Math.round(cfg.orig);
        targetElement.style[input.dataset.prop] = '';
      });
      currentMode = origMode;
      targetElement.style.display = '';
      targetElement.style.flexDirection = '';
      targetElement.style.flexWrap = '';
      targetElement.style.justifyContent = '';
      targetElement.style.alignItems = '';
      targetElement.style.gridTemplateColumns = '';
      targetElement.style.gridTemplateRows = '';
      targetElement.style.gap = '';
      modeBtns.forEach(b => b.classList.toggle('active', b.dataset.mode === origMode));
      flexOptions.style.display = (origMode === 'vflex' || origMode === 'hflex') ? '' : 'none';
      gridOptions.style.display = origMode === 'grid' ? '' : 'none';
      currentJC = origJC; currentAI = origAI;
      currentReversed = isReversedDir(origFlexDir);
      currentFlexWrap = origFlexWrap;
      if (reverseCheck) reverseCheck.checked = currentReversed;
      if (wrapCheck) wrapCheck.checked = (origFlexWrap === 'wrap' || origFlexWrap === 'wrap-reverse');
      jcBeforeSpaceAuto = origJC !== 'space-between' ? origJC : 'flex-start';
      if (spaceAutoCheck) { spaceAutoCheck.checked = (origJC === 'space-between'); updateSpaceAutoState(origJC === 'space-between'); }
      rebuildMatrix(origMode);
      currentGTC = origGTC; currentGTR = origGTR;
      if (gridColsInput) gridColsInput.value = parseGridCount(origGTC);
      if (gridRowsInput) gridRowsInput.value = parseGridCount(origGTR);
      if (gridColGapInput) gridColGapInput.value = 0;
      if (gridRowGapInput) gridRowGapInput.value = 0;
      targetElement.style.columnGap = '';
      targetElement.style.rowGap = '';
      targetElement.style.borderStyle = '';
      targetElement.style.borderWidth = '';
      targetElement.style.borderRadius = '';
      resetColorPicker(popover, targetElement, colorState, 'backgroundColor', origBgColor);
      resetColorPicker(popover, targetElement, colorState, 'borderColor', origBorderColor);
      notify();
    });

    return function buildPendingChanges() {
      const changes = {};

      const modeDisplay = currentMode === 'grid' ? 'grid' : (currentMode === 'vflex' || currentMode === 'hflex') ? 'flex' : 'block';
      const modeFlexDir = (currentMode === 'vflex' || currentMode === 'hflex') ? getFlexDir(currentMode, currentReversed) : origFlexDir;

      if (modeDisplay !== origDisplayRaw) {
        changes.display = { original: origDisplayRaw, value: modeDisplay };
      }
      if (currentMode === 'vflex' || currentMode === 'hflex') {
        if (modeFlexDir !== origFlexDir) changes.flexDirection = { original: origFlexDir, value: modeFlexDir };
        if (currentJC !== origJC) changes.justifyContent = { original: origJC, value: currentJC };
        if (currentAI !== origAI) changes.alignItems = { original: origAI, value: currentAI };
        if (currentFlexWrap !== origFlexWrap) changes.flexWrap = { original: origFlexWrap, value: currentFlexWrap };
      }

      if (currentMode === 'vflex' || currentMode === 'hflex') {
        const gapInput = popover.querySelector('.vibe-flex-options [data-prop="gap"]');
        const gapVal = Math.round(parseFloat(gapInput?.value) || 0);
        if (gapVal !== Math.round(origGap)) changes.gap = { original: Math.round(origGap) + 'px', value: gapVal + 'px' };
      }

      if (currentMode === 'grid') {
        if (currentGTC !== origGTC) changes.gridTemplateColumns = { original: origGTC, value: currentGTC };
        if (currentGTR !== origGTR) changes.gridTemplateRows = { original: origGTR, value: currentGTR };
        const cg = Math.round(parseFloat(gridColGapInput?.value) || 0);
        const rg = Math.round(parseFloat(gridRowGapInput?.value) || 0);
        const origCG = Math.round(parseFloat(s.columnGap) || origGap);
        const origRG = Math.round(parseFloat(s.rowGap) || origGap);
        if (cg !== origCG) changes.columnGap = { original: origCG + 'px', value: cg + 'px' };
        if (rg !== origRG) changes.rowGap = { original: origRG + 'px', value: rg + 'px' };
      }

      const curBW = Math.round(parseFloat(popover.querySelector('[data-prop="borderWidth"]')?.value) || 0);
      const curBR = Math.round(parseFloat(popover.querySelector('[data-prop="borderRadius"]')?.value) || 0);
      if (curBW !== Math.round(origBW)) {
        changes.borderWidth = { original: Math.round(origBW) + 'px', value: curBW + 'px' };
        changes.borderStyle = { original: origBS, value: curBW > 0 ? 'solid' : 'none' };
      }
      if (curBR !== Math.round(origBR)) changes.borderRadius = { original: Math.round(origBR) + 'px', value: curBR + 'px' };

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

  // --- Sizing panel ---

  function buildSizingToolbarHTML(pc, s) {
    const vals = {};
    for (const p of SIZING_PROPS) {
      const raw = pc?.[p] ? pc[p].value : (s[p] || '');
      vals[p] = formatSizingVal(raw, p);
    }

    return {
      sizing: `
      <div class="vibe-section-header"><span class="vibe-section-label">Width</span></div>
      <div class="vibe-sizing-row">
        <div class="vibe-sizing-pair">
          <span class="vibe-design-icon-label" title="Width">W</span>
          <div class="vibe-stepper vibe-stepper-sm">
            <input class="vibe-stepper-text vibe-sizing-input" data-sizing="width" type="text" value="${vals.width}" placeholder="Default">
          </div>
        </div>
        <div class="vibe-sizing-pair">
          <span class="vibe-design-icon-label" title="Min width">Min</span>
          <div class="vibe-stepper vibe-stepper-sm">
            <input class="vibe-stepper-text vibe-sizing-input" data-sizing="minWidth" type="text" value="${vals.minWidth}" placeholder="—">
          </div>
        </div>
        <div class="vibe-sizing-pair">
          <span class="vibe-design-icon-label" title="Max width">Max</span>
          <div class="vibe-stepper vibe-stepper-sm">
            <input class="vibe-stepper-text vibe-sizing-input" data-sizing="maxWidth" type="text" value="${vals.maxWidth}" placeholder="—">
          </div>
        </div>
      </div>
      <div class="vibe-section-header"><span class="vibe-section-label">Height</span></div>
      <div class="vibe-sizing-row">
        <div class="vibe-sizing-pair">
          <span class="vibe-design-icon-label" title="Height">H</span>
          <div class="vibe-stepper vibe-stepper-sm">
            <input class="vibe-stepper-text vibe-sizing-input" data-sizing="height" type="text" value="${vals.height}" placeholder="Default">
          </div>
        </div>
        <div class="vibe-sizing-pair">
          <span class="vibe-design-icon-label" title="Min height">Min</span>
          <div class="vibe-stepper vibe-stepper-sm">
            <input class="vibe-stepper-text vibe-sizing-input" data-sizing="minHeight" type="text" value="${vals.minHeight}" placeholder="—">
          </div>
        </div>
        <div class="vibe-sizing-pair">
          <span class="vibe-design-icon-label" title="Max height">Max</span>
          <div class="vibe-stepper vibe-stepper-sm">
            <input class="vibe-stepper-text vibe-sizing-input" data-sizing="maxHeight" type="text" value="${vals.maxHeight}" placeholder="—">
          </div>
        </div>
      </div>`,
      spacing: buildSpacingToolbarHTML(pc, s)
    };
  }

  function buildSpacingToolbarHTML(pc, s) {
    const origPT = pc?.paddingTop ? parseFloat(pc.paddingTop.original) : (parseFloat(s.paddingTop) || 0);
    const origPR = pc?.paddingRight ? parseFloat(pc.paddingRight.original) : (parseFloat(s.paddingRight) || 0);
    const origPB = pc?.paddingBottom ? parseFloat(pc.paddingBottom.original) : (parseFloat(s.paddingBottom) || 0);
    const origPL = pc?.paddingLeft ? parseFloat(pc.paddingLeft.original) : (parseFloat(s.paddingLeft) || 0);
    const curPT = pc?.paddingTop ? parseFloat(pc.paddingTop.value) : origPT;
    const curPR = pc?.paddingRight ? parseFloat(pc.paddingRight.value) : origPR;
    const curPB = pc?.paddingBottom ? parseFloat(pc.paddingBottom.value) : origPB;
    const curPL = pc?.paddingLeft ? parseFloat(pc.paddingLeft.value) : origPL;
    const padNeedsSplit = (curPT !== curPB) || (curPL !== curPR);
    const padV = curPT === curPB ? `${Math.round(curPT)}` : `${Math.round(curPT)}, ${Math.round(curPB)}`;
    const padH = curPL === curPR ? `${Math.round(curPL)}` : `${Math.round(curPL)}, ${Math.round(curPR)}`;

    const origMT = pc?.marginTop ? parseFloat(pc.marginTop.original) : (parseFloat(s.marginTop) || 0);
    const origMR = pc?.marginRight ? parseFloat(pc.marginRight.original) : (parseFloat(s.marginRight) || 0);
    const origMB = pc?.marginBottom ? parseFloat(pc.marginBottom.original) : (parseFloat(s.marginBottom) || 0);
    const origML = pc?.marginLeft ? parseFloat(pc.marginLeft.original) : (parseFloat(s.marginLeft) || 0);
    const curMT = pc?.marginTop ? parseFloat(pc.marginTop.value) : origMT;
    const curMR = pc?.marginRight ? parseFloat(pc.marginRight.value) : origMR;
    const curMB = pc?.marginBottom ? parseFloat(pc.marginBottom.value) : origMB;
    const curML = pc?.marginLeft ? parseFloat(pc.marginLeft.value) : origML;
    const marNeedsSplit = (curMT !== curMB) || (curML !== curMR);
    const marV = curMT === curMB ? `${Math.round(curMT)}` : `${Math.round(curMT)}, ${Math.round(curMB)}`;
    const marH = curML === curMR ? `${Math.round(curML)}` : `${Math.round(curML)}, ${Math.round(curMR)}`;

    return `
      <div class="vibe-section-header"><span class="vibe-section-label">Padding</span></div>
      <div class="vibe-spacing-row vibe-padding-vh-row" ${padNeedsSplit ? 'style="display:none"' : ''}>
        <div class="vibe-spacing-inputs">
          <span class="vibe-design-icon" title="Padding vertical">${ICONS.paddingV}</span>
          <div class="vibe-stepper vibe-stepper-grow">
            <input class="vibe-stepper-text vibe-pad-v" type="text" value="${padV}" title="Top, Bottom">
            <span class="vibe-stepper-unit">px</span>
          </div>
          <div class="vibe-prop-spacer"></div>
          <span class="vibe-design-icon" title="Padding horizontal">${ICONS.paddingH}</span>
          <div class="vibe-stepper vibe-stepper-grow">
            <input class="vibe-stepper-text vibe-pad-h" type="text" value="${padH}" title="Left, Right">
            <span class="vibe-stepper-unit">px</span>
          </div>
        </div>
        <button class="vibe-split-btn vibe-pad-split-btn ${padNeedsSplit ? 'active' : ''}" type="button" title="Split padding">${padNeedsSplit ? ICONS.merge : ICONS.split}</button>
      </div>
      <div class="vibe-spacing-row vibe-padding-split-row" ${padNeedsSplit ? '' : 'style="display:none"'}>
        <div class="vibe-spacing-inputs">
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
        </div>
        <button class="vibe-split-btn vibe-pad-split-btn active" type="button" title="Merge padding">${ICONS.merge}</button>
      </div>
      <div class="vibe-section-header"><span class="vibe-section-label">Margin</span></div>
      <div class="vibe-spacing-row vibe-margin-vh-row" ${marNeedsSplit ? 'style="display:none"' : ''}>
        <div class="vibe-spacing-inputs">
          <span class="vibe-design-icon" title="Margin vertical">${ICONS.marginV}</span>
          <div class="vibe-stepper vibe-stepper-grow">
            <input class="vibe-stepper-text vibe-mar-v" type="text" value="${marV}" title="Top, Bottom">
            <span class="vibe-stepper-unit">px</span>
          </div>
          <div class="vibe-prop-spacer"></div>
          <span class="vibe-design-icon" title="Margin horizontal">${ICONS.marginH}</span>
          <div class="vibe-stepper vibe-stepper-grow">
            <input class="vibe-stepper-text vibe-mar-h" type="text" value="${marH}" title="Left, Right">
            <span class="vibe-stepper-unit">px</span>
          </div>
        </div>
        <button class="vibe-split-btn vibe-mar-split-btn ${marNeedsSplit ? 'active' : ''}" type="button" title="Split margin">${marNeedsSplit ? ICONS.merge : ICONS.split}</button>
      </div>
      <div class="vibe-spacing-row vibe-margin-split-row" ${marNeedsSplit ? '' : 'style="display:none"'}>
        <div class="vibe-spacing-inputs">
          <span class="vibe-design-icon-label" title="Top">T</span>
          <div class="vibe-stepper vibe-stepper-sm">
            <input class="vibe-stepper-input" data-prop="marginTop" type="number" min="-999" max="999" value="${Math.round(curMT)}">
          </div>
          <span class="vibe-design-icon-label" title="Right">R</span>
          <div class="vibe-stepper vibe-stepper-sm">
            <input class="vibe-stepper-input" data-prop="marginRight" type="number" min="-999" max="999" value="${Math.round(curMR)}">
          </div>
          <span class="vibe-design-icon-label" title="Bottom">B</span>
          <div class="vibe-stepper vibe-stepper-sm">
            <input class="vibe-stepper-input" data-prop="marginBottom" type="number" min="-999" max="999" value="${Math.round(curMB)}">
          </div>
          <span class="vibe-design-icon-label" title="Left">L</span>
          <div class="vibe-stepper vibe-stepper-sm">
            <input class="vibe-stepper-input" data-prop="marginLeft" type="number" min="-999" max="999" value="${Math.round(curML)}">
          </div>
        </div>
        <button class="vibe-split-btn vibe-mar-split-btn active" type="button" title="Merge margin">${ICONS.merge}</button>
      </div>`;
  }

  function wireSizingToolbar(popover, targetElement, pc, s, resetBtn) {
    const sizingInputs = popover.querySelectorAll('.vibe-sizing-input');
    const sizingOriginals = {};
    for (const p of SIZING_PROPS) {
      sizingOriginals[p] = pc?.[p] ? pc[p].original : (s[p] || SIZING_UNSET[p]);
    }

    sizingInputs.forEach(input => {
      const prop = input.dataset.sizing;
      input.addEventListener('input', () => {
        const val = input.value.trim();
        targetElement.style[prop] = val === '' ? '' : (/^\d+(\.\d+)?$/.test(val) ? val + 'px' : val);
        popover._updateResetVisibility?.();
        popover._updateSave?.();
      });
      input.addEventListener('keydown', (e) => {
        if (e.key !== 'ArrowUp' && e.key !== 'ArrowDown') return;
        e.preventDefault();
        const cur = input.value.trim();
        const num = parseFloat(cur);
        if (isNaN(num)) return;
        const step = e.shiftKey ? 10 : 1;
        const delta = e.key === 'ArrowUp' ? step : -step;
        const unit = cur.replace(/^[\d.-]+/, '') || 'px';
        const newVal = Math.max(0, num + delta);
        input.value = newVal + unit;
        targetElement.style[prop] = newVal + unit;
        popover._updateResetVisibility?.();
        popover._updateSave?.();
      });
    });

    const origPT = pc?.paddingTop ? parseFloat(pc.paddingTop.original) : (parseFloat(s.paddingTop) || 0);
    const origPR = pc?.paddingRight ? parseFloat(pc.paddingRight.original) : (parseFloat(s.paddingRight) || 0);
    const origPB = pc?.paddingBottom ? parseFloat(pc.paddingBottom.original) : (parseFloat(s.paddingBottom) || 0);
    const origPL = pc?.paddingLeft ? parseFloat(pc.paddingLeft.original) : (parseFloat(s.paddingLeft) || 0);
    const origMT = pc?.marginTop ? parseFloat(pc.marginTop.original) : (parseFloat(s.marginTop) || 0);
    const origMR = pc?.marginRight ? parseFloat(pc.marginRight.original) : (parseFloat(s.marginRight) || 0);
    const origMB = pc?.marginBottom ? parseFloat(pc.marginBottom.original) : (parseFloat(s.marginBottom) || 0);
    const origML = pc?.marginLeft ? parseFloat(pc.marginLeft.original) : (parseFloat(s.marginLeft) || 0);

    wireStepperInputs(popover, targetElement, {
      paddingTop:    { step: 1, shiftStep: 10, min: 0, max: 999, unit: 'px', orig: origPT },
      paddingRight:  { step: 1, shiftStep: 10, min: 0, max: 999, unit: 'px', orig: origPR },
      paddingBottom: { step: 1, shiftStep: 10, min: 0, max: 999, unit: 'px', orig: origPB },
      paddingLeft:   { step: 1, shiftStep: 10, min: 0, max: 999, unit: 'px', orig: origPL },
      marginTop:     { step: 1, shiftStep: 10, min: -999, max: 999, unit: 'px', orig: origMT },
      marginRight:   { step: 1, shiftStep: 10, min: -999, max: 999, unit: 'px', orig: origMR },
      marginBottom:  { step: 1, shiftStep: 10, min: -999, max: 999, unit: 'px', orig: origMB },
      marginLeft:    { step: 1, shiftStep: 10, min: -999, max: 999, unit: 'px', orig: origML },
    });

    const notify = () => { popover._updateResetVisibility?.(); popover._updateSave?.(); };
    let padSplit = popover.querySelector('.vibe-padding-split-row')?.style.display !== 'none';
    let marSplit = popover.querySelector('.vibe-margin-split-row')?.style.display !== 'none';

    const padVInput = popover.querySelector('.vibe-pad-v');
    const padHInput = popover.querySelector('.vibe-pad-h');
    const padVHRow = popover.querySelector('.vibe-padding-vh-row');
    const padSplitRow = popover.querySelector('.vibe-padding-split-row');
    const padSplitBtns = popover.querySelectorAll('.vibe-pad-split-btn');
    const marVInput = popover.querySelector('.vibe-mar-v');
    const marHInput = popover.querySelector('.vibe-mar-h');
    const marVHRow = popover.querySelector('.vibe-margin-vh-row');
    const marSplitRow = popover.querySelector('.vibe-margin-split-row');
    const marSplitBtns = popover.querySelectorAll('.vibe-mar-split-btn');

    if (padVInput) {
      const applyPadVH = () => {
        const v = parsePaddingInput(padVInput.value);
        const h = parsePaddingInput(padHInput.value);
        if (v) { targetElement.style.paddingTop = v.a + 'px'; targetElement.style.paddingBottom = v.b + 'px'; }
        if (h) { targetElement.style.paddingLeft = h.a + 'px'; targetElement.style.paddingRight = h.b + 'px'; }
        notify();
      };
      padVInput.addEventListener('input', applyPadVH);
      padHInput.addEventListener('input', applyPadVH);
      wireVHArrowKeys(padVInput, applyPadVH, 0, 999);
      wireVHArrowKeys(padHInput, applyPadVH, 0, 999);

      const togglePadSplit = () => {
        padSplit = !padSplit;
        padSplitBtns.forEach(b => b.classList.toggle('active', padSplit));
        padVHRow.style.display = padSplit ? 'none' : '';
        padSplitRow.style.display = padSplit ? '' : 'none';
        if (padSplit) {
          const v = parsePaddingInput(padVInput.value) || { a: 0, b: 0 };
          const h = parsePaddingInput(padHInput.value) || { a: 0, b: 0 };
          setInputVal(popover, 'paddingTop', Math.round(v.a));
          setInputVal(popover, 'paddingBottom', Math.round(v.b));
          setInputVal(popover, 'paddingLeft', Math.round(h.a));
          setInputVal(popover, 'paddingRight', Math.round(h.b));
        } else {
          const pt = getInputVal(popover, 'paddingTop'); const pr = getInputVal(popover, 'paddingRight');
          const pb = getInputVal(popover, 'paddingBottom'); const pl = getInputVal(popover, 'paddingLeft');
          padVInput.value = pt === pb ? `${Math.round(pt)}` : `${Math.round(pt)}, ${Math.round(pb)}`;
          padHInput.value = pl === pr ? `${Math.round(pl)}` : `${Math.round(pl)}, ${Math.round(pr)}`;
        }
        notify();
      };
      padSplitBtns.forEach(b => b.addEventListener('click', togglePadSplit));
    }

    if (marVInput) {
      const applyMarVH = () => {
        const v = parsePaddingInput(marVInput.value);
        const h = parsePaddingInput(marHInput.value);
        if (v) { targetElement.style.marginTop = v.a + 'px'; targetElement.style.marginBottom = v.b + 'px'; }
        if (h) { targetElement.style.marginLeft = h.a + 'px'; targetElement.style.marginRight = h.b + 'px'; }
        notify();
      };
      marVInput.addEventListener('input', applyMarVH);
      marHInput.addEventListener('input', applyMarVH);
      wireVHArrowKeys(marVInput, applyMarVH, -999, 999);
      wireVHArrowKeys(marHInput, applyMarVH, -999, 999);

      const toggleMarSplit = () => {
        marSplit = !marSplit;
        marSplitBtns.forEach(b => b.classList.toggle('active', marSplit));
        marVHRow.style.display = marSplit ? 'none' : '';
        marSplitRow.style.display = marSplit ? '' : 'none';
        if (marSplit) {
          const v = parsePaddingInput(marVInput.value) || { a: 0, b: 0 };
          const h = parsePaddingInput(marHInput.value) || { a: 0, b: 0 };
          setInputVal(popover, 'marginTop', Math.round(v.a));
          setInputVal(popover, 'marginBottom', Math.round(v.b));
          setInputVal(popover, 'marginLeft', Math.round(h.a));
          setInputVal(popover, 'marginRight', Math.round(h.b));
        } else {
          const mt = getInputVal(popover, 'marginTop'); const mr = getInputVal(popover, 'marginRight');
          const mb = getInputVal(popover, 'marginBottom'); const ml = getInputVal(popover, 'marginLeft');
          marVInput.value = mt === mb ? `${Math.round(mt)}` : `${Math.round(mt)}, ${Math.round(mb)}`;
          marHInput.value = ml === mr ? `${Math.round(ml)}` : `${Math.round(ml)}, ${Math.round(mr)}`;
        }
        notify();
      };
      marSplitBtns.forEach(b => b.addEventListener('click', toggleMarSplit));
    }

    resetBtn.addEventListener('click', () => {
      sizingInputs.forEach(input => {
        const prop = input.dataset.sizing;
        input.value = formatSizingVal(sizingOriginals[prop], prop);
        targetElement.style[prop] = '';
      });
      if (padVInput) {
        padVInput.value = origPT === origPB ? `${Math.round(origPT)}` : `${Math.round(origPT)}, ${Math.round(origPB)}`;
        padHInput.value = origPL === origPR ? `${Math.round(origPL)}` : `${Math.round(origPL)}, ${Math.round(origPR)}`;
        targetElement.style.paddingTop = ''; targetElement.style.paddingRight = '';
        targetElement.style.paddingBottom = ''; targetElement.style.paddingLeft = '';
      }
      if (marVInput) {
        marVInput.value = origMT === origMB ? `${Math.round(origMT)}` : `${Math.round(origMT)}, ${Math.round(origMB)}`;
        marHInput.value = origML === origMR ? `${Math.round(origML)}` : `${Math.round(origML)}, ${Math.round(origMR)}`;
        targetElement.style.marginTop = ''; targetElement.style.marginRight = '';
        targetElement.style.marginBottom = ''; targetElement.style.marginLeft = '';
      }
    });

    return function buildPendingChanges() {
      const changes = {};
      sizingInputs.forEach(input => {
        const prop = input.dataset.sizing;
        const val = input.value.trim();
        const orig = sizingOriginals[prop];
        const applied = val === '' ? SIZING_UNSET[prop] : (/^\d+(\.\d+)?$/.test(val) ? val + 'px' : val);
        if (applied !== orig) changes[prop] = { original: orig, value: applied };
      });
      if (padVInput) {
        let pt, pr, pb, pl;
        if (padSplit) {
          pt = getInputVal(popover, 'paddingTop'); pr = getInputVal(popover, 'paddingRight');
          pb = getInputVal(popover, 'paddingBottom'); pl = getInputVal(popover, 'paddingLeft');
        } else {
          const v = parsePaddingInput(padVInput.value) || { a: origPT, b: origPB };
          const h = parsePaddingInput(padHInput.value) || { a: origPL, b: origPR };
          pt = v.a; pb = v.b; pl = h.a; pr = h.b;
        }
        if (Math.round(pt) !== Math.round(origPT)) changes.paddingTop = { original: Math.round(origPT) + 'px', value: Math.round(pt) + 'px' };
        if (Math.round(pr) !== Math.round(origPR)) changes.paddingRight = { original: Math.round(origPR) + 'px', value: Math.round(pr) + 'px' };
        if (Math.round(pb) !== Math.round(origPB)) changes.paddingBottom = { original: Math.round(origPB) + 'px', value: Math.round(pb) + 'px' };
        if (Math.round(pl) !== Math.round(origPL)) changes.paddingLeft = { original: Math.round(origPL) + 'px', value: Math.round(pl) + 'px' };
      }
      if (marVInput) {
        let mt, mr, mb, ml;
        if (marSplit) {
          mt = getInputVal(popover, 'marginTop'); mr = getInputVal(popover, 'marginRight');
          mb = getInputVal(popover, 'marginBottom'); ml = getInputVal(popover, 'marginLeft');
        } else {
          const v = parsePaddingInput(marVInput.value) || { a: origMT, b: origMB };
          const h = parsePaddingInput(marHInput.value) || { a: origML, b: origMR };
          mt = v.a; mb = v.b; ml = h.a; mr = h.b;
        }
        if (Math.round(mt) !== Math.round(origMT)) changes.marginTop = { original: Math.round(origMT) + 'px', value: Math.round(mt) + 'px' };
        if (Math.round(mr) !== Math.round(origMR)) changes.marginRight = { original: Math.round(origMR) + 'px', value: Math.round(mr) + 'px' };
        if (Math.round(mb) !== Math.round(origMB)) changes.marginBottom = { original: Math.round(origMB) + 'px', value: Math.round(mb) + 'px' };
        if (Math.round(ml) !== Math.round(origML)) changes.marginLeft = { original: Math.round(origML) + 'px', value: Math.round(ml) + 'px' };
      }
      return Object.keys(changes).length ? changes : null;
    };
  }

  // --- Shared controls ---

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

  function wireNumArrowKeys(input, applyFn, min, max) {
    input.addEventListener('keydown', (e) => {
      if (e.key === 'ArrowUp' || e.key === 'ArrowDown') {
        e.preventDefault();
        const step = e.shiftKey ? 10 : 1;
        const delta = e.key === 'ArrowUp' ? step : -step;
        input.value = Math.max(min, Math.min(max, (parseInt(input.value) || 0) + delta));
        applyFn();
      }
    });
  }

  function wireVHArrowKeys(input, applyFn, min, max) {
    input.addEventListener('keydown', (e) => {
      if (e.key === 'ArrowUp' || e.key === 'ArrowDown') {
        e.preventDefault();
        const step = e.shiftKey ? 10 : 1;
        const delta = e.key === 'ArrowUp' ? step : -step;
        const parts = input.value.split(',').map(s => parseFloat(s.trim())).filter(n => !isNaN(n));
        if (parts.length === 0) parts.push(0);
        const stepped = parts.map(v => Math.max(min, Math.min(max, v + delta)));
        input.value = stepped.length === 1 ? `${stepped[0]}` : `${stepped[0]}, ${stepped[1]}`;
        applyFn();
      }
    });
  }

  function wireColorPicker(popover, targetElement, colorState, prop) {
    const swatch = popover.querySelector(`.vibe-color-swatch[data-color-prop="${prop}"]`);
    const hexInput = popover.querySelector(`.vibe-color-input[data-color-prop="${prop}"]`);
    if (!swatch || !hexInput) return;

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
      const val = hexInput.value.trim();
      if (val && !/^#/.test(val)) hexInput.value = '#' + val;
    });

    swatch.addEventListener('click', (e) => {
      e.stopPropagation();
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

  // --- Public API ---

  return {
    ALL_DESIGN_PROPS,
    ICONS,
    kbdHint,
    classifyElement,
    getTabsForType,
    buildRawCssContent,
    buildContentToolbarHTML,
    autoResizeContentInput,
    wireContentToolbar,
    buildTextToolbarHTML,
    wireTextToolbar,
    buildContainerToolbarHTML,
    wireContainerToolbar,
    buildSizingToolbarHTML,
    wireSizingToolbar,
    escapeHTML,
    kebabToCamel,
    getDeviceIcon
  };
})();
