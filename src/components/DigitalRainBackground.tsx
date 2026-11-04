import { useEffect, useRef } from 'react';
import { useReducedMotion } from '../hooks/useReducedMotion';

// Half-width katakana + numerals, drawn mirrored, in the film's spirit.
const GLYPHS = 'ｱｲｳｴｵｶｷｸｹｺｻｼｽｾｿﾀﾁﾂﾃﾄﾅﾆﾇﾈﾉﾊﾋﾌﾍﾎﾏﾐﾑﾒﾓﾔﾕﾖﾗﾘﾙﾚﾛﾜﾝ0123456789:.=*+-<>¦';

/** Shared control so games can slow the rain (bullet time) or tint it (agent alert). */
export const rainControl = { speed: 1, alert: 0 };

export default function DigitalRainBackground() {
  const ref = useRef<HTMLCanvasElement>(null);
  const reduced = useReducedMotion();

  useEffect(() => {
    const cv = ref.current!;
    const ctx = cv.getContext('2d')!;
    let w = 0, h = 0, size = 16, raf = 0, last = performance.now(), fade = 0;
    type Col = { y: number; v: number; row: number; prev: string; on: boolean };
    let cols: Col[] = [];
    const mk = (): Col => ({ y: -Math.random() * 40, v: 0.4 + Math.random() * 0.9, row: -1, prev: '', on: Math.random() < 0.5 });
    const pick = () => GLYPHS[(Math.random() * GLYPHS.length) | 0];

    const resize = () => {
      const dpr = Math.min(devicePixelRatio || 1, 1.5); // rain does not need full DPR
      w = innerWidth; h = innerHeight;
      cv.width = w * dpr; cv.height = h * dpr; ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
      size = w < 640 ? 14 : 16;
      cols = Array.from({ length: Math.ceil(w / size) }, (_, i) => cols[i] ?? mk());
      ctx.fillStyle = '#020503'; ctx.fillRect(0, 0, w, h);
    };

    const draw = (dt: number) => {
      fade += dt * (0.5 + 2 * rainControl.speed);
      if (fade > 0.05) { ctx.fillStyle = `rgba(2,5,3,${Math.min(0.28, fade * 1.5)})`; ctx.fillRect(0, 0, w, h); fade = 0; }
      ctx.font = `${size}px "IBM Plex Mono", monospace`;
      const a = rainControl.alert;
      const trail = `rgba(${Math.round(27 + 138 * a)},${Math.round(150 - 110 * a)},${Math.round(70 - 25 * a)},0.85)`;
      const head = a > 0.5 ? '#ff8a94' : '#c8ffd6';
      for (let i = 0; i < cols.length; i++) {
        const c = cols[i];
        if (!c.on) { if (Math.random() < 0.0015) c.on = true; continue; }
        c.y += c.v * rainControl.speed * dt * 15;
        const row = Math.floor(c.y);
        if (row === c.row) continue;
        c.row = row;
        const x = i * size, y = row * size, ch = pick();
        ctx.save();
        ctx.fillStyle = '#020503';
        ctx.fillRect(x, y - size * 1.85, size, size * 2.1);
        ctx.translate(x + size, 0); ctx.scale(-1, 1); // mirrored glyphs
        ctx.fillStyle = trail; ctx.fillText(c.prev || ch, 0, y - size);
        ctx.fillStyle = head; ctx.fillText(ch, 0, y);
        ctx.restore();
        c.prev = ch;
        if (y > h + size * 3) Object.assign(c, mk(), { y: 0 });
      }
    };

    const frame = (now: number) => {
      raf = requestAnimationFrame(frame);
      if (document.hidden) { last = now; return; }
      const dt = Math.min(0.05, (now - last) / 1000); last = now;
      draw(dt);
    };
    resize();
    addEventListener('resize', resize);
    if (reduced) {
      // a single still frame of rain instead of animation
      for (let k = 0; k < 120; k++) draw(0.05);
    } else raf = requestAnimationFrame(frame);
    return () => { cancelAnimationFrame(raf); removeEventListener('resize', resize); };
  }, [reduced]);

  return <canvas ref={ref} aria-hidden="true" className="pointer-events-none fixed inset-0 h-full w-full" style={{ opacity: 'var(--rain-opacity)' }} />;
}
