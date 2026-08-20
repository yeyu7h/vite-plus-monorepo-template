<script setup lang="ts">
import type { LayoutBreadcrumbItem } from '@monorepo-admin-core/types'
import { LayoutHeader as LayoutHeaderPrimitive } from '@monorepo-admin-core/layout-ui'
import { Breadcrumb } from '../../widgets'

defineProps<{
  breadcrumbPrefix?: LayoutBreadcrumbItem[]
  breadcrumbs?: LayoutBreadcrumbItem[]
}>()
</script>

<template>
  <LayoutHeaderPrimitive>
    <template v-if="$slots.toggle" #toggle="slotProps">
      <slot name="toggle" v-bind="slotProps" />
    </template>

    <template #left="slotProps">
      <slot name="left" v-bind="slotProps">
        <Breadcrumb :breadcrumb-prefix="breadcrumbPrefix" :breadcrumbs="breadcrumbs" />
      </slot>
    </template>

    <template v-if="$slots.right" #right="slotProps">
      <slot name="right" v-bind="slotProps" />
    </template>
  </LayoutHeaderPrimitive>
</template>
