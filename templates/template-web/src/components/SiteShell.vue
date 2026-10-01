<template>
  <div class="flex min-h-screen flex-col bg-default text-default">
    <header class="border-b border-muted">
      <UContainer class="flex h-16 items-center justify-between gap-4">
        <RouterLink to="/" class="font-semibold tracking-tight text-highlighted">Web App</RouterLink>
        <nav aria-label="主导航" class="flex items-center gap-1">
          <UButton to="/" label="首页" color="neutral" variant="ghost" />
          <UButton to="/about" label="关于模板" color="neutral" variant="ghost" />
        </nav>
      </UContainer>
    </header>
    <main class="flex-1">
      <slot />
    </main>
    <footer class="border-t border-muted py-6">
      <UContainer class="text-sm text-muted">Vite+ · Vue · Nuxt UI</UContainer>
    </footer>
  </div>
</template>
