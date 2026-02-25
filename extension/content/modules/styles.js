// All Vibe Annotations V2 CSS as a JS constant
// Loaded synchronously into the shadow root — no async fetch needed

var VIBE_STYLES = `
/* ===== Reset inside shadow ===== */
*, *::before, *::after {
  box-sizing: border-box;
  margin: 0;
  padding: 0;
}

/* ===== Theme tokens (light default) ===== */
:host {
  --v-surface: #f8f9fc;
  --v-surface-1: #fcfcfd;
  --v-text-primary: #0c111b;
  --v-text-secondary: #697586;
  --v-outline: #00000014;
  --v-outline-highlight: #00000028;
  --v-accent: #d97757;
  --v-on-accent: #ffffff;
  --v-surface-hover: #0d0f1c14;
  --v-secondary-btn-bg: #0000000d;
  --v-textarea-bg: #0000000d;
  --v-warning: #f79009;
  --v-on-warning: #ffffff;
  --v-warning-container: #f7900919;
  --v-on-warning-container: #93370c;
  --v-danger: #dc2626;
  --v-danger-hover: #dc26260d;
  --v-highlight: #2563eb;
  --v-badge-bg: #4b5563;
  --v-tooltip-bg: #111827;
  --v-primary-btn: #4f5d75;

  --v-font: 'Inter', -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
  --v-font-mono: 'SF Mono', Monaco, Inconsolata, 'Fira Code', monospace;

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
@keyframes vibe-fade-in {
  from { opacity: 0; transform: scale(0.96); }
  to   { opacity: 1; transform: scale(1); }
}

@keyframes vibe-slide-up {
  from { opacity: 0; transform: translateY(8px); }
  to   { opacity: 1; transform: translateY(0); }
}

@keyframes vibe-toast-in {
  from { opacity: 0; transform: translateX(20px); }
  to   { opacity: 1; transform: translateX(0); }
}

@keyframes vibe-toast-out {
  from { opacity: 1; transform: translateX(0); }
  to   { opacity: 0; transform: translateX(20px); }
}

@keyframes vibe-pulse {
  0%, 100% { transform: scale(1); }
  50% { transform: scale(1.15); }
}

/* ===== Inspection highlight overlay ===== */
.vibe-highlight {
  position: fixed;
  pointer-events: none;
  border: 2px solid var(--v-highlight);
  border-radius: 2px;
  background: rgba(37, 99, 235, 0.06);
  transition: all 0.1s ease;
  z-index: 1;
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
}

.vibe-popover {
  pointer-events: auto;
  width: 340px;
  background: var(--v-surface-1);
  border: 1px solid var(--v-outline);
  border-radius: var(--v-radius-md);
  box-shadow: 0 8px 32px rgba(0,0,0,0.16), 0 2px 8px rgba(0,0,0,0.08);
  animation: vibe-slide-up 0.2s ease forwards;
  overflow: hidden;
}

/* Collapsible element details */
.vibe-element-toggle {
  display: flex;
  align-items: center;
  gap: 6px;
  padding: 10px 14px;
  background: none;
  border: none;
  border-bottom: 1px solid var(--v-outline);
  width: 100%;
  cursor: pointer;
  color: var(--v-text-secondary);
  font-family: var(--v-font-mono);
  font-size: 12px;
  transition: color 0.15s ease;
}

.vibe-element-toggle:hover {
  color: var(--v-text-primary);
}

.vibe-element-toggle svg {
  width: 12px;
  height: 12px;
  transition: transform 0.2s ease;
  flex-shrink: 0;
}

.vibe-element-toggle.open svg {
  transform: rotate(90deg);
}

.vibe-element-props {
  display: none;
  padding: 10px 14px;
  border-bottom: 1px solid var(--v-outline);
  background: var(--v-textarea-bg);
}

.vibe-element-props.open {
  display: block;
}

.vibe-element-props pre {
  font-family: var(--v-font-mono);
  font-size: 12px;
  line-height: 1.6;
  color: var(--v-text-secondary);
  white-space: pre-wrap;
  word-break: break-word;
}

.vibe-element-props .prop-name {
  color: #c4b5fd;
}

.vibe-element-props .prop-val {
  color: var(--v-text-primary);
}

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
  justify-content: flex-end;
  padding: 8px 14px 12px;
  gap: 8px;
}

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
  background: linear-gradient(135deg, #dc2626, #d97757);
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

/* ===== Floating toolbar ===== */
.vibe-toolbar {
  position: fixed;
  bottom: 24px;
  right: 24px;
  display: flex;
  align-items: center;
  gap: 2px;
  background: var(--v-surface-1);
  border: 1px solid var(--v-outline);
  border-radius: var(--v-radius-full);
  padding: 4px;
  pointer-events: auto;
  box-shadow: 0 4px 24px rgba(0,0,0,0.12), 0 1px 4px rgba(0,0,0,0.06);
  z-index: 50;
  user-select: none;
  cursor: default;
  transition: box-shadow 0.2s ease;
}

.vibe-toolbar:hover {
  box-shadow: 0 6px 32px rgba(0,0,0,0.16), 0 2px 6px rgba(0,0,0,0.08);
}

.vibe-toolbar.dragging {
  cursor: grabbing;
  box-shadow: 0 8px 40px rgba(0,0,0,0.2), 0 2px 8px rgba(0,0,0,0.1);
}

.vibe-toolbar.dragging .vibe-toolbar-drag-handle {
  cursor: grabbing;
}

.vibe-toolbar-btn {
  display: flex;
  align-items: center;
  justify-content: center;
  width: 34px;
  height: 34px;
  border-radius: 50%;
  border: none;
  background: transparent;
  color: var(--v-text-secondary);
  cursor: pointer;
  transition: background 0.15s ease, color 0.15s ease;
  position: relative;
}

.vibe-toolbar-btn:hover {
  background: var(--v-surface-hover);
  color: var(--v-text-primary);
}

.vibe-toolbar-btn.active {
  background: var(--v-accent);
  color: var(--v-on-accent);
}

.vibe-toolbar-btn.active:hover {
  opacity: 0.9;
}

.vibe-toolbar-btn svg {
  width: 18px;
  height: 18px;
}

.vibe-toolbar-btn:disabled {
  opacity: 0.35;
  cursor: not-allowed;
}

.vibe-toolbar-btn:disabled:hover {
  background: transparent;
  color: var(--v-text-secondary);
}

/* Toolbar divider */
.vibe-toolbar-divider {
  width: 1px;
  height: 20px;
  background: var(--v-outline);
  margin: 0 2px;
}

/* Drag handle */
.vibe-toolbar-drag-handle {
  width: 8px;
  height: 24px;
  margin: 0 4px;
  cursor: grab;
  position: relative;
  display: flex;
  align-items: center;
  justify-content: center;
  border-radius: 2px;
  transition: background 0.15s ease;
}

.vibe-toolbar-drag-handle:hover {
  background: var(--v-surface-hover);
}

.vibe-toolbar-drag-handle::before {
  content: '';
  width: 4px;
  height: 14px;
  background-image: radial-gradient(circle, var(--v-text-secondary) 1px, transparent 1px);
  background-size: 4px 4px;
  opacity: 0.5;
}

.vibe-toolbar-drag-handle:hover::before {
  opacity: 0.8;
}

/* MCP status dot */
.vibe-status-dot {
  width: 8px;
  height: 8px;
  border-radius: 50%;
  display: inline-block;
  flex-shrink: 0;
}

.vibe-status-dot.online  { background: #10b981; }
.vibe-status-dot.offline { background: #ef4444; }

.vibe-toolbar-inner {
  display: flex;
  align-items: center;
  gap: 2px;
}

/* Collapsed toolbar */
.vibe-toolbar.collapsed {
  padding: 4px;
  border-radius: 50%;
}

.vibe-toolbar.collapsed .vibe-tb-collapse {
  width: 34px;
  height: 34px;
  overflow: hidden;
  border-radius: 50%;
}

.vibe-toolbar.collapsed .vibe-tb-collapse img {
  width: 26px;
  height: 26px;
}

.vibe-toolbar.collapsed .vibe-toolbar-inner {
  display: none;
}

/* Toolbar badge count */
.vibe-toolbar-count {
  position: absolute;
  top: -2px;
  right: -2px;
  min-width: 16px;
  height: 16px;
  border-radius: 8px;
  background: var(--v-accent);
  color: var(--v-on-accent);
  font-size: 10px;
  font-weight: 700;
  display: flex;
  align-items: center;
  justify-content: center;
  padding: 0 4px;
}

/* Toolbar tooltip */
.vibe-toolbar-tip {
  position: absolute;
  bottom: calc(100% + 8px);
  left: 50%;
  transform: translateX(-50%);
  background: var(--v-tooltip-bg);
  color: #fff;
  padding: 4px 8px;
  border-radius: 4px;
  font-size: 11px;
  white-space: nowrap;
  pointer-events: none;
  opacity: 0;
  visibility: hidden;
  transition: opacity 0.15s ease, visibility 0.15s ease;
}

.vibe-toolbar-btn:hover .vibe-toolbar-tip {
  opacity: 1;
  visibility: visible;
}

/* ===== Settings dropdown ===== */
.vibe-settings-dropdown {
  position: absolute;
  bottom: calc(100% + 10px);
  right: 0;
  width: 280px;
  background: var(--v-surface-1);
  border: 1px solid var(--v-outline);
  border-radius: var(--v-radius-md);
  box-shadow: 0 8px 32px rgba(0,0,0,0.18), 0 2px 8px rgba(0,0,0,0.08);
  animation: vibe-slide-up 0.15s ease forwards;
  overflow: hidden;
  pointer-events: auto;
  z-index: 100;
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

/* Toggle switch */
.vibe-toggle {
  position: relative;
  width: 36px;
  height: 20px;
  background: var(--v-outline-highlight);
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
  width: 16px;
  height: 16px;
  border-radius: 50%;
  background: #fff;
  transition: transform 0.2s ease;
  box-shadow: 0 1px 3px rgba(0,0,0,0.2);
}

.vibe-toggle.on::after {
  transform: translateX(16px);
}

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
  background: rgba(0,0,0,0.3);
  pointer-events: auto;
  z-index: 100;
  display: flex;
  align-items: center;
  justify-content: center;
  animation: vibe-fade-in 0.15s ease;
}

.vibe-confirm {
  background: var(--v-surface-1);
  border: 1px solid var(--v-outline);
  border-radius: var(--v-radius-md);
  padding: 20px;
  width: 320px;
  box-shadow: 0 8px 32px rgba(0,0,0,0.2);
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
`;
