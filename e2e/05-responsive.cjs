const { open } = require('./helpers.cjs');
(async () => {
  // ───── phone ─────
  const m = await open({ device: 'iPhone 13' });
  const { page, shot, check } = m;
  await page.goto(m.URL); await page.waitForTimeout(1500);
  const overflow = () => page.evaluate(() => {
    const doc = document.documentElement.scrollWidth > innerWidth + 1;
    const ws = document.querySelector('#workspace > div'); const inner = ws ? ws.scrollWidth > ws.clientWidth + 1 : false;
    return doc || inner;
  });
  const go = async (label) => { await page.tap('button[aria-label="Open navigation"]'); await page.waitForTimeout(300); await page.tap(`[role=dialog] nav button:has-text("${label}")`); await page.waitForTimeout(700); };
  check(await page.isVisible('nav[aria-label="Primary"]'), 'phone: bottom navigation visible');
  check(!(await page.isVisible('nav[aria-label="System modules"] >> nth=0')), 'phone: desktop rail hidden');
  await shot('60-m-overview');
  check(!(await overflow()), 'phone: overview has no horizontal overflow');
  for (const [label, name] of [['Identity', 'identity'], ['Simulation Diagnostics', 'diagnostics'], ['Training Construct', 'training'], ['Agent Detection', 'agents'], ['Infiltration Missions', 'missions'], ['Reality Manipulation', 'reality'], ['Exit Protocol', 'exit']]) {
    await go(label);
    if (name === 'reality') await page.waitForTimeout(1500);
    await shot(`61-m-${name}`);
    check(!(await overflow()), `phone: ${name} has no horizontal overflow`);
  }
  // touch controls appear automatically on a coarse pointer
  await page.tap('nav[aria-label="Primary"] button:has-text("Train")'); await page.waitForTimeout(500);
  check(await page.isVisible('[aria-label="Movement joystick"]'), 'phone: joystick shown automatically on touch device');
  await page.tap('button:has-text("Begin round")'); await page.waitForTimeout(1500);
  await shot('62-m-combat-touch');
  // monitor drawer
  await page.tap('button[aria-label="Open system monitor"]'); await page.waitForTimeout(400);
  check(await page.isVisible('[role=dialog][aria-label="System monitor"]'), 'phone: monitor drawer opens');
  await shot('63-m-monitor');
  await page.tap('[role=dialog] button[aria-label="Close"]');
  const fs = await page.evaluate(() => Math.min(...[...document.querySelectorAll('#workspace p, #workspace li, #workspace dd')].filter((e) => e.offsetParent).map((e) => parseFloat(getComputedStyle(e).fontSize))));
  check(fs >= 10, `phone: smallest workspace text ${fs}px`);
  const tiny = await page.evaluate(() => [...document.querySelectorAll('button')].filter((b) => b.offsetParent && !b.closest('[role=grid]') && !b.classList.contains('chip')).filter((b) => { const r = b.getBoundingClientRect(); return r.height < 32; }).length);
  check(tiny === 0, `phone: no primary buttons shorter than 32px (${tiny} found)`);
  console.log('ERRORS (phone):', m.errors.length ? m.errors.join('\n') : 'none');
  await m.browser.close();

  // ───── tablet ─────
  const tb = await open({ viewport: { width: 900, height: 1180 } });
  await tb.page.goto(tb.URL); await tb.page.waitForTimeout(1500);
  check(await tb.page.isVisible('nav[aria-label="System modules"]'), 'tablet: navigation rail visible');
  await tb.page.click('button[aria-label="Collapse navigation"]'); await tb.page.waitForTimeout(300);
  await tb.shot('64-t-collapsed');
  check(await tb.page.isVisible('button[aria-label="Expand navigation"]'), 'tablet: navigation collapses to icons');
  check(!(await tb.page.isVisible('aside[aria-label="System monitor"]')), 'tablet: monitor moves to a drawer');
  await tb.page.click('button[aria-label="Open system monitor"]'); await tb.page.waitForTimeout(300);
  await tb.shot('65-t-monitor');
  await tb.browser.close();

  // ───── keyboard only (desktop) ─────
  const k = await open();
  await k.page.goto(k.URL); await k.page.waitForTimeout(1500);
  for (let i = 0; i < 12; i++) await k.page.keyboard.press('Tab');
  const focused = await k.page.evaluate(() => document.activeElement?.textContent?.trim().slice(0, 40));
  k.check(!!focused, `keyboard: Tab moves focus through the interface (now on "${focused}")`);
  await k.page.focus('nav[aria-label="System modules"] button:has-text("Identity")');
  await k.page.keyboard.press('Enter'); await k.page.waitForTimeout(500);
  k.check(await k.page.isVisible('text=Identity Record'), 'keyboard: Enter on a nav item opens the module');
  // reduced motion
  await k.page.click('button[aria-label="Settings"]');
  await k.page.click('label:has-text("Reduced motion") button');
  k.check(await k.page.evaluate(() => document.documentElement.dataset.reducedMotion) === 'true', 'settings: reduced motion toggles on');
  await k.page.click('label:has-text("Reduced motion") button');
  await k.page.click('label:has-text("Sound effects") button');
  k.check(!(await k.state()).settings.sound, 'settings: sound toggles off');
  await k.page.click('label:has-text("Sound effects") button');
  await k.page.click('button:has-text("Replay boot sequence")'); await k.page.waitForTimeout(800);
  k.check(await k.page.isVisible('text=SKIP'), 'settings: boot sequence can be replayed');
  await k.page.keyboard.press('Escape'); await k.page.waitForSelector('text=ENTER THE SYSTEM'); await k.page.keyboard.press('Enter');
  await k.page.waitForTimeout(500);
  k.check(await k.page.isVisible('text=Identity Record') || await k.page.isVisible('#workspace'), 'boot replay returns to the interface');
  console.log('ERRORS (desktop):', k.errors.length ? k.errors.join('\n') : 'none');
  await k.browser.close();
})();
