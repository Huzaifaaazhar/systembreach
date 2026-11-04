import { Suspense, lazy, useEffect, useState, type ComponentType } from 'react';
import { Gauge, Menu, Settings2, Volume2, VolumeX, X } from 'lucide-react';
import DigitalRainBackground, { rainControl } from './components/DigitalRainBackground';
import BootSequence from './components/BootSequence';
import NavRail from './components/shell/NavRail';
import MonitorPanel from './components/shell/MonitorPanel';
import CommandConsole from './components/shell/CommandConsole';
import MobileNav from './components/shell/MobileNav';
import LockedModule from './components/shell/LockedModule';
import LockdownScreen from './components/shell/LockdownScreen';
import PillSelectionInterface from './components/PillSelectionInterface';
import { AlertToast } from './components/SystemAlert';
import { lockReason } from './components/shell/nav';
import { useGame } from './store/gameStore';
import { useReducedMotion } from './hooks/useReducedMotion';
import { sfx } from './lib/audio';
import { MODULES } from './data/content';
import type { ModuleId } from './types';
import Overview from './modules/Overview';
import Identity from './modules/Identity';
import Diagnostics from './modules/Diagnostics';
import Training from './modules/Training';
import AgentDetection from './modules/AgentDetection';
import Missions from './modules/Missions';

// 3D modules are split out so the first load stays light.
const Reality = lazy(() => import('./modules/Reality'));
const ExitProtocol = lazy(() => import('./modules/ExitProtocol'));

const VIEWS: Record<ModuleId, ComponentType> = {
  overview: Overview, identity: Identity, diagnostics: Diagnostics, training: Training,
  agents: AgentDetection, missions: Missions, reality: Reality, exit: ExitProtocol,
};

