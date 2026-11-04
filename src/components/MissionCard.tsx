import { Lock, Check } from 'lucide-react';
import type { MissionDef } from '../data/content';
import type { MissionState } from '../types';

export default function MissionCard({ def, state, onOpen }: { def: MissionDef; state: MissionState; onOpen: () => void }) {
  const locked = state.status === 'locked';
  return (
    <button onClick={onOpen} disabled={locked} className={`tw group w-full p-4 text-left transition-colors ${locked ? 'opacity-50' : 'hover:border-[var(--accent)]'}`}>
      <div className="mb-1 flex items-center gap-2 font-mono text-[10px] tracking-[0.25em] text-mx-grey">
        MISSION {def.id.slice(1)}
        <span className="ml-auto flex items-center gap-1">
          {state.status === 'completed' ? <><Check size={12} className="text-accent" /> <span className="text-accent">COMPLETE · {state.score}</span></> : locked ? <><Lock size={12} /> LOCKED</> : <span className="text-mx-amber">▲ AVAILABLE</span>}
        </span>
      </div>
      <div className="font-head text-xl text-mx-white">{def.title}</div>
      <div className="mt-1 font-mono text-[11px] text-mx-grey">DIFFICULTY <span aria-label={`${def.difficulty} of 5`}>{'▮'.repeat(def.difficulty)}{'▯'.repeat(5 - def.difficulty)}</span> · attempts {state.attempts}</div>
      <p className="mt-2 line-clamp-2 font-mono text-xs text-mx-pale/80">{def.briefing}</p>
    </button>
  );
}
