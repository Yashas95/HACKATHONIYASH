// All coordinates are normalized display coordinates (0..1), i.e. already
// mirrored when the webcam is shown mirrored. Zones live in the same space.
export type Pt = { x: number; y: number }
export type Box = { x: number; y: number; w: number; h: number }

export type ClothingColor =
  | 'red' | 'blue' | 'green' | 'yellow' | 'black' | 'white' | 'grey' | 'unknown'

export type ZoneState = 'safe' | 'caution' | 'breach' | 'unresolved' | 'resolved'

/** en/ml use hand-written text; hi/kn are translated from English by Sarvam Translate on the server. */
/** friendly: compliments the outfit to get attention; formal: plain public-address wording. */
export type Tone = 'friendly' | 'formal'

export type Language = 'en' | 'ml' | 'hi' | 'kn'

/** One raw detection for the current frame (before tracking). */
export interface Detection {
  box: Box
  score: number
  /** 33 MediaPipe pose landmarks in display space, if a skeleton was matched. */
  landmarks?: Landmark[]
}
export type Landmark = { x: number; y: number; v: number }

export interface TrackedPerson {
  id: string
  box: Box
  landmarks?: Landmark[]
  trackingConfidence: number
  approximateClothingColor: ClothingColor
  /** Points used for zone tests (visible feet, or box bottom-centre). */
  footPoints: Pt[]
  footSource: 'pose' | 'box'
  currentPosition: Pt
  zoneState: ZoneState
  firstObservedAt: number
  lastObservedAt: number
  lastWarningAt: number
  hits: number
  confirmed: boolean
  lost: boolean
}

export interface SafetyZone {
  id: string
  label: string
  polygonCoordinates: Pt[]
  /** Caution band around the polygon, as a fraction of frame height. */
  warningDistance: number
  breachConfirmationMilliseconds: number
  enabled: boolean
}

export type IncidentStatus = 'active' | 'person-returned' | 'tracking-lost' | 'resolved' | 'dismissed'

export interface Incident {
  id: string
  personSessionId: string
  cameraLocation: string
  zoneLabel: string
  incidentType: 'unresolved-breach'
  description: string
  clothing: ClothingColor
  detectedAt: number
  breachStartedAt: number
  resolvedAt?: number
  status: IncidentStatus
  acknowledged: boolean
  acknowledgedAt?: number
  warningIssued: boolean
  warningText?: string
  timeline: { t: number; text: string }[]
}

export interface EnvironmentPreset {
  id: 'beach' | 'beach2' | 'metro' | 'backwater' | 'promenade'
  name: string
  location: string
  cameraName: string
  defaultZone: Pt[]
  webcamZone: Pt[]
  zoneLabel: string
  video: string
  /** Optional usable range of the clip in seconds (e.g. to skip a camera zoom). */
  trim?: { start: number; end: number }
  warningMessages: Record<'en' | 'ml', { person: (color: string) => string; generic: string; group: string }>
  friendlyMessages: Record<'en' | 'ml', { person: (color: string) => string; generic: string; group: string }>
  themeVariant: 'coastal' | 'transit' | 'backwater'
}
