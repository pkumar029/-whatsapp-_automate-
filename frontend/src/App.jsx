import { BrowserRouter, Routes, Route, Navigate, Outlet } from 'react-router-dom'
import Layout from './components/Layout/Layout'
import Dashboard from './pages/Dashboard/Dashboard'
import Automations from './pages/Automations/Automations'
import Contacts from './pages/Contacts/Contacts'
import Messages from './pages/Messages/Messages'
import Logs from './pages/Logs/Logs'
import Settings from './pages/Settings/Settings'
import Campaigns from './pages/Campaigns/Campaigns'
import Profile from './pages/Profile/Profile'
import Status from './pages/Status/Status'
import Login from './pages/Login/Login'
import Welcome from './pages/Auth/Auth'
import { useApp } from './context/AppContext'
import { useAuth } from './context/AuthContext'

// Remounts Layout (and all child pages) when the connected WhatsApp account changes
function KeyedLayout() {
  const { accountKey } = useApp()
  return <Layout key={accountKey} />
}

const Spinner = ({ label }) => (
  <div style={{
    display: 'flex',
    justifyContent: 'center',
    alignItems: 'center',
    height: '100vh',
    background: 'radial-gradient(circle at center, #1a202c 0%, #0d1117 100%)',
    color: 'var(--text-muted)',
    fontFamily: 'system-ui, sans-serif'
  }}>
    <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 12 }}>
      <div style={{
        width: 32,
        height: 32,
        border: '3px solid var(--border-primary)',
        borderTop: '3px solid var(--accent-primary)',
        borderRadius: '50%',
        animation: 'spin 1s linear infinite'
      }} />
      <div>{label}</div>
    </div>
    <style>{`@keyframes spin { to { transform: rotate(360deg); } }`}</style>
  </div>
)

// Layer 1: must be JWT-authenticated
function AuthRoute() {
  const { isAuthenticated, authLoading } = useAuth()
  if (authLoading) return <Spinner label="Loading…" />
  if (!isAuthenticated) return <Navigate to="/auth" replace />
  return <Outlet />
}

// Layer 2: must have WhatsApp connected
function ProtectedRoute() {
  const { sessionStatus, loadingSession } = useApp()
  if (loadingSession) return <Spinner label="Connecting to WhatsApp…" />
  if (sessionStatus?.status !== 'connected') return <Navigate to="/login" replace />
  return <Outlet />
}

function App() {
  return (
    <BrowserRouter future={{ v7_startTransition: true, v7_relativeSplatPath: true }}>
      <Routes>
        {/* Welcome / landing page */}
        <Route path="auth" element={<Welcome />} />

        {/* JWT required from here on */}
        <Route element={<AuthRoute />}>
          {/* WhatsApp QR login — JWT required, WhatsApp not yet required */}
          <Route path="login" element={<Login />} />

          {/* Full app — JWT + WhatsApp connected */}
          <Route element={<ProtectedRoute />}>
            <Route path="/" element={<KeyedLayout />}>
              <Route index element={<Navigate to="/dashboard" replace />} />
              <Route path="dashboard" element={<Dashboard />} />
              <Route path="automations" element={<Automations />} />
              <Route path="contacts" element={<Contacts />} />
              <Route path="messages" element={<Messages />} />
              <Route path="campaigns" element={<Campaigns />} />
              <Route path="logs" element={<Logs />} />
              <Route path="settings" element={<Settings />} />
              <Route path="profile" element={<Profile />} />
              <Route path="status" element={<Status />} />
            </Route>
          </Route>
        </Route>

        <Route path="*" element={<Navigate to="/dashboard" replace />} />
      </Routes>
    </BrowserRouter>
  )
}

export default App
