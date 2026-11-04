// Rotating-segment lattice puzzle (Mission 04). Pure logic: generation guarantees a solution.
import { seeded } from './canvas';

// Directions: 0=N 1=E 2=S 3=W. A tile is a set of open sides.
export type Kind = 'straight' | 'elbow' | 'tee' | 'empty';
export interface Cell { kind: Kind; rot: number } // rot: 0..3 quarter turns clockwise
export interface Lattice { w: number; h: number; cells: Cell[]; src: number; dst: number } // src row on the left edge, dst row on the right edge

const BASE: Record<Kind, number[]> = { straight: [0, 2], elbow: [0, 1], tee: [0, 1, 2], empty: [] };
export const openSides = (c: Cell) => BASE[c.kind].map((d) => (d + c.rot) % 4);
const DX = [0, 1, 0, -1], DY = [-1, 0, 1, 0];

/** Which tile kind/rotation connects exactly the given sides (for straight/elbow). */
function fit(sides: number[]): Cell {
  const set = new Set(sides);
  for (const kind of ['straight', 'elbow'] as Kind[]) for (let rot = 0; rot < 4; rot++) {
    const o = BASE[kind].map((d) => (d + rot) % 4);
    if (o.length === set.size && o.every((d) => set.has(d))) return { kind, rot };
  }
  return { kind: 'tee', rot: 0 };
}

export function generateLattice(w = 6, h = 5, seed = Date.now()): { puzzle: Lattice; solution: Lattice } {
  const r = seeded(seed);
  const src = Math.floor(r() * h), dst = Math.floor(r() * h);
  // path: in each column walk vertically to a random row, then step right. Always simple and adjacent.
  const path: [number, number][] = [];
  let y = src;
  for (let x = 0; x < w; x++) {
    const ty = x === w - 1 ? dst : Math.floor(r() * h);
    path.push([x, y]);
    while (y !== ty) { y += Math.sign(ty - y); path.push([x, y]); }
  }
  const cells: Cell[] = Array.from({ length: w * h }, () => {
    const k = r(); return { kind: k < 0.4 ? 'straight' : k < 0.8 ? 'elbow' : 'tee', rot: 0 } as Cell;
  });
  for (let i = 0; i < path.length; i++) {
    const [cx, cy] = path[i];
    const sides: number[] = [];
    const prev = i === 0 ? [-1, src] : path[i - 1];
    const next = i === path.length - 1 ? [w, dst] : path[i + 1];
    for (const [nx, ny] of [prev, next]) for (let d = 0; d < 4; d++) if (cx + DX[d] === nx && cy + DY[d] === ny) sides.push(d);
    cells[cy * w + cx] = fit(sides);
  }
  const solution: Lattice = { w, h, cells: cells.map((c) => ({ ...c })), src, dst };
  const puzzle: Lattice = { w, h, cells: cells.map((c) => ({ ...c, rot: Math.floor(r() * 4) })), src, dst };
  // never hand out an already-solved board
  if (connected(puzzle).solved) puzzle.cells[path[0][1] * w].rot = (puzzle.cells[path[0][1] * w].rot + 1) % 4;
  return { puzzle, solution };
}

/** Flood from the uplink on the left edge; returns powered cells and whether the core is reached. */
export function connected(l: Lattice): { powered: Set<number>; solved: boolean } {
  const powered = new Set<number>();
  const start = l.src * l.w;
  if (!openSides(l.cells[start]).includes(3)) return { powered, solved: false };
  const q = [start]; powered.add(start);
  while (q.length) {
    const i = q.shift()!; const x = i % l.w, y = Math.floor(i / l.w);
    for (const d of openSides(l.cells[i])) {
      const nx = x + DX[d], ny = y + DY[d];
      if (nx < 0 || ny < 0 || nx >= l.w || ny >= l.h) continue;
      const j = ny * l.w + nx;
      if (powered.has(j)) continue;
      if (openSides(l.cells[j]).includes((d + 2) % 4)) { powered.add(j); q.push(j); }
    }
  }
  const end = l.dst * l.w + (l.w - 1);
  return { powered, solved: powered.has(end) && openSides(l.cells[end]).includes(1) };
}
