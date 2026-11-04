import { MoreHorizontal } from 'lucide-react';
import { useGame } from '../../store/gameStore';
import { ICONS } from './nav';
import type { ModuleId } from '../../types';
import { sfx } from '../../lib/audio';

const PRIMARY: { id: ModuleId; label: string }[] = [
  { id: 'overview', label: 'System' },
  { id: 'diagnostics', label: 'Scan' },
  { id: 'training', label: 'Train' },
  { id: 'missions', label: 'Missions' },
];

/** Bottom navigation for phones: four primary modules plus a drawer for the rest. */
export default function MobileNav({ onMore }: { onMore: () => void }) {
  const active = useGame((s) => s.activeModule);
  const setModule = useGame((s) => s.setModule);
  return (
    <nav aria-label="Primary" className="relative z-10 grid grid-cols-5 border-t border-line bg-mx-black/95 pb-[env(safe-area-inset-bottom)] md:hidden">
      {PRIMARY.map(({ id, label }) => {
        const Icon = ICONS[id];
        const on = active === id;
        return (
          <button key={id} onClick={() => { sfx.tick(); setModule(id); }} aria-current={on ? 'page' : undefined}
            className={`flex min-h-14 flex-col items-center justify-center gap-1 font-mono text-[10px] tracking-wider ${on ? 'text-accent' : 'text-mx-grey'}`}>
            <Icon size={18} aria-hidden="true" />{label}
          </button>
        );
      })}
      <button onClick={onMore} className="flex min-h-14 flex-col items-center justify-center gap-1 font-mono text-[10px] tracking-wider text-mx-grey">
        <MoreHorizontal size={18} aria-hidden="true" />More
      </button>
    </nav>
  );
}
