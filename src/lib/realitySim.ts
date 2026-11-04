// Small rigid-body sandbox on Three.js with hand-rolled sphere physics.
// Every rule is a variable the user can rewrite: gravity, time, bounce, drag.
import * as THREE from 'three';

export type EnvId = 'room' | 'urban' | 'construct';
export type BodyKind = 'box' | 'sphere' | 'ico' | 'oct' | 'tetra';

export interface Body {
  id: number;
  kind: BodyKind;
  mesh: THREE.Object3D;
  hit: THREE.Mesh;
  mat: THREE.LineBasicMaterial;
  vel: THREE.Vector3;
  ang: THREE.Vector3;
  r: number;
  frozen: boolean;
  fixed: boolean; // scripted bodies (e.g. a sentinel) are not moved by physics
  ghost?: boolean; // excluded from body-body collisions (game logic handles contact)
  color: number;
  name?: string;
}

const HALF = 6; // room half-size
const GEO: Record<BodyKind, () => THREE.BufferGeometry> = {
  box: () => new THREE.BoxGeometry(1.4, 1.4, 1.4),
  sphere: () => new THREE.SphereGeometry(0.8, 12, 8),
  ico: () => new THREE.IcosahedronGeometry(0.85, 0),
  oct: () => new THREE.OctahedronGeometry(0.9, 0),
  tetra: () => new THREE.TetrahedronGeometry(1, 0),
};

export class RealitySim {
  readonly scene = new THREE.Scene();
  readonly bodies: Body[] = [];
  readonly HALF = HALF;
  gravity = new THREE.Vector3(0, -9.8, 0);
  timeScale = 1;
  paused = false;
  bounce = 0.7;
  drag = 0.08;
  env: EnvId = 'room';
  selected: Body | null = null;
  onSelect: (b: Body | null) => void = () => {};
  onStep: (dt: number, rdt: number) => void = () => {};
  onCollide: (speed: number) => void = () => {};

  private renderer: THREE.WebGLRenderer;
  private cam = new THREE.PerspectiveCamera(58, 1, 0.1, 200);
  private envGroup = new THREE.Group();
  private statics: THREE.Box3[] = []; // urban buildings
  private raf = 0;
  private ro: ResizeObserver;
  private yaw = 0.35; private pitch = 0.32; private dist = 17;
  private drag0: { x: number; y: number; yaw: number; pitch: number; moved: number; body: Body | null; plane: THREE.Plane } | null = null;
  private ray = new THREE.Raycaster();
  private nextId = 1;
  private last = performance.now();
  private pinch: number | null = null;
  private pointers = new Map<number, { x: number; y: number }>();

  constructor(private host: HTMLElement) {
    this.renderer = new THREE.WebGLRenderer({ antialias: true, alpha: true });
    this.renderer.setPixelRatio(Math.min(devicePixelRatio, 2));
    const el = this.renderer.domElement;
    el.style.touchAction = 'none'; el.style.width = '100%'; el.style.height = '100%'; el.style.display = 'block';
    el.tabIndex = 0;
    host.append(el);
    this.scene.add(this.envGroup);
    this.setEnvironment('room');
    this.ro = new ResizeObserver(() => this.resize()); this.ro.observe(host);
    this.resize();
    this.bindPointer(el);
    this.raf = requestAnimationFrame(this.frame);
  }

