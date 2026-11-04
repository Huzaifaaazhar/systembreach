import { useEffect, useState } from 'react';
import { useGame } from '../../store/gameStore';
import { agentThreat, currentMissionId, discoveredCount, realityIntegrity } from '../../lib/derived';
import { MISSIONS } from '../../data/content';
import SystemStatusIndicator from '../SystemStatusIndicator';
import AgentThreatPanel from '../AgentThreatPanel';
import ProgressTracker from '../ProgressTracker';
import { AlertRow } from '../SystemAlert';

/** Live integrity reading: the derived value plus small sensor noise, so it reads as a live feed. */
export function useLiveIntegrity() {
  const s = useGame();
  const base = realityIntegrity(s);
  const [noise, setNoise] = useState(0);
  useEffect(() => {
    const t = setInterval(() => setNoise((Math.random() - 0.5) * (s.pill === 'red' ? 1.2 : 0.4)), 1400);
    return () => clearInterval(t);
  }, [s.pill]);
  return Math.max(0, Math.min(100, base + (base > 0 ? noise : 0)));
}

export default function MonitorPanel() {
  const s = useGame();
  const integrity = useLiveIntegrity();
  const mid = currentMissionId(s);
  const mission = MISSIONS.find((m) => m.id === mid);
  const found = discoveredCount(s);
  return (
    <aside aria-label="System monitor" className="flex h-full flex-col gap-4 overflow-y-auto p-4">
      <div>
        <div className="mb-1 font-mono text-[10px] tracking-[0.3em] text-mx-grey">SYSTEM MONITOR</div>
        <SystemStatusIndicator label="SIM INTEGRITY" value={`${integrity.toFixed(1)}%`} tone={integrity < 50 ? 'warn' : 'ok'} />
        <SystemStatusIndicator label="ANOMALIES" value={String(found)} tone={found ? 'warn' : 'idle'} />
        <SystemStatusIndicator label="AGENT ACTIVITY" value={agentThreat(s.simulation.threat)} tone={s.simulation.threat >= 50 ? 'agent' : s.simulation.threat >= 25 ? 'warn' : 'ok'} />
        <SystemStatusIndicator label="RESISTANCE" value={s.simulation.resistanceConnection ? 'LINKED' : 'NO LINK'} tone={s.simulation.resistanceConnection ? 'ok' : 'idle'} />
      </div>
      <AgentThreatPanel />
      <ProgressTracker />
      <div>
        <div className="mb-1 font-mono text-[10px] tracking-[0.3em] text-mx-grey">CURRENT MISSION</div>
        <p className="font-mono text-xs text-mx-pale">
          {s.pill !== 'red' ? 'None. No resistance link.' : mission ? `${mission.id.toUpperCase()} · ${mission.title}` : s.ending ? 'Exit attempted.' : 'All missions complete. Exit Protocol open.'}
        </p>
      </div>
      <div className="min-h-0">
        <div className="mb-1 font-mono text-[10px] tracking-[0.3em] text-mx-grey">SYSTEM ALERTS</div>
        {s.alerts.length === 0 ? <p className="font-mono text-[11px] text-mx-grey">No alerts.</p> : (
          <ul className="divide-y divide-[var(--line-soft)]">{s.alerts.slice(0, 7).map((a) => <AlertRow key={a.id} a={a} />)}</ul>
        )}
      </div>
    </aside>
  );
}
