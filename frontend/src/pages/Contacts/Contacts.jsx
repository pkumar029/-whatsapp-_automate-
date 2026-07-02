import { useState, useEffect, useCallback, useRef } from 'react'
import { Users, Plus, Search, Edit2, Trash2, Phone, X, Check, RefreshCw, WifiOff, Megaphone, User, Download, Upload, BookUser } from 'lucide-react'
import { contactsApi, whatsappApi } from '../../services/api'
import { useApp } from '../../context/AppContext'
import { useAuth } from '../../context/AuthContext'
import { Link } from 'react-router-dom'
import { formatISTDate } from '../../utils/date'
import { getErrorMessage } from '../../utils/error'

// ─── Contact Form Modal ───────────────────────────────────────
function ContactModal({ contact, onClose, onSave }) {
  const [form, setForm] = useState({
    name: contact?.name || '',
    phone: contact?.phone || '',
    email: contact?.email || '',
    notes: contact?.notes || '',
  })
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState('')

  const handleSubmit = async (e) => {
    e.preventDefault()
    if (!form.name.trim() || !form.phone.trim()) {
      setError('Name and phone are required.')
      return
    }
    setSaving(true)
    setError('')
    try {
      if (contact?.id) {
        await contactsApi.update(contact.id, form)
      } else {
        await contactsApi.create(form)
      }
      onSave()
    } catch (err) {
      setError(getErrorMessage(err, 'Failed to save contact.'))
    } finally {
      setSaving(false)
    }
  }

  return (
    <div className="modal-overlay" onClick={e => e.target === e.currentTarget && onClose()}>
      <div className="modal">
        <div className="modal-header">
          <h3 className="modal-title">{contact ? 'Edit Contact' : 'Add Contact'}</h3>
          <button className="btn btn-ghost btn-icon" onClick={onClose}><X size={18} /></button>
        </div>
        <form onSubmit={handleSubmit}>
          {error && (
            <div style={{ background: 'var(--accent-rose-muted)', border: '1px solid rgba(244,63,94,0.3)', borderRadius: 'var(--radius-md)', padding: '10px 14px', marginBottom: 16, fontSize: 'var(--font-size-sm)', color: 'var(--accent-rose)' }}>
              {error}
            </div>
          )}
          <div className="form-group">
            <label className="form-label">Full Name *</label>
            <input className="form-input" placeholder="Enter a name" value={form.name} onChange={e => setForm({ ...form, name: e.target.value })} />
          </div>
          <div className="form-group">
            <label className="form-label">Phone Number *</label>
            <input className="form-input" placeholder="+91xxxxxx" value={form.phone} onChange={e => setForm({ ...form, phone: e.target.value })} />
          </div>
          <div className="form-group">
            <label className="form-label">Email</label>
            <input className="form-input" type="email" placeholder="example@gmail.com" value={form.email} onChange={e => setForm({ ...form, email: e.target.value })} />
          </div>
          <div className="form-group">
            <label className="form-label">Notes</label>
            <textarea className="form-input form-textarea" placeholder="Optional notes..." value={form.notes} onChange={e => setForm({ ...form, notes: e.target.value })} />
          </div>
          <div className="modal-footer">
            <button type="button" className="btn btn-secondary" onClick={onClose}>Cancel</button>
            <button type="submit" className="btn btn-primary" disabled={saving}>
              {saving ? 'Saving...' : <><Check size={15} /> Save Contact</>}
            </button>
          </div>
        </form>
      </div>
    </div>
  )
}

