// Bullet-time dodge engine. Trace packets are aimed at the operative; holding bullet time
// slows the simulation (not you), limited by a focus meter. Used by chapters 4 and 7.
import { h, fitCanvas, rand, clamp } from '../ui.js';

export function createDodge(host, opts) {
  const {
    duration = 25, difficulty = 1, tutorial = true, title = 'SURVIVE THE TRACE',
    rain, sfx, signal, onHit = () => {}, onDone = () => {}, theme = 'grid',
  } = opts;

  const cv = h('canvas', { 'aria-label': 'Bullet time arena' });
  const ov = h('div', { class: 'overlay-msg' });
  const play = h('div', { class: 'play' }, cv, ov);
  const timeEl = h('span', { class: 'stat' }, `${duration.toFixed(1)}s`);
  const hitsEl = h('span', { class: 'stat' }, 'HITS 0');
  const focusFill = h('i');
  const btBtn = h('button', { class: 'btn small', 'aria-pressed': 'false', title: 'Hold (or press SPACE)' }, '◎ BULLET TIME');
  const bar = h('div', { class: 'row', style: { margin: '0 0 10px' } },
    h('span', { class: 'stat' }, title), h('span', { class: 'spacer' }),
    timeEl, hitsEl,
    h('div', { class: 'row', style: { gap: '8px', minWidth: '180px', flex: '0 1 240px' } }, h('span', { class: 'dim', style: { fontSize: '13px' } }, 'FOCUS'), h('div', { class: 'meter' }, focusFill)),
    btBtn);
  host.append(bar, play);

  const ctx = cv.getContext('2d');
  let W = 0, H = 0;
  const P = { x: 0, y: 0, tx: null, ty: null, r: 9, inv: 0, trail: [] };
  let bullets = [], rings = [];
  let ts = 1, focus = 100, holding = false, keyHold = false;
  let simT = 0, spawnT = 1.2, volleyT = tutorial ? 6 : 3, hits = 0;
  let running = false, done = false, frozenForLesson = false, taught = !tutorial;
  let raf = 0, last = 0;
  const keys = new Set();

  function resize() {
    const r = fitCanvas(cv, ctx); W = r.w; H = r.h;
    if (!P.x) { P.x = W / 2; P.y = H * 0.7; }
    P.x = clamp(P.x, 12, W - 12); P.y = clamp(P.y, 12, H - 12);
  }
  const ro = new ResizeObserver(resize); ro.observe(play);

  // input
  const setHold = (v) => {
    if (v && focus < 8) return;
    if (v !== holding) { holding = v; v ? sfx.slow() : sfx.fast(); btBtn.classList.toggle('on', v); btBtn.setAttribute('aria-pressed', String(v)); }
    if (v && frozenForLesson) { frozenForLesson = false; taught = true; ov.hidden = true; }
  };
  btBtn.addEventListener('pointerdown', (e) => { e.preventDefault(); setHold(true); });
  btBtn.addEventListener('pointerup', () => setHold(false));
  btBtn.addEventListener('pointerleave', () => setHold(false));
  btBtn.addEventListener('keydown', (e) => { if (e.key === 'Enter') { e.preventDefault(); setHold(!holding); } });

  const pos = (e) => { const r = cv.getBoundingClientRect(); return [e.clientX - r.left, e.clientY - r.top]; };
  cv.addEventListener('pointermove', (e) => { [P.tx, P.ty] = pos(e); });
  cv.addEventListener('pointerdown', (e) => { [P.tx, P.ty] = pos(e); cv.setPointerCapture?.(e.pointerId); });
  cv.addEventListener('contextmenu', (e) => e.preventDefault());
  const kd = (e) => {
    if (!running) return;
    if (e.code === 'Space' || e.key === 'Shift') { e.preventDefault(); keyHold = true; setHold(true); }
    if (/^(Arrow|Key[WASD])/.test(e.code)) { keys.add(e.code); e.preventDefault(); P.tx = null; }
  };
  const ku = (e) => {
    if (e.code === 'Space' || e.key === 'Shift') { keyHold = false; setHold(false); }
    keys.delete(e.code);
  };
  window.addEventListener('keydown', kd);
  window.addEventListener('keyup', ku);

  function spawn(fast = false, fromAngle = null) {
    const side = fromAngle ?? Math.floor(rand(0, 3)); // 0 top,1 left,2 right
    let x, y;
    if (side === 0) { x = rand(0, W); y = -10; } else if (side === 1) { x = -10; y = rand(0, H * 0.8); } else { x = W + 10; y = rand(0, H * 0.8); }
    const sp = (fast ? rand(520, 640) : rand(230, 360)) * (0.85 + difficulty * 0.2) * Math.max(0.75, Math.min(1.2, W / 900));
    const a = Math.atan2(P.y - y, P.x - x) + rand(-0.12, 0.12);
    bullets.push({ x, y, vx: Math.cos(a) * sp, vy: Math.sin(a) * sp, r: fast ? 4 : 5, fast });
  }
  function volley() {
    const n = Math.round(5 + difficulty * 2);
    const ox = rand(W * 0.2, W * 0.8), oy = -10;
    const base = Math.atan2(P.y - oy, P.x - ox);
    for (let i = 0; i < n; i++) {
      const a = base + (i - (n - 1) / 2) * 0.11;
      const sp = rand(560, 680) * (0.9 + difficulty * 0.15) * Math.max(0.75, Math.min(1.2, W / 900));
      bullets.push({ x: ox, y: oy, vx: Math.cos(a) * sp, vy: Math.sin(a) * sp, r: 4, fast: true });
    }
    sfx.alert();
    if (!taught) {
      frozenForLesson = true;
      ov.hidden = false;
      ov.replaceChildren(h('div', {},
        h('h2', {}, 'TIME IS A VARIABLE'),
        h('p', {}, 'That volley is too fast to dodge in real time.'),
        h('p', { class: 'stat' }, 'HOLD SPACE / SHIFT, or hold ◎ BULLET TIME'),
        h('p', { class: 'dim' }, 'The world slows. You don\'t. Focus drains while active.')));
      ov.style.background = 'rgba(0,0,0,.35)';
      ov.style.pointerEvents = 'none';
    }
  }

  function step(now) {
    raf = requestAnimationFrame(step);
    const rdt = Math.min(0.05, (now - last) / 1000); last = now;
    if (!running) { draw(); return; }

    const want = frozenForLesson ? 0.03 : (holding ? 0.18 : 1);
    ts += (want - ts) * Math.min(1, rdt * 10);
    rain?.setSpeed(ts);
    if (holding) { focus -= 34 * rdt; if (focus <= 0) { focus = 0; setHold(false); } }
    else focus = Math.min(100, focus + 13 * rdt);

    // player moves in real time (that's the advantage)
    const spd = 560;
    let mx = 0, my = 0;
    if (keys.has('ArrowLeft') || keys.has('KeyA')) mx -= 1;
    if (keys.has('ArrowRight') || keys.has('KeyD')) mx += 1;
    if (keys.has('ArrowUp') || keys.has('KeyW')) my -= 1;
    if (keys.has('ArrowDown') || keys.has('KeyS')) my += 1;
    if (mx || my) { const l = Math.hypot(mx, my); P.x += mx / l * spd * 0.8 * rdt; P.y += my / l * spd * 0.8 * rdt; }
    else if (P.tx != null) {
      const dx = P.tx - P.x, dy = P.ty - P.y, d = Math.hypot(dx, dy);
      if (d > 1) { const m = Math.min(d, spd * rdt); P.x += dx / d * m; P.y += dy / d * m; }
    }
    P.x = clamp(P.x, 10, W - 10); P.y = clamp(P.y, 10, H - 10);
    P.trail.push([P.x, P.y]); if (P.trail.length > (holding ? 14 : 5)) P.trail.shift();
    P.inv = Math.max(0, P.inv - rdt);

    const dt = rdt * ts;
    simT += dt;
    const left = Math.max(0, duration - simT);
    timeEl.textContent = `${left.toFixed(1)}s`;
    focusFill.style.width = `${focus}%`;

    if (simT > (tutorial ? 2.5 : 0.6)) {
      spawnT -= dt;
      if (spawnT <= 0) { spawn(); if (difficulty > 1.2 && Math.random() < 0.4) spawn(); spawnT = rand(0.5, 0.95) / (0.7 + difficulty * 0.3 + simT / duration * 0.6); }
      volleyT -= dt;
      if (volleyT <= 0) { volley(); volleyT = rand(3.2, 4.6) / (0.8 + difficulty * 0.2); }
    }

    for (const b of bullets) {
      b.x += b.vx * dt; b.y += b.vy * dt;
      if (holding && Math.random() < 0.25) rings.push({ x: b.x, y: b.y, r: 2, a: 0.6 });
      if (P.inv <= 0 && Math.hypot(b.x - P.x, b.y - P.y) < b.r + P.r) {
        b.dead = true; P.inv = 0.9; hits++; hitsEl.textContent = `HITS ${hits}`; sfx.hit(); onHit(hits);
        play.animate?.([{ boxShadow: 'inset 0 0 80px rgba(255,60,60,.8)' }, { boxShadow: 'inset 0 0 0 transparent' }], { duration: 400 });
      }
      if (b.x < -40 || b.x > W + 40 || b.y < -40 || b.y > H + 40) b.dead = true;
    }
    bullets = bullets.filter((b) => !b.dead);
    for (const r of rings) { r.r += 18 * rdt; r.a -= 0.9 * rdt; }
    rings = rings.filter((r) => r.a > 0);

    draw();
    if (left <= 0 && !done) finish();
  }

  function draw() {
    ctx.fillStyle = `rgba(0,0,0,${holding ? 0.25 : 0.5})`;
    ctx.fillRect(0, 0, W, H);
    // floor grid
    ctx.strokeStyle = 'rgba(79,220,114,0.08)'; ctx.lineWidth = 1;
    const g = theme === 'tunnel' ? 0 : 40;
    if (g) {
      for (let x = 0; x < W; x += g) { ctx.beginPath(); ctx.moveTo(x, 0); ctx.lineTo(x, H); ctx.stroke(); }
      for (let y = 0; y < H; y += g) { ctx.beginPath(); ctx.moveTo(0, y); ctx.lineTo(W, y); ctx.stroke(); }
    } else {
      const cx = W / 2, cy = H * 0.42;
      for (let i = 1; i < 9; i++) {
        const k = ((i + simT * 2) % 9) / 9; const rw = W * k * k * 1.2, rh = H * k * k * 1.2;
        ctx.strokeStyle = `rgba(79,220,114,${0.04 + k * 0.12})`;
        ctx.strokeRect(cx - rw / 2, cy - rh / 2, rw, rh);
      }
    }
    for (const r of rings) {
      ctx.strokeStyle = `rgba(125,255,155,${r.a * 0.5})`; ctx.beginPath(); ctx.arc(r.x, r.y, r.r, 0, 7); ctx.stroke();
    }
    for (const b of bullets) {
      const l = Math.hypot(b.vx, b.vy), k = (b.fast ? 26 : 16) / l;
      ctx.strokeStyle = b.fast ? '#ffffff' : '#9dffb4';
      ctx.shadowColor = b.fast ? '#ff6b6b' : '#7dff9b'; ctx.shadowBlur = 10;
      ctx.lineWidth = b.r * 0.9; ctx.lineCap = 'round';
      ctx.beginPath(); ctx.moveTo(b.x - b.vx * k, b.y - b.vy * k); ctx.lineTo(b.x, b.y); ctx.stroke();
    }
    ctx.shadowBlur = 0;
    // player afterimages + body
    P.trail.forEach(([x, y], i) => {
      ctx.strokeStyle = `rgba(125,255,155,${(i / P.trail.length) * 0.35})`;
      diamond(x, y, P.r);
    });
    const blink = P.inv > 0 && Math.floor(P.inv * 12) % 2;
    ctx.shadowColor = '#7dff9b'; ctx.shadowBlur = 18;
    ctx.strokeStyle = blink ? '#ff4545' : '#c8ffd5'; ctx.lineWidth = 2.5;
    diamond(P.x, P.y, P.r);
    ctx.shadowBlur = 0;
    if (ts < 0.6) {
      ctx.fillStyle = `rgba(0,30,10,${(1 - ts) * 0.12})`; ctx.fillRect(0, 0, W, H);
      ctx.fillStyle = 'rgba(125,255,155,.8)'; ctx.font = '18px VT323, monospace';
      ctx.fillText(`T × ${ts.toFixed(2)}`, 14, H - 14);
    }
  }
  function diamond(x, y, r) {
    ctx.beginPath(); ctx.moveTo(x, y - r * 1.4); ctx.lineTo(x + r, y); ctx.lineTo(x, y + r * 1.4); ctx.lineTo(x - r, y); ctx.closePath(); ctx.stroke();
  }

  function finish() {
    done = true; running = false; setHold(false); rain?.setSpeed(1);
    onDone({ hits });
  }

  function showStart() {
    ov.hidden = false;
    const go = h('button', { class: 'btn', onclick: () => { ov.hidden = true; ov.style.background = ''; ov.style.pointerEvents = ''; running = true; sfx.ok(); cv.focus?.(); } }, '> ENGAGE');
    ov.replaceChildren(h('div', {},
      h('h2', {}, title),
      h('p', {}, `Survive ${duration} seconds of simulation time.`),
      h('p', { class: 'dim' }, 'Move: mouse / drag / arrows / WASD. Bullet time: hold SPACE, SHIFT or the ◎ button.'),
      go));
    setTimeout(() => go.focus(), 30);
  }

  resize();
  last = performance.now();
  raf = requestAnimationFrame(step);
  showStart();

  const destroy = () => {
    cancelAnimationFrame(raf); ro.disconnect();
    window.removeEventListener('keydown', kd); window.removeEventListener('keyup', ku);
    rain?.setSpeed(1);
  };
  signal?.addEventListener('abort', destroy);
  return { destroy, el: play };
}
