import { useEffect, useRef, useState } from 'react'
import { ArrowRight, Bell, Eye, Languages, Pause, Play, ShieldCheck, Volume2 } from 'lucide-react'
import { Logo } from './Rail'
import { LANGUAGES, PRESETS, warningText } from '../lib/presets'
import type { Language } from '../types'

const STEPS = [
  { icon: Eye, title: 'See', text: 'On-device AI finds every person and their body pose in each camera frame.' },
  { icon: ShieldCheck, title: 'Check', text: "Each person's feet are tested against the yellow safety line set by the lifeguard." },
  { icon: Volume2, title: 'Warn', text: 'A spoken warning names what they are wearing, in English, Malayalam, Hindi or Kannada.' },
  { icon: Bell, title: 'Escalate', text: 'If they stay, an incident opens for the lifeguard. A person always makes the call.' },
]
const STATS = [
  ['< 1 s', 'to open a recorded camera'],
  ['0.7 s', 'to confirm a line crossing'],
  ['4', 'warning languages via Sarvam'],
  ['0', 'faces recognised or videos stored'],
]

/** Plays the real Sarvam clip for one language from the shipped voice pack. */
function VoiceSample({ lang, label, name }: { lang: Language; label: string; name: string }) {
  const beach = PRESETS[0]
  const [spoken, setSpoken] = useState<string>(warningText(beach, lang, 'red'))
  const [file, setFile] = useState<string | null>(null)
  const [playing, setPlaying] = useState(false)
  const audio = useRef<HTMLAudioElement | null>(null)
  useEffect(() => {
    fetch('/voice/manifest.json').then((r) => (r.ok ? r.json() : {})).then((m: Record<string, { file: string; spoken: string }>) => {
      const hit = m[`${lang}|${warningText(beach, lang, 'red')}`]
      if (hit) { setSpoken(hit.spoken); setFile(hit.file) }
    }).catch(() => {})
  }, [lang, beach])
  const toggle = () => {
    if (!file) return
    if (playing) { audio.current?.pause(); setPlaying(false); return }
    audio.current = new Audio(`/voice/${file}`)
    audio.current.onended = () => setPlaying(false)
    void audio.current.play(); setPlaying(true)
  }
  return (
    <div className="card flex flex-col p-4">
      <div className="flex items-center justify-between">
        <span className="text-[13px] font-semibold">{name} <span className="ml-1 font-normal text-muted">{label}</span></span>
        <button className="btn !h-7 !px-2 text-[12px]" onClick={toggle} disabled={!file}>{playing ? <Pause size={13} /> : <Play size={13} />}{playing ? 'Stop' : 'Hear it'}</button>
      </div>
      <p className="mt-3 text-[13.5px] leading-relaxed text-ink/90">“{spoken}”</p>
      <span className="mt-auto pt-3 text-[11px] text-muted">{lang === 'hi' || lang === 'kn' ? 'Sarvam Translate + Sarvam TTS' : 'Sarvam TTS (Bulbul v3)'}</span>
    </div>
  )
}

