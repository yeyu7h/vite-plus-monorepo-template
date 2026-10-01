<script setup lang="ts">
import { ref } from 'vue'
import { getHealth, type Health } from '@/api/client'
import SiteShell from '@/components/SiteShell.vue'

const checking = ref(false)
const health = ref<Health | null>(null)
const error = ref('')

async function checkApi() {
  checking.value = true
  health.value = null
  error.value = ''
  try {
    health.value = await getHealth()
  } catch {
    error.value = '无法连接 API。请先运行 vp run dev:api。'
  } finally {
    checking.value = false
  }
}
</script>

<template>
  <SiteShell>
    <UContainer class="py-16 sm:py-24">
      <div class="max-w-3xl space-y-6">
        <UBadge label="Web App 起点" color="primary" variant="soft" />
        <h1 class="text-4xl font-bold tracking-tight text-highlighted sm:text-5xl">从你的产品界面开始</h1>
        <p class="text-lg leading-relaxed text-muted">这是一个独立的前台模板。页面、路由、样式和请求入口已经就位，可以直接替换为你的业务内容。</p>
        <div class="flex flex-wrap gap-3">
          <UButton to="/about" label="了解模板结构" trailing-icon="i-lucide-arrow-right" />
          <UButton href="https://viteplus.dev/guide/" target="_blank" label="Vite+ 文档" color="neutral" variant="outline" />
        </div>
      </div>

      <div class="mt-14 grid gap-5 md:grid-cols-3">
        <UCard>
          <h2 class="font-semibold text-highlighted">页面路由</h2>
          <p class="mt-2 text-sm leading-6 text-muted">首页、关于页和未找到页面，作为产品流程的起点。</p>
        </UCard>
        <UCard>
          <h2 class="font-semibold text-highlighted">通用组件</h2>
          <p class="mt-2 text-sm leading-6 text-muted">Nuxt UI 与 Tailwind 已配置，可继续搭建任何前台界面。</p>
        </UCard>
        <UCard>
          <h2 class="font-semibold text-highlighted">API 请求</h2>
          <p class="mt-2 text-sm leading-6 text-muted">请求封装指向公开 API，不依赖管理端权限模块。</p>
        </UCard>
      </div>

      <section class="mt-14 rounded-xl border border-muted bg-elevated p-6" aria-labelledby="api-heading">
        <h2 id="api-heading" class="text-xl font-semibold text-highlighted">连接 API</h2>
        <p class="mt-2 text-sm text-muted">前台可以单独运行。启动 API 后，可在这里测试公开的健康检查接口。</p>
        <UButton class="mt-5" label="检查 API" color="neutral" variant="outline" :loading="checking" @click="checkApi" />
        <p v-if="health" class="mt-4 text-sm text-success">API 状态：{{ health.status }} · {{ health.timestamp }}</p>
        <p v-if="error" role="alert" class="mt-4 text-sm text-error">{{ error }}</p>
      </section>
    </UContainer>
  </SiteShell>
</template>
