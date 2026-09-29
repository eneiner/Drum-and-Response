import type { KitId } from './audio/kits';
import type { Complexity } from './game/levels';

export type InputMode = 'mic' | 'tap';
export type ClickLevel = 'off' | 'quiet' | 'normal';

export interface Settings {
  inputMode: InputMode;
  sensitivity: number;
  /** Seconds to subtract from mic hits (measured by calibration). */
  micOffset: number;
  /** Seconds to subtract from screen taps. */
  tapOffset: number;
  micCalibrated: boolean;
  /** Metronome volume while it's your turn. */
  responseClick: ClickLevel;
  haptics: boolean;
  kit: KitId;
  freedom: {
    bpm: number;
    meter: string;
    bars: 1 | 2 | 4;
    complexity: Complexity;
    loop: boolean;
  };
}

export interface Stats {
  highScore: number;
  highestLevel: number;
  bestStreak: number;
  roundsPlayed: number;
  accuracySum: number;
  freedomBestStreak: number;
  perfectHits: number;
}

export const DEFAULT_SETTINGS: Settings = {
  inputMode: 'mic',
  sensitivity: 6,
  micOffset: 0,
  tapOffset: 0,
  micCalibrated: false,
  responseClick: 'quiet',
  haptics: true,
  kit: 'rock',
  freedom: { bpm: 90, meter: '4/4', bars: 1, complexity: 'easy', loop: false },
};

export const DEFAULT_STATS: Stats = {
  highScore: 0,
  highestLevel: 0,
  bestStreak: 0,
  roundsPlayed: 0,
  accuracySum: 0,
  freedomBestStreak: 0,
  perfectHits: 0,
};

const KEY_SETTINGS = 'dr.settings.v1';
const KEY_STATS = 'dr.stats.v1';

function read<T extends object>(key: string, fallback: T): T {
  try {
    const raw = localStorage.getItem(key);
    if (!raw) return structuredClone(fallback);
    const parsed = JSON.parse(raw);
    const merged = { ...fallback, ...parsed } as T;
    // Merge one level of nested objects so new fields get defaults.
    for (const k of Object.keys(fallback) as (keyof T)[]) {
      const f = fallback[k];
      if (f && typeof f === 'object' && !Array.isArray(f)) {
        merged[k] = { ...f, ...(parsed?.[k] ?? {}) } as T[keyof T];
      }
    }
    return merged;
  } catch {
    return structuredClone(fallback);
  }
}

function write(key: string, value: unknown): void {
  try {
    localStorage.setItem(key, JSON.stringify(value));
  } catch {
    /* storage unavailable (private mode); keep going in memory */
  }
}

export const settings: Settings = read(KEY_SETTINGS, DEFAULT_SETTINGS);
export const stats: Stats = read(KEY_STATS, DEFAULT_STATS);

export function saveSettings(): void {
  write(KEY_SETTINGS, settings);
}

export function saveStats(): void {
  write(KEY_STATS, stats);
}

export function resetStats(): void {
  Object.assign(stats, structuredClone(DEFAULT_STATS));
  saveStats();
}
