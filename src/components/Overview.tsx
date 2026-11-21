import { useEffect, useMemo, useState } from 'react'
import { ArrowRight, Camera, Crosshair, Video } from 'lucide-react'
import { PRESETS } from '../lib/presets'
import type { EnvironmentPreset, Incident } from '../types'
import type { EngineStatus } from '../lib/monitor'
import type { VoiceState } from '../lib/voice'

const ORDER: EnvironmentPreset['id'][] = ['beach', 'beach2', 'metro', 'backwater', 'promenade']

/** Services group cameras by the kind of site they protect. */
const SERVICES = [
  { id: 'beach', title: 'Beach & Water', tagline: 'Shorelines, jetties and backwaters', image: '/media/service-beach.jpg', focus: 'center 80%', // portrait photo: keep the shoreline in frame
    cameras: ['beach', 'beach2', 'backwater', 'promenade'] as EnvironmentPreset['id'][] },
  { id: 'metro', title: 'Metro Platform', tagline: 'Platform edges and yellow lines', image: '/media/service-metro.jpg', focus: 'center 55%',
    cameras: ['metro'] as EnvironmentPreset['id'][] },
] as const
type ServiceId = (typeof SERVICES)[number]['id']

function ServiceCard({ s, active, cameras, open, onClick }: { s: (typeof SERVICES)[number]; active: boolean; cameras: number; open: number; onClick: () => void }) {
  return (
    <button onClick={onClick}
      className={`group relative h-[210px] overflow-hidden rounded-lg border text-left transition-colors ${active ? 'border-accent' : 'border-line hover:border-line-2'}`}>
      <img src={s.image} alt="" style={{ objectPosition: s.focus }} className="absolute inset-0 h-full w-full object-cover transition-transform duration-500 group-hover:scale-[1.03]" />
      <div className="absolute inset-0 bg-gradient-to-t from-black/85 via-black/35 to-black/10" />
      <div className="absolute left-4 top-4 flex gap-2">
        <span className="chip bg-black/60 text-ink">{cameras} camera{cameras === 1 ? '' : 's'}</span>
        {open > 0 && <span className="chip bg-danger text-white">{open} open</span>}
      </div>
      {active && <span className="chip absolute right-4 top-4 bg-accent text-white">Selected</span>}
      <div className="absolute inset-x-4 bottom-4">
        <div className="text-[34px] font-bold leading-[1.05] tracking-tight text-white lg:text-[40px]">{s.title}</div>
        <div className="mt-1 text-[13px] text-white/80">{s.tagline}</div>
      </div>
    </button>
  )
}
const t24 = (ms: number) => new Date(ms).toLocaleTimeString('en-IN', { hour12: false, hour: '2-digit', minute: '2-digit' })

function Kpi({ label, value, sub, tone }: { label: string; value: string; sub: string; tone?: string }) {
  return (
    <div className="card px-4 py-3">
      <div className="label">{label}</div>
      <div className="num mt-1 text-[24px] font-semibold leading-none" style={{ color: tone }}>{value}</div>
      <div className="mt-1.5 text-[11.5px] text-muted">{sub}</div>
    </div>
  )
}

