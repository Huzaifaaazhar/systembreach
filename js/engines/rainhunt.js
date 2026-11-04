// Signal hunt: a local rain field where a few glyphs are anomalies. Real anomalies carry the
// next letter of a hidden key (steady white, bracketed). Corrupted ones flicker red-white and
// raise threat when touched. Used by chapter 2 and the final escape.
import { h, fitCanvas, rand, pick } from '../ui.js';

const NOISE = 'ABCDEFHKLMNRSTUVXZ0123456789#$%&*+=<>/|:;';
const CORRUPT = '#%&@?!';

export function createRainHunt(host, { word, sfx, signal, onLetter = () => {}, onDecoy = () => {}, onMissClick = () => {}, onDone = () => {}, speed = 1 }) {
  const cv = h('canvas', { 'aria-label': 'Rain field. Click the bright bracketed glyphs.' });
  const grid = h('div', { class: 'signal-grid' }, cv);
  const slots = word.split('').map(() => h('div', { class: 'slot' }, '_'));
  const slotRow = h('div', { class: 'slots', 'aria-live': 'polite' }, slots);
  host.append(slotRow, grid);

  const ctx = cv.getContext('2d');
  const bg = document.createElement('canvas'); // rain layer, redrawn per cell
  const bctx = bg.getContext('2d');
  let W = 0, H = 0, cols = [], size = 20;
  let anoms = [], idx = 0, spawnT = 0.6, raf = 0, last = performance.now(), done = false;
  let flash = [];

  function resize() {
    const r = fitCanvas(cv, ctx); W = r.w; H = r.h;
    bg.width = cv.width; bg.height = cv.height; bctx.setTransform(r.dpr, 0, 0, r.dpr, 0, 0);
    size = W < 520 ? 16 : 20;
    const n = Math.floor(W / size);
    cols = Array.from({ length: n }, (_, i) => cols[i] || { y: rand(-H, 0), v: rand(70, 190), chars: [] });
  }
  const ro = new ResizeObserver(resize); ro.observe(grid);

  function spawnAnom() {
    const realOnScreen = anoms.some((a) => a.real);
    const real = !realOnScreen && Math.random() < 0.7;
    const col = Math.floor(rand(1, Math.max(2, W / size - 1)));
    anoms.push({ x: col * size + size / 2, y: -20, v: rand(55, 85) * speed, real, ch: real ? word[idx] : pick(CORRUPT), t: 0 });
  }

  cv.addEventListener('pointerdown', (e) => {
    if (done) return;
    const r = cv.getBoundingClientRect(); const x = e.clientX - r.left, y = e.clientY - r.top;
    let best = null, bd = 30;
    for (const a of anoms) { const d = Math.hypot(a.x - x, a.y - y); if (d < bd) { bd = d; best = a; } }
    if (!best) { onMissClick(); flash.push({ x, y, t: 0.3, bad: false }); return; }
    best.dead = true;
    if (best.real) {
      slots[idx].textContent = word[idx]; slots[idx].classList.add('filled');
      idx++; sfx.ok(); onLetter(idx);
      flash.push({ x: best.x, y: best.y, t: 0.5, bad: false });
      if (idx >= word.length) { done = true; setTimeout(() => onDone(), 500); }
    } else {
      sfx.err(); onDecoy(); flash.push({ x: best.x, y: best.y, t: 0.5, bad: true });
    }
  });

  function step(now) {
    raf = requestAnimationFrame(step);
    const dt = Math.min(0.05, (now - last) / 1000); last = now;
    bctx.fillStyle = 'rgba(0,0,0,0.035)'; bctx.fillRect(0, 0, W, H);
    bctx.font = `${size}px "Share Tech Mono", monospace`; bctx.textAlign = 'center';
    ctx.textAlign = 'center';
    cols.forEach((c, i) => {
      c.y += c.v * dt;
      if (c.y > H + 200) { c.y = rand(-200, 0); c.v = rand(70, 190); }
      const row = Math.floor(c.y / size);
      if (row === c.row) return; // one glyph per cell keeps the field crisp
      c.row = row;
      const x = i * size, y = row * size;
      bctx.fillStyle = '#000'; bctx.fillRect(x, y - size * 1.85, size, size * 2.1);
      bctx.fillStyle = 'rgba(79,220,114,.55)';
      bctx.fillText(c.prev || pick(NOISE), x + size / 2, y - size);
      c.prev = pick(NOISE);
      bctx.fillStyle = 'rgba(190,255,205,.95)';
      bctx.fillText(c.prev, x + size / 2, y);
    });
    ctx.save(); ctx.setTransform(1, 0, 0, 1, 0, 0);
    ctx.clearRect(0, 0, cv.width, cv.height); ctx.drawImage(bg, 0, 0);
    ctx.restore();
    if (!done) {
      spawnT -= dt;
      if (spawnT <= 0) { spawnAnom(); spawnT = rand(0.7, 1.3); }
    }
    for (const a of anoms) {
      a.y += a.v * dt; a.t += dt;
      if (a.y > H + 30) { a.dead = true; continue; }
      const on = a.real ? 1 : (Math.sin(a.t * 30) > 0 ? 1 : 0.4);
      ctx.save();
      ctx.shadowColor = a.real ? '#ffffff' : '#ff6060'; ctx.shadowBlur = 16;
      ctx.fillStyle = a.real ? '#ffffff' : `rgba(255,${on > .5 ? 220 : 90},${on > .5 ? 220 : 90},1)`;
      ctx.font = `bold ${size + 8}px "Share Tech Mono", monospace`;
      ctx.fillText(a.ch, a.x, a.y);
      ctx.strokeStyle = a.real ? 'rgba(255,255,255,.8)' : 'rgba(255,90,90,.6)'; ctx.lineWidth = 1.5;
      const s = size * 0.9;
      ctx.beginPath();
      ctx.moveTo(a.x - s + 5, a.y - s - 4); ctx.lineTo(a.x - s, a.y - s - 4); ctx.lineTo(a.x - s, a.y + 8); ctx.lineTo(a.x - s + 5, a.y + 8);
      ctx.moveTo(a.x + s - 5, a.y - s - 4); ctx.lineTo(a.x + s, a.y - s - 4); ctx.lineTo(a.x + s, a.y + 8); ctx.lineTo(a.x + s - 5, a.y + 8);
      ctx.stroke();
      ctx.restore();
    }
    anoms = anoms.filter((a) => !a.dead);
    for (const f of flash) {
      f.t -= dt;
      ctx.strokeStyle = f.bad ? `rgba(255,70,70,${f.t * 2})` : `rgba(200,255,215,${f.t * 2})`;
      ctx.beginPath(); ctx.arc(f.x, f.y - 6, 40 * (0.6 - f.t), 0, 7); ctx.stroke();
    }
    flash = flash.filter((f) => f.t > 0);
  }

  // debug handle for automated play-throughs
  grid.__hunt = { get anoms() { return anoms; } };
  resize();
  raf = requestAnimationFrame(step);
  const destroy = () => { cancelAnimationFrame(raf); ro.disconnect(); };
  signal?.addEventListener('abort', destroy);
  return { destroy, progress: () => idx };
}
