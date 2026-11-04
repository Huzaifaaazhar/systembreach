// Agent-detection network model. Pure logic so it can be unit tested.
import { seeded } from './canvas';
import type { Difficulty } from '../types';

export interface NodeProps {
  beaconJitterMs: number; // Agents beacon with almost no jitter
  latencyMs: number; // Agents report latency below the route's physical floor
  signatureMatch: boolean; // Agents run under a host that is not its registered owner
  uptime: string;
  traffic: string;
}

export interface NetNode {
  id: string;
  label: string;
  x: number;
  y: number;
  agent: boolean;
  props: NodeProps;
  scanned: boolean;
  stale: boolean;
  flag: null | 'agent' | 'clear';
  hub?: boolean;
}

export interface NetEdge { a: string; b: string; suspicious: boolean }
export interface Network { nodes: NetNode[]; edges: NetEdge[]; difficulty: Difficulty; scans: number; agents: number; latencyFloor: number }

export const CONFIG: Record<Difficulty, { nodes: number; agents: number; scans: number; agentTells: number; noiseTells: number; hops: boolean }> = {
  easy: { nodes: 8, agents: 1, scans: 8, agentTells: 3, noiseTells: 0, hops: false },
  medium: { nodes: 12, agents: 2, scans: 10, agentTells: 2, noiseTells: 1, hops: false },
  hard: { nodes: 16, agents: 3, scans: 12, agentTells: 2, noiseTells: 1, hops: true },
};

const HOSTS = ['cafe-wifi', 'office-gw', 'traffic-cam', 'atm-07', 'metro-relay', 'tower-12', 'clinic-db', 'bank-edge', 'hotel-lan', 'radio-stn', 'school-net', 'phone-sw', 'courier-hub', 'police-cad', 'mall-pos', 'library'];

/** Count how many of the three tells a node shows. Two or more means Agent. */
export function tellCount(p: NodeProps, floor: number) {
  return (p.beaconJitterMs < 1 ? 1 : 0) + (p.latencyMs < floor ? 1 : 0) + (!p.signatureMatch ? 1 : 0);
}

export function makeProps(r: () => number, agent: boolean, tells: number, floor: number): NodeProps {
  // choose which tells are present
  const order = [0, 1, 2].sort(() => r() - 0.5).slice(0, tells);
  const has = (i: number) => order.includes(i);
  return {
    beaconJitterMs: has(0) ? +(r() * 0.4).toFixed(2) : +(8 + r() * 60).toFixed(1),
    latencyMs: has(1) ? +(0.2 + r() * (floor - 0.5)).toFixed(2) : +(floor + 2 + r() * 40).toFixed(1),
    signatureMatch: !has(2),
    uptime: `${Math.floor(r() * 300)}d ${Math.floor(r() * 24)}h`,
    traffic: agent ? ['bursty, outbound', 'mirrored to unknown', 'steady'][Math.floor(r() * 3)] : ['bursty', 'steady', 'idle', 'outbound', 'steady'][Math.floor(r() * 5)],
  };
}

export function generateNetwork(difficulty: Difficulty, seed = Date.now()): Network {
  const r = seeded(seed);
  const cfg = CONFIG[difficulty];
  const floor = 4; // ms: physical latency floor for this segment
  const cols = Math.ceil(Math.sqrt(cfg.nodes * 1.7));
  const rows = Math.ceil(cfg.nodes / cols);
  const nodes: NetNode[] = [];
  const agentIdx = new Set<number>();
  while (agentIdx.size < cfg.agents) agentIdx.add(1 + Math.floor(r() * (cfg.nodes - 1)));
  for (let i = 0; i < cfg.nodes; i++) {
    const c = i % cols, rr = Math.floor(i / cols);
    const agent = agentIdx.has(i);
    const noise = !agent && r() < 0.45 ? cfg.noiseTells : 0;
    nodes.push({
      id: `n${i}`,
      label: i === 0 ? 'YOU' : HOSTS[(i - 1) % HOSTS.length],
      x: 8 + (c + 0.5) * (84 / cols) + (r() - 0.5) * 6,
      y: 6 + (rr + 0.5) * (48 / rows) + (r() - 0.5) * 6,
      agent,
      props: makeProps(r, agent, agent ? cfg.agentTells : noise, floor),
      scanned: i === 0, stale: false, flag: i === 0 ? 'clear' : null, hub: i === 0,
    });
  }
  // connect each node to its two nearest neighbours (keeps the graph readable and connected-ish)
  const edges: NetEdge[] = [];
  const has = (a: string, b: string) => edges.some((e) => (e.a === a && e.b === b) || (e.a === b && e.b === a));
  for (const n of nodes) {
    const near = nodes.filter((m) => m !== n).sort((p, q) => Math.hypot(p.x - n.x, p.y - n.y) - Math.hypot(q.x - n.x, q.y - n.y)).slice(0, 2);
    for (const m of near) if (!has(n.id, m.id)) edges.push({ a: n.id, b: m.id, suspicious: false });
  }
  for (let i = 1; i < nodes.length; i++) if (!edges.some((e) => e.a === nodes[i].id || e.b === nodes[i].id)) edges.push({ a: nodes[0].id, b: nodes[i].id, suspicious: false });
  for (const e of edges) {
    const touchesAgent = nodes.find((n) => n.id === e.a)!.agent || nodes.find((n) => n.id === e.b)!.agent;
    e.suspicious = r() < (touchesAgent ? 0.7 : 0.15); // suspicion is evidence, not proof
  }
  return { nodes, edges, difficulty, scans: cfg.scans, agents: cfg.agents, latencyFloor: floor };
}

export const neighbours = (net: Network, id: string) =>
  net.edges.filter((e) => e.a === id || e.b === id).map((e) => (e.a === id ? e.b : e.a));

/**
 * Hard mode: an unflagged Agent may hand off to an adjacent unflagged, non-hub node.
 * Returns [from, to] if a hop happened. The old node's scan data becomes stale.
 */
export function agentHop(net: Network, r: () => number = Math.random): [string, string] | null {
  const candidates = net.nodes.filter((n) => n.agent && n.flag !== 'agent');
  if (!candidates.length) return null;
  const from = candidates[Math.floor(r() * candidates.length)];
  const opts = neighbours(net, from.id).map((id) => net.nodes.find((n) => n.id === id)!).filter((n) => !n.agent && !n.hub && n.flag === null);
  if (!opts.length) return null;
  const to = opts[Math.floor(r() * opts.length)];
  const agentProps = from.props;
  from.agent = false; from.props = makeProps(r, false, 0, net.latencyFloor); from.stale = from.scanned; from.scanned = false;
  to.agent = true; to.props = agentProps; to.stale = to.scanned; to.scanned = false;
  return [from.id, to.id];
}

export const remainingAgents = (net: Network) => net.nodes.filter((n) => n.agent && n.flag !== 'agent').length;
