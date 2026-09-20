import { test, expect, FIXTURE_ORIGIN, enterAnnotateMode, openPopover } from './fixtures.js';

// Ticket #10 acceptance: recovery after lost key releases, repeated entry/exit,
// explicit overlay closure, initialization failure and page hiding/navigation.

async function readState(page) {
  return page.evaluate(() => window.__FIXTURE_STATE);
}

async function readLog(page) {
  return page.evaluate(() => window.__EVENT_LOG);
}

async function newCdpSession(page) {
  return page.context().newCDPSession(page);
}

async function sendKey(cdp, type, { key, code, windowsVirtualKeyCode, autoRepeat = false }) {
  await cdp.send('Input.dispatchKeyEvent', {
    type,
    key,
    code,
    windowsVirtualKeyCode,
    autoRepeat,
  });
}

async function escapeDown(cdp, autoRepeat = false) {
  await sendKey(cdp, 'rawKeyDown', { key: 'Escape', code: 'Escape', windowsVirtualKeyCode: 27, autoRepeat });
}

async function escapeUp(cdp) {
  await sendKey(cdp, 'keyUp', { key: 'Escape', code: 'Escape', windowsVirtualKeyCode: 27 });
}

// Reopen the overlay the way the extension popup does, through the background
// worker's own toggle message.
async function reopenOverlay(backgroundWorker) {
  await backgroundWorker.evaluate(async () => {
    const tabs = await chrome.tabs.query({});
    await Promise.all(tabs.map((tab) => chrome.tabs.sendMessage(tab.id, { action: 'toggleOverlay' }).catch(() => {})));
  });
}

// Deliver the window-blur condition the session must survive. Chromium
// re-focuses a renderer as soon as it has received synthetic input, so the blur
// is delivered as a controlled event; key input itself stays real browser input.
// See docs/e2e-testing.md for the coverage boundary of real window blur.
async function blurWindow(page) {
  await page.evaluate(() => window.dispatchEvent(new Event('blur')));
}

