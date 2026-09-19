import { createRequire } from 'node:module'
import type { IncomingMessage } from 'node:http'
import { defineConfig, loadEnv, type Plugin, type ViteDevServer } from 'vite'
import react from '@vitejs/plugin-react'
import tailwindcss from '@tailwindcss/vite'

const require = createRequire(import.meta.url)
const { sendWhatsAppFromPayload } = require('./lib/whatsapp-cloud.cjs') as {
  sendWhatsAppFromPayload: (
    payload: unknown,
    env?: NodeJS.ProcessEnv,
  ) => Promise<{ ok: boolean; status: string; message: string }>
}

function readJsonBody(req: IncomingMessage) {
  return new Promise<unknown>((resolve, reject) => {
    const chunks: Buffer[] = []
    req.on('data', (chunk) => {
      chunks.push(Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk))
    })
    req.on('end', () => {
      try {
        const raw = Buffer.concat(chunks).toString('utf8')
        resolve(raw ? JSON.parse(raw) : {})
      } catch (error) {
        reject(error)
      }
    })
    req.on('error', reject)
  })
}

function whatsappDevApi(env: Record<string, string>): Plugin {
  function attach(server: { middlewares: ViteDevServer['middlewares'] }) {
    server.middlewares.use((req, res, next) => {
      const pathname = (req.url || '').split('?')[0]
      if (pathname !== '/api/send-whatsapp') {
        next()
        return
      }
      if (req.method !== 'POST') {
        res.statusCode = 405
        res.setHeader('Content-Type', 'application/json')
        res.end(JSON.stringify({ ok: false, status: 'failed', message: 'Method not allowed' }))
        return
      }

      void readJsonBody(req)
        .then((payload) =>
          sendWhatsAppFromPayload(payload, {
            ...process.env,
            WHATSAPP_TOKEN: env.WHATSAPP_TOKEN || process.env.WHATSAPP_TOKEN,
            WHATSAPP_ACCESS_TOKEN: env.WHATSAPP_ACCESS_TOKEN || process.env.WHATSAPP_ACCESS_TOKEN,
            WHATSAPP_PHONE_NUMBER_ID: env.WHATSAPP_PHONE_NUMBER_ID || process.env.WHATSAPP_PHONE_NUMBER_ID,
            WHATSAPP_TEMPLATE_NAME: env.WHATSAPP_TEMPLATE_NAME || process.env.WHATSAPP_TEMPLATE_NAME,
            WHATSAPP_TEMPLATE_LANG: env.WHATSAPP_TEMPLATE_LANG || process.env.WHATSAPP_TEMPLATE_LANG,
            WHATSAPP_GRAPH_VERSION: env.WHATSAPP_GRAPH_VERSION || process.env.WHATSAPP_GRAPH_VERSION,
          }),
        )
        .then((result) => {
          res.statusCode = result.ok ? 200 : result.status === 'unconfigured' ? 501 : 400
          res.setHeader('Content-Type', 'application/json')
          res.end(JSON.stringify(result))
        })
        .catch((error: unknown) => {
          res.statusCode = 400
          res.setHeader('Content-Type', 'application/json')
          res.end(
            JSON.stringify({
              ok: false,
              status: 'failed',
              message: error instanceof Error ? error.message : 'WhatsApp send failed',
            }),
          )
        })
    })
  }

  return {
    name: 'whatsapp-dev-api',
    configureServer(server) {
      attach(server)
    },
    configurePreviewServer(server) {
      attach(server)
    },
  }
}

export default defineConfig(({ mode }) => {
  const env = loadEnv(mode, process.cwd(), '')
  return {
    base: process.env.ELECTRON === '1' ? './' : '/',
    envPrefix: ['VITE_', 'NEXT_PUBLIC_'],
    plugins: [react(), tailwindcss(), whatsappDevApi(env)],
  }
})
