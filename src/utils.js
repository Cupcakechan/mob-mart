// utils.js — small pure helpers (no DOM).
export function clamp(n, min, max) { return Math.min(max, Math.max(min, n)); }

export function randInt(min, max) { return Math.floor(Math.random() * (max - min + 1)) + min; }

export function pick(arr) { return arr[Math.floor(Math.random() * arr.length)]; }

// Weighted pick over [{ value, weight }]. Falls back to the first entry if weights are absent.
export function weightedPick(entries) {
  if (!entries || entries.length === 0) return null;
  const total = entries.reduce((s, e) => s + (e.weight ?? 0), 0);
  if (total <= 0) return entries[0].value;            // graceful fallback, never divide by zero
  let r = Math.random() * total;
  for (const e of entries) { r -= (e.weight ?? 0); if (r <= 0) return e.value; }
  return entries[entries.length - 1].value;
}

export function formatGold(n) { return Math.floor(n).toString(); }
