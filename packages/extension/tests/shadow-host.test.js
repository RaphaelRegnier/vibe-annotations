import test from 'node:test';
import assert from 'node:assert';

test('shadow-host contains keyboard events at hostEl boundary', async () => {
  const registeredListeners = {};
  const mockHostEl = {
    id: '',
    style: {},
    attachShadow: () => ({ appendChild: () => {} }),
    addEventListener: (type, fn) => {
      registeredListeners[type] = fn;
    },
    parentNode: null
  };

  globalThis.document = {
    createElement: (tag) => {
      if (tag === 'div') return mockHostEl;
      return { appendChild: () => {}, style: {} };
    },
    body: {
      appendChild: (el) => {
        mockHostEl.parentNode = globalThis.document.body;
      }
    }
  };

  // Import after setting up mock DOM
  const { default: VibeShadowHost } = await import('../lib/content/shadow-host.js');

  VibeShadowHost.init();

  const requiredEvents = ['keydown', 'keyup', 'keypress', 'pointerdown', 'mousedown', 'click', 'focusin', 'focusout'];
  for (const ev of requiredEvents) {
    assert.ok(registeredListeners[ev], `Expected listener for ${ev} on hostEl`);

    let stopped = false;
    const fakeEvent = {
      stopPropagation: () => {
        stopped = true;
      }
    };
    registeredListeners[ev](fakeEvent);
    assert.strictEqual(stopped, true, `Expected stopPropagation() to be called for ${ev}`);
  }
});
