import type { SafetyZone, ZoneState } from '../types'
import type { Track } from './tracker'
import { distToPolygon, pointInPolygon } from './geometry'

export interface SafetyTiming {
  breachConfirmMs: number
  unresolvedMs: number
  resolveMs: number
}

export type SafetyEvent =
  | { type: 'breach'; track: Track; insideSince: number }
  | { type: 'unresolved'; track: Track; breachAt: number }
  | { type: 'resolved'; track: Track; breachAt: number }
  | { type: 'lost'; track: Track; breachAt: number }

interface Mem {
  insideSince: number | null
  outsideSince: number | null
  breachAt: number | null
  unresolved: boolean
  resolvedUntil: number
  lostReported: boolean
}

/**
 * Per-person state machine: SAFE ⇄ CAUTION → BREACH (feet inside for confirm ms)
 * → UNRESOLVED (breach held) → RESOLVED (feet outside for resolve ms) → SAFE.
 * Hysteresis on both edges prevents flicker from landmark jitter.
 */
export class SafetyEngine {
  private mem = new Map<Track, Mem>()

  update(tracks: Track[], zones: SafetyZone[], now: number, aspect: number, timing: SafetyTiming): SafetyEvent[] {
    const events: SafetyEvent[] = []
    const active = zones.filter((z) => z.enabled && z.polygonCoordinates.length >= 3)
    for (const t of tracks) {
      if (!t.confirmed) continue
      let m = this.mem.get(t)
      if (!m) { m = { insideSince: null, outsideSince: null, breachAt: null, unresolved: false, resolvedUntil: 0, lostReported: false }; this.mem.set(t, m) }

      if (t.lost) {
        if (m.breachAt && !m.lostReported) { m.lostReported = true; events.push({ type: 'lost', track: t, breachAt: m.breachAt }) }
        continue // freeze state while not visible; never invent a position
      }
      m.lostReported = false

      let inside = false, minDist = Infinity
      for (const z of active) {
        for (const p of t.footPoints) {
          if (pointInPolygon(p, z.polygonCoordinates)) inside = true
          minDist = Math.min(minDist, distToPolygon(p, z.polygonCoordinates, aspect))
        }
      }
      const warnDist = active[0]?.warningDistance ?? 0.06

      if (inside) { m.insideSince ??= now; m.outsideSince = null } else { m.outsideSince ??= now; m.insideSince = null }

      if (m.breachAt === null) {
        if (inside && now - m.insideSince! >= timing.breachConfirmMs) {
          m.breachAt = now
          events.push({ type: 'breach', track: t, insideSince: m.insideSince! })
        }
      } else {
        if (!m.unresolved && inside && now - m.breachAt >= timing.unresolvedMs) {
          m.unresolved = true
          events.push({ type: 'unresolved', track: t, breachAt: m.breachAt })
        }
        if (!inside && now - m.outsideSince! >= timing.resolveMs) {
          events.push({ type: 'resolved', track: t, breachAt: m.breachAt })
          m.breachAt = null; m.unresolved = false; m.resolvedUntil = now + 1600
        }
      }

      let s: ZoneState
      if (m.breachAt !== null) s = m.unresolved ? 'unresolved' : 'breach'
      else if (now < m.resolvedUntil) s = 'resolved'
      else if (inside || minDist < warnDist) s = 'caution' // inside-but-unconfirmed shows amber
      else s = 'safe'
      t.zoneState = s
    }
    for (const t of this.mem.keys()) if (!tracks.includes(t)) this.mem.delete(t)
    return events
  }

  clear() { this.mem.clear() }
}
