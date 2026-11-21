import type { ClothingColor, EnvironmentPreset, Language } from '../types'

export const COLOR_WORDS: Record<'en' | 'ml', Record<Exclude<ClothingColor, 'unknown'>, string>> = {
  en: { red: 'red', blue: 'blue', green: 'green', yellow: 'yellow', black: 'black', white: 'white', grey: 'grey' },
  ml: {
    red: 'ചുവന്ന', blue: 'നീല', green: 'പച്ച', yellow: 'മഞ്ഞ',
    black: 'കറുത്ത', white: 'വെള്ള', grey: 'ചാരനിറത്തിലുള്ള',
  },
}

export const COLOR_SWATCH: Record<ClothingColor, string> = {
  red: '#ef4444', blue: '#3b82f6', green: '#22c55e', yellow: '#facc15',
  black: '#111827', white: '#f8fafc', grey: '#94a3b8', unknown: 'transparent',
}

export const PRESETS: EnvironmentPreset[] = [
  {
    id: 'beach',
    name: 'Beach Safety',
    location: 'Alappuzha Beach · North Sector',
    cameraName: 'CAM-01 Shoreline',
    zoneLabel: 'Shoreline danger zone',
    video: '/videos/beach.mp4',
    themeVariant: 'coastal',
    // Camera on the sand looking out to sea: water is the upper band.
    defaultZone: [{ x: 0, y: 0.4 }, { x: 1, y: 0.4 }, { x: 1, y: 0.825 }, { x: 0, y: 0.825 }],
    webcamZone: [{ x: 0.62, y: 0.5 }, { x: 1, y: 0.5 }, { x: 1, y: 1 }, { x: 0.62, y: 1 }],
    warningMessages: {
      en: {
        person: (c) => `Attention please, you in the ${c} shirt. Storm warning: the sea is closed. Please step back behind the yellow line.`,
        generic: 'Attention, please. Storm warning: the sea is closed. Please step back behind the yellow line.',
        group: 'Attention everyone near the shoreline. Please step back from the restricted area.',
      },
      ml: {
        person: (c) => `ശ്രദ്ധിക്കുക, ${c} ഷർട്ട് ധരിച്ച വ്യക്തി. കൊടുങ്കാറ്റ് മുന്നറിയിപ്പ്: കടലിൽ ഇറങ്ങുന്നത് നിരോധിച്ചിരിക്കുന്നു. ദയവായി മഞ്ഞ വരയ്ക്ക് പിന്നിലേക്ക് മാറുക.`,
        generic: 'ശ്രദ്ധിക്കുക. കൊടുങ്കാറ്റ് മുന്നറിയിപ്പ്: കടലിൽ ഇറങ്ങുന്നത് നിരോധിച്ചിരിക്കുന്നു. ദയവായി മഞ്ഞ വരയ്ക്ക് പിന്നിലേക്ക് മാറുക.',
        group: 'ശ്രദ്ധിക്കുക, എല്ലാവരും ദയവായി അപകടമേഖലയിൽ നിന്ന് പിന്നോട്ട് മാറുക.',
      },
    },
  },
  {
    id: 'metro',
    name: 'Platform Safety',
    location: 'Kochi Metro · Platform 1',
    cameraName: 'CAM-04 Platform Edge',
    zoneLabel: 'Platform edge',
    video: '/videos/metro.mp4',
    themeVariant: 'transit',
    defaultZone: [{ x: 0.5, y: 0.4 }, { x: 0.7, y: 0.4 }, { x: 0.445, y: 1 }, { x: 0, y: 1 }, { x: 0, y: 0.62 }],
    webcamZone: [{ x: 0.62, y: 0.5 }, { x: 1, y: 0.5 }, { x: 1, y: 1 }, { x: 0.62, y: 1 }],
    warningMessages: {
      en: {
        person: (c) => `Attention please, you in the ${c} shirt. Please step back behind the yellow line.`,
        generic: 'Attention please, you near the platform edge. Please step back behind the yellow line.',
        group: 'Attention passengers near the platform edge. Please step back behind the yellow line.',
      },
      ml: {
        person: (c) => `ശ്രദ്ധിക്കുക, ${c} ഷർട്ട് ധരിച്ച വ്യക്തി. ദയവായി മഞ്ഞ വരയ്ക്ക് പിന്നിലേക്ക് മാറി നിൽക്കുക.`,
        generic: 'ശ്രദ്ധിക്കുക, പ്ലാറ്റ്ഫോമിന്റെ അരികിലുള്ള വ്യക്തി. ദയവായി മഞ്ഞ വരയ്ക്ക് പിന്നിലേക്ക് മാറി നിൽക്കുക.',
        group: 'യാത്രക്കാരുടെ ശ്രദ്ധയ്ക്ക്, ദയവായി മഞ്ഞ വരയ്ക്ക് പിന്നിലേക്ക് മാറി നിൽക്കുക.',
      },
    },
  },
  {
    id: 'backwater',
    name: 'Backwater Jetty',
    location: 'Alappuzha Backwaters · Boat Jetty',
    cameraName: 'CAM-07 Jetty Edge',
    zoneLabel: 'Jetty edge',
    video: '/videos/backwater.mp4',
    trim: { start: 15.6, end: 18.3 }, // steady jetty shot; earlier part is a hand-held zoom
    themeVariant: 'backwater',
    // Fitted to the jetty clip: the water plus the last stretch of jetty before the stone lip.
    defaultZone: [{ x: 0.05, y: 0.42 }, { x: 1, y: 0.42 }, { x: 1, y: 1 }, { x: 0.45, y: 1 }, { x: 0.4, y: 0.8 }, { x: 0.12, y: 0.66 }],
    webcamZone: [{ x: 0.62, y: 0.5 }, { x: 1, y: 0.5 }, { x: 1, y: 1 }, { x: 0.62, y: 1 }],
    warningMessages: {
      en: {
        person: (c) => `Attention please, you in the ${c} shirt. Please move away from the jetty edge.`,
        generic: 'Attention please, you near the jetty edge. Please move away from the water.',
        group: 'Attention everyone near the jetty. Please move away from the edge.',
      },
      ml: {
        person: (c) => `ശ്രദ്ധിക്കുക, ${c} ഷർട്ട് ധരിച്ച വ്യക്തി. ദയവായി ജെട്ടിയുടെ അരികിൽ നിന്ന് മാറി നിൽക്കുക.`,
        generic: 'ശ്രദ്ധിക്കുക, ജെട്ടിയുടെ അരികിലുള്ള വ്യക്തി. ദയവായി വെള്ളത്തിൽ നിന്ന് മാറി നിൽക്കുക.',
        group: 'ശ്രദ്ധിക്കുക, എല്ലാവരും ദയവായി ജെട്ടിയുടെ അരികിൽ നിന്ന് മാറി നിൽക്കുക.',
      },
    },
  },
]

