import react from '@vitejs/plugin-react'
import tailwindcss from '@tailwindcss/vite'
import { defineConfig, loadEnv } from 'vite'
import { sarvamTtsProxy } from './server/tts-proxy.ts'
import { devSaveAnalysis } from './server/dev-save.ts'

export default defineConfig(({ mode }) => {
  // '' prefix: load non-VITE_ vars too. They stay on the Node side only.
  const env = loadEnv(mode, process.cwd(), '')
  return {
    plugins: [
      react(),
      tailwindcss(),
      devSaveAnalysis('public/analysis'),
      sarvamTtsProxy({
        apiKey: env.SARVAM_API_KEY,
        // bulbul:v3 is the Sarvam model with Malayalam voices; v4-flash has no ml personas.
        model: env.SARVAM_MODEL || 'bulbul:v3',
        speakers: {
          en: env.SARVAM_SPEAKER_EN || 'pooja',
          ml: env.SARVAM_SPEAKER_ML || 'pooja',
          hi: env.SARVAM_SPEAKER_HI || 'pooja',
          kn: env.SARVAM_SPEAKER_KN || 'pooja',
        },
        cacheDir: '.tts-cache',
      }),
    ],
  }
})
