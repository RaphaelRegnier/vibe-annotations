import { test, expect, FIXTURE_ORIGIN, enterAnnotateMode } from './fixtures.js';

test.describe('Annotate Host Focus Restoration (Ticket #10)', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto(`${FIXTURE_ORIGIN}/selected-rectangle.html`);
    await page.evaluate(() => window.__resetFixtureState());
  });

  async function readFocus(page) {
    return page.evaluate(() => ({
      isVibeRoot: document.activeElement === document.querySelector('#vibe-annotations-root'),
      isBody: document.activeElement === document.body,
      id: document.activeElement && document.activeElement.id ? document.activeElement.id : null,
      tag: document.activeElement ? document.activeElement.tagName.toLowerCase() : null,
      scrollY: window.scrollY,
    }));
  }

  test('Restores a focused page input without clicks or scrolling', async ({ page }) => {
    const hostInput = page.locator('#host-input');
    await hostInput.focus();
    await expect(hostInput).toBeFocused();

    await enterAnnotateMode(page);

    // Entry moved DOM focus into the extension UI
    expect((await readFocus(page)).isVibeRoot, 'Entering Annotate must move DOM focus into the extension UI').toBe(true);

    // The page scrolls away from the original element while the session owns the keyboard
    await page.evaluate(() => window.scrollTo(0, 400));
    await page.waitForFunction(() => window.scrollY > 0);

    // Exit Annotate
    await page.keyboard.press('Escape');
    await expect(page.locator('style[data-vibe-cursor]')).not.toBeAttached({ timeout: 5000 });

    // Focus went back to the original host element…
    await expect(hostInput).toBeFocused({ timeout: 3000 });

    // …without scrolling it back into view and without synthetic mouse activity
    const focus = await readFocus(page);
    expect(focus.scrollY, 'Restoring focus must not scroll the page').toBeGreaterThan(0);

    const state = await page.evaluate(() => window.__FIXTURE_STATE);
    expect(state.clickCount, 'Focus restoration must not simulate clicks').toBe(0);
    expect(state.mouseDownCount, 'Focus restoration must not simulate mousedown').toBe(0);
    expect(state.selected, 'Host logical selection must be untouched').toBe(true);
    expect(state.cancelCount, 'Exiting Annotate must not cancel host selection').toBe(0);
  });

  test('Restores a focused canvas element without changing host selection', async ({ page }) => {
    const rect = page.locator('#canvas-rect');
    await rect.focus();
    await expect(rect).toBeFocused();

    await enterAnnotateMode(page);
    await page.keyboard.press('Escape');
    await expect(page.locator('style[data-vibe-cursor]')).not.toBeAttached({ timeout: 5000 });

    await expect(rect).toBeFocused({ timeout: 3000 });

    const state = await page.evaluate(() => window.__FIXTURE_STATE);
    expect(state.clickCount, 'Canvas focus restore must not click the canvas').toBe(0);
    expect(state.mouseDownCount).toBe(0);
    expect(state.selected, 'Canvas rectangle must remain logically selected').toBe(true);
    expect(state.cancelCount).toBe(0);
  });

  test('Restores nothing when entry never moved focus away from the toolbar', async ({ page }) => {
    // No host element was focused before entry; focus starts on the toolbar button
    await enterAnnotateMode(page);
    await page.keyboard.press('Escape');
    await expect(page.locator('style[data-vibe-cursor]')).not.toBeAttached({ timeout: 5000 });

    const focus = await readFocus(page);
    expect(focus.isVibeRoot, 'Focus must not stay on extension UI after exit').toBe(false);
    expect(focus.isBody, 'With no original element, focus falls back to the page body').toBe(true);

    const state = await page.evaluate(() => window.__FIXTURE_STATE);
    expect(state.clickCount, 'Focus restore must not click the page').toBe(0);
    expect(state.selected, 'Host selection must be untouched').toBe(true);
  });

  test('Does not steal focus from a host element focused during the session', async ({ page }) => {
    const hostInput = page.locator('#host-input');
    const rect = page.locator('#canvas-rect');
    await hostInput.focus();
    await enterAnnotateMode(page);

    // The host moves focus on its own while the session owns the keyboard
    await page.evaluate(() => document.getElementById('canvas-rect').focus());

    await page.keyboard.press('Escape');
    await expect(page.locator('style[data-vibe-cursor]')).not.toBeAttached({ timeout: 5000 });

    await expect(rect).toBeFocused({ timeout: 3000 });
    const state = await page.evaluate(() => window.__FIXTURE_STATE);
    expect(state.clickCount).toBe(0);
  });
});
