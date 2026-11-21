import { useEffect, useRef, useState } from 'react'
import { AnimatePresence, motion } from 'framer-motion'
import { AlertTriangle, Camera, CheckCircle2, FileVideo, Loader2, Pause, Play, Upload, Waves, TrainFront, Sailboat, TreePalm, ShieldAlert, Volume2 } from 'lucide-react'
import type { Monitor, Snapshot } from '../lib/monitor'
import type { EnvironmentPreset, Pt } from '../types'
import type { VoiceState } from '../lib/voice'
import { PRESETS } from '../lib/presets'

const ICON = { beach: Waves, beach2: Waves, metro: TrainFront, backwater: Sailboat, promenade: TreePalm }

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
  const progress = /(\d+)%/.exec(snap.sourceNote)?.[1] ?? null

  return (
    <div
      className="relative flex min-h-0 flex-1 flex-col bg-[#07090B]"
      onDragOver={(e) => { e.preventDefault(); setDragOver(true) }}
      onDragLeave={() => setDragOver(false)}
      onDrop={(e) => { e.preventDefault(); setDragOver(false); const f = e.dataTransfer.files[0]; if (f?.type.startsWith('video/')) p.onOpenFile(f) }}
    >
      {/* Alert bar: a plain status strip across the top of the view. */}
      <AnimatePresence>
        {active && breach ? (
          <motion.div key="breach" initial={{ height: 0 }} animate={{ height: 32 }} exit={{ height: 0 }}
            className="flex shrink-0 items-center gap-2 overflow-hidden bg-danger px-4 text-[12.5px] font-medium text-white">
            <ShieldAlert size={14} />
            {snap.breaches} {snap.breaches > 1 ? 'people' : 'person'} inside the restricted zone{snap.unresolved ? ` · ${snap.unresolved} unresolved, escalated to operator` : ' · warning issued'}
          </motion.div>
        ) : active && snap.log[0]?.kind === 'resolved' && Date.now() - snap.log[0].t < 2500 ? (
          <motion.div key="ok" initial={{ height: 0 }} animate={{ height: 32 }} exit={{ height: 0 }}
            className="flex shrink-0 items-center gap-2 overflow-hidden bg-safe/90 px-4 text-[12.5px] font-medium text-[#04140B]">
            <CheckCircle2 size={14} /> {snap.log[0].personId} returned to the safe area. Breach cleared.
          </motion.div>
        ) : null}
      </AnimatePresence>

      <div className="relative flex min-h-0 flex-1 items-center justify-center overflow-hidden p-3">
        <motion.canvas
          ref={canvasRef}
          initial={false}
          animate={{ opacity: active ? 1 : 0 }}
          transition={{ duration: 0.4 }}
          className={`block max-h-full max-w-full rounded-[4px] ${p.calibrating ? (p.drawMode ? 'cursor-crosshair' : 'cursor-grab') : ''}`}
          style={{ aspectRatio: `${snap.size.w} / ${snap.size.h}` }}
          onPointerDown={onDown} onPointerMove={onMove} onPointerUp={onUp} onDoubleClick={onDouble}
          onContextMenu={(e) => { if (p.drawMode) { e.preventDefault(); onDouble() } }}
        />

        {/* Idle: compact feed picker */}
        {!snap.running && (
          <div className="scroll-thin absolute inset-0 z-20 overflow-y-auto p-6">
            <div className="mx-auto mt-[8vh] max-w-[560px]">
              <h2 className="text-[15px] font-semibold">No feed selected</h2>
              <p className="mt-1 text-[12.5px] text-muted">Pick a camera. Detection runs on-device on the frames shown.</p>
              <div className="card mt-4 overflow-hidden">
                {PRESETS.map((pr) => {
                  const Icon = ICON[pr.id]
                  const ok = p.available[pr.id]
                  return (
                    <button key={pr.id} onClick={() => p.onPickVideo(pr)} disabled={snap.engine !== 'ready' || !ok}
                      className="flex w-full items-center gap-3 border-b border-line px-4 py-2.5 text-left last:border-0 hover:bg-surface-2 disabled:opacity-50">
                      <Icon size={15} className="text-muted" />
                      <span className="text-[13px] font-medium">{pr.name}</span>
                      <span className="mono text-[11px] text-muted">{pr.cameraName.split(' ')[0]}</span>
                      <span className="ml-auto text-[11.5px] text-muted">{ok ? pr.location.split(' · ')[0] : `missing public${pr.video}`}</span>
                    </button>
                  )
                })}
                <button onClick={p.onPickWebcam} disabled={snap.engine !== 'ready'}
                  className="flex w-full items-center gap-3 px-4 py-2.5 text-left hover:bg-surface-2 disabled:opacity-50">
                  <Camera size={15} className="text-muted" />
                  <span className="text-[13px] font-medium">Laptop camera</span>
                  <span className="ml-auto text-[11.5px] text-muted">live</span>
                </button>
              </div>
              <button className="btn mt-3" onClick={() => fileRef.current?.click()} disabled={snap.engine !== 'ready'}><Upload size={14} /> Open video file</button>
              <span className="ml-2 text-[11.5px] text-muted">or drop one here</span>
              <input ref={fileRef} type="file" accept="video/*" hidden onChange={(e) => { const f = e.target.files?.[0]; if (f) p.onOpenFile(f); e.target.value = '' }} />

              {snap.engine === 'loading' && <p className="mt-4 flex items-center gap-2 text-[12.5px] text-muted"><Loader2 size={14} className="animate-spin" />{snap.engineNote}</p>}
              {snap.engine === 'error' && <p className="mt-4 flex items-center gap-2 text-[12.5px] text-danger"><AlertTriangle size={14} />{snap.engineNote}. Run <span className="mono">npm run setup</span> and reload.</p>}
              {snap.sourceState === 'error' && <p className="mt-4 flex items-center gap-2 text-[12.5px] text-danger"><AlertTriangle size={14} />{snap.sourceNote}</p>}
            </div>
          </div>
        )}

        {snap.running && snap.sourceState === 'starting' && (
          <div className="absolute inset-0 z-20 grid place-items-center bg-[#07090B]">
            <div className="w-[300px]">
              <div className="flex items-center gap-2 text-[12.5px]"><Loader2 className="animate-spin text-muted" size={14} />{snap.sourceNote || 'Connecting…'}</div>
              {progress !== null && (
                <div className="mt-2 h-1 overflow-hidden rounded bg-line">
                  <div className="h-full bg-accent transition-[width]" style={{ width: `${progress}%` }} />
                </div>
              )}
            </div>
          </div>
        )}

        {dragOver && <div className="absolute inset-3 z-30 grid place-items-center rounded-md border border-dashed border-accent bg-accent/5 text-[13px] text-ink"><div className="flex items-center gap-2"><FileVideo size={16} /> Drop video to analyse</div></div>}

        {speaking && (
          <div className="absolute right-5 top-5 z-20 flex items-center gap-2 rounded-md border border-line-2 bg-bg/90 px-2.5 py-1.5 text-[11.5px]">
            <Volume2 size={13} className="text-accent" />
            <span>{speaking.source === 'sarvam' ? 'Sarvam voice' : 'Browser voice'}</span>
            <span className="text-muted">to {speaking.personIds.join(', ')}</span>
          </div>
        )}

        {p.calibrating && active && (
          <div className="absolute bottom-5 left-1/2 z-20 -translate-x-1/2 rounded-md border border-line-2 bg-bg/95 px-3 py-1.5 text-[12px]">
            {p.drawMode
              ? <>Click to place points. Double-click or right-click to close ({draft.length} points).</>
              : <>Drag the handles to fit the restricted area. Changes save automatically.</>}
          </div>
        )}
      </div>

      {/* Transport bar for recorded footage */}
      {active && snap.source === 'video' && (
        <div className="flex h-[34px] shrink-0 items-center gap-3 border-t border-line px-4">
          <button onClick={() => monitor.togglePause()} className="text-muted hover:text-ink" title="Play / pause (Space)">{snap.paused ? <Play size={14} /> : <Pause size={14} />}</button>
          <input type="range" min={0} max={snap.videoDuration || 1} step={0.1} value={snap.videoTime} onChange={(e) => monitor.seek(+e.target.value)} className="flex-1" />
          <span className="mono text-[11px] text-muted">{fmt(snap.videoTime)} / {fmt(snap.videoDuration)}</span>
        </div>
      )}
    </div>
  )
}

const fmt = (s: number) => `${Math.floor(s / 60)}:${String(Math.floor(s % 60)).padStart(2, '0')}`
