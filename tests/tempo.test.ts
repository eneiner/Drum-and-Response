import { describe, expect, it } from 'vitest';
import { calibrationOffset, median, tapTempo } from '../src/game/tempo';

describe('median', () => {
  it('works for odd, even and empty lists', () => {
    expect(median([3, 1, 2])).toBe(2);
    expect(median([4, 1, 2, 3])).toBe(2.5);
    expect(median([])).toBe(0);
  });
});

describe('tapTempo', () => {
  it('needs three taps', () => {
    expect(tapTempo([0, 500])).toBeNull();
    expect(tapTempo([0, 500, 1000])).toBe(120);
  });
  it('ignores one sloppy tap', () => {
    expect(tapTempo([0, 600, 1200, 1900, 2400, 3000])).toBe(100);
  });
  it('starts over after a long pause', () => {
    expect(tapTempo([0, 1000, 2000, 8000, 8500, 9000])).toBe(120);
  });
});

describe('calibrationOffset', () => {
  const clicks = [0, 0.5, 1, 1.5, 2, 2.5, 3, 3.5];
  it('returns the median delay', () => {
    const hits = clicks.map((c, i) => c + 0.1 + (i % 2 ? 0.01 : -0.01));
    expect(calibrationOffset(clicks, hits)).toBeCloseTo(0.1);
  });
  it('shrugs off a stray clap', () => {
    const hits = [...clicks.map((c) => c + 0.08), 1.3];
    expect(calibrationOffset(clicks, hits)).toBeCloseTo(0.08);
  });
  it('fails with too few claps', () => {
    expect(calibrationOffset(clicks, [0.1, 0.6])).toBeNull();
  });
});
