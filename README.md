# Drum & Response

A call-and-response rhythm game. The app plays a drum pattern, then you clap (or tap a table) it back. Your phone's microphone hears each hit and scores your timing.

## Modes

- **Challenge.** Patterns get harder and faster. Pass a round with 70% or more to level up. You get one retry per pattern, then lose a life (3 lives). Tiers: quarter notes → eighths → rests → two bars → syncopation → sixteenths → triplets & swing → odd meters (5/4, 7/8). Then it loops, faster each lap.
- **Freedom.** Pick tempo (40–220 BPM, with tap tempo), time signature (4/4, 3/4, 6/8, 5/4), length (1/2/4 bars), complexity and drum kit. Endless rounds, no lives. Turn on **Loop this pattern** to drill one rhythm.

Each round: 1-bar count-in → **Listen** → **Your turn** → **Result**. Hits are graded Perfect / Good / Off / Missed, and extra claps cost points. The result screen shows exactly where each clap landed and whether you're rushing or dragging.

## Run it

```bash
npm install
npm run dev      # open the printed Network URL on your phone (same Wi-Fi)
npm test         # unit tests
npm run build    # production build in dist/
```

Mic access needs HTTPS (or localhost). On a phone, use the GitHub Pages deploy below, or tunnel the dev server over HTTPS.

**Deploy:** pushing to `main` builds and deploys to GitHub Pages. Enable it once under *Settings → Pages → Source: GitHub Actions*. Then open the site on your phone and choose **Add to Home Screen**.

## How it works

| Part | File |
| --- | --- |
| Audio engine, synthesized drum kits, scheduling on the Web Audio clock | `src/audio/engine.ts`, `src/audio/kits.ts` |
| Clap detection (AudioWorklet) | `src/audio/onsetCore.ts`, `src/audio/onset-worklet.ts`, `src/audio/mic.ts` |
| Pattern generator | `src/game/patterns.ts` |
| Level progression and Freedom complexity | `src/game/levels.ts` |
| Scoring and timing windows | `src/game/scoring.ts` |
| One round (count-in → call → response → score) | `src/game/round.ts` |
| Screens | `src/ui/screens/*` |

- **Timing.** Every sound is scheduled ahead on `AudioContext.currentTime`, never `setTimeout`. Mic onsets are timestamped inside the AudioWorklet on the same clock, so playback and detection share one timeline.
- **Calibration.** The player claps along with 12 clicks. The median delay is saved and subtracted from every hit. This covers speaker delay, mic delay and personal habit. Screen taps have their own offset and are mapped to audio time with `getOutputTimestamp()`.
- **No sample files.** Drum sounds are rendered once with `OfflineAudioContext`, so the app is tiny and works offline (PWA with a service worker).

## Tuning clap detection

All in `src/audio/onsetCore.ts`:

- `thresholdFor()`: the absolute level a hit must reach. The in-app sensitivity slider (1–10) maps to it on a log scale.
- `ratio` (3.2): how far above the background level a hit must jump. Raise it for noisy rooms, lower it for soft table taps.
- `refractory` (70 ms): the minimum gap between hits. It must stay below a sixteenth note at your fastest tempo (≈94 ms at 160 BPM).
- High-pass at 120 Hz: removes rumble. Raise it if the kick drum bleeds into the mic.

Timing windows live in `src/game/scoring.ts` (`BASE_WINDOWS`: 35 / 80 / 150 ms at 100 BPM). They scale with tempo and never exceed 45% of the gap between the two closest notes.

## Known limits

- **Speaker bleed.** The mic can hear the app's metronome. Keep "Metronome during your turn" on Quiet or Off, or use headphones.
- **iOS.** The app sets Safari's audio session to `play-and-record` so sound stays on the speaker while the mic is open (Safari 16.4+). Older iOS may route audio to the earpiece; headphones fix that.
- **Haptics** only work on Android (iOS Safari has no vibration API).
