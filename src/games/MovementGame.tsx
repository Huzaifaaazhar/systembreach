import { useRef, useState } from 'react';
import SimulationCanvas, { CanvasOverlay } from '../components/SimulationCanvas';
import TrainingControls from '../components/TrainingControls';
import { useGameLoop } from '../hooks/useGameLoop';
import { useInput } from '../hooks/useInput';
import { consume } from '../lib/input';
import { fitCanvas, seeded, C } from '../lib/canvas';
import { sfx } from '../lib/audio';
import { expose } from '../lib/debug';

export interface MovementResult { level: number; score: number; deaths: number; time: number }
const T = 32, ROWS = 14, MAX_LEVEL = 5;

type Tile = '#' | '=' | '^' | 'G' | 'S' | 'C' | 'X';
interface Level { tiles: Map<string, Tile>; cols: number; drones: { x: number; y0: number; amp: number; sp: number }[]; start: [number, number]; par: number }

/** Deterministic level generator: difficulty grows with the level number. */
export function generateLevel(n: number): Level {
  const r = seeded(1000 + n * 77);
  const tiles = new Map<string, Tile>();
  const drones: Level['drones'] = [];
  let x = 0, gy = 11;
  const ground = (cx: number, top: number) => { for (let y = top; y < ROWS; y++) tiles.set(`${cx},${y}`, '#'); };
  for (; x < 6; x++) ground(x, gy);
  const length = 50 + n * 14;
  let lastCheck = 0;
  while (x < length) {
    const roll = r();
    if (x - lastCheck > 22) { ground(x, gy); tiles.set(`${x},${gy - 1}`, 'C'); lastCheck = x; x++; continue; }
    if (roll < 0.22) { const k = 3 + Math.floor(r() * 4); for (let i = 0; i < k; i++) ground(x++, gy); }
    else if (roll < 0.42) { const k = 2 + Math.floor(r() * Math.min(4, 1 + n * 0.6)); x += k; ground(x++, gy); ground(x++, gy); ground(x++, gy); }
    else if (roll < 0.56) { ground(x++, gy); ground(x++, gy); const k = 1 + Math.floor(r() * Math.min(3, n)); for (let i = 0; i < k; i++) { ground(x, gy); tiles.set(`${x},${gy - 1}`, '^'); x++; } ground(x++, gy); ground(x++, gy); ground(x++, gy); }
    else if (roll < 0.68) { const ny = Math.max(7, Math.min(12, gy + (r() < 0.6 ? -1 - Math.floor(r() * 2) : 1 + Math.floor(r() * 2)))); gy = ny; for (let i = 0; i < 3; i++) ground(x++, gy); }
    else if (roll < 0.8) { // floating platforms over a pit
      const k = 5 + Math.floor(r() * 3); const py = gy - 2 - Math.floor(r() * 2);
      for (let i = 0; i < k; i++) { if (i % 3 !== 2) tiles.set(`${x + i},${py}`, '='); if (n >= 3 && i === Math.floor(k / 2)) tiles.set(`${x + i},${ROWS - 1}`, '^'); }
      x += k; ground(x++, gy); ground(x++, gy);
    } else if (roll < 0.9 && n >= 2) { for (let i = 0; i < 5; i++) ground(x + i, gy); drones.push({ x: (x + 2.5) * T, y0: (gy - 3) * T, amp: T * 1.6, sp: 1.6 + n * 0.35 }); x += 5; }
    else { // switch + gate: interact with E
      ground(x, gy); tiles.set(`${x},${gy - 1}`, 'S'); x++;
      ground(x++, gy); ground(x, gy); for (let y = gy - 4; y < gy; y++) tiles.set(`${x},${y}`, 'G'); x++; ground(x++, gy);
    }
  }
  for (let i = 0; i < 5; i++) ground(x + i, gy);
  tiles.set(`${x + 3},${gy - 1}`, 'X');
  return { tiles, cols: x + 6, drones, start: [2 * T, (11 - 1) * T], par: 18 + n * 8 };
}

