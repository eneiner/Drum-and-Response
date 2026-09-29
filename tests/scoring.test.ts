import { describe, expect, it } from 'vitest';
import { BASE_WINDOWS, feedback, gradeFor, scoreRound, windowsFor } from '../src/game/scoring';

const W = BASE_WINDOWS;
const beats = [0, 0.6, 1.2, 1.8];

describe('gradeFor', () => {
  it('grades by distance, early or late', () => {
    expect(gradeFor(0.01, W)).toBe('perfect');
    expect(gradeFor(-0.035, W)).toBe('perfect');
    expect(gradeFor(0.05, W)).toBe('good');
    expect(gradeFor(-0.12, W)).toBe('off');
    expect(gradeFor(0.2, W)).toBe('miss');
  });
});

describe('windowsFor', () => {
  it('uses base windows at 100 BPM', () => {
    expect(windowsFor(100)).toEqual(W);
  });
  it('tightens when faster, loosens when slower, within limits', () => {
    expect(windowsFor(180).perfect).toBeCloseTo(W.perfect * 0.7);
    expect(windowsFor(40).off).toBeCloseTo(W.off * 1.3);
  });
  it('never lets windows overlap between close notes', () => {
    const w = windowsFor(100, 0.1);
    expect(w.off).toBeCloseTo(0.045);
    expect(w.good).toBeLessThanOrEqual(w.off);
    expect(w.perfect).toBeLessThanOrEqual(w.good);
  });
});

describe('scoreRound', () => {
  it('perfect hits score 100 and pass', () => {
    const s = scoreRound(beats, beats.map((b) => b + 0.005), W);
    expect(s.accuracy).toBe(100);
    expect(s.counts.perfect).toBe(4);
    expect(s.passed).toBe(true);
  });

  it('missed notes score zero', () => {
    const s = scoreRound(beats, [0, 0.6], W);
    expect(s.counts.miss).toBe(2);
    expect(s.accuracy).toBe(50);
    expect(s.passed).toBe(false);
  });

  it('mixes grades with weights', () => {
    // perfect, good, off, miss = 100 + 70 + 30 + 0 = 200 / 400
    const s = scoreRound(beats, [0.0, 0.6 + 0.06, 1.2 - 0.12, 5], W);
    expect(s.counts).toEqual({ perfect: 1, good: 1, off: 1, miss: 1 });
    expect(s.extras).toEqual([5]);
    expect(s.accuracy).toBe(Math.round(((200 - 30) / 400) * 100));
  });

  it('penalizes extra hits', () => {
    const s = scoreRound(beats, [...beats, 0.3, 0.9], W);
    expect(s.extras.length).toBe(2);
    expect(s.accuracy).toBe(85);
  });

  it('never uses one hit for two notes', () => {
    const s = scoreRound([0, 0.1], [0.05], windowsFor(100, 0.1));
    expect(s.counts.miss).toBeGreaterThanOrEqual(1);
    expect(s.notes.filter((n) => n.hit !== null).length).toBeLessThanOrEqual(1);
  });

  it('matches the closest hit when two are near one note', () => {
    const s = scoreRound([1], [0.93, 1.01], W);
    expect(s.notes[0].hit).toBe(1.01);
    expect(s.extras).toEqual([0.93]);
  });

  it('reports rushing and dragging', () => {
    const rush = scoreRound(beats, beats.map((b) => b - 0.04), W);
    expect(rush.meanError).toBeCloseTo(-0.04);
    expect(feedback(rush)).toMatch(/rushing/);
    const drag = scoreRound(beats, beats.map((b) => b + 0.04), W);
    expect(feedback(drag)).toMatch(/dragging/);
  });

  it('clamps accuracy at 0', () => {
    const s = scoreRound([0], Array.from({ length: 10 }, (_, i) => 1 + i), W);
    expect(s.accuracy).toBe(0);
  });

  it('handles no input', () => {
    const s = scoreRound(beats, [], W);
    expect(s.accuracy).toBe(0);
    expect(s.counts.miss).toBe(4);
  });
});
