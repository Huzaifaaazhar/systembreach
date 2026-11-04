// Wireframe city with pulsing red sentinel heat zones (Three.js). Chapter 5 dashboard.
import * as THREE from 'three';

function heatTexture() {
  const c = document.createElement('canvas'); c.width = c.height = 128;
  const g = c.getContext('2d');
  const grd = g.createRadialGradient(64, 64, 0, 64, 64, 64);
  grd.addColorStop(0, 'rgba(255,90,70,1)'); grd.addColorStop(0.35, 'rgba(255,40,30,.55)'); grd.addColorStop(1, 'rgba(255,0,0,0)');
  g.fillStyle = grd; g.fillRect(0, 0, 128, 128);
  return new THREE.CanvasTexture(c);
}

export function createCity(host, { signal } = {}) {
  const renderer = new THREE.WebGLRenderer({ antialias: true, alpha: true });
  renderer.setPixelRatio(Math.min(devicePixelRatio, 2));
  host.append(renderer.domElement);
  const scene = new THREE.Scene();
  scene.fog = new THREE.Fog(0x000000, 18, 46);
  const cam = new THREE.PerspectiveCamera(42, 1, 0.1, 200);
  const green = new THREE.LineBasicMaterial({ color: 0x7dff9b, transparent: true, opacity: 0.85 });
  const greenDim = new THREE.LineBasicMaterial({ color: 0x4fdc72, transparent: true, opacity: 0.35 });
  const city = new THREE.Group(); scene.add(city);

  const N = 12, S = 2.2;
  const box = new THREE.BoxGeometry(1, 1, 1); box.translate(0, 0.5, 0);
  const edges = new THREE.EdgesGeometry(box);
  const fill = new THREE.MeshBasicMaterial({ color: 0x000000, polygonOffset: true, polygonOffsetFactor: 1, polygonOffsetUnits: 1 });
  let seed = 7; const rnd = () => ((seed = (seed * 16807) % 2147483647) / 2147483647);
  for (let i = 0; i < N; i++) for (let j = 0; j < N; j++) {
    const cx = (i - N / 2) * S, cz = (j - N / 2) * S;
    const centre = 1 - Math.hypot(i - N / 2, j - N / 2) / (N * 0.75);
    const blocks = 1 + Math.floor(rnd() * 3);
    for (let b = 0; b < blocks; b++) {
      const w = 0.5 + rnd() * 0.6, d = 0.5 + rnd() * 0.6;
      const hh = 0.3 + Math.pow(rnd(), 2) * 5 * Math.max(0.15, centre);
      const m = new THREE.Mesh(box, fill); m.scale.set(w, hh, d);
      const l = new THREE.LineSegments(edges, hh > 2 ? green : greenDim); l.scale.copy(m.scale);
      const ox = (rnd() - 0.5) * 0.9, oz = (rnd() - 0.5) * 0.9;
      m.position.set(cx + ox, 0, cz + oz); l.position.copy(m.position);
      city.add(m, l);
    }
  }
  const grid = new THREE.GridHelper(N * S + 4, N, 0x4fdc72, 0x1f6b36);
  grid.position.y = 0.01; grid.material.transparent = true; grid.material.opacity = 0.5;
  city.add(grid);

  const tex = heatTexture();
  const heats = [];
  function addHeat(x, z, big = 1) {
    const sp = new THREE.Sprite(new THREE.SpriteMaterial({ map: tex, blending: THREE.AdditiveBlending, depthWrite: false, depthTest: false, transparent: true }));
    sp.position.set(x, 0.6, z); sp.scale.setScalar(3.5 * big);
    sp.userData = { base: 3.5 * big, ph: Math.random() * 6 };
    scene.add(sp); heats.push(sp);
    return sp;
  }
  const me = new THREE.Mesh(new THREE.OctahedronGeometry(0.35), new THREE.MeshBasicMaterial({ color: 0xc8ffd5, wireframe: true }));
  me.position.set(0, 1.2, 0); scene.add(me);

  function resize() {
    const w = host.clientWidth, h = host.clientHeight || 300;
    renderer.setSize(w, h, false); renderer.domElement.style.width = '100%'; renderer.domElement.style.height = '100%';
    cam.aspect = w / h; cam.updateProjectionMatrix();
  }
  const ro = new ResizeObserver(resize); ro.observe(host);

  let raf = 0, t0 = performance.now();
  function frame(now) {
    raf = requestAnimationFrame(frame);
    const t = (now - t0) / 1000;
    const a = t * 0.06 + 0.7;
    cam.position.set(Math.cos(a) * 21, 15, Math.sin(a) * 21);
    cam.lookAt(0, 0, 0);
    for (const h of heats) h.scale.setScalar(h.userData.base * (1 + 0.15 * Math.sin(t * 3 + h.userData.ph)));
    me.rotation.y = t * 2; me.visible = Math.sin(t * 6) > -0.6;
    renderer.render(scene, cam);
  }
  resize();
  raf = requestAnimationFrame(frame);

  const destroy = () => { cancelAnimationFrame(raf); ro.disconnect(); renderer.dispose(); renderer.forceContextLoss?.(); };
  signal?.addEventListener('abort', destroy);
  return {
    addHeat,
    moveMe(x, z) { me.position.x = x; me.position.z = z; },
    heatNear(x, z, spread = 3, n = 1) { for (let i = 0; i < n; i++) addHeat(x + (Math.random() - 0.5) * spread, z + (Math.random() - 0.5) * spread, 0.8 + Math.random() * 0.5); },
    destroy,
  };
}
