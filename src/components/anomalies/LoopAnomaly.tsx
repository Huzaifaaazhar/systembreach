import { useEffect, useRef, useState } from 'react';
import { fitCanvas, rand, C } from '../../lib/canvas';
import { useGameLoop } from '../../hooks/useGameLoop';
import type { AnomalyProps } from './types';
import { expose } from '../../lib/debug';

type Ped = { x: number; y: number; vx: number; vy: number; loop: boolean; t: number; sx: number; sy: number; hue: number };

/** A crowd at a crossing. One pedestrian replays an identical path and snaps back. Click it. */
export default function LoopAnomaly({ onFound, onWrong }: AnomalyProps) {
  const cv = useRef<HTMLCanvasElement>(null);
  const peds = useRef<Ped[]>([]);
  const [msg, setMsg] = useState('Watch the crossing. One of them is not a person.');
  const done = useRef(false);

  useEffect(() => {
    peds.current = Array.from({ length: 9 }, (_, i) => {
      const loop = i === 4;
      const x = rand(0.1, 0.9), y = rand(0.25, 0.8);
      return { x, y, sx: x, sy: y, vx: rand(-0.07, 0.07) || 0.05, vy: rand(-0.04, 0.04), loop, t: 0, hue: i };
    });
    peds.current[4].vx = 0.09; peds.current[4].vy = 0.02;
    expose('loopPeds', peds.current);
  }, []);

  useGameLoop((dt) => {
    const c = cv.current; if (!c) return;
    const ctx = c.getContext('2d')!;
    const { w, h } = fitCanvas(c, ctx);
    ctx.fillStyle = C.deep; ctx.fillRect(0, 0, w, h);
    // crossing stripes
    ctx.fillStyle = 'rgba(185,235,197,0.06)';
    for (let x = 0; x < w; x += 28) ctx.fillRect(x, h * 0.42, 14, h * 0.18);
    ctx.strokeStyle = 'rgba(27,107,54,.5)'; ctx.beginPath(); ctx.moveTo(0, h * 0.2); ctx.lineTo(w, h * 0.2); ctx.moveTo(0, h * 0.85); ctx.lineTo(w, h * 0.85); ctx.stroke();
    for (const p of peds.current) {
      p.t += dt;
      if (p.loop) {
        if (p.t > 6) { p.t = 0; p.x = p.sx; p.y = p.sy; } // the tell: identical path, instant reset
        p.x = p.sx + 0.09 * p.t; p.y = p.sy + Math.sin(p.t * 2) * 0.02;
      } else {
        if (Math.random() < 0.01) { p.vx = rand(-0.08, 0.08); p.vy = rand(-0.04, 0.04); }
        p.x += p.vx * dt; p.y += p.vy * dt;
        if (p.x < 0.04 || p.x > 0.96) p.vx *= -1;
        if (p.y < 0.24 || p.y > 0.82) p.vy *= -1;
      }
      const px = p.x * w, py = p.y * h;
      ctx.fillStyle = C.pale; ctx.globalAlpha = 0.85;
      ctx.beginPath(); ctx.arc(px, py - 9, 4, 0, 7); ctx.fill();
      ctx.fillRect(px - 3, py - 4, 6, 11);
      ctx.globalAlpha = 1;
    }
  });

  const click = (e: React.PointerEvent) => {
    if (done.current) return;
    const r = cv.current!.getBoundingClientRect();
    const x = (e.clientX - r.left) / r.width, y = (e.clientY - r.top) / r.height;
    let best: Ped | null = null, bd = 0.06;
    for (const p of peds.current) { const d = Math.hypot(p.x - x, (p.y - y) * (r.height / r.width)); if (d < bd) { bd = d; best = p; } }
    if (!best) { setMsg('Nobody there.'); return; }
    if (best.loop) { done.current = true; setMsg('Confirmed. Same path every 6.0 seconds, then a hard reset.'); onFound(); }
    else { setMsg('Ordinary pedestrian. Random path. Keep watching.'); onWrong('wrong pedestrian flagged'); }
  };

  return (
    <div>
      <canvas ref={cv} onPointerDown={click} className="h-64 w-full cursor-crosshair touch-none border border-soft" aria-label="Street crossing. Click the pedestrian who repeats the same path." />
      <p className="mt-2 font-mono text-xs text-mx-pale/80" aria-live="polite">{msg}</p>
    </div>
  );
}
