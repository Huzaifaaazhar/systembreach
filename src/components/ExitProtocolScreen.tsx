import type { EndingReport } from '../types';
import { useGame } from '../store/gameStore';

export const ENDINGS: Record<EndingReport['ending'], { stamp: string; title: string; tone: string; text: string[] }> = {
  escaped: {
    stamp: 'DISCONNECTED', title: 'Escaped', tone: 'text-accent',
    text: [
      'The hardline rings once. The city folds away behind you like a closed tab.',
      'You wake somewhere cold and loud and real. Your hands are your own, and nothing is rendering them.',
    ],
  },
  recaptured: {
    stamp: 'TRACE COMPLETE', title: 'System Recaptured', tone: 'text-[#ff6b77]',
    text: [
      'The line goes dead in your hand. Three figures in identical suits are already standing in the doorway.',
      'Your record is restored from backup. Tomorrow the clocks will agree again, and you will not know why you feel watched.',
    ],
  },
  remaining: {
    stamp: 'SESSION CLOSED', title: 'Remaining in the Matrix', tone: 'text-[#c6d6e0]',
    text: [
      'You put the receiver down. The exit is right there, and you walk away from it.',
      'Maybe the rendered world is enough. The resistance keeps your channel open, in case you change your mind.',
    ],
  },
  undefined: {
    stamp: 'UNDEFINED', title: 'Undefined', tone: 'text-mx-amber',
    text: [
      'You trace the exit signal instead of answering it. It does not lead out. It loops back inside, into a layer nobody told you about.',
      'The "exit" is just another room in the simulation. Whoever built the resistance\'s escape route also built the walls around it. For the first time the system has no record of what you are.',
    ],
  },
};

/** Cinematic ending with the full mission report. */
export default function ExitProtocolScreen({ report, onReplay }: { report: EndingReport; onReplay: () => void }) {
  const s = useGame();
  const e = ENDINGS[report.ending];
  const stats: [string, string][] = [
    ['FINAL THREAT', `${Math.round(report.threat)}%`],
    ['REALITY INTEGRITY', `${report.integrity}%`],
    ['MISSIONS', `${report.missionsCompleted}/5`],
    ['ANOMALIES', `${report.anomaliesFound}/6`],
    ['INTEL', String(report.intel)],
    ['EXIT SCORE', String(report.exitScore)],
  ];
  return (
    <div className="fade-in mx-auto max-w-4xl py-6 text-center">
      <div className={`mb-4 inline-block border-2 border-current px-4 py-1 font-mono text-xs tracking-[0.4em] ${e.tone}`}>{e.stamp}</div>
      <h1 className={`font-head mb-6 text-5xl sm:text-7xl ${e.tone}`}>{e.title}</h1>
      <div className="mx-auto mb-8 max-w-2xl space-y-3 font-sans text-base text-mx-pale sm:text-lg">{e.text.map((t) => <p key={t}>{t}</p>)}</div>

      <section className="tw mx-auto mb-6 text-left" aria-label="Mission report">
        <header className="tw-title px-4 py-2 font-head text-sm text-accent">Mission Report</header>
        <div className="grid gap-4 p-4 md:grid-cols-2">
          <dl className="grid grid-cols-2 gap-3 font-mono">
            {stats.map(([k, v]) => <div key={k}><dt className="text-[10px] tracking-[0.2em] text-mx-grey">{k}</dt><dd className="text-2xl text-mx-white">{v}</dd></div>)}
          </dl>
          <div className="font-mono text-xs">
            <div className="mb-1 text-[10px] tracking-[0.2em] text-mx-grey">ABILITIES</div>
            {Object.entries(report.abilities).map(([k, v]) => (
              <div key={k} className="mb-1.5"><div className="flex justify-between"><span>{k.replace(/([A-Z])/g, ' $1').toLowerCase()}</span><span className="text-accent">{v}</span></div><div className="meter"><i style={{ width: `${v}%` }} /></div></div>
            ))}
          </div>
          <div className="md:col-span-2">
            <div className="mb-1 font-mono text-[10px] tracking-[0.2em] text-mx-grey">TIMELINE</div>
            <ol className="space-y-0.5 font-mono text-xs text-mx-pale/85">{report.timeline.map((t, i) => <li key={i}>{String(i + 1).padStart(2, '0')} · {t}</li>)}</ol>
          </div>
        </div>
      </section>
      <p className="mb-4 font-mono text-xs text-mx-grey">Endings discovered: {s.endingsSeen.length}/4 {s.endingsSeen.length < 4 && '· your choices and performance lead to different outcomes'}</p>
      <div className="flex flex-wrap justify-center gap-3">
        <button className="btn btn-primary" onClick={onReplay}>Run the Exit Protocol again</button>
        <button className="btn" onClick={() => s.setModule('overview')}>Back to System Overview</button>
        <button className="btn btn-danger" onClick={() => { if (confirm('Start over from the beginning? All progress will be wiped.')) s.resetAll(); }}>Begin again from zero</button>
      </div>
    </div>
  );
}
