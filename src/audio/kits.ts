import type { Role } from '../game/types';

/**
 * Drum sounds are synthesized once into AudioBuffers (no sample files to
 * download), then played with AudioBufferSourceNodes for exact timing.
 */
export type KitId = 'rock' | 'hand' | 'electronic' | 'claps';

export const KITS: { id: KitId; name: string }[] = [
  { id: 'rock', name: 'Rock' },
  { id: 'hand', name: 'Hand Drums' },
  { id: 'electronic', name: 'Electronic' },
  { id: 'claps', name: 'Claps only' },
];

export type Voice = 'kick' | 'snare' | 'hat' | 'clap' | 'congaLow' | 'congaHigh' | 'slap' | 'kick808' | 'snareE' | 'hatE' | 'click' | 'clickAccent';

export const KIT_ROLES: Record<KitId, Record<Role, Voice>> = {
  rock: { low: 'kick', mid: 'snare', high: 'hat' },
  hand: { low: 'congaLow', mid: 'congaHigh', high: 'slap' },
  electronic: { low: 'kick808', mid: 'snareE', high: 'hatE' },
  claps: { low: 'clap', mid: 'clap', high: 'clap' },
};

type Render = (ctx: OfflineAudioContext) => void;

const LENGTH: Partial<Record<Voice, number>> = { kick: 0.5, kick808: 0.9, congaLow: 0.5, congaHigh: 0.4 };

function noiseBuffer(ctx: BaseAudioContext, seconds: number): AudioBuffer {
  const buf = ctx.createBuffer(1, Math.ceil(seconds * ctx.sampleRate), ctx.sampleRate);
  const d = buf.getChannelData(0);
  let seed = 12345;
  for (let i = 0; i < d.length; i++) {
    seed = (seed * 1103515245 + 12345) & 0x7fffffff;
    d[i] = (seed / 0x7fffffff) * 2 - 1;
  }
  return buf;
}

function env(ctx: BaseAudioContext, t: number, peak: number, decay: number): GainNode {
  const g = ctx.createGain();
  g.gain.setValueAtTime(0.0001, t);
  g.gain.exponentialRampToValueAtTime(peak, t + 0.002);
  g.gain.exponentialRampToValueAtTime(0.0001, t + decay);
  g.connect(ctx.destination);
  return g;
}

function tone(ctx: BaseAudioContext, type: OscillatorType, f0: number, f1: number, sweep: number, peak: number, decay: number): void {
  const o = ctx.createOscillator();
  o.type = type;
  o.frequency.setValueAtTime(f0, 0);
  o.frequency.exponentialRampToValueAtTime(f1, sweep);
  o.connect(env(ctx, 0, peak, decay));
  o.start(0);
  o.stop(decay + 0.01);
}

function noise(ctx: BaseAudioContext, filter: BiquadFilterType, freq: number, q: number, peak: number, decay: number, at = 0): void {
  const src = ctx.createBufferSource();
  src.buffer = noiseBuffer(ctx, decay + 0.02);
  const f = ctx.createBiquadFilter();
  f.type = filter;
  f.frequency.value = freq;
  f.Q.value = q;
  src.connect(f).connect(env(ctx, at, peak, decay));
  src.start(at);
}

const RENDER: Record<Voice, Render> = {
  kick: (c) => tone(c, 'sine', 150, 45, 0.12, 1, 0.45),
  snare: (c) => {
    tone(c, 'triangle', 220, 160, 0.05, 0.5, 0.12);
    noise(c, 'highpass', 1500, 0.7, 0.7, 0.2);
  },
  hat: (c) => noise(c, 'highpass', 7000, 0.7, 0.45, 0.05),
  clap: (c) => {
    for (const at of [0, 0.011, 0.022]) noise(c, 'bandpass', 1200, 1.2, 0.9, 0.012, at);
    noise(c, 'bandpass', 1200, 1, 0.8, 0.18, 0.03);
  },
  congaLow: (c) => tone(c, 'sine', 260, 190, 0.04, 0.9, 0.38),
  congaHigh: (c) => tone(c, 'sine', 400, 330, 0.03, 0.85, 0.28),
  slap: (c) => {
    tone(c, 'sine', 520, 420, 0.02, 0.4, 0.07);
    noise(c, 'bandpass', 2500, 1.5, 0.6, 0.06);
  },
  kick808: (c) => tone(c, 'sine', 110, 42, 0.2, 1, 0.85),
  snareE: (c) => {
    tone(c, 'sine', 330, 180, 0.03, 0.4, 0.08);
    noise(c, 'bandpass', 3500, 0.8, 0.9, 0.14);
  },
  hatE: (c) => {
    for (const f of [2, 3, 4.16, 5.43, 6.79, 8.21]) {
      const o = c.createOscillator();
      o.type = 'square';
      o.frequency.value = 40 * f * 10;
      const hp = c.createBiquadFilter();
      hp.type = 'highpass';
      hp.frequency.value = 7000;
      o.connect(hp).connect(env(c, 0, 0.25, 0.05));
      o.start(0);
      o.stop(0.07);
    }
  },
  click: (c) => tone(c, 'sine', 1500, 1500, 0.01, 0.6, 0.03),
  clickAccent: (c) => tone(c, 'sine', 2200, 2200, 0.01, 0.8, 0.035),
};

export async function renderVoice(v: Voice, sampleRate: number): Promise<AudioBuffer> {
  const seconds = LENGTH[v] ?? 0.3;
  const ctx = new OfflineAudioContext(1, Math.ceil(seconds * sampleRate), sampleRate);
  RENDER[v](ctx);
  return ctx.startRendering();
}
