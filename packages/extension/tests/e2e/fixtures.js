import { test as base, chromium, expect } from '@playwright/test';
import path from 'node:path';
import fs from 'node:fs';
import os from 'node:os';
import { execSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

export const EXTENSION_PATH = path.resolve(__dirname, '../../.output/chrome-mv3');
export const FIXTURE_ORIGIN = 'http://127.0.0.1:3005';

function ensureExtensionBuilt() {
  const manifestPath = path.join(EXTENSION_PATH, 'manifest.json');
  if (!fs.existsSync(manifestPath)) {
    console.log('[e2e] Built extension not found. Running wxt build...');
    execSync('pnpm --filter vibe-annotations-extension build', {
      cwd: path.resolve(__dirname, '../../..'),
      stdio: 'inherit'
    });
  }
}

export const test = base.extend({
  // Isolated browser context with loaded extension
  context: async ({}, use) => {
    ensureExtensionBuilt();

    const tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'vibe-e2e-profile-'));

    const launchArgs = [
      `--disable-extensions-except=${EXTENSION_PATH}`,
      `--load-extension=${EXTENSION_PATH}`,
      '--no-sandbox',
      '--disable-gpu',
    ];

    const context = await chromium.launchPersistentContext(tmpDir, {
      // Extensions need full Chromium (channel) + new headless mode; the classic
      // headless shell cannot load them. Set VIBE_E2E_HEADED=1 for a visible run.
      channel: 'chromium',
      headless: !process.env.VIBE_E2E_HEADED,
      args: launchArgs,
    });

    // Stub MCP server requests so extension runs cleanly in standalone mode
    await context.route('http://127.0.0.1:3846/**', (route) => {
      route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({ status: 'ok', annotations: [] }),
      });
    });

    await use(context);

    await context.close();

    // Clean up profile directory with retry for Windows file locks
    try {
      fs.rmSync(tmpDir, { recursive: true, force: true, maxRetries: 3, retryDelay: 100 });
    } catch (_) {
      // Best-effort cleanup
    }
  },

  page: async ({ context }, use, testInfo) => {
    const page = context.pages().length > 0 ? context.pages()[0] : await context.newPage();
    await use(page);

    // Retain relevant event logs and fixture state on failure
    if (testInfo.status !== testInfo.expectedStatus) {
      try {
        const diagnostics = await page.evaluate(() => ({
          fixtureState: window.__FIXTURE_STATE,
          eventLog: window.__EVENT_LOG,
        }));
        await testInfo.attach('fixture-event-log', {
          body: JSON.stringify(diagnostics, null, 2),
          contentType: 'application/json',
        });
      } catch (_) {
        // Page might be already closed or navigated away
      }
    }
  },

  extensionVersion: async ({}, use) => {
    const manifest = JSON.parse(fs.readFileSync(path.join(EXTENSION_PATH, 'manifest.json'), 'utf-8'));
    await use(manifest.version);
  },

  backgroundWorker: async ({ context }, use) => {
    let [worker] = context.serviceWorkers();
    if (!worker) {
      worker = await context.waitForEvent('serviceworker');
    }
    await use(worker);
  },
});


// Helper: Enter Annotate mode via toolbar button
export async function enterAnnotateMode(page) {
  const vibeRoot = page.locator('#vibe-annotations-root');
  const annotateBtn = vibeRoot.locator('.vibe-tb-annotate');
  await expect(annotateBtn).toBeVisible({ timeout: 10000 });
  await annotateBtn.click();
  await expect(page.locator('style[data-vibe-cursor]')).toBeAttached({ timeout: 3000 });
  return vibeRoot;
}

// Helper: Open popover by clicking on host target rectangle
export async function openPopover(page) {
  const vibeRoot = page.locator('#vibe-annotations-root');
  const rect = page.locator('#canvas-rect');
  await rect.click();

  const popover = vibeRoot.locator('.vibe-popover');
  await expect(popover).toBeVisible({ timeout: 5000 });

  const textarea = popover.locator('.vibe-textarea');
  await expect(textarea).toBeFocused();
  return { popover, textarea };
}

