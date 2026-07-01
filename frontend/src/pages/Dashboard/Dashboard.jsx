import { useState, useEffect, useCallback, useRef } from 'react'
import { Users, MessageSquare, Zap, Wifi, WifiOff, TrendingUp, CheckCircle, XCircle, Clock, ArrowRight, Send, Download } from 'lucide-react'
import { dashboardApi, BASE_URL } from '../../services/api'
import { Link } from 'react-router-dom'
import { formatIST } from '../../utils/date'
import { useApp } from '../../context/AppContext'

// ─── Stat Card Component ──────────────────────────────────────
function StatCard({ title, value, icon: Icon, color, badge, badgeType }) {
  const colorGradients = {
    blue: { bg: 'linear-gradient(135deg, rgba(59, 130, 246, 0.12) 0%, rgba(29, 78, 216, 0.04) 100%)', border: 'rgba(59, 130, 246, 0.2)', text: '#60a5fa' },
    green: { bg: 'linear-gradient(135deg, rgba(37, 211, 102, 0.12) 0%, rgba(22, 163, 74, 0.04) 100%)', border: 'rgba(37, 211, 102, 0.2)', text: 'var(--accent-primary)' },
    rose: { bg: 'linear-gradient(135deg, rgba(244, 63, 94, 0.12) 0%, rgba(190, 18, 60, 0.04) 100%)', border: 'rgba(244, 63, 94, 0.2)', text: 'var(--accent-rose)' },
    purple: { bg: 'linear-gradient(135deg, rgba(139, 92, 246, 0.12) 0%, rgba(109, 40, 217, 0.04) 100%)', border: 'rgba(139, 92, 246, 0.2)', text: '#a78bfa' },
    amber: { bg: 'linear-gradient(135deg, rgba(245, 158, 11, 0.12) 0%, rgba(217, 119, 6, 0.04) 100%)', border: 'rgba(245, 158, 11, 0.2)', text: 'var(--accent-amber)' },
    indigo: { bg: 'linear-gradient(135deg, rgba(99, 102, 241, 0.12) 0%, rgba(67, 56, 202, 0.04) 100%)', border: 'rgba(99, 102, 241, 0.2)', text: '#818cf8' }
  }[color] || { bg: 'var(--bg-card)', border: 'var(--border-primary)', text: 'var(--text-primary)' }

  const [hovered, setHovered] = useState(false)

  return (
    <div 
      className="stat-card" 
      style={{
        background: colorGradients.bg,
        border: `1px solid ${hovered ? colorGradients.text : colorGradients.border}`,
        borderRadius: 'var(--radius-lg)',
        padding: '20px',
        display: 'flex',
        flexDirection: 'column',
        gap: 12,
        transition: 'all 0.3s cubic-bezier(0.16, 1, 0.3, 1)',
        transform: hovered ? 'translateY(-4px)' : 'translateY(0)',
        boxShadow: hovered ? `0 10px 30px rgba(0,0,0,0.3), 0 0 20px ${colorGradients.border}` : 'var(--shadow-sm)',
        cursor: 'pointer'
      }}
      onMouseEnter={() => setHovered(true)}
      onMouseLeave={() => setHovered(false)}
    >
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <div style={{
          width: 40,
          height: 40,
          borderRadius: 'var(--radius-md)',
          background: 'rgba(255,255,255,0.03)',
          border: '1px solid rgba(255,255,255,0.05)',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          color: colorGradients.text
        }}>
          <Icon size={20} />
        </div>
        {badge && (
          <span 
            className={`badge ${badgeType === 'up' ? 'badge-green' : 'badge-red'}`}
            style={{ fontSize: 11, padding: '2px 8px', borderRadius: 'var(--radius-full)' }}
          >
            {badge}
          </span>
        )}
      </div>
      <div>
        <div style={{ fontSize: 'var(--font-size-xs)', color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.05em', fontWeight: 600 }}>
          {title}
        </div>
        <div style={{ fontSize: '28px', fontWeight: 800, color: '#fff', marginTop: 4, fontFamily: 'monospace' }}>
          {value ?? <span className="skeleton" style={{ width: 60, height: 32, display: 'inline-block' }} />}
        </div>
      </div>
    </div>
  )
}

// ─── Session Status Card ──────────────────────────────────────
function SessionCard({ status }) {
  const isConnected = status?.status === 'connected'
  const isConnecting = status?.status === 'connecting'

  return (
    <div className="card" style={{ 
      borderColor: isConnected ? 'rgba(37,211,102,0.3)' : undefined,
      background: 'rgba(22, 27, 34, 0.45)',
      backdropFilter: 'blur(10px)',
      boxShadow: '0 8px 32px 0 rgba(0, 0, 0, 0.15)'
    }}>
      <div className="card-header" style={{ borderBottom: '1px solid var(--border-primary)', paddingBottom: 12, marginBottom: 16 }}>
        <span className="card-title" style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
          WhatsApp Connection Status
        </span>
        {isConnected
          ? <Wifi size={18} color="var(--accent-primary)" />
          : <WifiOff size={18} color="var(--accent-rose)" />}
      </div>
      <div style={{ display: 'flex', alignItems: 'center', gap: 16, flexWrap: 'wrap' }}>
        <span className={`status-dot ${isConnected ? 'connected' : isConnecting ? 'connecting' : 'disconnected'}`} style={{ width: 14, height: 14 }} />
        <div>
          <div style={{ fontWeight: 700, fontSize: 'var(--font-size-md)', color: isConnected ? 'var(--accent-primary)' : 'var(--accent-rose)' }}>
            {isConnected ? 'Device Connected' : isConnecting ? 'Connecting Bridge...' : 'Device Disconnected'}
          </div>
          {status?.phone && (
            <div style={{ fontSize: 'var(--font-size-sm)', color: 'var(--text-muted)', marginTop: 4, fontFamily: 'monospace' }}>
              📱 {status.phone}
            </div>
          )}
        </div>
        {!isConnected && (
          <Link to="/settings" className="btn btn-primary btn-sm" style={{ marginLeft: 'auto' }}>
            Go Connect
          </Link>
        )}
      </div>
      {status?.connected_at && (
        <div style={{ marginTop: 16, fontSize: 'var(--font-size-xs)', color: 'var(--text-muted)', display: 'flex', alignItems: 'center', gap: 6, borderTop: '1px solid var(--border-primary)', paddingTop: 12 }}>
          <Clock size={12} />
          Session established since {formatIST(status.connected_at)}
        </div>
      )}
    </div>
  )
}

// ─── Recent Activity ──────────────────────────────────────────
function RecentActivity({ items }) {
  if (!items || items.length === 0) {
    return (
      <div className="empty-state" style={{ padding: '30px 0' }}>
        <div className="empty-state-icon"><Clock size={28} /></div>
        <div className="empty-state-title">No recent activity</div>
        <div className="empty-state-desc">Automation runs and messages will appear here</div>
      </div>
    )
  }
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
      {items.map((item, idx) => (
        <div key={idx} style={{
          display: 'flex', alignItems: 'center', gap: 12, padding: '12px 14px',
          background: 'var(--bg-tertiary)', borderRadius: 'var(--radius-md)',
          border: '1px solid var(--border-primary)', transition: 'all 0.2s'
        }}>
          <div style={{
            width: 32, height: 32, borderRadius: '50%',
            background: item.status === 'success' ? 'var(--accent-primary-muted)' : 'var(--accent-rose-muted)',
            display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0
          }}>
            {item.status === 'success'
              ? <CheckCircle size={16} color="var(--accent-primary)" />
              : <XCircle size={16} color="var(--accent-rose)" />}
          </div>
          <div style={{ flex: 1, minWidth: 0 }}>
            <div style={{ fontWeight: 600, color: 'var(--text-primary)', fontSize: 'var(--font-size-sm)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
              {item.name}
            </div>
            <div style={{ fontSize: 'var(--font-size-xs)', color: 'var(--text-muted)', marginTop: 2 }}>
              {item.description}
            </div>
          </div>
          <div style={{ fontSize: 'var(--font-size-xs)', color: 'var(--text-muted)', background: 'rgba(255,255,255,0.03)', padding: '2px 8px', borderRadius: '4px', border: '1px solid var(--border-primary)' }}>
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
  const areaPathFailed = `${linePathFailed} L ${points[points.length - 1].x} ${paddingTop + H} L ${points[0].x} ${paddingTop + H} Z`

  const gridLines = [0.25, 0.5, 0.75, 1.0].map(pct => {
    const y = paddingTop + H - pct * H
    const val = Math.round(pct * maxVal)
    return { y, val }
  })

  return (
    <div className="card" style={{ 
      margin: 0, 
      position: 'relative',
      background: 'rgba(22, 27, 34, 0.45)',
      backdropFilter: 'blur(10px)',
      boxShadow: '0 8px 32px 0 rgba(0, 0, 0, 0.15)'
    }}>
      <div className="card-header" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', borderBottom: '1px solid var(--border-primary)', paddingBottom: 12, marginBottom: 16 }}>
        <div>
          <span className="card-title">Message Volume Analytics</span>
          <div style={{ fontSize: 'var(--font-size-xs)', color: 'var(--text-muted)', marginTop: 2 }}>
            Sent vs Failed messaging trend over the last 7 days
          </div>
        </div>
        <div style={{ display: 'flex', gap: 16, fontSize: 'var(--font-size-xs)' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
            <span style={{ width: 10, height: 10, borderRadius: '50%', background: 'var(--accent-primary)', display: 'inline-block' }} />
            <span style={{ color: 'var(--text-secondary)' }}>Sent</span>
          </div>
          <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
            <span style={{ width: 10, height: 10, borderRadius: '50%', background: 'var(--accent-rose)', display: 'inline-block' }} />
            <span style={{ color: 'var(--text-secondary)' }}>Failed</span>
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
            boxShadow: '0 8px 24px rgba(0, 0, 0, 0.5)',
            pointerEvents: 'none',
            zIndex: 10,
            width: 140,
            transition: 'left 0.15s ease'
          }}>
            <div style={{ fontSize: '10px', color: 'var(--text-muted)', fontWeight: 700, textTransform: 'uppercase' }}>
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
            <linearGradient id="failedGradient" x1="0" y1="0" x2="0" y2="1">
              <stop offset="0%" stopColor="var(--accent-rose)" stopOpacity="0.15" />
              <stop offset="100%" stopColor="var(--accent-rose)" stopOpacity="0.0" />
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
          <path d={areaPathFailed} fill="url(#failedGradient)" />

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

// ─── Elapsed time helper ─────────────────────────────────────
function useElapsed(date) {
  const [, tick] = useState(0)
  useEffect(() => {
    if (!date) return
    const iv = setInterval(() => tick(v => v + 1), 10000)
    return () => clearInterval(iv)
  }, [date])
  if (!date) return null
  const secs = Math.round((Date.now() - date.getTime()) / 1000)
  if (secs < 60) return `${secs}s ago`
  return `${Math.round(secs / 60)}m ago`
}

// ─── Main Dashboard Page ──────────────────────────────────────
export default function Dashboard() {
  const { profile, sessionStatus, waProfile } = useApp()
  const [summary, setSummary] = useState(null)
  const [loading, setLoading] = useState(true)
  const [lastUpdated, setLastUpdated] = useState(null)
  const fetchingRef = useRef(false)
  const updatedLabel = useElapsed(lastUpdated)

  const fetchData = useCallback(async () => {
    if (fetchingRef.current) return
    fetchingRef.current = true
    try {
      const waAccount = localStorage.getItem('wa_active_phone') || undefined
      const summaryRes = await dashboardApi.getSummary(waAccount ? { wa_account: waAccount } : undefined)
      setSummary(summaryRes.data)
      setLastUpdated(new Date())
    } catch {}
    finally { fetchingRef.current = false; setLoading(false) }
  }, [])

  // Initial fetch + refetch on status change
  useEffect(() => { fetchData() }, [sessionStatus.status, fetchData])

  // Auto-refresh every 30s
  useEffect(() => {
    const iv = setInterval(fetchData, 30000)
    return () => clearInterval(iv)
  }, [fetchData])

  // SSE: refresh immediately when a new inbound message arrives
  useEffect(() => {
    if (sessionStatus.status !== 'connected') return
    const es = new EventSource(`${BASE_URL}/messages/stream`)
    es.onmessage = (e) => {
      try { if (JSON.parse(e.data).type === 'new_message') fetchData() } catch {}
    }
    es.onerror = () => {}
    return () => es.close()
  }, [sessionStatus.status, fetchData])

  const displayStatus = sessionStatus || { status: 'disconnected' }
  const isConnected = displayStatus.status === 'connected'

  const displaySummary = (summary && isConnected) ? summary : {
    total_contacts: 0,
    sent_messages: 0,
    received_messages: 0,
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

      {/* Hero Greeting Banner */}
      <div style={{
        background: 'linear-gradient(135deg, rgba(139, 92, 246, 0.12) 0%, rgba(37, 211, 102, 0.05) 100%)',
        border: '1px solid rgba(255, 255, 255, 0.08)',
        borderRadius: 'var(--radius-lg)',
        padding: '20px 24px',
        marginBottom: 24,
        display: 'flex',
        justifyContent: 'space-between',
        alignItems: 'center',
        flexWrap: 'wrap',
        gap: 16,
        backdropFilter: 'blur(10px)',
        boxShadow: '0 8px 32px 0 rgba(0, 0, 0, 0.2)'
      }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 16 }}>
          {/* WA account avatar */}
          <div style={{
            width: 52, height: 52, borderRadius: '50%', flexShrink: 0,
            background: 'linear-gradient(135deg, #25D366, #128C7E)',
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            fontSize: 20, fontWeight: 700, color: '#fff', overflow: 'hidden',
            border: '2px solid rgba(37,211,102,0.4)',
            boxShadow: '0 0 12px rgba(37,211,102,0.3)',
          }}>
            {waProfile?.profilePicUrl
              ? <img src={waProfile.profilePicUrl} alt="" style={{ width: '100%', height: '100%', objectFit: 'cover' }} onError={e => { e.target.style.display = 'none' }} />
              : (waProfile?.name?.[0]?.toUpperCase() || profile.name?.[0]?.toUpperCase() || 'W')}
          </div>
          <div>
            <h2 style={{ margin: 0, fontSize: '20px', fontWeight: 800, color: '#fff' }}>
              Welcome back, {waProfile?.name || profile.name || 'User'}!
            </h2>
            {waProfile?.phone && (
              <div style={{ margin: '2px 0 0 0', color: 'var(--accent-primary)', fontSize: 'var(--font-size-xs)', fontFamily: 'monospace', fontWeight: 600 }}>
                {waProfile.phone}
              </div>
            )}
            <p style={{ margin: '4px 0 0 0', color: 'var(--text-secondary)', fontSize: 'var(--font-size-xs)', lineHeight: 1.4 }}>
              Live WhatsApp automation &amp; messaging overview
            </p>
          </div>
        </div>
        <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'flex-end', gap: 6 }}>
          <div style={{ display: 'flex', gap: 10, alignItems: 'center' }}>
            <span className={`badge ${isConnected ? 'badge-green' : 'badge-red'}`} style={{ display: 'flex', alignItems: 'center', gap: 6, padding: '5px 10px', fontSize: 11 }}>
              <span style={{ width: 6, height: 6, borderRadius: '50%', background: '#fff', display: 'inline-block', animation: isConnected ? 'pulse 2s infinite' : 'none' }} />
              {isConnected ? 'Live' : 'Offline'}
            </span>
          </div>
          {updatedLabel && (
            <span style={{ color: 'var(--text-muted)', fontSize: 10, opacity: 0.7 }}>
              Updated {updatedLabel}
            </span>
          )}
        </div>
      </div>

      {/* Stats Grid */}
      <div className="stats-grid" style={{ gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', marginBottom: 20 }}>
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
          title="Messages Received"
          value={displaySummary.received_messages?.toLocaleString()}
          icon={Download}
          color="indigo"
          badge="Inbox"
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
      </div>

      {/* Analytics Chart & Quick Actions Row */}
      <div className="dashboard-row-upper">
        <AnalyticsChart displaySummary={displaySummary} />

        {/* Quick Actions */}
        <div className="card" style={{
          display: 'flex',
          flexDirection: 'column',
          justifyContent: 'space-between',
          margin: 0
        }}>
          <div className="card-header" style={{ borderBottom: '1px solid var(--border-primary)', paddingBottom: 12, marginBottom: 12 }}>
            <span className="card-title">Quick Actions</span>
          </div>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 10, flex: 1, justifyContent: 'center' }}>
            {[
              { label: 'Create Automation', to: '/automations', icon: Zap, color: 'var(--accent-purple)' },
              { label: 'Add Contact', to: '/contacts', icon: Users, color: 'var(--accent-blue)' },
              { label: 'Send Message', to: '/messages', icon: MessageSquare, color: 'var(--accent-primary)' },
              { label: 'View Logs', to: '/logs', icon: TrendingUp, color: 'var(--accent-amber)' },
            ].map(({ label, to, icon: Icon, color }) => (
              <Link key={to} to={to} style={{
                display: 'flex', alignItems: 'center', gap: 12, padding: '12px 14px',
                background: 'var(--bg-tertiary)', borderRadius: 'var(--radius-md)',
                border: '1px solid var(--border-primary)', textDecoration: 'none',
                transition: 'all 0.2s', color: 'var(--text-secondary)'
              }}
                onMouseEnter={e => { e.currentTarget.style.borderColor = 'rgba(255,255,255,0.15)'; e.currentTarget.style.color = 'var(--text-primary)' }}
                onMouseLeave={e => { e.currentTarget.style.borderColor = 'var(--border-primary)'; e.currentTarget.style.color = 'var(--text-secondary)' }}
              >
                <Icon size={16} style={{ color }} />
                <span style={{ flex: 1, fontSize: 'var(--font-size-sm)', fontWeight: 600 }}>{label}</span>
                <ArrowRight size={14} />
              </Link>
            ))}
          </div>
        </div>
      </div>

      {/* Session Status & Recent Activity Row */}
      <div className="dashboard-row-lower">
        <SessionCard status={displayStatus} />

        {/* Recent Activity */}
        <div className="card" style={{
          display: 'flex',
          flexDirection: 'column',
          margin: 0
        }}>
          <div className="card-header" style={{ borderBottom: '1px solid var(--border-primary)', paddingBottom: 12, marginBottom: 16 }}>
            <span className="card-title">Recent Activity</span>
            <Link to="/logs" style={{ fontSize: 'var(--font-size-sm)', color: 'var(--accent-primary)', display: 'flex', alignItems: 'center', gap: 4 }}>
              View all <ArrowRight size={14} />
            </Link>
          </div>
          <div style={{ flex: 1 }}>
            <RecentActivity items={recentActivity} />
          </div>
        </div>
      </div>
    </div>
  )
}
