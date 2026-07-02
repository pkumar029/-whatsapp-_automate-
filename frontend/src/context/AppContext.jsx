import { createContext, useContext, useState, useEffect, useRef, useCallback } from 'react'
import { whatsappApi, contactsApi, messagesApi, authApi } from '../services/api'
import { useAuth } from './AuthContext'

const AppContext = createContext()

export function AppProvider({ children }) {
  // /whatsapp/status and /whatsapp/events are now scoped to the logged-in
  // user — don't poll/connect either until a real session exists.
  const { isAuthenticated } = useAuth()
  // ─── Theme ──────────────────────────────────────────────────
  const [theme, setThemeState] = useState(() => localStorage.getItem('wa_theme') || 'dark')

  const setTheme = (newTheme) => setThemeState(newTheme)
  const toggleTheme = () => setThemeState(prev => prev === 'dark' ? 'light' : 'dark')

  useEffect(() => {
    document.documentElement.setAttribute('data-theme', theme)
    localStorage.setItem('wa_theme', theme)
  }, [theme])

  // ─── App Profile (user's own display data) ──────────────────
  const [profile, setProfileState] = useState(() => {
    try {
      const saved = localStorage.getItem('wa_profile')
      if (saved) {
        const parsed = JSON.parse(saved)
        if (parsed?.name) return parsed
      }
    } catch {}
    return { name: '', email: '', company: '', role: '', about: '', avatar: null, isProfileConfigured: false }
  })

  const updateProfile = (updatedFields) => {
    setProfileState(prev => {
      const next = { ...prev, ...updatedFields, isProfileConfigured: true }
      localStorage.setItem('wa_profile', JSON.stringify(next))
      return next
    })
  }

  const changePassword = async (oldPassword, newPassword) => {
    const res = await authApi.changePassword({ old_password: oldPassword, new_password: newPassword })
    return res.data
  }

  // ─── WhatsApp Profile (connected account's name/pic/phone) ──
  const [waProfile, setWaProfile] = useState(() => {
    try {
      const saved = localStorage.getItem('wa_whatsapp_profile')
      return saved ? JSON.parse(saved) : null
    } catch { return null }
  })

  const _applyWaProfile = useCallback((p) => {
    if (!p) return
    const profileData = {
      name: p.name || p.display_name || null,
      phone: p.phone || p.wa_account || null,
      profilePicUrl: p.profile_pic_url || null,
      about: p.about || null,
      wid: p.wid || null,
      lastSyncedAt: p.last_synced_at || null,
    }
    setWaProfile(profileData)
    localStorage.setItem('wa_whatsapp_profile', JSON.stringify(profileData))
  }, [])

  const clearWaProfile = useCallback(() => {
    setWaProfile(null)
    localStorage.removeItem('wa_whatsapp_profile')
  }, [])

  // Fetch the connected WhatsApp profile from the backend and update state.
  // Safe to call at any time — silently ignores errors.
  const fetchWaProfile = useCallback(async () => {
    try {
      const res = await whatsappApi.getProfile()
      const p = res.data
      if (p?.success) _applyWaProfile(p)
    } catch {}
  }, [_applyWaProfile])

  // ─── Session Status ──────────────────────────────────────────
  const [sessionStatus, setSessionStatus] = useState({ status: 'disconnected' })
  const [loadingSession, setLoadingSession] = useState(true)
  const [accountKey, setAccountKey] = useState(0)
  const [syncedAt, setSyncedAt] = useState(0)

  const prevStatusRef = useRef('disconnected')
  const bridgePhoneRef = useRef(null)
  const myPhoneRef = useRef(localStorage.getItem('wa_active_phone') || null)
  const initiatedConnectionRef = useRef(false)

  const markConnectionInitiated = useCallback(() => {
    initiatedConnectionRef.current = true
  }, [])

  const refreshSessionStatus = useCallback(async () => {
    try {
      const res = await whatsappApi.getStatus()
      const data = res.data
      setSessionStatus(data)

      const bridgePhone = data.phone || null
      bridgePhoneRef.current = bridgePhone

      const myPhone = myPhoneRef.current

      if (bridgePhone && !myPhone) {
        myPhoneRef.current = bridgePhone
        localStorage.setItem('wa_active_phone', bridgePhone)
      } else if (bridgePhone && initiatedConnectionRef.current) {
        if (bridgePhone !== myPhone) {
          const clearKeys = ['wa_last_sync', 'wa_session_start', 'wa_favourites',
            'wa_pinned', 'wa_archived', 'wa_last_phone', 'wa_whatsapp_profile']
          clearKeys.forEach(k => localStorage.removeItem(k))
          setAccountKey(k => k + 1)
        }
        myPhoneRef.current = bridgePhone
        localStorage.setItem('wa_active_phone', bridgePhone)
        initiatedConnectionRef.current = false
      }

      if (data.status === 'connected' && prevStatusRef.current !== 'connected') {
        prevStatusRef.current = 'connected'
        setAccountKey(k => k + 1)

        // Fetch WhatsApp profile immediately on connection
        fetchWaProfile()

        // Background contacts + messages sync (throttled to once per 30 min)
        const lastSync = localStorage.getItem('wa_last_sync')
        const now = Date.now()
        if (!lastSync || now - parseInt(lastSync, 10) > 30 * 60 * 1000) {
          localStorage.setItem('wa_last_sync', String(now))
          contactsApi.sync()
            .then(() => messagesApi.sync().catch(() => {}))
            .then(() => setSyncedAt(Date.now()))
            .catch(() => setSyncedAt(Date.now()))
        }
      } else if (data.status !== 'connected') {
        if (prevStatusRef.current === 'connected') {
          const wasOurAccount = !bridgePhoneRef.current || bridgePhoneRef.current === myPhoneRef.current
          if (wasOurAccount) {
            myPhoneRef.current = null
            localStorage.removeItem('wa_active_phone')
            localStorage.removeItem('wa_last_sync')
          }
          setAccountKey(k => k + 1)
        }
        prevStatusRef.current = data.status
        clearWaProfile()
      }

      return data
    } catch {
      setSessionStatus({ status: 'disconnected' })
    } finally {
      setLoadingSession(false)
    }
  }, [fetchWaProfile, clearWaProfile])

  // ─── Polling fallback (every 8 s) ───────────────────────────
  useEffect(() => {
    if (!isAuthenticated) return
    refreshSessionStatus()
    const interval = setInterval(refreshSessionStatus, 8000)
    return () => clearInterval(interval)
  }, [isAuthenticated])  // eslint-disable-line react-hooks/exhaustive-deps

  // ─── Persistent global SSE listener ─────────────────────────
  // Stays alive for the full app session. Provides instant detection of
  // connected / disconnected / qr events without waiting for the 8 s poll.
  useEffect(() => {
    if (!isAuthenticated) return
    let es = null
    let reconnectTimer = null
    let cancelled = false

    const connect = () => {
      if (cancelled) return
      try {
        es = new EventSource(whatsappApi.eventsUrl())
      } catch {
        reconnectTimer = setTimeout(connect, 8000)
        return
      }

      es.onmessage = (evt) => {
        if (cancelled) return
        try {
          const data = JSON.parse(evt.data)
          const bs = data.bridge_status || data.status

          if (data.type === 'connected' || bs === 'connected') {
            // Instant profile fetch — don't wait for the 8 s poll
            fetchWaProfile()
            refreshSessionStatus()
          } else if (data.type === 'disconnected') {
            clearWaProfile()
            refreshSessionStatus()
          } else if (data.type === 'status' && bs && bs !== 'connected') {
            // Periodic status snapshots from the proxy (bridge offline, etc.)
            setSessionStatus(s => (s.status === bs ? s : { ...s, status: bs }))
          }
        } catch {}
      }

      es.onerror = () => {
        if (es) { try { es.close() } catch {} }
        es = null
        if (!cancelled) reconnectTimer = setTimeout(connect, 8000)
      }
    }

    connect()

    return () => {
      cancelled = true
      if (es) { try { es.close() } catch {} }
      clearTimeout(reconnectTimer)
    }
  }, [isAuthenticated])  // eslint-disable-line react-hooks/exhaustive-deps

  return (
    <AppContext.Provider value={{
      theme,
      setTheme,
      toggleTheme,
      profile,
      updateProfile,
      changePassword,
      sessionStatus,
      setSessionStatus,
      refreshSessionStatus,
      fetchWaProfile,
      markConnectionInitiated,
      loadingSession,
      accountKey,
      syncedAt,
      waProfile,
    }}>
      {children}
    </AppContext.Provider>
  )
}

export function useApp() {
  const ctx = useContext(AppContext)
  if (!ctx) throw new Error('useApp must be used within an AppProvider')
  return ctx
}
