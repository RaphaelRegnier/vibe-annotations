import fs from 'node:fs';
import path from 'node:path';
import {
  test,
  expect,
  FIXTURE_ORIGIN,
  EXTENSION_PATH,
  enterAnnotateMode,
  openPopover,
  routeControlledOrigin,
  injectContentScriptsAsToolbarIcon,
  readKeyboardEvidence,
} from './fixtures.js';

// Ticket #11 / A16: the early keyboard capture must be installed by both registration
// paths before a page's own parse-time listeners, and a runtime injection that cannot
// achieve that must say so instead of claiming complete isolation.
//
// Controlled origin: route-fulfilled on a reserved-TLD host so every test owns an
// isolated origin and profile. It is inside the extension's declared test/localhost
// host permissions (the test profile pre-grants only those), which is what makes
// runtime injection and site enable reachable without answering the native permission
// bubble — see docs/e2e-testing.md for the coverage boundary.
const CONTROLLED_ORIGIN = 'http://vibe-injection.test:3005';
const CONTROLLED_PATTERN = `${CONTROLLED_ORIGIN}/*`;

const readState = (page) => page.evaluate(() => window.__FIXTURE_STATE);
const readLog = (page) => page.evaluate(() => window.__EVENT_LOG);
const readRegistrations = (backgroundWorker) =>
  backgroundWorker.evaluate(() => chrome.scripting.getRegisteredContentScripts());

// A page whose extension instance could not initialize: no UI, no keyboard ownership,
// host listeners already registered — the state a runtime injection finds on a page
// that was loaded before the extension could protect it. The controlled fault is
// cleared afterwards so the injected instance can boot (tests/fixtures/selected-rectangle.html).
async function openPageWithoutProtection(page) {
  await page.goto(`${CONTROLLED_ORIGIN}/selected-rectangle.html?bootFail=true`);
  await expect(page.locator('#vibe-annotations-root')).toHaveCount(0);
  await expect(page.locator('style[data-vibe-cursor]')).not.toBeAttached();
  await page.evaluate(() => document.documentElement.removeAttribute('data-vibe-boot-fail'));
}

