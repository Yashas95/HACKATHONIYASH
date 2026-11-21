import type { Detection, EnvironmentPreset, Language, Pt, SafetyZone, ZoneState } from '../types'
import { VisionEngine, type DetectorQuality } from './vision'
import { Tracker } from './tracker'
import { SafetyEngine, type SafetyEvent } from './safety'
import { VoiceManager } from './voice'
import { ClipRecorder } from './recorder'
import { drawFrame } from './render'
import { sampleClothing, stickyColor, torsoRegion } from './color'
import { incidentStore } from './incidents'
import { warningText } from './presets'

export type SourceKind = 'video' | 'webcam'
export type EngineStatus = 'idle' | 'loading' | 'ready' | 'error'

export interface Settings {
  preset: EnvironmentPreset
  language: Language
  audio: boolean
  quality: DetectorQuality
  crowdBoost: boolean
  singlePerson: boolean
  mirrored: boolean
  minScore: number
  breachConfirmMs: number
  unresolvedMs: number
  warningDistance: number
  /** Recorded clips: run detection on every 0.1 s frame up front, then play back smoothly. */
  preAnalyse: boolean
  /** Lifeguard switch: storm = water entry forbidden (red + voice). Off = yellow line is advisory (amber only). */
  stormMode: boolean
}

export interface LogEntry { id: number; t: number; kind: 'breach' | 'resolved' | 'unresolved' | 'lost' | 'warning'; personId: string; text: string }

export interface Snapshot {
  engine: EngineStatus
  engineNote: string
  source: SourceKind
  sourceState: 'none' | 'starting' | 'live' | 'error'
  paused: boolean
  sourceNote: string
  sourceName: string
  running: boolean
  fps: number
  people: number
  near: number
  breaches: number
  unresolved: number
  boundaryEvents: number
  warningsIssued: number
  lastLatencyMs: number | null
  tracks: { id: string; state: ZoneState; color: string; lost: boolean; footSource: string; since: number }[]
  log: LogEntry[]
  videoTime: number
  videoDuration: number
  recording: boolean
  exporting: boolean
  preAnalysed: boolean
  size: { w: number; h: number }
}

const WARN_COOLDOWN_MS = 10000

export class Monitor {
  readonly video = document.createElement('video')
  readonly vision = new VisionEngine()
  readonly tracker = new Tracker()
  readonly safety = new SafetyEngine()
  readonly voice = new VoiceManager()
  readonly recorder = new ClipRecorder()
  canvas?: HTMLCanvasElement
  private octx?: CanvasRenderingContext2D
  settings: Settings
  zones: SafetyZone[] = []
  calibrating = false
  dragIndex: number | null = null
  draft?: Pt[]

  private raf = 0
  private stream?: MediaStream
  private lastVideoTime = -1
  private sceneNow = 0
  private fpsEma = 0
  private lastInfer = 0
  private boundaryEvents = 0
  private warningsIssued = 0
  private lastLatency: number | null = null
  private log: LogEntry[] = []
  private logId = 0
  private breachStart = new Map<string, number>()
  private incidentFor = new Map<string, string>()
  private lastWarnAt = new Map<string, number>()
  private exporting = false
  private subtitle?: { text: string; until: number }
  private listeners = new Set<(s: Snapshot) => void>()
  private lastEmit = 0
  snap: Snapshot

  constructor(settings: Settings) {
    this.settings = settings
    this.video.muted = true
    this.video.playsInline = true
    this.video.crossOrigin = 'anonymous'
    this.snap = {
      engine: 'idle', engineNote: '', source: 'video', sourceState: 'none', paused: false, sourceNote: '', sourceName: '', running: false,
      fps: 0, people: 0, near: 0, breaches: 0, unresolved: 0, boundaryEvents: 0, warningsIssued: 0, lastLatencyMs: null,
      tracks: [], log: [], videoTime: 0, videoDuration: 0, recording: false, exporting: false, preAnalysed: false, size: { w: 16, h: 9 },
    }
    this.voice.onStart = (ids, source, text) => {
      const now = this.sceneNow
      this.subtitle = { text, until: performance.now() + 6000 }
      for (const id of ids) {
        const start = this.breachStart.get(id)
        if (start !== undefined) this.lastLatency = Math.round(now - start)
        this.warningsIssued++
        this.pushLog('warning', id, `Voice warning (${source === 'sarvam' ? 'Sarvam' : 'browser fallback'}): “${text}”`)
        const inc = this.incidentFor.get(id)
        if (inc) incidentStore.update(inc, { warningIssued: true, warningText: text }, `Voice warning played (${source})`)
      }
    }
  }

