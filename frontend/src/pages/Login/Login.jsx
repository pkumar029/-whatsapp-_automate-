import { useState, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import { QrCode, Wifi, WifiOff, RefreshCw, Key, HelpCircle, Lock, MessageSquare, Zap } from 'lucide-react'
import { whatsappApi } from '../../services/api'
import { useApp } from '../../context/AppContext'
import { getErrorMessage } from '../../utils/error'

export default function Login() {
  const { sessionStatus, refreshSessionStatus, profile } = useApp()
  const navigate = useNavigate()
  const [showPortal, setShowPortal] = useState(false)

  const [connecting, setConnecting] = useState(false)
  const [qrCode, setQrCode] = useState(null)
  const [message, setMessage] = useState('')
  const [errorMsg, setErrorMsg] = useState('')

  const [phone, setPhone] = useState('')
  const [bridgeLinkMethod, setBridgeLinkMethod] = useState('qr') // qr or otp

  // Redirect if already connected
  useEffect(() => {
    if (sessionStatus.status === 'connected') {
      if (profile.isProfileConfigured) {
        navigate('/dashboard')
      } else {
        navigate('/settings', { state: { fromLogin: true } })
      }
    }
  }, [sessionStatus.status, profile.isProfileConfigured, navigate])

  // Poll status when connecting
  useEffect(() => {
    let interval = null
    if (sessionStatus.status === 'connecting') {
      interval = setInterval(() => {
        refreshSessionStatus().then(data => {
          if (data?.qr) {
            setQrCode(data.qr)
          } else {
            setQrCode(null)
          }
        }).catch(() => { })
      }, 3000)
    }
    return () => {
      if (interval) clearInterval(interval)
    }
  }, [sessionStatus.status, refreshSessionStatus])

  const handleConnect = async (e) => {
    if (e) e.preventDefault()
    setConnecting(true)
    setMessage('')
    setErrorMsg('')
    setQrCode(null)

    const config = {
      connection_type: 'bridge',
      phone: phone || undefined,
      link_method: bridgeLinkMethod
    }

    try {
      const res = await whatsappApi.connect(config)
      if (res.data?.qr) {
        setQrCode(res.data.qr)
      }
      
      if (res.data?.status === 'connected') {
        setMessage(res.data.message || 'Connected successfully!')
        await refreshSessionStatus()
      } else {
        setMessage(res.data.message || 'Connecting... Please wait.')
        await refreshSessionStatus()
      }
    } catch (err) {
      setErrorMsg(getErrorMessage(err, 'Connection failed.'))
    } finally {
      setConnecting(false)
    }
  }

  const handleCancelConnection = async () => {
    try {
      await whatsappApi.disconnect()
      await refreshSessionStatus()
      setQrCode(null)
      setMessage('')
      setErrorMsg('')
    } catch (err) {
      setErrorMsg('Failed to cancel connection.')
    }
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
      {/* Abstract decorative ambient blobs */}
      <div style={{
        position: 'absolute',
        width: 400,
        height: 400,
        background: 'rgba(37, 211, 102, 0.08)',
        filter: 'blur(100px)',
        borderRadius: '50%',
        top: '10%',
        left: '10%',
        pointerEvents: 'none'
      }} />
      <div style={{
        position: 'absolute',
        width: 300,
        height: 300,
        background: 'rgba(139, 92, 246, 0.08)',
        filter: 'blur(80px)',
        borderRadius: '50%',
        bottom: '10%',
        right: '10%',
        pointerEvents: 'none'
      }} />

      {!showPortal ? (
        /* ─── SPLASH SCREEN VIEW ─── */
        <div className="splash-card" onClick={() => setShowPortal(true)}>
          <div className="logo-container">
            <div className="logo-pulse-ring" />
            <div className="logo-icon-bg">
              <MessageSquare className="logo-message" size={32} />
              <Zap className="logo-zap" size={20} />
            </div>
          </div>

          <div className="splash-text">
            <h1 className="splash-title">
              WHATSAPP <span style={{ color: 'var(--accent-primary)' }}>AUTOMATE</span>
            </h1>
            <p className="splash-subtitle">
              Scale Your Communication Effortlessly
            </p>
            <p className="splash-description">
              Connect your account to schedule campaigns, build visual bot responders, and view live chat logs from a single unified workspace.
            </p>
          </div>

          <button className="splash-btn">
            Get Started & Link Device &rarr;
          </button>
        </div>
      ) : (
        /* ─── LINK PORTAL PANEL VIEW ─── */
        <div style={{
          width: '100%',
          maxWidth: 440,
          background: 'rgba(22, 27, 34, 0.75)',
          border: '1px solid rgba(255, 255, 255, 0.08)',
          borderRadius: 'var(--radius-lg)',
          padding: '30px 24px',
          boxShadow: '0 8px 32px rgba(0, 0, 0, 0.5)',
          backdropFilter: 'blur(12px)',
          zIndex: 10,
          display: 'flex',
          flexDirection: 'column',
          gap: 20
        }}>
          {/* Header */}
          <div style={{ textAlign: 'center' }}>
            <div style={{
              width: 48,
              height: 48,
              borderRadius: '50%',
              background: 'var(--accent-primary-muted)',
              color: 'var(--accent-primary)',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              margin: '0 auto 12px',
              border: '1px solid rgba(37, 211, 102, 0.2)'
            }}>
              <Lock size={20} />
            </div>
            <h2 style={{ fontSize: '20px', fontWeight: 700, color: '#fff', margin: 0 }}>WhatsApp Link Portal</h2>
            <p style={{ fontSize: 'var(--font-size-xs)', color: 'var(--text-muted)', marginTop: 4 }}>
              Sign in by connecting your WhatsApp Web Session
            </p>
          </div>

          {/* Message / Error banners */}
          {message && (
            <div style={{ background: 'var(--accent-primary-muted)', border: '1px solid rgba(37,211,102,0.3)', borderRadius: 'var(--radius-md)', padding: '10px 12px', fontSize: 'var(--font-size-xs)', color: 'var(--accent-primary)' }}>
              {message}
            </div>
          )}

          {errorMsg && (
            <div style={{ background: 'rgba(239,68,68,0.1)', border: '1px solid rgba(239,68,68,0.3)', borderRadius: 'var(--radius-md)', padding: '10px 12px', fontSize: 'var(--font-size-xs)', color: 'var(--accent-rose)' }}>
              {errorMsg}
            </div>
          )}

          {/* Connection flow UI */}
          {isConnecting ? (
            <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 16 }}>
              {sessionStatus.pairing_code ? (
                <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 14, width: '100%' }}>
                  <div style={{ fontSize: '32px', fontWeight: 800, color: 'var(--accent-primary)', letterSpacing: 4, background: 'var(--bg-secondary)', padding: '12px 24px', borderRadius: 'var(--radius-md)', border: '1px dashed var(--accent-primary)', fontFamily: 'monospace', textAlign: 'center' }}>
                    {sessionStatus.pairing_code}
                  </div>
                  <div style={{ fontSize: 'var(--font-size-xs)', color: 'var(--text-secondary)', textAlign: 'left', lineHeight: 1.6, background: 'rgba(255,255,255,0.02)', padding: 12, borderRadius: 'var(--radius-sm)', border: '1px solid var(--border-primary)' }}>
                    <strong>How to use pairing code:</strong>
                    <ol style={{ margin: '6px 0 0 16px', padding: 0 }}>
                      <li>Open WhatsApp on your phone</li>
                      <li>Settings &rarr; Linked Devices &rarr; Link a Device</li>
                      <li>Tap <strong>Link with phone number instead</strong></li>
                      <li>Enter the 8-character code shown above</li>
                    </ol>
                  </div>
                </div>
              ) : qrCode ? (
                <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 14 }}>
                  <div style={{ background: '#fff', padding: 12, borderRadius: 'var(--radius-md)', width: 200, height: 200, display: 'flex', alignItems: 'center', justifyItems: 'center', boxShadow: '0 4px 12px rgba(0,0,0,0.3)' }}>
                    <img src={`data:image/png;base64,${qrCode}`} alt="WhatsApp QR Code" style={{ width: '100%', height: '100%' }} />
                  </div>
                  <div style={{ fontSize: 'var(--font-size-xs)', color: 'var(--text-secondary)', textAlign: 'center', lineHeight: 1.5 }}>
                    Open WhatsApp on your mobile device, navigate to <strong>Linked Devices</strong>, and scan the QR code above to link your session.
                  </div>
                </div>
              ) : (
                <div style={{ textAlign: 'center', padding: '20px 0' }}>
                  <RefreshCw size={36} className="animate-spin" color="var(--accent-primary)" style={{ margin: '0 auto 12px', animation: 'spin 1.5s linear infinite' }} />
                  <p style={{ color: 'var(--text-muted)', fontSize: 'var(--font-size-sm)' }}>
                    Initializing session... Please scan or input OTP when prompted.
                  </p>
                </div>
              )}

              <button type="button" className="btn btn-secondary" onClick={handleCancelConnection} style={{ width: '100%', marginTop: 8 }}>
                Cancel & Start Over
              </button>
            </div>
          ) : (
            <form onSubmit={handleConnect} style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
              {/* Connection mode Selector (Vertical Option Cards) */}
              <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
                <div 
                  className={`link-method-card ${bridgeLinkMethod === 'qr' ? 'active' : ''}`}
                  onClick={() => setBridgeLinkMethod('qr')}
                >
                  <div className="link-method-icon-container">
                    <QrCode size={18} />
                  </div>
                  <div style={{ flex: 1, textAlign: 'left' }}>
                    <div style={{ fontSize: '13px', fontWeight: 600, color: '#fff' }}>Scan QR Code</div>
                    <div style={{ fontSize: '11px', color: 'var(--text-muted)', marginTop: 2 }}>Link instantly using your phone's camera</div>
                  </div>
                  <div className="link-method-radio">
                    <div className="link-method-radio-inner" />
                  </div>
                </div>

                <div 
                  className={`link-method-card ${bridgeLinkMethod === 'otp' ? 'active' : ''}`}
                  onClick={() => setBridgeLinkMethod('otp')}
                >
                  <div className="link-method-icon-container">
                    <Key size={18} />
                  </div>
                  <div style={{ flex: 1, textAlign: 'left' }}>
                    <div style={{ fontSize: '13px', fontWeight: 600, color: '#fff' }}>Pairing Code (OTP)</div>
                    <div style={{ fontSize: '11px', color: 'var(--text-muted)', marginTop: 2 }}>Link using an 8-character pairing code</div>
                  </div>
                  <div className="link-method-radio">
                    <div className="link-method-radio-inner" />
                  </div>
                </div>
              </div>

              {/* Phone Number Input */}
              <div className="form-group">
                <label className="form-label" style={{ fontSize: 'var(--font-size-xs)' }}>
                  {bridgeLinkMethod === 'qr'
                    ? 'Verification Phone Number * (Scanned account must match, with Country Code: +91xxxxxx)'
                    : 'WhatsApp Phone Number * (With Country Code: +91xxxxxx)'}
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

              {/* Help text */}
              <div style={{ display: 'flex', gap: 6, alignItems: 'flex-start', fontSize: '11px', color: 'var(--text-muted)', lineHeight: 1.4 }}>
                <HelpCircle size={14} style={{ flexShrink: 0, marginTop: 1 }} />
                <span>
                  To establish a connection, ensure the backend services are running. Connecting links this browser app securely to your phone account.
                </span>
              </div>

              {/* Connect Button */}
              <button
                type="submit"
                className="btn btn-primary"
                disabled={connecting}
                style={{ height: 40, marginTop: 8 }}
              >
                {connecting ? (
                  <><RefreshCw size={15} className="animate-spin" /> Starting Link...</>
                ) : (
                  <>Link WhatsApp Account</>
                )}
              </button>
              <button 
                type="button" 
                className="btn btn-secondary" 
                onClick={() => setShowPortal(false)}
                style={{ width: '100%', height: 40, background: 'rgba(255, 255, 255, 0.03)', border: '1px solid rgba(255, 255, 255, 0.05)', color: 'var(--text-secondary)' }}
              >
                &larr; Back to Welcome Screen
              </button>
            </form>
          )}
        </div>
      )}

      {/* Styled Sheet */}
      <style>{`
        .bg-glow-green {
          position: absolute;
          width: 500px;
          height: 500px;
          background: radial-gradient(circle, rgba(37, 211, 102, 0.12) 0%, rgba(37, 211, 102, 0) 70%);
          filter: blur(80px);
          border-radius: 50%;
          top: -10%;
          left: -10%;
          pointer-events: none;
        }
        .bg-glow-purple {
          position: absolute;
          width: 500px;
          height: 500px;
          background: radial-gradient(circle, rgba(139, 92, 246, 0.12) 0%, rgba(139, 92, 246, 0) 70%);
          filter: blur(80px);
          border-radius: 50%;
          bottom: -10%;
          right: -10%;
          pointer-events: none;
        }
        .splash-card {
          width: 100%;
          max-width: 440px;
          background: rgba(22, 27, 34, 0.75);
          border: 1px solid rgba(255, 255, 255, 0.08);
          border-radius: var(--radius-lg);
          padding: 48px 36px;
          box-shadow: 0 20px 50px rgba(0, 0, 0, 0.6), inset 0 1px 0 rgba(255, 255, 255, 0.1);
          backdrop-filter: blur(20px);
          z-index: 10;
          display: flex;
          flex-direction: column;
          align-items: center;
          gap: 28px;
          text-align: center;
          cursor: pointer;
          animation: fade-in 0.6s cubic-bezier(0.16, 1, 0.3, 1) forwards;
          transition: transform 0.3s ease, border-color 0.3s ease, box-shadow 0.3s ease;
        }
        .splash-card:hover {
          transform: translateY(-4px);
          border-color: rgba(37, 211, 102, 0.3);
          box-shadow: 0 30px 60px rgba(0, 0, 0, 0.8), 0 0 30px rgba(37, 211, 102, 0.1);
        }
        .logo-container {
          position: relative;
          width: 90px;
          height: 90px;
          display: flex;
          align-items: center;
          justify-content: center;
          animation: float 4s ease-in-out infinite;
        }
        .logo-pulse-ring {
          position: absolute;
          width: 100%;
          height: 100%;
          border-radius: 50%;
          border: 2px solid rgba(37, 211, 102, 0.3);
          animation: pulse-glow 2.5s infinite;
        }
        .logo-icon-bg {
          width: 72px;
          height: 72px;
          background: linear-gradient(135deg, #10b981 0%, #059669 100%);
          border-radius: 20px;
          display: flex;
          align-items: center;
          justify-content: center;
          color: #fff;
          position: relative;
          box-shadow: 0 10px 25px rgba(16, 185, 129, 0.4);
        }
        .logo-message {
          filter: drop-shadow(0 2px 4px rgba(0,0,0,0.15));
        }
        .logo-zap {
          position: absolute;
          bottom: 12px;
          right: 12px;
          color: #fbbf24;
          fill: #fbbf24;
          filter: drop-shadow(0 2px 6px rgba(251, 191, 36, 0.6));
        }
        .splash-text {
          display: flex;
          flex-direction: column;
          gap: 8px;
        }
        .splash-title {
          font-size: 24px;
          font-weight: 800;
          color: #fff;
          letter-spacing: 2px;
          margin: 0;
          text-shadow: 0 4px 10px rgba(0,0,0,0.3);
        }
        .splash-subtitle {
          font-size: 14px;
          font-weight: 500;
          color: var(--accent-primary);
          margin: 0;
        }
        .splash-description {
          font-size: 13px;
          color: var(--text-muted);
          line-height: 1.6;
          margin: 10px 0 0;
        }
        .splash-btn {
          width: 100%;
          height: 44px;
          background: linear-gradient(135deg, var(--accent-primary) 0%, #15803d 100%);
          border: none;
          border-radius: var(--radius-md);
          color: #000;
          font-size: 14px;
          font-weight: 700;
          letter-spacing: 0.5px;
          cursor: pointer;
          box-shadow: 0 4px 15px rgba(37, 211, 102, 0.3);
          transition: all 0.2s ease;
          display: flex;
          align-items: center;
          justify-content: center;
        }
        .splash-card:hover .splash-btn {
          transform: scale(1.02);
          box-shadow: 0 6px 20px rgba(37, 211, 102, 0.5);
          background: linear-gradient(135deg, #4ade80 0%, #16a34a 100%);
        }
        @keyframes float {
          0%, 100% { transform: translateY(0px); }
          50% { transform: translateY(-6px); }
        }
        @keyframes pulse-glow {
          0% { transform: scale(0.95); opacity: 0.8; box-shadow: 0 0 0 0 rgba(37, 211, 102, 0.4); }
          70% { transform: scale(1.05); opacity: 1; box-shadow: 0 0 0 12px rgba(37, 211, 102, 0); }
          100% { transform: scale(0.95); opacity: 0.8; box-shadow: 0 0 0 0 rgba(37, 211, 102, 0); }
        }
        @keyframes fade-in {
          from { opacity: 0; transform: translateY(15px); }
          to { opacity: 1; transform: translateY(0); }
        }
        .link-method-card {
          border: 1px solid var(--border-primary);
          background: rgba(255, 255, 255, 0.02);
          border-radius: var(--radius-md);
          padding: 14px 16px;
          cursor: pointer;
          transition: all 0.25s cubic-bezier(0.16, 1, 0.3, 1);
          display: flex;
          align-items: center;
          gap: 14px;
          user-select: none;
        }
        .link-method-card:hover {
          border-color: rgba(255, 255, 255, 0.15);
          background: rgba(255, 255, 255, 0.04);
        }
        .link-method-card.active {
          border-color: var(--accent-primary);
          background: rgba(37, 211, 102, 0.04);
          box-shadow: 0 0 15px rgba(37, 211, 102, 0.05);
        }
        .link-method-icon-container {
          width: 38px;
          height: 38px;
          border-radius: 50%;
          background: rgba(255, 255, 255, 0.05);
          display: flex;
          align-items: center;
          justify-content: center;
          color: var(--text-secondary);
          transition: all 0.25s;
        }
        .link-method-card.active .link-method-icon-container {
          background: var(--accent-primary-muted);
          color: var(--accent-primary);
        }
        .link-method-radio {
          width: 18px;
          height: 18px;
          border-radius: 50%;
          border: 2px solid var(--border-primary);
          display: flex;
          align-items: center;
          justify-content: center;
          transition: all 0.25s;
        }
        .link-method-card.active .link-method-radio {
          border-color: var(--accent-primary);
        }
        .link-method-radio-inner {
          width: 10px;
          height: 10px;
          border-radius: 50%;
          background: transparent;
          transition: all 0.25s;
        }
        .link-method-card.active .link-method-radio-inner {
          background: var(--accent-primary);
        }
      `}</style>
    </div>
  )
}
