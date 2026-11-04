import { useEffect, useRef, useState } from 'react';
import { useGame } from '../store/gameStore';
import type { SystemAlert as Alert } from '../types';
import { sfx } from '../lib/audio';

const TAG: Record<Alert['level'], [string, string]> = {
  info: ['INFO', 'text-mx-pale border-soft'],
  warn: ['WARN', 'text-mx-amber border-mx-amber/60'],
  agent: ['AGENT', 'text-[#ff6b77] border-mx-red'],
  success: ['OK', 'text-accent border-line'],
};

export function AlertRow({ a }: { a: Alert }) {
  const [tag, cls] = TAG[a.level];
  return (
    <li className="flex gap-2 py-1 font-mono text-[11px] leading-4">
      <span className={`chip shrink-0 !text-[9px] ${cls}`}>{tag}</span>
      <span className="text-mx-pale/85">{a.text}</span>
    </li>
  );
}

/** Toast for the newest alert. Lives in the corner and announces to screen readers. */
export function AlertToast() {
  const alerts = useGame((s) => s.alerts);
  const [cur, setCur] = useState<Alert | null>(null);
  const seen = useRef<string | null>(alerts[0]?.id ?? null);
  useEffect(() => {
    const top = alerts[0];
    if (!top || top.id === seen.current) return;
    seen.current = top.id;
    setCur(top);
    if (top.level === 'agent') sfx.alert();
    const t = setTimeout(() => setCur(null), 3200);
    return () => clearTimeout(t);
  }, [alerts]);
  const [tag, cls] = cur ? TAG[cur.level] : ['', ''];
  return (
    <div role="status" aria-live="polite" className="pointer-events-none fixed bottom-20 left-1/2 z-[70] w-[min(92vw,520px)] -translate-x-1/2 lg:bottom-6">
      {cur && (
        <div className={`fade-in tw flex items-start gap-2 px-3 py-2 font-mono text-xs ${cur.level === 'agent' ? 'border-mx-red' : ''}`}>
          <span className={`chip shrink-0 ${cls}`}>{tag}</span>
          <span className="text-mx-pale">{cur.text}</span>
        </div>
      )}
    </div>
  );
}
