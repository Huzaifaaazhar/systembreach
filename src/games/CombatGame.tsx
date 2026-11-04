import { useRef, useState } from 'react';
import SimulationCanvas, { CanvasOverlay } from '../components/SimulationCanvas';
import TrainingControls from '../components/TrainingControls';
import BulletTimeIndicator from '../components/BulletTimeIndicator';
import { useGameLoop } from '../hooks/useGameLoop';
import { useInput } from '../hooks/useInput';
import { consume } from '../lib/input';
import { fitCanvas, rand, C } from '../lib/canvas';
import { sfx } from '../lib/audio';
import { rainControl } from '../components/DigitalRainBackground';
import { expose } from '../lib/debug';

const W = 800;
type OppState = 'approach' | 'windup' | 'strike' | 'recover' | 'stagger' | 'retreat';
export interface CombatResult { score: number; win: boolean; perfects: number; counters: number; reactionMs: number | null }

function fresh(floor: number) {
  return {
    p: { x: 230, y: floor, vy: 0, face: 1, hp: 100, atk: 0, atkHit: false, block: false, blockAt: -9, dash: 0, inv: 0 },
    o: { x: 560, y: floor, face: -1, hp: 100, state: 'approach' as OppState, t: rand(0.6, 1.2), kind: 'high' as 'high' | 'low', windAt: 0, reacted: false },
    time: 0, bt: 0, btCharge: 1, btCool: 0, perfects: 0, counters: 0, blocks: 0, reactions: [] as number[], fx: [] as { x: number; y: number; t: number; text: string; color: string }[], over: false,
  };
}

