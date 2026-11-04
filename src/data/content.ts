import type { AnomalyId, MissionId, ModuleId, TrainingId } from '../types';

export const MODULES: { id: ModuleId; label: string; code: string; requiresRed?: boolean }[] = [
  { id: 'overview', label: 'System Overview', code: 'SYS.00' },
  { id: 'identity', label: 'Identity', code: 'ID.01' },
  { id: 'diagnostics', label: 'Simulation Diagnostics', code: 'DX.02' },
  { id: 'training', label: 'Training Construct', code: 'TC.03', requiresRed: true },
  { id: 'agents', label: 'Agent Detection', code: 'AG.04', requiresRed: true },
  { id: 'missions', label: 'Infiltration Missions', code: 'IM.05', requiresRed: true },
  { id: 'reality', label: 'Reality Manipulation', code: 'RM.06', requiresRed: true },
  { id: 'exit', label: 'Exit Protocol', code: 'EX.07', requiresRed: true },
];

export const ANOMALIES: Record<
  AnomalyId,
  { title: string; location: string; difficulty: 1 | 2 | 3; scanLevel: 1 | 2 | 3; lead: string; description: string }
> = {
  loop: {
    title: 'Looping Pedestrian',
    location: 'Halvorsen St. crossing',
    difficulty: 1,
    scanLevel: 1,
    lead: 'Crowd telemetry repeats on a fixed cycle at one crossing.',
    description: 'One pedestrian at the crossing replays an identical 6-second path. When the cycle ends they snap back to their start point.',
  },
  clock: {
    title: 'Clock Drift',
    location: 'Apartment 1207 / office / handset',
    difficulty: 1,
    scanLevel: 1,
    lead: 'Three synchronised time sources disagree with each other.',
    description: 'One of your three clocks keeps losing a few seconds, then jumps back as if the world had been rolled back to a checkpoint.',
  },
  duplicate: {
    title: 'Duplicate Object',
    location: 'Kitchen / Office desk',
    difficulty: 2,
    scanLevel: 1,
    lead: 'Two objects share one asset serial in different rooms.',
    description: 'The same mug instance exists in two places at once. The asset table reuses a single serial instead of creating a copy.',
  },
  revisit: {
    title: 'Shifting Corridor',
    location: 'Floor 12, corridor B',
    difficulty: 2,
    scanLevel: 2,
    lead: 'A location regenerates differently on every visit.',
    description: 'Corridor B is not stored anywhere. It is regenerated each time you walk into it, and the generator seed is not stable.',
  },
  transmission: {
    title: 'Unexplained Transmission',
    location: 'Carrier band 88–108',
    difficulty: 2,
    scanLevel: 2,
    lead: 'An unregistered carrier is hiding in broadcast noise.',
    description: 'There is a signal tucked between broadcast stations. When you tune it in exactly, it resolves into a message addressed to you.',
  },
  seam: {
    title: 'Render Seam',
    location: 'Skyline, east sector',
    difficulty: 3,
    scanLevel: 3,
    lead: 'Anomaly lens detects a texture boundary in the sky.',
    description: 'The sky is two textures stitched together badly. The seam is only visible through the anomaly lens.',
  },
};

export const ANOMALY_IDS = Object.keys(ANOMALIES) as AnomalyId[];

export interface MissionDef {
  id: MissionId;
  title: string;
  briefing: string;
  target: string;
  objectives: string[];
  difficulty: 1 | 2 | 3 | 4 | 5;
  tools: string[];
  completion: string;
  reward: string;
}

