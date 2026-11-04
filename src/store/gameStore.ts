// Global game state. Persisted to localStorage so progress survives reloads.
import { create } from 'zustand';
import { persist, createJSONStorage } from 'zustand/middleware';
import { ANOMALIES, ANOMALY_IDS, INTEL, MISSIONS } from '../data/content';
import type {
  AlertLevel, AnomalyId, AnomalyState, Difficulty, EndingReport, MissionId, MissionResult, MissionState,
  ModuleId, Pill, PlayerAbilities, SimulationState, SystemAlert, TrainingId, TrainingRecords, UserDecision, UserProfile,
} from '../types';
import { clamp } from '../lib/derived';

export interface GameData {
  profile: UserProfile;
  simulation: SimulationState;
  pill: Pill;
  anomalies: Record<AnomalyId, AnomalyState>;
  scanLevel: number; // 0 = never scanned
  identityChecked: boolean;
  missions: Record<MissionId, MissionState>;
  missionResults: MissionResult[];
  abilities: PlayerAbilities;
  records: TrainingRecords;
  decisions: UserDecision[];
  intel: string[];
  agentGame: { cleared: Difficulty[]; correct: number; wrong: number };
  realityActions: number;
  alerts: SystemAlert[];
  threatHistory: number[];
  ending: EndingReport | null;
  endingsSeen: string[];
  lockdowns: number;
  activeModule: ModuleId;
  settings: { sound: boolean; reducedMotion: boolean | null };
}

interface Transient {
  lockdown: boolean; // threat hit 100 outside the exit protocol
  exitActive: boolean;
  showDecision: boolean;
  bootReplay: boolean;
}

interface Actions {
  completeBoot(): void;
  replayBoot(): void;
  setUsername(name: string): void;
  setModule(m: ModuleId): void;
  alert(level: AlertLevel, text: string): void;
  addThreat(n: number, reason?: string): void;
  clearLockdown(): void;
  runScan(): number; // returns new scan level
  checkIdentity(): void;
  discoverAnomaly(id: AnomalyId): void;
  openDecision(open: boolean): void;
  choosePill(p: 'red' | 'blue'): void;
  reopenInvestigation(): void;
  recordTraining(kind: TrainingId, data: { score: number; extra?: number }): void;
  completeMission(id: MissionId, score: number, timeMs: number): void;
  failMission(id: MissionId, timeMs: number, reason: string): void;
  unlockIntel(id: string): void;
  recordDecision(id: string, option: string, consequences: string[]): void;
  agentResult(difficulty: Difficulty, correct: number, wrong: number, cleared: boolean): void;
  realityAction(): void;
  setExitActive(a: boolean): void;
  setEnding(r: EndingReport): void;
  setSound(on: boolean): void;
  setReducedMotion(v: boolean | null): void;
  resetAll(): void;
}

export type GameStore = GameData & Transient & Actions;

const uid = () => Math.random().toString(36).slice(2, 10);

export function freshData(): GameData {
  return {
    profile: { id: uid(), username: '', createdAt: Date.now(), bootComplete: false },
    simulation: { status: 'active', threat: 4, resistanceConnection: false },
    pill: null,
    anomalies: Object.fromEntries(ANOMALY_IDS.map((id) => [id, { lead: false, discovered: false }])) as GameData['anomalies'],
    scanLevel: 0,
    identityChecked: false,
    missions: Object.fromEntries(MISSIONS.map((m) => [m.id, { status: 'locked', score: 0, bestTime: null, attempts: 0 }])) as GameData['missions'],
    missionResults: [],
    abilities: { bulletTime: 0, reflexScore: 0, movementSkill: 0, simulationControl: 0, combat: 0 },
    records: { reflexBestMs: null, reflexHistory: [], combatBest: 0, bulletBest: 0, bulletReactionMs: null, movementLevel: 0, completed: {} },
    decisions: [],
    intel: [],
    agentGame: { cleared: [], correct: 0, wrong: 0 },
    realityActions: 0,
    alerts: [],
    threatHistory: [4],
    ending: null,
    endingsSeen: [],
    lockdowns: 0,
    activeModule: 'overview',
    settings: { sound: true, reducedMotion: null },
  };
}

