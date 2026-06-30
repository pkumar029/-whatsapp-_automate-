import { useState, useEffect, useCallback, useRef, useMemo } from 'react'
import {
  MessageSquare, Send, Search, Phone, Video, Paperclip,
  FileText, Image as ImageIcon, MapPin, X, HelpCircle,
  Check, CheckCheck, Clock, AlertCircle, User, WifiOff, RefreshCw,
  Users, Megaphone, Smile, Mic, BellRing, ArrowLeft,
  Reply, Star, Forward, Trash2, Copy, MoreVertical, StarOff,
  Info, Lock, Bell, BellOff, Flag, ChevronRight, Shield,
  Timer, EyeOff, Link2, Download, Pin, Archive,
  Plus, Pencil, UserPlus, UserMinus, Crown, LogOut, Hash, Sparkles
} from 'lucide-react'
import { messagesApi, contactsApi, whatsappApi, groupsApi, aiApi, BASE_URL } from '../../services/api'
import { useApp } from '../../context/AppContext'
import { Link } from 'react-router-dom'
import { formatISTTime } from '../../utils/date'
import { getErrorMessage } from '../../utils/error'
import { useNotifications } from '../../hooks/useNotifications'
import { useGrammarCheck } from '../../hooks/useGrammarCheck'

// ─── Hook: detect mobile ────────────────────────────────────────
function useIsMobile(bp = 768) {
  const [v, setV] = useState(() => window.innerWidth <= bp)
  useEffect(() => {
    const h = () => setV(window.innerWidth <= bp)
    window.addEventListener('resize', h)
    return () => window.removeEventListener('resize', h)
  }, [bp])
  return v
}

// ─── Constants ──────────────────────────────────────────────────
const AVATAR_COLORS = [
  '#25D366','#00BCD4','#9C27B0','#FF5722','#3F51B5',
  '#E91E63','#4CAF50','#FF9800','#009688','#673AB7'
]
const QUICK_EMOJIS = ['👍', '❤️', '😂', '😮', '😢', '🙏']

// ─── Helpers ────────────────────────────────────────────────────
function avatarColor(name) {
  return AVATAR_COLORS[(name || '?').charCodeAt(0) % AVATAR_COLORS.length]
}

function formatChatTime(iso) {
  if (!iso) return ''
  const d = new Date(iso), now = new Date()
  const dd = Math.floor((now - d) / 86400000)
  if (dd === 0) return d.toLocaleTimeString('en-IN', { hour: '2-digit', minute: '2-digit', hour12: true })
  if (dd === 1) return 'Yesterday'
  if (dd < 7)  return d.toLocaleDateString('en-IN', { weekday: 'short' })
  return d.toLocaleDateString('en-IN', { day: '2-digit', month: '2-digit', year: '2-digit' })
}

// Parse [Reply to X: quote]\nactual text
const REPLY_RE = /^\[Reply to ([^\]|]+)\|([^\]]*)\]:\n([\s\S]*)$/
function parseContent(raw) {
  if (!raw) return { replyFrom: null, replyQuote: null, text: '' }
  // Unwrap JSON-formatted message bodies from the bridge
  if (raw.trimStart()[0] === '{' || raw.trimStart()[0] === '[') {
    try {
      const obj = JSON.parse(raw)
      const text = obj.text || obj.body || obj.message || obj.content || obj.caption
        || (typeof obj === 'string' ? obj : JSON.stringify(obj))
      return { replyFrom: null, replyQuote: null, text: String(text) }
    } catch {}
  }
  const m = raw.match(REPLY_RE)
  if (m) return { replyFrom: m[1], replyQuote: m[2], text: m[3] }
  return { replyFrom: null, replyQuote: null, text: raw }
}

const MEDIA_LABELS = {
  image: '📷 Photo', video: '🎥 Video', audio: '🎵 Audio',
  ptt: '🎤 Voice message', document: '📄 Document',
  sticker: '😊 Sticker', location: '📍 Location', vcard: '👤 Contact',
}

function formatLastMessage(chat) {
  const type = chat.lastMessageType || 'chat'
  const body = chat.lastMessage || ''
  const mediaLabel = MEDIA_LABELS[type]
  const text = mediaLabel || body
  if (!text) return ''
  if (chat.isGroup) {
    const author = chat.lastMessageAuthor
    if (author === 'You' || chat.lastMessageFromMe) return `You: ${text}`
    if (author) return `~${author}: ${text}`
  }
  return text
}

function StatusTick({ status }) {
  if (status === 'read')      return <CheckCheck size={14} style={{ color: '#53bdeb', flexShrink: 0 }} />
  if (status === 'delivered') return <CheckCheck size={14} style={{ color: 'rgba(255,255,255,0.5)', flexShrink: 0 }} />
  if (status === 'sent')      return <Check size={14} style={{ color: 'rgba(255,255,255,0.5)', flexShrink: 0 }} />
  if (status === 'failed')    return <AlertCircle size={13} style={{ color: '#ff4444', flexShrink: 0 }} />
  return <Clock size={13} style={{ color: 'rgba(255,255,255,0.4)', flexShrink: 0 }} />
}

