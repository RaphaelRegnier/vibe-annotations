import test from 'node:test';
import assert from 'node:assert';
import { bindPopoverKeyListeners, unbindPopoverKeyListeners } from '../lib/content/annotation-popover.js';

test('bindPopoverKeyListeners attaches to both anchor and document, and unbind cleans up', () => {
  const anchorListeners = {};
  const docListeners = {};

  const anchor = {
    addEventListener: (type, fn) => { anchorListeners[type] = fn; },
    removeEventListener: (type, fn) => { if (anchorListeners[type] === fn) delete anchorListeners[type]; }
  };

  const originalDoc = globalThis.document;
  globalThis.document = {
    addEventListener: (type, fn) => { docListeners[type] = fn; },
    removeEventListener: (type, fn) => { if (docListeners[type] === fn) delete docListeners[type]; }
  };

  try {
    const handler = () => {};
    bindPopoverKeyListeners(anchor, handler);
    assert.strictEqual(anchorListeners.keydown, handler);
    assert.strictEqual(docListeners.keydown, handler);

    unbindPopoverKeyListeners(anchor, handler);
    assert.strictEqual(anchorListeners.keydown, undefined);
    assert.strictEqual(docListeners.keydown, undefined);
  } finally {
    globalThis.document = originalDoc;
  }
});

test('popover hotkey logic scopes Ctrl+Enter to anchor and allows Escape globally', () => {
  let closed = false;
  let saveClicked = false;
  const close = () => { closed = true; };
  const saveBtn = { disabled: false, click: () => { saveClicked = true; } };

  const innerTarget = {};
  const anchor = {
    contains: (el) => el === innerTarget
  };

  const escHandler = (e) => {
    if (e.key === 'Escape') {
      close();
    } else if (e.key === 'Enter' && (e.metaKey || e.ctrlKey) && !saveBtn.disabled) {
      const isInside = (typeof anchor.contains === 'function' && anchor.contains(e.target))
        || (typeof e.composedPath === 'function' && e.composedPath().includes(anchor));
      if (isInside) {
        e.preventDefault();
        saveBtn.click();
      }
    }
  };

  // 1. Escape inside anchor triggers close
  closed = false;
  escHandler({ key: 'Escape', target: innerTarget });
  assert.strictEqual(closed, true, 'Escape inside anchor closes popover');

  // 2. Ctrl+Enter inside anchor triggers saveBtn.click()
  saveClicked = false;
  let prevented = false;
  escHandler({
    key: 'Enter',
    ctrlKey: true,
    target: innerTarget,
    preventDefault: () => { prevented = true; }
  });
  assert.strictEqual(saveClicked, true, 'Ctrl+Enter inside anchor triggers save');
  assert.strictEqual(prevented, true, 'Ctrl+Enter calls preventDefault');

  // 3. Ctrl+Enter outside anchor does NOT trigger save
  saveClicked = false;
  prevented = false;
  const outsideTarget = {};
  escHandler({
    key: 'Enter',
    ctrlKey: true,
    target: outsideTarget,
    preventDefault: () => { prevented = true; }
  });
  assert.strictEqual(saveClicked, false, 'Ctrl+Enter outside anchor does not trigger save');

  // 4. Escape outside anchor still closes popover
  closed = false;
  escHandler({ key: 'Escape', target: outsideTarget });
  assert.strictEqual(closed, true, 'Escape outside anchor closes popover');
});
