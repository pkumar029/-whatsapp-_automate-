import { createContext, useContext, useState, useEffect, useRef, useCallback } from 'react'
import { whatsappApi, contactsApi } from '../services/api'

const AppContext = createContext()

export function AppProvider({ children }) {
  // --- Theme State ---
  const [theme, setThemeState] = useState(() => {
    return localStorage.getItem('wa_theme') || 'dark'
  })

  const setTheme = (newTheme) => {
    setThemeState(newTheme)
  }

  const toggleTheme = () => {
    setThemeState(prev => prev === 'dark' ? 'light' : 'dark')
  }

  // Apply theme class to HTML element
  useEffect(() => {
    document.documentElement.setAttribute('data-theme', theme)
    localStorage.setItem('wa_theme', theme)
  }, [theme])

  // --- Profile State ---
  const [profile, setProfileState] = useState(() => {
    const saved = localStorage.getItem('wa_profile')
    if (saved) {
      try {
        const parsed = JSON.parse(saved)
        if (parsed && parsed.name && parsed.name !== 'Admin User') {
          return parsed
        }
      } catch (e) {
        // Fallback to default if JSON parse fails
      }
    }
    return {
      name: '',
      email: '',
      company: '',
      role: '',
      about: 'Hey there! I am using WhatsApp.',
      avatar: null,
      isProfileConfigured: false
    }
  })

  const updateProfile = (updatedFields) => {
    setProfileState(prev => {
      const next = { ...prev, ...updatedFields, isProfileConfigured: true }
      localStorage.setItem('wa_profile', JSON.stringify(next))
      return next
    })
  }

  // Simulated Password Change
  const changePassword = async (oldPassword, newPassword) => {
    return new Promise((resolve, reject) => {
      setTimeout(() => {
        if (!oldPassword || !newPassword) {
          reject(new Error('Password fields cannot be empty.'))
        } else if (oldPassword === newPassword) {
          reject(new Error('New password cannot be the same as old password.'))
        } else {
          // Success case
          resolve({ success: true, message: 'Password updated successfully!' })
        }
      }, 800)
    })
  }

  const [sessionStatus, setSessionStatus] = useState({ status: 'disconnected' })
  const [loadingSession, setLoadingSession] = useState(true)
  const [accountKey, setAccountKey] = useState(0)
  const prevStatusRef = useRef('disconnected')
  // Seed from localStorage so account-switch detection survives page refreshes
  const prevPhoneRef = useRef(localStorage.getItem('wa_active_phone') || null)

  const refreshSessionStatus = useCallback(async () => {
    try {
      const res = await whatsappApi.getStatus()
      const data = res.data
      setSessionStatus(data)

      const newPhone = data.phone || null

      // Detect account switch — different phone connected
      // NOTE: prevPhoneRef is NOT cleared on disconnect so that connecting a
      // different account AFTER a disconnect is still caught.
      if (newPhone && prevPhoneRef.current && newPhone !== prevPhoneRef.current) {
        // Clear all account-scoped caches so new account starts clean
        const clearKeys = ['wa_last_sync', 'wa_session_start', 'wa_favourites', 'wa_pinned', 'wa_archived', 'wa_last_phone']
        clearKeys.forEach(k => localStorage.removeItem(k))
        setAccountKey(k => k + 1)
      }
      if (newPhone) {
        prevPhoneRef.current = newPhone
        localStorage.setItem('wa_active_phone', newPhone)
      }

      // Every time a session first becomes connected: remount UI + sync contacts
      if (data.status === 'connected' && prevStatusRef.current !== 'connected') {
        prevStatusRef.current = 'connected'
        // Remount all pages so stale data from the previous session is cleared
        // and every component refetches fresh. Covers same-account re-login too.
        setAccountKey(k => k + 1)
        const lastSync = localStorage.getItem('wa_last_sync')
        const now = Date.now()
        if (!lastSync || now - parseInt(lastSync, 10) > 30 * 60 * 1000) {
          localStorage.setItem('wa_last_sync', String(now))
          contactsApi.sync().catch(() => {})
        }
      } else if (data.status !== 'connected') {
        prevStatusRef.current = data.status
      }

      return data
    } catch (err) {
      setSessionStatus({ status: 'disconnected' })
    } finally {
      setLoadingSession(false)
    }
  }, [])

  useEffect(() => {
    refreshSessionStatus()
    const interval = setInterval(refreshSessionStatus, 8000)
    return () => clearInterval(interval)
  }, [])

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
      loadingSession,
      accountKey,
    }}>
      {children}
    </AppContext.Provider>
  )
}

export function useApp() {
  const context = useContext(AppContext)
  if (!context) {
    throw new Error('useApp must be used within an AppProvider')
  }
  return context
}
