// Restrained synthesized sound effects. Nothing loud, nothing looping by default.
import { state, save } from './state.js';

let ctx = null;
let master = null;
let unlocked = false; // browsers only allow audio after a user gesture

function ac() {
  if (!unlocked) return null;
  if (!ctx) {
    const AC = window.AudioContext || window.webkitAudioContext;
    if (!AC) return null;
    ctx = new AC();
    master = ctx.createGain();
    master.gain.value = state.muted ? 0 : 0.5;
    master.connect(ctx.destination);
  }
  if (ctx.state === 'suspended') ctx.resume();
  return ctx;
}

function tone({ f = 440, f2 = null, d = 0.08, type = 'square', g = 0.04, delay = 0 }) {
  const c = ac(); if (!c || state.muted) return;
  const t = c.currentTime + delay;
  const o = c.createOscillator();
  const v = c.createGain();
  o.type = type;
  o.frequency.setValueAtTime(f, t);
  if (f2) o.frequency.exponentialRampToValueAtTime(f2, t + d);
  v.gain.setValueAtTime(0, t);
  v.gain.linearRampToValueAtTime(g, t + 0.005);
  v.gain.exponentialRampToValueAtTime(0.0001, t + d);
  o.connect(v).connect(master);
  o.start(t); o.stop(t + d + 0.02);
}

function noise({ d = 0.2, g = 0.05, hp = 1200 }) {
  const c = ac(); if (!c || state.muted) return;
  const len = Math.floor(c.sampleRate * d);
  const buf = c.createBuffer(1, len, c.sampleRate);
  const data = buf.getChannelData(0);
  for (let i = 0; i < len; i++) data[i] = (Math.random() * 2 - 1) * (1 - i / len);
  const src = c.createBufferSource(); src.buffer = buf;
  const f = c.createBiquadFilter(); f.type = 'highpass'; f.frequency.value = hp;
  const v = c.createGain(); v.gain.value = g;
  src.connect(f).connect(v).connect(master);
  src.start();
}

export const sfx = {
  unlock: () => { unlocked = true; ac(); },
  key: () => tone({ f: 1800 + Math.random() * 400, d: 0.015, g: 0.012, type: 'square' }),
  ok: () => { tone({ f: 660, d: 0.07, g: 0.03 }); tone({ f: 990, d: 0.09, g: 0.03, delay: 0.07 }); },
  win: () => [523, 659, 784, 1046].forEach((f, i) => tone({ f, d: 0.14, g: 0.03, type: 'triangle', delay: i * 0.09 })),
  err: () => tone({ f: 140, f2: 90, d: 0.22, g: 0.05, type: 'sawtooth' }),
  alert: () => { tone({ f: 880, d: 0.12, g: 0.025, type: 'sine' }); tone({ f: 880, d: 0.12, g: 0.025, type: 'sine', delay: 0.2 }); },
  glitch: () => noise({ d: 0.18, g: 0.035, hp: 2400 }),
  hit: () => { noise({ d: 0.12, g: 0.06, hp: 400 }); tone({ f: 200, f2: 60, d: 0.18, g: 0.04, type: 'sawtooth' }); },
  slow: () => tone({ f: 420, f2: 110, d: 0.5, g: 0.035, type: 'sine' }),
  fast: () => tone({ f: 110, f2: 420, d: 0.3, g: 0.03, type: 'sine' }),
  tick: () => tone({ f: 1200, d: 0.02, g: 0.01, type: 'sine' }),
};

export function setMuted(m) {
  state.muted = m; save();
  if (master) master.gain.value = m ? 0 : 0.5;
}
