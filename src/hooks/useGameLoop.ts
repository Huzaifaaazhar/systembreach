import { useEffect, useRef } from 'react';

/**
 * requestAnimationFrame loop that pauses while the tab is hidden and clamps dt,
 * so games never jump after the user switches away.
 */
export function useGameLoop(step: (dt: number, now: number) => void, active = true) {
  const ref = useRef(step);
  ref.current = step;
  useEffect(() => {
    if (!active) return;
    let raf = 0;
    let last = performance.now();
    const frame = (now: number) => {
      raf = requestAnimationFrame(frame);
      if (document.hidden) { last = now; return; }
      const dt = Math.min(0.05, (now - last) / 1000);
      last = now;
      ref.current(dt, now);
    };
    raf = requestAnimationFrame(frame);
    return () => cancelAnimationFrame(raf);
  }, [active]);
}
