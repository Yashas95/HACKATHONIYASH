import { useCallback, useEffect, useState } from 'react'
import { AnimatePresence } from 'framer-motion'
import { Monitor, type Settings, type Snapshot, type SourceKind } from './lib/monitor'
import type { VoiceState } from './lib/voice'
import { PRESETS, allWarnings } from './lib/presets'
import { useIncidents, incidentStore } from './lib/incidents'
import { defaultPoints, loadZone, saveZone } from './lib/zones'
import type { EnvironmentPreset, Pt } from './types'
import { TopBar } from './components/TopBar'
import { Stage } from './components/Stage'
import { IntelPanel } from './components/IntelPanel'
import { ControlStrip } from './components/ControlStrip'
import { IncidentModal } from './components/IncidentModal'
import { Overview } from './components/Overview'
import { Rail, type View } from './components/Rail'

const PREFS = 'edgeguard.prefs.v2'
const initial: Settings = (() => {
  const base: Settings = {
    preset: PRESETS[0], language: 'en', audio: true, quality: 'accurate', crowdBoost: false, singlePerson: false,
    mirrored: true, minScore: 0.4, breachConfirmMs: 700, unresolvedMs: 2500, warningDistance: 0.06, preAnalyse: true, stormMode: true,
  }
  try {
    const saved = JSON.parse(localStorage.getItem(PREFS) ?? '{}')
    return { ...base, ...saved, preset: PRESETS.find((p) => p.id === saved.presetId) ?? base.preset }
  } catch { return base }
})()

const monitor = new Monitor({ ...initial })
if (import.meta.env.DEV) (window as unknown as { __eg: Monitor }).__eg = monitor // dev-only handle for debugging

