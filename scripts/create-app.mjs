import { cp, lstat, mkdir, mkdtemp, readFile, readdir, rename, rm, writeFile } from 'node:fs/promises'
import { join, relative, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'

const workspaceRoot = fileURLToPath(new URL('../', import.meta.url))
const templateKinds = ['admin', 'web', 'api']
const omittedNames = new Set(['node_modules', 'dist', 'dist-ssr', 'coverage', '.git', '.vite', '.DS_Store', '.env', 'auto-imports.d.ts', 'components.d.ts', 'typed-router.d.ts'])
const decoder = new TextDecoder('utf-8', { fatal: true })

function shouldCopy(sourceRoot, path) {
  const parts = relative(sourceRoot, path).split(/[/\\]/).filter(Boolean)
  return !parts.some((part) => omittedNames.has(part) || part.endsWith('.tsbuildinfo') || /^\.env\..*\.local$/.test(part))
}

async function replaceTemplateNames(directory, kind, name) {
  const sourceName = `template-${kind}`
  const substitutions = [
    [`templates/${sourceName}`, `apps/${name}`],
    [`apps/${sourceName}`, `apps/${name}`],
    [`@app/${sourceName}`, `@app/${name}`],
    [sourceName, name],
  ]

  for (const entry of await readdir(directory, { withFileTypes: true })) {
    const path = join(directory, entry.name)
    if (entry.isDirectory()) {
      await replaceTemplateNames(path, kind, name)
      continue
    }
    if (!entry.isFile()) continue

    const bytes = await readFile(path)
    if (bytes.includes(0)) continue

    let content
    try {
      content = decoder.decode(bytes)
    } catch {
      continue
    }

    const updated = substitutions.reduce((value, [from, to]) => value.replaceAll(from, to), content)
    if (updated !== content) await writeFile(path, updated)
  }
}

export async function createApp(kind, name, root = workspaceRoot) {
  if (!templateKinds.includes(kind)) throw new Error(`模板类型必须是 ${templateKinds.join('、')}`)
  if (!/^[a-z][a-z0-9]*(?:-[a-z0-9]+)*$/.test(name ?? '')) throw new Error('应用名只能使用小写字母、数字和连字符，且必须以字母开头')
  if (templateKinds.some((type) => name === `template-${type}`)) throw new Error('应用名不能与现有模板包重名')

  const source = join(root, 'templates', `template-${kind}`)
  const apps = join(root, 'apps')
  const destination = join(apps, name)

  try {
    await lstat(destination)
    throw new Error(`目标目录已存在：${relative(root, destination)}`)
  } catch (error) {
    if (error.code !== 'ENOENT') throw error
  }

  await mkdir(apps, { recursive: true })
  const staging = await mkdtemp(join(apps, '.create-app-'))

  try {
    const stagedApp = join(staging, name)
    await cp(source, stagedApp, { recursive: true, filter: (path) => shouldCopy(source, path) })
    await replaceTemplateNames(stagedApp, kind, name)
    await rename(stagedApp, destination)
  } finally {
    await rm(staging, { recursive: true, force: true })
  }

  return destination
}

if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  const args = process.argv.slice(2)
  if (args[0] === '--') args.shift()
  const [kind, name] = args

  if (kind === '--list') {
    console.log(templateKinds.join('\n'))
  } else if (!kind || !name || args.length !== 2) {
    console.error(`用法：vp run create:app -- <${templateKinds.join('|')}> <app-name>`)
    process.exitCode = 1
  } else {
    try {
      const destination = await createApp(kind, name)
      console.log(`已创建 ${relative(workspaceRoot, destination)}（@app/${name}）`)
      console.log(`下一步：vp install && vp run @app/${name}#dev`)
    } catch (error) {
      console.error(error.message)
      process.exitCode = 1
    }
  }
}
