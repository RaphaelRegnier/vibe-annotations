// Real element screenshots — captured automatically right after an annotation is
// saved, conditional on the Screenshots setting. Our overlay is hidden only for
// the captureVisibleTab frame so our pins/toolbar aren't in the shot.

import VibeAPI from './api-bridge.js';
import VibeEvents from './event-bus.js';
import VibeShadowHost from './shadow-host.js';

const PAD = 16; // CSS px of breathing room around the element

function init() {
  VibeEvents.on('annotation:saved', ({ annotation, element }) => {
    if (!VibeAPI.isScreenshotEnabled()) return;
    if (!annotation?.id || !element) return;
    // Fire-and-forget, but surface failures (e.g. missing capture permission).
    captureZoned(annotation.id, element).catch((err) => console.warn('[Vibe] screenshot capture failed:', err));
  });
}

async function captureZoned(id, element) {
  const host = VibeShadowHost.getHost();
  try {
    // Let the popover finish dismissing before we measure and shoot.
    await nextFrame();
    await nextFrame();

    const box = paddedBox(element);
    if (!box) return; // element off-screen — skip silently
    const dpr = window.devicePixelRatio || 1;
    const crop = {
      sx: Math.round(box.left * dpr),
      sy: Math.round(box.top * dpr),
      sw: Math.round(box.width * dpr),
      sh: Math.round(box.height * dpr),
    };

    // Hide our overlay for the capture frame, take the screenshot, restore.
    if (host) host.style.visibility = 'hidden';
    await nextFrame();
    try {
      await VibeAPI.captureScreenshot(id, crop);
    } finally {
      if (host) host.style.visibility = '';
    }
  } finally {
    if (host) host.style.visibility = '';
  }
}

// Padded, viewport-clamped box around the element (CSS px).
function paddedBox(element) {
  const r = element.getBoundingClientRect();
  const left = Math.max(0, r.left - PAD);
  const top = Math.max(0, r.top - PAD);
  const right = Math.min(window.innerWidth, r.right + PAD);
  const bottom = Math.min(window.innerHeight, r.bottom + PAD);
  const width = right - left;
  const height = bottom - top;
  if (width <= 0 || height <= 0) return null;
  return { left, top, width, height };
}

function nextFrame() {
  return new Promise((resolve) => requestAnimationFrame(() => resolve()));
}

const VibeScreenshot = { init };
export default VibeScreenshot;
