import { defineConfig } from 'vite-plus'
import Vue from 'unplugin-vue/vite'

export default defineConfig({
  plugins: [Vue()],
  staged: {
    '*': 'vp check --fix',
  },
  test: {
    projects: ['apps/*/vite.config.ts', 'templates/*/vite.config.ts', 'packages/**/vite.config.ts', 'internal/*/vite.config.ts'],
  },
  fmt: {
    semi: false,
    singleQuote: true,
    printWidth: 200,
    ignorePatterns: ['apps/**/typed-router.d.ts', 'apps/**/src/types/openapi/**', 'templates/**/typed-router.d.ts', 'templates/**/src/types/openapi/**', '.agents/**'],
  },
  lint: {
    plugins: ['eslint', 'typescript', 'unicorn', 'oxc', 'vue', 'vitest'],
    categories: {
      correctness: 'error',
    },
    env: {
      browser: true,
      builtin: true,
    },
    ignorePatterns: [
      '**/dist/**',
      '**/dist-ssr/**',
      '**/coverage/**',
      'apps/**/typed-router.d.ts',
      'apps/**/src/types/openapi/**',
      'templates/**/typed-router.d.ts',
      'templates/**/src/types/openapi/**',
      '.agents/**',
    ],
    rules: {
      'no-array-constructor': 'error',
      'typescript/ban-ts-comment': 'error',
      'typescript/no-empty-object-type': 'error',
      'typescript/no-explicit-any': 'error',
      'typescript/no-namespace': 'off',
      'typescript/no-require-imports': 'error',
      'typescript/no-unnecessary-type-constraint': 'error',
      'typescript/no-unsafe-function-type': 'error',
      'vite-plus/prefer-vite-plus-imports': 'error',
    },
    overrides: [
      {
        files: ['**/*.ts', '**/*.tsx', '**/*.mts', '**/*.cts', '**/*.vue'],
        rules: {
          'constructor-super': 'off',
          'getter-return': 'off',
          'no-class-assign': 'off',
          'no-const-assign': 'off',
          'no-dupe-class-members': 'off',
          'no-dupe-keys': 'off',
          'no-func-assign': 'off',
          'no-import-assign': 'off',
          'no-new-native-nonconstructor': 'off',
          'no-obj-calls': 'off',
          'no-redeclare': 'off',
          'no-setter-return': 'off',
          'no-this-before-super': 'off',
          'no-undef': 'off',
          'no-unreachable': 'off',
          'no-unsafe-negation': 'off',
          'no-var': 'error',
          'no-with': 'off',
          'prefer-const': 'error',
          'prefer-rest-params': 'error',
          'prefer-spread': 'error',
        },
      },
      {
        files: ['src/**/__tests__/*'],
        rules: {
          'vitest/expect-expect': 'error',
          'vitest/no-commented-out-tests': 'error',
          'vitest/no-conditional-expect': 'error',
          'vitest/no-disabled-tests': 'warn',
          'vitest/no-focused-tests': 'error',
          'vitest/no-identical-title': 'error',
          'vitest/no-import-node-test': 'error',
          'vitest/no-interpolation-in-snapshots': 'error',
          'vitest/no-mocks-import': 'error',
          'vitest/no-standalone-expect': 'error',
          'vitest/no-unneeded-async-expect-function': 'error',
          'vitest/prefer-called-exactly-once-with': 'error',
          'vitest/require-local-test-context-for-concurrent-snapshots': 'error',
          'vitest/valid-describe-callback': 'error',
          'vitest/valid-expect': 'error',
          'vitest/valid-expect-in-promise': 'error',
          'vitest/valid-title': 'error',
        },
      },
      {
        files: ['templates/template-api/**/*.integration.test.ts', 'apps/**/*.integration.test.ts'],
        rules: {
          'typescript/no-explicit-any': 'off',
          'typescript/unbound-method': 'off',
          'vitest/expect-expect': 'off',
          'vitest/no-conditional-expect': 'off',
          'vitest/no-standalone-expect': 'off',
          'vitest/require-mock-type-parameters': 'off',
          'vitest/require-to-throw-message': 'off',
        },
      },
      {
        files: ['packages/server-core/src/**/*.test.ts', 'packages/server-refine-query/src/**/*.test.ts'],
        rules: {
          'typescript/no-explicit-any': 'off',
          'vitest/no-conditional-expect': 'off',
        },
      },
      {
        files: ['templates/template-api/migrations/**/*.ts', 'templates/template-api/scripts/**/*.ts', 'apps/*/migrations/**/*.ts', 'apps/*/scripts/**/*.ts'],
        rules: {
          'typescript/no-explicit-any': 'off',
        },
      },
    ],
    options: { typeAware: true, typeCheck: true },
    jsPlugins: [{ name: 'vite-plus', specifier: 'vite-plus/oxlint-plugin' }],
  },
  run: {
    cache: true,
  },
})
