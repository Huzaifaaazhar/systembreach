import { useEffect, useMemo, useRef, useState } from 'react';
import { sfx } from '../../lib/audio';

export interface SpotResult { success: boolean; score: number; falseFlags: number; time: number }
type El = { id: number; kind: 'building' | 'car' | 'lamp' | 'sign' | 'person' | 'tree'; x: number; y: number; w: number; h: number; color: string; text?: string; lit?: number };
const COLORS = ['#00C853', '#B9EBC5', '#D6A43B', '#718078'];

function makeScene(): El[] {
  const els: El[] = [];
  let id = 0;
  for (let i = 0; i < 5; i++) els.push({ id: id++, kind: 'building', x: 20 + i * 76, y: 40 + (i % 2) * 20, w: 64, h: 150 - (i % 2) * 20, color: '#1B6B36', lit: (i * 37) % 7 });
  els.push({ id: id++, kind: 'sign', x: 110, y: 18, w: 80, h: 18, color: '#D6A43B', text: 'OPEN 24H' });
  els.push({ id: id++, kind: 'sign', x: 270, y: 22, w: 70, h: 18, color: '#00C853', text: 'METRO' });
  for (let i = 0; i < 3; i++) els.push({ id: id++, kind: 'lamp', x: 60 + i * 140, y: 190, w: 6, h: 50, color: '#B9EBC5' });
  for (let i = 0; i < 3; i++) els.push({ id: id++, kind: 'car', x: 30 + i * 125, y: 248, w: 54, h: 20, color: COLORS[i] });
  for (let i = 0; i < 4; i++) els.push({ id: id++, kind: 'person', x: 45 + i * 95, y: 214, w: 10, h: 26, color: '#B9EBC5' });
  els.push({ id: id++, kind: 'tree', x: 350, y: 196, w: 26, h: 44, color: '#00C853' });
  return els;
}

