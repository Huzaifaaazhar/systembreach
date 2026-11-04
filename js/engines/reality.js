// A small wireframe room with hand-rolled physics whose rules can be rewritten:
// gravity vector, time scale, global and per-object freeze, impulses. Chapters 6 and 7.
import * as THREE from 'three';

const HALF = 5;

export function createReality(host, { signal, onFreezeToggle = () => {}, onStep = () => {} } = {}) {
  const renderer = new THREE.WebGLRenderer({ antialias: true, alpha: true });
  renderer.setPixelRatio(Math.min(devicePixelRatio, 2));
  renderer.domElement.style.touchAction = 'none';
  host.append(renderer.domElement);
  const scene = new THREE.Scene();
  scene.fog = new THREE.Fog(0x000000, 10, 26);
  const cam = new THREE.PerspectiveCamera(60, 1, 0.1, 100);

  // room: grid on floor, ceiling, walls (open toward camera)
  const room = new THREE.Group(); scene.add(room);
  const lineMat = new THREE.LineBasicMaterial({ color: 0x4fdc72, transparent: true, opacity: 0.55 });
  const edgeMat = new THREE.LineBasicMaterial({ color: 0x7dff9b });
  function gridPlane(rotX, rotY, pos) {
    const pts = [];
    for (let i = -HALF; i <= HALF; i += 1.25) { pts.push(i, -HALF, 0, i, HALF, 0, -HALF, i, 0, HALF, i, 0); }
    const g = new THREE.BufferGeometry(); g.setAttribute('position', new THREE.Float32BufferAttribute(pts, 3));
    const l = new THREE.LineSegments(g, lineMat); l.rotation.set(rotX, rotY, 0); l.position.copy(pos); room.add(l);
  }
  gridPlane(Math.PI / 2, 0, new THREE.Vector3(0, -HALF, 0));
  gridPlane(Math.PI / 2, 0, new THREE.Vector3(0, HALF, 0));
  gridPlane(0, Math.PI / 2, new THREE.Vector3(-HALF, 0, 0));
  gridPlane(0, Math.PI / 2, new THREE.Vector3(HALF, 0, 0));
  gridPlane(0, 0, new THREE.Vector3(0, 0, -HALF));
  room.add(new THREE.LineSegments(new THREE.EdgesGeometry(new THREE.BoxGeometry(HALF * 2, HALF * 2, HALF * 2)), edgeMat));

  const bodies = [];
  const GEOS = {
    box: () => new THREE.BoxGeometry(1.3, 1.3, 1.3),
    ico: () => new THREE.IcosahedronGeometry(0.85, 0),
    oct: () => new THREE.OctahedronGeometry(0.9, 0),
    dodeca: () => new THREE.DodecahedronGeometry(0.8, 0),
    tetra: () => new THREE.TetrahedronGeometry(1, 0),
  };
  function addBody(type = 'box', { pos, color = 0x7dff9b, r = 0.85, mass = 1, static: st = false, name } = {}) {
    const geo = GEOS[type]();
    const mat = new THREE.LineBasicMaterial({ color });
    const mesh = new THREE.LineSegments(new THREE.EdgesGeometry(geo), mat);
    const hit = new THREE.Mesh(geo, new THREE.MeshBasicMaterial({ visible: false }));
    mesh.add(hit);
    mesh.position.copy(pos || new THREE.Vector3((Math.random() - 0.5) * 6, Math.random() * 3, (Math.random() - 0.5) * 6));
    scene.add(mesh);
    const b = { mesh, hit, vel: new THREE.Vector3((Math.random() - 0.5) * 2, 0, (Math.random() - 0.5) * 2), ang: new THREE.Vector3(Math.random(), Math.random(), Math.random()).multiplyScalar(1.5), frozen: false, r, mass, color, static: st, name };
    hit.userData.body = b;
    bodies.push(b);
    return b;
  }
  function setFrozen(b, f) {
    b.frozen = f;
    b.mesh.material.color.set(f ? 0xffffff : b.color);
    b.mesh.scale.setScalar(f ? 1.08 : 1);
  }

  const S = { g: new THREE.Vector3(0, -9.8, 0), ts: 1, freeze: false };

  // camera orbit (drag) + click to freeze
  let yaw = 0, pitch = 0.05, drag = null;
  const ray = new THREE.Raycaster(); const ndc = new THREE.Vector2();
  const el = renderer.domElement;
  el.addEventListener('pointerdown', (e) => { drag = { x: e.clientX, y: e.clientY, yaw, pitch, moved: 0 }; el.setPointerCapture?.(e.pointerId); });
  el.addEventListener('pointermove', (e) => {
    if (!drag) return;
    const dx = e.clientX - drag.x, dy = e.clientY - drag.y;
    drag.moved = Math.max(drag.moved, Math.hypot(dx, dy));
    yaw = Math.max(-0.9, Math.min(0.9, drag.yaw - dx * 0.005));
    pitch = Math.max(-0.5, Math.min(0.6, drag.pitch + dy * 0.004));
  });
  el.addEventListener('pointerup', (e) => {
    if (drag && drag.moved < 6) {
      const r = el.getBoundingClientRect();
      ndc.set(((e.clientX - r.left) / r.width) * 2 - 1, -((e.clientY - r.top) / r.height) * 2 + 1);
      ray.setFromCamera(ndc, cam);
      const hits = ray.intersectObjects(bodies.map((b) => b.hit));
      if (hits.length) { const b = hits[0].object.userData.body; if (!b.static || b.clickable) { setFrozen(b, !b.frozen); onFreezeToggle(b); } }
    }
    drag = null;
  });

  function resize() {
    const w = host.clientWidth, h = host.clientHeight || 300;
    renderer.setSize(w, h, false); renderer.domElement.style.width = '100%'; renderer.domElement.style.height = '100%';
    cam.aspect = w / h; cam.fov = w / h < 1 ? 78 : 60; cam.updateProjectionMatrix();
  }
  const ro = new ResizeObserver(resize); ro.observe(host);

  const tmp = new THREE.Vector3();
  function physics(dt) {
    for (const b of bodies) {
      if (b.frozen || b.static) continue;
      b.vel.addScaledVector(S.g, dt);
      b.vel.multiplyScalar(1 - 0.08 * dt);
      b.mesh.position.addScaledVector(b.vel, dt);
      b.mesh.rotation.x += b.ang.x * dt; b.mesh.rotation.y += b.ang.y * dt; b.mesh.rotation.z += b.ang.z * dt;
      const lim = HALF - b.r;
      for (const ax of ['x', 'y', 'z']) {
        if (b.mesh.position[ax] < -lim) { b.mesh.position[ax] = -lim; if (b.vel[ax] < 0) { b.vel[ax] *= -0.72; b.ang.multiplyScalar(0.92); } }
        if (b.mesh.position[ax] > lim) { b.mesh.position[ax] = lim; if (b.vel[ax] > 0) b.vel[ax] *= -0.72; }
      }
    }
    // simple sphere-sphere resolution
    for (let i = 0; i < bodies.length; i++) for (let j = i + 1; j < bodies.length; j++) {
      const a = bodies[i], c = bodies[j];
      if (a.static || c.static) continue;
      tmp.subVectors(c.mesh.position, a.mesh.position);
      const d = tmp.length(), min = a.r + c.r;
      if (d > 0 && d < min) {
        tmp.divideScalar(d);
        const aFix = a.frozen, cFix = c.frozen;
        if (aFix && cFix) continue;
        const push = min - d;
        if (!aFix && !cFix) { a.mesh.position.addScaledVector(tmp, -push / 2); c.mesh.position.addScaledVector(tmp, push / 2); }
        else if (aFix) c.mesh.position.addScaledVector(tmp, push); else a.mesh.position.addScaledVector(tmp, -push);
        const rv = (cFix ? 0 : c.vel.dot(tmp)) - (aFix ? 0 : a.vel.dot(tmp));
        if (rv < 0) {
          const imp = -1.7 * rv / ((aFix ? 0 : 1) + (cFix ? 0 : 1));
          if (!aFix) a.vel.addScaledVector(tmp, -imp); if (!cFix) c.vel.addScaledVector(tmp, imp);
        }
      }
    }
  }

  let raf = 0, last = performance.now(), simT = 0;
  function frame(now) {
    raf = requestAnimationFrame(frame);
    const rdt = Math.min(0.05, (now - last) / 1000); last = now;
    const dt = S.freeze ? 0 : rdt * S.ts;
    // substeps for stability
    const n = Math.max(1, Math.ceil(dt / 0.012));
    for (let i = 0; i < n; i++) physics(dt / n);
    simT += dt;
    onStep(dt, rdt, simT);
    cam.position.set(Math.sin(yaw) * 11.5, Math.sin(pitch) * 6, Math.cos(yaw) * 11.5);
    cam.lookAt(0, 0, -1);
    renderer.render(scene, cam);
  }
  resize();
  raf = requestAnimationFrame(frame);

  const destroy = () => { cancelAnimationFrame(raf); ro.disconnect(); renderer.dispose(); renderer.forceContextLoss?.(); };
  signal?.addEventListener('abort', destroy);

  return {
    THREE, scene, bodies, S, HALF, addBody, setFrozen, destroy,
    setGravity(x, y, z) { S.g.set(x, y, z); },
    setTimeScale(t) { S.ts = t; },
    setFreeze(f) { S.freeze = f; },
    impulse(k = 8) {
      for (const b of bodies) if (!b.frozen && !b.static) {
        b.vel.add(new THREE.Vector3((Math.random() - 0.5) * k, Math.random() * k * 0.8, (Math.random() - 0.5) * k));
        b.ang.add(new THREE.Vector3(Math.random(), Math.random(), Math.random()).multiplyScalar(3));
      }
    },
    unfreezeAll() { for (const b of bodies) if (b.frozen) setFrozen(b, false); },
  };
}
