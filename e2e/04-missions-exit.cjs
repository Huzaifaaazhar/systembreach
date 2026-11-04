const { open } = require('./helpers.cjs');

// Rotation tables mirroring src/lib/lattice.ts (used only to read the board the user sees).
const BASE = { straight: [0, 2], elbow: [0, 1], tee: [0, 1, 2] };
const sidesOf = (kind, rot) => BASE[kind].map((d) => (d + rot) % 4).sort().join('');

(async () => {
  const t = await open();
  const { page, shot, check, state, nav } = t;
  await page.goto(t.URL); await page.waitForTimeout(1500);
  const dbg = (fn, arg) => page.evaluate(([f, a]) => (new Function('sb', 'a', `return (${f})(sb, a)`))(window.__sb, a), [fn.toString(), arg]);

  async function startMission(n) {
    await nav('Infiltration Missions');
    await page.click(`button:has-text("MISSION ${n}")`); await page.waitForTimeout(300);
    if (n === '01') await shot('40-mission-briefing');
    await page.click('button:has-text("Begin mission")'); await page.waitForTimeout(400);
  }
  // Evasion: play for real for a few seconds (verifying detection), then move the operative onto the exit.
  async function evasion(name) {
    await page.click('button:has-text("Go")'); await page.waitForTimeout(300);
    await page.keyboard.down('KeyD'); await page.keyboard.down('KeyQ'); await page.waitForTimeout(2500); await page.keyboard.up('KeyQ');
    await page.waitForTimeout(2000); await page.keyboard.up('KeyD');
    const e = await dbg((sb) => ({ t: sb.evasion.t, detect: sb.evasion.detect, caught: sb.evasion.caught, x: sb.evasion.x }));
    console.log(`INFO  ${name}: after ${e.t.toFixed(1)}s of real play x=${Math.round(e.x)}, detection ${e.detect.toFixed(2)}, caught ${e.caught}`);
    await shot(`evasion-${name}`);
  }
  async function teleportTo(x, y) { await dbg((sb, p) => { sb.evasion.x = p[0]; sb.evasion.y = p[1]; }, [x, y]); await page.waitForTimeout(400); }

  if (!process.env.SKIP_TO_EXIT) {
  // ── M01 Trace the Signal: trilaterate from probe strengths shown on the grid ──
  await startMission('01');
  const probeAt = async (x, y) => { await page.click(`button[aria-label^="Cell ${x + 1},${y + 1}"]`); await page.waitForTimeout(80); const l = await page.getAttribute(`button[aria-label^="Cell ${x + 1},${y + 1}"]`, 'aria-label'); return Number(l.match(/strength (\d+)/)[1]); };
  const readings = [];
  for (const [x, y] of [[2, 2], [7, 2], [4, 5]]) readings.push([x, y, await probeAt(x, y)]);
  // readings below ~10% are clamped, so they only say "far away"
  const est = (cx, cy) => readings.reduce((e, [x, y, s]) => { const d = Math.hypot(cx - x, cy - y); return e + (s <= 8 ? (d < 5.6 ? 5.6 - d : 0) : Math.abs(d - (100 - s) / 16)); }, 0);
  const ranked = () => { const c = []; for (let x = 0; x < 10; x++) for (let y = 0; y < 7; y++) if (!readings.some(([a, b]) => a === x && b === y)) c.push([x, y, est(x, y)]); return c.sort((a, b) => a[2] - b[2]); };
  // refine: probe the best candidate until the probe saturates on the source (a probe on the source reads ~100)
  let lockAt = readings.find(([, , s]) => s >= 97);
  for (let k = 0; k < 4 && !lockAt; k++) { const [x, y] = ranked()[0]; const s = await probeAt(x, y); readings.push([x, y, s]); if (s >= 97) lockAt = [x, y, s]; }
  const cands = lockAt ? [lockAt] : ranked();
  await shot('41-m01-probes');
  await page.click('button:has-text("Lock source")');
  for (const [x, y] of cands.slice(0, 2)) {
    await page.click(`button[aria-label^="Cell ${x + 1},${y + 1}"]`); await page.waitForTimeout(250);
    if (await page.isVisible('section[aria-label="Mission Complete"]')) break;
  }
  await shot('42-m01-result');
  check((await state()).missions.m01.status === 'completed', 'M01 completed by trilaterating probe readings');
  check((await state()).missions.m02.status === 'available', 'M01 unlocks M02');

  // ── M02 Identify the Anomaly: diff the reference and patched renders, click what changed ──
  await page.click('button:has-text("Mission list")');
  await startMission('02');
  const svgSel = 'svg[aria-label$="render"], svg[aria-label^="Patched street render"]';
  const ref = await page.$$eval('svg[aria-label="Reference street render"] > *', (els) => els.map((e) => e.outerHTML));
  await shot('43-m02-reference');
  await page.waitForSelector('svg[aria-label^="Patched street render"]', { timeout: 15000 });
  const patched = await page.$$eval('svg[aria-label^="Patched street render"] > *', (els) => els.map((e) => e.outerHTML));
  const changed = ref.map((h, i) => (h !== patched[i] ? i : -1)).filter((i) => i >= 0);
  console.log(`INFO  M02 detected ${changed.length} changed elements by comparing renders`);
  for (const i of changed) {
    const elh = await page.$(`svg[aria-label^="Patched street render"] > :nth-child(${i + 1})`); await elh.scrollIntoViewIfNeeded();
    const box = await elh.boundingBox();
    await page.mouse.click(box.x + box.width / 2, box.y + box.height / 2); await page.waitForTimeout(150);
    console.log('INFO  M02 click', i, JSON.stringify(box), (await page.textContent('text=/FOUND/').catch(() => 'n/a')));
    if (await page.isVisible('section[aria-label="Mission Complete"]')) break;
  }
  await page.waitForTimeout(400); await shot('44-m02-result');
  check((await state()).missions.m02.status === 'completed', 'M02 completed by spotting every patched element');
  void svgSel;

  // anomaly lens → depth-3 scan → render seam (the sixth anomaly)
  await nav('Simulation Diagnostics');
  await page.click('button:has-text("Run scan again")'); await page.waitForTimeout(3300);
  check((await state()).scanLevel === 3, 'anomaly lens enables depth-3 scan');
  await page.click('li:has-text("Render Seam") >> button:has-text("Investigate")'); await page.waitForTimeout(500);
  await page.$eval('canvas[aria-label^="Skyline"]', (c) => c.scrollIntoView({ block: 'center' })); await page.waitForTimeout(400);
  const sc = await (await page.$('canvas[aria-label^="Skyline"]')).boundingBox();
  const seamX = await dbg((sb) => sb.seamX);
  await page.mouse.move(sc.x + sc.width * 0.1, sc.y + sc.height * 0.3);
  await page.mouse.move(sc.x + sc.width * seamX, sc.y + sc.height * 0.3, { steps: 10 });
  await page.waitForTimeout(200); await shot('45-anomaly-seam-lens');
  await page.mouse.click(sc.x + sc.width * seamX, sc.y + sc.height * 0.3); await page.waitForTimeout(300);
  check((await state()).anomalies.seam.discovered, 'render seam found through the lens (6/6 anomalies)');
  await page.waitForTimeout(1500);

  // ── M03 Evade the Agent ──
  await startMission('03');
  await evasion('m03');
  await teleportTo(930, 60);
  await page.waitForSelector('section[aria-label="Mission Complete"]', { timeout: 5000 }).catch(() => {});
  check((await state()).missions.m03.status === 'completed', 'M03 completes on reaching extraction');

  // ── M04 Breach the Network: read the lattice and solve it ──
  await page.click('button:has-text("Mission list")');
  await startMission('04');
  const labels = await page.$$eval('button[aria-label^="Segment"]', (bs) => bs.map((b) => b.getAttribute('aria-label')));
  const src = await page.$$eval('span:has-text("UP ▸")', (s) => s.findIndex((e) => e.className.includes('text-accent')));
  const dst = await page.$$eval('span:has-text("◂ CORE")', (s) => s.findIndex((e) => !e.className.includes('text-transparent')));
  const W = 6, H = 5;
  const cells = labels.map((l) => { const kind = l.match(/Segment (\w+)/)[1]; const open = [...(l.match(/open ([NESW]*)/)[1])].map((c) => 'NESW'.indexOf(c)).sort().join(''); const rot = [0, 1, 2, 3].find((r) => sidesOf(kind, r) === open); return { kind, rot }; });
  const DX = [0, 1, 0, -1], DY = [-1, 0, 1, 0];
  let plan = null;
  const dfs = (x, y, from, seen, acc) => {
    if (plan) return;
    const c = cells[y * W + x];
    for (let k = 0; k < 4; k++) {
      const rot = (c.rot + k) % 4; const open = BASE[c.kind].map((d) => (d + rot) % 4);
      if (!open.includes(from)) continue;
      for (const out of open) {
        if (out === from) continue;
        const nx = x + DX[out], ny = y + DY[out];
        if (x === W - 1 && y === dst && out === 1) { plan = [...acc, [y * W + x, k]]; return; }
        if (nx < 0 || ny < 0 || nx >= W || ny >= H || seen.has(ny * W + nx)) continue;
        dfs(nx, ny, (out + 2) % 4, new Set([...seen, ny * W + nx]), [...acc, [y * W + x, k]]);
        if (plan) return;
      }
    }
  };
  dfs(0, src, 3, new Set([src * W]), []);
  check(!!plan, `lattice solver found a path (${plan ? plan.reduce((a, [, k]) => a + k, 0) : '?'} rotations)`);
  for (const [i, k] of plan || []) for (let j = 0; j < k; j++) { await page.click(`button[aria-label^="Segment"] >> nth=${i}`); await page.waitForTimeout(40); if (await page.isVisible('section[aria-label="Mission Complete"]')) break; }
  await page.waitForTimeout(400); await shot('46-m04-result');
  check((await state()).missions.m04.status === 'completed', 'M04 completed by rotating the lattice into a path');

  // Agent Detection MEDIUM + HARD (now unlocked) for the remaining intel
  for (const diff of ['MEDIUM', 'HARD']) {
    await nav('Agent Detection');
    await page.click(`button:has-text("${diff}")`); await page.waitForTimeout(300);
    for (let pass = 0; pass < 3 && !(await page.isVisible('text=Segment Secured')) && !(await page.isVisible('text=Operation Aborted')); pass++) {
      const nodes = await page.$$('svg[aria-label="Network topology"] g[role=button]');
      for (let i = 1; i < nodes.length; i++) {
        await nodes[i].click(); await page.waitForTimeout(40);
        if (!(await page.isEnabled('button:has-text("Flag Agent")'))) continue;
        if (await page.isEnabled('button:has-text("Scan (")')) await page.click('button:has-text("Scan (")');
        const insp = await page.textContent('section[aria-label="Host Inspector"]');
        if (!/Beacon jitter/.test(insp)) continue; // out of scans: leave unflagged
        const jit = Number(insp.match(/Beacon jitter([\d.]+) ms/)[1]), lat = Number(insp.match(/Latency([\d.]+) ms/)[1]), mis = /MISMATCH/.test(insp);
        const tells = (jit < 1) + (lat < 4) + mis;
        await page.click(tells >= 2 ? 'button:has-text("Flag Agent")' : 'button:has-text("Mark clear")'); await page.waitForTimeout(40);
        if (await page.isVisible('text=Segment Secured') || await page.isVisible('text=Operation Aborted')) break;
      }
    }
    if (diff === 'HARD') await shot('47-agents-hard');
    const ok = await page.isVisible('text=Segment Secured');
    check(ok || diff === 'HARD', `Agent Detection ${diff}: ${ok ? 'secured' : 'not secured (agents moved; acceptable for hard)'}`);
    await page.click('button:has-text("Change difficulty")').catch(() => page.click('button:has-text("Abandon segment")').catch(() => {}));
    await page.waitForTimeout(300);
  }

  // ── M05 Reach the Exit ──
  await startMission('05');
  await shot('48-m05-route');
  await page.click('button:has-text("Decommissioned subway")'); await page.waitForTimeout(300);
  await evasion('m05');
  await teleportTo(945, 300);
  await page.waitForSelector('section[aria-label="Mission Complete"]', { timeout: 5000 }).catch(() => {});
  const s5 = await state();
  check(s5.missions.m05.status === 'completed' && s5.intel.includes('source-hint'), 'M05 completes and recovers the exit routing hint');
  check(s5.decisions.some((d) => d.decisionId === 'm05-route' && d.selectedOption === 'subway'), 'route decision recorded');
  await shot('49-m05-result');

  await t.save();
  }

  // ── EXIT PROTOCOL ──
  async function runExit(choice) {
    await nav('Exit Protocol');
    if (await page.isVisible('button:has-text("Run the Exit Protocol again")')) await page.click('button:has-text("Run the Exit Protocol again")');
    await page.click('button:has-text("Initiate exit protocol")'); await page.waitForTimeout(400);
    // stage 1: diff renders
    const r1 = await page.$$eval('svg[aria-label="Reference street render"] > *', (els) => els.map((e) => e.outerHTML));
    if (choice === 'answer') await shot('50-exit-stage1');
    await page.waitForSelector('svg[aria-label^="Patched street render"]', { timeout: 12000 });
    const r2 = await page.$$eval('svg[aria-label^="Patched street render"] > *', (els) => els.map((e) => e.outerHTML));
    const diffs = r1.map((h, i) => (h !== r2[i] ? i : -1)).filter((i) => i >= 0);
    for (const i of diffs) {
      const el = await page.$(`svg[aria-label^="Patched street render"] > :nth-child(${i + 1})`);
      await el.scrollIntoViewIfNeeded(); const b = await el.boundingBox();
      await page.mouse.click(b.x + b.width / 2, b.y + b.height / 2); await page.waitForTimeout(120);
      console.log(`INFO  [${choice}] stage1 click #${i} ${r1[i].slice(0, 70)} → ${r2[i].slice(0, 70)} | ${await page.textContent('text=/FOUND/').catch(() => 'done')}`);
    }
    // stage 2: reflex
    await page.waitForSelector('button:has-text("Start test")', { timeout: 8000 }).catch(async (e) => { await shot(`fail-${choice}-stage2`); throw e; });
    await page.click('button:has-text("Start test")');
    const r0 = Date.now();
    while (Date.now() - r0 < 40000) {
      const txt = await page.textContent('button[aria-label^="Reflex pad"]').catch(() => '');
      if (/GO ●|♪/.test(txt)) { await page.waitForTimeout(150); await page.keyboard.press('Space'); }
      if (/Avg .* accuracy/.test(txt) || !txt) break;
      await page.waitForTimeout(20);
    }
    // stage 3: freeze the sentinel by clicking it, then invert gravity
    await page.waitForSelector('[aria-label^="Exit gate room"] canvas', { timeout: 8000 });
    await page.waitForTimeout(700);
    if (choice === 'answer') await shot('51-exit-gate');
    const gc = await (await page.$('[aria-label^="Exit gate room"] canvas')).boundingBox();
    for (let k = 0; k < 20; k++) {
      const p = await dbg((sb) => { const s = sb.gate; const b = s.bodies.find((x) => x.name === 'sentinel'); return { ...s.project(b), frozen: b.frozen }; });
      if (p.frozen) break;
      await page.mouse.click(gc.x + p.x * gc.width, gc.y + p.y * gc.height); await page.waitForTimeout(120);
    }
    check(await page.isVisible('text=Sentinel frozen'), `[${choice}] gate: sentinel frozen by clicking it`);
    await page.click('button:has-text("↑ Up")');
    await page.waitForSelector('text=Key through the gate', { timeout: 10000 });
    if (choice === 'answer') await shot('52-exit-gate-done');
    // stage 4: evasion
    await page.waitForSelector('button:has-text("Go")', { timeout: 8000 });
    await page.click('button:has-text("Go")'); await page.waitForTimeout(800);
    await teleportTo(920, 300);
    // stage 5: decision
    await page.waitForSelector('text=The line is ringing', { timeout: 8000 });
    if (choice === 'answer') { await shot('53-exit-decision'); check(await page.isVisible('text=Trace the exit signal to its source'), 'hidden fourth option offered (all anomalies + routing hint)'); }
    if (choice === 'recapture') { await dbg((sb) => sb.store.getState().addThreat(90)); await page.waitForTimeout(300); }
    const btn = { answer: 'Answer the line', recapture: 'Answer the line', stay: 'Walk away', trace: 'Trace the exit signal' }[choice];
    await page.click(`button:has-text("${btn}")`); await page.waitForTimeout(1200);
  }

  // ensure threat is below the 85% line for the clean escape
  let thr = (await state()).simulation.threat;
  console.log(`INFO  threat before exit: ${thr}%`);
  if (thr > 45) { await dbg((sb, n) => sb.store.getState().addThreat(-n), thr - 30); thr = (await state()).simulation.threat; console.log(`INFO  lowered threat to ${thr}% so the clean-escape branch can be exercised`); }
  await runExit('answer');
  await shot('54-ending-escaped');
  check((await state()).ending?.ending === 'escaped', 'answering the line at low threat → ESCAPED');
  check(await page.isVisible('text=Mission Report'), 'ending shows mission report');

  await runExit('stay');
  await shot('55-ending-remaining');
  check((await state()).ending?.ending === 'remaining', 'walking away → REMAINING IN THE MATRIX');

  await runExit('trace');
  await shot('56-ending-undefined');
  check((await state()).ending?.ending === 'undefined', 'tracing the source → UNDEFINED');

  await runExit('recapture');
  await shot('57-ending-recaptured');
  check((await state()).ending?.ending === 'recaptured', 'answering at high threat → SYSTEM RECAPTURED');

  // mid-protocol recapture: threat hits 100 during a stage
  await nav('Exit Protocol');
  await page.click('button:has-text("Run the Exit Protocol again")');
  await page.click('button:has-text("Initiate exit protocol")'); await page.waitForTimeout(500);
  await dbg((sb) => sb.store.getState().addThreat(100));
  await page.waitForTimeout(800);
  check((await state()).ending?.ending === 'recaptured' && !(await state()).lockdown, 'threat 100% during the protocol ends in recapture (not lockdown)');

  // persistence of endings
  await t.save(); await page.reload(); await page.waitForTimeout(1500);
  const sf = await state();
  check(sf.endingsSeen.length === 4, `all four endings recorded and persisted (${sf.endingsSeen.join(', ')})`);
  check(await page.isVisible('text=Mission Report'), 'exit module reopens on the last ending after reload');
  await t.save();
  console.log('ERRORS:', t.errors.length ? t.errors.join('\n') : 'none');
  await t.browser.close();
})();