/** Memorise a render, then flag every element the system patched. */
export default function SpotChange({ onEnd, changes = 4, memorise = 8, limit = 45, onWrong }: { onEnd: (r: SpotResult) => void; changes?: number; memorise?: number; limit?: number; onWrong?: () => void }) {
  const { before, after, changed } = useMemo(() => {
    const before = makeScene();
    const after = before.map((e) => ({ ...e }));
    const ids = [...after.keys()].sort(() => Math.random() - 0.5).slice(0, changes);
    const changed = new Set<number>();
    ids.forEach((i, k) => {
      const e = after[i]; changed.add(e.id);
      const mode = k % 4;
      if (mode === 0) { e.color = e.color === '#E5F1E8' ? '#D6A43B' : '#E5F1E8'; if (e.kind === 'building') e.lit = ((e.lit ?? 0) + 2) % 7; }
      if (mode === 1) e.x += e.kind === 'building' ? 0 : 22;
      if (mode === 2) e.text = e.text ? e.text.split('').reverse().join('') : undefined;
      if (mode === 3 || (mode === 2 && !e.text) || (mode === 1 && e.kind === 'building')) { e.h = Math.round(e.h * 0.7); e.y += e.kind === 'building' ? e.h * 0.43 : 0; }
    });
    return { before, after, changed };
  }, [changes]);
  const [phase, setPhaseState] = useState<'mem' | 'find' | 'done'>('mem');
  const setPhase = (p: 'mem' | 'find' | 'done') => { phaseRef.current = p; setPhaseState(p); };
  const [t, setT] = useState(memorise);
  const [found, setFound] = useState<Set<number>>(new Set());
  const [falses, setFalses] = useState<{ x: number; y: number }[]>([]);
  // refs mirror state so rapid clicks between renders never overwrite each other
  const foundRef = useRef(found); const falsesRef = useRef(falses); const phaseRef = useRef<'mem' | 'find' | 'done'>('mem');

  const tRef = useRef(memorise);
  useEffect(() => {
    const id = setInterval(() => {
      if (phaseRef.current === 'done') return;
      tRef.current -= 1;
      if (tRef.current <= 0) {
        if (phaseRef.current === 'mem') { setPhase('find'); tRef.current = limit; sfx.glitch(); }
        else { setPhase('done'); tRef.current = 0; onEnd({ success: false, score: 0, falseFlags: falsesRef.current.length, time: limit }); sfx.err(); }
      }
      setT(tRef.current);
    }, 1000);
    return () => clearInterval(id);
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  const click = (e: React.MouseEvent<SVGSVGElement>) => {
    if (phaseRef.current !== 'find') return;
    const svg = e.currentTarget; const pt = svg.createSVGPoint(); pt.x = e.clientX; pt.y = e.clientY;
    const p = pt.matrixTransform(svg.getScreenCTM()!.inverse());
    const fnd = foundRef.current;
    const inside = (el: El) => p.x >= el.x - 6 && p.x <= el.x + el.w + 6 && p.y >= el.y - 6 && p.y <= el.y + el.h + 6;
    const hit = after.find((el) => changed.has(el.id) && !fnd.has(el.id) && inside(el))
      ?? after.filter((el) => changed.has(el.id) && !fnd.has(el.id)).find((el) => inside(before.find((x) => x.id === el.id)!));
    if (hit) {
      const f = new Set(fnd).add(hit.id); foundRef.current = f; setFound(f); sfx.ok();
      if (f.size === changed.size) { setPhase('done'); const time = limit - t; onEnd({ success: true, score: Math.round(Math.max(30, 100 - falsesRef.current.length * 12 - time)), falseFlags: falsesRef.current.length, time }); sfx.win(); }
    } else {
      const nf = [...falsesRef.current, { x: p.x, y: p.y }]; falsesRef.current = nf; setFalses(nf); sfx.err(); onWrong?.();
      if (nf.length > 2) { setPhase('done'); onEnd({ success: false, score: 0, falseFlags: nf.length, time: limit - t }); }
    }
  };

  const scene = phase === 'mem' ? before : after;
  return (
    <div>
      <div className="mb-2 flex flex-wrap gap-4 font-mono text-xs">
        <span className={phase === 'mem' ? 'text-mx-amber' : 'text-accent'}>{phase === 'mem' ? 'REFERENCE RENDER · MEMORISE' : phase === 'find' ? 'PATCHED RENDER · CLICK CHANGES' : 'COMPLETE'}</span>
        <span className="tabular-nums text-mx-grey">{t}s</span>
        <span className="text-mx-pale">FOUND {found.size}/{changed.size}</span>
        <span className={falses.length ? 'text-[#ff6b77]' : 'text-mx-grey'}>FALSE FLAGS {falses.length}/2</span>
      </div>
      <svg viewBox="0 0 420 280" className={`w-full border border-line bg-mx-deep ${phase === 'find' ? 'cursor-crosshair' : ''}`} onClick={click} role="img" aria-label={phase === 'mem' ? 'Reference street render' : 'Patched street render. Click elements that changed.'}>
        <rect x="0" y="240" width="420" height="40" fill="#07180E" />
        {scene.map((e) => <Shape key={e.id} e={e} />)}
        {[...found].map((id) => { const e = after.find((x) => x.id === id)!; return <rect key={`f${id}`} x={e.x - 4} y={e.y - 4} width={e.w + 8} height={e.h + 8} fill="none" stroke="#00FF41" strokeWidth="2" />; })}
        {falses.map((f, i) => <text key={i} x={f.x} y={f.y} fill="#E0303F" fontSize="14" textAnchor="middle" dominantBaseline="middle">✕</text>)}
      </svg>
    </div>
  );
}

function Shape({ e }: { e: El }) {
  switch (e.kind) {
    case 'building': return (
      <g>
        <rect x={e.x} y={e.y} width={e.w} height={e.h} fill="#050A07" stroke={e.color} />
        {Array.from({ length: 12 }, (_, i) => <rect key={i} x={e.x + 8 + (i % 3) * 18} y={e.y + 10 + Math.floor(i / 3) * 22} width="10" height="12" fill={(i + (e.lit ?? 0)) % 4 === 0 ? '#B9EBC5' : '#07180E'} opacity={0.8} />).filter((_, i) => e.y + 10 + Math.floor(i / 3) * 22 < e.y + e.h - 12)}
      </g>
    );
    case 'sign': return <g><rect x={e.x} y={e.y} width={e.w} height={e.h} fill="#020503" stroke={e.color} /><text x={e.x + e.w / 2} y={e.y + 13} fill={e.color} fontSize="10" textAnchor="middle" fontFamily="IBM Plex Mono">{e.text}</text></g>;
    case 'lamp': return <g><rect x={e.x} y={e.y} width="3" height={e.h} fill="#718078" /><circle cx={e.x + 1.5} cy={e.y} r="5" fill={e.color} /></g>;
    case 'car': return <g><rect x={e.x} y={e.y} width={e.w} height={e.h} rx="4" fill="#020503" stroke={e.color} strokeWidth="2" /><circle cx={e.x + 12} cy={e.y + e.h} r="4" fill={e.color} /><circle cx={e.x + e.w - 12} cy={e.y + e.h} r="4" fill={e.color} /></g>;
    case 'person': return <g fill={e.color}><circle cx={e.x + 5} cy={e.y + 4} r="4" /><rect x={e.x + 1} y={e.y + 9} width="8" height={e.h - 9} /></g>;
    case 'tree': return <g><rect x={e.x + 11} y={e.y + e.h * 0.6} width="4" height={e.h * 0.4} fill="#718078" /><circle cx={e.x + 13} cy={e.y + e.h * 0.35} r={e.w / 2} fill="none" stroke={e.color} strokeWidth="2" /></g>;
  }
}
