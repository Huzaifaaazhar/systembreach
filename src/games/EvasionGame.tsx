import { useRef, useState } from 'react';
import SimulationCanvas, { CanvasOverlay } from '../components/SimulationCanvas';
import TrainingControls from '../components/TrainingControls';
import BulletTimeIndicator from '../components/BulletTimeIndicator';
import { useGameLoop } from '../hooks/useGameLoop';
import { useInput } from '../hooks/useInput';
import { fitCanvas, C } from '../lib/canvas';
import { sfx } from '../lib/audio';
import { rainControl } from '../components/DigitalRainBackground';
import { expose } from '../lib/debug';

export interface EvasionMap {
  name: string;
  w: number; h: number; // logical units
  walls: [number, number, number, number][]; // x, y, w, h
  start: [number, number];
  exit: [number, number, number, number];
  agents: { path: [number, number][]; speed: number }[];
  time: number;
}
export interface EvasionResult { success: boolean; time: number; caught: number; score: number }

// Maps are hand-built on a 1000×600 grid.
const B = (x: number, y: number, w: number, h: number): [number, number, number, number] => [x, y, w, h];
export const MAPS: Record<string, EvasionMap> = {
  streets: {
    name: 'Halvorsen blocks', w: 1000, h: 600, time: 90, start: [50, 540], exit: [900, 30, 80, 80],
    walls: [B(120, 80, 180, 160), B(120, 330, 180, 170), B(400, 0, 160, 230), B(400, 330, 160, 270), B(660, 100, 160, 180), B(660, 380, 160, 160)],
    agents: [
      { path: [[350, 40], [350, 560]], speed: 70 },
      { path: [[610, 560], [610, 40]], speed: 80 },
      { path: [[90, 280], [600, 280], [600, 300], [90, 300]], speed: 90 },
    ],
  },
  subway: {
    name: 'Decommissioned subway', w: 1000, h: 600, time: 80, start: [40, 300], exit: [920, 260, 60, 80],
    walls: [B(0, 0, 1000, 120), B(0, 480, 1000, 120), B(200, 200, 60, 200), B(450, 120, 60, 170), B(450, 360, 60, 120), B(700, 200, 60, 200)],
    agents: [
      { path: [[330, 140], [330, 460]], speed: 85 },
      { path: [[600, 460], [600, 140]], speed: 90 },
      { path: [[850, 150], [850, 450]], speed: 95 },
    ],
  },
  rooftops: {
    name: 'North rooftops', w: 1000, h: 600, time: 80, start: [40, 540], exit: [910, 20, 70, 70],
    walls: [B(150, 150, 120, 300), B(380, 50, 100, 220), B(380, 360, 100, 240), B(600, 150, 120, 300), B(820, 120, 60, 360)],
    agents: [
      { path: [[310, 40], [310, 560]], speed: 110 },
      { path: [[540, 560], [540, 40]], speed: 110 },
      { path: [[760, 40], [760, 560]], speed: 115 },
      { path: [[60, 100], [960, 100]], speed: 120 },
    ],
  },
  exit: {
    name: 'Exit approach', w: 1000, h: 600, time: 70, start: [40, 560], exit: [880, 250, 90, 100],
    walls: [B(140, 0, 60, 420), B(320, 180, 60, 420), B(500, 0, 60, 420), B(680, 180, 60, 420)],
    agents: [
      { path: [[260, 40], [260, 560]], speed: 120 },
      { path: [[440, 560], [440, 40]], speed: 125 },
      { path: [[620, 40], [620, 560]], speed: 130 },
      { path: [[800, 560], [800, 40]], speed: 135 },
    ],
  },
};

const VIEW = 140, FOV = Math.PI / 3, PR = 10;

