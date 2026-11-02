// @vitest-environment happy-dom
import { afterEach, describe, expect, test, vi } from 'vite-plus/test'
import { createApp, h, nextTick, ref } from 'vue'
import NuxtUI from '@nuxt/ui/vue-plugin'
import UApp from '@nuxt/ui/components/App.vue'

import RoleApiPermissionEditor from './RoleApiPermissionEditor.vue'
import { buildSaveRolePermissions } from './helpers'
import type { RolePermissionInput } from './helpers'

vi.mock('@nuxt/ui/runtime/vue/components/Icon.vue', async () => ({ default: (await import('vue')).defineComponent({ inheritAttrs: false, setup: () => () => null }) }))

const mounted: Array<() => void> = []
afterEach(() => mounted.splice(0).forEach((unmount) => unmount()))

async function renderEditor(editable = true) {
  const direct = ref<RolePermissionInput[]>([{ resource: '/legacy/*', action: 'GET|POST' }])
  const inherited = [{ resource: '/inherited/*', action: 'GET' }]
  const host = document.createElement('div')
  document.body.append(host)
  const app = createApp({
    setup: () => () =>
      h(
        UApp,
        {},
        {
          default: () =>
            h(RoleApiPermissionEditor, {
              modelValue: direct.value,
              'onUpdate:modelValue': (value: RolePermissionInput[]) => {
                direct.value = value
              },
              catalog: [{ resource: '/system/users', action: 'GET', summary: '获取用户列表' }],
              inheritedPermissions: inherited,
              editable,
              copyRoleOptions: [],
            }),
        },
      ),
  })
  app.use(NuxtUI)
  app.mount(host)
  mounted.push(() => {
    app.unmount()
    host.remove()
  })
  await nextTick()
  return { host, direct }
}

function button(host: HTMLElement, label: string) {
  const result = Array.from(host.querySelectorAll('button')).find((item) => item.textContent?.trim() === label)
  expect(result).toBeDefined()
  return result!
}

describe('RoleApiPermissionEditor', () => {
  test('shows and retains custom direct and inherited rules while selecting the catalog', async () => {
    const { host, direct } = await renderEditor()
    expect(host.textContent).toContain('/legacy/*')
    expect(host.textContent).toContain('/inherited/*')
    button(host, '全选接口目录').click()
    await nextTick()
    expect(buildSaveRolePermissions(direct.value)).toEqual([
      ['/legacy/*', 'GET|POST'],
      ['/system/users', 'GET'],
    ])
    expect(host.querySelector('[aria-label="移除 GET /inherited/*"]')).toBeNull()
  })

  test('removes a custom direct rule only after explicit removal', async () => {
    const { host, direct } = await renderEditor()
    host.querySelector<HTMLButtonElement>('[aria-label="移除 GET|POST /legacy/*"]')!.click()
    await nextTick()
    expect(buildSaveRolePermissions(direct.value)).toEqual([])
    expect(host.textContent).not.toContain('/legacy/*')
    expect(host.textContent).toContain('/inherited/*')
  })

  test('searching custom rules does not change the save payload', async () => {
    const { host, direct } = await renderEditor()
    const input = host.querySelector<HTMLInputElement>('input[placeholder="搜索资源路径或 HTTP 方法"]')!
    input.value = 'inherited'
    input.dispatchEvent(new Event('input', { bubbles: true }))
    await nextTick()
    expect(host.textContent).not.toContain('/legacy/*')
    expect(host.textContent).toContain('/inherited/*')
    expect(buildSaveRolePermissions(direct.value)).toEqual([['/legacy/*', 'GET|POST']])
  })

  test('keeps both kinds of custom rules visible in read-only mode', async () => {
    const { host, direct } = await renderEditor(false)
    expect(host.textContent).toContain('/legacy/*')
    expect(host.textContent).toContain('/inherited/*')
    expect(host.querySelector('[aria-label^="移除 "]')).toBeNull()
    expect(buildSaveRolePermissions(direct.value)).toEqual([['/legacy/*', 'GET|POST']])
  })
})
