import { describe, expect, it } from 'vitest';
import { OnsetDetector } from '../src/audio/onsetCore';

const SR = 48000;

/** Synthetic clap: a short burst of decaying noise. */
function clap(buf: Float32Array, at: number, amp = 0.6, seed = 1): void {
  let s = seed;
  const start = Math.round(at * SR);
  const len = Math.round(0.05 * SR);
  for (let i = 0; i < len && start + i < buf.length; i++) {
    s = (s * 1103515245 + 12345) & 0x7fffffff;
    buf[start + i] += ((s / 0x7fffffff) * 2 - 1) * amp * Math.exp(-i / (0.008 * SR));
  }
}

function noise(buf: Float32Array, amp: number): void {
  let s = 99;
  for (let i = 0; i < buf.length; i++) {
    s = (s * 1103515245 + 12345) & 0x7fffffff;
    buf[i] += ((s / 0x7fffffff) * 2 - 1) * amp;
  }
}

function run(buf: Float32Array, sensitivity = 6) {
  const d = new OnsetDetector({ sampleRate: SR, sensitivity });
  const out = [];
  for (let i = 0; i < buf.length; i += 128) out.push(...d.process(buf.subarray(i, i + 128)));
  return out;
}

describe('OnsetDetector', () => {
  it('finds each clap within 3 ms', () => {
    const buf = new Float32Array(SR * 2);
    const times = [0.2, 0.5, 0.8, 1.1, 1.4];
    times.forEach((t, i) => clap(buf, t, 0.5, i + 1));
    const onsets = run(buf);
    expect(onsets.length).toBe(times.length);
    onsets.forEach((o, i) => expect(Math.abs(o.time - times[i])).toBeLessThan(0.003));
  });

  it('counts one clap once', () => {
    const buf = new Float32Array(SR);
    clap(buf, 0.3, 0.9);
    expect(run(buf).length).toBe(1);
  });

  it('separates fast claps (sixteenths at 160 BPM)', () => {
    const buf = new Float32Array(SR);
    const gap = 60 / 160 / 4;
    const times = [0.1, 0.1 + gap, 0.1 + 2 * gap, 0.1 + 3 * gap];
    times.forEach((t, i) => clap(buf, t, 0.5, i + 3));
    expect(run(buf).length).toBe(4);
  });

  it('ignores steady background noise', () => {
    const buf = new Float32Array(SR * 2);
    noise(buf, 0.01);
    expect(run(buf).length).toBe(0);
  });

  it('hears claps over background noise', () => {
    const buf = new Float32Array(SR * 2);
    noise(buf, 0.01);
    [0.4, 1.0, 1.6].forEach((t, i) => clap(buf, t, 0.4, i + 7));
    expect(run(buf).length).toBe(3);
  });

  it('sensitivity changes what counts', () => {
    const buf = new Float32Array(SR);
    clap(buf, 0.3, 0.02);
    expect(run(buf, 1).length).toBe(0);
    expect(run(buf, 10).length).toBe(1);
  });

  it('uses the provided block start time', () => {
    const buf = new Float32Array(SR);
    clap(buf, 0.25, 0.5);
    const d = new OnsetDetector({ sampleRate: SR, sensitivity: 6 });
    const out = [];
    for (let i = 0; i < buf.length; i += 128) out.push(...d.process(buf.subarray(i, i + 128), 100 + i / SR));
    expect(out[0].time).toBeCloseTo(100.25, 2);
  });
});