  subscribe(fn: (s: Snapshot) => void) { this.listeners.add(fn); fn(this.snap); return () => { this.listeners.delete(fn) } }
  private emit(force = false) {
    const t = performance.now()
    if (!force && t - this.lastEmit < 150) return
    this.lastEmit = t
    this.snap = this.buildSnapshot()
    this.listeners.forEach((f) => f(this.snap))
  }
  private patch(p: Partial<Snapshot>) { this.snap = { ...this.snap, ...p }; this.listeners.forEach((f) => f(this.snap)) }

  attach(canvas: HTMLCanvasElement) {
    this.canvas = canvas
    this.octx = canvas.getContext('2d')!
    if (!this.raf) this.raf = requestAnimationFrame(this.tick)
  }

  async loadEngine() {
    if (this.vision.ready || this.snap.engine === 'loading') return
    this.patch({ engine: 'loading', engineNote: 'Starting…' })
    try {
      await this.vision.load(this.settings.quality, (s) => this.patch({ engineNote: s }))
      this.patch({ engine: 'ready', engineNote: `MediaPipe · ${this.vision.delegate} · ${this.vision.quality === 'fast' ? 'Lite0' : 'Lite2'}` })
    } catch (e) {
      this.patch({ engine: 'error', engineNote: `Model failed to load: ${(e as Error).message}` })
    }
  }

  async setQuality(q: DetectorQuality) {
    this.settings.quality = q
    if (!this.vision.ready) return
    this.patch({ engineNote: 'Switching detector…' })
    await this.vision.setQuality(q)
    this.patch({ engineNote: `MediaPipe · ${this.vision.delegate} · ${q === 'fast' ? 'Lite0' : 'Lite2'}` })
  }

  // ---------- sources ----------
  private stopStream() {
    this.stream?.getTracks().forEach((t) => t.stop())
    this.stream = undefined
    this.video.srcObject = null
  }

  private range = { start: 0, end: Infinity }
  async startVideo(url: string, name: string, trim?: { start: number; end: number }) {
    this.stopStream()
    this.resetScene()
    this.patch({ source: 'video', sourceState: 'starting', sourceName: name, sourceNote: 'Loading video…', running: true })
    this.video.loop = !trim
    this.video.src = url
    try {
      await new Promise<void>((res, rej) => {
        this.video.onloadeddata = () => res()
        this.video.onerror = () => rej(new Error(`Cannot load ${name}. Put the file in public/videos/ or use “Open video file”.`))
      })
      this.cache = undefined
      this.range = { start: trim?.start ?? 0, end: Math.min(trim?.end ?? Infinity, this.video.duration) }
      if (this.settings.preAnalyse && this.video.duration <= 180) await this.analyse(this.video.src)
      if (!this.snap.running) return
      this.video.currentTime = this.range.start
      this.resetScene()
      await this.video.play()
      this.patch({ sourceState: 'live', sourceNote: '' })
    } catch (e) {
      this.patch({ sourceState: 'error', sourceNote: (e as Error).message, running: false })
    }
  }

