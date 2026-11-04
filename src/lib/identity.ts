import { hashString, seeded } from './canvas';

const FIRST = ['Adrian', 'Mara', 'Tomas', 'Ines', 'Viktor', 'Lena', 'Rafael', 'Noor', 'Elias', 'Sana'];
const LAST = ['Halvorsen', 'Okafor', 'Brandt', 'Varga', 'Lindqvist', 'Moreau', 'Castell', 'Ivers', 'Duarte', 'Kessler'];
const JOBS = ['Systems analyst, Meridian Insurance', 'Night-shift network technician', 'Junior software developer, Vantage Corp', 'Data-entry clerk, City Records Office', 'Help-desk operator, Cortex Telecom'];
const PLACES = ['Apt 1207, Halvorsen Tower, Metro Grid', 'Unit 4B, 88 Castell Ave, Metro Grid', 'Room 12, Ivers Residences, Old Quarter'];
const TRAITS = ['Compliance', 'Curiosity', 'Pattern sensitivity', 'Sleep regularity', 'Routine adherence', 'Signal susceptibility'];

export function simulatedId(profileId: string) {
  const h = hashString(profileId);
  return `SUBJ-${(h % 0xffff).toString(16).toUpperCase().padStart(4, '0')}-${((h >>> 16) % 9000 + 1000)}`;
}

export interface Identity {
  simId: string;
  name: string;
  occupation: string;
  location: string;
  born: string;
  history: { year: number; event: string; flag?: boolean }[];
  traits: { name: string; value: number; flagged: boolean }[];
}

/** Deterministic fictional identity for a profile, so it is stable across sessions. */
export function buildIdentity(profileId: string): Identity {
  const r = seeded(hashString(profileId));
  const p = <T,>(a: T[]) => a[Math.floor(r() * a.length)];
  const name = `${p(FIRST)} ${p(LAST)}`;
  const year = 1990 + Math.floor(r() * 9);
  return {
    simId: simulatedId(profileId),
    name,
    occupation: p(JOBS),
    location: p(PLACES),
    born: `${year}-${String(1 + Math.floor(r() * 12)).padStart(2, '0')}-${String(1 + Math.floor(r() * 28)).padStart(2, '0')}`,
    history: [
      { year, event: 'Instance initialised. Birth record generated.' },
      { year: year + 6, event: 'School placement assigned (district template B).' },
      { year: year + 17, event: 'Residence reassigned. Prior address records purged.', flag: true },
      { year: year + 22, event: 'Employment template applied.' },
      { year: year + 26, event: 'Behavioural drift detected. Monitoring raised to tier 2.', flag: true },
    ],
    traits: TRAITS.map((t) => {
      const v = Math.round(20 + r() * 75);
      const flagged = (t === 'Curiosity' || t === 'Pattern sensitivity' || t === 'Signal susceptibility') && v > 45;
      return { name: t, value: t === 'Curiosity' ? Math.max(v, 78) : v, flagged: t === 'Curiosity' ? true : flagged };
    }),
  };
}
