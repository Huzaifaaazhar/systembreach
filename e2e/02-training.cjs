const { open } = require('./helpers.cjs');
(async () => {
  const t = await open();
  const { page, shot, check, state, nav } = t;
  await page.goto(t.URL); await page.waitForTimeout(1500);
  await nav('Training Construct');

  // ── COMBAT: bot reacts to the telegraphs exactly as a player would ──
  await page.click('button:has-text("Begin round")');
  await page.waitForTimeout(300);
  let shotTaken = false, btUsed = false;
  for (let i = 0; i < 1400; i++) {
    const g = await page.evaluate(() => { const c = window.__sb.combat; return c ? { over: c.over, ps: c.p.x, os: c.o.x, st: c.o.state, kind: c.o.kind, t: c.o.t } : null; });
    if (!g || g.over) break;
    const dist = Math.abs(g.ps - g.os);
    if (g.st === 'windup') {
      if (!btUsed && i > 100) { await page.keyboard.press('KeyQ'); btUsed = true; }
      if (g.kind === 'high') { await page.keyboard.down('KeyK'); if (!shotTaken) { await page.waitForTimeout(60); await shot('20-combat-block'); shotTaken = true; } }
      else if (g.t < 0.35) { await page.keyboard.press('Space'); }
    } else {
      await page.keyboard.up('KeyK');
      if (g.st === 'recover' || g.st === 'stagger') await page.keyboard.press('KeyJ');
      else if (dist > 100) { await page.keyboard.down(g.ps < g.os ? 'KeyD' : 'KeyA'); await page.waitForTimeout(40); await page.keyboard.up(g.ps < g.os ? 'KeyD' : 'KeyA'); }
      else if (Math.random() < 0.15) await page.keyboard.press('KeyJ');
    }
    await page.waitForTimeout(25);
  }
  await page.keyboard.up('KeyK');
  await page.waitForTimeout(500);
  await shot('21-combat-result');
  const c = await page.evaluate(() => { const g = window.__sb.combat; return { over: g.over, php: g.p.hp, ohp: g.o.hp, perfects: g.perfects, counters: g.counters, reactions: g.reactions.length }; });
  check(c.over, `combat round finished (you ${c.php} hp, program ${c.ohp} hp, perfect blocks ${c.perfects}, counters ${c.counters}, reactions measured ${c.reactions})`);
  const s1 = await state();
  check(s1.records.completed.combat && s1.abilities.combat > 0, `combat result logged (best ${s1.records.combatBest}, ability ${s1.abilities.combat})`);

  // ── BULLET TIME ──
  await page.click('[role=tab]:has-text("Bullet Time")'); await page.waitForTimeout(300);
  await page.click('button:has-text("Engage")');
  const box = await (await page.$('canvas[aria-label^="Bullet-time arena"]')).boundingBox();
  let btShot = false, holding = false;
  for (let i = 0; i < 2200; i++) {
    const b = await page.evaluate(() => { const s = window.__sb.bullet; return { over: s.over, warns: s.warns.length, fast: s.shots.filter((x) => x.fast).length, active: s.active, px: s.px, py: s.py, shots: s.shots.map((x) => [x.x, x.y]) }; });
    if (b.over) break;
    const danger = b.warns > 0 || b.fast > 0;
    if (danger && !holding) { await page.keyboard.down('KeyQ'); holding = true; }
    if (!danger && holding) { await page.keyboard.up('KeyQ'); holding = false; }
    if (b.active && !btShot && b.fast > 2) { await shot('22-bullet-time-active'); btShot = true; }
    // dodge: move away from the nearest shot
    let nx = b.px, ny = b.py, best = 1e9;
    for (const [x, y] of b.shots) { const d = Math.hypot(x - b.px, y - b.py); if (d < best) { best = d; nx = x; ny = y; } }
    const tx = Math.max(20, Math.min(box.width - 20, b.px + (best < 160 ? (b.px - nx) * 0.8 : (box.width / 2 - b.px) * 0.1)));
    const ty = Math.max(20, Math.min(box.height - 20, b.py + (best < 160 ? (b.py - ny) * 0.8 : (box.height * 0.75 - b.py) * 0.1)));
    await page.mouse.move(box.x + tx, box.y + ty);
    await page.waitForTimeout(20);
  }
  await page.keyboard.up('KeyQ');
  await page.waitForTimeout(500); await shot('23-bullet-result');
  const s2 = await state();
  check(s2.records.completed.bullet, `bullet-time result logged (best ${s2.records.bulletBest}, volley reaction ${Math.round(s2.records.bulletReactionMs ?? -1)} ms)`);
  check(btShot, 'bullet time slowed the world during a volley (screenshot taken)');

  // ── REFLEX ──
  await page.click('[role=tab]:has-text("Reflex")'); await page.waitForTimeout(300);
  await page.click('button:has-text("Start test")');
  let reflexShot = false;
  const r0 = Date.now();
  while (Date.now() - r0 < 120000) {
    const txt = await page.textContent('button[aria-label^="Reflex pad"]');
    if (/GO ●|♪/.test(txt)) { await page.waitForTimeout(120 + Math.random() * 80); await page.keyboard.press('Space'); if (!reflexShot) { reflexShot = true; } }
    if (/HOLD ▲/.test(txt) && !reflexShot) { await shot('24-reflex-decoy'); }
    if (/Avg .* accuracy/.test(txt)) break;
    await page.waitForTimeout(20);
  }
  await page.waitForTimeout(300); await shot('25-reflex-result');
  const s3 = await state();
  check(s3.records.reflexBestMs != null && s3.records.reflexHistory.length === 1, `reflex test logged (best avg ${s3.records.reflexBestMs} ms, accuracy ${s3.records.reflexHistory[0]?.accuracy}%)`);

  // ── MOVEMENT: bot looks ahead at tiles, jumps hazards, uses switches ──
  await page.click('[role=tab]:has-text("Movement")'); await page.waitForTimeout(300);
  await page.click('button:has-text("Start level 1")');
  let cleared = 0;
  for (let lvl = 1; lvl <= 2; lvl++) {
    if (lvl > 1) { await page.click(`button:has-text("Level ${lvl} ▸")`); await page.waitForTimeout(200); }
    await page.keyboard.down('KeyD');
    const t0 = Date.now(); let movShot = false;
    while (Date.now() - t0 < 90000) {
      const m = await page.evaluate(() => {
        const g = window.__sb.movement, T = 32; const cx = Math.floor((g.x + 9) / T), feet = Math.floor((g.y + 28) / T);
        const tile = (x, y) => g.lv.tiles.get(`${x},${y}`) ?? '';
        const solid = (x, y) => ['#', '='].includes(tile(x, y)) || (tile(x, y) === 'G' && !g.open.has(String(x)));
        const gap = [1, 2].some((d) => !solid(cx + d, feet) && !solid(cx + d, feet + 1) && !solid(cx + d, feet + 2)); const ahead = gap || [1].some((d) => tile(cx + d, feet - 1) === '^') || solid(cx + 1, feet - 1);
        const sw = [-1, 0, 1].some((d) => tile(cx + d, feet - 1) === 'S') && !g.open.has(String(cx + 2)) && !g.open.has(String(cx + 1)) && !g.open.has(String(cx + 3));
        const drone = g.lv.drones.some((d) => d.x / T - cx > 0 && d.x / T - cx < 3 && Math.abs(d.y0 + Math.sin(g.t * d.sp) * d.amp - g.y) < 50);
        return { ground: g.ground, ahead, gap, sw, drone, dead: g.dead > 0, deaths: g.deaths };
      });
      const txt = await page.$eval('canvas[aria-label^="Movement course"]', (c) => c.parentElement.textContent);
      if (/cleared|Course complete/.test(txt)) { cleared = lvl; break; }
      if (m.sw) { await page.keyboard.press('KeyE'); }
      if (m.drone && m.ground) { await page.keyboard.up('KeyD'); await page.waitForTimeout(250); await page.keyboard.down('KeyD'); }
      if (m.ahead && m.ground) { if (m.gap) await page.keyboard.down('ShiftLeft'); await page.keyboard.down('Space'); await page.waitForTimeout(260); await page.keyboard.up('Space'); await page.keyboard.up('ShiftLeft'); }
      if (!movShot && Date.now() - t0 > 4000) { await shot('26-movement-play'); movShot = true; }
      await page.waitForTimeout(30);
    }
    await page.keyboard.up('KeyD');
    if (cleared < lvl) break;
  }
  await page.waitForTimeout(300); await shot('27-movement-result');
  const s4 = await state();
  check(cleared >= 1 && s4.records.movementLevel >= 1, `movement course: bot cleared ${cleared} level(s); store movementLevel=${s4.records.movementLevel}`);

  // touch controls toggle renders joystick and buttons
  await page.click('button:has-text("Show touch controls")');
  check(await page.isVisible('[aria-label="Movement joystick"]') && await page.isVisible('button:has-text("E USE")'), 'touch controls render joystick + action buttons');
  await shot('28-touch-controls');
  await t.save();
  console.log('ERRORS:', t.errors.length ? t.errors.join('\n') : 'none');
  await t.browser.close();
})();
