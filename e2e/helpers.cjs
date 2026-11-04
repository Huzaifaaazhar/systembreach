// Shared Playwright helpers. Uses the pre-installed playwright; state persists between scripts via storageState.
const { chromium, devices } = require('playwright');
const fs = require('fs');
const path = require('path');
const URL = process.env.SB_URL || 'http://localhost:5173/';
const STATE = path.join(__dirname, 'shots', 'state.json');
fs.mkdirSync(path.join(__dirname, 'shots'), { recursive: true });

async function open({ fresh = false, device = null, viewport = { width: 1440, height: 900 } } = {}) {
  const browser = await chromium.launch({ args: ['--use-gl=swiftshader', '--enable-webgl', '--ignore-gpu-blocklist', '--autoplay-policy=no-user-gesture-required'] });
  const ctx = await browser.newContext({ ...(device ? devices[device] : { viewport }), ...(fresh || !fs.existsSync(STATE) ? {} : { storageState: STATE }) });
  const page = await ctx.newPage();
  const errors = [];
  page.on('console', (m) => { if (m.type() === 'error') errors.push(m.text()); });
  page.on('pageerror', (e) => errors.push('PAGEERROR ' + e.message));
  page.on('dialog', (d) => d.accept());
  const shot = (name) => page.screenshot({ path: path.join(__dirname, 'shots', `${name}.png`) });
  const save = () => ctx.storageState({ path: STATE });
  const store = (fn) => page.evaluate(fn);
  const state = () => page.evaluate(() => { const s = window.__sb.store.getState(); return JSON.parse(JSON.stringify(Object.fromEntries(Object.entries(s).filter(([, v]) => typeof v !== 'function')))); });
  const nav = async (label) => { await page.click(`nav[aria-label="System modules"] button:has-text("${label}")`); await page.waitForTimeout(500); };
  const check = (cond, msg) => { console.log(`${cond ? 'PASS' : 'FAIL'}  ${msg}`); if (!cond) process.exitCode = 1; };
  return { browser, ctx, page, errors, shot, save, store, state, nav, check, URL };
}
module.exports = { open };
