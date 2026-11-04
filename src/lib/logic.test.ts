import { describe, expect, it, beforeEach } from 'vitest';
import { useGame, freshData } from '../store/gameStore';
import { agentThreat, discoveredCount, escapeProgress, exitUnlocked, realityIntegrity, transmissionReady, undefinedUnlocked } from './derived';
import { agentHop, generateNetwork, remainingAgents, tellCount, CONFIG } from './network';
import { connected, generateLattice } from './lattice';
import { generateLevel } from '../games/MovementGame';
import { seeded } from './canvas';
import { ANOMALY_IDS } from '../data/content';

const reset = () => useGame.setState({ ...freshData(), lockdown: false, exitActive: false, showDecision: false, bootReplay: false });

describe('derived statistics', () => {
  beforeEach(reset);
  it('starts at full integrity and zero progress', () => {
    const s = useGame.getState();
    expect(realityIntegrity(s)).toBe(100);
    expect(escapeProgress(s)).toBe(0);
    expect(agentThreat(s.simulation.threat)).toBe('DORMANT');
  });
  it('integrity drops and progress rises as anomalies are confirmed', () => {
    const g = useGame.getState();
    g.runScan();
    g.discoverAnomaly('loop'); g.discoverAnomaly('clock');
    const s = useGame.getState();
    expect(discoveredCount(s)).toBe(2);
    expect(realityIntegrity(s)).toBe(86);
    expect(escapeProgress(s)).toBe(5);
  });
  it('maps threat to agent states', () => {
    expect(agentThreat(10)).toBe('DORMANT');
    expect(agentThreat(30)).toBe('OBSERVING');
    expect(agentThreat(60)).toBe('HUNTING');
    expect(agentThreat(90)).toBe('LOCKING ON');
  });
});

describe('game store', () => {
  beforeEach(reset);
  it('deeper scans require evidence', () => {
    const g = useGame.getState();
    expect(g.runScan()).toBe(1);
    expect(useGame.getState().anomalies.revisit.lead).toBe(false);
    g.discoverAnomaly('loop'); g.discoverAnomaly('clock');
    expect(useGame.getState().runScan()).toBe(2);
    expect(useGame.getState().anomalies.revisit.lead).toBe(true);
    expect(useGame.getState().anomalies.seam.lead).toBe(false);
  });
  it('transmission arrives after three anomalies', () => {
    const g = useGame.getState();
    g.discoverAnomaly('loop'); g.discoverAnomaly('clock');
    expect(transmissionReady(useGame.getState())).toBe(false);
    g.discoverAnomaly('duplicate');
    expect(transmissionReady(useGame.getState())).toBe(true);
  });
  it('red pill branches state: link, threat, first mission', () => {
    const before = useGame.getState().simulation.threat;
    useGame.getState().choosePill('red');
    const s = useGame.getState();
    expect(s.pill).toBe('red');
    expect(s.simulation.resistanceConnection).toBe(true);
    expect(s.simulation.threat).toBe(before + 15);
    expect(s.missions.m01.status).toBe('available');
    expect(s.decisions.at(-1)?.selectedOption).toBe('red');
  });
  it('blue pill keeps modules locked and can be reopened', () => {
    useGame.getState().choosePill('blue');
    expect(useGame.getState().simulation.status).toBe('stable');
    expect(useGame.getState().missions.m01.status).toBe('locked');
    useGame.getState().reopenInvestigation();
    expect(useGame.getState().pill).toBe(null);
    expect(useGame.getState().showDecision).toBe(true);
  });
  it('missions unlock in sequence and m05 opens the exit', () => {
    const g = useGame.getState();
    g.choosePill('red');
    for (const id of ['m01', 'm02', 'm03', 'm04'] as const) g.completeMission(id, 80, 1000);
    expect(useGame.getState().missions.m05.status).toBe('available');
    expect(exitUnlocked(useGame.getState())).toBe(false);
    g.completeMission('m05', 80, 1000);
    expect(exitUnlocked(useGame.getState())).toBe(true);
    expect(useGame.getState().intel).toContain('source-hint');
  });
  it('threat at 100 triggers a lockdown outside the exit protocol only', () => {
    useGame.getState().addThreat(200);
    expect(useGame.getState().lockdown).toBe(true);
    useGame.getState().clearLockdown();
    expect(useGame.getState().simulation.threat).toBe(60);
    useGame.getState().setExitActive(true);
    useGame.getState().addThreat(100);
    expect(useGame.getState().lockdown).toBe(false);
    expect(useGame.getState().simulation.threat).toBe(100);
  });
  it('undefined ending needs every anomaly plus the routing hint', () => {
    const g = useGame.getState();
    ANOMALY_IDS.forEach((id) => g.discoverAnomaly(id));
    expect(undefinedUnlocked(useGame.getState())).toBe(false);
    g.unlockIntel('source-hint');
    expect(undefinedUnlocked(useGame.getState())).toBe(true);
  });
  it('training records keep personal bests', () => {
    const g = useGame.getState();
    g.recordTraining('reflex', { score: 90, extra: 320 });
    g.recordTraining('reflex', { score: 70, extra: 410 });
    const s = useGame.getState();
    expect(s.records.reflexBestMs).toBe(320);
    expect(s.records.reflexHistory).toHaveLength(2);
    expect(s.abilities.reflexScore).toBeGreaterThan(0);
  });
});

