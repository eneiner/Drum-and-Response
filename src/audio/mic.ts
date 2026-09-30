import { audio } from './engine';
import workletUrl from './onset-worklet.ts?worker&url';

export type OnsetListener = (time: number, level: number) => void;
export type LevelListener = (level: number) => void;

/**
 * Microphone input → AudioWorklet onset detector.
 * Onset times arrive on the AudioContext clock.
 */
class Mic {
  private node: AudioWorkletNode | null = null;
  private stream: MediaStream | null = null;
  private onsetListeners = new Set<OnsetListener>();
  private levelListeners = new Set<LevelListener>();
  private starting: Promise<void> | null = null;
  private sensitivity = 6;
  /** Mic-to-worklet delay reported by the browser, seconds (0 if unknown). */
  inputLatency = 0;

  get active(): boolean {
    return this.node !== null;
  }

  static get supported(): boolean {
    return !!navigator.mediaDevices?.getUserMedia && typeof AudioWorkletNode !== 'undefined';
  }

  async start(sensitivity: number): Promise<void> {
    this.sensitivity = sensitivity;
    if (this.node) {
      this.setSensitivity(sensitivity);
      return;
    }
    if (!this.starting) {
      this.starting = this.open().finally(() => {
        this.starting = null;
      });
    }
    return this.starting;
  }

  private async open(): Promise<void> {
    const ctx = await audio.unlock();
    // Echo cancellation / noise suppression / AGC all smear or remove claps.
    this.stream = await navigator.mediaDevices.getUserMedia({
      audio: { echoCancellation: false, noiseSuppression: false, autoGainControl: false },
    });
    const reported = (this.stream.getAudioTracks()[0]?.getSettings() as { latency?: number } | undefined)?.latency;
    this.inputLatency = typeof reported === 'number' && reported > 0 ? reported : 0;
    await ctx.audioWorklet.addModule(workletUrl);
    const source = ctx.createMediaStreamSource(this.stream);
    const node = new AudioWorkletNode(ctx, 'onset-processor', {
      numberOfInputs: 1,
      numberOfOutputs: 1,
      channelCount: 1,
      channelCountMode: 'explicit',
      processorOptions: { sensitivity: this.sensitivity },
    });
    node.port.onmessage = (e: MessageEvent) => {
      const d = e.data;
      if (d.type === 'onset') this.onsetListeners.forEach((l) => l(d.time, d.level));
      else if (d.type === 'level') this.levelListeners.forEach((l) => l(d.level));
    };
    // Some browsers only run nodes that reach the destination; route through silence.
    const mute = ctx.createGain();
    mute.gain.value = 0;
    source.connect(node).connect(mute).connect(ctx.destination);
    this.node = node;
  }

  setSensitivity(value: number): void {
    this.sensitivity = value;
    this.node?.port.postMessage({ type: 'sensitivity', value });
  }

  onOnset(l: OnsetListener): () => void {
    this.onsetListeners.add(l);
    return () => this.onsetListeners.delete(l);
  }

  onLevel(l: LevelListener): () => void {
    this.levelListeners.add(l);
    return () => this.levelListeners.delete(l);
  }
}

export const mic = new Mic();
export const micSupported = (): boolean => Mic.supported;
