import { Activity, Atom, DoorOpen, Fingerprint, Radar, ScanLine, Swords, Target, type LucideIcon } from 'lucide-react';
import type { ModuleId } from '../../types';
import type { GameData } from '../../store/gameStore';
import { exitUnlocked } from '../../lib/derived';

export const ICONS: Record<ModuleId, LucideIcon> = {
  overview: Activity, identity: Fingerprint, diagnostics: ScanLine, training: Swords,
  agents: Radar, missions: Target, reality: Atom, exit: DoorOpen,
};

/** Why a module is unavailable, or null if it can be opened. */
export function lockReason(id: ModuleId, s: GameData): string | null {
  const advanced = ['training', 'agents', 'missions', 'reality', 'exit'].includes(id);
  if (advanced && s.pill === 'blue') return 'SUPPRESSED';
  if (advanced && s.pill !== 'red') return 'ENCRYPTED';
  if (id === 'exit' && !exitUnlocked(s)) return 'REQUIRES M05';
  return null;
}
