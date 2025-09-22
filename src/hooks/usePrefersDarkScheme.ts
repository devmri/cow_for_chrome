import { useEffect, useState } from 'react'

// 浏览器主题偏好监听（重构前: hy）
export function usePrefersDarkScheme(): boolean {
  const [isDark, setIsDark] = useState(false)

  useEffect(() => {
    const mq = typeof window !== 'undefined' ? window.matchMedia?.('(prefers-color-scheme: dark)') : undefined
    if (!mq) return

    const update = (event?: MediaQueryListEvent | MediaQueryList) => {
      setIsDark(event ? event.matches : mq.matches)
    }

    update(mq)

    if (typeof mq.addEventListener === 'function') {
      const handler = (event: MediaQueryListEvent) => update(event)
      mq.addEventListener('change', handler)
      return () => mq.removeEventListener('change', handler)
    }

    if (typeof mq.addListener === 'function') {
      const handler = (event: MediaQueryListEvent) => update(event)
      mq.addListener(handler)
      return () => mq.removeListener(handler)
    }
  }, [])

  return isDark
}
