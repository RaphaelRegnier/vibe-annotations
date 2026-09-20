import {
  test,
  expect,
  FIXTURE_ORIGIN,
  enterAnnotateMode,
  openPopover,
  dispatchKeyWithRepeat,
  startComposition,
  updateComposition,
  commitComposition,
  instrumentEditor,
  readImeLog,
} from './fixtures.js';

// A7 — IME composition and candidate handling during annotation editing.
//
// Composition is driven through the browser's own input protocol
// (`Input.imeSetComposition` / `Input.insertText`), which performs real
// composition insertion in the renderer instead of dispatching fabricated DOM
// events. What this path can and cannot prove compared with an operating-system
// candidate window is documented in docs/e2e-testing.md.

const COMPOSITION_TEXT = 'にほん';

async function readAnnotations(backgroundWorker) {
  return backgroundWorker.evaluate(async () => (await chrome.storage.local.get(['annotations'])).annotations || []);
}

test.describe('A7: IME Composition & Candidate Handling (Ticket #9)', () => {
  test.beforeEach(async ({ page, backgroundWorker }) => {
    await backgroundWorker.evaluate(async () => {
      await chrome.storage.local.clear();
    });
    await page.goto(`${FIXTURE_ORIGIN}/selected-rectangle.html`);
    await page.evaluate(() => window.__resetFixtureState());
  });

  test('A7: composition text stays native in the editor and commits through the browser input protocol', async ({
    page,
    backgroundWorker,
  }) => {
    await enterAnnotateMode(page);
    const { textarea } = await openPopover(page);
    await instrumentEditor(page);
    await page.evaluate(() => (window.__EVENT_LOG = []));

    const cdp = await startComposition(page, COMPOSITION_TEXT);

    // The uncommitted composition string is displayed in the editor
    await expect(textarea).toHaveValue(COMPOSITION_TEXT);

    // Composition + input pipeline events are native browser events
    let imeLog = await readImeLog(page);
    const types = imeLog.map((e) => e.type);
    expect(types).toContain('compositionstart');
    expect(types).toContain('compositionupdate');
    const compositionInputs = imeLog.filter((e) => e.type === 'beforeinput' || e.type === 'input');
    expect(compositionInputs.length).toBeGreaterThan(0);
    expect(compositionInputs.every((e) => e.inputType === 'insertCompositionText' && e.isComposing === true)).toBe(true);
    expect(imeLog.every((e) => e.isTrusted === true), 'composition/input events must be trusted, not fabricated').toBe(true);

    // Candidate confirmation through the browser protocol commits the text
    await commitComposition(cdp, COMPOSITION_TEXT);
    await expect(textarea).toHaveValue(COMPOSITION_TEXT);

    imeLog = await readImeLog(page);
    const endEvents = imeLog.filter((e) => e.type === 'compositionend');
    expect(endEvents.length, 'committing must end the composition exactly once').toBe(1);

    // Native editing continues after the composition ends
    await page.keyboard.type('abc');
    await expect(textarea).toHaveValue(`${COMPOSITION_TEXT}abc`);

    // Normal commands work again: Esc closes the editor back to selection
    await page.keyboard.press('Escape');
    await expect(page.locator('.vibe-popover')).not.toBeAttached({ timeout: 3000 });
    await expect(page.locator('style[data-vibe-cursor]')).toBeAttached();

    // The host never saw composition keys, and nothing was saved by accident
    expect(await page.evaluate(() => window.__EVENT_LOG.length), 'Host must receive zero keyboard events').toBe(0);
    expect((await readAnnotations(backgroundWorker)).length).toBe(0);
  });

  test('A7: Enter and Escape during composition do not save, close the editor, or exit Annotate', async ({
    page,
    backgroundWorker,
  }) => {
    await enterAnnotateMode(page);
    const { popover, textarea } = await openPopover(page);
    await instrumentEditor(page);
    await page.evaluate(() => (window.__EVENT_LOG = []));

    const cdp = await startComposition(page, COMPOSITION_TEXT);
    await expect(textarea).toHaveValue(COMPOSITION_TEXT);

    // Candidate confirmation key (Enter) and candidate cancellation key (Esc),
    // including a held Enter (down, auto-repeat, up)
    await page.keyboard.press('Enter');
    await dispatchKeyWithRepeat(page, 'Enter', 'Enter', 13);
    await page.keyboard.press('Escape');

    // Editor stays open, Annotate mode stays active, focus stays in the editor
    await expect(popover).toBeAttached();
    await expect(textarea).toBeFocused();
    await expect(page.locator('style[data-vibe-cursor]')).toBeAttached();
    await expect(textarea).toHaveValue(COMPOSITION_TEXT);

    // The extension did not confirm or cancel the composition on its own
    const imeLog = await readImeLog(page);
    expect(imeLog.filter((e) => e.type === 'compositionend').length, 'composition must still be active').toBe(0);

    // The composition keeps flowing through the editor after those keys
    await updateComposition(cdp, `${COMPOSITION_TEXT}ご`);
    await expect(textarea).toHaveValue(`${COMPOSITION_TEXT}ご`);

    // Nothing was saved and the host saw no keyboard events
    expect((await readAnnotations(backgroundWorker)).length).toBe(0);
    const state = await page.evaluate(() => window.__FIXTURE_STATE);
    expect(state.cancelCount, 'Host Esc commands must not run').toBe(0);
    expect(state.deleteCount).toBe(0);
    expect(state.selected, 'Host rectangle stays selected').toBe(true);
    expect(await page.evaluate(() => window.__EVENT_LOG.length), 'Host must receive zero keyboard events').toBe(0);

    // Candidate confirmation via the browser protocol still commits the text
    await commitComposition(cdp, `${COMPOSITION_TEXT}ご`);
    await expect(textarea).toHaveValue(`${COMPOSITION_TEXT}ご`);

    // Normal commands resume when the composition has ended:
    // Esc closes the editor, a second Esc exits Annotate, a fresh Esc reaches the host
    await page.keyboard.press('Escape');
    await expect(popover).not.toBeAttached({ timeout: 3000 });
    await expect(page.locator('style[data-vibe-cursor]')).toBeAttached();

    await page.keyboard.press('Escape');
    await expect(page.locator('style[data-vibe-cursor]')).not.toBeAttached({ timeout: 3000 });

    const stateAfterExit = await page.evaluate(() => window.__FIXTURE_STATE);
    expect(stateAfterExit.cancelCount, 'Exiting Annotate must not leak Esc to the host').toBe(0);
    expect(stateAfterExit.selected).toBe(true);
    expect(await page.evaluate(() => window.__EVENT_LOG.length), 'Host must receive zero keyboard events from the session').toBe(0);

    // A fresh Esc after the session ended reaches the host again
    await page.evaluate(() => (window.__EVENT_LOG = []));
    await page.keyboard.press('Escape');
    const finalState = await page.evaluate(() => window.__FIXTURE_STATE);
    expect(finalState.cancelCount, 'A fresh Esc after exit must reach the host').toBe(1);
    expect(finalState.selected).toBe(false);
    const resumeLog = await page.evaluate(() => window.__EVENT_LOG);
    expect(resumeLog.some((e) => e.type === 'keydown' && e.key === 'Escape'), 'Host must receive the post-exit Esc').toBe(true);

    expect((await readAnnotations(backgroundWorker)).length).toBe(0);
  });

  test('A7: an aborted composition is discarded and does not save or exit, then save shortcut saves exactly once', async ({
    page,
    backgroundWorker,
  }) => {
    const vibeRoot = page.locator('#vibe-annotations-root');
    await enterAnnotateMode(page);
    const { popover, textarea } = await openPopover(page);
    await instrumentEditor(page);
    await page.evaluate(() => (window.__EVENT_LOG = []));

    const cdp = await startComposition(page, COMPOSITION_TEXT);
    await expect(textarea).toHaveValue(COMPOSITION_TEXT);

    // Abort the composition (empty candidate string) while pressing Esc
    await page.keyboard.press('Escape');
    await cdp.send('Input.imeSetComposition', { text: '', selectionStart: 0, selectionEnd: 0 });
    await expect(textarea).toHaveValue('');
    await expect(popover).toBeAttached();
    await expect(page.locator('style[data-vibe-cursor]')).toBeAttached();

    // Type a plain comment and save with the save shortcut
    await page.keyboard.type('plain comment');
    await expect(textarea).toHaveValue('plain comment');

    const isMac = process.platform === 'darwin';
    const modKey = isMac ? 'Meta' : 'Control';
    await page.keyboard.press(`${modKey}+Enter`);

    // Saved exactly once: one annotation, one badge, popover dismissed, still annotating
    await expect(popover).not.toBeAttached({ timeout: 5000 });
    await expect(vibeRoot.locator('.vibe-badge')).toHaveCount(1, { timeout: 5000 });
    await expect(page.locator('style[data-vibe-cursor]')).toBeAttached();

    const annotations = await readAnnotations(backgroundWorker);
    expect(annotations.length, 'Save shortcut must save exactly once').toBe(1);
    expect(annotations[0].comment).toBe('plain comment');

    expect(await page.evaluate(() => window.__EVENT_LOG.length), 'Host must receive zero keyboard events').toBe(0);
  });

  test('A7: composition in the standalone badge editor is protected without entering Annotate mode', async ({
    page,
    backgroundWorker,
  }) => {
    const vibeRoot = page.locator('#vibe-annotations-root');

    await backgroundWorker.evaluate(async (data) => {
      await chrome.storage.local.set(data);
    }, {
      annotations: [
        {
          id: 'ime_standalone_annotation',
          url: `${FIXTURE_ORIGIN}/selected-rectangle.html`,
          selector: '#canvas-rect',
          comment: 'Existing note',
          status: 'pending',
          created_at: new Date().toISOString(),
          updated_at: new Date().toISOString(),
        },
      ],
    });

    await page.goto(`${FIXTURE_ORIGIN}/selected-rectangle.html`);
    await page.evaluate(() => window.__resetFixtureState());

    const badge = vibeRoot.locator('.vibe-badge[data-annotation-id="ime_standalone_annotation"]');
    await expect(badge).toBeVisible({ timeout: 5000 });
    await badge.click();

    const popover = vibeRoot.locator('.vibe-popover');
    const textarea = popover.locator('.vibe-textarea');
    await expect(popover).toBeVisible({ timeout: 5000 });
    await expect(textarea).toBeFocused();
    await textarea.fill('');

    await instrumentEditor(page);
    await page.evaluate(() => (window.__EVENT_LOG = []));

    const cdp = await startComposition(page, COMPOSITION_TEXT);

    // Candidate confirmation and cancellation keys stay inert in the editor
    await page.keyboard.press('Enter');
    await page.keyboard.press('Escape');

    await expect(popover).toBeAttached();
    await expect(textarea).toBeFocused();
    await expect(page.locator('style[data-vibe-cursor]')).not.toBeAttached();
    const imeLog = await readImeLog(page);
    expect(imeLog.filter((e) => e.type === 'compositionend').length, 'composition must still be active').toBe(0);

    // Confirming the candidate via the browser protocol keeps the composed text
    await commitComposition(cdp, COMPOSITION_TEXT);
    await expect(textarea).toHaveValue(COMPOSITION_TEXT);

    // The standalone editor still closes with Esc, stays out of Annotate mode,
    // and the host is reachable again afterwards
    await page.keyboard.press('Escape');
    await expect(popover).not.toBeAttached({ timeout: 3000 });
    await expect(page.locator('style[data-vibe-cursor]')).not.toBeAttached();

    expect(await page.evaluate(() => window.__EVENT_LOG.length), 'Host must receive zero keyboard events from the standalone editor').toBe(0);

    await page.keyboard.press('Escape');
    const state = await page.evaluate(() => window.__FIXTURE_STATE);
    expect(state.cancelCount, 'A fresh Esc after closing the standalone editor must reach the host').toBe(1);
    expect(state.selected).toBe(false);
  });
});
