import { useEffect, useRef, useState } from 'react';
import type { AnomalyProps } from './types';

/** Three clocks. One periodically jumps backwards a few seconds. Identify it. */
export default function ClockAnomaly({ onFound, onWrong }: AnomalyProps) {
  const start = useRef(Date.now());
  const [now, setNow] = useState(Date.now());
  const [msg, setMsg] = useState('Observe the three time sources for a while.');
  const bad = useRef(1 + Math.floor(Math.random() * 2)); // clock 1 or 2 drifts (never 0, the reference)
  const done = useRef(false);
  useEffect(() => { const t = setInterval(() => setNow(Date.now()), 250); return () => clearInterval(t); }, []);
  const el = (now - start.current) / 1000;
  const clocks = ['Apartment wall clock', 'Office terminal', 'Handset'].map((label, i) => {
    let t = now;
    if (i === bad.current) t -= (Math.floor(el / 7) % 2) * 4000 + ((el % 7) > 5 ? 0 : 0); // rolls back 4s every other 7s cycle
    return { label, time: new Date(t).toLocaleTimeString([], { hour12: false }) };
  });
  const pick = (i: number) => {
    if (done.current) return;
    if (i === bad.current) { done.current = true; setMsg(`Confirmed. ${clocks[i].label} rolls back four seconds, like a checkpoint restore.`); onFound(); }
    else { setMsg(`${clocks[i].label} is consistent with the network time.`); onWrong('consistent clock flagged'); }
  };
  return (
    <div>
      <div className="grid gap-3 sm:grid-cols-3">
        {clocks.map((c, i) => (
          <button key={c.label} onClick={() => pick(i)} className="tw p-4 text-center hover:border-[var(--accent)]" aria-label={`Flag ${c.label}, showing ${c.time}`}>
            <div className="font-mono text-3xl tabular-nums text-accent">{c.time}</div>
            <div className="mt-1 font-mono text-[11px] text-mx-grey">{c.label}</div>
          </button>
        ))}
      </div>
      <p className="mt-2 font-mono text-xs text-mx-pale/80" aria-live="polite">{msg} <span className="text-mx-grey">(observed {Math.floor(el)}s)</span></p>
    </div>
  );
}
