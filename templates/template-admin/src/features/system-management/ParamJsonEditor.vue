<script setup lang="ts">
import { json, jsonParseLinter } from '@codemirror/lang-json'
import { lintGutter, linter } from '@codemirror/lint'
import { Compartment, Prec } from '@codemirror/state'
import { oneDark } from '@codemirror/theme-one-dark'
import { basicSetup, EditorView } from 'codemirror'
import { computed, onBeforeUnmount, onMounted, shallowRef, useTemplateRef, watch } from 'vue'

const props = withDefaults(
  defineProps<{
    ariaLabel?: string
    invalid?: boolean
    modelValue: string
  }>(),
  {
    ariaLabel: 'JSON 参数值',
    invalid: false,
  },
)

const emit = defineEmits<{
  'update:modelValue': [value: string]
}>()

const editorElement = useTemplateRef('editorElement')
const editorView = shallowRef<EditorView>()
const themeCompartment = new Compartment()
let colorModeObserver: MutationObserver | undefined

const editorClass = computed(() =>
  props.invalid
    ? 'overflow-hidden rounded-md bg-elevated ring-1 ring-error transition-shadow focus-within:ring-2 focus-within:ring-error'
    : 'overflow-hidden rounded-md bg-elevated ring-1 ring-default transition-shadow focus-within:ring-2 focus-within:ring-primary',
)

const appTheme = EditorView.theme({
  '&': {
    backgroundColor: 'var(--ui-bg-elevated)',
    color: 'var(--ui-text-highlighted)',
    minHeight: '16rem',
  },
  '&.cm-focused': { outline: 'none' },
  '.cm-content': {
    caretColor: 'var(--ui-primary)',
    minHeight: '16rem',
    padding: '0.75rem 0',
  },
  '.cm-cursor, .cm-dropCursor': { borderLeftColor: 'var(--ui-primary)' },
  '.cm-gutters': {
    backgroundColor: 'var(--ui-bg-muted)',
    border: 'none',
    borderRight: '1px solid var(--ui-border)',
    color: 'var(--ui-text-dimmed)',
  },
  '.cm-activeLine, .cm-activeLineGutter': { backgroundColor: 'var(--ui-bg-muted)' },
  '.cm-scroller': {
    fontFamily: 'ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, monospace',
    lineHeight: '1.5',
    maxHeight: '30rem',
    overflow: 'auto',
  },
  '.cm-selectionBackground, &.cm-focused .cm-selectionBackground': { backgroundColor: 'var(--ui-bg-accented)' },
  '.cm-tooltip': {
    backgroundColor: 'var(--ui-bg-elevated)',
    border: '1px solid var(--ui-border)',
    color: 'var(--ui-text)',
  },
})

function isDarkMode() {
  return document.documentElement.classList.contains('dark')
}

function syncTheme() {
  editorView.value?.dispatch({ effects: themeCompartment.reconfigure(isDarkMode() ? oneDark : []) })
}

onMounted(() => {
  if (!editorElement.value) return

  editorView.value = new EditorView({
    doc: props.modelValue,
    parent: editorElement.value,
    extensions: [
      basicSetup,
      json(),
      linter(jsonParseLinter()),
      lintGutter(),
      EditorView.lineWrapping,
      EditorView.contentAttributes.of({ 'aria-label': props.ariaLabel, 'aria-multiline': 'true', spellcheck: 'false' }),
      EditorView.updateListener.of((update) => {
        if (update.docChanged) emit('update:modelValue', update.state.doc.toString())
      }),
      themeCompartment.of(isDarkMode() ? oneDark : []),
      Prec.high(appTheme),
    ],
  })

  colorModeObserver = new MutationObserver(syncTheme)
  colorModeObserver.observe(document.documentElement, { attributeFilter: ['class'], attributes: true })
})

watch(
  () => props.modelValue,
  (value) => {
    const view = editorView.value
    if (!view || value === view.state.doc.toString()) return
    view.dispatch({ changes: { from: 0, to: view.state.doc.length, insert: value } })
  },
)

onBeforeUnmount(() => {
  colorModeObserver?.disconnect()
  editorView.value?.destroy()
})
</script>

<template>
  <div :class="editorClass">
    <div v-if="$slots.toolbar" class="flex justify-end bg-muted px-2 py-1.5">
      <slot name="toolbar" />
    </div>
    <USeparator v-if="$slots.toolbar" :ui="{ border: 'border-muted' }" />
    <div ref="editorElement" />
  </div>
</template>
