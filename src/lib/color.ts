import type { Box, ClothingColor, Landmark } from '../types'

const S = 20 // sample grid side
const sampler = document.createElement('canvas')
sampler.width = sampler.height = S
const sctx = sampler.getContext('2d', { willReadFrequently: true })!

/** Upper-torso rectangle in normalized coords, from shoulders/hips if visible, else from the box. */
export function torsoRegion(box: Box, lm?: Landmark[]): Box | null {
  if (lm) {
    const ids = [11, 12, 23, 24]
    if (ids.every((i) => lm[i] && lm[i].v > 0.5)) {
      const xs = ids.map((i) => lm[i].x), ys = ids.map((i) => lm[i].y)
      const x0 = Math.min(...xs), x1 = Math.max(...xs), y0 = Math.min(...ys), y1 = Math.max(...ys)
      const w = x1 - x0, h = y1 - y0
      // Shrink inward to stay on fabric and off the arms/background.
      return { x: x0 + w * 0.2, y: y0 + h * 0.12, w: w * 0.6, h: h * 0.6 }
    }
  }
  // Standing person: chest is roughly 20–45 % down the box, central 40 % wide.
  return { x: box.x + box.w * 0.3, y: box.y + box.h * 0.2, w: box.w * 0.4, h: box.h * 0.25 }
}

function hsv(r: number, g: number, b: number) {
  r /= 255; g /= 255; b /= 255
  const max = Math.max(r, g, b), min = Math.min(r, g, b), d = max - min
  let h = 0
  if (d) h = max === r ? ((g - b) / d) % 6 : max === g ? (b - r) / d + 2 : (r - g) / d + 4
  return { h: (h * 60 + 360) % 360, s: max ? d / max : 0, v: max }
}

function classify(r: number, g: number, b: number): ClothingColor | 'skin' | 'other' {
  const { h, s, v } = hsv(r, g, b)
  if (v < 0.2) return 'black'
  if (s < 0.16) return v > 0.78 ? 'white' : v < 0.32 ? 'black' : 'grey'
  // Bare skin (common at the beach) is low/mid-saturation orange; never call it a shirt colour.
  if (h >= 8 && h < 42 && s < 0.62 && v > 0.3) return 'skin'
  if (h < 12 || h >= 335) return 'red'
  if (h < 42) return 'other' // orange/brown
  if (h < 68) return 'yellow'
  if (h < 175) return 'green' // includes teal-green, common under station lighting
  if (h < 255) return 'blue'
  return 'other' // purple / magenta
}

/**
 * Classifies the dominant colour of the torso region for one frame.
 * Returns null when the region is too small to sample meaningfully.
 */
export function sampleClothing(src: CanvasImageSource, W: number, H: number, region: Box): ClothingColor | null {
  const px = region.w * W, py = region.h * H
  if (px < 6 || py < 6) return null
  sctx.drawImage(src, region.x * W, region.y * H, px, py, 0, 0, S, S)
  const data = sctx.getImageData(0, 0, S, S).data
  const counts = new Map<string, number>()
  for (let i = 0; i < data.length; i += 4) {
    const c = classify(data[i], data[i + 1], data[i + 2])
    counts.set(c, (counts.get(c) ?? 0) + 1)
  }
  const total = S * S
  const ranked = [...counts.entries()].filter(([c]) => c !== 'skin' && c !== 'other').sort((a, b) => b[1] - a[1])
  if (!ranked.length) return 'unknown'
  const [top, n] = ranked[0]
  const second = ranked[1]?.[1] ?? 0
  // Need a clear plurality of fabric pixels; otherwise refuse to guess.
  if (n / total < 0.38 || n < second * 1.6) return 'unknown'
  return top as ClothingColor
}

/** Majority vote over recent samples; only commits when consistent. */
export function voteColor(votes: ClothingColor[]): ClothingColor {
  if (votes.length < 3) return 'unknown'
  const counts = new Map<ClothingColor, number>()
  for (const v of votes) counts.set(v, (counts.get(v) ?? 0) + 1)
  const [top, n] = [...counts.entries()].sort((a, b) => b[1] - a[1])[0]
  return top !== 'unknown' && n / votes.length >= 0.6 ? top : 'unknown'
}

/** Like voteColor, but once a colour is confirmed it only changes on a strong (80 %) majority. */
export function stickyColor(votes: ClothingColor[], current: ClothingColor): ClothingColor {
  const voted = voteColor(votes)
  if (voted === 'unknown' || voted === current) return current === 'unknown' ? voted : current
  if (current === 'unknown') return voted
  const share = votes.filter((v) => v === voted).length / votes.length
  return share >= 0.8 ? voted : current
}
