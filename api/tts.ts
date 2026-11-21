// Vercel serverless function: GET /api/tts → status, POST /api/tts {text, lang} → audio/wav.
// Same contract as the local dev proxy (server/tts-proxy.ts). The Sarvam key comes from the
// SARVAM_API_KEY environment variable set in the Vercel project settings; it never reaches the browser.

interface Req { method?: string; body?: unknown }
interface Res {
  status(code: number): Res
  setHeader(name: string, value: string): void
  json(body: unknown): void
  send(body: Buffer): void
}

const MODEL = process.env.SARVAM_MODEL || 'bulbul:v3' // v3 has Malayalam voices
const LANG_CODE: Record<string, string> = { en: 'en-IN', ml: 'ml-IN', hi: 'hi-IN', kn: 'kn-IN' }
const SPEAKER: Record<string, string> = {
  en: process.env.SARVAM_SPEAKER_EN || 'pooja', ml: process.env.SARVAM_SPEAKER_ML || 'pooja',
  hi: process.env.SARVAM_SPEAKER_HI || 'pooja', kn: process.env.SARVAM_SPEAKER_KN || 'pooja',
}
const TRANSLATE = new Set(['hi', 'kn']) // translated from English by Sarvam Translate
const cache = new Map<string, { buf: Buffer; spoken: string }>() // survives while the function instance stays warm

export default async function handler(req: Req, res: Res) {
  const key = process.env.SARVAM_API_KEY
  if (req.method === 'GET') return res.status(200).json({ configured: !!key, model: MODEL })
  if (req.method !== 'POST') return res.status(405).json({ error: 'POST only' })

  const body = (typeof req.body === 'string' ? JSON.parse(req.body) : req.body) as { text?: string; lang?: string } | undefined
  const text = body?.text ?? ''
  const lang = LANG_CODE[body?.lang ?? ''] ? body!.lang! : 'en'
  if (!text || text.length > 500) return res.status(400).json({ error: 'text must be 1–500 chars' })
  if (!key) return res.status(503).json({ error: 'SARVAM_API_KEY not set' })

  const languageCode = LANG_CODE[lang]
  const speaker = SPEAKER[lang]
  const cacheKey = `${MODEL}|${speaker}|${languageCode}|${text}`
  const hit = cache.get(cacheKey)
  if (hit) {
    res.setHeader('Content-Type', 'audio/mpeg')
    res.setHeader('X-TTS-Source', 'sarvam-cache')
    res.setHeader('X-Spoken-Text', encodeURIComponent(hit.spoken))
    return res.status(200).send(hit.buf)
  }

  try {
    let spoken = text
    if (TRANSLATE.has(lang)) {
      const t = await fetch('https://api.sarvam.ai/translate', {
        method: 'POST',
        headers: { 'api-subscription-key': key, 'Content-Type': 'application/json' },
        body: JSON.stringify({ input: text, source_language_code: 'en-IN', target_language_code: languageCode, model: 'sarvam-translate:v1' }),
        signal: AbortSignal.timeout(10000),
      })
      const tj = (await t.json()) as { translated_text?: string; error?: { message?: string } }
      if (!t.ok || !tj.translated_text) return res.status(502).json({ error: tj.error?.message ?? `Sarvam translate HTTP ${t.status}` })
      spoken = tj.translated_text
    }
    const r = await fetch('https://api.sarvam.ai/text-to-speech', {
      method: 'POST',
      headers: { 'api-subscription-key': key, 'Content-Type': 'application/json' },
      body: JSON.stringify({ text: spoken, language_code: languageCode, model: MODEL, speaker, pace: 1.05, enable_preprocessing: true, output_audio_codec: 'mp3' }),
      signal: AbortSignal.timeout(18000),
    })
    const data = (await r.json()) as { audios?: string[]; error?: { message?: string } }
    if (!r.ok || !data.audios?.[0]) return res.status(502).json({ error: data.error?.message ?? `Sarvam HTTP ${r.status}` })
    const buf = Buffer.from(data.audios[0], 'base64')
    cache.set(cacheKey, { buf, spoken })
    res.setHeader('Content-Type', 'audio/mpeg')
    res.setHeader('X-TTS-Source', 'sarvam')
    res.setHeader('X-Spoken-Text', encodeURIComponent(spoken))
    return res.status(200).send(buf)
  } catch (e) {
    return res.status(502).json({ error: `Sarvam unreachable: ${(e as Error).message}` })
  }
}
