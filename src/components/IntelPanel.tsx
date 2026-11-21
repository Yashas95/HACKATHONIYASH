import { AnimatePresence, motion } from 'framer-motion'
import { Activity, AlertOctagon, CheckCircle2, ChevronRight, EyeOff, Footprints, Gauge, Megaphone, ShieldAlert, Timer, Trash2, Users } from 'lucide-react'
import type { Snapshot } from '../lib/monitor'
import type { Incident } from '../types'
import { COLOR_SWATCH } from '../lib/presets'
import { STATE_COLOR } from '../lib/render'

function Stat({ label, value, tone, icon }: { label: string; value: number; tone: string; icon: React.ReactNode }) {
  return (
    <div className="panel relative overflow-hidden px-3 py-2.5">
      <div className="flex items-center justify-between"><span className="label !text-[9.5px]">{label}</span><span style={{ color: tone }}>{icon}</span></div>
      <motion.div key={value} initial={{ y: 6, opacity: 0.4 }} animate={{ y: 0, opacity: 1 }} className="mono mt-1 text-[26px] font-semibold leading-none" style={{ color: value ? tone : undefined }}>{value}</motion.div>
    </div>
  )
}

const STATUS_STYLE: Record<Incident['status'], [string, string]> = {
  active: ['ACTIVE', 'bg-danger/15 text-[#FF8A73] border-danger/40'],
  'person-returned': ['PERSON RETURNED', 'bg-safe/10 text-safe border-safe/30'],
  'tracking-lost': ['TRACKING LOST', 'bg-caution/10 text-caution border-caution/30'],
  resolved: ['RESOLVED', 'bg-cyan/10 text-cyan border-cyan/30'],
  dismissed: ['DISMISSED', 'bg-surface text-muted border-line'],
}

