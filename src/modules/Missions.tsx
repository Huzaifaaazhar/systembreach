import { useRef, useState } from 'react';
import TerminalWindow from '../components/TerminalWindow';
import MissionCard from '../components/MissionCard';
import MissionBriefing from '../components/MissionBriefing';
import { useGame } from '../store/gameStore';
import { INTEL, MISSIONS } from '../data/content';
import { missionsCompleted } from '../lib/derived';
import type { MissionId } from '../types';
import TraceSignal from '../games/missions/TraceSignal';
import SpotChange from '../games/missions/SpotChange';
import LatticeBreach from '../games/missions/LatticeBreach';
import EvasionGame, { MAPS } from '../games/EvasionGame';
import { sfx } from '../lib/audio';

type View = { mode: 'list' } | { mode: 'brief'; id: MissionId } | { mode: 'run'; id: MissionId } | { mode: 'result'; id: MissionId; ok: boolean; score: number; ms: number; detail: string };

export default function Missions() {
  const s = useGame();
  const [view, setView] = useState<View>({ mode: 'list' });
  const startedAt = useRef(0);

  const succeed = (id: MissionId, score: number, detail: string) => {
    const ms = performance.now() - startedAt.current;
    s.completeMission(id, score, ms);
    setView({ mode: 'result', id, ok: true, score, ms, detail });
  };
  const fail = (id: MissionId, reason: string) => {
    const ms = performance.now() - startedAt.current;
    s.failMission(id, ms, reason);
    setView({ mode: 'result', id, ok: false, score: 0, ms, detail: reason });
  };

  if (view.mode === 'brief') {
    const def = MISSIONS.find((m) => m.id === view.id)!;
    return <MissionBriefing def={def} onBack={() => setView({ mode: 'list' })} onStart={() => { startedAt.current = performance.now(); sfx.ok(); setView({ mode: 'run', id: view.id }); }} />;
  }

  if (view.mode === 'run') {
    const def = MISSIONS.find((m) => m.id === view.id)!;
    const btBonus = s.missions.m03.status === 'completed' ? 1.25 : 1;
    return (
      <TerminalWindow title={`${def.id.toUpperCase()} · ${def.title}`} code="LIVE" className="mx-auto max-w-5xl" right={<button className="btn !min-h-8 !py-1" onClick={() => fail(view.id, 'aborted by operator')}>Abort</button>}>
        <p className="mb-3 font-mono text-xs text-mx-grey">TARGET: {def.target}</p>
        {view.id === 'm01' && (
          <TraceSignal onWrong={() => s.addThreat(4, 'wrong lock attempt')} onEnd={(r) => (r.success ? succeed('m01', r.score, `Locked with ${r.probesLeft} probes left.`) : fail('m01', 'trace lost'))} />
        )}
        {view.id === 'm02' && (
          <SpotChange onWrong={() => s.addThreat(2)} onEnd={(r) => (r.success ? succeed('m02', r.score, `All changes found in ${r.time}s with ${r.falseFlags} false flags.`) : fail('m02', r.falseFlags > 2 ? 'too many false flags' : 'patch committed before you finished'))} />
        )}
        {view.id === 'm03' && (
          <EvasionGame map={MAPS.streets} btBonus={btBonus} title="Evade the Agent" onEnd={(r) => (r.success ? succeed('m03', r.score, `Reached the hardline in ${r.time.toFixed(1)}s, caught ${r.caught}×.`) : fail('m03', r.caught >= 3 ? 'caught three times' : 'sweep closed'))} />
        )}
        {view.id === 'm04' && (
          <LatticeBreach onEnd={(r) => (r.success ? succeed('m04', r.score, `Lattice breached in ${r.rotations} rotations.`) : fail('m04', 'integrity monitor tripped'))} />
        )}
        {view.id === 'm05' && <ReachExit btBonus={btBonus} onEnd={(ok, score, detail) => (ok ? succeed('m05', score, detail) : fail('m05', detail))} />}
      </TerminalWindow>
    );
  }

  if (view.mode === 'result') {
    const def = MISSIONS.find((m) => m.id === view.id)!;
    return (
      <TerminalWindow title={view.ok ? 'Mission Complete' : 'Mission Failed'} code={def.id.toUpperCase()} tone={view.ok ? 'default' : 'agent'} className="mx-auto max-w-2xl">
        <div className="space-y-3 font-mono text-sm">
          <p className={`font-head text-3xl ${view.ok ? 'text-accent' : 'text-[#ff6b77]'}`}>{def.title}</p>
          <p className="text-mx-pale">{view.detail}</p>
          <dl className="grid grid-cols-2 gap-2 text-xs">
            <div><dt className="text-mx-grey">SCORE</dt><dd className="text-xl text-mx-white">{view.score}</dd></div>
            <div><dt className="text-mx-grey">TIME</dt><dd className="text-xl text-mx-white">{(view.ms / 1000).toFixed(1)}s</dd></div>
          </dl>
          {view.ok ? <p className="text-accent">REWARD · {def.reward}</p> : <p className="text-mx-amber">Threat increased. The mission stays available.</p>}
          <div className="flex flex-wrap gap-2 pt-2">
            <button className="btn btn-primary" onClick={() => setView({ mode: 'list' })}>Mission list</button>
            {!view.ok && <button className="btn" onClick={() => { startedAt.current = performance.now(); setView({ mode: 'run', id: view.id }); }}>Retry</button>}
            {view.ok && view.id === 'm05' && <button className="btn btn-primary" onClick={() => s.setModule('exit')}>Open Exit Protocol ▸</button>}
          </div>
        </div>
      </TerminalWindow>
    );
  }

  return (
    <div className="mx-auto max-w-6xl">
      <div className="mb-4 flex flex-wrap items-end gap-3">
        <div>
          <p className="font-mono text-[10px] tracking-[0.3em] text-mx-grey">IM.05 · INFILTRATION</p>
          <h1 className="font-head text-3xl text-accent">Infiltration Missions</h1>
        </div>
        <span className="ml-auto font-mono text-xs text-mx-grey">{missionsCompleted(s)}/5 complete</span>
      </div>
      <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-3">
        {MISSIONS.map((m) => <MissionCard key={m.id} def={m} state={s.missions[m.id]} onOpen={() => setView({ mode: 'brief', id: m.id })} />)}
      </div>
      <p className="mt-4 font-mono text-[11px] text-mx-grey">All hacking here is fictional and runs entirely inside this page. No real systems or networks are contacted.</p>
    </div>
  );
}

