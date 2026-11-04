// Unified input: keyboard and on-screen touch controls write into the same state,
// so every game reads one source regardless of device.
export interface InputState {
  x: number; // -1..1
  y: number; // -1..1
  jump: boolean;
  boost: boolean;
  interact: boolean;
  bullet: boolean;
  attack: boolean;
  block: boolean;
  /** one-shot presses consumed by games */
  pressed: Set<string>;
}

export function createInput(): InputState {
  return { x: 0, y: 0, jump: false, boost: false, interact: false, bullet: false, attack: false, block: false, pressed: new Set() };
}

const KEYS: Record<string, keyof Omit<InputState, 'x' | 'y' | 'pressed'>> = {
  Space: 'jump', ShiftLeft: 'boost', ShiftRight: 'boost', KeyE: 'interact', KeyQ: 'bullet',
  KeyJ: 'attack', KeyK: 'block',
};

/** Attach keyboard listeners. Returns a detach function. */
export function bindKeyboard(input: InputState, opts: { capture?: string[] } = {}) {
  const held = new Set<string>();
  const recompute = () => {
    input.x = (held.has('KeyD') || held.has('ArrowRight') ? 1 : 0) - (held.has('KeyA') || held.has('ArrowLeft') ? 1 : 0);
    input.y = (held.has('KeyS') || held.has('ArrowDown') ? 1 : 0) - (held.has('KeyW') || held.has('ArrowUp') ? 1 : 0);
  };
  const capture = new Set(['Space', 'ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight', ...(opts.capture ?? [])]);
  const down = (e: KeyboardEvent) => {
    const t = e.target as HTMLElement | null;
    if (t && (t.tagName === 'INPUT' || t.tagName === 'TEXTAREA') && (t as HTMLInputElement).type !== 'range') return;
    if (capture.has(e.code)) e.preventDefault();
    if (!held.has(e.code)) input.pressed.add(e.code);
    held.add(e.code);
    const k = KEYS[e.code]; if (k) input[k] = true;
    recompute();
  };
  const up = (e: KeyboardEvent) => {
    held.delete(e.code);
    const k = KEYS[e.code]; if (k) input[k] = false;
    recompute();
  };
  const blur = () => { held.clear(); for (const k of Object.values(KEYS)) input[k] = false; recompute(); };
  window.addEventListener('keydown', down);
  window.addEventListener('keyup', up);
  window.addEventListener('blur', blur);
  return () => { window.removeEventListener('keydown', down); window.removeEventListener('keyup', up); window.removeEventListener('blur', blur); };
}

export const consume = (input: InputState, ...codes: string[]) => {
  for (const c of codes) if (input.pressed.has(c)) { input.pressed.delete(c); return true; }
  return false;
};
