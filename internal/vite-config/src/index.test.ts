import { mkdtemp, rm, writeFile } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { pathToFileURL } from 'node:url'
import { afterEach, describe, expect, it } from 'vite-plus/test'
import type { Plugin, PluginOption } from 'vite-plus'
import { defineAdminConfig } from './index'

const roots: string[] = []

async function fixture(title: string) {
  const root = await mkdtemp(join(tmpdir(), 'admin-vite-config-'))
  roots.push(root)
  await writeFile(join(root, 'package.json'), JSON.stringify({ name: 'fixture-admin', version: '1.2.3' }))
  await writeFile(join(root, '.env.production'), `VITE_APP_TITLE=${title}\nVITE_GLOB_API_URL=/fixture-api\nPRIVATE_TOKEN=hidden\n`)
  await writeFile(join(root, 'loading.html'), '<div data-loading><%= VITE_APP_TITLE %></div>')
  return root
}

async function plugins(options: PluginOption[] = []): Promise<Plugin[]> {
  const result: Plugin[] = []
  for (const option of options) {
    const resolved = await option
    if (Array.isArray(resolved)) result.push(...(await plugins(resolved)))
    else if (resolved) result.push(resolved)
  }
  return result
}

afterEach(async () => {
  await Promise.all(roots.splice(0).map((root) => rm(root, { recursive: true, force: true })))
})

describe('defineAdminConfig', () => {
  it('loads each application environment and loading template from its explicit root', async () => {
    for (const title of ['First admin', 'Second admin']) {
      const root = await fixture(title)
      const config = await defineAdminConfig({
        root: pathToFileURL(`${root}/`),
        loading: { themeStorageKey: 'fixture-theme' },
        vite: async (context) => {
          expect(context).toMatchObject({ root: `${root}/`, command: 'build', mode: 'production' })
          expect(context.env).toMatchObject({ VITE_APP_TITLE: title, VITE_GLOB_API_URL: '/fixture-api' })
          expect(context.env).not.toHaveProperty('PRIVATE_TOKEN')
          return { base: '/admin/' }
        },
      })({ command: 'build', mode: 'production' })
      expect(config.base).toBe('/admin/')
      expect(config.resolve?.alias).toEqual({ '@': join(root, 'src'), '#': join(root, 'src/types') })
      const registered = await plugins(config.plugins)
      expect(registered.map((plugin) => plugin.name)).toContain('vite:inject-app-config')
      const loading = registered.find((plugin) => plugin.name === 'vite:inject-app-loading')
      const hook = loading?.transformIndexHtml as { handler: (html: string) => string }
      const html = hook.handler('<html><head></head><body></body></html>')
      expect(html).toContain(`<div data-loading>${title}</div>`)
      expect(html).toContain('fixture-theme')
    }
  })

  it('merges application overrides without losing defaults and appends custom plugins', async () => {
    const root = await fixture('Development')
    const config = await defineAdminConfig({
      root,
      vite: {
        server: { port: 4321, proxy: { '/api': 'http://localhost:9999' } },
        resolve: { alias: { '~': join(root, 'extra') }, dedupe: ['pinia'] },
        plugins: [{ name: 'fixture-extra' }],
      },
    })({ command: 'serve', mode: 'development' })
    expect(config.root).toBe(root)
    expect(config.server).toMatchObject({ host: '0.0.0.0', port: 4321, proxy: { '/api': 'http://localhost:9999' } })
    expect(config.resolve?.alias).toEqual({ '@': join(root, 'src'), '#': join(root, 'src/types'), '~': join(root, 'extra') })
    expect(config.resolve?.dedupe).toEqual(['vue', 'vue-router', 'pinia'])
    const names = (await plugins(config.plugins)).map((plugin) => plugin.name)
    expect(names).not.toContain('vite:inject-app-config')
    expect(names).toContain('vite:inject-app-loading')
    expect(names.indexOf('vite:inject-app-loading')).toBeLessThan(names.indexOf('vite:vue'))
    expect(names).toContain('vite:vue')
    expect(names.at(-1)).toBe('fixture-extra')
  })

  it('rejects roots whose meaning would depend on the command working directory', () => {
    expect(() => defineAdminConfig({ root: './apps/admin' })).toThrow('requires an absolute application root')
  })
})
