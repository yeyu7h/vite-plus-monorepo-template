<template>
  <div class="min-h-screen bg-muted/30">
    <header class="border-b border-default bg-default">
      <div class="mx-auto flex h-14 max-w-5xl items-center justify-between px-6">
        <span class="font-semibold text-highlighted">Minimal Layout</span>
        <UButton color="neutral" icon="i-lucide-arrow-left" to="/dashboard/workbench" variant="ghost">返回管理后台</UButton>
      </div>
    </header>

    <main class="mx-auto max-w-5xl p-6">
      <RouterView />
    </main>
  </div>
</template>
