import { NavLink, useLocation, Link } from 'react-router-dom'
import {
  LayoutDashboard, Zap, Users, MessageSquare,
  ScrollText, Settings, MessageCircle, Send, X, Radio
} from 'lucide-react'
import { useApp } from '../../context/AppContext'

const navItems = [
  { to: '/dashboard', icon: LayoutDashboard, label: 'Dashboard' },
  { to: '/automations', icon: Zap, label: 'Automations' },
  { to: '/contacts', icon: Users, label: 'Contacts' },
  { to: '/messages', icon: MessageSquare, label: 'Messages' },
  { to: '/status', icon: Radio, label: 'Status' },
  { to: '/campaigns', icon: Send, label: 'Campaigns' },
  { to: '/logs', icon: ScrollText, label: 'Logs' },
]

const bottomNavItems = [
  { to: '/settings', icon: Settings, label: 'Settings' },
]

export default function Sidebar({ isOpen, isCollapsed, onClose }) {
  const { profile, sessionStatus, waProfile } = useApp()
  const { pathname } = useLocation()

  const statusColor = {
    connected: 'connected',
    disconnected: 'disconnected',
    connecting: 'connecting',
  }[sessionStatus?.status] || 'disconnected'

  const displayName = waProfile?.name || profile.name || 'User'
  const displaySub = waProfile?.phone || sessionStatus?.phone || profile.role || null
  const picUrl = waProfile?.profilePicUrl || null
  const initial = displayName.charAt(0).toUpperCase()

  return (
    <aside className={`sidebar${isOpen ? ' sidebar-open' : ''}${isCollapsed ? ' sidebar-collapsed' : ''}`}>
      {/* Logo + close button on mobile */}
      <div className="sidebar-logo" style={pathname === '/dashboard' ? { justifyContent: 'flex-end', borderBottom: 'none' } : undefined}>
        {pathname !== '/dashboard' && (
          <>
            <div className="sidebar-logo-icon">
              <MessageCircle size={20} color="white" />
            </div>
            <div className="sidebar-logo-text">
              WA Automate
              <span>Automation Platform</span>
            </div>
          </>
        )}
        {/* Mobile close button */}
        <button
          className="sidebar-close-btn"
          onClick={onClose}
          aria-label="Close menu"
        >
          <X size={20} />
        </button>
      </div>

      {/* Navigation */}
      <nav className="sidebar-nav">
        <div className="nav-section">
          <div className="nav-section-label">Main Menu</div>
          {navItems.map(({ to, icon: Icon, label }) => (
            <NavLink
              key={to}
              to={to}
              onClick={() => onClose && onClose()}
              className={({ isActive }) => `nav-item${isActive ? ' active' : ''}`}
            >
              <Icon size={18} className="nav-item-icon" />
              <span className="nav-item-label">{label}</span>
            </NavLink>
          ))}
        </div>

        <div className="nav-section">
          <div className="nav-section-label">System</div>
          {bottomNavItems.map(({ to, icon: Icon, label }) => (
            <NavLink
              key={to}
              to={to}
              onClick={() => onClose && onClose()}
              className={({ isActive }) => `nav-item${isActive ? ' active' : ''}`}
            >
              <Icon size={18} className="nav-item-icon" />
              <span className="nav-item-label">{label}</span>
            </NavLink>
          ))}
        </div>
      </nav>

      {/* WhatsApp Profile Card */}
      <div className="sidebar-footer">
        <Link
          to="/profile"
          onClick={() => onClose && onClose()}
          style={{ display: 'flex', alignItems: 'center', gap: 12, textDecoration: 'none', color: 'inherit' }}
        >
          <div style={{ position: 'relative', flexShrink: 0 }}>
            <div style={{
              width: 36,
              height: 36,
              borderRadius: '50%',
              background: picUrl ? 'transparent' : 'var(--gradient-purple)',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              fontSize: 14,
              fontWeight: 700,
              color: 'white',
              overflow: 'hidden',
              boxShadow: picUrl ? 'none' : 'var(--shadow-glow-purple)',
            }}>
              {picUrl
                ? <img
                    src={picUrl}
                    alt={displayName}
                    style={{ width: '100%', height: '100%', objectFit: 'cover' }}
                    onError={e => { e.target.style.display = 'none'; e.target.parentNode.textContent = initial }}
                  />
                : initial}
            </div>
            <span
              className={`status-dot ${statusColor}`}
              style={{
                position: 'absolute',
                bottom: -2,
                right: -2,
                width: 12,
                height: 12,
                border: '2px solid #0d1421',
                borderRadius: '50%',
              }}
            />
          </div>
          <div className="status-info" style={{ display: 'flex', flexDirection: 'column', overflow: 'hidden' }}>
            <div className="status-value" style={{ fontSize: 'var(--font-size-sm)', fontWeight: 600, color: 'var(--text-primary)', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
              {displayName}
            </div>
            {displaySub && (
              <div className="status-label" style={{ fontSize: 'var(--font-size-xs)', color: 'var(--text-muted)', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                {displaySub}
              </div>
            )}
          </div>
        </Link>
      </div>
    </aside>
  )
}
