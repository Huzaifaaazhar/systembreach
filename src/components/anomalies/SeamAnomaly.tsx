import { useRef, useState } from 'react';
import { fitCanvas, C, seeded } from '../../lib/canvas';
import { useGameLoop } from '../../hooks/useGameLoop';
import type { AnomalyProps } from './types';
import { expose } from '../../lib/debug';

/** A skyline. Move the anomaly lens over the sky; the texture seam only shows through the lens. Click it. */
export default function SeamAnomaly({ onFound, onWrong }: AnomalyProps) {
  const cv = useRef<HTMLCanvasElement>(null);
  const lens = useRef({ x: 0.5, y: 0.3, on: false });
  const seamX = useRef(0.25 + Math.random() * 0.5);
  const [msg, setMsg] = useState('Sweep the lens across the sky.');
  const done = useRef(false);
  expose('seamX', seamX.current);

  useGameLoop(() => {
    const c = cv.current; if (!c) return;
    const ctx = c.getContext('2d')!;
    const { w, h } = fitCanvas(c, ctx);
    const r = seeded(7);
    ctx.fillStyle = '#04100a'; ctx.fillRect(0, 0, w, h);
    // buildings
    ctx.fillStyle = C.deep; ctx.strokeStyle = C.muted;
    for (let x = 0; x < w;) { const bw = 20 + r() * 50, bh = h * (0.2 + r() * 0.45); ctx.fillRect(x, h - bh, bw, bh); ctx.strokeRect(x, h - bh, bw, bh); x += bw + 4; }
    const L = lens.current; const R = 52;
    if (L.on) {
      ctx.save(); ctx.beginPath(); ctx.arc(L.x * w, L.y * h, R, 0, 7); ctx.clip();
      ctx.fillStyle = 'rgba(0,40,15,.9)'; ctx.fillRect(0, 0, w, h);
      ctx.strokeStyle = 'rgba(0,200,83,.35)';
      for (let gx = 0; gx < w; gx += 12) { ctx.beginPath(); ctx.moveTo(gx + (gx > seamX.current * w ? 5 : 0), 0); ctx.lineTo(gx + (gx > seamX.current * w ? 5 : 0), h); ctx.stroke(); }
      ctx.strokeStyle = C.amber; ctx.lineWidth = 2; ctx.beginPath(); ctx.moveTo(seamX.current * w, 0); ctx.lineTo(seamX.current * w, h * 0.55); ctx.stroke();
      ctx.restore();
      ctx.strokeStyle = C.green; ctx.lineWidth = 1.5; ctx.beginPath(); ctx.arc(L.x * w, L.y * h, R, 0, 7); ctx.stroke();
    }
  });

  const move = (e: React.PointerEvent) => {
    const r = cv.current!.getBoundingClientRect();
    lens.current = { x: (e.clientX - r.left) / r.width, y: (e.clientY - r.top) / r.height, on: true };
  };
  const click = (e: React.PointerEvent) => {
    move(e);
    if (done.current) return;
    const r = cv.current!.getBoundingClientRect();
    const dx = Math.abs((e.clientX - r.left) - seamX.current * r.width);
    if (dx < 14 && lens.current.y < 0.6) { done.current = true; setMsg('Confirmed. Two sky textures meet here, offset by five pixels.'); onFound(); }
    else { setMsg('Sky is continuous here.'); onWrong('no seam at that point'); }
  };
  return (
    <div>
      <canvas ref={cv} onPointerMove={move} onPointerDown={click} onPointerLeave={() => (lens.current.on = false)} className="h-60 w-full cursor-none touch-none border border-soft" aria-label="Skyline viewed through the anomaly lens. Click the seam in the sky." />
      <p className="mt-2 font-mono text-xs text-mx-pale/80" aria-live="polite">{msg}</p>
    </div>
  );
}