export function IntelPanel({ snap, incidents, onOpen, onClear }: { snap: Snapshot; incidents: Incident[]; onOpen: (i: Incident) => void; onClear: () => void }) {
  const priority = incidents.find((i) => i.status === 'active' && !i.acknowledged) ?? incidents.find((i) => i.status === 'tracking-lost' && !i.acknowledged)
  const breachTrack = snap.tracks.find((t) => !t.lost && (t.state === 'unresolved' || t.state === 'breach'))
  const acked = incidents.filter((i) => i.acknowledged).length

  return (
    <aside className="scroll-thin flex w-[340px] shrink-0 flex-col gap-3 overflow-y-auto pb-1 2xl:w-[380px]">
      <div className="grid grid-cols-2 gap-2">
        <Stat label="People in view" value={snap.people} tone="#32D7E8" icon={<Users size={14} />} />
        <Stat label="Near boundary" value={snap.near} tone="#F5B83D" icon={<Footprints size={14} />} />
        <Stat label="Active breaches" value={snap.breaches} tone="#FF4D2E" icon={<ShieldAlert size={14} />} />
        <Stat label="Unresolved" value={snap.unresolved} tone="#FF2E4D" icon={<AlertOctagon size={14} />} />
      </div>

      {/* Highest priority */}
      <div className="panel p-3">
        <div className="label mb-2">Highest-priority alert</div>
        <AnimatePresence mode="wait">
          {priority ? (
            <motion.button key={priority.id} initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0 }} onClick={() => onOpen(priority)}
              className="w-full rounded-lg border border-danger/50 bg-danger/10 p-3 text-left shadow-[0_0_30px_rgba(255,77,46,.15)] transition hover:bg-danger/15">
              <div className="flex items-center gap-2 text-[13px] font-semibold text-[#FFB4A6]"><AlertOctagon size={15} className="text-danger" />{priority.status === 'tracking-lost' ? 'Tracking lost inside zone' : 'Unresolved boundary breach'}<ChevronRight size={15} className="ml-auto" /></div>
              <div className="mt-1.5 text-[12px] leading-snug text-ink/80">{priority.description}</div>
              <div className="mono mt-2 text-[11px] text-muted">{priority.id} · {new Date(priority.detectedAt).toLocaleTimeString('en-IN', { hour12: false })} · awaiting acknowledgement</div>
            </motion.button>
          ) : breachTrack ? (
            <motion.div key="b" initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="rounded-lg border border-caution/40 bg-caution/10 p-3 text-[12.5px] text-caution">
              {breachTrack.id} inside restricted zone — warning issued, monitoring for escalation.
            </motion.div>
          ) : (
            <motion.div key="none" initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="flex items-center gap-2 rounded-lg border border-line bg-bg/40 p-3 text-[12.5px] text-muted">
              <CheckCircle2 size={15} className="text-safe" /> No open alerts
            </motion.div>
          )}
        </AnimatePresence>
      </div>

      {/* Tracked people */}
      <div className="panel p-3">
        <div className="mb-2 flex items-center justify-between"><span className="label">Tracked people</span><span className="mono text-[11px] text-muted">{snap.tracks.length}</span></div>
        <div className="flex max-h-[132px] flex-col gap-1 overflow-y-auto scroll-thin">
          {snap.tracks.length === 0 && <div className="text-[12px] text-muted">{snap.running ? 'No people detected in frame.' : 'Start monitoring to track people.'}</div>}
          {[...snap.tracks].sort((a, b) => rank(b.state, b.lost) - rank(a.state, a.lost)).map((t) => (
            <div key={t.id} className="flex items-center gap-2 rounded-md bg-bg/40 px-2 py-1 text-[12px]">
              <span className="h-2 w-2 rounded-full" style={{ background: t.lost ? '#64748B' : STATE_COLOR[t.state], boxShadow: `0 0 8px ${t.lost ? 'transparent' : STATE_COLOR[t.state]}` }} />
              <span className="mono font-semibold">{t.id}</span>
              {t.color !== 'unknown' && <span className="flex items-center gap-1 text-muted"><span className="h-2.5 w-2.5 rounded-sm border border-white/40" style={{ background: COLOR_SWATCH[t.color as keyof typeof COLOR_SWATCH] }} />{t.color}</span>}
              <span className="ml-auto mono text-[10.5px] uppercase" style={{ color: t.lost ? '#94A3B8' : STATE_COLOR[t.state] }}>{t.lost ? 'tracking lost' : t.state}</span>
            </div>
          ))}
        </div>
      </div>

      {/* Metrics — measured values only */}
      <div className="panel grid grid-cols-2 gap-x-3 gap-y-2 p-3 text-[12px]">
        <div className="label col-span-2">Measured performance</div>
        <Metric icon={<Gauge size={13} />} label={snap.preAnalysed ? 'Analysis FPS' : 'Inference FPS'} value={snap.running ? snap.fps.toFixed(1) : '—'} />
        <Metric icon={<Timer size={13} />} label="Alert latency" value={snap.lastLatencyMs !== null ? `${(snap.lastLatencyMs / 1000).toFixed(2)} s` : '—'} title="From feet first inside the zone to warning audio starting (includes the confirmation delay)" />
        <Metric icon={<Activity size={13} />} label="Boundary events" value={String(snap.boundaryEvents)} />
        <Metric icon={<Megaphone size={13} />} label="Warnings spoken" value={String(snap.warningsIssued)} />
        <Metric icon={<CheckCircle2 size={13} />} label="Acknowledged" value={String(acked)} />
        <Metric icon={<ShieldAlert size={13} />} label="Incidents" value={String(incidents.length)} />
      </div>

      {/* Incidents */}
      <div className="panel flex min-h-[150px] flex-1 flex-col p-3">
        <div className="mb-2 flex items-center justify-between">
          <span className="label">Incidents</span>
          {incidents.length > 0 && <button onClick={onClear} className="flex items-center gap-1 text-[11px] text-muted hover:text-ink"><Trash2 size={12} /> Clear</button>}
        </div>
        <div className="scroll-thin flex flex-col gap-1.5 overflow-y-auto">
          {incidents.length === 0 && <div className="text-[12px] text-muted">Incidents are created when a breach stays unresolved.</div>}
          <AnimatePresence initial={false}>
            {incidents.slice(0, 30).map((i) => (
              <motion.button layout key={i.id} initial={{ opacity: 0, x: 24, scale: 0.97 }} animate={{ opacity: 1, x: 0, scale: 1 }} exit={{ opacity: 0 }} transition={{ type: 'spring', stiffness: 380, damping: 30 }}
                onClick={() => onOpen(i)} className="rounded-lg border border-line bg-bg/40 p-2 text-left transition hover:border-cyan/40">
                <div className="flex items-center gap-2">
                  <span className="mono text-[11.5px] font-semibold">{i.personSessionId}</span>
                  {i.clothing !== 'unknown' && <span className="h-2.5 w-2.5 rounded-sm border border-white/40" style={{ background: COLOR_SWATCH[i.clothing] }} />}
                  <span className={`mono ml-auto rounded border px-1.5 py-[1px] text-[9.5px] ${STATUS_STYLE[i.status][1]}`}>{STATUS_STYLE[i.status][0]}</span>
                </div>
                <div className="mt-1 flex items-center gap-2 text-[11px] text-muted">
                  <span className="mono">{new Date(i.detectedAt).toLocaleTimeString('en-IN', { hour12: false })}</span>·<span className="truncate">{i.zoneLabel}</span>
                  {i.acknowledged ? <span className="ml-auto text-safe">✓ ack</span> : <span className="ml-auto text-caution">unacknowledged</span>}
                </div>
              </motion.button>
            ))}
          </AnimatePresence>
        </div>
      </div>

      {/* Event log */}
      <div className="panel p-3">
        <div className="label mb-2">Event stream</div>
        <div className="scroll-thin flex max-h-[120px] flex-col gap-1 overflow-y-auto text-[11.5px]">
          {snap.log.length === 0 && <div className="text-muted">Waiting for events…</div>}
          {snap.log.slice(0, 14).map((l) => (
            <div key={l.id} className="flex gap-2">
              <span className="mono shrink-0 text-muted">{new Date(l.t).toLocaleTimeString('en-IN', { hour12: false })}</span>
              <span className="shrink-0">{l.kind === 'breach' ? <ShieldAlert size={12} className="mt-[2px] text-danger" /> : l.kind === 'resolved' ? <CheckCircle2 size={12} className="mt-[2px] text-safe" /> : l.kind === 'lost' ? <EyeOff size={12} className="mt-[2px] text-caution" /> : l.kind === 'warning' ? <Megaphone size={12} className="mt-[2px] text-cyan" /> : <AlertOctagon size={12} className="mt-[2px] text-danger" />}</span>
              <span className="text-ink/80">{l.text}</span>
            </div>
          ))}
        </div>
      </div>
    </aside>
  )
}

const rank = (s: string, lost: boolean) => (lost ? 0 : { unresolved: 5, breach: 4, caution: 3, resolved: 2, safe: 1 }[s] ?? 0)

function Metric({ icon, label, value, title }: { icon: React.ReactNode; label: string; value: string; title?: string }) {
  return (
    <div className="flex items-center gap-2" title={title}>
      <span className="text-muted">{icon}</span>
      <span className="text-muted">{label}</span>
      <span className="mono ml-auto font-semibold">{value}</span>
    </div>
  )
}
