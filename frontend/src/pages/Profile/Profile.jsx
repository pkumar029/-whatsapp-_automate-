import { useState, useRef } from 'react'
import { useNavigate } from 'react-router-dom'
import {
  User, Mail, Building2, Briefcase, Camera, Save,
  Lock, Eye, EyeOff, CheckCircle2, AlertCircle, Phone, Shield
} from 'lucide-react'
import { useApp } from '../../context/AppContext'

function FormField({ label, icon: Icon, error, children }) {
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
      <label style={{ fontSize: 12, fontWeight: 600, color: 'var(--text-secondary)', textTransform: 'uppercase', letterSpacing: '0.05em', display: 'flex', alignItems: 'center', gap: 6 }}>
        <Icon size={13} /> {label}
      </label>
      {children}
      {error && <span style={{ fontSize: 12, color: 'var(--accent-rose)' }}>{error}</span>}
    </div>
  )
}

function Input({ value, onChange, placeholder, type = 'text', readOnly, rightEl }) {
  return (
    <div style={{ position: 'relative' }}>
      <input
        type={type}
        value={value}
        onChange={onChange}
        placeholder={placeholder}
        readOnly={readOnly}
        style={{
          width: '100%',
          padding: '10px 14px',
          paddingRight: rightEl ? 42 : 14,
          background: readOnly ? 'rgba(255,255,255,0.03)' : 'rgba(255,255,255,0.06)',
          border: '1px solid var(--border-primary)',
          borderRadius: 8,
          color: readOnly ? 'var(--text-secondary)' : 'var(--text-primary)',
          fontSize: 14,
          outline: 'none',
          boxSizing: 'border-box',
          cursor: readOnly ? 'default' : 'text',
          transition: 'border-color 0.15s',
        }}
        onFocus={e => { if (!readOnly) e.target.style.borderColor = 'var(--accent-primary)' }}
        onBlur={e => { e.target.style.borderColor = 'var(--border-primary)' }}
      />
      {rightEl && (
        <span style={{ position: 'absolute', right: 12, top: '50%', transform: 'translateY(-50%)' }}>
          {rightEl}
        </span>
      )}
    </div>
  )
}

function Toast({ msg, type }) {
  if (!msg) return null
  const isError = type === 'error'
  return (
    <div style={{
      display: 'flex', alignItems: 'center', gap: 8,
      padding: '10px 14px', borderRadius: 8, fontSize: 13,
      background: isError ? 'rgba(255,77,79,0.12)' : 'rgba(37,211,102,0.12)',
      border: `1px solid ${isError ? 'rgba(255,77,79,0.3)' : 'rgba(37,211,102,0.3)'}`,
      color: isError ? '#ff4d4f' : '#25D366',
    }}>
      {isError ? <AlertCircle size={15} /> : <CheckCircle2 size={15} />}
      {msg}
    </div>
  )
}

