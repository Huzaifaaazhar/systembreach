import { useEffect, useRef, useState } from 'react';
import { useGame } from '../store/gameStore';
import { sfx } from '../lib/audio';
import { useReducedMotion } from '../hooks/useReducedMotion';

type Stage = 'transmission' | 'choose' | 'confirm' | 'red' | 'blue';

const TRANSMISSION = [
  'You have found the seams. Most people walk past them every day.',
  'We can show you what is underneath. We cannot make you look.',
  'There are two ways out of this conversation.',
];

const OPTIONS = {
  red: {
    name: 'RED',
    title: 'Discover the truth',
    points: ['Enter the resistance pathway', 'Unlock Training, Agent Detection, Missions and Reality modules', 'The system becomes hostile (+15% threat)'],
  },
  blue: {
    name: 'BLUE',
    title: 'Return to the simulation',
    points: ['End the investigation', 'Anomalies are smoothed over', 'You may question reality again later'],
  },
} as const;

/** Full-screen, branching decision. The choice changes global state, theme and available modules. */
export default function PillSelectionInterface() {
  const s = useGame();
  const reduced = useReducedMotion();
  const [stage, setStage] = useState<Stage>('transmission');
  const [lineCount, setLineCount] = useState(0);
  const [pick, setPick] = useState<'red' | 'blue' | null>(null);
  const [hold, setHold] = useState(0);
  const holdT = useRef<number | null>(null);
  const [seqLine, setSeqLine] = useState(0);

  // transmission lines appear one by one
  useEffect(() => {
    if (stage !== 'transmission') return;
    if (lineCount >= TRANSMISSION.length) { const t = setTimeout(() => setStage('choose'), reduced ? 0 : 900); return () => clearTimeout(t); }
    const t = setTimeout(() => { setLineCount((n) => n + 1); sfx.tick(); }, reduced ? 0 : 1100);
    return () => clearTimeout(t);
  }, [stage, lineCount, reduced]);

  // hold-to-confirm: a deliberate, weighty choice
  const startHold = () => {
    if (holdT.current) return;
    const t0 = performance.now();
    const loop = () => {
      const p = Math.min(1, (performance.now() - t0) / 1400);
      setHold(p);
      if (p >= 1) { holdT.current = null; commit(); return; }
      holdT.current = requestAnimationFrame(loop);
    };
    holdT.current = requestAnimationFrame(loop);
  };
  const stopHold = () => { if (holdT.current) cancelAnimationFrame(holdT.current); holdT.current = null; setHold(0); };

  const commit = () => {
    if (!pick) return;
    s.choosePill(pick);
    sfx.glitch();
    setStage(pick);
  };

  const RED_SEQ = ['Releasing neural restraints…', 'Rerouting signal through resistance relay…', 'Decrypting hidden modules…', 'SIGNAL ACQUIRED. YOU ARE NO LONGER ALONE.'];
  const BLUE_SEQ = ['07:00. The alarm goes off.', 'Coffee. Commute. Inbox: 41 unread.', 'The clocks agree with each other again.', 'Everything is fine.'];
  useEffect(() => {
    if (stage !== 'red' && stage !== 'blue') return;
    const seq = stage === 'red' ? RED_SEQ : BLUE_SEQ;
    if (seqLine >= seq.length) return;
    const t = setTimeout(() => { setSeqLine((n) => n + 1); stage === 'red' ? sfx.key() : sfx.tick(); }, reduced ? 0 : 950);
    return () => clearTimeout(t);
  });

  const close = (to?: 'training' | 'overview') => { s.openDecision(false); if (to) s.setModule(to); };

  return (
    <div className={`fixed inset-0 z-[80] flex items-center justify-center overflow-y-auto p-4 transition-colors duration-1000 ${stage === 'blue' ? 'bg-[#0b1013]/95' : 'bg-mx-black/95'}`} role="dialog" aria-modal="true" aria-label="Decision">
      <div className="w-full max-w-4xl py-8">
        {stage === 'transmission' && (
          <div className="mx-auto max-w-2xl space-y-4 font-mono">
            <p className="text-xs tracking-[0.3em] text-mx-grey">INCOMING TRANSMISSION · ENCRYPTION: NONE</p>
            {TRANSMISSION.slice(0, lineCount).map((l) => <p key={l} className="fade-in text-lg text-mx-pale sm:text-xl">{l}</p>)}
            <span className="cursor" />
            <div><button className="btn mt-4" onClick={() => { setLineCount(TRANSMISSION.length); setStage('choose'); }}>Skip ▸▸</button></div>
          </div>
        )}

        {(stage === 'choose' || stage === 'confirm') && (
          <div className="fade-in">
            <h2 className="font-head mb-2 text-center text-3xl text-mx-white sm:text-5xl">Choose</h2>
            <p className="mb-8 text-center font-mono text-sm text-mx-grey">This choice is saved. It changes the system around you.</p>
            <div className="grid gap-5 sm:grid-cols-2">
              {(['red', 'blue'] as const).map((k) => {
                const o = OPTIONS[k];
                const sel = pick === k;
                return (
                  <button
                    key={k}
                    onClick={() => { setPick(k); setStage('confirm'); sfx.tick(); }}
                    aria-pressed={sel}
                    className={`group tw flex flex-col items-center gap-5 p-6 text-left transition-all duration-300 ${sel ? (k === 'red' ? '!border-mx-red' : '!border-[#5b8bd6]') : ''} ${pick && !sel ? 'opacity-40' : ''}`}
                  >
                    <Capsule color={k} active={sel} />
                    <div className="w-full">
                      <div className={`font-head text-2xl ${k === 'red' ? 'text-[#ff6b77]' : 'text-[#8fb4ee]'}`}>{o.name} PILL</div>
                      <div className="mb-2 font-mono text-sm text-mx-white">{o.title}</div>
                      <ul className="space-y-1 font-mono text-xs text-mx-pale/80">{o.points.map((p) => <li key={p}>— {p}</li>)}</ul>
                    </div>
                  </button>
                );
              })}
            </div>
            {stage === 'confirm' && pick && (
              <div className="fade-in mt-8 flex flex-col items-center gap-3">
                <button
                  className={`btn relative overflow-hidden px-8 py-3 text-sm ${pick === 'red' ? 'btn-danger' : ''}`}
                  onPointerDown={startHold} onPointerUp={stopHold} onPointerLeave={stopHold}
                  onKeyDown={(e) => { if ((e.key === 'Enter' || e.key === ' ') && !e.repeat) { e.preventDefault(); startHold(); } }}
                  onKeyUp={(e) => { if (e.key === 'Enter' || e.key === ' ') stopHold(); }}
                  aria-label={`Hold to take the ${pick} pill`}
                >
                  <span className="absolute inset-y-0 left-0 bg-current opacity-20" style={{ width: `${hold * 100}%` }} />
                  <span className="relative">HOLD TO TAKE THE {pick.toUpperCase()} PILL</span>
                </button>
                <p className="font-mono text-xs text-mx-grey">Press and hold (or hold Enter). Release to reconsider.</p>
              </div>
            )}
          </div>
        )}

        {stage === 'red' && (
          <div className="mx-auto max-w-2xl space-y-3 font-mono">
            {RED_SEQ.slice(0, seqLine).map((l, i) => (
              <p key={l} className={`fade-in ${i === RED_SEQ.length - 1 ? 'font-head pt-4 text-2xl text-accent sm:text-4xl' : 'text-mx-pale'}`}>{l}</p>
            ))}
            {seqLine >= RED_SEQ.length && (
              <div className="fade-in pt-6">
                <p className="mb-2 text-xs tracking-[0.3em] text-mx-grey">MODULES DECRYPTED</p>
                <ul className="mb-6 grid grid-cols-2 gap-2 text-sm text-accent">
                  {['Training Construct', 'Agent Detection', 'Infiltration Missions', 'Reality Manipulation'].map((m) => <li key={m} className="chip !text-xs">{m}</li>)}
                </ul>
                <button className="btn btn-primary" onClick={() => close('training')} autoFocus>Enter the Construct ▸</button>
              </div>
            )}
          </div>
        )}

        {stage === 'blue' && (
          <div className="mx-auto max-w-xl space-y-3 font-sans text-[#d5dde2]">
            {BLUE_SEQ.slice(0, seqLine).map((l) => <p key={l} className="fade-in text-xl">{l}</p>)}
            {seqLine >= BLUE_SEQ.length && (
              <div className="fade-in flex flex-wrap gap-3 pt-6">
                <button className="btn" onClick={() => close('overview')} autoFocus>Return to your life</button>
                <button className="btn" onClick={() => { setStage('transmission'); setLineCount(0); setPick(null); setSeqLine(0); s.reopenInvestigation(); }}>Actually… restart the investigation</button>
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
}

function Capsule({ color, active }: { color: 'red' | 'blue'; active: boolean }) {
  const c = color === 'red' ? ['#ff4d5e', '#a51d2d', '#4a0a12'] : ['#7fb0ff', '#2f5fb3', '#0d2149'];
  return (
    <div className={`relative h-14 w-32 transition-transform duration-500 group-hover:-rotate-6 ${active ? '-rotate-12 scale-110' : 'rotate-[-20deg]'}`} aria-hidden="true">
      <div className="absolute inset-0 rounded-full" style={{ background: `linear-gradient(160deg, ${c[0]} 0%, ${c[1]} 45%, ${c[2]} 100%)`, boxShadow: `0 0 ${active ? 40 : 18}px ${c[1]}88, inset 0 -6px 12px rgba(0,0,0,.45)` }} />
      <div className="absolute left-4 right-6 top-2 h-3 rounded-full bg-white/45 blur-[2px]" />
      <div className="absolute inset-y-1 left-1/2 w-px bg-black/25" />
    </div>
  );
}
