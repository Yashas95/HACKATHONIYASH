import { PoseLandmarker } from '@mediapipe/tasks-vision'
import type { Pt, SafetyZone, ZoneState } from '../types'
import type { Track } from './tracker'
import { COLOR_SWATCH } from './presets'

export const STATE_COLOR: Record<ZoneState, string> = {
  safe: '#32D7E8', caution: '#F5B83D', breach: '#FF4D2E', unresolved: '#FF2E4D', resolved: '#34D399',
}
const STATE_LABEL: Record<ZoneState, string> = {
  safe: 'SAFE', caution: 'CAUTION', breach: 'BREACH', unresolved: 'UNRESOLVED', resolved: 'CLEARED',
}
const CONNECTIONS = PoseLandmarker.POSE_CONNECTIONS

export interface HudInfo {
  title: string
  camera: string
  sourceLabel: string
  clock: string
  subtitle?: string
  calibrating: boolean
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
  ctx.fillStyle = 'rgba(4,12,22,0.18)'
  ctx.fillRect(0, 0, W, H)

  const anyBreach = tracks.some((t) => t.confirmed && !t.lost && (t.zoneState === 'breach' || t.zoneState === 'unresolved'))
  for (const z of zones) if (z.enabled) drawZone(ctx, z, W, H, k, anyBreach, now, hud.calibrating, hud.dragIndex)
  if (hud.draft?.length) drawDraft(ctx, hud.draft, W, H, k)

  for (const t of tracks) if (t.confirmed) drawTrack(ctx, t, W, H, k, now)

  drawHud(ctx, hud, W, H, k, now)
}

function path(ctx: CanvasRenderingContext2D, pts: Pt[], W: number, H: number) {
  ctx.beginPath()
  pts.forEach((p, i) => (i ? ctx.lineTo(p.x * W, p.y * H) : ctx.moveTo(p.x * W, p.y * H)))
  ctx.closePath()
}

function drawZone(ctx: CanvasRenderingContext2D, z: SafetyZone, W: number, H: number, k: number, hot: boolean, now: number, editing: boolean, drag: number | null) {
  const pts = z.polygonCoordinates
  if (pts.length < 3) return
  const pulse = hot ? 0.5 + 0.5 * Math.sin(now / 140) : 0
  ctx.save()
  path(ctx, pts, W, H)
  ctx.fillStyle = hot ? `rgba(255,60,40,${0.2 + pulse * 0.14})` : 'rgba(255,77,46,0.10)'
  ctx.fill()
  // Diagonal hazard hatching, clipped to the zone
  ctx.clip()
  ctx.strokeStyle = hot ? 'rgba(255,90,60,0.35)' : 'rgba(255,90,60,0.16)'
  ctx.lineWidth = 2 * k
  const step = 26 * k
  for (let x = -H; x < W + H; x += step) { ctx.beginPath(); ctx.moveTo(x, 0); ctx.lineTo(x + H, H); ctx.stroke() }
  ctx.restore()

  ctx.save()
  path(ctx, pts, W, H)
  ctx.shadowColor = '#FF4D2E'
  ctx.shadowBlur = (hot ? 28 + pulse * 20 : 12) * k
  ctx.strokeStyle = hot ? '#FF6A4D' : 'rgba(255,110,80,0.85)'
  ctx.lineWidth = (hot ? 3.5 : 2.2) * k
  ctx.setLineDash(editing ? [10 * k, 6 * k] : [])
  ctx.stroke()
  ctx.restore()

  // Label at the top-most vertex
  const top = pts.reduce((a, b) => (b.y < a.y ? b : a))
  const lx = Math.min(Math.max(top.x * W, 12 * k), W - 220 * k), ly = Math.max(top.y * H - 10 * k, 64 * k)
  chip(ctx, `⚠ RESTRICTED · ${z.label.toUpperCase()}`, lx, ly, k, hot ? '#FF4D2E' : 'rgba(255,77,46,0.85)', '#fff')

  if (editing) {
    pts.forEach((p, i) => {
      ctx.beginPath()
      ctx.arc(p.x * W, p.y * H, (i === drag ? 11 : 8) * k, 0, Math.PI * 2)
      ctx.fillStyle = '#07111C'
      ctx.fill()
      ctx.lineWidth = 3 * k
      ctx.strokeStyle = '#32D7E8'
      ctx.stroke()
    })
  }
}

function drawDraft(ctx: CanvasRenderingContext2D, pts: Pt[], W: number, H: number, k: number) {
  ctx.save()
  ctx.beginPath()
  pts.forEach((p, i) => (i ? ctx.lineTo(p.x * W, p.y * H) : ctx.moveTo(p.x * W, p.y * H)))
  ctx.strokeStyle = '#32D7E8'
  ctx.setLineDash([8 * k, 6 * k])
  ctx.lineWidth = 2.5 * k
  ctx.stroke()
  for (const p of pts) { ctx.beginPath(); ctx.arc(p.x * W, p.y * H, 6 * k, 0, Math.PI * 2); ctx.fillStyle = '#32D7E8'; ctx.fill() }
  ctx.restore()
}

