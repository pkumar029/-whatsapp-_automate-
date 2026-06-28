import { NavLink, useLocation, Link } from 'react-router-dom'
import {
  LayoutDashboard, Zap, Users, MessageSquare,
  ScrollText, Settings, MessageCircle, Send, X, Radio
} from 'lucide-react'
import { useState, useEffect } from 'react'
import { whatsappApi } from '../../services/api'
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
  const { profile } = useApp()
  const { pathname } = useLocation()
  const [sessionStatus, setSessionStatus] = useState({ status: 'disconnected', phone: null })

  useEffect(() => {
    const fetchStatus = async () => {
      try {
        const res = await whatsappApi.getStatus()
        setSessionStatus(res.data)
      } catch {
        setSessionStatus({ status: 'disconnected', phone: null })
      }
    }
    fetchStatus()
    const interval = setInterval(fetchStatus, 15000)
    return () => clearInterval(interval)
  }, [])

  const statusColor = {
    connected: 'connected',
    disconnected: 'disconnected',
    connecting: 'connecting',
  }[sessionStatus.status] || 'disconnected'

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
          {navItems.map(({ to, icon: Icon, label }) => {
            const isDisabled = false
            return (
              <NavLink
                key={to}
                to={to}
                onClick={() => {
                  onClose && onClose()
                }}
                className={({ isActive }) => `nav-item${isActive ? ' active' : ''}${isDisabled ? ' disabled' : ''}`}
                style={isDisabled ? { opacity: 0.4, cursor: 'not-allowed' } : undefined}
                title={isDisabled ? 'Complete profile details first' : undefined}
              >
                <Icon size={18} className="nav-item-icon" />
                <span className="nav-item-label">{label}</span>
              </NavLink>
            )
          })}
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

      {/* User Profile Card instead of plain WhatsApp status */}
      <div className="sidebar-footer">
        <Link 
          to="/settings" 
          onClick={() => onClose && onClose()} 
          style={{ display: 'flex', alignItems: 'center', gap: 12, textDecoration: 'none', color: 'inherit' }}
        >
          <div style={{ position: 'relative', display: 'flex', flexShrink: 0 }}>
            <div style={{
              width: 36,
              height: 36,
              borderRadius: '50%',
              background: 'var(--gradient-purple)',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              fontSize: 14,
              fontWeight: 700,
              color: 'white',
              boxShadow: 'var(--shadow-glow-purple)'
            }}>
              {profile.name ? profile.name.charAt(0).toUpperCase() : 'U'}
            </div>
            {/* WhatsApp Status Dot indicator */}
            <span 
              className={`status-dot ${statusColor}`} 
              style={{ 
                position: 'absolute', 
                bottom: -2, 
                right: -2, 
                width: 12, 
                height: 12, 
                border: '2px solid #0d1421', 
                borderRadius: '50%'
              }} 
            />
          </div>
          <div className="status-info" style={{ display: 'flex', flexDirection: 'column', overflow: 'hidden' }}>
            <div className="status-value" style={{ fontSize: 'var(--font-size-sm)', fontWeight: 600, color: 'var(--text-primary)', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
              {profile.name || 'User Profile'}
            </div>
            <div className="status-label" style={{ fontSize: 'var(--font-size-xs)', color: 'var(--text-muted)', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
              {profile.role || 'Administrator'}
            </div>
          </div>
        </Link>
      </div>
    </aside>
  )
}
