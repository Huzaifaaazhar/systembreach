import { useMemo, useState } from 'react';
import type { AnomalyProps } from './types';

const ITEMS = ['Ceramic mug', 'Desk lamp', 'Notebook', 'House plant', 'Keys', 'Headphones', 'Stapler', 'Umbrella', 'Wristwatch', 'Glasses'];

/** Inspect objects in two rooms. Two share a single asset serial. Select both. */
export default function DuplicateAnomaly({ onFound, onWrong }: AnomalyProps) {
  const rooms = useMemo(() => {
    const serial = () => `AS-${Math.floor(Math.random() * 90000 + 10000)}`;
    const dup = serial();
    const k = ITEMS.slice(0, 5).map((n) => ({ name: n, serial: serial(), room: 'Kitchen' }));
    const o = ITEMS.slice(5).map((n) => ({ name: n, serial: serial(), room: 'Office desk' }));
    k[0].serial = dup;
    o.splice(2, 0, { name: 'Ceramic mug', serial: dup, room: 'Office desk' });
    o.pop();
    return [k, o];
  }, []);
  const [inspected, setInspected] = useState<Set<string>>(new Set());
  const [sel, setSel] = useState<string[]>([]);
  const [msg, setMsg] = useState('Inspect objects to read their asset serials, then select the two that are the same instance.');
  const [done, setDone] = useState(false);
  const all = rooms.flat();
  const key = (r: { room: string; name: string }) => `${r.room}:${r.name}`;
  const toggle = (k: string) => {
    if (done) return;
    setInspected((s) => new Set(s).add(k));
    const next = sel.includes(k) ? sel.filter((x) => x !== k) : [...sel, k].slice(-2);
    setSel(next);
    if (next.length === 2) {
      const [a, b] = next.map((x) => all.find((i) => key(i) === x)!);
      if (a.serial === b.serial && a.room !== b.room) { setDone(true); setMsg(`Confirmed. Both rooms reference ${a.serial}: one object, rendered twice.`); onFound(); }
      else { setMsg('Different serials. These are separate objects.'); onWrong('distinct objects flagged'); setSel([]); }
    }
  };
  return (
    <div>
      <div className="grid gap-3 sm:grid-cols-2">
        {rooms.map((room, ri) => (
          <div key={ri} className="border border-soft p-3">
            <div className="mb-2 font-mono text-[10px] tracking-[0.2em] text-mx-grey">{room[0].room.toUpperCase()}</div>
            <ul className="grid gap-1.5">
              {room.map((it) => {
                const k = key(it); const on = sel.includes(k);
                return (
                  <li key={k}>
                    <button onClick={() => toggle(k)} aria-pressed={on} className={`flex w-full justify-between border px-2 py-1.5 font-mono text-xs ${on ? 'border-[var(--accent)] text-accent' : 'border-soft text-mx-pale/85 hover:border-[var(--line)]'}`}>
                      <span>{on ? '▣' : '□'} {it.name}</span>
                      <span className="text-mx-grey">{inspected.has(k) ? it.serial : 'inspect'}</span>
                    </button>
                  </li>
                );
              })}
            </ul>
          </div>
        ))}
      </div>
      <p className="mt-2 font-mono text-xs text-mx-pale/80" aria-live="polite">{msg}</p>
    </div>
  );
}
