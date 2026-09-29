import type { Difficulty } from './patterns';
import { METERS } from './types';

export interface Tier {
  name: string;
  /** Short hint shown when the tier starts. */
  tip: string;
  /** Tempo of the first level in this tier. */
  baseBpm: number;
  make: (levelInTier: number) => Difficulty;
}

export const LEVELS_PER_TIER = 4;
export const BPM_STEP = 5;
export const MAX_BPM = 200;

const m44 = METERS['4/4'];

export const TIERS: Tier[] = [
  {
    name: 'Quarter notes',
    tip: 'One clap per beat. Lock in with the click.',
    baseBpm: 70,
    make: () => ({ meter: m44, bars: 1, cells: { quarter: 1 }, minNotes: 4 }),
  },
  {
    name: 'Eighth notes',
    tip: 'Some beats split in two. Count "1 and 2 and".',
    baseBpm: 76,
    make: () => ({ meter: m44, bars: 1, cells: { quarter: 3, eighths: 2 } }),
  },
  {
    name: 'Rests',
    tip: 'Silence counts! Don\'t clap on the gaps.',
    baseBpm: 80,
    make: () => ({ meter: m44, bars: 1, cells: { quarter: 3, eighths: 2, rest: 1.5 } }),
  },
  {
    name: 'Two bars',
    tip: 'Longer phrases. Remember the whole thing.',
    baseBpm: 82,
    make: () => ({ meter: m44, bars: 2, cells: { quarter: 3, eighths: 2, rest: 1.5 } }),
  },
  {
    name: 'Syncopation',
    tip: 'Claps land between the beats. Feel the off-beat.',
    baseBpm: 84,
    make: (n) => ({
      meter: m44,
      bars: n < 2 ? 1 : 2,
      cells: { quarter: 2, eighths: 2, rest: 1, offbeat: 2 },
    }),
  },
  {
    name: 'Sixteenth fills',
    tip: 'Quick bursts of four. Stay relaxed.',
    baseBpm: 78,
    make: (n) => ({
      meter: m44,
      bars: n < 2 ? 1 : 2,
      cells: {
        quarter: 3,
        eighths: 2,
        rest: 1,
        offbeat: 1,
        sixteens: 1,
        eighthTwoSixteenths: 1,
        twoSixteenthsEighth: 1,
        dotted: 1,
      },
    }),
  },
  {
    name: 'Triplets & swing',
    tip: 'Three to a beat, or a lazy long-short swing.',
    baseBpm: 80,
    make: (n) => ({
      meter: m44,
      bars: n < 2 ? 1 : 2,
      cells: { quarter: 3, rest: 1, triplet: 2, swing: 2, tripletUp: n >= 2 ? 1 : 0 },
    }),
  },
  {
    name: 'Odd meters',
    tip: '5/4 and 7/8. Count every beat out loud.',
    baseBpm: 88,
    make: (n) => ({
      meter: n % 2 === 0 ? METERS['5/4'] : METERS['7/8'],
      bars: 1,
      cells: { quarter: 4, eighths: 2, rest: 1, offbeat: 1 },
    }),
  },
];

export interface LevelInfo {
  level: number;
  tierIndex: number;
  tier: Tier;
  levelInTier: number;
  bpm: number;
  difficulty: Difficulty;
  /** True for the first level of a tier (show the tip). */
  newTier: boolean;
}

/**
 * Levels are 1-based. Each tier has LEVELS_PER_TIER levels that speed up by BPM_STEP.
 * After the last tier the game keeps going: tiers cycle from Syncopation onward,
 * each lap faster than the last.
 */
export function levelInfo(level: number): LevelInfo {
  const idx = Math.max(0, level - 1);
  const rawTier = Math.floor(idx / LEVELS_PER_TIER);
  const levelInTier = idx % LEVELS_PER_TIER;
  let tierIndex = rawTier;
  let lapBonus = 0;
  if (rawTier >= TIERS.length) {
    const loopStart = 4;
    const loopLen = TIERS.length - loopStart;
    const past = rawTier - TIERS.length;
    tierIndex = loopStart + (past % loopLen);
    lapBonus = (Math.floor(past / loopLen) + 1) * 12;
  }
  const tier = TIERS[tierIndex];
  const bpm = Math.min(MAX_BPM, tier.baseBpm + levelInTier * BPM_STEP + lapBonus);
  return {
    level,
    tierIndex,
    tier,
    levelInTier,
    bpm,
    difficulty: tier.make(levelInTier),
    newTier: levelInTier === 0,
  };
}

export type Complexity = 'easy' | 'medium' | 'hard' | 'random';

/** Cell sets for Freedom mode. Meter and bars come from the player's settings. */
export function freedomCells(c: Exclude<Complexity, 'random'>, unit: 4 | 8): Difficulty['cells'] {
  // In x/8 meters a beat is already an eighth note, so keep subdivisions simple.
  if (unit === 8) {
    if (c === 'easy') return { quarter: 4, rest: 1 };
    if (c === 'medium') return { quarter: 3, eighths: 2, rest: 1 };
    return { quarter: 2, eighths: 2, rest: 1, offbeat: 2 };
  }
  if (c === 'easy') return { quarter: 3, eighths: 1, rest: 1 };
  if (c === 'medium') return { quarter: 3, eighths: 2, rest: 1, offbeat: 1.5 };
  return {
    quarter: 2,
    eighths: 2,
    rest: 1,
    offbeat: 1,
    sixteens: 1,
    eighthTwoSixteenths: 1,
    dotted: 1,
    triplet: 1,
    swing: 1,
  };
}
