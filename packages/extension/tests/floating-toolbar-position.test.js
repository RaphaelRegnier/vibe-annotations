import test from 'node:test';
import assert from 'node:assert';

// Mock storage
const mockStorage = {};
globalThis.chrome = {
  storage: {
    local: {
      get: async (keys) => {
        const result = {};
        for (const k of keys) {
          result[k] = mockStorage[k];
        }
        return result;
      },
      set: async (items) => {
        Object.assign(mockStorage, items);
      }
    }
  },
  runtime: {
    getURL: (path) => `chrome-extension://mock/${path}`,
    sendMessage: async () => ({ success: true })
  }
};

class MockElement {
  constructor(tagName = 'div') {
    this.tagName = tagName.toUpperCase();
    this.nodeName = this.tagName;
    this.id = '';
    this.className = '';
    this.style = {};
    this.children = [];
    this.parentNode = null;
    this.offsetWidth = 200;
    this.offsetHeight = 40;
    this._listeners = {};
    this.classList = {
      add: (cls) => {
        const classes = new Set((this.className || '').split(' ').filter(Boolean));
        classes.add(cls);
        this.className = Array.from(classes).join(' ');
      },
      remove: (cls) => {
        const classes = new Set((this.className || '').split(' ').filter(Boolean));
        classes.delete(cls);
        this.className = Array.from(classes).join(' ');
      },
      contains: (cls) => (this.className || '').split(' ').includes(cls)
    };
  }

  closest(sel) {
    if (sel.startsWith('.')) {
      const cls = sel.slice(1);
      if (this.classList && this.classList.contains(cls)) return this;
    }
    return this.parentNode?.closest ? this.parentNode.closest(sel) : null;
  }

  appendChild(child) {
    this.children.push(child);
    child.parentNode = this;
    return child;
  }

  removeChild(child) {
    const idx = this.children.indexOf(child);
    if (idx !== -1) this.children.splice(idx, 1);
    child.parentNode = null;
    return child;
  }

  remove() {
    if (this.parentNode) {
      this.parentNode.removeChild(this);
    }
  }

  addEventListener(type, fn) {
    if (!this._listeners[type]) this._listeners[type] = [];
    this._listeners[type].push(fn);
  }

  removeEventListener(type, fn) {
    if (this._listeners[type]) {
      this._listeners[type] = this._listeners[type].filter(f => f !== fn);
    }
  }

  dispatchEvent(event) {
    const fns = this._listeners[event.type] || [];
    for (const fn of fns) {
      fn(event);
    }
  }

  querySelector(sel) {
    const find = (el) => {
      if (sel.startsWith('.')) {
        const cls = sel.slice(1);
        if (el.classList && el.classList.contains(cls)) return el;
      }
      for (const child of el.children || []) {
        const res = find(child);
        if (res) return res;
      }
      return null;
    };
    const found = find(this);
    if (found) return found;

    // Fallback: lazily create queried button/pill/status element if accessed by toolbar
    const autoEl = new MockElement(sel.startsWith('button') ? 'button' : 'div');
    if (sel.startsWith('.')) {
      autoEl.classList.add(sel.slice(1));
    }
    this.appendChild(autoEl);
    return autoEl;
  }

  querySelectorAll(sel) {
    return [];
  }

  getBoundingClientRect() {
    return {
      left: 100,
      top: 100,
      right: 300,
      bottom: 140,
      width: this.offsetWidth,
      height: this.offsetHeight
    };
  }
}

// Unref all intervals so node test runner exits without hanging
const origSetInterval = globalThis.setInterval;
globalThis.setInterval = (...args) => {
  const timer = origSetInterval(...args);
  if (timer && typeof timer.unref === 'function') timer.unref();
  return timer;
};

const rootElement = new MockElement('div');
rootElement.style.setProperty = () => {};
const shadowRootMock = new MockElement('div');
shadowRootMock.host = rootElement;
const documentListeners = {};

const windowListeners = {};

globalThis.window = {
  innerWidth: 1920,
  innerHeight: 1080,
  location: { protocol: 'http:', hostname: 'localhost', origin: 'http://localhost:3000' },
  addEventListener: (type, fn) => {
    if (!windowListeners[type]) windowListeners[type] = [];
    windowListeners[type].push(fn);
  },
  removeEventListener: (type, fn) => {
    if (windowListeners[type]) {
      windowListeners[type] = windowListeners[type].filter(f => f !== fn);
    }
  },
  dispatchEvent: (event) => {
    const fns = windowListeners[event.type] || [];
    for (const fn of fns) {
      fn(event);
    }
  },
  requestAnimationFrame: (cb) => { cb(); return 1; },
  cancelAnimationFrame: () => {}
};

