const { open } = require('./helpers.cjs');
(async () => {
  const t = await open({ fresh: true });
  const { page, shot, check, state, nav } = t;
  await page.goto(t.URL);
  await page.waitForTimeout(1200);
  await shot('01-boot-black');
  await page.waitForTimeout(5000);
  await shot('02-boot-typing');
  check(await page.isVisible('text=SKIP'), 'boot shows skip button');
  await page.keyboard.press('Escape');
  await page.waitForSelector('text=ENTER THE SYSTEM', { timeout: 10000 });
  check(await page.isVisible('text=THE SYSTEM IS NOT WHAT IT SEEMS.'), 'boot ends with WAKE UP message');
  await shot('03-boot-end');
  await page.keyboard.press('Enter');
  await page.waitForTimeout(800);
  check(await page.isVisible('text=System Overview'), 'enter lands on System Overview');
  await shot('04-overview-fresh');

  // returning users skip boot
  await t.save(); await page.reload(); await page.waitForTimeout(1500);
  check(!(await page.isVisible('text=SKIP')) && await page.isVisible('text=SIMULATION STATUS'), 'reload skips boot for returning user');

  // command line
  const cmd = async (c) => { await page.fill('input[aria-label="Terminal command"]', c); await page.keyboard.press('Enter'); await page.waitForTimeout(250); };
  await cmd('help'); check(await page.isVisible('text=open <module>'), 'command: help lists commands');
  await cmd('status'); check(await page.isVisible('text=/SIMULATION ACTIVE · INTEGRITY 100/'), 'command: status reflects state');
  await cmd('open training'); check(await page.isVisible('text=/access denied: Training Construct \\[ENCRYPTED\\]/'), 'command: locked module denied');
  await cmd('open identity'); check(await page.isVisible('text=Identity Record'), 'command: open identity navigates');
  await cmd('foo'); check(await page.isVisible("text='foo' not recognised"), 'command: unknown handled');

  // locked module view via nav
  await nav('Training Construct');
  check(await page.isVisible('text=ACCESS DENIED · ENCRYPTED'), 'locked module explains requirement');

  // identity
  await nav('Identity');
  await page.fill('input[maxlength="20"]', 'ghost'); await page.click('text=Save alias');
  await page.click('text=Verify identity');
  await page.waitForTimeout(4000);
  check(await page.isVisible('text=FAILED · INCONSISTENT'), 'identity verification fails with inconsistencies');
  check(await page.isVisible('text=/ABOVE TOLERANCE/'), 'flagged characteristics revealed');
  await shot('05-identity');

  // diagnostics scan
  await nav('Simulation Diagnostics');
  await page.click('button:has-text("Run scan")');
  await page.waitForTimeout(3300);
  await shot('06-diagnostics-scan');
  const s1 = await state();
  check(s1.scanLevel === 1 && s1.anomalies.loop.lead && !s1.anomalies.revisit.lead, 'scan depth 1 reveals first leads only');

  const inv = async (title) => { await page.click(`li:has-text("${title}") >> button:has-text("Investigate")`); await page.waitForTimeout(400); };

  // Clock drift: observe the three clocks and find the one that disagrees
  await inv('Clock Drift');
  let bad = -1;
  for (let i = 0; i < 40 && bad < 0; i++) {
    const times = await page.$$eval('button[aria-label^="Flag "]', (bs) => bs.map((b) => b.querySelector('div').textContent));
    const sec = times.map((x) => { const [h, m, s] = x.split(':').map(Number); return h * 3600 + m * 60 + s; });
    for (let k = 1; k < 3; k++) if (Math.abs(sec[k] - sec[0]) >= 3) bad = k;
    await page.waitForTimeout(500);
  }
  check(bad > 0, `clock drift observed on clock ${bad}`);
  await page.click(`button[aria-label^="Flag "] >> nth=${bad}`);
  await page.waitForTimeout(400);
  await shot('07-anomaly-clock');
  await page.waitForTimeout(1500);

  // Duplicate object: inspect everything, then pick the matching serials
  await inv('Duplicate Object');
  const items = await page.$$('li:has-text("Duplicate Object") ul button');
  for (const b of items) { await b.click(); await page.waitForTimeout(60); await b.click(); await page.waitForTimeout(60); }
  const rows = await page.$$eval('li:has-text("Duplicate Object") ul button', (bs) => bs.map((b) => b.textContent));
  const serials = rows.map((r) => r.match(/AS-\d+/)?.[0]);
  const dupSerial = serials.find((s, i) => s && serials.indexOf(s) !== i);
  const idx = serials.map((s, i) => (s === dupSerial ? i : -1)).filter((i) => i >= 0);
  check(idx.length === 2, `duplicate serial ${dupSerial} found by inspecting`);
  for (const i of idx) { await page.click(`li:has-text("Duplicate Object") ul button >> nth=${i}`); await page.waitForTimeout(100); }
  await page.waitForTimeout(500); await shot('08-anomaly-duplicate'); await page.waitForTimeout(1300);

  // Looping pedestrian: watch positions; the one that snaps back is the loop
  await inv('Looping Pedestrian');
  await page.waitForTimeout(500);
  const box = await (await page.$('canvas[aria-label^="Street crossing"]')).boundingBox();
  // wrong click first (ordinary pedestrian) to exercise feedback
  const pedsNow = await page.evaluate(() => window.__sb.loopPeds.map((p) => ({ x: p.x, y: p.y, loop: p.loop })));
  const normal = pedsNow.find((p) => !p.loop);
  await page.mouse.click(box.x + normal.x * box.width, box.y + normal.y * box.height - 4);
  await page.waitForTimeout(200);
  check(await page.isVisible('text=Ordinary pedestrian'), 'wrong pedestrian gets feedback');
  // click the looper when no other pedestrian is close to it (as a user would wait for a clear shot)
  for (let i = 0; i < 30; i++) {
    const p = await page.evaluate(() => { const ps = window.__sb.loopPeds; const l = ps.find((q) => q.loop); const near = ps.some((q) => !q.loop && Math.hypot(q.x - l.x, q.y - l.y) < 0.09); return { x: l.x, y: l.y, near }; });
    if (p.near) { await page.waitForTimeout(250); continue; }
    await page.mouse.click(box.x + p.x * box.width, box.y + p.y * box.height - 4);
    await page.waitForTimeout(250);
    if (await page.isVisible('text=/Same path every 6.0 seconds/')) break;
  }
  check(await page.isVisible('text=/Same path every 6.0 seconds/'), 'looping pedestrian confirmed');
  await shot('09-anomaly-loop');
  await page.waitForTimeout(1600);

  const s2 = await state();
  check(['clock', 'duplicate', 'loop'].every((k) => s2.anomalies[k].discovered), 'three anomalies confirmed in state');
  check(await page.isVisible('button:has-text("Open transmission")'), 'transmission appears after 3 anomalies');

  // deeper scan now available
  await page.click('button:has-text("Run scan again")'); await page.waitForTimeout(3300);
  check((await state()).scanLevel === 2, 'scan depth 2 unlocked by evidence');

  // Shifting corridor: visit, leave, revisit, compare
  await inv('Shifting Corridor');
  await page.click('button:has-text("Walk in")'); await page.waitForTimeout(200);
  const first = await page.getAttribute('svg[aria-label^="Corridor with"]', 'aria-label');
  await page.click('button:has-text("Leave corridor")'); await page.click('button:has-text("Walk back in")'); await page.waitForTimeout(200);
  const second = await page.getAttribute('svg[aria-label^="Corridor with"]', 'aria-label');
  const answer = first.match(/(\d+) doors/)[1] !== second.match(/(\d+) doors/)[1] ? 'The number of doors' : first.includes('painting') !== second.includes('painting') ? 'The painting on the wall' : 'The ceiling light';
  await page.click(`button:has-text("${answer}")`); await page.waitForTimeout(300);
  check(await page.isVisible('text=/changed between visits/'), `corridor change identified (${answer})`);
  await page.waitForTimeout(1600);

  // Unexplained transmission: tune to the clearest carrier
  await inv('Unexplained Transmission');
  await page.$eval('input[aria-label="Tune frequency"]', (el) => { const set = Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, 'value').set; set.call(el, '98.6'); el.dispatchEvent(new Event('input', { bubbles: true })); });
  await page.waitForTimeout(300); await shot('10-anomaly-tuning');
  for (let i = 0; i < 5; i++) { await page.click('button:has-text("+ 0.1")'); await page.waitForTimeout(80); }
  await page.waitForTimeout(1800);
  check(await page.isVisible('text=Signal locked. Transmission decoded.'), 'transmission tuned and decoded');
  await shot('11-anomaly-transmission');
  await page.waitForTimeout(1500);
  check((await state()).intel.includes('op-channel'), 'transmission unlocks intel');

  // ── pill decision: blue first ──
  await page.click('button:has-text("Open transmission")');
  await page.waitForTimeout(500); await shot('12-transmission');
  await page.click('button:has-text("Skip ▸▸")');
  await page.waitForTimeout(400);
  await shot('13-pill-choice');
  await page.click('button:has-text("BLUE PILL")');
  const hold = await page.$('button[aria-label^="Hold to take"]');
  const hb = await hold.boundingBox();
  await page.mouse.move(hb.x + 20, hb.y + 10); await page.mouse.down(); await page.waitForTimeout(500); await page.mouse.up();
  check((await state()).pill === null, 'releasing early does not commit the choice');
  await page.mouse.down(); await page.waitForTimeout(1700); await page.mouse.up();
  await page.waitForTimeout(4500);
  await shot('14-blue-sequence');
  check((await state()).pill === 'blue', 'blue pill committed to state');
  await page.click('button:has-text("Return to your life")'); await page.waitForTimeout(700);
  await shot('15-blue-interface');
  check(await page.evaluate(() => document.documentElement.dataset.phase) === 'blue', 'interface switches to blue phase');
  await nav('Training Construct');
  check(await page.isVisible('text=ACCESS DENIED · SUPPRESSED'), 'blue pill suppresses advanced modules');
  await t.save(); await page.reload(); await page.waitForTimeout(1500);
  check((await state()).pill === 'blue', 'blue choice persists across reload');

  // ── restart investigation → red ──
  await page.click('button:has-text("Question reality again")');
  await page.waitForTimeout(400);
  await page.click('button:has-text("Skip ▸▸")'); await page.waitForTimeout(300);
  await page.click('button:has-text("RED PILL")');
  const h2 = await (await page.$('button[aria-label^="Hold to take"]')).boundingBox();
  await page.mouse.move(h2.x + 20, h2.y + 10); await page.mouse.down(); await page.waitForTimeout(1700); await page.mouse.up();
  await page.waitForTimeout(2500); await shot('16-red-awakening');
  await page.waitForTimeout(2500);
  await shot('17-red-modules');
  const s3 = await state();
  check(s3.pill === 'red' && s3.simulation.resistanceConnection && s3.missions.m01.status === 'available', 'red pill: resistance link + mission unlocked');
  check(s3.decisions.map((d) => d.selectedOption).join(',') === 'blue,question-again,red', 'decision history recorded');
  await page.click('button:has-text("Enter the Construct")'); await page.waitForTimeout(700);
  check(await page.evaluate(() => document.documentElement.dataset.phase) === 'red', 'interface switches to awakened phase');
  check(await page.isVisible('text=Training Construct'), 'lands in Training Construct');
  await shot('18-training-construct');
  await t.save();
  console.log('ERRORS:', t.errors.length ? t.errors.join('\n') : 'none');
  await t.browser.close();
})();
