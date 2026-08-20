const APP_LOADING_SELECTOR = '#__app-loading__'
const INJECTED_LOADING_SELECTOR = '[data-app-loading^="inject"]'
const TRANSITION_FALLBACK_MS = 1_000

/** Fades out and removes the loading markup injected by the Vite plugin. */
function unmountGlobalLoading() {
  const loadingElement = document.querySelector<HTMLElement>(APP_LOADING_SELECTOR)

  if (!loadingElement) return

  const injectedElements = document.querySelectorAll(INJECTED_LOADING_SELECTOR)
  let removed = false

  const removeLoading = () => {
    if (removed) return

    removed = true
    loadingElement.remove()
    injectedElements.forEach((element) => element.remove())
  }

  loadingElement.addEventListener('transitionend', removeLoading, { once: true })
  window.setTimeout(removeLoading, TRANSITION_FALLBACK_MS)

  // Wait until the visible loading state has been painted before starting the transition.
  window.requestAnimationFrame(() => {
    window.requestAnimationFrame(() => {
      loadingElement.setAttribute('aria-hidden', 'true')
      loadingElement.classList.add('hidden')
    })
  })
}

export { unmountGlobalLoading }
