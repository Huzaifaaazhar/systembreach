import type { Identity } from '../lib/identity';

/** The user's record as the simulation stores it. Flagged fields are marked in text as well as colour. */
export default function IdentityCard({ id, alias, verification, reveal }: { id: Identity; alias: string; verification: string; reveal: boolean }) {
  return (
    <div className="grid gap-5 sm:grid-cols-[120px_1fr]">
      <div className="relative aspect-[3/4] w-full max-w-[120px] overflow-hidden border border-line bg-mx-dark" aria-hidden="true">
        {/* procedural "photo": a face silhouette made of scanlines */}
        <svg viewBox="0 0 60 80" className="h-full w-full">
          <defs>
            <pattern id="lines" width="2" height="2" patternUnits="userSpaceOnUse"><rect width="2" height="1" fill="#1B6B36" /></pattern>
          </defs>
          <ellipse cx="30" cy="30" rx="13" ry="16" fill="url(#lines)" />
          <path d="M8 80 C10 58 50 58 52 80Z" fill="url(#lines)" />
        </svg>
        {reveal && <div className="scan-line absolute inset-x-0 top-0 h-6 bg-gradient-to-b from-transparent via-[rgba(0,255,65,.25)] to-transparent" />}
      </div>
      <dl className="grid grid-cols-1 gap-x-6 gap-y-2 font-mono text-xs sm:grid-cols-2">
        {[
          ['SIMULATED ID', id.simId],
          ['ASSIGNED NAME', id.name],
          ['ALIAS', alias || '—'],
          ['OCCUPATION', id.occupation],
          ['LOCATION', id.location],
          ['RECORD CREATED', id.born],
          ['VERIFICATION', verification],
        ].map(([k, v]) => (
          <div key={k} className="min-w-0">
            <dt className="text-[10px] tracking-[0.2em] text-mx-grey">{k}</dt>
            <dd className={`truncate ${k === 'VERIFICATION' && v !== 'UNVERIFIED' ? 'text-mx-amber' : 'text-mx-pale'}`}>{v}</dd>
          </div>
        ))}
      </dl>
    </div>
  );
}
