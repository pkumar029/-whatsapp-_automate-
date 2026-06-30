import { useState, useEffect, useRef, useCallback } from 'react'
import { statusApi } from '../../services/api'
import {
  Plus, Send, RefreshCw, Hash, Radio,
  X, CheckCheck, Image, Type, Upload, Clock,
  Eye, EyeOff, Circle
} from 'lucide-react'
import { useApp } from '../../context/AppContext'

const AVATAR_COLORS = [
  '#25D366','#00BCD4','#9C27B0','#FF5722','#3F51B5',
  '#E91E63','#4CAF50','#FF9800','#009688','#673AB7'
]
function avatarColor(name) {
  return AVATAR_COLORS[(name || '?').charCodeAt(0) % AVATAR_COLORS.length]
}
function timeAgo(ts) {
  if (!ts) return ''
  const diff = Date.now() - new Date(ts).getTime()
  const m = Math.floor(diff / 60000)
  if (m < 1) return 'just now'
  if (m < 60) return `${m}m ago`
  const h = Math.floor(m / 60)
  if (h < 24) return `${h}h ago`
  return `${Math.floor(h / 24)}d ago`
}

// ─── Skeleton card ────────────────────────────────────────────
function SkeletonCard() {
  return (
    <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 8, padding: 8 }}>
      <div style={{ width: 60, height: 60, borderRadius: '50%', background: 'var(--bg-tertiary)', animation: 'skeleton-pulse 1.4s ease-in-out infinite' }} />
      <div style={{ width: 50, height: 10, borderRadius: 5, background: 'var(--bg-tertiary)', animation: 'skeleton-pulse 1.4s ease-in-out infinite' }} />
    </div>
  )
}

// ─── Status viewer modal ──────────────────────────────────────
function StatusViewerModal({ contact, onClose }) {
  useEffect(() => {
    const h = (e) => { if (e.key === 'Escape') onClose() }
    window.addEventListener('keydown', h)
    return () => window.removeEventListener('keydown', h)
  }, [onClose])

  if (!contact) return null

  const color = avatarColor(contact.name)
  const initial = (contact.name || '?')[0].toUpperCase()

  return (
    <div
      onClick={onClose}
      style={{
        position: 'fixed', inset: 0, zIndex: 9000,
        background: 'rgba(0,0,0,0.85)', backdropFilter: 'blur(8px)',
        display: 'flex', alignItems: 'center', justifyContent: 'center',
        padding: 16,
      }}
    >
      <div
        onClick={e => e.stopPropagation()}
        style={{
          background: 'var(--bg-secondary)',
          border: '1px solid var(--border-primary)',
          borderRadius: 16,
          width: '100%', maxWidth: 420,
          padding: 0, overflow: 'hidden',
          boxShadow: '0 24px 64px rgba(0,0,0,0.6)',
        }}
      >
        {/* Progress bar (decorative) */}
        <div style={{ height: 3, background: 'var(--bg-tertiary)' }}>
          <div style={{ height: '100%', width: '60%', background: '#25D366', borderRadius: 2 }} />
        </div>

        {/* Header */}
        <div style={{ display: 'flex', alignItems: 'center', gap: 12, padding: '14px 16px 10px' }}>
          <div style={{
            width: 44, height: 44, borderRadius: '50%', flexShrink: 0,
            background: color, display: 'flex', alignItems: 'center', justifyContent: 'center',
            fontSize: 18, fontWeight: 700, color: '#fff',
            border: '2px solid #25D366',
          }}>
            {contact.picUrl
              ? <img src={contact.picUrl} alt={contact.name} style={{ width: '100%', height: '100%', objectFit: 'cover', borderRadius: '50%' }} onError={e => { e.target.style.display = 'none' }} />
              : initial}
          </div>
          <div style={{ flex: 1 }}>
            <div style={{ fontWeight: 600, color: 'var(--text-primary)', fontSize: 15 }}>{contact.name}</div>
            <div style={{ fontSize: 12, color: 'var(--text-muted)', display: 'flex', alignItems: 'center', gap: 4 }}>
              <Clock size={11} /> {contact.phone}
            </div>
          </div>
          <button onClick={onClose} style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--text-muted)', padding: 4 }}>
            <X size={18} />
          </button>
        </div>

        {/* Status content */}
        <div style={{
          margin: '0 16px 16px',
          background: contact.about ? '#0a2619' : 'var(--bg-tertiary)',
          borderRadius: 12, padding: '24px 20px',
          minHeight: 100, display: 'flex', alignItems: 'center', justifyContent: 'center',
          textAlign: 'center',
        }}>
          {contact.about
            ? <p style={{ margin: 0, fontSize: 17, color: '#25D366', lineHeight: 1.6, fontWeight: 500 }}>
                {contact.about}
              </p>
            : <p style={{ margin: 0, fontSize: 14, color: 'var(--text-muted)' }}>
                No status set
              </p>}
        </div>

        {/* Type indicator */}
        {contact.about && (
          <div style={{ display: 'flex', alignItems: 'center', gap: 6, padding: '0 16px 16px', fontSize: 12, color: 'var(--text-muted)' }}>
            <Type size={12} /> Text status
          </div>
        )}
      </div>
    </div>
  )
}

