import { useEffect } from 'react'
import { SHORTCUT_GROUPS } from '../hooks/useKeyboardShortcuts'

export default function KeyboardShortcutsModal({ open, onClose }) {
  useEffect(() => {
    if (!open) return
    const handler = (e) => { if (e.key === 'Escape') onClose() }
    window.addEventListener('keydown', handler)
    return () => window.removeEventListener('keydown', handler)
  }, [open, onClose])

  if (!open) return null

  return (
    <div
      style={{
        position: 'fixed', inset: 0, zIndex: 9999,
        background: 'rgba(0,0,0,0.6)', backdropFilter: 'blur(4px)',
        display: 'flex', alignItems: 'center', justifyContent: 'center',
        padding: '16px',
      }}
      onClick={onClose}
    >
      <div
        style={{
          background: 'var(--bg-secondary)',
          border: '1px solid var(--border-primary)',
          borderRadius: 'var(--radius-lg)',
          width: '100%', maxWidth: 640,
          maxHeight: '80vh', overflowY: 'auto',
          padding: '28px 32px',
          boxShadow: '0 20px 60px rgba(0,0,0,0.5)',
        }}
        onClick={e => e.stopPropagation()}
      >
        {/* Header */}
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 24 }}>
          <div>
            <h2 style={{ margin: 0, fontSize: 18, fontWeight: 700, color: 'var(--text-primary)' }}>
              Keyboard Shortcuts
            </h2>
            <p style={{ margin: '4px 0 0', fontSize: 13, color: 'var(--text-muted)' }}>
              Press <Kbd>?</Kbd> anytime to show this panel
            </p>
          </div>
          <button
            onClick={onClose}
            style={{
              background: 'none', border: '1px solid var(--border-primary)',
              borderRadius: 'var(--radius-sm)', color: 'var(--text-muted)',
              cursor: 'pointer', padding: '4px 10px', fontSize: 13,
            }}
          >
            Esc
          </button>
        </div>

        {/* Shortcut groups — 2 column grid */}
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '24px 32px' }}>
          {SHORTCUT_GROUPS.map(group => (
            <div key={group.label}>
              <div style={{
                fontSize: 11, fontWeight: 700, letterSpacing: '0.08em',
                textTransform: 'uppercase', color: 'var(--accent-primary)',
                marginBottom: 10,
              }}>
                {group.label}
              </div>
              <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                {group.shortcuts.map((s, i) => (
                  <div key={i} style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 8 }}>
                    <span style={{ fontSize: 13, color: 'var(--text-secondary)' }}>{s.description}</span>
                    <div style={{ display: 'flex', gap: 4, flexShrink: 0 }}>
                      {s.keys.map((k, ki) => (
                        <Kbd key={ki}>{k}</Kbd>
                      ))}
                    </div>
                  </div>
                ))}
              </div>
            </div>
          ))}
        </div>

        {/* Footer tip */}
        <div style={{
          marginTop: 24, paddingTop: 16,
          borderTop: '1px solid var(--border-primary)',
          fontSize: 12, color: 'var(--text-muted)', textAlign: 'center',
        }}>
          Shortcuts are disabled when typing in input fields
        </div>
      </div>
    </div>
  )
}

function Kbd({ children }) {
  return (
    <span style={{
      display: 'inline-block',
      background: 'var(--bg-tertiary)',
      border: '1px solid var(--border-primary)',
      borderBottom: '2px solid var(--border-secondary, var(--border-primary))',
      borderRadius: 4,
      padding: '1px 6px',
      fontSize: 11,
      fontFamily: 'monospace',
      fontWeight: 600,
      color: 'var(--text-primary)',
      whiteSpace: 'nowrap',
      lineHeight: '18px',
    }}>
      {children}
    </span>
  )
}