/** Side-view sparring program. Read the tells: block highs, jump or dash lows, counter the recovery. */
export default function CombatGame({ onFinish }: { onFinish: (r: CombatResult) => void }) {
  const cv = useRef<HTMLCanvasElement>(null);
  const input = useInput();
  const [phase, setPhase] = useState<'ready' | 'play' | 'done'>('ready');
  const [hud, setHud] = useState({ php: 100, ohp: 100, time: 60, bt: 1, btState: 'ready' as 'ready' | 'active' | 'cooldown' });
  const [result, setResult] = useState<CombatResult | null>(null);
  const g = useRef(fresh(300));
  const floorRef = useRef(300);
  const mouse = useRef({ block: false });

  const start = () => { g.current = fresh(floorRef.current); expose('combat', g.current); setPhase('play'); sfx.ok(); cv.current?.focus(); };

  const finish = (win: boolean) => {
    const s = g.current; s.over = true; rainControl.speed = 1;
    const reactionMs = s.reactions.length ? Math.round(s.reactions.reduce((a, b) => a + b, 0) / s.reactions.length) : null;
    const score = Math.round(Math.min(100, win ? 50 + s.p.hp * 0.3 + s.perfects * 4 + s.counters * 2 : (100 - s.o.hp) * 0.45 + s.perfects * 2));
    const r = { score, win, perfects: s.perfects, counters: s.counters, reactionMs };
    setResult(r); setPhase('done'); win ? sfx.win() : sfx.err();
    onFinish(r);
  };

  useGameLoop((rdt) => {
    const c = cv.current; if (!c) return;
    const ctx = c.getContext('2d')!;
    const { w, h } = fitCanvas(c, ctx);
    const sc = w / W; const H = h / sc; const floor = H - 50; floorRef.current = floor;
    const s = g.current;
    const p = s.p, o = s.o;

    if (phase === 'play' && !s.over) {
      // bullet time (opponent and world slow, you do not)
      if (consume(input, 'KeyQ') && s.btCharge >= 1 && s.bt <= 0) { s.bt = 2.5; s.btCharge = 0; sfx.slow(); }
      if (s.bt > 0) { s.bt -= rdt; if (s.bt <= 0) { s.btCool = 8; sfx.fast(); } }
      else if (s.btCool > 0) { s.btCool -= rdt; s.btCharge = 1 - s.btCool / 8; if (s.btCool <= 0) s.btCharge = 1; }
      const ts = s.bt > 0 ? 0.3 : 1; const odt = rdt * ts;
      rainControl.speed = ts;
      s.time += rdt;

      // player
      const blocking = input.block || mouse.current.block;
      if (blocking && !p.block) {
        p.blockAt = s.time;
        if (o.state === 'windup' && !o.reacted) { o.reacted = true; s.reactions.push((s.time - o.windAt) * 1000); }
      }
      p.block = blocking && p.atk <= 0;
      const speed = p.block ? 120 : 260;
      if (p.dash > 0) { p.dash -= rdt; p.x += (input.x ? Math.sign(input.x) : -p.face) * 700 * rdt; }
      else p.x += input.x * speed * rdt;
      if (consume(input, 'ShiftLeft', 'ShiftRight') && p.dash <= 0) {
        p.dash = 0.18; p.inv = 0.3; sfx.swing();
        if (o.state === 'windup' && !o.reacted) { o.reacted = true; s.reactions.push((s.time - o.windAt) * 1000); }
      }
      if (consume(input, 'Space', 'KeyW', 'ArrowUp') && p.y >= floor) {
        p.vy = -520;
        if (o.state === 'windup' && !o.reacted) { o.reacted = true; s.reactions.push((s.time - o.windAt) * 1000); }
      }
      p.vy += 1500 * rdt; p.y = Math.min(floor, p.y + p.vy * rdt); if (p.y >= floor) p.vy = 0;
      p.x = Math.max(40, Math.min(W - 40, p.x));
      p.face = o.x > p.x ? 1 : -1;
      p.inv = Math.max(0, p.inv - rdt);
      if ((consume(input, 'KeyJ') || input.attack) && p.atk <= 0 && !p.block) { p.atk = 0.28; p.atkHit = false; sfx.swing(); input.attack = false; }
      if (p.atk > 0) {
        p.atk -= rdt;
        if (!p.atkHit && p.atk < 0.2 && Math.abs(o.x - p.x) < 115) {
          p.atkHit = true;
          const counter = o.state === 'recover' || o.state === 'stagger';
          const dmg = counter ? 18 : 8;
          o.hp = Math.max(0, o.hp - dmg); sfx.hit();
          if (counter) s.counters++;
          s.fx.push({ x: o.x, y: o.y - 110, t: 0.8, text: counter ? `COUNTER ${dmg}` : String(dmg), color: counter ? C.green : C.pale });
          if (o.state !== 'strike') { o.x += p.face * 25; }
        }
      }

      // opponent AI: telegraph → strike → vulnerable recovery. Timing is random but every attack is readable.
      o.face = p.x > o.x ? 1 : -1;
      o.t -= odt;
      const dist = Math.abs(p.x - o.x);
      switch (o.state) {
        case 'approach':
          if (dist > 120) o.x += o.face * 150 * odt;
          if (o.t <= 0 && dist < 170) { o.state = 'windup'; o.kind = Math.random() < 0.35 ? 'low' : 'high'; o.t = rand(0.55, 0.75) - Math.min(0.2, s.time / 300); o.windAt = s.time; o.reacted = false; }
          else if (o.t <= 0) o.t = 0.3;
          break;
        case 'windup':
          if (o.t <= 0) { o.state = 'strike'; o.t = 0.14; resolveStrike(); }
          break;
        case 'strike': if (o.t <= 0) { o.state = 'recover'; o.t = 0.55; } break;
        case 'recover': if (o.t <= 0) { o.state = Math.random() < 0.3 ? 'retreat' : 'approach'; o.t = rand(0.4, 1.2); } break;
        case 'stagger': if (o.t <= 0) { o.state = 'approach'; o.t = rand(0.5, 1); } break;
        case 'retreat': o.x -= o.face * 120 * odt; if (o.t <= 0) { o.state = 'approach'; o.t = rand(0.3, 0.9); } break;
      }
      o.x = Math.max(40, Math.min(W - 40, o.x));
      if (Math.abs(o.x - p.x) < 50) o.x = p.x + (o.x >= p.x ? 50 : -50);

      function resolveStrike() {
        if (Math.abs(p.x - o.x) > 135) { s.fx.push({ x: p.x, y: p.y - 120, t: 0.6, text: 'OUT OF RANGE', color: C.grey }); return; }
        if (p.inv > 0) { s.fx.push({ x: p.x, y: p.y - 120, t: 0.7, text: 'DODGED', color: C.green }); return; }
        if (o.kind === 'low' && p.y < floor - 25) { s.fx.push({ x: p.x, y: p.y - 120, t: 0.7, text: 'EVADED', color: C.green }); return; }
        if (o.kind === 'high' && p.block) {
          if (s.time - p.blockAt < 0.28) { s.perfects++; o.state = 'stagger'; o.t = 0.9; s.fx.push({ x: p.x, y: p.y - 120, t: 0.8, text: 'PERFECT BLOCK', color: C.green }); sfx.ok(); }
          else { s.blocks++; s.fx.push({ x: p.x, y: p.y - 120, t: 0.6, text: 'BLOCKED', color: C.pale }); sfx.block(); }
          return;
        }
        const dmg = o.kind === 'low' ? 10 : 14;
        p.hp = Math.max(0, p.hp - dmg); sfx.hit();
        s.fx.push({ x: p.x, y: p.y - 120, t: 0.8, text: `-${dmg}${o.kind === 'low' && p.block ? ' (LOW: JUMP OR DASH)' : ''}`, color: C.redBright });
      }

      if (o.hp <= 0) finish(true);
      else if (p.hp <= 0 || s.time >= 60) finish(false);
      setHud({ php: p.hp, ohp: o.hp, time: Math.max(0, 60 - s.time), bt: s.btCharge, btState: s.bt > 0 ? 'active' : s.btCool > 0 ? 'cooldown' : 'ready' });
    }

    // ── draw ──
    ctx.save(); ctx.scale(sc, sc);
    ctx.fillStyle = s.bt > 0 ? '#031008' : C.black; ctx.fillRect(0, 0, W, H);
    ctx.strokeStyle = 'rgba(27,107,54,.35)'; ctx.lineWidth = 1;
    for (let x = 0; x <= W; x += 50) { ctx.beginPath(); ctx.moveTo(x, floor); ctx.lineTo(W / 2 + (x - W / 2) * 1.8, H); ctx.stroke(); }
    ctx.beginPath(); ctx.moveTo(0, floor); ctx.lineTo(W, floor); ctx.strokeStyle = C.muted; ctx.stroke();
    figure(ctx, p.x, p.y, p.face, C.phosphor, { atk: p.atk > 0, block: p.block, air: p.y < floor - 2, ghost: p.inv > 0 });
    const tell = o.state === 'windup';
    figure(ctx, o.x, o.y, o.face, o.state === 'stagger' ? C.grey : C.white, { atk: o.state === 'strike', windup: tell, low: o.kind === 'low' && (tell || o.state === 'strike'), air: false, block: false });
    if (tell) {
      ctx.fillStyle = o.kind === 'low' ? C.amber : C.white; ctx.font = 'bold 26px "IBM Plex Mono", monospace'; ctx.textAlign = 'center';
      ctx.fillText(o.kind === 'low' ? '▼ LOW' : '! HIGH', o.x, o.y - 130);
    }
    if (o.state === 'recover' || o.state === 'stagger') { ctx.fillStyle = C.green; ctx.font = '12px "IBM Plex Mono", monospace'; ctx.textAlign = 'center'; ctx.fillText('OPEN', o.x, o.y - 125); }
    for (const f of s.fx) {
      f.t -= rdt; f.y -= 30 * rdt;
      ctx.globalAlpha = Math.max(0, f.t); ctx.fillStyle = f.color; ctx.font = '14px "IBM Plex Mono", monospace'; ctx.textAlign = 'center'; ctx.fillText(f.text, f.x, f.y);
    }
    ctx.globalAlpha = 1; s.fx = s.fx.filter((f) => f.t > 0);
    if (s.bt > 0) { ctx.fillStyle = 'rgba(0,255,65,.7)'; ctx.font = '12px "IBM Plex Mono", monospace'; ctx.textAlign = 'left'; ctx.fillText('T × 0.30', 12, H - 14); }
    ctx.restore();
  });

  return (
    <div>
      <div className="mb-2 flex flex-wrap items-center gap-4 font-mono text-xs">
        <Bar label="YOU" v={hud.php} />
        <Bar label="PROGRAM" v={hud.ohp} invert />
        <span className="tabular-nums text-mx-pale">{hud.time.toFixed(1)}s</span>
        <BulletTimeIndicator charge={hud.bt} state={hud.btState} />
      </div>
      <SimulationCanvas
        ref={cv}
        label="Combat arena. You fight a sparring program."
        onPointerDown={(e) => { if (phase !== 'play') return; if (e.button === 2) mouse.current.block = true; else input.pressed.add('KeyJ'); }}
        onPointerUp={(e) => { if (e.button === 2) mouse.current.block = false; }}
        onContextMenu={(e) => e.preventDefault()}
      >
        {phase === 'ready' && (
          <CanvasOverlay>
            <h3 className="font-head mb-2 text-2xl text-accent">Sparring Program</h3>
            <p className="mb-2 font-mono text-xs text-mx-pale">It telegraphs every attack. <b>! HIGH</b>: block. <b>▼ LOW</b>: jump or dash. Hit it when it shows <b>OPEN</b> for a counter.</p>
            <p className="mb-4 font-mono text-[11px] text-mx-grey">A/D move · Space jump · J or click attack · K or right-click block · Shift dash · Q bullet time</p>
            <button className="btn btn-primary" onClick={start}>Begin round</button>
          </CanvasOverlay>
        )}
        {phase === 'done' && result && (
          <CanvasOverlay>
            <h3 className={`font-head mb-2 text-3xl ${result.win ? 'text-accent' : 'text-[#ff6b77]'}`}>{result.win ? 'Program defeated' : 'Round lost'}</h3>
            <p className="mb-4 font-mono text-xs text-mx-pale">Score {result.score} · perfect blocks {result.perfects} · counters {result.counters} · avg reaction {result.reactionMs ?? '—'} ms</p>
            <button className="btn btn-primary" onClick={start}>Fight again</button>
          </CanvasOverlay>
        )}
      </SimulationCanvas>
      <TrainingControls input={input} axes="x" actions={[{ key: 'attack', label: 'ATTACK' }, { key: 'block', label: 'BLOCK' }, { key: 'jump', label: 'JUMP' }, { key: 'boost', label: 'DASH' }, { key: 'bullet', label: 'BULLET T' }]} />
    </div>
  );
}

