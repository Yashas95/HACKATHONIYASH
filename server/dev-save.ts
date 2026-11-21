// Dev-only: lets the app write a finished clip analysis to public/analysis/<name>.json,
// so it ships as a static file and loads instantly on every machine and on Vercel.
import type { Plugin } from 'vite'
import { mkdirSync, writeFileSync } from 'node:fs'
import { join } from 'node:path'

export function devSaveAnalysis(dir: string): Plugin {
  return {
    name: 'dev-save-analysis',
    apply: 'serve',
    configureServer(server) {
      mkdirSync(dir, { recursive: true })
      server.middlewares.use(async (req, res, next) => {
        if (!req.url?.startsWith('/api/save-analysis') || req.method !== 'POST') return next()
        const name = new URL(req.url, 'http://x').searchParams.get('name') ?? ''
        if (!/^[a-z0-9._-]{1,120}$/i.test(name)) { res.statusCode = 400; return res.end('bad name') }
        let raw = ''
        for await (const chunk of req) raw += chunk
        writeFileSync(join(dir, `${name}.json`), raw)
        res.statusCode = 204
        res.end()
      })
    },
  }
}
