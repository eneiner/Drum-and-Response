import type { Grade } from './types';

export interface Windows {
  perfect: number;
  good: number;
  off: number;
}

/** Timing windows in seconds at 100 BPM. */
export const BASE_WINDOWS: Windows = { perfect: 0.035, good: 0.08, off: 0.15 };

export const POINTS: Record<Grade, number> = { perfect: 100, good: 70, off: 30, miss: 0 };
export const EXTRA_PENALTY = 30;
export const PASS_THRESHOLD = 70;

/**
 * Windows scale with tempo (tighter when faster) but never wider than 45% of the
 * shortest gap between notes, so a hit can't be claimed by two notes.
 */
export function windowsFor(bpm: number, minGapSec = Infinity): Windows {
  const scale = Math.min(1.3, Math.max(0.7, 100 / bpm));
  const cap = minGapSec * 0.45;
  const off = Math.min(BASE_WINDOWS.off * scale, cap);
  const good = Math.min(BASE_WINDOWS.good * scale, off);
  const perfect = Math.min(BASE_WINDOWS.perfect * scale, good);
  return { perfect, good, off };
}

export function gradeFor(errorSec: number, w: Windows): Grade {
  const e = Math.abs(errorSec);
  if (e <= w.perfect) return 'perfect';
  if (e <= w.good) return 'good';
  if (e <= w.off) return 'off';
  return 'miss';
}

export interface NoteResult {
  expected: number;
  /** Matched hit time, or null if missed. */
  hit: number | null;
  /** hit - expected (negative = early). */
  error: number | null;
  grade: Grade;
}

export interface RoundScore {
  notes: NoteResult[];
  /** Hits that didn't match any note. */
  extras: number[];
  counts: Record<Grade, number>;
  /** 0-100. */
  accuracy: number;
  /** Mean error of matched hits in seconds (negative = rushing). */
  meanError: number;
  passed: boolean;
}

/**
 * Match hits to expected notes and grade them.
 * Pairs are assigned closest-first, so each hit is used at most once
 * and each note gets the nearest available hit within the "off" window.
 */
export function scoreRound(expected: number[], hits: number[], w: Windows): RoundScore {
  const pairs: { e: number; h: number; err: number }[] = [];
  expected.forEach((et, e) => {
    hits.forEach((ht, h) => {
      const err = ht - et;
      if (Math.abs(err) <= w.off) pairs.push({ e, h, err });
    });
  });
  pairs.sort((a, b) => Math.abs(a.err) - Math.abs(b.err));

  const noteHit = new Map<number, number>();
  const usedHits = new Set<number>();
  for (const p of pairs) {
    if (noteHit.has(p.e) || usedHits.has(p.h)) continue;
    noteHit.set(p.e, p.h);
    usedHits.add(p.h);
  }

  const counts: Record<Grade, number> = { perfect: 0, good: 0, off: 0, miss: 0 };
  let points = 0;
  let errSum = 0;
  const notes: NoteResult[] = expected.map((et, e) => {
    const h = noteHit.get(e);
    if (h === undefined) {
      counts.miss++;
      return { expected: et, hit: null, error: null, grade: 'miss' };
    }
    const error = hits[h] - et;
    const grade = gradeFor(error, w);
    counts[grade]++;
    points += POINTS[grade];
    errSum += error;
    return { expected: et, hit: hits[h], error, grade };
  });

  const extras = hits.filter((_, i) => !usedHits.has(i));
  const max = expected.length * POINTS.perfect;
  const raw = max === 0 ? 0 : ((points - extras.length * EXTRA_PENALTY) / max) * 100;
  const accuracy = Math.round(Math.max(0, Math.min(100, raw)));
  const matched = expected.length - counts.miss;

  return {
    notes,
    extras,
    counts,
    accuracy,
    meanError: matched ? errSum / matched : 0,
    passed: accuracy >= PASS_THRESHOLD,
  };
}

/** Friendly one-line coaching tip based on the round. */
export function feedback(s: RoundScore): string {
  if (s.accuracy === 100) return 'Flawless!';
  if (s.counts.miss > s.notes.length / 2) return 'Listen once more, then clap every note you hear.';
  if (s.extras.length >= 2) return 'A few extra claps. Leave the rests silent.';
  const ms = Math.round(s.meanError * 1000);
  if (ms <= -25) return `You're rushing by about ${-ms} ms. Relax a little.`;
  if (ms >= 25) return `You're dragging by about ${ms} ms. Push a little.`;
  if (s.passed) return 'Nice groove!';
  return 'Close! Try to match each note exactly.';
}
