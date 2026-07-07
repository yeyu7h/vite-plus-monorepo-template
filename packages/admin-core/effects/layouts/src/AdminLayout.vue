<script setup lang="ts">
import { Layout } from '@monorepo-admin-core/layout-ui'
import { computed } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import { LayoutTabbar } from './basic/tabbar'
import { LayoutMenu } from './basic/menu'
import { buildAdminBreadcrumbPrefix, buildAdminBreadcrumbs } from './route-breadcrumb'
import { buildAdminMenuGroups, markActiveAdminMenuGroups } from './route-menu'

const router = useRouter()
const route = useRoute()

const breadcrumbPrefix = computed(() => buildAdminBreadcrumbPrefix(route))
const breadcrumbs = computed(() => buildAdminBreadcrumbs(route, router.getRoutes()))
const menuGroups = computed(() => markActiveAdminMenuGroups(buildAdminMenuGroups(router.getRoutes()), route.meta.activePath ?? route.path))
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
