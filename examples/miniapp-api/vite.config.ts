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
  const runStorageIntegration = process.env.RUN_STORAGE_INTEGRATION === 'true'
  if (runIntegration && runStorageIntegration) throw new Error('数据库集成测试与对象存储集成测试必须分别运行')
  if (runStorageIntegration && ['TEST_STORAGE_ENDPOINT', 'TEST_STORAGE_ACCESS_KEY_ID', 'TEST_STORAGE_SECRET_ACCESS_KEY', 'TEST_STORAGE_BUCKET_NAME'].some((key) => !process.env[key]?.trim())) {
    throw new Error('对象存储集成测试必须显式提供专用 TEST_STORAGE_ENDPOINT、TEST_STORAGE_ACCESS_KEY_ID、TEST_STORAGE_SECRET_ACCESS_KEY、TEST_STORAGE_BUCKET_NAME')
  }
  if (runIntegration && (!process.env.TEST_DATABASE_URL || !process.env.TEST_REDIS_URL)) {
    throw new Error('集成测试必须显式配置专用 TEST_DATABASE_URL 和 TEST_REDIS_URL，禁止回退到默认数据库')
  }
  const testEnv = {
    NODE_ENV: 'test',
    PORT: '9999',
    LOG_LEVEL: 'silent',
    DATABASE_URL: process.env.TEST_DATABASE_URL ?? 'postgresql://postgres:postgres@localhost:5432/postgres',
    REDIS_URL: process.env.TEST_REDIS_URL ?? 'redis://localhost:6379/0',
    CLIENT_JWT_SECRET: 'test-client-jwt-secret-at-least-32-characters',
    ADMIN_JWT_SECRET: 'test-admin-jwt-secret-at-least-32-characters',
    ACCESS_KEY_ID: 'test-access-key',
    SECRET_ACCESS_KEY: 'test-secret-key',
    ENDPOINT: 'https://example.com',
    BUCKET_NAME: 'test-bucket',
    STORAGE_PROVIDER: 'r2',
    STORAGE_REGION: '',
    STORAGE_FORCE_PATH_STYLE: '',
    STORAGE_PRESIGN_ENDPOINT: '',
    STORAGE_PUBLIC_BASE_URL: '',
    TRUSTED_PROXY_IPS: 'private',
  }

  return {
    run: {
      tasks: {
        'test:integration': {
          command: 'RUN_INTEGRATION=true vp test',
          cache: false,
        },
        'test:storage': {
          command: 'RUN_STORAGE_INTEGRATION=true vp test',
          cache: false,
        },
      },
    },
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
    // Keep this workspace package and its transitive SDK resolvable after pnpm deploy relocates the app.
    ssr: {
      external: ['@monorepo/server-miniapp-auth'],
    },
    test: runStorageIntegration
      ? {
          env: {
            ...testEnv,
            STORAGE_PROVIDER: 'rustfs',
            ENDPOINT: process.env.TEST_STORAGE_ENDPOINT!,
            ACCESS_KEY_ID: process.env.TEST_STORAGE_ACCESS_KEY_ID!,
            SECRET_ACCESS_KEY: process.env.TEST_STORAGE_SECRET_ACCESS_KEY!,
            BUCKET_NAME: process.env.TEST_STORAGE_BUCKET_NAME!,
            STORAGE_PRESIGN_ENDPOINT: process.env.TEST_STORAGE_PRESIGN_ENDPOINT ?? process.env.TEST_STORAGE_ENDPOINT!,
          },
          include: ['src/lib/services/object-storage/**/*.integration.test.ts'],
        }
      : runIntegration
        ? {
            env: testEnv,
            include: ['src/**/*.integration.test.ts'],
            exclude: ['src/lib/services/object-storage/**/*.integration.test.ts'],
          }
        : {
            env: testEnv,
            include: ['src/**/*.test.ts', 'scripts/**/*.test.ts'],
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
