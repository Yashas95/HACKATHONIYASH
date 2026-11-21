import type { ClothingColor, Detection, Pt, TrackedPerson } from '../types'
import { centre, iou } from './geometry'

export interface Track extends TrackedPerson {
  colorVotes: ClothingColor[]
  framesSinceColor: number
  vel: Pt
}

const CONFIRM_HITS = 3 // frames before a new detection becomes a tracked person
const LOST_MS = 1200 // unmatched this long → "tracking lost"
const DROP_MS = 2500 // then removed entirely

let nextId = 1
export const resetIds = () => { nextId = 1 }

function footPoints(d: Detection): { pts: Pt[]; source: 'pose' | 'box' } {
  const lm = d.landmarks
  if (lm) {
    const pts: Pt[] = []
    for (const ids of [[27, 29, 31], [28, 30, 32]]) {
      const vis = ids.map((i) => lm[i]).filter((p) => p && p.v > 0.5)
      if (vis.length) pts.push({ x: vis.reduce((s, p) => s + p.x, 0) / vis.length, y: Math.max(...vis.map((p) => p.y)) })
    }
    if (pts.length) return { pts, source: 'pose' }
  }
  return { pts: [{ x: d.box.x + d.box.w / 2, y: d.box.y + d.box.h }], source: 'box' }
}

/** Greedy IoU + motion-predicted centre-distance tracker with temporary session IDs. */
export class Tracker {
  tracks: Track[] = []

  update(dets: Detection[], now: number, aspect: number): Track[] {
    const pairs: { t: number; d: number; s: number }[] = []
    this.tracks.forEach((t, ti) => {
      const dt = Math.min(0.5, (now - t.lastObservedAt) / 1000)
      const pred = { ...t.box, x: t.box.x + t.vel.x * dt, y: t.box.y + t.vel.y * dt }
      dets.forEach((d, di) => {
        const ov = iou(pred, d.box)
        const c1 = centre(pred), c2 = centre(d.box)
        const dist = Math.hypot((c1.x - c2.x) * aspect, c1.y - c2.y) / Math.max(pred.h, d.box.h, 0.02)
        const sizeRatio = Math.min(pred.h, d.box.h) / Math.max(pred.h, d.box.h)
        if (sizeRatio < 0.45) return
        const s = ov > 0.15 ? 1 + ov : dist < 0.7 ? 1 - dist : 0
        if (s > 0) pairs.push({ t: ti, d: di, s })
      })
    })
    pairs.sort((a, b) => b.s - a.s)
    const usedT = new Set<number>(), usedD = new Set<number>()
    for (const p of pairs) {
      if (usedT.has(p.t) || usedD.has(p.d)) continue
      usedT.add(p.t); usedD.add(p.d)
      const t = this.tracks[p.t], d = dets[p.d]
      const dt = Math.max(0.016, (now - t.lastObservedAt) / 1000)
      const a = 0.55 // box smoothing
      const nb = {
        x: t.box.x * (1 - a) + d.box.x * a, y: t.box.y * (1 - a) + d.box.y * a,
        w: t.box.w * (1 - a) + d.box.w * a, h: t.box.h * (1 - a) + d.box.h * a,
      }
      const c0 = centre(t.box), c1 = centre(nb)
      t.vel = { x: t.vel.x * 0.6 + ((c1.x - c0.x) / dt) * 0.4, y: t.vel.y * 0.6 + ((c1.y - c0.y) / dt) * 0.4 }
      t.box = nb
      t.landmarks = d.landmarks
      const f = footPoints({ ...d, box: nb })
      t.footPoints = f.pts; t.footSource = f.source
      t.currentPosition = f.pts.length === 2 ? { x: (f.pts[0].x + f.pts[1].x) / 2, y: Math.max(f.pts[0].y, f.pts[1].y) } : f.pts[0]
      t.trackingConfidence = t.trackingConfidence * 0.7 + d.score * 0.3
      t.lastObservedAt = now
      t.hits++
      if (t.hits >= CONFIRM_HITS) t.confirmed = true
      t.lost = false
    }
    dets.forEach((d, di) => {
      if (usedD.has(di)) return
      const f = footPoints(d)
      this.tracks.push({
        id: '', box: d.box, landmarks: d.landmarks, trackingConfidence: d.score,
        approximateClothingColor: 'unknown', footPoints: f.pts, footSource: f.source, currentPosition: f.pts[0],
        zoneState: 'safe', firstObservedAt: now, lastObservedAt: now, lastWarningAt: 0,
        hits: 1, confirmed: false, lost: false, colorVotes: [], framesSinceColor: 99, vel: { x: 0, y: 0 },
      })
    })
    for (const t of this.tracks) {
      if (t.confirmed && !t.id) t.id = `P-${String(nextId++).padStart(3, '0')}`
      const age = now - t.lastObservedAt
      if (age > 0) t.landmarks = undefined
      if (age > LOST_MS) t.lost = true
    }
    // Unconfirmed tracks that vanish are noise; confirmed ones linger as "tracking lost".
    this.tracks = this.tracks.filter((t) => (t.confirmed ? now - t.lastObservedAt < DROP_MS : now - t.lastObservedAt < 250))
    return this.tracks
  }

  clear() { this.tracks = []; resetIds() }
}
