import { useEffect, useState } from 'react'
import { ChevronRight } from 'lucide-react'
import type { Snapshot } from '../lib/monitor'
import type { VoiceState } from '../lib/voice'
import type { EnvironmentPreset } from '../types'

const C = { ok: '#3FB97A', warn: '#E0A43A', bad: '#E5533D', idle: '#5A626C' }
type Tone = keyof typeof C

function Status({ k, v, tone }: { k: string; v: string; tone: Tone }) {
  return (
    <span className="chip max-w-[230px] border border-line text-muted" title={`${k}: ${v}`}>
      <span className="dot shrink-0" style={{ background: C[tone] }} />
      <span className="shrink-0">{k}</span>
      <span className="truncate text-ink">{v}</span>
    </span>
  )
}

export function TopBar({ snap, voice, preset }: { snap: Snapshot; voice: VoiceState; preset: EnvironmentPreset }) {
  const [now, setNow] = useState(new Date())
  useEffect(() => { const i = setInterval(() => setNow(new Date()), 1000); return () => clearInterval(i) }, [])

  const cam: [string, Tone] = snap.sourceState === 'live' ? [snap.source === 'webcam' ? 'Live' : snap.paused ? 'Paused' : 'Playing', 'ok']
    : snap.sourceState === 'starting' ? ['Connecting', 'warn'] : snap.sourceState === 'error' ? ['Error', 'bad'] : ['Standby', 'idle']
  const ai: [string, Tone] = snap.engine === 'ready' ? [`${snap.engineNote.replace('MediaPipe · ', '')}`, 'ok']
    : snap.engine === 'loading' ? ['Loading', 'warn'] : snap.engine === 'error' ? ['Error', 'bad'] : ['Idle', 'idle']
  const vo: [string, Tone] = voice.backend === 'sarvam' ? [voice.backendNote.includes('error') ? 'Sarvam error' : 'Sarvam Bulbul', voice.backendNote.includes('error') ? 'warn' : 'ok']
    : voice.backend === 'checking' ? ['Checking', 'idle'] : ['Browser fallback', 'warn']

  return (
    <header className="flex h-[56px] shrink-0 items-center gap-3 border-b border-line px-5">
      <div className="flex min-w-0 flex-1 items-center gap-1.5 overflow-hidden text-[13px]">
        <span className="text-muted">Cameras</span>
        <ChevronRight size={14} className="text-faint" />
        <span className="truncate font-semibold">{preset.name}</span>
        <span className="mono ml-2 hidden shrink-0 rounded border border-line px-1.5 text-[11px] text-muted lg:inline">{preset.cameraName}</span>
        <span className="ml-2 hidden truncate text-[12px] text-muted xl:inline">{preset.location}</span>
      </div>
      <div className="flex shrink-0 items-center gap-2">
        <Status k="Feed" v={cam[0]} tone={cam[1]} />
        <Status k="Vision" v={ai[0]} tone={ai[1]} />
        <Status k="Voice" v={vo[0]} tone={vo[1]} />
        <span className="mono ml-2 text-[13px]">{now.toLocaleTimeString('en-IN', { hour12: false })}</span>
      </div>
    </header>
  )
}
