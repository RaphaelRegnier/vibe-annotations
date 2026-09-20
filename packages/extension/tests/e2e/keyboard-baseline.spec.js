import { test, expect, FIXTURE_ORIGIN, enterAnnotateMode, openPopover } from './fixtures.js';

test.describe('Keyboard Conflict Baselines (Extension v2.0.2)', () => {
  test('A1 Baseline: Esc in selection mode leaks to host when canvas is focused', async ({
    page,
    extensionVersion,
  }) => {
    expect(extensionVersion).toBe('2.0.2');

    await page.goto(`${FIXTURE_ORIGIN}/selected-rectangle.html`);

    const rect = page.locator('#canvas-rect');
    await expect(rect).toHaveClass(/selected/);

    // Enter Annotate mode via real toolbar button
    await enterAnnotateMode(page);

    // Focus canvas rectangle to simulate host page having focus
    await rect.focus();

    // Clear event log so we only capture keys pressed during selection mode
    await page.evaluate(() => (window.__EVENT_LOG = []));

    // Real browser keyboard input: press Escape
    await page.keyboard.press('Escape');

    // Baseline outcome on v2.0.2:
    // Selection mode stops, BUT Esc leaks to host document/window bubble listener.
    // Host cancelCount increments to 1, and rectangle is deselected.
    //
    // TARGET REGRESSION (Ticket #6):
    // Host rectangle MUST stay selected and cancelCount MUST remain 0.
    const state = await page.evaluate(() => window.__FIXTURE_STATE);
    expect(state.cancelCount, 'A1 Conflict: Host received Esc during selection mode').toBe(0);
    expect(state.selected, 'A1 Conflict: Host rectangle was deselected during selection mode').toBe(true);
  });

  test('A1 Baseline: Esc while toolbar button remains focused fails to exit Annotate mode', async ({
    page,
    extensionVersion,
  }) => {
    expect(extensionVersion).toBe('2.0.2');

    await page.goto(`${FIXTURE_ORIGIN}/selected-rectangle.html`);

    // Enter Annotate mode without moving mouse/focus away from toolbar button
    await enterAnnotateMode(page);

    // Press Escape immediately
    await page.keyboard.press('Escape');

    // Baseline outcome on v2.0.2:
    // Because focus was on .vibe-tb-annotate inside shadow root,
    // shadow-host.js calls stopPropagation(), so Esc never reaches document shortcut handler!
    // As a result, Annotate mode fails to exit.
    //
    // TARGET REGRESSION (Ticket #6):
    // Centralized keyboard routing ensures Esc exits Annotate regardless of toolbar focus.
    await expect(page.locator('style[data-vibe-cursor]')).not.toBeAttached({ timeout: 2000 });
  });

  test('A2 Baseline: Consecutive Esc sequence after selection exit', async ({
    page,
    extensionVersion,
  }) => {
    expect(extensionVersion).toBe('2.0.2');

    await page.goto(`${FIXTURE_ORIGIN}/selected-rectangle.html`);

    const rect = page.locator('#canvas-rect');
    await expect(rect).toHaveClass(/selected/);

    await enterAnnotateMode(page);
    await rect.focus();

    // Step 1: First Esc (A1 - meant to exit Annotate only)
    await page.keyboard.press('Escape');

    // Regression check after A1: Rectangle must still be selected, cancelCount must be 0
    const stateAfterA1 = await page.evaluate(() => window.__FIXTURE_STATE);
    expect(stateAfterA1.cancelCount, 'A2 Conflict: First Esc leaked to host during Annotate exit').toBe(0);
    expect(stateAfterA1.selected, 'A2 Conflict: Rectangle was already deselected during Annotate exit').toBe(true);

    // Step 2: Second Esc (A2 - meant to deselect host rectangle)
    await page.keyboard.press('Escape');

    const stateAfterA2 = await page.evaluate(() => window.__FIXTURE_STATE);
    expect(stateAfterA2.cancelCount, 'A2: Second Esc reaches host and increments cancelCount').toBe(1);
    expect(stateAfterA2.selected, 'A2: Second Esc deselects rectangle').toBe(false);
  });

  test('A3 Baseline: Backspace inside popover textarea with host bubble listener', async ({
    page,
    extensionVersion,
  }) => {
    expect(extensionVersion).toBe('2.0.2');

    await page.goto(`${FIXTURE_ORIGIN}/selected-rectangle.html`);

    await enterAnnotateMode(page);
    const { textarea } = await openPopover(page);

    // Type "abc"
    await page.keyboard.type('abc');
    await expect(textarea).toHaveValue('abc');

    // Press Backspace
    await page.keyboard.press('Backspace');

    // Textarea value becomes "ab"
    await expect(textarea).toHaveValue('ab');

    // Host delete count must NOT increase (bubble phase is contained at shadow boundary)
    const state = await page.evaluate(() => window.__FIXTURE_STATE);
    expect(state.deleteCount).toBe(0);
    expect(state.deleted).toBe(false);
  });

  test('A3 & Early Capture Conflict Baseline: Host early window capture listener intercepts Backspace', async ({
    page,
    extensionVersion,
  }) => {
    expect(extensionVersion).toBe('2.0.2');

    // Open fixture with preventDefaultOnBackspace enabled in early window capture listener
    await page.goto(`${FIXTURE_ORIGIN}/selected-rectangle.html?preventBackspace=true`);

    await enterAnnotateMode(page);
    const { textarea } = await openPopover(page);

    await page.keyboard.type('abc');
    await expect(textarea).toHaveValue('abc');

    await page.keyboard.press('Backspace');

    // TARGET REGRESSION (Ticket #7):
    // Backspace must delete character inside popover textarea even if host has capture listeners.
    // On v2.0.2, host early capture listener calls preventDefault(), blocking deletion ("abc" remains).
    await expect(textarea).toHaveValue('ab');
  });

  test('Early-Capture Conflict Baseline: Host early window capture listener receives keys during Annotate mode', async ({
    page,
    extensionVersion,
  }) => {
    expect(extensionVersion).toBe('2.0.2');

    await page.goto(`${FIXTURE_ORIGIN}/selected-rectangle.html`);

    await page.evaluate(() => window.__resetFixtureState());
    await enterAnnotateMode(page);
    await page.evaluate(() => (window.__EVENT_LOG = []));

    // Press ArrowDown (used for extension DOM navigation)
    await page.keyboard.press('ArrowDown');

    // TARGET REGRESSION (Tickets #6 & #7):
    // Early window capture listeners must NOT receive annotation-mode keys.
    // On v2.0.2, window capture listener receives ArrowDown.
    const eventLog = await page.evaluate(() => window.__EVENT_LOG);
    const arrowDownEvents = eventLog.filter((e) => e.key === 'ArrowDown');
    expect(arrowDownEvents.length, 'Early capture leak: Host window capture received ArrowDown').toBe(0);
  });
});
