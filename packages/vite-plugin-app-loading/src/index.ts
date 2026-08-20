import type { Plugin } from 'vite-plus'

import { access, readFile } from 'node:fs/promises'
import { join } from 'node:path'
import { fileURLToPath } from 'node:url'

interface InjectAppLoadingPluginOptions {
  env?: Record<string, string | undefined>
  isBuild?: boolean
  loadingTemplate?: string
  root?: string
  themeStorageKey?: string
}

const defaultLoadingTemplatePaths = [fileURLToPath(new URL('./default-loading.html', import.meta.url)), fileURLToPath(new URL('../src/default-loading.html', import.meta.url))]

function escapeHtml(value: string) {
  return value.replaceAll('&', '&amp;').replaceAll('<', '&lt;').replaceAll('>', '&gt;').replaceAll('"', '&quot;').replaceAll("'", '&#39;')
}

async function pathExists(path: string) {
  try {
    await access(path)
    return true
  } catch {
    return false
  }
}

async function readDefaultLoadingHtml() {
  for (const path of defaultLoadingTemplatePaths) {
    if (await pathExists(path)) return readFile(path, 'utf8')
  }

  throw new Error('Could not find the bundled default-loading.html template')
}

async function readPackageInfo(root: string) {
  try {
    const packageJson = JSON.parse(await readFile(join(root, 'package.json'), 'utf8')) as { name?: unknown; version?: unknown }

    return {
      name: typeof packageJson.name === 'string' ? packageJson.name : undefined,
      version: typeof packageJson.version === 'string' ? packageJson.version : undefined,
    }
  } catch {
    return {}
  }
}

/**
 * Injects the first-paint loading UI into index.html before application scripts run.
 * An app can override the bundled template by adding `loading.html` to its root.
 */
async function viteInjectAppLoadingPlugin(options: InjectAppLoadingPluginOptions = {}): Promise<Plugin> {
  const root = options.root ?? process.cwd()
  const env = options.env ?? {}
  const appTemplate = join(root, options.loadingTemplate ?? 'loading.html')
  const template = (await pathExists(appTemplate)) ? await readFile(appTemplate, 'utf8') : await readDefaultLoadingHtml()
  const packageInfo = await readPackageInfo(root)
  const title = env.VITE_APP_TITLE?.trim() || 'Vite App'
  const namespace = env.VITE_APP_NAMESPACE?.trim() || packageInfo.name || 'app'
  const version = packageInfo.version || '0.0.0'
  const environment = options.isBuild ? 'prod' : 'dev'
  const themeStorageKey = options.themeStorageKey?.trim() || `${namespace}-${version}-${environment}-preferences-theme`
  const serializedThemeStorageKey = JSON.stringify(themeStorageKey).replaceAll('<', '\\u003c')
  const loadingHtml = template.replaceAll('<%= VITE_APP_TITLE %>', escapeHtml(title))
  const injectScript = `
    <script data-app-loading="inject-js">
      var appLoadingTheme;
      try {
        appLoadingTheme = localStorage.getItem(${serializedThemeStorageKey});
      } catch {}

      var appLoadingSystemDark =
        typeof window.matchMedia === 'function' &&
        window.matchMedia('(prefers-color-scheme: dark)').matches;
      var appLoadingIsDark =
        /dark/.test(appLoadingTheme || '') ||
        (!/light/.test(appLoadingTheme || '') && appLoadingSystemDark);

      document.documentElement.classList.toggle('dark', appLoadingIsDark);
    </script>
  `

  return {
    enforce: 'pre',
    name: 'vite:inject-app-loading',
    transformIndexHtml: {
      handler(html) {
        const htmlWithTheme = html.replace(/<head(?:\s[^>]*)?>/i, (headTag) => `${headTag}${injectScript}`)

        return htmlWithTheme.replace(/<body(?:\s[^>]*)?>/i, (bodyTag) => `${bodyTag}${loadingHtml}`)
      },
      order: 'pre',
    },
  }
}

export { viteInjectAppLoadingPlugin }
export type { InjectAppLoadingPluginOptions }
