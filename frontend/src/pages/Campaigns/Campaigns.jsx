import { useState, useEffect, useCallback } from 'react'
import {
  Send, Plus, Calendar, Clock, Play, Pause, XCircle,
  Search, ArrowLeft, RefreshCw, CheckCircle, AlertTriangle,
  Eye, Check, ShieldAlert, Sliders, FileText, Sparkles, X, WifiOff
} from 'lucide-react'
import { campaignsApi, contactsApi, whatsappApi } from '../../services/api'
import { Link } from 'react-router-dom'
import { formatIST, formatISTTime } from '../../utils/date'
import { getErrorMessage } from '../../utils/error'

// ─── Campaign Donut Chart Component ──────────────────────────
function CampaignDonutChart({ total, sent, failed, queued }) {
  const r = 40
  const circ = 2 * Math.PI * r
  
  const valTotal = total || 1 // Avoid division by zero
  
  const pctSent = sent / valTotal
  const pctFailed = failed / valTotal
  const pctQueued = queued / valTotal
  
  const lenSent = pctSent * circ
  const lenFailed = pctFailed * circ
  const lenQueued = pctQueued * circ
  
  const offsetSent = -circ / 4
  const offsetFailed = offsetSent - lenSent
  const offsetQueued = offsetFailed - lenFailed

  return (
    <div className="card" style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', padding: '12px 16px', height: '100%', background: 'var(--bg-tertiary)', margin: 0 }}>
      <span style={{ fontSize: 'var(--font-size-xs)', fontWeight: 600, color: 'var(--text-secondary)', marginBottom: 8 }}>Delivery Split</span>
      
      <div style={{ position: 'relative', width: 90, height: 90 }}>
        <svg width="100%" height="100%" viewBox="0 0 100 100">
          <circle 
            cx="50" 
            cy="50" 
            r={r} 
            fill="transparent" 
            stroke="var(--border-primary)" 
            strokeWidth="8" 
          />
          {total > 0 ? (
            <>
              {lenSent > 0 && (
                <circle 
                  cx="50" 
                  cy="50" 
                  r={r} 
                  fill="transparent" 
                  stroke="var(--accent-primary)" 
                  strokeWidth="8" 
                  strokeDasharray={`${lenSent} ${circ}`} 
                  strokeDashoffset={offsetSent}
                  strokeLinecap="round"
                />
              )}
              {lenFailed > 0 && (
                <circle 
                  cx="50" 
                  cy="50" 
                  r={r} 
                  fill="transparent" 
                  stroke="var(--accent-rose)" 
                  strokeWidth="8" 
                  strokeDasharray={`${lenFailed} ${circ}`} 
                  strokeDashoffset={offsetFailed}
                  strokeLinecap="round"
                />
              )}
              {lenQueued > 0 && (
                <circle 
                  cx="50" 
                  cy="50" 
                  r={r} 
                  fill="transparent" 
                  stroke="var(--accent-purple)" 
                  strokeWidth="8" 
                  strokeDasharray={`${lenQueued} ${circ}`} 
                  strokeDashoffset={offsetQueued}
                  strokeLinecap="round"
                />
              )}
            </>
          ) : (
            <circle 
              cx="50" 
              cy="50" 
              r={r} 
              fill="transparent" 
              stroke="var(--text-muted)" 
              strokeWidth="8" 
              strokeDasharray="4 4" 
            />
          )}
        </svg>
        
        <div style={{
          position: 'absolute',
          top: '50%',
          left: '50%',
          transform: 'translate(-50%, -50%)',
          textAlign: 'center'
        }}>
          <div style={{ fontSize: '13px', fontWeight: 700, color: 'var(--text-primary)' }}>
            {total > 0 ? Math.round((sent / total) * 100) : 0}%
          </div>
          <div style={{ fontSize: '8px', color: 'var(--text-muted)', textTransform: 'uppercase', fontWeight: 600 }}>
            Sent
          </div>
        </div>
      </div>
      
      <div style={{ display: 'flex', gap: 8, marginTop: 8, flexWrap: 'wrap', justifyContent: 'center' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 3, fontSize: '8px', color: 'var(--text-secondary)' }}>
          <span style={{ width: 6, height: 6, borderRadius: '50%', background: 'var(--accent-primary)' }} />
          <span>Sent ({sent})</span>
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: 3, fontSize: '8px', color: 'var(--text-secondary)' }}>
          <span style={{ width: 6, height: 6, borderRadius: '50%', background: 'var(--accent-rose)' }} />
          <span>Failed ({failed})</span>
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: 3, fontSize: '8px', color: 'var(--text-secondary)' }}>
          <span style={{ width: 6, height: 6, borderRadius: '50%', background: 'var(--accent-purple)' }} />
          <span>Queued ({queued})</span>
        </div>
      </div>
    </div>
  )
}