// ─── Post status panel ────────────────────────────────────────
function PostStatusPanel({ onPosted }) {
  const [tab, setTab] = useState('text') // 'text' | 'image'
  const [text, setText] = useState('')
  const [imageFile, setImageFile] = useState(null)
  const [imagePreview, setImagePreview] = useState(null)
  const [caption, setCaption] = useState('')
  const [posting, setPosting] = useState(false)
  const [success, setSuccess] = useState(false)
  const [error, setError] = useState('')
  const fileRef = useRef()

  const handleImagePick = (e) => {
    const file = e.target.files?.[0]
    if (!file) return
    setImageFile(file)
    const url = URL.createObjectURL(file)
    setImagePreview(url)
  }

  const handlePost = async () => {
    setPosting(true); setError('')
    try {
      if (tab === 'text') {
        if (!text.trim()) { setError('Enter some text first'); return }
        await statusApi.post({ text: text.trim() })
      } else {
        if (!imageFile) { setError('Select an image first'); return }
        // Convert to base64
        const b64 = await new Promise((res, rej) => {
          const reader = new FileReader()
          reader.onload = () => res(reader.result.split(',')[1])
          reader.onerror = rej
          reader.readAsDataURL(imageFile)
        })
        await statusApi.post({ mediaBase64: b64, mediaType: imageFile.type, caption: caption.trim() })
      }
      setSuccess(true)
      setText(''); setImageFile(null); setImagePreview(null); setCaption('')
      onPosted?.()
      setTimeout(() => setSuccess(false), 3000)
    } catch (e) {
      setError(e.response?.data?.error || 'Failed to post status')
    } finally { setPosting(false) }
  }

  return (
    <div className="card" style={{ padding: 20 }}>
      <div style={{ fontSize: 13, fontWeight: 600, color: 'var(--text-secondary)', marginBottom: 14, textTransform: 'uppercase', letterSpacing: '0.05em' }}>
        My Status
      </div>

      {/* Tab picker */}
      <div style={{ display: 'flex', gap: 8, marginBottom: 14 }}>
        {[
          { id: 'text', icon: <Type size={14} />, label: 'Text' },
          { id: 'image', icon: <Image size={14} />, label: 'Image' },
        ].map(t => (
          <button key={t.id} onClick={() => setTab(t.id)}
            style={{
              display: 'flex', alignItems: 'center', gap: 6,
              padding: '6px 14px', borderRadius: 20, border: 'none', cursor: 'pointer', fontSize: 13,
              background: tab === t.id ? 'var(--accent-primary-muted)' : 'var(--bg-tertiary)',
              color: tab === t.id ? 'var(--accent-primary)' : 'var(--text-secondary)',
              fontWeight: tab === t.id ? 600 : 400,
              transition: 'all 0.15s',
            }}>
            {t.icon} {t.label}
          </button>
        ))}
      </div>

      {tab === 'text' ? (
        <>
          <textarea
            placeholder="What's on your mind? (up to 700 characters)"
            value={text}
            onChange={e => setText(e.target.value)}
            maxLength={700}
            rows={4}
            style={{
              width: '100%', boxSizing: 'border-box',
              background: 'var(--bg-secondary)', border: '1px solid var(--border-primary)',
              borderRadius: 10, padding: '10px 14px', color: 'var(--text-primary)',
              fontSize: 14, resize: 'vertical', outline: 'none', lineHeight: 1.5,
              fontFamily: 'inherit',
            }}
          />
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginTop: 8 }}>
            <span style={{ fontSize: 12, color: text.length > 650 ? '#f59e0b' : 'var(--text-muted)' }}>
              {text.length}/700
            </span>
          </div>
        </>
      ) : (
        <div>
          <input ref={fileRef} type="file" accept="image/*" style={{ display: 'none' }} onChange={handleImagePick} />
          {imagePreview ? (
            <div style={{ position: 'relative', marginBottom: 10 }}>
              <img src={imagePreview} alt="preview" style={{ width: '100%', borderRadius: 10, maxHeight: 200, objectFit: 'cover' }} />
              <button onClick={() => { setImageFile(null); setImagePreview(null) }}
                style={{ position: 'absolute', top: 8, right: 8, background: 'rgba(0,0,0,0.6)', border: 'none', borderRadius: '50%', width: 28, height: 28, display: 'flex', alignItems: 'center', justifyContent: 'center', cursor: 'pointer', color: '#fff' }}>
                <X size={14} />
              </button>
            </div>
          ) : (
            <div onClick={() => fileRef.current?.click()}
              style={{ border: '2px dashed var(--border-primary)', borderRadius: 10, padding: '32px 0', textAlign: 'center', cursor: 'pointer', marginBottom: 10, color: 'var(--text-muted)', fontSize: 13, transition: 'border-color 0.15s' }}
              onMouseEnter={e => e.currentTarget.style.borderColor = 'var(--accent-primary)'}
              onMouseLeave={e => e.currentTarget.style.borderColor = 'var(--border-primary)'}
            >
              <Upload size={24} style={{ marginBottom: 8, display: 'block', margin: '0 auto 8px' }} />
              Click to select image
            </div>
          )}
          <input
            type="text"
            placeholder="Caption (optional)"
            value={caption}
            onChange={e => setCaption(e.target.value)}
            style={{ width: '100%', boxSizing: 'border-box', background: 'var(--bg-secondary)', border: '1px solid var(--border-primary)', borderRadius: 8, padding: '8px 12px', color: 'var(--text-primary)', fontSize: 13, outline: 'none' }}
          />
        </div>
      )}

      {error && <div style={{ marginTop: 8, color: '#f87171', fontSize: 13 }}>{error}</div>}

      {success && (
        <div style={{ display: 'flex', alignItems: 'center', gap: 8, color: '#25D366', fontSize: 13, marginTop: 8 }}>
          <CheckCheck size={15} /> Status posted successfully!
        </div>
      )}

      <button
        className="btn btn-primary"
        onClick={handlePost}
        disabled={posting || (tab === 'text' ? !text.trim() : !imageFile)}
        style={{ marginTop: 12, width: '100%', justifyContent: 'center' }}
      >
        {posting ? <RefreshCw size={14} style={{ animation: 'spin 1s linear infinite' }} /> : <Send size={14} />}
        {posting ? 'Posting…' : 'Post Status'}
      </button>
    </div>
  )
}