function drawTrack(ctx: CanvasRenderingContext2D, t: Track, W: number, H: number, k: number, now: number) {
  const col = t.lost ? '#64748B' : STATE_COLOR[t.zoneState]
  const x = t.box.x * W, y = t.box.y * H, w = t.box.w * W, h = t.box.h * H
  const danger = !t.lost && (t.zoneState === 'breach' || t.zoneState === 'unresolved')
  ctx.save()

  if (danger) {
    const pulse = 0.5 + 0.5 * Math.sin(now / 120)
    ctx.fillStyle = `rgba(255,46,77,${0.08 + pulse * 0.1})`
    ctx.fillRect(x, y, w, h)
  }

  // Skeleton
  if (t.landmarks && !t.lost) {
    const lm = t.landmarks
    ctx.lineWidth = Math.max(1.5, 2.6 * k)
    ctx.strokeStyle = col
    ctx.shadowColor = col
    ctx.shadowBlur = 8 * k
    ctx.globalAlpha = 0.9
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
  ctx.shadowColor = col
  ctx.shadowBlur = (danger ? 18 : 6) * k
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
    ctx.strokeStyle = '#34D399'
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
  chip(ctx, label, x, Math.max(ly, 16 * k), k * (small ? 0.8 : 1), col, t.zoneState === 'safe' || t.lost ? '#07111C' : '#fff', color !== 'unknown' && !t.lost ? COLOR_SWATCH[color] : undefined)
  ctx.restore()
}

function chip(ctx: CanvasRenderingContext2D, text: string, x: number, yBottom: number, k: number, bg: string, fg: string, swatch?: string) {
  ctx.save()
  ctx.font = `600 ${12.5 * k}px "JetBrains Mono Variable", ui-monospace, monospace`
  const pad = 6 * k, sw = swatch ? 12 * k : 0
  const tw = ctx.measureText(text).width + pad * 2 + sw
  const h = 20 * k
  ctx.fillStyle = bg
  ctx.beginPath()
  ctx.roundRect(x, yBottom - h, tw, h, 4 * k)
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
  g.addColorStop(0, 'rgba(4,12,22,0.75)'); g.addColorStop(1, 'rgba(4,12,22,0)')
  ctx.fillStyle = g
  ctx.fillRect(0, 0, W, 70 * k)
  ctx.textBaseline = 'top'
  ctx.font = `700 ${16 * k}px "Sora Variable", system-ui, sans-serif`
  ctx.fillStyle = '#32D7E8'
  ctx.fillText('EDGEGUARD AI', 16 * k, 14 * k)
  const tw = ctx.measureText('EDGEGUARD AI').width
  ctx.font = `500 ${13 * k}px "Inter Variable", system-ui, sans-serif`
  ctx.fillStyle = 'rgba(232,246,255,0.85)'
  // Shrink-to-fit so the title never runs into the clock on narrow (portrait) footage.
  ctx.fillText(`${hud.camera} · ${hud.title}`, 28 * k + tw, 16 * k, Math.max(40 * k, W - (28 * k + tw) - 100 * k))
  ctx.font = `600 ${12 * k}px "JetBrains Mono Variable", ui-monospace, monospace`
  ctx.textAlign = 'right'
  ctx.fillText(hud.clock, W - 16 * k, 16 * k)
  // REC-style source badge
  const blink = Math.floor(now / 600) % 2 === 0
  ctx.fillStyle = blink ? '#FF4D2E' : 'rgba(255,77,46,0.4)'
  ctx.beginPath(); ctx.arc(W - 16 * k - ctx.measureText(hud.sourceLabel).width - 12 * k, 44 * k, 4 * k, 0, Math.PI * 2); ctx.fill()
  ctx.fillStyle = 'rgba(232,246,255,0.8)'
  ctx.fillText(hud.sourceLabel, W - 16 * k, 38 * k)
  ctx.textAlign = 'left'

  if (hud.subtitle) {
    ctx.font = `600 ${20 * k}px "Inter Variable", system-ui, sans-serif`
    const text = `🔊  ${hud.subtitle}`
    const tw2 = Math.min(ctx.measureText(text).width, W - 60 * k)
    const bx = (W - tw2) / 2 - 18 * k, by = H - 74 * k
    ctx.fillStyle = 'rgba(7,17,28,0.82)'
    ctx.beginPath(); ctx.roundRect(bx, by, tw2 + 36 * k, 46 * k, 10 * k); ctx.fill()
    ctx.strokeStyle = 'rgba(255,77,46,0.8)'
    ctx.lineWidth = 1.5 * k
    ctx.stroke()
    ctx.fillStyle = '#fff'
    ctx.textBaseline = 'middle'
    ctx.fillText(text, bx + 18 * k, by + 23 * k, W - 60 * k)
  }
  ctx.restore()
}
