import { useState } from 'react';
import { ChevronDown, ChevronUp } from 'lucide-react';
import CommandInput from '../CommandInput';
import { useGame } from '../../store/gameStore';
import { MODULES } from '../../data/content';
import { lockReason } from './nav';
import { agentThreat, discoveredCount, escapeProgress, realityIntegrity, transmissionReady } from '../../lib/derived';
import { simulatedId } from '../../lib/identity';
import { sfx } from '../../lib/audio';
import type { ModuleId } from '../../types';

const ALIASES: Record<string, ModuleId> = {
  overview: 'overview', sys: 'overview', identity: 'identity', id: 'identity', diagnostics: 'diagnostics', dx: 'diagnostics', scan: 'diagnostics',
  training: 'training', construct: 'training', agents: 'agents', agent: 'agents', missions: 'missions', mission: 'missions',
  reality: 'reality', lab: 'reality', exit: 'exit',
};

type Out = { t: string; c?: string };

/** The OS command line. Every command performs a real action against game state. */
export default function CommandConsole() {
  const [out, setOut] = useState<Out[]>([{ t: 'Type HELP for commands.', c: 'text-mx-grey' }]);
  const [open, setOpen] = useState(true);
  const print = (...lines: (string | Out)[]) => setOut((o) => [...o, ...lines.map((l) => (typeof l === 'string' ? { t: l } : l))].slice(-60));

  const run = (raw: string) => {
    const s = useGame.getState();
    const [cmd, ...args] = raw.toLowerCase().split(/\s+/);
    print({ t: `> ${raw}`, c: 'text-accent' });
    switch (cmd) {
      case 'help':
        print('open <module>   switch module (overview, identity, diagnostics, training, agents, missions, reality, exit)',
          'status          simulation status', 'whoami          identity summary', 'scan            run a diagnostic scan',
          'transmission    open the incoming transmission', 'sound on|off    toggle sound', 'boot            replay the boot sequence',
          'clear           clear output', 'reset           wipe all progress');
        break;
      case 'open': case 'cd': case 'goto': {
        const id = ALIASES[args[0] ?? ''];
        if (!id) { print({ t: `unknown module '${args[0] ?? ''}'`, c: 'text-mx-amber' }); sfx.err(); break; }
        const lock = lockReason(id, s);
        if (lock) { print({ t: `access denied: ${MODULES.find((m) => m.id === id)!.label} [${lock}]`, c: 'text-[#ff6b77]' }); sfx.err(); break; }
        s.setModule(id); print(`opened ${id}`);
        break;
      }
      case 'status':
        print(`SIMULATION ${s.simulation.status.toUpperCase()} · INTEGRITY ${realityIntegrity(s)}% · THREAT ${Math.round(s.simulation.threat)}% (${agentThreat(s.simulation.threat)})`,
          `ANOMALIES ${discoveredCount(s)} · RESISTANCE ${s.simulation.resistanceConnection ? 'ESTABLISHED' : 'UNESTABLISHED'} · ESCAPE ${escapeProgress(s)}%`);
        break;
      case 'whoami':
        print(`${simulatedId(s.profile.id)}${s.profile.username ? ` alias ${s.profile.username}` : ''} · verification: ${s.pill === 'red' ? 'FLAGGED (RESISTANCE)' : s.scanLevel ? 'INCONSISTENT' : 'UNVERIFIED'}`);
        break;
      case 'scan':
        s.setModule('diagnostics'); print('diagnostics opened. Press RUN SCAN.');
        break;
      case 'transmission': case 'pill':
        if (transmissionReady(s) || s.pill === 'blue') { s.openDecision(true); print('opening transmission...'); }
        else if (s.pill === 'red') print('you already chose.');
        else { print({ t: 'no transmission yet. Confirm three anomalies first.', c: 'text-mx-amber' }); }
        break;
      case 'sound':
        s.setSound(args[0] !== 'off'); print(`sound ${args[0] === 'off' ? 'off' : 'on'}`);
        break;
      case 'boot': s.replayBoot(); break;
      case 'clear': setOut([]); break;
      case 'reset':
        if (confirm('Wipe all progress? This cannot be undone.')) { s.resetAll(); print('memory wiped.'); }
        break;
      default:
        print({ t: `'${cmd}' not recognised. Type HELP.`, c: 'text-mx-amber' }); sfx.err();
    }
  };

  return (
    <div className="border-t border-line bg-mx-black/85">
      <button className="flex w-full items-center gap-2 px-4 py-1.5 font-mono text-[10px] tracking-[0.3em] text-mx-grey hover:text-mx-pale" onClick={() => setOpen(!open)} aria-expanded={open}>
        COMMAND LINE {open ? <ChevronDown size={12} /> : <ChevronUp size={12} />}
      </button>
      {open && (
        <div className="px-4 pb-3">
          <div className="mb-2 max-h-28 overflow-y-auto font-mono text-[11px] leading-5 text-mx-pale/80" aria-live="polite" ref={(el) => { if (el) el.scrollTop = el.scrollHeight; }}>
            {out.map((l, i) => <div key={i} className={`whitespace-pre-wrap ${l.c ?? ''}`}>{l.t}</div>)}
          </div>
          <CommandInput onSubmit={run} suggestions={['help', 'status', 'whoami', 'open diagnostics']} />
        </div>
      )}
    </div>
  );
}
