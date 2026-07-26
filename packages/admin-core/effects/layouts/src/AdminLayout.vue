<script setup lang="ts">
import { Layout } from '@monorepo-admin-core/layout-ui'
import type { LayoutType } from '@monorepo-admin-core/types'
import { computed } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import { LayoutTabbar } from './basic/tabbar'
import { LayoutMenu } from './basic/menu'
import { IFrameRouterView } from './iframe'
import { buildAdminBreadcrumbPrefix, buildAdminBreadcrumbs } from './navigation/route-breadcrumb'
import type { AdminCurrentRouteRecord } from './navigation/route-breadcrumb'
import { buildAdminMenuGroups, markActiveAdminMenuGroups } from './navigation/route-menu'
import type { AdminMenuGroup, AdminNavigationRouteRecord, AdminRouteMeta } from '@monorepo-admin-core/types'

const props = defineProps<{
  layout?: LayoutType
  menuGroups?: AdminMenuGroup[]
  routeRecords?: AdminNavigationRouteRecord[]
}>()

const router = useRouter()
const route = useRoute()
const adminRoute = route as unknown as AdminCurrentRouteRecord

// 把路由表和当前激活路径统一收口 避免模板层再次拼接路由语义
const routeRecords = computed<AdminNavigationRouteRecord[]>(() => props.routeRecords ?? (router.getRoutes() as unknown as AdminNavigationRouteRecord[]))
const activeMenuPath = computed(() => (route.meta as AdminRouteMeta).activePath ?? route.path)
const breadcrumbPrefix = computed(() => buildAdminBreadcrumbPrefix(adminRoute))
const breadcrumbs = computed(() => buildAdminBreadcrumbs(adminRoute, routeRecords.value))
const menuGroups = computed(() => markActiveAdminMenuGroups(props.menuGroups ?? buildAdminMenuGroups(routeRecords.value), activeMenuPath.value))
const isIframeRoute = computed(() => {
  const iframeSrc = (route.meta as AdminRouteMeta).iframeSrc
  return typeof iframeSrc === 'string' && Boolean(iframeSrc.trim())
})
</script>

<template>
  <Layout :breadcrumb-prefix="breadcrumbPrefix" :breadcrumbs="breadcrumbs" :layout="layout" :tabbar-enable="true">
    <IFrameRouterView v-if="isIframeRoute" />
    <slot v-else />

    <template #menu="{ collapsed, opened }">
      <LayoutMenu :collapsed="collapsed" :groups="menuGroups" :opened="opened" />
    </template>

    <template #tabbar>
      <LayoutTabbar />
    </template>

    <template #header-right>
      <slot name="header-right" />
    </template>
  </Layout>
</template>
