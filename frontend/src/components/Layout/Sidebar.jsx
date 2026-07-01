import { NavLink, useLocation } from 'react-router-dom'
import {
  LayoutDashboard, Zap, Users, MessageSquare,
  ScrollText, Settings, Send, X, Radio
} from 'lucide-react'
import { useApp } from '../../context/AppContext'

// Shortcuts shown in tooltips next to each nav item
const NAV_ITEMS = [
  { to: '/dashboard',   icon: LayoutDashboard, label: 'Dashboard',   hint: 'G D' },
  { to: '/automations', icon: Zap,             label: 'Automations', hint: 'Ctrl+Shift+A' },
  { to: '/contacts',    icon: Users,           label: 'Contacts',    hint: 'Ctrl+Shift+C' },
  { to: '/messages',    icon: MessageSquare,   label: 'Messages',    hint: 'Ctrl+Shift+M' },
  { to: '/status',      icon: Radio,           label: 'Status',      hint: 'Ctrl+Shift+S' },
  { to: '/campaigns',   icon: Send,            label: 'Campaigns',   hint: 'Ctrl+Shift+P' },
  { to: '/logs',        icon: ScrollText,      label: 'Logs',        hint: 'Ctrl+Shift+L' },
]

const BOTTOM_ITEMS = [
  { to: '/settings', icon: Settings, label: 'Settings', hint: 'G S' },
]

export default function Sidebar({ isOpen, isCollapsed, onClose }) {
  const { sessionStatus, waProfile } = useApp()

  return (
    <aside className={`sidebar${isOpen ? ' sidebar-open' : ''}${isCollapsed ? ' sidebar-collapsed' : ''}`}>

      {/* Mobile-only: close button at the top */}
      <div className="sidebar-mobile-header">
        <button className="sidebar-close-btn" onClick={onClose} aria-label="Close menu">
          <X size={20} />
        </button>
      </div>

      {/* Navigation — fills full sidebar height */}
      <nav className="sidebar-nav sidebar-nav-clean">
        {/* Main items */}
        <div className="nav-section">
          {NAV_ITEMS.map(({ to, icon: Icon, label, hint }) => (
            <NavLink
              key={to}
              to={to}
              onClick={() => onClose && onClose()}
              title={`${label}  ${hint}`}
              className={({ isActive }) => `nav-item${isActive ? ' active' : ''}`}
            >
              <Icon size={18} className="nav-item-icon" />
              <span className="nav-item-label">{label}</span>
              <span className="nav-item-hint">{hint}</span>
            </NavLink>
          ))}
        </div>

        {/* Settings pinned at the bottom */}
        <div className="nav-section nav-section-bottom">
          {BOTTOM_ITEMS.map(({ to, icon: Icon, label, hint }) => (
            <NavLink
              key={to}
              to={to}
              onClick={() => onClose && onClose()}
              title={`${label}  ${hint}`}
              className={({ isActive }) => `nav-item${isActive ? ' active' : ''}`}
            >
              <Icon size={18} className="nav-item-icon" />
              <span className="nav-item-label">{label}</span>
              <span className="nav-item-hint">{hint}</span>
            </NavLink>
          ))}

          {/* Connected account shortcut — profile pic + name */}
          {sessionStatus?.status === 'connected' && (
            <NavLink
              to="/profile"
              onClick={() => onClose && onClose()}
              title={waProfile?.name ? `${waProfile.name} — view profile` : 'View profile'}
              className={({ isActive }) => `nav-item${isActive ? ' active' : ''}`}
            >
              <div style={{
                width: 18, height: 18, borderRadius: '50%', flexShrink: 0,
                background: 'linear-gradient(135deg, #25D366, #128C7E)',
                display: 'flex', alignItems: 'center', justifyContent: 'center',
                fontSize: 9, fontWeight: 700, color: '#fff', overflow: 'hidden',
              }}>
                {waProfile?.profilePicUrl
                  ? <img src={waProfile.profilePicUrl} alt="" style={{ width: '100%', height: '100%', objectFit: 'cover' }} onError={e => { e.target.style.display = 'none' }} />
                  : (waProfile?.name?.[0]?.toUpperCase() || 'W')}
              </div>
              <span className="nav-item-label" style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                {waProfile?.name || 'My Account'}
              </span>
            </NavLink>
          )}

          {/* Connection indicator dot */}
          <div className="sidebar-conn-dot" title={`WhatsApp: ${sessionStatus?.status || 'disconnected'}`}>
            <span className={`status-dot ${sessionStatus?.status === 'connected' ? 'connected' : sessionStatus?.status === 'connecting' ? 'connecting' : 'disconnected'}`} />
            <span className="nav-item-label sidebar-conn-label">
              {sessionStatus?.status === 'connected' ? 'Connected' : sessionStatus?.status === 'connecting' ? 'Connecting…' : 'Disconnected'}
            </span>
          </div>
        </div>
      </nav>
    </aside>
  )
}
