import { test, expect, FIXTURE_ORIGIN, dispatchKeyWithRepeat } from './fixtures.js';

test.describe('Fixture Verification Outside Annotate', () => {
  test('Escape key deselects rectangle and increments host cancel counter', async ({ page }) => {
    await page.goto(`${FIXTURE_ORIGIN}/selected-rectangle.html`);

    const rect = page.locator('#canvas-rect');
    await expect(rect).toBeVisible();
    await expect(rect).toHaveClass(/selected/);
    await expect(rect).toHaveAttribute('data-selected', 'true');

    const stateBefore = await page.evaluate(() => window.__FIXTURE_STATE);
    expect(stateBefore.selected).toBe(true);
    expect(stateBefore.cancelCount).toBe(0);

    // Press Escape using real browser keyboard input
    await page.keyboard.press('Escape');

    // Verify rectangle is deselected and cancelCount is incremented
    await expect(rect).not.toHaveClass(/selected/);
    await expect(rect).toHaveAttribute('data-selected', 'false');

    const stateAfter = await page.evaluate(() => window.__FIXTURE_STATE);
    expect(stateAfter.selected).toBe(false);
    expect(stateAfter.cancelCount).toBe(1);

    // Verify event journal records capture and bubble phases
    const eventLog = await page.evaluate(() => window.__EVENT_LOG);
    const escEvents = eventLog.filter((e) => e.key === 'Escape');
    expect(escEvents.length).toBeGreaterThan(0);
    expect(escEvents.some((e) => e.phase === 'window-capture')).toBe(true);
    expect(escEvents.some((e) => e.phase === 'document-capture')).toBe(true);
    expect(escEvents.some((e) => e.phase === 'document-bubble')).toBe(true);
  });

  test('Backspace key deletes selected rectangle and increments host delete counter', async ({ page }) => {
    await page.goto(`${FIXTURE_ORIGIN}/selected-rectangle.html`);

    const rect = page.locator('#canvas-rect');
    await expect(rect).toBeVisible();

    const stateBefore = await page.evaluate(() => window.__FIXTURE_STATE);
    expect(stateBefore.selected).toBe(true);
    expect(stateBefore.deleteCount).toBe(0);
    expect(stateBefore.deleted).toBe(false);

    // Press Backspace using real browser keyboard input
    await page.keyboard.press('Backspace');

    // Verify rectangle is deleted
    await expect(rect).toHaveClass(/deleted/);
    await expect(rect).toHaveAttribute('data-deleted', 'true');
    await expect(rect).not.toBeVisible();

    const stateAfter = await page.evaluate(() => window.__FIXTURE_STATE);
    expect(stateAfter.deleteCount).toBe(1);
    expect(stateAfter.deleted).toBe(true);
  });

  test('Typing in editable host input updates value without triggering rectangle deletion', async ({ page }) => {
    await page.goto(`${FIXTURE_ORIGIN}/selected-rectangle.html`);

    const hostInput = page.locator('#host-input');
    await hostInput.click();
    await hostInput.fill('new text');
    await page.keyboard.press('Backspace');

    await expect(hostInput).toHaveValue('new tex');

    // Rectangle should still be selected and NOT deleted
    const state = await page.evaluate(() => window.__FIXTURE_STATE);
    expect(state.selected).toBe(true);
    expect(state.deleted).toBe(false);
    expect(state.deleteCount).toBe(0);
  });

  test('Exercises browser keyboard down, repeat, and up inputs separately', async ({ page }) => {
    await page.goto(`${FIXTURE_ORIGIN}/selected-rectangle.html`);

    // Reset log and state
    await page.evaluate(() => window.__resetFixtureState());

    // Dispatch down, repeat, and up via CDP
    await dispatchKeyWithRepeat(page, 'Escape', 'Escape', 27);

    // Verify event journal records separate down, repeat, and up entries
    const eventLog = await page.evaluate(() => window.__EVENT_LOG);
    const escEvents = eventLog.filter((e) => e.key === 'Escape');

    const hasRepeat = escEvents.some((e) => e.repeat === true);
    const hasKeyUp = escEvents.some((e) => e.type === 'keyup');
    expect(hasRepeat).toBe(true);
    expect(hasKeyUp).toBe(true);
  });

  test('Exercises late registrations and stopImmediatePropagation', async ({ page }) => {
    await page.goto(`${FIXTURE_ORIGIN}/selected-rectangle.html`);

    // Register late listener that invokes stopImmediatePropagation on Esc
    await page.evaluate(() => {
      window.__registerLateListeners({ stopImmediatePropagationOnEsc: true });
    });

    // Press Escape
    await page.keyboard.press('Escape');

    const eventLog = await page.evaluate(() => window.__EVENT_LOG);
    const lateEvents = eventLog.filter((e) => e.phase === 'late-window-capture');
    expect(lateEvents.length).toBeGreaterThan(0);
  });
});