// ─── Main Contacts Page ───────────────────────────────────────
export default function Contacts() {
  const { syncedAt } = useApp()

  const [contacts, setContacts] = useState([])
  const [loading, setLoading] = useState(true)
  const [search, setSearch] = useState('')
  const [showModal, setShowModal] = useState(false)
  const [editContact, setEditContact] = useState(null)
  const [deleteId, setDeleteId] = useState(null)
  const [profilePics, setProfilePics] = useState({}) // contactId → url | null

  // Sync states
  const [syncing, setSyncing] = useState(false)
  const [syncMessage, setSyncMessage] = useState('')
  const [syncProgress, setSyncProgress] = useState(null) // { current, total, message, status }
  const syncEsRef = useRef(null)

  // Import/Export
  const [importing, setImporting] = useState(false)
  const [importMsg, setImportMsg]  = useState('')
  const importInputRef = useRef(null)

  // Filter states — 'all' | 'saved' | 'unsaved' | 'group'
  const [filterType, setFilterType] = useState('all')

  // Use AppContext session so this page reacts to connect/disconnect immediately
  const { sessionStatus, loadingSession } = useApp()
  const { user } = useAuth()

  const fetchContacts = useCallback(async () => {
    setLoading(true)
    try {
      // No saved_only filter — show ALL valid contacts (address-book + chat-only + groups)
      const res = await contactsApi.getAll({ search, page: 1, limit: 1000 })
      setContacts(res.data?.contacts || res.data || [])
    } catch {
      setContacts([])
    } finally {
      setLoading(false)
    }
  }, [search])

  // Lazily fetch profile pics for the first 20 individual (non-group) contacts
  const fetchBatchProfilePics = useCallback(async (contactList) => {
    const toFetch = contactList
      .filter(c => !c.tags?.includes('Group') && !c.tags?.includes('Team'))
      .filter(c => profilePics[c.id] === undefined)
      .slice(0, 20)
    if (toFetch.length === 0) return
    const results = await Promise.allSettled(
      toFetch.map(c => contactsApi.getProfilePic(c.id).then(r => ({ id: c.id, url: r.data?.url || null })))
    )
    const update = {}
    results.forEach(r => { if (r.status === 'fulfilled') update[r.value.id] = r.value.url })
    setProfilePics(prev => ({ ...prev, ...update }))
  }, [profilePics])

  useEffect(() => {
    const timer = setTimeout(fetchContacts, 300)
    return () => clearTimeout(timer)
  }, [fetchContacts])

  // Refetch when AppContext signals that a background sync has completed
  useEffect(() => {
    if (syncedAt > 0) fetchContacts()
  }, [syncedAt]) // eslint-disable-line react-hooks/exhaustive-deps

  // After contacts load, fetch profile pics for visible contacts
  useEffect(() => {
    if (contacts.length > 0 && sessionStatus.status === 'connected') {
      fetchBatchProfilePics(contacts)
    }
  }, [contacts, sessionStatus.status])

  const handleDelete = async (id) => {
    try {
      await contactsApi.delete(id)
      setDeleteId(null)
      fetchContacts()
    } catch {}
  }

  const handleSync = async () => {
    if (syncing) return
    setSyncing(true)
    setSyncMessage('')
    setSyncProgress({ status: 'running', current: 0, total: 0, message: 'Starting sync...' })

    // Close any previous SSE connection
    if (syncEsRef.current) { try { syncEsRef.current.close() } catch (_) {} }

    try {
      // Start the background sync
      await contactsApi.sync()

      // Subscribe to SSE progress stream
      const es = new EventSource(contactsApi.syncProgressUrl(user.id))
      syncEsRef.current = es

      es.onmessage = (evt) => {
        try {
          const data = JSON.parse(evt.data)
          setSyncProgress(data)
          if (data.status === 'complete') {
            setSyncMessage(data.message || 'Sync complete!')
            setSyncing(false)
            setSyncProgress(null)
            es.close()
            fetchContacts()
            setTimeout(() => setSyncMessage(''), 8000)
          } else if (data.status === 'error') {
            setSyncMessage(data.error || 'Sync failed.')
            setSyncing(false)
            setSyncProgress(null)
            es.close()
            setTimeout(() => setSyncMessage(''), 6000)
          }
        } catch (_) {}
      }

      es.onerror = () => {
        es.close()
        setSyncing(false)
        setSyncProgress(null)
        fetchContacts()
      }
    } catch (err) {
      setSyncMessage(getErrorMessage(err, 'Sync failed.'))
      setSyncing(false)
      setSyncProgress(null)
      setTimeout(() => setSyncMessage(''), 6000)
    }
  }

  // Cleanup SSE on unmount
  useEffect(() => {
    return () => { if (syncEsRef.current) try { syncEsRef.current.close() } catch (_) {} }
  }, [])

  const openEdit = (contact) => { setEditContact(contact); setShowModal(true) }
  const openAdd = () => { setEditContact(null); setShowModal(true) }

  const handleExport = async () => {
    try {
      const res = await contactsApi.exportCsv()
      const url = URL.createObjectURL(new Blob([res.data], { type: 'text/csv' }))
      const a = document.createElement('a')
      a.href = url; a.download = `contacts_${new Date().toISOString().slice(0,10)}.csv`
      a.click(); URL.revokeObjectURL(url)
    } catch { alert('Export failed.') }
  }

  const handleImport = async (e) => {
    const file = e.target.files?.[0]; if (!file) return
    e.target.value = null
    setImporting(true); setImportMsg('')
    try {
      const res = await contactsApi.importCsv(file)
      setImportMsg(res.data?.message || 'Import complete.')
      fetchContacts()
    } catch (err) {
      setImportMsg(getErrorMessage(err, 'Import failed.'))
    } finally {
      setImporting(false)
      setTimeout(() => setImportMsg(''), 8000)
    }
  }

  const isGroup = (c) => c.tags?.includes('Group') || c.phone?.endsWith('@g.us')
  const isTeam = (c) => c.tags?.includes('Team')

  // Exclude system accounts that should never be shown to users
  const isValidContact = (c) => {
    if (!c.phone) return false
    const p = c.phone
    if (p.includes('@broadcast')) return false
    if (p.includes('@newsletter')) return false
    if (p === 'status@broadcast') return false
    if (p.includes('@lid')) return false
    // Groups are always valid if they have a name
    if (isGroup(c)) return !!c.name
    // User contacts must have a valid phone number
    return /^\+?\d{7,15}$/.test(p.replace(/\s/g, '')) || p.endsWith('@c.us')
  }
  const isSaved = (c) => c.is_my_contact === true

  // Only show valid contacts (filter out system/broadcast/newsletter/malformed)
  const validContacts = contacts.filter(isValidContact)

  const counts = {
    all:    validContacts.length,
    saved:  validContacts.filter(c => !isGroup(c) && !isTeam(c) && isSaved(c)).length,
    unsaved: validContacts.filter(c => !isGroup(c) && !isTeam(c) && !isSaved(c)).length,
    group:  validContacts.filter(c => isGroup(c)).length,
  }

  const filteredContacts = validContacts.filter(c => {
    if (filterType === 'saved')   return !isGroup(c) && !isTeam(c) && isSaved(c)
    if (filterType === 'unsaved') return !isGroup(c) && !isTeam(c) && !isSaved(c)
    if (filterType === 'group')   return isGroup(c)
    return true
  })

  if (loadingSession) {
    return (
      <div style={{ display: 'flex', justifyContent: 'center', alignItems: 'center', height: 'calc(100vh - 120px)', color: 'var(--text-muted)' }}>
        <RefreshCw size={24} style={{ marginRight: 8, animation: 'spin 1s linear infinite' }} /> Loading...
      </div>
    )
  }

  if (sessionStatus.status !== 'connected') {
    return (
      <div>
        <div className="page-header">
          <div>
            <h2 className="page-title">Contacts</h2>
            <p className="page-subtitle">Manage your WhatsApp audience</p>
          </div>
        </div>
        <div className="card empty-state" style={{ padding: '60px 20px', textAlign: 'center', marginTop: 20 }}>
          <WifiOff size={48} style={{ margin: '0 auto 16px', color: 'var(--accent-rose)' }} />
          <h3>WhatsApp Connection Required</h3>
          <p style={{ maxWidth: 420, margin: '8px auto 20px', fontSize: 'var(--font-size-sm)', color: 'var(--text-secondary)', lineHeight: 1.6 }}>
            Connect your WhatsApp account to sync and manage contacts.
          </p>
          <Link to="/settings" className="btn btn-primary">Go to Settings &amp; Connect</Link>
        </div>
      </div>
    )
  }

  return (
    <div>
      <div className="page-header">
        <div>
          <h2 className="page-title">Contacts</h2>
          <p className="page-subtitle">
            {counts.all} total · {counts.saved} saved · {counts.unsaved} chat-only · {counts.group} groups
          </p>
        </div>
        <div style={{ display: 'flex', gap: 8, alignItems: 'center', flexWrap: 'wrap' }}>
          <button className="btn btn-ghost" onClick={handleExport} title="Export contacts as CSV">
            <Download size={15} /> Export CSV
          </button>
          <button className="btn btn-ghost" onClick={() => importInputRef.current?.click()} disabled={importing} title="Import contacts from CSV">
            <Upload size={15} /> {importing ? 'Importing…' : 'Import CSV'}
          </button>
          <input ref={importInputRef} type="file" accept=".csv,text/csv" style={{ display: 'none' }} onChange={handleImport} />
          <button className="btn btn-secondary" onClick={handleSync} disabled={syncing}>
            <RefreshCw size={16} style={{ animation: syncing ? 'spin 1s linear infinite' : 'none', marginRight: 6 }} />
            {syncing ? 'Syncing...' : 'Sync WhatsApp'}
          </button>
          <button className="btn btn-primary" onClick={openAdd}>
            <Plus size={16} /> Add Contact
          </button>
        </div>
      </div>

      {/* Sync progress bar */}
      {syncing && syncProgress && (
        <div style={{ background: 'rgba(37,211,102,0.08)', border: '1px solid rgba(37,211,102,0.25)', borderRadius: 'var(--radius-md)', padding: '12px 16px', marginBottom: 12 }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 6 }}>
            <span style={{ fontSize: 13, color: 'var(--accent-primary)', fontWeight: 500 }}>
              {syncProgress.message || 'Syncing contacts...'}
            </span>
            {syncProgress.total > 0 && (
              <span style={{ fontSize: 12, color: 'var(--text-muted)', fontFamily: 'monospace' }}>
                {syncProgress.current} / {syncProgress.total}
              </span>
            )}
          </div>
          {syncProgress.total > 0 && (
            <div style={{ height: 4, background: 'rgba(255,255,255,0.08)', borderRadius: 2, overflow: 'hidden' }}>
              <div style={{
                height: '100%',
                background: 'var(--accent-primary)',
                borderRadius: 2,
                width: `${Math.min(100, Math.round((syncProgress.current / syncProgress.total) * 100))}%`,
                transition: 'width 0.3s ease',
              }} />
            </div>
          )}
        </div>
      )}

      {syncMessage && (
        <div style={{ background: 'var(--accent-primary-muted)', border: '1px solid rgba(37,211,102,0.3)', borderRadius: 'var(--radius-md)', padding: '10px 14px', marginBottom: 12, fontSize: 'var(--font-size-sm)', color: 'var(--accent-primary)' }}>
          {syncMessage}
        </div>
      )}
      {importMsg && (
        <div style={{ background: 'rgba(99,102,241,0.1)', border: '1px solid rgba(99,102,241,0.3)', borderRadius: 'var(--radius-md)', padding: '10px 14px', marginBottom: 12, fontSize: 'var(--font-size-sm)', color: '#a5b4fc', display: 'flex', alignItems: 'center', gap: 8 }}>
          <Upload size={14} /> {importMsg}
        </div>
      )}

      <div className="table-container">
        <div className="table-toolbar" style={{ display: 'flex', flexWrap: 'wrap', gap: 16, justifyContent: 'space-between', alignItems: 'center' }}>
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: 12, alignItems: 'center', flex: 1 }}>
            <div className="search-bar" style={{ minWidth: 240, maxWidth: 320 }}>
              <Search size={15} className="search-bar-icon" />
              <input
                className="form-input"
                placeholder="Search contacts..."
                value={search}
                onChange={e => setSearch(e.target.value)}
                style={{ paddingLeft: 38 }}
              />
            </div>

            <div style={{ display: 'flex', gap: 4, background: 'rgba(255,255,255,0.05)', padding: 3, borderRadius: 'var(--radius-md)', border: '1px solid var(--border-color)' }}>
              {[
                { id: 'all',     label: `All (${counts.all})` },
                { id: 'saved',   label: `Saved (${counts.saved})` },
                { id: 'unsaved', label: `Chat-only (${counts.unsaved})` },
                { id: 'group',   label: `Groups (${counts.group})` },
              ].map(({ id, label }) => (
                <button
                  key={id}
                  onClick={() => setFilterType(id)}
                  className={`btn btn-sm ${filterType === id ? 'btn-primary' : 'btn-ghost'}`}
                  style={{ borderRadius: '4px', fontSize: 12, padding: '4px 10px', height: 'auto' }}
                >
                  {label}
                </button>
              ))}
            </div>
          </div>
          <div style={{ fontSize: 'var(--font-size-sm)', color: 'var(--text-muted)', fontWeight: 500 }}>
            {filteredContacts.length} results
          </div>
        </div>

        {loading ? (
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(280px, 1fr))', gap: 12 }}>
            <style>{`@keyframes skpulse{0%,100%{opacity:0.35}50%{opacity:0.7}}`}</style>
            {[...Array(12)].map((_, i) => (
              <div key={i} style={{ background: 'var(--bg-card)', border: '1px solid var(--border-primary)', borderRadius: 'var(--radius-md)', padding: 16, display: 'flex', alignItems: 'center', gap: 12 }}>
                <div style={{ width: 42, height: 42, borderRadius: '50%', background: 'var(--bg-tertiary)', flexShrink: 0, animation: 'skpulse 1.5s ease-in-out infinite' }} />
                <div style={{ flex: 1 }}>
                  <div style={{ height: 13, background: 'var(--bg-tertiary)', borderRadius: 4, width: `${50 + i * 5}%`, marginBottom: 8, animation: 'skpulse 1.5s ease-in-out infinite' }} />
                  <div style={{ height: 11, background: 'var(--bg-tertiary)', borderRadius: 4, width: `${40 + i * 4}%`, animation: 'skpulse 1.5s ease-in-out infinite' }} />
                </div>
              </div>
            ))}
          </div>
        ) : filteredContacts.length === 0 ? (
          <div className="empty-state">
            <div className="empty-state-icon"><Users size={28} /></div>
            <div className="empty-state-title">No contacts found</div>
            <div className="empty-state-desc">
              {contacts.length === 0
                ? 'Add or Sync your WhatsApp contacts to get started'
                : `No contacts match the current filter.`}
            </div>
            {contacts.length === 0 && (
              <div style={{ display: 'flex', gap: 12, marginTop: 16 }}>
                <button className="btn btn-secondary" onClick={handleSync} disabled={syncing}>
                  <RefreshCw size={14} style={{ animation: syncing ? 'spin 1s linear infinite' : 'none', marginRight: 6 }} /> Sync WhatsApp
                </button>
                <button className="btn btn-primary" onClick={openAdd}><Plus size={16} /> Add Contact</button>
              </div>
            )}
          </div>
        ) : (
          <table>
            <thead>
              <tr>
                <th>Name</th>
                <th>Phone / Identifier</th>
                <th>Email</th>
                <th>Type</th>
                <th>Added</th>
                <th>Actions</th>
              </tr>
            </thead>
            <tbody>
              {filteredContacts.map(c => {
                const cIsGroup = isGroup(c)
                const cIsTeam = isTeam(c)
                const cIsSaved = isSaved(c)

                const picUrl = !cIsGroup && !cIsTeam ? (profilePics[c.id] || null) : null

                let badgeClass = cIsSaved ? 'badge-green' : 'badge-gray'
                let badgeLabel = cIsSaved ? 'Saved' : 'Chat-only'
                if (cIsGroup) { badgeClass = 'badge-indigo'; badgeLabel = 'Group' }
                else if (cIsTeam) { badgeClass = 'badge-teal'; badgeLabel = 'Team' }

                return (
                  <tr key={c.id}>
                    <td className="td-primary" style={{ display: 'flex', alignItems: 'center', gap: 10, borderTop: 'none' }}>
                      <div style={{
                        width: 34, height: 34, borderRadius: '50%',
                        background: cIsGroup ? 'rgba(99,102,241,0.15)' : (cIsTeam ? 'rgba(45,212,191,0.15)' : (picUrl ? 'transparent' : 'var(--accent-primary-muted)')),
                        display: 'flex', alignItems: 'center', justifyContent: 'center',
                        color: cIsGroup ? 'rgb(165,180,252)' : (cIsTeam ? 'rgb(153,246,228)' : 'var(--accent-primary)'),
                        fontWeight: 700, fontSize: 13, flexShrink: 0,
                        overflow: 'hidden'
                      }}>
                        {picUrl
                          ? <img src={picUrl} alt={c.name} style={{ width: '100%', height: '100%', objectFit: 'cover', borderRadius: '50%' }} onError={e => { e.target.style.display = 'none' }} />
                          : cIsGroup ? <Users size={16} />
                          : cIsTeam ? <Megaphone size={16} />
                          : (c.name?.[0]?.toUpperCase() || <User size={16} />)
                        }
                      </div>
                      <div>
                        <span style={{ fontWeight: (cIsGroup || cIsTeam) ? 600 : 500 }}>{c.name}</span>
                        {!cIsGroup && !cIsTeam && cIsSaved && (
                          <div style={{ fontSize: 10, color: 'var(--text-muted)', marginTop: 1, display: 'flex', alignItems: 'center', gap: 3 }}>
                            <BookUser size={9} /> Address book
                          </div>
                        )}
                      </div>
                    </td>
                    <td style={{ borderTop: 'none' }}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: 6, fontFamily: 'monospace', fontSize: 13 }}>
                        <Phone size={13} color="var(--text-muted)" /> {c.phone}
                      </div>
                    </td>
                    <td>{c.email || '—'}</td>
                    <td><span className={`badge ${badgeClass}`}>{badgeLabel}</span></td>
                    <td>{c.created_at ? formatISTDate(c.created_at) : '—'}</td>
                    <td>
                      <div style={{ display: 'flex', gap: 6 }}>
                        <button className="btn btn-ghost btn-icon btn-sm" onClick={() => openEdit(c)} title="Edit"><Edit2 size={14} /></button>
                        <button className="btn btn-danger btn-icon btn-sm" onClick={() => setDeleteId(c.id)} title="Delete"><Trash2 size={14} /></button>
                      </div>
                    </td>
                  </tr>
                )
              })}
            </tbody>
          </table>
        )}
      </div>

      {showModal && (
        <ContactModal
          contact={editContact}
          onClose={() => setShowModal(false)}
          onSave={() => { setShowModal(false); fetchContacts() }}
        />
      )}

      {deleteId && (
        <div className="modal-overlay" onClick={e => e.target === e.currentTarget && setDeleteId(null)}>
          <div className="modal" style={{ maxWidth: 360 }}>
            <div className="modal-header">
              <h3 className="modal-title">Delete Contact</h3>
            </div>
            <p style={{ color: 'var(--text-secondary)', fontSize: 'var(--font-size-sm)' }}>
              Are you sure you want to delete this contact? This action cannot be undone.
            </p>
            <div className="modal-footer">
              <button className="btn btn-secondary" onClick={() => setDeleteId(null)}>Cancel</button>
              <button className="btn btn-danger" onClick={() => handleDelete(deleteId)}>
                <Trash2 size={14} /> Delete
              </button>
            </div>
          </div>
        </div>
      )}

      <style>{`
        @keyframes spin { to { transform: rotate(360deg); } }
        .badge-indigo { background: rgba(99,102,241,0.15) !important; color: rgb(165,180,252) !important; border: 1px solid rgba(99,102,241,0.3) !important; }
        .badge-teal   { background: rgba(45,212,191,0.15) !important; color: rgb(153,246,228) !important; border: 1px solid rgba(45,212,191,0.3) !important; }
        .badge-gray   { background: rgba(255,255,255,0.06) !important; color: var(--text-muted) !important; border: 1px solid rgba(255,255,255,0.1) !important; }
      `}</style>
    </div>
  )
}