  /**
   * Pre-analysis: runs the real detector + pose model on every STEP of the clip
   * as fast as the hardware allows, so playback is smooth on any laptop.
   * Tracking, safety logic, voice and incidents still run during playback.
   */
  private cache?: { src: string; frames: Detection[][]; fps: number; step: number }
  private lastCacheIdx = -1
  private static STEP = 0.1
  private analysisKey(src: string) {
    const name = src.startsWith('blob:') ? `${this.snap.sourceName}:${this.video.duration.toFixed(2)}` : new URL(src).pathname
    return `edgeguard.analysis.v3:${name}:${this.range.start}-${this.range.end.toFixed(2)}`
  }
  private async analyse(src: string) {
    const v = this.video
    const step = this.range.end - this.range.start > 20 ? 0.2 : Monitor.STEP
    v.pause()
    const key = this.analysisKey(src)
    try {
      const saved = localStorage.getItem(key)
      if (saved) {
        const parsed = JSON.parse(saved) as { frames: Detection[][]; fps: number }
        this.cache = { src, frames: parsed.frames, fps: parsed.fps, step }
        return
      }
    } catch { /* re-analyse */ }
    const { start, end } = this.range
    const n = Math.floor((end - start) / step) + 1
    const frames: Detection[][] = []
    const t0 = performance.now()
    for (let i = 0; i < n; i++) {
      if (!this.snap.running || v.src !== src) return // stopped or switched mid-analysis
      v.currentTime = Math.min(start + i * step, end - 0.01)
      await new Promise<void>((r) => { v.onseeked = () => r() })
      const wide = v.videoWidth >= 1600
      this.vision.capture(v, false, wide ? 1920 : 960)
      frames[i] = await this.vision.infer({ mirrored: false, crowdBoost: true, grid: wide, minScore: 0.25, both: true })
      if (i % 3 === 0) this.patch({ sourceNote: `Analysing footage with AI… ${Math.round(((i + 1) / n) * 100)}% (${i + 1}/${n} frames)` })
    }
    v.onseeked = null
    this.cache = { src, frames, fps: n / ((performance.now() - t0) / 1000), step }
    // Store compactly (rounded coordinates); if storage is full, playback still works this session.
    try {
      const r = (x: number) => Math.round(x * 1000) / 1000
      const compact = frames.map((f) => f.map((d) => ({
        score: r(d.score), box: { x: r(d.box.x), y: r(d.box.y), w: r(d.box.w), h: r(d.box.h) },
        ...(d.landmarks ? { landmarks: d.landmarks.map((p) => ({ x: r(p.x), y: r(p.y), v: r(p.v) })) } : {}),
      })))
      localStorage.setItem(key, JSON.stringify({ frames: compact, fps: this.cache.fps }))
    } catch { /* quota exceeded */ }
  }

  async startWebcam(deviceId?: string) {
    this.cache = undefined
    this.stopStream()
    this.resetScene()
    this.video.removeAttribute('src')
    this.video.loop = false
    this.patch({ source: 'webcam', sourceState: 'starting', sourceName: 'Webcam', sourceNote: 'Requesting camera permission…', running: true })
    try {
      this.stream = await navigator.mediaDevices.getUserMedia({
        video: deviceId ? { deviceId: { exact: deviceId }, width: 1280, height: 720 } : { width: 1280, height: 720, facingMode: 'user' },
        audio: false,
      })
      this.video.srcObject = this.stream
      await this.video.play()
      const label = this.stream.getVideoTracks()[0]?.label || 'Webcam'
      this.patch({ sourceState: 'live', sourceNote: '', sourceName: label })
    } catch (e) {
      const err = e as DOMException
      const msg = err.name === 'NotAllowedError' ? 'Camera permission was denied. Allow camera access in the browser, or use the recorded footage presets.'
        : err.name === 'NotFoundError' ? 'No camera found. Use the recorded footage presets instead.'
        : err.name === 'NotReadableError' ? 'Camera is in use by another app.'
        : `Camera error: ${err.message}`
      this.patch({ sourceState: 'error', sourceNote: msg, running: false })
    }
  }

  async switchCamera() {
    const cams = (await navigator.mediaDevices.enumerateDevices()).filter((d) => d.kind === 'videoinput')
    if (cams.length < 2) return false
    const current = this.stream?.getVideoTracks()[0]?.getSettings().deviceId
    const i = cams.findIndex((c) => c.deviceId === current)
    await this.startWebcam(cams[(i + 1) % cams.length].deviceId)
    return true
  }

  stop() {
    this.stopStream()
    this.video.pause()
    this.voice.cancel()
    this.patch({ running: false, sourceState: 'none', sourceNote: '' })
    this.resetScene()
  }

  togglePause() {
    if (this.snap.source !== 'video') return
    if (this.video.paused) void this.video.play(); else this.video.pause()
  }
  seek(t: number) { this.video.currentTime = t; this.resetScene() }
  setRate(r: number) { this.video.playbackRate = r }

