import { test, expect, FIXTURE_ORIGIN, enterAnnotateMode, openPopover } from './fixtures.js';

test.describe('Annotate Editing Keyboard Isolation & Return to Selection (Ticket #7)', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto(`${FIXTURE_ORIGIN}/selected-rectangle.html`);
    await page.evaluate(() => window.__resetFixtureState());
  });

  test('A3: Typing abc and pressing Backspace produces ab with no host deletion or keyboard events', async ({
    page,
  }) => {
    await enterAnnotateMode(page);
    const { textarea } = await openPopover(page);

    // Clear event log after popover opens
    await page.evaluate(() => (window.__EVENT_LOG = []));

    // Type "abc"
    await page.keyboard.type('abc');
    await expect(textarea).toHaveValue('abc');

    // Press Backspace
    await page.keyboard.press('Backspace');
    await expect(textarea).toHaveValue('ab');

    // Assert host state: no deletion, deleteCount is 0, rectangle remains selected
    const state = await page.evaluate(() => window.__FIXTURE_STATE);
    expect(state.deleteCount, 'Host deleteCount must remain 0').toBe(0);
    expect(state.deleted, 'Host rectangle must not be deleted').toBe(false);
    expect(state.selected, 'Host rectangle must remain selected').toBe(true);

    // Assert host event log: 0 keyboard events from popover editing
    const eventLog = await page.evaluate(() => window.__EVENT_LOG);
    expect(eventLog.length, 'Host listeners must receive zero events during popover typing/backspace').toBe(0);
  });

  test('A3: Backspace produces ab even with host early window capture preventDefault', async ({
    page,
  }) => {
    // Navigate with early window capture preventDefaultOnBackspace enabled
    await page.goto(`${FIXTURE_ORIGIN}/selected-rectangle.html?preventBackspace=true`);
    await page.evaluate(() => window.__resetFixtureState());

    await enterAnnotateMode(page);
    const { textarea } = await openPopover(page);

    await page.evaluate(() => (window.__EVENT_LOG = []));

    await page.keyboard.type('abc');
    await expect(textarea).toHaveValue('abc');

    await page.keyboard.press('Backspace');
    await expect(textarea).toHaveValue('ab');

    const state = await page.evaluate(() => window.__FIXTURE_STATE);
    expect(state.deleteCount).toBe(0);
    expect(state.deleted).toBe(false);

    const eventLog = await page.evaluate(() => window.__EVENT_LOG);
    expect(eventLog.length, 'Host early capture must receive zero events').toBe(0);
  });

  test('A6: Preserve native text entry, Delete, cursor movement, select-all, cut/copy/paste, undo/redo, and native input/beforeinput behavior without host commands', async ({
    page,
    context,
  }) => {
    try {
      await context.grantPermissions(['clipboard-read', 'clipboard-write']);
    } catch {}

    const hostInput = page.locator('#host-input');
    const initialHostInputValue = await hostInput.inputValue();

    await enterAnnotateMode(page);
    const { textarea } = await openPopover(page);

    await page.evaluate(() => {
      window.__EVENT_LOG = [];
      const root = document.querySelector('#vibe-annotations-root').shadowRoot;
      const ta = root.querySelector('.vibe-textarea');
      window.__POPOVER_INPUT_LOG = [];
      ta.addEventListener('beforeinput', (e) => {
        window.__POPOVER_INPUT_LOG.push({
          type: 'beforeinput',
          inputType: e.inputType,
          data: e.data,
          isTrusted: e.isTrusted,
        });
      });
      ta.addEventListener('input', (e) => {
        window.__POPOVER_INPUT_LOG.push({
          type: 'input',
          inputType: e.inputType,
          data: e.data,
          isTrusted: e.isTrusted,
        });
      });
    });

    const isMac = process.platform === 'darwin';
    const modKey = isMac ? 'Meta' : 'Control';

    // 1. Text entry: type "hello"
    await page.keyboard.type('hello');
    await expect(textarea).toHaveValue('hello');

    // 2. Cursor navigation: ArrowLeft 3 times moves between "he" and "llo"
    await page.keyboard.press('ArrowLeft');
    await page.keyboard.press('ArrowLeft');
    await page.keyboard.press('ArrowLeft');

    // 3. Insertion: type "X" -> "heXllo"
    await page.keyboard.type('X');
    await expect(textarea).toHaveValue('heXllo');

    // 4. Forward Delete: deletes the "l" after "X" -> "heXlo"
    await page.keyboard.press('Delete');
    await expect(textarea).toHaveValue('heXlo');

    // 5. Select all (Ctrl+A / Meta+A) and replace
    await page.keyboard.press(`${modKey}+a`);
    await page.keyboard.type('clean');
    await expect(textarea).toHaveValue('clean');

    // 6. Undo (Ctrl+Z) and Redo (Ctrl+Y or Ctrl+Shift+Z)
    await page.keyboard.type('!');
    await expect(textarea).toHaveValue('clean!');
    await page.keyboard.press(`${modKey}+z`);
    await expect(textarea).toHaveValue('clean');
    const redoKey = isMac ? `${modKey}+Shift+z` : `${modKey}+y`;
    await page.keyboard.press(redoKey);
    await expect(textarea).toHaveValue('clean!');

    // 7. Cut / Copy / Paste
    await page.keyboard.press(`${modKey}+a`);
    await page.keyboard.press(`${modKey}+x`);
    await expect(textarea).toHaveValue('');
    await page.keyboard.press(`${modKey}+v`);
    await expect(textarea).toHaveValue('clean!');

    // Verify native input/beforeinput events were captured and are trusted (not fabricated)
    const inputLog = await page.evaluate(() => window.__POPOVER_INPUT_LOG);
    expect(inputLog.length).toBeGreaterThan(0);
    expect(inputLog.every((ev) => ev.isTrusted === true), 'All beforeinput and input events must be trusted native events').toBe(true);

    const inputTypes = inputLog.map((ev) => ev.inputType);
    expect(inputTypes).toContain('insertText');
    expect(inputTypes).toContain('deleteContentForward');

    // Host state and input must remain completely unaffected
    const state = await page.evaluate(() => window.__FIXTURE_STATE);
    expect(state.deleteCount).toBe(0);
    expect(state.cancelCount).toBe(0);
    expect(state.deleted).toBe(false);
    expect(state.selected).toBe(true);

    await expect(hostInput).toHaveValue(initialHostInputValue);

    const eventLog = await page.evaluate(() => window.__EVENT_LOG);
    expect(eventLog.length, 'Host must receive zero keyboard events during native editing').toBe(0);
  });

  test('A8: Editor Esc closes popover and returns to selection once; subsequent Esc sequence works as A1/A2', async ({
    page,
  }) => {
    const vibeRoot = await enterAnnotateMode(page);
    const { popover } = await openPopover(page);
    await expect(popover).toBeVisible();

    await page.evaluate(() => (window.__EVENT_LOG = []));

    // 1. Press Escape in editor -> Popover closes, but Annotate mode is STILL active
    await page.keyboard.press('Escape');
    await expect(popover).not.toBeAttached({ timeout: 3000 });

    // Selection mode is still active (crosshair style still attached)
    await expect(page.locator('style[data-vibe-cursor]')).toBeAttached();

    // Host rectangle still selected, cancelCount still 0
    let state = await page.evaluate(() => window.__FIXTURE_STATE);
    expect(state.cancelCount, 'Editor Esc must not increment host cancelCount').toBe(0);
    expect(state.selected, 'Host rectangle must remain selected after editor Esc').toBe(true);

    // Host event log must receive 0 events
    let eventLog = await page.evaluate(() => window.__EVENT_LOG);
    expect(eventLog.length, 'Host must not receive editor Esc').toBe(0);

    // 2. Next Escape in selection mode exits Annotate (A1)
    await page.keyboard.press('Escape');
    await expect(page.locator('style[data-vibe-cursor]')).not.toBeAttached({ timeout: 3000 });

    state = await page.evaluate(() => window.__FIXTURE_STATE);
    expect(state.cancelCount, 'Selection exit Esc must not cancel host selection').toBe(0);
    expect(state.selected, 'Host rectangle still selected after selection exit').toBe(true);

    // 3. Next fresh Escape reaches host and cancels selection (A2)
    await page.keyboard.press('Escape');
    state = await page.evaluate(() => window.__FIXTURE_STATE);
    expect(state.cancelCount, 'Fresh Esc must reach host and increment cancelCount').toBe(1);
    expect(state.selected, 'Fresh Esc must deselect host rectangle').toBe(false);
  });

  test('A8: Save shortcut (Ctrl+Enter / Cmd+Enter) saves exactly once and returns to selection mode', async ({
    page,
  }) => {
    const vibeRoot = await enterAnnotateMode(page);
    const { popover, textarea } = await openPopover(page);

    await textarea.fill('Save shortcut test note');

    await page.evaluate(() => (window.__EVENT_LOG = []));

    const isMac = process.platform === 'darwin';
    const modKey = isMac ? 'Meta' : 'Control';

    // Press Cmd/Ctrl+Enter
    await page.keyboard.press(`${modKey}+Enter`);

    // Popover is dismissed after saving
    await expect(popover).not.toBeAttached({ timeout: 5000 });

    // Pin/badge is created
    const badge = vibeRoot.locator('.vibe-badge');
    await expect(badge).toBeVisible({ timeout: 5000 });

    // Selection mode remains active after save
    await expect(page.locator('style[data-vibe-cursor]')).toBeAttached();

    // Host received no leaked Enter/shortcut events
    const state = await page.evaluate(() => window.__FIXTURE_STATE);
    expect(state.cancelCount).toBe(0);
    expect(state.deleteCount).toBe(0);

    const eventLog = await page.evaluate(() => window.__EVENT_LOG);
    expect(eventLog.length, 'Host must receive zero events from save shortcut').toBe(0);

    // Press Escape to exit selection mode cleanly
    await page.keyboard.press('Escape');
    await expect(page.locator('style[data-vibe-cursor]')).not.toBeAttached({ timeout: 3000 });
  });

  test('A9: Controlled delay isolates keys while waiting, and Esc before completion cancels editor opening', async ({
    page,
  }) => {
    const vibeRoot = await enterAnnotateMode(page);

    // Set 800ms controlled delay for target context generation via DOM attribute
    await page.evaluate(() => {
      document.documentElement.setAttribute('data-vibe-context-delay', '800');
      window.__EVENT_LOG = [];
    });

    const rect = page.locator('#canvas-rect');
    await rect.click();

    // Now in WAITING state!
    // Type keys during waiting: should be consumed and blocked from host
    await page.keyboard.type('hello');
    await page.keyboard.press('Delete');
    await page.keyboard.press('Backspace');

    // Press Escape while waiting to cancel and exit Annotate mode
    await page.keyboard.press('Escape');

    // Selection mode cursor must be removed immediately
    await expect(page.locator('style[data-vibe-cursor]')).not.toBeAttached({ timeout: 3000 });

    // Host must NOT receive any leaked keys during waiting or cancel
    const state = await page.evaluate(() => window.__FIXTURE_STATE);
    expect(state.deleteCount, 'Host deleteCount must remain 0 during waiting').toBe(0);
    expect(state.cancelCount, 'Host cancelCount must remain 0 during waiting').toBe(0);
    expect(state.deleted, 'Host rectangle must not be deleted during waiting').toBe(false);
    expect(state.selected, 'Host rectangle must remain selected').toBe(true);

    const eventLog = await page.evaluate(() => window.__EVENT_LOG);
    expect(eventLog.length, 'Host must receive zero events while waiting and cancelling').toBe(0);

    // Wait 1000ms for the 800ms context generation to fully resolve in the background
    await page.waitForTimeout(1000);

    // Assert that the late result did NOT open the popover editor!
    const popover = vibeRoot.locator('.vibe-popover');
    await expect(popover).not.toBeAttached();

    // Fresh Esc after cancel reaches host and deselects rectangle
    await page.keyboard.press('Escape');
    const stateAfterFresh = await page.evaluate(() => window.__FIXTURE_STATE);
    expect(stateAfterFresh.cancelCount, 'Fresh Esc after cancelled waiting must reach host').toBe(1);
    expect(stateAfterFresh.selected, 'Fresh Esc must deselect host rectangle').toBe(false);
  });
});
