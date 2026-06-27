import { createContext, useContext, useState, useEffect } from 'react'
import { whatsappApi } from '../services/api'

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

  const refreshSessionStatus = async () => {
    try {
      const res = await whatsappApi.getStatus()
      setSessionStatus(res.data)
      return res.data
    } catch (err) {
      setSessionStatus({ status: 'disconnected' })
    } finally {
      setLoadingSession(false)
    }
  }

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
      loadingSession
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
