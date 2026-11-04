// Procedural receding service tunnel used behind decision prompts.
import { fitCanvas } from '../ui.js';

export function createTunnel(cv, { signal } = {}) {
  const ctx = cv.getContext('2d');
  let raf = 0; const t0 = performance.now();
  function frame(now) {
    raf = requestAnimationFrame(frame);
    const { w, h } = fitCanvas(cv, ctx);
    const t = (now - t0) / 1000;
    ctx.fillStyle = '#000'; ctx.fillRect(0, 0, w, h);
    const cx = w / 2, cy = h * 0.45;
    const g = ctx.createRadialGradient(cx, cy, 0, cx, cy, Math.max(w, h) * 0.7);
    g.addColorStop(0, 'rgba(60,140,80,.25)'); g.addColorStop(1, 'rgba(0,0,0,0)');
    ctx.fillStyle = g; ctx.fillRect(0, 0, w, h);
    for (let i = 0; i < 14; i++) {
      const k = ((i / 14) + t * 0.05) % 1; const s = k * k;
      const rw = w * 1.4 * s, rh = h * 1.3 * s;
      ctx.strokeStyle = `rgba(125,255,155,${0.05 + s * 0.35})`;
      ctx.lineWidth = 1 + s * 3;
      ctx.beginPath();
      ctx.ellipse(cx, cy, rw / 2, rh / 2, 0, Math.PI * 1.02, Math.PI * 1.98);
      ctx.moveTo(cx - rw / 2, cy); ctx.lineTo(cx - rw / 2, cy + rh * 0.4); ctx.lineTo(cx + rw / 2, cy + rh * 0.4); ctx.lineTo(cx + rw / 2, cy);
      ctx.stroke();
      if (i % 3 === 0) { // ceiling lamps
        ctx.fillStyle = `rgba(200,255,215,${s * 0.8})`;
        ctx.fillRect(cx - rw * 0.33, cy - rh * 0.42, 12 * s + 2, 3 * s + 1);
        ctx.fillRect(cx + rw * 0.33, cy - rh * 0.42, 12 * s + 2, 3 * s + 1);
      }
    }
    // wet floor reflections
    for (let i = 0; i < 6; i++) {
      ctx.strokeStyle = 'rgba(125,255,155,.06)';
      ctx.beginPath(); ctx.moveTo(cx, cy); ctx.lineTo(cx + (i - 2.5) * w * 0.3, h); ctx.stroke();
    }
  }
  raf = requestAnimationFrame(frame);
  const destroy = () => cancelAnimationFrame(raf);
  signal?.addEventListener('abort', destroy);
  return { destroy };
}
