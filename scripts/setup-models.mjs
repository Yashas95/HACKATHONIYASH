// Copies the MediaPipe WASM runtime and downloads the pretrained models into
// public/, so the app works offline at the venue. Safe to re-run.
import { cpSync, existsSync, mkdirSync, writeFileSync, statSync } from 'node:fs'
import { join, dirname } from 'node:path'
import { fileURLToPath } from 'node:url'

const root = join(dirname(fileURLToPath(import.meta.url)), '..')
const pub = join(root, 'public')

cpSync(join(root, 'node_modules/@mediapipe/tasks-vision/wasm'), join(pub, 'mediapipe/wasm'), { recursive: true })
cpSync(join(root, 'node_modules/@mediapipe/tasks-vision/vision_bundle.cjs'), join(pub, 'mediapipe/vision_bundle.js'))
console.log('✓ wasm runtime + vision bundle copied to public/mediapipe')

const base = 'https://storage.googleapis.com/mediapipe-models'
const models = {
  'pose_landmarker_full.task': `${base}/pose_landmarker/pose_landmarker_full/float16/latest/pose_landmarker_full.task`,
  'efficientdet_lite0.tflite': `${base}/object_detector/efficientdet_lite0/float16/latest/efficientdet_lite0.tflite`,
  'efficientdet_lite2.tflite': `${base}/object_detector/efficientdet_lite2/float16/latest/efficientdet_lite2.tflite`,
}
mkdirSync(join(pub, 'models'), { recursive: true })
mkdirSync(join(pub, 'videos'), { recursive: true })

for (const [name, url] of Object.entries(models)) {
  const out = join(pub, 'models', name)
  if (existsSync(out) && statSync(out).size > 100_000) { console.log(`✓ ${name} (cached)`); continue }
  const res = await fetch(url)
  if (!res.ok) throw new Error(`Failed ${name}: HTTP ${res.status}`)
  writeFileSync(out, Buffer.from(await res.arrayBuffer()))
  console.log(`✓ ${name} ${(statSync(out).size / 1e6).toFixed(1)} MB`)
}