function Avatar({ contact, size = 46, fontSize = 18, profilePics }) {
  const picUrl = profilePics?.[contact.id]
  const isGroup = contact.tags?.includes('Group')
  const isTeam  = contact.tags?.includes('Team')
  if (picUrl) return (
    <div style={{ width: size, height: size, borderRadius: '50%', overflow: 'hidden', flexShrink: 0, background: '#2a3942' }}>
      <img src={picUrl} alt={contact.name} style={{ width: '100%', height: '100%', objectFit: 'cover' }}
        onError={e => { e.target.style.display = 'none'; e.target.parentNode.style.background = avatarColor(contact.name) }} />
    </div>
  )
  if (isGroup || isTeam) return (
    <div style={{ width: size, height: size, borderRadius: '50%', background: '#2a3942', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
      {isGroup ? <Users size={size * 0.38} color="#8696a0" /> : <Megaphone size={size * 0.38} color="#8696a0" />}
    </div>
  )
  return (
    <div style={{ width: size, height: size, borderRadius: '50%', background: avatarColor(contact.name), display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0, fontWeight: 700, fontSize, color: '#fff' }}>
      {(contact.name || '?')[0].toUpperCase()}
    </div>
  )
}

// ─── Context Menu ───────────────────────────────────────────────
function ContextMenu({ msg, x, y, isOut, isStarred, onReply, onCopy, onStar, onForward, onDelete, onClose }) {
  const ref = useRef()
  useEffect(() => {
    const h = (e) => { if (ref.current && !ref.current.contains(e.target)) onClose() }
    document.addEventListener('mousedown', h)
    return () => document.removeEventListener('mousedown', h)
  }, [])

  // Clamp to viewport
  const menuW = 180, menuH = 220
  const cx = Math.min(x, window.innerWidth - menuW - 8)
  const cy = Math.min(y, window.innerHeight - menuH - 8)

  const items = [
    { icon: <Reply size={15} />, label: 'Reply', action: onReply },
    { icon: <Copy size={15} />, label: 'Copy', action: onCopy },
    { icon: isStarred ? <StarOff size={15} /> : <Star size={15} />, label: isStarred ? 'Unstar' : 'Star message', action: onStar },
    { icon: <Forward size={15} />, label: 'Forward', action: onForward },
    { icon: <Trash2 size={15} />, label: 'Delete', action: onDelete, danger: true },
  ]

  return (
    <div ref={ref} style={{
      position: 'fixed', top: cy, left: cx, zIndex: 1000,
      background: '#233138', border: '1px solid #2a3942',
      borderRadius: 10, boxShadow: '0 8px 24px rgba(0,0,0,0.4)',
      minWidth: menuW, overflow: 'hidden',
    }}>
      {items.map(it => (
        <button key={it.label}
          onClick={() => { it.action(); onClose() }}
          style={{
            display: 'flex', alignItems: 'center', gap: 12,
            width: '100%', padding: '11px 16px', border: 'none',
            background: 'transparent', cursor: 'pointer', textAlign: 'left',
            color: it.danger ? '#ff4d4f' : '#e9edef', fontSize: 14,
          }}
          onMouseEnter={e => e.currentTarget.style.background = '#2a3942'}
          onMouseLeave={e => e.currentTarget.style.background = 'transparent'}
        >
          <span style={{ color: it.danger ? '#ff4d4f' : '#8696a0' }}>{it.icon}</span>
          {it.label}
        </button>
      ))}
    </div>
  )
}

// ─── Reaction Picker ────────────────────────────────────────────
function ReactionPicker({ onPick, style }) {
  return (
    <div style={{
      position: 'absolute', bottom: '100%', zIndex: 200,
      background: '#233138', border: '1px solid #2a3942',
      borderRadius: 24, padding: '6px 10px',
      display: 'flex', gap: 4,
      boxShadow: '0 4px 12px rgba(0,0,0,0.3)',
      ...style,
    }}>
      {QUICK_EMOJIS.map(e => (
        <button key={e} onClick={() => onPick(e)}
          style={{ background: 'none', border: 'none', cursor: 'pointer', fontSize: 20, lineHeight: 1, padding: '2px 3px', borderRadius: '50%', transition: 'transform .1s' }}
          onMouseEnter={ev => ev.currentTarget.style.transform = 'scale(1.3)'}
          onMouseLeave={ev => ev.currentTarget.style.transform = 'scale(1)'}
        >{e}</button>
      ))}
    </div>
  )
}

// ─── Message Bubble ─────────────────────────────────────────────
function MessageBubble({ m, isOut, contactName, reaction, isStarred, isLast, onContextMenu, onReply, onReact, setLightboxImg }) {
  const [hovered, setHovered] = useState(false)
  const [showReactPicker, setShowReactPicker] = useState(false)
  const { replyFrom, replyQuote, text } = parseContent(m.content)

  return (
    <div
      onMouseEnter={() => setHovered(true)}
      onMouseLeave={() => { setHovered(false); setShowReactPicker(false) }}
      style={{ display: 'flex', justifyContent: isOut ? 'flex-end' : 'flex-start', marginBottom: reaction ? 14 : 2, position: 'relative' }}
    >
      {/* Hover actions strip */}
      {hovered && (
        <div style={{
          position: 'absolute',
          top: '50%', transform: 'translateY(-50%)',
          [isOut ? 'left' : 'right']: '100%',
          display: 'flex', alignItems: 'center', gap: 2,
          padding: '0 6px', zIndex: 10,
        }}>
          {/* Emoji react */}
          <div style={{ position: 'relative' }}>
            <button onClick={() => setShowReactPicker(v => !v)}
              style={{ background: '#233138', border: 'none', borderRadius: '50%', width: 28, height: 28, cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#8696a0' }}>
              <Smile size={14} />
            </button>
            {showReactPicker && (
              <ReactionPicker
                style={isOut ? { right: 0 } : { left: 0 }}
                onPick={(e) => { onReact(m.id, e); setShowReactPicker(false) }}
              />
            )}
          </div>
          {/* Reply */}
          <button onClick={() => onReply(m)}
            style={{ background: '#233138', border: 'none', borderRadius: '50%', width: 28, height: 28, cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#8696a0' }}>
            <Reply size={14} />
          </button>
          {/* More (context menu) */}
          <button onClick={(e) => onContextMenu(e, m)}
            style={{ background: '#233138', border: 'none', borderRadius: '50%', width: 28, height: 28, cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#8696a0' }}>
            <MoreVertical size={14} />
          </button>
        </div>
      )}

      {/* Bubble */}
      <div style={{
        maxWidth: '65%', minWidth: 80,
        background: isOut ? '#005c4b' : '#202c33',
        borderRadius: isOut ? '8px 8px 0 8px' : '8px 8px 8px 0',
        padding: '6px 10px 4px',
        boxShadow: '0 1px 0.5px rgba(11,20,26,0.13)',
        position: 'relative',
      }}
        onContextMenu={(e) => { e.preventDefault(); onContextMenu(e, m) }}
      >
        {/* Tail */}
        <div style={{
          position: 'absolute', bottom: 0,
          [isOut ? 'right' : 'left']: -7,
          width: 0, height: 0, borderStyle: 'solid',
          borderWidth: isOut ? '0 0 8px 8px' : '0 8px 8px 0',
          borderColor: isOut
            ? 'transparent transparent #005c4b transparent'
            : 'transparent #202c33 transparent transparent'
        }} />

        {/* Starred indicator */}
        {isStarred && (
          <div style={{ position: 'absolute', top: 4, right: isOut ? 4 : 'auto', left: isOut ? 'auto' : 4 }}>
            <Star size={10} color="#f59e0b" fill="#f59e0b" />
          </div>
        )}

        {/* Quoted reply block */}
        {replyFrom && (
          <div style={{ borderLeft: '3px solid #25D366', paddingLeft: 8, marginBottom: 6, borderRadius: '0 4px 4px 0', background: 'rgba(0,0,0,0.15)', padding: '5px 8px', marginTop: 2 }}>
            <div style={{ fontSize: 12, color: '#25D366', fontWeight: 600, marginBottom: 2 }}>{replyFrom}</div>
            <div style={{ fontSize: 12, color: 'rgba(255,255,255,0.55)', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis', maxWidth: 220 }}>{replyQuote}</div>
          </div>
        )}

        {/* Image */}
        {m.media_type === 'image' && m.media_url && (
          <div style={{ cursor: 'zoom-in', borderRadius: 6, overflow: 'hidden', marginBottom: 4 }} onClick={() => setLightboxImg(m.media_url)}>
            <img src={m.media_url} alt="img" style={{ width: '100%', maxHeight: 200, objectFit: 'cover', display: 'block' }}
              onError={e => { e.target.style.display = 'none' }} />
          </div>
        )}

        {/* Audio */}
        {m.media_type === 'audio' && m.media_url && (
          <audio controls src={m.media_url} style={{ width: '100%', minWidth: 180, height: 36, marginBottom: 4 }} />
        )}

        {/* File */}
        {m.media_type === 'file' && m.media_url && (
          <div onClick={() => window.open(m.media_url, '_blank')}
            style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '6px 8px', background: 'rgba(0,0,0,0.15)', borderRadius: 6, cursor: 'pointer', marginBottom: 4 }}>
            <div style={{ width: 30, height: 30, borderRadius: 6, background: 'rgba(255,255,255,0.1)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
              <FileText size={15} color="#e9edef" />
            </div>
            <div style={{ flex: 1, minWidth: 0 }}>
              <div style={{ fontSize: 12, fontWeight: 600, color: '#e9edef', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                {text?.replace(/^Document:\s+/, '') || 'Document'}
              </div>
              <div style={{ fontSize: 10, color: 'rgba(255,255,255,0.4)' }}>Tap to open</div>
            </div>
          </div>
        )}

        {/* Text */}
        {text && !(m.media_type === 'file' && m.media_url) && (
          <div style={{ fontSize: 14, color: '#e9edef', whiteSpace: 'pre-wrap', wordBreak: 'break-word', lineHeight: 1.45 }}>
            {text}
          </div>
        )}

        {/* Time + tick */}
        <div style={{ display: 'flex', justifyContent: 'flex-end', alignItems: 'center', gap: 3, marginTop: 2 }}>
          <span style={{ fontSize: 11, color: 'rgba(255,255,255,0.4)' }}>
            {m.created_at ? formatISTTime(m.created_at) : ''}
          </span>
          {isOut && <StatusTick status={m.status} />}
        </div>

        {/* Reaction display */}
        {reaction && (
          <div onClick={() => onReact(m.id, reaction)}
            style={{ position: 'absolute', bottom: -18, [isOut ? 'right' : 'left']: 6, background: '#233138', border: '1px solid #2a3942', borderRadius: 12, padding: '1px 6px', fontSize: 14, cursor: 'pointer', userSelect: 'none' }}>
            {reaction}
          </div>
        )}
      </div>
    </div>
  )
}

// ─── Forward Modal ──────────────────────────────────────────────
function ForwardModal({ msg, contacts, onClose, onForward }) {
  const [search, setSearch] = useState('')
  const [selected, setSelected] = useState(null)
  const filtered = contacts.filter(c =>
    (c.name || '').toLowerCase().includes(search.toLowerCase()) ||
    (c.phone || '').includes(search)
  )
  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="modal" style={{ maxWidth: 380, maxHeight: '80vh' }} onClick={e => e.stopPropagation()}>
        <div className="modal-header">
          <h3 className="modal-title" style={{ display: 'flex', alignItems: 'center', gap: 8 }}><Forward size={18} /> Forward message</h3>
          <button className="btn btn-ghost btn-icon" onClick={onClose}><X size={18} /></button>
        </div>

        {/* Preview */}
        <div style={{ margin: '0 0 12px', padding: '8px 12px', background: '#1a1a2e', borderRadius: 8, borderLeft: '3px solid #25D366', fontSize: 13, color: '#8696a0', maxHeight: 60, overflow: 'hidden', textOverflow: 'ellipsis' }}>
          {parseContent(msg?.content).text?.slice(0, 120)}
        </div>

        {/* Search */}
        <div style={{ display: 'flex', alignItems: 'center', gap: 8, background: '#202c33', borderRadius: 8, padding: '7px 12px', marginBottom: 10 }}>
          <Search size={14} color="#8696a0" />
          <input placeholder="Search contact" value={search} onChange={e => setSearch(e.target.value)}
            style={{ flex: 1, background: 'none', border: 'none', outline: 'none', color: '#e9edef', fontSize: 14 }} />
        </div>

        {/* Contact list */}
        <div style={{ maxHeight: 240, overflowY: 'auto', marginBottom: 12 }}>
          {filtered.slice(0, 30).map(c => (
            <div key={c.id} onClick={() => setSelected(c.id === selected ? null : c.id)}
              style={{ display: 'flex', alignItems: 'center', gap: 12, padding: '9px 4px', cursor: 'pointer', borderRadius: 8, background: selected === c.id ? 'rgba(37,211,102,0.08)' : 'transparent' }}>
              <div style={{ width: 36, height: 36, borderRadius: '50%', background: avatarColor(c.name), display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 15, fontWeight: 700, color: '#fff', flexShrink: 0 }}>
                {(c.name || '?')[0].toUpperCase()}
              </div>
              <div style={{ flex: 1 }}>
                <div style={{ fontSize: 14, color: '#e9edef' }}>{c.name}</div>
                <div style={{ fontSize: 12, color: '#8696a0' }}>{c.phone}</div>
              </div>
              {selected === c.id && <Check size={16} color="#25D366" />}
            </div>
          ))}
        </div>

        <div className="modal-footer">
          <button className="btn btn-secondary" onClick={onClose}>Cancel</button>
          <button className="btn btn-primary" disabled={!selected}
            onClick={() => { onForward(contacts.find(c => c.id === selected)); onClose() }}>
            <Forward size={14} /> Forward
          </button>
        </div>
      </div>
    </div>
  )
}

// ─── Contact Info Panel ─────────────────────────────────────────
function ContactInfoPanel({ contact, messages, starredMsgs, profilePics, onClose, onClearChat, onDeleteChat,
  onGroupRename, onGroupSetDesc, onGroupAddMember, onGroupRemoveMember, onGroupPromote, onGroupDemote, onGroupInviteLink, onGroupLeave }) {
  const [muted, setMuted]     = useState(() => localStorage.getItem(`wa_muted_${contact.id}`) === '1')
  const [blocked, setBlocked] = useState(() => localStorage.getItem(`wa_blocked_${contact.id}`) === '1')
  const [disappearing, setDisappearing] = useState('Off')
  const [chatLock, setChatLock] = useState(false)
  const [showAllMedia, setShowAllMedia] = useState(false)
  const [groupMembers, setGroupMembers] = useState(null)
  const [showMembers, setShowMembers] = useState(false)
  const [editGroupName, setEditGroupName] = useState(false)
  const [editGroupDesc, setEditGroupDesc] = useState(false)
  const [groupNameVal, setGroupNameVal] = useState(contact.name)
  const [groupDescVal, setGroupDescVal] = useState(contact.notes || '')
  const [addMemberPhone, setAddMemberPhone] = useState('')
  const [showAddMember, setShowAddMember] = useState(false)

  const mediaImgs = messages.filter(m => m.media_type === 'image' && m.media_url)
  const starredCount = messages.filter(m => starredMsgs.has(m.id)).length
  const isGroup = contact.tags?.includes('Group')
  const isTeam  = contact.tags?.includes('Team')

  useEffect(() => {
    if (!isGroup) return
    contactsApi.getGroupMembers(contact.id)
      .then(res => setGroupMembers(res.data?.members || []))
      .catch(() => setGroupMembers([]))
  }, [contact.id, isGroup])

  const toggleMute = () => {
    const next = !muted
    setMuted(next)
    localStorage.setItem(`wa_muted_${contact.id}`, next ? '1' : '0')
  }

  const toggleBlock = () => {
    if (!blocked) {
      if (!window.confirm(`Block ${contact.name}? You won't receive their messages.`)) return
    }
    const next = !blocked
    setBlocked(next)
    localStorage.setItem(`wa_blocked_${contact.id}`, next ? '1' : '0')
  }

  const picUrl = profilePics?.[contact.id]

  // Reusable row component
  const InfoRow = ({ icon, label, sublabel, right, danger, onClick, last }) => (
    <div onClick={onClick}
      style={{
        display: 'flex', alignItems: 'center', gap: 14,
        padding: '13px 20px',
        borderBottom: last ? 'none' : '1px solid rgba(255,255,255,0.04)',
        cursor: onClick ? 'pointer' : 'default',
        transition: 'background 0.15s',
      }}
      onMouseEnter={e => { if (onClick) e.currentTarget.style.background = 'rgba(255,255,255,0.04)' }}
      onMouseLeave={e => { e.currentTarget.style.background = 'transparent' }}
    >
      <div style={{ flexShrink: 0, color: danger ? '#ff4d4f' : '#8696a0' }}>{icon}</div>
      <div style={{ flex: 1, minWidth: 0 }}>
        <div style={{ fontSize: 14, color: danger ? '#ff4d4f' : '#e9edef', fontWeight: 400 }}>{label}</div>
        {sublabel && <div style={{ fontSize: 12, color: '#8696a0', marginTop: 1 }}>{sublabel}</div>}
      </div>
      {right && <div style={{ flexShrink: 0 }}>{right}</div>}
      {onClick && !right && <ChevronRight size={16} color="#8696a0" style={{ flexShrink: 0 }} />}
    </div>
  )

  const SectionDivider = ({ label }) => (
    <div style={{ padding: '18px 20px 6px', fontSize: 13, fontWeight: 600, color: '#25D366', letterSpacing: '0.01em' }}>
      {label}
    </div>
  )

  const Toggle = ({ on, onChange }) => (
    <div onClick={onChange} style={{
      width: 44, height: 24, borderRadius: 12,
      background: on ? '#25D366' : '#374151',
      position: 'relative', cursor: 'pointer', transition: 'background 0.2s', flexShrink: 0,
    }}>
      <div style={{
        position: 'absolute', top: 2, left: on ? 22 : 2,
        width: 20, height: 20, borderRadius: '50%', background: '#fff',
        transition: 'left 0.2s', boxShadow: '0 1px 3px rgba(0,0,0,0.3)',
      }} />
    </div>
  )

  return (
    <div style={{
      width: 320, minWidth: 320, display: 'flex', flexDirection: 'column',
      background: '#111b21', borderLeft: '1px solid #2a3942', overflowY: 'auto',
      // On mobile the parent sets position:absolute inset:0, so this fills the space
      flex: 1,
    }}>
      {/* Header */}
      <div style={{
        display: 'flex', alignItems: 'center', gap: 16,
        padding: '14px 16px', background: '#202c33',
        borderBottom: '1px solid #2a3942', flexShrink: 0,
      }}>
        <button onClick={onClose}
          style={{ background: 'none', border: 'none', cursor: 'pointer', color: '#aebac1', padding: 4, display: 'flex' }}>
          <X size={20} />
        </button>
        <span style={{ fontSize: 16, fontWeight: 600, color: '#e9edef' }}>Contact info</span>
      </div>

      {/* Profile section */}
      <div style={{
        display: 'flex', flexDirection: 'column', alignItems: 'center',
        padding: '28px 20px 20px', background: '#202c33',
        borderBottom: '1px solid #2a3942',
      }}>
        {picUrl ? (
          <div style={{ width: 120, height: 120, borderRadius: '50%', overflow: 'hidden', marginBottom: 14 }}>
            <img src={picUrl} alt={contact.name} style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
          </div>
        ) : (
          <div style={{
            width: 120, height: 120, borderRadius: '50%', marginBottom: 14,
            background: isGroup ? 'rgba(99,102,241,0.2)' : avatarColor(contact.name),
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            fontSize: 44, fontWeight: 700, color: '#fff',
          }}>
            {isGroup ? <Users size={52} color="#a5b4fc" />
            : isTeam  ? <Megaphone size={52} color="#99f6e4" />
            : (contact.name || '?')[0].toUpperCase()}
          </div>
        )}
        {isGroup && editGroupName ? (
          <div style={{ display: 'flex', gap: 8, alignItems: 'center', marginBottom: 4 }}>
            <input value={groupNameVal} onChange={e => setGroupNameVal(e.target.value)} autoFocus
              style={{ background: '#2a3942', border: '1px solid #25D366', borderRadius: 8, padding: '6px 10px', color: '#e9edef', fontSize: 16, outline: 'none' }} />
            <button onClick={() => { onGroupRename?.(contact.phone, groupNameVal); setEditGroupName(false) }}
              style={{ background: '#25D366', border: 'none', borderRadius: 8, padding: '6px 12px', color: '#fff', cursor: 'pointer', fontSize: 13 }}>Save</button>
            <button onClick={() => setEditGroupName(false)}
              style={{ background: 'none', border: 'none', cursor: 'pointer', color: '#8696a0' }}><X size={16} /></button>
          </div>
        ) : (
          <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginBottom: 4 }}>
            <div style={{ fontSize: 20, fontWeight: 600, color: '#e9edef', textAlign: 'center' }}>{contact.name}</div>
            {isGroup && <button onClick={() => setEditGroupName(true)} style={{ background: 'none', border: 'none', cursor: 'pointer', color: '#8696a0', display: 'flex', padding: 2 }}><Pencil size={14} /></button>}
          </div>
        )}
        <div style={{ fontSize: 13, color: '#8696a0', textAlign: 'center' }}>
          {isGroup ? 'Group' : isTeam ? 'Broadcast list' : contact.phone}
        </div>
        {blocked && (
          <div style={{ marginTop: 8, fontSize: 11, color: '#ff4d4f', background: 'rgba(255,77,79,0.1)', padding: '3px 10px', borderRadius: 10 }}>
            Blocked
          </div>
        )}
        {muted && (
          <div style={{ marginTop: 4, fontSize: 11, color: '#8696a0', background: 'rgba(255,255,255,0.05)', padding: '3px 10px', borderRadius: 10 }}>
            Muted
          </div>
        )}
      </div>

      {/* About / Description */}
      <div style={{ padding: '16px 20px', borderBottom: '1px solid #2a3942' }}>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 6 }}>
          <div style={{ fontSize: 12, color: '#25D366', fontWeight: 600 }}>{isGroup ? 'Description' : 'About'}</div>
          {isGroup && !editGroupDesc && <button onClick={() => setEditGroupDesc(true)} style={{ background: 'none', border: 'none', cursor: 'pointer', color: '#8696a0', display: 'flex' }}><Pencil size={13} /></button>}
        </div>
        {isGroup && editGroupDesc ? (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
            <textarea value={groupDescVal} onChange={e => setGroupDescVal(e.target.value)} rows={3} autoFocus
              style={{ background: '#2a3942', border: '1px solid #25D366', borderRadius: 8, padding: '6px 10px', color: '#e9edef', fontSize: 14, outline: 'none', resize: 'vertical' }} />
            <div style={{ display: 'flex', gap: 8 }}>
              <button onClick={() => { onGroupSetDesc?.(contact.phone, groupDescVal); setEditGroupDesc(false) }}
                style={{ background: '#25D366', border: 'none', borderRadius: 8, padding: '5px 14px', color: '#fff', cursor: 'pointer', fontSize: 13 }}>Save</button>
              <button onClick={() => setEditGroupDesc(false)} style={{ background: 'none', border: 'none', cursor: 'pointer', color: '#8696a0', fontSize: 13 }}>Cancel</button>
            </div>
          </div>
        ) : (
          <div style={{ fontSize: 14, color: '#e9edef', lineHeight: 1.5 }}>
            {isGroup ? (groupDescVal || 'No description') : (contact.notes || 'Hey there! I am using WhatsApp.')}
          </div>
        )}
      </div>

      {/* Email (shown only when set) */}
      {contact.email && (
        <div style={{ padding: '14px 20px', borderBottom: '1px solid #2a3942', display: 'flex', alignItems: 'center', gap: 14 }}>
          <div style={{ flexShrink: 0, color: '#8696a0' }}>
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><rect width="20" height="16" x="2" y="4" rx="2"/><path d="m22 7-8.97 5.7a1.94 1.94 0 0 1-2.06 0L2 7"/></svg>
          </div>
          <div>
            <div style={{ fontSize: 12, color: '#8696a0', marginBottom: 2 }}>Email</div>
            <a href={`mailto:${contact.email}`} style={{ fontSize: 14, color: '#53bdeb', textDecoration: 'none' }}>{contact.email}</a>
          </div>
        </div>
      )}

      {/* Group members (groups only) */}
      {isGroup && (
        <div style={{ borderBottom: '1px solid #2a3942' }}>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '14px 20px 10px', cursor: 'pointer' }}
            onClick={() => setShowMembers(v => !v)}>
            <div>
              <div style={{ fontSize: 14, color: '#e9edef' }}>Group members</div>
              <div style={{ fontSize: 12, color: '#8696a0', marginTop: 2 }}>
                {groupMembers === null ? 'Loading…' : `${groupMembers.length} participants`}
              </div>
            </div>
            <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
              <button onClick={e => { e.stopPropagation(); setShowAddMember(v => !v) }} title="Add member"
                style={{ background: 'none', border: 'none', cursor: 'pointer', color: '#25D366', display: 'flex', padding: 4 }}><UserPlus size={16} /></button>
              <button onClick={e => { e.stopPropagation(); onGroupInviteLink?.(contact.phone) }} title="Copy invite link"
                style={{ background: 'none', border: 'none', cursor: 'pointer', color: '#8696a0', display: 'flex', padding: 4 }}><Link2 size={16} /></button>
              <ChevronRight size={16} color="#8696a0"
                style={{ transform: showMembers ? 'rotate(90deg)' : 'none', transition: 'transform 0.2s' }} />
            </div>
          </div>
          {showAddMember && (
            <div style={{ padding: '0 20px 12px', display: 'flex', gap: 8 }}>
              <input placeholder="+91 phone number" value={addMemberPhone} onChange={e => setAddMemberPhone(e.target.value)}
                style={{ flex: 1, background: '#2a3942', border: '1px solid #3a4a52', borderRadius: 8, padding: '6px 10px', color: '#e9edef', fontSize: 13, outline: 'none' }} />
              <button onClick={() => { if (addMemberPhone.trim()) { onGroupAddMember?.(contact.phone, addMemberPhone.trim()); setAddMemberPhone(''); setShowAddMember(false) } }}
                style={{ background: '#25D366', border: 'none', borderRadius: 8, padding: '6px 12px', color: '#fff', cursor: 'pointer', fontSize: 13 }}>Add</button>
            </div>
          )}
          {showMembers && groupMembers && (
            <div style={{ maxHeight: 260, overflowY: 'auto', paddingBottom: 8 }}>
              {groupMembers.length === 0 ? (
                <div style={{ padding: '0 20px 10px', fontSize: 13, color: '#8696a0' }}>No member data available</div>
              ) : groupMembers.map(m => (
                <div key={m.id} style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '8px 20px' }}
                  onMouseEnter={e => e.currentTarget.style.background = 'rgba(255,255,255,0.03)'}
                  onMouseLeave={e => e.currentTarget.style.background = 'transparent'}>
                  <div style={{ width: 36, height: 36, borderRadius: '50%', background: avatarColor(m.phone), display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 14, fontWeight: 700, color: '#fff', flexShrink: 0 }}>
                    {(m.phone || '?')[1] || '?'}
                  </div>
                  <div style={{ flex: 1 }}>
                    <div style={{ fontSize: 13, color: '#e9edef' }}>{m.phone}</div>
                    {(m.isAdmin || m.isSuperAdmin) && (
                      <div style={{ fontSize: 11, color: '#25D366' }}>{m.isSuperAdmin ? 'Super Admin' : 'Admin'}</div>
                    )}
                  </div>
                  <div style={{ display: 'flex', gap: 4 }}>
                    {m.isAdmin ? (
                      <button onClick={() => onGroupDemote?.(contact.phone, m.id)} title="Demote"
                        style={{ background: 'none', border: 'none', cursor: 'pointer', color: '#f59e0b', padding: 4, display: 'flex' }}><Crown size={14} /></button>
                    ) : (
                      <button onClick={() => onGroupPromote?.(contact.phone, m.id)} title="Make admin"
                        style={{ background: 'none', border: 'none', cursor: 'pointer', color: '#8696a0', padding: 4, display: 'flex' }}><Crown size={14} /></button>
                    )}
                    <button onClick={() => onGroupRemoveMember?.(contact.phone, m.id)} title="Remove"
                      style={{ background: 'none', border: 'none', cursor: 'pointer', color: '#ff4d4f', padding: 4, display: 'flex' }}><UserMinus size={14} /></button>
                  </div>
                </div>
              ))}
            </div>
          )}
          {/* Leave Group */}
          <div style={{ padding: '8px 20px 14px' }}>
            <button onClick={() => onGroupLeave?.(contact.phone)}
              style={{ display: 'flex', alignItems: 'center', gap: 8, background: 'none', border: 'none', cursor: 'pointer', color: '#ff4d4f', fontSize: 14, padding: 0 }}>
              <LogOut size={16} /> Leave Group
            </button>
          </div>
        </div>
      )}

      {/* Media, links and docs */}
      <div style={{ borderBottom: '1px solid #2a3942' }}>
        <div style={{
          display: 'flex', alignItems: 'center', justifyContent: 'space-between',
          padding: '14px 20px 10px', cursor: 'pointer',
        }}
          onClick={() => setShowAllMedia(v => !v)}
        >
          <div>
            <div style={{ fontSize: 14, color: '#e9edef' }}>Media, links and docs</div>
            <div style={{ fontSize: 12, color: '#8696a0', marginTop: 2 }}>
              {mediaImgs.length} {mediaImgs.length === 1 ? 'photo' : 'photos'}
            </div>
          </div>
          <ChevronRight size={16} color="#8696a0"
            style={{ transform: showAllMedia ? 'rotate(90deg)' : 'none', transition: 'transform 0.2s' }} />
        </div>
        {mediaImgs.length > 0 && (
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3,1fr)', gap: 2, padding: '0 2px 10px' }}>
            {(showAllMedia ? mediaImgs : mediaImgs.slice(-6)).map(m => (
              <div key={m.id} style={{ aspectRatio: '1', overflow: 'hidden', cursor: 'zoom-in' }}
                onClick={() => window.open(m.media_url, '_blank')}>
                <img src={m.media_url} alt="" style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
              </div>
            ))}
          </div>
        )}
        {mediaImgs.length === 0 && (
          <div style={{ padding: '0 20px 14px', fontSize: 13, color: '#8696a0' }}>No media shared yet</div>
        )}
      </div>

      {/* Starred messages */}
      <InfoRow
        icon={<Star size={18} fill={starredCount > 0 ? '#f59e0b' : 'none'} color={starredCount > 0 ? '#f59e0b' : '#8696a0'} />}
        label="Starred messages"
        sublabel={starredCount > 0 ? `${starredCount} starred` : 'None'}
        right={<span style={{ fontSize: 13, color: '#8696a0' }}>{starredCount || ''}</span>}
      />

      {/* Notification settings */}
      <InfoRow
        icon={muted ? <BellOff size={18} /> : <Bell size={18} />}
        label="Mute notifications"
        sublabel={muted ? 'Notifications muted' : 'Notifications on'}
        right={<Toggle on={!muted} onChange={toggleMute} />}
      />

      {/* Encryption */}
      <InfoRow
        icon={<Lock size={18} />}
        label="Encryption"
        sublabel="Messages are end-to-end encrypted. Tap to verify."
      />

      {/* Disappearing messages */}
      <InfoRow
        icon={<Timer size={18} />}
        label="Disappearing messages"
        sublabel={disappearing}
        right={
          <select value={disappearing} onChange={e => setDisappearing(e.target.value)}
            onClick={e => e.stopPropagation()}
            style={{ background: '#2a3942', border: 'none', color: '#8696a0', fontSize: 12, cursor: 'pointer', outline: 'none', borderRadius: 6, padding: '3px 6px' }}>
            <option>Off</option>
            <option>24 hours</option>
            <option>7 days</option>
            <option>90 days</option>
          </select>
        }
      />

      {/* Chat lock */}
      <InfoRow
        icon={<EyeOff size={18} />}
        label="Chat lock"
        sublabel={chatLock ? 'Locked — hidden from chat list' : 'Unlocked'}
        right={<Toggle on={chatLock} onChange={() => setChatLock(v => !v)} />}
        last
      />

      {/* Danger actions */}
      <div style={{ borderTop: '1px solid #2a3942', marginTop: 8 }}>
        <InfoRow
          icon={<Shield size={18} />}
          label={blocked ? 'Unblock Contact' : 'Block Contact'}
          sublabel={blocked ? `Unblock ${contact.name}` : `Block ${contact.name}`}
          danger={!blocked}
          onClick={toggleBlock}
        />
        <InfoRow
          icon={<Trash2 size={18} />}
          label="Clear Chat"
          sublabel="Remove all messages from this chat"
          onClick={() => {
            if (window.confirm(`Clear all messages with ${contact.name}? This cannot be undone.`)) onClearChat()
          }}
        />
        <InfoRow
          icon={<Trash2 size={18} />}
          label="Delete Chat"
          sublabel="Delete this contact's entire chat"
          danger
          onClick={() => {
            if (window.confirm(`Delete chat with ${contact.name}? This cannot be undone.`)) onDeleteChat()
          }}
        />
        <InfoRow
          icon={<Flag size={18} />}
          label="Report Contact"
          sublabel="Report to WhatsApp"
          danger
          onClick={() => alert(`Report submitted for ${contact.name}. WhatsApp will review this contact.`)}
          last
        />
      </div>
    </div>
  )
}

// ─── Create Group Modal ──────────────────────────────────────────
function CreateGroupModal({ contacts, onClose, onCreate }) {
  const [name, setName] = useState('')
  const [search, setSearch] = useState('')
  const [selected, setSelected] = useState([])
  const filtered = contacts.filter(c =>
    !c.tags?.includes('Group') &&
    ((c.name || '').toLowerCase().includes(search.toLowerCase()) || (c.phone || '').includes(search))
  )
  const toggle = (id) => setSelected(prev => prev.includes(id) ? prev.filter(x => x !== id) : [...prev, id])
  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="modal" style={{ maxWidth: 420, maxHeight: '85vh' }} onClick={e => e.stopPropagation()}>
        <div className="modal-header">
          <h3 className="modal-title" style={{ display: 'flex', alignItems: 'center', gap: 8 }}><Users size={18} /> New Group</h3>
          <button className="btn btn-ghost btn-icon" onClick={onClose}><X size={18} /></button>
        </div>
        <div style={{ padding: '0 0 12px' }}>
          <input className="form-input" placeholder="Group name *" value={name} onChange={e => setName(e.target.value)}
            style={{ marginBottom: 10, background: '#202c33', border: '1px solid #2a3942', color: '#e9edef', borderRadius: 8, padding: '8px 12px', width: '100%', fontSize: 14, outline: 'none' }} />
          <div style={{ display: 'flex', alignItems: 'center', gap: 8, background: '#202c33', borderRadius: 8, padding: '7px 12px', marginBottom: 8 }}>
            <Search size={14} color="#8696a0" />
            <input placeholder="Search contacts to add" value={search} onChange={e => setSearch(e.target.value)}
              style={{ flex: 1, background: 'none', border: 'none', outline: 'none', color: '#e9edef', fontSize: 14 }} />
          </div>
          {selected.length > 0 && (
            <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6, marginBottom: 8 }}>
              {selected.map(id => {
                const c = contacts.find(x => x.id === id)
                return c ? (
                  <span key={id} style={{ background: 'rgba(37,211,102,0.12)', color: '#25D366', borderRadius: 16, padding: '3px 10px', fontSize: 12, display: 'flex', alignItems: 'center', gap: 5 }}>
                    {c.name} <X size={11} style={{ cursor: 'pointer' }} onClick={() => toggle(id)} />
                  </span>
                ) : null
              })}
            </div>
          )}
          <div style={{ maxHeight: 260, overflowY: 'auto' }}>
            {filtered.slice(0, 50).map(c => (
              <div key={c.id} onClick={() => toggle(c.id)}
                style={{ display: 'flex', alignItems: 'center', gap: 12, padding: '9px 4px', cursor: 'pointer', borderRadius: 8, background: selected.includes(c.id) ? 'rgba(37,211,102,0.08)' : 'transparent' }}>
                <div style={{ width: 36, height: 36, borderRadius: '50%', background: AVATAR_COLORS[c.name?.charCodeAt(0) % 10], display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 14, fontWeight: 700, color: '#fff', flexShrink: 0 }}>
                  {(c.name || '?')[0].toUpperCase()}
                </div>
                <div style={{ flex: 1 }}>
                  <div style={{ fontSize: 14, color: '#e9edef' }}>{c.name}</div>
                  <div style={{ fontSize: 12, color: '#8696a0' }}>{c.phone}</div>
                </div>
                {selected.includes(c.id) && <Check size={16} color="#25D366" />}
              </div>
            ))}
          </div>
        </div>
        <div className="modal-footer">
          <button className="btn btn-secondary" onClick={onClose}>Cancel</button>
          <button className="btn btn-primary" disabled={!name.trim() || selected.length === 0}
            onClick={() => { onCreate(name.trim(), selected.map(id => contacts.find(c => c.id === id)?.phone).filter(Boolean)); onClose() }}>
            <Plus size={14} /> Create Group
          </button>
        </div>
      </div>
    </div>
  )
}

