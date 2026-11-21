import { useState } from 'react'
import { motion } from 'framer-motion'
import { AlertOctagon, Check, CheckCheck, Copy, Radio, ShieldCheck, X, XCircle } from 'lucide-react'
import type { Incident } from '../types'
import { incidentStore } from '../lib/incidents'
import { COLOR_SWATCH } from '../lib/presets'

const t = (ms: number) => new Date(ms).toLocaleTimeString('en-IN', { hour12: false })

export function IncidentModal({ incident, onClose }: { incident: Incident; onClose: () => void }) {
  const [sos, setSos] = useState(false)
  const [copied, setCopied] = useState(false)
  const i = incident
  const durEnd = i.resolvedAt ?? Date.now()

  const dispatch = [
    'SIMULATED SOS PREVIEW — NOT SENT',
    `Location: ${i.cameraLocation}`,
    `Time: ${new Date(i.detectedAt).toLocaleString('en-IN', { hour12: false })} IST`,
    `Observation: Boundary breach of "${i.zoneLabel}" by tracked person ${i.personSessionId}${i.clothing !== 'unknown' ? ` (approx. ${i.clothing} upper clothing)` : ''}.`,
    `Breach unresolved for ${Math.round((durEnd - i.breachStartedAt) / 1000)} s. Voice warning ${i.warningIssued ? 'issued' : 'not issued'}.`,
    `Current status: ${i.status.replace('-', ' ')}.`,
    'Requested: lifeguard visual check of the area.',
  ].join('\n')

  return (
    <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} className="fixed inset-0 z-50 grid place-items-center bg-black/60 p-4" onClick={onClose}>
      <motion.div initial={{ y: 20, scale: 0.97 }} animate={{ y: 0, scale: 1 }} exit={{ y: 20, opacity: 0 }} transition={{ type: 'spring', stiffness: 320, damping: 28 }}
        className="card w-full max-w-[620px] overflow-hidden shadow-2xl shadow-black/60" onClick={(e) => e.stopPropagation()}>
        <div className="flex items-center gap-3 border-b border-line px-5 py-4">
          <AlertOctagon size={18} className="text-danger" />
          <div>
            <div className="text-[14px] font-semibold">Unresolved boundary breach</div>
            <div className="mono text-[11.5px] text-muted">{i.id} · {i.cameraLocation}</div>
          </div>
          <button onClick={onClose} className="ml-auto text-muted hover:text-ink"><X size={18} /></button>
        </div>

        {!sos ? (
          <div className="grid gap-4 p-5 sm:grid-cols-[1fr_210px]">
            <div>
              <div className="label mb-1">Summary</div>
              <p className="text-[13.5px] leading-relaxed">{i.description}</p>
              <div className="label mb-2 mt-4">Timeline</div>
              <ol className="relative ml-1 border-l border-line pl-4">
                {i.timeline.map((e, k) => (
                  <li key={k} className="mb-2.5 text-[12.5px]">
                    <span className="absolute -left-[4.5px] mt-1.5 h-2 w-2 rounded-full bg-line-2" />
                    <span className="mono mr-2 text-muted">{t(e.t)}</span>{e.text}
                  </li>
                ))}
              </ol>
            </div>
            <div className="flex flex-col gap-2 text-[12.5px]">
              <Field k="Person" v={<span className="mono">{i.personSessionId}</span>} />
              <Field k="Clothing" v={i.clothing === 'unknown' ? <span className="text-muted">Not determined</span> : <span className="flex items-center gap-1.5"><span className="h-3 w-3 rounded-sm border border-white/40" style={{ background: COLOR_SWATCH[i.clothing] }} />approx. {i.clothing}</span>} />
              <Field k="Zone" v={i.zoneLabel} />
              <Field k="Detected" v={<span className="mono">{t(i.detectedAt)}</span>} />
              <Field k="Warning" v={i.warningIssued ? <span className="text-safe">Issued</span> : <span className="text-caution">Not issued</span>} />
              <Field k="Status" v={<span className="uppercase">{i.status.replace('-', ' ')}</span>} />
              <Field k="Acknowledged" v={i.acknowledged ? <span className="text-safe">Yes · {t(i.acknowledgedAt!)}</span> : <span className="text-caution">No</span>} />
            </div>
          </div>
        ) : (
          <div className="p-5">
            <div className="mb-3 flex items-center gap-2 rounded-md border border-caution/40 px-3 py-2 text-[12.5px] text-caution">
              <Radio size={15} /> Simulation only. EdgeGuard never contacts emergency services. The operator decides and calls through official channels.
            </div>
            <pre className="mono whitespace-pre-wrap rounded-md border border-line bg-bg p-4 text-[12px] leading-relaxed text-ink/90">{dispatch}</pre>
            <button className="btn mt-3" onClick={() => { void navigator.clipboard?.writeText(dispatch); setCopied(true) }}><Copy size={14} /> {copied ? 'Copied' : 'Copy message'}</button>
          </div>
        )}

        <div className="flex flex-wrap items-center gap-2 border-t border-line px-5 py-3">
          {!i.acknowledged && <button className="btn btn-primary" onClick={() => incidentStore.update(i.id, { acknowledged: true, acknowledgedAt: Date.now() }, 'Acknowledged by operator')}><Check size={15} /> Acknowledge</button>}
          {i.status !== 'resolved' && i.status !== 'dismissed' && <button className="btn" onClick={() => incidentStore.update(i.id, { status: 'resolved', resolvedAt: i.resolvedAt ?? Date.now(), acknowledged: true, acknowledgedAt: i.acknowledgedAt ?? Date.now() }, 'Resolved by operator')}><CheckCheck size={15} /> Resolve</button>}
          {i.status !== 'dismissed' && i.status !== 'resolved' && <button className="btn" onClick={() => { incidentStore.update(i.id, { status: 'dismissed' }, 'Dismissed by operator (false alarm)'); onClose() }}><XCircle size={15} /> Dismiss</button>}
          <button className={`btn ml-auto ${sos ? 'btn-on' : 'btn-danger'}`} onClick={() => setSos((v) => !v)}>{sos ? <><ShieldCheck size={15} /> Back to details</> : <><Radio size={15} /> Open SOS preview</>}</button>
        </div>
      </motion.div>
    </motion.div>
  )
}

function Field({ k, v }: { k: string; v: React.ReactNode }) {
  return <div className="flex items-center justify-between gap-2 border-b border-line/60 pb-1.5"><span className="text-muted">{k}</span><span className="text-right font-medium">{v}</span></div>
}