test.describe('Keyboard Injection Paths (Ticket #11)', () => {
  test('A16 static: manifest registration installs early capture before host parse-time listeners', async ({ page }) => {
    // Registration evidence: the static entry point is a document_start ISOLATED
    // script in the built manifest, and no site permissions were added for this work.
    const manifest = JSON.parse(fs.readFileSync(path.join(EXTENSION_PATH, 'manifest.json'), 'utf-8'));
    const contentScript = manifest.content_scripts.find((cs) => cs.js.includes('content-scripts/content.js'));
    expect(contentScript.run_at).toBe('document_start');
    expect(contentScript.world ?? 'ISOLATED').toBe('ISOLATED');
    expect(contentScript.all_frames).toBe(true);
    expect(manifest.permissions).toEqual(['activeTab', 'storage', 'scripting']);
    expect(manifest.optional_host_permissions).toEqual(['*://*/*', '<all_urls>']);
    expect(manifest.host_permissions).toEqual([
      'http://localhost/*',
      'https://localhost/*',
      'http://127.0.0.1/*',
      'https://127.0.0.1/*',
      'http://0.0.0.0/*',
      'https://0.0.0.0/*',
      'http://*.local/*',
      'https://*.local/*',
      'http://*.test/*',
      'https://*.test/*',
      'http://*.localhost/*',
      'https://*.localhost/*',
      'file:///*',
    ]);

    await page.goto(`${FIXTURE_ORIGIN}/selected-rectangle.html`);
    const vibeRoot = page.locator('#vibe-annotations-root');
    await expect(vibeRoot).toBeAttached({ timeout: 10000 });

    // Timing/world evidence: the router installed while the document was still
    // parsing, before the fixture's earliest host listeners were registered.
    const fixtureState = await readState(page);
    const evidence = await readKeyboardEvidence(page);
    expect(evidence.world).toBe('ISOLATED');
    expect(evidence.runAt).toBe('loading');
    expect(evidence.earlyCapture).toBe(true);
    expect(evidence.lateInjection).toBe(false);
    expect(evidence.installedAt).toBeLessThan(fixtureState.earlyListenersRegisteredAt);

    // Full protection is claimed: no refresh guidance is shown.
    await expect(vibeRoot.locator('.vibe-refresh-banner')).toHaveCount(0);

    // Early window capture, document capture/bubble and property listeners receive no
    // annotation-mode keys, including keypress events.
    await enterAnnotateMode(page);
    await page.evaluate(() => (window.__EVENT_LOG = []));
    await page.keyboard.press('ArrowDown');
    await page.keyboard.press('ArrowUp');
    await page.keyboard.press('KeyA');

    const log = await readLog(page);
    expect(log.filter((e) => e.type === 'keydown').length, 'Host received leaked keydowns').toBe(0);
    expect(log.filter((e) => e.type === 'keypress').length, 'Host received leaked keypress events').toBe(0);
    expect(log.length, 'Host listeners must receive zero events during Annotate').toBe(0);

    // Exiting keeps host state intact, and the host owns the same listeners again.
    await page.keyboard.press('Escape');
    await expect(page.locator('style[data-vibe-cursor]')).not.toBeAttached({ timeout: 5000 });
    let state = await readState(page);
    expect(state.cancelCount, 'Exit Esc must stay inside the session').toBe(0);
    expect(state.selected, 'Host selection untouched by the session').toBe(true);

    await page.keyboard.press('Escape');
    state = await readState(page);
    expect(state.cancelCount, 'Fresh Esc must reach the preserved host listeners').toBe(1);
    expect(state.selected).toBe(false);
  });

  test('A16 late injection: runtime injection asks for a reload instead of claiming isolation', async ({
    page,
    context,
    backgroundWorker,
  }) => {
    await routeControlledOrigin(context, CONTROLLED_ORIGIN);
    await openPageWithoutProtection(page);

    const fixtureState = await readState(page);
    expect(fixtureState.earlyListenersRegisteredAt).toBeGreaterThan(0);

    // The toolbar-icon click is browser UI, so the test performs the injection the
    // icon handler performs on an already-loaded page.
    await page.bringToFront();
    await injectContentScriptsAsToolbarIcon(backgroundWorker);

    const vibeRoot = page.locator('#vibe-annotations-root');
    await expect(vibeRoot.locator('.vibe-toolbar')).toBeVisible({ timeout: 10000 });

    // The refresh requirement is explicit and visible.
    const banner = vibeRoot.locator('.vibe-refresh-banner');
    await expect(banner).toBeVisible();
    await expect(banner).toContainText(/reload/i);
    await expect(banner.locator('.vibe-refresh-action')).toBeVisible();

    // Timing/world evidence for the late path.
    const evidence = await readKeyboardEvidence(page);
    expect(evidence.world).toBe('ISOLATED');
    expect(evidence.runAt).not.toBe('loading');
    expect(evidence.lateInjection).toBe(true);
    expect(evidence.earlyCapture).toBe(false);
    expect(evidence.installedAt).toBeGreaterThan(fixtureState.earlyListenersRegisteredAt);

    // The claim is honest: the key already reached the host's parse-time listener,
    // which is exactly why the reload notice is shown instead of a full-isolation claim.
    await enterAnnotateMode(page);
    await page.evaluate(() => (window.__EVENT_LOG = []));
    await page.keyboard.press('ArrowDown');
    const lateLog = await readLog(page);
    expect(lateLog.some((e) => e.key === 'ArrowDown'), 'Late injection cannot precede host parse-time listeners').toBe(true);

    // The session stays usable: partial protection still keeps host commands out,
    // and the exit key is drained out of the session.
    await page.keyboard.press('Escape');
    await expect(page.locator('style[data-vibe-cursor]')).not.toBeAttached({ timeout: 5000 });
    const state = await readState(page);
    expect(state.cancelCount, 'Host commands stay blocked by the session').toBe(0);
    expect(state.selected, 'Host selection stays untouched by the session').toBe(true);
    expect(state.escCount, 'Exit key reached host capture listeners before the router').toBeGreaterThan(0);
  });

  test('A16 dynamic: site enable registers document_start capture and the reloaded page is fully isolated', async ({
    page,
    context,
    backgroundWorker,
  }) => {
    await routeControlledOrigin(context, CONTROLLED_ORIGIN);
    await openPageWithoutProtection(page);

    let registrations = await readRegistrations(backgroundWorker);
    expect(registrations.some((s) => s.matches.includes(CONTROLLED_PATTERN))).toBe(false);

    // Production permission modal on a page the extension only reaches at runtime;
    // its "Enable on this site" click drives the real grant handling.
    await page.bringToFront();
    await injectContentScriptsAsToolbarIcon(backgroundWorker, {
      bootIntent: 'show-permission-prompt',
      bootData: { originPattern: CONTROLLED_PATTERN, hostname: 'vibe-injection.test' },
    });

    const vibeRoot = page.locator('#vibe-annotations-root');
    const enableBtn = vibeRoot.locator('.vibe-permission-primary');
    await expect(enableBtn).toBeVisible({ timeout: 10000 });
    await enableBtn.click();

    // Actual dynamic registration, with the same early timing and world as the manifest.
    await expect
      .poll(async () => (await readRegistrations(backgroundWorker)).some((s) => s.matches.includes(CONTROLLED_PATTERN)), {
        timeout: 10000,
      })
      .toBe(true);
    registrations = await readRegistrations(backgroundWorker);
    const siteScript = registrations.find((s) => s.matches.includes(CONTROLLED_PATTERN));
    expect(siteScript.runAt).toBe('document_start');
    expect(siteScript.world).toBe('ISOLATED');
    expect(siteScript.persistAcrossSessions).toBe(true);
    const { vibeEnabledSites } = await backgroundWorker.evaluate(() => chrome.storage.local.get(['vibeEnabledSites']));
    expect(vibeEnabledSites).toContain(CONTROLLED_PATTERN);

    // The instance that just arrived is late, so it asks for the reload.
    await expect(vibeRoot.locator('.vibe-toolbar')).toBeVisible({ timeout: 10000 });
    await expect(vibeRoot.locator('.vibe-refresh-banner')).toBeVisible();
    const lateEvidence = await readKeyboardEvidence(page);
    expect(lateEvidence.earlyCapture).toBe(false);
    expect(lateEvidence.lateInjection).toBe(true);

    // After the reload the dynamically enabled page passes the early-capture checks.
    await page.goto(`${CONTROLLED_ORIGIN}/selected-rectangle.html`);
    await expect(vibeRoot).toBeAttached({ timeout: 10000 });

    const fixtureState = await readState(page);
    const evidence = await readKeyboardEvidence(page);
    expect(evidence.world).toBe('ISOLATED');
    expect(evidence.runAt).toBe('loading');
    expect(evidence.earlyCapture).toBe(true);
    expect(evidence.lateInjection).toBe(false);
    expect(evidence.installedAt).toBeLessThan(fixtureState.earlyListenersRegisteredAt);
    await expect(vibeRoot.locator('.vibe-refresh-banner')).toHaveCount(0);

    // Full isolation on the reloaded page: host capture/bubble/property listeners see
    // no annotation-mode keys and host commands do not run.
    await enterAnnotateMode(page);
    await page.evaluate(() => (window.__EVENT_LOG = []));
    await page.keyboard.press('ArrowDown');
    await page.keyboard.press('ArrowUp');
    await page.keyboard.press('KeyA');
    expect((await readLog(page)).length, 'Host listeners must receive zero events after the reload').toBe(0);

    await page.keyboard.press('Escape');
    await expect(page.locator('style[data-vibe-cursor]')).not.toBeAttached({ timeout: 5000 });
    let state = await readState(page);
    expect(state.cancelCount, 'Exit Esc must stay inside the session').toBe(0);
    expect(state.selected).toBe(true);

    await page.keyboard.press('Escape');
    state = await readState(page);
    expect(state.cancelCount, 'Fresh Esc must reach the host after the reloaded session').toBe(1);
    expect(state.selected).toBe(false);

    // Annotation startup keeps working on the dynamically enabled origin.
    await page.evaluate(() => window.__resetFixtureState());
    await enterAnnotateMode(page);
    const { textarea } = await openPopover(page);
    await textarea.fill('dynamic origin annotation');
    const isMac = process.platform === 'darwin';
    await page.keyboard.press(isMac ? 'Meta+Enter' : 'Control+Enter');
    await expect(vibeRoot.locator('.vibe-badge')).toHaveCount(1, { timeout: 5000 });
  });
});
