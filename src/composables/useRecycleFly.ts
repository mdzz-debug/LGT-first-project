import { shallowRef } from 'vue'

export const useRecycleFly = () => {
  const animating = shallowRef(false)

  const flyToRecycle = (sourceEl?: HTMLElement | null) => {
    if (typeof window === 'undefined') return
    if (!sourceEl) return
    const target = document.querySelector('.recycle-fab') as HTMLElement | null
    if (!target) return

    const sourceRect = sourceEl.getBoundingClientRect()
    const targetRect = target.getBoundingClientRect()

    const clone = sourceEl.cloneNode(true) as HTMLElement
    clone.classList.add('recycle-fly')
    clone.style.left = `${sourceRect.left}px`
    clone.style.top = `${sourceRect.top}px`
    clone.style.width = `${sourceRect.width}px`
    clone.style.height = `${sourceRect.height}px`
    clone.style.setProperty('--fly-x', `${targetRect.left + targetRect.width / 2 - (sourceRect.left + sourceRect.width / 2)}px`)
    clone.style.setProperty('--fly-y', `${targetRect.top + targetRect.height / 2 - (sourceRect.top + sourceRect.height / 2)}px`)

    document.body.appendChild(clone)
    animating.value = true

    requestAnimationFrame(() => {
      clone.classList.add('recycle-fly-active')
    })

    const cleanup = () => {
      clone.removeEventListener('animationend', cleanup)
      clone.remove()
      animating.value = false
    }

    clone.addEventListener('animationend', cleanup)
  }

  return { flyToRecycle, animating }
}
