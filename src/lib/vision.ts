import type { Detection } from '../types'

export type DetectorQuality = 'fast' | 'accurate'

export interface FrameOptions {
  mirrored: boolean
  crowdBoost: boolean
  /** Person detector confidence threshold. */
  minScore: number
  /** Run detector and pose on this same frame (pre-analysis) instead of alternating. */
  both?: boolean
}

/**
 * Main-thread handle to the inference worker. Pretrained MediaPipe models:
 * EfficientDet (COCO "person") finds people of any size; Pose Landmarker adds
 * skeletons and foot landmarks for people large enough. Frames are captured
 * into `work` (display space, mirrored if needed) and sent as ImageBitmaps.
 */
export class VisionEngine {
  private worker?: Worker
  readonly work = document.createElement('canvas')
  readonly ctx = this.work.getContext('2d')!
  private nextId = 1
  private pending = new Map<number, { res: (d: Detection[]) => void; rej: (e: Error) => void }>()
  private lastTs = 0
  delegate: 'GPU' | 'CPU' = 'GPU'
  quality: DetectorQuality = 'accurate'
  ready = false
  busy = false
  lastMs = 0
  lastStats: unknown = null

  load(quality: DetectorQuality, onStatus: (s: string) => void): Promise<void> {
    this.quality = quality
    onStatus('Loading vision runtime…')
    this.worker = new Worker('/vision-worker.js') // classic worker in public/
    return new Promise((resolve, reject) => {
      this.worker!.onmessage = (e) => {
        const m = e.data
        if (m.type === 'status') onStatus(m.text)
        else if (m.type === 'ready') { this.delegate = m.delegate; this.ready = true; resolve() }
        else if (m.type === 'result') { this.lastMs = m.ms; this.lastStats = m; this.pending.get(m.id)?.res(m.dets); this.pending.delete(m.id) }
        else if (m.type === 'quality-ok') this.quality = m.quality
        else if (m.type === 'error') {
          if (!this.ready) reject(new Error(m.text))
          this.pending.get(m.id)?.rej(new Error(m.text)); this.pending.delete(m.id)
        }
      }
      this.worker!.onerror = (e) => reject(new Error(e.message || 'Vision worker failed to start'))
      this.worker!.postMessage({ type: 'init', quality })
    })
  }

  /** Drop cached boxes/skeletons (after seek, loop or source change). */
  reset() { this.worker?.postMessage({ type: 'reset' }) }

  async setQuality(quality: DetectorQuality) {
    this.worker?.postMessage({ type: 'quality', quality })
    this.quality = quality
  }

  /** Copy the current frame into `work` (display space). Returns false if the source has no frame. */
  capture(src: HTMLVideoElement, mirrored: boolean): boolean {
    const vw = src.videoWidth, vh = src.videoHeight
    if (!vw || !vh) return false
    const scale = Math.min(1, 960 / vw)
    const W = Math.round(vw * scale), H = Math.round(vh * scale)
    if (this.work.width !== W || this.work.height !== H) { this.work.width = W; this.work.height = H }
    this.ctx.save()
    if (mirrored) { this.ctx.translate(W, 0); this.ctx.scale(-1, 1) }
    this.ctx.drawImage(src, 0, 0, W, H)
    this.ctx.restore()
    return true
  }

  /** Run inference on whatever is in `work`. Only one frame in flight at a time. */
  async infer(opt: FrameOptions): Promise<Detection[]> {
    if (!this.worker || !this.ready) return []
    this.busy = true
    try {
      const bitmap = await createImageBitmap(this.work)
      const ts = Math.max(performance.now(), this.lastTs + 1)
      this.lastTs = ts
      const id = this.nextId++
      const p = new Promise<Detection[]>((res, rej) => this.pending.set(id, { res, rej }))
      this.worker.postMessage({ type: 'frame', id, bitmap, ts, crowdBoost: opt.crowdBoost, minScore: opt.minScore, both: !!opt.both }, [bitmap])
      return await p
    } finally {
      this.busy = false
    }
  }
}
