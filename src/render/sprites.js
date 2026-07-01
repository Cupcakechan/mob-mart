// sprites.js — minimal image loader with graceful fallback.
// A missing or not-yet-loaded asset returns null, and the caller draws a placeholder instead of
// crashing. This is the static-image path (for scale-checking); animated sheets come later.
const cache = new Map();   // id -> { img, ready }

export function loadSprite(id, url) {
  const entry = { img: new Image(), ready: false };
  entry.img.onload  = () => { entry.ready = true; };
  entry.img.onerror = () => { entry.ready = false; };   // absent file: stays a placeholder, never throws
  entry.img.src = url;
  cache.set(id, entry);
}

// Returns the loaded Image, or null if it isn't ready / doesn't exist (caller falls back).
export function getSprite(id) {
  const e = cache.get(id);
  return (e && e.ready) ? e.img : null;
}
