const { chromium } = require('playwright');
(async () => {
  const b = await chromium.launch({ args: ['--use-gl=swiftshader', '--enable-webgl', '--ignore-gpu-blocklist'] });
  const p = await b.newPage({ viewport: { width: 1440, height: 900 } });
  const errs = [];
  p.on('console', (m) => { if (m.type() === 'error') errs.push(m.text()); });
  p.on('pageerror', (e) => errs.push('PAGEERR ' + e.message));
  await p.goto('http://localhost:5173/');
  await p.waitForTimeout(6000);
  await p.screenshot({ path: 'e2e/shots/boot-mid.png' });
  await p.keyboard.press('Escape');
  await p.waitForTimeout(1500);
  await p.screenshot({ path: 'e2e/shots/boot-end.png' });
  await p.click('text=ENTER THE SYSTEM');
  await p.waitForTimeout(1200);
  await p.screenshot({ path: 'e2e/shots/overview.png' });
  console.log('ERRS', errs.join('\n'));
  await b.close();
})();
