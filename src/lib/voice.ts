import type { Language } from '../types'

export type VoiceSource = 'sarvam' | 'sarvam-cache' | 'browser' | 'none'
export interface Utterance { personId: string; text: string; lang: Language; enText: string; groupText: string; groupEnText: string }
export interface VoiceState {
  backend: 'checking' | 'sarvam' | 'fallback'
  backendNote: string
  speaking: null | { text: string; source: VoiceSource; personIds: string[] }
}

/**
 * One-at-a-time announcer. Sarvam audio (via the local /api/tts proxy) is
 * decoded into an AudioContext so it can also be captured into exports;
 * browser speechSynthesis is the labelled fallback.
 */
export class VoiceManager {
  ctx?: AudioContext
  recordDest?: MediaStreamAudioDestinationNode
  private cache = new Map<string, Promise<AudioBuffer | null>>()
  private pending: Utterance[] = []
  private busy = false
  private listeners = new Set<(s: VoiceState) => void>()
  state: VoiceState = { backend: 'checking', backendNote: 'Checking Sarvam proxy…', speaking: null }

  subscribe(fn: (s: VoiceState) => void) { this.listeners.add(fn); fn(this.state); return () => { this.listeners.delete(fn) } }
  private set(p: Partial<VoiceState>) { this.state = { ...this.state, ...p }; this.listeners.forEach((f) => f(this.state)) }

  async init() {
    try {
      const r = await fetch('/api/tts')
      const j = await r.json()
      if (j.configured) this.set({ backend: 'sarvam', backendNote: `Sarvam ${j.model}` })
      else this.set({ backend: 'fallback', backendNote: 'SARVAM_API_KEY not set — browser voice' })
    } catch {
      this.set({ backend: 'fallback', backendNote: 'Voice proxy unreachable — browser voice' })
    }
  }

  /** Must be called from a user gesture (browser autoplay policy). */
  unlock() {
    if (!this.ctx) {
      this.ctx = new AudioContext()
      this.recordDest = this.ctx.createMediaStreamDestination()
    }
    void this.ctx.resume()
  }

  private fetchClip(text: string, lang: Language): Promise<AudioBuffer | null> {
    const k = `${lang}|${text}`
    let p = this.cache.get(k)
    if (!p) {
      p = (async () => {
        if (this.state.backend === 'fallback' || !this.ctx) return null
        try {
          const r = await fetch('/api/tts', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ text, lang }) })
          if (!r.ok) {
            const j = await r.json().catch(() => ({}))
            this.set({ backendNote: `Sarvam error: ${j.error ?? r.status} — using browser voice` })
            return null
          }
          return await this.ctx.decodeAudioData(await r.arrayBuffer())
        } catch { return null }
      })()
      this.cache.set(k, p)
      p.then((b) => { if (!b) this.cache.delete(k) })
    }
    return p
  }

  /** Warm the cache so the first real warning has no network latency. */
  async prefetch(texts: string[], lang: Language) {
    for (const t of texts) { await this.fetchClip(t, lang); await new Promise((r) => setTimeout(r, 150)) }
  }

  request(u: Utterance) {
    if (this.pending.some((p) => p.personId === u.personId)) return
    this.pending.push(u)
    if (!this.busy) void this.drain()
  }

  cancel() {
    this.pending = []
    speechSynthesis.cancel()
  }

  private async drain() {
    this.busy = true
    while (this.pending.length) {
      const batch = this.pending.splice(0)
      const first = batch[0]
      const group = batch.length > 1
      const text = group ? first.groupText : first.text
      const enText = group ? first.groupEnText : first.enText
      await this.play(text, first.lang, enText, batch.map((b) => b.personId))
      await new Promise((r) => setTimeout(r, 350))
    }
    this.busy = false
  }

  /** Resolves when playback finishes. `onStart` fires when audio actually begins. */
  onStart?: (personIds: string[], source: VoiceSource, text: string) => void

  private async play(text: string, lang: Language, enText: string, personIds: string[]) {
    const buf = await this.fetchClip(text, lang)
    if (buf && this.ctx) {
      const src = this.ctx.createBufferSource()
      src.buffer = buf
      src.connect(this.ctx.destination)
      if (this.recordDest) src.connect(this.recordDest)
      this.set({ speaking: { text, source: 'sarvam', personIds } })
      this.onStart?.(personIds, 'sarvam', text)
      await new Promise<void>((res) => { src.onended = () => res(); src.start() })
    } else {
      // Browser fallback. Use a Malayalam system voice if one exists, otherwise speak the English text.
      const voices = speechSynthesis.getVoices()
      const want = lang === 'ml' ? 'ml' : 'en'
      const voice = voices.find((v) => v.lang.toLowerCase().startsWith(want + '-in')) ?? voices.find((v) => v.lang.toLowerCase().startsWith(want))
      const useText = voice || lang === 'en' ? text : enText
      const u = new SpeechSynthesisUtterance(useText)
      if (voice) u.voice = voice
      u.lang = voice?.lang ?? 'en-IN'
      u.rate = 1
      const label = lang === 'ml' && !voice ? 'browser (no Malayalam voice — English)' : 'browser'
      this.set({ speaking: { text: useText, source: 'browser', personIds } })
      this.onStart?.(personIds, 'browser', useText)
      if (lang === 'ml' && !voice) this.set({ backendNote: `Fallback: ${label}` })
      await new Promise<void>((res) => {
        u.onend = () => res(); u.onerror = () => res()
        speechSynthesis.speak(u)
        setTimeout(res, 9000)
      })
    }
    this.set({ speaking: null })
  }
}