  private generation = 0
  private lastDraw = 0
  resetScene() {
    this.generation++
    this.vision.reset()
    this.tracker.clear()
    this.safety.clear()
    this.breachStart.clear()
    this.incidentFor.clear()
    this.lastWarnAt.clear()
    this.lastVideoTime = -1
    this.lastCacheIdx = -1
  }

  // ---------- export ----------
  startRecording() {
    if (!this.canvas || this.recorder.recording) return
    this.recorder.start(this.canvas, this.voice.recordDest?.stream)
    this.patch({ recording: true })
  }
  async stopRecording() {
    if (!this.recorder.recording) return ''
    const name = `edgeguard-${this.settings.preset.id}-${new Date().toISOString().slice(0, 19).replace(/[:T]/g, '-')}`
    const file = await this.recorder.stop(name)
    this.exporting = false
    this.video.loop = this.snap.source === 'video' && this.range.start === 0 && this.range.end >= this.video.duration - 0.05
    this.patch({ recording: false, exporting: false })
    return file
  }
  private exportPasses = 0
  /** Re-plays the clip from the start and records two passes with overlays + voice. */
  async exportClip() {
    if (this.snap.source !== 'video' || this.recorder.recording) return
    this.exporting = true
    this.exportPasses = 0
    this.video.loop = false
    if (!Number.isFinite(this.range.end)) this.range.end = this.video.duration
    this.video.currentTime = this.range.start
    this.resetScene()
    await this.video.play()
    this.startRecording()
    this.patch({ exporting: true })
  }

  // ---------- main loop ----------
  private tick = () => {
    this.raf = requestAnimationFrame(this.tick)
    const v = this.video
    const live = this.snap.running && v.readyState >= 2 && v.videoWidth > 0
    if (!live || !this.canvas || !this.octx) { this.emit(); return }

    const vw = v.videoWidth, vh = v.videoHeight
    const scale = Math.min(1, 1280 / vw)
    const W = Math.round(vw * scale), H = Math.round(vh * scale)
    if (this.canvas.width !== W || this.canvas.height !== H) {
      this.canvas.width = W; this.canvas.height = H
      this.patch({ size: { w: W, h: H } })
    }
    const mirrored = this.snap.source === 'webcam' && this.settings.mirrored
    const aspect = W / H

    // Advance scene time only on new frames, so a paused clip doesn't keep "observing" the same instant.
    const newFrame = v.currentTime !== this.lastVideoTime
    if (newFrame) {
      if (this.snap.source === 'video') {
        // Trimmed clips loop manually inside their range; export stops at the range end.
        if (v.currentTime >= this.range.end - 0.02) {
          if (this.exporting && ++this.exportPasses >= 2) { v.pause(); void this.stopRecording() } else v.currentTime = this.range.start
        }
        const dt = this.lastVideoTime < 0 || v.currentTime < this.lastVideoTime ? 33 : (v.currentTime - this.lastVideoTime) * 1000
        this.sceneNow += Math.min(200, Math.max(1, dt))
      } else {
        this.sceneNow = performance.now()
      }
      this.lastVideoTime = v.currentTime
      const cache = this.cache && this.cache.src === v.src && this.snap.source === 'video' ? this.cache : undefined
      if (cache) {
        const i = Math.max(0, Math.min(cache.frames.length - 1, Math.floor((v.currentTime - this.range.start) / cache.step + 1e-6)))
        if (i !== this.lastCacheIdx) {
          this.lastCacheIdx = i
          this.vision.capture(v, false) // current pixels for clothing colour
          // The operator's confidence threshold still applies at playback time.
          const dets = (cache.frames[i] ?? []).filter((d) => d.score >= this.settings.minScore || d.landmarks)
          this.onDetections(dets, this.sceneNow, aspect, false)
        }
      } else if (this.vision.ready && !this.vision.busy && this.vision.capture(v, mirrored)) {
        const frameTime = this.sceneNow, gen = this.generation
        this.vision.infer({ mirrored, crowdBoost: this.settings.crowdBoost, minScore: this.settings.minScore })
          .then((dets) => { if (gen === this.generation) this.onDetections(dets, frameTime, aspect) })
          .catch((e) => this.patch({ engineNote: `Inference error: ${(e as Error).message}` }))
      }
    }

    // Cap compositing at ~30 fps: the GPU is shared with video decode and inference.
    const tnow = performance.now()
    if (tnow - this.lastDraw < 30) { this.emit(); return }
    this.lastDraw = tnow
    const zonesForDraw = this.zones
    const sub = this.subtitle && performance.now() < this.subtitle.until ? this.subtitle.text : undefined
    drawFrame(this.octx, v, W, H, this.tracker.tracks, zonesForDraw, {
      title: this.settings.preset.location,
      camera: this.settings.preset.cameraName,
      sourceLabel: this.snap.source === 'webcam' ? 'LIVE CAMERA · AI INFERENCE' : this.cache ? 'RECORDED FOOTAGE · PRE-ANALYSED AI DETECTIONS' : 'RECORDED FOOTAGE · LIVE AI INFERENCE',
      clock: new Date().toLocaleTimeString('en-IN', { hour12: false }),
      subtitle: sub, storm: this.settings.stormMode, calibrating: this.calibrating, dragIndex: this.dragIndex, draft: this.draft,
    }, performance.now(), mirrored)
    this.emit()
  }