export default function Profile() {
  const { profile, updateProfile, changePassword, sessionStatus } = useApp()
  const navigate = useNavigate()
  const fileRef = useRef(null)

  // Avatar
  const [avatar, setAvatar] = useState(profile.avatar || null)

  // Profile fields
  const [name, setName] = useState(profile.name || '')
  const [email, setEmail] = useState(profile.email || '')
  const [company, setCompany] = useState(profile.company || '')
  const [role, setRole] = useState(profile.role || '')
  const [profileMsg, setProfileMsg] = useState('')
  const [profileErr, setProfileErr] = useState('')
  const [savingProfile, setSavingProfile] = useState(false)

  // Password fields
  const [oldPwd, setOldPwd] = useState('')
  const [newPwd, setNewPwd] = useState('')
  const [confirmPwd, setConfirmPwd] = useState('')
  const [showOld, setShowOld] = useState(false)
  const [showNew, setShowNew] = useState(false)
  const [showConfirm, setShowConfirm] = useState(false)
  const [pwdMsg, setPwdMsg] = useState('')
  const [pwdErr, setPwdErr] = useState('')
  const [savingPwd, setSavingPwd] = useState(false)

  const initial = name ? name.charAt(0).toUpperCase() : '?'

  const handleAvatarChange = (e) => {
    const file = e.target.files[0]
    if (!file) return
    const reader = new FileReader()
    reader.onload = (ev) => {
      setAvatar(ev.target.result)
    }
    reader.readAsDataURL(file)
  }

  const handleSaveProfile = async (e) => {
    e.preventDefault()
    if (!name.trim()) { setProfileErr('Name is required.'); return }
    setSavingProfile(true)
    setProfileMsg(''); setProfileErr('')
    await new Promise(r => setTimeout(r, 500))
    updateProfile({ name: name.trim(), email: email.trim(), company: company.trim(), role: role.trim(), avatar })
    setSavingProfile(false)
    setProfileMsg('Profile saved successfully.')
    setTimeout(() => setProfileMsg(''), 3000)
  }

  const handleSavePassword = async (e) => {
    e.preventDefault()
    if (!oldPwd || !newPwd || !confirmPwd) { setPwdErr('All fields are required.'); return }
    if (newPwd !== confirmPwd) { setPwdErr('New passwords do not match.'); return }
    if (newPwd.length < 6) { setPwdErr('Password must be at least 6 characters.'); return }
    setSavingPwd(true)
    setPwdMsg(''); setPwdErr('')
    try {
      await changePassword(oldPwd, newPwd)
      setPwdMsg('Password changed successfully.')
      setOldPwd(''); setNewPwd(''); setConfirmPwd('')
      setTimeout(() => setPwdMsg(''), 3000)
    } catch (err) {
      setPwdErr(err.message || 'Failed to change password.')
    } finally {
      setSavingPwd(false)
    }
  }

  const eyeBtn = (show, setShow) => (
    <button type="button" onClick={() => setShow(v => !v)}
      style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--text-secondary)', display: 'flex', padding: 0 }}>
      {show ? <EyeOff size={15} /> : <Eye size={15} />}
    </button>
  )

  return (
    <div style={{ maxWidth: 700, margin: '0 auto', paddingBottom: 40 }}>

      {/* ── Avatar + Name banner ── */}
      <div style={{
        background: 'linear-gradient(135deg, #1a2634 0%, #0d1117 100%)',
        border: '1px solid var(--border-primary)',
        borderRadius: 16,
        padding: '32px 28px',
        marginBottom: 20,
        display: 'flex',
        alignItems: 'center',
        gap: 24,
        flexWrap: 'wrap',
      }}>
        {/* Avatar circle */}
        <div style={{ position: 'relative', flexShrink: 0 }}>
          <div style={{
            width: 90, height: 90, borderRadius: '50%',
            background: avatar ? 'transparent' : 'linear-gradient(135deg, #25D366, #128C7E)',
            border: '3px solid #25D366',
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            fontSize: 36, fontWeight: 700, color: '#fff',
            overflow: 'hidden', cursor: 'pointer',
          }} onClick={() => fileRef.current?.click()}>
            {avatar
              ? <img src={avatar} alt="avatar" style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
              : initial}
          </div>
          <button
            type="button"
            onClick={() => fileRef.current?.click()}
            style={{
              position: 'absolute', bottom: 2, right: 2,
              width: 26, height: 26, borderRadius: '50%',
              background: '#25D366', border: '2px solid #0d1117',
              display: 'flex', alignItems: 'center', justifyContent: 'center',
              cursor: 'pointer', color: '#fff',
            }}
          >
            <Camera size={13} />
          </button>
          <input ref={fileRef} type="file" accept="image/*" style={{ display: 'none' }} onChange={handleAvatarChange} />
        </div>

        <div style={{ flex: 1 }}>
          <div style={{ fontSize: 22, fontWeight: 700, color: 'var(--text-primary)', marginBottom: 4 }}>
            {name || 'Your Name'}
          </div>
          <div style={{ fontSize: 13, color: 'var(--text-secondary)', marginBottom: 8 }}>
            {role || 'Role not set'}{company ? ` · ${company}` : ''}
          </div>
          <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
            <span style={{
              display: 'inline-flex', alignItems: 'center', gap: 5,
              padding: '3px 10px', borderRadius: 20, fontSize: 12,
              background: sessionStatus?.status === 'connected' ? 'rgba(37,211,102,0.12)' : 'rgba(255,77,79,0.12)',
              color: sessionStatus?.status === 'connected' ? '#25D366' : '#ff4d4f',
              border: `1px solid ${sessionStatus?.status === 'connected' ? 'rgba(37,211,102,0.3)' : 'rgba(255,77,79,0.3)'}`,
            }}>
              <Phone size={11} />
              {sessionStatus?.status === 'connected'
                ? (sessionStatus.phone || 'WhatsApp Connected')
                : 'WhatsApp Disconnected'}
            </span>
          </div>
        </div>
      </div>

      {/* ── Profile Info Card ── */}
      <div className="card" style={{ padding: 24, marginBottom: 20 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 20 }}>
          <div style={{ width: 36, height: 36, borderRadius: 10, background: 'rgba(37,211,102,0.12)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
            <User size={18} color="#25D366" />
          </div>
          <div>
            <div style={{ fontWeight: 600, fontSize: 15, color: 'var(--text-primary)' }}>Profile Information</div>
            <div style={{ fontSize: 12, color: 'var(--text-secondary)' }}>Update your personal details</div>
          </div>
        </div>

        <form onSubmit={handleSaveProfile} style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
          <div className="profile-form-grid" style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 14 }}>
            <FormField label="Full Name" icon={User}>
              <Input value={name} onChange={e => setName(e.target.value)} placeholder="Your full name" />
            </FormField>
            <FormField label="Email Address" icon={Mail}>
              <Input value={email} onChange={e => setEmail(e.target.value)} placeholder="you@example.com" type="email" />
            </FormField>
            <FormField label="Company / Organisation" icon={Building2}>
              <Input value={company} onChange={e => setCompany(e.target.value)} placeholder="Company name" />
            </FormField>
            <FormField label="Role / Job Title" icon={Briefcase}>
              <Input value={role} onChange={e => setRole(e.target.value)} placeholder="e.g. Marketing Manager" />
            </FormField>
          </div>

          <Toast msg={profileMsg} type="success" />
          <Toast msg={profileErr} type="error" />

          <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 10 }}>
            <button type="submit" className="btn btn-primary" disabled={savingProfile}
              style={{ display: 'flex', alignItems: 'center', gap: 7 }}>
              <Save size={15} />
              {savingProfile ? 'Saving…' : 'Save Profile'}
            </button>
          </div>
        </form>
      </div>

      {/* ── WhatsApp Account Card ── */}
      <div className="card" style={{ padding: 24, marginBottom: 20 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 20 }}>
          <div style={{ width: 36, height: 36, borderRadius: 10, background: 'rgba(37,211,102,0.12)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
            <Phone size={18} color="#25D366" />
          </div>
          <div>
            <div style={{ fontWeight: 600, fontSize: 15, color: 'var(--text-primary)' }}>WhatsApp Account</div>
            <div style={{ fontSize: 12, color: 'var(--text-secondary)' }}>Connected session details</div>
          </div>
        </div>

        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 14 }}>
          <FormField label="Phone Number" icon={Phone}>
            <Input value={sessionStatus?.phone || '—'} readOnly />
          </FormField>
          <FormField label="Connection Status" icon={Shield}>
            <Input value={
              sessionStatus?.status === 'connected' ? 'Connected'
              : sessionStatus?.status === 'connecting' ? 'Connecting…'
              : 'Disconnected'
            } readOnly />
          </FormField>
        </div>

        <div style={{ marginTop: 14 }}>
          <button
            type="button"
            className="btn btn-secondary"
            onClick={() => navigate('/settings')}
            style={{ fontSize: 13 }}
          >
            Manage WhatsApp Connection →
          </button>
        </div>
      </div>

      {/* ── Change Password Card ── */}
      <div className="card" style={{ padding: 24 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 20 }}>
          <div style={{ width: 36, height: 36, borderRadius: 10, background: 'rgba(99,102,241,0.12)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
            <Lock size={18} color="#6366f1" />
          </div>
          <div>
            <div style={{ fontWeight: 600, fontSize: 15, color: 'var(--text-primary)' }}>Change Password</div>
            <div style={{ fontSize: 12, color: 'var(--text-secondary)' }}>Keep your account secure</div>
          </div>
        </div>

        <form onSubmit={handleSavePassword} style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
          <FormField label="Current Password" icon={Lock}>
            <Input value={oldPwd} onChange={e => setOldPwd(e.target.value)}
              placeholder="Enter current password"
              type={showOld ? 'text' : 'password'}
              rightEl={eyeBtn(showOld, setShowOld)} />
          </FormField>
          <div className="profile-form-grid" style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 14 }}>
            <FormField label="New Password" icon={Lock}>
              <Input value={newPwd} onChange={e => setNewPwd(e.target.value)}
                placeholder="Min. 6 characters"
                type={showNew ? 'text' : 'password'}
                rightEl={eyeBtn(showNew, setShowNew)} />
            </FormField>
            <FormField label="Confirm New Password" icon={Lock}>
              <Input value={confirmPwd} onChange={e => setConfirmPwd(e.target.value)}
                placeholder="Repeat new password"
                type={showConfirm ? 'text' : 'password'}
                rightEl={eyeBtn(showConfirm, setShowConfirm)} />
            </FormField>
          </div>

          <Toast msg={pwdMsg} type="success" />
          <Toast msg={pwdErr} type="error" />

          <div style={{ display: 'flex', justifyContent: 'flex-end' }}>
            <button type="submit" className="btn btn-primary" disabled={savingPwd}
              style={{ display: 'flex', alignItems: 'center', gap: 7, background: '#6366f1', borderColor: '#6366f1' }}>
              <Lock size={15} />
              {savingPwd ? 'Updating…' : 'Update Password'}
            </button>
          </div>
        </form>
      </div>

    </div>
  )
}
