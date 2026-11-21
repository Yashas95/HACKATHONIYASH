/* EdgeGuard AI inference worker (classic worker, loaded from /public).
 * Runs MediaPipe person detection (EfficientDet, COCO "person") and pose
 * estimation off the main thread so video + overlays render smoothly.
 * Classic worker on purpose: MediaPipe loads its WASM with importScripts. */
/* global importScripts */
var module = { exports: {} }
var exports = module.exports
importScripts('/mediapipe/vision_bundle.js')
const { FilesetResolver, ObjectDetector, PoseLandmarker } = module.exports

let fileset, detector, pose
let frameNo = 0, lastBoxes = null, lastPoses = []
let delegate = 'GPU'
const tile = new OffscreenCanvas(1, 1)
const tctx = tile.getContext('2d')
const full = new OffscreenCanvas(1, 1)
const fctx = full.getContext('2d')

const CDN = 'https://storage.googleapis.com/mediapipe-models'
const MODELS = {
  pose: ['/models/pose_landmarker_full.task', `${CDN}/pose_landmarker/pose_landmarker_full/float16/latest/pose_landmarker_full.task`],
  fast: ['/models/efficientdet_lite0.tflite', `${CDN}/object_detector/efficientdet_lite0/float16/latest/efficientdet_lite0.tflite`],
  accurate: ['/models/efficientdet_lite2.tflite', `${CDN}/object_detector/efficientdet_lite2/float16/latest/efficientdet_lite2.tflite`],
}
async function resolve([localPath, cdn]) {
  try {
    const r = await fetch(localPath, { method: 'HEAD' })
    if (r.ok && !(r.headers.get('content-type') || '').includes('text/html')) return localPath
  } catch (_) { /* offline or missing */ }
  return cdn
}

async function makeDetector(q) {
  const next = await ObjectDetector.createFromOptions(fileset, {
    baseOptions: { modelAssetPath: await resolve(MODELS[q]), delegate },
    runningMode: 'IMAGE', scoreThreshold: 0.25, maxResults: 40, categoryAllowlist: ['person'],
  })
  if (detector) detector.close()
  detector = next
}

// ---- geometry ----
function iou(a, b) {
  const x1 = Math.max(a.x, b.x), y1 = Math.max(a.y, b.y)
  const x2 = Math.min(a.x + a.w, b.x + b.w), y2 = Math.min(a.y + a.h, b.y + b.h)
  const inter = Math.max(0, x2 - x1) * Math.max(0, y2 - y1)
  return inter / (a.w * a.h + b.w * b.h - inter || 1e-9)
}
function coverage(inner, outer) {
  const x1 = Math.max(inner.x, outer.x), y1 = Math.max(inner.y, outer.y)
  const x2 = Math.min(inner.x + inner.w, outer.x + outer.w), y2 = Math.min(inner.y + inner.h, outer.y + outer.h)
  return (Math.max(0, x2 - x1) * Math.max(0, y2 - y1)) / (inner.w * inner.h || 1e-9)
}
function landmarkBox(lm) {
  const vis = lm.filter((p) => p.v > 0.3)
  if (vis.length < 6) return null
  const xs = vis.map((p) => p.x), ys = vis.map((p) => p.y)
  const x = Math.min(...xs), y = Math.min(...ys), w = Math.max(...xs) - x, h = Math.max(...ys) - y
  // Landmarks hug joints; pad to approximate the full body silhouette.
  return { x: x - w * 0.15, y: y - h * 0.12, w: w * 1.3, h: h * 1.18 }
}
// Mean visibility of shoulders, hips and knees: rejects skeletons hallucinated on empty ground.
function poseQuality(lm) {
  const ids = [11, 12, 23, 24, 25, 26]
  return ids.reduce((s, i) => s + (lm[i] ? lm[i].v : 0), 0) / ids.length
}
function insideAny(b, dets) {
  const cx = b.x + b.w / 2, cy = b.y + b.h / 2
  return dets.some((d) => cx > d.box.x && cx < d.box.x + d.box.w && cy > d.box.y && cy < d.box.y + d.box.h)
}
function nms(items) {
  items.sort((a, b) => b.score - a.score)
  const keep = []
  for (const it of items) {
    if (it.box.w <= 0 || it.box.h <= 0) continue
    if (keep.every((k) => iou(k.box, it.box) < 0.45 && coverage(it.box, k.box) < 0.7)) keep.push(it)
  }
  return keep
}

