// The observable host contract shared by the framed fixtures (ticket #12).
//
// Loaded as a blocking <script src> from <head>, so its listeners are registered at
// parse time — the same timing contract as tests/fixtures/selected-rectangle.html.
// A frame exposes:
//   window.__FIXTURE_STATE — logical selection plus command counters,
//   window.__EVENT_LOG     — every key event the host listeners saw, with its phase,
//   window.__resetFixtureState() — back to the initial state.
(function () {
  const params = new URLSearchParams(window.location.search);

  window.__FIXTURE_STATE = {
    frameName: params.get('name') || 'top',
    selected: true,
    deleted: false,
    cancelCount: 0,
    deleteCount: 0,
    escCount: 0,
    backspaceCount: 0,
    earlyListenersRegisteredAt: 0
  };
  window.__EVENT_LOG = [];

  function recordEvent(phase, e) {
    window.__EVENT_LOG.push({
      type: e.type,
      key: e.key,
      code: e.code,
      repeat: e.repeat,
      phase: phase,
      defaultPrevented: e.defaultPrevented,
      timestamp: performance.now()
    });
  }

  window.__updateFixtureDOM = function () {
    const rect = document.getElementById('canvas-rect');
    if (!rect) return;
    rect.classList.toggle('selected', !!window.__FIXTURE_STATE.selected);
    rect.setAttribute('data-selected', String(!!window.__FIXTURE_STATE.selected));
  };

  // 1. Window capture listeners
  window.addEventListener('keydown', function (e) {
    recordEvent('window-capture', e);
    if (e.key === 'Escape') window.__FIXTURE_STATE.escCount++;
    if (e.key === 'Backspace') window.__FIXTURE_STATE.backspaceCount++;
  }, true);
  window.addEventListener('keyup', function (e) { recordEvent('window-capture', e); }, true);
  window.addEventListener('keypress', function (e) { recordEvent('window-capture', e); }, true);

  // 2. Document capture listeners
  document.addEventListener('keydown', function (e) { recordEvent('document-capture', e); }, true);
  document.addEventListener('keyup', function (e) { recordEvent('document-capture', e); }, true);
  document.addEventListener('keypress', function (e) { recordEvent('document-capture', e); }, true);

  // 3. Document bubble listeners (host application command dispatch)
  document.addEventListener('keydown', function (e) {
    recordEvent('document-bubble', e);
    if (e.key === 'Escape' && window.__FIXTURE_STATE.selected) {
      window.__FIXTURE_STATE.cancelCount++;
      window.__FIXTURE_STATE.selected = false;
      window.__updateFixtureDOM();
    }
    if ((e.key === 'Backspace' || e.key === 'Delete') && window.__FIXTURE_STATE.selected) {
      const isEditable = e.target && (e.target.tagName === 'INPUT' || e.target.tagName === 'TEXTAREA' || e.target.isContentEditable);
      if (!isEditable) {
        window.__FIXTURE_STATE.deleteCount++;
        window.__FIXTURE_STATE.deleted = true;
      }
    }
  }, false);

  // 4. Window bubble listeners and property handler
  window.addEventListener('keydown', function (e) { recordEvent('window-bubble', e); }, false);
  window.addEventListener('keyup', function (e) { recordEvent('window-bubble', e); }, false);
  window.onkeydown = function (e) { recordEvent('window-property', e); };

  // Timing evidence for the injection-path and frame-session checks.
  window.__FIXTURE_STATE.earlyListenersRegisteredAt = performance.now();

  window.__resetFixtureState = function () {
    window.__FIXTURE_STATE.selected = true;
    window.__FIXTURE_STATE.deleted = false;
    window.__FIXTURE_STATE.cancelCount = 0;
    window.__FIXTURE_STATE.deleteCount = 0;
    window.__FIXTURE_STATE.escCount = 0;
    window.__FIXTURE_STATE.backspaceCount = 0;
    window.__EVENT_LOG = [];
    window.__updateFixtureDOM();
  };
})();
