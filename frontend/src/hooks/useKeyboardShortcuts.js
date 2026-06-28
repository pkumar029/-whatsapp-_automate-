import { useEffect, useCallback, useRef } from 'react'
import { useNavigate } from 'react-router-dom'

export const SHORTCUT_GROUPS = [
  {
    label: 'General',
    shortcuts: [
      { keys: ['?'], description: 'Show keyboard shortcuts' },
      { keys: ['Ctrl', 'K'], description: 'Focus search' },
      { keys: ['Esc'], description: 'Close modal / dismiss' },
    ],
  },
  {
    label: 'Navigation',
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
    label: 'All Chats',
    shortcuts: [
      { keys: ['Ctrl', 'N'], description: 'New message' },
      { keys: ['/'], description: 'Focus contact search' },
      { keys: ['↑ / ↓'], description: 'Navigate contacts list' },
    ],
  },
  {
    label: 'Chat Actions',
    shortcuts: [
      { keys: ['Ctrl', 'Enter'], description: 'Send message' },
      { keys: ['Ctrl', 'Shift', 'E'], description: 'Export contacts as CSV' },
      { keys: ['Del'], description: 'Delete selected item' },
    ],
  },
  {
    label: 'Messages',
    shortcuts: [
      { keys: ['Enter'], description: 'Send message (in text field)' },
      { keys: ['Esc'], description: 'Clear / cancel draft' },
      { keys: ['Ctrl', '↑'], description: 'Scroll to top of messages' },
      { keys: ['Ctrl', '↓'], description: 'Scroll to bottom of messages' },
    ],
  },
]

export function useKeyboardShortcuts({ onToggleHelp, onSearch } = {}) {
  const navigate = useNavigate()
  const pendingG = useRef(false)
  const gTimer = useRef(null)

  const handleKey = useCallback((e) => {
    const tag = e.target?.tagName?.toLowerCase()
    const isTyping = ['input', 'textarea', 'select'].includes(tag) || e.target?.isContentEditable

    // '?' toggles help (Shift+/) — works even when not typing
    if (e.key === '?' && !isTyping) {
      e.preventDefault()
      onToggleHelp?.()
      return
    }

    if (isTyping) return

    // Ctrl+K → focus search
    if (e.key === 'k' && (e.ctrlKey || e.metaKey)) {
      e.preventDefault()
      onSearch?.()
      return
    }

    // Ctrl+N → navigate to Messages for new message
    if (e.key === 'n' && (e.ctrlKey || e.metaKey)) {
      e.preventDefault()
      navigate('/messages')
      return
    }

    // G+key chord navigation
    if (pendingG.current) {
      clearTimeout(gTimer.current)
      pendingG.current = false
      const map = {
        d: '/dashboard',
        c: '/contacts',
        m: '/messages',
        a: '/automations',
        l: '/logs',
        s: '/settings',
      }
      const dest = map[e.key.toLowerCase()]
      if (dest) {
        e.preventDefault()
        navigate(dest)
      }
      return
    }

    if (e.key.toLowerCase() === 'g' && !e.ctrlKey && !e.metaKey && !e.altKey) {
      pendingG.current = true
      gTimer.current = setTimeout(() => { pendingG.current = false }, 1000)
    }
  }, [navigate, onToggleHelp, onSearch])

  useEffect(() => {
    window.addEventListener('keydown', handleKey)
    return () => {
      window.removeEventListener('keydown', handleKey)
      clearTimeout(gTimer.current)
    }
  }, [handleKey])
}