function CameraTile({ p, ok, open, onOpen }: { p: EnvironmentPreset; ok: boolean; open: number; onOpen: () => void }) {
  return (
    <button onClick={onOpen} disabled={!ok} className="card group overflow-hidden text-left transition-colors hover:border-line-2 disabled:opacity-60">
      <div className="relative aspect-video bg-black">
        {ok ? (
          <video src={p.video} muted autoPlay loop playsInline preload="metadata"
            onLoadedMetadata={(e) => { if (p.trim) e.currentTarget.currentTime = p.trim.start }}
            onTimeUpdate={(e) => { if (p.trim && e.currentTarget.currentTime >= p.trim.end) e.currentTarget.currentTime = p.trim.start }}
            className="h-full w-full object-contain" />
        ) : (
          <div className="flex h-full items-center justify-center text-[12px] text-muted">No footage · add {p.video.replace('/videos/', 'public/videos/')}</div>
        )}
        <span className="chip mono absolute left-2 top-2 bg-black/70 text-ink">{p.cameraName.split(' ')[0]}</span>
        <span className="chip absolute right-2 top-2 bg-black/70 text-ink"><span className="dot bg-safe" />Recorded feed</span>
        {open > 0 && <span className="chip absolute bottom-2 left-2 bg-danger text-white">{open} open incident{open > 1 ? 's' : ''}</span>}
      </div>
      <div className="flex items-center gap-3 px-3.5 py-2.5">
        <div className="min-w-0">
          <div className="truncate text-[13px] font-semibold">{p.name}</div>
          <div className="truncate text-[11.5px] text-muted">{p.location} · zone: {p.zoneLabel.toLowerCase()}</div>
        </div>
        <span className="ml-auto flex shrink-0 items-center gap-1 text-[12px] text-muted group-hover:text-ink">Open <ArrowRight size={13} /></span>
      </div>
    </button>
  )
}

