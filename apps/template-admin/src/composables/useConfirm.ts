import { useOverlay } from '@nuxt/ui/runtime/composables/useOverlay.js'

import ConfirmModal from '@/components/ConfirmModal.vue'

export interface ConfirmOptions {
  title: string
  description?: string
  confirmLabel?: string
  cancelLabel?: string
  confirmDisabled?: boolean
  errorTitle?: string
  onConfirm: () => Promise<void> | void
  formatError?: (error: unknown) => string
}

export function useConfirm() {
  const overlay = useOverlay()

  return async (options: ConfirmOptions): Promise<boolean> => {
    const modal = overlay.create(ConfirmModal, { destroyOnClose: true })
    return (await modal.open(options)) === true
  }
}
