import { defineConfig, loadEnv } from 'vite'
import react from '@vitejs/plugin-react'

const requireProxyTarget = (raw: string | undefined): string => {
  const value = (raw ?? '').trim()
  if (!value) {
    throw new Error(
      'BACKEND_PROXY_TARGET is required for the Vite dev server. ' +
        'Set it in .env / .env.local (e.g. BACKEND_PROXY_TARGET=http://127.0.0.1:8000).',
    )
  }

  let parsed: URL
  try {
    parsed = new URL(value)
  } catch {
    throw new Error(
      `BACKEND_PROXY_TARGET must be a valid absolute URL. Received: ${JSON.stringify(value)}`,
    )
  }

  if (parsed.protocol !== 'http:' && parsed.protocol !== 'https:') {
    throw new Error(
      `BACKEND_PROXY_TARGET must use http: or https:. Received: ${JSON.stringify(value)}`,
    )
  }

  return value.replace(/\/+$/, '')
}

// https://vite.dev/config/
export default defineConfig(({ mode, command }) => {
  const env = loadEnv(mode, process.cwd(), 'BACKEND_')

  const server =
    command === 'serve'
      ? {
          host: '0.0.0.0' as const,
          port: 5173,
          proxy: {
            '/api': {
              target: requireProxyTarget(env.BACKEND_PROXY_TARGET),
              changeOrigin: true,
            },
          },
        }
      : undefined

  return {
    plugins: [react()],
    server,
  }
})
