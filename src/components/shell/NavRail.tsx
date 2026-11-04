import { Lock } from 'lucide-react';
import { MODULES } from '../../data/content';
import { useGame } from '../../store/gameStore';
import { sfx } from '../../lib/audio';
import { ICONS, lockReason } from './nav';
import type { ModuleId } from '../../types';

/** Primary navigation, styled as the OS's process list. */
export default function NavRail({ collapsed = false, onNavigate }: { collapsed?: boolean; onNavigate?: () => void }) {
  const s = useGame();
  const go = (id: ModuleId) => { sfx.tick(); s.setModule(id); onNavigate?.(); };
  return (
    <nav aria-label="System modules" className="font-mono">
      {!collapsed && <div className="px-3 pb-2 text-[10px] tracking-[0.3em] text-mx-grey">PROCESSES</div>}
      <ul className="space-y-0.5">
        {MODULES.map((m) => {
          const Icon = ICONS[m.id];
          const lock = lockReason(m.id, s);
          const active = s.activeModule === m.id;
          return (
            <li key={m.id}>
              <button
                onClick={() => go(m.id)}
                aria-current={active ? 'page' : undefined}
                aria-label={collapsed ? `${m.label}${lock ? `, ${lock}` : ''}` : undefined}
                title={collapsed ? `${m.label}${lock ? ` (${lock})` : ''}` : undefined}
                className={`group flex w-full items-center gap-3 border-l-2 px-3 py-2.5 text-left text-xs transition-colors ${
                  active ? 'border-[var(--accent)] bg-[rgba(0,200,83,0.09)] text-accent' : 'border-transparent text-mx-pale/80 hover:bg-[rgba(0,200,83,0.05)] hover:text-mx-pale'
                } ${lock ? 'opacity-60' : ''}`}
              >
                <Icon size={16} aria-hidden="true" className="shrink-0" />
                {!collapsed && (
                  <>
                    <span className="min-w-0 flex-1">
                      <span className="block truncate tracking-wide">{m.label}</span>
                      <span className="block text-[10px] text-mx-grey">{lock ? `[${lock}]` : m.code}</span>
                    </span>
                    {lock && <Lock size={12} aria-label="locked" className="text-mx-grey" />}
                  </>
                )}
              </button>
            </li>
          );
        })}
      </ul>
    </nav>
  );
}
