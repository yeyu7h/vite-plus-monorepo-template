/**
 * https://github.com/honojs/vite-plugins
 */
import type { Plugin } from 'vite-plus'

import type { BuildOptions } from './base.ts'

import buildPlugin from './base.ts'
import { serveStaticHook } from './entry/server-static.ts'

export type NodeBuildOptions = {
  staticRoot?: string | undefined
  port?: number | undefined
  /**
   * Enable graceful shutdown on SIGINT and SIGTERM signals.
   * Set to a number to specify the timeout in milliseconds before forcing shutdown.
   * Set to 0 to wait indefinitely for connections to close.
   * Leave undefined to disable graceful shutdown.
   * @default undefined
   */
  gracefulShutdown?: {
    module: string
    exportName?: string
    timeoutMs?: number
  }
  /**
   * Whether to wrap the original app with mainApp
   * When enabled, creates a Hono instance to wrap the original app for Edge Runtime compatibility
   * 是否使用 mainApp 包装原始 app
   * 启用后会创建一个 Hono 实例包装原始 app，兼容 Edge Runtime
   * @default false
   */
  wrapWithMainApp?: boolean | undefined
} & BuildOptions

const nodeBuildPlugin = (pluginOptions?: NodeBuildOptions): Plugin => {
  const port = pluginOptions?.port ?? 3000
  const gracefulShutdown = pluginOptions?.gracefulShutdown
  const shutdownTimeoutMs = gracefulShutdown?.timeoutMs ?? 30000
  const wrapWithMainApp = pluginOptions?.wrapWithMainApp ?? false

  return {
    ...buildPlugin({
      wrapWithMainApp,
      entryContentBeforeHooks: [
        async (appName, options) => {
          const staticPaths = options?.staticPaths ?? []
          if (staticPaths.length === 0) return ''
          let code = "import { serveStatic } from '@hono/node-server/serve-static'\n"
          code += serveStaticHook(appName, {
            filePaths: staticPaths,
            root: pluginOptions?.staticRoot,
          })
          return code
        },
      ],
      entryContentAfterHooks: [
        async (appName) => {
          let code = "import { serve } from '@hono/node-server'\n"
          const portCode = `process.env.PORT ? parseInt(process.env.PORT, 10) : ${port}`
          if (gracefulShutdown) {
            code += `import { ${gracefulShutdown.exportName ?? 'shutdown'} as bootstrapShutdown } from '${gracefulShutdown.module}'\n`
            code += `const server = serve({ fetch: ${appName}.fetch, port: ${portCode} })\n`
            code += 'let isShuttingDown = false\n'
            code += 'const gracefulShutdownHandler = async () => {\n'
            code += '  if (isShuttingDown) return\n'
            code += '  isShuttingDown = true\n'
            if (shutdownTimeoutMs > 0) {
              code += `  const forceExitTimer = setTimeout(() => {\n`
              code += `    console.error('[服务]: 优雅关闭超时，强制退出')\n`
              code += `    process.exit(1)\n`
              code += `  }, ${shutdownTimeoutMs})\n`
            }
            code += '  try {\n'
            code += "    console.log('[服务]: 收到关闭信号，开始优雅关闭')\n"
            code += '    await new Promise((resolve) => {\n'
            code += '      const closeTimeout = setTimeout(() => {\n'
            code += "        console.error('[服务]: 等待请求完成超时，继续关闭资源')\n"
            code += '        resolve()\n'
            code += '      }, 10000)\n'
            code += '      server.close((err) => {\n'
            code += '        clearTimeout(closeTimeout)\n'
            code += "        if (err) console.error('[服务]: 服务器关闭出错', err)\n"
            code += "        console.log('[服务]: 所有请求已完成')\n"
            code += '        resolve()\n'
            code += '      })\n'
            code += '    })\n'
            code += '    await bootstrapShutdown()\n'
            code += "    console.log('[服务]: 优雅关闭完成')\n"
            if (shutdownTimeoutMs > 0) {
              code += `    clearTimeout(forceExitTimer)\n`
            }
            code += '    process.exit(0)\n'
            code += '  } catch (error) {\n'
            code += "    console.error('[服务]: 资源清理失败', error)\n"
            if (shutdownTimeoutMs > 0) {
              code += `    clearTimeout(forceExitTimer)\n`
            }
            code += '    process.exit(1)\n'
            code += '  }\n'
            code += '}\n'
            code += "process.on('SIGINT', gracefulShutdownHandler)\n"
            code += "process.on('SIGTERM', gracefulShutdownHandler)\n"
          } else {
            code += `serve({ fetch: ${appName}.fetch, port: ${portCode} })\n`
          }
          code += `console.log('[服务]: 启动成功, 端口:', ${portCode})`
          return code
        },
      ],
      ...pluginOptions,
    }),
    name: '@hono/vite-build/node',
  }
}

export default nodeBuildPlugin
