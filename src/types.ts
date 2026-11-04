export type ModuleId =
  | 'overview'
  | 'identity'
  | 'diagnostics'
  | 'training'
  | 'agents'
  | 'missions'
  | 'reality'
  | 'exit';

export type Pill = 'red' | 'blue' | null;

export type AnomalyId = 'loop' | 'clock' | 'duplicate' | 'revisit' | 'transmission' | 'seam';

export type MissionId = 'm01' | 'm02' | 'm03' | 'm04' | 'm05';
export type MissionStatus = 'locked' | 'available' | 'completed';

export type TrainingId = 'combat' | 'bullet' | 'reflex' | 'movement';
export type Difficulty = 'easy' | 'medium' | 'hard';
export type EndingId = 'escaped' | 'recaptured' | 'remaining' | 'undefined';
export type AlertLevel = 'info' | 'warn' | 'agent' | 'success';

export interface UserProfile {
  id: string;
  username: string;
  createdAt: number;
  bootComplete: boolean;
}

export interface SimulationState {
  status: 'active' | 'stable' | 'compromised' | 'escaped' | 'recaptured';
  threat: number; // 0..100
  resistanceConnection: boolean;
}

export interface AnomalyState {
  lead: boolean; // revealed by a diagnostic scan
  discovered: boolean; // confirmed by the user through its interaction
  discoveredAt?: number;
}

export interface MissionState {
  status: MissionStatus;
  score: number;
  bestTime: number | null; // ms
  attempts: number;
}

export interface MissionResult {
  missionId: MissionId;
  completionStatus: 'success' | 'failure';
  score: number;
  completionTime: number; // ms
  at: number;
}

export interface PlayerAbilities {
  bulletTime: number; // all 0..100
  reflexScore: number;
  movementSkill: number;
  simulationControl: number;
  combat: number;
}

export interface TrainingRecords {
  reflexBestMs: number | null;
  reflexHistory: { avgMs: number; accuracy: number; at: number }[];
  combatBest: number;
  bulletBest: number;
  bulletReactionMs: number | null;
  movementLevel: number; // highest level cleared
  completed: Partial<Record<TrainingId, boolean>>;
}

export interface UserDecision {
  decisionId: string;
  selectedOption: string;
  consequences: string[];
  at: number;
}

export interface SystemAlert {
  id: string;
  level: AlertLevel;
  text: string;
  at: number;
}

export interface EndingReport {
  ending: EndingId;
  at: number;
  threat: number;
  integrity: number;
  missionsCompleted: number;
  anomaliesFound: number;
  intel: number;
  abilities: PlayerAbilities;
  exitScore: number;
  timeline: string[];
}
