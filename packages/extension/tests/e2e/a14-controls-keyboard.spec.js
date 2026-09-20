import { test, expect, FIXTURE_ORIGIN, enterAnnotateMode, openPopover } from './fixtures.js';

test.describe('A14: Design, Variants, Shortcut Recording, Keyboard Access & Entry Points (Ticket #8)', () => {
  test.beforeEach(async ({ page, backgroundWorker }) => {
    await backgroundWorker.evaluate(async () => {
      await chrome.storage.local.clear();
    });
    await page.goto(`${FIXTURE_ORIGIN}/selected-rectangle.html`);
    await page.evaluate(() => window.__resetFixtureState());
  });

  test('A14 Design keyboard actions: Tab/Enter activates Design tab, expands accordion, and ArrowUp/Down steps sizing inputs without leaking to host', async ({
    page,
  }) => {
    await enterAnnotateMode(page);
    const { popover, textarea } = await openPopover(page);

    // Initial focus is on the comment textarea
    await expect(textarea).toBeFocused();

    // Clear event log after popover opens
    await page.evaluate(() => (window.__EVENT_LOG = []));

    // Navigate focus to the Design tab via Shift+Tab or Tab and activate with Enter
    const designTab = popover.locator('.vibe-mode-tab[data-mode="design"]');
    await designTab.focus();
    await page.keyboard.press('Enter');

    // Confirm Design panel is shown
    const designPanel = popover.locator('.vibe-mode-panel[data-mode="design"]');
    await expect(designPanel).toBeVisible();

    // Find the Sizing accordion toggle and activate with Enter
    const sizingSection = popover.locator('.vibe-design-section', { hasText: 'Sizing' });
    const sizingToggle = sizingSection.locator('.vibe-design-sec-toggle');
    await sizingToggle.focus();
    await page.keyboard.press('Enter');

    // Confirm Sizing section body is visible
    const sizingBody = sizingSection.locator('.vibe-design-sec-body');
    await expect(sizingBody).toBeVisible();

    // Locate the width sizing input
    const widthInput = sizingBody.locator('input[data-sizing="width"]');
    await widthInput.focus();

    // Get initial width value
    const initialWidthStr = await widthInput.inputValue();
    const initialWidth = parseFloat(initialWidthStr) || 220;

    // Press ArrowUp to step value up by 1
    await page.keyboard.press('ArrowUp');
    await expect(widthInput).toHaveValue(`${initialWidth + 1}px`);

    // Press Shift+ArrowUp to step value up by 10
    await page.keyboard.press('Shift+ArrowUp');
    await expect(widthInput).toHaveValue(`${initialWidth + 11}px`);

    // Press ArrowDown to step value down by 1
    await page.keyboard.press('ArrowDown');
    await expect(widthInput).toHaveValue(`${initialWidth + 10}px`);

    // Verify the annotated host element received the style update. Which of the
    // rectangle's children is under the click point depends on font metrics, so
    // assert on whichever element the live preview actually styled.
    const styledWidth = await page.evaluate(() => {
      const candidates = Array.from(document.querySelectorAll('.rect-title, .rect-subtitle, #canvas-rect'));
      const styled = candidates.find((el) => el.style.width);
      return styled ? styled.style.width : null;
    });
    expect(styledWidth, 'Live preview must reach the annotated host element').toBe(`${initialWidth + 10}px`);

    // Assert host received ZERO keyboard events from Design controls
    const eventLog = await page.evaluate(() => window.__EVENT_LOG);
    expect(eventLog.length, 'Host listeners must receive zero events during Design keyboard actions').toBe(0);

    const state = await page.evaluate(() => window.__FIXTURE_STATE);
    expect(state.cancelCount).toBe(0);
    expect(state.deleteCount).toBe(0);
    expect(state.selected).toBe(true);
  });

  test('A14 Variants keyboard actions: Radio navigation via arrow keys and Save shortcut (Ctrl/Cmd+Enter) execute once without host leakage', async ({
    page,
    backgroundWorker,
  }) => {
    const vibeRoot = page.locator('#vibe-annotations-root');

    // Seed an annotation in variants mode for #variants-container
    await backgroundWorker.evaluate(async (data) => {
      await chrome.storage.local.set(data);
    }, {
      annotations: [
        {
          id: 'variants_test_annotation',
          url: `${FIXTURE_ORIGIN}/selected-rectangle.html`,
          selector: '#variants-container',
          mode: 'variants',
          comment: 'Test Variants Exploration',
          variantsPayload: {
            container: '#variants-container',
            attribute: 'data-vibe-active',
            variants: [
              { value: '1', name: 'Alpha' },
              { value: '2', name: 'Beta' },
            ],
          },
          status: 'pending',
          created_at: new Date().toISOString(),
          updated_at: new Date().toISOString(),
        },
      ],
    });

    // Reload page to pick up seeded annotation
    await page.goto(`${FIXTURE_ORIGIN}/selected-rectangle.html`);
    await page.evaluate(() => window.__resetFixtureState());

    // Badge should be rendered for the variant annotation
    const badge = vibeRoot.locator('.vibe-badge[data-annotation-id="variants_test_annotation"]');
    await expect(badge).toBeVisible({ timeout: 5000 });

    // Click badge to open Variants review popover
    await badge.click();

    const popover = vibeRoot.locator('.vibe-popover');
    await expect(popover).toBeVisible({ timeout: 5000 });
    await expect(popover.locator('.vibe-variants-review')).toBeVisible();

    // Clear event log
    await page.evaluate(() => (window.__EVENT_LOG = []));

    // Focus the first radio button and navigate with ArrowDown to the second
    const radios = popover.locator('input[name="vibe-variant"]');
    await radios.first().focus();
    await page.keyboard.press('ArrowDown');

    // Check that the second radio is now checked and container attribute updated to 2
    await expect(radios.nth(1)).toBeChecked();
    const containerAttr = await page.locator('#variants-container').getAttribute('data-vibe-active');
    expect(containerAttr).toBe('2');

    // Press save shortcut (Ctrl+Enter / Cmd+Enter) to choose this variant
    const isMac = process.platform === 'darwin';
    const modKey = isMac ? 'Meta' : 'Control';
    await page.keyboard.press(`${modKey}+Enter`);

    // Choose button is triggered: button updates to "Chosen ✓" and becomes disabled
    const chooseBtn = popover.locator('.vibe-variants-choose');
    await expect(chooseBtn).toHaveText('Chosen ✓');
    await expect(chooseBtn).toBeDisabled();

    // Assert host received zero leaked keyboard events
    const eventLog = await page.evaluate(() => window.__EVENT_LOG);
    expect(eventLog.length, 'Host listeners must receive zero events during Variants keyboard actions').toBe(0);

    const state = await page.evaluate(() => window.__FIXTURE_STATE);
    expect(state.cancelCount).toBe(0);
    expect(state.deleteCount).toBe(0);

    // Close the variants review popover via Escape
    await page.keyboard.press('Escape');
    await expect(popover).not.toBeAttached({ timeout: 3000 });
  });

  test('A14 Shortcut recording: Ignores lone modifiers, records valid shortcut, cancels on Escape, and is not preempted by global hotkeys', async ({
    page,
    backgroundWorker,
  }) => {
    const vibeRoot = page.locator('#vibe-annotations-root');

    // Open settings dropdown from toolbar
    const settingsBtn = vibeRoot.locator('.vibe-tb-settings');
    await expect(settingsBtn).toBeVisible({ timeout: 10000 });
    await settingsBtn.click();

    const settingsDropdown = vibeRoot.locator('.vibe-settings-dropdown');
    await expect(settingsDropdown).toBeVisible();

    const shortcutBtn = settingsDropdown.locator('.vibe-shortcut-btn');
    await expect(shortcutBtn).toBeVisible();
    const originalText = await shortcutBtn.textContent();

    // 1. Enter recording mode
    await shortcutBtn.click();
    await expect(shortcutBtn).toHaveText('Press keys…');
    await expect(shortcutBtn).toHaveClass(/recording/);

    // 2. Press lone modifier keys: should be ignored, remains recording
    await page.keyboard.press('Shift');
    await page.keyboard.press('Control');
    await page.keyboard.press('Alt');
    await expect(shortcutBtn).toHaveText('Press keys…');
    await expect(shortcutBtn).toHaveClass(/recording/);

    // 3. Test cancellation via Escape: reverts to original shortcut and does NOT exit or trigger canvas deselection
    await page.keyboard.press('Escape');
    await expect(shortcutBtn).toHaveText(originalText);
    await expect(shortcutBtn).not.toHaveClass(/recording/);

    const stateAfterCancel = await page.evaluate(() => window.__FIXTURE_STATE);
    expect(stateAfterCancel.cancelCount, 'Escape during shortcut recording cancellation must not leak to host').toBe(0);

    // 4. Test that pressing current shortcut during recording is not preempted by global routing
    await shortcutBtn.click();
    await expect(shortcutBtn).toHaveText('Press keys…');

    // Press Control+Shift+Comma (the default shortcut)
    await page.keyboard.press('Control+Shift+,');

    // Should NOT have started selection mode cursor
    await expect(page.locator('style[data-vibe-cursor]')).not.toBeAttached();

    // 5. Record a new valid custom shortcut (Control+Shift+K)
    await shortcutBtn.click();
    await expect(shortcutBtn).toHaveText('Press keys…');

    await page.keyboard.press('Control+Shift+k');

    // Button updates to formatted new shortcut
    const updatedText = await shortcutBtn.textContent();
    expect(updatedText.toUpperCase()).toContain('K');
    await expect(shortcutBtn).not.toHaveClass(/recording/);

    // Verify persisted in chrome.storage.local
    const stored = await backgroundWorker.evaluate(async () => {
      const res = await chrome.storage.local.get(['vibeCustomShortcut']);
      return res.vibeCustomShortcut;
    });
    expect(stored).toBeTruthy();
    expect(stored.key.toLowerCase()).toBe('k');
    expect(stored.ctrlKey).toBe(true);
    expect(stored.shiftKey).toBe(true);
  });

  test('A14 Tab/Shift+Tab focus trap: Cycles focus within editing popover and prevents focus from escaping to the host page', async ({
    page,
  }) => {
    await enterAnnotateMode(page);
    const { popover, textarea } = await openPopover(page);

    // Focus starts in the textarea
    await expect(textarea).toBeFocused();

    // Query all focusable controls inside the popover
    const focusableSelectors = 'button:not([disabled]), input:not([disabled]), textarea:not([disabled]), select:not([disabled]), [tabindex]:not([tabindex="-1"])';
    const focusableCount = await popover.locator(focusableSelectors).count();
    expect(focusableCount).toBeGreaterThan(2);

    // Tab forward through all elements until we reach the last focusable element
    for (let i = 0; i < focusableCount - 1; i++) {
      await page.keyboard.press('Tab');
    }

    // Now on the last focusable element, pressing Tab must wrap around to the first focusable element!
    await page.keyboard.press('Tab');

    // Verify focus is STILL inside the popover (first focusable element), NOT on any host element
    const focusedTag = await page.evaluate(() => {
      const root = document.getElementById('vibe-annotations-root')?.shadowRoot;
      return root?.activeElement ? root.activeElement.tagName : null;
    });
    expect(focusedTag, 'Focus must remain inside extension Shadow DOM after Tab wrap').toBeTruthy();

    const hostFocused = await page.evaluate(() => {
      const active = document.activeElement;
      return active && active !== document.body && active !== document.getElementById('vibe-annotations-root');
    });
    expect(hostFocused, 'Host element must NOT receive focus from Tab wrap').toBe(false);

    // Now test Shift+Tab wrap from the first element backwards to the last element
    // Ensure we are on the first element
    await popover.locator(focusableSelectors).first().focus();
    await page.keyboard.press('Shift+Tab');

    const focusedAfterShiftTab = await page.evaluate(() => {
      const root = document.getElementById('vibe-annotations-root')?.shadowRoot;
      return root?.activeElement ? root.activeElement.tagName : null;
    });
    expect(focusedAfterShiftTab, 'Focus must remain inside extension Shadow DOM after Shift+Tab wrap').toBeTruthy();

    const hostFocusedAfterShift = await page.evaluate(() => {
      const active = document.activeElement;
      return active && active !== document.body && active !== document.getElementById('vibe-annotations-root');
    });
    expect(hostFocusedAfterShift, 'Host element must NOT receive focus from Shift+Tab wrap').toBe(false);

    // Host received zero keyboard events during Tab navigation
    const eventLog = await page.evaluate(() => window.__EVENT_LOG);
    expect(eventLog.length, 'Host listeners must receive zero events during Tab navigation').toBe(0);
  });

  test('A14 Alternate entry points: Configurable shortcut and runtime message toggle Annotate mode with exclusive session protection', async ({
    page,
    backgroundWorker,
  }) => {
    const isMac = process.platform === 'darwin';
    const shortcutKey = isMac ? 'Meta+Shift+,' : 'Control+Shift+,';

    // 1. Enter Annotate mode via keyboard shortcut (default Ctrl+Shift+Comma / Cmd+Shift+Comma)
    await page.keyboard.press(shortcutKey);
    await expect(page.locator('style[data-vibe-cursor]')).toBeAttached({ timeout: 5000 });

    // Selection mode is now active via shortcut entry point!
    // Assert exclusive session protection:
    await page.evaluate(() => (window.__EVENT_LOG = []));

    // Press Escape to exit selection mode
    await page.keyboard.press('Escape');
    await expect(page.locator('style[data-vibe-cursor]')).not.toBeAttached({ timeout: 3000 });

    // Host rectangle remains selected, cancelCount does not increment (A1 contract)
    const stateAfterEsc = await page.evaluate(() => window.__FIXTURE_STATE);
    expect(stateAfterEsc.cancelCount, 'A1: Esc must not leak to host').toBe(0);
    expect(stateAfterEsc.selected, 'A1: Host rectangle remains selected').toBe(true);

    // 2. Enter Annotate mode via runtime message ('toggleAnnotate')
    await backgroundWorker.evaluate(async () => {
      const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
      await chrome.tabs.sendMessage(tab.id, { action: 'toggleAnnotate' });
    });
    await expect(page.locator('style[data-vibe-cursor]')).toBeAttached({ timeout: 5000 });

    // Exit selection mode with fresh Esc
    await page.keyboard.press('Escape');
    await expect(page.locator('style[data-vibe-cursor]')).not.toBeAttached({ timeout: 3000 });

    // 3. Enter Annotate mode via runtime message ('startAnnotationMode')
    await backgroundWorker.evaluate(async () => {
      const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
      await chrome.tabs.sendMessage(tab.id, { action: 'startAnnotationMode' });
    });
    await expect(page.locator('style[data-vibe-cursor]')).toBeAttached({ timeout: 5000 });

    // Exit selection mode with fresh Esc
    await page.keyboard.press('Escape');
    await expect(page.locator('style[data-vibe-cursor]')).not.toBeAttached({ timeout: 3000 });
  });

  test('A14 Independent editing: Badge click opens standalone popover with typing isolation, no whole-page hijack, and exits cleanly to IDLE', async ({
    page,
    backgroundWorker,
  }) => {
    const vibeRoot = page.locator('#vibe-annotations-root');

    // Seed an annotation on #canvas-rect
    await backgroundWorker.evaluate(async (data) => {
      await chrome.storage.local.set(data);
    }, {
      annotations: [
        {
          id: 'independent_test_annotation',
          url: `${FIXTURE_ORIGIN}/selected-rectangle.html`,
          selector: '#canvas-rect',
          comment: 'Existing note for independent edit',
          status: 'pending',
          created_at: new Date().toISOString(),
          updated_at: new Date().toISOString(),
        },
      ],
    });

    // Reload page
    await page.goto(`${FIXTURE_ORIGIN}/selected-rectangle.html`);
    await page.evaluate(() => window.__resetFixtureState());

    // Badge is visible
    const badge = vibeRoot.locator('.vibe-badge[data-annotation-id="independent_test_annotation"]');
    await expect(badge).toBeVisible({ timeout: 5000 });

    // Confirm Annotate mode is NOT active
    await expect(page.locator('style[data-vibe-cursor]')).not.toBeAttached();

    // Click badge to enter independent edit
    await badge.click();

    const popover = vibeRoot.locator('.vibe-popover');
    await expect(popover).toBeVisible({ timeout: 5000 });

    const textarea = popover.locator('.vibe-textarea');
    await expect(textarea).toBeFocused();

    // Clear event log
    await page.evaluate(() => (window.__EVENT_LOG = []));

    // Move cursor to end of existing selection before typing
    await page.keyboard.press('End');
    // Type inside the popover and press Backspace
    await page.keyboard.type(' additional');
    await page.keyboard.press('Backspace');
    await expect(textarea).toHaveValue('Existing note for independent edit additiona');

    // Host listeners received zero events
    const eventLogInEdit = await page.evaluate(() => window.__EVENT_LOG);
    expect(eventLogInEdit.length, 'Host listeners must receive zero events during popover typing').toBe(0);

    const stateDuringEdit = await page.evaluate(() => window.__FIXTURE_STATE);
    expect(stateDuringEdit.deleteCount).toBe(0);
    expect(stateDuringEdit.deleted).toBe(false);

    // Press Escape to dismiss the popover
    await page.keyboard.press('Escape');
    await expect(popover).not.toBeAttached({ timeout: 3000 });

    // Confirm that selection mode was NOT entered! Cursor must NOT be attached!
    await expect(page.locator('style[data-vibe-cursor]')).not.toBeAttached();

    // Host page is back to normal IDLE state: subsequent fresh Esc on host canvas deselects it
    await page.evaluate(() => (window.__EVENT_LOG = []));
    await page.keyboard.press('Escape');

    const stateAfterFreshEsc = await page.evaluate(() => window.__FIXTURE_STATE);
    expect(stateAfterFreshEsc.cancelCount, 'Fresh Esc after independent edit close must reach host').toBe(1);
    expect(stateAfterFreshEsc.selected, 'Fresh Esc must deselect host rectangle').toBe(false);
  });
});
