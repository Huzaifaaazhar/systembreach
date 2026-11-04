import { useEffect, useRef, useState } from 'react';
import * as THREE from 'three';
import TerminalWindow from '../components/TerminalWindow';
import ExitProtocolScreen from '../components/ExitProtocolScreen';
import SpotChange from '../games/missions/SpotChange';
import ReflexGame from '../games/ReflexGame';
import EvasionGame, { MAPS } from '../games/EvasionGame';
import { RealitySim, type Body } from '../lib/realitySim';
import { useGame } from '../store/gameStore';
import { discoveredCount, missionsCompleted, realityIntegrity, undefinedUnlocked } from '../lib/derived';
import { sfx } from '../lib/audio';
import { rainControl } from '../components/DigitalRainBackground';
import type { EndingId } from '../types';
import { expose } from '../lib/debug';

type Stage = 'intro' | 'anomaly' | 'reflex' | 'manipulate' | 'evade' | 'decide';
const STAGES: { id: Stage; label: string }[] = [
  { id: 'anomaly', label: 'Anomaly identification' }, { id: 'reflex', label: 'Reflex check' }, { id: 'manipulate', label: 'Simulation manipulation' },
  { id: 'evade', label: 'Agent evasion' }, { id: 'decide', label: 'Decision' },
];

