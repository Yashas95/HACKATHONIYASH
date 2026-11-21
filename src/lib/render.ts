import { PoseLandmarker } from '@mediapipe/tasks-vision'
import type { Pt, SafetyZone, ZoneState } from '../types'
import type { Track } from './tracker'
import { COLOR_SWATCH } from './presets'

export const STATE_COLOR: Record<ZoneState, string> = {
  safe: '#5B9BFF', caution: '#E0A43A', breach: '#E5533D', unresolved: '#E5533D', resolved: '#3FB97A',
}
const STATE_LABEL: Record<ZoneState, string> = {
  safe: 'SAFE', caution: 'NEAR EDGE', breach: 'IN ZONE', unresolved: 'UNRESOLVED', resolved: 'CLEARED',
}
const CONNECTIONS = PoseLandmarker.POSE_CONNECTIONS

export interface HudInfo {
  title: string
  camera: string
  sourceLabel: string
  clock: string
  subtitle?: string
  calibrating: boolean
  storm: boolean
  dragIndex: number | null
  draft?: Pt[]
}

export function drawFrame(
  ctx: CanvasRenderingContext2D, frame: CanvasImageSource, W: number, H: number,
  tracks: Track[], zones: SafetyZone[], hud: HudInfo, now: number, mirrored: boolean,
) {
  const k = H / 720
  ctx.save()
  if (mirrored) { ctx.translate(W, 0); ctx.scale(-1, 1) }
  ctx.drawImage(frame, 0, 0, W, H)
  ctx.restore()
  // Slight grade so overlays read clearly on bright beach footage.
  ctx.fillStyle = 'rgba(8,10,12,0.12)'
  ctx.fillRect(0, 0, W, H)

  const anyBreach = tracks.some((t) => t.confirmed && !t.lost && (t.zoneState === 'breach' || t.zoneState === 'unresolved'))
  for (const z of zones) if (z.enabled) drawZone(ctx, z, W, H, k, anyBreach, now, hud.calibrating, hud.dragIndex, hud.storm)
  if (hud.draft?.length) drawDraft(ctx, hud.draft, W, H, k)

  for (const t of tracks) if (t.confirmed) drawTrack(ctx, t, W, H, k, now)

  drawHud(ctx, hud, W, H, k, now)
}

function path(ctx: CanvasRenderingContext2D, pts: Pt[], W: number, H: number) {
  ctx.beginPath()
  pts.forEach((p, i) => (i ? ctx.lineTo(p.x * W, p.y * H) : ctx.moveTo(p.x * W, p.y * H)))
  ctx.closePath()
}

function drawZone(ctx: CanvasRenderingContext2D, z: SafetyZone, W: number, H: number, k: number, hot: boolean, now: number, editing: boolean, drag: number | null, storm: boolean) {
  const pts = z.polygonCoordinates
  if (pts.length < 3) return
  const pulse = hot ? 0.5 + 0.5 * Math.sin(now / 140) : 0
  ctx.save()
  path(ctx, pts, W, H)
  ctx.fillStyle = !storm ? 'rgba(242,201,76,0.05)' : hot ? `rgba(229,83,61,${0.16 + pulse * 0.08})` : 'rgba(229,83,61,0.08)'
  ctx.fill()
  // Diagonal hazard hatching, clipped to the zone
  ctx.clip()
  ctx.strokeStyle = !storm ? 'rgba(242,201,76,0.08)' : hot ? 'rgba(229,83,61,0.28)' : 'rgba(229,83,61,0.12)'
  ctx.lineWidth = 2 * k
  const step = 18 * k
  for (let x = -H; x < W + H; x += step) { ctx.beginPath(); ctx.moveTo(x, 0); ctx.lineTo(x + H, H); ctx.stroke() }
  ctx.restore()

  // The yellow safety line: every polygon edge except those lying on the frame border.
  const onBorder = (a: Pt, b: Pt) => (a.x <= 0.002 && b.x <= 0.002) || (a.x >= 0.998 && b.x >= 0.998) || (a.y <= 0.002 && b.y <= 0.002) || (a.y >= 0.998 && b.y >= 0.998)
  ctx.save()
  ctx.lineCap = 'round'
  for (let i = 0; i < pts.length; i++) {
    const a = pts[i], b = pts[(i + 1) % pts.length]
    if (onBorder(a, b)) continue
    ctx.beginPath(); ctx.moveTo(a.x * W, a.y * H); ctx.lineTo(b.x * W, b.y * H)
    ctx.strokeStyle = 'rgba(0,0,0,0.55)'; ctx.lineWidth = 7 * k; ctx.stroke()
    ctx.strokeStyle = hot && storm ? '#FFD54A' : '#F2C94C'; ctx.lineWidth = (hot && storm ? 4.5 : 3.5) * k
    ctx.setLineDash(editing ? [12 * k, 7 * k] : []); ctx.stroke(); ctx.setLineDash([])
  }
  ctx.restore()

  // Label at the top-most vertex
  const top = pts.reduce((a, b) => (b.y < a.y ? b : a))
  const lx = Math.min(Math.max(top.x * W, 12 * k), W - 220 * k), ly = Math.max(top.y * H - 10 * k, 64 * k)
  chip(ctx, storm ? `STORM · WATER CLOSED · ${z.label.toUpperCase()}` : `SAFETY LINE · ${z.label.toUpperCase()} · ADVISORY`, lx, ly, k, storm ? '#E5533D' : '#F2C94C', storm ? '#fff' : '#0B0D10')

  if (editing) {
    pts.forEach((p, i) => {
      ctx.beginPath()
      ctx.arc(p.x * W, p.y * H, (i === drag ? 11 : 8) * k, 0, Math.PI * 2)
      ctx.fillStyle = '#07111C'
      ctx.fill()
      ctx.lineWidth = 3 * k
      ctx.strokeStyle = '#E6E8EB'
      ctx.stroke()
    })
  }
}

