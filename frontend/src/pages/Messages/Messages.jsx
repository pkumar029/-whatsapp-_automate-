import { useState, useEffect, useCallback } from 'react'
import { MessageSquare, Send, Search, ArrowDownLeft, ArrowUpRight, CheckCheck, Clock, X, AlertCircle, Users } from 'lucide-react'
import { messagesApi, contactsApi } from '../../services/api'

// ─── Send Message Modal ───────────────────────────────────────
function SendMessageModal({ onClose, onSent }) {
  const [contacts, setContacts] = useState([])
  const [form, setForm] = useState({ contact_id: '', phone: '', message: '' })
  const [sending, setSending] = useState(false)
  const [error, setError] = useState('')

  useEffect(() => {
    contactsApi.getAll({ limit: 100 })
      .then(res => setContacts(res.data?.contacts || res.data || []))
      .catch(() => { })
  }, [])

  const handleSend = async (e) => {
    e.preventDefault()
    if (!form.message.trim()) { setError('Message cannot be empty.'); return }
    if (!form.contact_id && !form.phone) { setError('Select a contact or enter a phone number.'); return }
    setSending(true); setError('')
    try {
      await messagesApi.send(form)
      onSent()
    } catch (err) {
      setError(err.response?.data?.detail || 'Failed to send message.')
    } finally {
      setSending(false)
    }
  }

  return (
    <div className="modal-overlay" onClick={e => e.target === e.currentTarget && onClose()}>
      <div className="modal">
        <div className="modal-header">
          <h3 className="modal-title">Send Message</h3>
          <button className="btn btn-ghost btn-icon" onClick={onClose}><X size={18} /></button>
        </div>
        <form onSubmit={handleSend}>
          {error && <div style={{ background: 'var(--accent-rose-muted)', border: '1px solid rgba(244,63,94,0.3)', borderRadius: 'var(--radius-md)', padding: '10px 14px', marginBottom: 16, fontSize: 'var(--font-size-sm)', color: 'var(--accent-rose)' }}>{error}</div>}
          <div className="form-group">
            <label className="form-label">Select Contact</label>
            <select className="form-input form-select" value={form.contact_id} onChange={e => setForm({ ...form, contact_id: e.target.value, phone: '' })}>
              <option value="">— Choose contact —</option>
              {contacts.map(c => <option key={c.id} value={c.id}>{c.name} ({c.phone})</option>)}
            </select>
          </div>
          <div style={{ textAlign: 'center', color: 'var(--text-muted)', fontSize: 'var(--font-size-sm)', margin: '8px 0' }}>or enter phone number</div>
          <div className="form-group">
            <label className="form-label">Phone Number</label>
            <input className="form-input" placeholder="+91 9876543210" value={form.phone} onChange={e => setForm({ ...form, phone: e.target.value, contact_id: '' })} disabled={!!form.contact_id} />
          </div>
          <div className="form-group">
            <label className="form-label">Message *</label>
            <textarea className="form-input form-textarea" placeholder="Type your WhatsApp message here..." value={form.message} onChange={e => setForm({ ...form, message: e.target.value })} style={{ minHeight: 120 }} />
            <div style={{ fontSize: 'var(--font-size-xs)', color: 'var(--text-muted)', textAlign: 'right' }}>{form.message.length} chars</div>
          </div>
          <div className="modal-footer">
            <button type="button" className="btn btn-secondary" onClick={onClose}>Cancel</button>
            <button type="submit" className="btn btn-primary" disabled={sending}>
              {sending ? 'Sending...' : <><Send size={14} /> Send</>}
            </button>
          </div>
        </form>
      </div>
    </div>
  )
}

