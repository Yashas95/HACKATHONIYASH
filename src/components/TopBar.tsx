import { useEffect, useState } from 'react'
import { Camera, Cpu, MapPin, Volume2 } from 'lucide-react'
import type { Snapshot } from '../lib/monitor'
import type { VoiceState } from '../lib/voice'
import type { EnvironmentPreset } from '../types'

function Dot({ tone }: { tone: 'ok' | 'warn' | 'bad' | 'idle' }) {
  const c = { ok: 'bg-safe', warn: 'bg-caution', bad: 'bg-danger', idle: 'bg-muted' }[tone]
  return (
    <span className="relative flex h-2 w-2">
      {tone === 'ok' && <span className={`absolute inline-flex h-full w-full animate-ping rounded-full ${c} opacity-50`} />}
      <span className={`relative inline-flex h-2 w-2 rounded-full ${c}`} />
    </span>
  )
}

function Status({ icon, label, value, tone }: { icon: React.ReactNode; label: string; value: string; tone: 'ok' | 'warn' | 'bad' | 'idle' }) {
  return (
    <div className="flex items-center gap-2.5 rounded-lg border border-line bg-surface/60 px-3 py-1.5" title={value}>
      <span className="text-muted">{icon}</span>
      <div className="leading-tight">
        <div className="label !text-[9px]">{label}</div>
        <div className="flex max-w-[190px] items-center gap-1.5 truncate text-[12px] font-semibold"><Dot tone={tone} /><span className="truncate">{value}</span></div>
      </div>
    </div>
  )
}

export function TopBar({ snap, voice, preset }: { snap: Snapshot; voice: VoiceState; preset: EnvironmentPreset }) {
  const [now, setNow] = useState(new Date())
  useEffect(() => { const i = setInterval(() => setNow(new Date()), 1000); return () => clearInterval(i) }, [])

  const camTone = snap.sourceState === 'live' ? 'ok' : snap.sourceState === 'error' ? 'bad' : snap.sourceState === 'starting' ? 'warn' : 'idle'
  const camText = snap.sourceState === 'live' ? (snap.source === 'webcam' ? 'Live camera' : `Footage · ${snap.sourceName}`)
    : snap.sourceState === 'starting' ? 'Connecting…' : snap.sourceState === 'error' ? 'Error' : 'Standby'
  const aiTone = snap.engine === 'ready' ? 'ok' : snap.engine === 'loading' ? 'warn' : snap.engine === 'error' ? 'bad' : 'idle'
  const aiText = snap.engine === 'ready' ? snap.engineNote : snap.engine === 'loading' ? snap.engineNote : snap.engine === 'error' ? 'Model error' : 'Not loaded'

  return (
    <header className="flex h-[60px] shrink-0 items-center gap-4 border-b border-line bg-bg/80 px-5 backdrop-blur">
      <div className="flex items-center gap-3">
        <svg width="30" height="30" viewBox="0 0 32 32" aria-hidden>
          <defs><linearGradient id="lg" x1="0" x2="1" y1="0" y2="1"><stop offset="0" stopColor="#32D7E8" /><stop offset="1" stopColor="#1A8FD0" /></linearGradient></defs>
          <path d="M16 2 28 7v8.5c0 7.2-5 12.4-12 14.5C9 27.9 4 22.7 4 15.5V7z" fill="none" stroke="url(#lg)" strokeWidth="2.2" />
          <path d="M9 18.5c2.4-1.6 4.6-1.6 7 0s4.6 1.6 7 0" fill="none" stroke="#32D7E8" strokeWidth="2" strokeLinecap="round" />
          <circle cx="16" cy="12" r="2.4" fill="#FF4D2E" />
        </svg>
        <div className="leading-none">
          <div className="font-display text-[17px] font-bold tracking-[0.08em]">EDGEGUARD <span className="text-cyan">AI</span></div>
          <div className="mt-1 text-[10.5px] tracking-wide text-muted">Intelligent safety before the accident</div>
        </div>
      </div>
      <div className="mx-2 h-8 w-px bg-line" />
      <div className="flex min-w-0 items-center gap-2 text-[13px]">
        <MapPin size={15} className="shrink-0 text-cyan" />
        <span className="truncate font-semibold">{preset.location}</span>
        <span className="hidden truncate text-muted xl:inline">· {preset.cameraName}</span>
      </div>
      <div className="ml-auto flex items-center gap-2">
        <Status icon={<Camera size={15} />} label="Camera" value={camText} tone={camTone} />
        <Status icon={<Cpu size={15} />} label="AI engine" value={aiText} tone={aiTone} />
        <Status icon={<Volume2 size={15} />} label="Voice" value={voice.backend === 'sarvam' ? voice.backendNote : voice.backend === 'checking' ? 'Checking…' : 'Fallback · browser'} tone={voice.backend === 'sarvam' ? (voice.backendNote.includes('error') ? 'warn' : 'ok') : voice.backend === 'checking' ? 'idle' : 'warn'} />
        <div className="ml-2 text-right leading-tight">
          <div className="mono text-[17px] font-semibold">{now.toLocaleTimeString('en-IN', { hour12: false })}</div>
          <div className="text-[10.5px] text-muted">{now.toLocaleDateString('en-IN', { weekday: 'short', day: '2-digit', month: 'short' })} · IST</div>
        </div>
      </div>
    </header>
  )
}
