import { useEffect, useMemo, useRef, useState } from 'react';
import TerminalWindow from '../components/TerminalWindow';
import IdentityCard from '../components/IdentityCard';
import { useGame } from '../store/gameStore';
import { buildIdentity } from '../lib/identity';
import { ANOMALIES, ANOMALY_IDS } from '../data/content';
import { sfx } from '../lib/audio';

const CHECKS = [
  { field: 'Birth record', result: 'MATCH', bad: false },
  { field: 'School placement', result: 'TEMPLATE REUSED · 4,112 identical records', bad: true },
  { field: 'Residence history', result: 'PRIOR ADDRESSES PURGED · no source', bad: true },
  { field: 'Employment', result: 'MATCH', bad: false },
  { field: 'Biometric continuity', result: 'GAP · 3 days unaccounted in 2019 render log', bad: true },
];

export default function Identity() {
  const s = useGame();
  const id = useMemo(() => buildIdentity(s.profile.id), [s.profile.id]);
  const [alias, setAlias] = useState(s.profile.username);
  const [running, setRunning] = useState(false);
  const [step, setStep] = useState(s.identityChecked ? CHECKS.length : 0);
  const verification = s.pill === 'red' ? 'FLAGGED · RESISTANCE' : s.identityChecked ? 'FAILED · INCONSISTENT' : 'UNVERIFIED';

  const timer = useRef<number>(undefined);
  useEffect(() => () => clearInterval(timer.current), []);
  const verify = () => {
    setRunning(true); setStep(0);
    let i = 0;
    const t = timer.current = window.setInterval(() => {
      i++; setStep(i);
      CHECKS[i - 1]?.bad ? sfx.err() : sfx.tick();
      if (i >= CHECKS.length) { clearInterval(t); setRunning(false); s.checkIdentity(); }
    }, 650);
  };

  const history = ANOMALY_IDS.filter((a) => s.anomalies[a].discovered).sort((a, b) => (s.anomalies[a].discoveredAt ?? 0) - (s.anomalies[b].discoveredAt ?? 0));

  return (
    <div className="mx-auto grid max-w-6xl gap-4 lg:grid-cols-2">
      <TerminalWindow title="Identity Record" code="ID.01" className="lg:col-span-2">
        <IdentityCard id={id} alias={s.profile.username} verification={verification} reveal={running} />
        <form className="mt-5 flex flex-wrap items-end gap-3" onSubmit={(e) => { e.preventDefault(); s.setUsername(alias.trim()); sfx.ok(); }}>
          <label className="flex min-w-0 flex-1 flex-col gap-1 font-mono text-[10px] tracking-[0.2em] text-mx-grey">
            CHOOSE AN ALIAS (THE SYSTEM WILL NOT USE IT)
            <input value={alias} onChange={(e) => setAlias(e.target.value)} maxLength={20} className="border border-line bg-mx-black/60 px-3 py-2 text-sm tracking-normal text-mx-pale outline-none focus:border-[var(--accent)]" />
          </label>
          <button className="btn" type="submit">Save alias</button>
        </form>
      </TerminalWindow>

      <TerminalWindow title="Identity Verification" code="VRF">
        <p className="mb-3 font-mono text-xs text-mx-pale/80">Check your record against the system's own source tables.</p>
        <ol className="mb-4 space-y-1.5 font-mono text-xs">
          {CHECKS.map((c, i) => (
            <li key={c.field} className="flex gap-2">
              <span className="w-40 shrink-0 text-mx-grey">{c.field}</span>
              {i < step ? <span className={c.bad ? 'text-mx-amber' : 'text-accent'}>{c.bad ? '▲ ' : '● '}{c.result}</span> : <span className="text-mx-grey">{running && i === step ? 'checking…' : '—'}</span>}
            </li>
          ))}
        </ol>
        <button className="btn" onClick={verify} disabled={running}>{s.identityChecked ? 'Re-run verification' : 'Verify identity'}</button>
      </TerminalWindow>

      <TerminalWindow title="Simulation History" code="HST">
        <ol className="space-y-2 border-l border-line pl-4 font-mono text-xs">
          {id.history.map((h) => (
            <li key={h.event} className="relative">
              <span className="absolute -left-[21px] top-1 h-2 w-2 bg-[var(--line)]" />
              <span className="text-mx-grey">{h.year}</span>{' '}
              <span className={h.flag && s.identityChecked ? 'text-mx-amber' : 'text-mx-pale/85'}>{h.event}{h.flag && s.identityChecked ? ' [FLAGGED]' : ''}</span>
            </li>
          ))}
        </ol>
      </TerminalWindow>

      <TerminalWindow title="System-Assigned Characteristics" code="CHR">
        <ul className="space-y-2.5 font-mono text-xs">
          {id.traits.map((t) => (
            <li key={t.name}>
              <div className="mb-1 flex justify-between"><span>{t.name}</span><span className={t.flagged && s.identityChecked ? 'text-mx-amber' : 'text-mx-grey'}>{t.value}{t.flagged && s.identityChecked ? ' ▲ ABOVE TOLERANCE' : ''}</span></div>
              <div className={`meter ${t.flagged && s.identityChecked ? 'amber' : ''}`}><i style={{ width: `${t.value}%` }} /></div>
            </li>
          ))}
        </ul>
        {!s.identityChecked && <p className="mt-3 font-mono text-[11px] text-mx-grey">Tolerance flags appear after verification.</p>}
      </TerminalWindow>

      <TerminalWindow title="Anomaly History" code="ANM">
        {history.length === 0 ? (
          <p className="font-mono text-xs text-mx-grey">No anomalies confirmed. Run a scan in Simulation Diagnostics.</p>
        ) : (
          <ul className="space-y-2 font-mono text-xs">
            {history.map((a) => (
              <li key={a}><span className="text-mx-amber">▲ {ANOMALIES[a].title}</span> <span className="text-mx-grey">· {ANOMALIES[a].location} · {new Date(s.anomalies[a].discoveredAt!).toLocaleString()}</span></li>
            ))}
          </ul>
        )}
      </TerminalWindow>
    </div>
  );
}
