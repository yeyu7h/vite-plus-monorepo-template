import assert from 'node:assert/strict'
import { mkdtemp, mkdir, readFile, rm, writeFile } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import test from 'node:test'
import { createApp } from './create-app.mjs'

async function fixture(t) {
  const root = await mkdtemp(join(tmpdir(), 'vite-plus-create-app-'))
  t.after(() => rm(root, { recursive: true, force: true }))

  const template = join(root, 'templates', 'template-api')
  await mkdir(join(template, 'src'), { recursive: true })
  await mkdir(join(template, 'node_modules'), { recursive: true })
  await mkdir(join(template, 'dist'), { recursive: true })
  await writeFile(join(template, 'package.json'), JSON.stringify({ name: '@app/template-api' }))
  await writeFile(join(template, 'Dockerfile'), 'COPY templates/template-api/dist /opt/template-api/dist\n')
  await writeFile(join(template, 'src', 'keys.ts'), "export const key = 'template-api:access-token'\n")
  await writeFile(join(template, '.env'), 'PRIVATE=secret\n')
  await writeFile(join(template, '.env.example'), 'PUBLIC=example\n')
  await writeFile(join(template, 'node_modules', 'ignored.js'), 'ignored')
  await writeFile(join(template, 'dist', 'ignored.js'), 'ignored')
  await writeFile(join(template, 'favicon.ico'), Buffer.from([0, 255, 1]))
  return root
}

test('creates a clean, renamed workspace app from a template', async (t) => {
  const root = await fixture(t)
  const app = await createApp('api', 'customer-api', root)

  assert.equal(JSON.parse(await readFile(join(app, 'package.json'), 'utf8')).name, '@app/customer-api')
  assert.equal(await readFile(join(app, 'Dockerfile'), 'utf8'), 'COPY apps/customer-api/dist /opt/customer-api/dist\n')
  assert.equal(await readFile(join(app, 'src', 'keys.ts'), 'utf8'), "export const key = 'customer-api:access-token'\n")
  assert.equal(await readFile(join(app, '.env.example'), 'utf8'), 'PUBLIC=example\n')
  assert.deepEqual(await readFile(join(app, 'favicon.ico')), Buffer.from([0, 255, 1]))
  await assert.rejects(readFile(join(app, '.env')))
  await assert.rejects(readFile(join(app, 'node_modules', 'ignored.js')))
  await assert.rejects(readFile(join(app, 'dist', 'ignored.js')))
})

test('rejects invalid names and never overwrites an existing app', async (t) => {
  const root = await fixture(t)
  await assert.rejects(createApp('api', '../outside', root), /应用名/)
  await assert.rejects(createApp('unknown', 'sample', root), /模板类型/)
  await assert.rejects(createApp('api', 'template-api', root), /重名/)
  await createApp('api', 'sample', root)
  await assert.rejects(createApp('api', 'sample', root), /已存在/)
})
