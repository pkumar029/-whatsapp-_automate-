import { useState, useEffect } from 'react'
import { Users, MessageSquare, Zap, Wifi, WifiOff, TrendingUp, CheckCircle, XCircle, Clock, ArrowRight } from 'lucide-react'
import { dashboardApi, whatsappApi } from '../../services/api'
import { Link } from 'react-router-dom'

// ─── Stat Card Component ──────────────────────────────────────
function StatCard({ title, value, icon: Icon, color, badge, badgeType }) {
  return (
    <div className={`stat-card ${color}`}>
      <div className="stat-card-header">
        <div className={`stat-icon ${color}`}>
          <Icon size={22} />
        </div>
        {badge && (
          <span className={`stat-badge ${badgeType}`}>{badge}</span>
        )}
      </div>
      <div>
        <div className="stat-value">{value ?? <span className="skeleton" style={{ width: 60, height: 36, display: 'inline-block' }} />}</div>
        <div className="stat-label">{title}</div>
      </div>
    </div>
  )
}

// ─── Session Status Card ──────────────────────────────────────
function SessionCard({ status }) {
  const isConnected = status?.status === 'connected'
  const isConnecting = status?.status === 'connecting'

  return (
    <div className="card" style={{ borderColor: isConnected ? 'rgba(37,211,102,0.3)' : undefined }}>
      <div className="card-header">
        <span className="card-title">WhatsApp Session</span>
        {isConnected
          ? <Wifi size={18} color="var(--accent-primary)" />
          : <WifiOff size={18} color="var(--accent-rose)" />}
      </div>
      <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
        <span className={`status-dot ${isConnected ? 'connected' : isConnecting ? 'connecting' : 'disconnected'}`} style={{ width: 12, height: 12 }} />
        <div>
          <div style={{ fontWeight: 600, fontSize: 'var(--font-size-md)', color: isConnected ? 'var(--accent-primary)' : 'var(--accent-rose)' }}>
            {isConnected ? 'Connected' : isConnecting ? 'Connecting...' : 'Disconnected'}
          </div>
          {status?.phone && (
            <div style={{ fontSize: 'var(--font-size-sm)', color: 'var(--text-muted)', marginTop: 2 }}>
              📱 {status.phone}
            </div>
          )}
        </div>
        {!isConnected && (
          <Link to="/settings" className="btn btn-primary btn-sm" style={{ marginLeft: 'auto' }}>
            Connect
          </Link>
        )}
      </div>
      {status?.connected_at && (
        <div style={{ marginTop: 12, fontSize: 'var(--font-size-xs)', color: 'var(--text-muted)', display: 'flex', alignItems: 'center', gap: 4 }}>
          <Clock size={12} />
          Connected since {new Date(status.connected_at).toLocaleString()}
        </div>
      )}
    </div>
  )
}

