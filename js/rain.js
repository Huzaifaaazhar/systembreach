// Background digital rain. Speed is tied to the simulation's time scale so bullet time
// and time dilation visibly slow the world. Colour shifts toward red at high threat.
const GLYPHS = '01ABCDEFHKLMNRSTUVXZ0123456789#$%&*+=<>/\\|:;{}[]';

export function createRain(canvas) {
  const c = canvas.getContext('2d');
  let w = 0, h = 0, size = 18, cols = [], dpr = 1;
  let speed = 1, target = 1, alert = 0, alertTarget = 0, density = 1;
  let last = performance.now(), fadeAcc = 0;

  function resize() {
    dpr = Math.min(window.devicePixelRatio || 1, 2);
    w = canvas.clientWidth; h = canvas.clientHeight;
    canvas.width = w * dpr; canvas.height = h * dpr;
    c.setTransform(dpr, 0, 0, dpr, 0, 0);
    size = w < 600 ? 14 : 18;
    const n = Math.ceil(w / size);
    cols = Array.from({ length: n }, (_, i) => cols[i] || mkCol());
    c.fillStyle = '#000'; c.fillRect(0, 0, w, h);
  }
  function mkCol() {
    return { y: -Math.random() * 60, v: 0.35 + Math.random() * 0.9, on: Math.random() < 0.55 };
  }
  function frame(now) {
    const dt = Math.min(0.05, (now - last) / 1000); last = now;
    speed += (target - speed) * Math.min(1, dt * 4);
    alert += (alertTarget - alert) * Math.min(1, dt * 2);
    fadeAcc += dt * (0.6 + 2.4 * speed);
    if (fadeAcc > 0.05) { c.fillStyle = `rgba(0,0,0,${Math.min(0.3, fadeAcc * 1.6)})`; c.fillRect(0, 0, w, h); fadeAcc = 0; }
    c.font = `${size}px "Share Tech Mono", monospace`;
    const r = Math.round(60 + 195 * alert), g = Math.round(255 - 170 * alert), b = Math.round(140 - 80 * alert);
    for (let i = 0; i < cols.length; i++) {
      const col = cols[i];
      if (!col.on) { if (Math.random() < 0.002 * density) col.on = true; continue; }
      col.y += col.v * speed * dt * 16;
      const row = Math.floor(col.y);
      if (row === col.row) continue; // draw once per cell so glyphs stay crisp
      col.row = row;
      const y = row * size;
      const ch = GLYPHS[(Math.random() * GLYPHS.length) | 0];
      c.fillStyle = '#000';
      c.fillRect(i * size, y - size * 1.85, size, size * 1.05);
      c.fillStyle = `rgba(${r},${g},${b},0.7)`;
      c.fillText(col.prev || ch, i * size, y - size);
      c.fillStyle = '#000';
      c.fillRect(i * size, y - size * 0.85, size, size * 1.05);
      c.fillStyle = `rgba(${Math.min(255, r + 120)},255,${Math.min(255, b + 100)},0.95)`;
      c.fillText(ch, i * size, y);
      col.prev = ch;
      if (y > h + size * 4) { Object.assign(col, mkCol(), { y: 0 }); col.on = Math.random() < 0.6 * density; }
    }
    requestAnimationFrame(frame);
  }
  window.addEventListener('resize', resize);
  resize();
  requestAnimationFrame(frame);

  return {
    setSpeed(s) { target = s; },
    setAlert(a) { alertTarget = Math.max(0, Math.min(1, a)); },
    setDensity(d) { density = d; },
  };
}
