// All Vibe Annotations V2 CSS as a JS constant
// Loaded synchronously into the shadow root — no async fetch needed

var VIBE_STYLES = `
/* ===== Reset inside shadow ===== */
*, *::before, *::after {
  box-sizing: border-box;
  margin: 0;
  padding: 0;
}

/* ===== Theme tokens (dark only) ===== */
:host {
  /* Core surfaces */
  --v-surface: #0C0E12;
  --v-surface-1: #191D24;
  --v-text-primary: #fcfcfd;
  --v-text-secondary: #9AA4B2;
  --v-outline: #ffffff0d;
  --v-outline-highlight: #ffffff26;
  --v-surface-hover: #fcfcfd14;
  --v-secondary-btn-bg: #ffffff0d;
  --v-textarea-bg: #ffffff0d;

  /* Accent */
  --v-accent: #d97757;
  --v-on-accent: #ffffff;

  /* Semantic */
  --v-warning: #f79009;
  --v-on-warning: #ffffff;
  --v-warning-container: #f7900914;
  --v-on-warning-container: #f79009;
  --v-danger: #dc2626;
  --v-danger-hover: #dc26261a;
  --v-highlight: #3b82f6;
  --v-badge-bg: #D03D68;
  --v-tooltip-bg: #1f2937;
  --v-primary-btn: #4f5d75;

  /* Glass toolbar */
  --v-toolbar-bg: rgba(15, 17, 21, 0.97);
  --v-toolbar-border: rgba(255,255,255,0.08);
  --v-toolbar-shadow: 0 8px 32px rgba(0,0,0,0.4), 0 0 0 1px rgba(255,255,255,0.04);
  --v-toolbar-text: #d4d4d8;
  --v-toolbar-text-active: #fafafa;
  --v-toolbar-btn-hover: rgba(255,255,255,0.05);
  --v-toolbar-btn-active: rgba(255,255,255,0.07);

  /* Toolbar elements */
  --v-separator: rgba(255,255,255,0.08);
  --v-kbd-bg: rgba(255,255,255,0.08);
  --v-kbd-border: rgba(255,255,255,0.1);
  --v-pill-gradient: linear-gradient(90deg, #E85B5C 0%, #D03D68 100%);
  --v-instruction-text: #71717a;
  --v-dot-separator: #3f3f46;
  --v-close-icon: #52525b;
  --v-capture-accent: #8b5cf6;

  /* Status */
  --v-status-online: #10b981;
  --v-status-watching: #3b82f6;
  --v-status-offline: #52525b;

  /* Panels */
  --v-panel-bg: rgba(15, 17, 21, 0.97);
  --v-panel-shadow: 0 16px 48px rgba(0,0,0,0.5), 0 0 0 1px rgba(255,255,255,0.04);
  --v-design-change: #818cf8;
  --v-card-hover: rgba(255,255,255,0.03);
  --v-muted-text: #27272a;

  /* Typography */
  --v-font: 'Inter', -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
  --v-font-mono: 'SF Mono', Monaco, Inconsolata, 'Fira Code', monospace;

  /* Radii */
  --v-radius-xs: 4px;
  --v-radius-sm: 8px;
  --v-radius-md: 12px;
  --v-radius-lg: 16px;
  --v-radius-full: 9999px;

  font-family: var(--v-font);
  font-size: 14px;
  line-height: 1.5;
  color: var(--v-text-primary);
}

/* ===== Animations ===== */
@keyframes vibe-card-exit {
  from { opacity: 1; transform: translateX(0); max-height: 80px; }
  to   { opacity: 0; transform: translateX(-40px); max-height: 0; padding-top: 0; padding-bottom: 0; }
}

@keyframes vibe-toolbar-enter {
  from { opacity: 0; transform: translateY(-12px); }
  to   { opacity: 1; transform: translateY(0); }
}

@keyframes vibe-toolbar-exit {
  from { opacity: 1; transform: translateY(0); }
  to   { opacity: 0; transform: translateY(-12px); }
}

@keyframes vibe-fade-in {
  from { opacity: 0; transform: scale(0.96); }
  to   { opacity: 1; transform: scale(1); }
}

@keyframes vibe-slide-up {
  from { opacity: 0; transform: translateY(-8px); }
  to   { opacity: 1; transform: translateY(0); }
}

@keyframes vibe-slide-down {
  from { opacity: 0; transform: translateY(8px); }
  to   { opacity: 1; transform: translateY(0); }
}

@keyframes vibe-pulse {
  0%, 100% { transform: scale(1); }
  50% { transform: scale(1.15); }
}

/* ===== Inspection highlight overlay ===== */
.vibe-highlight {
  position: fixed;
  pointer-events: none;
  border: 2px solid rgba(59, 130, 246, 0.6);
  border-radius: 2px;
  background: rgba(59, 130, 246, 0.06);
  transition: all 0.1s ease;
  z-index: 1;
}

.vibe-hover-label {
  position: fixed;
  pointer-events: none;
  display: flex;
  flex-direction: column;
  gap: 0;
  max-width: min(360px, calc(100vw - 16px));
  padding: 12px 18px;
  border-radius: var(--v-radius-sm);
  background: linear-gradient(180deg, #4da0ff 0%, #2e84ea 100%);
  color: #fff;
  box-shadow: 0 12px 32px rgba(14, 67, 135, 0.28);
  z-index: 2;
}

.vibe-hover-label__title {
  font-size: 13px;
  font-weight: 500;
  line-height: 1.35;
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
}

.vibe-hover-label__meta {
  margin-top: 2px;
  font-size: 11px;
  font-weight: 500;
  line-height: 1.35;
  color: rgba(255, 255, 255, 0.85);
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
}

/* ===== Inspection toast ===== */
.vibe-toast {
  position: fixed;
  top: 20px;
  right: 20px;
  background: var(--v-accent);
  color: var(--v-on-accent);
  padding: 12px 18px;
  border-radius: var(--v-radius-sm);
  font-size: 13px;
  font-weight: 500;
  pointer-events: none;
  animation: vibe-toast-in 0.25s ease forwards;
  z-index: 10;
  box-shadow: 0 4px 16px rgba(0,0,0,0.18);
}

.vibe-toast--out {
  animation: vibe-toast-out 0.25s ease forwards;
}

.vibe-toast p { margin: 0; }

.vibe-toast .sub {
  font-size: 11px;
  opacity: 0.85;
  margin-top: 2px;
}

/* ===== Badges (numbered pins) ===== */
.vibe-badge {
  position: fixed;
  width: 22px;
  height: 22px;
  border-radius: 50%;
  background: var(--v-badge-bg);
  color: #fff;
  font-size: 11px;
  font-weight: 700;
  font-family: var(--v-font);
  display: flex;
  align-items: center;
  justify-content: center;
  pointer-events: auto;
  cursor: pointer;
  z-index: 5;
  box-shadow: 0 2px 8px rgba(0,0,0,0.18);
  transition: transform 0.15s ease, box-shadow 0.15s ease;
  transform: translateX(-50%);
  user-select: none;
}

.vibe-badge:hover {
  transform: translateX(-50%) scale(1.15);
  box-shadow: 0 3px 12px rgba(0,0,0,0.25);
}

.vibe-badge.targeted {
  animation: vibe-pulse 0.6s ease 3;
  box-shadow: 0 0 0 3px var(--v-highlight), 0 2px 8px rgba(0,0,0,0.18);
}

.vibe-badge-label {
  display: flex;
  align-items: center;
  justify-content: center;
  line-height: 1;
}

.vibe-badge.watching {
  animation: vibe-watch-pulse 2s ease-in-out infinite;
}

@keyframes vibe-watch-pulse {
  0%, 100% { box-shadow: 0 2px 8px rgba(0,0,0,0.18); }
  50% { box-shadow: 0 2px 8px rgba(0,0,0,0.18), 0 0 0 3px rgba(59,130,246,0.3); }
}

/* Badge tooltip */
.vibe-badge-tooltip {
  position: absolute;
  top: calc(100% + 8px);
  left: 50%;
  transform: translateX(-50%);
  background: var(--v-tooltip-bg);
  color: #fff;
  padding: 6px 10px;
  border-radius: 6px;
  font-size: 12px;
  font-weight: 400;
  max-width: 240px;
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
  pointer-events: none;
  opacity: 0;
  visibility: hidden;
  transition: opacity 0.15s ease, visibility 0.15s ease;
  box-shadow: 0 4px 12px rgba(0,0,0,0.2);
  z-index: 20;
}

.vibe-badge-tooltip::before {
  content: '';
  position: absolute;
  top: -5px;
  left: 50%;
  transform: translateX(-50%);
  border-left: 5px solid transparent;
  border-right: 5px solid transparent;
  border-bottom: 5px solid var(--v-tooltip-bg);
}

.vibe-badge:hover .vibe-badge-tooltip {
  opacity: 1;
  visibility: visible;
}

/* ===== Annotation popover ===== */
.vibe-popover-anchor {
  position: fixed;
  top: 0;
  left: 0;
  width: 100%;
  height: 100%;
  pointer-events: auto;
  z-index: 10;
  cursor: default !important;
}

.vibe-popover {
  pointer-events: auto;
  width: 340px;
  background: var(--v-panel-bg);
  border: 1px solid var(--v-toolbar-border);
  border-radius: var(--v-radius-md);
  box-shadow: var(--v-panel-shadow);
  animation: vibe-slide-up 0.2s ease forwards;
  overflow: visible;
  cursor: default !important;
}

.vibe-popover.dragging {
  user-select: none;
}

/* Drag handle (iPhone drawer style) */
.vibe-drag-handle {
  display: flex;
  justify-content: center;
  padding: 8px 0 4px;
  cursor: grab;
}
.vibe-drag-handle::after {
  content: '';
  width: 40%;
  height: 4px;
  border-radius: 2px;
  background: var(--v-outline-highlight);
  transition: background 0.15s ease;
}
.vibe-drag-handle:hover::after { background: var(--v-text-secondary); }
.vibe-drag-handle:active { cursor: grabbing; }

/* Popover title */
.vibe-popover-title {
  display: flex;
  align-items: center;
  gap: 4px;
  padding: 2px 14px 8px;
  font-size: 12px;
  font-weight: 500;
  color: var(--v-text-secondary);
}
.vibe-popover-title code {
  font-family: var(--v-font-mono);
  font-size: 11px;
  color: var(--v-text-primary);
}

/* Tab bar (pills) — single-line, scrollable */
.vibe-tab-bar {
  display: flex;
  gap: 4px;
  padding: 4px 14px 8px;
  flex-wrap: nowrap;
  overflow-x: auto;
  -webkit-overflow-scrolling: touch;
  scrollbar-width: none;
}
.vibe-tab-bar::-webkit-scrollbar { display: none; }
.vibe-tab {
  padding: 3px 10px;
  background: none;
  border: 1px solid var(--v-outline);
  border-radius: var(--v-radius-full);
  color: var(--v-text-secondary);
  font-family: var(--v-font);
  font-size: 11px;
  font-weight: 500;
  cursor: pointer;
  white-space: nowrap;
  transition: color .15s, background .15s, border-color .15s;
}
.vibe-tab:hover { color: var(--v-text-primary); border-color: var(--v-outline-highlight); }
.vibe-tab.active { color: var(--v-on-accent); background: var(--v-pill-gradient); border-color: transparent; }

/* Tab panels */
.vibe-tab-panel { padding-top: 4px; }

/* Raw CSS textarea */
.vibe-raw-css {
  width: 100%;
  min-height: 120px;
  max-height: 200px;
  resize: vertical;
  font-family: var(--v-font-mono);
  font-size: 11px;
  line-height: 1.5;
  color: var(--v-text-primary);
  background: var(--v-textarea-bg);
  border: 1px solid var(--v-outline);
  border-radius: var(--v-radius-xs);
  padding: 8px;
  outline: none;
  white-space: pre;
  overflow-x: auto;
  tab-size: 2;
  box-sizing: border-box;
}
.vibe-raw-css:focus { border-color: var(--v-accent); }

/* Raw CSS panel sections */
.vibe-raw-css-section { margin-bottom: 8px; }
.vibe-raw-css-section:last-child { margin-bottom: 0; }
.vibe-raw-css-toggle {
  display: flex;
  align-items: center;
  gap: 4px;
  background: none;
  border: none;
  padding: 2px 0;
  cursor: pointer;
  width: 100%;
  text-align: left;
  font-family: var(--v-font);
}
.vibe-raw-css-toggle:hover .vibe-raw-css-label { color: var(--v-text-primary); }
.vibe-raw-css-chevron {
  display: flex;
  align-items: center;
  color: var(--v-text-secondary);
  transition: transform 0.15s ease;
  transform: rotate(0deg);
  flex-shrink: 0;
}
.vibe-raw-css-chevron.open { transform: rotate(90deg); }
.vibe-raw-css-collapsible { margin-top: 4px; }
.vibe-raw-css-label {
  font-size: 11px;
  font-weight: 500;
  color: var(--v-text-secondary);
  display: inline;
}
.vibe-raw-css-hint { font-weight: 400; opacity: 0.6; }
.vibe-css-rules {
  width: 100%;
  min-height: 100px;
  max-height: 200px;
  resize: vertical;
  font-family: var(--v-font-mono);
  font-size: 11px;
  line-height: 1.5;
  color: var(--v-text-primary);
  background: var(--v-textarea-bg);
  border: 1px solid var(--v-outline);
  border-radius: var(--v-radius-xs);
  padding: 8px;
  outline: none;
  white-space: pre;
  overflow-x: auto;
  tab-size: 2;
  box-sizing: border-box;
}
.vibe-css-rules:focus { border-color: var(--v-accent); }

/* Design toolbar */
.vibe-design-toolbar {
  padding: 6px 14px;
  border-bottom: 1px solid var(--v-outline);
}

.vibe-design-row {
  display: flex;
  align-items: center;
  gap: 5px;
}

.vibe-design-row + .vibe-design-row {
  margin-top: 5px;
}

.vibe-design-icon {
  display: flex;
  align-items: center;
  justify-content: center;
  color: var(--v-text-secondary);
  flex-shrink: 0;
}

.vibe-design-icon svg {
  width: 12px;
  height: 12px;
}

.vibe-stepper {
  display: flex;
  align-items: center;
  border: 1px solid var(--v-outline);
  border-radius: var(--v-radius-xs);
  background: var(--v-textarea-bg);
}

.vibe-stepper-input {
  width: 36px;
  height: 22px;
  text-align: center;
  border: none;
  background: none;
  font-family: var(--v-font-mono);
  font-size: 11px;
  color: var(--v-text-primary);
  outline: none;
  -moz-appearance: textfield;
  padding: 0;
}

.vibe-stepper-input::-webkit-inner-spin-button,
.vibe-stepper-input::-webkit-outer-spin-button {
  -webkit-appearance: none;
  margin: 0;
}

.vibe-stepper-unit {
  font-family: var(--v-font-mono);
  font-size: 10px;
  color: var(--v-text-secondary);
  padding: 0 5px 0 0;
  user-select: none;
}

/* Content (text edit) textarea */
.vibe-content-row { align-items: flex-start; }
.vibe-content-icon { padding-top: 4px; }
.vibe-content-input {
  flex: 1;
  width: 0;
  min-height: 22px;
  max-height: calc(11px * 1.5 * 8 + 10px); /* ~8 lines */
  border: 1px solid var(--v-outline);
  border-radius: var(--v-radius-xs);
  background: var(--v-textarea-bg);
  font-family: var(--v-font-mono);
  font-size: 11px;
  line-height: 1.5;
  color: var(--v-text-primary);
  padding: 3px 6px;
  outline: none;
  box-sizing: border-box;
  min-width: 0;
  resize: none;
  overflow-y: auto;
}
.vibe-content-input:focus { border-color: var(--v-accent); }

.vibe-align-group {
  display: flex;
  border: 1px solid var(--v-outline);
  border-radius: var(--v-radius-xs);
  overflow: hidden;
}

.vibe-align-btn {
  width: 22px;
  height: 22px;
  display: flex;
  align-items: center;
  justify-content: center;
  background: none;
  border: none;
  border-right: 1px solid var(--v-outline);
  color: var(--v-text-secondary);
  cursor: pointer;
  transition: background 0.15s ease, color 0.15s ease;
  padding: 0;
}

.vibe-align-btn:last-child {
  border-right: none;
}

.vibe-align-btn:hover {
  background: var(--v-surface-hover);
}

.vibe-align-btn.active {
  background: var(--v-surface-hover);
  color: var(--v-text-primary);
}

.vibe-align-btn svg {
  width: 12px;
  height: 12px;
}

.vibe-design-reset {
  display: flex;
  align-items: center;
  justify-content: center;
  width: 24px;
  height: 24px;
  margin-left: auto;
  padding: 0;
  border: none;
  border-radius: var(--v-radius-xs);
  background: none;
  color: var(--v-text-secondary);
  cursor: pointer;
  transition: background 0.15s ease, color 0.15s ease, visibility 0s;
  visibility: hidden;
}

.vibe-design-reset:hover {
  color: var(--v-text-primary);
  background: var(--v-surface-hover);
}

/* Toggle group (display block/flex, flex direction) */
.vibe-toggle-group { display:flex; border:1px solid var(--v-outline); border-radius:var(--v-radius-xs); overflow:hidden; }
.vibe-toggle-btn { height:22px; padding:0 6px; background:none; border:none; border-right:1px solid var(--v-outline); color:var(--v-text-secondary); cursor:pointer; font-family:var(--v-font); font-size:11px; font-weight:500; transition:background .15s,color .15s; display:flex; align-items:center; justify-content:center; }
.vibe-toggle-btn:last-child { border-right:none; }
.vibe-toggle-btn:hover { background:var(--v-surface-hover); }
.vibe-toggle-btn.active { background:var(--v-surface-hover); color:var(--v-text-primary); }
.vibe-toggle-btn svg { width:12px; height:12px; }

/* Padding split toggle */
.vibe-split-btn { width:22px; height:22px; display:flex; align-items:center; justify-content:center; background:none; border:1px solid var(--v-outline); border-radius:var(--v-radius-xs); color:var(--v-text-secondary); cursor:pointer; margin-left:auto; flex-shrink:0; padding:0; }
.vibe-split-btn:hover { background:var(--v-surface-hover); color:var(--v-text-primary); }
.vibe-split-btn.active { background:var(--v-surface-hover); color:var(--v-text-primary); }

/* Smaller stepper for split-4 padding */
.vibe-stepper-sm { flex:1; min-width:0; }
.vibe-stepper-sm .vibe-stepper-input, .vibe-stepper-sm .vibe-stepper-text { width:100%; }

/* Sizing rows — label+field pairs with extra spacing */
.vibe-sizing-row { display:flex; align-items:center; gap:10px; }
.vibe-sizing-row + .vibe-sizing-row { margin-top:5px; }
.vibe-sizing-pair { display:flex; align-items:center; gap:4px; flex:1; min-width:0; }

/* Padding V/H text inputs */
.vibe-stepper-text { width:56px; height:22px; text-align:center; border:none; background:none; font-family:var(--v-font-mono); font-size:11px; color:var(--v-text-primary); outline:none; padding:0; }

/* Section headers (Padding / Margin / Flow) */
.vibe-section-header { display:flex; align-items:center; justify-content:space-between; margin-top:6px; margin-bottom:3px; }
.vibe-section-header:first-child { margin-top:0; }
.vibe-section-label { font-family:var(--v-font); font-size:10px; font-weight:500; color:var(--v-text-secondary); letter-spacing:0.01em; }

/* Grow stepper to fill available width */
.vibe-stepper-grow { flex:1; min-width:0; }
.vibe-stepper-grow .vibe-stepper-text { width:100%; }

/* Flex/Grid option sections */
.vibe-flex-options { margin-top:6px; }
.vibe-grid-options { margin-top:6px; }

/* Prop spacer — visual gap between inline icon+field groups */
.vibe-prop-spacer { width:8px; flex-shrink:0; }

/* Spacing rows — split button fixed, inputs flex */
.vibe-spacing-row { display:flex; align-items:center; gap:5px; }
.vibe-spacing-row + .vibe-spacing-row { margin-top:5px; }
.vibe-spacing-inputs { flex:1; min-width:0; display:flex; align-items:center; gap:5px; }

/* Flow toggle group — equal width buttons */
.vibe-flow-group { width:100%; }
.vibe-flow-group .vibe-toggle-btn { flex:1; padding:0 6px; height:24px; }
.vibe-flow-group .vibe-toggle-btn svg { width:14px; height:14px; }

/* Layout split — matrix left, controls right */
.vibe-layout-split { display:flex; gap:12px; align-items:flex-start; margin-top:6px; }
.vibe-layout-left { flex:1; min-width:0; }
.vibe-layout-right { flex:1; min-width:0; display:flex; flex-direction:column; gap:4px; }
.vibe-gap-row { margin-top:4px; align-items:center; }
.vibe-gap-label { font-family:var(--v-font); font-size:11px; color:var(--v-text-secondary); white-space:nowrap; flex-shrink:0; margin-right:4px; }
.vibe-gap-input-row .vibe-stepper-input { flex:1; width:auto; }
.vibe-gap-input-row.disabled { opacity:0.35; pointer-events:none; }

/* Checkbox labels (Reverse order / Wrap items) */
.vibe-check-label { display:flex; align-items:center; gap:6px; cursor:pointer; font-family:var(--v-font); font-size:11px; color:var(--v-text-secondary); white-space:nowrap; user-select:none; padding:4px 0; }
.vibe-check-label input[type="checkbox"] { appearance:none; -webkit-appearance:none; width:14px; height:14px; margin:0; border:1.5px solid var(--v-text-secondary); border-radius:3px; background:none; cursor:pointer; flex-shrink:0; position:relative; transition:background .12s, border-color .12s; }
.vibe-check-label input[type="checkbox"]:checked { background:var(--v-accent); border-color:var(--v-accent); }
.vibe-check-label input[type="checkbox"]:checked::after { content:''; position:absolute; left:3.5px; top:1px; width:4px; height:7px; border:solid #fff; border-width:0 1.5px 1.5px 0; transform:rotate(45deg); }

/* 3×3 alignment matrix */
.vibe-align-matrix { display:grid; grid-template-columns:repeat(3,1fr); gap:2px; border:1px solid var(--v-outline); border-radius:var(--v-radius-sm); overflow:hidden; background:var(--v-textarea-bg); padding:3px; width:100%; }
.vibe-matrix-cell { height:18px; display:flex; align-items:center; justify-content:center; background:none; border:none; border-radius:3px; cursor:pointer; padding:0; transition:background .12s; }
.vibe-matrix-cell:hover { background:var(--v-surface-hover); }
.vibe-matrix-cell.active { background:var(--v-surface-hover); }
.vibe-matrix-dot { width:4px; height:4px; border-radius:50%; background:var(--v-text-secondary); opacity:0.5; transition:all .12s; }
.vibe-matrix-cell.active .vibe-matrix-dot { background:var(--v-accent); opacity:1; transform:scale(1.4); }

/* T/R/B/L labels */
.vibe-design-icon-label { display:flex; align-items:center; justify-content:center; color:var(--v-text-secondary); font-family:var(--v-font-mono); font-size:9px; font-weight:600; width:12px; flex-shrink:0; }
.vibe-design-icon-label-wide { width:auto; }

/* Color picker */
.vibe-color-row { display:flex; align-items:center; gap:6px; }
.vibe-color-swatch { width:20px; height:20px; border-radius:4px; border:1px solid var(--v-outline); cursor:pointer; padding:0; flex-shrink:0; position:relative; }
.vibe-color-swatch:hover { border-color:var(--v-outline-highlight); }
.vibe-color-input { width:70px; height:22px; border:1px solid var(--v-outline); border-radius:var(--v-radius-xs); background:var(--v-textarea-bg); font-family:var(--v-font-mono); font-size:10px; color:var(--v-text-primary); padding:0 6px; outline:none; }
.vibe-color-input:focus { border-color:var(--v-accent); }
.vibe-color-input-inline { width:58px; }

/* Color palette dropdown */
.vibe-color-palette { position:absolute; bottom:calc(100% + 4px); left:0; background:var(--v-surface); border:1px solid var(--v-outline); border-radius:var(--v-radius-sm); padding:6px; display:grid; grid-template-columns:repeat(auto-fill,22px); gap:4px; z-index:10; box-shadow:0 4px 12px rgba(0,0,0,.12); min-width:120px; max-width:240px; }
.vibe-color-palette-swatch { width:22px; height:22px; border-radius:4px; border:1px solid var(--v-outline); cursor:pointer; padding:0; transition:transform .1s; }
.vibe-color-palette-swatch:hover { transform:scale(1.15); border-color:var(--v-outline-highlight); }
.vibe-color-palette-swatch.active { outline:2px solid var(--v-accent); outline-offset:1px; }
.vibe-color-palette-empty { font-size:11px; color:var(--v-text-secondary); padding:4px; grid-column:1/-1; }

/* Warning bar */
.vibe-warning {
  display: flex;
  align-items: center;
  gap: 8px;
  margin: 8px 14px;
  padding: 8px 10px;
  background: var(--v-warning-container);
  border-radius: 6px;
  font-size: 12px;
  color: var(--v-on-warning-container);
}

.vibe-warning svg {
  width: 16px;
  height: 16px;
  flex-shrink: 0;
}

/* Textarea */
.vibe-popover-body {
  padding: 10px 14px;
}

.vibe-input-wrap {
  position: relative;
}

.vibe-textarea {
  width: 100%;
  min-height: 72px;
  padding: 10px;
  border: 1px solid var(--v-outline);
  border-radius: var(--v-radius-sm);
  background: var(--v-textarea-bg);
  color: var(--v-text-primary);
  font-family: var(--v-font);
  font-size: 13px;
  line-height: 1.45;
  resize: vertical;
  transition: border-color 0.15s ease, background 0.15s ease;
}

.vibe-textarea:focus {
  outline: none;
  border-color: var(--v-highlight);
  background: var(--v-surface-hover);
}

.vibe-textarea::placeholder {
  color: var(--v-text-secondary);
}

.vibe-kbd-hint {
  position: absolute;
  bottom: 6px;
  right: 8px;
  font-size: 10px;
  color: var(--v-text-secondary);
  opacity: 0.7;
  pointer-events: none;
}

/* Actions footer */
.vibe-popover-footer {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 8px 14px 12px;
  gap: 8px;
}
.vibe-footer-left {
  display: flex;
  align-items: center;
  gap: 6px;
}
.vibe-footer-right {
  display: flex;
  align-items: center;
  gap: 8px;
}
.vibe-viewport-info {
  display: flex;
  align-items: center;
  gap: 3px;
  font-size: 11px;
  color: var(--v-text-secondary);
  font-family: var(--v-font-mono);
  white-space: nowrap;
}
.vibe-viewport-info svg { flex-shrink: 0; }

/* ===== Buttons ===== */
.vibe-btn {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  gap: 6px;
  padding: 7px 16px;
  border-radius: var(--v-radius-full);
  font-family: var(--v-font);
  font-size: 13px;
  font-weight: 500;
  cursor: pointer;
  border: none;
  transition: background 0.15s ease, opacity 0.15s ease, color 0.15s ease;
  user-select: none;
}

.vibe-btn svg {
  width: 16px;
  height: 16px;
}

.vibe-btn-primary {
  background: var(--v-pill-gradient);
  color: #fff;
}

.vibe-btn-primary:hover { opacity: 0.88; }

.vibe-btn-primary:disabled {
  background: var(--v-text-secondary);
  color: var(--v-surface);
  cursor: not-allowed;
  opacity: 0.4;
}

.vibe-btn-secondary {
  background: transparent;
  color: var(--v-text-secondary);
}

.vibe-btn-secondary:hover {
  color: var(--v-text-primary);
}

.vibe-btn-icon {
  background: transparent;
  color: var(--v-text-secondary);
  padding: 6px;
  border: none;
  border-radius: var(--v-radius-xs);
  cursor: pointer;
  display: flex;
  align-items: center;
  justify-content: center;
  transition: background 0.15s ease, color 0.15s ease;
}

.vibe-btn-icon:hover {
  color: var(--v-danger);
  background: var(--v-danger-hover);
}

/* ===== Floating toolbar (glass dark) ===== */
.vibe-toolbar {
  position: fixed;
  top: 24px;
  right: 24px;
  display: flex;
  align-items: center;
  gap: 2px;
  background: var(--v-toolbar-bg);
  border: 1px solid var(--v-toolbar-border);
  border-radius: 12px;
  padding: 4px;
  pointer-events: auto;
  box-shadow: var(--v-toolbar-shadow);
  z-index: 50;
  user-select: none;
  cursor: default;
  transition: box-shadow 0.2s ease;
  overflow: visible;
  animation: vibe-toolbar-enter 0.25s cubic-bezier(0.4, 0, 0.2, 1) both;
}

.vibe-toolbar.exiting {
  animation: vibe-toolbar-exit 0.2s cubic-bezier(0.4, 0, 0.2, 1) both;
}

.vibe-toolbar:hover {
  box-shadow: 0 12px 40px rgba(0,0,0,0.5), 0 0 0 1px rgba(255,255,255,0.06);
}

.vibe-toolbar.dragging {
  cursor: grabbing;
  box-shadow: 0 16px 48px rgba(0,0,0,0.6), 0 0 0 1px rgba(255,255,255,0.08);
}

/* Toolbar logo */
.vibe-toolbar-logo {
  width: 22px;
  height: 22px;
  border-radius: 5px;
  flex-shrink: 0;
  pointer-events: none;
  margin: 0 4px;
}

/* Toolbar separator */
.vibe-toolbar-separator {
  width: 1px;
  height: 18px;
  background: var(--v-separator);
  margin: 0 2px;
  flex-shrink: 0;
}

/* Toolbar spacer (between pill and next button) */
.vibe-toolbar-spacer {
  width: 8px;
  flex-shrink: 0;
}

/* Labeled toolbar buttons */
.vibe-toolbar-btn {
  display: flex;
  align-items: center;
  gap: 5px;
  padding: 6px 8px;
  border-radius: 8px;
  border: none;
  background: transparent;
  color: var(--v-toolbar-text);
  font: 500 13px/1 var(--v-font);
  white-space: nowrap;
  cursor: pointer;
  transition: background 0.15s ease, color 0.15s ease;
  position: relative;
}

.vibe-toolbar-btn:hover {
  background: var(--v-toolbar-btn-hover);
  color: var(--v-toolbar-text-active);
}

.vibe-toolbar-btn.active {
  background: var(--v-toolbar-btn-active);
  color: var(--v-toolbar-text-active);
}

.vibe-toolbar-btn svg {
  width: 14px;
  height: 14px;
  flex-shrink: 0;
}

.vibe-toolbar-btn:disabled {
  opacity: 0.35;
  cursor: not-allowed;
}

.vibe-toolbar-btn:disabled:hover {
  background: transparent;
  color: var(--v-toolbar-text);
}

/* Close button */
.vibe-toolbar-close {
  display: flex;
  align-items: center;
  justify-content: center;
  width: 28px;
  height: 28px;
  border-radius: 8px;
  border: none;
  background: transparent;
  color: var(--v-close-icon);
  cursor: pointer;
  transition: color 0.15s ease, background 0.15s ease;
}

.vibe-toolbar-close:hover {
  color: var(--v-toolbar-text);
  background: var(--v-toolbar-btn-hover);
}

.vibe-toolbar-close svg {
  width: 14px;
  height: 14px;
}

/* Count pill (gradient badge on View all) */
.vibe-toolbar-pill {
  position: absolute;
  top: -3px;
  right: -4px;
  min-width: 16px;
  height: 16px;
  border-radius: 9px;
  background: var(--v-badge-bg);
  color: #fff;
  font: 600 10px/1 var(--v-font);
  display: flex;
  align-items: center;
  justify-content: center;
  padding: 0 4px;
  pointer-events: none;
}

/* MCP status in toolbar */
.vibe-toolbar-status {
  display: flex;
  align-items: center;
  justify-content: center;
  width: 28px;
  height: 28px;
  padding: 0;
  border-radius: 8px;
  border: none;
  background: transparent;
  cursor: pointer;
  transition: background 0.15s ease;
}

.vibe-toolbar-status:hover {
  background: var(--v-toolbar-btn-hover);
}

.vibe-toolbar-status svg {
  width: 13px;
  height: 13px;
  flex-shrink: 0;
}

/* Default vs Annotating mode containers */
/* Annotating mode morph — the middle section crossfades + width transitions */
.vibe-toolbar-middle {
  position: relative;
  display: flex;
  align-items: center;
  overflow: visible;
}

.vibe-toolbar-default,
.vibe-toolbar-annotating {
  display: flex;
  align-items: center;
  white-space: nowrap;
  /* Opacity transitions are driven by JS for precise sequencing */
}

.vibe-toolbar-default {
  position: relative;
}

.vibe-toolbar-annotating {
  opacity: 0;
  position: absolute;
  left: 0;
  top: 50%;
  transform: translateY(-50%);
  pointer-events: none;
  gap: 6px;
}

.vibe-toolbar.annotating .vibe-toolbar-default {
  opacity: 0;
  visibility: hidden;
  height: 0;
  overflow: hidden;
  position: absolute;
  pointer-events: none;
}

.vibe-toolbar.annotating .vibe-toolbar-annotating {
  opacity: 1;
  position: relative;
  left: auto;
  top: auto;
  transform: none;
  pointer-events: auto;
}

/* Kbd elements in annotating mode */
.vibe-toolbar-kbd {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  padding: 2px 6px;
  background: var(--v-kbd-bg);
  border: 1px solid var(--v-kbd-border);
  border-radius: 5px;
  font: 500 11px/1 var(--v-font-mono);
  color: var(--v-toolbar-text);
}

.vibe-toolbar-instruction {
  font: 450 12px/1 var(--v-font);
  color: var(--v-instruction-text);
}

.vibe-toolbar-dot {
  width: 3px;
  height: 3px;
  border-radius: 50%;
  background: var(--v-dot-separator);
  flex-shrink: 0;
}

/* MCP status dot (settings dropdown) */
.vibe-status-dot {
  width: 8px;
  height: 8px;
  border-radius: 50%;
  display: inline-block;
  flex-shrink: 0;
}

.vibe-status-dot.online  { background: var(--v-status-online); }
.vibe-status-dot.offline { background: var(--v-status-offline); }

/* ===== View All panel ===== */
.vibe-viewall-panel {
  position: absolute;
  top: calc(100% + 8px);
  right: 0;
  width: 100%;
  min-width: 340px;
  max-height: min(calc(100vh - 120px), 500px);
  overflow-y: auto;
  background: var(--v-panel-bg);
  border: 1px solid var(--v-toolbar-border);
  border-radius: 12px;
  box-shadow: var(--v-panel-shadow);
  animation: vibe-slide-up 0.15s ease forwards;
  pointer-events: auto;
  z-index: 100;
}

.vibe-viewall-panel.above {
  top: auto;
  bottom: calc(100% + 8px);
  animation-name: vibe-slide-down;
}

.vibe-viewall-header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 14px 16px 12px 16px;
  border-bottom: 1px solid rgba(255,255,255,0.06);
}

.vibe-viewall-url {
  color: var(--v-toolbar-text-active);
  font: 500 12px/1 var(--v-font-mono);
}

.vibe-viewall-actions {
  display: flex;
  align-items: center;
  gap: 4px;
}

.vibe-viewall-actions button {
  display: flex;
  align-items: center;
  justify-content: center;
  width: 26px;
  height: 26px;
  border-radius: 6px;
  border: none;
  background: transparent;
  color: var(--v-close-icon);
  cursor: pointer;
  transition: color 0.15s ease, background 0.15s ease;
}

.vibe-viewall-actions button:hover {
  color: var(--v-toolbar-text);
  background: var(--v-toolbar-btn-hover);
}

.vibe-viewall-actions button.vibe-viewall-deleteall:hover {
  color: var(--v-danger);
}

.vibe-viewall-actions button svg {
  width: 13px;
  height: 13px;
}

/* Route group */
.vibe-viewall-route-header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 10px 16px 6px 16px;
}

.vibe-viewall-route-left {
  display: flex;
  align-items: center;
  gap: 6px;
}

.vibe-viewall-route-path {
  color: var(--v-text-secondary);
  font: 500 11px/1 var(--v-font-mono);
  letter-spacing: 0.02em;
}

.vibe-viewall-route-count {
  padding: 0 5px;
  background: rgba(255,255,255,0.05);
  border-radius: 8px;
  color: var(--v-dot-separator);
  font: 500 10px/18px var(--v-font);
}

.vibe-viewall-route-clear {
  display: flex;
  align-items: center;
  justify-content: center;
  width: 22px;
  height: 22px;
  padding: 0;
  border-radius: 5px;
  border: none;
  background: transparent;
  color: var(--v-close-icon);
  cursor: pointer;
  opacity: 0;
  transition: opacity 0.15s ease, color 0.15s ease, background 0.15s ease;
}

.vibe-viewall-route-header:hover .vibe-viewall-route-clear {
  opacity: 1;
}

.vibe-viewall-route-clear:hover {
  color: var(--v-danger);
  background: var(--v-toolbar-btn-hover);
}

.vibe-viewall-route-clear svg {
  width: 12px;
  height: 12px;
}

/* Annotation card */
.vibe-viewall-card {
  display: flex;
  align-items: flex-start;
  justify-content: space-between;
  padding: 8px 16px;
  border-bottom: 1px solid rgba(255,255,255,0.04);
  transition: background 0.1s ease;
  overflow: hidden;
}

.vibe-viewall-card.deleting {
  animation: vibe-card-exit 0.3s cubic-bezier(0.4, 0, 0.2, 1) forwards;
  pointer-events: none;
}

.vibe-viewall-card:hover {
  background: var(--v-card-hover);
}

.vibe-viewall-card-content {
  display: flex;
  flex-direction: column;
  gap: 3px;
  flex: 1;
  min-width: 0;
}

.vibe-viewall-selector {
  color: var(--v-text-secondary);
  font: 400 10.5px/1.3 var(--v-font-mono);
}

.vibe-viewall-comment {
  color: var(--v-toolbar-text);
  font: 450 12.5px/1.4 var(--v-font);
}

.vibe-viewall-comment.empty {
  color: var(--v-muted-text);
  font-style: italic;
  font-size: 11px;
}

.vibe-viewall-design {
  display: flex;
  align-items: center;
  gap: 5px;
  color: var(--v-design-change);
  font: 500 12px/1 var(--v-font);
}

.vibe-viewall-design svg {
  width: 12px;
  height: 12px;
  flex-shrink: 0;
}

.vibe-viewall-card-delete {
  display: flex;
  align-items: center;
  justify-content: center;
  width: 22px;
  height: 22px;
  padding: 0;
  border-radius: 5px;
  border: none;
  background: transparent;
  color: var(--v-close-icon);
  cursor: pointer;
  opacity: 0;
  transition: opacity 0.15s ease, color 0.15s ease, background 0.15s ease;
  margin-top: 1px;
  flex-shrink: 0;
}

.vibe-viewall-card:hover .vibe-viewall-card-delete {
  opacity: 1;
}

.vibe-viewall-card-delete:hover {
  color: var(--v-danger);
  background: var(--v-toolbar-btn-hover);
}

.vibe-viewall-card-delete svg {
  width: 12px;
  height: 12px;
}

/* ===== Settings dropdown ===== */
.vibe-settings-dropdown {
  position: absolute;
  top: calc(100% + 8px);
  right: 0;
  width: 100%;
  min-width: 280px;
  background: var(--v-panel-bg);
  border: 1px solid var(--v-toolbar-border);
  border-radius: 12px;
  box-shadow: var(--v-panel-shadow);
  animation: vibe-slide-up 0.15s ease forwards;
  overflow: hidden;
  pointer-events: auto;
  z-index: 100;
}

.vibe-settings-dropdown.above {
  top: auto;
  bottom: calc(100% + 10px);
  animation-name: vibe-slide-down;
}

.vibe-settings-header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 12px 14px;
  border-bottom: 1px solid var(--v-outline);
}

.vibe-settings-title {
  font-size: 13px;
  font-weight: 600;
  color: var(--v-text-primary);
  font-family: var(--v-font-mono);
}

.vibe-settings-version {
  font-size: 11px;
  color: var(--v-text-secondary);
  margin-left: 8px;
  font-weight: 400;
  text-decoration: none;
  cursor: pointer;
}
.vibe-settings-version:hover {
  text-decoration: underline;
}

.vibe-settings-header-right {
  display: flex;
  align-items: center;
  gap: 8px;
}

.vibe-theme-btn {
  background: none;
  border: none;
  padding: 4px;
  border-radius: var(--v-radius-xs);
  cursor: pointer;
  color: var(--v-text-secondary);
  display: flex;
  align-items: center;
  justify-content: center;
  transition: color 0.15s ease, background 0.15s ease;
}

.vibe-theme-btn:hover {
  color: var(--v-text-primary);
  background: var(--v-surface-hover);
}

.vibe-theme-btn svg {
  width: 16px;
  height: 16px;
}

.vibe-settings-body {
  padding: 6px 0;
  max-height: min(calc(100vh - 120px), 600px);
  overflow-y: auto;
}

.vibe-settings-item {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 8px 14px;
  font-size: 13px;
  color: var(--v-text-primary);
}

.vibe-settings-item-left {
  display: flex;
  align-items: center;
  gap: 8px;
}

.vibe-settings-item-left svg {
  width: 16px;
  height: 16px;
  color: var(--v-text-secondary);
  flex-shrink: 0;
}

.vibe-settings-item.disabled {
  opacity: 0.5;
  cursor: not-allowed;
}

.vibe-settings-link {
  display: flex;
  align-items: center;
  gap: 8px;
  padding: 8px 14px;
  font-size: 13px;
  color: var(--v-text-secondary);
  text-decoration: none;
  cursor: pointer;
  transition: color 0.15s ease, background 0.15s ease;
  border: none;
  background: none;
  width: 100%;
  text-align: left;
  font-family: var(--v-font);
}

.vibe-settings-link:hover {
  color: var(--v-text-primary);
  background: var(--v-surface-hover);
}

.vibe-settings-link svg {
  width: 16px;
  height: 16px;
  flex-shrink: 0;
}

.vibe-settings-separator {
  height: 1px;
  background: var(--v-outline);
  margin: 4px 0;
}

/* Color dot picker */
.vibe-color-dot {
  width: 18px;
  height: 18px;
  border-radius: 50%;
  border: 2px solid transparent;
  cursor: pointer;
  padding: 0;
  transition: border-color 0.15s ease;
}
.vibe-color-dot:hover {
  border-color: rgba(255,255,255,0.4);
}
.vibe-color-dot.active {
  border-color: #fff;
}

/* Get started guide */
.vibe-guide {
  padding: 8px 14px 12px;
}
.vibe-guide-section {
  margin-bottom: 12px;
}
.vibe-guide-section:last-child {
  margin-bottom: 0;
}
.vibe-guide-label {
  font-size: 12px;
  font-weight: 600;
  color: var(--v-text-primary);
  margin-bottom: 6px;
}
.vibe-guide-text {
  font-size: 12px;
  color: var(--v-text-secondary);
  line-height: 1.4;
  margin: 0 0 6px;
}
.vibe-guide-text strong {
  color: var(--v-text-primary);
  font-weight: 600;
}
.vibe-guide-cmd {
  display: flex;
  align-items: center;
  gap: 6px;
  background: var(--v-surface-2);
  border: 1px solid var(--v-outline);
  border-radius: 6px;
  padding: 6px 8px;
  margin-bottom: 6px;
}
.vibe-guide-cmd code {
  font-family: var(--v-font-mono);
  font-size: 11px;
  color: var(--v-text-primary);
  flex: 1;
  overflow-x: auto;
  white-space: nowrap;
}
.vibe-guide-copy {
  flex-shrink: 0;
  background: none;
  border: none;
  color: var(--v-text-secondary);
  cursor: pointer;
  padding: 2px;
  border-radius: 4px;
}
.vibe-guide-copy:hover {
  color: var(--v-text-primary);
}
.vibe-guide-tabs {
  display: flex;
  gap: 2px;
  margin-bottom: 8px;
  flex-wrap: wrap;
}
.vibe-guide-tab {
  font-size: 11px;
  padding: 3px 8px;
  border-radius: 4px;
  border: 1px solid var(--v-outline);
  background: none;
  color: var(--v-text-secondary);
  cursor: pointer;
  font-family: inherit;
}
.vibe-guide-tab:hover {
  color: var(--v-text-primary);
  border-color: var(--v-outline-highlight);
}
.vibe-guide-tab.active {
  background: var(--v-accent);
  color: #fff;
  border-color: var(--v-accent);
}
.vibe-guide-panel {
  display: none;
}
.vibe-guide-panel.active {
  display: block;
}

/* Toggle switch */
.vibe-toggle {
  position: relative;
  width: 32px;
  height: 18px;
  background: rgba(255,255,255,0.1);
  border-radius: 10px;
  cursor: pointer;
  transition: background 0.2s ease;
  border: none;
  padding: 0;
  flex-shrink: 0;
}

.vibe-toggle.on {
  background: var(--v-accent);
}

.vibe-toggle::after {
  content: '';
  position: absolute;
  top: 2px;
  left: 2px;
  width: 14px;
  height: 14px;
  border-radius: 50%;
  background: #71717a;
  transition: transform 0.2s ease, background 0.2s ease;
}

.vibe-toggle.on::after {
  transform: translateX(14px);
  background: #fafafa;
}

/* ===== Shortcut button ===== */
.vibe-shortcut-btn {
  background: var(--v-surface-hover);
  border: 1px solid var(--v-outline);
  border-radius: 4px;
  padding: 2px 8px;
  font-family: var(--v-font);
  font-size: 12px;
  font-weight: 500;
  color: var(--v-text-secondary);
  cursor: pointer;
  transition: border-color 0.15s, color 0.15s;
  min-width: 48px;
  text-align: center;
}
.vibe-shortcut-btn:hover { border-color: var(--v-text-secondary); color: var(--v-text-primary); }
.vibe-shortcut-btn.recording { border-color: var(--v-accent); color: var(--v-accent); }

/* ===== Target highlight (around element being annotated) ===== */
.vibe-target-highlight {
  position: fixed;
  pointer-events: none;
  border: 2px solid var(--v-highlight);
  border-radius: 3px;
  background: rgba(37, 99, 235, 0.05);
  z-index: 2;
  transition: all 0.15s ease;
}

/* ===== Confirm dialog ===== */
.vibe-confirm-backdrop {
  position: fixed;
  top: 0;
  left: 0;
  width: 100%;
  height: 100%;
  background: rgba(0,0,0,0.5);
  pointer-events: auto;
  z-index: 100;
  display: flex;
  align-items: center;
  justify-content: center;
  animation: vibe-fade-in 0.15s ease;
}

.vibe-confirm {
  background: var(--v-panel-bg);
  border: 1px solid var(--v-toolbar-border);
  border-radius: var(--v-radius-md);
  padding: 20px;
  width: 320px;
  box-shadow: var(--v-panel-shadow);
}

.vibe-confirm-title {
  font-size: 15px;
  font-weight: 600;
  color: var(--v-text-primary);
  margin-bottom: 8px;
}

.vibe-confirm-msg {
  font-size: 13px;
  color: var(--v-text-secondary);
  margin-bottom: 16px;
}

.vibe-confirm-actions {
  display: flex;
  justify-content: flex-end;
  gap: 8px;
}

.vibe-btn-danger {
  background: var(--v-danger);
  color: #fff;
}

.vibe-btn-danger:hover {
  opacity: 0.9;
}

/* Export modal scope buttons */
.vibe-export-options {
  display: flex;
  gap: 8px;
  margin-top: 12px;
}
.vibe-export-option {
  flex: 1;
  padding: 10px 12px;
  font-family: var(--v-font);
  font-size: 13px;
  font-weight: 500;
  color: var(--v-text-primary);
  background: var(--v-surface-hover);
  border: 1px solid var(--v-outline);
  border-radius: var(--v-radius-md, 8px);
  cursor: pointer;
  transition: all 0.15s ease;
  text-align: center;
  line-height: 1.3;
}
.vibe-export-option:hover {
  border-color: var(--v-text-secondary);
}

/* Primary button */
.vibe-btn-primary {
  background: var(--v-accent);
  color: #fff;
}
.vibe-btn-primary:hover {
  opacity: 0.9;
}

@media (max-width: 640px) {
  .vibe-hover-label {
    max-width: min(280px, calc(100vw - 12px));
    padding: 12px 18px;
    border-radius: var(--v-radius-sm);
  }

  .vibe-hover-label__title,
  .vibe-hover-label__meta {
    white-space: normal;
    overflow-wrap: anywhere;
  }
}
`;