// Helper: Dispatch keyboard down -> repeat -> up using Chrome DevTools Protocol
export async function dispatchKeyWithRepeat(page, key, code, windowsVirtualKeyCode) {
  const cdp = await page.context().newCDPSession(page);
  // 1. Initial keydown
  await cdp.send('Input.dispatchKeyEvent', {
    type: 'rawKeyDown',
    key,
    code,
    windowsVirtualKeyCode,
  });
  // 2. Repeat keydown
  await cdp.send('Input.dispatchKeyEvent', {
    type: 'rawKeyDown',
    key,
    code,
    windowsVirtualKeyCode,
    autoRepeat: true,
  });
  // 3. Keyup
  await cdp.send('Input.dispatchKeyEvent', {
    type: 'keyUp',
    key,
    code,
    windowsVirtualKeyCode,
  });
}

// Helper: Start browsing an IME composition through the browser's own input
// protocol (CDP), which inserts composition text in the renderer without
// fabricating DOM events. Returns the CDP session for later commit/abort.
export async function startComposition(page, text) {
  const cdp = await page.context().newCDPSession(page);
  await cdp.send('Input.imeSetComposition', {
    text,
    selectionStart: text.length,
    selectionEnd: text.length,
  });
  return cdp;
}

// Helper: Update the active composition string (candidate list navigation)
export async function updateComposition(cdp, text) {
  await cdp.send('Input.imeSetComposition', {
    text,
    selectionStart: text.length,
    selectionEnd: text.length,
  });
}

// Helper: Confirm the active composition (candidate window confirmation)
export async function commitComposition(cdp, text) {
  await cdp.send('Input.insertText', { text });
}

// Helper: Record the composition/input pipeline events the annotation editor
// receives into window.__IME_LOG so tests can prove they stay native.
export async function instrumentEditor(page) {
  await page.evaluate(() => {
    const root = document.querySelector('#vibe-annotations-root').shadowRoot;
    const ta = root.querySelector('.vibe-textarea');
    window.__IME_LOG = [];
    const record = (e) => window.__IME_LOG.push({
      type: e.type,
      data: e.data ?? null,
      inputType: e.inputType || null,
      isComposing: e.isComposing ?? null,
      isTrusted: e.isTrusted,
    });
    for (const type of ['compositionstart', 'compositionupdate', 'compositionend', 'beforeinput', 'input']) {
      ta.addEventListener(type, record);
    }
  });
}

export async function readImeLog(page) {
  return page.evaluate(() => window.__IME_LOG);
}

export { expect };

// --- Injection-path harness (A16) ---

const FIXTURE_DIR = path.join(__dirname, '..', 'fixtures');

// Serve the repository fixtures from a controlled origin (fulfilled by the test
// runner, so no DNS is needed) and give every injection-path test its own isolated
// origin and profile. Any file in tests/fixtures is reachable by name, which lets a
// single origin serve both the standalone page and the framed page with its frames.
// The host is inside the extension's declared test/localhost host permissions — the
// only origins a test profile can reach without answering the native permission
// bubble (see docs/e2e-testing.md).
export async function routeControlledOrigin(context, origin) {
  await context.route(`${origin}/**`, async (route) => {
    const pathname = new URL(route.request().url()).pathname;
    const name = pathname === '/' ? 'selected-rectangle.html' : path.basename(pathname);
    const filePath = path.join(FIXTURE_DIR, name);

    if (!filePath.startsWith(FIXTURE_DIR) || !fs.existsSync(filePath)) {
      await route.fulfill({ status: 404, contentType: 'text/plain', body: 'Not Found' });
      return;
    }

    await route.fulfill({
      status: 200,
      contentType: path.extname(filePath).toLowerCase() === '.js'
        ? 'application/javascript; charset=UTF-8'
        : 'text/html; charset=UTF-8',
      body: fs.readFileSync(filePath, 'utf-8'),
    });
  });
}

// The toolbar-icon click is browser UI and cannot be driven from a page, so tests
// perform the injection that chrome.action.onClicked performs on the active tab:
// seed a boot intent, mark the runtime injection, then inject the production content
// scripts. Everything after that (permission modal, grant handling, dynamic
// registration) is production. The tab is found through its id only — an extension
// without the "tabs" permission cannot read tab URLs.
export async function injectContentScriptsAsToolbarIcon(backgroundWorker, { bootIntent, bootData } = {}) {
  return backgroundWorker.evaluate(async ({ bootIntent, bootData }) => {
    const tabs = await chrome.tabs.query({});
    const tab = tabs.find((t) => t.active) || tabs[0];
    if (!tab) throw new Error('No tab available for content-script injection');

    if (bootIntent) {
      await chrome.scripting.executeScript({
        target: { tabId: tab.id },
        func: (i, d) => { window.__VIBE_BOOT_INTENT = i; window.__VIBE_BOOT_DATA = d; },
        args: [bootIntent, bootData],
      });
    }
    await chrome.scripting.executeScript({
      target: { tabId: tab.id, allFrames: true },
      func: () => { window.__VIBE_LATE_INJECTION = true; },
    });
    await chrome.scripting.executeScript({
      target: { tabId: tab.id, allFrames: true },
      files: ['content-scripts/content.js'],
    });
    await chrome.scripting.executeScript({
      target: { tabId: tab.id },
      files: ['content-scripts/bridge.js'],
      world: 'MAIN',
    });
    return tab.id;
  }, { bootIntent, bootData });
}

