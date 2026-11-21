# EdgeGuard AI: Veo prompts

Settings in Veo: **16:9 landscape, 1080p, 8 seconds.** Generate 2–3 takes per scene and keep the one where bodies and feet stay clearly visible.

Why the prompts are written this way. The detector needs:
- a fixed camera (no pan or zoom)
- bright, even light
- full bodies with feet visible
- people at a medium size
- solid shirt colours (red, blue, green, yellow)
- no text on screen

The 8-second timeline gives about 4 s inside the zone, enough for warning → unresolved → incident.

---

## 1. Alappuzha Beach, storm warning → save as `public/videos/beach.mp4`
```
Fixed high-angle CCTV security camera, completely static, no pan, no zoom, 16:9.
Alappuzha beach in Kerala, India, just before a monsoon storm. Dark heavy storm clouds over the
Arabian Sea, strong grey waves crashing on the shore, palm trees bending in the wind. Despite the
storm sky, the beach is brightly and evenly lit, clear visibility, no rain on the lens.
The camera stands on dry sand looking straight out to sea; the waterline runs horizontally across
the middle of the frame.
0–2 s: a man in a bright solid red t-shirt and dark shorts walks from the foreground toward the sea.
2–6 s: he steps into the shallow breaking waves and stands in the water, waves hitting his legs.
6–8 s: he turns around and walks back up onto the dry sand toward the camera.
The whole time, a woman in a bright solid blue kurta stands still on the dry sand in the
foreground, far from the water.
Full bodies and feet always visible, people medium-sized in frame, realistic natural walking.
Realistic security-camera footage. No text, no captions, no logos, no watermark, no timestamp.
```

## 2. Kochi Metro platform, storm outside → save as `public/videos/metro.mp4`
```
Fixed high-angle CCTV security camera mounted on the station ceiling, completely static, no pan,
no zoom, 16:9. A modern elevated Kochi Metro station platform in Kerala, India, during a monsoon
storm: heavy rain and dark storm clouds visible beyond the open sides of the station, but the
platform is brightly lit by strong white overhead lights, clean, evenly exposed, clear visibility.
The platform edge runs diagonally from the bottom-left to the top-right of the frame. The empty
track bed is on the LEFT. A bright yellow safety line runs along the platform edge.
0–2 s: a man in a bright solid green shirt and black trousers, looking down at his phone, walks
toward the edge and crosses the yellow line.
2–6 s: he stands right at the platform edge beyond the yellow line, still looking at his phone.
6–8 s: he looks up, steps back behind the yellow line and walks to the right.
The whole time, a woman in a bright solid red top waits calmly well behind the yellow line on the
right side of the platform. No train arrives.
Full bodies and feet always visible, people medium-sized in frame, realistic natural motion.
Realistic security-camera footage. No text, no captions, no logos, no watermark, no timestamp.
```

## 3. Alappuzha backwater jetty, storm → save as `public/videos/backwater.mp4`
```
Fixed high-angle CCTV security camera on a pole, completely static, no pan, no zoom, 16:9.
A concrete boat jetty on the Alappuzha backwaters in Kerala, India, before a storm: dark grey
storm clouds, strong wind rippling the green water, coconut palms swaying, a traditional wooden
kettuvallam houseboat moored beside the jetty. The jetty is brightly and evenly lit, clear
visibility, no rain on the lens.
The camera looks along the jetty; the water edge runs horizontally across the lower third of the frame.
0–2 s: a man in a bright solid yellow shirt and white mundu walks toward the edge of the jetty.
2–6 s: he stands at the very edge, leaning over and looking down into the water.
6–8 s: he steps back from the edge and walks toward the camera.
The whole time, a woman in a bright solid blue saree stands still near the middle of the jetty,
safely away from the edge.
Full bodies and feet always visible, people medium-sized in frame, realistic natural motion.
Realistic security-camera footage. No text, no captions, no logos, no watermark, no timestamp.
```

---

## If Veo gets it wrong
- **People too small or far away:** add `camera positioned close, people fill about half the frame height`.
- **Too dark:** add `bright overcast daylight, well exposed, high visibility`.
- **Camera moves:** start the prompt with `Static locked-off tripod shot.` and repeat `no camera movement` at the end.
- **Text appears:** regenerate. Any caption over the people blocks detection.

## After generating
1. Put the files in `public/videos/` with the names above, then reload the app.
2. Pick the scene, click **Calibrate zone**, and drag the red polygon over the water, the track side of the yellow line, or the jetty edge. It is saved per scene.
3. Click **Export annotated clip** to save a backup MP4 with overlays and voice.
