<script setup lang="ts">
import { Layout } from '@monorepo-admin-core/layout-ui'
import { computed } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import { LayoutTabbar } from './basic/tabbar'
import { LayoutMenu } from './basic/menu'
import { buildAdminBreadcrumbPrefix, buildAdminBreadcrumbs } from './navigation/route-breadcrumb'
import { buildAdminMenuGroups, markActiveAdminMenuGroups } from './navigation/route-menu'

const router = useRouter()
const route = useRoute()

// 把路由表和当前激活路径统一收口 避免模板层再次拼接路由语义
const routeRecords = computed(() => router.getRoutes())
const activeMenuPath = computed(() => route.meta.activePath ?? route.path)
const breadcrumbPrefix = computed(() => buildAdminBreadcrumbPrefix(route))
const breadcrumbs = computed(() => buildAdminBreadcrumbs(route, routeRecords.value))
const menuGroups = computed(() => markActiveAdminMenuGroups(buildAdminMenuGroups(routeRecords.value), activeMenuPath.value))
</script>

<template>
  <Layout :breadcrumb-prefix="breadcrumbPrefix" :breadcrumbs="breadcrumbs" :tabbar-enable="true">
    <slot />

    <template #menu="{ collapsed, opened }">
      <LayoutMenu :collapsed="collapsed" :groups="menuGroups" :opened="opened" />
    </template>

    <template #tabbar>
      <LayoutTabbar />
    </template>
  </Layout>
</template>
