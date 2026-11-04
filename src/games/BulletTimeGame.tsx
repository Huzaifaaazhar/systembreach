import { useRef, useState } from 'react';
import SimulationCanvas, { CanvasOverlay } from '../components/SimulationCanvas';
import TrainingControls from '../components/TrainingControls';
import BulletTimeIndicator from '../components/BulletTimeIndicator';
import { useGameLoop } from '../hooks/useGameLoop';
import { useInput } from '../hooks/useInput';
import { fitCanvas, rand, C } from '../lib/canvas';
import { sfx } from '../lib/audio';
import { rainControl } from '../components/DigitalRainBackground';
import { expose } from '../lib/debug';

export interface BulletResult { score: number; wavesCleared: number; hits: number; reactionMs: number | null }
const WAVES = 5, WAVE_LEN = 9;

type Shot = { x: number; y: number; vx: number; vy: number; fast: boolean };
type Warn = { x: number; y: number; ang: number; t: number; n: number; at: number };

/**
 * Waves of incoming fire. Hold Q (or the button) to slow the world to 0.2×.
 * Charge lasts ~3 s of real time; when empty it must cool down fully. Reaction time is measured
 * from each volley's warning to your bullet-time activation.
 */
export default function BulletTimeGame({ onFinish, durationBonus = 1, waves = WAVES, title = 'Bullet-Time Training' }: { onFinish: (r: BulletResult) => void; durationBonus?: number; waves?: number; title?: string }) {
  const cv = useRef<HTMLCanvasElement>(null);
  const input = useInput();
  const [phase, setPhase] = useState<'ready' | 'play' | 'done'>('ready');
  const [hud, setHud] = useState({ wave: 1, hits: 0, charge: 1, state: 'ready' as 'ready' | 'active' | 'cooldown', left: WAVE_LEN });
  const [res, setRes] = useState<BulletResult | null>(null);
  const S = useRef({ px: 0, py: 0, shots: [] as Shot[], warns: [] as Warn[], ts: 1, charge: 1, cooling: false, active: false, t: 0, wave: 1, spawn: 1, volley: 2.5, hits: 0, inv: 0, reactions: [] as number[], pendingWarnAt: null as number | null, trail: [] as [number, number][], W: 0, H: 0, over: false });
  const ptr = useRef<{ x: number; y: number } | null>(null);
  expose('bullet', S.current);

  const start = () => {
    const s = S.current;
    Object.assign(s, { shots: [], warns: [], ts: 1, charge: 1, cooling: false, active: false, t: 0, wave: 1, spawn: 1, volley: 2.5, hits: 0, inv: 0, reactions: [], pendingWarnAt: null, trail: [], over: false, px: s.W / 2, py: s.H * 0.7 });
    setPhase('play'); sfx.ok(); cv.current?.focus();
  };

  const end = (cleared: number) => {
    const s = S.current; s.over = true; rainControl.speed = 1;
    const reactionMs = s.reactions.length ? Math.round(s.reactions.reduce((a, b) => a + b, 0) / s.reactions.length) : null;
    const score = Math.round(Math.max(0, Math.min(100, (cleared / waves) * 70 + 30 - s.hits * 6 + (reactionMs ? Math.max(0, (700 - reactionMs) / 35) : 0))));
    const r = { score, wavesCleared: cleared, hits: s.hits, reactionMs };
    setRes(r); setPhase('done'); sfx.win(); onFinish(r);
  };

  useGameLoop((rdt, now) => {
    const c = cv.current; if (!c) return;
    const ctx = c.getContext('2d')!;
    const { w, h } = fitCanvas(c, ctx);
    const s = S.current; s.W = w; s.H = h;
    if (!s.px) { s.px = w / 2; s.py = h * 0.7; }

    if (phase === 'play' && !s.over) {
      // bullet-time charge: drains while held, full cooldown when emptied
      const want = input.bullet && !s.cooling && s.charge > 0;
      if (want && !s.active) {
        s.active = true; sfx.slow();
        if (s.pendingWarnAt != null) { s.reactions.push(now - s.pendingWarnAt); s.pendingWarnAt = null; }
      }
      if (!want && s.active) { s.active = false; sfx.fast(); }
      if (s.active) { s.charge -= rdt / (3 * durationBonus); if (s.charge <= 0) { s.charge = 0; s.cooling = true; s.active = false; sfx.fast(); } }
      else { s.charge = Math.min(1, s.charge + rdt / (s.cooling ? 4 : 6)); if (s.cooling && s.charge >= 1) s.cooling = false; }
      s.ts += ((s.active ? 0.2 : 1) - s.ts) * Math.min(1, rdt * 10);
      rainControl.speed = s.ts;

      // player moves in real time; Shift boosts
      const sp = (input.boost ? 520 : 340) * Math.max(0.7, Math.min(1.2, w / 900));
      if (input.x || input.y) { const m = Math.hypot(input.x, input.y) || 1; s.px += (input.x / Math.max(1, m)) * sp * rdt; s.py += (input.y / Math.max(1, m)) * sp * rdt; ptr.current = null; }
      else if (ptr.current) { const dx = ptr.current.x - s.px, dy = ptr.current.y - s.py, d = Math.hypot(dx, dy); if (d > 2) { const k = Math.min(d, sp * rdt) / d; s.px += dx * k; s.py += dy * k; } }
      s.px = Math.max(10, Math.min(w - 10, s.px)); s.py = Math.max(10, Math.min(h - 10, s.py));
      s.trail.push([s.px, s.py]); if (s.trail.length > (s.active ? 12 : 4)) s.trail.shift();
      s.inv = Math.max(0, s.inv - rdt);

      const dt = rdt * s.ts; s.t += dt;
      const diff = 0.8 + s.wave * 0.25;
      s.spawn -= dt;
      if (s.spawn <= 0) {
        const side = Math.floor(Math.random() * 3);
        const x = side === 0 ? rand(0, w) : side === 1 ? -10 : w + 10, y = side === 0 ? -10 : rand(0, h * 0.7);
        const a = Math.atan2(s.py - y, s.px - x) + rand(-0.15, 0.15), v = rand(200, 300) * diff;
        s.shots.push({ x, y, vx: Math.cos(a) * v, vy: Math.sin(a) * v, fast: false });
        s.spawn = rand(0.5, 1) / diff;
      }
      s.volley -= dt;
      if (s.volley <= 0) {
        const x = rand(w * 0.15, w * 0.85), y = -10;
        s.warns.push({ x, y, ang: Math.atan2(s.py - y, s.px - x), t: 0.55, n: 4 + s.wave, at: now });
        if (s.pendingWarnAt == null && !s.active) s.pendingWarnAt = now;
        sfx.alert();
        s.volley = rand(2.6, 3.6) / (0.8 + s.wave * 0.12);
      }
      for (const wv of s.warns) {
        wv.t -= dt;
        if (wv.t <= 0) {
          for (let i = 0; i < wv.n; i++) {
            const a = wv.ang + (i - (wv.n - 1) / 2) * 0.12, v = rand(560, 660) * (0.9 + s.wave * 0.06);
            s.shots.push({ x: wv.x, y: wv.y, vx: Math.cos(a) * v, vy: Math.sin(a) * v, fast: true });
          }
        }
      }
      s.warns = s.warns.filter((x) => x.t > 0);
      if (s.pendingWarnAt != null && now - s.pendingWarnAt > 1500) s.pendingWarnAt = null; // missed window: not a reaction
      for (const b of s.shots) {
        b.x += b.vx * dt; b.y += b.vy * dt;
        if (s.inv <= 0 && Math.hypot(b.x - s.px, b.y - s.py) < 12) { (b as Shot & { dead?: boolean }).dead = true; s.hits++; s.inv = 0.8; sfx.hit(); }
      }
      s.shots = s.shots.filter((b) => !(b as Shot & { dead?: boolean }).dead && b.x > -40 && b.x < w + 40 && b.y > -40 && b.y < h + 40);
      if (s.t > s.wave * WAVE_LEN) {
        if (s.wave >= waves) end(waves);
        else { s.wave++; sfx.ok(); }
      }
      if (s.hits >= 8) end(s.wave - 1);
      setHud({ wave: s.wave, hits: s.hits, charge: s.charge, state: s.active ? 'active' : s.cooling ? 'cooldown' : 'ready', left: Math.max(0, s.wave * WAVE_LEN - s.t) });
    }

    // draw
    ctx.fillStyle = s.active ? 'rgba(2,14,6,0.35)' : 'rgba(2,5,3,0.55)'; ctx.fillRect(0, 0, w, h);
    ctx.strokeStyle = 'rgba(27,107,54,.18)'; ctx.lineWidth = 1;
    for (let x = 0; x < w; x += 40) { ctx.beginPath(); ctx.moveTo(x, 0); ctx.lineTo(x, h); ctx.stroke(); }
    for (let y = 0; y < h; y += 40) { ctx.beginPath(); ctx.moveTo(0, y); ctx.lineTo(w, y); ctx.stroke(); }
    for (const wv of s.warns) {
      ctx.strokeStyle = `rgba(165,29,45,${0.4 + Math.sin(now / 50) * 0.3})`; ctx.setLineDash([6, 6]);
      for (let i = 0; i < wv.n; i++) { const a = wv.ang + (i - (wv.n - 1) / 2) * 0.12; ctx.beginPath(); ctx.moveTo(wv.x, wv.y); ctx.lineTo(wv.x + Math.cos(a) * 2000, wv.y + Math.sin(a) * 2000); ctx.stroke(); }
      ctx.setLineDash([]);
    }
    for (const b of s.shots) {
      const l = Math.hypot(b.vx, b.vy), k = (b.fast ? 24 : 14) / l;
      ctx.strokeStyle = b.fast ? C.white : C.pale; ctx.lineWidth = b.fast ? 3 : 4; ctx.lineCap = 'round';
      ctx.shadowColor = b.fast ? C.redBright : C.green; ctx.shadowBlur = 10;
      ctx.beginPath(); ctx.moveTo(b.x - b.vx * k, b.y - b.vy * k); ctx.lineTo(b.x, b.y); ctx.stroke();
      if (s.active) { ctx.shadowBlur = 0; ctx.strokeStyle = 'rgba(0,255,65,.18)'; ctx.beginPath(); ctx.arc(b.x, b.y, 10, 0, 7); ctx.stroke(); }
    }
    ctx.shadowBlur = 0;
    s.trail.forEach(([x, y], i) => { ctx.strokeStyle = `rgba(0,255,65,${(i / s.trail.length) * 0.35})`; diamond(ctx, x, y); });
    ctx.strokeStyle = s.inv > 0 && Math.floor(s.inv * 12) % 2 ? C.redBright : '#c8ffd6'; ctx.lineWidth = 2.5; ctx.shadowColor = C.green; ctx.shadowBlur = 16;
    diamond(ctx, s.px, s.py); ctx.shadowBlur = 0;
    if (s.ts < 0.7) { ctx.fillStyle = 'rgba(0,255,65,.8)'; ctx.font = '12px "IBM Plex Mono", monospace'; ctx.fillText(`T × ${s.ts.toFixed(2)}`, 12, h - 12); }
  });

  const pointer = (e: React.PointerEvent<HTMLCanvasElement>) => { const r = e.currentTarget.getBoundingClientRect(); ptr.current = { x: e.clientX - r.left, y: e.clientY - r.top }; };

  return (
    <div>
      <div className="mb-2 flex flex-wrap items-center gap-4 font-mono text-xs">
        <span className="text-mx-pale">WAVE {hud.wave}/{waves}</span>
        <span className="tabular-nums text-mx-grey">{hud.left.toFixed(1)}s</span>
        <span className={hud.hits ? 'text-[#ff6b77]' : 'text-mx-grey'}>HITS {hud.hits}/8</span>
        <BulletTimeIndicator charge={hud.charge} state={hud.state} />
      </div>
      <SimulationCanvas ref={cv} label="Bullet-time arena. Dodge incoming fire." onPointerMove={pointer} onPointerDown={pointer}>
        {phase === 'ready' && (
          <CanvasOverlay>
            <h3 className="font-head mb-2 text-2xl text-accent">{title}</h3>
            <p className="mb-2 font-mono text-xs text-mx-pale">Red dashed lines warn of a volley that is too fast to dodge at normal speed. Hold <b>Q</b> to slow the simulation; you keep full speed.</p>
            <p className="mb-4 font-mono text-[11px] text-mx-grey">Move: WASD / arrows / mouse / joystick · Shift boost · Q hold bullet time · 8 hits ends the run</p>
            <button className="btn btn-primary" onClick={start}>Engage</button>
          </CanvasOverlay>
        )}
        {phase === 'done' && res && (
          <CanvasOverlay>
            <h3 className="font-head mb-2 text-3xl text-accent">{res.wavesCleared === waves ? 'All waves survived' : `Survived ${res.wavesCleared} waves`}</h3>
            <p className="mb-4 font-mono text-xs text-mx-pale">Score {res.score} · hits {res.hits} · reaction to volleys {res.reactionMs ?? '—'} ms</p>
            <button className="btn btn-primary" onClick={start}>Run again</button>
          </CanvasOverlay>
        )}
      </SimulationCanvas>
      <TrainingControls input={input} actions={[{ key: 'bullet', label: 'BULLET T' }, { key: 'boost', label: 'BOOST' }]} />
    </div>
  );
}

function diamond(ctx: CanvasRenderingContext2D, x: number, y: number, r = 9) {
  ctx.beginPath(); ctx.moveTo(x, y - r * 1.4); ctx.lineTo(x + r, y); ctx.lineTo(x, y + r * 1.4); ctx.lineTo(x - r, y); ctx.closePath(); ctx.stroke();
}
