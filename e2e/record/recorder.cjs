// Vertical 4K reel recorder.
// Phone-layout viewport (540×960 CSS) at device scale 4 → native 2160×3840 frames via CDP screencast.
// The app clock runs K× slower while recording so every frame is captured; each section can be sped up
// or cut, and frames are placed on one video timeline that the encoder resamples to 30 fps.
const { chromium } = require('playwright');
const fs = require('fs');
const path = require('path');
const { execFileSync } = require('child_process');

const URL = 'http://localhost:5173/';
const FRAMES_ROOT = process.env.FRAMES_ROOT;
const OUT_DIR = process.env.OUT_DIR;
const STATE = path.join(__dirname, 'state.json');
const K = Number(process.env.TIME_K || 6);
const W = 540, H = 960, DSF = 4; // → 2160×3840

const SLOW_TIME = `(() => {
  const K = __K__;
  const pn = performance.now.bind(performance), p0 = pn();
  performance.now = () => p0 + (pn() - p0) / K;
  const dn = Date.now, d0 = dn();
  const ND = Date;
  window.Date = class extends ND { constructor(...a) { if (a.length) super(...a); else super(d0 + (dn() - d0) / K); } static now() { return d0 + (dn() - d0) / K; } };
  const raf = window.requestAnimationFrame.bind(window);
  window.requestAnimationFrame = (cb) => raf(() => cb(performance.now())); // stamp with the slowed clock
  const st = window.setTimeout.bind(window), si = window.setInterval.bind(window);
  window.setTimeout = (f, d, ...a) => st(f, (d || 0) * K, ...a);
  window.setInterval = (f, d, ...a) => si(f, (d || 0) * K, ...a);
})();`;

async function session({ fresh = false } = {}) {
  const browser = await chromium.launch({ args: ['--use-gl=swiftshader', '--enable-webgl', '--ignore-gpu-blocklist', '--hide-scrollbars', `--force-device-scale-factor=${DSF}`] });
  const ctx = await browser.newContext({ viewport: { width: W, height: H }, deviceScaleFactor: DSF, ...(fresh || !fs.existsSync(STATE) ? {} : { storageState: STATE }) });
  await ctx.addInitScript(SLOW_TIME.replace('__K__', String(K)));
  const page = await ctx.newPage();
  page.on('dialog', (d) => d.accept());
  page.on('pageerror', (e) => console.log('PAGEERROR', e.message));
  const cdp = await ctx.newCDPSession(page);
  await cdp.send('Animation.enable');
  await cdp.send('Animation.setPlaybackRate', { playbackRate: 1 / K });

  let frames = [], dir = null, recording = false, vt = 0, prevT = null, speed = 1;
  cdp.on('Page.screencastFrame', async ({ data, metadata, sessionId }) => {
    cdp.send('Page.screencastFrameAck', { sessionId }).catch(() => {});
    if (!recording) { prevT = null; return; }
    if (prevT != null) vt += (metadata.timestamp - prevT) / K / speed;
    prevT = metadata.timestamp;
    const f = path.join(dir, `${String(frames.length).padStart(6, '0')}.jpg`);
    fs.writeFileSync(f, Buffer.from(data, 'base64'));
    frames.push({ f, v: vt });
  });
  const dbg = (fn, arg) => page.evaluate(([f, a]) => (new Function('sb', 'a', `return (${f})(sb, a)`))(window.__sb, a), [fn.toString(), arg]);
  const w = (ms) => page.waitForTimeout(ms * K);
  return {
    browser, ctx, page, dbg, K, w,
    save: () => ctx.storageState({ path: STATE }),
    /** Navigate with the phone drawer. */
    async nav(label) {
      await page.click('button[aria-label="Open navigation"]'); await w(450);
      await page.click(`[role=dialog] nav button:has-text("${label}")`); await w(700);
      await page.evaluate(() => document.querySelector('#workspace > div')?.scrollTo(0, 0));
    },
    /** Click without scrolling the page (keeps the action on camera). */
    tap: (sel) => page.$eval(sel, (el) => el.click()),
    speed(x) { speed = x; },
    pause() { recording = false; },
    resume() { recording = true; },
    async start(name) {
      dir = path.join(FRAMES_ROOT, name); fs.rmSync(dir, { recursive: true, force: true }); fs.mkdirSync(dir, { recursive: true });
      frames = []; vt = 0; prevT = null; speed = 1; recording = true;
      await cdp.send('Page.startScreencast', { format: 'jpeg', quality: 92, maxWidth: W * DSF, maxHeight: H * DSF, everyNthFrame: 1 });
    },
    async stop(name) {
      recording = true; await w(250);
      recording = false;
      await cdp.send('Page.stopScreencast').catch(() => {});
      fs.writeFileSync(path.join(FRAMES_ROOT, `${name}.json`), JSON.stringify(frames));
      console.log(`CAPTURED ${name}: ${frames.length} frames → ${vt.toFixed(1)}s of video`);
    },
  };
}

function encode(name, frames) {
  if (frames.length < 2) throw new Error(`no frames for ${name}`);
  const seq = path.join(FRAMES_ROOT, `${name}-30fps`);
  fs.rmSync(seq, { recursive: true, force: true }); fs.mkdirSync(seq);
  const span = frames[frames.length - 1].v;
  const total = Math.floor(span * 30) + 15;
  let j = 0;
  for (let k = 0; k < total; k++) {
    while (j + 1 < frames.length && frames[j + 1].v <= k / 30) j++;
    fs.symlinkSync(frames[j].f, path.join(seq, `${String(k).padStart(6, '0')}.jpg`));
  }
  const out = path.join(OUT_DIR, `${name}.mp4`);
  execFileSync('ffmpeg', ['-y', '-loglevel', 'error', '-framerate', '30', '-i', path.join(seq, '%06d.jpg'),
    '-vf', `scale=${W * DSF}:${H * DSF}:flags=lanczos,format=yuv420p`,
    '-c:v', 'libx264', '-preset', 'fast', '-crf', '18', '-profile:v', 'high', '-level', '5.2', '-r', '30', '-movflags', '+faststart', out]);
  fs.rmSync(seq, { recursive: true, force: true });
  console.log(`ENCODED ${name}.mp4  ${(total / 30).toFixed(1)}s  ${W * DSF}x${H * DSF}`);
}

module.exports = { session, URL, encode, K };
