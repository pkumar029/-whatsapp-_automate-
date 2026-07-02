import { useState, useRef, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import {
  UserCircle, Shield, Lock, MessageSquare, Bell, HelpCircle,
  ChevronRight, ChevronLeft, Camera, LogOut, RefreshCw,
  QrCode, Hash, Wifi, WifiOff, Smartphone, Phone,
  Sun, Moon, Volume2, VolumeX, Timer, Ban, Monitor,
  Info, Globe, Key, Check, X, Eye, EyeOff, Send,
  Keyboard, AlertCircle, CheckCircle2, Zap, Database,
  Image as ImageIcon, Archive, FileDown, Trash2, ScrollText,
  Sparkles, FlaskConical
} from 'lucide-react'
import { whatsappApi, logsApi, aiApi } from '../../services/api'
import { useApp } from '../../context/AppContext'
import { useAuth } from '../../context/AuthContext'
import { SHORTCUT_GROUPS, getShortcutsEnabled, setShortcutsEnabled } from '../../hooks/useKeyboardShortcuts'
import { formatIST } from '../../utils/date'
import { getBrowserInfo, getSessionStart } from '../../utils/browser'
import { getErrorMessage } from '../../utils/error'

// ─── Palette ────────────────────────────────────────────────────
const WA = {
  bg: '#111b21',
  panel: '#202c33',
  row: '#1f2c34',
  border: '#2a3942',
  text: '#e9edef',
  sub: '#8696a0',
  green: '#25D366',
  red: '#ff4d4f',
  input: '#2a3942',
}

// ─── Shared primitives ──────────────────────────────────────────
function Row({ icon, iconBg, label, sublabel, right, onClick, danger, last }) {
  const [h, setH] = useState(false)
  return (
    <div
      onClick={onClick}
      onMouseEnter={() => setH(true)}
      onMouseLeave={() => setH(false)}
      style={{
        display: 'flex', alignItems: 'center', gap: 14,
        padding: '13px 20px',
        cursor: onClick ? 'pointer' : 'default',
        background: h && onClick ? 'rgba(255,255,255,0.04)' : 'transparent',
        borderBottom: last ? 'none' : `1px solid ${WA.border}`,
        transition: 'background .12s',
      }}
    >
      {icon && (
        <div style={{ width: 38, height: 38, borderRadius: '50%', background: iconBg || WA.border, display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
          {icon}
        </div>
      )}
      <div style={{ flex: 1, minWidth: 0 }}>
        <div style={{ fontSize: 15, color: danger ? WA.red : WA.text, fontWeight: 400 }}>{label}</div>
        {sublabel && <div style={{ fontSize: 12, color: WA.sub, marginTop: 2 }}>{sublabel}</div>}
      </div>
      {right !== undefined
        ? <div style={{ color: WA.sub, fontSize: 13, display: 'flex', alignItems: 'center', gap: 8, flexShrink: 0 }}>
            {right}
            {onClick && <ChevronRight size={15} style={{ color: '#3b4a54' }} />}
          </div>
        : onClick
        ? <ChevronRight size={15} style={{ color: '#3b4a54', flexShrink: 0 }} />
        : null}
    </div>
  )
}

function Toggle({ on, onChange }) {
  return (
    <div onClick={onChange} style={{ width: 44, height: 24, borderRadius: 12, background: on ? WA.green : '#3b4a54', position: 'relative', cursor: 'pointer', transition: 'background .2s', flexShrink: 0 }}>
      <div style={{ width: 20, height: 20, borderRadius: '50%', background: '#fff', position: 'absolute', top: 2, left: on ? 22 : 2, transition: 'left .2s', boxShadow: '0 1px 4px rgba(0,0,0,.4)' }} />
    </div>
  )
}

function SelectInput({ value, onChange, options }) {
  return (
    <select
      value={value}
      onChange={e => onChange(e.target.value)}
      onClick={e => e.stopPropagation()}
      style={{ background: WA.input, border: `1px solid ${WA.border}`, borderRadius: 8, color: WA.sub, padding: '5px 10px', fontSize: 13, cursor: 'pointer', outline: 'none' }}
    >
      {options.map(o => <option key={o.v} value={o.v}>{o.label}</option>)}
    </select>
  )
}

function SecLabel({ children }) {
  return <div style={{ padding: '16px 20px 6px', fontSize: 12, color: WA.green, fontWeight: 700, letterSpacing: '.05em', textTransform: 'uppercase' }}>{children}</div>
}

function PanelHeader({ title, onBack }) {
  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: 12, padding: '14px 20px', background: WA.panel, borderBottom: `1px solid ${WA.border}`, position: 'sticky', top: 0, zIndex: 2 }}>
      {onBack && (
        <button onClick={onBack} style={{ background: 'none', border: 'none', cursor: 'pointer', color: WA.sub, display: 'flex', alignItems: 'center', padding: 4, borderRadius: '50%' }}>
          <ChevronLeft size={20} />
        </button>
      )}
      <span style={{ fontSize: 17, fontWeight: 600, color: WA.text }}>{title}</span>
    </div>
  )
}

function Toast({ msg, type }) {
  if (!msg) return null
  const ok = type !== 'error'
  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '10px 14px', borderRadius: 8, fontSize: 13, margin: '0 20px 12px', background: ok ? 'rgba(37,211,102,.1)' : 'rgba(255,77,79,.1)', border: `1px solid ${ok ? 'rgba(37,211,102,.3)' : 'rgba(255,77,79,.3)'}`, color: ok ? WA.green : WA.red }}>
      {ok ? <CheckCircle2 size={14} /> : <AlertCircle size={14} />} {msg}
    </div>
  )
}

