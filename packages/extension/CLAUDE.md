# Chrome Extension

Vanilla JS Chrome MV3 extension. No build step — load the `packages/extension/` directory as unpacked in Chrome.

## Architecture

```
Chrome Extension → HTTP API → vibe-annotations-server (port 3846) → MCP ← AI Coding Agents
```

### Key directories

- `content/modules/` — IIFE modules loaded via manifest.json in order. Use `var` for cross-file globals.
- `content/content.js` — Orchestrator, initializes all modules.
- `background/background.js` — Service worker: storage CRUD, API sync, badge management.
- `annotations-server/` — NPM package for the MCP server (separate install, `npm i -g vibe-annotations-server`).

### Content script module load order (matters!)

```
event-bus → styles → shadow-host → theme-manager → api-bridge →
shadow-dom-utils → element-context → badge-manager → inspection-mode →
popover-panels → annotation-popover → toolbar-docs → floating-toolbar →
bridge-handler → content.js
```

### Module responsibilities

| Module | Lines | What it does |
|--------|-------|-------------|
| `popover-panels.js` | ~1500 | Design panel builders, wirers, shared controls (extracted from popover) |
| `annotation-popover.js` | ~680 | Core popover show/dismiss/position, save/delete handlers |
| `floating-toolbar.js` | ~1370 | Toolbar UI, settings, view-all panel, clipboard, import/export, polling |
| `toolbar-docs.js` | ~420 | Documentation/guide templates for settings dropdown |
| `badge-manager.js` | ~450 | Pin rendering, DOM observer, style injection |
| `element-context.js` | ~940 | Selector generation (8-tier fallback), source mapping |
| `api-bridge.js` | ~300 | All chrome.runtime.sendMessage + chrome.storage calls |

### Storage

- **All mutations** go through `background.js` via `sendMessage()` (serialized with storage lock).
- Content scripts read directly from `chrome.storage.local` but never write.
- Background syncs bidirectionally with the server every 10 seconds.

### Shadow DOM

All overlay UI lives in a single shadow root on `<div id="vibe-annotations-root">`. This prevents host page CSS from affecting our UI and vice versa.

### Design tokens

Dark-only. Tokens defined as CSS custom properties in `styles.js` (`:host` rules). Key colors:
- `--v-accent`: `#d97757` (vibe orange)
- `--v-badge-bg`: `#D03D68` (pin/badge color, user-configurable)
- `--v-pill-gradient`: `linear-gradient(90deg, #E85B5C, #D03D68)` (buttons, active tabs)

### Annotation types

- **Element annotations**: Have `selector`, `element_context`, optional `pending_changes` (design tweaks) and `css` (rules).
- **Stylesheet annotations**: `type: 'stylesheet'`, have `css` field only, no selector. Created by agents via bridge API.

## MCP Server

```bash
npm install -g vibe-annotations-server
vibe-annotations-server start
claude mcp add --transport http vibe-annotations http://127.0.0.1:3846/mcp
```

Tools: `read_annotations`, `delete_annotation`, `watch_annotations`, `get_project_context`.

## Testing

Load unpacked in Chrome, navigate to any localhost page. No automated tests — all manual.
