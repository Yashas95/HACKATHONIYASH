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
const SPEAKER_EN = process.env.SARVAM_SPEAKER_EN || 'pooja'
const SPEAKER_ML = process.env.SARVAM_SPEAKER_ML || 'pooja'
const cache = new Map<string, Buffer>() // survives while the function instance stays warm

export default async function handler(req: Req, res: Res) {
  const key = process.env.SARVAM_API_KEY
  if (req.method === 'GET') return res.status(200).json({ configured: !!key, model: MODEL })
  if (req.method !== 'POST') return res.status(405).json({ error: 'POST only' })

  const body = (typeof req.body === 'string' ? JSON.parse(req.body) : req.body) as { text?: string; lang?: string } | undefined
  const text = body?.text ?? ''
  const lang = body?.lang === 'ml' ? 'ml' : 'en'
  if (!text || text.length > 500) return res.status(400).json({ error: 'text must be 1–500 chars' })
  if (!key) return res.status(503).json({ error: 'SARVAM_API_KEY not set' })

  const languageCode = lang === 'ml' ? 'ml-IN' : 'en-IN'
  const speaker = lang === 'ml' ? SPEAKER_ML : SPEAKER_EN
  const cacheKey = `${MODEL}|${speaker}|${languageCode}|${text}`
  const hit = cache.get(cacheKey)
  if (hit) {
    res.setHeader('Content-Type', 'audio/wav')
    res.setHeader('X-TTS-Source', 'sarvam-cache')
    return res.status(200).send(hit)
  }

  try {
    const r = await fetch('https://api.sarvam.ai/text-to-speech', {
      method: 'POST',
      headers: { 'api-subscription-key': key, 'Content-Type': 'application/json' },
      body: JSON.stringify({ text, language_code: languageCode, model: MODEL, speaker, pace: 1.05, enable_preprocessing: true }),
      signal: AbortSignal.timeout(9000),
    })
    const data = (await r.json()) as { audios?: string[]; error?: { message?: string } }
    if (!r.ok || !data.audios?.[0]) return res.status(502).json({ error: data.error?.message ?? `Sarvam HTTP ${r.status}` })
    const buf = Buffer.from(data.audios[0], 'base64')
    cache.set(cacheKey, buf)
    res.setHeader('Content-Type', 'audio/wav')
    res.setHeader('X-TTS-Source', 'sarvam')
    return res.status(200).send(buf)
  } catch (e) {
    return res.status(502).json({ error: `Sarvam unreachable: ${(e as Error).message}` })
  }
}
