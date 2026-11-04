// Development-only handles for automated browser tests (Playwright). Not present in production builds.
type Bag = Record<string, unknown>;
export const debugBag: Bag | null = import.meta.env.DEV ? (((window as unknown as { __sb?: Bag }).__sb ??= {})) : null;
export const expose = (key: string, value: unknown) => { if (debugBag) debugBag[key] = value; };
