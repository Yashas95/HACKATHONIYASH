// Captures README / landing-page screenshots of the running app (npm run dev must be running).
// Drives headless Microsoft Edge or Chrome over the DevTools protocol; no extra packages needed.
//   node scripts/screenshots.mjs [http://localhost:5173]
import { spawn } from 'node:child_process'
import { existsSync, mkdirSync, mkdtempSync, writeFileSync, copyFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join, dirname } from 'node:path'
import { fileURLToPath } from 'node:url'

const root = join(dirname(fileURLToPath(import.meta.url)), '..')
const base = process.argv[2] || 'http://localhost:5173'
const out = join(root, 'docs/screenshots')
mkdirSync(out, { recursive: true })
mkdirSync(join(root, 'public/media'), { recursive: true }) // the landing page shows two console shots

const SHOTS = [
  { name: 'overview', path: '/?view=overview', wait: 5000 },
  { name: 'console-beach', path: '/?camera=beach&t=6.6&shot=1' },
  { name: 'console-metro', path: '/?camera=metro&t=4.2&shot=1' },
  { name: 'console-beach-wide', path: '/?camera=beach2&t=12&shot=1' },
  { name: 'console-backwater', path: '/?camera=backwater&t=2.6&shot=1' },
  { name: 'adjust-yellow-line', path: '/?camera=beach&t=2.0&edit=1&shot=1' },
  { name: 'incident', path: '/?camera=metro&t=4.2&open=1&shot=1' },
  { name: 'landing', path: '/', wait: 4000 }, // last: its hero uses the fresh console shot
]

const browsers = ['C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe', 'C:/Program Files/Google/Chrome/Application/chrome.exe', '/usr/bin/google-chrome']
const exe = browsers.find((b) => existsSync(b))
if (!exe) { console.error('No Edge/Chrome found'); process.exit(1) }

const port = 9333
const proc = spawn(exe, ['--headless=new', `--remote-debugging-port=${port}`, `--user-data-dir=${mkdtempSync(join(tmpdir(), 'eg-shot-'))}`,
  '--window-size=1440,900', '--autoplay-policy=no-user-gesture-required', '--mute-audio', '--no-first-run', 'about:blank'], { stdio: 'ignore' })
const sleep = (ms) => new Promise((r) => setTimeout(r, ms))

let target
for (let i = 0; i < 50 && !target; i++) {
  try { target = (await (await fetch(`http://127.0.0.1:${port}/json/list`)).json()).find((t) => t.type === 'page') } catch { await sleep(200) }
}
const ws = new WebSocket(target.webSocketDebuggerUrl)
await new Promise((r) => ws.addEventListener('open', r))
let id = 0
const pending = new Map()
ws.addEventListener('message', (e) => { const m = JSON.parse(e.data); if (m.id && pending.has(m.id)) { pending.get(m.id)(m); pending.delete(m.id) } })
const cdp = (method, params = {}) => new Promise((r) => { const i = ++id; pending.set(i, r); ws.send(JSON.stringify({ id: i, method, params })) })

await cdp('Emulation.setDeviceMetricsOverride', { width: 1440, height: 900, deviceScaleFactor: 1, mobile: false })
for (const s of SHOTS) {
  await cdp('Page.navigate', { url: base + s.path })
  if (s.wait) await sleep(s.wait)
  else {
    for (let i = 0; i < 240; i++) { // up to 2 minutes for models + jump
      const r = await cdp('Runtime.evaluate', { expression: 'window.__shotReady === true', returnByValue: true })
      if (r.result?.result?.value) break
      await sleep(500)
    }
    await sleep(600)
  }
  const shot = await cdp('Page.captureScreenshot', { format: 'png' })
  writeFileSync(join(out, `${s.name}.png`), Buffer.from(shot.result.data, 'base64'))
  if (s.name === 'console-beach' || s.name === 'console-metro') copyFileSync(join(out, `${s.name}.png`), join(root, `public/media/shot-${s.name}.png`))
  console.log(`✓ ${s.name}.png`)
}
ws.close(); proc.kill()
