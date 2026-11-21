// Vite dev/preview middleware: POST /api/tts {text, lang} → audio/wav.
// The Sarvam key is read from .env on the Node side and never sent to the browser.
// Generated clips are cached on disk so repeated warnings work offline.
import type { Plugin, Connect } from 'vite'
import { createHash } from 'node:crypto'
import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs'
import { join } from 'node:path'

interface Opts { apiKey?: string; model: string; speakerEn: string; speakerMl: string; cacheDir: string }

export function sarvamTtsProxy(opts: Opts): Plugin {
  mkdirSync(opts.cacheDir, { recursive: true })

  const handler: Connect.NextHandleFunction = async (req, res, next) => {
    if (!req.url?.startsWith('/api/tts')) return next()
    const send = (code: number, body: unknown) => {
      res.statusCode = code
      res.setHeader('Content-Type', 'application/json')
      res.end(JSON.stringify(body))
    }
    if (req.method === 'GET') return send(200, { configured: !!opts.apiKey, model: opts.model })
    if (req.method !== 'POST') return send(405, { error: 'POST only' })

    let raw = ''
    for await (const chunk of req) raw += chunk
    let text = '', lang = 'en'
    try { ({ text, lang } = JSON.parse(raw)) } catch { return send(400, { error: 'bad json' }) }
    if (!text || text.length > 500) return send(400, { error: 'text must be 1–500 chars' })
    const languageCode = lang === 'ml' ? 'ml-IN' : 'en-IN'
    const speaker = lang === 'ml' ? opts.speakerMl : opts.speakerEn

    const key = createHash('sha1').update(`${opts.model}|${speaker}|${languageCode}|${text}`).digest('hex')
    const file = join(opts.cacheDir, `${key}.wav`)
    const sendWav = (buf: Buffer, cached: boolean) => {
      res.statusCode = 200
      res.setHeader('Content-Type', 'audio/wav')
      res.setHeader('X-TTS-Source', cached ? 'sarvam-cache' : 'sarvam')
      res.end(buf)
    }
    if (existsSync(file)) return sendWav(readFileSync(file), true)
    if (!opts.apiKey) return send(503, { error: 'SARVAM_API_KEY not set' })

    try {
      const r = await fetch('https://api.sarvam.ai/text-to-speech', {
        method: 'POST',
        headers: { 'api-subscription-key': opts.apiKey, 'Content-Type': 'application/json' },
        body: JSON.stringify({ text, language_code: languageCode, model: opts.model, speaker, pace: 1.05, enable_preprocessing: true }),
        signal: AbortSignal.timeout(10000),
      })
      const data = (await r.json()) as { audios?: string[]; error?: { message?: string } }
      if (!r.ok || !data.audios?.[0]) return send(502, { error: data.error?.message ?? `Sarvam HTTP ${r.status}` })
      const buf = Buffer.from(data.audios[0], 'base64')
      writeFileSync(file, buf)
      sendWav(buf, false)
    } catch (e) {
      send(502, { error: `Sarvam unreachable: ${(e as Error).message}` })
    }
  }

  return {
    name: 'sarvam-tts-proxy',
    configureServer(server) { server.middlewares.use(handler) },
    configurePreviewServer(server) { server.middlewares.use(handler) },
  }
}
