# Build Prompt: Drum & Response

Copy everything below the line into your AI coding tool.

---

You are an expert mobile game developer and audio engineer. Build **Drum & Response**, a rhythm call-and-response game. The app plays a drum pattern, then the player repeats it by clapping or tapping on a table. The phone's microphone listens, detects each hit, and scores how closely the player's timing matches the pattern.

## Platform & Stack
- Build as a mobile-first **web app (PWA)** using TypeScript + Web Audio API, so it runs on iPhone and Android browsers and can be installed to the home screen.
- Keep the code modular so the audio engine could later be ported to native (Swift/Kotlin).
- No backend needed for v1. Save progress and settings locally.

## Core Loop (both modes)
1. **Count-in:** 1 bar of metronome clicks at the current tempo (visual + audio).
2. **Call:** App plays the pattern with real drum samples (kick, snare, hi-hat, clap). Beats light up on a visual grid as they play.
3. **Response:** App shows "Your turn" and keeps a quiet metronome click going. The player claps/taps the pattern back for the same number of bars.
4. **Score:** Show each hit on a timeline: Perfect / Good / Off / Missed / Extra. Give an accuracy % and move on (or retry).

## Hit Detection (most important part)
- Request mic permission with a friendly explainer screen first.
- Detect claps/taps with **onset detection** (energy/spectral-flux on short frames, ~5–10 ms hop) using an AudioWorklet for low latency.
- **Ignore the app's own playback** during the response phase: keep the metronome very quiet, duck it at detection time, or recommend headphones.
- Debounce so one clap isn't counted twice (~60–80 ms minimum gap).
- **Latency calibration** screen: player taps along to 8 clicks; store the average offset and subtract it from every hit.
- Adjustable **mic sensitivity** slider plus a live input meter.
- Fallback input: tapping anywhere on the screen counts as a hit (for noisy places or accessibility).

## Timing & Scoring
- Compare each detected hit to the nearest expected beat.
- Windows (scale with tempo, shown at 100 BPM): **Perfect** ≤ 35 ms, **Good** ≤ 80 ms, **Off** ≤ 150 ms, beyond = miss.
- Extra hits reduce the score. Missed notes count as zero.
- Round score = weighted accuracy (Perfect 100, Good 70, Off 30). Pass threshold for Challenge mode: **70%**.
- Streak/combo multiplier for consecutive Perfect/Good rounds.

## Mode 1: Challenge (progressive)
- Levels get harder in two ways: **pattern complexity** and **tempo**.
- Suggested progression:
  1. Quarter notes, 1 bar, 70 BPM
  2. Mixed quarters + eighths
  3. Rests (silence the player must respect)
  4. 2-bar patterns
  5. Syncopation / off-beats
  6. Sixteenth-note fills
  7. Triplets and swing
  8. Odd meters (5/4, 7/8) for expert levels
- Tempo rises ~4–6 BPM per level within a tier, then resets slightly when a new pattern type is introduced.
- 3 lives. A failed round costs a life. Retry once before losing it.
- Patterns come from a **generator** with difficulty rules (density, syncopation, rests, length), plus a hand-made starter set, so play doesn't feel repetitive.
- Track high score, highest level, and best streak.

## Mode 2: Freedom (practice / free play)
- Player sets:
  - **Tempo:** 40–220 BPM (slider + tap-tempo button)
  - **Time signature:** 4/4, 3/4, 6/8, 5/4
  - **Pattern length:** 1, 2, or 4 bars
  - **Complexity:** Easy / Medium / Hard / Random
  - **Drum kit:** Rock, Hand Drums, Electronic, Claps only
- Endless call-and-response rounds at the fixed tempo — no lives, no level-ups.
- Show a running accuracy average and "best streak this session."
- Optional **"Loop this pattern"** toggle to drill one pattern until perfect.

## UI / UX
- Big, thumb-friendly controls. Dark theme with bright beat colors.
- Beat grid visualization: expected beats as circles, player hits as dots placed where they actually landed (early/late shows visually).
- Clear phase indicators: COUNT-IN → LISTEN → YOUR TURN → RESULT.
- Haptic feedback on Perfect hits (where supported).
- Screens: Home, Challenge, Freedom setup, Freedom play, Calibration, Settings, Stats.

## Audio Engine Requirements
- Schedule all sounds with the Web Audio clock (look-ahead scheduler), **never setTimeout**, so timing is sample-accurate.
- Preload samples. Handle iOS audio unlock on first tap.
- Keep playback and detection on the same clock so timing comparisons are accurate.

## Deliverables
1. Working app with both modes, calibration, and settings.
2. Pattern generator with unit tests for difficulty rules.
3. Scoring module with unit tests (feed fake hit timestamps, check grades).
4. README explaining how to run, test, and tune detection thresholds.

## Build Order
1. Audio engine + metronome with accurate scheduling
2. Mic onset detection + calibration (test this on a real phone early)
3. Scoring + results screen
4. Freedom mode (simplest full loop)
5. Challenge mode + pattern generator + progression
6. Polish: visuals, haptics, stats, PWA install

Ask me before making big design choices not covered here.
