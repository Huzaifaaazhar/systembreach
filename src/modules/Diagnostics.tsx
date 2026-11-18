import { useEffect, useRef, useState, type ComponentType } from 'react';
import TerminalWindow from '../components/TerminalWindow';
import { useGame } from '../store/gameStore';
import { ANOMALIES, ANOMALY_IDS } from '../data/content';
import { discoveredCount, transmissionReady } from '../lib/derived';
import { sfx } from '../lib/audio';
import type { AnomalyId } from '../types';
import type { AnomalyProps } from '../components/anomalies/types';
import LoopAnomaly from '../components/anomalies/LoopAnomaly';
import ClockAnomaly from '../components/anomalies/ClockAnomaly';
import DuplicateAnomaly from '../components/anomalies/DuplicateAnomaly';
import RevisitAnomaly from '../components/anomalies/RevisitAnomaly';
import TransmissionAnomaly from '../components/anomalies/TransmissionAnomaly';
import SeamAnomaly from '../components/anomalies/SeamAnomaly';

const INVESTIGATIONS: Record<AnomalyId, ComponentType<AnomalyProps>> = {
  loop: LoopAnomaly, clock: ClockAnomaly, duplicate: DuplicateAnomaly, revisit: RevisitAnomaly, transmission: TransmissionAnomaly, seam: SeamAnomaly,
};

const SUBSYSTEMS = [
  ['RENDER PIPELINE', 'nominal · 60.00 Hz'],
  ['CROWD BEHAVIOUR', 'pattern repetition detected'],
  ['TIME SERVICE', 'source disagreement 4.0s'],
  ['ASSET TABLE', 'serial collision'],
  ['LOCATION GENERATOR', 'unstable seed'],
  ['CARRIER BANDS', 'unregistered carrier'],
  ['SKYBOX', 'texture boundary (lens required)'],
] as const;

