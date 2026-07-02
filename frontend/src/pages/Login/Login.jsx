import { useState, useEffect, useRef } from 'react'
import { useNavigate } from 'react-router-dom'
import {
  QrCode, RefreshCw, Key, HelpCircle, Lock,
  MessageSquare, Zap, Cpu, Cloud, Smartphone, ChevronLeft
} from 'lucide-react'
import { whatsappApi, healthApi } from '../../services/api'
import { useApp } from '../../context/AppContext'
import { getErrorMessage } from '../../utils/error'

// Default country code assumed when the user omits one (matches the existing
// +91xxxxxxxxxx placeholders/dev defaults already used throughout this form).
const DEFAULT_COUNTRY_CODE = '+91'
const PHONE_RE = /^\+[1-9]\d{7,14}$/

// Normalizes "9025945924" → "+919025945924"; leaves an already-prefixed
// number (or one with a different country code) untouched aside from
// stripping spaces/dashes.
function normalizePhone(raw) {
  const cleaned = (raw || '').trim().replace(/[\s-]/g, '')
  if (!cleaned) return ''
  return cleaned.startsWith('+') ? cleaned : `${DEFAULT_COUNTRY_CODE}${cleaned.replace(/^0+/, '')}`
}

// No SSE progress within this long at the 'launching'/'qr' step likely means
// the bridge or the phone's scan is stuck — offer a clear way out instead of
// leaving the user staring at a spinner indefinitely.
const AUTH_TIMEOUT_MS = 90_000

const CONNECTION_METHODS = [
  {
    id: 'bridge',
    icon: <Smartphone size={20} />,
    title: 'WhatsApp Web Bridge',
    desc: 'Link via QR Code or Pairing Code using your phone'
  },
  {
    id: 'meta',
    icon: <Cloud size={20} />,
    title: 'Meta Cloud API',
    desc: 'Connect using official Meta Business API credentials'
  },
  {
    id: 'dev',
    icon: <Cpu size={20} />,
    title: 'Dev / Bypass Mode',
    desc: 'Skip WhatsApp link — for local testing only'
  }
]