export function Landing({ onOpen }: { onOpen: (target: 'overview' | 'beach' | 'metro') => void }) {
  return (
    <div className="scroll-thin h-full overflow-y-auto bg-bg">
      <nav className="sticky top-0 z-20 border-b border-line bg-bg/90 backdrop-blur">
        <div className="mx-auto flex h-14 max-w-[1180px] items-center gap-6 px-6">
          <div className="flex items-center gap-2.5"><Logo /><span className="text-[15px] font-semibold">EdgeGuard AI</span></div>
          <div className="hidden gap-5 text-[13px] text-muted md:flex">
            <a href="#how" className="hover:text-ink">How it works</a>
            <a href="#services" className="hover:text-ink">Services</a>
            <a href="#languages" className="hover:text-ink">Languages</a>
          </div>
          <button className="btn btn-primary ml-auto" onClick={() => onOpen('overview')}>Open dashboard <ArrowRight size={14} /></button>
        </div>
      </nav>

      {/* Hero */}
      <header className="mx-auto grid max-w-[1180px] items-center gap-10 px-6 pb-12 pt-14 lg:grid-cols-[1fr_1.15fr]">
        <div>
          <span className="chip border border-line text-muted"><span className="dot bg-safe" />Beach and metro safety · Alappuzha, Kerala</span>
          <h1 className="mt-5 text-[44px] font-bold leading-[1.05] tracking-tight lg:text-[54px]">Warn people before they reach the edge.</h1>
          <p className="mt-4 max-w-[520px] text-[15.5px] leading-relaxed text-muted">
            EdgeGuard AI watches beach, jetty and metro-platform cameras. When someone crosses the lifeguard's yellow line, it tells
            them, by the colour of their shirt and in their language, to step back. If they don't, the lifeguard is alerted.
          </p>
          <div className="mt-7 flex flex-wrap gap-3">
            <button className="btn btn-primary !h-10 !px-4 text-[13.5px]" onClick={() => onOpen('beach')}>Watch the beach demo <ArrowRight size={15} /></button>
            <button className="btn !h-10 !px-4 text-[13.5px]" onClick={() => onOpen('overview')}>Open dashboard</button>
          </div>
          <p className="mt-4 text-[12px] text-faint">Voice by Sarvam AI · Runs on-device in the browser · Research prototype</p>
        </div>
        <div className="card overflow-hidden shadow-2xl shadow-black/50">
          <img src="/media/shot-console-beach.png" alt="EdgeGuard console: a person in a red shirt crossing the yellow line is flagged in red" className="block w-full" />
        </div>
      </header>

      {/* Story */}
      <section className="mx-auto max-w-[1180px] px-6 pb-14">
        <div className="grid gap-8 lg:grid-cols-[0.9fr_1.1fr]">
          <div>
            <span className="text-[12px] font-semibold uppercase tracking-wider text-accent">Why we built this</span>
            <h2 className="mt-2 text-[28px] font-bold leading-tight tracking-tight">One lifeguard. A whole beach of people.</h2>
          </div>
          <div className="space-y-4 text-[15px] leading-relaxed text-ink/85">
            <p>“At Alappuzha beach I watched a lifeguard shouting at people to come back from the water. He was one person, and there were many of them along the shore. Most never heard him.”</p>
            <p>“In Bengaluru, standing behind the yellow line on the metro platform is compulsory, yet people drift over it while looking at their phones.”</p>
            <p>“So EdgeGuard warns <span className="font-semibold text-ink">everyone at once</span>, each person on their own. It names what they're wearing, so they know it's meant for them, and it says it with a smile: <span className="text-accent">“Red shirt, what a lovely colour! But please step back behind the yellow line.”</span> People notice, step back, and remember the line next time.”</p>
          </div>
        </div>
      </section>

      {/* Stats */}
      <section className="border-y border-line bg-surface/50">
        <div className="mx-auto grid max-w-[1180px] grid-cols-2 gap-6 px-6 py-7 md:grid-cols-4">
          {STATS.map(([v, k]) => (
            <div key={k}><div className="num text-[28px] font-bold">{v}</div><div className="mt-1 text-[12.5px] text-muted">{k}</div></div>
          ))}
        </div>
      </section>

      {/* How it works */}
      <section id="how" className="mx-auto max-w-[1180px] px-6 py-14">
        <h2 className="text-[26px] font-bold tracking-tight">How it works</h2>
        <p className="mt-2 max-w-[640px] text-[14px] text-muted">Four steps on every frame, with confirmation delays so a stray foot near the line doesn't set off an alarm.</p>
        <div className="mt-7 grid gap-3 md:grid-cols-4">
          {STEPS.map((s, i) => (
            <div key={s.title} className="card p-4">
              <div className="flex items-center gap-2"><s.icon size={16} className="text-accent" /><span className="mono text-[11px] text-muted">0{i + 1}</span></div>
              <div className="mt-3 text-[15px] font-semibold">{s.title}</div>
              <p className="mt-1 text-[13px] leading-relaxed text-muted">{s.text}</p>
            </div>
          ))}
        </div>
      </section>

      {/* Services */}
      <section id="services" className="mx-auto max-w-[1180px] px-6 pb-14">
        <h2 className="text-[26px] font-bold tracking-tight">Services</h2>
        <div className="mt-6 grid gap-3 md:grid-cols-2">
          {([['beach', 'Beach & Water', 'Shorelines, jetties and backwaters. Storm mode closes the water.', '/media/service-beach.jpg', 'center 80%'],
            ['metro', 'Metro Platform', 'Platform edges and the yellow line, with platform-specific warnings.', '/media/service-metro.jpg', 'center 55%']] as const).map(([id, t, d, img, pos]) => (
            <button key={id} onClick={() => onOpen(id)} className="group relative h-[260px] overflow-hidden rounded-lg border border-line text-left hover:border-line-2">
              <img src={img} alt="" style={{ objectPosition: pos }} className="absolute inset-0 h-full w-full object-cover transition-transform duration-500 group-hover:scale-[1.03]" />
              <div className="absolute inset-0 bg-gradient-to-t from-black/85 via-black/30 to-transparent" />
              <div className="absolute inset-x-5 bottom-5">
                <div className="text-[38px] font-bold leading-none tracking-tight text-white">{t}</div>
                <div className="mt-2 flex items-center justify-between text-[13px] text-white/80"><span>{d}</span><span className="flex items-center gap-1 text-white">Open <ArrowRight size={14} /></span></div>
              </div>
            </button>
          ))}
        </div>
      </section>

      {/* Lifeguard control */}
      <section className="border-y border-line bg-surface/50">
        <div className="mx-auto grid max-w-[1180px] items-center gap-10 px-6 py-14 lg:grid-cols-2">
          <div className="card overflow-hidden"><img src="/media/shot-console-metro.png" alt="Metro platform: a person beyond the yellow line is flagged and an incident is raised" className="block w-full" /></div>
          <div>
            <h2 className="text-[26px] font-bold tracking-tight">The lifeguard sets the line</h2>
            <ul className="mt-4 space-y-3 text-[14px] leading-relaxed text-muted">
              <li><span className="font-semibold text-ink">Adjust yellow line:</span> drag it to the waterline or platform edge, or further back in rough weather. It is saved per camera.</li>
              <li><span className="font-semibold text-ink">Storm mode:</span> entry to the water is forbidden. Crossing turns the person red and triggers the voice warning.</li>
              <li><span className="font-semibold text-ink">Normal mode:</span> the line is advisory. Crossing only shows amber, with no alarm.</li>
              <li><span className="font-semibold text-ink">Incidents:</span> acknowledge, resolve, or open a simulated SOS preview. Nothing is ever sent automatically.</li>
            </ul>
          </div>
        </div>
      </section>

      {/* Languages */}
      <section id="languages" className="mx-auto max-w-[1180px] px-6 py-14">
        <div className="flex items-center gap-2"><Languages size={18} className="text-accent" /><h2 className="text-[26px] font-bold tracking-tight">Warnings in their language</h2></div>
        <p className="mt-2 max-w-[680px] text-[14px] text-muted">The exact words EdgeGuard speaks, in its friendly tone, when a person in a red shirt crosses the line in storm mode. These are real Sarvam AI recordings; a formal tone is one click away.</p>
        <div className="mt-6 grid gap-3 md:grid-cols-2">
          {LANGUAGES.map((l) => <VoiceSample key={l.id} lang={l.id} label={l.label} name={l.name} />)}
        </div>
      </section>

      <section className="border-t border-line">
        <div className="mx-auto flex max-w-[1180px] flex-wrap items-center justify-between gap-4 px-6 py-10">
          <div>
            <div className="text-[20px] font-bold">See it on real footage</div>
            <div className="mt-1 text-[13px] text-muted">Five cameras: two beaches, a metro platform, a backwater jetty and a lakeside promenade.</div>
          </div>
          <button className="btn btn-primary !h-10 !px-4 text-[13.5px]" onClick={() => onOpen('overview')}>Open dashboard <ArrowRight size={15} /></button>
        </div>
      </section>

      <footer className="border-t border-line">
        <div className="mx-auto flex max-w-[1180px] flex-wrap justify-between gap-3 px-6 py-6 text-[11.5px] text-faint">
          <span>EdgeGuard AI · Built at HackaThoni 2026, Alappuzha</span>
          <span>Research prototype. Not a certified safety system. Never contacts emergency services on its own.</span>
          <span>Voice: Sarvam AI (Bulbul TTS, Sarvam Translate) · Demo videos generated with Veo 3 · Built with Devin AI</span>
        </div>
      </footer>
    </div>
  )
}
