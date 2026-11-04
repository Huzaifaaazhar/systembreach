// Pure functions that turn raw game state into the numbers shown on every dashboard.
// Nothing here is decorative: each value is a function of what the user has done.
import { ANOMALY_IDS } from '../data/content';
import type { GameData } from '../store/gameStore';
import type { MissionId } from '../types';

export const clamp = (v: number, a: number, b: number) => Math.max(a, Math.min(b, v));

export const discoveredCount = (s: Pick<GameData, 'anomalies'>) =>
  ANOMALY_IDS.filter((id) => s.anomalies[id]?.discovered).length;

export const leadCount = (s: Pick<GameData, 'anomalies'>) =>
  ANOMALY_IDS.filter((id) => s.anomalies[id]?.lead && !s.anomalies[id]?.discovered).length;

export const missionsCompleted = (s: Pick<GameData, 'missions'>) =>
  (Object.keys(s.missions) as MissionId[]).filter((id) => s.missions[id].status === 'completed').length;

export const trainingCompleted = (s: Pick<GameData, 'records'>) =>
  Object.values(s.records.completed).filter(Boolean).length;

/** How intact the simulation is from the user's point of view. Every crack the user finds lowers it. */
export function realityIntegrity(s: GameData): number {
  let v = 100;
  v -= discoveredCount(s) * 7;
  if (s.pill === 'red') v -= 12;
  if (s.pill === 'blue') v += 6;
  v -= s.abilities.simulationControl * 0.12;
  v -= missionsCompleted(s) * 4;
  v -= s.agentGame.cleared.length * 2;
  if (s.simulation.status === 'escaped') v = 0;
  return Math.round(clamp(v, 0, 100) * 10) / 10;
}

export type AgentThreat = 'DORMANT' | 'OBSERVING' | 'HUNTING' | 'LOCKING ON';
export function agentThreat(threat: number): AgentThreat {
  if (threat < 25) return 'DORMANT';
  if (threat < 50) return 'OBSERVING';
  if (threat < 75) return 'HUNTING';
  return 'LOCKING ON';
}

/** Weighted progress toward leaving the Matrix. */
export function escapeProgress(s: GameData): number {
  let p = 0;
  p += (discoveredCount(s) / ANOMALY_IDS.length) * 15;
  if (s.pill === 'red') p += 10;
  p += (trainingCompleted(s) / 4) * 20;
  p += Math.min(s.agentGame.cleared.length, 3) / 3 * 10;
  p += missionsCompleted(s) * 7;
  if (s.ending?.ending === 'escaped') p += 10;
  return Math.round(clamp(p, 0, 100));
}

export const exitUnlocked = (s: GameData) => s.pill === 'red' && s.missions.m05.status === 'completed';

/** The hidden fourth ending requires the user to have seen every crack and read the routing hint. */
export const undefinedUnlocked = (s: GameData) =>
  discoveredCount(s) === ANOMALY_IDS.length && s.intel.includes('source-hint');

export function currentMissionId(s: GameData): MissionId | null {
  const order: MissionId[] = ['m01', 'm02', 'm03', 'm04', 'm05'];
  return order.find((id) => s.missions[id].status === 'available') ?? null;
}

export const transmissionReady = (s: GameData) => s.pill === null && discoveredCount(s) >= 3;
