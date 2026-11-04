import type { Network } from '../lib/network';

/** SVG network map with animated traffic. Nodes are focusable buttons for keyboard users. */
export default function NetworkTopology({ net, selected, onSelect, hop }: { net: Network; selected: string | null; onSelect: (id: string) => void; hop?: [string, string] | null }) {
  const pos = (id: string) => net.nodes.find((n) => n.id === id)!;
  return (
    <svg viewBox="0 0 100 60" className="h-auto w-full" role="group" aria-label="Network topology">
      <defs>
        <pattern id="ngrid" width="5" height="5" patternUnits="userSpaceOnUse"><path d="M5 0H0V5" fill="none" stroke="rgba(27,107,54,.18)" strokeWidth="0.1" /></pattern>
      </defs>
      <rect width="100" height="60" fill="url(#ngrid)" />
      {net.edges.map((e) => {
        const a = pos(e.a), b = pos(e.b);
        const isHop = hop && ((hop[0] === e.a && hop[1] === e.b) || (hop[0] === e.b && hop[1] === e.a));
        return (
          <g key={e.a + e.b}>
            <line x1={a.x} y1={a.y} x2={b.x} y2={b.y} stroke={isHop ? '#A51D2D' : '#1B6B36'} strokeWidth={isHop ? 0.6 : 0.25} />
            <line x1={a.x} y1={a.y} x2={b.x} y2={b.y} stroke={e.suspicious ? '#D6A43B' : '#00C853'} strokeWidth={e.suspicious ? 0.45 : 0.3} className="dash-flow" style={{ animationDuration: e.suspicious ? '0.7s' : '1.6s' }} opacity={e.suspicious ? 0.8 : 0.5} />
          </g>
        );
      })}
      {net.nodes.map((n) => {
        const sel = selected === n.id;
        const color = n.flag === 'agent' ? '#E0303F' : n.flag === 'clear' && !n.hub ? '#718078' : n.hub ? '#00FF41' : '#B9EBC5';
        return (
          <g key={n.id} role="button" tabIndex={0} aria-label={`${n.label}${n.flag ? `, flagged ${n.flag}` : ''}${n.scanned ? ', scanned' : ''}${n.stale ? ', data stale' : ''}`}
            aria-pressed={sel} onClick={() => onSelect(n.id)} onKeyDown={(e) => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); onSelect(n.id); } }}
            className="cursor-pointer outline-none [&:focus-visible>circle:first-child]:stroke-[#00FF41]">
            <circle cx={n.x} cy={n.y} r={sel ? 3.2 : 2.6} fill="#020503" stroke={sel ? '#00FF41' : color} strokeWidth={sel ? 0.6 : 0.4} />
            <circle cx={n.x} cy={n.y} r={1} fill={color} />
            {n.flag === 'agent' && <path d={`M${n.x - 1.6} ${n.y - 1.6}L${n.x + 1.6} ${n.y + 1.6}M${n.x + 1.6} ${n.y - 1.6}L${n.x - 1.6} ${n.y + 1.6}`} stroke="#E0303F" strokeWidth="0.5" />}
            <text x={n.x} y={n.y + 5.2} textAnchor="middle" fontSize="2.2" fill={sel ? '#00FF41' : '#718078'} fontFamily="IBM Plex Mono, monospace">
              {n.label}{n.scanned ? '' : n.stale ? ' ⟳' : ' ?'}
            </text>
          </g>
        );
      })}
    </svg>
  );
}