export function Overview({ engine, engineNote, voice, incidents, available, onScene, onWebcam, onIncident }: {
  engine: EngineStatus; engineNote: string; voice: VoiceState; incidents: Incident[]; available: Record<string, boolean>
  onScene: (p: EnvironmentPreset) => void; onWebcam: () => void; onIncident: (i: Incident) => void
}) {
  const presets = useMemo(() => ORDER.map((id) => PRESETS.find((p) => p.id === id)!).filter(Boolean), [])
  const [now, setNow] = useState(new Date())
  useEffect(() => { const i = setInterval(() => setNow(new Date()), 1000); return () => clearInterval(i) }, [])

  const [service, setService] = useState<ServiceId>('beach')
  const current = SERVICES.find((x) => x.id === service)!
  const shown = presets.filter((p) => (current.cameras as readonly string[]).includes(p.id))
  const online = presets.filter((p) => available[p.id]).length
  const today = incidents.filter((i) => new Date(i.detectedAt).toDateString() === now.toDateString())
  const open = incidents.filter((i) => (i.status === 'active' || i.status === 'tracking-lost') && !i.acknowledged)
  const warned = today.filter((i) => i.warningIssued).length
  const openFor = (p: EnvironmentPreset) => open.filter((i) => i.cameraLocation.startsWith(p.cameraName)).length

  return (
    <div className="scroll-thin flex-1 overflow-y-auto">
      <header className="sticky top-0 z-10 flex h-[56px] items-center gap-4 border-b border-line bg-bg/95 px-6 backdrop-blur">
        <div>
          <h1 className="text-[15px] font-semibold leading-tight">Overview</h1>
          <div className="text-[11.5px] text-muted">Alappuzha coastal unit · {presets.length} cameras</div>
        </div>
        <div className="ml-auto flex items-center gap-2">
          <span className="chip border border-line text-muted"><span className="dot" style={{ background: engine === 'ready' ? '#3FB97A' : engine === 'error' ? '#E5533D' : '#E0A43A' }} />
            {engine === 'ready' ? 'Vision models ready' : engine === 'error' ? 'Model error' : engineNote || 'Loading models'}</span>
          <span className="chip border border-line text-muted"><span className="dot" style={{ background: voice.backend === 'sarvam' ? '#3FB97A' : '#E0A43A' }} />
            {voice.backend === 'sarvam' ? 'Voice · Sarvam Bulbul' : voice.backend === 'checking' ? 'Voice · checking' : 'Voice · browser fallback'}</span>
          <span className="mono ml-2 text-[13px]">{now.toLocaleTimeString('en-IN', { hour12: false })}</span>
        </div>
      </header>

      <div className="mx-auto max-w-[1400px] space-y-5 p-6">
        <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
          <Kpi label="Cameras online" value={`${online}/${presets.length}`} sub="recorded feeds available" />
          <Kpi label="Open incidents" value={String(open.length)} sub="awaiting acknowledgement" tone={open.length ? '#E5533D' : undefined} />
          <Kpi label="Incidents today" value={String(today.length)} sub={`${warned} with a voice warning issued`} />
          <Kpi label="Acknowledged" value={`${incidents.filter((i) => i.acknowledged).length}/${incidents.length}`} sub="by an operator, all time" />
        </div>

        <section>
          <h2 className="mb-2.5 text-[13px] font-semibold">Services</h2>
          <div className="grid grid-cols-1 gap-3 md:grid-cols-2">
            {SERVICES.map((x) => {
              const ps = presets.filter((p) => (x.cameras as readonly string[]).includes(p.id))
              return <ServiceCard key={x.id} s={x} active={service === x.id} cameras={ps.length}
                open={ps.reduce((n, p) => n + openFor(p), 0)} onClick={() => setService(x.id)} />
            })}
          </div>
        </section>

        <div className="grid grid-cols-1 gap-5 xl:grid-cols-[1fr_340px]">
          <section>
            <div className="mb-2.5 flex items-center justify-between">
              <h2 className="text-[13px] font-semibold">{current.title} · cameras</h2>
              <button className="btn" onClick={onWebcam} disabled={engine !== 'ready'}><Camera size={14} /> Use laptop camera</button>
            </div>
            <div className="grid grid-cols-1 gap-3 md:grid-cols-2">
              {shown.map((p) => <CameraTile key={p.id} p={p} ok={!!available[p.id]} open={openFor(p)} onOpen={() => onScene(p)} />)}
            </div>
          </section>

          <div className="space-y-5">
            <section className="card">
              <div className="card-h"><span className="card-t">Recent incidents</span><span className="text-[11.5px] text-muted">{incidents.length} total</span></div>
              <div className="scroll-thin max-h-[260px] overflow-y-auto">
                {incidents.length === 0 && <p className="px-4 py-6 text-center text-[12px] text-muted">No incidents yet. They open when someone stays inside a zone.</p>}
                {incidents.slice(0, 12).map((i) => (
                  <button key={i.id} onClick={() => onIncident(i)} className="flex w-full items-center gap-3 border-b border-line px-4 py-2 text-left last:border-0 hover:bg-surface-2">
                    <span className="dot shrink-0" style={{ background: i.status === 'active' ? '#E5533D' : i.status === 'tracking-lost' ? '#E0A43A' : '#5A626C' }} />
                    <div className="min-w-0 flex-1">
                      <div className="truncate text-[12.5px]">{i.personSessionId} in {i.zoneLabel.toLowerCase()}</div>
                      <div className="truncate text-[11px] text-muted">{i.cameraLocation.split(' · ')[0]} · {i.acknowledged ? 'acknowledged' : 'not acknowledged'}</div>
                    </div>
                    <span className="mono shrink-0 text-[11px] text-muted">{t24(i.detectedAt)}</span>
                  </button>
                ))}
              </div>
            </section>

            <section className="card overflow-hidden">
              <div className="card-h"><span className="card-t">Zone setup</span><Crosshair size={14} className="text-muted" /></div>
              <div className="flex gap-3 p-3">
                <video src="/media/calibration-grid.mp4" muted autoPlay loop playsInline className="h-[150px] w-[113px] shrink-0 rounded-md object-cover" />
                <div className="flex flex-col text-[12px] leading-relaxed text-muted">
                  <p>Each camera has one restricted area, drawn over its view. A person is flagged when their feet stay inside it for 0.7 s.</p>
                  <p className="mt-2">Zones are saved per camera and can be adjusted live from the camera view.</p>
                  <span className="mt-auto flex items-center gap-1.5 pt-2 text-[11.5px] text-ink"><Video size={13} /> Open a camera, then Calibrate zone</span>
                </div>
              </div>
            </section>
          </div>
        </div>

        <p className="pb-2 text-[11px] text-faint">Research prototype. Not a certified safety system and never contacts emergency services. Voice warnings by Sarvam AI (Bulbul) in English and Malayalam.</p>
      </div>
    </div>
  )
}
