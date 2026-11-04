import { useState } from 'react';
import TerminalWindow from '../components/TerminalWindow';
import NetworkTopology from '../components/NetworkTopology';
import AgentThreatPanel from '../components/AgentThreatPanel';
import { useGame } from '../store/gameStore';
import { agentHop, CONFIG, generateNetwork, remainingAgents, tellCount, type Network } from '../lib/network';
import { INTEL } from '../data/content';
import { sfx } from '../lib/audio';
import type { Difficulty } from '../types';

type LogLine = { t: string; c?: string };

export default function AgentDetection() {
  const s = useGame();
  const [diff, setDiff] = useState<Difficulty | null>(null);
  const [net, setNet] = useState<Network | null>(null);
  const [sel, setSel] = useState<string | null>(null);
  const [scans, setScans] = useState(0);
  const [mistakes, setMistakes] = useState(0);
  const [correct, setCorrect] = useState(0);
  const [log, setLog] = useState<LogLine[]>([]);
  const [hop, setHop] = useState<[string, string] | null>(null);
  const [over, setOver] = useState<null | 'won' | 'lost'>(null);
  const [, force] = useState(0);

  const locked: Record<Difficulty, string | null> = {
    easy: null,
    medium: s.missions.m01.status === 'completed' ? null : 'Complete Mission 01',
    hard: s.missions.m04.status === 'completed' ? null : 'Complete Mission 04',
  };

  const start = (d: Difficulty) => {
    const n = generateNetwork(d);
    setDiff(d); setNet(n); setScans(n.scans); setMistakes(0); setCorrect(0); setSel(null); setHop(null); setOver(null);
    setLog([{ t: `Monitoring ${n.nodes.length - 1} hosts. ${n.agents} Agent${n.agents > 1 ? 's' : ''} suspected on this segment.` }]);
    sfx.ok();
  };
  const say = (t: string, c?: string) => setLog((l) => [{ t, c }, ...l].slice(0, 30));
  const node = net && sel ? net.nodes.find((n) => n.id === sel)! : null;

  const finish = (won: boolean, c: number, m: number) => {
    setOver(won ? 'won' : 'lost');
    s.agentResult(diff!, c, m, won);
    won ? sfx.win() : sfx.err();
  };

  const scan = () => {
    if (!net || !node || node.scanned || scans <= 0 || over) return;
    node.scanned = true; node.stale = false;
    const left = scans - 1; setScans(left); sfx.tick();
    say(`scan ${node.label}: jitter ${node.props.beaconJitterMs} ms · latency ${node.props.latencyMs} ms · signature ${node.props.signatureMatch ? 'match' : 'MISMATCH'}`);
    // hard mode: Agents hand off between adjacent hosts every third scan, and the log says where from
    if (CONFIG[net.difficulty].hops && (net.scans - left) % 3 === 0) {
      const h = agentHop(net);
      if (h) {
        const from = net.nodes.find((n) => n.id === h[0])!;
        setHop(h); say(`!! PACKET HANDOFF from ${from.label} to an adjacent host. Earlier readings on both may be stale.`, 'text-[#ff6b77]'); sfx.alert();
        s.addThreat(2);
      }
    }
    force((x) => x + 1);
  };

  const flag = (as: 'agent' | 'clear') => {
    if (!net || !node || node.flag || over || node.hub) return;
    node.flag = as;
    let c = correct, m = mistakes;
    if (as === 'agent' && node.agent) { c++; setCorrect(c); say(`AGENT ISOLATED at ${node.label}.`, 'text-accent'); sfx.ok(); s.addThreat(-3, 'Agent isolated'); }
    else if (as === 'agent') { m++; setMistakes(m); say(`${node.label} was a civilian host. False accusation logged.`, 'text-mx-amber'); s.addThreat(6, 'false Agent flag'); }
    else if (node.agent) { m++; setMistakes(m); say(`${node.label} was an Agent. It saw you mark it clear.`, 'text-[#ff6b77]'); s.addThreat(10, 'Agent missed'); node.flag = 'agent'; c++; setCorrect(c); }
    else { say(`${node.label} marked clear.`); sfx.tick(); }
    force((x) => x + 1);
    if (m >= 3) { say('Trace exposed: too many mistakes. Operation aborted.', 'text-[#ff6b77]'); finish(false, c, m); }
    else if (remainingAgents(net) === 0) { say(m === 0 ? 'Segment clean. No mistakes.' : 'Segment clean.', 'text-accent'); finish(m < 3, c, m); }
  };

  if (!net || !diff) {
    return (
      <div className="mx-auto grid max-w-6xl gap-4 lg:grid-cols-[1.4fr_1fr]">
        <TerminalWindow title="Agent Detection" code="AG.04">
          <p className="mb-4 font-mono text-sm text-mx-pale/85">Agents take over ordinary hosts. Watch a network segment, scan hosts and isolate every Agent. Wrong calls raise the threat level.</p>
          <div className="mb-4 border border-soft p-3 font-mono text-xs text-mx-pale/85">
            <p className="mb-1 text-mx-grey">DETECTION RULE. An Agent shows at least two of these three tells:</p>
            <p>1. Beacon jitter below 1 ms (machine-perfect timing)</p>
            <p>2. Latency below the 4 ms physical floor of this route</p>
            <p>3. Signature MISMATCH with the registered owner</p>
            <p className="mt-1 text-mx-grey">Amber links carry irregular traffic. That is a hint, not proof.</p>
          </div>
          <div className="grid gap-2 sm:grid-cols-3">
            {(['easy', 'medium', 'hard'] as Difficulty[]).map((d) => (
              <button key={d} className="btn flex-col !items-start !py-3 text-left" disabled={!!locked[d]} onClick={() => start(d)}>
                <span>{d.toUpperCase()} {s.agentGame.cleared.includes(d) ? '✓' : ''}</span>
                <span className="text-[10px] normal-case tracking-normal text-mx-grey">{locked[d] ?? `${CONFIG[d].nodes} hosts · ${CONFIG[d].agents} agent${CONFIG[d].agents > 1 ? 's' : ''} · ${CONFIG[d].scans} scans${CONFIG[d].hops ? ' · agents move' : ''}`}</span>
              </button>
            ))}
          </div>
        </TerminalWindow>
        <div className="grid content-start gap-4">
          <TerminalWindow title="Agent Threat" code="THR"><AgentThreatPanel /></TerminalWindow>
          <TerminalWindow title="Intelligence" code="INT">
            <p className="mb-2 font-mono text-[11px] text-mx-grey">Record: {s.agentGame.correct} isolated · {s.agentGame.wrong} mistakes</p>
            <ul className="space-y-1.5 font-mono text-xs text-mx-pale/85">
              {s.intel.length ? s.intel.map((i) => <li key={i}>▸ {INTEL[i]}</li>) : <li className="text-mx-grey">No intelligence recovered yet.</li>}
            </ul>
          </TerminalWindow>
        </div>
      </div>
    );
  }

  const tells = node ? tellCount(node.props, net.latencyFloor) : 0;
  const showTells = diff === 'easy';
  return (
    <div className="mx-auto grid max-w-6xl gap-4 lg:grid-cols-[1.5fr_1fr]">
      <TerminalWindow title={`Network Segment · ${diff.toUpperCase()}`} code="AG.04" right={<span className="font-mono text-[10px] text-mx-grey">SCANS {scans} · AGENTS LEFT {remainingAgents(net)} · MISTAKES {mistakes}/3</span>}>
        <NetworkTopology net={net} selected={sel} onSelect={(id) => { setSel(id); sfx.tick(); }} hop={hop} />
        <p className="mt-2 font-mono text-[10px] text-mx-grey">? = not scanned · ⟳ = stale data · amber link = irregular traffic · ✕ = isolated Agent</p>
      </TerminalWindow>
      <div className="grid content-start gap-4">
        <TerminalWindow title="Host Inspector" code="INS" tone={node?.flag === 'agent' ? 'agent' : 'default'}>
          {!node ? <p className="font-mono text-xs text-mx-grey">Select a host on the map.</p> : (
            <div className="font-mono text-xs">
              <p className="mb-2 text-sm text-mx-white">{node.label} {node.hub && <span className="text-mx-grey">(your terminal)</span>}</p>
              {node.scanned ? (
                <dl className="mb-3 space-y-1">
                  <Row k="Beacon jitter" v={`${node.props.beaconJitterMs} ms`} tell={showTells && node.props.beaconJitterMs < 1} />
                  <Row k="Latency" v={`${node.props.latencyMs} ms`} tell={showTells && node.props.latencyMs < net.latencyFloor} />
                  <Row k="Signature" v={node.props.signatureMatch ? 'match' : 'MISMATCH'} tell={showTells && !node.props.signatureMatch} />
                  <Row k="Uptime" v={node.props.uptime} />
                  <Row k="Traffic" v={node.props.traffic} />
                  {showTells && <p className="pt-1 text-mx-amber">{tells} of 3 tells present</p>}
                </dl>
              ) : <p className="mb-3 text-mx-grey">{node.stale ? 'Readings are stale since the last handoff. Rescan.' : 'Not scanned. Each scan uses one of your scans.'}</p>}
              {!over && !node.hub && (
                <div className="flex flex-wrap gap-2">
                  <button className="btn !min-h-9" onClick={scan} disabled={node.scanned || scans <= 0}>Scan ({scans})</button>
                  <button className="btn btn-danger !min-h-9" onClick={() => flag('agent')} disabled={!!node.flag}>Flag Agent</button>
                  <button className="btn !min-h-9" onClick={() => flag('clear')} disabled={!!node.flag}>Mark clear</button>
                </div>
              )}
            </div>
          )}
        </TerminalWindow>
        {over && (
          <TerminalWindow title={over === 'won' ? 'Segment Secured' : 'Operation Aborted'} code="RES" tone={over === 'won' ? 'default' : 'agent'}>
            <p className="mb-3 font-mono text-xs text-mx-pale">Agents isolated: {correct} · mistakes: {mistakes}. {over === 'won' ? 'New intelligence recovered.' : 'Try again; the segment will be different.'}</p>
            <div className="flex flex-wrap gap-2">
              <button className="btn btn-primary" onClick={() => start(diff)}>New segment</button>
              <button className="btn" onClick={() => { setNet(null); setDiff(null); }}>Change difficulty</button>
            </div>
          </TerminalWindow>
        )}
        <TerminalWindow title="Surveillance Log" code="LOG">
          <ul className="max-h-48 space-y-1 overflow-y-auto font-mono text-[11px]" aria-live="polite">
            {log.map((l, i) => <li key={i} className={l.c ?? 'text-mx-pale/80'}>{l.t}</li>)}
          </ul>
        </TerminalWindow>
        {!over && <button className="btn self-start" onClick={() => { setNet(null); setDiff(null); }}>Abandon segment</button>}
      </div>
    </div>
  );
}

function Row({ k, v, tell }: { k: string; v: string; tell?: boolean }) {
  return <div className="flex justify-between gap-2"><dt className="text-mx-grey">{k}</dt><dd className={tell ? 'text-mx-amber' : 'text-mx-pale'}>{tell ? '▲ ' : ''}{v}</dd></div>;
}