  private onDetections(raw: Detection[], now: number, aspect: number, live = true) {
    const s = this.settings
    let dets = raw
    if (s.singlePerson && dets.length > 1) dets = [dets.reduce((a, b) => (b.box.w * b.box.h > a.box.w * a.box.h ? b : a))]
    const tracks = this.tracker.update(dets, now, aspect)

    // Clothing colour: sample torso every few frames, vote over time.
    const work = this.vision.work
    for (const t of tracks) {
      if (t.lost || t.lastObservedAt !== now) continue
      if (++t.framesSinceColor < 2) continue
      t.framesSinceColor = 0
      if (t.box.h < 0.09) continue
      const region = torsoRegion(t.box, t.landmarks)
      const c = region && sampleClothing(work, work.width, work.height, region)
      if (c) { t.colorVotes.push(c); if (t.colorVotes.length > 12) t.colorVotes.shift() }
      // Sticky: a confirmed colour survives unclear samples and only changes on a strong majority.
      t.approximateClothingColor = stickyColor(t.colorVotes, t.approximateClothingColor)
    }

    for (const z of this.zones) { z.warningDistance = s.warningDistance; z.breachConfirmationMilliseconds = s.breachConfirmMs }
    const events = this.safety.update(tracks, this.zones, now, aspect, {
      // Outside storm mode the yellow line is advisory: crossing it shows amber, never a breach.
      breachConfirmMs: s.stormMode ? s.breachConfirmMs : Infinity, unresolvedMs: s.unresolvedMs, resolveMs: 400,
    })
    for (const e of events) this.handle(e)

    if (!live) return
    const dt = performance.now() - this.lastInfer
    this.lastInfer = performance.now()
    if (dt < 2000) this.fpsEma = this.fpsEma ? this.fpsEma * 0.9 + (1000 / dt) * 0.1 : 1000 / dt
  }

