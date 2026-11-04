import TerminalWindow from '../components/TerminalWindow';
import SystemStatusIndicator from '../components/SystemStatusIndicator';
import ProgressTracker from '../components/ProgressTracker';
import { useGame } from '../store/gameStore';
import { useLiveIntegrity } from '../components/shell/MonitorPanel';
import { agentThreat, discoveredCount, escapeProgress, leadCount, missionsCompleted, transmissionReady } from '../lib/derived';
import { INTEL } from '../data/content';

/** System Overview: every value here is derived from game state. */
export default function Overview() {
  const s = useGame();
  const integrity = useLiveIntegrity();
  const found = discoveredCount(s);
  const leads = leadCount(s);
  const threat = s.simulation.threat;
  const verification = s.pill === 'red' ? 'FLAGGED · RESISTANCE' : s.pill === 'blue' ? 'VERIFIED · COMPLIANT' : s.scanLevel > 0 ? 'INCONSISTENT' : 'UNVERIFIED';

  const next = (() => {
    if (s.pill === 'blue') return { text: 'Everything is normal. Probably.', action: { label: 'Question reality again', run: () => s.reopenInvestigation() } };
    if (s.scanLevel === 0) return { text: 'Run a diagnostic scan on your own simulation instance.', action: { label: 'Open Diagnostics', run: () => s.setModule('diagnostics') } };
    if (transmissionReady(s)) return { text: 'An incoming transmission is waiting.', action: { label: 'Open transmission', run: () => s.openDecision(true) } };
    if (s.pill === null) return { text: `Confirm anomalies in Diagnostics (${found}/3).`, action: { label: 'Investigate anomalies', run: () => s.setModule('diagnostics') } };
    if (!s.records.completed.combat && !s.records.completed.bullet) return { text: 'Train in the Construct before going into the field.', action: { label: 'Enter the Construct', run: () => s.setModule('training') } };
    if (s.missions.m05.status !== 'completed') return { text: 'Continue the infiltration missions.', action: { label: 'Open Missions', run: () => s.setModule('missions') } };
    if (!s.ending) return { text: 'The exit point is confirmed. Run the Exit Protocol.', action: { label: 'Open Exit Protocol', run: () => s.setModule('exit') } };
    return { text: `Last outcome: ${s.ending.ending.toUpperCase()}. You can attempt the exit again.`, action: { label: 'Open Exit Protocol', run: () => s.setModule('exit') } };
  })();

  return (
    <div className="mx-auto grid max-w-6xl gap-4 lg:grid-cols-[1.4fr_1fr]">
      <TerminalWindow title="System Overview" code="SYS.00" className="lg:row-span-2">
        <div className="mb-5">
          <p className="font-mono text-[11px] tracking-[0.3em] text-mx-grey">SIMULATION STATUS</p>
          <p className={`font-head text-4xl sm:text-5xl ${s.simulation.status === 'stable' ? 'text-[#c6d6e0]' : 'text-accent'}`}>{s.simulation.status.toUpperCase()}</p>
        </div>
        <div className="grid gap-x-8 md:grid-cols-2">
          <SystemStatusIndicator label="USER IDENTITY" value={verification} tone={s.pill === 'red' ? 'agent' : s.scanLevel ? 'warn' : 'idle'} />
          <SystemStatusIndicator label="REALITY INTEGRITY" value={`${integrity.toFixed(1)}%`} tone={integrity < 60 ? 'warn' : 'ok'} />
          <SystemStatusIndicator label="ANOMALY DETECTION" value={`${found} confirmed · ${leads} leads`} tone={found ? 'warn' : 'idle'} />
          <SystemStatusIndicator label="AGENT THREAT" value={`${agentThreat(threat)} (${Math.round(threat)}%)`} tone={threat >= 50 ? 'agent' : threat >= 25 ? 'warn' : 'ok'} />
          <SystemStatusIndicator label="RESISTANCE CONNECTION" value={s.simulation.resistanceConnection ? 'ESTABLISHED' : 'UNESTABLISHED'} tone={s.simulation.resistanceConnection ? 'ok' : 'idle'} />
          <SystemStatusIndicator label="ESCAPE PROGRESS" value={`${escapeProgress(s)}%`} tone="ok" />
          <SystemStatusIndicator label="MISSIONS" value={`${missionsCompleted(s)}/5`} tone={missionsCompleted(s) ? 'ok' : 'idle'} />
          <SystemStatusIndicator label="INTEL RECOVERED" value={`${s.intel.length}/${Object.keys(INTEL).length}`} tone={s.intel.length ? 'ok' : 'idle'} />
        </div>
        <div className="mt-6 border border-soft bg-mx-black/50 p-4">
          <p className="mb-1 font-mono text-[11px] tracking-[0.3em] text-mx-grey">NEXT ACTION</p>
          <p className="mb-3 font-mono text-sm text-mx-pale">{next.text}</p>
          <button className={`btn ${transmissionReady(s) ? 'btn-primary' : ''}`} onClick={next.action.run}>{next.action.label} ▸</button>
        </div>
      </TerminalWindow>

      <TerminalWindow title="Decision Log" code="DEC">
        {s.decisions.length === 0 ? <p className="font-mono text-xs text-mx-grey">No decisions recorded.</p> : (
          <ol className="space-y-2 font-mono text-xs">
            {s.decisions.slice(-6).reverse().map((d) => (
              <li key={d.at + d.decisionId}>
                <span className="text-accent">{d.decisionId.toUpperCase()} → {d.selectedOption.toUpperCase()}</span>
                <span className="text-mx-grey"> · {new Date(d.at).toLocaleTimeString()}</span>
                <ul className="pl-3 text-mx-pale/75">{d.consequences.map((c) => <li key={c}>— {c}</li>)}</ul>
              </li>
            ))}
          </ol>
        )}
        <div className="mt-4 xl:hidden"><ProgressTracker compact /></div>
      </TerminalWindow>

      <TerminalWindow title="Recovered Intelligence" code="INT">
        {s.intel.length === 0 ? <p className="font-mono text-xs text-mx-grey">Nothing recovered yet.</p> : (
          <ul className="space-y-2 font-mono text-xs text-mx-pale/85">{s.intel.map((id) => <li key={id}>▸ {INTEL[id]}</li>)}</ul>
        )}
      </TerminalWindow>
    </div>
  );
}