// Detect people inside the normalized rectangle [x0,x1]×[y0,y1] of the frame.
function detectBoxes(x0, x1, y0 = 0, y1 = 1) {
  const W = full.width, H = full.height
  let img = full
  const tw = Math.round((x1 - x0) * W), th = Math.round((y1 - y0) * H)
  if (tw !== W || th !== H) {
    if (tile.width !== tw || tile.height !== th) { tile.width = tw; tile.height = th }
    tctx.drawImage(full, Math.round(x0 * W), Math.round(y0 * H), tw, th, 0, 0, tw, th)
    img = tile
  }
  return detector.detect(img).detections.map((d) => {
    const bb = d.boundingBox
    return { score: d.categories[0] ? d.categories[0].score : 0, box: { x: x0 + bb.originX / W, y: y0 + bb.originY / H, w: bb.width / W, h: bb.height / H } }
  })
}
// Two overlapping half-frame tiles along the long side, so small people get ~2x resolution.
// Boxes touching an internal seam are people cut in half by the tile; the full-frame
// pass (or the other tile) covers them, so drop them instead of creating a phantom.
function tiled() {
  const e = 0.012
  return full.width >= full.height
    ? detectBoxes(0, 0.56).filter((d) => d.box.x + d.box.w < 0.56 - e)
        .concat(detectBoxes(0.44, 1).filter((d) => d.box.x > 0.44 + e))
    : detectBoxes(0, 1, 0, 0.56).filter((d) => d.box.y + d.box.h < 0.56 - e)
        .concat(detectBoxes(0, 1, 0.44, 1).filter((d) => d.box.y > 0.44 + e))
}

self.onmessage = async (e) => {
  const msg = e.data
  try {
    if (msg.type === 'init') {
      fileset = await FilesetResolver.forVisionTasks('/mediapipe/wasm')
      self.postMessage({ type: 'status', text: 'Loading pose model…' })
      const poseUrl = await resolve(MODELS.pose)
      const mk = (d) => PoseLandmarker.createFromOptions(fileset, {
        baseOptions: { modelAssetPath: poseUrl, delegate: d },
        runningMode: 'VIDEO', numPoses: 6,
        minPoseDetectionConfidence: 0.45, minPosePresenceConfidence: 0.45, minTrackingConfidence: 0.45,
      })
      try { pose = await mk('GPU') } catch (_) { delegate = 'CPU'; pose = await mk('CPU') }
      self.postMessage({ type: 'status', text: 'Loading person detector…' })
      await makeDetector(msg.quality)
      self.postMessage({ type: 'ready', delegate })
    } else if (msg.type === 'reset') {
      lastBoxes = null; lastPoses = []
    } else if (msg.type === 'quality') {
      await makeDetector(msg.quality)
      self.postMessage({ type: 'quality-ok', quality: msg.quality })
    } else if (msg.type === 'frame') {
      const bmp = msg.bitmap
      if (full.width !== bmp.width || full.height !== bmp.height) { full.width = bmp.width; full.height = bmp.height }
      fctx.drawImage(bmp, 0, 0)
      bmp.close()
      // Alternate the two models frame-to-frame: each update costs one model run,
      // and the result merges the freshest boxes with the freshest skeletons.
      const t0 = performance.now()
      const runDet = msg.both || frameNo++ % 2 === 0 || !lastBoxes
      const runPose = msg.both || !runDet
      if (runDet) {
        let b = detectBoxes(0, 1)
        if (msg.crowdBoost) b = b.concat(tiled())
        lastBoxes = nms(b)
      }
      if (runPose) {
        lastPoses = pose.detectForVideo(full, msg.ts).landmarks.map((lm) => lm.map((p) => ({ x: p.x, y: p.y, v: p.visibility ?? 0 })))
      }
      const boxes = lastBoxes.filter((b) => b.score >= 0.25)
      const poses = lastPoses
      const out = boxes.map((b) => ({ box: b.box, score: b.score }))
      for (const lm of poses) {
        const pb = landmarkBox(lm)
        if (!pb) continue
        let best = -1, bestScore = 0.3
        out.forEach((d, i) => {
          if (d.landmarks) return
          const s = Math.max(iou(pb, d.box), coverage(pb, d.box) * 0.8)
          if (s > bestScore) { bestScore = s; best = i }
        })
        if (best >= 0) out[best].landmarks = lm
        else if (pb.h > 0.12 && pb.h < 0.9 && poseQuality(lm) > 0.75 && !insideAny(pb, out)) out.push({ box: pb, score: 0.5, landmarks: lm })
      }
      // A weak box survives only if the pose model independently found a body in it.
      const kept = out.filter((d) => d.score >= msg.minScore || d.landmarks)
      self.postMessage({ type: 'result', id: msg.id, dets: kept, ms: performance.now() - t0, stage: runDet ? 'detector' : 'pose', size: [full.width, full.height] })
    }
  } catch (err) {
    self.postMessage({ type: 'error', id: msg.id, text: String((err && err.message) || err) })
  }
}
