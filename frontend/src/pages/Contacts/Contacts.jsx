import { useState, useEffect, useCallback, useRef } from 'react'
import { Users, Plus, Search, Edit2, Trash2, Phone, X, Check, RefreshCw, WifiOff, Megaphone, User, Download, Upload, Mail } from 'lucide-react'
import { contactsApi, whatsappApi } from '../../services/api'
import { useApp } from '../../context/AppContext'
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

  // Import/Export
  const [importing, setImporting] = useState(false)
  const [importMsg, setImportMsg]  = useState('')
  const importInputRef = useRef(null)

  // Filter states
  const [filterType, setFilterType] = useState('all')

  // Use AppContext session so this page reacts to connect/disconnect immediately
  const { sessionStatus, loadingSession } = useApp()

  const fetchContacts = useCallback(async () => {
    setLoading(true)
    try {
      const res = await contactsApi.getAll({ search, page: 1, limit: 500, saved_only: true })
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
    setSyncing(true)
    setSyncMessage('')
    try {
      const res = await contactsApi.sync()
      setSyncMessage(res.data?.message || 'Contacts synced successfully!')
      fetchContacts()
    } catch (err) {
      setSyncMessage(getErrorMessage(err, 'Sync failed.'))
    } finally {
      setSyncing(false)
      setTimeout(() => setSyncMessage(''), 6000)
    }
  }

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

  // Backend already returns only saved contacts (saved_only=true); no client-side split needed
  const counts = {
    all: contacts.length,
    individual: contacts.filter(c => !c.tags?.includes('Group') && !c.tags?.includes('Team')).length,
    group: contacts.filter(c => c.tags?.includes('Group')).length,
    team: contacts.filter(c => c.tags?.includes('Team')).length,
  }

  const filteredContacts = contacts.filter(c => {
    const isGroup = c.tags?.includes('Group')
    const isTeam = c.tags?.includes('Team')
    const type = isGroup ? 'group' : (isTeam ? 'team' : 'individual')
    if (filterType !== 'all' && type !== filterType) return false
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
          <p className="page-subtitle">{counts.all} contacts</p>
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
                { id: 'all', label: `All (${counts.all})` },
                { id: 'individual', label: `Individuals (${counts.individual})` },
                { id: 'group', label: `Groups (${counts.group})` },
                ...(counts.team > 0 ? [{ id: 'team', label: `Teams (${counts.team})` }] : []),
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
          <div style={{ padding: 48, textAlign: 'center', color: 'var(--text-muted)' }}>Loading contacts...</div>
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
                const isGroup = c.tags?.includes('Group')
                const isTeam = c.tags?.includes('Team')

                const picUrl = !isGroup && !isTeam ? (profilePics[c.id] || null) : null

                let badgeClass = 'badge-green'
                let badgeLabel = 'Individual'
                if (isGroup) { badgeClass = 'badge-indigo'; badgeLabel = 'Group' }
                else if (isTeam) { badgeClass = 'badge-teal'; badgeLabel = 'Team' }

                return (
                  <tr key={c.id}>
                    <td className="td-primary" style={{ display: 'flex', alignItems: 'center', gap: 10, borderTop: 'none' }}>
                      <div style={{
                        width: 34, height: 34, borderRadius: '50%',
                        background: isGroup ? 'rgba(99,102,241,0.15)' : (isTeam ? 'rgba(45,212,191,0.15)' : (picUrl ? 'transparent' : 'var(--accent-primary-muted)')),
                        display: 'flex', alignItems: 'center', justifyContent: 'center',
                        color: isGroup ? 'rgb(165,180,252)' : (isTeam ? 'rgb(153,246,228)' : 'var(--accent-primary)'),
                        fontWeight: 700, fontSize: 13, flexShrink: 0,
                        overflow: 'hidden'
                      }}>
                        {picUrl
                          ? <img src={picUrl} alt={c.name} style={{ width: '100%', height: '100%', objectFit: 'cover', borderRadius: '50%' }} onError={e => { e.target.style.display = 'none' }} />
                          : isGroup ? <Users size={16} />
                          : isTeam ? <Megaphone size={16} />
                          : (c.name?.[0]?.toUpperCase() || <User size={16} />)
                        }
                      </div>
                      <div>
                        <span style={{ fontWeight: (isGroup || isTeam) ? 600 : 500 }}>{c.name}</span>
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
      `}</style>
    </div>
  )
}
