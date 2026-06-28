import { useState, useEffect, useCallback } from 'react'
import { Outlet, Link } from 'react-router-dom'
import Sidebar from './Sidebar'
import Header from './Header'
import MobileBottomNav from './MobileBottomNav'
import KeyboardShortcutsModal from '../KeyboardShortcutsModal'
import { useApp } from '../../context/AppContext'
import { useKeyboardShortcuts } from '../../hooks/useKeyboardShortcuts'

export default function Layout() {
  const [sidebarOpen, setSidebarOpen] = useState(false)
  const [isCollapsed, setIsCollapsed] = useState(false)
  const [shortcutsOpen, setShortcutsOpen] = useState(false)
  const { profile } = useApp()

  const toggleHelp = useCallback(() => setShortcutsOpen(v => !v), [])
  const focusSearch = useCallback(() => {
    const el = document.querySelector('input[type="search"], input[placeholder*="earch"]')
    el?.focus()
  }, [])

  useKeyboardShortcuts({ onToggleHelp: toggleHelp, onSearch: focusSearch })

  // Close sidebar drawer on resize to desktop
  useEffect(() => {
    const onResize = () => {
      if (window.innerWidth >= 768) setSidebarOpen(false)
    }
    window.addEventListener('resize', onResize)
    return () => window.removeEventListener('resize', onResize)
  }, [])

  const handleMenuToggle = () => {
    if (window.innerWidth < 768) {
      setSidebarOpen(v => !v)
    } else {
      setIsCollapsed(v => !v)
    }
  }

  return (
    <div className={`app-layout${isCollapsed ? ' layout-collapsed' : ''}`}>
      <KeyboardShortcutsModal open={shortcutsOpen} onClose={() => setShortcutsOpen(false)} />
      {/* Sidebar overlay backdrop on mobile */}
      {sidebarOpen && (
        <div
          className="sidebar-backdrop"
          onClick={() => setSidebarOpen(false)}
        />
      )}

      <Sidebar isOpen={sidebarOpen} isCollapsed={isCollapsed} onClose={() => setSidebarOpen(false)} />

      <div className="main-content">
        <Header onMenuToggle={handleMenuToggle} />
        <main className="page-container">
          {!profile?.isProfileConfigured && (
            <div style={{
              background: 'linear-gradient(135deg, rgba(245, 158, 11, 0.15) 0%, rgba(217, 119, 6, 0.05) 100%)',
              border: '1px solid rgba(245, 158, 11, 0.25)',
              borderRadius: 'var(--radius-md)',
              padding: '12px 18px',
              marginBottom: 20,
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'space-between',
              gap: 12,
              flexWrap: 'wrap',
              boxShadow: 'var(--shadow-sm)',
              backdropFilter: 'blur(10px)'
            }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                <span style={{ fontSize: 18 }}>⚠️</span>
                <span style={{ fontSize: 'var(--font-size-sm)', color: '#fcd34d', fontWeight: 500 }}>
                  Profile unconfigured. Complete your Profile Details in <Link to="/settings" style={{ color: 'var(--accent-primary)', textDecoration: 'underline', fontWeight: 700 }}>Settings</Link> to unlock system functionality.
                </span>
              </div>
            </div>
          )}
          <Outlet />
        </main>
      </div>

      {/* Bottom navigation for mobile */}
      <MobileBottomNav />
    </div>
  )
}
