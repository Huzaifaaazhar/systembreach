import { useMemo, useState } from 'react';
import { sfx } from '../../lib/audio';

const COLS = 10, ROWS = 7, PROBES = 7;
export interface TraceResult { success: boolean; score: number; probesLeft: number }

/**
 * Place directional probes on the grid. Each reports signal strength and a bearing toward the source
 * (bearing has ±20° noise). Lock onto the source cell. A wrong lock costs two probes.
 */
export default function TraceSignal({ onEnd, onWrong }: { onEnd: (r: TraceResult) => void; onWrong: () => void }) {
  const src = useMemo(() => [1 + Math.floor(Math.random() * (COLS - 2)), 1 + Math.floor(Math.random() * (ROWS - 2))] as const, []);
  const [probes, setProbes] = useState<{ x: number; y: number; s: number; b: number }[]>([]);
  const [left, setLeft] = useState(PROBES);
  const [mode, setMode] = useState<'probe' | 'lock'>('probe');
  const [done, setDone] = useState<null | boolean>(null);
  const [msg, setMsg] = useState('Click cells to drop probes. Strength rises near the source; the arrow points roughly toward it.');

  const click = (x: number, y: number) => {
    if (done !== null) return;
    if (mode === 'probe') {
      if (left <= 0) { setMsg('No probes left. Switch to LOCK and commit.'); return; }
      if (probes.some((p) => p.x === x && p.y === y)) return;
      const d = Math.hypot(src[0] - x, src[1] - y);
      const s = Math.round(Math.max(3, 100 - d * 16 + (Math.random() - 0.5) * 6));
      const b = Math.atan2(src[1] - y, src[0] - x) + ((Math.random() - 0.5) * Math.PI) / 4.5;
      setProbes((p) => [...p, { x, y, s, b }]); setLeft((l) => l - 1); sfx.tick();
      setMsg(d === 0 ? 'Signal saturated: the probe is ON the source. Lock it.' : `Probe ${PROBES - left + 1}: strength ${s}%.`);
    } else {
      if (x === src[0] && y === src[1]) { setDone(true); sfx.win(); const r = { success: true, score: Math.min(100, 40 + left * 10), probesLeft: left }; setMsg('Transmitter locked. Signal traced to an operator relay.'); onEnd(r); }
      else {
        const nl = left - 2; setLeft(Math.max(0, nl)); sfx.err(); onWrong();
        if (nl < 0) { setDone(false); setMsg('The transmitter went silent. Trace lost.'); onEnd({ success: false, score: 0, probesLeft: 0 }); }
        else setMsg('Wrong cell. The transmitter is shifting frequency (−2 probes).');
      }
    }
  };

  return (
    <div>
      <div className="mb-2 flex flex-wrap items-center gap-2 font-mono text-xs">
        <span className="text-mx-pale">PROBES {left}/{PROBES}</span>
        <button className={`btn !min-h-9 ${mode === 'probe' ? 'on' : ''}`} onClick={() => setMode('probe')} aria-pressed={mode === 'probe'}>Probe</button>
        <button className={`btn !min-h-9 ${mode === 'lock' ? 'on' : ''}`} onClick={() => setMode('lock')} aria-pressed={mode === 'lock'}>Lock source</button>
      </div>
      <div className="grid gap-1" style={{ gridTemplateColumns: `repeat(${COLS}, minmax(0, 1fr))` }} role="grid" aria-label="Downtown signal grid">
        {Array.from({ length: ROWS * COLS }, (_, i) => {
          const x = i % COLS, y = Math.floor(i / COLS);
          const p = probes.find((q) => q.x === x && q.y === y);
          const found = done && x === src[0] && y === src[1];
          return (
            <button key={i} onClick={() => click(x, y)} aria-label={`Cell ${x + 1},${y + 1}${p ? `, strength ${p.s}%` : ''}`}
              className={`relative aspect-square border font-mono text-[10px] ${found ? 'border-mx-green bg-[rgba(0,255,65,.35)]' : p ? 'border-line' : 'border-soft hover:border-[var(--line)]'} ${mode === 'lock' ? 'hover:bg-[rgba(165,29,45,.2)]' : ''}`}
              style={p ? { background: `rgba(0,200,83,${p.s / 260})` } : undefined}>
              {p && <>
                <span className="absolute left-1 top-0.5 text-mx-pale">{p.s}</span>
                <span className="absolute inset-0 grid place-items-center text-accent" style={{ transform: `rotate(${p.b}rad)` }} aria-hidden="true">→</span>
              </>}
            </button>
          );
        })}
      </div>
      <p className="mt-2 font-mono text-xs text-mx-pale/85" aria-live="polite">{msg}</p>
    </div>
  );
}
