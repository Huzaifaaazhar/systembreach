import { useMemo, useState } from 'react';
import { connected, generateLattice, openSides, type Lattice } from '../../lib/lattice';
import { sfx } from '../../lib/audio';

export interface LatticeResult { success: boolean; score: number; rotations: number }
const LIMIT = 40;

/** Rotate lattice segments until data flows from the uplink (left) to the core (right). */
export default function LatticeBreach({ onEnd }: { onEnd: (r: LatticeResult) => void }) {
  const init = useMemo(() => generateLattice(6, 5).puzzle, []);
  const [lat, setLat] = useState<Lattice>(init);
  const [rot, setRot] = useState(0);
  const [done, setDone] = useState<null | boolean>(null);
  const { powered, solved } = connected(lat);

  const turn = (i: number) => {
    if (done !== null || lat.cells[i].kind === 'empty') return;
    const cells = lat.cells.map((c, j) => (j === i ? { ...c, rot: (c.rot + 1) % 4 } : c));
    const next = { ...lat, cells }; setLat(next); const n = rot + 1; setRot(n); sfx.tick();
    if (connected(next).solved) { setDone(true); sfx.win(); onEnd({ success: true, score: Math.round(Math.max(35, 100 - Math.max(0, n - 12) * 2.2)), rotations: n }); }
    else if (n >= LIMIT) { setDone(false); sfx.err(); onEnd({ success: false, score: 0, rotations: n }); }
  };

  return (
    <div>
      <div className="mb-2 flex flex-wrap gap-4 font-mono text-xs">
        <span className="text-mx-pale">ROTATIONS {rot}/{LIMIT}</span>
        <span className={rot > LIMIT * 0.7 ? 'text-[#ff6b77]' : 'text-mx-grey'}>INTEGRITY MONITOR {rot > LIMIT * 0.7 ? '▲ ALERT' : '● QUIET'}</span>
        <span className="text-accent">{solved ? 'PATH OPEN' : `${powered.size} segments powered`}</span>
      </div>
      <div className="mx-auto flex max-w-xl items-stretch gap-2">
        <div className="flex flex-col justify-around font-mono text-[10px]">{Array.from({ length: lat.h }, (_, y) => <span key={y} className={y === lat.src ? 'text-accent' : 'text-transparent'}>UP ▸</span>)}</div>
        <div className="grid flex-1 gap-1" style={{ gridTemplateColumns: `repeat(${lat.w}, minmax(0,1fr))` }} role="grid" aria-label="Relay lattice. Click a segment to rotate it.">
          {lat.cells.map((c, i) => {
            const on = powered.has(i); const sides = openSides(c);
            return (
              <button key={i} onClick={() => turn(i)} className={`relative aspect-square border ${on ? 'border-[var(--accent)] bg-[rgba(0,200,83,.08)]' : 'border-soft'} hover:border-[var(--line)]`}
                aria-label={`Segment ${c.kind}, open ${sides.map((d) => 'NESW'[d]).join('')}${on ? ', powered' : ''}`}>
                <svg viewBox="0 0 40 40" className="absolute inset-0 h-full w-full" aria-hidden="true">
                  {sides.map((d) => <line key={d} x1="20" y1="20" x2={20 + [0, 20, 0, -20][d]} y2={20 + [-20, 0, 20, 0][d]} stroke={on ? '#00FF41' : '#1B6B36'} strokeWidth="6" strokeLinecap="square" />)}
                  <rect x="16" y="16" width="8" height="8" fill={on ? '#00FF41' : '#1B6B36'} />
                </svg>
              </button>
            );
          })}
        </div>
        <div className="flex flex-col justify-around font-mono text-[10px]">{Array.from({ length: lat.h }, (_, y) => <span key={y} className={y === lat.dst ? (solved ? 'text-accent' : 'text-mx-amber') : 'text-transparent'}>◂ CORE</span>)}</div>
      </div>
      <p className="mt-2 font-mono text-xs text-mx-grey">Click a segment to rotate it 90°. Powered segments glow. Fictional system: nothing outside this simulation is touched.</p>
    </div>
  );
}
