import { createContext, useContext, useState, useEffect, useCallback, useRef } from 'react'
import { authApi } from '../services/api'

const AuthContext = createContext()

const TOKEN_KEY = 'wa_token'

export function AuthProvider({ children }) {
  const [user, setUser] = useState(null)
  const [authLoading, setAuthLoading] = useState(true)
  const [authError, setAuthError] = useState('')
  const provisioning = useRef(false)

  const isAuthenticated = !!user

  // No email/password — silently create a device-bound account (and its
  // token) the moment this browser has no valid session. There's nothing for
  // the user to fill in; this is what stands in for "logging in".
  const provisionDevice = useCallback(async () => {
    if (provisioning.current) return null
    provisioning.current = true
    try {
      const res = await authApi.device()
      const { access_token, user: userData } = res.data
      localStorage.setItem(TOKEN_KEY, access_token)
      setUser(userData)
      setAuthError('')
      return userData
    } catch (_) {
      setAuthError('Could not reach the server to start a session. Check your connection and retry.')
      return null
    } finally {
      provisioning.current = false
    }
  }, [])

  // On mount: an existing token just needs its user loaded; no token (or an
  // invalid/expired one) means silently provisioning a fresh device account.
  useEffect(() => {
    const token = localStorage.getItem(TOKEN_KEY)
    if (!token) {
      provisionDevice().finally(() => setAuthLoading(false))
      return
    }
    authApi.me()
      .then(res => setUser(res.data))
      .catch(async () => {
        localStorage.removeItem(TOKEN_KEY)
        await provisionDevice()
      })
      .finally(() => setAuthLoading(false))
  }, []) // eslint-disable-line react-hooks/exhaustive-deps

  // api.js dispatches this on any 401 — the stored token is dead, so drop it
  // and silently get a new device account rather than stranding the user on
  // a dead end (there's no login form to send them back to).
  useEffect(() => {
    const handler = () => {
      setUser(null)
      localStorage.removeItem(TOKEN_KEY)
      provisionDevice()
    }
    window.addEventListener('auth:unauthorized', handler)
    return () => window.removeEventListener('auth:unauthorized', handler)
  }, [provisionDevice])

  const logout = useCallback(async () => {
    try { await authApi.logout() } catch (_) {}
    localStorage.removeItem(TOKEN_KEY)
    localStorage.removeItem('wa_active_phone')
    localStorage.removeItem('wa_last_sync')
    localStorage.removeItem('wa_whatsapp_profile')
    setUser(null)
    // Immediately hand back a fresh device account — "log out" here really
    // means "disconnect and start a new WhatsApp connection from scratch".
    await provisionDevice()
  }, [provisionDevice])

  const refreshUser = useCallback(async () => {
    try {
      const res = await authApi.me()
      setUser(res.data)
      return res.data
    } catch (_) {
      return null
    }
  }, [])

  return (
    <AuthContext.Provider value={{
      user,
      isAuthenticated,
      authLoading,
      authError,
      retryAuth: provisionDevice,
      logout,
      refreshUser,
    }}>
      {children}
    </AuthContext.Provider>
  )
}

export function useAuth() {
  const ctx = useContext(AuthContext)
  if (!ctx) throw new Error('useAuth must be used within AuthProvider')
  return ctx
}
