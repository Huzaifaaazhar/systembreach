// Restrained synthesized sound. No audio files, nothing loops. Starts only after a user gesture.
import { useGame } from '../store/gameStore';

let ctx: AudioContext | null = null;
let master: GainNode | null = null;
let unlocked = false;

function ac(): AudioContext | null {
  if (!unlocked || !useGame.getState().settings.sound) return null;
  if (!ctx) {
    const AC = window.AudioContext || (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext;
    if (!AC) return null;
    ctx = new AC();
    master = ctx.createGain();
    master.gain.value = 0.45;
    master.connect(ctx.destination);
  }
  if (ctx.state === 'suspended') void ctx.resume();
  return ctx;
}

function tone(f: number, d = 0.08, type: OscillatorType = 'square', g = 0.035, delay = 0, f2?: number) {
  const c = ac(); if (!c || !master) return;
  const t = c.currentTime + delay;
  const o = c.createOscillator(); const v = c.createGain();
  o.type = type; o.frequency.setValueAtTime(f, t);
  if (f2) o.frequency.exponentialRampToValueAtTime(f2, t + d);
  v.gain.setValueAtTime(0, t); v.gain.linearRampToValueAtTime(g, t + 0.005); v.gain.exponentialRampToValueAtTime(0.0001, t + d);
  o.connect(v).connect(master); o.start(t); o.stop(t + d + 0.02);
}

function noise(d = 0.15, g = 0.03, hp = 1800) {
  const c = ac(); if (!c || !master) return;
  const len = Math.floor(c.sampleRate * d);
  const buf = c.createBuffer(1, len, c.sampleRate); const data = buf.getChannelData(0);
  for (let i = 0; i < len; i++) data[i] = (Math.random() * 2 - 1) * (1 - i / len);
  const src = c.createBufferSource(); src.buffer = buf;
  const f = c.createBiquadFilter(); f.type = 'highpass'; f.frequency.value = hp;
  const v = c.createGain(); v.gain.value = g;
  src.connect(f).connect(v).connect(master); src.start();
}

export const sfx = {
  unlock() { unlocked = true; ac(); },
  key: () => tone(1700 + Math.random() * 500, 0.012, 'square', 0.008),
  tick: () => tone(1200, 0.02, 'sine', 0.012),
  ok: () => { tone(660, 0.07); tone(990, 0.09, 'square', 0.03, 0.07); },
  win: () => [523, 659, 784, 1046].forEach((f, i) => tone(f, 0.14, 'triangle', 0.03, i * 0.09)),
  err: () => tone(150, 0.2, 'sawtooth', 0.04, 0, 90),
  alert: () => { tone(880, 0.12, 'sine', 0.025); tone(880, 0.12, 'sine', 0.025, 0.2); },
  glitch: () => noise(0.16, 0.03, 2400),
  hit: () => { noise(0.1, 0.05, 400); tone(200, 0.16, 'sawtooth', 0.035, 0, 60); },
  slow: () => tone(420, 0.5, 'sine', 0.03, 0, 110),
  fast: () => tone(110, 0.3, 'sine', 0.025, 0, 420),
  signal: () => tone(1320, 0.09, 'sine', 0.05),
  swing: () => noise(0.06, 0.025, 3000),
  block: () => tone(300, 0.05, 'square', 0.03),
};
