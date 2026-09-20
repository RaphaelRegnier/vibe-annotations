// Shared rules for the custom "trigger hotkey".
//
// The hotkey is recorded in the toolbar settings and matched by the content
// script. Without guardrails, a hotkey could hijack ordinary typing: the
// global keydown listener calls preventDefault() on every match, so a recorded
// shortcut of e.g. a bare Space or Backspace would swallow those keys in every
// text field on the page. Two layers prevent this:
//
//   1. The recorder only accepts shortcuts that combine with a modifier
//      (Ctrl / Cmd / Alt) and rejects keys that are essential for editing
//      (Space, Backspace, Delete, Enter, Tab, Escape, arrows) even when modified.
//   2. The trigger site ignores the shortcut while the user is typing in an
//      editable element (inputs, textareas, contenteditable — including the
//      extension's own shadow-DOM popovers) and never fires on Space,
//      Backspace or Delete. Stored shortcuts recorded by older versions without a
//      modifier are also ignored, so existing bad recordings stop breaking
//      typing the moment the extension updates.

const MODIFIER_KEYS = ['Control', 'Shift', 'Alt', 'Meta'];

const EDITING_KEYS = new Set([' ', 'Backspace', 'Delete', 'Enter', 'Tab', 'Escape']);

function hasModifier(keys) {
  return !!(keys.ctrlKey || keys.metaKey || keys.altKey);
}

function isEditingKey(key) {
  return EDITING_KEYS.has(key) || key.startsWith('Arrow');
}

// Whether a keydown may become a custom hotkey. Lone modifier presses are
// ignored by the caller (the recorder keeps waiting for the actual key).
export function isRecordableHotkey(e) {
  if (MODIFIER_KEYS.includes(e.key)) return false;
  if (!hasModifier(e)) return false;
  if (isEditingKey(e.key)) return false;
  return true;
}

// Whether the event's deepest target is an editable element. Uses the composed
// path so inputs inside the extension's shadow-DOM popover are detected too
// (keydown is a composed event, but retargets to the shadow host on document).
function isEditableTarget(e) {
  const deep = (e.composedPath && e.composedPath()[0]) || e.target;
  if (!deep) return false;
  return deep.isContentEditable
    || (deep.tagName && /^(INPUT|TEXTAREA|SELECT)$/i.test(deep.tagName))
    || (typeof deep.closest === 'function' && deep.closest('input, textarea, select, [contenteditable]'));
}

function matchesShortcut(e, shortcut) {
  return e.key === shortcut.key
    && e.ctrlKey === !!shortcut.ctrlKey
    && e.metaKey === !!shortcut.metaKey
    && e.shiftKey === !!shortcut.shiftKey
    && e.altKey === !!shortcut.altKey;
}

// Whether a stored shortcut may fire for the given keydown. Space/Backspace,
// editable targets and modifier-less shortcuts never trigger the hotkey.
export function shouldTriggerHotkey(e, shortcut) {
  if (!shortcut) return false;
  if (isEditingKey(e.key)) return false;
  if (!hasModifier(shortcut)) return false;
  if (isEditableTarget(e)) return false;
  return matchesShortcut(e, shortcut);
}
