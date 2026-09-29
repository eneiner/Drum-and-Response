import { OnsetDetector } from './onsetCore';

// Minimal typings for the AudioWorklet global scope.
declare const sampleRate: number;
declare const currentTime: number;
declare function registerProcessor(name: string, ctor: unknown): void;
declare class AudioWorkletProcessor {
  readonly port: MessagePort;
  constructor(options?: unknown);
}

interface Opts {
  processorOptions?: { sensitivity?: number };
}

class OnsetProcessor extends AudioWorkletProcessor {
  private detector: OnsetDetector;
  private meterPeak = 0;
  private meterCountdown = 0;

  constructor(options: Opts) {
    super();
    this.detector = new OnsetDetector({
      sampleRate,
      sensitivity: options.processorOptions?.sensitivity ?? 6,
    });
    this.port.onmessage = (e: MessageEvent) => {
      if (e.data?.type === 'sensitivity') this.detector.setSensitivity(e.data.value);
    };
  }

  process(inputs: Float32Array[][]): boolean {
    const channel = inputs[0]?.[0];
    if (!channel) return true;
    // currentTime is the AudioContext time of this block's first sample,
    // so onset times share the playback clock.
    const onsets = this.detector.process(channel, currentTime);
    for (const o of onsets) this.port.postMessage({ type: 'onset', time: o.time, level: o.level });

    this.meterPeak = Math.max(this.meterPeak, this.detector.level);
    this.meterCountdown -= channel.length;
    if (this.meterCountdown <= 0) {
      this.port.postMessage({ type: 'level', level: this.meterPeak });
      this.meterPeak = 0;
      this.meterCountdown = Math.round(sampleRate / 30);
    }
    return true;
  }
}

registerProcessor('onset-processor', OnsetProcessor);