// ─── Status circle (avatar with ring) ────────────────────────
function StatusCircle({ contact, onClick }) {
  const color = avatarColor(contact.name)
  const initial = (contact.name || '?')[0].toUpperCase()
  const hasStatus = !!contact.about

  return (
    <button
      onClick={onClick}
      style={{
        display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 6,
        background: 'none', border: 'none', cursor: 'pointer', padding: 8,
        borderRadius: 10, transition: 'background 0.12s',
        minWidth: 72,
      }}
      onMouseEnter={e => e.currentTarget.style.background = 'rgba(255,255,255,0.05)'}
      onMouseLeave={e => e.currentTarget.style.background = 'none'}
    >
      <div style={{ position: 'relative' }}>
        {/* Green ring for contacts who have a status */}
        <div style={{
          width: 58, height: 58, borderRadius: '50%',
          padding: 2,
          background: hasStatus
            ? 'linear-gradient(135deg, #25D366, #128C7E)'
            : 'var(--border-primary)',
        }}>
          <div style={{
            width: '100%', height: '100%', borderRadius: '50%',
            background: color,
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            fontSize: 20, fontWeight: 700, color: '#fff',
            border: '2px solid var(--bg-primary)',
            overflow: 'hidden',
          }}>
            {contact.picUrl
              ? <img src={contact.picUrl} alt={contact.name} style={{ width: '100%', height: '100%', objectFit: 'cover' }} onError={e => { e.target.style.display = 'none' }} />
              : initial}
          </div>
        </div>
        {hasStatus && (
          <span style={{
            position: 'absolute', bottom: 0, right: 0,
            width: 14, height: 14, borderRadius: '50%',
            background: '#25D366', border: '2px solid var(--bg-primary)',
          }} />
        )}
      </div>
      <span style={{
        fontSize: 11, color: 'var(--text-secondary)', maxWidth: 64,
        whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis',
        textAlign: 'center',
      }}>
        {contact.name.split(' ')[0]}
      </span>
    </button>
  )
}