// ─── Connect Panel ───────────────────────────────────────────────
function ConnectPanel({ onConnected }) {
  const { refreshSessionStatus } = useApp()
  const [step, setStep] = useState('form')
  const [method, setMethod] = useState('qr')
  const [phone, setPhone] = useState(() => localStorage.getItem('wa_last_phone') || '')
  const [qrCode, setQrCode] = useState(null)
  const [pairingCode, setPairingCode] = useState(null)
  const [error, setError] = useState('')

  useEffect(() => {
    let iv = null
    if (['connecting', 'qr', 'otp'].includes(step)) {
      iv = setInterval(async () => {
        try {
          const r = await whatsappApi.getStatus()
          const d = r.data
          if (d?.qr && step !== 'qr') { setQrCode(d.qr); setStep('qr') }
          if (d?.pairing_code && step !== 'otp') { setPairingCode(d.pairing_code); setStep('otp') }
          if (d?.status === 'connected') { clearInterval(iv); await refreshSessionStatus(); onConnected?.() }
        } catch { }
      }, 3000)
    }
    return () => clearInterval(iv)
  }, [step])

  const submit = async (e) => {
    e.preventDefault(); setError(''); setStep('connecting')
    try {
      if (phone) localStorage.setItem('wa_last_phone', phone)
      const r = await whatsappApi.connect({ connection_type: 'bridge', phone: phone || undefined, link_method: method })
      const d = r.data
      if (d?.qr) { setQrCode(d.qr); setStep('qr') }
      else if (d?.pairing_code) { setPairingCode(d.pairing_code); setStep('otp') }
      else if (d?.status === 'connected') { await refreshSessionStatus(); onConnected?.() }
      else setStep(method === 'otp' ? 'otp' : 'qr')
    } catch (err) { setError(getErrorMessage(err, 'Connection failed.')); setStep('form') }
  }

  const cancel = async () => {
    try { await whatsappApi.disconnect() } catch { }
    setStep('form'); setQrCode(null); setPairingCode(null); setError('')
  }

  if (step === 'form') return (
    <div style={{ padding: '16px 20px' }}>
      {error && <div style={{ background: 'rgba(255,77,79,.1)', border: '1px solid rgba(255,77,79,.3)', borderRadius: 8, padding: '10px 14px', marginBottom: 14, fontSize: 13, color: WA.red }}>{error}</div>}
      <form onSubmit={submit}>
        <div style={{ display: 'flex', gap: 8, marginBottom: 14 }}>
          {[{ v: 'qr', icon: QrCode, label: 'QR Code' }, { v: 'otp', icon: Hash, label: 'Pairing Code' }].map(({ v, icon: Icon, label }) => (
            <button key={v} type="button" onClick={() => setMethod(v)}
              style={{ flex: 1, padding: '10px', borderRadius: 10, cursor: 'pointer', border: `2px solid ${method === v ? WA.green : WA.border}`, background: method === v ? 'rgba(37,211,102,.08)' : WA.row, color: method === v ? WA.green : WA.sub, display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 7, fontSize: 13, fontWeight: 500 }}>
              <Icon size={15} />{label}
            </button>
          ))}
        </div>
        <label style={{ display: 'block', fontSize: 12, color: WA.sub, marginBottom: 6 }}>Phone number with country code</label>
        <input type="tel" value={phone} onChange={e => setPhone(e.target.value)} placeholder="+91 98765 43210" required
          style={{ width: '100%', padding: '11px 14px', boxSizing: 'border-box', background: WA.row, border: `1px solid ${WA.border}`, borderRadius: 10, color: WA.text, fontSize: 15, outline: 'none', marginBottom: 4 }}
          onFocus={e => e.target.style.borderColor = WA.green}
          onBlur={e => e.target.style.borderColor = WA.border}
        />
        <div style={{ fontSize: 11, color: WA.sub, marginBottom: 14 }}>Requires bridge running on port 7002</div>
        <button type="submit" style={{ width: '100%', padding: '12px', borderRadius: 10, border: 'none', background: WA.green, color: '#111b21', fontWeight: 700, fontSize: 15, cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8 }}>
          {method === 'qr' ? <><QrCode size={16} />Generate QR Code</> : <><Hash size={16} />Generate Pairing Code</>}
        </button>
      </form>
    </div>
  )

  if (step === 'connecting') return (
    <div style={{ padding: '28px 20px', display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 14 }}>
      <div style={{ width: 40, height: 40, border: `3px solid ${WA.border}`, borderTop: `3px solid ${WA.green}`, borderRadius: '50%', animation: 'spin 1s linear infinite' }} />
      <div style={{ color: WA.sub, fontSize: 14 }}>Initialising WhatsApp bridge…</div>
      <button onClick={cancel} style={{ background: 'none', border: `1px solid ${WA.border}`, borderRadius: 8, color: WA.sub, padding: '7px 18px', cursor: 'pointer', fontSize: 13 }}>Cancel</button>
    </div>
  )

  if (step === 'qr') return (
    <div style={{ padding: '20px', display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 14 }}>
      <div style={{ background: '#fff', padding: 12, borderRadius: 12, width: 220, height: 220 }}>
        {qrCode ? <img src={`data:image/png;base64,${qrCode}`} alt="QR" style={{ width: '100%', height: '100%', objectFit: 'contain' }} />
          : <div style={{ width: '100%', height: '100%', display: 'flex', alignItems: 'center', justifyContent: 'center' }}><RefreshCw size={32} color={WA.green} style={{ animation: 'spin 1s linear infinite' }} /></div>}
      </div>
      <div style={{ textAlign: 'center', fontSize: 13, color: WA.sub, lineHeight: 1.7, maxWidth: 280 }}>
        Open <b style={{ color: WA.text }}>WhatsApp</b> on your phone<br />
        → <b style={{ color: WA.text }}>Settings</b> → <b style={{ color: WA.text }}>Linked Devices</b><br />
        → <b style={{ color: WA.text }}>Link a Device</b>
      </div>
      <button onClick={cancel} style={{ background: 'none', border: `1px solid ${WA.border}`, borderRadius: 8, color: WA.sub, padding: '7px 18px', cursor: 'pointer', fontSize: 13 }}>Cancel</button>
    </div>
  )

  if (step === 'otp') return (
    <div style={{ padding: '20px', display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 14 }}>
      <div style={{ fontSize: 38, fontWeight: 800, letterSpacing: 8, color: WA.green, fontFamily: 'monospace', background: WA.row, padding: '14px 28px', borderRadius: 12, border: `2px dashed ${WA.green}`, userSelect: 'all' }}>
        {pairingCode || '- - - - - - - -'}
      </div>
      <div style={{ textAlign: 'center', fontSize: 13, color: WA.sub, lineHeight: 1.8, maxWidth: 300 }}>
        On your phone: <b style={{ color: WA.text }}>WhatsApp</b> → <b style={{ color: WA.text }}>Linked Devices</b><br />
        → <b style={{ color: WA.text }}>Link a Device</b><br />
        → <b style={{ color: WA.text }}>Link with phone number instead</b><br />
        Enter the code above
      </div>
      <button onClick={cancel} style={{ background: 'none', border: `1px solid ${WA.border}`, borderRadius: 8, color: WA.sub, padding: '7px 18px', cursor: 'pointer', fontSize: 13 }}>Cancel</button>
    </div>
  )
  return null
}

