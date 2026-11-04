import { useEffect, useRef, useState } from 'react';
import * as THREE from 'three';
import TerminalWindow from '../components/TerminalWindow';
import { RealitySim, type Body, type BodyKind, type EnvId } from '../lib/realitySim';
import { useGame } from '../store/gameStore';
import { sfx } from '../lib/audio';
import { rainControl } from '../components/DigitalRainBackground';
import { expose } from '../lib/debug';

const GRAVITY = { normal: [0, -9.8, 0], reduced: [0, -1.6, 0], zero: [0, 0, 0], inverted: [0, 9.8, 0] } as const;
type G = keyof typeof GRAVITY;
type TimeMode = 'normal' | 'slow' | 'paused';
const ENVS: { id: EnvId; label: string }[] = [{ id: 'room', label: 'Training room' }, { id: 'urban', label: 'Urban' }, { id: 'construct', label: 'Minimal Construct' }];
const KINDS: BodyKind[] = ['box', 'sphere', 'ico', 'oct', 'tetra'];

function populate(sim: RealitySim) {
  sim.clearBodies();
  (['box', 'sphere', 'ico', 'oct', 'tetra', 'box'] as BodyKind[]).forEach((k, i) => sim.spawn(k, new THREE.Vector3(-4 + i * 1.6, 2 + (i % 3), (i % 2) * 2 - 1)));
}

