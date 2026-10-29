// Variants of an annotated component, as the agent scaffolded them in the
// codebase: one container whose `attribute` (data-vibe-active by default) picks
// which `[data-variant]` child shows. Shared by the badge's review popover and
// the View all list, so both preview and choose the same way.

import VibeAPI from './api-bridge.js';
import VibeEvents from './event-bus.js';

// Annotations whose variants can be browsed and chosen.
export function isReviewable(a) {
  return !!(a && a.mode === 'variants' && a.variantsPayload && a.status !== 'resolved'
    && a.status !== 'variants-discarded');
}

// The variants, the attribute that switches them, the container on this page
// (null on another route or before a reload), and the persisted choice.
export function variantContext(a) {
  const payload = a.variantsPayload || {};
  const variants = Array.isArray(payload.variants) ? payload.variants : [];
  const attribute = payload.attribute || 'data-vibe-active';
  let container = null;
  try { container = payload.container ? document.querySelector(payload.container) : null; } catch { /* bad selector */ }
  const chosen = a.chosenVariant != null ? String(a.chosenVariant) : null;
  return { variants, attribute, container, chosen };
}

// The variant the page shows now: the container's attribute, else the choice,
// else the first variant.
export function currentVariant(ctx) {
  return (ctx.container && ctx.container.getAttribute(ctx.attribute))
    || ctx.chosen
    || (ctx.variants[0] ? String(ctx.variants[0].value) : null);
}

// The variant's own element. The container is display:contents (no box), so
// this is what to scroll to or position against.
export function variantElement(ctx, value) {
  if (!ctx.container) return null;
  try {
    const esc = (window.CSS && CSS.escape) ? CSS.escape(String(value)) : String(value);
    return ctx.container.querySelector(`:scope > [data-variant="${esc}"]`)
      || ctx.container.querySelector(':scope > [data-variant]');
  } catch {
    return null;
  }
}

// Flip the container to `value`: the only DOM write a preview makes.
export function previewVariant(a, ctx, value) {
  if (!ctx.container) return;
  ctx.container.setAttribute(ctx.attribute, String(value));
  VibeEvents.emit('variants:switched', { id: a.id, variant: String(value) });
}

// Persist the choice and push it so the agent can finalize right away.
export async function chooseVariant(a, value) {
  await VibeAPI.updateAnnotation(a.id, { chosenVariant: String(value), status: 'variant-chosen' });
  VibeAPI.forceSync();
}
