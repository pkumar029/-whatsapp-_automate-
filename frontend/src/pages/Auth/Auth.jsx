import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { useAuth } from '../../context/AuthContext'
import './Auth.css'

export default function Auth() {
  const navigate = useNavigate()
  const { login, register } = useAuth()
  const [tab, setTab] = useState('login') // 'login' | 'register'
  const [name, setName] = useState('')
  const [username, setUsername] = useState('')
  const [password, setPassword] = useState('')
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(false)

  const switchTab = (next) => { setTab(next); setError('') }

  const handleSubmit = async (e) => {
    e.preventDefault()
    setError('')
    setLoading(true)
    try {
      if (tab === 'login') {
        await login(username, password)
      } else {
        await register(name, username, password)
      }
      navigate('/login')
    } catch (err) {
      setError(err.response?.data?.detail || 'Something went wrong — please try again.')
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="auth-root">
      <div className="auth-card">
        <div className="auth-logo">
          <svg width="36" height="36" viewBox="0 0 40 40" fill="none">
            <rect width="40" height="40" rx="10" fill="#25D366" />
            <path d="M20 8C13.4 8 8 13.4 8 20c0 2.1.6 4.1 1.6 5.8L8 32l6.4-1.6C16 31.4 17.9 32 20 32c6.6 0 12-5.4 12-12S26.6 8 20 8zm6 16.4c-.3.8-1.4 1.5-2 1.6-.5.1-1.2.1-1.9-.1-.4-.1-1-.3-1.7-.6-3-1.3-5-4.3-5.1-4.5-.1-.2-.9-1.2-.9-2.3 0-1.1.6-1.6.8-1.9.2-.2.5-.3.6-.3h.5c.1 0 .3 0 .4.3.1.4.6 1.4.6 1.5.1.1.1.3 0 .4-.1.1-.1.2-.2.3l-.3.3c-.1.1-.2.2-.1.4.1.2.6.9 1.2 1.5.8.8 1.5 1.1 1.7 1.2.2.1.4.1.5-.1l.8-.9c.2-.2.3-.2.5-.1l1.7.8c.2.1.3.1.4.2.1.3 0 1-.3 1.8z" fill="white" />
          </svg>
          <h1>WhatsApp Automate</h1>
        </div>

        <div className="auth-tabs">
          <button type="button" className={`auth-tab ${tab === 'login' ? 'active' : ''}`} onClick={() => switchTab('login')}>
            Log In
          </button>
          <button type="button" className={`auth-tab ${tab === 'register' ? 'active' : ''}`} onClick={() => switchTab('register')}>
            Register
          </button>
        </div>

        <form className="auth-form" onSubmit={handleSubmit}>
          {error && <div className="auth-error">{error}</div>}

          {tab === 'register' && (
            <div className="auth-field">
              <label htmlFor="auth-name">Name</label>
              <input
                id="auth-name"
                type="text"
                value={name}
                onChange={(e) => setName(e.target.value)}
                placeholder="Your name"
                autoComplete="name"
                required
              />
            </div>
          )}

          <div className="auth-field">
            <label htmlFor="auth-username">Email</label>
            <input
              id="auth-username"
              type="text"
              value={username}
              onChange={(e) => setUsername(e.target.value)}
              placeholder="you@example.com"
              autoComplete="username"
              required
            />
          </div>

          <div className="auth-field">
            <label htmlFor="auth-password">Password</label>
            <input
              id="auth-password"
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              placeholder={tab === 'register' ? 'At least 6 characters' : '••••••••'}
              autoComplete={tab === 'login' ? 'current-password' : 'new-password'}
              minLength={tab === 'register' ? 6 : undefined}
              required
            />
          </div>

          <button type="submit" className="auth-submit" disabled={loading}>
            {loading ? 'Please wait…' : tab === 'login' ? 'Log In' : 'Create Account'}
          </button>
        </form>

        <p className="auth-hint">
          {tab === 'login' ? "Don't have an account? " : 'Already have an account? '}
          <a href="#" onClick={(e) => { e.preventDefault(); switchTab(tab === 'login' ? 'register' : 'login') }}>
            {tab === 'login' ? 'Register' : 'Log In'}
          </a>
        </p>
      </div>
    </div>
  )
}
