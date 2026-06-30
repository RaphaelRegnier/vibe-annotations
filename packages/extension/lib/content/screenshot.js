// Real element screenshots — captured automatically right after an annotation is
// saved, conditional on the Screenshots setting. We hand the background a device-
// pixel crop rect; it grabs the visible tab, crops, and uploads the raw webp to
// the server (which stores it as a file and references it on the annotation).
//
// Why post-save and overlay-hidden: chrome.tabs.captureVisibleTab rasterizes the
// real page, so our pin/toolbar/popover must be hidden for the one capture frame,
// and the element is already there to shoot. A subtle loader covers the round-trip.

import VibeAPI from './api-bridge.js';
import VibeEvents from './event-bus.js';
import VibeShadowHost from './shadow-host.js';

const PAD = 16; // CSS px of breathing room around the element

function init() {
  VibeEvents.on('annotation:saved', ({ annotation, element }) => {
    if (!VibeAPI.isScreenshotEnabled()) return;
    if (!annotation?.id || !element) return;
    // Fire-and-forget: a failed capture must never affect the saved annotation.
    captureZoned(annotation.id, element).catch(() => {});
  });
}

async function captureZoned(id, element) {
  const host = VibeShadowHost.getHost();
  const loader = showLoader();

  try {
    // Let the popover finish dismissing before we measure and shoot.
    await nextFrame();
    await nextFrame();

    const crop = computeCrop(element);
    if (!crop) return; // element off-screen — skip silently

    // Hide our entire overlay (pin, toolbar, popover, loader) so it isn't in the shot.
    if (host) host.style.visibility = 'hidden';
    await nextFrame();

    try {
      await VibeAPI.captureScreenshot(id, crop);
    } finally {
      if (host) host.style.visibility = '';
    }
  } finally {
    removeLoader(loader);
  }
}

// Device-pixel crop rect within the visible viewport, padded and clamped.
function computeCrop(element) {
  const dpr = window.devicePixelRatio || 1;
  const rect = element.getBoundingClientRect();
  const left = Math.max(0, rect.left - PAD);
  const top = Math.max(0, rect.top - PAD);
  const right = Math.min(window.innerWidth, rect.right + PAD);
  const bottom = Math.min(window.innerHeight, rect.bottom + PAD);
  const w = right - left;
  const h = bottom - top;
  if (w <= 0 || h <= 0) return null;
  return {
    sx: Math.round(left * dpr),
    sy: Math.round(top * dpr),
    sw: Math.round(w * dpr),
    sh: Math.round(h * dpr)
  };
}

function nextFrame() {
  return new Promise((resolve) => requestAnimationFrame(() => resolve()));
}

// --- Subtle loader ---

function showLoader() {
  const root = VibeShadowHost.getRoot();
  if (!root) return null;
  const el = document.createElement('div');
  el.className = 'vibe-capture-loader';
  el.innerHTML = '<span class="vibe-capture-spinner"></span><span>Capturing…</span>';
  root.appendChild(el);
  return el;
}

function removeLoader(el) {
  if (el && el.parentNode) el.parentNode.removeChild(el);
}

const VibeScreenshot = { init };
export default VibeScreenshot;
