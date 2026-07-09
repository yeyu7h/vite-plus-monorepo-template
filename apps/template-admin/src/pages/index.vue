<template>
  <div class="flex h-screen items-center justify-center text-sm text-muted">正在进入系统...</div>
</template>

<route lang="json">
{
  "meta": {
    "source": "core",
    "ignoreAccess": true,
    "hideInMenu": true,
    "title": "入口"
  },
  "redirect": "/auth/login"
}
</route>
