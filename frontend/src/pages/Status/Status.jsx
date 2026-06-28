import { useState, useEffect } from 'react'
import { statusApi } from '../../services/api'
import {
  Circle, Plus, Send, RefreshCw, Hash, Radio,
  Users, X, CheckCheck, Smile
} from 'lucide-react'

const AVATAR_COLORS = [
  '#25D366','#00BCD4','#9C27B0','#FF5722','#3F51B5',
  '#E91E63','#4CAF50','#FF9800','#009688','#673AB7'
]
function avatarColor(name) {
  return AVATAR_COLORS[(name || '?').charCodeAt(0) % AVATAR_COLORS.length]
}

export default function Status() {
  const [statuses, setStatuses] = useState([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(null)
  const [newStatus, setNewStatus] = useState('')
  const [posting, setPosting] = useState(false)
  const [postSuccess, setPostSuccess] = useState(false)
  const [activeTab, setActiveTab] = useState('status') // 'status' | 'channels'

  const fetchStatuses = async () => {
    setLoading(true); setError(null)
    try {
      const res = await statusApi.list()
      setStatuses(res.data?.statuses || [])
    } catch {
      setError('Could not load statuses. Make sure WhatsApp is connected.')
    } finally { setLoading(false) }
  }

  useEffect(() => { fetchStatuses() }, [])

  const handlePostStatus = async () => {
    if (!newStatus.trim()) return
    setPosting(true)
    try {
      await statusApi.post({ text: newStatus.trim() })
      setPostSuccess(true)
      setNewStatus('')
      setTimeout(() => setPostSuccess(false), 3000)
    } catch { alert('Failed to post status') }
    finally { setPosting(false) }
  }

  return (
    <div>
      <div className="page-header">
        <div>
          <h2 className="page-title">Status &amp; Channels</h2>
          <p className="page-subtitle">View contacts' status and follow channels</p>
        </div>
        <button className="btn btn-secondary" onClick={fetchStatuses} disabled={loading}>
          <RefreshCw size={15} style={{ animation: loading ? 'wapin 1s linear infinite' : 'none' }} />
          Refresh
        </button>
      </div>

      {/* Tabs */}
      <div style={{ display: 'flex', gap: 0, borderBottom: '1px solid var(--border-primary)', marginBottom: 20 }}>
        {[
          { id: 'status', label: 'Status', icon: <Circle size={15} /> },
          { id: 'channels', label: 'Channels', icon: <Hash size={15} /> },
        ].map(tab => (
          <button key={tab.id} onClick={() => setActiveTab(tab.id)}
            style={{
              display: 'flex', alignItems: 'center', gap: 7, padding: '10px 20px',
              background: 'none', border: 'none', cursor: 'pointer', fontSize: 14, fontWeight: 500,
              color: activeTab === tab.id ? 'var(--accent-primary)' : 'var(--text-secondary)',
              borderBottom: activeTab === tab.id ? '2px solid var(--accent-primary)' : '2px solid transparent',
              transition: 'all 0.15s',
            }}>
            {tab.icon} {tab.label}
          </button>
        ))}
      </div>

      {activeTab === 'status' && (
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 20, maxWidth: 900 }}>
          {/* My Status / Post */}
          <div className="card" style={{ padding: 20 }}>
            <div style={{ fontSize: 13, fontWeight: 600, color: 'var(--text-secondary)', marginBottom: 14, textTransform: 'uppercase', letterSpacing: '0.05em' }}>
              My Status
            </div>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
              <textarea
                placeholder="What's on your mind? Type your status…"
                value={newStatus}
                onChange={e => setNewStatus(e.target.value)}
                rows={4}
                style={{
                  background: 'var(--bg-secondary)', border: '1px solid var(--border-primary)',
                  borderRadius: 10, padding: '10px 14px', color: 'var(--text-primary)',
                  fontSize: 14, resize: 'vertical', outline: 'none', lineHeight: 1.5,
                  fontFamily: 'inherit',
                }}
              />
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <span style={{ fontSize: 12, color: 'var(--text-muted)' }}>{newStatus.length}/700 chars</span>
                <button className="btn btn-primary" onClick={handlePostStatus} disabled={posting || !newStatus.trim()}>
                  {posting ? <RefreshCw size={14} style={{ animation: 'wapin 1s linear infinite' }} /> : <Send size={14} />}
                  {posting ? 'Posting…' : 'Post Status'}
                </button>
              </div>
              {postSuccess && (
                <div style={{ display: 'flex', alignItems: 'center', gap: 8, color: '#25D366', fontSize: 13 }}>
                  <CheckCheck size={15} /> Status posted successfully!
                </div>
              )}
            </div>
          </div>

          {/* Contacts' Status */}
          <div className="card" style={{ padding: 20 }}>
            <div style={{ fontSize: 13, fontWeight: 600, color: 'var(--text-secondary)', marginBottom: 14, textTransform: 'uppercase', letterSpacing: '0.05em' }}>
              Recent Updates
            </div>
            {loading ? (
              <div style={{ textAlign: 'center', padding: 32, color: 'var(--text-muted)', fontSize: 13 }}>
                <RefreshCw size={20} style={{ animation: 'wapin 1s linear infinite', marginBottom: 8 }} /><br />Loading…
              </div>
            ) : error ? (
              <div style={{ textAlign: 'center', padding: 24, color: 'var(--accent-rose)', fontSize: 13 }}>{error}</div>
            ) : statuses.length === 0 ? (
              <div style={{ textAlign: 'center', padding: 32, color: 'var(--text-muted)', fontSize: 13 }}>No status updates available</div>
            ) : (
              <div style={{ maxHeight: 340, overflowY: 'auto', display: 'flex', flexDirection: 'column', gap: 2 }}>
                {statuses.map(s => (
                  <div key={s.id} style={{ display: 'flex', alignItems: 'center', gap: 12, padding: '10px 4px', borderRadius: 10,
                    transition: 'background 0.12s' }}
                    onMouseEnter={e => e.currentTarget.style.background = 'rgba(255,255,255,0.04)'}
                    onMouseLeave={e => e.currentTarget.style.background = 'transparent'}>
                    <div style={{ position: 'relative', flexShrink: 0 }}>
                      <div style={{ width: 44, height: 44, borderRadius: '50%', background: avatarColor(s.name),
                        display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 18, fontWeight: 700, color: '#fff',
                        border: s.about ? '2px solid #25D366' : '2px solid transparent' }}>
                        {(s.name || '?')[0].toUpperCase()}
                      </div>
                      {s.about && <div style={{ position: 'absolute', bottom: 0, right: 0, width: 12, height: 12, borderRadius: '50%', background: '#25D366', border: '2px solid var(--bg-primary)' }} />}
                    </div>
                    <div style={{ flex: 1, minWidth: 0 }}>
                      <div style={{ fontSize: 14, fontWeight: 500, color: 'var(--text-primary)', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{s.name}</div>
                      <div style={{ fontSize: 12, color: 'var(--text-secondary)', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{s.about || 'No status'}</div>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      )}

      {activeTab === 'channels' && (
        <div style={{ maxWidth: 700 }}>
          <div className="card" style={{ padding: 40, textAlign: 'center' }}>
            <div style={{ width: 64, height: 64, borderRadius: '50%', background: 'rgba(37,211,102,0.1)', display: 'flex', alignItems: 'center', justifyContent: 'center', margin: '0 auto 16px' }}>
              <Radio size={28} color="#25D366" />
            </div>
            <h3 style={{ color: 'var(--text-primary)', marginBottom: 8 }}>WhatsApp Channels</h3>
            <p style={{ color: 'var(--text-secondary)', fontSize: 14, lineHeight: 1.6, maxWidth: 420, margin: '0 auto 20px' }}>
              WhatsApp Channels (Newsletters) is a newer feature not yet supported by the whatsapp-web.js library.
              Channel support will be available in a future update.
            </p>
            <div style={{ display: 'flex', gap: 12, justifyContent: 'center', flexWrap: 'wrap' }}>
              <div style={{ background: 'rgba(37,211,102,0.08)', border: '1px solid rgba(37,211,102,0.2)', borderRadius: 10, padding: '12px 20px', fontSize: 13, color: '#25D366' }}>
                📢 Follow Channels
              </div>
              <div style={{ background: 'rgba(37,211,102,0.08)', border: '1px solid rgba(37,211,102,0.2)', borderRadius: 10, padding: '12px 20px', fontSize: 13, color: '#25D366' }}>
                🔔 Channel Updates
              </div>
              <div style={{ background: 'rgba(37,211,102,0.08)', border: '1px solid rgba(37,211,102,0.2)', borderRadius: 10, padding: '12px 20px', fontSize: 13, color: '#25D366' }}>
                📋 Browse Channels
              </div>
            </div>
          </div>
        </div>
      )}

      <style>{`@keyframes wapin{to{transform:rotate(360deg)}}`}</style>
    </div>
  )
}
