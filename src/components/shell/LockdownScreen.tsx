import { useEffect, useState } from 'react';
import { useGame } from '../../store/gameStore';
import TerminalWindow from '../TerminalWindow';

/** Shown when threat reaches 100% outside the exit protocol: the user has to go dark to recover. */
export default function LockdownScreen() {
  const clear = useGame((s) => s.clearLockdown);
  const count = useGame((s) => s.lockdowns);
  const [left, setLeft] = useState<number | null>(null);
  useEffect(() => {
    if (left === null) return;
    if (left <= 0) { clear(); return; }
    const t = setTimeout(() => setLeft(left - 1), 1000);
    return () => clearTimeout(t);
  }, [left, clear]);
  return (
    <TerminalWindow title="Agent Lockdown" code="!!" tone="agent" className="mx-auto max-w-xl" bodyClassName="p-6">
      <div className="space-y-4 font-mono text-sm">
        <p className="font-head text-3xl text-[#ff6b77]">TRACE COMPLETE</p>
        <p className="text-mx-pale">Agents have locked onto this terminal. Any activity now gives away your position. Cut the connection and wait for the trace to decay.</p>
        <p className="text-mx-grey">Lockdowns so far: {count}. Threat drops to 60% once you have gone dark.</p>
        <button className="btn btn-danger" disabled={left !== null} onClick={() => setLeft(5)}>
          {left === null ? 'GO DARK' : `DARK… ${left}s`}
        </button>
      </div>
    </TerminalWindow>
  );
}
