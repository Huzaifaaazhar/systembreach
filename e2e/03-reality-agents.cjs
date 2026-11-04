const { open } = require('./helpers.cjs');
(async () => {
  const t = await open();
  const { page, shot, check, state, nav } = t;
  await page.goto(t.URL); await page.waitForTimeout(1500);

  // ───────── REALITY LAB ─────────
  await nav('Reality Manipulation');
  await page.waitForSelector('[role=application] canvas', { timeout: 15000 });
  await page.waitForTimeout(1500);
  await shot('30-reality-room');
  const sim = (fn, arg) => page.evaluate(([f, a]) => (new Function('s', 'a', `return (${f})(s, a)`))(window.__sb.reality, a), [fn.toString(), arg]);
  const avgY = () => sim((s) => s.bodies.reduce((a, b) => a + b.mesh.position.y, 0) / s.bodies.length);

  check(await sim((s) => s.bodies.length) === 6, 'lab starts with 6 objects');
  const y0 = await avgY();
  await page.click('button:has-text("inverted")'); await page.waitForTimeout(1800);
  const y1 = await avgY();
  check(y1 > y0 + 2, `inverted gravity lifts objects (avg y ${y0.toFixed(1)} → ${y1.toFixed(1)})`);
  await shot('31-reality-inverted');
  await page.click('button:has-text("reduced")'); await page.waitForTimeout(300);
  check(await sim((s) => s.gravity.y) === -1.6, 'reduced gravity sets g = -1.6');
  await page.click('button:has-text("zero")'); await page.click('button:has-text("Impulse all")'); await page.waitForTimeout(600);
  const speeds = await sim((s) => s.bodies.map((b) => b.vel.length()));
  check(speeds.some((v) => v > 1), 'zero gravity + impulse sets objects drifting');
  await shot('32-reality-zero-g');

  // time controls
  await page.click('button:has-text("Pause")');
  const p1 = await sim((s) => s.bodies.map((b) => b.mesh.position.toArray()));
  await page.waitForTimeout(700);
  const p2 = await sim((s) => s.bodies.map((b) => b.mesh.position.toArray()));
  check(JSON.stringify(p1) === JSON.stringify(p2), 'pause freezes every object');
  await page.click('button:has-text("Slow")');
  check(await sim((s) => s.timeScale) === 0.25 && await sim((s) => !s.paused), 'slow sets time scale 0.25');
  await page.click('button:has-text("Resume")');
  check(await sim((s) => s.timeScale) === 1, 'resume restores time scale 1');
  await page.click('button:has-text("normal")');

  // spawn, then select by clicking the object in the 3D view
  await page.click('button:has-text("+ sphere")'); await page.waitForTimeout(300);
  check(await sim((s) => s.bodies.length) === 7, 'spawn adds an object');
  await sim((s) => s.select(null));
  await page.click('button:has-text("Pause")'); await page.waitForTimeout(200);
  const canvas = await (await page.$('[role=application] canvas')).boundingBox();
  const target = await sim((s) => { const b = s.bodies[0]; const p = s.project(b); return { id: b.id, ...p }; });
  await page.mouse.click(canvas.x + target.x * canvas.width, canvas.y + target.y * canvas.height);
  await page.waitForTimeout(300);
  check(await sim((s) => s.selected?.id) === target.id, 'clicking an object in 3D selects it');

  // drag the selected object to move it
  const before = await sim((s) => s.selected.mesh.position.toArray());
  const tp = await sim((s) => s.project(s.selected));
  await page.mouse.move(canvas.x + tp.x * canvas.width, canvas.y + tp.y * canvas.height);
  await page.mouse.down(); await page.mouse.move(canvas.x + tp.x * canvas.width + 120, canvas.y + tp.y * canvas.height + 30, { steps: 8 }); await page.mouse.up();
  const after = await sim((s) => s.selected.mesh.position.toArray());
  check(Math.hypot(after[0] - before[0], after[2] - before[2]) > 0.5, 'dragging a selected object moves it');

  // panel controls on the selected object
  const r0 = await sim((s) => s.selected.mesh.rotation.y);
  await page.click('button:has-text("Y +22°")');
  check(Math.abs((await sim((s) => s.selected.mesh.rotation.y)) - r0 - Math.PI / 8) < 1e-6, 'rotate button turns the object 22.5°');
  const py0 = await sim((s) => s.selected.mesh.position.y);
  await page.click('button[aria-label="Move up"]');
  check((await sim((s) => s.selected.mesh.position.y)) > py0, 'move up button raises the object');
  await page.click('button:has-text("Resume")');
  await page.click('button:has-text("Launch up")');
  check((await sim((s) => s.selected.vel.y)) > 5, 'launch changes velocity');
  await page.click('button:has-text("Freeze")');
  check(await sim((s) => s.selected.frozen), 'freeze holds the object');
  await shot('33-reality-selected');
  await page.click('button:has-text("Unfreeze")');
  // keyboard control
  await page.focus('[role=application] canvas');
  const kx = await sim((s) => s.selected.mesh.position.x);
  await page.keyboard.press('KeyD');
  check((await sim((s) => s.selected.mesh.position.x)) > kx, 'keyboard D moves the selected object');
  await page.click('button:has-text("Remove")');
  check(await sim((s) => s.bodies.length) === 6 && await page.isVisible('text=Click an object in the view'), 'remove deletes the object');

  // collisions are observed
  await page.click('button:has-text("Drop from height")'); await page.click('button:has-text("Drop from height")');
  await page.waitForTimeout(2500);
  const col = await page.textContent('text=/COLLISIONS/');
  check(/[1-9]\d* COLLISIONS/.test(col), `collisions are counted (${col.trim()})`);

  // conditions sliders
  await page.$eval('input[aria-label="Bounce"]', (el) => { const set = Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, 'value').set; set.call(el, '1'); el.dispatchEvent(new Event('input', { bubbles: true })); });
  check(await sim((s) => s.bounce) === 1, 'bounce slider changes restitution');

  // environments
  await page.click('button:has-text("Urban")'); await page.waitForTimeout(1200); await shot('34-reality-urban');
  check(await sim((s) => s.env) === 'urban', 'urban environment');
  await page.click('button:has-text("Minimal Construct")'); await page.waitForTimeout(1200); await shot('35-reality-construct');
  check(await sim((s) => s.env) === 'construct', 'minimal construct environment');

  // performance under load: 24 objects, measure frame rate
  for (let i = 0; i < 18; i++) await page.click('button:has-text("+ box")');
  await page.waitForTimeout(500);
  const fps = await page.evaluate(() => new Promise((res) => { let n = 0; const t0 = performance.now(); const f = () => { n++; if (performance.now() - t0 < 3000) requestAnimationFrame(f); else res(Math.round(n / 3)); }; requestAnimationFrame(f); }));
  console.log(`INFO  frame rate with ${await sim((s) => s.bodies.length)} objects + rain (software GL): ${fps} fps`);

  await page.click('button:has-text("Reset environment")'); await page.waitForTimeout(400);
  check(await sim((s) => s.env === 'room' && s.bodies.length === 6 && s.gravity.y === -9.8 && s.timeScale === 1 && !s.paused), 'reset restores the default environment');
  const s1 = await state();
  check(s1.realityActions >= 5 && s1.abilities.simulationControl > 0, `manipulations recorded (${s1.realityActions} actions, control ${s1.abilities.simulationControl})`);

  // ───────── AGENT DETECTION (EASY) ─────────
  await nav('Agent Detection');
  await shot('36-agents-intro');
  check(await page.isDisabled('button:has-text("MEDIUM")'), 'medium difficulty locked before Mission 01');
  await page.click('button:has-text("EASY")'); await page.waitForTimeout(500);
  const nodes = await page.$$('svg[aria-label="Network topology"] g[role=button]');
  let flagged = 0;
  for (let i = 1; i < nodes.length; i++) {
    await nodes[i].click(); await page.waitForTimeout(80);
    if (await page.isVisible('button:has-text("Scan (")') && await page.isEnabled('button:has-text("Scan (")')) await page.click('button:has-text("Scan (")');
    await page.waitForTimeout(80);
    const insp = await page.textContent('section[aria-label="Host Inspector"]');
    const tells = Number((insp.match(/(\d) of 3 tells/) || [0, 0])[1]);
    if (i === 3) await shot('37-agents-inspect');
    if (await page.isEnabled('button:has-text("Flag Agent")')) { await page.click(tells >= 2 ? 'button:has-text("Flag Agent")' : 'button:has-text("Mark clear")'); flagged++; }
    await page.waitForTimeout(80);
    if (await page.isVisible('text=Segment Secured')) break;
  }
  await shot('38-agents-result');
  const s2 = await state();
  check(s2.agentGame.cleared.includes('easy') && s2.agentGame.wrong === 0, `easy segment secured by applying the tell rule (${s2.agentGame.correct} isolated, ${s2.agentGame.wrong} mistakes)`);
  check(s2.intel.includes('agent-tells-1'), 'agent detection unlocks intelligence');

  // a deliberate wrong flag raises threat
  await page.click('button:has-text("New segment")'); await page.waitForTimeout(300);
  const th0 = (await state()).simulation.threat;
  const n2 = await page.$$('svg[aria-label="Network topology"] g[role=button]');
  for (let i = 1; i < n2.length; i++) {
    await n2[i].click(); await page.click('button:has-text("Scan (")'); await page.waitForTimeout(60);
    const insp = await page.textContent('section[aria-label="Host Inspector"]');
    if (/0 of 3 tells/.test(insp)) { await page.click('button:has-text("Flag Agent")'); break; }
  }
  await page.waitForTimeout(200);
  check((await state()).simulation.threat > th0, 'false Agent accusation increases threat');
  await page.click('button:has-text("Abandon segment")');
  await t.save();
  console.log('ERRORS:', t.errors.length ? t.errors.join('\n') : 'none');
  await t.browser.close();
})();
