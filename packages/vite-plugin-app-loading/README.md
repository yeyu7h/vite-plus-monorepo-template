# vite-plugin-app-loading

Injects a first-paint loading screen into Vite HTML and removes it after the application mounts.

```ts
// vite.config.ts
import { viteInjectAppLoadingPlugin } from '@monorepo/vite-plugin-app-loading'

await viteInjectAppLoadingPlugin({
  env,
  isBuild: command === 'build',
  root,
  themeStorageKey: 'vueuse-color-scheme',
})
```

```ts
// application entry
import { unmountGlobalLoading } from '@monorepo/vite-plugin-app-loading/runtime'

unmountGlobalLoading()
```

Add `loading.html` to the application root to replace the bundled template. The template may use `<%= VITE_APP_TITLE %>` for the escaped application title.

Set `themeStorageKey` to the key used by the application's color-mode library. The injected script restores `dark` before the loading UI is painted and follows `prefers-color-scheme` when the stored value is `auto` or missing.