// ─── Grammar Bar ────────────────────────────────────────────────
function GrammarBar({ text, onApplyCorrection }) {
  const { checking, result, language, setLanguage, check, reset } = useGrammarCheck()
  const [showReview, setShowReview] = useState(false)
  const [autoCorrect, setAutoCorrect] = useState(false)

  useEffect(() => {
    check(text)
    setShowReview(false)
  }, [text, check])

  // Auto-correct: silently fix the text once the check result arrives
  useEffect(() => {
    if (!autoCorrect || checking || !result) return
    const { corrected } = result
    if (corrected && corrected !== text) onApplyCorrection(corrected)
  }, [autoCorrect, checking, result]) // eslint-disable-line react-hooks/exhaustive-deps

  // Clean up on unmount
  useEffect(() => reset, [reset])

  const issues = result?.issues ?? 0
  const corrected = result?.corrected || ''
  const hasCorrection = !!(corrected && corrected !== text)

  return (
    <div style={{ padding: '2px 12px 0', background: '#202c33', borderTop: '1px solid #1a2730' }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '5px 0' }}>

        {/* Status indicator */}
        <div style={{ flex: 1, fontSize: 12 }}>
          {checking ? (
            <span style={{ color: '#8696a0' }}>Checking…</span>
          ) : issues > 0 ? (
            <span style={{ color: '#f59e0b', display: 'flex', alignItems: 'center', gap: 4 }}>
              <AlertCircle size={12} /> {issues} {issues === 1 ? 'issue' : 'issues'} found
            </span>
          ) : result ? (
            <span style={{ color: '#25D366', display: 'flex', alignItems: 'center', gap: 4 }}>
              <Check size={12} /> Looks good
            </span>
          ) : (
            <span style={{ color: '#56717a', fontSize: 11 }}>Spell & grammar check</span>
          )}
        </div>

        {/* Language selector */}
        <select
          value={language}
          onChange={e => { setLanguage(e.target.value); reset() }}
          style={{ background: '#1a2730', border: '1px solid #2a3942', color: '#8696a0', fontSize: 11, borderRadius: 6, padding: '2px 6px', cursor: 'pointer', outline: 'none' }}
        >
          <option value="en-US">English</option>
          <option value="en-GB">English (UK)</option>
          <option value="ta">Tamil</option>
          <option value="auto">Auto-detect</option>
        </select>

        {/* Auto-correct toggle */}
        <button
          onClick={() => setAutoCorrect(v => !v)}
          title={autoCorrect ? 'Auto-correct is ON — mistakes are fixed immediately' : 'Auto-correct is OFF — click Fix to review'}
          style={{
            background: autoCorrect ? 'rgba(37,211,102,0.12)' : 'transparent',
            border: `1px solid ${autoCorrect ? 'rgba(37,211,102,0.4)' : '#2a3942'}`,
            borderRadius: 6, padding: '2px 8px', fontSize: 11,
            color: autoCorrect ? '#25D366' : '#8696a0',
            cursor: 'pointer', transition: 'all 0.15s',
          }}
        >
          Auto {autoCorrect ? 'ON' : 'OFF'}
        </button>

        {/* Fix All button */}
        {issues > 0 && !autoCorrect && hasCorrection && (
          <button
            onClick={() => setShowReview(v => !v)}
            style={{
              background: showReview ? '#128C7E' : '#25D366',
              border: 'none', borderRadius: 6,
              padding: '3px 10px', fontSize: 12, color: '#fff',
              cursor: 'pointer', fontWeight: 600, display: 'flex', alignItems: 'center', gap: 4,
              transition: 'background 0.15s',
            }}
          >
            ✨ Fix All
          </button>
        )}
      </div>

      {/* Correction review panel */}
      {showReview && hasCorrection && (
        <div style={{
          margin: '0 0 6px',
          background: '#1a2730', borderRadius: 8, padding: '10px 12px',
          border: '1px solid #2a3942',
        }}>
          <div style={{ fontSize: 11, color: '#8696a0', marginBottom: 6, fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.05em' }}>
            Suggested correction
          </div>
          <div style={{
            fontSize: 13, color: '#e9edef', lineHeight: 1.55,
            marginBottom: 10, wordBreak: 'break-word', whiteSpace: 'pre-wrap',
            background: 'rgba(37,211,102,0.05)', borderRadius: 6,
            padding: '8px 10px', border: '1px solid rgba(37,211,102,0.12)',
          }}>
            {corrected}
          </div>
          <div style={{ display: 'flex', gap: 6, justifyContent: 'flex-end' }}>
            <button
              onClick={() => setShowReview(false)}
              style={{ background: 'transparent', border: '1px solid #2a3942', borderRadius: 6, padding: '4px 12px', color: '#8696a0', fontSize: 12, cursor: 'pointer' }}
            >
              Dismiss
            </button>
            <button
              onClick={() => { onApplyCorrection(corrected); setShowReview(false) }}
              style={{ background: '#25D366', border: 'none', borderRadius: 6, padding: '4px 14px', color: '#fff', fontSize: 12, cursor: 'pointer', fontWeight: 600 }}
            >
              Apply Correction
            </button>
          </div>
        </div>
      )}
    </div>
  )
}

// ─── Main Component ──────────────────────────────────────────────
export default function Messages() {
  const [contacts, setContacts] = useState([])
  const [selectedContact, setSelectedContact] = useState(null)
  const [messages, setMessages] = useState([])
  const [searchContact, setSearchContact] = useState('')
  const [loadingContacts, setLoadingContacts] = useState(true)
  const [loadingMessages, setLoadingMessages] = useState(false)
  const [newMessage, setNewMessage] = useState('')
  const [lastMessages, setLastMessages] = useState({})
  const [profilePics, setProfilePics] = useState({})
  const [unreadContacts, setUnreadContacts] = useState(new Set())
  const [notifEnabled, setNotifEnabled] = useState(false)
  const [mobileChatOpen, setMobileChatOpen] = useState(false)

  // Bridge chat list (full, for left panel)
  const [bridgeChats, setBridgeChats] = useState([])

  // Left panel filter tabs
  const [activeFilter, setActiveFilter] = useState('All')
  const [showArchived, setShowArchived] = useState(false)

  // Favourites (persisted to localStorage)
  const [favourites, setFavourites] = useState(() => {
    try { return new Set(JSON.parse(localStorage.getItem('wa_favourites') || '[]')) }
    catch { return new Set() }
  })

  // Contact info panel
  const [showContactInfo, setShowContactInfo] = useState(false)

  // Phase 4 additions
  const [replyTo, setReplyTo] = useState(null)              // { id, content, direction }
  const [contextMenu, setContextMenu] = useState(null)       // { msg, x, y }
  const [reactions, setReactions] = useState({})             // { msgId: emoji }
  const [starredMsgs, setStarredMsgs] = useState(new Set())
  const [forwardMsg, setForwardMsg] = useState(null)
  const [lightboxImg, setLightboxImg] = useState(null)

  // Phase 11 – Search & Pin/Archive
  const [searchMsg, setSearchMsg] = useState('')
  const [showMsgSearch, setShowMsgSearch] = useState(false)
  const [pinnedByUser, setPinnedByUser] = useState(() => {
    try { return new Set(JSON.parse(localStorage.getItem('wa_pinned') || '[]')) } catch { return new Set() }
  })
  const [archivedByUser, setArchivedByUser] = useState(() => {
    try { return new Set(JSON.parse(localStorage.getItem('wa_archived') || '[]')) } catch { return new Set() }
  })
  // Phase 12 – Group creation modal
  const [showCreateGroup, setShowCreateGroup] = useState(false)
  // Phase 12 – Group management inline modal
  const [groupModal, setGroupModal] = useState(null) // { type: 'rename'|'desc'|'addMember', groupId, current }

  const isMobile = useIsMobile()
  const { sessionStatus, loadingSession, syncedAt } = useApp()
  const [showAttachMenu, setShowAttachMenu] = useState(false)
  const [callModal, setCallModal] = useState(null)
  const [attachModal, setAttachModal] = useState(null)
  const [attachName, setAttachName] = useState('')
  const [attachUrl, setAttachUrl] = useState('')

  const chatEndRef = useRef(null)
  const textareaRef = useRef(null)
  const fileInputRef = useRef(null)

  // AI reply state
  const [aiEnabled, setAiEnabled] = useState(false)
  const [aiLoading, setAiLoading] = useState(false)
  const [isAiDraft, setIsAiDraft] = useState(false)

  // Check if AI is enabled on mount
  useEffect(() => {
    aiApi.getSettings().then(r => setAiEnabled(r.data?.enabled === true)).catch(() => {})
  }, [])
  const imageInputRef = useRef(null)
  const audioInputRef = useRef(null)
  const seenMsgIdsRef = useRef(new Set())
  const contactsMapRef = useRef({})
  const { notify } = useNotifications()

  // Fetch real WhatsApp chat list from bridge
  const fetchBridgeChats = useCallback(async () => {
    if (sessionStatus.status !== 'connected') return
    try {
      const res = await contactsApi.getChats()
      // Backend returns {success: false, chats: []} when bridge is down — skip silently
      if (!res.data?.success && !res.data?.chats?.length) return
      const chats = res.data?.chats || []
      setBridgeChats(chats)

      // Also update lastMessages + unreadContacts from bridge data
      setContacts(prev => {
        const byPhone = {}
        prev.forEach(c => { byPhone[c.phone] = c.id })
        const lmUpdates = {}
        const unreadPhones = new Set()
        chats.forEach(chat => {
          if (chat.lastMessage || chat.lastMessageTime) {
            const cid = byPhone[chat.phone]
            if (cid) lmUpdates[cid] = {
              content: chat.lastMessage || '',
              time: chat.lastMessageTime ? new Date(chat.lastMessageTime).toISOString() : null,
              direction: chat.lastMessageFromMe ? 'outbound' : 'inbound',
            }
          }
          if (chat.unreadCount > 0) unreadPhones.add(chat.phone)
        })
        if (Object.keys(lmUpdates).length > 0)
          setLastMessages(prev2 => ({ ...prev2, ...lmUpdates }))
        if (unreadPhones.size > 0) {
          setUnreadContacts(prev2 => {
            const next = new Set(prev2)
            unreadPhones.forEach(phone => {
              const cid = byPhone[phone]
              if (cid && (!selectedContact || selectedContact.id !== cid)) next.add(cid)
            })
            return next
          })
        }
        return prev
      })
    } catch {}
  }, [sessionStatus.status, selectedContact])

  useEffect(() => {
    fetchBridgeChats()
    const iv = setInterval(fetchBridgeChats, 30000)
    return () => clearInterval(iv)
  }, [fetchBridgeChats])

  // Load reactions + starred from localStorage when contact changes
  useEffect(() => {
    if (!selectedContact) return
    try {
      const r = localStorage.getItem(`wa_reactions_${selectedContact.id}`)
      setReactions(r ? JSON.parse(r) : {})
      const s = localStorage.getItem(`wa_starred_${selectedContact.id}`)
      setStarredMsgs(s ? new Set(JSON.parse(s)) : new Set())
    } catch { setReactions({}); setStarredMsgs(new Set()) }
  }, [selectedContact?.id])

  // Browser notification permission check on mount
  useEffect(() => {
    if (typeof Notification !== 'undefined') setNotifEnabled(Notification.permission === 'granted')
  }, [])

  const fetchContacts = useCallback(async () => {
    setLoadingContacts(true)
    try {
      const params = { limit: 300 }
      // Filter by current connected WhatsApp account so only this account's contacts show
      if (sessionStatus?.phone) params.wa_account = sessionStatus.phone
      const res = await contactsApi.getAll(params)
      const list = res.data?.contacts || res.data || []
      setContacts(list)
      const map = {}; list.forEach(c => { map[c.id] = c }); contactsMapRef.current = map
      if (list.length > 0 && !selectedContact) setSelectedContact(list[0])
    } catch { setContacts([]) }
    finally { setLoadingContacts(false) }
  }, [selectedContact, sessionStatus?.phone])

  const fetchProfilePic = useCallback(async (contactId) => {
    if (profilePics[contactId] !== undefined) return
    try {
      const res = await contactsApi.getProfilePic(contactId)
      setProfilePics(prev => ({ ...prev, [contactId]: res.data?.url || null }))
    } catch { setProfilePics(prev => ({ ...prev, [contactId]: null })) }
  }, [profilePics])

  const fetchMessages = useCallback(async () => {
    if (!selectedContact) return
    setLoadingMessages(true)
    try {
      const res = await messagesApi.getAll({ contact_id: selectedContact.id, limit: 150 })
      const sorted = [...(res.data?.messages || res.data || [])].sort(
        (a, b) => new Date(a.created_at) - new Date(b.created_at)
      )
      setMessages(sorted)
      if (sorted.length > 0) {
        const last = sorted[sorted.length - 1]
        setLastMessages(prev => ({ ...prev, [selectedContact.id]: { content: last.content, time: last.created_at, direction: last.direction } }))
      }
      setUnreadContacts(prev => { const n = new Set(prev); n.delete(selectedContact.id); return n })
    } catch { setMessages([]) }
    finally { setLoadingMessages(false) }
  }, [selectedContact])

  const pollInbound = useCallback(async () => {
    if (sessionStatus.status !== 'connected') return
    try {
      const res = await messagesApi.getAll({ direction: 'inbound', limit: 20 })
      const msgs = res.data?.messages || res.data || []
      if (seenMsgIdsRef.current.size === 0) { msgs.forEach(m => seenMsgIdsRef.current.add(m.id)); return }
      let hasNew = false
      for (const m of msgs) {
        if (!seenMsgIdsRef.current.has(m.id)) {
          seenMsgIdsRef.current.add(m.id); hasNew = true
          const contact = contactsMapRef.current[m.contact_id]
          notify(contact?.name || m.phone || 'WhatsApp', (m.content || '').slice(0, 80), {
            tag: `wa-msg-${m.contact_id}`,
            onClick: () => { if (contact) setSelectedContact(contact) }
          })
          if (!selectedContact || m.contact_id !== selectedContact.id)
            setUnreadContacts(prev => new Set([...prev, m.contact_id]))
          setLastMessages(prev => ({ ...prev, [m.contact_id]: { content: m.content, time: m.created_at, direction: 'inbound' } }))
        }
      }
      if (hasNew && selectedContact) fetchMessages()
    } catch {}
  }, [sessionStatus.status, selectedContact, notify, fetchMessages])

  // Pre-load lastMessages from DB on mount so sort order is correct immediately
  const preloadLastMessages = useCallback(async () => {
    try {
      const res = await messagesApi.getAll({ limit: 500 })
      const msgs = res.data?.messages || []
      const lm = {}
      msgs.forEach(m => {
        if (!m.contact_id) return
        if (!lm[m.contact_id] || new Date(m.created_at) > new Date(lm[m.contact_id].time)) {
          lm[m.contact_id] = { content: m.content, time: m.created_at, direction: m.direction }
        }
      })
      setLastMessages(prev => ({ ...lm, ...prev }))  // SSE/bridge updates already in prev take priority
    } catch {}
  }, [])

  useEffect(() => { fetchContacts(); preloadLastMessages() }, [])
  // Refetch when background sync completes so new contacts appear immediately
  useEffect(() => { if (syncedAt > 0) { fetchContacts(); preloadLastMessages() } }, [syncedAt]) // eslint-disable-line react-hooks/exhaustive-deps
  useEffect(() => { fetchMessages(); const iv = setInterval(fetchMessages, 5000); return () => clearInterval(iv) }, [selectedContact])
  useEffect(() => {
    if (sessionStatus.status !== 'connected') return
    pollInbound(); const iv = setInterval(pollInbound, 8000); return () => clearInterval(iv)
  }, [sessionStatus.status])
  useEffect(() => { if (selectedContact) fetchProfilePic(selectedContact.id) }, [selectedContact])
  useEffect(() => { chatEndRef.current?.scrollIntoView({ behavior: 'smooth' }) }, [messages])

  // ── Real-time SSE: show incoming WhatsApp messages instantly ───
  useEffect(() => {
    if (sessionStatus.status !== 'connected') return
    const es = new EventSource(`${BASE_URL}/messages/stream`)
    es.onmessage = (e) => {
      try {
        const data = JSON.parse(e.data)
        if (data.type !== 'new_message') return
        const cid = data.contact_id
        // Update last message preview in chat list
        setLastMessages(prev => ({
          ...prev,
          [cid]: { content: data.content, time: new Date().toISOString(), direction: 'inbound' }
        }))
        if (selectedContact?.id === cid) {
          // Active chat — fetch messages immediately so bubble appears
          fetchMessages()
        } else {
          // Other chat — mark unread + desktop notification
          setUnreadContacts(prev => new Set([...prev, cid]))
          const contact = contactsMapRef.current[cid]
          notify(contact?.name || data.name || data.phone || 'WhatsApp', (data.content || '').slice(0, 80), {
            tag: `wa-msg-${cid}`,
            onClick: () => { if (contact) selectContact(contact) }
          })
        }
      } catch {}
    }
    es.onerror = () => {}  // browser auto-reconnects on error
    return () => es.close()
  }, [sessionStatus.status, selectedContact?.id, fetchMessages, notify])

  // ── Send message (with reply prefix) ──────────────────────────
  const handleSend = async (textToSend, mediaInfo = null, targetContact = null) => {
    const contact = targetContact || selectedContact
    if (!contact || !textToSend?.trim()) return
    let content = textToSend
    if (!targetContact && replyTo) {
      const qText = parseContent(replyTo.content).text || replyTo.content || ''
      const qFrom = replyTo.direction === 'outbound' ? 'You' : selectedContact?.name
      content = `[Reply to ${qFrom}|${qText.slice(0, 60)}]:\n${textToSend}`
      setReplyTo(null)
    }
    const payload = { contact_id: contact.id, phone: contact.phone, message: content }
    if (mediaInfo) { payload.media_url = mediaInfo.url; payload.media_type = mediaInfo.type }
    try {
      await messagesApi.send(payload)
      if (!targetContact) { setNewMessage(''); fetchMessages() }
    } catch (err) { alert(getErrorMessage(err, 'Failed to send message.')) }
  }

  const handleFileChange = (e, type) => {
    const file = e.target.files[0]; if (!file) return
    handleSend(`${type === 'file' ? 'Document' : type === 'audio' ? 'Audio' : 'Image'}: ${file.name}`, { url: URL.createObjectURL(file), type })
    e.target.value = null
  }

  const handleAttachSubmit = (e) => {
    e.preventDefault(); if (!attachName) return
    const typeLabel = attachModal === 'file' ? 'Document' : attachModal === 'image' ? 'Image' : 'Location'
    handleSend(`${typeLabel}: ${attachName} (${attachUrl || 'Attached'})`, { url: attachUrl || 'http://example.com/file', type: attachModal })
    setAttachModal(null); setAttachName(''); setAttachUrl('')
  }

  const selectContact = (c) => {
    setSelectedContact(c); fetchProfilePic(c.id)
    setUnreadContacts(prev => { const s = new Set(prev); s.delete(c.id); return s })
    setReplyTo(null); setShowContactInfo(false)
    if (isMobile) setMobileChatOpen(true)
  }

  const handleClearChat = () => { setMessages([]); setShowContactInfo(false) }
  const handleDeleteChat = () => {
    setMessages([]); setSelectedContact(null); setShowContactInfo(false)
    if (isMobile) setMobileChatOpen(false)
  }

  const requestNotifPermission = async () => {
    if (typeof Notification === 'undefined') return
    const p = await Notification.requestPermission()
    setNotifEnabled(p === 'granted')
  }

  // ── Phase 4 handlers ─────────────────────────────────────────
  const handleContextMenu = (e, msg) => {
    e.preventDefault()
    setContextMenu({ msg, x: e.clientX, y: e.clientY })
  }

  const handleReact = (msgId, emoji) => {
    setReactions(prev => {
      const next = { ...prev }
      if (next[msgId] === emoji) delete next[msgId]
      else next[msgId] = emoji
      if (selectedContact) localStorage.setItem(`wa_reactions_${selectedContact.id}`, JSON.stringify(next))
      return next
    })
  }

  // ─── AI Reply ──────────────────────────────────────────────────
  const handleAiSuggest = async () => {
    if (!selectedContact || aiLoading) return
    setAiLoading(true)
    setIsAiDraft(false)
    try {
      // Build conversation history from the last 12 messages
      const history = messages.slice(-12).map(m => ({
        role: m.direction === 'inbound' ? 'user' : 'assistant',
        content: m.content,
      }))
      if (!history.length) {
        // Seed with contact name as context if no messages yet
        history.push({ role: 'user', content: `Hello, I am ${selectedContact.name}` })
      }
      const res = await aiApi.generateReply({ messages: history })
      if (res.data?.reply) {
        setNewMessage(res.data.reply)
        setIsAiDraft(true)
        requestAnimationFrame(() => {
          if (textareaRef.current) {
            textareaRef.current.style.height = 'auto'
            textareaRef.current.style.height = Math.min(textareaRef.current.scrollHeight, 120) + 'px'
            textareaRef.current.focus()
          }
        })
      }
    } catch (err) {
      const detail = err?.response?.data?.detail || 'AI reply failed. Check Settings → AI Integration.'
      setNewMessage(detail.startsWith('No API key') ? '' : newMessage)
      console.error('AI suggest error:', detail)
    } finally {
      setAiLoading(false)
    }
  }

  const handleStar = (msgId) => {
    setStarredMsgs(prev => {
      const next = new Set(prev)
      next.has(msgId) ? next.delete(msgId) : next.add(msgId)
      if (selectedContact) localStorage.setItem(`wa_starred_${selectedContact.id}`, JSON.stringify([...next]))
      return next
    })
  }

  const handleDeleteLocal = (msgId) => {
    setMessages(prev => prev.filter(m => m.id !== msgId))
  }

  const handleForward = (targetContact) => {
    if (!forwardMsg || !targetContact) return
    const { text } = parseContent(forwardMsg.content)
    handleSend(text, null, targetContact)
  }

  const handleExportChat = () => {
    if (!selectedContact || messages.length === 0) return
    const lines = [`WhatsApp Chat with ${selectedContact.name}`, `Exported: ${new Date().toLocaleString('en-IN')}`, '─'.repeat(50), '']
    messages.forEach(m => {
      const { text } = parseContent(m.content)
      const time = m.created_at ? new Date(m.created_at).toLocaleString('en-IN') : ''
      const sender = m.direction === 'outbound' ? 'You' : selectedContact.name
      lines.push(`[${time}] ${sender}: ${text}`)
    })
    const blob = new Blob([lines.join('\n')], { type: 'text/plain' })
    const a = document.createElement('a')
    a.href = URL.createObjectURL(blob)
    a.download = `chat_${selectedContact.name.replace(/\s+/g, '_')}_${new Date().toISOString().slice(0,10)}.txt`
    a.click(); URL.revokeObjectURL(a.href)
  }

  // Phase 11 – Pin / Archive
  const togglePinChat = (contactId) => {
    setPinnedByUser(prev => {
      const next = new Set(prev)
      next.has(contactId) ? next.delete(contactId) : next.add(contactId)
      localStorage.setItem('wa_pinned', JSON.stringify([...next]))
      return next
    })
  }
  const toggleArchiveChat = (contactId) => {
    setArchivedByUser(prev => {
      const next = new Set(prev)
      next.has(contactId) ? next.delete(contactId) : next.add(contactId)
      localStorage.setItem('wa_archived', JSON.stringify([...next]))
      return next
    })
  }

  // Phase 12 – Group operations
  const handleCreateGroup = async (name, phones) => {
    try {
      const res = await groupsApi.create({ name, participants: phones })
      if (res.data?.success) { alert(`Group "${name}" created!`); fetchContacts() }
      else alert(res.data?.error || 'Failed to create group')
    } catch { alert('Failed to create group') }
  }
  const handleGroupRename = async (groupId, name) => {
    try { await groupsApi.rename({ groupId, name }); fetchContacts() } catch { alert('Failed to rename group') }
  }
  const handleGroupSetDesc = async (groupId, description) => {
    try { await groupsApi.setDescription({ groupId, description }) } catch { alert('Failed to update description') }
  }
  const handleGroupAddMember = async (groupId, phone) => {
    try {
      const res = await groupsApi.addMembers({ groupId, participants: [phone] })
      if (res.data?.success) { alert('Member added!'); fetchContacts() }
      else alert(res.data?.error || 'Failed to add member')
    } catch { alert('Failed to add member') }
  }
  const handleGroupRemoveMember = async (groupId, participantId) => {
    if (!window.confirm('Remove this member?')) return
    try { await groupsApi.removeMember({ groupId, participantId }); fetchContacts() } catch { alert('Failed to remove member') }
  }
  const handleGroupPromote = async (groupId, participantId) => {
    try { await groupsApi.promote({ groupId, participantId }) } catch { alert('Failed to promote member') }
  }
  const handleGroupDemote = async (groupId, participantId) => {
    try { await groupsApi.demote({ groupId, participantId }) } catch { alert('Failed to demote member') }
  }
  const handleGroupInviteLink = async (groupId) => {
    try {
      const res = await groupsApi.getInviteLink(groupId)
      if (res.data?.link) { navigator.clipboard?.writeText(res.data.link); alert(`Link copied!\n${res.data.link}`) }
    } catch { alert('Failed to get invite link') }
  }
  const handleGroupLeave = async (groupId) => {
    if (!window.confirm('Leave this group?')) return
    try {
      await groupsApi.leave({ groupId })
      setSelectedContact(null); fetchContacts()
    } catch { alert('Failed to leave group') }
  }

  // Toggle favourite
  const toggleFavourite = (contactId) => {
    setFavourites(prev => {
      const next = new Set(prev)
      next.has(contactId) ? next.delete(contactId) : next.add(contactId)
      localStorage.setItem('wa_favourites', JSON.stringify([...next]))
      return next
    })
  }

  // ── Merged display list: bridge chats + DB contacts ───────────
  const displayChats = useMemo(() => {
    const phoneToContact = {}
    contacts.forEach(c => { phoneToContact[c.phone] = c })

    if (bridgeChats.length > 0) {
      const bridgePhones = new Set(bridgeChats.map(c => c.phone))
      // DB-only contacts not seen in bridge at all (manually added, no WhatsApp chat yet)
      const dbOnly = contacts
        .filter(c => !bridgePhones.has(c.phone))
        .map(c => ({
          id: c.id, name: c.name, phone: c.phone,
          isGroup: c.tags?.includes('Group'),
          lastMessage: lastMessages[c.id]?.content || '',
          lastMessageTime: lastMessages[c.id]?.time || null,  // no fallback — no messages → sort to bottom
          lastMessageFromMe: lastMessages[c.id]?.direction === 'outbound',
          lastMessageType: 'chat', lastMessageAuthor: null,
          unreadCount: unreadContacts.has(c.id) ? 1 : 0,
          pinned: false, archived: false, participantCount: 0,
          contact: c, dbOnly: true,
        }))
      // ALL bridge chats — including senders not yet in DB (they auto-create on click)
      const bridgeMapped = bridgeChats.map(chat => {
        const dbContact = phoneToContact[chat.phone]
        return {
          ...chat,
          contact: dbContact || null,
          id: dbContact ? dbContact.id : chat.phone,  // phone string as key when no DB record yet
          name: dbContact ? (dbContact.name || chat.name) : chat.name,
          unreadCount: chat.unreadCount || (dbContact && unreadContacts.has(dbContact.id) ? 1 : 0),
          pinned: (dbContact && pinnedByUser.has(dbContact.id)) || chat.pinned,
          archived: (dbContact && archivedByUser.has(dbContact.id)) || chat.archived,
        }
      })
      return [...bridgeMapped, ...dbOnly]
    }

    // Fallback: DB contacts only (bridge not available)
    return contacts.map(c => ({
      id: c.id, name: c.name, phone: c.phone,
      isGroup: c.tags?.includes('Group'),
      lastMessage: lastMessages[c.id]?.content || '',
      lastMessageTime: lastMessages[c.id]?.time || null,  // no fallback — no messages → sort to bottom
      lastMessageFromMe: lastMessages[c.id]?.direction === 'outbound',
      lastMessageType: 'chat', lastMessageAuthor: null,
      unreadCount: unreadContacts.has(c.id) ? 1 : 0,
      pinned: pinnedByUser.has(c.id), archived: archivedByUser.has(c.id), participantCount: 0,
      contact: c,
    }))
  }, [bridgeChats, contacts, lastMessages, unreadContacts, pinnedByUser, archivedByUser])

  // ── Split archived / active and apply filters ─────────────────
  const { activeChats, archivedChats, filteredChats } = useMemo(() => {
    const archived = displayChats.filter(c => c.archived)
    const active   = displayChats.filter(c => !c.archived)

    let filtered = active
    if (activeFilter === 'Unread')     filtered = active.filter(c => c.unreadCount > 0)
    else if (activeFilter === 'Favourites') filtered = active.filter(c => c.id && favourites.has(c.id))
    else if (activeFilter === 'Groups')    filtered = active.filter(c => c.isGroup)
    else if (activeFilter === 'Communities') filtered = active.filter(c => c.isGroup && c.participantCount > 50)

    if (searchContact) {
      const q = searchContact.toLowerCase()
      filtered = filtered.filter(c =>
        (c.name || '').toLowerCase().includes(q) || (c.phone || '').includes(q)
      )
    }

    // Pinned first, then by time desc
    filtered.sort((a, b) => {
      if (a.pinned && !b.pinned) return -1
      if (!a.pinned && b.pinned) return 1
      const ta = a.lastMessageTime ? new Date(a.lastMessageTime) : 0
      const tb = b.lastMessageTime ? new Date(b.lastMessageTime) : 0
      return tb - ta
    })

    return { activeChats: active, archivedChats: archived, filteredChats: filtered }
  }, [displayChats, activeFilter, searchContact, favourites])

  // Auto-select first chat
  useEffect(() => {
    if (!selectedContact && filteredChats.length > 0 && filteredChats[0].contact) {
      setSelectedContact(filteredChats[0].contact)
    }
  }, [filteredChats, selectedContact])

  // ── Select a display chat (bridge or DB) ─────────────────────
  const selectDisplayChat = useCallback(async (chat) => {
    if (chat.contact) {
      selectContact(chat.contact)
      return
    }
    // Search DB first — avoid 409 when contact exists but wasn't loaded (e.g. wa_account mismatch)
    try {
      const res = await contactsApi.getAll({ search: chat.phone, limit: 10 })
      const found = res.data?.contacts?.find(c => c.phone === chat.phone)
      if (found) {
        setContacts(prev => prev.find(c => c.id === found.id) ? prev : [...prev, found])
        contactsMapRef.current = { ...contactsMapRef.current, [found.id]: found }
        selectContact(found)
        return
      }
    } catch {}
    // Truly new contact — create it
    try {
      const res = await contactsApi.create({
        name: chat.name, phone: chat.phone,
        tags: chat.isGroup ? ['Group'] : [],
      })
      const newContact = res.data
      setContacts(prev => [...prev, newContact])
      contactsMapRef.current = { ...contactsMapRef.current, [newContact.id]: newContact }
      selectContact(newContact)
    } catch {}
  }, [selectContact])

  if (loadingSession) return (
    <div style={{ display: 'flex', justifyContent: 'center', alignItems: 'center', height: 'calc(100vh - 120px)', color: '#8696a0', background: '#111b21', borderRadius: 12 }}>
      <RefreshCw size={22} style={{ marginRight: 10, animation: 'wapin 1s linear infinite' }} /> Loading...
      <style>{`@keyframes wapin{to{transform:rotate(360deg)}}`}</style>
    </div>
  )

  if (sessionStatus.status !== 'connected') return (
    <div>
      <div className="page-header"><div><h2 className="page-title">Messages</h2><p className="page-subtitle">WhatsApp Chat</p></div></div>
      <div className="card empty-state" style={{ padding: '60px 20px', textAlign: 'center', marginTop: 20 }}>
        <WifiOff size={48} style={{ margin: '0 auto 16px', color: 'var(--accent-rose)' }} />
        <h3>WhatsApp Connection Required</h3>
        <p style={{ maxWidth: 420, margin: '8px auto 20px', fontSize: 'var(--font-size-sm)', color: 'var(--text-secondary)', lineHeight: 1.6 }}>Connect your WhatsApp account to view chats and send messages.</p>
        <Link to="/settings" className="btn btn-primary">Go to Settings &amp; Connect</Link>
      </div>
    </div>
  )

  const showLeft  = !isMobile || !mobileChatOpen
  const showRight = !isMobile || mobileChatOpen

  return (
    <>
      <div style={{ height: isMobile ? 'calc(100vh - 130px)' : 'calc(100vh - 120px)', display: 'flex', borderRadius: isMobile ? 8 : 12, overflow: 'hidden', border: '1px solid #2a3942' }}
        onClick={() => { setContextMenu(null); setShowAttachMenu(false) }}>

        {/* ── LEFT PANEL ── */}
        <div style={{ width: isMobile ? '100%' : 360, minWidth: isMobile ? 0 : 280, display: showLeft ? 'flex' : 'none', flexDirection: 'column', background: '#111b21', borderRight: isMobile ? 'none' : '1px solid #2a3942' }}>
          {/* Header */}
          <div style={{ padding: '14px 16px 10px', background: '#202c33', display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexShrink: 0 }}>
            <span style={{ fontWeight: 700, fontSize: 20, color: '#e9edef' }}>WhatsApp</span>
            <div style={{ display: 'flex', gap: 2, alignItems: 'center' }}>
              <button onClick={() => setShowCreateGroup(true)} title="New Group"
                style={{ background: 'none', border: 'none', cursor: 'pointer', padding: 7, borderRadius: '50%', display: 'flex', alignItems: 'center', color: '#8696a0' }}>
                <Users size={18} />
              </button>
              <button onClick={requestNotifPermission} title={notifEnabled ? 'Notifications on' : 'Enable notifications'}
                style={{ background: 'none', border: 'none', cursor: 'pointer', padding: 7, borderRadius: '50%', display: 'flex', alignItems: 'center', color: notifEnabled ? '#25D366' : '#8696a0' }}>
                <BellRing size={18} />
              </button>
              <button onClick={() => { fetchContacts(); fetchBridgeChats() }} title="Refresh"
                style={{ background: 'none', border: 'none', cursor: 'pointer', padding: 7, borderRadius: '50%', display: 'flex', alignItems: 'center', color: '#8696a0' }}>
                <RefreshCw size={17} />
              </button>
            </div>
          </div>

          {/* Search */}
          <div style={{ padding: '8px 12px 6px', background: '#111b21', flexShrink: 0 }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 8, background: '#202c33', borderRadius: 9, padding: '7px 13px' }}>
              <Search size={15} color="#8696a0" />
              <input placeholder="Search or start new chat" value={searchContact} onChange={e => setSearchContact(e.target.value)}
                style={{ flex: 1, background: 'none', border: 'none', outline: 'none', color: '#e9edef', fontSize: 14 }} />
              {searchContact && (
                <button onClick={() => setSearchContact('')} style={{ background: 'none', border: 'none', cursor: 'pointer', color: '#8696a0', display: 'flex', padding: 0 }}>
                  <X size={14} />
                </button>
              )}
            </div>
          </div>

          {/* Filter tabs */}
          <div style={{ display: 'flex', gap: 6, padding: '6px 12px 8px', background: '#111b21', overflowX: 'auto', flexShrink: 0 }}>
            {['All', 'Unread', 'Favourites', 'Groups', 'Communities'].map(tab => (
              <button key={tab} onClick={() => setActiveFilter(tab)}
                style={{
                  padding: '5px 14px', borderRadius: 20, border: 'none', cursor: 'pointer', fontSize: 13, fontWeight: 500, whiteSpace: 'nowrap', flexShrink: 0,
                  background: activeFilter === tab ? '#25D366' : '#202c33',
                  color: activeFilter === tab ? '#fff' : '#8696a0',
                  transition: 'all 0.15s',
                }}>
                {tab}
                {tab === 'Unread' && displayChats.filter(c => !c.archived && c.unreadCount > 0).length > 0 && (
                  <span style={{ marginLeft: 4, background: activeFilter === tab ? 'rgba(255,255,255,0.3)' : 'rgba(37,211,102,0.25)', color: activeFilter === tab ? '#fff' : '#25D366', borderRadius: 10, padding: '0 5px', fontSize: 11 }}>
                    {displayChats.filter(c => !c.archived && c.unreadCount > 0).length}
                  </span>
                )}
              </button>
            ))}
          </div>

          {!notifEnabled && (
            <div style={{ padding: '5px 12px', background: 'rgba(37,211,102,0.07)', borderBottom: '1px solid rgba(37,211,102,0.1)', flexShrink: 0 }}>
              <button onClick={requestNotifPermission} style={{ background: 'none', border: 'none', color: '#25D366', fontSize: 12, cursor: 'pointer', padding: 0, display: 'flex', alignItems: 'center', gap: 6 }}>
                <BellRing size={11} /> Enable notifications
              </button>
            </div>
          )}

          {/* Chat list */}
          <div style={{ flex: 1, overflowY: 'auto' }}>
            {loadingContacts && bridgeChats.length === 0 ? (
              <div style={{ padding: 32, textAlign: 'center', color: '#8696a0', fontSize: 13 }}>Loading chats...</div>
            ) : filteredChats.length === 0 ? (
              <div style={{ padding: 24, textAlign: 'center', color: '#8696a0', fontSize: 13 }}>
                {displayChats.length === 0 ? (
                  <div>
                    <div style={{ fontSize: 28, marginBottom: 8 }}>📱</div>
                    <div style={{ color: '#e9edef', fontWeight: 500, marginBottom: 6 }}>
                      {sessionStatus?.phone ? `New account: ${sessionStatus.phone}` : 'No contacts'}
                    </div>
                    <div style={{ marginBottom: 12, fontSize: 12 }}>
                      {sessionStatus?.phone
                        ? 'This WhatsApp account has no synced contacts yet.'
                        : 'Connect WhatsApp to see your contacts.'}
                    </div>
                    <Link to="/contacts" style={{ color: '#25D366', fontSize: 12, textDecoration: 'none', border: '1px solid #25D366', borderRadius: 16, padding: '5px 14px' }}>
                      Go to Contacts → Sync
                    </Link>
                  </div>
                ) : `No ${activeFilter.toLowerCase()} chats.`}
              </div>
            ) : filteredChats.map(chat => {
              const c = chat.contact
              const isSelected = selectedContact?.id === chat.id
              const isMuted = c?.id && localStorage.getItem(`wa_muted_${c.id}`) === '1'
              const isFav = chat.id && favourites.has(chat.id)
              const lastMsgPreview = formatLastMessage(chat)
              const unreadNum = chat.unreadCount || (unreadContacts.has(chat.id) ? 1 : 0)
              const profilePicUrl = chat.id ? profilePics[chat.id] : null
              const isGroup = chat.isGroup
              return (
                <div key={chat.phone || chat.id}
                  onClick={() => selectDisplayChat(chat)}
                  onContextMenu={e => { e.preventDefault(); if (chat.id) toggleFavourite(chat.id) }}
                  style={{ display: 'flex', alignItems: 'center', gap: 12, padding: '10px 16px', background: isSelected ? '#2a3942' : 'transparent', cursor: 'pointer', borderBottom: '1px solid #1e2a30', transition: 'background 0.12s' }}
                  onMouseEnter={e => { if (!isSelected) e.currentTarget.style.background = '#1e2a30' }}
                  onMouseLeave={e => { if (!isSelected) e.currentTarget.style.background = 'transparent' }}>

                  {/* Avatar with pin badge */}
                  <div style={{ position: 'relative', flexShrink: 0 }}>
                    {profilePicUrl ? (
                      <div style={{ width: 46, height: 46, borderRadius: '50%', overflow: 'hidden', background: '#2a3942' }}>
                        <img src={profilePicUrl} alt={chat.name} style={{ width: '100%', height: '100%', objectFit: 'cover' }}
                          onError={e => { e.target.style.display = 'none' }} />
                      </div>
                    ) : isGroup ? (
                      <div style={{ width: 46, height: 46, borderRadius: '50%', background: '#2a3942', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                        <Users size={22} color="#8696a0" />
                      </div>
                    ) : (
                      <div style={{ width: 46, height: 46, borderRadius: '50%', background: avatarColor(chat.name), display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 19, fontWeight: 700, color: '#fff' }}>
                        {(chat.name || '?')[0].toUpperCase()}
                      </div>
                    )}
                    {chat.pinned && (
                      <div style={{ position: 'absolute', bottom: -1, right: -1, width: 16, height: 16, borderRadius: '50%', background: '#202c33', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                        <Pin size={9} color="#8696a0" fill="#8696a0" />
                      </div>
                    )}
                  </div>

                  {/* Content */}
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 3 }}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: 5, minWidth: 0, flex: 1 }}>
                        {isFav && <Star size={11} color="#f59e0b" fill="#f59e0b" style={{ flexShrink: 0 }} />}
                        <span style={{ fontWeight: unreadNum > 0 ? 700 : 500, color: '#e9edef', fontSize: 15, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                          {chat.name}
                        </span>
                      </div>
                      <span style={{ fontSize: 11, color: unreadNum > 0 ? '#25D366' : '#8696a0', flexShrink: 0, marginLeft: 6 }}>
                        {chat.lastMessageTime ? formatChatTime(new Date(chat.lastMessageTime).toISOString()) : ''}
                      </span>
                    </div>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 4, justifyContent: 'space-between' }}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: 3, minWidth: 0, flex: 1 }}>
                        {isMuted && <BellOff size={12} color="#8696a0" style={{ flexShrink: 0 }} />}
                        {chat.lastMessageFromMe && !unreadNum && <CheckCheck size={13} style={{ color: '#53bdeb', flexShrink: 0 }} />}
                        <span style={{ fontSize: 13, color: '#8696a0', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                          {lastMsgPreview || (chat.id ? '' : '💬 Tap to start chatting')}
                        </span>
                      </div>
                      {unreadNum > 0 && (
                        <div style={{ background: isMuted ? '#8696a0' : '#25D366', color: '#fff', borderRadius: 10, minWidth: 20, height: 20, display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 11, fontWeight: 700, flexShrink: 0, padding: '0 5px' }}>
                          {unreadNum > 99 ? '99+' : unreadNum}
                        </div>
                      )}
                    </div>
                  </div>
                </div>
              )
            })}

            {/* Archived section */}
            {archivedChats.length > 0 && (
              <div>
                <div onClick={() => setShowArchived(v => !v)}
                  style={{ display: 'flex', alignItems: 'center', gap: 12, padding: '12px 16px', cursor: 'pointer', borderTop: '1px solid #2a3942' }}
                  onMouseEnter={e => e.currentTarget.style.background = '#1e2a30'}
                  onMouseLeave={e => e.currentTarget.style.background = 'transparent'}>
                  <div style={{ width: 46, height: 46, borderRadius: '50%', background: '#2a3942', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
                    <Archive size={20} color="#8696a0" />
                  </div>
                  <div style={{ flex: 1 }}>
                    <div style={{ fontSize: 15, fontWeight: 500, color: '#e9edef' }}>Archived</div>
                    <div style={{ fontSize: 13, color: '#8696a0' }}>{archivedChats.length} chats</div>
                  </div>
                  <ChevronRight size={16} color="#8696a0" style={{ transform: showArchived ? 'rotate(90deg)' : 'none', transition: 'transform 0.2s' }} />
                </div>
                {showArchived && archivedChats.map(chat => (
                  <div key={chat.phone} onClick={() => selectDisplayChat(chat)}
                    style={{ display: 'flex', alignItems: 'center', gap: 12, padding: '9px 16px', cursor: 'pointer', borderBottom: '1px solid #1e2a30', background: 'rgba(0,0,0,0.2)' }}
                    onMouseEnter={e => e.currentTarget.style.background = '#1e2a30'}
                    onMouseLeave={e => e.currentTarget.style.background = 'rgba(0,0,0,0.2)'}>
                    <div style={{ width: 42, height: 42, borderRadius: '50%', background: avatarColor(chat.name), display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 17, fontWeight: 700, color: '#fff', flexShrink: 0 }}>
                      {(chat.name || '?')[0].toUpperCase()}
                    </div>
                    <div style={{ flex: 1, minWidth: 0 }}>
                      <div style={{ fontSize: 14, color: '#8696a0', fontWeight: 500 }}>{chat.name}</div>
                      <div style={{ fontSize: 12, color: '#56717a', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{formatLastMessage(chat)}</div>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>

        {/* ── RIGHT PANEL ── */}
        <div style={{ flex: 1, display: showRight ? 'flex' : 'none', flexDirection: 'row', background: '#0b141a', width: isMobile ? '100%' : undefined, minWidth: 0, position: 'relative' }}>

          {/* Chat column */}
          <div style={{ flex: 1, display: 'flex', flexDirection: 'column', minWidth: 0 }}>
          {selectedContact ? (
            <>
              {/* Chat Header */}
              <div style={{ padding: '10px 16px', background: '#202c33', display: 'flex', alignItems: 'center', gap: 10, borderBottom: '1px solid #2a3942', flexShrink: 0 }}>
                {isMobile && (
                  <button onClick={() => { setMobileChatOpen(false); setShowContactInfo(false) }}
                    style={{ background: 'none', border: 'none', cursor: 'pointer', color: '#aebac1', padding: '4px 6px 4px 0', display: 'flex', alignItems: 'center', flexShrink: 0 }}>
                    <ArrowLeft size={22} />
                  </button>
                )}
                {/* Clickable avatar + name → opens contact info */}
                <button onClick={() => setShowContactInfo(v => !v)}
                  style={{ display: 'flex', alignItems: 'center', gap: 10, background: 'none', border: 'none', cursor: 'pointer', flex: 1, minWidth: 0, padding: 0, textAlign: 'left' }}>
                  <Avatar contact={selectedContact} size={38} fontSize={15} profilePics={profilePics} />
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div style={{ fontWeight: 600, color: '#e9edef', fontSize: 15 }}>{selectedContact.name}</div>
                    <div style={{ fontSize: 12, color: '#8696a0' }}>
                      {selectedContact.tags?.includes('Group') ? 'Group chat' :
                       selectedContact.tags?.includes('Team') ? 'Broadcast list' :
                       selectedContact.phone}
                    </div>
                  </div>
                </button>
                <div style={{ display: 'flex', gap: 2, flexShrink: 0 }}>
                  <button onClick={() => { setShowMsgSearch(v => !v); setSearchMsg('') }} title="Search messages"
                    style={{ background: 'none', border: 'none', cursor: 'pointer', color: showMsgSearch ? '#25D366' : '#aebac1', padding: 6, display: 'flex', alignItems: 'center', borderRadius: '50%' }}>
                    <Search size={18} />
                  </button>
                  <button onClick={() => selectedContact && togglePinChat(selectedContact.id)} title={selectedContact && pinnedByUser.has(selectedContact.id) ? 'Unpin chat' : 'Pin chat'}
                    style={{ background: 'none', border: 'none', cursor: 'pointer', color: selectedContact && pinnedByUser.has(selectedContact.id) ? '#25D366' : '#aebac1', padding: 6, display: 'flex', alignItems: 'center', borderRadius: '50%' }}>
                    <Pin size={18} />
                  </button>
                  <button onClick={() => selectedContact && toggleArchiveChat(selectedContact.id)} title={selectedContact && archivedByUser.has(selectedContact.id) ? 'Unarchive' : 'Archive chat'}
                    style={{ background: 'none', border: 'none', cursor: 'pointer', color: selectedContact && archivedByUser.has(selectedContact.id) ? '#25D366' : '#aebac1', padding: 6, display: 'flex', alignItems: 'center', borderRadius: '50%' }}>
                    <Archive size={18} />
                  </button>
                  <button onClick={() => setCallModal('voice')} title="Voice Call"
                    style={{ background: 'none', border: 'none', cursor: 'pointer', color: '#aebac1', padding: 6, display: 'flex', alignItems: 'center', borderRadius: '50%' }}>
                    <Phone size={20} />
                  </button>
                  <button onClick={() => setCallModal('video')} title="Video Call"
                    style={{ background: 'none', border: 'none', cursor: 'pointer', color: '#aebac1', padding: 6, display: 'flex', alignItems: 'center', borderRadius: '50%' }}>
                    <Video size={20} />
                  </button>
                  <button onClick={() => setShowContactInfo(v => !v)} title="Contact info"
                    style={{ background: 'none', border: 'none', cursor: 'pointer', color: showContactInfo ? '#25D366' : '#aebac1', padding: 6, display: 'flex', alignItems: 'center', borderRadius: '50%' }}>
                    <Info size={20} />
                  </button>
                  <button onClick={handleExportChat} title="Export chat as .txt"
                    style={{ background: 'none', border: 'none', cursor: 'pointer', color: '#aebac1', padding: 6, display: 'flex', alignItems: 'center', borderRadius: '50%' }}>
                    <Download size={18} />
                  </button>
                </div>
              </div>

              {/* Search bar (Phase 11) */}
              {showMsgSearch && (
                <div style={{ padding: '6px 16px', background: '#182229', borderBottom: '1px solid #2a3942', display: 'flex', alignItems: 'center', gap: 10, flexShrink: 0 }}>
                  <Search size={14} color="#8696a0" />
                  <input autoFocus placeholder="Search messages…" value={searchMsg} onChange={e => setSearchMsg(e.target.value)}
                    style={{ flex: 1, background: 'none', border: 'none', outline: 'none', color: '#e9edef', fontSize: 14 }} />
                  {searchMsg && <span style={{ fontSize: 12, color: '#8696a0' }}>{messages.filter(m => parseContent(m.content).text?.toLowerCase().includes(searchMsg.toLowerCase())).length} results</span>}
                  <button onClick={() => { setSearchMsg(''); setShowMsgSearch(false) }}
                    style={{ background: 'none', border: 'none', cursor: 'pointer', color: '#8696a0', display: 'flex', padding: 2 }}><X size={15} /></button>
                </div>
              )}

              {/* Messages Body */}
              <div style={{ flex: 1, overflowY: 'auto', padding: '16px 6%', display: 'flex', flexDirection: 'column', gap: 2, background: '#0b141a' }}>
                {loadingMessages && messages.length === 0 ? (
                  <div style={{ margin: 'auto', color: '#8696a0', fontSize: 13 }}>Loading messages...</div>
                ) : messages.length === 0 ? (
                  <div style={{ margin: 'auto', textAlign: 'center', color: '#8696a0' }}>
                    <div style={{ background: '#182229', borderRadius: 8, padding: '10px 20px', fontSize: 13 }}>No messages yet — send one below!</div>
                  </div>
                ) : (searchMsg ? messages.filter(m => parseContent(m.content).text?.toLowerCase().includes(searchMsg.toLowerCase())) : messages).map((m, idx, arr) => {
                  const isOut = m.direction === 'outbound'
                  const prevMsg = arr[idx - 1]
                  const showDate = !prevMsg || new Date(m.created_at).toDateString() !== new Date(prevMsg.created_at).toDateString()
                  return (
                    <div key={m.id}>
                      {showDate && (
                        <div style={{ display: 'flex', justifyContent: 'center', margin: '12px 0 8px' }}>
                          <span style={{ background: '#182229', color: '#8696a0', fontSize: 12, padding: '4px 12px', borderRadius: 8 }}>
                            {new Date(m.created_at).toLocaleDateString('en-IN', { day: 'numeric', month: 'long', year: 'numeric' })}
                          </span>
                        </div>
                      )}
                      <MessageBubble
                        m={m}
                        isOut={isOut}
                        contactName={selectedContact.name}
                        reaction={reactions[m.id]}
                        isStarred={starredMsgs.has(m.id)}
                        isLast={idx === messages.length - 1}
                        onContextMenu={handleContextMenu}
                        onReply={setReplyTo}
                        onReact={handleReact}
                        setLightboxImg={setLightboxImg}
                      />
                    </div>
                  )
                })}
                <div ref={chatEndRef} />
              </div>

              {/* Reply preview bar */}
              {replyTo && (
                <div style={{ padding: '8px 16px', background: '#1f2c34', borderTop: '1px solid #2a3942', display: 'flex', alignItems: 'center', gap: 10 }}>
                  <div style={{ flex: 1, borderLeft: '3px solid #25D366', paddingLeft: 10, borderRadius: '0 4px 4px 0', background: 'rgba(0,0,0,0.1)', padding: '6px 10px' }}>
                    <div style={{ fontSize: 12, color: '#25D366', fontWeight: 600, marginBottom: 2 }}>
                      {replyTo.direction === 'outbound' ? 'You' : selectedContact?.name}
                    </div>
                    <div style={{ fontSize: 13, color: '#8696a0', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                      {parseContent(replyTo.content).text?.slice(0, 100)}
                    </div>
                  </div>
                  <button onClick={() => setReplyTo(null)}
                    style={{ background: 'none', border: 'none', cursor: 'pointer', color: '#8696a0', padding: 4, borderRadius: '50%', display: 'flex' }}>
                    <X size={18} />
                  </button>
                </div>
              )}

              {/* Grammar bar — only shown while composing */}
              {newMessage.length >= 5 && (
                <GrammarBar
                  text={newMessage}
                  onApplyCorrection={(corrected) => {
                    setNewMessage(corrected)
                    // Re-sync textarea height after programmatic text change
                    requestAnimationFrame(() => {
                      if (textareaRef.current) {
                        textareaRef.current.style.height = 'auto'
                        textareaRef.current.style.height =
                          Math.min(textareaRef.current.scrollHeight, 120) + 'px'
                      }
                    })
                  }}
                />
              )}

              {/* Input Bar */}
              <div style={{ padding: '8px 12px', background: '#202c33', display: 'flex', alignItems: 'flex-end', gap: 8 }}>
                {/* Attach */}
                <div style={{ position: 'relative' }}>
                  <button onClick={(e) => { e.stopPropagation(); setShowAttachMenu(v => !v) }} title="Attach"
                    style={{ background: 'none', border: 'none', cursor: 'pointer', color: '#aebac1', padding: 6, display: 'flex', alignItems: 'center' }}>
                    <Paperclip size={22} />
                  </button>
                  {showAttachMenu && (
                    <div style={{ position: 'absolute', bottom: 48, left: 0, background: '#233138', border: '1px solid #2a3942', borderRadius: 10, padding: 6, display: 'flex', flexDirection: 'column', gap: 2, zIndex: 100, width: 160, boxShadow: '0 6px 16px rgba(0,0,0,0.3)' }}>
                      {[
                        { id: 'file', label: 'Document', icon: <FileText size={15} /> },
                        { id: 'image', label: 'Photo', icon: <ImageIcon size={15} /> },
                        { id: 'audio', label: 'Audio', icon: <Mic size={15} /> },
                        { id: 'location', label: 'Location', icon: <MapPin size={15} /> },
                      ].map(item => (
                        <button key={item.id} onClick={() => {
                          setShowAttachMenu(false)
                          if (item.id === 'file') fileInputRef.current?.click()
                          else if (item.id === 'image') imageInputRef.current?.click()
                          else if (item.id === 'audio') audioInputRef.current?.click()
                          else setAttachModal(item.id)
                        }}
                          style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '9px 12px', border: 'none', background: 'transparent', color: '#e9edef', borderRadius: 8, cursor: 'pointer', fontSize: 13 }}
                          onMouseEnter={e => e.currentTarget.style.background = '#2a3942'}
                          onMouseLeave={e => e.currentTarget.style.background = 'transparent'}>
                          <span style={{ color: '#aebac1' }}>{item.icon}</span> {item.label}
                        </button>
                      ))}
                    </div>
                  )}
                </div>

                {/* Text input — textarea for multi-line + native spellcheck */}
                <div style={{ flex: 1, background: '#2a3942', borderRadius: 24, padding: '8px 16px', display: 'flex', alignItems: 'flex-end', gap: 8 }}>
                  <button style={{ background: 'none', border: 'none', cursor: 'pointer', color: '#8696a0', padding: '0 0 2px', display: 'flex', alignItems: 'center', flexShrink: 0 }} title="Emoji">
                    <Smile size={20} />
                  </button>

                  {/* ✨ AI Suggest button — only shown when AI is enabled */}
                  {aiEnabled && (
                    <button
                      onClick={handleAiSuggest}
                      disabled={aiLoading || !selectedContact}
                      title={isAiDraft ? 'AI draft ready — edit or send' : 'Generate AI reply'}
                      style={{
                        background: 'none', border: 'none', cursor: aiLoading ? 'wait' : 'pointer',
                        color: isAiDraft ? '#25D366' : aiLoading ? '#8696a0' : '#8696a0',
                        padding: '0 0 2px', display: 'flex', alignItems: 'center', flexShrink: 0,
                        transition: 'color 0.2s',
                      }}
                    >
                      {aiLoading
                        ? <RefreshCw size={18} style={{ animation: 'spin 1s linear infinite' }} />
                        : <Sparkles size={18} style={{ color: isAiDraft ? '#25D366' : 'inherit' }} />}
                    </button>
                  )}

                  <textarea
                    ref={textareaRef}
                    spellCheck={true}
                    placeholder={aiEnabled ? 'Type a message or tap ✨ for AI reply…' : 'Type a message'}
                    value={newMessage}
                    rows={1}
                    onChange={e => {
                      setNewMessage(e.target.value)
                      setIsAiDraft(false)
                      // Auto-resize up to 120 px (≈ 5 lines)
                      const ta = e.target
                      ta.style.height = 'auto'
                      ta.style.height = Math.min(ta.scrollHeight, 120) + 'px'
                    }}
                    onKeyDown={e => {
                      if (e.key === 'Enter' && !e.shiftKey && newMessage.trim()) {
                        e.preventDefault()
                        handleSend(newMessage)
                        setIsAiDraft(false)
                        if (textareaRef.current) textareaRef.current.style.height = 'auto'
                      }
                    }}
                    style={{
                      flex: 1, background: 'none', border: 'none', outline: 'none',
                      color: '#e9edef', fontSize: 14, resize: 'none', overflow: 'hidden',
                      lineHeight: 1.45, maxHeight: 120, padding: 0, fontFamily: 'inherit',
                    }}
                  />
                </div>

                {/* Send/Mic */}
                <button
                  onClick={newMessage.trim() ? () => {
                    handleSend(newMessage)
                    setIsAiDraft(false)
                    if (textareaRef.current) textareaRef.current.style.height = 'auto'
                  } : undefined}
                  style={{ width: 42, height: 42, borderRadius: '50%', background: '#00a884', border: 'none', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}
                >
                  {newMessage.trim() ? <Send size={18} color="#fff" /> : <Mic size={18} color="#fff" />}
                </button>
              </div>
            </>
          ) : (
            <div style={{ margin: 'auto', textAlign: 'center', padding: 48, color: '#8696a0' }}>
              <div style={{ width: 80, height: 80, borderRadius: '50%', background: '#202c33', display: 'flex', alignItems: 'center', justifyContent: 'center', margin: '0 auto 20px' }}>
                <MessageSquare size={36} color="#8696a0" />
              </div>
              <h3 style={{ color: '#e9edef', fontWeight: 300, marginBottom: 8 }}>WhatsApp Web</h3>
              <p style={{ maxWidth: 320, margin: '0 auto', fontSize: 13, lineHeight: 1.6 }}>Select a chat from the left to start messaging.</p>
              <div style={{ marginTop: 20, display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8, color: '#8696a0', fontSize: 12 }}>
                <Check size={14} /> End-to-end encrypted
              </div>
            </div>
          )}

          {/* Hidden file inputs */}
          <input ref={fileInputRef}  type="file" accept=".pdf,.doc,.docx,.txt,.zip" style={{ display: 'none' }} onChange={e => handleFileChange(e, 'file')} />
          <input ref={imageInputRef} type="file" accept="image/*" style={{ display: 'none' }} onChange={e => handleFileChange(e, 'image')} />
          <input ref={audioInputRef} type="file" accept="audio/*" style={{ display: 'none' }} onChange={e => handleFileChange(e, 'audio')} />
          </div>{/* end chat column */}

          {/* ── Contact Info Panel (desktop: right column, mobile: overlaid full-width) ── */}
          {showContactInfo && selectedContact && (
            isMobile ? (
              <div style={{ position: 'absolute', inset: 0, zIndex: 50, display: 'flex', flexDirection: 'column' }}>
                <ContactInfoPanel
                  contact={selectedContact} messages={messages} starredMsgs={starredMsgs}
                  profilePics={profilePics} onClose={() => setShowContactInfo(false)}
                  onClearChat={handleClearChat} onDeleteChat={handleDeleteChat}
                  onGroupRename={handleGroupRename} onGroupSetDesc={handleGroupSetDesc}
                  onGroupAddMember={handleGroupAddMember} onGroupRemoveMember={handleGroupRemoveMember}
                  onGroupPromote={handleGroupPromote} onGroupDemote={handleGroupDemote}
                  onGroupInviteLink={handleGroupInviteLink} onGroupLeave={handleGroupLeave}
                />
              </div>
            ) : (
              <ContactInfoPanel
                contact={selectedContact} messages={messages} starredMsgs={starredMsgs}
                profilePics={profilePics} onClose={() => setShowContactInfo(false)}
                onClearChat={handleClearChat} onDeleteChat={handleDeleteChat}
                onGroupRename={handleGroupRename} onGroupSetDesc={handleGroupSetDesc}
                onGroupAddMember={handleGroupAddMember} onGroupRemoveMember={handleGroupRemoveMember}
                onGroupPromote={handleGroupPromote} onGroupDemote={handleGroupDemote}
                onGroupInviteLink={handleGroupInviteLink} onGroupLeave={handleGroupLeave}
              />
            )
          )}

        </div>{/* end right panel outer */}
      </div>{/* end main two-panel container */}

      {/* ── Context Menu ── */}
      {contextMenu && (
        <ContextMenu
          msg={contextMenu.msg}
          x={contextMenu.x}
          y={contextMenu.y}
          isOut={contextMenu.msg.direction === 'outbound'}
          isStarred={starredMsgs.has(contextMenu.msg.id)}
          onReply={() => setReplyTo(contextMenu.msg)}
          onCopy={() => navigator.clipboard?.writeText(parseContent(contextMenu.msg.content).text || '').catch(() => {})}
          onStar={() => handleStar(contextMenu.msg.id)}
          onForward={() => setForwardMsg(contextMenu.msg)}
          onDelete={() => handleDeleteLocal(contextMenu.msg.id)}
          onClose={() => setContextMenu(null)}
        />
      )}

      {/* ── Call Modal ── */}
      {callModal && (
        <div className="modal-overlay" onClick={() => setCallModal(null)}>
          <div className="modal" style={{ maxWidth: 380 }}>
            <div className="modal-header">
              <h3 className="modal-title" style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                <HelpCircle color="var(--accent-primary)" size={20} /> WhatsApp {callModal === 'video' ? 'Video' : 'Voice'} Call
              </h3>
              <button className="btn btn-ghost btn-icon" onClick={() => setCallModal(null)}><X size={18} /></button>
            </div>
            <div style={{ padding: '10px 0', fontSize: 'var(--font-size-sm)', lineHeight: 1.6, color: 'var(--text-secondary)' }}>
              Voice and video calls are not supported through the WhatsApp Web bridge. Please use the official WhatsApp mobile or desktop app.
            </div>
            <div className="modal-footer" style={{ marginTop: 16 }}>
              <button className="btn btn-primary" onClick={() => setCallModal(null)}>Got it</button>
            </div>
          </div>
        </div>
      )}

      {/* ── Attachment Modal ── */}
      {attachModal && (
        <div className="modal-overlay" onClick={() => setAttachModal(null)}>
          <div className="modal" style={{ maxWidth: 400 }}>
            <div className="modal-header">
              <h3 className="modal-title" style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                <Paperclip size={18} /> Send {attachModal === 'file' ? 'Document' : attachModal === 'image' ? 'Photo' : 'Location'}
              </h3>
              <button className="btn btn-ghost btn-icon" onClick={() => setAttachModal(null)}><X size={18} /></button>
            </div>
            <form onSubmit={handleAttachSubmit}>
              <div className="form-group" style={{ marginBottom: 12 }}>
                <label className="form-label">{attachModal === 'file' ? 'File Name *' : attachModal === 'image' ? 'Caption *' : 'Location Name *'}</label>
                <input className="form-input" placeholder={attachModal === 'file' ? 'document.pdf' : attachModal === 'image' ? 'Photo caption...' : 'Location name'}
                  value={attachName} onChange={e => setAttachName(e.target.value)} required />
              </div>
              {attachModal !== 'location' && (
                <div className="form-group" style={{ marginBottom: 12 }}>
                  <label className="form-label">URL (optional)</label>
                  <input className="form-input" placeholder="https://..." value={attachUrl} onChange={e => setAttachUrl(e.target.value)} />
                </div>
              )}
              <div className="modal-footer">
                <button type="button" className="btn btn-secondary" onClick={() => setAttachModal(null)}>Cancel</button>
                <button type="submit" className="btn btn-primary"><Send size={14} /> Send</button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* ── Lightbox ── */}
      {lightboxImg && (
        <div className="modal-overlay" onClick={() => setLightboxImg(null)}
          style={{ background: 'rgba(0,0,0,0.9)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
          <button onClick={() => setLightboxImg(null)}
            style={{ position: 'absolute', top: 20, right: 20, background: 'rgba(255,255,255,0.15)', border: 'none', borderRadius: '50%', width: 40, height: 40, cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#fff' }}>
            <X size={20} />
          </button>
          <img src={lightboxImg} alt="Full size" style={{ maxWidth: '90vw', maxHeight: '90vh', objectFit: 'contain', borderRadius: 8 }} />
        </div>
      )}

      {/* ── Forward Modal ── */}
      {forwardMsg && (
        <ForwardModal
          msg={forwardMsg}
          contacts={contacts}
          onClose={() => setForwardMsg(null)}
          onForward={handleForward}
        />
      )}

      {/* ── Create Group Modal (Phase 12) ── */}
      {showCreateGroup && (
        <CreateGroupModal
          contacts={contacts}
          onClose={() => setShowCreateGroup(false)}
          onCreate={handleCreateGroup}
        />
      )}

      <style>{`@keyframes wapin{to{transform:rotate(360deg)}}`}</style>
    </>
  )
}
