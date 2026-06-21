import { useLocation } from 'react-router-dom'
import { Bell, Search, RefreshCw } from 'lucide-react'

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

  return (
    <header className="header">
      <div className="header-left">
        <h1>{meta.title}</h1>
        {meta.subtitle && <p>{meta.subtitle}</p>}
      </div>

      <div className="header-right">
        <button className="header-btn" title="Refresh" onClick={() => window.location.reload()}>
          <RefreshCw size={16} />
        </button>
        <button className="header-btn" title="Notifications">
          <Bell size={16} />
        </button>
        <div className="avatar" title="Profile">A</div>
      </div>
    </header>
  )
}
