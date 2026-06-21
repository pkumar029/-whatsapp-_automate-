import { useState, useEffect } from 'react'
import { Settings as SettingsIcon, Wifi, WifiOff, QrCode, LogOut, Save, RefreshCw, Shield, Bell } from 'lucide-react'
import { whatsappApi } from '../../services/api'

export default function Settings() {
  const [status, setStatus] = useState({ status: 'disconnected' })
  const [connecting, setConnecting] = useState(false)
  const [qrCode, setQrCode] = useState(null)
  const [message, setMessage] = useState('')

  useEffect(() => {
    whatsappApi.getStatus().then(res => setStatus(res.data)).catch(() => { })
  }, [])

  const handleConnect = async () => {
    setConnecting(true); setMessage('')
    try {
      const res = await whatsappApi.connect()
      if (res.data?.qr) setQrCode(res.data.qr)
      setMessage('QR code generated — scan with WhatsApp')
      setTimeout(() => { whatsappApi.getStatus().then(r => setStatus(r.data)).catch(() => { }) }, 5000)
    } catch (err) {
      setMessage(err.response?.data?.detail || 'Connection failed.')
    } finally { setConnecting(false) }
  }

  const handleDisconnect = async () => {
    try {
      await whatsappApi.disconnect()
      setStatus({ status: 'disconnected' }); setQrCode(null)
      setMessage('WhatsApp session disconnected.')
    } catch { }
  }

  const isConnected = status.status === 'connected'

  return (
    <div>
      <div className="page-header">
        <div>
          <h2 className="page-title">Settings</h2>
          <p className="page-subtitle">Configure WhatsApp session and application preferences</p>
        </div>
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 20 }}>

        {/* WhatsApp Session */}
        <div className="card" style={{ gridColumn: '1 / -1' }}>
          <div className="card-header">
            <span className="card-title" style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
              {isConnected ? <Wifi size={18} color="var(--accent-primary)" /> : <WifiOff size={18} color="var(--accent-rose)" />}
              WhatsApp Session
            </span>
            <span className={`badge ${isConnected ? 'badge-green' : 'badge-red'}`}>
              {isConnected ? 'Connected' : 'Disconnected'}
            </span>
          </div>

          {message && (
            <div style={{ background: 'var(--accent-primary-muted)', border: '1px solid rgba(37,211,102,0.3)', borderRadius: 'var(--radius-md)', padding: '10px 14px', marginBottom: 16, fontSize: 'var(--font-size-sm)', color: 'var(--accent-primary)' }}>
              {message}
            </div>
          )}

          {isConnected ? (
            <div style={{ display: 'flex', alignItems: 'center', gap: 16, flexWrap: 'wrap' }}>
              <div style={{ flex: 1 }}>
                <div style={{ fontSize: 'var(--font-size-sm)', color: 'var(--text-muted)' }}>Connected as</div>
                <div style={{ fontSize: 'var(--font-size-lg)', fontWeight: 700, color: 'var(--text-primary)' }}>{status.phone || 'Unknown'}</div>
                {status.connected_at && <div style={{ fontSize: 'var(--font-size-xs)', color: 'var(--text-muted)' }}>Since {new Date(status.connected_at).toLocaleString()}</div>}
              </div>
              <button className="btn btn-danger" onClick={handleDisconnect}>
                <LogOut size={16} /> Disconnect Session
              </button>
            </div>
          ) : (
            <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 16 }}>
              {qrCode ? (
                <div className="qr-container">
                  <div className="qr-box">
                    <img src={`data:image/png;base64,${qrCode}`} alt="WhatsApp QR Code" style={{ width: '100%', height: '100%', objectFit: 'contain' }} />
                  </div>
                  <div style={{ fontSize: 'var(--font-size-sm)', color: 'var(--text-muted)' }}>
                    Open WhatsApp → Settings → Linked Devices → Link a Device
                  </div>
                </div>
              ) : (
                <div style={{ textAlign: 'center', padding: '24px 0' }}>
                  <QrCode size={48} color="var(--text-muted)" style={{ margin: '0 auto 12px' }} />
                  <p style={{ color: 'var(--text-muted)', fontSize: 'var(--font-size-sm)', marginBottom: 16 }}>
                    Connect your WhatsApp account to start sending messages and running automations.
                  </p>
                </div>
              )}
              <button className="btn btn-primary btn-lg" onClick={handleConnect} disabled={connecting}>
                {connecting ? <><RefreshCw size={16} style={{ animation: 'spin 1s linear infinite' }} /> Connecting...</> : <><QrCode size={16} /> Connect WhatsApp</>}
              </button>
            </div>
          )}
        </div>

        {/* App Settings */}
        <div className="card">
          <div className="card-header">
            <span className="card-title" style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
              <SettingsIcon size={16} /> Application
            </span>
          </div>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
            {[
              { label: 'Auto Reconnect', desc: 'Reconnect session after disconnect', id: 'auto-reconnect' },
              { label: 'Message Logging', desc: 'Save all messages to database', id: 'msg-logging' },
              { label: 'Automation Engine', desc: 'Enable automation workflow runner', id: 'auto-engine' },
            ].map(s => (
              <div key={s.id} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '12px', background: 'var(--bg-tertiary)', borderRadius: 'var(--radius-md)', border: '1px solid var(--border-primary)' }}>
                <div>
                  <div style={{ fontSize: 'var(--font-size-sm)', fontWeight: 500, color: 'var(--text-primary)' }}>{s.label}</div>
                  <div style={{ fontSize: 'var(--font-size-xs)', color: 'var(--text-muted)' }}>{s.desc}</div>
                </div>
                <label style={{ position: 'relative', display: 'inline-block', width: 42, height: 24, cursor: 'pointer' }}>
                  <input type="checkbox" id={s.id} defaultChecked style={{ opacity: 0, width: 0, height: 0 }} />
                  <span style={{ position: 'absolute', cursor: 'pointer', inset: 0, background: 'var(--accent-primary)', borderRadius: 24, transition: '0.3s' }} />
                </label>
              </div>
            ))}
          </div>
        </div>

        {/* Notifications */}
        <div className="card">
          <div className="card-header">
            <span className="card-title" style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
              <Bell size={16} /> Notifications
            </span>
          </div>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
            {[
              { label: 'Automation Failures', desc: 'Alert when automation step fails', id: 'auto-fail' },
              { label: 'Session Disconnected', desc: 'Alert when WhatsApp disconnects', id: 'sess-disc' },
              { label: 'New Incoming Message', desc: 'Alert on new inbound message', id: 'new-msg' },
            ].map(s => (
              <div key={s.id} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '12px', background: 'var(--bg-tertiary)', borderRadius: 'var(--radius-md)', border: '1px solid var(--border-primary)' }}>
                <div>
                  <div style={{ fontSize: 'var(--font-size-sm)', fontWeight: 500, color: 'var(--text-primary)' }}>{s.label}</div>
                  <div style={{ fontSize: 'var(--font-size-xs)', color: 'var(--text-muted)' }}>{s.desc}</div>
                </div>
                <label style={{ position: 'relative', display: 'inline-block', width: 42, height: 24, cursor: 'pointer' }}>
                  <input type="checkbox" id={s.id} style={{ opacity: 0, width: 0, height: 0 }} />
                  <span style={{ position: 'absolute', cursor: 'pointer', inset: 0, background: 'var(--bg-hover)', borderRadius: 24, border: '1px solid var(--border-primary)', transition: '0.3s' }} />
                </label>
              </div>
            ))}
          </div>
        </div>

        {/* API Info */}
        <div className="card" style={{ gridColumn: '1 / -1' }}>
          <div className="card-header">
            <span className="card-title" style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
              <Shield size={16} /> API & System Info
            </span>
          </div>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3,1fr)', gap: 12 }}>
            {[
              { label: 'Backend API', value: import.meta.env.VITE_API_BASE_URL || 'http://localhost:8000/api/v1' },
              { label: 'App Version', value: import.meta.env.VITE_APP_VERSION || '1.0.0' },
              { label: 'Environment', value: import.meta.env.VITE_APP_ENV || 'development' },
            ].map(info => (
              <div key={info.label} style={{ padding: 12, background: 'var(--bg-tertiary)', borderRadius: 'var(--radius-md)', border: '1px solid var(--border-primary)' }}>
                <div style={{ fontSize: 'var(--font-size-xs)', color: 'var(--text-muted)', marginBottom: 4 }}>{info.label}</div>
                <div style={{ fontSize: 'var(--font-size-sm)', fontWeight: 500, color: 'var(--text-primary)', fontFamily: 'monospace' }}>{info.value}</div>
              </div>
            ))}
          </div>
        </div>
      </div>

      <style>{`@keyframes spin { to { transform: rotate(360deg); } }`}</style>
    </div>
  )
}
