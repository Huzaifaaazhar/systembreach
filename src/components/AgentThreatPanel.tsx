import { useEffect, useState } from 'react';
import { useGame } from '../store/gameStore';
import { agentThreat } from '../lib/derived';

/** Threat gauge, history sparkline and live agent pings whose frequency follows the threat level. */
export default function AgentThreatPanel() {
  const threat = useGame((s) => s.simulation.threat);
  const hist = useGame((s) => s.threatHistory);
  const label = agentThreat(threat);
  const [pings, setPings] = useState<{ id: number; x: number; y: number }[]>([]);

  useEffect(() => {
    if (threat < 10) { setPings([]); return; }
    const every = Math.max(500, 3200 - threat * 26);
    const t = setInterval(() => {
      setPings((p) => [...p.slice(-5), { id: Date.now(), x: 8 + Math.random() * 84, y: 15 + Math.random() * 70 }]);
    }, every);
    return () => clearInterval(t);
  }, [threat]);

  const pts = hist.slice(-30);
  const path = pts.map((v, i) => `${(i / Math.max(1, pts.length - 1)) * 100},${40 - (v / 100) * 38}`).join(' ');
  const tone = threat >= 75 ? 'red' : threat >= 45 ? 'amber' : '';

  return (
    <div>
      <div className="flex items-baseline justify-between font-mono text-xs">
        <span className="text-mx-grey">THREAT LEVEL</span>
        <span className={threat >= 75 ? 'text-[#ff6b77]' : threat >= 45 ? 'text-mx-amber' : 'text-accent'}>{Math.round(threat)}% · {label}</span>
      </div>
      <div className={`meter mt-1 ${tone}`} role="meter" aria-valuenow={Math.round(threat)} aria-valuemin={0} aria-valuemax={100} aria-label="Threat level"><i style={{ width: `${threat}%` }} /></div>
      <div className="relative mt-3 h-14 overflow-hidden border border-soft bg-mx-black/60">
        <svg viewBox="0 0 100 40" preserveAspectRatio="none" className="absolute inset-0 h-full w-full" aria-hidden="true">
          <polyline points={path} fill="none" stroke={threat >= 75 ? '#A51D2D' : '#1B6B36'} strokeWidth="1" vectorEffect="non-scaling-stroke" />
        </svg>
        {pings.map((p) => (
          <span key={p.id} className="fade-in absolute h-1.5 w-1.5 rounded-full bg-mx-red" style={{ left: `${p.x}%`, top: `${p.y}%`, boxShadow: '0 0 8px #A51D2D' }} />
        ))}
        <span className="absolute bottom-0.5 right-1 font-mono text-[9px] text-mx-grey">AGENT PINGS {threat < 10 ? 'NONE' : `${Math.round(60000 / Math.max(500, 3200 - threat * 26))}/MIN`}</span>
      </div>
    </div>
  );
}
