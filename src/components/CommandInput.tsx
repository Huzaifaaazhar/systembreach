import { useRef, useState, type KeyboardEvent } from 'react';
import { sfx } from '../lib/audio';

interface Props {
  prompt?: string;
  onSubmit: (cmd: string) => void;
  suggestions?: string[];
  autoFocus?: boolean;
  label?: string;
}

/** Single-line terminal command input with history and clickable suggestions. */
export default function CommandInput({ prompt = '>', onSubmit, suggestions = [], autoFocus, label = 'Terminal command' }: Props) {
  const [value, setValue] = useState('');
  const hist = useRef<string[]>([]);
  const idx = useRef(0);

  const submit = (v: string) => {
    const cmd = v.trim();
    if (!cmd) return;
    hist.current.push(cmd); idx.current = hist.current.length;
    setValue('');
    onSubmit(cmd);
  };
  const onKey = (e: KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'Enter') submit(value);
    else if (e.key === 'ArrowUp' && hist.current.length) { e.preventDefault(); idx.current = Math.max(0, idx.current - 1); setValue(hist.current[idx.current]); }
    else if (e.key === 'ArrowDown' && hist.current.length) { e.preventDefault(); idx.current = Math.min(hist.current.length, idx.current + 1); setValue(hist.current[idx.current] ?? ''); }
  };

  return (
    <div className="font-mono">
      <label className="flex items-center gap-2 text-sm">
        <span className="text-accent">{prompt}</span>
        <span className="sr-only">{label}</span>
        <input
          value={value}
          autoFocus={autoFocus}
          onChange={(e) => { setValue(e.target.value); sfx.key(); }}
          onKeyDown={onKey}
          spellCheck={false}
          autoComplete="off"
          autoCapitalize="off"
          className="min-w-0 flex-1 bg-transparent text-mx-pale caret-[var(--accent)] outline-none placeholder:text-mx-grey/60"
          placeholder="type help"
          aria-label={label}
        />
      </label>
      {suggestions.length > 0 && (
        <div className="mt-2 flex flex-wrap gap-1.5">
          {suggestions.map((s) => (
            <button key={s} type="button" className="chip text-mx-grey hover:border-[var(--accent)] hover:text-[var(--accent)]" onClick={() => { sfx.tick(); submit(s); }}>
              {s}
            </button>
          ))}
        </div>
      )}
    </div>
  );
}
