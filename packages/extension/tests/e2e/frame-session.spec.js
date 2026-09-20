import {
  test,
  expect,
  FIXTURE_ORIGIN,
  UNLISTED_ORIGIN,
  enterAnnotateMode,
  routeFramedFixture,
  framedFixtureUrl,
  waitForFixtureFrames,
  readSessionEvidence,
  readFrameFixtureState,
  injectContentScriptsAsToolbarIcon,
} from './fixtures.js';

// Ticket #12 / A15: one Annotate session per tab, shared with every frame the
// extension is authorized and able to control. Keyboard focus moving between the top
// page, same-origin frames and already-authorized cross-origin frames must not leak
// host shortcuts, and exiting must release protection everywhere it applies.
//
// Frame origins (route-fulfilled by the test runner, see docs/e2e-testing.md §10):
//   - same origin as the top page,
//   - an authorized cross-origin host, inside the declared host permissions,
//   - an origin outside every declared permission, which is never injectable and must
//     never be represented as protected.

const TOP_ORIGIN = FIXTURE_ORIGIN;

async function openFramedFixture(page, context, { topOrigin = TOP_ORIGIN, ...origins } = {}) {
  await routeFramedFixture(context, topOrigin, origins);
  await page.goto(framedFixtureUrl(topOrigin, origins));

  await expect(page.locator('#vibe-annotations-root')).toBeAttached({ timeout: 10000 });
  const frames = await waitForFixtureFrames(page);

  // The manifest content script is registered for all frames, so both controllable
  // frames have their own extension instance before any session exists.
  await expect(frames.sameOrigin.locator('#vibe-annotations-root')).toBeAttached({ timeout: 10000 });
  await expect(frames.crossOrigin.locator('#vibe-annotations-root')).toBeAttached({ timeout: 10000 });

  return frames;
}

// The session evidence a frame publishes on its own shadow host. `mirror` is only
// asserted when the scenario has an opinion about which frame owns the state machine.
async function expectSessionState(target, state, { mirror } = {}) {
  const host = target.locator('#vibe-annotations-root');
  await expect(host).toHaveAttribute('data-vibe-session-state', state, { timeout: 10000 });
  if (mirror !== undefined) {
    await expect(host).toHaveAttribute('data-vibe-session-mirror', String(mirror));
  }
}

// A controllable frame that no longer participates releases to the idle state and
// drops the overlay it was annotating with.
async function expectReleasedSession(target) {
  await expect(target.locator('style[data-vibe-cursor]')).not.toBeAttached({ timeout: 5000 });
  await expect(target.locator('#vibe-annotations-root'))
    .toHaveAttribute('data-vibe-session-state', 'idle', { timeout: 5000 });
}

const readTopState = (page) => page.evaluate(() => window.__FIXTURE_STATE);

