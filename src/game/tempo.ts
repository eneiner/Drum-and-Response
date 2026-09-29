/** Median of a list (robust to one wild value). */
export function median(values: number[]): number {
  if (values.length === 0) return 0;
  const s = [...values].sort((a, b) => a - b);
  const mid = Math.floor(s.length / 2);
  return s.length % 2 ? s[mid] : (s[mid - 1] + s[mid]) / 2;
}

/**
 * Tap-tempo: turn tap timestamps (ms) into BPM using the last few intervals.
 * Returns null until there are enough taps. A long pause starts over.
 */
export function tapTempo(tapsMs: number[], maxGapMs = 2000): number | null {
  let start = tapsMs.length - 1;
  while (start > 0 && tapsMs[start] - tapsMs[start - 1] < maxGapMs) start--;
  const recent = tapsMs.slice(start).slice(-8);
  if (recent.length < 3) return null;
  const intervals = recent.slice(1).map((t, i) => t - recent[i]);
  return Math.round(60000 / median(intervals));
}

/**
 * Calibration: given click times and detected hit times (seconds), pair each
 * click with the nearest hit within `maxOffset` and return the median offset.
 */
export function calibrationOffset(clicks: number[], hits: number[], maxOffset = 0.35): number | null {
  const offsets: number[] = [];
  for (const c of clicks) {
    let best: number | null = null;
    for (const h of hits) {
      const d = h - c;
      if (Math.abs(d) <= maxOffset && (best === null || Math.abs(d) < Math.abs(best))) best = d;
    }
    if (best !== null) offsets.push(best);
  }
  if (offsets.length < Math.ceil(clicks.length / 2)) return null;
  return median(offsets);
}
