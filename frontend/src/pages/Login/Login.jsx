import { useState, useEffect, useRef } from 'react'
import { useNavigate } from 'react-router-dom'
import {
  QrCode, RefreshCw, Key, HelpCircle, Lock,
  MessageSquare, Zap, Cpu, Cloud, Smartphone, ChevronLeft
} from 'lucide-react'
import { whatsappApi, healthApi } from '../../services/api'
import { useApp } from '../../context/AppContext'
import { getErrorMessage } from '../../utils/error'

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
  const { sessionStatus, refreshSessionStatus } = useApp()
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

  // Poll status only while the QR/pairing view is visible — prevents ghost polling when
  // the user returns to splash after pressing Back from the connecting screen
  useEffect(() => {
    if (view !== 'connecting') return
    const interval = setInterval(() => {
      refreshSessionStatus().then(data => {
        if (data?.status === 'connected') {
          didConnectRef.current = true
          navigate('/dashboard')
          return
        }
        setQrCode(data?.qr || null)
        setPairingCode(data?.pairing_code || null)
      }).catch(() => {})
    }, 2000)
    return () => clearInterval(interval)
  }, [view, refreshSessionStatus, navigate])

  const handleSelectMethod = (id) => {
    setConnectionType(id)
    setView('form')
    setMessage('')
    setErrorMsg('')
  }

  const handleConnect = async (e) => {
    if (e) e.preventDefault()
    setConnecting(true)
    setMessage('')
    setErrorMsg('')
    setQrCode(null)
    setPairingCode(null)

    const config = {
      connection_type: connectionType,
      phone: phone || undefined,
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

          {errorMsg && (
            <div style={{ background: 'rgba(239,68,68,0.1)', border: '1px solid rgba(239,68,68,0.3)', borderRadius: 'var(--radius-md)', padding: '10px 12px', marginBottom: 16, fontSize: 'var(--font-size-xs)', color: 'var(--accent-rose)' }}>
              {errorMsg}
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
      {view === 'connecting' && (
        <div className="portal-card" style={{ alignItems: 'center', gap: 20 }}>
          {message && (
            <div style={{ background: 'var(--accent-primary-muted)', border: '1px solid rgba(37,211,102,0.3)', borderRadius: 'var(--radius-md)', padding: '10px 12px', fontSize: 'var(--font-size-xs)', color: 'var(--accent-primary)', width: '100%' }}>
              {message}
            </div>
          )}
          {errorMsg && (
            <div style={{ background: 'rgba(239,68,68,0.1)', border: '1px solid rgba(239,68,68,0.3)', borderRadius: 'var(--radius-md)', padding: '10px 12px', fontSize: 'var(--font-size-xs)', color: 'var(--accent-rose)', width: '100%' }}>
              {errorMsg}
            </div>
          )}

          {pairingCode || sessionStatus.pairing_code ? (
            <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 14, width: '100%' }}>
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
          ) : qrCode || sessionStatus.qr ? (
            <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 14 }}>
              <div style={{ background: '#fff', padding: 12, borderRadius: 'var(--radius-md)', width: 200, height: 200, display: 'flex', alignItems: 'center', justifyContent: 'center', boxShadow: '0 4px 12px rgba(0,0,0,0.3)' }}>
                <img src={`data:image/png;base64,${qrCode || sessionStatus.qr}`} alt="WhatsApp QR Code" style={{ width: '100%', height: '100%' }} />
              </div>
              <div style={{ fontSize: 'var(--font-size-xs)', color: 'var(--text-secondary)', textAlign: 'center', lineHeight: 1.5 }}>
                Open WhatsApp &rarr; <strong>Linked Devices</strong> &rarr; scan the QR code above.
              </div>
            </div>
          ) : (
            <div style={{ textAlign: 'center', padding: '20px 0' }}>
              <RefreshCw size={36} color="var(--accent-primary)" style={{ margin: '0 auto 12px', animation: 'spin 1.5s linear infinite' }} />
              <p style={{ color: 'var(--text-muted)', fontSize: 'var(--font-size-sm)' }}>
                Initializing session... Please wait.
              </p>
            </div>
          )}

          <button
            className="btn btn-secondary"
            onClick={handleCancel}
            disabled={connecting}
            style={{ width: '100%', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 6 }}
          >
            {connecting ? (
              <><RefreshCw size={14} style={{ animation: 'spin 1s linear infinite' }} /> Cancelling...</>
            ) : (
              'Cancel & Start Over'
            )}
          </button>
        </div>
      )}

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

      `}</style>
    </div>
  )
}
