import { useState, useEffect, useCallback, useRef } from 'react'
import {
  ScrollText, Search, CheckCircle, XCircle, Clock,
  ChevronDown, ChevronUp, AlertTriangle, RefreshCw, Trash2, RotateCcw
} from 'lucide-react'
import { logsApi } from '../../services/api'
import { formatIST } from '../../utils/date'

const DATE_FILTERS = [
  { id: 'all',   label: 'All time' },
  { id: 'today', label: 'Today' },
  { id: '7d',    label: 'Last 7 days' },
  { id: '30d',   label: 'Last 30 days' },
]

function getDateFrom(filter) {
  const now = new Date()
  if (filter === 'today') { const d = new Date(now); d.setHours(0,0,0,0); return d.toISOString() }
  if (filter === '7d')  { const d = new Date(now); d.setDate(d.getDate() - 7);  return d.toISOString() }
  if (filter === '30d') { const d = new Date(now); d.setDate(d.getDate() - 30); return d.toISOString() }
  return undefined
}

function renderLogOutput(raw) {
  if (!raw) return 'No detailed output available.'
  if (typeof raw === 'object') return JSON.stringify(raw, null, 2)
  try { const p = JSON.parse(raw); if (typeof p === 'object') return JSON.stringify(p, null, 2) } catch {}
  return raw
}

function LogRow({ log }) {
  const [expanded, setExpanded] = useState(false)

  const statusBadge = {
    success: <span className="badge badge-green"><CheckCircle size={11} /> Success</span>,
    failed:  <span className="badge badge-red"><XCircle size={11} /> Failed</span>,
    running: <span className="badge badge-amber"><Clock size={11} /> Running</span>,
    partial: <span className="badge badge-amber"><AlertTriangle size={11} /> Partial</span>,
  }[log.status] || <span className="badge badge-gray">{log.status}</span>

  return (
    <>
      <tr style={{ cursor: 'pointer' }} onClick={() => setExpanded(!expanded)}>
        <td className="td-primary">{log.automation_name || `Run #${log.id}`}</td>
        <td>{statusBadge}</td>
        <td style={{ fontSize: 'var(--font-size-xs)', color: 'var(--text-muted)' }}>
          {log.execution_time ? `${log.execution_time}ms` : '—'}
        </td>
        <td style={{ fontSize: 'var(--font-size-xs)', color: 'var(--text-muted)' }}>
          {log.started_at ? formatIST(log.started_at) : '—'}
        </td>
        <td style={{ fontSize: 'var(--font-size-xs)', color: 'var(--text-muted)' }}>
          {log.finished_at ? formatIST(log.finished_at) : '—'}
        </td>
        <td>{expanded ? <ChevronUp size={14} /> : <ChevronDown size={14} />}</td>
      </tr>
      {expanded && (
        <tr>
          <td colSpan={6} style={{ padding: 0 }}>
            <div style={{ background: 'var(--bg-primary)', padding: '16px 24px', borderTop: '1px solid var(--border-primary)' }}>
              {log.error_message && (
                <div style={{ background: 'var(--accent-rose-muted)', border: '1px solid rgba(244,63,94,0.3)', borderRadius: 'var(--radius-md)', padding: '12px 14px', marginBottom: 12, fontSize: 'var(--font-size-sm)', color: 'var(--accent-rose)' }}>
                  <strong>Error:</strong> {log.error_message}
                </div>
              )}
              <div style={{ fontFamily: 'monospace', fontSize: 12, color: 'var(--text-secondary)', background: 'var(--bg-tertiary)', padding: 12, borderRadius: 'var(--radius-md)', whiteSpace: 'pre-wrap', maxHeight: 200, overflow: 'auto' }}>
                {renderLogOutput(log.log_output || log.details)}
              </div>
              {log.steps_executed != null && (
                <div style={{ marginTop: 12, fontSize: 'var(--font-size-xs)', color: 'var(--text-muted)' }}>
                  Steps executed: {log.steps_executed} / {log.total_steps}
                </div>
              )}
            </div>
          </td>
        </tr>
      )}
    </>
  )
}