export default function Reality() {
  const host = useRef<HTMLDivElement>(null);
  const sim = useRef<RealitySim | null>(null);
  const realityAction = useGame((s) => s.realityAction);
  const control = useGame((s) => s.abilities.simulationControl);
  const [env, setEnv] = useState<EnvId>('room');
  const [grav, setGrav] = useState<G>('normal');
  const [time, setTime] = useState<TimeMode>('normal');
  const [slow, setSlow] = useState(0.25);
  const [bounce, setBounce] = useState(0.7);
  const [drag, setDrag] = useState(0.08);
  const [sel, setSel] = useState<Body | null>(null);
  const [readout, setReadout] = useState({ count: 0, pos: '', vel: '', speed: 0, collisions: 0 });
  const [log, setLog] = useState<string[]>(['SANDBOX MOUNTED', 'PHYSICS: EXPOSED']);
  const collisions = useRef(0);
  const [, bump] = useState(0);

  const say = (t: string) => setLog((l) => [t, ...l].slice(0, 12));
  const act = (t: string) => { say(t); realityAction(); sfx.tick(); };

  useEffect(() => {
    const s = new RealitySim(host.current!);
    sim.current = s;
    expose('reality', s);
    populate(s);
    s.onSelect = (b) => { setSel(b); if (b) say(`OBJECT_SELECTED: ${b.kind.toUpperCase()} #${b.id}`); };
    s.onCollide = (v) => { collisions.current++; if (v > 6) sfx.block(); };
    let k = 0;
    s.onStep = () => {
      if (++k % 8) return;
      const b = s.selected;
      setReadout({
        count: s.bodies.length,
        pos: b ? `${b.mesh.position.x.toFixed(1)}, ${b.mesh.position.y.toFixed(1)}, ${b.mesh.position.z.toFixed(1)}` : '',
        vel: b ? `${b.vel.x.toFixed(1)}, ${b.vel.y.toFixed(1)}, ${b.vel.z.toFixed(1)}` : '',
        speed: b ? b.vel.length() : 0,
        collisions: collisions.current,
      });
    };
    return () => { s.destroy(); rainControl.speed = 1; };
  }, []);

  // keyboard control of the selected object while the viewport has focus
  useEffect(() => {
    const el = host.current!;
    const key = (e: KeyboardEvent) => {
      const s = sim.current; const b = s?.selected; if (!s) return;
      const m: Record<string, [number, number, number]> = { ArrowLeft: [-0.5, 0, 0], KeyA: [-0.5, 0, 0], ArrowRight: [0.5, 0, 0], KeyD: [0.5, 0, 0], ArrowUp: [0, 0, -0.5], KeyW: [0, 0, -0.5], ArrowDown: [0, 0, 0.5], KeyS: [0, 0, 0.5], KeyR: [0, 0.5, 0], KeyF: [0, -0.5, 0] };
      if (b && m[e.code]) { e.preventDefault(); s.move(b, new THREE.Vector3(...m[e.code])); act('OBJECT_POSITION: MOVED'); }
      else if (b && (e.code === 'KeyQ' || e.code === 'KeyE')) { s.rotate(b, 'y', e.code === 'KeyQ' ? -0.26 : 0.26); act('OBJECT_ROTATION: ALTERED'); }
      else if (b && (e.code === 'Delete' || e.code === 'Backspace')) { e.preventDefault(); s.remove(b); act('OBJECT: DELETED'); }
      else if (b && e.code === 'Space') { e.preventDefault(); s.launch(b, new THREE.Vector3(0, 9, 0)); act('VELOCITY: +Y 9'); }
    };
    el.addEventListener('keydown', key);
    return () => el.removeEventListener('keydown', key);
  });

  const setGravity = (g: G) => { setGrav(g); sim.current!.gravity.set(GRAVITY[g][0], GRAVITY[g][1], GRAVITY[g][2]); act(`GRAVITY_VECTOR: ${g.toUpperCase()} [${GRAVITY[g].join(',')}]`); };
  const setTimeMode = (t: TimeMode, value = slow) => {
    const s = sim.current!; setTime(t);
    s.paused = t === 'paused'; s.timeScale = t === 'slow' ? value : 1;
    rainControl.speed = t === 'paused' ? 0.02 : s.timeScale;
    t === 'normal' ? sfx.fast() : sfx.slow();
    act(t === 'paused' ? 'TIME: HALTED' : t === 'slow' ? `TIME_DILATION: ${value.toFixed(2)}×` : 'TIME: NOMINAL');
  };
  const spawn = (k: BodyKind, high = false) => {
    const s = sim.current!;
    if (s.bodies.length >= 24) { say('OBJECT LIMIT REACHED (24)'); return; }
    const b = s.spawn(k, new THREE.Vector3((Math.random() - 0.5) * 4, high ? 5 : 1, (Math.random() - 0.5) * 4));
    if (high) b.vel.set(0, 0, 0);
    s.select(b); act(high ? `OBJECT DROPPED: ${k.toUpperCase()}` : `OBJECT INSTANTIATED: ${k.toUpperCase()}`);
  };
  const reset = () => {
    const s = sim.current!;
    s.setEnvironment('room'); s.gravity.set(0, -9.8, 0); s.timeScale = 1; s.paused = false; s.bounce = 0.7; s.drag = 0.08; s.select(null);
    populate(s); collisions.current = 0; rainControl.speed = 1;
    setEnv('room'); setGrav('normal'); setTime('normal'); setSlow(0.25); setBounce(0.7); setDrag(0.08);
    setLog(['ENVIRONMENT RESTORED TO DEFAULT']); sfx.glitch();
  };

  const b = sel && sim.current?.bodies.includes(sel) ? sel : null;
  const nudge = (v: [number, number, number], label: string) => { if (!b) return; sim.current!.move(b, new THREE.Vector3(...v)); act(label); };

  return (
    <div className="mx-auto grid max-w-7xl items-start gap-4 xl:grid-cols-[1fr_340px]">
      <div className="grid content-start gap-4">
        <TerminalWindow title="Reality Manipulation Lab" code="RM.06" bodyClassName="p-0" right={<span className="font-mono text-[10px] text-mx-grey">{readout.count} OBJ · {readout.collisions} COLLISIONS</span>}>
          <div ref={host} className="relative h-[min(60vh,560px)] min-h-[320px] w-full outline-none" aria-label="3D sandbox. Click an object to select it; drag a selected object to move it; drag empty space to orbit; scroll or pinch to zoom." role="application" />
        </TerminalWindow>
        <p className="font-mono text-[11px] text-mx-grey">Click to select · drag selected object to move · drag empty space to orbit · wheel/pinch zoom · with the view focused: WASD/arrows move, R/F up/down, Q/E rotate, Space launch, Delete remove.</p>
      </div>

      <div className="grid content-start gap-3">
        <TerminalWindow title="Rules" code="CTL">
          <div className="space-y-4 font-mono text-xs">
            <Group label="ENVIRONMENT">
              {ENVS.map((e) => <button key={e.id} className={`btn !min-h-9 ${env === e.id ? 'on' : ''}`} aria-pressed={env === e.id} onClick={() => { setEnv(e.id); sim.current!.setEnvironment(e.id); act(`ENVIRONMENT: ${e.label.toUpperCase()}`); }}>{e.label}</button>)}
            </Group>
            <Group label="GRAVITY">
              {(Object.keys(GRAVITY) as G[]).map((g) => <button key={g} className={`btn !min-h-9 ${grav === g ? 'on' : ''}`} aria-pressed={grav === g} onClick={() => setGravity(g)}>{g}</button>)}
            </Group>
            <Group label="TIME">
              <button className={`btn !min-h-9 ${time === 'paused' ? 'on' : ''}`} aria-pressed={time === 'paused'} onClick={() => setTimeMode('paused')}>Pause</button>
              <button className={`btn !min-h-9 ${time === 'slow' ? 'on' : ''}`} aria-pressed={time === 'slow'} onClick={() => setTimeMode('slow')}>Slow</button>
              <button className={`btn !min-h-9 ${time === 'normal' ? 'on' : ''}`} aria-pressed={time === 'normal'} onClick={() => setTimeMode('normal')}>Resume</button>
              <label className="mt-1 w-full text-[10px] tracking-[0.15em] text-mx-grey">SLOW FACTOR {slow.toFixed(2)}×
                <input type="range" min={0.05} max={0.9} step={0.05} value={slow} onChange={(e) => { const v = Number(e.target.value); setSlow(v); if (time === 'slow') { sim.current!.timeScale = v; rainControl.speed = v; } }} onPointerUp={() => time === 'slow' && act(`TIME_DILATION: ${slow.toFixed(2)}×`)} aria-label="Slow factor" />
              </label>
            </Group>
            <Group label="SPAWN / DROP">
              {KINDS.map((k) => <button key={k} className="btn !min-h-9" onClick={() => spawn(k)}>+ {k}</button>)}
              <button className="btn !min-h-9" onClick={() => spawn(KINDS[Math.floor(Math.random() * 5)], true)}>Drop from height</button>
              <button className="btn !min-h-9" onClick={() => { sim.current!.impulseAll(9); act('MOTION_VECTOR: OVERRIDDEN (ALL)'); sfx.glitch(); }}>Impulse all</button>
            </Group>
            <Group label="CONDITIONS">
              <label className="w-full text-[10px] tracking-[0.15em] text-mx-grey">BOUNCE {bounce.toFixed(2)}
                <input type="range" min={0} max={1} step={0.05} value={bounce} onChange={(e) => { const v = Number(e.target.value); setBounce(v); sim.current!.bounce = v; }} onPointerUp={() => act(`RESTITUTION: ${bounce.toFixed(2)}`)} aria-label="Bounce" />
              </label>
              <label className="w-full text-[10px] tracking-[0.15em] text-mx-grey">AIR DRAG {drag.toFixed(2)}
                <input type="range" min={0} max={2} step={0.05} value={drag} onChange={(e) => { const v = Number(e.target.value); setDrag(v); sim.current!.drag = v; }} onPointerUp={() => act(`DRAG: ${drag.toFixed(2)}`)} aria-label="Air drag" />
              </label>
            </Group>
            <button className="btn btn-amber w-full" onClick={reset}>Reset environment</button>
          </div>
        </TerminalWindow>

        <TerminalWindow title="Selected Object" code="OBJ">
          {!b ? <p className="font-mono text-xs text-mx-grey">Click an object in the view to select it.</p> : (
            <div className="space-y-3 font-mono text-xs">
              <p className="text-mx-white">{b.kind.toUpperCase()} #{b.id} {b.frozen && <span className="text-mx-amber">· FROZEN</span>}</p>
              <dl className="grid grid-cols-[60px_1fr] gap-x-2 text-[11px]"><dt className="text-mx-grey">POS</dt><dd className="tabular-nums">{readout.pos}</dd><dt className="text-mx-grey">VEL</dt><dd className="tabular-nums">{readout.vel} ({readout.speed.toFixed(1)} m/s)</dd></dl>
              <Group label="MOVE">
                <button className="btn !min-h-9 !px-3" aria-label="Move left" onClick={() => nudge([-0.6, 0, 0], 'OBJECT_POSITION: −X')}>←</button>
                <button className="btn !min-h-9 !px-3" aria-label="Move right" onClick={() => nudge([0.6, 0, 0], 'OBJECT_POSITION: +X')}>→</button>
                <button className="btn !min-h-9 !px-3" aria-label="Move back" onClick={() => nudge([0, 0, -0.6], 'OBJECT_POSITION: −Z')}>⇡</button>
                <button className="btn !min-h-9 !px-3" aria-label="Move forward" onClick={() => nudge([0, 0, 0.6], 'OBJECT_POSITION: +Z')}>⇣</button>
                <button className="btn !min-h-9 !px-3" aria-label="Move up" onClick={() => nudge([0, 0.6, 0], 'OBJECT_POSITION: +Y')}>▲</button>
                <button className="btn !min-h-9 !px-3" aria-label="Move down" onClick={() => nudge([0, -0.6, 0], 'OBJECT_POSITION: −Y')}>▼</button>
              </Group>
              <Group label="ROTATE">
                {(['x', 'y', 'z'] as const).map((ax) => <button key={ax} className="btn !min-h-9" onClick={() => { sim.current!.rotate(b, ax, Math.PI / 8); act(`OBJECT_ROTATION: ${ax.toUpperCase()} +22.5°`); }}>{ax.toUpperCase()} +22°</button>)}
              </Group>
              <Group label="VELOCITY">
                <button className="btn !min-h-9" onClick={() => { sim.current!.launch(b, new THREE.Vector3(0, 10, 0)); act('VELOCITY: +Y 10'); }}>Launch up</button>
                <button className="btn !min-h-9" onClick={() => { sim.current!.launch(b, new THREE.Vector3((Math.random() - 0.5) * 16, 2, (Math.random() - 0.5) * 16)); act('VELOCITY: LATERAL'); }}>Throw</button>
                <button className="btn !min-h-9" onClick={() => { b.vel.set(0, 0, 0); b.ang.set(0, 0, 0); act('VELOCITY: ZEROED'); }}>Stop</button>
              </Group>
              <div className="flex flex-wrap gap-2">
                <button className={`btn !min-h-9 ${b.frozen ? 'on' : ''}`} aria-pressed={b.frozen} onClick={() => { sim.current!.setFrozen(b, !b.frozen); act(b.frozen ? 'OBJECT_STATE: FROZEN' : 'OBJECT_STATE: RELEASED'); bump((n) => n + 1); }}>{b.frozen ? 'Unfreeze' : 'Freeze'}</button>
                <button className="btn btn-danger !min-h-9" onClick={() => { sim.current!.remove(b); act('OBJECT: DELETED'); }}>Remove</button>
              </div>
            </div>
          )}
        </TerminalWindow>

        <TerminalWindow title="Sys Log" code="LOG" right={<span className="font-mono text-[10px] text-mx-grey">CONTROL {control}</span>}>
          <ul className="space-y-0.5 font-mono text-[11px] text-mx-pale/85" aria-live="polite">{log.map((l, i) => <li key={i}>&gt; {l}</li>)}</ul>
        </TerminalWindow>
      </div>
    </div>
  );
}

function Group({ label, children }: { label: string; children: React.ReactNode }) {
  return <div><div className="mb-1.5 text-[10px] tracking-[0.2em] text-mx-grey">{label}</div><div className="flex flex-wrap gap-1.5">{children}</div></div>;
}