export const MISSIONS: MissionDef[] = [
  {
    id: 'm01',
    title: 'Trace the Signal',
    briefing: 'Someone inside the simulation has been broadcasting on a dead carrier. The resistance needs the source before the machines silence it.',
    target: 'Unregistered transmitter, downtown grid',
    objectives: ['Place directional probes on the grid', 'Triangulate the source from signal strength', 'Lock the transmitter within the probe budget'],
    difficulty: 1,
    tools: ['Directional probe ×7', 'Signal strength meter'],
    completion: 'Lock onto the exact source cell before running out of probes.',
    reward: 'INTEL: Operator channel. Agent Detection MEDIUM difficulty.',
  },
  {
    id: 'm02',
    title: 'Identify the Anomaly',
    briefing: 'A city block is being patched live. Compare two renders of the same block and find what the system changed.',
    target: 'Block 7, Halvorsen St.',
    objectives: ['Memorise the reference render', 'Inspect the patched render', 'Flag every changed element before the patch is committed'],
    difficulty: 2,
    tools: ['Render snapshot', 'Anomaly lens'],
    completion: 'Flag all altered elements with at most two false flags, before time runs out.',
    reward: 'Anomaly lens (reveals a hidden anomaly in Diagnostics).',
  },
  {
    id: 'm03',
    title: 'Evade the Agent',
    briefing: 'An Agent has taken over a pedestrian near your position. Get through the blocks to the hardline before the sweep closes.',
    target: 'Hardline terminal, 3 blocks east',
    objectives: ['Stay out of Agent sight cones', 'Use bullet time to slip past', 'Reach the extraction point before the timer expires'],
    difficulty: 3,
    tools: ['Bullet time', 'Movement boost'],
    completion: 'Reach extraction. Being caught three times fails the mission.',
    reward: 'Evasion protocol: bullet time lasts 25% longer everywhere.',
  },
  {
    id: 'm04',
    title: 'Breach the Network',
    briefing: 'A protected relay stands between the resistance and the exit routing tables. Reroute its data lattice so a path opens from our node to the core. This is a fictional system: nothing outside this simulation is touched.',
    target: 'Relay lattice ZION-adjacent node 3',
    objectives: ['Rotate lattice segments', 'Connect the uplink to the core', 'Avoid tripping the integrity monitor'],
    difficulty: 4,
    tools: ['Segment rotator', 'Integrity monitor'],
    completion: 'Complete an unbroken path from uplink to core in under 40 rotations.',
    reward: 'Root key: Agent Detection HARD difficulty and exit routing data.',
  },
  {
    id: 'm05',
    title: 'Reach the Exit',
    briefing: 'Exit routing is live. Choose a route using the intelligence you have gathered, then survive the run to the exit point.',
    target: 'Exit point, decommissioned subway',
    objectives: ['Choose a route using gathered intel', 'Survive the Agent sweep on that route', 'Confirm the exit point for the Exit Protocol'],
    difficulty: 5,
    tools: ['Intel', 'Bullet time', 'Movement boost'],
    completion: 'Reach the exit point.',
    reward: 'Unlocks EXIT PROTOCOL.',
  },
];

export const TRAINING: { id: TrainingId; title: string; blurb: string }[] = [
  { id: 'combat', title: 'Combat', blurb: 'Spar with a construct program. Read its tells, then block, dodge and counter.' },
  { id: 'bullet', title: 'Bullet Time', blurb: 'Incoming fire in escalating waves. Slow the simulation and keep moving yourself.' },
  { id: 'reflex', title: 'Reflex', blurb: 'React to random visual and audio signals. Ignore the decoys.' },
  { id: 'movement', title: 'Movement', blurb: 'Run, jump and boost through increasingly hostile geometry.' },
];

export const INTEL: Record<string, string> = {
  'op-channel': 'Operator channel found: resistance broadcasts hide in carrier band 99.1.',
  'agent-tells-1': 'Agents beacon at perfectly regular intervals. Real people never do.',
  'agent-tells-2': 'Agent hosts report latency below what the hardware could physically achieve.',
  'agent-tells-3': 'A possessed host has a signature that does not match its registered owner.',
  'sweep-pattern': 'Agent sweeps start from the north and move clockwise.',
  'subway-dead': 'Rail service on the decommissioned line is never rendered. Agents patrol it less.',
  'exit-routing': 'Exit routing tables recovered. The hardline exit is in the old subway.',
  'source-hint': 'Exit traffic loops back on itself. The exit may be routed somewhere inside the system.',
};