  /* ───── environment ───── */
  setEnvironment(env: EnvId) {
    this.env = env;
    this.envGroup.clear(); this.statics = [];
    const line = (color: number, opacity: number) => new THREE.LineBasicMaterial({ color, transparent: true, opacity });
    if (env === 'room') {
      this.scene.fog = new THREE.Fog(0x020503, 18, 40); this.scene.background = null;
      const g = new THREE.GridHelper(HALF * 2, 12, 0x1b6b36, 0x1b6b36); g.position.y = -HALF; (g.material as THREE.Material).opacity = 0.6; (g.material as THREE.Material).transparent = true;
      const top = g.clone(); top.position.y = HALF;
      const back = g.clone(); back.rotation.x = Math.PI / 2; back.position.set(0, 0, -HALF);
      const left = g.clone(); left.rotation.z = Math.PI / 2; left.position.set(-HALF, 0, 0);
      const right = left.clone(); right.position.x = HALF;
      this.envGroup.add(g, top, back, left, right, new THREE.LineSegments(new THREE.EdgesGeometry(new THREE.BoxGeometry(HALF * 2, HALF * 2, HALF * 2)), line(0x00c853, 0.9)));
    } else if (env === 'urban') {
      this.scene.fog = new THREE.Fog(0x020503, 22, 48); this.scene.background = null;
      const g = new THREE.GridHelper(HALF * 2, 12, 0x1b6b36, 0x07180e); g.position.y = -HALF; this.envGroup.add(g);
      const boxGeo = new THREE.BoxGeometry(1, 1, 1); boxGeo.translate(0, 0.5, 0);
      const edges = new THREE.EdgesGeometry(boxGeo);
      const fill = new THREE.MeshBasicMaterial({ color: 0x020503, polygonOffset: true, polygonOffsetFactor: 1, polygonOffsetUnits: 1 });
      const spots: [number, number, number, number, number][] = [[-4, -4, 2, 6, 2], [3.5, -4, 2.5, 9, 2], [-4, 3, 2.5, 4, 2.5], [4, 3.5, 2, 7, 2], [0, -4.6, 1.6, 3, 1.6]];
      for (const [x, z, w, h, d] of spots) {
        const m = new THREE.Mesh(boxGeo, fill); m.scale.set(w, h, d); m.position.set(x, -HALF, z);
        const l = new THREE.LineSegments(edges, line(0x00c853, 0.85)); l.scale.copy(m.scale); l.position.copy(m.position);
        this.envGroup.add(m, l);
        this.statics.push(new THREE.Box3(new THREE.Vector3(x - w / 2, -HALF, z - d / 2), new THREE.Vector3(x + w / 2, -HALF + h, z + d / 2)));
      }
    } else {
      // minimal construct: an endless pale void
      this.scene.background = new THREE.Color(0xdfe9e2); this.scene.fog = new THREE.Fog(0xdfe9e2, 16, 42);
      const g = new THREE.GridHelper(80, 40, 0xb7c9bd, 0xcad8ce); g.position.y = -HALF; this.envGroup.add(g);
    }
    for (const b of this.bodies) this.tint(b);
  }

  private tint(b: Body) {
    const onLight = this.env === 'construct';
    b.mat.color.set(b.frozen ? (onLight ? 0x2f6fd1 : 0xffffff) : onLight && b.color === 0x00ff41 ? 0x0a6b2a : b.color);
  }

  /* ───── bodies ───── */
  spawn(kind: BodyKind, pos?: THREE.Vector3, opts: { color?: number; name?: string; fixed?: boolean; r?: number } = {}) {
    const geo = GEO[kind]();
    const mat = new THREE.LineBasicMaterial({ color: opts.color ?? 0x00ff41 });
    const mesh = new THREE.LineSegments(new THREE.EdgesGeometry(geo, 1), mat);
    const hit = new THREE.Mesh(geo, new THREE.MeshBasicMaterial({ visible: false }));
    mesh.add(hit);
    mesh.position.copy(pos ?? new THREE.Vector3((Math.random() - 0.5) * 6, HALF - 2, (Math.random() - 0.5) * 6));
    this.scene.add(mesh);
    const b: Body = { id: this.nextId++, kind, mesh, hit, mat, vel: new THREE.Vector3((Math.random() - 0.5) * 2, 0, (Math.random() - 0.5) * 2), ang: new THREE.Vector3(Math.random(), Math.random(), Math.random()), r: opts.r ?? 0.85, frozen: false, fixed: !!opts.fixed, color: opts.color ?? 0x00ff41, name: opts.name };
    hit.userData.body = b;
    this.bodies.push(b); this.tint(b);
    return b;
  }

  remove(b: Body) {
    this.scene.remove(b.mesh);
    b.mesh.traverse((o) => { const m = o as THREE.Mesh; m.geometry?.dispose?.(); });
    this.bodies.splice(this.bodies.indexOf(b), 1);
    if (this.selected === b) this.select(null);
  }

  clearBodies() { for (const b of [...this.bodies]) this.remove(b); }

  select(b: Body | null) {
    if (this.selected) this.selected.mesh.scale.setScalar(1);
    this.selected = b;
    if (b) b.mesh.scale.setScalar(1.12);
    this.onSelect(b);
  }

  setFrozen(b: Body, f: boolean) { b.frozen = f; if (f) b.vel.set(0, 0, 0); this.tint(b); }
  move(b: Body, d: THREE.Vector3) { b.mesh.position.add(d); this.clampBody(b); b.vel.set(0, 0, 0); }
  rotate(b: Body, axis: 'x' | 'y' | 'z', rad: number) { b.mesh.rotation[axis] += rad; }
  launch(b: Body, v: THREE.Vector3) { if (!b.frozen) b.vel.add(v); }
  impulseAll(k = 8) {
    for (const b of this.bodies) if (!b.frozen && !b.fixed) {
      b.vel.add(new THREE.Vector3((Math.random() - 0.5) * k, Math.random() * k * 0.8, (Math.random() - 0.5) * k));
      b.ang.add(new THREE.Vector3(Math.random(), Math.random(), Math.random()).multiplyScalar(3));
    }
  }