test.describe('Annotate Session Recovery (Ticket #10)', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto(`${FIXTURE_ORIGIN}/selected-rectangle.html`);
    await page.evaluate(() => window.__resetFixtureState());
  });

  test.describe('A12 — lost key releases across blur', () => {
    test('A key consumed before a blur cannot swallow or misattribute the next full keypress', async ({ page }) => {
      const vibeRoot = await enterAnnotateMode(page);
      await page.locator('.rect-subtitle').hover();
      await expect(vibeRoot.locator('.vibe-highlight')).toBeVisible({ timeout: 3000 });

      const cdp = await newCdpSession(page);
      await page.evaluate(() => (window.__EVENT_LOG = []));

      // ArrowDown is consumed by selection navigation and its keyup never arrives (blur)
      await sendKey(cdp, 'rawKeyDown', { key: 'ArrowDown', code: 'ArrowDown', windowsVirtualKeyCode: 40 });

      await blurWindow(page);

      // The session survived the blur and still owns the keyboard…
      await expect(page.locator('style[data-vibe-cursor]')).toBeAttached();
      await page.evaluate(() => (window.__EVENT_LOG = []));

      // …so a fresh full press of the same key is a new keystroke, never a
      // continuation of the stale held sequence, and must not be swallowed.
      await page.keyboard.press('ArrowDown');
      await page.keyboard.press('ArrowUp');

      const leakedNavigation = (await readLog(page)).filter((e) => e.key === 'ArrowDown' || e.key === 'ArrowUp');
      expect(leakedNavigation.length, 'Host must not receive consumed navigation keys').toBe(0);

      // Exiting hands the keyboard back, and the host only reacts to fresh keys
      await page.keyboard.press('Escape');
      await expect(page.locator('style[data-vibe-cursor]')).not.toBeAttached({ timeout: 5000 });

      let state = await readState(page);
      expect(state.cancelCount, 'Exit Esc must stay inside the session').toBe(0);
      expect(state.selected, 'Host selection untouched by the session').toBe(true);

      await page.keyboard.press('Escape');
      state = await readState(page);
      expect(state.cancelCount, 'A fresh keypress after the blur must reach the host').toBe(1);
      expect(state.selected, 'Host selection must follow the fresh keypress').toBe(false);
    });

    test('The release of a consumed exit key stays owned after a blur, while a new press is fresh', async ({ page }) => {
      await enterAnnotateMode(page);
      await page.locator('#canvas-rect').focus();

      const cdp = await newCdpSession(page);

      // Held Esc exits Annotate; its keyup is lost to the blur
      await escapeDown(cdp);
      await expect(page.locator('style[data-vibe-cursor]')).not.toBeAttached({ timeout: 5000 });

      await blurWindow(page);
      await page.evaluate(() => (window.__EVENT_LOG = []));

      // The release of the consumed exit keystroke still belongs to the session
      await escapeUp(cdp);
      await page.waitForTimeout(100);

      let state = await readState(page);
      expect(state.escCount, 'Stray release of a consumed exit key reached host capture listeners').toBe(0);
      expect(state.cancelCount, 'Stray release of a consumed exit key cancelled host selection').toBe(0);
      expect(state.selected, 'Host rectangle must remain selected').toBe(true);
      expect((await readLog(page)).length, 'Host listeners received the stray release').toBe(0);

      // A new full press is a fresh keystroke and is delivered end to end
      await page.keyboard.press('Escape');
      state = await readState(page);
      expect(state.cancelCount, 'Fresh Esc after the blur must deselect the rectangle').toBe(1);
      expect(state.selected).toBe(false);
    });

    test('Re-entering after a blur starts a clean session with no permanent swallowing', async ({ page }) => {
      await enterAnnotateMode(page);
      await page.locator('#canvas-rect').focus();

      const cdp = await newCdpSession(page);
      await escapeDown(cdp); // consumed exit keystroke whose release is lost
      await expect(page.locator('style[data-vibe-cursor]')).not.toBeAttached({ timeout: 5000 });

      await blurWindow(page);

      // Re-enter Annotate and exit again: isolation and exit still work exactly once
      await enterAnnotateMode(page);
      await page.evaluate(() => (window.__EVENT_LOG = []));
      await page.keyboard.press('Escape');
      await expect(page.locator('style[data-vibe-cursor]')).not.toBeAttached({ timeout: 5000 });

      const stateAfterExit = await readState(page);
      expect(stateAfterExit.cancelCount, 'Re-entry exit Esc must not reach the host').toBe(0);
      expect((await readLog(page)).length, 'Host listeners received re-entry exit keys').toBe(0);

      // A fresh key is delivered end to end
      await page.keyboard.press('Escape');
      const stateAfterFresh = await readState(page);
      expect(stateAfterFresh.cancelCount, 'Fresh Esc after re-entry must reach the host').toBe(1);
      expect(stateAfterFresh.selected).toBe(false);
    });
  });

  test.describe('A13 — idempotent cleanup across entry, closure, failure and destruction', () => {
    test('Repeated entry and exit leave no duplicate commands, saves, or lingering ownership', async ({ page }) => {
      const vibeRoot = await enterAnnotateMode(page);
      await page.locator('#canvas-rect').focus();

      // Four entry/exit cycles driven through the production toolbar button and Esc
      for (let cycle = 0; cycle < 4; cycle++) {
        await page.keyboard.press('Escape');
        await expect(page.locator('style[data-vibe-cursor]')).not.toBeAttached({ timeout: 5000 });
        const btn = vibeRoot.locator('.vibe-tb-annotate');
        await btn.click();
        await expect(page.locator('style[data-vibe-cursor]')).toBeAttached({ timeout: 5000 });
      }

      // Exit the last cycle and hand the keyboard back exactly once
      await page.keyboard.press('Escape');
      await expect(page.locator('style[data-vibe-cursor]')).not.toBeAttached({ timeout: 5000 });

      await page.evaluate(() => (window.__EVENT_LOG = []));
      await page.keyboard.press('Escape');
      let state = await readState(page);
      expect(state.cancelCount, 'Exactly one fresh Esc must reach the host after repeated cycles').toBe(1);
      expect(state.selected).toBe(false);
      const hostEscPresses = (await readLog(page)).filter((e) => e.phase === 'window-capture' && e.type === 'keydown' && e.key === 'Escape');
      expect(hostEscPresses.length, 'Exactly one fresh Esc press must reach the host').toBe(1);

      // Re-enter once more and save exactly one annotation
      await page.evaluate(() => window.__resetFixtureState());
      await enterAnnotateMode(page);
      const { textarea } = await openPopover(page);
      await textarea.fill('repeated entry save');
      const isMac = process.platform === 'darwin';
      await page.keyboard.press(isMac ? 'Meta+Enter' : 'Control+Enter');

      await expect(vibeRoot.locator('.vibe-badge')).toHaveCount(1, { timeout: 5000 });
      await expect(page.locator('style[data-vibe-cursor]')).toBeAttached();

      await page.keyboard.press('Escape');
      await expect(page.locator('style[data-vibe-cursor]')).not.toBeAttached({ timeout: 5000 });
      await expect(vibeRoot.locator('.vibe-badge')).toHaveCount(1);
    });

    test('Explicit overlay closure ends the session and leaves no lingering ownership', async ({ page, backgroundWorker }) => {
      const vibeRoot = await enterAnnotateMode(page);
      const rect = page.locator('#canvas-rect');
      await rect.focus();

      // Close the overlay with its own close button
      await vibeRoot.locator('.vibe-tb-close').click();
      await expect(vibeRoot).toBeHidden({ timeout: 5000 });

      // The Annotate session ended with the overlay
      await expect(page.locator('style[data-vibe-cursor]')).not.toBeAttached({ timeout: 5000 });

      await page.evaluate(() => (window.__EVENT_LOG = []));
      await page.keyboard.press('Escape');
      let state = await readState(page);
      expect(state.cancelCount, 'Host must own the keyboard again after overlay closure').toBe(1);
      expect(state.selected).toBe(false);

      // Reopening the overlay and entering Annotate again starts exactly one clean
      // session: nothing from the closed overlay is left behind.
      await page.evaluate(() => window.__resetFixtureState());
      await reopenOverlay(backgroundWorker);
      await expect(vibeRoot).toBeVisible({ timeout: 5000 });
      await enterAnnotateMode(page);
      await page.evaluate(() => (window.__EVENT_LOG = []));

      await page.keyboard.press('Escape');
      await expect(page.locator('style[data-vibe-cursor]')).not.toBeAttached({ timeout: 5000 });

      state = await readState(page);
      expect(state.cancelCount, 'Re-entered session exit must not reach the host').toBe(0);
      expect(state.deleteCount).toBe(0);
      expect((await readLog(page)).length, 'Host listeners received re-entered session keys').toBe(0);
    });

    test('Closure with an open editor discards it without saving or duplicating', async ({ page }) => {
      const vibeRoot = await enterAnnotateMode(page);
      const { textarea } = await openPopover(page);
      await textarea.fill('abandoned by overlay closure');

      await vibeRoot.locator('.vibe-tb-close').click();
      await expect(vibeRoot).toBeHidden({ timeout: 5000 });

      await expect(vibeRoot.locator('.vibe-popover')).toHaveCount(0);
      await expect(vibeRoot.locator('.vibe-badge')).toHaveCount(0);
      await expect(page.locator('style[data-vibe-cursor]')).not.toBeAttached({ timeout: 5000 });

      // Host keeps its own state and its own keyboard
      const state = await readState(page);
      expect(state.cancelCount).toBe(0);
      expect(state.selected).toBe(true);
      expect(state.deleted).toBe(false);
    });

    test('Page navigation terminates the session; coming back does not restore ownership', async ({ page }) => {
      await enterAnnotateMode(page);
      await page.evaluate(() => {
        window.__PAGESHOW_PERSISTED = null;
        window.addEventListener('pageshow', (e) => { window.__PAGESHOW_PERSISTED = e.persisted; });
      });
      await expect(page.locator('style[data-vibe-cursor]')).toBeAttached();

      // Real navigation away and back (bfcache restore when the browser provides it)
      await page.goto(`${FIXTURE_ORIGIN}/selected-rectangle.html?navigated=1`);
      await page.goBack();
      await page.waitForLoadState('domcontentloaded');

      // No lingering ownership on the restored page
      await expect(page.locator('style[data-vibe-cursor]')).not.toBeAttached({ timeout: 5000 });
      const persisted = await page.evaluate(() => window.__PAGESHOW_PERSISTED);
      test.info().annotations.push({ type: 'bfcache', description: `pageshow.persisted=${persisted}` });

      await page.evaluate(() => window.__resetFixtureState());
      await page.keyboard.press('Escape');
      const state = await readState(page);
      expect(state.cancelCount, 'The restored page must own its keyboard again').toBe(1);
      expect(state.selected).toBe(false);
    });

    test('Initialization failure leaves no UI, no ownership, and an untouched host page', async ({ page }) => {
      await page.goto(`${FIXTURE_ORIGIN}/selected-rectangle.html?bootFail=true`);

      // The extension did not boot
      await expect(page.locator('#vibe-annotations-root')).toHaveCount(0);
      await expect(page.locator('style[data-vibe-cursor]')).not.toBeAttached();

      // The toggle hotkey cannot acquire ownership without a working UI
      const modKey = process.platform === 'darwin' ? 'Meta' : 'Control';
      await page.keyboard.press(`${modKey}+Shift+Comma`);
      await expect(page.locator('style[data-vibe-cursor]')).not.toBeAttached({ timeout: 2000 });

      // The host page keeps full control of its keyboard
      await page.evaluate(() => (window.__EVENT_LOG = []));
      await page.keyboard.press('Backspace');
      await page.keyboard.press('Escape');

      const state = await readState(page);
      expect(state.cancelCount, 'Host must handle Escape itself').toBe(1);
      expect(state.deleteCount, 'Host must handle Backspace itself').toBe(1);
      expect((await readLog(page)).length, 'Host listeners must receive the keys').toBeGreaterThan(0);
    });
  });
});
