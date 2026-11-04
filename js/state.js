// Global run state: threat level, progress, scores, choice flags. Persisted per browser.
const KEY = 'systembreach.v1';

const fresh = () => ({
  handle: 'OPERATIVE',
  threat: 0,
  unlocked: 0,          // highest chapter index reachable
  scores: {},           // chapterId -> 0..100 performance
  flags: {},            // narrative choices
  muted: false,
  endings: [],          // endings already seen
});

export const state = load();

function load() {
  try {
    const raw = localStorage.getItem(KEY);
    if (raw) return Object.assign(fresh(), JSON.parse(raw));
  } catch { /* storage unavailable */ }
  return fresh();
}

export function save() {
  try { localStorage.setItem(KEY, JSON.stringify(state)); } catch { /* ignore */ }
}

export function wipe() {
  const muted = state.muted;
  Object.assign(state, fresh(), { muted });
  save();
}

export function avgScore() {
  const v = Object.values(state.scores);
  return v.length ? Math.round(v.reduce((a, b) => a + b, 0) / v.length) : 0;
}
