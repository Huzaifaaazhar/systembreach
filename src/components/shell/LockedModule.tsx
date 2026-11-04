import { Lock } from 'lucide-react';
import TerminalWindow from '../TerminalWindow';
import { useGame } from '../../store/gameStore';
import { MODULES } from '../../data/content';
import { discoveredCount, transmissionReady } from '../../lib/derived';
import type { ModuleId } from '../../types';

/** Explains exactly what is required to open a locked module, with a way forward. */
export default function LockedModule({ id, reason }: { id: ModuleId; reason: string }) {
  const s = useGame();
  const m = MODULES.find((x) => x.id === id)!;
  const found = discoveredCount(s);
  return (
    <TerminalWindow title={m.label} code={m.code} className="mx-auto max-w-2xl" bodyClassName="p-6">
      <div className="flex items-start gap-4">
        <Lock className="mt-1 shrink-0 text-mx-grey" aria-hidden="true" />
        <div className="space-y-3 font-mono text-sm">
          <p className="text-mx-amber">ACCESS DENIED · {reason}</p>
          {reason === 'ENCRYPTED' && (
            <>
              <p className="text-mx-pale/85">This module runs outside the simulation's permission model. It only decrypts for someone who has chosen to see the truth.</p>
              <p className="text-mx-grey">Confirmed anomalies: {found}/3 needed before the transmission arrives.</p>
              {transmissionReady(s)
                ? <button className="btn btn-primary" onClick={() => s.openDecision(true)}>Open incoming transmission</button>
                : <button className="btn" onClick={() => s.setModule('diagnostics')}>Go to Simulation Diagnostics</button>}
            </>
          )}
          {reason === 'SUPPRESSED' && (
            <>
              <p className="text-mx-pale/85">You chose to forget. The module is still there, under the suppression layer.</p>
              <button className="btn" onClick={() => s.reopenInvestigation()}>Question reality again</button>
            </>
          )}
          {reason === 'REQUIRES M05' && (
            <>
              <p className="text-mx-pale/85">The exit point has not been confirmed. Complete Mission 05, Reach the Exit.</p>
              <button className="btn" onClick={() => s.setModule('missions')}>Open Infiltration Missions</button>
            </>
          )}
        </div>
      </div>
    </TerminalWindow>
  );
}
