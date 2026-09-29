/** Where a note sits in the kit, used to pick a drum sound. */
export type Role = 'low' | 'mid' | 'high';

export interface Meter {
  /** Beats per bar (the top number). */
  beats: number;
  /** Note value of one beat (the bottom number). Tempo is counted in this unit. */
  unit: 4 | 8;
  /** Beat indexes (0-based) that get an accent / low drum. */
  strong: number[];
}

export interface Note {
  /** Position in beats from the start of the pattern. */
  beat: number;
  role: Role;
}

export interface Pattern {
  meter: Meter;
  bars: number;
  notes: Note[];
}

export type Grade = 'perfect' | 'good' | 'off' | 'miss';

export const METERS: Record<string, Meter> = {
  '4/4': { beats: 4, unit: 4, strong: [0, 2] },
  '3/4': { beats: 3, unit: 4, strong: [0] },
  '6/8': { beats: 6, unit: 8, strong: [0, 3] },
  '5/4': { beats: 5, unit: 4, strong: [0, 3] },
  '7/8': { beats: 7, unit: 8, strong: [0, 2, 4] },
};

export function patternBeats(p: Pattern): number {
  return p.meter.beats * p.bars;
}