export default function ExitProtocol() {
  const s = useGame();
  const [stage, setStage] = useState<Stage>('intro');
  const [replay, setReplay] = useState(false);
  const score = useRef(0);
  const timeline = useRef<string[]>([]);
  const threatAtStart = useRef(0);
  const ended = useRef(false);

  const note = (t: string) => { timeline.current.push(t); };

  // During the protocol, reaching 100% threat means recapture instead of a lockdown.
  useEffect(() => {
    if (stage !== 'intro' && !ended.current && s.exitActive && s.simulation.threat >= 100) {
      note('Threat reached 100% during the exit attempt.'); finish('recaptured');
    }
  });
  useEffect(() => () => { useGame.getState().setExitActive(false); rainControl.speed = 1; }, []);

  const begin = () => {
    ended.current = false; score.current = 0; timeline.current = [];
    threatAtStart.current = s.simulation.threat;
    s.setExitActive(true); setReplay(false);
    note(`Protocol started at ${Math.round(s.simulation.threat)}% threat.`);
    setStage('anomaly'); sfx.ok();
  };

  function finish(ending: EndingId) {
    if (ended.current) return; ended.current = true;
    const st = useGame.getState();
    st.setExitActive(false);
    const report = {
      ending, at: Date.now(), threat: st.simulation.threat, integrity: realityIntegrity(st), missionsCompleted: missionsCompleted(st),
      anomaliesFound: discoveredCount(st), intel: st.intel.length, abilities: { ...st.abilities }, exitScore: Math.round(score.current), timeline: [...timeline.current],
    };
    st.setEnding(report);
    ending === 'recaptured' ? sfx.alert() : sfx.win();
    setStage('intro');
  }

  if (s.ending && !replay && stage === 'intro') return <ExitProtocolScreen report={s.ending} onReplay={() => setReplay(true)} />;

  const idx = STAGES.findIndex((x) => x.id === stage);
  const advance = (next: Stage) => { setStage(next); sfx.glitch(); };

  return (
    <div className="mx-auto max-w-5xl">
      <div className="mb-4">
        <p className="font-mono text-[10px] tracking-[0.3em] text-mx-grey">EX.07 · EXIT PROTOCOL</p>
        <h1 className="font-head text-3xl text-accent">Exit Protocol</h1>
        {stage !== 'intro' && (
          <ol className="mt-3 grid grid-cols-5 gap-1 font-mono text-[10px]" aria-label="Exit protocol stages">
            {STAGES.map((st, i) => (
              <li key={st.id} className={`border-t-2 pt-1 ${i < idx ? 'border-[var(--accent)] text-accent' : i === idx ? 'border-mx-amber text-mx-amber' : 'border-soft text-mx-grey'}`}>
                <span className="hidden sm:inline">{i + 1}. {st.label}</span><span className="sm:hidden">{i + 1}</span>
                <span className="sr-only">{i < idx ? ' done' : i === idx ? ' current' : ''}</span>
              </li>
            ))}
          </ol>
        )}
      </div>

      {stage === 'intro' && (
        <TerminalWindow title="Briefing" code="EX.07">
          <div className="space-y-3 font-mono text-sm">
            <p className="text-mx-pale">The exit point is open for a few minutes. To reach it you need everything you have learned: spot the patch, react in time, rewrite the room, slip past the Agents, then decide.</p>
            <p className="text-mx-amber">Current threat {Math.round(s.simulation.threat)}%. If it reaches 100% during the protocol, the system recaptures you. If it is 85% or higher when you pick up the line, they will be waiting.</p>
            <button className="btn btn-primary" onClick={begin}>Initiate exit protocol ▸</button>
          </div>
        </TerminalWindow>
      )}

      {stage === 'anomaly' && (
        <TerminalWindow title="Stage 1 · Identify the patch" code="S1">
          <p className="mb-3 font-mono text-xs text-mx-pale/85">The exit corridor is being patched as you approach. Find both changes.</p>
          <SpotChange changes={2} memorise={6} limit={25} onWrong={() => s.addThreat(3)}
            onEnd={(r) => { score.current += r.score * 0.2; note(r.success ? `Patch identified (${r.score}).` : 'Missed the patch (+10% threat).'); if (!r.success) s.addThreat(10, 'patch missed'); setTimeout(() => advance('reflex'), 900); }} />
        </TerminalWindow>
      )}

      {stage === 'reflex' && (
        <TerminalWindow title="Stage 2 · Reflex check" code="S2">
          <p className="mb-3 font-mono text-xs text-mx-pale/85">The door only opens on the right signal. React to GO, ignore the decoys.</p>
          <ReflexGame compact trials={6} onFinish={(r) => {
            score.current += r.accuracy * 0.2;
            const ok = r.accuracy >= 66;
            note(`Reflex: ${r.avgMs} ms avg, ${r.accuracy}% accuracy${ok ? '' : ' (+10% threat)'}.`);
            if (!ok) s.addThreat(10, 'door sequence fumbled');
            setTimeout(() => advance('manipulate'), 1100);
          }} />
        </TerminalWindow>
      )}

      {stage === 'manipulate' && (
        <TerminalWindow title="Stage 3 · Rewrite the room" code="S3">
          <GateStage onDone={(sec, deflects) => {
            score.current += Math.max(0, 20 - sec * 0.3 - deflects * 4);
            note(`Key through the gate in ${sec.toFixed(1)}s, deflected ${deflects}×.`);
            advance('evade');
          }} />
        </TerminalWindow>
      )}

      {stage === 'evade' && (
        <TerminalWindow title="Stage 4 · Reach the line" code="S4">
          <EvasionGame map={MAPS.exit} btBonus={s.missions.m03.status === 'completed' ? 1.25 : 1} title="The last corridor"
            onEnd={(r) => {
              if (r.success) { score.current += r.score * 0.2; note(`Reached the line in ${r.time.toFixed(1)}s, caught ${r.caught}×.`); setTimeout(() => advance('decide'), 900); }
              else { note('Caught three times in the last corridor.'); s.addThreat(25, 'cornered in the exit corridor'); if (useGame.getState().simulation.threat < 100) setTimeout(() => advance('decide'), 1200); }
            }} />
        </TerminalWindow>
      )}

      {stage === 'decide' && (
        <TerminalWindow title="Stage 5 · The line is ringing" code="S5" tone={s.simulation.threat >= 85 ? 'agent' : 'default'}>
          <div className="space-y-4 font-mono text-sm">
            <p className="text-mx-pale">The receiver is in front of you. Threat {Math.round(s.simulation.threat)}%{s.simulation.threat >= 85 ? '. They are close. Very close.' : '.'}</p>
            <div className="grid gap-3 sm:grid-cols-2">
              <button className="tw p-4 text-left hover:border-[var(--accent)]" onClick={() => { score.current += 20; note('Answered the line.'); s.recordDecision('exit', 'answer', ['Attempted to leave the Matrix']); finish(useGame.getState().simulation.threat >= 85 ? 'recaptured' : 'escaped'); }}>
                <div className="font-head text-xl text-accent">› Answer the line</div><div className="text-xs text-mx-grey">Leave the Matrix.</div>
              </button>
              <button className="tw p-4 text-left hover:border-[#9fb8c9]" onClick={() => { note('Walked away from the exit.'); s.recordDecision('exit', 'stay', ['Chose to remain in the simulation']); finish('remaining'); }}>
                <div className="font-head text-xl text-[#c6d6e0]">› Walk away</div><div className="text-xs text-mx-grey">Stay in the simulation.</div>
              </button>
              {undefinedUnlocked(s) ? (
                <button className="tw p-4 text-left hover:border-mx-amber sm:col-span-2" onClick={() => { score.current += 10; note('Traced the exit signal to its source.'); s.recordDecision('exit', 'trace-source', ['Followed the exit signal inward']); finish('undefined'); }}>
                  <div className="font-head text-xl text-mx-amber">› Trace the exit signal to its source</div><div className="text-xs text-mx-grey">Every anomaly you found points here. Something about this exit is wrong.</div>
                </button>
              ) : (
                <p className="text-[11px] text-mx-grey sm:col-span-2">Something about this exit feels wrong, but you cannot place it. (Hidden option: confirm all six anomalies and recover the exit-routing hint from Mission 05.)</p>
              )}
            </div>
          </div>
        </TerminalWindow>
      )}
    </div>
  );
}

