// Builds the shipped voice pack from the local Sarvam cache (.tts-cache):
// copies every generated MP3 into public/voice/ and writes public/voice/manifest.json
// mapping "lang|text" → { file, spoken }. The app plays these instantly and offline.
// Fill the cache first by opening each camera in each language (or the warm-up in the README).
import { copyFileSync, existsSync, mkdirSync, readdirSync, readFileSync, writeFileSync } from 'node:fs'
import { join, dirname } from 'node:path'
import { fileURLToPath } from 'node:url'

const root = join(dirname(fileURLToPath(import.meta.url)), '..')
const cache = join(root, '.tts-cache')
const out = join(root, 'public/voice')
if (!existsSync(cache)) { console.error('No .tts-cache yet: run the app with SARVAM_API_KEY set first.'); process.exit(1) }
mkdirSync(out, { recursive: true })

const manifest = {}
for (const f of readdirSync(cache).filter((n) => n.endsWith('.json'))) {
  const id = f.replace(/\.json$/, '')
  if (!existsSync(join(cache, `${id}.mp3`))) continue
  const { lang, text, spoken } = JSON.parse(readFileSync(join(cache, f), 'utf-8'))
  copyFileSync(join(cache, `${id}.mp3`), join(out, `${id}.mp3`))
  manifest[`${lang}|${text}`] = { file: `${id}.mp3`, spoken }
}
writeFileSync(join(out, 'manifest.json'), JSON.stringify(manifest, null, 1))
console.log(`✓ voice pack: ${Object.keys(manifest).length} clips → public/voice/`)
