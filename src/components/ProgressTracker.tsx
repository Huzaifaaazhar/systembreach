import { useGame } from '../store/gameStore';
import { discoveredCount, escapeProgress, missionsCompleted, trainingCompleted } from '../lib/derived';

/** The nine-step journey, each step tied to real state. */
export default function ProgressTracker({ compact = false }: { compact?: boolean }) {
  const s = useGame();
  const steps: [string, boolean][] = [
    ['Receive the transmission', s.profile.bootComplete],
    ['Investigate identity', s.scanLevel > 0],
    ['Confirm 3 anomalies', discoveredCount(s) >= 3],
    ['Choose', s.pill !== null],
    ['Enter the Construct', trainingCompleted(s) > 0],
    ['Manipulate the simulation', s.realityActions >= 5],
    ['Detect an Agent', s.agentGame.cleared.length > 0],
    ['Complete infiltration', missionsCompleted(s) === 5],
    ['Attempt escape', s.ending !== null],
  ];
  const pct = escapeProgress(s);
  return (
    <div>
      <div className="mb-1 flex justify-between font-mono text-xs"><span className="text-mx-grey">ESCAPE PROGRESS</span><span className="text-accent">{pct}%</span></div>
      <div className="meter mb-3" role="progressbar" aria-valuenow={pct} aria-valuemin={0} aria-valuemax={100} aria-label="Escape progress"><i style={{ width: `${pct}%` }} /></div>
      {!compact && (
        <ol className="space-y-1 font-mono text-[11px]">
          {steps.map(([t, done], i) => (
            <li key={t} className={done ? 'text-accent' : 'text-mx-grey'}>
              <span aria-hidden="true">{done ? '[x]' : '[ ]'}</span> {String(i + 1).padStart(2, '0')} {t}
              <span className="sr-only">{done ? ' completed' : ' not completed'}</span>
            </li>
          ))}
        </ol>
      )}
    </div>
  );
}