export default function Campaigns() {
  const [campaigns, setCampaigns] = useState([])
  const [totalCampaigns, setTotalCampaigns] = useState(0)
  const [loadingCampaigns, setLoadingCampaigns] = useState(true)
  const [page, setPage] = useState(1)

  // WhatsApp connection states
  const [sessionStatus, setSessionStatus] = useState({ status: 'disconnected' })
  const [loadingSession, setLoadingSession] = useState(true)

  useEffect(() => {
    whatsappApi.getStatus().then(res => {
      setSessionStatus(res.data)
      setLoadingSession(false)
    }).catch(() => {
      setSessionStatus({ status: 'disconnected' })
      setLoadingSession(false)
    })
  }, [])

  // Drawer / Modal states
  const [showCreateModal, setShowCreateModal] = useState(false)
  const [selectedCampaign, setSelectedCampaign] = useState(null)
  
  // Create campaign form states
  const [name, setName] = useState('')
  const [delaySeconds, setDelaySeconds] = useState(5)
  const [concurrency, setConcurrency] = useState(1)
  const [template, setTemplate] = useState('')
  const [scheduleDate, setScheduleDate] = useState(() => {
    // Current local datetime string formatted for datetime-local inputs
    const d = new Date()
    d.setMinutes(d.getMinutes() - d.getTimezoneOffset())
    return d.toISOString().slice(0, 16)
  })
  
  // Contacts Selection
  const [contacts, setContacts] = useState([])
  const [selectedContactIds, setSelectedContactIds] = useState([])
  const [searchContact, setSearchContact] = useState('')
  const [loadingContacts, setLoadingContacts] = useState(false)

  // Queue Inspector states
  const [jobs, setJobs] = useState([])
  const [totalJobs, setTotalJobs] = useState(0)
  const [jobsPage, setJobsPage] = useState(1)
  const [filterJobStatus, setFilterJobStatus] = useState('')
  const [searchJobPhone, setSearchJobPhone] = useState('')
  const [loadingJobs, setLoadingJobs] = useState(false)

  // Fetch campaigns
  const fetchCampaigns = useCallback(async () => {
    setLoadingCampaigns(true)
    try {
      const res = await campaignsApi.getAll({ page, limit: 10 })
      setCampaigns(res.data?.campaigns || [])
      setTotalCampaigns(res.data?.total || 0)
    } catch (err) {
      console.error('Failed to fetch campaigns:', err)
    } finally {
      setLoadingCampaigns(false)
    }
  }, [page])

  useEffect(() => {
    fetchCampaigns()
    // Poll campaigns every 8 seconds for active status bar updates
    const interval = setInterval(fetchCampaigns, 8000)
    return () => clearInterval(interval)
  }, [fetchCampaigns])

  // Fetch contacts for create campaign form
  const fetchContacts = async () => {
    setLoadingContacts(true)
    try {
      const res = await contactsApi.getAll({ limit: 100 })
      setContacts(res.data?.contacts || res.data || [])
    } catch (err) {
      console.error('Failed to load contacts:', err)
    } finally {
      setLoadingContacts(false)
    }
  }

  // Open Create Campaign
  const handleOpenCreateModal = () => {
    fetchContacts()
    setName('')
    setDelaySeconds(5)
    setConcurrency(1)
    setSelectedContactIds([])
    const d = new Date()
    d.setMinutes(d.getMinutes() - d.getTimezoneOffset())
    setScheduleDate(d.toISOString().slice(0, 16))
    setShowCreateModal(true)
  }

  // Create Campaign Submit
  const handleCreateSubmit = async (e) => {
    e.preventDefault()
    if (selectedContactIds.length === 0) {
      alert('Please select at least one contact.')
      return
    }
    
    // Validate scheduled_at
    const schedTime = new Date(scheduleDate)
    if (isNaN(schedTime.getTime())) {
      alert('Please enter a valid schedule date.')
      return
    }

    const payload = {
      name,
      delay_seconds: parseInt(delaySeconds),
      concurrency: parseInt(concurrency),
      contacts: selectedContactIds,
      template,
      scheduled_at: schedTime.toISOString()
    }

    try {
      await campaignsApi.create(payload)
      setShowCreateModal(false)
      fetchCampaigns()
    } catch (err) {
      alert(getErrorMessage(err, 'Failed to create campaign.'))
    }
  }

  // Campaign Controls
  const handlePause = async (id) => {
    try {
      await campaignsApi.pause(id)
      fetchCampaigns()
    } catch (err) {
      alert('Failed to pause campaign')
    }
  }

  const handleResume = async (id) => {
    try {
      await campaignsApi.resume(id)
      fetchCampaigns()
    } catch (err) {
      alert('Failed to resume campaign')
    }
  }

  const handleCancel = async (id) => {
    if (!confirm('Are you sure you want to cancel this campaign? Pending messages will not be sent.')) return
    try {
      await campaignsApi.cancel(id)
      fetchCampaigns()
    } catch (err) {
      alert('Failed to cancel campaign')
    }
  }

  // Queue Inspector: Fetch Jobs
  const fetchJobs = useCallback(async () => {
    if (!selectedCampaign) return
    setLoadingJobs(true)
    try {
      const res = await campaignsApi.getJobs(selectedCampaign.id, {
        page: jobsPage,
        limit: 10,
        status: filterJobStatus || undefined,
        phone: searchJobPhone || undefined
      })
      setJobs(res.data?.jobs || [])
      setTotalJobs(res.data?.total || 0)
    } catch (err) {
      console.error('Failed to fetch jobs:', err)
    } finally {
      setLoadingJobs(false)
    }
  }, [selectedCampaign, jobsPage, filterJobStatus, searchJobPhone])

  useEffect(() => {
    fetchJobs()
  }, [fetchJobs])

  const handleOpenInspector = (campaign) => {
    setSelectedCampaign(campaign)
    setJobsPage(1)
    setFilterJobStatus('')
    setSearchJobPhone('')
    setJobs([])
  }

  const handleCancelJob = async (jobId) => {
    if (!confirm('Cancel this specific message job?')) return
    try {
      await campaignsApi.cancelJob(selectedCampaign.id, jobId)
      fetchJobs()
      fetchCampaigns()
    } catch (err) {
      alert('Failed to cancel job')
    }
  }

  const handleRetryJob = async (jobId) => {
    try {
      await campaignsApi.retryJob(selectedCampaign.id, jobId)
      fetchJobs()
      fetchCampaigns()
    } catch (err) {
      alert('Failed to retry job')
    }
  }

  // Render Status Badge
  const getStatusBadge = (status) => {
    const statusMap = {
      active: { label: 'Active', class: 'badge badge-success' },
      paused: { label: 'Paused', class: 'badge badge-warning' },
      completed: { label: 'Completed', class: 'badge badge-info' },
      cancelled: { label: 'Cancelled', class: 'badge badge-danger' },
    }
    const current = statusMap[status] || { label: status, class: 'badge badge-secondary' }
    return <span className={current.class}>{current.label}</span>
  }

  // Render Job Status Badge
  const getJobStatusBadge = (status) => {
    const jobStatusMap = {
      queued: { label: 'Queued', color: 'var(--text-muted)' },
      sending: { label: 'Sending', color: 'var(--accent-amber)' },
      sent: { label: 'Sent', color: 'var(--accent-primary)' },
      failed: { label: 'Failed', color: 'var(--accent-rose)' },
      cancelled: { label: 'Cancelled', color: 'var(--text-muted)' },
      delivered: { label: 'Delivered', color: '#53bdeb' },
      read: { label: 'Read', color: '#53bdeb' },
    }
    const current = jobStatusMap[status] || { label: status, color: 'var(--text-muted)' }
    return <span style={{ color: current.color, fontWeight: 600, fontSize: '11px' }}>{current.label.toUpperCase()}</span>
  }

  const filteredContacts = contacts.filter(c => 
    c.name.toLowerCase().includes(searchContact.toLowerCase()) ||
    c.phone.includes(searchContact)
  )

  const handleToggleContact = (id) => {
    setSelectedContactIds(prev => 
      prev.includes(id) ? prev.filter(x => x !== id) : [...prev, id]
    )
  }

  const handleSelectAllContacts = () => {
    if (selectedContactIds.length === filteredContacts.length) {
      setSelectedContactIds([])
    } else {
      setSelectedContactIds(filteredContacts.map(c => c.id))
    }
  }

  if (loadingSession) {
    return (
      <div style={{ display: 'flex', justifyContent: 'center', alignItems: 'center', height: 'calc(100vh - 120px)', color: 'var(--text-muted)' }}>
        <RefreshCw className="animate-spin" size={24} style={{ marginRight: 8, animation: 'spin 1s linear infinite' }} /> Loading connection state...
      </div>
    )
  }

  if (sessionStatus.status !== 'connected') {
    return (
      <div>
        <div className="page-header">
          <div>
            <h2 className="page-title">Bulk Campaigns</h2>
            <p className="page-subtitle">Schedule, deliver, and monitor bulk WhatsApp message campaigns</p>
          </div>
        </div>
        
        <div className="card empty-state" style={{ padding: '60px 20px', textAlign: 'center', marginTop: 20 }}>
          <WifiOff size={48} style={{ margin: '0 auto 16px', color: 'var(--accent-rose)' }} />
          <h3>WhatsApp Connection Required</h3>
          <p style={{ maxWidth: 420, margin: '8px auto 20px', fontSize: 'var(--font-size-sm)', color: 'var(--text-secondary)', lineHeight: 1.6 }}>
            To build templates, select contact groups, and schedule bulk campaign runs, please connect your WhatsApp account in Settings.
          </p>
          <Link to="/settings" className="btn btn-primary">
            Go to Settings & Connect
          </Link>
        </div>
      </div>
    )
  }

  return (
    <div style={{ position: 'relative', minHeight: 'calc(100vh - 120px)' }}>
      
      {/* ─── MAIN LIST VIEW ─── */}
      {!selectedCampaign ? (
        <>
          {/* Page Header */}
          <div className="page-header">
            <div>
              <h2 className="page-title">Bulk Campaigns</h2>
              <p className="page-subtitle">Schedule, deliver, and monitor bulk WhatsApp message campaigns</p>
            </div>
            <button className="btn btn-primary" onClick={handleOpenCreateModal}>
              <Plus size={16} /> Create Campaign
            </button>
          </div>

          {/* Campaigns Grid/List */}
          {loadingCampaigns && campaigns.length === 0 ? (
            <div style={{ textAlign: 'center', padding: '60px 0', color: 'var(--text-muted)' }}>
              <RefreshCw className="animate-spin" style={{ margin: '0 auto 12px' }} />
              Loading campaigns...
            </div>
          ) : campaigns.length === 0 ? (
            <div className="card empty-state" style={{ padding: '60px 20px', textAlign: 'center' }}>
              <Send size={48} style={{ margin: '0 auto 16px', color: 'var(--border-primary)' }} />
              <h3>No campaigns yet</h3>
              <p style={{ maxWidth: 360, margin: '8px auto 16px', fontSize: 'var(--font-size-sm)' }}>
                Create a marketing or notification campaign to send personalized staggered messages to multiple contacts.
              </p>
              <button className="btn btn-primary" onClick={handleOpenCreateModal}>
                Create Your First Campaign
              </button>
            </div>
          ) : (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
              {campaigns.map(c => {
                const completed = c.completed_jobs + c.failed_jobs
                const total = c.total_jobs
                const progressPct = total > 0 ? Math.round((completed / total) * 100) : 0
                
                return (
                  <div key={c.id} className="card" style={{ background: 'var(--bg-tertiary)', border: '1px solid var(--border-primary)' }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', flexWrap: 'wrap', gap: 12 }}>
                      <div>
                        <h3 style={{ margin: 0, fontSize: 'var(--font-size-lg)', fontWeight: 600, color: 'var(--text-primary)' }}>
                          {c.name}
                        </h3>
                        <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginTop: 6, fontSize: 'var(--font-size-xs)', color: 'var(--text-muted)' }}>
                          <span>Created: {formatIST(c.created_at)}</span>
                          <span>•</span>
                          <span>Delay: {c.delay_seconds}s</span>
                          <span>•</span>
                          <span>Concurrency: {c.concurrency}</span>
                        </div>
                      </div>
                      
                      <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
                        {getStatusBadge(c.status)}
                        
                        {/* Control Actions */}
                        <div style={{ display: 'flex', gap: 6 }}>
                          {c.status === 'active' && (
                            <button className="btn btn-secondary btn-sm" onClick={() => handlePause(c.id)} title="Pause Campaign">
                              <Pause size={14} /> Pause
                            </button>
                          )}
                          {c.status === 'paused' && (
                            <button className="btn btn-secondary btn-sm" onClick={() => handleResume(c.id)} title="Resume Campaign">
                              <Play size={14} /> Resume
                            </button>
                          )}
                          {(c.status === 'active' || c.status === 'paused') && (
                            <button className="btn btn-ghost btn-sm" style={{ color: 'var(--accent-rose)' }} onClick={() => handleCancel(c.id)} title="Cancel Campaign">
                              <XCircle size={14} /> Cancel
                            </button>
                          )}
                          <button className="btn btn-secondary btn-sm" onClick={() => handleOpenInspector(c)} title="Inspect Jobs">
                            <Eye size={14} /> Inspect Queue
                          </button>
                        </div>
                      </div>
                    </div>

                    {/* Progress Bar */}
                    <div style={{ marginTop: 20 }}>
                      <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 'var(--font-size-xs)', color: 'var(--text-secondary)', marginBottom: 6 }}>
                        <span>Progress: <strong>{completed} / {total}</strong> processed ({progressPct}%)</span>
                        <span style={{ display: 'flex', gap: 12 }}>
                          <span style={{ color: 'var(--accent-primary)' }}>✔ Sent: {c.completed_jobs}</span>
                          {c.failed_jobs > 0 && <span style={{ color: 'var(--accent-rose)' }}>✖ Failed: {c.failed_jobs}</span>}
                        </span>
                      </div>
                      
                      {/* Bar Container */}
                      <div style={{ width: '100%', height: 8, background: 'var(--bg-hover)', borderRadius: 4, overflow: 'hidden', display: 'flex' }}>
                        <div style={{ width: `${Math.round((c.completed_jobs / total) * 100)}%`, background: 'var(--accent-primary)', height: '100%', transition: 'width 0.4s ease' }} />
                        <div style={{ width: `${Math.round((c.failed_jobs / total) * 100)}%`, background: 'var(--accent-rose)', height: '100%', transition: 'width 0.4s ease' }} />
                      </div>
                    </div>
                  </div>
                )
              })}

              {/* Pagination */}
              {totalCampaigns > 10 && (
                <div style={{ display: 'flex', justifyContent: 'center', gap: 12, marginTop: 12 }}>
                  <button className="btn btn-secondary btn-sm" onClick={() => setPage(p => Math.max(1, p - 1))} disabled={page === 1}>Previous</button>
                  <span style={{ display: 'flex', alignItems: 'center', fontSize: 'var(--font-size-sm)', color: 'var(--text-muted)' }}>Page {page} of {Math.ceil(totalCampaigns / 10)}</span>
                  <button className="btn btn-secondary btn-sm" onClick={() => setPage(p => p + 1)} disabled={page >= Math.ceil(totalCampaigns / 10)}>Next</button>
                </div>
              )}
            </div>
          )}
        </>
      ) : (
        
        // ─── QUEUE INSPECTOR VIEW ───
        <>
          {/* Header */}
          <div className="page-header">
            <div>
              <button className="btn btn-secondary btn-sm" onClick={() => setSelectedCampaign(null)} style={{ display: 'inline-flex', alignItems: 'center', gap: 6, marginBottom: 8 }}>
                <ArrowLeft size={14} /> Back to campaigns
              </button>
              <h2 className="page-title">Queue Inspector: {selectedCampaign.name}</h2>
              <p className="page-subtitle">Inspect, cancel, and manually retry message jobs inside this campaign</p>
            </div>
            
            <div style={{ display: 'flex', gap: 8 }}>
              {selectedCampaign.status === 'active' && <button className="btn btn-secondary" onClick={() => handlePause(selectedCampaign.id)}><Pause size={15} /> Pause</button>}
              {selectedCampaign.status === 'paused' && <button className="btn className btn-secondary" onClick={() => handleResume(selectedCampaign.id)}><Play size={15} /> Resume</button>}
              {(selectedCampaign.status === 'active' || selectedCampaign.status === 'paused') && (
                <button className="btn btn-ghost" style={{ color: 'var(--accent-rose)' }} onClick={() => handleCancel(selectedCampaign.id)}>
                  <XCircle size={15} /> Cancel Campaign
                </button>
              )}
              <button className="btn btn-secondary btn-icon" onClick={fetchJobs} title="Refresh Table">
                <RefreshCw size={15} className={loadingJobs ? 'animate-spin' : ''} />
              </button>
            </div>
          </div>

          {/* Stats & Donut Chart Side-by-Side */}
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 240px', gap: 16, marginBottom: 20, alignItems: 'stretch' }}>
            <div className="stats-grid" style={{ height: 'fit-content', margin: 0, gridTemplateColumns: 'repeat(2, 1fr)', gap: 12 }}>
              <div className="stat-card blue" style={{ padding: '12px 16px' }}>
                <div className="stat-value" style={{ fontSize: 20 }}>{selectedCampaign.total_jobs}</div>
                <div className="stat-label">Total Jobs</div>
              </div>
              <div className="stat-card green" style={{ padding: '12px 16px' }}>
                <div className="stat-value" style={{ fontSize: 20 }}>{selectedCampaign.completed_jobs}</div>
                <div className="stat-label">Sent Successful</div>
              </div>
              <div className="stat-card rose" style={{ padding: '12px 16px' }}>
                <div className="stat-value" style={{ fontSize: 20 }}>{selectedCampaign.failed_jobs}</div>
                <div className="stat-label">Failed Permanent</div>
              </div>
              <div className="stat-card purple" style={{ padding: '12px 16px' }}>
                <div className="stat-value" style={{ fontSize: 20 }}>
                  {selectedCampaign.total_jobs - selectedCampaign.completed_jobs - selectedCampaign.failed_jobs}
                </div>
                <div className="stat-label">Remaining Queued</div>
              </div>
            </div>
            
            <CampaignDonutChart 
              total={selectedCampaign.total_jobs} 
              sent={selectedCampaign.completed_jobs} 
              failed={selectedCampaign.failed_jobs} 
              queued={selectedCampaign.total_jobs - selectedCampaign.completed_jobs - selectedCampaign.failed_jobs} 
            />
          </div>

          {/* Filters Bar */}
          <div className="card" style={{ display: 'flex', gap: 12, alignItems: 'center', padding: 14, marginBottom: 16, background: 'var(--bg-tertiary)' }}>
            <div className="search-bar" style={{ width: 240 }}>
              <Search size={14} className="search-bar-icon" />
              <input
                className="form-input"
                placeholder="Search phone..."
                value={searchJobPhone}
                onChange={e => { setSearchJobPhone(e.target.value); setJobsPage(1) }}
                style={{ paddingLeft: 34, height: 36 }}
              />
            </div>
            
            <select 
              className="form-input" 
              value={filterJobStatus} 
              onChange={e => { setFilterJobStatus(e.target.value); setJobsPage(1) }}
              style={{ width: 160, height: 36, padding: '0 10px' }}
            >
              <option value="">All Statuses</option>
              <option value="queued">Queued</option>
              <option value="sending">Sending</option>
              <option value="sent">Sent</option>
              <option value="failed">Failed</option>
              <option value="cancelled">Cancelled</option>
            </select>
          </div>

          {/* Jobs Table */}
          <div className="card" style={{ padding: 0, overflow: 'hidden' }}>
            {loadingJobs && jobs.length === 0 ? (
              <div style={{ padding: 48, textAlign: 'center', color: 'var(--text-muted)' }}>
                <RefreshCw className="animate-spin" style={{ margin: '0 auto 8px' }} />
                Loading queue records...
              </div>
            ) : jobs.length === 0 ? (
              <div style={{ padding: 48, textAlign: 'center', color: 'var(--text-muted)' }}>
                No message jobs match your filter.
              </div>
            ) : (
              <div style={{ overflowX: 'auto' }}>
                <table className="table">
                  <thead>
                    <tr>
                      <th style={{ width: 60 }}>ID</th>
                      <th>Contact</th>
                      <th>Phone</th>
                      <th>Message Body</th>
                      <th>Scheduled (IST)</th>
                      <th>Status</th>
                      <th>Failure Reason / Retries</th>
                      <th style={{ textAlign: 'right', width: 140 }}>Actions</th>
                    </tr>
                  </thead>
                  <tbody>
                    {jobs.map(job => (
                      <tr key={job.id}>
                        <td>{job.id}</td>
                        <td style={{ fontWeight: 600 }}>{job.contact_name || 'One-off Recipient'}</td>
                        <td>{job.phone}</td>
                        <td style={{ fontSize: 'var(--font-size-xs)', maxWidth: 280, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }} title={job.body}>
                          {job.body}
                        </td>
                        <td>{formatIST(job.scheduled_at)}</td>
                        <td>{getJobStatusBadge(job.status)}</td>
                        <td style={{ fontSize: 'var(--font-size-xs)', color: 'var(--accent-rose)' }}>
                          {job.failure_reason ? (
                            <span style={{ display: 'inline-flex', alignItems: 'center', gap: 4 }}>
                              <ShieldAlert size={12} /> {job.failure_reason}
                            </span>
                          ) : job.retry_count > 0 ? (
                            <span style={{ color: 'var(--accent-amber)' }}>Retry #{job.retry_count} scheduled</span>
                          ) : (
                            <span style={{ color: 'var(--text-muted)' }}>—</span>
                          )}
                        </td>
                        <td style={{ textAlign: 'right' }}>
                          <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 6 }}>
                            {job.status === 'failed' && (
                              <button className="btn btn-secondary btn-sm" onClick={() => handleRetryJob(job.id)} title="Force Retry Message">
                                <RefreshCw size={12} /> Retry
                              </button>
                            )}
                            {(job.status === 'queued' || job.status === 'sending') && (
                              <button className="btn btn-ghost btn-sm" style={{ color: 'var(--accent-rose)' }} onClick={() => handleCancelJob(job.id)} title="Cancel Job">
                                <XCircle size={12} /> Cancel
                              </button>
                            )}
                          </div>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>

          {/* Jobs Pagination */}
          {totalJobs > 10 && (
            <div style={{ display: 'flex', justifyContent: 'center', gap: 12, marginTop: 16 }}>
              <button className="btn btn-secondary btn-sm" onClick={() => setJobsPage(p => Math.max(1, p - 1))} disabled={jobsPage === 1}>Previous</button>
              <span style={{ display: 'flex', alignItems: 'center', fontSize: 'var(--font-size-sm)', color: 'var(--text-muted)' }}>Page {jobsPage} of {Math.ceil(totalJobs / 10)}</span>
              <button className="btn btn-secondary btn-sm" onClick={() => setJobsPage(p => p + 1)} disabled={jobsPage >= Math.ceil(totalJobs / 10)}>Next</button>
            </div>
          )}
        </>
      )}

      {/* ─── CREATE CAMPAIGN DIALOG MODAL ─── */}
      {showCreateModal && (
        <div className="modal-overlay">
          <div className="modal" style={{ maxWidth: 800, width: '90%', maxHeight: '90vh', display: 'flex', flexDirection: 'column', padding: 0 }}>
            {/* Modal Header */}
            <div className="modal-header" style={{ padding: '16px 20px', borderBottom: '1px solid var(--border-primary)' }}>
              <h3 className="modal-title" style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                <Sparkles color="var(--accent-primary)" size={20} />
                Create Bulk WhatsApp Campaign
              </h3>
              <button className="btn btn-ghost btn-icon" onClick={() => setShowCreateModal(false)}><X size={18} /></button>
            </div>

            {/* Modal Form Scrollable Area */}
            <form onSubmit={handleCreateSubmit} style={{ display: 'flex', flex: 1, overflow: 'hidden', flexDirection: 'column' }}>
              <div style={{ display: 'flex', flex: 1, overflowY: 'auto', padding: 20, gap: 20, flexWrap: 'wrap' }}>
                
                {/* Left Side: Campaign Config & Textarea */}
                <div style={{ flex: 1, minWidth: 320, display: 'flex', flexDirection: 'column', gap: 12 }}>
                  <div className="form-group">
                    <label className="form-label">Campaign Name *</label>
                    <input
                      className="form-input"
                      placeholder="e.g. July Product Updates Launch"
                      value={name}
                      onChange={e => setName(e.target.value)}
                      required
                    />
                  </div>

                  {/* Delay & Concurrency */}
                  <div style={{ display: 'flex', gap: 12 }}>
                    <div className="form-group" style={{ flex: 1 }}>
                      <label className="form-label" style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
                        <Clock size={12} /> Delay Seconds *
                      </label>
                      <input
                        type="number"
                        min="0"
                        className="form-input"
                        value={delaySeconds}
                        onChange={e => setDelaySeconds(e.target.value)}
                        required
                        title="Staggers message sending times to prevent WhatsApp spam filters from checking your account."
                      />
                    </div>
                    
                    <div className="form-group" style={{ flex: 1 }}>
                      <label className="form-label" style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
                        <Sliders size={12} /> Concurrency Limit *
                      </label>
                      <input
                        type="number"
                        min="1"
                        className="form-input"
                        value={concurrency}
                        onChange={e => setConcurrency(e.target.value)}
                        required
                      />
                    </div>
                  </div>

                  <div className="form-group">
                    <label className="form-label" style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
                      <Calendar size={12} /> Schedule Date & Time * (Local Time)
                    </label>
                    <input
                      type="datetime-local"
                      className="form-input"
                      value={scheduleDate}
                      onChange={e => setScheduleDate(e.target.value)}
                      required
                    />
                  </div>

                  {/* Template Body */}
                  {/* Message Body */}
                  <div className="form-group" style={{ flex: 1, display: 'flex', flexDirection: 'column' }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 6 }}>
                      <label className="form-label" style={{ margin: 0 }}>Message Body *</label>
                      <span style={{ fontSize: 11, color: 'var(--text-muted)' }}>
                        {template.length > 0 ? `${template.length} characters` : ''}
                      </span>
                    </div>

                    {/* WhatsApp-style chat compose box */}
                    <div style={{
                      display: 'flex',
                      flexDirection: 'column',
                      border: '1px solid var(--border-primary)',
                      borderRadius: 12,
                      overflow: 'hidden',
                      background: 'var(--bg-secondary)',
                      flex: 1,
                    }}>
                      <textarea
                        placeholder="Type your WhatsApp message here..."
                        value={template}
                        onChange={e => setTemplate(e.target.value)}
                        required
                        style={{
                          flex: 1,
                          width: '100%',
                          minHeight: 160,
                          padding: '14px 16px',
                          border: 'none',
                          outline: 'none',
                          resize: 'vertical',
                          background: 'transparent',
                          color: 'var(--text-primary)',
                          fontSize: 15,
                          lineHeight: 1.65,
                          fontFamily: 'inherit',
                          boxSizing: 'border-box',
                        }}
                      />
                      {/* Bottom bar: char count + emoji hint */}
                      <div style={{
                        display: 'flex', justifyContent: 'space-between', alignItems: 'center',
                        padding: '6px 12px',
                        borderTop: '1px solid var(--border-primary)',
                        background: 'var(--bg-tertiary)',
                      }}>
                        <span style={{ fontSize: 11, color: 'var(--text-muted)' }}>
                          This message will be sent as-is to all selected contacts
                        </span>
                        <span style={{ fontSize: 11, color: template.length > 1000 ? 'var(--accent-rose)' : 'var(--text-muted)' }}>
                          {template.length} / 4096
                        </span>
                      </div>
                    </div>
                  </div>
                </div>

                {/* Right Side: Multi-Select Contacts List */}
                <div style={{ width: 320, display: 'flex', flexDirection: 'column', borderLeft: '1px solid var(--border-primary)', paddingLeft: 20 }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 8 }}>
                    <label className="form-label" style={{ margin: 0 }}>Recipients * ({selectedContactIds.length} selected)</label>
                    <button type="button" className="btn btn-ghost btn-sm" style={{ padding: 0, height: 'auto', fontSize: 'var(--font-size-xs)' }} onClick={handleSelectAllContacts}>
                      {selectedContactIds.length === filteredContacts.length ? 'Deselect All' : 'Select All'}
                    </button>
                  </div>
                  
                  {/* Search Recipients */}
                  <div className="search-bar" style={{ width: '100%', marginBottom: 10 }}>
                    <Search size={12} className="search-bar-icon" />
                    <input
                      className="form-input"
                      placeholder="Search contacts..."
                      value={searchContact}
                      onChange={e => setSearchContact(e.target.value)}
                      style={{ paddingLeft: 30, height: 32, fontSize: 'var(--font-size-xs)' }}
                    />
                  </div>

                  {/* Recipients Scroller */}
                  <div style={{ flex: 1, minHeight: 250, maxHeight: 300, overflowY: 'auto', border: '1px solid var(--border-primary)', borderRadius: 'var(--radius-sm)', background: 'var(--bg-secondary)' }}>
                    {loadingContacts ? (
                      <div style={{ padding: 20, textAlign: 'center', color: 'var(--text-muted)', fontSize: 'var(--font-size-xs)' }}>
                        Loading contacts...
                      </div>
                    ) : filteredContacts.length === 0 ? (
                      <div style={{ padding: 20, textAlign: 'center', color: 'var(--text-muted)', fontSize: 'var(--font-size-xs)' }}>
                        No contacts found.
                      </div>
                    ) : (
                      filteredContacts.map(c => {
                        const isChecked = selectedContactIds.includes(c.id)
                        const isGroup = c.tags?.includes('Group')
                        const isTeam = c.tags?.includes('Team')
                        return (
                          <div 
                            key={c.id} 
                            onClick={() => handleToggleContact(c.id)}
                            style={{ 
                              display: 'flex', alignItems: 'center', gap: 10, padding: '8px 10px', 
                              borderBottom: '1px solid var(--border-primary)', cursor: 'pointer',
                              background: isChecked ? 'rgba(37, 211, 102, 0.05)' : 'transparent',
                              transition: 'background 0.2s'
                            }}
                          >
                            <input 
                              type="checkbox" 
                              checked={isChecked}
                              readOnly
                              style={{ cursor: 'pointer' }}
                            />
                            <div style={{ minWidth: 0, flex: 1 }}>
                              <div style={{ fontSize: 'var(--font-size-xs)', fontWeight: 600, color: 'var(--text-primary)', textOverflow: 'ellipsis', overflow: 'hidden', whiteSpace: 'nowrap', display: 'flex', alignItems: 'center', gap: 6 }}>
                                {c.name}
                                {isGroup && <span style={{ fontSize: '8px', background: 'rgba(99, 102, 241, 0.15)', color: 'rgb(165, 180, 252)', padding: '1px 4px', borderRadius: 3, fontWeight: 700, letterSpacing: '0.5px' }}>GROUP</span>}
                                {isTeam && <span style={{ fontSize: '8px', background: 'rgba(45, 212, 191, 0.15)', color: 'rgb(153, 246, 228)', padding: '1px 4px', borderRadius: 3, fontWeight: 700, letterSpacing: '0.5px' }}>TEAM</span>}
                              </div>
                              <div style={{ fontSize: '10px', color: 'var(--text-muted)' }}>{c.phone}</div>
                            </div>
                          </div>
                        )
                      })
                    )}
                  </div>
                </div>

              </div>

              {/* Modal Footer */}
              <div className="modal-footer" style={{ padding: '12px 20px', borderTop: '1px solid var(--border-primary)', display: 'flex', justifyContent: 'flex-end', gap: 10 }}>
                <button type="button" className="btn btn-secondary" onClick={() => setShowCreateModal(false)}>Cancel</button>
                <button type="submit" className="btn btn-primary" disabled={!name || selectedContactIds.length === 0}>
                  <Send size={14} /> Schedule & Start Campaign
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

    </div>
  )
}
