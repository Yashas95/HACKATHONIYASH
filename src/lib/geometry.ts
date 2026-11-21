import type { Box, Pt } from '../types'

/** Ray-casting point-in-polygon. Coordinates must share one space. */
export function pointInPolygon(p: Pt, poly: Pt[]): boolean {
  let inside = false
  for (let i = 0, j = poly.length - 1; i < poly.length; j = i++) {
    const a = poly[i], b = poly[j]
    if ((a.y > p.y) !== (b.y > p.y) && p.x < ((b.x - a.x) * (p.y - a.y)) / (b.y - a.y) + a.x) inside = !inside
  }
  return inside
}

function distToSegment(p: Pt, a: Pt, b: Pt, aspect: number): number {
  // Scale x by aspect so distances are isotropic in pixels (expressed in frame heights).
  const px = p.x * aspect, ax = a.x * aspect, bx = b.x * aspect
  const dx = bx - ax, dy = b.y - a.y
  const len2 = dx * dx + dy * dy || 1e-9
  const t = Math.max(0, Math.min(1, ((px - ax) * dx + (p.y - a.y) * dy) / len2))
  return Math.hypot(px - (ax + t * dx), p.y - (a.y + t * dy))
}

/** Distance from p to polygon boundary, in units of frame height. */
export function distToPolygon(p: Pt, poly: Pt[], aspect: number): number {
  let d = Infinity
  for (let i = 0, j = poly.length - 1; i < poly.length; j = i++) d = Math.min(d, distToSegment(p, poly[j], poly[i], aspect))
  return d
}

export function iou(a: Box, b: Box): number {
  const x1 = Math.max(a.x, b.x), y1 = Math.max(a.y, b.y)
  const x2 = Math.min(a.x + a.w, b.x + b.w), y2 = Math.min(a.y + a.h, b.y + b.h)
  const inter = Math.max(0, x2 - x1) * Math.max(0, y2 - y1)
  return inter / (a.w * a.h + b.w * b.h - inter || 1e-9)
}

/** Fraction of `inner` covered by `outer`. */
export function coverage(inner: Box, outer: Box): number {
  const x1 = Math.max(inner.x, outer.x), y1 = Math.max(inner.y, outer.y)
  const x2 = Math.min(inner.x + inner.w, outer.x + outer.w), y2 = Math.min(inner.y + inner.h, outer.y + outer.h)
  return (Math.max(0, x2 - x1) * Math.max(0, y2 - y1)) / (inner.w * inner.h || 1e-9)
}

export const centre = (b: Box): Pt => ({ x: b.x + b.w / 2, y: b.y + b.h / 2 })