export default function App() {
  const [settings, setSettings] = useState<Settings>(initial)
  const [snap, setSnap] = useState<Snapshot>(monitor.snap)
  const [voice, setVoice] = useState<VoiceState>(monitor.voice.state)
  const [available, setAvailable] = useState<Record<string, boolean>>({})
  const [calibrating, setCalibrating] = useState(false)
  const [drawMode, setDrawMode] = useState(false)
  const [openId, setOpenId] = useState<string | null>(null)
  const [rate, setRateState] = useState(1)
  const [toast, setToast] = useState<string | null>(null)
  const [view, setView] = useState<View>('overview')
  // A scene chosen on the landing page before the models finish loading waits for them.
  const [pending, setPending] = useState<null | { kind: 'video'; preset: EnvironmentPreset } | { kind: 'webcam' }>(null)
  const incidents = useIncidents()

  useEffect(() => monitor.subscribe(setSnap), [])
  useEffect(() => monitor.voice.subscribe(setVoice), [])
  useEffect(() => {
    void monitor.loadEngine()
    void monitor.voice.init()
    // Which preset clips exist in public/videos?
    Promise.all(PRESETS.map(async (p) => {
      try {
        const r = await fetch(p.video, { method: 'HEAD' })
        return [p.id, r.ok && (r.headers.get('content-type') ?? '').startsWith('video')] as const
      } catch { return [p.id, false] as const }
    })).then((e) => setAvailable(Object.fromEntries(e)))
  }, [])

  const set = useCallback((p: Partial<Settings>) => {
    setSettings((s) => {
      const next = { ...s, ...p }
      if (p.quality && p.quality !== s.quality) void monitor.setQuality(p.quality)
      monitor.settings = next
      const { preset, ...rest } = next
      try { localStorage.setItem(PREFS, JSON.stringify({ ...rest, presetId: preset.id })) } catch { /* ignore */ }
      return next
    })
  }, [])

  // Zone follows preset + source kind.
  const applyZone = useCallback((preset: EnvironmentPreset, source: SourceKind) => {
    monitor.zones = [loadZone(preset, source)]
  }, [])
  useEffect(() => { applyZone(settings.preset, snap.source) }, [settings.preset, snap.source, applyZone])

  // Warm the Sarvam cache for the active preset + language.
  useEffect(() => {
    if (voice.backend === 'sarvam' && snap.running) void monitor.voice.prefetch(allWarnings(settings.preset, settings.language), settings.language)
  }, [voice.backend, snap.running, settings.preset, settings.language])

  const flash = (m: string) => { setToast(m); setTimeout(() => setToast(null), 3200) }

  const pickVideo = (p: EnvironmentPreset) => {
    monitor.voice.unlock()
    set({ preset: p })
    applyZone(p, 'video')
    setRateState(1)
    void monitor.startVideo(p.video, p.video.split('/').pop()!, p.trim)
  }
  const pickWebcam = () => { monitor.voice.unlock(); applyZone(settings.preset, 'webcam'); void monitor.startWebcam() }
  const openFile = (f: File) => {
    monitor.voice.unlock()
    applyZone(settings.preset, 'video')
    void monitor.startVideo(URL.createObjectURL(f), f.name)
  }
  const start = () => (available[settings.preset.id] ? pickVideo(settings.preset) : pickWebcam())
  const stop = () => { if (snap.recording) void monitor.stopRecording(); monitor.stop(); setCalibrating(false); setDrawMode(false) }
  const changePreset = (p: EnvironmentPreset) => {
    if (snap.running && snap.source === 'video' && available[p.id]) return pickVideo(p)
    set({ preset: p })
    applyZone(p, snap.source)
    monitor.resetScene()
  }

  const zoneEdited = (pts: Pt[]) => saveZone(settings.preset, snap.source, pts)
  const drawDone = (raw: Pt[]) => {
    const pts = raw.filter((q, i) => i === 0 || Math.hypot(q.x - raw[i - 1].x, q.y - raw[i - 1].y) > 0.01)
    if (pts.length < 3) return
    monitor.zones[0].polygonCoordinates = pts
    saveZone(settings.preset, snap.source, pts)
    monitor.resetScene()
    setDrawMode(false)
  }
  const resetZone = () => {
    const pts = defaultPoints(settings.preset, snap.source)
    monitor.zones[0].polygonCoordinates = pts
    saveZone(settings.preset, snap.source, pts)
  }
  useEffect(() => { monitor.calibrating = calibrating }, [calibrating])

  const record = async () => {
    if (snap.recording) { const f = await monitor.stopRecording(); if (f) flash(`Saved ${f} to your Downloads folder`) }
    else { monitor.voice.unlock(); monitor.startRecording(); flash('Recording overlay + voice…') }
  }
  const exportClip = async () => { monitor.voice.unlock(); setRateState(1); monitor.setRate(1); await monitor.exportClip(); flash('Exporting: clip restarted, will auto-save when it ends') }
  const setRate = (r: number) => { setRateState(r); monitor.setRate(r) }

  // Keyboard shortcuts for the presenter
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if ((e.target as HTMLElement).tagName === 'INPUT') return
      if (e.key === ' ' && snap.source === 'video') { e.preventDefault(); monitor.togglePause() }
      if (e.key === 'c') setCalibrating((c) => !c)
      if (e.key === 'l') { const order = ['en', 'ml', 'hi', 'kn'] as const; set({ language: order[(order.indexOf(settings.language) + 1) % order.length] }) }
      if (e.key === 'm') set({ audio: !settings.audio })
      if (e.key === 'Escape') { setDrawMode(false); setOpenId(null) }
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [snap.source, settings.language, settings.audio, set])

  useEffect(() => {
    if (!pending || snap.engine !== 'ready') return
    setPending(null)
    if (pending.kind === 'video') pickVideo(pending.preset); else pickWebcam()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [pending, snap.engine])

  const open = incidents.find((i) => i.id === openId)

  const rail = <Rail view={view} onNav={setView} engineOk={snap.engine === 'ready'} />
  const modal = <AnimatePresence>{open && <IncidentModal key={open.id} incident={open} onClose={() => setOpenId(null)} />}</AnimatePresence>
  if (view === 'overview') {
    return (
      <div className="flex h-full">
        {rail}
        <Overview engine={snap.engine} engineNote={snap.engineNote} voice={voice} incidents={incidents} available={available}
          onScene={(p) => { monitor.voice.unlock(); set({ preset: p }); setView('console'); setPending({ kind: 'video', preset: p }) }}
          onWebcam={() => { monitor.voice.unlock(); setView('console'); setPending({ kind: 'webcam' }) }}
          onIncident={(i) => setOpenId(i.id)} />
        {modal}
      </div>
    )
  }

  return (
    <div className="flex h-full">
      {rail}
      <div className="flex min-w-0 flex-1 flex-col">
      <TopBar snap={snap} voice={voice} preset={settings.preset} />
      <main className="flex min-h-0 flex-1">
        <Stage
          monitor={monitor} snap={snap} voice={voice} preset={settings.preset} available={available}
          calibrating={calibrating} drawMode={drawMode} onZoneEdited={zoneEdited} onDrawDone={drawDone}
          onPickVideo={pickVideo} onPickWebcam={pickWebcam} onOpenFile={openFile}
        />
        <IntelPanel snap={snap} incidents={incidents} onOpen={(i) => setOpenId(i.id)} onClear={() => incidentStore.clear()} />
      </main>
      <ControlStrip
        snap={snap} settings={settings} set={set} calibrating={calibrating} drawMode={drawMode}
        onCalibrate={() => { setCalibrating((c) => !c); setDrawMode(false) }} onDrawMode={() => setDrawMode((d) => !d)} onResetZone={resetZone}
        onStart={start} onStop={stop} onPreset={changePreset} onSwitchCamera={async () => { if (!(await monitor.switchCamera())) flash('Only one camera available') }}
        onRecord={record} onExport={exportClip} rate={rate} setRate={setRate}
      />
      </div>
      {modal}
      <AnimatePresence>
        {toast && <div className="mono fixed bottom-20 left-1/2 z-50 -translate-x-1/2 border border-line-2 bg-bg px-4 py-2 text-[11.5px] tracking-wide">{toast}</div>}
      </AnimatePresence>
    </div>
  )
}
