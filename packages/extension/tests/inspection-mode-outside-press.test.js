import test from 'node:test';
import assert from 'node:assert';

test('inspection mode swallows all mouse events and does not trigger dismiss listeners', async () => {
  // Track events that reach the host document / dialog dismiss listener
  const hostReceivedEvents = [];

  // Mock DOM implementation
  class MockNode {
    constructor(name) {
      this.nodeName = name;
      this.tagName = name.toUpperCase();
      this.id = '';
      this.className = '';
      this.style = {};
      this.children = [];
      this.parentNode = null;
      this.isConnected = true;
      this.listeners = {};
      this.attributes = {};
    }
    setAttribute(name, val) {
      this.attributes[name] = val;
    }
    removeAttribute(name) {
      delete this.attributes[name];
    }
    getAttribute(name) {
      return this.attributes[name] || null;
    }
    hasAttribute(name) {
      return name in this.attributes;
    }
    addEventListener(type, fn) {
      this.listeners[type] = this.listeners[type] || [];
      this.listeners[type].push(fn);
    }
    removeEventListener(type, fn) {
      if (this.listeners[type]) {
        this.listeners[type] = this.listeners[type].filter(f => f !== fn);
      }
    }
    appendChild(child) {
      this.children.push(child);
      child.parentNode = this;
      return child;
    }
    remove() {
      if (this.parentNode) {
        const idx = this.parentNode.children.indexOf(this);
        if (idx !== -1) this.parentNode.children.splice(idx, 1);
        this.parentNode = null;
      }
    }
    getBoundingClientRect() {
      return { top: 100, left: 100, width: 200, height: 200 };
    }
  }
  globalThis.Element = MockNode;

  const windowListeners = { capture: {}, bubble: {} };
  const documentListeners = { capture: {}, bubble: {} };

  globalThis.window = {
    innerWidth: 1920,
    innerHeight: 1080,
    addEventListener: (type, fn, capture = false) => {
      const phase = (typeof capture === 'object' ? capture.capture : capture) ? 'capture' : 'bubble';
      windowListeners[phase][type] = windowListeners[phase][type] || [];
      windowListeners[phase][type].push(fn);
    },
    removeEventListener: (type, fn, capture = false) => {
      const phase = (typeof capture === 'object' ? capture.capture : capture) ? 'capture' : 'bubble';
      if (windowListeners[phase][type]) {
        windowListeners[phase][type] = windowListeners[phase][type].filter(f => f !== fn);
      }
    }
  };

  const mockRoot = new MockNode('div');
  mockRoot.id = 'vibe-annotations-root';
  const mockShadow = {
    appendChild: (el) => { mockRoot.appendChild(el); },
    children: []
  };

  const mockDialog = new MockNode('div');
  mockDialog.id = '_r_0_';
  mockDialog.className = 'dialog-popup';

  globalThis.document = {
    body: new MockNode('body'),
    documentElement: new MockNode('html'),
    head: new MockNode('head'),
    createElement: (tag) => {
      const el = new MockNode(tag);
      if (tag === 'div') {
        el.attachShadow = () => mockShadow;
      }
      return el;
    },
    addEventListener: (type, fn, capture = false) => {
      const phase = (typeof capture === 'object' ? capture.capture : capture) ? 'capture' : 'bubble';
      documentListeners[phase][type] = documentListeners[phase][type] || [];
      documentListeners[phase][type].push(fn);
    },
    removeEventListener: (type, fn, capture = false) => {
      const phase = (typeof capture === 'object' ? capture.capture : capture) ? 'capture' : 'bubble';
      if (documentListeners[phase][type]) {
        documentListeners[phase][type] = documentListeners[phase][type].filter(f => f !== fn);
      }
    },
    querySelector: () => null
  };
  globalThis.document.body.appendChild(mockDialog);

  // 1. Host dialog (@base-ui/react or Radix) attaches its dismiss listener to document capture
  const dismissListener = (e) => {
    hostReceivedEvents.push({ type: e.type, phase: 'document-capture' });
  };
  document.addEventListener('pointerdown', dismissListener, true);
  document.addEventListener('mousedown', dismissListener, true);
  document.addEventListener('pointerup', dismissListener, true);
  document.addEventListener('mouseup', dismissListener, true);
  document.addEventListener('click', dismissListener, true);

  // 2. Load Vibe modules
  const { default: VibeEvents } = await import('../lib/content/event-bus.js');
  const { default: VibeShadowHost } = await import('../lib/content/shadow-host.js');
  const { default: VibeInspectionMode } = await import('../lib/content/inspection-mode.js');

  VibeShadowHost.init();
  VibeInspectionMode.init();

  let clickedElementPayload = null;
  VibeEvents.on('inspection:elementClicked', (payload) => {
    clickedElementPayload = payload;
  });

  // 3. Start inspection mode
  VibeInspectionMode.start();

  // Helper to dispatch event through the DOM capture chain (window -> document -> target)
  function dispatchSimulatedEvent(type, target) {
    let defaultPrevented = false;
    let propagationStopped = false;
    let immediatePropagationStopped = false;

    const event = {
      type,
      target,
      clientX: 150,
      clientY: 150,
      composedPath: () => [target, globalThis.document.body, globalThis.document.documentElement, globalThis.document, globalThis.window],
      preventDefault: () => { defaultPrevented = true; },
      stopPropagation: () => { propagationStopped = true; },
      stopImmediatePropagation: () => {
        propagationStopped = true;
        immediatePropagationStopped = true;
      },
      get defaultPrevented() { return defaultPrevented; }
    };

    // Phase 1: window capture
    for (const fn of (windowListeners.capture[type] || [])) {
      if (immediatePropagationStopped) break;
      fn(event);
    }

    // Phase 2: document capture (only if propagation was not stopped)
    if (!propagationStopped) {
      for (const fn of (documentListeners.capture[type] || [])) {
        if (immediatePropagationStopped) break;
        fn(event);
      }
    }

    return event;
  }

  // 4. User clicks the dialog element
  // Browser fires full click sequence: pointerdown -> mousedown -> pointerup -> mouseup -> click
  dispatchSimulatedEvent('pointerdown', mockDialog);
  dispatchSimulatedEvent('mousedown', mockDialog);
  dispatchSimulatedEvent('pointerup', mockDialog);
  dispatchSimulatedEvent('mouseup', mockDialog);
  dispatchSimulatedEvent('click', mockDialog);

  // 5. Verification
  assert.ok(clickedElementPayload, 'Inspection mode should select the clicked element');
  assert.strictEqual(clickedElementPayload.element, mockDialog);

  // CRITICAL ASSERTION: The host dialog's dismiss listeners should NOT receive any of the click events!
  // Before fix: mousedown, pointerup, mouseup, click leak through because tempDisable() unbinds them immediately!
  assert.deepStrictEqual(
    hostReceivedEvents,
    [],
    `Host dialog received leaked events: ${JSON.stringify(hostReceivedEvents)}`
  );

  VibeInspectionMode.stop();
});
