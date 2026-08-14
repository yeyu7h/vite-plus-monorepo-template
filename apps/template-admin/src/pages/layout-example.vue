<script setup lang="ts">
definePage({
  meta: {
    initial: true,
    layout: 'Minimal',
    source: 'core',
    hideInMenu: true,
    title: '自定义布局示例',
  },
})
</script>

<template>
  <UCard>
    <template #header>
      <div>
        <h1 class="text-xl font-semibold text-highlighted">自定义布局示例</h1>
        <p class="mt-1 text-sm text-muted">当前页面使用 Minimal.vue，而不是默认的 Basic.vue。</p>
      </div>
    </template>

    <div class="space-y-3 text-sm text-default">
      <p>页面通过下面的路由元信息选择布局：</p>
      <pre class="overflow-x-auto rounded-md bg-elevated p-4 text-xs">
        <code>
          definePage({
            meta: {
              initial: true,
              layout: 'Minimal',
              title: '自定义布局示例',
            },
          })
        </code>
      </pre>
      <p class="text-muted">布局名称对应 src/layouts/Minimal.vue 的文件名，不包含 .vue 后缀。</p>
    </div>
  </UCard>
</template>
