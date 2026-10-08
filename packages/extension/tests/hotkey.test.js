import test from 'node:test';
import assert from 'node:assert';
import { isRecordableHotkey, shouldTriggerHotkey } from '../lib/content/hotkey.js';

function keyEvent(overrides) {
  return {
    ctrlKey: false,
    metaKey: false,
    shiftKey: false,
    altKey: false,
    ...overrides
  };
}

test('isRecordableHotkey rejects lone modifier keys', () => {
  assert.strictEqual(isRecordableHotkey(keyEvent({ key: 'Control' })), false);
  assert.strictEqual(isRecordableHotkey(keyEvent({ key: 'Shift' })), false);
  assert.strictEqual(isRecordableHotkey(keyEvent({ key: 'Alt' })), false);
  assert.strictEqual(isRecordableHotkey(keyEvent({ key: 'Meta' })), false);
});

test('isRecordableHotkey rejects lone keys without modifiers', () => {
  assert.strictEqual(isRecordableHotkey(keyEvent({ key: 'Delete' })), false);
  assert.strictEqual(isRecordableHotkey(keyEvent({ key: 'Backspace' })), false);
  assert.strictEqual(isRecordableHotkey(keyEvent({ key: 'k' })), false);
});

test('isRecordableHotkey rejects editing keys even with modifiers', () => {
  assert.strictEqual(isRecordableHotkey(keyEvent({ key: 'Delete', ctrlKey: true })), false);
  assert.strictEqual(isRecordableHotkey(keyEvent({ key: 'Delete', metaKey: true })), false);
  assert.strictEqual(isRecordableHotkey(keyEvent({ key: 'Backspace', ctrlKey: true })), false);
  assert.strictEqual(isRecordableHotkey(keyEvent({ key: 'Enter', ctrlKey: true })), false);
  assert.strictEqual(isRecordableHotkey(keyEvent({ key: 'Tab', altKey: true })), false);
  assert.strictEqual(isRecordableHotkey(keyEvent({ key: 'Escape', ctrlKey: true })), false);
  assert.strictEqual(isRecordableHotkey(keyEvent({ key: ' ', ctrlKey: true })), false);
  assert.strictEqual(isRecordableHotkey(keyEvent({ key: 'ArrowDown', ctrlKey: true })), false);
});

test('isRecordableHotkey accepts valid shortcut with modifier', () => {
  assert.strictEqual(isRecordableHotkey(keyEvent({ key: 'k', ctrlKey: true })), true);
  assert.strictEqual(isRecordableHotkey(keyEvent({ key: 'm', altKey: true })), true);
  assert.strictEqual(isRecordableHotkey(keyEvent({ key: 'e', metaKey: true })), true);
});

test('shouldTriggerHotkey rejects Delete key even if stored shortcut matches', () => {
  const shortcut = { key: 'Delete', ctrlKey: true, metaKey: false, shiftKey: false, altKey: false };
  const event = keyEvent({ key: 'Delete', ctrlKey: true });
  assert.strictEqual(shouldTriggerHotkey(event, shortcut), false);
});

test('shouldTriggerHotkey triggers for valid shortcut', () => {
  const shortcut = { key: 'k', ctrlKey: true, metaKey: false, shiftKey: false, altKey: false };
  const event = keyEvent({ key: 'k', ctrlKey: true });
  assert.strictEqual(shouldTriggerHotkey(event, shortcut), true);
});
