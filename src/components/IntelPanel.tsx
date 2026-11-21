import { AnimatePresence, motion } from 'framer-motion'
import { AlertTriangle, ChevronRight } from 'lucide-react'
import type { Snapshot } from '../lib/monitor'
import type { Incident } from '../types'
import { COLOR_SWATCH } from '../lib/presets'
import { STATE_COLOR } from '../lib/render'

const STATUS: Record<Incident['status'], [string, string]> = {
  active: ['Active', '#E5533D'],
  'person-returned': ['Person returned', '#3FB97A'],
  'tracking-lost': ['Tracking lost', '#E0A43A'],
  resolved: ['Resolved', '#8A939E'],
  dismissed: ['Dismissed', '#5A626C'],
}
const STATE_LABEL: Record<string, string> = { safe: 'Safe', caution: 'Near edge', breach: 'In zone', unresolved: 'Unresolved', resolved: 'Cleared' }
const t24 = (ms: number) => new Date(ms).toLocaleTimeString('en-IN', { hour12: false })

function Stat({ k, v, tone }: { k: string; v: number; tone?: string }) {
  return (
    <div className="px-3 py-2.5">
      <div className="label">{k}</div>
      <div className="num mt-0.5 text-[22px] font-semibold leading-none" style={{ color: v && tone ? tone : undefined }}>{v}</div>
    </div>
  )
}

function Card({ title, right, children, className = '' }: { title: string; right?: React.ReactNode; children: React.ReactNode; className?: string }) {
  return (
    <section className={`card ${className}`}>
      <div className="card-h !py-2"><span className="card-t">{title}</span>{right}</div>
      {children}
    </section>
  )
}

