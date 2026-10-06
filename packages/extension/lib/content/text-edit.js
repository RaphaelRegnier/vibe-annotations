// Text mode: click a text element (heading, paragraph, button or link label…)
// and retype it in place. Saves a "text" annotation whose pending_changes carry
// copyChange { original, value }, so agents get the original → new copy.
//
// Only the element's own text is edited: in a button with an icon, the label's
// text node is wrapped in a temporary contenteditable span, so the icon stays.

import VibeAPI from './api-bridge.js';
import VibeElementContext from './element-context.js';
import VibeEvents from './event-bus.js';
import VibeInspectionMode from './inspection-mode.js';
import VibeShadowHost from './shadow-host.js';

  const SKIP_TAGS = new Set(['INPUT', 'TEXTAREA', 'SELECT', 'OPTION', 'SCRIPT', 'STYLE', 'NOSCRIPT', 'SVG', 'HTML', 'BODY', 'IFRAME', 'CANVAS', 'VIDEO', 'IMG']);

  // --- Text helpers (also used by the pins to apply / revert copy changes) ---

  function ownTextNodes(el) {
    return [...el.childNodes].filter(n => n.nodeType === Node.TEXT_NODE && n.nodeValue.trim());
  }

  // The text node a copy change targets: the only text, or the longest one when
  // the element mixes text with icons / other elements.
  function mainTextNode(el) {
    const nodes = ownTextNodes(el);
    if (!nodes.length) return null;
    return nodes.reduce((a, b) => (b.nodeValue.trim().length > a.nodeValue.trim().length ? b : a));
  }

  function hasOnlyText(el) {
    return [...el.childNodes].every(n => n.nodeType === Node.TEXT_NODE || (n.nodeType === Node.ELEMENT_NODE && n.tagName === 'BR'));
  }

  function getText(el) {
    if (hasOnlyText(el)) return el.textContent.trim();
    const node = mainTextNode(el);
    return node ? node.nodeValue.trim() : el.textContent.trim();
  }

  // Replace the element's copy without touching its icons or child elements.
  function setText(el, value) {
    if (!el) return;
    if (hasOnlyText(el)) { el.textContent = value; return; }
    const node = mainTextNode(el);
    if (!node) { el.textContent = value; return; }
    const m = node.nodeValue.match(/^(\s*)[\s\S]*?(\s*)$/);
    node.nodeValue = `${m[1]}${value}${m[2]}`;
  }

  // A text element we can edit: has its own visible text, isn't a form field,
  // isn't already editable, and isn't our overlay.
  function isEditable(el) {
    if (!(el instanceof Element) || SKIP_TAGS.has(el.tagName.toUpperCase())) return false;
    if (el.isContentEditable || el.closest('#vibe-annotations-root')) return false;
    return !!mainTextNode(el);
  }

  // Walk up a few levels from the hovered node to the element that owns the text.
  function findEditable(el) {
    for (let i = 0, cur = el; cur && i < 4; i++, cur = cur.parentElement) {
      if (isEditable(cur)) return cur;
    }
    return null;
  }

  // --- Inline editing ---

  let session = null; // { el, editEl, wrapper, original, annotation, onKey, onBlur }

  function init() {
    VibeEvents.on('text:edit', ({ element, annotation, clientX, clientY }) => start(element, annotation, clientX, clientY));
  }

  function start(el, annotation = null, clientX, clientY) {
    finish(false);
    if (!el || !isEditable(el)) { VibeInspectionMode.reEnable(); return; }
    VibeInspectionMode.tempDisable();

    // The copy before any edit: an existing text annotation remembers it.
    const original = annotation?.pending_changes?.copyChange?.original ?? getText(el);
    let editEl = el;
    let wrapper = null;
    if (!hasOnlyText(el)) {
      // Mixed content (icon + label): edit just the label's text node.
      const node = mainTextNode(el);
      wrapper = document.createElement('span');
      wrapper.setAttribute('data-vibe-text-edit', '');
      node.replaceWith(wrapper);
      wrapper.appendChild(node);
      editEl = wrapper;
    }

    const prevOutline = [el.style.outline, el.style.outlineOffset];
    el.style.outline = '2px solid #D03D68';
    el.style.outlineOffset = '3px';
    editEl.setAttribute('contenteditable', 'plaintext-only');
    editEl.setAttribute('data-vibe-editing', '');
    editEl.spellcheck = false;
    showHint(el);

    const onKey = (e) => {
      if (e.key === 'Escape') { e.preventDefault(); e.stopPropagation(); finish(false); }
      else if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); e.stopPropagation(); finish(true); }
    };
    const onBlur = () => setTimeout(() => { if (session && session.editEl === editEl) finish(true); }, 0);
    // Keep clicks inside the field from reaching the page (links, buttons).
    const swallow = (e) => { e.stopPropagation(); if (e.type === 'click') e.preventDefault(); };
    editEl.addEventListener('keydown', onKey, true);
    editEl.addEventListener('blur', onBlur);
    editEl.addEventListener('click', swallow, true);
    editEl.addEventListener('pointerdown', swallow, true);

    const r = el.getBoundingClientRect();
    const badgeOffset = clientX != null ? { x: clientX - r.left, y: clientY - r.top } : null;
    session = { el, editEl, wrapper, original, annotation, onKey, onBlur, swallow, badgeOffset, prevOutline };

    editEl.focus();
    const range = document.createRange();
    range.selectNodeContents(editEl);
    const sel = window.getSelection();
    sel.removeAllRanges();
    sel.addRange(range);
  }

  async function finish(save) {
    if (!session) return;
    const s = session;
    session = null;
    hideHint();

    s.editEl.removeEventListener('keydown', s.onKey, true);
    s.editEl.removeEventListener('blur', s.onBlur);
    s.editEl.removeEventListener('click', s.swallow, true);
    s.editEl.removeEventListener('pointerdown', s.swallow, true);
    [s.el.style.outline, s.el.style.outlineOffset] = s.prevOutline;
    s.editEl.removeAttribute('contenteditable');
    s.editEl.removeAttribute('data-vibe-editing');
    const value = (s.editEl.innerText || s.editEl.textContent || '').replace(/\s+\n/g, '\n').trim();
    if (s.wrapper) s.wrapper.replaceWith(document.createTextNode(s.wrapper.textContent));

    const previous = s.annotation?.pending_changes?.copyChange?.value ?? s.original;
    if (!save || !value || value === previous) {
      setText(s.el, previous);
      VibeInspectionMode.reEnable();
      return;
    }
    setText(s.el, value);

    try {
      if (s.annotation) {
        if (value === s.original) {
          // Typed back to the original: nothing left to change.
          await VibeAPI.deleteAnnotation(s.annotation.id);
          VibeEvents.emit('annotation:deleted', { id: s.annotation.id });
        } else {
          const pending_changes = { ...(s.annotation.pending_changes || {}), copyChange: { original: s.original, value } };
          await VibeAPI.updateAnnotation(s.annotation.id, { pending_changes });
          VibeEvents.emit('annotation:updated', { id: s.annotation.id, comment: s.annotation.comment || '', pending_changes, css: s.annotation.css ?? null });
        }
      } else if (value !== s.original) {
        await saveNew(s, value);
      }
    } catch (err) {
      console.warn('[Vibe] text edit save failed:', err);
    }
    VibeInspectionMode.reEnable();
  }

  async function saveNew(s, value) {
    // Context is generated with the original copy in place, so the selector and
    // element text point at what's in the source code.
    setText(s.el, s.original);
    const context = await VibeElementContext.generate(s.el);
    setText(s.el, value);
    const now = new Date().toISOString();
    const annotation = {
      id: 'vibe_' + Date.now() + '_' + Math.random().toString(36).slice(2, 11),
      kind: 'text',
      url: window.location.href,
      selector: context.selector,
      comment: '',
      viewport: context.viewport,
      element_context: {
        tag: context.tag, classes: context.classes, text: context.text, path: context.path || null,
        styles: context.styles, position: context.position,
        id: s.el.id || null, role: s.el.getAttribute('role') || null,
      },
      source_file_path: context.source_mapping?.source_file_path || null,
      source_line_range: context.source_mapping?.source_line_range || null,
      project_area: context.source_mapping?.project_area || 'unknown',
      url_path: context.source_mapping?.url_path || window.location.pathname,
      source_map_available: context.source_mapping?.source_map_available || false,
      context_hints: context.source_mapping?.context_hints || null,
      parent_chain: context.parent_chain || null,
      pending_changes: { copyChange: { original: s.original, value } },
      status: 'pending',
      created_at: now,
      updated_at: now,
    };
    if (s.badgeOffset) annotation.badge_offset = s.badgeOffset;
    await VibeAPI.saveAnnotation(annotation);
    VibeEvents.emit('annotation:saved', { annotation, element: s.el });
  }

  // --- "Enter to save · Esc to cancel" chip under the element ---

  let hintEl = null;
  function showHint(el) {
    const root = VibeShadowHost.getRoot();
    if (!root) return;
    hintEl = document.createElement('div');
    hintEl.className = 'vibe-text-hint';
    hintEl.innerHTML = '<kbd>⏎</kbd> save <span>·</span> <kbd>Esc</kbd> cancel';
    root.appendChild(hintEl);
    const r = el.getBoundingClientRect();
    const below = r.bottom + 34 < window.innerHeight;
    hintEl.style.top = `${below ? r.bottom + 6 : r.top - 30}px`;
    hintEl.style.left = `${Math.max(8, r.left)}px`;
  }
  function hideHint() { if (hintEl) { hintEl.remove(); hintEl = null; } }

  function isEditing() { return !!session; }

const VibeTextEdit = { init, start, finish, isEditing, isEditable, findEditable, getText, setText };
export default VibeTextEdit;
