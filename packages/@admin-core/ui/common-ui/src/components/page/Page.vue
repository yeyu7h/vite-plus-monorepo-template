<script setup lang="ts">
import type { PageProps } from './types'

defineOptions({ name: 'Page' })

const props = withDefaults(defineProps<PageProps>(), {
  fillHeight: false,
})
</script>

<template>
  <div :class="['relative min-w-0 w-full', props.fillHeight && 'flex min-h-0 flex-1 flex-col overflow-hidden']">
    <slot />

    <div v-if="$slots.footer" data-slot="footer" class="shrink-0">
      <slot name="footer" />
    </div>
  </div>
</template>
