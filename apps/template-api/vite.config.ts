import type { Plugin } from 'vite-plus'
import { buildPluginNodejs, bullBoardStaticPlugin, hmrNotifyPlugin, resourceMonitorPlugin, zodHoistPlugin } from '@monorepo/server-vite-plugin'
import devServer from '@hono/vite-dev-server'
import nodeAdapter from '@hono/vite-dev-server/node'
import { defineConfig, loadEnv } from 'vite-plus'

const shutdownBarrierKey = Symbol.for('__bootstrap_shutdown_barrier__')
type GlobalWithBarrier = typeof globalThis & { [shutdownBarrierKey]?: Promise<void> }

function bootstrapDevPlugin(): Plugin {
  return {
    name: 'bootstrap-dev',
    apply: (_config, environment) => environment.command === 'serve' && environment.mode !== 'test',
    async configureServer(server) {
      const globalWithBarrier = globalThis as GlobalWithBarrier
      if (globalWithBarrier[shutdownBarrierKey]) {
        await globalWithBarrier[shutdownBarrierKey]
        globalWithBarrier[shutdownBarrierKey] = undefined
      }

      const { bootstrap, shutdown } = (await server.ssrLoadModule('/src/lib/infrastructure/bootstrap.ts')) as typeof import('./src/lib/infrastructure/bootstrap')

      await bootstrap()
      server.httpServer?.once('close', () => {
        globalWithBarrier[shutdownBarrierKey] = shutdown()
      })
    },
  }
}

export default defineConfig(({ mode }) => {
  const env = loadEnv(mode, process.cwd(), '')
  const port = Number.parseInt(env.PORT ?? '9999', 10)
  const runIntegration = process.env.RUN_INTEGRATION === 'true'
  const testEnv = {
    NODE_ENV: 'test',
    PORT: '9999',
    LOG_LEVEL: 'silent',
    DATABASE_URL: 'postgresql://postgres:postgres@localhost:5432/postgres',
    REDIS_URL: 'redis://localhost:6379/0',
    CLIENT_JWT_SECRET: 'test-client-jwt-secret-at-least-32-characters',
    ADMIN_JWT_SECRET: 'test-admin-jwt-secret-at-least-32-characters',
    ACCESS_KEY_ID: 'test-access-key',
    SECRET_ACCESS_KEY: 'test-secret-key',
    ENDPOINT: 'https://example.com',
    BUCKET_NAME: 'test-bucket',
    TRUSTED_PROXY_IPS: 'private',
  }

  return {
    server: {
      host: '0.0.0.0',
      port,
      allowedHosts: ['.trycloudflare.com'],
      hmr: {
        protocol: 'wss',
        clientPort: 443,
      },
    },
    resolve: {
      tsconfigPaths: true,
    },
    test: runIntegration
      ? {
          env: testEnv,
          include: ['src/**/*.integration.test.ts'],
        }
      : {
          env: testEnv,
          include: ['src/**/*.test.ts'],
          exclude: ['src/**/*.integration.test.ts'],
        },
    plugins: [
      bootstrapDevPlugin(),
      bullBoardStaticPlugin(),
      zodHoistPlugin(),
      hmrNotifyPlugin(),
      resourceMonitorPlugin(),
      devServer({
        entry: 'src/index.ts',
        adapter: nodeAdapter(),
      }),
      buildPluginNodejs({
        port,
        minify: false,
        gracefulShutdown: {
          module: '/src/lib/infrastructure/bootstrap.ts',
          exportName: 'shutdown',
          timeoutMs: 30000,
        },
      }),
    ],
  }
})
