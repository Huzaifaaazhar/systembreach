/** Focus/cooldown meter for bullet time. State is spelled out, not only coloured. */
export default function BulletTimeIndicator({ charge, state }: { charge: number; state: 'ready' | 'active' | 'cooldown' }) {
  const label = state === 'active' ? 'BULLET TIME ACTIVE' : state === 'cooldown' ? 'COOLDOWN' : 'BULLET TIME READY';
  return (
    <div className="min-w-[150px] flex-1 font-mono text-[10px] tracking-[0.15em]">
      <div className="mb-1 flex justify-between">
        <span className={state === 'active' ? 'text-accent' : state === 'cooldown' ? 'text-mx-amber' : 'text-mx-grey'}>{label}</span>
        <span className="text-mx-grey">{Math.round(charge * 100)}%</span>
      </div>
      <div className={`meter ${state === 'cooldown' ? 'amber' : ''}`} role="meter" aria-label="Bullet time charge" aria-valuenow={Math.round(charge * 100)} aria-valuemin={0} aria-valuemax={100}>
        <i style={{ width: `${charge * 100}%`, transition: 'none' }} />
      </div>
    </div>
  );
}