describe('agent network', () => {
  it('generates the configured counts and every agent has at least two tells', () => {
    for (const d of ['easy', 'medium', 'hard'] as const) for (let seed = 1; seed < 30; seed++) {
      const n = generateNetwork(d, seed);
      expect(n.nodes).toHaveLength(CONFIG[d].nodes);
      expect(n.nodes.filter((x) => x.agent)).toHaveLength(CONFIG[d].agents);
      for (const node of n.nodes) {
        const t = tellCount(node.props, n.latencyFloor);
        if (node.agent) expect(t).toBeGreaterThanOrEqual(2); else expect(t).toBeLessThan(2);
      }
    }
  });
  it('agent hops only to an adjacent node and keeps agent count', () => {
    const n = generateNetwork('hard', 7);
    const r = seeded(3);
    for (let i = 0; i < 10; i++) {
      const before = remainingAgents(n);
      const h = agentHop(n, r);
      if (h) expect(n.edges.some((e) => (e.a === h[0] && e.b === h[1]) || (e.a === h[1] && e.b === h[0]))).toBe(true);
      expect(remainingAgents(n)).toBe(before);
    }
  });
});

describe('lattice puzzle', () => {
  it('every generated puzzle is solvable and starts unsolved', () => {
    for (let seed = 1; seed < 200; seed++) {
      const { puzzle, solution } = generateLattice(6, 5, seed);
      expect(connected(solution).solved).toBe(true);
      expect(connected(puzzle).solved).toBe(false);
    }
  });
});

describe('movement levels', () => {
  it('are deterministic and contain exactly one exit', () => {
    for (let n = 1; n <= 5; n++) {
      const a = generateLevel(n), b = generateLevel(n);
      expect([...a.tiles.entries()]).toEqual([...b.tiles.entries()]);
      expect([...a.tiles.values()].filter((t) => t === 'X')).toHaveLength(1);
    }
  });
});

describe('exit protocol replay', () => {
  beforeEach(reset);
  it('re-entering after an escape makes threat live again', () => {
    const g = useGame.getState();
    g.setEnding({ ending: 'escaped', at: 0, threat: 0, integrity: 0, missionsCompleted: 5, anomaliesFound: 6, intel: 0, abilities: g.abilities, exitScore: 0, timeline: [] });
    expect(useGame.getState().simulation.status).toBe('escaped');
    useGame.getState().setExitActive(true);
    expect(useGame.getState().simulation.status).toBe('compromised');
    useGame.getState().addThreat(20);
    expect(useGame.getState().simulation.threat).toBeGreaterThan(19);
  });
});