export default function MovementGame({ onFinish }: { onFinish: (r: MovementResult) => void }) {
  const cv = useRef<HTMLCanvasElement>(null);
  const input = useInput();
  const [level, setLevel] = useState(1);
  const [phase, setPhase] = useState<'ready' | 'play' | 'cleared' | 'complete'>('ready');
  const [hud, setHud] = useState({ deaths: 0, time: 0, boost: 1, hint: '' });
  const [last, setLast] = useState<MovementResult | null>(null);
  const G = useRef({ lv: generateLevel(1), x: 0, y: 0, vx: 0, vy: 0, ground: false, coyote: 0, buffer: 0, boost: 1, deaths: 0, time: 0, check: [0, 0] as [number, number], open: new Set<string>(), t: 0, dead: 0, done: false });

  const begin = (n: number) => {
    const lv = generateLevel(n);
    Object.assign(G.current, { lv, x: lv.start[0], y: lv.start[1], vx: 0, vy: 0, ground: false, coyote: 0, buffer: 0, boost: 1, deaths: 0, time: 0, check: [...lv.start], open: new Set(), t: 0, dead: 0, done: false });
    expose('movement', G.current);
    setLevel(n); setPhase('play'); sfx.ok(); cv.current?.focus();
  };

  useGameLoop((dt) => {
    const c = cv.current; if (!c) return;
    const ctx = c.getContext('2d')!;
    const { w, h } = fitCanvas(c, ctx);
    const g = G.current; const lv = g.lv;
    const sc = h / (ROWS * T); const VW = w / sc;
    const solid = (tx: number, ty: number) => { const t = lv.tiles.get(`${tx},${ty}`); return t === '#' || t === '=' || (t === 'G' && !g.open.has(`${tx}`)); };
    const PW = 18, PH = 28;
    let hint = '';

    if (phase === 'play' && !g.done) {
      g.t += dt; g.time += dt;
      if (g.dead > 0) { g.dead -= dt; if (g.dead <= 0) { g.x = g.check[0]; g.y = g.check[1]; g.vx = 0; g.vy = 0; } }
      else {
        const boosting = input.boost && g.boost > 0 && input.x !== 0;
        g.boost = boosting ? Math.max(0, g.boost - dt * 0.6) : Math.min(1, g.boost + dt * (g.ground ? 0.5 : 0.15));
        const max = boosting ? 330 : 210;
        g.vx += (input.x * max - g.vx) * Math.min(1, dt * (g.ground ? 14 : 6));
        if (consume(input, 'Space', 'KeyW', 'ArrowUp')) g.buffer = 0.13;
        g.buffer -= dt; g.coyote -= dt;
        if (g.buffer > 0 && (g.ground || g.coyote > 0)) { g.vy = boosting ? -640 : -600; g.buffer = 0; g.coyote = 0; g.ground = false; sfx.swing(); }
        if (!input.jump && g.vy < -200) g.vy = -200; // variable jump height
        g.vy = Math.min(900, g.vy + 1700 * dt);
        // horizontal move + collide
        g.x += g.vx * dt;
        for (const ty of [Math.floor(g.y / T), Math.floor((g.y + PH - 1) / T)]) {
          if (g.vx > 0 && solid(Math.floor((g.x + PW) / T), ty)) { g.x = Math.floor((g.x + PW) / T) * T - PW - 0.01; g.vx = 0; }
          if (g.vx < 0 && solid(Math.floor(g.x / T), ty)) { g.x = (Math.floor(g.x / T) + 1) * T + 0.01; g.vx = 0; }
        }
        g.x = Math.max(0, g.x);
        // vertical
        g.y += g.vy * dt;
        const wasGround = g.ground; g.ground = false;
        for (const tx of [Math.floor(g.x / T), Math.floor((g.x + PW) / T)]) {
          if (g.vy > 0 && solid(tx, Math.floor((g.y + PH) / T))) { g.y = Math.floor((g.y + PH) / T) * T - PH; g.vy = 0; g.ground = true; }
          if (g.vy < 0 && solid(tx, Math.floor(g.y / T))) { g.y = (Math.floor(g.y / T) + 1) * T; g.vy = 0; }
        }
        if (wasGround && !g.ground) g.coyote = 0.1;
        // tiles touched
        const cx = Math.floor((g.x + PW / 2) / T), cy = Math.floor((g.y + PH / 2) / T);
        const near = [lv.tiles.get(`${cx},${cy}`), lv.tiles.get(`${cx},${Math.floor((g.y + PH - 2) / T)}`)];
        const die = () => { g.dead = 0.6; g.deaths++; sfx.hit(); };
        if (near.includes('^') || g.y > ROWS * T) die();
        for (const d of lv.drones) { const dy = d.y0 + Math.sin(g.t * d.sp) * d.amp; if (Math.abs(d.x - (g.x + PW / 2)) < 20 && Math.abs(dy - (g.y + PH / 2)) < 24) die(); }
        if (near.includes('C')) { const k: [number, number] = [cx * T, (cy) * T - 4]; if (g.check[0] !== k[0]) { g.check = k; sfx.tick(); } }
        // switches: press E nearby to open the next gate
        for (let dx = -1; dx <= 1; dx++) {
          if (lv.tiles.get(`${cx + dx},${cy}`) === 'S' || lv.tiles.get(`${cx + dx},${cy + 1}`) === 'S') {
            const gateX = cx + dx + 2;
            if (!g.open.has(`${gateX}`)) { hint = 'Press E to open the gate'; if (consume(input, 'KeyE') || input.interact) { g.open.add(`${gateX}`); sfx.ok(); input.interact = false; } }
          }
        }
        if (near.includes('X')) {
          g.done = true;
          const score = Math.round(Math.max(20, 100 - g.deaths * 10 - Math.max(0, g.time - lv.par) * 1.2));
          const r = { level, score, deaths: g.deaths, time: Math.round(g.time) };
          setLast(r); onFinish(r); sfx.win();
          setPhase(level >= MAX_LEVEL ? 'complete' : 'cleared');
        }
      }
      setHud({ deaths: g.deaths, time: g.time, boost: g.boost, hint });
    }

    // draw
    const camX = Math.max(0, Math.min(lv.cols * T - VW, g.x - VW * 0.35));
    ctx.fillStyle = C.black; ctx.fillRect(0, 0, w, h);
    ctx.save(); ctx.scale(sc, sc); ctx.translate(-camX, 0);
    // parallax code columns
    ctx.fillStyle = 'rgba(27,107,54,.15)'; ctx.font = '12px "IBM Plex Mono", monospace';
    for (let i = Math.floor(camX * 0.5 / 40); i < (camX * 0.5 + VW) / 40 + 1; i++) ctx.fillText(((i * 7919) % 97).toString(16), i * 40 + camX * 0.5, 40 + ((i * 53) % 200));
    const x0 = Math.floor(camX / T) - 1, x1 = Math.ceil((camX + VW) / T) + 1;
    for (let tx = x0; tx <= x1; tx++) for (let ty = 0; ty < ROWS; ty++) {
      const t = lv.tiles.get(`${tx},${ty}`); if (!t) continue;
      const px = tx * T, py = ty * T;
      if (t === '#') { ctx.fillStyle = C.dark; ctx.fillRect(px, py, T, T); ctx.strokeStyle = 'rgba(0,200,83,.35)'; ctx.strokeRect(px + 0.5, py + 0.5, T - 1, T - 1); }
      if (t === '=') { ctx.fillStyle = C.muted; ctx.fillRect(px, py, T, 8); }
      if (t === '^') { ctx.fillStyle = C.red; ctx.beginPath(); for (let k = 0; k < 3; k++) { ctx.moveTo(px + k * 11, py + T); ctx.lineTo(px + k * 11 + 5, py + 12); ctx.lineTo(px + k * 11 + 10, py + T); } ctx.fill(); }
      if (t === 'G' && !g.open.has(`${tx}`)) { ctx.fillStyle = 'rgba(214,164,59,.25)'; ctx.fillRect(px + 8, py, 16, T); ctx.strokeStyle = C.amber; ctx.strokeRect(px + 8, py, 16, T); }
      if (t === 'S') { ctx.fillStyle = g.open.has(`${tx + 2}`) ? C.green : C.amber; ctx.fillRect(px + 10, py + 14, 12, 18); }
      if (t === 'C') { ctx.strokeStyle = g.check[0] === tx * T ? C.green : C.grey; ctx.beginPath(); ctx.moveTo(px + 16, py + T); ctx.lineTo(px + 16, py); ctx.lineTo(px + 28, py + 6); ctx.lineTo(px + 16, py + 12); ctx.stroke(); }
      if (t === 'X') { ctx.strokeStyle = C.white; ctx.lineWidth = 2; ctx.shadowColor = C.green; ctx.shadowBlur = 14; ctx.strokeRect(px, py - T, T, T * 2); ctx.shadowBlur = 0; ctx.lineWidth = 1; }
    }
    for (const d of lv.drones) {
      const dy = d.y0 + Math.sin(g.t * d.sp) * d.amp;
      ctx.strokeStyle = C.redBright; ctx.lineWidth = 2; ctx.beginPath(); ctx.arc(d.x, dy, 11, 0, 7); ctx.stroke();
      ctx.fillStyle = C.redBright; ctx.fillRect(d.x - 3, dy - 3, 6, 6); ctx.lineWidth = 1;
    }
    if (g.dead <= 0) {
      ctx.fillStyle = C.phosphor; ctx.shadowColor = C.green; ctx.shadowBlur = input.boost ? 18 : 8;
      ctx.fillRect(g.x, g.y, PW, PH); ctx.shadowBlur = 0;
      ctx.fillStyle = C.black; ctx.fillRect(g.x + (g.vx >= 0 ? 11 : 3), g.y + 6, 4, 4);
    } else { ctx.strokeStyle = C.redBright; ctx.strokeRect(g.check[0], g.check[1], PW, PH); }
    ctx.restore();
  });

  return (
    <div>
      <div className="mb-2 flex flex-wrap items-center gap-4 font-mono text-xs">
        <span className="text-mx-pale">LEVEL {level}/{MAX_LEVEL}</span>
        <span className="tabular-nums text-mx-grey">{hud.time.toFixed(1)}s</span>
        <span className={hud.deaths ? 'text-[#ff6b77]' : 'text-mx-grey'}>RESETS {hud.deaths}</span>
        <div className="w-32"><div className="text-[10px] tracking-[0.15em] text-mx-grey">BOOST</div><div className="meter"><i style={{ width: `${hud.boost * 100}%`, transition: 'none' }} /></div></div>
        {hud.hint && <span className="chip text-mx-amber">{hud.hint}</span>}
      </div>
      <SimulationCanvas ref={cv} label="Movement course. Run and jump to the exit gate.">
        {phase === 'ready' && (
          <CanvasOverlay>
            <h3 className="font-head mb-2 text-2xl text-accent">Movement Course</h3>
            <p className="mb-2 font-mono text-xs text-mx-pale">Reach the bright exit frame. Avoid red spikes and drones. Amber gates open from the switch in front of them.</p>
            <p className="mb-4 font-mono text-[11px] text-mx-grey">A/D move · Space jump (hold for height) · Shift boost · E interact · flags are checkpoints</p>
            <button className="btn btn-primary" onClick={() => begin(1)}>Start level 1</button>
          </CanvasOverlay>
        )}
        {(phase === 'cleared' || phase === 'complete') && last && (
          <CanvasOverlay>
            <h3 className="font-head mb-2 text-3xl text-accent">{phase === 'complete' ? 'Course complete' : `Level ${last.level} cleared`}</h3>
            <p className="mb-4 font-mono text-xs text-mx-pale">Score {last.score} · {last.time}s · resets {last.deaths}</p>
            <div className="flex flex-wrap justify-center gap-2">
              {phase === 'cleared' && <button className="btn btn-primary" onClick={() => begin(level + 1)}>Level {level + 1} ▸</button>}
              <button className="btn" onClick={() => begin(level)}>Replay level {level}</button>
              {phase === 'complete' && <button className="btn" onClick={() => begin(1)}>From level 1</button>}
            </div>
          </CanvasOverlay>
        )}
      </SimulationCanvas>
      <TrainingControls input={input} axes="x" actions={[{ key: 'jump', label: 'JUMP' }, { key: 'boost', label: 'BOOST' }, { key: 'interact', label: 'E USE' }]} />
    </div>
  );
}
