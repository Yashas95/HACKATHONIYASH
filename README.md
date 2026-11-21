# EDGEGUARD AI: intelligent safety before the accident

A real-time visual safety monitor:
1. Detects people in a camera feed or recorded footage.
2. Tracks each person and works out whether their feet enter a configurable danger zone (shoreline, platform edge, jetty edge).
3. Speaks a personalised warning in English or Malayalam, using the clothing colour it sees ("Attention, person in the red shirt…").
4. Escalates unresolved breaches to an operator incident panel with a simulated SOS preview.

> Research and demonstration prototype, built for HackaThoni 2026, Alappuzha. It is **not** a certified safety system. It does not detect drowning and never contacts emergency services.

## Quick start

```powershell
npm install        # also copies the MediaPipe runtime and downloads the models into public/
npm run dev        # open http://localhost:5173
```

Use Chrome or Edge on a laptop with a GPU. Everything runs locally. Once `npm install` has finished, no internet is needed except for Sarvam voice calls that aren't cached yet.

### Sarvam voice (English + Malayalam)
Create `.env` in the project root:
```
SARVAM_API_KEY=your_key_here
# optional
SARVAM_MODEL=bulbul:v3
SARVAM_SPEAKER_EN=pooja
SARVAM_SPEAKER_ML=pooja
```
The key is read only by the Vite dev server's `/api/tts` proxy (`server/tts-proxy.ts`) and is never sent to the browser. `bulbul:v3` is used because Sarvam's v4 voices have no Malayalam speaker. Each generated clip is cached in `.tts-cache/`, so a warning that has played once also works offline.
Without a key the app falls back to the browser's built-in speech and says so in the top bar.

## Footage

| Scene | File | Notes |
|---|---|---|
| Beach Safety | `public/videos/beach.mp4` | Storm beach (Veo) |
| Platform Safety | `public/videos/metro.mp4` | Kochi Metro platform in a storm (Veo) |
| Backwater Jetty | `public/videos/backwater.mp4` | Real jetty footage, trimmed in-app to 15.6–18.3 s to skip a hand-held zoom (`trim` in `src/lib/presets.ts`) |

You can also load any clip with **Open any video file…** or by dragging it onto the stage. Prompts for generating more clips are in [VIDEO_PROMPTS.md](VIDEO_PROMPTS.md).

**Pre-analysis.** Recorded clips are analysed before playback by default. The real detector and pose model run on every 0.1 s frame, and the results are saved in the browser, so each clip is analysed once and then starts instantly. Tracking, colour, zone logic, voice and incidents still run live during playback, and the HUD shows "PRE-ANALYSED AI DETECTIONS". Turn it off in **Settings** to run inference live on each frame instead.

> Before presenting, open each scene once on the demo laptop so its analysis is saved.

## How it works

```
frame → Person detector (EfficientDet-Lite2, COCO "person") + Pose Landmarker (33 landmarks)
      → pose attached to the person box it overlaps → temporary IDs (P-001…) via IoU + motion tracker
      → foot points (ankles/heels/toes, or box base) tested against the zone polygon
      → per-person state: SAFE → CAUTION → BREACH (0.7 s inside) → UNRESOLVED (2.5 s) → CLEARED
      → torso colour sampled from shoulders/hips, voted over time (skin ignored; "unknown" if unclear)
      → warning text → Sarvam TTS → one announcement at a time, 10 s per-person cooldown
      → incident (localStorage) → acknowledge / resolve / dismiss / simulated SOS preview
```

- Inference runs in a Web Worker (`public/vision-worker.js`), so video and overlays stay smooth.
- All coordinates are normalised, and a mirrored webcam is flipped before any zone maths.
- A weak detector box is kept only when the pose model independently confirms a body in it.
- Tiled detection gives small or distant people about 2× the resolution. Boxes cut by a tile seam are discarded.
- "Tracking lost" is reported as exactly that, never as drowning.

## Judge demo (≈2 minutes)
1. **Start monitoring**, then pick **Beach Safety**. The man in red walks to the water, turns amber, then red, and you hear "Attention, person in the red shirt…". The incident panel lights up, and the breach is **cleared** when he walks back.
2. Click the incident: **Acknowledge**, then **Open SOS preview**. Point out "simulation only, nothing is sent".
3. Switch to **മലയാളം** and replay. The same warning now plays in Malayalam.
4. **Platform Safety**: the man in green crosses the yellow line and gets a platform-specific warning. The woman in red stays SAFE.
5. **Backwater Jetty**: real Alappuzha footage of a man fishing at the jetty edge.
6. **Calibrate zone**: drag the red polygon live. Zones are saved per scene.
7. **Export annotated clip** saves an MP4 (two passes) with overlays and the voice warnings, as a backup.

Shortcuts: `Space` pause · `C` calibrate · `L` language · `M` mute · `Esc` close.

## Project layout
```
server/tts-proxy.ts        Sarvam proxy + disk cache (Vite middleware)
public/vision-worker.js    MediaPipe inference worker
src/lib/monitor.ts         Orchestrator: sources, pre-analysis, loop, events, export
src/lib/tracker.ts         Temporary-ID tracker
src/lib/safety.ts          Zone state machine
src/lib/color.ts           Clothing-colour estimate
src/lib/voice.ts           Announcement queue, Sarvam + fallback
src/lib/presets.ts         Scenes, zones, EN/ML warning text
src/components/*           Command-centre UI
```

## Limits (stated honestly)
- Danger zones are a camera-view approximation, not a real-world distance.
- Colour is approximate and refuses to guess in poor light or with mixed colours.
- IDs are temporary and only valid within a session. There is no face or identity recognition, and no video is stored.
- FPS, latency, event counts and acknowledgements on screen are measured values. No accuracy figure is claimed.
