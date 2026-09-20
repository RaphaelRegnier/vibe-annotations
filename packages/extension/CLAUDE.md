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
- `../server/` — NPM package for the MCP server (separate install, `npm i -g vibe-annotations-server`). Lives at `packages/server/` in the monorepo root.

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

### Keyboard entry point & injection paths

`entrypoints/content/index.js` installs the window-capture keyboard router synchronously at `document_start`, before page scripts register their own listeners. Dynamic site registrations (`entrypoints/background.js` → `enableSite`) use the same `runAt`. A runtime injection (`chrome.scripting.executeScript` into an already-loaded page) cannot precede those listeners, so the background marks it (`__VIBE_LATE_INJECTION`), the router records install evidence (`VibeKeyboardRouter.getInstallEvidence()`), and the toolbar shows a persistent "reload for full keyboard protection" banner instead of claiming full isolation.

### Cross-frame Annotate session

The manifest content script (and the dynamic registration) run in all frames, so an Annotate session is shared by every frame the extension may control. `lib/content/keyboard-router.js` is the frame half of the protocol: it asks the tab's coordinator which session exists when it boots, publishes its own transitions, mirrors remote ones (owning the keyboard from `document_start`, driving its overlay once `onUiReady()` runs), and reports a release when the document that owns the session goes away. `lib/background/session-coordinator.js` is the tab-level half: it keeps the per-tab record and relays states through `chrome.tabs.sendMessage`, which reaches only injected frames. Each frame publishes `data-vibe-session-state` / `data-vibe-session-mirror` on its shadow host as evidence. See `docs/e2e-testing.md` §10 for the contract and its coverage boundaries.

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
# Recommended — one interactive command:
npx vibe-annotations-server init

# Or manually:
npm install -g vibe-annotations-server
vibe-annotations-server start
claude mcp add --scope user --transport http vibe-annotations http://127.0.0.1:3846/mcp
```

Tools: `read_annotations`, `delete_annotation`, `watch_annotations`, `get_project_context`.

## Testing

### Automated tests

```bash
# Unit tests (mock DOM)
pnpm test:unit
# or
node --test tests/**/*.test.js

# E2E tests (Playwright with loaded extension in Chromium)
pnpm test:e2e

# Keyboard conflict baseline scenarios
pnpm test:baseline
```

See `docs/e2e-testing.md` for environment details, browser/headless configuration, CI setup, and per-ticket coverage notes.

### Manual testing

Load unpacked in Chrome (`.output/chrome-mv3` or extension root), navigate to any localhost page.
