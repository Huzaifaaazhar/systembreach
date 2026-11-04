import { useRef, useState } from 'react';
import { fitCanvas, C } from '../../lib/canvas';
import { useGameLoop } from '../../hooks/useGameLoop';
import type { AnomalyProps } from './types';

const TARGET = 99.1;
const MESSAGE = 'THEY REBUILD THE CORRIDOR EVERY TIME YOU LOOK AWAY. WE ARE ON 99.1. WE ARE REAL.';

/** Tune a carrier band. The closer you get, the clearer the waveform and the message. */
export default function TransmissionAnomaly({ onFound }: AnomalyProps) {
  const [freq, setFreq] = useState(92.4);
  const [locked, setLocked] = useState(false);
  const holdT = useRef(0);
  const cv = useRef<HTMLCanvasElement>(null);
  const clarity = Math.max(0, 1 - Math.abs(freq - TARGET) / 3);
  const shown = MESSAGE.split('').map((ch, i) => (ch === ' ' || (i * 37) % 100 < clarity * clarity * 100 ? ch : '░')).join('');

  useGameLoop((dt, now) => {
    const c = cv.current; if (!c) return;
    const ctx = c.getContext('2d')!;
    const { w, h } = fitCanvas(c, ctx);
    ctx.fillStyle = C.deep; ctx.fillRect(0, 0, w, h);
    ctx.strokeStyle = clarity > 0.95 ? C.green : C.phosphor; ctx.lineWidth = 1.5; ctx.beginPath();
    for (let x = 0; x < w; x += 2) {
      const sig = Math.sin(x * 0.05 + now * 0.006) * 0.6 + Math.sin(x * 0.013 + now * 0.002) * 0.3;
      const noise = (Math.random() - 0.5) * 2;
      const y = h / 2 + (sig * clarity + noise * (1 - clarity)) * h * 0.35;
      x === 0 ? ctx.moveTo(x, y) : ctx.lineTo(x, y);
    }
    ctx.stroke();
    if (!locked && Math.abs(freq - TARGET) <= 0.1) { holdT.current += dt; if (holdT.current > 1.2) { setLocked(true); onFound(); } }
    else holdT.current = 0;
  });

  return (
    <div>
      <canvas ref={cv} className="h-28 w-full border border-soft" aria-hidden="true" />
      <label className="mt-3 block font-mono text-xs text-mx-grey">
        CARRIER <span className="text-accent tabular-nums">{freq.toFixed(1)} MHz</span> · CLARITY {(clarity * 100).toFixed(0)}%
        <input type="range" min={88} max={108} step={0.1} value={freq} onChange={(e) => setFreq(Number(e.target.value))} disabled={locked} aria-label="Tune frequency" />
      </label>
      <div className="mt-1 flex gap-2">
        <button className="btn !min-h-9" onClick={() => setFreq((f) => Math.max(88, +(f - 0.1).toFixed(1)))} disabled={locked}>− 0.1</button>
        <button className="btn !min-h-9" onClick={() => setFreq((f) => Math.min(108, +(f + 0.1).toFixed(1)))} disabled={locked}>+ 0.1</button>
      </div>
      <p className="mt-3 break-words font-mono text-sm tracking-wider text-mx-pale" aria-live="polite">{locked ? MESSAGE : shown}</p>
      <p className="mt-1 font-mono text-[11px] text-mx-grey">{locked ? 'Signal locked. Transmission decoded.' : 'Hold the dial on the clearest frequency to lock it.'}</p>
    </div>
  );
}