  private handle(e: SafetyEvent) {
    const t = e.track
    const p = this.settings.preset
    const zoneLabel = this.zones[0]?.label ?? p.zoneLabel
    if (e.type === 'breach') {
      this.boundaryEvents++
      this.breachStart.set(t.id, e.insideSince)
      const color = t.approximateClothingColor
      this.pushLog('breach', t.id, `${t.id} entered ${zoneLabel}${color !== 'unknown' ? ` (${color} shirt)` : ''}`)
      const last = this.lastWarnAt.get(t.id) ?? -Infinity
      if (this.settings.audio && this.sceneNow - last > WARN_COOLDOWN_MS) {
        this.lastWarnAt.set(t.id, this.sceneNow)
        t.lastWarningAt = this.sceneNow
        const lang = this.settings.language
        this.voice.request({
          personId: t.id, lang,
          text: warningText(p, lang, color), enText: warningText(p, 'en', color),
          groupText: p.warningMessages[lang].group, groupEnText: p.warningMessages.en.group,
        })
      }
    } else if (e.type === 'unresolved') {
      this.pushLog('unresolved', t.id, `${t.id} still inside after ${+(this.settings.unresolvedMs / 1000).toFixed(1)}s — escalated to operator`)
      const id = `INC-${Date.now().toString(36).toUpperCase().slice(-6)}`
      const wall = Date.now()
      const breachWall = wall - (this.sceneNow - e.breachAt)
      const color = t.approximateClothingColor
      this.incidentFor.set(t.id, id)
      incidentStore.create({
        id, personSessionId: t.id, cameraLocation: `${p.cameraName} · ${p.location}`, zoneLabel,
        incidentType: 'unresolved-breach',
        description: `Person ${t.id}${color !== 'unknown' ? ` (approx. ${color} upper clothing)` : ''} remained inside the ${zoneLabel.toLowerCase()} beyond ${+(this.settings.unresolvedMs / 1000).toFixed(1)} s.`,
        clothing: color, detectedAt: wall, breachStartedAt: breachWall, status: 'active', acknowledged: false,
        warningIssued: t.lastWarningAt > 0,
        timeline: [
          { t: breachWall, text: `Boundary breach confirmed (${t.footSource === 'pose' ? 'foot landmarks' : 'body box base'} inside zone)` },
          ...(t.lastWarningAt > 0 ? [{ t: breachWall, text: 'Personalised voice warning issued' }] : []),
          { t: wall, text: 'Unresolved — escalated for operator review' },
        ],
      })
    } else if (e.type === 'resolved') {
      const dur = ((this.sceneNow - e.breachAt) / 1000).toFixed(1)
      this.pushLog('resolved', t.id, `${t.id} returned to the safe area after ${dur}s`)
      const inc = this.incidentFor.get(t.id)
      if (inc) incidentStore.update(inc, { status: 'person-returned', resolvedAt: Date.now() }, 'Person returned to the permitted area')
      this.incidentFor.delete(t.id)
      this.breachStart.delete(t.id)
    } else if (e.type === 'lost') {
      this.pushLog('lost', t.id, `${t.id} tracking lost while inside zone`)
      const inc = this.incidentFor.get(t.id)
      if (inc) incidentStore.update(inc, { status: 'tracking-lost' }, 'Tracking lost — person no longer visible to camera')
    }
    this.emit(true)
  }

  private pushLog(kind: LogEntry['kind'], personId: string, text: string) {
    this.log = [{ id: ++this.logId, t: Date.now(), kind, personId, text }, ...this.log].slice(0, 40)
  }

  private buildSnapshot(): Snapshot {
    const vis = this.tracker.tracks.filter((t) => t.confirmed)
    const seen = vis.filter((t) => !t.lost)
    return {
      ...this.snap,
      paused: this.video.paused,
      fps: !this.snap.running ? 0 : this.cache ? Math.round(this.cache.fps * 10) / 10 : Math.round(this.fpsEma * 10) / 10,
      preAnalysed: !!this.cache && this.snap.source === 'video',
      people: seen.length,
      near: seen.filter((t) => t.zoneState === 'caution').length,
      breaches: seen.filter((t) => t.zoneState === 'breach' || t.zoneState === 'unresolved').length,
      unresolved: seen.filter((t) => t.zoneState === 'unresolved').length,
      boundaryEvents: this.boundaryEvents,
      warningsIssued: this.warningsIssued,
      lastLatencyMs: this.lastLatency,
      tracks: vis.map((t) => ({ id: t.id, state: t.zoneState, color: t.approximateClothingColor, lost: t.lost, footSource: t.footSource, since: t.firstObservedAt })),
      log: this.log,
      videoTime: this.video.currentTime || 0,
      videoDuration: Number.isFinite(this.video.duration) ? this.video.duration : 0,
      recording: this.recorder.recording,
      exporting: this.exporting,
    }
  }

  // Zone editing helpers (display-normalized coords)
  hitVertex(p: Pt, tolPx: number, rect: DOMRect): number | null {
    const pts = this.zones[0]?.polygonCoordinates ?? []
    let best: number | null = null, bd = tolPx
    pts.forEach((q, i) => {
      const d = Math.hypot((q.x - p.x) * rect.width, (q.y - p.y) * rect.height)
      if (d < bd) { bd = d; best = i }
    })
    return best
  }

  destroy() {
    cancelAnimationFrame(this.raf)
    this.raf = 0
    this.stop()
  }
}
