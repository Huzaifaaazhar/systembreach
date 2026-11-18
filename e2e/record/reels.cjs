// Five vertical 4K reels covering the whole game in order. Usage: node reels.cjs [firstReel]
const { session, URL } = require('./recorder.cjs');

const B = (x, y, w, h) => [x, y, w, h];
const WALLS = {
  streets: [B(120, 80, 180, 160), B(120, 330, 180, 170), B(400, 0, 160, 230), B(400, 330, 160, 270), B(660, 100, 160, 180), B(660, 380, 160, 160)],
  subway: [B(0, 0, 1000, 120), B(0, 480, 1000, 120), B(200, 200, 60, 200), B(450, 120, 60, 170), B(450, 360, 60, 120), B(700, 200, 60, 200)],
  exit: [B(140, 0, 60, 420), B(320, 180, 60, 420), B(500, 0, 60, 420), B(680, 180, 60, 420)],
};
const ROUTES = {
  streets: [[50, 285], [350, 285], [630, 300], [630, 330], [870, 330], [870, 60], [935, 60]],
  subway: [[140, 300], [140, 160], [400, 160], [400, 325], [580, 325], [640, 160], [800, 160], [945, 300]],
  exit: [[100, 520], [260, 520], [260, 100], [440, 100], [440, 520], [620, 520], [620, 100], [800, 100], [925, 300]],
};
const setRange = (page, sel, v) => page.$eval(sel, (el, val) => { const set = Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, 'value').set; set.call(el, String(val)); el.dispatchEvent(new Event('input', { bubbles: true })); }, v);