  /* ───── physics ───── */
  private clampBody(b: Body) {
    const lim = HALF - b.r;
    const lat = this.env === 'construct' ? 14 : lim;
    b.mesh.position.x = THREE.MathUtils.clamp(b.mesh.position.x, -lat, lat);
    b.mesh.position.z = THREE.MathUtils.clamp(b.mesh.position.z, -lat, lat);
    b.mesh.position.y = THREE.MathUtils.clamp(b.mesh.position.y, -lim, this.env === 'room' ? lim : 18);
  }

  private step(dt: number) {
    const tmp = new THREE.Vector3();
    for (const b of this.bodies) {
      if (b.frozen || b.fixed) continue;
      b.vel.addScaledVector(this.gravity, dt);
      b.vel.multiplyScalar(1 - this.drag * dt);
      b.mesh.position.addScaledVector(b.vel, dt);
      b.mesh.rotation.x += b.ang.x * dt; b.mesh.rotation.y += b.ang.y * dt; b.mesh.rotation.z += b.ang.z * dt;
      const lim = HALF - b.r, lat = this.env === 'construct' ? 14 : lim, top = this.env === 'room' ? lim : 18;
      const p = b.mesh.position;
      const wall = (ax: 'x' | 'y' | 'z', lo: number, hi: number) => {
        if (p[ax] < lo) { p[ax] = lo; if (b.vel[ax] < 0) { if (-b.vel[ax] > 2) this.onCollide(-b.vel[ax]); b.vel[ax] *= -this.bounce; b.ang.multiplyScalar(0.9); } }
        if (p[ax] > hi) { p[ax] = hi; if (b.vel[ax] > 0) { if (b.vel[ax] > 2) this.onCollide(b.vel[ax]); b.vel[ax] *= -this.bounce; } }
      };
      wall('x', -lat, lat); wall('y', -lim, top); wall('z', -lat, lat);
      // urban buildings: push out of the nearest face
      for (const box of this.statics) {
        const c = box.clampPoint(p, tmp); const d = c.distanceTo(p);
        if (d < b.r) {
          const n = d > 1e-4 ? p.clone().sub(c).divideScalar(d) : new THREE.Vector3(0, 1, 0);
          p.addScaledVector(n, b.r - d);
          const vn = b.vel.dot(n); if (vn < 0) { b.vel.addScaledVector(n, -(1 + this.bounce) * vn); if (-vn > 2) this.onCollide(-vn); }
        }
      }
    }
    // sphere-sphere collisions
    for (let i = 0; i < this.bodies.length; i++) for (let j = i + 1; j < this.bodies.length; j++) {
      const a = this.bodies[i], c = this.bodies[j];
      if (a.ghost || c.ghost) continue;
      tmp.subVectors(c.mesh.position, a.mesh.position);
      const d = tmp.length(), min = a.r + c.r;
      if (d <= 0 || d >= min) continue;
      const aFix = a.frozen || a.fixed, cFix = c.frozen || c.fixed;
      if (aFix && cFix) continue;
      tmp.divideScalar(d);
      const push = min - d;
      if (!aFix && !cFix) { a.mesh.position.addScaledVector(tmp, -push / 2); c.mesh.position.addScaledVector(tmp, push / 2); }
      else if (aFix) c.mesh.position.addScaledVector(tmp, push); else a.mesh.position.addScaledVector(tmp, -push);
      const rv = (cFix ? 0 : c.vel.dot(tmp)) - (aFix ? 0 : a.vel.dot(tmp));
      if (rv < 0) {
        const imp = (-(1 + this.bounce) * rv) / ((aFix ? 0 : 1) + (cFix ? 0 : 1));
        if (!aFix) a.vel.addScaledVector(tmp, -imp); if (!cFix) c.vel.addScaledVector(tmp, imp);
        if (-rv > 2) this.onCollide(-rv);
      }
    }
  }

  private frame = (now: number) => {
    this.raf = requestAnimationFrame(this.frame);
    const rdt = Math.min(0.05, (now - this.last) / 1000); this.last = now;
    if (document.hidden) return;
    const dt = this.paused ? 0 : rdt * this.timeScale;
    const n = Math.max(1, Math.ceil(dt / 0.012));
    for (let i = 0; i < n; i++) this.step(dt / n);
    this.onStep(dt, rdt);
    this.cam.position.set(Math.sin(this.yaw) * Math.cos(this.pitch) * this.dist, Math.sin(this.pitch) * this.dist, Math.cos(this.yaw) * Math.cos(this.pitch) * this.dist);
    this.cam.lookAt(0, -0.5, 0);
    this.renderer.render(this.scene, this.cam);
  };