function segBlocked(walls: EvasionMap['walls'], x1: number, y1: number, x2: number, y2: number) {
  const steps = Math.ceil(Math.hypot(x2 - x1, y2 - y1) / 8);
  for (let i = 1; i < steps; i++) {
    const x = x1 + ((x2 - x1) * i) / steps, y = y1 + ((y2 - y1) * i) / steps;
    if (walls.some(([wx, wy, ww, wh]) => x > wx && x < wx + ww && y > wy && y < wy + wh)) return true;
  }
  return false;
}

/** Top-down stealth: stay out of Agent sight cones, slip past in bullet time, reach the exit. */
export default function EvasionGame({ map, onEnd, btBonus = 1, title }: { map: EvasionMap; onEnd: (r: EvasionResult) => void; btBonus?: number; title?: string }) {
  const cv = useRef<HTMLCanvasElement>(null);
  const input = useInput();
  const [phase, setPhase] = useState<'ready' | 'play' | 'done'>('ready');
  const [hud, setHud] = useState({ time: map.time, caught: 0, detect: 0, charge: 1, state: 'ready' as 'ready' | 'active' | 'cooldown' });
  const [res, setRes] = useState<EvasionResult | null>(null);
  const S = useRef({ x: map.start[0], y: map.start[1], t: 0, caught: 0, detect: 0, charge: 1, cooling: false, active: false, ts: 1, agents: map.agents.map((a) => ({ x: a.path[0][0], y: a.path[0][1], seg: 0, dir: 0, ...a })), over: false, flash: 0 });
  const ptr = useRef<{ x: number; y: number } | null>(null);
  expose('evasion', S.current);
  const view = useRef({ sc: 1, ox: 0, oy: 0 });

  const start = () => {
    Object.assign(S.current, { x: map.start[0], y: map.start[1], t: 0, caught: 0, detect: 0, charge: 1, cooling: false, active: false, ts: 1, over: false, agents: map.agents.map((a) => ({ x: a.path[0][0], y: a.path[0][1], seg: 0, dir: 0, ...a })) });
    setPhase('play'); sfx.ok(); cv.current?.focus();
  };
  const end = (success: boolean) => {
    const s = S.current; s.over = true; rainControl.speed = 1;
    const score = success ? Math.round(Math.max(30, 100 - s.caught * 20 - Math.max(0, s.t - map.time * 0.5) * 0.8)) : 0;
    const r = { success, time: s.t, caught: s.caught, score };
    setRes(r); setPhase('done'); success ? sfx.win() : sfx.err(); onEnd(r);
  };

  useGameLoop((rdt) => {
    const c = cv.current; if (!c) return;
    const ctx = c.getContext('2d')!;
    const { w, h } = fitCanvas(c, ctx);
    const sc = Math.min(w / map.w, h / map.h); const ox = (w - map.w * sc) / 2, oy = (h - map.h * sc) / 2;
    view.current = { sc, ox, oy };
    const s = S.current;
    const blocked = (x: number, y: number) => x < PR || y < PR || x > map.w - PR || y > map.h - PR || map.walls.some(([wx, wy, ww, wh]) => x > wx - PR && x < wx + ww + PR && y > wy - PR && y < wy + wh + PR);

    if (phase === 'play' && !s.over) {
      const want = input.bullet && !s.cooling && s.charge > 0;
      if (want && !s.active) { s.active = true; sfx.slow(); }
      if (!want && s.active) { s.active = false; sfx.fast(); }
      if (s.active) { s.charge -= rdt / (2.5 * btBonus); if (s.charge <= 0) { s.charge = 0; s.active = false; s.cooling = true; sfx.fast(); } }
      else { s.charge = Math.min(1, s.charge + rdt / (s.cooling ? 5 : 7)); if (s.cooling && s.charge >= 1) s.cooling = false; }
      s.ts += ((s.active ? 0.25 : 1) - s.ts) * Math.min(1, rdt * 10);
      rainControl.speed = s.ts;
      s.t += rdt;
      const sp = input.boost ? 210 : 140;
      let mx = input.x, my = input.y;
      if (!mx && !my && ptr.current) { const dx = ptr.current.x - s.x, dy = ptr.current.y - s.y, d = Math.hypot(dx, dy); if (d > 4) { mx = dx / d; my = dy / d; } }
      const m = Math.hypot(mx, my); if (m > 1) { mx /= m; my /= m; }
      const nx = s.x + mx * sp * rdt, ny = s.y + my * sp * rdt;
      if (!blocked(nx, s.y)) s.x = nx; if (!blocked(s.x, ny)) s.y = ny;

      let seen = false;
      for (const a of s.agents) {
        const target = a.path[(a.seg + 1) % a.path.length];
        const dx = target[0] - a.x, dy = target[1] - a.y, d = Math.hypot(dx, dy);
        const step = a.speed * rdt * s.ts;
        if (d <= step) { a.x = target[0]; a.y = target[1]; a.seg = (a.seg + 1) % a.path.length; }
        else { a.x += (dx / d) * step; a.y += (dy / d) * step; a.dir = Math.atan2(dy, dx); }
        const px = s.x - a.x, py = s.y - a.y, pd = Math.hypot(px, py);
        let da = Math.atan2(py, px) - a.dir; da = Math.atan2(Math.sin(da), Math.cos(da));
        if (pd < 26 || (pd < VIEW && Math.abs(da) < FOV / 2 && !segBlocked(map.walls, a.x, a.y, s.x, s.y))) seen = true;
      }
      s.detect = Math.max(0, Math.min(1, s.detect + (seen ? rdt * 1.6 : -rdt * 0.8)));
      if (s.detect >= 1) {
        s.caught++; s.detect = 0; s.x = map.start[0]; s.y = map.start[1]; s.flash = 0.6; sfx.hit();
        if (s.caught >= 3) end(false);
      }
      const [ex, ey, ew, eh] = map.exit;
      if (s.x > ex && s.x < ex + ew && s.y > ey && s.y < ey + eh) end(true);
      if (s.t >= map.time) end(false);
      setHud({ time: Math.max(0, map.time - s.t), caught: s.caught, detect: s.detect, charge: s.charge, state: s.active ? 'active' : s.cooling ? 'cooldown' : 'ready' });
    }

    // draw
    ctx.fillStyle = C.black; ctx.fillRect(0, 0, w, h);
    ctx.save(); ctx.translate(ox, oy); ctx.scale(sc, sc);
    ctx.fillStyle = C.deep; ctx.fillRect(0, 0, map.w, map.h);
    ctx.strokeStyle = 'rgba(27,107,54,.15)';
    for (let x = 0; x < map.w; x += 50) { ctx.beginPath(); ctx.moveTo(x, 0); ctx.lineTo(x, map.h); ctx.stroke(); }
    for (let y = 0; y < map.h; y += 50) { ctx.beginPath(); ctx.moveTo(0, y); ctx.lineTo(map.w, y); ctx.stroke(); }
    for (const [x, y, ww, hh] of map.walls) { ctx.fillStyle = C.dark; ctx.fillRect(x, y, ww, hh); ctx.strokeStyle = C.muted; ctx.strokeRect(x, y, ww, hh); }
    const [ex, ey, ew, eh] = map.exit;
    ctx.strokeStyle = C.green; ctx.lineWidth = 2; ctx.setLineDash([8, 6]); ctx.strokeRect(ex, ey, ew, eh); ctx.setLineDash([]); ctx.lineWidth = 1;
    ctx.fillStyle = C.green; ctx.font = '14px "IBM Plex Mono", monospace'; ctx.fillText('EXIT', ex + 6, ey + 18);
    for (const a of s.agents) {
      ctx.fillStyle = 'rgba(165,29,45,.18)'; ctx.beginPath(); ctx.moveTo(a.x, a.y); ctx.arc(a.x, a.y, VIEW, a.dir - FOV / 2, a.dir + FOV / 2); ctx.closePath(); ctx.fill();
      ctx.fillStyle = C.redBright; ctx.beginPath(); ctx.arc(a.x, a.y, 9, 0, 7); ctx.fill();
      ctx.fillStyle = C.black; ctx.fillRect(a.x - 6, a.y - 2, 12, 3); // sunglasses
    }
    ctx.strokeStyle = s.detect > 0.05 ? C.amber : C.white; ctx.lineWidth = 2.5; ctx.shadowColor = C.green; ctx.shadowBlur = 12;
    ctx.beginPath(); ctx.arc(s.x, s.y, PR, 0, 7); ctx.stroke(); ctx.shadowBlur = 0; ctx.lineWidth = 1;
    if (s.detect > 0) { ctx.fillStyle = C.amber; ctx.fillRect(s.x - 14, s.y - 20, 28 * s.detect, 3); }
    ctx.restore();
    if (s.flash > 0) { s.flash -= rdt; ctx.fillStyle = `rgba(165,29,45,${s.flash * 0.5})`; ctx.fillRect(0, 0, w, h); }
    if (s.ts < 0.7) { ctx.fillStyle = 'rgba(0,255,65,.8)'; ctx.font = '12px "IBM Plex Mono", monospace'; ctx.fillText(`T × ${s.ts.toFixed(2)}`, 12, h - 12); }
  });

  const pointer = (e: React.PointerEvent<HTMLCanvasElement>) => {
    const r = e.currentTarget.getBoundingClientRect(); const v = view.current;
    ptr.current = { x: (e.clientX - r.left - v.ox) / v.sc, y: (e.clientY - r.top - v.oy) / v.sc };
  };

  return (
    <div>
      <div className="mb-2 flex flex-wrap items-center gap-4 font-mono text-xs">
        <span className="text-mx-pale">{map.name.toUpperCase()}</span>
        <span className="tabular-nums text-mx-grey">{hud.time.toFixed(1)}s</span>
        <span className={hud.caught ? 'text-[#ff6b77]' : 'text-mx-grey'}>CAUGHT {hud.caught}/3</span>
        <div className="w-28"><div className="text-[10px] tracking-[0.15em] text-mx-grey">DETECTION</div><div className={`meter ${hud.detect > 0.5 ? 'red' : 'amber'}`}><i style={{ width: `${hud.detect * 100}%`, transition: 'none' }} /></div></div>
        <BulletTimeIndicator charge={hud.charge} state={hud.state} />
      </div>
      <SimulationCanvas ref={cv} label={`Evasion map ${map.name}. Reach the exit without being seen.`} onPointerDown={pointer} onPointerMove={(e) => { if (e.buttons || e.pointerType === 'mouse') pointer(e); }}>
        {phase === 'ready' && (
          <CanvasOverlay>
            <h3 className="font-head mb-2 text-2xl text-accent">{title ?? 'Evade the Agents'}</h3>
            <p className="mb-2 font-mono text-xs text-mx-pale">Red cones are Agent sight lines. Walls block sight. Being seen fills the detection meter; when it is full you are caught. Three catches fails the run.</p>
            <p className="mb-4 font-mono text-[11px] text-mx-grey">Move: WASD / arrows / mouse / joystick · Shift boost · hold Q bullet time</p>
            <button className="btn btn-primary" onClick={start}>Go</button>
          </CanvasOverlay>
        )}
        {phase === 'done' && res && (
          <CanvasOverlay>
            <h3 className={`font-head mb-2 text-3xl ${res.success ? 'text-accent' : 'text-[#ff6b77]'}`}>{res.success ? 'Extraction reached' : 'Evasion failed'}</h3>
            <p className="mb-4 font-mono text-xs text-mx-pale">{res.time.toFixed(1)}s · caught {res.caught} · score {res.score}</p>
            {!res.success && <button className="btn btn-primary" onClick={start}>Retry</button>}
          </CanvasOverlay>
        )}
      </SimulationCanvas>
      <TrainingControls input={input} actions={[{ key: 'bullet', label: 'BULLET T' }, { key: 'boost', label: 'BOOST' }]} />
    </div>
  );
}
