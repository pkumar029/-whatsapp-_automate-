import { createContext, useContext, useState, useEffect, useRef, useCallback } from 'react'
import { whatsappApi, contactsApi, messagesApi } from '../services/api'

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
        if (parsed && parsed.name) {
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
          resolve({ success: true, message: 'Password updated successfully!' })
        }
      }, 800)
    })
  }

  const [sessionStatus, setSessionStatus] = useState({ status: 'disconnected' })
  const [loadingSession, setLoadingSession] = useState(true)
  const [accountKey, setAccountKey] = useState(0)
  // Bumped after each contacts sync — lets pages refetch without a full remount
  const [syncedAt, setSyncedAt] = useState(0)
  const prevStatusRef = useRef('disconnected')
  const prevPhoneRef = useRef(localStorage.getItem('wa_active_phone') || null)

  // WhatsApp profile for the connected account (name, phone, profilePicUrl)
  const [waProfile, setWaProfile] = useState(() => {
    try {
      const saved = localStorage.getItem('wa_whatsapp_profile')
      return saved ? JSON.parse(saved) : null
    } catch { return null }
  })

  const refreshSessionStatus = useCallback(async () => {
    try {
      const res = await whatsappApi.getStatus()
      const data = res.data
      setSessionStatus(data)

      const newPhone = data.phone || null

      // Detect account switch — different phone connected
      if (newPhone && prevPhoneRef.current && newPhone !== prevPhoneRef.current) {
        const clearKeys = ['wa_last_sync', 'wa_session_start', 'wa_favourites', 'wa_pinned', 'wa_archived', 'wa_last_phone', 'wa_whatsapp_profile']
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
        setAccountKey(k => k + 1)

        // Fetch WhatsApp profile (non-blocking)
        whatsappApi.getProfile().then(res => {
          const p = res.data
          if (p && p.success) {
            const profileData = {
              name: p.name,
              phone: p.phone || p.wa_account,
              profilePicUrl: p.profile_pic_url || null,
              about: p.about || null,
              wid: p.wid || null,
            }
            setWaProfile(profileData)
            localStorage.setItem('wa_whatsapp_profile', JSON.stringify(profileData))
          }
        }).catch(() => {})

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
          setAccountKey(k => k + 1)
          prevPhoneRef.current = null
          localStorage.removeItem('wa_active_phone')
          localStorage.removeItem('wa_last_sync')
        }
        prevStatusRef.current = data.status
        setWaProfile(null)
        localStorage.removeItem('wa_whatsapp_profile')
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
      syncedAt,
      waProfile,
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