/** Freeze the guard (click it), then invert gravity to float the key into the ceiling gate. */
function GateStage({ onDone }: { onDone: (seconds: number, deflects: number) => void }) {
  const host = useRef<HTMLDivElement>(null);
  const sim = useRef<RealitySim | null>(null);
  const [status, setStatus] = useState('A sentinel guards the gate in the ceiling. Click it to freeze it, then rewrite gravity to carry the key up.');
  const [grav, setGrav] = useState<-1 | 0 | 1>(-1);
  const [ts, setTs] = useState(1);
  const [t, setT] = useState(0);
  const addThreat = useGame((s) => s.addThreat);

  useEffect(() => {
    const s = new RealitySim(host.current!);
    sim.current = s;
    expose('gate', s);
    s.setView(0, 0.15, 15);
    const H = s.HALF;
    const ring = new THREE.Mesh(new THREE.TorusGeometry(1.5, 0.08, 8, 40), new THREE.MeshBasicMaterial({ color: 0xffffff }));
    ring.rotation.x = Math.PI / 2; ring.position.y = H - 0.05; s.scene.add(ring);
    const key = s.spawn('box', new THREE.Vector3(0, -H + 1, 0), { color: 0xe5f1e8, name: 'key', r: 0.75 });
    key.vel.set(0, 0, 0); key.ang.set(0.2, 0.5, 0);
    const sentinel = s.spawn('oct', new THREE.Vector3(0.9, H - 1.8, 0), { color: 0xe0303f, name: 'sentinel', fixed: true, r: 0.9 });
    sentinel.ghost = true;
    s.spawn('tetra', new THREE.Vector3(-3, -3, -2)); s.spawn('ico', new THREE.Vector3(3, -3, -2));
    let ang = 0, cd = 0, deflects = 0, elapsed = 0, done = false, tick = 0;
    s.onSelect = (b: Body | null) => {
      if (b?.name === 'sentinel') { s.setFrozen(b, !b.frozen); setStatus(b.frozen ? 'Sentinel frozen. Now rewrite gravity.' : 'Sentinel released.'); sfx.ok(); }
    };
    s.onStep = (dt, rdt) => {
      if (done) return;
      elapsed += rdt;
      if (++tick % 6 === 0) setT(elapsed);
      if (!sentinel.frozen) { ang += dt * 2.4; sentinel.mesh.position.set(Math.cos(ang) * 0.9, H - 1.8 + Math.sin(ang * 2) * 0.35, Math.sin(ang) * 0.9); sentinel.mesh.rotation.y += dt * 4; }
      cd = Math.max(0, cd - rdt);
      const kp = key.mesh.position;
      if (!sentinel.frozen && cd === 0 && kp.distanceTo(sentinel.mesh.position) < 1.6) {
        cd = 1.2; deflects++; key.vel.set(0, -14, 0); kp.y -= 0.8;
        addThreat(6, 'sentinel deflected the key'); setStatus('Deflected. Freeze the sentinel first (click it). Slowing time makes it easier to hit.');
      }
      if (kp.y > H - key.r - 0.4 && Math.hypot(kp.x, kp.z) < 1.4) { done = true; setStatus('Key through the gate. The door is open.'); sfx.win(); setTimeout(() => onDone(elapsed, deflects), 1100); }
    };
    return () => { s.destroy(); rainControl.speed = 1; };
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  const g = (d: -1 | 0 | 1) => { setGrav(d); sim.current!.gravity.set(0, d * 9.8, 0); sfx.tick(); };
  return (
    <div>
      <div className="mb-2 flex flex-wrap items-center gap-2 font-mono text-xs">
        <span className="text-mx-grey">GRAVITY</span>
        {([[-1, '↓ Down'], [0, '∅ Zero'], [1, '↑ Up']] as const).map(([d, l]) => <button key={d} className={`btn !min-h-9 ${grav === d ? 'on' : ''}`} aria-pressed={grav === d} onClick={() => g(d)}>{l}</button>)}
        <label className="ml-2 flex items-center gap-2 text-mx-grey">TIME {ts.toFixed(2)}×
          <input type="range" min={0.1} max={1} step={0.05} value={ts} className="w-32" aria-label="Time dilation" onChange={(e) => { const v = Number(e.target.value); setTs(v); sim.current!.timeScale = v; rainControl.speed = v; }} />
        </label>
        <span className="ml-auto tabular-nums text-mx-grey">{t.toFixed(1)}s</span>
      </div>
      <div ref={host} className="relative h-[min(55vh,480px)] min-h-[300px] w-full border border-line" role="application" aria-label="Exit gate room. Click the red sentinel to freeze it." />
      <p className="mt-2 font-mono text-xs text-mx-pale/85" aria-live="polite">{status}</p>
    </div>
  );
}
