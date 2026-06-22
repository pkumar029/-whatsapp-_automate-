import { useState, useEffect } from 'react'
import { Settings as SettingsIcon, Wifi, WifiOff, QrCode, LogOut, Save, RefreshCw, Shield, Bell, HelpCircle, User, Lock } from 'lucide-react'
import { whatsappApi } from '../../services/api'
import { useApp } from '../../context/AppContext'
import { formatIST } from '../../utils/date'
import { getErrorMessage } from '../../utils/error'


export default function Settings() {
  const { theme, setTheme, profile, updateProfile, changePassword } = useApp()

  const [status, setStatus] = useState({ status: 'disconnected' })
  const [connecting, setConnecting] = useState(false)
  const [qrCode, setQrCode] = useState(null)
  const [message, setMessage] = useState('')
  const [errorMsg, setErrorMsg] = useState('')

  // Connection options state
  const [connectionType, setConnectionType] = useState('bridge') // dev, meta, bridge

  const [phone, setPhone] = useState('')
  const [bridgeLinkMethod, setBridgeLinkMethod] = useState('qr') // qr or otp
  
  // Meta API specific fields
  const [metaToken, setMetaToken] = useState('')
  const [metaPhoneNumberId, setMetaPhoneNumberId] = useState('')
  const [metaBusinessAccountId, setMetaBusinessAccountId] = useState('')

  // Profile forms state
  const [profileName, setProfileName] = useState(profile.name)
  const [profileEmail, setProfileEmail] = useState(profile.email)
  const [profileCompany, setProfileCompany] = useState(profile.company || '')
  const [profileRole, setProfileRole] = useState(profile.role || '')
  const [profileMessage, setProfileMessage] = useState('')
  const [profileError, setProfileError] = useState('')
  const [savingProfile, setSavingProfile] = useState(false)

  // Security forms state
  const [currentPassword, setCurrentPassword] = useState('')
  const [newPassword, setNewPassword] = useState('')
  const [confirmPassword, setConfirmPassword] = useState('')
  const [securityMessage, setSecurityMessage] = useState('')
  const [securityError, setSecurityError] = useState('')
  const [savingSecurity, setSavingSecurity] = useState(false)

  const handleSaveProfile = async (e) => {
    e.preventDefault()
    setSavingProfile(true)
    setProfileMessage('')
    setProfileError('')
    try {
      await new Promise(r => setTimeout(r, 600))
      updateProfile({
        name: profileName,
        email: profileEmail,
        company: profileCompany,
        role: profileRole
      })
      setProfileMessage('Profile settings saved successfully!')
    } catch (err) {
      setProfileError('Failed to save profile settings.')
    } finally {
      setSavingProfile(false)
    }
  }

  const handleUpdatePassword = async (e) => {
    e.preventDefault()
    setSavingSecurity(true)
    setSecurityMessage('')
    setSecurityError('')

    if (newPassword !== confirmPassword) {
      setSecurityError('New passwords do not match.')
      setSavingSecurity(false)
      return
    }

    try {
      const res = await changePassword(currentPassword, newPassword)
      setSecurityMessage(res.message || 'Password changed successfully!')
      setCurrentPassword('')
      setNewPassword('')
      setConfirmPassword('')
    } catch (err) {
      setSecurityError(err.message || 'Failed to update password.')
    } finally {
      setSavingSecurity(false)
    }
  }


  useEffect(() => {
    whatsappApi.getStatus().then(res => {
      setStatus(res.data)
      if (res.data?.connection_type) {
        setConnectionType(res.data.connection_type)
      }
    }).catch(() => { })
  }, [])

  // Poll status when connecting
  useEffect(() => {
    let interval = null;
    if (status.status === 'connecting') {
      interval = setInterval(() => {
        whatsappApi.getStatus().then(res => {
          setStatus(res.data);
          if (res.data?.qr) {
            setQrCode(res.data.qr);
          } else {
            setQrCode(null);
          }
        }).catch(() => { })
      }, 3000);
    }
    return () => {
      if (interval) clearInterval(interval);
    }
  }, [status.status])

  const handleConnect = async (e) => {
    if (e) e.preventDefault();
    setConnecting(true);
    setMessage('');
    setErrorMsg('');
    setQrCode(null);

    const config = {
      connection_type: connectionType,
      phone: (connectionType === 'bridge' && bridgeLinkMethod === 'qr') ? undefined : (phone || undefined),
      meta_token: connectionType === 'meta' ? metaToken : undefined,
      meta_phone_number_id: connectionType === 'meta' ? metaPhoneNumberId : undefined,
      meta_business_account_id: connectionType === 'meta' ? metaBusinessAccountId : undefined
    }

    try {
      const res = await whatsappApi.connect(config);
      if (res.data?.qr) {
        setQrCode(res.data.qr);
      }
      
      if (res.data?.status === 'connected') {
        setMessage(res.data.message || 'Connected successfully!');
        setStatus(prev => ({ ...prev, status: 'connected', phone: phone || res.data.phone || 'Dev Session', connection_type: connectionType }));
      } else {
        setMessage(res.data.message || 'Connecting... Please wait.');
        setStatus(prev => ({ ...prev, status: 'connecting', connection_type: connectionType }));
      }
    } catch (err) {
      setErrorMsg(getErrorMessage(err, 'Connection failed.'));
    } finally {
      setConnecting(false);
    }
  }

  const handleDisconnect = async () => {
    try {
      await whatsappApi.disconnect()
      setStatus({ status: 'disconnected' });
      setQrCode(null);
      setMessage('WhatsApp session disconnected.');
      setErrorMsg('');
    } catch (err) {
      setErrorMsg('Failed to disconnect session.');
    }
  }

  const isConnected = status.status === 'connected'
  const isConnecting = status.status === 'connecting'

  return (
    <div>
      <div className="page-header">
        <div>
          <h2 className="page-title">Settings</h2>
          <p className="page-subtitle">Configure WhatsApp session connection and application preferences</p>
        </div>
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 20 }}>

        {/* WhatsApp Session Card */}
        <div className="card" style={{ gridColumn: '1 / -1' }}>
          <div className="card-header" style={{ borderBottom: '1px solid var(--border-primary)', paddingBottom: 12, marginBottom: 16 }}>
            <span className="card-title" style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
              {isConnected ? <Wifi size={18} color="var(--accent-primary)" /> : <WifiOff size={18} color="var(--accent-rose)" />}
              WhatsApp Connection Setup
            </span>
            <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
              {status.connection_type && (
                <span className="badge" style={{ background: 'var(--bg-tertiary)', border: '1px solid var(--border-primary)' }}>
                  Mode: {status.connection_type.toUpperCase()}
                </span>
              )}
              <span className={`badge ${isConnected ? 'badge-green' : isConnecting ? 'badge-orange' : 'badge-red'}`}>
                {isConnected ? 'Connected' : isConnecting ? 'Connecting' : 'Disconnected'}
              </span>
            </div>
          </div>

          {message && (
            <div style={{ background: 'var(--accent-primary-muted)', border: '1px solid rgba(37,211,102,0.3)', borderRadius: 'var(--radius-md)', padding: '10px 14px', marginBottom: 16, fontSize: 'var(--font-size-sm)', color: 'var(--accent-primary)' }}>
              {message}
            </div>
          )}

          {errorMsg && (
            <div style={{ background: 'rgba(239,68,68,0.1)', border: '1px solid rgba(239,68,68,0.3)', borderRadius: 'var(--radius-md)', padding: '10px 14px', marginBottom: 16, fontSize: 'var(--font-size-sm)', color: 'var(--accent-rose)' }}>
              {errorMsg}
            </div>
          )}

          {isConnected ? (
            <div style={{ display: 'flex', alignItems: 'center', gap: 16, flexWrap: 'wrap', padding: '10px 0' }}>
              <div style={{ flex: 1 }}>
                <div style={{ fontSize: 'var(--font-size-sm)', color: 'var(--text-muted)' }}>Connected Mode</div>
                <div style={{ fontSize: 'var(--font-size-md)', fontWeight: 600, color: 'var(--text-primary)', marginBottom: 8 }}>
                  {status.connection_type === 'dev' ? '🔧 Option 1 — Development Bypass' : 
                   status.connection_type === 'meta' ? '🏢 Option 2 — Meta Official Cloud API' : 
                   '📱 Option 3 — whatsapp-web.js Web Bridge'}
                </div>
                <div style={{ fontSize: 'var(--font-size-sm)', color: 'var(--text-muted)' }}>Active Phone Number / ID</div>
                <div style={{ fontSize: 'var(--font-size-lg)', fontWeight: 700, color: 'var(--text-primary)' }}>{status.phone || 'Unknown'}</div>
                {status.connected_at && <div style={{ fontSize: 'var(--font-size-xs)', color: 'var(--text-muted)', marginTop: 4 }}>Since {formatIST(status.connected_at)}</div>}
              </div>
              <button className="btn btn-danger" onClick={handleDisconnect}>
                <LogOut size={16} /> Disconnect Session
              </button>
            </div>
          ) : isConnecting ? (
            <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 16, padding: '20px 0' }}>
              {status.pairing_code ? (
                <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 16 }}>
                  <div style={{ fontSize: '36px', fontWeight: 800, color: 'var(--accent-primary)', letterSpacing: 4, background: 'var(--bg-secondary)', padding: '14px 28px', borderRadius: 'var(--radius-md)', border: '1px dashed var(--accent-primary)', fontFamily: 'monospace' }}>
                    {status.pairing_code}
                  </div>
                  <div style={{ fontSize: 'var(--font-size-sm)', color: 'var(--text-muted)', textAlign: 'center', maxWidth: 450, lineHeight: 1.6 }}>
                    <strong>Link with phone number instead:</strong><br />
                    1. Open WhatsApp on your phone.<br />
                    2. Go to <strong>Settings</strong> &rarr; <strong>Linked Devices</strong> &rarr; <strong>Link a Device</strong>.<br />
                    3. Tap <strong>Link with phone number instead</strong> at the bottom.<br />
                    4. Enter the 8-character pairing code shown above.
                  </div>
                </div>
              ) : qrCode ? (
                <div className="qr-container" style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 12 }}>
                  <div className="qr-box" style={{ background: '#fff', padding: 12, borderRadius: 'var(--radius-md)', border: '1px solid var(--border-primary)', width: 220, height: 220 }}>
                    <img src={`data:image/png;base64,${qrCode}`} alt="WhatsApp QR Code" style={{ width: '100%', height: '100%', objectFit: 'contain' }} />
                  </div>
                  <div style={{ fontSize: 'var(--font-size-sm)', color: 'var(--text-muted)', textAlign: 'center', maxWidth: 400 }}>
                    <strong>Scan this QR code with WhatsApp:</strong><br />
                    Open WhatsApp &rarr; Settings &rarr; Linked Devices &rarr; Link a Device
                  </div>
                </div>
              ) : (
                <div style={{ textAlign: 'center' }}>
                  <RefreshCw size={48} className="animate-spin" color="var(--accent-primary)" style={{ margin: '0 auto 12px', animation: 'spin 1.5s linear infinite' }} />
                  <p style={{ color: 'var(--text-muted)', fontSize: 'var(--font-size-sm)' }}>
                    Initializing connection. Waiting for response, QR code, or pairing code...
                  </p>
                </div>
              )}
              <div style={{ display: 'flex', gap: 12, marginTop: 12 }}>
                <button className="btn btn-secondary" onClick={handleDisconnect}>
                  Cancel Connection
                </button>
              </div>
            </div>
          ) : (
            <div>
              {/* Form Input fields for whatsapp-web.js Web Bridge only */}
              <form onSubmit={handleConnect} style={{ background: 'var(--bg-tertiary)', padding: 16, borderRadius: 'var(--radius-md)', border: '1px solid var(--border-primary)' }}>
                <h4 style={{ margin: '0 0 14px 0', fontSize: 'var(--font-size-sm)', fontWeight: 600, color: 'var(--text-primary)' }}>
                  Configure whatsapp-web.js Web Bridge
                </h4>

                <div>
                  <div style={{ display: 'flex', gap: 16, marginBottom: 16 }}>
                    <label style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: 'var(--font-size-sm)', cursor: 'pointer', color: 'var(--text-primary)' }}>
                      <input 
                        type="radio" 
                        name="bridge_method" 
                        checked={bridgeLinkMethod === 'qr'} 
                        onChange={() => setBridgeLinkMethod('qr')} 
                      />
                      Scan QR Code
                    </label>
                    <label style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: 'var(--font-size-sm)', cursor: 'pointer', color: 'var(--text-primary)' }}>
                      <input 
                        type="radio" 
                        name="bridge_method" 
                        checked={bridgeLinkMethod === 'otp'} 
                        onChange={() => setBridgeLinkMethod('otp')} 
                      />
                      Use Pairing Code (OTP)
                    </label>
                  </div>

                  {bridgeLinkMethod === 'qr' ? null : (
                    <div style={{ marginBottom: 16 }}>
                      <label style={{ display: 'block', fontSize: 'var(--font-size-xs)', color: 'var(--text-muted)', marginBottom: 6 }}>Phone Number * (with Country Code, e.g. +91xxxxxx)</label>
                      <input 
                        type="text" 
                        className="form-input" 
                        placeholder="+91xxxxxx" 
                        value={phone} 
                        onChange={e => setPhone(e.target.value)} 
                        required
                      />
                    </div>
                  )}
                  <div style={{ fontSize: 'var(--font-size-xs)', color: 'var(--text-muted)', marginTop: 6, display: 'flex', alignItems: 'center', gap: 4 }}>
                    <HelpCircle size={12} />
                    Requires the bridge Node process running on port 3000.
                  </div>
                </div>

                <button type="submit" className="btn btn-primary btn-lg" disabled={connecting} style={{ marginTop: 12 }}>
                  {connecting ? (
                    <><RefreshCw size={16} style={{ animation: 'spin 1s linear infinite' }} /> Initializing...</>
                  ) : (
                    <><QrCode size={16} /> 
                      {bridgeLinkMethod === 'qr' ? 'Generate QR Code' : 'Generate Pairing Code'}
                    </>
                  )}
                </button>
              </form>
            </div>
          )}
        </div>


        {/* Profile Settings */}
        <div className="card">
          <div className="card-header">
            <span className="card-title" style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
              <User size={16} /> Profile Details
            </span>
          </div>

          {profileMessage && (
            <div style={{ background: 'var(--accent-primary-muted)', border: '1px solid rgba(37,211,102,0.3)', borderRadius: 'var(--radius-md)', padding: '10px 14px', marginBottom: 16, fontSize: 'var(--font-size-sm)', color: 'var(--accent-primary)' }}>
              {profileMessage}
            </div>
          )}

          {profileError && (
            <div style={{ background: 'rgba(239,68,68,0.1)', border: '1px solid rgba(239,68,68,0.3)', borderRadius: 'var(--radius-md)', padding: '10px 14px', marginBottom: 16, fontSize: 'var(--font-size-sm)', color: 'var(--accent-rose)' }}>
              {profileError}
            </div>
          )}

          <form onSubmit={handleSaveProfile} style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 16, marginBottom: 8 }}>
              <div style={{ 
                width: 64, 
                height: 64, 
                borderRadius: '50%', 
                background: 'var(--gradient-purple)', 
                display: 'flex', 
                alignItems: 'center', 
                justifyContent: 'center', 
                fontSize: 24, 
                fontWeight: 700, 
                color: 'white',
                boxShadow: 'var(--shadow-glow-purple)'
              }}>
                {profileName ? profileName.charAt(0).toUpperCase() : 'A'}
              </div>
              <div>
                <div style={{ fontSize: 'var(--font-size-md)', fontWeight: 600, color: 'var(--text-primary)' }}>{profileName || 'User Avatar'}</div>
                <div style={{ fontSize: 'var(--font-size-xs)', color: 'var(--text-muted)' }}>{profileRole || 'Role not set'}</div>
              </div>
            </div>

            <div className="form-group">
              <label className="form-label">Full Name</label>
              <input 
                type="text" 
                className="form-input" 
                placeholder="Enter a name"
                value={profileName} 
                onChange={e => setProfileName(e.target.value)} 
                required
              />
            </div>

            <div className="form-group">
              <label className="form-label">Email Address</label>
              <input 
                type="email" 
                className="form-input" 
                placeholder="example@gmail.com"
                value={profileEmail} 
                onChange={e => setProfileEmail(e.target.value)} 
                required
              />
            </div>

            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
              <div className="form-group">
                <label className="form-label">Company Name</label>
                <input 
                  type="text" 
                  className="form-input" 
                  placeholder="WA Automate Inc."
                  value={profileCompany} 
                  onChange={e => setProfileCompany(e.target.value)} 
                />
              </div>
              <div className="form-group">
                <label className="form-label">Role</label>
                <input 
                  type="text" 
                  className="form-input" 
                  placeholder="Administrator"
                  value={profileRole} 
                  onChange={e => setProfileRole(e.target.value)} 
                />
              </div>
            </div>

            <button type="submit" className="btn btn-primary" disabled={savingProfile} style={{ alignSelf: 'flex-start' }}>
              {savingProfile ? (
                <><RefreshCw size={14} style={{ animation: 'spin 1s linear infinite' }} /> Saving...</>
              ) : (
                <><Save size={14} /> Save Profile</>
              )}
            </button>
          </form>
        </div>

        {/* Security & Password Settings */}
        <div className="card">
          <div className="card-header">
            <span className="card-title" style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
              <Lock size={16} /> Security & Password
            </span>
          </div>

          {securityMessage && (
            <div style={{ background: 'var(--accent-primary-muted)', border: '1px solid rgba(37,211,102,0.3)', borderRadius: 'var(--radius-md)', padding: '10px 14px', marginBottom: 16, fontSize: 'var(--font-size-sm)', color: 'var(--accent-primary)' }}>
              {securityMessage}
            </div>
          )}

          {securityError && (
            <div style={{ background: 'rgba(239,68,68,0.1)', border: '1px solid rgba(239,68,68,0.3)', borderRadius: 'var(--radius-md)', padding: '10px 14px', marginBottom: 16, fontSize: 'var(--font-size-sm)', color: 'var(--accent-rose)' }}>
              {securityError}
            </div>
          )}

          <form onSubmit={handleUpdatePassword} style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
            <div className="form-group">
              <label className="form-label">Current Password</label>
              <input 
                type="password" 
                className="form-input" 
                placeholder="••••••••"
                value={currentPassword} 
                onChange={e => setCurrentPassword(e.target.value)} 
                required
              />
            </div>

            <div className="form-group">
              <label className="form-label">New Password</label>
              <input 
                type="password" 
                className="form-input" 
                placeholder="••••••••"
                value={newPassword} 
                onChange={e => setNewPassword(e.target.value)} 
                required
              />
            </div>

            <div className="form-group">
              <label className="form-label">Confirm New Password</label>
              <input 
                type="password" 
                className="form-input" 
                placeholder="••••••••"
                value={confirmPassword} 
                onChange={e => setConfirmPassword(e.target.value)} 
                required
              />
            </div>

            <button type="submit" className="btn btn-secondary" disabled={savingSecurity} style={{ alignSelf: 'flex-start' }}>
              {savingSecurity ? (
                <><RefreshCw size={14} style={{ animation: 'spin 1s linear infinite' }} /> Updating...</>
              ) : (
                <><Lock size={14} /> Update Password</>
              )}
            </button>
          </form>
        </div>

        {/* App Settings */}
        <div className="card">
          <div className="card-header">
            <span className="card-title" style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
              <SettingsIcon size={16} /> Application
            </span>
          </div>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
            {/* Theme Settings Row */}
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '12px', background: 'var(--bg-tertiary)', borderRadius: 'var(--radius-md)', border: '1px solid var(--border-primary)' }}>
              <div>
                <div style={{ fontSize: 'var(--font-size-sm)', fontWeight: 500, color: 'var(--text-primary)' }}>Visual Theme Mode</div>
                <div style={{ fontSize: 'var(--font-size-xs)', color: 'var(--text-muted)' }}>Toggle between Light and Dark interface theme</div>
              </div>
              <select 
                className="form-input" 
                style={{ width: 120, padding: '6px 10px', height: 34, background: 'var(--bg-secondary)', cursor: 'pointer' }}
                value={theme}
                onChange={e => setTheme(e.target.value)}
              >
                <option value="dark">🌙 Dark Mode</option>
                <option value="light">☀️ Light Mode</option>
              </select>
            </div>

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