function drawDraft(ctx: CanvasRenderingContext2D, pts: Pt[], W: number, H: number, k: number) {
  ctx.save()
  ctx.beginPath()
  pts.forEach((p, i) => (i ? ctx.lineTo(p.x * W, p.y * H) : ctx.moveTo(p.x * W, p.y * H)))
  ctx.strokeStyle = '#E6E8EB'
  ctx.setLineDash([8 * k, 6 * k])
  ctx.lineWidth = 2.5 * k
  ctx.stroke()
  for (const p of pts) { ctx.beginPath(); ctx.arc(p.x * W, p.y * H, 6 * k, 0, Math.PI * 2); ctx.fillStyle = '#E6E8EB'; ctx.fill() }
  ctx.restore()
}

function drawTrack(ctx: CanvasRenderingContext2D, t: Track, W: number, H: number, k: number, now: number) {
  const col = t.lost ? '#8A939E' : STATE_COLOR[t.zoneState]
  const x = t.box.x * W, y = t.box.y * H, w = t.box.w * W, h = t.box.h * H
  const danger = !t.lost && (t.zoneState === 'breach' || t.zoneState === 'unresolved')
  ctx.save()

  if (danger) {
    const pulse = 0.5 + 0.5 * Math.sin(now / 120)
    ctx.fillStyle = `rgba(229,83,61,${0.06 + pulse * 0.06})`
    ctx.fillRect(x, y, w, h)
  }

  // Skeleton
  if (t.landmarks && !t.lost) {
    const lm = t.landmarks
    ctx.lineWidth = Math.max(1.5, 2.6 * k)
    ctx.strokeStyle = col
    ctx.globalAlpha = 0.85
    for (const c of CONNECTIONS) {
      const a = lm[c.start], b = lm[c.end]
      if (!a || !b || a.v < 0.4 || b.v < 0.4) continue
      ctx.beginPath(); ctx.moveTo(a.x * W, a.y * H); ctx.lineTo(b.x * W, b.y * H); ctx.stroke()
    }
    ctx.shadowBlur = 0
    ctx.fillStyle = '#E8F6FF'
    for (let i = 11; i < lm.length; i++) {
      const p = lm[i]
      if (p.v < 0.45) continue
      ctx.beginPath(); ctx.arc(p.x * W, p.y * H, 2.6 * k, 0, Math.PI * 2); ctx.fill()
    }
    ctx.globalAlpha = 1
  }

  // Corner-bracket box
  const c = Math.min(w, h) * 0.22
  ctx.strokeStyle = col
  ctx.lineWidth = (danger ? 3.2 : 2.2) * k
  ctx.setLineDash(t.lost ? [6 * k, 5 * k] : [])
  ctx.beginPath()
  ctx.moveTo(x, y + c); ctx.lineTo(x, y); ctx.lineTo(x + c, y)
  ctx.moveTo(x + w - c, y); ctx.lineTo(x + w, y); ctx.lineTo(x + w, y + c)
  ctx.moveTo(x + w, y + h - c); ctx.lineTo(x + w, y + h); ctx.lineTo(x + w - c, y + h)
  ctx.moveTo(x + c, y + h); ctx.lineTo(x, y + h); ctx.lineTo(x, y + h - c)
  ctx.stroke()
  ctx.setLineDash([])
  ctx.shadowBlur = 0

  // Foot contact points used for the zone test
  if (!t.lost) for (const p of t.footPoints) {
    ctx.beginPath()
    ctx.ellipse(p.x * W, p.y * H, 7 * k, 3 * k, 0, 0, Math.PI * 2)
    ctx.fillStyle = col
    ctx.globalAlpha = 0.85
    ctx.fill()
    ctx.globalAlpha = 1
  }

  // Resolved success ring
  if (t.zoneState === 'resolved' && !t.lost) {
    ctx.strokeStyle = '#3FB97A'
    ctx.lineWidth = 2.5 * k
    ctx.globalAlpha = 0.5 + 0.5 * Math.sin(now / 90)
    ctx.beginPath(); ctx.arc(x + w / 2, y - 26 * k, 11 * k, 0, Math.PI * 2); ctx.stroke()
    ctx.beginPath(); ctx.moveTo(x + w / 2 - 5 * k, y - 26 * k); ctx.lineTo(x + w / 2 - 1 * k, y - 22 * k); ctx.lineTo(x + w / 2 + 6 * k, y - 31 * k); ctx.stroke()
    ctx.globalAlpha = 1
  }

  // Label
  const small = h < 90 * k
  const color = t.approximateClothingColor
  const label = t.lost ? `${t.id} · TRACKING LOST` : small && t.zoneState === 'safe' ? t.id
    : `${t.id} · ${STATE_LABEL[t.zoneState]}${color !== 'unknown' ? ` · ${color.toUpperCase()}` : ''}`
  const ly = t.zoneState === 'resolved' ? y - 44 * k : y - 6 * k
  chip(ctx, label, x, Math.max(ly, 16 * k), k * (small ? 0.8 : 1), col, t.zoneState === 'caution' ? '#0B0D10' : '#fff', color !== 'unknown' && !t.lost ? COLOR_SWATCH[color] : undefined)
  ctx.restore()
}

