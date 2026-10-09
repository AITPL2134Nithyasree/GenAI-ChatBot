import react from '@vitejs/plugin-react'
import { defineConfig } from 'vite'

const CANDIDATES = ['http://localhost:8001', 'http://localhost:8000']

/** Find the port our FastAPI backend is on. Our /api/health reports `api_key_configured`,
 *  which tells it apart from any other app that happens to use the same port. */
async function findBackend(): Promise<string> {
  if (process.env.API_PROXY_TARGET) return process.env.API_PROXY_TARGET
  for (const url of CANDIDATES) {
    try {
      const res = await fetch(`${url}/api/health`, { signal: AbortSignal.timeout(800) })
      const body = (await res.json()) as Record<string, unknown>
      if (res.ok && 'api_key_configured' in body) return url
    } catch {
      /* not listening */
    }
  }
  return CANDIDATES[0]
}

// https://vite.dev/config/
export default defineConfig(async () => {
  const target = await findBackend()
  console.log(`[api proxy] /api -> ${target}`)
  return {
    plugins: [react()],
    server: {
      port: 5173,
      proxy: {
        '/api': { target, changeOrigin: true },
      },
    },
  }
})
