import { useEffect, useRef, useState } from 'react'
import { AnimatePresence, motion } from 'framer-motion'
import { AlertTriangle, Camera, CheckCircle2, FileVideo, Loader2, Pause, Play, Upload, Waves, TrainFront, Sailboat, ShieldAlert } from 'lucide-react'
import type { Monitor, Snapshot } from '../lib/monitor'
import type { EnvironmentPreset, Pt } from '../types'
import type { VoiceState } from '../lib/voice'
import { PRESETS } from '../lib/presets'

const ICON = { beach: Waves, metro: TrainFront, backwater: Sailboat }

interface Props {
  monitor: Monitor
  snap: Snapshot
  voice: VoiceState
  preset: EnvironmentPreset
  available: Record<string, boolean>
  calibrating: boolean
  drawMode: boolean
  onZoneEdited: (pts: Pt[]) => void
  onDrawDone: (pts: Pt[]) => void
  onPickVideo: (p: EnvironmentPreset) => void
  onPickWebcam: () => void
  onOpenFile: (f: File) => void
}

export function Stage(p: Props) {
  const { monitor, snap } = p
  const canvasRef = useRef<HTMLCanvasElement>(null)
  const fileRef = useRef<HTMLInputElement>(null)
  const [draft, setDraft] = useState<Pt[]>([])
  const [dragOver, setDragOver] = useState(false)

  useEffect(() => { if (canvasRef.current) monitor.attach(canvasRef.current) }, [monitor])
  useEffect(() => { monitor.draft = p.drawMode ? draft : undefined }, [draft, p.drawMode, monitor])
  useEffect(() => { if (!p.drawMode) setDraft([]) }, [p.drawMode])

  const toNorm = (e: React.PointerEvent | React.MouseEvent): Pt => {
    const r = canvasRef.current!.getBoundingClientRect()
    return { x: Math.min(1, Math.max(0, (e.clientX - r.left) / r.width)), y: Math.min(1, Math.max(0, (e.clientY - r.top) / r.height)) }
  }

  const onDown = (e: React.PointerEvent) => {
    if (!p.calibrating) return
    const pt = toNorm(e)
    if (p.drawMode) { setDraft((d) => [...d, pt]); return }
    const i = monitor.hitVertex(pt, 18, canvasRef.current!.getBoundingClientRect())
    if (i !== null) { monitor.dragIndex = i; (e.target as Element).setPointerCapture(e.pointerId) }
  }
  const onMove = (e: React.PointerEvent) => {
    if (monitor.dragIndex === null || !monitor.zones[0]) return
    monitor.zones[0].polygonCoordinates[monitor.dragIndex] = toNorm(e)
  }
  const onUp = () => {
    if (monitor.dragIndex !== null && monitor.zones[0]) p.onZoneEdited([...monitor.zones[0].polygonCoordinates])
    monitor.dragIndex = null
  }
  const onDouble = () => { if (p.drawMode && draft.length >= 3) { p.onDrawDone(draft); setDraft([]) } }

  const active = snap.running && snap.sourceState === 'live'
  const breach = snap.breaches > 0
  const speaking = p.voice.speaking

  return (
    <div
      className="relative flex min-h-0 flex-1 items-center justify-center overflow-hidden rounded-2xl border border-line bg-[#040B13] grid-bg"
      onDragOver={(e) => { e.preventDefault(); setDragOver(true) }}
      onDragLeave={() => setDragOver(false)}
      onDrop={(e) => { e.preventDefault(); setDragOver(false); const f = e.dataTransfer.files[0]; if (f?.type.startsWith('video/')) p.onOpenFile(f) }}
    >
      {/* breach glow frame */}
      <motion.div
        className="pointer-events-none absolute inset-0 z-10 rounded-2xl"
        animate={{ boxShadow: breach ? ['inset 0 0 0 2px rgba(255,77,46,.9), inset 0 0 60px rgba(255,46,46,.35)', 'inset 0 0 0 2px rgba(255,77,46,.4), inset 0 0 30px rgba(255,46,46,.15)'] : 'inset 0 0 0 1px rgba(50,215,232,.0)' }}
        transition={breach ? { duration: 0.7, repeat: Infinity, repeatType: 'reverse' } : { duration: 0.3 }}
      />

      <motion.canvas
        ref={canvasRef}
        initial={false}
        animate={{ opacity: active ? 1 : 0, scale: active ? 1 : 0.985 }}
        transition={{ duration: 0.6, ease: [0.2, 0.8, 0.2, 1] }}
        className={`block max-h-full max-w-full ${p.calibrating ? (p.drawMode ? 'cursor-crosshair' : 'cursor-grab') : ''}`}
        style={{ aspectRatio: `${snap.size.w} / ${snap.size.h}` }}
        onPointerDown={onDown} onPointerMove={onMove} onPointerUp={onUp} onDoubleClick={onDouble}
        onContextMenu={(e) => { if (p.drawMode) { e.preventDefault(); onDouble() } }}
      />

      {/* Idle / launcher */}
      <AnimatePresence>
        {!snap.running && (
          <motion.div key="idle" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} className="scroll-thin absolute inset-0 z-20 flex flex-col items-center gap-5 overflow-y-auto p-6 [&>*:first-child]:mt-auto [&>*:last-child]:mb-auto">
            <div className="text-center">
              <div className="label mb-2 text-cyan">Monitoring standby</div>
              <h1 className="font-display text-[28px] font-semibold tracking-tight">Choose a camera feed to begin</h1>
              <p className="mx-auto mt-2 max-w-xl text-[13.5px] text-muted">Every overlay is produced by on-device pose and person detection running on the frames you see. Nothing is scripted.</p>
            </div>
            <div className="grid w-full max-w-4xl grid-cols-2 gap-3 lg:grid-cols-4">
              {PRESETS.map((pr) => {
                const Icon = ICON[pr.id]
                const ok = p.available[pr.id]
                return (
                  <button key={pr.id} onClick={() => p.onPickVideo(pr)} disabled={snap.engine !== 'ready'}
                    className="group panel flex flex-col items-start gap-2 p-4 text-left transition hover:border-cyan/60 hover:shadow-[0_0_30px_rgba(50,215,232,.12)] disabled:opacity-50">
                    <div className="flex w-full items-center justify-between">
                      <span className="grid h-9 w-9 place-items-center rounded-lg bg-cyan/10 text-cyan"><Icon size={18} /></span>
                      <span className={`mono rounded px-1.5 py-0.5 text-[10px] ${ok ? 'bg-safe/15 text-safe' : 'bg-caution/15 text-caution'}`}>{ok ? 'FOOTAGE READY' : 'NO FILE'}</span>
                    </div>
                    <div className="font-semibold">{pr.name}</div>
                    <div className="text-[12px] leading-snug text-muted">{ok ? pr.location : <>Add <span className="mono text-ink">public{pr.video}</span></>}</div>
                  </button>
                )
              })}
              <button onClick={p.onPickWebcam} disabled={snap.engine !== 'ready'}
                className="panel flex flex-col items-start gap-2 p-4 text-left transition hover:border-cyan/60 hover:shadow-[0_0_30px_rgba(50,215,232,.12)] disabled:opacity-50">
                <div className="flex w-full items-center justify-between">
                  <span className="grid h-9 w-9 place-items-center rounded-lg bg-danger/10 text-danger"><Camera size={18} /></span>
                  <span className="mono rounded bg-danger/15 px-1.5 py-0.5 text-[10px] text-danger">LIVE</span>
                </div>
                <div className="font-semibold">Live webcam</div>
                <div className="text-[12px] leading-snug text-muted">Judge walks into the zone in front of the laptop.</div>
              </button>
            </div>
            <button className="btn" onClick={() => fileRef.current?.click()} disabled={snap.engine !== 'ready'}><Upload size={15} /> Open any video file… <span className="text-muted">(or drop it here)</span></button>
            <input ref={fileRef} type="file" accept="video/*" hidden onChange={(e) => { const f = e.target.files?.[0]; if (f) p.onOpenFile(f); e.target.value = '' }} />

            {snap.engine === 'loading' && <div className="flex items-center gap-2 text-[13px] text-cyan"><Loader2 size={15} className="animate-spin" />{snap.engineNote}</div>}
            {snap.engine === 'error' && <div className="flex max-w-xl items-center gap-2 rounded-lg border border-danger/40 bg-danger/10 px-3 py-2 text-[13px] text-[#FF9A85]"><AlertTriangle size={15} />{snap.engineNote} — run <span className="mono">npm run setup</span> and reload.</div>}
            {snap.sourceState === 'error' && <div className="flex max-w-xl items-center gap-2 rounded-lg border border-danger/40 bg-danger/10 px-3 py-2 text-[13px] text-[#FF9A85]"><AlertTriangle size={15} />{snap.sourceNote}</div>}
          </motion.div>
        )}
      </AnimatePresence>

      {snap.running && snap.sourceState === 'starting' && (
        <div className="scanline absolute inset-0 z-20 grid place-items-center">
          <div className="flex items-center gap-2 text-[14px] text-cyan"><Loader2 className="animate-spin" size={16} />{snap.sourceNote || 'Connecting…'}</div>
        </div>
      )}

      {dragOver && <div className="absolute inset-3 z-30 grid place-items-center rounded-xl border-2 border-dashed border-cyan/70 bg-cyan/5 text-cyan"><div className="flex items-center gap-2 font-semibold"><FileVideo /> Drop video to analyse</div></div>}

      {/* Breach banner */}
      <AnimatePresence>
        {active && breach && (
          <motion.div key="breach" initial={{ y: -30, opacity: 0 }} animate={{ y: 0, opacity: 1 }} exit={{ y: -30, opacity: 0 }}
            className="absolute left-1/2 top-16 z-20 flex -translate-x-1/2 items-center gap-2.5 rounded-full border border-danger/60 bg-[#2A0E0B]/90 px-4 py-2 text-[13px] font-semibold text-[#FFB4A6] shadow-[0_0_40px_rgba(255,77,46,.35)]">
            <ShieldAlert size={16} className="text-danger" />
            {snap.breaches} active boundary breach{snap.breaches > 1 ? 'es' : ''}{snap.unresolved ? ` · ${snap.unresolved} unresolved` : ''}
          </motion.div>
        )}
        {active && !breach && snap.log[0]?.kind === 'resolved' && Date.now() - snap.log[0].t < 2500 && (
          <motion.div key="ok" initial={{ y: -30, opacity: 0, scale: 0.9 }} animate={{ y: 0, opacity: 1, scale: 1 }} exit={{ y: -30, opacity: 0 }}
            className="absolute left-1/2 top-16 z-20 flex -translate-x-1/2 items-center gap-2 rounded-full border border-safe/60 bg-[#062019]/90 px-4 py-2 text-[13px] font-semibold text-safe shadow-[0_0_40px_rgba(52,211,153,.3)]">
            <CheckCircle2 size={16} /> Breach cleared · {snap.log[0].personId} back in safe area
          </motion.div>
        )}
      </AnimatePresence>

      {/* Voice pulse */}
      <AnimatePresence>
        {speaking && (
          <motion.div key="voice" initial={{ opacity: 0, x: 20 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0, x: 20 }}
            className="absolute right-4 top-16 z-20 flex items-center gap-2 rounded-lg border border-cyan/40 bg-bg/85 px-3 py-2 text-[12px]">
            <span className="flex h-4 items-end gap-[2px]">{[0, 1, 2, 3].map((i) => (
              <motion.span key={i} className="w-[3px] rounded bg-cyan" animate={{ height: [4, 14, 6, 12, 4] }} transition={{ duration: 0.9, repeat: Infinity, delay: i * 0.12 }} />
            ))}</span>
            <span className="font-semibold text-cyan">{speaking.source === 'sarvam' ? 'Sarvam voice' : 'Fallback voice'}</span>
            <span className="text-muted">→ {speaking.personIds.join(', ')}</span>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Calibration helper */}
      {p.calibrating && active && (
        <div className="absolute bottom-4 left-1/2 z-20 -translate-x-1/2 rounded-lg border border-cyan/40 bg-bg/90 px-4 py-2 text-[12.5px] text-ink">
          {p.drawMode
            ? <>Click to place points · <b>double-click</b> or right-click to close ({draft.length} pts)</>
            : <>Drag the cyan handles to fit the hazardous area · playback keeps running</>}
        </div>
      )}

      {/* Playback scrubber (recorded footage only) */}
      {active && snap.source === 'video' && !p.calibrating && (
        <div className="absolute bottom-3 left-3 right-3 z-20 flex items-center gap-3 rounded-lg bg-bg/70 px-3 py-1.5 opacity-0 transition hover:opacity-100">
          <button onClick={() => monitor.togglePause()} className="text-ink">{snap.paused ? <Play size={16} /> : <Pause size={16} />}</button>
          <input type="range" min={0} max={snap.videoDuration || 1} step={0.1} value={snap.videoTime} onChange={(e) => monitor.seek(+e.target.value)} className="flex-1" />
          <span className="mono text-[11px] text-muted">{fmt(snap.videoTime)} / {fmt(snap.videoDuration)}</span>
        </div>
      )}
    </div>
  )
}

const fmt = (s: number) => `${Math.floor(s / 60)}:${String(Math.floor(s % 60)).padStart(2, '0')}`