export default function Logs() {
  const [logs, setLogs] = useState([])
  const [loading, setLoading] = useState(true)
  const [search, setSearch] = useState('')
  const [statusFilter, setStatusFilter] = useState('all')
  const [dateFilter, setDateFilter] = useState('all')
  const [autoRefresh, setAutoRefresh] = useState(false)
  const [clearing, setClearing] = useState(false)
  const [lastRefresh, setLastRefresh] = useState(null)
  const autoRefreshRef = useRef(null)

  const fetchLogs = useCallback(async () => {
    setLoading(true)
    try {
      const params = {
        search: search || undefined,
        status: statusFilter !== 'all' ? statusFilter : undefined,
        limit: 100,
        date_from: getDateFrom(dateFilter) || undefined,
      }
      const res = await logsApi.getAll(params)
      setLogs(res.data?.logs || res.data || [])
      setLastRefresh(new Date())
    } catch { setLogs([]) } finally { setLoading(false) }
  }, [search, statusFilter, dateFilter])

  useEffect(() => {
    const t = setTimeout(fetchLogs, 300)
    return () => clearTimeout(t)
  }, [fetchLogs])

  // Auto-refresh interval
  useEffect(() => {
    if (autoRefreshRef.current) clearInterval(autoRefreshRef.current)
    if (autoRefresh) {
      autoRefreshRef.current = setInterval(fetchLogs, 10000)
    }
    return () => { if (autoRefreshRef.current) clearInterval(autoRefreshRef.current) }
  }, [autoRefresh, fetchLogs])

  const handleClear = async () => {
    if (!window.confirm('Delete all execution logs? This cannot be undone.')) return
    setClearing(true)
    try { await logsApi.clear(); await fetchLogs() } catch {} finally { setClearing(false) }
  }

  // Stats computed from loaded logs
  const stats = [
    { label: 'Total',   value: logs.length,                                        color: 'var(--text-secondary)',  bg: 'var(--bg-tertiary)' },
    { label: 'Success', value: logs.filter(l => l.status === 'success').length,    color: 'var(--accent-green)',    bg: 'rgba(37,211,102,0.08)' },
    { label: 'Failed',  value: logs.filter(l => l.status === 'failed').length,     color: 'var(--accent-rose)',     bg: 'rgba(244,63,94,0.08)' },
    { label: 'Running', value: logs.filter(l => l.status === 'running').length,    color: '#f59e0b',                bg: 'rgba(245,158,11,0.08)' },
  ]

  return (
    <div>
      <div className="page-header">
        <div>
          <h2 className="page-title">Execution Logs</h2>
          <p className="page-subtitle">Monitor automation runs, errors, and execution details</p>
        </div>
        <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
          {/* Auto-refresh toggle */}
          <button
            className={`btn btn-sm ${autoRefresh ? 'btn-primary' : 'btn-secondary'}`}
            onClick={() => setAutoRefresh(v => !v)}
            title={autoRefresh ? 'Auto-refresh ON (every 10s)' : 'Enable auto-refresh'}
          >
            <RotateCcw size={13} style={{ animation: autoRefresh ? 'spin 2s linear infinite' : 'none' }} />
            {autoRefresh ? 'Auto ON' : 'Auto OFF'}
          </button>
          <button className="btn btn-secondary btn-sm" onClick={fetchLogs} disabled={loading}>
            <RefreshCw size={13} /> Refresh
          </button>
          <button className="btn btn-danger btn-sm" onClick={handleClear} disabled={clearing}>
            <Trash2 size={13} /> {clearing ? 'Clearing...' : 'Clear All'}
          </button>
        </div>
      </div>

      {/* Stats tiles */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 12, marginBottom: 20 }}>
        {stats.map(s => (
          <div key={s.label} style={{ background: s.bg, borderRadius: 'var(--radius-lg)', padding: '14px 18px', display: 'flex', flexDirection: 'column', gap: 4 }}>
            <span style={{ fontSize: 11, color: 'var(--text-muted)', fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.05em' }}>{s.label}</span>
            <span style={{ fontSize: 26, fontWeight: 800, color: s.color, lineHeight: 1 }}>{s.value}</span>
          </div>
        ))}
      </div>

      {/* Filters row */}
      <div style={{ display: 'flex', gap: 8, marginBottom: 16, flexWrap: 'wrap', alignItems: 'center' }}>
        {/* Status */}
        <div style={{ display: 'flex', gap: 6 }}>
          {['all', 'success', 'failed', 'running'].map(s => (
            <button key={s} className={`btn btn-sm ${statusFilter === s ? 'btn-primary' : 'btn-secondary'}`} onClick={() => setStatusFilter(s)}>
              {s.charAt(0).toUpperCase() + s.slice(1)}
            </button>
          ))}
        </div>

        <div style={{ width: 1, height: 24, background: 'var(--border-primary)', margin: '0 4px' }} />

        {/* Date range */}
        <div style={{ display: 'flex', gap: 6 }}>
          {DATE_FILTERS.map(f => (
            <button key={f.id} className={`btn btn-sm ${dateFilter === f.id ? 'btn-primary' : 'btn-secondary'}`} onClick={() => setDateFilter(f.id)}>
              {f.label}
            </button>
          ))}
        </div>

        {lastRefresh && (
          <span style={{ fontSize: 11, color: 'var(--text-muted)', marginLeft: 'auto' }}>
            {autoRefresh && <RotateCcw size={10} style={{ marginRight: 4, verticalAlign: 'middle' }} />}
            Updated {lastRefresh.toLocaleTimeString()}
          </span>
        )}
      </div>

      <div className="table-container">
        <div className="table-toolbar">
          <div className="search-bar">
            <Search size={15} className="search-bar-icon" />
            <input className="form-input" placeholder="Search logs..." value={search} onChange={e => setSearch(e.target.value)} style={{ paddingLeft: 38 }} />
          </div>
          <div style={{ fontSize: 'var(--font-size-sm)', color: 'var(--text-muted)' }}>{logs.length} entries</div>
        </div>

        {loading ? (
          <div style={{ padding: 48, textAlign: 'center', color: 'var(--text-muted)' }}>Loading logs...</div>
        ) : logs.length === 0 ? (
          <div className="empty-state">
            <div className="empty-state-icon"><ScrollText size={28} /></div>
            <div className="empty-state-title">No logs found</div>
            <div className="empty-state-desc">Automation execution logs will appear here</div>
          </div>
        ) : (
          <table>
            <thead>
              <tr>
                <th>Automation</th>
                <th>Status</th>
                <th>Duration</th>
                <th>Started</th>
                <th>Finished</th>
                <th></th>
              </tr>
            </thead>
            <tbody>
              {logs.map(log => <LogRow key={log.id} log={log} />)}
            </tbody>
          </table>
        )}
      </div>
    </div>
  )
}
