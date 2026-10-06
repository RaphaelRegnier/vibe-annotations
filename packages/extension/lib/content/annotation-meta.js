// What an annotation is and where it stands, shared by the pins, the popover
// and the View all list.
//
// kind: 'comment' (Annotate), 'design' (Design), 'text' (Text). Older
// annotations have no kind; it is derived from their content.
// thread: [{ id, author: 'user' | 'agent', body, created_at }] — replies after
// the first comment. Only comments (Annotate) have a thread.
// claude_sent_at: when it was last handed to Claude (Claude Code mod).

export const KIND_ICONS = {
  comment: '<svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.4" stroke-linecap="round" stroke-linejoin="round"><path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z"/></svg>',
  design: '<svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.4" stroke-linecap="round" stroke-linejoin="round"><circle cx="13.5" cy="6.5" r="1" fill="currentColor"/><circle cx="17.5" cy="10.5" r="1" fill="currentColor"/><circle cx="8.5" cy="7.5" r="1" fill="currentColor"/><circle cx="6.5" cy="12.5" r="1" fill="currentColor"/><path d="M12 2C6.5 2 2 6.5 2 12s4.5 10 10 10c.9 0 1.5-.7 1.5-1.5 0-.4-.1-.7-.4-1-.3-.3-.4-.7-.4-1 0-.8.7-1.5 1.5-1.5H16c3.3 0 6-2.7 6-6 0-5.5-4.5-10-10-10z"/></svg>',
  text: '<svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.6" stroke-linecap="round" stroke-linejoin="round"><path d="M5 5h14"/><path d="M12 5v14"/></svg>',
  variants: '<svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.4" stroke-linecap="round" stroke-linejoin="round"><rect x="3" y="3" width="7" height="7" rx="1"/><rect x="14" y="3" width="7" height="7" rx="1"/><rect x="3" y="14" width="7" height="7" rx="1"/><rect x="14" y="14" width="7" height="7" rx="1"/></svg>',
};

export const KIND_LABELS = { comment: 'Comment', design: 'Design edit', text: 'Text edit', variants: 'Variants' };

export function kindOf(a) {
  if (!a) return 'comment';
  if (a.kind === 'comment' || a.kind === 'design' || a.kind === 'text') return a.kind;
  if (a.mode === 'variants' || (a.comment || '').trim()) return 'comment';
  const pc = a.pending_changes || {};
  const keys = Object.keys(pc);
  if (keys.length === 1 && keys[0] === 'copyChange') return 'text';
  if (keys.length || a.css) return 'design';
  return 'comment';
}

// The icon a pin shows: variants keep their own marker.
export function iconKindOf(a) {
  return a?.mode === 'variants' ? 'variants' : kindOf(a);
}

export function threadOf(a) {
  return Array.isArray(a?.thread) ? a.thread : [];
}

export function lastMessage(a) {
  const t = threadOf(a);
  return t.length ? t[t.length - 1] : null;
}

// The agent wrote last: it's the user's turn.
export function needsReply(a) {
  return lastMessage(a)?.author === 'agent';
}

export function variantToPick(a) {
  return a?.mode === 'variants' && a.status === 'variants-ready';
}

// Sent to Claude, still open, and Claude hasn't answered since.
export function inProgress(a) {
  if (!a?.claude_sent_at || a.status === 'resolved' || a.status === 'variants-discarded') return false;
  if (variantToPick(a)) return false;
  const last = lastMessage(a);
  if (last?.author === 'agent' && new Date(last.created_at) >= new Date(a.claude_sent_at)) return false;
  return true;
}

export function newMessage(author, body) {
  return {
    id: 'm_' + Date.now().toString(36) + Math.random().toString(36).slice(2, 7),
    author,
    body,
    created_at: new Date().toISOString(),
  };
}

export function escapeHTML(str) {
  return String(str ?? '').replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
}

function timeAgo(iso) {
  const s = Math.max(0, (Date.now() - new Date(iso).getTime()) / 1000);
  if (s < 60) return 'now';
  if (s < 3600) return `${Math.floor(s / 60)}m`;
  if (s < 86400) return `${Math.floor(s / 3600)}h`;
  return `${Math.floor(s / 86400)}d`;
}

// The conversation: the first comment, then each reply. Variants get the
// agent's "pick one" message from their payload, so the choice reads in place.
export function threadMessages(a) {
  const msgs = [];
  if ((a?.comment || '').trim()) msgs.push({ id: 'c0', author: 'user', body: a.comment.trim(), created_at: a.created_at });
  if (a?.mode === 'variants' && a.variantsPayload?.variants?.length) {
    const names = a.variantsPayload.variants.map(v => v.name || v.value);
    msgs.push({ id: 'v0', author: 'agent', body: `Made ${names.length} variants: ${names.join(', ')}. Pick one.`, created_at: a.variants_ready_at || a.updated_at, synthetic: true });
  }
  return [...msgs, ...threadOf(a)];
}

export function threadHTML(a, { onlyReplies = false } = {}) {
  const msgs = onlyReplies ? threadOf(a) : threadMessages(a);
  if (!msgs.length) return '';
  return `<div class="vibe-thread">${msgs.map(m => `
    <div class="vibe-msg ${m.author === 'agent' ? 'agent' : 'user'}">
      <div class="vibe-msg-who">${m.author === 'agent' ? 'Agent' : 'You'}<span>${m.created_at ? timeAgo(m.created_at) : ''}</span></div>
      <div class="vibe-msg-body">${escapeHTML(m.body)}</div>
    </div>`).join('')}</div>`;
}