// ─── Section: Profile ────────────────────────────────────────────
function ProfileSection() {
  const { profile, updateProfile, sessionStatus } = useApp()
  const fileRef = useRef()
  const [avatar, setAvatar] = useState(profile.avatar || null)
  const [name, setName] = useState(profile.name || '')
  const [about, setAbout] = useState(profile.about || 'Hey there! I am using WhatsApp.')
  const [editName, setEditName] = useState(false)
  const [editAbout, setEditAbout] = useState(false)
  const [saved, setSaved] = useState('')

  const save = (fields) => {
    updateProfile(fields)
    setSaved('Saved'); setTimeout(() => setSaved(''), 2000)
  }

  const handleAvatar = (e) => {
    const file = e.target.files[0]; if (!file) return
    const reader = new FileReader()
    reader.onload = ev => { setAvatar(ev.target.result); save({ avatar: ev.target.result }) }
    reader.readAsDataURL(file)
  }

  const initial = name ? name.charAt(0).toUpperCase() : '?'

  return (
    <div>
      {/* Big avatar */}
      <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', padding: '28px 20px 20px', borderBottom: `1px solid ${WA.border}` }}>
        <div style={{ position: 'relative', marginBottom: 16 }}>
          <div style={{ width: 120, height: 120, borderRadius: '50%', background: avatar ? 'transparent' : 'linear-gradient(135deg,#25D366,#128C7E)', border: `3px solid ${WA.green}`, display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 48, fontWeight: 700, color: '#fff', overflow: 'hidden', cursor: 'pointer' }} onClick={() => fileRef.current?.click()}>
            {avatar ? <img src={avatar} alt="avatar" style={{ width: '100%', height: '100%', objectFit: 'cover' }} /> : initial}
          </div>
          <button onClick={() => fileRef.current?.click()} style={{ position: 'absolute', bottom: 4, right: 4, width: 32, height: 32, borderRadius: '50%', background: WA.green, border: `2px solid ${WA.bg}`, display: 'flex', alignItems: 'center', justifyContent: 'center', cursor: 'pointer', color: '#111b21' }}>
            <Camera size={15} />
          </button>
          <input ref={fileRef} type="file" accept="image/*" style={{ display: 'none' }} onChange={handleAvatar} />
        </div>
        {saved && <div style={{ fontSize: 12, color: WA.green, display: 'flex', alignItems: 'center', gap: 4 }}><Check size={12} />{saved}</div>}
        {sessionStatus.phone && (
          <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginTop: 6, background: 'rgba(37,211,102,0.08)', border: '1px solid rgba(37,211,102,0.2)', borderRadius: 20, padding: '4px 14px' }}>
            <Phone size={12} color={WA.green} />
            <span style={{ fontSize: 13, color: WA.green, fontFamily: 'monospace', fontWeight: 600 }}>{sessionStatus.phone}</span>
          </div>
        )}
      </div>

      {/* Name */}
      <SecLabel>Your name</SecLabel>
      <div style={{ padding: '4px 20px 16px' }}>
        {editName ? (
          <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
            <input autoFocus value={name} onChange={e => setName(e.target.value)}
              style={{ flex: 1, padding: '10px 14px', background: WA.row, border: `1px solid ${WA.green}`, borderRadius: 10, color: WA.text, fontSize: 15, outline: 'none' }} />
            <button onClick={() => { save({ name }); setEditName(false) }} style={{ width: 36, height: 36, borderRadius: '50%', background: WA.green, border: 'none', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center' }}><Check size={16} color="#111b21" /></button>
            <button onClick={() => { setName(profile.name || ''); setEditName(false) }} style={{ width: 36, height: 36, borderRadius: '50%', background: WA.border, border: 'none', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center' }}><X size={16} color={WA.sub} /></button>
          </div>
        ) : (
          <div onClick={() => setEditName(true)} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', cursor: 'pointer', padding: '10px 0', borderBottom: `1px solid ${WA.border}` }}>
            <span style={{ fontSize: 16, color: name ? WA.text : WA.sub }}>{name || 'Enter your name'}</span>
            <span style={{ fontSize: 12, color: WA.green }}>Edit</span>
          </div>
        )}
        <div style={{ fontSize: 12, color: WA.sub, marginTop: 8 }}>This is not your username or PIN. Your name is visible to your WhatsApp contacts.</div>
      </div>

      {/* About */}
      <SecLabel>About</SecLabel>
      <div style={{ padding: '4px 20px 20px' }}>
        {editAbout ? (
          <div style={{ display: 'flex', gap: 8, alignItems: 'flex-start' }}>
            <textarea autoFocus value={about} onChange={e => setAbout(e.target.value)} rows={3}
              style={{ flex: 1, padding: '10px 14px', background: WA.row, border: `1px solid ${WA.green}`, borderRadius: 10, color: WA.text, fontSize: 15, outline: 'none', resize: 'none', fontFamily: 'inherit' }} />
            <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
              <button onClick={() => { save({ about }); setEditAbout(false) }} style={{ width: 36, height: 36, borderRadius: '50%', background: WA.green, border: 'none', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center' }}><Check size={16} color="#111b21" /></button>
              <button onClick={() => { setAbout(profile.about || 'Hey there! I am using WhatsApp.'); setEditAbout(false) }} style={{ width: 36, height: 36, borderRadius: '50%', background: WA.border, border: 'none', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center' }}><X size={16} color={WA.sub} /></button>
            </div>
          </div>
        ) : (
          <div onClick={() => setEditAbout(true)} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', cursor: 'pointer', padding: '10px 0', borderBottom: `1px solid ${WA.border}` }}>
            <span style={{ fontSize: 15, color: WA.text, flex: 1, marginRight: 12, lineHeight: 1.5 }}>{about}</span>
            <span style={{ fontSize: 12, color: WA.green, flexShrink: 0 }}>Edit</span>
          </div>
        )}
      </div>
    </div>
  )
}

// ─── Browser icon helper ─────────────────────────────────────────
function BrowserIcon({ browser, size = 20 }) {
  const icons = {
    'Google Chrome':    '🌐',
    'Microsoft Edge':   '🔷',
    'Mozilla Firefox':  '🦊',
    'Safari':           '🧭',
    'Opera':            '🅾️',
    'Samsung Browser':  '📱',
    'Chromium':         '🌐',
  }
  const emoji = icons[browser] || '🌐'
  return <span style={{ fontSize: size }}>{emoji}</span>
}

// ─── Section: Account ────────────────────────────────────────────
function AccountSection() {
  const { sessionStatus, refreshSessionStatus } = useApp()
  const [waStatus, setWaStatus] = useState({ status: 'disconnected' })
  const [showConnect, setShowConnect] = useState(false)
  const [disconnecting, setDisconnecting] = useState(false)
  const [secNotif, setSecNotif] = useState(true)
  const browserInfo = getBrowserInfo()
  const sessionStart = getSessionStart()

  useEffect(() => {
    whatsappApi.getStatus().then(r => setWaStatus(r.data)).catch(() => { })
    const iv = setInterval(() => whatsappApi.getStatus().then(r => setWaStatus(r.data)).catch(() => { }), 5000)
    return () => clearInterval(iv)
  }, [])

  const disconnect = async () => {
    setDisconnecting(true)
    try { await whatsappApi.disconnect(); await refreshSessionStatus(); setWaStatus({ status: 'disconnected' }) } catch { }
    finally { setDisconnecting(false) }
  }

  const isConn = waStatus.status === 'connected'
  const isConn2 = waStatus.status === 'connecting'

  return (
    <div>
      {/* Linked device status */}
      <SecLabel>Linked Device</SecLabel>
      <div style={{ margin: '4px 20px 12px', borderRadius: 12, overflow: 'hidden', border: `1px solid ${WA.border}` }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 14, padding: '14px 16px', background: isConn ? 'rgba(37,211,102,.07)' : 'rgba(255,77,79,.07)' }}>
          <div style={{ width: 44, height: 44, borderRadius: '50%', background: isConn ? 'rgba(37,211,102,.15)' : 'rgba(255,77,79,.12)', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
            {isConn ? <Wifi size={20} color={WA.green} /> : isConn2 ? <RefreshCw size={20} color="orange" style={{ animation: 'spin 1s linear infinite' }} /> : <WifiOff size={20} color={WA.red} />}
          </div>
          <div style={{ flex: 1 }}>
            <div style={{ fontSize: 15, fontWeight: 600, color: WA.text }}>{isConn ? 'WhatsApp Connected' : isConn2 ? 'Connecting…' : 'Not Connected'}</div>
            <div style={{ fontSize: 13, color: WA.sub }}>{isConn ? (waStatus.phone || 'Session active') : 'No active WhatsApp session'}</div>
            {waStatus.connected_at && isConn && <div style={{ fontSize: 11, color: WA.sub, marginTop: 2 }}>Since {formatIST(waStatus.connected_at)}</div>}
          </div>
          {isConn && <span style={{ background: WA.green, color: '#111b21', borderRadius: 20, padding: '2px 10px', fontSize: 11, fontWeight: 700, flexShrink: 0 }}>LIVE</span>}
        </div>
        <div style={{ padding: '12px 16px', borderTop: `1px solid ${WA.border}` }}>
          {isConn ? (
            <button onClick={disconnect} disabled={disconnecting}
              style={{ width: '100%', padding: '10px', borderRadius: 8, border: `1px solid rgba(255,77,79,.4)`, background: 'rgba(255,77,79,.08)', color: WA.red, fontWeight: 600, fontSize: 14, cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8 }}>
              <LogOut size={15} />{disconnecting ? 'Disconnecting…' : 'Log Out (Disconnect)'}
            </button>
          ) : (
            <button onClick={() => setShowConnect(v => !v)}
              style={{ width: '100%', padding: '11px', borderRadius: 8, border: 'none', background: WA.green, color: '#111b21', fontWeight: 700, fontSize: 15, cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8 }}>
              <Smartphone size={16} />{showConnect ? 'Hide Setup' : 'Connect WhatsApp'}
            </button>
          )}
        </div>
        {!isConn && showConnect && (
          <div style={{ borderTop: `1px solid ${WA.border}` }}>
            <ConnectPanel onConnected={async () => { setShowConnect(false); const r = await whatsappApi.getStatus(); setWaStatus(r.data) }} />
          </div>
        )}
      </div>

      {/* Active browser session */}
      <SecLabel>Active Session</SecLabel>
      <div style={{ margin: '4px 20px 12px', borderRadius: 12, overflow: 'hidden', border: `1px solid ${WA.border}`, background: WA.row }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 14, padding: '14px 16px', borderBottom: `1px solid ${WA.border}` }}>
          <div style={{ width: 44, height: 44, borderRadius: '50%', background: 'rgba(99,102,241,.15)', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
            <BrowserIcon browser={browserInfo.browser} size={22} />
          </div>
          <div style={{ flex: 1, minWidth: 0 }}>
            <div style={{ fontSize: 15, fontWeight: 600, color: WA.text }}>
              {browserInfo.browser}{browserInfo.version ? ` ${browserInfo.version}` : ''}
            </div>
            <div style={{ fontSize: 12, color: WA.sub, marginTop: 2 }}>
              {browserInfo.os} · {browserInfo.device}
            </div>
          </div>
          <span style={{ background: 'rgba(37,211,102,.15)', color: WA.green, borderRadius: 20, padding: '2px 10px', fontSize: 11, fontWeight: 700, flexShrink: 0 }}>THIS DEVICE</span>
        </div>
        <div style={{ padding: '10px 16px', fontSize: 12, color: WA.sub }}>
          Session started · {sessionStart.toLocaleString()}
        </div>
      </div>

      {/* Account rows */}
      <SecLabel>Account Info</SecLabel>
      <div style={{ background: WA.row, borderRadius: 12, margin: '4px 20px 12px', overflow: 'hidden', border: `1px solid ${WA.border}` }}>
        <Row icon={<Phone size={17} color="#fff" />} iconBg="#128C7E" label="Phone number" sublabel={waStatus.phone || 'Not connected'} />
        <Row icon={<Smartphone size={17} color="#fff" />} iconBg="#0a7aff" label="Account type" sublabel="WhatsApp Web — Personal" />
        <Row icon={<Key size={17} color="#fff" />} iconBg="#f59e0b" label="Security notifications" sublabel="Notify when your security code changes"
          right={<Toggle on={secNotif} onChange={() => setSecNotif(v => !v)} />} last />
      </div>

      <SecLabel>Data</SecLabel>
      <div style={{ background: WA.row, borderRadius: 12, margin: '4px 20px 12px', overflow: 'hidden', border: `1px solid ${WA.border}` }}>
        <Row icon={<Info size={17} color="#fff" />} iconBg="#6366f1" label="Request account info" sublabel="Request a report of your account info" onClick={() => {}} />
        <Row icon={<LogOut size={17} color="#fff" />} iconBg={WA.red} label="Delete account" sublabel="Delete your account and all data" danger onClick={() => {}} last />
      </div>
    </div>
  )
}

// ─── Section: Privacy ────────────────────────────────────────────
function PrivacySection() {
  const WL = [{ v: 'everyone', label: 'Everyone' }, { v: 'contacts', label: 'My contacts' }, { v: 'nobody', label: 'Nobody' }]
  const WLC = [{ v: 'everyone', label: 'Everyone' }, { v: 'contacts', label: 'My contacts' }]
  const TL = [{ v: 'off', label: 'Off' }, { v: '24h', label: '24 hours' }, { v: '7d', label: '7 days' }, { v: '90d', label: '90 days' }]

  const [lastSeen, setLastSeen] = useState('contacts')
  const [photo, setPhoto] = useState('contacts')
  const [about, setAbout] = useState('contacts')
  const [status, setStatus] = useState('contacts')
  const [readReceipts, setReadReceipts] = useState(true)
  const [msgTimer, setMsgTimer] = useState('off')
  const [disappearing, setDisappearing] = useState('off')
  const [blocked, setBlocked] = useState(0)

  return (
    <div>
      <SecLabel>Who can see my personal info</SecLabel>
      <div style={{ background: WA.row, borderRadius: 12, margin: '4px 20px 12px', overflow: 'hidden', border: `1px solid ${WA.border}` }}>
        <Row icon={<Eye size={17} color="#fff" />} iconBg="#128C7E" label="Last seen and online" sublabel={WL.find(x => x.v === lastSeen)?.label} right={<SelectInput value={lastSeen} onChange={setLastSeen} options={WL} />} />
        <Row icon={<ImageIcon size={17} color="#fff" />} iconBg="#0a7aff" label="Profile photo" sublabel={WL.find(x => x.v === photo)?.label} right={<SelectInput value={photo} onChange={setPhoto} options={WL} />} />
        <Row icon={<Info size={17} color="#fff" />} iconBg="#8b5cf6" label="About" sublabel={WL.find(x => x.v === about)?.label} right={<SelectInput value={about} onChange={setAbout} options={WL} />} />
        <Row icon={<Globe size={17} color="#fff" />} iconBg="#f59e0b" label="Status" sublabel={WLC.find(x => x.v === status)?.label} right={<SelectInput value={status} onChange={setStatus} options={WLC} />} last />
      </div>

      <SecLabel>Messages</SecLabel>
      <div style={{ background: WA.row, borderRadius: 12, margin: '4px 20px 12px', overflow: 'hidden', border: `1px solid ${WA.border}` }}>
        <Row icon={<Check size={17} color="#fff" />} iconBg="#25D366" label="Read receipts"
          sublabel={readReceipts ? "People can see when you've read their messages" : 'Read receipts hidden (does not apply in groups)'}
          right={<Toggle on={readReceipts} onChange={() => setReadReceipts(v => !v)} />} />
        <Row icon={<Timer size={17} color="#fff" />} iconBg="#06b6d4" label="Default message timer"
          sublabel={TL.find(x => x.v === msgTimer)?.label}
          right={<SelectInput value={msgTimer} onChange={setMsgTimer} options={TL} />} last />
      </div>

      <SecLabel>Disappearing Messages</SecLabel>
      <div style={{ background: WA.row, borderRadius: 12, margin: '4px 20px 12px', overflow: 'hidden', border: `1px solid ${WA.border}` }}>
        <Row icon={<Timer size={17} color="#fff" />} iconBg="#128C7E" label="Default timer"
          sublabel={disappearing === 'off' ? 'New chats will not use disappearing messages' : `New chats will auto-delete after ${TL.find(x => x.v === disappearing)?.label}`}
          right={<SelectInput value={disappearing} onChange={setDisappearing} options={TL} />} last />
      </div>

      <SecLabel>Contacts</SecLabel>
      <div style={{ background: WA.row, borderRadius: 12, margin: '4px 20px 12px', overflow: 'hidden', border: `1px solid ${WA.border}` }}>
        <Row icon={<Ban size={17} color="#fff" />} iconBg={WA.red} label="Blocked contacts" sublabel={blocked === 0 ? 'No blocked contacts' : `${blocked} blocked`} onClick={() => {}} last />
      </div>
    </div>
  )
}

// ─── Section: Chats ──────────────────────────────────────────────
function ChatsSection() {
  const { theme, setTheme } = useApp()
  const WALLPAPERS = ['#0b141a', '#1a1a2e', '#0d1b2a', '#1b2838', '#162032', '#0f2027', '#1a1a1a', '#0a0f1e']
  const [wallpaper, setWallpaper] = useState(() => localStorage.getItem('wa_wallpaper') || '#0b141a')
  const [enterToSend, setEnterToSend] = useState(() => localStorage.getItem('wa_enter_send') !== 'false')
  const [mediaVisible, setMediaVisible] = useState(() => localStorage.getItem('wa_media_vis') !== 'false')

  const saveWallpaper = (c) => { setWallpaper(c); localStorage.setItem('wa_wallpaper', c) }
  const saveEnter = () => { const v = !enterToSend; setEnterToSend(v); localStorage.setItem('wa_enter_send', String(v)) }
  const saveMedia = () => { const v = !mediaVisible; setMediaVisible(v); localStorage.setItem('wa_media_vis', String(v)) }

  return (
    <div>
      <SecLabel>Appearance</SecLabel>
      <div style={{ background: WA.row, borderRadius: 12, margin: '4px 20px 12px', overflow: 'hidden', border: `1px solid ${WA.border}` }}>
        <Row
          icon={theme === 'dark' ? <Moon size={17} color="#fff" /> : <Sun size={17} color="#fff" />}
          iconBg="#8b5cf6"
          label="Theme"
          sublabel={theme === 'dark' ? 'Dark' : 'Light'}
          right={
            <div style={{ display: 'flex', gap: 6 }}>
              {[{ v: 'dark', label: '🌙 Dark' }, { v: 'light', label: '☀️ Light' }].map(t => (
                <button key={t.v} onClick={e => { e.stopPropagation(); setTheme(t.v) }}
                  style={{ padding: '5px 12px', borderRadius: 20, fontSize: 12, fontWeight: 600, cursor: 'pointer', border: 'none', background: theme === t.v ? WA.green : WA.border, color: theme === t.v ? '#111b21' : WA.sub }}>
                  {t.label}
                </button>
              ))}
            </div>
          }
        />
        <Row icon={<ImageIcon size={17} color="#fff" />} iconBg="#06b6d4" label="Chat wallpaper" sublabel="Background colour for chats"
          right={
            <div style={{ display: 'flex', gap: 5, alignItems: 'center' }}>
              {WALLPAPERS.map(c => (
                <button key={c} onClick={e => { e.stopPropagation(); saveWallpaper(c) }}
                  style={{ width: 22, height: 22, borderRadius: '50%', background: c, border: `2px solid ${wallpaper === c ? WA.green : WA.border}`, cursor: 'pointer', padding: 0 }} />
              ))}
            </div>
          }
          last
        />
      </div>

      <SecLabel>Chat Settings</SecLabel>
      <div style={{ background: WA.row, borderRadius: 12, margin: '4px 20px 12px', overflow: 'hidden', border: `1px solid ${WA.border}` }}>
        <Row icon={<Send size={17} color="#fff" />} iconBg="#25D366" label="Enter to send"
          sublabel={enterToSend ? 'Press Enter to send a message' : 'Press Enter for new line'}
          right={<Toggle on={enterToSend} onChange={saveEnter} />}
        />
        <Row icon={<ImageIcon size={17} color="#fff" />} iconBg="#f59e0b" label="Media visibility"
          sublabel={mediaVisible ? 'Media saved to gallery automatically' : 'Media not saved to gallery'}
          right={<Toggle on={mediaVisible} onChange={saveMedia} />}
        />
        <Row icon={<Archive size={17} color="#fff" />} iconBg="#3b4a54" label="Archive all chats" sublabel="Hide all chats from the main list" onClick={() => {}} last />
      </div>
    </div>
  )
}

// ─── Section: Notifications ──────────────────────────────────────
function NotificationsSection() {
  const [perm, setPerm] = useState(() => typeof Notification !== 'undefined' ? Notification.permission : 'denied')
  const [msgs, setMsgs] = useState(true)
  const [groups, setGroups] = useState(true)
  const [sounds, setSounds] = useState(true)
  const [desktop, setDesktop] = useState(perm === 'granted')
  const [preview, setPreview] = useState(true)
  const [reactions, setReactions] = useState(true)

  const requestDesktop = async () => {
    if (typeof Notification === 'undefined') return
    const p = await Notification.requestPermission()
    setPerm(p); setDesktop(p === 'granted')
  }

  return (
    <div>
      <SecLabel>Message notifications</SecLabel>
      <div style={{ background: WA.row, borderRadius: 12, margin: '4px 20px 12px', overflow: 'hidden', border: `1px solid ${WA.border}` }}>
        <Row icon={<Bell size={17} color="#fff" />} iconBg="#25D366" label="Message notifications" sublabel={msgs ? 'On' : 'Off'} right={<Toggle on={msgs} onChange={() => setMsgs(v => !v)} />} />
        <Row icon={<Volume2 size={17} color="#fff" />} iconBg="#06b6d4" label="Sounds" sublabel={sounds ? 'On' : 'Off'} right={<Toggle on={sounds} onChange={() => setSounds(v => !v)} />} />
        <Row icon={<Eye size={17} color="#fff" />} iconBg="#8b5cf6" label="Show preview" sublabel={preview ? 'Message content shown in notification' : 'Content hidden'} right={<Toggle on={preview} onChange={() => setPreview(v => !v)} />} last />
      </div>

      <SecLabel>Group notifications</SecLabel>
      <div style={{ background: WA.row, borderRadius: 12, margin: '4px 20px 12px', overflow: 'hidden', border: `1px solid ${WA.border}` }}>
        <Row icon={<Bell size={17} color="#fff" />} iconBg="#0a7aff" label="Group notifications" sublabel={groups ? 'On' : 'Off'} right={<Toggle on={groups} onChange={() => setGroups(v => !v)} />} />
        <Row icon={<Check size={17} color="#fff" />} iconBg="#f59e0b" label="Reaction notifications" sublabel={reactions ? 'On' : 'Off'} right={<Toggle on={reactions} onChange={() => setReactions(v => !v)} />} last />
      </div>

      <SecLabel>Desktop notifications</SecLabel>
      <div style={{ background: WA.row, borderRadius: 12, margin: '4px 20px 12px', overflow: 'hidden', border: `1px solid ${WA.border}` }}>
        <Row icon={<Monitor size={17} color="#fff" />} iconBg="#128C7E"
          label="Desktop notifications"
          sublabel={perm === 'granted' ? 'Enabled by browser' : perm === 'denied' ? 'Blocked by browser — check browser settings' : 'Click to enable'}
          right={
            perm === 'granted'
              ? <Toggle on={desktop} onChange={() => setDesktop(v => !v)} />
              : <button onClick={requestDesktop} style={{ padding: '5px 12px', borderRadius: 8, background: WA.green, color: '#111b21', border: 'none', fontSize: 12, fontWeight: 600, cursor: 'pointer' }}>Enable</button>
          }
          last
        />
      </div>
    </div>
  )
}

// ─── Section: Keyboard Shortcuts ─────────────────────────────────
function ShortcutsSection() {
  const [enabled, setEnabledState] = useState(getShortcutsEnabled)

  const toggle = () => {
    const next = !enabled
    setEnabledState(next)
    setShortcutsEnabled(next)
  }

  return (
    <div style={{ padding: '8px 20px 24px' }}>
      {/* Enable / disable row */}
      <div style={{ background: WA.row, borderRadius: 12, border: `1px solid ${WA.border}`, marginBottom: 20, overflow: 'hidden' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '14px 16px' }}>
          <div>
            <div style={{ fontSize: 14, color: WA.text, fontWeight: 500 }}>Enable keyboard shortcuts</div>
            <div style={{ fontSize: 12, color: WA.sub, marginTop: 2 }}>
              Navigation shortcuts (Ctrl+Shift+*) always work · others are blocked in text fields
            </div>
          </div>
          <Toggle on={enabled} onChange={toggle} />
        </div>
      </div>

      <div style={{ fontSize: 13, color: WA.sub, marginBottom: 20, lineHeight: 1.6 }}>
        Press <kbd style={{ fontFamily: 'monospace', fontSize: 12, background: '#2a3942', padding: '2px 6px', borderRadius: 4, border: `1px solid ${WA.border}` }}>?</kbd> anywhere (outside text fields) to open the shortcuts overlay.
      </div>

      {SHORTCUT_GROUPS.map(g => (
        <div key={g.label} style={{ marginBottom: 20 }}>
          <div style={{ fontSize: 12, color: WA.green, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '.05em', marginBottom: 8 }}>{g.label}</div>
          <div style={{ background: WA.row, borderRadius: 12, border: `1px solid ${WA.border}`, overflow: 'hidden' }}>
            {g.shortcuts.map((s, i) => (
              <div key={i} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '11px 16px', borderBottom: i < g.shortcuts.length - 1 ? `1px solid ${WA.border}` : 'none' }}>
                <span style={{ fontSize: 13, color: WA.text }}>{s.description}</span>
                <div style={{ display: 'flex', gap: 4 }}>
                  {s.keys.map((k, ki) => (
                    <kbd key={ki} style={{ fontFamily: 'monospace', fontSize: 11, color: WA.sub, background: '#2a3942', padding: '2px 7px', borderRadius: 5, border: `1px solid ${WA.border}`, whiteSpace: 'nowrap' }}>{k}</kbd>
                  ))}
                </div>
              </div>
            ))}
          </div>
        </div>
      ))}
    </div>
  )
}

// ─── Section: Help ───────────────────────────────────────────────
function HelpSection() {
  const items = [
    { icon: <HelpCircle size={17} color="#fff" />, bg: '#0a7aff', label: 'Help Centre', sub: 'Get answers to common questions', href: 'https://faq.whatsapp.com' },
    { icon: <Send size={17} color="#fff" />, bg: '#25D366', label: 'Contact us', sub: 'Report a problem or send feedback', href: null },
    { icon: <Globe size={17} color="#fff" />, bg: '#8b5cf6', label: 'Terms and Privacy Policy', sub: 'Read our terms of service', href: 'https://www.whatsapp.com/legal/privacy-policy' },
    { icon: <Info size={17} color="#fff" />, bg: '#f59e0b', label: 'Send feedback', sub: 'Help us improve this app', href: null },
  ]
  return (
    <div>
      <SecLabel>Support</SecLabel>
      <div style={{ background: WA.row, borderRadius: 12, margin: '4px 20px 12px', overflow: 'hidden', border: `1px solid ${WA.border}` }}>
        {items.map((item, i) => (
          <Row key={item.label} icon={item.icon} iconBg={item.bg} label={item.label} sublabel={item.sub}
            onClick={() => item.href && window.open(item.href, '_blank')}
            last={i === items.length - 1}
          />
        ))}
      </div>

      <SecLabel>App Info</SecLabel>
      <div style={{ background: WA.row, borderRadius: 12, margin: '4px 20px 12px', overflow: 'hidden', border: `1px solid ${WA.border}` }}>
        <Row icon={<Info size={17} color="#fff" />} iconBg="#3b4a54" label="App version" right={<span style={{ fontFamily: 'monospace', fontSize: 13 }}>v{import.meta.env.VITE_APP_VERSION || '1.0.0'}</span>} />
        <Row icon={<Globe size={17} color="#fff" />} iconBg="#3b4a54" label="Backend API" right={<span style={{ fontFamily: 'monospace', fontSize: 12 }}>{(import.meta.env.VITE_API_BASE_URL || 'http://localhost:8000').replace('/api/v1', '')}</span>} />
        <Row icon={<Database size={17} color="#fff" />} iconBg="#3b4a54" label="Environment" right={<span style={{ fontFamily: 'monospace', fontSize: 12 }}>{import.meta.env.VITE_APP_ENV || 'development'}</span>} last />
      </div>
    </div>
  )
}

// ─── Log Control Section ─────────────────────────────────────────
function LogControlSection() {
  const [settings, setSettings] = useState({ logging_enabled: true, max_log_entries: 0 })
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [toast, setToast] = useState({ msg: '', type: '' })
  const [confirmClear, setConfirmClear] = useState(false)
  const [exporting, setExporting] = useState(false)

  const showToast = (msg, type = 'ok') => {
    setToast({ msg, type })
    setTimeout(() => setToast({ msg: '', type: '' }), 3000)
  }

  useEffect(() => {
    logsApi.getSettings()
      .then(r => setSettings(r.data))
      .catch(() => {})
      .finally(() => setLoading(false))
  }, [])

  const handleSave = async () => {
    setSaving(true)
    try {
      const r = await logsApi.saveSettings(settings)
      setSettings(r.data)
      showToast('Log settings saved')
    } catch {
      showToast('Failed to save settings', 'error')
    } finally {
      setSaving(false)
    }
  }

  const handleExport = async () => {
    setExporting(true)
    try {
      const res = await logsApi.export()
      const url = URL.createObjectURL(res.data)
      const a = document.createElement('a')
      a.href = url
      a.download = `automation_logs_${new Date().toISOString().slice(0, 10)}.csv`
      a.click()
      URL.revokeObjectURL(url)
      showToast('Export downloaded')
    } catch {
      showToast('Export failed', 'error')
    } finally {
      setExporting(false)
    }
  }

  const handleClear = async () => {
    if (!confirmClear) { setConfirmClear(true); return }
    try {
      await logsApi.clear()
      showToast('All logs cleared')
    } catch {
      showToast('Failed to clear logs', 'error')
    } finally {
      setConfirmClear(false)
    }
  }

  if (loading) return (
    <div style={{ display: 'flex', justifyContent: 'center', padding: 40 }}>
      <RefreshCw size={20} color={WA.sub} style={{ animation: 'spin 1s linear infinite' }} />
    </div>
  )

  return (
    <div>
      <Toast msg={toast.msg} type={toast.type} />

      {/* Enable / disable logging */}
      <SecLabel>Logging</SecLabel>
      <div style={{ background: WA.row, borderRadius: 12, margin: '4px 20px 12px', overflow: 'hidden', border: `1px solid ${WA.border}` }}>
        <Row
          icon={<ScrollText size={17} color="#fff" />}
          iconBg="#25D366"
          label="Enable activity logging"
          sublabel="Record automation runs, errors, and events"
          right={
            <Toggle
              on={settings.logging_enabled}
              onChange={() => setSettings(s => ({ ...s, logging_enabled: !s.logging_enabled }))}
            />
          }
          last
        />
      </div>

      {/* Max entries */}
      <SecLabel>Log Retention</SecLabel>
      <div style={{ background: WA.row, borderRadius: 12, margin: '4px 20px 12px', border: `1px solid ${WA.border}`, overflow: 'hidden' }}>
        <div style={{ padding: '14px 20px', borderBottom: `1px solid ${WA.border}` }}>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 8 }}>
            <div>
              <div style={{ fontSize: 15, color: WA.text }}>Maximum log entries</div>
              <div style={{ fontSize: 12, color: WA.sub, marginTop: 2 }}>Oldest logs are deleted automatically when limit is reached</div>
            </div>
          </div>
          <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
            <input
              type="number"
              min="0"
              max="10000"
              value={settings.max_log_entries}
              onChange={e => setSettings(s => ({ ...s, max_log_entries: Math.max(0, parseInt(e.target.value) || 0) }))}
              disabled={!settings.logging_enabled}
              style={{
                width: 100, padding: '8px 12px',
                background: WA.input, border: `1px solid ${WA.border}`,
                borderRadius: 8, color: settings.logging_enabled ? WA.text : WA.sub,
                fontSize: 15, outline: 'none',
                opacity: settings.logging_enabled ? 1 : 0.5,
              }}
              onFocus={e => { if (settings.logging_enabled) e.target.style.borderColor = WA.green }}
              onBlur={e => e.target.style.borderColor = WA.border}
            />
            <span style={{ fontSize: 13, color: WA.sub }}>entries &nbsp;(0 = unlimited)</span>
          </div>
        </div>
        <div style={{ padding: '11px 20px', fontSize: 12, color: WA.sub, lineHeight: 1.6 }}>
          Tip: set 100–500 for a Raspberry Pi to keep database size small.
        </div>
      </div>

      {/* Save button */}
      <div style={{ margin: '0 20px 20px' }}>
        <button
          onClick={handleSave}
          disabled={saving}
          style={{ width: '100%', padding: '12px', borderRadius: 10, border: 'none', background: WA.green, color: '#111b21', fontWeight: 700, fontSize: 15, cursor: saving ? 'not-allowed' : 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8, opacity: saving ? 0.7 : 1 }}
        >
          {saving ? <><RefreshCw size={15} style={{ animation: 'spin 1s linear infinite' }} /> Saving…</> : <><Check size={15} /> Save Log Settings</>}
        </button>
      </div>

      {/* Data management */}
      <SecLabel>Data Management</SecLabel>
      <div style={{ background: WA.row, borderRadius: 12, margin: '4px 20px 12px', overflow: 'hidden', border: `1px solid ${WA.border}` }}>
        <Row
          icon={<FileDown size={17} color="#fff" />}
          iconBg="#0a7aff"
          label="Export logs"
          sublabel="Download all logs as a CSV file"
          onClick={exporting ? undefined : handleExport}
          right={exporting ? <RefreshCw size={14} style={{ animation: 'spin 1s linear infinite' }} /> : null}
        />
        <Row
          icon={<Trash2 size={17} color="#fff" />}
          iconBg={confirmClear ? WA.red : '#3b4a54'}
          label={confirmClear ? 'Tap again to confirm clear' : 'Clear all logs'}
          sublabel={confirmClear ? 'This cannot be undone' : 'Permanently delete all log entries from the database'}
          onClick={handleClear}
          danger={confirmClear}
          last
        />
      </div>
    </div>
  )
}

// ─── Section: AI Integration ─────────────────────────────────────
function AiSection() {
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [testing, setTesting] = useState(false)
  const [toast, setToast] = useState({ msg: '', type: '' })
  const [testResult, setTestResult] = useState(null)
  const [showKey, setShowKey] = useState(false)

  // Form state
  const [enabled, setEnabled] = useState(false)
  const [provider, setProvider] = useState('openai')
  const [apiKey, setApiKey] = useState('')
  const [apiKeyMasked, setApiKeyMasked] = useState('')
  const [hasApiKey, setHasApiKey] = useState(false)
  const [model, setModel] = useState('')
  const [tone, setTone] = useState('professional')
  const [language, setLanguage] = useState('auto')
  const [autoSuggest, setAutoSuggest] = useState(false)

  const showToast = (msg, type = 'ok') => {
    setToast({ msg, type })
    setTimeout(() => setToast({ msg: '', type: '' }), 3500)
  }

  useEffect(() => {
    aiApi.getSettings()
      .then(r => {
        const d = r.data
        setEnabled(d.enabled)
        setProvider(d.provider)
        setApiKeyMasked(d.api_key_masked || '')
        setHasApiKey(d.has_api_key)
        setModel(d.model || '')
        setTone(d.tone)
        setLanguage(d.language)
        setAutoSuggest(d.auto_suggest)
      })
      .catch(() => showToast('Failed to load AI settings', 'error'))
      .finally(() => setLoading(false))
  }, [])

  const handleSave = async () => {
    setSaving(true)
    setTestResult(null)
    try {
      const payload = { provider, tone, language, model, enabled, auto_suggest: autoSuggest }
      if (apiKey.trim()) payload.api_key = apiKey.trim()
      const r = await aiApi.saveSettings(payload)
      setHasApiKey(r.data.has_api_key)
      setApiKeyMasked(r.data.api_key_masked || '')
      setApiKey('')
      showToast('AI settings saved')
    } catch {
      showToast('Failed to save AI settings', 'error')
    } finally {
      setSaving(false)
    }
  }

  const handleTest = async () => {
    // Save first (if there's a pending API key), then test
    if (apiKey.trim()) await handleSave()
    setTesting(true)
    setTestResult(null)
    try {
      const r = await aiApi.testConnection()
      setTestResult({ ok: true, reply: r.data.reply, provider: r.data.provider })
    } catch (err) {
      const msg = err?.response?.data?.detail || 'Connection test failed'
      setTestResult({ ok: false, reply: msg })
    } finally {
      setTesting(false)
    }
  }

  const providerPlaceholders = {
    openai: 'sk-…',
    gemini: 'AIza…',
  }
  const defaultModels = {
    openai: 'gpt-4o-mini  (default)',
    gemini: 'gemini-1.5-flash  (default)',
  }

  if (loading) return (
    <div style={{ display: 'flex', justifyContent: 'center', padding: 48 }}>
      <RefreshCw size={20} color={WA.sub} style={{ animation: 'spin 1s linear infinite' }} />
    </div>
  )

  return (
    <div>
      <Toast msg={toast.msg} type={toast.type} />

      {/* Master toggle */}
      <SecLabel>AI Smart Reply</SecLabel>
      <div style={{ background: WA.row, borderRadius: 12, margin: '4px 20px 12px', overflow: 'hidden', border: `1px solid ${WA.border}` }}>
        <Row
          icon={<Sparkles size={17} color="#fff" />}
          iconBg="#7c3aed"
          label="Enable AI Auto Reply"
          sublabel={enabled ? 'AI reply button active in Messages' : 'Disabled — AI button hidden in Messages'}
          right={<Toggle on={enabled} onChange={() => setEnabled(v => !v)} />}
          last
        />
      </div>

      {/* Provider */}
      <SecLabel>AI Provider</SecLabel>
      <div style={{ background: WA.row, borderRadius: 12, margin: '4px 20px 12px', overflow: 'hidden', border: `1px solid ${WA.border}` }}>
        <div style={{ display: 'flex', gap: 10, padding: '14px 16px' }}>
          {[
            { v: 'openai', label: 'OpenAI', sub: 'GPT-4o, GPT-4o-mini', color: '#10b981' },
            { v: 'gemini', label: 'Google Gemini', sub: 'Gemini 1.5 Flash / Pro', color: '#4285f4' },
          ].map(p => (
            <button
              key={p.v}
              onClick={() => { setProvider(p.v); setModel('') }}
              style={{
                flex: 1, padding: '12px 10px', borderRadius: 10, cursor: 'pointer',
                border: `2px solid ${provider === p.v ? p.color : WA.border}`,
                background: provider === p.v ? `${p.color}15` : WA.bg,
                color: provider === p.v ? p.color : WA.sub,
                textAlign: 'center', transition: 'all 0.15s',
              }}
            >
              <div style={{ fontWeight: 700, fontSize: 14 }}>{p.label}</div>
              <div style={{ fontSize: 11, marginTop: 3, opacity: 0.8 }}>{p.sub}</div>
            </button>
          ))}
        </div>
      </div>

      {/* API Key */}
      <SecLabel>API Key</SecLabel>
      <div style={{ background: WA.row, borderRadius: 12, margin: '4px 20px 12px', border: `1px solid ${WA.border}`, overflow: 'hidden' }}>
        <div style={{ padding: '14px 16px' }}>
          <div style={{ fontSize: 13, color: WA.sub, marginBottom: 8 }}>
            {provider === 'openai'
              ? 'Get your key at platform.openai.com → API Keys'
              : 'Get your key at aistudio.google.com → Get API Key'}
          </div>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
            <div style={{ position: 'relative', flex: 1 }}>
              <input
                type={showKey ? 'text' : 'password'}
                value={apiKey}
                onChange={e => setApiKey(e.target.value)}
                placeholder={hasApiKey ? apiKeyMasked : (providerPlaceholders[provider] || 'Enter API key')}
                style={{ width: '100%', boxSizing: 'border-box', padding: '10px 38px 10px 14px', background: WA.input, border: `1px solid ${WA.border}`, borderRadius: 8, color: WA.text, fontSize: 14, outline: 'none', fontFamily: 'monospace' }}
                onFocus={e => e.target.style.borderColor = WA.green}
                onBlur={e => e.target.style.borderColor = WA.border}
              />
              <button
                onClick={() => setShowKey(v => !v)}
                style={{ position: 'absolute', right: 10, top: '50%', transform: 'translateY(-50%)', background: 'none', border: 'none', cursor: 'pointer', color: WA.sub, display: 'flex' }}
              >
                {showKey ? <EyeOff size={15} /> : <Eye size={15} />}
              </button>
            </div>
            {hasApiKey && !apiKey && (
              <span style={{ fontSize: 11, color: WA.green, display: 'flex', alignItems: 'center', gap: 4, flexShrink: 0 }}>
                <Check size={12} /> Key saved
              </span>
            )}
          </div>
          <div style={{ fontSize: 11, color: WA.sub, marginTop: 8 }}>
            Leave blank to keep the existing saved key. The raw key is never displayed.
          </div>
        </div>

        {/* Test connection */}
        <div style={{ padding: '10px 16px', borderTop: `1px solid ${WA.border}`, display: 'flex', alignItems: 'center', gap: 10 }}>
          <button
            onClick={handleTest}
            disabled={testing || (!hasApiKey && !apiKey.trim())}
            style={{
              display: 'flex', alignItems: 'center', gap: 6, padding: '7px 14px',
              borderRadius: 8, border: `1px solid ${WA.border}`,
              background: 'transparent', color: WA.sub, fontSize: 13,
              cursor: testing ? 'wait' : 'pointer', opacity: (!hasApiKey && !apiKey.trim()) ? 0.4 : 1,
            }}
          >
            {testing
              ? <><RefreshCw size={13} style={{ animation: 'spin 1s linear infinite' }} /> Testing…</>
              : <><FlaskConical size={13} /> Test Connection</>}
          </button>
          {testResult && (
            <div style={{
              flex: 1, fontSize: 12, padding: '5px 10px', borderRadius: 6,
              background: testResult.ok ? 'rgba(37,211,102,.1)' : 'rgba(255,77,79,.1)',
              border: `1px solid ${testResult.ok ? 'rgba(37,211,102,.3)' : 'rgba(255,77,79,.3)'}`,
              color: testResult.ok ? WA.green : '#ff4d4f',
              display: 'flex', alignItems: 'center', gap: 6,
            }}>
              {testResult.ok ? <CheckCircle2 size={12} /> : <AlertCircle size={12} />}
              {testResult.ok ? `✓ Connected (${testResult.provider}) — "${testResult.reply}"` : testResult.reply}
            </div>
          )}
        </div>
      </div>

      {/* Model override */}
      <SecLabel>Model (optional)</SecLabel>
      <div style={{ background: WA.row, borderRadius: 12, margin: '4px 20px 12px', border: `1px solid ${WA.border}`, overflow: 'hidden' }}>
        <div style={{ padding: '14px 16px' }}>
          <input
            value={model}
            onChange={e => setModel(e.target.value)}
            placeholder={defaultModels[provider] || 'Leave blank for default'}
            style={{ width: '100%', boxSizing: 'border-box', padding: '10px 14px', background: WA.input, border: `1px solid ${WA.border}`, borderRadius: 8, color: WA.text, fontSize: 14, outline: 'none', fontFamily: 'monospace' }}
            onFocus={e => e.target.style.borderColor = WA.green}
            onBlur={e => e.target.style.borderColor = WA.border}
          />
          <div style={{ fontSize: 11, color: WA.sub, marginTop: 6 }}>
            Override only if you need a specific model version. Leave blank to use the latest recommended default.
          </div>
        </div>
      </div>

      {/* Tone & Language */}
      <SecLabel>Reply Style</SecLabel>
      <div style={{ background: WA.row, borderRadius: 12, margin: '4px 20px 12px', overflow: 'hidden', border: `1px solid ${WA.border}` }}>
        <Row
          icon={<MessageSquare size={17} color="#fff" />}
          iconBg="#f59e0b"
          label="Tone"
          sublabel="Personality of AI-generated replies"
          right={
            <SelectInput
              value={tone}
              onChange={setTone}
              options={[
                { v: 'professional', label: 'Professional' },
                { v: 'friendly', label: 'Friendly' },
                { v: 'formal', label: 'Formal' },
                { v: 'casual', label: 'Casual' },
                { v: 'concise', label: 'Concise' },
              ]}
            />
          }
        />
        <Row
          icon={<Globe size={17} color="#fff" />}
          iconBg="#06b6d4"
          label="Language"
          sublabel="Reply language preference"
          right={
            <SelectInput
              value={language}
              onChange={setLanguage}
              options={[
                { v: 'auto', label: 'Auto-detect' },
                { v: 'English', label: 'English' },
                { v: 'Tamil', label: 'Tamil' },
                { v: 'Hindi', label: 'Hindi' },
                { v: 'Arabic', label: 'Arabic' },
                { v: 'Spanish', label: 'Spanish' },
              ]}
            />
          }
          last
        />
      </div>

      {/* Auto-suggest */}
      <SecLabel>Behaviour</SecLabel>
      <div style={{ background: WA.row, borderRadius: 12, margin: '4px 20px 12px', overflow: 'hidden', border: `1px solid ${WA.border}` }}>
        <Row
          icon={<Zap size={17} color="#fff" />}
          iconBg="#7c3aed"
          label="Auto-suggest on new message"
          sublabel={autoSuggest
            ? 'AI will pre-fill a reply draft when a new message arrives'
            : 'Click ✨ in Messages to generate a reply on demand'}
          right={<Toggle on={autoSuggest} onChange={() => setAutoSuggest(v => !v)} />}
          last
        />
      </div>

      {/* Save */}
      <div style={{ margin: '0 20px 24px' }}>
        <button
          onClick={handleSave}
          disabled={saving}
          style={{ width: '100%', padding: '12px', borderRadius: 10, border: 'none', background: WA.green, color: '#111b21', fontWeight: 700, fontSize: 15, cursor: saving ? 'not-allowed' : 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8, opacity: saving ? 0.7 : 1 }}
        >
          {saving
            ? <><RefreshCw size={15} style={{ animation: 'spin 1s linear infinite' }} /> Saving…</>
            : <><Check size={15} /> Save AI Settings</>}
        </button>
      </div>
    </div>
  )
}

// ─── Nav item (needs own state for hover) ───────────────────────
function NavItem({ n, active, isMobile, onClick }) {
  const [h, setH] = useState(false)
  const Icon = n.icon
  const isActive = active === n.id && !isMobile
  return (
    <div
      onClick={onClick}
      onMouseEnter={() => setH(true)}
      onMouseLeave={() => setH(false)}
      style={{
        display: 'flex', alignItems: 'center', gap: 14, padding: '13px 20px',
        cursor: 'pointer',
        background: isActive ? 'rgba(37,211,102,.08)' : h ? 'rgba(255,255,255,.04)' : 'transparent',
        borderLeft: isActive ? `3px solid ${WA.green}` : '3px solid transparent',
        borderBottom: `1px solid ${WA.border}`,
        transition: 'background .12s',
      }}
    >
      <div style={{ width: 38, height: 38, borderRadius: '50%', background: n.color + '22', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
        <Icon size={18} color={n.color} />
      </div>
      <span style={{ fontSize: 15, color: isActive ? WA.green : WA.text, fontWeight: isActive ? 600 : 400, flex: 1 }}>{n.label}</span>
      {isMobile && <ChevronRight size={15} style={{ color: '#3b4a54' }} />}
    </div>
  )
}

// ─── Nav sections config ─────────────────────────────────────────
const NAV = [
  { id: 'profile',       icon: UserCircle,    label: 'Profile',            color: '#128C7E' },
  { id: 'account',       icon: Shield,        label: 'Account',            color: '#0a7aff' },
  { id: 'privacy',       icon: Lock,          label: 'Privacy',            color: '#6366f1' },
  { id: 'chats',         icon: MessageSquare, label: 'Chats',              color: '#f59e0b' },
  { id: 'notifications', icon: Bell,          label: 'Notifications',      color: '#25D366' },
  { id: 'ai',            icon: Sparkles,      label: 'AI Integration',     color: '#7c3aed' },
  { id: 'log_control',   icon: ScrollText,    label: 'Log Control',        color: '#06b6d4' },
  { id: 'shortcuts',     icon: Keyboard,      label: 'Keyboard shortcuts', color: '#8b5cf6' },
  { id: 'help',          icon: HelpCircle,    label: 'Help',               color: '#64748b' },
]

const SECTION_COMPONENTS = {
  profile: ProfileSection,
  account: AccountSection,
  privacy: PrivacySection,
  chats: ChatsSection,
  notifications: NotificationsSection,
  ai: AiSection,
  log_control: LogControlSection,
  shortcuts: ShortcutsSection,
  help: HelpSection,
}

// ─── Main Settings Component ─────────────────────────────────────
export default function Settings() {
  const { refreshSessionStatus } = useApp()
  const { logout } = useAuth()
  const navigate = useNavigate()
  const [active, setActive] = useState('profile')
  const [isMobile, setIsMobile] = useState(() => window.innerWidth <= 768)
  const [mobileShowDetail, setMobileShowDetail] = useState(false)

  useEffect(() => {
    const h = () => setIsMobile(window.innerWidth <= 768)
    window.addEventListener('resize', h)
    return () => window.removeEventListener('resize', h)
  }, [])

  const selectSection = (id) => {
    setActive(id)
    if (isMobile) setMobileShowDetail(true)
  }

  const handleLogout = async () => {
    try { await whatsappApi.disconnect() } catch { }
    await logout()
    navigate('/auth', { replace: true })
  }

  const SectionContent = SECTION_COMPONENTS[active]
  const activeNav = NAV.find(n => n.id === active)

  // ── Left nav panel ──
  const LeftPanel = (
    <div style={{ width: isMobile ? '100%' : 280, flexShrink: 0, background: WA.bg, display: 'flex', flexDirection: 'column', borderRight: `1px solid ${WA.border}`, height: '100%', overflowY: 'auto' }}>
      {/* Header */}
      <div style={{ padding: '16px 20px', background: WA.panel, borderBottom: `1px solid ${WA.border}`, position: 'sticky', top: 0, zIndex: 2 }}>
        <span style={{ fontSize: 19, fontWeight: 700, color: WA.text }}>Settings</span>
      </div>

      {/* Nav items */}
      <div style={{ flex: 1, overflowY: 'auto', paddingBottom: 8 }}>
        {NAV.map(n => (
          <NavItem key={n.id} n={n} active={active} isMobile={isMobile} onClick={() => selectSection(n.id)} />
        ))}
      </div>

      {/* Log out */}
      <div style={{ borderTop: `1px solid ${WA.border}`, padding: '8px 0' }}>
        <div
          onClick={handleLogout}
          style={{ display: 'flex', alignItems: 'center', gap: 14, padding: '13px 20px', cursor: 'pointer' }}
          onMouseEnter={e => e.currentTarget.style.background = 'rgba(255,77,79,.08)'}
          onMouseLeave={e => e.currentTarget.style.background = 'transparent'}
        >
          <div style={{ width: 38, height: 38, borderRadius: '50%', background: 'rgba(255,77,79,.12)', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
            <LogOut size={18} color={WA.red} />
          </div>
          <span style={{ fontSize: 15, color: WA.red }}>Log out</span>
        </div>
      </div>
    </div>
  )

  // ── Right detail panel ──
  const RightPanel = (
    <div style={{ flex: 1, background: WA.bg, display: 'flex', flexDirection: 'column', overflowY: 'auto', minWidth: 0 }}>
      <PanelHeader
        title={activeNav?.label}
        onBack={isMobile ? () => setMobileShowDetail(false) : undefined}
      />
      <div style={{ overflowY: 'auto', flex: 1 }}>
        {SectionContent && <SectionContent />}
      </div>
    </div>
  )

  // ── Outer wrapper ──
  return (
    <div style={{ height: 'calc(100vh - 120px)', display: 'flex', borderRadius: 12, overflow: 'hidden', border: `1px solid ${WA.border}`, background: WA.bg }}>
      {isMobile ? (
        mobileShowDetail ? RightPanel : LeftPanel
      ) : (
        <>
          {LeftPanel}
          {RightPanel}
        </>
      )}
      <style>{`@keyframes spin { to { transform: rotate(360deg); } }`}</style>
    </div>
  )
}
