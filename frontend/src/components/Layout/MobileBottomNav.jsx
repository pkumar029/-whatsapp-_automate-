import { NavLink } from 'react-router-dom'
import { LayoutDashboard, Users, MessageSquare, Zap, UserCircle } from 'lucide-react'

const tabs = [
  { to: '/dashboard',   icon: LayoutDashboard, label: 'Home' },
  { to: '/contacts',    icon: Users,           label: 'Contacts' },
  { to: '/messages',    icon: MessageSquare,   label: 'Chats' },
  { to: '/automations', icon: Zap,             label: 'Flows' },
  { to: '/profile',     icon: UserCircle,      label: 'Profile' },
]

export default function MobileBottomNav() {
  return (
    <nav className="mobile-bottom-nav">
      {tabs.map(({ to, icon: Icon, label }) => (
        <NavLink
          key={to}
          to={to}
          className={({ isActive }) => `mobile-bottom-tab${isActive ? ' active' : ''}`}
        >
          <Icon size={22} />
          <span>{label}</span>
        </NavLink>
      ))}
    </nav>
  )
}
