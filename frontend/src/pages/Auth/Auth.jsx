import { useState } from 'react'
import { Phone, Key, RefreshCw, MessageSquare, Zap, ArrowLeft, ShieldCheck } from 'lucide-react'
import { authApi } from '../../services/api'

export default function Auth({ onAuthenticated }) {
  const [step, setStep] = useState('phone')  // 'phone' | 'otp'
  const [phone, setPhone] = useState('')
  const [otp, setOtp] = useState('')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')
  const [info, setInfo] = useState('')
  const [devOtp, setDevOtp] = useState('')   // shown only when no SMS provider is configured

  const handleRequestOtp = async (e) => {
    e.preventDefault()
    if (!phone.trim()) return
    setLoading(true)
    setError('')
    setDevOtp('')
    try {
      const res = await authApi.requestOtp(phone.trim())
      setInfo(res.data?.message || 'OTP sent!')
      if (res.data?.dev_otp) setDevOtp(res.data.dev_otp)
      setStep('otp')
    } catch (err) {
      setError(err.response?.data?.detail || 'Failed to send OTP. Check backend is running.')
    } finally {
      setLoading(false)
    }
  }

  const handleVerifyOtp = async (e) => {
    e.preventDefault()
    if (!otp.trim()) return
    setLoading(true)
    setError('')
    try {
      const res = await authApi.verifyOtp(phone.trim(), otp.trim())
      localStorage.setItem('wa_auth_token', res.data.token)
      localStorage.setItem('wa_auth_phone', phone.trim())
      onAuthenticated()
    } catch (err) {
      setError(err.response?.data?.detail || 'Invalid OTP. Please try again.')
    } finally {
      setLoading(false)
    }
  }

  return (
    <div style={{
      minHeight: '100vh',
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'center',
      background: 'radial-gradient(circle at center, #1a202c 0%, #0d1117 100%)',
      padding: 20,
    }}>
      <div style={{ position: 'absolute', inset: 0, background: 'radial-gradient(ellipse 60% 40% at 20% 20%, rgba(37,211,102,0.05) 0%, transparent 70%)', pointerEvents: 'none' }} />

      <div style={{
        width: '100%', maxWidth: 400,
        background: '#161b22',
        border: '1px solid rgba(255,255,255,0.08)',
        borderRadius: 16,
        padding: '36px 28px',
        boxShadow: '0 4px 24px rgba(0,0,0,0.5)',
        position: 'relative', zIndex: 1,
        animation: 'fadeIn 0.2s ease forwards',
      }}>

        {/* Logo */}
        <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 28 }}>
          <div style={{ width: 44, height: 44, borderRadius: 12, background: 'linear-gradient(135deg,#10b981,#059669)', display: 'flex', alignItems: 'center', justifyContent: 'center', position: 'relative' }}>
            <MessageSquare size={22} color="#fff" />
            <Zap size={12} color="#fbbf24" style={{ position: 'absolute', bottom: 6, right: 6, fill: '#fbbf24' }} />
          </div>
          <div>
            <div style={{ fontSize: 16, fontWeight: 700, color: '#fff', letterSpacing: 1 }}>WHATSAPP AUTOMATE</div>
            <div style={{ fontSize: 11, color: 'var(--text-muted)' }}>Secure Login</div>
          </div>
        </div>

        {/* Step: phone */}
        {step === 'phone' && (
          <form onSubmit={handleRequestOtp} style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
            <div>
              <div style={{ fontSize: 18, fontWeight: 700, color: '#fff', marginBottom: 4 }}>Enter your phone number</div>
              <div style={{ fontSize: 12, color: 'var(--text-muted)', lineHeight: 1.5 }}>
                We'll send a 6-digit OTP to verify your identity.
              </div>
            </div>

            {error && <div style={styles.error}>{error}</div>}

            <div style={{ position: 'relative' }}>
              <Phone size={15} style={{ position: 'absolute', left: 12, top: '50%', transform: 'translateY(-50%)', color: 'var(--text-muted)' }} />
              <input
                type="tel"
                placeholder="+91 9876543210"
                value={phone}
                onChange={e => setPhone(e.target.value)}
                required
                autoFocus
                style={{ ...styles.input, paddingLeft: 36 }}
              />
            </div>

            <button type="submit" disabled={loading} style={styles.primaryBtn}>
              {loading
                ? <><RefreshCw size={15} style={{ animation: 'spin 1s linear infinite' }} /> Sending OTP...</>
                : 'Send OTP →'}
            </button>
          </form>
        )}

        {/* Step: OTP */}
        {step === 'otp' && (
          <form onSubmit={handleVerifyOtp} style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
            <button type="button" onClick={() => { setStep('phone'); setOtp(''); setError(''); setDevOtp('') }}
              style={{ display: 'flex', alignItems: 'center', gap: 6, background: 'none', border: 'none', color: 'var(--text-muted)', cursor: 'pointer', fontSize: 12, padding: 0, marginBottom: 4 }}>
              <ArrowLeft size={13} /> Back
            </button>

            <div>
              <div style={{ fontSize: 18, fontWeight: 700, color: '#fff', marginBottom: 4 }}>Enter OTP</div>
              <div style={{ fontSize: 12, color: 'var(--text-muted)', lineHeight: 1.5 }}>
                {info || `Sent to ${phone}`}
              </div>
            </div>

            {/* Dev OTP display — only shown when no SMS provider is configured */}
            {devOtp && (
              <div style={{ background: 'rgba(251,191,36,0.08)', border: '1px solid rgba(251,191,36,0.25)', borderRadius: 10, padding: '12px 14px', fontSize: 12, color: '#fbbf24', lineHeight: 1.6 }}>
                <strong>Development mode</strong> — No SMS provider configured.<br />
                Your OTP: <span style={{ fontFamily: 'monospace', fontSize: 20, fontWeight: 800, letterSpacing: 4 }}>{devOtp}</span><br />
                <span style={{ fontSize: 11, opacity: 0.7 }}>Configure SMS gateway in Settings → Security to send real SMS.</span>
              </div>
            )}

            {error && <div style={styles.error}>{error}</div>}

            <div style={{ position: 'relative' }}>
              <Key size={15} style={{ position: 'absolute', left: 12, top: '50%', transform: 'translateY(-50%)', color: 'var(--text-muted)' }} />
              <input
                type="text"
                placeholder="6-digit OTP"
                value={otp}
                onChange={e => setOtp(e.target.value.replace(/\D/g, '').slice(0, 6))}
                required
                autoFocus
                maxLength={6}
                inputMode="numeric"
                style={{ ...styles.input, paddingLeft: 36, letterSpacing: 6, fontSize: 20, fontWeight: 700, textAlign: 'center' }}
              />
            </div>

            <button type="submit" disabled={loading || otp.length < 6} style={styles.primaryBtn}>
              {loading
                ? <><RefreshCw size={15} style={{ animation: 'spin 1s linear infinite' }} /> Verifying...</>
                : <><ShieldCheck size={15} /> Verify & Login</>}
            </button>

            <button type="button" onClick={handleRequestOtp} disabled={loading}
              style={{ ...styles.secondaryBtn, fontSize: 12 }}>
              Resend OTP
            </button>
          </form>
        )}
      </div>

      <style>{`
        @keyframes spin { to { transform: rotate(360deg); } }
        @keyframes fadeIn { from { opacity:0; transform:translateY(8px); } to { opacity:1; transform:translateY(0); } }
      `}</style>
    </div>
  )
}

const styles = {
  input: {
    width: '100%', height: 42, background: 'rgba(255,255,255,0.04)',
    border: '1px solid rgba(255,255,255,0.1)', borderRadius: 8,
    color: '#fff', fontSize: 14, outline: 'none', boxSizing: 'border-box',
    padding: '0 12px', transition: 'border-color 0.15s',
  },
  primaryBtn: {
    height: 42, background: '#25d366', border: 'none', borderRadius: 8,
    color: '#000', fontSize: 14, fontWeight: 700, cursor: 'pointer',
    display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8,
    transition: 'opacity 0.15s',
  },
  secondaryBtn: {
    height: 36, background: 'rgba(255,255,255,0.04)',
    border: '1px solid rgba(255,255,255,0.08)', borderRadius: 8,
    color: 'var(--text-muted)', fontSize: 13, cursor: 'pointer',
    display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 6,
  },
  error: {
    background: 'rgba(239,68,68,0.1)', border: '1px solid rgba(239,68,68,0.3)',
    borderRadius: 8, padding: '9px 12px', fontSize: 12, color: '#f87171',
  },
}
