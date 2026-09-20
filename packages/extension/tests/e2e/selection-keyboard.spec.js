import { test, expect, FIXTURE_ORIGIN, enterAnnotateMode } from './fixtures.js';

test.describe('Annotate Selection Keyboard Ownership & Exit Drain (Ticket #6)', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto(`${FIXTURE_ORIGIN}/selected-rectangle.html`);
    await page.evaluate(() => window.__resetFixtureState());
  });

  test('A1 & A10: Esc exits selection mode while host rectangle remains selected (canvas focused)', async ({
    page,
  }) => {
    const rect = page.locator('#canvas-rect');
    await expect(rect).toHaveClass(/selected/);

    // Enter Annotate mode
    await enterAnnotateMode(page);

    // Focus canvas to ensure host page has focus
    await rect.focus();

    // Clear fixture log
    await page.evaluate(() => (window.__EVENT_LOG = []));

    // Press Escape to exit Annotate mode
    await page.keyboard.press('Escape');

    // Selection mode exited: crosshair cursor removed
    await expect(page.locator('style[data-vibe-cursor]')).not.toBeAttached({ timeout: 3000 });

    // Logical selection preserved, cancelCount and escCount remain 0
    const state = await page.evaluate(() => window.__FIXTURE_STATE);
    expect(state.cancelCount, 'Host cancelCount must remain 0').toBe(0);
    expect(state.selected, 'Host rectangle must remain selected').toBe(true);
    expect(state.escCount, 'Host early capture must not receive Esc').toBe(0);

    // A10 assertion: host event log receives zero events from selection mode
    const eventLog = await page.evaluate(() => window.__EVENT_LOG);
    expect(eventLog.length, 'Host listeners must receive zero events during selection mode').toBe(0);
  });

  test('A1: Esc exits selection mode when toolbar button remains focused', async ({ page }) => {
    // Enter Annotate mode and keep focus on the toolbar button inside shadow DOM
    await enterAnnotateMode(page);

    // Press Escape immediately
    await page.keyboard.press('Escape');

    // Selection mode exits cleanly
    await expect(page.locator('style[data-vibe-cursor]')).not.toBeAttached({ timeout: 3000 });

    const state = await page.evaluate(() => window.__FIXTURE_STATE);
    expect(state.cancelCount).toBe(0);
    expect(state.selected).toBe(true);
  });

  test('A2: Consecutive Esc sequence after selection exit deselects rectangle', async ({ page }) => {
    const rect = page.locator('#canvas-rect');
    await expect(rect).toHaveClass(/selected/);

    await enterAnnotateMode(page);
    await rect.focus();

    // Step 1: First Esc exits Annotate selection mode
    await page.keyboard.press('Escape');
    await expect(page.locator('style[data-vibe-cursor]')).not.toBeAttached({ timeout: 3000 });

    const stateAfterA1 = await page.evaluate(() => window.__FIXTURE_STATE);
    expect(stateAfterA1.cancelCount, 'First Esc must not cancel host selection').toBe(0);
    expect(stateAfterA1.selected, 'Rectangle must still be selected after first Esc').toBe(true);

    // Step 2: Second fresh Esc reaches host and deselects rectangle
    await page.keyboard.press('Escape');

    const stateAfterA2 = await page.evaluate(() => window.__FIXTURE_STATE);
    expect(stateAfterA2.cancelCount, 'Second Esc must reach host and increment cancelCount').toBe(1);
    expect(stateAfterA2.selected, 'Second Esc must deselect host rectangle').toBe(false);
  });

  test('A4: ArrowUp, ArrowDown, and Enter navigate and confirm selection without leaking to host', async ({
    page,
  }) => {
    const vibeRoot = await enterAnnotateMode(page);

    // Hover over the subtitle inside canvas rect to start highlight
    const subtitle = page.locator('.rect-subtitle');
    await subtitle.hover();

    const highlight = vibeRoot.locator('.vibe-highlight');
    await expect(highlight).toBeVisible({ timeout: 3000 });

    // Clear event log
    await page.evaluate(() => (window.__EVENT_LOG = []));

    // Press ArrowUp to navigate to parent element (#canvas-rect)
    await page.keyboard.press('ArrowUp');

    // Press ArrowDown to retrace back to subtitle
    await page.keyboard.press('ArrowDown');

    // Press Enter to confirm element and open popover
    await page.keyboard.press('Enter');

    const popover = vibeRoot.locator('.vibe-popover');
    await expect(popover).toBeVisible({ timeout: 5000 });

    // Host listeners must receive NO ArrowUp, ArrowDown, or Enter events
    const eventLog = await page.evaluate(() => window.__EVENT_LOG);
    const leakedNavEvents = eventLog.filter((e) => ['ArrowUp', 'ArrowDown', 'Enter'].includes(e.key));
    expect(leakedNavEvents.length, 'Host received leaked navigation/confirmation events').toBe(0);

    // Host selection state and counters remain unaffected
    const state = await page.evaluate(() => window.__FIXTURE_STATE);
    expect(state.cancelCount).toBe(0);
    expect(state.deleteCount).toBe(0);
  });

  test('A5: Ordinary characters, Delete, and host shortcuts do not leak; focused page input is unmodified', async ({
    page,
  }) => {
    const hostInput = page.locator('#host-input');
    await hostInput.focus();
    const initialInputValue = await hostInput.inputValue();
    expect(initialInputValue).toBe('editable page content');

    // Enter Annotate mode
    await enterAnnotateMode(page);

    await page.evaluate(() => (window.__EVENT_LOG = []));

    // Type character, Delete, Backspace, and shortcut combo (Ctrl+Z)
    await page.keyboard.type('x');
    await page.keyboard.press('Delete');
    await page.keyboard.press('Backspace');
    await page.keyboard.press('Control+z');

    // Host input must NOT have changed (native default editing prevented)
    await expect(hostInput).toHaveValue(initialInputValue);

    // Host rectangle not deleted
    const state = await page.evaluate(() => window.__FIXTURE_STATE);
    expect(state.deleteCount, 'Host deleteCount must remain 0').toBe(0);
    expect(state.deleted, 'Host rectangle must not be deleted').toBe(false);

    // Host listeners must receive zero events for these keys
    const eventLog = await page.evaluate(() => window.__EVENT_LOG);
    expect(eventLog.length, 'Host listeners received leaked keys').toBe(0);
  });

  test('A10: Early window capture, document capture/bubble, and property listeners receive no events during Annotate', async ({
    page,
  }) => {
    await enterAnnotateMode(page);

    await page.evaluate(() => (window.__EVENT_LOG = []));

    // Drive browser keys (including printable characters that generate browser keypress)
    await page.keyboard.press('ArrowDown');
    await page.keyboard.press('ArrowUp');
    await page.keyboard.press('KeyA');
    await page.keyboard.press('Digit1');

    const eventLog = await page.evaluate(() => window.__EVENT_LOG);
    expect(eventLog.length, 'Host early capture and bubble listeners must receive no events').toBe(0);
    expect(eventLog.filter((e) => e.type === 'keypress').length, 'Host received keypress event').toBe(0);
    expect(eventLog.filter((e) => e.type === 'keydown').length, 'Host received keydown event').toBe(0);
    expect(eventLog.filter((e) => e.type === 'keyup').length, 'Host received keyup event').toBe(0);
  });

  test('A11: Held Esc repeats and keyup are drained across exit; next fresh key reaches host', async ({
    page,
  }) => {
    const rect = page.locator('#canvas-rect');
    await enterAnnotateMode(page);
    await rect.focus();

    await page.evaluate(() => (window.__EVENT_LOG = []));

    // 1. Physical key sequence with repeat: Down -> Repeat -> Repeat -> Up
    const cdp = await page.context().newCDPSession(page);
    await cdp.send('Input.dispatchKeyEvent', {
      type: 'rawKeyDown',
      key: 'Escape',
      code: 'Escape',
      windowsVirtualKeyCode: 27,
    });
    await cdp.send('Input.dispatchKeyEvent', {
      type: 'rawKeyDown',
      key: 'Escape',
      code: 'Escape',
      windowsVirtualKeyCode: 27,
      autoRepeat: true,
    });
    await cdp.send('Input.dispatchKeyEvent', {
      type: 'rawKeyDown',
      key: 'Escape',
      code: 'Escape',
      windowsVirtualKeyCode: 27,
      autoRepeat: true,
    });
    await cdp.send('Input.dispatchKeyEvent', {
      type: 'keyUp',
      key: 'Escape',
      code: 'Escape',
      windowsVirtualKeyCode: 27,
    });

    // Annotate mode exited
    await expect(page.locator('style[data-vibe-cursor]')).not.toBeAttached({ timeout: 3000 });

    // Host must NOT have received any of the Esc events (initial, repeats, or keyup)
    const state = await page.evaluate(() => window.__FIXTURE_STATE);
    expect(state.cancelCount, 'Repeats or keyup leaked to host cancelCount').toBe(0);
    expect(state.selected, 'Host rectangle was cancelled by held Esc sequence').toBe(true);
    expect(state.escCount, 'Host early capture received held Esc sequence').toBe(0);

    // 2. Next fresh keystroke (A2 Esc) is immediately usable and deselects rectangle
    await page.keyboard.press('Escape');

    const stateAfterFresh = await page.evaluate(() => window.__FIXTURE_STATE);
    expect(stateAfterFresh.cancelCount, 'Next fresh Esc must increment cancelCount').toBe(1);
    expect(stateAfterFresh.selected, 'Next fresh Esc must deselect rectangle').toBe(false);
  });
});
