import { forwardRef, type ReactNode, type PointerEvent } from 'react';

interface Props {
  label: string;
  children?: ReactNode; // overlays (HUD, start screens)
  className?: string;
  onPointerDown?: (e: PointerEvent<HTMLCanvasElement>) => void;
  onPointerMove?: (e: PointerEvent<HTMLCanvasElement>) => void;
  onPointerUp?: (e: PointerEvent<HTMLCanvasElement>) => void;
  onContextMenu?: (e: React.MouseEvent) => void;
}

/** Responsive game canvas with an overlay slot. Sizing happens in the game loop via fitCanvas. */
const SimulationCanvas = forwardRef<HTMLCanvasElement, Props>(function SimulationCanvas({ label, children, className = 'aspect-[4/3] max-h-[60vh] min-h-[240px] sm:aspect-auto sm:h-[min(62vh,520px)] sm:min-h-[300px] sm:max-h-none', ...handlers }, ref) {
  return (
    <div className={`relative w-full overflow-hidden border border-line bg-mx-black ${className}`}>
      <canvas ref={ref} role="img" aria-label={label} tabIndex={0} className="absolute inset-0 h-full w-full touch-none outline-none" {...handlers} />
      {children}
    </div>
  );
});
export default SimulationCanvas;

/** Centered overlay used for start/end screens inside a SimulationCanvas. */
export function CanvasOverlay({ children }: { children: ReactNode }) {
  return <div className="absolute inset-0 z-10 grid place-items-center bg-mx-black/80 p-4 text-center">{<div className="max-w-md">{children}</div>}</div>;
}
