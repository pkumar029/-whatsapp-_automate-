import { useEffect, useRef, useCallback } from 'react'

const WA_ICON = '/vite.svg' // fallback icon — replace with your app icon

export function useNotifications() {
  const permRef = useRef(typeof Notification !== 'undefined' ? Notification.permission : 'denied')

  useEffect(() => {
    if (typeof Notification === 'undefined') return
    if (Notification.permission === 'default') {
      Notification.requestPermission().then(p => { permRef.current = p })
    } else {
      permRef.current = Notification.permission
    }
  }, [])

  const notify = useCallback((title, body, options = {}) => {
    if (permRef.current !== 'granted') return
    // Don't notify when the user is actively looking at the tab
    if (document.visibilityState === 'visible' && !options.forceShow) return

    const n = new Notification(title, {
      body,
      icon: options.icon || WA_ICON,
      badge: WA_ICON,
      tag: options.tag || 'wa-message',  // replaces previous notification with same tag
      renotify: true,
      silent: false,
    })
    n.onclick = () => {
      window.focus()
      n.close()
      if (options.onClick) options.onClick()
    }
    // Auto-close after 6 seconds
    setTimeout(() => n.close(), 6000)
  }, [])

  return { notify }
}