globalThis.document = {
  createElement: (tag) => new MockElement(tag),
  body: rootElement,
  addEventListener: (type, fn) => {
    if (!documentListeners[type]) documentListeners[type] = [];
    documentListeners[type].push(fn);
  },
  removeEventListener: (type, fn) => {
    if (documentListeners[type]) {
      documentListeners[type] = documentListeners[type].filter(f => f !== fn);
    }
  }
};

globalThis.requestAnimationFrame = (cb) => { cb(); return 1; };
globalThis.cancelAnimationFrame = () => {};

// Mock fetch for health checks
globalThis.fetch = async () => ({ ok: false, status: 500, json: async () => ({}) });

// Setup VibeShadowHost mock before loading modules
const { default: VibeShadowHost } = await import('../lib/content/shadow-host.js');
VibeShadowHost.getRoot = () => shadowRootMock;

const { default: VibeEvents } = await import('../lib/content/event-bus.js');
const { default: VibeToolbar } = await import('../lib/content/floating-toolbar.js');

test('floating toolbar position lifecycle', async (t) => {
  const getToolbar = () => shadowRootMock.children.find(c => c.classList.contains('vibe-toolbar'));

  t.afterEach(() => {
    // Ensure background polling timers are cleanly stopped after each test
    VibeEvents.emit('overlay:closed');
  });

  await t.test('closing overlay does not wipe saved position and reopening restores it', async () => {
    // Pre-seed storage with a saved position
    mockStorage.vibeToolbarPos = { right: '120px', top: '80px' };

    await VibeToolbar.init();

    const toolbar = getToolbar();
    assert.ok(toolbar, 'Toolbar element should be created');
    assert.strictEqual(toolbar.style.right, '120px');
    assert.strictEqual(toolbar.style.top, '80px');

    // Close the overlay
    VibeEvents.emit('overlay:closed');

    // Acceptance criterion: Closing the overlay does not clear or delete the saved position from storage
    assert.deepStrictEqual(
      mockStorage.vibeToolbarPos,
      { right: '120px', top: '80px' },
      'Saved position in storage must NOT be cleared when overlay is closed'
    );
    assert.strictEqual(toolbar.style.right, '120px', 'Toolbar style.right should not be blanked');
    assert.strictEqual(toolbar.style.top, '80px', 'Toolbar style.top should not be blanked');

    // Change stored coordinates (e.g. from another tab or external update)
    mockStorage.vibeToolbarPos = { right: '200px', top: '150px' };

    // Reopen the overlay
    VibeEvents.emit('overlay:shown');
    // Wait a tick for async restorePosition to complete
    await new Promise(resolve => setTimeout(resolve, 10));

    // Acceptance criterion: Reopening the overlay restores the toolbar to its last saved position
    assert.strictEqual(toolbar.style.right, '200px', 'Reopening overlay restores saved right position');
    assert.strictEqual(toolbar.style.top, '150px', 'Reopening overlay restores saved top position');
  });

  await t.test('moving floating toolbar saves its position to storage', async () => {
    const toolbar = getToolbar();
    assert.ok(toolbar, 'Toolbar element exists');

    // Simulate drag
    toolbar.dispatchEvent({
      type: 'mousedown',
      target: toolbar,
      clientX: 100,
      clientY: 100,
      preventDefault: () => {}
    });

    // Move document
    const mousemove = documentListeners.mousemove?.[0];
    const mouseup = documentListeners.mouseup?.[0];
    assert.ok(mousemove, 'mousemove listener should be attached');
    assert.ok(mouseup, 'mouseup listener should be attached');

    mousemove({
      clientX: 120,
      clientY: 140
    });

    mouseup({});

    // Acceptance criterion: Moving the floating toolbar saves its position.
    assert.ok(mockStorage.vibeToolbarPos, 'Position should be saved to storage');
    assert.strictEqual(toolbar.style.right, mockStorage.vibeToolbarPos.right);
    assert.strictEqual(toolbar.style.top, mockStorage.vibeToolbarPos.top);
  });

  await t.test('refreshing page preserves toolbar position from storage', async () => {
    // Storage retained the position from prior operations
    mockStorage.vibeToolbarPos = { right: '350px', top: '220px' };

    // Fresh DOM on page reload
    shadowRootMock.children = [];

    // Simulate page reload calling init()
    await VibeToolbar.init();

    const toolbar = getToolbar();
    assert.ok(toolbar, 'Toolbar element exists');
    assert.strictEqual(toolbar.style.right, '350px', 'Page reload preserves saved right coordinate');
    assert.strictEqual(toolbar.style.top, '220px', 'Page reload preserves saved top coordinate');
  });

  await t.test('restoring coordinates exceeding viewport width or height clamps within visible bounds with 8px margin', async () => {
    window.innerWidth = 1920;
    window.innerHeight = 1080;

    // Saved position exceeding viewport dimensions
    mockStorage.vibeToolbarPos = { right: '2500px', top: '1500px' };

    shadowRootMock.children = [];
    await VibeToolbar.init();

    const toolbar = getToolbar();
    assert.ok(toolbar, 'Toolbar element exists');
    // maxRight = 1920 - 200 - 8 = 1712
    assert.strictEqual(toolbar.style.right, '1712px', 'Excessive right coordinate clamped to viewport edge - 8px');
    // maxTop = 1080 - 40 - 8 = 1032
    assert.strictEqual(toolbar.style.top, '1032px', 'Excessive top coordinate clamped to viewport edge - 8px');

    // Saved position with negative or sub-minimum coordinates
    mockStorage.vibeToolbarPos = { right: '-50px', top: '2px' };
    VibeEvents.emit('overlay:shown');
    await new Promise(resolve => setTimeout(resolve, 10));

    assert.strictEqual(toolbar.style.right, '8px', 'Sub-minimum right coordinate clamped to 8px');
    assert.strictEqual(toolbar.style.top, '8px', 'Sub-minimum top coordinate clamped to 8px');
  });

  await t.test('narrow or short viewports clamp coordinates to maintain minimum 8px margin', async () => {
    // Narrow viewport (300px) and short viewport (200px)
    window.innerWidth = 300;
    window.innerHeight = 200;

    mockStorage.vibeToolbarPos = { right: '200px', top: '180px' };

    shadowRootMock.children = [];
    await VibeToolbar.init();

    const toolbar = getToolbar();
    assert.ok(toolbar, 'Toolbar element exists');
    // maxRight = 300 - 200 - 8 = 92
    assert.strictEqual(toolbar.style.right, '92px', 'Narrow viewport clamps right to 92px');
    // maxTop = 200 - 40 - 8 = 152
    assert.strictEqual(toolbar.style.top, '152px', 'Short viewport clamps top to 152px');

    // Viewport smaller than toolbar itself (width 150 < 200, height 30 < 40)
    window.innerWidth = 150;
    window.innerHeight = 30;
    mockStorage.vibeToolbarPos = { right: '50px', top: '50px' };

    VibeEvents.emit('overlay:shown');
    await new Promise(resolve => setTimeout(resolve, 10));

    assert.strictEqual(toolbar.style.right, '8px', 'Extremely narrow viewport maintains at least 8px margin');
    assert.strictEqual(toolbar.style.top, '8px', 'Extremely short viewport maintains at least 8px margin');
  });

  await t.test('resizing browser window while toolbar is visible adjusts position if overflowing', async () => {
    window.innerWidth = 1920;
    window.innerHeight = 1080;

    mockStorage.vibeToolbarPos = { right: '500px', top: '200px' };

    shadowRootMock.children = [];
    await VibeToolbar.init();

    const toolbar = getToolbar();
    assert.ok(toolbar, 'Toolbar element exists');
    assert.strictEqual(toolbar.style.right, '500px');
    assert.strictEqual(toolbar.style.top, '200px');

    // Resize window width from 1920 to 600
    // maxRight = 600 - 200 - 8 = 392px (< 500px -> must adjust)
    window.innerWidth = 600;
    window.dispatchEvent({ type: 'resize' });

    assert.strictEqual(toolbar.style.right, '392px', 'Window width shrink adjusted overflowing right coordinate');
    assert.strictEqual(toolbar.style.top, '200px', 'Top coordinate remained unchanged because it was within bounds');

    // Resize window height from 1080 to 220
    // maxTop = 220 - 40 - 8 = 172px (< 200px -> must adjust)
    window.innerHeight = 220;
    window.dispatchEvent({ type: 'resize' });

    assert.strictEqual(toolbar.style.right, '392px', 'Right coordinate remained intact');
    assert.strictEqual(toolbar.style.top, '172px', 'Window height shrink adjusted overflowing top coordinate');

    // Resize window back to larger size (1920x1080)
    // 392px and 172px are well within bounds, so position should NOT be altered
    window.innerWidth = 1920;
    window.innerHeight = 1080;
    window.dispatchEvent({ type: 'resize' });

    assert.strictEqual(toolbar.style.right, '392px', 'Position not altered when expanding window');
    assert.strictEqual(toolbar.style.top, '172px', 'Position not altered when expanding window');
  });

  await t.test('resizing window while overlay is closed does not adjust until reopened', async () => {
    window.innerWidth = 1920;
    window.innerHeight = 1080;

    mockStorage.vibeToolbarPos = { right: '300px', top: '150px' };

    shadowRootMock.children = [];
    await VibeToolbar.init();

    const toolbar = getToolbar();
    assert.strictEqual(toolbar.style.right, '300px');
    assert.strictEqual(toolbar.style.top, '150px');

    // Close the overlay
    VibeEvents.emit('overlay:closed');

    // Resize window to narrow width while closed
    window.innerWidth = 400;
    window.dispatchEvent({ type: 'resize' });

    // While closed, toolbar position was not adjusted by resize handler
    assert.strictEqual(toolbar.style.right, '300px', 'Closed toolbar should not be adjusted on resize');

    // Reopen the overlay
    VibeEvents.emit('overlay:shown');
    await new Promise(resolve => setTimeout(resolve, 10));

    // Upon reopening, restorePosition clamps to new window width (400 - 200 - 8 = 192px)
    assert.strictEqual(toolbar.style.right, '192px', 'Reopening restores position clamped to current viewport bounds');
    assert.strictEqual(toolbar.style.top, '150px', 'Top coordinate within bounds restored correctly');
  });

  await t.test('initial load without saved position on constrained viewport clamps default position', async () => {
    // Very constrained window
    window.innerWidth = 150;
    window.innerHeight = 50;
    delete mockStorage.vibeToolbarPos;

    shadowRootMock.children = [];
    await VibeToolbar.init();

    const toolbar = getToolbar();
    assert.ok(toolbar, 'Toolbar element exists');
    assert.strictEqual(toolbar.style.right, '8px', 'Default position clamped to minimum 8px on narrow screen');
    assert.strictEqual(toolbar.style.top, '8px', 'Default position clamped to minimum 8px on short screen');
  });

  await t.test('dragging toolbar clamps within viewport bounds', async () => {
    window.innerWidth = 800;
    window.innerHeight = 600;
    mockStorage.vibeToolbarPos = { right: '100px', top: '100px' };

    shadowRootMock.children = [];
    await VibeToolbar.init();

    const toolbar = getToolbar();

    toolbar.dispatchEvent({
      type: 'mousedown',
      target: toolbar,
      clientX: 100,
      clientY: 100,
      preventDefault: () => {}
    });

    const mousemove = documentListeners.mousemove?.[documentListeners.mousemove.length - 1];
    const mouseup = documentListeners.mouseup?.[documentListeners.mouseup.length - 1];

    // Drag way beyond top-left corner
    mousemove({ clientX: -500, clientY: -500 });
    mouseup({});

    // maxRight = 800 - 200 - 8 = 592px
    assert.strictEqual(toolbar.style.right, '592px', 'Drag right clamped to maxRight');
    // minTop = 8px
    assert.strictEqual(toolbar.style.top, '8px', 'Drag top clamped to 8px');

    // Now drag way beyond bottom-right corner
    toolbar.dispatchEvent({
      type: 'mousedown',
      target: toolbar,
      clientX: 100,
      clientY: 100,
      preventDefault: () => {}
    });

    mousemove({ clientX: 2000, clientY: 2000 });
    mouseup({});

    // minRight = 8px
    assert.strictEqual(toolbar.style.right, '8px', 'Drag right clamped to 8px');
    // maxTop = 600 - 40 - 8 = 552px
    assert.strictEqual(toolbar.style.top, '552px', 'Drag top clamped to maxTop');
  });
});
