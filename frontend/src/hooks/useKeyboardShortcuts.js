import { useEffect, useCallback, useRef } from 'react'
import { useNavigate } from 'react-router-dom'

export const SHORTCUT_GROUPS = [
  {
    label: 'General',
    shortcuts: [
      { keys: ['?'], description: 'Show keyboard shortcuts' },
      { keys: ['Ctrl', 'K'], description: 'Search contacts' },
      { keys: ['Ctrl', 'F'], description: 'Search messages' },
      { keys: ['Esc'], description: 'Close dialog / modal' },
    ],
  },
  {
    label: 'Quick Navigate',
    shortcuts: [
      { keys: ['Ctrl', 'Shift', 'M'], description: 'Open Messages' },
      { keys: ['Ctrl', 'Shift', 'C'], description: 'Open Contacts' },
      { keys: ['Ctrl', 'Shift', 'A'], description: 'Open Automations' },
      { keys: ['Ctrl', 'Shift', 'S'], description: 'Open Status' },
      { keys: ['Ctrl', 'Shift', 'P'], description: 'Open Campaigns' },
      { keys: ['Ctrl', 'Shift', 'L'], description: 'Open Logs' },
    ],
  },
  {
    label: 'Chord Navigation (G +)',
    shortcuts: [
      { keys: ['G', 'D'], description: 'Go to Dashboard' },
      { keys: ['G', 'C'], description: 'Go to Contacts' },
      { keys: ['G', 'M'], description: 'Go to Messages' },
      { keys: ['G', 'A'], description: 'Go to Automations' },
      { keys: ['G', 'L'], description: 'Go to Logs' },
      { keys: ['G', 'S'], description: 'Go to Settings' },
    ],
  },
  {
    label: 'Chat',
    shortcuts: [
      { keys: ['Ctrl', 'N'], description: 'New chat / open Messages' },
      { keys: ['Enter'], description: 'Send message (in text field)' },
      { keys: ['Shift', 'Enter'], description: 'New line in message' },
      { keys: ['/'], description: 'Focus contact search' },
    ],
  },
]

const CTRL_SHIFT_MAP = {
  m: '/messages',
  c: '/contacts',
  a: '/automations',
  s: '/status',
  p: '/campaigns',
  l: '/logs',
}

const CHORD_MAP = {
  d: '/dashboard',
  c: '/contacts',
  m: '/messages',
  a: '/automations',
  l: '/logs',
  s: '/settings',
}

export function getShortcutsEnabled() {
  try { return localStorage.getItem('wa_shortcuts_enabled') !== 'false' } catch { return true }
}
export function setShortcutsEnabled(val) {
  localStorage.setItem('wa_shortcuts_enabled', val ? 'true' : 'false')
}

export function useKeyboardShortcuts({ onToggleHelp, onSearch, onSearchMessages } = {}) {
  const navigate = useNavigate()
  const pendingG = useRef(false)
  const gTimer = useRef(null)

  const handleKey = useCallback((e) => {
    if (!getShortcutsEnabled()) return

    const tag = e.target?.tagName?.toLowerCase()
    const isTyping = ['input', 'textarea', 'select'].includes(tag) || e.target?.isContentEditable

    // '?' shows shortcuts overlay — only outside inputs
    if (e.key === '?' && !isTyping) {
      e.preventDefault()
      onToggleHelp?.()
      return
    }

    // Ctrl+Shift+Letter → navigation (works even while typing)
    if ((e.ctrlKey || e.metaKey) && e.shiftKey) {
      const dest = CTRL_SHIFT_MAP[e.key.toLowerCase()]
      if (dest) { e.preventDefault(); navigate(dest); return }
    }

    // Ctrl+K → focus contact search
    if (e.key === 'k' && (e.ctrlKey || e.metaKey) && !e.shiftKey) {
      e.preventDefault()
      onSearch?.()
      return
    }

    // Ctrl+F → focus message search (only intercept if we have a handler, else let browser handle)
    if (e.key === 'f' && (e.ctrlKey || e.metaKey) && !e.shiftKey && onSearchMessages) {
      e.preventDefault()
      onSearchMessages()
      return
    }

    // Ctrl+N → new message
    if (e.key === 'n' && (e.ctrlKey || e.metaKey) && !e.shiftKey) {
      e.preventDefault()
      navigate('/messages')
      return
    }

    // Remaining shortcuts only fire outside of text inputs
    if (isTyping) return

    // '/' focuses contact search
    if (e.key === '/' && !e.ctrlKey && !e.metaKey) {
      e.preventDefault()
      onSearch?.()
      return
    }

    // G + letter chord navigation (1-second window)
    if (pendingG.current) {
      clearTimeout(gTimer.current)
      pendingG.current = false
      const dest = CHORD_MAP[e.key.toLowerCase()]
      if (dest) { e.preventDefault(); navigate(dest) }
      return
    }

    if (e.key.toLowerCase() === 'g' && !e.ctrlKey && !e.metaKey && !e.altKey && !e.shiftKey) {
      pendingG.current = true
      gTimer.current = setTimeout(() => { pendingG.current = false }, 1000)
    }
  }, [navigate, onToggleHelp, onSearch, onSearchMessages])

  useEffect(() => {
    window.addEventListener('keydown', handleKey)
    return () => {
      window.removeEventListener('keydown', handleKey)
      clearTimeout(gTimer.current)
    }
  }, [handleKey])
}