export default function Login() {
  const { sessionStatus, refreshSessionStatus, markConnectionInitiated, fetchWaProfile } = useApp()
  const navigate = useNavigate()

  // View: 'splash' | 'method' | 'form' | 'connecting'
  const [view, setView] = useState('splash')

  const [connectionType, setConnectionType] = useState('bridge')
  const [bridgeLinkMethod, setBridgeLinkMethod] = useState('qr') // qr | otp
  const [phone, setPhone] = useState('')
  const [metaToken, setMetaToken] = useState('')
  const [metaPhoneNumberId, setMetaPhoneNumberId] = useState('')
  const [metaBusinessAccountId, setMetaBusinessAccountId] = useState('')

  const [connecting, setConnecting] = useState(false)
  const [qrCode, setQrCode] = useState(null)
  const [pairingCode, setPairingCode] = useState(null)
  const [message, setMessage] = useState('')
  const [errorMsg, setErrorMsg] = useState('')
  const [backendOk, setBackendOk] = useState(null) // null=checking, true, false
  const [connectionStep, setConnectionStep] = useState('launching') // launching | qr | authenticated | connected
  const failCountRef = useRef(0)

  // True while view === 'connecting'; read in unmount cleanup (can't use state there)
  const connectingRef = useRef(false)
  useEffect(() => { connectingRef.current = (view === 'connecting') }, [view])

  // Prevents the unmount cleanup from cancelling a session that just connected successfully
  const didConnectRef = useRef(false)

  // On mount: reset all state and cancel any leftover bridge 'connecting' session from
  // a prior visit (e.g. user pressed browser Back from the QR screen).
  // On unmount: if the user leaves mid-connection without scanning (browser Back),
  // cancel the bridge so it doesn't keep a ghost session alive.
  useEffect(() => {
    setView('splash')
    setQrCode(null)
    setPairingCode(null)
    setMessage('')
    setErrorMsg('')
    setPhone('')
    didConnectRef.current = false
    if (sessionStatus.status === 'connecting') {
      whatsappApi.disconnect().catch(() => {})
    }
    return () => {
      if (connectingRef.current && !didConnectRef.current) {
        whatsappApi.disconnect().catch(() => {})
      }
    }
  }, [])  // eslint-disable-line react-hooks/exhaustive-deps

  // Redirect to dashboard as soon as WhatsApp is connected
  useEffect(() => {
    if (sessionStatus.status === 'connected') {
      didConnectRef.current = true
      navigate('/dashboard')
    }
  }, [sessionStatus.status, navigate])

  // If session drops unexpectedly while on the connecting screen, return to method picker
  useEffect(() => {
    if (sessionStatus.status !== 'connected' && sessionStatus.status !== 'connecting' && view === 'connecting') {
      setView('method')
      setQrCode(null)
      setPairingCode(null)
    }
  }, [sessionStatus.status, view])

  // Backend connectivity check — require 2 consecutive failures before showing the banner
  // so a single transient hiccup (e.g. backend still starting) doesn't trigger a false alarm
  useEffect(() => {
    let cancelled = false
    const check = () => {
      healthApi.check()
        .then(() => {
          if (!cancelled) { failCountRef.current = 0; setBackendOk(true) }
        })
        .catch(() => {
          if (!cancelled) {
            failCountRef.current += 1
            if (failCountRef.current >= 2) setBackendOk(false)
          }
        })
    }
    // Small delay before the first check so the backend has a moment to finish startup
    const t = setTimeout(check, 1500)
    const iv = setInterval(check, 10000)
    return () => { cancelled = true; clearTimeout(t); clearInterval(iv) }
  }, [])

  // SSE listener while QR/pairing view is visible — replaces the old 2 s polling interval.
  // Falls back to 1.5 s polling if the SSE connection can't be established.
  useEffect(() => {
    if (view !== 'connecting') return

    let es = null
    let fallbackTimer = null
    let cancelled = false

    // If nothing has completed authentication within AUTH_TIMEOUT_MS, stop
    // waiting indefinitely — offer a clear way back instead of a frozen spinner.
    const timeoutTimer = setTimeout(() => {
      if (cancelled || didConnectRef.current) return
      setErrorMsg('❌ Authentication timed out.')
      setView('method')
      whatsappApi.disconnect().catch(() => {})
    }, AUTH_TIMEOUT_MS)

    const onConnected = () => {
      if (didConnectRef.current || cancelled) return
      didConnectRef.current = true
      if (es) { try { es.close() } catch (_) {} ; es = null }
      clearTimeout(fallbackTimer)
      clearTimeout(timeoutTimer)
      setConnectionStep('connected')
      // Start profile fetch immediately (parallel to status refresh)
      fetchWaProfile()
      refreshSessionStatus().then(() => navigate('/dashboard'))
    }

    const startFallback = () => {
      if (fallbackTimer || cancelled) return
      const poll = () => {
        refreshSessionStatus().then(data => {
          if (cancelled) return
          if (data?.qr) { setQrCode(data.qr); setConnectionStep(s => s === 'launching' ? 'qr' : s) }
          if (data?.pairing_code) { setPairingCode(data.pairing_code); setConnectionStep(s => s === 'launching' ? 'qr' : s) }
          if (data?.status === 'connected') { onConnected(); return }
          if (!cancelled) fallbackTimer = setTimeout(poll, 1500)
        }).catch(() => { if (!cancelled) fallbackTimer = setTimeout(poll, 1500) })
      }
      fallbackTimer = setTimeout(poll, 1500)
    }

    es = new EventSource(whatsappApi.eventsUrl())

    es.onmessage = (evt) => {
      if (cancelled) return
      try {
        const data = JSON.parse(evt.data)
        const bs = data.bridge_status || data.status

        if (data.qr || data.pairing_code) {
          if (data.qr) setQrCode(data.qr)
          if (data.pairing_code) setPairingCode(data.pairing_code)
          setConnectionStep(s => s === 'launching' ? 'qr' : s)
        }
        if (data.type === 'authenticated') setConnectionStep('authenticated')
        if (bs === 'connected' || data.type === 'connected') onConnected()
        if (data.type === 'info' && data.message) setMessage(data.message)
        if ((data.type === 'disconnected' || data.type === 'error') && !didConnectRef.current) {
          setErrorMsg(data.message || data.reason || '❌ Unable to connect to WhatsApp. Please try again.')
          setView('method')
        }
      } catch (_) {}
    }

    es.onerror = () => {
      if (es) { try { es.close() } catch (_) {} ; es = null }
      startFallback()
    }

    return () => {
      cancelled = true
      if (es) { try { es.close() } catch (_) {} }
      clearTimeout(fallbackTimer)
      clearTimeout(timeoutTimer)
    }
  }, [view]) // eslint-disable-line react-hooks/exhaustive-deps

  const handleSelectMethod = (id) => {
    setConnectionType(id)
    setView('form')
    setMessage('')
    setErrorMsg('')
  }

  const handleConnect = async (e) => {
    if (e) e.preventDefault()

    // Bridge requires a real phone number — validate + auto-prefix the
    // country code before ever hitting the network.
    let normalizedPhone = phone
    if (connectionType === 'bridge') {
      normalizedPhone = normalizePhone(phone)
      if (!PHONE_RE.test(normalizedPhone)) {
        setErrorMsg('❌ Invalid phone number.')
        return
      }
      setPhone(normalizedPhone)
    } else if (phone) {
      normalizedPhone = normalizePhone(phone)
    }

    setConnecting(true)
    setMessage('')
    setErrorMsg('')
    setQrCode(null)
    setPairingCode(null)
    setConnectionStep('launching')
    // Tell AppContext that THIS browser is initiating a new connection so it can
    // lock wa_active_phone to the resulting account (browser-session isolation).
    markConnectionInitiated()

    const config = {
      connection_type: connectionType,
      phone: normalizedPhone || undefined,
      link_method: connectionType === 'bridge' ? bridgeLinkMethod : undefined,
      meta_token: connectionType === 'meta' ? metaToken : undefined,
      meta_phone_number_id: connectionType === 'meta' ? metaPhoneNumberId : undefined,
      meta_business_account_id: connectionType === 'meta' ? metaBusinessAccountId : undefined
    }

    try {
      const res = await whatsappApi.connect(config)
      if (res.data?.qr) setQrCode(res.data.qr)
      if (res.data?.pairing_code) setPairingCode(res.data.pairing_code)

      if (res.data?.status === 'connected') {
        didConnectRef.current = true
        await refreshSessionStatus()
        navigate('/dashboard')
        return
      } else {
        setMessage(res.data.message || 'Connecting... Please wait.')
        setView('connecting')
        await refreshSessionStatus()
      }
    } catch (err) {
      if (!err.response) {
        setErrorMsg('Cannot reach the backend server. Make sure the service is running and try again.')
        setBackendOk(false)
      } else {
        setErrorMsg(getErrorMessage(err, 'Connection failed.'))
      }
    } finally {
      setConnecting(false)
    }
  }

  const handleCancel = async () => {
    setConnecting(true)
    setMessage('Cancelling session... Please wait.')
    setErrorMsg('')
    try {
      await whatsappApi.disconnect()
    } catch (e) {
      console.error(e)
    }
    setQrCode(null)
    setPairingCode(null)
    setMessage('')
    setErrorMsg('')
    setView('method')
    setConnecting(false)
    await refreshSessionStatus()
  }

  return (
    <div style={{
      minHeight: '100vh',
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'center',
      background: 'radial-gradient(circle at center, #1a202c 0%, #0d1117 100%)',
      padding: 20,
      position: 'relative',
      overflow: 'hidden'
    }}>
      {/* Subtle static gradient accent — no blur, no compositing cost */}
      <div style={{ position: 'absolute', inset: 0, background: 'radial-gradient(ellipse 60% 40% at 20% 20%, rgba(37,211,102,0.05) 0%, transparent 70%)', pointerEvents: 'none' }} />

      {/* Backend status banner */}
      {backendOk === false && (
        <div style={{ position: 'fixed', top: 16, left: '50%', transform: 'translateX(-50%)', zIndex: 999, background: 'rgba(255,77,79,0.15)', border: '1px solid rgba(255,77,79,0.5)', borderRadius: 10, padding: '10px 20px', display: 'flex', alignItems: 'center', gap: 10, fontSize: 13, color: '#ff4d4f', backdropFilter: 'blur(8px)', whiteSpace: 'nowrap' }}>
          <span style={{ fontSize: 16 }}>⚠</span>
          Backend server is not reachable — check that the service is running on port 7001
        </div>
      )}

      {/* ── SPLASH ── */}
      {view === 'splash' && (
        <div className="splash-card">
          <div className="logo-container">
            <div className="logo-pulse-ring" />
            <div className="logo-icon-bg">
              <MessageSquare className="logo-message" size={32} />
              <Zap className="logo-zap" size={20} />
            </div>
          </div>
          <div className="splash-text">
            <h1 className="splash-title">WHATSAPP <span style={{ color: 'var(--accent-primary)' }}>AUTOMATE</span></h1>
            <p className="splash-subtitle">Scale Your Communication Effortlessly</p>
            <p className="splash-description">Connect your account to schedule campaigns, build visual bot responders, and view live chat logs from a single unified workspace.</p>
          </div>
          <button type="button" className="splash-btn" onClick={() => setView('method')}>Get Started &amp; Link Device &rarr;</button>
        </div>
      )}

      {/* ── METHOD PICKER ── */}
      {view === 'method' && (
        <div className="portal-card">
          <div style={{ textAlign: 'center', marginBottom: 24 }}>
            <div className="portal-icon"><Lock size={20} /></div>
            <h2 className="portal-title">Choose Connection Method</h2>
            <p className="portal-subtitle">Select how you want to connect your WhatsApp account</p>
          </div>

          <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
            {CONNECTION_METHODS.map(m => (
              <button
                key={m.id}
                className="method-card"
                onClick={() => handleSelectMethod(m.id)}
              >
                <div className="method-icon">{m.icon}</div>
                <div style={{ flex: 1, textAlign: 'left' }}>
                  <div style={{ fontSize: 13, fontWeight: 600, color: '#fff' }}>{m.title}</div>
                  <div style={{ fontSize: 11, color: 'var(--text-muted)', marginTop: 2 }}>{m.desc}</div>
                </div>
                <span style={{ color: 'var(--text-muted)', fontSize: 18 }}>›</span>
              </button>
            ))}
          </div>

          <div style={{ marginTop: 20, borderTop: '1px solid rgba(255,255,255,0.06)', paddingTop: 16 }}>
            <button className="btn btn-secondary" onClick={() => setView('splash')} style={{ width: '100%', background: 'rgba(255,255,255,0.03)', border: '1px solid rgba(255,255,255,0.05)', color: 'var(--text-secondary)' }}>
              <ChevronLeft size={14} /> Back
            </button>
          </div>
        </div>
      )}

      {/* ── CONNECTION FORM ── */}
      {view === 'form' && (
        <div className="portal-card">
          <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 20 }}>
            <button className="btn btn-ghost btn-icon btn-sm" onClick={() => setView('method')} style={{ color: 'var(--text-muted)' }}>
              <ChevronLeft size={16} />
            </button>
            <div>
              <h2 style={{ fontSize: 18, fontWeight: 700, color: '#fff', margin: 0 }}>
                {CONNECTION_METHODS.find(m => m.id === connectionType)?.title}
              </h2>
              <p style={{ fontSize: 11, color: 'var(--text-muted)', margin: 0 }}>
                {CONNECTION_METHODS.find(m => m.id === connectionType)?.desc}
              </p>
            </div>
          </div>

          {errorMsg && !errorMsg.toLowerCase().includes('not authenticated') ? (
            <div style={{ background: 'rgba(239,68,68,0.1)', border: '1px solid rgba(239,68,68,0.3)', borderRadius: 'var(--radius-md)', padding: '12px 14px', marginBottom: 16, fontSize: 'var(--font-size-xs)', color: 'var(--accent-rose)', display: 'flex', alignItems: 'center', gap: 8 }}>
              <span style={{ fontSize: 14 }}>❌</span>
              <span>{errorMsg}</span>
            </div>
          ) : (
            <div style={{ background: 'rgba(37, 211, 102, 0.06)', border: '1px solid rgba(37, 211, 102, 0.25)', borderRadius: 'var(--radius-md)', padding: '12px 14px', marginBottom: 16, fontSize: 'var(--font-size-xs)', color: 'var(--accent-primary)', display: 'flex', alignItems: 'center', gap: 8 }}>
              <span style={{ display: 'inline-block', width: 6, height: 6, borderRadius: '50%', background: 'var(--accent-primary)', animation: 'pulse-ring 2.5s infinite' }} />
              <span>Ready to connect your WhatsApp account.</span>
            </div>
          )}

          {/* ── BRIDGE FORM ── */}
          {connectionType === 'bridge' && (
            <form onSubmit={handleConnect} style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
              <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
                <div
                  className={`link-method-card ${bridgeLinkMethod === 'qr' ? 'active' : ''}`}
                  onClick={() => setBridgeLinkMethod('qr')}
                >
                  <div className="link-method-icon-container"><QrCode size={18} /></div>
                  <div style={{ flex: 1, textAlign: 'left' }}>
                    <div style={{ fontSize: 13, fontWeight: 600, color: '#fff' }}>Scan QR Code</div>
                    <div style={{ fontSize: 11, color: 'var(--text-muted)', marginTop: 2 }}>Link instantly using your phone's camera</div>
                  </div>
                  <div className="link-method-radio"><div className="link-method-radio-inner" /></div>
                </div>

                <div
                  className={`link-method-card ${bridgeLinkMethod === 'otp' ? 'active' : ''}`}
                  onClick={() => setBridgeLinkMethod('otp')}
                >
                  <div className="link-method-icon-container"><Key size={18} /></div>
                  <div style={{ flex: 1, textAlign: 'left' }}>
                    <div style={{ fontSize: 13, fontWeight: 600, color: '#fff' }}>Pairing Code (OTP)</div>
                    <div style={{ fontSize: 11, color: 'var(--text-muted)', marginTop: 2 }}>Link using an 8-character pairing code</div>
                  </div>
                  <div className="link-method-radio"><div className="link-method-radio-inner" /></div>
                </div>
              </div>

              <div className="form-group">
                <label className="form-label" style={{ fontSize: 'var(--font-size-xs)' }}>
                  {bridgeLinkMethod === 'qr'
                    ? 'Verification Phone Number * (must match scanned account, with country code: +91xxxxxxxxxx)'
                    : 'WhatsApp Phone Number * (to generate pairing code, with country code: +91xxxxxxxxxx)'}
                </label>
                <input
                  type="text"
                  className="form-input"
                  placeholder="+91xxxxxxxxxx"
                  value={phone}
                  onChange={e => setPhone(e.target.value)}
                  required
                  style={{ height: 38 }}
                />
              </div>

              <div style={{ display: 'flex', gap: 6, alignItems: 'flex-start', fontSize: 11, color: 'var(--text-muted)', lineHeight: 1.4 }}>
                <HelpCircle size={13} style={{ flexShrink: 0, marginTop: 1 }} />
                <span>{bridgeLinkMethod === 'qr'
                  ? 'Open WhatsApp → Linked Devices → scan the QR code shown next.'
                  : 'Open WhatsApp → Linked Devices → Link a Device → Link with phone number instead.'}</span>
              </div>

              <button type="submit" className="btn btn-primary" disabled={connecting} style={{ height: 40 }}>
                {connecting
                  ? <><RefreshCw size={15} style={{ animation: 'spin 1s linear infinite' }} /> Starting...</>
                  : bridgeLinkMethod === 'qr' ? 'Show QR Code' : 'Get Pairing Code'}
              </button>
            </form>
          )}

          {/* ── META FORM ── */}
          {connectionType === 'meta' && (
            <form onSubmit={handleConnect} style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
              <div className="form-group">
                <label className="form-label" style={{ fontSize: 'var(--font-size-xs)' }}>Meta Access Token *</label>
                <input type="text" className="form-input" placeholder="EAAxxxxx..." value={metaToken} onChange={e => setMetaToken(e.target.value)} required style={{ height: 38 }} />
              </div>
              <div className="form-group">
                <label className="form-label" style={{ fontSize: 'var(--font-size-xs)' }}>Phone Number ID *</label>
                <input type="text" className="form-input" placeholder="1234567890" value={metaPhoneNumberId} onChange={e => setMetaPhoneNumberId(e.target.value)} required style={{ height: 38 }} />
              </div>
              <div className="form-group">
                <label className="form-label" style={{ fontSize: 'var(--font-size-xs)' }}>Business Account ID *</label>
                <input type="text" className="form-input" placeholder="0987654321" value={metaBusinessAccountId} onChange={e => setMetaBusinessAccountId(e.target.value)} required style={{ height: 38 }} />
              </div>
              <div className="form-group">
                <label className="form-label" style={{ fontSize: 'var(--font-size-xs)' }}>Verified Phone Number (with country code)</label>
                <input type="text" className="form-input" placeholder="+91xxxxxx" value={phone} onChange={e => setPhone(e.target.value)} style={{ height: 38 }} />
              </div>
              <div style={{ display: 'flex', gap: 6, alignItems: 'flex-start', fontSize: 11, color: 'var(--text-muted)', lineHeight: 1.4 }}>
                <HelpCircle size={13} style={{ flexShrink: 0, marginTop: 1 }} />
                <span>Credentials from your Meta for Developers app with WhatsApp Business API enabled.</span>
              </div>
              <button type="submit" className="btn btn-primary" disabled={connecting} style={{ height: 40 }}>
                {connecting ? <><RefreshCw size={15} style={{ animation: 'spin 1s linear infinite' }} /> Connecting...</> : 'Connect Meta API'}
              </button>
            </form>
          )}

          {/* ── DEV FORM ── */}
          {connectionType === 'dev' && (
            <form onSubmit={handleConnect} style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
              <div style={{ background: 'rgba(251,191,36,0.08)', border: '1px solid rgba(251,191,36,0.25)', borderRadius: 'var(--radius-md)', padding: '12px 14px', fontSize: 12, color: '#fbbf24', lineHeight: 1.5 }}>
                <strong>Development mode only.</strong> This bypasses the real WhatsApp connection and creates a simulated session for local testing. Do not use in production.
              </div>
              <div className="form-group">
                <label className="form-label" style={{ fontSize: 'var(--font-size-xs)' }}>Dev Phone Number (optional)</label>
                <input type="text" className="form-input" placeholder="+91xxxxxx (optional)" value={phone} onChange={e => setPhone(e.target.value)} style={{ height: 38 }} />
              </div>
              <button type="submit" className="btn btn-primary" disabled={connecting} style={{ height: 40 }}>
                {connecting ? <><RefreshCw size={15} style={{ animation: 'spin 1s linear infinite' }} /> Starting...</> : 'Start Dev Session'}
              </button>
            </form>
          )}
        </div>
      )}

      {/* ── CONNECTING / QR / PAIRING CODE VIEW ── */}
      {view === 'connecting' && (() => {
        const stepOrder = ['launching', 'qr', 'authenticated', 'connected']
        const stepIdx = stepOrder.indexOf(connectionStep)
        const isDone = (s) => stepOrder.indexOf(s) < stepIdx
        const isActive = (s) => s === connectionStep

        return (
          <div className="portal-card" style={{ alignItems: 'center', gap: 20 }}>
            {/* Header */}
            <div style={{ textAlign: 'center', width: '100%' }}>
              <h2 style={{ fontSize: 18, fontWeight: 700, color: '#fff', margin: '0 0 4px' }}>Connecting WhatsApp</h2>
              <p style={{ fontSize: 12, color: 'var(--text-muted)', margin: 0, fontWeight: 500 }}>
                {connectionStep === 'launching' && 'Generating QR Code...'}
                {connectionStep === 'qr' && (pairingCode ? 'Pairing code ready — enter in WhatsApp' : 'Waiting for QR Scan...')}
                {connectionStep === 'authenticated' && 'Device authorized — completing login...'}
                {connectionStep === 'connected' && '🟢 Connected Successfully'}
              </p>
            </div>

            {message && (
              <div style={{ background: 'rgba(255,255,255,0.04)', border: '1px solid rgba(255,255,255,0.08)', borderRadius: 'var(--radius-md)', padding: '8px 12px', fontSize: 'var(--font-size-xs)', color: 'var(--text-secondary)', width: '100%', textAlign: 'center' }}>
                {message}
              </div>
            )}

            {/* Progress Steps */}
            <div style={{ width: '100%', display: 'flex', flexDirection: 'column', gap: 8 }}>
              {[
                { id: 'launching',     label: 'Generating QR Code' },
                { id: 'qr',           label: pairingCode ? 'Pairing code ready' : 'Waiting for QR Scan' },
                { id: 'authenticated', label: 'Device authorized' },
                { id: 'connected',     label: 'Connected Successfully' },
              ].map(step => (
                <div key={step.id} className={`conn-step ${isDone(step.id) ? 'done' : isActive(step.id) ? 'active' : 'pending'}`}>
                  <div className="conn-step-icon">
                    {isDone(step.id)
                      ? <span style={{ fontSize: 11 }}>✓</span>
                      : isActive(step.id)
                        ? <RefreshCw size={11} style={{ animation: 'spin 1.2s linear infinite' }} />
                        : <span style={{ width: 8, height: 8, borderRadius: '50%', background: 'rgba(255,255,255,0.12)', display: 'block' }} />}
                  </div>
                  <span className="conn-step-label">{step.label}</span>
                </div>
              ))}
            </div>

            {/* QR Code */}
            {(qrCode || sessionStatus.qr) && (connectionStep === 'qr') && !pairingCode && (
              <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 10 }}>
                <div style={{ background: '#fff', padding: 10, borderRadius: 'var(--radius-md)', width: 196, height: 196, display: 'flex', alignItems: 'center', justifyContent: 'center', boxShadow: '0 4px 12px rgba(0,0,0,0.3)' }}>
                  <img src={`data:image/png;base64,${qrCode || sessionStatus.qr}`} alt="WhatsApp QR Code" style={{ width: '100%', height: '100%' }} />
                </div>
                <p style={{ fontSize: 12, color: 'var(--text-muted)', textAlign: 'center', margin: 0 }}>
                  Open WhatsApp &rarr; <strong style={{ color: 'var(--text-secondary)' }}>Linked Devices</strong> &rarr; scan
                </p>
              </div>
            )}

            {/* Pairing Code */}
            {(pairingCode || sessionStatus.pairing_code) && connectionStep === 'qr' && (
              <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 12, width: '100%' }}>
                <div style={{ fontSize: 32, fontWeight: 800, color: 'var(--accent-primary)', letterSpacing: 4, background: 'var(--bg-secondary)', padding: '12px 24px', borderRadius: 'var(--radius-md)', border: '1px dashed var(--accent-primary)', fontFamily: 'monospace', textAlign: 'center' }}>
                  {pairingCode || sessionStatus.pairing_code}
                </div>
                <div style={{ fontSize: 'var(--font-size-xs)', color: 'var(--text-secondary)', textAlign: 'left', lineHeight: 1.6, background: 'rgba(255,255,255,0.02)', padding: 12, borderRadius: 'var(--radius-sm)', border: '1px solid var(--border-primary)', width: '100%' }}>
                  <strong>How to use pairing code:</strong>
                  <ol style={{ margin: '6px 0 0 16px', padding: 0 }}>
                    <li>Open WhatsApp on your phone</li>
                    <li>Settings &rarr; Linked Devices &rarr; Link a Device</li>
                    <li>Tap <strong>Link with phone number instead</strong></li>
                    <li>Enter the 8-character code shown above</li>
                  </ol>
                </div>
              </div>
            )}

            {errorMsg && !errorMsg.toLowerCase().includes('not authenticated') && (
              <div style={{ background: 'rgba(239,68,68,0.1)', border: '1px solid rgba(239,68,68,0.3)', borderRadius: 'var(--radius-md)', padding: '10px 12px', fontSize: 'var(--font-size-xs)', color: 'var(--accent-rose)', width: '100%' }}>
                {errorMsg}
              </div>
            )}

            <button
              className="btn btn-secondary"
              onClick={handleCancel}
              disabled={connecting}
              style={{ width: '100%', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 6 }}
            >
              {connecting
                ? <><RefreshCw size={14} style={{ animation: 'spin 1s linear infinite' }} /> Cancelling…</>
                : 'Cancel & Start Over'}
            </button>
          </div>
        )
      })()}

      <style>{`
        @keyframes spin { to { transform: rotate(360deg); } }
        @keyframes pulse-ring { 0%,100% { opacity: 0.5; transform: scale(1); } 50% { opacity: 1; transform: scale(1.08); } }
        @keyframes fade-in { from { opacity:0; transform:translateY(10px); } to { opacity:1; transform:translateY(0); } }

        .splash-card {
          width: 100%; max-width: 440px;
          background: #161b22;
          border: 1px solid rgba(255,255,255,0.08);
          border-radius: var(--radius-lg);
          padding: 48px 36px;
          box-shadow: 0 4px 16px rgba(0,0,0,0.5);
          z-index: 10;
          display: flex; flex-direction: column; align-items: center; gap: 28px;
          text-align: center;
          animation: fade-in 0.25s ease forwards;
        }
        .logo-container { position: relative; width: 90px; height: 90px; display: flex; align-items: center; justify-content: center; }
        .logo-pulse-ring { position: absolute; width: 100%; height: 100%; border-radius: 50%; border: 2px solid rgba(37,211,102,0.35); animation: pulse-ring 2.5s ease-in-out infinite; will-change: transform, opacity; }
        .logo-icon-bg { width: 72px; height: 72px; background: linear-gradient(135deg,#10b981 0%,#059669 100%); border-radius: 20px; display: flex; align-items: center; justify-content: center; color: #fff; position: relative; }
        .logo-message { }
        .logo-zap { position: absolute; bottom: 12px; right: 12px; color: #fbbf24; fill: #fbbf24; }
        .splash-text { display: flex; flex-direction: column; gap: 8px; }
        .splash-title { font-size: 24px; font-weight: 800; color: #fff; letter-spacing: 2px; margin: 0; }
        .splash-subtitle { font-size: 14px; font-weight: 500; color: var(--accent-primary); margin: 0; }
        .splash-description { font-size: 13px; color: var(--text-muted); line-height: 1.6; margin: 10px 0 0; }
        .splash-btn { width: 100%; height: 44px; background: var(--accent-primary); border: none; border-radius: var(--radius-md); color: #000; font-size: 14px; font-weight: 700; letter-spacing: 0.5px; cursor: pointer; transition: opacity 0.15s; display: flex; align-items: center; justify-content: center; }
        .splash-btn:hover { opacity: 0.88; }

        .portal-card {
          width: 100%; max-width: 440px;
          background: #161b22;
          border: 1px solid rgba(255,255,255,0.08);
          border-radius: var(--radius-lg);
          padding: 30px 24px;
          box-shadow: 0 4px 12px rgba(0,0,0,0.4);
          z-index: 10;
          display: flex; flex-direction: column; gap: 0;
          animation: fade-in 0.2s ease forwards;
        }
        .portal-icon { width: 48px; height: 48px; border-radius: 50%; background: var(--accent-primary-muted); color: var(--accent-primary); display: flex; align-items: center; justify-content: center; margin: 0 auto 12px; border: 1px solid rgba(37,211,102,0.2); }
        .portal-title { font-size: 20px; font-weight: 700; color: #fff; margin: 0 0 4px; }
        .portal-subtitle { font-size: var(--font-size-xs); color: var(--text-muted); margin: 0; }

        .method-card { display: flex; align-items: center; gap: 14px; padding: 14px 16px; border: 1px solid var(--border-primary); background: rgba(255,255,255,0.02); border-radius: var(--radius-md); cursor: pointer; transition: border-color 0.15s; width: 100%; text-align: left; }
        .method-card:hover { border-color: var(--accent-primary); }
        .method-icon { width: 40px; height: 40px; border-radius: 50%; background: rgba(255,255,255,0.05); display: flex; align-items: center; justify-content: center; color: var(--accent-primary); flex-shrink: 0; }

        .link-method-card { border: 1px solid var(--border-primary); background: rgba(255,255,255,0.02); border-radius: var(--radius-md); padding: 14px 16px; cursor: pointer; transition: border-color 0.15s; display: flex; align-items: center; gap: 14px; user-select: none; }
        .link-method-card:hover { border-color: rgba(255,255,255,0.15); }
        .link-method-card.active { border-color: var(--accent-primary); background: rgba(37,211,102,0.04); }
        .link-method-icon-container { width: 38px; height: 38px; border-radius: 50%; background: rgba(255,255,255,0.05); display: flex; align-items: center; justify-content: center; color: var(--text-secondary); }
        .link-method-card.active .link-method-icon-container { background: var(--accent-primary-muted); color: var(--accent-primary); }
        .link-method-radio { width: 18px; height: 18px; border-radius: 50%; border: 2px solid var(--border-primary); display: flex; align-items: center; justify-content: center; }
        .link-method-card.active .link-method-radio { border-color: var(--accent-primary); }
        .link-method-radio-inner { width: 10px; height: 10px; border-radius: 50%; background: transparent; }
        .link-method-card.active .link-method-radio-inner { background: var(--accent-primary); }

        /* Connection progress steps */
        .conn-step { display: flex; align-items: center; gap: 10px; padding: 9px 12px; border-radius: var(--radius-sm); border: 1px solid transparent; transition: all 0.2s; }
        .conn-step.done   { border-color: rgba(37,211,102,0.2); background: rgba(37,211,102,0.05); }
        .conn-step.active { border-color: rgba(37,211,102,0.4); background: rgba(37,211,102,0.1); }
        .conn-step.pending { border-color: rgba(255,255,255,0.05); background: rgba(255,255,255,0.02); }
        .conn-step-icon { width: 22px; height: 22px; border-radius: 50%; display: flex; align-items: center; justify-content: center; flex-shrink: 0; }
        .conn-step.done   .conn-step-icon { background: var(--accent-primary); color: #000; }
        .conn-step.active .conn-step-icon { background: rgba(37,211,102,0.2); color: var(--accent-primary); }
        .conn-step.pending .conn-step-icon { background: rgba(255,255,255,0.05); color: transparent; }
        .conn-step-label { font-size: 13px; font-weight: 500; }
        .conn-step.done   .conn-step-label { color: var(--accent-primary); }
        .conn-step.active .conn-step-label { color: #fff; }
        .conn-step.pending .conn-step-label { color: var(--text-muted); }

      `}</style>
    </div>
  )
}
