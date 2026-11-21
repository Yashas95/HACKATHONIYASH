import type { EnvironmentPreset, Pt, SafetyZone } from '../types'
import type { SourceKind } from './monitor'

const key = (p: EnvironmentPreset, s: SourceKind) => `edgeguard.zone.${p.id}.${s}`

export function defaultPoints(p: EnvironmentPreset, s: SourceKind): Pt[] {
  return (s === 'webcam' ? p.webcamZone : p.defaultZone).map((q) => ({ ...q }))
}

export function loadZone(p: EnvironmentPreset, s: SourceKind): SafetyZone {
  let pts = defaultPoints(p, s)
  try {
    const raw = localStorage.getItem(key(p, s))
    const parsed = raw ? (JSON.parse(raw) as Pt[]) : null
    if (parsed && parsed.length >= 3) pts = parsed
  } catch { /* use default */ }
  return { id: `${p.id}-${s}`, label: p.zoneLabel, polygonCoordinates: pts, warningDistance: 0.06, breachConfirmationMilliseconds: 700, enabled: true }
}

export function saveZone(p: EnvironmentPreset, s: SourceKind, pts: Pt[]) {
  try { localStorage.setItem(key(p, s), JSON.stringify(pts.map((q) => ({ x: +q.x.toFixed(4), y: +q.y.toFixed(4) })))) } catch { /* ignore */ }
}