export default function App() {
  const s = useGame();
  const reduced = useReducedMotion();
  const [drawer, setDrawer] = useState<null | 'nav' | 'monitor' | 'settings'>(null);
  const [navCollapsed, setNavCollapsed] = useState(false);

  // phase theming + accessibility flags on <html>
  useEffect(() => {
    const el = document.documentElement;
    el.dataset.phase = s.pill === 'red' ? 'red' : s.pill === 'blue' ? 'blue' : 'sim';
    el.dataset.reducedMotion = String(reduced);
  }, [s.pill, reduced]);
  useEffect(() => { rainControl.alert = Math.max(0, (s.simulation.threat - 50) / 50); }, [s.simulation.threat]);

  useEffect(() => {
    const unlock = () => sfx.unlock();
    addEventListener('pointerdown', unlock, { once: true });
    addEventListener('keydown', unlock, { once: true });
    return () => { removeEventListener('pointerdown', unlock); removeEventListener('keydown', unlock); };
  }, []);

  const showBoot = !s.profile.bootComplete || s.bootReplay;
  const mod = MODULES.find((m) => m.id === s.activeModule)!;
  const lock = lockReason(s.activeModule, s);
  const View = VIEWS[s.activeModule];

  return (
    <div className="crt fixed inset-0 flex flex-col">
      <DigitalRainBackground />
      {showBoot ? <BootSequence /> : (
        <>
          <header className="relative z-10 flex items-center gap-3 border-b border-line bg-mx-black/80 px-3 py-2 backdrop-blur-[2px] sm:px-4">
            <button className="btn !min-h-9 !px-2 md:hidden" aria-label="Open navigation" onClick={() => setDrawer('nav')}><Menu size={16} /></button>
            <button className="btn !min-h-9 !px-2 hidden md:inline-flex xl:hidden" aria-label={navCollapsed ? 'Expand navigation' : 'Collapse navigation'} onClick={() => setNavCollapsed(!navCollapsed)}><Menu size={16} /></button>
            <div className="min-w-0">
              <div className="font-head truncate text-base leading-none text-accent sm:text-lg">THE MATRIX<span className="hidden sm:inline"> <span className="text-mx-grey">—</span> SYSTEM BREACH</span></div>
              <div className="truncate font-mono text-[10px] tracking-[0.25em] text-mx-grey">{mod.code} · {mod.label.toUpperCase()}</div>
            </div>
            <div className="ml-auto flex items-center gap-2">
              <span className="hidden font-mono text-[10px] tracking-[0.2em] sm:inline">
                {s.pill === 'red' ? <span className="text-accent">● AWAKE</span> : s.pill === 'blue' ? <span className="text-mx-grey">○ COMPLIANT</span> : <span className="text-mx-amber">▲ MONITORED</span>}
              </span>
              <button className="btn !min-h-9 !px-2 xl:hidden" aria-label="Open system monitor" onClick={() => setDrawer('monitor')}><Gauge size={16} /></button>
              <button className="btn !min-h-9 !px-2" aria-label={s.settings.sound ? 'Mute sound' : 'Unmute sound'} onClick={() => s.setSound(!s.settings.sound)}>
                {s.settings.sound ? <Volume2 size={16} /> : <VolumeX size={16} />}
              </button>
              <button className="btn !min-h-9 !px-2" aria-label="Settings" onClick={() => setDrawer('settings')}><Settings2 size={16} /></button>
            </div>
          </header>

          <div className="relative z-[1] flex min-h-0 flex-1">
            <aside className={`hidden shrink-0 overflow-y-auto border-r border-line bg-mx-black/75 py-3 md:block ${navCollapsed ? 'w-14' : 'w-60'} xl:w-60`}>
              <NavRail collapsed={navCollapsed} />
            </aside>
            <main className="flex min-w-0 flex-1 flex-col" id="workspace">
              <div className="min-h-0 flex-1 overflow-y-auto overflow-x-hidden p-3 pb-6 sm:p-5" key={s.activeModule + (lock ?? '')}>
                <div className={reduced ? '' : 'glitch-enter'}>
                  {s.lockdown ? <LockdownScreen /> : lock ? <LockedModule id={s.activeModule} reason={lock} /> : (
                    <Suspense fallback={<p className="font-mono text-sm text-mx-grey">Loading module<span className="cursor ml-1" /></p>}>
                      <View />
                    </Suspense>
                  )}
                </div>
              </div>
              <div className="hidden md:block"><CommandConsole /></div>
            </main>
            <div className="hidden w-72 shrink-0 border-l border-line bg-mx-black/75 xl:block">
              <MonitorPanel />
            </div>
          </div>
          <MobileNav onMore={() => setDrawer('nav')} />

          {drawer && (
            <div className="fixed inset-0 z-[65] flex bg-mx-black/70" onClick={() => setDrawer(null)}>
              <div
                className={`fade-in flex h-full w-[min(88vw,360px)] flex-col border-line bg-mx-deep ${drawer === 'nav' ? 'border-r' : 'ml-auto border-l'}`}
                onClick={(e) => e.stopPropagation()}
                role="dialog"
                aria-label={drawer === 'nav' ? 'Navigation' : drawer === 'monitor' ? 'System monitor' : 'Settings'}
              >
                <div className="flex items-center justify-between border-b border-line px-4 py-3">
                  <span className="font-head text-accent">{drawer === 'nav' ? 'Modules' : drawer === 'monitor' ? 'System Monitor' : 'Settings'}</span>
                  <button className="btn !min-h-9 !px-2" aria-label="Close" onClick={() => setDrawer(null)}><X size={16} /></button>
                </div>
                <div className="min-h-0 flex-1 overflow-y-auto">
                  {drawer === 'nav' && <div className="py-3"><NavRail onNavigate={() => setDrawer(null)} /><div className="mt-4 md:hidden"><CommandConsole /></div></div>}
                  {drawer === 'monitor' && <MonitorPanel />}
                  {drawer === 'settings' && <SettingsPanel close={() => setDrawer(null)} />}
                </div>
              </div>
            </div>
          )}
          {s.showDecision && <PillSelectionInterface />}
          <AlertToast />
        </>
      )}
    </div>
  );
}

function SettingsPanel({ close }: { close: () => void }) {
  const s = useGame();
  const reduced = useReducedMotion();
  return (
    <div className="space-y-4 p-4 font-mono text-xs">
      <label className="flex items-center justify-between gap-3">
        <span>Sound effects</span>
        <button className={`btn ${s.settings.sound ? 'on' : ''}`} aria-pressed={s.settings.sound} onClick={() => s.setSound(!s.settings.sound)}>{s.settings.sound ? 'ON' : 'OFF'}</button>
      </label>
      <label className="flex items-center justify-between gap-3">
        <span>Reduced motion {s.settings.reducedMotion === null && <span className="text-mx-grey">(system)</span>}</span>
        <button className={`btn ${reduced ? 'on' : ''}`} aria-pressed={reduced} onClick={() => s.setReducedMotion(!reduced)}>{reduced ? 'ON' : 'OFF'}</button>
      </label>
      <button className="btn w-full" onClick={() => { s.replayBoot(); close(); }}>Replay boot sequence</button>
      <button className="btn btn-danger w-full" onClick={() => { if (confirm('Wipe all progress? This cannot be undone.')) { s.resetAll(); close(); } }}>Wipe all progress</button>
      <p className="text-mx-grey">Progress is stored locally in this browser. Nothing is sent anywhere.</p>
      <p className="text-mx-grey">Unofficial fan project inspired by The Matrix. Not affiliated with Warner Bros. All text and code are original.</p>
    </div>
  );
}
