import { useState, useEffect, useCallback } from 'react'
import { ScrollText, Search, CheckCircle, XCircle, Clock, ChevronDown, ChevronUp, AlertTriangle } from 'lucide-react'
import { logsApi } from '../../services/api'
import { formatIST } from '../../utils/date'


function renderLogOutput(raw) {
  if (!raw) return 'No detailed output available.'
  if (typeof raw === 'object') return JSON.stringify(raw, null, 2)
  try {
    const parsed = JSON.parse(raw)
    if (typeof parsed === 'object') return JSON.stringify(parsed, null, 2)
  } catch {}
  return raw
}

function LogRow({ log }) {
  const [expanded, setExpanded] = useState(false)

  const statusBadge = {
    success: <span className="badge badge-green"><CheckCircle size={11} /> Success</span>,
    failed: <span className="badge badge-red"><XCircle size={11} /> Failed</span>,
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
              {log.steps_executed && (
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

  const fetchLogs = useCallback(async () => {
    setLoading(true)
    try {
      const res = await logsApi.getAll({ search, status: statusFilter === 'all' ? undefined : statusFilter, limit: 50 })
      setLogs(res.data?.logs || res.data || [])
    } catch { setLogs([]) } finally { setLoading(false) }
  }, [search, statusFilter])

  useEffect(() => {
    const t = setTimeout(fetchLogs, 300)
    return () => clearTimeout(t)
  }, [fetchLogs])

  return (
    <div>
      <div className="page-header">
        <div>
          <h2 className="page-title">Execution Logs</h2>
          <p className="page-subtitle">Monitor automation runs, errors, and execution details</p>
        </div>
        <button className="btn btn-secondary btn-sm" onClick={fetchLogs}>Refresh</button>
      </div>

      {/* Status Filters */}
      <div style={{ display: 'flex', gap: 8, marginBottom: 20 }}>
        {['all', 'success', 'failed', 'running'].map(s => (
          <button key={s} className={`btn btn-sm ${statusFilter === s ? 'btn-primary' : 'btn-secondary'}`} onClick={() => setStatusFilter(s)}>
            {s.charAt(0).toUpperCase() + s.slice(1)}
          </button>
        ))}
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
