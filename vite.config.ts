import react from '@vitejs/plugin-react'
import tailwindcss from '@tailwindcss/vite'
import { defineConfig, loadEnv } from 'vite'
import { sarvamTtsProxy } from './server/tts-proxy.ts'

export default defineConfig(({ mode }) => {
  // '' prefix: load non-VITE_ vars too. They stay on the Node side only.
  const env = loadEnv(mode, process.cwd(), '')
  return {
    plugins: [
      react(),
      tailwindcss(),
      sarvamTtsProxy({
        apiKey: env.SARVAM_API_KEY,
        // bulbul:v3 is the Sarvam model with Malayalam voices; v4-flash has no ml personas.
        model: env.SARVAM_MODEL || 'bulbul:v3',
        speakerEn: env.SARVAM_SPEAKER_EN || 'pooja',
        speakerMl: env.SARVAM_SPEAKER_ML || 'pooja',
        cacheDir: '.tts-cache',
      }),
    ],
  }
})
