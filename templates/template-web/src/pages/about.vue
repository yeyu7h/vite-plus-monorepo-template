<script setup lang="ts">
import SiteShell from '@/components/SiteShell.vue'
</script>

<template>
  <SiteShell>
    <UContainer class="max-w-3xl py-16 sm:py-24">
      <UBadge label="关于模板" color="primary" variant="soft" />
      <h1 class="mt-6 text-4xl font-bold tracking-tight text-highlighted">为普通 Web App 留出空间</h1>
      <p class="mt-5 text-lg leading-relaxed text-muted">从这里加入产品页面、交互和数据请求。导航、路由及基础视觉组件都可以按实际业务调整。</p>
      <div class="mt-10 space-y-4 text-sm leading-7 text-toned">
        <p><strong class="text-highlighted">src/pages</strong> 放页面，<strong class="text-highlighted">src/router</strong> 定义路由。</p>
        <p><strong class="text-highlighted">src/api</strong> 放公开或用户端 API 的请求方法。</p>
        <p><strong class="text-highlighted">src/components</strong> 放跨页面复用的组件。</p>
      </div>
      <UButton class="mt-10" to="/" label="返回首页" color="neutral" variant="outline" />
    </UContainer>
  </SiteShell>
</template>
