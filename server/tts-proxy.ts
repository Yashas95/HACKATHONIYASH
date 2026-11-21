// Vite dev/preview middleware: POST /api/tts {text, lang} → audio/wav.
// The Sarvam key is read from .env on the Node side and never sent to the browser.
// Generated clips are cached on disk so repeated warnings work offline.
import type { Plugin, Connect } from 'vite'
import { createHash } from 'node:crypto'
import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs'
import { join } from 'node:path'

interface Opts { apiKey?: string; model: string; speakers: Record<string, string>; cacheDir: string }

const LANG_CODE: Record<string, string> = { en: 'en-IN', ml: 'ml-IN', hi: 'hi-IN', kn: 'kn-IN' }
/** Languages whose warning text is translated from English by Sarvam Translate. */
const TRANSLATE = new Set(['hi', 'kn'])

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
    if (!LANG_CODE[lang]) return send(400, { error: `unsupported lang ${lang}` })
    const languageCode = LANG_CODE[lang]
    const speaker = opts.speakers[lang] ?? opts.speakers.en

    const key = createHash('sha1').update(`mp3|${opts.model}|${speaker}|${languageCode}|${text}`).digest('hex')
    const file = join(opts.cacheDir, `${key}.mp3`)
    const textFile = join(opts.cacheDir, `${key}.txt`)
    const metaFile = join(opts.cacheDir, `${key}.json`)
    const sendWav = (buf: Buffer, spoken: string, cached: boolean) => {
      res.statusCode = 200
      res.setHeader('Content-Type', 'audio/mpeg')
      res.setHeader('X-TTS-Source', cached ? 'sarvam-cache' : 'sarvam')
      res.setHeader('X-Spoken-Text', encodeURIComponent(spoken))
      res.end(buf)
    }
    if (existsSync(file)) return sendWav(readFileSync(file), existsSync(textFile) ? readFileSync(textFile, 'utf-8') : text, true)
    if (!opts.apiKey) return send(503, { error: 'SARVAM_API_KEY not set' })

    try {
      // Hindi / Kannada: translate the English warning with Sarvam Translate first.
      let spoken = text
      if (TRANSLATE.has(lang)) {
        const t = await fetch('https://api.sarvam.ai/translate', {
          method: 'POST',
          headers: { 'api-subscription-key': opts.apiKey, 'Content-Type': 'application/json' },
          body: JSON.stringify({ input: text, source_language_code: 'en-IN', target_language_code: languageCode, model: 'sarvam-translate:v1' }),
          signal: AbortSignal.timeout(25000),
        })
        const tj = (await t.json()) as { translated_text?: string; error?: { message?: string } }
        if (!t.ok || !tj.translated_text) return send(502, { error: tj.error?.message ?? `Sarvam translate HTTP ${t.status}` })
        spoken = tj.translated_text
      }
      const r = await fetch('https://api.sarvam.ai/text-to-speech', {
        method: 'POST',
        headers: { 'api-subscription-key': opts.apiKey, 'Content-Type': 'application/json' },
        body: JSON.stringify({ text: spoken, language_code: languageCode, model: opts.model, speaker, pace: 1.05, enable_preprocessing: true, output_audio_codec: 'mp3' }),
        signal: AbortSignal.timeout(25000),
      })
      const data = (await r.json()) as { audios?: string[]; error?: { message?: string } }
      if (!r.ok || !data.audios?.[0]) return send(502, { error: data.error?.message ?? `Sarvam HTTP ${r.status}` })
      const buf = Buffer.from(data.audios[0], 'base64')
      writeFileSync(file, buf)
      writeFileSync(textFile, spoken, 'utf-8')
      writeFileSync(metaFile, JSON.stringify({ lang, text, spoken }), 'utf-8')
      sendWav(buf, spoken, false)
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
