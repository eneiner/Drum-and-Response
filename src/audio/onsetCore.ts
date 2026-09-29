/**
 * Clap / tap onset detector. Pure DSP with no Web Audio dependencies so it can
 * be unit-tested and run inside an AudioWorklet.
 *
 * How it works:
 *  1. High-pass the signal (~120 Hz) to drop rumble and handling noise.
 *  2. Track a fast envelope (~1 ms attack, ~10 ms release) and a slow
 *     background level (~150 ms).
 *  3. Fire when the fast envelope jumps well above the background AND above an
 *     absolute floor set by the sensitivity slider.
 *  4. Ignore anything for `refractory` seconds afterwards so one clap = one hit.
 */
export interface OnsetOptions {
  sampleRate: number;
  /** 1 (least sensitive) to 10 (most sensitive). */
  sensitivity: number;
  /** Minimum time between hits, seconds. */
  refractory?: number;
}

export interface Onset {
  /** Seconds from the start of the stream (sample-accurate). */
  time: number;
  /** Peak envelope level of the hit (0-1). */
  level: number;
}

export function thresholdFor(sensitivity: number): number {
  const s = Math.min(10, Math.max(1, sensitivity));
  // Sensitivity 1 → 0.25, 10 → ~0.008 (log scale).
  return 0.25 * Math.pow(0.01 / 0.25, (s - 1) / 9) * 0.8;
}

export class OnsetDetector {
  private sampleRate: number;
  private threshold: number;
  private refractorySamples: number;
  private ratio = 3.2;

  private hpPrevIn = 0;
  private hpPrevOut = 0;
  private hpA: number;

  private fast = 0;
  private slow = 0;
  private fastAttack: number;
  private fastRelease: number;
  private slowCoef: number;

  private sampleIndex = 0;
  private lastOnset = -Infinity;
  /** While > 0 we are tracking the peak of a hit that just started. */
  private peakHold = 0;
  private pending: Onset | null = null;

  constructor(opts: OnsetOptions) {
    this.sampleRate = opts.sampleRate;
    this.threshold = thresholdFor(opts.sensitivity);
    this.refractorySamples = Math.round((opts.refractory ?? 0.07) * opts.sampleRate);
    const rc = 1 / (2 * Math.PI * 120);
    const dt = 1 / opts.sampleRate;
    this.hpA = rc / (rc + dt);
    this.fastAttack = coef(0.001, opts.sampleRate);
    this.fastRelease = coef(0.01, opts.sampleRate);
    this.slowCoef = coef(0.15, opts.sampleRate);
  }

  setSensitivity(s: number): void {
    this.threshold = thresholdFor(s);
  }

  /** Current fast envelope, for input meters. */
  get level(): number {
    return this.fast;
  }

  /**
   * Process a block of samples. `startTime` is the stream time of the first
   * sample (seconds). Returns onsets found in this block.
   */
  process(samples: Float32Array, startTime?: number): Onset[] {
    const out: Onset[] = [];
    const base = startTime ?? this.sampleIndex / this.sampleRate;
    for (let i = 0; i < samples.length; i++) {
      const x = samples[i];
      const hp = this.hpA * (this.hpPrevOut + x - this.hpPrevIn);
      this.hpPrevIn = x;
      this.hpPrevOut = hp;
      const a = Math.abs(hp);

      this.fast = a > this.fast ? a + this.fastAttack * (this.fast - a) : a + this.fastRelease * (this.fast - a);

      const since = this.sampleIndex - this.lastOnset;
      if (
        since > this.refractorySamples &&
        this.fast > this.threshold &&
        this.fast > this.slow * this.ratio
      ) {
        this.lastOnset = this.sampleIndex;
        this.pending = { time: base + i / this.sampleRate, level: this.fast };
        this.peakHold = Math.round(0.01 * this.sampleRate);
      }

      if (this.pending) {
        if (this.fast > this.pending.level) this.pending.level = this.fast;
        if (--this.peakHold <= 0) {
          out.push(this.pending);
          this.pending = null;
        }
      }

      // Background level follows slowly and ignores the hit itself less.
      this.slow = a + this.slowCoef * (this.slow - a);
      this.sampleIndex++;
    }
    return out;
  }
}

function coef(seconds: number, sampleRate: number): number {
  return Math.exp(-1 / (seconds * sampleRate));
}