// ─── Main Messages Page ───────────────────────────────────────
export default function Messages() {
  const [messages, setMessages] = useState([])
  const [loading, setLoading] = useState(true)
  const [search, setSearch] = useState('')
  const [filter, setFilter] = useState('all')
  const [showModal, setShowModal] = useState(false)

  const fetchMessages = useCallback(async () => {
    setLoading(true)
    try {
      const res = await messagesApi.getAll({ search, direction: filter === 'all' ? undefined : filter, limit: 50 })
      setMessages(res.data?.messages || res.data || [])
    } catch {
      setMessages([])
    } finally {
      setLoading(false)
    }
  }, [search, filter])

  useEffect(() => {
    const t = setTimeout(fetchMessages, 300)
    return () => clearTimeout(t)
  }, [fetchMessages])

  const statusIcon = (status) => {
    if (status === 'delivered') return <CheckCheck size={14} color="var(--accent-primary)" />
    if (status === 'sent') return <CheckCheck size={14} color="var(--text-muted)" />
    if (status === 'failed') return <AlertCircle size={14} color="var(--accent-rose)" />
    return <Clock size={14} color="var(--text-muted)" />
  }

  return (
    <div>
      <div className="page-header">
        <div>
          <h2 className="page-title">Messages</h2>
          <p className="page-subtitle">View and send WhatsApp messages</p>
        </div>
        <button className="btn btn-primary" onClick={() => setShowModal(true)}>
          <Send size={16} /> Send Message
        </button>
      </div>

      {/* Filter Tabs */}
      <div style={{ display: 'flex', gap: 8, marginBottom: 20 }}>
        {['all', 'outbound', 'inbound'].map(f => (
          <button key={f} className={`btn btn-sm ${filter === f ? 'btn-primary' : 'btn-secondary'}`} onClick={() => setFilter(f)}>
            {f === 'all' ? 'All' : f === 'outbound' ? '↑ Outbound' : '↓ Inbound'}
          </button>
        ))}
      </div>

      <div className="table-container">
        <div className="table-toolbar">
          <div className="search-bar">
            <Search size={15} className="search-bar-icon" />
            <input className="form-input" placeholder="Search messages..." value={search} onChange={e => setSearch(e.target.value)} style={{ paddingLeft: 38 }} />
          </div>
        </div>

        {loading ? (
          <div style={{ padding: 48, textAlign: 'center', color: 'var(--text-muted)' }}>Loading messages...</div>
        ) : messages.length === 0 ? (
          <div className="empty-state">
            <div className="empty-state-icon"><MessageSquare size={28} /></div>
            <div className="empty-state-title">No messages yet</div>
            <div className="empty-state-desc">Send your first WhatsApp message</div>
            <button className="btn btn-primary" onClick={() => setShowModal(true)}><Send size={15} /> Send Message</button>
          </div>
        ) : (
          <table>
            <thead><tr><th>Direction</th><th>Contact / Phone</th><th>Message</th><th>Status</th><th>Time</th></tr></thead>
            <tbody>
              {messages.map(m => (
                <tr key={m.id}>
                  <td>
                    <span className={`badge ${m.direction === 'outbound' ? 'badge-blue' : 'badge-green'}`}>
                      {m.direction === 'outbound' ? <ArrowUpRight size={11} /> : <ArrowDownLeft size={11} />}
                      {m.direction}
                    </span>
                  </td>
                  <td className="td-primary">
                    <div>{m.contact_name || m.phone}</div>
                    {m.contact_name && <div style={{ fontSize: 'var(--font-size-xs)', color: 'var(--text-muted)' }}>{m.phone}</div>}
                  </td>
                  <td style={{ maxWidth: 320 }}>
                    <div style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', maxWidth: 300 }}>
                      {m.content}
                    </div>
                  </td>
                  <td>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 5 }}>
                      {statusIcon(m.status)}
                      <span style={{ fontSize: 'var(--font-size-xs)', color: 'var(--text-muted)' }}>{m.status}</span>
                    </div>
                  </td>
                  <td style={{ fontSize: 'var(--font-size-xs)', color: 'var(--text-muted)' }}>
                    {m.created_at ? new Date(m.created_at).toLocaleString() : '—'}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>

      {showModal && <SendMessageModal onClose={() => setShowModal(false)} onSent={() => { setShowModal(false); fetchMessages() }} />}
    </div>
  )
}