export default function Diagnostics() {
  const s = useGame();
  const [scanning, setScanning] = useState(false);
  const [row, setRow] = useState(s.scanLevel > 0 ? SUBSYSTEMS.length : 0);
  const [open, setOpen] = useState<AnomalyId | null>(null);
  const timer = useRef<number>(undefined);
  useEffect(() => () => clearInterval(timer.current), []);

  const scan = () => {
    setScanning(true); setRow(0); sfx.tick();
    let i = 0;
    timer.current = window.setInterval(() => {
      i++; setRow(i); sfx.key();
      if (i >= SUBSYSTEMS.length) {
        clearInterval(timer.current);
        const lvl = s.runScan();
        setScanning(false);
        s.alert('info', `DIAGNOSTIC SCAN COMPLETE · depth ${lvl}`);
      }
    }, 380);
  };

  const nextDepthHint =
    s.scanLevel === 0 ? 'Run your first scan.' :
    s.scanLevel === 1 && discoveredCount(s) < 2 ? 'Confirm 2 anomalies to unlock a deeper scan.' :
    s.scanLevel === 1 ? 'A deeper scan is available. Run it again.' :
    s.scanLevel === 2 && s.missions.m02.status !== 'completed' ? 'Depth 3 needs the anomaly lens (Mission 02).' :
    s.scanLevel === 2 ? 'Anomaly lens acquired. Run the scan again.' : 'Maximum scan depth reached.';

  return (
    <div className="mx-auto grid max-w-6xl gap-4 lg:grid-cols-[1fr_1.35fr]">
      <TerminalWindow title="Diagnostic Scan" code="DX.02" right={<span className="font-mono text-[10px] text-mx-grey">DEPTH {s.scanLevel}/3</span>}>
        <div className="relative overflow-hidden border border-soft bg-mx-black/60 p-3 font-mono text-xs">
          {scanning && <div className="scan-line pointer-events-none absolute inset-x-0 top-0 h-10 bg-gradient-to-b from-transparent via-[rgba(0,255,65,.12)] to-transparent" />}
          <div className="mb-2 text-mx-grey">TARGET: local simulation instance · subject terminal</div>
          {SUBSYSTEMS.map(([name, res], i) => {
            const show = i < row;
            const suspicious = i > 0 && show && (i < 6 || s.scanLevel >= 3);
            return (
              <div key={name} className="flex justify-between gap-3 py-0.5">
                <span className="text-mx-pale/80">{name}</span>
                <span className={!show ? 'text-mx-grey' : suspicious ? 'text-mx-amber' : 'text-accent'}>
                  {!show ? (scanning && i === row ? 'scanning…' : '·····') : i === 6 && s.scanLevel < 3 ? 'nominal' : `${suspicious ? '▲ ' : '● '}${res}`}
                </span>
              </div>
            );
          })}
        </div>
        <div className="mt-3 flex flex-wrap items-center gap-3">
          <button className="btn btn-primary" onClick={scan} disabled={scanning}>{scanning ? 'Scanning…' : s.scanLevel ? 'Run scan again' : 'Run scan'}</button>
          <span className="font-mono text-[11px] text-mx-grey">{nextDepthHint}</span>
        </div>
        {transmissionReady(s) && (
          <div className="fade-in mt-4 border border-mx-amber/70 p-3 font-mono text-xs text-mx-amber">
            ▲ INCOMING TRANSMISSION. Someone has noticed what you are finding.
            <button className="btn btn-amber ml-0 mt-2 block" onClick={() => s.openDecision(true)}>Open transmission</button>
          </div>
        )}
      </TerminalWindow>

      <TerminalWindow title="Anomalies" code="ANM" right={<span className="font-mono text-[10px] text-mx-grey">{discoveredCount(s)} CONFIRMED</span>}>
        {s.scanLevel === 0 ? <p className="font-mono text-xs text-mx-grey">No scan data. Run a diagnostic scan to surface suspicious patterns.</p> : (
          <ul className="space-y-2">
            {ANOMALY_IDS.map((id) => {
              const a = ANOMALIES[id]; const st = s.anomalies[id];
              if (!st.lead) return <li key={id} className="border border-dashed border-soft p-3 font-mono text-xs text-mx-grey">??? · requires scan depth {a.scanLevel}</li>;
              const Inv = INVESTIGATIONS[id];
              const isOpen = open === id;
              return (
                <li key={id} className={`border p-3 ${st.discovered ? 'border-mx-amber/50' : 'border-line'}`}>
                  <div className="flex flex-wrap items-start gap-2">
                    <div className="min-w-0 flex-1">
                      <div className="font-head text-base text-mx-white">{a.title} <span className="font-mono text-[10px] text-mx-grey">· DIFFICULTY {'▮'.repeat(a.difficulty)}{'▯'.repeat(3 - a.difficulty)}</span></div>
                      <div className="font-mono text-[11px] text-mx-grey">{a.location}</div>
                      <p className="mt-1 font-mono text-xs text-mx-pale/85">{st.discovered ? a.description : a.lead}</p>
                    </div>
                    {st.discovered && !isOpen ? <span className="chip text-mx-amber">▲ CONFIRMED</span> : (
                      <button className="btn !min-h-9" onClick={() => setOpen(isOpen ? null : id)} aria-expanded={isOpen}>{isOpen ? 'Close' : 'Investigate'}</button>
                    )}
                  </div>
                  {isOpen && (
                    <div className="fade-in mt-3" ref={(el) => el?.scrollIntoView({ block: 'nearest', behavior: 'smooth' })}>
                      <Inv
                        onFound={() => { sfx.win(); s.discoverAnomaly(id); setTimeout(() => setOpen((cur) => (cur === id ? null : cur)), 1600); }}
                        onWrong={(why) => { sfx.err(); s.addThreat(2, why); }}
                      />
                    </div>
                  )}
                </li>
              );
            })}
          </ul>
        )}
      </TerminalWindow>
    </div>
  );
}