  /* ───── input: drag empty space to orbit, drag a selected body to move it, click to select ───── */
  private pick(e: PointerEvent) {
    const r = this.renderer.domElement.getBoundingClientRect();
    this.ray.setFromCamera(new THREE.Vector2(((e.clientX - r.left) / r.width) * 2 - 1, -((e.clientY - r.top) / r.height) * 2 + 1), this.cam);
    const hits = this.ray.intersectObjects(this.bodies.map((b) => b.hit));
    return hits.length ? (hits[0].object.userData.body as Body) : null;
  }

  private bindPointer(el: HTMLCanvasElement) {
    el.addEventListener('pointerdown', (e) => {
      this.pointers.set(e.pointerId, { x: e.clientX, y: e.clientY });
      if (this.pointers.size === 2) { const [a, b] = [...this.pointers.values()]; this.pinch = Math.hypot(a.x - b.x, a.y - b.y); this.drag0 = null; return; }
      try { el.setPointerCapture(e.pointerId); } catch { /* pointer already released */ }
      const body = this.pick(e);
      const plane = new THREE.Plane(new THREE.Vector3(0, 1, 0), body ? -body.mesh.position.y : 0);
      this.drag0 = { x: e.clientX, y: e.clientY, yaw: this.yaw, pitch: this.pitch, moved: 0, body: body && body === this.selected && !body.fixed ? body : null, plane };
    });
    el.addEventListener('pointermove', (e) => {
      if (this.pointers.has(e.pointerId)) this.pointers.set(e.pointerId, { x: e.clientX, y: e.clientY });
      if (this.pinch != null && this.pointers.size === 2) {
        const [a, b] = [...this.pointers.values()]; const d = Math.hypot(a.x - b.x, a.y - b.y);
        this.dist = THREE.MathUtils.clamp(this.dist * (this.pinch / d), 9, 30); this.pinch = d; return;
      }
      const d = this.drag0; if (!d) return;
      const dx = e.clientX - d.x, dy = e.clientY - d.y;
      d.moved = Math.max(d.moved, Math.hypot(dx, dy));
      if (d.body) {
        const r = el.getBoundingClientRect();
        this.ray.setFromCamera(new THREE.Vector2(((e.clientX - r.left) / r.width) * 2 - 1, -((e.clientY - r.top) / r.height) * 2 + 1), this.cam);
        const p = new THREE.Vector3();
        if (this.ray.ray.intersectPlane(d.plane, p)) { d.body.mesh.position.x = p.x; d.body.mesh.position.z = p.z; d.body.vel.set(0, 0, 0); this.clampBody(d.body); }
      } else {
        this.yaw = d.yaw - dx * 0.006;
        this.pitch = THREE.MathUtils.clamp(d.pitch + dy * 0.004, -0.2, 1.2);
      }
    });
    const up = (e: PointerEvent) => {
      this.pointers.delete(e.pointerId);
      if (this.pointers.size < 2) this.pinch = null;
      const d = this.drag0; this.drag0 = null;
      if (d && d.moved < 6) this.select(this.pick(e));
    };
    el.addEventListener('pointerup', up);
    el.addEventListener('pointercancel', up);
    el.addEventListener('wheel', (e) => { e.preventDefault(); this.dist = THREE.MathUtils.clamp(this.dist + e.deltaY * 0.01, 9, 30); }, { passive: false });
  }

  private resize() {
    const w = this.host.clientWidth, h = this.host.clientHeight || 300;
    this.renderer.setSize(w, h, false);
    this.cam.aspect = w / h; this.cam.fov = w / h < 1 ? 72 : 58; this.cam.updateProjectionMatrix();
  }

  /** Normalised screen position (0..1) of a body, used by tests and tooling. */
  project(b: Body) { const v = b.mesh.position.clone().project(this.cam); return { x: (v.x + 1) / 2, y: (1 - v.y) / 2 }; }

  setView(yaw: number, pitch: number, dist: number) { this.yaw = yaw; this.pitch = pitch; this.dist = dist; }

  destroy() {
    cancelAnimationFrame(this.raf); this.ro.disconnect();
    this.renderer.dispose(); this.renderer.forceContextLoss(); this.renderer.domElement.remove();
  }
}
