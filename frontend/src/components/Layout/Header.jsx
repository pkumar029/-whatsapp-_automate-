import { useLocation } from 'react-router-dom'
import { Bell, Search, RefreshCw, Sun, Moon } from 'lucide-react'
import { useApp } from '../../context/AppContext'
import { useState, useEffect } from 'react'
import { whatsappApi } from '../../services/api'

const pageMeta = {
  '/dashboard': { title: 'Dashboard', subtitle: 'Welcome back — here\'s your automation overview' },
  '/automations': { title: 'Automations', subtitle: 'Build and manage your WhatsApp automation workflows' },
  '/contacts': { title: 'Contacts', subtitle: 'Manage your WhatsApp contacts and groups' },
  '/messages': { title: 'Messages', subtitle: 'View and send WhatsApp messages' },
  '/logs': { title: 'Execution Logs', subtitle: 'Monitor automation runs and debug errors' },
  '/settings': { title: 'Settings', subtitle: 'Configure WhatsApp session and application settings' },
}

export default function Header() {
  const { pathname } = useLocation()
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
      <div className="header-left">
        <h1>{meta.title}</h1>
        {meta.subtitle && <p>{meta.subtitle}</p>}
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
        <button className="header-btn" title="Notifications">
          <Bell size={16} />
        </button>
        {isConnected && (
          <div className="avatar" title={`${profile.name} (${profile.email})`}>
            {initial}
          </div>
        )}
      </div>
    </header>
  )
}


