import { useLocation, useNavigate } from 'react-router-dom'
import { Bell, RefreshCw, Sun, Moon, Menu } from 'lucide-react'
import { useApp } from '../../context/AppContext'
import { useState, useEffect } from 'react'
import { whatsappApi } from '../../services/api'

const pageMeta = {
  '/dashboard':   { title: 'Dashboard',       subtitle: 'Your automation overview' },
  '/automations': { title: 'Automations',     subtitle: 'Build and manage workflows' },
  '/contacts':    { title: 'Contacts',        subtitle: 'Manage your WhatsApp contacts' },
  '/messages':    { title: 'Messages',        subtitle: 'View and send WhatsApp messages' },
  '/campaigns':   { title: 'Campaigns',       subtitle: 'Bulk messaging campaigns' },
  '/logs':        { title: 'Logs',            subtitle: 'Monitor automation runs' },
  '/settings':    { title: 'Settings',        subtitle: 'Configure your session' },
  '/profile':     { title: 'My Profile',      subtitle: 'Manage your account details' },
}

export default function Header({ onMenuToggle }) {
  const { pathname } = useLocation()
  const navigate = useNavigate()
  const meta = pageMeta[pathname] || { title: 'WhatsApp Automate', subtitle: '' }
  const { theme, toggleTheme, profile } = useApp()
  const [isConnected, setIsConnected] = useState(false)

  useEffect(() => {
    const checkStatus = async () => {
      try {
        const res = await whatsappApi.getStatus()
        setIsConnected(res.data.status === 'connected')
      } catch {
        setIsConnected(false)
      }
    }
    checkStatus()
    const interval = setInterval(checkStatus, 5000)
    return () => clearInterval(interval)
  }, [])

  const initial = profile.name ? profile.name.charAt(0).toUpperCase() : 'A'

  return (
    <header className="header">
      <div className="header-left" style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
        {/* Hamburger — visible on all screen sizes */}
        <button
          className="header-btn"
          onClick={onMenuToggle}
          aria-label="Toggle menu"
        >
          <Menu size={18} />
        </button>
        <div>
          <h1 className="header-title">{meta.title}</h1>
          {meta.subtitle && <p className="header-subtitle">{meta.subtitle}</p>}
        </div>
      </div>

      <div className="header-right">
        <button
          className="header-btn"
          title={`Switch to ${theme === 'dark' ? 'Light' : 'Dark'} Mode`}
          onClick={toggleTheme}
        >
          {theme === 'dark' ? <Sun size={16} /> : <Moon size={16} />}
        </button>
        <button className="header-btn" title="Refresh" onClick={() => window.location.reload()}>
          <RefreshCw size={16} />
        </button>
        <button className="header-btn header-btn-bell" title="Notifications">
          <Bell size={16} />
        </button>
        {isConnected && (
          <button
            onClick={() => navigate('/profile')}
            title={`${profile.name || 'Profile'} — click to edit`}
            style={{ background: 'none', border: 'none', cursor: 'pointer', padding: 0 }}
          >
            <div className="avatar" style={{ overflow: 'hidden' }}>
              {profile.avatar
                ? <img src={profile.avatar} alt="avatar" style={{ width: '100%', height: '100%', objectFit: 'cover', borderRadius: '50%' }} />
                : initial}
            </div>
          </button>
        )}
      </div>
    </header>
  )
}
