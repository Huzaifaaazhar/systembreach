import { useEffect, useRef, useState } from 'react';
import { sfx } from '../lib/audio';
import { useGame } from '../store/gameStore';
import { rand } from '../lib/canvas';

export interface ReflexResult { avgMs: number; accuracy: number; bestMs: number; trials: number }
type Kind = 'visual' | 'audio' | 'decoy';
type Trial = { kind: Kind; rt: number | null; correct: boolean; early?: boolean };
const TRIALS = 16;

/**
 * Go / no-go reflex test with randomised visual and audio signals.
 * Respond to GREEN or the high tone. Ignore AMBER decoys. Pressing early counts as a false start.
 */
export default function ReflexGame({ onFinish, trials = TRIALS, compact = false }: { onFinish: (r: ReflexResult) => void; trials?: number; compact?: boolean }) {
  const sound = useGame((s) => s.settings.sound);
  const history = useGame((s) => s.records.reflexHistory);
  const best = useGame((s) => s.records.reflexBestMs);
  const [phase, setPhase] = useState<'ready' | 'wait' | 'signal' | 'feedback' | 'done'>('ready');
  const [kind, setKind] = useState<Kind>('visual');
  const [log, setLog] = useState<Trial[]>([]);
  const [msg, setMsg] = useState('');
  const shownAt = useRef(0);
  const timer = useRef<number>(undefined);
  const phaseRef = useRef(phase); phaseRef.current = phase;
  const kindRef = useRef(kind); kindRef.current = kind;
  const logRef = useRef(log); logRef.current = log;

  useEffect(() => () => clearTimeout(timer.current), []);

  const next = (l: Trial[]) => {
    if (l.length >= trials) return finish(l);
    setPhase('wait');
    timer.current = window.setTimeout(() => {
      const r = Math.random();
      const k: Kind = r < 0.25 ? 'decoy' : r < 0.55 && sound ? 'audio' : 'visual';
      setKind(k); setPhase('signal'); shownAt.current = performance.now();
      if (k === 'audio') sfx.signal(); if (k === 'decoy') sfx.block();
      // decoys and misses resolve themselves after a window
      timer.current = window.setTimeout(() => {
        if (phaseRef.current !== 'signal') return;
        record(k === 'decoy' ? { kind: k, rt: null, correct: true } : { kind: k, rt: null, correct: false }, k === 'decoy' ? 'Decoy ignored. Correct.' : 'Missed.');
      }, k === 'decoy' ? 1100 : 1400);
    }, rand(900, 2600));
  };

  const record = (t: Trial, m: string) => {
    clearTimeout(timer.current);
    const l = [...logRef.current, t]; setLog(l); setMsg(m); setPhase('feedback');
    timer.current = window.setTimeout(() => next(l), 650);
  };

  const finish = (l: Trial[]) => {
    const hits = l.filter((t) => t.rt != null && t.correct).map((t) => t.rt!);
    const avg = hits.length ? Math.round(hits.reduce((a, b) => a + b, 0) / hits.length) : 999;
    const r = { avgMs: avg, accuracy: Math.round((l.filter((t) => t.correct).length / l.length) * 100), bestMs: hits.length ? Math.round(Math.min(...hits)) : 999, trials: l.length };
    setPhase('done'); sfx.win(); onFinish(r);
  };

  const respond = () => {
    const p = phaseRef.current;
    if (p === 'wait') { clearTimeout(timer.current); record({ kind: 'visual', rt: null, correct: false, early: true }, 'False start. Wait for the signal.'); sfx.err(); return; }
    if (p !== 'signal') return;
    const rt = performance.now() - shownAt.current;
    if (kindRef.current === 'decoy') { record({ kind: 'decoy', rt, correct: false }, 'That was a decoy.'); sfx.err(); }
    else { record({ kind: kindRef.current, rt, correct: true }, `${Math.round(rt)} ms`); sfx.tick(); }
  };

  useEffect(() => {
    const k = (e: KeyboardEvent) => { if (e.code === 'Space' && phaseRef.current !== 'ready' && phaseRef.current !== 'done') { e.preventDefault(); respond(); } };
    addEventListener('keydown', k); return () => removeEventListener('keydown', k);
  });

  const start = () => { setLog([]); setMsg(''); next([]); };
  const done = log.filter((t) => t.rt != null && t.correct);
  const avg = done.length ? Math.round(done.reduce((a, t) => a + t.rt!, 0) / done.length) : null;
  const acc = log.length ? Math.round((log.filter((t) => t.correct).length / log.length) * 100) : null;

  return (
    <div className={compact ? '' : 'grid gap-4 lg:grid-cols-[1fr_260px]'}>
      <div>
        <button
          onPointerDown={(e) => { e.preventDefault(); if (phase !== 'ready' && phase !== 'done') respond(); }}
          className={`relative grid w-full place-items-center border font-mono transition-colors ${compact ? 'h-56' : 'h-[min(52vh,420px)] min-h-[280px]'} ${
            phase === 'signal' && kind === 'visual' ? 'border-mx-green bg-[rgba(0,255,65,.35)]' :
            phase === 'signal' && kind === 'decoy' ? 'border-mx-amber bg-[rgba(214,164,59,.3)]' :
            phase === 'signal' && kind === 'audio' ? 'border-line bg-mx-dark' : 'border-line bg-mx-black'}`}
          aria-label="Reflex pad. Press Space or tap when the signal appears."
          aria-live="assertive"
        >
          {phase === 'ready' && <span className="text-sm text-mx-pale">Press start, then react with SPACE or a tap</span>}
          {phase === 'wait' && <span className="text-sm text-mx-grey">wait…</span>}
          {phase === 'signal' && <span className={`font-head text-4xl ${kind === 'decoy' ? 'text-mx-amber' : 'text-mx-white'}`}>{kind === 'visual' ? 'GO ●' : kind === 'audio' ? '♪' : 'HOLD ▲'}</span>}
          {phase === 'feedback' && <span className="text-xl text-mx-pale">{msg}</span>}
          {phase === 'done' && <span className="text-xl text-accent">Avg {avg ?? '—'} ms · accuracy {acc}%</span>}
          <span className="absolute bottom-2 right-3 text-[11px] text-mx-grey">{log.length}/{trials}</span>
        </button>
        <div className="mt-3 flex flex-wrap items-center gap-3">
          {(phase === 'ready' || phase === 'done') && <button className="btn btn-primary" onClick={start}>{phase === 'done' ? 'Test again' : 'Start test'}</button>}
          <span className="font-mono text-[11px] text-mx-grey">GREEN or high tone ♪: react. AMBER: do not react. {sound ? '' : 'Sound is off, so only visual signals are used.'}</span>
        </div>
      </div>
      {!compact && (
        <div className="font-mono text-xs">
          <div className="mb-1 tracking-[0.2em] text-mx-grey">THIS RUN</div>
          <p>Average: <span className="text-accent">{avg ?? '—'} ms</span> · Accuracy: <span className="text-accent">{acc ?? '—'}%</span></p>
          <div className="mb-1 mt-4 tracking-[0.2em] text-mx-grey">PERSONAL RECORD</div>
          <p>Best average: <span className="text-accent">{best ?? '—'} ms</span></p>
          <div className="mb-1 mt-4 tracking-[0.2em] text-mx-grey">HISTORY (AVG MS)</div>
          <div className="flex h-24 items-end gap-1 border-b border-l border-line p-1" role="img" aria-label="Reflex history chart">
            {history.map((h) => <div key={h.at} title={`${h.avgMs} ms, ${h.accuracy}%`} className="flex-1 bg-[var(--accent)]" style={{ height: `${Math.max(6, Math.min(100, (700 - h.avgMs) / 5))}%`, opacity: 0.4 + h.accuracy / 170 }} />)}
          </div>
          <p className="mt-1 text-[10px] text-mx-grey">Taller is faster. {history.length} runs logged.</p>
        </div>
      )}
    </div>
  );
}