(async () => {
  const first = Number(process.argv[2] || 1);
  const s = await session({ fresh: first === 1 });
  const { page, w, dbg } = s;
  const center = (sel) => page.$eval(sel, (el) => el.scrollIntoView({ block: 'center' }));
  const reel = async (n, fn) => {
    if (n < first) return;
    try { await s.start(String(n)); await fn(); } catch (e) { console.log(`REEL ${n} ERROR: ${e.stack}`); }
    await s.stop(String(n)); await s.save();
  };
  const inv = async (title) => { await page.click(`li:has-text("${title}") >> button:has-text("Investigate")`); await w(700); };

  // ── bots ──
  async function stealth(mapName, maxSec = 90) {
    const walls = WALLS[mapName], route = ROUTES[mapName];
    await center('canvas[aria-label^="Evasion map"]'); await w(200);
    const box = await (await page.$('canvas[aria-label^="Evasion map"]')).boundingBox();
    const sc = Math.min(box.width / 1000, box.height / 600), ox = (box.width - 1000 * sc) / 2, oy = (box.height - 600 * sc) / 2;
    const scr = (x, y) => [box.x + ox + x * sc, box.y + oy + y * sc];
    const blocked = (x1, y1, x2, y2) => { const n = Math.ceil(Math.hypot(x2 - x1, y2 - y1) / 8); for (let i = 1; i < n; i++) { const x = x1 + ((x2 - x1) * i) / n, y = y1 + ((y2 - y1) * i) / n; if (walls.some(([a, b, c, d]) => x > a && x < a + c && y > b && y < b + d)) return true; } return false; };
    const seen = (a, x, y, pad = 0) => { const dx = x - a.x, dy = y - a.y, d = Math.hypot(dx, dy); if (d < 40) return true; if (d > 140 + pad) return false; let da = Math.atan2(dy, dx) - a.dir; da = Math.atan2(Math.sin(da), Math.cos(da)); return Math.abs(da) < Math.PI / 6 + 0.25 && !blocked(a.x, a.y, x, y); };
    let wi = 0, caught = 0, bt = false;
    const t0 = Date.now();
    await page.click('button:has-text("Go")'); await w(200);
    await page.mouse.move(...scr(60, 560));
    while (Date.now() - t0 < maxSec * 1000 * s.K) {
      const st = await dbg((sb) => { const e = sb.evasion; return { over: e.over, x: e.x, y: e.y, caught: e.caught, agents: e.agents.map((a) => ({ x: a.x, y: a.y, dir: a.dir })) }; });
      if (st.over) break;
      if (st.caught > caught) { caught = st.caught; wi = 0; }
      let [tx, ty] = route[wi];
      if (Math.hypot(tx - st.x, ty - st.y) < 14 && wi < route.length - 1) { wi++; [tx, ty] = route[wi]; }
      const d = Math.hypot(tx - st.x, ty - st.y) || 1;
      const nx = st.x + ((tx - st.x) / d) * Math.min(d, 45), ny = st.y + ((ty - st.y) / d) * Math.min(d, 45);
      const nowSeen = st.agents.some((a) => seen(a, st.x, st.y));
      const danger = st.agents.some((a) => seen(a, nx, ny, 30));
      const near = st.agents.some((a) => Math.hypot(a.x - st.x, a.y - st.y) < 190);
      if (near && !bt) { await page.keyboard.down('KeyQ'); bt = true; } else if (!near && bt) { await page.keyboard.up('KeyQ'); bt = false; }
      if (danger && !nowSeen) await page.mouse.move(...scr(st.x, st.y));
      else { if (nowSeen) await page.keyboard.down('ShiftLeft'); else await page.keyboard.up('ShiftLeft'); await page.mouse.move(...scr(tx, ty)); }
      await w(15);
    }
    await page.keyboard.up('KeyQ'); await page.keyboard.up('ShiftLeft');
  }
  async function diffClick() {
    const ref = await page.$$eval('svg[aria-label="Reference street render"] > *', (els) => els.map((e) => e.outerHTML));
    await page.waitForSelector('svg[aria-label^="Patched street render"]', { timeout: 30000 * s.K });
    await w(700);
    const sel = 'svg[aria-label^="Patched street render"]';
    const now = await page.$$eval(`${sel} > *`, (els) => els.map((e) => e.outerHTML));
    for (const i of ref.map((h, i) => (h !== now[i] ? i : -1)).filter((i) => i >= 0)) {
      const el = await page.$(`${sel} > :nth-child(${i + 1})`); await el.scrollIntoViewIfNeeded(); const b = await el.boundingBox();
      await page.mouse.move(b.x + b.width / 2, b.y + b.height / 2, { steps: 5 }); await w(150);
      await page.mouse.click(b.x + b.width / 2, b.y + b.height / 2); await w(600);
    }
  }
  async function reflexBot(onTrial = () => {}) {
    const t0 = Date.now(); let n = 0, last = '';
    while (Date.now() - t0 < 90000 * s.K) {
      const txt = await page.textContent('button[aria-label^="Reflex pad"]').catch(() => '');
      if (!txt || /Avg .* accuracy/.test(txt)) break;
      if (/GO ●|♪/.test(txt)) { await w(170 + Math.random() * 80); await page.keyboard.press('Space'); }
      const m = txt.match(/(\d+)\/\d+$/); if (m && m[1] !== last) { last = m[1]; n++; onTrial(n); }
      await w(10);
    }
  }
  async function startMission(n, briefSpeed = 2.5) {
    await s.nav('Infiltration Missions');
    s.speed(briefSpeed);
    await page.click(`button:has-text("MISSION ${n}")`); await w(1800);
    await page.click('button:has-text("Begin mission")'); await w(500);
    s.speed(1);
  }

  await page.goto(URL);
  await page.waitForTimeout(1500 * s.K);

  // ── REEL 1: wake up → identity → anomalies → red pill ──
  await reel(1, async () => {
    s.speed(2.5);
    await page.waitForSelector('text=ENTER THE SYSTEM', { timeout: 200000 * s.K });
    s.speed(1); await w(700); await page.keyboard.press('Enter'); await w(1300);
    await s.nav('Identity');
    s.speed(1.6); await page.click('text=Verify identity'); await w(3900); await page.mouse.wheel(0, 380); await w(900); s.speed(1);
    await s.nav('Simulation Diagnostics');
    s.speed(2); await page.click('button:has-text("Run scan")'); await w(3300); s.speed(1);
    // clock drift: observation cut out
    await inv('Clock Drift'); await w(500);
    s.pause();
    let bad = -1;
    for (let i = 0; i < 40 && bad < 0; i++) {
      const times = await page.$$eval('button[aria-label^="Flag "]', (bs) => bs.map((b) => b.querySelector('div').textContent));
      const sec = times.map((x) => { const [h, m, q] = x.split(':').map(Number); return h * 3600 + m * 60 + q; });
      for (let k = 1; k < 3; k++) if (Math.abs(sec[k] - sec[0]) >= 3) bad = k;
      await w(400);
    }
    s.resume(); await w(500);
    await page.click(`button[aria-label^="Flag "] >> nth=${Math.max(1, bad)}`); await w(1400);
    // duplicate object
    await inv('Duplicate Object');
    s.speed(3);
    const n = await page.$$eval('li:has-text("Duplicate Object") ul button', (b) => b.length);
    for (let i = 0; i < n; i++) {
      const sel = `li:has-text("Duplicate Object") ul button >> nth=${i}`;
      await page.click(sel); await page.waitForFunction((q) => document.querySelectorAll(q)[0] && true, 'li', { timeout: 5000 * s.K });
      await w(80);
      if ((await page.getAttribute(sel, 'aria-pressed')) === 'true') { await page.click(sel); await w(80); }
    }
    const rows = await page.$$eval('li:has-text("Duplicate Object") ul button', (bs) => bs.map((b) => b.textContent));
    const serials = rows.map((r) => r.match(/AS-\d+/)?.[0]);
    const dup = serials.find((x, i) => x && serials.indexOf(x) !== i);
    s.speed(1.5);
    for (const i of serials.map((x, i) => (x === dup ? i : -1)).filter((i) => i >= 0)) { const sel = `li:has-text("Duplicate Object") ul button >> nth=${i}`; if ((await page.getAttribute(sel, 'aria-pressed')) !== 'true') await page.click(sel); await w(450); }
    await w(1400); s.speed(1);
    // looping pedestrian: wait for a clear shot off camera
    await inv('Looping Pedestrian'); await w(1200);
    await center('canvas[aria-label^="Street crossing"]');
    const box = await (await page.$('canvas[aria-label^="Street crossing"]')).boundingBox();
    s.pause();
    for (let i = 0; i < 60; i++) {
      const p = await dbg((sb) => { const ps = sb.loopPeds; const l = ps.find((q) => q.loop); return { x: l.x, y: l.y, near: ps.some((q) => !q.loop && Math.hypot(q.x - l.x, q.y - l.y) < 0.12) }; });
      if (!p.near) { s.resume(); await w(300); await page.mouse.click(box.x + p.x * box.width, box.y + p.y * box.height - 4); await w(250); if (await page.isVisible('text=/Same path every/')) break; s.pause(); }
      await w(150);
    }
    await w(1300);
    // deeper scan, shifting corridor, transmission
    s.speed(2.2); await page.click('button:has-text("Run scan again")'); await w(3300);
    s.speed(1.6);
    await inv('Shifting Corridor');
    await page.click('button:has-text("Walk in")'); await w(1300);
    const a = await page.getAttribute('svg[aria-label^="Corridor with"]', 'aria-label');
    await page.click('button:has-text("Leave corridor")'); await w(500);
    await page.click('button:has-text("Walk back in")'); await w(1300);
    const b = await page.getAttribute('svg[aria-label^="Corridor with"]', 'aria-label');
    const ans = a.match(/(\d+) doors/)[1] !== b.match(/(\d+) doors/)[1] ? 'The number of doors' : a.includes('painting') !== b.includes('painting') ? 'The painting on the wall' : 'The ceiling light';
    await page.click(`button:has-text("${ans}")`); await w(1500);
    await inv('Unexplained Transmission');
    s.speed(2);
    await center('input[aria-label="Tune frequency"]');
    for (const v of [93.5, 94.6, 95.7, 96.6, 97.4, 98.1, 98.6, 98.9, 99.1]) { await setRange(page, 'input[aria-label="Tune frequency"]', v); await w(300); }
    await w(2300);
    // the transmission and the choice
    s.speed(1.6);
    await page.evaluate(() => document.querySelector('#workspace > div')?.scrollTo(0, 0)); await w(300);
    await page.click('button:has-text("Open transmission")');
    await page.waitForSelector('button:has-text("RED PILL")', { timeout: 40000 * s.K }); await w(900);
    await page.click('button:has-text("RED PILL")'); await w(700);
    s.speed(1);
    const h = await (await page.$('button[aria-label^="Hold to take"]')).boundingBox();
    await page.mouse.move(h.x + h.width / 2, h.y + h.height / 2); await page.mouse.down(); await w(1600); await page.mouse.up();
    s.speed(1.6);
    await page.waitForSelector('button:has-text("Enter the Construct")', { timeout: 40000 * s.K }); await w(1300);
    s.speed(1);
    await page.click('button:has-text("Enter the Construct")'); await w(1300);
  });

  // ── REEL 2: Training Construct ──
  await reel(2, async () => {
    await w(800);
    // combat
    await page.click('button:has-text("Begin round")'); await center('canvas[aria-label^="Combat arena"]');
    s.speed(1.4);
    let bt = false; const t0 = Date.now();
    while (Date.now() - t0 < 70000 * s.K) {
      const g = await dbg((sb) => { const c = sb.combat; return c ? { over: c.over, ps: c.p.x, os: c.o.x, st: c.o.state, kind: c.o.kind, t: c.o.t, time: c.time } : null; });
      if (!g || g.over) break;
      const dist = Math.abs(g.ps - g.os);
      if (g.st === 'windup') {
        if (!bt && g.time > 3) { await page.keyboard.press('KeyQ'); bt = true; }
        if (g.kind === 'high') { if (g.t < 0.25) await page.keyboard.down('KeyK'); } else if (g.t < 0.3) await page.keyboard.press('Space');
      } else {
        await page.keyboard.up('KeyK');
        if (g.st === 'recover' || g.st === 'stagger') await page.keyboard.press('KeyJ');
        else if (dist > 105) { const k = g.ps < g.os ? 'KeyD' : 'KeyA'; await page.keyboard.down(k); await w(60); await page.keyboard.up(k); }
        else if (Math.random() < 0.12) await page.keyboard.press('KeyJ');
      }
      await w(20);
    }
    await page.keyboard.up('KeyK');
    s.speed(1); await w(1300);
    // bullet time: show the first waves, cut to the result
    await page.evaluate(() => document.querySelector('#workspace > div')?.scrollTo(0, 0));
    await page.click('[role=tab]:has-text("Bullet Time")'); await w(500);
    await page.click('button:has-text("Engage")'); await center('canvas[aria-label^="Bullet-time arena"]');
    const box = await (await page.$('canvas[aria-label^="Bullet-time arena"]')).boundingBox();
    s.speed(1.4);
    let holding = false; const t1 = Date.now(); let cut = false;
    while (Date.now() - t1 < 90000 * s.K) {
      const b = await dbg((sb) => { const q = sb.bullet; return { over: q.over, warns: q.warns.length, fast: q.shots.filter((x) => x.fast).length, px: q.px, py: q.py, shots: q.shots.map((x) => [x.x, x.y]), t: q.t }; });
      if (b.over) break;
      if (!cut && b.t > 13) { s.pause(); cut = true; }
      const danger = b.warns > 0 || (b.fast > 0 && b.shots.some(([x, y]) => Math.hypot(x - b.px, y - b.py) < 260));
      if (danger && !holding) { await page.keyboard.down('KeyQ'); holding = true; }
      if (!danger && holding) { await page.keyboard.up('KeyQ'); holding = false; }
      let nx = b.px, ny = b.py, best = 1e9;
      for (const [x, y] of b.shots) { const d = Math.hypot(x - b.px, y - b.py); if (d < best) { best = d; nx = x; ny = y; } }
      const tx = Math.max(15, Math.min(box.width - 15, b.px + (best < 120 ? (b.px - nx) * 0.9 : (box.width / 2 - b.px) * 0.12)));
      const ty = Math.max(15, Math.min(box.height - 15, b.py + (best < 120 ? (b.py - ny) * 0.9 : (box.height * 0.7 - b.py) * 0.12)));
      await page.mouse.move(box.x + tx, box.y + ty);
      await w(15);
    }
    await page.keyboard.up('KeyQ');
    s.resume(); s.speed(1); await w(1500);
    // reflex: a few trials, then the result
    await page.evaluate(() => document.querySelector('#workspace > div')?.scrollTo(0, 0));
    await page.click('[role=tab]:has-text("Reflex")'); await w(500);
    await page.click('button:has-text("Start test")');
    s.speed(1.5);
    await reflexBot((n) => { if (n === 5) s.pause(); });
    s.resume(); s.speed(1); await w(1500);
    // movement course
    await page.evaluate(() => document.querySelector('#workspace > div')?.scrollTo(0, 0));
    await page.click('[role=tab]:has-text("Movement")'); await w(500);
    await page.click('button:has-text("Start level 1")'); await center('canvas[aria-label^="Movement course"]');
    s.speed(1.4);
    await page.keyboard.down('KeyD');
    const t2 = Date.now();
    while (Date.now() - t2 < 90000 * s.K) {
      const m = await dbg((sb) => {
        const g = sb.movement, T = 32; const cx = Math.floor((g.x + 9) / T), feet = Math.floor((g.y + 28) / T);
        const tile = (x, y) => g.lv.tiles.get(`${x},${y}`) ?? '';
        const solid = (x, y) => ['#', '='].includes(tile(x, y)) || (tile(x, y) === 'G' && !g.open.has(String(x)));
        const gap = [1, 2].some((d) => !solid(cx + d, feet) && !solid(cx + d, feet + 1) && !solid(cx + d, feet + 2));
        const ahead = gap || tile(cx + 1, feet - 1) === '^' || solid(cx + 1, feet - 1);
        const sw = [-1, 0, 1].some((d) => tile(cx + d, feet - 1) === 'S') && ![1, 2, 3].some((d) => g.open.has(String(cx + d)));
        const drone = g.lv.drones.some((d) => d.x / T - cx > 0 && d.x / T - cx < 3 && Math.abs(d.y0 + Math.sin(g.t * d.sp) * d.amp - g.y) < 50);
        return { ground: g.ground, ahead, gap, sw, drone, done: g.done };
      });
      if (m.done) break;
      if (m.sw) await page.keyboard.press('KeyE');
      if (m.drone && m.ground) { await page.keyboard.up('KeyD'); await w(300); await page.keyboard.down('KeyD'); }
      if (m.ahead && m.ground) { if (m.gap) await page.keyboard.down('ShiftLeft'); await page.keyboard.down('Space'); await w(260); await page.keyboard.up('Space'); await page.keyboard.up('ShiftLeft'); }
      await w(15);
    }
    await page.keyboard.up('KeyD');
    s.speed(1); await w(1500);
  });

  // ── REEL 3: Reality manipulation + Agent detection ──
  const sim = (fn) => page.evaluate((f) => (new Function('s', `return (${f})(s)`))(window.__sb.reality), fn.toString());
  await reel(3, async () => {
    await s.nav('Reality Manipulation');
    await page.waitForSelector('[role=application] canvas'); await w(1200);
    s.speed(1.5);
    const steps = [['inverted', 1800], ['normal', 1400], ['zero', 300], ['Impulse all', 2000], ['Slow', 1800], ['Pause', 900], ['Resume', 200], ['normal', 900], ['+ sphere', 500], ['+ ico', 500], ['Drop from height', 1500]];
    for (const [label, ms] of steps) { await s.tap(`button:text-is("${label}")`).catch(() => s.tap(`button:has-text("${label}")`)); await w(ms); }
    const cv = await (await page.$('[role=application] canvas')).boundingBox();
    await s.tap('button:text-is("Pause")'); await w(300);
    const p = await sim((x) => x.project(x.bodies[0]));
    await page.mouse.click(cv.x + p.x * cv.width, cv.y + p.y * cv.height); await w(500);
    const q = await sim((x) => x.project(x.selected));
    await page.mouse.move(cv.x + q.x * cv.width, cv.y + q.y * cv.height); await page.mouse.down();
    await page.mouse.move(cv.x + q.x * cv.width + 120, cv.y + q.y * cv.height + 30, { steps: 15 }); await page.mouse.up(); await w(500);
    await s.tap('button:text-is("Resume")'); await page.evaluate(() => { [...document.querySelectorAll('button')].find((b) => b.textContent === 'Launch up')?.click(); }); await w(1500);
    await page.mouse.move(cv.x + cv.width * 0.85, cv.y + cv.height * 0.2); await page.mouse.down();
    await page.mouse.move(cv.x + cv.width * 0.4, cv.y + cv.height * 0.3, { steps: 25 }); await page.mouse.up(); await w(500);
    await s.tap('button:text-is("Urban")'); await s.tap('button:text-is("inverted")'); await w(1300); await s.tap('button:text-is("normal")'); await w(1800);
    await s.tap('button:text-is("Minimal Construct")'); await s.tap('button:text-is("Impulse all")'); await w(2200);
    await s.tap('button:has-text("Reset environment")'); await w(1300);
    s.speed(1);
    // agent detection (easy)
    await s.nav('Agent Detection'); await w(700);
    await page.click('button:has-text("EASY")'); await w(700);
    s.speed(1.5);
    const nodes = await page.$$('svg[aria-label="Network topology"] g[role=button]');
    for (let i = 1; i < nodes.length; i++) {
      await nodes[i].click(); await w(400);
      if (await page.isEnabled('button:has-text("Scan (")')) { await s.tap('button:has-text("Scan (")'); await w(800); }
      const insp = await page.textContent('section[aria-label="Host Inspector"]');
      const tells = Number((insp.match(/(\d) of 3 tells/) || [0, 0])[1]);
      if (await page.isEnabled('button:has-text("Flag Agent")')) { await s.tap(tells >= 2 ? 'button:has-text("Flag Agent")' : 'button:has-text("Mark clear")'); await w(500); }
      if (await page.isVisible('text=Segment Secured')) break;
    }
    await page.$eval('section[aria-label="Segment Secured"]', (el) => el.scrollIntoView({ block: 'center' })).catch(() => {});
    s.speed(1); await w(1800);
  });

  // ── REEL 4: infiltration missions 01–05 ──
  await reel(4, async () => {
    // M01 trace the signal
    await startMission('01');
    s.speed(1.6);
    const probeAt = async (x, y) => { const sel = `button[aria-label^="Cell ${x + 1},${y + 1}"]`; await page.click(sel); await w(500); return Number((await page.getAttribute(sel, 'aria-label')).match(/strength (\d+)/)[1]); };
    const readings = [];
    for (const [x, y] of [[2, 2], [7, 2], [4, 5]]) readings.push([x, y, await probeAt(x, y)]);
    const est = (cx, cy) => readings.reduce((e, [x, y, v]) => { const d = Math.hypot(cx - x, cy - y); return e + (v <= 8 ? (d < 5.6 ? 5.6 - d : 0) : Math.abs(d - (100 - v) / 16)); }, 0);
    const ranked = () => { const c = []; for (let x = 0; x < 10; x++) for (let y = 0; y < 7; y++) if (!readings.some(([a, b]) => a === x && b === y)) c.push([x, y, est(x, y)]); return c.sort((a, b) => a[2] - b[2]); };
    let lock = readings.find(([, , v]) => v >= 97);
    for (let k = 0; k < 4 && !lock; k++) { const [x, y] = ranked()[0]; const v = await probeAt(x, y); readings.push([x, y, v]); if (v >= 97) lock = [x, y, v]; }
    await page.click('button:has-text("Lock source")'); await w(300);
    for (const [x, y] of (lock ? [lock] : ranked()).slice(0, 2)) { await page.click(`button[aria-label^="Cell ${x + 1},${y + 1}"]`); await w(800); if (await page.isVisible('section[aria-label="Mission Complete"]')) break; }
    s.speed(1); await w(1300);
    // M02 identify the anomaly
    await page.click('button:has-text("Mission list")').catch(() => {});
    await startMission('02');
    s.speed(2.5); await w(1000); s.speed(1.5);
    await diffClick();
    s.speed(1); await w(1300);
    // off camera: the anomaly lens reveals the sixth anomaly (needed for the hidden ending)
    s.pause();
    await s.nav('Simulation Diagnostics');
    await page.click('button:has-text("Run scan again")'); await w(3500);
    await page.click('li:has-text("Render Seam") >> button:has-text("Investigate")'); await w(900);
    await center('canvas[aria-label^="Skyline"]'); await w(300);
    const sk = await (await page.$('canvas[aria-label^="Skyline"]')).boundingBox();
    const seamX = await dbg((sb) => sb.seamX);
    await page.mouse.move(sk.x + sk.width * seamX, sk.y + sk.height * 0.3, { steps: 5 });
    await page.mouse.click(sk.x + sk.width * seamX, sk.y + sk.height * 0.3); await w(1800);
    s.resume();
    // M03 evade the agent
    await startMission('03');
    s.speed(1.8); await stealth('streets'); s.speed(1); await w(1300);
    // M04 breach the network
    await page.click('button:has-text("Mission list")').catch(() => {});
    await startMission('04');
    s.speed(2);
    const BASE = { straight: [0, 2], elbow: [0, 1], tee: [0, 1, 2] };
    const sidesOf = (kind, rot) => BASE[kind].map((d) => (d + rot) % 4).sort().join('');
    const labels = await page.$$eval('button[aria-label^="Segment"]', (bs) => bs.map((b) => b.getAttribute('aria-label')));
    const src = await page.$$eval('span:has-text("UP ▸")', (x) => x.findIndex((e) => e.className.includes('text-accent')));
    const dst = await page.$$eval('span:has-text("◂ CORE")', (x) => x.findIndex((e) => !e.className.includes('text-transparent')));
    const W = 6, H = 5, DX = [0, 1, 0, -1], DY = [-1, 0, 1, 0];
    const cells = labels.map((l) => { const kind = l.match(/Segment (\w+)/)[1]; const open = [...l.match(/open ([NESW]*)/)[1]].map((c) => 'NESW'.indexOf(c)).sort().join(''); return { kind, rot: [0, 1, 2, 3].find((r) => sidesOf(kind, r) === open) }; });
    let plan = null;
    const dfs = (x, y, from, seen, acc) => {
      const c = cells[y * W + x];
      for (let k = 0; k < 4 && !plan; k++) {
        const open = BASE[c.kind].map((d) => (d + c.rot + k) % 4);
        if (!open.includes(from)) continue;
        for (const out of open) {
          if (out === from || plan) continue;
          if (x === W - 1 && y === dst && out === 1) { plan = [...acc, [y * W + x, k]]; return; }
          const nx = x + DX[out], ny = y + DY[out];
          if (nx < 0 || ny < 0 || nx >= W || ny >= H || seen.has(ny * W + nx)) continue;
          dfs(nx, ny, (out + 2) % 4, new Set([...seen, ny * W + nx]), [...acc, [y * W + x, k]]);
        }
      }
    };
    dfs(0, src, 3, new Set([src * W]), []);
    for (const [i, k] of plan || []) for (let j = 0; j < k; j++) { await page.click(`button[aria-label^="Segment"] >> nth=${i}`); await w(250); }
    s.speed(1); await w(1500);
    // off camera: a medium Agent-detection segment for the remaining intel
    s.pause();
    await s.nav('Agent Detection');
    await page.click('button:has-text("Change difficulty")').catch(() => {});
    await page.click('button:has-text("MEDIUM")').catch(() => {});
    for (let pass = 0; pass < 2; pass++) {
      const nodes = await page.$$('svg[aria-label="Network topology"] g[role=button]');
      for (let i = 1; i < nodes.length; i++) {
        await nodes[i].click();
        if (!(await page.isEnabled('button:has-text("Flag Agent")').catch(() => false))) continue;
        if (await page.isEnabled('button:has-text("Scan (")')) await s.tap('button:has-text("Scan (")');
        const insp = await page.textContent('section[aria-label="Host Inspector"]');
        if (!/Beacon jitter/.test(insp)) continue;
        const tells = (Number(insp.match(/Beacon jitter([\d.]+) ms/)[1]) < 1) + (Number(insp.match(/Latency([\d.]+) ms/)[1]) < 4) + /MISMATCH/.test(insp);
        await s.tap(tells >= 2 ? 'button:has-text("Flag Agent")' : 'button:has-text("Mark clear")');
        if (await page.isVisible('text=Segment Secured')) break;
      }
    }
    s.resume();
    // M05 reach the exit
    await startMission('05');
    s.speed(1.5); await w(1500);
    await page.click('button:has-text("Decommissioned subway")'); await w(500);
    s.speed(1.8); await stealth('subway'); s.speed(1); await w(1600);
  });

  // ── REEL 5: exit protocol + the four endings ──
  async function exitStages(record) {
    await s.nav('Exit Protocol');
    if (await page.isVisible('button:has-text("Run the Exit Protocol again")')) { await page.click('button:has-text("Run the Exit Protocol again")'); await w(400); }
    if (record) { s.speed(1.5); await w(1300); }
    await page.click('button:has-text("Initiate exit protocol")'); await w(400);
    if (record) s.speed(2.2);
    await diffClick();
    await page.waitForSelector('button:has-text("Start test")', { timeout: 15000 * s.K }); await w(600);
    await page.click('button:has-text("Start test")');
    await reflexBot();
    if (record) s.speed(1.5);
    await page.waitForSelector('[aria-label^="Exit gate room"] canvas', { timeout: 15000 * s.K });
    await center('[aria-label^="Exit gate room"]'); await w(1200);
    const gc = await (await page.$('[aria-label^="Exit gate room"] canvas')).boundingBox();
    await setRange(page, 'input[aria-label="Time dilation"]', 0.3); await w(700);
    for (let k = 0; k < 25; k++) {
      const p = await dbg((sb) => { const g = sb.gate; const b = g.bodies.find((x) => x.name === 'sentinel'); return { ...g.project(b), frozen: b.frozen }; });
      if (p.frozen) break;
      await page.mouse.click(gc.x + p.x * gc.width, gc.y + p.y * gc.height); await w(200);
    }
    await w(700);
    await setRange(page, 'input[aria-label="Time dilation"]', 1);
    await s.tap('button:has-text("↑ Up")');
    await page.waitForSelector('button:has-text("Go")', { timeout: 20000 * s.K }); await w(500);
    if (record) { s.speed(1.8); await stealth('exit', 70); }
    else { await page.click('button:has-text("Go")'); await w(300); await dbg((sb) => { sb.evasion.x = 920; sb.evasion.y = 300; }); }
    await page.waitForSelector('text=The line is ringing', { timeout: 20000 * s.K });
    s.speed(1);
  }
  await reel(5, async () => {
    await exitStages(true);
    await w(1500);
    await page.click('button:has-text("Answer the line")'); await w(3500);
    // the other three endings: stages cut, each decision and ending shown
    s.pause(); await exitStages(false); s.resume();
    await w(900); await page.click('button:has-text("Walk away")'); await w(2800);
    s.pause(); await exitStages(false); s.resume();
    await w(900); await page.click('button:has-text("Trace the exit signal")'); await w(3200);
    s.pause(); await exitStages(false); s.resume();
    await w(600); await dbg((sb) => sb.store.getState().addThreat(90)); await w(1500);
    await page.click('button:has-text("Answer the line")'); await w(3500);
  });

  await s.browser.close();
  console.log('REELS DONE');
})();
