import { useEffect, useRef } from 'react';
import { bindKeyboard, createInput, type InputState } from '../lib/input';

/** One InputState per game, fed by the keyboard and (optionally) TrainingControls. */
export function useInput(active = true): InputState {
  const ref = useRef<InputState>(null);
  if (!ref.current) ref.current = createInput();
  useEffect(() => {
    if (!active) return;
    return bindKeyboard(ref.current!);
  }, [active]);
  return ref.current;
}
