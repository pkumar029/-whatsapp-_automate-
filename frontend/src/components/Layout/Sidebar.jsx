import { NavLink, useLocation } from 'react-router-dom'
import {
  LayoutDashboard, Zap, Users, MessageSquare,
  ScrollText, Settings, MessageCircle, Send
} from 'lucide-react'
import { useState, useEffect } from 'react'
import { whatsappApi } from '../../services/api'
import { useApp } from '../../context/AppContext'

const navItems = [
  { to: '/dashboard', icon: LayoutDashboard, label: 'Dashboard' },
  { to: '/automations', icon: Zap, label: 'Automations' },
  { to: '/contacts', icon: Users, label: 'Contacts' },
  { to: '/messages', icon: MessageSquare, label: 'Messages' },
  { to: '/campaigns', icon: Send, label: 'Campaigns' },
  { to: '/logs', icon: ScrollText, label: 'Logs' },
]

const bottomNavItems = [
  { to: '/settings', icon: Settings, label: 'Settings' },
]

export default function Sidebar() {
  const { profile } = useApp()
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
    <aside className="sidebar">
      {/* Logo */}
      <div className="sidebar-logo">
        <div className="sidebar-logo-icon">
          <MessageCircle size={20} color="white" />
        </div>
        <div className="sidebar-logo-text">
          WA Automate
          <span>Automation Platform</span>
        </div>
      </div>

      {/* Navigation */}
      <nav className="sidebar-nav">
        <div className="nav-section">
          <div className="nav-section-label">Main Menu</div>
          {navItems.map(({ to, icon: Icon, label }) => {
            const isDisabled = !profile?.isProfileConfigured
            return (
              <NavLink
                key={to}
                to={to}
                onClick={(e) => isDisabled && e.preventDefault()}
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
              className={({ isActive }) => `nav-item${isActive ? ' active' : ''}`}
            >
              <Icon size={18} className="nav-item-icon" />
              <span className="nav-item-label">{label}</span>
            </NavLink>
          ))}
        </div>
      </nav>

      {/* WhatsApp Status */}
      <div className="sidebar-footer">
        <div className="sidebar-status">
          <span className={`status-dot ${statusColor}`}></span>
          <div className="status-info">
            <div className="status-label">WhatsApp</div>
            <div className="status-value">
              {sessionStatus.status === 'connected'
                ? sessionStatus.phone || 'Connected'
                : sessionStatus.status === 'connecting'
                ? 'Connecting...'
                : 'Disconnected'}
            </div>
          </div>
        </div>
      </div>
    </aside>
  )
}