// ─── Status list row ──────────────────────────────────────────
function StatusRow({ contact, onClick }) {
  const color = avatarColor(contact.name)
  const initial = (contact.name || '?')[0].toUpperCase()
  const hasStatus = !!contact.about

  return (
    <div
      onClick={onClick}
      style={{
        display: 'flex', alignItems: 'center', gap: 14,
        padding: '10px 12px', borderRadius: 10, cursor: 'pointer',
        transition: 'background 0.12s',
      }}
      onMouseEnter={e => e.currentTarget.style.background = 'rgba(255,255,255,0.04)'}
      onMouseLeave={e => e.currentTarget.style.background = 'transparent'}
    >
      <div style={{ position: 'relative', flexShrink: 0 }}>
        <div style={{
          width: 46, height: 46, borderRadius: '50%',
          padding: 2,
          background: hasStatus ? 'linear-gradient(135deg, #25D366, #128C7E)' : 'var(--border-primary)',
        }}>
          <div style={{
            width: '100%', height: '100%', borderRadius: '50%',
            background: color,
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            fontSize: 16, fontWeight: 700, color: '#fff',
            border: '2px solid var(--bg-primary)',
            overflow: 'hidden',
          }}>
            {contact.picUrl
              ? <img src={contact.picUrl} alt={contact.name} style={{ width: '100%', height: '100%', objectFit: 'cover' }} onError={e => { e.target.style.display = 'none' }} />
              : initial}
          </div>
        </div>
      </div>
      <div style={{ flex: 1, minWidth: 0 }}>
        <div style={{ fontSize: 14, fontWeight: 500, color: 'var(--text-primary)', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
          {contact.name}
        </div>
        <div style={{ fontSize: 12, color: hasStatus ? '#25D366' : 'var(--text-muted)', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis', marginTop: 1 }}>
          {contact.about || 'No status'}
        </div>
      </div>
      <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'flex-end', gap: 4, flexShrink: 0 }}>
        <span style={{ fontSize: 11, color: 'var(--text-muted)' }}>{contact.phone}</span>
        {hasStatus && <span style={{ fontSize: 10, color: '#25D366', display: 'flex', alignItems: 'center', gap: 3 }}><Eye size={10} /> Status</span>}
      </div>
    </div>
  )
}

// ─── Main page ────────────────────────────────────────────────
export default function Status() {
  const { sessionStatus } = useApp()
  const [statuses, setStatuses] = useState([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(null)
  const [activeTab, setActiveTab] = useState('status')
  const [viewContact, setViewContact] = useState(null)
  const [search, setSearch] = useState('')

  const fetchStatuses = useCallback(async () => {
    setLoading(true); setError(null)
    try {
      const res = await statusApi.list()
      setStatuses(res.data?.statuses || [])
    } catch {
      setError('Could not load statuses. Make sure WhatsApp is connected.')
    } finally { setLoading(false) }
  }, [])

  useEffect(() => { fetchStatuses() }, [fetchStatuses])

  // Auto-refresh every 60 seconds when connected
  useEffect(() => {
    if (sessionStatus?.status !== 'connected') return
    const iv = setInterval(fetchStatuses, 60000)
    return () => clearInterval(iv)
  }, [sessionStatus?.status, fetchStatuses])

  const withStatus = statuses.filter(s => s.about)
  const withoutStatus = statuses.filter(s => !s.about)
  const filtered = statuses.filter(s =>
    !search || s.name?.toLowerCase().includes(search.toLowerCase()) || s.phone?.includes(search)
  )
  const filteredWithStatus = filtered.filter(s => s.about)
  const filteredWithout = filtered.filter(s => !s.about)

  return (
    <div>
      <div className="page-header">
        <div>
          <h2 className="page-title">Status &amp; Channels</h2>
          <p className="page-subtitle">
            {loading ? 'Loading…' : `${withStatus.length} contacts with status · ${statuses.length} total`}
          </p>
        </div>
        <button className="btn btn-secondary" onClick={fetchStatuses} disabled={loading}>
          <RefreshCw size={15} style={{ animation: loading ? 'spin 1s linear infinite' : 'none' }} />
          Refresh
        </button>
      </div>

      {/* Tabs */}
      <div style={{ display: 'flex', gap: 0, borderBottom: '1px solid var(--border-primary)', marginBottom: 24 }}>
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
        <div style={{ display: 'grid', gridTemplateColumns: '340px 1fr', gap: 20, maxWidth: 1000, alignItems: 'start' }}>

          {/* Left: Post + contacts list */}
          <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
            <PostStatusPanel onPosted={fetchStatuses} />

            {/* Search */}
            <div className="card" style={{ padding: 12 }}>
              <input
                type="search"
                placeholder="Search contacts…"
                value={search}
                onChange={e => setSearch(e.target.value)}
                style={{
                  width: '100%', boxSizing: 'border-box',
                  background: 'var(--bg-tertiary)', border: '1px solid var(--border-primary)',
                  borderRadius: 8, padding: '8px 12px', color: 'var(--text-primary)',
                  fontSize: 13, outline: 'none',
                }}
              />
            </div>

            {/* Contact list with status */}
            <div className="card" style={{ padding: 12 }}>
              <div style={{ fontSize: 12, fontWeight: 600, color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.05em', padding: '4px 4px 8px' }}>
                Recent Updates · {filteredWithStatus.length}
              </div>
              {loading ? (
                Array.from({ length: 4 }).map((_, i) => (
                  <div key={i} style={{ display: 'flex', alignItems: 'center', gap: 12, padding: '10px 4px' }}>
                    <div style={{ width: 46, height: 46, borderRadius: '50%', background: 'var(--bg-tertiary)', flexShrink: 0, animation: 'skeleton-pulse 1.4s ease-in-out infinite' }} />
                    <div style={{ flex: 1, display: 'flex', flexDirection: 'column', gap: 6 }}>
                      <div style={{ height: 12, width: '60%', borderRadius: 4, background: 'var(--bg-tertiary)', animation: 'skeleton-pulse 1.4s ease-in-out infinite' }} />
                      <div style={{ height: 10, width: '40%', borderRadius: 4, background: 'var(--bg-tertiary)', animation: 'skeleton-pulse 1.4s ease-in-out infinite' }} />
                    </div>
                  </div>
                ))
              ) : error ? (
                <div style={{ padding: '20px 4px', color: 'var(--accent-rose)', fontSize: 13 }}>{error}</div>
              ) : filteredWithStatus.length === 0 ? (
                <div style={{ padding: '20px 4px', color: 'var(--text-muted)', fontSize: 13 }}>No status updates found</div>
              ) : (
                filteredWithStatus.map(c => (
                  <StatusRow key={c.id} contact={c} onClick={() => setViewContact(c)} />
                ))
              )}

              {!loading && !error && filteredWithout.length > 0 && (
                <>
                  <div style={{ fontSize: 12, fontWeight: 600, color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.05em', padding: '12px 4px 8px', borderTop: '1px solid var(--border-primary)', marginTop: 8 }}>
                    No Recent Updates · {filteredWithout.length}
                  </div>
                  {filteredWithout.slice(0, 10).map(c => (
                    <StatusRow key={c.id} contact={c} onClick={() => setViewContact(c)} />
                  ))}
                  {filteredWithout.length > 10 && (
                    <div style={{ padding: '8px 4px', fontSize: 12, color: 'var(--text-muted)' }}>
                      +{filteredWithout.length - 10} more contacts
                    </div>
                  )}
                </>
              )}
            </div>
          </div>

          {/* Right: Stories-style circles grid */}
          <div className="card" style={{ padding: 20 }}>
            <div style={{ fontSize: 13, fontWeight: 600, color: 'var(--text-secondary)', marginBottom: 16, textTransform: 'uppercase', letterSpacing: '0.05em' }}>
              Status Updates
            </div>

            {loading ? (
              <div style={{ display: 'flex', flexWrap: 'wrap', gap: 4 }}>
                {Array.from({ length: 12 }).map((_, i) => <SkeletonCard key={i} />)}
              </div>
            ) : error ? (
              <div style={{ textAlign: 'center', padding: '32px 0', color: 'var(--accent-rose)', fontSize: 13 }}>{error}</div>
            ) : statuses.length === 0 ? (
              <div style={{ textAlign: 'center', padding: '40px 0', color: 'var(--text-muted)' }}>
                <Radio size={36} style={{ marginBottom: 12, opacity: 0.3 }} />
                <div style={{ fontSize: 14 }}>No contacts found</div>
                <div style={{ fontSize: 12, marginTop: 4 }}>Connect your WhatsApp to see status updates</div>
              </div>
            ) : (
              <>
                {/* Contacts with status first */}
                {withStatus.length > 0 && (
                  <>
                    <div style={{ fontSize: 11, color: 'var(--text-muted)', marginBottom: 10, fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.05em' }}>
                      Recent Updates ({withStatus.length})
                    </div>
                    <div style={{ display: 'flex', flexWrap: 'wrap', gap: 4, marginBottom: 20 }}>
                      {withStatus.map(c => (
                        <StatusCircle key={c.id} contact={c} onClick={() => setViewContact(c)} />
                      ))}
                    </div>
                  </>
                )}

                {/* Contacts without status */}
                {withoutStatus.length > 0 && (
                  <>
                    <div style={{ fontSize: 11, color: 'var(--text-muted)', marginBottom: 10, fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.05em', paddingTop: withStatus.length ? 12 : 0, borderTop: withStatus.length ? '1px solid var(--border-primary)' : 'none' }}>
                      No Recent Updates ({withoutStatus.length})
                    </div>
                    <div style={{ display: 'flex', flexWrap: 'wrap', gap: 4 }}>
                      {withoutStatus.map(c => (
                        <StatusCircle key={c.id} contact={c} onClick={() => setViewContact(c)} />
                      ))}
                    </div>
                  </>
                )}
              </>
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
              WhatsApp Channels (Newsletters) require a newer version of the whatsapp-web.js library.
              Channel support will be available in a future update.
            </p>
          </div>
        </div>
      )}

      {/* Status viewer modal */}
      {viewContact && (
        <StatusViewerModal contact={viewContact} onClose={() => setViewContact(null)} />
      )}

      <style>{`
        @keyframes spin { to { transform: rotate(360deg); } }
        @keyframes skeleton-pulse {
          0%, 100% { opacity: 1; }
          50% { opacity: 0.4; }
        }
      `}</style>
    </div>
  )
}
