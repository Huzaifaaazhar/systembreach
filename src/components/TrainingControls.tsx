import { useEffect, useRef, useState } from 'react';
import type { InputState } from '../lib/input';

type Action = 'jump' | 'boost' | 'interact' | 'bullet' | 'attack' | 'block';

/**
 * Touch controls: a virtual joystick on the left and large action buttons on the right.
 * They write into the same InputState as the keyboard. Shown automatically on touch devices.
 */
export default function TrainingControls({ input, actions, forceShow = false, axes = 'xy' }: { input: InputState; actions: { key: Action; label: string }[]; forceShow?: boolean; axes?: 'x' | 'xy' }) {
  const [coarse, setCoarse] = useState(() => typeof matchMedia !== 'undefined' && matchMedia('(pointer: coarse)').matches);
  const [show, setShow] = useState(forceShow);
  useEffect(() => { if (coarse) setShow(true); }, [coarse]);
  useEffect(() => {
    const q = matchMedia('(pointer: coarse)'); const on = () => setCoarse(q.matches);
    q.addEventListener('change', on); return () => q.removeEventListener('change', on);
  }, []);

  return (
    <div className="mt-2">
      {!coarse && (
        <button className="chip mb-2 text-mx-grey hover:text-mx-pale" onClick={() => setShow(!show)} aria-pressed={show}>
          {show ? 'Hide' : 'Show'} touch controls
        </button>
      )}
      {show && (
        <div className="flex select-none items-end justify-between gap-4">
          <Joystick input={input} axes={axes} />
          <div className="grid grid-cols-2 gap-2">
            {actions.map((a) => <ActionButton key={a.key} input={input} action={a.key} label={a.label} />)}
          </div>
        </div>
      )}
    </div>
  );
}

function Joystick({ input, axes }: { input: InputState; axes: 'x' | 'xy' }) {
  const base = useRef<HTMLDivElement>(null);
  const [knob, setKnob] = useState({ x: 0, y: 0 });
  const id = useRef<number | null>(null);
  const update = (e: React.PointerEvent) => {
    const r = base.current!.getBoundingClientRect();
    let dx = (e.clientX - (r.left + r.width / 2)) / (r.width / 2);
    let dy = axes === 'x' ? 0 : (e.clientY - (r.top + r.height / 2)) / (r.height / 2);
    const m = Math.hypot(dx, dy); if (m > 1) { dx /= m; dy /= m; }
    input.x = Math.abs(dx) < 0.15 ? 0 : dx; input.y = Math.abs(dy) < 0.15 ? 0 : dy;
    setKnob({ x: dx, y: dy });
  };
  const end = () => { id.current = null; input.x = 0; input.y = 0; setKnob({ x: 0, y: 0 }); };
  return (
    <div
      ref={base}
      role="application"
      aria-label="Movement joystick"
      className="relative h-32 w-32 touch-none rounded-full border border-line bg-mx-dark/70"
      onPointerDown={(e) => { id.current = e.pointerId; try { e.currentTarget.setPointerCapture(e.pointerId); } catch { /* pointer already released */ } update(e); }}
      onPointerMove={(e) => { if (id.current === e.pointerId) update(e); }}
      onPointerUp={end} onPointerCancel={end}
    >
      <div className="absolute left-1/2 top-1/2 h-12 w-12 rounded-full border border-[var(--accent)] bg-[rgba(0,200,83,.2)]"
        style={{ transform: `translate(calc(-50% + ${knob.x * 40}px), calc(-50% + ${knob.y * 40}px))` }} />
    </div>
  );
}

function ActionButton({ input, action, label }: { input: InputState; action: Action; label: string }) {
  const down = (e: React.PointerEvent) => {
    e.preventDefault(); try { e.currentTarget.setPointerCapture(e.pointerId); } catch { /* pointer already released */ }
    input[action] = true;
    const code = { jump: 'Space', boost: 'ShiftLeft', interact: 'KeyE', bullet: 'KeyQ', attack: 'KeyJ', block: 'KeyK' }[action];
    input.pressed.add(code);
  };
  const up = () => { input[action] = false; };
  return (
    <button onPointerDown={down} onPointerUp={up} onPointerCancel={up} onContextMenu={(e) => e.preventDefault()}
      className="btn h-16 w-20 touch-none !text-[11px] active:bg-[rgba(0,255,65,.25)]">{label}</button>
  );
}
