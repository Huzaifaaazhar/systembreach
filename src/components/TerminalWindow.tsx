import type { ReactNode } from 'react';

interface Props {
  title: string;
  code?: string;
  right?: ReactNode;
  children: ReactNode;
  className?: string;
  bodyClassName?: string;
  tone?: 'default' | 'agent' | 'warn';
}

/** The framed window used everywhere: title bar with a system code, then a body. */
export default function TerminalWindow({ title, code, right, children, className = '', bodyClassName = 'p-4', tone = 'default' }: Props) {
  const toneCls = tone === 'agent' ? 'border-mx-red pulse-red' : tone === 'warn' ? 'border-mx-amber' : '';
  return (
    <section className={`tw flex min-w-0 flex-col ${toneCls} ${className}`} aria-label={title}>
      <header className="tw-title flex items-center gap-3 px-3 py-1.5">
        <span className="font-mono text-[11px] tracking-[0.2em] text-mx-grey">{code ?? '//'}</span>
        <h2 className="font-head truncate text-sm text-accent">{title}</h2>
        <span className="ml-auto flex items-center gap-2">{right}</span>
      </header>
      <div className={`relative min-h-0 flex-1 ${bodyClassName}`}>{children}</div>
    </section>
  );
}