function Bar({ label, v, invert }: { label: string; v: number; invert?: boolean }) {
  return (
    <div className="w-36">
      <div className="flex justify-between text-[10px] tracking-[0.15em]"><span className={invert ? 'text-mx-white' : 'text-accent'}>{label}</span><span className="text-mx-grey">{Math.round(v)}</span></div>
      <div className={`meter ${v < 30 ? 'red' : ''}`}><i style={{ width: `${v}%` }} /></div>
    </div>
  );
}

function figure(ctx: CanvasRenderingContext2D, x: number, y: number, face: number, color: string, o: { atk?: boolean; block?: boolean; air?: boolean; windup?: boolean; low?: boolean; ghost?: boolean }) {
  ctx.save();
  ctx.translate(x, y); ctx.scale(face, 1);
  ctx.strokeStyle = color; ctx.lineWidth = 4; ctx.lineCap = 'round';
  ctx.shadowColor = color; ctx.shadowBlur = o.windup ? 18 : 6;
  if (o.ghost) ctx.globalAlpha = 0.45;
  const crouch = o.low && o.windup ? 18 : 0;
  ctx.beginPath(); ctx.arc(0, -98 + crouch, 11, 0, 7); ctx.stroke();
  ctx.beginPath(); ctx.moveTo(0, -86 + crouch); ctx.lineTo(0, -40 + crouch / 2); ctx.stroke();
  // arms
  ctx.beginPath();
  if (o.block) { ctx.moveTo(0, -78); ctx.lineTo(18, -88); ctx.lineTo(20, -104); ctx.moveTo(0, -74); ctx.lineTo(16, -80); ctx.lineTo(22, -96); }
  else if (o.atk && !o.low) { ctx.moveTo(0, -78); ctx.lineTo(56, -80); ctx.moveTo(0, -76); ctx.lineTo(-16, -60); }
  else if (o.windup && !o.low) { ctx.moveTo(0, -78); ctx.lineTo(-22, -100); ctx.lineTo(-10, -120); ctx.moveTo(0, -76); ctx.lineTo(16, -62); }
  else { ctx.moveTo(0, -78); ctx.lineTo(14, -60); ctx.lineTo(24, -70); ctx.moveTo(0, -78); ctx.lineTo(-10, -58); }
  ctx.stroke();
  // legs
  ctx.beginPath();
  if (o.air) { ctx.moveTo(0, -40); ctx.lineTo(16, -24); ctx.lineTo(4, -8); ctx.moveTo(0, -40); ctx.lineTo(-14, -22); ctx.lineTo(-6, -6); }
  else if (o.low && o.atk) { ctx.moveTo(0, -32); ctx.lineTo(64, -4); ctx.moveTo(0, -32); ctx.lineTo(-18, 0); }
  else { ctx.moveTo(0, -40 + crouch / 2); ctx.lineTo(14, 0); ctx.moveTo(0, -40 + crouch / 2); ctx.lineTo(-14, 0); }
  ctx.stroke();
  ctx.restore();
}
