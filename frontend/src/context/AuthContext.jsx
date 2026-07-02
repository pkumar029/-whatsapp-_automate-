import { createContext, useContext, useState, useEffect, useCallback } from 'react'
import { authApi } from '../services/api'

const AuthContext = createContext()

const TOKEN_KEY = 'wa_token'

export function AuthProvider({ children }) {
  const [user, setUser] = useState(null)
  const [authLoading, setAuthLoading] = useState(true)

  const isAuthenticated = !!user

  // On mount: if a token is stored, verify it's still valid and load the
  // real user. No token (or an invalid one) just means "not logged in".
  useEffect(() => {
    const token = localStorage.getItem(TOKEN_KEY)
    if (!token) {
      setAuthLoading(false)
      return
    }
    authApi.me()
      .then(res => setUser(res.data))
      .catch(() => localStorage.removeItem(TOKEN_KEY))
      .finally(() => setAuthLoading(false))
  }, [])

  // api.js dispatches this on any 401 — drop the stale session so
  // AuthRoute redirects to /auth.
  useEffect(() => {
    const handler = () => setUser(null)
    window.addEventListener('auth:unauthorized', handler)
    return () => window.removeEventListener('auth:unauthorized', handler)
  }, [])

  const login = useCallback(async (username, password) => {
    const res = await authApi.login({ username, password })
    const { access_token, user: userData } = res.data
    localStorage.setItem(TOKEN_KEY, access_token)
    setUser(userData)
    return userData
  }, [])

  const register = useCallback(async (name, username, password) => {
    const res = await authApi.register({ name, username, password })
    const { access_token, user: userData } = res.data
    localStorage.setItem(TOKEN_KEY, access_token)
    setUser(userData)
    return userData
  }, [])

  const logout = useCallback(async () => {
    try { await authApi.logout() } catch (_) {}
    localStorage.removeItem(TOKEN_KEY)
    localStorage.removeItem('wa_active_phone')
    localStorage.removeItem('wa_last_sync')
    localStorage.removeItem('wa_whatsapp_profile')
    setUser(null)
  }, [])

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
      login,
      register,
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
