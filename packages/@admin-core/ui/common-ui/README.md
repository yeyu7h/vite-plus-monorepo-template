# Common UI

Shared UI entry point for admin applications.

The package provides common page primitives such as `Page`. Use `Page` for local pages that need to opt into filling the remaining layout height:

```vue
<Page fill-height>
  <!-- page content -->
</Page>
```

## Development

- Install dependencies:

```bash
vp install
```

- Run the unit tests:

```bash
vp test
```

- Build the library:

```bash
vp pack
```