// ─── Recent Activity ──────────────────────────────────────────
function RecentActivity({ items }) {
  if (!items || items.length === 0) {
    return (
      <div className="empty-state">
        <div className="empty-state-icon"><Clock size={28} /></div>
        <div className="empty-state-title">No recent activity</div>
        <div className="empty-state-desc">Automation runs and messages will appear here</div>
      </div>
    )
  }
  return (
    <div>
      {items.map((item, idx) => (
        <div key={idx} style={{
          display: 'flex', alignItems: 'center', gap: 12, padding: '12px 0',
          borderBottom: idx < items.length - 1 ? '1px solid var(--border-primary)' : 'none'
        }}>
          <div style={{
            width: 36, height: 36, borderRadius: 'var(--radius-md)',
            background: item.status === 'success' ? 'var(--accent-primary-muted)' : 'var(--accent-rose-muted)',
            display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0
          }}>
            {item.status === 'success'
              ? <CheckCircle size={18} color="var(--accent-primary)" />
              : <XCircle size={18} color="var(--accent-rose)" />}
          </div>
          <div style={{ flex: 1, minWidth: 0 }}>
            <div style={{ fontWeight: 500, color: 'var(--text-primary)', fontSize: 'var(--font-size-sm)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
              {item.name}
            </div>
            <div style={{ fontSize: 'var(--font-size-xs)', color: 'var(--text-muted)', marginTop: 2 }}>
              {item.description}
            </div>
          </div>
          <div style={{ fontSize: 'var(--font-size-xs)', color: 'var(--text-muted)', flexShrink: 0 }}>
            {item.time}
          </div>
        </div>
      ))}
    </div>
  )
}

// ─── Main Dashboard Page ──────────────────────────────────────
export default function Dashboard() {
  const [summary, setSummary] = useState(null)
  const [sessionStatus, setSessionStatus] = useState(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    const fetchData = async () => {
      try {
        const [summaryRes, statusRes] = await Promise.allSettled([
          dashboardApi.getSummary(),
          whatsappApi.getStatus(),
        ])
        if (summaryRes.status === 'fulfilled') setSummary(summaryRes.value.data)
        if (statusRes.status === 'fulfilled') setSessionStatus(statusRes.value.data)
      } catch (err) {
        console.error('Dashboard fetch error:', err)
      } finally {
        setLoading(false)
      }
    }
    fetchData()
  }, [])

  // Fallback demo data for offline dev
  const displaySummary = summary || {
    total_contacts: 0,
    sent_messages: 0,
    failed_messages: 0,
    active_automations: 0,
    recent_activity: [],
  }

  const displayStatus = sessionStatus || { status: 'disconnected' }

  const recentActivity = displaySummary.recent_activity?.length > 0
    ? displaySummary.recent_activity
    : [
      { name: 'Welcome Automation', description: 'Triggered for new contact', status: 'success', time: 'Just now' },
      { name: 'Daily Report', description: 'Automation run completed', status: 'success', time: '5m ago' },
      { name: 'Follow-up Sequence', description: 'Failed — contact unreachable', status: 'failed', time: '1h ago' },
    ]

  return (
    <div>
      {/* Page Header */}
      <div className="page-header">
        <div>
          <h2 className="page-title">Overview</h2>
          <p className="page-subtitle">
            {new Date().toLocaleDateString('en-US', { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' })}
          </p>
        </div>
        <Link to="/automations" className="btn btn-primary">
          <Zap size={16} />
          New Automation
        </Link>
      </div>

      {/* Stats Grid */}
      <div className="stats-grid">
        <StatCard
          title="Total Contacts"
          value={displaySummary.total_contacts?.toLocaleString()}
          icon={Users}
          color="blue"
          badge="+12%"
          badgeType="up"
        />
        <StatCard
          title="Messages Sent"
          value={displaySummary.sent_messages?.toLocaleString()}
          icon={MessageSquare}
          color="green"
          badge="+8%"
          badgeType="up"
        />
        <StatCard
          title="Failed Messages"
          value={displaySummary.failed_messages?.toLocaleString()}
          icon={XCircle}
          color="rose"
          badge={displaySummary.failed_messages > 0 ? "Check" : "0"}
          badgeType={displaySummary.failed_messages > 0 ? "down" : "up"}
        />
        <StatCard
          title="Active Automations"
          value={displaySummary.active_automations?.toLocaleString()}
          icon={Zap}
          color="purple"
          badge="Running"
          badgeType="up"
        />
      </div>

      {/* Bottom Grid */}
      <div className="grid-2" style={{ gap: 20 }}>
        {/* Session Status */}
        <SessionCard status={displayStatus} />

        {/* Quick Actions */}
        <div className="card">
          <div className="card-header">
            <span className="card-title">Quick Actions</span>
          </div>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
            {[
              { label: 'Create Automation', to: '/automations', icon: Zap, color: 'var(--accent-purple)' },
              { label: 'Add Contact', to: '/contacts', icon: Users, color: 'var(--accent-blue)' },
              { label: 'Send Message', to: '/messages', icon: MessageSquare, color: 'var(--accent-primary)' },
              { label: 'View Logs', to: '/logs', icon: TrendingUp, color: 'var(--accent-amber)' },
            ].map(({ label, to, icon: Icon, color }) => (
              <Link key={to} to={to} style={{
                display: 'flex', alignItems: 'center', gap: 12, padding: '10px 12px',
                background: 'var(--bg-tertiary)', borderRadius: 'var(--radius-md)',
                border: '1px solid var(--border-primary)', textDecoration: 'none',
                transition: 'all 0.2s', color: 'var(--text-secondary)'
              }}
                onMouseEnter={e => { e.currentTarget.style.borderColor = 'rgba(255,255,255,0.15)'; e.currentTarget.style.color = 'var(--text-primary)' }}
                onMouseLeave={e => { e.currentTarget.style.borderColor = 'var(--border-primary)'; e.currentTarget.style.color = 'var(--text-secondary)' }}
              >
                <Icon size={16} style={{ color }} />
                <span style={{ flex: 1, fontSize: 'var(--font-size-sm)', fontWeight: 500 }}>{label}</span>
                <ArrowRight size={14} />
              </Link>
            ))}
          </div>
        </div>

        {/* Recent Activity */}
        <div className="card" style={{ gridColumn: '1 / -1' }}>
          <div className="card-header">
            <span className="card-title">Recent Activity</span>
            <Link to="/logs" style={{ fontSize: 'var(--font-size-sm)', color: 'var(--accent-primary)', display: 'flex', alignItems: 'center', gap: 4 }}>
              View all <ArrowRight size={14} />
            </Link>
          </div>
          <RecentActivity items={recentActivity} />
        </div>
      </div>
    </div>
  )
}
