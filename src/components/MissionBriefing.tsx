import type { MissionDef } from '../data/content';
import TerminalWindow from './TerminalWindow';

export default function MissionBriefing({ def, onStart, onBack }: { def: MissionDef; onStart: () => void; onBack: () => void }) {
  return (
    <TerminalWindow title={`Briefing · ${def.title}`} code={def.id.toUpperCase()} className="mx-auto max-w-3xl">
      <div className="space-y-4 font-mono text-sm">
        <p className="text-mx-pale">{def.briefing}</p>
        <div className="grid gap-4 sm:grid-cols-2">
          <Field k="TARGET" v={def.target} />
          <Field k="DIFFICULTY" v={`${'▮'.repeat(def.difficulty)}${'▯'.repeat(5 - def.difficulty)} (${def.difficulty}/5)`} />
          <div><div className="text-[10px] tracking-[0.2em] text-mx-grey">OBJECTIVES</div><ol className="list-inside list-decimal text-xs text-mx-pale/90">{def.objectives.map((o) => <li key={o}>{o}</li>)}</ol></div>
          <div><div className="text-[10px] tracking-[0.2em] text-mx-grey">AVAILABLE TOOLS</div><ul className="text-xs text-mx-pale/90">{def.tools.map((t) => <li key={t}>▸ {t}</li>)}</ul></div>
          <Field k="COMPLETION CONDITION" v={def.completion} />
          <Field k="REWARD" v={def.reward} accent />
        </div>
        <div className="flex flex-wrap gap-2 pt-2">
          <button className="btn btn-primary" onClick={onStart}>Begin mission ▸</button>
          <button className="btn" onClick={onBack}>Back to missions</button>
        </div>
      </div>
    </TerminalWindow>
  );
}

function Field({ k, v, accent }: { k: string; v: string; accent?: boolean }) {
  return <div><div className="text-[10px] tracking-[0.2em] text-mx-grey">{k}</div><div className={`text-xs ${accent ? 'text-accent' : 'text-mx-pale/90'}`}>{v}</div></div>;
}