function chip(ctx: CanvasRenderingContext2D, text: string, x: number, yBottom: number, k: number, bg: string, fg: string, swatch?: string) {
  ctx.save()
  ctx.font = `500 ${12 * k}px "Inter Variable", system-ui, sans-serif`
  const pad = 6 * k, sw = swatch ? 12 * k : 0
  const tw = ctx.measureText(text).width + pad * 2 + sw
  const h = 20 * k
  ctx.fillStyle = bg
  ctx.beginPath()
  ctx.roundRect(x, yBottom - h, tw, h, 3 * k)
  ctx.fill()
  if (swatch) {
    ctx.fillStyle = swatch
    ctx.strokeStyle = 'rgba(255,255,255,0.7)'
    ctx.lineWidth = 1
    ctx.beginPath(); ctx.roundRect(x + pad, yBottom - h / 2 - 4 * k, 8 * k, 8 * k, 2 * k); ctx.fill(); ctx.stroke()
  }
  ctx.fillStyle = fg
  ctx.textBaseline = 'middle'
  ctx.fillText(text, x + pad + sw, yBottom - h / 2 + 0.5 * k)
  ctx.restore()
}

function drawHud(ctx: CanvasRenderingContext2D, hud: HudInfo, W: number, H: number, k: number, now: number) {
  ctx.save()
  const g = ctx.createLinearGradient(0, 0, 0, 70 * k)
  g.addColorStop(0, 'rgba(0,0,0,0.6)'); g.addColorStop(1, 'rgba(0,0,0,0)')
  ctx.fillStyle = g
  ctx.fillRect(0, 0, W, 70 * k)
  ctx.textBaseline = 'top'
  ctx.font = `600 ${13 * k}px "Inter Variable", system-ui, sans-serif`
  ctx.fillStyle = '#E6E8EB'
  ctx.fillText('EdgeGuard', 16 * k, 15 * k)
  const tw = ctx.measureText('EdgeGuard').width
  ctx.font = `400 ${13 * k}px "Inter Variable", system-ui, sans-serif`
  ctx.fillStyle = 'rgba(230,232,235,0.75)'
  // Shrink-to-fit so the title never runs into the clock on narrow (portrait) footage.
  ctx.fillText(`${hud.camera} · ${hud.title}`, 28 * k + tw, 16 * k, Math.max(40 * k, W - (28 * k + tw) - 100 * k))
  ctx.font = `600 ${12 * k}px "JetBrains Mono Variable", ui-monospace, monospace`
  ctx.textAlign = 'right'
  ctx.fillText(hud.clock, W - 16 * k, 16 * k)
  // REC-style source badge
  const blink = Math.floor(now / 600) % 2 === 0
  ctx.fillStyle = blink ? '#E5533D' : 'rgba(229,83,61,0.35)'
  ctx.beginPath(); ctx.arc(W - 16 * k - ctx.measureText(hud.sourceLabel).width - 12 * k, 44 * k, 4 * k, 0, Math.PI * 2); ctx.fill()
  ctx.fillStyle = 'rgba(230,232,235,0.7)'
  ctx.fillText(hud.sourceLabel, W - 16 * k, 38 * k)
  ctx.textAlign = 'left'

  if (hud.subtitle) {
    ctx.font = `500 ${18 * k}px "Inter Variable", system-ui, sans-serif`
    const text = hud.subtitle
    const tw2 = Math.min(ctx.measureText(text).width, W - 60 * k)
    const bx = (W - tw2) / 2 - 18 * k, by = H - 74 * k
    ctx.fillStyle = 'rgba(0,0,0,0.72)'
    ctx.beginPath(); ctx.roundRect(bx, by, tw2 + 36 * k, 44 * k, 4 * k); ctx.fill()
    ctx.fillStyle = '#E5533D'
    ctx.fillRect(bx, by, 3 * k, 44 * k)
    ctx.fillStyle = '#fff'
    ctx.textBaseline = 'middle'
    ctx.fillText(text, bx + 18 * k, by + 23 * k, W - 60 * k)
  }
  ctx.restore()
}