test.describe('Frame Session Synchronization (Ticket #12)', () => {
  test('A15 frames: same-origin and authorized cross-origin frames share one session and release together', async ({
    page,
    context,
  }) => {
    const frames = await openFramedFixture(page, context);

    // The frame origins really are distinct levels: same-origin, cross-origin.
    expect(new URL(frames.sameOrigin.url()).origin).toBe(new URL(page.url()).origin);
    expect(new URL(frames.crossOrigin.url()).origin).not.toBe(new URL(page.url()).origin);
    expect(await frames.crossOrigin.evaluate(() => window.__FIXTURE_STATE.frameName)).toBe('cross-origin');

    // Outside a session every level owns its own keyboard.
    await expectSessionState(page, 'idle', { mirror: false });
    await expectSessionState(frames.sameOrigin, 'idle', { mirror: false });
    await expectSessionState(frames.crossOrigin, 'idle', { mirror: false });

    // Entering Annotate on the top page activates the shared session in every
    // controllable frame, and each frame says so on its own host.
    await enterAnnotateMode(page);
    await expectSessionState(page, 'selection', { mirror: false });
    await expectSessionState(frames.sameOrigin, 'selection', { mirror: true });
    await expectSessionState(frames.crossOrigin, 'selection', { mirror: true });

    // The mirrored frames activate their own overlay, so annotating from a frame is
    // the same action as annotating from the top page.
    await expect(frames.sameOrigin.locator('style[data-vibe-cursor]')).toBeAttached();
    await expect(frames.crossOrigin.locator('style[data-vibe-cursor]')).toBeAttached();

    // --- Focus transition into the same-origin frame ---
    // Clicking the host rectangle there is a real element selection: the frame's own
    // state machine drives it and the state change is published to the tab.
    await frames.sameOrigin.locator('#canvas-rect').click();
    await expect(frames.sameOrigin.locator('#vibe-annotations-root').locator('.vibe-popover'))
      .toBeVisible({ timeout: 5000 });
    await expectSessionState(frames.sameOrigin, 'editing');
    await expectSessionState(frames.crossOrigin, 'selection');

    // Editor Esc returns to selection without ending the session.
    await page.keyboard.press('Escape');
    await expect(frames.sameOrigin.locator('#vibe-annotations-root').locator('.vibe-popover'))
      .not.toBeVisible({ timeout: 5000 });
    await expectSessionState(frames.sameOrigin, 'selection');
    await expectSessionState(frames.crossOrigin, 'selection', { mirror: true });

    // Keys sent while the frame has focus are owned by the session, not the frame's
    // host: the frame's window/document capture, bubble and property listeners and
    // its host commands receive nothing.
    await frames.sameOrigin.evaluate(() => { window.__EVENT_LOG = []; });
    await page.keyboard.press('ArrowDown');
    await page.keyboard.press('ArrowUp');
    await page.keyboard.press('KeyA');
    await page.keyboard.press('Backspace');

    let child = await readFrameFixtureState(frames.sameOrigin);
    expect(child.log.length, 'Focused frame host listeners must receive zero events').toBe(0);
    expect(child.state.selected, 'Focused frame host selection must be untouched').toBe(true);
    expect(child.state.cancelCount).toBe(0);
    expect(child.state.deleteCount).toBe(0);

    // --- Held exit key across the frame boundary ---
    // The press exits the shared session; its repeat and release belong to the
    // consumed keystroke and must not reach the frame's host afterwards.
    await page.keyboard.down('Escape');
    await page.keyboard.down('Escape');
    await page.keyboard.up('Escape');

    await expectSessionState(page, 'idle');
    await expectSessionState(frames.sameOrigin, 'idle');
    await expectSessionState(frames.crossOrigin, 'idle');
    await expect(page.locator('style[data-vibe-cursor]')).not.toBeAttached({ timeout: 5000 });
    await expectReleasedSession(frames.crossOrigin);

    child = await readFrameFixtureState(frames.sameOrigin);
    expect(child.state.escCount, 'Exit key, repeat and release must stay inside the session').toBe(0);
    expect(child.state.selected, 'Host selection must survive the exit').toBe(true);

    const topAfterExit = await readTopState(page);
    expect(topAfterExit.cancelCount, 'Exit key must not reach the top page host').toBe(0);
    expect(topAfterExit.selected).toBe(true);

    // --- Fresh keys after exit reach the frame that has focus ---
    await page.keyboard.press('Escape');
    const fresh = await readFrameFixtureState(frames.sameOrigin);
    expect(fresh.state.escCount, 'A fresh Esc after exit must reach the focused frame host').toBe(1);
    expect(fresh.state.cancelCount).toBe(1);
    expect(fresh.state.selected).toBe(false);
    const topUntouched = await readTopState(page);
    expect(topUntouched.cancelCount, 'The fresh key belongs to the focused frame only').toBe(0);
  });

  test('A15 cross-origin frame: keyboard isolation and extension actions follow focus into an authorized frame', async ({
    page,
    context,
  }) => {
    const frames = await openFramedFixture(page, context);

    await enterAnnotateMode(page);
    await expectSessionState(frames.crossOrigin, 'selection', { mirror: true });

    // Annotating from the cross-origin frame: select an element there and save.
    await frames.crossOrigin.locator('#canvas-rect').click();
    const vibeRoot = frames.crossOrigin.locator('#vibe-annotations-root');
    const popover = vibeRoot.locator('.vibe-popover');
    await expect(popover).toBeVisible({ timeout: 5000 });

    const textarea = popover.locator('.vibe-textarea');
    await expect(textarea).toBeFocused();
    await textarea.fill('annotation from an authorized cross-origin frame');

    // Typing and editing stay native inside the extension editor.
    await page.keyboard.press('Backspace');
    await expect(textarea).toHaveValue('annotation from an authorized cross-origin fram');

    const isMac = process.platform === 'darwin';
    await page.keyboard.press(isMac ? 'Meta+Enter' : 'Control+Enter');
    await expect(vibeRoot.locator('.vibe-badge')).toHaveCount(1, { timeout: 5000 });

    // The save shortcut ran exactly once in the frame's own session, and the frame's
    // host received none of it.
    const child = await readFrameFixtureState(frames.crossOrigin);
    expect(child.log.length, 'Cross-origin frame host listeners must receive zero events').toBe(0);
    expect(child.state.selected).toBe(true);
    expect(child.state.cancelCount).toBe(0);
    expect(child.state.deleteCount).toBe(0);
    expect((await readTopState(page)).cancelCount).toBe(0);

    // The session continues in the frame after the save (selection mode), and an
    // exit from the frame releases every level.
    await expectSessionState(frames.crossOrigin, 'selection');
    await page.keyboard.press('Escape');
    await expectSessionState(page, 'idle');
    await expectSessionState(frames.sameOrigin, 'idle');
    await expectSessionState(frames.crossOrigin, 'idle');
    await expectReleasedSession(frames.sameOrigin);

    // The frame keeps its own keyboard afterwards.
    await page.keyboard.press('Escape');
    const afterExit = await readFrameFixtureState(frames.crossOrigin);
    expect(afterExit.state.escCount).toBe(1);
    expect(afterExit.state.cancelCount).toBe(1);
  });

  test('A15 frame lifecycle: frame navigation and removal keep the tab session coherent', async ({
    page,
    context,
  }) => {
    const frames = await openFramedFixture(page, context);

    await enterAnnotateMode(page);
    await expectSessionState(frames.sameOrigin, 'selection', { mirror: true });
    await expectSessionState(frames.crossOrigin, 'selection', { mirror: true });

    // --- The host navigates a frame that is only mirroring the session ---
    await page.evaluate(() => window.__setFrameSrc('same-origin-frame', 'frame-child.html?name=same-origin-2'));
    const navigatedFrame = page.frameLocator('iframe[name="same-origin"]');
    await expect(navigatedFrame.locator('#frame-title'))
      .toContainText('same-origin-2', { timeout: 10000 });
    const navigated = page.frame({ name: 'same-origin' });

    // The replacement document joins the session that is still running, so the frame
    // gap cannot leak host shortcuts, and the top page's session is unaffected.
    await expectSessionState(navigated, 'selection', { mirror: true });
    await expectSessionState(page, 'selection');
    await expectSessionState(frames.crossOrigin, 'selection', { mirror: true });

    // --- The host removes a frame that is only mirroring the session ---
    await page.evaluate(() => window.__removeFrame('cross-origin-frame'));
    await expect(page.locator('iframe[name="cross-origin"]')).toHaveCount(0);
    await expectSessionState(page, 'selection');
    await expectSessionState(navigated, 'selection', { mirror: true });

    // Session exit is consistent: leaving from the top page after one frame
    // navigated and another was removed releases every level that remains.
    await page.locator('#canvas-rect').click();
    await expect(page.locator('#vibe-annotations-root').locator('.vibe-popover'))
      .toBeVisible({ timeout: 5000 });
    await page.keyboard.press('Escape');
    await expectSessionState(page, 'selection');
    await page.keyboard.press('Escape');
    await expectSessionState(page, 'idle');
    await expectSessionState(navigated, 'idle');
    const top = await readTopState(page);
    expect(top.cancelCount, 'Exit keys must not leak into the host').toBe(0);
    expect(top.selected).toBe(true);

    // --- The document that owns the session is destroyed ---
    // A frame whose own state machine drives the session reports the release when its
    // document goes away: nothing else can observe that the owner is gone, and leaving
    // peers protecting a session nobody drives is exactly the stale protection the
    // contract forbids.
    await enterAnnotateMode(navigated);
    await expectSessionState(navigated, 'selection', { mirror: false });
    await expectSessionState(page, 'selection', { mirror: true });

    await page.evaluate(() => window.__setFrameSrc('same-origin-frame', 'frame-child.html?name=same-origin-3'));
    await expect(page.frameLocator('iframe[name="same-origin"]').locator('#frame-title'))
      .toContainText('same-origin-3', { timeout: 10000 });
    const replacement = page.frame({ name: 'same-origin' });

    await expectSessionState(page, 'idle');
    await expect(replacement.locator('#vibe-annotations-root')).toHaveAttribute('data-vibe-session-state', 'idle');
    await expect(page.locator('style[data-vibe-cursor]')).not.toBeAttached({ timeout: 5000 });

    // --- The frame that owns the session is removed outright ---
    await enterAnnotateMode(replacement);
    await expectSessionState(page, 'selection', { mirror: true });

    await page.evaluate(() => window.__removeFrame('same-origin-frame'));
    await expect(page.locator('iframe[name="same-origin"]')).toHaveCount(0);
    await expectSessionState(page, 'idle');
    await expect(page.locator('style[data-vibe-cursor]')).not.toBeAttached({ timeout: 5000 });

    // The host owns its keyboard again: a fresh key belongs to it.
    await page.locator('#canvas-rect').click();
    await page.keyboard.press('Escape');
    const finalTop = await readTopState(page);
    expect(finalTop.cancelCount, 'A fresh Esc after the owner frame is gone must reach the host').toBe(1);
    expect(finalTop.selected).toBe(false);
  });

  test('A15 unauthorized frames: a non-injectable frame is never represented as protected', async ({
    page,
    context,
  }) => {
    const frames = await openFramedFixture(page, context);

    // The unlisted origin is outside every declared host permission, so the
    // extension is not injected there at all: no UI, no session evidence.
    expect(new URL(frames.unlisted.url()).origin).toBe(new URL(UNLISTED_ORIGIN).origin);
    await expect(frames.unlisted.locator('#vibe-annotations-root')).toHaveCount(0);
    expect(await readSessionEvidence(frames.unlisted)).toBeNull();

    await enterAnnotateMode(page);
    await expectSessionState(page, 'selection');
    await expectSessionState(frames.sameOrigin, 'selection', { mirror: true });
    await expectSessionState(frames.crossOrigin, 'selection', { mirror: true });

    // Still nothing is claimed for the frame the extension cannot reach.
    await expect(frames.unlisted.locator('#vibe-annotations-root')).toHaveCount(0);
    expect(await readSessionEvidence(frames.unlisted)).toBeNull();

    // The honest consequence: keys pressed while that frame has focus reach its own
    // host, because the extension has no instance there. The session does not
    // pretend to cover it, and the top page's session is untouched by it.
    await frames.unlisted.locator('#canvas-rect').click();
    await page.keyboard.press('Escape');
    const unlisted = await readFrameFixtureState(frames.unlisted);
    expect(unlisted.state.escCount, 'Unprotected frame keeps its own keyboard').toBe(1);
    expect(unlisted.state.cancelCount).toBe(1);
    expect(unlisted.state.selected).toBe(false);

    const top = await readTopState(page);
    expect(top.cancelCount, 'The protected session is unaffected by the frame it cannot reach').toBe(0);
    expect(top.selected).toBe(true);
    await expectSessionState(page, 'selection');
    await expectSessionState(frames.crossOrigin, 'selection', { mirror: true });
  });

  test('A15 dynamic registration: frames of a dynamically enabled site participate in the session', async ({
    page,
    context,
    backgroundWorker,
  }) => {
    const CONTROLLED_ORIGIN = 'http://vibe-injection.test:3005';
    const CONTROLLED_PATTERN = `${CONTROLLED_ORIGIN}/*`;
    await routeFramedFixture(context, CONTROLLED_ORIGIN);

    // A page whose extension instance could not initialize, reached at runtime.
    await page.goto(`${CONTROLLED_ORIGIN}/selected-rectangle.html?bootFail=true`);
    await expect(page.locator('#vibe-annotations-root')).toHaveCount(0);
    await page.evaluate(() => document.documentElement.removeAttribute('data-vibe-boot-fail'));

    await page.bringToFront();
    await injectContentScriptsAsToolbarIcon(backgroundWorker, {
      bootIntent: 'show-permission-prompt',
      bootData: { originPattern: CONTROLLED_PATTERN, hostname: 'vibe-injection.test' },
    });

    const enableBtn = page.locator('#vibe-annotations-root').locator('.vibe-permission-primary');
    await expect(enableBtn).toBeVisible({ timeout: 10000 });
    await enableBtn.click();

    // The dynamic registration covers frames, exactly like the manifest registration.
    await expect.poll(
      async () => (await backgroundWorker.evaluate(() => chrome.scripting.getRegisteredContentScripts()))
        .some((s) => s.matches.includes(CONTROLLED_PATTERN) && s.allFrames === true),
      { timeout: 10000 }
    ).toBe(true);
    const registration = (await backgroundWorker.evaluate(() => chrome.scripting.getRegisteredContentScripts()))
      .find((s) => s.matches.includes(CONTROLLED_PATTERN));
    expect(registration.runAt).toBe('document_start');
    expect(registration.world).toBe('ISOLATED');
    expect(registration.allFrames).toBe(true);

    // Frames of the enabled origin take part in one session with the top page.
    await page.goto(framedFixtureUrl(CONTROLLED_ORIGIN));
    await expect(page.locator('#vibe-annotations-root')).toBeAttached({ timeout: 10000 });
    const frames = await waitForFixtureFrames(page);
    await expect(frames.sameOrigin.locator('#vibe-annotations-root')).toBeAttached({ timeout: 10000 });
    await expect(frames.crossOrigin.locator('#vibe-annotations-root')).toBeAttached({ timeout: 10000 });

    await enterAnnotateMode(page);
    await expectSessionState(frames.sameOrigin, 'selection', { mirror: true });
    await expectSessionState(frames.crossOrigin, 'selection', { mirror: true });

    await page.keyboard.press('Escape');
    await expectSessionState(page, 'idle');
    await expectSessionState(frames.sameOrigin, 'idle');
    await expectSessionState(frames.crossOrigin, 'idle');
  });
});
