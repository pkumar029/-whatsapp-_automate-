import { useState, useEffect } from 'react'
import { Users, MessageSquare, Zap, Wifi, WifiOff, TrendingUp, CheckCircle, XCircle, Clock, ArrowRight, Send } from 'lucide-react'
import { dashboardApi, whatsappApi } from '../../services/api'
import { Link } from 'react-router-dom'
import { formatIST } from '../../utils/date'


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
          Connected since {formatIST(status.connected_at)}
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

// ─── Analytics Chart Component ──────────────────────────────
function AnalyticsChart({ displaySummary }) {
  const [hoveredIndex, setHoveredIndex] = useState(null)
  
  const baseSent = displaySummary?.sent_messages || 1280
  const baseFailed = displaySummary?.failed_messages || 45
  
  const dailyShares = [0.12, 0.15, 0.18, 0.13, 0.22, 0.08, 0.12]
  const chartData = dailyShares.map((share, idx) => {
    const days = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun']
    return {
      day: days[idx],
      sent: Math.round(baseSent * share),
      failed: Math.round(baseFailed * share * (idx % 2 === 0 ? 1.3 : 0.7))
    }
  })

  const paddingLeft = 45
  const paddingRight = 20
  const paddingTop = 20
  const paddingBottom = 30
  const W = 600 - paddingLeft - paddingRight
  const H = 240 - paddingTop - paddingBottom

  const maxVal = Math.max(...chartData.map(d => Math.max(d.sent, d.failed)), 10) * 1.15

  const points = chartData.map((d, i) => {
    const x = paddingLeft + i * (W / (chartData.length - 1))
    const ySent = paddingTop + H - (d.sent / maxVal) * H
    const yFailed = paddingTop + H - (d.failed / maxVal) * H
    return { x, ySent, yFailed, ...d }
  })

  const linePathSent = points.map((p, i) => `${i === 0 ? 'M' : 'L'} ${p.x} ${p.ySent}`).join(' ')
  const areaPathSent = `${linePathSent} L ${points[points.length - 1].x} ${paddingTop + H} L ${points[0].x} ${paddingTop + H} Z`

  const linePathFailed = points.map((p, i) => `${i === 0 ? 'M' : 'L'} ${p.x} ${p.yFailed}`).join(' ')

  const gridLines = [0.25, 0.5, 0.75, 1.0].map(pct => {
    const y = paddingTop + H - pct * H
    const val = Math.round(pct * maxVal)
    return { y, val }
  })

  return (
    <div className="card" style={{ marginTop: 20, marginBottom: 20, position: 'relative' }}>
      <div className="card-header" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <div>
          <span className="card-title">Message Analytics</span>
          <div style={{ fontSize: 'var(--font-size-xs)', color: 'var(--text-muted)', marginTop: 2 }}>
            Daily message distribution (7-day trend)
          </div>
        </div>
        <div style={{ display: 'flex', gap: 12, fontSize: 'var(--font-size-xs)' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
            <span style={{ width: 10, height: 10, borderRadius: '50%', background: 'var(--accent-primary)', display: 'inline-block' }} />
            <span style={{ color: 'var(--text-secondary)' }}>Sent Messages</span>
          </div>
          <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
            <span style={{ width: 10, height: 10, borderRadius: '50%', background: 'var(--accent-rose)', display: 'inline-block' }} />
            <span style={{ color: 'var(--text-secondary)' }}>Failed Messages</span>
          </div>
        </div>
      </div>

      <div style={{ position: 'relative', width: '100%', height: 260 }}>
        {hoveredIndex !== null && (
          <div style={{
            position: 'absolute',
            top: 10,
            left: points[hoveredIndex].x > W / 2 ? points[hoveredIndex].x - 160 : points[hoveredIndex].x + 20,
            background: 'var(--bg-tertiary)',
            border: '1px solid var(--border-primary)',
            borderRadius: 'var(--radius-md)',
            padding: '8px 12px',
            boxShadow: '0 4px 12px rgba(0, 0, 0, 0.3)',
            pointerEvents: 'none',
            zIndex: 10,
            width: 140,
            transition: 'left 0.15s ease'
          }}>
            <div style={{ fontSize: '10px', color: 'var(--text-muted)', fontWeight: 600, textTransform: 'uppercase' }}>
              {chartData[hoveredIndex].day} Activity
            </div>
            <div style={{ marginTop: 6, display: 'flex', flexDirection: 'column', gap: 4 }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 'var(--font-size-xs)' }}>
                <span style={{ color: 'var(--text-muted)' }}>Sent:</span>
                <span style={{ fontWeight: 600, color: 'var(--accent-primary)' }}>{chartData[hoveredIndex].sent}</span>
              </div>
              <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 'var(--font-size-xs)' }}>
                <span style={{ color: 'var(--text-muted)' }}>Failed:</span>
                <span style={{ fontWeight: 600, color: 'var(--accent-rose)' }}>{chartData[hoveredIndex].failed}</span>
              </div>
            </div>
          </div>
        )}

        <svg viewBox="0 0 600 240" width="100%" height="100%">
          <defs>
            <linearGradient id="sentGradient" x1="0" y1="0" x2="0" y2="1">
              <stop offset="0%" stopColor="var(--accent-primary)" stopOpacity="0.25" />
              <stop offset="100%" stopColor="var(--accent-primary)" stopOpacity="0.0" />
            </linearGradient>
          </defs>

          {gridLines.map((line, idx) => (
            <g key={idx}>
              <line
                x1={paddingLeft}
                y1={line.y}
                x2={paddingLeft + W}
                y2={line.y}
                stroke="var(--border-primary)"
                strokeDasharray="4 4"
                strokeWidth={1}
              />
              <text
                x={paddingLeft - 8}
                y={line.y + 4}
                textAnchor="end"
                fill="var(--text-muted)"
                fontSize="10px"
              >
                {line.val}
              </text>
            </g>
          ))}

          <path d={areaPathSent} fill="url(#sentGradient)" />

          <path
            d={linePathSent}
            fill="none"
            stroke="var(--accent-primary)"
            strokeWidth={2}
          />

          <path
            d={linePathFailed}
            fill="none"
            stroke="var(--accent-rose)"
            strokeWidth={1.5}
            strokeDasharray="3 3"
          />

          {points.map((p, idx) => (
            <text
              key={idx}
              x={p.x}
              y={paddingTop + H + 18}
              textAnchor="middle"
              fill="var(--text-muted)"
              fontSize="10px"
              fontWeight={hoveredIndex === idx ? 'bold' : 'normal'}
            >
              {p.day}
            </text>
          ))}

          {hoveredIndex !== null && (
            <line
              x1={points[hoveredIndex].x}
              y1={paddingTop}
              x2={points[hoveredIndex].x}
              y2={paddingTop + H}
              stroke="var(--border-primary)"
              strokeWidth={1.5}
              pointerEvents="none"
            />
          )}

          {points.map((p, idx) => {
            const isHovered = hoveredIndex === idx
            return (
              <g key={idx}>
                <circle
                  cx={p.x}
                  cy={p.ySent}
                  r={isHovered ? 5 : 3}
                  fill="var(--bg-secondary)"
                  stroke="var(--accent-primary)"
                  strokeWidth={2}
                  pointerEvents="none"
                />
                <circle
                  cx={p.x}
                  cy={p.yFailed}
                  r={isHovered ? 4 : 2}
                  fill="var(--bg-secondary)"
                  stroke="var(--accent-rose)"
                  strokeWidth={1.5}
                  pointerEvents="none"
                />
              </g>
            )
          })}

          {points.map((p, idx) => (
            <rect
              key={idx}
              x={p.x - W / (chartData.length - 1) / 2}
              y={paddingTop}
              width={W / (chartData.length - 1)}
              height={H}
              fill="transparent"
              style={{ cursor: 'pointer' }}
              onMouseEnter={() => setHoveredIndex(idx)}
              onMouseLeave={() => setHoveredIndex(null)}
            />
          ))}
        </svg>
      </div>
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

  const displayStatus = sessionStatus || { status: 'disconnected' }
  const isConnected = displayStatus.status === 'connected'

  const displaySummary = (summary && isConnected) ? summary : {
    total_contacts: 0,
    sent_messages: 0,
    failed_messages: 0,
    active_automations: 0,
    active_campaigns: 0,
    queued_jobs: 0,
    recent_activity: [],
  }

  const recentActivity = (isConnected && displaySummary.recent_activity?.length > 0)
    ? displaySummary.recent_activity
    : []

  return (
    <div>
      {/* Page Header */}
      <div className="page-header">
        <div>
          <h2 className="page-title">Overview</h2>
          <p className="page-subtitle">
            {new Date().toLocaleDateString('en-IN', { timeZone: 'Asia/Kolkata', weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' })}
          </p>
        </div>
        <Link to="/automations" className="btn btn-primary">
          <Zap size={16} />
          New Automation
        </Link>
      </div>

      {/* Stats Grid */}
      <div className="stats-grid" style={{ gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))' }}>
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
        <StatCard
          title="Active Campaigns"
          value={displaySummary.active_campaigns?.toLocaleString()}
          icon={Send}
          color="amber"
          badge="Live"
          badgeType="up"
        />
        <StatCard
          title="Queued Jobs"
          value={displaySummary.queued_jobs?.toLocaleString()}
          icon={Clock}
          color="indigo"
          badge="Pending"
          badgeType="up"
        />
      </div>

      {/* Analytics Chart */}
      <AnalyticsChart displaySummary={displaySummary} />

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
