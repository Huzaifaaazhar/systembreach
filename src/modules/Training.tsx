import { useState } from 'react';
import TerminalWindow from '../components/TerminalWindow';
import { useGame } from '../store/gameStore';
import { TRAINING } from '../data/content';
import type { TrainingId } from '../types';
import CombatGame from '../games/CombatGame';
import BulletTimeGame from '../games/BulletTimeGame';
import ReflexGame from '../games/ReflexGame';
import MovementGame from '../games/MovementGame';
import { sfx } from '../lib/audio';

export default function Training() {
  const s = useGame();
  const [tab, setTab] = useState<TrainingId>('combat');
  const btBonus = s.missions.m03.status === 'completed' ? 1.25 : 1;

  const abilities: [string, number][] = [
    ['Combat', s.abilities.combat], ['Bullet time', s.abilities.bulletTime], ['Reflex', s.abilities.reflexScore],
    ['Movement', s.abilities.movementSkill], ['Simulation control', s.abilities.simulationControl],
  ];

  return (
    <div className="mx-auto grid max-w-6xl gap-4 xl:grid-cols-[1fr_250px]">
      <TerminalWindow title="Training Construct" code="TC.03" bodyClassName="p-3 sm:p-4">
        <div role="tablist" aria-label="Training scenarios" className="mb-3 flex flex-wrap gap-1.5">
          {TRAINING.map((t) => (
            <button key={t.id} role="tab" aria-selected={tab === t.id} onClick={() => { setTab(t.id); sfx.tick(); }} className={`btn !min-h-9 ${tab === t.id ? 'on' : ''}`}>
              {t.title}{s.records.completed[t.id] ? ' ✓' : ''}
            </button>
          ))}
        </div>
        <p className="mb-3 font-mono text-xs text-mx-pale/80">{TRAINING.find((t) => t.id === tab)!.blurb}</p>
        <div role="tabpanel" key={tab}>
          {tab === 'combat' && <CombatGame onFinish={(r) => s.recordTraining('combat', { score: r.score })} />}
          {tab === 'bullet' && <BulletTimeGame durationBonus={btBonus} onFinish={(r) => s.recordTraining('bullet', { score: r.score, extra: r.reactionMs ?? undefined })} />}
          {tab === 'reflex' && <ReflexGame onFinish={(r) => s.recordTraining('reflex', { score: r.accuracy, extra: r.avgMs })} />}
          {tab === 'movement' && <MovementGame onFinish={(r) => s.recordTraining('movement', { score: r.score, extra: r.level })} />}
        </div>
      </TerminalWindow>

      <div className="grid content-start gap-4 sm:grid-cols-2 xl:grid-cols-1">
        <TerminalWindow title="Player Abilities" code="ABL">
          <ul className="space-y-2.5 font-mono text-xs">
            {abilities.map(([k, v]) => (
              <li key={k}>
                <div className="mb-1 flex justify-between"><span>{k}</span><span className="text-accent">{v}</span></div>
                <div className="meter"><i style={{ width: `${v}%` }} /></div>
              </li>
            ))}
          </ul>
        </TerminalWindow>
        <TerminalWindow title="Records" code="REC">
          <dl className="space-y-1 font-mono text-xs">
            <div className="flex justify-between"><dt className="text-mx-grey">Combat best</dt><dd>{s.records.combatBest || '—'}</dd></div>
            <div className="flex justify-between"><dt className="text-mx-grey">Bullet time best</dt><dd>{s.records.bulletBest || '—'}</dd></div>
            <div className="flex justify-between"><dt className="text-mx-grey">Volley reaction</dt><dd>{s.records.bulletReactionMs ? `${Math.round(s.records.bulletReactionMs)} ms` : '—'}</dd></div>
            <div className="flex justify-between"><dt className="text-mx-grey">Reflex best avg</dt><dd>{s.records.reflexBestMs ? `${s.records.reflexBestMs} ms` : '—'}</dd></div>
            <div className="flex justify-between"><dt className="text-mx-grey">Movement level</dt><dd>{s.records.movementLevel || '—'}/5</dd></div>
            {btBonus > 1 && <p className="pt-2 text-accent">Evasion protocol active: bullet time +25%.</p>}
          </dl>
        </TerminalWindow>
      </div>
    </div>
  );
}
