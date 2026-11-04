import { useEffect, useRef, useState } from 'react';
import { sfx } from '../lib/audio';
import { useGame } from '../store/gameStore';
import { simulatedId } from '../lib/identity';
import { useReducedMotion } from '../hooks/useReducedMotion';

type Line = { text: string; cls?: string; speed?: number; pause?: number; dots?: boolean };

function script(simId: string): Line[] {
  return [
    { text: 'NIC/BIOS 4.07  NEURAL INTERFACE CONTROLLER', cls: 'text-mx-grey', speed: 8 },
    { text: 'MEMORY CHECK ................ 65536K OK', cls: 'text-mx-grey', speed: 6, pause: 200 },
    { text: `SUBJECT TERMINAL ............ ${simId}`, speed: 10 },
    { text: 'HOST LOCATION ............... METRO GRID / SECTOR 12', speed: 10, pause: 300 },
    { text: '' },
    { text: 'CONNECTION DIAGNOSTICS', cls: 'text-accent', speed: 14 },
    { text: '  latency ................... 12 ms', speed: 6, dots: true },
    { text: '  packet integrity .......... 99.97 %', speed: 6, dots: true },
    { text: '  carrier ................... UNREGISTERED', cls: 'text-mx-amber', speed: 6, dots: true },
    { text: '  route ..................... ████████', cls: 'text-mx-amber', speed: 6, dots: true, pause: 500 },
    { text: '' },
    { text: '!! TERMINAL ACTIVATED WITHOUT AUTHORISATION', cls: 'text-[#ff6b77]', speed: 18, pause: 600 },
    { text: 'INCOMING TRANSMISSION ......  SOURCE UNKNOWN', speed: 16, pause: 700 },
    { text: '  > the patterns you keep noticing are not in your head.', cls: 'text-mx-pale', speed: 38, pause: 500 },
    { text: '  > someone wrote them. we can show you who.', cls: 'text-mx-pale', speed: 38, pause: 900 },
    { text: '' },
    { text: 'WAKE UP.', cls: 'text-accent text-3xl sm:text-5xl font-semibold', speed: 120, pause: 600 },
    { text: 'THE SYSTEM IS NOT WHAT IT SEEMS.', cls: 'text-accent text-lg sm:text-2xl', speed: 55 },
  ];
}

export default function BootSequence() {
  const completeBoot = useGame((s) => s.completeBoot);
  const profileId = useGame((s) => s.profile.id);
  const reduced = useReducedMotion();
  const lines = useRef(script(simulatedId(profileId)));
  const [shown, setShown] = useState<string[]>([]);
  const [phase, setPhase] = useState<'black' | 'typing' | 'ready'>('black');
  const skipRef = useRef(false);

  useEffect(() => {
    let alive = true;
    const wait = (ms: number) => new Promise((r) => setTimeout(r, skipRef.current ? 0 : ms));
    (async () => {
      await wait(900);
      if (!alive) return;
      setPhase('typing');
      await wait(700);
      for (let i = 0; i < lines.current.length; i++) {
        const l = lines.current[i];
        setShown((s) => [...s, '']);
        if (reduced || skipRef.current) {
          setShown((s) => { const n = [...s]; n[i] = l.text; return n; });
        } else {
          for (let c = 1; c <= l.text.length; c++) {
            if (!alive) return;
            if (skipRef.current) { setShown((s) => { const n = [...s]; n[i] = l.text; return n; }); break; }
            setShown((s) => { const n = [...s]; n[i] = l.text.slice(0, c); return n; });
            const ch = l.text[c - 1];
            if (ch !== ' ' && ch !== '.') sfx.key();
            // realistic cadence: jitter, longer after punctuation
            await wait((l.speed ?? 24) * (0.6 + Math.random() * 0.8) + (/[.,]/.test(ch) && !l.dots ? 90 : 0));
          }
        }
        await wait(l.pause ?? 140);
      }
      if (alive) setPhase('ready');
    })();
    return () => { alive = false; };
  }, [reduced]);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') skip();
      if (e.key === 'Enter' && phase === 'ready') enter();
    };
    addEventListener('keydown', onKey);
    return () => removeEventListener('keydown', onKey);
  });

  const skip = () => { skipRef.current = true; sfx.tick(); };
  const enter = () => { sfx.ok(); completeBoot(); };

  return (
    <div className="fixed inset-0 z-50 flex flex-col bg-mx-black/90 font-mono" role="dialog" aria-label="System initialisation">
      <div className={`absolute inset-0 bg-mx-black transition-opacity duration-[1500ms] ${phase === 'black' ? 'opacity-100' : 'opacity-40'}`} />
      {phase !== 'ready' && (
        <button className="btn absolute right-4 top-4 z-10" onClick={skip} aria-label="Skip boot sequence">
          SKIP ▸▸ <span className="text-mx-grey">ESC</span>
        </button>
      )}
      <div className="relative z-[1] mx-auto flex w-full max-w-3xl flex-1 flex-col justify-center overflow-y-auto px-5 py-16 text-[13px] leading-6 sm:text-sm">
        {shown.map((t, i) => (
          <div key={i} className={`min-h-6 whitespace-pre-wrap ${lines.current[i].cls ?? 'text-mx-phosphor'}`}>
            {t}
            {i === shown.length - 1 && phase === 'typing' && <span className="cursor ml-0.5" />}
          </div>
        ))}
        {phase === 'ready' && (
          <div className="fade-in mt-8">
            <button className="btn btn-primary px-6 py-3 text-sm" onClick={enter} autoFocus>
              ENTER THE SYSTEM ▸
            </button>
            <p className="mt-3 text-xs text-mx-grey">Press Enter. Returning sessions skip this sequence automatically.</p>
          </div>
        )}
      </div>
    </div>
  );
}
