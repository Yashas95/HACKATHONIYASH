import { useState } from 'react'
import { AnimatePresence, motion } from 'framer-motion'
import { Circle, Clapperboard, Crosshair, Gauge, Pencil, Play, RefreshCcw, RotateCcw, Sailboat, TreePalm, SlidersHorizontal, Square, SwitchCamera, TrainFront, Volume2, VolumeX, Waves } from 'lucide-react'
import type { Settings, Snapshot } from '../lib/monitor'
import { PRESETS } from '../lib/presets'
import type { EnvironmentPreset } from '../types'

interface Props {
  snap: Snapshot
  settings: Settings
  set: (p: Partial<Settings>) => void
  calibrating: boolean
  drawMode: boolean
  onCalibrate: () => void
  onDrawMode: () => void
  onResetZone: () => void
  onStart: () => void
  onStop: () => void
  onPreset: (p: EnvironmentPreset) => void
  onSwitchCamera: () => void
  onRecord: () => void
  onExport: () => void
  rate: number
  setRate: (r: number) => void
}

const ICON = { beach: Waves, beach2: Waves, metro: TrainFront, backwater: Sailboat, promenade: TreePalm }

export function ControlStrip(p: Props) {
  const { snap, settings: s } = p
  const [open, setOpen] = useState(false)
  const live = snap.running

  return (
    <footer className="relative flex h-[54px] shrink-0 items-center gap-2 border-t border-line bg-bg px-4">
      {live
        ? <button className="btn btn-danger" onClick={p.onStop}><Square size={14} fill="currentColor" /> Stop</button>
        : <button className="btn btn-primary" onClick={p.onStart} disabled={snap.engine !== 'ready'}><Play size={14} fill="currentColor" /> Start monitoring</button>}

      <div className="seg" role="group" aria-label="Environment">
        {PRESETS.map((pr) => {
          const Icon = ICON[pr.id]
          return <button key={pr.id} data-on={s.preset.id === pr.id} onClick={() => p.onPreset(pr)} title={pr.name}><Icon size={14} /><span className="hidden xl:inline">{pr.name}</span></button>
        })}
      </div>

      <div className="flex items-center gap-1.5">
        <button className={`btn ${p.calibrating ? 'btn-on' : ''}`} onClick={p.onCalibrate} disabled={!live}><Crosshair size={15} /> {p.calibrating ? 'Done' : 'Calibrate zone'}</button>
        <AnimatePresence>
          {p.calibrating && (
            <motion.div initial={{ opacity: 0, width: 0 }} animate={{ opacity: 1, width: 'auto' }} exit={{ opacity: 0, width: 0 }} className="flex gap-1.5 overflow-hidden">
              <button className={`btn ${p.drawMode ? 'btn-on' : ''}`} onClick={p.onDrawMode}><Pencil size={14} /> Redraw</button>
              <button className="btn" onClick={p.onResetZone}><RotateCcw size={14} /> Default</button>
            </motion.div>
          )}
        </AnimatePresence>
      </div>

      <button className={`btn ${s.stormMode ? 'btn-danger' : ''}`} onClick={() => p.set({ stormMode: !s.stormMode })}
        title="Lifeguard control. Storm: entering the water is forbidden (red + voice warning). Normal: the yellow line is advisory (amber only).">
        {s.stormMode ? 'Storm · water closed' : 'Normal · advisory'}
      </button>

      <div className="seg" role="group" aria-label="Voice language">
        <button data-on={s.language === 'en'} onClick={() => p.set({ language: 'en' })}>EN</button>
        <button data-on={s.language === 'ml'} onClick={() => p.set({ language: 'ml' })}>മലയാളം</button>
      </div>
      <button className={`btn ${s.audio ? 'btn-on' : ''}`} onClick={() => p.set({ audio: !s.audio })} title="Voice alerts">{s.audio ? <Volume2 size={15} /> : <VolumeX size={15} />}<span className="hidden 2xl:inline">{s.audio ? 'Audio on' : 'Muted'}</span></button>

      {snap.source === 'webcam' && live && <button className="btn" onClick={p.onSwitchCamera} title="Switch camera"><SwitchCamera size={15} /></button>}
      {snap.source === 'webcam' && live && <button className={`btn ${s.mirrored ? 'btn-on' : ''}`} onClick={() => p.set({ mirrored: !s.mirrored })} title="Mirror display"><RefreshCcw size={15} /></button>}

      {snap.source === 'video' && live && (
        <div className="seg" title="Playback speed — slower gives the detector more frames per second of footage">
          {[0.5, 1].map((r) => <button key={r} data-on={p.rate === r} onClick={() => p.setRate(r)}>{r}×</button>)}
        </div>
      )}

      <div className="ml-auto flex items-center gap-2">
        {snap.source === 'video' && live && !snap.recording && <button className="btn" onClick={p.onExport} title="Replay the clip from the start and save an annotated video with voice"><Clapperboard size={15} /> Export annotated clip</button>}
        {live && (snap.recording
          ? <button className="btn btn-danger" onClick={p.onRecord}><Circle size={11} fill="currentColor" className="animate-pulse" /> {snap.exporting ? 'Exporting… stop' : 'Stop & save'}</button>
          : <button className="btn" onClick={p.onRecord} title="Record what's on screen"><Circle size={11} className="text-danger" fill="currentColor" /> Rec</button>)}

        <button className={`btn ${open ? 'btn-on' : ''}`} onClick={() => setOpen((o) => !o)}><SlidersHorizontal size={15} /></button>

        <span className="chip border border-line text-muted" title={snap.preAnalysed ? 'Detections were computed on every 0.1 s frame before playback' : undefined}>
          <span className="dot" style={{ background: !live ? '#5A626C' : snap.source === 'webcam' ? '#E5533D' : '#3FB97A' }} />
          {!live ? 'Standby' : snap.source === 'webcam' ? 'Live camera' : snap.preAnalysed ? 'Recorded · pre-analysed' : 'Recorded · live inference'}
        </span>
      </div>

      <AnimatePresence>
        {open && (
          <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: 10 }}
            className="card absolute bottom-[62px] right-4 z-40 w-[340px] p-4 text-[12.5px] shadow-2xl shadow-black/50">
            <div className="label mb-3 flex items-center gap-2"><Gauge size={13} /> Detection settings</div>
            <Row label="Person detector">
              <div className="seg">
                <button data-on={s.quality === 'fast'} onClick={() => p.set({ quality: 'fast' })}>Fast</button>
                <button data-on={s.quality === 'accurate'} onClick={() => p.set({ quality: 'accurate' })}>Accurate</button>
              </div>
            </Row>
            <Toggle label="Pre-analyse recorded clips" hint="Runs the AI on every 0.1 s frame first, then plays smoothly on any laptop. Applies on next clip load." on={s.preAnalyse} set={(v) => p.set({ preAnalyse: v })} />
            <Toggle label="Small-person boost (tiled)" hint="Extra passes over left/right halves to find distant people. Costs FPS." on={s.crowdBoost} set={(v) => p.set({ crowdBoost: v })} />
            <Toggle label="Single-person mode" hint="Track only the largest person (fallback if IDs are unstable)." on={s.singlePerson} set={(v) => p.set({ singlePerson: v })} />
            <Slider label="Detection confidence" value={s.minScore} min={0.2} max={0.8} step={0.05} fmt={(v) => v.toFixed(2)} set={(v) => p.set({ minScore: v })} />
            <Slider label="Breach confirmation" value={s.breachConfirmMs} min={200} max={2000} step={100} fmt={(v) => `${(v / 1000).toFixed(1)} s`} set={(v) => p.set({ breachConfirmMs: v })} />
            <Slider label="Escalate unresolved after" value={s.unresolvedMs} min={1000} max={10000} step={500} fmt={(v) => `${(v / 1000).toFixed(1)} s`} set={(v) => p.set({ unresolvedMs: v })} />
            <Slider label="Caution band" value={s.warningDistance} min={0.01} max={0.2} step={0.01} fmt={(v) => `${Math.round(v * 100)}% frame`} set={(v) => p.set({ warningDistance: v })} />
          </motion.div>
        )}
      </AnimatePresence>
    </footer>
  )
}