const NEXT: Record<MissionId, MissionId | null> = { m01: 'm02', m02: 'm03', m03: 'm04', m04: 'm05', m05: null };

export const useGame = create<GameStore>()(
  persist(
    (set, get) => {
      const pushAlert = (level: AlertLevel, text: string) =>
        set((s) => ({ alerts: [{ id: uid(), level, text, at: Date.now() }, ...s.alerts].slice(0, 40) }));

      const setThreat = (v: number) =>
        set((s) => ({
          simulation: { ...s.simulation, threat: v },
          threatHistory: [...s.threatHistory, v].slice(-40),
        }));

      return {
        ...freshData(),
        lockdown: false,
        exitActive: false,
        showDecision: false,
        bootReplay: false,

        completeBoot: () => set((s) => ({ profile: { ...s.profile, bootComplete: true }, bootReplay: false })),
        replayBoot: () => set({ bootReplay: true }),
        setUsername: (name) => set((s) => ({ profile: { ...s.profile, username: name.slice(0, 20) } })),
        setModule: (m) => set({ activeModule: m }),
        alert: pushAlert,

        addThreat: (n, reason) => {
          const s = get();
          if (s.lockdown || s.simulation.status === 'escaped') return;
          const v = clamp(s.simulation.threat + n, 0, 100);
          setThreat(v);
          if (reason) pushAlert(n > 0 ? 'agent' : 'success', `${n > 0 ? 'THREAT +' : 'THREAT '}${n}% · ${reason}`);
          if (v >= 100 && !s.exitActive) set((st) => ({ lockdown: true, lockdowns: st.lockdowns + 1 }));
        },

        clearLockdown: () => {
          setThreat(60);
          set({ lockdown: false });
          pushAlert('warn', 'Signal went dark. Agents lost the trace. Threat reset to 60%.');
        },

        runScan: () => {
          const s = get();
          // deeper scans need evidence: level 2 after 2 discoveries, level 3 needs the anomaly lens (M02)
          let level = Math.max(1, s.scanLevel);
          if (s.scanLevel >= 1 && ANOMALY_IDS.filter((id) => s.anomalies[id].discovered).length >= 2) level = Math.max(level, 2);
          if (s.missions.m02.status === 'completed') level = 3;
          const anomalies = { ...s.anomalies };
          for (const id of ANOMALY_IDS) if (ANOMALIES[id].scanLevel <= level) anomalies[id] = { ...anomalies[id], lead: true };
          set({ anomalies, scanLevel: level });
          return level;
        },

        checkIdentity: () => {
          if (get().identityChecked) return;
          set({ identityChecked: true });
          pushAlert('warn', 'IDENTITY VERIFICATION FAILED · 3 inconsistencies in your record');
          get().addThreat(3);
        },

        discoverAnomaly: (id) => {
          const s = get();
          if (s.anomalies[id].discovered) return;
          set({ anomalies: { ...s.anomalies, [id]: { lead: true, discovered: true, discoveredAt: Date.now() } } });
          pushAlert('warn', `ANOMALY CONFIRMED · ${ANOMALIES[id].title}`);
          get().addThreat(2);
          const count = ANOMALY_IDS.filter((a) => get().anomalies[a].discovered).length;
          if (count === 3 && get().pill === null) pushAlert('info', 'INCOMING TRANSMISSION · Someone knows what you have found.');
          if (id === 'transmission') get().unlockIntel('op-channel');
        },

        openDecision: (open) => set({ showDecision: open }),

        choosePill: (p) => {
          const s = get();
          const consequences =
            p === 'red'
              ? ['Resistance connection established', 'Training, Agent Detection, Missions and Reality modules unlocked', 'System hostility increased (+15% threat)']
              : ['Investigation suspended', 'Memory of anomalies suppressed', 'Simulation stability restored'];
          set({
            pill: p,
            decisions: [...s.decisions, { decisionId: 'pill', selectedOption: p, consequences, at: Date.now() }],
          });
          if (p === 'red') {
            set((st) => ({
              simulation: { ...st.simulation, status: 'compromised', resistanceConnection: true },
              missions: { ...st.missions, m01: { ...st.missions.m01, status: st.missions.m01.status === 'locked' ? 'available' : st.missions.m01.status } },
            }));
            get().addThreat(15, 'red pill accepted. The system noticed.');
            pushAlert('success', 'RESISTANCE CONNECTION ESTABLISHED');
          } else {
            set((st) => ({ simulation: { ...st.simulation, status: 'stable', resistanceConnection: false } }));
            setThreat(Math.max(0, s.simulation.threat - 10));
            pushAlert('info', 'Blue pill accepted. Everything is normal.');
          }
        },

        reopenInvestigation: () => {
          const s = get();
          set({
            pill: null,
            showDecision: true,
            simulation: { ...s.simulation, status: 'active' },
            decisions: [...s.decisions, { decisionId: 'reconsider', selectedOption: 'question-again', consequences: ['Decision re-opened'], at: Date.now() }],
          });
        },

        recordTraining: (kind, { score, extra }) => {
          const s = get();
          const r = { ...s.records, completed: { ...s.records.completed, [kind]: true } };
          const a = { ...s.abilities };
          const lift = (cur: number, sc: number) => Math.round(clamp(Math.max(cur, cur * 0.6 + sc * 0.4, sc * 0.85), 0, 100));
          if (kind === 'combat') { r.combatBest = Math.max(r.combatBest, score); a.combat = lift(a.combat, score); }
          if (kind === 'bullet') {
            r.bulletBest = Math.max(r.bulletBest, score); a.bulletTime = lift(a.bulletTime, score);
            if (extra != null) r.bulletReactionMs = r.bulletReactionMs == null ? extra : Math.min(r.bulletReactionMs, extra);
          }
          if (kind === 'reflex' && extra != null) {
            r.reflexBestMs = r.reflexBestMs == null ? extra : Math.min(r.reflexBestMs, extra);
            r.reflexHistory = [...r.reflexHistory, { avgMs: extra, accuracy: score, at: Date.now() }].slice(-12);
            const speed = clamp(100 - (extra - 180) / 4, 0, 100);
            a.reflexScore = lift(a.reflexScore, Math.round(speed * 0.6 + score * 0.4));
          }
          if (kind === 'movement') { r.movementLevel = Math.max(r.movementLevel, extra ?? 0); a.movementSkill = lift(a.movementSkill, score); }
          set({ records: r, abilities: a });
          pushAlert('success', `TRAINING LOGGED · ${kind.toUpperCase()} ${Math.round(score)}`);
        },

        completeMission: (id, score, timeMs) => {
          const s = get();
          const m = s.missions[id];
          const missions = {
            ...s.missions,
            [id]: { status: 'completed', score: Math.max(m.score, score), bestTime: m.bestTime == null ? timeMs : Math.min(m.bestTime, timeMs), attempts: m.attempts + 1 },
          } as GameData['missions'];
          const nxt = NEXT[id];
          if (nxt && missions[nxt].status === 'locked') missions[nxt] = { ...missions[nxt], status: 'available' };
          set({ missions, missionResults: [...s.missionResults, { missionId: id, completionStatus: 'success', score, completionTime: timeMs, at: Date.now() }] });
          pushAlert('success', `MISSION COMPLETE · ${MISSIONS.find((x) => x.id === id)!.title}`);
          get().addThreat(-5);
          if (id === 'm01') get().unlockIntel('op-channel');
          if (id === 'm02') get().runScan();
          if (id === 'm04') get().unlockIntel('exit-routing');
          if (id === 'm05') get().unlockIntel('source-hint');
        },

        failMission: (id, timeMs, reason) => {
          const s = get();
          set({
            missions: { ...s.missions, [id]: { ...s.missions[id], attempts: s.missions[id].attempts + 1 } },
            missionResults: [...s.missionResults, { missionId: id, completionStatus: 'failure', score: 0, completionTime: timeMs, at: Date.now() }],
          });
          get().addThreat(8, `mission failed: ${reason}`);
        },

        unlockIntel: (id) => {
          if (!INTEL[id] || get().intel.includes(id)) return;
          set((s) => ({ intel: [...s.intel, id] }));
          pushAlert('info', `INTEL UNLOCKED · ${INTEL[id]}`);
        },

        recordDecision: (id, option, consequences) =>
          set((st) => ({ decisions: [...st.decisions, { decisionId: id, selectedOption: option, consequences, at: Date.now() }] })),

        agentResult: (difficulty, correct, wrong, cleared) => {
          const s = get();
          set({
            agentGame: {
              cleared: cleared && !s.agentGame.cleared.includes(difficulty) ? [...s.agentGame.cleared, difficulty] : s.agentGame.cleared,
              correct: s.agentGame.correct + correct,
              wrong: s.agentGame.wrong + wrong,
            },
          });
          if (cleared) {
            get().unlockIntel(difficulty === 'easy' ? 'agent-tells-1' : difficulty === 'medium' ? 'agent-tells-2' : 'agent-tells-3');
            if (difficulty !== 'easy') get().unlockIntel(difficulty === 'medium' ? 'sweep-pattern' : 'subway-dead');
          }
        },

        realityAction: () => {
          const s = get();
          const n = s.realityActions + 1;
          set({ realityActions: n, abilities: { ...s.abilities, simulationControl: Math.min(100, Math.round(Math.sqrt(n) * 12)) } });
        },

        // starting the protocol again means you are back inside the simulation
        setExitActive: (a) => set((s) => ({ exitActive: a, simulation: a && (s.simulation.status === 'escaped' || s.simulation.status === 'recaptured') ? { ...s.simulation, status: 'compromised' } : s.simulation })),

        setEnding: (r) => {
          const s = get();
          set({
            ending: r,
            endingsSeen: s.endingsSeen.includes(r.ending) ? s.endingsSeen : [...s.endingsSeen, r.ending],
            simulation: { ...s.simulation, status: r.ending === 'escaped' ? 'escaped' : r.ending === 'recaptured' ? 'recaptured' : s.simulation.status },
            decisions: [...s.decisions, { decisionId: 'exit', selectedOption: r.ending, consequences: [`Ending: ${r.ending}`], at: Date.now() }],
          });
        },

        setSound: (on) => set((s) => ({ settings: { ...s.settings, sound: on } })),
        setReducedMotion: (v) => set((s) => ({ settings: { ...s.settings, reducedMotion: v } })),

        resetAll: () => {
          const settings = get().settings;
          set({ ...freshData(), settings, lockdown: false, exitActive: false, showDecision: false, bootReplay: false });
        },
      };
    },
    {
      name: 'matrix-system-breach',
      version: 1,
      storage: createJSONStorage(() => localStorage),
      partialize: (s) => {
        const { lockdown: _l, exitActive: _e, showDecision: _d, bootReplay: _b, ...rest } = s;
        void _l; void _e; void _d; void _b;
        return Object.fromEntries(Object.entries(rest).filter(([, v]) => typeof v !== 'function')) as unknown as GameData;
      },
      merge: (persisted, current) => ({ ...current, ...freshData(), ...(persisted as Partial<GameData>) }),
    },
  ),
);
