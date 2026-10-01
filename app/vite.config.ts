import { defineConfig, loadEnv } from 'vite'
import react from '@vitejs/plugin-react'
import tailwindcss from '@tailwindcss/vite'

// https://vite.dev/config/
export default defineConfig(({ mode }) => {
  // The repo keeps a single .env at the root, shared with Foundry.
  const env = loadEnv(mode, '..', '')
  Object.assign(process.env, env)

  return {
    envDir: '..',
    plugins: [
      react(),
      tailwindcss(),
      {
        // Runs the production API handlers in `vite dev` so funding and the
        // shared RPC relay also work locally and over the venue LAN.
        name: 'clutch-dev-api',
        configureServer(server) {
          server.middlewares.use(async (req, res, next) => {
            const apiModule = req.url?.startsWith('/api/fund')
              ? '/api/fund.ts'
              : req.url?.startsWith('/api/history')
                ? '/api/history.ts'
              : req.url?.startsWith('/api/rpc')
                ? '/api/rpc.ts'
                : null
            if (!apiModule) return next()
            try {
              const mod = await server.ssrLoadModule(apiModule)
              await mod.default(req, res)
            } catch (error) {
              res.statusCode = 500
              res.setHeader('content-type', 'application/json')
              res.end(JSON.stringify({ error: (error as Error).message }))
            }
          })
        },
      },
    ],
    // host:true so phones on the room wifi can reach the dev server.
    server: { host: true },
  }
})
