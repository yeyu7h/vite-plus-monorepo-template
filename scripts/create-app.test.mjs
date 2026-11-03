import assert from 'node:assert/strict'
import { cp, mkdtemp, mkdir, readFile, readdir, rm, writeFile } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { basename, join } from 'node:path'
import { fileURLToPath } from 'node:url'
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
  await writeFile(join(template, '.env.rustfs'), 'SECRET_ACCESS_KEY=private\n')
  await writeFile(join(template, '.env.rustfs.example'), 'STORAGE_PROVIDER=rustfs\n')
  await writeFile(join(template, 'compose.rustfs.yaml'), 'services:\n  rustfs-init:\n    image: vite-plus-template-api\n    build:\n      dockerfile: templates/template-api/Dockerfile\n')
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
  assert.equal(await readFile(join(app, '.env.rustfs.example'), 'utf8'), 'STORAGE_PROVIDER=rustfs\n')
  assert.match(await readFile(join(app, 'compose.rustfs.yaml'), 'utf8'), /image: vite-plus-customer-api/)
  assert.match(await readFile(join(app, 'compose.rustfs.yaml'), 'utf8'), /dockerfile: apps\/customer-api\/Dockerfile/)
  assert.deepEqual(await readFile(join(app, 'favicon.ico')), Buffer.from([0, 255, 1]))
  await assert.rejects(readFile(join(app, '.env')))
  await assert.rejects(readFile(join(app, '.env.rustfs')))
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

test('the real API template includes client accounts and WeChat login with optional storage', async (t) => {
  const root = await fixture(t)
  const template = join(root, 'templates', 'template-api')
  await rm(template, { recursive: true })
  await cp(fileURLToPath(new URL('../templates/template-api/', import.meta.url)), template, {
    recursive: true,
    filter: (path) => {
      const name = basename(path)
      return !['node_modules', 'dist', 'coverage', '.env'].includes(name) && (!name.startsWith('.env.') || name.endsWith('.example'))
    },
  })
  const app = await createApp('api', 'generic-api', root)
  const packageJson = JSON.parse(await readFile(join(app, 'package.json'), 'utf8'))
  assert.equal(packageJson.name, '@app/generic-api')
  assert.equal(packageJson.dependencies['@monorepo/server-miniapp-auth'], undefined)
  assert.equal(packageJson.dependencies['alipay-sdk'], undefined)
  const envExample = await readFile(join(app, '.env.example'), 'utf8')
  assert.match(envExample, /^MINIAPP_APPS='\{\}'$/m)
  assert.match(envExample, /^CLIENT_JWT_SECRET=$/m)
  assert.match(envExample, /^STORAGE_PROVIDER=none$/m)
  assert.match(await readFile(join(app, 'src/routes/client/auth/auth.routes.ts'), 'utf8'), /微信小程序登录/)
  assert.match(await readFile(join(app, 'src/db/schema/client/users/users.ts'), 'utf8'), /client_users/)
  assert.match(await readFile(join(app, 'src/lib/services/miniapp-auth/index.ts'), 'utf8'), /api\.weixin\.qq\.com/)
  const migrations = await readdir(join(app, 'migrations'), { withFileTypes: true })
  const sqlFiles = []
  for (const migration of migrations.filter((entry) => entry.isDirectory() && /^\d/.test(entry.name))) {
    if (!(await readdir(join(app, 'migrations', migration.name))).length) continue
    const sql = await readFile(join(app, 'migrations', migration.name, 'migration.sql'), 'utf8')
    assert.doesNotMatch(sql, /DROP TABLE/)
    sqlFiles.push(sql)
  }
  const sql = sqlFiles.join('\n')
  assert.match(sql, /CREATE TABLE "system_users"/)
  assert.match(sql, /CREATE TABLE "client_users"/)
  assert.match(sql, /CREATE TABLE "client_user_identities"/)
  assert.match(sql, /CREATE TABLE "client_user_uid_counters"/)
  assert.ok(migrations.some((entry) => entry.name.endsWith('_generic-api-baseline')))
  assert.match(await readFile(join(app, 'compose.rustfs.yaml'), 'utf8'), /dockerfile: apps\/generic-api\/Dockerfile/)
  assert.match(await readFile(join(app, 'src/lib/services/object-storage/config.ts'), 'utf8'), /STORAGE_PROVIDER/)
  assert.match(await readFile(join(app, 'src/routes/public/health/health.routes.ts'), 'utf8'), /服务就绪检查/)
  assert.match(await readFile(join(app, 'Dockerfile'), 'utf8'), /\/api\/health\/ready/)
  assert.match(await readFile(join(app, 'docs/runtime.md'), 'utf8'), /STORAGE_PROVIDER=none/)
})
