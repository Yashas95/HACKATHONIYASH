import type { ClothingColor, EnvironmentPreset, Language } from '../types'

export const COLOR_WORDS: Record<Language, Record<Exclude<ClothingColor, 'unknown'>, string>> = {
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
        person: (c) => `Attention, person in the ${c} shirt. Please step back from the water's edge.`,
        generic: 'Attention, person near the safety boundary. Please step back from the water\'s edge.',
        group: 'Attention everyone near the shoreline. Please step back from the restricted area.',
      },
      ml: {
        person: (c) => `ശ്രദ്ധിക്കുക, ${c} ഷർട്ട് ധരിച്ച വ്യക്തി. ദയവായി കടലിൽ നിന്ന് പിന്നോട്ട് മാറുക.`,
        generic: 'ശ്രദ്ധിക്കുക, സുരക്ഷാ രേഖയ്ക്ക് സമീപമുള്ള വ്യക്തി. ദയവായി കടലിൽ നിന്ന് പിന്നോട്ട് മാറുക.',
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
        person: (c) => `Attention, person in the ${c} shirt. Please step back behind the yellow line.`,
        generic: 'Attention, person near the platform edge. Please step back behind the yellow line.',
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
        person: (c) => `Attention, person in the ${c} shirt. Please move away from the jetty edge.`,
        generic: 'Attention, person near the jetty edge. Please move away from the water.',
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

export function warningText(p: EnvironmentPreset, lang: Language, color: ClothingColor): string {
  const m = p.warningMessages[lang]
  return color === 'unknown' ? m.generic : m.person(COLOR_WORDS[lang][color])
}

/** Every message a preset can speak, for pre-caching. */
export function allWarnings(p: EnvironmentPreset, lang: Language): string[] {
  const m = p.warningMessages[lang]
  return [m.generic, m.group, ...Object.values(COLOR_WORDS[lang]).map(m.person)]
}