// Keyboard install evidence published by the content script on its shadow host.
export async function readKeyboardEvidence(page) {
  return page.evaluate(() => {
    const host = document.querySelector('#vibe-annotations-root');
    if (!host) return null;
    return {
      world: host.getAttribute('data-vibe-keyboard-world'),
      runAt: host.getAttribute('data-vibe-keyboard-run-at'),
      installedAt: Number(host.getAttribute('data-vibe-keyboard-installed-at')),
      earlyCapture: host.getAttribute('data-vibe-keyboard-early-capture') === 'true',
      lateInjection: host.getAttribute('data-vibe-keyboard-late-injection') === 'true',
    };
  });
}

// --- Frame-session harness (A15) ---

export const CROSS_ORIGIN = 'http://localhost:3005';
// Outside every declared host permission, so no content script is ever injected
// there: the frame the extension must NOT represent as protected.
export const UNLISTED_ORIGIN = 'http://vibe-unlisted.invalid:3005';

// The session evidence each frame publishes on its own shadow host: whether the
// frame participates in an Annotate session, and whether its state machine is the
// authoritative one or mirrors another frame's.
export async function readSessionEvidence(target) {
  return target.evaluate(() => {
    const host = document.querySelector('#vibe-annotations-root');
    if (!host) return null;
    return {
      state: host.getAttribute('data-vibe-session-state'),
      mirror: host.getAttribute('data-vibe-session-mirror') === 'true',
      cursor: !!document.querySelector('style[data-vibe-cursor]'),
      overlay: !!document.querySelector('#vibe-annotations-root'),
    };
  });
}

// Route the framed fixture (and its child frames) for one top origin, including the
// authorized cross-origin host and the unlisted host. Frame origins are passed to the
// fixture so the same file can serve any controlled top origin.
export async function routeFramedFixture(context, topOrigin, {
  sameOrigin = '',
  crossOrigin = CROSS_ORIGIN,
  unlistedOrigin = UNLISTED_ORIGIN,
} = {}) {
  await routeControlledOrigin(context, topOrigin);
  if (crossOrigin) await routeControlledOrigin(context, crossOrigin);
  if (unlistedOrigin) await routeControlledOrigin(context, unlistedOrigin);
}

export function framedFixtureUrl(topOrigin, origins = {}) {
  const params = new URLSearchParams();
  if (origins.sameOrigin) params.set('sameOrigin', origins.sameOrigin);
  if (origins.crossOrigin) params.set('crossOrigin', origins.crossOrigin);
  if (origins.unlistedOrigin) params.set('unlistedOrigin', origins.unlistedOrigin);
  const query = params.toString();
  return `${topOrigin}/framed-annotate.html${query ? `?${query}` : ''}`;
}

// The named child frames of the framed fixture, once each of them has parsed its own
// document. Playwright addresses frames by the iframe `name` attribute.
export async function waitForFixtureFrames(page) {
  const frames = {};
  const names = { 'same-origin': 'sameOrigin', 'cross-origin': 'crossOrigin', unlisted: 'unlisted' };

  for (const [name, key] of Object.entries(names)) {
    await page.frameLocator(`iframe[name="${name}"]`).locator('#canvas-rect')
      .waitFor({ state: 'attached', timeout: 15000 });
    const frame = page.frame({ name });
    if (!frame) throw new Error(`Fixture frame "${name}" did not attach`);
    frames[key] = frame;
  }
  return frames;
}

// Per-frame host observables: the counters and full event journal the fixture
// records, so isolation can be asserted inside the frame that has focus.
export async function readFrameFixtureState(frame) {
  return frame.evaluate(() => ({
    state: window.__FIXTURE_STATE,
    log: window.__EVENT_LOG,
  }));
}

