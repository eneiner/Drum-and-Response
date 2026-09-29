import { createRng, pickWeighted, type Rng } from './rng';
import type { Meter, Note, Pattern, Role } from './types';

/** A rhythm that fills exactly one beat. Offsets are fractions of the beat (0 ≤ x < 1). */
export interface Cell {
  id: string;
  offsets: number[];
}

const T = 1 / 3;
export const CELLS = {
  quarter: { id: 'quarter', offsets: [0] },
  rest: { id: 'rest', offsets: [] },
  eighths: { id: 'eighths', offsets: [0, 0.5] },
  offbeat: { id: 'offbeat', offsets: [0.5] },
  sixteens: { id: 'sixteens', offsets: [0, 0.25, 0.5, 0.75] },
  eighthTwoSixteenths: { id: 'eighthTwoSixteenths', offsets: [0, 0.5, 0.75] },
  twoSixteenthsEighth: { id: 'twoSixteenthsEighth', offsets: [0, 0.25, 0.5] },
  dotted: { id: 'dotted', offsets: [0, 0.75] },
  syncSixteenths: { id: 'syncSixteenths', offsets: [0.25, 0.5, 0.75] },
  triplet: { id: 'triplet', offsets: [0, T, 2 * T] },
  swing: { id: 'swing', offsets: [0, 2 * T] },
  tripletUp: { id: 'tripletUp', offsets: [T, 2 * T] },
} as const satisfies Record<string, Cell>;

export type CellId = keyof typeof CELLS;

/** Rules that control how hard a generated pattern is. */
export interface Difficulty {
  meter: Meter;
  bars: number;
  /** Relative likelihood of each allowed cell. */
  cells: Partial<Record<CellId, number>>;
  /** Minimum notes in the whole pattern. */
  minNotes?: number;
}

/**
 * Build a random pattern one beat at a time from the allowed cells.
 * Guarantees: the first note lands on beat 1 (so the player has an anchor),
 * every bar has at least one note, and the pattern has at least `minNotes`.
 */
export function generatePattern(d: Difficulty, rng: Rng = createRng()): Pattern {
  const entries = (Object.entries(d.cells) as [CellId, number][]).filter(([, w]) => w > 0);
  if (entries.length === 0) throw new Error('Difficulty needs at least one cell');

  for (let attempt = 0; attempt < 50; attempt++) {
    const notes: Note[] = [];
    for (let bar = 0; bar < d.bars; bar++) {
      for (let beat = 0; beat < d.meter.beats; beat++) {
        const [id] = pickWeighted(rng, entries, ([, w]) => w);
        const cell: Cell = CELLS[id];
        const start = bar * d.meter.beats + beat;
        for (const off of cell.offsets) {
          notes.push({ beat: start + off, role: roleFor(d.meter, beat, off) });
        }
      }
    }
    if (isPlayable(notes, d)) return { meter: d.meter, bars: d.bars, notes };
  }
  return fallbackPattern(d);
}

function isPlayable(notes: Note[], d: Difficulty): boolean {
  const minNotes = d.minNotes ?? Math.max(2, d.meter.beats - 1);
  if (notes.length < minNotes) return false;
  if (notes[0]?.beat !== 0) return false;
  for (let bar = 0; bar < d.bars; bar++) {
    const lo = bar * d.meter.beats;
    const hi = lo + d.meter.beats;
    if (!notes.some((n) => n.beat >= lo && n.beat < hi)) return false;
  }
  return true;
}

function fallbackPattern(d: Difficulty): Pattern {
  const notes: Note[] = [];
  for (let b = 0; b < d.bars * d.meter.beats; b++) {
    notes.push({ beat: b, role: roleFor(d.meter, b % d.meter.beats, 0) });
  }
  return { meter: d.meter, bars: d.bars, notes };
}

export function roleFor(meter: Meter, beatInBar: number, offset: number): Role {
  if (offset > 0) return 'high';
  if (meter.strong.includes(beatInBar)) return beatInBar === 0 ? 'low' : 'mid';
  return 'mid';
}

/** Shortest gap between two notes, in beats. Used to keep timing windows unambiguous. */
export function minGapBeats(p: Pattern): number {
  let min = Infinity;
  for (let i = 1; i < p.notes.length; i++) {
    min = Math.min(min, p.notes[i].beat - p.notes[i - 1].beat);
  }
  return min;
}

export function samePattern(a: Pattern, b: Pattern): boolean {
  return (
    a.bars === b.bars &&
    a.meter === b.meter &&
    a.notes.length === b.notes.length &&
    a.notes.every((n, i) => Math.abs(n.beat - b.notes[i].beat) < 1e-9)
  );
}
