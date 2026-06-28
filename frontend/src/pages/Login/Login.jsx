import { useState, useEffect } from 'react'
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
  const [phone, setPhone] = useState(() => localStorage.getItem('wa_last_phone') || '')
  const [metaToken, setMetaToken] = useState('')
  const [metaPhoneNumberId, setMetaPhoneNumberId] = useState('')
  const [metaBusinessAccountId, setMetaBusinessAccountId] = useState('')

  const [connecting, setConnecting] = useState(false)
  const [qrCode, setQrCode] = useState(null)
  const [pairingCode, setPairingCode] = useState(null)
  const [message, setMessage] = useState('')
  const [errorMsg, setErrorMsg] = useState('')
  const [backendOk, setBackendOk] = useState(null) // null=checking, true, false

  // Redirect to dashboard as soon as WhatsApp is connected
  useEffect(() => {
    if (sessionStatus.status === 'connected') {
      navigate('/dashboard')
    }
  }, [sessionStatus.status, navigate])

  // Backend connectivity check
  useEffect(() => {
    let cancelled = false
    const check = () => {
      healthApi.check()
        .then(() => { if (!cancelled) setBackendOk(true) })
        .catch(() => { if (!cancelled) setBackendOk(false) })
    }
    check()
    const iv = setInterval(check, 10000)
    return () => { cancelled = true; clearInterval(iv) }
  }, [])

  // Poll status while connecting
  useEffect(() => {
    let interval = null
    if (sessionStatus.status === 'connecting') {
      interval = setInterval(() => {
        refreshSessionStatus().then(data => {
          if (data?.qr) setQrCode(data.qr)
          else setQrCode(null)
          if (data?.pairing_code) setPairingCode(data.pairing_code)
          else setPairingCode(null)
        }).catch(() => {})
      }, 3000)
    }
    return () => { if (interval) clearInterval(interval) }
  }, [sessionStatus.status, refreshSessionStatus])

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
    if (phone) localStorage.setItem('wa_last_phone', phone)

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
        setMessage(res.data.message || 'Connected successfully!')
        await refreshSessionStatus()
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
    try {
      await whatsappApi.disconnect()
      await refreshSessionStatus()
    } catch {}
    setQrCode(null)
    setPairingCode(null)
    setMessage('')
    setErrorMsg('')
    setView('form')
  }

  const isConnecting = sessionStatus.status === 'connecting'

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
      {/* Ambient blobs */}
      <div style={{ position: 'absolute', width: 400, height: 400, background: 'rgba(37,211,102,0.08)', filter: 'blur(100px)', borderRadius: '50%', top: '10%', left: '10%', pointerEvents: 'none' }} />
      <div style={{ position: 'absolute', width: 300, height: 300, background: 'rgba(139,92,246,0.08)', filter: 'blur(80px)', borderRadius: '50%', bottom: '10%', right: '10%', pointerEvents: 'none' }} />

      {/* Backend status banner */}
      {backendOk === false && (
        <div style={{ position: 'fixed', top: 16, left: '50%', transform: 'translateX(-50%)', zIndex: 999, background: 'rgba(255,77,79,0.15)', border: '1px solid rgba(255,77,79,0.5)', borderRadius: 10, padding: '10px 20px', display: 'flex', alignItems: 'center', gap: 10, fontSize: 13, color: '#ff4d4f', backdropFilter: 'blur(8px)', whiteSpace: 'nowrap' }}>
          <span style={{ fontSize: 16 }}>⚠</span>
          Backend server is not reachable — check that the service is running on port 7001
        </div>
      )}

      {/* ── SPLASH ── */}
      {view === 'splash' && (
        <div className="splash-card" onClick={() => setView('method')}>
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
          <button className="splash-btn">Get Started &amp; Link Device &rarr;</button>
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

          <button className="btn btn-secondary" onClick={() => setView('splash')} style={{ width: '100%', marginTop: 16, background: 'rgba(255,255,255,0.03)', border: '1px solid rgba(255,255,255,0.05)', color: 'var(--text-secondary)' }}>
            <ChevronLeft size={14} /> Back
          </button>
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
                    ? 'Verification Phone Number * (must match scanned account, with country code: +91xxxxxx)'
                    : 'WhatsApp Phone Number * (to generate pairing code, with country code: +91xxxxxx)'}
                </label>
                <input
                  type="text"
                  className="form-input"
                  placeholder="+91xxxxxx"
                  value={phone}
                  onChange={e => setPhone(e.target.value)}
                  required
                  style={{ height: 38 }}
                />
              </div>

              <div style={{ display: 'flex', gap: 6, alignItems: 'flex-start', fontSize: 11, color: 'var(--text-muted)', lineHeight: 1.4 }}>
                <HelpCircle size={13} style={{ flexShrink: 0, marginTop: 1 }} />
                <span>Requires the whatsapp-bridge Node process running on port 7002.</span>
              </div>

              <button type="submit" className="btn btn-primary" disabled={connecting} style={{ height: 40 }}>
                {connecting ? <><RefreshCw size={15} style={{ animation: 'spin 1s linear infinite' }} /> Starting...</> : 'Link WhatsApp Account'}
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
      {(view === 'connecting' || (isConnecting && view !== 'form')) && (
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

          <button className="btn btn-secondary" onClick={handleCancel} style={{ width: '100%' }}>
            Cancel &amp; Start Over
          </button>
        </div>
      )}

      <style>{`
        @keyframes spin { to { transform: rotate(360deg); } }
        @keyframes float { 0%,100% { transform: translateY(0); } 50% { transform: translateY(-6px); } }
        @keyframes pulse-glow {
          0% { transform: scale(0.95); opacity: 0.8; box-shadow: 0 0 0 0 rgba(37,211,102,0.4); }
          70% { transform: scale(1.05); opacity: 1; box-shadow: 0 0 0 12px rgba(37,211,102,0); }
          100% { transform: scale(0.95); opacity: 0.8; box-shadow: 0 0 0 0 rgba(37,211,102,0); }
        }
        @keyframes fade-in { from { opacity:0; transform:translateY(15px); } to { opacity:1; transform:translateY(0); } }

        .splash-card {
          width: 100%; max-width: 440px;
          background: rgba(22,27,34,0.75);
          border: 1px solid rgba(255,255,255,0.08);
          border-radius: var(--radius-lg);
          padding: 48px 36px;
          box-shadow: 0 20px 50px rgba(0,0,0,0.6), inset 0 1px 0 rgba(255,255,255,0.1);
          backdrop-filter: blur(20px);
          z-index: 10;
          display: flex; flex-direction: column; align-items: center; gap: 28px;
          text-align: center; cursor: pointer;
          animation: fade-in 0.6s cubic-bezier(0.16,1,0.3,1) forwards;
          transition: transform 0.3s ease, border-color 0.3s ease, box-shadow 0.3s ease;
        }
        .splash-card:hover { transform: translateY(-4px); border-color: rgba(37,211,102,0.3); box-shadow: 0 30px 60px rgba(0,0,0,0.8), 0 0 30px rgba(37,211,102,0.1); }
        .logo-container { position: relative; width: 90px; height: 90px; display: flex; align-items: center; justify-content: center; animation: float 4s ease-in-out infinite; }
        .logo-pulse-ring { position: absolute; width: 100%; height: 100%; border-radius: 50%; border: 2px solid rgba(37,211,102,0.3); animation: pulse-glow 2.5s infinite; }
        .logo-icon-bg { width: 72px; height: 72px; background: linear-gradient(135deg,#10b981 0%,#059669 100%); border-radius: 20px; display: flex; align-items: center; justify-content: center; color: #fff; position: relative; box-shadow: 0 10px 25px rgba(16,185,129,0.4); }
        .logo-message { filter: drop-shadow(0 2px 4px rgba(0,0,0,0.15)); }
        .logo-zap { position: absolute; bottom: 12px; right: 12px; color: #fbbf24; fill: #fbbf24; filter: drop-shadow(0 2px 6px rgba(251,191,36,0.6)); }
        .splash-text { display: flex; flex-direction: column; gap: 8px; }
        .splash-title { font-size: 24px; font-weight: 800; color: #fff; letter-spacing: 2px; margin: 0; text-shadow: 0 4px 10px rgba(0,0,0,0.3); }
        .splash-subtitle { font-size: 14px; font-weight: 500; color: var(--accent-primary); margin: 0; }
        .splash-description { font-size: 13px; color: var(--text-muted); line-height: 1.6; margin: 10px 0 0; }
        .splash-btn { width: 100%; height: 44px; background: linear-gradient(135deg,var(--accent-primary) 0%,#15803d 100%); border: none; border-radius: var(--radius-md); color: #000; font-size: 14px; font-weight: 700; letter-spacing: 0.5px; cursor: pointer; box-shadow: 0 4px 15px rgba(37,211,102,0.3); transition: all 0.2s ease; display: flex; align-items: center; justify-content: center; }
        .splash-card:hover .splash-btn { transform: scale(1.02); box-shadow: 0 6px 20px rgba(37,211,102,0.5); background: linear-gradient(135deg,#4ade80 0%,#16a34a 100%); }

        .portal-card {
          width: 100%; max-width: 440px;
          background: rgba(22,27,34,0.75);
          border: 1px solid rgba(255,255,255,0.08);
          border-radius: var(--radius-lg);
          padding: 30px 24px;
          box-shadow: 0 8px 32px rgba(0,0,0,0.5);
          backdrop-filter: blur(12px);
          z-index: 10;
          display: flex; flex-direction: column; gap: 0;
          animation: fade-in 0.35s cubic-bezier(0.16,1,0.3,1) forwards;
        }
        .portal-icon { width: 48px; height: 48px; border-radius: 50%; background: var(--accent-primary-muted); color: var(--accent-primary); display: flex; align-items: center; justify-content: center; margin: 0 auto 12px; border: 1px solid rgba(37,211,102,0.2); }
        .portal-title { font-size: 20px; font-weight: 700; color: #fff; margin: 0 0 4px; }
        .portal-subtitle { font-size: var(--font-size-xs); color: var(--text-muted); margin: 0; }

        .method-card { display: flex; align-items: center; gap: 14px; padding: 14px 16px; border: 1px solid var(--border-primary); background: rgba(255,255,255,0.02); border-radius: var(--radius-md); cursor: pointer; transition: all 0.2s ease; width: 100%; text-align: left; }
        .method-card:hover { border-color: var(--accent-primary); background: rgba(37,211,102,0.04); }
        .method-icon { width: 40px; height: 40px; border-radius: 50%; background: rgba(255,255,255,0.05); display: flex; align-items: center; justify-content: center; color: var(--accent-primary); flex-shrink: 0; }

        .link-method-card { border: 1px solid var(--border-primary); background: rgba(255,255,255,0.02); border-radius: var(--radius-md); padding: 14px 16px; cursor: pointer; transition: all 0.25s cubic-bezier(0.16,1,0.3,1); display: flex; align-items: center; gap: 14px; user-select: none; }
        .link-method-card:hover { border-color: rgba(255,255,255,0.15); background: rgba(255,255,255,0.04); }
        .link-method-card.active { border-color: var(--accent-primary); background: rgba(37,211,102,0.04); box-shadow: 0 0 15px rgba(37,211,102,0.05); }
        .link-method-icon-container { width: 38px; height: 38px; border-radius: 50%; background: rgba(255,255,255,0.05); display: flex; align-items: center; justify-content: center; color: var(--text-secondary); transition: all 0.25s; }
        .link-method-card.active .link-method-icon-container { background: var(--accent-primary-muted); color: var(--accent-primary); }
        .link-method-radio { width: 18px; height: 18px; border-radius: 50%; border: 2px solid var(--border-primary); display: flex; align-items: center; justify-content: center; transition: all 0.25s; }
        .link-method-card.active .link-method-radio { border-color: var(--accent-primary); }
        .link-method-radio-inner { width: 10px; height: 10px; border-radius: 50%; background: transparent; transition: all 0.25s; }
        .link-method-card.active .link-method-radio-inner { background: var(--accent-primary); }
      `}</style>
    </div>
  )
}