PRESETS.splice(1, 0, {
  ...PRESETS[0],
  id: 'beach2',
  name: 'Beach Safety · Wide',
  location: 'Alappuzha Beach · Sector 2',
  cameraName: 'CAM-02 Wide Shore',
  video: '/videos/beach-2.mp4',
  trim: { start: 17.5, end: 66.4 },
  // Elevated wide shot; sea on the LEFT. The yellow line sits a little inland of the foam (storm buffer).
  defaultZone: [{ x: 0, y: 0.2 }, { x: 0.41, y: 0.2 }, { x: 0.44, y: 0.4 }, { x: 0.43, y: 0.58 }, { x: 0.39, y: 0.75 }, { x: 0.35, y: 1 }, { x: 0, y: 1 }],
})

PRESETS.push({
  id: 'promenade',
  name: 'Lakeside Promenade',
  location: 'Alappuzha Backwaters · Lakeside Promenade',
  cameraName: 'CAM-09 Promenade',
  zoneLabel: 'Water edge',
  video: '/videos/backwater-2.mp4',
  themeVariant: 'backwater',
  // Water is on the LEFT in this hand-held clip; boundary follows the average kerb line.
  defaultZone: [{ x: 0, y: 0.3 }, { x: 1, y: 0.3 }, { x: 1, y: 0.4 }, { x: 0, y: 0.64 }],
  webcamZone: [{ x: 0.62, y: 0.5 }, { x: 1, y: 0.5 }, { x: 1, y: 1 }, { x: 0.62, y: 1 }],
  warningMessages: {
    en: {
      person: (c) => `Attention please, you in the ${c} shirt. Please step away from the water's edge.`,
      generic: 'Attention, person near the water\'s edge. Please step back onto the walkway.',
      group: 'Attention everyone near the water. Please step back onto the walkway.',
    },
    ml: {
      person: (c) => `ശ്രദ്ധിക്കുക, ${c} ഷർട്ട് ധരിച്ച വ്യക്തി. ദയവായി വെള്ളത്തിന്റെ അരികിൽ നിന്ന് മാറി നിൽക്കുക.`,
      generic: 'ശ്രദ്ധിക്കുക, വെള്ളത്തിന്റെ അരികിലുള്ള വ്യക്തി. ദയവായി നടപ്പാതയിലേക്ക് മാറി നിൽക്കുക.',
      group: 'ശ്രദ്ധിക്കുക, എല്ലാവരും ദയവായി വെള്ളത്തിന്റെ അരികിൽ നിന്ന് മാറി നിൽക്കുക.',
    },
  },
})

/** Hindi and Kannada are produced from the English text by Sarvam Translate (server side). */
export const sourceLang = (lang: Language): 'en' | 'ml' => (lang === 'ml' ? 'ml' : 'en')

export const LANGUAGES: { id: Language; label: string; name: string }[] = [
  { id: 'en', label: 'EN', name: 'English' },
  { id: 'ml', label: 'മലയാളം', name: 'Malayalam' },
  { id: 'hi', label: 'हिंदी', name: 'Hindi' },
  { id: 'kn', label: 'ಕನ್ನಡ', name: 'Kannada' },
]

export function warningText(p: EnvironmentPreset, lang: Language, color: ClothingColor): string {
  const l = sourceLang(lang)
  const m = p.warningMessages[l]
  return color === 'unknown' ? m.generic : m.person(COLOR_WORDS[l][color])
}

export const groupText = (p: EnvironmentPreset, lang: Language) => p.warningMessages[sourceLang(lang)].group

/** Every message a preset can speak, for pre-caching. */
export function allWarnings(p: EnvironmentPreset, lang: Language): string[] {
  const l = sourceLang(lang)
  const m = p.warningMessages[l]
  return [m.generic, m.group, ...Object.values(COLOR_WORDS[l]).map(m.person)]
}