export function IntelPanel({ snap, incidents, onOpen, onClear }: { snap: Snapshot; incidents: Incident[]; onOpen: (i: Incident) => void; onClear: () => void }) {
  const priority = incidents.find((i) => i.status === 'active' && !i.acknowledged) ?? incidents.find((i) => i.status === 'tracking-lost' && !i.acknowledged)
  const inZone = snap.tracks.find((t) => !t.lost && (t.state === 'unresolved' || t.state === 'breach'))
  const acked = incidents.filter((i) => i.acknowledged).length
  const rank = (s: string, lost: boolean) => (lost ? 0 : { unresolved: 5, breach: 4, caution: 3, resolved: 2, safe: 1 }[s] ?? 0)

  return (
    <aside className="scroll-thin flex w-[320px] shrink-0 flex-col gap-3 overflow-y-auto border-l border-line p-3 2xl:w-[360px]">
      <section className="card grid grid-cols-4 divide-x divide-line">
        <Stat k="In view" v={snap.people} />
        <Stat k="Near" v={snap.near} tone="#E0A43A" />
        <Stat k="In zone" v={snap.breaches} tone="#E5533D" />
        <Stat k="Open" v={snap.unresolved} tone="#E5533D" />
      </section>

      <AnimatePresence mode="wait">
        {priority ? (
          <motion.button key={priority.id} initial={{ opacity: 0, y: 4 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0 }} onClick={() => onOpen(priority)}
            className="card flex w-full gap-3 border-danger/50 bg-[color-mix(in_srgb,#E5533D_7%,#121519)] p-3 text-left hover:border-danger">
            <AlertTriangle size={16} className="mt-0.5 shrink-0 text-danger" />
            <div className="min-w-0">
              <div className="text-[12.5px] font-semibold">{priority.status === 'tracking-lost' ? 'Tracking lost inside zone' : 'Unresolved boundary breach'}</div>
              <div className="mt-0.5 text-[12px] leading-snug text-muted">{priority.description}</div>
              <div className="mt-1.5 flex items-center gap-1 text-[11.5px] text-[#F08A79]">Review incident <ChevronRight size={13} /></div>
            </div>
          </motion.button>
        ) : inZone ? (
          <motion.div key="z" initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="card border-caution/40 p-3 text-[12px] text-ink">
            <span className="font-semibold">{inZone.id}</span> is inside the zone. Warning issued; escalates if they stay.
          </motion.div>
        ) : null}
      </AnimatePresence>

      <Card title="People" right={<span className="text-[11.5px] text-muted">{snap.tracks.length}</span>}>
        <div className="scroll-thin max-h-[150px] overflow-y-auto">
          {snap.tracks.length === 0 && <p className="px-3.5 py-3 text-[12px] text-muted">{snap.running ? 'No one detected.' : 'Feed not running.'}</p>}
          {[...snap.tracks].sort((a, b) => rank(b.state, b.lost) - rank(a.state, a.lost)).map((t) => (
            <div key={t.id} className="flex items-center gap-2.5 border-b border-line px-3.5 py-1.5 text-[12px] last:border-0">
              <span className="mono w-[46px] text-[11.5px]">{t.id}</span>
              <span className="flex w-[74px] items-center gap-1.5 text-muted">
                {t.color !== 'unknown' && <span className="h-2.5 w-2.5 rounded-sm border border-white/20" style={{ background: COLOR_SWATCH[t.color as keyof typeof COLOR_SWATCH] }} />}
                {t.color === 'unknown' ? '—' : t.color}
              </span>
              <span className="ml-auto flex items-center gap-1.5 text-[11.5px]" style={{ color: t.lost ? '#8A939E' : STATE_COLOR[t.state] }}>
                <span className="dot" style={{ background: t.lost ? '#5A626C' : STATE_COLOR[t.state] }} />{t.lost ? 'Tracking lost' : STATE_LABEL[t.state]}
              </span>
            </div>
          ))}
        </div>
      </Card>

      <Card title="Incidents" className="flex min-h-[150px] flex-1 flex-col"
        right={incidents.length > 0 && <button onClick={onClear} className="text-[11.5px] text-muted hover:text-ink">Clear</button>}>
        <div className="scroll-thin min-h-0 flex-1 overflow-y-auto">
          {incidents.length === 0 && <p className="px-3.5 py-3 text-[12px] text-muted">Opened when someone stays inside the zone.</p>}
          <AnimatePresence initial={false}>
            {incidents.slice(0, 30).map((i) => (
              <motion.button layout key={i.id} initial={{ opacity: 0, y: -4 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0 }}
                onClick={() => onOpen(i)} className="flex w-full items-center gap-2.5 border-b border-line px-3.5 py-2 text-left last:border-0 hover:bg-surface-2">
                <span className="dot shrink-0" style={{ background: STATUS[i.status][1] }} />
                <div className="min-w-0 flex-1">
                  <div className="truncate text-[12px]">{i.personSessionId}{i.clothing !== 'unknown' ? ` · ${i.clothing}` : ''} · {STATUS[i.status][0]}</div>
                  <div className="text-[11px] text-muted">{i.acknowledged ? 'Acknowledged' : 'Not acknowledged'}</div>
                </div>
                <span className="mono text-[11px] text-muted">{t24(i.detectedAt)}</span>
              </motion.button>
            ))}
          </AnimatePresence>
        </div>
      </Card>

      <Card title="Activity">
        <div className="scroll-thin max-h-[130px] overflow-y-auto px-3.5 py-2">
          {snap.log.length === 0 && <p className="text-[12px] text-muted">No events yet.</p>}
          {snap.log.slice(0, 14).map((l) => (
            <div key={l.id} className="flex gap-2 py-0.5 text-[11.5px] leading-snug">
              <span className="mono shrink-0 text-muted">{t24(l.t)}</span>
              <span className="text-ink/85">{l.text}</span>
            </div>
          ))}
        </div>
      </Card>

      <section className="card grid grid-cols-2 gap-x-3 gap-y-1 px-3.5 py-2.5 text-[11.5px] text-muted">
        <span>{snap.preAnalysed ? 'Detections' : 'Inference FPS'}</span><span className="num text-right text-ink">{!snap.running ? '—' : snap.preAnalysed ? 'pre-analysed' : snap.fps.toFixed(1)}</span>
        <span title="Feet inside zone until warning audio starts (includes the confirmation delay)">Alert latency</span><span className="num text-right text-ink">{snap.lastLatencyMs !== null ? `${(snap.lastLatencyMs / 1000).toFixed(2)} s` : '—'}</span>
        <span>Boundary events</span><span className="num text-right text-ink">{snap.boundaryEvents}</span>
        <span>Warnings spoken</span><span className="num text-right text-ink">{snap.warningsIssued}</span>
        <span>Acknowledged</span><span className="num text-right text-ink">{acked}/{incidents.length}</span>
      </section>
    </aside>
  )
}
