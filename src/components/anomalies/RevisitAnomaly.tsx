import { useMemo, useState } from 'react';
import type { AnomalyProps } from './types';
import { sfx } from '../../lib/audio';

type Layout = { doors: number; painting: boolean; lamp: 'on' | 'flicker' };
const CHANGES = ['doors', 'painting', 'lamp'] as const;
const LABEL: Record<(typeof CHANGES)[number], string> = { doors: 'The number of doors', painting: 'The painting on the wall', lamp: 'The ceiling light' };

/** Visit a corridor, leave, come back. Something is regenerated differently. Name it. */
export default function RevisitAnomaly({ onFound, onWrong }: AnomalyProps) {
  const change = useMemo(() => CHANGES[Math.floor(Math.random() * 3)], []);
  const first: Layout = { doors: 3, painting: true, lamp: 'on' };
  const second: Layout = { ...first, ...(change === 'doors' ? { doors: 4 } : change === 'painting' ? { painting: false } : { lamp: 'flicker' }) };
  const [visits, setVisits] = useState(0);
  const [inside, setInside] = useState(false);
  const [msg, setMsg] = useState('Walk into the corridor and take note of what is there.');
  const [done, setDone] = useState(false);
  const layout = visits >= 2 ? second : first;

  const walk = () => {
    sfx.tick();
    if (inside) { setInside(false); setMsg(visits === 1 ? 'You stepped out. Now walk back in.' : 'You left the corridor.'); }
    else { setInside(true); setVisits((v) => v + 1); setMsg(visits === 0 ? 'Corridor B, first visit.' : 'Corridor B, revisited. Does anything look different?'); }
  };
  const answer = (k: (typeof CHANGES)[number] | 'none') => {
    if (done) return;
    if (k === change) { setDone(true); setMsg(`Confirmed. ${LABEL[k]} changed between visits. The corridor is regenerated each time you enter.`); onFound(); }
    else { setMsg(k === 'none' ? 'Look again. Something changed.' : 'That stayed the same.'); onWrong('incorrect observation'); }
  };

  return (
    <div>
      <div className="relative h-56 overflow-hidden border border-soft bg-mx-deep">
        {inside ? <Corridor l={layout} /> : <div className="grid h-full place-items-center font-mono text-sm text-mx-grey">[ outside corridor B ]</div>}
      </div>
      <div className="mt-3 flex flex-wrap gap-2">
        <button className="btn" onClick={walk}>{inside ? 'Leave corridor' : visits ? 'Walk back in' : 'Walk in'}</button>
        <span className="self-center font-mono text-xs text-mx-grey">visits: {visits}</span>
      </div>
      {visits >= 2 && inside && !done && (
        <div className="mt-3 flex flex-wrap gap-2">
          {CHANGES.map((k) => <button key={k} className="btn" onClick={() => answer(k)}>{LABEL[k]}</button>)}
          <button className="btn" onClick={() => answer('none')}>Nothing changed</button>
        </div>
      )}
      <p className="mt-2 font-mono text-xs text-mx-pale/80" aria-live="polite">{msg}</p>
    </div>
  );
}

function Corridor({ l }: { l: Layout }) {
  const doors = Array.from({ length: l.doors }, (_, i) => i);
  return (
    <svg viewBox="0 0 400 220" className="h-full w-full" role="img" aria-label={`Corridor with ${l.doors} doors${l.painting ? ', a painting' : ''}, light ${l.lamp}`}>
      <g stroke="#1B6B36" fill="none">
        <path d="M0 0 L150 70 L250 70 L400 0 M0 220 L150 150 L250 150 L400 220" />
        <rect x="150" y="70" width="100" height="80" />
      </g>
      {doors.map((i) => {
        const t = (i + 1) / (l.doors + 1); const x = t * 150; const top = t * 70, bot = 220 - t * 70;
        return <path key={i} d={`M${x} ${top + (bot - top) * 0.25} L${x + 14 * (1 - t) + 4} ${top + (bot - top) * 0.28} L${x + 14 * (1 - t) + 4} ${bot - 6} L${x} ${bot}`} stroke="#00C853" fill="rgba(0,200,83,.06)" />;
      })}
      {l.painting && <rect x="300" y="70" width="40" height="28" stroke="#D6A43B" fill="rgba(214,164,59,.08)" transform="skewY(-20)" />}
      <rect x="185" y="22" width="30" height="5" fill={l.lamp === 'on' ? '#B9EBC5' : '#718078'}>
        {l.lamp === 'flicker' && <animate attributeName="opacity" values="1;0.1;1;0.6;1" dur="0.9s" repeatCount="indefinite" />}
      </rect>
    </svg>
  );
}