function Row({ label, children }: { label: string; children: React.ReactNode }) {
  return <div className="mb-3 flex items-center justify-between gap-3"><span className="text-ink/90">{label}</span>{children}</div>
}
function Toggle({ label, hint, on, set }: { label: string; hint: string; on: boolean; set: (v: boolean) => void }) {
  return (
    <button onClick={() => set(!on)} className="mb-3 flex w-full items-start justify-between gap-3 text-left">
      <span><span className="block text-ink/90">{label}</span><span className="text-[11px] text-muted">{hint}</span></span>
      <span className={`mt-0.5 flex h-5 w-9 shrink-0 items-center rounded-full p-0.5 transition ${on ? 'bg-cyan' : 'bg-line'}`}><span className={`h-4 w-4 rounded-full bg-white transition ${on ? 'translate-x-4' : ''}`} /></span>
    </button>
  )
}
function Slider({ label, value, min, max, step, fmt, set }: { label: string; value: number; min: number; max: number; step: number; fmt: (v: number) => string; set: (v: number) => void }) {
  return (
    <label className="mb-3 block">
      <div className="mb-1 flex justify-between"><span className="text-ink/90">{label}</span><span className="mono text-cyan">{fmt(value)}</span></div>
      <input type="range" className="w-full" min={min} max={max} step={step} value={value} onChange={(e) => set(+e.target.value)} />
    </label>
  )
}
