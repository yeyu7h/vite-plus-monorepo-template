// @vitest-environment happy-dom
import { afterEach, beforeEach, expect, test, vi } from 'vite-plus/test'
import { createApp, h, nextTick } from 'vue'
import { QueryClient, VueQueryPlugin } from '@tanstack/vue-query'
import NuxtUI from '@nuxt/ui/vue-plugin'
import UApp from '@nuxt/ui/components/App.vue'

import type { SystemRoleApi } from '@/api/core/system'
import RolePage from './role.vue'

const requests = vi.hoisted(() => ({
  list: vi.fn<() => Promise<{ items: SystemRoleApi.Item[]; total: number }>>(),
  getMenus: vi.fn<() => Promise<SystemRoleApi.MenuAuthorization>>(),
  getPermissions: vi.fn<() => Promise<SystemRoleApi.PermissionResult>>(),
  savePermissions: vi.fn<(id: string, body: SystemRoleApi.SavePermissionsBody) => Promise<SystemRoleApi.SavePermissionsResult>>(),
}))
vi.mock('@/api/core/system', () => ({ systemRoleApi: requests }))
vi.mock('@/stores/access', () => ({ useAdminAccessStore: () => ({ sessionVersion: 1, isLoggedIn: true, hasPermission: () => true }) }))
vi.mock('@/stores/user', () => ({ useAdminUserStore: () => ({ roles: ['admin'] }) }))
vi.mock('@/composables/useConfirm', () => ({ useConfirm: () => async () => true }))
vi.mock('@nuxt/ui/runtime/vue/components/Icon.vue', async () => ({ default: (await import('vue')).defineComponent({ inheritAttrs: false, setup: () => () => null }) }))
vi.mock('@/components/AdminTable.vue', async () => {
  const { defineComponent, h } = await import('vue')
  return {
    default: defineComponent({
      props: ['data'],
      setup:
        (props, { slots }) =>
        () =>
          h(
            'div',
            (props.data as SystemRoleApi.Item[]).map((item) => slots['actions-cell']?.({ row: { original: item } })),
          ),
    }),
  }
})
vi.mock('@/components/FormSlideover.vue', async () => {
  const { defineComponent, h } = await import('vue')
  return {
    default: defineComponent({
      inheritAttrs: false,
      props: { open: Boolean },
      setup:
        (props, { slots }) =>
        () =>
          props.open ? h('section', [slots.body?.({ formId: 'role-editor' }), slots.footer?.({ formId: 'role-editor', close: () => undefined })]) : null,
    }),
  }
})
vi.mock('@nuxt/ui/components/Tabs.vue', async () => {
  const { defineComponent, h } = await import('vue')
  return {
    default: defineComponent({
      props: ['modelValue', 'items'],
      emits: ['update:modelValue'],
      setup:
        (props, { emit, slots }) =>
        () =>
          h('div', [...(props.items as Array<{ label: string; value: string }>).map((item) => h('button', { onClick: () => emit('update:modelValue', item.value) }, item.label)), slots.content?.()]),
    }),
  }
})

let unmount: (() => void) | undefined
afterEach(() => {
  unmount?.()
  vi.unstubAllGlobals()
})

beforeEach(() => {
  vi.stubGlobal('definePage', () => undefined)
  vi.clearAllMocks()
  requests.list.mockResolvedValue({
    items: [{ id: 'operator', name: '操作员', description: null, status: 'ENABLED', parentRoles: [], createdAt: null, createdBy: null, updatedAt: null, updatedBy: null }],
    total: 1,
  })
  requests.getMenus.mockResolvedValue({ roleId: 'operator', readOnly: false, menuIds: [], directMenuIds: [], inheritedMenuIds: [], tree: [] })
  requests.getPermissions.mockResolvedValue({
    permissions: [
      { resource: '/legacy/*', action: String.raw`GET|\w+`, sourceRoleId: 'operator', direct: true, inherited: false },
      { resource: '/system/users', action: 'GET', sourceRoleId: 'operator', direct: true, inherited: false },
    ],
    catalog: [{ resource: '/system/users', action: 'GET', summary: '用户列表', group: '用户管理' }],
    groupings: [],
  })
  requests.savePermissions.mockResolvedValue({ added: 2, removed: 2, total: 2 })
})

test('opening and saving a role preserves its custom path and method regex', async () => {
  const host = document.createElement('div')
  document.body.append(host)
  const queryClient = new QueryClient({ defaultOptions: { queries: { retry: false } } })
  const app = createApp({ render: () => h(UApp, {}, { default: () => h(RolePage) }) })
  app.use(VueQueryPlugin, { queryClient })
  app.use(NuxtUI)
  unmount = () => {
    app.unmount()
    queryClient.clear()
    host.remove()
  }
  app.mount(host)

  function button(label: string) {
    return Array.from(host.querySelectorAll('button')).find((item) => item.textContent?.trim() === label)
  }
  await expect.poll(() => button('编辑')).toBeDefined()
  button('编辑')!.click()
  await expect.poll(() => requests.getPermissions.mock.calls.length).toBe(1)
  button('API 权限')!.click()
  await expect.poll(() => host.textContent).toContain('/legacy/*')
  button('保存 API 权限')!.click()
  await expect.poll(() => requests.savePermissions.mock.calls.length).toBe(1)
  expect(requests.savePermissions).toHaveBeenCalledWith('operator', {
    permissions: [
      ['/legacy/*', String.raw`GET|\w+`],
      ['/system/users', 'GET'],
    ],
  })
  await nextTick()
})
