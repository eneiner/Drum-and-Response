import { describe, expect, it } from 'vitest';
import { CELLS, generatePattern, minGapBeats, type Difficulty } from '../src/game/patterns';
import { createRng } from '../src/game/rng';
import { METERS, patternBeats } from '../src/game/types';
import { freedomCells, levelInfo, TIERS, LEVELS_PER_TIER } from '../src/game/levels';

const allowedOffsets = (d: Difficulty) =>
  new Set(
    Object.entries(d.cells)
      .filter(([, w]) => (w ?? 0) > 0)
      .flatMap(([id]) => CELLS[id as keyof typeof CELLS].offsets.map((o) => o.toFixed(4))),
  );

describe('generatePattern', () => {
  it('is reproducible with the same seed', () => {
    const d = levelInfo(10).difficulty;
    expect(generatePattern(d, createRng(42))).toEqual(generatePattern(d, createRng(42)));
  });

  it('always starts on beat 1, fills every bar and stays inside the pattern', () => {
    for (let level = 1; level <= 60; level++) {
      const d = levelInfo(level).difficulty;
      for (let seed = 0; seed < 30; seed++) {
        const p = generatePattern(d, createRng(seed * 7919 + level));
        expect(p.notes[0].beat).toBe(0);
        const total = patternBeats(p);
        for (const n of p.notes) {
          expect(n.beat).toBeGreaterThanOrEqual(0);
          expect(n.beat).toBeLessThan(total);
        }
        for (let bar = 0; bar < p.bars; bar++) {
          const lo = bar * p.meter.beats;
          expect(p.notes.some((n) => n.beat >= lo && n.beat < lo + p.meter.beats)).toBe(true);
        }
        // Notes are strictly increasing.
        for (let i = 1; i < p.notes.length; i++) expect(p.notes[i].beat).toBeGreaterThan(p.notes[i - 1].beat);
      }
    }
  });

  it('only uses rhythms allowed by the difficulty', () => {
    for (let level = 1; level <= 32; level++) {
      const d = levelInfo(level).difficulty;
      const ok = allowedOffsets(d);
      const p = generatePattern(d, createRng(level));
      for (const n of p.notes) expect(ok.has((n.beat % 1).toFixed(4))).toBe(true);
    }
  });

  it('level 1 is four quarter notes', () => {
    const p = generatePattern(levelInfo(1).difficulty, createRng(1));
    expect(p.notes.map((n) => n.beat)).toEqual([0, 1, 2, 3]);
  });

  it('respects the minimum note count', () => {
    const d: Difficulty = { meter: METERS['4/4'], bars: 1, cells: { rest: 5, quarter: 1 }, minNotes: 3 };
    for (let s = 0; s < 50; s++) expect(generatePattern(d, createRng(s)).notes.length).toBeGreaterThanOrEqual(3);
  });

  it('gives accents to the downbeat', () => {
    const p = generatePattern(levelInfo(1).difficulty, createRng(3));
    expect(p.notes[0].role).toBe('low');
  });
});

describe('difficulty progression', () => {
  it('tempo rises within a tier and never exceeds the cap', () => {
    for (let t = 0; t < TIERS.length; t++) {
      const first = levelInfo(t * LEVELS_PER_TIER + 1);
      const last = levelInfo(t * LEVELS_PER_TIER + LEVELS_PER_TIER);
      expect(last.bpm).toBeGreaterThan(first.bpm);
      expect(first.newTier).toBe(true);
    }
    expect(levelInfo(500).bpm).toBeLessThanOrEqual(200);
  });

  it('gets denser as levels go up', () => {
    const avgNotesPerBeat = (level: number) => {
      let notes = 0;
      let beats = 0;
      for (let s = 0; s < 200; s++) {
        const p = generatePattern(levelInfo(level).difficulty, createRng(s));
        notes += p.notes.length;
        beats += patternBeats(p);
      }
      return notes / beats;
    };
    expect(avgNotesPerBeat(5)).toBeGreaterThan(avgNotesPerBeat(1) - 0.01);
    expect(avgNotesPerBeat(21)).toBeGreaterThan(avgNotesPerBeat(9));
  });

  it('keeps going past the last tier and keeps speeding up', () => {
    const lastDesigned = TIERS.length * LEVELS_PER_TIER;
    const lap1 = levelInfo(lastDesigned + 1);
    const lap2 = levelInfo(lastDesigned + 1 + (TIERS.length - 4) * LEVELS_PER_TIER);
    expect(lap1.tier).toBe(lap2.tier);
    expect(lap2.bpm).toBeGreaterThan(lap1.bpm);
  });

  it('odd-meter tier uses 5/4 and 7/8', () => {
    const start = (TIERS.length - 1) * LEVELS_PER_TIER + 1;
    const meters = new Set([0, 1, 2, 3].map((i) => levelInfo(start + i).difficulty.meter.beats));
    expect(meters).toEqual(new Set([5, 7]));
  });

  it('freedom complexity gets harder', () => {
    const density = (c: 'easy' | 'medium' | 'hard') => {
      let n = 0;
      for (let s = 0; s < 200; s++) n += generatePattern({ meter: METERS['4/4'], bars: 1, cells: freedomCells(c, 4) }, createRng(s)).notes.length;
      return n;
    };
    expect(density('medium')).toBeGreaterThan(density('easy'));
    expect(density('hard')).toBeGreaterThan(density('medium'));
  });

  it('min gap is positive', () => {
    const p = generatePattern(levelInfo(24).difficulty, createRng(9));
    expect(minGapBeats(p)).toBeGreaterThan(0);
  });
});
