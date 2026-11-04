type Tone = 'ok' | 'warn' | 'agent' | 'idle';
const MARK: Record<Tone, string> = { ok: '●', warn: '▲', agent: '■', idle: '○' };
const COLOR: Record<Tone, string> = { ok: 'text-accent', warn: 'text-mx-amber', agent: 'text-[#ff6b77]', idle: 'text-mx-grey' };

/** Label/value pair. State is conveyed by a shape and a word, not just colour. */
export default function SystemStatusIndicator({ label, value, tone = 'ok', hint }: { label: string; value: string; tone?: Tone; hint?: string }) {
  return (
    <div className="flex flex-wrap items-baseline justify-between gap-x-3 border-b border-soft py-1.5 font-mono text-xs last:border-0" title={hint}>
      <span className="tracking-[0.12em] text-mx-grey">{label}</span>
      <span className={`ml-auto whitespace-nowrap ${COLOR[tone]}`}>
        <span aria-hidden="true" className="mr-1.5 text-[9px]">{MARK[tone]}</span>
        {value}
      </span>
    </div>
  );
}
