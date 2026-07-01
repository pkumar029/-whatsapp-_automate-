import { useNavigate } from 'react-router-dom'
import './Auth.css'

export default function Auth() {
  const navigate = useNavigate()

  return (
    <div className="auth-root">
      <div className="welcome-card">
        <div className="welcome-logo">
          <div className="welcome-logo-icon">
            <svg width="48" height="48" viewBox="0 0 40 40" fill="none">
              <rect width="40" height="40" rx="10" fill="#25D366" />
              <path d="M20 8C13.4 8 8 13.4 8 20c0 2.1.6 4.1 1.6 5.8L8 32l6.4-1.6C16 31.4 17.9 32 20 32c6.6 0 12-5.4 12-12S26.6 8 20 8zm6 16.4c-.3.8-1.4 1.5-2 1.6-.5.1-1.2.1-1.9-.1-.4-.1-1-.3-1.7-.6-3-1.3-5-4.3-5.1-4.5-.1-.2-.9-1.2-.9-2.3 0-1.1.6-1.6.8-1.9.2-.2.5-.3.6-.3h.5c.1 0 .3 0 .4.3.1.4.6 1.4.6 1.5.1.1.1.3 0 .4-.1.1-.1.2-.2.3l-.3.3c-.1.1-.2.2-.1.4.1.2.6.9 1.2 1.5.8.8 1.5 1.1 1.7 1.2.2.1.4.1.5-.1l.8-.9c.2-.2.3-.2.5-.1l1.7.8c.2.1.3.1.4.2.1.3 0 1-.3 1.8z" fill="white" />
            </svg>
          </div>
          <div>
            <h1 className="welcome-title">WhatsApp Automate</h1>
            <p className="welcome-subtitle">Your smart messaging platform</p>
          </div>
        </div>

        <div className="welcome-features">
          <div className="welcome-feature">
            <span className="welcome-feature-icon">⚡</span>
            <div>
              <strong>Automation</strong>
              <span>Set up smart replies and workflows</span>
            </div>
          </div>
          <div className="welcome-feature">
            <span className="welcome-feature-icon">📊</span>
            <div>
              <strong>Campaigns</strong>
              <span>Broadcast messages to all contacts</span>
            </div>
          </div>
          <div className="welcome-feature">
            <span className="welcome-feature-icon">💬</span>
            <div>
              <strong>Live Chat</strong>
              <span>Manage conversations in real time</span>
            </div>
          </div>
        </div>

        <button
          className="welcome-btn"
          onClick={() => navigate('/login')}
        >
          Connect WhatsApp
        </button>

        <p className="welcome-hint">Scan a QR code to link your WhatsApp account</p>
      </div>
    </div>
  )
}
