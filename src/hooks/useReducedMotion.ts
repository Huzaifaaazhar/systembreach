import { useEffect, useState } from 'react';
import { useGame } from '../store/gameStore';

/** Honours prefers-reduced-motion unless the user overrides it in settings. */
export function useReducedMotion() {
  const override = useGame((s) => s.settings.reducedMotion);
  const [media, setMedia] = useState(() => typeof matchMedia !== 'undefined' && matchMedia('(prefers-reduced-motion: reduce)').matches);
  useEffect(() => {
    if (typeof matchMedia === 'undefined') return;
    const q = matchMedia('(prefers-reduced-motion: reduce)');
    const on = () => setMedia(q.matches);
    q.addEventListener('change', on);
    return () => q.removeEventListener('change', on);
  }, []);
  return override ?? media;
}