/** Mission 05: choose a route using intel, then survive that route. */
function ReachExit({ onEnd, btBonus }: { onEnd: (ok: boolean, score: number, detail: string) => void; btBonus: number }) {
  const s = useGame();
  const [route, setRoute] = useState<null | 'subway' | 'rooftops'>(null);
  const known = (id: string) => s.intel.includes(id);
  if (!route) {
    return (
      <div className="space-y-4 font-mono text-sm">
        <p className="text-mx-pale">Two routes reach the exit point. Your recovered intelligence:</p>
        <ul className="space-y-1 text-xs">
          {['sweep-pattern', 'subway-dead', 'exit-routing'].map((id) => <li key={id} className={known(id) ? 'text-accent' : 'text-mx-grey'}>{known(id) ? `▸ ${INTEL[id]}` : '▸ [not recovered: clear more Agent Detection segments]'}</li>)}
        </ul>
        <div className="grid gap-3 sm:grid-cols-2">
          <button className="tw p-4 text-left hover:border-[var(--accent)]" onClick={() => { s.recordDecision('m05-route', 'rooftops', ['Crossed the northern Agent sweep (+12% threat)', 'Faster Agents on route']); s.addThreat(12, 'rooftop route crosses the northern sweep'); setRoute('rooftops'); }}>
            <div className="font-head text-xl text-mx-white">› Option A · North rooftops</div><div className="text-xs text-mx-grey">Short, open, fast.</div>
          </button>
          <button className="tw p-4 text-left hover:border-[var(--accent)]" onClick={() => { s.recordDecision('m05-route', 'subway', ['Avoided the northern sweep', 'Fewer, slower Agents on route']); setRoute('subway'); sfx.ok(); }}>
            <div className="font-head text-xl text-mx-white">› Option B · Decommissioned subway</div><div className="text-xs text-mx-grey">Longer, dark, quiet.</div>
          </button>
        </div>
      </div>
    );
  }
  return (
    <EvasionGame map={MAPS[route]} btBonus={btBonus} title={route === 'subway' ? 'The Subway' : 'The Rooftops'}
      onEnd={(r) => onEnd(r.success, r.score, r.success ? `Exit point confirmed via the ${route} in ${r.time.toFixed(1)}s.` : 'caught before reaching the exit point')} />
  );
}
